# CMD-B14c: Face Robot FR.dll: face controls, face structure, eye rig / eyelids / eyeball, jaw curve editors, region / stress / tendon maps, region paint, region masks, stress, normal map, remove tongue (AddFaceControl, MakeFaceStructure, fr_MakeEyeBall, MakeEyeRig, MakeEyelids, RegenerateEyelids, fr_GetEyelashMedian, fr_AnimateEyes, fr_EyelidsDeformCurves, fr_EyelidsInfluenceMaps, fr_JawUpperDeflation, fr_JawLowerDeflation, fr_JawDeflationEaseInCurves, fr_JawSlidingEaseInCurves, fr_JawSliding, fr_JawFattening, fr_MapRegion, fr_MapStress, fr_MapTendon, fr_StartRegionPaint, fr_ToggleShowMaps, fr_ToggleShowMapsUnselected, fr_ApplyStress, fr_MakeNormalMap, fr_MakeRegionMasks, fr_AnimateRegionMasks, fr_RemoveTongue)

Row: **CMD-B14c**. Status: **SPEC** (17 names: fr_GetEyelashMedian, fr_AnimateEyes, fr_EyelidsDeformCurves, fr_EyelidsInfluenceMaps, fr_JawUpperDeflation, fr_JawLowerDeflation, fr_JawDeflationEaseInCurves, fr_JawSlidingEaseInCurves, fr_JawSliding, fr_JawFattening, fr_MapRegion, fr_MapStress, fr_MapTendon, fr_StartRegionPaint, fr_ToggleShowMaps, fr_ToggleShowMapsUnselected, fr_RemoveTongue), **SPEC-PARTIAL** (10 names: AddFaceControl - the null builder `0x180007870`, the property/keyword helpers `0x180007380` / `0x18000b270`, the face-model getter `0x18000f3f0` and the offset-parent name suffix were not read; MakeFaceStructure - `_Init` `0x18000dba0` and the four structure builders `0x18000a800`, `0x18000a6f0`, `0x18000a990`, `0x18000b3f0`, the model creator `0x180009dc0`, `0x180008410` and the six-entry mesh-name table at `0x1802d0040` were not read; fr_MakeEyeBall - the eyeball geometry/operator builders `0x18004b8c0` / `0x18004c650` were read for strings only; MakeEyeRig - the rig sub-builders `0x180076d50`, `0x180078b40`, `0x180077ed0`, `0x180077be0`, `0x180077100`, `0x180077a30`, `0x180077420` were not read; MakeEyelids - the eyelid rig stages `0x180069bf0`, `0x18006c450`, `0x18006a3e0`, `0x18006ba50`, `0x18006c820`, `0x18006d100` were not read; RegenerateEyelids - the per-side worker `0x18006f830` was read for strings only; fr_ApplyStress - the BaseLength solver `0x18018bda0` and the stress-mesh duplicator `0x1801768d0` were not read; fr_MakeNormalMap - the 41 KB worker `0x18018e610` was read for strings only; fr_MakeRegionMasks - the 58 KB worker `0x180192f80` was read for strings only; fr_AnimateRegionMasks - the per-mask plotter `0x180191f00` and the name-table filler `0x180191490` were not read).
Run: 2026-11-19, si-analyst worker, unattended, batch 14 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

| Binary | bytes | sha256 | export timestamp |
|---|---|---|---|
| `C:\Program Files\Autodesk\Softimage 2015 SP2\FaceRobot\Application\Plugins\FR.dll` (PE32+ amd64, image base `0x180000000`, `XSILoadPlugin` = `0x1801a9e30`) | 2996552 | `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` | 1442478276 |

