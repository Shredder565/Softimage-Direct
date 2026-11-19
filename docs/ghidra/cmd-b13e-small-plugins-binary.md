# CMD-B13e: small self-installing plug-in DLLs: PointOven MDD/LWO/scene/baker, CrowdFX FBX plotting, Ultimapper, ShapeWeight, HWParsers, DirectX .x import/export, BoneCreateTool, polymatricks, FR ICE import (poMDDFrameData, poMDDFrames, poMDDPoints, poMDDTimes, CrowdFBXPlot_ExportBegin, CrowdFBXPlot_ExportEnd, CrowdFBXPlot_ExportMode, FBXPlotAndExportCrowd, FindUltimapperDistance, GenerateUltimapper, fr_AddSamplerDataCache, fr_ApplyShapeWeightOp, PO_XSI_ImportLWO, XSI_Import_POScene, PO_XSI_ExportLWO, PO_XSI_Baker, ClearRealtimeShaderCache, DXExport, DXImport, BoneCreateTool_UpdateBone, Applypolymatricks, FR_Import_Animation_Rig_To_ICE)

Row: **CMD-B13e**. Status: **SPEC** (9 names: poMDDFrameData, poMDDFrames, poMDDPoints, poMDDTimes, CrowdFBXPlot_ExportBegin, CrowdFBXPlot_ExportMode, fr_ApplyShapeWeightOp, ClearRealtimeShaderCache, BoneCreateTool_UpdateBone), **SPEC-PARTIAL** (13 names: CrowdFBXPlot_ExportEnd - the FBX node/skin builder `0x1800093e0` was not read; FBXPlotAndExportCrowd - the FBX-XSI exporter driver `0x180008960`, the plug-in loader `0x18000a310` and the file dialog helper `0x18000ba30` were not read; FindUltimapperDistance - the temporary RenderMap set-up helpers `0x18000aa00` / `0x1800059a0` and cleanup `0x1800047f0` were not read; GenerateUltimapper - the generator `0x180006970` was not read; fr_AddSamplerDataCache - the blob get-or-create helper `0x1800027d0` and the exact blob byte layout were not read; PO_XSI_ImportLWO - the LWO pre-scan `0x180002140`, the chunk parsers and the scene builder `0x18000ec90` were not read; XSI_Import_POScene - the PO scene reader `0x180007ed0` and builder `0x180008020` were not read; PO_XSI_ExportLWO - the gather step `0x180001b80` and the writer body `0x180003a40` were read only for chunk tags; PO_XSI_Baker - the samplers and the LWO/EMDL/LWS/FXS/PSC/MEL/MOT writers and the MDD point writer `0x1800064e0` were not read; DXExport - the `.x` writer `0x18000c720` / `0x18000d350` was not read; DXImport - the `.x` parser / dotXSI builder `0x18000a480` was not read; Applypolymatricks - `polymatricks_Define` (stack-to-parameter mapping) was not read; FR_Import_Animation_Rig_To_ICE - the ICE graph wiring beyond node names and the per-port values was not read in detail).
Run: 2026-11-19, si-analyst worker, unattended, batch 13 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Base dir B = `C:\Program Files\Autodesk\Softimage 2015 SP2`. All images are PE32+ (amd64), image base `0x180000000`.

| # | Binary | bytes | sha256 | export timestamp |
|---|---|---|---|---|
| A | `B\Addons\PointOven\Application\Plugins\PO_MDDScriptTools.64.dll` | 32584 | `0da5a2b2d11667e5b6e7b2344a35fe4512ccb6dc6481d701adaa7c2497bb7ba2` | 1442479176 |
| B | `B\Addons\CrowdFX\Application\Plugins\CrowdFX.64.dll` | (not listed) | `33f67d9ea14cb4c03b9d2f8a24610bf31850c7f9ab7b32915c41ced70988c536` | - |
| C | `B\Application\Plugins\ultimapper.dll` (DLL name `Ultimapper.dll`) | 208200 | `fd9e4ec53845befd97b3df5b9ae6a7c9cc87c995641a925520e92b7f74f3611a` | 1442478281 |
| D | `B\Application\Plugins\ShapeWeight.64.dll` | 54088 | `5dbe0a48124385fb9f87e3371b339c92eafa8ec90313720e1e00ca292315ba41` | 1442479118 |
| E | `B\Addons\PointOven\Application\Plugins\PO_XSI_ImportLWO.64.dll` | 119624 | `141e437a0a54651a9b7722cf6e676a4333553997fde7ed54b72d4a5f951b16ba` | 1442479180 |
| F | `B\Addons\PointOven\Application\Plugins\PO_XSI_ExportLWO.64.dll` | 49992 | `83bb391a5f4ceacfb18196308924c6d7177ebfaf4b595c91adb9acc86e02e053` | 1442479176 |
| G | `B\Addons\PointOven\Application\Plugins\PO_XSI_Baker.64.dll` | 101704 | `6acf9cf255d377d27ea5447bedd59f4654b8efb69530c8305f3e14c67ac525c6` | 1442479176 |
| H | `B\Application\Plugins\HWParsers.dll` | 593224 | `31a568b77af93d954ef4cac9864c93880383bbfae4cb66f76ad0f67033522d57` | 1442478559 |
| I | `B\Application\Plugins\DirectXExport.dll` | 163656 | `6983a902c37f537a3dd8a729a4812b8d689db4a3dac6b758a76c97307c5860d5` | 1442478281 |
| J | `B\Application\Plugins\DirectXImport.dll` | 147784 | `e11da7f7cbb6e75a38aa1255fcd3e02d651facefcda31c2c0ae34f3326435c82` | 1442478282 |
| K | `B\Application\Plugins\BoneCreateTool.dll` | 48456 | `79f46514a3f64348d2f72991a74d7424af7a82b33fe14d648cb937ed39ffdc8f` | 1442479147 |
| L | `B\Application\Plugins\polymatricks.dll` | 69960 | `e714b00945fa832627e1741296af9a0a485b3de086fce0bd8e09ca81fce4cb2b` | 1442478257 |
| M | `B\Application\Plugins\FR_ICE_Import.64.dll` | 65352 | `74ad7cb356aca83dd432aa9f0846a9a219dc708756f7ed8be000a81c8cfcceac` | 1442479124 |

