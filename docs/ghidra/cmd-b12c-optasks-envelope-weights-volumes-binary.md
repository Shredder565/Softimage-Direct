# CMD-B12c: flexible envelope, weight maps, envelope locks / symmetry, cage deform, proportional volume and automatic UVs read from `optasks.dll` (SIApplyFlexEnv, SIApplyFlexEnvWithWeight, SILocalAssignFlexEnv, ResetFlexEnvPtsAssignment, SIModifyFlexEnvWght, SISymEnvWeight, LockEnvelopeWeights, ConnectWeightMap, AddMappingNode, SIApplyDeformByCage, InspectPropVolume, GetConnectedPropVolume, TogglePropVolume, GenerateAutomaticUVs)

Row: **CMD-B12c**. Status: **SPEC** (8 names), **SPEC-PARTIAL** (6 names); per command below.
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
Method: CLSID → factory → constructor → task vtable map built for the batch (`DllGetClassObject`
`0x180011e30`, inline CLSID compare chain, factory slot 6 creates the task); Ghidra decompilation of
the constructors, the Do / Undo / UnPackArg slots, the worker objects the Do slots call (slot 9 /
10 / 11 of a worker sub-object), the shared envelope-apply routine `0x1800717c0` and its per-object
step; `read_bytes` of worker vtables and of the GUID constants the code passes, matched against
`data/spdl/spdl.json` and `data/command_registry.json`; UTF-16 task description strings from
`.rdata`. Command arguments and defaults come from `data/command_registry.json`. Message ids are
error-handling ids of the task (dictionary `XSIOPTASKS` where the code names it; texts are not in the repo).
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Task vtable slots (as in the other task DLLs): 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg.
"Worker" = a sub-object of the task with its own vtable; the Do slot forwards the unpacked
arguments to one of its slots.

