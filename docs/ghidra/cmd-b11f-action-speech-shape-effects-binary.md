# CMD-B11f: viseme / speech actions, shape copy and shape groups, deform stripping, clip effects read from `action.dll` (StoreViseme, SetupEvolverVisemes, CreateVisemeAction, CreateEvolverSpeechAction, CreateSpeechAction, FreezeLipSync, CopyShape, CreateShapeGroup, SetShapeGroup, StripDeformOperators, Open SE for Link With Deform, RemoveEffect, ResetOffset, CutClipInSpace, CreateOffsetEffect)

Row: **CMD-B11f**. Status: **SPEC** (10 names), **SPEC-PARTIAL** (5 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\action.dll`, image base `0x180000000`, sha256 `71769ec1ceb40c1d2c46b810af8284f18f1dab8317361beac5c8efcf7ce85f86`.
Method: CLSID byte search; the `DllGetClassObject` (`0x1800a4ae0`) inline compare chain read
in full and mapped CLSID -> factory vtable for all 73 classes; factory vtables, task
constructors and task / worker vtables read as bytes; Ghidra decompilation of the 15 Do
wrappers, the 15 worker functions (worker vtable slot 9) and three helpers (control finder
`0x18002fed0`, shape copier `0x180026c00`, stack stripper `0x180072950`). Sub-task CLSIDs
were read as bytes and named from `data/command_registry.json`; operator class CLSIDs named
from the SPDL dump in `data/`. Arguments, flags and defaults come from the registry; UnPackArg
methods were located but not read (argument order below follows the registry and the Do
wrappers). Statements are read from the binary unless marked `(inferred)`.

## 1. Handler table

Dispatch is the same as in tasks.dll and as described in CMD-B11g: `DllGetClassObject`
compares the CLSID inline (two 8-byte compares), allocates a 0x48-byte class factory and
installs its vtable; factory slot 6 allocates and constructs the task. Two object layouts
occur here:

- **Layout A** (speech / viseme / shape-group / strip): `CDSCOMObject` at `+0`, the
  `C3DCoreBaseTask` part at `+0x18`; Do calls slot 9 of the outer object (or of a secondary
  interface at `+0x38` / `+0x90`).
- **Layout B** (clip effects, CopyShape, CutClipInSpace, Open SE): the task part at `+0`,
  and a worker interface at `+0x90` (or `+0x38` for Open SE) whose slot 9 does the work.

Task vtable slots: 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg.

| Command | Handler CLSID | Factory vtable -> create (slot 6) -> ctor (size) | Task vtable (offset) | Do -> worker (worker vtable) | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `StoreViseme` | `073dfffa-4f94-413a-b386-2db1c0a4d610` | `0x180126d50` -> `0x1800a3e40` -> `0x180070af0` (0x140) | `0x18011f130` (+0x18) | `0x180071880` -> `0x180070f00` (outer `0x18011f0e0`) | `0x180071dc0` | `0x180071a10` / `0x180071930` |
| `SetupEvolverVisemes` | `54a09888-4c17-4120-a57f-39c3395d0bca` | `0x180127a00` -> `0x1800a3c80` -> `0x180067cd0` (0x120) | `0x18011e8c0` (+0x18) | `0x180069cf0` -> `0x180068990` (outer `0x18011e870`) | `0x18006a140` | `0x180069e60` / `0x180069d90` |
| `CreateVisemeAction` | `5e9f232b-9446-47e3-bc71-2b4419dc414e` | `0x180126998` -> `0x1800a32c0` -> `0x18002fc40` (0x110) | `0x180118860` (+0x18) | `0x180030ab0` -> `0x180030170` (outer `0x180118810`) | `0x180030e00` | `0x180030c20` / `0x180030b50` |
| `CreateEvolverSpeechAction` | `afc0e8f6-2cbb-43c2-befa-e68ed151a8a8` | `0x180127a38` -> `0x1800a3140` -> `0x180029ce0` (0x120) | `0x180117bd0` (+0x18) | `0x18002a9d0` -> `0x180029fa0` (outer `0x180117b80`) | `0x18002ac00` | `0x180030c20` / `0x18002aa50` |
| `CreateSpeechAction` | `f4a0e1e6-77ef-4ea5-b92a-193c0bf2c178` | `0x180126c70` -> `0x1800a3240` -> `0x18002e320` (0x118) | `0x1801185f0` (+0x18) | `0x18002f630` -> `0x18002e6b0` (outer `0x1801185a0`) | `0x18002f840` | `0x180030c20` / `0x18002f6d0` |
| `FreezeLipSync` | `bc71a1b3-439e-48eb-be67-934acc6147c6` | `0x180127a70` -> `0x1800a3480` -> `0x18003b4c0` (0x110) | `0x18011a220` (+0x18) | `0x18003c200` (did not decompile) -> `0x18003b710` (outer `0x18011a1d0`) | `0x18003c2d0` | `0x18003c270` / `0x18003c220` |
| `CopyShape` | `7116d731-7ec0-11d4-9c8a-00d0b719049e` | `0x180126ea0` -> `0x1800a3080` -> `0x1800269a0` (0x100) | `0x180117500` (+0) | `0x180027700` -> `0x180027370` (`0x1801175c0`); copier `0x180026c00` | `0x180027af0` | `0x1800277a0` / `0x180027740` |
| `CreateShapeGroup` | `e2997ab9-1abd-4fa5-b883-57924b83b469` | `0x180127958` -> `0x1800a3200` -> `0x18002cd50` (0x80) | `0x180118290` (+0x18) | `0x18002d710` -> `0x18002cf20` (`0x180118300` at +0x38) | `0x18002da20` | `0x18002d7e0` / `0x18002d770` |
| `SetShapeGroup` | `d7e2480b-7d29-4455-a82a-882835edb6d5` | `0x180127990` -> `0x1800a3c40` -> `0x180060a00` (0x80) | `0x18011dcd0` (+0x18) | `0x180060ec0` -> `0x180060cd0` (outer `0x18011dc80`) | `0x1800611d0` | `0x180060f70` / `0x180060f20` |
| `StripDeformOperators` | `eaa03726-f9bd-11d2-9c61-0060970a2bc8` | `0x180127338` -> `0x1800a3e80` -> `0x180071fb0` (0xb0) | `0x18011f330` (+0x18) | `0x1800727e0` -> `0x180072470` (`0x18011f3a0` at +0x90); stripper `0x180072950` | `0x180072e50` | `0x180072840` / `0x180072820` |
| `Open SE for Link With Deform` | `e04f9e50-7db5-4ae8-a2b5-b62a9ac617a0` | `0x1801278e8` -> `0x1800a3800` -> `0x180047ad0` (0x68) | `0x18011b610` (+0) | `0x1800480e0` -> `0x180047f70` (`0x18011b6d0` at +0x38) | `0x1800485a0` | both `0x18008f3b0` |
| `RemoveEffect` | `37a40422-ab72-11d4-a54d-009027bc6584` | `0x1801277d0` -> `0x1800a3a00` -> `0x1800575a0` (0x100) | `0x18011ca30` (+0) | `0x180057ec0` -> `0x1800577d0` (`0x18011caf0`) | `0x1800581a0` | `0x180057f60` / `0x180057ef0` |
| `ResetOffset` | `b08e95bb-58f1-11d4-a53c-009027bc6584` | `0x180127680` -> `0x1800a3a80` -> `0x180059a60` (0xb8) | `0x18011cdb0` (+0) | `0x18005a240` -> `0x180059bf0` (`0x18011ce70`) | `0x18005a3a0` | `0x18005a290` / `0x18005a270` |
| `CutClipInSpace` | `ba76fd14-6ec1-11d4-b4c1-00d0b7142c4a` | `0x1801276f0` -> `0x1800a3300` -> `0x180032f00` (0x118) | `0x180118fc0` (+0) | `0x180033ac0` -> `0x1800331e0` (`0x180119080`) | `0x180033ec0` | `0x180033b80` / `0x180033b10` |
| `CreateOffsetEffect` | `beebd686-5c15-11d4-a53d-009027bc6584` | `0x180127798` -> `0x1800a3180` -> `0x18002add0` (0x100) | `0x180117d50` (+0) | `0x18002b980` -> `0x18002b020` (`0x180117e10`) | `0x18002bb80` | `0x18002b9b0` / `0x180057ef0` (shared with RemoveEffect) |

Every CLSID has its own factory; no command in this row shares a CLSID, so no name-based
behaviour switch exists. The CLSID constants sit in the `.rdata` CLSID table
(`0x1801351xx` .. `0x1801358xx`, e.g. StoreViseme at `0x180135368`) and are referenced by the
compare chain and by the register / unregister routines.

## 2. Shared facts

- **Undo recording flag**: every worker takes a "record undo" flag (the Do argument). When
  it is 0 the worker still performs the change but does not keep references / sub-tasks and
  usually returns `S_FALSE` (1) instead of `S_OK`.
- **Model / mixer resolution** (speech, viseme, StoreViseme, SetupEvolverVisemes): the model
  is taken from the input object (QI for the model interface, else `SIGetModelFrom3DObject`).
  If the model is a locked referenced model, `F3DEnableMixerOnDelta` is called first. The
  model's mixer is fetched / created with `F3DGetModelNLEContainer` (the creation sub-task is
  kept only when recording undo). If the mixer is locked (any lock level `0xffff`) and the
  model is not a referenced model, the lock error is raised and the command fails with
  `0x80070005` (E_ACCESSDENIED).
- **Action source classes created**: viseme sources are created from class
  `a11c232b-4be5-4679-b666-5a1cbaee108b` (constant `0x180135298`); speech sources from class
  `12a3efc5-e543-11d2-b352-00105a1e6ce9` (constant `0x180135278`); both are classes served by
  action.dll itself. A new source is added to the mixer's source list; its `Name` parameter is
  set from the `Name` argument (string). Viseme sources also get `FrameStart` = 1 and
  `FrameEnd` = 5 (two source parameters set to 1.0 and 5.0; inferred names) and a static item
  `PhonemeType` (double) holding the phoneme index.
- **Face Robot control finder** (`0x18002fed0`, used by CreateVisemeAction and
  CreateSpeechAction): walks the model's children recursively (not into nested models) and
  keeps every object whose tag string (a string property read through constant
  `0x180134e18`) contains the token `Control` **and** one of `Mouth`, `Tongue`, `Jaw`. If no
  object matches, the command does nothing and returns `S_FALSE`.
- **Per-control transform items**: for each found control, six items are added, one per
  local transform channel: `.kine.local.rotx`, `.roty`, `.rotz`, `.posx`, `.posy`, `.posz`
  (string table at `0x18018a030` -> `0x180118370`); the item name is the parameter name
  stripped of the model prefix (`F3DActionGetStrippedParameterName`).
- **Sub-task CLSIDs named from the registry**: `dd531990-ccc2-11d2-ac73-00a02485cecb` =
  DeleteObj; `5f1f5161-8b90-11d2-a93c-00a024190119` = SICreateCluster;
  `920f5f50-5d55-11d2-8082-00a0c955b335` = AddFCurve; `5ad1fd7e-5d5d-11d2-8082-00a0c955b335` =
  RemoveAnimation; `5ad1fd80-5d5d-11d2-8082-00a0c955b335` = SaveKey.
- **Effect-wide HRESULT `0x562e80c7`** (clip effect workers, Open SE): a success-with-info
  code that is kept as the result when a later step returns plain `S_OK` (inferred:
  "operation cancelled / nothing to do" style status).
- Errors raised through the task's error handler use `XSIACTION2` dictionary ids (0x3f6,
  0x3fb, 0x3fc, 0x444) or the task's own message ids (100, 101, 102) and `simsgcat` log ids
  (0xdc, 0xdd); texts not looked up.

## 3. Contracts

### `StoreViseme`: SPEC

Stores the current values of a set of parameters as a viseme action source in the model's mixer.

**Wire contract**
- Args: `Model` (object, optional: if empty, the model of the first `InputObj` item is used),
  `InputObj` (parameter list, required), `Name` (string, default `StoredAction`),
  `PhonemeType` (int, default 0), `Action` (return, the new source).
- `InputObj` null -> `E_POINTER`; output slot null -> `E_POINTER`.
- The parameter list is filtered to parameters belonging to the model
  (`F3DActionFilterListWithModel`).
- Mixer resolution and lock checks as in section 2 (locked -> `0x80070005`).
- A viseme source (class `a11c232b-...`) is created; static item `PhonemeType` = the argument.
- For each remaining parameter: proxy parameters are dereferenced; the parameter's current
  value is stored as a static item named with the stripped parameter name
  (`F3DAction_StoreStaticValue`). Parameters whose capability flags carry bit 2 (inferred:
  animated / non-storable) are skipped.
- If no item was stored, the source is released and `Action` is empty (nothing added).
- Otherwise: `Name` is set (when a name is given), FrameStart = 1, FrameEnd = 5, the source is
  added to the mixer. With undo recording, references to the input list and the source are
  kept for Undo / Redo.

### `SetupEvolverVisemes`: SPEC-PARTIAL

Builds one viseme source per viseme defined in an Evolver mapping file.

**Wire contract**
- Args: `Model` (required), `ClipList` (list input), `FileName` (string, default empty),
  `KeyList` (output list), `Action` (output list).
- Model / ClipList / output null -> `E_POINTER`. Mixer lock -> `0x80070005`.
- The file is parsed by `0x1800f7b80`. On failure an error is logged (`SILogMessage`
  severity 2, `XSIACTION2` id 0x444) and the parser HRESULT is returned.
- Two helper passes (`0x180068420` with the ClipList, `0x180068280`) build a map of viseme
  name -> list of (parameter, value) pairs (inferred: the parameters driven by the clips
  in `ClipList`).
- For every viseme: a viseme source is created (or an existing one from the map reused),
  `PhonemeType` = the viseme's phoneme index, name = prefix + viseme name; for each driven
  parameter the parameter is temporarily set to the file's value, its value stored as a
  static item (`F3DAction_StoreStaticValue`), and the original value restored. Parameters
  whose value changed are appended to the second output list.
- Each new source gets Name, FrameStart 1, FrameEnd 5 and is added to the mixer; an item of
  class `0x180136508` wrapping it is appended to the first output list. A counter of created
  sources is kept; none created -> `S_FALSE`.
- Missing: the Evolver file format (parser `0x1800f7b80` not read) and which of the two
  output lists is `KeyList` vs `Action` (registry order suggests the first is `KeyList`).

### `CreateVisemeAction`: SPEC

Creates an empty viseme source that keys the local transforms of the Face Robot mouth controls.

**Wire contract**
- Args: `Model` (required), `Name` (string, default `Viseme`), `Action` (return).
- Output null -> `E_POINTER`; Model empty -> `S_FALSE`, nothing done. Mixer lock -> `0x80070005`.
- Controls found by the control finder (section 2); none -> `S_FALSE`.
- A viseme source is created; for every control, six static items (local rot x/y/z,
  pos x/y/z) are added with value 0.0.
- `Name` set on the source; the source is added to the mixer; with undo recording a reference
  to it is kept.

### `CreateSpeechAction`: SPEC

Creates a speech (lip-sync) source for a Face Robot face: a shape item for the face mesh plus
transform items for the mouth controls.

**Wire contract**
- Args: `Face` (object, required), `Name` (string, default `SpeechAction`), `Action` (return).
- Output null -> `E_POINTER`; Face empty -> `S_FALSE`. Mixer lock -> `0x80070005`.
- Controls found by the control finder; none -> `S_FALSE`.
- A speech source (class `12a3efc5-...`) and a helper container (class at `0x1801355f8`) are
  created.
- If a face geometry is given: at the current time the geometry's clusters are scanned for a
  cluster of the shape-capable type that carries a shape-key property (two class checks,
  constants `0x180136908` / `0x1801368f8`). If none is found, a cluster named `Shape` covering
  the whole geometry is created through an **SICreateCluster** sub-task (cluster type code 3).
  An item for that cluster's shape weight is added with group `Face,Mesh` and flag 1.
- For each control, six items (local rot / pos) are added, grouped by the control's tag
  string.
- `Name` is set; the source's item list is published (source slot `0x5e8` with a flag pair 1,1);
  the source is added to the mixer; reference kept when recording undo.

### `CreateEvolverSpeechAction`: SPEC

Creates a speech source whose items are an explicit parameter list, grouped by Evolver naming.

**Wire contract**
- Args: `Model` (required), `Name` (string, default `SpeechAction`), `KeyList` (parameter list),
  `Action` (return).
- Output null -> `E_POINTER`; Model empty -> `S_FALSE`. Mixer lock -> `0x80070005`.
- A speech source (class `12a3efc5-...`) is created; for each parameter in `KeyList` an item is
  added whose group is `expressions` if the parameter's full name contains `expressions`,
  else `teeth` if it contains `teeth`, else `unknown`.
- `Name` is set only when non-empty; the item list is published (as in CreateSpeechAction);
  the source is added to the mixer; with undo recording references to `KeyList` and the source
  are kept.

### `FreezeLipSync`: SPEC-PARTIAL

Bakes the model's speech actions into fcurves on the driven parameters and deletes the speech sources.

**Wire contract**
- Args: `Model` (required).
- Model empty or no mixer -> `S_FALSE`.
- For every source of class `12a3efc5-...` (speech) in the model's mixer: each item of the
  internal kind 0x1a (inferred: the speech-driven channels) is resolved to its target
  parameter (`<model name>.` + item name). If the target has no fcurve, an fcurve is created
  (`F3DCreateFCurve`), filled from the speech item (inferred: sampled evaluation), and attached
  through an **AddFCurve** sub-task; if it already has one, the existing fcurve is handed to a
  **DeleteObj** sub-task (flag 0x10) (inferred: replaced).
- When at least one item was frozen, the speech source itself is deleted through a
  **DeleteObj** sub-task.
- Sub-tasks are kept for undo only when recording; without recording -> `S_FALSE`.
- Missing: the Do wrapper (`0x18003c200`) did not decompile; the exact fill rule for the new
  fcurve and the meaning of item kind 0x1a are inferred.

### `CopyShape`: SPEC

Copies a stored shape key onto other clusters.

**Wire contract**
- Args: `Source` (shape key, required), `Target` (list of clusters, required).
- Source or Target null -> `E_POINTER`.
- The source must be a shape key whose owner is a cluster (class
  `3df7f9e0-89ee-11d0-9964-00a0243f0e60`), else error 100 (`0x80004005`, S_FALSE returned).
- For each target cluster, at the current time: element counts must match, else error 101.
  The source's reference mode maps to a shape reference (0 -> 2, 1 -> 0, 2 -> 1; other values
  `0x80004005`). The target's result cluster key is fetched or created
  (`F3DGetResultClusterKey`, possibly an add-property sub-task); its kind must agree with the
  reference mode (1 -> 5, 2 -> 3, 0 -> 6), else error 102.
- A new shape key is created on the target by a store-shape sub-task (class at `0x180135468`),
  all point values and the element layout are copied from the source, and the source name is
  copied to the new key.
- Each new key is wrapped in an item and collected in an output list (kept on the task).
  Returns `S_FALSE` when no target was copied, else `S_OK`.

### `CreateShapeGroup`: SPEC-PARTIAL

Puts a set of shape keys into a newly named shape group.

**Wire contract**
- Args: `InputObj` (list, required), `Name` (string, default empty).
- List or name pointer null -> nothing done.
- The shape keys are collected from the input (helper `0x18002dac0`), and the group name is
  resolved by helper `0x18002d320` (inferred: a unique name generated when `Name` is empty or
  taken).
- With undo recording, a list (class at `0x180136638`) holding each key's old group name is
  built first.
- Each shape key (interface at `0x180136898`) gets its group name set to the resolved name.
- Missing: the two helpers (key collection, name resolution) were not read.

### `SetShapeGroup`: SPEC

Assigns an existing group name to a list of shape keys.

**Wire contract**
- Args: `InputObj` (list, required), `Name` (string, default empty).
- List or name null -> `E_POINTER` (`0x80004003`); empty `Name` -> `E_INVALIDARG`
  (`0x80070057`).
- Each item must expose the shape-key interface, else `E_POINTER`.
- With undo recording each key's previous group name is saved first; then the key's group name
  is set to `Name`. With undo recording a reference to the list is kept.

### `StripDeformOperators`: SPEC

Removes the deformation operators from an object's construction history in the current construction region.

**Wire contract**
- Args: `InputObj` (object, required).
- No object -> `S_OK`, nothing done; null primitive pointer -> `E_POINTER`.
- Reads ambient value `context.constructionmode` and preference
  `shape_animation.MuteDeformsOnShapeInstancing`.
- Clears earlier sub-tasks, then walks the primitive's operator stack between two region
  markers. Default region: modeling (marker indices 0..1). When the construction mode is 3
  (secondary shape) the secondary-shape region (2..3) is stripped first and then the modeling
  region.
- Skipped: the stack markers (Modeling `9b82aced-...`, Shape Modeling `b0a5373d-...`,
  Animation `0d29533c-...`, Post Simulation `dba00978-...`) and the Cluster Shape Combiner
  (`9afbf7f0-...`), and operators that are deactivated (`F3DIsDeactivated`).
- Each other operator is removed by helper `0x180072140` (with the mute preference and undo
  flag). If it is locked, a warning is logged (`simsgcat` 0xdd, or 0xdc for referenced-model
  locks) and it stays.

### `Open SE for Link With Deform`: SPEC

Opens a transient schematic/explorer picker for linking a cluster with a deformer.

**Wire contract**
- Args: `Cluster` (object, required), `LinkWithOri` (bool, default false).
- No cluster -> returns `S_FALSE` (1) from Do.
- Without UI (`DSIsAppRunningWithoutUI`) nothing is shown.
- The task's own linker interface (`0x180139140`) is passed to a transient view
  (`F3DShowTransient`) with filter: all nodes when `LinkWithOri` is false, else filter
  type 2; view attributes 8 / 3, mode 2, flags `0x601`.
- The view's result (including the info code `0x562e80c7`) is returned.

### `RemoveEffect`: SPEC

Removes the effect (per-item offset expressions and their animation) from a clip.

**Wire contract**
- Args: `Clip` (required).
- Null clip -> fails.
- The clip's effect object is fetched; all parameters below its effect node are collected and
  their animation removed through a **RemoveAnimation** sub-task (mode 4).
- The effect's per-item expression strings are saved (when recording undo) and then all
  cleared (set to empty).
- With undo recording a reference to the clip is kept.

### `ResetOffset`: SPEC-PARTIAL

Resets the clip offset of parameters driven by the mixer at a given time.

**Wire contract**
- Args: `InputObjs` (parameter list), `Time` (double).
- For each parameter: `F3DCheckForMixerConnection`; if driven, the contributing actions at
  `Time` are fetched (`F3DCheckForContributingActions`). If not exactly one action
  contributes, error `XSIACTION2` 0x3fb (more than one) or 0x3fc (none) is raised with
  `0x80070057`.
- For the single contributing clip, the item's effect/offset parameter is keyed through a
  **SaveKey** sub-task at `Time` (inferred: key value 0, i.e. no offset).
- If some input parameter is not mixer-driven, `XSIACTION2` 0x3f6 is raised (`0x80070057`).
- Missing: the key value written (SaveKey sub-task arguments partly unread).

### `CutClipInSpace`: SPEC-PARTIAL

Splits a clip by objects: the items that animate the given objects move to a new clip.

**Wire contract**
- Args: `Model`, `InputObjs` (objects), `Clip` (required), `Value` (return, the new clip).
- Any of model / list / clip null -> `E_POINTER`.
- The names of the input objects are collected in a set.
- The clip's source is duplicated by a sub-task (class at `0x180136cc8`, inferred: copy
  source), and a new clip of the copy is created by a second sub-task (class at
  `0x180136d18`, inferred: add clip) at the original clip's start frame (converted to
  seconds) on the same model.
- For each item index, the object name (text before the first `.` of the item name) is looked
  up in the set: if found, the original clip's item is deactivated and the new clip's item
  takes the original activation; otherwise the new clip's item is deactivated.
- Returns the new clip in `Value`; without undo recording `S_FALSE`.
- Missing: identity of the two sub-task classes.

### `CreateOffsetEffect`: SPEC

Adds an offset effect to a clip so that each item can be offset by its own `param`.

**Wire contract**
- Args: `Clip` (required).
- Null clip -> `E_POINTER`; clip locked (lock level 2) -> lock error, `0x80070005`.
- Reads the clip start and duration; collects the effect parameters of the clip.
- Two **SaveKey** sub-tasks key all effect parameters: at the clip start and at start +
  duration.
- Each item's effect expression becomes `(this) + param` when empty, otherwise
  `(<old expression>) + param`; old strings are saved for undo when recording.
- With undo recording a reference to the clip is kept.

## Open questions

1. SetupEvolverVisemes: Evolver mapping file format (parser `0x1800f7b80`) and the
   KeyList / Action output assignment.
2. FreezeLipSync: Do `0x18003c200` did not decompile; meaning of item kind 0x1a and the fcurve
   fill rule.
3. CreateShapeGroup: name-resolution helper `0x18002d320` (unique name rule).
4. ResetOffset: SaveKey arguments (value keyed).
5. CutClipInSpace: sub-task classes at `0x180136cc8` / `0x180136d18`.
6. The tag property read through constant `0x180134e18` by the control finder (inferred: the
   Face Robot keyword / tag string).
