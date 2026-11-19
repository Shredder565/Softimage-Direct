# CMD-B12g: shader compounds, shader trees and shader definitions read from `shadertasks.dll` (CreateShaderCompound, NestShaders, UnnestShaders, AddShaderCompoundPort, RemoveShaderCompoundPort, MoveShaderCompoundPort, RenameShaderCompoundPort, ExportShaderCompound, ImportShaderCompound, ExplodeShaderCompound, SetShaderCompoundProperties, SetShaderCompoundPortProperties, GetShaderCompoundPortProperties, ExportShaderTree, ImportShaderTree, ExportShaderDefinition, ReplaceShadersDefinition)

Row: **CMD-B12g**. Status: **SPEC** (8 names), **SPEC-PARTIAL** (9 names); per command below.
Run: 2026-11-19, si-analyst worker, unattended, batch 12 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\shadertasks.dll`, image base `0x180000000`,
sha256 `ef5c3ba68c4ba34423566ef96e5e575fe070f72cfb6f9a6b23b653835c5353c5`.
Method: `DllGetClassObject` (`0x180004670`) read in full to map each CLSID to its class factory; factory
vtable slot 6 read with `read_bytes` (it allocates the task and calls the constructor); constructors
decompiled to get the task vtables; task vtable slots 5 (Do) and 8 (UnPackArg) read with `read_bytes`;
Do, UnPackArg and selected worker methods decompiled. Worker methods were also located through the
callers of the `shaderhelper.dll` imports (`C3DShaderXMLHelper::SaveCompoundToFile`,
`LoadShaderTreeFromFile`, `C3DShaderVersioningHelper::CompareDefinitions`). Arguments and defaults from
`data/command_registry.json`. Message ids are ids of the dictionary `XSISHADERTASKS` (texts not in the repo).
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

All 17 handlers are in `shadertasks.dll` (inline CLSID compare chain in `DllGetClassObject`, 0x48-byte class
factory, factory slot 6 = create task). "Worker" is slot 9 of the vtable stored at task offset +0x38; most
Do slots only forward to it.

| Command | CLSID | Factory vtable | Create (slot 6) | Constructor (alloc) | Task vtable | Do (slot 5) | UnPackArg (slot 8) | Worker |
|---|---|---|---|---|---|---|---|---|
| `CreateShaderCompound` | `3b0965e0-dc2f-4bb6-818d-08cd2c3c6211` | `0x180067ab8` | `0x180003b70` | `0x180011240` (0x180) | `0x18006e8f0` | `0x180011cc0` | `0x180012680` | `0x1800117f0` |
| `NestShaders` | `482fe713-3adc-4a55-a11c-1c5d7d923266` | `0x180067e70` | `0x180003fb0` | `0x180024180` (0x138) | `0x180074e40` (at +0x18) | `0x180024c50` | `0x180025210` | not read |
| `UnnestShaders` | `7939d67b-77af-4649-ad94-7afa93943562` | `0x180068340` | `0x1800044b0` | `0x180025c80` (0xb0) | `0x180075710` | `0x1800261a0` | `0x1800264c0` | not read |
| `AddShaderCompoundPort` | `b4eca6f7-0b60-4769-a13f-fe8d1d0d404e` | `0x180067968` | `0x1800039f0` | `0x18000e2e0` (0xc8) | `0x18006de90` | `0x18000f9e0` | `0x18000fcf0` | `0x18000e9c0` (forwards again, slot 10; not read) |
| `RemoveShaderCompoundPort` | `4429f144-8c5d-499c-aafe-cbdc9ca57044` | `0x180067f88` | `0x1800040b0` | `0x18001b240` (0x118) | `0x180071f40` | `0x18001c580` (stub, no Ghidra function) | `0x18001ccc0` | `0x18001c3a0` |
| `MoveShaderCompoundPort` | `b88b985e-20e0-4771-b85c-d45d5027ddcd` | `0x180067e00` | `0x180003f30` | `0x180019120` (0xe0) | `0x180070b30` | `0x1800193d0` (does the work) | `0x180019c30` | – |
| `RenameShaderCompoundPort` | `41deb46b-b08f-4adb-a253-2427ed78b8e7` | `0x180068068` | `0x180004170` | `0x18001fc00` (0xf8) | `0x1800729b0` | `0x180020480` | `0x180020bb0` | `0x18001feb0` |
| `ExportShaderCompound` | `b1679add-fd7a-4e8c-acea-45ef795e7f7d` | `0x180067c08` | `0x180003cf0` | `0x18004efe0` (0xa8) | `0x1800844e0` | `0x18004f680` | `0x18004f7e0` | `0x18004f230` |
| `ImportShaderCompound` | `34f0f2e9-6f5b-4ace-a4a3-55c5ecb319f2` | `0x180067d90` | `0x180003eb0` | `0x180051660` (0xf0) | `0x180085f60` | `0x180051ad0` (shared with ImportShaderTree) | `0x180051fa0` | not read |
| `ExplodeShaderCompound` | `c95d3960-2733-4383-a941-833de2aa502c` | `0x180067bd0` | `0x180003cb0` | `0x180014de0` (0x58) | `0x18006f1c0` | `0x1800161c0` (stub) | `0x1800162d0` | `0x180014f70` (skimmed) |
| `SetShaderCompoundProperties` | `6e1f9169-09f8-4915-8b7a-68446ca86a37` | `0x180068180` | `0x1800042f0` | `0x1800225a0` (0x278) | `0x180073b80` | `0x180022aa0` (stub) | `0x180022c60` | not read |
| `SetShaderCompoundPortProperties` | `a5485033-b832-40fd-ba19-41752d542b81` | `0x1800681b8` | `0x1800042b0` | `0x180020c70` (0x200) | `0x180073210` | `0x180021f20` | `0x180022370` | not read |
| `GetShaderCompoundPortProperties` | `28a7cd73-9a39-4175-8539-53d8069dbffa` | `0x180067ce8` | `0x180003df0` | `0x180016820` (0xd0) | `0x18006fa50` | `0x1800172a0` | `0x180017d20` | not read |
| `ExportShaderTree` | `60c4f494-a0e4-42d6-b260-3ad35ae3497f` | `0x180067c78` | `0x180003d70` | `0x1800500b0` (0xb8) | `0x1800856c0` | `0x1800511a0` | `0x180051400` | not read |
| `ImportShaderTree` | `4127c28c-fde9-4325-bdd9-aafc0a83a9ba` | `0x180067dc8` | `0x180003ef0` | `0x180052250` (0x108) | `0x180086980` | `0x180051ad0` (shared) | `0x180052f40` | `0x1800525a0` |
| `ExportShaderDefinition` | `de3bfbe1-eab2-4a5d-a9d4-60ad12a00d8b` | `0x180067c40` | `0x180003d30` | `0x18004fa90` (0x88) | `0x180084d90` | `0x18004fd60` | `0x18004fea0` | not read |
| `ReplaceShadersDefinition` | `3323a961-6741-4860-8504-a54f490e0417` | `0x180068378` | `0x1800044f0` | `0x1800539e0` (0x160) | `0x180087670` (at +0x18) | `0x180054760` | `0x180055080` | caller of `CompareDefinitions` at `0x1800567f1` (not read) |

`NestShaders` / `UnnestShaders` are also listed under `modeltasks.dll` in the registry scan; the CLSIDs are
in `shadertasks.dll`'s compare chain, so `shadertasks.dll` implements them.

## 2. Shared facts

- **Compound resolution.** Commands whose argument is a compound (`InputObj` of
  `SetShaderCompoundProperties`, `Compound` of `ExportShaderCompound`, and by the same constructor layout
  the other compound commands, inferred) accept the object only when it resolves to exactly one item, then
  walk that item's components and take the first one that exposes the shader-compound interface
  `{403f1650-4473-474a-a595-9795ddd82fdf}`. No such component: `0x80070057` (SetShaderCompoundProperties) or
  a null compound handled later by the worker (ExportShaderCompound: `0x8000FFFF`).
- **Compound ports** are addressed through a port reference (element-reference type `0x402` + port index)
  built from "parent object and target component" of the given port. A port whose owner cannot be resolved
  gives `0x80070057`.
- **Lock check.** Commands that edit an existing compound port (Remove, Move, Rename) first check the
  owner's lock status with level mask `0xFFFF`; when locked they raise the standard lock error and return
  `0x80070005` without changing anything.
- **Field masks.** The Set...Properties commands copy each field only when its bit in `ModifyFlags` is set
  (see the contracts). The Do slot passes a null for each unset field, so an unset field is left unchanged.
- **File helpers.** File I/O is done by `shaderhelper.dll`'s `C3DShaderXMLHelper`
  (`SaveCompoundToFile(compound, path, forceEmbedded)`, `LoadCompoundFromFile(path, container, out compound)`,
  `SaveShaderTreeToFile(port list, path, displayName, category, forceEmbedded)`,
  `LoadShaderTreeFromFile(path, container, out created, …)`) and `C3DShaderVersioningHelper::CompareDefinitions`.
  The file layouts live in `shaderhelper.dll` (not opened, row CMD-B12-SHADERHELPER).
- **Preset type tag** of a render-tree compound file: the string `XSIRTCOMPOUND`. The UI file filter string
  `Presets and All Image Formats|*.Preset;` and the label `Shader Compounds` are in the string table.
- **Notifications.** CreateShaderCompound suspends port notifications while it restructures the tree
  (`C3DAutoSuspendPortNotifications`), resuming them before reconnecting.

## 3. Contracts

### `CreateShaderCompound`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (shader list, required), `Name` (string, default `""`), output `ShaderCompound`.
- Steps, in order:
  1. Clear the task's sub-tasks; validate the input list (helper `0x180014bc0`, not read: all inputs must be
     shaders of one container, inferred).
  2. Create a new shader-compound object in the inputs' container with the given `Name` (empty name: the
     container's default naming, inferred), via a creation sub-task.
  3. With port notifications suspended, run a second sub-task that moves the input shaders inside the new
     compound (the NestShaders behaviour, inferred from the second sub-task class sitting next to the
     NestShaders CLSID in `.rdata`).
  4. Record every connection that crosses the new compound boundary, first the input side then the output
     side; for each, expose a compound port (helpers `0x180013910`, `0x180012ba0`).
  5. Disconnect the recorded crossing connections, move the shaders, then reconnect each crossing connection
     through the new compound port.
  6. When recording undo, keep soft references to the compound and its container.
- Returns the new compound in `ShaderCompound`.
- Missing: the input validation rules, the default name, how port names are chosen for exposed ports.

### `NestShaders`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (shaders), `ShaderContainer` (target container; compound).
- Moves the given shaders into the container (inferred from the name and from its use by
  CreateShaderCompound). Handler located (Do `0x180024c50`); body not read.
- Missing: the whole worker.

### `UnnestShaders`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (shaders inside a compound), `ShaderContainer` (destination container).
- Moves the shaders out of their compound into `ShaderContainer` (inferred). Handler located; body not read.
- Missing: the whole worker.

### `AddShaderCompoundPort`: SPEC-PARTIAL

Wire contract:
- Args: `ShaderPort` (port of a shader inside the compound, required), `ShaderCompound` (required), output
  `ShaderCompoundPort`.
- Exposes the given inner port on the compound and returns the new compound port. Failure is reported with
  the literal text `AddCompoundPort Failed for ` + port name (string at `0x180072158`; attribution to this
  task inferred).
- Missing: the worker body (two forwarding levels; final method not read), naming of the new port.

### `RemoveShaderCompoundPort`: SPEC

Wire contract:
- Args: `InputObj` (compound port, required).
- Null `InputObj`: `0x80070057`. Locked owner: lock error, `0x80070005`.
- Resolves the port reference; failure is reported with the text
  `Unable to resolve reference in RemoveShaderCompoundPortTask` and its HRESULT is returned.
- Removes the port from the compound. The connections that went through the port (inside and outside) are
  collected into two lists and disconnected; when undo is recorded a soft reference to the port and the two
  lists are kept so undo can re-add the port and reconnect (helper `0x18001f200`; list handling inferred).

### `MoveShaderCompoundPort`: SPEC

Wire contract:
- Args: `InputObj` (compound port, required), `Step` (integer, default 1).
- Missing `InputObj` or `Step` = 0: `0x80070057`, nothing changes. Locked owner: lock error, `0x80070005`.
- Resolves the parent compound and the port's index; the port moves to index (current + `Step`) in the
  compound's port order (negative steps move up, inferred from the signed addition).
- If the compound refuses the move the command returns 1 (S_FALSE) with no change.
- When undo is recorded it stores the compound reference and the old / new indices.

### `RenameShaderCompoundPort`: SPEC

Wire contract:
- Args: `InputObj` (compound port, required), `Name` (string, required non-empty), `DisplayName` (string,
  default `""`), output `NewName`.
- Null `InputObj` or empty `Name`: no change (no error raised). Locked owner: lock error, no change.
- Reads the port's current name and display name; if either differs from `Name` / `DisplayName`, sets both.
- Reads back the name the compound actually gave the port (it can differ when the name was taken) into
  `NewName`.
- Undo stores old name, old display name, new name and the read-back name.

### `ExportShaderCompound`: SPEC

Wire contract:
- Args: `Compound` (required), `FullPath` (string, default `""`), `ForceEmbedded` (bool, default false),
  output `Output` (string).
- No compound: `0x8000FFFF`.
- The compound must have a non-empty name; otherwise message XSISHADERTASKS `0xd0` (severity 2) and
  `0x80004005`.
- Saves the compound to `FullPath` with `ForceEmbedded` (true embeds referenced sub-compounds, inferred);
  a save failure gives message XSISHADERTASKS `0xce` and `0x80004005`.
- On success `Output` = `FullPath`, then the file is registered with the preset / library manager under the
  type tag `XSIRTCOMPOUND` so the Render Tree compound list shows it (refresh step inferred from the calls).

### `ImportShaderCompound`: SPEC

Wire contract:
- Args: `Container` (render tree container, required), `Path` (string, default `""`), output `Compound`.
- Same path handling and errors as `ImportShaderTree` (shared Do `0x180051ad0`; `(inferred)` for the compound
  worker, which was not read): empty path `0x80070057`; a name that is not an existing file is looked up as a
  preset; not found or load failure `0x80004005`.
- Loads the compound from file into `Container` and returns it in `Compound`.

### `ExplodeShaderCompound`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (compound, required), output `OutputObjs` (the shaders that were inside).
- Not a compound: `0x8000FFFF`. Builds five sub-tasks (create / connect / disconnect / move / delete,
  inferred from five `SICreateInstance` calls added with `AddTask`) that move the inner shaders to the
  compound's container, rewire every connection through each compound port directly, and delete the compound.
- Missing: exact sub-task order and how inner shader names are kept unique.

### `SetShaderCompoundProperties`: SPEC

Wire contract:
- Args: `InputObj` (compound), `Name`, `Category`, `Description`, `Author`, `Date`, `VersionTag` (strings,
  default `""`), `VersionMajor`, `VersionMinor` (integers, default 0), `PPGLogic`, `PPGLogicLanguage`
  (strings), `BackgroundColor` (integer, default 0), `ModifyFlags` (default 2047), plus a hidden optional
  argument `Editable` (bool).
- `InputObj` that does not resolve to a compound (see 2): `0x80070057`.
- `ModifyFlags` bit i (i = 0..11) enables field i in this order: 0 Name, 1 Category, 2 Description,
  3 Author, 4 Date, 5 VersionTag, 6 VersionMajor, 7 VersionMinor, 8 PPGLogic, 9 PPGLogicLanguage,
  10 BackgroundColor, 11 Editable. The default 2047 sets bits 0..10. Bit 11 is forced off when no
  `Editable` argument is passed. Fields whose bit is clear are left unchanged. (Bit-to-field order is read
  from the order of the flag bytes against the argument reads; `(inferred)` only for the Do side, whose stub
  forwards to a worker not read.)

### `SetShaderCompoundPortProperties`: SPEC

Wire contract:
- Args: `InputObj` (compound port), `PPGMinValue`, `PPGMaxValue`, `PPGEnumValues` (strings), `PPGLayoutVisible`
  (bool), `PPGLayoutGroup`, `PPGLayoutTab` (strings), `RTLayoutVisible` (bool), `RTLayoutGroup` (string),
  `ModifyFlags` (default 255).
- `ModifyFlags` bit i enables field i: 0 PPGMinValue, 1 PPGMaxValue, 2 PPGEnumValues, 3 PPGLayoutVisible,
  4 PPGLayoutGroup, 5 PPGLayoutTab, 6 RTLayoutVisible, 7 RTLayoutGroup (attested on both sides: the Do slot
  passes a null for each field whose bit is clear). Unset fields are unchanged. Undo is recorded.
- Min / max / enum values are passed as strings (enum list format not read, row CMD-B12-SHADERHELPER).

### `GetShaderCompoundPortProperties`: SPEC-PARTIAL

Wire contract:
- Args: `InputObj` (compound port), output `OutputArgs` (array).
- Reads the same eight port properties as `SetShaderCompoundPortProperties` plus the port name and display
  name (eight output slots, each gated by a flag byte set in UnPackArg).
- Missing: the order of values in `OutputArgs` and which flags UnPackArg sets.

### `ExportShaderTree`: SPEC-PARTIAL

Wire contract:
- Args: `Shaders` (shaders / ports, required), `FullPath`, `DisplayName`, `Category` (strings, default `""`),
  `ForceEmbedded` (bool), output `Output`.
- Saves the given shader tree to `FullPath` with display name and category through
  `SaveShaderTreeToFile` (argument order from the Do slot and the import signature); errors and `Output`
  presumably as `ExportShaderCompound` (inferred).
- Missing: worker body (error messages, preset registration).

### `ImportShaderTree`: SPEC

Wire contract:
- Args: `Container` (required), `Path` (string, default `""`), output `CreatedShaders`.
- Clears the output list. Empty `Path`: `0x80070057`. Invalid container: the container check's HRESULT.
- `Path` is normalised as a file path; when it does not name an existing file it is resolved as a preset
  name in the shader-tree preset family (`SIFindPresetPath`); not found: `0x80004005`.
- Loads the tree into `Container`; load failure `0x80004005`. `CreatedShaders` receives the created shaders.
- When undo is recorded, keeps references to the container, the created shaders and the connected ports.

### `ExportShaderDefinition`: SPEC-PARTIAL

Wire contract:
- Args: `ShaderDefinition` (required), `FullPath` (string), output `Output`.
- Writes the shader definition to `FullPath` (the string `ShaderDefinition` is the file's element name,
  inferred) and returns the written path in `Output`.
- Missing: worker body and format.

### `ReplaceShadersDefinition`: SPEC-PARTIAL

Wire contract:
- Args: `Shaders` (instances), `NewDefinition` (shader definition), `InvokeMethod` (default 2), output
  `OutputLog` (string).
- All targeted instances must share one definition; otherwise the message `Invalid Target instance was
  supplied. All targeted instances must share the same definition.` is logged.
- Compares the old and new definitions port by port (`CompareDefinitions`) and rebuilds each instance on the
  new definition, keeping values and connections of matching ports (inferred); unparsable new definition:
  message `Failed to upgrade the shader. The new definition could not be parsed.` The port update log is
  returned in `OutputLog` (inferred).
- Missing: `InvokeMethod` values, the update rules, the log format.

## Open questions

1. Workers of NestShaders, UnnestShaders, AddShaderCompoundPort, GetShaderCompoundPortProperties,
   ExportShaderTree, ExportShaderDefinition, ReplaceShadersDefinition (locate via the vtable at task +0x38,
   slot 9).
2. File formats of `.xsirtcompound` / shader-tree presets / shader definitions: in `shaderhelper.dll`
   (new row CMD-B12-SHADERHELPER).
3. Texts of XSISHADERTASKS `0xce`, `0xd0`.
4. The class GUIDs `0x180065818` / `0x180065868` created by CreateShaderCompound (read the 16 bytes).