(B: the CrowdFX sha256 is from `open_binary`; its export table was not listed, and the handlers were located with `search_procedures`.)

Method: for each DLL, `inspect_native_exports` (except B), then Ghidra 12.1.4 (one binary open at a time, `close_binary` after each). I decompiled `XSILoadPlugin` (except in CrowdFX, where the command strings and handler symbols were used instead), every row's `_Init` (except `PO_XSI_Baker_Init`, where only the callee list was taken, and `DXImport_Init`, where the catalog defaults were taken) and `_Execute`, plus the key callees named in each section. String searches gave UI text, file-format keywords and parameter names. `read_bytes` read the LWO chunk-tag table in F and the extension labels in G. Arguments were cross-checked against `data/commands_full.json`: all 22 entries carry `file` = the DLL named here, and every argument name, order and default agrees, with the exceptions listed in §4. Statements describe behaviour read from the binary unless they are marked `(inferred)`.

## 1. Handler table

Display name = scripting name for every row. Commands registered with `RegisterCommand(name)` (single-name form) are marked "1-arg".

| Command (scripting name) | Display name | _Init | _Execute | key helpers |
|---|---|---|---|---|
| `poMDDFrameData` | poMDDFrameData | `0x1800023e0` | `0x180001880` | (self-contained, stdio) |
| `poMDDFrames` | poMDDFrames | `0x180003100` (shared with poMDDPoints) | `0x1800025e0` | - |
| `poMDDPoints` | poMDDPoints | `0x180003100` | `0x180002bd0` | - |
| `poMDDTimes` | poMDDTimes | `0x1800039c0` | `0x1800032b0` | - |
| `CrowdFBXPlot_ExportBegin` | CrowdFBXPlot_ExportBegin | `0x18000ce00` | `0x18000c070` | crowd-model finder `0x18000b560`, shared Term `0x18000d2e0` |
| `CrowdFBXPlot_ExportEnd` | CrowdFBXPlot_ExportEnd | `0x18000d180` | `0x18000cfb0` | FBX builder `0x1800093e0` (unread) |
| `CrowdFBXPlot_ExportMode` | CrowdFBXPlot_ExportMode | `0x18000d490` | `0x18000d380` | - |
| `FBXPlotAndExportCrowd` | FBXPlotAndExportCrowd | `0x18000dc70` | `0x18000d5f0` | `0x18000b730`, `0x18000ba30`, `0x18000a310`, `0x180008960`, `0x180008880` |
| `FindUltimapperDistance` | FindUltimapperDistance | `0x1800035f0` (shared) | `0x180002f90` | context `0x1800041e0`, distance finder `0x180004b90` |
| `GenerateUltimapper` | GenerateUltimapper | `0x1800035f0` | `0x1800032e0` | generator `0x180006970` (unread) |
| `fr_AddSamplerDataCache` | fr_AddSamplerDataCache (1-arg) | `0x180005640` | `0x180005450` | blob builder `0x1800010e0` |
| `fr_ApplyShapeWeightOp` | fr_ApplyShapeWeightOp (1-arg) | `0x180005af0` | `0x180005830` | operator builder `0x1800013b0` |
| `PO_XSI_ImportLWO` | PO_XSI_ImportLWO | `0x180011a10` | `0x1800112a0` | LWO reader `0x180002b80`, builder `0x18000ec90` |
| `XSI_Import_POScene` | XSI_Import_POScene | `0x18000ea40` | `0x18000e6f0` | `0x180007ed0`, `0x180008020` (unread) |
| `PO_XSI_ExportLWO` | PO_XSI_ExportLWO | `0x180001830` | `0x1800011c0` | gather `0x180001b80`, writer `0x180003a40` |
| `PO_XSI_Baker` | PO_XSI_Baker | `0x18000b640` | `0x180009ba0` | path check `0x180009570`, MDD header `0x180008bc0` |
| `ClearRealtimeShaderCache` | ClearRealtimeShaderCache | `0x1800246d0` | `0x1800246a0` | cache reset `0x1800036f0` -> `0x180003630` |
| `DXExport` | DXExport | `0x1800079e0` | `0x180007180` | export `0x1800030c0`, dotXSI stage `0x180003c70` |
| `DXImport` | DXImport | `0x180005950` | `0x180005410` | import `0x1800043f0`, `0x18000a480`, `0x180004a40` |
| `BoneCreateTool_UpdateBone` | BoneCreateTool_UpdateBone (1-arg) | `0x1800043b0` | `0x1800041e0` | Undo `0x1800047c0`, Redo `0x180004600`, TermUndoRedo `0x1800046a0` |
| `Applypolymatricks` | Applypolymatricks (1-arg) | `0x1800012c0` | `0x180001000` | operator `polymatricks_Define` `0x1800016a0` (unread) |
| `FR_Import_Animation_Rig_To_ICE` | FR_Import_Animation_Rig_To_ICE | `0x180008b90` | `0x1800037e0` | `0x1800011d0` (command runner), `0x180001e80` / `0x180001160` (string split) |

## 2. Shared facts

### 2.1 Plug-in registration

