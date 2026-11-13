# CMD-01c: texture layer and shader blend-in commands

Row: **CMD-01c** (split from CMD-01, uncategorised). Status: **SPEC-PARTIAL**.
Run: 2026-11-12, `si-analyst`, unattended.

27 commands that put shaders, image clips and texture layers onto shader
parameters ("connection points"). None has a category in the registry.

| Group | Implemented in | Commands |
|-------|----------------|----------|
| A. Texture layer tasks | C++, `Application\bin\shadertasks.dll` (helpers in `shaderhelper.dll`) | `AddTextureLayer`, `AddTextureLayerPorts`, `MoveTextureLayers`, `RemoveTextureLayers` |
| B. Layer creation wrappers | VBScript, `Application\DSScripts\Rendering.vbs` | `AddPresetTextureLayer`, `AddImageTextureLayer`, `AddClipTextureLayer` |
| C. Blend presets through mixers | VBScript, same file | `BlendInPresets`, `BlendInPresetsInsp`, `BlendInPresetsWithPorts`, `BlendInPresetsWithPortsInsp`, `SIConnectShaderWithBlendsInsp` |
| D. Blend presets / clips as layers | VBScript, same file | `BlendInTextureLayers`, `BlendInTextureLayersInsp`, `BlendInTextureLayersWithPorts`, `BlendInTextureLayersWithPortsInsp`, `BlendClipsInTextureLayers`, `BlendClipsInTextureLayersInsp`, `BlendClipsInTextureLayersWithPorts`, `BlendClipsInTextureLayersWithPortsInsp` |
| E. Insert | VBScript, same file | `InsertShader` |
| F. Connection primitives and pop-ups | C++ (not traced this run) | `SIApplyShaderToCnxPoint`, `SIApplyShaderToCnxPoint2`, `SIConnectShaderToCnxPoint`, `UIApplyShaderToCnxPoints`, `Texture Pop-up Menu`, `Modify Texture Pop-up Menu` |

