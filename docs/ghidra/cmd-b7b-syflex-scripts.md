# CMD-B7b: Syflex add-on script commands (`Addons\Syflex30X50`: cloth, forces, collisions, constraints, cache, state, get/set of operator clusters)

Row: **CMD-B7b** (batch grouped by implementing add-on). Status: **SPEC** (44 commands), **SPEC-PARTIAL** (3 commands).
Run: 2026-11-17, `si-analyst`, unattended.

47 scripting names: 46 implemented in VBScript in seven self-installing plugin
files of the Syflex add-on, plus one C++ command (`SyCmdSaveCache`) in
`syCmd.64.dll` that one of the scripts calls. Every script command takes no
arguments, works on the current selection, changes the selection as a side
effect and returns nothing. Almost all of them are a thin layer that finds the
`syCloth` operator of the selected mesh, creates clusters / weight maps / nulls,
applies one Syflex operator preset and writes one or two parameters.

`SyCreateCloth` was **not in the task list** but is registered by `cloth.vbs`
and present in the registry dump; it is documented here.

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (S) | `Addons\Syflex30X50\Application\Plugins\`: `cache.vbs`, `cloth.vbs`, `collid.vbs`, `constr.vbs`, `force.vbs`, `getset.vbs`, `state.vbs`, read from the install on 2026-11-17 | registrations, steps, constants, operator names, parameter names, values |
| (R) | `data/commands_full.json` | 47 entries: display name, handler name, category, argument list, flags |
| (D) | `Application\Dictionary\en\EXTSYFLEX.dict` (11 entries, decoded here) | message texts of ids 1000 to 1010 |
| (B) | `syCmd.64.dll`: `strings` (ASCII and UTF-16) only | export names, registered names, argument names, import list |
| - | XSIBATCH goldens, disassembly, SDK reference pages | not used for this batch |

No script text is reproduced. Names, ids, message strings and values are
recorded as facts. `data/spdl/spdl.json` holds **no** Syflex operator (no name
starting `sy` followed by a capital, no "Syflex" text), and the add-on folder
ships only the eight files above: no SPDL, no preset, no operator binary, no
toolbar, no menu file. The operators the scripts apply are therefore not
attested by anything in this install (see Dependencies).

## Plugin files and what they register (S)(R)

Every plugin registers with author `Syflex`, empty e-mail and URL, version 1.0.
**No plugin registers a menu, a property, an event or a filter**: there are no
menu anchor ids and no menu item labels to record. No command has an `_Init`
callback, so no command declares arguments or a return value.

The handler name is the display name with spaces removed, followed by
`_Execute` (confirmed by the registry `handler` field for every entry).

| Plugin file | Plugin name | Display name → scripting name |
|-------------|-------------|-------------------------------|
| `cloth.vbs` | `syCloth` | Create Cloth → `SyCreateCloth`; Create Skin → `SyCreateSkin`; Create Flesh → `SyCreateFlesh`; Get Spring Map → `SyGetSpringMap`; Set Spring Map → `SySetSpringMap`; Get Mass Map → `SyGetMassMap`; Set Mass Map → `SySetMassMap`; Clear All Cache → `SyClearAllCache`; Clear Cache → `SyClearCache`; Save Cache → `sySaveCache` |
| `force.vbs` | `syForce` | Add Gravity → `SyCreateGravity`; Add Damp → `SyCreateDamp`; Add Air → `SyCreateAir`; Add Wind → `SyCreateWind`; Add Turbulence → `SyCreateTurbulence`; Add Volume → `SyCreateVolume`; Create Spring → `SyCreateSpring`; Create Zipper → `SyCreateZipper` |
| `collid.vbs` | `syCollid` | Collide Mesh → `SyCreateCollideMesh`; Self Collide → `SyCreateSelfCollide`; Get Collide Mesh → `SyCollideGetMesh`; Collide Sph → `SyCreateCollideSph`; Collide Pla → `SyCreateCollidePla` |
| `constr.vbs` | `syConstr` | Create Nail → `SyCreateNail`; Create Pin → `SyCreatePin`; Create Mimic → `SyCreateMimic`; Set Constraint Map → `SySetConstraintMap` |
| `getset.vbs` | `syGetSet` | Get Nail → `SyGetNail`; Set Nail → `SySetNail`; Get Pin → `SyGetPin`; Set Pin → `SySetPin`; Get Mimic → `SyGetMimic`; Set Mimic → `SySetMimic`; Get Cloth Points → `SyGetCollidePnts`; Set Cloth Points → `SySetCollidePnts`; Get Collide Polys → `SyGetCollidePols`; Set Collide Polys → `SySetCollidePols`; Get Self Polys → `SyGetSelfCollidePols`; Set Self Polys → `SySetSelfCollidePols`; Get Pin Mesh → `SyPinGetMesh` |
| `cache.vbs` | `syCache` | Create Cache → `syCreateCache`; Paint Map1 → `syCachePaint1`; Paint Map2 → `syCachePaint2` |
| `state.vbs` | `syState` | Reset State → `syClearState`; Set State → `sySetState`; Reset Velocities → `syClearVelocityState` |
| `syCmd.64.dll` | `syCmd` (B) | Cmd Save Cache → `SyCmdSaveCache` |

Scripting-name casing is as registered: the cache, state and save-cache
commands start with a lower-case `sy`, all others with `Sy`.

## Shared facts

### Registry flags (R)

All 46 script entries are identical in shape: language VBScript, category
`Custom`, empty description and tooltip, **no arguments**, enabled, no enable
condition, key-assignable, and "returns a value" = true. That last flag is the
registration default; every handler is a procedure without a result, so the
value returned to a caller is empty (inferred from the handlers having no
result).

`SyCmdSaveCache`: language CPP, category `Custom`, key-assignable, "returns a
value" = true, two input arguments (direction flag 2) named `arg0` and `arg1`,
no default, no argument handler.

### Translated texts (D), dictionary `EXTSYFLEX`

All messages are written with `LogMessage` at the default severity (no
severity argument is given), after translation through the dictionary. Two
texts carry one `%s` that receives an operator type name.

| Id | Constant in the scripts | Text | Used by |
|----|-------------------------|------|---------|
| 1000 | `IDS_SELECT_2_VERTICES` | Select 2 vertices of the cloth | `SyCreateSpring` |
| 1001 | `IDS_SELECT_A` | Select a %s | the "Get" family |
| 1002 | `IDS_SELECT_CLOTH` | Select a cloth | every command that looks up the cloth operator with error handling |
| 1003 | `IDS_SELECT_POLYMESH` | Select a polymesh | `SyCreateCloth`, `SyCreateFlesh`, `syCreateCache` |
| 1004 | `IDS_SELECT_SYCACHE` | Select a syCache | `syCachePaint1`, `syCachePaint2` |
| 1005 | (no constant is defined anywhere) | Select a syCloth | nothing reaches it, see below |
| 1006 | `IDS_CLOTH_VERTICIES` | Select cloth vertices | `SyCreateZipper` |
| 1007 | `IDS_CLOTH_AND_COLLIDER` | Select the cloth and the collider | `SyCreateCollideMesh` |
| 1008 | `IDS_CLOTH_POINTS_AND` | Select the cloth points and the %s | the "Set" family |
| 1009 | `IDS_VERTICIES_OF_CLOTH` | Select vertices of the cloth | `SyCreateNail` |
| 1010 | `IDS_VERTICIES_OF_CLOTH_AND_POLYMESH` | Select vertices of the cloth (or a point cluster) and a polymesh | `SyCreatePin`, `SyCreateMimic` |

**Undefined message id.** `force.vbs`, `collid.vbs` and `state.vbs` ask for
the translation of a constant named `IDS_SELECT_SYCLOTH` that none of the
seven files defines. The scripts do not require variable declaration, so the
id handed to the translator is an uninitialised (empty) value, not 1005. What
the translator returns or raises for an empty id is not known (Q1). The
obviously intended text is id 1005 (inferred).

### Finding the cloth operator (S)

"The cloth operator of object X" is always obtained the same way: `SelectObj`
with the string `<X>.*.syCloth*` (any direct sub-node of X, then any node
whose name starts with `syCloth`), then the first item of the resulting
selection. The lookup therefore **replaces the selection**, and it matches by
node name pattern, not by operator type.

"The object of the selection" is obtained with `SelectChildNodes`, either with
no argument (acts on the current selection and replaces it) or with an item
and a second argument of 0 (the first member of the returned collection is
used). For a selected mesh, a selected sub-component or a selected cluster the
scripts rely on this yielding the owning 3D object (inferred from every use).

### Cloth lookup with messages: `syGetCloth` (state.vbs) and `syCreateForce` (force.vbs) (S)

Both helpers start identically:

1. `SelectChildNodes` on the current selection.
2. With script errors suppressed, look up the cloth operator of the first
   selected item. If the lookup raises, log id 1002 and stop.
3. If the type of the first selected item is not `syCloth`, log the
   undefined-id message (Q1) and stop.

`syGetCloth` then returns the full name of the operator, or an empty string
after either failure. `syCreateForce(preset)` instead applies the operator
preset whose name it was given with the cloth operator as the only connection
(`ApplyOperator preset, clothOp`) and selects the new operator; it returns
nothing, so its callers cannot tell a failure from a success. Error
suppression stays on for the remainder of the helper, so a failing
`ApplyOperator` is silent and leaves the selection on the cloth operator.

### Weight map creation (S)

Every weight map is made with `CreateWeightMap` with preset `WeightMap`, the
cluster, the given name, the display type string `Weight Map Property` and a
last argument of 0; immediately afterwards the parameter
`<map>.weightmapop.weight` is set to 1. Only the first map of the returned
collection is used.

### Cluster creation (S)

`CreateCluster` is called with one string or object: `<object>.pnt[*]` (all
points), `<object>.poly[*]` (all polygons), or the selected point
sub-component. Only the first cluster of the returned collection is used.

## Wire contract: cloth creation (cloth.vbs)

### `SyCreateCloth`: SPEC (not in the task list)

Input: current selection; the first item after `SelectChildNodes` must be of
type `polymsh`.

| Step | Effect |
|------|--------|
| 1 | `SelectChildNodes` on the selection; take the first selected item as the object. |
| 2 | If its type is not `polymsh`: log id 1003, stop. Nothing is created. |
| 3 | Create a cluster of all points; rename it `ClothCls`. |
| 4 | Create weight map `MassMap` on that cluster (weight 1). |
| 5 | Create weight map `StiffMap` on that cluster (weight 1). |
| 6 | `ApplyOperator "syCloth"` with three connections in this order: the object, the mass map, the stiff map. |
| 7 | `ApplyOperator "syProperties"` with the cloth operator as only connection. |
| 8 | Select the cloth operator. |
| 9 | Set its `FirstFrame` to the current value of `PlayControl.In`. |
| 10 | `SetKey` on its `Update` parameter: time 1, value 1. |

Result: none. Selection afterwards: the `syCloth` operator.

### `SyCreateSkin`: SPEC

Input: current selection (several meshes expected). There is **no type check
and no message**.

| Step | Effect |
|------|--------|
| 1 | `SelectChildNodes`; remember the number of selected items, N. |
| 2 | `ToggleVisibility` on the selection (the source meshes are hidden when they were visible). |
| 3 | `ApplyGenOp "MeshMerge"` with no other argument (acts on the selection); set `tolerance` of the returned item to 0. |
| 4 | `SelectChildNodes` on the returned item; the first selected item becomes the object (the merged mesh, inferred). |
| 5 | Cluster of all points renamed `ClothCls`; maps `MassMap` and `StiffMap` (weight 1) as for cloth. |
| 6 | `ApplyOperator "syCloth"`: object, mass map, stiff map. |
| 7 | `ApplyOperator "syProperties"` on the cloth operator, then `ApplyOperator "syPropertiesSkin"` on the cloth operator. |
| 8 | Set `NbLevels` of the `syPropertiesSkin` operator to N. |
| 9 | Set `ClothType` of the cloth operator to **1**. |
| 10 | Select the cloth operator; `SetKey` on `Update`: time 1, value 1. |

`FirstFrame` is not written. Result: none.

### `SyCreateFlesh`: SPEC

Same as `SyCreateCloth` steps 1 to 5 (same check, same message 1003), then:

| Step | Effect |
|------|--------|
| 6 | Create a third weight map `WrinkleMap` on the cluster (weight 1). It is **not** passed to any operator. |
| 7 | `ApplyOperator "syCloth"`: object, mass map, stiff map (three connections only). |
| 8 | `ApplyOperator "syProperties"` on the cloth operator, then `ApplyOperator "syPropertiesFlesh"` on the cloth operator. |
| 9 | Set `ClothType` of the cloth operator to **2**. |
| 10 | Select the cloth operator; `SetKey` on `Update`: time 1, value 1. |

`FirstFrame` is not written. Result: none.

`ClothType` values seen: 1 = skin, 2 = flesh; cloth leaves the operator
default (inferred 0).

## Wire contract: cloth operator flags and maps (cloth.vbs)

Common shape of the six commands: `SelectChildNodes`; then, with errors
suppressed, one `SelectObj` with a path built from the first selected item;
if it raises, log id 1002 and stop. The four "write" commands then set one
parameter on the first selected item. Result: none in all cases.

| Command | Status | Path selected | Parameter written |
|---------|--------|---------------|-------------------|
| `SySetSpringMap` | SPEC | `<obj>.*.syCloth*` | `ModifSpringMap` = 1 |
| `SySetMassMap` | SPEC | `<obj>.*.syCloth*` | `ModifMassMap` = 1 |
| `SyClearCache` | SPEC | `<obj>.*.syCloth*` | `ClearCache` = 1 |
| `SyClearAllCache` | SPEC | `<obj>.*.syCloth*` | `ClearCache` = 2 |
| `SyGetSpringMap` | SPEC | `<obj>.*.cls.ClothCls*.StiffMap*` | none: the command only selects the stiffness map |
| `SyGetMassMap` | SPEC | `<obj>.*.cls.ClothCls*.MassMap*` | none: the command only selects the mass map |

Notes: the "spring map" is the map named `StiffMap`. The "Get" commands leave
the map selected so that it can be painted (inferred purpose); the "Set"
commands tell the operator to re-read the map (inferred from the parameter
names). Error suppression remains on for the parameter write, so a failed
write is silent.

### `sySaveCache`: SPEC (depends on `SyCmdSaveCache`)

No error handling and no message: any failing step is a script error.

| Step | Effect |
|------|--------|
| 1 | `SelectChildNodes`; first selected item is the object. |
| 2 | Read the point position array of the geometry of the object's active primitive (a 3 x N array of doubles). |
| 3 | Select the cloth operator of the object (`<obj>.*.syCloth*`). |
| 4 | Read the value of its `Cache` parameter. |
| 5 | Call `SyCmdSaveCache` with that value as first argument and the position array as second. |

Result: none. Selection afterwards: the cloth operator.

### `SyCmdSaveCache`: SPEC-PARTIAL (C++, `syCmd.64.dll`)

Known from (R) and (B) only:

| Item | Fact |
|------|------|
| Plugin name / display name | `syCmd` / `Cmd Save Cache` |
| Exports | `XSILoadPlugin`, `XSIUnloadPlugin`, `CmdSaveCache_Init`, `CmdSaveCache_Execute` |
| Arguments | `arg0`, `arg1`, both input, no default. The script passes the cloth operator's `Cache` value as `arg0` and the point position array as `arg1`. |
| Strings | `Arguments`, `ReturnValue` (context attribute names); one ASCII format string `%s%.4d` |
| Imports | C runtime `_open`, `_read`, `_write`, `_close`, `sprintf`, `malloc`/`calloc`/`realloc`/`free`; SDK value array access, value-to-text, value-to-float, a time object and its "get time" call, a boolean value written to a context attribute |

Inferred, not confirmed: the command formats a file name from `arg0` (cache
path prefix, taken as text) followed by a zero-padded four-digit number
(probably the current frame), opens that file and writes the positions as
floats, and returns a boolean. Missing for SPEC: file format and byte layout,
where the number comes from, open mode (the import of `_read` suggests an
existing file may be read or updated), return value, error behaviour. Needs a
disassembly pass.

## Wire contract: forces (force.vbs)

### `SyCreateGravity`, `SyCreateDamp`, `SyCreateAir`, `SyCreateWind`, `SyCreateTurbulence`, `SyCreateVolume`: SPEC

Each is one call of `syCreateForce` (shared helper above) with a preset name.
No parameter is written. Result: none. Selection afterwards: the new operator
(or the cloth operator if applying failed).

| Command | Operator preset applied on the cloth operator |
|---------|-----------------------------------------------|
| `SyCreateGravity` | `syGravity` |
| `SyCreateDamp` | `syDamp` |
| `SyCreateAir` | `syAir` |
| `SyCreateWind` | `syWind` |
| `SyCreateTurbulence` | `syTurbulence` |
| `SyCreateVolume` | `syVolume` |

Errors: id 1002 when no cloth operator is found under the selected object;
undefined-id message (Q1) when the found item is not of type `syCloth`.

### `SyCreateSpring`: SPEC

Input: exactly one selected item, of type `pntSubComponent`, holding exactly
two points.

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 1, or the item is not a point sub-component, or its element array does not hold exactly two indices: log id 1000, stop. |
| 2 | Take the positions of the two points as exposed by the point components (object space) and compute their Euclidean distance. |
| 3 | `syCreateForce "sySpring"`. |
| 4 | On the first selected item (the new operator on success) set `Length` = the distance, `Point1` = first point index, `Point2` = second point index. |

Result: none. If step 3 failed the three writes are still attempted on
whatever is first in the selection (no error handling in this procedure).

### `SyCreateZipper`: SPEC

Input: exactly one selected item of type `pntSubComponent` (any number of
points).

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 1 or the item is not a point sub-component: log id 1006, stop. |
| 2 | Build a text list of the selected point indices, in component-collection order, each index followed by one space (so the text ends with a space). |
| 3 | `syCreateForce "syZipper"`. |
| 4 | On the first selected item set `Points` = that text, then `Reset` = 1. |

Result: none. Same remark as the spring about a failed step 3.

## Wire contract: collisions (collid.vbs)

### `SyCreateCollideMesh`: SPEC

Input: exactly two selected items, the cloth mesh and the collider mesh, in
either order.

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 2: log id 1007, stop. |
| 2 | Resolve each selected item to its object (`SelectChildNodes item, 0`, first member). |
| 3 | With errors suppressed, look up the cloth operator of the first object. If that works and exactly one item is selected, the first object is the cloth and the second the collider. Otherwise try the second object the same way (roles swapped). If neither works: log id 1007, stop. |
| 4 | Create a cluster of all points of the cloth object and a cluster of all polygons of the collider. |
| 5 | `ApplyOperator "syCollide"` with six connections in this order: cloth operator; point cluster; collider mesh; collider kinematics; polygon cluster; cloth-object kinematics. |
| 6 | Select the new operator. |
| 7 | Rename the point cluster `<operator name>Pnts` and the polygon cluster `<operator name>Pols`. |

Result: none. When both objects carry a cloth operator the first selected one
is taken as the cloth. Error suppression stays on from step 3, so failures in
steps 4 to 7 are silent.

### `SyCreateSelfCollide`: SPEC

| Step | Effect |
|------|--------|
| 1 | `SelectChildNodes`; first selected item is the object. |
| 2 | With errors suppressed, look up its cloth operator. If that raises or does not leave exactly one item selected: log id 1002, stop. |
| 3 | If that item's type is not `syCloth`: undefined-id message (Q1), stop. |
| 4 | A call named `echo` with the operator's full name (Q2: not a known command; errors are suppressed here, so it has no effect if it does not exist). |
| 5 | `DeactivateAbove` the cloth operator with True (everything above it in the stack is muted). |
| 6 | Create a cluster of all polygons of the object. |
| 7 | `ApplyOperator "sySelfCollide"` with three connections: cloth operator; the object; the polygon cluster. |
| 8 | Select the new operator; rename the cluster `<operator name>Cls`; set the operator's `Reset` to 1. |
| 9 | `DeactivateAbove` the cloth operator with False. |

Result: none.

### `SyCreateCollidePla`, `SyCreateCollideSph`: SPEC-PARTIAL

Input: exactly one selected item (the cloth mesh).

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 1: undefined-id message (Q1), stop. No error suppression is active here. |
| 2 | Resolve the selected item to its object (`SelectChildNodes item, 0`, first member). |
| 3 | `GetPrim "Null"` with no name and the selected item as parent: a null is created as a child of the selection. |
| 4 | Set the null's display parameters (table below). |
| 5 | Select the cloth operator of the object. |
| 6 | Apply the operator preset with three connections: cloth operator; null kinematics; cloth-object kinematics. |
| 7 | Rename the null `<operator name>Pos`; select the operator. |

| Command | Preset | Null `primary_icon` | Null `size` |
|---------|--------|---------------------|-------------|
| `SyCreateCollidePla` | `syCollidePla` | 6 | 10 |
| `SyCreateCollideSph` | `syCollideSph` | 2 | not written |

Result: none. There is no check that a cloth operator exists: without one,
step 5 is a script error and the null created in step 3 remains.

Missing for SPEC: the only guarded error case logs the undefined-id message,
whose outcome (text logged, empty line, or script error) is unknown (Q1). The
success path is fully stated.

### `SyCollideGetMesh`: SPEC

If the first selected item is not of type `syCollide`, do nothing (no
message). Otherwise take the target of the operator's input port at index 2
(third port, the collider mesh in the connection order of
`SyCreateCollideMesh`) and select the operator and that target together (one
`SelectObj` with both full names). Result: none.

## Wire contract: constraints (constr.vbs)

### `SyCreateNail`: SPEC

Input: exactly one selected item of type `pntSubComponent` (points of the
cloth mesh).

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 1 or the item is not a point sub-component: log id 1009, stop. |
| 2 | `GetBBox` of the selected points, second argument False, six outputs (min and max per axis). |
| 3 | Create a cluster from the selected points. |
| 4 | `GetPrim "Null"` with no name and the selected item as parent. |
| 5 | `Translate` with no explicit target (acts on the selection, which is the new null, inferred) by the centre of the bounding box, with `siRelative`, `siLocal`, `siObj`, `siXYZ`. |
| 6 | Resolve the selected item to its object; select that object's cloth operator. |
| 7 | Create weight map `Map` on the cluster (weight 1). |
| 8 | `ApplyOperator "syNail"` with five connections: cloth operator; cluster; null kinematics; cloth-object kinematics; weight map. |
| 9 | Rename the cluster `<operator name>Cls` and the null `<operator name>Pos`. |
| 10 | Set the operator's `Reset` to 1; select the operator. |

Result: none. No check that a cloth operator exists (script error at step 6,
cluster and null remain).

### `SyCreatePin`, `SyCreateMimic`: SPEC

The two procedures are identical except for the preset name (`syPin` /
`syMimic`).

Input: exactly two selected items: a polygon mesh (the target) and either a
point sub-component of the cloth or an existing point cluster of the cloth.

| Step | Effect |
|------|--------|
| 1 | If the selection count is not 2: log id 1010, stop. |
| 2 | If the first item's type is `polymsh` it is the target mesh and the second item is the points. Otherwise the second item must be of type `polymsh` (else log id 1010, stop) and the first item is the points. |
| 3 | If the points item is of type `pntSubComponent`, create a cluster from it and use the cluster. Otherwise the type of **the second selected item** must be `pnt`, else log id 1010 and stop. |
| 4 | Select the cluster, `SelectChildNodes`, resolve the first selected item to its object, select that object's cloth operator. |
| 5 | Create weight map `Map` on the cluster (weight 1). |
| 6 | Apply the preset with six connections: cloth operator; target mesh; target mesh kinematics; cluster; cloth-object kinematics; weight map. |
| 7 | Rename the cluster `<operator name>Cls` (an existing cluster is renamed too). |
| 8 | Set the operator's `Reset` to 1; select the operator. |

Consequence of step 3 (the test always reads the second item because the index
it uses is computed from a variable that is never assigned): an **existing
point cluster is accepted only when the mesh is selected first and the
cluster second**. With the cluster first and the mesh second the command logs
id 1010 and stops. Point sub-components work in either order.

Result: none.

### `SySetConstraintMap`: SPEC

Sets `ModifMap` to 1 on the first selected item. No check, no message, no
selection change; a selection without such a parameter is a script error.
Intended target: a `syNail`, `syPin` or `syMimic` operator after its `Map`
weight map was painted (inferred). Result: none.

## Wire contract: reading and replacing operator clusters (getset.vbs)

### Port table

| Family | Operator type required | Port name | Element kind |
|--------|------------------------|-----------|--------------|
| `SyGetNail` / `SySetNail` | `syNail` | `Cluster` | `pnt` |
| `SyGetPin` / `SySetPin` | `syPin` | `Points` | `pnt` |
| `SyGetMimic` / `SySetMimic` | `syMimic` | `Points` | `pnt` |
| `SyGetCollidePnts` / `SySetCollidePnts` | `syCollide` | `CloPnts` | `pnt` |
| `SyGetCollidePols` / `SySetCollidePols` | `syCollide` | `ColPols` | `poly` |
| `SyGetSelfCollidePols` / `SySetSelfCollidePols` | `sySelfCollide` | `Faces` | `poly` |

### "Get" commands (`SyGetNail`, `SyGetPin`, `SyGetMimic`, `SyGetCollidePnts`, `SyGetCollidePols`, `SyGetSelfCollidePols`): SPEC

Input: the operator as first selected item.

| Step | Effect |
|------|--------|
| 1 | If the first selected item's type is not the required operator type: log id 1001 with the type name substituted (for example "Select a syNail"), stop. |
| 2 | Take the cluster connected to the named port of the operator and its element indices. |
| 3 | Resolve the cluster's first owner to its object (`SelectChildNodes`). |
| 4 | Clear the selection. |
| 5 | Add to the selection every cluster element, as `<object>.<kind>[<index>]`, in one `AddToSelection` call (one comma-separated text). |
| 6 | Set the selection filter: `Point` for `pnt`, `Polygon` for `poly`. |
| 7 | Add the operator itself to the selection. |

Result: none. Selection afterwards: the components of the cluster plus the
operator, which is exactly the input the matching "Set" command expects
(component selection first, operator second).

### "Set" commands (`SySetNail`, `SySetPin`, `SySetMimic`, `SySetCollidePnts`, `SySetCollidePols`, `SySetSelfCollidePols`): SPEC

Input: exactly two selected items: first a sub-component selection of the
right kind (`pntSubComponent` or `polySubComponent`), second the operator.

| Step | Effect |
|------|--------|
| 1 | If the count is not 2, or the second item's type is not the required operator type, or the first item's type is not `<kind>SubComponent`: log id 1008 with the operator type name substituted (for example "Select the cloth points and the syPin"; the same "cloth points" wording is used for polygon ports), stop. |
| 2 | Take the cluster connected to the named port; resolve its first owner to its object. |
| 3 | `SIRemoveFromCluster`: remove all elements of that kind (`<object>.<kind>[*]`) from the cluster. |
| 4 | `SIAddToCluster`: add the selected components to the cluster. |
| 5 | `ActivateObjectSelTool`; select the operator. |
| 6 | Set the operator's `Reset` to 1. |

Result: none. The cluster object is kept (same name, same connections); only
its membership is replaced.

### `SyPinGetMesh`: SPEC

If the first selected item is not of type `syPin`, do nothing (no message).
Otherwise take the target of the operator's input port at index 1 (second
port, the target mesh in the connection order of `SyCreatePin`) and select the
operator and that target together. Result: none.

## Wire contract: cache operator (cache.vbs)

### `syCreateCache`: SPEC

| Step | Effect |
|------|--------|
| 1 | `SelectChildNodes`; first selected item is the object. |
| 2 | If its type is not `polymsh`: log id 1003, stop. |
| 3 | Create a cluster of all points. It is **not renamed** (it keeps the default point-cluster name, which the paint commands below assume starts with `Point`). |
| 4 | Create weight maps `Map1` and `Map2` on it (weight 1 each). |
| 5 | `ApplyOperator "syCache"` with three connections: the object, `Map1`, `Map2`. |
| 6 | Select the operator; `SetKey` on its `Update` parameter: time 1, value 1. |

Result: none.

### `syCachePaint1`, `syCachePaint2`: SPEC

`SelectChildNodes`; then, with errors suppressed, select
`<obj>.*.cls.Point*.Map1` (`syCachePaint1`) or `<obj>.*.cls.Point*.Map2`
(`syCachePaint2`). If the selection raises: log id 1004. Nothing else: despite
the display names, no paint tool is activated. Result: none.

## Wire contract: simulation state (state.vbs)

### `syClearState`, `sySetState`, `syClearVelocityState`: SPEC

Each calls `syGetCloth` (shared helper above) and, when it returned a
non-empty name, writes one value to the cloth operator's `SaveState`
parameter. Result: none. Selection afterwards: the cloth operator.

| Command (display name) | `SaveState` value written |
|------------------------|---------------------------|
| `sySetState` (Set State) | 1 |
| `syClearState` (Reset State) | -1 |
| `syClearVelocityState` (Reset Velocities) | -2 |

Errors: id 1002 when no cloth operator is found; undefined-id message (Q1)
when the found item is not of type `syCloth`. In both cases nothing is
written.

## Dependencies

Nothing below has a contract yet. None of the Syflex operators is present in
the install (no SPDL, no preset, no binary), so their parameter tables, port
definitions and solver behaviour cannot be specified from the shipped files.
The only other trace of Syflex in the install is an exported C++ SDK symbol
`IsSyflexSimulationEnabled` in `sicppsdk.dll`.

| Kind | Name | What the scripts rely on |
|------|------|--------------------------|
| Operator preset | `syCloth` | 3 inputs (mesh, mass map, stiffness map); parameters `FirstFrame`, `Update`, `ClothType`, `ModifSpringMap`, `ModifMassMap`, `ClearCache` (1, 2), `SaveState` (1, -1, -2), `Cache`; node name starts with `syCloth` |
| Operator preset | `syProperties`, `syPropertiesSkin`, `syPropertiesFlesh` | 1 input (cloth operator); `syPropertiesSkin` has `NbLevels` |
| Operator preset | `syGravity`, `syDamp`, `syAir`, `syWind`, `syTurbulence`, `syVolume` | 1 input (cloth operator) |
| Operator preset | `sySpring` | 1 input; parameters `Length`, `Point1`, `Point2` |
| Operator preset | `syZipper` | 1 input; parameters `Points` (text), `Reset` |
| Operator preset | `syCollide` | 6 inputs; ports named `CloPnts` and `ColPols`; input port index 2 is the collider mesh |
| Operator preset | `sySelfCollide` | 3 inputs; port named `Faces`; parameter `Reset` |
| Operator preset | `syCollidePla`, `syCollideSph` | 3 inputs (cloth operator, null kinematics, cloth-object kinematics) |
| Operator preset | `syNail` | 5 inputs; port named `Cluster`; parameters `Reset`, `ModifMap` |
| Operator preset | `syPin`, `syMimic` | 6 inputs; port named `Points`; input port index 1 is the target mesh; parameters `Reset`, `ModifMap` |
| Operator preset | `syCache` | 3 inputs (mesh, `Map1`, `Map2`); parameter `Update` |
| C++ command | `SyCmdSaveCache` | this note, SPEC-PARTIAL |
| Host commands | `SelectChildNodes`, `SelectObj`, `AddToSelection`, `SetSelFilter`, `ActivateObjectSelTool`, `CreateCluster`, `SIAddToCluster`, `SIRemoveFromCluster`, `CreateWeightMap`, `ApplyOperator`, `ApplyGenOp` (preset `MeshMerge`, parameter `tolerance`), `GetPrim` (preset `Null`, parameters `primary_icon`, `size`), `Translate`, `GetBBox`, `ToggleVisibility`, `DeactivateAbove`, `SetValue`, `GetValue`, `SetKey`, `LogMessage` | call shapes as stated in the contracts |
| Host object model | `XSIUtils.Translate` (id, dictionary name, optional substitution), operator `Port(name)` / `InputPorts(index)` / port target, cluster `Elements` / `Owners`, sub-component `ElementArray` / `ComponentCollection`, point `Position` / `Index`, geometry `Points.PositionArray` | as used above |
| Scene parameter | `PlayControl.In` | read by `SyCreateCloth` |

## Open questions

| # | Question |
|---|----------|
| Q1 | What `XSIUtils.Translate` does with an empty (uninitialised) id and the dictionary `EXTSYFLEX`: empty text, a placeholder, or an error. Affects the type-check branch of the force, state and self-collide commands and the only guarded error of `SyCreateCollidePla` / `SyCreateCollideSph`. Id 1005 "Select a syCloth" is defined in the dictionary but never reached. |
| Q2 | `SyCreateSelfCollide` calls something named `echo` with the cloth operator's full name. No such command is known; errors are suppressed at that point. Does it log anything? |
| Q3 | `SyCmdSaveCache`: file name rule (source of the four-digit number), file layout, return value, failure behaviour, why `_read` is imported. |
| Q4 | Parameter tables, defaults, port names beyond those listed, and behaviour of all Syflex operators: no SPDL or binary is shipped in this install. Are they expected from a separate Syflex licence / installer? |
| Q5 | Exact result of `SelectChildNodes` for a sub-component selection and for a cluster (the scripts assume the owning 3D object comes first). |
| Q6 | In the "Get" family the component list text handed to `AddToSelection` starts with a space and ends with a comma, and an empty cluster gives a single space. Does `AddToSelection` accept these silently? |
| Q7 | Meaning of `ClothType` 0 / 1 / 2, `ClearCache` 1 / 2, `SaveState` 1 / -1 / -2 inside the operator (names of the commands are the only evidence), and whether these parameters reset themselves after being read. |
| Q8 | Null `primary_icon` values 2 and 6: which display icons they denote in this build (plane collider also sets `size` 10). |
| Q9 | The add-on registers no menu. How the commands reach the user interface (a toolbar shipped elsewhere, or only key mapping / script) is not visible in the install. |
| Q10 | `SyCreateSkin`: what `ApplyGenOp "MeshMerge"` returns (operator or new object) and hence what `tolerance` is written on and what the second `SelectChildNodes` selects. |

## Index rows

| Command | Implemented in | Handler | Row | Note | Status |
|---------|----------------|---------|-----|------|--------|
| `SyGetCollidePnts` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetClothPoints_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetCollidePolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetMimic` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetNail` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetPin` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetPin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetSelfCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetSelfPolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyPinGetMesh` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetPinMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetCollidePnts` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetClothPoints_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetCollidePolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetMimic` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetNail` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetPin` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetPin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetSelfCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetSelfPolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyClearAllCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `ClearAllCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyClearCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `ClearCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCloth` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateCloth_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateFlesh` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateFlesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateSkin` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateSkin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetMassMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetMassMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetSpringMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetSpringMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetMassMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SetMassMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetSpringMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SetSpringMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `sySaveCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SaveCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateAir` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddAir_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateDamp` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddDamp_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateGravity` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddGravity_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateSpring` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `CreateSpring_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateTurbulence` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddTurbulence_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateVolume` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddVolume_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateWind` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddWind_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateZipper` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `CreateZipper_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCollideGetMesh` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `GetCollideMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCollideMesh` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollideMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCollidePla` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollidePla_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
| `SyCreateCollideSph` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollideSph_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
| `SyCreateSelfCollide` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `SelfCollide_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateMimic` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreateMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateNail` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreateNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreatePin` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreatePin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetConstraintMap` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `SetConstraintMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCachePaint1` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap1_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCachePaint2` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap2_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCreateCache` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `CreateCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syClearState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `ResetState_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syClearVelocityState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `ResetVelocities_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `sySetState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `SetState_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCmdSaveCache` | `Addons\Syflex30X50\Application\Plugins\syCmd.64.dll` | `CmdSaveCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
