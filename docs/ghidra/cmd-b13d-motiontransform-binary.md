# CMD-B13d: MOTOR motion-transformation (retarget) plug-in commands, read from `CDKMotionTransform.64.dll` (CleanTagsFromRig, InheritRetargetSetup, LoadMOTORAdjustmentPresetFile, LoadMotorFile, LoadTagTemplateFile, RemoveAllMotorPropsAndOps, RemoveMOTOROperators, RetargetBVH, RetargetC3DData, RetargetExtractEndFrame, RetargetExtractStartFrame, SaveC3DPoseMap, SaveMOTORAdjustmentPresetFile, SaveTagTemplateFile)

Row: **CMD-B13d**. Status: **SPEC** (6 names: CleanTagsFromRig, RemoveAllMotorPropsAndOps, RemoveMOTOROperators, RetargetExtractEndFrame, RetargetExtractStartFrame, SaveMOTORAdjustmentPresetFile), **SPEC-PARTIAL** (8 names: InheritRetargetSetup, LoadTagTemplateFile, SaveTagTemplateFile - the trailing structure/map sections of the `.tagt` file and the rig-rebuild after inheritance were not read; LoadMOTORAdjustmentPresetFile - the per-parameter value-apply helpers were not read; LoadMotorFile - the legacy non-XML `.motor` reader and the retarget-apply stage were not read; RetargetBVH, RetargetC3DData - the BVH / C3D parsers and the retarget solver were not read; SaveC3DPoseMap - the fitting stage and the number formatter were not read).
Run: 2026-11-19, si-analyst worker, unattended, batch 13 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` (PDB `CDKMotionTransform.64.pdb`), image base `0x180000000`, 948040 bytes,
sha256 `0ab74c7b98397b18c19893ed0b9f9a2a3b0943add1cdf66c4235d724190fe12d` (export-directory timestamp 1442479284 = 2015-09-17).
Method: `inspect_native_exports` (97 named exports), then Ghidra 12.1.4 decompilation of `XSILoadPlugin`, every row `_Init` / `_Execute`, and the key callees: model-cleanup helpers
(`0x180054160`, `0x180061370`, `0x18003cc30`, `0x18005e450`, `0x180066050`, `0x180034c50`, `0x180017bb0`, `0x180025230`, `0x18004aa50`), frame-range helper `0x180054970` / `0x18006fe90`,
adjustment-preset load/save (`0x180001840`, `0x180001a20`, `0x180001b80`, `0x180001fe0`, `0x180002190`, `0x180005550`) and the Xerces-C 2.7 DOM wrapper (`0x180071fa0`, `0x180072c50`,
`0x180073ae0`, `0x180072430`, `0x1800736b0`, `0x180073750`, `0x180073fa0`, `0x180072560`, `0x180072710`, `0x180023e30`), tag template load/save (`0x1800624e0`, `0x1800640d0`, `0x1800623f0`),
the `.motor` XML reader `0x1800267e0` and `LoadMotorFile` driver `0x18004c290`, `RetargetBVH` driver `0x18004ba30`, `RetargetC3DData` driver `0x18004c090`, `SaveC3DPoseMap` driver
`0x18004c710` / `0x18007a130` / writer `0x1800811f0`, the text-file primitives (`0x180072ce0`, `0x18006a630`, `0x18006a970`, `0x18006a1d0`, `0x18006c0e0`, `0x18006c140`, `0x18006c200`,
`0x18006c300`), and the static-initialiser functions that give the global name strings (`0x18009df80` .. `0x18009fa90`). String searches gave file-dialog filters and format keywords.
Arguments cross-checked against `data/commands_full.json` (all 14 entries carry `file` = this DLL; every argument name, order and the null defaults agree).
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Display name = scripting name for every command (registered with identical name pairs).

| Command (scripting name) | Display name | _Init | _Execute | key helpers |
|---|---|---|---|---|
| `CleanTagsFromRig` | CleanTagsFromRig | `0x180009380` (shared with `ApplyTagsToRig_Init`) | `0x180009480` | `0x180061370` clean-tags, `0x180054160` remove-ops |
| `InheritRetargetSetup` | InheritRetargetSetup | `0x18000a0a0` (shared with `LoadTagTemplateFile_Init`) | `0x180009c50` | `0x1800624e0` tag-template load |
| `LoadMOTORAdjustmentPresetFile` | LoadMOTORAdjustmentPresetFile | `0x18000a4b0` (shared with `SaveMOTORAdjustmentPresetFile_Init`) | `0x18000a1e0` | `0x180001840` preset reader |
| `LoadMotorFile` | LoadMotorFile | `0x18000abb0` | `0x18000a760` | `0x18004c290`, XML reader `0x1800267e0`, legacy reader `0x18001f340` (unread) |
| `LoadTagTemplateFile` | LoadTagTemplateFile | `0x18000a0a0` | `0x18000ad40` | `0x1800624e0` (same as InheritRetargetSetup) |
| `RemoveAllMotorPropsAndOps` | RemoveAllMotorPropsAndOps | `0x18000be30` | `0x18000bca0` | `0x18003cc30` |
| `RemoveMOTOROperators` | RemoveMOTOROperators | `0x18000c0c0` (shared with both Extract*Frame inits) | `0x18000bf30` | `0x180054160` |
| `RetargetBVH` | RetargetBVH | `0x18000c4f0` | `0x18000c1c0` | `0x18004ba30`, BVH loader `0x180075af0` (unread) |
| `RetargetC3DData` | RetargetC3DData | `0x18000c8c0` | `0x18000c680` | `0x18004c090`, C3D importer `0x18007cae0` (unread) |
| `RetargetExtractEndFrame` | RetargetExtractEndFrame | `0x18000c0c0` | `0x18000ca00` | `0x180054970`, `0x18006fe90` |
| `RetargetExtractStartFrame` | RetargetExtractStartFrame | `0x18000c0c0` | `0x18000cc20` | `0x180054970`, `0x18006fe90` |
| `SaveC3DPoseMap` | SaveC3DPoseMap | `0x18000df90` | `0x18000d8e0` | `0x18004c710` -> `0x18007a130`, writer `0x1800811f0` |
| `SaveMOTORAdjustmentPresetFile` | SaveMOTORAdjustmentPresetFile | `0x18000a4b0` | `0x18000e120` | `0x180001fe0` preset writer |
| `SaveTagTemplateFile` | SaveTagTemplateFile | `0x18000f190` | `0x18000ed60` | `0x1800640d0` tag-template writer |

## 2. Shared facts

### 2.1 Plug-in registration (`XSILoadPlugin` `0x180010250`)

- Author `Yotto Koga`, plug-in name `MOTOR Plug-in`, a version is set (numbers not legible in the reading).
- **License gate**: everything below is registered only when `Application.License` is not `Foundation`; on a Foundation licence the plug-in loads empty.
- Commands registered, in order (display = scripting name): `Retarget`, `RetargetBVH`, `RetargetC3DData`, `ImportC3DFile`, `SaveC3DPoseMap`, `SetTagValue`, `SaveTagTemplateFile`,
  `LoadTagTemplateFile`, `InheritRetargetSetup`, `ApplyTagsToRig`, `CleanTagsFromRig`, `SetStructureFile`, `RetargetExtractStartFrame`, `RetargetExtractEndFrame`, `LoadMotorFile`,
  `SaveMotorFile`, `RemoveAllMotorPropsAndOps`, `PlotRetargetMotion`, `RemoveMOTOROperators`, `SaveMOTORAdjustmentPresetFile`, `LoadMOTORAdjustmentPresetFile` (21; the 7 not in this row
  belong to other rows).
- Properties registered (10): one whose name is not legible (first call), `TagPPG`, `RetargetAdjustPPG`, `MotorFilePPG`, `RotationOffsetPPG`, `PlotRetargetPPG`, `MocapPPG`, `TagRigPPG`,
  `RigToRigPPG`, `MocapToRigPPG` (exports also define `MocapToRig_Define`; the unnamed one is `MocapToRig` (inferred)).
- Menus: `Tag Rig`, `Rig to Rig`, `Mocap to Rig`, `SaveMotorFileMenu`, `LoadMotorFileMenu` (anchor not legible).
- Operators: `RetargetOp`, `RetargetUpVOp`, `RetargetGlobalOp`, `RetargetDecompOp`, `RetargetSpineOp`, `RetargetSymmetrySpecialOp`, `RetargetSymmetryOp`.
- Events exported: `MyNewScene_OnEvent`, `MyOpenScene_OnEvent` (not in this row).

### 2.2 Common command shape

- Every `_Init` here adds untyped arguments with no default (CValue empty) and no handler; `commands_full.json` agrees (all defaults null, flags 2).
- Every `_Init` except `RemoveAllMotorPropsAndOps_Init` calls `EnableReturnValue`; `RemoveAllMotorPropsAndOps_Init` calls `SetFlag` (flag constant not legible) instead.
- Every `_Execute` returns `CStatus OK`. Argument checks test "is the CValue empty" (missing) and then `IsValid` on the cast object (invalid); each failure logs a fixed message
  (`LogMessage`, default severity) and stops.
- `ReturnValue` is written only by the commands listed as returning something in section 3; `RemoveMOTOROperators`, `RemoveAllMotorPropsAndOps`, `Load/SaveMOTORAdjustmentPresetFile`
  never write it, so they return an empty value.

### 2.3 Name constants (global CStrings set by static initialisers)

| Constant | Kind of object | Address |
|---|---|---|
| `RetargetAdjustPPG` | custom property on the target model (MOTOR adjustment data) | `0x1800e3280` |
| `CDKGlue` | custom property | `0x1800e3380` |
| `CDKMap` | user data blob (rig map) | `0x1800e3478` |
| `CDKStructure`, `CDKStructTag` | custom properties (structure definition) | `0x1800e3508`, `0x1800e3568` |
| `PlotRetargetPPG` | custom property | `0x1800e37a8` |
| `CDKRefFrames`, `CDKRetargetOp` | user data blobs on the target model | `0x1800e3868`, `0x1800e3888` |
| `RotationOffsetPPG` | custom property on rig nodes | `0x1800e38d0` |
| `CDKTag`, `CDKExtractionTag` | custom properties on tagged rig nodes | `0x1800e3980`, `0x1800e39c8` |
| `TagData` | user data blob | `0x1800e3a00` |
| `TemplateFile` | parameter of `TagPPG` holding the last template path | `0x1800e3a10` |
| `<EmptyFieldxsi>` | placeholder for an empty tag value in `.tagt` files | `0x1800e3a38` |
| `TagPPG` | custom property on the model (one string parameter per tag, from index 4) | `0x1800e3ab0` |
| `BVH` | first token of a BVH-derived map file | `0x1800e3df0` |
| `Version3` | first line of a `.c3dpose` file | `0x1800e3ec0` |
| `c3ddef` (property), `c3dudb` (user data blob) | C3D import data on the C3D model | `0x1800e3eb0`, `0x1800e3f40` |
| `C3DData`, `C3DRig` | names used for the C3D import model and fitted rig | `0x1800e3f08`, `0x1800e3f18` |

Property / blob lookup (`0x18006f440`) is by exact name among `SceneItem.Properties`. Deletion (`0x18006e450`) always **runs `DeleteObj`** with the object's full name.

### 2.4 Operator removal routine (`0x180054160`, used by RemoveMOTOROperators, CleanTagsFromRig, RemoveAllMotorPropsAndOps, the template loader)

Only acts if the model has a `RetargetAdjustPPG` property; otherwise does nothing and reports false. In order:
1. Delete `RetargetAdjustPPG`.
2. Delete the `CDKRetargetOp` user data blob if present, then the `CDKRefFrames` blob if present.
3. Among the elements connected to the model's `Kinematics.Local` (found with `EnumElements`, filtered to custom operators), delete the operator named `RetargetOperator`.
4. For every 3D object under the model (`FindChildren` with family `si3DObjectFamily`, recursive (inferred)): delete, when present, the custom operator named `RetargetGlobalOp` and
   `RetargetUpVOp` on its global kinematic state, `RetargetSpineOp` and `RetargetDecompOp` on its local kinematic state, and the `RotationOffsetPPG` property.

### 2.5 Tag removal pieces

- `0x18005e450`: walks children recursively (`GetChildren`); on each child that is an X3DObject deletes its `CDKTag` and `CDKExtractionTag` properties.
- `0x180017bb0` deletes `CDKGlue`; `0x180025230` deletes the `CDKMap` blob; `0x18004aa50` deletes `PlotRetargetPPG`; `0x180034c50` deletes `CDKStructure` then `CDKStructTag`.
- `0x180066050`: deletes the `TagData` blob; on `TagPPG` removes every parameter with index > 3 (from the last down to index 4) and then sets one parameter (name not legible) with
  value `true`.
- Command-log suppression (`0x180071610`): runs `GetValue("preferences.scripting.cmdlog")`, then `SetValue` to the requested state, and returns the old state; callers restore it after.

### 2.6 File formats

#### `.tagt` tag template (text, written with `_wfopen(..,"wt")`, read whole into memory with `_wfopen(..,"rb")`)

Tokens are whitespace separated (inferred from the token reader `0x18006abf0`, unread). Integers are written followed by one space.
1. line 1: a structure-name string (field +0x18 of the `CDKStructure` data object) (inferred: structure name; the loader reads and discards it).
2. line 2: `N` = number of `TagPPG` parameters minus 4 (the tag count).
3. `N` lines: `<tag script name> <value>`; value is `<node>` or `<node>|<extraction node>` (split on `|`); empty value is written as `<EmptyFieldxsi>`.
4. one line: structure file path (field +0x28 of the structure object); the loader passes it to the set-structure-file routine `0x180064600` (inferred: same as `SetStructureFile`).
5. one line: format version, written as `8`. The loader requires version >= 7.
6. further sections written by `0x18005ce70` (structure) and `0x180024610` (map) and read back by `0x18005e5b0` (mocap/extraction tag section): not read.
A file whose first 5 bytes are `<?xml` (old XML template) is ignored by the loader, which then returns true without changing the model.
File dialogs use filter `Load Template (*.tagt)|*.tagt||` / `Save Template (*.tagt)|*.tagt||`; a `TagTemplates\` sub-folder string exists (default folder, inferred).

#### MOTOR adjustment preset (XML, Xerces-C 2.7 DOM, extension not fixed by the command)

```
ROOT
  HEADER            text "Ajustment Preset file Saved out from XSI using MOTOR" (sic)
    VERSION         Application.Version (text, inferred element-with-text)
  ADJUST_PPG_DATA
    <param script name>  text = value as text; attributes Capabilities, Name, Description, DataType   (one per RetargetAdjustPPG parameter)
  ROTATION_OFFSETS
    <rig node name>      one per mapped node that has a RotationOffsetPPG
      <param script name> same attribute set, one per RotationOffsetPPG parameter
