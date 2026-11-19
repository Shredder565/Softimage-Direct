# CMD-B14b: Face Robot `FR.dll` sculpt sessions, sculpt history, mirror sculpt, mouth sculpt, meta/proxy/vector mouth, controller DB, stick lips (fr_SculptBegin, fr_SculptEnd, fr_SculptEyelidBegin, fr_SculptEyelidEnd, fr_SculptPuffingBegin, fr_SculptPuffingEnd, fr_SculptTendonBegin, fr_SculptTendonEnd, fr_SculptMouthBegin, fr_SculptMouthEnd, fr_MirrorMouthSculpt, fr_MirrorSculpt, fr_ApplySculptPose, fr_DeleteSculptSession, fr_DeleteAllSculptSessions, fr_ToggleMuteSculptSession, fr_InspectSculptHistory, fr_RefreshSculptHistory, fr_AdjustMetaMouth, fr_ProxyMouth, fr_VectorMouth, fr_ResetControllerDB, fr_StickLips)

Row: **CMD-B14b**. Status: **SPEC** (9 names: fr_SculptBegin, fr_SculptEyelidBegin, fr_SculptPuffingBegin, fr_SculptTendonBegin, fr_DeleteAllSculptSessions, fr_InspectSculptHistory, fr_RefreshSculptHistory, fr_MirrorMouthSculpt, fr_StickLips), **SPEC-PARTIAL** (14 names: fr_SculptEnd, fr_SculptEyelidEnd, fr_SculptPuffingEnd, fr_SculptTendonEnd - the operator-fitting solver `0x180105130` / `0x180104d60` / `0x180106d90` and the two bake paths `0x180108e40` / `0x180107370` were read only for names and strings; fr_ApplySculptPose, fr_DeleteSculptSession, fr_ToggleMuteSculptSession - the `SculptHistoryUDB` blob codec (`0x18010e090` read, `0x180110130` write) was not read, so the byte layout is unknown; fr_MirrorSculpt - the operator collector `0x1800f1b70` and the two mirror solvers `0x1800f3b00` / `0x1800f28f0` were read only for names; fr_SculptMouthBegin - the mouth-sculpt set-up helpers `0x1800c2830` / `0x1800c34f0` and the blob validator `0x1800afa90` were not read; fr_SculptMouthEnd - the bake helper `0x1800aded0` was not read; fr_AdjustMetaMouth - `0x1800e5bc0` read only for names; fr_ProxyMouth - `0x1800e8610` read only for names; fr_VectorMouth - `0x1800ea660` read only for callees; fr_ResetControllerDB - the per-controller reset `0x1800ca2f0` read only for names, and the two blob names live in runtime-initialised globals).
Run: 2026-11-19, si-analyst worker, unattended, batch 14 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

| Binary | bytes | sha256 | export timestamp |
|---|---|---|---|
| `C:\Program Files\Autodesk\Softimage 2015 SP2\FaceRobot\Application\Plugins\FR.dll` (PE32+ amd64, image base `0x180000000`) | 2996552 | `a4657b5fa4f7bbd5d61b25ae1e870faa77638cb47c303c2b124579379134413b` | 1442478276 |

