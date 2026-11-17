# CMD-B6c: `uixsiscripts.vbs` commands for preferences, ICE tree branch / promote, point cloud grouping, view switching, camera sequencer, rig update callbacks and small utilities

Row: **CMD-B6c** (batch grouped by implementing script). Status: **SPEC** for 26 names, **SPEC-PARTIAL** for 2 (`LockEnvelopeDeformerWeights`, `GetViewportUnderMouse`).
Run: 2026-11-17, `si-analyst`, unattended.

28 scripting names (28 registry entries, one each) registered against
`Application\DSScripts\uixsiscripts.vbs`. Most are thin orchestration over
other commands and object model calls; the contracts below say which ones,
with which values, in which observable order.

| Command | Category | Procedure |
|---------|----------|-----------|
| `ImportPreferences` | file | `ImportPreferencesProc` |
| `ExportPreferences` | file | `ExportPreferencesProc` |
| `RestoreDefaultPreference` | file | `RestoreDefaultPrefProc` |
| `InspectPreferences` | Viewing | `InspectPreferencesProc` |
| `SIUpdateCamerasFromGlobalPref` | Camera, Preferences | `UpdateCamerasFromGlobalPrefProc` |
| `SIUpdateFxTreesFromGlobalPref` | Preferences | `UpdateFxTreesFromGlobalPrefProc` |
| `SIUpdatePlayControlFromGlobalPref` | Preferences | `UpdatePlayControlFromGlobalPrefProc` |
| `MakeICETreeBranch` | Simulation | `MakeMDOpBranchProc` |
| `PromoteICETree` | Simulation | `PromoteMDOpProc` |
| `GroupPointClouds` | Simulation | `FGroupPointCloudsProc` |
| `SplitCloud` | Simulation | `FSplitCloudProc` |
| `SwitchToView` | Views | `SwitchToViewProc` |
| `SwitchToViewByType` | Views | `SwitchToViewByTypeProc` |
| `GetViewportUnderMouse` | Viewing | `ViewMgrViewportProc` |
| `SetFocusedViewport` | Viewing | `SetFocusedViewportProc` |
| `SetCameraSequencerLayout` | Viewing, Camera Sequencer | `SetCameraSequencerLayoutProc` |
| `PlotCameraSequencer` | Camera Sequencer | `PlotCameraSequencerProc` |
| `ManCharacterOnUpdate` | (none) | `CharacterManUpdateProc` |
| `BipedRigOnUpdate` | (none) | `BipedRigUpdateProc` |
| `InfoGeometry` | General | `InfoGeometryProc` |
| `ParamBracketing` | General | `ParameterBracketingProc` |
| `InspectLocks` | General | `InspectLocksProc` |
| `RenamePropAndRebind` | (none) | `RenamePropAndRebindProc` |
| `RenamePropAndRebindUI` | (none) | `RenamePropAndRebindUIProc` |
| `SavePivotKey` | Animation | `SavePivotKeyProc` |
| `TransferShapeAnimation` | Animation, Deformation | `TransferShapeAnimationProc` |
| `GetShaderOnCnxPointFunction` | Rendering | `GetShaderOnCnxPointFunc` |
| `LockEnvelopeDeformerWeights` | Deformation | `LockEnvelopeDeformerWeightsProc` (commented out in the script, see its section) |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, description; argument lists of the commands that the handlers call |
| (S) | `uixsiscripts.vbs`: the 27 live procedures above, their helpers `GetPositionFromSinglePointCluster`, `FGetSceneRoot`, `FWizardDialog`, `OpenHTMLPageProc`, `FGetViewportNameByID`, and the commented-out block for `LockEnvelopeDeformerWeightsProc` | steps, constants, logged texts, called commands |
| (D) | `xsiscripts_dict.txt` (decoded `XSISCRIPTS.dict`, 172 records) | searched; none of the texts used by this batch is in the decoded table (see below) |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out.

