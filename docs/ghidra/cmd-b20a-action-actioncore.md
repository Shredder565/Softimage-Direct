# CMD-B20a: action.dll / actioncore.dll mixer and action commands (EqualizeAction, ExportAction, ImportRefAction, ReplaceShapeKey, SIStoreAction, AddTransition, AddMarker, ReconnectMixer, SwapRelationMasterAndSlaveClip + handler confirmations)

Row: **CMD-B20a** (closes CMD-B19-NEXT for these nine names). Status over the 29 names below:
**SPEC** 9, **SPEC-PARTIAL** 19, **LOCK** 1 (`AddCustomOp`, not in action.dll). Five handler-DLL corrections
(§2.1): `AddTransition`, `AddClip`, `CopyClipToTrack`, `CreateCompound`, `AddMarker` are served by actioncore.dll.
Run: 2026-11-21, si-analyst batch 20 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, each closed afterwards):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\action.dll`, image base `0x180000000`, sha256
  `71769ec1ceb40c1d2c46b810af8284f18f1dab8317361beac5c8efcf7ce85f86` (same build as CMD-B11e/f/g).
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\actioncore.dll`, image base `0x180000000`, sha256
  `c3976b5d3ef05eed9ef9d0721d48936800c38aa75eddbdafa5e694e8b483f75d` (same build as CMD-B16e).
- `fcurve.dll` was not reopened: CMD-B8 already recorded that it holds the `AddMarker` CLSID only as a caller; the
  handler is in actioncore (confirmed below).

Method: `DllGetClassObject` assembly of each DLL was parsed (pairs of 64-bit compares → the factory vtable stored
into the new 0x48-byte factory); factory slot 6 = create; create → constructor (size) → task vtable at object
`+0x18` and worker vtable at task `+0x70` (actioncore) / `+0x78` (action.dll). Task slots: 5 Do, 6 Undo, 7 Redo,
8 UnPackArg, 9 RePackArg; worker slot 9 does the work. UnPackArg, Do and the worker were decompiled for the nine
required commands; UnPackArg (argument list) for the confirmations. CLSID tables: action.dll handler GUIDs
`0x180135268…0x180135838` (74 compares), action.dll sub-task GUID table `0x180136cb8…0x180136d18`;
actioncore handler GUIDs `0x18006bfd0…0x18006c350`. Statements are behaviour read from the binary unless marked
`(inferred)`.

## 1. Handler table

