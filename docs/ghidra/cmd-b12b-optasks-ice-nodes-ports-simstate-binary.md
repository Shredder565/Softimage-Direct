# CMD-B12b: ICE node / port / attribute / comment / simulation-state commands read from `optasks.dll` (AddPortToICENode2, RemovePortFromICENode, AddNodeToICECompoundNode, RemoveNodeFromICECompoundNode, AddAttributeToSetDataICENode, RemoveAttributeFromSetDataICENode, SetPortType, CleanDisconnectedICENodes, CreateICENodeComment, SetICESimInitState, RemoveICESimInitState, TransferICETree)

Row: **CMD-B12b**. Status: **SPEC** (9 names), **SPEC-PARTIAL** (3 names); per command below (1 promoted in batch 13, see addendum).
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
Method: CLSID → factory → constructor → task vtable map built from `DllGetClassObject` (`0x180011e30`)
in this batch; Ghidra decompilation of the UnPackArg (slot 8), RePackArg (slot 9), Do (slot 5),
Undo / Redo (slots 6 / 7) methods and of the per-class worker (slot 15) where the Do method forwards
to it; `read_bytes` of task-vtable slots. Arguments and defaults from `data/command_registry.json`.
Message ids are `XSIOPTASKS` dictionary ids (texts not in the repo) or task error-handling ids.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | Constructor (alloc) | Task vtable | Do (slot 5) | UnPackArg (slot 8) | RePackArg (slot 9) |
|---|---|---|---|---|---|---|
| `AddPortToICENode2` | `443328d5-87ac-40f5-8f21-e5d8a6de4dd1` | `0x1800a2480` (0x190) | `0x1800efd70` | `0x1800a34b0` | `0x1800a3d60` | `0x1800a38d0` |
| `RemovePortFromICENode` | `87f7b094-2482-4112-883d-75574f5f3573` | `0x1800c15c0` (0x50) | `0x1800f43a0` | `0x1800bffd0` (no Ghidra function) | `0x1800c2310` | – |
| `AddNodeToICECompoundNode` | `84f10d5c-d904-4b8e-83f5-a24976d3f3d6` | `0x1800a1920` (0xe0) | `0x1800efaf0` | `0x1800a1dc0` → slot 15 `0x1800a1b80` | `0x1800a1fa0` | – |
| `RemoveNodeFromICECompoundNode` | `c83a610b-fc27-404f-9c07-1e3d3feada85` | `0x1800c0ab0` (0xe0) | `0x1800f4040` | `0x1800a1dc0` (shared) → slot 15 `0x1800c0d10` | `0x1800c1160` | – |
| `AddAttributeToSetDataICENode` | `80f29d44-c124-4eef-b261-1592123d61a3` | `0x180092700` (0xb0) | `0x1800ee250` | `0x180092b60` | `0x180092de0` | – |
| `RemoveAttributeFromSetDataICENode` | `b1b29707-e69c-47d0-b28d-e52ce4fc5970` | `0x1800bcb50` (0xd8) | `0x1800f36b0` | `0x1800bd0c0` (no Ghidra function) | `0x1800bd2d0` | – |
| `SetPortType` | `66803e82-0cdb-445a-af5d-128efaaf5dec` | `0x180005a30` (0xf8) | `0x1800d6f10` | `0x180006220` | `0x180006a70` | – |
| `CleanDisconnectedICENodes` | `6489ed18-8f26-4062-b1e0-726ba316a1f9` | `0x1800abc50` (0x50) | `0x1800f10d0` | `0x1800abff0` | `0x1800ac0f0` | – |
| `CreateICENodeComment` | `bfb82c5f-307b-40ea-b9fb-8f9a329c0288` | `0x1800b0a00` (0xa0) | `0x1800f1820` | `0x1800b0d60` → slot 15 `0x1800b0c00` | `0x1800b0f30` | `0x1800b0e90` |
| `SetICESimInitState` | `af2d7c8e-e256-4d35-98c5-aad158924d09` | `0x1800c4230` (0x60) | `0x1800f4960` | `0x1800c48c0` | `0x1800c4a40` | – |
| `RemoveICESimInitState` | `c12151b0-ff9a-4d5c-b485-9d9b337b0b65` | `0x180004230` (0x58) | `0x1800d6980` | `0x1800048c0` | `0x1800049e0` | – |
| `TransferICETree` | `3613f42b-4b81-4390-854c-fad9bb6c222e` | `0x1800bb5e0` (0x128) | `0x1800f34c0` | `0x1800bc3e0` | `0x1800bc9d0` | `0x1800bc690` |

