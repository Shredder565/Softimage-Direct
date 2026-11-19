# CMD-B11g: Camera Sequencer plot commands read from `action.dll` (confirmation of CMD-B10 question 10: PlotCamSeqToActions, GetSceneFrameSetFromCamSeq, PlotCamSeqShape; AddToTOC check)

Row: **CMD-B11g** (confirmation of the inferred CMD-B10 wiring). Status: **SPEC** (2 names), **SPEC-PARTIAL** (1 name); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\action.dll`, image base `0x180000000`, sha256 `71769ec1ceb40c1d2c46b810af8284f18f1dab8317361beac5c8efcf7ce85f86`.
Method: CLSID byte search, the `DllGetClassObject` compare chain, class factory vtables, task
constructors and task vtables read as bytes; Ghidra decompilation of the Do / UnPackArg
methods and the three worker functions (plot worker, apply/cleanup helper, shape worker).
Message ids are `XSIMSGCAT` / `XSIACTION2` dictionary ids (texts not in the repo's
`data/si/dict/XSIMSGCAT.dict` copy for id 463). Statements are read from the binary unless
marked `(inferred)`.

## 1. Handler table

`DllGetClassObject` (`0x1800a4ae0`) is a long chain of inline CLSID compares (two 8-byte
compares per CLSID); each hit allocates a 0x48-byte class factory and installs a factory
vtable. Factory slot 6 allocates and constructs the task (same pattern as tasks.dll). The
`C3DCoreBaseTask` part sits at object `+0x18` (task vtable slot 5 Do, 6 Undo, 7 Redo,
8 UnPackArg, 9 RePackArg); each task also has a worker sub-object whose slot 9 does the work.
No match returns `0x80040111` (CLASS_E_CLASSNOTAVAILABLE); allocation failure `0x8007000e`.

| Command | Handler CLSID (constant) | Factory vtable -> create (slot 6) -> constructor (size) | Task vtable (`+0x18`) | Do / worker | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `PlotCamSeqToActions` | `d1404f70-9769-409d-bfb8-008a6a69caa0` (`0x180135818`) | `0x180127aa8` -> `0x1800a38c0` -> `0x1800487c0` (0xb0) | `0x18011b920` | Do `0x180049e40` -> worker (vtable `0x18011b990` slot 9) `0x1800490f0`; apply/cleanup helper `0x180048a00` | `0x18004a170` (RePackArg `0x18004a000`) | Undo `0x180055cc0` (not read); Redo `0x180049ed0` (clears sub-tasks, re-runs the worker with undo recording on) |
| `PlotCamSeqShape` | `6868201f-0d9e-4689-9a38-b7d823796d57` (`0x180135828`) | `0x180127ae0` -> `0x1800a3880` -> `0x18004a2f0` (0xf8) | `0x18011bc10` | Do `0x18004d530` -> worker (vtable `0x18011bc80` slot 9) `0x18004bf80`; per-object helpers `0x18004ab60` (default list), `0x18004b150`, `0x18004a530` (clip / source), `0x18004cd70` (key store) | `0x18004d7d0` (RePackArg `0x18004d6a0`) | Undo `0x180050850`, Redo `0x18006fcc0` (not read) |
| `GetSceneFrameSetFromCamSeq` | `8ece62e1-41c9-4e18-84cc-97a1b0d8d625` (`0x180135838`) | `0x180127b18` -> `0x1800a3580` -> `0x18003e060` (0x78) | `0x18011a910` | Do `0x18003e260` (no worker) | `0x18003e680` (RePackArg `0x18003e3f0`) | both `0x180027ae0` (return 0, nothing to undo) |

The CLSID constants are also referenced by the register / unregister routines (`0x1800a7a44`
.. `0x1800a7a88`, `0x1800a821f` .. `0x1800a823d`).

**AddToTOC** (`bd02d462-9240-11d3-b4a8-009027bc38d5`, constant at `0x1801355a8`): action.dll
does **not** implement it. The constant has one reference, inside a large worker
(`0x180063c90`), and is not in the `DllGetClassObject` compare chain or the register tables;
action.dll only uses the CLSID as a client of the tasks.dll task (inferred: creates it to put an
object into the transient object container).

## 2. Shared facts

- **Frame set source.** All three commands get their frames from the imported
  `F3DGetGlobalFrameSetFromSequencerRange(StartFrame, EndFrame, PlotWithoutGaps, out frames)`
  (not in action.dll; inferred to live in actioncore.dll with the rest of the sequencer).
  `PlotWithoutGaps` is passed straight through; action.dll never walks shot clips itself, so
  the clip-in / scale mapping and the gap rule are inside that import (open, see questions).
  The output is an ordered list of doubles: the global (scene) frame for each sampled
  sequence frame.
- **Empty frame set** (plot commands only): log `XSIMSGCAT` id 463 (`0x1cf`) at severity 2
  (error) and return `0x562e80c7` (the "success with warning / nothing done" code, see
  cmd-b11a), with nothing created. `GetSceneFrameSetFromCamSeq` does not log.
- **Delegation.** The plot is done by running other action.dll / scene tasks as sub-tasks
  (added to the undo record when the command is undoable): `PlotFrameSetToActions` /
  `PlotToActions` task (CLSID `7bff0142-531f-410b-bdd5-194614f0c911`), `ApplyAction`
  (`12a3efd3-e543-11d2-b352-00105a1e6ce9`), `GetDrivingActions`
  (`7249a5d5-c3e9-11d4-b8b5-00a0c92469be`), `DeleteObj` (`dd531990-ccc2-11d2-ac73-00a02485cecb`).

## 3. Contracts

### `GetSceneFrameSetFromCamSeq`: SPEC

**Wire contract**
- Args: `StartFrame` (double, default 1), `EndFrame` (double, default 100), `PlotWithoutGaps`
  (bool, default false); read by name in that order, an error on either frame stops UnPackArg.
- Do: one call to the sequencer frame-set import with the three values; the returned global
  frames become the return value `Value` as a 1-D safe array (variant array of doubles), in
  the order returned (one entry per sequence frame kept).
- Empty result: returns an empty 1-D array (VT_ARRAY|VT_VARIANT, 0 elements), success, no
  message.
- No scene change; Undo / Redo are no-ops returning 0.
- Errors: an import failure HRESULT is returned as is.

### `PlotCamSeqToActions`: SPEC

**Wire contract**
- Args (UnPackArg, in order, any failure stops): `InputObjs` (object list, optional),
  `ActionName` (string, default `CamSeq_PlotAction`), `StartFrame` (1), `EndFrame` (100),
  `PlotWithoutGaps` (false), `FCurve Kind` (long; default `siStandardFCurve` = 20),
  `DefaultSegKind` (long; default `siCubicInterpolation` = 3), `Fit FCurve` (false),
  `Fit Tolerance` (double, registry default 0.01; the constructor's internal default is 0.001
  but is always overwritten), `ProcessContRots` (true), `Apply` (true), `Delete` (false).
  Return `Value` = the created action source list.
- Step 1, parameters: if `InputObjs` is missing or empty, the parameter list is computed from
  the current scene root model: every parameter under it that the animated-state test reports
  as animated with source-type flag 4 (the flag value is read; its meaning is not resolved
  here, inferred to restrict to one source kind). Otherwise the given list is used as is.
- Step 2, frames: the sequencer frame set for `StartFrame..EndFrame` / `PlotWithoutGaps`
  (section 2). Empty -> error message 463, return `0x562e80c7`, nothing created.
- Step 3, plot: runs the `PlotFrameSetToActions` task with: the parameter list, `ActionName`,
  a "use frame list" flag 1, start = `StartFrame`, end = DBL_MAX, step 1.0, the frame count
  and frame array, then `FCurve Kind`, `DefaultSegKind`, `Fit FCurve`, `Fit Tolerance`,
  `ProcessContRots`. Its output list (the new action source(s)) is the command's return value.
  (inferred) The plotted keys are laid out from `StartFrame` with step 1, one per entry of the
  frame set, so with gaps removed the action is shorter than the sequence range.
- Step 4, apply (only when `Apply` and the plot produced exactly one source): for each item of
  that source, run `ApplyAction` (source, no extra options) as a sub-task. Then remove the old
  driving clips: with explicit `InputObjs`, run `GetDrivingActions` on the inputs' owners
  (time ignored, keep compound and inactive = true) and keep the clips whose class id is
  `23201244-d1b9-11d2-…` or `23201247-d1b9-11d2-…` (action clip classes, inferred); with no
  `InputObjs`, enumerate the scene's clip container and take each clip's compound-clip owner
  (or the clip). The collected clips are deleted with `DeleteObj`.
- Step 5, `Delete` (only inside the Apply branch): `DeleteObj` on the plot output list, i.e.
  the action source is deleted after it has been applied.
- Undo record: when undoable, the args are stored and the parameter list and output list are
  kept as list references; sub-tasks are added to the task's undo list.

### `PlotCamSeqShape`: SPEC (promoted 2026-11-19, batch 12; see "Batch 12 answers")

**Wire contract**
- Args (UnPackArg): `InputObjs` (list), `Mode` (ulong, default 4), `StartFrame` / `EndFrame`
  (frames, converted to seconds when read, converted back for the frame set), `PlotWithoutGaps`,
  `ApplyKeys` (default true), `RefMode` (ulong, 0), `Content` (ulong, 0), `Name` (string, "").
  Outputs: `KeyList` (created shape keys) and `ClipList` (created clips). No `Value` return.
- Shows a progress bar (`XSIACTION2` id 0x445).
- Input list: if `InputObjs` is empty, a default list is built by helper `0x18004ab60` (not
  read; inferred: shape-animatable objects of the selection / scene). If the list is still
  empty, a warning `XSIACTION2` id 0x446 (severity 4) is logged and the command continues
  (and then does nothing).
- Frames: sequencer frame set (section 2); empty -> error 463, `0x562e80c7`.
- Per input object: get its shape-animation target; when inputs were explicit, collect its
  existing shape clips for later deletion (helper `0x18004b150`); create the shape source /
  clip (helper `0x18004a530` with `Name`, `Mode`, undo flag); set the clip time control
  start and clip-in to `StartFrame` and the end to `EndFrame` (seconds); store one shape key
  per frame of the frame set (helper `0x18004cd70` with `ApplyKeys`, `Mode`, `Name`,
  `Content`, `RefMode`); append created keys / clips to the output lists.
- If `ApplyKeys`: `DeleteObj` (flag 0x10) on the collected old clips (explicit inputs only).
- `KeyList` / `ClipList` are set only when non-empty.
- Missing: the bodies of the four helpers (meaning of `Mode` / `Content` / `RefMode`, how keys
  are named, which default objects are taken).

## Answers to question 10 (CMD-B10, Camera Sequencer)

- `AddShotClip` (`Parent`, `Frame`, `StartFrame` / `EndFrame`, end inclusive): **open**; not in
  action.dll (modeltasks.dll / actioncore.dll).
- Shot clip time mapping (clip-in, scale): **open**; action.dll never maps shot-clip times, it
  asks the imported `F3DGetGlobalFrameSetFromSequencerRange` for the global frame of each
  sequence frame. The only fact here: that list is in sequence order, one double per kept frame.
- `GetShotClip` between clips: **open** (actioncore.dll).
- `GetSceneFrameSetFromCamSeq` in gaps with `PlotWithoutGaps` false: the command returns
  exactly the import's list; what a gap frame maps to is decided in the import (**open**).
  Confirmed: `PlotWithoutGaps` is only forwarded; an empty range gives an empty array, no error.
- `PlotCamSeqToActions` with empty `InputObjs`: confirmed "animated parameters of the scene",
  computed from the current scene root model with the animated test (source-type flag 4), not
  an arbitrary list of every fcurve; it then plots into a real action source, applies it,
  deletes the old driving clips and returns the source.

## Open questions

- Location and behaviour of `F3DGetGlobalFrameSetFromSequencerRange` (gap handling, clip-in
  / scale, inclusive end): read actioncore.dll.
- Meaning of the animated-test flag 4 used for the default parameter list.
- `PlotCamSeqShape` helper bodies (`0x18004ab60`, `0x18004b150`, `0x18004a530`,
  `0x18004cd70`) and its Undo / Redo.
- Text of `XSIMSGCAT` id 463 and `XSIACTION2` ids 0x445 / 0x446.

## Batch 12 answers (PR #183 questions)

Read 2026-11-19 from the same `action.dll` through REA / Ghidra; GUIDs read as bytes and named
from `data/command_registry.json` / `data/spdl/spdl.json`.

### PlotCamSeqShape helpers — answered

- **Default input list (`0x18004ab60`, used when `InputObjs` is empty):** all clips of class
  `d39d0045-…` = `C3DShapeActionClip` (Mixer Shape Clip) in the scene are enumerated
  (recursively). For each clip: every item of its source is resolved and the **object owning the
  driven shape key** (its model-level 3D object) is added to the object list; the clip's compound
  owner (or the clip itself when not nested) is added to a second list of clips to delete. So an
  empty `InputObjs` re-plots every object that already has shape clips and replaces those clips.
- **Old-clip collection (`0x18004b150`, explicit inputs):** for the object's shape-animation
  container, every cluster's shape keys are visited; for each key, the clips driving it are found
  by walking its output connections for instances of class `12a3efc6-…` (`C3DInstAction2`,
  mixer action instance); the clip holding the instance (compound owner when nested) is added.
  The list is returned only when non-empty.
- **Source / clip creation (`0x18004a530`):**
  1. `AddTrack` (handler `67b8773c-…`) on the object's model: root compound, track class
     `d39d0049-…` = `C3DShapeActionTrack`, no name, position −1 (end).
  2. `Name` empty -> `SQ_PlotShape`.
  3. `CreateCompound` (handler `67b8773d-…`; registry args Model, InputObj, Compound, Track,
     Time, Name, Clip) with an empty input list, the new track, Time = frame 1 (in seconds) and
     the name -> the new compound clip.
  4. The clip parameter `78ae1830-241b-11d3-9c66-0060970a2bc8` is set to `Mode` (VT_I4). Its
     scripting name is not in the SPDL data (open; inferred: the shape clip's instancing / blend
     mode).
- **Key storage (`0x18004cd70`):** progress text `XSIACTION2` 0x429 with the frame count. For each
  frame of the frame set: a **Store Shape Key** sub-task (handler `12a3efd2-…`; registry args
  InputObj, Name, RefMode, Frame, Duration, Sampling, Content, Force deform stripping, OutputObj)
  with the shape target, `Name`, `RefMode`, Frame = that global frame, Duration 0, Sampling 0,
  `Content`, no forced stripping; each key goes to `KeyList`. If `ApplyKeys` is false, stop here
  (keys only, no clips). Otherwise (progress 0x42a): for key *i* a shape clip is made at
  `StartFrame` + *i* frames (seconds), duration −1 (default), with `Mode` and `Name` (helper
  `0x18004a8e0`, not read; inferred: one-key shape clip) and added to `ClipList`; finally a
  **StripDeformOperators** sub-task (`eaa03726-…`) runs on the last key's owner (inferred: so the
  plotted shapes are not deformed twice). So keys are stored at scene frames but clips are laid
  out on consecutive sequence frames from `StartFrame`.

### Other items

- `XSIMSGCAT` 463 text (from `data/si/dict.json`): "Unable to plot Camera Sequencer unless there
  are shot clips."
- `XSIACTION2` 0x445 / 0x446 / 0x429 / 0x42a texts: **open** (no XSIACTION2 table in `data/si`).
- `PlotCamSeqToActions` empty `InputObjs` / animated-test flag 4: **open** (not re-read this run).

### Status

- `PlotCamSeqShape`: **SPEC** (Mode parameter name and the one-key clip helper `(inferred)`).
