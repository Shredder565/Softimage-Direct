# CMD-B15: Face Robot `FR.dll`, answers to the PR #189 "Questions for the analyst" (follow-up to CMD-B14a..e)

Row: **CMD-B15** (answer sheet; no new commands). Promotes **5 names** from SPEC-PARTIAL to **SPEC**: fr_NeighborIndex, fr_MuteSources, fr_AddObjectInPlace, fr_RepairNan (B14a), fr_CrawlToVertex (B14e). Narrows the gaps of several other SPEC-PARTIAL rows (stated per answer). Of the 34 questions: 17 answered, 5 partly answered, 12 open (section 8).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\FaceRobot\Application\Plugins\FR.dll` (note: under `FaceRobot\`, not `Addons\FaceRobot\`), PE32+ amd64, image base `0x180000000`, sha256 `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` (same file as B14a..e).
Method: one REA/Ghidra 12.1.4 session (opened and closed by this worker). About 35 analysis calls: `search_strings` (shell command names, offset suffix candidates), `xrefs` on the runtime-initialised CString globals to reach their static initialisers, `batch_decompile` of the helpers named below, `procedure_assembly` for three functions whose constants the decompiler hid (`0x180188990`, `0x18011ea70`, `0x18011f4a0`, `0x180006ec0`), and one `read_bytes` (a wide-string literal). Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Runtime-initialised string globals (resolved)

Each global is a CString built by a CRT static initialiser. These names answer several questions at once:

| Global | Value | Initialiser | Used by (from B14 notes) |
|---|---|---|---|
| `0x1802d1e38` | `CDKMetaMouthOp` | `0x180200b00` | mouth data blob (fr_SculptMouth*, fr_AdjustMetaMouth, mouth bake `0x1800aded0`) |
| `0x1802d1dc8` | `CDKMetaMouthSymMap` | `0x180200b90` | mouth mirror-map blob |
| `0x1802d2600` | `CDKFaceRetargetOp` | `0x180201c40` | retarget blob (fr_WriteC3D, fr_C3DToFaceRobot, fr_FlushRetargetedFace, plot, poses) |
| `0x1802d2698` | `ZeroPoseO` | `0x180201dc0` | blob deleted by fr_ResetControllerDB and fr_RegenerateMouth |
| `0x1802d2668` | `ZeroPose` | `0x180201e80` | blob deleted by fr_ResetControllerDB and fr_RegenerateMouth |
| `0x1802d0040` | 6 strings (stride 0x20): `Mesh`, `LEye`, `REye`, `UpperTeeth`, `LowerTeeth`, `Tongue` | `0x1801ffe00` | `_`/`meshnames` written by the face-structure builder `0x18000ce80` |

A second mouth blob global `0x1802d1e58` (read by `0x1800aded0` next to `0x1802d1e38`) was seen but its initialiser was not read.

## 2. B14a answers

**Q1 (selection fallback, B14a Q3).** Confirmed. `fr_NeighborIndex_Execute` (`0x18018af40`), `fr_GetNormalArray_Execute` (`0x18018a280`) and `fr_GetOperatorsInStack_Execute` (`0x18018a760`) build the fallback object from the **Selection object's own reference**, while `fr_GetPointArray_Execute` (`0x18018ac80`) uses `Selection.GetItem(0)`. The three then run the same class test (a virtual call on the SIObject made from that reference, result masked with 0x48) and return **0x80020003** when it fails. A Selection reference is not an SIObject, so the test fails (inferred) and the fallback never succeeds in those three commands. Rows stay SPEC (fr_GetNormalArray, fr_GetOperatorsInStack); the quirk is part of the contract.

**Q2 (fr_NeighborIndex neighbour choice).** Helper `0x180188990(obj, vertexIndex, mode)`: geometry at the default time, vertex `vertexIndex` of the active PolygonMesh, its distance-1 neighbour vertices in the host's `GetNeighborVertices` order.
- mode 0: returns the index of neighbour 0 (the first one the host lists).
- mode non-zero: for each neighbour, normalises (neighbour position - vertex position), both in **local** coordinates (`Point.GetPosition`, no world transform), and scores it by its Y component; returns the index of the highest score. The first neighbour always seeds the best; later ones replace it only when strictly greater, so ties keep the earlier neighbour.
- `inVertex` = 0 is rejected with 0x80020003 because the Execute tests the long value for zero (real, not an argument-type artefact). No neighbours: the result is the index of an empty item (inferred -1).
**fr_NeighborIndex -> SPEC.**

**Q3 (GetFaceWeightMap match, `0x1800091a0`).** Not a prefix match. MapName is split on `_` into tokens; a candidate property matches when **every** token equals (case-insensitive) one of the property's user keywords (`GetUserKeyword` via `0x180009bb0`). The result keeps the candidates' order. GetFaceWeightMap stays SPEC; replace "prefix match (inferred)" with this rule.

**Q4 (fr_sfeatures).** Partly. The two formatters are plain field getters on a feature record: `0x18001c6b0(record, -1)` returns the record's string at +0x18 (with index i >= 0 it would return the i-th string of an array at +0x38, stride 0x10); `0x18001c820` returns the string at +0x08. So fr_sfeatures returns, per record, [string@+0x18, string@+0x08]. What those strings mean depends on the filler inside the state rebuild `0x18002d110`, which was not read. fr_sfeatures stays SPEC-PARTIAL (only the filler is missing).

**Q5 (fr_GetFaceModel).** The "Head" test `0x180009bb0(obj, "Head")` runs `GetUserKeyword(<obj full name>)` and returns true when any keyword equals `Head` case-insensitively. The six `meshnames` are `Mesh`, `LEye`, `REye`, `UpperTeeth`, `LowerTeeth`, `Tongue` (section 1). The builder `0x18000ce80` takes no arguments and returns nothing: stores `meshnames`, gets the face connection property (`0x18000a3b0`), then runs `0x180009f40`, `0x18000a800`, `0x18000a6f0`, `0x18000a990`, `0x18000b3f0` in that order (these five not read). fr_GetFaceModel stays SPEC-PARTIAL (builder sub-steps only).

**Q6 (fr_MuteSources).** `b_ResetTransforms` is **not used**: the Execute passes it to `0x18000af30`, but that helper takes only (objects, b_Mute, b_IncludeRetargeting). The reset is gated by **b_Mute**: b_Mute true runs `ResetTransform(<Objects as text>, ...)` with the constants 0, 0x40, 7 (wrapper `0x1801a7120`) and then, with retargeting, `fr_ResetRetarget(true)`; b_Mute false with retargeting runs `fr_ResetRetarget(false)`. The argument passed to fr_ResetRetarget is b_Mute. Retargeting = face model child `JawEnd_ControlOffset` exists AND b_IncludeRetargeting. Returns true after the work; empty collection -> 0x80020003. **fr_MuteSources -> SPEC.**

**Q7 (fr_AddObjectInPlace).** Builder `0x18011f4a0`: the capability call is `PutCapabilityFlag(8 = siNotInspectable, <bool argument>)`, and the Execute passes **false** for that bool, so the object is made inspectable (the flag is cleared, not set). Each comma-separated name in `inParamTags` gets `PutTags(1)` (siTag1). Size clamp: values below 0.01 become 0.01. **fr_AddObjectInPlace -> SPEC.**

**Q8 (fr_RepairNan).** `NurbsCurveList.Get` and `Set` are called with format **0** (siSINurbs) in `fr_RepairNan_Execute` (`0x18011ea70`). Nothing else changes in the B14a contract. **fr_RepairNan -> SPEC.**

**Q9 (`frf_visgroup`, `0x180124b30`).** Matches an input that is a SceneItem of class 0x44 (a Group, inferred from the class value) whose parent's type is `#model`, and then: if the group's `viewvis` value differs from 2 -> match; if it equals 2 -> match only when the group also has a property named `visibility`. Anything else, or an invalid input, does not match. fr_Visible stays SPEC; add this rule.