Method: export addresses from `inspect_native_exports` (394 exports) projected through the retained-evidence `native-exports` view. Ghidra 12.1.4 on the shared, already-open FR.dll session (never opened or closed here). I decompiled every row's `_Execute` and `_Init`, the sculpt-session engine (`0x180101400` begin driver, `0x18010a350` end driver, session-reader `0x180109b20`, link builders `0x1800fea20` / `0x1800fe630`, region-operator collector `0x180100040`, symmetry check `0x1800ff9e0`, ActiveSculpt duplicator `0x1800ff5f0`, symmetry-map set-up `0x180100bd0`, construction-mode switch `0x180101930`, material set-up `0x180101a80`, session-struct ctor `0x180103ab0`, property finder `0x18010cff0`), the mouth-sculpt helpers `0x1800c2f60` / `0x1800c4a30` / `0x1800c3c30`, and the history-panel helper `0x1801110b0`. String searches (`[Ss]culpt`) gave the message texts. Arguments were cross-checked against `args_b.json` (§4). Statements describe behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | _Init | _Execute | key helpers |
|---|---|---|---|
| `fr_SculptBegin` | `0x180102c00` | `0x1801029e0` | begin driver `0x180101400` (session kind 0) |
| `fr_SculptPuffingBegin` | `0x180103460` (shared, forwards to `fr_SculptBegin_Init`) | `0x180103020` | `0x180101400` (kind 1) |
| `fr_SculptTendonBegin` | `0x180103460` (shared) | `0x180103240` | `0x180101400` (kind 2) |
| `fr_SculptEyelidBegin` | `0x180103460` (shared) | `0x180102d60` | `0x180101400` (kind 3) |
| `fr_SculptEnd` | `0x18010b300` | `0x18010b180` | end driver `0x18010a350` (kind 0) |
| `fr_SculptPuffingEnd` | `0x18010b870` (shared, forwards to `fr_SculptEnd_Init`) | `0x18010b6f0` | `0x18010a350` (kind 1) |
| `fr_SculptTendonEnd` | `0x18010b870` (shared) | `0x18010b890` | `0x18010a350` (kind 2) |
| `fr_SculptEyelidEnd` | `0x18010b870` (shared) | `0x18010b4d0` | `0x18010a350` (kind 3) |
| `fr_SculptMouthBegin` | `0x1800c5360` | `0x1800c51a0` | `0x1800cf880` (view state), `0x1800c2f60` |
| `fr_SculptMouthEnd` | `0x1800c56d0` | `0x1800c54d0` | `0x1800c4a30`, bake `0x1800aded0` |
| `fr_MirrorMouthSculpt` | `0x1800c4ff0` | `0x1800c4ec0` | `0x1800c3c30` |
| `fr_MirrorSculpt` | `0x1800f4670` | `0x1800f42e0` | `0x1800f1b70`, `0x180127400`, `0x1800f3b00` / `0x1800f28f0` |
| `fr_ApplySculptPose` | `0x180113530` | `0x180112f10` | UDB reader `0x18010e090`, pose loader `0x180154cf0` |
| `fr_DeleteSculptSession` | `0x180114400` | `0x180113ec0` | `0x18010e090`, UDB writer `0x180110130`, PPG rebuild `0x18010f010` |
| `fr_DeleteAllSculptSessions` | `0x180113d60` | `0x1801136b0` | operator finder `0x1801282a0`, `0x18010f010` |
| `fr_ToggleMuteSculptSession` | `0x180114f80` | `0x1801149e0` | `0x18010e090`, `0x180110130`, `0x18010f010` |
| `fr_InspectSculptHistory` | `0x180170fe0` (shared no-op stub) | `0x1801145b0` | panel helper `0x1801110b0` |
| `fr_RefreshSculptHistory` | `0x180114860` | `0x1801145e0` | `0x18010f010` |
| `fr_AdjustMetaMouth` | `0x180170fe0` (shared no-op stub) | `0x1800ef080` | `0x1800e5bc0` |
| `fr_ProxyMouth` | `0x1800ef1c0` | `0x1800ef0b0` | `0x1800e8610` |
| `fr_VectorMouth` | `0x1800f0640` | `0x1800f0590` | `0x1800ea660` |
| `fr_ResetControllerDB` | `0x180170fe0` (shared no-op stub) | `0x1800eff50` | per-controller reset `0x1800ca2f0` |
| `fr_StickLips` | `0x1800bf990` | `0x1800bf4e0` | - |

Shared addresses: the three non-face Begin Inits share `0x180103460` and the three non-face End Inits share `0x18010b870`; both are wrappers that call the face Init, so they register the same description, tooltip and arguments. `0x180170fe0` is a do-nothing stub that returns success; it is the export for `fr_AdjustMetaMouth_Init`, `fr_InspectSculptHistory_Init`, `fr_ResetControllerDB_Init` and also `NameMapWizard_Define`, `fr_AdjustRetargetedFace_Init`, `fr_ApplyFaceRobotGameShader_Reload/_Term/_Unload`, `fr_CalibrateRetargetedFace_Init`, `fr_FacialMocapTools_Init`, `fr_RegenerateMouth_Init`. Those three commands therefore declare no arguments, no description and no explicit return-value setting.

## 2. Shared facts

