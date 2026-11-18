# CMD-B11c: scene save, presets, curve queries, inspection history and pop-up menus read from `tasks.dll` (SICreateRefPlane .. SaveBackupScene)

Row: **CMD-B11c**. Status: **SPEC** (18 names; InspectBrowse covers both registry entries), **SPEC-PARTIAL** (4 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\tasks.dll`, image base `0x180000000`, sha256 `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914`.
Method: CLSID-to-factory map recovered from `DllGetClassObject` (`0x180009700`, 113 inline
compares); class factory vtables, task vtables and the task's third vtable (the "worker"
interface at task `+0x38`) read as raw bytes; Ghidra decompilation of about 55 functions
(factory create, constructors, Do / Undo / UnPackArg, workers); five small this-adjusting
thunks that Ghidra has no function for decoded locally from their bytes. All statements
are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

`DllGetClassObject` compares the requested CLSID inline (two 8-byte compares) and builds a
`0x48`-byte class factory with a per-class vtable; that vtable's **slot 6** allocates and
constructs the task (slot 3 is a shared `CreateInstance` that calls it). Two task layouts
occur:

- **A** (most tasks): `C3DCoreBaseTask` at offset 0, `CDSCOMObject` at `+0x20`, a third
  vtable at `+0x38` whose **slot 9** is the worker that Do calls.
- **B** (`TagForDelete`, `SILoadPreset`, `CreatePreset`, `InspectExternalReference`):
  `CDSCOMObject` first, `C3DCoreBaseTask` at `+0x18`, worker vtable at object `+0x38`
  (task `+0x20`).

Task vtable slots: 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg. `0x18000e460` in the
Undo / Redo slots is the shared "not undoable" stub; `0x18008cd12` / `0x18008ccf4` /
`0x18008ccfa` are imported base-class methods (no own UnPackArg / RePackArg).

| Command(s) | Handler CLSID | Factory vtable -> create -> constructor (size) | Task vtable | Do -> worker | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `SICreateRefPlane` | `b85255a9-1c5a-11d4-b7e9-0008c7a011a6` | `0x1800a2930` -> `0x180008ba0` -> `0x18003d0c0` (0x68) | `0x1800abeb0` (A) | `0x18003d6e0` -> `0x18003d290` | `0x18003d940` | `0x18003d730` / `0x18003d710` |
| `SaveSceneAs` | `b8686985-61cf-11d5-ad17-0090275802bf` | `0x1800a2f80` -> `0x180008de0` (inline; base ctor `0x180083100`) (0x68) | `0x1800a2ea0` (A) | `0x180084ba0` (self-contained) | `0x180085820` | stub |
| `AddToTOC` | `bd02d462-9240-11d3-b4a8-009027bc38d5` | `0x1800a2658` -> `0x180007560` -> `0x180057240` (0xa8) | `0x1800af970` (A) | `0x1800575d0` (thunk) -> `0x180057430` | `0x180057810` | `0x180057610` / `0x1800575f0` |
| `Open SE on Override parent` | `bd7111d4-3ee8-11d3-9e84-00a0248f947c` | `0x1800a1c78` -> `0x180008f40` -> `0x180062d50` (0x70) | `0x1800b1400` (A) | `0x180063070` -> `0x180062ec0` | `0x180063280` | stub |
| `SetReference` | `bdc2d423-8da5-11d4-aefd-0090275ae282` | `0x1800a10a8` -> `0x180009240` -> `0x180026440` (0x110) | `0x1800a7e30` (A) | `0x1800269e0` -> `0x180026780` | `0x180027030` | `0x180026ad0` / `0x180026a60` |
| `GetCurveLength` | `c1e68290-0d3a-11d3-bc2e-00a0c9612b97` | `0x1800a1620` -> `0x180008090` -> `0x18006d5f0` (0x58) | `0x1800b32c0` (A) | `0x18006d750` (self-contained) | `0x18006d930` | stub |
| `EvaluateCurveAt` | `c54341b9-0d52-11d3-bc2e-00a0c9612b97` | `0x1800a1658` -> `0x180007cf0` -> `0x18006c9f0` (0xa8) | `0x1800b3090` (A) | `0x18006cb40` (self-contained) | `0x18006d510` | stub |
| `Event Pop-up Menu` | `ca5c1755-7e4f-4d48-8a61-f33e2a605c43` | `0x1800a1f00` -> `0x180007d30` (inline; base ctor `0x18005ff50`) (0xb0) | `0x1800a1e00` (A) | `0x180061930` -> own slot 14 `0x180061890` | `0x180061a60` | stub |
| `SISaveDuplicateXformForUndo` | `d6d73e5d-d6ea-47e1-83c0-051ce5230f99` | `0x1800a1428` -> `0x180008d60` -> `0x180024790` (0x1a8) | `0x1800a7830` (A) | `0x180024940` | none (base) | `0x180024a60` / `0x18007dc50` |
| `CopyCacheFiles2` | `d8c94826-abd7-4d76-8cf2-fa206ad224bb` | `0x1800a26c8` -> `0x1800076a0` -> `0x180074180` (0x88) | `0x1800b4a40` (A) | `0x180076120` -> `0x180075260` | `0x180076370` | stub |
| `ExportCustomFile` | `d8e1ecec-d9d0-45e8-a074-be3f73c4bc01` | `0x1800a2498` -> `0x180007e00` -> `0x180017a60` (0x80) | `0x1800a5d60` (A) | `0x180018190` -> `0x180017c80` | `0x1800182f0` | stub |
| `CreatePreset` | `d90e0a30-b0df-11d3-ae58-00a0c96e63e1` | `0x1800a1540` -> `0x1800079e0` -> `0x18006fbd0` (0x80) | `0x1800b3e60` (B) | `0x18006ffa0` -> `0x18006fd90` | `0x180070120` | `0x180070020` (both) |
| `SILoadPreset` | `d93084b1-5587-11d3-801f-00a0248f9397` | `0x1800a2508`, replaced by `0x1800a2540` -> `0x1800071a0` -> `0x180070780` (0xb8), then the object's init method | `0x1800b42f0` (B) | `0x1800716c0` -> `0x180070d50` | `0x180072550` | `0x180071d80` / `0x180071720` |
| `InspectBrowse` (Next and Previous Inspected Node) | `e33918d2-8d40-11d3-b4a4-00a02485cecb` | `0x1800a25e8` -> `0x1800084e0` -> `0x180061cb0` (0x50) | `0x1800b1030` (A) | `0x180061f10` (thunk) -> `0x180061dd0` | `0x1800620d0` | stub |
| `InspectExternalReference` | `e5b3bcb8-af83-4e7b-b288-854226695785` | `0x1800a23f0` -> `0x1800084a0` -> `0x1800224d0` (0x60) | `0x1800a6f40` (B) | `0x180022a90` (thunk) -> `0x180022660` | `0x180022c20` | `0x180070020` (both) |
| `GetKeyboardState` | `e641d1ef-0ecf-11d3-80dd-00a0c9ac19a9` | `0x1800a19d8` -> `0x180008190` -> `0x180037450` (0x50) | `0x1800aad90` (A) | `0x180037620` (thunk) -> own slot 15 `0x180037580` | none (base) | stub |
| `Force Pop-up Menu` | `e6d29635-a3a0-4d60-88e8-5e86605360cb` | `0x1800a2270` -> `0x180007ec0` (inline; base `0x18005ff50`) | `0x1800a21a0` (A) | as Event | as Event | stub |
| `SavePreset` | `ec19ceb7-b236-11d3-8d7b-00609419fcaf` | `0x1800a27a8` -> `0x180008da0` -> `0x1800725d0` (0xd0) | `0x1800b45d0` (A) | `0x180073cf0` -> `0x180072d60` | `0x180073f60` | `0x180073dc0` / `0x18007e680` |
| `TagForDelete` | `ec7663e7-2f0b-11d3-bffd-00a0248f9397` | `0x1800a1bd0` -> `0x1800093c0` -> `0x18005f9d0` (0x60) | `0x1800b0b90` (B) | `0x18005fbc0` (thunk) -> `0x18005fb40` | `0x18005fde0` | `0x18005fc10` / `0x18005fbe0` |
| `GetUserPref` | `ef512ce5-07d8-11d3-80d6-00a0c9ac19a9` | `0x1800a19a0` -> `0x180007fd0` -> `0x180036490` (0x68) | `0x1800aa810` (A) | `0x180036790` -> `0x180036640` | `0x180036900` | stub |
| `Emission Pop-up Menu` | `f036a29f-357a-4be7-bef6-16f4238cedfa` | `0x1800a2168` -> `0x180007be0` (inline; base `0x18005ff50`) | `0x1800a2050` (A) | as Event | as Event | stub |
| `SaveBackupScene` | `f2ddabc1-983c-4f6b-8998-26da7e72f47f` | `0x1800a3420` -> `0x180008d20` -> `0x180001680` (0x78; base `0x180083100`) | `0x1800a3360` (A) | `0x180084460` (self-contained) | `0x1800857a0` | stub |

The three pop-up menu tasks share every method except the per-kind collector (task vtable
slot 16): Event `0x180060b90`, Emission `0x1800607e0`, Force `0x180060dc0`.

## 2. Shared facts

### 2.1 HRESULTs and conventions

- `0x80070057` E_INVALIDARG, `0x80004003` E_POINTER, `0x80004002` E_NOINTERFACE,
  `0x80004005` E_FAIL, `0x8000ffff` E_UNEXPECTED, `0x80070005` E_ACCESSDENIED,
  `0x80004001` E_NOTIMPL, `0x80030002` STG_E_FILENOTFOUND, `0x8007000e` E_OUTOFMEMORY.
  `0x562e80c7` is the Softimage "abort / cancelled" success code that the argument readers
  propagate. Several tasks return **1** (S_FALSE) as their normal success value
  (GetUserPref, GetKeyboardState, CreatePreset, SaveSceneAs, SaveBackupScene,
  CopyCacheFiles2, pop-up with an empty list).
- Errors raised with a message use `CSIErrorHandling::Raise(hr, severity 2, id, ...)`; the
  catalogue is the command's default one unless a `DictLoadIdstring(L"XSITASKS", id)` is
  named. XSITASKS ids seen: `0x41c`, `0x41d`, `0x420`, `0x427`, `0x433`, `0x43a`, `0x43b`.
  `simsgcat` id `0x95` (SILoadPreset). Raise ids without catalogue: `0x1b`, `0x24`, `0x25`,
  `0x3b`, `0x52`, `0x3eb`. `SILogMessage` ids `0x51` and `0xa0` (ExportCustomFile). Texts not
  read.
- "First run" flag: Do receives a flag from the framework; workers record undo data only
  when it is non-zero `(inferred: non-zero on the first execution, zero on redo)`.

### 2.2 File events and custom converters

Event ids: `0x20510013` begin file export, `0x20510014` end file export, `0x20510027`
custom file export (converter lookup by extension through
`F3DFindCustomConverterEventName(0x20510027, ext, name)`), names inferred from the
SDK's `siOnBeginFileExport` / `siOnEndFileExport` / `siOnCustomFileExport` order.

## 3. Contracts

### `SICreateRefPlane`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (list, required), `Value` (return: list of created reference planes).
- UnPackArg: null exec context -> `0x80004003`; reads `InputObjs` as a list.
- Do -> worker with (list, first-run flag, address of the output list); a worker failure
  is returned, any success maps to 0.
- Worker: nothing happens (output stays empty) when the list is missing, the output
  pointer is null, or the list's "has items / valid" check (slot `0xb8`) is false. It gets
  the scene's 3D content container and, from it, a container object; for **each input
  item**: creates a new reference plane object (class created with `SICreateInstance`,
  interface `X3DObject`-like `(inferred)`), adds it to that container, creates the
  output list on first use, appends the plane to it, and creates a helper object that is
  initialised with (plane, input item) `(inferred: aligns / positions the plane on the
  input element)`.
- When the output list is non-empty and the first-run flag is set: an undo helper records
  the input list and the output list.
- Undo `0x18003d730`, Redo `0x18003d710` (not opened; inferred: delete / recreate the planes).
- Missing: what the per-item helper (class at `0x18009d108`) sets on the plane, and the
  container identity.

### `SaveSceneAs`: SPEC-PARTIAL

Wire contract:
- Args: `SceneFileName` (string, required), `CopyExtFiles` (`siExternalFilesOperation`,
  default `siDoNotCopyExtFiles` = 0).
- UnPackArg keeps the exec context; reads `CopyExtFiles` unless an internal "already
  set" flag is on; values above 2 -> `0x80070057`.
- Do (not undoable): resets the progress bar; no exec context -> raise `0x8000ffff`; no
  framework interface or no scene-file service -> `0x80004005`.
  1. If `CopyExtFiles` != 0: gets the scene's 3D content container, reads argument 0 as a
     string and runs the external-file copy helper `0x180083750` with that path and the
     mode (helper not opened).
  2. Waits until a pending-operations queue reports empty (loop on a generic object).
  3. Computes the target file name (`0x180083ae0`, not opened) and its extension; writes
     `CopyExtFiles` back into the exec context.
  4. Extension `.SCN` (case-insensitive), or `.EXP` when the application runs in the
     alternate (export / "exp") mode: calls the framework's save-scene-as entry with the
     exec context.
  5. Any other extension: looks up a custom export converter for the extension
     (`0x20510027`); none -> `0x80070057`; otherwise fires it on the current scene model
     with the file name.
  6. Result 0 -> returns 1; any other result -> raise `0x80004005` with XSITASKS `0x43a`
     composed with the file name.
- Missing: the file-name computation `0x180083ae0` and the external-file copy `0x180083750`.

### `AddToTOC`: SPEC

Wire contract:
- Args: `Source` (object, required).
- UnPackArg reads `Source` (no error check).
- Do -> worker(Source, first-run flag). Null source -> nothing.
- Worker: if the object is attached to an owner hierarchy (interface at `0x18009ded8`)
  and that owner exists and the object is not flagged as "not removable", detaches it
  from the owner and stores the owner-side name; then adds the object to the
  **TransientObjectContainer** (`F3DAddObjectToTransientObjectContainer(obj, 2)`); on the
  first run stores a soft reference for undo.
- Undo `0x180057610`: removes the object from the transient container; if a name was
  stored, re-attaches it to its owner by that name. Null source -> `0x80004003`.
- Redo `0x1800575f0`: runs the worker again with the flag 0.

### `Open SE on Override parent`: SPEC-PARTIAL

Wire contract:
- Args: `CmdID` (GUID-valued variant, vt 96), `Clsid` (GUID variant), `InspectedObjectsArray`
  (safe array of objects).
- UnPackArg: null context -> `0x80004003`; reads `Clsid`, `CmdID` (16-byte payloads kept)
  and copies the array.
- Do: empty array -> returns 1 and does nothing. Otherwise takes element 0, asks it for the
  object interface (`0x18009dd08`); missing -> `0x80004002`. Calls the worker with
  (CmdID, Clsid, object, flag 1, first-run flag).
- Worker: null object -> `0x80004003`; resolves the object's parent (slot `0x60` with the
  same interface), creates an explorer-opening task (`0x180063400`, 0x90 bytes; null ->
  `0x8007000e`), and runs it on the parent with a Scene Explorer filter
  (`C3DSEFilter`, filter id `0x19f2`, mode 10). `(inferred: opens a Scene Explorer
  focused on the parent of an override property)`.
- Missing: the internals of the explorer task `0x180063400`.

### `SetReference`: SPEC-PARTIAL

Wire contract:
- Args: `Target` (object, required), `Value` (variant, required), `Time` (frames).
- UnPackArg: `Target` read as object; missing -> `0x80070057`. The target resolves itself
  into (owner object, reference descriptor) through its method at slot `0x200`. `Value`
  read as a variant; `Time` read as a double in frames and converted to seconds.
- Do: sets an "applying" flag, calls the worker with (owner, descriptor, Value, time,
  first-run flag). Undo: clears the flag and calls the worker with the saved old value
  and flag 0. Redo `0x180026a60` (not opened; inferred: same as Do).
- Worker: null owner -> `0x80004003`; owner locked at lock level 4 -> `0x80070005`. On the
  first run (no soft reference yet): stores a soft reference to the owner and the
  descriptor; `Value` must be an array of variants (vt `0x200c`) else `0x80070057`; copies
  the new value and the current (old) value, both must be arrays. Then writes the value
  into the owner through its set method and refreshes (`0x180026330`).
- Missing: what kind of "reference" the descriptor names (owner interface methods at
  vtable index 8 and 9 were not identified).

### `GetCurveLength`: SPEC

Wire contract:
- Args: `InputObj` (object, required), `Length` (return, double, default 0).
- UnPackArg: null context -> `0x80004003`; reads `InputObj`, then asks it for its
  geometry by the primitive interface `6b579d20-3dc5-11d0-9449-00aa006d3165`.
- Do: evaluates the NURBS curve geometry at the **current time**; no curve interface ->
  `0x80004002`; else writes the curve's total length into `Length`. Not undoable.

### `EvaluateCurveAt`: SPEC

Wire contract:
- Args: `InputObj` (required), `Value` (double, default 0), `Local` (bool, default true);
  outputs `PosX..Z`, `TanX..Z`, `NorX..Z` (doubles, all reset to 0 at the start of Do).
- UnPackArg reads the three inputs (`0x562e80c7` is propagated).
- Do: gets the curve at the current time.
  - `Local` false: `Value` is a **length**; the evaluation parameter is
    `Value / totalLength` (0 when the length is below 1e-12).
  - `Local` true: `Value` is used directly as the normalised parameter.
  - Evaluates position, tangent and normal, then transforms them with the object's
    kinematic transform: position by the matrix (rotation part and translation), tangent
    and normal by the inverse-transpose of the 3x3 part (no renormalisation).
- Not undoable. Note: the binary does not use `Local` to choose local versus global
  space; the transform is always applied.

### `Event Pop-up Menu` / `Emission Pop-up Menu` / `Force Pop-up Menu`: SPEC

Wire contract (all three):
- Args: `InputObjs` (list), `EmbeddedCommand` (object, vt 13).
- UnPackArg: keeps `EmbeddedCommand`; records the foreground window and cursor position;
  if the window under the cursor is a `BUTTON`, the menu anchor becomes the button's right
  edge at one third of its height. Reads `InputObjs`; an empty list returns 1.
- Do: shared collector (slot 15 `0x1800605e0`) walks each input object's simulation
  operators (`F3DGetSimulationOps`) and passes each operator's property sub-object to the
  per-kind collector; the menu is built from the collected element references and shown
  with `TrackPopupMenu` (`TPM_RETURNCMD | TPM_RIGHTBUTTON`) at the anchor; picking item
  *n* runs `EmbeddedCommand` with `InputObjs` = item *n* (and `Keywords = "General"` when
  an internal flag is 0). Not undoable.
- Per-kind collectors accept only the two particle operator classes
  `3ee7b553-394f-11d3-...` and `71240cfd-8df9-11d3-...` (and, for Force, also
  `c41aa2c3-b58a-11d4-...`) and enumerate connected ports: Event group 6; Emission group 1
  (then group 6 for the first class); Force group 3 (particle classes) or 4 (third
  class). Other classes contribute nothing (return 1).

### `SISaveDuplicateXformForUndo`: SPEC

Wire contract:
- No args.
- Do: opens the `Preferences.Duplicate` property and reads its transform block into the
  task (transform state initialised to identity / unit scale). Undo writes that block
  back into `Preferences.Duplicate`. Redo is the generic `0x18007dc50`.
- Purpose: makes changes of the Duplicate preferences transform undoable.

### `CopyCacheFiles2`: SPEC

Wire contract:
- Args: `ObjectsToCache` (list), `SourcePath`, `TargetPath` (path templates, default ""),
  `Overwrite` (default false), `ShowProgressbar` (default true), `Version` (default "A").
- UnPackArg reads all six; failure returns the reader's error.
- Do -> worker. Empty `SourcePath` or `TargetPath` -> `0x80070057`.
- Worker: builds the cache entry list (model name, object name, start frame, frame count)
  from the objects (`0x180076730`, not opened). With `ShowProgressbar` a progress bar
  titled XSITASKS `0x433` shows "Copying cache files for <model>.<object>". For each entry
  the source and target templates are resolved with tokens `model`, `object`, `version`
  and per-frame time; an unresolved template returns `0x8000ffff`. The target directory is
  created (failure logs XSITASKS `0x420` and skips the entry). Each frame file present on
  disk is copied with `CopyFileW` (fail-if-exists when `Overwrite` is false); a missing
  source logs `0x420`. A `.pc2` source is copied once per entry. At the end, if any file
  failed or none was copied, logs XSITASKS `0x41c` and `0x41d`. Returns 1.

### `ExportCustomFile`: SPEC

Wire contract:
- Args: `FileName` (string), `Target` (list), `Frame` (time, read as a long), `UserData`
  (variant).
- UnPackArg reads all four, ignores failures, returns 0.
- Worker: takes the file extension; validates the destination (`DSValidateWriteDestination`):
  not writable -> log id `0x51`, other refusal -> log id `0xa0`, both return `0x80070057`.
  No custom converter registered for the extension -> log XSITASKS `0x427` with the
  extension, `0x80070057`. An empty `Target` uses the current scene root. Fires begin
  export (`0x20510013`); an abort (`0x562e80c7`) is returned as is. Fires the converter
  event by name with file name, `Frame` and `UserData`, then end export (`0x20510014`).
  Not undoable.

### `CreatePreset`: SPEC

Wire contract:
- Args: `Name` (string), `Family` (string), `Path` (string), `PresetObj` (return).
- UnPackArg: null context -> `0x80004003`; reads the three strings.
- Worker: null name or null output -> `0x80004003`. A non-empty `Family` is looked up
  (`SIFindFamily`); unknown -> raise id `0x3eb` with the family, return `0x80070057`.
  The preset file is `Path\Name` when `Path` is non-empty, else `Name`. Creates the preset
  object (`SICreateObjectFromPreset`) and returns it in `PresetObj`. Errors
  `0x80030002`, or `0x8000ffff` with a known family, raise id `0x1b` with the name and
  return 1; other failures are returned; success returns 1. Undo / Redo do nothing.

### `SILoadPreset`: SPEC

Wire contract:
- Args: `FileName` (string, required), `InputObj` (object, required).
- UnPackArg: both required; failure -> `0x80070057`.
- Worker (in order): when the application is in the alternate mode the first-run flag is
  forced to 0. Clears previous child tasks. Gets the object's preset family. Resolves the
  file name against the family (`0x1800723d0`); if it cannot be resolved: in batch
  (no UI) -> `0x80030002`; with UI shows message `simsgcat` `0x95` with the name, then lets
  the user pick a file (`0x180070a00`). Opens the preset, compares its class id with the
  object's: mismatch -> raise id `0x52`, `0x80070057`; no class interface -> `0x8000ffff`.
  On the first run, the current object state is saved to an in-memory `OldPresetStream`
  for undo. If the object exposes the parameter-container interface, a "save keys at
  current time" child task is created and recorded `(inferred)`. Loads the preset into
  the object through its `IPersistStream` (`00000109-0000-0000-c000-000000000046`) with
  demo-mode loading allowed; for objects whose type code is 1 or 5 a refresh is called.
- Undo `0x180071d80` restores `OldPresetStream` `(inferred)`; Redo `0x180071720`.

### `InspectBrowse` (Next Inspected Node / Previous Inspected Node): SPEC

Wire contract:
- Args: `Mode` (`siInspectBrowseMode`, default `siNext` for the "Next" entry, `siPrevious`
  for the "Previous" entry), `Length` (long, default 1).
- UnPackArg: `Mode` must be 1..4 and `Length` >= 0, else `0x80070057`.
- Worker: gets the inspection-history object (generic object query) and asks it a
  state question (slot `0x80`); when that answers non-zero it calls its slot `0x88`
  instead of browsing `(inferred: no inspection history / editor yet, open one)`; otherwise mode 1 = forward
  by `Length`, 2 = back by `Length`, 3 and 4 = jump to an end without `Length`
  `(inferred: siNext = 1, siPrevious = 2, 3 / 4 = first / last)`. Returns 0 on success.
  Not undoable.

### `InspectExternalReference`: SPEC

Wire contract:
- Args: `Target` (object, required), `Value` (return, string).
- Worker: null target -> `0x80004003`. Clears `Value`; asks the target in turn for three
  reference-holder interfaces and, from the first that answers, writes the list of
  external reference names joined with `,` into `Value`. None answers -> `0x80070057`.
  Undo / Redo do nothing.

### `GetKeyboardState`: SPEC

Wire contract:
- Args: `KeyCode` (return, long, default 0), `Shift` (return, long, default 0).
- Do: Win32 `GetKeyboardState`; failure -> `0x80004005`. `Shift` = bit 1 Shift, bit 2
  Ctrl, bit 4 Alt (high bit of the virtual key states `0x10`, `0x11`, `0x12`).
  `KeyCode` is **never written** (stays 0). Returns 1.

### `SavePreset`: SPEC

Wire contract:
- Args: `InputObj` (required), `PresetName` (required), `PresetPath`, `PresetLocation`
  (`siPresetLocation`, default `siDefaultLocation`), `Overwrite` (default true),
  `CreateThumbnail` (default true), `Description`, `Value` (return: the preset object).
- UnPackArg: any failure of the required reads -> `0x80070057`.
- Worker: if the object belongs to a shader-like container, the parameter source at the
  current time replaces it `(inferred)`. Gets the object's family; unless it is the
  generic family `e7dd086c-d433-11d0-...`, the family's favourite preset folder is used as
  a sub-folder. The file base name comes from `PresetName` (its own directory is kept if
  it exists). If no full path results and `PresetPath` is given: a relative path -> raise
  id `0x25`, `0x80070057`; an absolute path is created if missing and the file becomes
  `PresetPath\<name>.Preset`. Otherwise the folder is chosen from `PresetLocation`:
  0 or 1 -> install path type 3, 2 -> type 1, 3 -> the workgroup path (empty -> stop),
  4 -> type 0; then `<root>\Data\DSPresets\<family folder>\<name>.Preset` (folders
  created). An existing file with `Overwrite` false -> raise id `0x3b`,
  `0x80070005`. Writes the preset (class id of the object, optional thumbnail from the
  viewport, optional description) and returns it in `Value`. On the first run, path,
  thumbnail flag and description are kept for undo.
- Undo `0x180073dc0` (inferred: deletes / restores the written file).

### `TagForDelete`: SPEC

Wire contract:
- Args: `InputObjs` (list).
- UnPackArg copies the list's items into the task's own list; returns 1.
- Do: stores the first-run flag; flag 0 -> `0x8000ffff`; otherwise keeps the list.
- Undo: flag 0 -> `0x8000ffff`; on the first undo creates a delete task for the tagged
  objects, runs it and keeps it as a child; later undos redo that child.
  So undoing the enclosing operation deletes the tagged objects.

### `GetUserPref`: SPEC

Wire contract:
- Args: `Target` (preference name, string), `Value` (return, variant).
- UnPackArg: `Target` must be a string variant else `0x80070057`; an empty string keeps
  no name.
- Worker: no name or no output -> `0x80004003`. The name is remapped for legacy names
  (`SIRemapUserPref`); the value is read from the preferences manager, else from the
  ambient values manager, else from the CPM helper with the original name; total failure
  returns that error. Success copies the value into `Value` and returns 1.

### `SaveBackupScene`: SPEC

Wire contract:
- Args: `SceneFileName` (string, default "").
- UnPackArg: an empty `SceneFileName` is replaced by preference
  `data_management.manual_backup_project_path`.
- Do: still empty -> raise id `0x24`, `0x80004005`. The path is normalised; it must lie in
  a project (project manager answer 1) else raise id `0x24`, `0x80004005`. Without an
  extension the file becomes `<project>\Backup_Manual\<scene name>_BackupNN<ext>` with
  NN = 01, 02, ... the first name that does not exist; ext `.scn`, or `.exp` in the
  alternate mode (a given `.SCN` is also turned into `.exp` in that mode). The final name
  is written back to `SceneFileName`; `.scn` / `.exp` / no extension saves through the
  framework's save entry; other extensions use a custom export converter (none ->
  `0x80070057`). Failure raises XSITASKS `0x43b` with the name, `0x80004005`; success
  returns 1. Not undoable.

## Open questions

1. `siInspectBrowseMode` and `siPresetLocation` numeric names (binary reads 1..4 and 0..4).
2. SaveSceneAs file-name builder `0x180083ae0` and external-file copy `0x180083750`.
3. SetReference: identity of the reference descriptor (owner slot `0x200`).
4. SICreateRefPlane per-plane helper class (`0x18009d108`).
5. EvaluateCurveAt `Local` meaning (binary: length versus normalised parameter).
6. XSITASKS message texts for the ids listed in section 2.1.
