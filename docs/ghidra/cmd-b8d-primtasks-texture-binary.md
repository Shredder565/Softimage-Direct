# CMD-B8d: Texture projection / support / UVW task commands read from `primtasks.dll`

Row: **CMD-B8d**. Status: **SPEC** (10 names), **SPEC-PARTIAL** (6 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\primtasks.dll` (image base `0x180000000`). Marks: (G) read in
Ghidra pseudo-code, (L) read from the local static listing (call targets, strings, GUIDs,
constants), (R) registry, *(inferred)* deduced from names / call shape.

## Handler table

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `SIFindUniqueTextureName` | `{569410a0-88a2-11d3-bc5a-00a0c9612b97}` | `0x1800281d0` (ctor `0x18000a820`) | `0x18003d480` | Do `0x18000aa70` / worker `0x18000a9b0` -> `0x180003570` | `0x180004280` (base) | `0x180003f80` (base) |
| `SICreateTexturePureImplicit` | `{49c078d0-4bad-11d4-ae65-00a0c96e63e1}` | `0x180028610` | `0x1800472c0` | Do `0x18001f1c0` / worker `0x18001eec0` | `0x18001f670` (calls base) | `0x18001f650` (jumps to base) |
| `SICreateTextureBasicGeo`, `SICreateTextureProj` | `{84fad570-857e-11d2-a939-00a024190119}` | `0x180028790` | `0x180049c00` | Do `0x180023b30` / workers `0x1800235d0` (new property), `0x180023920` (sub-projection) | `0x1800243a0` | `0x180023fd0` |
| `SICreateTextureUVDomain` | `{84fad572-857e-11d2-a939-00a024190119}` | `0x1800285d0` | `0x180046260` | Do `0x18001e0a0` / workers `0x18001db90` (list), `0x18001d620` (per object) | `0x18001e910` | `0x18001e620` |
| `SIConnectToSupport` | `{7f6f4436-c668-11d2-8250-00a0c982dd9a}` | `0x180028110` | `0x18003b230` | Do `0x180008350` / worker `0x180008040` | `0x1800089d0` | `0x180008940` |
| `SIConnectToProjection` | `{9d173301-324f-11d4-ae61-00a0c96e63e1}` | `0x1800280d0` | `0x18003a910` | Do `0x180007990` / worker `0x180007670` | `0x180007b40` | `0x180007a90` |
| `SICameraTextureProj` | `{38f8038e-4f55-11d3-b0c9-00a0c982dd9a}` | `0x180028050` | `0x180039790` | Do `0x1800068d0` / worker `0x1800065f0` | `0x180006bb0` | `0x180006b50` |
| `SICreateTextureSpatial` | `{54e02e68-09fa-4972-8383-4d956eeffe4c}` | `0x180028250` | `0x18003e460` | Do `0x18000c050` / worker `0x18000bea0` | `0x180004280` (base) | `0x180003f80` (base) |
| `SIGetTextureUVDomains` | `{c781dcf0-d426-11d3-9e9e-009027bc38dd}` | `0x1800283d0` | `0x180040ac0` | Do `0x1800108c0` / worker `0x18000f8e0` | `0x1800109d0` | `0x180010980` |
| `ChangeUVInput` | `{21bb3f0a-e163-475b-b411-8bd9dcc39a5d}` | `0x180028090` | `0x18003a070` | Do `0x1800071a0` / worker `0x180006ee0` | `0x1800072a0` | none (`0x1800065e0`) |
| `HealUVW` | `{e06b57d2-a59c-4a1b-87cd-56f9d77c32b3}` | `0x180028450` | `0x180041b50` | Do `0x180011aa0` / workers `0x1800114f0` (cluster), `0x180011790` (subcomponent) | `0x180011d60` | `0x18001c6a0` |
| `RelaxUVW` | `{db7c3b91-2e81-4f2d-90f1-d941b298370d}` | `0x180028690` | `0x180047ad0` | Do `0x180011aa0` / workers `0x18001f850`, `0x180020b30` | `0x180011d60` | `0x18001c6a0` |
| `CycleUVW` | `{bde6f551-fdb8-46ef-9fb0-dc4df94c547d}` | `0x180028150` | `0x18003c410` | Do `0x18000b880` / workers `0x1800096c0`, `0x180009af0` | `0x18000a050` | `0x18001c6a0` |
| `FlipUVW` | `{1ddc14e2-67db-43b4-9605-6d3e84ec8c5e}` | `0x180028210` | `0x18003dc70` | Do `0x18000b880` / workers `0x18000b450`, `0x180009af0` | `0x18000bbd0` | `0x18001c6a0` |
| `MatchUVW` | `{4a50f2fd-31c9-4323-b49f-2eeaf3ef7ef1}` | `0x180028590` | `0x180045150` | Do `0x18001c430` / workers `0x18001bcf0`, `0x18001c120` | `0x18001c6d0` | `0x18001c6a0` |

Vtable note: for the `SICreateTexture*` / `SIConnectTo*` / `SICameraTextureProj` /
`SIFindUniqueTextureName` classes the first candidate `0x1800384d0` is the abstract base
(slot 5 pure). Each object is laid out as *COM object, task sub-object, command-specific
interface*; `Do` only forwards the stored arguments to slot 9 (or 10) of that
command-specific interface, which is the worker listed above.

## Shared facts

### Base texture task (vtable `0x1800384d0`) (G)

- **UnPackArg `0x180004280`**: reads the input object list with
  `F3DCmdGetInputObjects` (argument `InputObj`) and the string argument `PropertyName`
  (kept only when the variant is a string; otherwise the name stays empty).
- **RePackArg `0x180003f80`**: writes the task's name string back to `PropertyName`
  (`SICmdSetStringArgFromName`).
- **Undo / Redo** (slots 6 / 7) are the imported `C3DCoreBaseTask::UndoTasks` /
  `RedoTasks`: every command below works by creating sub-tasks and registering them with
  `AddTask` on the first execution, so undo / redo replays the sub-task list. Workers
  start with `ClearTasks`; on failure they call `UndoTasks` themselves and drop their outputs.
- **Slot 13** releases the input list and empties the name.
- **Slot 14 `0x180004330`, input validation** (inputs, out filtered list, log flag):
  empty input -> optional `Log(4, 0x37)`, status `0x562e80d2` ("nothing valid"). Otherwise
  every item is examined; items of element type 8 whose interface
  `{eff95861-6291-11d1-be9e-00a024ee478d}` reports a kind in 4..6 are dropped, all others
  are kept. No item kept -> `0x80004005`. The kept list is converted by the generic object
  `{24be99c0-5eb6-11d2-8bb0-00aa00135f7b}` (interface `{3153c900-...}`, slot 26) and then
  passed to the class filter (task slot 15). Result: `0x562e80d2` when the filtered list
  is empty, `1` when some inputs were dropped or filtered out, else `0`. On `1` /
  `0x562e80d2` it logs `Log(4, 0x36)`; on failure `Log(2, 0x36)` and
  `Raise(0x80004005, 2, 0x37)`. Workers turn `0x562e80d2` into the success-class status
  `0x562e80c7` and do nothing.
- **Slot 15, class filter**: default `0x180004770` applies registered filter number
  `0x3a` (58) of the filter manager (`{e1c35d82-6daa-11d1-a5a4-00a0c91412de}`) to the
  list *(inferred: the "can carry a texture projection" object filter)*.
  `SIFindUniqueTextureName` (`0x18000aaf0`), `SICreateTexturePureImplicit`
  (`0x18001f200`), `SICreateTextureUVDomain` (`0x18001e3f0`, single class clause
  `{a3ff6735-54b8-11d2-8baf-00aa00135f7b}`) and `SIConnectToSupport` (`0x1800083d0`)
  build their own class-clause filters.

### Unique-name rule (`0x180003570`) (G)

Arguments: validated input list, proposed name, flag "also check the object level".

1. For each input: take its owning 3D object; when the flag is set, add the object's own
   naming scope; take the object's primitive -> geometry, and at the **current time**
   enumerate all components of class `{0e1a4f60-0509-11d1-aa94-00a0243e34c4}`
   (the cluster kind used for texture coordinates, see below) and add each one's naming
   scope (interface `{9ee6ddb5-65cc-11d1-b0ce-00a024c79287}`).
2. Proposed name null or empty -> **`Texture_Projection`**.
3. No scope collected (no such cluster on any input) -> the proposed name is returned
   unchanged.
4. Otherwise each scope in turn is asked for a name unique inside it (scope method
   slot 8: name in, unique name out), feeding the result to the next scope; the whole pass
   is repeated until a pass leaves the name unchanged. The result is therefore a name
   free in **every** texture-coordinate cluster of **every** input. The suffix scheme is
   the scene's ordinary child-name uniquifier *(inferred; the scope method lives outside
   this DLL)*.

All callers in this group pass the flag as 0.

### Cluster and UV property creation (`0x180001220`) (G)

Per input object, given the (unique) property name:

1. On the object's geometry look for an existing cluster of class
   `{0e1a4f60-0509-11d1-aa94-00a0243e34c4}` whose element count equals the geometry's
   total (interface `{c11e97bd-f895-11d0-b780-00a0243e3694}`) and whose "complete" test
   (cluster slot 48) is true; the last such cluster is reused.
2. Otherwise create one with the cluster-creation task
   `{5f1f5161-8b90-11d2-a93c-00a024190119}`: class as above, name
   **`Texture_Coordinates`**, type number `0x13` (19), on the 3D object; then run task
   `{5f1f5165-8b90-11d2-a93c-00a024190119}` on it with element argument `-1`
   *(inferred: fill with all elements / make it always-complete)*.
3. Create the UV property with the property-creation task
   `{6fa26e30-7fe6-11d2-a938-00a024190119}`: property class
   `{6630d811-0699-11d1-b723-00aa0068bf56}`, parent = that cluster, name = the unique
   name. The first created property is returned as an element reference.
4. All three tasks are registered as sub-tasks on first execution.

### Projection definition (`0x180003490` -> sub-task worker `0x180008e30`) (G)

Creates an object of class `{c27897e0-1b97-11d4-ae61-00a0c96e63e1}` (interface
`{b2e8e610-1b97-11d4-ae61-00a0c96e63e1}`), initialised with an optional owner (the
support object, or none), named **`<PropertyName>_Def`**, and sets its parameter number
`0x16` (22) to an integer **definition kind**:

| Kind | Value | Used by |
|---|---|---|
| basic geometry support | `0x62` (98, ASCII `b`) | `SICreateTextureBasicGeo`, `SIConnectToSupport` (non-NURBS support) |
| camera | `0x63` (99, `c`) | `SICameraTextureProj` |
| purely implicit | `0x69` (105, `i`) | `SICreateTexturePureImplicit` |
| NURBS UV-domain support | `0x6e` (110, `n`) | `SICreateTextureUVDomain`, `SIConnectToSupport` (NURBS support) |
| spatial | `0x73` (115, `s`) | `SICreateTextureSpatial` |

Two further sub-tasks: `0x180002500` -> `0x18001eba0` attaches the definition to a UV
property (property interface `{5247da40-4f03-11d1-925b-08003629ea02}`, slot 4);
`0x180003fb0` -> `0x180020fe0` only releases the task's working pointer to the definition.

### Texture operator application (`0x180002010` -> per object `0x180002210`) (G)

For each validated input: create cluster + UV property (above), attach the definition,
then create the projection operator through the generic operator-application task
`{46cee370-8bb2-11d2-ac56-00a02485cecb}` (slot 10: operator class, port-connection list
`{ce9a5032-8bc7-11d2-ac56-00a02485cecb}`, 0, first-execution flag, 0, 4). While doing so
the ambient value `context.constructionmode` is forced to **0** and restored afterwards.

- Without support (`0x180002ff0`), used for operator classes
  `{c8c0ce6e-cb53-11d2-8253-00a0c982dd9a}` and `{27410380-4e87-11d3-b0c9-00a0c982dd9a}`:
  connections in order: input object, UV property, input object, definition, UV
  property, then the property's cluster (resolved by `0x1800025c0`).
- With support (`0x180002910`), all other classes; a missing support gives `0x8000ffff`:
  input object, support, UV property, [an extra reference obtained by `0x1800040a0`, only
  when the support's primitive implements `{8ff09411-d7aa-11d0-8a21-080036f3cc02}` and
  its boolean parameter `{af8f2b20-eded-11d3-ae5b-00a0c96e63e1}` is true], definition, UV property, cluster.
- Afterwards, when `F3DRequiresDeltaCreation` says no for the input, a task of class
  `{d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b}` is run on the UV property with arguments
  `0x402` / `0x800` (purpose not read, see open question 4).

Operator classes used:

| Operator class | Used by |
|---|---|
| `{25d90fda-e843-45f3-8cd8-d67d787d72f6}` | `SICreateTextureBasicGeo` (new property), `SIConnectToSupport` (non-NURBS support) |
| `{d4559710-c7fb-4db3-a2fa-543f9781407c}` | `SICreateTextureBasicGeo` sub-projection onto an existing UV property |
| `{870ee6f2-0666-11d1-a8dd-00a024190119}` | `SICreateTextureUVDomain`, `SIConnectToSupport` (NURBS support) |
| `{0ff48093-8651-11d3-bc59-00a0c9612b97}` | second operator of `SICreateTextureUVDomain` |
| `{7158c404-4f4e-11d3-b0c9-00a0c982dd9a}` | `SICameraTextureProj` |
| `{27410380-4e87-11d3-b0c9-00a0c982dd9a}` | `SICreateTextureSpatial` |

### Texture support object (`0x180023350`, fit sub-task `0x180022640`) (G)

- Name: the `SupportName` argument, or **`Texture_Support`** when null / empty.
- Created with the primitive-creation task `{29668d60-591f-11d1-bafa-444553540000}`
  (interface `{e3b60611-7db8-11d2-ac53-00a02485cecb}`, slot 9): preset, name, **the
  `Parent` argument passed through as given (null when the caller passes none; the task
  adds no default of its own, so the default parent is whatever the generic primitive
  creation uses, *(inferred)* the scene root)**, flag 1. Returns the primitive and its
  3D object.
- Fit sub-task: with preference `xsiprivate.SI3D_CONSTRAINT_COMPENSATION_MODE` forced to
  1 for the duration (restored afterwards), the support primitive (interface
  `{8ff09411-d7aa-11d0-8a21-080036f3cc02}`, slot 7) is asked to fit itself to the input
  list with (projection type, projection plane, fitting method); then primitive parameter
  number **7 = projection type** and number **1 = projection plane** are set (integers),
  and on the support's 3D object the property of class `{11ebe302-a20c-11d0-8478-00a024c7919c}` gets parameter
  number 1 = the `Visibility` boolean *(inferred: view visibility)*.
- Numbers are passed through unchanged, so they are the `siTxtProjType` (planar 0,
  cylindrical 1, spherical 2, lollipop 3, spatial 4, cubic 5), `siTxtProjPlane` (XY 0,
  XZ 1, YZ 2) and `siTxtProjFitMethod` (0..5) values of the script note.

### UVW editing family (G for Do, L for workers)

`TextureProjection` and `SubComp` are both fetched as element references
(`{872903d0-3ef3-11d0-8463-00a024c7919c}`); the element type of `SubComp` is stored.
`Do`: the owner 3D object of `SubComp` must have a primitive of class
`{400cce30-4400-11d0-bddd-00a0241981e2}` *(inferred: polygon mesh)*, otherwise
`Log(4, 0x29)` and status `1`. Element type **6** (a cluster reference, resolved to
`{a244f0d0-1e1d-11d0-aa2e-00a0243e34c4}`) goes straight to the cluster worker; type **7**
(a subcomponent) goes to the subcomponent worker, which reads the index array
(`S3DSUBCOMPONENTINFO::GetAsULONGArray`), creates a cluster from it with the
cluster-creation task `{5f1f5163/5f1f5164-8b90-11d2-a93c-00a024190119}` (construction
mode forced to 0 meanwhile) and then calls the cluster worker. Any other type: nothing,
status 0. The cluster worker forces `context.constructionmode` to 0, builds two
connections (0 = the UV property, 1 = the cluster), applies the command's operator with
the operator-application task (arguments 3, first-execution flag, out operator, 4), where
present sets one operator parameter from the scalar argument with the set-value task
`{c089b902-8481-11d2-b118-00a024c79287}`, and restores the construction mode. The created
operator is returned in `OutputObj` (RePackArg `0x18001c6a0`, variant type 13). Undo is
`UndoTasks`; Redo replays the sub-tasks with construction mode again forced to 0.

| Command | Operator class | Parameter set | From argument |
|---|---|---|---|
| `HealUVW` | `{ed5f3308-465e-4725-a905-d2a28e85d8d5}` | none | - |
| `RelaxUVW` | `{32187e0b-b21c-464f-bb06-3c42954c35d7}` | none | - |
| `CycleUVW` | `{e2f1d19c-7b84-4b13-8f80-6be9ec486a77}` | `{45733896-ec8f-47b2-8010-e89e9a091209}` | `Offset` |
| `FlipUVW` | `{8c3c4d1b-f326-42ad-9b80-0e26cd10af86}` | `{6f963cfb-00ef-40c5-9133-4ff8f43a12cc}` | `Pivot` |
| `MatchUVW` | `{9676235f-139b-4245-85ab-32d8babbd251}` | `{8e9cc20a-4371-4d44-a563-174120fc777b}` | `Tolerance` |

How the pairs differ: `HealUVW` / `RelaxUVW` share `Do` and UnPackArg, and `CycleUVW` /
`FlipUVW` share `Do`, only because the code is identical (the linker folded it); each
class has its own command-specific interface, so the shared `Do` reaches a different
worker and therefore a different operator class. `CycleUVW` and `FlipUVW` additionally
have separate UnPackArg functions reading `Offset` and `Pivot` respectively, and share
the subcomponent worker.

---

### `SIFindUniqueTextureName`: SPEC

**Wire contract.** Purpose: propose a UV property name that is free on all inputs.
Arguments (R, confirmed in UnPackArg): `InputObj` (object list, in), `PropertyName`
(string, in/out, default empty). Steps: validate the inputs (slot 14; the class filter
`0x18000aaf0` accepts classes `{a3ff6732-54b8-11d2-8baf-00aa00135f7b}`,
`{b63a4b46-0402-4612-a86c-937faa8f854a}`, `{161f3b51-...}`, `{161f3b53-...}` and three
`{3df7f9e0/1/2-89ee-11d0-9964-00a0243f0e60}` component kinds); if nothing valid, the name
is left as given. Otherwise apply the unique-name rule and store the result. Output:
`PropertyName` = the unique name (`Texture_Projection`-based when the proposal is empty).
Creates nothing; no sub-tasks; undo / redo are empty. Errors: only propagated failures.

### `SICreateTexturePureImplicit`: SPEC

**Wire contract.** Purpose: give each input a UV property that carries only a projection
definition, with no operator and no support. Arguments: `InputObj` (in), `PropertyName`
(in/out). Steps (worker `0x18001eec0`): validate inputs (nothing valid -> `0x562e80c7`,
no change); compute the unique name; create one definition named
`<PropertyName as passed>_Def` with kind `0x69` and no owner; for every input create
cluster + UV property (unique name) and attach the definition; an input for which no
property could be made only logs `Log(4, 0x37)`; finally release the definition pointer.
Output: `PropertyName` is written back **as passed in** (the worker does not copy the
uniquified name into the task's name field). Undo / redo: sub-task replay. Errors:
`0x80004003` when the out pointer is already set; any failure undoes the sub-tasks.

### `SICreateTextureBasicGeo`: SPEC

**Wire contract.** Purpose: create a texture support object and project the inputs
through it, either into a new UV property or as a sub-projection of an existing one.

Arguments (R; read by name in `0x1800243a0`): `PresetObj` (preset, default
`{42FC2493-732F-11d2-AC52-00A02485CECB}:Texture`, via `F3DCmdGetPreset`), `InputObj`,
`SupportName` (string, optional), `PropertyName` (string, read only when no
`TextureProjection` is given), `Parent` (object, optional; cleared when absent),
`ProjectionType` (long, default `siProjPlanar` 0), `ProjectionPlane` (long, default
`siPlaneXY` 0), `Visibility` (bool, default true), `TextureProjection` (existing UV
property, optional: its presence selects sub-projection mode), `Fitting` (long, default
`siRelBestFit` 1). Outputs: `3DObjTexture` (the support 3D object), `Properties` (list
of created UV properties, new-property mode only), `PropertyName`.

New-property mode (`0x1800235d0`):
1. Validate inputs (nothing valid -> `0x562e80c7`).
2. Create and fit the support (see shared facts) with the type, plane, visibility and
   fitting arguments; remember its object id.
3. Compute the unique property name; create the definition `<unique>_Def`, kind `0x62`,
   **owned by the support object**.
4. For each input: cluster + UV property named `<unique>`, attach the definition, apply
   operator `{25d90fda-e843-45f3-8cd8-d67d787d72f6}` with the support connected. Each
   created property is appended to `Properties`.
5. Release the definition pointer; on first execution record the arguments for replay
   (`0x180024180`).

Sub-projection mode (`0x180023920`): steps 1 and 2, then for each input apply operator
`{d4559710-c7fb-4db3-a2fa-543f9781407c}` (`0x180001c60` / `0x180001e00`) to the
**existing** UV property: the element it is attached to is taken from the property
(interface `{04d2e5b0-7e13-11d0-9960-00a0243f0e60}`, slot 15, index 0; missing ->
`0x80070057`) and used as the first connection, the new support is connected, and the
definition connection is left out (none is passed). No property, cluster or definition
is created.

Return / outputs (`0x180023fd0`), only when the input list exists: `3DObjTexture` = an
element reference to the support; `Properties` only in new-property mode; then
`PropertyName` = the name field (the requested name, not the uniquified one).
Undo `0x180023f00` / Redo `0x180023d10` are class-specific wrappers around the sub-task
replay (not read line by line). Errors: `0x80004003` when an out pointer is already
set; `0x8000ffff` when an operator needs a support and none exists; every failure calls
`UndoTasks` and clears the outputs; status `0x80070005` is passed through unchanged.

### `SICreateTextureProj`: SPEC-PARTIAL

Same handler class and code as `SICreateTextureBasicGeo`. Registry arguments are
`PresetObj`, `InputObj`, `Name`, `Parent`, out `3DObjTexture`, out `PrimObjTexture`,
out `PropertyName`. The shared UnPackArg asks the exec context for `SupportName`,
`Visibility`, `ProjectionType`, `ProjectionPlane` and `Fitting`, none of which this
entry declares, and never asks for `Name`; the shared RePackArg writes `3DObjTexture`,
`Properties` and `PropertyName`, never `PrimObjTexture`. A failing lookup of
`Visibility` / `ProjectionType` / `ProjectionPlane` / `Fitting` aborts UnPackArg, so
this legacy entry *(inferred)* fails before `Do`. Missing: how the exec context answers
a by-name request for an undeclared argument (outside this DLL); if it succeeds with
defaults the behaviour is `SICreateTextureBasicGeo` with support name `Texture_Support`.

### `SICreateTextureUVDomain`: SPEC-PARTIAL

**Wire contract.** Purpose: for each input (NURBS) object create a UV-domain texture
support and a UV property driven by it. Arguments: `PresetObj` (preset; the script passes
`NurbsTextureCtrl`), `InputObj`, `SupportName` (string, optional), `PropertyName`
(base UnPackArg), `Visibility` (bool, default true); outputs `OutputObjs` (list of
supports), `Properties` (list of UV properties), `PropertyName`.

Steps (L): `Do` creates the two output lists; the list worker validates the inputs
(class filter: `{a3ff6735-54b8-11d2-8baf-00aa00135f7b}` only), computes the unique name
once, and calls the per-object worker `0x18001d620` for each input, appending its support
and property to the lists. Per object: support name = `SupportName` or
`Texture_Support`; the support is created with the primitive-creation task (slot 10,
class argument `{6808c4b2-d608-11d0-8a20-080036f3cc02}`) relative to the input's 3D
object *(inferred: as its child)*; a definition `<unique>_Def` of kind `0x6e` owned by
the support; a setup sub-task `0x18001c810`; cluster + UV property + operator
`{870ee6f2-0666-11d1-a8dd-00a024190119}` through `0x180002210` with the support
connected; then a second operator `{0ff48093-8651-11d3-bc59-00a0c9612b97}` with three
connections, applied with mode 4 *(inferred: keeps the support fitted to the surface UV
domain)*; release the definition. On failure `UndoTasks`. RePackArg writes `OutputObjs`,
`Properties` (variant type 13) and `PropertyName`.
Missing: the setup sub-task `0x18001c810` (where `Visibility` is consumed), the three
connections of the second operator, and the alternative interface slot 10 path
`0x18001df20` (takes an existing support; used on redo / repeat).

### `SIConnectToSupport`: SPEC

**Wire contract.** Purpose: project the inputs through an **existing** texture support.
Arguments: `InputObj`, `PropertyName` (in/out), `PrimObjTexture` (object list, in: the
support); output `3DObjTexture`. UnPackArg `0x1800089d0`: base arguments, then
`PrimObjTexture`; the list is validated and its first usable item's 3D object is kept;
when none is usable a message box "There were no valid texture control selected"
(title "Error") is shown. Steps (L, constants read from the listing): validate inputs
(class filter `0x1800083d0`, which also checks them against the support's existing
definition; nothing valid -> `0x562e80c7`); compute the unique name and store it; test
whether the support has a primitive of class `{8ff09412-d7aa-11d0-8a21-080036f3cc02}`:
yes -> operator `{870ee6f2-0666-11d1-a8dd-00a024190119}` and definition kind `0x6e`; no
-> operator `{25d90fda-e843-45f3-8cd8-d67d787d72f6}` and kind `0x62`; create the
definition `<unique>_Def` owned by the support; for every input cluster + UV property +
operator with the support connected; release the definition. Outputs: `3DObjTexture`
(variant type 13) and `PropertyName` = the unique name. Failure: `UndoTasks`.

### `SIConnectToProjection`: SPEC-PARTIAL

**Wire contract.** Purpose ("Share Projection Definition"): give the inputs a new UV
property that reuses the projection definition of an existing texture projection.
Arguments: `InputObj`, `PropertyName` (in/out), `TextureProjection` (object list,
in/out). UnPackArg `0x180007b40` requires exactly one usable item that resolves to a
projection definition (`{b2e8e610-1b97-11d4-ae61-00a0c96e63e1}`), else message box
"There were no valid texture projection selected". Steps (L): validate inputs; take the
definition and its object id; compute and store the unique name; look under the source
for a nested object of class `{5d86c700-3ae5-11d4-ae63-00a0c96e63e1}` and read the class
id of the operator it uses; a null class id -> `Raise(0x80004005, 2, 0x37)`; class
`{870ee6f1-303c-11d1-a8dd-00a024190119}` is replaced by
`{25d90fda-e843-45f3-8cd8-d67d787d72f6}`; then for every input cluster + UV property
attached to the **existing** definition + an operator of that class (no new definition
is created). Outputs: `TextureProjection`, `PropertyName`. Failure: `UndoTasks`.
Missing: exact source of the support connection and of the operator class (listing
only, not decompiled).

### `SICameraTextureProj`: SPEC

**Wire contract.** Purpose: camera projection. Arguments: `InputObj`, `PropertyName`
(in/out), `PrimObjTexture` (object list, in: the camera); output `3DObjCamera`.
UnPackArg `0x180006bb0` as for `SIConnectToSupport`; message box "There were no valid
camera selected" when none. Steps (L): validate inputs (nothing valid -> `0x562e80c7`);
get `SIGetListOfSceneCameras` and require the given object to be a member, otherwise
`Log(2, 0x117)` and nothing is created; compute and store the unique name; create the
definition `<unique>_Def`, kind `0x63`; for every input cluster + UV property +
operator `{7158c404-4f4e-11d3-b0c9-00a0c982dd9a}` with the **camera connected in the
support position**; release the definition. Outputs: `3DObjCamera` (variant type 13),
`PropertyName` = unique name. Failure: `UndoTasks`.

### `SICreateTextureSpatial`: SPEC

**Wire contract.** Purpose ("Geometry to Texture"): UV property computed from the
object's own geometry, no support. Arguments: `InputObj`, `PropertyName` (in/out),
`CreatedObj` (out). Steps (G, `0x18000bea0`): validate inputs (nothing valid ->
`0x562e80c7`); compute the unique name and store it in the task; create the definition
`<unique>_Def`, kind `0x73`, no owner; for every input cluster + UV property + operator
`{27410380-4e87-11d3-b0c9-00a0c982dd9a}` through the no-support path; release the
definition. Outputs: `PropertyName` = unique name. **`CreatedObj` is never written**
(RePackArg is the base one). Failure returns the error after dropping the definition.

### `SIGetTextureUVDomains`: SPEC-PARTIAL

**Wire contract.** Purpose: collect the texture support objects used by the inputs.
Arguments: `InputObjs` (object list, in), `Value` (return value, variant type 13: an
object list). No scene change, no sub-tasks; Undo and Redo are the same empty function.
Steps (L, `0x18000f8e0`): null input -> `0x80004003`. For every input, at the current
time: geometry -> clusters of class `{0e1a4f60-...}` -> their properties of class
`{04c00872-feb9-11d0-9748-00a0243e36b9}` -> for each, the operators writing it (nested
class `{473feb00-64ed-11d1-84c6-00a0243e3543}`, search depth `0x7fff`) -> their
connected inputs -> those whose primitive implements
`{8ff09411-d7aa-11d0-8a21-080036f3cc02}` or `{8ff09412-...}` -> the primitive's 3D
object (`F3DGet3DObjectOfPrimitive`), added once each to the result list.
Missing: decompilation of the walk (established from the call sequence only), so the
duplicate rule and the order of the result are *(inferred)*.

### `ChangeUVInput`: SPEC-PARTIAL

**Wire contract.** Purpose: move the operator that generates a UV property to another
place in the construction history. Arguments: `TextureProjection` (UV property element
reference, in), `MoveAction` (long, default `siChangeUVInputActionSwim` 0). No outputs.
Steps (L, `0x180006ee0`): null property -> `0x80004003`; find the operator writing the
property (nested class `{473feb00-64ed-11d1-84c6-00a0243e3543}`, none -> `0x8000ffff`)
and its owning object; create the move task `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}`.
`MoveAction` 0: move with mode 0 and no marker. `MoveAction` 1 or 2: locate a
construction-region marker operator with `F3DFindMarkerOperator` (none -> `0x8000ffff`)
and move with mode 1 relative to it, side code 2 for action 1 and 1 for action 2.
`MoveAction` > 2 -> `0x80004001`. The move task is registered as a sub-task; Undo
`UndoTasks`, Redo `RedoTasks`. `Do` logs `Log(4, 0x29)` and returns 1 when the worker
reports 1. Missing: the names of actions 1 and 2 and the move task itself (other DLL).

### `HealUVW`: SPEC

**Wire contract.** Arguments: `TextureProjection` (UV property, in), `SubComp`
(cluster or subcomponent, in), `OutputObj` (return, the operator). Behaviour: UVW family
above with operator `{ed5f3308-465e-4725-a905-d2a28e85d8d5}`, no parameter. Errors:
`0x80004003` on null arguments; not a mesh -> `Log(4, 0x29)`, status 1.

### `MatchUVW`: SPEC

**Wire contract.** Arguments: `TextureProjection`, `SubComp`, `Tolerance` (double,
default 0.02), `OutputObj`. UVW family with operator
`{9676235f-139b-4245-85ab-32d8babbd251}`; its parameter
`{8e9cc20a-4371-4d44-a563-174120fc777b}` is set to `Tolerance`. `Do` `0x18001c430` has
the same shape as the shared one (types 6 / 7) and additionally forwards the tolerance.

### `CycleUVW`: SPEC

**Wire contract.** Arguments: `TextureProjection`, `SubComp`, `Offset` (long, default 1),
`OutputObj`. UVW family with operator `{e2f1d19c-7b84-4b13-8f80-6be9ec486a77}`;
parameter `{45733896-ec8f-47b2-8010-e89e9a091209}` = `Offset`.

### `FlipUVW`: SPEC

**Wire contract.** Arguments: `TextureProjection`, `SubComp`, `Pivot` (long, default 1),
`OutputObj`. UVW family with operator `{8c3c4d1b-f326-42ad-9b80-0e26cd10af86}`;
parameter `{6f963cfb-00ef-40c5-9133-4ff8f43a12cc}` = `Pivot`.

### `RelaxUVW`: SPEC-PARTIAL

**Wire contract.** Arguments: `TextureProjection`, `SubComp`, `OutputObj`. UVW family
with operator `{32187e0b-b21c-464f-bb06-3c42954c35d7}` (arguments 3 / 4 as the others),
no parameter. Its cluster worker `0x18001f850` is much longer than the others: before
applying the operator it reads the cluster's elements at the current time, derives a
second element set from them, creates an extra cluster of class `{0e1a4f60-...}` with
the cluster-creation task, logs a severity-4 message in one branch, and connects three
references instead of two. Missing: that preparation (which elements the extra cluster
holds and which reference goes to which connection).

## Open questions

1. `SICreateTextureProj`: result of a by-name argument request for an undeclared name in
   the exec context (decides whether UnPackArg `0x1800243a0` fails for this entry).
2. `SICreateTextureUVDomain`: sub-task worker behind `0x18001c810`, the connections of
   operator `{0ff48093-...}` in `0x18001d620` (around `0x18001d95e`), and slot 10
   `0x18001df20` / `0x18001e860`.
3. `RelaxUVW`: body of `0x18001f850` between `0x18001f8ee` and `0x180020706`.
4. Task `{d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b}` run at the end of `0x180002210`
   (arguments `0x402`, `0x800`).
5. Helper `0x1800040a0` (extra connection for supports whose parameter `{af8f2b20-eded-11d3-ae5b-00a0c96e63e1}` is
   true) and `0x1800025c0` (cluster reference of a UV property).
6. Class filters `0x1800083d0` (`SIConnectToSupport`) and `0x18001f200`
   (`SICreateTexturePureImplicit`); meaning of registered filter `0x3a`.
7. `SIConnectToProjection` worker `0x180007670` and `SIGetTextureUVDomains` worker
   `0x18000f8e0` were read from the listing only.
8. `ChangeUVInput`: enum names for `MoveAction` 1 and 2.
9. Undo / Redo of the basic-geo class (`0x180023f00`, `0x180023d10`) and UVDomain class
   (`0x18001e3a0`, `0x18001e1c0`) were not read.
10. Message texts for ids `0x29`, `0x36`, `0x37`, `0x117`; names of the definition's
    parameter 22, the support primitive's parameters 7 and 1, and property class
    `{11ebe302-a20c-11d0-8478-00a024c7919c}`.
