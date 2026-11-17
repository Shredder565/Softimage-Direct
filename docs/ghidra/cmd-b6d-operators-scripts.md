# CMD-B6d: operator-applying script commands in `operators.vbs` (add edge, split polygon, curve knot, trim, duplicate component, cluster centres, simulation bracket, spine, spring, GATOR burn, vertex colour datatype, symmetrize reference plane)

Row: **CMD-B6d** (batch grouped by implementing script). Status: **SPEC**.
Run: 2026-11-17, `si-analyst`, unattended.

19 scripting names (26 registry entries) implemented in VBScript in
`Application\DSScripts\operators.vbs`. Most are a thin layer that builds a
connection set, applies one operator preset, writes a few parameters and
optionally inspects / freezes. The contracts below give the call shapes, the
values written and the observable order.

| Command | Entries | Category | Procedure(s) |
|---------|---------|----------|--------------|
| `AddEdge` | 2 | Modeling, Topology | `ApplyAddEdgeFunc` (scripted), `ApplyAddEdgeProc` (key-assignable UI entry) |
| `SplitPolygon` | 2 | Modeling, Topology | `ApplySplitPolygonFunc`, `ApplySplitPolygonProc` (UI) |
| `InsertCurveKnot` | 2 | Modeling, Topology | `ApplyInsertCurveKnotOpFunc`, `ApplyInsertCurveKnotOpProc` (UI) |
| `DuplicateMeshComponent` | 3 | Modeling, Topology | `DuplicateComponentFunc`, `DuplicateComponentProc` (UI "Multiple"), `DuplicateComponentNoAutoInspectProc` (UI "Single") |
| `MeshSubdivideWithCenter` | 1 | Modeling | `MeshSubdivideWithCenterProc` |
| `DuplicateUsingGeomApprox` | 1 | Edit | `DuplicateUsingGeomApprox` |
| `TrimWith` | 1 | Modeling | `TrimWithProc` |
| `Convert` | 1 | (none) | `Convert` |
| `CreateClusterCenter` | 1 | Deformation | `CreateClusterCenterProc` |
| `CreateClusterCenterWithNull` | 2 | Modeling, Deformation | `CreateClusterCenterWithNullProc` (message box), `CreateClusterCenterWithNullFunc` (log only) |
| `CreateNonOverlappingCluster` | 1 | Cluster | `CreateNonOverlappingClusterProc` |
| `CreateSimulationBracket` | 1 | Edit | `CreateSimulationBracketProc` |
| `ApplyDeformBySpine` | 2 | Deformation | `ApplyDeformBySpineProc` (interactive), `ApplyDeformBySpineFunc` |
| `ApplySpringOp` | 1 | Simulation | `ApplySpringOpProc` |
| `InspectSpringPropertiesProc` | 1 | Simulation | `InspectSpringPropertiesProc` |
| `BurnAndDeleteGATOROperator` | 1 | Modeling | `BurnAndDeleteGATOROperator` |
| `ChangeVertexColorDatatype` | 1 | VertexColor | `ChangeVertexColorDatatypeFunc` |
| `SetSymmetrizePolygonOpRefPlane` | 1 | Modeling, Topology | `SetSymmetrizePolygonOpRefPlane` |
| `SetRefPlaneFromSymmetrizePolygonOp` | 1 | Modeling, Topology | `SetRefPlaneFromSymmetrizePolygonOp` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | display names, arguments, defaults, argument handlers, direction flags, `return_value`, key-assignable flag, description |
| (S) | `operators.vbs`: the listed procedures and the helpers they call (`FApplyTopoOp`, `FApplyGenOp`, `FApplyOp`, `FApplySelectedOp`, `FSubComponents2Clusters`, `FCreateClusterCenter`, `FCreateClusterCenterWithNull`, `GetAverageClusterPosition`, `MakeObjectSimulatedProc`, `MakeOneObjectSimulatedProc`, `GetOutputConnections`, `GetConnectedOperator`, `ReadGenInputMgmtUserPref`, `FCloneConnectionSetList`, `FGetParentObj`, `SIMsgBox`), read from the install | steps, constants, logged texts, called commands |
| (D) | `xsiscripts_dict.txt` (decoded `XSISCRIPTS.dict`, incomplete) | texts of ids 1092 and 1095 |
| - | binaries, XSIBATCH goldens, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts. None of the commands the handlers call (`ApplyOperator`,
`GetConnectionSet`, `AutoInspect`, `FreezeModeling`, ...) is in
`COMMAND_DLL_MAP.md` yet; they are referenced by name and call shape only.

## Shared facts

### Registry flags (R)

Argument direction: 2 = input, 4 = output, 6 = in/out. All entries are enabled
with no enable condition.

