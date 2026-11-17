# CMD-B6e: script commands of `duplicate.vbs`, `Rendering.vbs`, `simulation.vbs` and `action.vbs` (animation copy / remove, passes and partitions, FX materials, MI2 export, simulation environments, cache dialog, find cycle)

Row: **CMD-B6e** (cross-category batch grouped by implementing script). Status: **SPEC** for 23 names, **SPEC-PARTIAL** for `ExportAllPassesToMI2` (registered handler does not exist in the shipped scripts).
Run: 2026-11-17, `si-analyst`, unattended.

24 scripting names (42 registry entries, not counting the C++ `FindPeriods` worker) implemented in VBScript under
`Application\DSScripts`. All are orchestration over other commands and object
model calls; the contracts below say which ones, with which values, in which
observable order.

| Command | Entries | Category | Script | Procedure |
|---------|--------:|----------|--------|-----------|
| `CopyAllAnimation2` | 8 | (none) | `duplicate.vbs` | `CopyAllAnimationProc` |
| `RemoveAllAnimation` | 11 | Animation | `duplicate.vbs` | `RemoveAllAnimationProc` |
| `DuplicateFromAnim` | 2 | Edit | `duplicate.vbs` | `DuplicateFromAnimProc` (scripted), `GetInputAndDuplicateFromAnimProc` (key-assignable UI entry) |
| `SaveKeyAtMultipleFrames` | 1 | Animation | `duplicate.vbs` | `SaveKeyAtMultipleFramesProc` |
| `CreateEmptyPartition` | 1 | Rendering | `Rendering.vbs` | `CreateEmptyPartitionProc` |
| `SICreatePartition` | 1 | Rendering | `Rendering.vbs` | `SICreatePartitionProc` |
| `CreatePassWithPartition` | 1 | Rendering | `Rendering.vbs` | `CreatePassWithPartitionProc` |
| `GetPass` | 1 | Rendering | `Rendering.vbs` | `GetMorePassesProc` |
| `ConnectImageTo3DO` | 1 | (none) | `Rendering.vbs` | `ConnectImageTo3DO` |
| `ShowNextOGLProjection` | 1 | Viewing | `Rendering.vbs` | `ShowNextOGLProjection` |
| `ShowPreviousOGLProjection` | 1 | Viewing | `Rendering.vbs` | `ShowPreviousOGLProjection` |
| `CreateCGFX` | 1 | File | `Rendering.vbs` | `CreateCGFXProc` |
| `CreateFX` | 1 | File | `Rendering.vbs` | `CreateFXProc` |
| `LaunchFlipbookForPass` | 1 | File, Rendering | `Rendering.vbs` | `LaunchFlipbookOnInspectedPassesProc` |
| `ExportMI2File` | 1 | File, Rendering | `Rendering.vbs` | `ExportMI2FileProc` |
| `ExportAllPassesToMI2` | 1 | Rendering | `Rendering.vbs` | `ExportAllPassesToMI2Proc` (**not present**) |
| `EditShaderCompoundPPGLogic` | 1 | Rendering | `Rendering.vbs` | `EditShaderCompoundPPGLogic` |
| `StoreEnvironmentCacheToMixer` | 1 | Simulation | `simulation.vbs` | `StoreEnvironmentCacheToMixerProc` |
| `StoreEnvironmentCachesToMixer` | 1 | Simulation | `simulation.vbs` | `StoreEnvironmentCachesToMixerProc` |
| `MergeSimulationEnvironments` | 1 | Simulation | `simulation.vbs` | `MergeSimulationEnvironmentsProc` |
| `ChangeEnvironmentDynamicsOperator` | 1 | Simulation | `simulation.vbs` | `ChangeEnvironmentDynamicsOperatorProc` |
| `CacheObjectsIntoFileDialog` | 1 | File | `simulation.vbs` | `CacheObjectsIntoFileDialogProc` |
| `EditICECompoundPPGLogic` | 1 | Simulation | `simulation.vbs` | `EditICECompoundPPGLogicProc` |
| `FindPeriods` (UI entry "Find Cycle Input") | 1 of 2 | Animation Mixer | `action.vbs` | `GetInputAndFindPeriodsProc` |