Method: export addresses from `inspect_native_exports` (394 exports, complete). Ghidra 12.1.4 on the already-open shared session (no open/close). I decompiled every row's `_Execute` and the `_Init`s marked in §1, the custom-property `_Define` / `_DefineLayout` exports named in §2, and the callees that decide observable behaviour (InspectObj / SelectObj / ActivateObjectSelTool wrappers, the "stage6ppg" view finder, the show-maps toggler, the whole region/stress/tendon map pipeline, the eye-rig and eyelid drivers, the AddFaceControl builder, the ActiveFaceRobot getter, the face-model finder, the stress applier, the region-mask animator). For the big numeric/bake workers I read only the referenced-string inventory (`analyze_function` + strings facet). One `xrefs` pass tied each jaw string to its command. Arguments were cross-checked against `args_c.json` (§4). Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | _Init | _Execute | key helpers |
|---|---|---|---|
| `AddFaceControl` | `0x180007db0` (read) | `0x180007af0` | builder `0x180006ec0`; null maker `0x180007870`; `0x180007380`, `0x18000b270`, `0x18000f3f0` (unread) |
| `MakeFaceStructure` | `0x18000dba0` (unread) | `0x18000dae0` | `0x18000ce80` -> ActiveFaceRobot getter `0x18000a3b0`, face-model finder `0x180009f40`, builders `0x18000a800` / `0x18000a6f0` / `0x18000a990` / `0x18000b3f0` (unread) |
| `fr_MakeEyeBall` | `0x18004f920` (read) | `0x18004f470` | eyeball + cornea builder `0x18004b8c0`, iris builder `0x18004c650` |
| `MakeEyeRig` | `0x180079700` | `0x180079580` | rig driver `0x180078f60` |
| `MakeEyelids` | `0x1800711e0` | `0x180070d90` | selection sorter `0x1800697b0`, help logger `0x18006a2e0`, eyelid driver `0x180070b30` |
| `RegenerateEyelids` | `0x180071690` | `0x180071410` | per-side worker `0x18006f830` |
| `fr_GetEyelashMedian` | `0x180050ca0` | `0x1800507a0` | self-contained |
| `fr_AnimateEyes` | `0x18011a5e0` (shared by 3, read) | `0x18011a5b0` | `0x18011a000` |
| `fr_EyelidsDeformCurves` | `0x18011a5e0` | `0x18011a6b0` | `0x18011a190`, view finder `0x18011ccc0` |
| `fr_EyelidsInfluenceMaps` | `0x18011a5e0` | `0x18011a6e0` | `0x18011a3a0`, view finder `0x18011ccc0` |
| `fr_JawDeflationEaseInCurves` | `0x18011b530` (shared by all 6 jaw commands, read) | `0x18011b370` | view finder `0x18011ccc0`, InspectObj wrapper `0x1801a6570` |
| `fr_JawFattening` | `0x18011b530` | `0x18011b690` | same |
| `fr_JawLowerDeflation` | `0x18011b530` | `0x18011b850` | same |
| `fr_JawSlidingEaseInCurves` | `0x18011b530` | `0x18011ba10` | same |
| `fr_JawSliding` | `0x18011b530` | `0x18011bbd0` | same |
| `fr_JawUpperDeflation` | `0x18011b530` | `0x18011bd90` | same |
| `fr_MapRegion` | `0x18009c840` (shared by 3, read) | `0x18009c600` | pipeline `0x18009bf20` -> `0x18009ad10`, `0x18009a7a0`, `0x18009a490`, `0x18009b040`, `0x18009b420` |
| `fr_MapStress` | `0x18009c840` | `0x18009c720` | same |
| `fr_MapTendon` | `0x18009c840` | `0x18009c9a0` | same |
| `fr_StartRegionPaint` | `0x18009cfa0` | `0x18009cac0` | ActivateObjectSelTool `0x1801a4f60`, SelectObj `0x1801a7a30` |
| `fr_ToggleShowMaps` | `0x18009d2c0` | `0x18009d280` | toggler `0x18009c220` |
| `fr_ToggleShowMapsUnselected` | `0x18009d190` | `0x18009d150` | toggler `0x18009c220` |
| `fr_ApplyStress` | `0x180190f90` | `0x180190e20` | applier `0x18018d910` |
| `fr_MakeNormalMap` | `0x1801912a0` | `0x180191130` | worker `0x18018e610` |
| `fr_MakeRegionMasks` | `0x180196d00` | `0x180196b30` | worker `0x180192f80` |
| `fr_AnimateRegionMasks` | `0x180196900` | `0x1801967a0` | animator `0x180192730` |
| `fr_RemoveTongue` | `0x180099800` | `0x180099280` | delete wrapper `0x1801a5c20`, dictionary remove `0x180026fe0`, `0x180118890` (unread) |

No two `_Execute`s share an address in this group. Shared `_Init`s: `0x18011b530` (all six jaw commands: one argument `face`), `0x18009c840` (fr_MapRegion / fr_MapStress / fr_MapTendon: one object argument `inFace`), `0x18011a5e0` (fr_AnimateEyes / fr_EyelidsDeformCurves / fr_EyelidsInfluenceMaps: no arguments).

## 2. Shared facts

### 2.1 FR session dictionary
Most commands read and write a process-wide FR object registry reached through `0x1800268d0` (singleton) with lookup `0x18002a4a0` (key) / `0x180029ef0` (category, key), store `0x18002fdd0` (key, value) / `0x18002faf0` (category, key, value) and remove `0x180026fe0` (category, key). Categories and keys seen in this group: key `FaceModel` (the face model X3DObject), key `StressMesh`, key `meshnames` (array of 6 mesh names), category `meshes` (keys `Mesh`, `Tongue`), category `controls` (keys `LookAt_Control`, `LEye_Control`/`REye_Control` (+ "0" suffixes), `TongueBack_Control`, `TongueFront_Control`, `TongueTip_Control`, `TongueBase_Control`), category `groups` (key `Tongue`), category `psets` (key `ActiveFaceRobot`).

