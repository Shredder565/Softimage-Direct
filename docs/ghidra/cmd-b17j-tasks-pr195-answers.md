# CMD-B17j: answers to the PR #195 open questions for `tasks.dll` (`DeleteObj`, `CopyPaste`, `RunPerformanceTest`, undo rows, `Add3DObjectToScene`, `SetReference2`, `DelayedRefresh`)

Row: **CMD-B17j** (follow-up of CMD-B16c). Status: **SPEC** (4 promoted: `RunPerformanceTest`, `CopyPaste`,
`Add3DObjectToScene`, `SetReference2`), **SPEC-PARTIAL** (1: `DeleteObj`).
Run: 2026-11-20, si-analyst worker, unattended, batch 17 (binary, REA + Ghidra 12.1.4 on the PC, one session).
No XSIBATCH golden: nothing was executed. No decompiler output or disassembly is reproduced; addresses, GUIDs,
constants and output format strings (file-format layout) only.

| File | Bytes | sha256 prefix | Read |
|---|---|---|---|
| `Application\bin\tasks.dll` (image base `0x180000000`) | 972104 | `d760b7aad9b4` | partly (about 30 functions, data tables, string block `0x1800ac600`..`0x1800ace98`) |

Functions read this batch: `0x180013ec0`, `0x180013c30`, `0x180013230`, `0x180013630`, `0x180012a40`, `0x180013e90`,
`0x1800134c0`, `0x180013470` (DeleteObj); `0x18003ef80`, `0x18003e600`, `0x18003ecc0`, `0x18003e090`,
`0x18003f670`, `0x18003f4f0` (RunPerformanceTest; `0x18003e0f0` and `0x18003e850` fail to decompile, their output is
described from the format strings they own); `0x1800588c0`, `0x180058680`, `0x180057f20` (CopyPaste);
`0x180055630` (Undo); `0x18003dea0`, `0x18003dbf0` (DelayedRefresh); `0x18002da30`, `0x18002f290`,
`0x18002ed70`, `0x18002ea40` (Add3DObjectToScene); `0x180025630` incl. the switch blocks `0x1800258b7`..`0x1800259d1`,
`0x180025fe0`, `0x180025f90` (SetReference2). Import table read for the DLLs that host the helper classes.

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `DeleteObj` (`999ec43a-…`, `2d5d874c-…`) | `tasks.dll` | handler `dd531990-…`, worker `0x180012a40` | SPEC-PARTIAL (traverser in `corehelper.dll`) |
| `CopyPaste` | `tasks.dll` | handler `2c8a5f31-…`, worker `0x1800588c0` | **SPEC** (promoted) |
| `RunPerformanceTest` | `tasks.dll` | handler `0ed17cf6-…`, worker `0x18003ef80` | **SPEC** (promoted) |
| `Add3DObjectToScene` | `tasks.dll` | handler `a0d59008-…`, task slot 15 `0x18002da30` | **SPEC** (promoted) |
| `SetReference2` | `tasks.dll` | handler `de9980e7-…`, worker `0x180025630` | **SPEC** (promoted) |
| `Undo` / `Redo` / `BeginUndo` / `EndUndo` | `tasks.dll` | rows 6..9 of `b5097d5a` | SPEC (unchanged; Q21/Q22 refine) |
| `DelayedRefresh` | `tasks.dll` | `0x18003dbf0` | SPEC (unchanged; Q25 refines) |

Helper classes imported, not in `tasks.dll`: `C3DDeleteSelectedTraverser` / `C3DDeleteAllTraverser` from
**`corehelper.dll`**; `C3DAddToContainersTask` from **`sitaskcore.dll`**; `CSIStatManager::DumpSystemInfo` from
**`sigeneral.dll`**; `SIGetViewerControler` from `ut.dll`.

## 2. Answers

### Q17. DeleteObj expansion, last layer / pass, sub-tasks `0x18009db48` / `0x18009db58` — **partly**

Validation / filtering (`0x180013ec0`), run before anything is deleted. Flags: the command passes mode 0; bit `0x8`
= "delete all" and bit `0x10` = "skip checks" are only used by internal callers.
1. **Camera guard** (mode without 8 / 0x10): every input item and, recursively, all its children (skipping
   referenced-locked sub-trees) are scanned for a camera primitive (`1152e9b0-545e-11d0-8466-00a024c7919c`). If the
   number of cameras found equals the number of scene cameras that are not referenced-locked, a warning (severity
   4, `XSITASKS` message id `0x436`, inferred: "cannot delete all cameras") is logged and the command ends with
   nothing deleted (internal code `0x562E80D2`, the command still returns success).
