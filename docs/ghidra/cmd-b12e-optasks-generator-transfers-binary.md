# CMD-B12e: generator inputs and transfers across generator operators, read from `optasks.dll` (GetGeneratorInputReadPosition, GetGeneratorInputReadPosition_UIOnly, ChangeGeneratorInputReadPosition, GetGeneratorInputsForDisposal, CopyAnimationAcrossGenerator, TransferShapeAnimationAcrossGenOp, TransferPropertiesAcrossGenOp, TransferClusterPropertiesAcrossGenOp, SIBasicTransferClusterPropertiesAcrossGenOp, SIBasicTransferClustersAcrossGenOp, PropertyTransfer, SITransferCenter)

Row: **CMD-B12e**. Status: **SPEC** (7 names), **SPEC-PARTIAL** (5 names); per command below.
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
Method: CLSID → factory → constructor → task vtable map built this run (`DllGetClassObject` at
`0x180011e30`); Ghidra decompilation of each class's perform slot (task vtable slot 5), argument
unpack (slot 8) and repack (slot 9) methods, the worker method each perform slot calls (slot 9 of the
class's inner worker vtable), and the constructors; `read_bytes` of vtables and of the CLSID / IID
constant tables at `0x1800d8058`–`0x1800d8278`, `0x1800d8868`–`0x1800d8a08`, `0x1800d7ea8`, `0x1800d8528`,
`0x1800d9028`. Sub-task CLSIDs were matched to command names through `data/command_registry.json`
(`handler_clsid`). Arguments and defaults come from `data/command_registry.json`.
Message ids are task error ids raised through the task's error handler; the dictionary is
`XSIOPTASKS` where the binary names it, texts not in the repo.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | Constructor | Perform (slot 5) | UnPackArg (slot 8) | Worker |
|---|---|---|---|---|---|
| `GetGeneratorInputReadPosition` | `49451678-ec7a-4537-a27e-38e5c13bfa10` | `0x1800602b0` | `0x180060980` | `0x180060a70` | `0x180060400` |
| `GetGeneratorInputReadPosition_UIOnly` | same class as above | | | | |
| `ChangeGeneratorInputReadPosition` | `f6d1643e-b6d2-4b98-b22a-96fe98fad39d` | `0x180051350` | `0x180052440` | `0x1800525b0` | `0x180051520` |
| `GetGeneratorInputsForDisposal` | `85759d87-aacb-4837-863b-b268035a3f7d` | `0x1800316d0` | `0x180031860` | `0x180031a90` | (in perform) |
| `CopyAnimationAcrossGenerator` | `4a2386fc-aac4-4b83-89a6-396bead3dac3` | `0x180056cd0` | `0x180059190` | `0x1800592e0` | `0x180057a50` |
| `TransferShapeAnimationAcrossGenOp` | `b261a1ba-ab27-4bd5-9bec-f17314245140` | `0x18006a6c0` | `0x18006ad80` | `0x18006aeb0` | `0x18006a820` |
| `TransferPropertiesAcrossGenOp` | `edca5404-3e79-4ede-b59a-d438b050c362` | `0x1800689a0` | `0x180069f20` | `0x18006a340` | `0x1800697b0` |
| `TransferClusterPropertiesAcrossGenOp` | `f00335b8-9ed0-4595-93f5-886e7f2aa73d` | `0x180066ce0` | `0x180067740` | `0x180068230` | `0x180067570` |
| `SIBasicTransferClusterPropertiesAcrossGenOp` | `7be54750-3839-464f-9d42-5e1822056f25` | `0x18004f9c0` | `0x180050190` | `0x180051220` | `0x18004fdd0` |
| `SIBasicTransferClustersAcrossGenOp` | `81f70f51-067c-42c9-8a7b-3db10ace0688` | `0x18004ed50` | `0x18004f690` | `0x18004f8a0` | `0x18004f0a0` |
| `PropertyTransfer` | `d5b91e0f-d65f-4ced-8cac-811e801f54e8` | `0x180002000` | `0x180003710` | `0x1800040c0` | `0x180003410` |
| `SITransferCenter` | `412f8ee4-c4e2-11d4-b863-009027bc6587` | `0x180065e10` | `0x1800664e0` | `0x180066c30` | `0x180065f70` |

Repack (slot 9) is only meaningful for `GetGeneratorInputReadPosition` (`0x180060a40`, writes
`ReadPosition`) and `ChangeGeneratorInputReadPosition` (`0x180052510`, writes back
`UnTransferShapesAndEnvelopes`).

## 2. Shared facts

- **Read positions.** A generator operator reads each input at a construction-mode level. The value
  space used by these commands is 0..3, equal to the `E3DConstructionMode` / `siConstructionMode`
  numbering (0 modeling, 1 shape modeling (primary shape), 2 animation, 3 secondary shape;
  names `(inferred)` from the SDK enum; the numbers are attested). Value **4** in an input argument
  means "the scene's current construction mode" (read through `F3DGetConstructionMode`).
- **Construction marker classes.** The read position of an input is identified by the class of the
  marker operator found above the input's primitive: class `9b82aced-9947-4fd0-87ae-4ac0a3d42bea` → 0,
  `b0a5373d-e8b3-4816-bc5a-a6a31e4b4158` → 1, `0d29533c-b095-48f8-88b9-bdf8419453e7` → 2,
  `dba00978-85be-4d94-aec5-422ecb4ee4bd` → 3 (top of stack). No marker found → 3.
- **Generator / object validation** (shared helpers used by the four `…AcrossGenOp` workers):
  `0x18004b920` checks that `Operator` is a generator operator whose output is `Object`
  `(inferred meaning)`; failure raises message **0x111**. `0x18004b990` checks that `Object` exposes the
  required geometry / cluster interface; failure raises **0x112**. `0x18004b2d0` finds the item to
  transfer among the operator's inputs; failure raises **0x113** (clusters), **0x114** (cluster
  properties), **0x115** (properties). Each is raised at severity 2 with `0x80070057` and the command
  returns `0x80070057`.
