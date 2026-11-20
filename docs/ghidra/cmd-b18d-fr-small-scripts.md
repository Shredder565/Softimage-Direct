# CMD-B18d: small Face Robot / plug-in script commands (`MeshHelper.js` hole object, `Utilities.js` keywords, `AdjustPanelKeys.js`, `ParseOpenDNA.js`, `ModifyFaceLayout.js`, `PlotToShapes.js`, `InitNeck.js`, `InitNose.js`, `FaceRobotShapeGoals.js`, `AddBlinkKeys.js`, `PaintGameExportPlugin.js`, `StabilizeC3D.js`, `AnimationRigImport.js`, `StereoCamera.js`)

Row: **CMD-B18d**. Status: **SPEC** for 26 commands, **SPEC-PARTIAL** for 4 (`PlotFaceRobot`, `StoreShapeGoal`,
`fr_ImportAnimationRig`, `GetPrimStereoCamera`), **LOCK** for 0.
Run: 2026-11-20, si-analyst worker, unattended, batch 18
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (JScript plug-ins, handler `<name>_Execute`, every argument flag 2 = siArgumentInput). Sources were read
off the user's PC through REA raw `read_bytes` (whole file each time; all 14 files are under 64 KB).

| File (install-relative) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `FaceRobot\Application\Plugins\MeshHelper.js` | 26436 | `529e8340` | whole | 3 |
| `FaceRobot\Application\Plugins\Utilities.js` | 11363 | `f147882b` | whole | 7 |
| `FaceRobot\Application\Plugins\AdjustPanelKeys.js` | 2545 | `275a480a` | whole | 3 |
| `FaceRobot\Application\Plugins\ParseOpenDNA.js` | 10922 | `c0e14541` | whole | 3 |
| `FaceRobot\Application\Plugins\ModifyFaceLayout.js` | 1902 | `7d177d23` | whole | 2 |
| `FaceRobot\Application\Plugins\PlotToShapes.js` | 15603 | `e04f0cbd` | whole | 2 |
| `FaceRobot\Application\Plugins\InitNeck.js` | 16048 | `5fe5105b` | whole | 1 |
| `FaceRobot\Application\Plugins\InitNose.js` | 9001 | `10c627f6` | whole | 1 |
| `FaceRobot\Application\Plugins\FaceRobotShapeGoals.js` | 18845 | `3fa01a09` | whole | 1 (+1 property) |
| `FaceRobot\Application\Plugins\AddBlinkKeys.js` | 19920 | `fb23ddd8` | whole | 1 |
| `FaceRobot\Application\Plugins\PaintGameExportPlugin.js` | 16323 | `83eeeccd` | whole | 1 |
| `FaceRobot\Application\Plugins\StabilizeC3D.js` | 9147 | `c312b713` | whole | 1 |
| `Application\Plugins\AnimationRigImport.js` | 19179 | `d371335c` | whole | 3 (+1 property, 1 menu) |
| `Addons\StereoCamera\Application\Plugins\StereoCamera.js` | 15714 | `b0175237` | whole | 1 (+1 property, 2 operators, 1 menu) |

Not read (> 64 KB, as instructed): `Game_Export.js`, `MakeEyelashes.js`, `AnimationRigExport.js`.

Every `RegisterCommand` in the 14 files has a matching entry in `data/commands_full.json`; **no extra command**.
Registered non-commands: property `ShapeGoals` (FaceRobotShapeGoals.js; its menu `FR_ShapeGoals` registration is
commented out), property `ImportAnimationRig` and menu `ImportAnimationRig_Menu` (AnimationRigImport.js), property
`Stereo`, operators `StereoLeftConstraint` / `StereoRightConstraint` and menu `StereoCameraMenu` (StereoCamera.js).

Plug-in names / authors: `MeshHelper`, `AdjustPanelKeys`, `ModifyFaceLayout`, `PlotToShapes`, `InitNeck` (1.1),
`InitNose`, `AddBlinkKeys` (1.1), `StabilizeC3D` (Major assigned 1 then 0) are "Softimage Special Projects" (c) 2006
Avid; `Utilities` "Autodesk" (c) 2008-2009; `ParseOpenDNA` "Softimage"; `FaceRobotShapeGoals` "javier" (c) 2008;
`PaintGameExportPlugin` "misner"; `ImportAnimationRig` "Softimage" (Crosswalk team, (c) 2008 Autodesk);
`StereoCamera` "Autodesk Ltd" (c) 2010.

File-level side effect (all FR files except StereoCamera.js): `Array.prototype.push` is replaced by a version that
appends its arguments only **up to the first null/undefined one** and returns the array (same as B18a). It matters in
MeshHelper (an undefined axis index is silently not stored, §2.3).

Earlier contracts reused ("same as …"): `cmd-b14a-fr-utilities-storage.md` (`fr_sget`, `fr_sset`, `fr_GetFaceModel`,
`fr_AddObjectInPlace`, `fr_AddToGroup`, `fr_GlueMeshGlobal`, `fr_FileRead`, `fr_FileDelete`,
`fr_Callstack_IsDebugMode`), `cmd-b14d-fr-retarget-mocap.md` (`fr_GetCurrentStage`, `fr_SwitchFaceLayout`,
`fr_LoadC3D`, `fr_CreateFaceMap`, `fr_C3DToFaceRobot`, `fr_WriteC3D`, `fr_FlushRetargetedFace`),
`cmd-b18a-fr-generalhelper-scripts.md` (`fr_ResetAll`, `fr_GetGlobalPos`, `fr_IsCollection`, `fr_ToCollection`),
`cmd-b13e-small-plugins-binary.md` (`fr_ApplyShapeWeightOp`, `FR_Import_Animation_Rig_To_ICE`),
`cmd-b17e-animation-action-scripts.md` (`DeleteUnusedMixerTracks`, LOCK), `cmd-b18b-fr-preparation-eyelid-scripts.md`
(the callers of the MeshHelper object).

Store shorthand as in B18a: `fr_sget(k)` = store (`_`, k); `fr_sget(s, k)` = store (s, k). `LogMessage` without
severity = siInfo.

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `fr_GetPolymesh` | MeshHelper.js | `fr_GetPolymesh_Execute` | SPEC |
| `fr_GetFRPolymesh` | MeshHelper.js | `fr_GetFRPolymesh_Execute` | SPEC |
| `fr_CapAllHoles` | MeshHelper.js | `fr_CapAllHoles_Execute` | SPEC |
| `fr_GetKeyed_safe` | Utilities.js | `fr_GetKeyed_safe_Execute` | SPEC |
| `AddUserKeyword` | Utilities.js | `AddUserKeyword_Execute` | SPEC |
| `GetKeyed` | Utilities.js | `GetKeyed_Execute` | SPEC |
| `GetKeyed2` | Utilities.js | `GetKeyed2_Execute` | SPEC |
| `FilterKeyed` | Utilities.js | `FilterKeyed_Execute` | SPEC |
| `SetControlKeys` | Utilities.js | `SetControlKeys_Execute` | SPEC |
| `MirrorControls` | Utilities.js | `MirrorControls_Execute` | SPEC |
| `fr_SaveAdjustPanelKeys` | AdjustPanelKeys.js | `fr_SaveAdjustPanelKeys_Execute` | SPEC |
| `fr_PrintAdjustPanelKeys` | AdjustPanelKeys.js | `fr_PrintAdjustPanelKeys_Execute` | SPEC |
| `fr_RestoreAdjustPanelKeys` | AdjustPanelKeys.js | `fr_RestoreAdjustPanelKeys_Execute` | SPEC |
| `ParseDNAFile` | ParseOpenDNA.js | `ParseDNAFile_Execute` | SPEC |
| `GetDNAFile` | ParseOpenDNA.js | `GetDNAFile_Execute` | SPEC |
| `LogDNA` | ParseOpenDNA.js | `LogDNA_Execute` | SPEC |
| `fr_ToggleFaceLayout` | ModifyFaceLayout.js | `fr_ToggleFaceLayout_Execute` | SPEC |
| `fr_SetAltLayout` | ModifyFaceLayout.js | `fr_SetAltLayout_Execute` | SPEC |
| `PlotGlobal` | PlotToShapes.js | `PlotGlobal_Execute` | SPEC |
| `PlotFaceRobot` | PlotToShapes.js | `PlotFaceRobot_Execute` | SPEC-PARTIAL |
| `fr_InitNeck` | InitNeck.js | `fr_InitNeck_Execute` | SPEC |
| `fr_InitNose` | InitNose.js | `fr_InitNose_Execute` | SPEC |
| `StoreShapeGoal` | FaceRobotShapeGoals.js | `StoreShapeGoal_Execute` | SPEC-PARTIAL |
| `fr_AddBlinkKeys` | AddBlinkKeys.js | `fr_AddBlinkKeys_Execute` | SPEC |
| `PaintGameExport` | PaintGameExportPlugin.js | `PaintGameExport_Execute` | SPEC |
| `fr_StabilizeC3D` | StabilizeC3D.js | `fr_StabilizeC3D_Execute` | SPEC |
| `ImportAnimationRig` | AnimationRigImport.js | `ImportAnimationRig_Execute` | SPEC |
| `fr_ImportAnimationRig` | AnimationRigImport.js | `fr_ImportAnimationRig_Execute` | SPEC-PARTIAL |
| `fr_BuildEyesConstraint` | AnimationRigImport.js | `fr_BuildEyesConstraint_Execute` | SPEC |
| `GetPrimStereoCamera` | StereoCamera.js | `GetPrimStereoCamera_Execute` | SPEC-PARTIAL |