### 2.2 Common helpers (command wrappers)
- `0x1801a6570` / `0x1801a66f0`: run `InspectObj(target, "", "", 1, false)` (5 arguments; mode 1; the target is a path string or a property).
- `0x1801a7a30`: `SelectObj(target, "", flag)`. `0x1801a4f60`: `ActivateObjectSelTool(value)`.
- `0x18011ccc0` ("stage6ppg" view finder): if the active desktop layout is named `Face Robot`, return its view named `stage6ppg`; otherwise (or if absent) return an invalid view.
- PPG routing used by the jaw and eyelid commands: if the `stage6ppg` view exists, set its attribute `targetcontent` to the target (path or property full name), so the target is shown in the embedded Face Robot PPG; otherwise open it with `InspectObj` (mode 1).

### 2.3 Custom properties (from their `_Define` / `_DefineLayout` exports)

Capability values below are the raw `siCapabilities` integers passed (1 = animatable, 4 = persistable, 5 = both, per the SDK enum (inferred)). Ranges are written default [min..max] (suggested smin..smax).

**EyeballProperties** (`_Define` `0x18004d4b0`, `_DefineLayout` `0x18004e8c0` not read):

| Parameter | Type | caps | Default and range |
|---|---|---|---|
| `SynopticPath` | string (8) | 4 | value `TitlebarSynoptic` (inferred: the second string argument is the default) |
| `Scale` | double | 1 | 0.2 [0.01..1000] (0.01..1.0) |
| `Center` | double | 1 | 0.0 [-2..2] (-1..1) |
| `Bulge` | double | 1 | -0.15 [-1..1] (-1..1) |
| `Size` | double | 1 | 0.25 [0.01..1] (0.01..1) |
| `Aperture` | double | 1 | 0.2 [0..1] (0..1) |
| `Sections` | int2 (2) | 1 | 48 [8..200] (8..200) |
| `Anisotropy` | double | 1 | 0.0 [-1..1] (-1..1) |
| `Ripples` | double | 1 | 0.0 [-2..2] (-1..1) |
| `innerIris` | bool | 4 | true |
| `Lens` | bool | 4 | true |
| `Sclera` | int2 | 1 | 24 [0..100] (0..100) |
| `IrisFC` | FCurve | - | keys (frame-time, value): (0, 0), (0.02, 0.044), (0.4, 0), (0.43, 0.044), (0.68, 0), (0.77, 0.044) (inferred pairing: the six values alternate 0 / 0.044) |
| `CornealBulgeFC` | FCurve | - | keys (0, 0), (1, 0.5); key tangents set from the 8-double table {0, 0, 0.25, 0.4, -0.5, 0, 0.1, 0} |
| `CornealBulge` | double | 1 | 1.0 [0..10] (0..10) |
| `CorneaDetail` | int4 (3) | 1 | 10 [2..80] (2..80) |

**FaceDeformProperties, JawDeflationProperty, JawEaseInProperty, JawFatteningProperty, JawSlidingProperty**: all five `_Define` exports are the same address `0x18008aee0`, which defines no parameter and returns status 1. Their parameters therefore come from whoever creates the property (not in this group). Layouts:

| Property | _DefineLayout | Layout |
|---|---|---|
| FaceDeformProperties | `0x18003fff0` | item `Multiplier`; group "Ease In" holding FCurve widget `EaseIn` |
| JawDeflationProperty | `0x18008ac30` | group "Offset" holding FCurve widget `Offset` |
| JawEaseInProperty | `0x18008ad50` | item `Amount`; group "EaseIn" holding FCurve widget `EaseIn` |
| JawFatteningProperty | `0x18008af00` | item `Inflate`; group "InflateCurve" holding FCurve widget `InflateCurve` |
| JawSlidingProperty | `0x18008b090` | group "Profile" holding FCurve widget `SlideProfile` |

All these layout callbacks return status 1.

**FaceRegionProperties** (`_Define` `0x1800fc3c0`; `_DefineLayout` `0x1800fc880`, `_PPGEvent` `0x1800fce30` not read): `Strength` double, caps 5, 0.5 [0..200] (0..2); `Bulge` FCurve parameter (one capability flag set to true on it; which flag was not resolved); `EaseIn` FCurve parameter; `RecalculatePaint` bool, caps 4, label "Recalculate Paint", default true. The default keys of `Bulge` and `EaseIn` are written by `0x1800fc170` and `0x1800fbf20` (not read). Returns status 1.