| DLL | Author / Name / Version | Registered items |
|---|---|---|
| A | "Mark Wilson" / " XSI_MDDScriptTools Plug-in" (with a leading space) / 1 | commands poMDDFrames, poMDDPoints, poMDDTimes, poMDDFrameData |
| B | (XSILoadPlugin `0x180015780` not decompiled) | the four rows; the name strings sit at `0x180029678`-`0x180029760`; the three `CrowdFBXPlot_*` share a `_Term` |
| C | "Softimage corp" / "Ultimapper" / 3 | property `Ultimapper` (Define `0x18000d570`, DefineLayout `0x180010850`, PPGEvent `0x180012ca0`); commands GenerateUltimapper, FindUltimapperDistance; menu `UltimapperMenu` at anchor 23 (callback `OnUltimapperMenu` `0x18000ce40`) |
| D | "Softimage" / "FR_ShapeWeight" / 1 (email, URL empty) | operator `fro_ShapeWeightOp`; commands fr_ApplyShapeWeightOp, fr_AddSamplerDataCache. `FR_SamplerOp`, `FR_ShapesOp` and `SimpleMultiOp` are exported but **not registered** |
| E | "Mark Wilson" / "PO_XSI_ImportLWO Plug-in" / 1, then author/name/version are put again as "XSI_Import_POScene Plug-in" / 1 | commands PO_XSI_ImportLWO, XSI_Import_POScene. The second PutName wins, so the plug-in is named "XSI_Import_POScene Plug-in" (inferred) |
| F | "Mark Wilson" / "PO_XSI_ExportLWO Plug-in" / 1 | command PO_XSI_ExportLWO |
| G | "Mark Wilson" / "PO_XSI_Baker Plug-in" / 1 | command PO_XSI_Baker |
| H | "Autodesk" / "HWParsers" / 1 | shader-language parsers `CgFXParser` and `HLSLParser` (the latter only when a capability probe `0x180040da0` is true (inferred: DirectX 9 available)); events `OnCreateDefaultClips`, `CgFXCacheProjectChange`; command ClearRealtimeShaderCache; shader `MetaSLMaterial` v1; converter events for `glsl` / `cgfx` / `hlsl` -> `OnExportShaderMentalMill{GLSL,CGFX,HLSL}` |
| I | "Softimage Corp" / "DirectX Export Plug-in" / 2 | command DXExport; property `DXExportProperty`; menu `DirectXExport` at anchor 1002 (item "DirectX Export...", callback `DirectXExport_ShowMenu`) |
| J | "Softimage Corp" / "DirectX Import Plug-in" / 2 | command DXImport; property `DXImportProperty`; menu `DirectXImport` at anchor 1003 ("DirectX Import...") |
| K | "Autodesk" / "BoneCreateTool Plugin" / 1 | tool `BoneCreateTool`; menu `BoneCreateMenu` at anchor 27; command BoneCreateTool_UpdateBone (with Undo/Redo/TermUndoRedo callbacks) |
| L | "Alexandre Jean Claude" / "polymatricksPlugin" / 1 (email `ajclaude@softimage.com`, URL `http://www.softimage.com`) | operator `polymatricks`; command Applypolymatricks |
| M | "hmathee" / "FR_ICE_Import Plugin" / 1 | an ICE node `FR_Compute_Shape_Weights` (registered by helper `0x180001530`, inferred); command FR_Import_Animation_Rig_To_ICE |

### 2.2 MDD (PointOven point cache) file layout, as read and written by A and G

Everything is **big-endian**. Readers assemble the first byte read as the most significant; writers byte-swap.

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | `frameCount` (int32) |
| 4 | 4 | `pointCount` (int32) |
| 8 | 4 x frameCount | `time[f]` (float32, seconds) |
| 8 + 4F | 12 x P x F | frame records in frame order; each frame holds P points; each point is `x, y, z` (float32 each) |

The byte offset of frame `k` (0-based) is `8 + 4*F + k*P*12`. The writer in G sets `time[f] = frame / fps` for `frame = Start..End` (scene frame rate from a default `CTime`).

### 2.3 DXExportProperty / DXImportProperty (custom properties, created on the scene root on first use)

Every parameter has capability 4 (siPersistable).

| Property | Parameter | Type | Label | Default |
|---|---|---|---|---|
| DXExportProperty | `Filename` | string | Filename | "" |
| | `DXType` | UInt4 | Format Type | 0 |
| | `Anim` | bool | Export Animation | true |
| | `FrameOffset` | UInt4 | Frame offset | 1 |
| | `AnimType` | UInt4 | Type | 0 |
| | `Textures` | bool | Export textures | true |
| | `txtabsolute` | bool | Absolute Paths | false |
| | `txtsequences` | bool | Sequences | false |
| | `txtfiles` | bool | Copy Textures | false |
| | `txtresizeX` / `txtresizeY` | UInt4 | Resize X / Resize Y | 0 / 0 |
| | `txtformat` | UInt4 | Format | 0 |
| | `triangulate` | bool | Triangulate | false |
| | `plot` | bool | Plot Animation | false |
| | `chains` | UInt4 | Chains | 0 |
| | `ExportHidden` | bool | Export Hidden Objects | false |
| | `CompressMesh` | bool | Compress Mesh | true |
| DXImportProperty | `Filename` | string | Filename | "" |
| | `Anim` | bool | Import Animation | true |
| | `Textures` | bool | Import textures | true |
| | `InvertUV` | bool | Invert UVs | false |
| | `Reorient` | bool | Reorient Scene | false |
| | `FrameOffset` | UInt4 | Animation frame offset | 1 |

File filters: export uses "DirectX Files (*.x)|*.x|Vertex Animation Files (*.vta)|*.vta|All Files (*.*)|*.*||" (titled "Export File"); import uses "DirectX Files (*.x)|*.x|All Files (*.*)|*.*||" ("Import File"). The DefineLayouts (`0x180007110`, `0x1800053a0`) and the import `RebuildLayout` were not read.

### 2.4 `.x` (DirectX) format facts

Both DLLs embed the text header `xof 0303txt 0032` followed by the template definitions `XSkinMeshHeader` {3CF169CE-FF7C-44ab-93C0-F78F62D172E2}, `VertexDuplicationIndices` {B8D65549-D7C9-4995-89CF-53A9A8B031E3} and `SkinWeights` {6F0D123B-BAD2-4167-A0D0-80224F25FABB}. The export DLL also carries the data-object names `Frame`, `FrameTransformMatrix`, `MeshFace`, `MeshFaceWraps`, `MeshTextureCoords`, `MeshMaterialList`, `MeshNormals`, `MeshVertexColors`, `AnimationSet`, `Animation`, `AnimationKey`, `AnimationOptions` and `ProgressiveMesh`. Both directions go through a temporary dotXSI file, `__tmp.xsi`, using the FTK (CSLScene) classes that are statically linked into each DLL.