### 2.1 FR asset store (singleton)
`0x1800268d0` returns the Face Robot asset-registry singleton. Calls used here: get entry `(group, name)` `0x180029ef0` (e.g. group `"meshes"`, name `"Mesh"` = the face mesh; group `"controls"`, name = controller name); get named object `0x18002a4a0` (`"FaceModel"`); put entry `0x18002fdd0` (key `"ActiveSculpt"`); localised string lookup `0x18002a8a0` (keys `"pbar_init_sculpt"`, `"pbar_term_sculpt"`, `"pbar_init_mouth_proxy"`). Most commands that do not take a face object resolve the face mesh as entry `meshes/Mesh`.

### 2.2 Sculpt-session kinds

| kind | Begin / End | region operator searched on `pnt` clusters | history label | End parameter names touched |
|---|---|---|---|---|
| 0 | fr_SculptBegin / fr_SculptEnd | `fro_RegionOp` | `Skin` | `Bulge`, `EaseIn`, `Strength`, `BaseLength`, `BaseMultiplier`, `BaseDistance`, `BaseXOffset`, `Multiplier` |
| 1 | fr_SculptPuffingBegin / End | `fro_PufferOp` | `Puffer` | `Puff`, `EaseIn`, ... |
| 2 | fr_SculptTendonBegin / End | `fro_TendonOp` | `Tendon` | `Tendon`, `EaseIn`, ... |
| 3 | fr_SculptEyelidBegin / End | `fro_EyelidOp` | `Eyelid` | `Bulge` (no `EaseIn`) |

(The per-kind parameter list is from string references in `0x180105130`; which subset is written per kind beyond the first name and the `EaseIn` exclusion for kind 3 was not separated, inferred.)

### 2.3 Sculpt-session data model (live session)

A live session is held entirely in the scene; there is no in-memory singleton between Begin and End. Objects:

1. **`ActiveSculpt`**: a duplicate of the face mesh made with the native `Duplicate` command (arguments: face, 1, 2, 0, 0, 1, 2, 2, 0, 0), renamed `ActiveSculpt`, parented under the face mesh (`AddChild`), and registered in the FR asset store under key `"ActiveSculpt"`. The user sculpts this object.
2. **`SculptLinkReader`** custom property (created with preset `Custom_parameter_list`) on the face mesh. Parameters, in order:
   - `Mode` (siInt4, value = session kind 0..3);
   - `SymButtonOldState` (siInt4, the value of preference `3D_TRANSFO_REFERENTIAL_CHANGED` before the session);
   - `CustomLinkOut` parameters (siBool, label built from the 1-based index and the text `CustomLinkOut`), one per sculpt object (one: ActiveSculpt) plus one more when the face's original surface shader was saved.
3. **`SculptLinkConnection`** custom property (preset `Custom_parameter_list`) on ActiveSculpt with one parameter `CustomLinkIn` (siBool).
4. **`CustomLink`** scripted operators (JScript, created by `Factory::CreateScriptedOp` with an empty code string from a runtime-initialised global): port group `MainGroup`, output port `outLink` on a face `CustomLinkOut` parameter, input port `inLink` on the ActiveSculpt `CustomLinkIn` parameter (one per sculpt object), plus one whose `inLink` is the saved original shader. These wire the face to its session objects so End can find them: End reads `SculptLinkReader` parameter 3 (the first `CustomLinkOut`), follows its source operator to input port 0 and takes that port target's parent 3D object as ActiveSculpt.
5. **Symmetry map** (only when the session is symmetric, see 2.4): on ActiveSculpt, a vertex cluster `SymmetryMapCls`, a cluster property `Symmetry Map` from preset `Symmetry Map Property`, the `SymmetryMap` operator applied to it (helper `0x1801a5490`, inferred `ApplyOp`) with `axis` = 0 and `tolerance` = 0.2.
6. **Shading**: a local `Lambert` material is added to ActiveSculpt (`AddMaterial`), with `diffuse` and `ambient` copied from the face's surface shader. The face's own surface shader is then dimmed: diffuse is converted to hue/lightness/saturation (`0x18010ce90`), lightness is multiplied by 0.2 and converted back (`0x18010cd10`); ambient per channel becomes `0.3984 / max(ambience_c, 1e-6) + ambient_c * 0.2`, where `ambience` is read from the scene `AmbientLighting` property (`red`, `green`, `blue`). If the face material's `Surface` has no source, a `Phong` preset from `Material Shaders` is connected and renamed `DeleteThisShader`. If the existing surface shader has no readable `diffuse`/`ambient`, it is disconnected, kept in the session (struct offset `0xd8`, later the saved shader) and replaced by a new `Phong` preset.
7. **Preferences**: `Context.ConstructionMode` is set to 3 (siConstructionModeSecondaryShape, inferred enum name) when it is not already 3. When the session is symmetric, bit `0x800` of `3D_TRANSFO_REFERENTIAL_CHANGED` is set if the `FaceModel`'s `FaceState` property `DNA` text contains `Symmetric` and the bit was clear (inferred: turns on symmetric modelling).