| Command (display name) | Key-assignable | Returns a value |
|------------------------|----------------|-----------------|
| `ImportPreferences` (Import Preferences) | yes | no |
| `ExportPreferences` (Export Preferences) | yes | no |
| `RestoreDefaultPreference` (Restore Default Preference) | yes | no |
| `InspectPreferences` (Inspect Preferences) | yes | no |
| `SIUpdateCamerasFromGlobalPref` (Update Cameras) | no | no |
| `SIUpdateFxTreesFromGlobalPref` (Update FxTrees) | no | no |
| `SIUpdatePlayControlFromGlobalPref` (Update PlayControl) | no | no |
| `MakeICETreeBranch`, `PromoteICETree` | yes | no |
| `GroupPointClouds`, `SplitCloud` | yes | yes |
| `SwitchToView` (Switch to View), `SwitchToViewByType` (Switch to View by Type) | yes | no |
| `GetViewportUnderMouse` (Get Viewport Under Mouse) | no | yes |
| `SetFocusedViewport` (Set Focused Viewport) | no | no |
| `SetCameraSequencerLayout` (Reset Camera Sequencer Layout) | yes | no |
| `PlotCameraSequencer` (Plot Camera Sequencer) | no | no |
| `ManCharacterOnUpdate` (Man Character update), `BipedRigOnUpdate` (Biped Rig update) | no | no |
| `InfoGeometry` (Info Geometry), `ParamBracketing` (Parameter Bracketing), `InspectLocks` | yes | no |
| `RenamePropAndRebind`, `RenamePropAndRebindUI` | no | no |
| `SavePivotKey` (Save Pivot Key on Scl) | yes | no |
| `TransferShapeAnimation` (Transfer Shape Animation) | no | no |
| `GetShaderOnCnxPointFunction` (empty display name) | no | yes |
| `LockEnvelopeDeformerWeights` (Lock Envelope Deformer Weights), script entry | yes | yes |

All are enabled with no enable condition in the registry.

### Translated texts (S)(D)

This batch calls `XSIUtils.Translate` with the **English text itself** as the
key (dictionary `XSISCRIPTS`), not with a numeric id. None of these keys is in
the decoded 172-record table, so the localized result was not decoded; in an
English session the visible text is taken to be the key *(inferred)*.

| Key text | Used by |
|----------|---------|
| `Import a Category of Preferences` | `ImportPreferences`, browser title |
| `Export a Category of Preferences` | `ExportPreferences`, browser title |
| `xsipref (*.xsipref)\|*.xsipref\|All Files (*.*)\|*.*\|\|` | both, browser filter |
| `Rename multiple properties`, `Rename <NewName>` | `RenamePropAndRebind`, dialog title |

### `{F1D7703B-083A-42B9-841D-49FE3779CECD}` default (R)

`SIUpdateCamerasFromGlobalPref` and `SIUpdateFxTreesFromGlobalPref` have this
GUID string as the default of `InputObjs`, with no argument handler. The same
token is the default of 105 arguments across the registry. What the command
layer turns it into is not shown by the script; both handlers are written to
cope with an **empty** list (then they process the whole scene), so the token
is taken to resolve to "nothing given" *(inferred)*. See Q2.

### Scene-root lookup `FGetSceneRoot` (S)

Used by `RenamePropAndRebind` and `PromoteICETree`. It enumerates the elements
of `Project`, keeps the scene (`siSceneFilter`), enumerates that scene's
elements, keeps objects (`siObjectFilter`) and returns the first one: the
active scene root.

### View manager addressing (S)

The four viewports live in the layout view named `View Manager`
(`Desktop.ActiveLayout.Views.Find("View Manager")`). View attributes used in
this batch:

| Attribute | Access | Meaning |
|-----------|--------|---------|
| `focusedviewport` | get / set | letter of the focused pane (`A`..`D`; the sequencer layout writes lower-case `d`) |
| `viewportundermouse` | get | letter of the pane under the pointer |
| `suspenddrawing` | set `"true"` / `"false"` | freeze / resume redraw |
| `layout` | set `"alternate"`, `"reset"` | 1-up + 3-down arrangement; reset of the manager |
| `viewport:<letter>` | set | view type shown in the pane, e.g. `Camera Sequencer Editor` |
| `activecamera:<letter>` | set | camera shown in the pane (a built-in name such as `User`, `sequencercamera`, or a camera full name) |

`FGetViewportNameByID` maps a `siViewport` value to a letter: `siViewportA`..
`siViewportD` give `A`..`D`; `siViewportCurrent` gives the `viewportundermouse`
attribute; any other value (including `siViewportFocussed`) gives
`focusedviewport`. Same mapping as in
[cmd-b5f-misc-dsscripts.md](cmd-b5f-misc-dsscripts.md) (`CreateShotCameraAndSwitch`).

## Wire contract

### `ImportPreferences`

Argument `FileName` (default `""`, in/out).

