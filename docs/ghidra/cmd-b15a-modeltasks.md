# CMD-B15a: model, scene-merge, import/export, ref-model and delta commands read from `modeltasks.dll` (SICreateModel, SIMergeScene, SIImportModel, SIGetModel, SIImportIges, SIExportIges, ImportMixer/MergeMixer, SIImportMatLib/SIImportReferencedMatLib, ExportMaterialLibrary, Get/SetLightListOnModelClip, SISetResolutionOfRefModels, Add/RemoveRefModelResolution, SICreateRefModel/CreateEmptyRefModel, ApplyDelta, ImportDelta/ImportReferencedDelta)

Row: **CMD-B15a**. Status: **SPEC** (19 names), **SPEC-PARTIAL** (3 names: `SIMergeScene`, `ImportDelta`,
`ImportReferencedDelta`; see each section),
**not implemented in `modeltasks.dll`** (3 names: `Add3DObjectToScene`, `SIAddImageSource`, `SIAddImageClip`; see 2).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\modeltasks.dll`, image base `0x180000000`,
sha256 `108bbbdf94c407f1929e0bcc22ed1e49e97f97ff17d5681ee41cdcf00d4127ad` (PDB `modeltasks.pdb`, not loaded).
Method: Ghidra decompilation of `DllGetClassObject` (`0x18003df20`) to list the CLSIDs served; `read_bytes` of
the 25 factory vtables (`0x180050e00` + 0x38·n, 7 slots, slot 6 = create), of each task vtable (primary at +0,
`CDSCOMObject` vtable at +0x20, worker vtable at +0x38) and of the GUID table `0x18004f700…0x180050300` (matched
against `data/command_registry.json`); decompilation of create, constructor, UnPackArg (task slot 8), Do (task
slot 5) and the worker each Do forwards to. Four Do slots are 3-instruction register stubs (no Ghidra function);
they were decoded from their bytes. The big file loaders (merge scene, model import, mixer, IGES, matlib) were read
only far enough to state the command contract. Arguments/defaults from `data/command_registry.json`.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All task objects have the common shape: `C3DCoreBaseTask` at +0, `CDSCOMObject` at +0x20, worker vtable at +0x38
(some also a second interface at +0x40/+0x48). Do (task slot 5) forwards to worker slot 9 (offset 0x48) unless noted.

| Command | CLSID | Factory vtable | Create (slot 6) | Constructor (size) | Do (slot 5) | Worker | UnPackArg (slot 8) |
|---|---|---|---|---|---|---|---|
| `SICreateModel` | `bcb70445-0a0d-11d3-ac82-00a02485cecb` | `0x180050e00` | `0x18003d870` | `0x180009060` (0xd0) | `0x18000a190` | `0x180009bd0` | `0x18000a840` |
| `SIMergeScene` | `81ab7cd1-2262-11d3-b949-00a024c78ee3` | `0x180050e38` | `0x18003dcb0` | `0x18002d6c0` (0x108) | `0x180032320` | `0x18002df80` | `0x180035b30` |
| `SIImportModel` | `dafd4082-7c00-11d3-8907-00a024ee6238` | `0x180050ea8` | `0x18003dc30` | `0x18001f480` (0x140) | `0x180023eb0` | `0x180023ab0` → core `0x180020150` | `0x1800284b0` |
| `SIGetModel` | `5b56d822-93da-11d3-acaf-0090275802bf` | `0x180050fc0` | `0x18003dab0` | `0x180015780` (0x58) | stub `0x180016690` (shared) | `0x1800160c0` (reducer `0x180015ad0`) | `0x1800167e0` |
| `SIImportIges` | `1579fa20-95f0-11d3-a9a6-009027bc65d7` | `0x180050f50` | `0x18003db70` | `0x180019690` (0x70) | `0x18001a2a0` | `0x180019c90` | `0x18001a430` |
| `SIExportIges` | `4b30f510-9d36-11d3-a9a9-009027bc65d7` | `0x180050f88` | `0x18003d970` | `0x18000e250` (0x78) | `0x18000f030` | `0x18000e980` | `0x18000f310` |
| `ImportMixer`, `MergeMixer` | `201be048-35d4-11d6-92de-009027219f81` | `0x180051068` | `0x18003dbf0` | `0x18001bec0` (0x78) | `0x18001db00` → worker **slot 10** | `0x18001d850` (slot 10) → `0x18001cd40` (slot 9) | `0x18001dd70` |
| `SIImportMatLib`, `SIImportReferencedMatLib` | `d46667ad-4d3c-4f57-b3d1-6872c37cbf1f` | `0x180051110` | `0x18003dbb0` | `0x18001a580` (0x70) | `0x18001bae0` | `0x18001ad60` | `0x18001bd40` |
| `ExportMaterialLibrary` | `200bfe4d-e316-4464-a9a5-fde08f290898` | `0x180051148` | `0x18003d9b0` | `0x18000f900` (0x78) | `0x180010760` | `0x1800103c0` | `0x180010970` |
| `GetLightListOnModelClip` | `ae697746-da60-44d3-a9fe-1895286de460` | `0x1800511b8` | `0x18003da70` | `0x1800150b0` (0x60) | stub `0x180016690` (shared) | `0x180015240` | `0x1800152e0` |
| `SetLightListOnModelClip` | `e10a6971-7a7b-4021-9239-3508fdede180` | `0x180051180` | `0x18003dd70` | `0x18003a5c0` (0xb8) | stub `0x18003a8e0` | `0x18003a7d0` | `0x18003aaa0` |
| `SISetResolutionOfRefModels` | `50f25519-a047-40be-ae15-ea3d37f78a94` | `0x1800510d8` | `0x18003ddb0` | `0x18003ab70` (0x70) | stub `0x18003b580` | `0x18003add0` | `0x18003ba50` |
| `AddRefModelResolution`, `RemoveRefModelResolution` | `978d84be-44e7-46b3-9785-415106fcb43c` | `0x1800511f0` | `0x18003d7b0` | `0x1800010a0` (0xc8) | `0x1800015d0` | `0x1800012d0` | `0x180001940` |
| `SICreateRefModel`, `CreateEmptyRefModel` | `4e948e41-64da-4723-a8dd-6b03c4193f4a` | `0x180051228` | `0x18003d8b0` | `0x18000ad60` (0xf8) | `0x18000bbb0` | `0x18000b6a0` | `0x18000bf60` |
| `ApplyDelta` | `11bcdc3d-c2f3-42a6-a2d5-cf7e77bcd01b` | `0x180051298` | `0x18003d7f0` | `0x180001a10` (0x50) | stub `0x180001d90` | `0x180001b60` | `0x180001e60` |
| `ImportDelta`, `ImportReferencedDelta` | `988b8420-adef-4e60-8b16-b20872edaabe` | `0x1800512d0` | `0x18003daf0` | `0x1800168e0` (0x80) | `0x1800179d0` | `0x180017140` | `0x180017c40` |

Stub decoding: `0x180016690` passes (task+0x48 object, address of task+0x50 out slot); `0x18003b580` passes
(task+0x48 Target list, task+0x50 Resolution, undo flag); `0x18003a8e0` passes (task+0x48 clip, address of the
LightList string at task+0x50, undo flag); `0x180001d90` passes only (task+0x48 Deltas list), no undo flag.

## 2. Shared facts

- **Dispatch.** `DllGetClassObject` compares 25 CLSIDs inline (two 8-byte compares each); unknown → `0x80040111`
  (CLASS_E_CLASSNOTAVAILABLE), null `ppv` → `0x80004003`. Besides the rows above the chain also serves
  `ExportModel` (`4e8acff0-…`, factory `0x180050e70`), `SIImportDotXSIFile` (`25dca0f7-…`), `SIExportDotXSIFile`
  (`c73a9270-…`), `ExportMixer` (`a742f55c-…`), `ReconnectModel` (`542ad70a-…`), `ConvertToRefModel`
  (`37c72455-…`), `ExportDelta` (`f28379fb-…`) and two CLSIDs that are not in the registry:
  `990e7241-6266-11d4-b98d-009027bc3e07` (factory `0x180050ff8`) and `d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b`
  (factory `0x180051340`, last in the chain).
- **SICreateModel is here.** Its CLSID is `bcb70445-0a0d-11d3-ac82-00a02485cecb` (mapped in COMMAND_DLL_MAP, first
  entry of the chain).
- **Not implemented here.** `Add3DObjectToScene` (`a0d59008-…`), `SIAddImageSource` (`0f42cf75-…`) and
  `SIAddImageClip` (`eef8d702-…`) are **not in the compare chain**. Their CLSIDs occur only as data in the GUID table
  (`0x1800501c8`, `0x18004f828`, `0x18004f848`): `Add3DObjectToScene` is created as a sub-task by `SICreateModel` and
  `SIMergeScene`. Registry candidates: `Add3DObjectToScene` → `tasks.dll`, `_3dobject2.dll`, `scnmgr.dll`,
  `sicoresdk.dll` (`primtasks.dll` only uses it as a sub-task, batch 8e); `SIAddImageSource` / `SIAddImageClip` →
  `imageclip.dll`, `shaderhelper.dll` (`shadertasks.dll` excluded in batch 12).
- **Sub-tasks used** (CLSIDs from the GUID table; created with `SICreateInstance`, run through worker slot 9,
  added to the undo record with `AddTask` only when undo is on and the sub-task returned S_OK):
  `SICreateModel` (`bcb70445`), `Add3DObjectToScene` (`a0d59008`), `ParentObj` (`90e7afe3`), `AddGroup`
  (`06af33ae`), `DeleteObj` (`dd531990`), `CreateLibrary` (`00f3ee76`), `ExportModel` (`4e8acff0`).
- **Licence / mode gate.** Many workers ask the app-mode object (`SIGetAppMode`, its slot 0x50) and react when it
  is set (inferred: a restricted / non-commercial mode). Two behaviours: (a) IGES export, model-delta import and
  matlib export raise `0x80004021` with `simsgcat` message 0x143 (matlib export shows it in a message box instead);
  (b) the ref-model commands (`SISetResolutionOfRefModels`, `Add/RemoveRefModelResolution`, `SICreateRefModel`,
  `ApplyDelta`, `ImportDelta`) check a licence feature bit 0x40 on the generic license object
  (`b54dca74-e452-11d1-8873-00a024ee6238`) and, if missing, print `XSIMODELTASKS` string 0x17 to stderr and return
  without doing anything.
- **File events** fired around file I/O (`F3DFireFileEvent`): 0x20510015 before import / 0x20510016 after import,
  0x20510013 before export / 0x20510014 after export. A handler answering `0x562e80c7` (user-abort) cancels the
  command and that value is returned. File kinds: 0x19 IGES, 0x18 mixer, 0x16 material library, 2 model.
- **Error raises** use severity 2 and `CSIErrorHandling::Raise(hr, 2, msgId[, text])` from the task's
  `XSIMODELTASKS` dictionary (texts not in the repo). IDs seen: 0x13 (warning, logged severity 4), 0x14, 0x17, 0x1c,
  0x33 (invalid/unsupported file, with the file name), 0x38, 0x51, 0xa0, 0x11c.
- Model creation primitive: `SICreate3DModelObject(name, model IID 3ded5562-0bb6-11d3-ac82-00a02485cecb)`; models
  created by loaders use class `0496eab0-0ecf-11d1-abf1-00a02485cecb`.

## 3. Contracts

### `SICreateModel`: SPEC

Args (registry): `InputObj` (list, may be empty), `Name` (default `"Model"`), `Parent` (object, optional),
`Value` (out, the new model).
- UnPackArg reads `InputObj` as a list, `Name` as a string, and `Parent` (resolved to its 3D object interface).
- Do calls the worker with (input list, name, parent, **add-to-scene = 1**, undo flag, out model).
- Worker, in order:
  1. Forces a graph update.
  2. If an input list is given it is filtered (`0x18000a9c0`): an empty list is used as is. Otherwise each item is
     classified: 3D objects that are skeleton elements of kind 2 or 3 (inferred: effectors / chain roots) are
     dropped; objects whose parent differs from the first kept object's parent are dropped; groups (item kind 8)
     go to a separate group list; any other kind is dropped. Any drop makes the result 1 → warning message 0x13
     (severity 4) and the command continues. If the explicit `Parent` is one of the objects or a descendant of one,
     or nothing remains in either list → `0x80070057`; a filter failure raises message 0x14 and returns the error.
  3. Creates the model with `Name`.
  4. If no `Parent` was given: with exactly one kept object, the parent becomes that object's current parent; else
     with exactly one group, the parent becomes the group's owning model.
  5. Runs `Add3DObjectToScene` with a one-item list {model} under the parent (scene root when none, inferred).
  6. If objects remain: runs `ParentObj` (model, objects) so they become children of the model, then moves the
     model to the average global position of the objects (kinematics read through
     `783879e2-…`/`d557cf36-…`; while doing so the preference
     `xsiprivate.SI3D_NODETRANSFORM_CHILD_COMPENSATE` is set to 1 and restored after, so children keep their global
     pose). The averaging is skipped as soon as an object fails the `SIIsAnimated` test (inferred polarity).
  7. If exactly one group was given: runs `AddGroup` (model, group list) to move the group into the model.
  8. With undo on, stores a soft reference to the model and its name (for redo).
- Returns S_OK; `Value` = the new model.

Wire contract: `SICreateModel(InputObj?, Name="Model", Parent?) -> Value(model)`; sub-tasks
`Add3DObjectToScene`, `ParentObj`, `AddGroup` recorded for undo.

### `SIMergeScene`: SPEC-PARTIAL (scene file reader not read)

Args: `FileName` (required), `Name` (default ""), `Parent`, `ShareOptions` (long; registry default string
`:siImportShareOptionsAll:siImportShareOptions`, constructor default 0xffff), `CreatedObj` (out).
- UnPackArg: missing `FileName` → `0x80070057`. Do calls the worker (file, parent, name, share options, out).
- Worker: null file → `0x80004003`. The file must pass `SIValidateFile` (in the restricted mode also as `.exp`);
  otherwise raise `0x80070057` / message 0x33 with the file name. Extensions other than `.scn` (and `.exp` in that
  mode) go to a registered custom converter (`F3DFindCustomConverterEventName(0x20510026, ext)`).
- `.scn`: opens the scene storage, honours student-version files, reads `TLShell`, `Scene.Root`, `Version`; a
  stream named `Invalid_Scene` present → error box (`simsgcat` 0x68) and `0x80004005`. A newer-feature-version
  file asks a Yes/No question before continuing.
- Model name = `Name`, or the file's base name when empty; checked with `SIValidateUniqueNameSyntax`. A new model
  (class `0496eab0-…`) receives the merged Objects, Groups, Layers, Passes, Environments, Sources, Clips,
  ParTypes, Shader Definitions and camera-sequencer shots (progress captions "Merging …"); external references are
  connected; `Add3DObjectToScene` puts the model under `Parent`.
- Returns `CreatedObj` = the new model.
Missing: the per-section merge rules and how `ShareOptions` is applied.

### `SIImportModel`: SPEC

Args: `FileName` (required), `Parent`, `Value` (out model), `Name` (default ""), `ShareOptions` (default 0;
constructor default 0xffff).
- UnPackArg: `FileName` failure propagated. Worker gets (file, out, name, parent, share options, 0, undo).
- Null out pointer → `0x80004003`.
- Not a valid `.emdl`: file missing → raise `0x80070057` / 0x17; `.xsi` extension → raise `0x80070057` / 0x33
  (dotXSI goes through `SIImportDotXSIFile`, inferred); other extension → custom converter for that extension; none
  registered → log error (`XSIMODELTASKS` 0x15 with the extension) and raise `0x80070057` / 0x33. With a converter:
  if no model was supplied, an empty model is made by an `SICreateModel` sub-task (no inputs, converter-supplied
  name, `Parent`, add-to-scene, undo) and recorded; then file events 0x20510015 / converter / 0x20510016.
- `.emdl`: opens the storage; in the restricted mode a non-compatible file → raise `0x80070057` / 0x33. Name =
  `Name` or the stored model name, made unique; the model is created (class `0496eab0-…`), loaded and put under
  `Parent`; `ShareOptions` is kept on the task; the recent-models menu is updated.
- Returns `Value` = the imported model.

Wire contract: `SIImportModel(FileName, Parent?, Name="", ShareOptions=0) -> Value(model)`.

### `SIGetModel`: SPEC

Args: `InputObjs` (list), `Value` (out).
- Null list or out → `0x80004003`. Empty list → `Value` = the scene root model.
- Otherwise each item is replaced by its first primary owner model (an action item uses its primary model for
  actions); the set of models is then reduced: a model that is a descendant of another in the set is dropped; if
  more than one unrelated model remains, the step repeats on their owner models, so the result is the closest
  common owning model (inferred: reaches the scene root in the worst case). An empty result raises
  `0x80004005` / message 0x38.
- Returns `Value` = that single model.

### `SIImportIges`: SPEC (IGES reader not read)

Args: `FileName` (required, string), `Parent`, `Value` (out).
- UnPackArg: `FileName` not a string → `0x80070057`.
- Worker: the file must validate against filter `Iges Files (*.iges;*.igs)|*.iges;*.igs|`, else raise
  `0x80070057` / 0x33. Fires 0x20510015 (kind 0x19). Creates an empty model through an `SICreateModel` sub-task
  (no inputs, default name, `Parent`, add-to-scene, no undo), then the IGES translator (`8daff220-8e4c-11d3-a9a5-
  009027bc65d7`) reads the file into it, with property propagation suspended. Fires 0x20510016.
- `Value` = the created model (inferred from the out slot passed by Do).

### `SIExportIges`: SPEC (IGES writer not read)

Args: `InputObjs` (list), `FileName` (required, string).
- Restricted mode → raise `0x80004021` (simsgcat 0x143), both in UnPackArg and Do.
- UnPackArg: `FileName` not a string → `0x80070057`.
- Worker: fires 0x20510013 (kind 0x19); destination checked with `DSValidateWriteDestination`: folder not
  writable → raise `0x80070057` / 0x51, file not writable → raise `0x80070057` / 0xa0. Exports the inputs, or the
  whole scene when the list is empty, through the IGES translator at the current time; fires 0x20510014.
- Any failure in Do → raise `0x80070057` / 0x1c. No return value.

### `ImportMixer` / `MergeMixer`: SPEC (mixer stream reader not read)

Args: `FileName` (required, string), `Parent` (model), `Merge` (`ImportMixer` default False, `MergeMixer` default
True), `Value` (out).
- UnPackArg: `FileName` not a string → `0x80070057`. The target model is `Parent` if it is a model, else the model
  owning `Parent`; with no `Parent`, the model of a default object (`fe2c4320-…` argument handler, inferred: the
  selection). No model → raise `0x80070057` / 0x1c.
- Do calls worker slot 10: the file must validate as `.xsimixer`, else raise `0x80070057` / 0x33; fires 0x20510015
  (kind 0x18); opens the storage, loads its content dependencies, opens stream `Contents` and calls slot 9 with
  (stream, model, merge, out, undo); on success fires 0x20510016.
- Slot 9: null stream/model → `0x80004003`. When `Merge` is false the model's existing mixer content is removed
  first with a `DeleteObj` sub-task; the mixer data is read into the model's NLE container ("Importing Mixer…");
  `Value` = the model's mixer.

### `SIImportMatLib` / `SIImportReferencedMatLib`: SPEC

Args: `FileName` (required), `ShareOptions` (`SIImportMatLib` default 0, `SIImportReferencedMatLib` fixed 1;
any non-zero = referenced), `Value` (out library).
- Worker: empty file name → `0x80070057`. The path is resolved; a missing file logs warning `XSIMODELTASKS` 0x16
  and returns `0x80070057`. The extension must be `.xsi` or `.xsiml`; then `SIValidateFile`, else raise
  `0x80070057` / 0x11c. Fires 0x20510015 (kind 0x16).
- A new library is created with a `CreateLibrary` sub-task (temporary name `___Default___`, recorded for undo) unless
  one was supplied, and made the current material library. For `.xsi` files the dotXSI header
  (`xsi 0300txt 0032`, `xsi 0350txt 0032`, …) is checked. The content is loaded by running the
  `CrosswalkImportMatLib` command (`Filename`, `MatLib`); referenced mode marks the library as referenced to the
  file. Image sources with bad paths log "Library source %s has an invalid filename: %s".
- Returns `Value` = the library.

### `ExportMaterialLibrary`: SPEC

Args: `FileName` (required), `InputObjs` (library; default = the current material library),
`ExportUsedImageClipsOnly` (default True).
- Restricted mode → message box (simsgcat 0x143) and `0x80004021`.
- Fires 0x20510013 (kind 0x16). Extension must be `.xsi` or `.xsiml`, else raise `0x80070057` / 0x33; the
  destination must validate, else raise `0x80070057` / 0x11c.
- Runs `CrosswalkExportMatLib` with `Filename`, `MatLib` (the library's full name), `Binary` = false (always, from
  Do) and `ExportUsedImageClipsOnly`; fires 0x20510014.

### `GetLightListOnModelClip`: SPEC

Args: `ModelClip` (model clip, interface `beb79841-30cb-11d4-b982-009027bc3e07`), `Value` (out string).
- Reads the clip's light-list string and returns it. Null clip/out → `0x80004003`. Not undoable.

### `SetLightListOnModelClip`: SPEC

Args: `ModelClip`, `LightList` (string, default "").
- Null → `0x80004003`. With undo on, saves the previous light list and a soft reference to the clip; then sets the
  clip's light list to `LightList`.

### `SISetResolutionOfRefModels`: SPEC

Args: `Target` (list), `Resolution` (ULONG, default 0).
- Gate (b) of 2. Null list → `0x80004003`. For each target that is a referenced model (ref-model interface
  `851df6a6-a956-4c99-80ea-6ba13ecd8ffa`): with undo on, remembers the current active resolution. `Resolution` 0
  (offloaded) is always applied. Any other index is applied only if that resolution exists and is usable (its
  check returns 0; inferred: file present); otherwise the model is skipped and its undo record dropped.
- After the loop every changed model is updated / reloaded (inferred), with overrides deactivated. Returns S_OK.

### `AddRefModelResolution` / `RemoveRefModelResolution`: SPEC

Args: `Model`, `ResolutionName`, `FileName` (Add only), `Add` (Add default True, Remove default False),
`Confirm` (Remove only, default True).
- UnPackArg: when `Add` is false and `ResolutionName` is missing → `0x80070057`.
- Gate (b). Add: appends a resolution (`FileName` resolved as a file path, `ResolutionName`). Remove: looks the
  name up; nothing happens if it is not found, is resolution 0 (offloaded) or is the active resolution; otherwise it
  is removed. With undo on, the name / file and a soft reference to the model are kept. `Confirm` is passed to the
  worker but no use was seen (inferred: UI prompt only).

### `SICreateRefModel` / `CreateEmptyRefModel`: SPEC

Args: `FileName`, `ModelName`, `ResolutionName`, `Parent`, `Activate` (default True / False for the empty
variant), `CreateFile` (default False; missing → 0), `ExternalCnxMappingTemplate` (missing → empty),
`ShareOptions` (default 0xffff), `Value` (out).
- Gate (b). A URL `FileName` is downloaded first.
- Non-empty `FileName`: resolved to a file path; a missing file logs warning `XSIMODELTASKS` 0x16 and continues.
- Name = `ModelName`, else the file's base name, else `RefModel`.
- Creates the model with an `SICreateModel` sub-task (no inputs, name, `Parent`, add-to-scene, undo; recorded);
  `Value` = model.
- If `CreateFile` is set and the file does not exist: creates the folders and writes the empty model to the file
  with an `ExportModel` sub-task.
- Sets `ShareOptions` on the model, marks it referenced, adds resolution (`ResolutionName`, file) and, if
  `Activate` and the file exists, makes resolution 1 active and loads it.
- `ExternalCnxMappingTemplate` is passed to the worker but no use was seen.

### `ApplyDelta`: SPEC

Args: `Deltas` (list).
- Gate (b). For each item exposing the delta interface (`b3d3504b-6be9-4bce-8ef1-11027af24d51`), its ref model is
  put in "applying" state (flag 2 set), the delta is applied to the model (all items, all types), and the state is
  cleared. No undo parameter. Returns S_OK.

### `ImportDelta` / `ImportReferencedDelta`: SPEC-PARTIAL (exact replace / backup choice)

Args: `FileName` (required), `Model` (required), `Reference` (`ImportDelta` default False,
`ImportReferencedDelta` True), `Interactive` (default True), `Value` (out delta).
- Restricted mode → raise `0x80004021`. UnPackArg: empty `FileName` or missing `Model` → `0x80070057`.
- Gate (b). Null model → returns. `FileName` `non$existent.delta` or empty means "no file"; a missing file logs
  warning 0x16.
- Only acts when the model is a locked referenced model with a ref-model head. Finds the model's existing delta;
  if one exists and `Interactive` is on with a UI, asks a Yes/No/Cancel question (`XSIMODELTASKS` 0x10 / 0x11):
  Cancel aborts, Yes keeps the old delta under its name plus `_BACKUP` and creates a new one, No / batch creates a
  new one (inferred).
- Sets the delta's file parameter (id 0xd) to `FileName`, a mode parameter (id 0xc) to 3, and its target path
  (id 2); when the file exists the delta is loaded from it (ambient flag `referencing.importingdelta` set during
  load). When `Reference` is false, parameter 0xc is reset to 0 (the delta is copied, not referenced). The delta
  is applied. `Value` = the delta.
Missing: which choice maps to Yes vs No in the replace prompt is inferred.

### `Add3DObjectToScene`, `SIAddImageSource`, `SIAddImageClip`: not in this DLL

See 2. CLSIDs absent from the `DllGetClassObject` chain; contracts remain open (row for `imageclip.dll` /
`shaderhelper.dll`, and for `tasks.dll` / `_3dobject2.dll` / `scnmgr.dll` / `sicoresdk.dll`).

## 4. Open questions

1. Handlers of `Add3DObjectToScene`, `SIAddImageSource`, `SIAddImageClip` (other DLLs, see 2).
2. `SIMergeScene` section-by-section merge rules and `ShareOptions` semantics.
3. Meaning of the restricted app mode (`SIGetAppMode` slot 0x50) and licence bit 0x40.
4. Commands behind CLSIDs `990e7241-6266-11d4-b98d-009027bc3e07` and `d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b`
   (served here, not in the registry).
5. `XSIMODELTASKS` message texts (ids 0x10–0x17, 0x1c, 0x33, 0x38, 0x51, 0xa0, 0x11c).
