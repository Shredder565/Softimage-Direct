# CMD-B15c: particle (Sparks / legacy particles) commands read from `sparks.dll` and `forces.dll` (ConnectWeightMapToComponent, ConnectParticleInitState, DisconnectParticleInitState, SetParticleInitState, UpdateParticleTypeConnections, AddParticleEmitter, AddParticleObstacle, AddParticles, SetParticleType, CreateParticleType, SIAddParticleGoal, CreateEventSource, AddUserParameter, RemoveUserParameter, SIAddParticleEvent, SetEventObstacle, SIAddParticleForce)

Row: **CMD-B15c**. Status: **SPEC** (7 names), **SPEC-PARTIAL** (10 names), see the handler table.
`activedb.dll` does **not** implement `SIAddParticleEvent` / `SetEventObstacle` (both live in `sparks.dll`); the shared
shader CLSID `bbbbee29-…` is **not** in `sparks.dll` (see 2).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (image base `0x180000000` for all three):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\sparks.dll`,
  sha256 `2551961cde55fc899381fb8e41e7868b1e72b01751a8f0bb4ed06d05a82521d7`; `DllGetClassObject` `0x1800a8ef0`.
- `...\bin\activedb.dll`, sha256 `4769597538d12f33c6e8f8f296ca239a7da42614f6539a3a5ac135bfde3f645c`;
  `DllGetClassObject` `0x180001990`.
- `...\bin\forces.dll`, sha256 `6ac4e874ef63a2b6213c55abb69dd1781b7fe4b3bdddfe9aca131516760dd80c`;
  `DllGetClassObject` `0x180020ba0`.

Method: Ghidra decompilation of each `DllGetClassObject` to list the served CLSIDs; `read_bytes` of the final
factory vtables (slot 6 = create), task vtables (slot 5 Do, slot 8 UnPackArg) and worker vtables (object +0x38,
slot 9 and up); decompilation of create, constructors, UnPackArg, Do and workers. Four Do slots are register-only
forwarding stubs without a Ghidra function (`AddParticleEmitter`, `CreateParticleType`, `CreateEventSource`,
`SetEventObstacle`); they were decoded by hand from their bytes. GUIDs referenced by the code were read from
`.rdata` and matched against `data/command_registry.json`, `docs/re/COMMAND_DLL_MAP.md` and `data/spdl/spdl.json`.
Arguments and defaults from `data/commands_full.json` / `data/command_registry.json`. All statements are behaviour
read from the binary unless marked `(inferred)`.

## 1. Handler table

All in `sparks.dll` except the last row. "Do" for a stub is given as "stub → worker slot N (args)".

| Command | CLSID | Factory vtable | Create (slot 6) | Ctor (size) | Do (task slot 5) | Worker (slot 9) / per-item | UnPackArg (slot 8) | Status |
|---|---|---|---|---|---|---|---|---|
| `ConnectWeightMapToComponent` (both entries) | `6f83fddc-ae40-11d3-affb-0050da2873c1` | `0x18017c030` | `0x1800a7760` | `0x180145370` (0xb0) | `0x1801459f0` | `0x1801455a0` | `0x180145ca0` | SPEC-PARTIAL |
| `ConnectParticleInitState` | `d3b53df8-39b4-4c0c-b175-7a0daaa627be` | `0x18017c0a0` | `0x1800a76e0` | `0x1801446c0` (0x70) | `0x180144fd0` | `0x180144a00` → `0x180144c20` | `0x180145140` | SPEC |
| `DisconnectParticleInitState` | `12291e58-62b3-46f3-9980-22ef0a372fbc` | `0x18017c110` | `0x1800a77e0` | `0x180146da0` (0x60) | `0x1801472f0` | `0x180146f30` → `0x180147130` | `0x180147410` | SPEC |
| `SetParticleInitState` | `21bc9523-f52e-47a3-9595-85c859fd995d` | `0x18017c180` | `0x1800a7e60` | `0x1801492a0` (0x58) | `0x1801497c0` | `0x180149660` → `0x180149430` → `0x180149910` | `0x18014a510` | SPEC-PARTIAL |
| `UpdateParticleTypeConnections` | `4b5e7344-9b4d-4f34-bb1a-075a7a9886e0` | `0x18017c1f0` | `0x1800a8060` | `0x18014b530` (0xc0) | `0x18014d690` | `0x18014c070`, `0x18014c770`, `0x18014c290`, slots 12/13 | `0x18014d8b0` | SPEC-PARTIAL |
| `AddParticleEmitter` ("Add Particle Emitter" / "Pick Emitter") | `d9a016a1-451e-11d3-800a-00a0248f9397` | `0x18017be70` | `0x1800a71e0` | `0x18013ae20` (0xb0) | stub `0x18013bd60` → slot 9 | `0x18013b260` | `0x18013bee0` | SPEC |
| `AddParticleObstacle` ("Add Particle Obstacle Object" / "Pick Obstacle") | `e46afe32-48ff-11d3-8a87-00a024197c03` | `0x18017bf50` | `0x1800a72e0` | `0x18013e7d0` (0x68) | `0x180140410` | `0x180140250` → `0x18013eb80` | `0x180140580` | SPEC-PARTIAL |
| `AddParticles` | `4cb50c6f-4a51-46bc-a4db-b06c09b0f197` | `0x18017cab0` | `0x1800a73e0` | `0x180141680` (0x128) | `0x180142f50` | `0x180141a90` | `0x180143400` | SPEC-PARTIAL |
| `SetParticleType` (both entries) | `ba486ded-46ea-11d4-a961-00c04f8edeb9` | `0x18017cb58` | `0x1800a8920` | `0x18014a580` (0xb0) | `0x18014a780` (does the work) | – | `0x18014b0e0` | SPEC-PARTIAL |
| `CreateParticleType` (both entries) | `09bfd8e4-42fe-11d4-a961-00c04f8edeb9` | `0x18017ca40` | `0x1800a8520` | `0x180146110` (0x98) | stub `0x180146460` → slot 9 | `0x1801462c0` | `0x180146d50` | SPEC |
| `SIAddParticleGoal` | `1a41b159-1366-4511-84e6-80d7f751e728` | `0x18017cd18` | `0x1800a7260` | `0x18013d540` (0x68) | `0x18013e620` | `0x18013e450` → `0x18013e2a0` → `0x18013d6e0` | `0x18013e770` | SPEC-PARTIAL |
| `CreateEventSource` (both entries) | `68f37254-3a7d-4739-843d-05eaf66343cf` | `0x18017cae8` | `0x1800a84e0` | `0x18013c2a0` (0x98) | stub `0x18013d180` → slot 9 | `0x18013c780` | `0x18013d440` | SPEC-PARTIAL |
| `AddUserParameter` | `a289896c-c37f-40cf-b471-2b57b4f3fcb8` | `0x18017cbc8` | `0x1800a7460` | `0x180143b60` (0x70) | `0x1801440c0` | `0x180143d80` | `0x180144310` | SPEC |
| `RemoveUserParameter` | `e8b1490d-8471-4e7a-94ba-5295e1bb7980` | `0x18017cc38` | `0x1800a7de0` | `0x180147590` (0x88) | `0x180147bb0` | `0x180147810` | `0x180147e20` | SPEC |
| `SIAddParticleEvent` | `09bfd8e3-42fe-11d4-a961-00c04f8edeb9` | `0x18017ca08` | `0x1800a7360` | `0x1801405e0` (0x78) | `0x180141340` | `0x1801411f0` → `0x180140c10` | `0x180141610` | SPEC-PARTIAL |
| `SetEventObstacle` (both entries) | `266f48d4-8ddd-40ac-a3b0-99c2bbd841a0` | `0x18017cb20` | `0x1800a88a0` | `0x1801481b0` (0xa8) | stub `0x180148eb0` → slot 9 | `0x1801485e0` | `0x180149100` | SPEC-PARTIAL |
| `SIAddParticleForce` (`forces.dll`) | `4cfc0e50-e434-11d5-a281-00d0b7190223` | `0x1800302c8` | `0x18001fe70` | `0x180001000` (0x60) | `0x180001d00` | `0x180001b40` → `0x1800013b0` | `0x180001e90` | SPEC |

Task vtables (`sparks.dll`): Emitter `0x180182740`, Obstacle `0x180182dc0`, CWM `0x1801838b0`, ConnectInit
`0x180183690`, Disconnect `0x180183d40`, SetInit `0x180184340`, UPTC `0x1801848a0`, SIAddParticleEvent
`0x180183000`, AddParticles `0x1801831e0`, AddUserParameter `0x180183470`, RemoveUserParameter `0x180183f20`,
Goal `0x180182bd0`, CreateParticleType `0x180183a70`, CreateEventSource `0x180182980`, SetEventObstacle
`0x1801840d0`, SetParticleType `0x1801845e0`. `forces.dll`: `0x180024fb0` (worker vtable `0x180025020`).

## 2. Shared facts

- **Dispatch.** `sparks.dll` compares 37 CLSIDs inline. Besides the 16 commands above it serves `AddClothClusters`
  (`cfdc1390-…`) and object classes (particle type container `e0f12030-…`, particle type `4c038ff0-…`, cloud
  `a8435ec0-…`, Sparks op `3ee7b553-…`, HyperFlow op `71240cfd-…`, BlowUp op `c41aa2c3-…`, SoftBody op
  `976e6621-…`, Cloth op/prop, WM-connection op `c188cd38-…`, obstacle extension `58241ed3-…`, event source
  `1fc1c0d3-…`, goal property `c8408043-905c-420d-947b-68a9d6aeeaac`, event object `ccc6be79-406a-11d4-…`,
  `b0979de1-…`, `2c8b04f1-…` and a few unnamed ones). Final factory vtable = the second pointer stored in each
  branch (most branches overwrite the base factory vtable; `CreateParticleType`, `CreateEventSource`,
  `SetEventObstacle` and `SetParticleType` keep a single one).
- **Not in the `sparks.dll` chain:** `bbbbee29-9a74-46fc-8f43-bfebbabfd1bd` (`CreateShaderFromCLSID`,
  `CreateShaderFromProgID`, `CreateShadersFromMaterialPreset`, `AddShaderAttachedComment`, `CreateShaderFromPreset`).
  It is also absent from `shadertasks.dll` (batch 12). Remaining registry candidates: `molight.dll`,
  `shaderhelper.dll`, `xgs.dll`, `props.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll`.
- **`activedb.dll`** serves only four CLSIDs (`7bfe9f30-7363-11d2-88b5-00a024ee6238`,
  `b54dca74-e452-11d1-8873-00a024ee6238`, `531dfcf1-984a-11d1-8873-00a024ee6238`,
  `12a36560-3333-11d4-894d-00d0b71da41f`), no commands of this row. `SIAddParticleEvent` and `SetEventObstacle`
  are implemented in `sparks.dll` (above).
- **Object layouts.** Two shapes: (a) `CDSCOMObject` at 0, `C3DCoreBaseTask` (task vtable) at +0x18, worker vtable
  at +0x38 (most commands, and `forces.dll`); (b) `C3DCoreBaseTask` at 0, `CDSCOMObject` at +0x20, worker at +0x38
  (`CreateParticleType`, `CreateEventSource`, `SetEventObstacle`, `SetParticleType`). Do forwards to worker slot 9
  with the unpacked fields and the undo flag.
- **Undo flag.** Do's argument is the undo flag. Sub-tasks are added to the command's undo record (`AddTask`)
  only when the flag is set and the sub-task returned exactly S_OK.
- **Simulation-operator lookup** (used by most commands, "find sim op"): get the cloud's operator interface
  (`6de1b670-8072-11d5-aeed-0090275802c9`), enumerate operators (kinds 2, mask 0x1c, depth 4) and take the first
  whose class is Sparks op `3ee7b553-394f-11d3-8a80-00a024197c03`, HyperFlow op
  `71240cfd-8df9-11d3-ba02-08003639d903` or BlowUp op `c41aa2c3-b58a-11d4-a96f-00c04f8edeb9`. Not found →
  `0x80004005` raised with severity 2, message id `0x6f`. Some commands accept only the Sparks op (same error).
- **Interfaces used for classification:** cloud `a8435ec0-38ab-11d3-a1f7-00a0248f9567`, particle type
  `4c038ff6-3b9b-11d3-a1f7-00a0248f9567` (class `4c038ff0-…`), emission `b0979de2-3c90-11d3-a1f7-00a0248f9567`,
  event-holder `b0c5eb20-2d31-11d6-a288-00d0b7190223`, particle-type slot holder
  `ba486df3-46ea-11d4-a961-00c04f8edeb9`, generic scene object `473feb00-64ed-11d1-84c6-00a0243e3543`.
- **Sub-tasks / helper classes:** `SIAddProp` (`6fa26e30-…`), `SIGetPrim` (`29668d60-…`), `DeleteObj`
  (`dd531990-…`), `SetValue` (`c089b901-…`), `ApplyOperator` (`46cee370-…`), `SIApplyShader` (`41080962-…`),
  "connect to operator port group" helper `85ad2212-d8cb-11d2-ac75-00a02485cecb`, "disconnect from port group"
  helper `9c8384e4-da33-11d2-ac75-00a02485cecb`, and this DLL's own `UpdateParticleTypeConnections`,
  `ConnectParticleInitState`, `DisconnectParticleInitState`, `SIAddParticleEvent`, `CreateEventSource`,
  `CreateParticleType` (all created with `SICreateInstance` on their CLSIDs, i.e. in-process).
- Error texts are dictionary ids (`0x6f`, `0x126` in the sparks dictionary; `XSIFORCES` id `0x34`); the texts are
  not in the repo.

## 3. Contracts

### `ConnectWeightMapToComponent`: SPEC-PARTIAL

Registry: two entries, both CLSID `6f83fddc`: "Connect weight map to component" (`Target`, `PropObj`: object
lists) and "Pick Component" (`Target`, `PropObj`: strings, default `""`; picking UI entry). Same task.

Wire contract:
- UnPackArg: first item of `Target` → its component hierarchy (`4aeaeaea-…`), first sub-component. If it is a
  geometry primitive, the geometry is stored; if it is a 3D object, its primitive is used; if it is a cluster
  (`a244f0d0-…`), the cluster is stored and its parent geometry becomes the geometry. First item of `PropObj` is the
  weight map property; when no cluster came from `Target`, the weight map's parent cluster is used.
- Do (worker `0x1801455a0`): any of geometry / cluster / weight map / target missing → `0x80004003`.
  1. Create a weight-map connection operator (`C3DWMCnxOp`, class `c188cd38-95c7-11d3-afee-0050da2873c1`).
  2. Bidirectionally connect the op's output port 0 and output port 1 to the target's cnx points (two port
     connects).
  3. Run the port-group connect helper on the op, group 1, inputs `[geometry, cluster, weight map]`.
  4. With undo on, keep a reference to the new op for undo.
- Returns 0. Missing: exact port meaning of the two bidirectional connects.

### `ConnectParticleInitState`: SPEC

Wire contract:
- Args: `InputObj` (cloud or operator), `InitCloud` (cloud).
- UnPackArg: first item of `InputObj` that is a cloud → cloud; else the first generic scene object → "op" slot. Neither
  → `0x80004005` (msg `0x6f`). `InitCloud`: first cloud item; none → `0x80004005` (msg `0x6f`).
- Do: if an op was given, connect directly (step 2) on it; else find the sim op of the cloud (shared facts).
- Connect (`0x180144c20`): the op must be a **Sparks op** (else `0x80004005`, msg `0x6f`). Take the init cloud's 3D
  object, find its init-state property (class `4e2d2322-1ecf-4e89-9720-712682cdc323`, kind
  `26f5ea49-3a77-4c9b-9f5b-84a3c6f25018`); if absent, create it with `SIAddProp` (preset
  `1edf2c8b-ceab-40c1-bb3a-c77d7344d05b`, branch 2). Connect it to the op's port group **4** (one input, port
  group helper). Then run `UpdateParticleTypeConnections` on the op. Returns 0.

### `DisconnectParticleInitState`: SPEC

Wire contract:
- Args: `InputObj` (cloud or operator). UnPackArg as `ConnectParticleInitState` (no `InitCloud`).
- Do: op given → disconnect on it; else sim op of the cloud.
- Disconnect (`0x180147130`): op must be a Sparks op (else `0x80004005`, msg `0x6f`). Run the disconnect helper
  (`9c8384e4-…`) on the op, port group **4**, all inputs; then `UpdateParticleTypeConnections` on the op. Returns 0.

### `SetParticleInitState`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (list of clouds), `Overwrite` (ulong, default 0).
- UnPackArg: input list, `Overwrite`. Do: no input list → returns **1**. For each item that is a cloud: find its sim op
  and run the init-state capture (`0x180149910`). Returns 1 (S_FALSE) if no cloud was processed, else 0.
- Capture: op must be a Sparks op (else `0x80004005`, msg `0x6f`). If the op already has an init cloud on port group 4:
  - `Overwrite` = 0 and UI present: message box "This cloud already has an initial state. Do you wish to replace
    it?" (title "SOFTIMAGE® | XSI®", Yes/No/Cancel). Yes → mode 1, No → mode 2, Cancel → mode 3 (stop). Without UI,
    mode 1.
  - mode 1: delete the old init cloud's object (`DeleteObj`); mode 2: run `DisconnectParticleInitState` on the
    cloud; mode 3: return.
  - (Overwrite non-zero is used directly as the mode, inferred.)
- Then: name = `<cloud name>_InitState`; create a new cloud primitive with `SIGetPrim` (cloud class `a8435ec0`)
  under the cloud's parent; copy the current particles into it; set two parameters of its
  `11ebe302-a20c-11d0-8478-00a024c7919c` property (`d636f4d0-…` and `a9d242e0-…`, value false, via `SetValue`);
  add the init-state property (`SIAddProp` as in `ConnectParticleInitState`); then for every operator of the source
  cloud other than Sparks / HyperFlow / BlowUp, a delete is run on a new list (inferred: strip copied operators);
  finally run `ConnectParticleInitState` (cloud, new init cloud). Missing: exact parameter names of the two
  `SetValue` calls and the operator-stripping detail.

### `UpdateParticleTypeConnections`: SPEC-PARTIAL

(Previously unlocated: batch 12 found it absent from `optasks.dll`; it is in `sparks.dll`.)

Wire contract:
- Args: `InputObj`. UnPackArg classifies the **first** item it can: cloud → slot A; generic scene object (an op)
  → slot B; emission → slot C; particle type → slot D; obstacle-ext (`4e2e7820-3a0d-11d3-8a80-00a024197c03`) → slot
  E. None → `0x80004005` (msg `0x6f`).
- Do dispatch: op → worker slot 10 (`0x18014c770`); cloud → slot 9 (find sim op, then slot 10); emission → slot 11
  (`0x18014c290`); obstacle-ext → slot 13; particle type → slot 12.
- Op case (`0x18014c770`): for Sparks / HyperFlow ops: get the op's cloud, walk the global particle-type container
  (`eb2c6110-…`), compare with the types connected on port group 5, connect missing ones (port-group helper,
  undoable) and delete stale links (`DeleteObj`), creating per-type helper objects. Missing: exact per-type objects
  and the slot 11/12/13 paths.

### `AddParticleEmitter`: SPEC

Registry: "Add Particle Emitter" (`Target`, `InputObj`: object lists; `Interactive` bool, default true) and "Pick
Emitter" (`Target`, `InputObj` strings default `""`, `Interactive` default true). Same task.

Wire contract:
- UnPackArg: `InputObj` list; `Interactive`. `Target`: walk the items, keep the first whose 3D object carries a
  Sparks op or HyperFlow op. None → `0x80070057`.
- Do (stub → worker `0x18013b260` (cloud, InputObj, undo)): null → `0x80004003`.
  1. Find the cloud's sim op (Sparks / HyperFlow); for Sparks the connect group is 1 with 3 entries per emitter.
  2. For each input object (list expanded): if the op is HyperFlow, only Disc / Cube / Square primitives are
     accepted (others skipped). Look for an existing emission property (`39554071-3e28-11d3-a1f7-00a0248f9567`,
     `C3DEventSource`) on the object; if none, create one with `SIAddProp` from the "Emission Property" preset,
     named `<object name>_emission`. Add it to the emission list.
  3. Connect the emission list to the op (port-group helper, undoable).
  4. Run `UpdateParticleTypeConnections` on the op.
  5. If `Interactive` is true and new emission properties were created, run the "Auto Inspect" command
     (`10128926-0e2d-11d3-80db-00a0c9ac19a9`) with `InputObjs` = the new properties.
- Returns 0.

### `AddParticleObstacle`: SPEC-PARTIAL

Registry: "Add Particle Obstacle Object" (lists) and "Pick Obstacle" (strings, default `""`). Same task.

Wire contract:
- Args: `Target` (clouds / sim objects), `InputObj` (obstacle objects). UnPackArg stores both.
- Do: for each item of the expanded `Target`, per-target worker `0x18013eb80` (target, InputObj, undo):
  1. Find the target's op: Sparks / HyperFlow / BlowUp / SoftBody / Cloth / one further class
     (`4bd7a7ff-…`).
  2. For each input object: ensure an obstacle property (`C3DParObstacle`, `72e08841-4209-11d3-8a87-00a024197c03`)
     exists; if not, create one with `SIAddProp` (class `2c8b04f1-3e37-11d3-a1f7-00a0248f9567`) named
     `<object name>_obstacle`.
  3. Sparks op: for each particle type of the global container, create a particle event via `SIAddParticleEvent`
     (type, obstacle) and set the event's obstacle reference (inferred: one "on obstacle" event per type).
     Other ops: connect the obstacle list with the port-group helper.
  4. `UpdateParticleTypeConnections`.
- Missing: per-op port group numbers and the event-parameter values for the Sparks case.

### `AddParticles`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (cloud), `ParType` (particle type, single obj), `Positions` (flat array, 3 doubles per
  particle), `Velocities` (flat array or empty), `World Referential` (bool, default true); output `OutputObj`.
- UnPackArg: first cloud of `InputObj` (may be none); `ParType` if it is a particle type; `Positions` must be a
  non-empty array else `0x80070057`; `Velocities` empty → zero velocities, non-array → `0x80070057`; element count
  / 3 = particle count.
- Do (`0x180141a90`):
  1. No cloud: create one with `SIGetPrim` (cloud class) and apply the "Particle_Renderer" shader preset
     (`SIApplyShader`); the new cloud becomes `OutputObj`.
  2. No type: make sure the global type container has one (create with `CreateParticleType` if empty).
  3. Apply an "AddParticleOp" operator (`SILoadCmdPreset` "AddParticleOp" + `ApplyOperator`, op class
     `cd2cb634-ee52-47ed-81ae-ff1863a8b711`) on the cloud and connect it via the port-group helper.
  4. If `World Referential` is true, positions and velocities are transformed by the inverse of the cloud's global
     kinematics at the current time.
  5. Store the particles (positions, velocities, type) in the op.
- `OutputObj` is written only when a cloud was created. Missing: op parameter layout.

### `SetParticleType`: SPEC-PARTIAL

Registry: "Set a Particle Type" (lists) and "Set a particle type" (strings, default `""`). Same task.

Wire contract:
- UnPackArg: every `Target` item that exposes the type-slot holder interface (`ba486df3-…`, emitters / events) is
  collected; an item that is itself a particle type is resolved through its parent name (text before the last `.`)
  to the holder that owns it (inferred). `Source`: the last item that is a particle type.
- Do (`0x18014a780`): no source type → create one with `CreateParticleType` (undoable). For each holder: read its
  current type (kept for undo), set the source type, run `UpdateParticleTypeConnections` (holder). Returns 0.

### `CreateParticleType`: SPEC

Registry: "Create Particle Type" (`RenderType`, default `:siBillboardType:siParticleRenderType`; output `Output`) and
"Create a new particle type" (output only). Same task.

Wire contract:
- UnPackArg: `RenderType` (ulong) — the constructor default comes from a global.
- Do (stub → `0x1801462c0` (undo, no out list)): create a particle type object (class `4c038ff0-…`), add it to the
  global particle type container (`f16da200-13a2-11d3-b37a-00105a1e70de`, created if absent), apply the render type
  (task method, inferred), keep a reference for undo, write it to `Output`. Returns 0.

### `SIAddParticleGoal`: SPEC-PARTIAL

Wire contract:
- Args: `Target` (clouds or particle types), `InputObj` (goal objects); output `Output` (list).
- Do: create the output list; for each expanded target: cloud → each of its particle types; particle type → itself.
  For each (type, goal object): create a goal property (class `c8408043-905c-420d-947b-68a9d6aeeaac`) with
  `SIAddProp` named `<name>_goal`, add it to `Output`, set one of its parameters to **4** at the current time with
  `SetValue`, run `UpdateParticleTypeConnections`. Missing: which parameter is set to 4.

### `CreateEventSource`: SPEC-PARTIAL

Registry: two entries (list / string `Target`), both with output `Output`.

Wire contract:
- UnPackArg: `Target` must have at most one item (`0x8000ffff` otherwise); the item is stored.
- Do (stub → `0x18013c780` (target, undo, out)): the target must expose the event-holder interface.
  - Holder already has an emission source: return it in `Output`, return **1**.
  - Else create an event source (class `1fc1c0d3-00a3-4715-962f-a48fec99c71a`), attach it, name it
    `<holder name>_Emission`, give it the first particle type of the container, connect it to the holder's sim op
    (Sparks op: disconnect/reconnect on port group 6 via the helpers; others: port-group connect), run
    `UpdateParticleTypeConnections`. `Output` = new source. Returns 0.

### `AddUserParameter`: SPEC

Wire contract:
- Args: `Target` (types or clouds), `Name` (string, required), `Type` (ulong, default 0, must be < 7).
- UnPackArg: empty `Name`, `Type` ≥ 7, or empty `Target` → `0x80004005` (msg `0x6f`). Target items: particle types
  are taken; clouds contribute all their particle types. No type collected → `0x80004005`.
- Do (`0x180143d80`): for each type: add user parameter (`Name`, `Type`); then every cloud that uses the type is
  refreshed (two cloud calls, inferred: invalidate + re-evaluate). With undo on, list / name / type are kept for
  undo. Non-type item → `0x80004003`. Returns 0.

### `RemoveUserParameter`: SPEC

Wire contract:
- Args: `Target`, `Name`. UnPackArg identical to `AddUserParameter` without `Type`.
- Do (`0x180147810`): for each type: with undo on, remember the parameter's current type (default 7 if unknown);
  remove the parameter; refresh the clouds using the type. Returns **1** if any removal reported "not found", else 0.

### `SIAddParticleEvent`: SPEC-PARTIAL

Wire contract:
- Args: `Target`, `Source` (optional), output `Output`.
- Do: create the output list; for each target item run the per-target worker (`0x180140c10`); none succeeded →
  `0x80070057` raised (msg `0x126`). With undo on, `Output` is also stored for undo.
- Per target: create an event object (class `ccc6be79-406a-11d4-a961-00c04f8edeb9`), attach it to the target,
  create an event source (`CreateEventSource` sub-task), set the event's particle type slot (`ba486df3`), add the
  event to `Output`, run `UpdateParticleTypeConnections`. Missing: role of `Source` and event parameter values.

### `SetEventObstacle`: SPEC-PARTIAL

Registry: two entries, `Target` and `Source` lists.

Wire contract:
- UnPackArg: first item of `Target` and of `Source`; an empty list → `0x8000ffff`.
- Do (stub → `0x1801485e0` (target, source, undo)): ensure the source has an obstacle property
  (`<name>_obstacle`, as in `AddParticleObstacle`), connect it to the target event's op (port-group helper), run
  `UpdateParticleTypeConnections`.

### `SIAddParticleForce` (`forces.dll`): SPEC

Wire contract:
- Args: `Target` (clouds / simulated objects), `InputObj` (force objects). UnPackArg stores both.
- Do: for each expanded `Target` item (`0x1800013b0`, undo):
  1. Find its simulation op at the current time. Op class → port group / flag: Sparks, HyperFlow, Cloth → group
     3, flag 1; SoftBody → group 2, flag 1; BlowUp → group 4, flag 0; two further classes (`4bd7a800-…`,
     `a88e8631-42aa-11d6-…`) → group 4, flag 1. No op → nothing done, S_OK.
  2. For each expanded `InputObj` item with a force primitive (`4cfc0e42-e434-11d5-a281-00d0b7190223`; others
     skipped silently): if the force is already connected in that group, log a warning `"<force name>: " +
     XSIFORCES[0x34]` (severity 4) and skip; else connect it with the port-group helper (2 references, undoable).
- Returns 0.

## 4. Open questions

- `bbbbee29` shader-creation task: still unlocated (`sparks.dll` and `shadertasks.dll` excluded).
- `UpdateParticleTypeConnections` emission / type / obstacle-ext paths (slots 11–13) not decompiled.
- `SetParticleInitState` `SetValue` parameter names; `SIAddParticleGoal` parameter set to 4; port group meaning
  for `AddParticleObstacle` per op.
- Dictionary texts for sparks ids `0x6f`, `0x126` and `XSIFORCES` id `0x34`.