**ActiveFaceRobot** (scene-root CustomProperty, created on demand by `0x18000a3b0`): one string parameter `FaceModel` (default ""), set to `Face` when created; registered as `psets` / `ActiveFaceRobot`.

**Region maps** (created by the map pipeline, §3 fr_MapRegion): a CustomProperty named `RegionMap`, `StressMap` or `TendonStressMap` on the face object, with one double parameter per region/tendon cluster (named after the cluster prefix), caps 5, default 1.0 [0..200] (0..5).

### 2.4 Operators named by this group

| Operator | Exports | Created by |
|---|---|---|
| `fro_CorneaOp` | `_Update` `0x18004fad0` | fr_MakeEyeBall (ports group `Main`: `PrimOut`, `PrimIn`, `PropIn` = EyeballProperties) |
| `fro_IrisOp` | `_Init` `0x18004ff90`, `_Term` `0x180050040`, `_Update` `0x1800500d0` | fr_MakeEyeBall (same port names) |
| `fro_MapRegionStressTendonOp` | `_DefineLayout` `0x180040180` (shared generic layout), `_Update` `0x18009d3b0` | fr_MapRegion / fr_MapStress / fr_MapTendon (port layout in §3) |
| `fro_RegionOp`, `Bulger` (legacy name) | `fro_RegionOp_DefineLayout` `0x180047830`, `_Update` `0x180047940` | read, not created, by the map pipeline and fr_ApplyStress; parameters `BaseLength`, `BaseMultiplier`; input ports 2/3/8/9/10 used |
| `fro_TendonOp`, `Tendon` (legacy) | `_DefineLayout` `0x180040d60`, `_Update` `0x180040e70` | read by the map pipeline; parameter `BaseDistance`; input ports 2/3/4/8 used |
| `fro_EyelidOp`, `fro_BlinkOp`, `fro_EyelidTransInfluenceCacheOp`, `fro_EyeLookAtOp`, `fro_LookAtDirectionOp`, `fro_EyeballTrackOp` | `_Update` `0x180071ed0`, `0x180071750`, `0x1800767b0`, `0x1800798c0`, `0x180079dd0`, `0x18007efd0` | MakeEyelids / MakeEyeRig sub-builders (inferred from address proximity; not read) |
| `fro_JawTissueDeflatorOp`, `fro_JawOpenerOp`, `fro_BetweenCurveOp`, `fro_LoftWithSpacingOp` | `_Update` `0x18008c9c0`, `0x18008c480`, `0x18008b1b0`, `0x18008d210` | owners of the Jaw*Property sets (inferred; not in this group) |

None of the `fro_*` `_Define` exports exist: these operators define their parameters at creation time (the map pipeline adds `Mode` itself).

### 2.5 Message texts
- MakeEyelids help (logged, then status `0x80020003`): "\nMakeEyelids HELP: [" + code + "]\n Not enough arguments were passed into Make Eyelids or arguments are of wrong kinds\n There are 2 ways of running MakeEyelids, either inputing proper arguments or from selection \n\t1.> MakeEyelids(Eye/*polymesh x3d object*/, Face/*polymesh x3d object*/, Curves/*collection of 2 crvlists*/,[EyeRigRoot /*null or model, optional*/]);\n\t2.> Select the 2 meshes in order: Eye and Face, and the 2 Curves: upper and lower and run > MakeEyelids();". Codes: 0 = no eye mesh, 1 = no face mesh, 2 = fewer than 2 curves.
- MakeEyeRig: "No Eye Ball inputs, Eyelook not created;".
- RegenerateEyelids worker: "Face Model Not Found; \nif FaceModel Exists check that:\n\t1.ActiveFaceRobot Property contains the Face Model Name\n\t2.Exit and restart the FaceRobot Application ", "Face Mesh Not Found", "Eye not found", "Guide Curves not found:\n\t1.Draw curves bordering eyelids, select them and run,\n\tfr_MakeEyelids()"; progress caption "Regenerating Eyelids ".
- fr_MakeNormalMap: "FR Game Export mesh not found", "Face Robot mesh not found, open a valid Face Robot Scene and try again", "Check At least one of the Generation Options", " Custom Stress Mesh NOT FOUND, Do you want to generate it ?" (title "SOFTIMAGE|Face Robot").
- fr_AnimateRegionMasks progress caption: "Plotting Masks Animation".

## 3. Contracts