## 2. MeshHelper.js: the polymesh helper object and its commands

### 2.1 Plug-in state
One plug-in-global variable, here called **the cached helper**, starts as an empty object. It survives between command
calls for the life of the plug-in's script engine (inferred: until the plug-in is reloaded) and is what every Face Robot
preparation command (B18b) works with.

### `fr_GetPolymesh` (SPEC)
Args `iprimitive`, `inOverride`, `ivertices`, `iPolygonData` (no defaults; the last two are never used except in the
"all empty" test). Return value on: the helper object (a JScript object, not a Softimage object), or false.
1. When `iprimitive`, `ivertices` and `iPolygonData` are all empty: the object is `Selection(0)`; a polygon, point or
   edge sub-component selection is replaced by its parent 3D object. Missing or not of type `polymsh` → log (siError)
   `no polymesh found, try again ` (trailing space), return false.
2. When the cached helper has no `ActivePrimitive` yet, or `inOverride` is truthy: a **new** helper is built from the
   object's active primitive (despite the argument name, callers pass the X3DObject) and becomes the cached helper.
3. Otherwise the cached helper is returned **unchanged, even when it was built for another mesh** (no mesh identity
   check). Returns the cached helper.

### `fr_GetFRPolymesh` (SPEC)
No args (the `_Init` adds none and does not set a return flag; registry: return value on). Returns the cached helper as
is (possibly the empty start object). B18b stores `EyeSockets` on it.

### `fr_CapAllHoles` (SPEC)
Args `inMesh`, `Freeze` (`Freeze` is ignored). Return value off.
1. Helper = `fr_GetPolymesh(inMesh, 1)` (always rebuilt; an empty `inMesh` means the selection rule of step 1 above).
   False → stop.
2. Runs the helper's cap-all method (§2.4): freezes the mesh, fills every hole with polygons and writes the geometry.

### 2.2 Helper construction (fields set at once)

| Field | Value |
|---|---|
| `ActivePrimitive` | the primitive passed in |
| `Object` | its parent X3DObject |
| `Transform` | the object's global transform at build time |
| `Vertices` | flat local point positions from the geometry's `Get2` (x, y, z per point) |
| `PolygonData` | the polygon description array from `Get2` (count, then indices, per polygon) |
| `Edges`, `Points` | the geometry's live `Edges` and `Points` collections |

Methods: `GetPolydata`/`Local` (re-read `Vertices`, `PolygonData`, `Edges`, `Points`; logs
`No existing object. ActivePrimitive has been passed.` when there is no primitive), `Global` (§2.6), `GetHoles`,
`GetClosestHole`, `ReorderHole`, `ReorderHoles`, `CapHoles`, `CapHole`, `CapHoleData`, `ExtractHoles`, `capeyehole`
(unused stub), `GetLoops` (does nothing beyond re-reading data), `Set`, `Help`.

### 2.3 `GetHoles(inOverride)`: hole detection
1. Re-reads data when `Vertices` is missing.
2. **Cache rule**: when the cached helper already holds a hole record with `Edges` and `Points` and `inOverride` is
   falsy, this helper's `Holes` is set to **that same record object** (shared, not copied) and nothing is recomputed.
   `GetHoles(1)` always recomputes.
3. Open edges: every edge with fewer than 2 neighbour polygons, collected in increasing edge index order.
4. Separation into holes (repeated while open edges remain): take the first remaining open edge; then repeatedly look
   at that edge's neighbour edges in their collection order and move to the first one that is still an open edge,
   removing each visited edge; stop when no neighbour edge is still open. The visited edges, in walk order, form one
   hole. More than 99 iterations → log (siError) `Too many Holes.` and the method returns **before** the point stage
   (the record then has 100 edge lists and empty point lists).
5. Per hole (index h), from its edges in walk order: for each edge, the first of its two vertices not seen yet in this
   hole is appended (at most one point per edge). Centroid = mean of those points' **local** positions.
6. Major axis: the furthest point from the centroid (strictly greater distance wins, so the first maximum) and then the
   point furthest from that one (the "opposite" point). Their positions **inside the hole's point list** form
   `MajorAxisIndices[h]` = [furthest, opposite]; the mesh `Point` objects go to `FurthestPoints[h]` /
   `OppositePoints[h]`. When every point sits on the centroid the position stays undefined and (because of the push
   override) is not stored.
7. Midpoint = halfway between furthest and opposite. Major vector X = from the larger-x end to the smaller-x end
   (always points toward −x), its length is `MajorAxisLength[h]`; X is normalised. Depth Z = normalise(X × (0,1,0)),
   which is (0,0,−1) for a hole lying across x.
8. Minor axis (`MinorAxisIndices[h]`, two hole positions): with exactly 4 points, the two neighbours of the furthest
   point (next, previous; wrapping). Otherwise two searches: first along the arc from the opposite point to the furthest
   point, then from the furthest to the opposite (positions wrap past the end); each looks at positions start+1 up to
   **end−2** (the point just before the end is never tested; inferred off-by-one) and keeps the point closest to the
   plane through the midpoint with normal X (first minimum wins). An empty search range keeps the previous search's
   result (or nothing for the first one).
9. Helper-level leftovers: `xScale` = last hole's major length, `yScale` = the last plane distance found.

Hole record fields (each an array indexed by hole; the record is also reachable through helper aliases `HolesEdges`,
`HolesPoints`, `HolesPointIndices`, `HolesEdgeIndices`, `HolesCentroids`, `HolesMidPoints`, `HolesDepthVectors`,
`HolesFurthestPoints`):

| Field | Content |
|---|---|
| `Edges[h]` | Edge objects in walk order |
| `EdgeIndices[h]` | always an **empty** array (the indices gathered during the walk are discarded) |
| `Points[h]` | Vertex objects in walk order (one per edge, see step 5) |
| `PointIndices[h]` | the mesh point indices of `Points[h]` |
| `Centroids[h]`, `MidPoints[h]` | Vector3, local space |
| `DepthVectors[h]` | Z of step 7 |
| `MajorAxisVectors[h]` (alias `MajorAxisIndicesVectors`) | X of step 7, normalised |
| `MajorAxisLength[h]` (alias `MajorAxisIndicesDepth`) | distance furthest–opposite |
| `FurthestPoints[h]`, `OppositePoints[h]` | mesh Point objects |
| `MajorAxisIndices[h]`, `MinorAxisIndices[h]` | two positions in `Points[h]` each |
| `QuadrantPoints`, `QuadrantIndices` | only after `ReorderHole` (§2.4) |

The record is a plain object, so it has **no `length`**: B18b's tests on `Holes.length` are always false/undefined, and
`ReorderHoles(true, …)` (which loops to `Holes.length`) does nothing.

### 2.4 `ReorderHole(Index, Direction)`, cap methods
`ReorderHole` (`Direction` ignored):
1. **Resets** `QuadrantPoints`, `QuadrantIndices` and `PointIndices` to new arrays sized to the hole count, so every
   **other** hole loses its `PointIndices` (and earlier quadrant data) each time one hole is reordered.
2. Quadrant points of hole `Index`: [0] = the major-axis end with the smaller x, [2] = the other end; when the hole has
   more than 3 points and both minor ends exist, [1] = the minor end with the smaller y, [3] = the other.
3. The hole's point, edge and point-index lists are rotated so that they start at quadrant point 0.
   `QuadrantIndices[Index]` = the rotated positions (ascending) whose original position was one of the four axis
   positions (a shared position is listed once).
