# CMD-B17c: rendering, texture and rigid-body script commands (`Rendering.vbs`, `Texture.vbs`, `simulation.vbs`), registry-level only

Row: **CMD-B17c**. Status: **LOCK** for 29 commands, **SPEC-PARTIAL** for 1 (`ConnectToSupport`).
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`).

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `Rendering.vbs` | 160156 | `41329251` | **no** | 11 |
| `Texture.vbs` | 88691 | `74e3d3f9` | **no** | 10 |
| `simulation.vbs` | 72625 | `4064c313` | **no** | 9 |
| `Application\Dictionary\en\XSISCRIPTS.dict` | 22212 | `b942f52f` | whole | candidate prompt / title texts (section 5) |

All three files are > 64 KB: REA raw load refused ("raw-binary mapping from 0x0 must fit in the 6502 address
width"); `architecture=arm` opens but no provider reads raw ARM on Windows (Ghidra P0 accepts raw 6502 only); the
install folder is not connected (no device staging). Earlier batches that read these files (`cmd-12a`, `cmd-b6e`)
did so when the folder was connected, and only for other procedures. Everything below comes from the registry (R),
from contracts of sibling commands, or is marked *(inferred)*.

LOCK reason for every command marked LOCK: **file > 64 KB, REA raw load refused; install folder not connected.**

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `CreateFramebuffer` (script entry) | Rendering.vbs | `CreateFramebufferProc` | LOCK |
| `CreateImageBasedLightingPass` | Rendering.vbs | `CreateImageBasedLightingPass` | LOCK |
| `CreatePartition` | Rendering.vbs | `CreatePartitionProc` | LOCK |
| `CreatePass` (19 entries) | Rendering.vbs | `CreatePassProc` | LOCK |
| `CreatePassFromLayers` | Rendering.vbs | `CreatePassFromLayersProc` | LOCK |
| `CreateRenderChannel` (script entry) | Rendering.vbs | `CreateRenderChannelProc` | LOCK |
| `ExportObjectRenderArchive` (script entry) | Rendering.vbs | `ExportObjectRenderArchiveProc` | LOCK |
| `InspectViewportRenderRegionOptions` | Rendering.vbs | `InspectViewportRenderRegionOptionsProc` | LOCK |
| `LightAssociate` | Rendering.vbs | `LightAssociateProc` | LOCK |
| `RenderAllPasses` (script entry) | Rendering.vbs | `RenderPassesAtCurrentFrameProc` | LOCK |
| `RenderPasses` (script entry) | Rendering.vbs | `RenderPassesAtCurrentFrameProc` | LOCK |
| `ConnectToProjection` (2 entries) | Texture.vbs | `ConnectToProjectionProc`, `ConnectToProjectionUIProc` | LOCK |
| `ConnectToSupport` (2 entries) | Texture.vbs | `ConnectToSupportProc`, `ConnectToSupportUIProc` | SPEC-PARTIAL |
| `CreateProjection` (12 entries) | Texture.vbs | `CreateProjectionProc`, `CreateProjectionUIProc` | LOCK |
| `CreateTextureSupport` | Texture.vbs | `CreateTextureSupportProc` | LOCK |
| `FreezeUVWTransformation` | Texture.vbs | `SIFreezeUVWTransformationProc` | LOCK |
| `GenerateUVSetByContourStretching` (2 entries) | Texture.vbs | `GenerateUVSetByContourStretchingFunc`, `…Proc` | LOCK |
| `GenerateUniqueUVs` (2 entries) | Texture.vbs | `GenerateUniqueUVsProc`, `GenerateUniqueUVsInspProc` | LOCK |
| `IslandHealUVW` | Texture.vbs | `IslandHealUVWProc` | LOCK |
| `ReprojectUVW` | Texture.vbs | `ReprojectUVWProc` | LOCK |
| `StickUVW` | Texture.vbs | `StickUVWProc` | LOCK |
| `AddCompoundShapeToRigidBody` | simulation.vbs | `AddCompoundShapeToRigidBodyProc` | LOCK |
| `AttachRigidBodies` (6 entries) | simulation.vbs | `AttachRigidBodiesProc`, `AttachRigidBodiesToolProc` | LOCK |
| `CreateActiveRigidBody` | simulation.vbs | `SetActiveRigidBodyProc` | LOCK |
| `CreateCompoundRigidBody` | simulation.vbs | `CreateCompoundRigidBodyProc` | LOCK |
| `CreatePassiveRigidBody` | simulation.vbs | `SetPassiveRigidBodyProc` | LOCK |
| `GetRigidBodyInitStateFromAnim` | simulation.vbs | `GetRigidBodyInitialStateFromAnimProc` | LOCK |
| `InspectRigidBodySimulationProperties` | simulation.vbs | `InspectRigidBodySimulationProperties` | LOCK |
| `MultiAttachRigidBodiesTool` (5 entries) | simulation.vbs | `MultiAttachRigidBodiesTool` | LOCK |
| `RemoveRigidBody` | simulation.vbs | `RemoveRigidBodyProc` | LOCK |

## 2. Rendering.vbs (category Rendering for all)

Pattern seen in the registry: several scripting names have one **C++ entry** (no script, in `rendercore.dll` /
`sicoresdk.dll`) and one **script entry** whose arguments carry flag bit 0x80/0x04 combinations (f 134 / f 390 /
f 65670, i.e. "prompt in UI" variants). The script entry is the UI front end and calls the C++ entry *(inferred,
same pattern as `CreateRefModel` → `SICreateRefModel`)*.

### `CreateRenderChannel` (script entry)
Args (R): `Name` (string, `""`, f 134), `Type` (string, default `:siRenderChannelColorType:siRenderChannelType`,
f 390), `Value` (string, f 512). C++ entry same name (rendercore/sicoresdk): `Name` (f 130), `Type` (f 258), `Value`.
*(inferred)*: shows a dialog titled id 1118 `Create Render Channel` for name and type, then calls the C++
`CreateRenderChannel Name, Type` and returns the channel name.

### `CreateFramebuffer` (script entry)
Args (R): `Passes` (string, default `{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Passes.Current`, Collection, f 0x10082),
`Name` (string, `""`, f 134), `Value` (f 512). Description "Creates a new output framebuffer on a pass from render
channel". C++ entry same name. *(inferred)*: dialog titled id 1119 `Create Framebuffer From Render Channel` to pick
a render channel, then the C++ `CreateFramebuffer`.

### `ExportObjectRenderArchive` (script entry)
Args (R): `InputObj` (SingleObj, f 0x10086), `FileName` (`""`, f 134), `StartFrame`, `EndFrame`, `StepFrame` (vt 72,
NaN handler, f 0x10086), `MultiFrame` (bool, False, f 134), `DisplayProxy` (bool, True, f 134). Description "Export
an object and all its children to a render archive, or the current selection if none specified". C++ entry same
name, same arguments with f 2 / 0x10002. *(inferred)*: dialog titled id 1120 `Export Object Render Archive`, then
the C++ entry.

### `RenderPasses`, `RenderAllPasses` (script entries "Render Passes")
Args (R): `Passes` (default `Passes.Current` for `RenderPasses`, `Passes.List.*` for `RenderAllPasses`; Collection),
`StartFrame`, `EndFrame`, `StepFrame` (NaN handler, f 0x10082), `Verbose` (default
`:siRenderVerbosityDefault:siRenderVerbosity`, f 258). Description "Render a the list of passes, or current pass if
none specified, at the current frame". The same names have C++ entries (rendercore) with the same arguments
(`RenderPasses` also a 1-argument "Render Current Pass" entry). *(inferred)*: calls the C++ render with start = end
= current frame (`PlayControl.Current`) and step 1.

### `CreatePass` (19 entries)
Args (R): `PresetObj` (Preset handler, default `{42FC2493-732F-11d2-AC52-00A02485CECB}:Pass` for "New Pass"; fixed
strings f 130 for the others), `Name` (string), `Value` (out). Preset / default name per entry:

| Entry | PresetObj | Name |
|---|---|---|
| New Pass | `…:Pass` (Preset handler) | `""` |
| New Caustic Pass | `Caustic_Pass` | `Caustic` |
| New Depth Pass | `Depth_Pass` | `Depth` |
| New Global Illumination Pass | `Global_Illumination_Pass` | `Global_Illumination` |
| New Glow Pass | `Glow_Pass` | `Glow` |
| New Highlight Pass | `Highlight_Pass` | `Highlight` |
| New RGBA Matte Pass | `RGBA_Matte_Pass` | `RGBA_Matte` |
| New Reflection Pass | `Reflection_Pass` | `Reflection` |
| New Refraction Pass | `Refraction_Pass` | `Refraction` |
| New Shadow Pass | `Shadow_Pass` | `Shadow` |
| New Ambient/Diffuse Pass | `Ambient_Diffuse_Pass` | `Ambient_Diffuse` |
| New Ambient Pass | `Ambient_Pass` | `Ambient` |
| New Diffuse Pass | `Diffuse_Pass` | `Diffuse` |
| New Lens Flare Pass | `Lens_Flare_Pass` | `Lens_Flare` |
| New Volumic Pass | `Volumic_Pass` | `Volumic` |
| New White Matte Pass | `White_Matte_Pass` | `White_Matte` |
| New Toon Pass | `Toon` | `Toon` |
| New Isolate Matte Pass | `Isolate_Matte_Pass` | `Isolate_Matte` |
| New Selective Shadow Pass | `Selective_Shadow_Pass` | `Selective_Shadow` |

Description "Create a new pass and add properties". *(inferred)*: `SICreatePass PresetObj, Name` (C++, rendercore,
"Low Level Create Pass"), make it current, select / inspect it.

### `CreatePartition`
Args (R): `Target` (string, `""`), `Name` (string, `Partition`), `InputObjs` (string, `""`), `Value` (out).
Description "Create a new object and/or light partition and add the specified objects and inspect". Same arguments
and defaults as `SICreatePartition` (`cmd-b6e`, section `SICreatePartition`). *(inferred)*: `SICreatePartition`
then `InspectObj` / `AutoInspect` of the new partition(s).

### `CreatePassFromLayers`
Args (R): `Name` (`""`), `Value` (out). Description "Create a new pass with partitions that match layers, make
current, and inspect". No further facts.

### `CreateImageBasedLightingPass`
Args (R): `Filename` (`""`, f 134), `Clip` (SingleObj, f 0x10086). Description "Create a new Image based lighting
pass". Candidate texts: id 1125 / 1126 (image clip choice, section 5) *(inferred)*.

### `InspectViewportRenderRegionOptions`
Arg (R): `View` (string, default `:siViewportFocussed:siViewport`, f 258). Presumably inspects the render-region
options of that viewport *(inferred from the name)*.

### `LightAssociate`
Arg (R): `InputObjs` (Collection, f 0x10082). Candidate pick prompts ids 1121–1124 `Pick Light(s) to Associate`,
`Pick Light(s) to Disassociate`, `Pick Object(s) to Associate`, `Pick Object(s) to Disassociate` *(inferred)*.

## 3. Texture.vbs (category Texturing|Rendering, `IslandHealUVW` / `ReprojectUVW` / `StickUVW`: Texturing)

Shared enum values and the C++ task commands are in `cmd-12a-texture-projection-scripts.md`.

### `ConnectToSupport`: SPEC-PARTIAL
Entries (R): `ConnectToSupportProc` ("Connect To Texture Support") and `ConnectToSupportUIProc` (description "Create a
new texture projection using an existing texture support"); both args `InputObjs` (Collection), `PropertyName`,
`TextureSupport` (untyped, f 134). **`ConnectToSupportProc` is the procedure already specified for
`ConnectToTextureProj`**: same as `cmd-12a` section `ConnectToTextureProj` (ends in `SIConnectToSupport`, see also
`cmd-b8d-primtasks-texture-binary.md`). The UI procedure is unread; candidate texts id 1149 `Create a projection
using an existing texture support` and id 1150 `Enter the new texture projection name` *(inferred)*.

### `ConnectToProjection`
Entries (R): `ConnectToProjectionProc` and `ConnectToProjectionUIProc` (description "Create a new texture projection
sharing an existing projection definition"); args `InputObjs` (Collection), `PropertyName`, `TextureProjection`
(untyped, f 134). *(inferred)*: wraps `SIConnectToProjection InputObj, PropertyName, TextureProjection` (primtasks,
"Share Projection Definition", `cmd-b8d`); UI title id 1151 `Share Definition of Texture Projection`.

### `CreateProjection` (12 entries)
Args (R): `InputObjs` (Collection; f 0x10002 for the main entry, f 130 for the fixed-type entries), `Type`
(`siTxtCreationType`), `UVDefaultType` (`siTxtDefaultCreationType`), `SupportName`, `PropertyName`, `Parenting`
(bool), `Fitting` (`siTxtProjFitMethod`), `Camera` (string). Entries:

| Entry | Type | UVDefaultType | Parenting | Fitting |
|---|---|---|---|---|
| Create Texture Projection (Proc) | `siTxtPlanarXY` | `siTxtDefaultSpherical` | True | `siRelDefault` |
| Create Texture Projection (UIProc) | `siTxtPlanarXY` | `siTxtDefaultSpherical` | True | `siRelBestFit` |
| Create UV Texture Projection | `siTxtUV` | `siTxtDefaultPlanarXY` | True | `siRelDefault` |
| … PlanarXY / PlanarYZ / PlanarXZ | `siTxtPlanarXY/YZ/XZ` | `siTxtDefaultPlanarXY/YZ/XZ` | True | `siRelDefault` |
| … Spherical / Cylindrical / Cubic | `siTxtSpherical/Cylindrical/Cubic` | matching default | True | `siRelDefault` |
| Create Camera Texture Projection | `siTxtCamera` | `siTxtDefaultPlanarXY` | **False** | `siRelDefault` |
| Create Spatial Texture Projection | `siTxtSpatial` | `siTxtDefaultPlanarXY` | True | `siRelDefault` |
| Create Purely Implicit Texture Projection | `siTxtPureImplicit` | `siTxtDefaultPlanarXY` | **False** | `siRelDefault` |

`Camera` is `""` (f 134 prompt for camera and implicit, f 2 otherwise). UI title id 1144 `Create Texture Projection`
*(inferred)*. Behaviour presumably close to `CreateTextureProj` (`cmd-12a`) *(inferred)*.

### `CreateTextureSupport`
Args (R): `InputObjs` (Collection), `Type` (`siTxtPlanarXY`, f 262), `UVDefaultType` (`siTxtDefaultSpherical`),
`Name` (`Texture_Support`, f 134), `Parenting` (True).

### `FreezeUVWTransformation`
Arg (R): `TextureProjectionDefinition` (vt 9, f 2). Procedure name suggests a wrapper of an `SIFreezeUVWTransformation`
task, which is **not** in the registry *(open)*.

### `GenerateUVSetByContourStretching` (2 entries)
Scripted (Func): `InputObjs` (Collection), `PropertyName` (`""`), `ContourStretchingMethod` (int 0),
`MaintainAspect` (False), `CornerPoints` (Collection), `TextureProjectionOnTop` (False, f 3), `Value` (return).
Interactive (Proc, "Interactive Generate Contour Stretch UVW"): same, prompting (f 134 / f 34 / f 0x10086), no return.
Twin of `ModifyUVSetByContourStretching` (`cmd-12a`, `PolyUVContourStretchingOp`); candidate pick prompts ids 1145
`Pick Corner Point`, 1146 `Unpick Corner Point` *(inferred)*.

### `GenerateUniqueUVs` (2 entries)
Args (R): `InputObjs`, `PropertyName` (`""`, f 134), `LowU` 0, `LowV` 0, `Width` 1, `Height` 1, `SpaceU` 0,
`SpaceV` 0 (doubles), `Properties` (out). `GenerateUniqueUVsInspProc` presumably inspects the result *(inferred)*.

### `IslandHealUVW`
Args (R): `TextureProjection` (SingleObj), `TargetBoundary`, `SourceIslands` (SingleObj, f 0x10086 prompt),
`AllowScaling` (False), `Interpolation` (1.0), `OutputObj` (return). Description "Perform a transformation to match UV
island boundaries, and then heal the UVWs". Candidate prompts ids 1147 `Pick target boundary points`, 1148 `Pick
source island points` *(inferred)*.

### `ReprojectUVW`, `StickUVW`
Arg (R): `InputObjs` (Collection). Descriptions "Reattach the projection to cause the texture to Reproject" / "…
to stick". Likely set the swim / stick behaviour of the texture projection, cf. `SwimUVW` (`cmd-12a`) *(inferred)*.

## 4. simulation.vbs (category Simulation)

| Command | Args (R) | Description (R) |
|---|---|---|
| `CreateActiveRigidBody` | `InputObjs` (Collection) | Set the object as an active rigid body |
| `CreatePassiveRigidBody` | `InputObjs` | Set the object as a passive rigid body |
| `CreateCompoundRigidBody` | `InputObjs` | Create a compound rigid body from the selection |
| `AddCompoundShapeToRigidBody` | `InputObjs` (SingleObj), `Children` (Collection) | Add a compound shape to the selection |
| `RemoveRigidBody` | `InputObjs` | Remove from rigid body simulation |
| `GetRigidBodyInitStateFromAnim` | `InputObjs` | Get the rigid bodies initial state from their animation |
| `InspectRigidBodySimulationProperties` | `Value` (return) | Inspect Rigid Body Simulation Properties |
| `AttachRigidBodies` (scripted) | `Name` (`BallSocket`), `Bodies` (Collection), `Px`, `Py`, `Pz` (0.0), `Value` | Attach rigid bodies together with a rigid constraint |
| `AttachRigidBodies` tool entries "Rigid Hinge / BallSocket / Slider / Spring / Fixed Cns" | `Name` = `Hinge` / `BallSocket` / `Slider` / `Spring` / `Fixed`, `Bodies` and `Px..Pz` prompted (f 134 / 0x10086) | (none) |
| `MultiAttachRigidBodiesTool` (5 entries, same five names) | `Name`, `Bodies` (prompted), `Value` | Attach rigid bodies together with a rigid constraint |

Related: `SetRigidBodyInitState` is a C++ command (no contract yet) that `GetRigidBodyInitStateFromAnim` probably
calls *(inferred)*. Candidate texts for the tools: ids 1136 `Pick Bodies `, 1137 `Attach To`, 1138 ` 1st `, 1139
` 2nd `, 1140 `Pick %s Rigid Body To Attach`, 1141 `Add Shapes`, 1142 `Pick Cns Position`, 1143 `Pick Constraint
Location` *(inferred: the ids follow the batch of ids used by neighbouring scripts)*.

## 5. Dictionary texts that are probably used here (D)
`XSISCRIPTS.dict` (English) records, id (hex): 1118 (0x45E) `Create Render Channel`; 1119 (0x45F) `Create Framebuffer
From Render Channel`; 1120 (0x460) `Export Object Render Archive`; 1121–1124 (0x461–0x464) the four light /
object association pick prompts; 1125 (0x465) a three-line question about using an existing image clip (Yes: use an
existing clip, No: create a new clip from disk); 1126 (0x466) `Use existing image clip?`; 1136–1143 (0x470–0x477)
rigid-body texts; 1144 (0x478) `Create Texture Projection`; 1145–1148 (0x479–0x47C) corner / boundary / island
pick prompts; 1149–1151 (0x47D–0x47F) texture-support / projection texts. Which procedure uses which id is not
attested (scripts unread).

## 6. Corrections for the wire agent
- `CreateRenderChannel`, `CreateFramebuffer`, `ExportObjectRenderArchive`, `RenderPasses`, `RenderAllPasses` each
  have both a C++ entry and a script entry under one scripting name; only the script entry is in this row.
- `ConnectToSupport`'s scripted procedure is the one already specified as `ConnectToTextureProj` (`cmd-12a`).
- `FreezeUVWTransformation`: no `SIFreezeUVWTransformation` exists in the registry; do not assume one.

## 7. Open questions
| # | Question | Where to look |
|---|---|---|
| Q1 | Whole behaviour of every LOCK command | read the three files once the install folder is connected (or a raw loader for files > 64 KB) |
| Q2 | Which C++ / object-model calls `FreezeUVWTransformation`, `ReprojectUVW`, `StickUVW` use | `Texture.vbs` |
| Q3 | Rigid-body property / operator names created by `CreateActiveRigidBody` etc. | `simulation.vbs`, then the physics DLL |
