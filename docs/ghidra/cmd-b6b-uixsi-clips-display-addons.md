# CMD-B6b: `uixsiscripts.vbs` commands for image / model sources and clips, reference planes, display toggles, add-ons, presets, transform matching

Row: **CMD-B6b** (batch grouped by implementing script). Status: **SPEC** (27 names), **SPEC-PARTIAL** (1 name, `DisplayPortValues`).
Run: 2026-11-17, `si-analyst`, unattended.

28 scripting names (45 registry entries) implemented in VBScript in
`Application\DSScripts\uixsiscripts.vbs`. Most are thin wrappers: a low-level
command or object-model call, followed by selection and auto-inspection, or a
read-modify-write of one preference or parameter.

| Command | Entries | Category | Procedure |
|---------|---------|----------|-----------|
| `CreateImageClip2` | 1 | File, Texturing | `CreateImageClipProc2` |
| `AddImageSource` | 1 | File, Texturing | `CreateImageSourceProc` |
| `AddWritableImageSource` | 1 | File, Texturing | `CreateWritableImageSourceProc` |
| `AddModelSource` | 1 | File | `CreateModelSourceProc` |
| `CreateModelClip` | 1 | File | `CreateModelClipProc` |
| `AddModelClip` | 1 | File | `AddModelClipProc` |
| `LoadPreset` | 1 | File, Property | `LoadPresetProc` |
| `InstallAddon` | 1 | File | `InstallAddonProc` |
| `UnInstallAddon` | 1 | File | `UnInstallAddonProc` |
| `CreateReferencePlane` | 1 | Modeling | `CreateRefPlaneProc` |
| `SetTransientReferencePlane` | 1 | Modeling | `SetTransientRefPlaneProc` |
| `InspectSnapProperties` | 1 | Manipulation | `InspectSnapProc` |
| `InspectTransformProperties` | 1 | Manipulation | `InspectTransformProc` |
| `InspectViewCubeProperties` | 1 | Manipulation | `InspectViewCubeProc` |
| `MoveCtr2Vertices` | 2 | Manipulation, Transform | `Centre2Vertices` |
| `MatchTransform` | 4 | Manipulation, Transform | `MatchPoseProc` |
| `SetTransformRefMode` | 11 | Modeling, Animation, Property | `SetTransformRefMode` |
| `IncreaseManipulatorSize` | 2 | Viewing | `IncreaseManipulatorSizeProc` |
| `DecreaseManipulatorSize` | 2 | Viewing | `DecreaseManipulatorSizeProc` |
| `ToggleBackgroundColor` | 1 | Viewing | `ToggleBackgroundColorProc` |
| `ToggleFullscreenLayout` | 1 | Viewing | `ToggleFullscreenLayoutProc` |
| `RotoscopyOptions` | 1 | Viewing | `RotoscopyOptionsProc` |
| `SetLightingDisplayMode` | 1 | Viewing | `SetLightingDisplayModeProc` |
| `SetNURBSDisplayQualityDefault` / `Low` / `Medium` / `High` | 1 each | Viewing | `SetNURBSDisplayQualityProc` (shared) |
| `DisplayPortValues` | 2 (1 script, 1 C++) | Simulation | `GetInputAndDisplayPortValuesProc` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, number of entries per name |
| (S) | `uixsiscripts.vbs`: the handler procedures above and their helpers (`Centre2PointCluster`, `Center2ObjCenter`, `RemoveCluster`, `SIMsgBox`, `FSubComponents2Clusters`, `AutoInspectProc`) | steps, constants, logged texts, called commands |
| (D) | decoded `XSISCRIPTS` dictionary table (172 records, incomplete) | text of id 1159; id 1014 is not in the decoded table |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out. None of the entries has
an enable condition; all are enabled.

