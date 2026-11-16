# CMD-03b: legacy particle commands implemented in `particle.vbs`

Row: **CMD-03b** (split from CMD-03, Simulation). Status: **SPEC**.
Run: 2026-11-16, `si-analyst`, unattended.

12 scripting names (22 registry entries with overloads) of the legacy
(pre-ICE) particle system plus the ICE "emit points" starter. All are
VBScript procedures in `Application\DSScripts\particle.vbs`.

| Command | Registry entries (display name → procedure) |
|---------|---------------------------------------------|
| `CreateParticleCloud` | Particle Cloud (`Prim` ""), Sphere / Disc / Grid / Cube Particle Cloud (`Prim` = that word) → `CreateParticleCloudProc` |
| `CreateFluid` | Create Fluid from Cube / Square / Disc → `CreateFluidProc` |
| `CreateExplosion` | Create Explosion from Sphere / Cylinder → `CreateExplosionProc` |
| `CreateInspectParticleTypeBillboard` / `…Sphere` / `…Blob` | Create & Inspect Particle Billboard / Sphere / Blob Type → `CreatePTypeProc` |
| `CreateParticleSimulationFromFile` | Create Particle Simulation From File → `CreateParticleSimulationFromFileProc` |
| `InspectInitStateProp` | InspectInitStateProp → `InspectInitStatePropProc`; InspectParticleSimulationOp → `InspectParticleOperatorProc` (same scripting name, two entries) |
| `AddParticleEvent` | Add Particle Event → `AddParticleEventProc` (not key-assignable) and `AddParticleEventUIProc` (key-assignable) |
| `AddParticleGoal` | Add Particle Goal Object → `AddParticleGoalProc`; Pick Goal → `AddParticleGoalUIProc` |
| `AddParticleForce` | Add Particle Force Object → `AddParticleForceProc`; Pick Force → `AddParticleForceUIProc` |
| `EmitPointsFromObject` | Emit Points From Object → `EmitPointsFromObjectProc` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display and scripting names, arguments, defaults, handlers, `return_value`, key-assignable flag, descriptions |
| (S) | `Application\DSScripts\particle.vbs` (44,291 bytes, 1,379 lines): the ten command procedures and every helper they call in that file, read in full from the install | every observable step, constant, preset name and literal message |
| (D) | `Application\Dictionary\en\XSISCRIPTS.dict` | pick prompt texts for ids 1098 to 1102 |
| - | REA / Ghidra | **Not used.** The C++ commands these scripts call (`SIAddParticleEvent`, `SIAddParticleGoal`, `SIAddParticleForce`, `CreateParticleType`, `SetParticleType`, `UpdateParticleTypeConnections`, `AddParticleEmitter`) and the operators (`SparksOp`, `HyperFlowOp`, `BlowUpOp`, `BlasterOp`) are separate rows |
| - | XSIBATCH goldens | **Not run** |

No script text is reproduced. Names, values, preset names and message strings
are recorded as facts.

## Shared facts

### Registry flags (R)

All 22 entries are enabled and have no enable condition. Category
`Simulation`. Entries marked "UI" above are key-assignable; the plain
`Add Particle … Object` entries and `InspectParticleSimulationOp` are not.
`return_value` is true for `CreateParticleCloud`, `CreateFluid`,
`CreateExplosion`, `CreateParticleSimulationFromFile` (though its procedure
produces nothing), `InspectInitStateProp` (both entries, nothing produced) and
`EmitPointsFromObject`; false for the three type commands and the three
`AddParticle…` commands, which hand results back through output arguments.

The `AddParticle…` arguments `Target`, `InputObj` / `Source` are in/out
(flags 6) with the registry default `{F1D7703B-083A-42B9-841D-49FE3779CECD}`
(the "use an empty collection" marker, as on other commands); `Output` is
out-only (flags 4).

### Values used

| Name | Value / meaning |
|------|-----------------|
| particle type render kinds | `siBillboardType`, `siSphereType`, `siBlobType` (passed by name to `CreateParticleType`) |
| wire colour of emitters | `display.wirecol` = 33 after `MakeLocal` of the display property with node propagation |
| wire colour of the explosion light | 15 |
| operator connect mode | node level (`siNode`; the fluid and explosion paths pass the literal 3), persistent operation |
| emission property | preset name `Emission Property`, added with node propagation, named `<object name>_emission`; its type is `EmissionProp` |
| initial state property | preset `ParticleInitialStateProp`; property type `ParticleInitState` |
| legacy simulation operator types in a cloud's stack | `ParticlesOp`, `ExplosionOp`, `FluidOp` |
| property / element types | `ParticleEvent`, `ParticleGoal`, `ObstacleProp`, `EmissionProp`, `ParType` |
| selection filters used | `Decay`, `CloudOrPType`, `PType`, `Emitter`, `Force`, generic object filter, `geometry`, `Particle` (family search) |