Session-struct layout (`0x180103ab0`, 0x148 bytes, internal): +0 kind, +4 Apply flag, +0x18 face, +0x48 ActiveSculpt, +0x78 SculptLinkReader, +0x90/+0xa8 operator lists, +0xc0 name map, +0xd0 cluster property, +0x100 double array, +0x108 symmetric flag, +0x10c saved preference, +0x110 saved shader, +0x140 history-path flag (set by `0x180109b20`, inferred from the session/face state).

### 2.4 Symmetry rule (`0x1800ff9e0`)
For every `pnt` cluster of the face that carries the kind's operator (`0x180100040` via `0x1801282a0`), the operator is tested for "significant deformation" (kind 0 `0x1801280c0`, kinds 1 and 2 `0x180127d30`, kind 3 `0x180127aa0`). Significant clusters are collected. The session is symmetric when every collected cluster name starting with `L` has an `R` partner (and vice versa) among the collected names; a name starting with neither letter breaks symmetry, except `ChinForm_Region1` in kind 0. If no cluster is significant, Begin logs `<face name> has no significant deformations to start sculpting!` and stops.

### 2.5 Sculpt history (persistent)
- **`SculptHistoryUDB`**: a UserDataBlob, local property of the face mesh, holding a list of session records. In memory each record has a mute flag, a pose text (the scene pose saved at End, possibly empty), and a list of shape keys created by that session. The serialised layout is not read (Q2).
- **`SculptHistory`**: a custom property registered by FR.dll (`SculptHistory_Define` `0x1801118c0`, `SculptHistory_DefineLayout` `0x1800ee500`, `SculptHistory_PPGEvent` `0x180111a20`) placed on the face mesh. It has a parameter `Update`; every history command rebuilds the PPG (`0x18010f010(prop, init)`) and then rewrites `Update` with its own value transformed (inferred: toggled) to force a PPG refresh.
- **Shape-key names**: session shape keys start with `Sculpt` (case-insensitive match on 6 characters is used to find them). Character index 6 is `P`/`p` or `N`/`n`; lower case means muted (2.6).
- **Pose blob**: at End (history path) the current pose is saved to a temporary file `TempSculptPose*` in a temp folder (`0x18015d820`), read back as text and stored in the record.

### 2.6 Message texts (caption `SOFTIMAGE|Face Robot` where a box is shown)
- `<face> has already a sculpt activated!` (face already has `SculptLinkReader`; begin and mouth begin).
- `<face> has already a mouth sculpt activated!` (begin, when the mouth-sculpt child exists).
- `<face> has no significant deformations to start sculpting!`
- `<face> is not in sculpt mode.` (End, no `SculptLinkReader`; two variants, logged by the session reader).
- `Please finish the current sculpt on <full name>` (fr_MirrorSculpt).
- `Mirror mouth sculpt requires an active mouth sculpt.`
- `This sculpt session has no pose data available... sorry.` (box, icon flags 0x30).
- `Couldnt create a temporary file` (box 0x10); `Apply sculpt pose failed` (box 0x10).
- `Couldnt create a temporary file.\nCurrent poses wont be saved along with the sculpt session`, `Save pose failed.\nCurrent poses wont be saved along with the sculpt session`, `Error reading from the temporary file.\nCurrent poses wont be saved along with the sculpt session` (End, history path).
- `To enable Stiction in this Scene, the Mouth has to be Regenerated`
- `Select a model with a solved mouth.` (fr_AdjustMetaMouth).
- Strings present but used by PPG/other code (not by these Execute paths): `Delete sculpt cannot be undone.  Are you sure you want to delete Sculpt(` ..., `Regenerate will delete all mouth sculpts.  Are you sure you want to continue?`, `This scene has an old mouth sculpt data blob.  Please regenerate the mouth.`

