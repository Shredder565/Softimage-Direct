# CMD-B16c: undo group / undo-redo rows of the shared `b5097d5a` handler, refresh and drop-message tasks, performance test, `SetReference2`, `Add3DObjectToScene`, `CopyPaste` and the `DeleteObj` handler (with `DeleteCurrentLayer` / `DeleteCurrentPass`), read from `tasks.dll`

Row: **CMD-B16c**. Status: **SPEC** (10 names), **SPEC-PARTIAL** (5 names); per command below.
Run: 2026-11-20, si-analyst worker, unattended, batch 16 (binary first, REA + Ghidra 12.1.4 on the PC).
No XSIBATCH golden: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\tasks.dll`, image base `0x180000000`,
sha256 `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914` (same build as CMD-B11a..d).

Method: (1) the shared `b5097d5a` dispatch table (`0x1800e3180`, layout in CMD-B11b section 1.1) was read as raw
data and the GUID pointer of each row resolved, then the per-row `run` functions decompiled. (2) For the seven
other handler CLSIDs, `DllGetClassObject` (`0x180009700`..`0x18000caf7`) was checked directly: it compares each
CLSID as **two 64-bit loads from an `.rdata` GUID** (`mov rax,[guid]; cmp rax,[rclsid]; mov rax,[guid+8]; cmp
rax,[rclsid+8]`), so the first 8 bytes of each CLSID were searched, the `.rdata` copy found, and its three
references resolved: one inside `DllGetClassObject` (served), the other two in `DllRegisterServer`
(`0x18000cb00`) / `DllUnregisterServer`. The factory vtable was read from the `lea` that follows each compare
(decoded locally from raw bytes), factory slot 6 decompiled for the constructor, task vtable slots 5..9 read, and
Do / UnPackArg / worker methods decompiled (about 30 functions). All seven CLSIDs **are served by `tasks.dll`**.
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Task layout for all seven: `C3DCoreBaseTask` at 0, `CDSCOMObject` at `+0x20`, worker sub-object at `+0x38`
(layout (a) of CMD-B11b). Task vtable slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg. `0x18000e460` = shared
Undo/Redo stub (not undoable), `0x18008ccfa` = imported default RePackArg.

| Command(s) | Handler CLSID | compare in DllGetClassObject | Factory vtable -> slot 6 -> constructor (size) | Task vtable | Do | UnPackArg | Undo / Redo | Worker |
|---|---|---|---|---|---|---|---|---|
| `SetReference2` | `de9980e7-3d8e-41fd-9fea-ed65f79a6d62` | `0x180009801` | `0x1800a10e0` -> `0x180009200` -> `0x180024fe0` (0x140) | `0x1800a7c00` | `0x180025f50` -> worker slot 9 | `0x1800261d0` | `0x180025fe0` / `0x180025f90` | `0x180025630` (vtable `0x1800a7cc0`) |
| `DeleteObj` (`999ec43a-…`, `2d5d874c-…`), `DeleteCurrentLayer`, `DeleteCurrentPass` | `dd531990-ccc2-11d2-ac73-00a02485cecb` | `0x180009f3f` | `0x1800a1348` -> `0x180007b20` -> `0x1800125a0` (0x78) | `0x1800a53f0` | `0x180013450` (no Ghidra function; jumps to worker slot 9) | `0x180013e90` | `0x1800134c0` / `0x180013470` | `0x180012a40` (vtable `0x1800a54b0`) |
| `DelayedRefresh` | `c57f98e2-6a92-4328-b7c1-692aed6b130a` | `0x18000a97d` | `0x1800a1770` -> `0x180007aa0` -> `0x18003d990` (0x50) | `0x1800ac170` | `0x18003dbf0` | `0x18003dea0` | stub | - |
| `SetDropMessage` | `e0a73360-723e-4ec6-9b76-d27aa77c7eb7` | `0x18000a9ef` | `0x1800a17a8` -> `0x180009140` -> `0x1800493e0` (0x58) | `0x1800ae120` | `0x180049560` | `0x180049630` | stub | - |
| `CopyPaste` | `2c8a5f31-8556-11d3-b4a2-00a02485cecb` | `0x18000ac47` | `0x1800a1b98` -> `0x1800076e0` -> `0x180057aa0` (0x138) | `0x1800afd50` | `0x180058e40` -> worker slot 9 | `0x180059720` | `0x180059120` / `0x180058e70` | `0x1800588c0` (vtable `0x1800afe10`) |
| `Add3DObjectToScene` | `a0d59008-3e15-11d3-8bac-00a024ee586f` | `0x18000aef3` | `0x1800a1cb0` -> `0x180007520` -> `0x18002d5d0` (0xa8) | `0x1800a8b00` | `0x18002ea20` -> worker slot 9 (`0x18002e7f0`) -> task slot 15 `0x18002da30` | `0x18002f210` | `0x18002ed70` / `0x18002ea40` | task slot 15 |
| `RunPerformanceTest` | `0ed17cf6-d6a3-4b06-ba4d-9be4b7924df9` | `0x18000b4c7` | `0x1800a29a0` -> `0x180008ca0` -> `0x18003df10` (0x68) | `0x1800ac3a0` | `0x18003f3c0` -> worker slot 9 | `0x18003fca0` | stub | `0x18003ef80` (vtable `0x1800ac460`); RePackArg `0x18007dc50` (shared) |
| `BeginUndo`, `EndUndo`, `Undo`, `Redo`, `RefreshCustomPreferences`, `ResetDirectX` | `b5097d5a-0331-42fb-bf47-e87677da16a8` | (CMD-B11b) | dispatcher `0x18000e490` | - | rows below | - | - | - |

### 1.1 The remaining rows of the `b5097d5a` dispatch table

Completes the table of CMD-B11b section 1.1 (rows 6..10 and 14; the row layout, dispatcher and return codes are
specified there: a row's `run` returning success makes the command return S_FALSE).

| # | run | command GUID (row pointer) | command |
|---|---|---|---|
| 6 | `0x180054dc0` | `7a788d9c-4c5d-4b52-84a3-461ff92f0661` (`0x18009c698`) | `BeginUndo` |
| 7 | `0x180054f70` | `93dfc8aa-3fca-475d-9973-da18522450b4` (`0x18009c6a8`) | `EndUndo` |
| 8 | `0x180055630` | `c2697310-5813-11cf-ba09-00aa004a7916` (`0x18009daf8`) | `Undo` |
| 9 | `0x1800553f0` | `c2697311-5813-11cf-ba09-00aa004a7916` (`0x18009db18`) | `Redo` |
| 10 | `0x180055520` | `9fd0700f-4250-43c5-8406-02b630995e37` (`0x18009c718`) | `RefreshCustomPreferences` |
| 14 | `0x1800555d0` | `ccf5c2aa-8c30-4c74-a799-0e7e74132fd5` (`0x18009c708`) | `ResetDirectX` |

## 2. Shared facts

- **Undo manager**: rows 6..9 get it with `DSQueryGenericObject(class b8482532-4ad5-11cf-86ad-00aa006297d6,
  interface b8482530-4ad5-11cf-86ad-00aa006297d6)`. Methods used: slot 9 open group (name, 0), slot 10 close group,
  slot 11 state query (0 = groups may be opened/closed; inferred: "not currently undoing/redoing"), slot 14 undo one
  step (out: count, out: allocated name buffer), slot 15 redo one step (same outputs). A missing manager is not an
  error (the rows still return S_FALSE).
- Exec-context slot `0xb0` receives the undone/redone entry name when `Repetitions` is 1 (inferred: it becomes
  the command's log label, e.g. "Undo <name>").
- `0x562E80C7` is the Softimage "success with information" code; UnPackArg helpers keep it over plain S_OK.
- Time arguments (`DelayedRefresh`, `SetReference2`) are read as doubles in **frames** and converted with
  `SIFramesToSeconds`.
- The service at GUID pointer `0x18009d318` (queried with interfaces `0x18009c388` and `0x18009d328`) is used by
  both `SetDropMessage` and `CopyPaste` (inferred: the clipboard / drag-and-drop service of the 3D views).

## 3. Contracts

### `BeginUndo`: SPEC

Args: `Name` (string, default ""). Reads `Name`; an empty name becomes the literal `"No-name operation"`.
If the undo manager exists and its state query returns 0, opens an undo group with that name (second arg 0).
Otherwise nothing. Always returns S_FALSE once `Name` was read; failure to read `Name` is returned.
**Wire contract:** `BeginUndo(Name="")` opens a named undo group (label "No-name operation" when empty); no error
when groups cannot be opened (silently ignored); not itself undoable.

### `EndUndo`: SPEC

No args. If the undo manager exists and its state query returns 0, closes the current group. No check that a
group is open, no error. Returns S_FALSE.
**Wire contract:** `EndUndo()` closes the innermost open undo group; with none open it is a silent no-op.

### `Undo`: SPEC

Args: `Repetitions` (VT_UI4, default 1). Calls the manager's undo-one-step `Repetitions` times (the loop does not
stop early when nothing is left), summing the reported counts. When `Repetitions` is 1, the entry name returned by
that single step is passed to the exec context (log label, inferred). When the summed count differs from
`Repetitions`, the `Repetitions` argument is **written back** with the count actually undone. Returns S_FALSE;
an argument read/write failure is returned. No manager -> S_FALSE, nothing done.
**Wire contract:** `Undo(Repetitions=1)` undoes up to N steps; afterwards `Repetitions` holds the number actually
undone (when fewer); not itself undoable.

### `Redo`: SPEC

Same as `Undo` with redo-one-step; the name passed for the log label is the one from the last step, only when
`Repetitions` is 1.
**Wire contract:** `Redo(Repetitions=1)` redoes up to N steps; `Repetitions` is rewritten with the actual count.

### `RefreshCustomPreferences`: SPEC

No args. Gets the 3D content container (`SIGet3DContentContainer`, GUID pointer `0x18009e058`, flag 1), asks it
(slot 16) for the object identified by `394ea0e9-78a1-4b48-a09f-a0f81a68ae5b` / interface
`a5b395a8-b4a9-4f1b-9630-cf1ce3c1ffcc` and, when found, calls its slot 4 (inferred: "reload / refresh the custom
preference set"). Failures of the container lookup are returned; otherwise S_FALSE.
**Wire contract:** `RefreshCustomPreferences()` re-reads the custom preferences (no args, no return, not undoable).

### `ResetDirectX`: SPEC

No args. Gets the generic object class `4c0796d4-3158-4878-9e58-34bfd0608393` / interface
`26ea2b10-9ef5-4e65-9705-5fa6d0cdda33` and calls its slot 115 (inferred: the display driver's device reset). No
object -> nothing. Always S_FALSE.
**Wire contract:** `ResetDirectX()` resets the viewport graphics device; in a WebGL build a view redraw is the
equivalent (no args, not undoable).

### `SetDropMessage`: SPEC

Args: `Message` (string, default ""). UnPackArg reads the raw variant; only a non-null VT_BSTR is stored, any other
type leaves the stored message empty; never fails. Do: queries the service at `0x18009d318`, QI `0x18009c388`, and
calls its slot 7 with the message. Query failure is returned; a missing interface is ignored. Not undoable, no
return value.
**Wire contract:** `SetDropMessage(Message)` sets the text of the drag-and-drop service (inferred: the message
shown while dropping onto a view); non-string Message = empty.

### `DelayedRefresh`: SPEC

Args: `Time` (frames, double; argument handler `e9bae81a-…`). UnPackArg reads `Time` (failure returned) and
converts to seconds. Do: gets the viewer controller (`SIGetViewerControler`, interface pointer `0x18009c9d8`);
builds a time value in the scene's current time format (`SIGetTimeFormat`) with those seconds; calls the
controller's slot 9 with it (set time), then slot 15 with (0, 1) (inferred: refresh all views, deferred). Each
failure is returned. Not undoable.
**Wire contract:** `DelayedRefresh(Time)` moves the viewer controller to `Time` and queues a refresh of the views.

### `RunPerformanceTest`: SPEC-PARTIAL

Args: `Type` (VT_I4, default 0), `FileName` (string, file argument handler), `Duration` (double, default 5.0).
UnPackArg: null context -> `0x80004003`; reads the three, first failure returned.
Do -> worker slot 9 (Type, FileName, Duration):
1. Creates two helper objects (classes at `0x18009db78` and `0x18009c978`), the second initialised (slot 5) and
   given to the first (slot 9); failure of the first creation is returned.
2. Opens `FileName` for **append** (`"a"`). If it cannot be opened nothing else happens (S_FALSE).
3. Writes `"\n\n==========\n"`, then `TEST <Type>: [<label>]`, `   Date    : <asctime>`,
   `   Duration: >= <Duration %.1f> sec`, then a system-information block (`CSIStatManager::DumpSystemInfo`)
   and a scene block (`0x18003e600`, not decoded).
   Type labels: 0 `PLAYBACK (incl. UPDATE) performance`; 1 `DRAWING performance`; 2 `PLAYBACK (incl. UPDATE)
   performance -- NO INSTRUMENTATION`; 3 `DRAWING performance -- NO INSTRUMENTATION`; other `unknown` (header
   only, no test is run).
4. Gets the viewer controller, collects the views (`0x18003ecc0`) and writes them (`0x18003e0f0`); then shows a
   progress bar `TEST <Type> [<label>] running for <Duration> seconds...` and runs the playback test
   (`0x18003f670`, types 0/2) or the drawing test (`0x18003f4f0`, types 1/3), instrumented for 0/1.
5. Closes the file; returns S_FALSE.
- **Missing:** the body of the playback / drawing loops and what they write per frame (`0x18003f670`,
  `0x18003f4f0`), the scene block `0x18003e600`, and the shared RePackArg `0x18007dc50`.
**Wire contract:** `RunPerformanceTest(Type=0, FileName, Duration=5.0)` appends a text report to FileName
(header as above) and runs a playback (0/2) or drawing (1/3) benchmark for at least Duration seconds; no file =
no test.

### `DeleteObj` (handler `dd531990`): SPEC-PARTIAL

The `DeleteObj` name has three registry rows; `999ec43a-…` and `2d5d874c-…` use this handler, the
`6561fca0-…` row ("Delete Selected") uses `5c0cf8b6-…` (not read here). Other DLLs use this class as a sub-task
(slot 9 with a list and flags `0x10`, CMD-B9b/B9c/B9f/B11f).
- UnPackArg: `InputObj` as a list (interface `0x18009dfa8`); failure returned. No other argument.
- Do: worker slot 9 with (list, mode **0**, undo flag from the caller).
- Worker (`0x180012a40`), observable order:
  1. Null list -> returns immediately. Holds a scene-graph update bracket for the whole operation.
  2. Expands / validates the list (`0x180013ec0`); a failure or the code `0x562E80D2` (inferred: "nothing to
     delete") ends the command with nothing changed.
  3. Sends `SI3D_SCENE_INVALID_BEGIN`.
  4. Mode 8: deletes everything in the list with the "delete all" traverser. Other modes: builds a
     "delete selected" traverser for the list and mode; copies stored user data into it; asks it for the list of
     affected items (kind `0xd`); when undo is recorded keeps a soft reference to the input list (and the mode).
     When that list is not empty it is split (`0x180013630`) and sub-tasks of classes `0x18009db48` and
     `0x18009db58` (each called at slot 9 with a list, 0 and the undo flag) are run first and queued for undo when
     they report work. Then the traverser executes.
  5. Sends `SI3D_SCENE_INVALID_END` (also on every failure path after step 3).
- Undo / Redo (`0x1800134c0` / `0x180013470`) not decoded.
- **Missing:** the expansion rules of `0x180013ec0` (what a model / hierarchy / property in the list deletes),
  the identity of the two sub-task classes, and the Undo/Redo bodies.
**Wire contract:** `DeleteObj(InputObj)` deletes every object in the list (scene-invalid notifications around it),
undoable.

### `DeleteCurrentLayer`: SPEC (relative to `DeleteObj`)

Same handler and code as `DeleteObj`. The only difference is the registry default of `InputObj`:
`{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Layers.Current`, i.e. the list argument handler resolves the string to a
list containing the **current layer**; then the `DeleteObj` path above deletes it. No layer-specific code in the
handler.
**Wire contract:** `DeleteCurrentLayer(InputObj="Layers.Current")` = `DeleteObj` of the current layer (or of the
objects InputObj names); undoable like DeleteObj.

### `DeleteCurrentPass`: SPEC (relative to `DeleteObj`)

As `DeleteCurrentLayer` with default `{7834CB8C-…}:Passes.Current` (the **current pass**).
**Wire contract:** `DeleteCurrentPass(InputObj="Passes.Current")` = `DeleteObj` of the current pass; undoable.

### `CopyPaste`: SPEC-PARTIAL

Args: `Source` (object), `FileName` (string, default ""), `Target` (object), `Mode` (VT_UI4, default 0), hidden
`_Source` / `_Target` (VT_UNKNOWN).
- UnPackArg:
  1. `_Source`, when VT_UNKNOWN or VT_DISPATCH, is taken as the source; otherwise `Source` is read.
  2. Exactly one of {Source, non-empty FileName} must be given: neither -> `0x80070057`; both -> `0x8000FFFF`.
     With FileName the source is loaded from the file by the service at `0x18009d318` (QI `0x18009d328`, slot 15).
  3. `_Target` likewise, else `Target` (failure returned).
  4. `Mode` must be VT_UI4 and < 4, else `0x80070057`.
- Do -> worker slot 9 (source, target, mode, undo flag). Worker: needs both source and target (else returns
  nothing done); asks the service (slot 12) for the paste capabilities of source on target (allowed mask, default
  mode, flags, and a "same object" flag). Mode -> operation: 1 -> 8, 2 -> 4, 3 -> 2, 0 -> the service's default;
  an operation not in the allowed mask falls back to the default. For operation 4 (with flag bit 1) or 8 (with
  flag bit 2) on a parameter-like source, a copy of the source is made first (`0x180058120`). Then the service
  performs the paste (slots 11, 13, 10); with undo recorded a single resulting object is kept for undo. Afterwards
  (`0x180058680`, `0x180057f20`) the result is connected / the source removed for operation 8 (inferred: "move").
  Undoable (`0x180059120` / `0x180058e70`).
- **Missing:** the meaning of operations 2 / 4 / 8 (inferred: connect / copy / move) and the service slots'
  behaviour (the service lives outside `tasks.dll`).
**Wire contract:** `CopyPaste(Source | FileName, Target, Mode 0..3)` pastes Source (or the file's content) onto
Target without touching the user clipboard; Mode >= 4 -> E_INVALIDARG; both Source and FileName -> E_UNEXPECTED.

### `Add3DObjectToScene`: SPEC-PARTIAL

Args: `InputObjs` (list), `Parent` (X3DObject-like, interface `0x18009bcf8`). UnPackArg reads both; the first
failure is returned.
- Do -> worker slot 9 -> task slot 15 (`0x18002da30`) with (InputObjs, Parent, undo flag, 0):
  1. If Parent is locked: when it is not a referenced-model case, raises error `0x80070005` with message id `0x57`
     and the parent's path, nothing done. For a referenced model the parent is dropped (falls back to step 3).
  2. Suspends lock checks (level 2) and brackets a scene-graph update for the whole operation.
  3. Expands InputObjs (`0x18002f290`) into a new list. No Parent -> the current scene model
     (`SIGetCurrentSceneModel`).
  4. For each object: parent.AddChild (slot 8); then two queries on the object (GUIDs `0x18009d9c8`, `0x18009da08`)
     collect objects that need extra containers into two lists.
  5. Each non-empty list is passed to a sub-task (class `0x18009c248`, slot 10, with container GUIDs `0x18009d898`
     / `0x18009d8d8`, mode 2), queued for undo.
  6. A `C3DAddToContainersTask` is run on the list (when called as a sub-task, argument 5 non-zero), then a final
     sub-task (class `0x18009c1f8`) evaluates the objects at the current time (`SIGetCurrentTime`) before the
     scene update is forced; with undo recorded keeps the list and a reference to the parent.
- **Missing:** container GUID identities, `0x18002f290` expansion rule, the final sub-task's role, Undo/Redo.
**Wire contract:** `Add3DObjectToScene(InputObjs, Parent=current scene model)` parents the objects under Parent
and registers them in the scene containers; locked parent -> access-denied error; undoable.

### `SetReference2`: SPEC-PARTIAL

Args: `Target` (scene item `0x18009de88`), `Value` (object), `Time` (frames).
- UnPackArg: `Target` failure -> `0x80070057`; Target slot 0x200 fills a parameter reference (owner + port
  descriptor); `Value` optional (null allowed = clear); `Time` read, frames -> seconds.
- Do: marks the task "executed" and calls worker slot 9 (owner, port descriptor, value, time, undo flag).
- Worker (`0x180025630`): resolves the port on the owner (`0x180025440`); when Value is a shader-like object its
  primary owner of a category is found; a value equal to the current one is a no-op. On the first execution with
  undo, stores object references of the port, the previous connection and the new value (component kind
  `0x402`). Disconnects existing connections of the port, connects Value (flags `0x4080` on the new connection),
  and when needed runs a sub-task (class `0x18009bd58`, slot 12, flag `0x100`) queued for undo; finally
  `0x180026330` notifies.
- **Missing:** the 7-way type switch on the shader data type (jump table at `0x180025f34`), Undo/Redo bodies.
**Wire contract:** `SetReference2(Target, Value, Time)` connects Value as the reference of the Target port (null =
disconnect); undoable. Lives in `tasks.dll`, not `shadertasks.dll`.

## 4. Corrections for the wire agent

1. `Undo` / `Redo` (`src/commands/index.ts` 355-356): add `Repetitions` (default 1); perform up to N steps and
   return / write back the count actually done.
2. `EndUndo` (`src/commands/viewEditPropertyMore.ts`): with no open group it must be a silent no-op, not an error.
3. `BeginUndo`: an empty `Name` labels the group `"No-name operation"`.
4. `DeleteCurrentLayer` (`src/commands/inferredB15.ts` 165): run the `DeleteObj` path on the layer InputObj
   resolves to (default current layer), not `DeleteLayer`; keep InputObj default
   `{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Layers.Current`.
5. `DeleteCurrentPass` (`src/commands/moduleToolbar.ts` 290): delete the **current** pass via the `DeleteObj` path
   (it pops the last pass today) and add the `InputObj` argument (default `…:Passes.Current`).
6. `RunPerformanceTest` (`src/commands/inferredB10Views.ts` 394): Type 1/3 are drawing tests, 2/3 are
   "no instrumentation"; other Types write the header with `unknown` and run nothing; the report is **appended**
   to FileName with the header lines of section 3; without a usable FileName nothing runs.
7. `CopyPaste` (`src/commands/inferredB15.ts` 119): validate `Mode` (>= 4 -> E_INVALIDARG), Source/FileName
   exclusivity (none -> E_INVALIDARG, both -> E_UNEXPECTED), require Target; Mode 1/2/3 are distinct paste
   operations (8/4/2), not one duplicate behaviour (inferred: move / copy / connect).
8. `DelayedRefresh`: setting the time and refreshing goes through the viewer controller (current time format);
   the wire's behaviour is acceptable; mark it SPEC.
9. `SetDropMessage`, `ResetDirectX`, `RefreshCustomPreferences`: wiring is consistent with the binary; only drop
   the `inferred` markers. `SetDropMessage` ignores non-string Message.
10. `Add3DObjectToScene` / `SetReference2` comments (`modelTasksB15aShared.ts` 124, `shadertasksB12Shared.ts` 10):
    both tasks are in `tasks.dll`; `Add3DObjectToScene` default Parent = current scene model and a locked parent
    raises access denied (`0x80070005`, message `0x57`).

## 5. Open questions

1. `DeleteObj` list expansion (`0x180013ec0`) and the two pre-delete sub-task classes (`0x18009db48`,
   `0x18009db58`); the "Delete Selected" row `6561fca0-…` with handler `5c0cf8b6-…` was not read.
2. The undo manager's state query (slot 11) meaning; whether `BeginUndo` during an undo is dropped or queued.
3. `CopyPaste` operation codes 2 / 4 / 8 and the clipboard/drag service slots (service outside `tasks.dll`).
4. `RunPerformanceTest` measurement loops and per-frame report lines.
5. `SetReference2` shader data-type switch (7 cases).
