# CMD-B17e: marking-set / external-constraint script commands (`animation.vbs`) and mixer script commands (`action.vbs`, LOCK)

Row: **CMD-B17e**. Status: **SPEC** for the 7 `animation.vbs` commands, **LOCK** for the 6 `action.vbs` commands.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`). Sources read from the install
with REA `open_binary(format=raw-binary, architecture=6502, entry_point=0x0)` + `read_bytes`, decoded in the scratchpad.

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `animation.vbs` | 35337 | `3739d850` | whole | 7 |
| `action.vbs` | 200806 | `2cf14010` | no (> 64 KB raw-6502 read limit) | 6 |

Earlier contracts reused: `cmd-b5f-misc-dsscripts.md` (other `animation.vbs` commands: `RetargetRigToRig`,
`RetargetTagRig`, `TogglePinObjectInPosition`), `cmd-01d-keysets-paintkeys-sky.md` / `cmd-b8b-fcurve-layers-marking-expr-binary.md`
(`SetMarking`, `AddProxyParam`), `cmd-b14d-fr-retarget-mocap.md` (`StoreAction`).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `SelectExternalConstraints` | animation.vbs | `ManageExternalConstraintProc` | SPEC |
| `ActivateExternalConstraints` | animation.vbs | `ManageExternalConstraintProc` | SPEC |
| `DeactivateExternalConstraints` | animation.vbs | `ManageExternalConstraintProc` | SPEC |
| `RemoveExternalConstraints` | animation.vbs | `ManageExternalConstraintProc` | SPEC |
| `CreateMarkingSet` (2 entries: Create / Add To) | animation.vbs | `CreateMarkingSetProc` | SPEC |
| `ActivateMarkingSet` | animation.vbs | `ActivateMarkingSetProc` | SPEC |
| `SetKeyUsingMarkingSet` (2 entries: plain / Branch) | animation.vbs | `SetKeyUsingMarkingSetProc` | SPEC |
| `GetInputAndStoreAction` | action.vbs | `GetInputAndStoreActionProc` | LOCK |
| `GetInputAndStoreAction2` | action.vbs | `GetInputAndStoreActionProc2` | LOCK |
| `PasteAction` | action.vbs | `GetInputAndPasteActionProc` | LOCK |
| `EditClip` (9 entries) | action.vbs | `EditClipProc` | LOCK |
| `EqualizeClips` | action.vbs | `EqualizeClipsProc` | LOCK |
| `DeleteUnusedMixerTracks` | action.vbs | `DeleteUnusedMixerTracksProc` | LOCK |

## 2. Wire contract, animation.vbs

File-level constants: marking-set property name `MarkingSet`; operation codes Select = 0, Mute = 1, UnMute = 2,
Toggle = 3, Delete = 4; translated texts ids 1043 (create-marking-set overwrite question) and 1044 (its dialog title)
from `XSISCRIPTS.dict`.

Shared helper "get marking-set property" (object, createNew, resetFirst): looks up the property `MarkingSet` on the
object's `Properties`. If found and resetFirst: deletes it and creates a fresh one; if found and not resetFirst: returns
it. If not found and createNew: creates one. Creation = `SIAddProp("Custom_parameter_list", obj, siNodePropagation,
"MarkingSet")`, first returned item. Otherwise returns Nothing.

Shared helper "expand marking": each marked entry that is a compound kinematic path is expanded to its scalar
channels: `kine.local.pos` → `kine.local.posx,posy,posz`; `kine.local.ori` and `kine.local.ori.euler` →
`kine.local.rotx,roty,rotz`; `kine.local.scl` → `sclx,scly,sclz`; `kine.local` → all nine (pos, rot, scl in that order);
same for `kine.global.*`. Other entries are kept. Result is the flattened list (comma-split).

### `CreateMarkingSet`
Args: `InputObjs` (Collection, f 0x10042), `Reset` (bool; True for "Create Marking Set", False for "Add To Marking Set").
1. Read the current marking (`GetMarking`) and expand it. Nothing marked → log (siError) `You need to mark some
   parameters first`, stop.
2. Empty / Nothing / count 0 input → log (siError) `You need to select an object first`, stop.
3. Filter the input with `SIFilter(…, "sceneobject")`.
4. If Reset: if any filtered object already has a `MarkingSet` property, ask Yes/No (question icon) with texts 1043 /
   1044; No → raise `siErrCancelled`, stop.
5. For each filtered object: get its marking-set property (create if missing, reset first when Reset), then
   `AddProxyParam <set>, <list>` where the list is every expanded marked parameter prefixed with `<object>.`.
   With Reset False an existing set is kept and the proxies are appended.
No return value.

### `ActivateMarkingSet`
Args: `InputObjs` (unused). Calls `SetMarking "MarkingSet"` (marks the proxy-parameter set of the selected objects).
The input is ignored; marking is relative to the selection.

### `SetKeyUsingMarkingSet`
Args: `InputObjs`, `Branch` (bool; False plain entry, True "Set Branch Key Using Marking Set").
1. Empty / Nothing / count 0 → log (siError) `You need to select an object first`, stop.
2. Branch: the work set is a new collection holding, for each input, all its descendants
   (`FindChildren(,,si3DObjectFamily)`; the input object itself is not added). Not Branch: the input.
3. Read `Preferences.animation.save_key_command` and the key time `PlayControl.Key`.
4. Preference 0: for each object with a `MarkingSet` property holding at least one parameter: `SaveKey
   "<object>/.MarkingSet", <keytime>`. Objects without one are skipped silently.
   Preference 1: `SaveKey <workset.FindObjectsByMarkingAndCapabilities(, siKeyable)>, <keytime>`.
   Preference 2: if something is marked, join the marking with commas and `SaveKey
   <workset.FindObjectsByMarkingAndCapabilities(<marking>, siKeyable)>, <keytime>`; nothing marked → no-op.
   Other values → raise `siErrCancelled`.

### `SelectExternalConstraints`, `ActivateExternalConstraints`, `DeactivateExternalConstraints`, `RemoveExternalConstraints`
Args: `InputObj` (Collection, f 0x10042), `Operation` (string: `Select`, `Activate`, `Deactivate`, `Remove`).
Proc:
1. Empty / Nothing input → log (info) `No valid object selection`, raise `siErrCancelled`. Same after
   `SIFilter(…, "sceneobject")` returns Nothing.
2. Map Operation: `Select` → Select, `Activate` → UnMute, `Deactivate` → Mute, `Toggle` → Toggle, `Remove` → Delete,
   anything else → Select.
3. Works on the **first** filtered object only.
Core:
1. Model = the object if its type is `#model`, else its owning model (and the object itself joins the scan list).
   Scan list += all descendants (`FindChildren`).
