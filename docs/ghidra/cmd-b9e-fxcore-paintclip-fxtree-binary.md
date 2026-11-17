# CMD-B9e: FX Tree and paint clip commands read from `fxcore.dll` (paint clip save / revert / frame selection, CreateFxTree, DisconnectFxOp, RenderFxOp, SetFxOpPos, MakeWarperShapePair)

Row: **CMD-B9e**. Status: **SPEC** (12 names), **SPEC-PARTIAL** (3 names); per command below.
Run: 2026-11-17, `si-analyst` worker, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fxcore.dll`, image base `0x180000000`, sha256 `45985d1dfcfe90ba1b1f58dbdde77f4928f3a89526f849edf16a95af7434b41c`.
Method: Ghidra decompilation of 33 functions (task methods, workers, the paint clip
interface methods); local static reading (pefile + capstone) of `DllGetClassObject`, the
class factories, constructors, vtables and seven small thunks Ghidra has no function for.
Message texts come from `Application\Dictionary\en\XSIFXCORE.dict`. All statements are
behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

`DllGetClassObject` (`0x180002f90`) compares the requested CLSID inline (two 8-byte
compares against the CLSID constant). The class factory's slot 6 allocates and constructs
the task. In every task the `C3DCoreBaseTask` part sits at object offset `+0x18`; the
"task vtable" below is the one installed there (slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg,
9 RePackArg). The four FX Tree tasks also carry a small worker sub-object at task `+0x28`
whose slot 3 is the worker that Do / Undo / Redo call.

| Command(s) | Handler CLSID | Factory create -> constructor | Task vtable | Do / worker | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `SavePaintClip`, `SaveSelectedPaintClipFrames`, `RevertPaintClip`, `RevertPaintClipFrame`, `RevertSelectedPaintClipFrame`, `GotoSelectedPaintClipFrame`, `PrevModifiedPaintClipFrame`, `NextModifiedPaintClipFrame`, `SelectPaintClipFrames`, `ClearPaintClipFrameSelection` | `64a5ea2b-225f-45a6-a47e-af53bdb4e31b` (registered name `C3DFxPaintClipTask`) | `0x18005b180` -> `0x18005ae90` (factory object from `0x18005b0c0`) | `0x1800f7160` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | `0x18005b3e0` | both `0x18000f230` (return `0x80004005`) |
| `CreateFxTree` | `3d1b717e-162d-459b-b978-4183a9567141` (`C3DFxCreateFxTreeTask`) | `0x1800029d0` -> `0x1800782c0` | `0x18010bc80` | Do `0x1800786b0` -> worker `0x1800784c0` | none (stub `0x180005d30`); RePackArg `0x1800788b0` -> `0x180071d30` | Undo `0x180078710`; Redo `0x180078700` (re-runs Do) |
| `DisconnectFxOp` | `c8530d7d-aecc-4232-b272-c50455c05f8a` (`C3DFxDisconnectFxOpTask`) | `0x180002a50` -> `0x1800788d0` | `0x18010c4d0` | Do `0x180078ce0` -> worker `0x180078b40` | `0x180078f30` | Undo `0x180078d40`; Redo `0x180078d10` |
| `RenderFxOp` | `2031f707-f7d2-47a8-9155-6e453c727701` (`C3DFxRenderFxOpTask`) | `0x180002b90` -> `0x180079090` | `0x18010cd60` | Do `0x180079220` -> worker `0x180079310` | `0x180079960` | imported `C3DCoreBaseTask::UndoTasks` / `RedoTasks` |
| `SetFxOpPos` | `a07d815e-92a8-4076-b71b-f1202bcc7b01` (`CLSID_3DFxSetFxOpPosTask`) | `0x180002c50` -> `0x18007acc0` | `0x18010e850` | Do `0x18007aeb0` -> worker `0x18007b060` | `0x18007b2a0` | Undo `0x18007af10`; Redo `0x18007aee0` |
| `MakeWarperShapePair` | `f7be9196-958b-4f3d-a68e-90fe38e77b87` (`CISID_3DFxMakeWarpPairShapeTask`, spelled so in the DLL) | `0x18007f020` -> `0x18007e950` (factory object from `0x18007eb70`) | `0x180111420` | Do `0x18007f480` -> list driver `0x18007f2f0` -> per shape `0x18007f060` (helpers `0x18007ede0`, `0x18007ebf0`, `0x18007f5a0`) | `0x18007f970` | both `0x18007f4a0` (no-op, return 0) |

The JSON byte offsets of the CLSIDs (`0xdcd30`, `0xdc1a0`, `0xdc150`, `0xdc160`,
`0xdc250`, `0xdb230`) are the constants used by the inline compares and by the register /
unregister tables (`0x180003f10`, `0x180005240`).

## 2. Shared facts

### 2.1 Interfaces, classes and helper DLL

- Argument helpers come from `FxCoreHelper.dll`, namespace `fx_cmd`
  (`GetArgUnknownFromIdx`, `GetArgStringFromIdx`, `GetConnectionFromName`,
  `GetAsSafeArray`, `CreateListAddToList`, `AddToList`); image helpers from namespace
  `fx_img` (`CoCreateFxImage`, `CoCreateDSImage`). None of these was opened.
- "Image operator" interface asked of the `FxOp` / `Op` / `InputObj` argument (positional
  index 0): `473feb00-64ed-11d1-84c6-00a0243e3543`.
- FX operator node interface `ab7fc1ae-411c-4f7c-b460-2cb0cb99b9f1`; connection
  interface `7aa64ec7-27e1-4ffa-b5db-16fe50d9766f` (methods used: "is input N
  connected", "get source of input N" returning source object plus source output index,
  "connect input N", "disconnect input N").
- Operator class ids compared through the class-id interface
  `0000010c-0000-0000-c000-000000000046`:
  File Output operator `9acb71ff-0e3e-41cc-bb6b-d050b9dacd41` (`C3DFxFileOutOp`, SPDL
  property set `FileOutputOp`); the two operators accepted by `MakeWarperShapePair`:
  `6a87f95f-ca69-4898-9434-09bc0224fe69` and `bc0f7833-15b6-4ef4-8c22-ba7694c8b4e1`
  (not registered by `fxcore.dll`; the error text calls them "Warp or Morth operator").
- FX Tree object class `3f7f4afe-bc8b-4b98-9a16-771119ec3cd9` (registered name
  `C3DFxTreeObject`), created through interface `694e8500-1c07-11d5-b93e-0800690c8bd0`.
- 2D shape interface `af1c239d-292c-4d68-b0fb-91e5968a73e6`; shape correspondence
  class `a13ddc3a-c099-4d3b-b94e-f7cf20c416c5` (`C3DFxShapeCorr.spdl`).
- Undo data of the FX Tree tasks is kept as soft object references
  (`F3DCreateObjectReference` / `F3DResolveObjectReference`).
- Worker "first run" flag: Do forwards its second argument to the worker; Undo and the
  hand-written Redo functions pass 0 (CreateFxTree's Redo passes 1). When the flag is
  non-zero the worker records the undo data `(inferred: the task framework passes a
  non-zero flag on the first execution)`.

### 2.2 Paint clip interface (`48e47300-a4a7-4f7d-8956-d1317d0b4b19`)

Obtained from each object of the input list through the object's extension query
(`0x1800589a0`); the only implementation in `fxcore.dll` is the sub-object at offset
`+0x418` of the raster paint clip operator (vtable `0x1800f6750`; SPDL
`C3DFxFilePaintOp.spdl`, "Paint Clip Op" `(inferred from the neighbouring registration strings)`).
State it works on:

- a frame map (hash keyed by an integer frame key) holding, per painted frame, a cache
  buffer with the raster, a **modified** flag and a **selected** flag;
- a counter of modified frames; two further per-frame maps of cached buffers;
- the operator's name string and a start-frame offset used to turn a frame key into a
  file index.

| Slot | Function | Used by | Meaning |
|---|---|---|---|
| 5 | `0x1800573b0` | UnPackArg precheck | true when the modified-frame counter is greater than 0 |
| 6 | `0x1800573c0` | UnPackArg precheck | true when at least one frame in the map has the selected flag |
| 8 | `0x1800594f0` | SavePaintClip | save all modified frames |
| 9 | `0x1800595e0` | SaveSelectedPaintClipFrames | save the selected frames |
| 10 | `0x1800593f0` | RevertSelectedPaintClipFrame | revert each selected frame |
| 11 | `0x180059160` | RevertPaintClipFrame | revert one frame |
| 12 | `0x180059100` | RevertPaintClip | revert everything |
| 13, 14, 15 | `0x180005d30` | Goto / Prev / Next | stub: does nothing, returns 0 |
| 16 | `0x1800596d0` | SelectPaintClipFrames | replace the frame selection |
| 17 | `0x1800566b0` | ClearPaintClipFrameSelection | clear the frame selection |

Helpers: frame collector `0x180057070` (mode 0 = selected frames, mode 1 = modified
frames; returns false when the map is empty or nothing matches; result is sorted
`(inferred: 0x1800556c0 is the sort)`); file writer `0x18005a640`; UI refresh
`0x18005a570` (fires the operator's change notifications with ids `0x14` and `0xf`
inside a notification batch); "operator changed" notification with id `0x3e9` sent to the
operator's owner after save and revert; time-to-frame-key `0x1800485f0` and its inverse
`0x180048f60` (not opened).

### 2.3 Paint clip task: command selection and prechecks (UnPackArg `0x18005b3e0`)

One class serves ten commands. It asks the exec context (interface
`26444edd-799f-11d2-8733-00a0c906816c`) for the GUID of the running command:

| Command GUID | Command | Mode | Needs selected frame | Needs modified frame |
|---|---|---|---|---|
| `5bc48b24-a569-418b-bdb7-15b0893f15da` | SavePaintClip | 0 | no | no |
| `f81e7bd8-9c20-4f82-9cab-54c505b40ef3` | SaveSelectedPaintClipFrames | 1 | yes | no |
| `ae652ef7-6de9-4c71-8126-8f0c7aaf6ed2` | RevertSelectedPaintClipFrame | 2 | yes | yes |
| `53ddbb39-8bbb-42e5-8c16-84190d863e4a` | RevertPaintClipFrame | 3 | no | yes |
| `4643f77d-f037-42a0-8c8e-9b158aaff0a5` | RevertPaintClip | 4 | no | yes |
| `5b38957e-5887-4253-b683-9b177160c2f9` | GotoSelectedPaintClipFrame | 5 | yes | yes |
| `d7f1b7c4-0e79-441e-8f3b-66f828ccae0b` | PrevModifiedPaintClipFrame | 6 | yes | yes |
| `65ad238d-5e1b-4b85-bfbd-11767eec7c86` | NextModifiedPaintClipFrame | 7 | yes | yes |
| `eddfbc99-d86c-49d3-9de6-4e4628de4080` | SelectPaintClipFrames | 8 | no | yes |
| `20885277-f40a-43a3-8a20-bbf6f77b270f` | ClearPaintClipFrameSelection | 9 | no | yes |

Steps, in order:

1. Any other command GUID: return `0x80070057`.
2. Mode 3 reads `Time` by name as a double and truncates it to an integer; a failed read
   returns `0x80070057`.
3. Mode 8 reads argument index 1 (`Frames`) as a variant, converts it to a safe array,
   coerces every element to a 32-bit integer and stores the integers. A failure at any
   point returns `0x80070057`. An empty array is accepted.
4. The object list is read by name: first `InputObj`, and if that fails `PaintClip`
   (list interface `f49f6470-4211-11d0-8463-00a024c7919c`). Both failing, or an empty
   list: `0x80070057`.
5. Only the **first** object of the list is prechecked. No first object, or it does not
   expose the paint clip interface: `0x80070057` without a message.
6. If the command needs a selected frame and slot 6 answers false: error `0x80070057`,
   severity 2, message id `0x23` of catalogue `XSIFXCORE` ("No paint clip frames are
   selected").
7. Otherwise, if the command needs a modified frame and slot 5 answers false: error
   `0x80070057`, severity 2, message id `0x24` ("There are no modified frames").
8. Otherwise success.

Do (`0x18005b1c0`): walks the whole list; for every object exposing the paint clip
interface it calls the slot of the mode (mode 3 passes the truncated time, mode 8 passes
the integer array and its length). The value returned by the slot is discarded. Returns
`0x80070057` when no object of the list exposed the interface, otherwise 0. Nothing is
written back to the arguments. Undo and Redo return `0x80004005`: the commands are not
undoable.

### 2.4 Message catalogue ids seen (`DictLoadIdstring(L"XSIFXCORE", id)`)

`0x1f` "Unsupported Image Format"; `0x21` "Could not write to file %s"; `0x22` "Wrote
File %s"; `0x23` "No paint clip frames are selected"; `0x24` "There are no modified
frames"; `0x25` "%s : Can't Write Files, Output File Name is Not Set". Literal
(non-catalogue) strings: "Writing Paint Clip %s", "Rendering %s", "Rendering Images",
"Done", "Done Rendering Fx Op.  Total Render Time %f", "Last Frame %s   Average %s
Total %s   Estimated Left %s", "** Output File Name Not Set ***", "Argument must be an
image operator", "Argument 2 is not a valid connection name or number", "Argument 1 must
be a Warp or Morth operator", "Argument must be a FxTree object" (the last one is not
used by the commands of this note).

## 3. Contracts

### `SavePaintClip` / `SaveSelectedPaintClipFrames`: SPEC

- Arguments: `InputObj` (SavePaintClip) or `PaintClip` (SaveSelectedPaintClipFrames):
  object list; registry handler `7834cb8c-5252-11d2-a5cc-00a0c91412de`, and for
  `InputObj` the flags mark it as defaulting to the selection `(inferred from the
  registry flags; the handler is outside fxcore.dll)`. No return value.
- Prechecks: see 2.3. SavePaintClip has no frame precheck; SaveSelectedPaintClipFrames
  fails with message `0x23` when the first clip has no selected frame.
- Frame set: SavePaintClip takes every frame whose modified flag is set;
  SaveSelectedPaintClipFrames takes every frame whose selected flag is set. If the set is
  empty nothing happens for that clip.
- Writing (`0x18005a640`), per clip:
  1. Resolve the clip's output file name. If there is none: log, severity 1 (error),
     message `0x25` formatted with the operator name; stop for this clip.
  2. Find a file parser for the name (write capable). None: log severity 1, message
     `0x1f`; stop for this clip.
  3. Create the parser, open the file for writing, read the stream description, set the
     image format from the clip, open the image track. Any failure stops this clip.
  4. Show a progress bar titled "Writing Paint Clip <operator name>" sized to the frame
     count.
  5. For each frame key of the set, in ascending order: skip it unless the frame exists
     in the map **and** is modified (so SaveSelectedPaintClipFrames writes only the
     selected frames that are also modified). Fetch the raster, convert it to a DS
     image, and write it as image number `frame key - clip start offset`; the file name
     reported is the entry of the sequence file list with that same index.
     - Write succeeded: clear the frame's modified flag, decrement the modified counter,
       log severity 8 (info) message `0x22` with the file name.
     - Write failed: log severity 1 message `0x21` with the file name; a failing HRESULT
       ends the loop.
     - Advance the progress bar.
  6. Close the parser, end the progress bar, fire the UI refresh (2.2).
- After writing, the clip sends the "operator changed" notification `0x3e9`.
- Command result: 0 when at least one object was a paint clip (the writer's status is
  discarded), `0x80070057` otherwise. Not undoable.

### `RevertPaintClipFrame`: SPEC

- Arguments: `PaintClip` (object list), `Time` (frame, read as double, truncated to an
  integer; registry handler `e9bae81a-9d13-11d3-8107-00a0c9ac19a9`, which supplies the
  current frame when omitted `(inferred)`). No return value.
- Prechecks: 2.3; fails with message `0x24` when the first clip has no modified frame.
- Per clip: the time is mapped to a frame key (`0x1800485f0`). If the frame is in the
  frame map: when it was modified the modified counter is decremented and the UI refresh
  fires; its cache buffer and raster are freed; the entry is removed; notification
  `0x3e9` is sent. Independently, the cached buffers stored under the same key in the
  two secondary maps are freed and removed. The painted data of that frame is therefore
  discarded and the frame shows the source image again `(inferred for the visible
  effect)`. A frame that is not in the map is not an error.
- Result: 0 (or `0x80070057` when no list object is a paint clip). Not undoable.

### `RevertSelectedPaintClipFrame`: SPEC

- Argument: `PaintClip` (object list). No return value.
- Prechecks: 2.3; message `0x23` when nothing is selected, else message `0x24` when
  nothing is modified.
- Per clip: collect the selected frame keys; for each, convert the key back to a time
  (`0x180048f60`) and perform the `RevertPaintClipFrame` behaviour on it. With no
  selected frame the clip method reports `0x80004005`, which Do discards.
- The selection flags of the reverted frames disappear with their entries. Not undoable.

### `RevertPaintClip`: SPEC-PARTIAL

- Argument: `PaintClip` (object list). No return value.
- Prechecks: 2.3; message `0x24` when the first clip has no modified frame.
- Per clip: call the clip's "discard everything" routine (`0x180058c80`), fire the UI
  refresh, send notification `0x3e9`. Result 0. Not undoable.
- Missing: `0x180058c80` was not opened, so exactly which maps and counters it resets is
  not established (expected: all painted frames, the modified counter and the selection
  `(inferred)`).

### `SelectPaintClipFrames`: SPEC

- Arguments: `PaintClip` (object list), `Frames` (variant array; each element coerced to
  a 32-bit integer). No return value.
- Prechecks: 2.3; message `0x24` when the first clip has no modified frame. A `Frames`
  value that cannot be turned into an array: `0x80070057`.
- Per clip: first clear the existing frame selection (same as
  `ClearPaintClipFrameSelection`). If the array is empty, stop there. Otherwise map each
  value to a frame key (`0x1800485f0`) and set the selected flag of that frame **only if
  the frame exists in the frame map** (frames without paint data are silently ignored).
  Fire the UI refresh. Result 0. Not undoable.

### `ClearPaintClipFrameSelection`: SPEC

- Argument: `PaintClip` (object list). No return value.
- Prechecks: 2.3; message `0x24` when the first clip has no modified frame.
- Per clip: clear the selected flag of every frame; fire the UI refresh only when at
  least one flag was actually cleared. Result 0. Not undoable.

### `GotoSelectedPaintClipFrame` / `PrevModifiedPaintClipFrame` / `NextModifiedPaintClipFrame`: SPEC

- Argument: `PaintClip` (object list). No return value.
- Prechecks: 2.3; all three require a selected frame (message `0x23`) and then a
  modified frame (message `0x24`) on the first clip.
- Effect: none. The three interface slots these modes call (13, 14, 15) are the shared
  "return 0" stub in the only implementation shipped in `fxcore.dll`. The commands
  validate their argument, raise the two errors above when applicable, and otherwise
  succeed without changing the current frame or any state. Not undoable.

### `CreateFxTree`: SPEC

- Argument: `Value` (registry flags `512`: output only). It is not read: the task has no
  UnPackArg and Do always passes "no parent".
- Steps (worker `0x1800784c0`):
  1. Get the scene manager (`SIGetSceneManager`); failure is returned.
  2. Because no parent is given, take the active scene from the scene manager and its
     root object as parent.
  3. Ask the scene manager to create an object of class `C3DFxTreeObject`
     (`3f7f4afe-bc8b-4b98-9a16-771119ec3cd9`) under that parent. The name is left to the
     class default (SPDL property set name `FxTree`) `(inferred)`.
  4. On the first run, store a soft reference to the new object for Undo.
- RePackArg: writes the created object into the argument named `Value` as an object
  (variant type 13). So the script call returns the new FxTree object.
- Undo: resolve the soft reference, put the object in a list and delete it through the
  scene deletion helper (class `dd531990-ccc2-11d2-ac73-00a02485cecb`, call with option
  value `0x10`) `(inferred: the helper is not in fxcore.dll)`.
- Redo: runs Do again, i.e. creates a fresh FxTree object and records a new reference.
- Errors: any failing HRESULT from the scene manager is returned unchanged; no message.

### `DisconnectFxOp`: SPEC-PARTIAL

- Arguments (read by position): 0 `Op` (must expose the image operator interface), 1
  `Connection` (string, default empty). No return value.
- UnPackArg:
  - `Op` missing or not an image operator: `0x80070057`, severity 2, with the text
    "Argument 2 is not a valid connection name or number" (as shipped: the text for this
    case is the connection text, and "Argument must be an image operator" is never
    raised by this task).
  - `Connection` equal (case-insensitive) to `AllInputs`: mode "all inputs".
  - `Connection` equal (case-insensitive) to `All`: mode "all inputs and outputs".
  - Anything else: resolved by `fx_cmd::GetConnectionFromName(op, text, &index,
    &isOutput)`. A failure, or a name that designates an output, returns `0x80070057`
    without a message.
- Do (worker `0x180078b40`), single connection mode:
  1. If input `index` of the operator is not connected: return `0x80020003`.
  2. On the first run, remember the current source operator of that input (soft
     reference) and the source's output index.
  3. Disconnect the input.
  4. On the first run, remember the operator itself (soft reference).
- `AllInputs` and `All` modes: the worker returns success **without disconnecting
  anything** (as shipped; only the single-connection path contains work).
- Undo: reconnect the remembered source (object plus output index) to input `index`.
  Redo: repeat the disconnect.
- Missing: `FxCoreHelper.dll!fx_cmd::GetConnectionFromName` was not opened, so the
  accepted connection names / numbers and how an empty string is treated are not
  established.

### `RenderFxOp`: SPEC

- Arguments (by position): 0 `InputObj` (must be an image operator whose class id is the
  File Output operator `9acb71ff-0e3e-41cc-bb6b-d050b9dacd41`), 1 `Interactive`
  (boolean, default false; only a boolean variant is honoured, any other type leaves it
  false). No return value.
- UnPackArg errors: not an image operator, no class-id interface, or not a File Output
  operator: `0x80070057` without a message.
- Do (worker `0x180079310`):
  1. Unless the application runs without UI (`DSIsAppRunningWithoutUI`), create the
     render progress dialog.
  2. Get the operator's render interface `87581e85-ffc4-48cb-a4b2-9306e5029b6d`; absent:
     `0x80070057`. Ask it to begin rendering; refusal: `0x80004005`.
  3. Read start frame, end frame and step from the operator.
  4. With the dialog: show start / end / step, the progress range, and the output file
     name ("** Output File Name Not Set ***" when the operator has none). If
     `Interactive` is true the dialog first waits for the user; a cancel at this point
     skips rendering. Then the status becomes "Rendering Images" (with `Interactive`
     the dialog is polled once more before the loop).
  5. For frame = start; frame <= end; frame += step: get the frame's file name, report
     "Rendering <name>" (dialog status, or an info log line when there is no dialog),
     render the frame through the operator, show the result image in the dialog, update
     the timing figures (last frame, average, total, estimated remaining = average x
     frames left; without a dialog these are logged as one info line). Stop when the
     user cancels in the dialog or when the operator reports a failed frame.
  6. When the loop ran to the end: dialog shows the end frame and "Done"; if the last
     frame succeeded an info line "Done Rendering Fx Op.  Total Render Time <seconds>"
     is logged.
  7. Tell the operator rendering has ended; close the dialog.
- Return: 0 for a completed, cancelled or frame-failed render; the two error codes of
  step 2 otherwise. Timer resolution is raised to 1 ms for the duration.
- Undo / Redo: base-class sub-task handlers only; the render itself is not undone.

### `SetFxOpPos`: SPEC

- Arguments (by position): 0 `FxOp` (image operator), 1 `x`, 2 `y` (coerced to 32-bit
  float, defaults 0.0). No return value.
- UnPackArg errors: `FxOp` not an image operator: `0x80070057`, severity 2, "Argument
  must be an image operator". A failed read of `x` or `y`: `0x80070057` without message.
- Do (worker `0x18007b060`):
  1. Get the operator's FX node interface and from its owner the node's layout record
     (rectangle left, top, right, bottom as floats); either missing: `0x80070057`.
  2. On the first run remember the current centre of the rectangle.
  3. Move the rectangle so that its **centre** is `(x, y)`, keeping width and height
     (left = x - width/2, top = y - height/2).
  4. Mark the layout record as explicitly positioned (one-byte flag).
  5. Fire the property-changed notification `FX_OP_ATTRIB_CHANGED` for the operator.
  6. On the first run store a soft reference to the operator.
- Undo: same worker with the remembered centre. Redo: same worker with `(x, y)`.
- Coordinates are FX Tree view units; `x`, `y` are the node centre, not its corner.

### `MakeWarperShapePair`: SPEC-PARTIAL

- Arguments: 0 `FxOp` (by position; must expose interface
  `4e5544e6-f9ff-4fd3-871b-5315f79ef97d` and have class id
  `6a87f95f-ca69-4898-9434-09bc0224fe69` or `bc0f7833-15b6-4ef4-8c22-ba7694c8b4e1`),
  `InputObj` (object list fetched with `F3DCmdGetInputObjects`: the 2D shapes). No
  return value.
- UnPackArg errors: any of the checks failing, or the input list not available:
  `0x80070057`, severity 2, "Argument 1 must be a Warp or Morth operator".
- Do (list driver `0x18007f2f0`): null operator or list: `0x80004003`. Walk the list
  from the first item and stop at the first item that is not a 2D shape (interface
  `af1c239d-292c-4d68-b0fb-91e5968a73e6`); run the per-shape step for each shape; a
  failing step aborts with its status. If no shape was processed: `0x80070057`.
- Per shape (`0x18007f060`): the operator exposes four shape lists, numbered 1 to 4.
  1. Look the shape's id up in list 1. If list 1 holds this very shape, the shape is a
     **source** shape and the partner list is list 3. Otherwise look it up in list 3: if
     that lookup fails the step returns `0x80070057`; if list 3 holds this very shape it
     is a **destination** shape and the partner list is list 1. A shape with a known id
     that is not the object found: `0x8000ffff`.
  2. Look for a shape with the same id in the partner list. If there is none, create
     it (`0x18007ede0`): duplicate the shape through the scene duplication helper
     (class `747d257f-d01b-11d2-80c4-00a0c9ac19a9`), add the copy to the partner list
     and, on the first run, remember it in the task's list of created objects.
  3. Style both shapes (`0x18007f5a0`): on each, set one boolean parameter
     (`e1e3d423-5b5c-434f-aae0-e4a34bacc6b5`) to true and six double parameters
     (`05366b22-d1f8-42c2-88f1-8da0df1af082`, `98525b28-67b3-4ca4-8391-de924e2b59f5`,
     `fba12a65-6dde-4e2b-bf43-3dc6a6f10d7f`, `34f27de5-561b-4647-9291-a2e23702dddf`,
     `c9d6295e-b3a4-4500-aee7-6529a9e40efc`, `c944118f-400b-4aad-9228-6ed4e893c657`) to
     `(0.8, 0, 0.8, 1, 0, 1)` for the shape in the source list and
     `(0, 0.5, 0.5, 0, 1, 1)` for the shape in the destination list. Each value is set
     through a set-value sub-task (class `c089b901-8481-11d2-b118-00a024c79287`) at the
     current time; on the first run the sub-tasks are added to the task. The six doubles
     are two RGB colours, magenta for source and cyan for destination `(inferred from
     the values and the shape SPDL's WireframeUnselColor / WireframeSelColor)`.
  4. Ensure correspondence data for the original shape in list 2 and in list 4
     (`0x18007ebf0`): if the list has no entry with the shape's id, create a
     `C3DFxShapeCorr` object (`a13ddc3a-c099-4d3b-b94e-f7cf20c416c5`), initialise it for
     the shape with five default values, add it to the list and, on the first run,
     remember it in the created-objects list.
- Undo and Redo slots of this task are no-ops returning 0 (as shipped).
- Missing: (a) the decompilation of `0x18007ebf0` is damaged around the "entry already
  exists" branch, so the exact initialisation of the correspondence object (which
  fields, what the five values are) is not established; (b) the names of the seven
  shape parameters; (c) the meaning of lists 2 and 4 beyond "correspondence lists"
  (source and destination correspondences `(inferred)`).

