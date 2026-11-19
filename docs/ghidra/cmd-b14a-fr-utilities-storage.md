# CMD-B14a: Face Robot `FR.dll` utilities, key/value store, file I/O, queries, mesh arrays, groups/visibility, mute (fr_sget, fr_sset, fr_sdelete, fr_sindices, fr_sstring, fr_sdump, fr_sfeatures, fr_FileDelete, fr_FileRead, fr_FileWrite, fr_GetFilesForBrowser, fr_GetCommand, fr_GetCurrentObjState, fr_IsDesigner, fr_Callstack_IsDebugMode, fr_Mute, fr_MuteSources, fr_GetFaceModel, GetFaceCluster, GetFaceWeightMap, fr_NeighborIndex, fr_GetPointArray, fr_GetNormalArray, fr_GetOperatorsInStack, fr_GlueMeshGlobal, fr_AddToGroup, fr_Visible, fr_AddObjectInPlace, fr_RepairNan, fr_PrepareExport)

Row: **CMD-B14a**. Status: **SPEC** (24 names: fr_sget, fr_sset, fr_sdelete, fr_sindices, fr_sstring, fr_sdump, fr_FileDelete, fr_FileRead, fr_FileWrite, fr_GetFilesForBrowser, fr_GetCommand, fr_GetCurrentObjState, fr_IsDesigner, fr_Callstack_IsDebugMode, fr_Mute, GetFaceCluster, GetFaceWeightMap, fr_GetPointArray, fr_GetNormalArray, fr_GetOperatorsInStack, fr_GlueMeshGlobal, fr_AddToGroup, fr_Visible, fr_PrepareExport), **SPEC-PARTIAL** (6 names: fr_sfeatures - the feature-record formatters `0x18001c6b0` / `0x18001c820` and the code that fills the `features` table (inside the state rebuild `0x18002d110`) were not read; fr_GetFaceModel - the face-structure builder `0x18000ce80` sub-steps (`0x18000a3b0`, `0x180009f40`, `0x18000a800`, `0x18000a6f0`, `0x18000a990`, `0x18000b3f0`) and the "Head" test `0x180009bb0` were not read; fr_NeighborIndex - which neighbour is returned when `inMode` is non-zero is not settled; fr_AddObjectInPlace - the capability-flag constant and the tag value applied to `inParamTags` parameters were not recovered; fr_MuteSources - whether `b_ResetTransforms` is consulted was not recovered; fr_RepairNan - the NURBS data format constant passed to Get/Set was not recovered).
Run: 2026-11-19, si-analyst worker, unattended, batch 14 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Base dir B = `C:\Program Files\Autodesk\Softimage 2015 SP2`.

| Binary | bytes | sha256 | export timestamp |
|---|---|---|---|
| `B\FaceRobot\Application\Plugins\FR.dll` (PE32+ amd64, image base `0x180000000`, 394 named exports, PDB `FR.pdb` GUID ba48e154-f3e7-48b6-b5fc-0cac637d05c7) | 2996552 | `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` | 1442478276 |

Method: export table via `inspect_native_exports` (summary, then a native-exports view of all 394 rows). Ghidra 12.1.4 on the already-open shared session (no open/close). Decompiled `XSILoadPlugin`, `XSIUnloadPlugin`, every `_Execute` of the 30 rows, the `_Init`s of `fr_sget`/`fr_sdelete`, `fr_GetCurrentObjState`/`fr_IsDesigner`, `fr_GetPointArray`/`fr_GetNormalArray` and `fr_Visible`, and the key callees named in §1. The large state-rebuild routine `0x18002d110` was read only through its referenced-string list and the part that handles the `mem` persistence. The `SetFlag` constant in `fr_GetCommand_Execute` was read from the instruction listing (`0x800000`, value true). Arguments were cross-checked against `args_a.json` and against all 116 `FR.dll` entries in `data/commands_full.json`. Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Display name = scripting name for every row (the registration loop passes one name). Shared addresses are marked.