| Command(s) | Handler CLSID | Constructor (size), layout | Task vtable | Do → worker | UnPackArg | Task description string |
|---|---|---|---|---|---|---|
| `SIApplyFlexEnv` | `f8c8c073-acdc-11d2-99b7-00a0243f0e60` | `0x180074260` (0xd0), derived from envelope base `0x18006f880` (flag 1) | `0x1800ebcb0` | `0x180075c60` → worker `0x1800ebdb0` slot 10 `0x180075740` → `0x1800717c0`; per-object step slot 15 `0x180074980` | `0x180075f80` (base `0x180073f20`) | "Set Flexible Envelope Task" |
| `SIApplyFlexEnvWithWeight` | `2fd07801-c7cc-4292-a8ef-8f09bce70620` | `0x180076030` (0xf0), same base | `0x1800ebfd0` | `0x1800766e0` → same worker path | `0x180076870` | "Apply Envelope With Weight Task" |
| `SIApplyDeformByCage` | `6f378031-89b6-4216-a31c-3d84e01c927f` | `0x18006e870` (0xa8), envelope base (flag 0) | `0x1800eb180` | `0x18006f1a0` → worker `0x1800eb280` slot 9; per-object step slot 15 `0x18006e9b0` | `0x18006f3f0` (base) | "Set Deform By Cage" |
| `SILocalAssignFlexEnv`, `ResetFlexEnvPtsAssignment` | `56242c30-fdc4-11d2-99c2-00a0243f0e60` | `0x1800773e0` (0x68), CDSCOMObject + task at +0x18 | `0x1800ec3b0` | `0x18007a170` → worker `0x1800ec420` slot 9 `0x180078a70` | `0x18007b7b0` | "Assign Flexible Envelope Locally Task" |
| `SIModifyFlexEnvWght` | `61199760-1a84-11d3-99c3-00a0243f0e60` | `0x18007f110` (0x120), task + CDSCOMObject at +0x20 | `0x1800ece00` | `0x18007ffc0` → worker `0x1800ecec0` slot 9 `0x18007fe70` → its slot 10 `0x18007f550` | `0x180080360` | "Set Modify Weight Prop Values Task" |
| `SISymEnvWeight` | `d4a5193a-7b48-43e3-9372-b63e780d9f49` | `0x18008fdd0` (0x80), task + CDSCOMObject at +0x20 | `0x1800ee020` | `0x1800917e0` → worker `0x1800ee0e0` slot 9 `0x1800913c0` / 10 `0x1800915f0` / 11 `0x180091110` | `0x180091930` | "Apply EnvelopeWeight mapping to Symmetry points" |
| `LockEnvelopeWeights` | `ee4cc939-6415-48de-9245-33b1bcce8349` | `0x18007bbf0` (0x128), derived (`0x18007bae0`) | `0x1800eca30` | `0x18007d5a0` → worker `0x1800ecb20` slot 9 `0x18007ce90` | `0x18007ec50` | "Lock Envelope Weights Task" (+ sub-tasks "…of Deformers", "…of Vertices", "Clear All Envelope Weight Locks") |
| `ConnectWeightMap` | `31ca68f0-bd5c-11d2-99b8-00a0243f0e60` | `0x180054df0` (0x150), CDSCOMObject + CSIErrorHandling at +0x18 | `0x1800e7ac8` | worker `0x1800e7af0` slot 9 `0x1800553e0` | `0x180055100` | "Connect a Weight Map Task" |
| `AddMappingNode` | `e04fcc31-79d2-11d2-99ad-00a0243f0e60` | `0x18003ed10` (0x50) | `0x1800e5380` | worker `0x18003f140` | (task slot 8) | "Add a Mapping Node Task" |
| `InspectPropVolume` | `05af89a5-3b06-48af-a897-4204529e0828` | `0x180061080` (0x50) | `0x1800e97d0` | `0x1800611f0` (no worker) | shared `0x180061400` | "Inspect PropVolume Task" |
| `GetConnectedPropVolume` | `9230d7a9-5c92-491a-908e-e1f8bdf7b396` | `0x18005e520` (0x58) | `0x1800e8f00` | `0x18005e6b0` (no worker) | shared `0x180061400` | "Get Connected PropVolume Task" |
| `TogglePropVolume` | `e9bba0e0-4a7f-48f6-aade-95c94e0888f6` | `0x180061610` (0x58) | `0x1800e9ab0` | `0x180063950` (helpers `0x180061fb0`, `0x180063530`, `0x180063800`, `0x1800622d0`, `0x180064710`) | shared `0x180061400` | "Toggle PropVolume Task" |
| `GenerateAutomaticUVs` | `706986e9-06f3-4604-b7c3-5d0f396de0f3` | `0x18005dc60` (0x78) | `0x1800e8d60` | `0x18005e290` → worker `0x1800e8dd0` slot 9 `0x18005e110` | `0x18005e480` | "Generate Automatic UV Cluster Property" |

Note: `0x180061400`, `0x18005582c`, `0x1800559f8`, `0x18003eea0` are slot targets Ghidra has no
function for (adjustor thunks / unanalysed stubs); they were not needed for the contracts.

## 2. Shared facts

- **Class GUIDs used** (matched to `data/spdl/spdl.json`):
  envelope operator `c3denvelopop` `470cf890-d3aa-11d0-996c-00a0243f0e60`; envelope auto-assign
  operator `c3denvelopeautoassignop2` `6e89c9e1-065b-11d4-b49c-009027bc38d5` (the older
  `c3denvelopeautoassignop` `98c50e50-…` is present in the table but not chosen by these commands);
  cage deform operator `c3dcagedeformop` `f81175b0-001f-11d5-9ca8-00d0b719049e`; cage
  auto-assign operator `c3dcageautoassignop` `e17eb100-fd0a-11d4-9ca8-00d0b719049e`; weight map
  property `c3dweightprop` `84c402a0-807d-11d0-9962-00a0243f0e60`; weight maps mixer operator
  `C3DWeightMapsMixerOp` `e04fcc30-79d2-11d2-99ad-00a0243f0e60`; lock-envelope-weights operator
  `c3dlockenvelopeweightsop` `55f8fa6e-b829-443c-8477-1c4c71234b5a`; proportional volume operator
  `c3dpropvolumeop` (propset `proportionalvolume`) `3afc75c0-fbdf-47f9-b01d-0c61a3632c52`.
