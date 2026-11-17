# CMD-B8f: Polygon / edge / slice step commands (`simeshtasks.dll`) and curve drawing step commands (`sicurvetasks.dll`)

Row: **CMD-B8f**. Status: **SPEC** (17 names), **SPEC-PARTIAL** (2 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Source marks: (R) `data/command_registry.json`; (B) REA + Ghidra 12.1.4 on the PC
(`simeshtasks.dll` sha256 `6017bcce…`, `sicurvetasks.dll` sha256 `0019d009…`, image base
`0x180000000`); (L) local static reads of the same DLLs (vtables, GUID bytes, strings,
small thunks). Nothing was executed. No decompiler output or disassembly is reproduced.

## 1. Handler table

### `simeshtasks.dll`

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `AddPointToNewPolygon` | `a8956b40-3bf3-11d4-8c25-009027bc3a0e` | `0x18000a2b0` | `0x18000e570` | Do `0x180001950` / worker `0x1800017d0`; Undo `0x1800019b0`; Redo `0x180001980` | `0x180001c90` | `0x180001a00` |
| `RemovePointFromPolygon` | `9ff8f6d0-9ebf-11d4-8c45-009027bc3a0e` | `0x18000a470` | `0x180011f20` | Do `0x1800071d0` / worker `0x180006fc0`; Undo `0x180007230`; Redo `0x1800071f0` | `0x1800075b0` | `0x1800073d0` |
| `AddPointInteriorToPolygon` | `d53d6794-8033-4693-88ed-4f6d6a25f028` | `0x18000a270` | `0x18000dcb0` | Do `0x180001360` / worker `0x180001220`; Undo `0x1800013e0`; Redo `0x1800013b0` | `0x180001430` | `0x180009290` (returns 0, writes nothing) |
| `RemoveLastPointInteriorToPolygon` | `0bc15cdd-ff40-4ebd-9f83-06091226d41d` | `0x18000a430` | `0x1800116f0` | Do `0x180006c70` / worker `0x180006b70`; Undo `0x180006cb0`; Redo `0x180006c90` | `0x180006d10` | `0x180009290` |
| `TerminateAddEdgeWithInteriorPoints` | `247117fc-bce0-4988-8fa3-dc1ad7983f36` | `0x18000a4f0` | `0x180012f40` | Do `0x180009050` / worker `0x180008920`; Undo `0x180009170`; Redo `0x180009090` | `0x1800092a0` | `0x180009290` |
| `SnapOffsetToPointForSlicePolygons` | `4b596493-d616-49d4-893f-f8fcc4c23c5a` | `0x18000a4b0` | `0x1800126d0` | Do `0x1800082b0` / worker `0x1800077d0`; Undo = `C3DCoreBaseTask::UndoTasks`; Redo = `RedoTasks` | `0x1800082f0` | `0x180009290` |
| `ConnectNewPolygonToEdge` | `321c2390-3e2f-11d4-8c25-009027bc3a0e` | `0x18000a2f0` | `0x18000ed70` | Do `0x1800027a0` / worker `0x180002060`; Undo `0x180002880`; Redo `0x1800027e0` | `0x180002a10` | `0x1800073d0` (shared with RemovePointFromPolygon) |
| `ConnectNewPolygonToPoint` | `34a206f0-4ca6-11d4-8c28-009027bc3a0e` | `0x18000a330` | `0x18000f5b0` | Do `0x180002f50` / worker `0x180002ce0`; Undo `0x180002fd0`; Redo `0x180002f90` | `0x180003270` | `0x1800030a0` |
| `CreateMeshPartitionClusters` | `e487669d-e540-422b-9f8d-690c0d6bc50c` | `0x18000a3b0` | `0x1800106d0` | Do `0x180005b20` / worker `0x1800051d0`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x180004840` | `0x180005bc0` |
| `CreateClustersAlongDepthFromCurvesToMeshOperator` | `9237b4fb-2165-4128-a23f-b255fb35f393` | `0x18000a370` | `0x18000fe80` | Do `0x1800047d0` / worker `0x180003970`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x180004840` (shared) | `0x180006520` |
| `CreateClustersFromSlicePolygonsOperator` | `a8e33f35-21c0-4c29-8ecb-5b606a789d01` | `0x18000a3f0` | `0x180010ef0` | Do `0x1800064a0` / worker `0x180005db0`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x180006590` | `0x180006520` |

### `sicurvetasks.dll`

The locator's first candidate vtable is the COM-object part for four classes; the task
vtable is the second candidate, and the worker is slot 9 of a private interface vtable
(third candidate) reached through a sub-object at task+0x20 (or +0xc8 for the add-point
family).

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `SICreateCurve` | `8f351a3d-edf2-11d2-9224-00a0c9612e3a` | `0x18000bf60` | `0x180012670` (private iface `0x1800126e0`) | Do `0x180005430` / worker `0x180005030`; Undo = `UndoTasks`; Redo `0x1800054a0` | `0x180005720` | `0x1800056e0` |
| `SISetCurvePoints` | `1808e581-f9b7-11d2-9244-00aa0068bf56` | `0x18000c0e0` | `0x1800157b0` (private iface `0x180015820`) | Do `0x180009450` / worker `0x180009250`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x1800098f0` (string parser `0x180009490`) | `0x180009890` (nothing written) |
| `SIAddPointOnCurve` | `cfb524a3-eeb9-11d2-9224-00a0c9612e3a` | `0x18000bee0` | base `0x180011580` (slots 5-7 pure virtual), derived `0x180010d40` (private iface `0x180010e20`) | Do `0x180003450` / worker `0x1800024c0`; Undo `0x180003680`; Redo `0x1800034b0` | `0x180008dc0` (calls base `0x180003af0`) | base `C3DCoreBaseTask::RePackArg` |
| `SIAddPointOnCurveAtStart` | `d62480c3-eddd-11d2-9222-00a0c9612e3a` | `0x18000bea0` | derived `0x180010540` (private iface `0x180010620`) | Do `0x180001fb0` / worker `0x180001b10`; Undo `0x1800021e0`; Redo `0x180002010` | `0x1800022c0` (calls base `0x180003af0`) | base |
| `SIAddPointOnCurveAtEnd` | `cfb524a4-eeb9-11d2-9224-00a0c9612e3a` | `0x18000be60` | derived `0x18000fd10` (private iface `0x18000fdf0`) | Do `0x180001fb0` (same function as AtStart) / worker `0x180001150`; Undo `0x180001850`; Redo `0x180001680` | `0x1800022c0` | `0x180001920` |
| `SIDeletePointOnCurve` | `be413b72-cd20-11d3-a9ba-009027bc65d7` | `0x18000c020` | `0x180013f50` (private iface `0x180013fc0`) | Do `0x180007c00` / worker `0x180007940`; Undo `0x180007c70`; Redo `0x180007c20` | `0x180007da0` | base |
| `CreateCurvePartitionClusters` | `2fb4eae2-5671-4a2b-b0f6-749ebc7d23d7` | `0x18000bf20` | `0x180011dc0` | Do `0x180004890` / worker `0x1800041b0`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x1800049a0` | `0x180004920` |
| `CurveDirectManip` (two registry entries, same handler) | `2012b58b-55bb-4512-a6d0-8f95a6c92c9a` | `0x18000bfa0` | `0x180012ec0` (private iface `0x180012f30`) | Do `0x1800060c0` / worker `0x1800059d0`; Undo/Redo = `UndoTasks`/`RedoTasks` | `0x1800061d0` (subcomponent resolver `0x1800063d0`) | `0x1800082c0` (returns 0, writes nothing) |

## 2. Shared facts

### 2.1 Both DLLs

- Interface ids seen repeatedly: `6b579d20-3dc5-11d0-9449-00aa006d3165` = 3D object (the
  type every `InputObj` argument is resolved to); `4aeaeaea-1a43-11d2-8d66-00a0c982a649`
  = component hierarchy (used to build the soft reference a task keeps for undo/redo, via
  `F3DCreateObjectReference`, and resolved again with `F3DResolveObjectReference`);
  `6de1b670-8072-11d5-aeed-0090275802c9` = parameter access on an operator (method slot 46
  reads a parameter by numeric id into a variant, slot 47 writes one, slot 90 enumerates
  nested objects); `473feb00-64ed-11d1-84c6-00a0243e3543` = operator port access (slot 27
  = get port by (group, instance, port), slot 31 = instance count of a port group);
  `f49f6470-4211-11d0-8463-00a024c7919c` = object list (class
  `f49f6471-4211-11d0-8463-00a024c7919c`).
- "Set parameter value" sub-task: class `c089b901-8481-11d2-b118-00a024c79287`,
  interface `c089b902-8481-11d2-b118-00a024c79287`. "Apply operator" sub-task: class
  `46cee370-8bb2-11d2-ac56-00a02485cecb`, interface `46cee371-…`, used with a connection
  group set created for port-set GUID `ce9a5031-8bc7-11d2-ac56-00a02485cecb`.
  "Create cluster" sub-task: class `5f1f5161-8b90-11d2-a93c-00a024190119` / interface
  `5f1f5162-…` (mesh DLL) and class `5f1f5163-…` / interface `5f1f5164-…` (curve DLL).
  "Connect to operator port group" sub-task: class `85ad2212-d8cb-11d2-ac75-00a02485cecb`
  / interface `85ad2211-…`.
- Sub-component type GUIDs: `3df7f9e0-89ee-11d0-9964-00a0243f0e60` (used where a single
  point is required), `3df7f9e1-…` (used for the `EdgesAlong` cluster), `3df7f9e2-…`
  (used for all polygon clusters); curve isopoint `a9a64543-adf3-11d1-b7b4-00a0243e3694`.
  The point/edge/polygon reading of the first three is *(inferred from use)*.
- Commands whose Do only builds sub-tasks undo and redo through
  `C3DCoreBaseTask::UndoTasks` / `RedoTasks`; sub-tasks are attached with `AddTask` only
  on the first execution (Do flag non-zero).

### 2.2 The polygon-builder operator (`simeshtasks.dll`, Add Polygon tool)

`AddPointToNewPolygon`, `RemovePointFromPolygon`, `ConnectNewPolygonToEdge` and
`ConnectNewPolygonToPoint` do **not** create an operator. Each looks up an operator
already present on `InputObj` with
`corehelper.dll!F3DFindGeometryOperator(time = none, object, 9, 1, 3, IID, &out)` where
the interface id is `ddfbf160-3bc7-11d4-8c25-009027bc3a0e`. A return of 1 ("not found")
is turned into `0x8000ffff` by AddPoint / RemovePoint (and by all RePackArg functions);
the two Connect commands simply stop. The operator must therefore have been applied by
the tool before these commands are run.

That interface holds the **ordered point list of the polygon under construction**.
Methods used (slot numbers on the interface):

| Slot | Meaning (from use) |
|---|---|
| 3 | insert a *new* point: (position index, xyz as 3 doubles) |
| 4 | insert a reference to an *existing mesh point*: (position index, point id, invert flag) |
| 5 | remove the entry at a list index |
| 6 | read an integer that every RePackArg publishes as `PolygonID` (initialised to -1 before the call) |
| 7 | number of entries |
| 8 | copy all entries into a caller array |

Entry layout (40 bytes each): int kind at +0 (0 = reference to an existing mesh point,
non-zero = new point with its own position); three doubles x, y, z at +8; int id at
+0x20 (the mesh point id); int flag at +0x24 (the invert flag given to slot 4).

Position index convention: index **0 means "append at the end"** (AddPoint reports the
last entry when `InsertPosition` is 0, its undo removes entry `count-1`, and
RemovePoint's undo re-inserts at 0 when the removed entry was the last one); a non-zero
index inserts before that list position.

### 2.3 The interior-point operator (Add Edge tool)

`AddPointInteriorToPolygon`, `RemoveLastPointInteriorToPolygon` and
`TerminateAddEdgeWithInteriorPoints` receive the operator itself in the `Operator`
argument, resolved to interface `cedc2080-47aa-11d4-8c27-009027bc3a0e`. Methods used:
slot 6 = append an interior point (3 ints, 3 doubles, 1 double); slot 7 = remove the
last interior point; slot 8 = read the last interior point back (same three outputs).

### 2.4 The curve-creation operator (`sicurvetasks.dll`, Draw Curve tools)

Operator class `449e9671-eaf1-11d3-934f-009027bc3e26`, private interface
`e5088b70-ed04-11d2-9121-00a0244eeb76`. Helper `0x18000a570` finds it on a curve object
by enumerating the object's nested operators (parameter-access slot 90 with arguments
1, 1, 3) and keeping the first whose class belongs to family GUID at `0x1800161c0`
(`DSGetFamiliesManager`), then querying the interface; "none" is `0x80004005`. Methods
used on the interface: slot 3 = insert point (index, x, y, z); slot 4 = remove point at
index; slot 7 = set degree; slot 8 = get an integer compared with 1 *(inferred: degree)*;
slot 9 = append point (x, y, z); slot 10 = remove last point; slot 12 = get point count;
slot 13 = set curve type code; slot 16 = get curve type code. Slots 3 and 9 may return 1,
which the callers log as message `0x91` (severity 4) and treat as "nothing added".

Curve type codes. The scripting argument `CurveType` is translated to an internal
one-byte code: argument 0 -> code 1, argument 1 -> code 0, argument 3 -> code 3. For the
add-point commands any other value (including the default -1) becomes code `0x7f` =
"not specified, keep the curve as it is"; for `SICreateCurve` any other value is an
error. When an add-point *operator* is used instead of the creation operator, the code is
translated back for its integer "type" parameter: code 1 -> 0, code 0 -> 1, code 3 -> 3,
code `0x7f` -> 2. The meaning of 0 / 1 / 3 (which drawing style) is not named in the
binary (Q6).

Point coordinates are always three doubles x, y, z (no weight, no 4th component). When
`Local` is false the point is first converted from global to the curve object's local
space (helper `0x1800099d0`: object global transform, inverted, applied to the point);
when `Local` is true it is used as given.

Add-point operators applied through helper `0x180009c70` (creates a one-object list,
asks the "apply operator" sub-task for the connection set, applies the operator class
and returns the operator and the sub-task). Helper `0x18000a970` then writes the point
into the operator, choosing parameter ids by the operator's class:

| Operator class | x, y, z parameter ids (double) | 4th value |
|---|---|---|
| `57437ad3-0e04-11d3-a977-00a024190119` (add point at start / end) | 4, 5, 6 | id 1 = unsigned int, 0 for start, 1 for end |
| `b4ab59b0-3088-11d3-9143-00a0244eeb76` (add point in the middle) | 1, 2, 3 | id 4 = double, normalised position on the curve |
| `516b03d0-13b4-11d3-a977-00a024190119` (handled, not created by these commands) | 2, 3, 4 | id 1 = double |

Any other class gives `0x80004001`. After writing, the helper calls operator slot 113
with argument 1 *(inferred: mark the operator dirty)*.

## 3. Contracts: `simeshtasks.dll`

### `AddPointToNewPolygon`: SPEC

**Wire contract.** Purpose: append or insert a brand-new vertex position into the
polygon being drawn by the Add Polygon tool.

- Arguments (R, names confirmed in UnPackArg): `InputObj` (object, in); `X`, `Y`, `Z`
  (double, default 0, in); `InsertPosition` (int, default 0, in); `PolygonID` (int, out);
  return value `Value` (int).
- Steps: find the polygon-builder operator on `InputObj` (2.2); call its "insert new
  point" method with (`InsertPosition`, xyz). On first execution keep position, xyz and
  a soft reference to the operator.
- Coordinates are passed through unchanged (no space conversion in the command).
- Outputs (RePackArg, operator looked up again at the current time): `Value` = the id
  field of the entry at list index `InsertPosition`, or of the last entry when
  `InsertPosition` is 0; `PolygonID` = operator slot 6.
- Undo: remove the entry at `InsertPosition`, or the last entry when it is 0. Redo: insert
  the same point again.
- Errors: null object `0x80004003`; operator not found `0x8000ffff`; undo without an
  operator pointer `0x80004005`.

### `RemovePointFromPolygon`: SPEC

**Wire contract.** Purpose: take one point out of the polygon being drawn.

- Arguments: `InputObj` (object, in); `PointID` (int, default 0, in); `PolygonID` (int,
  out).
- Steps: find the polygon-builder operator; read all entries; search from the start for
  the first entry whose id field equals `PointID` (entry kind is not checked) and remove
  it. On first execution the whole removed entry (kind, xyz, id, flag) and its list index
  are saved.
- Output: `PolygonID` = operator slot 6.
- Undo: re-insert at the saved index, using "insert new point" with the saved xyz when
  the saved kind was non-zero and "insert existing point" with the saved id and flag when
  it was 0; if the saved index equals the current count the re-insert is done at position
  0 (append); any other out-of-range index gives `0x8000ffff`. Redo: remove at the saved
  index.
- Errors: null object `0x80004003`; operator not found `0x8000ffff`; no entry with that
  id `0x80070057`.

### `ConnectNewPolygonToPoint`: SPEC

**Wire contract.** Purpose: add an existing mesh vertex to the polygon being drawn.

- Arguments: `InputObj` (object, in); `PointID` (int, default 0, in); `InsertPosition`
  (int, default 0, in); `InvertPolygon` (bool, default false, in); return `PolygonID`
  (int).
- Steps: fetch the object's geometry at the current time (only as a validity check); find
  the polygon-builder operator; read its entries. If the list is non-empty and `PointID`
  equals the id of the entry at `InsertPosition` or of the entry just before it (cyclic,
  index `(InsertPosition - 1 + count) mod count`), nothing is inserted (the point is
  already the neighbour). Otherwise, unless `PointID` is -1, call "insert existing point"
  with (`InsertPosition`, `PointID`, `InvertPolygon`).
- Output: `PolygonID` = operator slot 6 (RePackArg).
- Undo: find the entry of kind 0 whose id equals the inserted point and remove it (nothing
  if no point was inserted). Redo: insert again with the saved values.
- The status returned by the worker could not be recovered (Q1).

### `ConnectNewPolygonToEdge`: SPEC

**Wire contract.** Purpose: add the two end points of an existing mesh edge to the
polygon being drawn, in the order that keeps the new polygon consistent with the mesh.

- Arguments: `InputObj` (object, in); `EdgeID` (int, default 0, in); `InsertPosition`
  (int, default 0, in); `InvertPolygon` (bool, default false, in); return `PolygonID`.
- Steps:
  1. Geometry of `InputObj` at the current time (interface
     `400cce30-4400-11d0-bddd-00a0241981e2`). The edge must exist (geometry slot 86 gives
     a non-zero flag), else stop.
  2. Read the edge's two side attributes (geometry slots 87 and 88; -1 when absent,
     *inferred: the polygon on each side*) and its two end points (slots 77 and 78). If
     the slot-88 attribute is present, first point A = slot-78 vertex and second point B
     = slot-77 vertex; else if the slot-87 attribute is present, A = slot-77 vertex and B
     = slot-78 vertex; if neither is present no point is taken.
  3. Find the polygon-builder operator and read its entries. If the list is non-empty: A
     is dropped when it equals the id of the entry before `InsertPosition` (cyclic); B is
     dropped when it equals the id of the entry at `InsertPosition`.
  4. Crossing test, only when the list has more than one entry and both A and B remain:
     take the positions (geometry slot 102) of the previous entry's point, A, B and the
     entry at `InsertPosition`; build the segment previous -> A and the segment B ->
     current; ask `C3DLine::GetClosestPointToOtherLine` (tolerances 0.95 and about 1e-12).
     If the lines meet (status 1), the parameter is within (-1e-6, 1.000001) and the
     distance from the second segment is below 1e-6, A and B are swapped.
  5. Insert with "insert existing point" and the `InvertPolygon` flag: when
     `InsertPosition` is 0, A then B, both at position 0 (appended in that order);
     otherwise B then A, both at `InsertPosition` (so A ends up before B).
  6. First execution: save `EdgeID`, A, B, position, flag and a soft reference to the
     operator.
- Output: `PolygonID` = operator slot 6.
- Undo: remove the kind-0 entry whose id is A, re-read, then remove the kind-0 entry
  whose id is B. Redo: repeat step 5 with the saved A / B (no recomputation).
- Worker status not recovered (Q1).

### `AddPointInteriorToPolygon`: SPEC

**Wire contract.** Purpose: append one interior point to the Add Edge operator's list.
The point is expressed relative to a triangle of the polygon.

- Arguments: `Operator` (object, in, must expose `cedc2080-47aa-11d4-8c27-009027bc3a0e`);
  `PolygonID` (uint, default 0); `FirstOffset`, `SecondOffset`, `ThirdOffset` (uint,
  default 0); `FirstWeight`, `SecondWeight`, `ThirdWeight` (double, default 0); `Height`
  (double, default 0). No output.
- Steps: call the operator's "append interior point" with the three offsets, the three
  weights and the height. `PolygonID` is read but not forwarded to the operator. First
  execution saves the values and a soft reference to the operator.
- Interpretation *(inferred from the names)*: the three offsets select three corners of
  the polygon, the weights are barycentric weights on them, `Height` is the distance off
  the polygon plane.
- Undo: operator "remove last interior point". Redo: append again.
- Errors: null operator `0x80004003`; no component hierarchy on the operator `0x80004002`;
  undo without operator `0x80004005`.

### `RemoveLastPointInteriorToPolygon`: SPEC

**Wire contract.** Purpose: drop the most recently added interior point.

- Arguments: `Operator` (object, in, same interface); `PolygonID` (uint, default 0, read
  and unused). No output.
- Steps: on first execution read the last interior point back (offsets, weights, height)
  and keep it for undo; then call "remove last interior point".
- Undo: append the saved point. Redo: remove last again.
- Errors: null operator `0x80004003`; undo without operator `0x80004005`.

### `TerminateAddEdgeWithInteriorPoints`: SPEC-PARTIAL

**Wire contract.** Purpose: close an Add Edge stroke that has interior points by giving
the operator its end edge and the position on that edge.

- Arguments: `Operator` (object, in, interface `cedc2080-…`); `PolygonID` (uint, default
  0); `EdgeID` (uint, default 0); `Ratio` (double, default 0). No output.
- Steps read:
  1. From the operator's port access take port (group 1, instance 0, port 0); it must
     report a non-zero state (operator slot 3 of the port), else `0x8000ffff`.
  2. Through the port's interface `c05038a0-31e4-11ce-977f-00aa004a86ab` request, for the
     current time, the object attached to it (request block of 0x60 bytes carrying the
     GUIDs `0d4d40a0-c3d8-11cf-894b-00a02418cf4a` and
     `e65416f1-812c-11cf-a059-00a02418cfb9`).
  3. On the returned object enumerate nested items (parameter-access slot 90 with 9, 1,
     3 and interface `b5558aa1-b17e-11d3-aaf8-009027bc38c1`), take the first and give it
     a single element: `EdgeID`.
  4. Write `Ratio` (double) into the operator's parameter with descriptor (0x402, 1) at
     the current time, with the task's own undo context.
  5. First execution: store an element reference to the operator.
- `PolygonID` is not used by the worker.
- Undo: resolve the operator and run the same worker with edge id -1 and the saved
  ratio. Redo: run it again with the saved edge id and ratio.
- Missing: what the object of steps 2-3 is (edge collection / cluster feeding the
  operator, *inferred*), and the worker's return status (Q2).

### `SnapOffsetToPointForSlicePolygons`: SPEC-PARTIAL

**Wire contract.** Purpose: move the cutting plane of a Slice Polygons operator so that
it passes through a picked point.

- Arguments: `Operator` (object, in, must expose
  `bc58fcde-3c2b-4ec8-8aff-accd28a4151d`); `Target` (object, in, interface
  `872903d0-3ef3-11d0-8463-00a024c7919c`). No output.
- UnPackArg: `Target` must be a sub-component of type
  `3df7f9e0-89ee-11d0-9964-00a0243f0e60` with at least one index, otherwise
  `0x80070057`. Only the **first** index is used: its position is read from the owner's
  geometry at the current time and converted to global space with the owner's global
  pose.
- Do: clear previous sub-tasks; find the object owning the operator; convert the global
  target into that object's local space; read the operator's current plane (origin and
  normal, operator slot 3). Then, by operator parameter (numeric ids, names unknown, Q3):
  - parameter 0x11 equal to 0: read parameter 4 (double), add the signed distance from
    the plane to the target along the unit normal, and write it back as parameter
    (0x402, 4) through a "set parameter value" sub-task.
  - parameter 0x11 non-zero and parameter 0x10 equal to 0: read parameter 5 (double, an
    angle in degrees), write it temporarily changed by +10 (or -10 when it is 90 or
    more), force a re-evaluation of the object, read the plane again, and from the two
    planes make a one-step linear estimate of the angle that brings the plane onto the
    target; write the result as parameter (0x402, 5) through the sub-task.
  - parameter 0x11 non-zero and parameter 0x10 non-zero: nothing is written.
- Undo / redo: `UndoTasks` / `RedoTasks`.
- Missing: names of parameters 4, 5, 0x10, 0x11 and the status returned in the last
  branch (Q3).

### `CreateMeshPartitionClusters`: SPEC

**Wire contract.** Purpose: create one polygon cluster per "partition" reported by the
operator that built a mesh (for text meshes: one cluster per character).

- Arguments: `InputObjs` (object list, in/out); `InspectedObjectsArray` (array of
  objects, optional).
- Input selection (UnPackArg `0x180004840`, shared with the next command): if
  `InspectedObjectsArray` is a non-empty object array, each element whose class id is
  `c53d47e0-08f7-11d5-8c5a-009027bc3a0e` *(inferred: the Curves To Mesh operator)*
  contributes the object attached to its port (group 2, instance 1, port 0); other
  elements are ignored and `InputObjs` is not read. Otherwise the `InputObjs` list is
  used.
- Do, per object: skip objects with no geometry; find on it the operator exposing
  `a5bdcbbd-783f-4a60-ad91-0a320fe80acc` (`F3DFindGeometryOperator(time, obj, 1, 1, 0xb,
  …)`); skip if absent. If that operator has exactly one instance of port group 0, follow
  port (0, 0, 0) to its source, take the source's primary owner object and look there for
  an operator exposing `b99eae89-aae4-4890-a6b1-55a922355426` (text operator); if found,
  read its text string. Ask the mesh operator for its partition list. Names: when no text
  was found, prefix `Face` with no per-cluster suffix; otherwise prefix `Char` and one
  suffix per partition made of `_` followed by the corresponding character of the text.
  A sub-task (class `6427ffad-559f-486f-a725-d09a036f12c5`, interface
  `f862706f-b46f-4cb9-87ff-0b744b321da2`) creates the clusters from (object, partition
  list, prefix, suffix array) and appends them to a result list.
- After all objects a final sub-task (class `79581ba0-99bb-11d2-8bbb-00aa00135f7b`,
  interface `7a1141d0-b800-11d3-8c0b-009027bc3a0e`) is run on the list of created
  clusters *(purpose not read, Q4)*.
- RePackArg writes the input list back into `InputObjs`.
- Errors: null list `0x80004003`; empty list `0x80070057`; out of memory `0x8007000e`.

### `CreateClustersAlongDepthFromCurvesToMeshOperator`: SPEC

**Wire contract.** Purpose: create the five polygon clusters of a Curves To Mesh result
and connect each to the operator so it fills them.

- Arguments: `InputObjs` (object list, in/out); `InspectedObjectsArray` (optional);
  return `CreatedClusters` (object list).
- Input selection: same UnPackArg as above.
- Do, per object with geometry and with an operator exposing `a5bdcbbd-…`: read the names
  of the object's existing clusters of type `3df7f9e2-…`; then for each of the five
  fixed (name, port group) pairs, in this order: `Front` 3, `FrontBevel` 4, `Extrusion`
  5, `BackBevel` 6, `Back` 7: skip the pair if a cluster of that name already exists;
  otherwise create an empty cluster of type `3df7f9e2-…` with that name on the object
  ("create cluster" sub-task, mode argument 3), connect it to the operator's port group
  of that number ("connect" sub-task), and append it to the `CreatedClusters` list.
- RePackArg returns the list as `CreatedClusters`.
- Errors: null list `0x80004003`; empty list `0x80070057`.

### `CreateClustersFromSlicePolygonsOperator`: SPEC

**Wire contract.** Purpose: create the three output clusters of a Slice Polygons
operator and connect them.

- Arguments: `InputObjs` (object list, in/out); `InspectedObjectsArray` (optional);
  return `CreatedClusters` (object list).
- Input selection (UnPackArg `0x180006590`): as above, but the class id accepted in
  `InspectedObjectsArray` is `9932e72c-a0a5-410e-aaae-41fb8f1eed8a` *(inferred: the Slice
  Polygons operator)* and the object is taken from its port (group 0, instance 1, port
  0).
- Do, per object with geometry and with an operator exposing `bc58fcde-…`: for each of
  three fixed triples, in order: `PolysAbove` (type `3df7f9e2-…`, port group 2),
  `PolysBelow` (type `3df7f9e2-…`, port group 3), `EdgesAlong` (type `3df7f9e1-…`, port
  group 4): create the named empty cluster on the object, connect it to that port group
  of the operator, append it to `CreatedClusters`. Unlike the previous command there is
  no "already exists" check.
- Errors: null list `0x80004003`; empty list `0x80070057`.

## 4. Contracts: `sicurvetasks.dll`

### `SICreateCurve`: SPEC

**Wire contract.** Purpose: create an empty curve object ready to receive points.

- Arguments: `Name` (string, default empty, in); `Degree` (unsigned 16-bit, default 3,
  in); `CurveType` (signed 8-bit, default 0, in); return `Value` = the new object.
- `CurveType` accepts only 0, 1 or 3 (translated as in 2.4); anything else is
  `0x80070057`. No knot vector, closed flag or point array is taken by this command.
- Steps: (1) a primitive-creation sub-task (class `29668d60-591f-11d1-bafa-444553540000`,
  interface `e3b60611-7db8-11d2-ac53-00a02485cecb`) creates the object from preset GUID
  `28dec317-62b3-11d1-b79b-00a0243e3694`; (2) the curve-creation operator (2.4) is applied
  on it; (3) the operator receives the type code, then the degree; (4) first execution:
  both sub-tasks are attached and soft references to the object and the operator, the
  name, degree and type are saved; (5) if `Name` is not empty the object is renamed
  (interface `9ee6ddb1-65cc-11d1-b0ce-00a024c79287`).
- Undo: `UndoTasks`. Redo: `RedoTasks`, then type and degree are written to the operator
  again and the object is renamed again.
- Errors: `0x80004003` null context; `0x80004002` missing interface; `0x8007000e` when the
  name string cannot be allocated.

### `SIAddPointOnCurveAtEnd` / `SIAddPointOnCurveAtStart` / `SIAddPointOnCurve`: SPEC

The three classes share a base (argument storage, UnPackArg `0x180003af0`, soft-reference
handling) and differ only in where the point goes and in the fallback operator.

**Wire contract.**

- Common arguments: `InputObj` (object, in); `X`, `Y`, `Z` (double, default 0); `Local`
  (bool, default false); `CurveType` (int, default -1, translated as in 2.4).
  `SIAddPointOnCurve` adds `InsertPosition` (double, default 0, before `X`) and is used
  only when the variant really is a double. `…AtStart` and `…AtEnd` add `PreserveTrace`
  (bool, default false). `…AtEnd` returns `Value` (bool).
- A missing or wrong `InputObj` raises `0x80070057` with message id `0x3fc` (severity 2).
- Common preparation: copy the point; if `Local` is false convert it to the curve's local
  space; look for the curve-creation operator (2.4).
- **Fast path (creation operator present).** It is used only if it is compatible: the
  operator is rejected when a type was requested (code not `0x7f`), the curve already has
  points, the operator's slot-8 value is not 1 and the operator's current type differs
  from the requested one. For `…AtStart` / `…AtEnd` it is also rejected when
  `PreserveTrace` is true.
  - `…AtEnd`: append the point (slot 9).
  - `…AtStart`: insert at index 0 (slot 3).
  - `SIAddPointOnCurve`: only when `InsertPosition` has no fractional part: a negative
    value raises `0x80070057` (message `0x3fc`); otherwise insert at index
    `InsertPosition + 1`.
  - A return of 1 from the operator logs message `0x91` (severity 4) and nothing is
    recorded.
- **Operator path (no usable creation operator, or fractional `InsertPosition`).**
  - `…AtStart` / `…AtEnd`: apply operator class `57437ad3-…`; write x, y, z and the end
    selector (0 = start, 1 = end); if `PreserveTrace` is true write integer 0 into
    parameter 2 and use type value 2, otherwise use the translated type; write the type
    value into parameter 7.
  - `SIAddPointOnCurve`: the integer part of `InsertPosition` must be 0 (else
    `0x80070057`, message `0x3fc`), so the value is a normalised position in [0, 1);
    apply operator class `b4ab59b0-…`; write x, y, z and the position; write the
    translated type into parameter 6 and boolean false into parameter 5.
  - First execution: attach the apply-operator sub-task.
- First execution always saves the (possibly converted) point, the type code and a soft
  reference to whichever operator was used.
- Return (`…AtEnd` only): `Value` is true when a point was added by either path, false
  otherwise.
- Undo: fast path: remove the last point (`…AtEnd`), the point at index 0 (`…AtStart`) or
  the point at the saved index (`SIAddPointOnCurve`); operator path: `UndoTasks`
  (`0x80004005` if neither reference is available). Redo: fast path repeats the insert;
  operator path runs `RedoTasks`, resolves the operator and rewrites its parameters.

### `SISetCurvePoints`: SPEC

**Wire contract.** Purpose: feed a list of points to a curve in one call.

- Arguments: `InputObj` (object, in); `Points` (string, default empty); `Local` (bool,
  default false, coerced to boolean). No output.
- `Points` grammar: a comma-separated sequence of groups `(x,y,z)`; each number is read
  with `wcstod`; blanks are allowed around tokens; exactly **three** numbers per point
  (position only, no weight). The string must end right after a closing parenthesis. An
  empty string or any deviation gives `0x80070057`.
- Steps: for each point in order, create an instance of the `SIAddPointOnCurveAtEnd`
  class (`cfb524a4-…`, interface `d62480c2-eddd-11d2-9222-00a0c9612e3a`) and run its
  worker with the point, type code `0x7f`, the `Local` flag and `PreserveTrace` false;
  attach each as a sub-task on first execution. Points are therefore **appended** to
  whatever the curve already has; nothing is cleared. A final call on the object's
  parameter access (slot 103, current time) follows *(purpose not read, Q5)*.
- If the worker is entered without a point array it logs message `0xd0` (severity 2) and
  returns 1.
- Undo / redo: `UndoTasks` / `RedoTasks`.

### `SIDeletePointOnCurve`: SPEC

**Wire contract.** Purpose: delete one control point of a curve list, addressed by a
running index over all its curves.

- Arguments: `InputObj` (object, in); `InsertPosition` (int, default 4). No output.
- Steps: geometry at the current time (interface `e14a9f51-6cc4-11d1-b79b-00a0243e3694`).
  Walk the curves in order; for each read two counts (curve slots 13 and 14; *inferred:
  degree and number of points*). If the index is smaller than the second count, this is
  the curve and the index is the point within it; otherwise subtract that count and go
  on. On the selected curve the first count must be smaller than the second (a curve at
  its minimum size cannot lose a point). Then apply operator class
  `992f08e0-7bbe-11d0-a88e-00a024190119` to the object and write parameter 1 = curve
  index and parameter 2 = point index (both unsigned int). First execution attaches the
  sub-task and saves a soft reference to the operator and both indices.
- Errors: index beyond the last curve, or curve too small: raise `0x80070057`, message
  `0x3fc`, severity 2. Bad `InputObj`: same.
- Undo: `UndoTasks`. Redo: `RedoTasks`, resolve the operator, rewrite both parameters.

### `CreateCurvePartitionClusters`: SPEC

**Wire contract.** Curve-list twin of `CreateMeshPartitionClusters`.

- Arguments: `InputObjs` (object list, in/out); `InspectedObjectsArray` (optional).
- Input selection: if `InspectedObjectsArray` is an object array, each element exposing
  `b99eae89-aae4-4890-a6b1-55a922355426` (text operator) contributes the object on its
  port (group 0); otherwise `InputObjs`.
- Do, per object: find the operator exposing `b99eae89-…`
  (`F3DFindGeometryOperator(time, obj, 1, 1, 0xb, …)`); ask it for the partition list and
  the text; build one suffix per partition (`_` + character); the cluster sub-task (class
  `6427ffad-…`) creates the clusters with prefix `Char`. A final sub-task (class
  `79581ba0-…`) is run on the created list, as in the mesh command.
- RePackArg writes the list back to `InputObjs`. Errors: `0x80004003`, `0x80070057`
  (empty list), `0x8007000e`.

### `CurveDirectManip`: SPEC

**Wire contract.** Purpose: apply (or update) the curve direct-manipulation deformer on
one isopoint of a curve.

- Arguments: `SubComp` (object list, in); `ImmediateMode` (default
  `siPersistentOperation`; must evaluate to 0 or 1); `Mode` (default
  `siCurveIsopointPositionManipMode`; must be below 7); `X`, `Y`, `Z` (double, default
  0); return `Value` (object; not written by RePackArg, Q7).
- UnPackArg: take the **first** item of `SubComp`. It must be either a transient
  sub-component or a cluster of type `a9a64543-adf3-11d1-b7b4-00a0243e3694` holding
  exactly one element; the element resolves to (curve index, normalised position), and the
  position must lie in [0, 1] (tolerance 1e-9). Any failure, a bad `ImmediateMode` or a
  bad `Mode` gives `0x80070057`.
- Do:
  1. Lock check on the owner object (reference-model lock, lock levels 4 and 1); if
     locked raise the lock error and stop.
  2. If the item is not already a cluster, create one from it ("create cluster"
     sub-task).
  3. `F3DUpdateOperatorStack` with operator class `5c0af205-b2f9-4135-bd75-27c0535dc5dc`
     on (object, cluster): reuses the operator on top of the stack or adds a new one; a
     new one's add-operator task is attached.
  4. Connect the cluster to the operator ("connect" sub-task, port group 1).
  5. Write four parameters through "set parameter value" sub-tasks, identified by GUID:
     `39c6c6d5-9fee-4044-9c56-2ac04af7db9b` = `Mode` (int);
     `165922ac-8c03-4e09-8cff-005e2a8905cf` = `X`;
     `31c00d28-5029-421a-852f-db900e1a88d2` = `Y`;
     `3bd45f26-089d-4f8b-b4d4-2964813ba227` = `Z` (doubles).
  6. If `ImmediateMode` is 1: evaluate the geometry, then run a sub-task (class
     `761b65c4-2f0a-11d3-9196-00a0243e34c4`) on a list holding the object *(inferred:
     freeze the operator stack)*.
- Undo / redo: `UndoTasks` / `RedoTasks`.

## Open questions

1. `simeshtasks.dll` `0x180002060` and `0x180002ce0` (Connect workers): the decompiler lost
   the returned status; the early exits (no geometry, edge absent, operator absent) may
   return a failure code or success.
2. `0x180008920` (`TerminateAddEdgeWithInteriorPoints`): identity of the object reached
   through port (1, 0, 0) and of the nested item that receives `EdgeID`; returned status.
3. `0x1800077d0` (`SnapOffsetToPointForSlicePolygons`): scripting names of Slice Polygons
   parameters with ids 4, 5, 0x10 and 0x11; status when 0x10 is non-zero.
4. Purpose of the final sub-task class `79581ba0-99bb-11d2-8bbb-00aa00135f7b` in the two
   partition-cluster commands (`0x1800051d0`, `sicurvetasks.dll` `0x1800041b0`).
5. `sicurvetasks.dll` `0x180009250`: the closing call on parameter-access slot 103.
6. Scripting meaning of `CurveType` values 0, 1 and 3 (the binary only maps them to codes
   1, 0, 3); semantics of the curve-creation operator slots are inferred from use.
7. `CurveDirectManip`: the worker can hand back the operator, but Do passes no receiver
   and RePackArg `0x1800082c0` writes nothing, so `Value` appears to stay empty.
8. Polygon-builder interface slot 6: the value published as `PolygonID` is not interpreted
   in these DLLs.
