# CMD-B18a: Face Robot `GeneralHelper.js` script commands (controls, poses, keys, retarget mute, pick points, envelope / pick-point storage, offset maps, paths, source healing, backup cleaning, log helpers)

Row: **CMD-B18a**. Status: **SPEC** for 30 commands, **SPEC-PARTIAL** for 6 (`fr_StorePP`, `fr_RestorePP`,
`fr_StoreEnvelope`, `fr_RestoreEnvelope`, `fr_ToCollection`, `fr_ObjectView`).
Run: 2026-11-20, si-analyst worker, unattended, batch 18
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (JScript plug-in, `language` JScript in `data/commands_full.json`, category `Custom` for every entry).
The source was read off the user's PC beforehand and read here in full.

| File (`FaceRobot\Application\Plugins\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `GeneralHelper.js` | 43772 | `293965de` | whole | 36 |

Plug-in registration (`XSILoadPlugin`): name `GeneralHelper`, author `Softimage Special Projects`; `Major` is assigned
twice (1, then 0), so the effective version is **0.x** (Minor left at its default). 36 `RegisterCommand` calls, each with
the command name equal to the scripting name; handler `<name>_Execute`. A commented-out helper that would set
`FACEROBOTROOT` from the plug-in's origin path is **not** active, so `FACEROBOTROOT` must come from elsewhere (inferred:
the Face Robot environment setup / FR.dll). `XSIUnloadPlugin` returns true.

File-level side effect: the script replaces `Array.prototype.push` with its own version that appends its arguments **up
to the first null/undefined argument** and returns the array (not the new length). It only affects this plug-in's
script engine; reimplementations need not model it except where noted.

Earlier contracts reused (referenced by name, not re-specified):
`cmd-b14a-fr-utilities-storage.md` (`fr_sget`, `fr_sindices`, `fr_GetFaceModel`, `fr_AddObjectInPlace`, store keys),
`cmd-b14d-fr-retarget-mocap.md` (`FaceRobot`, `fr_SwitchFaceLayout`, `fr_SaveFacePose`),
`cmd-b17e-animation-action-scripts.md` (`GetInputAndStoreAction`, LOCK), `cmd-b15-fr-pr189-answers.md` §7 (this file
answers its open "which script registers fr_GetFile / fr_GetPointsAsText / fr_ResetRetarget" question).

Store shorthand: `fr_sget(k)` = store (`_`, k); `fr_sget(s, k)` = store (s, k), as in B14a. "Face model (store)" =
`fr_sget("FaceModel")`; "face mesh (store)" = `fr_sget("meshes", "Mesh")`; "control keys" = `fr_sindices("controls")`;
"control k" = `fr_sget("controls", k)`. "Zero local pos/rot" = set local kinematics `posx, posy, posz, rotx, roty,
rotz` to 0 (scaling untouched).

Logging: `LogMessage` with no severity is siInfo. "NoLog" below = `SetFlag(siNoLogging, true)` in `_Init`.

## 1. Handler table

| Command | procedure | Status |
|---|---|---|
| `fr_FolderExists` | `fr_FolderExists_Execute` | SPEC |
| `fr_GetCentroid` | `fr_GetCentroid_Execute` | SPEC |
| `fr_GetFile` | `fr_GetFile_Execute` | SPEC |
| `fr_GetResolvedDNAPath` | `fr_GetResolvedDNAPath_Execute` | SPEC |
| `fr_GetGlobalPos` | `fr_GetGlobalPos_Execute` | SPEC |
| `fr_SetOffsetMap` | `fr_SetOffsetMap_Execute` | SPEC |
| `fr_SetOffsetMap2` | `fr_SetOffsetMap2_Execute` | SPEC |
| `fr_IsCollection` | `fr_IsCollection_Execute` | SPEC |
| `fr_ToCollection` | `fr_ToCollection_Execute` | SPEC-PARTIAL |
| `fr_KeyAllControls` | `fr_KeyAllControls_Execute` | SPEC |
| `fr_KeySelControls` | `fr_KeySelControls_Execute` | SPEC |
| `fr_ResetPaths` | `fr_ResetPaths_Execute` | SPEC |
| `fr_SelectAllControls` | `fr_SelectAllControls_Execute` | SPEC |
| `fr_GetControls` | `fr_GetControls_Execute` | SPEC |
| `fr_ObjectView` | `fr_ObjectView_Execute` | SPEC-PARTIAL |
| `fr_ResetSel` | `fr_ResetSel_Execute` | SPEC |
| `fr_ResetAll` | `fr_ResetAll_Execute` | SPEC |
| `fr_PoseAll` | `fr_PoseAll_Execute` | SPEC |
| `fr_PoseSel` | `fr_PoseSel_Execute` | SPEC |
| `fr_SetPickPoints` | `fr_SetPickPoints_Execute` | SPEC |
| `fr_GetPickPoints` | `fr_GetPickPoints_Execute` | SPEC |
| `fr_StoreEnvelope` | `fr_StoreEnvelope_Execute` | SPEC-PARTIAL |
| `fr_RestoreEnvelope` | `fr_RestoreEnvelope_Execute` | SPEC-PARTIAL |
| `fr_GetPointsAsText` | `fr_GetPointsAsText_Execute` | SPEC |
| `fr_StorePP` | `fr_StorePP_Execute` | SPEC-PARTIAL |
| `fr_RestorePP` | `fr_RestorePP_Execute` | SPEC-PARTIAL |
| `fr_ApplyType` | `fr_ApplyType_Execute` | SPEC |
| `fr_ResetRetarget` | `fr_ResetRetarget_Execute` | SPEC |
| `fr_IsRetargeted` | `fr_IsRetargeted_Execute` | SPEC |
| `CleanSources` | `CleanSources_Execute` | SPEC |
| `EmptyBackups` | `EmptyBackups_Execute` | SPEC |
| `logv` | `logv_Execute` | SPEC |
| `loga` | `loga_Execute` | SPEC |
| `logc` | `logc_Execute` | SPEC |
| `logt` | `logt_Execute` | SPEC |
| `suma` | `suma_Execute` | SPEC |

Registry facts common to all: every argument has flags 2 (siArgumentInput), no default, no handler
(`commands_full.json`). `_Init` adds `siDispatch` as the value type on: `fr_GetCentroid.inObj`,
`fr_SetOffsetMap.inVArray`, `fr_SetPickPoints.picks/vectors`, `logv.v`, `loga.a`, `logt.t`, `suma.a`. Return value
flag ("Ret") as registered is given per command; several Executes return nothing although Ret is on, and that is noted.

## 2. Wire contract: queries and conversions

### `fr_FolderExists` (SPEC)
Args `inPath`. Ret on, NoLog. Returns the `Scripting.FileSystemObject.FolderExists(inPath)` boolean. No side effects.

### `fr_GetFile` (SPEC; confirms B14a §2.2 use)
Args `inFileName`. Ret on, NoLog. Returns `XSIUtils.ResolvePath(BuildPath(<env FACEROBOTROOT>, "Application",
inFileName))`, i.e. `<FACEROBOTROOT>\Application\<inFileName>` with slashes converted to the platform separator. B14a's
localization load (`fr_GetFile("views\FR.en-us.txt")`) therefore reads `<FACEROBOTROOT>\Application\views\FR.en-us.txt`.
No existence check.

### `fr_GetResolvedDNAPath` (SPEC)
No args. Ret on, NoLog. Returns a string, "" by default.
1. Face model (store); its property `FaceState`; its parameter `DNA`. Any missing → "".
2. Value of `DNA`. If it starts with `$`: split on `XSIUtils.Slash`; if the first segment is longer than one character
   it is replaced by the environment variable named by that segment without the `$` (unset variable → whatever
   `Environment.Item` gives, inferred ""); segments rejoined with the slash. Otherwise returned unchanged.
Only a leading `$VAR` segment is expanded (e.g. `$FACEROBOTROOT\Data\FaceRobot\Dna\Human_Face_Symmetric.dna`, which
is what `fr_ApplyType` writes).

### `fr_GetGlobalPos` (SPEC)
Args `iobj`. Ret on, NoLog. A string is looked up with `ActiveSceneRoot.FindChild(name)` (recursive). Empty or not
found → returns **false**. Otherwise returns a new Vector3 = translation of the object's global transform.

### `fr_GetCentroid` (SPEC)
Args `inObj` (siDispatch). Ret on, NoLog. Returns a Vector3.
- `inObj` whose `ClassName` is `X3DObject`, `Model` or `Null`: take every point position of its active primitive
  geometry, map each to world space with the object's global transform, average them.
- `inObj` that is a JScript array (class `JScriptTypeInfo`, no `type` member, non-zero `length`) of Vector3s: average
  the vectors as given.
- Average = component sum scaled by 1/count.
Error: anything else (including an empty array, a collection, a `Null` without geometry) → the point list is undefined
and the script fails (inferred: JScript runtime error, command fails).

### `fr_IsCollection` (SPEC)
Args `c`, `log` (log unused). Ret on, NoLog.
- Empty / falsy → false.
- An object with `ClassName` `Object` → returned as is. `Selection` or `X3DObjectCollection` → a **new**
  `XSI.Collection` holding the same items is returned.
- Anything else (strings, numbers, single objects of other classes) → false.

### `fr_ToCollection` (SPEC-PARTIAL)
Args `inObj`. Ret on, NoLog. Returns an `XSI.Collection`.
1. If `fr_IsCollection(inObj)` is truthy → returns `inObj` itself (the original, not the copy that check made).
2. Else a new collection: `X3DObject` / `Model` / `Null` → that object added; `Group` (ClassName `Group`) → its
   members added; any other value → empty collection.
3. String: split on `,`, then passed to a helper `ArrayToCollection`, which is **not defined in this file** and is not a
   registered command (`commands_full.json`). Missing: whether it exists in the plug-in's global scope; as read, a
   string input raises a JScript "undefined" error (inferred).

### `fr_GetPointsAsText` (SPEC; same as B14e §fr_CrawlToVertex step 1, with one addition)
Args `Points` (ignored; overwritten with ""). Ret on (no NoLog flag, so logged).
- First selected item of type `pntSubComponent` → returns its `FullName` (e.g. `Model.Mesh.pnt[3,17,42]`).
- First selected item of type `polySubComponent` → runs `SelectAdjacent(null, "Point", false)` (the selection is
  **replaced** by the adjacent points) and returns the new first item's `FullName`.
- Otherwise (or nothing selected) → "".

## 3. Wire contract: control set, reset, keys, poses

### `fr_GetControls` (SPEC)
Args `toggle`. Ret on, NoLog. Face model via `fr_GetFaceModel(false)` (B14a). Returns all descendants of that model
(`FindChildren()`) passed through `SIFilter(…, "FaceRobotControl")`. When `toggle` is truthy and something is selected,
every selected item is removed from the result (i.e. "all controls except the selected ones"). No face model → script
error (inferred).

### `fr_SelectAllControls` (SPEC)
Args `toggle`. Ret off, logged. `SelectObj(fr_GetControls(toggle))`: selects all controls, or with toggle all
unselected controls (inverting the control selection). Selection replaced.

### `fr_ResetAll` (SPEC; consistent with B14d uses)
Args `token` (ignored). Ret off, logged. Face model via `fr_GetFaceModel(false)`; for every control key from
`fr_sindices("controls")`, `M.FindChild(<key>)` (the **key string is used as the object name**, the stored object is not
read); found → zero local pos/rot. Missing ones skipped silently.

### `fr_ResetSel` (SPEC)
Args `toggle`. Ret off, logged.
- toggle falsy: working set = a copy of the current selection list.
- toggle truthy: working set = `fr_GetControls(toggle)`: all face controls **not** selected (all of them when nothing
  is selected).
For each item that has a property named `FaceControl`: zero local pos/rot. Others ignored.

### `fr_KeyAllControls` (SPEC)
No args. Ret off, logged.
1. `Refresh()`.
2. Control keys from `fr_sindices("controls")`; null → stop.
3. Two unique `XSI.Collection`s: keyables, exclusions. For each key, control k (null → skip): each parameter from
   `TaggedParameters(siTag1, false)` is added to keyables. Its full name is split on `.`; if the second segment (the
   object name) is longer than 14 characters and ends with `_ControlOffset`, the name with that segment shortened by its
   last 6 characters (`…_ControlOffset` → `…_Control`) is added to exclusions.
4. If keyables is non-empty: every exclusion is removed from keyables (a control's parameter is not keyed when a
   same-named `<name>_ControlOffset` object, i.e. a mocap offset parent, carries that tagged parameter).
5. `Dictionary.GetObject("PlayControl")`: found → `SaveKey(keyables, round(PlayControl.Key))`; else `SaveKey(keyables)`.

### `fr_KeySelControls` (SPEC)
No args. Ret off, logged. Same as `fr_KeyAllControls` except step 2–3 iterate the selection list, skipping items with no
`FaceControl` property, and add tagged parameters by full name.

### `fr_PoseAll` (SPEC)
No args. Ret off, logged.
1. Face model via `fr_GetFaceModel(false)`; control keys; preference `Face Robot.Use_Mixer_Poses`.
2. Collect full names of the siTag1 tagged parameters of every control k (null skipped).
3. Nothing collected → nothing happens. Else `Use_Mixer_Poses` false → `fr_SaveFacePose()` with no arguments (B14d);
   true → `GetInputAndStoreAction(<face model>, <names joined with ",">, 1, "FacePose")` (B17e, LOCK).

### `fr_PoseSel` (SPEC)
Args `filename`. Ret off, logged.
1. Face model, preference as above; selection list and `SIFilter(selection, "FaceRobotControl")`.
2. Selection empty or no control in it → log (siError) `no controls found to save pose`, stop.
3. `Use_Mixer_Poses` false → `fr_SaveFacePose(true, filename)`. True → tagged-parameter names of the filtered controls;
   when any, `GetInputAndStoreAction(<face model>, <names>, 1, "FacePose")` (filename unused).

## 4. Wire contract: retargeting

Retarget operator types (list used by both commands): `fro_FaceRetargetLocalOp` (listed twice), `fro_FaceRetargetOp2`,
`fro_FaceRetargetCompensateOp`, `fro_FaceRetargetHeadNullOp`.

Control gathering (helper, shared):
- With a control given: {control, its parent}, plus `JawEnd_ControlProxy` (found under the face model (store)) when
  the control's name contains `Jaw`.
- Without: control keys (if `fr_sindices` throws, run `FaceRobot()` and retry once, errors swallowed); for each key,
  control k and its parent; **any missing control makes the whole result null**; finally `JawEnd_ControlProxy` if found.

### `fr_IsRetargeted` (SPEC)
Args `control`. Ret on, NoLog.
1. Gather (with control). Null → run `FaceRobot()` (B14d, no args), gather all; still null → log `Retargeting Controls
   Not Found`, return null.
2. For each gathered object, scan its local-kinematics nested objects from last to first; any of the listed types →
   return true. None → false.

### `fr_ResetRetarget` (SPEC; consistent with B14a fr_MuteSources use)
Args `mute`. Ret off, logged.
1. Gather all (no control); null → `FaceRobot()`, retry; null → log `Retargeting Controls Not Found`, stop.
2. Per object: the last retarget operator in its local-kinematics nested objects gets parameter `mute` = `mute`; when
   mute is truthy the object's pos/rot (x, y, z) are zeroed. Only that one operator per object is touched.
3. After the loop, mute truthy → run `fr_ResetAll`.

## 5. Wire contract: pick points

### `fr_SetPickPoints` (SPEC)
Args `picks` (array of names, siDispatch), `vectors` (flat array x,y,z per pick, siDispatch), `rad`. Ret off, logged.
For i = 0 … len(picks)−1: `fr_AddObjectInPlace("Sphere", 0, fr_sget("PickPoints"), rad, (vectors[3i], vectors[3i+1],
vectors[3i+2]), picks[i], 891, false)` (B14a). Positions are those written by `fr_GetPickPoints` (global).

### `fr_GetPickPoints` (SPEC)
No args. Ret off, logged. Parent = `fr_sget("PickPoints")`; its descendants (`FindChildren`). The first one's `radius`
value is the radius (no pick points → script error). Logs (info) one message made of these lines:
an empty first line; `var rad = <radius>`; `var picks = ["<n0>","<n1>",…];`; `var vectors = [<x0>,<y0>,<z0>,…]`
(global translations, JScript number formatting); `fr_SetPickPoints(picks,vectors,rad);`. Nothing is returned or
changed; the logged text is a replay script for `fr_SetPickPoints`.

### `fr_StorePP` (SPEC-PARTIAL)
Args `model`, `mesh`. Ret on but nothing returned.
1. model empty → face model (store); mesh empty → face mesh (store), then the model.
2. Pick-point parent = the model's child `PickPoints`, else the model. Its descendants; none → stop.
3. Builds a text blob (lines in this order): `radius =<r>;` (r = first pick point's `radius` parameter value if it has
   one, else `1.0`); `color = <first pick point's display.wirecol>;`; `var names = ['<n0>','<n1>',…];` (single quotes, no
   escaping); `var positions = [x0,y0,z0,…];` (the pick points' `posx/posy/posz`, inferred local); the full source text
   of the file's private helper `pickpoints` (JScript function text); finally a call line
   `pickpoints(null,names,positions,radius,color);`.
4. `mesh.AddProperty("UserDataBlob", false, "pickedpoints")`, value = the text. (Inferred: an existing blob is not
   replaced; Softimage gives the new one a numbered name.)
Missing: the exact bytes of the embedded helper source are deliberately not reproduced here (clean-room rule); see the
helper's behaviour under `fr_RestorePP`. A reimplementation that must read real scenes should parse the data lines.

### `fr_RestorePP` (SPEC-PARTIAL)
Args `ppblob`. Ret on.
1. ppblob empty: mesh = face mesh (store), else the first selected item when it is a `polymsh`; ppblob = its property
   `pickedpoints`. Still empty and the first selected item is a `UserDataBlob` → that blob. None → return **false**.
2. Evaluates the blob's value as JScript (so any blob text runs). For a blob written by `fr_StorePP` the embedded helper
   does: model = face model (store); parent = its child `PickPoints` or the model; radius default 1; no names → stop
   (false); per name, `fr_AddObjectInPlace("Sphere", null, parent, radius, (positions triple), name, color)`; then runs
   `FaceRobot()` with no args. Returns nothing (undefined).
A non-object ppblob (e.g. a string) has no `.value`; evaluating undefined is a no-op (inferred).
Missing: same as fr_StorePP (exact embedded text); an evaluator-free reimplementation is an interpretation.

## 6. Wire contract: envelope storage

### `fr_StoreEnvelope` (SPEC-PARTIAL)
Args `Mesh`, `EnvName`. Ret on.
1. Mesh empty → face mesh (store) → first selected item; none → log `No mesh found ` (trailing space), return nothing.
2. EnvName empty → `StoredEnvelope`.
3. `envelopop` in the active primitive's construction history; none → log `<Mesh.FullName> has no envelope`, return.
4. Envelope-weights cluster property = target of the first input port whose target type is `envweights` (if none
   match, the last port's target is used as read).
5. Its `Elements.Array` flattened to a 1-D list; `Mesh.AddProperty("UserDataBlob", false, EnvName)`; blob value = that
   list (inferred: stored as the comma-joined string of the numbers, which is what `fr_RestoreEnvelope` splits).
6. Returns the blob.
Missing: the exact string conversion of a JScript array into the blob value and the flattening order of the 2-D weight
array (inferred: deformer index fastest).

### `fr_RestoreEnvelope` (SPEC-PARTIAL)
Args `StoredEnvelope`, `Mesh`. Ret off.
Candidate names: `SoftEnvelope`, `RigidEnvelope`, `StoredEnvelope` (indices 0, 1, 2).
1. StoredEnvelope empty and first selected item is a `UserDataBlob` → it, and Mesh = its parent 3D object.
2. Mesh empty and first selected item is a `polymsh` → it (and its name is logged, info).
3. Mesh still empty → face mesh (store).
4. With a mesh and StoredEnvelope not an object: a number below 3 → the mesh property with that candidate name; a
   string → the mesh property of that name; still nothing → the first existing of the three candidates.
5. Mesh missing or not `polymsh` → log `no valid mesh found `, stop. Blob missing or not `UserDataBlob` → log `no valid
   envelope storage property found`, stop. No `envelopop` → log `<FullName> has no envelope`, stop.
6. Same port search as above; the weights cluster's `Elements.Array` = blob value split on `,` (strings).
Missing: as fr_StoreEnvelope; also whether Softimage accepts the flat string list for a 2-D array (inferred yes, it is
how the tool is used). A blob given as an object on another mesh is not checked against Mesh.

## 7. Wire contract: offset maps

### `fr_SetOffsetMap` (SPEC)
Args `inCls` (cluster), `inVArray` (siDispatch JScript array), `inBaseName`, `inR`, `inG`, `inB`. Ret on, NoLog.
- First element a Vector3 (`ClassName` `ISIVector3`): three weight maps are created with
  `CreateWeightMap("WeightMap", inCls, <base>+"X" / "Y" / "Z", "Weight Map Property", false)` (first returned item
  each); for each map the current element array is read, its first N entries overwritten with the x / y / z components
  of the N vectors, and written back. Returns a JScript object with members `x`, `y`, `z` (the three maps). Colours
  are not used.
- First element a number: defaults `inR` 0, `inG` 255, `inB` 255, applied only when the argument is null/undefined (0,
  "" and false are kept). One map `CreateWeightMap("WeightMap", inCls, inBaseName, "Weight Map Property", false)`;
  its `red`, `green`, `blue` parameters set; element array = inVArray. Returns that map.
- Anything else (including an empty array): log (siError) a three-line message, `Attempt to save offset map failed`,
  then tab-indented `Cluster: <inCls.FullName>` and `MapNames: <inBaseName>` (message starts with a newline). Returns
  null.

### `fr_SetOffsetMap2` (SPEC)
Same as `fr_SetOffsetMap`; the second argument (registered as `inVarray`, no siDispatch) is a SAFEARRAY (VB / C++
callers), converted to a JScript array first. Result passed through.

## 8. Wire contract: layout, DNA type, preference paths

### `fr_ObjectView` (SPEC-PARTIAL)
Args `vname` (empty → `Sculpt`). Ret on, nothing returned; logged.
- A view named vname exists in the active layout → its state = siNormal; camera of `GetViewCamera(4)`; its property
  `Camera Display`: `headlight` true, `wireontopunsel` true, `wireframeopacity` 0.2.
- Else `CreateView("Object View", vname)`, moved to (5, 5), view attributes `displaymode` = `shaded`, `lockstatus` =
  `true`.
Missing: which viewport `GetViewCamera(4)` designates (inferred viewport D); the camera tweak is not applied to the
object view itself.

### `fr_ApplyType` (SPEC)
Args `dnaindex`. Ret on but nothing returned.
1. Face model (store) → `FaceState` → `DNA`; any missing → stop.
2. Index: falsy → 0; greater than 2 → 1; otherwise used as given (so 2 or a negative number index past the list;
   inferred the path then ends in `undefined`).
3. DNA files: 0 `Human_Face_Symmetric.dna`, 1 `Human_Face_Asymmetric.dna`. `DNA` = `BuildPath("$FACEROBOTROOT", "Data",
   "FaceRobot", "Dna", <file>)` (the `$FACEROBOTROOT` token kept literally).
4. Runs `fr_Diagnose` (PreparationTools.js; no contract yet).

### `fr_ResetPaths` (SPEC)
Args `token` (ignored). Ret on, returns true. NoLog.
1. Face model (store) → `FaceState.Stage1Tab1`: set to 1 then back to its previous value (inferred: forces a UI
   refresh). No face model → script error before any preference changes.
2. `fr_SwitchFaceLayout()` with no argument (B14d).
3. Preferences `Face Robot`: `Head_Path` = `$FACEROBOTDATAROOT\Face\`, `Parts_Path` = `…\Parts\`, `Actor_Path` =
   `…\Actors\`, `Dna_Path` = `…\Dna\`, `Ani_Path` = `…\FaceAni\`, `Pose_Path` = `…\FacePose\` (separator =
   `XSIUtils.Slash`, trailing separator included, `$FACEROBOTDATAROOT` literal). `Custom_Path` untouched.

## 9. Wire contract: image-source healing and backup cleaning

### `CleanSources` (SPEC)
Args `Action`. Ret on but nothing returned; logged.
1. Sources = the first nested object of the active scene's `Sources` container (inferred: the image sources folder),
   then its nested objects. Project path P = active project path.
2. For each source: its `FileName` value is always prefixed with `P\` (the "already absolute" test is always true, so
   absolute paths get prefixed as well; see corrections). File missing → log (siError) `File Path Not Found :<path>` and
   repair; found → log `File Path Found :<source>`.
3. Repair: Action negative → log (siError) `   Deleting ` and `DeleteObj(source)`. Action empty/0 → 51. Bits are
   decoded by subtracting 32, 16, then (only while the search list is still empty) 8, 4, 2, 1:

| Bit | Meaning |
|---|---|
| 32 | delete the source if not found |
| 16 | localize: copy the found file into `P\Pictures\` |
| 8 | user paths (no-op) |
| 4 | scan every drive for folders named `Pictures` (see GetProjects below) |
| 2 | linked projects: `<user path>\Data\default.xsiprojects`, lines not starting with `/`, split on `,`; with 2+ fields, `<field0>\Pictures` added recursively |
| 1 | active project's `P\Pictures`, recursively |

   The search list is built once and reused for later sources (rebuilt only while empty). Recursive add: a folder that
   does not exist is skipped; the folder and every subfolder are appended (subfolders appear twice: once from the
   parent, once from their own recursion); a counter past 99 logs `amok` and stops that branch.
4. Heal: basename = last segment of `FileName` (split on the slash). Search list from last to first; first
   `<folder>\<basename>` that exists: localize → copy it to `P\Pictures\<basename>` and set `FileName` =
   `Pictures\<basename>`; else `FileName` = the found path. Log `File <basename> successfully healed`. None found →
   log (siError) `File <basename> NOT FOUND IN SEARCH:`; with bit 32 also (siError) `       DELETING` and `DeleteObj`.

GetProjects (bit 4; also used by EmptyBackups): drive roots `<letter>:\` of every FSO drive; progress bar caption
`Scaning Folders` (sic), maximum = depth limit (default 8), visible, cancel enabled. Breadth-first by level: status text
`Folder <path>` per folder; subfolders named exactly the target name are logged (`<parent>\<name>`) and collected (not
descended into); subfolders named `WINDOWS` are skipped; all others form the next level. Cancel → stop. After each level:
increment, log `\n Folder depth: <level>` and `<level> <current level list>`; when the level counter reaches the maximum
→ log (siError) `Scan Stopped at <max> folders depth, to enable deeper scan, edit 'EmptyBackups' plugin, change
'pb.Maximum =' to higher number` and stop (levels 0…max are scanned). Matching is case-sensitive.

### `EmptyBackups` (SPEC)
Args `maxdepth` (empty → 8), `foldername` (empty → `Backup`), `list` (empty → false). Ret off; logged. Destructive.
1. GetProjects for folders named foldername with depth maxdepth.
2. Confirmation: `CustomProperty` `EmptyBackups` on the scene root with one boolean per found folder (name = the
   folder path, default true, not animatable); modal `InspectObj`. OK → the folders whose box is still ticked (matched
   by position); cancel → log (siError) `Cancelled Command: No Backups were deleted !`, empty list. Property deleted.
3. Log `Resolved <n> <paths joined with ",">`, then `Deleting: ` (list false) or `Found Files: ` (list true).
4. Per folder: each file, then each subfolder: log `\t<name>`, add its size, delete it (forced) unless list; count
   files and folders. The backup folder itself is kept.
5. When not list: log `<d>  folders deleted`, `<c>  files deleted`, `<bytes>  bites deleted` (two spaces; "bites" sic).
The list mode still shows the dialog. The scene's sources are read but unused.

## 10. Wire contract: log and math helpers (all NoLog, no undo impact)

| Command | Args | Ret | Behaviour |
|---|---|---|---|
| `logv` | `v` (siDispatch Vector3), `s` | off | Logs `<s>\t [<x>,<y>,<z>]` (s default ""). |
| `loga` | `a` (siDispatch array), `s` | off | Logs `<s> [`, then one `\t<item>` per element, then ` ]`. |
| `logc` | `c`, `s`, `a` | off | c empty → c = global selection **and** s = `Current Selection:`. s non-empty → logged. Then `(`; per item, by the first letter of a (lower-cased, string only): `t` → `\ta<item>\t\t<type>` (literal `a` prefix, sic), `c` → `\t<item>\t\t<ClassName>`, `n` → `\t<name>`, otherwise `\t<item>`; then ` )`. |
| `logt` | `t` (siDispatch transformation), `s` | off | s non-empty → `Transformation <s>`; then `logv` lines labelled `Translation: `, `Rotation: ` (XYZ Euler angles in degrees), `Scaling: `. |
| `suma` | `a` (siDispatch array), `log` | on | Returns the `+`-sum of the elements from 0 (strings concatenate per JScript rules); log truthy → the sum is logged. `_Init` passes `false` as the flags of `log`; the registry still shows flags 2. |

## 11. Open questions
- `ArrayToCollection` (used by `fr_ToCollection` for strings) is defined nowhere in this file or the command registry.
- `GetViewCamera(4)` viewport identity.
- Blob value format written by `fr_StoreEnvelope` (array → string conversion, 2-D flattening order).
- `fr_Diagnose` (PreparationTools.js) has no contract; `GetInputAndStoreAction` is LOCK (B17e).
- Where `FACEROBOTROOT` / `FACEROBOTDATAROOT` are set (the in-file setter is commented out).

## 12. Corrections for the wire agent
- `src/commands/faceRobotModule.ts` registers all 35 non-`fr_ObjectView` names as `frHostShells` with `args: []`,
  returning null and logging "plugin body LOCK". They now have contracts; args (names above, no defaults) and return
  values must follow §1–10.
- `fr_ObjectView` shell: vname empty means `Sculpt`; the body is specified in §8.
- `fr_GetFile` is specified (§2): `src/commands/faceRobotB14a.ts` can resolve `views\FR.en-us.txt` instead of logging
  NYA.
- B14e stand-in for `fr_GetPointsAsText` (`faceRobotB14e.ts`) matches for point selections but must also convert a
  polygon selection to its points (and replace the selection), and return "" otherwise.
- B15 §7: the script registering `fr_GetFile`, `fr_GetPointsAsText`, `fr_ResetRetarget` is
  `FaceRobot\Application\Plugins\GeneralHelper.js`.
- `CleanSources` prefixes every `FileName` with the project path, including absolute ones (source bug; keep it for
  fidelity).
- Several commands with Ret on return nothing: `fr_ObjectView`, `fr_ApplyType`, `fr_StorePP`, `CleanSources`;
  `fr_GetGlobalPos` returns false (not null) on a miss; `fr_RestorePP` returns false when no blob is found.