2. For each scanned item, for each constraint in `Kinematics.Constraints`, for each constraining object: the constraint
   is external when the constraining object's model name differs from the model's name, or the constraining object's
   parent name is not in the scan list (text search over the list's text form). External constraints are collected.
3. Bones: if the item's type is `bone` and its joint has an `UpVectorReference` that is external by the same test,
   the external up-vector count is incremented and, by operation: Mute → `DeactivateAbove "<joint>.SkeletonUpVectorOp",
   True`, set `joint.resplane` to 0 while preserving `kine.local.rotx` (read before, written back after); UnMute →
   `DeactivateAbove …, False`, `joint.resplane` = 2; Delete → `joint.resplane` = 0 then `DeleteObj
   "<joint>.SkeletonUpVectorOp"`; Select / Toggle: nothing.
4. Remove duplicates from the collection; log (info) `Found <n> constraints and <u> upvectors external to <model>`.
5. Select → `SelectObj <collection>`; Delete → `DeleteObj <collection>`; Mute → `SetValue <cns>.active, False` each;
   UnMute → `SetValue <cns>.active, True` each; Toggle → `ToggleValue "active", <cns>` each.
No return value.

## 3. Wire contract, action.vbs (LOCK)

`action.vbs` is 200806 bytes and could not be read (raw-6502 image limit 64 KB). Registry facts only; the wrapped
commands are (inferred) from the names and argument lists.

### `GetInputAndStoreAction` / `GetInputAndStoreAction2`
Category Animation Mixer. Args: `Model` (str, ""), `InputObj` (str, ""), `Mode` (int, 1), `Name` (str, `StoredAction`),
`RemoveAnim` (bool, True), `StartFrame` (dbl, 0.0), `EndFrame` (dbl, −1.0 for the first, 0.0 for the second entry),
`Consider Time` (bool, False), `Ripple` (bool, False), `AddClip` (bool, False), `ClipOffset` (dbl, 0.0),
`IncludeAnimLayers` (bool, False); return `Action`. Display name of the second entry is its procedure name
`GetInputAndStoreActionProc2`. (inferred) Picks/validates the model and input when empty, then calls `StoreAction`
(see `cmd-b14d-fr-retarget-mocap.md`) with the same arguments and returns the new action source.

### `PasteAction`
Args: `Source`, `Target` (Collection, f 0x10046), `CopyStart`, `CopyEnd`, `StartFrame`, `EndFrame` (dbl, 0.0),
`Ripple` (bool, False); return Value. (inferred) Pastes a copied animation range from source to target objects over
the given frame range.

### `EditClip`
Args: `InputObj` (clip collection), `Mode` (enum string `siEditClipOptions`: siClipNudge / siClipSlip / siClipScale /
siClipTrim), `Time` (dbl; ±1.0 in the shipped entries "Nudge/Slip/Scale/Trim forward/backward"; a generic "Clip Edit"
entry takes Time as a collection). (inferred) Applies the chosen edit to the selected clips by Time frames.

### `EqualizeClips`, `DeleteUnusedMixerTracks`
Args: `InputObj` only. (inferred) Equalize: makes the selected clips the same length; DeleteUnusedMixerTracks: removes
mixer tracks with no clips from the input models' mixers.

## 4. Open questions
- action.vbs needs a reader that handles files > 64 KB (or a copy in a connected folder) before these six can be SPEC.
- `SetKeyUsingMarkingSet` Branch mode does not key the selected root itself (only descendants); confirm in XSI.
- External-constraint scan uses a text search of the parent name over the scan list's text, so a name that is a
  substring of another listed name counts as internal (quirk to keep).

## 5. Corrections for the wire agent
- `ActivateMarkingSet` ignores its `InputObjs` argument; it always calls `SetMarking "MarkingSet"`.
- External-constraint commands act on the first scene object of the input only, not on every input.
- `CreateMarkingSet` "Add To" (Reset False) keeps an existing `MarkingSet` property and appends proxies.