2. **Per item**: the item's object is fetched. Unless bit `0x10`: an object locked at level 1 that is not itself a
   reference root raises the lock error (`CSILockStatus::RaiseError`) and is **dropped**; other items continue.
   Items that do not expose the scene-object interface `6de1b670-8072-11d5-aeed-0090275802c9` are silently
   dropped (inferred: not deletable scene objects, e.g. raw parameters).
3. **Referenced models**: an item that is a model (`3ded5562-…`) whose model check (slot 0xa8) and reference-model
   check (`851df6a6-…`, slot 0x20) are both true is marked (item slot 0x40 set to 1, inferred: "delete whole
   branch") and remembered; after filtering, each such model gets reference-model slot 0x148 (inferred: drop its
   loaded reference / delta before deletion).
4. **Report** (`0x180013230`): when the kept count differs from the input count, the names of dropped items are
   joined with `,`. Nothing kept: error `0x80070057` with message id `0x13a` and that list (command fails).
   Some kept: warning (severity 4) with message id `0x13a` and the list; the rest is deleted.
5. Empty result: nothing happens (`0x562E80D2`).

What a model / hierarchy / property / operator / cluster **deletes** is decided by `C3DDeleteSelectedTraverser`
(constructed with the filtered list and the mode, then `Execute(undo flag)`) in **`corehelper.dll`**; not readable
in this session. `tasks.dll` contains no layer- or pass-specific test, so "last layer / last pass" protection, if
any, is in that traverser (open).

Pre-delete sub-tasks: the traverser returns its affected list (kind `0xd`); `0x180013630` reads the selection
manager (`a003cac3-e4f3-11d1-84c6-00aa00135f7b`, lists `a003cac1-…` = selection and `a003cac2-…` = active
elements). When either is non-empty, it partitions the affected items (type 2 entries; owner flags `4` and `8`)
into:
- `0x18009db48` = `38eddd02-d255-11d2-8bcf-00aa006130ef` = the **Remove From Selection** task class: run on the
  deleted items that are selected.
- `0x18009db58` = `9dcec2b3-d336-11d2-8bcf-00aa006130ef` = the **Deactivate Elements** task class: run on the
  deleted components that are in the active-elements list.
Both run before the traverser, each with (list, 0, undo flag), and are queued as undo sub-tasks when they report
work. So deleting an object first removes it from the selection / active elements, undoably.

Undo (`0x1800134c0`): requires the stored traverser (else `0x80004003`); with a global "undoing" flag set it calls
the traverser's Undo, re-registers the stored input objects in the namespace (`SIAddObjectListToNameSpace`),
undoes the sub-tasks; all inside `SI3D_SCENE_INVALID_BEGIN` / `_END`. Redo (`0x180013470`): clears sub-tasks and
re-runs the worker with the stored list, mode and undo flag.

### Q18. DeleteObj with null InputObj — **partly**

The handler has **no** selection fallback: UnPackArg reads `InputObj` as a list; a null list makes the worker
return immediately (nothing deleted, success). `InputObj` is declared with argument handler
`7834cb8c-5252-11d2-a5cc-00a0c91412de` (Collection, flags `0x10002`), and an unspecified collection argument is
filled from the current selection by that handler (inferred, consistent with CMD-B16d and the SDK). So
`DeleteObj()` = delete the selection (inferred); `DeleteObj(<empty list>)` = no-op. The separate "Delete Selected"
row (`6561fca0-…`, script `uixsiscripts.vbs` / `DeleteObjProc`) was not read.

### Q19. CopyPaste service slot 12 and operations 2 / 4 / 8 — **partly**

The service is the process-wide generic object `8689f1d1-71a5-11d1-b6fd-00aa003b3ea6` (the same object CMD-B8c
calls the animation clipboard) queried with interface `8399d6f0-8571-11d3-b4a2-00a02485cecb`; its implementation
is **not in `tasks.dll`** (hosting DLL not identified this session). Slot 12 returns (allowed-operations mask,
default operation, flags, "source is the target / no copy" byte); the per-kind table lives in that service (open).
What `tasks.dll` establishes:
- Mode 1 -> operation **8**, Mode 2 -> **4**, Mode 3 -> **2**, Mode 0 -> service default; an operation not in the
  allowed mask is replaced by the default.
- **8 = move (cut-paste)**: after the paste, when flag bit 2 is set and nothing failed, a **`DeleteObj` sub-task**
  (class `dd531990-ccc2-11d2-ac73-00a02485cecb`, mode `0x400`) deletes the original source; queued for undo.