| Command | _Init | _Execute | key helpers |
|---|---|---|---|
| `fr_sget` | `0x180030dc0` (shared with fr_sdelete) | `0x180030ba0` | store getter `0x1800268d0`, get `0x180029ef0`, get-in-`_` `0x18002a4a0` |
| `fr_sset` | `0x1800312e0` | `0x180031070` | set `0x18002faf0`, mem persist `0x1800303b0` |
| `fr_sdelete` | `0x180030dc0` | `0x1800306c0` | delete `0x180026fe0` |
| `fr_sindices` | `0x180030fe0` (shared with fr_sstring) | `0x180030e80` | key list `0x18002aac0` |
| `fr_sstring` | `0x180030fe0` | `0x1800313d0` | localization lookup `0x18002a8a0` |
| `fr_sdump` | `0x1800309d0` | `0x180030880` | dump text `0x180030120` / `0x18002b160`, line logger `0x18002af40` |
| `fr_sfeatures` | `0x180030b40` | `0x180030a60` | `0x180029710` |
| `fr_FileDelete` | `0x180123da0` | `0x180123c70` | CRT `remove` |
| `fr_FileRead` | `0x1801241e0` | `0x180123e10` | - |
| `fr_FileWrite` | `0x180124470` | `0x180124260` | - |
| `fr_GetFilesForBrowser` | `0x18011b170` | `0x18011a860` | label fixer `0x18011a710` |
| `fr_GetCommand` | `0x1801abe40` | `0x1801abce0` | - |
| `fr_GetCurrentObjState` | `0x1801abfa0` (shared) | `0x1801ac070` (shared) | - |
| `fr_IsDesigner` | `0x1801abfa0` (shared) | `0x1801ac070` (shared) | - |
| `fr_Callstack_IsDebugMode` | `0x18011d410` | `0x18011d370` | - |
| `fr_Mute` | `0x18011c150` | `0x18011c050` | state toggle `0x18011bf50`, global byte `0x1802d20c8` |
| `fr_MuteSources` | `0x18000e0e0` | `0x18000df70` | `0x18000af30`, ResetTransform wrapper `0x1801a7120` |
| `fr_GetFaceModel` | `0x18000de20` | `0x18000dcf0` | finder `0x18000f3f0`, is-face-model `0x18000f750`, list `0x18000f5b0`, builder `0x18000ce80` |
| `GetFaceCluster` | `0x18000d250` | `0x18000cff0` | `0x1800093b0` |
| `GetFaceWeightMap` | `0x18000d850` | `0x18000d3a0` | `0x180009660` |
| `fr_NeighborIndex` | `0x18018b170` | `0x18018af40` | `0x180188990` |
| `fr_GetPointArray` | `0x18018a510` (shared with fr_GetNormalArray) | `0x18018ac80` | `0x180189ac0`, geometry fetch `0x180188580`, to-world `0x180189d70`, flatten `0x180188260` |
| `fr_GetNormalArray` | `0x18018a510` | `0x18018a280` | `0x180188cc0` (same helpers) |
| `fr_GetOperatorsInStack` | `0x18018aa20` | `0x18018a760` | stack walker `0x180189310` |
| `fr_GlueMeshGlobal` | `0x1801228c0` | `0x180122600` | operator builder `0x180121100` |
| `fr_AddToGroup` | `0x180122040` | `0x180121ea0` | not-inspectable setter `0x180121630` |
| `fr_Visible` | `0x1801237b0` | `0x180122ab0` | driver-param follower `0x180121410`, SetValue wrapper `0x1801a7f10`, ToggleVisibility wrapper `0x1801a86b0` |
| `fr_AddObjectInPlace` | `0x180121af0` | `0x1801217a0` | builder `0x18011f4a0` |
| `fr_RepairNan` | `0x18011eeb0` | `0x18011ea70` | NaN fixer `0x18011db90` |
| `fr_PrepareExport` | `0x18000e440` | `0x18000e320` | `0x180008de0`, `0x1800089a0`, `0x180008b40`, DeleteObj wrapper `0x1801a5c20` |

Shared helper: most of the simple `_Init`s (e.g. fr_sget/fr_sdelete) call one generic builder `0x1801a9260(context, name list, returnValueFlag)` that adds the named arguments with no defaults.

## 2. Shared facts

### 2.1 Plug-in registration (`XSILoadPlugin` `0x1801a9e30`, `XSIUnloadPlugin` `0x1801abcb0`)