- **Prompts.** Two `XSIOPTASKS` messages are shown with a Yes / No / Cancel box (`MB_YESNOCANCEL`):
  id **0x409** (ChangeGeneratorInputReadPosition: remove shapes / envelopes that no longer apply?) and
  **0x40a** (CopyAnimationAcrossGenerator: transfer remaining shapes and envelopes?). Texts not in the
  repo; purposes `(inferred)` from the argument names.
- **Tri-state "ask" arguments** (`UnTransferShapesAndEnvelopes`, `TransferRemainingShapesAndEnvelopes`,
  default **2**): 0 = do it, 1 = do not, 2 = ask with the prompt above. Yes → behave as 0 and store 0
  back into the argument; No → behave as 1 and store 1; Cancel → stop and return the "cancelled"
  status `0x562E80C7`, nothing changed. (`ChangeGeneratorInputReadPosition` repacks the answer so a
  repeat / redo does not ask again.)
- **Sub-tasks.** These commands are compositions; sub-task CLSIDs in the binary map to:
  `3fb6dc14-…` MoveOperator, `dd531990-…` DeleteObj, `f6d1643e-…` ChangeGeneratorInputReadPosition,
  `f00335b8-…` TransferClusterPropertiesAcrossGenOp, `b261a1ba-…` TransferShapeAnimationAcrossGenOp,
  `3b019512-…` SITransferShapeAnimation, `46cee370-…` ApplyOperator. When the command runs with undo,
  each sub-task is added to the command's undo list; on failure already-run sub-tasks are undone.

## 3. Contracts

### `GetGeneratorInputReadPosition`: SPEC

Wire contract:
- Args: `Operator` (required; any operator / connection holder), output `ReadPosition` (ULONG).
- Default output 3. Builds the list of the operator's input connections and takes the **first**
  input's object. On that object's primitive it walks the construction history from the operator's
  connection downward: if it reaches the operator itself first the position stays 3; otherwise the
  first construction marker passed gives the position via the marker-class table in section 2.
- Returns S_OK; nothing changes in the scene; no undo.

### `GetGeneratorInputReadPosition_UIOnly`: SPEC

Same class and contract as `GetGeneratorInputReadPosition` (same CLSID). The registry only differs by
command flags (`8650754` vs `262146`: the UI-only variant is not journalled / not for scripts `(inferred)`).

### `ChangeGeneratorInputReadPosition`: SPEC

Wire contract:
- Args: `Operator` (required, generator operator), `ReadPosition` (required, 0..4, 4 = current
  construction mode, > 4 → `0x80070057`), `UnTransferShapesAndEnvelopes` (default 2, tri-state).
- Nothing happens if `Operator` is null or the resolved position > 3.
- If the operator exposes the generator interface: collects the shape items (when position ≥ 1) and,
  when position ≥ 2, also the envelope items currently transferred onto the generated object. If any
  exist, applies the tri-state rule (prompt 0x409); for "do it" each such item is deleted with a
  `DeleteObj` sub-task (delete flag `0x10`).
- Then, for each input connection of the operator: resolve the input object, make sure its
  construction markers exist (marker operators applied with mode 3), and move the operator's input
  connection with a `MoveOperator` sub-task: position 3 → to the top of the input's stack; positions
  0..2 → directly relative to that position's marker (move action 2). If a needed marker cannot be
  found that input is skipped.
- Errors: allocation `0x8007000E`; position > 4 `0x80070057`; Cancel returns `0x562E80C7`.

### `GetGeneratorInputsForDisposal`: SPEC