4. Direction check, on the **original** first point: its first neighbour polygon's vertex loop gives the previous and
   next vertex around that polygon. Not found → log (siError) `Error reordering hole hole ` (sic, trailing space), no
   reversal. When the polygon's next vertex is the hole's second point, or its previous vertex is the hole's last point,
   the rotated lists **and** the quadrant-index list are reversed. Only the list order of `QuadrantIndices` is reversed,
   not its values (inferred bug: after a reversal the values still refer to the unreversed order).
5. `MajorAxisIndices` / `MinorAxisIndices` are **not** updated to the new order, so reordering the same hole twice
   rotates it again by the stale start position (inferred: B18b's PickMouthProximity followed by AddMouthInterior does
   exactly this on the shared record).

`CapHoleData(Index)`: appends polygons to `PolygonData` that zip the hole closed from both ends: with hole points
h0…h(n−1) and two cursors a (starting at h0) and b (starting at h(n−1)), for j = 1 while j < n/2 it adds the quad
(a, h[j], h[n−1−j], b) and moves a → h[j], b → h[n−1−j]; when n is odd the last step (j = n−1−j) is the triangle
(a, h[j], b). Examples: n = 3 → one triangle; n = 4 → one quad; n = 6 → two quads; n = 5 → quad + triangle.
`CapHole(Index)`: `FreezeObj(object)`, CapHoleData, Set, `SceneRefresh`.
`CapHoles()`: holes computed when missing; `FreezeObj(object)`; for every hole `ReorderHole(i)` then `CapHoleData(i)`;
then `Set` (geometry = `Vertices` + `PolygonData`, the vertex array read at build time) and `SceneRefresh`.
`Set(pData, vertices)`: `Geometry.Set(vertices, pData)` on the object's active primitive, defaults the helper arrays.

### 2.5 `GetClosestHole(inVector)`
Computes holes when the helper has none. A Vector3 input: returns the index of the hole whose **local** centroid is
nearest to it (first minimum wins). A JScript array input: calls `GetCentroid`, but the file only defines
`getCentroid` (case differs), so (inferred) a script error. Anything else → log (siError)
`GetClosestHole requires an input vector of array of vectors.` and returns whatever the leaked global last held.
B18b passes Vector3 picks (world positions); the comparison in local space is only exact for a frozen mesh, which B18b
checks first.

### 2.6 Other methods (not reached by any command)
`Global()` converts `Vertices` in place to world space with the build-time transform. `ExtractHoles(n, degree=1)`: per
hole (or only hole n when n is a number) a closed NURBS curve on the scene root named `<object name>_<i>` through the
hole points (local positions, weight 1), parameterization 1. `Help()` logs a usage text.

## 3. Utilities.js (keyword helpers)

Keyword match rule (**FilterKeyed**, used by all getters): an object matches when it has **at least one** user
keyword and **every** requested key is found in its keyword collection (`GetUserKeyword(obj)`, item lookup by the key
string). An empty key list matches every object that has any keyword. Result order = input collection order.

### `FilterKeyed` (SPEC)
Args `ObjectCollection`, `KeyStringList` (comma-separated string, split on `,` without trimming), `RemoveKeys`.
Returns an XSICollection. `RemoveKeys` truthy → returns the **complement**: all input objects minus the matches
(including objects without keywords). No keywords are removed despite the name.

### `GetKeyed` (SPEC)
Args `KeyArray` (`_Init`: siArgumentInput, default 0, handler siDispatch: a JScript array of strings), `Model`.
Model empty → face model (below). Returns the FilterKeyed matches among `Model.FindChildren()` (all descendants).
Face model: `fr_GetFaceModel()` (same as B14a); if that command fails → log (siError)
`Face Robot FR.dll Failed to load properly. Command("fr_GetFaceModel") was not recognized!`, then the scene-root child
model `Face`, created with `ActiveSceneRoot.AddModel(null, "Face")` when missing.

### `GetKeyed2` (SPEC)
Args `KeyStringList` (comma string), `Model`. As GetKeyed with the split list.

### `fr_GetKeyed_safe` (SPEC)
Args `KeyArray` (a safe array), `Model`. Converts the safe array, runs GetKeyed, returns the matches as a **safe array**
(the items of a Scripting.Dictionary keyed 0…n−1), for callers in C++/VBScript (FR.dll uses it, B14e).

### `AddUserKeyword` (SPEC)
Args `Obj`, `Key` (no flags beyond the default). No value is returned. New keyword text = the existing keywords joined
with `,`, then `,` and `Key` appended (so an object with no keywords gets a **leading comma**, `,Key`); duplicates are
not checked. `ClearUserKeyword(Obj)` then `SetUserKeyword(Obj, text)`. A `Key` containing commas adds several keywords
(inferred: SetUserKeyword splits on commas; B18c passes `"Face,Mesh"`).
Note: Softimage has its own scene command of this name in AfterImage (`uiGroupViewTasks.ts`); this plug-in's version
takes (`Obj`, `Key`).

### `SetControlKeys` (SPEC)
No args; return value on but nothing is returned except null on errors.
1. DNA = `ParseDNAFile()` (default DNA file, §5). None → log (siError) `OPENDNA NOT FOUND`, return null.
2. Every object of DNA `ControlObjects` gets keyword `Control`; every object of `HelperObjects` gets `Space`
   (AddUserKeyword each). Helpers are appended to the control collection, then every `chainelement` among all
   descendants of the first control's model (`SIFilter` of `FindChildren()`).
3. Empty → log (siError) `OPENDNA Controls NOT FOUND`, return null (inferred: an empty ControlObjects collection already
   fails at step 2's model lookup with a script error).
4. `fr_ResetAll()` (same as B18a), then name-based tagging of every object in the collection:

| Name contains (case-sensitive, regex match) | keywords added |
|---|---|
| `MouthCorner` | `Control,Mouth,Corner` |
| `Lip` | `Control,Mouth` |
| `Bend`, `Upper`, `Lower`, `Jaw`, `Eyelid`, `Ear`, `Eyebrow`, `Orbital`, `Mid`, `End`, `Nose`, `Nostril`, `Bulge`, `Base`, `Chin`, `Neck`, `Head`, `Root`, `Hinge`, `Puffer`, `LookAt`, `Tip` | the same word |
| `Null` | `Null,Space` |
| `Start` | `Bone` |

   Then a side keyword: the object's global position mapped into the space of `<model name>.Head_Control` (looked up in
   the collection by name): |x| < 0.001 → `Center`, x > 0 → `Left`, else `Right`.

### `MirrorControls` (SPEC)
Args `Controls` (default the selection), `Global`. Return value on, nothing returned.
1. Left = FilterKeyed(input, [Control, Left]); Right = FilterKeyed(input, [Control, Right]); Center =
   FilterKeyed(input, [Control, Center]).
2. Each Center control is its own target; value = its position mirrored in x: `Global` → global translation with x
   negated; else local (−posx, posy, posz).