### 2.5 LWO2 facts (E reads, F writes)

The file is IFF: `FORM` + BE u32 size + `LWO2`, then chunks of `[4-char tag][BE u32 size][data]`. The writer in F emits the tags `TAGS`, `LAYR`, `PNTS`, `VMAP` (type `TXUV`), `POLS` (type `FACE`), `PTAG` (type `SURF`), `VMAD`, and `SURF` with the sub-chunks `COLR`, `DIFF`, `SPEC` (this is the order of first use in the writer). It precomputes the FORM size and writes floats big-endian. The reader in E walks the top-level chunks twice. Pass 1 handles `LAYR` (each `LAYR` after the first starts a new layer), `PNTS` and `POLS`. Pass 2 handles `LAYR`, `PTAG`, `VMAD` and `VMAP`. Unknown chunks are skipped by their size. The walker adds the size without IFF even-byte padding (inferred quirk).

## 3. Contracts

### `poMDDFrames`: SPEC

Wire contract:
- Args: `FileName` (no default), `Mode` (no default), `Value` (no default). The return value is enabled.
- Shared preamble for the four poMDD commands: FileName is converted character by character to a narrow 512-byte buffer (wide characters are truncated). If the Mode text is longer than 2 characters, the command logs "poMDDFrames. Error, read mode flag in correct" and fails with E_FAIL. Only the first character of Mode is used: `r`, `w` or `m`. Any other character succeeds and does nothing.
- `Value` is converted to an int before the mode is tested.
- `r`: opens the file "rb" and returns `frameCount`, the BE int32 at offset 0, as an int.
- `w`: opens the file "wb", so the file is **truncated to just these 4 bytes**. Writes Value as BE int32 and returns the string "<n> has been written to Frames".
- `m`: opens "r+b", overwrites offset 0 and returns "<n> has been merged to Frames".
- Errors: if the open fails, logs "poMDDFrames failed to open file!" and returns E_FAIL.

### `poMDDPoints`: SPEC

Wire contract:
- Args: same as poMDDFrames (shared Init). Same preamble, with the error text "poMDDPoints. Error, read mode flag in correct".
- `r`: returns `pointCount`, the BE int32 at offset 4.
- `m`: opens "r+b", seeks to 4, writes Value as BE int32 and returns "<n> has been written to points".
- There is no `w` branch: `w` succeeds and does nothing.
- Errors: "poMDDPoints failed to open file!" with E_FAIL.

### `poMDDTimes`: SPEC

Wire contract:
- Args: `FileName` = "", `Mode` = "r", `Value` (array, no default). Same preamble, with the error text "poMDDTimes. Error, read mode flag in correct".
- An empty FileName logs "poMDDTimes failed to open file!" and returns E_FAIL.
- `r`: clears the array; reads F at offset 0; skips 4 bytes; reads F BE float32 values and returns them as an array of doubles.
- `m`: opens "r+b". If the Value array is empty, logs "poMDDTimes failed. No data provided to put into file" and returns E_FAIL. Otherwise seeks to 8 and writes **every** array element as BE float32. There is no check against F, so a longer array overwrites frame data. Returns "<count> values have been written to times".
- `w`: does nothing and succeeds.

### `poMDDFrameData`: SPEC

Wire contract:
- Args: `FileName`, `Mode`, `Frame` (int), `Value` (array). None has a default. Same preamble, with the error text "poMDDFrameData. Error, read mode flag in correct". An empty FileName logs "poMDDFrameData failed to open file!" and returns E_FAIL.
- `r`: reads F and P. If `Frame > F + 1`, logs "poMDDFrameData error frame out of range" and returns E_FAIL (the bound is off by two compared with a 0-based index). Otherwise seeks to the frame offset of §2.2 and returns a flat array of 3P floats (`x0,y0,z0,x1,...`).
- `m`: if the array is empty, logs "poMDDFrameData failed. No data provided to put into file" and returns E_FAIL.
  - Reads F. If `F < Frame`, logs "poMDDFrameData failed. Frame number to insert data is greater than total number of frames in header." and returns E_FAIL.
  - Reads P. If the array count is less than P, logs "poMDDFrameData failed. Point count in file is greater than number of elements in user array." and returns E_FAIL. The check compares against P, not 3P.
  - Otherwise writes elements `0..3P-1` as BE float32 at the frame offset. Returns "<count> values have been written to frame <Frame>'s data".
- `w`: does nothing and succeeds.

### `CrowdFBXPlot_ExportMode`: SPEC

Wire contract:
- Args: `ExportAsGeometry` = 0. Description "Export mode". Init calls `SetFlag(<flag>, false)` (which flag is unknown) and EnableReturnValue.
- Steps: creates the plug-in's global export state if it is missing. The state holds two reference lists and an int mode. The command stores the argument (as unsigned long) in the mode. It returns nothing.
- Mode values used elsewhere: 0 = cache meshes / actor copies; 2 = mesh proxies; other values = neither (inferred: 1 = plain skeletons).

### `CrowdFBXPlot_ExportBegin`: SPEC

Wire contract:
- Args: `Selection` (array), `MeshesToCache` (array), no defaults. Description "Crowd plotting into FBX file pre-export step".
- Steps:
  1. Clears both state lists.
  2. For each valid ref in Selection, walks up the parents until it finds a Model that is not the scene root and carries a property named `CrowdFX`. If one is found, the model joins a unique set of crowd models; otherwise the original ref is appended to the output list L1.
  3. Mode 0: each valid ref in MeshesToCache is added to the set, to L2 and to L1. Then, for each crowd model, each member of its group `Actors_Copies` that is not already in the set is added to L2 and L1.
  4. Mode 2: for each crowd model and each X3DObject member of its group `Mesh_Proxies`, it finds the ICE tree `Set_Mesh_Proxy` and its compound `Set Mesh Proxy`. It takes the data-provider node connected to the port `In_Name` and reads its parameter `reference` (an object name). If that name resolves and the object is not yet in L1, the object is added to L1 and to state list B.