## 3. Contracts

### `fr_SculptBegin`: SPEC
Wire contract:
- Args: `Face` (object argument, SingleObj). Return value enabled: `true` when the begin driver returns success, else `false`. The command status is always success.
- Session kind 0 (`fro_RegionOp`).

Steps (`0x180101400`): (1) refuse if the face already has `SculptLinkReader` (message 2.6, status fail) or if the model has the mouth-sculpt child (message 2.6); (2) collect `pnt` clusters and their `fro_RegionOp` operators; (3) symmetry/significance test (2.4), stopping with the "no significant deformations" message when nothing qualifies; (4) show the progress bar with caption from `pbar_init_sculpt` (cancel enabled); (5) create ActiveSculpt (2.3 item 1); (6) if symmetric, add the symmetry map and possibly the preference bit (items 5 and 7); (7) set construction mode 3; (8) set up shading (item 6) and a small post-step `0x1801003f0` (unread, inferred refresh); (9) build `SculptLinkReader`, `SculptLinkConnection` and the `CustomLink` operators (items 2 to 4). Any failing step stops the sequence and returns `false`.

### `fr_SculptPuffingBegin`: SPEC
As `fr_SculptBegin`, kind 1 (`fro_PufferOp`). Same arguments, return and messages.

### `fr_SculptTendonBegin`: SPEC
As `fr_SculptBegin`, kind 2 (`fro_TendonOp`).

### `fr_SculptEyelidBegin`: SPEC
As `fr_SculptBegin`, kind 3 (`fro_EyelidOp`). Difference: when `Face` is not a valid object, the face mesh is taken from the FR asset store (`meshes/Mesh`).

### `fr_SculptEnd`: SPEC-PARTIAL
Wire contract:
- Args: `Face` (plain argument, read as an object), `Apply` (bool). Return value is always set to `true`; the command status is the end driver's status.
- Kind 0.

Steps (`0x18010a350`): (1) session reader `0x180109b20`: the face must carry `SculptLinkReader` else `<face> is not in sculpt mode.` and status E_FAIL (0x80004005); its `Mode` must equal the command's kind else status 0x8000FFFF; restores bit `0x800` of `3D_TRANSFO_REFERENTIAL_CHANGED` to cleared when `SymButtonOldState` had it clear and the current value has it set; locates ActiveSculpt through the `CustomLink` chain (2.3 item 4). (2) progress bar caption `pbar_term_sculpt`. (3) If `Apply` is true: fit the region operators to the sculpted shape (`0x180105130`, writing parameters listed in 2.2 per operator; a delta threshold of +/-0.05 is used), then `0x180104d60`, `0x180106d90`, then bake: history path `0x180107370` when the session flag +0x140 is set, else `0x180108e40`. Both bake paths store a shape named `MyShape` from the ActiveSculpt geometry (`0x1801a74b0`, inferred StoreShapeKey) and compare `NonEnvelopedPositions`; the history path also writes the mute parameter `MuteSculpting`, appends a record (label from 2.2, the shape keys, the saved pose, 2.5) to `SculptHistoryUDB` and refreshes `SculptHistory` (`Update`). (4) Restore shading: if a saved shader exists it is reconnected to the face material `Surface`; otherwise the ActiveSculpt Lambert `diffuse`/`ambient` are copied back onto the face shader. A shader whose name contains `DeleteThisShader` is disconnected and deleted. (5) Delete `SculptLinkReader` and ActiveSculpt (`0x1801a5c20`, inferred DeleteObj), select the face (`0x1801a7a30`, inferred SelectObj), refresh (`0x1801a87c0`, `0x1801a5ce0`). If `Apply` is false only steps 1, 2, 4 and 5 run (cancel). Unread: the solver numerics and the exact shape-key names produced by the bake (Q1).

### `fr_SculptPuffingEnd`: SPEC-PARTIAL
As `fr_SculptEnd`, kind 1. A `Puffing` session ended with this command; ending it with another End returns 0x8000FFFF.

### `fr_SculptTendonEnd`: SPEC-PARTIAL
As `fr_SculptEnd`, kind 2.