| Command (display name) | Key-assignable | Returns a value |
|------------------------|----------------|-----------------|
| `CreateImageClip2` (Create Image Clip from File v2) | no | yes |
| `AddImageSource` (Add Image Source from File) | no | yes |
| `AddWritableImageSource` (Add Writable Image Source) | no | yes |
| `AddModelSource`, `CreateModelClip`, `AddModelClip` | no | yes |
| `LoadPreset` (Load Preset) | yes | no |
| `InstallAddon` (Install Addon), `UnInstallAddon` (UnInstall Addon) | yes | no |
| `CreateReferencePlane` (Create Reference Plane) | yes | yes |
| `SetTransientReferencePlane` (Set Transient Reference Plane) | yes | no |
| `InspectSnapProperties` (Properties...), `InspectTransformProperties` (Properties...), `InspectViewCubeProperties` (ViewCube Properties...) | no | no |
| `MoveCtr2Vertices` (Move Center to Points; Move Center to Bounding Box) | yes | no |
| `MatchTransform` (Match All Global Transforms; Match Global Scaling / Rotation / Translation) | yes | no |
| `SetTransformRefMode` (ten "MCP Setting: ..." entries) | yes | yes (see contract: nothing is produced) |
| `SetTransformRefMode` (MCP Setting: Set Transform Ref/Modifier, default 0) | no | yes (same remark) |
| `IncreaseManipulatorSize`, `DecreaseManipulatorSize` (each also as "... (alternate)") | yes | no |
| `ToggleBackgroundColor`, `ToggleFullscreenLayout`, `RotoscopyOptions`, `SetLightingDisplayMode`, four `SetNURBSDisplayQuality*` | yes | no |
| `DisplayPortValues` (Display Port Values), both entries | no | no |

The six source / clip commands carry a trailing registry argument `Value`
with direction -1 and default `VBScript`: this is the return-value slot of the
registration, not a caller argument (R) *(inferred)*.

### Translated texts (D), dictionary `XSISCRIPTS`

| Id / key | Text | Used by |
|----------|------|---------|
| 1014 (`IDS_SELECT_OBJ_AND_COMPONENTS`) | not decoded | `MoveCtr2Vertices`, empty-input message |
| key `Warning` | looked up by its English text; translated text not decoded (English: `Warning` *(inferred)*) | `MoveCtr2Vertices`, box title |
| 1159 (`IDS_MATCH_POSE_MSG`) | Pick an object to match pose to | `MatchTransform`, pick prompt |

### Auto-inspection and message box helpers (S)

- `AutoInspect <object>` is the scripted command of the same file (not yet in
  the command map). As used here it gets only the object; title, mode
  (`siRecycle`) and keywords (`All`) are its registry defaults (R). It does
  nothing when auto-inspection is disabled; otherwise it opens the property
  page with `InspectObj`, forcing a modal page when the user preference
  `OperationMode` is on and an inspected item is a modeling operator.
- The message-box helper shows a real message box only in an interactive
  session; otherwise it logs `<title>: <prompt>` and answers with the supplied
  default button.

### Low-level commands relied on (R)

All are C++ commands not yet in `COMMAND_DLL_MAP.md`. Their output arguments
come back to the script as a named output list when the command has no return
value.

| Command | Arguments (default; direction) | Output used here |
|---------|--------------------------------|------------------|
| `SICreateImageClip2` | `FileName` (FileName handler; in/out), `Name` (`""`) | return value: collection of clips |
| `SIAddImageSource` | `FileName` (FileName handler; in/out), `Name` (`""`), `Source` (out) | item `Source` of the output list |
| `SIAddWritableImageSource` | `FileName` (in/out), `Name`, `Width` 256, `Height` 256, `Type` `siRenderChannelColorType`, `UseExisting` false, `Source` (out) | item `Source` |
| `SIAddModelSource` | `FileName`, `Name`, `Source` (out), `Resolution` 2 | `Source` |
| `SICreateModelClip` | `FileName` (FileName handler; in/out), `Name`, `Clip` (out) | item `Clip` |
| `SIAddModelClip` | `Source` (SingleObj), `Name`, `Clip` (out) | item `Clip` |
| `SILoadPreset` | `FileName` (in/out), `InputObj` (SingleObj) | none |
| `SICreateRefPlane` | `InputObjs` (Collection) | return value: collection of planes |
| `SetReferencePlane` | `Target` (SingleObj), `InputObj` (Collection) | none |
| `SetCurrentReferencePlane` | `Value` (SingleObj) | none |
| `GetViewCamera` | `View` (-1) | return value: camera |

