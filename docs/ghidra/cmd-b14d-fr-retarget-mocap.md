# CMD-B14d: Face Robot mocap / retarget commands in FR.dll (fr_LoadC3D, fr_WriteC3D, fr_C3DDebugFace, fr_C3DToFaceRobot, fr_CalibrateFace, fr_LogFaceCalibration, fr_AdjustRetargetedFace, fr_CalibrateRetargetedFace, fr_FlushRetargetedFace, fr_PlotRetargetedFace, fr_PlotRetargetedFaceUI, fr_SaveFacePose, fr_ApplyFacePose, fr_CreateFaceMap, fr_FacialMocapTools, FaceRobot, fr_GetCurrentStage, fr_SwitchFaceLayout)

Row: **CMD-B14d**. Status: **SPEC** (7 names: fr_GetCurrentStage, fr_SwitchFaceLayout, fr_CalibrateFace, fr_AdjustRetargetedFace, fr_CalibrateRetargetedFace, fr_FacialMocapTools, fr_PlotRetargetedFaceUI), **SPEC-PARTIAL** (11 names: FaceRobot - the stage actions `0x1800222e0` (stage 15 "next"), `0x1800114c0` (analyze/fit), `0x18001d9e0` (solve), the clear helpers `0x180027660` / `0x18002d0e0` and the trailing refresh `0x1801a5ce0` were not read; fr_LoadC3D - the name of the custom property added after a successful name-map pass and the per-frame sampler `0x180135fa0` were not read, the file dialog helper `0x180131050` only by role; fr_WriteC3D - the name of the face-model UserDataBlob it reads (global `0x1802d2600`), the source of the byte copy written to `outputfile` and the face-map path suffix were not recovered; fr_C3DToFaceRobot - the retarget builder `0x1801456c0` was read only for its strings; fr_C3DDebugFace - the debug builder `0x180141680` was read only for its strings; fr_LogFaceCalibration - the separator literals between the 20 values of the log line were not read; fr_FlushRetargetedFace - the un-retarget body `0x18014a050` was read only for its strings; fr_PlotRetargetedFace - the plot engine `0x180161290` was read only for its strings; fr_SaveFacePose - the pose writer `0x1801639b0` was read only for its strings, the `.frpre` layout is unknown; fr_ApplyFacePose - the pose reader/applier `0x180154d40` was read only for its strings; fr_CreateFaceMap - the face-map builder `0x1801593a0` was read only for its strings, the `.fmap` layout is known only by keywords).
Run: 2026-11-19, si-analyst worker, unattended, batch 14 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Base dir B = `C:\Program Files\Autodesk\Softimage 2015 SP2`.

| Binary | bytes | sha256 | export timestamp |
|---|---|---|---|
| `B\FaceRobot\Application\Plugins\FR.dll` (PE32+ amd64, image base `0x180000000`) | 2996552 | `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` | 1442478276 |

Method: export table via `inspect_native_exports` (394 exports) and the retained native-exports view. In the shared Ghidra 12.1.4 session (not opened or closed by this worker) I decompiled every `_Execute` of the 18 rows, the `_Init`s of fr_LoadC3D, fr_C3DToFaceRobot, fr_SwitchFaceLayout, fr_GetCurrentStage (generic init `0x1801a9260`), FaceRobot, fr_FlushRetargetedFace, the shared no-op init `0x180170fe0`, the property Defines `FacePlotProperties_Define`, `FaceCalibrateProperties_Define`, `FacialMocapTools_Define`, and these callees: stage evaluator `0x18000fdb0` and its connection check `0x18000f9f0`, layout switcher `0x18011c320` and view refresher `0x18011c1e0`, C3D loader `0x18015eec0`, C3D model builder `0x180138000`, C3D reader `0x180137430`, parameter-record reader `0x180137c90`, parameter lookup `0x180135e70`, gap filler `0x180136d00`, C3D in-place writer `0x180136300`, the stream primitives `0x180139810` / `0x180139850` / `0x1801398e0` / `0x180139aa0` / `0x180139ac0` / `0x180139950`, name-file parser `0x180158820`, scene cleanup `0x180130840`, framer `0x180131970`, message box `0x180130240`, path helpers `0x18012eb30` / `0x18012ec00`, the panel openers `0x180139e00` / `0x18013d470` / `0x18016ba60`, panel closer `0x18016ae80`, view finder `0x18016b0a0`, property finder `0x180131600`, calibration writer `0x180156ca0`, calibration logger `0x18015eff0`, flush entry `0x18015d750`, plot dialog `0x180165ba0`. The big builders listed above as SPEC-PARTIAL were inspected only through `analyze_function` referenced-string facets. Global CString names were resolved by reading the static initialisers' LEA targets (`C3DFaceData`, `c3dudb`, `RefFace`, `ZeroFace`). Command flags were read from the Init assembly. Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All rows are self-installed `XSILoadPlugin` (`0x1801a9e30`) commands; display name = scripting name.