| Command | scripting name | DLL | Handler (CLSID short, factory vtable → create (size), task vtable: Do / UnPack / RePack, worker) | Status |
|---|---|---|---|---|
| Equalize Action | `EqualizeAction` | action | `03819cd3…` fvt `0x180127610` → `0x1800a3400` → ctor `0x180036b70` (0x128); tvt `0x1801198b0` Do `0x180039020` / Unpack `0x18003a2a0` / RePack `0x1800398e0`; worker `0x180036ec0`; band filter `0x1800393e0`, mixer builder `0x180039a50` | SPEC-PARTIAL |
| Export Action | `ExportAction` | action | `12a3efd1…` fvt `0x180126e30` → `0x1800a3440` → `0x18003a460` (0xd0); tvt `0x180119e40` Do `0x18003acc0` / Unpack `0x18003b090` / RePack `0x18003afb0`; worker slot 9 `0x18003acb0` (returns E_FAIL), slot 10 `0x18003a670` (real export) | SPEC |
| Import Referenced Action | `ImportRefAction` | action | `12a3efcf…` (shared with `ImportAction`, `LoadActionPreset`) fvt `0x180126dc0` → `0x1800a35c0` → `0x18003e6e0` (0x128); tvt `0x18011abd0` Do `0x180040c10` / Unpack `0x180041150` / RePack `0x180041060`; worker `0x18003f510` | SPEC-PARTIAL |
| Replace Shape Key | `ReplaceShapeKey` | action | `eaa03725…` fvt `0x1801272c8` → `0x1800a3a40` → `0x180058250` (0x100); tvt `0x18011cc30` Do `0x180058ff0` (no Ghidra function) / Unpack `0x1800594a0` / RePack `0x180059370`; worker `0x180058470` | SPEC-PARTIAL |
| Store Action (low level) | `SIStoreAction` | action | `12a3efcd…` (shared with `GetStoreActionDefaults`) fvt `0x180126d18` → `0x1800a3d80` → `0x180062cd0` (0x178); tvt `0x18011e2c0` Do `0x1800652d0` / Unpack `0x180066c70` / RePack `0x180066a70`; worker `0x180063c90` | SPEC-PARTIAL |
| Add Transition | `AddTransition` | **actioncore** | `c030ada0…` fvt `0x180066bc8` → `0x180003ae0` → `0x1800451d0` (0x198); tvt `0x18008bcd0` Do `0x1800469b0` / Unpack `0x180046cd0` / RePack `0x180046bb0`; worker `0x180045e90`; helpers `0x180045b80` (existing transitions), `0x180045550` (set-up) | SPEC-PARTIAL |
| Add Marker | `AddMarker` | **actioncore** | `f4a11b4a…` fvt `0x180066b90` → `0x180003a20` → `0x18003f4e0` (0x148); tvt `0x18008a220` Do `0x18003fd50` / Unpack `0x180040080` / RePack `0x18003ff90`; worker `0x18003f7d0` | SPEC |
| Reconnect Mixer | `ReconnectMixer` | actioncore | `c976d03e…` fvt `0x180066d88` → `0x180004160` → `0x180059370` (0xa8); tvt `0x180090550` Do `0x180059770` / Unpack `0x180059920`; Undo = Redo = `0x180008000`; worker (at object `+0x90`, vtable `0x1800905e0`) slot 9 `0x180059630` (mixer), slot 10 `0x180059670` (model) | SPEC-PARTIAL |
| Swap Relation Master and Slave | `SwapRelationMasterAndSlaveClip` | actioncore | `7aabbe2d…` fvt `0x180066dc0` → `0x1800042e0` → `0x180059f20` (0xe8); tvt `0x1800915b0` Do `0x18005a2e0` / Unpack `0x18005a440`; Undo = Redo `0x18005a300`; worker `0x18005a210` | SPEC |
| Import Action | `ImportAction` | action | same handler as `ImportRefAction` | SPEC-PARTIAL |
| Plot To Action | `PlotToAction` | action | `12a3efd0…` fvt `0x180126df8` → `0x1800a3940` → `0x180055470` (0xb0); tvt `0x18011c600` Do `0x180055be0` / Unpack `0x180055ed0` / RePack `0x180055e30`; worker (`+0x38`) `0x180055750` | SPEC-PARTIAL |
| Apply Action | `ApplyAction` | action | `12a3efd3…` fvt `0x180126f10` → `0x1800a2ec0` → `0x180007c50` (0x198); tvt `0x180115fd0` Do `0x180012d70` / Unpack `0x1800146e0` / RePack `0x1800140f0`; worker `0x180011c80` | SPEC-PARTIAL |
| Get Driving Actions | `GetDrivingActions` | action | `7249a5d5…` fvt `0x180127840` → `0x1800a34c0` → `0x18003c610` (0xd0); tvt `0x18011a3a0` Do `0x18003d420` / Unpack `0x18003d5a0` / RePack `0x18003d510`; worker `0x18003c7c0` | SPEC-PARTIAL |
| Add Time Warp Transition | `AddTWTransition` | action | `7bec3ab9…` fvt `0x1801276b8` → `0x1800a2e80` → `0x180002170` (0xe8); tvt `0x180115740` Do `0x180005f30` / Unpack `0x180006450` / RePack `0x180006100`; worker `0x180003760` | SPEC-PARTIAL |
| Collapse Animation Layers | `CollapseLayers` | action | `afdd0f73…` fvt `0x180127098` → `0x1800a2f80` → `0x180021bb0` (0xe0, task-first); tvt `0x180116eb0` Do `0x1800238b0` / Unpack `0x180023b40` / RePack `0x180023ad0` | SPEC-PARTIAL |
| Plot To Actions / Plot Frame Set To Actions | `PlotToActions`, `PlotFrameSetToActions` | action | `7bff0142…` (shared) fvt `0x1801279c8` → `0x1800a3980` → `0x180051fe0` (0xe8); tvt `0x18011c3d0` Do `0x180053de0` / Unpack `0x180054a20` / RePack `0x180054410`; worker (`+0x38`) `0x180052730` | SPEC-PARTIAL |
| Store Shape Key | `StoreShapeKey` | action | `12a3efd2…` fvt `0x180126e68` → `0x1800a3e00` → `0x18006b510` (0x148); tvt `0x18011ee60` Do `0x18006f910` / Unpack `0x180070090` / RePack `0x18006fd90`; worker `0x18006eb30` | SPEC-PARTIAL |
| Select Shape Key | `SelectShapeKey` | action | `eaa03724…` fvt `0x180127258` → `0x1800a3bc0` → `0x18005ef60` (0xd8); tvt `0x18011d680` Do `0x18005f960` / Unpack `0x18005fc60` / RePack `0x18005fbb0`; worker `0x18005f2b0` | SPEC-PARTIAL |
| Apply Shape Key | `ApplyShapeKey` | action | `12a3efd4…` fvt `0x180126f48` → `0x1800a2f00` → `0x180015440` (0x1f0); tvt `0x180116710` Do `0x18001ab00` / Unpack `0x18001fa90` / RePack `0x18001b080`; worker `0x1800183e0` | SPEC-PARTIAL |
| Convert Shape Reference Mode | `ConvertShapeReferenceMode` | action | `b0adeabc…` fvt `0x180127300` → `0x1800a3040` → `0x180025890` (0xf0); tvt `0x180117360` Do `0x180036530` (shared generic Do) / Unpack `0x180026840`; worker `0x180025a90` | SPEC-PARTIAL |
| Link Deform With Ori | `LinkDeformWithOri` | action | `14fafb72…` fvt `0x1801278b0` → `0x1800a3cc0` → `0x180061350` (0xb8, task-first); tvt `0x18011de80` Do `0x180062670` / Unpack `0x180062a00` | SPEC-PARTIAL |
| Add Clip | `AddClip` | **actioncore** | `67b8773b…` fvt `0x180066ae8` → `0x1800039a0` → `0x180038460` (0x2f8); tvt `0x180088f30` Do `0x18003d3a0` / Unpack `0x18003da60` / RePack `0x18003d770`; worker `0x1800392e0` | SPEC |
| Copy Clip To Track | `CopyClipToTrack` | **actioncore** | `acd20b45…` fvt `0x180066d50` → `0x180003fa0` → `0x18004a9e0` (0x1c8); tvt `0x18008d940` Do `0x18004e950` / Unpack `0x18004ee30` / RePack `0x18004ec00`; worker `0x18004ddf0` | SPEC |
| Create Compound | `CreateCompound` | **actioncore** | `67b8773d…` fvt `0x180066ca8` → `0x180004020` → `0x180050990` (0x1f0); tvt `0x18008ebc0` Do `0x180054380` / Unpack `0x1800552f0` / RePack `0x180054a50`; worker `0x180051990` | SPEC |
| Move Clip To Track | `MoveClipToTrack` | actioncore | `67b8773e…` fvt `0x180066c38` → `0x1800040e0` → `0x180055f30` (0x278); tvt `0x18008fd20` Do `0x180058640` / Unpack `0x180058ee0`; worker `0x180056ed0` | SPEC |
| Explode Compound | `ExplodeCompound` | actioncore | `9517f6f5…` fvt `0x180066ce0` → `0x180003f60` → `0x1800479a0` (0x118); tvt `0x18008ce40` Do `0x180049c40` / Unpack `0x18004a4c0`; worker `0x1800482b0` | SPEC |
| Add Clip Relation | `AddClipRelation` | actioncore | `2b6f1f13…` fvt `0x180066c00` → `0x180003960` → `0x180035690` (0x190); tvt `0x1800885c0` Do `0x180037030` / Unpack `0x180037410` / RePack `0x1800372a0`; worker `0x1800366c0` | SPEC |
| Add Custom Operator | `AddCustomOp` | not action.dll | `f33c09e7…`: only one copy (`0x1801360a8`), outside the handler table and not among the 74 compares; handler is in `ophost.dll` or `sicoresdk.dll` (not opened) | LOCK |
| (registry-first `action.dll`, really actioncore) | `AddTransition`, `AddClip`, `CopyClipToTrack`, `CreateCompound` | — | action.dll holds these CLSIDs only in its sub-task table (`0x180136cb8` AddClip, `…cc8` AddTrack, `…cd8` AddTransition, `…ce8` CreateCompound, `…d18` CopyClipToTrack; single code reference each); it **runs** them, it does not serve them | map correction (see rows above) |

