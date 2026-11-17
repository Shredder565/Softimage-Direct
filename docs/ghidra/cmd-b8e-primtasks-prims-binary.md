# CMD-B8e: Primitive getters, instancing and misc commands read from `primtasks.dll`

Row: **CMD-B8e**. Status: **SPEC** (10 names), **SPEC-PARTIAL** (4 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\primtasks.dll`, image base `0x180000000`, sha256 `f7dab2ef...9f113a74`.
Method: Ghidra decompilation of the task methods of 13 handler classes, plus local static
reads (vtables, GUID bytes, strings, small thunks). Everything below is behaviour read from
the binary unless marked `(inferred)`. No decompiler output or disassembly is reproduced.
Nothing was executed; no XSIBATCH golden.

## 1. Handler table

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `SIGetRigidCns` | `5b102c14-05e9-4285-a18b-3ccc5280dce3` | `0x180028390` | `0x180040180` | Do `0x18000ec60` -> private iface slot 9 `0x18000ea20` -> task slot 15 worker `0x18000e260` (creator `0x18000e7a0`); Undo `0x18000f180`; Redo `0x18000ed20` | `0x18000f640` | `0x18000f270` |
| `SIAssembleNurbsMesh` | `e900e81a-1449-11d3-b803-00a0243e3694` | `0x1800286d0` | `0x18004e7d0` | Do `0x180031330` -> worker `0x180031030` (input filter `0x1800307d0`, builder `0x18002db90`); Undo `0x1800313e0`; Redo `0x180031370`; OnUpdateUI `0x180031530` | `0x180031740` | `0x1800316d0` |
| `SIGetPrimLight` | `af3aae91-d26f-11d2-a019-0000f875df68` | `0x180028550` | `0x1800448b0` (locator's first pick `0x180044860` is the COM-object part) | Do `0x18001b680` -> worker `0x18001aea0`; Undo = imported `UndoTasks`; Redo = imported `RedoTasks` | `0x18001b900` | `0x18001b770` |
| `SIGetPrimCamera` | `c2051a90-7a6e-11d2-a938-00a024190119` | `0x180028010` | `0x180038d80` | Do `0x180021fb0` (shared) -> iface slot 9 `0x180005d20` -> task slot 16 worker `0x180004e60`; pose setup slot 15 `0x180005810`; Undo `0x1800221b0`; Redo `0x180022080` | `0x180022400` (shared) | `0x180006150` |
| `SIGetPrimSpotLight` | `6b0736c4-82f0-11d2-88ad-00a0c9067c03` | `0x180028750` | `0x180048ac0` | Do `0x180021fb0` (shared) -> iface slot 9 `0x180021660` -> iface slot 11 worker `0x1800219e0`; pose setup slot 15 `0x180021480`; Undo `0x1800221b0`; Redo `0x180022080` | `0x180022400` (shared) | `0x180022260` |
| `SIGetPrimLattice` | `afd20460-83db-11d2-a939-00a024190119` | `0x180028510` | `0x180043fc0` | Do `0x18001a330` -> worker `0x180019ae0` (input filter `0x18001a780`); Undo `0x18001a490`; Redo `0x18001a3c0`; OnUpdateUI `0x18001a4e0` | `0x18001a6c0` | `0x18001a640` |
| `SIGetPrimVolumeDeform` | `7f788cdc-3943-4e9d-839d-b26dc86054a8` | `0x1800287d0` | `0x18004a590` | Do `0x180025200` -> worker `0x180024a30` (input filter `0x1800257c0`, fit helper task ctor `0x1800245e0`); Undo `0x1800253a0`; Redo `0x180025380`; OnUpdateUI `0x1800253c0` | `0x180025620` | `0x180025500` |
| `SIInstantiate` | `177b5057-fb54-45cf-afac-60fdfb0c58b4` | `0x1800284d0` | `0x1800432c0` (first pick `0x180043260` is the outer object part) | Do `0x180018bd0` -> worker `0x180017ac0` (input filter `0x180016f90`, per-instance creator `0x180018480`, parameter setter `0x1800193b0`); Undo = imported `UndoTasks`; Redo `0x180018c50` | `0x1800195f0` | `0x180019200` |
| `GetMaster` | `c536b66e-0c88-4b9d-9eff-34d04d60bd66` | `0x1800282d0` | `0x1800434e0` | Do `0x180018ba0` -> worker `0x1800175f0` | `0x1800194d0` | `0x1800191b0` |
| `GetInstances` | `48492eb6-da48-406e-bcea-d1f8e0efc92b` | `0x180028290` | `0x1800435f0` | Do `0x180018ba0` (shared) -> worker `0x1800173e0` | `0x1800194d0` (shared) | `0x1800191b0` (shared) |
| `GetURLAt` | `fac83696-47a1-40fe-86db-dde2a087bdd5` | `0x180028410` | `0x180041320` | Do `0x180010dc0` -> worker `0x180010bc0` (collector `0x180010fa0`); Undo/Redo return `0x80004001` | `0x180010ec0` | `0x180010e00` |
| `ImportEPS` | `65cc25d5-8d3f-4054-ac6d-0b3d4ca4abe6` | `0x180028490` | `0x180042540` | Do `0x180014fd0` -> worker `0x180014a90` (parsers `0x180012270`, `0x1800152a0`; curve builder `0x180012520`); Undo `0x180015040`; Redo `0x180015000` | `0x180015ef0` | `0x180015250` |
| `GetNbTriangles` | `9a88ed34-d7fb-11d3-b497-009027bc38d5` | `0x180028310` | `0x18003ec90` | Do `0x18000c2e0` -> `sigeneral`/helper imports `SIValidateObjects`, `SIGetNbTriangles`; Undo/Redo return `0x80004001` | `0x18000c4d0` | `0x18000c440` |
| `SIAssignMaterial` | `b81121a4-7ef2-4606-bef3-f9b01f582e35` | not in this DLL | - | not implemented here; only a caller at `0x18002bd90` | - | - |

## 2. Shared facts

### 2.1 Sub-task classes created by these handlers

All of the creating commands are compositions of other task classes obtained with
`SICreateInstance(CLSID, IID)` and run through a private "execute" method of that class.
A sub-task that ran with status `0` on a first (undoable) execution is appended to the
command's own task list with `C3DCoreBaseTask::AddTask`, which is what makes
`UndoTasks` / `RedoTasks` work.

| CLSID (IID) | Registry name | How it is used here |
|---|---|---|
| `29668d60-591f-11d1-bafa-444553540000` (`e3b60611-7db8-11d2-ac53-00a02485cecb`) | `SIGetPrim` | slot 9: (preset, name, parent, addToScene, flag, out primitive, out 3D object); slot 10: same but the first argument is a primitive class GUID instead of a preset |
| `a0d59008-3e15-11d3-8bac-00a024ee586f` (`a0d59009-...`) | `Add3DObjectToScene` | slot 9: (object list, parent, flag) |
| `ce420851-b9eb-11d2-ac6e-00a02485cecb` (`ce420850-...`) | `SIApplyConstraint` | slot 10: (constraint class GUID, constrained list, constraining list, vector, 0, 0, flag, out operator list) |
| `c089b901-8481-11d2-b118-00a024c79287` (`c089b902-...`) | `SetValue` | slot 11: (owner, parameter GUID, variant value, time or 0, flag, 0) |
| `46cee370-8bb2-11d2-ac56-00a02485cecb` (`46cee371-...`) | `ApplyOperator` | slot 9 (preset form) / slot 10 (operator class GUID form): (preset-or-GUID, connection set, 3, flag, out, 4) |
| `90e7afe3-c38b-11d2-ac73-00a02485cecb` (`90e7afe4-...`) | `ParentObj` | slot 9: (parent, child list, flag) |
| `dd531990-ccc2-11d2-ac73-00a02485cecb` (`dd531992-...`) | `DeleteObj` (generic delete) | slot 9: (list, 0, flag); used to implement Undo of commands that create one object |
| `79581ba0-99bb-11d2-8bbb-00aa00135f7b` (`7a1141d0-b800-11d3-8c0b-009027bc3a0e`) | `SelectObj` family | slot 10: (list, 1, 0, 0) |
| `bcb70445-0a0d-11d3-ac82-00a02485cecb` (`bcb70446-...`) | `SICreateModel` | slot 9: (0, name, 0, 0, flag, out model) |
| `6fa26e30-7fe6-11d2-a938-00a024190119` (`6fa26e31-...`) | `SIAddProp` | slot 10: (property class GUID, object list, 2, 0, flag, out list) |
| `c5dc6089-0efd-4361-a84f-0840b708a657` (`b394fc31-166f-11d2-ac38-00a02485cecb`) | `InitPropVolume` (command GUID `6b840483-675e-42f7-a311-c383712da942`) | executed with an exec context whose `InputObjs` is the list of new volume properties |
| `747d257f-d01b-11d2-80c4-00a0c9ac19a9` | `SIDuplicate` | material copy path of the NURBS assemble helper |
| `c536b66f-0c88-4b9d-9eff-34d04d60bd66` (`dbf23052-b132-4580-82c7-babeb462b7bf`) | not in the registry | slot 9: (master model, new model, flag); binds a new model to its master *(inferred from position in `SIInstantiate`)* |
| `719498ca-0dea-4f59-b372-39b351255cb8` | not in the registry | slot 9: (instance list, master list, flag); purpose not read |

### 2.2 Interfaces and constants

- Object list IID `f49f6470-4211-11d0-8463-00a024c7919c`, list class `f49f6471-...`. 3D object
  IID `6b579d20-3dc5-11d0-9449-00aa006d3165`. Component hierarchy IID
  `4aeaeaea-1a43-11d2-8d66-00a0c982a649`. Element reference class/IID
  `107dcd80-4228-11d0-8463-00a024c7919c` / `872903d0-3ef3-11d0-8463-00a024c7919c`.
- Primitive IID `cdea6775-415b-11d0-aa40-00a0243e34c4`; light primitive IID
  `e9f25e60-520d-11d0-8298-00a0243e366b`; camera primitive IID
  `1152e9b0-545e-11d0-8466-00a024c7919c`; parameter-by-id access IID
  `6de1b670-8072-11d5-aeed-0090275802c9`.
- Kinematics lookup pair used for "global transform" access: `783879e2-5300-11d2-8b57-00a024ee586f`,
  `d557cf36-57e3-11d2-8b5a-00a024ee586f` *(meaning inferred)*.
- Primitive class GUIDs seen: camera interest `9694b47e-c847-11d3-b7d4-0008c7a011a6`, spot
  interest `49086e62-cd0b-11d3-a88b-00c04f8edf15`, NURBS surface mesh `28dec312-62b3-11d1-b79b-00a0243e3694`
  (geometry IID `e14a9f53-6cc4-11d1-b79b-00a0243e3694`), NURBS curve list
  `28dec317-62b3-11d1-b79b-00a0243e3694` (geometry IID `e14a9f51-...`), light classes
  `fb363400` / `fb363401` / `fb363402` (spot) / `fb363403` `-6ddc-11d2-9551-00a0243e364f`.
- `SIGetPrim` returns the pair (primitive, 3D object) in that order; every getter below
  forwards those two unchanged to its outputs.
- Output object arguments are written as `VT_UNKNOWN` (`0xd`) by name through the helper
  `0x1800059f0` or `C3DExecContextHelper::SetArgValueFromName`.
- Status merging: `0x562e80c7` ("success with note") is sticky across steps; any negative
  status aborts the worker and is returned.

## 3. Contracts

### `SIGetRigidCns`: SPEC

**Wire contract.**

- Purpose: create a primitive from a preset (a rigid constraint object), optionally write a
  SPDL file for it, optionally add it to the scene.
- Arguments (registry order; names confirmed in UnPackArg):
  1. `PresetObj` (in, preset, converted by arg handler `42fc2493-...`) read with `F3DCmdGetPreset`; failure aborts.
  2. `FileName` (in, string, default `""`).
  3. `Name` (in, string, default `""`).
  4. `Parent` (in, object; read as an element reference and resolved to a 3D object; absence is not an error).
  5. `AddToScene` (in, boolean, default `True`).
  6. `Value` (out): the created 3D object.
  7. `Primitive` (out): the created primitive.
- Steps:
  1. Object name = `Name` if non-empty, otherwise `FileName`.
  2. The preset's class id is read; an object is created with `DSCreateObjectFromPreset`
     and queried for the primitive interface. When the creation call reports status `1`
     the preset is additionally applied to the new object through its persistence interface
     (`00000109-0000-0000-c000-000000000046`); failure to get that interface is `0x8000ffff`.
  3. `F3DCreate3DObjectFromPrimitive(primitive, name)` builds the 3D object.
  4. When `FileName` is non-empty: the path `<factory path>\Application\spdl\<FileName>.spdl`
     is built (the `spdl` directory is created if it does not exist) and handed to the
     primitive through interface `a896d510-2969-43ec-b457-a8816808f906` (slot 6). On a first
     execution the file name is remembered for Redo. *(Meaning "associate / write the SPDL
     file" inferred.)*
  5. When `AddToScene` is true: an `Add3DObjectToScene` sub-task is run with a one-item
     list holding the new object and `Parent`.
  6. Outputs are set (`Value` = 3D object, `Primitive` = primitive).
- Undo: runs `UndoTasks`, then releases the recorded creation through the recorder object
  (returns `0x8000ffff` if nothing was recorded). Redo: recreates the object from the
  recorded preset or class id with the same name, re-associates the SPDL file, runs
  `RedoTasks`; when `AddToScene` was false the recreated object is put in the transient
  object container (`F3DAddObjectToTransientObjectContainer`).
- Errors: null preset `0x80004003`; class id all zero with no preset `0x80004005`;
  allocation `0x8007000e`.

### `SIAssembleNurbsMesh`: SPEC-PARTIAL

**Wire contract.**

- Purpose: build one NURBS surface mesh object from several surfaces (description:
  "Build SCM Topology").
- Arguments: `InputObj` (in, list, read with `F3DCmdGetInputObjects`), `Tolerance`
  (in, double, default `0.15`), `CopyUserCluster` (in, boolean, default `False`),
  `CopyMaterial` (in, boolean, default `False`), `CenterGeomCenter` (in, boolean, default
  `True`), `OutputObj` (out, the new 3D object).
- Input filter (`0x1800307d0`): each list item is either a whole object or a
  sub-component selection (item kind `7`). A sub-component item is accepted only when its
  sub-component type GUID is `3df7f9e0-89ee-11d0-9964-00a0243f0e60` *(surface sub-component,
  inferred)*; its index list is kept per input. An item is kept only if the owning object
  yields NURBS surface mesh geometry (`e14a9f53-...`) at the current time. The filtered
  list, the per-input index arrays and their counts are stored on the task.
- Steps: clear sub-tasks; filter; if the filtered list is empty nothing is created.
  Otherwise a new surface mesh primitive and 3D object are created through `SIGetPrim`
  slot 10 with class `28dec312-...`, empty name, no parent, add-to-scene `1`. A helper
  object (`0xf0` bytes, ctor `0x18002a300`) then: collects each input's geometry and global
  transform at the current time, hands the set to the new geometry, runs the assembly
  with the per-input sub-surface selections, applies `Tolerance` to the new geometry
  (geometry slot 21), and runs three follow-up stages (`0x18002a8f0`, `0x18002e5e0`,
  `0x18002a660`) that receive the `CopyUserCluster`, `CopyMaterial`, `CenterGeomCenter`
  flags *(cluster copy, material copy, centring: inferred from the flags and from the
  material helper below)*.
- Material copy helper `0x18002bd90`: when `F3DMaterialLibraryEnabled()` is true it creates
  the `SIAssignMaterial` task (`b81121a4-...`, IID `82fa84cd-bbb1-4e00-be0a-afca47231ffd`) and
  calls its slot 10 with (target, 0, source material, out, 0); otherwise it duplicates the
  material with the `SIDuplicate` task and attaches the copy to the target.
- Enable condition (OnUpdateUI): enabled only when the input list is non-empty and every
  input passes the filter.
- Undo: runs a generic delete task on the output object (created on first undo, re-run
  afterwards); Redo undoes that delete. Both return `0x8000ffff` when the command was
  not executed undoably.
- Missing: the assembly itself (`0x18002bfb0`) and the three follow-up stages were not read.

### `SIGetPrimLight`: SPEC

**Wire contract.**

- Purpose: create a light from a preset; when the light is a spot, also create its interest.
- Arguments: `PresetObj` (in, preset; failure aborts), `Name` (in, string, default `""`;
  used only when non-empty), `Parent` (in, **string**, default `""`; when non-empty it is
  resolved with `F3DGet3DObjectFromName` and a failed lookup aborts the command),
  outputs `3DObject`, `3DObjSpotInterest`, `PrimObj`, `PrimObjSpotInterest`.
- Steps:
  1. `SIGetPrim` slot 9 with (preset, `Name`, parent object, add-to-scene `1`); sub-task recorded.
  2. `PrimObj` = the primitive's light interface; `3DObject` = the 3D object.
  3. The primitive's parameter with id `2` is read; when its integer value is `2`
     *(light type = spot, inferred)* the spot light task class (`6b0736c4-...`, IID
     `2ed78d50-8301-11d2-88ad-00a0c9067c03`) is created and its interest worker (slot 11,
     the same code as `SIGetPrimSpotLight` step 2 onward) is run with interest name
     `Name + "_Interest"`, the same parent, add-to-scene `1`. It fills
     `3DObjSpotInterest` and `PrimObjSpotInterest`; sub-task recorded.
  4. For any other light type the two interest outputs stay empty.
- Undo / Redo: `UndoTasks` / `RedoTasks` of the recorded sub-tasks.
- Errors: null exec context `0x80004003`; out of memory copying the name `0x8007000e`.
- Note: the class has a second entry (slot 10, `0x18001b2d0`) that takes a light class
  GUID instead of a preset (`fb363402-...` goes to the spot task, `fb363400/01/03` to
  `SIGetPrim`); it is not used by the command path.

### `SIGetPrimCamera` / `SIGetPrimSpotLight`: SPEC

Both commands use the same `Do` (`0x180021fb0`) and `UnPackArg` (`0x180022400`); they are
two classes of one template and differ only in the points listed at the end.

**Wire contract.**

- Arguments: `PresetObj` (in, preset; failure aborts), `Name` (in, string, default `""`),
  `InterestName` (in, string, default `""`), `Parent` (in; fetched as a 3D object pointer
  with `F3DGetArgPtrValueFromName2`, the result is not checked, so an absent or
  non-object value means "no parent"; the registry types it as an object for the camera
  and as a string for the spot light), then four outputs:
  camera `3DObjCamera`, `3DObjCameraInterest`, `PrimObjCamera`, `PrimObjCameraInterest`;
  spot `3DObjSpot`, `3DObjSpotInterest`, `PrimObjSpot`, `PrimObjSpotInterest`.
- Steps (add-to-scene is hard-wired to `1`):
  1. Clear sub-tasks. `SIGetPrim` slot 9 with (preset, `Name`, `Parent`, `1`) creates the
     main primitive and 3D object.
  2. `SIGetPrim` slot 10 with the interest class GUID, `InterestName`, the same `Parent`,
     `1`, creates the interest primitive and 3D object (a sibling of the main object).
  3. `SIApplyConstraint` slot 10 with constraint class `98cad7d1-393a-11d2-8b40-00a024ee586f`
     *(direction constraint, inferred)*, constrained = main object, constraining =
     interest, direction vector `(0, 0, -1)`.
  4. Pose setup (slot 15): on the new constraint, parameter id `4` is set to boolean true;
     `F3DSetPoseFromLookat(main object, position, interest, up)` is called with the
     class defaults below; the interest's global position is set to `(0, 0, 0)`
     (compensation mode from `F3DGetCompensationMode` is honoured).
  5. Camera only: three `SetValue` sub-tasks copy render preferences onto the camera
     primitive: parameter `130500f3-3664-11d0-850b-00a02417d029` = preference
     `output_format.picture_ratio` (double), parameter `3e03e0f6-773b-11d3-a295-08003658d403`
     = `output_format.roto_pixel_ratio` (double), parameter
     `658f6c10-cb80-11d2-8bcd-00aa006130ef` = `output_format.picture_standard` (long). Then
     the look-at triple read back with `F3DGetLookat` is pushed into the camera primitive
     (slot 30).
  6. On a first execution soft references to the main object, the interest and the
     constraint are stored for Redo.
  7. Outputs: main 3D object, interest 3D object, main primitive (queried for the camera
     or light primitive interface), interest primitive.
- Undo: `0x8000ffff` when not executed undoably, otherwise the sub-tasks are undone
  *(only the guard was read; the rest is inferred)*.
  Redo: `RedoTasks`, the three soft references are resolved again and the pose setup of
  step 4 is repeated.
- Errors: null preset `0x80004003`.

How the two differ:

| | `SIGetPrimCamera` | `SIGetPrimSpotLight` |
|---|---|---|
| Interest class GUID | `9694b47e-c847-11d3-b7d4-0008c7a011a6` | `49086e62-cd0b-11d3-a88b-00c04f8edf15` |
| Default position | `(0, 2, 20)` | `(3, 3, 3)` |
| Default interest / up | `(0, 0, 0)` / `(0, 1, 0)` | `(0, 0, 0)` / `(0, 1, 0)` |
| Extra step | output-format preferences and look-at pushed to the camera primitive (step 5) | none |
| Main primitive output interface | camera `1152e9b0-...` | light `e9f25e60-...` |
| Output argument names | `...Camera...` | `...Spot...` |

### `SIGetPrimLattice`: SPEC

**Wire contract.**

- Arguments: `PresetObj` (in, preset, required), `InputObjs` (in, list, required to be
  fetchable; may be null), `Name` (in, string), `Parent` (in, 3D object, optional),
  `PrimObj` (out, primitive), `Value` (return, the lattice 3D object).
- Steps:
  1. Clear sub-tasks. When `InputObjs` is given: sub-component selections are turned into
     clusters with `F3DConvertSubElemsToClusters(list, flag, 0, out list, null, out tasks, 2)`
     (cluster-creation tasks recorded); the result is filtered by `0x18001a780`, which
     keeps the items to which the lattice operator class
     `4f27cc01-8ab0-11d0-b07e-00a024c79287` can connect. Some items rejected: warning log
     (severity `4`, message id `0x2d`) and the command continues. Filter failure: error
     raised (`0x80004005`, severity `2`, message id `0x2e`) and the command stops.
  2. `SIGetPrim` slot 9 with (preset, `Name`, **no parent**, add-to-scene `1`).
  3. When there are valid inputs: the lattice primitive is first given the inputs (slot 7;
     *fitting the lattice to the inputs, inferred*); then for each valid input an
     `ApplyOperator` sub-task (slot 10) is run with operator class `4f27cc01-...` and a
     two-entry connection set {input, lattice object}, connection mode `3`, last argument `4`.
  4. When `Parent` is given and is not a reference object (`F3DIsAReference(parent, 1)` is
     false): a `ParentObj` task parents the lattice under it; the task is kept on the
     command for undo.
  5. With no `InputObjs` at all, steps 3 and 4 are skipped: the lattice is created at
     the scene root, unconnected, and `Parent` is ignored.
  6. Outputs: `Value` = 3D object, `PrimObj` = primitive (only on success).
- Enable condition (OnUpdateUI): reads an argument named `InputObj` (singular) and
  enables the command when the filter reports success on it.
- Undo / Redo (`0x18001a490` / `0x18001a3c0`): not decompiled; they operate on the recorded
  sub-tasks and the kept `ParentObj` task *(inferred)*.

### `SIGetPrimVolumeDeform`: SPEC-PARTIAL

**Wire contract.**

- Arguments: same six as `SIGetPrimLattice`. In UnPackArg the `InputObjs` list is passed
  through a list-conversion service (`24be99c0-5eb6-11d2-8bb0-00aa00135f7b`, slot 26) and
  replaced by its result *(expansion of the selection, inferred)*.
- Steps:
  1. Clear sub-tasks. When `InputObjs` is non-empty: sub-components are converted to
     clusters as for the lattice (tasks recorded); the filter `0x1800257c0` keeps the items
     that can take operator class `3afc75c0-fbdf-47f9-b01d-0c61a3632c52`; a non-zero filter
     result logs a warning (severity `4`, message id `0x29`).
  2. `SIGetPrim` slot 9 with (preset, `Name`, `Parent`, add-to-scene `1`): here the
     parent is honoured by `SIGetPrim` directly.
  3. When there are valid inputs: a helper sub-task (`0x90` bytes, ctor `0x1800245e0`, given
     the primitive and the input list) is recorded; the command preset `PropVolume` is
     loaded with `SILoadCmdPreset`; for each valid input an `ApplyOperator` sub-task (slot 9,
     preset form) is run with the connection set {input, volume object}, mode `3`, last
     argument `4`, and every created property is collected.
  4. When at least one property was created, an `InitPropVolume` command is executed on
     an exec context whose `InputObjs` is the collected list; recorded as a sub-task.
  5. Outputs: `Value` = 3D object, `PrimObj` = primitive (only on success).
- Enable condition: as for the lattice (argument name `InputObj`).
- Missing: what the helper sub-task `0x1800245e0` does with the primitive and the inputs
  (presumably sizing the volume to them), and Undo / Redo (`0x1800253a0` / `0x180025380`).

### `SIInstantiate`: SPEC

**Wire contract.**

- Purpose: low-level creation of model instances.
- Arguments: `InputObjs` (in, list), `NbItems` (in, long, default `1`; a value below `1`
  fails UnPackArg with `0x80070057`), `Name` (in, string, default `""`; used only when
  non-empty), `Value` (return, list of created instance models).
- Steps:
  1. Input filter (`0x180016f90`): each item is resolved to a model (interface
     `3ded5562-0bb6-11d3-ac82-00a02485cecb`); non-models are dropped; an item that is itself
     an instance is replaced by its master.
  2. If the filtered list is empty (or the count is zero) message id `0x1c` is logged
     (severity `2`) and raised with `0x80004005`; the worker returns `1`. An item that fails
     the model test inside the loop raises the same message but the loop continues.
  3. For each master, `NbItems` times (per-instance creator `0x180018480`):
     - instance name = `Name`, or `<master name>_Instance` when `Name` is empty;
     - `SICreateModel` creates an empty model with that name;
     - task `c536b66f-...` is run with (master, new model) *(binds the instance to its
       master, inferred)*;
     - `SIAddProp` adds a property of class `11ebe301-a20c-11d0-8478-00a024c7919c` to the
       new model (mode `2`);
     - four `SetValue` sub-tasks set boolean true at the current time on that property's
       parameters `c27f563a-06ae-11d1-8016-00a0c9067e61`, `f673b513-04a8-11d1-8016-00a0c9067e61`,
       `28f5c0a9-18ed-11d3-959d-00a0243e364f`, `28f5c0a7-18ed-11d3-959d-00a0243e364f`.
  4. Per master, after its instances exist: task `719498ca-...` is run with (new
     instances, {master}) and `Add3DObjectToScene` puts the new instances under the
     **master's parent**; the instances are appended to the result list.
  5. On a first execution a soft reference to the input list is kept for Redo.
- Undo: `UndoTasks`. Redo: clears the sub-tasks, resolves the input list reference and
  runs the whole worker again (`0x8000ffff` when not executed undoably).

### `GetMaster`: SPEC

**Wire contract.**

- Arguments: `InputObjs` (in, list), `Value` (return, object).
- UnPackArg takes the **first** item of the list only; an empty list raises message id
  `0x3fc` with `0x80070057`.
- Worker: the item is queried as a 3D object and tested with `F3DObjIsInstance`. When it
  is an instance, `Value` is its master model; otherwise `Value` is left unset (the return
  argument is not written). `Do` returns `0` unless a call fails.
- Not undoable in the sense of changing anything: no scene change.

### `GetInstances`: SPEC

**Wire contract.**

- Arguments and UnPackArg as `GetMaster` (first item only, same error).
- Worker: the item is queried as a model (`3ded5562-...`); its owner relations are
  enumerated (model slot 5); each is queried through `eff95861-6291-11d1-be9e-00a024ee478d`
  for its kind; the first relation of kind `2` supplies the result (relation slot 10)
  *(kind 2 = the instance group of the master, inferred)*. If the item is not a model or
  no such relation exists, `Value` is null and nothing is written back.

### `GetURLAt`: SPEC

**Wire contract.**

- Arguments: `InputObjs` (in, list), `View` (in, long, default `0`), `X` (in, long, default
  `-1`), `Y` (in, long, default `-1`), `Value` (return, string, default `""`).
  The decompiler shows `View`, `X`, `Y` taken as the low 16 bits, sign-extended
  *(width as shown by the decompiler; treat as unverified)*.
- Worker: for each input an object implementing `6e7e58d0-604f-4581-bd68-6769376211d3` is
  looked for, first on the item itself, then on the primitive of the item's object. The
  collector fails with `0x80004005` when none is found and returns `0x562e80d2` for an empty
  list. Each collected object is asked (slot 3) for the URL at (`View`, `X`, `Y`); the first
  one that answers with status `0` supplies the string.
- Return: the string, or `""` when no object answered. `Do` returns `0` unless a call
  failed. Undo and Redo return `0x80004001` (not implemented): the command changes nothing.

### `ImportEPS`: SPEC-PARTIAL

**Wire contract.**

- Purpose: import an EPS / AI file as one curve list object.
- Arguments: `FileName` (in, string, required), `Parent` (in, 3D object, optional),
  `UpdateSelection` (in, boolean, default `True`; read into the task but **not consulted**
  by the worker), `Value` (out, the created 3D object).
- Options read: none besides the arguments (no preferences, no dialog).
- Steps:
  1. Clear sub-tasks. The file is opened in text read mode; if it cannot be opened the
     worker returns `1` with no message and nothing is created.
  2. First pass `0x180012270` over the file; the parse state is reset; the file is opened
     again and the second pass `0x1800152a0` fills the path data and returns the
     bounding box (min x, min y, max x, max y) as floats.
  3. Object name = the file name without directory, with a trailing `.eps` or `.ai`
     extension removed (case-insensitive); other extensions are kept.
  4. `SIGetPrim` slot 10 creates a primitive of class `28dec317-62b3-11d1-b79b-00a0243e3694`
     (NURBS curve list) with that name, `Parent`, add-to-scene `1`, flag `0`.
  5. The builder `0x180012520` writes the parsed paths into the curve list geometry with
     scale `0.05` and offset `(-(minX+maxX)/2, -(minY+maxY)/2)`, i.e. the drawing is centred
     on the origin.
  6. The new object is selected through the `SelectObj` task (slot 10 with a one-item
     list and mode `1`), regardless of `UpdateSelection`.
  7. On a first execution a reference to the object is kept for Undo. `Value` = the 3D object.
- Undo: a generic delete task deletes the created object (`0x8000ffff` when not executed
  undoably). Redo: undoes that delete.
- Missing: the two parser passes and the curve builder (which EPS operators are
  understood, degree and closing of the curves) were not read.

### `GetNbTriangles`: SPEC

**Wire contract.**

- Arguments: `InputObjs` (in, list), `Value` (return, long, default `0`).
- Steps: a null list is `0x80004003`. `SIValidateObjects(list, "geometry", out list)` keeps
  the items that are geometry. Failure raises message id `0x4b` with `0x80004005`; status
  `0x562e80d2` or `0x562e80c7` logs message `0x4b` (severity `4`) and returns `0x562e80c7`
  without counting; status `1` (some items rejected) logs the same warning and continues.
  `SIGetNbTriangles(valid list, out count)` then gives the total.
- Return: the count as `VT_I4` (written only when the list argument was present).
  Undo / Redo return `0x80004001`.

### `SIAssignMaterial`: SPEC-PARTIAL

- `primtasks.dll` is **not** the implementer. The CLSID bytes `b81121a4-7ef2-4606-bef3-f9b01f582e35`
  exist once in the image (`0x18004a968`) and are referenced once, from `0x18002bd90`, the
  material copy helper of `SIAssembleNurbsMesh`, where the task is *created* with
  `SICreateInstance`. `DllGetClassObject` (`0x180028940` .. `0x180029860`) has no reference to
  that GUID, while it does reference the CLSIDs of the commands above.
- What the caller shows of the task's private interface (IID
  `82fa84cd-bbb1-4e00-be0a-afca47231ffd`): slot 10 takes (target object, 0, material, out
  result object, 0) and the result is queried for `IUnknown`.
- Registry: arguments `Objects` (in, list) and `Material` (in, object); description
  "Assigns a material to a list of objects". The registry's DLL list for the CLSID starts
  with `modeltasks.dll`, then `propertytasks.dll`; neither is staged locally, so the
  implementer was not identified. The behaviour contract is unread.

## Open questions

1. `SIGetRigidCns`: the recorder call `0x18000f480` and the primitive method behind
   interface `a896d510-2969-43ec-b457-a8816808f906` slot 6 (does it write or only register
   the `.spdl` path?) were not read.
2. `SIAssembleNurbsMesh`: assembly `0x18002bfb0` and stages `0x18002a8f0`, `0x18002e5e0`,
   `0x18002a660` not read; which stage consumes `CenterGeomCenter` is unconfirmed.
3. `SIGetPrimLight`: parameter id `2` with value `2` is taken to be "light type = spot";
   confirm against the light primitive's parameter table.
4. `SIGetPrimCamera` / `SIGetPrimSpotLight`: constraint class `98cad7d1-393a-11d2-8b40-00a024ee586f`
   and its parameter id `4` need naming; the alternate GUID entries (`0x180005ef0`,
   `0x180021830`) were not read.
5. `SIGetPrimLattice`: arguments of the primitive slot 7 call inside `0x180019ae0` were lost
   by the decompiler; Undo `0x18001a490`, Redo `0x18001a3c0` not read.
6. `SIGetPrimVolumeDeform`: helper task ctor `0x1800245e0` and its `Do`; Undo `0x1800253a0`,
   Redo `0x180025380`; the list-conversion service slot 26.
7. `SIInstantiate`: tasks `c536b66f-...` and `719498ca-...` and property class `11ebe301-...`
   with its four parameter GUIDs need naming from their own DLLs.
8. `GetInstances`: meaning of relation kind `2`.
9. `GetURLAt`: argument width of `View` / `X` / `Y` at `0x180010ec0`.
10. `ImportEPS`: parsers `0x180012270`, `0x1800152a0`, builder `0x180012520`.
11. `SIAssignMaterial`: locate the factory in `modeltasks.dll` / `propertytasks.dll`.
12. Message texts for ids `0x1c`, `0x29`, `0x2d`, `0x2e`, `0x4b`, `0x3fc` were not resolved.
