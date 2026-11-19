# CMD-B14e: Face Robot `FR.dll`: export stubs, game hierarchy, game shader, weight clipping, crawl to vertex, deformer/weight-map transfer, duplicate face, envelope aliasing, shake fit, tongue fit/solve, regenerate mouth (fr_ExportLWScene, fr_ExportModel, fr_ExportMotionFile, fr_ExportPointOvenCache, fr_ExportPointOvenScene, fr_ExportShape, fr_ExportGameHierarchy, fr_ApplyFaceRobotGameShader, fr_ClipWeights, fr_CrawlToVertex, fr_DeformerToWeightMap, fr_DeformerTransfer, fr_DuplicateFace, fr_EnvelopeAliasing, fr_ShakeFit, fr_FitTongue, fr_SolveTongue, fr_RegenerateMouth)

Row: **CMD-B14e**. Status: **SPEC** (9 names: fr_ExportLWScene, fr_ExportModel, fr_ExportMotionFile, fr_ExportPointOvenCache, fr_ExportPointOvenScene, fr_ExportShape, fr_ApplyFaceRobotGameShader, fr_ClipWeights, fr_ShakeFit), **SPEC-PARTIAL** (9 names: fr_CrawlToVertex - the per-step neighbour choice `0x180197210` and the mesh-topology helper `0x180058d20` were not read; fr_FitTongue - the null builder `0x180007870` (exact null name suffix, size/display arguments) was not read and the use of `Scale` is not established; fr_SolveTongue - the solver `0x180097780` was read for its steps and texts only, and its helpers `0x1800960e0`, `0x1800961e0`, `0x180096f80`, `0x1801a7d20`, `0x180006ec0` were not read; fr_RegenerateMouth - the mouth re-fit `0x1800e34e0`, the calibration pass `0x18015da60` and the retarget-op helpers were read for strings only, and the two deleted blob names are inferred; fr_DuplicateFace - the per-mode source collectors `0x180176510` / `0x180176350`, the duplicator `0x180175fb0`, the model-mode builder `0x180175da0` and the stress-mesh builder `0x180177550` were not read; fr_DeformerToWeightMap and fr_DeformerTransfer - the transfer engine's point-correspondence (`0x180189ac0`, `0x18019b2c0`), weight-map writer `0x18019e900` and envelope writer `0x18019e380` were not read; fr_EnvelopeAliasing - the per-frame fitting stages of `0x1801792c0` were read for order and texts only, and the use of `iterations` is not established; fr_ExportGameHierarchy - `0x1801841c0` was read for its entry checks, envelope branch and texts only; the rig/locator builders `0x180183540`, `0x18017f1e0`, `0x1801813f0`, `0x180181d90`, `0x18017f580` and `0x180181290` were not read).
Run: 2026-11-19, si-analyst worker, unattended, batch 14 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

| Binary | bytes | sha256 | export timestamp |
|---|---|---|---|
| `C:\Program Files\Autodesk\Softimage 2015 SP2\FaceRobot\Application\Plugins\FR.dll` (PE32+ amd64, image base `0x180000000`) | 2996552 | `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` | 1442478276 |

Method: export addresses came from `inspect_native_exports` (394 exports) plus a `native-exports` view. In the shared Ghidra 12.1.4 session (not opened or closed by this worker) I decompiled every `_Execute` in this group, the `_Init` of the shared export stub, fr_SolveTongue, fr_FitTongue, fr_ShakeFit and fr_ApplyFaceRobotGameShader, and the callees named in each section. Three large helpers (`0x1801792c0`, `0x1801841c0`, `0x180097780`) were scanned for their order of steps, string literals, called commands and error branches, not read line by line. `search_strings`, `read_bytes` (the shader port table) and `xrefs` (message owners) were also used. Arguments were cross-checked against `args_e.json`; differences are in §4. Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | _Init | _Execute | key helpers |
|---|---|---|---|
| `fr_ExportLWScene` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportModel` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportMotionFile` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportPointOvenCache` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportPointOvenScene` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportShape` | `0x180119db0` (shared) | `0x180119cb0` (shared) | none |
| `fr_ExportGameHierarchy` | `0x180187c00` (not read) | `0x180187920` | game-export driver `0x1801841c0` |
| `fr_ApplyFaceRobotGameShader` | `0x180170da0` | `0x180170770` | shader connector `0x18016ffd0`, `SetViewDisplayMode` wrapper `0x180170690`, `SIConnectShaderToCnxPoint` wrapper `0x180170560` |
| `fr_ClipWeights` | `0x180174e80` (not read) | `0x180174cb0` | envelope cache `0x180171000` / `0x180172870` / `0x180171110`, clipper `0x180171b80`, descending sort `0x180172bf0` |
| `fr_CrawlToVertex` | `0x180198400` (not read) | `0x180197d30` | `fr_GetPointsAsText` wrapper `0x1801a8ab0`, index parser `0x180196ef0`, path walker `0x180196fe0`, `SelectGeometryComponents` wrapper `0x1801a7860` |
| `fr_DeformerToWeightMap` | `0x18019f2a0` (not read) | `0x18019f050` | transfer engine `0x180199880` |
| `fr_DeformerTransfer` | `0x18019f750` (not read) | `0x18019f520` | transfer engine `0x180199dc0` |
| `fr_DuplicateFace` | `0x180177a80` (not read) | `0x1801778a0` | duplicator `0x1801768d0` |
| `fr_EnvelopeAliasing` | `0x18017bf00` (not read) | `0x18017bce0` | aliasing driver `0x1801792c0` |
| `fr_ShakeFit` | `0x180199490` | `0x180199230` | shake solver `0x180198a00` |
| `fr_FitTongue` | `0x1800623f0` | `0x180061e60` | tongue fit `0x180060750`, group lookup `0x180008100`, add-to-group `0x1801201b0` |
| `fr_SolveTongue` | `0x18009a100` | `0x180099950` | tongue solver `0x180097780`, stage refresh `0x180118890` |
| `fr_RegenerateMouth` | `0x180170fe0` (shared no-op) | `0x1800ef2c0` | retarget mute `0x1801602d0`, MetaMouth builder `0x1800a3030`, `ActivateFCurve` wrapper `0x1800c9810` |

Shared addresses:
- **All six `fr_Export*` commands share one Execute (`0x180119cb0`) and one Init (`0x180119db0`).**
- `fr_RegenerateMouth_Init` is the generic "return success" stub `0x180170fe0`. The same stub is exported as `NameMapWizard_Define`, `fr_AdjustMetaMouth_Init`, `fr_AdjustRetargetedFace_Init`, `fr_CalibrateRetargetedFace_Init`, `fr_FacialMocapTools_Init`, `fr_InspectSculptHistory_Init`, `fr_ResetControllerDB_Init` and `fr_ApplyFaceRobotGameShader_Reload` / `_Term` / `_Unload`.

## 2. Shared facts

- **FR registry singleton** (`0x1800268d0`): an in-memory map from category to name to value. Lookups used here:
  - category `meshes`: `Mesh`, `Tongue`, `UpperTeeth`, `LowerTeeth`.
  - category `controls`: `Head_Control`, `JawEnd_Control`; the whole `controls` list.
  - category `groups`: `Tongue`. Group names that start with `__` are looked up in `privategroups` instead.
  - category `psets`: `FaceConnections`.
  - category `hpoints`: `HeadNull`.
  - category `externs`: `JawStart`.
  - single-key lookups: `FaceModel`, `Fit`.
  - The setter (`0x18002faf0`) ignores an empty value and the value `" "`.
- **Group lookup** (`0x180008100`): uses the registry first, then the group with that name in the FaceModel's groups. It does not create a group.
- **Debug logger** `0x18018a1c0`: its texts (e.g. "fromObject ", "toObject ", "Setting Cluster ", " sObj", " xOBj", "Face Locator count ") are built and then dropped. Nothing is logged, so these texts are not observable.
- **Command wrappers** call Softimage commands by name: `DeleteObj` (`0x1801a5c20`, `0x1801309d0`), `SelectGeometryComponents`, `fr_GetPointsAsText`, `ActivateFCurve(target, bool)`, `SetViewDisplayMode`, `SIConnectShaderToCnxPoint(src, dst, false)`, `InspectObj`, `SISmoothEnvWght`, `SetUserKeyword`, `HideAndUnselect`, `fr_GetKeyed_safe`, `fr_IsHeadMesh`, `fr_ScaleTongueMesh`, `SetValue`, `ActivateObjectSelTool`.
- **Retarget mute** (`0x1801602d0(mute, &previous)`):
  - It reads the FaceModel blob named by global `0x1802d2600`. If that blob is missing or its data does not decode, it returns false.
  - Otherwise it switches the retarget state and reports the previous state.
  - When muting, it sets local `posx/posy/posz/rotx/roty/rotz` to 0 on every 3D object in the face model that carries a `fro_FaceRetargetOp2` or `fro_FaceRetargetLocalOp` on its local kinematics, or whose name contains `_ControlOffset`.
- **Stage refresh** (`0x180118890`), called by fr_SolveTongue:
  - Re-applies the current Face Robot stage UI.
  - Sets preference `Interaction.stickytoggle`.
  - Sets the user camera: `fov` 20, `posy` 1, `posz` 42, `interestdist` 42.
  - Runs `HideOptionalPanel("lipsync_stow", false)`.
  - At later stages: runs `SetControlKeys` and logs "Control keywords were generated." / "Failed to generate control keywords.". On the `TonguePlay` ICE tree, replaces `Bezier Reference Frames Envelope` compound version 6.0 with "6.1".
  - Finally calls `DSSetFaceRobotInitialized(1)`.
- **Status codes**: `E_FAIL` = `0x80004005`, `DISP_E_MEMBERNOTFOUND` = `0x80020003`, `S_FALSE` = 1.

## 3. Contracts

### `fr_ExportLWScene`: SPEC

Wire contract:
- Args: `path`, `filename`, `start`, `end`, all with empty defaults. Init sets description "" and calls `SetFlag(<flag>, false)`. Init also calls `EnableReturnValue`; the flag constant and the boolean passed were not resolved by the decompiler (Q1).
- Execute converts args 0 and 1 to strings, ignores `start` and `end`, and returns S_OK. **It writes no file and changes no scene state.** The return value is never set.
- The other five `fr_Export*` commands are this exact handler pair (§1).

### `fr_ExportModel`: SPEC
Wire contract:
- Identical to fr_ExportLWScene (shared Init `0x180119db0` and Execute `0x180119cb0`). It is a no-op that returns S_OK.

### `fr_ExportMotionFile`: SPEC
Wire contract:
- Identical to fr_ExportLWScene (shared handlers). It is a no-op that returns S_OK.

### `fr_ExportPointOvenCache`: SPEC
Wire contract:
- Identical to fr_ExportLWScene (shared handlers). It is a no-op that returns S_OK.

### `fr_ExportPointOvenScene`: SPEC
Wire contract:
- Identical to fr_ExportLWScene (shared handlers). It is a no-op that returns S_OK.

### `fr_ExportShape`: SPEC
Wire contract:
- Identical to fr_ExportLWScene (shared handlers). It is a no-op that returns S_OK.

### `fr_ApplyFaceRobotGameShader`: SPEC

Wire contract:
- Args: `in_Target` (handler SingleObj), `API` = "OpenGL", `ClipCollection` (handler Collection). Init logs "Defining: <command name>" every time it runs. It sets no description and does not call EnableReturnValue.
- Errors:
  - If `in_Target` is not valid, logs "Please select the target mesh" and returns E_FAIL.
  - `API` is compared as text. "OpenGL" selects mode 0 and "DirectX" selects mode 1. Anything else logs "Unrecognized API. Please specify either 'OpenGL' or 'DirectX'" and returns E_FAIL.
- Clip slots 0..4 are the first five items of ClipCollection, each taken as an ImageClip2. For each slot, in order:
  - Valid clip: logs "Connecting clip: <clip name>".
  - Invalid clip: logs "Specified clip for <X> not found.", where X is DIFFUSE, SPECULAR, BACKDIFFUSE, NORMAL or WRINKLE for slots 0..4.
- Connector (`0x18016ffd0`):
  1. Takes the target's materials and opens a progress bar "Applying Realtime Shader..." with 7 x material count steps, then redraws the UI.
  2. Picks the material item named "Constant". If there is none, the connector returns false and the command returns E_FAIL.
  3. Runs `SetViewDisplayMode("OpenGL")` for mode 0 or `SetViewDisplayMode("DirectX9")` for mode 1.
  4. Sets the progress text "Constructing Shader UI".
  5. Finds the shader that drives the material's `realtime` parameter and runs `InspectObj(<shader full name>)`.
  6. For every valid clip slot i, runs `SIConnectShaderToCnxPoint("Clips.<clip name>", "<shader full name>.<port[i]>", false)` and sets the progress text "Connecting clips".
  7. Returns true, and the command returns S_OK. The return value is never set.
- Port table at `0x1802d1b50`, in slot order: `SpecularTextureSampler`, `WrinkleTextureSampler`, `NormalTextureSampler`, `BaseTextureSampler`, `AmbientSampler`. The slot labels in the log text (DIFFUSE, SPECULAR, ...) do not match these port names by index (Q2).
- The command does not create the shader. It needs a material named "Constant" whose `realtime` input is already connected.

### `fr_ClipWeights`: SPEC

Wire contract:
- Args: `inMesh` (object), `inClip` (long), `inIndex` (long). The return value is never set.
- Takes envelope number `inIndex` of `inMesh` (`GetEnvelopes()[inIndex]`) and caches:
  - its weight ClusterProperty, through the envelope's input port 4 target;
  - its deformers and the flat weight array;
  - the mesh's vertex list.
- E_FAIL if there is no envelope at that index or if `inClip` = 0.
- If the weight array or the deformer count is empty, nothing changes. Otherwise, for each point (one block of deformer-count weights):
  1. Collects the deformers whose weight is > 0.
  2. Sorts them by weight, largest first.
  3. If more than `inClip` deformers remain, sets the weights of the extra ones to 0 and adds up the removed amount R.
  4. Multiplies each kept weight by 100/(100 - R).
  5. If the kept weights do not sum to exactly 100, adds (100 - sum) to the largest kept weight.
- Writes the whole array back to the envelope weight property with `PutArray`. Returns S_OK.

### `fr_CrawlToVertex`: SPEC-PARTIAL

Wire contract:
- Args: `Select` = false. Returns a string.
- Steps:
  1. Runs `fr_GetPointsAsText("")`, which returns the selected points as text such as `Model.Mesh.pnt[3,17,42]`.
  2. Splits the text at "[". The part before it is split at "."; everything except the last token, joined with ".", is the object name (e.g. `Model.Mesh`).
  3. The part between "[" and "]" is split at "," and each piece is converted to a long. Ranges such as `3-7` are not expanded (they convert as a single number).
  4. Finds the object with `FindChild(name)` under the active scene root.
  5. For each pair of consecutive listed vertices (a→b), walks along mesh edges from a toward b. Each step moves to the neighbour whose direction best matches b - a (inferred; step rule `0x180197210` not read). Every visited vertex is added to the result, at most 1023 steps per pair. The walk stops early when a step fails.
  6. Builds the result string `<object name>.pnt[<visited indices, comma separated>]`.
  7. If `Select` is true, runs `SelectGeometryComponents(<that string>)`.
  8. Returns the string and S_OK.

### `fr_DeformerToWeightMap`: SPEC-PARTIAL

Wire contract:
- Args: `fromObject`, `toObject` (objects), `fromDeformer`, `toCluster` (strings), `CompleteCluster` (bool). The return value is the resulting ClusterProperty (weight map), or an invalid ref.
- Transfer engine steps:
  1. Binds the source and target. A missing source gives DISP_E_MEMBERNOTFOUND internally ("From Object Not Found" goes to the dropped logger).
  2. Selects the deformer named `fromDeformer` on the source; `CompleteCluster` is a flag of this step.
  3. If source and target are different objects, builds a closest-point correspondence from the source points (in the source's global transform) to the target. It uses 3 samples (inferred).
  4. Finds cluster `toCluster` on the target geometry. If it does not exist, or its element count differs from the collected point list, it adds a vertex cluster (`siVertexCluster`) named `toCluster` with those points.
  5. Writes the deformer's influence as a weight map on that cluster (writer `0x18019e900`, not read; strings "Influence WeightMap" / "CreateWeightMap" suggest how the map is created and named (inferred)).
- Always returns S_OK; errors appear only as an invalid return value.

### `fr_DeformerTransfer`: SPEC-PARTIAL

Wire contract:
- Args: `fromObject`, `toObject`, `fromDeformer`, `toDeformer`, `type` (long), `CompleteCluster` (bool), `Clipping` (long). The return value is never set; always S_OK.
- Uses the same engine as fr_DeformerToWeightMap. The correspondence flag is always on here, while fr_DeformerToWeightMap passes "not 0".
- `type` = 0: treats `toDeformer` as the target cluster name and writes a weight map, as in fr_DeformerToWeightMap.
- `type` != 0: transfers the envelope weights of `fromDeformer` onto `toDeformer` on the target, limiting each point to `Clipping` deformers (writer `0x18019e380`, not read).

### `fr_DuplicateFace`: SPEC-PARTIAL

Wire contract:
- Args: `dupmodelname` = "FaceDuplicate", `parts` = 0, `options` = 0, `method` = 0. The return value is the duplicated X3DObject; it is invalid on failure.
- Requires the registry `FaceModel`. It also requires the `meshes/Mesh` face mesh unless `options` = 1. Otherwise it returns DISP_E_MEMBERNOTFOUND.
- What `parts` selects:
  - 0: face-mesh part set (`0x180176510`).
  - 1: FaceModel-based part set (`0x180176350`).
  - 2: the face mesh only.
  - 3: builds a "StressMesh" duplicate (`0x180177550`) and returns S_OK at once.
- If collecting the source returns DISP_E_MEMBERNOTFOUND, the command returns that.
- `method` = 1: adds a model named `dupmodelname` under the scene root and fills it from the `Mesh` registry entry (`0x180175da0`). Returns S_OK.
- Any other `method` value:
  1. Duplicates the collected objects. The output model handle passed from Execute is always empty, so the duplicates go into a new model named `dupmodelname` under the scene root.
  2. Renames each duplicate to its source's name.
  3. On each duplicate: collects `pnt`/`edge` clusters (`0x180188390`) into a list for later deletion, gathers operators/objects with `0x180189310(obj, 1, 4)` and runs `DeleteObj` on each, and runs `DeleteObj` on every property whose class is `CustomProperty` or whose type is `UserDataBlob`.
  4. Runs `DeleteObj` on the gathered cluster list. Returns S_OK.

### `fr_EnvelopeAliasing`: SPEC-PARTIAL

Wire contract:
- Args: `intime` = 0, `outtime` = 0, `steptime` = 1, `shakepasses` = 5, `startshake` = 2, `endshake` = 20, `clipping` = 0, `optimize` = 0, `considerneighborhood` = 1, `iterations` = 1. The return value is never set.
- Execute replaces `steptime` 0 with 1. The driver also has the message "Invalid Steptime (0). Changing to (1)", which the command path therefore never reaches.
- Driver order:
  1. If `intime` = `outtime`, takes the frame range from a helper (`0x180178930`, inferred: the scene timeline).
  2. Frame count = (out - in + 1) / step.
  3. Gets the face mesh and the enveloped game mesh (`0x1801785b0`). If either is missing, returns DISP_E_MEMBERNOTFOUND.
  4. Stores an `UnFilteredEnvelope` copy on the game mesh (`0x1801a9070`).
  5. Opens a cancelable progress bar "Envelope Analysis".
  6. If `considerneighborhood` != 0: runs `SISmoothEnvWght("", <game mesh>)` and sets the new operator's `neighborhooddepth` to `considerneighborhood`.
  7. Runs these stages in order: "Get Mesh Correspondence"; "Build Goals On Mesh Along Timeline, Frame: "; "Evaluate Error Along Timeline Frame: "; "Get Deformer StaticKineStates"; "Get Deformer Indices per Point"; "Get Deformer Transformations Per Frame"; "Fit Envelopes : " (per point, the shake solver of fr_ShakeFit with `shakepasses`, `startshake`, `endshake`); "Best Refit"; "Rewrite Weights".
  8. In "Rewrite Weights": if `clipping` != 0, clips to `clipping` deformers per point as fr_ClipWeights does. If `optimize` != 0, applies `0x180172d20` with `optimize` as a double (inferred: a threshold). Then writes the weights.
- Pressing Cancel in any stage returns E_FAIL. Otherwise returns S_OK. How `iterations` is used was not established (Q3).

### `fr_ExportGameHierarchy`: SPEC-PARTIAL

Wire contract:
- Args: `lowResMesh`, `lowResTongueMesh`, `ApplyEnvelope` = true, `nbBonesPerPoint` = 3, `ApplyAnimation` = true, `IncludeEars` = true, `OptimizeStep` = 0.0. The return value is a Model; it is invalid when the export stops early. Always S_OK.
- Execute passes [lowResMesh, lowResTongueMesh if valid] and the five options to the driver.
- Tongue check: if a tongue mesh is passed but the registry `meshes/Tongue` is invalid, logs "FaceRobot model has no valid tongue" and skips the tongue.
- Opens a cancelable progress bar "Game Export" with the status "Get Envelope Information".
- `ApplyEnvelope` = false ("Get Existing Envelope"):
  - If lowResMesh has no envelope, logs "Game Export Needs An Envelope" and returns.
  - Otherwise the result model is the model of the envelope's first deformer.
- `ApplyEnvelope` = true, mesh already enveloped:
  - Logs "Game Export is already Enveloped" and shows a Yes/No/Cancel question box (flags 0x23), caption "Autodesk|Face Robot", text "Game Face is already Enveloped: Do you want to re-envelope?\nYes:\tReenvelope and continue\nNo:\tContinue with current envelope \nCancel:\tExit".
  - Yes: `DeleteObj` on the existing envelopes, then continues as for a new envelope.
  - No: continues with the existing envelope, as for `ApplyEnvelope` = false.
  - Cancel: returns.
- New envelope ("Create New Envelope"): creates a model named "GameFace" (`0x180181290`, inferred to create or find it) and parents lowResMesh under it.
- Later stages, in order:
  1. "Get Maps: Parent, Locator, Spin" reads the maps `Locators`, `Spin`, `JawParent`, `HeadParent`, `NeckParent`, and the FaceModel `FaceScale`/`Scale`.
  2. Locator counting. "Too few Locators found on face, no export... " stops the export. "Too few Locators found on tongue, no export of tongue... " drops the tongue.
  3. "Create Rig Hierarchy" uses `LEye`, `REye`, `UpperTeeth`, `LowerTeeth`, `Tongue`, `JawEnd_Control`.
  4. "Get Export Envelope Nulls".
  5. "Weighting Game Envelope ".
  6. Animation plotting when `ApplyAnimation` is set (inferred).
- Each stage checks Cancel.

### `fr_ShakeFit`: SPEC

Wire contract:
- Args: `goal` (a CVector3), `Bones` (handler Collection), `Weights` (array). Init description "Command that ends and applies a sculpting session", tooltip "Apply the sculpting session", return value enabled.
- If `Weights` is empty or its count differs from the number of bones, it is resized to the bone count and every entry set to 100/count.
- Runs the shake solver (`0x180198a00`) with the bone positions, the weights and the fixed constants passes = 5, start = 2, end = 20:
  - normalizes the weights;
  - computes an initial fit toward `goal`;
  - runs passes + 1 refinement rounds with step factor 1/((passes·start - k·start + k·end)/passes), for k = 0..passes.
- **The solver's result array is discarded.** The command changes nothing in the scene, never sets the return value, and returns S_OK. It is observable only as a no-op that returns S_OK. The solver is shared with fr_EnvelopeAliasing, which uses its output.

### `fr_FitTongue`: SPEC-PARTIAL

Wire contract:
- Args: `HeadNull`, `TongueMesh` (objects), `TongueMarkers` = empty CRefArray (the binary default; the registry says ""), `MustDeleteMarkers` = false, `Scale` = 1.0. Description "", return value enabled.
- E_FAIL if `TongueMesh` is invalid or there are fewer than 4 `TongueMarkers`. If `HeadNull` is invalid, it is replaced by registry `hpoints/HeadNull`; E_FAIL if that is also invalid.
- If registry `meshes/Tongue` is already set, the command does nothing and returns S_FALSE (1).
- Otherwise:
  1. Sets registry `meshes/Tongue` = TongueMesh.
  2. Looks up group `Tongue` (registry, then FaceModel groups) and adds TongueMesh to it.
  3. Tongue fit (`0x180060750`):
     - Runs `SetUserKeyword(<tongue mesh>, "Tongue,Mesh")`.
     - If the tongue mesh has children named `TongueBase`, `TongueBack`, `TongueTip` and `TongueFront`, uses those as the four markers and runs `HideAndUnselect` on the four. Otherwise uses `TongueMarkers`.
     - If the marker set is not exactly 4 objects, returns an empty array.
     - Classifies the markers by the substrings `TongueBase` / `TongueBack` / `TongueFront` / `TongueTip` in their names.
     - Only when the passed markers are used, it moves TongueBack to 0.67·Base + 0.33·Tip and TongueFront to 0.34·Base + 0.66·Tip (global translation; which weight goes with Base or Tip is inferred).
     - Under the registry `Fit` null, creates one null per marker, in name order, at that marker's global position. Each null is named after the marker plus a suffix (inferred `_Marker`: the solver looks for `Tongue*Marker` and `TongueBase_Marker` etc.). Null size is 0.08·|Tip - Base|, with display constant 0x14c.
  4. Sets the return value to the array of new nulls.
  5. If `MustDeleteMarkers`, runs `DeleteObj` on every passed marker.
  6. Returns S_OK.
- Whether `Scale` reaches the fit is not established. The decompiler shows it passed in a register that the fit uses only as an evaluation-time argument (Q4).

### `fr_SolveTongue`: SPEC-PARTIAL

Wire contract:
- Args: `Rescale` = false. Description "", return value enabled.
- Step 1: runs `fr_GetKeyed_safe(["Tongue","Base"], <empty>)`. If that returns a non-empty array, the tongue is already solved: the return value is true and the result is S_OK, with no other change.
- Step 2: runs the solver (`0x180097780`, `Rescale`):
  1. Tongue mesh from registry `meshes/Tongue`. If it is missing, the solver stops.
  2. Parent: registry `controls/JawEnd_Control`, else the first result of `fr_GetKeyed_safe(["Jaw","Bone"])`, else `FaceModel`. The tongue mesh is parented under it, and `fr_IsHeadMesh(<tongue mesh>)` is run.
  3. Finds `Tongue*Marker` children of the registry `Fit` null. With fewer than 4, logs "Tongue markers are missing", sets the failure flag and returns an empty array.
  4. Classifies the markers by name (`TongueBase_Marker`, `TongueBack_Marker`, `TongueFront_Marker`, `TongueTip_Marker`).
  5. If `Rescale`, runs `fr_ScaleTongueMesh(<tongue mesh>, <scale>)`.
  6. Builds four controls `TongueBase_Control`, `TongueBack_Control`, `TongueFront_Control`, `TongueTip_Control` (display constant 0x15e). Their keywords are "Tongue,Base", "Tongue,Back", "Tongue,Front", "Tongue,Tip" (inferred: applied as keywords).
  7. Runs `SetValue("Views.ViewB.UserCamera.camvis.objnulls", true)` and tags `posx…rotz, sclx…sclz` on each control.
  8. Envelopes/binds the tongue (`0x1801a7d20`, `0x1800961e0(…,10)`, `0x180096f80`; inferred).
- Step 3, after the solver: runs `DeleteObj` on every `Tongue*Marker` child (recursive) of the registry `Fit` null, if that null exists.
- Failure (the solver set the failure flag and returned 3 or fewer refs): return value false, status S_FALSE (1).
- Success:
  1. Adds registry `meshes/Tongue` to group `groups/Tongue`, when the group and the mesh are both set.
  2. Sets parameter `Tongue` of the registry pset `FaceConnections` (value inferred: true).
  3. Runs the stage refresh (§2).
  4. Return value true, status S_OK.
- The text "Failed to solve tongue" (`0x1802093a0`) belongs to another caller (`0x18002010e`), not to this command.

### `fr_RegenerateMouth`: SPEC-PARTIAL

Wire contract:
- No arguments. Init is the shared no-op stub, so there is no description and return-value enabling is left at the Softimage default. The return value is never set; the status is S_OK except where noted below.
- Asks with a Yes/No/Cancel question box (flags 0x23), caption "SOFTIMAGE|Face Robot", text "Regenerate will delete all mouth sculpts.  Are you sure you want to continue?". Any answer other than Yes (6) returns S_OK with no change.
- On Yes:
  1. Runs `ActivateObjectSelTool`.
  2. Saves the global transform of the parent of `controls/Head_Control` and sets that transform to identity.
  3. Mutes retargeting (§2). If the retarget blob is missing, restores the head transform and returns S_FALSE.
  4. For every name in the registry `controls` list whose control exists: runs `ActivateFCurve("<control full name>.kine.local.<p>", false)` for p in posx, posy, posz, rotx, roty, rotz, then sets local posx/posy/posz/rotx/roty/rotz to 0. The suffix strings exist at `0x180215000…`; the exact order of the six is not settled.
  5. Runs `DeleteObj` on two FaceModel properties named by globals `0x1802d2698` and `0x1802d2668`, if present. Inferred to be the mouth-sculpt blobs: the candidates are `CDKMetaMouthSculpt` and `CDKMetaMouthSymMap`.
  6. Re-fits the mouth from `Fit` / `HeadNull` / `JawStart` and the lip/mouth-corner/jaw markers (`0x1800e34e0`).
  7. Rebuilds the MetaMouth operator (`0x1800a3030`), detailed in the sub-list below.
  8. Runs the calibration pass `0x18015da60` twice, with flags 0 and 1. It uses the marker blob and can log "Could not find the FaceRobot marker file.".
  9. Restores the retarget state.
  10. For every control, runs `ActivateFCurve(..., true)` for the six parameters.
  11. Restores the head-parent global transform. Returns S_OK.
- MetaMouth builder (`0x1800a3030`), step 7 above:
  - Needs two FaceModel-mesh blobs; it does nothing without them.
  - Adds a hidden `UserDataBlob` when the third blob is missing.
  - Computes 5% of |LMouthCorner_Control.x - RMouthCorner_Control.x|.
  - Adds a custom property with `RURef`, `RLRef`, `LURef`, `LLRef`, `Ping`.
  - Creates the custom operator **`fro_MetaMouthOp2`**, named **`MetaMouthOperator`**:
    - output: the mesh primitive;
    - inputs: the blobs, mesh primitive and kinematics, HeadNull, JawStart, eight lip/corner controls (global and local), upper/lower teeth, the custom property, cluster property `BlendingMap`, the stiction cluster, and the `posx` of two stiction proxies;
    - a bool parameter `UpdateInnerMouth` = true.
  - If missing, adds a custom property `LipStiction` with proxy parameters `Right` and `Left` (each a `posx`).
  - Connects the operator.

## 4. Registry cross-check

| Command | args_e.json | Binary | Note |
|---|---|---|---|
| fr_FitTongue | `TongueMarkers` default "" | default is an empty CRefArray | Execute reads the arg as a CRefArray. |
| fr_RegenerateMouth | return_value true, no args | Init is the shared no-op stub `0x180170fe0` | No description and no EnableReturnValue call; the return value is never set. |
| fr_Export* (6) | return_value false | Init calls EnableReturnValue with an unresolved bool, plus `SetFlag(?, false)` | The return value is never set either way (Q1). |
| fr_ApplyFaceRobotGameShader | return_value true | Init does not call EnableReturnValue; it logs "Defining: …" | The return value is never set. |
| fr_ShakeFit | return_value true | enabled, but never set | Description and tooltip confirmed. |
| fr_EnvelopeAliasing | description/tooltip from ShakeFit | Init not read | Defaults agree with how Execute treats the args (steptime 0 → 1). |
| all others | names, order, defaults | agree with Execute's reads | Inits of ClipWeights, CrawlToVertex, DeformerToWeightMap, DeformerTransfer, DuplicateFace, EnvelopeAliasing and ExportGameHierarchy were not read; their arg order and types agree with Execute. |

AfterImage: `src/commands/faceRobotModule.ts` registers fr_RegenerateMouth, fr_SolveTongue and fr_FitTongue with the correct names, order and defaults, apart from `TongueMarkers`, where the binary default is an empty CRefArray. Their bodies are placeholders: each attaches a `facerobot` property. The binary instead does the following:
- fr_FitTongue: the registry write, group membership, marker classification, `_Marker` nulls under `Fit` and optional marker deletion, returning the null array or S_FALSE.
- fr_SolveTongue: returns true early if already keyed, builds 4 `Tongue*_Control` nulls, deletes the `Tongue*Marker` nulls and sets `FaceConnections.Tongue`; on failure returns false with S_FALSE.
- fr_RegenerateMouth: the confirmation box, then the MetaMouthOperator rebuild.

None of the three returns a property.

## 5. Open questions

- Q1. Which flag constant does `fr_Export*_Init` pass to `SetFlag(…, false)`, and with what bool does it call `EnableReturnValue`? The decompiler shows only a stack pointer. Read the disassembly at `0x180119db0`.
- Q2. The game-shader clip slots are labelled DIFFUSE, SPECULAR, BACKDIFFUSE, NORMAL, WRINKLE but connect to the ports Specular, Wrinkle, Normal, Base, Ambient (table `0x1802d1b50`, index-paired). Is that the shipped behaviour (an upstream mismatch), or is the table walked in a different order? The loop pairs them by index.
- Q3. Does fr_EnvelopeAliasing use `iterations` at all? The driver signature as decompiled ends at `considerneighborhood`.
- Q4. Does fr_FitTongue's `Scale` reach `0x180060750`, and what null-name suffix and size/display does `0x180007870` use?
- Q5. Exact names of the two blobs fr_RegenerateMouth deletes (globals `0x1802d2698`, `0x1802d2668`; runtime-initialised CStrings), and of the retarget blob `0x1802d2600`.
- Q6. fr_CrawlToVertex: is the first selected vertex part of the output, and how does `0x180197210` choose each next vertex?
- Q7. fr_ApplyFaceRobotGameShader looks up the material named "Constant". Confirm that this is a name lookup and not an index.