## Open questions

1. `0x180058c80` (RevertPaintClip "discard everything"): which maps, counters and flags
   are reset.
2. `0x1800485f0` / `0x180048f60`: the exact mapping between a frame number and the
   paint clip's frame key (clip start offset, time warp); `0x180048170`: how the output
   file name is resolved.
3. `FxCoreHelper.dll!fx_cmd::GetConnectionFromName`: accepted connection names and
   numbers, result for an empty string.
4. `DisconnectFxOp` with `AllInputs` / `All`: the worker in `fxcore.dll` does nothing
   in these modes. Confirm on a live session that the command really leaves the
   connections in place (and whether the script wrapper in `si3dobjectmodel.dll`
   handles these modes itself).
5. `DisconnectFxOp` error text when `Op` is invalid is the connection text; confirm on
   a live session.
6. Whether any other DLL implements the paint clip interface with real Goto / Prev /
   Next methods (in `fxcore.dll` the three slots are stubs, so the three commands have
   no effect).
7. `MakeWarperShapePair`: parameter names behind the seven GUIDs; the Warp / Morph
   operator classes and their four shape lists live outside `fxcore.dll`.
8. The handler DLL list of `CreateFxTree`, `DisconnectFxOp`, `RenderFxOp`, `SetFxOpPos`
   also names `si3dobjectmodel.dll`; that copy of the CLSIDs was not examined
   `(inferred: object model wrappers that execute the same commands)`.