## Wire contract

### `CreateImageClip2`

| Argument | Default | Dir |
|----------|---------|-----|
| `FileName` | `""` | in/out |
| `Name` | `""` | in |

Calls `SICreateImageClip2 FileName, Name` and returns its result (a collection
of image clips). Then, for each clip of the result in order, `AutoInspect
<clip>`. No selection change is made by the script. The `FileName` argument is
passed through by reference, so whatever the low-level command writes into it
(for example a browsed file name) reaches the caller *(inferred)*.

### `AddImageSource`, `AddWritableImageSource`

`AddImageSource`: `FileName` (`""`, in/out), `Name` (`""`, in).
`AddWritableImageSource`: `FileName` (`""`, in/out), `Name` (`""`), `Width`
(256), `Height` (256), `Type` (`siRenderChannelColorType` of
`siRenderChannelType`), `UseExisting` (false); all but `FileName` are inputs.

1. Call `SIAddImageSource FileName, Name`, respectively
   `SIAddWritableImageSource FileName, Name, Width, Height, Type,
   UseExisting`.
2. Take the `Source` output of that call: it is the return value.
3. If a source was produced: `SelectObj <source>`, then `AutoInspect
   <source>`. If not, nothing more happens and the return value is empty.

### `AddModelSource`

`FileName` (`""`, in), `Name` (`""`, in), `Resolution` (2, in).

Calls `SIAddModelSource FileName, Name, <source out>, Resolution`; the source
is the return value; if one was produced, `SelectObj <source>` then
`AutoInspect <source>`.

### `CreateModelClip`, `AddModelClip`

`CreateModelClip`: `FileName` (`""`, in/out), `Name` (`""`, in).
`AddModelClip`: `Source` (`""`, in), `Name` (`""`, in).

1. Call `SICreateModelClip FileName, Name`, respectively `SIAddModelClip
   Source, Name`.
2. The command's return value is the **output list of that call** (the list
   that contains the item `Clip`), not the clip object itself (S).
3. Create the automation object `XSI.XSIFileService` and call its
   `ReferenceModel` with the `Clip` item. This instantiates the referenced
   model for the clip and yields the model object.
4. If a model was produced: `SelectObj <model>, "BRANCH"`, then `AutoInspect
   <model>`.

### `LoadPreset`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `PresetObj` | - | `""` | in/out |
| `InputObj` | Collection (selection when empty) | selection | in |

For each object of `InputObj`, in order: `SILoadPreset PresetObj, <object>`.
One low-level call per object; no other step. With an empty input collection
nothing is called. The preset name is handed over by reference on every call,
so a value written back by the first call is the one used for the following
objects *(inferred)*.

### `InstallAddon`, `UnInstallAddon`

`InstallAddon`: `FileName` (`""`, in/out), `InstallPath` (7, in).
`UnInstallAddon`: `FileName` (`""`, in/out).

Each makes exactly one object-model call: `Application.InstallAddon FileName,
InstallPath`, respectively `Application.UnInstallAddon FileName`. No
validation, no message, no return value; errors are those of the object-model
method.

### `CreateReferencePlane`

`InputObjs` (Collection, selection when empty, in). Returns the collection of
new planes.

1. `SICreateRefPlane InputObjs` gives a collection of reference planes.
2. For each non-empty plane, in order: `SetCurrentReferencePlane <plane>`,
   then `AutoInspect <plane>`. The last plane created is therefore the current
   one at the end.
3. Return the collection.

### `SetTransientReferencePlane`

`InputObjs` (Collection, selection when empty, in). No return value.

Two calls: `SetReferencePlane "RefPlanes.Transform", InputObjs` (redefines the
built-in transient plane from the given objects / components), then
`SetCurrentReferencePlane "RefPlanes.Transform"`.

### `InspectSnapProperties`, `InspectTransformProperties`, `InspectViewCubeProperties`