1. Only when the application is interactive **and** `FileName` is empty: open
   the file browser in Open mode with title `Import a Category of
   Preferences`, initial directory `c:\` (hard-coded), filter `xsipref
   (*.xsipref)` / `All Files (*.*)`. A chosen path is written back to
   `FileName`. No choice: raise `siErrCancelled`, nothing imported.
2. `Application.Preferences.Import <FileName>`.

In batch with an empty name step 1 is skipped and the import is called with
the empty string; the outcome is that method's *(not shown by the script)*.
No return value, no logging by the script.

### `ExportPreferences`

| Argument | Default | Dir |
|----------|---------|-----|
| `FileName` | `""` | in/out |
| `Categories` | `""` | in |

Same shape as `ImportPreferences` with: title `Export a Category of
Preferences`, Save mode, and the browser's proposed base file name preset to
the `Categories` string. Then `Application.Preferences.Export <FileName>,
<Categories>`. Cancel raises `siErrCancelled`. The format of `Categories`
(one name or a list) is the object model method's, not interpreted here.

### `RestoreDefaultPreference`

Argument `PreferenceName` (default `""`, in). Calls
`Application.Preferences.RestoreDefault <PreferenceName>` and nothing else.
The registry description says the name may be a category or one preference.
No confirmation box, no logging.

### `InspectPreferences`

Argument `Preference` (default `""`, in). Opens the preferences window.

1. `OpenXSIExplorer` with scope `siExplorerScopeCustom`, viewer `Property
   Editor`, input object `Preferences`, toolbar off, title `Preferences`,
   reuse off. The result is the new view (a relational view).
2. On its sub-view named `explorer`: set attribute `localselection` to
   `"true"` and `FilterMask` to `siSEFilterPropertyNodes`.
3. When `Preference` is not empty, set the explorer attribute `select` to
   `Preference` as given if it contains a dot, otherwise to
   `Preferences.<Preference>`. The right-hand property editor follows the
   explorer's local selection *(inferred from the viewer name and the
   `localselection` attribute)*.

A new window is opened on every call (reuse is off). No return value.

### `SIUpdateCamerasFromGlobalPref`

Argument `InputObjs` (default: the GUID token above, in).

1. Camera list: if the input is empty, every camera in the scene
   (`SIFilter "*", siCameraFilter`); otherwise the input filtered with
   `siCameraFilter`. No camera: return silently.
2. Read three preferences: `Preferences.output_format.picture_standard`,
   `.picture_ratio`, `.roto_pixel_ratio`.
3. For each camera that is not its own parent (a camera whose `Parent` is
   itself is skipped; taken to exclude the built-in view cameras
   *(inferred)*), on its `camera` primitive write, in this order: `aspect` =
   picture ratio, `pixelratio` = roto pixel ratio, `std` = picture standard.
   The order matters: writing `aspect` / `pixelratio` flips `std` to custom,
   so `std` is written last to end on the preference value.

Values are written through the object model (parameter value assignment), not
through `SetValue`, so no `SetValue` lines are logged *(inferred)*. Note the
pixel ratio comes from `roto_pixel_ratio`, whereas `CreateShotCamera`
(CMD-B5f) uses `ir_pixel_ratio`.

### `SIUpdateFxTreesFromGlobalPref`

Argument `InputObjs` (default: the GUID token, in).

1. List: the input items; when empty, every property of type `FxTree` on the
   scene root, then on each model of `ActiveSceneRoot.Models` (which does not
   include the root itself).
2. Read `Preferences.output_format.ir_xres`, `.ir_yres`, `.ir_pixel_ratio`.
3. For each list item whose `Type` is `FxTree`, assign `DefaultWidth` = x
   resolution, `DefaultHeight` = y resolution, `PixelRatio` = pixel ratio.
   Items of another type are ignored without message.

With no FxTree in the scene the preferences are still read and nothing is
written. No return value.

### `SIUpdatePlayControlFromGlobalPref`

No arguments. Reads `Preferences.output_format.frame_step`, `.frame_format`,
`.frame_rate`, then issues three `SetValue` calls in this order:
`PlayControl.Step` = frame step, `PlayControl.Rate` = frame rate,
`PlayControl.Format` = frame format.

### `MakeICETreeBranch`

Argument `Operator` (SingleObj, in). If the operator's `Type` is `ICETree`,
calls `TransferICETree <Operator>, <its Parent3DObject>, 0, True` (registry
arguments of that command: `Operator`, `3DObject`, `Mode` = 0, `Branch` =
true): the tree stays on its own object and becomes a branch tree. Any other
operator type: nothing happens, no message. The result of `TransferICETree`
is discarded.

### `PromoteICETree`

Argument `Operator` (SingleObj, in). Target = the **parent** of the
operator's `Parent3DObject`. If that target is the scene root (compared
against `FGetSceneRoot`) nothing happens. Otherwise, for an `ICETree`
operator, `TransferICETree <Operator>, <target>, 0, True`: the tree moves one
level up the hierarchy as a branch tree. No message in the refused cases.

### `GroupPointClouds`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `Name` | - | `""` | in |
| `Parent` | - | `""` | in |

Returns the new group null; nothing when it does not apply. All errors inside
the procedure are suppressed.

1. Expand the input collection and pass it through `SIFilter` (see the note
   on the filter argument below). Nothing left: return nothing.
2. Keep the items whose `Type` is `pointcloud`. Fewer than two: return
   nothing, no message.
3. Parent: `Parent` if given, else the parent of the first point cloud.
4. Create a null with `SIGetPrim "Null", <Name>, <parent>` (the low-level
   creator: by itself it does not select or inspect).
5. Make all kept point clouds children of the null (`AddChild` on the
   collection).
6. `SelectObj <null>`, then `AutoInspect <null>`.

### `SplitCloud`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObj` | SingleObj | selection | in |
| `Name` | - | `""` (becomes `Effect`) | in |