The second `FindPeriods` entry ("Find Periods") is the C++ worker; it is the
callee of the UI entry and is not specified here.

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, description, all overload entries |
| (S) | the four scripts above, the listed procedures and every helper they call, read from the install | steps, constants, logged texts, called commands |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` (decoded table, 172 records, incomplete) | dialog titles and messages for the ids the scripts translate |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out.

| Command (display name) | Key-assignable | Returns a value |
|------------------------|----------------|-----------------|
| `CopyAllAnimation2` (8 entries, see its section) | no | no |
| `RemoveAllAnimation` (11 entries, see its section) | yes | no |
| `DuplicateFromAnim` (Duplicate from Animation), scripted entry | no | yes |
| `DuplicateFromAnim`, UI entry | yes | no |
| `SaveKeyAtMultipleFrames` (Save Key At Multiple Frames) | no | no |
| `CreateEmptyPartition` (Create Empty Partition) | no | no (output argument `Value`) |
| `SICreatePartition` (New Partition) | no | no (output argument `Value`) |
| `CreatePassWithPartition` (New Pass with Partition) | no | no (output argument `Value`) |
| `GetPass` (More Passes...) | no | no |
| `ConnectImageTo3DO` (Blend in image Preset and create the image clip to Default Texture Ports) | no | yes |
| `ShowNextOGLProjection`, `ShowPreviousOGLProjection` | yes | no |
| `CreateCGFX` (Creates a CGFX material), `CreateFX` (Creates an FX material) | yes | no |
| `LaunchFlipbookForPass` (Launch Flipbook For Pass) | no | no |
| `ExportMI2File` (Export To MI2 File) | no | no |
| `ExportAllPassesToMI2` (Export All Passes To MI2) | no | no |
| `EditShaderCompoundPPGLogic`, `EditICECompoundPPGLogic` | no | no (the procedures do compute True / False, see below) |
| `StoreEnvironmentCacheToMixer`, `StoreEnvironmentCachesToMixer` | yes | yes |
| `MergeSimulationEnvironments` (MergeEnvironments) | yes | no |
| `ChangeEnvironmentDynamicsOperator` | yes | no |
| `CacheObjectsIntoFileDialog` (Cache Objects Into File With Dialog) | yes | yes (nothing is returned by the procedure) |
| `FindPeriods` (Find Cycle Input) | yes | no |

All are enabled with no enable condition in the registry.

### Translated texts (D), dictionary `XSISCRIPTS`

| Id | Text | Used by |
|----|------|---------|
| 1020 | not decoded | `FindPeriods`, more than one clip selected |
| 1021 | You must select one clip and at least one object. | `FindPeriods` |
| 1022 | Invalid IN frame. Current frame must be within the clip boundaries. | `FindPeriods` |
| 1023 | Clip must have a scale of 1. | `FindPeriods` |
| 1024 | not decoded | `FindPeriods`, clip has a time warp |
| 1025 | "- Selected objects rotations: " + newline + "   Period: %s frames ==> Cycle frame: %s" | `FindPeriods`, algorithm 0 report |
| 1026 | Click OK to Add Markers... | `FindPeriods` |
| 1027 | not decoded | `FindPeriods`, trim-clip counterpart of 1026 |
| 1029 | not decoded | `FindPeriods`, result count mismatch |
| 1030 | Multiple periods found: operation 'Add Markers' not possible... | `FindPeriods` |
| 1031 | Multiple periods found: operation 'Trim Clip' not possible... | `FindPeriods` |
| 1032 | No period found to be greater than %s frames. | `FindPeriods` |
| 1068 | Duplicate from Animation | `DuplicateFromAnim` UI entry, dialog title |
| 1069 | not decoded | `SaveKeyAtMultipleFrames`, input box prompt |
| 1070 | Input Keys | `SaveKeyAtMultipleFrames`, input box title |
| 1133 | Store environment cache in mixer | `StoreEnvironmentCacheToMixer`, dialog title |
| 1134 | not decoded | `StoreEnvironmentCachesToMixer`, dialog title |
| 1135 | Caching Options Dialog | `CacheObjectsIntoFileDialog`, dialog title |
| 1177 | Shader Compound PPG Logic | `EditShaderCompoundPPGLogic`, dialog title |
| 1195, 1197 | see `cmd-01c-texture-layers.md` (notice text and title "Texturing") | `ConnectImageTo3DO`, "nothing created" notice |
| 1516 | ICE Compound PPG Logic | `EditICECompoundPPGLogic`, dialog title |

### Helpers already described elsewhere (S)

- Message box helper, wizard dialog (modal `InspectObj`; a failure of the
  inspect call counts as Cancel, anything else as OK) and scene root lookup:
  see "Shared helpers" in `cmd-10a-mixer-action-scripts.md`. `duplicate.vbs`
  carries identical copies. **Cancel** below means the script error
  `siErrCancelled` (0x4C7), which aborts the command without an error box.
- Image clip from file name, default-texturable ports, material list with
  sharing resolution, texture-layer blend-in: see "Shared script helpers" and
  section D2 in `cmd-01c-texture-layers.md`.

### Parameter filter values used by the two animation commands (S)

The scripts compare `ParameterMask` with literal numbers: 5 scaling
(`siScalingParam`), 6 rotation (`siRotationParam`), 7 translation
(`siTranslationParam`), 8 transform (`siTransformParam`). Any other value
(`siAllParam` included) means "all parameters".

## Wire contract

### `CopyAllAnimation2`

Purpose: copy animation of the given objects to the animation clipboard,
by source type and parameter family.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `SourceMask` | - | per entry (`siSourceType`) | in |
| `ParameterMask` | - | per entry (`siParameterFilter`) | in |
| `RemoveAnimation` | - | `False` | in |
| `BaseAnimation` | - | per entry | in |
| `LayerAnimation` | - | `True` | in |

Entries (R); all share the procedure and differ only in defaults:

| Display name | `SourceMask` | `ParameterMask` | `BaseAnimation` |
|--------------|--------------|-----------------|-----------------|
| Copy All Animation | `siAnySource` | `siAllParam` | True |
| Copy All Fcurve Animation | `siFcurveSource` | `siAllParam` | True |
| Copy All Layer Animation | `siFcurveSource` | `siAllParam` | **False** |
| Copy All Expression Animation | `siExpressionSource` | `siAllParam` | True |
| Copy Transform Animation | `siAnySource` | `siTransformParam` | True |
| Copy Scaling Animation | `siAnySource` | `siScalingParam` | True |
| Copy Rotation Animation | `siAnySource` | `siRotationParam` | True |
| Copy Translation Animation | `siAnySource` | `siTranslationParam` | True |

Behaviour (S):

1. Input is not an object collection: log `not the right selection....`
   (info) and stop. Empty collection: stop silently.
2. Map `SourceMask` to two switches: `siFcurveSource` gives fcurves only,
   `siExpressionSource` expressions only, `siAnySource` both. Any other value:
   log `Sorry this command is not implemented to copy constraints yet` (info)
   and stop.
3. For each input object, in order, build the target: the object itself for
   "all parameters", otherwise the object's name followed by `.kine`
   (transform, mask 8), `.kine.local.scl` (5), `.kine.local.ori.euler` (6) or
   `.kine.local.pos` (7).
4. Call `CopyAnimation <target>, <fcurves>, <expressions>, RemoveAnimation,
   BaseAnimation, LayerAnimation` once per object.

Because the clipboard is written once per object, with several input objects
the clipboard ends up holding the last object's animation *(inferred from
`CopyAnimation` being a copy-to-buffer command; not verified)*. No return
value, no selection change.

### `RemoveAllAnimation`

Purpose: remove animation of a given source type and parameter family from
the given objects.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `Time` | Frame (current frame when empty) | current | in |
| `BranchFlag` | - | `siUnspecified` | in |
| `SourceMask` | - | per entry | in |
| `ParameterMask` | - | per entry | in |
| `StaticFCurves` | - | per entry | in |
| `BaseAnimation` | - | per entry | in |
| `LayerAnimation` | - | `True` | in |

Entries (R):

| Display name | `SourceMask` | `ParameterMask` | `StaticFCurves` | `BaseAnimation` |
|--------------|--------------|-----------------|-----------------|-----------------|
| Remove All Animation | `siAnySource` | `siAllParam` | False | True |
| Remove All Fcurve Animation | `siFcurveSource` | `siAllParam` | False | True |
| Remove All Static Fcurve Animation | `siFcurveSource` | `siAllParam` | **True** | True |
| Remove All Layer Animation | `siFcurveSource` | `siAllParam` | False | **False** |
| Remove All Expression Animation | `siExpressionSource` | `siAllParam` | False | True |
| Remove All Constraint Animation | `siConstraintSource` | `siAllParam` | False | True |
| Remove All Scripted Operator Animation | `siScriptedOperatorSource` | `siAllParam` | False | True |
| Remove All Transform Animation | `siAnySource` | `siTransformParam` | False | True |
| Remove All Scaling Animation | `siAnySource` | `siScalingParam` | False | True |
| Remove All Rotation Animation | `siAnySource` | `siRotationParam` | False | True |
| Remove All Translation Animation | `siAnySource` | `siTranslationParam` | False | True |

Behaviour (S):

1. Input not an object collection, or empty: stop silently.
2. `SourceMask` = `siConstraintSource`: call `RemoveAllCns <InputObjs>` (its
   default propagation) and stop. All other arguments are ignored in this
   case.
3. Parameter family:
   - "all parameters": for each object call `IsAnimated <object>, SourceMask,
     BranchFlag, <out list>, True` (local animation only). Only when it
     answers true, call `RemoveAnimation <out list>, Time, StaticFCurves,
     BaseAnimation, LayerAnimation, SourceMask`.
   - otherwise, for each object call `RemoveAnimation` with the same trailing
     arguments on a path built from the object's name plus a suffix, with no
     prior animation test: `.kine.local.scl.scl*` (5),
     `.kine.local.ori.euler.rot*` (6), `.kine.local.pos.pos*` (7), and for
     transform (8) the suffix `/.kine.local` (with the leading slash, as
     shipped; see Q1).
4. `BranchFlag` is only used by the animation test of the "all parameters"
   path.

No message is logged, no return value, selection unchanged.

### `DuplicateFromAnim` (scripted entry)

Purpose: sample animated objects over time, leaving a static copy (or an
instance) at each sampled frame.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in/out |
| `StartFrame` | - | 0 | in |
| `EndFrame` | - | 100 | in |
| `StepFrame` | - | 10 | in |
| `DoInstance` | - | `False` | in |

Returns an `XSICollection` holding what each per-frame call returned (nothing
when the input is empty).

For each frame from `StartFrame` to `EndFrame` inclusive, advancing by
`StepFrame`:

1. `SetValue "Project.Data.PlayControl.Current", <frame>`, then `Refresh`.
2. If `DoInstance`: `Instantiate <objs>` with `NbItems` left at its default
   and `Hierarchy`, `Grouping`, `Selection`, `Xfrom` all passed as 1.
   Otherwise: `Duplicate <objs>` with `NbItems` 1, `History`, `Hierarchy`,
   `Grouping`, `Properties` left at their defaults, `Animation`
   `siNoAnimation`, `Constraints` `siNoConstraints`, `Selection`
   `siNoSelection`, `Xfrom` `siGlobalXForm`.
3. Add the call's result to the returned collection.

The play cursor is left on the last sampled frame (it is not restored). A
negative step counts down; a step of 0 never terminates *(inferred from the
loop form)*. The dialog label says instancing applies to models only; the
script itself does not filter.

### `DuplicateFromAnim` (UI entry)

Same arguments, all in/out with no defaults.

1. Read the timeline `In` and `Out` (`Project.Data.PlayControl.In` / `.Out`).
2. Add a `Custom_parameter_list` property named `Duplicate From Animation` to
   the scene root and add four parameters to it (all with the `siSilent`
   capability, hard range -1000000 to 1000000 for the three numbers):

| Parameter | Type | Default | UI range | Label |
|-----------|------|---------|----------|-------|
| `Start` | `siDouble` | timeline In | In to Out | Start Frame |
| `End` | `siDouble` | timeline Out | In to Out | End Frame |
| `Step` | `siDouble` | 10 | 0 to (Out - In) | Step value |
| `Instance` | boolean (type 11) | the incoming `DoInstance` | 0 to 1 | Instance (Model Only) |

3. Show the property modally with title 1068. The incoming `StartFrame`,
   `EndFrame`, `StepFrame` are not used to seed the dialog.
4. OK: read the four values back into the arguments, call `DuplicateFromAnim
   <InputObjs>, Start, End, Step, Instance` (scripted entry behaviour), then
   `DeleteObj` the property.
5. Cancel: `DeleteObj` the property, then **cancel**.

### `SaveKeyAtMultipleFrames`

Argument `InputObjs` (handler AnimatableParameters: the marked parameters of
the selection when empty; in).

1. Fewer than one parameter: log `You need to select items and mark
   parameters to key` (info), stop.
2. Show a text input box (prompt 1069, title 1070). The answer is a
   comma-separated list of frames.
3. Parse: split on commas; remove all spaces from each piece; pieces that are
   not numeric are dropped silently; numeric pieces are converted to integers
   (rounded); a frame below the timeline `PlayControl.In` or above
   `PlayControl.Out` is dropped with the log line `Input Key ignored key at
   frame: <n> - outside the boundries of start and end frame` (spelling as
   shipped).
4. Empty answer (or the box cancelled), or no frame left: log `Invalid frame
   string` (info), stop.
5. For each remaining frame, in the order typed (duplicates kept): `SaveKey
   <InputObjs>, <frame>`. Values keyed are the parameters' current values, the
   play cursor is not moved.

### `CreateEmptyPartition`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `Target` | Collection | `Passes.Current` | in |
| `Name` | - | `Partition` | in |
| `Type` | - | `siObjectPartition` (`siPartitionType`) | in |
| `Value` | - | - | out |

Calls `SICreateEmptyPartition Target, Name, Type, Value` (C++). When a
partition came back: `SelectObj <partition>` then `AutoInspect <partition>`.
`Value` is the partition.

### `SICreatePartition`

| Argument | Default | Dir |
|----------|---------|-----|
| `Target` | `""` (pass; empty lets the callees use their default, the current pass) | in |
| `Name` | `Partition` | in |
| `InputObjs` | `""` | in |
| `Value` | - | out |

1. From `InputObjs` build two lists: *objects* = items passing the filter
   `object, group`, minus lights, minus cameras; *lights* = items passing the
   light filter. With the default empty `InputObjs` the filter command works
   on the current selection *(inferred from the filter command's empty-input
   convention)*.
2. Objects list not empty: `SICreateEmptyPartition Target, Name,
   siObjectPartition`, then `MoveToPartition <new partition>, <objects>,
   Target`.
3. Lights list not empty: `SICreateEmptyPartition Target, Name,
   siLightPartition`, then `MoveToPartition <new partition>, <lights>,
   Target`.
4. Neither list has items: `SICreateEmptyPartition Target, Name` (type left at
   its default, an object partition).

`Value` is the last partition created; when both an object and a light
partition are made it is the **light** partition. Both get the same requested
name (uniqueness is the callee's). Cameras are never moved. No selection, no
inspection.

### `CreatePassWithPartition`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `PresetObj` | Preset | `Pass` | in |
| `Name` | - | `""` (pass name) | in |
| `ParamName` | - | `""` (partition name) | in |
| `InputObjs` | Collection (selection when empty) | selection | in |
| `Value` | - | - | out |

1. `SICreatePass PresetObj, Name`; its `Value` output is the new pass and
   becomes this command's `Value`.
2. `SetCurrentPass <pass>`.
3. `SICreatePartition` with no target, name `ParamName`, objects `InputObjs`
   (see above; the partitions land in the now-current new pass).
4. `SelectObj "<pass>.Partitions.Background_Objects_Partition"`.
5. `AddProp "Visibility"` with no target, i.e. on that selection: the
   background objects partition of the new pass receives a Visibility
   property (left at the preset's values by this script).

The final selection is the background objects partition.

### `GetPass`

| Argument | Default | Dir |
|----------|---------|-----|
| `PresetObj` | `""` | in/out |
| `Name` | `""` | in |

1. Open the preset browser: `SIGetPreset <path>, siPassFamily`. The procedure
   has a third parameter for the browse path which the registry does not
   supply, so the path is empty. The incoming `PresetObj` is ignored and
   replaced by the chosen preset.
2. A preset was chosen: `SICreatePass <preset>, Name`.
3. Nothing chosen: **cancel**.

No current-pass change, selection or inspection by the script itself.

### `ConnectImageTo3DO`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | selection | in |
| `FileName` | - | `""` | in |

Returns the collection of texture layers created (nothing on clip failure).

1. Create an image clip from `FileName` (`SICreateImageClip`, output `Clip`).
   On failure log `Could not create image clip '<FileName>'` (warning) and
   stop.
2. Run the `BlendInTextureLayers` behaviour (section D2 of
   `cmd-01c-texture-layers.md`) with: presets `Image`; the input objects;
   `SharedMatAction` 3 (ask per shared material); notify when nothing was
   created (message 1195, title 1197); mode `siBlendInTextureLayers` (every
   preset becomes a layer); Ambient true, Diffuse true, Transparency false,
   Reflection false.
3. For each returned layer: find the shader on `<layer>.color`
   (`SIGetShaderOnCnxPoint`) and connect the clip to `<shader>.tex`
   (`SIConnectShaderToCnxPoint`).
4. If at least one shader was found, open one `InspectObj` on the
   comma-joined list of those shaders.

### `ShowNextOGLProjection`, `ShowPreviousOGLProjection`

No arguments. Cycles which UV set a selected object's material displays.

1. `ActivateObjectSelTool`.
2. Keep the items of the selection that pass the filter `geometry`; none:
   stop.
3. For each such object:
   - take the sample clusters (cluster filter `Sample`) of its active
     primitive's geometry; none: skip the object;
   - read the object's material parameter `UV` (current UV property name);
   - list the names (last dot-separated part) of the properties of type
     `uvspace` on the sample clusters. The list is restarted for each cluster,
     so it is in effect that of the last sample cluster with UV properties;
   - find the current name in the list; Next takes the following entry and
     wraps from last to first, Previous takes the preceding entry and wraps
     from first to last;
   - write that name to the material's `UV` parameter through the object
     model.

When the current name is not in the list the position counts as the first
entry *(inferred from the uninitialised index)*. An object whose sample
clusters carry no UV property gets an empty name written *(inferred)*. No
message, no return value.

### `CreateCGFX`, `CreateFX`

| Argument | Default | Dir |
|----------|---------|-----|
| `FileName` | `""` (effect file path) | in |
| `Library` | `""` (material library name) | in |
| `Model` | `""` (path of an object to assign to) | in |

1. `CreateFX` only: open the file as text and scan every line. If any line
   contains `technique10` (case-sensitive) the preset is `DX10FX.Preset`,
   otherwise `DXFX2.Preset`. `CreateCGFX` always uses `CgFX.preset`. A file
   that cannot be opened makes `CreateFX` fail with the script engine's error.
2. Library: the scene material library named `Library`; if there is none by
   that name, the active material library.
3. Material name: the file name after the last backslash (after the last
   forward slash when there is no backslash), cut at its **first** dot.
4. Create a material in the library from the preset with that name
   (`CreateMaterial`), take its first shader, and `SetValue
   "<shader>.filename", FileName`.
5. If `Model` is not empty, resolve it with `GetValue` and assign the
   material to it with the object's `SetMaterial`.

No return value, no selection or inspection. A file name with no dot has no
defined result (Q4).

### `LaunchFlipbookForPass`

Argument `InputObj` (Collection, selection when empty, in). The registry
description ("Automatic Set Render File Paths") does not match the behaviour.

For each item:

1. Type `Pass`: the framebuffer is the pass's framebuffer named `Main`. Type
   `Framebuffer`: the pass is its first owner. Anything else: log `<item> is
   not a pass or a framebuffer` (info) and continue *(inferred caveat: after a
   valid item, a following invalid item reuses the previous pass and
   framebuffer because they are not reset between items)*.
2. Frame range source: the pass, unless the pass's `FrameRangeSource` is 3, in
   which case `Passes.RenderOptions`. On that source, `FrameRangeSource`:
   - 1 (frame set): log `<source name> is set to use frame set as frame range.
     Flipbook needs a sequence.` (info); no flipbook for this item;
   - 2 (timeline): start, end, step from `PlayControl.In`, `.Out`, `.Step`;
   - other: `FrameStart`, `FrameEnd`, `FrameStep` of the source.
3. Call `Flipbook` with the command line
   `-m -s "<resolved path>" <start> <end> <step> <rate>` where the path is the
   framebuffer's resolved path (`GetResolvedPath` with an empty argument, so
   the frame token is left unresolved) and the rate is `PlayControl.Rate`.

### `ExportMI2File`

Backward-compatible wrapper around `ExportRenderArchive`.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection | selection | in (passes) |
| `PresetObj` | Preset | none | in, **ignored** |
| `StartFrame`, `EndFrame`, `StepFrame` | NaN | none | in |
| `FileName` | - | `""` | in |
| `ApproximatePolygons`, `ApproximateFaces`, `AsciiOutput`, `VerbatimTextures`, `MultipleFiles`, `Incremental` | NaN | none | in |

1. Empty input: stop. Keep the items of type `Pass` whose renderer is mental
   ray: the pass's `Renderer` equals `mental ray` (case-insensitive), or it is
   empty and `Passes.RenderOptions.Renderer` is mental ray. None left: stop
   silently.
2. For every kept pass, remember and override (only for arguments that were
   supplied):

| Argument | Pass parameter overridden | Value written |
|----------|---------------------------|---------------|
| `FileName` (non-empty; a trailing `.mi2`, any case, is removed) | `ArchiveFilename` | the file name |
| `ApproximatePolygons` | `mentalray.ArchiveApproximatePolygons` | the value of **`AsciiOutput`** (as shipped) |
| `ApproximateFaces` | `mentalray.ArchiveApproximateNURBS` | the value of **`AsciiOutput`** (as shipped) |
| `AsciiOutput` | `mentalray.ArchiveAsciiOutput` | `AsciiOutput` |
| `VerbatimTextures` | `mentalray.ArchiveEmbedTextures` | `VerbatimTextures` |
| `Incremental` | `ArchiveMultiFrame` | `Incremental` |
| `MultipleFiles` | none | ignored |

3. `ExportRenderArchive <kept passes>, StartFrame, EndFrame, StepFrame`.
4. Restore every overridden parameter to its remembered value, then re-raise
   the error of step 3 if there was one. (Whether the restore really runs
   after a failing export is Q5.)

### `ExportAllPassesToMI2` (SPEC-PARTIAL)

Registry (R): one input argument `PassCentric` (default `True`), handler
`ExportAllPassesToMI2Proc` in `Rendering.vbs`, description "Export all passes
to MI2 files". (S): no procedure of that name exists in `Rendering.vbs`, nor
in any other file of `DSScripts` or in any script / toolbar / XML file of the
installed `Application` tree; the only MI2 code left is `ExportMI2File` above.
The entry is a stale registration: invoking it can only fail at handler lookup
*(inferred; exact error text not observed)*. See Q6.

### `EditShaderCompoundPPGLogic`, `EditICECompoundPPGLogic`

Purpose: edit a compound's property-page logic script in a modal text editor.

| | Shader compound | ICE compound |
|---|---|---|
| Argument `InputObj` | Collection, in | SingleObj, in |
| Read current values | `GetShaderCompoundProperties` | `GetICECompoundProperties` |
| Minimum result length | 10 values | 13 values |
| Logic text / language at index | 8 / 9 | 11 / 12 |
| Temporary property name | `Shader Compound PPG Logic` | `ICE Compound PPG Logic` |
| Dialog title | 1177 | 1516 |
| Write back | `SetShaderCompoundPropertiesEx <obj>` with `ModifyFlags` 768 and only `PPGLogic` and `PPGLogicLanguage` supplied | `EditICECompoundProperties <obj>` with result values 0 to 10 passed back unchanged, then the new logic and language |

Common steps:

1. Read the compound's properties. A result shorter than the minimum: stop
   (False). An empty language becomes `VBScript`.
2. Add a `CustomProperty` (not branch) with the name above to the scene root,
   with two string parameters `Language` and `Logic` holding the current
   values.
3. Layout: group `Scripting Language` holding a combo for `Language` with
   items `VBScript`, `JScript`, `Python` (label and value identical), no
   label; group `Logic` holding a text editor for `Logic`: no label, height
   600, width 600, line numbering on, margin width 6, folding on, font
   `Tahoma`, comment font `Comic Sans MS`, preprocessor colour 128, comment
   colour 32768. The layout carries a small logic of its own: on open and on
   every change of `Language`, the editor's syntax language is set to the
   `Language` value and the page is refreshed.
4. Show the property modally (title above, no error on cancel).
5. Not cancelled: write back as in the table; result True. Cancelled: nothing
   written; result False.
6. `DeleteObj` the temporary property in both cases.

`ModifyFlags` 768 is 0x300, two bits *(inferred: the logic and logic-language
selectors of the extended setter)*.

### `StoreEnvironmentCacheToMixer`, `StoreEnvironmentCachesToMixer`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `EnvironmentCache` (first command) / `Environment` (second) | SingleObj | none | in |
| `Name` | - | `SimulationRun` | in/out |
| `AddClip` | - | `False` | in/out |

The special `Name` value `(UIOnly)` requests the dialog; the name is then
reset to `SimulationRun`.

- Without dialog: the first command calls `SIStoreEnvironmentCacheToMixer
  <cache>, Name, AddClip` once. The second calls it once for each cache of the
  environment's `Caches`, in order, and collects the results.
- With dialog: add a `CustomProperty` (not branch) named
  `StoreEnvironmentCacheToMixer` (same name for both commands) to the scene
  root with

| Parameter | Type | Default | Label | Description |
|-----------|------|---------|-------|-------------|
| `ActionsName` | string | `SimulationRun` | RBD Action Name | If RBD included in the simualtion, the name given to the new action created (spelling as shipped) |
| `AddClip` | boolean | False | Add Clip To Mixer | If checked, adds a clip to the mixer on a new track |

  and show it modally (title 1133 for the first command, 1134 for the
  second). OK: copy the two values into `Name` and `AddClip` (visible to the
  caller, the arguments are in/out) and make the same call(s) as above.
  Cancel: no call, no error. The property is deleted in both cases.

Return value: the first command always returns nothing (the worker's result
is discarded) although the registry declares a return value; the second
returns an `XSICollection` of the worker results (empty after Cancel).

### `MergeSimulationEnvironments`

Argument `SimulationEnvironments` (Collection, selection when empty, in/out).
Merges all given environments into the first one.

1. Keep the items passing the filter `Environment`. None: log
   `MergeEnvironments: You need to select at least two environments in order
   to merge them.` (error). Exactly one: log `MergeEnvironments : You need to
   select more than an environment object.` (error). Stop in both cases.
2. The first environment is the destination. If it has no containers, add
   three with `AddContainerToEnvironment <dest>, <type>, 1, <name>`:
   `RigidBody` / `RigidBodies`, `Constraint` / `Constraints`, `Force` /
   `Forces`.
3. For every other environment, for each of its containers: add each member
   to the destination container **of the same name** (object model
   `AddMember`), then remove each member from the source container with
   `RemoveFromContainer <container>, <member>` (needed because some
   containers, forces, are not exclusive).
4. Re-target simulation operators: find all objects of class id
   `{CBB627A6-84EC-42A3-894D-09F78FCF0293}` (the evolve operators) in the
   scene; walk them from last to first, skipping any without input ports
   (the scene default operator). The operator's environment is the parent of
   the target of its input port 2; if it is one of the merged (non
   destination) environments: take the primitive on input port 0 and its
   model; look up the destination environment's cache for that model
   (`FindCacheForModel`); delete the operator with `DeleteObj`; apply a new
   one with `ApplyOp "EvolveOp", "<prim>;<prim>;<dest>.simtimectrl;<cache>"`
   (full names). The no-cache branch (create one with `CreateEnvironmentCache
   <model>, <dest>` and name it `<model>_<dest>_Cache`) is defective as
   shipped, see Q7.
5. Write the text form of the filtered environment list back to the argument
   and `DeleteObj` all merged source environments in one call.

A source container whose name has no counterpart in the destination is not
handled by the script (Q8).

### `ChangeEnvironmentDynamicsOperator`

| Argument | Default | Dir |
|----------|---------|-----|
| `InputEnvironment` | none | in |
| `DynamicsEngine` | `siPhysXEngine` (`siRBDEngine`) | in |

1. No environment given: use the scene's active simulation environment; if
   there is none log `There is no active simulation environment in this
   scene.` (error) and stop. A value that is not a simulation environment:
   log `You must specify a Simulation Environment.` (error) and stop.
2. Take the environment's first operator and the last part of its full name.
3. Name `NXDynamicsop` and engine `siOpenDynamicsEngine`: log `Switched to
   ODE`, `DeleteObj` the operator, `ApplyOp "DynamicsOp", <environment>`.
   Name `dynamicsop` and engine `siPhysXEngine`: log `Switched to Ageia
   physX`, `DeleteObj` the operator, `ApplyOp "NXDynamicsOp", <environment>`.
   Names are compared exactly as written here. Any other combination
   (already on the requested engine, other operator): nothing happens,
   nothing is logged.

### `CacheObjectsIntoFileDialog`

No usable arguments (the registry lists one placeholder, `CreatedObj`, with
direction -1 and default `VBScript`; the procedure takes none). Opens a
non-modal options page from which the user launches `CacheObjectsIntoFile`.

1. Keep the geometry objects of the selection (`siGeometryFilter`). None: log
   `CacheObjectsIntoFileDialog: No valid geometries selected!` (error), stop.
2. Find the property named `Caching_Options` on the scene root; if absent add
   a `Custom_parameter_list` of that name there. The property is **kept**
   after the command, so settings persist in the scene.
3. Only when the property was just created, add (capability 4 unless noted):

| Parameter | Type | Default | Range (UI range) |
|-----------|------|---------|------------------|
| `FileName` | string | from preferences, below | - |
| `Format` | string | from preferences, below | - |
| `Path` | string | from preferences, below | - |
| `PathFeedBack` | string, capability 6 (read-only feedback) | computed | - |
| `FrameStart` | `siInt4` | timeline In | -100000 to 10000000 (In to Out) |
| `FrameEnd` | `siInt4` | timeline Out | -100000 to 10000000 (In to Out) |
| `FrameStep` | `siInt4` | 1 | 1 to 10000000 (1 to 4) |
| `overwrite` | boolean | true | - |

   `Path` comes from the preference `preferences.simulation.defaulttemplateindex`:
   0 `cachetemplateprojectpath`, 1 `cachetemplatelocalpath`, 2
   `cachetemplatepatha`, 3 `cachetemplatepathb`, other `cachetemplatepathc`
   (all under `preferences.simulation`). The file name comes from
   `preferences.simulation.cachetemplatefilename` with `[version]` replaced
   by `take1`; a trailing `.icecache` is removed and `Format` set to
   `ICECache`; a trailing `.pc2` is removed and `Format` set to `PC2`;
   otherwise the name is kept whole and `Format` is `Custom`.
4. Attribute switches (every call): for each selected geometry, collect the
   names of its ICE attributes that are not read-only, excluding `Init`,
   `ID`, `subdloop`, `subdrule`, names starting with `__Init_`, and
   attributes of the point-locator data type; each name once, at most 300.
   For every name without an existing parameter add a boolean `attr_<name>`
   (capability 4). Its default is true for "standard" attributes: if any
   selected object's type contains `pointcloud`, the names (case-insensitive)
   `PointPosition`, `Color`, `Force`, `Mass`, `Orientation`, `PointVelocity`,
   `Scale`, `Shape`, `ShapeInstanceTime`, `SimulatedFrameFraction`, `Size`,
   `SpriteAngle`, `State_ID`, `State_Transition_Time`, `StrandOrientation`,
   `StrandPosition`, `StrandSize`, `StrandVelocity`; otherwise only
   `PointPosition`. Switches from earlier calls are kept with their values.
5. Rebuild the layout (every call):
   - tab `General`: a row with group `FileName` (the name field, no label)
     and group `Format` (combo, no label, items `ICECache`, `PC2`, and
     `Custom` whose stored value is the empty string); group `Path` (folder
     control for `Path`, then `PathFeedBack`, both without label); group
     `Time Range` (`FrameStart` "start", `FrameEnd` "end", `FrameStep`
     "step"); group `Options` (`overwrite` "Overwrite existing files"); a row
     with button `Cache!` (left) and button `Preferences` (right);
   - tab `Attributes`: a row with buttons `Uncheck All` (left) and `Check
     All` (right), then one check box per collected attribute, labelled with
     the attribute name.
6. Page behaviour (logic attached to the layout):
   - on open and whenever `Path`, `FileName` or `Format` changes, recompute
     `PathFeedBack`: `Path`, a `/` if it does not already end with `/` or
     `\`, the file name, then by format: ICECache appends `.icecache`; PC2
     removes a trailing `_[frame]`, `.[frame]` or `[frame]` and appends
     `.pc2`; other formats append nothing. `[object]` and `[model]` are
     replaced by the name of the first selected object and of its model (the
     literal words `object` and `model` when nothing is selected), and the
     result is passed through `XSIUtils.ResolvePath`;
   - `Cache!`: build the attribute list (comma-joined names of the checked
     `attr_` switches) and the output path as above but **without** the
     `[object]` / `[model]` replacement and without resolving, then call
     `CacheObjectsIntoFile` with `PathID` 5, `FirstFrame` / `LastFrame` /
     `FramesPerStep` from the page, `Overwrite` from the page,
     `ShowProgressbar` true, `Attributes` the list, `Version` `take1`,
     `AlternativePath` the path. The objects argument is not bound inside the
     page logic, so the callee works on the selection current at click time
     *(inferred)*;
   - `Preferences`: `InspectPreferences "Simulation"`;
   - `Uncheck All` / `Check All`: `SetValue "<property>.attr_*", false / true`.
   - Handlers for five path shortcut buttons (project, temp, A, B, C; each
     sets `Path` from the matching preference and refreshes the feedback)
     exist but the buttons are not in the layout.
7. `InspectObj <property>` with title 1135 (non-modal). The command ends
   here; nothing is cached until `Cache!` is pressed.

### `FindPeriods` (UI entry, "Find Cycle Input")

Purpose: find the cycle length of the motion under a selected mixer clip,
report it, then either drop markers at each cycle or trim the clip to whole
cycles.

| Argument | Default | Dir | Role |
|----------|---------|-----|------|
| `InputObjs` | none | in | parameters to analyse; empty means "selected objects" |
| `Algorithm` | none | in | overwritten by the dialog |
| `StartFrame`, `EndFrame` | none | in/out | overwritten: current frame / end of clip |
| `Minimum Period Length` | none | in/out | overwritten by the dialog |
| `Mode` | none | in/out | overwritten: 1 add markers, otherwise trim |
| `Name` | none | in/out | overwritten: marker name |
| `Title` | `Find Periods` | in | unused |

Every failure below logs the message (info), shows it in a box titled
`Warning` (exclamation icon, OK), then **cancels**.

1. Selection checks. Split the selection into scene objects and other items
   (filter `sceneobject`). No other items: 1021. Among the other items, the
   clip is the one of type `mixeranimclip` or `AnimActionCompoundClip`; a
   second one: 1020. No scene object selected: 1021. (No clip among the
   non-object items is not tested, Q9.)
2. Clip checks, reading `<clip>.actionclip.timectrl` parameters
   `startoffset`, `scale`, `clipin`, `clipout`, `dowarp`:
   cycle start = current frame (`PlayControl.Current`); cycle end =
   `startoffset + (clipout - clipin)`. Current frame outside [`startoffset`,
   cycle end]: 1022. `scale` not 1: 1023. `dowarp` on: 1024.
3. Add the preset property `FindCycleWizard`, named `FindCycles`, to the
   scene root. It has the parameters `Algorithm`, `Estimate`, `MarkerName`,
   `AddMarkers` *(inferred from a disabled generator branch in the script:
   `Algorithm` integer 0..1, `Estimate` number with default 2 and UI range 2
   to cycle end - 1 labelled "Duration", `MarkerName` string labelled "Marker
   Name", `AddMarkers` integer 0..1 default 1)*. Set `Algorithm` to 1 when
   `InputObjs` was supplied; otherwise set it to 0 and use the selected scene
   objects as input. Set `Estimate` to 2.
4. Show it modally with the literal title `FindCycles`. Cancel: delete the
   property, **cancel**.
5. OK: read `Estimate` (minimum period), `MarkerName`, `AddMarkers` and
   `Algorithm` (0 = rotation / quaternion based, 1 = signal-processing based).
   Call the worker `FindPeriods <inputs>, <algorithm>, <cycle start>, <cycle
   end>, <minimum period>`; it returns an array of periods. Delete the
   property.
6. Report. Number of whole cycles N = floor((cycle end - cycle start) /
   period); cycle frame = cycle start + N * period.
   - Algorithm 0: one period (first array element). Message = 1025 filled
     with the period and the cycle frame. Log it (info, preceded by a line
     break) and show it in a box titled `Find Cycle Information`, followed by
     a blank line and 1026 (add markers) or 1027 (trim).
   - Algorithm 1: an empty result ends the command silently. A result whose
     size does not match the input count (and does not start at index 0):
     1029 with the failure handling above. Otherwise one block per non-zero
     period: `- <input parameter> :`, new line, `   Period: <p> frames ==>
     Cycle frame: <f>`, blank line (the two fixed fragments are looked up in
     the dictionary by their English text). More than one non-zero period:
     the box and the log show 1030 (add markers) or 1031 (trim), a blank line
     and the blocks, and nothing is changed. Exactly one: the box shows the
     block plus 1026 / 1027. None: the box shows 1032 filled with the minimum
     period and the log line is empty.
7. Action, only when exactly one non-zero period p was found:
   - add markers (`AddMarkers` = 1): for i = 0 to N inclusive, `AddMarker
     <model of the clip>, <clip>, <cycle start + i * p - startoffset>, 0,
     <MarkerName>`;
   - trim (otherwise), three `SetValue` calls on the clip's time control, in
     this order, computed from the values read in step 2: `startoffset` =
     cycle start; `clipout` = `clipin + cycle start + N * p - startoffset -
     1`; `clipin` = `clipin + cycle start - startoffset`.

## Enable conditions and errors

None of the commands has a registry enable condition. Commands that open a
dialog, input box or browser (`DuplicateFromAnim` UI entry,
`SaveKeyAtMultipleFrames`, `GetPass`, both PPG-logic editors, the two store
commands with `(UIOnly)`, `CacheObjectsIntoFileDialog`, `FindPeriods` UI
entry) need a user session; under batch the inspect / input calls fail or
answer "cancelled" *(inferred; no XSIBATCH run)*. Message boxes go through the
shared helper, which under batch logs `<title>: <prompt>` and answers the
default (OK).

Commands that end with **cancel**: `DuplicateFromAnim` UI entry (dialog
cancelled), `GetPass` (no preset chosen), `FindPeriods` UI entry (every
validation failure and dialog cancel). All other failure paths log and return
normally.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | `RemoveAllAnimation` with the transform filter passes `<object>/.kine.local` (leading slash) to `RemoveAnimation`: is the slash a path syntax the resolver accepts (and with what meaning) or does the call fail? | golden on "Remove All Transform Animation"; resolver in the binary |
| Q2 | Texts of dictionary ids 1020, 1024, 1027, 1029, 1069, 1134 (not in the decoded table) | complete decode of `XSISCRIPTS.dict` |
| Q3 | `CopyAllAnimation2` with several objects: does `CopyAnimation` accumulate or replace the clipboard? | binary pass on `CopyAnimation`; golden |
| Q4 | `CreateCGFX` / `CreateFX` with a file name without a dot, and the parameters of the `CgFX`, `DXFX2`, `DX10FX` presets | golden; preset files |
| Q5 | `ExportMI2File`: no error trap is visible around `ExportRenderArchive`, so on failure the overridden pass parameters may stay overridden; also confirm that `ApproximatePolygons` / `ApproximateFaces` really write the `AsciiOutput` value | golden with a failing export; file-level read of error mode in `Rendering.vbs` |
| Q6 | `ExportAllPassesToMI2`: handler missing from the install. Error text when invoked; whether any menu still references it | golden (invoke in XSIBATCH); registry / menu scan |
| Q7 | `MergeSimulationEnvironments` when the destination has no cache for the model: the script stores the new cache in a variable it never uses and then renames / connects a missing one. Observable result (script error, or operator applied without cache)? | golden with two environments and no destination cache |
| Q8 | `MergeSimulationEnvironments`: source container names absent from the destination; port index meaning (0 primitive, 2 environment time control) of the evolve operator | operator SPDL; golden |
| Q9 | `FindPeriods` UI entry with non-object items selected but no clip among them (clip stays undefined) | golden |
| Q10 | Definition of the `FindCycleWizard` preset property (parameter types, labels, layout) | preset file in `DSPresets`; no file of that name was found by a quick search |
| Q11 | Meaning of `ModifyFlags` 768 in `SetShaderCompoundPropertiesEx` and layout of the arrays returned by `GetShaderCompoundProperties` / `GetICECompoundProperties` | binary pass on those commands |
| Q12 | `PathID` 5 of `CacheObjectsIntoFile` and how `AlternativePath` tokens (`[object]`, `[model]`, `[frame]`) are resolved there | the `CacheObjectsIntoFile` note |

Q1 to Q12 concern delegated commands, undecoded texts or shipped defects; the
script-level behaviour of 23 of the 24 commands is fully read.