- Return: the two-element array `[L1 (objects to export), L2 (meshes to cache)]`. Status OK.
- `_Term` (shared by the three `CrowdFBXPlot_*` commands, `0x18000d2e0`) frees the global state.

### `CrowdFBXPlot_ExportEnd`: SPEC-PARTIAL

Wire contract:
- Args: `Ptrs` (array, no default). Description "Export Crowd as FBX". The catalog says return_value false, but Init calls EnableReturnValue (see §4).
- Steps: if the state mode is 0, does nothing and succeeds. Otherwise it reads `Ptrs[0]` and `Ptrs[1]` as raw 64-bit pointers: `Ptrs[0]` is an FBX SDK object (inferred: the FbxScene) and `Ptrs[1]` is a second native pointer. It passes them, with state list B and the flag `mode == 2`, to the builder `0x1800093e0`. The builder imports FbxNode/FbxMesh/FbxSkin/FbxCluster/FbxPose/FbxAnimStack/FbxAnimLayer (inferred: it bakes the crowd into skinned nodes). The status is the builder's.
- Unread: the builder `0x1800093e0`.

### `FBXPlotAndExportCrowd`: SPEC-PARTIAL

Wire contract:
- Args: `FilePathName` = "", `StartFrame` = 1, `EndFrame` = 100, `Models` (handler Collection), `ExportGeom` = false. Description "Export Crowd as FBX". Return: bool.
- Steps:
  1. Models are filtered to model type. If none is left, the command scans the scene's models for the first one whose `CrowdFX` property has `IsActive` true. If there is none, it logs the translated `XSICROWDFX` string 1 and sets status E_INVALIDARG.
  2. If FilePathName is empty, it opens a save dialog titled with the translated `XSIXSI` "Export FBX file". The start directory is the remembered path, or the active project path when none is remembered. The filter is FBX (inferred: "FBX (*.fbx)|*.fbx||"). Cancelling gives E_ABORT.
  3. Loads the FBX-XSI exporter ("FBX-XSI import/export Plug-in", `CreateFbxXsiObjectExporter`; format "FBX201400"), sets exporter option slot 0x10 to ExportGeom, runs the export of the models over `StartFrame..EndFrame` to the path, then cleans up.
- Return: true exactly when the status is OK.
- Unread: the exporter internals.

### `FindUltimapperDistance`: SPEC-PARTIAL

Wire contract:
- Args: `PSet` (no default). Init (shared with GenerateUltimapper) calls `SetFlag(<flag>, true)` and does not call EnableReturnValue. Return: float.
- Steps:
  1. Saves `preferences.Interaction.autoinspect` and sets it false.
  2. Resolves PSet as a CustomProperty. If that fails, it is treated as a name and resolved through GetValue.
  3. The low-res target is the property's first owner; the high-res source is the object named by the property's `Group` parameter. If either is invalid, logs "The high resolution source is invalid" and returns 0.0.
  4. Builds a temporary RenderMap (helpers unread) and sets: `surf_enabled` = false, `pos_enabled` = false, `vbasis_enabled` = false, `attribute` = 3, `ignoreobjs` = true, `dpth_enabled` = true, `dpthimagefile` = `%TEMP%\depthmap.ct`, `camdist` = 0.0, `dpthimagebitdepth` = 21.
  5. Runs RegenerateMaps. Loads the depth file as image clip `__temp__` (time 0). Scans channel 0 of every pixel: `D = max(max(p, 0.0001))` and `R = max(min(|p|, 100000))`.
  6. Deletes the clip and the RenderMap. Sets `PSet.Distance` = D x 1.01 and `PSet.DepthRange` = R x 1.01. Restores autoinspect.
- Return: D (unscaled). Status OK.

### `GenerateUltimapper`: SPEC-PARTIAL

Wire contract:
- Args: `PSet` (shared Init).
- Steps: the same autoinspect save/clear/restore and the same PSet resolution as FindUltimapperDistance. Then runs the generator `0x180006970`. If it returns false, the status is E_FAIL. No return value is put.
- Strings that describe the generator (inferred):
  - Parameters: `GenSurface`, `GenAO`, `GenMatColor`, `GenDepth`, `GenNormalM`, `GenNormalT`, `GenBentNormalT`, `MapPath`, `Prefix`, `Resolution`, `SuperSampling`, `Texcoord`, `Tangent`, `KeepTanOp`, plus the occlusion `occ*` set.
  - Map suffixes: normal, normalM, bentNormal, albedo, depth, ambocc, matcolor.
  - Image formats: Targa, Windows Bitmap, Softimage, JPEG, TIFF float, OpenEXR float, mental ray Color float.
  - Renderer "mental ray".
- Unread: the generator `0x180006970` and `Ultimapper_Define` / `DefineLayout`.

### `fr_AddSamplerDataCache`: SPEC-PARTIAL

Wire contract:
- Args: `Sampler`, `Control`, `ControlParent` (X3DObjects, no defaults). The return value is enabled.
- Steps: builds or updates a UserDataBlob named `SamplerData` (owner inferred: Control).
  - It maps the Sampler's global pose into ControlParent's space.
  - For each axis where the Sampler's local scaling is <= 0.0012, it zeroes that scaling component of the mapped transform.
  - It stores the resulting 4x4 matrix with a flag set to 1 as the blob value (a 192-byte buffer).
- Return: the blob ref. Status OK.
- Unread: the exact blob byte layout and the get-or-create helper `0x1800027d0`.

### `fr_ApplyShapeWeightOp`: SPEC