### `AddFaceControl`: SPEC-PARTIAL
Wire contract:
- Arguments: `Position` (vector3, default (0,0,0)), `Scale` (double, 1.0), `Color` (long, 126), `Nom` (string, "Control"), `Model` (object, empty), `bHasOffsetParent` (bool, empty), `Keywords` (string, empty).
- Return: the created control null.

Behaviour: resolves the target model: `Model` itself when its type is `#model`, else the model owning `Model`; when `Model` is empty, the face model from `0x18000f3f0(1)` (inferred: get-or-create the face model). If `bHasOffsetParent` is true: the model's group `ControlParents` is created if missing, an offset null named `Nom` + a suffix (not read) is created at `Position` with size `Scale` * 0.2 and display value 0x232, and added to `ControlParents`. Then group `Controls` is created if missing; the control null `Nom` is created at `Position` under the offset null (or under the model) with size `Scale` and color `Color`; `0x180007380(null, "Control", "FaceControl")` tags it (inferred: a FaceControl marker property or keyword); the keyword string becomes `Control,` combined with `Keywords` and is applied by `0x18000b270` (inferred: user keywords); the null is added to `Controls`.

### `MakeFaceStructure`: SPEC-PARTIAL
Wire contract:
- Argument `FaceMame` (default "Head") is **not read** by `_Execute`.
- Return: a Model ref. `_Execute` returns a default-constructed Model, so the returned ref is invalid (inferred: the structure builder takes no output argument).

Behaviour (`0x18000ce80`): stores the 6-entry name table at `0x1802d0040` as session key `meshnames`; gets or creates the scene-root `ActiveFaceRobot` property (§2.3); finds the face model by the property's `FaceModel` name under the scene root, or when that is empty or invalid, gets one from `0x180009dc0`, else adds a model named `Face` under the scene root, then runs `0x180008410(model, "Face")`; writes the model's full name into `ActiveFaceRobot.FaceModel` and stores session key `FaceModel`. Then the four builders `0x18000a800`, `0x18000a6f0`, `0x18000a990`, `0x18000b3f0` run on the model (not read).

### `fr_MakeEyeBall`: SPEC-PARTIAL
Wire contract:
- Arguments: `inParent` (object), `inScale` (double), `inVector` (vector3), `inProp` (object: an EyeballProperties set or empty).
- Return: the created eyeball object.

Behaviour: parent = `inParent`, or the scene root when invalid. `0x18004b8c0` builds the eyeball: looks up `FaceModel`, reads `Scale`/`Size`/`Sclera`/`Sections`/`Center`/`CornealBulge`/`CorneaDetail`/`CornealBulgeFC` from the EyeballProperties (adding an `EyeballProperties` set when none is passed, inferred), creates the `Cornea` mesh with a `fro_CorneaOp` (ports `PrimOut`, `PrimIn`, `PropIn` in group `Main`) and a `CorneaPhong` Phong material whose `reflectivity` / `transparency` and colour `green`/`blue` channels are set (values not read). `0x18004c650` builds the `Iris` object with a `fro_IrisOp` using the same port names. Then the eyeball's global translation is set to `inVector`. Status always 0.

### `MakeEyeRig`: SPEC-PARTIAL
Wire contract:
- Arguments: `inEyes` (collection of eyeball objects), `inHeadNull` (object, optional).
- Return: an array: [rig root, LookAt control, per-eye controls...].

Behaviour: with an empty `inEyes`, logs "No Eye Ball inputs, Eyelook not created;" and returns an empty array. Otherwise builds the rig (sub-builders unread; `inHeadNull`, when valid, is used as the head reference), registers the look-at control as `controls`/`LookAt_Control`, and for each eye control names it `LEye_Control` when the eye's X > 0 else `REye_Control`, appending "0" until no child of the rig root has that name (at most 2 × eye-count tries), renames the control and registers it in `controls` under that name.

### `MakeEyelids`: SPEC-PARTIAL
Wire contract:
- Arguments: `inEyeGeo` (polymesh), `inFaceMesh` (polymesh), `inEyelidCurves` (collection of 2 crvlists), `inEyesParent` (null or model, optional).
- Return: array of created objects (empty when the build stage fails).

Behaviour: the selection is sorted into polymeshes, crvlists and nulls/models (`#model` or `null`). Missing arguments are filled from the selection in order: eye = first selected polymesh, face = next polymesh, curves = first two selected crvlists (when the argument has fewer than 2 entries), parent = first selected null/model or else the face mesh's model. Missing inputs log the help text (§2.5) with code 0/1/2 and return `0x80020003`. The driver uses the name parts `Cls`, `_Curve`, `Open`, `Closed`, `_Tug`, `_Parent`, `_Control`, `_Profile`, `_Reference`, `_Deformers`, `_Squint`, `_Tear`, `_Track`, `EyelidInnerCorner`, `EyelidOuterCorner`, `Eyes` and runs six stages (unread).