- **4 = copy**: when flag bit 1 is set, the source is duplicated first (`0x180058120`) and the duplicate is pasted;
  after the paste (unless the "no copy" byte is set) a **`FreezeObj` sub-task** (class
  `761b65c4-2f0a-11d3-9196-00a0243e34c4`) freezes the pasted object at the current time (so the copy does not share
  the source's operator stack). Operation 8 with flag bit 2 also duplicates + freezes.
- **2** = the remaining mode: the source itself is handed to the paste without duplication (inferred:
  "reference / connect / instance paste").
- Paste steps on the service: slot 11, slot 13 (result), then with undo slot 10 to collect created objects (a
  single created object is kept for undo), slot 11 again.

### Q20. RunPerformanceTest text formats — **answered**

Report appended to `FileName`, in order:
1. `"\n\n==========\n"`, `TEST <Type>: [<label>]`, `   Date    : <asctime(localtime)>` (asctime ends in `\n`),
   `   Duration: >= <Duration %.1f> sec`.
2. `DumpSystemInfo` text (from `sigeneral.dll`, written as-is with `%s`; its content is not in this DLL).
3. Scene block (`0x18003e600`): `\nXSI SCENE INFO:\n`, `   Scene: '<name>'\n`, `   Path : <path>\n` (name from the
   scene's full name, path from the 3D content container; inferred which is which). Written only when both lookups
   succeed.
4. Views block (`0x18003e0f0`, field mapping inferred from its format strings): `\nGL version: `,
   `\nGL vendor: `, `\nGL renderer: ` lines; `   <n> Active OGL view(s)\n`; per view
   `      Active view: <letter> [<index>] (<w>x<h>) ` followed by ` %9s: '%s' (%s %s)\n` (camera kind one of
   `VIEWPOINT`, `MONITOR`, `SCENE`, `SPOTLIGHT`, `Unknown`; camera name; display mode one of `WIREFRAME`, `SHADE`,
   `SURFACE_LINES`, `TEXTURE`, `BBOX`, `HIDDEN_LINE`, `CONSTANT`, `AUTO`, `TEXTURE DECAL`, `REALTIME SHADERS`;
   quality one of `FULL`, `COARSE`, `MEDIUM`) and
   `         FrustumCull: %d, XRayShade: %d, TranspShade: %d\n`. Views = the viewer controller's active views
   that have a 3D view object; if the views list fails, no test is run.
5. Progress bar `TEST <Type> [<label>] running for <Duration %.1f> seconds...` (not written to the file).
6. **No per-frame output.** Playback test (Types 0/2): reads the timeline In/Out frames (rounded down after an
   epsilon), then repeatedly plays In..Out: per frame set play time, viewer controller set-time + redraw, pump
   Windows messages; elapsed time checked every 16 frames and at the end of each pass; stops once elapsed >=
   Duration; restores the original time. Drawing test (Types 1/3): redraws the views in batches of 16 without
   changing time until elapsed >= Duration. Instrumented types (0/1) switch on per-view statistics first.
7. Results block (`0x18003e850`): `\nRESULTS:\n`, `   Time elapsed to draw <n> frames: <s %.2f> seconds.\n`,
   `   Average of <fps %.1f> frames/second or <ms %.1f>ms per refresh.\n`; instrumented: per view
   `      View <letter> [<index>]: TotalDraw <%5.1f>ms`, the `Trav` line with `PropUpd / PrimUpd / Draw / Other`,
   `CtxtSwitch`, `Other`, then totals (`Total in 3D views`, `Total in view traversal`, `Total updating
   properties`, `Total updating primitives`, `Total drawing time (incl. tessel.)`, `Other view traversal`,
   `Total context switching`, `Other 3D view (setup, etc)`, `Non-3D-view overhead`; ms = seconds x 1000.0).
   Not instrumented: `   Instrumentation data was not requested.\n\n` and three lines inviting comparison of
   instrumented vs non-instrumented time-per-frame.
8. Playback + instrumented only: a `NOTES:` paragraph (9 lines) explaining instrumentation overhead and that the
   first view of a display type includes tessellation time.

Duration: **no clamp**. Duration <= 0 runs zero frames and still writes the results with 0 frames (fps value is
then a division by zero, inferred `inf`/`nan` text). Worker returns S_FALSE.

### Q21. Undo manager slot 11 — **partly**

The manager (`b8482532-4ad5-11cf-86ad-00aa006297d6`) is not implemented in `tasks.dll`. From `tasks.dll`:
`BeginUndo` / `EndUndo` call open / close only when slot 11 returns 0; otherwise the call is **dropped, not queued**
(no retry, no stored request). Whether empty groups are recorded and how nested groups combine is manager
behaviour (open; inferred: nested groups fold into the outermost, empty groups are discarded).

### Q22. Undo / Redo with Repetitions 0 or negative — **answered**

`Repetitions` is VT_UI4, compared unsigned. 0: the loop runs zero times, the sum (0) equals Repetitions, so the
argument is not rewritten; nothing is undone; returns S_FALSE. A negative script value is converted to VT_UI4 by
the argument layer before the handler sees it (inferred: an overflow conversion error, so the command fails
without undoing; if the layer wraps instead, 4294967295 steps would be attempted, each a no-op once the stack is
empty). No clamp in the handler.

### Q23. Add3DObjectToScene — **answered**

- Lock test: `CSILockStatus::IsLocked(level 1)` on Parent. Locked and (not a reference, or locked inside a
  referenced model) -> error `0x80070005`, message id `0x57` with the parent's path, nothing done. Locked
  referenced-model root: kept as parent only when the first input object has a specific owner property state
  (`0x1800b7860` check); otherwise the parent is dropped and the current scene model is used.
- Lock checks are suspended at level 2 during the operation.
- **Expansion (`0x18002f290`): only objects that have no parent are kept. An object already under another parent
  is skipped, not moved.**
- Each kept object: Parent.AddChild. Objects missing the **Visibility** property (`11ebe302-…` query) are
  collected; objects with a particle-cloud sub-object (`feb7cba4-…`, inferred) missing **ParticleDisplay**
  (`b5a4bd9e-…` query) are collected separately.
- Containers: `0x18009d898` = `11ebe301-a20c-11d0-8478-00a024c7919c` = **Visibility** property
  (`C3DVisibilityAndDisplay.spdl`); `0x18009d8d8` = `83b04845-8e86-4c6c-8196-a6baa4a657df` = **ParticleDisplay**
  property (`C3DParticleDisplayProp.spdl`). The sub-task class `0x18009c248` = `6fa26e30-…` is **`SIAddProp`**,
  run with propagation mode 2; queued for undo.
- `C3DAddToContainersTask` runs only when called as a sub-task (argument 5 non-zero), not from the command.
- Final sub-task `0x18009c1f8` = `03ef9f91-6ad8-11d3-8bbd-00a024ee586f` (not in the registry; only use in this
  DLL): at the current time the parent's kinematics (`783879e2-…` / `d557cf36-…`) are read for transforms 1 and 2
  (inferred local / global) after a forced scene update, then the task runs on (objects, parent) with kind
  `77f74c81-7010-11d1-96f5-00a0243e3463` (inferred: re-evaluates / compensates the children's kinematics under
  the new parent). With undo, the object list and a reference to the parent are stored.
- Undo (`0x18002ed70`): for each added object: dispose it from the scene and Parent.RemoveChild, then undo
  sub-tasks; not recorded -> `0x8000FFFF`. Redo (`0x18002ea40`): re-adds each child to the parent, re-applies
  kinematics, redoes sub-tasks.

### Q24. SetReference2 type switch and sub-task — **answered**

The port's shader reference filter type (`F3DGetShaderDataTypeFromRef`, `siShaderReferenceFilterType`) selects the
class the Value must satisfy (1..7; other values = no filtering):

| # | filter | class checked | how |
|---|---|---|---|
| 1 | Object | X3DObject `0x18009bcf8` | Value itself |
| 2 | Camera | camera primitive `1152e9b0-…` | primitive of Value |
| 3 | Light | light primitive `e9f25e60-…` | primitive of Value |
| 4 | Material | `fb607cd0-5207-11d0-854e-00a02417d029` (inferred material) | Value itself |
| 5 | Shader | `ab9c2622-230d-11d2-8ed2-00a0248f947c` (shader) | Value itself |
| 6 | Geometry | `6297c9b0-003a-11d0-81f4-0020af9d8e2d` (inferred geometry primitive) | primitive of Value |
| 7 | UserDataBlob | `6ce63dda-d71c-4807-8641-e851c478ccfd` (inferred) | Value itself |

If the Value does not satisfy its filter, it is **replaced by null** (the port is then just disconnected, no
error). Before that, a Value that is a sub-object (`0x18009d708`) is replaced by its owning 3D object
(category `8b0ea318-…` = `C3DObject`), and a Value equal to the port's own owner is dropped (no self reference).

Sub-task `0x18009bd58` = `d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b` (modeltasks.dll, the reference-model delta
recording task, see CMD-B8a / B15a): run (slot 12, flag `0x100`) when the port resolution says the owner lives in a
referenced model, queued for undo. Undo / Redo (`0x180025fe0` / `0x180025f90`): undo/redo sub-tasks, then re-run
the worker on the stored port with the previous / new value (no undo recording).

### Q25. DelayedRefresh with Time unset — **answered**

The handler reads `Time` as a double and fails only if the read fails. `Time` uses the time argument handler
`e9bae81a-9d13-11d3-8107-00a0c9ac19a9`, which supplies the current time for an unspecified value (inferred, as in
CMD-B8a). So `DelayedRefresh()` = set the viewer controller to the current time (no change) and queue a refresh.

## 3. Wire contract deltas

### `DeleteObj`: SPEC-PARTIAL
`DeleteObj(InputObj)`: unspecified InputObj = selection (argument handler, inferred); empty list = no-op. Drops
locked (non reference-root) items with the lock error, drops non-scene items; if nothing remains -> fail
`E_INVALIDARG` (message `0x13a`, names joined by `,`), else warn with the dropped names. If the deletion would
remove every non-locked scene camera -> warning `0x436`, nothing deleted. Before deleting: Remove From Selection on
deleted selected items, Deactivate Elements on deleted active components (both undoable). Fires
`SI3D_SCENE_INVALID_BEGIN/END`. Undoable. **Blocker**: per-kind deletion rules (`corehelper.dll`
`C3DDeleteSelectedTraverser`).

### `CopyPaste`: SPEC
`CopyPaste(Source | FileName, Target, Mode=0)`: validation as CMD-B16c. Mode 0 = service default; 1 = **move**
(paste, then DeleteObj the source); 2 = **copy** (duplicate the source, paste the duplicate, FreezeObj it);
3 = paste the source itself (inferred: reference/connect). Requested mode not allowed for that source/target ->
default (in a reimplementation: allow all three, inferred). Undoable.

### `RunPerformanceTest`: SPEC
Report layout of section 2 Q20; no per-frame lines; no Duration clamp; playback test loops In..Out; drawing test
redraws without changing time; returns nothing.

### `Add3DObjectToScene`: SPEC
`Add3DObjectToScene(InputObjs, Parent=current scene model)`: locked parent -> `0x80070005` (msg `0x57`); only
unparented objects are added (already-parented ones skipped); each gets a Visibility property if missing and
particle clouds a ParticleDisplay property (SIAddProp, mode 2); kinematics re-evaluated under the parent at the
current time. Undo removes the children; Redo re-adds.

### `SetReference2`: SPEC
`SetReference2(Target, Value, Time)`: Value coerced to its owning 3D object, then checked against the port's
reference filter (table above); mismatch or self reference = null (disconnect). Existing connections removed,
Value connected (flags `0x4080`); referenced-model owners get a delta task. Undoable.

## 4. Corrections for the wire agent

1. `CopyPaste`: Mode 1 must delete the source after pasting (move), Mode 2 must duplicate then freeze the copy;
   Mode 3 pastes the source itself.
2. `Add3DObjectToScene`: skip input objects that already have a parent (do not reparent them); add a Visibility
   property to objects lacking one.
3. `SetReference2`: a Value of the wrong class for the port filter (object/camera/light/material/shader/geometry/
   userdatablob) silently disconnects instead of connecting; a Value equal to the port owner disconnects.
4. `DeleteObj`: refuse (warning, nothing deleted) when every non-locked scene camera would be deleted; remove
   deleted objects from the selection first (undoable); partial failures warn with the dropped names.
5. `RunPerformanceTest`: report layout per Q20; no Duration clamp.
6. `Undo`/`Redo(Repetitions=0)`: do nothing and leave Repetitions at 0.

## 5. Open questions

1. `corehelper.dll` `C3DDeleteSelectedTraverser`: per-kind deletion rules (model / hierarchy / property / operator /
   cluster), and whether the last layer / pass is protected.
2. Clipboard service `8689f1d1-…`: hosting DLL and the slot 12 allowed-mask / default table.
3. Undo manager `b8482532-…`: empty groups, nested group merging.
4. Final Add3DObjectToScene task `03ef9f91-…`: exact role (host DLL unknown).
5. `XSITASKS` message texts for ids `0x436`, `0x13a`, `0x57`.