Wire contract:
- Args: `InputObjs` (required list; generator operators, or objects whose geometry is produced by a
  generator), `GenOpInputsDisposal` (`siGenOpInputsDisposalMode`), output `OutputObjs` (list).
- Empty `InputObjs` → `0x80070057`. An item that is not a generator operator is replaced by the
  generator operator found on its geometry at the current time; if none, `0x80070057`.
- `GenOpInputsDisposal` must be **1** (delete) or **2** (hide); any other value (including 0 = keep)
  → `0x80070057`. The value is only read when every item resolved.
- Perform: for each operator, ask it for its disposable inputs (delete mode: the inputs that may be
  deleted; hide mode: the inputs that may be hidden) and append them all to `OutputObjs`.
  The command itself deletes / hides nothing; no undo.

### `CopyAnimationAcrossGenerator`: SPEC-PARTIAL

Wire contract:
- Args: `Operator` (required, generator), `ReadPosition` (stored but not passed by the perform slot;
  see Missing), `TransferRemainingShapesAndEnvelopes` (default 2, tri-state, prompt **0x40a**),
  `Selection` (required list).
- Only acts when the generated object's construction history above the operator holds animation
  items that its inputs also hold (a query on the generator returns "something to move"); otherwise
  nothing happens.
- Steps, in order: (1) apply the tri-state rule; Cancel stops with `0x562E80C7`. (2) For each cluster
  property found on the inputs' animation region: a `TransferClusterPropertiesAcrossGenOp` sub-task
  onto the generated object. (3) For each input: a `TransferShapeAnimationAcrossGenOp` sub-task.
  (4) Finally a `ChangeGeneratorInputReadPosition` sub-task on the operator.
- Missing: the exact list filter of step 2 and which value step 4 passes as `ReadPosition`
  (the large worker `0x180057a50` was read only for its sub-task sequence).

### `TransferShapeAnimationAcrossGenOp`: SPEC

Wire contract:
- Args: `Operator` (required, generator), `Object` (required, the generated object).
- Null argument → `0x80004003`. Reads the operator's shape items (same list as section 2); none →
  returns **1** (S_FALSE), nothing changed.
- For each shape item: it must reference exactly one source, else `0x80004005`. The source shape key's
  owning cluster is found; keys whose primitive belongs to the operator's input are collected with
  their items.
- Then runs one **`SITransferShapeAnimation`** sub-task (CLSID `3b019512-…`, implemented outside
  optasks.dll) with: the generated object's primitive, the input primitive, the collected shape keys
  and their items. Same as `SITransferShapeAnimation` for that primitive pair `(inferred)`.

### `TransferPropertiesAcrossGenOp`: SPEC-PARTIAL

Wire contract:
- Args: `Operator`, `Object`, `PropertiesToTransfer` (list), `PropertyName` (default ""),
  `ShareProperty` (default true), `TransferClusterProperties` (default true), output `Value`.
- Validation errors 0x111 / 0x112 / 0x115 (section 2) → `0x80070057`.
- For each property of the list, classified by the transfer helper:
  kind 0 → `0x80004001` (not implemented); kind 1 (cluster property) → a
  `TransferClusterPropertiesAcrossGenOp` sub-task (registered for undo under the name
  "I3DTransferClusterPropertiesAcrossGenOpTask"); kind 2 (object property) → copied or shared onto
  `Object` (`ShareProperty`) and returned in `Value`; anything else → `0x8000FFFF`.
  `TransferClusterProperties` false excludes the cluster-property branch.
- Afterwards, material-category properties are rebound in a group named "Rebind tasks"
  (one rebind sub-task per transferred material).
- Missing: the property classification helper and the exact copy-vs-share step.

### `TransferClusterPropertiesAcrossGenOp`: SPEC-PARTIAL

Wire contract:
- Args: `Operator`, `Object`, `ClusterPropsToTransfer` (list), `ClusterPropertyName` (default ""),
  `RebindClusterProperties` (default true), output `Value`.
- Validation errors 0x111 / 0x112 / 0x114 → `0x80070057`.
- Order: (1) transfer the property's owning cluster onto `Object` (same as
  `SIBasicTransferClustersAcrossGenOp`, `(inferred)`); (2) transfer the cluster property onto that
  cluster (same as `SIBasicTransferClusterPropertiesAcrossGenOp`, `(inferred)`), returned in `Value`;
  (3) rebind step on the new property (uses `RebindClusterProperties`).
- Missing: helpers `0x180067380`, `0x180066ec0`, `0x1800677e0` were not read.

### `SIBasicTransferClustersAcrossGenOp`: SPEC

