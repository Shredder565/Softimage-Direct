# CMD-12a: texture projection and texture support script commands

Row: **CMD-12a** (split from CMD-12 Texturing, plus `CreateTextureSpatial` from CMD-01). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

12 script commands that create, connect, fit and show texture projections
(UV properties) and their texture supports. All are VBScript procedures in
`Application\DSScripts\Texture.vbs`; each is a thin layer over C++ "SI…" task
commands, which do the geometry work and are **not** part of this row.

| Command (scripting name) | Display name | Procedure in `Texture.vbs` | Status |
|--------------------------|--------------|----------------------------|--------|
| `CreateTextureProj` | Create Texture Projection | `CreateTextureProjProc` | SPEC |
| `CreateSubprojection` | Create Texture Subprojection | `CreateSubprojectionProc` | SPEC |
| `CameraTextureProj` | Create Camera Projection | `CameraTextureProjProc` | SPEC |
| `ConnectToTextureProj` | Connect to Texture Support | `ConnectToSupportProc` | SPEC |
| `CreateTextureSpatial` | Geometry to Texture | `CreateTextureSpatialProc` | SPEC |
| `CreateTextureUVDomain` | Create Texture UVDomain | `CreateTextureUVDomainProc` | SPEC |
| `FitSubcomponentUVsToImage` | Fit Subcomponent UVs To Image | `FitSubcomponentUVsToImage` | SPEC |
| `ModifyUVSetByContourStretching` (two registry entries) | Modify by Contour Stretching UVW / Interactive Modify by Contour Stretching UVW | `ModifyUVSetByContourStretchingFunc` / `…Proc` | SPEC |
| `HideTextureUVDomains` | Hide Texture Supports | `ToggleVisibilityOfTextureUVDomainsProc` | SPEC |
| `UnhideTextureUVDomains` | Show Texture Supports | same | SPEC |
| `ToggleVisibilityOfTextureUVDomains` | Hide/Unhide Texture Supports | same | SPEC |
| `SetCheckerboardMode` | Set Checkerboard Mode | `SetCheckerboardMode` | SPEC |