| Command | _Init | _Execute | key helpers |
|---|---|---|---|
| `fr_LoadC3D` | `0x1801690a0` | `0x180168d40` | loader `0x18015eec0` -> builder `0x180138000` -> reader `0x180137430`; name file `0x180158820`; dialog `0x180131050` |
| `fr_WriteC3D` | `0x18016ad50` (not read) | `0x180169e60` | reader `0x180137430`, writer `0x180136300` |
| `fr_C3DDebugFace` | `0x1801676f0` (not read) | `0x180167490` | debug builder `0x180141680` |
| `fr_C3DToFaceRobot` | `0x180167d20` | `0x180167830` | face finder `0x18015d7f0`, retarget builder `0x1801456c0` |
| `fr_CalibrateFace` | `0x180168270` (not read) | `0x180167e20` | `0x180156ca0` |
| `fr_LogFaceCalibration` | `0x180168cd0` (**shared with fr_FlushRetargetedFace_Init**) | `0x180169230` | `0x18015eff0` |
| `fr_AdjustRetargetedFace` | `0x180170fe0` (shared no-op, see 2.1) | `0x180166ff0` | `0x180139e00` |
| `fr_CalibrateRetargetedFace` | `0x180170fe0` | `0x180168920` | `0x18013d470` |
| `fr_FlushRetargetedFace` | `0x180168cd0` | `0x180168c80` | `0x18015d750` -> `0x18014a050` |
| `fr_PlotRetargetedFace` | `0x1801699e0` (**shared with fr_PlotFace_Init**, not read) | `0x180169760` | plot engine `0x180161290` |
| `fr_PlotRetargetedFaceUI` | `0x1801696c0` (not read) | `0x180169480` | dialog `0x180165ba0` |
| `fr_SaveFacePose` | `0x180169d30` (not read) | `0x180169c10` | `0x1801639b0` |
| `fr_ApplyFacePose` | `0x180167350` (not read) | `0x180167020` | `0x180154d40` |
| `fr_CreateFaceMap` | `0x180168b10` (not read) | `0x180168950` | `0x1801593a0` |
| `fr_FacialMocapTools` | `0x180170fe0` | `0x180168c50` | `0x18016ba60` |
| `FaceRobot` | `0x1801a9c30` | `0x1801a9450` | stage `0x18000fdb0`, layout `0x18011c320` |
| `fr_GetCurrentStage` | `0x180010830` (calls generic init `0x1801a9260`) | `0x1800107a0` | `0x18000fdb0` |
| `fr_SwitchFaceLayout` | `0x18011cf30` | `0x18011ce80` | `0x18011c320` |

## 2. Shared facts

### 2.1 Init conventions
- Generic init `0x1801a9260(ctx, argNames[], returnFlag)`: description "", `SetFlag(0x8, false)`, `SetFlag(0x800000, true)`, `EnableReturnValue(returnFlag)`, then one argument per name with an empty CValue default. 0x800000 is assumed to be `siNoLogging` and 0x8 `siAllowNotifications` (inferred, same assumption as CMD-B13a Q5).
- `0x180170fe0` is a bare `return CStatus::OK`. It is exported as `NameMapWizard_Define` and also as the `_Init` of fr_AdjustMetaMouth, fr_AdjustRetargetedFace, fr_CalibrateRetargetedFace, fr_FacialMocapTools, fr_InspectSculptHistory, fr_RegenerateMouth, fr_ResetControllerDB and the Reload/Term/Unload of fr_ApplyFaceRobotGameShader. Those commands get no arguments and keep the default command flags.
- `0x180168cd0` (fr_FlushRetargetedFace_Init = fr_LogFaceCalibration_Init) only constructs the Command; no flags, no arguments.
- `FacialMocapTools_DefineLayout`, `FaceCalibrateProperties_DefineLayout`, `FaceAdjustProperties_DefineLayout`, `MouthAdjustProperties_DefineLayout`, `NameMapWizard_DefineLayout`, `SculptHistory_DefineLayout` share `0x1800ee500` (not read).