Purpose: wrap a point cloud under a new null, move its ICE trees to that null
as branch trees, and add a second cloud that the branch trees also drive.
Returns the new null. Errors are suppressed.

1. Expand and filter the input as in `GroupPointClouds` step 1.
2. For each item of type `pointcloud`:
   a. collect the nested objects of its active primitive whose `Type` is
      `ICETree`;
   b. create a null named `Name` (default `Effect`) under the cloud's
      current parent with `GetPrim "Null", <Name>, <parent>`;
   c. make the cloud a child of that null;
   d. for each collected tree: `TransferICETree <tree>, <null>, 0, True`;
   e. `SIDuplicate <cloud>, 1` with hierarchy option `siNoParent` (other
      options at their defaults). The duplicate is made **after** the trees
      left the cloud, so it carries none; where it lands relative to the null
      is `SIDuplicate`'s rule for `siNoParent` (Q5).
3. `SelectObj <null>`, `AutoInspect <null>` (the last null created), which is
   also the return value.

The tree list is not cleared between clouds; with the SingleObj handler only
one cloud is expected, so this has no visible effect *(inferred)*.

Filter argument in both point cloud commands (S): the object filter handed to
`SIFilter` is written as a bare identifier `SceneObject`, not as the string
`"SceneObject"` used elsewhere in the same file, and the file has no such
variable (explicit declaration is switched off). `SIFilter` therefore
receives an empty `Type` and whatever it does with that (use its registry
default `Object`, or fail under the suppressed-error regime) is not shown by
the script; the later `pointcloud` type test is what actually selects the
items. See Q4.

### `SwitchToView`

Argument `ViewName` (default `""`, in). Looks the name up in the active
layout's views; if a view comes back, sets its `visible` to true. Unknown
name: nothing, no message *(the lookup of a missing name may raise; not
guarded)*.

### `SwitchToViewByType`

Argument `ViewType` (default `""`, in). Walks the active layout's views in
order and sets `visible` = true on the **first** one whose `type` equals
`ViewType` (exact string compare), then stops. No match: nothing.

### `GetViewportUnderMouse` (SPEC-PARTIAL)

No registry arguments; returns a value. The handler `ViewMgrViewportProc` is
shared with the registry entry `GetFocusedViewport` (not in this package) and
takes **one** parameter, the name of the view manager attribute to read; its
header comment says the value should be `focusedviewport` or
`viewportundermouse`.

Behaviour of the procedure: find the `View Manager` view of the active
layout; if found, read the named attribute; if the value is a string, return
it (the pane letter `A`..`D`). Otherwise (no view manager, or a non-string
value) the result is the empty object reference.

Missing: neither the registry dump nor the script shows how a command with
zero declared arguments supplies the attribute name. From the description
("Returns the view pane underneath the mouse (or last if mouse not over view
manager)") the command reads `viewportundermouse` *(inferred)*, and
`GetFocusedViewport` reads `focusedviewport` *(inferred)*. See Q1.

### `SetFocusedViewport`

Argument `Viewport` (default `""`, in; the pane letter `A`..`D`). Sets the
view manager attribute `focusedviewport` to the given string. No validation;
without a `View Manager` view in the active layout the call fails with a
script error (not guarded). No return value.

### `SetCameraSequencerLayout`

| Argument | Default (`siViewport`) | Dir |
|----------|------------------------|-----|
| `EditorViewportID` | `siViewportA` | in |
| `SequencerCameraViewportID` | `siViewportB` | in |
| `CameraEditingViewportID` | `siViewportC` | in |
| `UserViewportID` | `siViewportD` | in |