| Command (display name), procedure | Key-assignable | Registry says "returns a value" | Procedure actually returns (S) |
|-----------------------------------|----------------|---------------------------------|--------------------------------|
| `AddEdge` (Add Edge), Func | no | yes | operators, or nothing in immediate mode |
| `AddEdge`, Proc | yes | yes | operators |
| `SplitPolygon` (Split Polygon), Func | no | yes | operators, or nothing in immediate mode |
| `SplitPolygon`, Proc | yes | yes | operators |
| `InsertCurveKnot` (Insert Curve Knot), Func | no | yes | operators, or nothing in immediate mode |
| `InsertCurveKnot`, Proc | yes | yes | operators |
| `DuplicateMeshComponent` (Duplicate Mesh Component), Func | no | **no** | operators / nothing (value is produced but the registry discards it) |
| `DuplicateMeshComponent` (Duplicate Multiple Mesh Component) | yes | no | nothing |
| `DuplicateMeshComponent` (Duplicate Single Mesh Component) | yes | no | nothing |
| `MeshSubdivideWithCenter` (PolyMesh Subdivide With Center) | yes | no | nothing |
| `DuplicateUsingGeomApprox` (Duplicate Using Geometry Approximation) | yes | yes | collection of new objects |
| `TrimWith` (Trim With) | no | no | nothing |
| `Convert` (Convert) | no | no | nothing |
| `CreateClusterCenter` (Deform by Cluster Center with Nulls Creation) | no | yes | collection (see Q3) |
| `CreateClusterCenterWithNull` (same display name), both entries | no | yes | collection of operators |
| `CreateNonOverlappingCluster` (Create Non-Overlapping Cluster) | yes | **yes** | nothing (procedure has no result) |
| `CreateSimulationBracket` (Create Simulation Bracket) | no | yes | always 0 |
| `ApplyDeformBySpine` (Deform by Spine), both entries | no | yes | result of `SIApplyDeformBySpine` |
| `ApplySpringOp` | no | no | nothing (outputs through arguments) |
| `InspectSpringPropertiesProc` (Inspect Spring Properties) | yes | no | nothing |
| `BurnAndDeleteGATOROperator` (Burn GATOR Operator) | no | no | nothing |
| `ChangeVertexColorDatatype` (Change VertexColor Datatype) | no | yes | collection with the operator |
| `SetSymmetrizePolygonOpRefPlane`, `SetRefPlaneFromSymmetrizePolygonOp` | no | **yes** | nothing (procedures have no result) |

The only registry description texts: `ApplyDeformBySpine` (Func entry) "Set
both the PropWeightMapBySpine and DeformBySpine operators on selected
objects"; `DuplicateUsingGeomApprox` "Duplicates the selected object based on
the subdivided geometry (poly meshes)".

### Translated texts (D), dictionary `XSISCRIPTS`

| Id | Constant in the script | Text | Used by |
|----|------------------------|------|---------|
| 1092 | `IDS_CREATE_CLUSTER_MSG` | Please tag some points or select a cluster first. | the cluster centre commands |
| 1094 | `IDS_TRIM_MSG_L` | not decoded | `TrimWith`, left-button prompt |
| 1095 | `IDS_TRIM_MSG_M` | Deselect Curve To Trim With | `TrimWith`, middle-button prompt |
| `"Warning"` (string key) | - | not decoded (inferred: Warning) | message box title of the cluster centre commands |

### Operation mode (S)

"Immediate" versus "persistent" is the enum `siOperationMode`
(`siPersistentOperation`, `siImmediateOperation`). The UI ("Proc") entries of
`AddEdge`, `SplitPolygon`, `InsertCurveKnot`, `DuplicateMeshComponent` and
`MeshSubdivideWithCenter` **ignore the value passed in `ImmediateMode`**: they
read the user preference `OperationMode` (`GetUserPref "OperationMode"`),
set the argument to immediate when it is true and to persistent otherwise,
and hand that value back through the in/out argument (so the logged command
line shows the mode really used). The scripted ("Func") entries honour the
argument as given.

Freezing is always `FreezeModeling <operators>, , siUnspecified` (time omitted).

### Topology apply helper, `FApplyTopoOp` (S)

Used by `AddEdge`, `SplitPolygon`, `InsertCurveKnot`, `DuplicateMeshComponent`.
Inputs: preset name, connection set, connect type, operation mode, an
"interactive" flag and a "disable auto-inspect" flag. All four commands call
it with connect type `siUnspecified` (branch flag), **persistent** mode and
auto-inspect **disabled**, and handle inspect / freeze themselves. Contract in
that configuration:

1. If the preference `preferences.modeling.constructionmodeautoupdate` is
   true, `SetValue "context.constructionmode", siConstructionModeModeling`.
   The previous construction mode is not restored.
2. `GetConnectionSet <preset>, <inputs>, siGroupLevel, <connect type>,
   <interactive>, True` (create output objects), which returns the list of
   resolved connection sets and the output objects. With interactive = true
   this command may start a pick session for missing inputs; with false it
   does not. There is no guard for an empty result: the next step then fails
   with a script error *(inferred)*.
3. The operator class id of the first connection set is compared (case
   insensitive) with six ids; on a match, and when the input is not an empty
   string, the inputs are removed from the selection first
   (`RemoveFromSelection <inputs>`). The script's own remark names delete
   component, collapse component, delete trim, remove knot (curve and
   surface) and delete curve point. Ids:
   `{6C8F2060-4849-11d4-A8B6-00C04F8EDF15}`,
   `{F67ACF91-5602-4a0c-9B6B-904E62F1A1AF}`,
   `{6142FBB2-D293-11d3-B496-009027BC38D5}`,
   `{06BF49F0-E62D-11d2-A968-00A024190119}`,
   `{992F08E0-7BBE-11d0-A88E-00A024190119}`,
   `{88EC8342-268E-11d4-97F3-0800360BFF02}`.
4. A clone of every connection set is taken and converted to text; this text
   is what UI entries write back into their `ConnectionSet` in/out argument
   (so the logged command carries the fully resolved inputs).
5. One `ApplyOperator <preset>, <connection set>, <connect type>` per
   connection set; the created operators are collected in order.