Wire contract:
- Args: `Clip` (ref list), `Sampler`, `n0`, `n1`, `n2` (long), `Control`, `ControlParent`, `NoNeutraPose` = false, `Method` = 3. **Method is never read.** The return value is enabled but **never set**.
- Steps:
  1. Builds the `SamplerData` blob as fr_AddSamplerDataCache does.
  2. For each clip i, creates a `fro_ShapeWeightOp` and gives it:
     - an output port on the clip's `weight` parameter (port name built from "weight" and i, inferred);
     - inputs `InCntrlLocal` (Control local kinematics), `InParentCntrlLocal` (ControlParent local kinematics) and `InSamplerMatrixBlob` (the blob);
     - parameters `n0`, `n1`, `n2` (double, default = argument, range 0..3), `i` (small int, default = i, range 0..256) and `NoNeutralPose` (bool, default = argument; note the spelling differs from the argument name).
  3. Connects each operator.
- Status OK.

### `PO_XSI_ImportLWO`: SPEC-PARTIAL

Wire contract:
- Args: `FileName`, `Import_Morphs`, `Import_Morphs_to_Mixer`, `Import_UVs`, `Import_Surfaces`, `Weights` (short flags), `Scale` (double). None has a default. The return value is enabled.
- Steps:
  1. FileName is narrowed into a 512-byte buffer, and `\` is replaced with `/`.
  2. A progress bar is shown with the caption "Point Oven Import LWO....".
  3. Parses the file (§2.5). Errors are logged as "POXSI_LWOImport. Error, cannot open file", "...bad header, not IFF", "...bad header, not LWO2" and "POXSI_LWOImport. Error, 1 or 2 point polygons found, please remove them in LW".
  4. On success, builds the scene, passing (Scale, Morphs, Morphs_to_Mixer, Surfaces, UVs, Weights).
- Return: the ref array of created objects. Any failure gives E_FAIL with no return value.
- Builder strings (inferred): one mesh per layer `Layer_%i`; UVs as `%s_UVMaps` (Texture Projection); surfaces as polygon clusters with `%s_Phong` / `%s_Material` (Phong); weights as `%s_WeightMaps` (Weight Map Property); morphs as `%sShapeKeys` via StoreShapeKey; mixer track `%s_Track` on Scene_Root with clip `%s_Clip` (AddTrack/AddClip, `Mixer.%s.%s.actionclip.weight` / `.timectrl.clipout`).
- Unread: the builder and the chunk parsers.

### `XSI_Import_POScene`: SPEC-PARTIAL

Wire contract:
- Args: `File`, `SearchPath1`, `SearchPath2`, `SearchPath3`, `SearchPath4` (no defaults). The return value is enabled.
- Steps:
  1. The status starts as E_INVALIDARG. File is narrowed to 256 bytes and the 4 search paths to 255 bytes each.
  2. Opens File "rb". If that fails, the command returns E_INVALIDARG silently.
  3. Otherwise it runs the reader, then the builder (the status is the builder's), and closes the file.
- Format/behaviour strings (inferred):
  - Progress: "Point Oven Import PO Scene...." with "Reading Camera" / "Light" / "Null" / "LWO Files"; toggles `preferences.General.undo`.
  - Sets `PlayControl.Format` / `Rate` / `In` / `Out`.
  - Camera parameters: pixelratio, aspect, pos*/rot*, fovtype, projplane*. Light types Infinite / Point / Spot, with color and intensity.
  - Models via PO_XSI_ImportLWO. MDD playback by ApplyOp of the `PO_XSI_Reader` operator ("POXSI"), setting `.polymsh.PO_XSI_Reader.FileName` and an expression on `.POTime`.
  - Errors: "PSC Error. No filename specified!", "PO_PSC ERROR! Cannot load file: %s.", "PO_PSC ERROR! Model file badness: %s.", "PSC Error. No mdd filename specified!", "PO_PSC ERROR! Invalid CRef for LWO import.", "PO_PSC ERROR! LWO import error."
- Unread: the scene file grammar.

### `PO_XSI_ExportLWO`: SPEC-PARTIAL

Wire contract:
- Args: `Objects` (comma-separated name list), `FileName` (no defaults). The return value is enabled but no value is put.
- Steps:
  1. FileName is narrowed to 256 bytes and `\` becomes `/`. Opens it "wb". If that fails, logs "POXSI_LWOExport. Error, cannot open file: <FileName>" and returns E_INVALIDARG.
  2. Splits Objects on `,`.
  3. Shows the progress "Point Oven Export LWO....Getting Data...". Gathers the data: materials by ProgID `Softimage.material-{phong,lambert,blinn,cooktorr,strauss}.1` use `diffuse`, and `material-constant` uses `color`; UVs from `uvspace`.
  4. Shows "...Writing Data..." and writes one LWO2 file (§2.5) holding all objects (inferred: one layer per object). Status OK.

### `PO_XSI_Baker`: SPEC-PARTIAL

Wire contract:
- Args (28, no defaults), by index: 0 `PO_ObjString`, 1 `PO_FilePath`, 2 `PO_StartFrame`, 3 `PO_EndFrame`, 4 `PO_ObjPreFix`, 5 `PO_MDDAct`, 6 `PO_LWOAct`, 7 `PO_LWOString`, 8 `PO_EMDLAct`, 9 `PO_EMDLString`, 10 `PO_LWSAct`, 11 `PO_LWSString`, 12 `PO_MELAct`, 13 `PO_MELString`, 14 `PO_FXSAct`, 15 `PO_FXSString`, 16 `PO_XSIAct`, 17 `PO_XSIString`, 18 `PO_MAXAct`, 19 `PO_MAXString`, 20 `PO_MOTAct`, 21 `PO_MOTSep`, 22 `PO_MOTString`, 23 `PO_CAMAct`, 24 `PO_LIGHTAct`, 25 `PO_NULLAct`, 26 `PO_OBJECTAct`, 27 `PO_LOCALSPACE`.
- Path validation, in order (the first failure aborts with E_INVALIDARG and the log "PO_XSI_Baker - the|The <path> ..." with the label):

  | Flag | Path argument | Kind | Label |
  |---|---|---|---|
  | MDDAct | FilePath | directory | MDD |
  | LWOAct | LWOString | directory | LWO |
  | EMDLAct | EMDLString | directory | EMDL |
  | LWSAct | LWSString | file | LWS |
  | MELAct | MELString | file | MEL |
  | FXSAct | FXSString | file | FXS |
  | XSIAct | XSIString | directory | XSI |
  | MAXAct | MAXString | file | PSC |
  | **MOTSep** | MOTString | directory | MOT |

  A "directory" must exist (a trailing slash is ignored), be a directory and be writable. A "file" must not be an existing directory and must be writable if it exists; if it does not exist, its parent is checked as a directory.
- Steps:
  1. Splits ObjString on `,` and resolves the objects into meshes, nulls, cameras and lights. The frame count is `n = End - Start + 1`.
  2. With MOTAct, allocates per-frame motion buffers for objects / cameras / lights / nulls when OBJECTAct / CAMAct / LIGHTAct / NULLAct is set.
  3. Samples all frames.
  4. LWOAct writes the LWO files; EMDLAct writes EMDL.
  5. MDDAct writes one file per mesh, `<FilePath>/` + PreFix + `<object name>.mdd`, with the §2.2 header and time table, then the point frames (with PO_LOCALSPACE). If the open fails, logs "PO_XSI_Baker - The MDD file cannot be created. Make sure the file name and prefix are valid: " and returns E_INVALIDARG.
  6. Shows the progress "Point Oven Export Processing....". Then writes LWS (LWSAct), FXS (FXSAct), the 3ds Max `.psc` (MAXAct), MEL (MELAct) and MOT (when both MOTAct and MOTSep are set).
  7. XSIAct only validates the path; no writer is called (inferred: unused).
- Status OK. No return value.

### `ClearRealtimeShaderCache`: SPEC

Wire contract:
- Args: none. Description "Clear Realtime Shader Cache". Init calls `SetFlag(a, true)`, `SetFlag(b, false)` and EnableReturnValue.
- Steps: under the lock of the plug-in's global realtime-shader file cache: starts the cache if it is not started; shuts it down; deletes its header file and its data file from disk; starts it again; unlocks.
- Status OK. No return value is put.

### `DXExport`: SPEC-PARTIAL

Wire contract:
- Args (catalog defaults confirmed): `DX_Filename` = "", `DX_Format` = 0, `DX_AnimationExport` = true, `DX_AnimationFrameOffset` = 1, `DX_AnimationType` = 0, `DX_TexturesExport` = true, `DX_TexturesAbsolutePaths` = false, `DX_TexturesSequences` = false, `DX_TexturesCopyTextures` = false, `DX_TexturesResizeX` = 0, `DX_TexturesResizeY` = 0, `DX_TexturesFormat` = 0, `DX_OptionsTriangulate` = false, `DX_OptionsPlotAnimation` = false, `DX_OptionsExportHiddenObjects` = 0, `DX_OptionsChains` = false, `DX_OptionsCompressMesh` = true. Init does not call EnableReturnValue.
- Steps:
  1. Gets `DXExportProperty` on the scene root, adding it if it is missing.
  2. Copies the arguments 1..16 in order into DXType, Anim, FrameOffset, AnimType, Textures, txtabsolute, txtsequences, txtfiles, txtresizeX, txtresizeY, txtformat, triangulate, plot, **chains <- DX_OptionsExportHiddenObjects**, **ExportHidden <- DX_OptionsChains**, CompressMesh. The two labels are swapped; the types match the swap (an int goes to `chains`, a bool to `ExportHidden`).
  3. If DX_Filename is empty, runs `InspectObj(prop, "", "DXExportProperty", 4 (modal), true)` and exports only when it returns OK. Otherwise sets `Filename` and exports.
  4. Export: does nothing if Filename is empty. Sets these `dotXSIExportOptions` values:

     | Option | Value |
     |---|---|
     | output_file_format_version | 300 |
     | animall | 1 |
     | tesselation | triangulate |
     | animplot | plot |
     | constraint | 0 |
     | fcurveKind | 20 |
     | interpolation | 3 |
     | envelope | 1 |
     | ik | `chains != 0` |
     | output_file_format | 1 |
     | textures, txtabsolute, txtfiles, txtformat, txtresizeX, txtresizeY, txtsequences | from the property |
     | sceneroot | `!ExportHidden` |

  5. Runs `SIExportDotXSIFile(target, "<drive><dir>\__tmp.xsi")` next to the output file. The target is the scene root when ExportHidden is true; otherwise it is the current selection, which is saved and restored around the call.
  6. Opens the temporary file as a CSLScene. If that fails, logs "Path error". Reads the scene; when CompressMesh is false, runs a mesh pass (`0x18000fff0`, unread). Writes the `.x` file (§2.4), with the errors "Error creating/writing file... aborting export" and "Error exporting directX file.".
  7. Deletes the temporary file. If that fails, logs "Unable to delete temporary file: <path>".
- Status always OK.
- Unread: the `.x` writer; the meaning of DXType / AnimType (inferred: text vs binary, matrix vs SRT keys).

### `DXImport`: SPEC-PARTIAL

Wire contract:
- Args: `DX_Filename` = "", `DX_AnimationImport` = true, `DX_TexturesImport` = true, `DX_OptionsInvertUVs` = false, `DX_OptionsReorientScene` = false, `DX_AnimationFrameOffset` = 1.
- Steps:
  1. Gets or creates `DXImportProperty` on the scene root. Copies the arguments 1..5 into Anim, Textures, InvertUV, Reorient, FrameOffset (a straight mapping).
  2. If the filename is empty, runs `InspectObj(prop, "", "DXImportProperty", 4, true)` and imports only on OK. Otherwise sets `Filename` and imports.
  3. Import: does nothing if Filename is empty. Converts the `.x` file into an FTK scene written to `<dir>\__tmp.xsi`. Strings involved: "Frame template found", unnamed frames are named `frame%d`, "DXIMPORTDUMMY", originator "Softimage .X Importer"; the error is "Error writing to intermediate scene in the directory specified".
  4. On success runs `SIImportDotXSIFile(tmp)` and deletes the temporary file (failure logs "Unable to delete temporary file: ").
- Status always OK.
- Unread: the `.x` parser.

### `BoneCreateTool_UpdateBone`: SPEC

Wire contract:
- Args: `OldBone` = "", `NewBone` = "", `OldRootBone` = "", `NewRootBone` = "", `RootPos` = vector (0,0,0). The catalog default is a Python `ISIVector3` repr. Init does not call EnableReturnValue.
- Steps (Execute): records the five arguments only while a BoneCreateTool instance is live (plug-in global). When the context reports `UndoRequired`, stores the record as `UndoRedoData`; otherwise frees it. **There is no scene change.**
- Undo: sets the live tool's current bone to the object named OldBone (cleared if the name does not resolve), its root bone to OldRootBone, and its root position to RootPos.
- Redo: the same with NewBone, NewRootBone and RootPos (the same vector is used for both directions).
- TermUndoRedo: frees the record.
- Status always OK.

### `Applypolymatricks`: SPEC-PARTIAL

Wire contract:
- Args: `target` = "", `stack` = empty array. Description "Create an instance of polymatricks operator". Init calls `SetFlag(<flag>, false)` and does not call EnableReturnValue.
- Steps:
  1. Copies each stack element (as a string) into a plug-in global string list.
  2. Creates a `polymatricks` operator through the Factory (inferred: `polymatricks_Define` builds the operator's parameters from that list; the operator strings include scale, translate, rotate, `_Angle`, shear, lookat, matrix, `noname_`, and a Refresh button).
  3. Adds one input/output port on the object named by `target` (default port name, ports -1/-1) and connects with the default mode.
  4. Returns the operator ref and clears the global list.
- Status OK. No error is reported for an invalid target (inferred: Connect fails silently).
- Unread: `polymatricks_Define` / `Update`.

### `FR_Import_Animation_Rig_To_ICE`: SPEC-PARTIAL

Wire contract:
- Args: `ModelName`, `FreezeICEData`, `IsTongue` (no defaults). IsTongue is read only when more than 2 arguments are passed. The return value is enabled, and **ReturnValue = true is put before any check**.
- Steps:
  1. Resolves ModelName as a Model. Takes its property named `Tongue` when IsTongue is set, otherwise `Mesh`. The property's `Geometry` parameter, appended to the model name, gives the target mesh. Any of these steps failing gives E_FAIL with no log.
  2. Collects the model's null children: those whose path contains "Tongue" when IsTongue is set, or those that do not contain it otherwise. Keeps the ones that carry a property named `SamplerCache` (case-insensitive).
  3. For each such sampler, takes the name prefix before `_` and finds the model's mixer clips with that name, setting each clip's weight (`... + 0.0`) with SetValue. From the matching clip's shape action source it collects the cluster property (the shape key) and its indices.
  4. Shows a cancellable progress bar, "Converting Shape Setup to ICE Trees (this may take a few minutes)...".
  5. Runs FreezeObj on the mesh. Applies an ICETree named `FR Create ICE Data` and a second one named `FR ICE Blend Shapes`. Adds the compounds `FR Blend Shapes` and `FR Determine Shapes Per Point`. Adds GetDataNode `Reference` nodes, `Set Data` nodes with ports, and builds the attributes `Self.ShapeScaling`, `Self.ShapeRotation`, `Self.ShapePosition`, `Self.ShapeDivisions`, `Self.Shape_I_Value` and `Self.ShapeController`, using BuildArrayNode / ScalarTo3DVectorNode fed with each sampler's `sclx/y/z`, `rotx/y/z`, `posx/y/z` and `denx/y/z` values (through `this_model.` references).
  6. A cancel stops the build and hides the progress bar. When FreezeICEData is set, the result is frozen (FreezeObj).
- Unread: the exact port wiring and the per-port values.

## 4. Open questions

1. Catalog mismatches with Init:
   - `CrowdFBXPlot_ExportEnd` / `CrowdFBXPlot_ExportMode`: Init calls EnableReturnValue, but the catalog says return_value false. The argument to EnableReturnValue was not recovered (the decompiler shows a stack slot), so it may be false.
   - `GenerateUltimapper`, `FindUltimapperDistance`, `DXExport`, `BoneCreateTool_UpdateBone`, `Applypolymatricks`: Init does not call EnableReturnValue, but the catalog says true. FindUltimapperDistance and Applypolymatricks do put a ReturnValue.
2. The `SetFlag` flag constants (CrowdFX, Ultimapper, HWParsers, polymatricks) were not recovered (the decompiler shows only the bool). The Ultimapper catalog `key_assignable` false suggests `siNoLogging` / `siAllowNotifications` (inferred).
3. G's MDD header: the decompiler shows the frame count converted int-to-float before the byte swap, while A's readers (and the common MDD convention) treat offset 0 as int32. Confirm with an instruction-level read of `0x180008bc0` whether the baker writes a float frame count.
4. `DXExport`: the swapped argument-to-parameter mapping of DX_OptionsExportHiddenObjects / DX_OptionsChains (§3). Also, the export reads the parameter as "Triangulate" (capital T) while Define names it "triangulate" (works only if parameter lookup ignores case).
5. CrowdFX `XSILoadPlugin` (`0x180015780`) was not decompiled. Only one copy of the `FBXPlotAndExportCrowd` string was found next to the doubled `CrowdFBXPlot_*` strings, so its registration form is unconfirmed. `CrowdFX_Plugin.py` was not inspected; all four names are implemented in the DLL.
6. The menu anchor numbers (Ultimapper 23, DirectX 1002/1003, BoneCreate 27) are left as raw values. Their siMenuAnchorPoints names are inferred, not read.
7. `fr_ApplyShapeWeightOp`: the output port name (index plus "weight") and the `i` parameter's exact type code (2) need an instruction-level check. The `fro_ShapeWeightOp_Update` algorithm (`0x1800043f0`) is outside this row.
