# CMD-B18c: Face Robot lip-sync / viseme and tongue script commands (`LipSynch.js`, `Tongue.js`)

Row: **CMD-B18c**. Status: **SPEC** for 18 commands, **SPEC-PARTIAL** for 2 (`fr_PrepareForPhonemes`, `GetTongueScale`).
Run: 2026-11-20, si-analyst worker, unattended, batch 18
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (JScript plug-ins in `FaceRobot\Application\Plugins\`, registered by `XSILoadPlugin` with
`RegisterCommand(name, name)`, so each handler is `<name>_Init` / `<name>_Execute`). Both files were read whole from the
copy taken off the user's PC.

| File (`FaceRobot\Application\Plugins\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `LipSynch.js` | 54570 | `770b5068` | whole | 10 |
| `Tongue.js` | 28216 | `d765dbf8` | whole | 10 |

Plug-in identity: `LipSynch.js` registers as Name `Lipsynch`, Author `Softimage`, version 1.0, plus custom properties
`fr_LipSync` and `fr_Visemes`. `Tongue.js` registers as Name `Tongue`, Author `Autodesk`, version 1.0, plus custom
property `TongueSetup`. Both files define `_Init`/`_Execute` pairs that are **not registered** and therefore are not
commands: `fr_GetCompleteCluster`, `GetUniqueGroup` (Tongue.js). Both files replace `Array.prototype.push` with a version
that stops at the first `null`/`undefined` argument (only matters for the helpers below).

Earlier contracts used (referenced as "same as"):
`cmd-b14a-fr-utilities-storage.md` (`fr_sget`, `fr_GetFaceModel`), `cmd-b14e-fr-export-weights.md` (`fr_FitTongue`,
`fr_SolveTongue`), `cmd-b14c-fr-eyes-jaw-regions.md` (`fr_RemoveTongue`), `cmd-b14d-fr-retarget-mocap.md`
(`fr_SaveFacePose`, `fr_ApplyFacePose`), `cmd-b11f-action-speech-shape-effects-binary.md` (`StoreViseme`,
`CreateSpeechAction`), `cmd-b9d-phonemeui-speech-binary.md` (`ExtractPhonemesToSpeechOp[Japanese]`),
`cmd-b15d-clips-sources.md` / `cmd-10a-mixer-action-scripts.md` (`ImportAudio`, `AddAudioClip`, `AddClip`, `AddTrack`),
`cmd-b15f-misc-scripts.md` (`GenerateLipSync`, the same speech-clip recipe). `GetKeyed`, `AddUserKeyword`,
`SetControlKeys` are `Utilities.js` script commands without a contract yet (Open questions).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `fr_ImportSpeech` | LipSynch.js | `fr_ImportSpeech_Execute` | SPEC |
| `fr_LoadVisemePose` | LipSynch.js | `fr_LoadVisemePose_Execute` | SPEC |
| `fr_SaveVisemePose` | LipSynch.js | `fr_SaveVisemePose_Execute` | SPEC |
| `fr_CopyVisemeLibrary` | LipSynch.js | `fr_CopyVisemeLibrary_Execute` | SPEC |
| `fr_CreateVisemeVariation` | LipSynch.js | `fr_CreateVisemeVariation_Execute` | SPEC |
| `fr_CreateVisemeShape` | LipSynch.js | `fr_CreateVisemeShape_Execute` | SPEC |
| `fr_ImportVisemes` | LipSynch.js | `fr_ImportVisemes_Execute` | SPEC |
| `fr_PrepareForPhonemes` | LipSynch.js | `fr_PrepareForPhonemes_Execute` | SPEC-PARTIAL |
| `fr_EditVisemes` | LipSynch.js | `fr_EditVisemes_Execute` | SPEC |
| `fr_AddLipSync` | LipSynch.js | `fr_AddLipSync_Execute` | SPEC |
| `AddToGroup_tongue` | Tongue.js | `AddToGroup_tongue_Execute` | SPEC |
| `GetCompounds_tongue` | Tongue.js | `GetCompounds_tongue_Execute` | SPEC |
| `fr_SetupTongueMaps` | Tongue.js | `fr_SetupTongueMaps_Execute` | SPEC |
| `fr_BuildTongueAfterSolve` | Tongue.js | `fr_BuildTongueAfterSolve_Execute` | SPEC |
| `fr_ScaleTongueMesh` | Tongue.js | `fr_ScaleTongueMesh_Execute` | SPEC |
| `fr_IsHeadMesh` | Tongue.js | `fr_IsHeadMesh_Execute` | SPEC |
| `GetTongueMarkers` | Tongue.js | `GetTongueMarkers_Execute` | SPEC |
| `fr_FitTongueAfterSolveStage` | Tongue.js | `fr_FitTongueAfterSolveStage_Execute` | SPEC |
| `fr_SolveTongueAfterSolveStage` | Tongue.js | `fr_SolveTongueAfterSolveStage_Execute` | SPEC |
| `GetTongueScale` | Tongue.js | `GetTongueScale_Execute` | SPEC-PARTIAL |

All 20 are category `Custom`, language JScript, description "", key-assignable; the registry shows return value enabled
for all. Every argument is added as a plain input with no default except `fr_ImportSpeech.SilenceDuration` (siInt4, 10).
A procedure that ends without returning gives Empty.

## 2. Shared helpers (both files have their own copies; behaviour is the same unless noted)

| Helper | Behaviour |
|---|---|
| Face-model lookup | Runs `fr_GetFaceModel()` (no argument, so MakeFaceModel false; same as B14a). If the call **throws**, logs (siError) `Face Robot FR.dll Failed to load properly. Command("fr_GetFaceModel") was not recognized!`, then uses the scene-root child model `Face`, creating an empty model `Face` under the scene root when there is none. An empty return (no throw) is used as is. |
| Get-or-add property | Property of that name on the parent if present, else `Parent.AddProperty(name)` (the plug-in's own custom property). When asked to inspect: `InspectObj(prop, , , siLock)`. Returns the property. |
| Face Robot folder | Base = env `FACEROBOTROOT` (root 0), `FACEROBOTDATAROOT` (root 1), or the absolute path of `FACEROBOTDATAROOT\..` (root 2); path = base + slash + subfolder. If the folder is missing: with "make" it is created (failure logs (siError) TAB + `<path> could not be made`, result ""), without "make" it logs (siError) TAB + `<path> Folder not found` and the result is "". A non-empty result always ends with a slash. |
| Face mesh lookup (LipSynch) | First `GetKeyed(["Face","Mesh"], model)` item; else the model child named by `FaceConnections.Mesh` when that child is a `polymsh`; else `fr_sget("meshes","Mesh")` (same as B14a). |
| All controls (LipSynch) | Collection of `GetKeyed(["Tongue","Control"])`, then `GetKeyed(["Jaw","End","Control"])`, then `GetKeyed(["Mouth","Control"])` (no model argument). |
| Text file read (LipSynch) | Missing file → (siError) `File <f> Not found`, null; otherwise `XSIUtils.ReadTextFile`; an exception → (siError) `Error Reading File <f>`, null. |
| Text file write (LipSynch, PPG only) | `XSIUtils.WriteUTF16TextFile`; an exception → (siError) `Error Writing File <f>`. |
| Language file parse (LipSynch) | See §3.0. |

## 3. Wire contract, LipSynch.js

### 3.0 Viseme library on disk (facts, from the code paths)

| Item | Layout |
|---|---|
| Library root | Folder; factory one = `FACEROBOTDATAROOT\Viseme` (created if missing when the `fr_Visemes` property is defined). |
| Language file | `<Library>\<Language>.csv` (every `*.csv` directly in the root is a language; list sorted). |
| Language folder | `<Library>\<Language>\` (the csv path without its extension). |
| Variation | Each sub-folder of the language folder (sorted); default name `Normal`. |
| Viseme pose | `<Library>\<Language>\<Variation>\<ipa>_<name>.frpre`; a file counts when the text after its last `.` is exactly `frpre`. Pose content is written/read by `fr_SaveFacePose` / `fr_ApplyFacePose` (B14d; layout unknown there). |
| Language csv | Text split on LF. Lines whose first character is space, TAB or `#` are skipped. Each other line is split on `,`; lines with fewer than 2 fields are skipped. Fields: 1 IPA code (e.g. hex form `0x…`), 2 phoneme name, 3 sound example, 4 phoneme type (integer, parsed leniently: leading digits). CR is not stripped, so the last field may carry a trailing CR (harmless for the integer parse). Display label in the PPG: `<name>  ("<sound>")  <ipa>` with every `0x` followed by zeros collapsed to `0x`. Unreadable file → (siError) `File <<f>> is invalid` (the file name between `<` `>`), parse result null. |
| Corrective shape name | `_<Phoneme>_<PhonemeName>_<Variation>_Shape`. |
| Viseme action source name | `_<pose file name without extension>_<Variation>`, stored under the mixer's `Sources` › `Viseme` folder. |

### `fr_ImportSpeech` (SPEC)
Purpose: builds a lip-sync speech clip from an audio file and a transcript on the Face Robot face. Same recipe as
`GenerateLipSync` in B15f, with these differences: the clip offset is the `Offset` argument, the speech action comes
from `CreateSpeechAction`, and the action (not the clip) is returned.
Args: `AudioFileName`, `TextFileName`, `Offset` (frame; used for both clips and the extractor), `Language` (number:
> 0 selects Japanese), `SilenceDuration` (siInt4, default 10). Returns the speech action source, or null on failure.
1. Face model (§2).
2. Both file names non-empty and both files present, else (siError) `ImportSpeech: invalid audio/text files`, return null.
3. Face mesh = first `GetKeyed(["Face","Mesh"], model)`; when none, the face mesh lookup of §2, and then
   `AddUserKeyword(mesh, "Face,Mesh")`; still none → (siError) `ImportSpeech: no face mesh found`, return null.
4. Progress bar: Maximum 4, Step 1, visible, cancel disabled, caption `Create Speech Clip`. Each later stage increments
   it and sets the status text (`Import Audio`, `Add Speech Clip`, `Recognizing Phonemes`).
5. `ImportAudio(model, AudioFileName)` → audio source; failure → (siError) `ImportSpeech: import audio file failed`,
   bar hidden, return null.
6. Track set: mixer of the model (added with `AddMixer` if missing); `AddTrack(model, <mixer full name>, 0,
   "Phoneme_Speech")` with `SetUserKeyword` `Phoneme,Speech`, then `AddTrack(…, 2, "Phoneme_Audio")` with
   `Phoneme,Audio` (types 0 = animation, 2 = audio).
7. `AddAudioClip(model, audio source, , <audio track>, Offset)`. From its time control: s = round(`startoffset`),
   in = round(`clipin`) + s, out = round(`clipout`) + s. `SetValue PlayControl.Out = out`, then `PlayControl.In = in − 1`.
8. `CreateSpeechAction(face mesh)` (default name `SpeechAction`); failure → (siError)
   `ImportSpeech: unable to create speech action`, `DeleteObj` track set and audio source, bar hidden, return null.
9. `AddClip(model, action, , <speech track>, Offset)`; `SetValue <clip>.actionclip.timectrl.clipin = in` and
   `.clipout = out`.
10. Transcript read (§2), every `;` replaced by a space; then `ExtractPhonemesToSpeechOpJapanese` when Language > 0,
    else `ExtractPhonemesToSpeechOp`, with (clip, AudioFileName, text, Offset, SilenceDuration) (B9d); then
    `AddClipRelation([speech clip, audio clip], same collection)`. Any exception in this step (including an unreadable
    transcript) → (siError) `ImportSpeech: phoneme recognition failed`, `DeleteObj` track set, action and audio source,
    bar hidden, return null.
11. Bar hidden; return the speech action.

### `fr_LoadVisemePose` (SPEC)
Args: `FileName`. Missing file → (siError) `Pose "<FileName>" not found`, return null. Otherwise returns
`fr_ApplyFacePose(FileName)` (selectOnApplication left at its default; same as B14d).

### `fr_SaveVisemePose` (SPEC)
Args: `FileName`. Selects all controls (§2, `SelectObj`, so the selection is replaced), then
`fr_SaveFacePose(true, FileName)` (selection only; same as B14d). Returns Empty. No existence or overwrite check.

### `fr_CopyVisemeLibrary` (SPEC)
Args: `From`, `To` (library folders), `Overwrite`, `CopyVisemes` (truthy/falsy). Always returns null.
1. `From` folder missing → (siError) `Source library "<From>" does not exist`, stop.
2. `To` null → (siError) `No destination library specified.`, stop.
3. `To` folder missing → create it; failure → (siError) `Unable to create destination library "<To>"`, stop.
4. `From` equal to `To` (exact string compare, after step 3) → (siError) `Source and destination is the same directory`, stop.
5. Language files (`*.csv` in From, sorted); none → (siError) `No language files found under "<From>"`, stop.
6. Per language file (an error skips to the next language):
   - Copy `From\<x>.csv` to `To\<x>.csv` when Overwrite or the target is missing, then clear the target's read-only
     attribute. Failure → (siError) `Unable to copy language file"<x>.csv"` (no space before the quote).
   - Source language folder `From\<x>` missing → (siError) `Missing source language directory "<dir>"`.
   - Create `To\<x>` if missing; failure → (siError) `Unable to create destination language directory "<dir>"`.
   - CopyVisemes falsy: only create `To\<x>\Normal` if missing (failure → (siError) `Unable to create variation folder "<f>"`).
   - CopyVisemes truthy: for each sub-folder of the source language folder, create the same-named folder (same error),
     then copy every `.frpre` file in it when Overwrite or the target is missing, clearing read-only. A failed copy logs
     (siError) `Unable to copy viseme file"<source path>"` and continues with the next file; a failed folder skips that
     variation. Non-`.frpre` files are not copied.

### `fr_CreateVisemeVariation` (SPEC)
Args: `Variation` (full folder path of the new variation), `CopyFrom` (full folder path or empty). Returns null.
1. `Variation` folder exists → (siError) `Variation folder "<Variation>" already exists`, stop.
2. CopyFrom given and missing → (siError) `Based on variation folder "<CopyFrom>" not found`, stop.
3. Create the folder; failure → (siError) `Unable to create variation directory "<Variation>"`, stop.
4. CopyFrom given: copy each `.frpre` file into the new folder (always overwriting), clearing read-only; failure →
   (siError) `Unable to copy viseme file"<source path>"`, next file.

### `fr_CreateVisemeShape` (SPEC)
Args: `ShapeName`. Returns null.
1. Does nothing when ShapeName is empty or the shape exists. "Exists" = the face mesh (§2, on the face model) resolves
   `<mesh>.polymsh.cls.*.<ShapeName>` to at least one object.
2. Otherwise `StoreShapeKey(face mesh, ShapeName, siShapeLocalReferenceMode, , , , siShapeContentSecondaryShape, true)`.
   A result → `SetValue <mesh>.clustershapecombiner.ShowResult = false`, then `<mesh>.clustershapecombiner.SoloIndex = 1`.
   No result → (siError) `Failed to create corrective shape : <ShapeName>`.

### `fr_ImportVisemes` (SPEC)
Args: `Library` (the **language folder** `<root>\<Language>`), `Variation` (name, or empty for all), `Overwrite`.
Returns null.
1. Face model (§2). Existing viseme sources = nested objects of the mixer's `Sources` › `Viseme` (empty when the model
   has no mixer).
2. Variations = [Variation] or every sub-folder of Library (sorted).
3. Phoneme table = parse of `<Library>.csv` (§3.0).
4. Controls (§2); parameter list = `posx, posy, posz, rotx, roty, rotz` of each control (per control, in that order);
   `ResetTransform(<controls>, siObj, siSRT, siXYZ)`.
5. For each variation folder, each `.frpre` file: IPA = file name up to the first `_`; type = field 4 of the first
   phoneme-table row whose IPA matches.
   - No matching row, or the type is not a number ≥ 0 → (siWarning) `Viseme "<file path>" not found in language file - ignoring`.
   - Otherwise source name `_<file without extension>_<variation>`. When Overwrite or no such source exists:
     `fr_ApplyFacePose(<file path>)` (any exception ignored), `DeleteObj` the old source if any,
     `StoreViseme(model, <parameter list>, <source name>, <type>)` (B11f), then `ResetTransform` as in step 4.
   Existing sources with Overwrite false are left alone (no message).
6. A missing variation folder makes the folder enumeration throw, which ends the command with a script error (inferred).

### `fr_PrepareForPhonemes` (SPEC-PARTIAL)
No args. Steps in order: `SetValue preferences.scripting.cmdlog = false` (never restored); `SetControlKeys()`
(Utilities.js); `SetValue Views.ViewB.UserCamera.camvis.attrseluserkeywords = true`; `GetTongueMarkers()` (§4, may
create the four `Tongue*` nulls under `Fit`); then a call to `AddTongue(null, <markers>)`. No command `AddTongue`
exists in `commands_full.json` and LipSynch.js does not define it, so (inferred) this last call raises a script error
after the markers were created and the command fails. Missing: what `AddTongue` was meant to be (likely an older Face
Robot tongue builder) and the `SetControlKeys` contract.

### `fr_EditVisemes` (SPEC)
No args. Gets or adds the `fr_Visemes` property on the face model (§2), inspects it with siLock, returns it.
Property `fr_Visemes`: `LibraryPath` (string, default = factory library folder without trailing slash), `Language`
(string `USEnglish`), `Phoneme` (string ""), `Variation` (string `Normal`), `PhonemeName` (string "", read-only).
PPG (help `propref_facebot_Visemes.htm`): group "Viseme Library" (folder control, button "Create New Library...");
group "Viseme" (Language / Phoneme / Variation combos, buttons "Apply", "New...", "Save Viseme Pose",
"Create Corrective Shape" (label becomes "Edit Corrective Shape" when that shape exists)); button "Import Visemes...".
On open and on every change the PPG re-validates: Language falls back to `USEnglish`, then the first csv; Variation to
`Normal`, then the first; Phoneme to the first table row (also sets PhonemeName). Phoneme combo items whose pose file is
missing get the suffix six spaces + `<not defined>`. Buttons are disabled when there is no pose (Apply), no variation
(New...), no phonemes (Save / Corrective), no `.frpre` in the current variation (Import). Button actions:
Apply → `fr_LoadVisemePose(<pose path>)`; Save → `fr_SaveVisemePose(<pose path>)` (on the factory library with an
existing pose, a Yes/No box "Warning, you are about to overwrite a factory installed visemes.  Continue?", caption
"Overwrite Factory Viseme"); Create New Library → temporary scene-root CustomProperty `Create_New_Library`
(`FromLibraryPath` = current, `ToLibraryPath` = `<project>\Viseme` or "" when already there, `Overwrite` false,
`CopyVisemes` true), modal, then `fr_CopyVisemeLibrary`, switch LibraryPath to the target if it exists, delete the
property; New... → (factory library: Yes/No "Warning, you are about to add a new variation to the factory installed
visemes.  Continue?", caption "Add Factory Viseme") temporary `New_Variation` (`Variation` "", `CopyFrom` `<none>`),
modal; TAB/VT/LF/CR/FF, `\`, `/`, space, `_` and `.` are removed from the name (info log
`Removed illegal characters from variation name`); empty → (siError) `Variation name not specified`; existing folder →
(siError) `Variation "<name>" already exists`; else `fr_CreateVisemeVariation(<lang folder>\<name>, <lang folder>\<CopyFrom> or null)`;
Corrective → `fr_CreateVisemeShape(<shape name>)`, select the face mesh, open view "Shape Manager" with
`selectedshape` = the name; Import → temporary `Import_Visemes` (`ImportAll` siInt4 1 radio "All Variations" 1 /
"<Variation> Variation Only" 0, `Overwrite` true), modal, then `fr_ImportVisemes(<lang folder>, <variation or null>, Overwrite)`.
Cancelling a modal dialog skips the action; the temporary property is always deleted.

### `fr_AddLipSync` (SPEC)
No args. Gets or adds the `fr_LipSync` property on the face model, inspects it with siLock. Returns Empty (unlike
`fr_EditVisemes`).
Property `fr_LipSync`: `Language` (siInt4 0, range 0–1; radio English 0 / Japanese 1), `Audio` (string ""), `Text`
(string ""), `TextText` (string ""), `Offset` (siDouble 1, range −10000–10000, UI range = Play Control In–Out at define
time, persistable), `TrailingSilenceDuration` (siInt2 10, range 1–120, not preset-persistable; label "Silence Duration").
PPG (help `propref_facebot_LipSync.htm`): Audio file widget (initial folder `FACEROBOTDATAROOT\Audio`, created if
missing); Text file widget, filter `Text files (*.txt *.text)|*.txt:*.text|All Files (*.*)|*.*||`; a text editor on
`TextText` (height 150, Tahoma 12) with buttons "Save" and "Reload"; "Clip Offset" with button "Current" (sets Offset to
Play Control Current); button "Create LipSync".
Behaviour: changing Audio sets Text to the audio path with its extension replaced by `.txt` (or "" when there was no
change) and loads it into TextText; changing Text reloads TextText; Save writes TextText as UTF-16 (Yes/No box
`Overwrite existing file: <f>?`, caption "Overwrite File", when the file exists) and reads it back; Save/Reload with no
file name → (siError) `No filename specified.`. "Create LipSync" runs `fr_ImportSpeech(Audio, Text, Offset, Language,
TrailingSilenceDuration)`; on a result it inspects `<action>.SpeechBlend` and runs `ShowOptionalPanel("lipsync_stow")`.

## 4. Wire contract, Tongue.js

### `AddToGroup_tongue` (SPEC)
Args: `Model`, `gname`, `members` (collection, or a string that is turned into a collection by text). If the model has a
group named gname: `AddMember(members)` on it and return it. Else return `Model.AddGroup(members, gname, false)`.

### `GetCompounds_tongue` (SPEC)
Args: `compound1`, `compound2` (file names). Folder = Face Robot folder `Compounds` under root 2 (the folder above
`FACEROBOTDATAROOT`), not created; missing → the folder error of §2 and return null. Each name is prefixed with the
folder; the first missing file → (siError) `Missing Compound <<full path>>` (path between `<` `>`), return null. Else
returns an array (Dictionary items, a SAFEARRAY) of the two full paths, in argument order.

### `fr_SetupTongueMaps` (SPEC)
Args: `ControlObjects` (ordered collection, ≥ 4 for a cubic curve (inferred)), `Mesh` (polygon mesh). Returns a
2-element array [`UMap`, `Blend`] weight maps.
1. Temporary scene-root NURBS curve `temptonguecurve`: one control point per control object at its global translation
   (weight 1), no knots given, open, degree 3, non-uniform parameterization, SI NURBS.
2. Cluster `TongueCluster` on the mesh: reused when a cluster of that name exists and is always-complete, else
   `AddCluster(siVertexCluster, "TongueCluster")` with no elements (a complete cluster).
3. Weight map `UMap` on the cluster: reused when a property of that name with type `wtmap` exists, else added from
   preset `Weight Map Property`. Colour `red` 255, `green` 125, `blue` 0; all weights first set to 1.0.
4. For every mesh point (positions of the geometry at time 0 / mode 0, mapped to world by the mesh global transform):
   closest position on the curve, its U converted to a normalized U (0–1) of the first curve; the UMap weights are set
   to these values (so weight = how far along the control chain the point lies).
5. Weight map `Blend` the same way, colour 125 / 255 / 0, all weights 1.0.
6. `FreezeObj(UMap)`, `DeleteObj(temptonguecurve)`.
An unsupported property type would log (siError) `Clusterproperty of type <t> not supported, modify script`; not
reachable from this command.

### `fr_BuildTongueAfterSolve` (SPEC)
No args. Face model (§2; the throw fallback always yields a model). With a model: get or add the `TongueSetup`
property on it, inspect with siLock, return it. Without (an empty `fr_GetFaceModel` result): (siError)
`FaceRobot model was not found.`, return Empty.
Property `TongueSetup`: `TongueMesh` (string ""), `Rescale` (bool false), `DeleteMesh` (bool false). PPG (help
`propref_facebot_TongueSetup.htm`): group "Mesh" with buttons "Hide/Unhide Face", "Remove tongue controls" + item
"Delete tongue mesh", item "Tongue_Mesh", buttons "Import tongue", "Set to selected"; group "Setup" with buttons "Fit",
"Solve". Actions:
- Hide/Unhide Face: on `fr_sget("FaceModel")`'s `GroupVisibility` property, sets `Face`, `Controls`, `Eyes`, `LookAt`
  all to the negation of the current `Face` value.
- Remove: `fr_RemoveTongue(DeleteMesh)` (B14c); false → (siError) `Failed to remove tongue`.
- Set to selected: first polygon mesh in the selection into `TongueMesh`; none → (siError)
  `Tongue must be of polymesh type, no tongue found` + LF TAB + `Select Polymesh tongue and try again`; more than one →
  (siWarning) `Only one tongue is allowed on tongue rigging process, will use the first item in selection`.
- Import tongue: parent = first `GetKeyed(["Jaw","Bone"])`, else (siError) `Jaw Bone was not found.` and the face model;
  `DeselectAll`; file `FACEROBOTDATAROOT\Parts\Tongue.tongue.emdl` (Parts folder created if missing); missing →
  (siError) `Tongue Mesh Could not be identified in scene or found in parts folders`. Else `ImportModel` of it; then,
  because the parent is always set, the parent is added as a child of itself and the imported model is deleted before
  its first child is returned (inferred: this path errors or leaves `TongueMesh` invalid; a defect in the shipped
  script).
- Fit: `fr_FitTongueAfterSolveStage(TongueMesh)`. Solve: `fr_SolveTongueAfterSolveStage()`.

### `fr_ScaleTongueMesh` (SPEC)
Args: `Mesh` (polygon mesh), `Markers` (a SAFEARRAY of 3D vectors, first = tongue base; FR.dll's solver passes it,
B14e). Returns true; false when Mesh is empty.
1. Markers converted from a SAFEARRAY; anything else (missing, a JScript array) throws a script error (inferred).
2. Mesh global translation set to Markers[0] (rotation and scale kept); this transform T is used below.
3. Marker box: per-axis min/max over all markers. Mesh box from `Geometry.GetBoundingBox()` (object space: centre c,
   extents e); half-box top h = c + e/2.
4. d = marker max − Markers[0]. Scale vector = (d.z / h.z, d.y / h.y, d.z / h.z): X uses the **Z** ratio (uniform in
   the XZ plane).
5. For every point: world position via T, minus Markers[0], times the scale vector per component, plus Markers[0], back
   to object space via T.
6. `FreezeObj(Mesh)`, then `Geometry.Set(<new positions>, <original polygon data>)` (topology unchanged).

### `fr_IsHeadMesh` (SPEC)
Args: `Mesh`. Returns true when either: the mesh's model has a `FaceConnections` property with a `Mesh` parameter
whose value's part after the first `.` equals the mesh name (value format `<model>.<mesh>`); or an operator named
`Facial Soft Tissue` is in the mesh's construction history. Else false. An empty Mesh is a script error.

### `GetTongueMarkers` (SPEC)
No args (Init declares none, so Execute always works on the face model). Command flag siNoLogging set (not logged).
Returns a collection of tongue marker nulls, or null.
1. Face model (§2). `Fit` = the model's (recursive) child `Fit`, else a new null `Fit` under the model.
2. If `Fit` has any (recursive) children matching `Tongue*`, return them all (this includes `*_Marker` nulls left by
   `fr_FitTongue` (inferred)).
3. Else one object per key set via `GetKeyed(keys, model)` (first item): A = [Control, Jaw, End], B = [Control, Lower,
   Mouth], C = [Control, Upper, Mouth], D = [Control, Head]. A missing set → (siError)
   `Object Keyed [<keys comma-joined>] not found`, then (siError) `Control not found`, return null.
4. Positions are the four global translations; lerp(p, q, t) = p + t·(q − p). Four nulls under `Fit`, created in this
   order, each with a global transform of identity rotation/scale and that translation, not selected:

| Null | Position |
|---|---|
| `TongueBase` | b = lerp(A, D, 0.5) with y replaced by lerp(A, B, 0.4).y |
| `TongueBack` | k = lerp(A, b, 0.8) with y replaced by lerp(B, C, 0.8).y |
| `TongueFront` | f = lerp(B, k, 0.6) with y replaced by C.y |
| `TongueTip` | lerp(B, f, 0.5) |

5. Return the collection [TongueBase, TongueBack, TongueFront, TongueTip].

### `fr_FitTongueAfterSolveStage` (SPEC)
Args: `TongueMesh` (object or its name; the PPG passes the `TongueMesh` string). Returns Empty.
HeadNull = `fr_sget("hpoints","HeadNull")`; markers = `GetTongueMarkers()`; then `fr_FitTongue(HeadNull, TongueMesh,
markers, true)` (MustDeleteMarkers true, Scale default 1.0; same as B14e). An empty/false result or an exception →
(siError) `Failed to fit tongue`.

### `fr_SolveTongueAfterSolveStage` (SPEC)
No args. `DeselectAll`, then `fr_SolveTongue()` (Rescale false; same as B14e); false → (siError)
`Failed to solve tongue`. Returns Empty. (This is the script-side owner of that text; B14e found the same string in
FR.dll for another caller.)

### `GetTongueScale` (SPEC-PARTIAL)
Args: `MarkerVectors` (indexable list of 3D vectors with a `length`). Returns a new vector = last − first.
With no argument the fallback indexes the missing argument and throws a script error (inferred), so the keyed
`Tongue,Base` / `Tongue,Tip` lookup it intends is never reached. Missing: how a caller's array reaches the command
(a JScript array keeps `length`; a SAFEARRAY from VBScript/Python/C++ has no `length`, which would make the index NaN
and the result undefined (inferred)).

## 5. Open questions
- `AddTongue` (called by `fr_PrepareForPhonemes`, and named in LipSynch.js's workgroup-path helper) is not a registered
  command in `commands_full.json`; confirm with a golden that the command fails at that step.
- `GetKeyed`, `AddUserKeyword`, `SetControlKeys` (`Utilities.js`) have no contract; GetKeyed's match rule (all
  keywords present? order?) decides which objects the tongue/viseme commands pick.
- `GetTongueScale` argument marshalling (JScript array vs SAFEARRAY).
- The `TongueSetup` "Import tongue" path: what Softimage does on `AddChild` of an object to itself and on reading the
  children of a deleted model.
- `fr_SetupTongueMaps`: the result when fewer than 4 control objects are given (curve creation with degree 3).

## 6. Corrections for the wire agent
`src/commands/faceRobotModule.ts` registers all 20 names in the `frHostShells` list (category Custom, **no arguments**,
log "…plugin body LOCK", return null). Every one disagrees with the contracts above:
- Arguments missing: `fr_ImportSpeech` (5, `SilenceDuration` = 10), `fr_LoadVisemePose` / `fr_SaveVisemePose`
  (`FileName`), `fr_CopyVisemeLibrary` (4), `fr_CreateVisemeVariation` (2), `fr_CreateVisemeShape` (`ShapeName`),
  `fr_ImportVisemes` (3), `AddToGroup_tongue` (3), `GetCompounds_tongue` (2), `fr_SetupTongueMaps` (2),
  `fr_ScaleTongueMesh` (2), `fr_IsHeadMesh` (1), `fr_FitTongueAfterSolveStage` (1), `GetTongueScale` (1).
- Return values: `fr_ImportSpeech` returns the speech action; `fr_EditVisemes` / `fr_BuildTongueAfterSolve` the
  inspected property; `fr_IsHeadMesh` a bool; `fr_ScaleTongueMesh` true/false; `GetTongueMarkers` a collection;
  `fr_SetupTongueMaps` [UMap, Blend]; `GetCompounds_tongue` two paths; `AddToGroup_tongue` the group;
  `GetTongueScale` a vector.
- `GetTongueMarkers` must not be logged (siNoLogging).
- `src/commands/faceRobotB14eTongue.ts` (fr_SolveTongue) calls `fr_IsHeadMesh` and `fr_ScaleTongueMesh` with empty
  argument objects; per this note they need the tongue mesh (and, for scaling, the marker vector array), and with
  these shells they do nothing. Once wired, fr_ScaleTongueMesh moves the mesh to Markers[0], freezes it and rewrites
  its points.