Groups A to E are wire-ready from the sources below. Group F is specified only
as far as the registry and the way the scripts call it; see the open questions.

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display name, scripting name, arguments, defaults, argument handlers, `return_value`, description |
| (S) | `Application\DSScripts\Rendering.vbs` (160,156 bytes), the procedures for groups B to E and every helper they call, read in full from the install | every step, message text and constant of the script commands; the call shapes of the group A and F commands |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict`, `XSIMSGCAT.dict`, `XSISHADERTASKS.dict`, `XSITEXLAYEREDITOR.dict`, `XSISHADERHELPER.dict` | translated message and menu texts |
| (H) | `XSISDK\include\xsi_decl.h` | enum and class-id values |
| (B) | REA + Ghidra 12.1.4 on `Application\bin\shadertasks.dll` (sha256 `ef5c3ba6…5353c5`) and `Application\bin\shaderhelper.dll` | group A behaviour. Function image addresses are given per command. Items marked *(B, inferred)* are a reading of container-heavy code and need a golden before they are relied on |
| - | Softimage SDK command reference (online) | **Not reached**: the fetch of `download.autodesk.com` was not permitted in this unattended session, and `Doc\` holds only links. See Q1 |
| - | XSIBATCH goldens | **Not run.** See Q2 |

No script text, decompiler output or disassembly is reproduced here. Message
strings, ids, GUIDs and enum values are recorded as facts.

## Shared facts

### Enum and class-id values (H)

| Name | Value |
|------|------:|
| `siBlendInPreset` / `siReplaceAndBlendInPreset` / `siReplaceNoBlend` (`siBlendInPresetModes`) | 0 / 1 / 2 |
| `siBlendInTextureLayers` / `siReplaceAndBlendInTextureLayers` / `siReplaceAndNoBlendInTextureLayers` (`siBlendInTextureLayersModes`) | 0 / 1 / 2 |
| `siShaderCnxPointNone` / `BasePorts` / `TextureLayerPorts` / `All` | 0 / 1 / 2 / 65535 |
| `siShaderDataTypeBoolean` / `Scalar` / `Vector3` / `Color4` | 0 / 2 / 4 / 10 |
| `siShader` (`siShaderType`; 2 = compound, 3 = comment) | 1 |
| `siAnySource` | 4 |
| `siNode` / `siBranch` / `siUnspecified` (`siBranchFlag`) | 0 / 1 / 3 |
| `siBranchPropagation` / `siNodePropagation` | 1 / 2 |
| `siParameterID`, `siCompoundParameterID`, `siShaderID`, `siPrimitiveID` | 44, 45, 52, 55 |
| `siMaterialID`, `siPassID`, `siCameraID`, `siLightID` | 64, 70, 80, 81 |
| `siParticleTypeID`, `siTextureLayerID`, `siTextureLayerPortID` | 123, 126, 127 |
| `siOverrideID`, `siShaderParameterID` | 207, 218 |

### GUIDs (S, B)

| GUID | Meaning |
|------|---------|
| `{22E89E70-B25F-11d3-AE58-00A0C96E63E1}` | shader attribute key holding the shader's type id (S) |
| `{3A3BD020-A9BD-11D3-AE56-00A0C96E63E1}` | value of that attribute for the 8-colour mixer `Mix_8colors` (S) |
| `{5E373ED1-1085-11d3-B0B7-00A0C982A112}` | parameter attribute key: capability flags. Bit 0 set = texturable (S) |
| `{8C80DEF3-1064-11d3-B0B7-00A0C982A112}` | parameter attribute key: default-texture mapping (S) |
| `{3515CC71-082C-11D0-91DE-00A024C78EE3}` | mapping value: ambient (S) |
| `{3515CC72-082C-11D0-91DE-00A024C78EE3}` | mapping value: diffuse (S) |
| `{D97375C6-05AE-11D0-91DE-00A024C78EE3}` | mapping value: transparency (S) |
| `{D97375C7-05AE-11D0-91DE-00A024C78EE3}` | mapping value: reflection (S) |
| `{F3DFBA8B-22AD-48FD-A156-EBFCEAED29DD}` | class created for a new texture layer (B) |
| `{C14BEAF3-6116-414C-AF0F-010F1DAED3BC}` | class created for a texture layer port (B) |
| `{ED63560A-1EE7-4F76-9D21-D3DB5C23DB83}` | the AddTextureLayer task, as run nested by AddTextureLayerPorts (B) |
| `{DD531990-CCC2-11D2-AC73-00A02485CECB}` | generic delete task used to delete layers and ports (B) |

Task ProgIDs registered by `shadertasks.dll` (B): `SI.3D.CLSID_AddTextureLayerTask`,
`SI.3D.CLSID_AddTextureLayerPortsTask`, `SI.3D.CLSID_MoveTextureLayersTask`,
`SI.3D.CLSID_RemoveTextureLayersTask`, `SI.3D.UIApplyShaderToCnxPointsTask`.

### Translated messages (D), dictionary `XSISCRIPTS`

| Id | English text |
|---:|--------------|
| 1103 | Cannot attach blender to input %s: invalid type |
| 1104 | You are about to modify a shared material.  Create local copies of this shared material? |
| 1105 | Shared Material |
| 1106 | You are about to modify shared materials.  Create local copies of these shared materials? |
| 1107 | Shared Materials |
| 1108 | The material " %s ",  |
| 1109 | used by 1 object in the selection list ( %s  |
| 1110 | used by %s objects in the selection list  ( %s and %s |
| 1111 | used by " %s " objects in the selection list  ( %s, %s... |
| 1112 | ), is a shared property. |
| 1113 | Create a local material for each of the %s objects in the selection that use this material?   |
| 1114 | Create a local material for the object in the selection that uses this material? |
| 1115 | The preset(s) could not be applied to this selection |
| 1116 | Texturing |
| 1195 | The preset(s) could not be applied to this selection |
| 1197 | Texturing |

The title "Warning" is looked up by string key, not by id.

### Task messages (D), dictionary `XSIMSGCAT`

Logged by the group A tasks (ids read from the binary, texts from the
dictionary; the stored text starts with the id and a `$`).

| Id | Severity | English text |
|---:|----------|--------------|
| 69 | error | Connection of this shader would cause a cycle. |
| 70 | error | Type mismatch between shader and connection point. |
| 72 | error | This shader is already connected to another object. |
| 413 | warning | The shader port cannot support a texture layer port. Only color, vector, scalar, integer and boolean shader ports supports texture layers. |

### Script message box helper (S)

Every dialog in groups C and D goes through one helper: in interactive mode it
shows a standard message box and returns the button pressed; in batch mode it
logs `<title>: <prompt>` and returns a caller-supplied default. The defaults
are "No" for the two sharing questions and "OK" for the notices, so **batch
mode never makes materials local on its own**.

### Command flags (R)

All 27 are enabled, none is key-assignable, none has an enable condition in
the registry. All arguments are inputs (direction 2) except `SharedMatAction`
on the six `Blend…InTextureLayers[Insp]` / `BlendClipsInTextureLayers[Insp]`
commands and `FileName` on `AddImageTextureLayer`, which are in/out (6).

Commands that return a value: all except `MoveTextureLayers`,
`RemoveTextureLayers`, `UIApplyShaderToCnxPoints`, `Modify Texture Pop-up Menu`
and, per the registry, `SIConnectShaderWithBlendsInsp` (its script does produce
the shader; the registry flag says the command does not hand it back. Q3).

Display names differ from scripting names for most of groups C, D, F:

| Scripting name | Display name |
|----------------|--------------|
| `BlendInPresets` | Blend in Presets to Default Texture Ports - Do Not Inspect |
| `BlendInPresetsInsp` | Blend in Presets to Default Texture Ports |
| `BlendInPresetsWithPorts` | Blend in Presets with Ports - Do Not Inspect |
| `BlendInPresetsWithPortsInsp` | Blend in Presets with Ports |
| `BlendInTextureLayers` | Blend in Texture Layers to Default Texture Ports - Do Not Inspect |
| `BlendInTextureLayersInsp` | Blend in Texture Layers to Default Texture Ports and Inspect |
| `BlendInTextureLayersWithPorts` | Blend in Texture Layers with Ports - Do Not Inspect |
| `BlendInTextureLayersWithPortsInsp` | Blend in Texture Layers with Ports and Inspect |
| `BlendClipsInTextureLayers` | Blend Clips in Texture Layers to Default Texture Ports - Do Not Inspect |
| `BlendClipsInTextureLayersInsp` | Blend in Clip Texture Layers to Default Texture Ports and Inspect |
| `BlendClipsInTextureLayersWithPorts` | Blend Clips in Texture Layers with Ports - Do Not Inspect |
| `BlendClipsInTextureLayersWithPortsInsp` | Blend clips in Texture Layers with Ports and Inspect |
| `SIConnectShaderWithBlendsInsp` | Connect Shader With Blends and Inspect |
| `InsertShader` | Insert shader |
| `SIApplyShaderToCnxPoint` | Apply Shader Preset to Component |
| `SIApplyShaderToCnxPoint2` | Apply ProgID to Component |
| `SIConnectShaderToCnxPoint` | Connect shader |
| (none) | Texture Pop-up Menu |
| (none) | Modify Texture Pop-up Menu |

### Shared script helpers (S)

**Owning container of a port.** Start from the port. If it is a parameter, take
its parent; if that is a compound parameter, take its parent again. If the
result is a texture layer or a primitive, take its parent once more. The result
is the shader, material, light, camera, pass, override or particle type that
owns the port.

**Unique shader container.** For a list of items, resolve each to its owning
container as above. A shader contributes the container it is nested in (its
`GetShaderContainer`); a material, light, camera, override, particle type or
pass contributes itself; any other class makes the result "none". If two items
give different containers the result is "none". New shaders are always created
inside this container, so one call cannot span two materials.

**Supports texture layers.** True for a material, and for a shader whose shader
type is `siShader` (1). False for compounds, comments and everything else.

**Create shader from preset name.** Build a preset from (name, family "Texture
Shaders") and create a shader from it in the given container with the given
name. Any failure yields "none" rather than an error.

**Create image clip from a file name.** Runs `SICreateImageClip` on the name
and takes the "Clip" output; "none" on failure. Used as the fallback whenever a
preset name is not a preset: **a preset name may be an image file path**.

**Default-texturable ports of a material.** Take the shaders connected to the
material's `surface` and `shadow` ports (each shader once). Enumerate every
parameter of those shaders. A parameter qualifies when its capability flags
have bit 0 set and its mapping attribute is one of the four mapping values
above **and** the matching switch (Ambient, Diffuse, Transparency, Reflection)
is true. Only the shaders directly on `surface` and `shadow` are searched, not
the tree behind them.

**Material path of an object.** Group: `<obj>.CurrentProperties.Material`.
Cluster: `<obj>.currentprops.Material`. Otherwise `<obj>.nodecurrent.Material`
when the object's branch flag is node, else `<obj>.branchcurrent.Material`.

**Material list with sharing resolution** (used by groups C and D, the
commands that take objects rather than ports):

1. Duplicates in the object list are dropped.
2. A polygon sub-component selection is turned into a new polygon cluster on
   its object (sub-surface selection: a sub-surface cluster), a shader is
   applied to that cluster with `ApplyShader` and its defaults, and the cluster
   stands in for the selection. Sample, point and edge sub-components are
   ignored.
3. For each object take its current material. A material counts as *local* to
   the object when the material has exactly two owners and the second is that
   object. Materials are compared by identity; each distinct material is kept
   once, **only if it has at least one qualifying default-texturable port**.
   Objects using it non-locally are recorded as "can be made local" and mark
   the material as shared.
4. For each kept material, if it is shared and some objects can be made local,
   `SharedMatAction` decides:

   | Value | Behaviour |
   |------:|-----------|
   | 0 | never make local |
   | 1 | always make local |
   | 2 | "beginner": if exactly one material was kept and its name is not `SceneMaterial` (case-insensitive), make local without asking. Otherwise ask once with message 1104 / title 1105 (one shared material) or 1106 / 1107 (several); Yes/No, default No. The same answer applies to every material |
   | 3 | "advanced": ask per material. Prompt = 1108 (material) + one of 1109 (one object), 1110 (two), 1111 (more; shows the count and the first two) + 1112 + a blank line + 1114 (one object) or 1113 (count). Yes/No, default No |

   The title of the advanced prompt is looked up through a constant the script
   never defines, so the lookup key is empty (Q4).
5. "Make local" runs `MakeLocal` on each such object's material path with node
   or branch propagation according to the object's branch flag, and the new
   local materials are used. "No" uses the shared material once (so every user
   changes). A material that was already local to one of the objects is used as
   is.

## Wire contract

### A1. `AddTextureLayer` (B: worker `0x180030d50`, argument reader `0x180031d30`, insert helper `0x1800a3220` in `shaderhelper.dll`)

Purpose: create a texture layer, or take an existing one, and add it to one or
more containers (materials or shaders).

| Argument | Handler | Default | Meaning |
|----------|---------|---------|---------|
| `Object` | single object | none | existing layer to add; omitted = create a new layer |
| `InputObjs` | collection | none | containers. Required |
| `Name` | - | `""` | name for a new layer |
| `After` | - | true | insert after (true) or before (false) the reference |
| `Reference` | single object | none | layer to insert next to |

Steps:

1. `Object` omitted: create a new layer object (class GUID above). Its name is
   `Name`; with no name supplied the name is `Layer`. `Object` given: use it,
   create nothing.
2. For each element of `InputObjs` that is a texture layer container (others
   are skipped silently):
   - a locked container aborts with the lock error;
   - the layer must be suitable for the container. A layer that is in no
     container yet always is. A layer that already has containers is suitable
     only when those containers share one owner *(B, inferred; Q5)*.
     Unsuitable: message 72 ("already connected to another object") is logged
     as an error and the command aborts;
   - position, when `Reference` is omitted or is in this container:

     | Reference | After | Position |
     |-----------|:-----:|----------|
     | none | true | last |
     | none | false | first |
     | in this container | true | immediately after it |
     | in this container | false | immediately before it |

   - position, when `Reference` is given but is not in this container: before
     the next layer, in the merged order of all the reference's containers,
     that is in this container; at the end if there is none. `After` is
     ignored;
   - a layer already in the container is a failure (generic failure).
3. After all inserts the merged layer order across the containers is
   re-derived. If that reports a conflict, message 69 ("would cause a cycle")
   is logged as an error and the command aborts. The natural reading is that
   two containers would hold the same layers in contradicting orders
   *(B, inferred)*.
4. Any abort removes the layer from every container it was added to.

Return value: the layer (one object, new or passed in), not a list.
Undo: removes the layer from the containers; a layer the command created is
deleted.

Golden should check: default name; returned object class `TextureLayer`
(`siTextureLayerID` 126); the four positions of the table on a material with
three existing layers; adding one layer to two materials; failure when the
layer is added twice to the same container.

### A2. `AddTextureLayerPorts` (B: worker `0x18002ff70`, `0x1800a4cd0` in `shaderhelper.dll`)

Purpose: make a layer drive one or more shader parameters.

Arguments: `InputObj` (single object: the layer), `InputObjs` (collection: the
target parameters).

For each target:

1. Its owner must be a texture layer container. Otherwise message 70 ("type
   mismatch") is logged as an error, the command fails and everything done so
   far is undone.
2. The parameter must be layerable: the owner is a layer container and the
   parameter's data type is boolean, scalar, vector3 or colour4 (0, 2, 4, 10),
   plus one further boolean condition on the parameter that was not identified
   (Q6). Otherwise message 413 is logged as a warning and the target is
   skipped; the command continues. The message text also names integer ports,
   which the type test read from the binary does not accept (Q16).
3. If the layer is not yet in that container it is added by a nested
   `AddTextureLayer`, before the next layer of the merged order that is in the
   container, or at the end.
4. A port object is created, added to the layer and connected to the target
   parameter. A port that connects successfully is added to the result.

No duplicate check is made at this level: asking twice for the same parameter
was not seen to be rejected (Q7).

Return value: the collection of created ports (class id 127).

Golden should check: port count and class; that the layer appears in the
target's container afterwards; the skipped-target warning for a string
parameter; the port names (Q8).

### A3. `MoveTextureLayers` (B: worker `0x180032360`, reorder `0x180032010`; `0x1800a4260`, `0x1800a3410` in `shaderhelper.dll`)

Purpose: move layers up or down in the layer order of their containers.

Arguments: `InputObjs` (collection: layers), `Offset` (integer, default -1).

1. The input is expanded to a full layer list, and one merged, ordered list is
   built of all layers of every container that holds any of the input layers
   *(B, inferred)*.
2. Each input layer is moved `|Offset|` steps in the merged list: negative
   towards the head (lower child index), positive towards the tail. A step is
   counted only when the layer passed shares a container with the moved layer
   *(B, inferred)*.
3. The move stops at either end of the list (clamp, no error) and stops when
   the next neighbour is itself a moved layer, so several moved layers keep
   their relative order *(B, inferred)*. Layers are processed starting from
   the end they move towards.
4. Every affected container then has its child order rewritten to match the
   merged list. A layer that is in several containers is repositioned
   consistently in each.
5. `Offset` 0 re-applies the existing order and changes nothing.

No return value. Undoable.

Whether the head of the list is the top row of the Texture Layer Editor was
not established from the binary (Q9). The editor's own items are "Move Up" /
"Move Selected Layer(s) Up" and "Move Down" / "Move Selected Layer(s) Down"
(D, `XSITEXLAYEREDITOR` 43 to 46) and the context menu has "Move Layer Up" /
"Move Layer Down" (D, `XSISHADERHELPER` 210, 211); the registry default of -1
suggests that -1 is "up", but that is not attested.

Golden should check: order before and after for offsets -1, +1, -5, +5 with
one and two selected layers, including a layer shared by two materials.

### A4. `RemoveTextureLayers` (B: worker `0x180032a30`, argument reader `0x180033880`)

Purpose: take layers out of a container, deleting those that no longer belong
anywhere.

Arguments: `InputObjs` (collection: layers), `Container` (single object,
default none).

| Case | Behaviour |
|------|-----------|
| `Container` omitted | every layer in `InputObjs` is deleted, so it leaves all its containers |
| `Container` given | for each layer of that container that is in `InputObjs`: if this is its last container the layer is deleted; otherwise it is only removed from this container. Layers in `InputObjs` that are not in the container are ignored |

A locked layer fails the command with access denied. When the `Container`
argument cannot be read the task tries to use the first element of `InputObjs`
as the container; what that amounts to for a script caller is not known (Q10).

No return value. Undo restores deleted layers and re-inserts each removed
layer after the layer that preceded it (or first).

The task has no explicit step that disconnects the layer's ports. Presumably
they go with a deleted layer and stay on a layer that is only removed from one
container; not attested (Q11).

Golden should check: the port connections on the target parameters after each
case; that a layer shared by two materials survives removal from one.

### B1. `AddPresetTextureLayer` (S)

Arguments: `PresetObj` (string, default `Image`), `InputObjs` (collection:
containers), `Name` (`""`), `After` (true), `Reference` (single object, none).

1. Find the unique shader container of `InputObjs`. None: the command fails.
2. Create a shader from preset `PresetObj` (family "Texture Shaders") in that
   container. Failure: log `Invalid preset provided.` as an error; nothing is
   returned.
3. Run `AddTextureLayer` with no `Object`, the same containers, `Name`,
   `After`, and `Reference` only when one was given.
4. Connect the new shader to the layer's `color` parameter.
5. If `Name` was empty, rename the layer to `<shader name>_Layer`.

Return value: the layer.

### B2. `AddClipTextureLayer` (S)

Arguments: `Clip` (single object), `InputObjs`, `Name`, `After`, `Reference`
as in B1.

1. If `Clip` is an image source, create an image clip from it
   (`SIAddImageClip`, "Clip" output) and use that.
2. If the result is not an image clip, nothing is created. As written the
   command then fails with a script error rather than its own message (Q12).
3. Run `AddTextureLayer` as in B1 step 3.
4. Apply the `Image` preset to the layer's `color` parameter
   (`SIApplyShaderToCnxPoint`) and connect the clip to that shader's `tex`
   parameter.
5. If `Name` was empty, rename the layer to `<clip name>_Layer`.
6. Set the layer's `maskmode` parameter to 0.

Return value: the layer. If the layer could not be created:
`Invalid clip provided.` is logged as an error.

### B3. `AddImageTextureLayer` (S)

Arguments: `FileName` (string, in/out, default `""`), then as B2.

Creates an image clip from the file and continues exactly as B2 from step 3.
If the clip cannot be created: log `Invalid image file provided.` as an error.
Return value: the layer.

### C1. `BlendInPresetsWithPorts` / `BlendInPresetsWithPortsInsp` (S)

Purpose: connect one or more texture shaders to given ports, mixing them with
whatever is already there through 8-colour mixers.

Arguments: `PresetNames` (string, default `Image`: comma-separated preset
names or image file paths), `InputObjs` (collection of ports).

1. No ports, or no unique shader container: return an empty collection.
2. Split `PresetNames` on commas, trim, drop empties. None left: empty result.
3. Create one shader per name in the container (family "Texture Shaders",
   default name). If the name is not a preset, try it as an image file: create
   a clip, create an `Image` shader named `Image`, connect the clip to its
   `tex`. A name that is neither logs
   `Could not create preset or image '<name>'` as a warning and is skipped.
   Nothing created at all: empty result. **Each shader is created once and
   shared by all ports.**
4. For each port: its data type must be colour4 or scalar; otherwise show
   message 1103 (with the port) under the title "Warning" and skip it.
5. For a valid port, obtain as many free mixer inputs as there are presets
   (algorithm below, mixer named `<last path segment of the port>_blend`) and
   connect the shaders to them in order.

Return value: the collection of created shaders. The `Insp` form opens a
property page on them when the collection is not empty.

**Finding or creating free mixer inputs on a port** (S). A mixer is the
`Mixers\Mix_8colors` preset; it has a `base_color` and seven layers `color1`
to `color7`, each with `weight<i>`, `alpha<i>`, `mode<i>`, `inuse<i>`.

1. A layer is *free* when its `inuse<i>` has no shader and no animation or
   expression and its value is false. Taking a free layer resets it: shaders
   are disconnected from `color<i>`, `weight<i>`, `alpha<i>`, `mode<i>`
   (without deleting them); animation is removed from those and from the
   colour and weight components; `weight<i>` is set to (1, 1, 1, 0.5),
   `alpha<i>` to true, `mode<i>` to 1 (Mix), `inuse<i>` to true.
2. If the port already has a `Mix_8colors` (recognised by the type attribute
   GUID) with at least one free layer, that mixer is reused.
3. Otherwise a new mixer is created with all seven `inuse` flags false, and
   what was on the port moves under it:
   - colour4 port: the existing shader is disconnected; the port's red, green,
     blue, alpha values and any animation are copied to `base_color`; the old
     shader is connected to `base_color`; the mixer is connected to the port;
   - scalar port: a `Conversion\Scalar2color` shader is applied to
     `base_color` with its `alpha` set to 1; the port's value and animation are
     copied to that converter's `input`; the old shader is connected to that
     `input`; a `Conversion\Color2scalar` shader is applied to the port and the
     mixer is connected to its `input`.
4. Free layers are taken in index order. When the mixer is full, one already
   taken input is given up and a further new mixer is connected to it; its
   layers 1 to 7 are taken as needed. This repeats until enough inputs exist,
   so nine presets give a chain of two mixers.
5. If a mixer cannot be created the port is restored to its previous shader
   (or cleared) and that port is skipped. Warnings: `Couldn't create
   Mix_8colors`, `Could not create Scalar2color`, `Couldn't create
   Color2scalar`.

### C2. `BlendInPresets` / `BlendInPresetsInsp` (S)

Purpose: the same, but starting from objects: finds each object's material and
its default-texturable ports.

| Argument | Default | Meaning |
|----------|---------|---------|
| `PresetNames` | `Image` | as C1 |
| `InputObjs` | none (collection) | objects, clusters, groups, sub-components |
| `SharedMatAction` | 3 | see the sharing table |
| `NotifyNoResult` | false | show a notice when nothing was created |
| `Mode` | `siBlendInPreset` (0) | `siBlendInPresetModes` |
| `Ambient`, `Diffuse` | true | which default-texture ports to use |
| `Transparency`, `Reflection` | false | |

1. Empty `PresetNames` or no objects: empty result.
2. Build the material list with sharing resolution.
3. For each material, collect its default-texturable ports. If there are any:
   - `Mode` 1 or 2: for each port, disconnect its current shader (not deleted).
     Then, on the shader that owns the port: if `Transparency` is on and the
     port maps to transparency, set `usealphatrans` and `inverttrans` to true
     when both exist; else if `Reflection` is on and the port maps to
     reflection, set `usealpharefl` to true when it exists;
   - `Mode` 0 or 1: run C1 on the ports with every preset going through a
     mixer. `Mode` 2: the first preset is connected directly to each port and
     only the remaining presets go through mixers.
4. If `NotifyNoResult` is true and nothing was created: message 1115, title
   1116, OK only.

Return value: all created shaders. The `Insp` form inspects them.

Golden should check, on a default sphere with a Phong: the mixer name
(`ambient_blend`, `diffuse_blend`), the single shared Image shader connected
to both mixers' `color1`, `base_color` carrying the old diffuse colour,
`weight1` = (1, 1, 1, 0.5), `mode1` = 1, `inuse1` true and `inuse2`…`inuse7`
false; and for `Mode` 2 a direct connection with no mixer.

### C3. `SIConnectShaderWithBlendsInsp` (S)

Arguments: `PresetObj` (default `Image`), `Mixer` (default
`Mixers\Mix_2colors`), `InputObjs` (collection of colour ports).

For each port: read its red, green, blue; apply the `Mixer` preset to the port
with the name `mixer`; for the first port apply `PresetObj` to the mixer's
`color1` with the name `Shader`, for later ports connect that same shader to
the mixer's `color1`; write the saved red, green, blue to the mixer's
`color2`. Then inspect the shader. No ports: nothing happens.

### D1. `BlendInTextureLayersWithPorts` / `…WithPortsInsp` (S)

Arguments as C1. Purpose: add one texture layer per preset, driving the given
ports.

1. No ports or no usable preset names: empty result.
2. Resolve each port to its owning container. Containers that do not support
   texture layers are dropped with the warning
   `Could not add layers to <port>`. None left, or no unique shader container:
   empty result.
3. For each preset, for each container, take the ports that belong to it and:
   - run B1 (`AddPresetTextureLayer` behaviour) with that preset on that
     container, empty name, after, no reference;
   - if the name is not a preset but is an image file, run B3 instead;
   - set the layer's `weight` to 1;
   - run `AddTextureLayerPorts` for the layer and the ports.
   A name that gives no layer logs
   `Could not create preset or image '<name>'` as a warning.

Return value: the created layers, one per (preset, container). The `Insp` form
inspects, for each returned layer, the shader on its `color` parameter.

### D2. `BlendInTextureLayers` / `BlendInTextureLayersInsp` (S)

Arguments as C2 except `SharedMatAction` defaults to **2** and is in/out, and
`Mode` is a `siBlendInTextureLayersModes` value (default 0).

Same flow as C2 with these differences:

- `Mode` 1 or 2 additionally removes **all** connections from each port,
  including texture layer ports (`RemoveAllShadersFromCnxPoint` with
  `siShaderCnxPointAll`), before the `usealphatrans` / `inverttrans` /
  `usealpharefl` step.
- `Mode` 0 or 1: every preset becomes a layer (D1). `Mode` 2: the first preset
  is created as a plain shader, once per container, and connected directly to
  that container's ports; later presets become layers. The result then mixes
  shaders and layers.
- The "nothing created" notice is message 1195 with title 1197.

Golden should check, on a default sphere: one layer named `Image_Layer` on the
Phong, `weight` 1, two ports (ambient, diffuse), an Image shader on the layer's
`color`; and for `Mode` 2 an Image shader directly on both ports and no layer.

### D3. `BlendClipsInTextureLayersWithPorts` / `…WithPortsInsp` (S)

Arguments: `ClipList` (collection of image clips), `InputObjs` (ports).

As D1, but for each clip and container: run B2 on that container, set the
layer's `weight` to 1 and add the ports. A failure logs
`Could not blend in clip '<clip>'` as a warning. Returns the layers; the
`Insp` form inspects the shaders on their `color` parameters.

### D4. `BlendClipsInTextureLayers` / `BlendClipsInTextureLayersInsp` (S)

Arguments: `ClipList` (collection), then as D2.

1. Each element of `ClipList` that is an image source is turned into a clip;
   clips are used as they are; anything else logs
   `<item> is not a valid clip or source.` and is skipped.
2. Run D2 with a preset list made of the word `Image` repeated.
3. For each clip, in order, take the matching element of the D2 result (for a
   layer, the shader on its `color`) and connect the clip to its `tex`.

As written, the preset list holds one `Image` for one clip but only *n - 1*
for *n* ≥ 2 clips, so with two or more clips and a single material the script
runs out of results in step 3 (Q13). **Wire the one-clip case; do not guess
the multi-clip result.**

Return value: the D2 result.

### E1. `InsertShader` (S)

Purpose: put a new shader between a port and whatever feeds it.

Arguments: `PresetObj` (preset), `InputObjs` (collection of ports), `Name`.

1. The ports must have a unique shader container; otherwise this error is
   logged, spelled as shipped: `Failed to insert a shaderbecause the targeted
   ports are not within the same shader container.` Nothing is returned.
2. Ports are grouped by the shader currently connected to them; ports with no
   shader each form their own group.
3. For each group: create a shader from the preset in the container with
   `Name`. Failure: log `Invalid preset: shader not found` as an error and
   stop. Find the new shader's main input (the first shader parameter whose
   definition is flagged as the main port). If the group had a shader and a
   main input exists, connect the old shader to it. Connect the new shader to
   the group's first port, then connect whatever now sits on that port (the
   new shader, or a converter placed in front of it) to the group's other
   ports. If the connection to the first port fails, log
   `Cannot find a valid converter for <shader> when connecting to <port>` as a
   warning and stop.

All connections are made with "delete on last disconnection" false, so the
displaced shader survives. Return value: the inserted shaders, one per group.

### F. Connection primitives and pop-ups (R, S; binary not traced)

| Command | Arguments (default) | What is attested |
|---------|---------------------|------------------|
| `SIApplyShaderToCnxPoint` | `PresetObj` (preset handler), `InputObjs` (collection), `Name` (`""`), `Value` (true) | (S) called with a preset object or a preset name such as `Image`, `Mixers\Mix_2colors`, `Conversion\Scalar2color`; creates a shader, connects it to the port(s) and returns it. `Value` is never passed by the scripts (Q14) |
| `SIApplyShaderToCnxPoint2` | `ProgID` (`""`), `InputObjs`, `Name` (`""`), `Value` (true) | (R) same with a shader ProgID instead of a preset |
| `SIConnectShaderToCnxPoint` | `Source` (collection), `InputObjs` (collection), `DeleteOnLastDisconnection` (true) | (S) `Source` may be a shader **or an image clip**; returns the object that ends up on the port, which is a converter when one had to be inserted, and nothing when no converter exists. The third argument tells what happens to the shader that gets displaced |
| `UIApplyShaderToCnxPoints` | `InputObj`, `InputObjs` (collection), `X` (0), `Y` (0) | (R) "Applies a shader to multiple connection points"; (B) ProgID `SI.3D.UIApplyShaderToCnxPointsTask`. Behaviour not traced (Q15) |
| `Texture Pop-up Menu` | `InputObjs` (collection), `ShaderName` (`""`), `ClipList` (collection), `Mode` (`siReplaceAndNoBlendInTextureLayers`, 2), `EmbeddedCommand` | (R) "Pop-up a menu of available textures". No scripting name |
| `Modify Texture Pop-up Menu` | `InputObjs` (collection), `EmbeddedCommand` | (R) "Pop-up a menu of available textures and list of connected shaders". No scripting name |

The default of `EmbeddedCommand` on both pop-ups is the selection filter
`sceneobject,cluster,group,layer,~chain_element,~camera,~control_object,~curve,~light,~null,min=1`:
at least one scene object, cluster, group or layer, excluding chain elements,
cameras, control objects, curves, lights and nulls. Related menu texts in
`XSISHADERTASKS` (D): 192 "Get Presets or Images", 193 "Select Preset or
Image", 194 "Apply to...", 195 to 198 "Reflection", "Transparency", "Diffuse",
"Ambient", 199 "&Add", 200 "&Edit All", 106 "&More...", 128 "Disconnect",
129 "Edit", and the texture names 152 to 168 ("&Wood" … "&Image").

## Enable conditions and errors

No enable condition is registered for any of the 27. Script commands do not
raise their own errors except where noted; they log and return an empty
collection or nothing. Group A logs the `XSIMSGCAT` messages listed above; the
result codes returned on the 69 and 72 paths were not recovered.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Cross-check every command against the SDK command reference | web access to the Autodesk online SDK guide, or a local `xsisdk.chm` |
| Q2 | No golden exists for this row | add `tools/dump-factory/si_texture_layers_dump.js` covering the "golden should check" items and run it through XSIBATCH |
| Q3 | Does `SIConnectShaderWithBlendsInsp` return its shader to a caller although the registry says no return value? | XSIBATCH golden |
| Q4 | Title of the advanced sharing prompt (undefined lookup key) | interactive only; or follow the empty-key lookup as in CMD-01b Q2 |
| Q5 | Exact rule of "layer suitable for container": which owner is compared | trace `0x1800a5090` in `shaderhelper.dll` further, or golden: add one layer to shaders of two different materials |
| Q6 | The extra boolean condition for a layerable parameter | trace the parameter-info helper called from `0x1800a4cd0` |
| Q7 | Is a second port on the same parameter rejected lower down? | golden |
| Q8 | Naming rule of texture layer ports (one property is copied from the target parameter) | golden; or resolve the property key at `0x180065958` in `shadertasks.dll` |
| Q9 | Is the head of the layer order the top row of the editor, i.e. is `Offset` -1 "up"? | golden with the editor's command map (`CommandMaps\TexLayerEditor.DSCommandMap`, binary format not parsed) or SDK page |
| Q10 | `RemoveTextureLayers` with `Container` omitted from script: plain delete, or first element taken as container? | golden |
| Q11 | Fate of ports and connections when a layer is removed from one of several containers | golden |
| Q12 | `AddClipTextureLayer` with a non-clip argument, and `AddPresetTextureLayer` with containers from two materials: script error or logged message? | golden |
| Q13 | `BlendClipsInTextureLayers` with two or more clips | golden |
| Q14 | Meaning of `Value` on `SIApplyShaderToCnxPoint[2]`; which DLL implements them and `SIConnectShaderToCnxPoint`; converter selection rules | REA string hunt for the task ProgIDs across `Application\bin` |
| Q15 | `UIApplyShaderToCnxPoints` and the two pop-up menu commands: menu contents, what they run on selection | `shadertasks.dll`: three pop-up menu call sites at `0x18003a280`, `0x18003b8a0`, `0x18003df30` were seen but not matched to commands |
| Q16 | Message 413 says integer ports can take a layer port; the type test read from `0x1800a4cd0` accepts only 0, 2, 4, 10. Which is right? | golden: `AddTextureLayerPorts` on an integer shader parameter |