**Q10 (fr_GetFilesForBrowser 8.3).** Yes. The command enumerates `<path>\*.<extension>` with `FindFirstFileW` / `FindNextFileW` and never re-checks the extension of the returned names, so it inherits the Win32 matching rules, including the short-name (8.3) quirk where a 3-character extension pattern also matches longer extensions. Two contract details read here: element 0 of the result is incremented by 3 per file (so it equals 3 x file count, not the file count); for 1-part and 4+-part names the label is the whole file name. fr_GetFilesForBrowser stays SPEC.

## 3. B14b answers

**Q1 (Sculpt*End bake, MuteSculpting, flag +0x140, numerics).** Open. The bake paths `0x180108e40` / `0x180107370` and the session reader `0x180109b20` were not read in this batch.

**Q2 (CustomLinkOut label, post-step `0x1801003f0`).** Label: open. Post-step: it hides geometry so only the sculptable area is shown. It ORs the element flags of the session's clusters (session list at +0xa8) into one vertex bit array and inverts it (vertices outside every cluster). On ActiveSculpt (session +0x48) it collects every polygon adjacent to one of those vertices and runs, as JScript, `ToggleVisibility("<ActiveSculpt>.poly[<indices>]")`; on the face (session +0x18) it runs the same with the complementary polygon set (all polygons not collected; same indices are assumed valid on both meshes, inferred same topology). Each script run is followed by a refresh (`0x1801a6fd0`). An invalid cluster gives 0x80070057, a failed element-flag read 0x8000FFFF; otherwise S_OK. The script text is built by concatenation; only the prefix `ToggleVisibility( "` and the suffix `]");` were read (the middle literal, inferred `.poly[`, was not).

