# CMD-B18b: Face Robot mesh-preparation script commands (`PreparationTools.js`) and game-export eyelid / eyelash tools (`GameExport_EyelidTools.js`)

Row: **CMD-B18b**. Status: **SPEC** for all 15 commands (6 promoted from SPEC-PARTIAL in the same run once `MeshHelper.js` was read, see CMD-B18d).
Run: 2026-11-20, si-analyst worker, unattended, batch 18
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (JScript plug-in commands, category `Custom`, every argument flag 2 = siArgumentInput with no default).
Both files were read in full from the copy staged off the user's PC.

| File (`FaceRobot\Application\Plugins\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `PreparationTools.js` | 55632 | `84155d37` | whole | 9 (+ 2 custom properties) |
| `GameExport_EyelidTools.js` | 39164 | `484eef42` | whole | 6 |

Plug-in names: `PreparationTools` (author "Softimage Special Projects", 1.0, header (c) 2006 Avid) and
`GameExportEyelidTools` (same author, 1.0, URL `www.softimage.com`, header revision 2008.04.29).
Every command registered in the two `XSILoadPlugin`s is in `data/commands_full.json`; **no extra command**.
`PreparationTools.js` also registers two **custom properties** (not commands): `fr_InspectHoles` and
`fr_MouthInteriorProperty` (described below because commands create them).

Earlier contracts reused (cited as "same as …"): `cmd-b14a-fr-utilities-storage.md` (`fr_sget`, `fr_sset`,
`fr_sindices`, `fr_IsDesigner`, `fr_AddObjectInPlace`; promoted to SPEC in `cmd-b15-fr-pr189-answers.md`),
`cmd-b14c-fr-eyes-jaw-regions.md` (`fr_MakeEyeBall`), `cmd-b14d-fr-retarget-mocap.md` (`FaceRobot`).
Script helpers used but **not contracted anywhere yet**: `fr_GetPolymesh` / `fr_GetFRPolymesh` (`MeshHelper.js`, the
hole-analysis object), `GameExport`, `fr_GetGameFaceFromProperty`, `SetPropertyDisplay` (`Game_Export.js`),
`fr_GetEyelashes` (`MakeEyelashes.js`), `fr_ResetRetarget` (`GeneralHelper.js`).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `fr_CleanMeshModel` | PreparationTools.js | `fr_CleanMeshModel_Execute` | SPEC |
| `fr_Diagnose` | PreparationTools.js | `fr_Diagnose_Execute` | SPEC |
| `fr_Freeze` | PreparationTools.js | `fr_Freeze_Execute` | SPEC |
| `fr_Holes` | PreparationTools.js | `fr_Holes_Execute` | SPEC |
| `fr_PickEyeProximity` | PreparationTools.js | `fr_PickEyeProximity_Execute` | SPEC |
| `fr_PickMouthProximity` | PreparationTools.js | `fr_PickMouthProximity_Execute` | SPEC |
| `fr_AddMouthInterior` | PreparationTools.js | `fr_AddMouthInterior_Execute` | SPEC |
| `fr_AddEyeSocket` | PreparationTools.js | `fr_AddEyeSocket_Execute` | SPEC |
| `fr_AddEyeBalls` | PreparationTools.js | `fr_AddEyeBalls_Execute` | SPEC |
| `fr_GetGameSmoothMap` | GameExport_EyelidTools.js | `fr_GetGameSmoothMap_Execute` | SPEC |
| `fr_ApplyGameSmoothFromMap` | GameExport_EyelidTools.js | `fr_ApplyGameSmoothFromMap_Execute` | SPEC |
| `fr_CopyEyelashes` | GameExport_EyelidTools.js | `fr_CopyEyelashes_Execute` | SPEC |
| `fr_TransferEyelashEnvelope` | GameExport_EyelidTools.js | `fr_TransferEyelashEnvelope_Execute` | SPEC |
| `ClipDeformers` | GameExport_EyelidTools.js | `ClipDeformers_Execute` | SPEC |
| `UndoGameSmooth` | GameExport_EyelidTools.js | `UndoGameSmooth_Execute` | SPEC |

**Closed in the same run:** the hole analysis is now specified in [cmd-b18d-fr-small-scripts.md](cmd-b18d-fr-small-scripts.md) §2 (MeshHelper.js polymesh helper: hole detection, hole-record fields, `ReorderHole`, `GetClosestHole`, capping), so the six commands are SPEC. Quirks from that note that apply here: the helper is cached across calls without checking the mesh; the hole record has no `length`, so the `Holes.length` tests never pass; `ReorderHole` clears `PointIndices` of the other holes and does not update the axis indices; more than 99 holes leaves an empty point list. Original reason (kept for history): the geometry analysis they rely on (hole lists, `Holes.Points/Edges/PointIndices`,
`Centroids`, `QuadrantIndices`, `QuadrantPoints`, `MajorAxisLength`, `MajorAxisIndices`, `FurthestPoints`,
`OppositePoints`, `MidPoints`, `DepthVectors`, `GetHoles(flag)`, `GetClosestHole`, `ReorderHole`) lives in the
`MeshHelper.js` polymesh object, which has not been read. The command-side logic below is complete.

## 2. Shared helpers (PreparationTools.js)

| Helper | Behaviour |
|---|---|
| diagnose message | On the `FaceState` property of `fr_sget("FaceModel")`: adds a string parameter `Message` (default "", not animatable) when missing, sets it to the text; then `fr_sset("Diagnose", text)` (same as fr_sset: stores the text at (`_`, `Diagnose`)). This is the Face Robot panel's diagnose box; it is **not** a log message. |
| get head (name) | Mesh = `fr_sget("meshes","Mesh")`. Empty → runs `FaceRobot(cmd empty, arg empty, id "15")` (same as FaceRobot) and asks again. Still empty → diagnose message `<b>Pick Objects</b> before <name>.` and the command stops. |
| transform check | The mesh's global transform passes only when translation length is 0, XYZ rotation angles vector length is 0 and scale is exactly (1,1,1). |
| freeze face | For every key of `fr_sindices("meshes")`: mesh = `fr_sget("meshes", key)`; each of its constraints is deleted (`DeleteObj`, iterating the live collection by increasing index, so (inferred) every second constraint can survive when there are several); `RemoveAllAnimation` on it; all meshes then frozen in one `FreezeObj`. |
| pick loop | Saves 8 `Snapping` preferences and sets them: `Enable` 1, `Enable0D` 0, `Enable1D` 0, `Enable2D` 1, `EnableGrid` 0, `Faces` 1, `Surfaces` 0, `IgnoreBackfacing` 1. Repeats `PickPosition("pick","pick")` collecting positions until a pick returns ButtonPressed 0 (right-click) or the max count is reached; restores the 8 preferences; returns the positions. |
| unique | Removes duplicates, keeping first-occurrence order. |

## 3. Wire contracts, PreparationTools.js

### `fr_CleanMeshModel` (SPEC)
Args: `Del` (no default). Return: the model, or nothing.
1. Look up the model `fr_MeshClean` anywhere under the scene root (`FindChild`, type `#model`).
2. `Del` truthy: the get-head step runs (name empty, so its failure message reads `… before .`; its result is not
   used), then the freeze-face step on all Face Robot meshes, then `DeleteObj("B:<model>")` (branch delete) when the
   model exists. Returns nothing.
3. `Del` falsy: when the model is missing, `ActiveSceneRoot.AddModel()` with no members and rename it `fr_MeshClean`.
   Returns the model. Other commands below call it this way to obtain their container.

### `fr_Diagnose` (SPEC)
No args. Return: bool (true = mesh ready).
1. `FaceRobot()` with all arguments empty (same as FaceRobot). Get head with name `Diagnose`. `Valid` = parameter of
   `FaceModel`'s `FaceState`. No mesh → `Valid` = false, return false.
2. Lines are collected in order; first `<li>Mesh: <b><mesh fullname></b>`.
3. `FaceRobot("next", "", "15")` (same as FaceRobot `next`).
4. `<li>Number of Polygons in Mesh: <b><count></b>`.
5. Transform check fails → line `<font color=#82140F>Freeze Transform before Scan.</font>`, fail.
6. Holes: helper = `fr_GetPolymesh(mesh, 1)` (rebuilt), `GetHoles(1)`. More than one hole → lines
   `<font color=#82140F>Only one hole allowed in at neck base.</font>` and `<li>Number of Holes in Mesh: <b>n</b>`, fail.
7. Eyes: `meshes/LEye` or `meshes/REye` missing → `<font color=#82140F>Eyeballs required.</font>`, fail. Else for
   each eye (left first) the global translation must lie inside its geometry bounding box taken in the global
   transform (centre ± extent/2 on each axis); the first eye outside → `<font color=#82140F>Center Eyeballs on their
   pivots.</font>`, fail, stop checking eyes.
8. Teeth: `meshes/UpperTeeth` or `meshes/LowerTeeth` missing → `<font color=#82140F>Upper and Lower Teeth required.</font>`, fail.
9. `FaceState.DNA`: added when missing (string, persistable, script and long name `DNA`). Empty value →
   `<font color=#82140F>Please select the face type in the <b>Type</b> tab above.</font>`, fail.
10. Stack report over all `meshes` entries (lists of mesh **names** joined by `, `), each line only when non-empty:
    meshes with any construction-history operator → `<li>Scan will Freeze Modeling Stack for: <b>…</b>`; with fcurve
    animated parameters → `<li>Scan will Delete Animation Sources on: <b>…</b>`; with constraints →
    `<li>Scan will Remove Constraints from: <b>…</b>`. These never fail the diagnosis.
11. Passed: designer licence (`fr_IsDesigner`, same as B14a) → `<br/><font color=#388387><b>READY TO SCAN.</b></font>`;
    else `<li>Version: <b>Face Robot Animator</b>` then `<br/><font color=#833887><b>READY TO SCAN IN FACE ROBOT
    DESIGNER</font>.</b></font>` (mis-nested tags as shipped). `Valid` = true. Failed →
    `<br/><font color=#82140F><b>MESH NOT READY.</b></font>`, `Valid` = false.
12. Text = every line followed by `<br/>`; diagnose message with it; also stored on the helper object as `Diagnose`
    (used by `fr_Holes`). Return the pass flag.
Missing: what `GetHoles(1)` counts as a hole (MeshHelper).

### `fr_Freeze` (SPEC)
No args; no return value.
1. Get head with name `Freeze Transform`; none → stop.
2. Every child of the mesh is re-parented to the scene root; the mesh's parent is remembered and the mesh moved under
   the scene root.
3. `SetNeutralPose(mesh, siSRT, true)`, then `ResetTransform(mesh, siCtr, siSRT, siXYZ)`.
4. Mesh moved back under its old parent, then the children back under the mesh.
5. `fr_Diagnose` (refreshes the diagnose box).

### `fr_Holes` (SPEC)
No args; no return value.
1. Container = `fr_CleanMeshModel()` (created when missing). Get head with name `Inspect Holes`; none → stop.
2. Helper = `fr_GetPolymesh(mesh)`; if it carries no `Diagnose` text, `fr_Diagnose` runs. No hole edges → stop.
3. Property `fr_InspectHoles` on the container (added only when missing); `InspectObj(prop, , , siLock)`.

`fr_InspectHoles` property: one parameter `Holes` (siInt4). Layout rebuilt on open (get head `Inspect Holes`,
`GetHoles()`; nothing when no holes): group `Holes` holding a combo on `Holes` whose items are
`<mesh name> has <n> holes` = 0, then `Hole_1` = 1 … `Hole_n` = n. Changing it: 0 selects the mesh, k selects the
edges of hole k−1 (and remembers k−1). Handlers for `CapHole` / `CapAllHoles` buttons exist but the buttons are not
in the layout, so they are unreachable.

### `fr_PickEyeProximity` (SPEC)
No args; no return value. All messages go to the diagnose box.
1. Get head with name `PickEyeProximity`; none → stop. Helper = `fr_GetPolymesh(mesh)`, rebuilt with flag 1 when it
   has no hole edges.
2. Transform check fails → `<mesh> has active tranforms. Freeze before running picking sockets.` (sic), stop.
3. Eye holes already stored → message `Picking new eyeholes will clear previous selection.<br/>Right click to cancel<br/>`.
4. Pick loop with no limit.
5. No picks → `No Eye Holes Picked` (stored eye holes kept).
6. Picks: stored list cleared, `GetHoles()`, selection cleared. More picks than holes →
   `Number of picks (<p>) is greater than number of holes (<h>)`, stop (list left empty). Else each pick → nearest
   hole index (`GetClosestHole`), unique; each hole's edges added to the selection; message
   `Adding Eye Holes: ` then ` <index>` per hole, then `<br/><li>Ready to Add (<n>) Eye Sockets`.

### `fr_PickMouthProximity` (SPEC)
As `fr_PickEyeProximity` with these differences: name `PickMouthProximity`; the helper is rebuilt only when it has
no hole data at all; warning `Picking new mouth holes will clear previous selection.<br/>Right click to cancel.<br/>`;
the pick loop stops after **one** pick; no picks-versus-holes check; after `GetHoles()` a second `GetHoles(1)` runs
when the hole object has no `length` (inferred: always); every picked hole is also `ReorderHole`d; messages
`No Mouth Holes Picked` and `Adding Mouth Holes: <space><index>…<br/><li>Ready to Add (<n>) Mouth Interior`.

### `fr_AddMouthInterior` (SPEC)
No args; no return value.
1. Container = `fr_CleanMeshModel()`. Get head with name `Add Mouth Interior`; none → stop. Helper `GetHoles()`.
2. No stored mouth holes → diagnose message `Pick Mouth Proximity First ` (trailing space), stop.
3. Per mouth hole: `ReorderHole`, then build (below). Finally `fr_Diagnose`.

Build per hole (w = the hole's major-axis length):
- New property `fr_MouthInteriorProperty` on the container (always added); `Depth` = 2w, `Height` = w.
- Quadrant spans: from the hole's four quadrant indices q0..q3 and point count N: [q1, q2−q1, q3−q2, N−q3].
- Four guide NURBS curves under the container, each with a local `Display Property` wire colour 22, degree 3, open,
  knots 0,0,0,1,2,3,4,5,5,5, parameterization 1, NURBS format 0, 8 control points (weight 1) scaled per axis then
  offset (no transform set). Base point v = hole centroid with z of quadrant point 0; attenuation
  a = 2w − (z of quadrant point 1 − v.z).

| Curve | shape | scale (x, y, z) | offset |
|---|---|---|---|
| `mGuideRight` | side | (−w, w, a) | v |
| `mGuideBottom` | bottom | (w, w, 2w) | quadrant point 1 |
| `mGuideLeft` | side | (w, w, a) | v with z of quadrant point 2 |
| `mGuideTop` | top | (w, w, 2w) | quadrant point 3 |

| Shape | control points (x, y, z) |
|---|---|
| side | (0.5,0,0) (0.736,−0.001,−0.101) (0.838,−0.001,−0.168) (1,−0.001,−0.271) (1,−0.001,−0.573) (1,−0.001,−0.754) (0.502,0.001,−0.957) (0.278,−0.483,−1.048) |
| bottom | (0,0,0) (0,−0.033,−0.087) (0,−0.194,−0.067) (0,−0.304,−0.098) (0,−0.304,−0.289) (0,−0.28,−0.573) (0,−0.245,−0.877) (0,−0.473,−0.94) |
| top | (0,0,0) (0,0.028,−0.099) (0,0.209,−0.095) (0,0.388,−0.201) (0,0.412,−0.573) (0,0.369,−0.998) (0,0.027,−1.118) (0,−0.493,−1.127) |

(A fourth builder, a 4-curve `MouthCurveGuide` list, exists but is never called.)
- Scripted operator `mouthInterior` (JScript, `AddScriptedOp`), output the mesh primitive; inputs in order: the
  helper's mesh primitive, the four curve primitives (R, B, L, T), the four curves' global kinematics, the property.
  The hole point indices and the four spans are baked into the operator code.
- Then `InspectObj` on the property.

Operator update (S = `Sections`):
1. Rows of new points k = 1 … S+1, each at curve percentage min(100, k·100/S), every curve point mapped to world by
   its curve's global transform. Rows S and S+1 therefore both sit at 100 %.
2. Hole point i falls in quadrant Q (spans consumed in order); t = position within the span / span length, reversed
   (1 − t) in quadrants 1 and 3. Corner pair (A, B): Q0 (right, bottom), Q1 (left, bottom), Q2 (left, top), Q3 (right, top).
   New point = A + t·(B−A) for x and z; for y the blend factor is the `MouthUpperCross` fcurve evaluated at t/2
   (sampled once, on the first row).
3. Polygons: quads between consecutive rows 0…S (row 0 = the hole), each (prev j, prev j+1, this j+1, this j), wrapping;
   one cap n-gon over row S. Row S+1's points are added but used by no polygon (orphans).
4. `Depth`, `Height`, `Uvula`, `Tongue` are not read by the operator.

`fr_MouthInteriorProperty`:

| Parameter | type | default | range (UI) | note |
|---|---|---|---|---|
| `Depth` | siDouble | 1 | 0.1–1000 (0.1–10) | not inspectable |
| `Height` | siDouble | 1 | 0.1–1000 (0.1–10) | not inspectable |
| `Sections` | siInt4 | 16 | 8–1000 (8–100) | animatable |
| `Uvula` | siBool | true | | not inspectable |
| `Tongue` | siBool | true | | not inspectable |
| `MouthUpperCross` | fcurve | keys (0,0) (0.2,1) (0.5,0.8) (0.7,1) | | tangents (left dx,dy / right dx,dy): (0,0 / 0.01,0.4), (−0.1,0 / 0.1,0), (−0.1,0 / 0.1,0), (−0.1,0 / 0.2,0) |

Layout: an untitled group with Depth, Height, Sections, Uvula, Tongue; group `Cross Section` with an fcurve control on
`MouthUpperCross` (height 140, view Y −0.1…1.1, X −0.2…1.1, no X ruler).

### `fr_AddEyeSocket` (SPEC)
No args; no return value.
1. Container = `fr_CleanMeshModel()`. Get head with name `Add Eye Sockets`; none → stop. Helper `GetHoles()`.
2. No stored eye holes → diagnose message `Pick Eye Proximity First `, stop.
3. Per eye hole (order of the stored list): `ReorderHole`, then build a socket (below); the first socket's property is
   the **lead**. Each socket record is appended to a plug-in-global collection (it is not reset here, so repeated runs
   in one session accumulate (inferred)).
4. `fr_Diagnose`; the collection is stored on `fr_GetFRPolymesh()` as `EyeSockets`; selection = the mesh.

Socket build:
- Inner / outer corner: of the hole's furthest point and its opposite point, the one with the smaller |x| is inner.
  rad = 0.75 × |inner − outer|. Lacrimal end: the major-axis end with the smaller |x| (its mesh point index and its
  position in the hole are baked into the operator).
- Null `EyeCentroid` at the hole centroid under the container: same as `fr_AddObjectInPlace("Null", 0, container, 1,
  centroid, "EyeCentroid", 100)`.
- CustomProperty `eyeSocket` on the container (n = hole point count):

| Parameter | type | default | range | capabilities |
|---|---|---|---|---|
| `CapEyeSocket` | siBool | true | | animatable |
| `Precision` | siInt2 | 8 | 4–20 | not inspectable |
| `InvertPolys` | siBool | true | | animatable |
| `LacrimalGland` | siInt2 | 0 | 0…n/2−1 (UI 0…n/2) | animatable |
| `ShiftLacrimal` | siInt2 | 0 | −n/2…n/2 | animatable |
| `Edge` | siDouble | 0 | 0–1 | animatable |
| `Radius` | siDouble | rad | 0…10·rad | animatable |
| `RadialDensity` | siDouble | 1 | 0.1–2 | animatable |
| `CenterDiflection` | siDouble | 0.5 | 0–1 | animatable |
| `lastOldPoint` | siInt4 | mesh point count before the socket | 0–1e7 | not inspectable |
| `lastNewPoint` | siInt4 | 0 | 0–1e7 | not inspectable |
| `centerX`, `centerY`, `centerZ` | siDouble | 0 | ±1e7 | not inspectable |
| `rad` | siDouble | 0 | 0–1e7 | not inspectable |

- With a lead: every parameter of the lead that is animatable gets an expression on the same-index parameter here
  equal to the lead parameter's full name (errors ignored), so the second socket follows the first. Without a lead
  (first socket): `InspectObj(prop, , , siLock)`.
- Vertex cluster `EyeEdge` on the mesh with the hole's point indices.
- Scripted operator `eyeSocket` (JScript) on the mesh primitive; inputs: mesh primitive, the property, `EyeCentroid`
  global kinematics.

Operator update:
1. c = `EyeCentroid` global position; inner/outer from the input points; mid = their midpoint. X axis = inner − outer,
   flipped when inner.x > outer.x, normalised; Zp = X × (0,1,0) normalised; Z = lerp(Zp, (0,0,−1), `CenterDiflection`);
   centre C = mid + `Radius`·Z; median = mid − C; r = |outer − C|; yaw = angle(Z, (0,0,−1)), negated when outer.x < 0
   (rotation about Y).
2. Only when `CapEyeSocket` is on:
   - `LacrimalGland` L > 0: takes 2L+1 consecutive hole points centred at lacrimal position − L + `ShiftLacrimal`
     (wrapping); builds L rows of linearly interpolated points between symmetric pairs (row r has 2r−1 new points)
     and weaves them into triangles at the row ends and quads between (winding reversed by `InvertPolys`); the last
     row's new points replace the matching hole entries for the socket.
   - `Edge` e > 0: C.z −= r·e and a row copying the (modified) hole points shifted by −r·e in z is added first.
   - Per hole point a planar direction from c to the point (z ignored), y scaled by the null's `scly` and
     `RadialDensity`, x by `sclx`, normalised.
   - `Precision` P − 1 rings: ring k uses angle −α − (π − α)·k/P where α is each point's angle between (point − C) and
     median, at distance r, rotated by the yaw and offset by C; then a single apex point.
   - Quads between consecutive rings, then a triangle fan to the apex, windings chosen by `InvertPolys`.
3. Writes `lastNewPoint` (apex index), `centerX/Y/Z` = C, `rad` = r into the property, then sets the geometry.
   (inferred) with `CapEyeSocket` off nothing is added and `lastNewPoint` gets an empty value.

### `fr_AddEyeBalls` (SPEC)
No args; no return value.
1. Get head with name `fr_AddEyeBalls`; none → stop.
2. Every `eyeSocket` operator in the mesh's construction history: its second input (the `eyeSocket` property) and
   centre (`centerX/Y/Z`). The plug-in-global socket collection is replaced by these. None → diagnose message
   `Build EyeSockets first, \n if EyeSockets exist import Eyeballs from Library` (with a real line break), stop.
3. Face model = `fr_sget("FaceModel")` (the mesh when empty). New `EyeballProperties` property **on the mesh**.
4. Per socket (C = centre, R = its `rad`):
   - Vertex cluster `EyeSocket` on the mesh, points `lastOldPoint` … `lastNewPoint` inclusive.
   - Eye null: same as `fr_AddObjectInPlace("Null", 0, fr_sget("Actor"), R/10, C, name, 0)` with name `LEye` when
     C.x > 0, else `Eye`.
   - Cornea = same as `fr_MakeEyeBall(<eye null>, 0.8·R, C, EyeballProperties)`; iris = its first child.
   - Face model `FaceConnections` parameter `REye` when C.x > 0 else `LEye` = cornea full name (note: the null is named
     `LEye` on the side that is connected as `REye`).
   - `ApplyOp("ShrinkWrap", "<EyeSocket cluster>;<cornea>;", 3, siPersistentOperation)`; its `proj` = 6.
5. Select the eye nulls; `InspectObj` the `EyeballProperties`; `fr_Diagnose`.

## 4. Shared helpers (GameExport_EyelidTools.js)

| Helper | Behaviour |
|---|---|
| face parts (export mesh) | Face = `fr_sget("meshes","Mesh")`. Game property = same as `GameExport(null, true)` (no inspect). Clamp step = [0.1, 0.2, 0.5, 1, 2, 5, 10][`OptimizeWeights`]; clip count = `Weights_Per_Bone`. Game face = the argument when it is an object of type `polymsh`, else `fr_GetGameFaceFromProperty(game property)`; none → log siError `Could Not find game face, please pick game face in game export and run command again`, `GameExport()` (opens its UI), fail. Envelope operators = construction-history operators named `Envelope Operator`; count ≠ 1 → siError `Incorrect number of Envelope Operators were found! [<n>] , this function is a postprocess command, first apply Game Export...`, `GameExport()`, fail. |
| envelope arrays | The flat envelope weight array is split per point into one value per deformer, and flattened back. |
| neighbours | Per vertex, the indices of its 1-ring neighbour vertices. |
| clip weights (clip, step) | Per point: deformers sorted by weight descending (equal weights: higher deformer index first); the top `clip` renormalised to sum 100, the rest set 0. Then each non-zero weight is rounded to a multiple of step = max(step, 0.1) (remainder > step/2 rounds up, else down) and the largest weight absorbs 100 − sum. |
| mapping template | For every point of mesh A (its local position array) the closest location on the smoothed surface of mesh B (point locator, B's global transform): triangle vertex indices and barycentric weights. |
| stack mute | Sets the `mute` parameter of every construction-history operator that has one (true, later false: the later value is false even for operators that were muted before). |
| eyelash deformers (obj) | Every object under the object's model (recursive) with a `FaceElement` property whose `ID` exists and whose `Type` is `EyelashDeformer`; one per distinct ID. |

## 5. Wire contracts, GameExport_EyelidTools.js

### `fr_GetGameSmoothMap` (SPEC)
Args: `ExportMesh`, `HandleExisting` (0 = reuse existing map, 1 = ask, 2 = rebuild without asking; empty → 0).
Return: the internal record object (JScript object: face, game face, game model, envelope, `Cls`, `Map`,
`GameWeightArray`, …) or null.
1. Progress bar `Getting Smooth Map`, maximum 4, cancel enabled; a cancel seen at any checkpoint hides it and returns null.
2. Face parts; failure → null.
3. Cluster `GameEnvelopeSmooth` on the game face; when it has a property `GameEnvelopeSmooth`:
   0 → weights read from it, return. 1 → `MsgBox("Map <<<map fullname>>> Exists,\nDo you want to Overwrite File?",
   Yes/No with No default, "Game Export Smooth Map")`; No → return the record (without weights). Otherwise the
   cluster is deleted.
4. Face weights: (a) clusters of the face whose name contains `Eyelid` and that carry an `EdgeMap` property; per face
   point the largest EdgeMap value (0 elsewhere); each value v becomes 1 − 2|v − 0.5| (0 and 1 → 0, 0.5 → 1).
   (b) Mouth ring: clusters `MouthRegion` and `MouthLipRegion` are required (missing → siError `Mouth Clusters not
   found ...`, then (inferred) a script error). Each is shrunk by repeatedly removing its border points (points with a
   neighbour outside the set) until at most 90 % (mouth) / 20 % (lips) of its points remain (100 passes at most, then
   log `Point Set run amok`); ring = shrunk mouth minus shrunk lips. Each ring point's value = its ring-step distance to
   the ring's border (border points 1) divided by the largest. (c) Per point the larger of (a) and (b).
5. Both stacks muted; game weights = per game point the barycentric blend of the face weights at its closest face
   triangle (mapping template game → face); stacks unmuted.
6. New vertex cluster `GameEnvelopeSmooth` on the game face with all points, `Weight Map Property`
   `GameEnvelopeSmooth` on it, elements = the game weights. Return the record.

### `fr_ApplyGameSmoothFromMap` (SPEC)
Args: `ExportMesh`, `HandleExisting` (declared but **ignored**). Return: the record or null.
1. As `fr_GetGameSmoothMap(ExportMesh, 0)` (existing map reused, else built). Null → return null.
2. Smoothing with strength 0.6 and 5 iterations: first `Envelope Operator` of the game face (none → log
   `No Envelope Found to Smooth`, info). Progress bar `Applying Smooth Map`, maximum 10, captions in order
   `Gathering Envelope Data` (twice), `Collecting Neighbor information`, `Smoothing Envelopes`,
   `Clipping Deformer Count and Optimizing Weights`, `Applying New Weights`, `Cleaning Up`; cancel stops (weights not
   written).
3. Each iteration, for point i with map value m and n neighbours: a = 0.6·m; new weights = (1 − a)·own + (a/n)·Σ
   neighbour weights (per deformer).
4. Clip weights with the game property's clip count and clamp step; written back to the envelope.
5. Returns the record (also when step 2 stopped early).

### `ClipDeformers` (SPEC)
Args: `Object`, `ClipDeformerCount` (empty/0 → 3), `ClampDeformerStep`. Return: true, or null.
1. First `Envelope Operator` on `Object`; none → log `No Envelope Found to Smooth` (info), return null.
2. Progress bar `Clipping Deformers`, maximum 5, captions `Gathering Envelope Data` (twice), `Clipping Deformer Count
   and Optimizing Weights`, `Applying New Weights`, `Cleaning Up`; cancel → null.
3. Clip weights (count, step); written back; `FreezeObj` on the envelope's nested objects. Return true.
Error cases (inferred): `ClampDeformerStep` empty leaves the step undefined, so every weight becomes NaN; a count
larger than the deformer count or a point with all-zero top weights also gives NaN. `Object` must be an object.

### `fr_CopyEyelashes` (SPEC)
Args: `Face`, `GameFace`. Return: always true. Errors are siError logs and stop the work.
1. Face = argument or `fr_sget("meshes","Mesh")`; none → `No Face Robot Face found`.
2. Game face = argument or `fr_GetGameFaceFromProperty(GameExport(null, true))`; none → `No GameFace found` and
   `GameExport()`.
3. Game face already has eyelashes (`fr_GetEyelashes`) → `Game Face Already has eyelashes!, Delete first, then
   attempt to copy again`. Face has none → `No eyelash meshes found.`. No eyelash deformers on the face's model →
   `No eyelash mehses found.` (sic).
4. Group `Eyelashes` on the game face's model (created when missing, `viewvis` 2).
5. Per eyelash mesh: `Duplicate` (1 copy, current history, other options default, selection unchanged), parented
   under the game face, renamed to the source's name, added to the group.
6. Per eyelash deformer: duplicated the same way under the game face and renamed; its constraints deleted.

### `fr_TransferEyelashEnvelope` (SPEC)
Args: `FR_HeadNull`, `GameFace`, `Envelope`, `Animation` (booleans for the last two). Return: always true.
1. Lashes = `fr_GetEyelashes(GameFace)`; none → nothing happens. Per lash its cluster `LashAttachCluster` (missing →
   siError `Cluster <"LashAttachCluster"> not found for mesh, <lash fullname>, check validity`, skipped).
2. Game deformers (under GameFace's model) and FR deformers (under FR_HeadNull's model). Count checks (siError, stop):
   `(<g>) Game Eyelash Deformers to drive (<l>) Eyelashes ` and `(<f>) Face Eyelash Deformers to drive (<g>) Game
   Eyelash Deformers `.
3. Game deformer i gets a `Pose` constraint to FR deformer i.
4. `Envelope`: game face envelope required (none → siError `No Game Envelope found, Generate game envelope before
   Transfering Eyelashes`, stop; animation is skipped too). `fr_ResetRetarget(true)`; game envelope `mute` = true.
   Per lash: deformer list starts with game deformer i; mapping template lash → game face; points outside the attach
   cluster get 100 on that deformer; points inside get, for each of the 3 triangle vertices, every game deformer
   whose weight there is ≥ 0.1, times the barycentric weight (deformers appended to the list as met, identity by
   `IsEqualTo`); rows padded with 0. The lash's existing envelope is deleted; `ResetActor` on the FR deformers and on
   the new list; `ApplyEnvelope(list, siNode, siNode)`; weights set; then `ClipDeformers(lash, Weights_Per_Bone,
   clamp step)` (game property re-read each lash). Then game envelope `mute` = false and `fr_ResetRetarget(false)`,
   **inside the per-lash loop** (so lashes after the first are computed with the envelope live). After the loop
   `SetPropertyDisplay(null, ["attrselpointsweight"], [false])`.
5. `Animation`: project `Play Control` in/out; parameters `posx posy posz rotx roty rotz` of every game deformer;
   `PlotAndApplyAction(game model, params, "plot", in, out, 1, 20, 1, false, 0.01, true, true, false, true)`; then
   the deformers' constraints are deleted. Without `Animation` the Pose constraints stay.

### `UndoGameSmooth` (SPEC)
Marked "DEPRECATE" at registration. Arg `ExportMesh`. No value returned.
Face parts (failure → (inferred) script error on the missing record). The **last** property of the game face whose
name contains `TEMPORARY_Envelope`; none → siError `No More Envelopes Stored...`. Else the first envelope's weights
= the property's text split at `,`, and the property is deleted. Nothing in either file stores such a property any
more (the store call is commented out), so in practice it only logs the error.

## 6. Open questions
- MeshHelper.js polymesh object: hole detection (`GetHoles(0/1)`), `GetClosestHole`, `ReorderHole` and every hole
  field listed in §1, which decide geometry and messages of the six SPEC-PARTIAL commands.
- `FaceRobot` third argument `id` = "15" (B14d documents `cmd`/`arg` only for stage dispatch).
- `GameExport`, `fr_GetGameFaceFromProperty`, `SetPropertyDisplay`, `fr_GetEyelashes`, `fr_ResetRetarget` contracts.
- `ShrinkWrap` `proj` = 6 meaning; `ApplyOp` connect type 3.
- Whether the scripted operators may write back into their input property (eyeSocket writes `lastNewPoint`, centre, `rad`).

## 7. Corrections for the wire agent
- `src/commands/faceRobotModule.ts` registers `fr_CleanMeshModel` with argument `Mode` default 1; the real argument
  is `Del` with no default. Called truthy it freezes every Face Robot mesh and deletes `fr_MeshClean`; falsy it
  creates/returns that model. `src/ui/faceRobotStage1.ts` passes `{ Mode: 1 }`: rename to `Del`.
- The same file's prep shells say "FR.dll body LOCK": the bodies are JScript in PreparationTools.js and are now
  contracted here. `fr_Diagnose` returns a bool and sets `FaceState.Valid` / `Message`; the shell returns null.
- The `frHostShells` list registers `fr_GetGameSmoothMap`, `fr_ApplyGameSmoothFromMap` (ExportMesh, HandleExisting),
  `fr_CopyEyelashes` (Face, GameFace), `fr_TransferEyelashEnvelope` (FR_HeadNull, GameFace, Envelope, Animation),
  `ClipDeformers` (Object, ClipDeformerCount, ClampDeformerStep), `UndoGameSmooth` (ExportMesh) with **no
  arguments**; the arities above are the real ones. The zero-argument prep commands (`fr_AddEyeBalls`,
  `fr_AddEyeSocket`, `fr_AddMouthInterior`, `fr_PickEyeProximity`, `fr_PickMouthProximity`) are right.
- `fr_ApplyGameSmoothFromMap` ignores `HandleExisting`; `fr_CopyEyelashes` and `fr_TransferEyelashEnvelope` return
  true even on failure.
