# CMD-B12d: operator inputs, connections and cycle check read from `optasks.dll` (SubstituteOpInput, AddInputToOperator, RemoveInputFromOperator, MoveOperator, UpdateConnectOnOp, GetConnectionSet, GetSurfaceFromCurvesConnectionSet, ConnectOperatorParameter, DisconnectOperatorParameter, ConnectBevelProfileCurve, DisconnectBevelProfileCurve, ConnectPlaneReferenceToSlicePolygonsOp, DisconnectPlaneReferenceFromSlicePolygonsOp, CreateGridAndConnectToSlicePolygonsOp, DisconnectFromSimulationOp, CycleChecking)

Row: **CMD-B12d**. Status: **SPEC** (12 names), **SPEC-PARTIAL** (4 names); per command below.
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\optasks.dll`, image base `0x180000000`,
sha256 `bd94e0d535c21eeedc7b827512d61e0ba4f328d37ea7ed26af43c1aa5bf5c61f`.
Method: CLSID → factory → constructor → task vtable map built by a sibling worker (`DllGetClassObject`
`0x180011e30`, inline CLSID compare chain, factory slot 6 creates the task). For each class: Ghidra
decompilation of the constructor, the Do slot (task-vtable slot 5), UnPackArg (slot 8) and the worker
method the Do slot forwards to; `read_bytes` of vtables where Do is a forwarding stub Ghidra has no
function for (decoded by hand). Arguments and defaults from `data/command_registry.json`.
Message ids are error-handling ids of the task (dictionary `XSIOPTASKS`; texts not in the repo).
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | Constructor | Do (slot 5) | Worker | UnPackArg |
|---|---|---|---|---|---|
| `SubstituteOpInput` / `AddInputToOperator` / `RemoveInputFromOperator` | `4b382841-216f-11d5-ad0a-0090275802bf` (shared) | `0x18005c660` | `0x18005ceb0` | add `0x18005c7f0`, remove `0x18005c9f0`, substitute `0x18005d540`, resolver `0x18005cac0`, pick `0x18005d0f0` | `0x18005d730` |
| `MoveOperator` | `3fb6dc14-739e-11d4-bdd0-00a0c9615daf` | `0x180031e30` | `0x180032d40` → slot 15 | `0x180032170`; refresh `0x180032bb0`; redo `0x180032dd0` | `0x1800334e0` |
| `UpdateConnectOnOp` | `9c8384e2-da33-11d2-ac75-00a02485cecb` | `0x180035510` | `0x1800356f0` | `0x180035650` → shared connect helper `0x180026970` (mode 3) | `0x180035b40` |
| `GetConnectionSet` / `GetSurfaceFromCurvesConnectionSet` | `825449e3-8706-11d2-8091-00a0c955b335` (shared) | `0x18001b4f0` | `0x180020090` | resolver `0x18001ffe0`, connect `0x18001c750`, set parser `0x1800215a0` | `0x180021240` |
| `ConnectOperatorParameter` | `6834c96b-0b64-412a-9f65-68d4939b172b` | `0x18002b9f0` | stub `0x18002bf10` (no Ghidra function) | `0x18002bb50` | `0x18002bfd0` |
| `DisconnectOperatorParameter` | `e1e79b2c-c035-41dd-ae0e-eadd3249c24b` | `0x18002efd0` | `0x1800bffd0` (stub) | `0x18002f120` | `0x18002f580` (not a Ghidra function) |
| `ConnectBevelProfileCurve` | `777f2102-a2e7-4721-b977-0030b1b2f6a9` | `0x180052d20` | `0x18005a9f0` (shared stub) | `0x180053020` | `0x1800533b0` |
| `DisconnectBevelProfileCurve` | `73849979-93e6-470e-8f61-2b3e2b54b247` | `0x18005bdf0` | `0x18005c3e0` (shared stub) | `0x18005c300` (shared) | `0x18005c070` |
| `ConnectPlaneReferenceToSlicePolygonsOp` | `53e49e93-b205-4c81-a553-4c82e36c92d9` | `0x1800535b0` | `0x180053eb0` | vtable `0x1800e75a0` slots 9 / 10 / 11 (not read) | `0x180054080` |
| `DisconnectPlaneReferenceFromSlicePolygonsOp` | `e85b7bc9-d0d0-4859-9fed-b975d3e1be4d` | `0x18005c160` | `0x18005c3e0` (shared stub) | `0x18005c300` (shared) | `0x18005c4d0` |
| `CreateGridAndConnectToSlicePolygonsOp` | `e22d0a9f-7e9e-474c-bd97-3bf58a796fe8` | `0x180059900` | `0x18005a9f0` (shared stub) | `0x180059ba0`; param setter `0x18005ab20` | `0x18005ac60` |
| `DisconnectFromSimulationOp` | `84854b58-b16a-4b4a-9c37-54483ff41aa1` | `0x18002fba0` | `0x180030bc0` | object path `0x180030640`, port path `0x1800308a0` | `0x180030d00` |
| `CycleChecking` | `8fb755e3-06e3-11d7-be20-00a0c9615daf` | `0x18002e250` | `0x18002eab0` | `0x18002e740` | `0x18002ecc0` |

## 2. Shared facts

- **Port-group sub-tasks.** Several commands do their editing through three generic task classes created
  with `SICreateInstance` and kept as undoable child tasks (added with `AddTask` only when the command is
  run with undo recording on):
  - *add port-group instance* (class at `0x1800d7fc8`): arguments operator, group index, instance index,
    an array of input element references (one per port of the group), count.
  - *remove port-group instance* (class at `0x1800d8008`): operator, group index, instance index.
  - *substitute port-group instance* (class at `0x1800d7ff8`): same arguments as *add*, replaces the
    inputs of an existing instance.
  - *disconnect ports* (class at `0x1800d8018`): operator, group, instance, list of port indices.
  These are the same sub-tasks the operator-input commands use, so the wire agent can implement one
  "port group instance" service and call it from all of them.
- **Slice Polygons operator class**: `{9932e72c-a0a5-410e-aaae-41fb8f1eed8a}`. The three slice commands
  reject any other operator class with `0x80070057`.
- **Reference-plane / grid source class**: `{3df7f9e2-89ee-11d0-9964-00a0243f0e60}` (a grid / plane
  primitive class, inferred from the context).
- **Target lists.** The bevel / slice commands take `Target` / `Source` as a list and use only the first
  element. An empty list gives `0x80070057`.
- **Interactive pick result** `0x562e80c7` means "argument still to be picked"; it is passed through
  unchanged.

## 3. Contracts

### `AddInputToOperator`, `RemoveInputFromOperator`, `SubstituteOpInput`: SPEC

One task class. The command is selected by the registry default of `Type`: **1 = add,
2 = remove, 3 = substitute** (`AddInputToOperator` Type 1, `RemoveInputFromOperator` Type 2,
`SubstituteOpInput` Type 3).

Wire contract:
- Args: `Reference` (an existing input connection of an operator: the port / the connected object),
  `New` (the object to connect; not used by remove), `Type` (16-bit).
- Resolving `Reference`: it is first treated as a port; if it is not a port it is treated as an element
  whose owning object's operators are scanned for the port connected to it. Result: operator,
  group index, group-instance index, number of ports in the group. All three indices start as `0xffff`.
  For Type 3 the port lookup uses a different interface; if the first lookup fails and Type is not 3 a
  second interface is tried.
- Failure to resolve raises message **0x7b** (add), **0x7c** (remove), **0x7d** (substitute), or **0x6f**
  for any other Type, and the command returns `0x80004005`. An unknown Type returns `0x80004005`.
- Add (Type 1): when `New` is missing, an interactive pick session starts with prompt `XSIOPTASKS`
  **0x3fa**; picking an element of kind 7 (a sub-component) is refused with message 0x6f. Then a new
  instance of the same port group is inserted **after** the referenced instance (instance + 1), every port
  of the new instance connected to `New`.
- Remove (Type 2): removes the referenced group instance.
- Substitute (Type 3): same pick rule as add; replaces the inputs of the referenced instance (same index)
  with `New` for every port of the group.
- `New` absent at Do time without a pick, or no operator: `0x80004003`.
- Undo: the child sub-task is recorded (see 2).

### `MoveOperator`: SPEC

Wire contract:
- Args: `Object`, `OperatorToMove`, `MoveAction` (default 0), `OperatorReference`, `MoveDirection`
  (default 0).
- UnPackArg: `MoveAction` > 2 or `MoveDirection` > 2 fail with `0x80070057`. `OperatorReference` is read
  only when `MoveAction` ≠ 0.
- **MoveAction**: 0 = move relative to the top of the object's stack (the reference is taken as the
  current top operator, then handled like 2), 1 = move relative to `OperatorReference` with the
  "before" flag set, 2 = move relative to `OperatorReference` without it. **MoveDirection** is an
  `E3DMoveDirection` value 0..2 passed through to the move (its names are not in the DLL; inferred
  0 = up, 1 = down, 2 = none).
- Steps:
  1. Null `Object` / `OperatorToMove`, or MoveAction ≠ 0 with no reference: nothing happens.
  2. If any operator in the object's stack that equals `OperatorToMove` is locked (any lock level), stop
     silently.
  3. Marker operators are applied first (`F3DApplyMarkerOperators`, mode 3).
  4. MoveAction 0: each output of the operator that depends on an operator above it logs `XSIOPTASKS`
     **0x407** at severity 2 and stops.
  5. MoveAction 2: a reference operator of class `{dba00978-be85-4d94-ae52-c52e2e4ee4be}` (inferred
     construction-mode marker) logs 0x407 and stops; a reference of class
     `{4ed3b713-1abd-11d4-b8a3-659a6f8bbcfd}` (inferred) also stops, silently.
  6. The operator's port connections are moved (`F3DMovePortConnections`).
  7. Result 1 (nothing to move): log message **0x5f** at severity 4.
  8. Success: every operator of the object is told to re-evaluate (graph refresh), and an undo record
     stores action, direction and soft references to the operator, the reference and the new neighbour.
- Errors from the move: `0x80070005` → message **0x5c**, `0x8000000A` → **0x5d**, `0x80004001` → **0x5e**,
  `0x80070057` → **0x60** (all severity 2).

### `UpdateConnectOnOp`: SPEC-PARTIAL

Wire contract:
- Args: `Operator` (required), `GroupIndex` (0), `GroupInstanceIndex` (0), `InputObjs` (required),
  `AlreadyRefined` (false), `ForceDisconnect` (false).
- Missing `InputObjs` → `0x80004005`. The input list is split into its elements and their count.
- Do calls the shared operator-connect helper (`0x180026970`) in **mode 3** ("update existing connection")
  with operator, group, instance, the input list, `AlreadyRefined` and `ForceDisconnect`. Null operator or
  list → `0x80004003`.
- Missing: the helper itself (shared with other connect tasks of this DLL, base class `0x180025930`) was
  not read; what mode 3 changes compared with a fresh connect is unread.

### `GetConnectionSet`, `GetSurfaceFromCurvesConnectionSet`: SPEC-PARTIAL

One task class.

Wire contract:
- Args: `PresetObj` (operator preset), `ConnectionSet` (string), `CnxGroupType` (`siGroupLevel`,
  stored as 16-bit), `ConnectType` (`siBranchFlag`), `Interactive` (false), `CreateOutputObjs`
  (false; true for the surface variant), output `OutputObjs`, return `Value`; the surface variant also
  has `Target`.
- UnPackArg: `ConnectionSet` is parsed into a connection-set structure for the given group type
  (parser `0x1800215a0`). `Interactive` and `CreateOutputObjs` are converted to boolean. When
  `CreateOutputObjs` is true, `Target` (if given) selects the preferred output geometry type
  (`F3DSetPreferredGeometry`); without `Target` a built-in default type is used.
- Do: inside a graph-update bracket, builds a connection resolver for the preset; no resolver →
  `0x80004005`. Then resolves / picks the inputs (interactively when `Interactive`), optionally creates
  output objects, and fills `OutputObjs` / `Value`. Errors are raised as task errors.
- Missing: the connection-set string grammar and the resolver / connect routines (`0x18001ffe0`,
  `0x18001c750`) were not read.

### `ConnectOperatorParameter`: SPEC

Wire contract:
- Args: `Parameter` (a parameter of an operator), `ProjObj` (object to connect).
- Null argument → `0x80004003`. The parameter's owner must be an operator, otherwise `0x80004002`.
- The operator is asked which port group / instance / ports drive this parameter; a *connect ports*
  child task connects `ProjObj` to each of those ports, then the operator is told to connect the
  parameter on delta (`F3DConnectOperatorParameterOnDelta`) with `ProjObj`.
- Undo: the child task.

### `DisconnectOperatorParameter`: SPEC

Wire contract:
- Args: `Parameter`.
- Null → `0x80004003`. If the parameter is locked (lock level 1) the lock error is raised and the command
  returns `0x80070005`. Owner not an operator → `0x80004002`.
- The ports driving the parameter are looked up as above. If the port group is not a dynamic group
  (flag 0), the *disconnect ports* child task disconnects the ports that are currently connected. If the
  group is dynamic, the *remove port-group instance* child task removes the whole instance.

### `ConnectBevelProfileCurve`: SPEC

Wire contract:
- Args: `Target` (list; first element is the bevel operator), `Source` (list; first element is an object
  with a curve geometry).
- Empty list → `0x80070057`.
- Steps: if the operator's port group 1 already has an instance, remove instance 0 of group 1; then add
  an instance of group 1 at index 0 connected to the source curve. Both as child tasks.

### `DisconnectBevelProfileCurve`: SPEC

Wire contract:
- Args: `Target` (list; first element = operator). Empty → `0x80070057`.
- Removes instance 0 of port group 1 (same worker as `DisconnectPlaneReferenceFromSlicePolygonsOp`).
  No operator → `0x80004003`.

### `ConnectPlaneReferenceToSlicePolygonsOp`: SPEC

Wire contract:
- Args: `Target` (list; first element must be a Slice Polygons operator), `Source` (list; first element).
- Target empty or not a Slice Polygons operator → `0x80070057`.
- Source accepted forms:
  - an object of the grid / plane class `{3df7f9e2-…}` → connect the object;
  - a sub-element (element kind 7) whose owner is of that class → connect that sub-component;
  - element kind 2 (an object) with no plane interface → connect the source element.
  Anything else → `0x80070057`.
- The three forms call three connect variants of the task (vtable slots 9 / 10 / 11 at `0x1800e75a0`).
  Like the bevel connect, they replace the operator's plane-reference input (inferred).

### `DisconnectPlaneReferenceFromSlicePolygonsOp`: SPEC

Wire contract:
- Args: `Target` (list; first element must be a Slice Polygons operator, else `0x80070057`).
- Removes instance 0 of port group 1 (shared disconnect worker).

### `CreateGridAndConnectToSlicePolygonsOp`: SPEC

Wire contract:
- Args: `Target` (list; first element must be a Slice Polygons operator), output `Value`.
- The sliced object is the operator's owner.
- Steps:
  1. Create a grid primitive (create-primitive child task); the new grid is returned as `Value`.
  2. Read the operator's slicing plane at the current time and transform it to world space with the
     sliced object's global transform. The plane normal is the normalised cross product of the two plane
     axes (left as is when its length is ≤ 1e-12).
  3. Compute the bounding box of the sliced object in that frame and set both grid size parameters to its
     largest extent.
  4. Set the grid's local position (kinematics ids 6, 7, 8 = posx, posy, posz) to the plane origin and its
     rotation (ids 11, 12, 13 = rotx, roty, rotz) to the XYZ Euler angles, in degrees, of the rotation
     taking +Y onto the plane normal.
  5. Connect the grid to the operator as its plane reference (child task).
  6. Set parameter id 4 of the operator to false (VT_BOOL).
  7. Run a final child task on a one-element list holding the grid (inferred: select or refresh it).

### `DisconnectFromSimulationOp`: SPEC

Wire contract:
- Args: `InputObj` (the simulated object or one of its ports, from the input objects), `ObjectsToDisconnect`
  (list, required).
- UnPackArg: the first input that is an object with the 3D object interface is used as the object;
  otherwise the first operator port. With neither, or without `ObjectsToDisconnect`, message 0x6f is
  raised and the command returns `0x80004005`.
- Object form: every operator of the object whose class is one of five simulation operator classes
  (`{3ee7b553-394f-11d3-8a80-00a024197c03}`, `{71240cfd-8df9-11d3-ba02-08003639d903}`,
  `{c41aa2c3-b58a-11d4-a96f-00c04f8edeb9}`, `{a6046eca-ef84-11d3-b018-0050da287511}`,
  `{976e6621-49ed-11d3-a1f9-00a0248f9567}`; names not in the DLL) disconnects every object in
  `ObjectsToDisconnect`.
- Port form: the port's operator disconnects each object of the list.
- Return: 0 when at least one disconnection happened, 1 (S_FALSE) otherwise. Null input → `0x80004003`;
  a port without a port interface → `0x80004002`.

### `CycleChecking`: SPEC

Wire contract:
- Args: `StartingGraphPt`, `Check Current Frame` (false), output `IsCycle`, `DisableCycleCheck` (false),
  `CheckFullNestedHier` (true), output `OutputObjs`, return `Value`.
- `IsCycle` is reset to false.
- If `DisableCycleCheck` is true **and** the preference `data_management.disable_cycle_checking` is
  true, nothing is checked. In other words `DisableCycleCheck` means "honour the preference".
- The connection graph is collected from `StartingGraphPt` (through nested hierarchies when
  `CheckFullNestedHier`) and traversed (connection-server traverser, mode 6).
- `Check Current Frame` evaluates the cycle check at the current time.
- When a cycle is found: `IsCycle` = true, `OutputObjs` = the operators that take part in cycles, and the
  message `PROBLEMATIC EVALUATION CYCLES ARE IN THE SPECIFIED GRAPH` is logged at severity 4.

## Open questions

1. Q1 `UpdateConnectOnOp`: mode 3 of the shared connect helper `0x180026970`.
2. Q2 `GetConnectionSet`: the `ConnectionSet` string grammar (`0x1800215a0`), the resolver
   (`0x18001ffe0`) and the connect / pick routine (`0x18001c750`), and the default preferred geometry.
3. Q3 `ConnectPlaneReferenceToSlicePolygonsOp`: the three connect variants at `0x1800e75a0` slots 9–11
   (port group used, whether an existing reference is removed first).
4. Q4 `MoveOperator`: names of `E3DMoveDirection` 0..2; the two reference classes refused for MoveAction 2.
5. Q5 `CreateGridAndConnectToSlicePolygonsOp`: what the final child task on the grid does, and the name
   of operator parameter id 4.
6. Q6 `DisconnectFromSimulationOp`: names of the five simulation operator classes.
7. `XSIOPTASKS` texts 0x3fa, 0x407, 0x5c–0x60, 0x6f, 0x7b–0x7d are not in `data/si`.