Does nothing unless the application is interactive. No return value.

1. If the active layout is not named `Camera Sequencer`, make the layout of
   that name the active one.
2. Map the four arguments to pane letters with `FGetViewportNameByID`.
3. On the view manager, in this order:
   - `suspenddrawing` = `"true"`;
   - `layout` = `"alternate"` (1-up + 3-down), then `layout` = `"reset"`;
   - `viewport:<editor letter>` = `Camera Sequencer Editor`;
   - if the object `Views.View<seq letter>.sequencercamera` resolves:
     `activecamera:<seq letter>` = `sequencercamera`;
   - read the scene's renderable cameras
     (`ActiveProject.ActiveScene.RenderableCameras`) and the current
     sequencer frame (`PlayControl.CurrentSequencer`); call `GetShotClip
     <frame>` and take its `Clip` and `ActiveCamera` outputs;
   - if a shot camera came back: `activecamera:<editing letter>` = that
     camera's full name; otherwise, if there is at least one renderable
     camera, the first one's full name; otherwise the pane is left alone;
   - if there is at least one renderable camera:
     `activecamera:<user letter>` = `User`;
   - `focusedviewport` = `d` (lower-case and fixed: it does not follow
     `UserViewportID`);
   - `suspenddrawing` = `"false"`.

The "is there a view manager" test in the script cannot fail (it compares a
type name with the empty string), so a layout without one produces a script
error instead of a silent skip *(inferred)*.

### `PlotCameraSequencer`

| Argument | Default | Dir |
|----------|---------|-----|
| `StartFrame` | 1.0 | in/out |
| `EndFrame` | 100.0 | in/out |
| `PlotWithoutGaps` | false | in |
| `SequencerCameraName` | `SequencerCamera_Plot` | in |
| `ApplyToCamera` | true | in |
| `Apply` | true | in, **unused** (the script says so itself) |

Purpose: bake everything the camera sequencer drives over a sequencer range
into plain scene animation, then remove the sequencer-era animation clips.
No return value. Steps, in order:

1. `Unlock "Scene_Root", siLockLevelAll, , True` (remove all locks, so locked
   clips can be deleted).
2. `PlotCamSeqToActions` with: no input objects, action name
   `CamSeq_PlotAction`, start, end, without-gaps, `siStandardFCurve`,
   `siCubicInterpolation`, fit off, fit tolerance 0.01, process continuous
   rotations on, `Apply` **off**, `Delete` off. Result: a collection of
   action sources, kept for step 8 (they are applied only after the camera
   plot so that the camera animation is not disturbed).
3. `PlotCamSeqForCachedObjects` with path template
   `[project path]\Simulation\CamSeqSimulationPlot\[model]\[object]\[object]_#.icecache`,
   start, end, without-gaps, no attribute list, global kinematics on. Result
   kept for step 9. Contract in [cmd-19a-seqcam.md](cmd-19a-seqcam.md).
4. `PlotCamSeqShape` with: no input, name `CamSeq_PlotShape`, start, end,
   without-gaps, apply keys on, `siShapeBlendedWeightMode`,
   `siShapeContentAllDeforms`, `siShapeAbsoluteReferenceMode`.
5. `PlotSequencerCamera <start>, <end>, "SequencerCamera_Plot_Action",
   <SequencerCameraName>, <without gaps>, <ApplyToCamera as boolean>`
   ([cmd-19a-seqcam.md](cmd-19a-seqcam.md)); its result is one item (camera)
   or two (camera, new clip).