6. Output objects are mapped to their owning 3D objects (first `X3DObject`
   in each item's path) because clusters returned before a topology change
   are no longer valid.

Result: the collection of created operators. (The helper also has an
immediate branch that inspects and freezes each operator in turn; no command
of this batch uses it.)

### Generator apply helper, `FApplyGenOp` (S)

Used by `MeshSubdivideWithCenter` and `DuplicateUsingGeomApprox`. Inputs:
preset, preferred geometry (empty here), inputs, connect type, operation mode,
input disposal mode (`siGeneratorInputsDisposalMode`: `siKeepGenOpInputs`,
`siHideGenOpInputs`, `siDeleteGenOpInputs`), interactive flag, auto-translate
flag. Contract:

1. `GetConnectionSet <preset>, <inputs>, siGroupLevel, <connect type>,
   <interactive>, True` (the surface-from-curves variant
   `GetSurfaceFromCurvesConnectionSet` is used only when a preferred geometry
   is given). Empty result: return nothing, no operator, no message.
2. Clone the connection sets for logging.
3. `ApplyOperator <preset>, <set>, <connect type>` for every connection set.
4. Persistent mode together with `siDeleteGenOpInputs` is not allowed: log
   warning `siPersistentOperation ignored with siDeleteGenOpInputs, switching
   to siImmediateOperation` and continue as immediate.
5. For delete or hide disposal, collect the inputs concerned with
   `GetGeneratorInputsForDisposal <operators>, <mode>, <out list>` (before any
   freeze).
6. Immediate mode only: `AutoInspect <operators>` (a cancel there aborts the
   rest), then `FreezeModeling` of the operators that still exist (an operator
   already frozen through the inspector's "Delete Inputs" button is skipped),
   then drop from the output list the automatic objects of each connection
   set.
7. Auto-translate: for the i-th output object, read `kine.local.posx/posy/posz`
   of the input named by the i-th connection set and `Translate <output>, dx,
   dy, dz, 0` (so the generated object sits where its input sits).
8. `DeleteObj <inputs>` for delete disposal, `HideAndUnselect <inputs>` for
   hide disposal.

Result: the operators (those not yet frozen in the immediate case) and, as an
output, the generated objects.

### Deformer apply helper, `FApplyOp` (S)

Used by `CreateClusterCenter`. Inputs: preset, connection set, connect type,
operation mode, interactive flag, construction mode. Contract:

1. `GetConnectionSet` as above (interactive flag passed through; create
   outputs true). Empty result: return nothing.
2. If the first resolved set's full name starts with `Environments`, the
   operator is applied on the set item itself and the logged clone is its
   full name; otherwise the normal connection set object is used.
3. Remember `context.constructionmode`. If a construction mode was given and
   it is not `siConstructionModeDefault`, set `context.constructionmode` to
   it.
4. `ApplyOperator` once per connection set. Only when the operation mode is
   immediate **and** the current construction mode is
   `siConstructionModeModeling`: `AutoInspect` the operators, `FreezeModeling`
   them, and drop automatic objects from the outputs.
5. Restore the remembered construction mode.

Result: the collection of operators.

### Tagged components to clusters, `FSubComponents2Clusters` (S)

Splits an input list into sub-component items (tagged components) and the
rest (`SIFilter <list>, siSubComponentFilter` with include true / false). If
there are sub-components, one call `CreateClusterFromSubComponent
<sub-components>` turns them into real clusters. Result: the non-sub-component
items followed by the new clusters; outputs: the new clusters and the original
sub-component items. Callers then remove the sub-component items from the
selection.

### `SIMsgBox` (S)

In an interactive session it is a plain message box (prompt, buttons, title).
Otherwise it logs `<title>: <prompt>` (info) and returns the supplied default
answer.

## Wire contract

### `AddEdge`

Purpose: insert a vertex on an edge / connect to make a new edge, through the
`AddEdge` operator preset.

| Argument | Scripted entry | UI entry | Dir |
|----------|----------------|----------|-----|
| `ConnectionSet` | handler ConnectionSet, no default | `""` | in (scripted), in/out (UI) |
| `Ratio` | 0.0 | 0.0 | in |
| `ImmediateMode` | `siPersistentOperation` | `siPersistentOperation` | in (scripted), in/out (UI) |
| `NewPointID` | 0 | 0 | out |
| `NewEdgeID` | 0 | 0 | out |

Common steps:

1. `NewPointID` and `NewEdgeID` are preset to -1.
2. Topology apply helper with preset `AddEdge`; interactive = false for the
   scripted entry, true for the UI entry.
3. For each created operator: `SetValue "<op>.ratioedge", Ratio`.
4. Only when exactly one operator was created: force an evaluation by reading
   `<owner of the operator>.polymsh` with `GetValue`, then read
   `<op>.newptid` and `<op>.newedgeid` into the two outputs. With several
   operators both outputs stay -1.

Scripted entry: in immediate mode freeze the operators and return nothing;
otherwise return the operators. No inspection, `ConnectionSet` not rewritten.

UI entry: operation mode taken from the preference (see Shared facts);
`ConnectionSet` rewritten with the resolved text; `AutoInspect <operators>`;
then freeze when immediate; returns the operators in both modes. The
procedure has one more parameter ("disable auto-inspect") than the registry
has arguments, so it is never supplied and inspection always happens
*(inferred: an unsupplied parameter reads as false)*; see Q1.

### `SplitPolygon`

Same shape as `AddEdge`, with preset `SplitPolygon`.

| Argument | Default | Dir |
|----------|---------|-----|
| `ConnectionSet` | handler ConnectionSet (scripted) / `""` (UI) | in / in-out |
| `TanX`, `TanY`, `TanZ` | 0.0 | in |
| `SplitPolygonType` | `siByTheVertices` (`siSplitPolygonType`) | in |
| `ImmediateMode` | `siPersistentOperation` | in / in-out |
| `NewPointID` | 0 | out |

Per created operator, in this order: `tanx`, `tany`, `tanz`, `splittype` are
set from the arguments. With exactly one operator the owner's `polymsh` is
evaluated and `<op>.newptid` is returned in `NewPointID`; otherwise it is -1.
Scripted / UI differences (mode source, `ConnectionSet` write-back,
`AutoInspect`, freeze, return value, the extra unsupplied "disable
auto-inspect" parameter) are exactly those of `AddEdge`.

### `InsertCurveKnot`

Preset `InsertNurbsCrvKnot`.

| Argument | Scripted entry | UI entry | Dir |
|----------|----------------|----------|-----|
| `ConnectionSet` | handler ConnectionSet | `""` | in / in-out |
| `Multiplicity` | **1** | **3** | in |
| `ImmediateMode` | `siPersistentOperation` | `siPersistentOperation` | in / in-out |

Topology apply helper (interactive false / true), then `SetValue
"<op>.Multiplicity", Multiplicity` on each operator. Scripted entry: freeze
and return nothing in immediate mode, else return the operators. UI entry:
mode from the preference, `ConnectionSet` rewritten, freeze when immediate,
returns the operators. **Neither entry inspects the operator.**

### `DuplicateMeshComponent`

Purpose: duplicate / extrude polygon mesh components with the
`ExtrudeComponentAxis` operator.

| Argument | "Duplicate Mesh Component" (scripted) | "Duplicate Multiple" (UI) | "Duplicate Single" (UI) |
|----------|---------------------------------------|---------------------------|-------------------------|
| `ConnectionSet` | handler ConnectionSet, in | `""`, in/out | `""`, in/out |
| `ImmediateMode` | `siPersistentOperation`, in | same, in/out | same, in/out |
| `Length` | 0.0 | 1.0 | 0.0 |
| `NbSubdivs` | 0 | 5 | 0 |
| `Merge` | true | true | true |
| `Tx`, `Ty`, `Tz` | 0.0, in | 0.0, in/out | 0.0, in |
| `Rx`, `Ry`, `Rz` | 0.0, in | 0.0, in/out | 0.0, in |
| `Sx`, `Sy`, `Sz` | 1.0, in | **0.0**, in/out | 1.0, in |
| `DuplicatePolygons` | false, in | false, in/out | false, in |

Common core: topology apply helper with preset `ExtrudeComponentAxis`, then on
every created operator, in this order, `SetValue` of `subdivs` (NbSubdivs),
`length`, `merge`, `sx`, `sy`, `sz`, `rx`, `ry`, `rz`, `tx`, `ty`, `tz`,
`duplicate` (DuplicatePolygons).

Scripted entry: interactive = false, arguments used as given; immediate mode
freezes; no inspection.

Both UI entries first **replace** the transform arguments:

- `NbSubdivs` = 0: scale (1,1,1), rotation (0,0,0), translation (0,0,0);
- otherwise: the nine values of `Preferences.Duplicate.Transform.Sx` ... `Tz`
  (the Duplicate Multiple options).

`DuplicatePolygons`:

- "Multiple": always replaced by the test `Preferences.Duplicate.polygons = 0`;
- "Single": replaced by the same test only when the caller passed false; a
  true from the caller is kept.

Then: mode from the `OperationMode` preference, core with interactive = true,
`ConnectionSet` rewritten with the resolved text, and

- "Multiple": `AutoInspect <operators>`, then freeze when immediate;
- "Single": no inspection, freeze when immediate.

The "Single" procedure writes the replaced transform and duplicate values
back to its caller although the registry marks them as plain inputs.

### `MeshSubdivideWithCenter`

| Argument | Default | Dir |
|----------|---------|-----|
| `PresetObj` | `MeshSubdivideWithCenter` | in |
| `ConnectionSet` | `""` | in/out |
| `ConnectType` | 3 (`siUnspecified` branch flag) | in |
| `ImmediateMode` | `siPersistentOperation` | in/out |
| `GenOpInputsDisposal` | `siKeepGenOpInputs` | in/out |

1. Operation mode from the `OperationMode` preference (argument ignored).
2. Input disposal from preferences (argument ignored): if `AutoInspectEnabled`
   reports true, `siKeepGenOpInputs`. Otherwise read the preference
   `modeling.geninputmgt`: 0 keep, 1 hide, 2 delete. With 2 and a persistent
   mode, the mode becomes immediate for this call and the `OperationMode`
   preference is set to 1 temporarily.
3. Generator apply helper with the preset, the connection set, the connect
   type, interactive = true, auto-translate = true.
4. `ConnectionSet` is rewritten with the resolved text (empty text when the
   helper produced nothing).
5. `SelectObj <generated objects>` when there are any.
6. `AutoInspect <operators>` when operators exist and the mode is persistent
   (in immediate mode the helper already inspected before freezing).
7. If step 2 changed the preference, `SetUserPref "OperationMode", 0`.

Both in/out arguments report the mode and disposal really used.

### `DuplicateUsingGeomApprox`

Argument `InputObjs` (Collection, selection when empty, in). Returns the
collection of new objects.

1. Keep polygon meshes only (`SIFilter <input>, "polygon_mesh"`). None: log
   `You need to select one or more polygon meshes first.` (info), return
   nothing.
2. For each mesh read the `gapproxmosl` parameter (subdivision level) of its
   `geomapprox` property.
3. Level 0: `Duplicate <obj>, , 2, 1, 1, 0, 0, 1, 0, 1` (number of copies
   left to its default 1; then History = 2, Hierarchy = 1, Grouping = 1,
   Properties = 0, Animation = 0, Constraints = 1, Selection = 0, Xfrom = 1),
   then `FreezeObj` each copy and add it to the result.
4. Level above 0: generator apply helper with preset
   `MeshSubdivideWithCenter`, the mesh as input, connect type 3, persistent,
   keep inputs, interactive = false, auto-translate = true. If it yields an
   operator and an object: set the operator's `SubdivisionRule` from
   `<obj>.polymsh.subdrule`, `SubdivisionDepth` to the level, `useloop` from
   `<obj>.polymsh.subdloop`; `TransferAllPropertiesAcrossGenOp <op>, <new
   object>, , True`; `FreezeObj <new object>`; add the object (looked up again
   by its name after the freeze) to the result.
5. `SelectObj <result>`; return it.

The original is left untouched; the copy is a frozen mesh whose base geometry
is the subdivided surface.

### `TrimWith`

Purpose: choose the surface curves a trim uses, interactively or from a list.

| Argument | Handler | Dir |
|----------|---------|-----|
| `InputObjs` | Collection | in/out |
| `TrimWithSrfCrv` | Collection | in/out |

`InputObjs` is read as a comma-separated list of items that each own a
`trimwithmode` parameter *(inferred: the trim operators)*. Values written to
it: 0 = trim with none (shows all projected curves), 2 = trim with the given
curves.

When `TrimWithSrfCrv` is empty (interactive path):

1. For each item, remember `trimwithmode` and set it to 0.
2. `SetSelFilter "SurfaceCurve"`, `DeselectAll`.
3. Pick loop: `PickElement "SurfaceCurve"` with left prompt 1094 and middle
   prompt 1095. Left button: `AddToSelection <picked>`; middle button:
   `RemoveFromSelection <picked>`; button 0 (right button / Escape) ends the
   loop.
4. The current selection (`GetValue "SelectionList"`) becomes the curve list
   and is written back to `TrimWithSrfCrv`.
5. If the selection is empty, the remembered `trimwithmode` values are put
   back and nothing else happens. Defect to reproduce or avoid knowingly: the
   remembered-value store never grows beyond one slot, so with two or more
   items the first item receives the last item's old value and the restore of
   the second item fails with a script error *(inferred from the store's
   growth logic; single-item case is correct)*.

When `TrimWithSrfCrv` is given, it is used as is (no picking, no mode reset).

Then, in both paths: `TrimWithSrfCrv` is converted to its text form. If the
curve list is not empty, the sub-element indices of every list item of type
`srfcrvSubComponent` are concatenated in list order into one index array;
other items are ignored. If at least one index was gathered:
`SITrimWith <InputObjs>, <index array>, True` (registered as `siTrimWith`,
"Low Level Trim With", arguments `InputObjs`, `TrimWithCrvIndexArray`,
`TrimWithGlobalToLocalBool`), then `trimwithmode` = 2 on every item.

Finally `DeselectAll`, always. The selection filter stays on `SurfaceCurve`.

### `Convert`

Arguments `Target`, `Source` (both default `""`, in). Calls `SIConvert
Target, Source` and reads its two outputs `CreatedObj` and `OutputObj`. If
`OutputObj` exists: `SelectObj <OutputObj>`. If `CreatedObj` exists:
`AutoInspect <CreatedObj>`. No return value. The conversion itself is
`SIConvert` (C++).

### `CreateClusterCenter`

Purpose: apply a `ClusterCenter` deformer to clusters, driven by nulls that
are supplied, created or picked.

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObjs` | Collection (selection when empty) | - | in |
| `S3D_CMDARG_NULLLIST` | Collection | - | in/out |
| `SupplyMode` | - | true | in |
| `ConstructionMode` | ConstructionMode | - | in |

1. Empty input: log text 1092 (info), show it in a message box (OK button,
   exclamation icon, title `"Warning"` translated; see `SIMsgBox`), return
   nothing.
2. Tagged components are converted to clusters (shared helper) and removed
   from the selection; then only clusters are kept (`SIFilter` with
   `siClusterFilter`; clusters already in the input are kept). No cluster:
   same message as step 1.
3. Single-null case, when `SupplyMode` is true and there is more than one
   cluster: one null is created up front for all clusters. If all clusters
   belong to objects with the same **name**, it is `SIGetPrim "Null",
   "<object name>_ClsCtr", "<object name>"` (child of that object, addressed
   by bare name); otherwise `SIGetPrim "Null", "ClsCtr"` (under the scene
   root).
4. For each cluster, by index i in list order, choose the driving null:
   - `SupplyMode` true and i is at or beyond the number of supplied nulls:
     compute the cluster centre in global space. The owner's global
     transform is rebuilt from `kine.global` position, rotation (XYZ Euler
     angles, degrees) and scaling. Per cluster element: polygon cluster,
     the polygon's centre position; edge cluster, the edge's average
     position; any other type, the point position. The centre is the mean of
     the transformed element positions. Outside the single-null case a null
     named `<owner>_<cluster name>_ClsCtr` is created as a child of the owner
     (`<owner>` is the owner's path text) and moved with `Translate <null>,
     x, y, z, 0`. In the single-null case the shared null is moved once, when
     the last cluster is processed, to the sum of the computed centres
     divided by the **total** number of clusters.
   - i is below the number of supplied nulls: the i-th supplied null is used
     (no object is created or moved).
   - otherwise (`SupplyMode` false and no null left): the connection set is
     built with the cluster only and the deformer apply helper runs
     interactively, so `GetConnectionSet` asks the user to pick the null.
5. Each cluster is applied separately: deformer apply helper with preset
   `ClusterCenter`, a two-group connection set (group 1 the cluster, group 2
   the null), connect type `siUnspecified`, persistent mode, the given
   construction mode.
6. Picked nulls are appended to the list of all nulls. If the **last** cluster
   was resolved by picking, `S3D_CMDARG_NULLLIST` is replaced by the supplied
   nulls followed by all picked nulls (so the logged command can be replayed
   without picking).
7. If nothing was applied: message of step 1. Otherwise `DeselectAll`,
   `SelectObj <all nulls: supplied, created, picked>`, then `AutoInspect
   <result>`.

Returns the collected results of the per-cluster applications (see Q3 for
its exact item type).

### `CreateClusterCenterWithNull`

Purpose: one new null driving all given clusters.

Arguments `InputObjs` (Collection, selection when empty, in) and
`ConstructionMode` (ConstructionMode handler, in). Two entries with the same
arguments:

| Entry | On empty input / no cluster | After success |
|-------|-----------------------------|---------------|
| `...Proc` | log `CreateClusterCenter: ` + text 1092 (info) and message box (OK, exclamation, title `"Warning"`) | select the null, `AutoInspect <operators>` |
| `...Func` | log `CreateClusterCenter: Please tag some points or select a cluster first.` as **error**, no box | select the null, no inspection |

Common steps:

1. Tagged components to clusters, removed from the selection; keep clusters
   only. None: failure path above, nothing returned.
2. Null name and parent, decided on the owning 3D objects of the clusters
   (compared by identity):
   - one cluster: `<object name>_<cluster name>_ClsCtr`, child of the object;
   - several clusters on one object: `<object name>_ClsCtr`, child of it;
   - clusters on several objects: `ClsCtr`, under the scene root.
   Created with `SIGetPrim "Null", <name>[, <object full name>]`.
3. Position: for each cluster, the average of its components in object space
   (point cluster: mean of the point positions; edge, polygon and subsurface
   clusters: mean over components of each component's mean point position;
   any other cluster type, or an empty cluster, contributes nothing), mapped
   to world space with the owner's global transform. The null's target is
   the sum of these divided by the number of clusters (clusters that
   contributed nothing still count in the divisor). `Translate <null>, x, y,
   z, 0`, done before applying so the operator's rest snapshot is valid.
4. Read `context.constructionmode`, set it to `ConstructionMode`
   (unconditionally), apply `ApplyOperator "ClusterCenter", <cluster ; null>,
   siUnspecified` once per cluster in list order, then restore the previous
   construction mode.
5. `DeselectAll`, `SelectObj <null>`.

Returns the collection of created `ClusterCenter` operators, one per cluster.

### `CreateNonOverlappingCluster`

Argument `InputObjs` (Collection, selection when empty, in). Purpose: from the
tagged components, make a cluster of only those components that belong to no
existing cluster of the same type.

1. Missing input: log `Tag some components first` (info) and stop.
2. Tagged components are converted to temporary clusters (shared helper).
   Only these are processed; clusters passed directly are not *(inferred:
   with no tagged component in the input the temporary list is unset and the
   command ends in a script error)*.
3. `DeselectAll`.
4. For each temporary cluster: rename it `tagged_nonoverlap` (so its default
   name does not influence the final cluster's name) and remember its full
   name; find the owning object; for each of its elements, in order, look
   through every cluster of that object's geometry that has the **same type**
   and a name different from the temporary one, and keep the element only if
   none of them contains it.
5. If at least one element was kept: add a cluster of the same type with the
   default name and exactly the kept elements, through the geometry's
   object-model `AddCluster` (not a logged command), and
   `AddToSelection <new cluster>`.
6. After all: `RemoveCluster <temporary clusters>`.

If every tagged component is already in a cluster, nothing is created and the
selection ends empty. No return value despite the registry flag.

### `CreateSimulationBracket`

Argument `ConnectionSet` (ConnectionSet handler, in). Purpose: make objects
"simulated": add the simulation region markers and the evolve operator to
their construction history. Always returns 0.

1. Simulation environment: the scene's active simulation environment; if
   there is none, `CreateEnvironment "Environment"` followed by
   `AddContainerToEnvironment <env>, "Force", 1, "Forces"`. Its simulation
   time control is used below.
2. Keep from the input what passes `SIFilter` with the object, group and
   property filters combined.
3. Each kept item is treated at node level (no recursion into children; the
   helper has a branch mode that other commands use):

| Item | Checks | Operators applied when missing (in this order) |
|------|--------|-----------------------------------------------|
| 3D object that is not a null | needs an unevaluated primitive (`GetUnevaluatedPrimitiveForConstructionHistory`), else nothing. If any operator of type `MixerOp` is in its construction history: log error `The object <object> has a mixer connected. Cannot add a simulated ICE tree.` and skip the object. Presence is tested by looking up `SimulationMarker`, `PostSimulationMarker`, `Evolve` in the construction history. | `ApplyOp "SimulationMarker", <object>`; `ApplyOp "PostSimulationMarker", <object>`; evolve (below) with a settings property |
| Null | needs the unevaluated primitive. Presence is tested on the primitive's outgoing connections by operator type: `simulationmarker`, `postsimulationmarker`, `presimulationmarker`, `Evolve`. | `PrimitiveSimulationMarker`, `PrimitivePostSimulationMarker`, `PrimitivePreSimulationMarker`, evolve |
| Property of type `ICEProperty` | same test on the property's outgoing connections | `ICEPropertySimulationMarker`, `ICEPropertyPostSimulationMarker`, `ICEPropertyPreSimulationMarker`, evolve |
| anything else (groups included) | - | nothing |

Evolve step, when no evolve operator is present:

- make sure the item's model has a cache in the environment
  (`FindCacheForModel`); if not, `CreateEnvironmentCache <model>, <env>` and
  name it `<model name>_<environment name>_Cache`;
- non-null 3D objects only: add a property with `SIAddProp
  "SimulationSettings", <object>, , "Simulation Settings"`;
- `ApplyOp "EvolveOp", "<target>;<target>;<time control>;<cache>"`, where
  `<target>` is the unevaluated primitive (objects, nulls) or the ICE
  property itself; for non-null 3D objects a fifth group holds the new
  Simulation Settings property.

Non-null 3D objects get no pre-simulation marker. The outgoing connections of
nulls and ICE properties come from the data repository's connection stack
description (entries of kind `out`); while scanning them the script logs one
info line `checking : <operator>, type: <type>` per connection examined,
which is visible in the history for those two item kinds.

### `ApplyDeformBySpine`

| Argument | Interactive entry (`...Proc`) | Scripted entry (`...Func`) |
|----------|-------------------------------|----------------------------|
| `ConnectionSet` | `""`, in/out | handler ConnectionSet, in |
| `ConstructionMode` | handler ConstructionMode, in | same |

1. For every group of the connection set, tagged components are converted to
   clusters (shared helper); the group is replaced by the converted content
   and the new clusters are recorded as automatic objects of the connection
   set.
2. `SIApplyDeformBySpine <connection set>, <interactive>, <ConstructionMode>`
   with interactive = true for the first entry and false for the second. This
   C++ command applies both the spine weight-map operator and the deform
   operator and does any picking.
3. Automatic objects of the connection set are kept on it after the call.
4. If clusters were created in step 1: `RemoveFromSelection <tagged
   components>` then `AddToSelection <new clusters>` (errors of the latter
   are ignored).
5. Interactive entry only: `AutoInspect <result>` when there is one.

Returns the result of `SIApplyDeformBySpine`. (The same helper serves the
flexible envelope and deform-by-cage commands with `SIApplyFlexEnv` and
`SIApplyDeformByCage`; not in this row.)

### `ApplySpringOp`

| Argument | Default | Dir |
|----------|---------|-----|
| `InputObjs` | Collection handler; item 0 = driven object ("effector"), item 1 = anchor ("root") | in/out |
| `Mass` | 20.0 | in |
| `LinearStiffness` | 100.0 | in |
| `LinearDamping` | 100.0 | in |
| `SpringCache` | `""` | in/out |
| `OutputObjs` | - | out |

1. If `SpringCache` is empty, add an action source named `SpringCacheSource`
   to the driven object's model (object model call) and return its full name
   in `SpringCache`.
2. Rest offset: translation of the driven object's global pose expressed in
   the anchor's global space.
3. `ApplyOp "SpringOp", <InputObjs>`; the first returned item is the spring
   operator.
4. Parameters set on it, in order: `Mass`; `LinearStiffness`; `LinearDamping`;
   `AngularStiffness` = LinearStiffness; `AngularDamping` = LinearDamping;
   `RestPosX/Y/Z` = rest offset; `InitialStatePosX/Y/Z` = rest offset;
   `InitialStateVelX/Y/Z` = 0.
5. On the operator's nested time control: `simtimectrl.playmode` = 2
   (interactive), `simtimectrl.SynchWithSceneStart` = true,
   `simtimectrl.SynchWithSceneEnd` = true.
6. `ApplyOp "EvolveOp", "<driven>.kine.global;<driven>.kine.global;<spring
   op>.simtimectrl;<SpringCache>"`.
7. `OutputObjs` = a collection holding the spring operator only.

No validation of the input count, no selection change, no inspection.

### `InspectSpringPropertiesProc`

Argument `InputObjs` (Collection, selection when empty, in).

1. Gather all scene objects of class id
   `{3FD4FBAA-D329-4950-8193-35AABCB98294}` (spring operators) and then of
   `{CBB627A6-84EC-42A3-894D-09F78FCF0293}` (evolve operators) with
   `FindObjects`.
2. Walk that list from last to first. For an operator with a first output
   port, the driven object is the owner of the kinematic state the port
   writes. For each input item in order: locate the input item under the
   scene root by name, then look for the driven object among that item's
   direct children (non-recursive lookup). On the first match add
   `<driven object>.kine.global` to the inspection list and go to the next
   operator.
3. `InspectObj <inspection list>` (called even when the list is empty).

So the input is meant to be the parent node(s) of spring-driven objects, and
what opens is the global kinematics page(s) carrying the spring / evolve
operators. No return value.

### `BurnAndDeleteGATOROperator`

Arguments `InputObj` (in) and `OutputObjs` (registry: out). Helper used by the
generator-freeze procedures (`FreezeModeling` path) before they delete
generator inputs. Despite its name it deletes nothing itself.

1. If `InputObj` is not of type `TransferAttributes` (the GATOR operator): do
   nothing.
2. If the operator's owning 3D object has fewer than two envelopes: do
   nothing (the only envelope is GATOR's own).
3. The GATOR cluster is the first owner of the operator that is a cluster;
   the GATOR envelope is that cluster's first envelope.
4. For every **other** envelope of the object and every deformer of the GATOR
   envelope: read the envelope's weights for that deformer, overwrite each
   element whose GATOR weight is non-zero with the GATOR weight (zero GATOR
   weights leave the existing value), and write them back with the
   non-normalising setter (`SetDeformerWeights2`). Element index i of the
   GATOR envelope is written to index i of the other envelope.
5. Append the GATOR cluster to `OutputObjs`. The caller deletes it later,
   which removes the GATOR operator and its envelope operator.

`OutputObjs` must already be a collection when the command is called (the
procedure appends to it), which contradicts the registry's output-only flag.

### `ChangeVertexColorDatatype`

| Argument | Handler | Default | Dir |
|----------|---------|---------|-----|
| `InputObj` | Collection | - | in |
| `DesiredDatatype` | - | 0 | in |
| `OutputObjs` | - | - | out |

1. Validation; each failure logs `Invalid VertexColor property` (error) and
   raises `siErrCancelled`: input is not a non-empty collection; its first
   item is not of type `vertexcolor`; the item's `datatype` parameter cannot
   be read.
2. If `<property>.datatype` already equals `DesiredDatatype`: log `The CAV is
   already using the specified datatype. There is no need to install an
   operator` (info) and return nothing (no error).
3. `ApplyOp "VertexColorChangeDatatype", <property>`. Empty result: log `Could
   not install the Vertex Color conversion operator` (error), raise
   `siErrCancelled`.
4. `SetValue "<operator>.desireddatatype", DesiredDatatype`.
5. `OutputObjs` and the return value are the collection returned by
   `ApplyOp`.

Only the first item of the input is processed.

### `SetSymmetrizePolygonOpRefPlane`, `SetRefPlaneFromSymmetrizePolygonOp`

Two mirror-image commands linking a `symmetrizepolygonop` operator's custom
symmetry plane to a named reference plane.

| Command | Argument 1 | Argument 2 |
|---------|------------|------------|
| `SetSymmetrizePolygonOpRefPlane` | `InputObjs` (Collection, in) | `RefPlane` (default `Transform`, in) |
| `SetRefPlaneFromSymmetrizePolygonOp` | `RefPlane` (default `Transform`, in) | `InputObjs` (Collection, in) |

Common steps:

1. Keep operators only (`SIFilter <input>, "Operator"`). None, or any kept
   item whose type is not `symmetrizepolygonop`: log `This command must be
   applied on a SymmetrizePolygon operator.` (info) and stop.
2. `RefPlane` equal to `View`, `XY`, `XZ` or `YZ` (exact spelling): log `The
   input reference plane cannot be View, XY, XZ or YZ.` (info) and stop.
3. `SetCurrentReferencePlane "RefPlanes.<RefPlane>"`, then `SetUserPref
   "3D_TRANSFO_REFERENTIAL_CHANGED", 7` (activates reference-plane transform
   mode).
4. For each operator: `symmetryreference` = 0 and `symmetryplane` = 3, then
   seven values are copied one by one with `GetValue` / `SetValue`:

| Operator parameter | Reference plane parameter (`RefPlanes.<RefPlane>.`) |
|--------------------|-----------------------------------------------------|
| `planeposx`, `planeposy`, `planeposz` | `posx`, `posy`, `posz` |
| `planerotx`, `planeroty`, `planerotz` | `rotx`, `roty`, `rotz` |
| `planenormal` | `normal` |

`SetSymmetrizePolygonOpRefPlane` copies from the reference plane to the
operator; `SetRefPlaneFromSymmetrizePolygonOp` copies from the operator to the
reference plane (with several operators the last one wins). Neither returns a
value although the registry says so.

## Enable conditions and errors

No registry enable condition on any entry. Summary of script-level failures:

| Command | Condition | Result |
|---------|-----------|--------|
| `ChangeVertexColorDatatype` | invalid input / operator not installed | error log, `siErrCancelled` raised |
| `CreateSimulationBracket` | mixer operator on the object | error log, object skipped, command still returns 0 |
| `CreateClusterCenter`, `CreateClusterCenterWithNull` | no cluster / tagged component | text 1092 (info + box, or error log for the Func entry), nothing returned |
| `CreateNonOverlappingCluster`, `DuplicateUsingGeomApprox`, symmetrize pair | wrong / missing input | info log, command ends normally |
| topology commands | connection set cannot be resolved | no script guard; failure comes from `GetConnectionSet` / the next statement *(inferred)* |

Interactive parts (`TrimWith` picking, the pick of a null in
`CreateClusterCenter` with `SupplyMode` false, `GetConnectionSet` picking in
the UI entries, `AutoInspect`, the message boxes) need a user session; under
batch `SIMsgBox` degrades to a log line as described, the others are not
exercised *(inferred; no XSIBATCH run)*.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | UI entries of `AddEdge` and `SplitPolygon`: the procedures take one more parameter ("disable auto-inspect") than the registry lists. Is a hidden argument registered, and what does the procedure receive when it is not supplied? | command registration in the binary / `.dsdll` resource; golden with auto-inspect on |
| Q2 | Text of dictionary id 1094 (`TrimWith` left prompt) and of the `"Warning"` string key | complete decode of `XSISCRIPTS.dict` |
| Q3 | `CreateClusterCenter` return value: the per-cluster result of the apply helper is stored by value, not by reference, before being collected. What does the caller get (operators, or their names resolved again), and what happens when the pick is cancelled and the helper returns nothing? | golden (`TypeName` of the result items; cancel a pick) |
| Q4 | `Translate <null>, x, y, z, 0` in both cluster centre commands: meaning of delta mode 0 (relative, by the type library order, inferred) and where a new null created under a parent sits before the move. Decides whether the null lands on the centre when the parent is not at the origin. | type library; golden with an offset parent |
| Q5 | `CreateClusterCenter` single-null case: the null is addressed and parented by bare object name, and the null name in the per-cluster case is built from the owner's path text. How are names resolved / sanitised for objects inside a model? | golden with a mesh under a model |
| Q6 | Which operators carry the six class ids that make the topology helper clear the selection; do any of `AddEdge`, `SplitPolygon`, `ExtrudeComponentAxis`, `InsertNurbsCrvKnot` match? | operator SPDL / preset class ids |
| Q7 | `TrimWith`: exact kind of object expected in `InputObjs` (owner of `trimwithmode`), meaning of mode value 1, and behaviour of `siTrimWith` with its third argument true | SPDL of the trim operator; binary pass on `siTrimWith` |
| Q8 | Enum values of `datatype` / `desireddatatype` on vertex colour properties and of `SplitPolygonType`, `symmetryplane` = 3, `symmetryreference` = 0, spring `playmode` = 2 | SPDL of the property / operators |
| Q9 | Contracts of the delegated commands: `GetConnectionSet`, `ApplyOperator`, `ApplyOp`, `AutoInspect`, `FreezeModeling`, `SIConvert`, `SIApplyDeformBySpine`, `GetGeneratorInputsForDisposal`, `TransferAllPropertiesAcrossGenOp`, `CreateClusterFromSubComponent`, `GetUnevaluatedPrimitiveForConstructionHistory`, environment commands | their own rows |
| Q10 | Symbolic names for the numeric `Duplicate` options used by `DuplicateUsingGeomApprox` (2, 1, 1, 0, 0, 1, 0, 1) | type library enums `siDupHistory` ... `siDupTransform` |
| Q11 | `InspectSpringPropertiesProc` with no matching spring: what `InspectObj` does with an empty list | golden |

Q1 to Q11 concern registration details, dictionary gaps, enum values or
delegated commands; the script-level behaviour of all 19 commands is fully
read.
