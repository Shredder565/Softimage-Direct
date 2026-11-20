# CMD-B15b: custom parameters, materials, user normals, overrides, cluster-property values and retarget mapping commands read from `propertytasks.dll`

Row: **CMD-B15b**. Status: **SPEC** for `SIAddCustomParam`/`SIAddCustomParameter`, `SIGetOverriddenParameters`,
`Add property extended`, `siWriteRetargetMapping`, `siWriteRetargetComponentData` and `SetClusterPropertyValues`;
**SPEC-PARTIAL** for `SICreateMaterialDD`, the five user-normal commands, the three override-entry names,
`SIRemoveEntryFromOverride`, `SIGetOriginalValueOfOverridden`, `siCreateRetargetMapping`; **not in this DLL**:
the user-tab/keyword commands, `MarkObjectDirty` and the `bbbbee29` shader-creation family (see 2).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\propertytasks.dll`, image base `0x180000000`,
sha256 `1ab76e3621d5523e13f0fd396a818bb10c766b2f572e5826d203e8c38010e243` (560 968 bytes, PE timestamp 1442478763).
Exports: `DllCanUnloadNow` `0x180043490`, `DllGetClassObject` `0x1800434a0`, `DllRegisterServer`, `DllUnregisterServer`.
Method: decompiled `DllGetClassObject` and decoded all 42 inline CLSID compares (two 8-byte compares each) to a
CLSID → factory-vtable table; read the factory vtables (slot 6 = create), decompiled the create functions and
constructors to get the task / worker vtables; read those vtables from `.rdata` and decompiled UnPackArg (task slot 8),
Do (task slot 5), RePackArg (task slot 9) and the worker each Do forwards to. Sub-task CLSIDs were read from the GUID
constants the workers pass to `SICreateInstance` and matched against `data/command_registry.json`. Message ids are
in the `XSIPROPERTYTASKS` dictionary (texts not in the repo). All statements are behaviour read from the binary unless
marked `(inferred)`.

## 1. Handler table

Two object shapes (see 3). For shape A (C3DCoreBaseTask first) the task vtable is at +0 and the worker vtable at
+0x38. For shape B (`CDSCOMObject` first) the task part is at +0x18 and the worker vtable at +0x38 of the object.
The user-normal family uses a third base (`0x180016160`) whose per-command virtual is **task slot 15**.

| Command | CLSID | Factory vtable | Create (slot 6) | Constructor | Do (slot 5) | Worker | UnPackArg |
|---|---|---|---|---|---|---|---|
| `SIAddCustomParam`, `SIAddCustomParameter` | `1d4d499c-d0c4-11d2-a5fa-00a0c9ec5ef7` | `0x180066518` | `0x1800409f0` | `0x180001a80` (B) | `0x180001ca0` | `0x180014380` (worker slot 10) | `0x1800023a0` (+ base `0x180002a60`, `0x1800150e0`) |
| `SICreateMaterialDD`, `SICreateMaterial` | `3b75c06e-4d3f-458a-b591-13b65ed6603a` | `0x180066470` | `0x180040df0` | `0x180022270` (A) | `0x180023100` | `0x180022660` (slot 9) | `0x180023680` |
| `CreateUserNormals` | `695279f7-58a5-4dd9-8380-d5da89ef2294` | `0x180066a20` | `0x180041230` | `0x180033c20` | `0x180037fb0` (shared stub → task slot 15) | `0x180033dc0` | `0x180034940` (shared) |
| `RemoveUserNormals` | `1ffdd217-e4c2-45c9-91da-b85c536314b4` | `0x180066a90` | `0x180040c70` | `0x180019d80` | `0x180037fb0` | `0x18001a0c0` | `0x180034940` |
| `SetVertexUserNormals` | `4ee3fc26-9412-465e-8b65-31be144e444a` | `0x180066b00` | `0x1800412f0` | `0x180036ce0` | `0x180037fb0` | `0x180036e70` | `0x180034940` |
| `SetPolygonUserNormals` | `30e91087-efb6-4e65-a6ef-8114b9537b36` | `0x180066b38` | `0x1800411f0` | `0x180032830` | `0x180037fb0` | `0x1800329c0` | `0x180034940` |
| `SetUserNormalValues` | `6bfbea8d-8dda-4be4-97ec-4af8e1821832` | `0x180066be0` | `0x180041270` | `0x180034a20` | `0x180036740` | `0x180035610` (vtable at +0x30, slot 9) | `0x180036850` |
| `SIAddShaderEntryToOverride`, `SIAddParameterEntryToOverride`, `SIAddConnectionEntryToOverride` (also `SIAddEntryToOverride`, `SIStoreProp`) | `51297d82-1ac1-11d3-9e82-00a0248f947c` | `0x180066630` | `0x180040a30` | `0x1800456f0` (A) | `0x180047aa0` | `0x180046dd0` (slot 12) | `0x1800487c0` (+ task slot 15 `0x1800462a0`) |
| `SIRemoveEntryFromOverride` | `9d6c1334-60ab-11d3-9e86-00a0248f947c` | `0x1800667b8` | `0x1800410f0` | `0x18004eb10` (A) | `0x1800502f0` | `0x18004fae0` (slot 10) | `0x180050bc0` (no Ghidra pseudocode) |
| `SIGetOriginalValueOfOverridden` | `7e0f4019-60d2-4395-a42f-06c26c7fd459` | `0x180066978` | `0x180040ef0` | `0x18004b4e0` (A) | `0x18004c6d0` | `0x18004b980` (slot 9) | `0x18004c7a0`; RePackArg `0x18004c700` |
| `SIGetOverriddenParameters` | `bc652f97-d8cf-4bc5-bfdd-7c2569f56729` | `0x1800669b0` | `0x180040eb0` | `0x18004aa00` (A) | `0x18004b2f0` | `0x18004abf0` (slot 9) | `0x18004b440`; RePackArg `0x18004b3c0` |
| `Add property extended` (no scripting name) | `dc53bba1-c468-11d3-acbd-0090275802bf` | `0x180066898` | `0x180041330` | `0x180038050` (A, base `0x180038600`) | `0x180038d10` (does the work; task slots 15/16/17 = `0x1800384a0`/`0x180038170`/`0x180038210`) | - | `0x180038520`; RePackArg `0x1800393d0` |
| `siCreateRetargetMapping` | `cbe3e960-1e81-4a77-a16f-28c075787a5c` | `0x180066cc0` | `0x180040e30` | `0x1800239a0` (B) | `0x180024560` | `0x180023b60` (slot 9) | `0x180024b90` |
| `siWriteRetargetMapping` | `b8b04cc5-fe11-438e-a42c-c7c58eb5c4b6` | `0x180066cf8` | `0x180041430` | `0x18003cb10` (B) | `0x18003d0c0` | `0x18003ceb0` (slot 9) | `0x18003d2f0` |
| `siWriteRetargetComponentData` | `06602467-ed04-48d7-9c52-c257b40768e2` | `0x180066d30` | `0x1800413f0` | `0x18003b380` (B) | `0x18003c040` | `0x18003b980` (slot 9) | `0x18003c450` |
| `SetClusterPropertyValues` (extra) | `35fba75e-3ddf-11d3-bc3c-00a0c9612b97` | `0x180066668` | `0x180040cb0` | `0x18001aef0` (A) | `0x18001be30` | `0x18001b4c0` (slot 9) | `0x18001cb10` |

## 2. Shared facts

- **Full `DllGetClassObject` chain** (42 CLSIDs, in compare order; factory vtable in brackets). Besides the rows
  above: `6fa26e30-…` `SIAddProp` [`0x1800665c0`, vtable swapped after construction], `b81121a4-…`
  `SIAssignMaterial` [`0x180066400`], `c11ffe86-…` `SIUnAssignMaterial` [`0x180066438`], `8507561c-2e48-41f0-86cd-4a9164ed03bb`
  (not in registry) [`0x180066940`], `16b8c6b2-d04a-11d2-a5fa-00a0c9ec5ef7` (not in registry; base add-custom-param
  task, inferred) [`0x1800664e0`], `c8d29760-fc30-11d2-99c2-00a0243f0e60` (not in registry) [`0x1800664a8`],
  `fc604326-…` `SetEnvelopeRefPoses` [`0x180066828`], `0f0baac3-1ceb-11d3-9e82-00a0248f947c` (override install task
  "ConnectShaderToCnxPoint") [`0x1800666a0`], `b683cd81-…` `SIAddPropEx` [`0x1800665f8`], `2975a557-…`
  `SIMakeLocal` [`0x180066748`], `bbee42c4-…` `RemoveCustomParam` [`0x180066780`], `d56b12d2-…`
  `EditParameterDefinition` [`0x180066710`], `099252a4-4083-11d3-9e84-00a0248f947c` (override install task "AddProp")
  [`0x1800666d8`], `5ea57724-5f1d-11d3-9e85-00a0248f947c` (override install task "SetValue") [`0x180066860`],
  `7df95d5e-…` `AddProxyParam` [`0x180066550`], `d3520b6e-21cd-11d4-a64f-00a0c9ec5ef7` (not in registry)
  [`0x1800667f0`], `3aece858-…` `Create2DMap` [`0x1800668d0`], `8d9c7d7d-…` `Create2DMapWithProjection` (11 names)
  [`0x180066908`], `e12a12d2-699a-11d4-a657-00a0c9ec5ef8` (not in registry) [`0x1800669e8`], `ee56a128-…`
  `ResetUserNormals` [`0x180066a58`], `5126b672-…` `AverageUserNormals` [`0x180066ac8`], `de521d76-…`
  `InvertUserNormals` [`0x180066b70`], `813832c9-…` `NormalizeUserNormals` [`0x180066ba8`], `46ce9bdb-…`
  `CopyUserNormals` [`0x180066c18`], `fa8161f0-…` and `1ff0fd91-…` `PasteUserNormals` [`0x180066c50`,
  `0x180066c88`], and a final negated compare for `1ffd73c3-560f-4977-bc17-ffe502b23fdc` (not in registry; "Override
  Update Task", inferred from the description-string table) [`0x180066d68`]. A miss returns `0x80040111`
  (CLASS_E_CLASSNOTAVAILABLE). These extra rows are listed for the wire agent; they were not specified here.
- **Not in this DLL** (CLSID absent from the compare chain):
  - `SetUserTab` `c2791895-…`, `GetUserTab` / `GetUserKeyword` `77651a51-…`, `ClearUserTab` `49b512d9-…`,
    `RemoveUserTab` / `RemoveUserKeyword` `f4b294dd-…`: registry candidates `siuitasks.dll` (`77651a51` also
    `graphic.dll`, `sceneexplorer.dll`). They are already SPEC from `siuitasks.dll` (CMD-B7a), which agrees.
  - `MarkObjectDirty`: registry CLSID is all zeros and lists no handler DLL; not a task CLSID, not here.
  - `bbbbee29-9a74-46fc-8f43-bfebbabfd1bd` (`CreateShaderFromCLSID`, `CreateShaderFromProgID`,
    `CreateShadersFromMaterialPreset`, `AddShaderAttachedComment`): not in the chain. Registry candidates still
    open: `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll`, `si3dobjectmodel.dll`,
    `sicoresdk.dll` (`shadertasks.dll` was excluded in batch 12).
- **Object shapes.** A: `C3DCoreBaseTask` at +0, `CDSCOMObject` at +0x20, worker at +0x38; Do forwards to a worker
  slot. B: `CDSCOMObject` at +0, task part at +0x18, worker vtable at +0x38 (`SIAddCustomParam`, the three retarget
  commands). User normals: base `0x180016160` + `CDSCOMObject` at +0x38, a list at +0x58 (`InputObjs`), bleed flag at
  +0x20, optional "objects to freeze" list at +0x28.
- **Lock / error conventions.** `0x80070057` (E_INVALIDARG) for bad arguments; `0x80004003` (E_POINTER) for null
  inputs; `0x80070005` when a `CSILockStatus` check fails (the lock error is raised first); `0x80004005` when a
  sub-task fails; `0x562e80c7` = "cancelled by user" passthrough; `0x562e80d2` = "nothing to do" (logged, not an error).
- **Sub-task classes used** (class / interface, matched to the registry): `SICreateCluster` `5f1f5161-…`/`…5162`,
  `SIAddToCluster` `5f1f5165-…`/`…5166`, `SIRemoveFromCluster` `5f1f5167-…`/`…5168`, `SIAddProp` `6fa26e30-…`/`…31`,
  `SetClusterPropertyValues` `35fba75e-…`/`…5f`, `FreezeObj` `761b65c4-…`/`…c5`, `DeleteObj` `dd531990-…`/`…92`,
  `ApplyOperator` `46cee370-…`/`…71`, `SetValue` `c089b901-…`/`…02`, `SIApplyShader` `41080962-…`/`…61`,
  `SIAssignMaterial` `b81121a4-…` (IID `82fa84cd-…`), `SIDuplicate` `747d257f-…`/`…7e`. All are added to the
  command's undo record only when the command runs with undo on and the sub-task returned S_OK.

## 3. Contracts

### `SIAddCustomParam` / `SIAddCustomParameter`: SPEC

Both names share one task; they differ only in registry flags (the low-level name is the non-undoable/internal one,
inferred from flags `537133058` vs `262282`).

Wire contract:
- Args: `InputObj` (custom property set), `ScriptName` (default `"ParamName"`), `VarType` (`siVariantType`, default
  `siDouble` = 5), `DefaultValue`, `MinValue` (0.0), `MaxValue` (1.0), `Classification` (default 32768 =
  `siClassifUnknown`), `Capabilities` (default 5), `SuggMin` (0.0), `SuggMax` (0.0), `ParamName` (""),
  `Description` (""). Also read when present (not in the registry): `ParamGuid` (16-byte GUID; zero GUID when
  absent).
- UnPackArg: `ScriptName` empty → `0x8007000E` returned; otherwise the name is passed through `ValidateNameSyntax`
  and the corrected spelling is used if it was changed. `VarType` converted to an I2; `MinValue` / `MaxValue` /
  `SuggMin` / `SuggMax` converted to double; `Classification` / `Capabilities` to I2.
- Do: nothing happens (returns 0) if the script name is empty. `ParamName` defaults to the script name;
  `Description` defaults to the script name. Value set:
  - `VarType` = 8 (string): default = `DefaultValue` unchanged; min, max, suggested min and suggested max are empty
    strings.
  - Otherwise: min = `MinValue`, max = `MaxValue`; suggested range = `SuggMin`/`SuggMax`, **but when
    SuggMin == SuggMax the suggested range is replaced by Min/Max**; default, min, max, suggested min and suggested
    max are all converted to `VarType`.
- Worker (`0x180014380`): for numeric types it validates min ≤ max and sugg-min ≤ sugg-max (`0x180014f30`); finds
  or creates the parameter container on the target (`0x180013800`); an unsupported `VarType` (bit not in mask
  `0xcf093c` for VT < 24) → raise `0x80004005`, message 0x2b. Container result 1 → warning message 0x3e logged;
  `0x562e80d2` → warning 0x2c. The script name is validated again and made unique on the property
  (unique-name service `76332573-d242-11d0-b69c-00aa003b3ea6`, slot 10); if `ParamGuid` is zero a new GUID is
  generated. The parameter definition is created through the param dictionary (`8ef54030-3e58-11d1-b6e8-00aa003b3ea6`)
  with string type `10a02540-000b-…` for `VT_BSTR` and `10a02540-0002-…` otherwise. Capabilities: bit 0 is cleared
  for non-numeric types; if bit 0x800 is set, bit 0x1000 is cleared; bit 4 is always added. If capabilities include
  0x800 or 0x1000 the global event `SI3D_KEYABLEPARAMETER_CHANGED` is fired. Returns 0 (failure codes as above).

### `SICreateMaterialDD` / `SICreateMaterial`: SPEC-PARTIAL

Wire contract:
- Args: `PresetObj` (shader or material preset, optional), `Name` (""), `Library` (material library, optional),
  `Objects` (assign list, optional), `AssignToList` (true), `Initialize` (true), output `OutputObjs`.
- UnPackArg: `Library` (component-hierarchy), `Name` (string, required), `Objects` (if the variant is empty an empty
  list is created), `PresetObj` (wrapped in a 0x28-byte preset holder `0x180003ba0`), `AssignToList` (when false the
  `Objects` list is cleared), `Initialize` (stored as `== 1`).
- Do / worker (`0x180022660`): library = `Library`, or the current library from the sources container
  (`da6ee53b-…`), falling back to the scene's default library. Library lock level 1 → lock error, return.
  - If the preset's class is the material class `4c4f7500-51ef-11d0-854e-00a02417d029`, the preset object itself
    becomes the new material.
  - Otherwise a new material of class `4c4f7500-…` is created; when a shader preset is given, `SIApplyShader`
    (`41080962-…`) runs with the preset on that material (added to undo).
  - If `Name` is non-empty the material is renamed.
  - `F3DAddToLibrary(material, library)`.
  - When `Objects` is non-empty, `SIAssignMaterial` (`b81121a4-…`) runs with the list and the material (added to
    undo).
  - The material is added to the `OutputObjs` list.
- Missing: exact use of `Initialize` (stored at +0x120, passed to the preset path) and the redo path.

### User-normal family (`CreateUserNormals`, `RemoveUserNormals`, `SetVertexUserNormals`, `SetPolygonUserNormals`): SPEC-PARTIAL

Shared:
- Args: `InputObjs` (sample / polygon / object selection), `BleedSelection` (registry: no default, flag 130). The
  constructor initialises the bleed flag from preference `TweakNormals.bleedselection`; UnPackArg overrides it from
  the argument when given (converted to bool); RePackArg (`0x180037fd0`) writes the flag back to `BleedSelection`.
- Do stub `0x180037fb0`: calls task slot 15 with (`InputObjs` list, bleed flag, undo flag).
- Gather (`0x180018210`): for each input item it takes the item's object and sub-component; when the selection is a
  whole object the object's full component set is used. It reads the polygon-mesh geometry
  (`400cce30-4400-11d0-bddd-00a0241981e2`) at the current time and builds, per object, a map of **samples**
  (node/sample index) with the sample's current normal, an accumulation count, and the user-normal cluster the sample
  already belongs to (if any). If a "tweak component" tool is active (generic object `0f496811-…`), the selection is
  additionally expanded through it (bleed, inferred). Empty result → warning message 8 (`XSIPROPERTYTASKS`) logged,
  return 1.
- Creating the user-normal storage (`0x180016780` + `0x180016470`), when an object has no user-normal cluster yet:
  1. `SICreateCluster` with type GUID `0e1a4f60-0509-11d1-aa94-00a0243e34c4` (sample cluster), name
     **`User_Normal_Cluster`**, mode 3, the object, flags 1/1 → new cluster (added to undo);
  2. `SIAddProp` with command preset **`User Normal Property`** (preset family `50830560-31b5-…`) on that cluster,
     propagation 2 → new cluster property; it is then initialised (interface `04d2e5b0-…`).
- Writing values (`0x1800193a0`): `SetClusterPropertyValues` sub-task on the cluster property with Offsets = the
  cluster element indices and Values = n×3 doubles, mode 0, clamp 0, undo on. For 3-component properties the same
  values are also pushed to existing user-normal editing operators found on the property (operator category
  `a6a187bd-5713-4eea-962a-b70e36dcabab`, inferred). If the scene setting checked at `0x180019140` is on, the object
  is queued in the +0x28 list; at the end of the command (`0x180018fe0`) `FreezeObj` runs on that list at the current
  frame, mode 3 (undoable).
- Per command:
  - `CreateUserNormals` (`0x180033dc0`): samples not yet in the cluster are added to it (`SIAddToCluster`, creating
    the cluster/property first if needed) and their **current geometric normals** are written.
  - `RemoveUserNormals` (`0x18001a0c0`): samples that are in the cluster are grouped per cluster and removed with
    `SIRemoveFromCluster`; a cluster left with 0 elements is deleted with `DeleteObj` (undoable). No values written.
  - `SetVertexUserNormals` (`0x180036e70`): for each sample, its vertex (geometry slot 60) normal (slot 103) is
    written; samples missing from the cluster are first added.
  - `SetPolygonUserNormals` (`0x1800329c0`): for each sample, the accumulated normal is averaged (when count > 1) and
    normalised (length threshold 1e-12; a zero-length result counts as no data); samples with no accumulated data use
    their polygon's (slot 62) polygon normal (slot 37). Then written as above.
- Missing: the exact gather / bleed expansion rules, the setting behind `0x180019140`, and the vertex/polygon
  normal formulas inside the geometry object.

### `SetUserNormalValues`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (object, required), `Indices` (sample indices: scalar or array), `Values` (array of doubles).
- UnPackArg: the first element of `InputObj` must resolve to a 3D object, else `0x80070057`. `Indices` missing →
  `0x80070057`; each element converted to UI4. `Values` must be an array (else `0x80070057`); each element converted
  to double. **Values count must be 3 (one normal for all indices) or 3 × Indices count**, else `0x80070057`.
- Do (`0x180036740`) → worker `0x180035610`: same create-cluster / add-to-cluster / `SetClusterPropertyValues` /
  freeze path as the family above, with the supplied normals instead of computed ones (`0x180034bf0` builds the
  sample map from the given indices and values). Empty map → message 8 logged, return 1.

### `SIAddShaderEntryToOverride` / `SIAddParameterEntryToOverride` / `SIAddConnectionEntryToOverride` (also `SIAddEntryToOverride`, `SIStoreProp`): SPEC-PARTIAL

One task (description string `SI.3D.AddEntryToOverrideTask`); the names differ by registry default of `Type`:
connection 0, shader 0, parameter 2, store-prop 1, generic `SIAddEntryToOverride` 65535 (ask).
Wire contract:
- Args (union over the names): `InputObj` (the override property), `InputObjs` (parameters / properties to add),
  `Type` (I2), `Value` (parameter value for type 2), `Path`, `PresetObj`, `Name` (shader variant).
- UnPackArg: allocates a 0x48-byte argument block once; reads `InputObjs`; task slot 15 (`0x1800462a0`) scans the
  list for an item exposing the override interface `502f2040-1a08-11d3-9e82-00a0248f947c`, removes it from the list
  and uses it as the override; if none, `InputObj` is used. Then `Type`, `Value`, `Path`. Called twice →
  `0x8000FFFF`.
- Do (`0x180047aa0`, inside a graph-update bracket): no override → raise `0x80070057`, message 0x3fc, return 1.
  Worker `0x180046dd0`, per input item:
  - classification (`0x180046000`): the item's owner property (`cdea6777-…`) compared with the item; the whole
    property → kind **1** (property entry); a parameter whose capability attribute (`5e373ed1-…`) has bit 0 set →
    kind **0**; a parameter whose value type is a simple scalar (VT mask `0xcf083c`) → kind = `Type` when `Type` is
    0 or 2; when `Type` is anything else (65535) the user is asked (dialog resource 0x65; button 1000 → 0, else 2;
    the answer is remembered for the rest of the list; with no UI the type is left unchanged). A kind of 1 for an
    unsupported item logs warning 0xc and skips it.
  - kind 0 → worker slot 9 `0x180046c00`: connection/shader entry, installed through override-install class
    `0f0baac3-…` with the parameter's path (empty path → warning 0xd, skip); the entry's shader class defaults to
    `5e373ee5-1085-11d3-b0b7-00a0c982a112` or the parameter's own class attribute (`5e373ede-…`).
  - kind 1 → worker slot 10 `0x1800472b0`: property entry through install class `099252a4-…`; properties with
    a branch/propagation value ≥ 3 are first duplicated (`SIDuplicate`).
  - kind 2 → worker slot 11 `0x1800470e0`: parameter-value entry through install class `5ea57724-…`, value =
    `Value` when given, else the parameter's current value (empty → `0x80070057`).
  - each created entry is added to a returned list; the override is soft-referenced for undo.
  Returns 0 when at least one entry was added, else 1.
- Missing: what `PresetObj` / `Name` / `Path` change for the shader variant (not read by this UnPackArg; inferred
  to be consumed by the registry's other handler DLLs or unused), and the exact install-task argument layouts.

### `SIRemoveEntryFromOverride`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (override entry parameters; registry filter `dce682f1-…`).
- Do (`0x1800502f0`, graph-update bracket) → worker slot 10 `0x18004fae0` (list, undo flag): null list →
  `0x80004003`. Entries are grouped by their override (interface `502f2040-…`), the indices sorted, and each entry is
  removed from its override (override slot 23); S_OK and `0x00040001` are both accepted.
- Missing: UnPackArg `0x180050bc0` has no Ghidra function body (argument handling inferred from the registry).

### `SIGetOriginalValueOfOverridden`: SPEC-PARTIAL

Wire contract:
- Args: `Target` (overridden parameter, required), `Time` (frames, required), output `Value`.
- UnPackArg: null context → `0x80004003`; `Target` as element reference; `Time` read as a double in frames and
  converted to seconds.
- Do → worker `0x18004b980`: finds the override that drives the parameter (override entry `502f2040-…`) and reads
  the value the parameter would have without it at that time, copying arrays element-wise. Not overridden → message
  logged and raise.
- RePackArg: writes `Value` unless the stored result is VT_UNKNOWN (13). Returns 1 on success (S_FALSE marks "no
  undo record", inferred).
- Missing: exact error message ids and the array-copy cases.

### `SIGetOverriddenParameters`: SPEC

Wire contract:
- Args: `Target` (an override entry parameter), output `OutputObjs`.
- UnPackArg: null context → `0x80004003`; `Target` as element reference.
- Do → worker `0x18004abf0`: creates the output list; the target must expose the override interface on its owner
  (`502f2040-…`); the entry index is taken from the target's sub-component. The override returns the objects the
  entry applies to; for each, the parameters at the entry's path are looked up with the path-resolver class
  `24be99c0-5eb6-11d2-8bb0-00aa00135f7b` (slot 32) and appended to the list. Not an override entry → warning
  message 7 logged. Errors are raised with their HRESULT.
- RePackArg `0x18004b3c0`: `OutputObjs` = the list (VT_UNKNOWN). Returns 1.

### `Add property extended`: SPEC

Wire contract:
- Args: `Property` (existing property object to add, component-hierarchy, required), `InputObjs` (list),
  `PropagationType` (`siPropagationType`, default `siDefaultPropagation`), outputs `Value` (list) and `CreatedObj`.
- UnPackArg: `InputObjs` (list), `Property`, `PropagationType` (I2).
- Do (`0x180038d10`): empty `InputObjs` → log message 0x2b, return `0x562e80d2`. Property name / branch are taken
  from `Property` (`0x180038af0`, `0x180038a00`); branch flag: propagation 1 → 1, 2 → 0, otherwise 3; message id
  0x3c. When the name says "inspect" and preference `Interaction.autoinspect` is on, every input object that does
  not yet have that property is checked with `SIIsAnimated`; an animated one triggers a yes/no question (catalogue
  `simsgcat`, message 0x3c); answering No returns `0x562e80c7` (cancelled). Then for each input object an
  `SIAddProp` sub-task (`6fa26e30-…`, slot 11 = add-existing variant) runs with (`Property`, object,
  `PropagationType`, 1, undo flag); each resulting property is appended to `Value`. Failures raise `0x80004005`
  with message 0x2b.
- RePackArg: `Value` = list; `CreatedObj` when set.

### `siCreateRetargetMapping`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (list; first item = rig reference, others = mapped objects).
- UnPackArg: null context → `0x80004003`; `InputObjs` list.
- Do → worker `0x180023b60` (list, undo flag): reads the first item's global transform (kinematic state
  `1800646e0`/`1800642b0`) and zeroes its rotation. For each list item: its global transform; its first primary
  owner of the model category (`F3DFindFirstPrimaryOwnerOfCatID`) and that owner's global transform (identity when
  no owner). Two relative transforms are computed (owner relative to rig root, item relative to owner) and written to
  the item's retarget-mapping property (`180064800`, slots 7 and 9). With undo, old values are saved first and the
  list is soft-referenced.
- Missing: identity of the property / category GUIDs, rotation-order details.

### `siWriteRetargetMapping`: SPEC

Wire contract:
- Args: `InputObjs`; `Sx Sy Sz` (1.0), `Rx Ry Rz` (0.0, degrees, XYZ order 0), `Tx Ty Tz` (0.0), and the same nine
  with prefix `P2M_` (defaults 1/0/0).
- UnPackArg: every argument is required (any missing → that HRESULT). Each S/R/T triple builds a transform; a
  scale component with |s| < 1e-12 is replaced by ±1e-12 (sign kept).
- Do → worker `0x18003ceb0`: the first input item's object; its retarget-mapping property (`180064800` /
  `1800647b0`) at the current time; with undo the old two transforms are saved (slots 8 and 6). Then slot 9 ← the
  S/R/T transform and slot 7 ← the `P2M_` transform. Null list → `0x80004003`.

### `siWriteRetargetComponentData`: SPEC

Wire contract:
- Args: `InputObjs`, `Parameter list` (string, required to be a BSTR else `0x80070057`; default "").
- UnPackArg: first item of `InputObjs` resolved to its object; the string copied.
- Do → worker `0x18003b980`: the object's retarget-structure property (`180064810` / `1800647c0`). With undo the
  current content is saved first. The string (with an excluded character stripped) is:
  - `clear` (case-insensitive) → the property's component data is cleared (slot 5);
  - otherwise a comma-separated record: `name0,name1,chainType,count,` followed by `count` pairs
    `objectName,role`. Chain type: `ik` → 2, `ik_contact` → 3, `fk` → 6, anything else → 1. Role: `root` → 1,
    `fk` → 2, `ik_effector` → 3, `ik_contact` → 4, `upvector` → 5, anything else → 2. The record is added with
    slot 8. Undo keeps an element reference to the object (class `180064300`).

### `SetClusterPropertyValues` (extra, handler found here): SPEC

Wire contract:
- Args: `ClusterProp` (required), `Offsets` (scalar or array; empty = all elements), `Values`, `Mode`
  (`siSetValueMode`, default absolute), `ClampValues` (false).
- UnPackArg: `ClusterProp` resolved (interface `04d2e5b0-…`); its value dimension read (slot 18). Offsets packed as
  a count-prefixed UI4 block; when empty, the cluster's element count is used. `Values` packed as count, dimension,
  then count×dimension doubles:
  - scalar value: only allowed when dimension is 1; broadcast to every offset;
  - array of exactly `dimension` items: the same tuple is used for every offset; at least one item must be a number;
  - array of count×dimension items: one tuple per offset;
  - any other size → `0x80070057`; an empty / null item stores the sentinel `DBL_MAX` (= leave unchanged).
  `Mode` (byte) and `ClampValues` stored. Any `0x80070057` raises message 0xf composed with the property name.
- Do → worker `0x18001b4c0`: null inputs → `0x80004003`; lock level 4 → `0x80070005`. Finds an existing "set cluster
  property values" operator on the property (`0x18001b320`); if none and the property is not locked, applies one
  with `ApplyOperator` (operator class `eb201e32-3b9d-11d3-bc3b-00a0c9612b97`, port group `ce9a5031-…`, mode 3,
  undoable). The new values are merged with the operator's stored offset/value arrays (mode and clamp applied in
  `0x18001c240`), then written to the operator parameters `eb201e33-…` (offsets) and `20eb73dc-…` (values) with two
  `SetValue` sub-tasks (undoable). Mismatch → raise `0x80070057`, message 0xf.

## 4. Open questions

- `SIRemoveEntryFromOverride` UnPackArg `0x180050bc0` has no decompiled body.
- The six chain CLSIDs not in the registry (`8507561c`, `16b8c6b2`, `c8d29760`, `d3520b6e`, `e12a12d2`,
  `1ffd73c3`) are internal tasks; names inferred only from the description-string table ("Set values on a user data
  map", "Base Add Custom Param Task", "Add Bounding Volumes property Task", "SI.3D.UIAddParticleTask",
  "SI.3D.RemoveProxyParamTask", "Override Update Task").
- User-normal gather/bleed rules and the freeze trigger setting.
- `bbbbee29` shader-creation commands remain unlocated.