The last row is a map correction only; those four names are counted once, in their actioncore rows.

## 2. Shared facts

### 2.1 Which DLL serves what (corrections to the registry order)
- `AddTransition`, `AddClip`, `CopyClipToTrack`, `CreateCompound`: registry lists `action.dll` first; the handler is
  **actioncore.dll** (compare chain entries `0x18006c220`, `0x18006c1b0`, `0x18006c2c0`, `0x18006c250`).
- `AddMarker`: registry lists `fcurve.dll` first; the handler is **actioncore.dll** (`0x18006c200`).
- `AddCustomOp`: **not** in action.dll.
- Shared CLSIDs (one task, behaviour picked by arguments only): `12a3efcd` = `SIStoreAction` + `GetStoreActionDefaults`
  (switch on `Type`); `12a3efcf` = `ImportAction` + `ImportRefAction` + `LoadActionPreset` (only the registry default
  of `ActionStorage` differs: 0 / −1 / 0); `7bff0142` = `PlotToActions` + `PlotFrameSetToActions` (switch on `Type`).

### 2.2 Common conventions
- Every time argument given in frames is converted to seconds with the current frame rate when unpacked
  (`SIFramesToSeconds`); internal storage is seconds.
- `Model` (actioncore helper `0x180047420`): the argument is taken as a model (interface `6b579d20-3dc5-11d0-9449-00aa006d3165`);
  a failure is not fatal for most commands.
- Get / create the model's mixer container: helper task `6d89e10a-ec1d-11d2-b353-00105a1e6ce9` (slot 10 = for a
  model, slot 11 = for a clip's owner); the creation task is kept as a sub-task when undo is recorded.