6. Collect, over every model of the scene plus the scene root, every mixer
   clip whose type is `siClipAnimationType` or `siClipAnimCompoundType`
   (models without a mixer are skipped). If step 5 returned two items, take
   the second (the plotted camera's clip) out of the collection.
7. If the collection is not empty, `DeleteObj` it in one call. From here on
   errors are suppressed.
8. For each action from step 2 that is a real object: `ApplyAction <action>`
   with no explicit target, `Consider Time` false and
   `RemoveLayerAnimation` true; then `DeleteObj <action>`.
9. If step 3 returned exactly three values: `ApplyCamSeqFileCacheSources`
   with those three values in order.
10. `SetValue "PlayControl.In", <start>` and `SetValue "PlayControl.Out",
    <end>`.

Shape, audio and other clip types are not deleted in step 7. `StartFrame` /
`EndFrame` are in/out because the plot commands of steps 2 and 4 declare them
in/out and may adjust them; the values used in step 10 are whatever they hold
then *(inferred from the registry flags of `PlotCamSeqToActions` and
`PlotCamSeqShape`)*.

### `ManCharacterOnUpdate`

Update callback of a scripted operator in the stock "Man" character rig, not
a user command. Arguments (all in): `UpdateContext`, `InMesh`, `InOuter`,
`InUpper`, `Out`.

- `InMesh` value: the mesh primitive; `InOuter`, `InUpper` values: two
  clusters, of which only the **first element** of each is used as a point
  index into the mesh geometry. A non-cluster input logs `Expected cluster,
  got <type name>` and the callback carries on.
- With P = position of the outer point and Q = position of the upper point,
  it computes d = square root of ( |Px - Qx| + |Py - Qy| ). This is as
  shipped: absolute differences, not squares, and Z is ignored.
- `Out` value is a kinematic state; its `sclx`, `scly`, `sclz` are all set to
  d / F + 0.005, where F is the value of the operator's custom parameter
  `Eye_scaling_factor` (read from `UpdateContext`).

### `BipedRigOnUpdate`

Update callback of the foot-roll scripted operator in the stock biped rig.
Arguments (all in): `UpdateContext`, `InHandle` (the roll angle h, a number),
`Out` (the output port). S = value of the operator parameter `SteppingAngle`
(from `UpdateContext.Parameters`). The result depends on the **name of the
output port**:

| `Out.Name` | Output value |
|------------|--------------|
| `heel_out` | h when h <= 0, else 0 |
| `toe_out` | h - S when h >= S, else 0 |
| `mid_out` | 0 when h <= 0; h when 0 < h < S; S when h >= S |
| any other | output not written |

So negative roll goes to the heel, the first S degrees to the mid (ball)
joint, and the remainder to the toe.

### `InfoGeometry`, `ParamBracketing`

No arguments. Both call `OpenNetView <factory path> +
<page>, False, 1` (URL, `Reuse` false, `Flags` 1), the path built with
`XSIUtils.BuildPath` from `Application.InstallationPath(siFactoryPath)`:

| Command | Page |
|---------|------|
| `InfoGeometry` | `/Application/views/html/InfoGeometry.htm` |
| `ParamBracketing` | `/Application/views/html/ParamBracketing.htm` |

A new Net View is opened each time. What the pages display is the pages'
own script, outside this batch.

### `InspectLocks`

Argument `InputObj` (Collection, selection when empty, in). Errors
suppressed. First `AddToSelection <InputObj>` (so the objects are selected:
the page reports on the selection), then `OpenNetView <factory
path>/Application/views/html/InfoLocks.htm, True, 1` (`Reuse` true: an
already open Net View is reused).

### `RenamePropAndRebind`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `Properties` | Collection | selection | in |
| `NewName` | - | `""` | in/out |
| `UpdateRefs` | - | true | in/out |
| `UpdateWildcards` | - | false | in/out |
| `ShowUI` | - | false | in/out |

Without UI: calls `RenamePropAndRebind_Internal <Properties>, <NewName>,
<UpdateRefs>, <UpdateWildcards>` (C++; registry description: rename the
property and update all materials, render maps, shaders etc. that reference
it) and nothing else.

With `ShowUI` true, before that call:

1. If `NewName` is empty it becomes the current `Name` of the **first**
   property.
2. Command logging is switched off (user preference `SCR_MSGLOG_ENABLED`
   saved, set false), a property from preset `RenamePropertyDialog` is added
   to the scene root under the name `Rename` with `SIAddProp`, and logging is
   restored.
3. The dialog property's parameters are primed with three `SetValue` calls:
   `newname` = `NewName`, `updaterefs` = `UpdateRefs`, `updatewildcards` =
   **an empty value**: the script reads a misspelled variable here, so the
   `UpdateWildcards` argument never reaches the dialog and the checkbox shows
   the result of assigning an empty value *(off, inferred)*.
4. The property is shown modally (`InspectObj` in `siModal` mode). Title:
   `Rename multiple properties` when more than one property was given, else
   `Rename <NewName>` (passed through the translator as a key).
5. OK: `NewName`, `UpdateRefs`, `UpdateWildcards` are read back from
   `newname`, `updaterefs`, `updatewildcards` (and returned to the caller,
   being in/out); the dialog property is deleted with `DeleteObj`; the
   internal command runs with the dialog values.
   Cancel: the dialog property is deleted and `siErrCancelled` is raised;
   nothing is renamed.

With several properties they all receive the same `NewName`; how the internal
command makes names unique is not shown.

### `RenamePropAndRebindUI`

Arguments `Properties`, `NewName`, `UpdateRefs`, `UpdateWildcards` as above
(no `ShowUI`). Calls `RenamePropAndRebind` with the same four values and
`ShowUI` = true. Same as that command's UI path; the values chosen in the
dialog come back through the in/out arguments.

### `SavePivotKey`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection | selection | in |
| `Type` | - | `siScl` (`siTransformFilter`) | in |
| `Time` | - | none | in/out |

Purpose: key the pivot and pivot-compensation parameters of the local
transform, with stepped curves.

1. Key frame K = value of `Project.Data.PlayControl.Key` (the playback
   "key" frame, not necessarily the current frame).
2. `Type` 0 is replaced by `siSRT`. Parameter groups are chosen by bitwise
   tests of `Type` against the `siTransformFilter` constants:

| Group | Selected when `Type` shares a bit with any of | Local kinematics parameters |
|-------|-----------------------------------------------|-----------------------------|
| scaling | `siScl`, `siSRT`, `siSR`, `siST` | `psclx`, `pscly`, `psclz`, `pcsclx`, `pcscly`, `pcsclz` |
| rotation | `siRot`, `siSRT`, `siSR`, `siRT` | `protx`, `proty`, `protz`, `pcrotx`, `pcroty`, `pcrotz` |
| translation | `siTrn`, `siSRT`, `siST`, `siRT` | `pposx`, `pposy`, `pposz`, `pcposx`, `pcposy`, `pcposz` |

   Because the test is "any common bit" and not equality, which groups a
   given `Type` yields depends on the numeric values of the constants (Q6).
3. For each object, each selected group (scaling, rotation, translation
   order), each parameter in the listed order:
   - if the parameter has a source that is not an fcurve, log warning
     `Cannot save key, <source name> on <parameter>` and skip it;
   - otherwise `SaveKey "<object>.kine.local.<param>", K, <current value of
     the parameter>`, then set the **whole** resulting fcurve's interpolation
     to `siConstantInterpolation`.
4. If `Time` differs from K: `Time` is set to K (returned to the caller) and
   `SetValue "Project.Data.PlayControl.Current", K` moves the timeline there.

No return value. The registry's display name ("Save Pivot Key on Scl") and
default belong to this one entry; the same procedure serves the other
transform types through `Type`.

### `TransferShapeAnimation`

Arguments (all in, no handlers): `SourceObject`, `DestinationObject`,
`SourceShapeKeys`, `DestinationShapeKeys`.

Validation, in order; each failure logs an error and ends the command without
raising:

| Condition | Logged text (error) |
|-----------|---------------------|
| source and destination are the same object | `TransferShapeAnimation: the destination needs to be different than the target.` |
| either shape list is not an object (collection) | none, silent return |
| the two lists (after `Unique` is set on both, removing duplicates) differ in count | `TransferShapeAnimation: you need to provide the same amount of shapes.` |
| a source item is not a shape key | `TransferShapeAnimation: origin shapes needs to be shape key.` |
| a source shape key's parent 3D object is not the source object | `TransferShapeAnimation: origin shapes needs to be shapes nested under the origin object.` |
| a destination item is not a shape key | `TransferShapeAnimation: destination shapes needs to be shape key.` |
| a destination shape key's parent 3D object is not the destination object | `TransferShapeAnimation: destination shapes needs to be shapes nested under the destination object.` |

All source items are checked before any destination item. Then
`SITransferShapeAnimation <SourceObject>, <DestinationObject>,
<SourceShapeKeys>, <DestinationShapeKeys>` (C++, same four arguments) does
the transfer; shapes are paired by position in the two lists *(inferred from
the equal-count rule)*. Side effect: the caller's two collections have their
`Unique` flag turned on.

### `GetShaderOnCnxPointFunction`

Argument `InputObj` (SingleObj, in). Returns the result of
`SIGetShaderOnCnxPoint <InputObj>` unchanged (C++ command with the same
single argument). A pure function-style alias; no other behaviour.

### `LockEnvelopeDeformerWeights` (SPEC-PARTIAL)

Registry (script entry): arguments `PropObj`, `Deformers` (no handlers, no
defaults), `Locked` (default true); returns a value; key-assignable; handler
`LockEnvelopeDeformerWeightsProc` in `uixsiscripts.vbs`.

The script does **not** define that procedure: the only occurrence of the
name is a block that is entirely commented out (and is not valid as written).
No other script under `DSScripts` defines it. The registry holds a second
entry with the same scripting name, language C++ (`PropObj` with a SingleObj
handler, `Deformers`, `Locked` = true, returns a value, not key-assignable),
which is the one that can actually run *(inferred)*.

What the dead block documents, as intent only (not live behaviour): four
parameters (weight property, deformers, lock flag, and an "exclusive" flag
meaning lock / unlock all other deformers, which neither registry entry
has); when no weight property is given, find it from the selection as the
`envweights` input of the object's `envelopop` operator; when no deformers
are given, a pick session with prompt `Pick deformers to lock`; then hand
over to the native command of the same name.

Missing: the live behaviour is entirely in the C++ command (lock state
storage, return value, effect of `Locked` = false), and which of the two
same-named entries the dispatcher picks is not shown. See Q7.

## Enable conditions and errors

None of the commands has a registry enable condition.

| Command | Error / cancel behaviour |
|---------|--------------------------|
| `ImportPreferences`, `ExportPreferences` | browser cancelled: `siErrCancelled` |
| `RenamePropAndRebind` (UI), `RenamePropAndRebindUI` | dialog cancelled: temporary property deleted, `siErrCancelled` |
| `TransferShapeAnimation` | logged errors listed above, no raise |
| `SavePivotKey` | warning per parameter driven by a non-fcurve source |
| `ManCharacterOnUpdate` | info log on a non-cluster input |
| `GroupPointClouds`, `SplitCloud`, `InspectLocks` | all errors suppressed inside the procedure |
| `PlotCameraSequencer` | errors raised by steps 1 to 6 propagate; from step 7 on they are suppressed |
| `SetCameraSequencerLayout` | silently does nothing in batch (not interactive) |
| `SetFocusedViewport`, `GetViewportUnderMouse`, `SwitchToView*`, `InspectPreferences`, `InfoGeometry`, `ParamBracketing` | need a desktop layout / UI; behaviour under XSIBATCH not shown *(inferred: script error or no-op)* |

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | How `GetViewportUnderMouse` / `GetFocusedViewport` (zero registry arguments) supply the attribute name to the one-parameter shared handler | command registration data in the binaries (hidden fixed argument), or a live call of both commands |
| Q2 | What the default token `{F1D7703B-083A-42B9-841D-49FE3779CECD}` becomes at call time (empty list assumed) | binary pass on the command argument layer; it is used by 105 arguments |
| Q3 | Object model methods `Preferences.Import` / `Export` / `RestoreDefault`: file format of `.xsipref`, form of the `Categories` string, behaviour with an empty file name | binary pass on the preferences object; sample `.xsipref` from a live session |
| Q4 | `SIFilter` called with an empty filter type (`GroupPointClouds`, `SplitCloud`): default `Object` filter, or failure that the suppressed-error flow walks through | `SIFilter` binary contract; golden on both commands |
| Q5 | `SplitCloud`: where the `SIDuplicate` copy lands with `siNoParent`, its name, and how the branch trees on the null reach it | `SIDuplicate` and `TransferICETree` contracts (both C++, not yet mapped); golden |
| Q6 | Numeric values of `siScl`, `siRot`, `siTrn`, `siSR`, `siST`, `siRT`, `siSRT` (decides the group table of `SavePivotKey` under bitwise tests) | type library / `xsi_decl.h` |
| Q7 | `LockEnvelopeDeformerWeights`: live C++ contract, and which of the two same-named registry entries wins | binary pass on the C++ command; dispatcher rule for duplicate names |
| Q8 | `RenamePropertyDialog` preset: parameter types / labels / layout; uniqueness rule of `RenamePropAndRebind_Internal` for several properties | preset / SPDL of the dialog property; `shadertasks.dll` (`RenameAndRebindTask`) |
| Q9 | `TransferICETree` `Mode` values (0 used here) and exact meaning of `Branch` | binary pass on `TransferICETree` |
| Q10 | `PlotCamSeqToActions`, `PlotCamSeqShape`, `GetShotClip`: contracts (return shapes, frame adjustment through the in/out arguments) | same binary family as CMD-19a |
| Q11 | Content and data sources of `InfoGeometry.htm`, `ParamBracketing.htm`, `InfoLocks.htm` | read the three HTML pages (separate UI row) |
| Q12 | Localized texts for the four translator keys of this batch | full decode of `XSISCRIPTS.dict` |

Q2 to Q6 and Q8 to Q12 concern values or delegated commands outside the
script; the script-level behaviour of 26 commands is fully read. Q1 and Q7
are the reasons for the two SPEC-PARTIAL entries.