Undo / Redo: slot 6 / 7 of each task vtable (see the TSV in the run's scratch map; e.g. `AddPortToICENode2` Undo `0x1800a3630`, Redo `0x1800a3540`; `RemoveNodeFromICECompoundNode` Undo `0x1800c1030`).

## 2. Shared facts

- **Graph-edit service.** Most Do methods are thin: they forward the unpacked arguments to a method of an
  ICE graph-edit interface held by the task (the interface at task offset `+0x38`), inside a
  "graph update bracket" (the ICE graph is re-evaluated once when the command ends). The actual edit lives
  in that service, outside `optasks.dll` (inferred: the ICE core). Undo replays the sub-tasks the service
  recorded (`UndoTasks` / `RedoTasks`); Undo and Redo fail with `0x8000FFFF` when the command ran without
  undo recording.
- **"First ICE graph element" filter.** Commands taking `InputObj` require a list (object kind 1) and walk it;
  for each item they ask for the ICE-node interface `9baa676e-420f-c3a0-f113-e291502f9a55` (in-memory order)
  and, failing that, the exposed-port/compound-port interface `c1fade8c-42d9-62f8-8e74-14b58cda8787`
  (used to reach the node that owns a port).
- **Error id `0x111`** (severity 2, raised with `0x80070057`) is the generic "invalid argument" of these
  tasks.
- **Data-type validation** (`siComponentDataType` value): must be exactly one bit set and inside mask
  `0xFCBFF` (bits 0–9, 11, 14–19 allowed; bit 10 = 0x400 and bits 12–13 rejected).
  `siComponentDataContext`: one bit inside `0x1F`. `siComponentDataStructure`: one bit inside `0x3`.

## 3. Contracts

### `AddPortToICENode2`: SPEC

Wire contract:
- Args: `Port` (ICE node port, required), `InsertLocation` (`siNodePortDataInsertionLocation`,
  default `siNodePortDataInsertionLocationBefore`), output `NewPorts`.
- Same task class as the older `AddPortToICENode`; the class reads the script name and behaves as
  `AddPortToICENode2` only when it is exactly that name.
- Do: asks the graph-edit service to add a port to the port group of `Port` (a new group instance
  inserted before / after `Port` according to `InsertLocation`), collecting the created ports.
- `AddPortToICENode2`: writes `NewPorts` as a collection of the created ports (an empty / null collection when
  none were created). `AddPortToICENode` (old name): returns the single created port as the command return
  value instead and does not fill `NewPorts`.
- Undo (`0x1800a3630`): undoes the recorded sub-tasks. When the add went through a compound's exposed
  port, undo removes the exposed port again through the same service (counts the group instances and
  removes the last one when the recorded index is −1).
- Errors: `Port` not an ICE port → argument failure from the resolver.

### `RemovePortFromICENode`: SPEC-PARTIAL

Wire contract:
- Args: `Port` (ICE node port, required). No return value.
- Removes the port's group instance from its node through the graph-edit service (inferred: Do `0x1800bffd0`
  has no Ghidra function; UnPackArg only reads `Port`). Inverse of `AddPortToICENode2`; connections on the
  removed instance are dropped (inferred).
- Missing: Do / Undo bodies (no Ghidra function at `0x1800bffd0`), error when the port is the last instance.

### `AddNodeToICECompoundNode`: SPEC