- **Command CLSIDs called as sub-tasks**: `CycleChecking` (`8fb755e3-…`, CMD-B12 sibling row),
  `GetConnectedPropVolume`, `InspectObj` (`f3c49aa1-db80-11d1-9172-00a0c9612e3a`),
  `SIAddToCluster` (`5f1f5165-8b90-11d2-a93c-00a024190119`), and an "add envelope deformers" task
  `a3293410-b294-11d3-99d6-009027bc6509` (not a registry command; inferred to be the
  "Add Flexible Envelope Deformer Task").
- **Cluster names** created by the deformer apply path: `EnvelopWeightCls` (envelope, spelt so),
  `CageWeightCls` (cage). `DeformBySpineWeightCls` exists in the same string block (spine deform,
  not in this row).
- **Notifications**: the envelope apply fires the property-change notification
  `SI3D_ENVELOPEWEIGHTPROP_CREATED` after all objects are processed; Undo of
  `SIApplyFlexEnv` / `SIApplyFlexEnvWithWeight` / `SIApplyDeformByCage` first fires
  `SI3D_ENVELOPEWEIGHTPROP_REMOVED`, then undoes the recorded sub-tasks.
- **Construction mode**: the envelope apply saves the ambient value `context.constructionmode`,
  sets it to the command's `ConstructionMode` argument for the duration of the apply (inferred:
  restored at the end, the restore is in the unread tail).
- **Return code 1**: "nothing to do" paths return S_FALSE (1), not an error.
- Message `0x29` (severity 4) = "no valid input" warning used by the envelope apply,
  `SILocalAssignFlexEnv` and `SISymEnvWeight`.
- Undo/Redo of the envelope family: Undo fails with `0x8000FFFF` when the task did not record
  sub-tasks (non-interactive record flag clear); Redo replays the recorded sub-tasks.

## 3. Contracts

### `SIApplyFlexEnv`: SPEC

Wire contract:
- Args: `ConnectionSet` (required; group 0 = deformable objects, group 1 = deformers), `Interactive`
  (bool, default false), `AssignNewDeformers` (bool, default false), `ConstructionMode` (default
  none → current), output `CreatedObj`.
- Purpose: apply a flexible envelope to every deformable object of the connection set, using the
  deformers of group 1.
- Steps:
  1. Set `context.constructionmode` to `ConstructionMode`.
  2. Count the valid deformable objects of group 0 (each tested by the task's per-object filter).
     If none: log message `0x29` (severity 4) and return 1, nothing changed.
  3. Create the `CreatedObj` output list(s).
  4. For each object, in connection-set order:
     - If the object has **no envelope yet**: create a point cluster named `EnvelopWeightCls`;
       apply `c3denvelopop` with the auto-assign operator `c3denvelopeautoassignop2` connected
       (the auto-assign operator is always used for this command); then apply initial weights
       (empty for this command, see `SIApplyFlexEnvWithWeight`). The new envelope operator goes
       into the `CreatedObj` list.
     - If the object **already has an envelope**: when points of that object are selected
       (sub-component selection whose geometry class matches the envelope cluster), they are
       added to the envelope cluster with `SIAddToCluster`; a selection of the wrong component
       type logs `XSIOPTASKS 0x428` followed by one of `0x429` / `0x42a` / `0x42b` / `0x42c`
       (by the selected component class) at severity 4 and is skipped. Then the "add envelope
       deformers" sub-task adds the group-1 deformers to the existing envelope, with
       `AssignNewDeformers` passed through (when true the new deformers get points assigned).
  5. Fire `SI3D_ENVELOPEWEIGHTPROP_CREATED`.
  6. When the task's "refresh after apply" flag is set (it is for both flexible envelope
     commands, not for cage): for every object in the current selection a parameter set task is
     run with a boolean true (inferred: forces the envelope display/refresh; target parameter
     GUID not resolved).
- Returns 1 (S_FALSE) for a non-interactive run that completed; HRESULT errors pass through.
- Undo: see 2.

### `SIApplyFlexEnvWithWeight`: SPEC

