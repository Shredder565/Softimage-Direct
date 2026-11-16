# CMD-B5f: miscellaneous script commands in `DSScripts` (tools, visibility, chains, envelopes, UV rows, keyable flags, retarget, shot cameras, user data)

Row: **CMD-B5f** (cross-category batch grouped by implementing script). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

18 scripting names (20 registry entries) implemented in VBScript under
`Application\DSScripts`. All are thin orchestration over commands and object
model calls; the contracts below say which ones, with which values, in which
observable order.

| Command | Category | Script | Procedure |
|---------|----------|--------|-----------|
| `DuplicateTool` | Edit | `tools.vbs` | `DuplicateTool` |
| `DrawPrimitiveTool` (3 entries) | Modeling | `tools.vbs` | `DrawPrimitiveTool` |
| `DrawImplicitPrimitiveTool` | Modeling | `tools.vbs` | `DrawImplicitPrimitiveTool` |
| `DrawNullTool` | Modeling | `tools.vbs` | `DrawImplicitPrimitiveTool` (same procedure) |
| `UnhideAllPolygons` | Viewing | `layers.vbs` | `UnhideAllPolygonsProc` |
| `UnhideAllPolygonClusters` | Viewing | `layers.vbs` | `UnhideAllPolygonClustersProc` |
| `AppendBone` | Animation | `chains.vbs` | `AppendBoneProc` |
| `SymEnvWeight` (2 entries) | Deformation | `enveloping.vbs` | `SymmetryEnvelopeWeightProc` (scripted), `UISymmetryEnvelopeWeightProc` (key-assignable UI entry) |
| `SelectUVRow` | Selection | `selection.vbs` | `SelectUVRowProc` |
| `SetKeyableAttributes` | Property, Animation | `parameters.vbs` | `SetKeyableAttributesProc` |
| `RetargetRigToRig` | Animation | `animation.vbs` | `RetargetRigToRigProc` |
| `RetargetTagRig` | Animation | `animation.vbs` | `RetargetTagRig` |
| `TogglePinObjectInPosition` | Constraint | `animation.vbs` | `TogglePinObjectInPositionProc` |
| `CreateShotCamera` | Primitive | `primitives.vbs` | `CreateShotCameraProc` |
| `CreateShotCameraAndSwitch` | Primitive | `primitives.vbs` | `CreateShotCameraAndSwitchProc` |
| `GetPrimCameraWithoutInterest` | Primitive | `primitives.vbs` | `GetPrimCameraWithoutInterestProc` |
| `CreateUserDataMap` | Property | `UserDataScripts.vbs` | `CreateUserDataMapFunc` |
| `SIInspectUserData` | Property | `UserDataScripts.vbs` | `InspectUserDataSub` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, description |
| (S) | the nine scripts above, the listed procedures and every helper they call, read from the install | steps, constants, logged texts, called commands |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` (22,212 bytes; records are a big-endian 32-bit id followed by a zero-terminated UTF-16LE string) | status-line and dialog texts for the ids the scripts translate |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out.

| Command (display name) | Key-assignable | Returns a value |
|------------------------|----------------|-----------------|
| `DuplicateTool` (Duplicate Tool) | yes | no |
| `DrawPrimitiveTool` (Draw Primitive Tool) | no | no |
| `DrawPrimitiveTool` (Surface Sphere Tool; defaults `Sphere`, `NurbsSurface`) | yes | no |
| `DrawPrimitiveTool` (Surface Grid Tool; defaults `Grid`, `NurbsSurface`) | yes | no |
| `DrawImplicitPrimitiveTool` (Draw Implicit Primitive Tool) | no | no |
| `DrawNullTool` (Null Tool; default `Null`) | yes | no |
| `UnhideAllPolygons`, `UnhideAllPolygonClusters` | yes | no |
| `AppendBone` (Append Bone) | no | yes |
| `SymEnvWeight` (Apply Symmetry on Envelope Weight), scripted entry | no | yes |
| `SymEnvWeight`, UI entry (no argument handlers) | yes | yes |
| `SelectUVRow` (Select UV Row) | yes | no |
| `SetKeyableAttributes` | no | no |
| `RetargetRigToRig`, `RetargetTagRig` | yes | no |
| `TogglePinObjectInPosition` (Toggle Pin Object in Position) | yes | no |
| `CreateShotCamera` (Create Camera Without interest) | yes | yes |
| `CreateShotCameraAndSwitch` (Create Camera without Interest and Switch) | yes | yes |
| `GetPrimCameraWithoutInterest` (Camera Perspective Without Interest) | no | no (outputs through arguments) |
| `CreateUserDataMap` (Create User Data Property) | no | yes |
| `SIInspectUserData` (Low Level Inspect User Data Command) | no | no |

All are enabled with no enable condition in the registry.

### Translated texts (D), dictionary `XSISCRIPTS`

| Id | Text | Used by |
|----|------|---------|
| 1071 | A symmetry mapping template was not found. Do you want to create one? | `SymEnvWeight` (UI entry) |
| 1072 | Symmetry Mapping Template Not Found | `SymEnvWeight` (UI entry), box title |
| 1073 | Create Symmmetry Mapping Template (spelling as shipped) | template options dialog title |
| 1130 | Select U Row (supports Shift/Ctrl) | `SelectUVRow`, left-button prompt |
| 1131 | Select V Row (supports Shift/Ctrl) | `SelectUVRow`, middle-button prompt |
| 1154 | Pick Copy Position | `DuplicateTool` |
| 1155 | Pick Draw Position | the three draw tools |
| 1163 | User Data Values for Selected Components | `SIInspectUserData`, dialog title |
| 1530 | You cannot create a new camera from the current active view. | `CreateShotCameraAndSwitch` |
| 1531 | Created camera has a different aspect/pixel ratio from the scene render options | `CreateShotCamera` |

### Pick-position loop (S)

`DuplicateTool` and the draw tools share one interaction: call `PickPosition`
with a single prompt, read `ButtonPressed`, `PosX`, `PosY`, `PosZ` from its
result, act, and ask again. `ButtonPressed` = 0 (right button or Escape) ends
the command; any other button acts. There is no limit on the number of picks.
Each iteration's work is done through ordinary commands, so each placed object
is its own set of logged / undoable commands.

## Wire contract

### `DuplicateTool`

Purpose: place copies of objects at picked positions.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `SelectionList` | Collection (empty means current selection) | selection | in |

1. If the list is empty, log `Nothing to Duplicate. Select an object first.`
   (plain info) and stop.
2. Run the pick-position loop with prompt 1154.
3. For each pick and each input item, in list order: `SIDuplicate` the item
   with 1 copy and the hierarchy option `siNoParent`; then `CutObj` the copy
   (so the copy always ends up under the scene root, whatever the duplicate
   did); then set the copy's `kine` `posX`, `posY`, `posZ` shorthand
   parameters to the picked position with three `SetValue` calls.
4. If the copy has a property named `DynamicsInitState`, its `posx`, `posy`,
   `posz` parameters are also set to the picked position.

All items get the same position (they are stacked, not offset). No return
value, selection is whatever `SIDuplicate` leaves.

### `DrawPrimitiveTool` (also "Surface Sphere Tool", "Surface Grid Tool")

| Argument | Default | Dir |
|----------|---------|-----|
| `PresetObj` | `""` (`Sphere` / `Grid` on the two tool entries) | in |
| `GeometryType` | `""` (`NurbsSurface` on the two tool entries) | in |
| `Name` | `""` | in |
| `Parent` | `""` | in |

Pick-position loop with prompt 1155. On each pick: `CreatePrim PresetObj,
GeometryType, Name, Parent`, then set the new object's `kine` `posX`, `posY`,
`posZ` to the picked position. Selection and inspection follow `CreatePrim`
(the new object is selected, auto-inspect applies). No return value.

### `DrawImplicitPrimitiveTool`, `DrawNullTool`

Arguments `PresetObj` (default `""`; `Null` for `DrawNullTool`), `Name`,
`Parent` (both `""`), all inputs. Same loop and prompt (1155) as above, but
the object is made with `GetPrim PresetObj` only: **`Name` and `Parent` are
accepted and ignored**, so every object gets the preset's default name under
the scene root. Position is set as above. No return value.

### `UnhideAllPolygons`

No arguments; works on the current selection. For each selected item, resolve
its 3D object (a sub-component selection gives its owning object; a 3D object
is used as is; anything else gives its parent 3D object). Look up the cluster
`<object full name>.polymsh.cls.<siInvisiblePolygonsClusterName>` (the
internal cluster that the interactive Hide Polygons command maintains; the
constant's value comes from the type library). If it exists, delete it with
`DeleteObj`; if not, do nothing for that item. Deleting the cluster removes
its `clsvisibility` property, which is what makes the polygons visible again.
No message, no return value, selection unchanged *(inferred: `DeleteObj` of a
non-selected cluster does not alter the selection)*.

### `UnhideAllPolygonClusters`

No arguments. Issues two `SetValue` calls on the selection wildcard path
`.[obj].polymsh.cls.*.clsvisibility.<p>` with value `True`, for `p` =
`viewvis` then `rendvis`. Errors are suppressed, so selected objects without
any cluster visibility property are silently skipped. Clusters are kept (only
their visibility parameters change); this also re-shows the internal hidden
polygon cluster without deleting it.

### `AppendBone`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `Ex`, `Ey`, `Ez` | - | 0.0 | in (new effector position) |
| `Pin` | - | `True` | in |

1. Filter the input with `SIFilter(…, "chain_element", True)`.
2. Require at least one element that is the **last** element of its skeleton
   (`GetSkeleton` reports the element's index; last index = effector). If
   the filter result is empty or no effector is found, log
   `AppendBone: parameter 0 must contain a skeleton effector` (error) and
   return nothing.
3. Call `SIAppendBone(<filtered chain elements>, Ex, Ey, Ez, Pin, <value of
   user preference SI3D_ALIGN_ROOT_1ST_BONE>)`; its result is the return value.
4. If the result is empty, log `AppendBone: an error occured while adding the
   bone` (error; spelling as shipped) and stop.
5. Otherwise `AddToSelection <result>, "NODE", True`.

The geometry of the new bone is `SIAppendBone`'s (C++, not in this batch).

### `SymEnvWeight`

Purpose: mirror envelope weights across a plane using a symmetry mapping
template (a `MappingTemplate` property named `SymmetryMappingTemplate`, type
`siMixerPropType`, that pairs deformers).

| Argument | Scripted entry handler | Default | Dir |
|----------|------------------------|---------|-----|
| `PropObj` | SingleObj | none | in/out |
| `SubComp` | Collection | none (selection) | in/out |
| `MappingTemplate` | SingleObj | none | in/out |
| `SymmetryAxis` | - | 0 | in/out |

Axis values: 0 = YZ plane (mirror X), 1 = XZ (mirror Y), 2 = XY (mirror Z).

Scripted entry:

1. Only when `MappingTemplate` is empty: for each item of `SubComp`, find the
   "deformer model": the owning 3D object of the item (point sub-component or
   point cluster), its first envelope, that envelope's first deformer, that
   deformer's model; the scene root when any link is missing. If that model
   has no property of type `siMixerPropType` and an axis was supplied, call
   `CreateSymmetryMappingTemplate <item>, True, SymmetryAxis, <create map>`,
   where *create map* is true only when `PropObj` is empty.
2. For each item of `SubComp`, in order: `SISymEnvWeight PropObj, <item>,
   MappingTemplate` (C++; does the weight mirroring).

UI entry: identical, except that in step 1 a missing template raises a Yes/No
box (text 1071, title 1072, default Yes); on Yes it runs the interactive
template creation: requires exactly one selected item (else logs `Please
Select an item first`, error), shows the `CreateSymmetryMappingTemplate`
property (parameters `Axis`, `FillTemplate`, `CreateSymmetryMap`; added to the
scene root, shown modally with title 1073, deleted afterwards whatever the
answer), on OK calls `CreateSymmetryMappingTemplate` with the dialog values
and auto-inspects the new template locked. On No it goes straight to step 2.

`CreateSymmetryMappingTemplate` (same file, not counted in this row) behaviour
relied on here: adds the template property to the deformers' model (to the
object's model, unfilled, when the envelope has no deformers or the input is a
model); when filling, pairs each deformer with its mirror using scale
`(-1,1,1)`, `(1,-1,1)` or `(1,1,-1)` for axis 0/1/2; when asked for a map,
mutes the first envelope (`DeactivateAbove … True`), calls `CreateSymmetryMap
"SymmetryMap", <object>, "Symmetry Map", "Symmetry Map Property"`, sets
`<map>.symmetrymapop.axis` to the axis and un-mutes the envelope.

Return value: none is produced by either procedure although the registry says
the command returns one *(inferred: the caller receives an empty value)*.

### `SelectUVRow`

No arguments. Interactive, repeats until cancelled.

1. `SetSelFilter "Point"`.
2. `PickElement "Point"` with left prompt 1130 and middle prompt 1131.
   Right button / Escape (button 0) ends the command; the Point filter stays
   active.
3. The picked text must contain point indices in the parenthesised NURBS
   form, `object.pnt[(u,v)]` on a surface or `object.pnt[(s,u,v)]` on a
   surface mesh (comma-separated lists of such tuples are handled tuple by
   tuple). If no tuple is found, log `Please pick one or more point(s) on a
   surface or surface mesh.` and pick again.
4. Build a row string from each tuple:
   - left button: keep everything but the last index and replace the last
     index with `*` (`(u,*)`, `(s,u,*)`);
   - middle button: replace the index before the last with `*` and keep the
     last (`(*,v)`, `(s,*,v)`).
5. Apply it according to the modifier reported by the pick: none `SelectObj`;
   Shift (1) `AddToSelection`; Ctrl (2) `ToggleSelection`; Shift+Ctrl (3)
   `RemoveFromSelection`; any other value `SelectObj`.

Which of the two wildcard forms is called "U" on screen is fixed by the
prompts above (left = "U Row").

### `SetKeyableAttributes`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `Params` | - | `""` | in |
| `Attribute` | - | `siKeyableAttributeKeyable` (`siKeyableAttributeType`) | in |

1. Empty / missing input list: log `No valid objects on input list`, raise
   `siErrCancelled`.
2. If `Params` is empty, use the current marking (`GetMarking`), joined with
   commas; with no marking it stays empty.
3. Resolve parameters with the collection's
   `FindObjectsByMarkingAndCapabilities(<params>)` over the input objects.
4. For every resolved item that is a parameter:

| `Attribute` | Capability changes |
|-------------|--------------------|
| `siKeyableAttributeClear` | clear `siKeyable` and `siNonKeyableVisible` |
| `siKeyableAttributeKeyable` | clear `siNonKeyableVisible` if set, then set `siKeyable` |
| `siKeyableAttributeNonKeyableVisible` | clear `siKeyable` if set, then set `siNonKeyableVisible` |
| anything else | log `Invalid input attribute`, raise `siErrCancelled` (parameters already processed keep their change) |

The two flags are therefore mutually exclusive after this command. No return
value; nothing is selected or inspected.

### `TogglePinObjectInPosition`

Argument `ConstrainedObj` (Collection, selection when empty, in/out).

For each input object whose name does not contain `TEMP_PIN`:

- If it has a position constraint (`poscns`) whose constraining object has
  `TEMP_PIN` in its name, remember that constraining object (un-pin case).
- Otherwise (pin case): read the object's global position; add a `Sphere`
  primitive named `TEMP_PIN` under the scene root (later ones get the usual
  numeric suffix), set its `radius` to 0.2 and its global position to the
  object's; add a `Position` constraint on the object with the sphere as
  constraining object, **without** compensation.

After the loop, all remembered pin spheres are deleted with one `DeleteObj`
(their constraints go with them). Objects named like a pin are ignored. No
return value, no selection change by the script itself.

### `RetargetTagRig`

Argument `InputObjs` (Collection, selection when empty, in).

1. Keep only models (`SIFilter` with `siModelFilter`).
2. If none: `SetSelFilter "Model"`, `DeselectAll`, then a pick session
   (`PickElement "Model"`, left prompt `Select model to tag`, no middle
   prompt) that ends at the first successful pick or on cancel; left button
   adds the pick to the selection, middle removes it. If the selection is then
   empty: `DeselectAll`, `SetSelFilter "object"`, log `You must select at
   least one rig (model) to tag.` (error), stop. Otherwise the models are the
   current selection.
3. For each model: if it already has a property named `TaggingTool`, open it
   with `InspectObj`; otherwise run the command `TaggingTool <model>` (creates
   and shows that property; C++/plug-in, not in this batch).
4. `DeselectAll`, `SetSelFilter "object"`.

### `RetargetRigToRig`

Argument `InputObjs` (Collection, selection when empty, in).

1. Source and target model: walk the input in order, mapping each item to
   itself if it is a model, else to its owning model. The first model found
   is the source, the first *different* one the target. A model named
   `Scene_Root` counts as "not given".
2. `DeselectAll`. For each of source and target still missing, run a model
   pick session (prompt `Select Source Model` / `Select Target Model`, middle
   prompt `Deselect`). If the pick yields no model: log `You must select a
   model, or part of a model.` (error), `SetSelFilter "object"`, stop.
3. Same model twice: log `Source and target models must be different`
   (error), reset the filter to `object`, stop.
4. `SetSelFilter "object"`.
5. A rig is "tagged" when the model or any descendant carries a property
   named `RetargetingTag`. If either rig is untagged: log `Source rig has not
   been tagged. Launching tagging tool` and / or `Target rig has not been
   tagged. Launching tagging tool` (warnings), run `RetargetTagRig` on each
   untagged model, and stop without retargeting.
6. Otherwise collect, depth-first from each model, every object that has a
   `RetargetingTag` property, and apply one operator:
   `ApplyOp "SimpleIKRetargetOp", "<A> ; <B> ; <C> ; <D>"` with four
   connection groups:
   - A: all tagged source objects (comma list, traversal order);
   - B: all tagged target objects;
   - C: source model, target model;
   - D: the tagged target objects whose tag property parameter `Type` is 1
     to 7 (output group).
7. `DeselectAll`.

`RetargetingTag.Type` values: 1 normal (FK child), 2 centre of gravity,
3 anchor, 4 end effector, 5 friction, 6 free, 7 up vector. The tag property
also has a `tag` parameter (the tag label); the script reads it but pairing
by label is left to the operator. No return value.

### `CreateShotCamera`

Purpose: make a new scene camera that matches an existing camera (typically a
viewport camera), with or without an interest.

| Argument | Default | Dir |
|----------|---------|-----|
| `SourceCamera` | `""` (full name of the camera to copy) | in |
| `DestCamera` | `""` (name for the new camera) | in |
| `WithoutInterest` | `True` | in |

Returns the new camera object.

1. Camera preset: `<factory path>\Data\DSPresets\Primitives\Camera.Preset` if
   that file exists, else the preset name `Primitives\Camera`.
2. With an interest only: create a `Null` named `<DestCamera>_Root` under the
   scene root and match its translation to the source camera
   (`MatchTransform … siTrn`). This null is the parent of what follows;
   without an interest the parent is the scene root.
3. Create the camera with `GetPrim <preset>, DestCamera, <parent>` and
   `MatchTransform` it fully to the source camera.
4. With an interest only: rename the root null to `<actual camera
   name>_Root` if the camera name was made unique; create a `Null`
   `<camera name>_Interest` under the root null; place it at the camera's
   transform moved by `(0, 0, -interestdist)` along the camera's local axes,
   where `interestdist` is the source camera's value; apply a `Direction`
   constraint from camera to interest with compensation on, then set the
   constraint's `dirz` to -1 and `upvct_active` to true.
5. Set the camera's local `rotorder` to 4.
6. Picture format. If the source is **not** one of the built-in viewport
   cameras (full name, case-insensitive, `Views.View{A|B|C|D}.{Top|Front|Right|User|Spot}Camera`):
   take `std`, `aspect`, `pixelratio` from the source primitive and, if
   `aspect` or `pixelratio` differs by more than 0.001 from
   `Passes.RenderOptions.ImageAspectRatio` / `ImagePixelRatio`, log warning
   1531. If it **is** a built-in viewport camera: take them from the
   preferences `output_format.picture_standard`, `output_format.picture_ratio`,
   `output_format.ir_pixel_ratio`. Write `std`; write `aspect` and
   `pixelratio` only when `std` is 0 (custom).
7. Copy from the source primitive: `fov`, `fovtype`, `interestdist`, `near`,
   `far`, `proj`, `orthoheight`. Set `autokey` to true.
8. Copy the `Camera Display` and `Camera Visibility` properties parameter by
   parameter (by script name; only string, boolean, floating-point and integer
   value types; parameters missing on the destination are skipped), then
   force `Camera Visibility.objcameras` to false on the new camera.
9. Without an interest: set `autoupdatecoidist` to false if the parameter
   exists.

No selection or inspection is done by the script beyond what `GetPrim` does.

### `CreateShotCameraAndSwitch`

| Argument | Default | Dir |
|----------|---------|-----|
| `Viewport` | `siViewportFocussed` (`siViewport`) | in |
| `CameraName` | `""` | in |
| `DestViewport` | `siViewportCurrent` | in |
| `WithoutInterest` | `True` | in |

1. Map `Viewport` to a view letter through the view manager (`vm`) view:
   `siViewportA`..`D` give `A`..`D`; `siViewportCurrent` gives the attribute
   `viewportundermouse`; anything else gives `focusedviewport`.
2. Read the view manager attribute `activecamera:<letter>`. If that is not
   the name of a camera object, try `Views.View<letter>.<value>Camera`. If
   that is not a camera either, log error 1530 and return nothing.
3. Run the `CreateShotCamera` behaviour with that source, `CameraName` and
   `WithoutInterest`.
4. `SetViewCamera <new camera full name>, DestViewport`.
5. Return the new camera.

### `GetPrimCameraWithoutInterest`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `PresetObj` | Preset | `Camera` | in |
| `Name` | - | `""` (becomes `Camera`) | in |
| `Parent` | - | `""` | in |
| `Primitive` | - | - | out |
| `3DObjCamera` | - | - | out |

1. `GetPrim PresetObj, Name, Parent` gives the camera object (`3DObjCamera`
   output and the procedure's result); `Primitive` output is its active
   primitive.
2. Set the primitive's `autoupdatecoidist` to false.
3. `SelectFilter` with the conditional object filter, then `SelectObj
   <camera>, "BRANCH"`.
4. `AutoInspect <camera>` with keyword `General`.

No camera root and no interest are created (contrast `GetPrimCamera`, which
builds `<Name>_Root`, the camera and `<Name>_Interest`).

### `CreateUserDataMap`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObj` | Collection (selection when empty) | selection | in |
| `PropertyName` | - | `UserData` | in |
| `Template` | SingleObj | none | in/out |