```
Attribute values: `Capabilities` = `Parameter.Capabilities` as integer text, `Name` = parameter name, `Description` = description, `DataType` = `Parameter.ValueType` as integer text.
Element lookup on load is by exact element-node name among the children of the parent.

#### `.motor` file (XML form, read by `0x1800267e0`; a non-XML legacy form goes to `0x18001f340`, unread)

Detection: XML when the first 5 bytes are `<?xml`. Writer header text `MOTOR file Saved out from Softimage using MOTOR` (SaveMotorFile, other row). Dialog filters
`Open Motor File (*.motor)|*.motor||`, `Save Motor File (*.motor)|*.motor||`.
```
ROOT (inferred, same DOM wrapper)
  HEADER   child elements with text: VERSION, AnimationLength (int frames), legLength (double), hipOffset (double),
           numNodes (int), numPlanes (int), structure_type (string)
  NODES    one child per node, attributes: obj_IsValid (bool), name, length (double)
  PLANES   one child per plane, attributes: name, span (int), mid (int), anchor_index (int), numbones (int);
           numbones child elements each with attribute boneindex (int)
  POSE_VALUES  AnimationLength children (one per frame), each with numNodes children carrying attribute
           global = "ax,ay,az,angle,tx,ty,tz"   (exactly 7 comma-separated numbers: rotation axis, rotation angle
           (radians, inferred from CTransformation.SetRotationFromAxisAngle), translation)
  FCURVE_KEYS  attribute num_nodes_with_fcurve_keys; children (one per node) with attribute name; their children are
           channels with attribute name in {posx, posy, posz, rotx, roty, rotz} and numkeys; key children carry keytime (double)