Wire contract:
- Args: `InputObj` (list of ICE nodes, required), `Compound` (ICE compound node, required). No return value.
- UnPackArg: resolves `Compound` to its nested ICE graph; a compound that is not editable (its "locked /
  read-only" query answers non-zero) is treated as missing. Fails `0x80004005` when there is no editable
  compound.
- Each `InputObj` item (or the node owning a given port) is kept only if it lives in the **same graph** as
  the compound; others are skipped silently.
- Do: for each kept node, moves it into the compound (shared mover `0x1800ac2b0` → per-node `0x1800ac210`,
  direction "into"). Connections that cross the compound boundary are kept through the compound's exposed
  ports (inferred from the mover's arguments: source graph, target graph, compound).
- Null node list or compound in Do → error `0x111`, `0x80070057`.
- Undo moves the nodes back out (same mover, direction "out").

### `RemoveNodeFromICECompoundNode`: SPEC

Wire contract:
- Args: `InputObj` (list of ICE nodes inside a compound, required). No return value.
- UnPackArg: the compound is the parent compound of the **first** item that has one; further items are kept
  only if they have the same parent compound. Fails `0x80004005` when no item is inside an editable compound.
- Do: moves the kept nodes out of the compound into the compound's parent graph (mover `0x1800ac2b0`,
  direction "out"); Undo (`0x1800c1030`) moves them back in.
- Null list / compound → `0x111`, `0x80070057`.

### `AddAttributeToSetDataICENode`: SPEC

Wire contract:
- Args: `SetDataNode` (ICE Set Data node), `AttributeName` (string, default ""), `AttributeType`
  (default `siComponentDataTypeFloat`), `AttributeContext` (default `siComponentDataContextComponent0D`),
  `AttributeStructure` (default `siComponentDataStructureSingle`).
- Validation, in this order, each logging an `XSIOPTASKS` message at severity 2 and failing `0x80070057`:
  Type not one bit in `0xFCBFF` → message `0x41C`; Context not one bit in `0x1F` → `0x41D`;
  Structure not one bit in `0x3` → `0x41E`. Then `AttributeName` is read.
- Do: asks the graph-edit service to add the attribute (name, type, context, structure) to the Set Data node
  (a new attribute entry and its input port). Undo through recorded sub-tasks.

### `RemoveAttributeFromSetDataICENode`: SPEC (promoted batch 13, see addendum)

Wire contract:
- Args: `SetDataNode`, `AttributeName` (string, default ""). No return value.
- Removes the named attribute entry (and its port) from the Set Data node through the graph-edit service
  (inferred: Do `0x1800bd0c0` has no Ghidra function).
- Missing: Do body, behaviour with an unknown name.

### `SetPortType`: SPEC

Wire contract:
- Args: `Port` (ICE port), `Type` (`siComponentDataType`, default `siComponentDataTypeFloat`).
- UnPackArg: `Type` must be one bit in `0xFCBFF`, else message `XSIOPTASKS 0x42E` (severity 2), `0x80070057`.
- Do, in order:
  1. Resolves the port's group / instance; if the port is a compound's exposed port it follows it to the inner
     node's port.
  2. The owning node must exist and be a node whose port type can be set: if the port is not found, or the
     port's node reports it is not editable, `0x80004005`.
  3. If the node is not a polymorphic-type node (its "type is defined" query answers non-zero), logs
     `XSIOPTASKS 0x42F` (severity 2) and returns `0x562E80C7` (a success-class code: nothing changed).
  4. Reads the port's allowed types (default "all": types `0xFFFFF`, structures `0x3F`); if the requested
     Type is not in the allowed mask, logs `XSIOPTASKS 0x430` and returns `0x562E80C7`.
  5. Builds the new port type record from the current one with type = `Type`; when `Type` has bit `0x10000`
     the structure field is set to "any" (−1), otherwise 0 (inferred meaning: bit 0x10000 is a reference /
     custom type).
  6. Saves the old record (for undo) and applies the new one (`0x180005e10`).
- Undo restores the saved record.

### `CleanDisconnectedICENodes`: SPEC

Wire contract:
- Args: `ICETree` (ICE tree operator, required). No return value.
- UnPackArg: the object must be an operator (kind ≠ 0), else `0x80070057`; takes its ICE graph (container 0).
- Do: asks the graph-edit service to delete every node of that graph that is not connected (directly or
  through other nodes) to the tree's root node (inferred meaning of "disconnected"). Undo / Redo via the
  recorded sub-tasks; Redo fails `0x8000FFFF` without undo recording.

### `CreateICENodeComment`: SPEC

Wire contract:
- Args: `InputObj` (list, first ICE node used), output `Value` = the new comment.
- UnPackArg: picks the first list item that is an ICE node; if that node already has a comment, raises
  `0x111` / `0x80070057`. No ICE node in the list → `0x8000FFFF`.
- Do (slot 15 `0x1800b0c00`): checks again that the node has no comment (`0x111` otherwise), creates the
  node's comment object; creation failure → `0x8000FFFF`. Records a reference to the comment for undo.
- RePackArg: returns the comment as the command value; `0x80004003` if none was created.
- Undo deletes the comment (inferred).

### `SetICESimInitState`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (input objects, default selection), `Time` (frames, default selection-flagged; converted
  to seconds with the scene frame rate before use).