### Pick prompts (D), dictionary `XSISCRIPTS`

| Id | Text | Used by |
|----|------|---------|
| 1098 | Pick ParType | `AddParticleEvent` |
| 1099 | Pick cloud or ParType | `AddParticleGoal`, target |
| 1100 | Select an object that you want as a particle goal | `AddParticleGoal`, goal object |
| 1101 | Pick Cloud, Cloth, SoftBody or Hair | `AddParticleForce`, target |
| 1102 | Pick Force | `AddParticleForce`, force |

Ids are from the script; the pairing with the five consecutive dictionary
strings is by order and by the id 1102 record read from the file *(inferred
for 1098 to 1101)*.

### Pick loop (S), shared by the three `AddParticle…` commands

When a required collection is missing the command starts a pick session with
`PickElement(<filter>, <prompt>, <prompt>)` (same text for left and middle
button). The session repeats until the user ends it with the right button or
Escape (button 0); every successful pick **replaces** the previous one, so the
last picked element is the one used. If nothing was picked the command logs
its error line (severity error) and fails with `siErrCancelled`.

### Default particle renderer (S)

Applied to the new clouds by `CreateParticleCloud`, `CreateFluid` and
`CreateParticleSimulationFromFile`. For each particle-family object in the
input:

1. Make the object's material local.
2. Create a shader from preset `Particle_Renderer`, named `Particle_Renderer`,
   under that material.
3. Try the material ports in the order Surface, Shadow, Volume, PhotonVolume
   and stop at the first that takes the shader. Taking means: any existing
   source on the port is deleted first, then the shader is connected; a port
   whose source could not be removed is skipped.
4. If a port took it, rename the material `<object name>_Material`; otherwise
   delete the new shader.

Because the loop stops at the first success, only Surface is normally
connected.

### Explosion shader (S)

For each particle-family object: apply `$XSI_DSPRESETS\Shaders\Material\Phong.Preset`
with `SIApplyShader`; connect shader preset `Particle_ExplosionV2` to both
`material.Surface` and `material.Shadow` (one `SIApplyShaderToCnxPoint` call
with the two ports); connect `Particle_vol_ExplosionV2` to `material.Volume`;
remove all shaders from `material.Photon`. No inspection.

### Particle element / operator resolution (S), used by `InspectParticleSimulationOp`

An input that is an operator is used as is. A particle cloud object is
replaced by its active primitive; for a primitive of type `cloud`, the first
operator in its construction history of type `ParticlesOp`, `ExplosionOp` or
`FluidOp` is taken. Anything else contributes nothing.

## Wire contract

### `CreateParticleCloud`

Purpose: create a legacy particle cloud, either from a new built-in emitter or
from existing objects.

| Arg | Handler | Default | Dir |
|-----|---------|---------|-----|
| `InputObjs` | Collection (selection when omitted) | none | in |
| `Prim` | string | `""`; the four named menu entries pass `Sphere`, `Grid`, `Disc`, `Cube` | in |

Returns the collection of created particle clouds.

Steps, in order:

1. Always create a new billboard particle type (`CreateParticleType siBillboardType`),
   even when it ends up unused.
2. `Prim` is compared without case to `Sphere`, `Disc`, `Grid`, `Cube`.
   **Named primitive**: create it with `SIGetPrim(<Prim>, "PEmitter")`, convert
   to a polygon mesh (`SIConvert "MeshSurface"`), then set

   | Prim | Parameters set |
   |------|----------------|
   | Sphere | `sphere.radius` 1 |
   | Disc | `disc.innerradius` 0.01, `disc.outerradius` 1, `polymsh.geom.subdivv` 3 |
   | Grid | `grid.ulength` 1, `grid.vlength` 1, `polymsh.geom.subdivu` 1, `subdivv` 1 |
   | Cube | `cube.length` 1 |

   Make the emitter's display property local (node propagation) and set
   `wirecol` 33. Add an `Emission Property` named `<emitter>_emission`, set its
   `ParType` to the new type with `SetParticleType`. Apply operator `SparksOp`
   to the emitter (node level, persistent); the operator's output objects are
   the new clouds. `InputObjs` is ignored on this path.