`SICreateTextureSpatial` ("Geometry to Texture Task") is **not** in this
script: the registry lists it as C++ with no file. Its call shape is recorded
under `CreateTextureSpatial`; its implementation is left to a binary row
(see new rows).

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display and scripting names, arguments, defaults, handlers, direction flags, return flag, category, handler procedure |
| (S) | `Application\DSScripts\Texture.vbs` (88,691 bytes), the 12 handler procedures and every helper they call, read from the install | steps, constants, log messages, call shapes of the C++ task commands |
| (H) | `XSISDK\include\xsi_decl.h` | enum and class-id values |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` (`strings`, UTF-16) | the two pick prompts |
| - | REA / Ghidra | not used by this batch (script-only) |
| - | XSIBATCH goldens | not run |

No script text is reproduced. Log messages, names, presets and enum values are
recorded as facts.

## Shared facts

### Enum values (H)

| Enum | Values |
|------|--------|
| `siTxtProjType` | `siProjPlanar` 0, `siProjCylindrical` 1, `siProjSpherical` 2, `siProjLollipop` 3, `siProjSpatial` 4, `siProjCubic` 5 |
| `siTxtProjPlane` | `siPlaneXY` 0, `siPlaneXZ` 1, `siPlaneYZ` 2 |
| `siTxtProjFitMethod` | `siRelDefault` 0 (best fit for sub-components, object for objects), `siRelBestFit` 1, `siRelObject` 2, `siRelWorld` 3, `siRelObjectPosObject` 4, `siRelWorldPosObject` 5 |
| other | `siRelative` 1 (delta mode), `siUVW` 7 (axes filter), `siGroupLevel` 0, `siConstructionModeModeling` 0, `siChangeUVInputActionSwim` 0, `siUVPropertyID` 235, `siViewID` 134, `siErrCancelled` 0x4C7 |

### Command flags (R)

All 12 are enabled with no registry enable condition. Key-assignable:
`CameraTextureProj`, `SetCheckerboardMode` and the three visibility commands.
Category `Texturing|Rendering` for all except `SetCheckerboardMode`
(`Texturing`) and `CreateTextureSpatial` (none).

Return flag: only the non-interactive `ModifyUVSetByContourStretching` entry
returns a value. Arguments are inputs (direction 2) unless marked in/out (6)
or output (4) below. An in/out argument is handed back to a scripting caller
through the usual output-argument list.

### C++ task commands called (R, S)

Call shapes only; behaviour belongs to their own rows.

| Task command | Arguments, in order | Returns (named outputs) |
|--------------|---------------------|-------------------------|
| `SIFindUniqueTextureName` | objects, proposed name | `PropertyName`: a UV property name not yet used on any of the objects |
| `SICreateTextureBasicGeo` | preset (default `Texture`), input, support name, property name, parent, projection type, plane, visibility, existing texture projection, *out* support object, *out* properties, fitting | creates a texture support object and a UV property projected through it; when an existing UV property is passed, adds a sub-projection to that property instead |
| `SICameraTextureProj` | objects, property name, camera | `PropertyName`, `3DObjCamera` |
| `SIConnectToSupport` | objects, property name, support | `PropertyName`, `3DObjTexture` |
| `SICreateTextureSpatial` | objects, property name | `PropertyName`, `CreatedObj` |
| `SICreateTextureUVDomain` | preset, objects, support name, property name, visibility | NURBS UV-domain support(s) |
| `SIGetTextureUVDomains` | objects | collection of texture support objects used by the input |
| `ScaleUVW`, `TranslateUVW` | sub-components, UV property, U, V, W, delta mode, axes filter, then (`ScaleUVW`) use-pivot and pivot UVW / (`TranslateUVW`) split-local-components flag | - |
| `ApplyOperator` | preset name, connection set, connect type | the new operator |
| `ChangeUVInput` (through `SwimUVW`) | UV property, action | - |

### Shared script helpers (S), as behaviour

- **Basic projection per object.** Makes the projection name unique across
  all inputs once (`SIFindUniqueTextureName`), then for each input item calls
  `SICreateTextureBasicGeo` with the default preset, that item, the support
  name, the unique property name, the requested type and plane, visibility
  on, and the fitting method. Parent of the new support: with parenting on,
  the item itself, except that for an item of type `poly` (polygon cluster)
  the owning 3D object is used, found by walking up the element hierarchy six
  levels; with parenting off no parent is passed (the task's default applies;
  scene root, *inferred*).
- **Scene root lookup.** The first object-filter child of the first scene
  under `Project`.
- **Cluster from sub-components.** For a sub-component collection item, a new
  cluster named `ContourStretch` is created on the owning object with the
  item's cluster type and mode value 2, and the components are added to it.
- **Relevant UVs of an input** (used by `SwimUVW`): for a 3D object that is
  not a texture support, every `uvspace` property of its sample clusters; for
  a UV property, itself; for a sample cluster, its `uvspace` properties; for a
  polygon or sub-surface cluster, the current UV of its material.

## Wire contract

### `CreateTextureProj`

Purpose: give each input a planar texture projection with its own support.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection (selection when omitted) | - | in |
| `ProjectionName` | - | `Texture_Projection` | in/out |
| `Parenting` | - | True | in |
| `ProjectionType` | - | `siProjPlanar` | in |
| `ProjectionPlane` | - | `siPlaneXY` | in |

Behaviour: runs the *basic projection per object* helper with support name
equal to the projection name as passed in, type **planar**, plane **XY** and
fit method `siRelDefault`. `ProjectionType` and `ProjectionPlane` are accepted
but **ignored**: the result is always planar XY. `ProjectionName` comes back
as the unique name actually used. No return value, no inspection, selection
unchanged by the script. No explicit error handling; errors of the task
command propagate.

### `CreateSubprojection`

Purpose: add a sub-projection for a set of components to an existing UV
property, with optional aspect correction and fit-to-image.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection | - | in |
| `TextureProjection` | SingleObj (the UV property) | - | in |
| `Type` | - | `siProjPlanar` | in |
| `Plane` | - | `siPlaneXY` | in |
| `SupportName` | - | `""` | in |
| `Parenting` | - | True | in |
| `Fitting` | - | `siRelBestFit` | in |
| `FitToImage` | - | False | in |
| `MaintainAspect` | - | False | in |
| `TextureAspectRatio` | - | 1.0 (image x resolution / y resolution) | in |
| `3DObjTexture` | - | - | out: the support object created |

Checks, each logging an error and stopping with nothing created:

| Condition | Message (error severity) |
|-----------|--------------------------|
| no input, or empty input | `Please select items to project` |
| no UV property | `Please select a UV property to create the subprojection on` |
| `Type` not planar, cylindrical, spherical, lollipop or cubic | `Subprojection type <n> not supported.` |

Steps:

1. Parent for the support: the **first** input item when `Parenting` is true,
   otherwise the scene root.
2. `SICreateTextureBasicGeo` is called once with the whole input, the support
   name, an empty property name, that parent, `Type`, `Plane`, visibility on,
   the existing UV property, and `Fitting`. The support created is the output
   argument.
3. Only if `MaintainAspect` is true and a support came back: read the
   support's `GeoX`, `GeoY`, `GeoZ` and multiply each by the support's global
   scaling on the same axis (call the results gx, gy, gz). Let A =
   `TextureAspectRatio`. Then by type:

   | Type | Action |
   |------|--------|
   | cylindrical | su = (3.1415926 · gx) / h where h = gy for planes XY and YZ, gz for plane XZ (su stays 1 if h ≤ 1e-5); sv = A. Normalise so the larger becomes 1 (if sv > su: su = su/sv, sv = 1; else sv = sv/su, su = 1). If either differs from 1, `ScaleUVW` the input on the UV property by (su, sv, 1), relative, UVW filter |
   | spherical | su = 1, sv = 0.5 · A, normalised the same way; `ScaleUVW` is always issued |
   | planar, cubic | multiply by A: gy for plane XY, gz for plane XZ, gy for plane YZ. m = max(gx, gy, gz). Scale the **support object** by (m/gx, m/gy, m/gz) with the `Scale` command (its defaults) |
   | lollipop | nothing |

4. If `FitToImage` is true: `FitSubcomponentUVsToImage` with the UV property,
   the input, `Explicit` = true and `MaintainAspect` as given.

No return value. No inspection.

### `CameraTextureProj`

Purpose: project the texture from a camera and make the projection swim.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection | - | in |
| `Name` | - | `Texture_Projection` | in/out |
| `Camera` | - | `""` | in/out |

Behaviour: calls `SICameraTextureProj(objects, name, camera)`. If it returns a
result, `Camera` becomes the camera object used and `Name` the property name
used. Then, for every input item that is a 3D object, the first property with
that name found on each of its sample clusters is passed to `SwimUVW`, which
applies the swim action (`siChangeUVInputActionSwim`, 0: UV evaluation moved
to the top of the operator stack) to it. Inputs that are not whole 3D objects
get no swim step. If the task returns nothing, nothing else happens. No
return value.

### `ConnectToTextureProj`

Purpose: create a projection on the inputs that reuses an existing texture
support.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection | - | in |
| `Name` | - | `""` | in/out |
| `TextureSupport` | - | `""` | in/out |

Behaviour: calls `SIConnectToSupport(objects, name, support)`. On a result,
`TextureSupport` becomes its `3DObjTexture` and `Name` its `PropertyName`;
otherwise both are left as passed. No return value. (The dialog variant that
asks for a name, titles "Create a projection using an existing texture
support" / "Enter the new texture projection name", is a separate UI
procedure and not this command.)

### `CreateTextureSpatial`

Purpose: "Geometry to Texture": spatial texture coordinates taken from the
object's own geometry.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection | - | in |
| `Name` | - | `""` | in/out |

Behaviour: calls `SICreateTextureSpatial(objects, name)`; on a result, `Name`
becomes the `PropertyName` used. The created object reported by the task is
read and discarded. No return value. `SICreateTextureSpatial` itself (C++;
arguments `InputObj`, in/out `PropertyName`, out `CreatedObj`) is not
specified here.

### `CreateTextureUVDomain`

Purpose: NURBS UV-domain texture support for surfaces.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection | - | in |
| `SupportName` | - | `""` | in/out |
| `PropertyName` | - | `""` | in/out |

Behaviour: if `PropertyName` is empty and `SupportName` is not, the property
name takes the support name. Then
`SICreateTextureUVDomain("NurbsTextureCtrl", objects, SupportName, PropertyName, True)`.
The names are not read back from the task, so the in/out values returned are
the names as passed (after the copy above). No return value.

### `FitSubcomponentUVsToImage`

Purpose: make the UVs of the given components fill the 0..1 image square,
either by editing the UVs or by setting the projection's own transform.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `Properties` | Collection: one UV property or several | - | in |
| `SubComp` | Collection: clusters and/or sub-component selections | - | in |
| `Explicit` | - | False | in |
| `MaintainAspect` | - | False | in |

For each UV property independently:

1. Compute the UV bounding box (umin, vmin, umax, vmax) of the samples named
   by `SubComp`. Each item contributes: its own elements if it is a sample
   (sampled point) cluster or selection; otherwise, for polygons, points or
   edges, every sample of every listed component of the property's geometry.
   Sample index → UV row goes through the element list of the property's
   sample cluster.
2. An item is invalid if it is none of those four component kinds, or if it
   is a polygon / point / edge item that does not belong to the same object
   as the property. On the first invalid item the command logs
   `BindProp: '<item>' is an invalid argument: expecting subcomponents of '<object>'`
   (info severity) and fails with `siErrCancelled`; properties already
   processed keep their changes (inferred: no rollback in the script; the
   command-level undo unit decides).
3. If no sample was found, the property is skipped.
4. Extents: du = umax − umin, dv = vmax − vmin, each replaced by 1 when zero.
   With `MaintainAspect`, both become max(du, dv).
5. `Explicit` = true (edit the UVs): with su = 1/du, sv = 1/dv, on the
   collected samples (one sampled-point sub-component per item)
   - `TranslateUVW` by U = −umin + ((1 − (umax−umin)·su)/2)/sv and
     V = −vmin + ((1 − (vmax−vmin)·sv)/2)/sv, W = 0, relative, UVW filter,
     split-local-components false. Note that the U term divides by **sv**, as
     shipped; with `MaintainAspect` su = sv so this is the centring offset,
     without it both offsets are zero in the non-degenerate case.
   - `ScaleUVW` by (su, sv, 1), relative, UVW filter, pivot enabled at
     (0, 0, 0).
6. `Explicit` = false (edit the projection definition): on the property's
   `projdef`, set `projtrsu` = umin, `projtrsv` = vmin; set `projsclu` = du
   only if umax ≠ umin and `projsclv` = dv only if vmax ≠ vmin; set
   `projrotu` = 0 and `projrotv` = 0.

No return value.

### `ModifyUVSetByContourStretching`

Purpose: re-lay existing UVs of polygon regions by contour stretching between
corner points. Two registry entries share the name:

| Entry | Handler | `CornerPoints` | Returns | Extra |
|-------|---------|----------------|---------|-------|
| "Modify by Contour Stretching UVW" | function | in | collection of the operators created | no picking, no inspection |
| "Interactive Modify by Contour Stretching UVW" | sub | in/out | nothing | corner picking session; auto-inspects the operators |

| Arg | Handler | Default |
|-----|---------|---------|
| `InputObjs` | Collection: polygon clusters or polygon selections | - |
| `TextureProjection` | SingleObj: the UV property | - |
| `ContourStretchingMethod` | - | 0 (written to the operator's `method`) |
| `MaintainAspect` | - | False |
| `CornerPoints` | ConnectionSet: point clusters or selections, one per polygon item | - |

The handler procedures take a sixth, unregistered "on top" value. It is not
supplied by the registry, so the normal operator preset is used *(inferred)*.

Steps:

1. Keep only polygon items of `InputObjs`. If any item was dropped, log error
   `Some of the input objects are invalid.  Need mesh component selections.`
   and stop.
2. If `TextureProjection` is not a UV property (`siUVPropertyID`), log error
   `Invalid UV texture coordinate` and stop.
3. Keep only point items of `CornerPoints`.
4. Interactive entry only: for every polygon item that has no corner item at
   the same index, in order: deselect all, select the item's geometry
   components, set the selection filter to `Polygon`, then run a point pick
   session with prompts "Pick Corner Point" (left, id 1145) and "Unpick Corner
   Point" (middle, id 1146). Left adds the picked points to the selection,
   middle removes them; the session for that item ends on right click /
   escape. If the very first pick of an item is cancelled, picking stops for
   all remaining items. After an item's session the polygon components are
   removed from the selection and what remains is appended as that item's
   corners. Finally the original selection is restored and the selection
   filter is set to `Object`. `CornerPoints` returns the resulting list.
5. If the construction mode is not Modeling (0), switch to Modeling for the
   duration and restore it afterwards.
6. For each polygon item, in order: turn a non-cluster item into a
   `ContourStretch` cluster (shared helper); likewise for its corner item, if
   one exists at the same index. Apply operator preset
   `PolyUVContourStretchingOp` (or `PolyUVContourStretchingOnTopOp` for the
   on-top variant) through `ApplyOperator` at group level with three port
   groups in this order: polygon cluster; the UV property; the corner cluster
   (empty group when the item has no corners). Then set the operator's
   `method` and `maintainaspect` parameters from the arguments.
   Errors inside this loop are suppressed and the loop continues.
7. Function entry: return the operators. Interactive entry: if at least one
   operator was created, `AutoInspect` them.

### `HideTextureUVDomains`, `UnhideTextureUVDomains`, `ToggleVisibilityOfTextureUVDomains`

One handler, three registrations differing only in the default of `Type`.

| Arg | Handler | Default |
|-----|---------|---------|
| `InputObjs` | Collection | - |
| `Type` | - | Hide: 0 · Unhide: 1 · Toggle: −1 |

Behaviour: `SIGetTextureUVDomains(InputObjs)` gives the texture support
objects of the input. For each one: when `Type` is −1, toggle its
`visibility.viewvis` (through `ToggleValue`); otherwise set
`visibility.viewvis` to `Type` (0 hidden, 1 shown). Only view visibility is
touched, not render visibility. No return value. A caller may pass any `Type`
to any of the three names; the value, not the name, decides.

### `SetCheckerboardMode`

Purpose: switch the checkerboard background of Texture Editor views.

| Arg | Handler | Default |
|-----|---------|---------|
| `Checkerboard` | - | False |
| `TextureEditor` | - | none (a View object) |

Behaviour: the view attribute `checkerboard` is set to the string `True` when
`Checkerboard` is exactly true, otherwise `False`.

- `TextureEditor` omitted: every view of the active layout is visited,
  recursing into the sub-views of each view that has any (relational views,
  view managers); every view whose type is `Texture Editor` gets the
  attribute. Views that cannot enumerate sub-views are skipped silently.
- `TextureEditor` given: only if it is a View (`siViewID`) of type
  `Texture Editor` is the attribute set; anything else is ignored silently.

No return value, no scene change, nothing to undo *(inferred: a view
attribute, not scene data)*.

## Enable conditions and errors

No registry enable conditions. Apart from the checks listed per command, the
scripts do not validate input; a failure in a called task command ends the
command with that task's error.

## What a golden should check (suggested `si_texture_proj_cmds_dump.js`)

1. `CreateTextureProj` on a cube with `ProjectionType` cylindrical: resulting
   projection is planar XY; returned name; support parent.
2. `CreateSubprojection` planar / cylindrical / spherical with
   `MaintainAspect` and A = 2: UV bounds and support scaling.
3. `FitSubcomponentUVsToImage` explicit and implicit on a known UV island:
   UV bounds, `projdef` values.
4. The three visibility commands on an object with two supports.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Default parent used by `SICreateTextureBasicGeo` when none is passed (parenting off) | binary row for the texture task commands, or golden 1 |
| Q2 | Whether the unregistered "on top" value of the contour-stretching handlers is really empty when invoked through the registry | golden: operator type after `ModifyUVSetByContourStretching` |
| Q3 | Parameter values of `PolyUVContourStretchingOp` `method` (meaning of 0, 1, …) | SPDL of the operator (P2 row) |
| Q4 | Behaviour of the C++ task commands in the table above (`SICreateTextureBasicGeo`, `SICameraTextureProj`, `SIConnectToSupport`, `SICreateTextureSpatial`, `SICreateTextureUVDomain`, `SIGetTextureUVDomains`, `SIFindUniqueTextureName`) | new row CMD-12b |
| Q5 | Cross-check against the SDK command reference | web access or local `xsisdk.chm` |