### `RegenerateEyelids`: SPEC-PARTIAL
Wire contract: no arguments. Return: array of regenerated objects (left then right).

Behaviour: shows a progress bar "Regenerating Eyelids "; runs the worker for side `L`, then `R`. The worker finds `FaceModel`, the face mesh (`meshes`/`Mesh`), the eye, `EyeRig_Root`, and the curves `EyelidUpper_Curve` / `EyelidLower_Curve`; it uses `SelectObj` and `DeleteObj` (inferred: deletes the old eyelid rig and rebuilds it through the MakeEyelids driver). Error texts in §2.5. Status always 0.

### `fr_GetEyelashMedian`: SPEC
Wire contract:
- Arguments: `Mesh` (object), `b_ChooseFront` (bool).
- Return: vector3, world-space position.
- Error: `0x80004005` when the mesh has no geometry.

Behaviour: takes the geometry's first cluster and the bounding box. Candidate points: when `b_ChooseFront` is true, points **not** in that cluster; when false, points in it. Among candidates it picks the one whose X is closest to the bounding-box reference X (inferred: the box centre X), falling back to a bounding-box-derived point when none qualifies; the chosen local position is mapped to world space with the object's global transform.

### `fr_AnimateEyes`: SPEC
Wire contract: no arguments, no return value, status 0.
Behaviour: opens the face model's `BlinkProperties` property with `InspectObj` (mode 1), always (no stage6ppg routing).

### `fr_EyelidsDeformCurves`: SPEC
Wire contract: no arguments, no return value, status 0.
Behaviour: shows the face model's `EyeProperties` property through the PPG routing of §2.2.

### `fr_EyelidsInfluenceMaps`: SPEC
Wire contract: no arguments, no return value, status 0.
Behaviour: shows the face model's `BlinkProperties` property through the PPG routing of §2.2.

### `fr_JawDeflationEaseInCurves`, `fr_JawFattening`, `fr_JawLowerDeflation`, `fr_JawSlidingEaseInCurves`, `fr_JawSliding`, `fr_JawUpperDeflation`: SPEC
Wire contract (all six):
- Argument `face` (string: the face model name/path, no default). Return: none. Status always 0.

Behaviour: builds the path `face` + suffix and shows it through the PPG routing of §2.2:

| Command | Path suffix |
|---|---|
| fr_JawDeflationEaseInCurves | `.JawEnd_Control.Deflation_Ease_In` |
| fr_JawSlidingEaseInCurves | `.JawEnd_Control.Sliding_Ease_In` |
| fr_JawFattening | `.BelowJawCurve_Trace.Fattening` |
| fr_JawSliding | `.JawSurface.Sliding` |
| fr_JawUpperDeflation | `.UpperJawCurve_TissueCurve.Upper_Jaw_Deflation` |
| fr_JawLowerDeflation | `.LowerJawCurve_TissueCurve.Lower_Jaw_Deflation` |

(The targets are presumably JawEaseInProperty / JawFatteningProperty / JawSlidingProperty / JawDeflationProperty sets, inferred from the layouts in §2.3.)

### `fr_MapRegion`, `fr_MapStress`, `fr_MapTendon`: SPEC
Wire contract (all three):
- Argument `inFace` (object: the face polymesh). Return: none (registry: no return value).
- Mode: 0 = region (`RegionMap`), 1 = stress (`StressMap`), 2 = tendon (`TendonStressMap`).