**Q3 (mouth globals, blob layouts).** Names: `0x1802d1e38` = `CDKMetaMouthOp`, `0x1802d1dc8` = `CDKMetaMouthSymMap` (section 1). Layouts: partly (see Q4 for the correction blob written by the bake).

**Q4 (`0x1800aded0` bake or revert).** It **bakes**. Steps: finds two children of the model named `<face name>` + two literal suffixes (not read; one is used as the sculpt mesh, the other's global transform is taken); reads the `CDKMetaMouthOp` blob and a second blob (global `0x1802d1e58`); resolves 17 controllers (`LMouthCorner`, `RMouthCorner`, `LLipUpperBend`, `LipUpper`, `RLipUpperBend`, `LLipLowerBend`, `LipLower`, `RLipLowerBend`, `JawEnd`, `LPuffer`, `RPuffer`, `mpChin`, `LNostrilBase`, `LNostrilBulge`, `NoseTip`, `RNostrilBase`, `RNostrilBulge`, each `*_Control`) through `0x1800ca2f0`. If the second blob starts with version 1.0 (tolerance 0.001) and a stored pose record matches the current controller state, that record is re-applied (`0x1800b6b10`) and nothing new is stored. Otherwise, for every tracked vertex, it compares sculpt-mesh and face-mesh positions (both through the record's transform) and keeps those whose squared distance exceeds 0.0001; when any exist it appends a new record (rotation quaternion and translation per vertex, 0x58 bytes each, plus a pose block) and rewrites the second blob with header {double 1.0, int, int count+1, int entries}. Returns 1 when both blobs exist, else 0. So fr_SculptMouthEnd's `cancel` = true path is the **apply/bake** path (the argument name is misleading). fr_SculptMouthEnd stays SPEC-PARTIAL (the two child suffixes and the second blob's name).