9. `RenderFxOp`: the progress dialog class (constructor `0x1800859b0`, wait / poll
   `0x180086670`, `0x180085d10`) was not opened; the cancel semantics are inferred from
   how the worker uses the return values.

## New ledger rows

- Paint clip operator (`C3DFxFilePaintOp`, "Paint Clip Op"): frame map with modified /
  selected flags, modified counter, save path `0x18005a640`, interface
  `48e47300-a4a7-4f7d-8956-d1317d0b4b19` (vtable `0x1800f6750`); sibling interfaces at
  `+0x420` (`21150ed4-7648-4d6e-bd61-0367f3bfebb2`) and `+0x428`
  (`a1d007b6-5173-4558-b275-86c11a9ecafd`) not read.
- FX Tree object `C3DFxTreeObject` (`3f7f4afe-bc8b-4b98-9a16-771119ec3cd9`,
  `C3DFxTreeObject.spdl`, property set `FxTree`): creation defaults not read.
- File Output operator `C3DFxFileOutOp` (`9acb71ff-0e3e-41cc-bb6b-d050b9dacd41`) and its
  render interface `87581e85-ffc4-48cb-a4b2-9306e5029b6d` (begin, start / end / step,
  output name, per-frame name, render frame, end).
- FX operator connection interface `7aa64ec7-27e1-4ffa-b5db-16fe50d9766f` and node
  layout record (rectangle + "explicitly positioned" flag); notification
  `FX_OP_ATTRIB_CHANGED`.
- `FxCoreHelper.dll` exports `fx_cmd::*` and `fx_img::*` (argument, list and image
  helpers) not opened.
- Render progress dialog of `fxcore.dll` (`0x1800859b0`).
- 2D shape classes (`C3DFxShapeBezier`, `C3DFxShapeCorr`, shape lists) and the Warp /
  Morph operators (`6a87f95f-ca69-4898-9434-09bc0224fe69`,
  `bc0f7833-15b6-4ef4-8c22-ba7694c8b4e1`) with their four shape lists.
- Other task classes registered next to these in `fxcore.dll` and not covered here:
  `C3DFxConnectFxOpTask`, `C3DFxSetFxOpAttribTask`, `C3DFxSetFxOpCnxFlagTask`,
  `CLSID_3DFxTreeClipboardTask`.