- Lock checks use `CSILockStatus`; a locked object raises the lock error and returns `0x80070005`.
- Clip interface `2320122c-d1b9-11d2-b34b-00105a1e6ce9`; container / compound / track interface
  `fe2c4320-c53d-11d2-b34a-00105a1e6ce9`; action source `12a3ef95-e543-11d2-b352-00105a1e6ce9`.
- Object classes created (constants, names inferred from use): transition `d8d203a5-e13d-11d2-b34f-00105a1e6ce9`,
  marker `d8d203a9-e13d-11d2-b34f-00105a1e6ce9`; shot clip class `bddf3311-94f8-4b33-821e-588671859804` (CMD-B16e).
- Sub-tasks seen: `DeleteObj` `dd531990-ccc2-11d2-ac73-00a02485cecb` (AddTransition), `StripDeformOperators`
  `eaa03726-f9bd-11d2-9c61-0060970a2bc8` (ReplaceShapeKey), `AddTrack` `67b8773c`, `CreateCompound` `67b8773d`,
  `AddClip` `67b8773b` (EqualizeAction), `AddTransition` `c030ada0` (AddTWTransition).
- Message dictionaries: `XSIACTIONCORE` ids 0x16 (relation refused), 0x18 (AddClip: no room on track), 0x19
  (MoveClipToTrack: no room), 0x1a (CopyClipToTrack: no room), all logged at severity 2; action.dll raises
  `0x80070057` with message id `0x3eb` + a literal English text (EqualizeAction, ReplaceShapeKey, AddTWTransition);
  `simsgcat` 0x143 is the "not available in this application mode" error (ExportAction). Texts of numbered ids are
  not in the repo.

## 3. Wire contracts

### `EqualizeAction`: SPEC-PARTIAL
- Args: `Source` (action source, or a clip whose source is used; a clip whose "has source" query returns 0 →
  `0x8000FFFF`), `Time` (frames → seconds, default 0), `Duration` (frames → seconds, default 0), `Name` (default
  empty), output `Clip`.