- Author **"Softimage"**, name **"Face Robot"**, URL **"www.softimage.com"**, version **1** (only the major number is put). No e-mail.
- **Commands**: a stack table of 500 records `{int flag; CString name}` (stride 0x18) is filled with 116 names followed by an empty-name terminator; the loop registers every entry whose flag is `< 2`, stopping at the first empty name. Every flag is 0 or 1, so **all 116 are registered**. Order: FaceRobot, fr_sdelete, fr_sget, fr_sindices, fr_sset, fr_sstring, fr_MakeEyeBall, fr_LoadC3D, fr_C3DDebugFace, fr_CalibrateFace, fr_CreateFaceMap, fr_LogFaceCalibration, fr_SaveFacePose, fr_GetCurrentObjState, fr_AdjustRetargetedFace, fr_AnimateEyes, fr_ApplyFacePose, fr_C3DToFaceRobot, fr_CalibrateRetargetedFace, fr_ExportLWScene, fr_ExportModel, fr_ExportMotionFile, fr_ExportPointOvenCache, fr_ExportPointOvenScene, fr_ExportShape, fr_FacialMocapTools, fr_FlushRetargetedFace, fr_GetFilesForBrowser, fr_Mute, fr_PlotRetargetedFaceUI, fr_PlotRetargetedFace, fr_SwitchFaceLayout, fr_AddObjectInPlace, fr_CrawlToVertex, fr_FileDelete, fr_FileRead, fr_FileWrite, fr_GetCommand, fr_GlueMeshGlobal, fr_ResetControllerDB, fr_ProxyMouth, fr_VectorMouth, fr_Visible, fr_WriteC3D, fr_MakeRegionMasks, fr_MakeNormalMap, fr_DuplicateFace, fr_AnimateRegionMasks, fr_GetOperatorsInStack, fr_GetNormalArray, fr_GetPointArray, fr_NeighborIndex, fr_ExportGameHierarchy, fr_DeformerToWeightMap, fr_DeformerTransfer, fr_ApplyStress, fr_ClipWeights, fr_ApplyFaceRobotGameShader, fr_EnvelopeAliasing, fr_ShakeFit, fr_StickLips, fr_IsDesigner, **[flag 1 from here]** fr_GetCurrentStage, fr_sdump, fr_sfeatures, fr_SculptPuffingBegin, fr_SculptPuffingEnd, fr_SculptTendonBegin, fr_SculptTendonEnd, fr_SculptEyelidBegin, fr_SculptEyelidEnd, fr_MapRegion, fr_MapStress, fr_MapTendon, fr_ToggleShowMaps, fr_ToggleShowMapsUnselected, fr_SculptBegin, fr_SculptEnd, fr_SculptMouthBegin, fr_SculptMouthEnd, fr_RegenerateMouth, fr_MirrorMouthSculpt, fr_StartRegionPaint, fr_RefreshSculptHistory, fr_AdjustMetaMouth, fr_EyelidsDeformCurves, fr_EyelidsInfluenceMaps, fr_JawDeflationEaseInCurves, fr_JawFattening, fr_JawLowerDeflation, fr_JawSliding, fr_JawSlidingEaseInCurves, fr_JawUpperDeflation, fr_MirrorSculpt, fr_InspectSculptHistory, fr_DeleteSculptSession, fr_DeleteAllSculptSessions, fr_ToggleMuteSculptSession, fr_ApplySculptPose, fr_AddToGroup **[flag 0 again]**, MakeEyelids, MakeEyeRig, RegenerateEyelids, fr_PrepareExport, fr_RepairNan, fr_MuteSources, fr_GetEyelashMedian, AddFaceControl, GetFaceWeightMap, GetFaceCluster, fr_GetFaceModel, MakeFaceStructure, fr_FitTongue, fr_SolveTongue, fr_RemoveTongue, fr_Callstack_IsDebugMode. The 38 flag-1 entries are the sculpt/map/jaw tools plus fr_GetCurrentStage, fr_sdump, fr_sfeatures and fr_AddToGroup; the flag has no runtime effect in this build (inferred: a build-variant marker, e.g. "designer-only").
- **Events** (7): `fre_OnImport`, `fre_OnNewScene`, `fre_OnOpenScene`, `fre_OnCloseScene`, `fre_OnRetargetNewScene`, `fre_OnRetargetOpenScene`, `fre_OnStart` (the last also has `fre_OnStart_Term`).
- **Filters** (6): `frf_bone`, `frf_facestate`, `frf_groups`, `frf_polyandsurfmesh`, `frf_visgroup`, `FaceRobotControl` (callbacks `*_Match`).
- **Operators** (39): fro_BetweenCurveOp, fro_BrowSlideOp, fro_BrowTugOp, fro_BlinkOp, fro_CorneaOp, fro_EyeballTrackOp, fro_EyelidOp, fro_EyelidTransInfluenceCacheOp, fro_EyeLookAtOp, fro_FaceRetargetOp, fro_FaceRetargetOp2, fro_FaceRetargetCompensateOp, fro_FaceRetargetHeadNullOp, fro_FaceRetargetLocalOp, fro_GlueMeshGlobalOp, fro_GlueTugOp, fro_TugCurvesShrinkWrapOp, **fro_GlueTugOp1**, **fro_GlueTugOp2**, fro_IrisOp, fro_JawCornerOp, fro_JawOpenerOp, fro_JawTissueDeflatorOp, fro_LoftWithSpacingOp, fro_LookAtDirectionOp, fro_MapRegionStressTendonOp, fro_MetaMouthOp, fro_MetaMouthOp2, fro_VectorMouthOp, fro_MouthAdjustPropLink, fro_PufferMapOp, fro_PufferOp, fro_PufferFalloffCacheOp, fro_RegionMapOp, fro_RegionOp, fro_RegionFalloffCacheOp, fro_TendonMapOp, fro_TendonOp, fro_TendonFalloffCacheOp. `fro_GlueTugOp1` and `fro_GlueTugOp2` have **no exported callbacks** (registered names only).
- **Properties** (15): **C3DUpProperties** (no exported callbacks), FaceAdjustProperties, FaceCalibrateProperties, FacePlotProperties, FaceRegionProperties, FaceDeformProperties, FacialMocapTools, EyeballProperties, MouthAdjustProperties, NameMapWizard, JawFatteningProperty, JawDeflationProperty, JawEaseInProperty, JawSlidingProperty, SculptHistory.
- **Menus**: none registered.
- Ends with `DSSetIsFaceRobotLoaded(1)` (an imported host flag) and returns OK. `XSIUnloadPlugin` calls `DSSetIsFaceRobotLoaded(0)` and `0x180026920` (inferred: destroys the store singleton of §2.2).
- **Exported but never registered**: commands `MOVAContourImport` (Execute `0x1801a1d70`), `fr_GetMeshRegion` (`0x1801222b0`), `fr_ReadPhonemeBlob` (`0x180129310`), `fr_mirror_mouth_sculpt` (`0x18011d090`); property `MOVAContourImportProperty`; operators `MOVAContourOp`, `fro_GameMeshOp`, `fro_UConstraintOp`; menu `MOVAContourImportMenu` (`_Init` `0x1801a32a0`, callback `OnImportMenuClicked`). Non-callback exports: `fr_GetFaceModelInternal` (`0x180010880`), `fr_getCompanyID` (`0x1800026b0`).
- **Registry cross-check**: the 116 registered command names equal exactly the 116 `FR.dll` entries of `data/commands_full.json`; **no registered command is missing from the dump**, and no dump entry is unregistered.
- Many no-op callbacks share `0x180170fe0` (e.g. `fr_AdjustMetaMouth_Init`, `NameMapWizard_Define`, `fr_ApplyFaceRobotGameShader_Reload/_Term/_Unload`) (inferred: a stub returning OK). Several `DefineLayout`s share `0x1800ee500` / `0x180040180`.