**Q5 (fr_ResetControllerDB blob names, reset helper).** Blob names: **`ZeroPoseO`** and **`ZeroPose`** (globals `0x1802d2698`, `0x1802d2668`). Reset helper `0x1800ca2f0`: not read. Row stays SPEC-PARTIAL (helper only).

**Q6 (pose file format).** Open (`0x1801639b0` / `0x180154d40` not read).

## 4. B14c answers

**Q1 (AddFaceControl suffix and 0x232).** Builder `0x180006ec0`. Offset parent name = `Nom` + **`_Parent`** (literal at `0x1802066c8`). Both nulls are made by `0x180007870` -> `0x180007630`: `AddNull(name)` under the parent, global transform = translation `Position`, parameter `primary_icon` = an icon value passed from the Execute (not read), parameter `size`, and a local `Display Property` whose `wirecol` is set. The offset null gets size = `Scale` x 0.2 and **wirecol = 0x232 (562)**, so 0x232 is a wireframe colour, not a display mode. The control null gets size = `Scale` and wirecol = `Color`. Then `0x180007380(control, "Control", "FaceControl")` (inferred: adds a `FaceControl` custom property named `Control`), and the keyword string becomes `"Control,"` + `Keywords` (written back into the argument) and goes to `0x18000b270` (inferred: sets user keywords). AddFaceControl stays SPEC-PARTIAL (icon value, `0x180007380`, `0x18000b270`).

**Q2 (MakeFaceStructure).** The builder `0x18000ce80` has no output (void, no arguments), so the command's return value is not the built model (B14c reading confirmed). Meshnames: section 1. Stays SPEC-PARTIAL (the five structure sub-builders).

**Q3 (RegenerateEyelids lookup).** Open.

**Q4 (fr_Map* `0x1801a6a90`, op `_Update`, invalid inFace).** Open.

**Q5 (fr_ApplyStress BaseLength, duplicator).** Open.

**Q6 (fr_MakeRegionMasks).** Open.

**Q7 (default `activecamera:b`).** Open (the layout default is not in FR.dll code read so far).

## 5. B14d answers

**Q1 (FaceRobot undo / PickPoints).** Open.

**Q2 (fr_SwitchFaceLayout PutVisible values, "(...)" text).** Open.

**Q3 (retarget blob).** Name **`CDKFaceRetargetOp`** (`0x1802d2600`). Layout and the fmap suffix: open. fr_WriteC3D stays SPEC-PARTIAL (byte source, suffix).

**Q4 (fr_LoadC3D sampler, Play Control, name-map property).** Open.

**Q5 (fr_CalibrateFace empty arg).** Every one of the 20 arguments is converted with `CValue` to-double and all 20 are passed to the writer `0x180156ca0` unconditionally; an empty argument therefore writes **0.0** (inferred: empty CValue converts to 0). No argument is skipped. Row stays SPEC.

## 6. B14e answers

**Q1 (fr_SolveTongue without `meshes/Tongue`).** `fr_SolveTongue_Execute` (`0x180099950`): after the solver it computes failure = (solver failure flag set) AND (solver result count <= 3). The flag is set only on the "Tongue markers are missing" path, so a missing Tongue mesh (solver stops early, empty result, flag clear) is **not** a failure: the command deletes every `Tongue*Marker` child of the store `Fit` null (DeleteObj each), skips the group and FaceConnections step because the `meshes/Tongue` value is empty, runs the stage refresh `0x180118890`, and returns **true with S_OK**. `FaceConnections.Tongue` is **not written** in that case. When the mesh exists and store group `groups/Tongue` is valid, the mesh is added to that group and `FaceConnections.Tongue` is set to the mesh value (inferred: the mesh reference). The failure path returns false with status 1 (CStatus False). The marker deletion also runs on the failure path. fr_SolveTongue stays SPEC-PARTIAL (solver helpers).