Wire contract:
- Args: `ConnectionSet`, `Interactive` (default false), `EnvelopeWeights` (array of numbers,
  VT_ARRAY|VT_VARIANT), `ConstructionMode`.
- Same as `SIApplyFlexEnv` with: `AssignNewDeformers` fixed to false, auto-assign fixed on,
  construction mode passed as `2` to the apply worker together with the stored mode
  (inferred: 2 = "secondary shape / modeling" not resolved; keep `ConstructionMode` as the
  ambient value), no `CreatedObj` output.
- `EnvelopeWeights` is read into the task and applied as the initial weight array of each new
  envelope (step 4, new-envelope branch) instead of the auto-assigned weights (inferred layout:
  per point, per deformer, as `EnvelopeWeightProp` element array).

### `SIApplyDeformByCage`: SPEC

Wire contract:
- Args: `ConnectionSet` (group 0 = objects to deform, group 1 = cage objects), `Interactive`
  (default false), `ConstructionMode`, output `CreatedObj`.
- Same driver as `SIApplyFlexEnv` (count / 0x29 / per-object / CREATED notification, no
  selection refresh step), with this per-object step:
  1. Create a point cluster `CageWeightCls`; apply `c3dcagedeformop` with `c3dcageautoassignop`.
  2. For every cage object in group 1, at the current time: look for an existing helper
     property of class `ce…d8d38` (GUID at `0x1800d8d38`, not resolved) on its primitive; if
     missing it is created by an "add property" sub-task (mode 2).
  3. Nine parameters (GUIDs at `0x1800d8bc8`, `…bd8`, `…c08`, `…c28`, `…c48`, `…c58`, `…c88`,
     `…c98`, `…ca8`) of that property are set by a helper (`0x18006f2d0`) (inferred: copy of the
     cage's rest state).
  4. A second property (class at `0x1800d8cf8`) on the cage, when present, gets parameter
     `0x1800d8b88` set to **false** through a parameter-set sub-task.
- Each sub-task is recorded for undo when the run is interactive.

### `SILocalAssignFlexEnv`: SPEC-PARTIAL

Wire contract:
- Args: `SubComp` (points, required), `ConnectionSet` (deformers), `Interactive` (default false),
  `NbDeformersPerPoint` (int, default 2).
- No `SubComp` → returns 1, nothing changed.
- Re-assigns the selected envelope points to the nearest deformers of the connection set, at
  most `NbDeformersPerPoint` deformers per point (worker `0x180078a70`).
- With no valid envelope under `SubComp`: message `0x29` (severity 4), return 1.
- Points whose envelope property is locked are skipped; their names are collected,
  comma-separated (`", "`), and reported once with message `0x1d0` (severity 4).
- Undo replays the recorded sub-tasks in reverse; Undo with nothing recorded fails
  `0x8000FFFF`.
- Missing: the distance / weighting rule inside the worker (deformer choice and weight falloff).

### `ResetFlexEnvPtsAssignment`: SPEC-PARTIAL

Wire contract:
- Same task class as `SILocalAssignFlexEnv` (same CLSID, same UnPackArg). Registry args:
  `SubComp`, `ConnectionSet` (optional here), `Interactive`, output `OutputObjs`.
- Behaviour = `SILocalAssignFlexEnv` with the default `NbDeformersPerPoint` (2) and the
  connection set taken from the envelope's own deformers when `ConnectionSet` is empty
  (inferred: the binary reads the same arguments; the difference comes from the registry
  argument defaults).
- Missing: how `OutputObjs` is filled (no write to it was found in this task class).

### `SIModifyFlexEnvWght`: SPEC-PARTIAL

Wire contract:
- Args: `PropObj` (envelope weight property, required), `Name` (deformer name, default ""),
  `SubComp` (points, required), `Mode` (default 0), `Value` (double, default 100.0), `Normalize`
  (bool, default true), output `OutputObj`.
- UnPackArg: `Name` is copied only when non-empty; `SubComp` must be a sub-component element
  (element type 7), otherwise `0x80070057`; the point index array is taken from it.
- Do: resolve `Name` to the deformer index through the property's deformer list (lookup by name),
  then set the weights of the listed points for that deformer according to `Mode` / `Value`, and
  renormalise the other deformers' weights of those points when `Normalize` is true. The modified
  property is returned in `OutputObj`.
- `PropObj` null → `0x80004003`.
- Missing: the numeric meaning of `Mode` (worker `0x18007f550` not read). Use SDK values
  (inferred): 0 = absolute, 1 = add, 2 = percentage of current.

### `SISymEnvWeight`: SPEC

Wire contract:
- Args: `PropObj` (envelope weight property, optional), `SubComp` (optional), `MappingTemplate`
  (optional), output `OutputObj`.
- UnPackArg:
  1. Walk the `SubComp` list: the first element that is a component (element type 6) or a
     sub-component (type 7) becomes the target, with that type. Otherwise the first element that
     has a cluster (interface `cdea6775-415b-11d0-a000-40aac4343e24`) becomes the target with
     type 4. Nothing found → no target.
  2. If `PropObj` is not given: from the target's primitive at the current time, get the
     envelope operator and its envelope weight property; if not found that way, scan the
     operator's inputs for the first one that is an envelope weight property. Not found →
     message `0x29` (severity 4).
  3. If `MappingTemplate` is not given: take the symmetry mapping template of the model that owns
     the first deformer of the envelope (or of the property's owner when the envelope has no
     deformer). Not found → message `0x29`.
- Do: with no property or no template → return 1. Otherwise, by target type: 6 → mirror the
  weights of the components (worker slot 11), 7 → of the sub-component points (slot 10), 2 or 4 →
  of the whole object / cluster (slot 9). Each copies the weights of each point to its symmetric
  point through the symmetry template's deformer mapping.

### `LockEnvelopeWeights`: SPEC

Wire contract:
- Args: `PropObj` (envelope weight property), `Points` (one index or an array of indices, each
  converted to unsigned 32-bit), `Deformers` (one index or an array, unsigned 32-bit), `Locked`
  (bool, default true), output `OutputObj`.
- Do:
  1. No `PropObj` → return 1.
  2. No points → return 1, nothing changed.
  3. When recording for undo: the previous lock state of these points / deformers is saved first.
  4. Find the `c3dlockenvelopeweightsop` operator already connected to the property; if none,
     apply one (connect mode 3) to the property and record the apply.
  5. On the operator, set the lock flag of every (point, deformer) pair to `Locked`.
  6. `OutputObj` = the lock operator.
- Undo restores the previous state through the same worker.
- Null point or deformer array pointer → `0x80004003`.

### `ConnectWeightMap`: SPEC

Wire contract:
- Args: `Operator` (required), `PropObj` (weight map, required).
- UnPackArg resolves `Operator` to its operator interface (`473feb00-64ed-11d1-84c6-00a0243e3543`)
  and passes it with `PropObj` to the worker.
- Worker:
  1. Find the operator's weight-map input port (port index A) and an optional second weight-map
     port (index B).
  2. Run `CycleChecking` on `PropObj` (cycle flag before).
  3. Connect `PropObj` to port A (connect mode 4). If port B exists and is not connected, connect
     `PropObj` to port B too.
  4. Run `CycleChecking` again. If the connection introduced a cycle (no cycle before, cycle
     after): disconnect again, log message `0x1e` (severity 4) and return `0x562e80c7` (the
     "cancelled" success code), nothing changed.
  5. When recording for undo, the operator, the property's primitive, its 3D object and its
     owner are stored by reference.
- `Operator` or `PropObj` null → `0x80004003`.

### `AddMappingNode`: SPEC-PARTIAL

Wire contract:
- Args: `Operator`, `PropObj`, outputs `MappingNodeProp`, `MapMixerOp`.
- Steps (worker `0x18003f140`):
  1. On the geometry of `PropObj`'s owner, at the current frame, create a point cluster covering
     all points.
  2. Apply a weight map (`c3dweightprop`) to that cluster (apply-op sub-task, mode 2) and rename
     the new property `MappingNode`. It is returned as `MappingNodeProp`.
  3. Apply a `C3DWeightMapsMixerOp` with inputs [new weight map, `PropObj`] (connect mode 4); it is
     returned as `MapMixerOp`.
  4. Connect the mixer output to `Operator`: when `Operator` is given, through the
     "connect weight map" path (same as `ConnectWeightMap`); otherwise through an element reference
     to the property's owner (inferred).
- Missing: which of the two connect paths is chosen by which argument (flag at task +0x30 is set
  when the third worker argument is zero; mapping to `Operator` presence inferred).

### `InspectPropVolume`: SPEC

Wire contract:
- Args: `InputObjs`.
- Runs `GetConnectedPropVolume` with `InputObjs` (its own exec context); if the result
  `OutputObjs` is non-empty, runs `InspectObj` on that list (keywords empty, title empty, modal
  flag 1 per the four arguments `list, 0, 0, 1`).
- Returns 1 on success (no undo entry), or the first failing HRESULT.

### `GetConnectedPropVolume`: SPEC

Wire contract:
- Args: `InputObjs`, output `OutputObjs`.
- For every input object that has a primitive with the deformable-geometry interface: walk the
  primitive's operator stack (all operators, flags `1, 2, 0x7fff`) and append every
  `c3dpropvolumeop` operator found to `OutputObjs`, in stack order.
- Returns 1 on success.

### `TogglePropVolume`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs`.
- For each input object that has the deformable-geometry interface:
  1. Read the object's boolean parameter id 2 (inferred: the "proportional volume" enable state
     shown on the object); the toggle direction is "off" when it is true, "on" otherwise.
  2. Find every `c3dpropvolumeop` in the operator stack; for each, get its first input's 3D object
     and (when switching off) collect it (`0x180061fb0`), then update the operator
     (`0x180063530`).
  3. If no proportional-volume operator was found and the direction is "on": create / initialise
     one ("Initialize PropVolume Task", `0x180063800`, `0x1800622d0`).
  4. Finish with `0x180064710` on the object (inferred: writes the new enable state).
