# CMD-B12f: shader connection, replace, instance data and rename commands read from `shadertasks.dll` (AddObjectsToShader, RemoveObjectsFromShader, RemoveShaderFromCnxPoint, RemoveAllShadersFromCnxPoint, UIMapButton, SIGetMaterialShader, ReplaceShader, ReplaceShaderWithPreset, ReplaceShaderWithProgID, SetInstanceDataValue, SIRebindByNameUserData, RenamePropAndRebind_Internal)

Row: **CMD-B12f**. Status: **SPEC** (5 names), **SPEC-PARTIAL** (7 names), **not implemented in
`shadertasks.dll`** (10 names: `SetReference2`, `SICreateMaterialDD`, `SIAddImageClip`, `SIAddArrayElement`,
`SIRemoveArrayElement`, `SISwapArrayElements`, `CreateShadersFromMaterialPreset`, `CreateShaderFromCLSID`,
`CreateShaderFromProgID`, `AddShaderAttachedComment`; see 2).
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\shadertasks.dll`, image base `0x180000000`,
sha256 `ef5c3ba68c4ba34423566ef96e5e575fe070f72cfb6f9a6b23b653835c5353c5`.
Method: Ghidra decompilation of `DllGetClassObject` (`0x180004670`) to list the CLSIDs the DLL serves; `read_bytes`
of the factory vtables (7 slots, slot 6 creates the task), the task vtables and the worker vtables; decompilation of
the factory create functions, constructors, UnPackArg (task slot 8), Do (task slot 5) and the worker each Do forwards
to. Several Do slots are register-only forwarding stubs Ghidra has no function for; they were decoded by hand from
their bytes (which object / slot they jump to). Arguments and defaults from `data/command_registry.json`. Sub-task
CLSIDs were matched to the registry by reading the GUID table at `0x180065640`.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | CLSID | Factory vtable | Create (slot 6) | Constructor | Do (slot 5) | Worker | UnPackArg |
|---|---|---|---|---|---|---|---|
| `AddObjectsToShader` | `c85e1a71-db03-11d2-aa5f-00aa0068d2c0` | `0x180067930` | `0x1800039b0` | `0x1800379d0` | stub `0x180038410` → primary vtable slot 8 | `0x180037ad0` | `0x180037910` (shared) |
| `RemoveObjectsFromShader` | `187240f1-e211-11d2-aa69-00aa0068d2c0` | `0x180067f50` | `0x180004070` | `0x180037f00` | stub `0x180038410` (shared) → primary slot 8 | `0x180038000` | `0x180037910` (shared) |
| `RemoveShaderFromCnxPoint` | `be45d284-e229-11d2-aa69-00aa0068d2c0` | `0x180067b98` | `0x180003c70` | `0x18000c220` | `0x18000ca50` | `0x18000c510` | `0x18000cea0` |
| `RemoveAllShadersFromCnxPoint` | `46919ce1-ec5d-11d2-aa71-00aa0068d2c0` | `0x180067b60` | `0x180003c30` | `0x18000b5b0` | stub `0x18000c060` | `0x18000b7a0` | `0x18000c190` |
| `UIMapButton` (both registrations) | `34f30cd2-12b8-11d3-aa89-00aa0068d2c0` | `0x180068260` | `0x1800043b0` | `0x180038f50` | `0x18003a790` | `0x18003a280` | `0x18003b0a0` |
| `SIGetMaterialShader` | `5e28e280-24e7-11d3-bffa-00a0248f9397` | `0x180067cb0` | `0x180003db0` | `0x18000d0d0` | `0x18000da70` | `0x18000d240` | `0x18000dba0` |
| `ReplaceShader` | `91c3b502-3965-11d3-b22e-00a0c9a8ad15` | `0x1800680a0` | `0x1800041f0` | `0x180033a90` | `0x180035dc0` | `0x1800358e0` | `0x1800363f0` |
| `ReplaceShaderWithPreset` | `b5a3c021-3b8c-11d3-b22e-00a0c9a8ad15` | `0x180068110` | `0x180004230` | `0x180036d10` | `0x180037310` | `0x1800370e0` | `0x180037430` |
| `ReplaceShaderWithProgID` | `5db21aad-4449-4dd8-98a9-745e801059bd` | `0x1800680d8` | `0x1800041b0` | `0x180036620` | `0x180036a10` (no Ghidra function) | `0x1800367f0` | `0x180036ac0` |
| `SetInstanceDataValue` | `fae06638-2003-11d3-a06b-0000f875df68` | `0x180068148` | `0x180004270` | `0x18004a820` | `0x18004b6f0` | `0x18004abf0` | `0x18004bed0` |
| `SIRebindByNameUserData` | `4a1613c1-572c-4d7d-8e95-19271f58b0fc` | `0x180067ea8` then swapped to `0x180067ee0` | `0x180003890` | `0x180044d20` | `0x1800454f0` | `0x1800450a0` | `0x180045650` |
| `RenamePropAndRebind_Internal` | `cf3d546a-458d-4d02-ace0-b39ee913fdda` | `0x180067ff8` then swapped to `0x180068030` | `0x180003900` | `0x180046c70` | `0x180048af0` | `0x180048140` | `0x180048d60` |

## 2. Shared facts

- **Dispatch.** `DllGetClassObject` compares 24 CLSIDs inline (two 8-byte compares each), then a final
  negated compare for `3323a961-…` (`ReplaceShadersDefinition`). A match allocates a 0x48-byte class factory; two
  branches (`SIRebindByNameUserData`, `RenamePropAndRebind_Internal`) overwrite the factory vtable after
  construction and the second pointer is the live one. Factory slot 6 allocates the task and runs its constructor;
  the two swapped factories also call an init method on the new object (slot 7 of the vtable at +0x20) and release
  it on failure.
- **Object layouts.** Two shapes: (a) `C3DCoreBaseTask` first, `CDSCOMObject` at +0x20, task vtable at +0, worker
  vtable at +0x38 (most commands; Do forwards to worker slot 9); (b) a `CDSCOMObject`-first base
  (`0x180037540` or `0x1800402d0`) with the task part at +0x18 and a worker object at +0xb0
  (`AddObjectsToShader` / `RemoveObjectsFromShader` / `RemoveShaderFromCnxPoint` / `RemoveAllShadersFromCnxPoint` /
  `ReplaceShaderWithPreset`).
- **Not implemented here.** The CLSIDs of `SetReference2`, `SICreateMaterialDD`, `SIAddImageClip`,
  `SIAddArrayElement`, `SIRemoveArrayElement`, `SISwapArrayElements` and `bbbbee29-…` (shared by
  `CreateShadersFromMaterialPreset` / `CreateShaderFromCLSID` / `CreateShaderFromProgID` / `AddShaderAttachedComment`
  / `CreateShaderFromPreset`) are **not in the compare chain**. Several occur only as data (sub-task CLSIDs called
  from here, or the GUID table at `0x180065818…0x180065908`, which also lists the shader-compound commands). Their
  handlers are in another DLL; `data/command_registry.json` lists `shaderhelper.dll`, `sicoresdk.dll`, `sparks.dll`,
  `si3dobjectmodel.dll` and `propertytasks.dll` as candidates (row CMD-B12-SHADERHELPER). From the registry alone:
  the four `bbbbee29` commands share one task and differ only by the default of `PrivateInvokeMethod`
  (1 = from CLSID, 2 = from ProgID, 3 = attached comment, 4 = from material preset), all returning `Shader`.
- **Sub-tasks used** (CLSIDs read at `0x180065640…`): `SIAddArrayElement` (`17e2221e-…`),
  `SIRemoveArrayElement` (`a60a917a-…`), `SetReference2` (`de9980e7-…`), `ReplaceShader` (`91c3b502-…`),
  `SetValue` (`c089b901-…`, created with `CoCreateInstance`). Sub-tasks are added to the command's undo record
  (`AddTask`) only when the command runs with undo on and the sub-task returned S_OK.
- **Interactive pick result** `0x562e80c7` is passed through unchanged (UIMapButton).
- Error-handling raises use severity 2 with HRESULT `0x80004005` and a message id of the task's dictionary
  (`XSISHADERTASKS` presumably; texts not in the repo).

## 3. Contracts

### `AddObjectsToShader`: SPEC

Wire contract:
- Args: `InputObjs` (list, required), `Target` (the shader; first element of the `Target` list).
- UnPackArg: missing `InputObjs` or empty / unresolved `Target` → `0x80070057`.
- Do: the shader must pass the shader-object-array check (`0x1800377f0`; the shader must expose the "objects"
  array port, inferred) else `0x80070057`. For each input object, in list order:
  1. run `SIAddArrayElement` on the shader's object array (undoable flag = undo on) → new array element;
  2. run `SetReference2` setting that element (component kind `0x402`, element index) to a reference to the input
     object.
  Both sub-tasks are recorded for undo. If a sub-task cannot be created → `0x80004003`. Returns 0.
- `(inferred)`: the array is the shader's "objects / owners" list used by image clips and light-association shaders.

### `RemoveObjectsFromShader`: SPEC

Wire contract:
- Args: `InputObjs` (list), `Target` (shader). Same UnPackArg and shader check as `AddObjectsToShader`
  (`0x80070057`).
- Do: for each input object, walk every element of the shader's object array; an element is removed when it
  references that object (identity compare), or when it references nothing and the input item is itself empty.
  Each removal runs `SIRemoveArrayElement` (element index) as an undoable sub-task (`0x80004003` if it cannot be
  created). Elements that do not match are kept. Returns 0.

### `RemoveShaderFromCnxPoint`: SPEC

Wire contract:
- Args: `Source` (shader / list), `InputObjs` (connection points: parameters, required), `DeleteOnLastDisconnection`
  (bool, default true), output `CreatedObj`.
- UnPackArg: `InputObjs` and `Source` required (`0x80070057`); the shader is the first item of `Source` that answers
  the shader-node query (`6de1b670-7280-11d5-aeed-0090275802c9`); none → `0x80070057`.
- Do (worker `0x18000c510`): null shader or list → `0x80004003`. With undo on, the shader's current connections
  are first saved for undo. Inside a graph-update bracket, for each connection point: lock check (locked → lock
  error raised, point skipped); disconnect the shader from that point and dirty the ICE / shader attributes that
  depended on it; count the successful disconnects.
  - No disconnect → returns **1** (S_FALSE), nothing else.
  - Otherwise, if `DeleteOnLastDisconnection` is true, the shader's remaining connections are counted; when it is
    now unused it is **deleted** (with the undo flag) and `CreatedObj` stays empty; when it is still used,
    `CreatedObj` = the shader. If `DeleteOnLastDisconnection` is false, `CreatedObj` = the shader.
  - Returns 0.

### `RemoveAllShadersFromCnxPoint`: SPEC

Wire contract:
- Args: `InputObjs` (connection points, required), `Type` (`siShaderCnxPointType` bits, default
  `siShaderCnxPointAll`).
- UnPackArg: missing `InputObjs` → `0x80070057`; `Type` with neither bit 1 nor bit 2 set → `0x80070057`.
  Constructor default 0xffff.
- Do: for each connection point: resolve its owner and component (`GetParentAndTargetComponent`; unresolved →
  stop); lock check (locked → error raised, next point).
  - Without undo: clear every sub-shader on that point in one step (`SISCHelperClearSubShaders`).
  - With undo: collect the point's connected source objects; an object that is a shader node (query
    `0x1800659a8`) or a texture-layer-like object (query `0x180065f18`) is a candidate; it is kept when
    (`Type & 1` and it is **not** an image clip) or (`Type & 2` and it **is** an image clip — the
    interface at `0x180065638`, inferred to be image clip). Each kept shader is then removed with a
    `RemoveShaderFromCnxPoint` sub-task (same class, `DeleteOnLastDisconnection` false) and recorded for undo.
- `(inferred)` bit 1 = `siShaderCnxPointBasePorts` (shader nodes), bit 2 = image clips; `siShaderCnxPointAll` = 3.

### `UIMapButton`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (one scene object / cluster / group / layer; registry filter), `Flags` (registered twice, defaults
  0 and 1).
- UnPackArg: stores `Flags`; anchors the pop-up at the mouse cursor, or — when the window under the cursor is a
  Win32 `BUTTON` — at the button's right edge, one third down from its top. Never fails.
- Do: builds a shader pop-up menu for the input through the shader-menu helper (`C3DShaderMenuHelper`), shows it with
  `SITrackPopupMenu` (flags `0x102`, single-submenu menus open the submenu directly), runs the picked item through
  the helper, destroys the menu and **repeats while Shift is held** and the item asks to stay open. Returns 1; a
  `0x562e80c7` result from the helper is passed back. Null input → `0x80004003`.
- Missing: the menu items and their commands (`C3DShaderMenuHelper`, outside this DLL), the meaning of `Flags`.

### `SIGetMaterialShader`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs`, `Port` (`siMaterialPorts`, default `siMaterialPortSurface`), output `OutputObjs`.
- UnPackArg: `Port` > 9 → `0x80070057`.
- Do: creates a new list for `OutputObjs` and, for each input, finds the material (via the material category id;
  for an object, its material at the current time) and appends the shader connected to the chosen material port.
