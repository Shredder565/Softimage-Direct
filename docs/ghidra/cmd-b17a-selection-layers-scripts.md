# CMD-B17a: selection and layer / visibility script commands (`selection.vbs`, `layers.vbs`)

Row: **CMD-B17a**. Status: **SPEC** for all 23 commands below.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced; behaviour is described in my own words.

Binary: none. Every command here is a script command (handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`), the
registry entry names the VBScript file and procedure. Sources read from the install with REA
`open_binary(format=raw-binary, architecture=6502, entry_point=0x0)` + `read_bytes` (whole file), decoded in the
scratchpad; sha256 of the decoded copy matched the install file.

| File (`Application\DSScripts\`) | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `selection.vbs` (registry also spells it `Selection.vbs`; same file on Windows) | 63058 | `0151a9bd` | whole | 13 |
| `layers.vbs` | 40901 | `012ff344` | whole | 10 |
| `Application\Dictionary\en\XSISCRIPTS.dict` | 22212 | `b942f52f` | whole | text of id 1132 |

Registry data: `data/command_registry.json` / `data/commands_full.json` (R). Flags are given raw (2 = in, 4 = out,
6 = in/out; bit 0x10000 = argument has a handler; other bits as in earlier notes).

## 1. Handler table

| Command | file | procedure | Status |
|---|---|---|---|
| `ConvertSelection` | selection.vbs | `ConvertSelectionProc` | SPEC |
| `ConvertSelectionToEdges` | selection.vbs | `ConvertSelectionProc` | SPEC |
| `ConvertSelectionToPoints` | selection.vbs | `ConvertSelectionProc` | SPEC |
| `ConvertSelectionToPolygons` | selection.vbs | `ConvertSelectionProc` | SPEC |
| `GetNeighborSubcomponents` | Selection.vbs | `GetNeighborsFunc` | SPEC |
| `GrowSelection` | selection.vbs | `GrowSelectionProc` | SPEC |
| `ShrinkSelection` | selection.vbs | `ShrinkSelectionProc` | SPEC |
| `SelectAdjacent` (4 entries) | selection.vbs | `SelectAdjacentProc` | SPEC |
| `SelectNSidedPolygons` (3 entries) | selection.vbs | `SelectNSidedPolygonProc` | SPEC |
| `SelectEdgeLoop` | selection.vbs | `SelectExtendEdgeLoopProc` | SPEC |
| `SelectBoundaryEdgeLoop` | selection.vbs | `SelectExtendBoundaryEdgeLoopProc` | SPEC |
| `SelectParallelEdgeLoop` | selection.vbs | `SelectExtendParallelEdgeLoopProc` | SPEC |
| `MakeAllUnselectable` ("Make All Objects Selectable") | selection.vbs | `MakeAllSelectableProc` | SPEC |
| `HideUnselected` | layers.vbs | `HideUnselectedProc` | SPEC |
| `MoveToLayer` (script entry "Move Selection to Current Layer") | layers.vbs | `MoveToCurrentLayer` | SPEC |
| `SICreateLayerFromSelection` | layers.vbs | `CreateLayerFromSelection` | SPEC |
| `SICreateLayerFromSelection2` | layers.vbs | `CreateLayerFromSelection2` | SPEC |
| `SIHideObjects` | layers.vbs | `HideObjectsProc` | SPEC |
| `SIUnhideObjects` | layers.vbs | `UnhideObjectsProc` | SPEC |
| `ToggleCurrentLayerProperty` (4 entries) | layers.vbs | `ToggleCurrentLayerProperty` | SPEC |
| `ToggleGhosting` | layers.vbs | `ToggleVisibilityParameter` | SPEC |
| `UnghostAll` | layers.vbs | `UnhideAllProc` | SPEC |
| `UnhideAll` | layers.vbs | `UnhideAllProc` | SPEC |

## 2. Shared facts

### 2.1 Cluster-to-component expansion (selection.vbs)
`SelectAdjacent`, `ConvertSelection*` and `GrowSelection` first split the input with `SIFilter`:
sub-components (`siSubComponentFilter`) and clusters (`siClusterFilter`). If any cluster is in the input:
1. user preference `SI3D_GROUP_SEL_MODE` is set to byte 0 (turns the "cluster" selection button off);
2. `SelectMembers <clusters>, False` returns the clusters' members as sub-components; they are appended to the
   sub-component list (created if empty).

### 2.2 Neighbour query, `GetNeighborsFunc(list, neighbourType, geometryType)`
For each sub-component item with a non-empty element array: take its geometry proxy (`.obj`) and its 0D / 1D / 2D
geometries. `geometryType` is the string `Point`, `Edge` or `Polygon` (any other string: no query). The query is
made on the geometry matching the item's own type:
- wanted type equals the item's type: `Neighbors0D/1D/2D(elements, 1, neighbourType)` (the third argument, the
  neighbour type, is passed only in this case);
- otherwise the cross-dimension `Neighbors0D/1D/2D(elements, 1)` (no type argument).
If neighbours come back, a new collection item is made whose value is the item's text up to and including the last
`.` followed by `pnt[0]`, `edge[0]` or `poly[0]`, and whose element array is replaced by the neighbours. Items are
gathered in a new collection. Returns that collection, or Nothing when nothing was found or the input was Nothing.
`siAdjacent` and `siGrow` are the two neighbour types used by the callers.

### 2.3 Visibility values (layers.vbs)
Group-like objects (filter `group,ObjectPartition,LightPartition,Layer`) use 3-state visibility parameters:
0 = hide members (off), 1 = show members (on), 2 = no effect on members. Scene objects use the boolean parameters
of their `visibility` property (`viewvis`, `rendvis`, `selectability`, `ghosting`, …). The pseudo parameter name
`visibility` means `viewvis,rendvis` in every procedure that accepts it.

### 2.4 Hidden polygon cluster (layers.vbs)
Polygon hiding uses the internal cluster named `siInvisiblePolygonsClusterName` (value still open, see
`cmd-b5f-misc-dsscripts.md` Q1). Lookup of that cluster on an object: if it exists but has no `clsvisibility`
local property, or its `clsvisibility.viewvis` is true, the cluster is deleted (`DeleteObj`) and treated as absent.
Hiding polygons (shared by `SIHideObjects` and the visibility toggle): for each polygon input (user clusters are
turned into a sub-component first): if the object has no valid hidden cluster, a new cluster is created from the
polygons with `CreateClusterFromSubComponent <polys>, siInvisiblePolygonsClusterName` and remembered; else in
"add" mode `SIAddToCluster <hidden cluster>, <polys>`, in "toggle" mode `SITogglePolygonVisibility <polys>`. All new
clusters then get a `Component Visibility` property (`SIAddProp "Component Visibility", <cluster>`) and their
`clsvisibility.viewvis` / `rendvis` set to False (read-only ones are skipped with the warning of 2.5). Properties
added to clusters whose name is not the hidden cluster name are inspected (`InspectObj`); for the hidden cluster
nothing is inspected.

### 2.5 Read-only visibility warning
When a scene object's `viewvis` or `rendvis` is read-only (an owning group overrides it), it is skipped; the names
of the owning groups whose same parameter is not 2 are collected (each once) and one warning is logged:
`Unable to set visibility on some parameters. The following groups are interfering:` followed by
` <name>,` per group (siWarning).

## 3. Wire contract

### `ConvertSelection`, `ConvertSelectionToEdges` / `ToPoints` / `ToPolygons`
Args (R): `InputObjs` (vt 72, Collection handler, f 0x10002), `SelFilter` (Filter handler for `ConvertSelection`;
string default `Edge` / `Point` / `Polygon` for the three fixed entries, f 2). Category Selection.
1. Expand clusters (2.1).
2. For each sub-component with elements: if its type already matches the wanted filter (`Point` ↔
   `pntSubComponent`, `Edge` ↔ `edgeSubComponent`, `Polygon` ↔ `polySubComponent`) it is kept as is; otherwise its
   `siAdjacent` neighbours of the wanted type (2.2) are added.
3. `SelectObj <result>` and `SetSelFilter <SelFilter>` are always called (the result collection always exists,
   possibly empty; an empty input therefore clears the selection *(inferred from SelectObj with an empty list)*).
Any wanted filter other than the three strings converts nothing (items of other types are dropped).

### `GetNeighborSubcomponents`
Args (R): `InputObjs` (Collection, f 0x10082), `NeighborType` (int, default 0, f 130), `SelFilter` (string, default
`""`, f 130), `Value` (return). Returns `GetNeighborsFunc(InputObjs, NeighborType, SelFilter)` (2.2), i.e. a
collection of new sub-component items or Nothing. With the default empty `SelFilter` nothing is queried and the
result is Nothing. No selection change, no clusters expansion.

### `SelectAdjacent` (Select Adjacent / … Points / … Edges / … Polygons)
Args (R): `InputObjs` (Collection), `SelFilter` (Filter handler, or `Point` / `Edge` / `Polygon`),
`ExtendSelection` (bool, default False, f 34).
1. Expand clusters (2.1).
2. `GetNeighborsFunc(list, siAdjacent, SelFilter)`.
3. If something was found: `AddToSelection <found>` when `ExtendSelection` is true, else `SelectObj <found>`; then
   `SetSelFilter <SelFilter>`. Nothing found: no change at all.

### `GrowSelection`
Args (R): `InputObjs` (Collection).
1. Expand clusters (2.1).
2. Split the sub-components into point, edge and polygon lists (by comparing each item's type with its geometry's
   0D / 1D / 2D type).
3. For each non-empty list, in the order points, edges, polygons: `GetNeighborsFunc(list, siGrow, <Point|Edge|Polygon>)`
   and, if found, `SelectObj <found>`.
Note: each `SelectObj` replaces the selection, so with a mixed input only the last non-empty type's grown set stays
selected. The selection filter is not changed.

### `ShrinkSelection`
No arguments (R).
1. `InvertSelection`, `GrowSelection` (current selection), `InvertSelection`.
2. Then for every sub-component item now selected (`SIFilter` of `SelectionList`, sub-component filter): collect
   the indices of **all** boundary edges of that object's mesh (`Edge.IsBoundary`), not only selected ones. If there
   are any: points → the boundary edges' point neighbours; edges → the boundary edges themselves; polygons → the
   boundary edges' polygon neighbours (1D-geometry neighbour queries, distance 1). These are wrapped in a
   `.pnt[0]` / `.edge[0]` / `.poly[0]` item (as in 2.2) and gathered.
3. If anything was gathered: `RemoveFromSelection <gathered>`.
So components on open borders are always dropped by a shrink.

### `SelectNSidedPolygons` (Select N-Sided / 3-Sided / 4-Sided Polygons)
Args (R): `InputObjs` (Collection), `Value` (int, default 5 / 3 / 4), `ExactEdgecount` (bool, default False / True /
True).
1. Input empty or Nothing: log `Invalid Selection. Please select one or more polygon meshes first` (info) and stop.
2. For each input: a collection item resolves to its sub-component's parent 3D object, anything else is taken as is.
   Only objects of type `polymsh` are processed: build a polygon sub-component holding every polygon whose point
   count equals `Value` (exact) or is `>= Value` (not exact).
3. For each object with at least one match: the first time only, `DeselectAll`; then `AddToSelection <sub-component>`.
4. End: some match → `SetSelFilter "Polygon"`; none → log `No such polygon found.` (selection untouched).

### `SelectEdgeLoop`, `SelectBoundaryEdgeLoop`, `SelectParallelEdgeLoop`
Args (R): `InputObjs` (Collection). Method: edge loop = 0, boundary loop = 1, parallel loop (edge ring) = 2.
The input is filtered for non-cluster edges but **not used** (the code that would extend the current selection is
disabled). The command always runs an interactive pick loop:
1. `PickElement siEdgeFilter` with left and middle prompts = translated id 1132, text
   `Select EdgeLoop  (supports Shift/Ctrl)` (two spaces, as shipped).
2. Button 0 (right click / Esc) ends the command. Otherwise, for the picked edge item: build (and cache while the
   same object keeps being picked) a point→edges table and an edge→polygons table from the geometry; compute the loop
   (below); build the string `<object>.edge[<i>,<j>,…]` (object = parent of the picked primitive) and call
   `SetSelFilter "Edge"`, then by modifier: none → `SelectObj <str>, , True`; Shift (1) → `AddToSelection <str>, ,
   True`; Ctrl (2) → `ToggleSelection <str>`; Shift+Ctrl (3) → `RemoveFromSelection <str>`; other → as none.
3. Repeat.
Loop algorithms (all start from the picked edges, walking both ends; result = all flagged edges in index order):
- **Edge loop (0)**: at the far point of the current edge, stop if more than 4 edges meet there. Among the edges at
  that point, an edge "matches" when it shares no polygon with the current edge. If a matching edge has a different
  polygon count from the current edge (border/inner mix) the walk stops at this point; otherwise the (last)
  unflagged matching edge is flagged and the walk continues from it.
- **Boundary loop (1)**: as above but if exactly 2 edges meet at the point the other one is always followed (turns
  corners); with 3–4 edges, the first matching edge with the same polygon count is followed; more than 4 stops.
- **Parallel loop / ring (2)**: walk across polygons: from the current edge go to an adjacent polygon (the other one
  of its two polygons), and in that polygon take the first edge that shares no point with the current edge; flag it
  and continue. Stops when that edge is already flagged or none exists.

### `MakeAllUnselectable` (display "Make All Objects Selectable", category Edit|Property)
No arguments. Despite the scripting name it makes everything selectable:
1. `SetValue "#Group*.selectability,Layers.List.*.selectability,Passes.List.*.*.selectability", 2` (groups, layers
   and partitions set to "no effect on members").
2. `SetValue "*.visibility.selectability", True`.

### `SICreateLayerFromSelection`
Args (R): `PresetObj` (string, default `""`, f 130), `Name` (string, `""`, f 130), `InputObjs` (Collection),
`Value` (out). `SICreateLayer PresetObj, Name`; `Value` = the new layer (`Value` of the returned arguments); if
`InputObjs` is not Nothing, `MoveToLayer <new layer>, InputObjs`. No current-layer change, no selection, no inspect.

### `SICreateLayerFromSelection2`
Args (R): as above plus `LayerGroupName` (string, `""`) and `Value` (return). `SICreateLayer2 PresetObj, Name,
LayerGroupName`; then `MoveToLayer` as above; returns the new layer.

### `MoveToLayer`, script entry "Move Selection to Current Layer"
Args (R): `Target` (string, `""`, f 134: in/out), `InputObjs` (string, `""`, f 130). The same scripting name has a
C++ entry "Move Objects To Layer" (Target, InputObjs collections). The script: `GetCurrentLayer` → its `Value` is
the current layer; `MoveToLayer <current layer>, InputObjs` (the C++ entry); then writes the current layer into
`Target` (so the log shows the layer used).

### `ToggleCurrentLayerProperty` (4 entries)
Arg (R): `PropName` (string, f 34) = `viewvis` / `selectability` / `rendvis` / `ghosting`, category Layer.
Gets the current layer (`GetCurrentLayer`), errors ignored, and cycles `<layer>.<PropName>` (2-state cycle):
- `ghosting`: 0 → 1, 1 → 2, 2 → 1;
- others: 0 → 2, 1 → 0, 2 → 0.
(Any other value: unchanged.) A non-group current layer: nothing.

### `ToggleGhosting`
Args (R): `Target` (Collection, f 0x10002), `PropertyName` (string, default `ghosting`, f 3), `ThreeState` (bool,
default False, f 3). Category Layer.
1. If `PropertyName` is `visibility`: fast path (below) and stop.
2. Groups / partitions / layers in `Target`: cycle `<group>.<each listed parameter>`: three-state 0 → 1 → 2 → 0;
   otherwise the 2-state cycle of `ToggleCurrentLayerProperty`.
3. Scene objects: for each comma-separated parameter, new value = not (current `<obj>.visibility.<p>` = True);
   `SetValue` on the object, and when the object was selected in branch also on every child (`FindChildren`, errors
   ignored), same new value.
Fast path (`visibility`): groups: `viewvis` read, the same cycle is written to `viewvis,rendvis` together; scene
objects: the new value for each object is the negation of its `viewvis`; writable `viewvis` / `rendvis` of the
object (and in branch, of every child) go into a "set" or "unset" list (read-only ones → warning 2.5); then
`SetValue <set list>, True` and `SetValue <unset list>, False`; polygons in the input are hidden in toggle mode
(2.4).

### `SIHideObjects`
Args (R): `Target` (Collection, f 0x10002), `PropertyName` (string, default `visibility`). Category Viewing.
1. `visibility` → recurse with `viewvis,rendvis`.
2. Groups / partitions / layers: each listed parameter set to 0.
3. Scene objects: each `<obj>.visibility.<p>` set to False, and in branch on every child.
4. Polygons in the input: hidden in add mode (2.4).

### `SIUnhideObjects`
Args as `SIHideObjects`. `visibility` → `viewvis,rendvis`. Groups: each parameter set to 2 (no effect); scene objects
(node / branch as above) set to True. Polygons are not handled.

### `HideUnselected`
Args (R): `Target` (Collection), `PropertyName` (string, default `visibility`).
- Input contains no polygons: `InvertSelection "object"`, `SIHideObjects , PropertyName` (on the selection),
  `InvertSelection "object"`.
- Polygons: polygon user clusters in the input are replaced in the selection by their members (each cluster's
  sub-component `AddToSelection`, then `RemoveFromSelection <clusters>`); then `InvertSelection "polygon"`,
  `SIHideObjects , PropertyName`, and `SelectGeometryComponents Target` to restore the component selection.

### `UnhideAll`, `UnghostAll`
Arg (R): `PropertyName` (string, default `visibility` / `ghosting`). No input objects.
1. `visibility` → recurse with `viewvis,rendvis`.
2. Errors ignored from here. Every partition of every pass (`Passes.list.#pass*.#group*`) and every layer
   (`Layers.list.#group*`): each listed parameter set to 2.
3. Overrides (`*.#Override*`), when any exist: keep only local ones (`FilterPSet …, siLocalPset, True`); for each
   override and parameter: if `<override>.<p>` exists, `SIRemoveEntryFromOverride <override>.<p>`; then
   `SetValue "*.visibility.<p>", True`; after its parameters, delete the override if it has no entries left
   (`DeleteObj`). (For ghosting this intermediate step writes True; step 4 corrects it.)
4. For each parameter: `SetValue "*.visibility.<p>", False` for `ghosting`, True for any other.
Objects whose visibility is hard-set by type (default camera / light) are only affected by step 4's wildcard.

## 4. Corrections for the wire agent
- `MakeAllUnselectable` makes everything **selectable** (display name "Make All Objects Selectable").
- `SelectEdgeLoop` / `SelectBoundaryEdgeLoop` / `SelectParallelEdgeLoop` ignore their input and always start a pick
  session; a batch implementation has nothing to do without picks.
- `GrowSelection` with mixed component types leaves only the last type's grown set selected.
- `ShrinkSelection` takes no argument and works on the global selection.
- `MoveToLayer` has two registry entries with the same scripting name (C++ and script); the script one writes the
  current layer back into its `Target` argument.

## 5. Open questions
| # | Question | Where to look |
|---|---|---|
| Q1 | Numeric values of `siAdjacent` / `siGrow` (meaning of `GetNeighborSubcomponents` `NeighborType` 0) | `xsi_decl.h` |
| Q2 | `siInvisiblePolygonsClusterName` value (carried from b5f Q1) | type library |
| Q3 | Does `SelectObj` with an empty collection clear the selection (`ConvertSelection` on non-component input) | golden |