**Q2 (fr_CrawlToVertex).** Walker `0x180196fe0`, step `0x180197210`:
- The **first selected vertex is not in the output**. For each consecutive pair (a, b) the walk starts at a and appends each vertex it moves to, ending with b, so every later pair start is already present as the previous end.
- The direction is recomputed every step as **pos(b) - pos(current)** (not b - a).
- Step rule: candidates are the current vertex's neighbours other than itself that have more than one neighbour. If any candidate has b as a neighbour, the walk moves to the first such candidate at once. Otherwise it moves to the candidate whose stored neighbour direction vector (per-vertex table built by `0x180058d20`, inferred: normalised edge directions) has the largest dot product with the normalised direction; ties keep the first. No candidate: the pair's walk stops.
- If b is already a neighbour of the current vertex, the walk steps straight to b. At most 1024 vertices are appended per pair (B14e said 1023).
**fr_CrawlToVertex -> SPEC.**

**Q3 (fr_ClipWeights ties).** Open.

**Q4 (fr_DeformerToWeightMap map name, CompleteCluster).** Open.

**Q5 (fr_EnvelopeAliasing game-mesh lookup, `0x1801785b0`).** Face mesh = store `meshes`/`Mesh`; missing -> logs " Solved Face Robot Mesh Not Found, Solve Mesh and retry;" and fails. Game mesh: the scene root's property `Game_Export` must exist (else logs " Game Export Property Not Found" and fails); its parameter `ExportMesh` (a string) is resolved with `FindChild` under the scene root; not found -> logs " Game Export Mesh Not Found, Pick Mesh In Game Export Property" and fails. Stays SPEC-PARTIAL (fitting stages, `iterations`).

**Q6 / B14e Q7 (game shader "Constant").** A **name lookup**: `GetMaterials()` result, `CRefArray.GetItem("Constant")`. B14e Q2 also settled: the five clip slots are paired with the port table `0x1802d1b50` strictly by index (5 iterations, clip stride 0x30), so the label/port mismatch is shipped behaviour. Row stays SPEC.

**B14e Q5 (fr_RegenerateMouth deleted blobs).** `ZeroPoseO` and `ZeroPose` (not the mouth-sculpt blobs B14e inferred). Row stays SPEC-PARTIAL (mouth re-fit helpers).

## 7. Name-only shell commands

`fr_GetFile` (`0x1802269b8`), `fr_GetPointsAsText` (`0x180226a28`), `fr_GetKeyed_safe` (`0x180212030`), `SetControlKeys` (`0x180209090`), `fr_ResetRetarget` (`0x180207818`) exist in FR.dll only as **command-name strings passed to `Application.ExecuteCommand`**. They are not in FR.dll's 116-name registration table (B14a 2.1) and have no exported callbacks, so FR.dll does **not** register them. Call sites: fr_GetFile from a wrapper near `0x1801a8a51`; fr_GetPointsAsText from wrapper `0x1801a8ab0`; fr_GetKeyed_safe from `0x180097064`, `0x1800979c0`, `0x180099a9d`; SetControlKeys from `0x18001d94a`, `0x180119470`; fr_ResetRetarget from `0x18000b0ae`, `0x18000b199` (fr_MuteSources helper), `0x180182ea0`, `0x18018fbc1`, `0x1801908b1`, `0x1801930e7`, `0x1801963fa`. No string in FR.dll names a script file (searches for `.js`, `.vbs`, `.py` found nothing), so they come from another Face Robot plug-in, most likely a script plug-in in the same `FaceRobot\Application\Plugins` folder (inferred; file not identified).

## 8. Still open

B14a Q4 (feature filler in `0x18002d110`); B14b Q1, Q2 label, Q3 layouts, Q5 reset helper, Q6; B14c Q3, Q4, Q5, Q6, Q7; B14d Q1, Q2, Q3 layout and suffix, Q4; B14e Q3, Q4. Also: the second mouth blob name (`0x1802d1e58`), the AddFaceControl icon value, and the five face-structure sub-builders.