Behaviour (`0x18009bf20`):
1. Looks for the map named after the mode on cluster `WeightMapCls` of the face. If it exists, skip to step 7.
2. Collects clusters: for modes 0/1 every cluster carrying a `fro_RegionOp` (else a `Bulger` op) whose name contains `Region` (else `Bulger`); for mode 2 clusters carrying a `fro_TendonOp` (else `Tendon`) whose name contains `Tendon`. Records each cluster, its operator and the name prefix before that word.
3. From each operator reads input-port targets (modes 0/1: ports 2 (curve), 3 (slider), 8 (perc map), parameters `BaseLength`, `BaseMultiplier`; mode 2: ports 2 (control), 4 (slider), 8 (perc map), parameter `BaseDistance`). From the first operator: mode 0 also takes port 9 (wrinkle map) and, for modes 0/1, port 10 (multiplier parameter, may be absent); mode 2 takes port 3 (base kinematic state).
4. Adds a CustomProperty named `RegionMap`/`StressMap`/`TendonStressMap` on the face with one double per prefix (§2.3).
5. Creates the weight map with preset `WeightMap`, name = the map name, cluster-property label "Weight Map Property" (helper `0x1801a5a80`, inferred `CreateWeightMap`), and sets its display colour: mode 0 `red`=0, `green`=50, `blue`=255; modes 1/2 255/255/255; then `0x1801a6a90` on it (not read).
6. Creates `fro_MapRegionStressTendonOp`: port group `MainGroup` with I/O port `ioWeightMap` (the map); group `InputGroup` with `inUI` (the property of step 4), mode 0 `inWrinkleMap`, modes 0/1 `inMultiplier` (when valid), mode 2 `inBase`; group `InputGroupPerCluster` with, per cluster i, ports `<i>Cluster`, `<i>Slider`, `<i>PercMap`, `<i>BaseLength`, then mode 2 `<i>Control`, else `<i>BaseMultiplier` and `<i>Curve` (port names are the index text + the suffix, inferred from the string concatenation); parameter `Mode` (int4, default = mode, [0..2], capability value 14); then connects it.
7. Selects the map and sets `Views.ViewB.*.camvis.objctrlpropmaps` to true.
Errors: any step's failure status is returned; an unknown mode gives `0x8000ffff`.

### `fr_StartRegionPaint`: SPEC
Wire contract:
- Arguments: `inMesh` (object), `inRegionName` (string). Return: none.
- Error `0x80004005` when no cluster matches or it has no `Perc` property.

Behaviour: finds the first cluster of the mesh whose name begins with `inRegionName` (case-insensitive, compared over the length of `inRegionName`), takes its local property `Perc`, runs `ActivateObjectSelTool(0)`, `SelectObj(Perc)`, `SelectObj(mesh)`, and unless the active tool is already `BrushTool`, runs `PaintTool`. Status 0.

### `fr_ToggleShowMaps`, `fr_ToggleShowMapsUnselected`: SPEC
Wire contract: no arguments; no return value. Attribute: `attrselpropertymaps` (ToggleShowMaps), `attrunselpropertymaps` (Unselected).

Behaviour: reads `activecamera:b` from the layout view `frmviewmanager` (missing view: `0x80004005`). Empty camera name: returns status 1 without change. Camera `User`, `Front`, `Top`, `Spot` or `Right` becomes `Views.ViewB.<name>`; any other value is used as-is. The value `<camera>.camvis.<attr>` is read and set to its negation.

### `fr_ApplyStress`: SPEC-PARTIAL
Wire contract:
- Arguments: `StressMesh` (object), `OutPutMesh` (bool, default true). Return: none; status 0.

Behaviour: reads `FaceScale.Scale` from the face model; takes the `fro_RegionOp` operators on `StressMesh` (every second entry of the list starting at index 1); for each one stores the current `BaseLength`, writes a recomputed `BaseLength` (solver `0x18018bda0`, unread), logs "Evaluating Op " / "dBaseLength>>> " / "  NBaseLength>>> " through the debug logger `0x18018a1c0`, finds the operator's `FaceRegionProperties` and clamps its `Strength` to 1.0 when above 1.0 (old value kept). If `OutPutMesh`: runs `0x1801768d0` (inferred: duplicates the stressed mesh), stores session key `StressMesh` = the input mesh, then restores every saved `BaseLength` and `Strength`. When `OutPutMesh` is false the new values stay.

### `fr_MakeNormalMap`: SPEC-PARTIAL
Wire contract:
- Arguments: `xExportMesh` (object), `uvProp` (property), `gameProp` (property). Return: none; status 0.

Behaviour (strings only): reads from `gameProp` `RestNMapPath`, `ActiveNMapPath`, `RestMapName`, `StressMapName`, `Quality`, `Resolution`, `SubdLevel`, `Use_Custom_Mesh`, `Generate_Stress_Mesh`, `Generate_Stress`, `Generate_Rest`; needs at least one Generate option ("Check At least one of the Generation Options"); finds the Face Robot mesh (`meshes`/`Mesh`) and the session `StressMesh` (asks " Custom Stress Mesh NOT FOUND, Do you want to generate it ?"); toggles `visibility.viewvis` and `geomapprox.gapproxmordrsl` on the meshes; creates a `Ultimapper` property (`Tangent`, `Texcoord`, `Group`, `SuperSampling`, `MapPath`, `Prefix`, `Resolution`), a `Tangents` / `Vertex Color` map via `TangentOp3_cpp`, runs `FindUltimapperDistance` and `GenerateUltimapper` for the rest and stress maps (file suffix `_normal`), and calls `fr_ResetRetarget` before/after.

### `fr_MakeRegionMasks`: SPEC-PARTIAL
Wire contract:
- Arguments: `xLowResMesh` (object), `uvProp` (property), `gameProp` (property). Return: array (CRefArray) from the worker.