3. Each Left then Right control: its keyword list (split of the keyword text on `,`) with the **first** `Left`/`Right`
   swapped; none → log (siError) `Object <<full name>> is not a symmetrical control !, check keys \n\t[<keys>]`, skip.
   Mirror = FilterKeyed(control's model descendants, swapped keys); none → siError
   `No mirror control to <<full name>> was found `; more than one → siWarning `More than One Control with keys
   [<keys>] : \n<<list>>\n\tto ensure unique identification, add more specific keys \n only one control <<first>>will
   be mirrored` (texts as shipped). Target = the first match; value = the **source**'s mirrored position (as step 2).
4. Logs the target collection (info). Writes each value to its target (global translation, or local posx/posy/posz),
   then `SelectObj` the targets.

## 4. AdjustPanelKeys.js

Plug-in-global lists name / key / tangent, empty until the first save (session memory only). All three: no args,
return value off, the property is `FaceAdjustProperties` on `fr_sget("FaceModel")`.

### `fr_SaveAdjustPanelKeys` (SPEC)
For every fcurve-animated parameter of the property (`AnimatedParameters(siFCurveSource)`): stores the parameter name,
the keys as a flat (time, value) list and the tangents as a flat (left dx, left dy, right dx, right dy) list. Replaces
the previous lists.

### `fr_PrintAdjustPanelKeys` (SPEC)
Per stored entry three info lines: the name, `  keyArr=<comma-joined keys>`, `  tanArr=<comma-joined tangents>`.
Before any save: (inferred) script error (the lists are undefined).

### `fr_RestoreAdjustPanelKeys` (SPEC)
Per stored entry: the property's parameter of that name gets `AddFCurve2(keys)` (replacing its curve, inferred) and
`SetKeyTangents(tangents)`. Before any save: (inferred) script error.

## 5. ParseOpenDNA.js

### DNA file format (fact)
Plain text. Sections are separated by `###`. Inside a section, every line has all tab, vertical-tab, line-feed,
carriage-return and form-feed characters removed and trailing commas stripped (spaces kept); empty lines and lines
starting with `//` are skipped. The first remaining line is the section **name**, the following lines its entries
(strings, kept in order). Entries are comma-separated fields; the `controls` and `hpoints` sections use field 0 as a
type tag and field 1 as an object name.

Parsed result (a JScript associative array): `filename`, `labels` (one slot per `###` section: the section name, or
undefined for an empty section), one key per section name → its entry list; `ParseDNAFile` adds `ControlObjects` and
`HelperObjects`.

### `GetDNAFile` (SPEC)
No args (the Execute takes a `type` that the command never receives, so it is always empty). Return value on.
1. Folder = environment `FACEROBOTDATAROOT` + `\` + `Dna`; every file there whose last dot-separated part is exactly
   `dna` (full paths). None → log (info) `dna files inside Folder <<folder>> not found `, return null.
2. Type pattern default `Human_Face_Symmetric`; the **last** file whose path matches the pattern (regular expression)
   wins. None → log `dna file <null> not found ` (prints null), returns null. Else returns the path string.

### `ParseDNAFile` (SPEC)
Args `filename`, `debug`. Return value on.
1. When `filename` is not an existing file it is used as the **type pattern** for GetDNAFile (empty → the default DNA).
   No file → null.
2. Reads the whole file (missing → siError `File <name> Not found `, null), parses it (above). `debug` → logs every
   key as `key=<key>`, then `<i>=<entry>` per entry, then an empty line.
3. Face model = `fr_sget("FaceModel")`. `ControlObjects` = XSICollection: per `controls` entry with tag `s` the objects
   `L<name>` and `R<name>`, with tag `a` the object `<name>` (other tags ignored), each via `FaceModel.FindChild`;
   missing → siError `Control <<name>> not found` (skipped). No face model → null instead of a collection.
   `HelperObjects` = per `hpoints` entry (every entry: the tag test matches anything, inferred intent was `^`/`|`
   literal tags) `FaceModel.FindChild(<name>)`, missing ones skipped silently.
4. Returns the parsed object.

### `LogDNA` (SPEC)
Args `DNA` (`_Init`: default 0, siDispatch), `key`. Empty DNA → `ParseDNAFile()`. With `key`: logs `<i>=<entry>` for
that section and returns. Without: the debug dump of ParseDNAFile step 2. No return value.

## 6. ModifyFaceLayout.js

### `fr_ToggleFaceLayout` (SPEC)
No args; return value on, nothing returned. Its `_Init` returns **false** (see Open questions). Shipped comment: bound to
Ctrl+F.
1. Layout id = `fr_GetCurrentStage()` / 10 (same as B14d; not rounded).
2. Active layout named `Face Robot` → active layout = `fr_sget("Layout")` when set, else the layout
   `Tools Development Environment`.
3. Otherwise → active layout = the `Face Robot` layout, then `fr_SwitchFaceLayout(id)` (same as B14d).

### `fr_SetAltLayout` (SPEC)
No args. Shipped comment: Shift+Ctrl+F. `fr_sset("Layout", <active layout>)` (stores at (`_`, `Layout`)) and returns the
active Layout object. This is the "alternative" layout the toggle goes back to.

## 7. PlotToShapes.js

### `PlotGlobal` (SPEC)
Args `inObj`, `start`, `end`, `inName`, `mod`. Return value on, nothing returned (null when there is no input).
1. `inObj` empty → selection; still empty → null. `inName` default `GPose` (never used). `start`/`end` falsy (0
   included) → `PlayControl.In` / `PlayControl.Out`.
2. Sources: a Collection as is, a Selection's items, a single X3DObject; anything else → no sources.
3. Targets = the sources, except when `mod` (a model, or a name looked up with `ActiveSceneRoot.FindChild`) is a
   `#model`: target i = `mod.FindChild(<source i name>)`. Otherwise `mod` = the first source's model.
4. The model gets a mixer when it has none.
5. For each frame start…end (inclusive, step 1): Play Control `Current` = frame; for each source the global
   `sclx scly sclz posx posy posz rotx roty rotz` values are recorded.
6. Each target's global parameter of the same name gets `AddFCurve2(<frame, value list>)` (one key per frame).
   Play Control stays at the last frame.

### `PlotFaceRobot` (SPEC-PARTIAL)
Args `NewModelName`, `inMeshes`, `inStart`, `inEnd`, `inFaceModel`. Return value on: a JScript object
{ `Duplicates` (empty collection, never filled), `Meshes`, `Head`, `Model` }.
1. Sources: `inMeshes` non-empty → those, and the face model = the first one's model. Otherwise the face model =
   `fr_sget("FaceModel")` (**the argument is overridden**) and the sources = the face model's descendants passing filter
   `frf_polyandsurfmesh`.
2. `NewModelName` truthy → new scene-root model named it (a non-string truthy value → `PlotFaceRobot`).
3. Plot set = the sources plus all their descendants, unique, filtered to polygon meshes. Log (info)
   `Plotting: <list>`.
4. New model: each plot mesh is duplicated (`Duplicate` with positional values 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0,
   0, 0, 0, 0, 0, 0, 1: one copy, current history, hierarchy, grouping on, no properties, no animation, no constraints,
   selection unchanged, identity scaling offsets), put under the new model, frozen; its custom properties and user-data
   blobs are deleted; every animation source is deleted except those whose source full name starts with the face
   model's name (errors ignored); its point clusters are deleted. `Meshes` gets the original. The new model's mixer is
   deleted when present. `Head` = first original.
   No new model: targets = the plot meshes themselves and the model = the face model.
5. Range: non-number start/end → Play Control In/Out; then the shape plot (below).
6. Model set → `SelectObj("B:<model>")`. Otherwise (only when the face model is empty) the members of groups
   `Controls`, `Envelope`, `Hidden` from `fr_sget("groups", …)` are deleted.

Shape plot (sources S, targets T, range, model M):
1. Each target is glued to its source: same as `fr_GlueMeshGlobal(T, S)` (B14a); the operators are kept.
2. `Context.ConstructionMode` = 1 (shape modelling, inferred). Progress bar `Plotting XSI Shapes`, maximum
   (end − start) × target count.
3. For each frame i, for each target: Play Control `current` = i; on the first frame a track
   `AddTrack(M, null, 1, <target full name>Shape, null)` per target. Shape key name `<target name>_<i>_Frame`,
   `StoreShapeKey(T, name, 2, null, 1, 0, 3, 0)`. Retries: no key → log `Shape key replotted <i>:A` and store again; a
   key with no elements, not of type `clskey` or with another name → log `Shape key replotted <i>:B`, delete it, store
   again. Clip: `AddClip(<target model>, key, null, track, i, null, null, null, false)` and its
   `actionclip.timectrl.clipout` = 0; failure → log `Second Try : adding Clip on mesh: <name>, at frame: <i>` and
   retry; second failure → siError `Failed to add Clip on mesh <name> at frame <i>`. When start ≠ end the bar
   advances with `Frame... <i>`; Cancel → log `Canceled by user.` and the plot **stops immediately** (construction mode
   stays 1, glue operators stay).
4. Construction mode 0. `CreateCompound(M, <all clips>, null, <track>, start, <first target full name>)` where the
   track argument is one past the last track (undefined); compound `cliptoparentend` and `cliptoparentstart` = true.
5. Glue operators deleted; bar `Plot Complete... ` (when start ≠ end) and hidden.
Missing: what `CreateCompound` does with the undefined track argument.

## 8. InitNeck.js / InitNose.js (fit-stage builders)

### `fr_InitNeck` (SPEC)
Args `inHeadMesh`, `inNeckMarkers` (a collection of at least 7 marker objects). Return value on: an XSICollection, or
null when `inHeadMesh` is empty. "Fit" = `fr_sget("Fit")`; "Neck group" = `fr_sget("groups", "Neck")`;
`AddInPlace` = same as `fr_AddObjectInPlace`; "group" = same as `fr_AddToGroup(Neck group, obj, 0, false)`.
1. Scale s = `fr_sget("psets", "FaceScale").Scale` × 2. Mk = global positions of markers 0…6. Box = `fr_sget("meshbox")`
   as an array, elements 3 and 4 used.
2. HeadBase position P1 = Mk1 with z = (Mk0.z + box[4]) / 2. HeadSize = box[3] − P1.y. NeckBase position P0 = P1 with
   y lowered by 0.7 × HeadSize. Trachea points T0…T3 = Mk3…Mk6; T4 = Mk4 + 1.3 × (Mk4 − Mk5).
3. Cubes `NeckBase` (P0) and `HeadBase` (P1): `AddInPlace("Cube", 0, Fit, s, P, name, 239)`, grouped.
4. On HeadBase a CustomProperty `Dimensions` with `X`, `Y`, `Z` (siDouble, persistable, default HeadSize, range and UI
   range HeadSize/10 … HeadSize × 10).
5. Nulls `LowerNeckDepth` at lerp(P0, P1, 2/5) and `UpperNeckDepth` at lerp 3/5: `AddInPlace("Null", 0, Fit, 0.01, P,
   name, 0)`, each with a `TwoPoints` constraint to (NeckBase, HeadBase), `perc` 40 and 60; grouped.
6. A cube under each null at the same position, same name as its null, wire colour 188, length s (min 0.01); grouped.
7. Curve `NeckFC` under Fit through NeckBase, the two depth cubes, HeadBase (global positions): degree 3, open, knots
   0,0,0,1,1,1, parameterization 1, NURBS format 0; one vertex cluster `point<k>` per control point (element k) with
   its centre reference = the matching object; local Display Property wire colour 239; grouped.
8. Cube `SternumTop` under Fit at T4, wire colour 188, length s/2, then projected onto the head mesh: a 2-point linear
   curve `<object>pCurve` on the scene root at the object, `ApplyOp("ShrinkWrap", "<curve>;<mesh>;", 3,
   siPersistentOperation, null, 0)` with `Proj` = 2, `alongz` = true, `bidir` = true; the object is moved to the
   curve's first point and the curve deleted. T4 = the new position.
9. Cube `AdamsApple_Cluster` = `AddInPlace("Cube", 1, Fit, 1, lerp(T1, T2, 0.4), name, 256)`: `sclx` = `sclz` =
   2 × Mk2.x, `scly` = 3 × Mk2.x, `visibility.viewvis` false. Cube `TrachealInfluence_Cluster` at lerp(T4, T2, 0.5):
   `scly` = |T2.y − T4.y|, `sclx` = 4 × Mk2.x, `sclz` = 3 × Mk2.x, hidden. (A negative Mk2.x gives negative scales.)
10. Returns: NeckBase, HeadBase, NeckBase, the lower and upper depth cubes, HeadBase, NeckFC, AdamsApple_Cluster,
    TrachealInfluence_Cluster (duplicates as listed; SternumTop and the nulls are not included).

### `fr_InitNose` (SPEC)
Args `inScale` (empty → 1), `inGroups` (ignored), `inSymmetry`. Return value on: an XSICollection of the two rings and
their descendants.
For side L then R: base = `Fit.FindChild("<side>NostrilBase")`, bulge = `fr_sget("features", "<side>NostrilBulge")`,
tip = `fr_sget("features", "NoseTip")`; B, G, T = their global positions.
1. Ring points: BT = T − B, BG = G − B; with x zeroed, d = (BT₀·BG₀)/|BT₀|². Projected bulge P = B + d × BT with x =
   G.x. M = lerp(P, T, 0.5). Q2 = G − P, Q3 = G. When G.y < P.y: P moves by 2 × Q2 and Q2 is negated. When |Q2| > 0:
   Q3 = normalise(Q2) × 0.75 |G.x| + G with x = G.x/2, and Q2 = Q2 + G with x = (Q2.x + M.x)/2. Else Q2 = G raised
   by |G.x/2| in y and Q3 = Q2 raised again by |G.x/2|. Septum S = P with x/10; U = lerp(P, S, 0.5); ring base
   RB = U − (|S − P|/2) × BT/|BT| with that offset's x zeroed; ring tip RT = U + the same offset.
2. `Fit.AddNurbsCurveList2` with 2 curves named `<side>NoseRing`: curve 0 = (P, G, Q2, Q3), open, knots 0,0,0,1,1,1;
   curve 1 = (RB, P, RT, S), closed, knots −2,−1,0,1,2; both degree 3, parameterization 1, NURBS format 0, weights 1.
3. Selection set to base, bulge, tip, ring (the command changes the selection). Display Property wire colour 239.
4. Null `<ring>_UpVector` at U: `AddInPlace("Null", 0, ring, inScale/10, U, name, 0)`.
5. CustomProperty `CurveData` on the ring: `Divisions` (siInt2, 3, 1–15, UI 1–15, persistable), `Controller`
   (siString, default = the bulge's name).
6. Handles: for every control point j (8, both sub-curves) a cube under the ring named `<ring><ring>` (the ring name
   twice), length inScale × 0.05, wire colour 188, global translation = the point's **local** position,
   `SetNeutralPose(siSRT, false)`; a point at exactly the same position as an earlier one reuses that handle (the last
   matching earlier one). A vertex cluster per point j (element j) with centre reference = its handle. The handle list
   (8 entries, point 5 reuses point 0's cube, plus the up-vector null) is kept per side.
7. Side R with `inSymmetry`: every handle j (and the null) gets a `Symmetry` constraint to the L handle j.
8. `SIApplyCns("NPoints", <up null>, "<handle 4>,<handle 5>,<handle 6>,<handle 7>")`.

## 9. FaceRobotShapeGoals.js

### `StoreShapeGoal` (SPEC-PARTIAL)
Args `GoalName`, `SourceMesh`, `FaceRobotMesh`, `HeadSpace`, `ClusterName`. Return value on; returns false on the
two checks below, otherwise nothing.
1. Defaults: `SourceMesh` = `Selection(0)` when it is a `polymsh`; `FaceRobotMesh` = `fr_sget("meshes", "Mesh")`;
   `HeadSpace` = `fr_sget("hpoints", "HeadNull")`; `ClusterName` = `FaceCluster` (but ignored: the cluster name is
   always `FaceCluster`); `GoalName` = the source's name.
2. HeadSpace without a property `Static KineState` → log (info) `HeadSpace requires a static Kinematic State Property,
   Head Null not enveloped.`, return false.
3. Cluster `FaceCluster` on the target when it exists and is always-complete, else a new empty (complete) vertex cluster
   of that name.
4. Shape property `<Goal>_Shape` (type `clskey`, else added from preset `SimpleDeformShape`); its elements are always
   set to the source's point positions taken with `GetGeometry(0, 3)` (local).
5. Weight map `<Goal>_Weight` (type `wtmap`, else added from `Weight Map Property`). When newly created, the colour
   setter is called without a colour: it computes a random colour into a global but then reads the missing argument,
   so (inferred) a **script error** aborts the command here (shape and weight map exist; weights not set to 1, nothing
   else built).
6. Nothing new and an existing `ShapeGoalOp` in the target's history whose input ports point at the same shape and
   weight map → log `Operator using already exists`, return false.
7. Blend parameter: property `ShapeGoals` on the target (added when missing), parameter `<Goal>` (siDouble, default 1,
   0–1, UI 0–1, animatable) added when missing; `InspectObj` on the property.
8. When the command `Add ICE Node` exists → log (siError) `DEVTBD ICEPORT IN PROGRESS!, ` and **no operator**
   (inferred: always the case in 2015). Otherwise a JScript scripted operator `ShapeGoalOp`: in/out on the target
   primitive; inputs shape, weight map, HeadSpace global kinematics, `Static KineState`, blend parameter; connected
   with construction mode 2.
Operator: blend b ≤ 0 → nothing; else per point w = weight × b, goal = the shape point mapped to world by the head's
active pose relative to its static pose; output = (1 − w) × current + w × goal.
`ShapeGoals` property: no parameters of its own; on open the layout is cleared and a group `AbsoluteShapeGoals` gets one
row per parameter.
Missing: confirmation of step 5's abort and of step 8's command test at run time.

## 10. AddBlinkKeys.js

### `fr_AddBlinkKeys` (SPEC)
Args `iObj`, `iParam`, `iBlinkFC`, `iPivot` (empty → 0), `iOffset` (empty → 0), `InsertMode`, `leadingInsertMode`,
`scaling` (empty → 1). Return value on, nothing returned (null on errors). Blends a blink fcurve into a parameter's
existing animation.
1. `iParam` given as a string: the object name is the part before `.kine.local`; not found → siError
   `<name> not recognized as valid object`, null; the parameter is then **always** that object's local `posy`.
   `iBlinkFC` as a string → resolved the same way (same message). The blink curve = the parameter's value (an FCurve).
2. Blink keys: none → stop. New key list = (time, value × scaling), tangents (left dx, left dy × scaling, right dx,
   right dy × scaling). When pivot or offset is non-zero every new key time is shifted by pivot + offset.
3. Existing curve = the fcurve source on the parameter (proxy parameters resolved to their master). None →
   `AddFCurve2(new keys)` + `SetKeyTangents`, done.
4. Window: start = range search forward (step +0.5, method `InsertMode`), end = range search backward (step −0.5,
   method `leadingInsertMode`, falling back to `InsertMode` when that is null). Tolerance 0.001.

| Method | Start (forward) / end (backward) |
|---|---|
| 0 / empty ("from the ends") | from the first (or last) new key toward the other end: first time where new + 0.001 ≥ existing (lid not more closed than the existing curve) |
| 1 ("from the centre") | from the pivot outward toward the first (or last) new key: first time where new + 0.001 < existing |
| 2 ("absolute") | the first (or last) new key time |

   New values during the search are read from the blink curve at time − pivot − offset. Either null → log
   `no keys set, existing curve has lids closed at current blinkTimes`, null.
5. Merged key list: existing keys before start; a lock key at start − 1 (when the existing curve has no key there) with
   the existing value and tangents (−0.5, 0, 0.5, 0); when no existing key came first and the existing value at start
   is below the first new value, the previous key's left tangent x = −0.5 and a key at start + 1 with the existing value
   (tangents −1, 0, 1, 0); the new keys with start ≤ time ≤ end (the first one sets the previous key's right tangent x
   to 0.5 when no lock key was added; this adjustment happens at most once); a lock key at end + 1; existing keys after
   end.
6. Clean-up: a key is dropped when its time is not more than 0.001 after the previous **original** key's time. Tangents:
   right dx ≥ 0, left dx ≤ 0; for each pair, the previous right dx ≤ 1.25 × gap and left dx ≥ −1.25 × gap; when the two
   magnitudes (before capping) exceed 2 × gap the previous right dx is reduced proportionally and the left dx is
   changed by the same proportional formula (which makes it larger in magnitude; as shipped).
7. `AddFCurve2(merged keys)` replaces the curve; `SetKeyTangents` (failure only logged in debug).
Debug lines (` insertMode <n>`, `Checking KeyRange with method …`) are logged only when `fr_Callstack_IsDebugMode()`
(same as B14a) is true.

## 11. PaintGameExportPlugin.js

### `PaintGameExport` (SPEC)
Arg `inPaintModel` (registry name; the mode number). Return value on, nothing returned.
1. Tongue mode = 7. Skin = `fr_sget("meshes", "Tongue")` in tongue mode, else `fr_sget("meshes", "Mesh")`; none → stop.
   size = `FaceModel.FaceScale.Scale`.
2. Weight maps (an existing property of that name on any point cluster of the skin is reused, else
   `CreateWeightMap("WeightMap", skin, name, "Weight Map Property", false)` and its colour set):

| Index | Map | colour (r, g, b) |
|---|---|---|
| 0 | `Locators` | 255, 137, 0 |
| 1 | `Spin` | 114, 182, 0 |
| 2 | `JawParent` (not in tongue mode) | 146, 112, 61 |
| 3 | `HeadParent` (not in tongue mode) | 120, 50, 50 |
| 4 | `NeckParent` (not in tongue mode) | 120, 120, 120 |

3. Locator display curve: the skin's child `FaceExportLocators` (`TongueExportLocators` in tongue mode); missing →
   a 2-point degree-1 NURBS curve (0,0,0)–(1,1,1) under the skin, knots 0,1, open, SI NURBS, renamed. A Display
   Property with wire colour 890 is added every time. When its history already holds a `DrawLocators` operator → skip
   the rest of this step. Else a JScript scripted operator `DrawLocators` (port group `MainGroup`), parameter `size`
   (siDouble, persistable, default size, 0.001–1e10, UI 0.1 … ceil(2 × size)); output the curve primitive
   (`OutCurve`); inputs curve primitive `inCurve`, curve global kinematics `inCurveGlobal`, skin primitive `inSkin`,
   `Locators` map `inLocatorMap`, `Spin` map `inSpinMap`, skin global kinematics `inSkinGlobal`; connected, then
   `InspectObj` on it.
4. Bone counter: scene-root `Custom_parameter_list` `DisplayInfo_GameExport` (added when missing) with `nbBones`
   (siInt4, `AddParameter2` values 0, 0, 100000, 0, 1000, classification 8, capabilities 16, name and description
   `Bone Number`). When `nbBones` is not yet driven by `BoneCounter` → JScript operator `BoneCounter` (group
   `MainGroup`), output `nbBones` (`OutSlider`), input `Locators` map (`inLocatorMap`); and
   `Views.ViewB.UserCamera.camvis.custominfo` = true. BoneCounter writes the number of skin points whose locator weight
   is ≥ 0.9999.
5. Icon = the skin's **first child** (the name test is mis-parenthesised and always passes, inferred); logs its name;
   no child → stop.
6. Brush size b = 0.6 × size. Paint step = `ActivateObjectSelTool(null)`, `SelectObj(map)`,
   `BrushProperties.WeightPaintMode`, `.Opacity`, `.Radius` (radius logged first, min 0.01), `PaintTool()`, icon
   `visibility.viewvis` true:

| Mode | Action |
|---|---|
| 0, 7 | paint `Locators`, paint mode 1, opacity 100, radius 0.2 b |
| 1 | paint `Spin`, mode 0, opacity 5, radius 2 b |
| 2 | paint `JawParent`, mode 0, opacity 100, radius 10 b |
| 3 | paint `HeadParent`, same values, then `PaintTool()` a second time |
| 4 | paint `NeckParent`, same values |
| 5 | icon visible, `InspectObj` on its `DrawLocators` operator |
| 6 | icon hidden |
| other | nothing |

DrawLocators operator: for every skin point with locator weight ≥ 0.9999, a frame at the point's world position whose
Y axis is the point normal (skin rotation only) and whose X axis points toward its first neighbour vertex rotated about
the normal by spin weight × 2π; drawn (size = the `size` parameter s) as three degree-1 open curves from the origin to
(0.6 s, 0, 0), (0, s, 0), (0, 0, 0.6 s) and a closed 5-point square at x = 0.6 s with y, z = ±0.1 s. The curve
geometry is replaced only when at least one point qualifies.

## 12. StabilizeC3D.js

### `fr_StabilizeC3D` (SPEC)
Args `infilename`, `outfilename`, `nmapfilename`, `doFilterNoise`. Flag siNoLogging; return value off. Rewrites a C3D
mocap file so it is stabilised against three head markers.
1. Face model `fr_sget("FaceModel")` missing → siError `Face model not found.`; actor `fr_sget("Actor")` missing →
   siError `Actor not found.`; both stop.
2. `fr_FlushRetargetedFace()` (same as B14d). Branch-deletes the actor's children `NoseBridge`, `LForehead`,
   `RForehead`, `Head_Control`, `HeadNull`, `JawEnd_Control` when present.
3. Name map: read with `fr_FileRead` (same as B14a); empty → siError `'<nmap>' not found.`. Format (fact): text lines;
   the first block between a line starting with `{` and a line starting with `}` lists stabilisation marker names (one
   per line); the next such block lists `marker<TAB>controller` pairs. Leading/trailing characters with code ≤ 32 are
   stripped from every name.
4. `fr_LoadC3D(nmap, infilename)`, Play Control `Current` = 1, `fr_CreateFaceMap(nmap, "_temporary_.fmap")`, then
   `fr_FileDelete("_temporary_.fmap")` (same as B14a/B14d).
5. C3D model = scene-root child `C3DFaceData`. size = the `length` of the marker named by the first stabilisation entry;
   any missing marker → siError `Couldn't find '<name>'.  Aborting.` (two spaces), stop.
6. Cubes `NoseBridge`, `LForehead`, `RForehead` (the fixed names; positions from stabilisation entries 0, 1, 2) under the
   actor (`AddGeometry("Cube", "MeshSurface", name)`), global position copied from the marker, `length` = size.
7. Torus `Head_Control` under the actor, `radius` = size, at the first cube; controller set-up: CustomProperty
   `FaceControl` with string parameter `ID` = name, `fr_sset("controls", name, obj)`, optional parent, `SetNeutralPose`.
   Null `HeadNull` under Head_Control at the same position, `fr_sset("hpoints", "HeadNull", null)`. The three cubes are
   moved under Head_Control.
8. Per name-map pair: cube named the controller at the marker's position, `length` size; when the controller name
   contains `_Control` (not at position 0) it gets the controller set-up under HeadNull. Missing marker → the abort
   message, stop.
9. Actor children `LJawEnd` and `RJawEnd` required (missing → **info** log `Couldn't find 'LJawEnd' and/or 'RJawEnd'.
   Aborting.`, stop). Cube `JawEnd_Control` under HeadNull at their midpoint, `length` size, both made its children,
   controller set-up.
10. Branch-delete the C3D model. Actor global `posy` = 1 (left so). `fr_C3DToFaceRobot(infilename)`. `doFilterNoise` →
    `Face.FaceAdjustProperties.FilterNoise` = true. `fr_WriteC3D(infilename, outfilename)`.
11. Clean-up: face-model properties `FaceCalibrateProperties`, `ZeroPose`, `ZeroPoseO` deleted when present;
    `fr_FlushRetargetedFace()`; branch-delete of every controller created (Head_Control, the `_Control` cubes,
    JawEnd_Control). The `controls` / `hpoints` store entries still name the deleted objects (inferred).

## 13. AnimationRigImport.js

### `ImportAnimationRig` (SPEC)
No args. Menu item `FaceRobot Shape Animation Rig` under File > Import (`siMenuMainFileImportID`). Logs (info)
`ImportAnimationRig_Execute called`; gets or adds the scene-root property `ImportAnimationRig`; `InspectObj` it;
returns true.

`ImportAnimationRig` property: `dotXSI` (siString ""), `Log` (siBool, 0), `Method` (siInt4, 0, 0–3, UI 0–3). Layout:
group `Import Face Robot Shape Rig` with a file-path control on `dotXSI` (no label, filter
`dotXSI (*.xsi)|*.xsi|All Files (*.*)|*.*||`, initial folder `<project>\dotXSI`, must exist, open mode). On open:
verbose log `ImportAnimationRig_OnInit called`, globals `OriginalCmdLogValue` (the `scripting.cmdlog` preference),
`STARTTIME`, `LASTTIME`; help page `import_export_ImportingaFaceRobotShapeAnimationRig.htm`. Changing `dotXSI`: closes
the page, deletes the property, refreshes, logs `Importing file <<<file>>` (as shipped: two `<`, one `>`), then
`fr_ImportAnimationRig(file, Log)`.

### `fr_ImportAnimationRig` (SPEC-PARTIAL)
Args `file`, `log`. Description `Export to dot XSI with specific Options` (sic). Return value on: the imported model.
1. Empty, missing, or not containing `.xsi` → siError `path not valid`, stop. Preset folder = the file path without
   `.xsi` (a folder named like the file next to it).
2. Scene-root property `ImportCrosswalkOptions` (added when missing): `Filename` = file, `Target` = 2, `Verbose` = log;
   `XSI.XSIFileService.ImportDotXSI(file, scene root)`.
3. Model = the **last** model in `FindChildren("", siModelType)` of the scene root. Geometry: names containing `Tongue`
   → tongue mesh (the last one); among the others the largest bounding-box volume (ties → later) → face mesh.
4. Every `*Control` object `primary_icon` = 4; every `*NeutralPose` object `primary_icon` = 0.
5. Face mesh needs a cluster matching filter path `Shape` (first one); none → siError `No Shape Targets Found...`, stop.
6. New jaw chain: the global positions of `JawRoot`, `JawHinge`, `JawStart`, `JawEnd_Control`; under `HeadNull` a 2D
   chain from point 0 to point 2 with normal (0,0,1), `si2DChainFront`, plus a ball-joint bone to point 3. Effector:
   Display Property wire colour (1, 0, 0), `primary_icon` 4. Chain presets from the preset folder: second element
   `joint.chntype` = 2; folder missing → warning; per element i, files `<old name i>_<primitive type>.Preset`,
   `<old name i>_Kinematic_Joint.Preset`, `<old name i>_Kinematic_Chain.Preset` loaded with `LoadPreset` when present;
   any missing → siWarning `USER CHECK: Chain Preset file Not found, validate jaw bone roll and chain behaviour `.
7. Children of the old elements 2 and 3 move under the new ones. `JawEnd_Control_NeutralPose`, when present, goes under
   the new root and takes the new effector as child. Each old element is renamed `<name>_Old` and hidden (`viewvis`
   false), the new one takes the name. The old jaw-end's local `posx/posy/posz` fcurve keys are copied onto the new
   effector (`AddFCurve(0, 2, 1, keys)`) and its neutral-pose values `nsclx … nposz` copied; the old jaw-end gets a
   `Position` constraint to the new effector.
8. Mixer added when missing. Controllers with a `SamplerCache` property: progress bar `Making Operators`; a temporary
   scene-root null `tmpsampler`. Per controller: SRT from `SclX…PosZ` of the cache, subdivisions `DenX/Y/Z`, face
   scale `facescl`; clip list = the clips of mixer compound `<controller name up to "Control">Compound` (missing →
   siError `Comopound <<name>> for Control <<ctrl>> Not Found : Control Operators will not be applied...` (sic);
   empty → siError `Compound <<name>> is empty: Control Operators will not be applied...`; either → skip). Controller
   Display Property colour (1, 1, 0) and scale 1; the null's global transform = the cache SRT mapped through the
   controller's parent. When the command `Add ICE Node` does **not** exist: same as `fr_ApplyShapeWeightOp(clips,
   tmpsampler, DX, DY, DZ, controller, parent, parent-is-NeutralPose, 0)` (B13e). The null is deleted afterwards.
9. Every null of the model: `size` = face scale / its parent's `scly`. Same as `DeleteUnusedMixerTracks(mixer)` (B17e,
   LOCK). Eye constraints (`fr_BuildEyesConstraint`). New effector `size` = 2 × face scale. Bar hidden.
10. When `Add ICE Node` exists: same as `FR_Import_Animation_Rig_To_ICE(<model name>, true, false)` and, with a tongue
    mesh, again with (…, true, true) (B13e).
Missing: the order `GetSkeleton` returns (assumed root, bone, bone, effector), the meaning of the `Shape` filter path,
and the ICE branch (B13e SPEC-PARTIAL).

### `fr_BuildEyesConstraint` (SPEC)
Arg `model` (required). Return value on, nothing returned. Needs `LookAt_Control`, `LEye_Control`, `REye_Control` in the
model (any missing → nothing). Each eye gets a `Direction` constraint to LookAt with compensation, `upvct_active` = 1.
When the left eye's parent name contains `NeutralPose`, on both constraints the aim axis is rotated: new `dirx` = −old
`dirz`, `diry` = 0, new `dirz` = old `dirx`.

## 14. StereoCamera.js

### `GetPrimStereoCamera` (SPEC-PARTIAL)
Arg `ObjName` (siString, default `StereoCamera`). Menu: Get > Camera toolbar menu (`siMenuTbGetCameraID`), item
`XSIUtils.Translate("Stereo", "XSISCRIPTS")`. Returns an XSICollection holding the root.
1. `SIGetPrim("CameraRoot", "<n>_Root", scene root, true)`; under it `SIGetPrimCamera("Camera", "<n>", "<n>_Interest",
   root)` = centre camera, its primitive and interest. Roots `<n>_LeftRoot` / `<n>_RightRoot` under the root
   (`SIGetPrim("CameraRoot", …, true)`), each with a camera `<n>_Left` / `<n>_Right` (`SIGetPrim("Camera", …)`).
2. `camera.projplane` = true on all three cameras. `ToggleVisibility` on the three roots and the interest.
3. Wire colours (MakeLocal of `display`, then `wirecolorr/g/b`): left (0.6, 0, 0), right (0, 0.7, 0.7).
4. `SIAddProp("Stereo", root)`. User keywords: centre `Stereo,Center`, left `Stereo,Left`, right `Stereo,Right`,
   property `Stereo,Property`, root `Stereo,Root`.
5. ICE: on the root an `ICETree` (`ApplyOp(…, siNode, null, null, 0)`) with compound `StereoCameraRig` whose `Camera`
   port takes a Get Data node referencing the centre camera's name; the tree's `port1` ← compound `Execute`. On each
   side root an `ICETree` with compound `StereoCameraSecondaryRig`, `Left` = true / false, `Master` ← Get Data (root
   name), `Slave` ← Get Data (side camera name), `port1` ← `Execute`.
6. Custom operators `StereoLeftConstraint` and `StereoRightConstraint`: output the side camera primitive; inputs in
   order: the side primitive, then the centre primitive's `format.std`, `format.aspect`, `fov`, `pixelratio`,
   `interestdist`, `near`, `far`, `projplanedist`, `projplanewidth`, `projplaneheight`, `projplaneoffx`,
   `projplaneoffy`, `subpixelzoom`, `subfrustumleft`, `subfrustumright`, `subfrustumbottom`, `subfrustumtop`, then the
   Stereo property's `StereoType`, `Separation`, `ZeroParallax`, `FilmOffsetLeft` (left) or `FilmOffsetRight`
   (right). `AlwaysEvaluate` false.
7. `SelectObj(root, "BRANCH")`, `AutoInspect` on the property, return.
Operator update: copies every centre value listed above (except `projplaneoffx`) onto the side camera. Horizontal
offset = centre `projplaneoffx`; type 2 (Off-axis): plus film offset ± stereo offset, with stereo offset =
(Separation × 0.5 × projplanedist × 0.1 / ZeroParallax) / 2.54 (+ for left, − for right); type 1 (Converged): plus
film offset; other types: unchanged.
Missing: the contents of the two ICE compounds (`.xsicompound` files, not read), which position the side cameras (and
presumably apply `ToeIn`).

`Stereo` property:

| Parameter | type | default | range (UI) | capabilities |
|---|---|---|---|---|
| `StereoType` | siInt4 | 2 | 0–4 (0–4) | persistable, animatable |
| `Separation` | siDouble | 0.635 | 0–none (0–20) | persistable, animatable |
| `ZeroParallax` | siDouble | 25.4 | 0.0001–none (0.001–1000) | persistable, animatable |
| `ToeIn` | siDouble | 0 | none (0–30) | persistable, animatable |
| `FilmOffsetLeft`, `FilmOffsetRight` | siDouble | 0 | none (−1–1) | persistable, animatable |

Layout (help page `Stereo_Property_Editor.htm`; every item label min 130 px, 50 %): group `Stereo`: combo `StereoType`
(`Off` 0, `Converged` 1, `Off-axis` 2, `Parallel` 3) labelled `Stereo Type`, `Interaxial Separation`,
`Zero Parallax Distance`; group `Stereo Adjustments`: `Toe In (degrees)`, `Left Film Offset (inches)`,
`Right Film Offset (inches)`; group `Display`: buttons (width 280, spacers between) `Toggle Zero Parallax Plane`
(flips `zeroparallaxplane` on cameras keyed Stereo+Center under the property's parent), `Toggle Left/Right View
Volumes` (flips `viewvolume` on cameras keyed Stereo+Left or Right), `Toggle Non-Renderable Object Visibility` (on the
centre camera: v = not `camvis.objnulls`; sets `objnulls`, `objcurves`, `objimpgeometry`, `objlights`,
`objctrlchnroots`, `objctrlchnjnts`, `objctrlchneff`, `objctrllattices`, `objctrlwaves`, `objctrltextsupp`,
`objctrlother` to v). On open and when `StereoType` changes: `Separation` enabled unless Off; `ZeroParallax`, `ToeIn`,
film offsets enabled unless Off or Parallel.

## 15. B18b promotion check (MeshHelper now contracted)

| B18b command | what it needed from MeshHelper | verdict |
|---|---|---|
| `fr_Diagnose` | what `GetHoles(1)` counts | **SPEC**: a hole = one connected chain of open (single-polygon) edges (§2.3); note that > 99 chains logs `Too many Holes.` and leaves an empty point list, so the "only one hole" test then passes |
| `fr_Holes` | `Holes.Edges` / `Points` per hole | **SPEC** (§2.3) |
| `fr_PickEyeProximity` | `GetHoles()`, `GetClosestHole`, `Holes.Edges` | **SPEC** (§2.3, §2.5; picks are Vector3 so the array branch is never hit) |
| `fr_PickMouthProximity` | plus `ReorderHole`, `Holes.length` | **SPEC** (`Holes.length` is always undefined, so the extra `GetHoles(1)` always runs; §2.4) |
| `fr_AddMouthInterior` | `ReorderHole`, `QuadrantIndices`, `QuadrantPoints`, `MajorAxisLength`, `Centroids`, `PointIndices` | **SPEC**, with the shared-record double reorder of §2.4 step 5 noted |
| `fr_AddEyeSocket` | `ReorderHole`, `FurthestPoints`, `OppositePoints`, `MajorAxisIndices`, `Centroids`, `PointIndices` | **SPEC** |

## 16. Open questions
- `fr_ToggleFaceLayout_Init` returns false; whether Softimage then treats the command as failed to initialise (and
  whether Ctrl+F still works) is not settled.
- `StoreShapeGoal`: confirm the script error on a new goal (missing colour argument) and the `Add ICE Node` test.
- `PlotFaceRobot`: `CreateCompound` with an undefined track; `StoreShapeKey` positional values (2, null, 1, 0, 3, 0)
  meaning.
- `fr_ImportAnimationRig`: `GetSkeleton` element order, the cluster filter path `Shape`, the ICE branch (B13e).
- `GetPrimStereoCamera`: the `StereoCameraRig` / `StereoCameraSecondaryRig` ICE compounds.
- JScript calls with other letter case than the command (`AddUserKeyWord`, `fr_fileread`) are assumed to reach the
  command (same behaviour).
- Whether a Softimage built-in `AddUserKeyword` exists and which one wins when Face Robot is loaded.

## 17. Corrections for the wire agent
- `src/commands/faceRobotModule.ts` `frHostShells` registers 26 of these names with `args: []` and a "plugin body LOCK"
  log (`fr_AddBlinkKeys`, the three AdjustPanelKeys commands, `StoreShapeGoal`, `fr_InitNeck`, `fr_InitNose`,
  `fr_GetPolymesh`, `fr_GetFRPolymesh`, `fr_CapAllHoles`, `PaintGameExport`, `ParseDNAFile`, `GetDNAFile`, `LogDNA`,
  `PlotGlobal`, `PlotFaceRobot`, `fr_StabilizeC3D`, `fr_GetKeyed_safe`, `AddUserKeyword`, `GetKeyed`, `GetKeyed2`,
  `FilterKeyed`, `SetControlKeys`, `MirrorControls`, `ImportAnimationRig`, `fr_ImportAnimationRig`,
  `fr_BuildEyesConstraint`). All are now contracted; arities are in §1–14 (e.g. `fr_GetPolymesh` 4, `fr_AddBlinkKeys`
  8, `StoreShapeGoal` 5, `fr_StabilizeC3D` 4, `PlotFaceRobot` 5).
- `fr_GetPolymesh` / `fr_GetFRPolymesh` are needed by the B18b preparation commands; they return a plain JScript
  helper object with the hole record of §2.3, and the helper is **cached across calls** (rebuilt only with
  `inOverride`).
- `fr_ToggleFaceLayout` stub flips a private flag between `Softimage Layout` and `Face Robot Layout`; the real one keys
  off the active layout's name, goes back to `fr_sget("Layout")` (else `Tools Development Environment`) and calls
  `fr_SwitchFaceLayout(stage/10)` when entering Face Robot. `fr_SetAltLayout` must store the active layout with
  `fr_sset("Layout", …)` and return it (the stub returns null).
- `src/commands/ui.ts` maps `GetPrimStereoCamera` to `GetPrim` Camera; the real command builds the three-camera rig,
  the `Stereo` property, keywords, ICE trees and the two constraint operators (§14) and takes `ObjName`
  (default `StereoCamera`).
- `src/commands/faceRobotB14deShared.ts` `getKeyed` stand-in matches case-insensitively over the whole scene; the
  shipped rule searches the given model's (default: face model) descendants, requires at least one keyword and uses the
  keyword collection lookup (§3).
- `AddUserKeyword` (FR) has args (`Obj`, `Key`) and appends with a leading comma when the object has no keywords; the
  scene-command version in `src/commands/uiGroupViewTasks.ts` uses other argument names.
- Several commands with return value on return nothing: `PlotGlobal`, `MirrorControls`, `SetControlKeys`,
  `AddUserKeyword`, `fr_AddBlinkKeys`, `PaintGameExport`, `fr_BuildEyesConstraint`, `fr_ToggleFaceLayout` and
  `StoreShapeGoal` (success path). `fr_InitNeck` / `fr_InitNose` return XSICollections, `PlotFaceRobot` and
  `fr_GetPolymesh` return JScript objects.