```
A missing element or attribute is recorded in an error list (`DOMElement : <..`, `Atribute : <..`, `Error reading CTransformation Attribute : <..`) and makes the parse fail.

#### `.c3dpose` C3D pose map (text, written by `0x1800811f0`)

Dialog filters `Save C3D Fitted Pose (*.c3dpose)|*.c3dpose||`, `Select C3D Pose File (*.c3dpose)|*.c3dpose||`.
1. `Version3`
2. `<string from a TagPPG parameter of the rig (name not legible)> <upDir> ` (upDir = `c3ddef.upDir` integer)
3. `<M> <K> ` : M = number of valid 3D objects under the C3D model excluding the first one found (markers), K = number of fitted entries.
4. M lines: marker object names.
5. K records, each three lines: `i0 i1 i2 ` (three integers); a transform as 6 numbers (XYZ Euler angles from `CRotation.GetXYZAngles` (radians) then translation x y z) followed by
   3 numbers (a vector); a second transform as 6 numbers. Number formatting is done by `0x18006c380` (unread).

#### Inputs: BVH and C3D

- BVH (`Select BVH File (*.bvh)|*.bvh||`, label `BioVision Motion Capture(*.BVH)`): keywords present `HIERARCHY`, ` ROOT`, `OFFSET`, `CHANNELS`, `JOINT`, `MOTION`, channel names
  `Xposition`, `Xrotation`, `Yrotation`, `Zrotation`, and the line format `Frames: %d Frame Time: %f` (standard BVH). Parser `0x180075af0` not read.
- C3D (`Select C3D File (*.c3d)|*.c3d||`, label `C3D Motion Capture file(*.C3D)`): standard binary C3D; strings `C3D_Parameters`, `POINT`, `UNITS`, `LABELS`, `firstFrame`, `lastFrame`,
  `analog samples per frame`, `converted frame rate`. The import stores a `c3dudb` blob and a `c3ddef` property with parameters `numFrames`, `numPoints`, `frameIncrement`, `pose` (bool),
  `upDir` (int). Parser not read.
- Map file for BVH/C3D retarget: either a `.tagt` (extension compared case-insensitively as `TAGT`) or a text file whose first token is `BVH`.

## 3. Contracts

### `CleanTagsFromRig`: SPEC

Wire contract:
- Args: `targetmodel` (Model, no default).
- Return: `true` after cleaning; `false` when missing/invalid.
- Errors: empty arg -> log `CleanTagsFromRig command missing model.`, return false; not a Model -> `CleanTagsFromRig command invalid model.`, false.
- Steps:
  1. Find `TagPPG` on the model; add a custom property if missing (name argument not legible; `TagPPG` (inferred)).
  2. Show the progress bar, caption `Removing MOTOR setup data from model ...`.
  3. Set every `TagPPG` parameter from index 4 to the end to the empty string (the tags remain, emptied).
  4. Run the operator removal routine (2.4).
  5. Delete `CDKTag` / `CDKExtractionTag` on all descendants (2.5), then `CDKGlue`, the `CDKMap` blob and `PlotRetargetPPG`; progress bar stepped after each.
- Leaves `TagData`, `CDKStructure`, `CDKStructTag` in place (contrast RemoveAllMotorPropsAndOps).

### `RemoveMOTOROperators`: SPEC

Wire contract:
- Args: `model` (Model).
- Return: empty (ReturnValue never written).
- Errors: `RemoveMOTOROperators command missing target model.`, `RemoveMOTOROperators command invalid target model.` (logged; command still succeeds).
- Steps: run the operator removal routine (2.4). Nothing happens when the model has no `RetargetAdjustPPG`.

### `RemoveAllMotorPropsAndOps`: SPEC

Wire contract:
- Args: `model` (Model). Init sets a command flag instead of enabling a return value.
- Return: empty.
- Errors: `RemoveAllMotorPropsAndOps command missing target model.`, `RemoveAllMotorPropsAndOps command invalid target model.` (logged, success status).
- Steps:
  1. Close/hide a view whose name is built from a global prefix (`0x180005460`, `View.PutState`) (inferred: the MOTOR floating view); call `0x1800582e0` (unread; inferred: same for a second view).
  2. Turn command logging off (2.5), remembering the old state.
  3. Progress bar caption `Removing MOTOR setup data from model ....`.
  4. Operator removal routine (2.4).
  5. Tag data removal `0x180066050` (delete `TagData`, strip `TagPPG` parameters above index 3, set one remaining parameter to true).
  6. Delete `CDKTag` / `CDKExtractionTag` on descendants, `CDKGlue`, `CDKMap`, `CDKStructure`, `CDKStructTag`, `PlotRetargetPPG`.
  7. Restore command logging.

### `RetargetExtractStartFrame`: SPEC

Wire contract:
- Args: `model` (Model).
- Return: integer start frame on success, `0` when no range is found; `false` when missing/invalid.
- Errors: `RetargetExtractStartFrame command missing source model.` / `... invalid source model.` -> false.
- Range rule (`0x180054970`):
  - If the model has a `CDKRetargetOp` user data blob, the blob holds a native pointer at offset 4 to the in-memory retarget object; start = int at +200 (0xC8) of that object,
    end = start + int at blob offset 0x100. Always succeeds (blob content is session-bound, inferred).
  - Otherwise start = +2147483647, end = -2147483647; for every animated parameter of the model (`GetAnimatedParameters`, recursive) whose source is an FCurve with at least 2 keys,
    start = min(start, int(time of key 0)), end = max(end, int(time of last key)). Success when start < end and start < 2147483647.

### `RetargetExtractEndFrame`: SPEC

Wire contract: same as `RetargetExtractStartFrame` with its own messages (`RetargetExtractEndFrame command missing source model.` / `... invalid source model.`); returns the end frame.

### `SaveMOTORAdjustmentPresetFile`: SPEC

Wire contract:
- Args: `model` (Model), `filename` (string).
- Return: empty.
- Errors (logged, success status): `SaveMOTORAdjustmentPresetFile command missing target model.`, `... missing file path.`, `... invalid target model.`;
  model without `RetargetAdjustPPG` -> `No MOTOR Data loaded onto model.` and nothing written.
- Steps: create a new DOM document with root `ROOT`; add `HEADER` (header text + `VERSION`); add `ADJUST_PPG_DATA` with one element per `RetargetAdjustPPG` parameter (2.6);
  if the model has retarget data (`0x18004fbe0` non-null) add `ROTATION_OFFSETS`: for each mapped node name (even entries of the map name list), find the child by name and, if it has
  `RotationOffsetPPG`, write an element named after the node with its parameters; serialise to `filename` on close.

### `LoadMOTORAdjustmentPresetFile`: SPEC-PARTIAL (value-apply helpers `0x180073150`, `0x18004cd70`, `0x180051370` unread)

Wire contract:
- Args: `model` (Model), `filename` (string).
- Return: empty.
- Errors (logged): `LoadMOTORAdjustmentPresetFile command missing target model.`, `... missing file path.`, `... invalid target model.`; no `RetargetAdjustPPG` -> `No MOTOR Data loaded onto model.`.
- Steps:
  1. Parse `filename` as XML.
  2. If `ADJUST_PPG_DATA` exists and the model has retarget data: write the element values into `RetargetAdjustPPG` (inferred: matched by script name), then push each parameter to
     the retarget data.
  3. If `ROTATION_OFFSETS` exists: for each element child whose name equals a mapped node name, find that child of the model; add a property if it has no `RotationOffsetPPG`
     (name argument not legible; `RotationOffsetPPG` inferred); when it is the first mapped node set parameter `IsCog`; set a capability flag on its `Reduce` parameter, one flag when the
     node is in the structure's chain list and another otherwise (flag values not legible); load the values and push them to the retarget data.
- The evaluation time used is taken from an OperatorContext built on the command context (odd; inferred current time).

### `LoadTagTemplateFile`: SPEC-PARTIAL (trailing `.tagt` sections and rig rebuild unread)

Wire contract:
- Args: `targetmodel` (Model), `template` (string path).
- Return: bool from the loader.
- Errors: `LoadTagTemplateFile command missing model.`, `... invalid model.`, `... missing template file.` -> false.
- Loader `0x1800624e0`:
  1. Invalid model -> error `It is ambiguous which character is to receive the inheritance.  Please select the desired character.`, false. Empty path ->
     `Please specify a tag template file (*.tagt)`, false.
  2. If the file starts with `<?xml` -> do nothing, return true.
  3. Progress `Reading Tag Template File ...`; ensure `TagPPG` exists.
  4. If the file cannot be opened: set `TagPPG.TemplateFile` = path and return true.
  5. Run the operator removal routine (2.4), delete `PlotRetargetPPG` and `CDKGlue`.
  6. Read the header, the N tag/value pairs, the structure file path; set the structure file; if the model then has no structure -> error
     `Cannot find orriginal structure file :` + path, false.
  7. Progress `Applying Tags to Model ...`. For each pair with a non-empty value: find `<node>` under the model, else log `Node ...` and blank the value; if an extraction node is given and
     not found, log `Extraction node ...` and keep only `<node>`; write the value into `TagPPG` parameter (index i+4); if that parameter's script name differs from the file's tag name
     log `Failed to load template file: Tag name ...` (value still written).
  8. Read the version; < 7 -> `Failed to inherit the template data. Template is out of date.`, set `TagPPG.dirty`, false.
  9. If the file carries a mocap/extraction section and it does not match the rig -> `Failed to inherit the template data.  Template does not match the rig.`, set `dirty`, false.
  10. For every value other than `<EmptyFieldxsi>` / empty, add a `CDKTag` custom property (if missing) with a string parameter `tagname` = the tag name.
  11. Rebuild structure, map and operators (unread), then set `TagPPG.TemplateFile` = path; true.

### `InheritRetargetSetup`: SPEC-PARTIAL

Wire contract: same as `LoadTagTemplateFile` (same `_Init`, same loader `0x1800624e0`); only the messages differ: `InheritRetargetSetup command missing destination model.`,
`... invalid destination model.`, `... missing template file.`.

### `SaveTagTemplateFile`: SPEC-PARTIAL (trailing sections and dirty rebuild `0x18005eef0` unread)

Wire contract:
- Args: `model` (Model), `tag_template_filename` (string).
- Return: bool.
- Errors: `SaveTagTemplateFile command missing model.`, `... invalid model.`, `... missing template file.` -> false; no `TagPPG` -> `Model not tagged. Please tag the model.` false;
  no `CDKMap` blob -> `Incorrect tagging. Please re-tag.` false; cannot open -> `You do not have permission to save to this directory.  File not saved.` false; empty path -> false (silent).
- Steps: if `TagPPG.dirty` is true, rebuild the tag data first; build the map from the structure; write the `.tagt` layout (2.6); set `TagPPG.TemplateFile` = path; true.

### `LoadMotorFile`: SPEC-PARTIAL (legacy reader and apply stage unread)

Wire contract:
- Args: `targetmodel` (Model), `motorfile` (string), `start` (number; read and converted but not used).
- Return: bool.
- Errors: `LoadMotorFile command missing destination model.`, `... invalid destination model.`, `... missing motorfile.` -> false.
- Steps: parse the file (XML or legacy); on XML parse failure return false. Get the target's `CDKStructure` data, build the model map; when the map is empty log
  `Failed to read destmodel map from source model.` and return false. Otherwise build the retarget setup on the target and apply the motion (unread); true.

### `RetargetBVH`: SPEC-PARTIAL

Wire contract:
- Args: `targetmodel` (Model), `bvhfile`, `mapfile` (strings).
- Return: bool.
- Errors: `RetargetBVH command missing destination model.` / `... invalid destination model.` / `... missing bvhfile.` / `... missing mapfile.` -> false.
- Steps (`0x18004ba30`): read the map file (empty -> `Could not read mapfile.`); if its extension is `TAGT` skip over its tag header, else its first token must be `BVH`
  (else `To retarget a BVH file the mapfile must be built from the corresponding BVH ref pose`); turn command logging off; read the mocap tag section; load the BVH
  (`Failed to load the BVH file.`); tag it (`Failed the mocap tag process.`); create the source structure (`Failed to create the structure.`) and model map
  (`Failed to create the model map.`); get the target's structure (`Failed to create the model map. Possible missing CDKStructure.`) and map
  (`Destination model is not setup for retargetting.`); retarget and return true. Logging state restored on every exit after step 3.

### `RetargetC3DData`: SPEC-PARTIAL

Wire contract:
- Args: `c3dfile`, `mapfile` (strings). No target-model argument.
- Return: bool.
- Errors: `RetargetC3DData command missing the c3d file.` / `RetargetC3DData command missing the map  file.` (two spaces) -> false; unreadable map file or empty c3d path -> false.
- Steps: read the map file header, turn command logging off, import the C3D into a model named from `C3DData`, fit a `C3DRig`, attach map data (`CDKMap`) and apply the pose map;
  return that result; restore logging.

### `SaveC3DPoseMap`: SPEC-PARTIAL

Wire contract:
- Args: `c3dmodel` (Model), `ESR_rig` (Model), `Map_file` (string).
- Return: bool.
- Errors: `SaveC3DPoseMap command missing the c3dmodel`, `... invalid c3dmodel`, `... missing the ESR rig`, `... invalid ESR rig`, `... missing the Map file` -> false.
- Returns false without writing when the path is empty, the C3D model lacks the `c3dudb` blob or `c3ddef` property, `c3ddef.pose` is false, or the rig lacks `TagPPG` / the file
  cannot be opened.
- Steps: reset `c3ddef.pose`; save the global transform of the rig's first grandchild; fit the rig to the C3D markers; write the `.c3dpose` file (2.6); restore that transform; true.

## 4. Open questions

- The operator removal looks for an operator named `RetargetOperator` on the model, while the registered operator is `RetargetOp`; the instance name used on creation was not read.
- The `CDKRetargetOp` blob stores a raw pointer (offset 4); frame extraction after a scene reload would read stale memory (inferred). A reimplementation should store the range directly.
- Names of the parameters set in `0x180066050`, of the `TagPPG` parameter written on line 2 of `.c3dpose`, and the capability flags on `Reduce` were not legible.
- `.tagt` sections after the version line, the legacy `.motor` text format, the BVH / C3D parsers and the number formatter `0x18006c380` remain unread.