- Missing: the port-number → parameter mapping (10 ports; inferred SDK order surface 0, volume, environment,
  contour, displacement, shadow, photon, photon volume, bump, …), what is appended for an unconnected port.

### `ReplaceShader`: SPEC-PARTIAL

Wire contract:
- Args: `Source` (shader to replace), `Target` (replacement shader).
- UnPackArg: `Source` must resolve to a shader (`0x80070057` otherwise). When `Target` resolves as a list form
  (resolver result 1), `Source` is re-read as a list of objects and the command works in **list mode**.
- Do, single mode: one replace of Source by Target. List mode: for each object in `Source`, the shader it uses
  (query `ab9c2622-230d-11d2-8ed2-00a0248f947c`) is replaced by `Target`.
- Replace (worker): Source empty or Source == Target → `0x80070057`. Order: validate the source; if the source is
  the only user path and the target is still attached elsewhere, error `0x40` (severity 2, `0x80004005`) and stop;
  reconnect everything the source drove to the target; optionally move the source's inputs / parameter values to
  the target (two helpers, `0x180035230` / `0x180035450`, used when the target was free); finally disconnect /
  delete the source (`0x180034820`, inferred).
- Missing: the exact rules of the input / value transfer helpers.

### `ReplaceShaderWithPreset`: SPEC

