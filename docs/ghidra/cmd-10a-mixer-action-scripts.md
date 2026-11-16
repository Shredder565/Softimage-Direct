# CMD-10a: animation mixer clip / action script commands (`action.vbs`)

Row: **CMD-10a** (split from CMD-10 Animation Mixer, plus uncategorised and Camera Sequencer names). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

20 scripting names (23 registry entries with overloads), all VBScript in
`Application\DSScripts\action.vbs` except one UI overload in `uixsiscripts.vbs`.

| Command | Registry entries | Procedure |
|---------|-----------------:|-----------|
| `SelectActionsFromObjects` | 1 | `SelectActionsFromObjectsFunc` |
| `SelectObjectsFromAction` | 1 | `SelectObjectsFromActionFunc` |
| `FreezeClips` | 2 | `FreezeClipsFunc` (scripted), `GetInputAndFreezeClipsProc` (UI, key-assignable) |
| `FreezeAndReplaceClips` | 2 | `FreezeClipsAndReplaceFunc` (scripted), `GetInputAndFreezeAndReplaceClipsProc` (UI, key-assignable) |
| `CrossfadeClipWeights` | 1 | `CrossfadeClipWeightsProc` |
| `CutClip` | 1 | `CutClipFunc` |
| `TrimBefore`, `TrimAfter` | 1 each | `CutClipLoopProc` |
| `CreateScaleEffect` | 1 | `CreateScaleEffectProc` |
| `ResetAllEffectCurves` | 1 | `ResetAllEffectCurvesProc` |
| `ResetSelectedEffectCurves` | 1 | `ResetSelectedEffectCurvesProc` |
| `ResetEffectAtFrame` | 2 | `ResetEffectAtFrameProc` (scripted), `ResetEffectAtFrameUIProc` in `uixsiscripts.vbs` (UI, key-assignable) |
| `ClipMatch` | 1 | `ClipMatchProc` |
| `ImportActionAndAddClip`, `ImportActionAndApply`, `ImportAudioAndAddClip` | 1 each | procedures of the same name (`…Proc` for the first two) |
| `OffloadAction`, `PartialOffloadAction`, `ReloadAction` | 1 each | `…Proc` |
| `DeleteUnusedCamSeqTracks` | 1 | `DeleteUnusedCamSequencerTracksProc` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | names, arguments, defaults, handlers, direction flags, return flag, category, description |
| (S) | `Application\DSScripts\action.vbs` (200,806 bytes), the procedures above and every helper they call, read from the install; `uixsiscripts.vbs` for `ResetEffectAtFrameUIProc` | all steps, constants and message keys |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` | text of ids 1033, 1041, 1042, 1527 |
| (H) | `XSISDK\include\xsi_decl.h` | `siCutClipOptions`, `siWeightPresets`, `siErrCancelled`, `siModal`, `siPoseOffsetClip` |
| - | REA / Ghidra | not used by this batch (script-only). The C++ commands these scripts call are listed under "Callee commands" |
| - | XSIBATCH goldens | not run |

No script text is reproduced. Parameter paths, message strings, ids and enum
values are recorded as facts.

## Shared facts

### Enum values (H)

| Enum | Values |
|------|--------|
| `siCutClipOptions` | `siCut` 1, `siTrimBefore` 2 (keep the tail), `siTrimAfter` 3 (keep the head) |
| `siWeightPresets` (used here) | `siWeightGaussian` 7, `siWeightGaussianReverse` 8 |
| `siErrCancelled` | `0x4C7` (the "command cancelled" script error; shown below as **cancel**) |
| `siModal` | 4 |
| `siPoseOffsetClip` | 3 |
| Track type passed to `AddTrack` | 0 animation, 1 shape, 8 camera shot |
| Extrapolation type (`extrapbef_type` / `extrapaft_type`) | 0 none, 1 hold (`…_timehold` frames), 2 cycle (`…_nbcycles`), 3 bounce (`…_nbbounces`) |

### Clip type strings (S)

`mixeranimclip`, `AnimActionCompoundClip`, `mixershapeclip`,
`ShapeActionCompoundClip`, `mixeraudioclip`, `camerashotclip`,
`mixerlayerclip`. Source types: `Action`, `ShapeAction` (any type ending in
`action`, case-insensitive, counts as an action source).

### Parameter paths used (S)

| Thing | Path under a clip |
|-------|-------------------|
| Time control of action / shape clips | `.actionclip.timectrl` (`startoffset`, `endtime`, `clipin`, `clipout`, `scale`, `resin`, `resout`, `extrapbef_*`, `extrapaft_*`, `cliptoparentstart`, `cliptoparentend`) |
| Time control of audio and camera shot clips | `.timectrl`; camera shot clips use `sequencein` / `sequenceout` / `scenein` / `sceneout` in place of start / end / clip in / clip out |
| Weight | `.actionclip.weight` |
| Active | `.actionclip.active`; fill: `.actionclip.fillaction`, `.actionclip.fillpriority` |
| Source | `.actionclip.sourceaction` (audio clip: `.source`); the source has `FrameStart`, `FrameEnd`, `storage` |
| Clip effect items | `.actionclip.clipeffect.items`, each with `.param` (animatable effect variable) and `.valuemap` (expression text) |
| Pose offset | `.actionclip.poseactive`, `.actionclip.StaticKineState.{sclx,scly,sclz,orix,oriy,oriz,posx,posy,posz}` |
| Mixer of a model | `<model>.Mixer.Tracks.AnimTracks`, `.ShapeTracks`, `.AudioTracks`, `.FileCacheTracks`; templates under `<model>.Mixer.ConnectionMapping` and `.ValueMapping` (each with `.Active`); a track has `.solo` and `.ClipList` |
| Camera sequencer | `<scene root>.Camera_Sequencer.Tracks.CameraShotTracks` |

### Shared helpers (S), as behaviour

- **Message box helper.** Interactive: a message box titled with the
  translated title. Batch: logs "`<title>: <prompt>`" and answers the supplied
  default.
- **Wizard dialog.** Opens the given property modally (`InspectObj`, mode
  `siModal`) with a translated title. Cancelling the dialog counts as Cancel,
  anything else as OK.
- **Scene root lookup.** First object-filter child of the first scene under
  `Project`.
- **"Inside a compound" test.** A clip is treated as inside a compound clip
  when its full name has more than four dot-separated parts.
- **Extrapolation length of a clip** before (0) or after (1): 0 for camera shot
  clips and for type 0; the hold frames for type 1; cycles (or bounces) times
  clip length (`endtime − startoffset`) for types 2 and 3.
- **Set extrapolation** on one side: no-op for audio and camera shot clips; a
  value of 0 forces type 0; sets the type and the matching count parameter.
  For type 3 the script writes to a misspelt parameter name (`…_nbbouces`), so
  bounce counts are not actually set *(observable defect; only reachable with
  type 3, which `CutClip` rejects earlier)*.
- **Weight key snapshot.** Collects (frame, value) pairs of the weight curve at
  every existing key plus a list of extra frames, without duplicates;
  **restore** re-saves those keys whose frame lies inside a closed range.
- **Weight preset** (subset used here): removes the weight animation, then for
  Gaussian (7) keys 0 at `lower`, 0 at `upper − 1`, 1 at the midpoint
  `(upper + lower) / 2`, spline interpolation (curve type 3); for Gaussian
  reverse (8) the same with 1, 1, 0. The current frame is restored afterwards.
- **Empty-track collector.** Walks every track under a track container; a track
  with no clips is collected; compound clips (animation or shape) are entered
  recursively through their `.tracks`.

### Messages

| Key | Text | Source |
|-----|------|--------|
| 1527 | No clips selected | (D) |
| 1033 | "Action: %s Cannot be offloaded." + newline + "Only Action source with external storage can be offloaded" (`%s` = action) | (D) |
| 1041 | Match Clips | (D) |
| 1042 | Not found: please tag with Character > Biped Tags | (D) |
| literal keys | every other message below is looked up in `XSISCRIPTS` by its English text and falls back to that text | (S) |

### Callee commands (C++, outside this row)

`GetDrivingActions`, `PlotToAction`, `GetNumMappingRules`, `GetMappingRule`,
`AddTrack`, `AddClip`, `CopyClipToTrack`, `MoveClipToTrack`, `DeleteObj`,
`SaveKey`, `RemoveKey`, `RemoveAnimation`, `FirstKey`, `NextKey`,
`SetCurveType`, `ImportAction`, `ApplyAction`, `ImportAudio`, `AddAudioClip`,
`OffsetValueMap`, `PickElement`, `SIAddProp`, `InspectObj`, `EnumElements`,
`SIFilter`, `SIGetModel`, `GetPrim`, `Translate`, `Rotate`, `SelectObj`,
`AddToSelection`, `RemoveFromSelection`; object-model methods
`ActionSource.Offload`, `.PartialOffload`, `.Reload`.

## Wire contract

Unless stated, a failed validation logs the message and raises **cancel**
(`siErrCancelled`), which aborts the command without an error box.

### `SelectActionsFromObjects`

Display name "Select actions from objects". Returns a collection.

| Argument | Handler | Default |
|----------|---------|---------|
| `InputObjs` | collection | selection |
| `Consider Time` | bool | False |
| `Time` | frame | current frame |
| `Keep Compound Actions` | bool | True |
| `Keep Inactive Actions` | bool | False |

Same as `GetDrivingActions` with the five arguments passed through unchanged;
the result is then made the selection (`SelectObj`) and returned. No
validation of its own.

### `SelectObjectsFromAction`

Display name "Select objects from action". Arguments: `InputObj` (collection,
default selection), `OnlyPoseOffset` (bool, False). Returns a collection of
object names.

For each input element:

- **Clip** (type ends in `clip`, not an audio or camera shot clip): every
  mapping rule of the clip's `.actionclip` whose target is not `<unmapped>`
  contributes one entry; with `OnlyPoseOffset` only rules flagged as pose
  offset contribute. The entry is the object part of the rule target (text
  before the first dot), prefixed with the clip's model name unless that model
  is the scene root. A target that already starts with the model name is
  truncated by a character count instead (first dot position plus model name
  length plus one), which in practice yields `<model>.<object>` *(inferred: the
  arithmetic assumes object names are no longer than the model name plus one;
  longer names are cut short)*.
- **Action source** (type ends in `action`): each item of `<source>.Items`
  contributes `<source model>.<object>`, where the object is the 4th name part
  from the end of the item path (5th for a `ShapeAction`). Each such object is
  also removed from the selection as it is collected.
- Anything else is ignored.

If the result is not empty it becomes the selection, in **branch** mode when
`OnlyPoseOffset` is true, node mode otherwise. An empty result leaves the
selection alone. Duplicates are not removed.

### `FreezeClips` (scripted overload)

Display name "Freeze clips". Plots the animation produced by the given clips
into one new action source and returns it. The clips themselves are kept.

| Argument | Default | Meaning |
|----------|---------|---------|
| `InputObj` | selection | clips |
| `Name` | `FrozenAction` | name of the new action |
| `IgnoreInactiveChannels` | True | skip mapping rules that are not active |
| `StepFrame` | 1.0 | plot step |
| `FCurve Kind` | 30 | 10 boolean, 15 integer, 20 standard, 30 raw |
| `DefaultSegKind` | 3 | 1 constant, 2 linear, 3 spline (used with kind 20) |
| `Fit FCurve` | False | |
| `Fit Tolerance` | 0.01 | |
| `ProcessContRots` | True | keep rotations continuous |

Validation, in this order (each logs, then **cancel**):

1. no input: message 1527;
2. step ≤ 0: "Time step must be strictly positive";
3. kind not in {10, 15, 20, 30}: "The FCurve Kind value must be one of 10 (boolean), 15 (integer), 20 (standard) or 30 (Raw)";
4. kind 20 and interpolation outside 1..3: "The interpolation value must be one of 1 (constant), 2 (linear) or 3 (spline)";
5. fit on and tolerance 0: "The fit tolerance must be strictly greater than 0".

Then:

1. Inactive clips (`.actionclip.active` false) are dropped from the input
   collection (the caller's collection is modified).
2. Only `mixeranimclip` and `AnimActionCompoundClip` are considered. For
   each: the plot range grows to cover `startoffset − extrapolation before`
   and `endtime + extrapolation after − 1`; its model is noted; every mapping
   rule target other than `<unmapped>` (and, with `IgnoreInactiveChannels`,
   only active rules) is added once to the parameter list, prefixed with the
   model name when its first name part is not the model.
3. Further checks: no usable clip → 1527; empty parameter list → "No
   parameters to freeze"; clips from more than one model → "Can't Freeze Clips
   owned by different models"; a mix of clips inside and outside compounds →
   "Can't simultaneously Freeze Clips inside and outside compounds".
4. If the clips are inside a compound, both range ends are converted from the
   compound's local time to its parent's time:
   `(t − compound.clipin) / compound.scale + compound.startoffset`.
5. Isolation: the solo state of every animation track of the model's mixer
   (and of the sibling tracks inside the compound, if any) and the active
   state of every clip on the tracks that hold input clips are remembered.
   Tracks holding input clips (and the track holding their compound) are
   soloed, all other tracks un-soloed; on the soloed tracks every clip that is
   neither an input clip nor a compound clip is deactivated, the others
   activated.
6. `PlotToAction` is called with: the first scene object under the model, the
   comma-separated parameter list, `Name`, range start and end rounded to 3
   decimals, step, kind, interpolation, fit, tolerance, continuity flag. Its
   result is the return value.
7. Solo and active states are restored to the remembered values.

### `FreezeClips` (UI overload, key-assignable)

Same name; arguments as above but in/out with no defaults, plus `Title`
(default "Freeze Clips").

1. Looks for a property named `FreezeClips` on the scene root. If missing,
   adds one from preset `FreezeActionWizard` with that name and sets its
   defaults: `IgnoreInactive` True, `ActionName` "Frozen", `Step` 1,
   `FCurveKind` 3, `Interpolation` 2, `FitFCurve` False, `FitTolerance` 0.01,
   `ProcessContRots` True. The property persists on the scene root, so later
   runs reopen with the last values.
2. Opens it modally with the translated `Title`. Cancel → **cancel**.
3. On OK reads the values back into the in/out arguments, mapping the
   `FCurveKind` index 0/1/2/3 → 10/15/20/30 and the `Interpolation` index
   0/1/2 → 1/2/3, then behaves as the scripted overload.

Parameter ranges of the wizard property (S): `Step` −1,000,000..1,000,000;
`FCurveKind` 0..3; `Interpolation` 0..2; `FitTolerance` 0.0001..10 (UI range
0.0001..1). Labels: "Ignore inactive channels", "Action Name", "Step value",
"Kind of fcurve", "Interpolation", "Fit plotted values with an fcurve", "Fit
Tolerance", "Process rotations to ensure continuity".

The registry marks this overload as returning a value; the procedure does not
hand the action back *(so the return is empty)*.

### `FreezeAndReplaceClips` (scripted overload)

Display name "Freeze and replace clips". Arguments and defaults identical to
scripted `FreezeClips`. Returns the new action.

1. Runs scripted `FreezeClips` with the same arguments. If it yields nothing,
   stops.
2. Target track container: the compound's track container when the first
   input clip is inside a compound, otherwise `<model>.Mixer.Tracks.AnimTracks`.
3. Every input clip of type `mixeranimclip` or `AnimActionCompoundClip` is
   deleted. The earliest `startoffset − extrapolation before` among them is
   kept as the insertion frame.
4. All currently active connection-mapping and value-mapping templates of the
   model's mixer are switched off (and remembered).
5. A new animation track (type 0) is added to the target container and a clip
   of the frozen action is added on it at the insertion frame (`AddClip model,
   action, , track, frame`). The new clip is **added to** the selection.
6. The remembered templates are switched back on.

Note: inactive clips were already dropped from the input in step 1, so they
are not deleted.

### `FreezeAndReplaceClips` (UI overload, key-assignable)

As the `FreezeClips` UI overload (same scene-root property `FreezeClips`, same
defaults and index mapping; `Title` default "Freeze And Replace Clips"), then
the scripted `FreezeAndReplaceClips`. Cancel → **cancel**. Returns nothing.

### `CrossfadeClipWeights`

Display name "Crossfade clips weights". Arguments `FirstClip`, `SecondClip`
(single objects). No return value.

1. Each argument must belong to family `Clips` and must not be an audio or
   camera shot clip; otherwise logs "`<clip>` is not a valid clip." and
   **cancel**.
2. Reads `resin` / `resout` of both; the clip that starts earlier is taken as
   first (A), the other as second (B).
3. **Partial overlap** (`A.in < B.in < A.out < B.out`): the weight animation
   of both is removed and replaced by two keys each at `B.in` and
   `A.out − 1`: B goes 0 → 1, A goes 1 → 0.
4. **B fully inside A** (`A.in < B.in < B.out < A.out`): B gets the Gaussian
   weight preset and A the reverse Gaussian preset, both over `B.in..B.out`.
5. Any other arrangement (no overlap, equal starts, equal ends): nothing
   happens, no message.

### `CutClip`

Display name "Cut clip". Arguments: `Clip` (single object), `Mode` (in/out,
default `siCut` = 1), `Time` (frame, default current). Returns the new clip
for a cut, otherwise the input clip.

Works on animation, shape, compound, audio and camera shot clips. "start /
end / in / out" below mean `startoffset / endtime / clipin / clipout`, or the
sequence / scene equivalents on a camera shot clip.

Errors (log + **cancel** unless noted):

| Condition | Message |
|-----------|---------|
| mode not 1, 2 or 3 | Invalid cut mode |
| `mixerlayerclip` | Cannot cut layer clips |
| extrapolation before or after is hold or bounce | Only extrapolation cycles are supported |
| cut frame not strictly inside the clip including its cycles (must be at least one frame from each end, tolerance 1e-9) | Invalid split point. (The current frame is not inside the Clip) (logged; the command ends **without** cancel) |
| a cycle count is not an integer | Fractional cycles not supported |

Behaviour:

1. If the clip is inside a compound, the cut frame is converted to compound
   local time: `int(compound.clipin + (t − compound.startoffset) × compound.scale + 0.5)`.
2. (Not camera shot.) "Clip to parent start / end" are switched off on the
   clip's time control and start, in, out are rewritten with their current
   values. A cycle extrapolation with 0 cycles is reset to type 0.
3. Extended range = start − cyclesBefore × length .. end + cyclesAfter × length,
   with length = end − start.
4. If the weight curve would otherwise be lost (cut with any cycles; trim
   after with cycles before; trim before with cycles after), the weight keys
   are snapshotted, adding samples at t − 1, t, t + 1 and the extended start.
5. If the cut frame lies in a cycle rather than in the clip body, the body is
   shifted by a whole number of lengths so that it contains the frame, and the
   cycle counts on both sides are rebalanced so the extended range is unchanged.
6. New out point for the head: `(t − start) × scale + in − 1`.
7. **Cut (1):** a temporary track of the matching type is added (0 animation,
   1 shape, 8 camera shot); the clip is copied onto it (`CopyClipToTrack`) and
   the copy receives the original's timing, scale, fill action, fill priority,
   active flag and after-extrapolation settings. While copying, the source's
   `FrameStart` / `FrameEnd` are temporarily set to 0 / 1 and then restored;
   for a compound the inner clips' "clip to parent" flags are cleared during
   the copy and restored on both original and copy. The original keeps the
   head (after-extrapolation removed, out = new out, or, when it had cycles
   before, start moved to the extended start with the cycles converted into an
   after-cycle count of `1 − (end − t)/length + cyclesBefore − 1`). The copy
   keeps the tail (before-extrapolation removed, start = t, in = new out + 1,
   out unchanged; or, when it had cycles after, start moved to
   `end + (cyclesAfter − 1) × length` with a before-cycle count of
   `(end − t)/length + cyclesAfter − 1`). The copy is then moved onto the
   original's track at `t + cyclesBefore(copy) × length` and the temporary
   track is deleted. Returns the copy.
8. **Trim before (2):** the same tail treatment applied to the clip itself.
   **Trim after (3):** the same head treatment applied to the clip itself.
   For a camera shot clip: trim before sets `sequencein` = t and `scenein` =
   new out + 1; trim after sets `sceneout` = new out + 1; scale is rewritten.
9. If weight keys were snapshotted (never for audio / camera shot): the weight
   animation is removed and keys restored, for a cut on the head within
   `extended start − 1 .. t` and on the tail within `t − 1 .. extended end + 1`
   (each side only if it was actually shortened or had cycles); for a trim,
   within the whole extended range ± 1.
10. The current frame is restored to what it was on entry.

### `TrimBefore`, `TrimAfter`

Display names "Trim Before" / "Trim After". Arguments: `Clip` (collection,
default selection), `Mode` (in/out, default `siTrimBefore` 2 / `siTrimAfter`
3), `Time` (frame, default current). No return value.

For each element of type `mixeranimclip`, `AnimActionCompoundClip`,
`mixershapeclip` or `ShapeActionCompoundClip`, same as `CutClip clip, Mode,
Time`. Other elements (audio, camera shot, anything else) are skipped
silently. `TrimBefore` keeps the part after the frame; `TrimAfter` keeps the
part before it. An error in one clip aborts the loop.

### `CreateScaleEffect`

Argument `Clip` (collection, default selection). No return value.

Empty input: logs "Please select a clip first" and ends (no cancel). For each
`mixeranimclip` / `AnimActionCompoundClip`: for every clip effect item, keys
the item's `.param` to 1.0 at the clip's `resin` and at `resout`, and
rewrites its `.valuemap` expression to `(<previous>) * param`, where an empty
previous expression counts as `this`. Running it twice nests the expression.

### `ResetAllEffectCurves`

Argument `Clip` (collection). No return value. No input: logs "Please select
a clip first" and ends.

For each `mixeranimclip` / `AnimActionCompoundClip`: the kind of effect is
decided from the **first** item's expression: contains `+ param` or `+param`
→ offset effect, neutral value 0; else contains `* param` or `*param` → scale
effect, neutral value 1. For an offset or scale effect every item's `.param`
animation is removed and re-keyed with the neutral value at `resin` and at
`resout`. For any other expression the `.param` animation is just removed.

### `ResetSelectedEffectCurves`

Argument `Clip` (registry: collection; the procedure treats it as **one**
clip path). No return value.

No clip: logs "Please select a clip first" and ends. Empty selection: logs
"Nothing selected!" and **cancel**. Otherwise the effect kind and neutral
value are found as in `ResetAllEffectCurves` (default neutral 0 when neither
pattern matches). For every selected object and every mapping rule of the
clip whose target is not `<unmapped>`: if the selected object's name equals
the rule's object (first name part, prefixed with the clip's model name and a
dot unless the clip path starts with `Mixer`), the log gets "Resetting effect
curves for `<target>`" and the effect item with the same index as the rule
has its `.param` animation removed and re-keyed with the neutral value at
`resin` and `resout`.

### `ResetEffectAtFrame`

Scripted overload: arguments `Clip` (collection), `Time` (frame, default
current). No input: logs "Please select a clip first" and ends. For each
`mixeranimclip` / `AnimActionCompoundClip`, removes the key at `Time` on the
`.param` of every clip effect item; a missing key is ignored.

UI overload (key-assignable, in `uixsiscripts.vbs`): ignores the passed time,
reads the key-marker frame `Project.Data.PlayControl.Key`, runs the scripted
overload at that frame, and if the passed frame differs sets both the in/out
`Time` argument and `Project.Data.PlayControl.Current` to it.

### `ClipMatch`

Display name "Clip Match". Argument `InputObj` (collection, default
selection). No return value. Moves the second clip's pose offset so that a
chosen object is in the same place at the start of the second clip as at the
end of the first.

1. **Inputs.** Element 0 must be a `mixeranimclip` (reference), element 1 a
   `mixeranimclip` (clip to offset), optional element 2 the object to match.
   If two clips are not supplied, the user is asked to pick them
   (`PickElement`, prompts "Pick Reference Clip" and "Pick Clip to Offset");
   a right-click / escape ends the command, a pick that is not an animation
   clip logs "Match Clip Aborted: A clip was not picked" and ends.
2. **Object to match**, when not supplied: the model is that of the first
   input element (or the scene root when nothing is given); it is searched
   recursively for objects carrying a property named `RightFoot`, `LeftFoot`
   and `CenterOfGravity`. A property from preset `MatchClips` is added to the
   scene root, its `rightfoot`, `leftfoot`, `body_Center` text parameters are
   filled with the object names (or message 1042 when not found), its `Match`
   parameter defaults to the last one found in the order right foot 0, left
   foot 1, centre of gravity 2 (0 if none), and it is shown modally. The
   property is deleted afterwards; Cancel ends the command. `Match` 0 / 1 / 2
   chooses the right foot / left foot / centre of gravity object.
3. If the second clip starts (`resin`) before the first, logs "Clips picked
   backwards. Swapping!" and swaps them.
4. The second clip's pose offset is switched on and reset: `poseactive` True,
   scale 1,1,1, orientation 0,0,0, position 0,0,0.
5. Frames: end = first clip's `resout − 1`; start = second clip's `resin`;
   if the clips overlap (first starts before, and ends after, the second's
   start) end is set to start. Logs "Matching from frame: `<end>` (`<clip>`)"
   and "To frame: `<start>` (`<clip>`)".
6. The matched object's global transform is sampled at `end` with only the
   first clip active and at `start` with only the second clip active; both
   clips are left active.
7. Three temporary nulls (`transferNull`, `A`, `B`) are built from those two
   transforms; the transfer null is parented under `B`, then moved to `A`'s
   position and turned about global Y by the heading difference between the
   two transforms (angle between their local X axes projected on the ground
   plane, signed by the Y of their cross product). The offset is
   `inverse(B) × transferNull`, i.e. translation plus Y rotation only.
8. The first object returned by `SelectObjectsFromAction(second clip, True)`
   (pose-offset objects, selected in branch mode as a side effect) has its
   global transform at `start` multiplied by the offset; it is rotated and
   translated to the result in branch mode, absolute, global; then
   `OffsetValueMap second clip, siPoseOffsetClip (3), start` records the
   change as the clip's pose offset. If the clip has no pose-offset objects:
   logs "Failed to Match Clips. No objects set for pose offset in `<clip>`".
9. The three nulls are deleted. The selection is left on whatever the helper
   steps selected last *(inferred: the pose-offset object branch)*.

### `ImportActionAndAddClip`, `ImportActionAndApply`, `ImportAudioAndAddClip`

Arguments for all three: `Model` (single object), `FileName` (file name
handler; an empty value opens the file browser of the underlying import
command).

| Command | Behaviour | Returns |
|---------|-----------|---------|
| `ImportActionAndAddClip` | `ImportAction Model, FileName`, then `AddClip Model, <action>` with all other arguments defaulted | registry says a value; the procedure hands nothing back |
| `ImportActionAndApply` | `ImportAction Model, FileName`, then `ApplyAction <action>, Model` | as above, nothing |
| `ImportAudioAndAddClip` | `ImportAudio Model, FileName`, then `AddAudioClip Model, <audio source>` | the new audio clip |

### `OffloadAction`, `PartialOffloadAction`, `ReloadAction`

`InputObjs` is a collection (default selection); elements whose type is not
`Action` are skipped. No return value.

| Command | Extra arguments | Per action |
|---------|-----------------|-----------|
| `OffloadAction` | none | if `storage` is 0 (internal): message box (warning icon, OK, title "Warning") with message 1033 naming the action, then **cancel**; else `Offload()` |
| `PartialOffloadAction` | `StartFrame` 0, `EndFrame` 0, `Remember` False | same storage check; else `PartialOffload StartFrame, EndFrame, Remember` |
| `ReloadAction` | none | `Reload()` (no storage check) |

In batch mode the message box becomes a log line "Warning: `<text>`". Actions
processed before a failing one stay offloaded.

### `DeleteUnusedCamSeqTracks`

Display name "Delete Unused Camera Sequencer Tracks", category Camera
Sequencer. No arguments, no return value. Collects every camera shot track
under `<scene root>.Camera_Sequencer.Tracks.CameraShotTracks` that has no
clips and deletes them in one `DeleteObj` call. Nothing happens when there is
none.

## Enable conditions

None in the registry; all 23 entries are enabled. Key-assignable: the UI
overloads of `FreezeClips`, `FreezeAndReplaceClips`, `ResetEffectAtFrame`.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | No XSIBATCH golden for this row; `CutClip` with cycles and the weight-key restore are the parts most worth one | dump script: one clip with 2 cycles each side, cut / trim at a body frame and at a cycle frame, dump time control and weight keys |
| Q2 | Layout of the `FreezeActionWizard` and `MatchClips` presets (combo item labels) | read the two presets / SPDL under `Application`; new row PROP-FREEZEWIZ |
| Q3 | `SelectObjectsFromAction`: exact result for a rule target that already carries the model name when the object name is long | golden with a model-prefixed mapping rule |
| Q4 | What the caller sees from the three commands the registry flags as returning a value although the procedure returns none (`FreezeClips` UI, `ImportActionAndAddClip`, `ImportActionAndApply`) | golden: log the return value |