### `fr_SculptEyelidEnd`: SPEC-PARTIAL
As `fr_SculptEnd`, kind 3, with the same `meshes/Mesh` fallback as the eyelid Begin when `Face` is invalid.

### `fr_SculptMouthBegin`: SPEC-PARTIAL
Wire contract:
- Args: `mesh` (plain argument, object). No explicit return value is enabled by its Init. Status: fail (1) when the mesh already has `SculptLinkReader`, else success.

Steps: if `SculptLinkReader` exists, log `<mesh> has already a sculpt activated!` and fail. Otherwise set a view state (`0x1800cf880`, on a view named from a global string) and run `0x1800c2f60`: requires the mouth data blob on the mesh (blob name from a runtime-initialised global, Q3); if the model already has the mouth-sculpt child (model name + suffix, inferred `.SculptMouth`), only `SelectObj` it; otherwise, if the blob validates, `Clone` the mesh (arguments: mesh, empty, 1, 1, 0, 0, 0, 0, 0), rename the clone `SculptMouth`, mark the mouth data as being sculpted, and run two set-up helpers (unread).

### `fr_SculptMouthEnd`: SPEC-PARTIAL
Wire contract:
- Args: `mesh` (object), `cancel` (bool). No explicit return value. Status always success.

Steps (`0x1800c4a30`): find the mouth-sculpt child; if missing nothing happens. When the second argument is true, call `0x1800aded0` (unread; inferred bake of the sculpt into the mouth, Q4). Copy `diffuse` and `ambient` from the SculptMouth material's first shader back onto the mesh's first shader, delete the SculptMouth object by name (`0x1801309d0`), select the mesh, refresh. Then, if the mesh has the history property named by a runtime global (inferred `SculptHistory`), rewrite its `Update` parameter.

### `fr_MirrorMouthSculpt`: SPEC
Wire contract:
- Args: `mode` (int), `mesh` (object). No explicit return value. Status always success.

Steps (`0x1800c3c30`): needs the mouth-sculpt child, else logs `Mirror mouth sculpt requires an active mouth sculpt.` and does nothing. Reads the mouth data blob and a second mirror-map blob (names from runtime globals). For every mouth vertex with a mirror partner (mode 0 uses the first table; any other mode uses the table offset by its first word, i.e. the opposite direction), computes the partner's target position as the X-mirrored sculpt offset of the source vertex; when the squared distance from the current partner position exceeds `(mouthScale * 0.001)^2` it runs `SelectGeometryComponents("<SculptMouth full name>.pnt[<index>]")` and `Translate(, dx, dy, dz, …, 4)` (relative move, inferred). Ends with `DeselectAll`.

### `fr_MirrorSculpt`: SPEC-PARTIAL
Wire contract:
- Args: `direction` (int; 0 means mirror one way, any other value the other), `face` (object argument), `type` (int, selects which operator family to mirror, inferred: 0 region, 1 puffer, 2 tendon). Return value enabled (value not written in Execute). Status 0 on success.

Steps: if `face` has `SculptLinkReader`, log `Please finish the current sculpt on <full name>` and return status 1. Otherwise collect the operators (`0x1800f1b70`), find the face deformer operator (`0x180127400`; invalid gives 0x8000FFFF), mute it, mirror the L/R operator parameters (`0x1800f3b00`, which treats `ChinForm_Region1` as self-symmetric) or, for the symmetry-map case, `0x1800f28f0`, then unmute.

### `fr_ApplySculptPose`: SPEC-PARTIAL
Wire contract:
- Args: `SessionID` (int, 0-based record index). Return value enabled. 

Steps: face mesh from `meshes/Mesh`; needs `SculptHistoryUDB`, else success with no effect. Index out of range gives E_INVALIDARG (0x80070057). Empty pose text: box `This sculpt session has no pose data available... sorry.`, status 1. Otherwise writes the pose text (UTF-16) to a temp file `TempSculptPose*`, loads it as a pose (`0x180154cf0`), shows `Apply sculpt pose failed` on failure, deletes the temp file; temp failure shows `Couldnt create a temporary file` and returns status 1.

### `fr_DeleteSculptSession`: SPEC-PARTIAL
Wire contract:
- Args: `SessionID` (int), `Prop` (object argument: the `SculptHistory` property). Return value enabled.

