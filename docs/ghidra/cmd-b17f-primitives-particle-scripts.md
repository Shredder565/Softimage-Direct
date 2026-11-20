# CMD-B17f: preset-model / deformer primitive script commands (`primitives.vbs`) and simulation script commands (`particle.vbs`)

Row: **CMD-B17f**. Status: **SPEC** for 8 commands; `ApplyParticleShader` entries registered against
`GetParticleShaderProc` live in `uixsiscripts.vbs` (out of scope here).
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`). Sources read with REA raw-6502
`read_bytes`; procedures located with `search_bytes`, then their regions read.

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `primitives.vbs` | 36199 | `4131cd15` | partly (0x2d40–0x4e10, 0x5400–0x665c: the four target procedures) | 4 |
| `particle.vbs` | 44291 | `2b1925c2` | partly (0x1e00–0x3da4, 0x6e40–0x76d8: the four target procedures) | 4 |

Earlier contracts reused: `cmd-b8e-primtasks-prims-binary.md` (`SIGetPrimLattice`, `SIGetPrimVolumeDeform`, `SIGetPrim`),
`cmd-b17b-chains-model-scripts.md` (`ImportModel`), `cmd-03b-particle-scripts.md` / `cmd-b15c-particles.md`
(`AddParticleForce`, other particle.vbs commands).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `GetPresetModel` (27 entries) | primitives.vbs | `GetPresetModelProc` | SPEC |
| `GetPrimLattice` | primitives.vbs | `GetPrimLatticeProc` | SPEC |
| `GetPrimVolumeDeform` | primitives.vbs | `GetPrimVolumeDeformProc` | SPEC |
| `GetPrimWave` | primitives.vbs | `GetPrimWaveProc` | SPEC |
| `ApplySoftBody` | particle.vbs | `ApplySoftBodyProc` | SPEC |
| `ApplyCloth` | particle.vbs | `ApplyClothProc` | SPEC |
| `ApplyParticleShader` ("Apply Particle Shader" entry) | particle.vbs | `ApplyParticleShaderProc` | SPEC |
| `CreateForce` (10 entries) | particle.vbs | `CreateForceProc` | SPEC |

## 2. Wire contract, primitives.vbs (category Primitive)

### `GetPresetModel`
Args: `ModelName`, `Name`, `Parent`, `PsetName` (all str); return Value (the model). Shipped entries (ModelName / Name /
PsetName): `Man_Face`/`Man_Face`/`Face_Maker`, `Woman_Face`/`Woman_Face`/`Face_Maker`,
`Man_Character`/`Man_Character`/`Character.Character_Designer`, and with empty PsetName: Bull, Car, Fish, Horse,
Lizard, Male, Trex, `ManSkeleton_Basic`/`ManSkeletonBasic`, `ManSkeleton_Complete`, `Biped_Box_Generated`/`Biped_Box`,
`Biped_Skeleton_Generated`/`Biped_SI3DSkeleton`, `Biped_XSISkeleton_Generated`/`Biped_Skeleton`,
`Biped_Rig_Generated`/`Biped_Rig`, `Quadruped_Rig_Generated`/`Quadruped_Rig`, `Quadruped_Guide`,
`Quadruped_PropGuide`, `WomanSkeleton_Basic`, `WomanSkeleton_Complete`, `WomanSkeleton_Rig`, Man, Woman (Name = ModelName
unless shown).
1. Path = factory installation path (`InstallationPath(siFactoryPath)`, a trailing `/` added if missing) +
   `Data/XSI_SAMPLES/Models/<ModelName>.emdl` (forward slashes).
2. Save the user pref `siAutoInspect`, set it False, `ImportModel(<path>, <Parent>)`, take its `Value` output (the
   model), restore the pref.
3. If a model came back: `SetValue <model>.Name, <Name>`.
4. If PsetName is not empty: preset name = the part after the last `.` in PsetName (whole string if none); create a
   temporary null (`GetPrim "Null"`), `AddProp <preset name>, <null>`, delete the null (this only forces registration
   of the property's layout/spdl); then `InspectObj "<model>.<PsetName>", "General,CustomPSet"`.
5. Returns the model (Nothing if import failed).

### `GetPrimLattice`
Args: `PresetObj` (str, `Lattice`), `InputObjs` (selection), `Name`, `Parent` (str), out `PrimObj`; return Value.
1. Parent = Parent arg; if the input is not Nothing, filter it with `SIFilter(…, "geometry")`; exactly one result →
   that object becomes the parent.
2. `SIGetPrimLattice(preset, InputObjs, Name, parent, prim)` (see `cmd-b8e`); Nothing → return Nothing.
3. `SelectFilter siConditionalObjectFilter`; `SelectObj <lattice>`.
4. If a primitive was returned: `AutoInspect <lattice>, , , "General"`.
5. Out `PrimObj` = primitive; returns the lattice object.

### `GetPrimVolumeDeform`
Args: as lattice, preset default `SphereVolume`.
1. `SIGetPrimVolumeDeform(preset, InputObjs, Name, Parent, prim)`; Nothing → return Nothing. (No geometry-parent
   lookup here.)
2. `SelectFilter siConditionalObjectFilter`; `SelectObj <obj>`.
3. Inspect: the connected volume-deform operators (helper `GetConnectedPropVolume`, not read, (inferred) the
   VolumeDeform operators driven by the new object); non-empty → `AutoInspect <operators>`; else `AutoInspect <obj>, ,
   , "General"`.
4. Out `PrimObj` = primitive; returns the object.

### `GetPrimWave`
Args: `PresetObj` (str, f 0x10002, `{42FC2493-732F-11d2-AC52-00A02485CECB}` = Wave), `InputObjs`, `Name`, `Parent`,
out `Primitive`; return Value.
1. If input not Nothing: geometry filter; exactly one → it is the parent and the "single" flag is set; several → count
   kept.
2. `SIGetPrim(preset, Name, parent, 1)`; result `Value` = wave object, `Primitive` output = its primitive.
3. If a wave was created and geometry objects exist: for each geometry object `ApplyOp "Wave", "<obj>;<wave>"`.
   Single object: `Translate <wave>, 0, 0, 0`, `Rotate … 0, 0, 0`, `Scale … 1, 1, 1`, all siAbsolute / siLocal /
   siObj / siXYZ (the wave sits exactly on its parent). Several: position = average of `<obj>.kine.posx/posy/posz`
   over the objects, `Translate <wave>, avg…, siAbsolute, siLocal, siObj, siXYZ` (no rotate / scale).
4. `SelectFilter siConditionalObjectFilter`; `SelectObj <wave>`.
5. If the primitive is not Nothing and its type is not `null`: `AutoInspect <wave>, , , "General"`.
6. Returns the wave object.

## 3. Wire contract, particle.vbs (category Simulation unless noted)

### `ApplySoftBody`
Args: `InputObjs` (Collection, f 0x10042); return Value.
1. Return value starts as Nothing. Expand the input (`.Expand`: groups/branches flattened); empty → return.
2. `SIFilter(expanded, "DeformSimulation")`; Nothing → return.
3. For each filtered item: a `CollectionItem` (component) is resolved to its sub-component's `Parent3DObject`
   (no sub-component → return immediately); then the first `X3DObject` in its `PathItems` is taken; if that object's
   type is neither `polymsh` nor `surfmsh`, the item is removed from the list.
4. Empty list → return. Otherwise `ApplyOp("SoftBodyOp", list, siNode, siPersistentOperation)`; if operators came
   back: return them and `AutoInspect` them.

### `ApplyCloth`
Same as SoftBody, with one extra step inside the loop for kept polymsh/surfmsh objects: find `ClothProp` in the object's
`LocalProperties`; if missing, `SIAddProp "Cloth", <object>` (property returned through the out argument); then
`SetValue <clothprop>.Master, True`. Operator `ClothOp` (siNode, siPersistentOperation); return + `AutoInspect` as above.

### `ApplyParticleShader` (entry "Apply Particle Shader")
Args: `InputObjs` (Collection), `Material`, `Volume` (shader presets / collections), `Inspect` (bool, True; not used by
the procedure); return Value (collection of surface shaders).
1. Input not an object → return Nothing.
2. `SIFilter(input, "Particle", , siSearchFamilies)`; Nothing or count ≤ 0 → return Nothing.
3. For each particle cloud: `SIApplyShader "$XSI_DSPRESETS\Shaders\Material\Phong.Preset", <cloud>` (instantiates a
   material); surface shader = `SIApplyShaderToCnxPoint(<Material>, "<cloud>.material.Surface" and
   "<cloud>.material.Shadow")`; volume = `SIApplyShaderToCnxPoint(<Volume>, "<cloud>.material.Volume")`;
   `RemoveAllShadersFromCnxPoint "<cloud>.material.Photon"`; add the surface shader to the returned collection.
The preset-specific entries (Sparks / Explosion / Blob / Fluid shader) go through `GetParticleShaderProc` in
`uixsiscripts.vbs`.

### `CreateForce`
Args: `Name` (force preset: Gravity, Wind, Attractor, Vortex, Fan, Eddy, Drag, Turbulence, `ToricForce`), `InputObjs`
(selection, f 0x10042 on the Simulation entry); return Value (the force). The Primitive-category entries pass
InputObjs as an empty string.
1. `SIGetPrim(<Name>)` → force = its `Value`.
2. For each input object (errors ignored): if its type name is `ParticleCloud`, or its active primitive's
   construction history contains a `SoftBodyOp`, `ClothOp` or `hairDynamicsOp` operator:
   `AddParticleForce <obj>, <force>` (see `cmd-03b`). Other objects are skipped silently.
3. Default environment = active scene's `ActiveSimulationEnvironment`; if one exists:
   - no containers → `AddContainerToEnvironment <env>, "RigidBody", 1, "RigidBodies"`, then `"Constraint", 1,
     "Constraints"`, then `"Force", 1, "Forces"`; else if no `Forces` container → add only the Force one;
   - `AddToContainer "<env>.Forces", <force>`;
   - if the environment has no operators: by `Preferences.simulation.rbdengine` 0 → `ApplyOp "NXDynamicsOp", <env>`
     (PhysX), 1 → `ApplyOp "DynamicsOp", <env>` (ODE).
4. Returns the force; if not Nothing: `SelectObj <force>`, `AutoInspect <force>, , , "Simulation"`.

## 4. Open questions
- `GetPrimWave` with InputObjs Nothing leaves the filtered list unset (VBScript Empty, not Nothing), so the op loop may
  raise on an empty selection (inferred); XSI probably always passes a collection.
- `GetConnectedPropVolume` (primitives.vbs helper) was not read.

## 5. Corrections for the wire agent
- `ApplyParticleShader`'s `Inspect` argument is ignored by `ApplyParticleShaderProc`.
- `CreateForce` connects the force only to particle clouds and to objects carrying SoftBodyOp / ClothOp /
  hairDynamicsOp, and always adds it to the active simulation environment's `Forces` container (creating containers
  and the dynamics operator when missing).