Wire contract:
- Args: `Operator`, `Object`, `ClustersToTransfer` (cluster), `ClusterName` (default ""), output `Value`.
- Null argument → `0x80004003`; validation 0x111 / 0x112 / 0x113 → `0x80070057`.
- Creates on `Object`'s primitive a new cluster of the source cluster's element type, named
  `ClusterName`, with the source's element count. If the target geometry type differs, the element
  type is switched between the two geometry-type GUIDs `3df7f9e2-89ee-11d0-a000-6499600e3f24` and
  `0534b0db-cb35-11d2-a000-f8b794363e24` (component type of one geometry kind ↔ the other,
  `(inferred)`).
- Links the new cluster to the source through the generator (link mode 0), registers it with the
  operator, and with undo marks it as created by this command. Returns the new cluster in `Value`.

### `SIBasicTransferClusterPropertiesAcrossGenOp`: SPEC-PARTIAL

Wire contract:
- Args: `Operator`, `Cluster` (target cluster on the generated object, may be empty),
  `ClusterPropsToTransfer` (cluster property), `ClusterPropertyName` (default ""), output `Value`.
- Null argument → `0x80004003`; validation 0x111 / 0x112 / 0x114 → `0x80070057`.
- If no target cluster is supplied, one is created (as `SIBasicTransferClustersAcrossGenOp`) and linked
  (mode 1). The property is then created on the target cluster with name `ClusterPropertyName` and
  its values transferred through the generator; returned in `Value` `(inferred)`.
- Missing: value-transfer helper `0x1800502e0`.

### `PropertyTransfer`: SPEC-PARTIAL

Wire contract ("Connect PropertyXferOp"):
- Args: `Target` (first item used), `PropObj` (first item used). Either list empty → `0x80070057`.
- At the current time, checks the pair, finds the property's owner on `Target` and requires it to be
  the expected owner; then creates the transfer operator through an **`ApplyOperator`** sub-task with
  operator preset `d46e5407-66fc-46b4-8fc4-aefd5f9f906f` (the PropertyXferOp class, `(inferred)`),
  connection mode 2, flag 4, after filling its input lists (four connection groups).
- Missing: the four group-filling helpers (`vtable +0x68…+0x80`) and the owner check.

### `SITransferCenter`: SPEC

Wire contract:
- Args: `InputObj` (input list), `X`, `Y`, `Z` (doubles, default 0).
- Null list → `0x80070057`. With undo, keeps a reference to the list.
- For each object at the current time: builds a transform whose translation is (X, Y, Z), scale 1,
  no rotation; applies it to the object's center (the kinematic local transform, all components,
  mask 0x7F) and applies the **inverse** to the object's geometry-side transform so that points stay
  in place. Net effect: the object's center moves by (X, Y, Z) in its local space and the geometry does
  not move in world space `(inferred wording; the inverse application is attested)`.
- A zero offset still runs (identity).

## Open questions

1. `CopyAnimationAcrossGenerator`: list filter of the cluster-property step and the read position
   passed to the final `ChangeGeneratorInputReadPosition`.
2. `TransferPropertiesAcrossGenOp`: property classification helper and share vs copy.
3. `TransferClusterPropertiesAcrossGenOp` / `SIBasicTransferClusterPropertiesAcrossGenOp`: value
   transfer and rebind helpers (`0x180067380`, `0x180066ec0`, `0x1800677e0`, `0x1800502e0`).
4. `PropertyTransfer`: operator connection groups.
5. Texts of `XSIOPTASKS` 0x409 / 0x40a and task messages 0x111–0x115.
6. `TransferAllPropertiesAcrossGenOp` (CMD-B6-CPP): its CLSID `e73d3b5a-354e-466b-b12b-e666f3a560f5`
   is present in optasks.dll's CLSID table (`0x1800d8218`) next to the transfer commands, so it is
   very likely implemented here; it was not in this row's list and was not read.

## Addendum 2026-11-19 (batch 13): PR #185 answers

Run: si-analyst worker, REA + Ghidra 12.1.4 on the PC, same binary. No decompiler output reproduced.

**Q23 `GetGeneratorInputsForDisposal` mode numbering: ANSWERED (contract unchanged).** UnPackArg
(`0x180031a90`) reads `GenOpInputsDisposal` from the variant's integer field (no variant-type check)
and maps it to an internal flag: **1 → 0** ("delete" set), **2 → 1** ("hide" set); any other value,
including 0, → `0x80070057`. This matches `siGenOpInputsDisposalMode` (0 keep, 1 delete, 2 hide).
Perform (`0x180031860`): internal flag 0 asks each generator (generator interface at `0x1800d8eb8`)
for its inputs through generator slot `0x20`, flag 1 through slot `0x18`, each into a fresh list that
is appended to `OutputObjs` in operator order. The value is read only after the whole input list
resolved (a failing item returns `0x80070057` before the mode is looked at).
No promotion in this row from this answer (`GetGeneratorInputsForDisposal` was already SPEC).