Steps: needs `SculptHistoryUDB`; bad index gives E_INVALIDARG. Deletes all shape keys of that record, removes the record, rewrites the blob, rebuilds `Prop` (`0x18010f010(Prop, false)`) and rewrites its `Update`. No confirmation in the command (the `Delete sculpt cannot be undone...` prompts belong to the PPG, inferred).

### `fr_DeleteAllSculptSessions`: SPEC
Wire contract:
- Args: `Prop` (object argument). Return value enabled. Status success.

Steps: face mesh from `meshes/Mesh` (nothing happens if absent). For each `pnt` cluster, find the first of `fro_RegionOp`, `fro_PufferOp`, `fro_TendonOp`, `fro_EyelidOp` on it and collect that cluster's local shape keys whose names begin with `Sculpt` (case-insensitive); delete all collected keys in one call; delete `SculptHistoryUDB` if present; rebuild `Prop` and rewrite `Update`.

### `fr_ToggleMuteSculptSession`: SPEC-PARTIAL
Wire contract:
- Args: `SessionID` (int), `Prop` (object), `MuteFlag` (bool). Return value enabled.

Steps: needs `SculptHistoryUDB`; bad index gives E_INVALIDARG. Sets the record's mute flag to `MuteFlag` and renames each of its shape keys: character 6 becomes `p` (muted) / `P` (unmuted) when it was P/p, otherwise `n` / `N`. Rewrites the blob, rebuilds `Prop`, rewrites `Update`. (The mute itself is through the name change, inferred: the deformer ignores lower-case keys.)

### `fr_InspectSculptHistory`: SPEC
Wire contract:
- No arguments (no-op Init). Status success.

Steps (`0x1801110b0`): only when the face mesh has `SculptHistoryUDB`: get or add the `SculptHistory` property, refresh its definition (`0x18016ae80("SculptHistory")`), and point an existing history view at it (`targetcontent` = property full name); if no such view, create a `Property Panel` view named `SculptHistory` in the active layout, move it, set `targetcontent`, resize it to height 400.

### `fr_RefreshSculptHistory`: SPEC
Wire contract:
- Args: `init` (bool). Return value enabled. Status success.

Steps: on the face mesh's `SculptHistory` property (if present) call the PPG rebuild with `init`, then rewrite `Update`.

### `fr_AdjustMetaMouth`: SPEC-PARTIAL
Wire contract: no arguments; status success. `0x1800e5bc0` needs the face mesh with the mouth data blob, else `Select a model with a solved mouth.`; otherwise opens a `Property Panel` view named `MouthAdjust` targeting the mouth-adjust property (inferred `MouthAdjustProperties`). Unread: the property set-up.

### `fr_ProxyMouth`: SPEC-PARTIAL
Wire contract: `mode` (int). Return value = `true` when `0x1800e8610(mode)` succeeds. Status success. The helper builds an `ExtractedMouth` proxy (progress caption `pbar_init_mouth_proxy`): `Duplicate` of the face mesh, `SelectGeometryComponents` + `HideAndUnselect` on the non-mouth part, `RemoveFlexEnvDeformer` on envelope deformers whose names do not contain `Eye`, `Cheek`, `Vertebra` or `Orbital`, `UpdateInnerMouth`, links through `MouthAdjustProperties` and operator `fro_MouthAdjustPropLink`, and handles the eyelid curves (`LEyelidUpper_Curve` ... `REye_Offset`) from private group `__Curves`. Unread: the meaning of each `mode` value.

### `fr_VectorMouth`: SPEC-PARTIAL
Wire contract: `mode` (int); status success; no explicit return written. `0x1800ea660(mode)` checks a mouth state (`0x1800a7cd0`), resolves `meshes/Mesh` and calls `0x1800aba80`. Unread: what each mode does.

