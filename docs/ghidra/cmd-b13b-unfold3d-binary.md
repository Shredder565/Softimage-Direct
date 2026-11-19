# CMD-B13b: Unfold3D add-on plug-in commands, read from `Unfold3D.64.dll` (UnfoldAddToCut, UnfoldAdjustUpdate, UnfoldApply, UnfoldApplySel, UnfoldClearCut, UnfoldPackUpdate, UnfoldRegularize, UnfoldRelax, UnfoldRemoveFromCut, UnfoldSelectCut, UnfoldSetCut, UnfoldUpdate)

Row: **CMD-B13b**. Status: **SPEC** (12 names). The unfold / pack / relax solver itself is described only at the level of inputs, flags and outputs (see 2.6); no command contract depends on its internals beyond "runs the solver with these parameters".
Run: 2026-11-19, si-analyst worker, unattended, batch 13 (binary first, REA + Ghidra on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll`, image base `0x180000000`, 882176 bytes,
sha256 `97d9684848a86c44534551d1bcbf235032e5ed73efec9b7094c9c2fdec1becf6` (export-directory timestamp 1391622891 = 2014-02-05).
Method: `inspect_native_exports` (59 named exports), then Ghidra 12.1.4 decompilation of `XSILoadPlugin`, the `_Init`s that
carry arguments, every `_Execute` in the row, the shared helpers they use (cut-line worker, optimize-operator applier, target
expansion, per-object record builder, cut-cluster lookup/creation, texture-projection lookup, "has UVs" test, PPG relabel,
InspectObj wrapper, the solver driver `0x180020a00` down to its call list), the four `_Define` callbacks
(`UnfoldProperty`, `UnfoldCutTagProperty`, `UnfoldOperator`, `UnfoldOptimizeOperator`) and `UnfoldProperty_DefineLayout`.
Option-flag values passed into the solver driver were read from the instruction stream (register `R8D` at each call site), not guessed.
Arguments are cross-checked against `data/commands_full.json` (all 12 entries carry `file` = this DLL; names, handlers and defaults agree).
Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

Display name = scripting name for every command (each is registered with a single name string).

| Command (scripting name) | Display name | _Init | _Execute | key helpers |
|---|---|---|---|---|
| `UnfoldApply` | UnfoldApply | `0x180015130` | `0x180014940` | `0x180013c60` (expand to meshes), `0x180013990` (owner object), `0x180014600` (property host), `0x18001d590` (records), `0x18000cc40`, `0x18001e1c0` |
| `UnfoldApplySel` | UnfoldApplySel | `0x180016670` | `0x180016320` | runs `UnfoldApply`; `0x18001f010` (InspectObj) |
| `UnfoldAddToCut` | UnfoldAddToCut | `0x180017ba0` | `0x180017b60` | `0x180016d50` (cut worker, mode "Add"), `0x1800132f0`, `0x18001e710`, `0x18000e770`, `0x180020a00` |
| `UnfoldRemoveFromCut` | UnfoldRemoveFromCut | `0x1800186f0` | `0x1800186b0` | `0x180016d50` (mode "Remove") |
| `UnfoldSetCut` | UnfoldSetCut | `0x180018970` | `0x180018930` | `0x180016d50` (mode "Set") |
| `UnfoldClearCut` | UnfoldClearCut | `0x180018510` | `0x180017de0` | `0x18001d590`, `0x18000e770`, `0x180020a00` |
| `UnfoldSelectCut` | UnfoldSelectCut | `0x180027500` | `0x180026dc0` | `0x180026580` (drop selected edges), `0x18001e7e0` (find cut cluster), `0x180012b30` |
| `UnfoldUpdate` | UnfoldUpdate | `0x180027ae0` | `0x180027740` | `0x180020a00` (solver driver) |
| `UnfoldPackUpdate` | UnfoldPackUpdate | `0x18001b0d0` | `0x18001ae50` | `0x180020a00` |
| `UnfoldAdjustUpdate` | UnfoldAdjustUpdate | `0x1800143a0` | `0x180014090` | `0x180020a00` |
| `UnfoldRegularize` | UnfoldRegularize | `0x180015f00` | `0x180015ec0` | `0x1800152c0` (optimize-operator applier, option "Regularize") |
| `UnfoldRelax` | UnfoldRelax | `0x180016130` | `0x1800160f0` | `0x1800152c0` (option "Relax") |

## 2. Shared facts

### 2.1 Plug-in registration (`XSILoadPlugin` `0x180012480`)

- Licence gate first: if the Unfold3D licence check (`IsUnfold3DEnabled`, imported) fails, it logs `Unfold3D license is unvailable.` (sic) and returns failure `0x80004005`; nothing is registered.
- Author `Remi Arquier, Georges Varouchas`; email `support@unfold3d.com`; URL `http://www.unfold3d.com/`; version major 1 (minor not recovered); plug-in name built as `Unfold3D Plugin ` + a version/build string.
- Registers, in order: operators `UnfoldOperator`, `UnfoldOptimizeOperator`; commands `UnfoldApply`, `UnfoldApplySel`, `UnfoldAddToCut`, `UnfoldRemoveFromCut`, `UnfoldSetCut`, `UnfoldClearCut`, `UnfoldSelectCut`, `UnfoldUpdate`, `UnfoldPackUpdate`, `UnfoldAdjustUpdate`, `UnfoldRegularize`, `UnfoldRelax`; menus `UnfoldProjectionMenu` (anchor 0x12), `UnfoldTextureSpaceProjectionMenu` (anchor 0x10cc), `UnfoldTextureEditorMenu` (anchor 0xfa0), all non-dynamic; properties `UnfoldCutTagProperty`, `UnfoldProperty`.
- Exported but **not registered** by `XSILoadPlugin`: `UnfoldParameters_Init/_Execute` and `UnfoldSelectCutAndSel_Init/_Execute` (dead or registered by another path; not in `commands_full.json`).
- All 12 commands: return value enabled. `UnfoldApply` and `UnfoldApplySel` additionally clear one command flag (`SetFlag(?, false)`; which flag was not resolved, probably the undo/log flag).

### 2.2 Common argument validation for UnfoldProperty arguments

A property argument passes when its reference is a custom property (class id `0x3d`) **and** its type is `UnfoldProperty`. Messages and codes differ per command (listed per contract). Most commands take a *collection* of UnfoldProperties and stop at the first bad item (earlier items have already been processed).

### 2.3 Target expansion (`0x180013c60`)

Given any reference, adds polygon-mesh objects to a list:
- group (class `0x44`): recurse into its members;
- subcomponent collection whose `Type` is `edgeSubComponent`, `polySubComponent`, `pntSubComponent` or `sampleSubComponent`: its `Parent3DObject`, if that object's type is `polymsh`;
- 3D object (class `0x48`): itself if `polymsh`;
- cluster property (class `0x3a`, a texture projection): the 3D object owning its cluster's primitive;
- anything else: ignored.

### 2.4 Per-object records (`0x18001d590`)

Every command that touches an UnfoldProperty first rebuilds a record per target mesh. Targets are the expansion (2.3) of the property's **parent** (object or group). For each target mesh, a record holds {object, texture projection, sample cluster, cut-line edge cluster}:
1. Cut cluster: an edge cluster of the mesh carrying an `UnfoldCutTagProperty` whose `UnfoldPropertyID` equals the property's `UnfoldPropertyID` (inferred for the tag test, helper `0x18001f140` unread). If none, it creates an empty edge cluster named `Unfold_CutLine` and adds to it a `UnfoldCutTagProperty` named `UnfoldCutTag` (branch flag true) with `UnfoldPropertyID` set to the property's ID. Failure shows a modal message box titled `Unfold3D Mesh Topo Error` ("Unfold3D Plugin Error : Softimage internal couln't create an edge cluster on that mesh : " + mesh full name) and aborts with an empty record list.
2. Texture projection: if the caller passed explicit texture projections and one sits on the same primitive, that one is used and a new `UnfoldOperator` is connected to it (output port = the projection, inputs = the projection and the UnfoldProperty).
3. Otherwise it looks for an existing `uvspace` cluster property on any sample cluster of the mesh that is driven by an `UnfoldOperator` whose input is this UnfoldProperty; if found it is reused, nothing is created.
4. Otherwise it creates a sampled-point cluster `Texture_Coordinates_AUTO` (complete, no explicit indices), adds a `Texture Projection` property named `Unfold` on it, sets every UV element to 0, and connects a new `UnfoldOperator` (output = that projection, inputs = the projection and the UnfoldProperty). Failure to create the cluster shows the same message-box title with "...couln't create an sample point cluster on that mesh : ...".

"Has UVs" test (`0x18000cc40`): true when any record's texture projection is valid and contains at least one non-zero component.

### 2.5 Cut-line helpers

- Edge filtering (`0x1800132f0`): the edge-list argument is reduced with the `Edge` filter applied to the `SubComponent` filter's subset; fails when nothing remains.
- Island frontiers from UVs (`0x18000e770`, mode 4): for every record, computes the edges that are UV-island borders of the current texture projection and runs `SIAddToCluster` to add them to the record's cut cluster (inferred: border computation `0x18000dc90` not decompiled). Applied before the edit when the Options argument equals exactly `AddIslandFrontiersFromUVCoords`.

### 2.6 Solver driver (`0x180020a00`) and option flags

Input: one UnfoldProperty and a flag word. Steps: licence check (fail: log `Unfold3D license is unvailable.`, `0x80004005`); rebuild records (2.4); rebuild the solver mesh if the record set changed; topology refresh (mode 7, or mode 2 when flag `0x20`); collect pinned UVs from each projection's pin component array; optionally take the current selection as island selection (flag `0x8`); read `UnfoldSignature`; then:

| Flag | Meaning | Parameters read |
|---|---|---|
| `0x01` | unfold (with island-selection restriction when `0x08` also set) | - |
| `0x02` | adjust / regularize, restricted to selected samples | `Adjust_power`, `Adjust_iterations` |
| `0x10` | relax, restricted to selected samples | `Relax_power`, `Relax_iterations` |
| `0x04` | pack | `Pack_spacing`, `Pack_islandrotation`, `Pack_globalrotation`, `Pack_packrandomseed`, `Pack_sortordertype`, `Pack_angleincrement`, `Pack_uvlayoutscalingmode`, `Pack_scalingmode`, `Pack_useboxpacking`, `Pack_squareresol` (in this order) |
| `0x08` | use selection as island selection | - |
| `0x20` | refresh only (cut-line edits) | - |

Afterwards it writes the new signature to `UnfoldSignature`, writes UVs back to the texture projections, and relabels the property page (2.8) by the "has UVs" test. Returns success.

Flag words per caller: `UnfoldUpdate` 1, or 5 when Options contains `DoPack`, plus 8 when it contains `UseIslandSelection` (substring tests, case-sensitive); `UnfoldPackUpdate` 4; `UnfoldAdjustUpdate` 2, or 0x10 when Options contains `DoRelax`; cut commands 0x20.

### 2.7 `UnfoldProperty` (custom property, `_Define` `0x180021910`)

| Parameter | Type | Default | Range (min..max / suggested) | Capabilities |
|---|---|---|---|---|
| `UnfoldPropertyID` | int4 | random: `rand()` after `srand(seed from 0x180020310)` (inferred time-based seed) | none | persistable (4); description "Unfold texture support identifier" |
| `Adjust_iterations` | int4 | 1 | 1..50 / 1..15 | 4 |
| `Adjust_power` | double | 1.0 | 0.01..1.0 / 0.01..1.0 | 4 |
| `Relax_iterations` | int4 | 1 | 1..50 / 1..15 | 4 |
| `Relax_power` | double | 1.0 | 0.01..1.0 / 0.01..1.0 | 4 |
| `Pack_spacing` | double | 0.01 | 0..1 / 0..1 | 4 |
| `Pack_islandrotation` | double | 0 | 0..360 / 0..360 | 4 |
| `Pack_globalrotation` | double | 0 | 0..360 / 0..360 | 4 |
| `Pack_packrandomseed` | int4 | 0 | 0..32767 / 0..32767 | 4 |
| `Pack_sortordertype` | int4 | 1 | 0..3 / 0..3 | 4 |
| `Pack_angleincrement` | double | 90 | 0..360 / 0..360 | 4 |
| `Pack_uvlayoutscalingmode` | int4 | 0 | 0..3 / 0..3 | 4 |
| `Pack_scalingmode` | int4 | 1 | 0..1 / 0..1 | 4 |
| `Pack_useboxpacking` | bool | false | - | 4 |
| `Pack_squareresol` | double | 0.5 | 0..4 / 0..4 | 4 |
| `UnfoldSignature` | string | "" | - | 4 |
| `Pack_live` | bool | false | - | 0x80 only (not persistable) |
| `Connected_operators` | string | "" | - | 4 |

Layout (`_DefineLayout` `0x180022ee0`), help file `<FactoryPath>/Doc/<DocLangPref>/XSI/xsidocs.chm::/texmaps_props_Unfold.htm`:
- Tab `Unfold`: group `Unfold Cut Line` with buttons `AddToCutLineBtn` "Add to Cut Line", `RemoveFromCutLineBtn` "Remove from Cut Line", `UseEdgeSelectionBtn` "Set from Current Edges", `SelectCutLineBtn` "Select Cut Line"; group `Update UV` with buttons `UnfoldAndPack` "Unfold and Pack" and `Unfold` "Unfold No Pack".
- Tab `Pack`: group `Packing options` (`Pack_live` "Live packing", button "Pack"); group `Island Order` (`Pack_sortordertype` "Pieces" combo: Increasing in size 0, Decreasing in size 1, Random order 2; `Pack_packrandomseed` "Random seed"); group `Island Positioning` (`Pack_spacing` "Spacing"; `Pack_squareresol` "Positioning" combo: Coarse 4.0, Standard 0.5, Precise 0.1, Very precise 0.02); group `Island Orientation` (`Pack_islandrotation` "Rotation offset"; `Pack_angleincrement` "Rotation accuracy" combo: Disabled 0, Half turn (180) 180, Perpendicular (90) 90, Average (5) 5, Precise (1) 1); group `Island Scaling` (`Pack_scalingmode` "Scale reference" combo: Use boundary length 0, Use surface area 1); group `Post Operations` (`Pack_globalrotation` "Global rotation"; `Pack_uvlayoutscalingmode` "Global scaling" combo: Best fit 0, Squarify 1, Metric conservation 2; `Pack_useboxpacking` "Box packing").
- Context attribute `Refresh` = true.
- All labels are passed through translation with the `XSISPDLFILE` table.

### 2.8 Page relabel (`0x18001e1c0`)

When the property has no UVs yet: button `Unfold` disabled, labelled "Unfold No Pack"; `UnfoldAndPack` labelled "Unfold and Pack". When it has UVs: `Unfold` enabled, labelled "Update No Pack"; `UnfoldAndPack` labelled "Update and Pack".

### 2.9 Other definitions

- `UnfoldCutTagProperty` (`0x180016740`): one parameter `UnfoldPropertyID`, int4, capabilities 0xe, no default given (empty value), description "Unfold texture support identifier".
- `UnfoldOperator` (`0x180018bb0`): parameter `UnfoldPropertyID` int4 default -1; always-evaluate set. Ports are added at connection time (2.4). Its `_Update` (`0x18001a820`) is shared with the optimize operator's `_Init`/`_Term` (a no-op stub address) - the live UV write is done by the solver driver, not by the update (inferred).
- `UnfoldOptimizeOperator` (`0x180019f00`): `Iterations` int4 default 2, range 0..10000, suggested 0..10 (description "Application algorithm number"); `Power` double default 1.0, range 0..1 (description "Power of application"); always-evaluate set. `UnfoldRelax`/`UnfoldRegularize` add three string parameters at creation (2.10).

### 2.10 Optimize-operator applier (`0x1800152c0`)

Used by `UnfoldRelax` and `UnfoldRegularize` with option string `Relax` / `Regularize`:
1. Arg 0 must be a cluster property (class `0x3a`), else log "UnfoldApplyOptimizeOperator : argument 0 must be a Texture Projection (ClusterProperty of SampleCluster)", `0x80070057`.
2. Its parent must be a cluster (class `0x43`), else log "UnfoldApplyOptimizeOperator : Parent of arg 0 is not a Cluster : " + class name, `0x80070057`.
3. The cluster's parent must be a primitive (class `0x37`), else log "UnfoldApplyOptimizeOperator : Grand Parent of arg 0 is not a Primitive " + class name, `0x80070057`; and its geometry must be a polygon mesh, else log a message built from "Unfold" + geometry class name (text " : Grand Parent of arg 0 is not a Primitive of type PolygonMesh. Given object's type : ") and `0x80070057`.
4. Creates an `UnfoldOptimizeOperator`; adds string parameters `SampleSelectionSet` = text of arg 1, `SamplePinnedSet` = text of arg 2, `Options` = `Relax` or `Regularize` (each created with default " ").
5. Output port `TextureProjection` = the projection; input ports `TextureProjection` (the projection), `SampleCluster` (its cluster), `Primitive` (the primitive). Names the operator, connects it. Connect failure: log "UnfoldApplyOptimizeOperator : Failed to Connect UnfoldOptimizeOperator.", `0x80004005`.
6. Runs `InspectObj` on the new operator (first argument only), returns the operator.

## 3. Contracts

### `UnfoldApply`: SPEC
Wire contract:
- Args: `Object(s) and/or group(s) and/or Texture Projection(s)` (Collection handler, no default).
- Return: array of the created `UnfoldProperty` objects (may be empty).
- Steps:
  1. Licence check; fail: log `Unfold3D license is unvailable.`, return `0x80004005`.
  2. Split the inputs: texture projections (class `0x3a`) go to a projection list, everything else to a target list.
  3. For each projection whose owning object is not already among the expanded (2.3) targets, add that owning object to the target list.
  4. If the target list is empty: log "Unfold3D: Nothing unfoldable selected... Please select some object(s) and/or group(s) and/or Texture Projection(s) and retry" and return success with nothing created.
  5. For each target whose expansion contains at least one polygon mesh: resolve the host (object stays object, group stays group, subcomponent/projection becomes its owning object) and add an `UnfoldProperty` named `Unfold` to it; build records (2.4) passing the projection list (creates cut clusters, reuses the given projections or creates `Texture_Coordinates_AUTO` + `Unfold` projection, connects `UnfoldOperator`s); relabel its page (2.8).
  6. Return the property list.
- Errors: only the licence failure; record-creation failures show a message box but the property is still returned (inferred).
- (inferred) A group target receives one property that drives every mesh member.

### `UnfoldApplySel`: SPEC
Wire contract:
- Args: none.
- Return: none set by the handler (return value enabled but not filled).
- Steps: if the selection is empty, log "Unfold3D: Nothing selected... Please select some object(s) and/or group(s) and/or Texture Projection(s) and retry", return success. Otherwise runs `UnfoldApply` with the selection's text as the single argument; on success runs `InspectObj` on each returned property with arguments (property, empty, `Unfold3D parameters`, 3, false) (3 = modal mode as in other plug-ins (inferred)).
- Errors: `UnfoldApply` failure status is returned as is.

### `UnfoldAddToCut`: SPEC
Wire contract:
- Args: `UnfoldProperty` (SingleObj), `EdgeList(s)` (Collection), `Options` default `AddIslandFrontiersFromUVCoords`.
- Return: none set.
- Steps (shared cut worker `0x180016d50`, mode `Add`):
  1. Validate arg 0 (2.2); fail: log "Unfold: argument 1 must be an UnfoldProperty property", `0x80070057`.
  2. Filter arg 1 to edge subcomponents (2.5); none: log "Unfold: could not find edge subcomponents in argument 2", `0x80070057`.
  3. If Options equals `AddIslandFrontiersFromUVCoords`: rebuild records and add current UV-island borders to every cut cluster (2.5).
  4. For each edge collection: find or create the object's cut cluster for this property's ID (2.4 step 1; failure returns `0x80004005`), then run `SIAddToCluster(cluster, edges)`. Failure: log "Unfold3D: SIAddToCluster failed in UnfoldAddToCut_Execute", return that status.
  5. Rebuild records; if the property already has UVs, run the solver driver with flag `0x20` (refresh) and return its status; else success.

### `UnfoldRemoveFromCut`: SPEC
Wire contract: same as `UnfoldAddToCut` except step 4 runs `SIRemoveFromCluster(cluster, edges)`; failure message "Unfold3D: SIRemoveFromCluster failed in UnfoldRemoveFromCut_Execute". Options default `AddIslandFrontiersFromUVCoords` (so island borders are first added, then the given edges removed).

### `UnfoldSetCut`: SPEC
Wire contract:
- Args: as `UnfoldAddToCut` but `Options` default "" (no island-border pass by default).
- Steps: as `UnfoldAddToCut`, but step 4 per edge collection: runs `SIRemoveFromCluster(cluster, cluster.CreateSubComponent())` (empties the cluster), then `SIAddToCluster(cluster, edges)`. Failure messages "Unfold3D: SIRemoveFromCluster failed in UnfoldSetFromCut_Execute" / "Unfold3D: SIAddToCluster failed in UnfoldSetToCut_Execute".
- (inferred) With several edge collections on the same object, each one clears the cluster again, so only the last collection survives. If Options is `AddIslandFrontiersFromUVCoords` the island borders added first are also cleared on every object that has an edge collection.

### `UnfoldClearCut`: SPEC
Wire contract:
- Args: `UnfoldProperty(s)` (Collection), `Options` default "".
- Return: none set.
- Steps, per property: validate (2.2; fail: log "Unfold: argument 1 must be UnfoldProperty property collection", `0x80004005`, stop); rebuild records; for each record empty its cut cluster with `SIRemoveFromCluster(cluster, cluster.CreateSubComponent())` (failure: log "Unfold3D: SIRemoveFromCluster failed in UnfoldSetFromCut_Execute", return the status); if Options equals `AddIslandFrontiersFromUVCoords`, add the UV-island borders back (2.5); if the property has UVs, run the solver driver with flag `0x20` and stop on failure.
- Success at the end.

### `UnfoldSelectCut`: SPEC
Wire contract:
- Args: `UnfoldProperty` (SingleObj), `Object(s)` (Collection), `Options` default `AddIslandFrontiersFromUVCoords`.
- Return: none set.
- Steps:
  1. Validate arg 0; fail (either test): log "Unfold: argument 1 must be an UnfoldProperty property", `0x80070057`.
  2. If Options equals `AddIslandFrontiersFromUVCoords`: add UV-island borders to the cut clusters (2.5). Note this edits the scene even though the command only "selects".
  3. Objects: arg 1; if empty, the expansion of the property's parent (2.3).
  4. For each item resolving to a valid 3D object: remove that object's edge subcomponents from the current selection (helper `0x180026580`); find the cut cluster tagged with the property's ID (lookup only, no creation); if found, add an edge subcomponent of those cluster elements on the object to the selection.
  5. Runs `SetSelFilter("Edge")`. Returns success.

### `UnfoldUpdate`: SPEC
Wire contract:
- Args: `UnfoldProperty(s)` (Collection), `Options` default `DoPack`.
- Return: none set.
- Steps: flags = 1 (unfold); if Options contains `DoPack` flags = 5; if it contains `UseIslandSelection` add 8. Per property: validate (fail either test: log "Unfold: argument 1 must be UnfoldProperty property", `0x80004005`, stop); run the solver driver (2.6) with the flags; stop on failure.
- Observable: UVs of every target's projection recomputed (unfolded along the cut line, pinned UVs respected; packed into 0..1 when `DoPack`); `UnfoldSignature` updated; page relabelled to "Update ..." labels.

### `UnfoldPackUpdate`: SPEC
Wire contract:
- Args: `UnfoldProperty(s)` (Collection).
- Steps: per property: validate (not a custom property: log "Unfold: argument 1 must be an array of UnfoldProperty"; wrong type: log "Unfold: argument  1 must be an array of UnfoldProperty" (two spaces); both `0x80070057`, stop); run the solver driver with flag 4 (pack only, using the `Pack_*` parameters).

### `UnfoldAdjustUpdate`: SPEC
Wire contract:
- Args: `UnfoldProperty(s)` (Collection), `Options` default `DoRegularize`.
- Steps: flags = 2 (adjust with `Adjust_power` / `Adjust_iterations`); if Options contains `DoRelax`, flags = 0x10 instead (relax with `Relax_power` / `Relax_iterations`). Both restrict the operation to the samples in the current selection. Per property: validate (failure returns `0x80004005` **without** a log message); run the solver driver; stop on failure.

### `UnfoldRegularize`: SPEC
Wire contract:
- Args: `Texture Projection` (SingleObj), `Samples to Regularize` (no default), `Pinned Samples` default "".
- Return: the new `UnfoldOptimizeOperator`.
- Steps: optimize-operator applier (2.10) with `Options` = `Regularize`, `SampleSelectionSet` = text of arg 1, `SamplePinnedSet` = text of arg 2; then `InspectObj` on the operator.
- Errors: as 2.10. No licence check in this path.

### `UnfoldRelax`: SPEC
Wire contract: same as `UnfoldRegularize` with `Options` = `Relax`; args `Texture Projection`, `Samples to Relax`, `Pinned Samples` (default "").

## 4. Open questions

- Plug-in minor version and the exact version string appended to `Unfold3D Plugin ` were not recovered.
- Which command flag `UnfoldApply` / `UnfoldApplySel` clear (`SetFlag(?, false)`) is unresolved.
- `UnfoldOptimizeOperator_Update` (`0x18001a840`) and `UnfoldOperator`'s evaluation were not decompiled: how the optimize operator consumes `Iterations` / `Power` and the selection strings is described only at the contract level.
- Cut-tag match test (`0x18001f140`) and island-border extraction (`0x18000dc90`) bodies were not read; their roles are inferred from names, call context and data flow.
- `UnfoldProperty_PPGEvent` (`0x180026060`) was not read: which commands each PPG button runs (expected `UnfoldAddToCut`, `UnfoldRemoveFromCut`, `UnfoldSetCut`, `UnfoldSelectCut`, `UnfoldUpdate`, `UnfoldPackUpdate`) is unconfirmed, as are the texture-editor menu callbacks.
- The `0x180026580` selection cleanup is read at summary level (removes edge subcomponents of the given object from the selection).
