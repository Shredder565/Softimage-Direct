# CMD-B17b: chain / skeleton and model / reference-model script commands (`chains.vbs`, `Model.vbs`)

Row: **CMD-B17b**. Status: **SPEC** for all 19 commands below.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`). Sources read from the install
with REA `open_binary(format=raw-binary, architecture=6502, entry_point=0x0)` + `read_bytes` (whole file), decoded
in the scratchpad; sha256 matched.

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `chains.vbs` | 26162 | `95b8ae2d` | whole | 10 |
| `Model.vbs` | 38062 | `1acedbac` | whole | 9 |
| `Application\Dictionary\en\XSISCRIPTS.dict` | 22212 | `b942f52f` | whole | texts of ids 1045, 1082, 1083 |

Earlier contracts reused: `cmd-b5f-misc-dsscripts.md` (`AppendBone` → `SIAppendBone`), `cmd-b16b-shader-array-bone-commands.md`
(`SIAppendBone`), `cmd-b15a-modeltasks.md` (`SIImportModel`, `SICreateRefModel`, `CreateEmptyRefModel`,
`SISetResolutionOfRefModels`, `ImportDelta`), `cmd-04b-import-export-model-scripts.md` (`CreateRefModel`).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `AddBoneToEnd` | chains.vbs | `AddBoneToEndProc` | SPEC |
| `BreakChainAtBone` | chains.vbs | `BreakChainAtJointProc` | SPEC |
| `Create2DSkeleton` | chains.vbs | `CreateSkeletonProc` | SPEC |
| `Create3DSkeleton` | chains.vbs | `CreateSkeletonProc` | SPEC |
| `CreateChainfromCurve` (2 entries) | chains.vbs | `CreateChainFromCurveProc`, `GetInputAndCreateChainFromCurveProc` | SPEC |
| `InspectChainProperties` | chains.vbs | `InspectChainPropertiesProc` | SPEC |
| `KeyAllBoneRotations` | chains.vbs | `KeyAllBoneRotationsProc` | SPEC |
| `SetBoneMaxRotLimit` | chains.vbs | `SetJointMinMaxProc` | SPEC |
| `SetBoneMinRotLimit` | chains.vbs | `SetJointMinMaxProc` | SPEC |
| `SetBoneRotationToPrefRotation` | chains.vbs | `SetJointsToPrefRotations` | SPEC |
| `AddDelta` | Model.vbs | `AddDeltaProc` | SPEC |
| `CommitToReference` | Model.vbs | `CommitToReferenceProc` | SPEC |
| `DeleteModelFromObj` | Model.vbs | `DeleteModelFromObjectProc` | SPEC |
| `DuplicateModelFromObj` | Model.vbs | `DuplicateModelFromObjectProc` | SPEC |
| `ImportModel` | Model.vbs | `ImportModelProc` | SPEC |
| `ImportRefModels` | Model.vbs | `ImportRefModelsProc` | SPEC |
| `MakeLocalMaterialsForHierarchy` | Model.vbs | `MakeLocalMaterialsForHierarchyProc` | SPEC |
| `SetResolutionOfRefModels` (5 entries) | Model.vbs | `SetResolutionOfAllRefModelsProc` | SPEC |
| `UpdateReferencedModel` | Model.vbs | `UpdateReferencedModelProc` | SPEC |

## 2. Wire contract, chains.vbs (category Animation for all)

Common message when the selection is empty or has no fitting element: log (info) `Please select a bone first`
(min/max, pref rotation, break chain) or `Please select a chain element first` (add bone).

### `SetBoneMinRotLimit`, `SetBoneMaxRotLimit`
Args (R): `InputObjs` (Collection, f 0x10002), `DoMin` (bool, f 4, True for Min, False for Max).
1. Empty / Nothing input: message, stop.
2. In views A, B, C, D and each of their cameras `User`, `Top`, `Front`, `Right`: if
   `Views.View<v>.<cam>Camera.camvis.attrselchnjntareaguide` is not True set it True; same for
   `…camvis.attrunselchnjntareaguide` (joint-area guides shown for selected and unselected chains).
3. For each input whose type is `bone`: `SetValue <bone>.joint.rotlim_active, True`; read
   `<bone>.kine.local.rotx/roty/rotz`; write them to `<bone>.joint.rotMinX/Y/Z` (or `rotMaxX/Y/Z`).
Non-bone items are skipped silently.

### `SetBoneRotationToPrefRotation` (display shipped as "Set Bone Max Rot Limit", registry copy error)
Args (R): `InputObjs` (Collection). Empty: message, stop. For each `bone`: read `<bone>.joint.prefrotx/y/z`, then
`Rotate <bone>, x, y, z, siAbsolute, siLocal, siObj, siXYZ`.

### `BreakChainAtBone`
Args (R): `InputObjs` (Collection). Filter `chain_element`; none: message, stop. For each element of type `bone` or
`eff`, toggle the pseudo-root state:
- currently `joint.pseudoroot_active` True → set it False, `joint.chntype` 0, `kine.local.cnspos` True;
- else → `pseudoroot_active` True, `chntype` 1, `kine.local.cnspos` False.

### `AddBoneToEnd`
Args (R): `InputObjs` (Collection). Filter `chain_element`; none: message, stop. Uses only the first element:
`GetSkeleton <elem>` → its last item is the effector. Then a pick loop: `PickPosition "Append Bone"`;
`ButtonPressed` 0 ends; else `AppendBone <effector>, PosX, PosY, PosZ` (Pin default) and pick again. Each pick is its
own `AppendBone` command (contract: `cmd-b5f-misc-dsscripts.md`).

### `Create2DSkeleton`, `Create3DSkeleton`
Args (R): `Rx, Ry, Rz` (double, default 0, f 34), `Ex, Ey, Ez` (default 1, 0, 0), `Nx, Ny, Nz` (default 0, 0, 1),
`ViewType` (int, default 3 for 2D / 0 for 3D), `Bone`, `Effector` (out), `SkeletonType` (int, default 2 / 3),
`Value` (return).
1. `DeselectAll`.
2. `SkeletonType` other than 2 or 3: log error `CreateSkeleton: invalid skeleton type`, return nothing.
3. `SICreateSkeleton Rx, Ry, Rz, Ex, Ey, Ez, Nx, Ny, Nz, ViewType, Bone, Effector, SkeletonType,
   <user pref SI3D_ALIGN_ROOT_1ST_BONE>` → root (returned).
4. No root: log error `Create<SkeletonType>DSkeleton: error while creating skeleton` (e.g. `Create2DSkeleton: …`).
5. `SelectObj <root>, "NODE", True`, `AddToSelection <bone>, "NODE", True`, `AddToSelection <effector>, "NODE", True`.

### `CreateChainfromCurve`
Scripted entry `CreateChainFromCurveProc`: args `InputObjs` (Collection, f 0x10082), `NbJoints` (int, default 5),
`UseCns` (bool, default False), `Value` (return). For each curve: `UseCns` true → spline-IK chain, else plain chain
(below). Returns a collection of the created roots.
UI entry `GetInputAndCreateChainFromCurveProc` (args untyped, f 134):
1. `SIFilter <input>, "curve"`; none: log `Please select at least one Curve...` (severity 4, warning), stop.
2. Add a `Custom_parameter_list` property to the scene root named by id 1045 (`Chain from Curve Wizard`), with
   custom parameters `nbJoints` (int (vt 2), value = argument, min 1, max 1000, UI range 1–20, label `Bones`,
   description `Number of Bones`) and `useCns` (bool, value = argument, label `Constrain`, description `Constrain
   Chain to Curve`).
3. `InspectObj <prop>, , <title>, 4` (modal). OK: read both values and run the scripted procedure; Cancel: nothing.
4. `DeleteObj <prop>` in both cases.
Plain chain (per curve): `NbJoints` 0 is raised to 2. Sample the curve at percentages 0, 1/N, 2/N, … 1
(`EvaluateCurveAt <curve>, <fraction>, True` → `PosX/Y/Z`). Sample 0 is the root, sample 1 creates the chain
`Create3DSkeleton root, sample1, normal` with normal (0,1,0), or (1,0,0) when the normalised first-bone direction
dotted with (0,1,0), minus 1, is below 0.00001 (note: a dot product of unit vectors never exceeds 1, so this test is always true and the normal is
always (1,0,0)); samples 2..N: `AppendBone , x, y, z, False` (current selection, not pinned).
Spline-IK chain (per curve): length L = `GetCurveLength`, step = L / N. A straight support curve of N+1 points along
+Y (x 0, y i*step, z 0, w 1), degree 1, non-uniform parameterisation, is added under the curve's parent, named
`<curve>_crv`. `ApplyOperator "CrvDeform", "<support>;<curve>"`, and `<op>.cns2deformer` True. Chain:
`Create3DSkeleton 0,0,0, 0,step,0, 1,0,0`, then `AppendBone , 0, i*step, 0, False` for i = 2..N; the effector from
`GetSkeleton`. Every element (root, bones, effector, in that order) gets `SIApplyCns "Path", <elem>, <support>` with
`perc` = i*step*100/L.

### `KeyAllBoneRotations`
Args (R): `InputObjs` (Collection). Filter `chain_element`; none: nothing. For each element: `GetSkeleton`; empty:
log `Please select the effector, or any node of a chain`, stop. For skeleton items 1 .. count-2 (skip root and
effector): `SaveKey` on `<bone>.kine.rotx`, `.roty`, `.rotz` (one `SaveKey` per bone).

### `InspectChainProperties`
Args (R): `InputObjs` (Collection). Filter `chain_element`; none: nothing. For each, `GetSkeleton` and take item 1
(the first bone); gather `<first bone>.chain` in a unique collection; `InspectObj <collection>`.

## 3. Wire contract, Model.vbs

### `ImportModel`
Args (R): `FileName` (string, f 134, FileName handler), `Parent` (string, `""`), `Reference` (bool, False), `Value`
(out), `Name` (`""`), `ShareOptions` (int, 13), `ExternalCnxMappingTemplate` (`""`). Category File.
1. `Reference` true: `CreateRefModel FileName, Name, , Parent, True, False, Template, ShareOptions` (resolution name
   empty, activate, do not create file). Else `SIImportModel FileName, Parent, <out model>, Name, ShareOptions`.
2. If `Reference` or the template is not empty, and a model came back: `ReconnectModel <model>, Template, False`
   (do not delete unconnected objects).
3. `Value` = the model; if any: `SelectObj <model>, "BRANCH"`, `AutoInspect <model>, , , "General"`.

### `ImportRefModels`
Args (R): `FileName` (comma-separated list of files), `Parent`, `ExternalCnxMappingTemplate`, `Value` (return).
Errors are ignored throughout. For each file (split on `,`, no trimming): `CreateRefModel <file>, , , Parent, True,
False, Template`. Then build the template list `<model1>,<model2>,…,<Template>` and call `ReconnectModel <model>,
<that list>, False` for every new model. Returns the collection of models. (`CreateRefModel` itself selects and
inspects each model, see `cmd-04b`.)

### `UpdateReferencedModel`
Arg (R): `Clip` (Collection, f 0x10082). Empty: log `No valid referenced model in argument`, stop. Errors ignored;
keep only items of type name `Model`; if any, `XSIFileService.UpdateReferencedModel <models>`.

### `SetResolutionOfRefModels` (5 entries)
Args (R): `InputObjs` (Collection), `resolution` (int): entry "Set Resolution Of All RefModels" 0 (f 2); `_OffLoaded`
0, `_Low` 1, `_Medium` 2, `_High` 3 (f 130).
1. Errors ignored. Empty input: all model sources (`FindObjects` class `{0496EAB0-0ECF-11d1-ABF1-00A02485CECB}`)
   whose `referenced_model` parameter is True; else the input as given.
2. If any: `SISetResolutionOfRefModels <models>, resolution`; then for each, if `GetCurrentAnimationLayer` is not
   below `GetNumberOfAnimationLayers`, `SetCurrentAnimationLayer <model>, 0`.

### `CommitToReference`
Args (R): `Model` (Collection), `IncludeNestedRefModels` (bool, False), `FileName` (`""`), `Confirm` (bool, True).
1. Empty: nothing.
2. `FileName` empty and `Confirm` true: Yes/No question box (default No) with id 1083, text `This operation is
   destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to
   proceed?`, title = translated `Warning`. In batch the text is logged as `<title>: <text>` and the answer is OK,
   which is not Yes, so the command stops. Interactive: anything but Yes stops.
3. For each item of type `Model`: `Model.CommitToReference <file>, IncludeNestedRefModels`, where `<file>` is
   `FileName` only when exactly one model was passed, else `""`.

### `AddDelta`
Args (R): `Model` (SingleObj, f 0x10082), `Value` (return). `ImportDelta "non.existent.delta", Model, False, False`;
on a result set `storage` 0, `status` 2, `filename` `""` on the delta and return it (an empty, local, active-state
delta *(meaning of 0 / 2 inferred)*).

### `DeleteModelFromObj`
Arg (R): `InputObj` (Collection). Category Edit.
1. Any sub-components in the input: polygons among them → `ApplyTopoOp "DeleteComponent", <components as text>`;
   otherwise (points / edges) → `ApplyTopoOp "DissolveComponent", …`. Stop.
2. Every item must belong to the 3D-object family, else log `Invalid selection, Please select polygons or an object`
   and stop (nothing deleted). For each: its model (or itself if a model); if that model is the scene root, the item
   itself is collected, else the model (unique).
3. `DeleteObj "B:<full name>,B:<full name>,…"` (branch delete of the collected objects).

### `DuplicateModelFromObj`
Arg (R): `InputObj` (Collection).
1. Any sub-component: message box (`MsgBox`, also in batch) with id 1082, text `Invalid selection, Please select
   objects`, and stop.
2. Collect as in `DeleteModelFromObj` (message `invalid selection, please select an object` on a non-3D item).
3. `Duplicate "B:<names>"` with all options default except the 21st argument `TextureSupports` = 1.
4. For each duplicate: material localisation (`ProcessModel`, below) with no selection filter, then clip
   duplication (below) for the materials made local.

### `MakeLocalMaterialsForHierarchy`
Arg (R): `InputObj` (Collection). `DeselectAll`, `SelectObj <input>`, `SelectChildNodes`; then for every selected
object: material localisation of the object and its whole hierarchy with the selection as filter and a per-object
dictionary, then clip duplication. Children selected by `SelectChildNodes` are therefore processed again as their own
roots.

Material localisation (per object, recursive over children):
- for each local `material` property of the object and of each cluster of its geometry: if the object is itself a
  model, `SIMakeLocal <material>, siBranchPropagation` always; otherwise only when the material is used outside the
  model (no selection filter: some user's model differs) or, with the selection filter, when some user (cluster →
  its 3D object) is not in the selection; branch materials made local with branch propagation, node materials
  without. The local copy is renamed `<material name>_copy` and collected. With the selection filter the type name of
  the filter is logged (info) once per test.
- if the dictionary already has the library-qualified material name, that copy is first assigned to the material's
  owner; the material is still made local afterwards.
- for a model (duplicate case): each group with a local material is made local (branch); in this path the arguments
  are passed in swapped order, so the group test always runs in "selection" mode against the (initially empty)
  material list, i.e. every group material is made local, and the copies are not collected.
Clip duplication: for each collected material and recursively its shaders, every parameter driven by an
`ImageClip`: `SIAddImageSource <clip source file>`, a new clip `AddImageClip <new source>, <old source name>`
(one per file, reused through a dictionary), and the parameter is connected to the new clip.

## 4. Corrections for the wire agent
- `SetBoneRotationToPrefRotation` registry display name is "Set Bone Max Rot Limit" (copy error in the shipped
  registry); the behaviour is "rotate to preferred rotation".
- `CommitToReference` with default arguments does nothing in batch mode (the confirmation answer is OK, not Yes).
- `DeleteModelFromObj` / `DuplicateModelFromObj` act on the **owning model** in branch, not on the object.
- `CreateChainfromCurve` plain chains always get the (1,0,0) chain normal (tolerance test written as
  "dot − 1 < 1e-5", always true).

## 5. Open questions
| # | Question | Where to look |
|---|---|---|
| Q1 | Meaning of delta `storage` 0 and `status` 2 | modeltasks delta class (`cmd-b15a`) |
| Q2 | Type name logged by the material test with a selection filter (`Selection` object / collection) | golden |