- Do: passes the object list and the time to the simulation service, which stores the current simulated
  state of each object as its initial state at that time (inferred: ICE simulation "Set Initial State").
- Missing: the stored property (name / class), behaviour on non-simulated objects (service outside optasks).

### `RemoveICESimInitState`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (input objects). No return value.
- Do: passes the list to the simulation service, which removes the stored initial state (inverse of
  `SetICESimInitState`).
- Missing: same as `SetICESimInitState`.

### `TransferICETree`: SPEC

Wire contract:
- Args: `Operator` (ICE tree operator), `3DObject` (target object), `Mode` (integer, default 0), `Branch`
  (boolean, default false), output `Value`.
- UnPackArg: `Mode` must be an unsigned-integer variant (VT 0x17) with value 0 or 1, else `0x80070057`;
  `Branch` is converted to boolean.
- Do: asks the graph-edit service to move the ICE tree operator from its current object to `3DObject`
  (label "Move ICETree"); `Mode` 0 / 1 selects the construction region / placement (inferred: 0 = keep
  region, 1 = move to the target's region equivalent), `Branch` applies it to the branch of `3DObject`
  (inferred).
- Returns the operator (new reference) as `Value`.

## Open questions

1. `RemovePortFromICENode` and `RemoveAttributeFromSetDataICENode` Do methods have no Ghidra function
   (`0x1800bffd0`, `0x1800bd0c0`); read them with an explicit function at that address or by static analysis.
2. `TransferICETree` `Mode` 0 / 1 meaning and `Branch` semantics: in the ICE graph-edit service (not optasks).
3. `SetPortType` bit `0x10000` meaning; texts of `XSIOPTASKS 0x41C–0x41E`, `0x42E–0x430`.
4. `SetICESimInitState` / `RemoveICESimInitState`: the simulation-service side (stored property).
5. `CleanDisconnectedICENodes`: exact "disconnected" rule (root reachability is inferred).

## Addendum 2026-11-19 (batch 13): PR #185 answers

Run: si-analyst worker, REA + Ghidra 12.1.4 on the PC, same binary. No decompiler output reproduced.

**Correction to §2 "Graph-edit service".** For `TransferICETree`, `RemovePortFromICENode` and
`RemoveAttributeFromSetDataICENode` the object at task offset `+0x38` is **not** an outside ICE service:
it is a helper sub-object implemented in optasks.dll itself (its own vtable, set by the constructor),
and the Do method calls its slot 9 (`+0x48`). The helpers read this batch:
`TransferICETree` vtable `0x1800f3580` → slot 9 `0x1800bb8a0`; `RemovePortFromICENode` vtable
`0x1800f4460` → slot 9 `0x1800c1ba0`, slot 10 `0x1800c1d50`; `RemoveAttributeFromSetDataICENode`
vtable `0x1800f3770` → slot 9 `0x1800bcdf0`. The two "no Ghidra function" Do stubs are plain
forwarders: `0x1800bffd0` calls helper slot 9 with (stored object, undoable flag); `0x1800bd0c0`
calls it with (stored node, stored attribute name, undoable flag).

**Q6a `TransferICETree` `Mode` / `Branch`: ANSWERED.** Helper `0x1800bb8a0`, args (operator, target,
Mode, Branch, undoable). Every refusal below is a silent no-op (the command still succeeds):
1. Null operator or target, or the target is locked (any level): nothing.
2. The target resolves (interface query, IID at `0x1800d8678`) to an object named `Scene_Root`
   (case-insensitive), or that name cannot be read: nothing (inferred: the scene root cannot take an
   ICE tree).
3. The target's object-kind code must be 2 or 8; any other kind: nothing. Kind 8 **forces `Branch` on**.
4. The operator's construction mode (region) is looked up and is kept for the new connection.
5. **Mode 0 = move.** The operator's owner is lock-checked (locked: nothing); the operator's
   connections are disconnected from its current object and reconnected to the target, in the same
   construction mode, with `Branch` as the branch flag of the connection.
6. **Mode 1 = copy.** The operator is duplicated with the "Low Level Duplicate" task
   (`{747d257f-d01b-11d2-80c4-00a0c9ac19a9}`); the original stays connected to its first main owner
   (it is reconnected there at the port position recorded when it was detached); the **duplicate** is
   then connected to the target (same construction mode, `Branch` flag) and evaluated.
7. On failure after the duplicate was made, the duplicate is deleted with "Delete Objects"
   (`{dd531990-ccc2-11d2-ac73-00a02485cecb}`) and the original is reconnected to its original object.
8. **`Value`** (RePackArg `0x1800bc690`) is always the operator that was passed in, also in Mode 1
   (the copy is not returned).

**Q6b `SetPortType` bit `0x10000`: OPEN (inferred only).** Nothing in optasks names it. By the SDK
`siICENodeDataType` numbering it is most likely `siICENodeDataString` (inferred); `0xFCBFF` then
excludes Geometry `0x400`, Execute `0x1000` and Reference `0x2000` (inferred).

**Q5a `RemovePortFromICENode`: PARTLY ANSWERED.** Helper `0x1800c1ba0`:
1. If the port belongs to an ICE compound (compound interface `fbf83198-…`), the command removes it as
   an exposed port: it runs "Remove Exposed Parameter from a Compound"
   (`{bf8f591a-6c3e-417c-a2ff-25e6f765f374}`, i.e. `RemoveExposedParamFromICECompoundNode`'s class) on
   (port, compound) as a child task (recorded when undoable).
2. Otherwise it resolves the port's node and asks the node for the port's index and a side flag
   (`0x1800c1880`). When the flag is non-zero (inferred: an output port) it logs
   `XSIOPTASKS 0x417` (severity 2) and returns `0x80004005`. Else it converts the index to
   (group, instance) through the node's operator.
3. Removal (`0x1800c1d50`): for every port of that group instance that is connected and whose
   operator says it must be disconnected, a "Disconnect Node Port" child task
   (`{9821e356-5283-45f9-965b-dd69004cc0a5}`) runs; then an internal "remove port-group instance"
   child task (class `{e31d9ff9-584f-4001-99f8-658554a565e1}`, no command name) removes the instance.
   Child tasks are recorded for undo when undoable; a port whose node has no operator interface gives `0x80004003`.
4. **Last instance: still OPEN.** The command itself does not test the instance count; whether the last
   instance can be removed is decided inside the remove-instance child task, not read.

**Q5b `RemoveAttributeFromSetDataICENode` unknown name: ANSWERED.** Helper `0x1800bcdf0`:
1. Clears sub-tasks; null node → message `0x111` (severity 2), `0x80070057`. Inside a graph-update
   bracket; when undoable a soft reference to the node is stored (once).
2. The node looks up `AttributeName` (node slot `0x20`), returning found / has-connection flags, the
   attribute's port index and its saved state (kept on the task for undo).
3. **Unknown name** → warning `XSIOPTASKS 0x415` (severity 2); nothing changes and the command
   succeeds.
4. Found and connected → a "Disconnect Node Port" child task disconnects that port first (recorded
   when undoable), then the node removes the attribute entry (node slot `0x28`). Found and not
   connected → removed directly.

**Promoted SPEC-PARTIAL → SPEC:** `RemoveAttributeFromSetDataICENode`.
Still SPEC-PARTIAL: `RemovePortFromICENode` (last-instance rule), `SetICESimInitState`,
`RemoveICESimInitState`. `TransferICETree` stays SPEC with the Mode / Branch / Value rules above
replacing the `(inferred)` text.