3. **Any other `Prim`** (including empty): the inputs are the emitters.
   - Expand `InputObjs` (groups and branches flattened).
   - Keep the `geometry` members; drop those whose type is `cloud`. Each
     remaining object that has no local property found by the name
     `EmissionProp` gets an `Emission Property` named `<object>_emission` with
     `ParType` set to the new type. Objects that already have one are left
     alone.
   - Among the expanded inputs, the **first** object of type `cloud` whose
     active primitive history holds no `ParticlesOp`, `ExplosionOp` or
     `FluidOp` gets a `ParticleInitialStateProp` (node propagation) and becomes
     the initial-state input. Later clouds are ignored.
   - Apply `SparksOp` with a group-level connection set of six groups in this
     order: main (empty), emitters, obstacles (empty), forces (empty), initial
     state (0 or 1 cloud), particle types (empty).
4. Call `UpdateParticleTypeConnections` on each created cloud.
5. Apply the default particle renderer to the created clouds.
6. `AutoInspect` the operator list returned by `ApplyOp`.

Errors: none of its own. With no usable emitters the `SparksOp` application
receives empty groups; its outcome is the operator's (not specified here).

### `CreateFluid`

| Arg | Default | Dir |
|-----|---------|-----|
| `InputObjs` (a primitive name despite the argument name) | `Cube`, `Square` or `Disc` per menu entry | in |

Returns the created fluid cloud collection; nothing on the warning path.

1. Create a new blob particle type (`siBlobType`), before the argument check.
2. Case-insensitive match of the argument against `Cube`, `Square`, `Disc`.
   Otherwise log warning `Can only CreateFluid with Cube, Square or Disc emitters.`
   and stop (the particle type stays).
3. Create the primitive with `SIGetPrim(<name>, "FluidEmitter")`; **no** mesh
   conversion. Set `cube.length` 2, or `square.length` 2, or
   `disc.innerradius` 0.01 and `disc.outerradius` 1.
4. Display local, `wirecol` 33. Rotate the emitter to absolute local X = 90°
   (`Rotate … 90, 0, 0, siAbsolute, siLocal, siObj, siX`).
5. Add `Emission Property` `<emitter>_emission`; set its `Generation` to 4;
   set `ParType` to the new type.
6. Apply operator `HyperFlowOp` to the emitter (connect mode 3, persistent).
7. `UpdateParticleTypeConnections` on each resulting cloud, default particle
   renderer, `AutoInspect` the operator.

### `CreateExplosion`

| Arg | Default | Dir |
|-----|---------|-----|
| `InputObjs` (primitive name) | `Sphere` or `Cylinder` per menu entry | in |

Returns the explosion cloud collection; nothing on the warning path.

1. Match the argument without case. Otherwise log warning
   `Can only CreateExplosion with Sphere or Cylinder emitters.` and stop.
2. Create with `SIGetPrim(<name>, "ExplosionEmitter")`, convert to polygon
   mesh, set `visibility.rendvis` false, then `sphere.radius` 1 (Sphere) or
   `polymsh.geom.subdivv` 1 and `cylinder.height` 1 (Cylinder).
3. Lock `<emitter>.polymsh.geom` (`Lock` command, default lock level).
4. Display local, `wirecol` 33.
5. Create a point light with `SIGetPrimLight("Point.Preset", "ExplosionLight", <emitter>)`,
   i.e. parented under the emitter; copy the emitter's global position x, y, z
   onto the light's global position; make the light's display local and set
   `wirecol` 15.
6. Apply operator `BlowUpOp` (mode 3, persistent) to the pair
   `<light>.soft_light.color` and the emitter, in that order.
7. `UpdateParticleTypeConnections` on the operator.
8. Set the operator's `emittertype` to 0 for Sphere, 1 for Cylinder.
9. Apply the explosion shader set to the cloud, then `AutoInspect` the operator.

### `CreateInspectParticleTypeBillboard`, `CreateInspectParticleTypeSphere`, `CreateInspectParticleTypeBlob`

One argument `renderType` (in), registry default `siBillboardType`,
`siSphereType`, `siBlobType` respectively. No return value.