- Purpose: **multi-resolution (band) decomposition of an action** ("Action Equalizer"), not a clip layout tool.
  Steps, with a progress bar (captions "Action Equalizer...", "– Validating Data...", "– Initializing Data...",
  "– Processing item %lu (%lu), Band %lu (%lu)...", "– Updating Mixer..."; Cancel returns S_FALSE and stops):
  1. Validation: every item of the source must be an fcurve item (else `0x80070057`, id 0x3eb, "All items must be
     fcurves (use plot).") and all fcurves must have the same, non-zero key count N (else "All fcurve items must be
     equally sampled (use plot).").
  2. Band count B = floor(log2 N). Per item, B band fcurves are produced by repeated low-pass filtering with the
     5-tap kernel **[1/16, 1/4, 3/8, 1/4, 1/16]** at tap spacing 2^level (level 0, 1, …): the detail band is input
     minus smoothed, the smoothed signal feeds the next level; the filter stops when N ≤ 4·2^level and that band
     receives the remaining low-pass signal. Samples near the ends use the boundary handling of `0x1800393e0`
     (taps outside the range fold their weight onto the edge sample, inferred). Each band is rebuilt as a raw
     fcurve (tolerance 0.001) over the original key times.
  3. Name: `Name`, or the source's name when empty. B new action sources (item kind 0x1e "Raw Data" items) are
     created, one per band, named `<Name>_Band_<k>` (k counts from the coarsest band, inferred) and given the
     source's start / end.
  4. Mixer: model's mixer got/created; an `AddTrack` sub-task makes track `<Name>_Equalizer_Track`, a
     `CreateCompound` sub-task makes compound clip `<Name>_Equalizer_Clip` at `Time`; one `AddClip` per band adds the
     band source inside the compound at local time 1 frame, weight 1.0. All sub-tasks are kept for undo.
  5. When `Duration > 0` the compound clip's timing is set from `Duration` (scale to fit, inferred).
  6. Returns the compound clip as `Clip`.
- Missing: exact boundary rule of the filter, the clip-timing call of step 5, the final flag the worker writes on the
  returned clip (VT_BOOL false, inferred "mute original").

### `ExportAction`: SPEC
- Args: `Action`, `FileName`.
- `Action` resolution: an action source; or a mixer clip / object holding one (the source is looked up as a child of
  class `12a3ef95…`); or a clip whose type query returns exactly 1 → its first source; otherwise `0x8000FFFF`.
- `FileName` is split into folder and file part.
- Restricted application mode (`SIGetAppMode` check): `0x80004021` raised with `simsgcat` 0x143, nothing written
  (checked in UnPackArg, Do and the worker).
- Only extensions **`.eani` and `.xsi`** are exported (case-sensitive compare). Any other extension goes to worker
  slot 9 which returns `E_FAIL` (0x80004005) and writes nothing.
- Export: fire file event `0x20510013` (type 10) with source + full path; if the handlers return failure, `1` or
  `0x562e80c7` the export is skipped and that code returned; else the source saves itself to the path, then file event
  `0x20510014` fires; the command returns S_FALSE (1) on success. Not undoable (no undo data).

### `ImportRefAction`: SPEC-PARTIAL
- Same task as `ImportAction` / `LoadActionPreset` (contract in CMD-B11e). Args: `Model`, `FileName`, `Name`
  (default empty), `ActionStorage` (**default −1**), output `Action`.
- With `ActionStorage = −1` the loaded source's storage property (id 7) is **not** overwritten and its file path
  property (id 8) is kept, so the source stays a reference to the file (ImportAction passes 0 → storage 0 and the path
  cleared, i.e. an internal copy).
- Extension test case-insensitive: `.Preset`, `.xsi`, `.eani` (other → `0x80070057`, id 0x33); `.eani` fires
  `0x20510015` before and `0x20510016` after the load. Name = `Name` or the file base name. New source appended to the
  model's mixer (created if needed); folder remembered under `Nle\animmix\action`.
- Missing: the three format loaders (as CMD-B11e).

### `ReplaceShapeKey`: SPEC-PARTIAL
- Args: `InputObj` (first object of the list), `ForceDeformStripping` (bool, default false). `OutputObj` is not read.
- Shape key resolution: the object as a shape key; else, if it is an action source, its first item of kind 3; else, for
  a 3D object, the first cluster-shape-combiner operator's shape key (inferred). Nothing found → S_FALSE, no change.
- Null key → `0x80070057`, id 0x3eb, "ShapeKey". Locked key → lock error, `0x80070005`.
- Reference mode (shape key slot 0x20) must be < 3 (`siShapeLocalReferenceMode` 0 / absolute 1 / object 2, inferred
  names). The key's cluster at the current time gives the element indices; their count must equal the key's element
  count, else `0x80004005` with message 0x65.
- Values: point positions at the **current frame with the animation deformers inverted**
  (`F3DApplyAnimationDeformInverseToPositions`; result 1 logs warning 0x129, severity 4, and continues), picked by the
  cluster indices. For the non-absolute modes the stored value is position minus the base (reference) position,
  rotated into each point's reference frame (3×3 per point) (mode mapping inferred).
- When undo is recorded the old key values are saved first. The new values are written to the key.
- If the object has a shape combiner and either the combiner reports a stack that needs stripping or
  `ForceDeformStripping` is true, a `StripDeformOperators` sub-task runs on the primitive. Finally the key is marked
  updated (slot 0x388 = 1, inferred "dirty").

### `SIStoreAction`: SPEC-PARTIAL
- Same task as `GetStoreActionDefaults` (CMD-B11e §3 and Batch-12 Q3 give the store worker). Args: `Model`,
  `InputObj` (list), `Mode` (default 1), `Name` (default `StoredAction`), `RemoveAnim` (default true), `Consider
  Time` (false), `StartFrame`, `EndFrame` (0), `Ripple` (false), `IncludeAnimLayers` (false), `Type` (default empty),
  output `Action`.
- `Type`: `ReturnOnly` → query mode (behaves as GetStoreActionDefaults); `TransientAction` → storage kind 2;
  `UnownedAction` → kind 0; anything else (default) → kind 1 = source added to the model's mixer.
- `Model` may be a model, or a clip (type ≠ 0 → its owner model via the clip's track list).
- `Mode` → parameter class mask: 0→0, 1→1 (static values), 2→2 (fcurves), 3→4 (expressions), 4→8 (constraints),
  5→0xe, 6→0xf.
- Do passes Model, InputObj, mask, Name, RemoveAnim, storage kind, Consider Time, Start, End (frames), Ripple,
  IncludeAnimLayers to the store worker; result returned as `Action`.
- Missing: exact effect of `RemoveAnim` / `Ripple` / `IncludeAnimLayers` inside the worker (not re-read).

### `AddTransition`: SPEC-PARTIAL
- Args: `From`, `To` (clips, first item of each list), `Type` (VT_UI4, default 0; **values > 2 become 0**), `Name`
  (default `Transition`), output `Transition`. Types: 0 standard, 1 cardinal, 2 bridge (names inferred; 2 =
  time-warp/bridge as attested in mixer-clip-transitions.md).
- Errors: missing From / To → `0x80004003`; From == To → `0x80004005`; either clip locked → `0x80070005`.
- Order: (1) an existing transition that uses `From` on its start side is deleted with a `DeleteObj` sub-task, and an
  existing transition using `To` on its end side likewise (side codes 1 / 2 from the clip's transition list,
  inferred "start / end"); (2) the owning container of each clip is found; (3) a family test on both clips (three
  family GUIDs) can reject the pair (inferred: only action / shape clips); (4) **both clips must be in the same
  container**, else nothing is created; (5) a transition object (class `d8d203a5…`) is created, given From/To, added
  at the end of the container, its track indices for both clips (params 6 and 7) and its type (param 4) set; for
  Type 1 an extra flag (2) is written on a sub-object; the common items of both clips' sources are found
  (`F3DFindCommonTransitionItems`) and stored on the transition; (6) when `Name` is non-null and not
  case-insensitively equal to `Transition`, the name is set, otherwise the default naming stays.
- Undo record: soft refs to From, To, the transition, plus Type and Name.
- Missing: what the creation call does with the default name (unique suffixing, inferred).

### `AddMarker`: SPEC
- Args: `Model`, `Container` (track / container interface `fe2c4320…`), `Time` (frames → seconds), `Duration`
  (frames → seconds, default 0), `Name` (default empty), output `Marker`.
- Nothing is done when Model is missing. A locked container (lock bit 1) raises the lock error.
- Creates a marker object (class `d8d203a9…`); name = `Name`, or **`Marker`** when empty; the name is also written to
  the marker's name parameter.
- No `Container` → the model's mixer container is got/created (helper `6d89e10a`, kept as sub-task for undo).
- The marker is appended to the container (position −1), then its parameter 4 = Time (seconds) and parameter 5 =
  Duration (seconds) are set.
- Undo record: soft refs to the container and the marker, time, duration, name. Returns the marker.

### `ReconnectMixer`: SPEC-PARTIAL
- Args: `Model` (model, or directly a mixer via interface `97912761-adb3-11d3-b386-00105a1e6ce9`).
- Do: a mixer given → asks the mixer to reconnect (mixer slot 8 with the constant at `0x180091700`); a model given →
  gets the model's mixer through `6d89e10a` (no creation flag) and does the same. Missing mixer → `0x80004003`.
- Undo and Redo are the same no-op entry `0x180008000` (not undoable, inferred).
- Missing: what the mixer's reconnect does (re-binding clip outputs to the model's parameters, inferred from the name).

### `SwapRelationMasterAndSlaveClip`: SPEC
- Args: `Relation` (one relation object, interface `0x18006bdd0`).
- Do: asks the relation to swap its master and slave clips (relation slot 4). If the swap call fails the command
  returns S_FALSE and records nothing. When undo is recorded a soft ref to the relation is kept.
- Undo and Redo both swap again (same entry `0x18005a300`). Null relation → `0x80004003`.

### `ImportAction`: SPEC-PARTIAL
- Confirmed same handler as `ImportRefAction`, `ActionStorage` default 0 (storage 0, path cleared). Rest as above /
  CMD-B11e `LoadActionPreset`.

### `PlotToAction`: SPEC-PARTIAL (confirmation)
- UnPack reads `Model` (model interface `6b579d20…`, with two fallback interfaces), `InputObj`, `Name`,
  `StartFrame`, `EndFrame`, `StepFrame`, `DefaultSegKind`, `FCurve Kind`, `Fit FCurve`, `Fit Tolerance`,
  `ProcessContRots`. Constructor defaults: Step 1.0, Tolerance 0.01, SegKind 3, FCurve Kind 20, ProcessContRots 1
  (match the registry). Worker not re-read.

### `ApplyAction`: SPEC-PARTIAL (confirmation)
- UnPack reads `Target`, `Source`, `Consider Time`, `StartFrame`, `EndFrame`, `Ripple`, `RemoveLayerAnimation`
  (Source may be an action source or a model). Worker `0x180011c80` not re-read.

### `GetDrivingActions`: SPEC-PARTIAL (confirmation)
- UnPack reads `InputObjs`, `Consider Time`, `Keep Compound Actions`, `Time` (frames → seconds), `Keep Inactive
  Actions`. Not undoable (Undo/Redo = shared stub `0x180027ae0`). Constructor default Keep Compound = 1.

### `AddTWTransition`: SPEC-PARTIAL (confirmation + new facts)
- UnPack: `From`, `To` (clips), `From Period`, `To Period` (frames → seconds), `Name`.
- Worker: progress caption `XSIACTION2` 0x42b; each period must not exceed its clip's span (+0.001 s tolerance), else
  `0x80070057` id 0x3eb; clips must overlap ("Clips must overlap properly."); clip extrapolations must be none or
  cycle ("Extrapolations have to be either nothing or cycles."); builds a time-warp fcurve named
  `Time Warp Transition Curve`; then runs an **`AddTransition` sub-task with Type 2** and name = `Name`, or
  `BridgeTransition` when Name is null (progress "Bridge transition - Updating Mixer...").

### `CollapseLayers`: SPEC-PARTIAL (confirmation)
- UnPack reads `Model` (first object → its model), `StartFrame`, `EndFrame`, `StepFrame`, `Fit FCurve`,
  `Fit Tolerance`. **`PlottingType` is not read** (constructor value 1 always used). Defaults Step 1.0, Tolerance
  0.01, Fit 1.

### `PlotToActions` / `PlotFrameSetToActions`: SPEC-PARTIAL (confirmation)
- One task. `Type` (ULONG; missing → 0). Type 0: `EndFrame`, `StepFrame` read (range plot); Type 1: `FrameSet` must
  be a SAFEARRAY (else `0x80070057`), each element converted to double (frames); other Type: no frame args. Then
  `FCurve Kind`, `DefaultSegKind`, `Fit FCurve`, `Fit Tolerance`, `ProcessContRots`. Common: `InputObj`, `Name`,
  `StartFrame`.

### `StoreShapeKey`: SPEC-PARTIAL (confirmation)
- UnPack: input objects scanned; the first object whose kind query returns 6 or 7 (cluster kinds, inferred) is used,
  otherwise the first object exposing interface `cdea6775-415b-11d0-aa40-00a0243e34c4` (kind recorded as 4). Then
  `Name`, `RefMode` (ULONG), `Frame` (frames → seconds), `Duration`, `Sampling` (seconds), `Content`,
  `Force deform stripping`.

### `SelectShapeKey`: SPEC-PARTIAL (confirmation)
- UnPack: from the input objects, the first exposing `a244f0d0-1e1d-11d0-aa2e-00a0c4343e24` (inferred cluster) is the
  target, else the first model's primitive (via `6b579d20`); then `SourceObj`, `RefMode`, `ApplyKeys`, `Relational`.

### `ApplyShapeKey`: SPEC-PARTIAL (confirmation)
- UnPack: shape key from the input objects (same rule as ReplaceShapeKey); then `Mode`, `Time` (frames → seconds),
  `Duration` (frames → seconds), `Name`, `Overwrite`. `Compound` / `Track` are not read by name here (taken from the
  input list, inferred).

### `ConvertShapeReferenceMode`: SPEC-PARTIAL (confirmation)
- UnPack reads only `RefMode` (input objects come from the generic input list). No RePack.

### `LinkDeformWithOri`: SPEC-PARTIAL (confirmation)
- UnPack reads `Cluster`, `LinkWithOri`, `Parameter list`.

### `AddClip`: SPEC (confirmation, actioncore)
- UnPack: `Model`; `Source` (any object); `Compound`, `Track` (containers); `Time` (frames → seconds); `Name`;
  `ConnectionMappingTemplate`, `ValueMappingTemplate`; `ShareParent`; `IgnoreMissingConnections`.
- When a `Track` is given and it is not empty-checked away (track query slot 0x38 == 0), the clip span =
  (source end − source start) + 1 frame is tested against the track (`GetInsertedClipBounds`); no room → log
  `XSIACTIONCORE` 0x18 (severity 2) and the time is set invalid (the add then fails); otherwise Time/End are snapped
  to the bounds the test returns.

### `CopyClipToTrack`: SPEC (confirmation)
- UnPack: `Model`; `Clip` (clip); a shot clip uses the **current scene model** and ignores `Compound`; otherwise
  `Compound`; `Track` (required); `Time` (frames → seconds). Room test as AddClip with the clip's own span; failure →
  log `XSIACTIONCORE` 0x1a and `0x80004005`.

### `MoveClipToTrack`: SPEC (confirmation)
- Same reads as CopyClipToTrack (shot-clip rule included); failure → log `XSIACTIONCORE` 0x19 and `0x80004005`.

### `CreateCompound`: SPEC (confirmation)
- UnPack: `Model`, `InputObj` (list), `Compound`, `Track`, `Time` (frames → seconds), `Name`.

### `ExplodeCompound`: SPEC (confirmation)
- UnPack: `Model`, `Compound` (required container; missing context → `0x80004003`).

### `AddClipRelation`: SPEC (confirmation)
- UnPack: `From` list. One item → `To` (first item) is the slave; a relation check on the pair (slot 0x1c8) that
  reports a conflict logs `XSIACTIONCORE` 0x16 (severity 2) and returns `0x80004005`. Two or more items → items 0 and 1
  are master and slave and `To` is ignored. Empty → `0x80070057`. Both must be clips. `Name` (default `Relation`).

### `AddCustomOp`: LOCK
- Not served by action.dll (see §1). Re-run against `ophost.dll` / `sicoresdk.dll`.

## 4. Open questions
1. EqualizeAction: exact boundary rule of the band filter `0x1800393e0`, band numbering direction, and what the final
   VT_BOOL write on the returned clip is.
2. ReconnectMixer: meaning of the mixer call with constant `0x180091700`; read the mixer class in actioncore.
3. AddTransition: the three family GUIDs (`2320123a-d1b9-11d2-b34b-00105a1e6ce9`, `2320123b-d1b9-11d2-b34b-00105a1e6ce9`,
   `08e2e5c8-9d6e-4f43-9cb4-fe978ead5ce1`) and
   the exact reject rule; default naming of the transition object.
4. ReplaceShapeKey: confirm the mapping of reference modes 0/1/2 to the absolute / delta / frame paths.
5. SIStoreAction: `RemoveAnim`, `Ripple`, `IncludeAnimLayers` effects in worker `0x180063c90`.
6. AddCustomOp handler (ophost.dll / sicoresdk.dll).

## 5. Corrections for the wire agent
Current wiring read in `src/commands/anim.ts` (registered first in `src/main.ts`, so it wins over
`animateSurface.ts`) and `src/commands/animateSurface.ts`. Read only.

1. `EqualizeAction` (`anim.ts:573`) is an alias of `EqualizeClips` (lays clips end to end). Wrong: it is the band
   equalizer of §3 (args `Source`, `Time`, `Duration`, `Name`; makes `<Name>_Band_<k>` sources, track
   `<Name>_Equalizer_Track`, compound `<Name>_Equalizer_Clip`; returns the compound clip; errors for non-fcurve items and
   unequal key counts).
2. `ExportAction` (`anim.ts:602`) ignores `Action` / `FileName` and writes JSON to localStorage. Should resolve
   `Action` (source, or clip → source), export only `.eani` / `.xsi` (case-sensitive), return E_FAIL for other
   extensions, fire file events `0x20510013` / `0x20510014`, return S_FALSE on success.
3. `ImportRefAction` (`anim.ts:620`) has no args and calls `ImportAction` unchanged. It must pass `ActionStorage = −1`
   (keep the file reference); `ImportAction` (`anim.ts:609`) lacks `ActionStorage` (default 0) and the extension
   validation (`.Preset`/`.xsi`/`.eani`, else 0x80070057).
4. `ReplaceShapeKey` (`anim.ts:346`) has no args and stores the raw (deformed) mesh positions. Should take
   `InputObj` + `ForceDeformStripping`, invert animation deformers at the current frame, honour the key's reference
   mode (absolute vs delta in reference frames), check element count (0x80004005), lock check, save old values for
   undo, and run `StripDeformOperators` when needed or forced.
5. `SIStoreAction` (`animateSurface.ts:744`, via `storeOverlapping`) forwards `Mode` raw and drops `Type`. Needs the
   Mode → class-mask table (0,1,2,4,8,0xe,0xf), `Type` = `ReturnOnly` / `TransientAction` / `UnownedAction` handling,
   and default `Name` `StoredAction`.
6. `AddTransition` (`anim.ts:517`): has a `Length` arg Softimage does not have and no `Type` arg; default name is
   `<from>_to_<to>`. Should take `Type` (0..2, >2 → 0) and `Name` (default `Transition`), fail on From == To
   (0x80004005) and on locked clips, delete the existing transitions on From's start side / To's end side first, refuse
   clips in different containers, and set the transition type parameter.
7. `AddTWTransition` (`anim.ts:533`): has `Length`, lacks `From Period` / `To Period` / `Name`; Softimage validates
   periods against clip spans, overlap and extrapolation (three errors of §3) and delegates to AddTransition type 2. The
   Desktop-attested `TW1` naming may stay, but the argument list and the checks should follow §3.
8. `AddMarker` (`animateSurface.ts:582`): stores JSON on the mixer, ignores `Container`, default name empty, returns a
   count. Should create a marker object in `Container` (or the model mixer), name `Marker` when empty, set time and
   duration, and return the marker.
9. `ReconnectMixer` (`anim.ts:597`) only logs counts. Should ask the model's (or given) mixer to reconnect; not
   undoable; 0x80004003 when no mixer.
10. `SwapRelationMasterAndSlaveClip` (`anim.ts:593`) swaps **all** relations and takes no args. Should take one
    `Relation` and swap only it; undo = swap again.
11. `AddClipRelation` (`anim.ts:588`) uses args `Master` / `Slave`. Registry / binary: `From`, `To`, `Name` (default
    `Relation`), output `Relation`; a two-item `From` list supplies both clips; refusal → log 0x16 + 0x80004005.
12. `MoveClipToTrack` / `CopyClipToTrack` (`anim.ts:574` / `:577`) take a track number and no `Time`. Should take
    `Model`, `Clip`, `Compound`, `Track` (track object), `Time` (frames), run the room test and fail with 0x19 / 0x1a +
    0x80004005; shot clips use the scene model.
13. `CreateCompound` (`anim.ts:551`) uses `Name` / `Clips`; should be `Model`, `InputObj`, `Compound`, `Track`, `Time`,
    `Name`, output `Clip`. `ExplodeCompound` (`anim.ts:562`) uses `Name`; should be `Model`, `Compound`.
14. Handler-DLL map: re-point `AddTransition`, `AddClip`, `CopyClipToTrack`, `CreateCompound`, `AddMarker` to
    actioncore.dll; `AddCustomOp` is not action.dll.