### 2.2 Face-robot lookup and scene names
- "The face model" (`0x18015d7f0` -> `0x18000f3f0`, not read) is the auto-found Face Robot model (inferred: selection first, else the `ActiveFaceRobot` model).
- `ActiveFaceRobot`: custom property on the scene root; its `FaceModel` parameter holds the face model's name. The face model carries a `FaceConnections` property whose `Mesh` parameter names the face mesh; parameters whose description contains `optional` are optional connections.
- Global names: `C3DFaceData` (the C3D marker model), `ZeroFace` (deleted before every load, inferred: neutral reference), `RefFace` (framed after a name-mapped load), `c3dudb` (marker UserDataBlob, inferred from the initializer order). Property names used through globals, inferred from their string table neighbours: `FaceAdjustProperties`, `FaceCalibrateProperties`, `FacePlotProperties`, `FacialMocapTools`.
- Panel opening pattern (Adjust / Calibrate / FacialMocapTools): first close the other Face Robot property panels (`0x18016ae80`, inferred), then search the active layout for a `Property Panel` view whose `targetcontent` attribute equals the property; if none, `Layout.CreateView("Property Panel", <name>)`, move it (offset 15, 15 for Adjust/Calibrate; 150, 150 for FacialMocapTools), set `targetcontent` = property full name, resize width 400 (height argument not recovered).
- Message box helper `0x180130240`: logs the text, then `MsgBox(text, 0x30 = siMsgExclamation, "SOFTIMAGE|Face Robot")`.
- Delete helper `0x1801309d0` (by full name) is used to remove temporary properties and unmapped markers (inferred `DeleteObj`).

### 2.3 Stage values (`0x18000fdb0`, used by fr_GetCurrentStage, fr_SwitchFaceLayout, FaceRobot)
Returns an int code, first match wins:

| Condition | Code |
|---|---|
| no `ActiveFaceRobot` property, empty `FaceModel`, model not found, or no `FaceConnections` on the model | 0 |
| face mesh exists and has a `SculptLinkReader` property | 60 |
| face mesh exists and its construction history `Find("facialsofttissue")` returns something | 50 |
| model has a child `HeadNull` whose parent is named `Head_Control` | 50 |
| model has a child `HeadNull` (any other parent) | 40 |
| model has a `PickPoints` null with at least one child | 30 |
| every non-optional `FaceConnections` parameter names an existing object **and** the model has a `FaceState` property | 15 |
| otherwise | 10 |

Stage number = code / 10 (so 15 -> 1, 60 -> 6). FaceRobot also tests the codes 35 and 45, which this function never returns.

### 2.4 C3D file facts (reader `0x180137430`, writer `0x180136300`)
Header (block 1, byte offsets):

| Offset | Type | Field | Use |
|---|---|---|---|
| 0 | u8 | first block of the parameter section (low byte of word 1) | seek to `(b-1)*512` |
| 2 | i16 | number of 3D points (P) | yes |
| 4 | i16 | analog measurements per frame | read, ignored |
| 6 / 8 | i16 | first / last frame | frames F = last - first + 1 |
| 10 | i16 | max interpolation gap | read, ignored |
| 12 | f32 | scale factor | `<= 0` means float data |
| 16 | i16 | first block of the data section | seek to `(b-1)*512` |
| 18 | i16 | analog samples per frame | read, ignored |
| 20 | f32 | frame rate | used for resampling |
| 294 (0x126) | 5 x i16 | words 148-152 (label/range and event keys) | read, ignored |

- Parameter section header: 4 bytes (reserved, reserved, block count, processor type). Processor type is stored and later used for float conversion.
- **Byte order**: every int16 is read in host (little-endian) order, never swapped, so processor type 86 (MIPS, big-endian) files are not supported. A float32 is converted only when the processor type is 85 (DEC): its two 16-bit halves are swapped and the value is multiplied by 0.25. The header floats are read before the type is known and then converted again.
- Parameter records are read one after another: i8 name length (0 ends the section), i8 group id (negative means a group definition with id = -gid; positive means a parameter of group gid), the name, an i16 offset to the next record (0 marks the last record; it is **not** used to seek). A group continues with a u8 description length and the description. A parameter continues with i8 type (-1 char, 1 byte, 2 int16, 4 float), u8 dimension count, the dimension bytes, the data, a u8 description length and the description. Groups and parameters are indexed by name.
- Parameters used: `POINT:LABELS` (char array, element i = `dims[0]` characters at `i*dims[0]`, trailing whitespace trimmed, `:` replaced by `_`) and `POINT:UNITS` (same string rule).
- Data: frames back to back from the data block. Per frame, P records of 4 values. With a positive scale they are i16 `x, y, z, residual` and `x, y, z` = word * scale. With a scale `<= 0` they are f32 `x, y, z, residual`. The residual is ignored. **Analog samples are not skipped**, so files with analog channels are misread (inferred consequence).
- Validity: a point with `x^2+y^2+z^2 < 1e-7` is missing. Let k be the first frame in which all points are valid. If k > 0, frames 0..k (k+1 frames, including the first fully valid one) are dropped and the drop count k+1 is stored for the writer.
- Gap fill (`0x180136d00`, called with "hold" mode): for each marker, interior runs of missing frames (`< 1e-6`) are linearly interpolated between the last valid frame before the run and the frame after the first valid frame that follows it. A run that reaches the end is filled with the last valid value. The truncate mode (cut F at the earliest trailing gap) exists but is not used by these commands.
- Axis conversion argument: 0 = rotate +90 deg about Z, then +90 deg about Y; **2 (used by fr_LoadC3D and fr_WriteC3D) = rotate -90 deg about X, then -90 deg about Y**; 1 = no change.
- Writer (`0x180136300`): reopens the file, re-reads the header and parameters. If the requested frame span is larger than F it logs "Can not modify the specified range of C3D data" and stops. For every point whose label equals a mapped marker name it overwrites x, y, z in place: as float32 (converted back for DEC, inferred) or as int16 `trunc(v / scale)`. The residual word and unmapped points are kept. Frames before the stored drop offset are skipped; the source sample is taken at `(frame - offset) * (N / span)`.