Wire contract:
- Args: `Source` (shader), `PresetObj` (shader preset).
- UnPackArg: `Source` and `PresetObj` required (`0x80070057`); a soft reference to the source's container is kept.
- Do: build a new shader from `PresetObj` in the same container as the source (empty name); no shader created →
  `0x80070057`. Then run **`ReplaceShader`** (sub-task, source → new shader, recorded for undo). "Same as
  create-from-preset + `ReplaceShader`".

### `ReplaceShaderWithProgID`: SPEC-PARTIAL

Wire contract:
- Args: `ShaderToReplace`, `ProgID` (string, default empty).
- UnPackArg: `ShaderToReplace` must resolve and `ProgID` must be a non-empty string, else `0x80070057`.
- Do: looks up the shader definition for `ProgID` through the shader-definition manager
  (`DSQueryGenericObject`), then runs an internal "change definition" sub-task (class at `0x1800539e0`) on the
  shader with that definition; recorded for undo. Returns 0.
- Missing: what the definition swap keeps (parameter values with the same name, connections; inferred to match
  `ReplaceShadersDefinition`).

### `SetInstanceDataValue`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (shaders / properties holding instance data, default the selection), `InputObj` (the object the
  instance value belongs to), `Value` (variant).
- UnPackArg: failures of the argument getters are returned.
- Do: for the given holder, null holder or null `InputObj` → `0x80004003`; the owning object of `InputObj` is
  resolved and the per-object instance value is set to `Value` (holder slot 0x50, undo flag passed through).