No arguments. Each is one `InspectObj` call with only the object given
(keywords, title and mode left to the command's defaults):

| Command | Inspected object |
|---------|------------------|
| `InspectSnapProperties` | `Preferences.SnapProperties` |
| `InspectTransformProperties` | `Preferences.TransformProperties` |
| `InspectViewCubeProperties` | `Preferences.ViewCube` |

### `MoveCtr2Vertices` (Move Center to Points / Move Center to Bounding Box)

Purpose: move an object's centre, without moving its geometry, to the middle
of its points or of a chosen set of points.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `BoundingBox` | - | false ("Points" entry), true ("Bounding Box" entry) | in |

Target position, computed in **global** space from the object's global
transform applied to each point position:

- `BoundingBox` false: arithmetic mean of the points;
- `BoundingBox` true: midpoint of the axis-aligned bounding box of the points
  (running extremes start at +/-10,000,000, so a point set with no points
  gives the origin).

The centre is then moved with
`Translate <object>, x, y, z, siAbsolute, siGlobal, siCtr, siXYZ`.

Steps:

1. Empty input: log text 1014 (info), show it in a message box (OK button,
   exclamation icon, title = translation of `Warning`), stop.
2. Split the input: clusters already selected (`SIFilter` with `cluster`);
   tagged sub-components, which are turned into new temporary clusters with
   `CreateClusterFromSubComponent <sub-components>, , False`.
3. Neither clusters nor sub-components: for **each** input item, use all the
   points of the object's geometry and move its centre as above. Done.
4. Temporary clusters exist: issue `Refresh` first (forces evaluation so that
   deformed positions are read). For each temporary cluster in order:
   - not a point cluster (type other than `pnt`): log `Tagged components are
     not valid for this operation.` (info) and **end the whole command** (the
     remaining temporary clusters are not removed and selected clusters are
     not processed);
   - point cluster: use the cluster's points, move the centre of the owning
     object, then delete the temporary cluster with `DeleteObj`.
5. Selected clusters exist: for each, if it is not a point cluster log
   `Cluster <cluster> is not valid for this operation.` (info) and continue;
   otherwise use its points and move the owning object's centre. Selected
   clusters are kept.

Steps 4 and 5 can both run in one call. Objects that are selected whole are
ignored as soon as the input also contains a cluster or sub-component. The
owning object of a cluster is found by walking six parent levels up from the
cluster with `EnumElements <item>, False` (S). No return value.

### `MatchTransform` (Match All Global Transforms / Match Global Scaling / Rotation / Translation)

Purpose: give the input objects the scaling, rotation and / or translation
values of a target object.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `TargetObj` | - | `""` | in/out |
| `Type` | - | `siSRT` (`siTransformFilter`); `siScl`, `siRot`, `siTrn` on the three other entries | in |
| `LocalReference` | - | false | in |

1. Empty input: log `Please select an object first` (error), stop.
2. `TargetObj` empty: start a pick session, `PickElement` with no filter, left
   prompt 1159, no middle prompt; the picked element becomes the target and is
   written back to `TargetObj`. The script does not test for a cancelled pick;
   the following reads then fail on an empty target *(inferred)*.
3. Channels to copy: scaling when `Type` has a bit in common with any of
   `siScl`, `siSRT`, `siSR`, `siST`; rotation likewise with `siRot`, `siSRT`,
   `siSR`, `siRT`; translation with `siTrn`, `siSRT`, `siST`, `siRT`.
4. Read the user preference `SI3D_SRT_CENTER` (centre manipulation mode).
5. Space: `LocalReference` true uses `kine.local` and `siLocal`, otherwise
   `kine.global` and `siGlobal`.
6. For each input object, in order (scaling, then rotation, then translation):

| Channel | Values read from the target | Written to the object, centre mode off | Centre mode on |
|---------|-----------------------------|----------------------------------------|----------------|
| scaling | `sclx`, `scly`, `sclz` of the chosen space | three `SetValue` on the object's `sclx`, `scly`, `sclz` of the same space | `Scale <obj>, x, y, z, siAbsolute, <space>, siCtr, siXYZ` |
| rotation | `rotx`, `roty`, `rotz` of the chosen space | `Rotate <obj>, x, y, z, siAbsolute, <space>, siObj, siXYZ` | same with `siCtr` |
| translation | `posx`, `posy`, `posz` of the chosen space | three `SetValue` on `posx`, `posy`, `posz` | `Translate <obj>, x, y, z, siAbsolute, <space>, siCtr, siXYZ` |

   Rotation in local space: before reading, the target's
   `kine.local.rotorder` is set to 0 (XYZ) and afterwards restored to its
   previous value, so the read angles are XYZ Euler angles. These two
   `SetValue` calls on the **target** happen once per input object, even when
   the order was already 0.
7. Referenced models: for each object the script finds its model (the object
   itself when it is a model, else `SIGetModel`) and reads the model's
   `referenced_model` parameter. When true, after each channel the object's
   three `kine.local` values of that channel are read and written back
   unchanged with `SetValue`, so that the change is recorded on the local
   parameters *(purpose inferred)*.

No return value, no selection change.

### `SetTransformRefMode`

Purpose: set the transform reference mode and the transform modifiers kept in
one user preference.

| Argument | Default | Dir |
|----------|---------|-----|
| `Mode` | per entry, see below | in |

| Entry (display name after "MCP Setting: ") | `Mode` |
|--------------------------------------------|--------|
| Set Transform Ref Global | 1 |
| Set Transform Ref Local | 2 |
| Set Transform Ref Reference | 3 |
| Set Transform Ref View | 4 |
| Set Transform Ref Parent | 6 |
| Set Transform Ref Plane | 7 |
| Set Transform Modifier COG | 16 |
| Set Transform Modifier Scaling UNI | 256 |
| Set Transform Modifier Scaling VOL | 1024 |
| Set Transform Modifier Sym | 2048 |
| Set Transform Ref/Modifier (not key-assignable) | 0 |

The preference is `3D_TRANSFO_REFERENTIAL_CHANGED`, read with `GetUserPref`
and written with `SetUserPref`. Its value is split into a reference part (low
four bits, mask 15) and a modifier part (mask 4080, bits 4 to 11).

- `Mode` of 15 or less: new value = `Mode` + current modifier part (reference
  replaced, modifiers kept).
- `Mode` above 15: if every bit of `Mode` is already set in the current
  modifier part, new value = current reference part alone; otherwise new value
  = `Mode` + current reference part. In both cases the previous modifier part
  is **discarded as a whole**: turning one modifier on drops any other
  modifier, and "toggling off" clears all of them.

The preference is always written, even when unchanged. The procedure produces
no value although the registry announces one *(inferred: the caller receives
an empty value)*.

### `IncreaseManipulatorSize`, `DecreaseManipulatorSize`

No arguments; two identical registry entries each (plain and "(alternate)").
Read `Preferences.TransformProperties.transformsize` with `GetValue`.

- Increase: add 10; write it with `SetValue` only if the result is at most
  100.
- Decrease: subtract 10; write it only if the result is greater than 0.

Outside those limits nothing is written and nothing is logged (no clamping to
the limit).

### `ToggleBackgroundColor`

No arguments. Reads `Preferences.SceneColors.backgroundcol`. If it is 0
(black), writes 2139062271 (hex 7F7F7FFF, mid grey); for any other value
writes 0. One `GetValue`, one `SetValue`. A custom colour is not remembered.

### `ToggleFullscreenLayout`

No arguments. If the name of the desktop's active layout is `Autohide`, make
the layout named `Default` the active one; otherwise make `Autohide` active.
Done through the object model (`Application.Desktop.ActiveLayout`), no command
is logged by the script. Any layout other than `Autohide` is left for
`Autohide`, and the way back always goes to `Default`, not to the layout that
was active before.

### `RotoscopyOptions`

No arguments. `GetViewCamera` (default view) gives the camera; if its
`camdisp.rotoenable` is false, set it to true with `SetValue`; then
`InspectObj "<camera>.rotoscope"`.

### `SetLightingDisplayMode`

No arguments. `GetViewCamera` (default view); if the camera's
`camdisp.headlight` is true, set it to false. It never turns the headlight on.

### `SetNURBSDisplayQualityDefault`, `SetNURBSDisplayQualityLow`, `SetNURBSDisplayQualityMedium`, `SetNURBSDisplayQualityHigh`

One procedure; the four names differ only by the default of the single input
argument `Quality`: Default 0, Low 1, Medium 2, High 3.

Works on the current selection (read as `SelectionList`), filtered with
`SIFilter` once for `curve` and once for `surface_mesh`.

| `Quality` | Curves: `geomapprox.gapproxvwcustep` | Surfaces: `geomapprox.gapproxvwustep` and `gapproxvwvstep` |
|-----------|---------------------------------------|-------------------------------------------------------------|
| 1 (Low) | 3 | 1 |
| 3 (High) | 9 | 6 |
| anything else (0 Default, 2 Medium) | 6 | 3 |

For each curve, then each surface: only if the current value differs (for a
surface, if either of the two differs), call `MakeLocal
"<object>.geomapprox"` and then `SetValue` the parameter(s). Objects already
at the wanted values are untouched (no local property is created). Default and
Medium behave identically. `MakeLocal` is the scripted command of the same
file, which may ask for confirmation when the property is shared (see Q6).

### `DisplayPortValues` (script entry)

Purpose: modal "Show Values" dialog for an ICE port; the actual display is
switched by a call to `DisplayPortValues` with 27 arguments.

Registry arguments (R), all in/out except `Port`:

| Argument | Default | Argument | Default |
|----------|---------|----------|---------|
| `Port` (SingleObj, in) | none | `UseRange` | false |
| `Enable` | true | `RangeStart` | 0 |
| `Mode` | 0 | `RangeEnd` | 10000 |
| `ClearLabel` | false | `RangeStep` | 1 |
| `Label` | `""` | `SelectedOnly` | false |
| `Position` | 0 | `SubArray` | false |
| `OffsetX`, `OffsetY` | 0 | `ArrayStart` | 0 |
| `Scale` | 1.0 | `ArrayEnd` | 10 |
| `SkipDefault` | false | `Global` | false |
| `UseColor` | true | `DrawOnTop` | true |
| `ColorR`, `ColorG`, `ColorB`, `ColorA` | 0.62, 1.0, 0.62, 1.0 | `ModifiedOnly` | false |
| | | `Percentage` | 100 |

The procedure takes **three further inputs after these 27**: the port's data
type, its context and its structure. They are not registry arguments; how the
caller supplies them is not shown by the script (Q1).

Constants (S):

- Context: 1 singleton, 2 component 0D, 4 component 1D, 8 component 2D,
  32 subset master node. Structure: 2 = array.
- Display modes: 0 numeric, 1 normals (vectors), 2 points, 3 point trails,
  4 axes, 5 axis + angle, 6 colours, 7 nulls, 8 normals + length, 9 axis +
  numeric angle, 10 vector trails, 11 lines.
- Label position: 0 Above, 1 Below, 2 Left, 3 Right.

Data type labels shown in the dialog (by `siICENodeData...` type): Bool
`Boolean`, Long `Integer`, Float `Scalar`, Vector2 `Vector 2D`, Vector3
`Vector 3D`, Vector4 `Vector 4D`, Matrix33 `Matrix 3D`, Matrix44 `Matrix 4D`,
Quaternion `Quaternion`, Rotation `Rotation`, Color4 `Color`, Location
`Location`, Shape `Shape`, String `String`, Icon `Icon`. Any other type: the
command raises `siErrCancelled`.

Display modes offered ("Display As" list, in this order, label then value):

| Data type, context, structure | Choices |
|-------------------------------|---------|
| Location, array | Points 2, Lines 11, Nulls 7, Numeric 0 |
| Location, not array | Points 2, Nulls 7, Numeric 0 |
| Vector3, context 32, array | Points 2, Lines 11, Nulls 7, Numeric 0 |
| Vector3, context 32, not array | Points 2, Nulls 7, Numeric 0 |
| Vector3, other context, array | Points 2, Lines 11, Point Trails 3, Vector Trails 10, Vectors 1, Vectors + Length 8, Nulls 7, Numeric 0 |
| Vector3, other context, not array | Points 2, Point Trails 3, Vector Trails 10, Vectors 1, Vectors + Length 8, Nulls 7, Numeric 0 |
| Vector4 | Points 2, Nulls 7, Numeric 0 |
| Quaternion, Rotation | Axis + Angle 5, Axis + Numeric Angle 9, Axes 4, Numeric 0 |
| Matrix33, Matrix44 | Axes 4, Numeric 0 |
| Color4 | Colors 6, Numeric 0 (and if the incoming `Mode` is 6, `UseColor` is forced to false) |
| all others | Numeric 0 |

Steps:

1. Add a custom property named `ShowValues` to the scene root (not in
   branch). This happens **before** the data type check, so an unsupported
   type leaves the property behind (S).
2. Validate the data type (above) and choose the display mode list.
3. Add the parameters, initialised from the incoming arguments:

| Parameter | Type | Initial value | Range / notes |
|-----------|------|---------------|---------------|
| `Applied` | bool | false | internal flag, set by the Apply button |
| `Port` | string | `Port` | read-only |
| `Type` | string | data type label | read-only |
| `Show` | bool | `Enable` | |
| `DisplayMode` | int | `Mode` | |
| `Label` | string | `Label` | |
| `ScaleFactor` | float | `Scale` | slider 0.001 to 10 |
| `UseColor` | bool | `UseColor` | |
| `ColorR`, `ColorG`, `ColorB`, `ColorA` | float | colour arguments | |
| `UseRange` | bool | `UseRange` | |
| `RangeStart`, `RangeEnd` | int | range arguments | minimum 0, slider 0 to 10000 |
| `RangeStep` | int | `RangeStep` | minimum 1, slider 1 to 20 |
| `SkipDefault`, `SelectedOnly` | bool | arguments | |
| `OffsetX`, `OffsetY` | int | arguments | slider -100 to 100 |
| `LastPosition` | int | `Position` | internal, previous label position |
| `Position` | int | `Position` | |
| `SubArray` | bool | `SubArray` | |
| `ArrayStart`, `ArrayEnd` | int | arguments | minimum 0, slider 0 to 10 |
| `Global`, `DrawOnTop`, `ModifiedOnly` | bool | arguments | |
| `Percentage` | int | `Percentage` | 1 to 100 |

   The boolean, mode, colour and position parameters are created
   non-animatable *(reading of the parameter-creation arguments, inferred from
   the object-model signature)*.
4. Layout, top to bottom (view size 400 x 500):
   - row: `Show` ("Show"), `Type` (no label), button `Apply`;
   - `DisplayMode` list "Display As"; `ScaleFactor` "Scale Factor";
     `Percentage` "Display %";
   - row: `Label` "Label", `Position` list (Above / Below / Left / Right, no
     label);
   - row: `OffsetX` "Label Offset", `OffsetY` (no label);
   - row: `UseRange` "Range", `RangeStart`, `RangeEnd` (no labels);
     `RangeStep` "Step";
   - only when the structure is array, row: `SubArray` "Array Range",
     `ArrayStart`, `ArrayEnd`;
   - row: `UseColor` "Custom Color", colour widget on `ColorR` (with alpha);
   - check boxes `Global` "Use Global Coordinates for Display", `DrawOnTop`
     "Draw Values On Top of Shaded Objects", `SkipDefault` "Skip Default
     Values During Display", `ModifiedOnly` "Show Values Computed at Current
     Frame Only", `SelectedOnly` "Show Values for Tagged Components Only";
   - static text `NOTE: '#' in the label will be replaced by the item id for
     display.`
5. Dialog behaviour:
   - Display mode 0: scale factor disabled, custom colour and colour enabled.
     Mode 6: scale factor, custom colour and colour disabled. Any other mode:
     scale factor enabled (colour controls unchanged).
   - `UseRange` enables / disables range start, end and step; `SubArray`
     enables / disables array start and end; `UseColor` enables / disables the
     colour widget. These four rules are also applied when the page opens.
   - Changing `Position` rotates the label offset so that it keeps its sense
     relative to the item: to the opposite side (Above/Below, Left/Right) both
     offsets are negated; Above to Left, Left to Below, Below to Right, Right
     to Above give (x, y) -> (-y, x); Left to Above, Above to Right, Right to
     Below, Below to Left give (x, y) -> (y, -x). `LastPosition` then takes the
     new position.
   - `Apply` sets `Applied` and calls `DisplayPortValues` with the 27 current
     dialog values (`ClearLabel` true), leaving the dialog open.
6. Open the property modally: `InspectObj <property>, , "Show Values",
   siModal, False`.
7. OK: copy every dialog value back into the in/out arguments, set
   `ClearLabel` to true, and call `DisplayPortValues` with the 27 values.
8. Cancel after at least one Apply: call `DisplayPortValues` with the 27
   **incoming** values (the arguments were not updated), which puts the
   display back as it was on entry *(purpose inferred)*. Cancel without Apply:
   no call.
9. `DeleteObj <property>` in all three cases.
10. Cancel: raise `siErrCancelled`.

Why SPEC-PARTIAL: the script calls a command of its own name with 27
arguments, and the registry holds a C++ command with that name and the same 27
arguments (all inputs, no defaults, description "Turns on/off display of port
data in the 3D view."). Which entry a plain `DisplayPortValues` call reaches,
and who passes the three extra inputs to the script procedure, is not visible
in the script (Q1, Q2).

## Enable conditions and errors

No registry enable condition on any entry. Explicit messages:

| Command | Condition | Message | Severity |
|---------|-----------|---------|----------|
| `MoveCtr2Vertices` | empty input | text 1014 (logged and shown in a box titled `Warning`) | info |
| `MoveCtr2Vertices` | tagged components are not points | `Tagged components are not valid for this operation.` | info, command ends |
| `MoveCtr2Vertices` | selected cluster is not a point cluster | `Cluster <cluster> is not valid for this operation.` | info, continues |
| `MatchTransform` | empty input | `Please select an object first` | error |
| `DisplayPortValues` | unsupported data type; dialog cancelled | none (`siErrCancelled` raised) | - |

All other failures are those of the called commands and object-model methods
(missing camera in `RotoscopyOptions` / `SetLightingDisplayMode`, missing
layout in `ToggleFullscreenLayout`, bad file in the source / clip / add-on /
preset commands); the script neither traps nor rewords them. `MatchTransform`
without a target and `DisplayPortValues` need a user session *(inferred; no
XSIBATCH run)*.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | `DisplayPortValues`: who supplies the three extra procedure inputs (data type, context, structure), and from which UI gesture | binary pass on the ICE tree view (caller of the script entry); golden |
| Q2 | `DisplayPortValues`: resolution between the script entry and the C++ entry of the same name; contract of the C++ entry | binary pass on the C++ command; own row |
| Q3 | Text of dictionary id 1014 and the translated `Warning` key | finish decoding `XSISCRIPTS.dict` |
| Q4 | Numeric values of `siScl`, `siRot`, `siTrn`, `siSR`, `siST`, `siRT`, `siSRT` (the `MatchTransform` channel test is a bit test against each of them, so combined values matter) | `xsi_decl.h` / type library |
| Q5 | Meaning of `InstallAddon` `InstallPath` 7 and of the other path values | type library (`siInstallationPath`), `Application.InstallAddon` reference |
| Q6 | `MakeLocal` and `DeleteObj` are scripted commands of the same file with confirmation logic: do they prompt in the uses above (`geomapprox` made local, temporary cluster deleted) | rows covering `MakeLocalProc` / `DeleteObjProc` |
| Q7 | Contracts of the low-level commands (`SICreateImageClip2`, `SIAddImageSource`, `SIAddWritableImageSource`, `SIAddModelSource`, `SICreateModelClip`, `SIAddModelClip`, `SILoadPreset`, `SICreateRefPlane`, `SetReferencePlane`, `SetCurrentReferencePlane`), including file browsing on an empty `FileName` | binary pass, own rows |
| Q8 | `XSIFileService.ReferenceModel`: what it creates for a model clip and where | binary pass / SDK reference |
| Q9 | Bit meaning of the modifier values 32, 64, 128, 512 of `3D_TRANSFO_REFERENTIAL_CHANGED` and of reference value 5 (no registry entry uses them) | binary pass on the transform panel |
| Q10 | Behaviour of `MatchTransform` when the pick is cancelled, and of the interactive commands under XSIBATCH | golden |

Q3 to Q10 concern values or delegated commands outside these procedures; the
script-level behaviour of the 27 SPEC commands is fully read.