Calls `CreateParticleType <renderType>` and `AutoInspect`s the new particle
type. The three commands are the same procedure and differ only in the
default; a caller-supplied `renderType` overrides it.

### `CreateParticleSimulationFromFile`

| Arg | Default | Dir |
|-----|---------|-----|
| `FileName` | `""` | in |

1. With an empty `FileName`, show an open-file browser: title `Load Cache File`,
   initial directory `c:\`, empty base name, filter
   `PTP Files (*.ptp)|*.ptp|All Files (*.*)|*.*||`. A chosen path becomes the
   file name; cancelling leaves it empty.
2. With a non-empty name: apply operator `BlasterOp` with no inputs; on the
   created cloud set `cloud.blasterop.infilename` to the name and
   `cloud.blasterop.writeout` to false; apply the default particle renderer;
   `AutoInspect` the operator.
3. With an empty name nothing happens and nothing is logged.

No existence check on the file. The procedure hands nothing back although the
registry marks a return value.

### `InspectInitStateProp` (entry `InspectInitStateProp`)

Argument `InputObjs` (Collection handler, selection when omitted). Opens the
property editor on the initial-state properties tied to the given clouds.

For each input whose type is `cloud` (a cloud object, in which case its active
primitive is used and the literal line `got an 3dobject` is logged, or the
primitive itself):

- if the history has a `ParticlesOp`, take the first one and collect the
  target of every connected input port whose target type is `ParticleInitState`;
- otherwise collect the first local `ParticleInitState` property of the
  primitive's owning object, if any.

Then, unless user preference `ScriptingSessionActive` is true, call
`InspectObj` on the collection (default mode). Inputs of other types are
skipped silently. With an empty collection `InspectObj` is still called
*(its behaviour on an empty collection is the callee's)*.

### `InspectInitStateProp` (entry `InspectParticleSimulationOp`)

Same scripting name, second registry entry, description "Inspect the
associated particle simulation operator". Unless `ScriptingSessionActive` is
true: resolve each input to its particle operator (rule in Shared facts) and
call `InspectObj <operators>, "Operators"`. Which entry a script call by name
reaches is the registry's overload order (open question Q2).

### `AddParticleEvent`

| Arg | Dir | Meaning |
|-----|-----|---------|
| `Target` | in/out | particle types or obstacle properties that get the event; rewritten to the filtered targets |
| `Source` | in/out | declared, but the plain entry does not read the caller's value (see step 5) |
| `Output` | out | the created event(s), from `SIAddParticleEvent` |

Plain entry:

1. Work list = `Target`; if empty, the current selection.
2. Targets = work list through filter `Decay`.
3. If none, run the pick loop with filter `Decay` and prompt 1098.
4. Still none: log error
   `AddParticleEvent: At least a ptype or an obstacle object needs to be selected in order to add an event to it.`
   and fail with `siErrCancelled`.
5. Sources = (work list minus the targets) through filter `PType`; an empty
   collection when nothing passes. The `Source` argument's incoming value is
   not consulted.
6. Call `SIAddParticleEvent <targets>, <sources>, Output`.

UI entry: calls the plain command with its three arguments, then
`AutoInspect`s `Output`.

### `AddParticleGoal`

| Arg | Dir | Meaning |
|-----|-----|---------|
| `Target` | in/out | clouds or particle types |
| `InputObj` | in/out | goal objects |
| `Output` | out | created goals, from `SIAddParticleGoal` |

Plain entry:

1. Work list = `Target`, or the selection when empty. Targets = filter
   `CloudOrPType`; if none, pick loop with that filter and prompt 1099; still
   none → log error
   `AddParticleGoal: At least a cloud or ptype object needs to be selected in order to add a goal to it.`
   and fail with `siErrCancelled`.
2. Goal objects = `InputObj` through filter `Emitter` (the selection is **not**
   used as a fallback here); if none, pick loop with filter `Emitter` and
   prompt 1100; still none → log error
   `AddParticleGoal: At least a goal object needs to be selected in order to add goal to the particle simulation.`
   and fail with `siErrCancelled`.
3. Call `SIAddParticleGoal <targets>, <goal objects>, Output`. Both in/out
   arguments come back holding the filtered collections.

UI entry (Pick Goal): calls the plain command, then `AutoInspect`s `Output`.

### `AddParticleForce`

| Arg | Dir | Meaning |
|-----|-----|---------|
| `Target` | in/out | simulated objects (cloud, cloth, soft body, hair) |
| `InputObj` | in/out | force objects |

Plain entry:

1. Work list = `Target`, or the selection when empty; then `InputObj` is added
   and duplicates removed.
2. Forces = work list through filter `Force` (empty collection if none); they
   are removed from the work list. So a force found in `Target` or in the
   selection counts as a force.
3. Targets = remaining work list through the generic object filter; if none,
   pick loop with that filter and prompt 1101; still none → log error
   `AddParticleForce: At least a cloud, cloth or SoftBody object needs to be selected in order to add force to it.`
   and fail with `siErrCancelled`.
4. If there are no forces, pick loop with filter `Force` and prompt 1102. A
   cancelled pick leaves the empty collection, and the command goes on to step
   5 with it: the second error line
   (`AddParticleForce: At least a force object needs to be selected in order to add force to a simulation.`)
   exists in the script but is not reachable in practice *(inferred from the
   empty-collection fallback in step 2)*.
5. Call `SIAddParticleForce <targets>, <forces>`.

UI entry (Pick Force): calls the plain command, then `AutoInspect`s the forces.

Related helper in the same file, not a row of this batch: the force creation
path used by the "create force" commands calls `AddParticleForce <object>, <new force>`
for each input that is a particle cloud or whose history has a `SoftBodyOp`,
`ClothOp` or `hairDynamicsOp`, with errors suppressed.

### `EmitPointsFromObject`

Argument `InputObj` (Collection handler, selection when omitted). Returns the
new point cloud. Builds an ICE particle emission setup.

1. Emitters = input through the object filter plus the group filter. None →
   log error `No valid geometry selected for emission` and stop (no return
   value).
2. Create a point cloud primitive: `GetPrim "PointCloud", "PointCloud"`.
3. Create a simulated ICE tree on it (`CreateSimulatedICETree`); its first
   returned item is the tree's root node.
4. For each emitter, in input order: add a `GetDataNode` to the tree with its
   reference set to the emitter's full name. Classify by primitive type; for a
   group, the type of its first expanded member's active primitive.

   | Type | Compound | Wiring |
   |------|----------|--------|
   | `crvlist` | `Emit from Curve`, one shared node for all curve emitters | first curve: add the compound, insert a new port before the root's first input port and connect the compound's `emit` output to the root's first input port; later curves: add an emitter port after `Emitter1`. Then connect the data node's `value` to the compound's `emitter<N>` port, N counting curve emitters from 1 |
   | `surfmsh`, or active primitive `polymsh` | `Emit from Surface`, one shared node | same pattern with its own counter |
   | anything else | `Emit from Null`, a **new node per emitter** | new root port and `emit` connection each time; the data node's `outname` goes to the compound's `Null_Name` port |

5. Add one more port after the root's first input port, add a
   `SimulateParticlesNode` and connect its `simulate` output to the root's
   **last** input port.
6. Return the point cloud. No inspection, no selection change of its own.

Resulting execution order on the root: emission compounds, most recently
added first, then the simulate node last *(order inferred from "insert before
first port")*.

## Enable conditions and errors

No enable conditions in the registry. Script-raised failures are only the
`siErrCancelled` cases listed for the three `AddParticle…` commands; the
create commands log warnings and return nothing on a bad primitive name.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | Behaviour of the C++ commands called here (`SIAddParticleEvent`, `SIAddParticleGoal`, `SIAddParticleForce`, `CreateParticleType`, `SetParticleType`, `UpdateParticleTypeConnections`) and of operators `SparksOp`, `HyperFlowOp`, `BlowUpOp`, `BlasterOp` | separate rows; registration hunt in REA |
| Q2 | Which of the two `InspectInitStateProp` entries, and of the plain / UI entries of the three `AddParticle…` commands, a script call by name reaches | XSIBATCH golden, or the registry lookup order in the command core |
| Q3 | Are the legacy particle operators still creatable in 2015 SP2 (the legacy particle system was retired from the UI), or do the create commands fail at `ApplyOp`? | XSIBATCH golden: call `CreateParticleCloud , "Sphere"` and report the error or the cloud type |
| Q4 | Exact ids for prompts 1098 to 1101 (paired by order) | parse the dictionary records once TOOL-01 is fixed |
| Q5 | Default names of objects from `SIGetPrim(…, "PEmitter" / "FluidEmitter" / "ExplosionEmitter")` when the name is taken, and the names of the resulting clouds | golden |