- Missing: how a list of holders is walked and what kind of instance data (texture projection / user data) is
  written.

### `SIRebindByNameUserData`: SPEC-PARTIAL

Wire contract:
- Args: `Material` (material, required interface), `Source User Data Collection`, `Target User Data Collection`
  (lists).
- Do (worker `0x1800450a0`): null material → `0x80004003`; bad lists → `0x80070057`; clears earlier sub-tasks,
  builds a name map of the source user-data entries and rebinds every shader reference in the material that pointed
  at a source entry to the target entry with the same name (inferred from the name-map helpers `0x180044830` /
  `0x180044bb0` / `0x180045950`).
- Missing: the matching rule and what happens to entries with no partner.

### `RenamePropAndRebind_Internal`: SPEC-PARTIAL

Wire contract:
- Args: `Properties` (list, required), `PropertyName` (string), `UpdateRefs` (bool, default true),
  `UpdateWildcards` (bool, default true).
- UnPackArg: missing `Properties` → `0x80070057`; `PropertyName` not a string → `0x80070057`.
- Do (worker `0x180048140`): null → `0x80004003`. For each property: rename it by running **`SetValue`** on its
  `Name` with `PropertyName` (sub-task, recorded for undo); if a name check fails, error `0x6f` (severity 2,
  `0x80004005`) and stop. With `UpdateRefs`, shader parameters that referenced the old name are rewritten to the new
  one; with `UpdateWildcards`, wildcard references too (helpers `0x1800472d0`, `0x180048ed0`, `0x1800497d0`).
- Missing: the reference / wildcard rewrite rules and the exact error condition for `0x6f`.

## Open questions

1. Which DLL implements the ten commands listed as not implemented here (CLSIDs in section 2)?
2. `C3DShaderMenuHelper` menu contents for `UIMapButton`; meaning of `Flags` 0 / 1.
3. `SIGetMaterialShader` port numbering 0..9.
4. `ReplaceShader` transfer helpers and the condition for error `0x40`; texts of messages `0x40`, `0x6f`.
5. `ReplaceShaderWithProgID` definition-swap class `0x1800539e0`.