### 2.5 Face map / name file keywords
- Name file (`namefile` of fr_LoadC3D, parsed by `0x180158820`, case-insensitive node match against the C3D model's 3D objects): `GlobalMotion` with 3 required head-frame node names, optionally 3 more, closed by `}`; `Mapping` with `<markerNode> <faceRobotName>` pairs up to `}`. Errors: "Error parsing the name file: GlobalMotion has bad head frame node <name>", "Error parsing the name file: GlobalMotion requires ending curly brace.", "Error parsing the name file: Failed to find the marker node <name>". Markers that the file does not name are deleted (inferred). The parse returns false when the file cannot be opened.
- `.fmap` (face map, written by fr_CreateFaceMap, read by fr_C3DToFaceRobot / fr_C3DDebugFace / fr_WriteC3D): a token file with version tag `FaceMap1.2` (an older tag gives "FaceMap file is out of date.  Please generate a new one."), 3 transforms and a vector, then a mapping list ended by `EndMapping`. Each entry is a C3D marker label, a Face Robot node name and a vector. The writer also emits a group map `_GroupMap_.gfmap`. The components named in the builder's messages are Ear, UpperLip, LowerLip, Jaw, Nose, Left/Right EyeLid and Left/Right EyeSocket. The node names used are `LEar_Control`, `REar_Control`, `LipUpper_Control`, `LipLower_Control`, `LeftEye`, `RightEye`, `LeftEyeLid`, `RightEyeLid`, `UpperLip`, `LowerLip`, `Nose` and `Ears`. fr_WriteC3D always prepends three reference entries mapped to `NoseBridge`, `LForehead`, `RForehead`.

### 2.6 Custom properties

**FacePlotProperties** (`0x180165f00`; all parameters capability 4 = siPersistable):

| Param | Type | Default | Range (min..max / suggested) | Description |
|---|---|---|---|---|
| `Start` | Int4 | 0 | - | "" |
| `End` | Int4 | 100 | - | "" |
| `IntervalStep` | Int4 | 4 | 1..100 / 1..10 | "" |
| `PlotToActionClip` | Bool | false | - | "Stores the plotted mocap as a clip in the mixer and deletes animation from controls" |
| `SplitTracks` | Bool | false | - | "After applying the clip, performs a Split in Space operation to create individual tracks for lips, jaw, tongue, and face that are then compounded into one clip in the mixer" |

**FaceCalibrateProperties** (`0x18013d7f0`; capability 4; all Double with an empty label and description), defined in this order: `DownLLip`, `DownULip`, `DownJaw`, `DownNose`, `DownEyes`, `UpLLip`, `UpULip`, `UpJaw`, `UpNose`, `UpEyes`. Each area has a `<area>Scale` and a `<area>Pitch` parameter:
- `*Scale`: default 1.0, range 0..DBL_MAX, suggested 0..1.5.
- `*Pitch`: default 0.0, range -180..180, suggested -30..30.
- plus `OldFormat` Bool default **true**.

**FacialMocapTools** (`0x18016cfc0`; capability 4): `C3DDir` String, default = `Application.InstallationPath(<enum not recovered>)`; `FaceNameFile` String, default empty. UI strings near it: "Load C3D ...", command `fr_LoadC3D`, "A C3D data model is required to create the name map/face map. Please\nload a C3D file and try again." The PPGEvent `0x18016d1e0` was not read.

**C3D_Parameters** (added to `C3DFaceData`): `units` String, capability 6, label "Units", description "Units used in C3D file", default = `POINT:UNITS`. It is added only when that parameter exists.

## 3. Contracts

### `fr_LoadC3D`: SPEC-PARTIAL
Wire contract:
- Args: `namefile` (name-map file, see 2.5), `initDir` (a `.c3d` path, or the start folder for the dialog), `frameCamera` (bool, default false). Missing (empty) args are skipped. Return value enabled: the chosen C3D path, or "" when cancelled.
- Path: if `initDir` ends in `.c3d` (case-insensitive, more than 4 characters) it is used directly. Otherwise a file dialog opens, titled "Select C3D File", filter "Select C3D File (*.c3d)|*.c3d||", starting in `initDir`. Empty result: nothing else happens.
- Steps: delete any existing `C3DFaceData` and `ZeroFace` objects (`DeleteObj`). Open the file; on failure log "Cannot open C3D file for reading." and stop. Read it (2.4, axis mode 2); on failure log "Cannot read C3D file.".
- Frame offset: the Face Robot setting `mods/offset` (FR settings singleton `0x1800268d0`) is read once and then removed. Output frame count N = floor(F * PlayControl.Rate / c3dRate + 0.5) - offset. If offset >= that count, log "Offset value is too large for this mocap.  It will be ignored." and use 0. Sets `Play Control.Out` (to N, inferred).
- Creates model `C3DFaceData` under the scene root with custom property `C3D_Parameters` (2.6). For each point it adds a `Cube` MeshSurface named after the label, with `length` = 0.008 x the bounding-box diagonal of all points at the middle C3D frame (diagonal floored at 1.0), and sets the `geometry approximation.gapproxmosl` value (value not recovered).
- Group `C3D_Markers_Group` holds all cubes. A Phong material `C3DMarkerMaterial` on the group has diffuse (0.2, 0.8, 1.0) and ambient (0.7, 0.7, 0.7).
- If `frameCamera`: select the group, run `FrameSelection`, refresh.
- Progress bar with caption from the localized string `pbar_import_motion`. Per marker: a `UserDataBlob` property (`c3dudb`, inferred) holding N x 24-byte `(x, y, z)` doubles, and keyed FCurves on `kine.local.posx/posy/posz` with keys at frames 0..N-1. Sample i comes from C3D frame `(i + offset) * F / N` through the interpolating sampler `0x180135fa0` (not read).
- Then the name file is applied (2.5). On success, a custom property (name not recovered) is added to the model, the objects matching `RefFace` are selected (BRANCH), `FrameAll` runs and `DeselectAll` runs. On failure only FrameAll and DeselectAll run.
- Status is always OK.

### `fr_WriteC3D`: SPEC-PARTIAL
Wire contract:
- Args: `inputfile`, `outputfile`. Return value: none put (status OK in every path).
- Requires the face model to carry a UserDataBlob (name in global `0x1802d2600`, not recovered) with retarget data: start frame at blob +0x1f0, frame count at +0x7c. Without it nothing happens.
- Writes a byte copy to `outputfile` (source inferred: `inputfile`). Reads the face map (directory of `inputfile` + a suffix not recovered). Builds the marker-label -> node list (2.5, with NoseBridge/LForehead/RForehead first).
- For each frame start..start+count it sets `Play Control.Current`, re-evaluates, and records every mapped node's global translation. A progress bar shows "Extracting motion ...".
- Converts back with +90 deg about Y, then +90 deg about X (the inverse of axis mode 2). Patches `outputfile` in place with the writer (2.4) over the reader's frame range. If the reopen fails, it logs "Cannot open C3D file for reading." and stops.

### `fr_C3DDebugFace`: SPEC-PARTIAL
Wire contract:
- Args: `facemap`, `initdir`. Always shows the "Select C3D File" dialog (start folder `initdir`). Return value: the chosen path ("" if cancelled).
- With a path, the debug builder `0x180141680` reads the fmap. Messages: "FaceMap file is out of date.  Please generate a new one." and "The fmap and the C3D file are mismatched.  The ear markers could not be found by name.".
- It creates `Cube` MeshSurface markers `LeftLipZero`, `LipZero`, `RightLipZero` (plus one more, unnamed in the strings) with `length` set and `Display Property.wirecol` set, and keys `posx/posy/posz` (inferred: a visual check of the computed lip zero frame).

### `fr_C3DToFaceRobot`: SPEC-PARTIAL
Wire contract:
- Arg `c3dfile`. Return value bool.
- An empty name or one not ending in `.c3d` logs "fr_C3DToFaceRobot: missing c3d file." and returns false.
- No face model: message box "Failed to auto-find a valid Face Robot. Please select the desired target Face Robot." and returns false.
- Face map lookup: `<c3dfile minus .c3d>.fmap`; if that does not exist, `<directory of c3dfile>` + a suffix (not recovered). If neither exists: message box "Could not find a valid face map for the C3D file.  Please generate a new\nface map for the C3D file and its associated set." and returns false.
- Otherwise returns the result of the retarget builder `0x1801456c0`. It sets up `fro_FaceRetargetOp*` operators on the `Face Robot` rig (inferred) and reads the FR settings `keep_adjust_keys` and `Stabilize_motion_on_retargeting`. It shows the same fmap version and ear-marker messages as fr_C3DDebugFace.

### `fr_CalibrateFace`: SPEC
Wire contract:
- 20 Double args, mapped in order to FaceCalibrateProperties: `Uulipscale` -> UpULipScale, `Uulippitch` -> UpULipPitch, `Ullipscale` -> UpLLipScale, `Ullippitch` -> UpLLipPitch, `Ujawscale/pitch`, `Unosescale/pitch`, `Ueyesscale`, `Ueyspitch` -> UpEyesScale/UpEyesPitch, then the same ten for Down (`Dulip*` -> DownULip*, `Dllip*` -> DownLLip*, `Djaw*`, `Dnose*`, `Deyesscale`, `Deyspitch`).
- On the face model, finds `FaceCalibrateProperties` or adds it, then writes the 20 values. With no face model it does nothing.
- Status OK. No ReturnValue is put.

### `fr_LogFaceCalibration`: SPEC-PARTIAL
Wire contract:
- No args. Finds or creates FaceCalibrateProperties on the face model, reads the 20 values and logs one line `CalibrateFace(` + the 20 values as text + `)` (separators and exact value order not recovered; inferred to be the fr_CalibrateFace argument order so the line can be replayed). Status OK.

### `fr_AdjustRetargetedFace`: SPEC
Wire contract:
- No args (no-op Init). Opens the FaceAdjustProperties panel (2.2) of the face model that has retargeted motion, and remembers the model full name in a global.
- If the model has no `FaceAdjustProperties`, message box "Select a model with retargeted motion.". Status OK. The property is never created here.

### `fr_CalibrateRetargetedFace`: SPEC
Wire contract:
- No args. Stores the face model full name.
- No `FaceCalibrateProperties`: message box "Could not find a face model with retargeted motion or a facial preset pose.".
- If the property exists but lacks `DownLLipScale` (old layout), it is deleted and re-added.
- Opens its panel (view name `FaceCalibrate`, Property Panel, offset 15, 15, width 400). Status OK.

### `fr_FlushRetargetedFace`: SPEC-PARTIAL
Wire contract:
- No args. If a face model exists, removes the retargeting (`0x18014a050`, unread; inferred from its strings):
  - progress `pbar_clear_retarget`;
  - remove `fro_FaceRetargetOp`, `fro_FaceRetargetOp2`, `fro_FaceRetargetHeadNullOp`, `fro_FaceRetargetLocalOp`, `fro_FaceRetargetCompensateOp`;
  - remove the `Head_ControlLayer`;
  - restore `Visibility.viewvis` on the `Controls`/`controls` group;
  - run `fr_ResetAll`.
- Status OK.

### `fr_PlotRetargetedFace`: SPEC-PARTIAL
Wire contract:
- Args: `Start` (default 0), `End` (100), `IntervalStep` (0), `PlotToActionClip` (false), `SplitTracks` (false). Empty args keep the defaults.
- Step is forced to 0 when it is < 1 or End <= Start. If `End - Start < step`, log "Error in inputs Step is too large: fr_PlotRetargetedFace(Start, End, Step)" and return E_FAIL.
- Otherwise ReturnValue = bool from the plot engine, and the status is CStatus 1 (False) when that bool is false.
- Engine strings:
  - errors: "Could not find a Face Robot rig.", "Could not find a Face Robot rig with retargeted motion.", "Could not find the FaceRobot marker file.";
  - progress `pbar_plot_motion`;
  - plots `kine.local` / `kine.global` `sclx/scly/sclz/rotx/roty/rotz/posx/posy/posz` of the `controls`, `Head_Control`, `Tongue` and `ComboMarker` nodes;
  - with PlotToActionClip: `StoreAction` into `Face_Clip`, `Tongue_Clip`, `Jaw_Clip`, `Upper_Lips_Clip`, `Lower_Lips_Clip` (`<name>_Clip`);
  - with SplitTracks: `CutClipInSpace`, then `CreateCompound` into `Lips_compound` / `<name>_compound`.

### `fr_PlotRetargetedFaceUI`: SPEC
Wire contract:
- No args. If there is no face model, returns E_FAIL.
- Finds or adds `FacePlotProperties` on the face model and resets the outputs to Start 0, End 0, Step 1, false, false. Opens it modally (`InspectObj`-style helper `0x180132340`, mode 4 = siModal, title "Plot Tool").
- On OK it reads `IntervalStep`, `Start`, `End`, `PlotToActionClip`, `SplitTracks`. The property is deleted afterwards in both cases.
- Then it runs `fr_PlotRetargetedFace(Start, End, Step, PlotToActionClip, SplitTracks)`. Cancel still runs it, with 0, 0, 1 (it then plots with step 0).
- Status = that command's status. ReturnValue = its bool when it succeeded and returned a value.

### `fr_SaveFacePose`: SPEC-PARTIAL
Wire contract:
- Args: `selectiononly` (bool), `filename`. Calls the pose writer. Strings:
  - dialog "Save Pose Preset", filter "Save Pose Preset (*.frpre)|*.frpre||";
  - errors "Could not find the calibration data.", "Could not find the FaceRobot marker file.";
  - progress `pbar_save_pose`; log "posefile saving: ";
  - per marker "processing marker: ", "Node <n> not a valid node...", "\tZeroPose for Node ", "\tGlobalPose for Node ";
  - tokens `<Add>`, `RefOnly`.
- It reads all 20 FaceCalibrateProperties values and `rotx/roty/rotz` of the controls (Head_Control, Tongue, Nose, lips, eyes, eyelids, ComboMarker).
- Status OK. No ReturnValue is put.

### `fr_ApplyFacePose`: SPEC-PARTIAL
Wire contract:
- Args: `posefile`, `selectOnApplication` (bool, default false). A missing posefile logs "fr_ApplyFacePose: missing pose file." and returns an empty CRefArray.
- Otherwise it runs `fr_ResetAll` (asserting success), then the applier. Errors: "Could not find a Face Robot rig.", "Could not find the calibration values.", "Invalid Pose File: <f>". Progress `pbar_apply_pose`. It reads FaceCalibrateProperties (including `OldFormat`), `RotateHead` and `TranslateHead`, and sets `pos*/rot*` on the controls (incl. `L/ROrbitalUpper_Control`).
- Returns the CRefArray of affected objects (inferred; selected when `selectOnApplication`).

### `fr_CreateFaceMap`: SPEC-PARTIAL
Wire contract:
- Args: `namefile`, `initdir`. Return value: string from the builder (inferred: the written `.fmap` path).
- Builder strings:
  - "Save Face Map" dialog, filter "Save Face Map (*.fmap)|*.fmap||";
  - errors "Failed to create the facemap file <f> with write access.", "Bad namefile for the CreateFaceMap command.", "Could not find the FaceRobot marker file.";
  - name-file errors (`err_parse_nfile`, `err_missing`, `PNF_001`, " '}'.");
  - the per-component parse errors (2.5);
  - writes `EndMapping\n` and a `_GroupMap_.gfmap`.
- Needs the `C3DFaceData` model (UI text in 2.6).

### `fr_FacialMocapTools`: SPEC
Wire contract:
- No args. On the scene root, finds or adds the `FacialMocapTools` property. Opens or refreshes its Property Panel: a new view is moved to (150, 150) and resized to width 400. Status OK.

### `FaceRobot`: SPEC-PARTIAL
Wire contract:
- Init: args `cmd`, `arg`, `id` (empty defaults), `SetFlag(0x8, false)`, return value enabled. Execute never puts a ReturnValue; status is always OK.
- Clears the selection. Each arg is converted to a string ("" when empty).
- If `cmd` is `analyze` or `solve`, **both `cmd` and `arg` are blanked**. If `cmd` is "" or `next`, `arg` is blanked.
- Saves `General.undo`; if it is 0 and `cmd` is "", the saved value becomes 50. Sets `General.undo` = 0 for the duration.
- Reads the stage code s (2.3), then dispatches:
  - `id`: logs "Autodesk|FACE ROBOT 2.0" (no layout change).
  - Any other non-empty cmd except `clear` / `next`: logs "Unknown Face Robot command: <cmd>".
  - "" or `clear`: a flag is set when `cmd = clear`, `arg = type` and s <= 29. The settings object's reset `0x180027660(flag)` and `0x18002d0e0(s, false)` run (unread).
  - `next`: s = 15 runs `0x1800222e0`. s = 30 or 35: if the `PickPoints` null (from FR settings) has exactly the expected child count, the analyze step `0x1800114c0(arg)` runs, else s becomes 30. s = 40 or 45 runs the solve step `0x18001d9e0(arg)`.
- Finally (all paths except `id` and unknown): `fr_SwitchFaceLayout` logic with s (the code read **before** the action), restore `General.undo`, refresh `0x1801a5ce0`.
- Because `analyze` and `solve` are blanked first, they behave like `cmd = ""`.

### `fr_GetCurrentStage`: SPEC
Wire contract:
- Init through the generic init: no args, `SetFlag(0x8, false)`, `SetFlag(0x800000, true)`, return value enabled.
- Execute: ReturnValue = the raw stage **code** from 2.3 (0, 10, 15, 30, 40, 50 or 60), not 1..6. Status OK.

### `fr_SwitchFaceLayout`: SPEC
Wire contract:
- Init: arg `inLayoutID` (empty default), description "", `SetFlag(0x800000, true)`, **return value disabled**.
- Execute (`0x18011c320(id)`):
  1. Returns OK without doing anything when not interactive or when `DSMustHideFaceRobotUI()` (import) is true.
  2. id = 0 is replaced by the current stage code. An id < 10 is multiplied by 10. Stage n = id / 10.
  3. If the active layout is not named `Face Robot`, the layout list is searched. If it is missing, log "Unable to locate Face Robot layout.  Terminating. (...)" and return E_FAIL. Otherwise `Desktop.PutActiveLayout` is called (every time).
  4. If the scaled id is exactly 50: `ShowOptionalPanel("timeline")` and `ShowOptionalPanel("toolset")`.
  5. For each view of the layout whose name matches stage n (`stage1`..`stage4`; for 5: `stage5`, `stage5library`, `stage5lower`; for 6: `stage6`, `stage6mid`, `stage6lower`), the `ui` subview gets attribute `refresh` = true and `PutVisible` is called. The visibility value is not recovered; for the plain `stage5` view it reads as false.
  6. The string `views\stage<n>_titleframe.html` is built but not used (inferred).
- Status OK.

## 4. Registry cross-check (args_d.json)
- All 18 names, argument names and argument order agree with the Init code that was read: fr_LoadC3D, fr_C3DToFaceRobot, fr_SwitchFaceLayout and FaceRobot. Arg names in Execute agree for the rest.
- Return value: `fr_SwitchFaceLayout` false agrees. `fr_FlushRetargetedFace` / `fr_LogFaceCalibration` (Init `0x180168cd0`) and the three no-op-Init commands never call `EnableReturnValue`. The registry's `true` must therefore be the SDK default, and none of them puts a ReturnValue.
- Semantics the registry names hide: fr_LoadC3D's `namefile` is the **name-map** file and `initDir` carries the C3D path. fr_C3DDebugFace's `facemap` is not used to pick the C3D (the dialog always opens). fr_GetCurrentStage returns codes 0..60, not 1..6.
- AfterImage (`src/commands/faceRobotModule.ts`) differences:
  - fr_GetCurrentStage returns 1..6; the binary returns the x10 code.
  - fr_SwitchFaceLayout ignores 0 and ids >= 10; the binary maps 0 to the current stage and 10..69 to id / 10. The binary also activates the `Face Robot` layout, fails with E_FAIL when that layout is missing, and opens the timeline/toolset panels for 50.
  - FaceRobot logs only; the binary does the undo-preference swap, `id` -> "Autodesk|FACE ROBOT 2.0", "Unknown Face Robot command: <cmd>", the stage actions and the final layout switch.

## 5. Open questions
- Q1. Values of 0x8 / 0x800000 in `siCommandCapabilities` (assumed siAllowNotifications / siNoLogging).
- Q2. The custom property added to `C3DFaceData` after a successful name-map pass (fr_LoadC3D) and the `gapproxmosl` value set on the marker cubes.
- Q3. The face-model UserDataBlob name read by fr_WriteC3D (global `0x1802d2600`), the byte source written to `outputfile`, and the face-map file suffix used by fr_WriteC3D / fr_C3DToFaceRobot.
- Q4. The `.fmap` and `.frpre` text layouts beyond the keywords listed; the `C3DDir` installation-path enum.
- Q5. The PutVisible values in fr_SwitchFaceLayout and the effect of the stage actions in FaceRobot (`0x1800222e0`, `0x1800114c0`, `0x18001d9e0`, `0x180027660`, `0x18002d0e0`).
- Q6. Whether the reader's dropping of the first fully valid frame (k+1 frames) and its handling of analog data are intended; both are observed, but a golden C3D import would confirm them.