Returns an `XSICollection` of the created properties (empty on failure).

1. Keep only clusters (`SIFilter` with `siClusterFilter`). None: log
   `CreateUserDataMap requires clusters as the input` (info), return the
   empty collection.
2. For each cluster, add a `UserDataMap` property (not branch) named
   `PropertyName`.
3. If `Template` was given: when it is a custom property, assign it as the
   map's template; otherwise log `Ignoring template argument because it is not
   a custom property` (info) and leave the map without template.

### `SIInspectUserData`

Arguments `UserDataMap`, `SubComp` (both SingleObj inputs). Edits, through a
modal property page, the user data stored on the given components.

1. Validation, each failing with an error log and no change:
   `UserDataMap` is not a user data map: `Invalid argument - a User Data Map
   should be specified`; `SubComp` (after unwrapping a collection item) is not
   a sub-component: `Invalid argument - a SubComponent should be specified`;
   the map has no template: `User Data Map does not have an associated Custom
   Property`.
2. Translate each component index of `SubComp` to its position in the map's
   parent cluster (-1 when the component is not in the cluster). If none maps:
   `Selected components are not part of the cluster` (error).
3. Initialise the template custom property from the **first** mapped
   component: if that map item holds data, load it into the property's binary
   data (on mismatch: `Failed to initialize Custom Property from User Data
   contents.  Data does not match Custom Property parameters.`, error, stop);
   if the item is empty, reset every template parameter to its default.
4. Show the template property modally with title 1163. Cancel ends the
   command with nothing written.
5. On OK, read the property's binary data and write it to **every** mapped
   component's item (indices beyond the map's item count are skipped).

The data blob is exactly the template property's `BinaryData`; its layout is
the property's, not specified here. The template property keeps the last
edited values afterwards.

## Enable conditions and errors

None of the commands has a registry enable condition. Interactive commands
(`DuplicateTool`, draw tools, `SelectUVRow`, pick paths of the two retarget
commands, `SIInspectUserData`, UI entry of `SymEnvWeight`) need a user
session; in batch mode the pick / dialog calls fail or return "cancelled"
*(inferred; no XSIBATCH run)*.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Value of `siInvisiblePolygonsClusterName` (type-library constant used by `UnhideAllPolygons`) | `xsi_decl.h` / type library, or a dump after Hide Polygons |
| Q2 | `SymEnvWeight` return value as seen by a caller, and what `SISymEnvWeight` does with an empty `PropObj` | binary pass on `SISymEnvWeight`; golden |
| Q3 | Deformer pairing tolerance and tie-break in `CreateSymmetryMappingTemplate` fill (position mirror match) | separate row for the symmetry template commands in `enveloping.vbs` |
| Q4 | Behaviour of the interactive commands under XSIBATCH (error vs. silent cancel) | golden |
| Q5 | `SimpleIKRetargetOp`: port layout matching the four connection groups, and how tag labels are paired | operator SPDL + binary; belongs to the MOTOR / retarget row |
| Q6 | `TaggingTool` command and `RetargetingTag` property definition | `CDKMotionTransform.64.dll` batch |

Q1 to Q6 concern values or delegated commands outside these scripts; the
script-level behaviour of all 18 commands is fully read.