### `fr_ResetControllerDB`: SPEC-PARTIAL
Wire contract: no arguments; status success. For each controller, in this order: `Head_Control`, `LMouthCorner_Control`, `RMouthCorner_Control`, `LLipUpperBend_Control`, `LipUpper_Control`, `RLipUpperBend_Control`, `LLipLowerBend_Control`, `LipLower_Control`, `RLipLowerBend_Control`, `JawEnd_Control`, `LPuffer_Control`, `RPuffer_Control`, `mpChin_Control`, `LNostrilBase_Control`, `LNostrilBulge_Control`, `NoseTip_Control`, `RNostrilBase_Control`, `RNostrilBulge_Control`, `ROrbitalUpper_Control`, `ROrbitalLower_Control`, `REyelidUpper_Control`, `REyelidLower_Control`, `LOrbitalUpper_Control`, `LOrbitalLower_Control`, `LEyelidUpper_Control`, `LEyelidLower_Control`, it calls `0x1800ca2f0(name)`, which re-resolves the controller under FR group `controls` on `FaceModel`, re-registers it and works on its `FaceControl` custom property (`ID`). Then, on `FaceModel`, deletes two UserDataBlobs if present (names from runtime globals at `0x1802d2698` and `0x1802d2668`, Q5).

### `fr_StickLips`: SPEC
Wire contract: no arguments; return value per Init (see §4); status success.
Steps: face mesh from `meshes/Mesh`; looks up clusters `MouthRegion` and `MouthLipRegion` (not used further); if the mesh has property `LipStiction`, opens it with `0x1801a6570(full name, "", "", 3, false)` (inferred `InspectObj` in modal mode 3); otherwise logs `To enable Stiction in this Scene, the Mouth has to be Regenerated`.

## 4. Registry cross-check (`args_b.json`)
- All 23 names, argument names and argument order agree with the Inits.
- Handlers: `Face` on the four Begins, `Prop` on fr_DeleteAllSculptSessions / fr_DeleteSculptSession / fr_ToggleMuteSculptSession and `face` on fr_MirrorSculpt are `AddObjectArgument` (registry `SingleObj`). `Face` on the four Ends and `mesh` on the mouth commands are plain `Add` (no handler) although Execute reads them as objects.
- Descriptions and tooltips agree, including `undefined` as the tooltip of the mouth commands and empty strings for fr_MirrorSculpt and fr_RefreshSculptHistory.
- Return value: the registry lists `true` for fr_SculptMouthBegin, fr_SculptMouthEnd and fr_MirrorMouthSculpt, but their Inits do not call `EnableReturnValue` (Q6). For fr_AdjustMetaMouth, fr_InspectSculptHistory and fr_ResetControllerDB the Init is a no-op stub, so the registry's `true` comes from the default (inferred). fr_StickLips and fr_MirrorSculpt call `EnableReturnValue` (argument value not recovered) where the registry says `false`.
- Argument defaults are all empty `CValue` (registry `null`).

Extras not in `args_b.json`:
- Command `fr_mirror_mouth_sculpt` (exports `_Execute` `0x18011d090`, `_Init` `0x18011d1c0`), not read.
- Custom property `SculptHistory` (`_Define` `0x1801118c0`, `_DefineLayout` `0x1800ee500`, `_PPGEvent` `0x180111a20`).
- Scripted operator type `CustomLink` (JScript, created on the fly), properties `SculptLinkReader` / `SculptLinkConnection`, blob `SculptHistoryUDB`.

## 5. Open questions
- Q1: The bake step at End: exact shape-key names (beyond the `Sculpt` prefix and the P/N flag at index 6), which shape is kept from `MyShape`, and the parameter values the fitting solver writes.
- Q2: Byte layout of `SculptHistoryUDB` (codec `0x18010e090` / `0x180110130`); in memory a record is 0x50 bytes with mute flag at +0x20, pose text at +0x28 and a shape-key list (0x60-byte items) at +0x38.
- Q3: Names of the mouth data blob, the mirror-map blob and the mouth-sculpt child suffix (globals `0x1802d1e38`, `0x1802d1dc8`; strings `CDKMetaMouthSculpt` and `.SculptMouth` exist and are the likely values).
- Q4: fr_SculptMouthEnd's second argument is named `cancel` but the bake helper runs when it is true; check whether `0x1800aded0` bakes or reverts.
- Q5: Names of the two controller blobs deleted by fr_ResetControllerDB, and what `0x1800ca2f0` resets on each controller.
- Q6: Return-value settings for the mouth commands and the `EnableReturnValue` argument in fr_StickLips / fr_MirrorSculpt.
- Q7: Where the session flag +0x140 (history path vs plain bake at End) comes from.