- Undo replays recorded sub-tasks in reverse; nothing recorded → `0x8000FFFF`.
- Missing: the exact parameter written and the initialisation values.

### `GenerateAutomaticUVs`: SPEC-PARTIAL

Wire contract:
- Args: `Operator` (generator operator), `Object`, `ClusterPropertyName` (string, default ""),
  output `Value`.
- Validation: `Operator` / `Object` not matching (helper `0x18004b920`) → raise
  `0x80070057` with message `0x111` (severity 2); `Object` not a 3D object of the expected class →
  `0x80070057` with message `0x112`.
- If a UV cluster property named `ClusterPropertyName` already exists on the object: log message
  `0x162` (severity 4), return S_OK, nothing created, `Value` = the existing property (inferred).
- Otherwise create the cluster (`0x18005dfc0`) and the automatic UV cluster property from the
  generator (`0x18005ded0`), return it in `Value`.
- Null `Operator`, `Object` or output → `0x80004003`.
- Missing: how the UVs are computed (generator-side), and the default name when
  `ClusterPropertyName` is empty.

## Open questions

1. `SIApplyFlexEnvWithWeight`: exact layout of `EnvelopeWeights` and the meaning of the constant
   construction-mode value 2 passed to the apply worker.
2. `SIApplyDeformByCage`: names of the helper property class `0x1800d8d38` / `0x1800d8cf8` and the
   nine parameters copied (not in `data/spdl`).
3. Envelope selection-refresh step: the parameter GUID `0x1800d9088` set to true on selected items.
4. `SILocalAssignFlexEnv` assignment rule; `ResetFlexEnvPtsAssignment` `OutputObjs`.
5. `SIModifyFlexEnvWght` `Mode` values (worker `0x18007f550`).
6. `TogglePropVolume` parameter id 2 and initialisation values.
7. `GenerateAutomaticUVs` UV computation and default property name.
8. Message texts `XSIOPTASKS 0x428`–`0x42c`, `0x29`, `0x1d0`, `0x1e`, `0x111`, `0x112`, `0x162`.