### 2.2 The `fr_s*` key/value store singleton

- One heap object (0x68 bytes) at global `0x1802d1cb8`, created lazily by the first `fr_s*` call or by getter `0x1800268d0`. On creation it loads the localization table (below).
- Layout: `+0x00` a "features" table (string -> list of feature records); `+0x10` a bool; `+0x18`, `+0x28` two strings; `+0x38` the localization map (key -> string); `+0x48` the **main store**: map section -> (map key -> CValue); `+0x58` a second map of the same shape that `fr_sdelete` also clears (inferred: a cache). All maps are ordered by wide-string code-unit order, so key lists come back sorted, case-sensitive.
- **Key composition**: every command takes `(key1, key2)`. When the last argument (`key2` for get/delete, `value` for set) is **empty**, the section is `"_"` and the key is `key1`; otherwise the section is `key1` and the key is `key2`. There is no string concatenation: sections and keys are separate levels.
- **Set rule**: an empty value, or a value equal to the one-character string `" "`, is ignored (nothing is stored). A missing section is created.
- **Get rule**: missing -> empty value. If the stored value converts to a reference of a valid object whose name is non-empty, the result is that object evaluated at the current frame (the active project's `Play Control.Current`) through `ProjectItem::EvaluateAt`; otherwise the stored value as is.
- **Persistence** (`mem` section only): after any set or delete in section `"mem"`, the whole `mem` section is serialized as the concatenation of `<key>--=--<value>**=**` for every entry whose key and value are non-empty and start with a character above space, and written into the **user preferences**, category `Face Robot`, parameter **`Default_Type`** (no-op when the category is absent). The other sections live only in memory for the session.
- **Reload**: the state-rebuild routine `0x18002d110` (inferred: run on scene/face events; reached through `0x18002d0e0` from a data table) reads `Face Robot.Default_Type`; if it is longer than 0x800 (2048) characters it logs "Default_Type exceeds maximum length.  State memory inactive." and ignores it; otherwise it splits on `**=**`, then each piece on `--=--`, and re-stores every exact pair whose two parts start with a character above space into `mem`. The same routine stores section `paths`, key `factory` = the application installation path, reads `_`/`FaceModel`, `_`/`Fit`, `_`/`Actor`, `psets`/`FaceConnections`, `psets`/`FaceState`, deletes the face model's `PrivateGroupVisibility` property if present, and fills the `meshes`, `hpoints`, `controls`, `info` and `features` sections from the face model (progress text from localization key `pbar_evaluate`). Strings seen there also include `HeadNull`, `NeckNull`, `Skull`, `meshbox`, `fr_GetResolvedDNAPath`, `groups`, `FaceControl`, `Controls`. Its detail was not read.
- Other writers seen: the face-structure builder `0x18000ce80` stores `_`/`meshnames` = an array of 6 mesh names (table at `0x1802d0040`).
- **Localization table**: loaded only when the application is interactive. The path is the result of running the script command `fr_GetFile` with `views\FR.en-us.txt`. The file is read as bytes and widened one byte per character (Latin-1), split on line feeds; on each line the first whitespace-delimited token is the key and the rest of the line (leading and trailing whitespace trimmed) is the value. If the file cannot be opened: "Unable to read localization file '<path>'..." is logged.

### 2.3 Mute state

`fr_Mute` owns one global byte (`0x1802d20c8`, starts 0 = not muted). Nothing else in FR.dll reads it.

### 2.4 Message texts

"No filename for reading.", "Unable to open <file>", " MORE THAN ONE FACE CLUSTER FOUND! using <<...", " MORE THAN ONE WeightMap FOUND! using <<...", "Specified Object<<...>> ..." (GetFaceWeightMap type complaint), "Default_Type exceeds maximum length.  State memory inactive.", "Unable to read localization file '...".

## 3. Contracts

### `fr_sget`: SPEC

Wire contract:
- Args `key1`, `key2` (no defaults). Return value enabled.
- Returns the value at (`_`, key1) when key2 is empty, else at (key1, key2), with the object-evaluation rule of §2.2. Missing -> empty. Always OK.

### `fr_sset`: SPEC

Wire contract:
- Args `key1`, `key2`, `value` (no defaults). No return value.
- value empty: stores key2's value at (`_`, key1). value given and key1 == `"mem"`: stores **value converted to a string** at (`mem`, key2), then persists `mem` (§2.2). Otherwise stores value at (key1, key2). Empty or `" "` values are ignored. Always OK.

### `fr_sdelete`: SPEC

Wire contract:
- Args `key1`, `key2`. Return value enabled but no value is put.
- Removes (`_`, key1) when key2 is empty, else (key1, key2), from the main map and from the secondary map. When the section is `mem` the section is re-persisted. Missing keys are not an error. OK.

### `fr_sindices`: SPEC

Wire contract:
- Arg `key`. Returns an array of the key strings of section `key` (section `_` when key is empty), sorted (§2.2). Unknown section -> empty array. OK.

### `fr_sstring`: SPEC

Wire contract:
- Arg `key`. Returns the localization string for `key` from `views\FR.en-us.txt` (§2.2); missing (or batch mode, where nothing is loaded) -> empty string. OK.

### `fr_sdump`: SPEC

Wire contract:
- Arg `severity` (long; 0 is replaced by 8). No return value.
- Builds the text: an empty line, `--------`, then for each section `<section>: ` and for each key `   <key>: <value>` (three-space indent), then `--------`. Logs it line by line, each line cut into chunks of at most 100 characters, at the given severity (inferred: the severity is passed through to the logger). OK.

### `fr_sfeatures`: SPEC-PARTIAL

Wire contract:
- No args. Returns a flat array `[a0, b0, a1, b1, ...]` of two strings per record in the store's `features` table (the `+0x00` table, key `features`); empty array when absent. OK.
- Unread: what the two strings are (`0x18001c6b0` with argument -1, `0x18001c820`) and how the table is filled.

### `fr_FileDelete`: SPEC

Wire contract:
- Arg `filename`. Deletes the file through the CRT `remove` on the **ASCII** form of the name. Returns true when it succeeded, false otherwise. Status always OK.

### `fr_FileRead`: SPEC

Wire contract:
- Arg `filename`. Empty name: logs "No filename for reading.", returns "" with E_FAIL. Open failure (`_wfopen` "rb"): logs "Unable to open <filename>", returns "" with E_FAIL.
- Otherwise reads the whole file and returns it as a string built from the bytes as ASCII (stops at the first zero byte, inferred from the zero-terminated conversion). OK.

### `fr_FileWrite`: SPEC

Wire contract:
- Args `filename`, `txt`. No return value. Empty filename or open failure (`_wfopen` "wb", truncates) -> E_FAIL, nothing logged. Otherwise writes `Length(txt)` bytes of the ASCII form of txt (no BOM, no newline translation). OK.

### `fr_GetFilesForBrowser`: SPEC

Wire contract:
- Args `path`, `extension`, `defaultimage` (empty -> `img/BrowserDefault.gif`). Return value: an array whose element 0 is an int and is followed by triplets.
- Empty path or extension: returns `[0]`.
- Appends `\` to path if missing and enumerates `path\*.<extension>` (FindFirstFile order). For each file name split on `.`:
  - 2 parts `name.ext`: label = name; image = `path\name.gif` if that file exists, else defaultimage.
  - 3 parts `name.kind.ext`: label = name; image = `path\name.gif` (inferred composition) if it exists, else by `kind` (case-insensitive): `eye` -> `img/BrowserDefaultEye.gif`, `face` -> `img/BrowserDefaultFace.gif`, `dna` -> `img/BrowserDefaultDna.gif`, `faceani` -> `img/BrowserDefaultFaceAni.gif`, `facepose` -> `img/BrowserDefaultFacePose.gif`, `teeth` -> `img/BrowserDefaultTeeth.gif`, `tongue` -> `img/BrowserDefaultTongue.gif`, other -> defaultimage.
  - other part counts: label = whole file name; image = `path\<filename>.gif` if it exists, else defaultimage.
  - third element = `path\` + the file name (inferred).
  - The label has `_` replaced by spaces unless store value (`mem`, `show_`) is non-empty.
  - Element 0 is increased by 3 per file (so it holds 3 x file count) and the triplet `[label, image, fullpath]` is appended.
- Existence tests use `_access` on the ASCII path. Status OK.

### `fr_GetCommand`: SPEC

Wire contract:
- Arg `cmd` (scripting name). Looks up the command with `GetCommandByScriptingName`, **sets its `siNoLogging` flag (0x800000) to true** (a lasting change to that command), and returns the Command object (an invalid ref when not found). OK.

### `fr_GetCurrentObjState`: SPEC

Wire contract:
- Shares Init and Execute with fr_IsDesigner. No args; tooltip "undefined"; a command flag is set false/true in Init (constant not recovered). **Always returns true.** OK.

### `fr_IsDesigner`: SPEC

Wire contract:
- Same code as fr_GetCurrentObjState: **always returns true**.

### `fr_Callstack_IsDebugMode`: SPEC

Wire contract:
- No args. Description "Check if FaceRobot is running in debug mode". **Always returns false.** OK.

### `fr_Mute`: SPEC

Wire contract:
- Arg `state`. Empty, or a number outside 0..2: returns the current state unchanged. 0 -> unmuted (false); 1 -> muted (true); 2 -> toggles. Returns the resulting state as a bool. The state is the global byte of §2.3 (session only). OK.

### `fr_MuteSources`: SPEC-PARTIAL

Wire contract:
- Args `Objects` (collection), `b_Mute`, `b_IncludeRetargeting`, `b_ResetTransforms` (bools, default false). No return value.
- Empty collection -> status 0x80020003 (DISP_E_MEMBERNOTFOUND), nothing done.
- Reads the face model from store (`_`, `FaceModel`) and looks for its child `JawEnd_ControlOffset`. "Retargeting" applies when that child exists and b_IncludeRetargeting is true.
- b_Mute false and retargeting: runs script command `fr_ResetRetarget(false)`.
- b_Mute true: runs `ResetTransform(<Objects as text>, 0, 0x40, 7)` (inferred: object reference mode, SRT, XYZ), then, with retargeting, `fr_ResetRetarget(true)`.
- Nothing is actually muted in this build (inferred: code compiled out; unused Kinematics/FCurve/Parameter locals remain). OK.
- Unread: whether b_ResetTransforms gates the ResetTransform.

### `fr_GetFaceModel`: SPEC-PARTIAL

Wire contract:
- Arg `MakeFaceModel` (default false). Returns a Model ref.
- Order: (1) the model owning the first selected item, if it is a face model; (2) else the first face model among all scene-root descendant models (`#Model` search); (3) else, when MakeFaceModel, runs the face-structure builder `0x18000ce80` (sets `_`/`meshnames`, gets or creates the face connection property, builds the structure) and returns the model of the first selected item (empty when nothing is selected; as read, not the newly built model); (4) else an empty Model. Status OK.
- A model is a face model when: it passes the "Head" test (`0x180009bb0`), or it equals store (`_`, `FaceModel`), or it owns all three properties `FaceState`, `FaceConnections` and `FaceScale`.
- Unread: the builder's sub-steps and the "Head" test.

### `GetFaceCluster`: SPEC

Wire contract:
- Arg `Object`. Invalid -> first selected item; if that is missing or not of type `polymsh` -> status 0x80020003.
- Searches the active primitive's clusters named `FaceCluster` (filter `0x180008ec0`). None: adds an **empty vertex (`pnt`) cluster** and names it `FaceCluster`. One: returns it. Several: returns the first and logs " MORE THAN ONE FACE CLUSTER FOUND! using <<name...". Returns the Cluster. OK.
- Note: an explicit Object is not type-checked; only the selection fallback is.

### `GetFaceWeightMap`: SPEC

Wire contract:
- Args `MapName`, `Object`, `R`, `G`, `B` (defaults 255). Object must be a `polymsh`; otherwise logs "Specified Object<<fullname>> ..." (with its type) and falls back to the first selected item, which must be a polymsh, else status 0x80020003.
- Gets the face cluster as in GetFaceCluster, then looks among its properties for MapName (the name is split on `_` for the match, helper `0x1800091a0`, inferred: prefix match). None: adds a `Weight Map Property` named MapName and sets its parameters `red`, `green`, `blue` to R, G, B. One: returns it. Several: returns the first and logs " MORE THAN ONE WeightMap FOUND! using <<name...". Returns the ClusterProperty. OK.

### `fr_NeighborIndex`: SPEC-PARTIAL

Wire contract:
- Args `inObj`, `inVertex`, `inMode` (default 0). inObj invalid -> selection fallback (see Q3); failing the class test -> 0x80020003.
- **inVertex == 0 is rejected** with 0x80020003 (as read; vertex 0 cannot be queried).
- Takes vertex inVertex of the active polygon mesh and its neighbour vertices. Mode 0: returns the index of the first neighbour (inferred). Mode non-zero: computes, per neighbour, the Y component of the normalized direction from the vertex (dot with (0,1,0)) and keeps the largest (inferred: returns the most "upward" neighbour). Returns a long. OK.
- Unread: which index is returned in mode non-zero.

### `fr_GetPointArray`: SPEC

Wire contract:
- Args `inObj`, `inTime` (default 1.7976931348623157e+308 = DBL_MAX), `Global` (default false), `inMode` (default 3). inObj invalid -> first selected item; if it fails the class test -> 0x80020003.
- Reads the geometry at inTime with construction mode inMode (0..3 = modeling, primary shape, animation, secondary shape; any other value -> empty array). Global: maps each position to world space with the object's global transform at inTime. Returns a flat array `[x0,y0,z0,x1,...]` of doubles. OK.

### `fr_GetNormalArray`: SPEC

Wire contract:
- Same args, defaults and Init as fr_GetPointArray; returns the point normals, flat. Global applies the **position** world mapping (translation included) to the normals (as read; a quirk).
- Its selection fallback uses the Selection object itself, not item 0 (see Q3).

### `fr_GetOperatorsInStack`: SPEC

Wire contract:
- Args `inObj`, `inStackStart` (0), `inStackEnd` (4), `ioAdditiveArray` (""). Marker names by index: 0 `Zero`, 1 `Modeling`, 2 `Shape Modeling`, 3 `Animation`, 4 `Secondary Shape Modeling`. When end == 0 or end == start, start = 0 and end = 4.
- Walks the active primitive's `ConstructionHistory` filtered to `Operators`, from the top. Collecting starts on (or before the first item when end > 3) reaching marker[end] and stops at marker[start]. Marker operators and items without a valid object or name are skipped.
- Appends each collected operator to ioAdditiveArray (in place) and returns the collected array (empty if none; the internal "not found" status is not returned). OK.

### `fr_GlueMeshGlobal`: SPEC

Wire contract:
- Args `inDrivenMesh`, `inDriverMesh`, `inStack` (default 0). Missing driven -> selection item 0; missing driver -> selection item 1 (needs 2 selected). Either invalid -> E_INVALIDARG (0x80070057).
- Creates a `fro_GlueMeshGlobalOp` custom operator: input/output port on the driven active primitive; inputs: driven global kinematics, driver active primitive, driver global kinematics. Connects (inferred: with construction mode inStack). Returns the operator. OK.

### `fr_AddToGroup`: SPEC

Wire contract:
- Args `inGroup`, `inObjs` (Collection), `notInspectable`, `Branch`. No return value.
- `Group.AddMembers(inObjs, Branch)` (inferred: Branch as the branch flag). If notInspectable is non-zero, sets capability flag 8 (siNotInspectable) to true on each member through the COM `SetCapabilityFlag`. Status always OK.

### `fr_Visible`: SPEC

Wire contract:
- Args `inObjs`, `Value` (default the string "0", read as a long). Description "Visible Function that toggles (or sets value) visibility including visibility of group owners". No return value.
- inObjs: a single reference, an array/ref array, or a comma-separated string. Otherwise the selection; for branch-selected items all descendants are added. Empty selection -> status False (1).
- If the first object is invalid (empty type) or fails a class test, runs `ToggleVisibility` on the selection and stops.
- For every object that is not non-inspectable: takes `visibility.viewvis` / `rendvis` (or the object's own `viewvis` / `rendvis`). When those parameters are driven by an operator, the parameter on the operator's input port 0 is used instead. Currently-visible ones go to the "on" list, hidden ones to the "off" list. The owner groups that pass filter `frf_visgroup` (via `SIFilter`) contribute their `viewvis` / `rendvis` to a group list.
- Value 0: SetValue(on list, false) and SetValue(off list, true) (toggle). Value > 0: only SetValue(off list, true). Value < 0: only SetValue(on list, false). Then SetValue(group list, 2). The SetValue time argument is 0. OK.

### `fr_AddObjectInPlace`: SPEC-PARTIAL

Wire contract:
- Args `inPreset` ("Cube"), `inType` (0), `inParent` (SingleObj; invalid -> scene root), `inScale` (1.0), `inVector`, `inName` ("Cube"), `inColor` (0), `inParamTags` ("").
- inType 0: `AddPrimitive(inPreset, inName)`; 1/2/3: `AddGeometry(inPreset, "MeshSurface" / "NurbsSurface" / "NurbsCurve", inName)`.
- Adds a local `Display Property` and sets `wirecol` = inColor.
- Size = inScale, clamped up to 0.01, put into: Cube/Square `length`; Null `size`; Grid `ulength` and `vlength`; Spiral `endradius`; Disc `outerradius`; Text `fitsize`; Wave `vac`; Camera `projplanedist`; any other preset `radius`.
- Sets a capability flag true on the object (constant not recovered). Global translation = inVector (rotation and scale kept). Each comma-separated name in inParamTags: that parameter gets tags (value not recovered).
- An optional CustomProperty with a `Type` parameter exists in the builder but the command always passes "" so it is never added. Returns the new X3DObject. OK.

### `fr_RepairNan`: SPEC-PARTIAL

Wire contract:
- Arg `BrokenCurves` (collection; invalid -> the selection as text). Still invalid -> 0x80020003. No return value.
- For each object's NURBS curve list: every control point with a NaN in x, y, z or w is replaced: no valid neighbour on either side -> (0,0,0,1); only a following valid point -> that point; only a preceding one -> that point; both -> the **sum** of the nearest preceding and following valid points (the intended distance weights use integer division and come out as 1; as read, a quirk). Curves are written back only when something changed. Returns the status of the last Get/Set.
- Unread: the NURBS format constant.

### `fr_PrepareExport`: SPEC

Wire contract:
- Arg `Object`; invalid -> 0x80020003. No return value.
- Steps: (1) DeleteObj on all clusters of the active primitive that carry capability 8 (siNotInspectable), as one text list; (2) DeleteObj on every operator named `Envelope Operator` found in the whole stack (fr_GetOperatorsInStack walker, 0..4); (3) DeleteObj on every cluster whose name contains `_Region`, `_Tendon`, `_CurveCls` or `_Puffer`. OK.

## 4. Registry cross-check

Against `args_a.json` (and the same 30 entries of `data/commands_full.json`): every argument name, order and default checked in the Inits read (fr_sget / fr_sdelete, fr_GetPointArray / fr_GetNormalArray, fr_Visible, fr_GetCurrentObjState / fr_IsDesigner) agrees, and the Execute argument order agrees for all 30. Differences and notes:
- `fr_AddObjectInPlace.inVector` default is a Python COM repr in the registry; the binary reads it as a CVector3 (default not read from Init).
- `fr_Visible.Value` default is the string "0" in both; the command reads it as a long.
- `fr_sdelete` registry return_value true: Init enables it but Execute puts no value.
- `fr_GetCurrentObjState` tooltip "undefined" matches `PutTooltip("undefined")`; fr_IsDesigner shares the same Init, so its tooltip is also "undefined" although args_a shows it.
- Whole-DLL: registered 116 = dump 116, no extras either way (§2.1).

## 5. Open questions

Q1. The `SetFlag` constant and value in the shared `_Init`s (e.g. `fr_GetCurrentObjState_Init`, `fr_Visible_Init`) were not read from instructions (the Execute of fr_GetCommand uses 0x800000 = siNoLogging, true; inferred the same in the Inits).
Q2. Who calls the state rebuild `0x18002d110` (data reference at `0x1802d3fd8`), and its full section schema (`meshes`, `hpoints`, `controls`, `info`, `features`).
Q3. fr_NeighborIndex, fr_GetNormalArray and fr_GetOperatorsInStack build their selection fallback from the Selection object's own reference instead of item 0 (fr_GetPointArray uses item 0). Confirm at instruction level; if real, the fallback always fails with 0x80020003.
Q4. fr_NeighborIndex: the returned neighbour in non-zero mode, and whether rejecting vertex 0 is real or an argument-type artefact.
Q5. fr_Visible group owners are set to 2 for `viewvis` / `rendvis`; confirm the meaning of 2 for group visibility.
Q6. fr_MuteSources: the ResetTransform constants (0, 0x40, 7) and the use of `b_ResetTransforms`.
Q7. fr_AddObjectInPlace: the capability flag put on the new object and the tags put on `inParamTags` parameters.
Q8. The meaning of the per-command flag (0/1) in the registration table, which has no effect in this build.
Q9. `fro_GlueTugOp1` / `fro_GlueTugOp2` and `C3DUpProperties` are registered without exported callbacks; how the host resolves them (inferred: they fail to instantiate).