Behaviour (strings only): reads `Masks` (1..3 mask textures) from `gameProp`; adds a CustomProperty `RegionMasks` on the mesh; iterates the `fro_RegionOp` clusters of the Face Robot mesh; builds `Vertex Color` maps named `RegionMask_*` whose RGB channels are assigned the region names `ForeHead_R0`, `LCheek_G0`, `LNose_B0`, `RCheek_R1`, `RNose_G1`, `Brow_B1`, `LJaw_R2`, `RJaw_G2`, `Chin_B2` and `ForeHead_R0`/`Left_G0`/`Right_B0`, `Brow_R1`/`LJaw_G1`/`RJaw_B1` (channel layouts depend on `Masks`); calls `fr_ResetRetarget`.

### `fr_AnimateRegionMasks`: SPEC-PARTIAL
Wire contract:
- Arguments: `xExportMesh` (object), `gameProp` (property), `Start` (long), `End` (long). Return: none.
- Status 0, or `0x80004005` if the progress bar is cancelled.

Behaviour: progress bar "Plotting Masks Animation" (max 9); reads `Masks` from `gameProp`; fills nine name lists (`0x180191490`); takes the 9 parameters of the export mesh's `RegionMasks` property and plots parameters 0-2 always, 3-5 when `Masks` >= 2, 6-8 when `Masks` >= 3, each over frames `Start`..`End` (`0x180191f00`, unread), incrementing the progress bar after each.

### `fr_RemoveTongue`: SPEC
Wire contract:
- Argument `DeleteMesh` (bool, default false). Return: true.

Behaviour: looks up `meshes`/`Tongue`; for each of `TongueBack_Control`, `TongueFront_Control`, `TongueTip_Control`, `TongueBase_Control` found in `controls`, deletes the object (`0x1801a5c20`, inferred DeleteObj) and removes the dictionary entry. If `DeleteMesh` is true the tongue mesh is deleted; otherwise, when present, `ClearUserKeyword(<tongue full name>)` runs and the mesh is re-parented under the scene root. Then the `groups`/`Tongue` group loses all members, the `meshes`/`Tongue` entry is removed, and `0x180118890` runs (unread; inferred UI refresh). Status 0.

## 4. Registry cross-check (args_c.json)
- Every argument name, order and default agrees with the `_Init`s read (jaw `face`, map `inFace`, AddFaceControl, fr_MakeEyeBall). AddFaceControl `Position` default in the registry is a Python ISIVector3 object; the binary's default is the zero vector (0,0,0).
- `_Init`s not decompiled (MakeFaceStructure, MakeEyeRig, MakeEyelids, RegenerateEyelids, fr_GetEyelashMedian, fr_StartRegionPaint, fr_ToggleShowMaps*, fr_ApplyStress, fr_MakeNormalMap, fr_MakeRegionMasks, fr_AnimateRegionMasks, fr_RemoveTongue): argument names used in `_Execute` (by index or name) match the registry order.
- MakeFaceStructure `FaceMame` (sic, default "Head") is never read by `_Execute`.
- fr_ToggleShowMaps / fr_ToggleShowMapsUnselected descriptions "Toggle Show Maps For Selected Objects" / "... Unselected Objects" match the attribute choice.
- fr_MakeRegionMasks has `return_value` false in the registry but `_Execute` puts a `ReturnValue` (an array); fr_MapRegion/Stress/Tendon `_Init` calls EnableReturnValue (argument not resolved) but puts no return value.

## 5. Open questions
- Q1. MakeFaceStructure: does `0x18000ce80` really take no output model (so the command returns an invalid ref), and what are the six names at `0x1802d0040`?
- Q2. AddFaceControl: the offset-parent name suffix and the meaning of display value 0x232; what `0x180007380` adds ("Control" / "FaceControl").
- Q3. EyeballProperties `SynopticPath`: is `TitlebarSynoptic` the default value or the script name?
- Q4. Who adds the parameters of FaceDeformProperties and the four Jaw*Property sets, whose `_Define` is empty (`0x18008aee0`)?
- Q5. FaceRegionProperties `Bulge` / `EaseIn` default curves (`0x1800fc170`, `0x1800fbf20`) and the capability flag set on `Bulge`.
- Q6. Map pipeline: confirm the weight-map helper `0x1801a5a80` is `CreateWeightMap` and what `0x1801a6a90` does after it.
- Q7. fr_GetEyelashMedian: which bounding-box value is the X reference (centre X assumed).
- Q8. fr_ApplyStress: the BaseLength formula (`0x18018bda0`) and what `0x1801768d0` creates.
