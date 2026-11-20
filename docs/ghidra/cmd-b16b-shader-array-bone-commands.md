# CMD-B16b: shader-creation task `bbbbee29` and shader array tasks (`shadertasks.dll`), `SIAppendBone` (`viewinteraction.dll`); `SetReference2`, `Add3DObjectToScene`, `PaintWeights` still unlocated

Row: **CMD-B16b**. Status: **SPEC** (5 names: `CreateShaderFromCLSID`, `CreateShaderFromProgID`,
`AddShaderAttachedComment`, `SIAddArrayElement`, `SISwapArrayElements`), **SPEC-PARTIAL** (4 names:
`CreateShadersFromMaterialPreset`, `CreateShaderFromPreset`, `SIRemoveArrayElement`, `SIAppendBone`; see each
section), **not located** (3 names: `SetReference2`,
`Add3DObjectToScene`, `PaintWeights`).
Run: 2026-11-20, si-analyst worker, unattended, batch 16 (binary first, REA + Ghidra).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, all closed):
- `sicoresdk.dll` sha256 `971b3402f56662629d6980f147a7e65941e60478e6b3ed5bc5951e105e87da36` (caller only, see 2).
- `shaderhelper.dll` sha256 `96fb5d1f36369689d849288194a4cef9d654ae0e21ef3c76be7b8dc5fdc39a6a` (caller only).
- `xgs.dll` sha256 `60a8547a1a7e3eb4679b8230a09f45b64ab89f9c9aed4c762cb076c633e007e8` (caller only).
- `shadertasks.dll` sha256 `ef5c3ba68c4ba34423566ef96e5e575fe070f72cfb6f9a6b23b653835c5353c5`, image base
  `0x180000000` (**handler** of `bbbbee29`, `SIAddArrayElement`, `SIRemoveArrayElement`, `SISwapArrayElements`).
- `viewinteraction.dll` sha256 `1c94d24c3bd9bc01e94164b19e7c4848851316d5cb5b29a0a0843c004bee6f71` (**handler** of
  `SIAppendBone`).

Method: byte search of each CLSID (little-endian), `xrefs` + `resolve_containing_procedure` to classify each
reference (`DllGetClassObject` compare vs. a use); for the handlers: `DllGetClassObject` decompiled, factory vtable
(slot 6 = create) read, constructor decompiled for the task vtable (+0x18 in this COM-object-first layout) and the
worker vtable, task slot 5 (Do), slot 8 (UnPackArg) and worker slots decompiled. Every UnPackArg reads exactly the
registry argument names of its command (except where noted), which confirms the mapping.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

shadertasks.dll (`DllGetClassObject` `0x180004670`; factories 0x48 bytes; objects are `CDSCOMObject` first, task
part at +0x18, worker vtable at +0x38 of the object):

| Command(s) | CLSID | Factory vtable | Create (slot 6) | Ctor (size) | Do (task slot 5) | UnPackArg (slot 8) | Worker |
|---|---|---|---|---|---|---|---|
| `CreateShaderFromPreset` (0), `CreateShaderFromCLSID` (1), `CreateShaderFromProgID` (2), `AddShaderAttachedComment` (3), `CreateShadersFromMaterialPreset` (4) | `bbbbee29-9a74-46fc-8f43-bfebbabfd1bd` | `0x180067af0` | `0x180003bb0` | `0x18002c310` (0x180, also a `C3DEventTask` at +0x38, worker vtable `0x180078300` at +0x50) | `0x18002e250` | `0x18002ebf0` | slot 9 preset `0x18002d9b0`, slot 10 CLSID `0x18002d0f0`, slot 11 ProgID `0x18002de80`, slot 12 comment `0x18002cef0`, slot 13 material preset `0x18002d560` |
| `SIAddArrayElement` | `17e2221e-3c31-4bf7-b49a-4abf7ad010d8` | `0x1800678f8` | `0x180003970` | `0x1800065a0` (0xb8) | `0x180006f00` | `0x1800071d0` | slot 9 `0x180006d30` |
| `SIRemoveArrayElement` | `a60a917a-cf1c-4be0-b5d1-197d750a4d31` | `0x180067f18` | `0x180004030` | `0x1800074e0` (0xf8) | `0x180007f90` (stub, no Ghidra function) | `0x1800083b0` | slot 9 `0x180007b40` |
| `SISwapArrayElements` | `6fbe63cb-d6fc-47d0-8c6d-2e419127faa8` | `0x1800681f0` | `0x180004330` | `0x180009330` (0xa8) | `0x180009880` | `0x1800099d0` | slot 9 `0x180009570` |

viewinteraction.dll (`DllGetClassObject` `0x180025140`, ATL-style compare chain against GUIDs in .rdata; the
`SIAppendBone` CLSID is at `0x18021caf8`, also referenced by `DllRegisterServer`-type code):

| Command | CLSID | Execute (reads args) | Worker |
|---|---|---|---|
| `SIAppendBone` | `59c1e31d-bdf1-11d2-8433-00a0c961747d` | `0x180181080` (vtable `0x180250ee0`, slot 3) | slot 9 `0x180182060` |

## 2. Shared facts

- **`sicoresdk.dll` is not a handler.** It exports no `DllGetClassObject` (11034 exports checked). Each CLSID occurs
  once in its .rdata and is used by an object-model method that runs the command: `bbbbee29` by
  `CXSIParameterCore::ConnectFromPreset` and `ConnectFromProgID`, `SIAppendBone` by `CXSIChainRootCore::AddBone`,
  `PaintWeights` by `CXSIEnvelopeCore::SetDeformerWeights`, `Add3DObjectToScene` by `CXSIX3DObjectCore::AddGeometry`,
  `SIAddArrayElement` by `CXSIShaderArrayParameterCore::AddItem`, `SetReference2` by `0x180106300` (unnamed).
- **`shaderhelper.dll` and `xgs.dll` are not handlers.** shaderhelper has no `DllGetClassObject`; its `bbbbee29` and
  `SIAddArrayElement` CLSIDs (`0x1800dd848`, `0x1800dd828`) are used by `C3DShaderVersioningHelper`'s constructor.
  xgs's `bbbbee29` (`0x1800571c0`) is used by `0x180012fc0`, not by its `DllGetClassObject` (`0x180008f70`).
- **Correction to batch 12 (row CMD-B12-ELSE / note cmd-b12f):** `shadertasks.dll` **does** serve `bbbbee29`,
  `SIAddArrayElement`, `SIRemoveArrayElement` and `SISwapArrayElements`. Its compare chain loads the CLSIDs as
  64-bit immediates, so a byte search of the full 16-byte GUID only finds the `DllRegisterServer` /
  `DllUnregisterServer` copy; the batch-12 statement "not in the compare chain" is wrong for these four. `SetReference2`
  (`de9980e7-…`) is really absent from the chain.
- **Shader port reference.** The array tasks work on a "shader port reference" = (shader, port index); the
  `Object` argument is the first item of the list, resolved through interface `9c9baea6-…`-family helpers
  (`0x180065b38`). A port index of `0xffff` or a null shader means "not a port".
- **Array port test** (all three UnPackArgs): the port's definition (interface at `0x180065188`) must report type
  **`0x41`** (array, inferred) and a second attribute equal to 0; otherwise `0x80070057`.
- **Lock / read-only port** (all three workers): the port object (interface at `0x180065c78`) is asked a boolean
  (slot 11, inferred: "port is locked / driven"); true → message `XSISHADERTASKS` id `0xd7` logged with severity 2,
  `0x80004005`. Missing port object → id `0xd8` (remove) / `0xd9` (swap) and `0x80004005`.
- **Shader creation common steps** (`bbbbee29`, used below as "the usual"):
  (a) *container lock check* (`0x18002fc90`): the container is tested with lock mask `0xffff`; locked → lock error
  raised, `0x80070005`; (b) *add to container* (`0x18002e0f0`): the container must expose the shader-container
  interface `d52b0cc5-243e-4180-9213-10285ecaec3c`; if it also exposes `403f1650-4473-474a-a595-9795ddd82fdf`
  (inferred: a compound that only accepts some shader kinds) and the shader does not qualify, the add returns 1 and the
  command raises `XSISHADERTASKS` id `0xd2` (severity 2, `0x80004005`); (c) *register* (`0x18002eb30`, undo record,
  not decoded); (d) *event* (`0x18002fae0`): event `0x20510032` fired with (element reference to the new shader,
  its ProgID string) (inferred: "shader created" notification for the UI).
  Every path clears previously recorded sub-tasks first (`ClearTasks`) and stores the undo flag.
- **Container resolution** (UnPackArg): `Container` first item; it must report a positive count (slot `0xb8`). For
  modes other than 3 it is asked for the shader-container interface `d52b0cc5-…`; if it does not have it, its owner
  (slot `0x100`) is asked instead (inferred: a material's render tree via the material). Mode 3 asks for interface
  `41016b1a-b346-4d51-924b-b3b0b8ba7986` (inferred: "has attached comment" holder).

## 3. Contracts

### `CreateShaderFromCLSID`: SPEC

Args: `Clsid` (string), `Container`, `Name` (""), `PrivateInvokeMethod` = 1, return `Shader`.
- UnPackArg: `Clsid` read as a **string** and parsed to a GUID (failure of the read is returned); `Name` read.
- Behaviour, in order: null GUID → `0x80070057`. Container lock check (a). **The CLSID is passed straight to
  `SISCHelperCoCreateShader(clsid, I3DNestedShader)`; there is no CLSID-to-shader table.** Creation failure is
  returned. Add to container (b) — before naming. Name: `Name` if non-empty; otherwise the default name the custom SPDL
  indexer (`SIGetCustomSpdlIndexer`) has for that CLSID (field at +0x28 of its entry), when it has one; otherwise the
  shader keeps the name it was created with. Then `F3DUpgradeSPDLShader` (the created shader may be replaced by its
  upgraded version, which becomes the output), register (c), event (d). Returns S_OK.

**Wire contract:** `CreateShaderFromCLSID(Clsid, Container, Name="") → Shader`: instantiate the shader class whose
CLSID is given (the SPDL registry decides which shader that is), add it to the container's render tree, name it
`Name` or the SPDL default name.

### `CreateShaderFromProgID`: SPEC

Args: `ProgID` (""), `Container`, `Name` (""), method 2, return `Shader`.
- Behaviour: container lock check (a). `C3DProgIDHelper::GetShaderDefFromProgID(ProgID)`; no definition →
  `0x80004005`. The shader is instantiated from the definition (definition factory slot 18, flags 1, 0) and queried
  for the nested-shader interface (failure returned). Name = `Name` if non-empty, else the definition's name
  (interface `0x180065158` slot 5). Name applied, then add to container (b), register (c), event (d). S_OK.

**Wire contract:** `CreateShaderFromProgID(ProgID, Container, Name="") → Shader`; unknown ProgID ⇒ E_FAIL; default
name = shader definition name.

### `AddShaderAttachedComment`: SPEC

Args: `Container`, method 3, return `Shader`. UnPackArg does not read `Name`.
- Behaviour: no container → `0x80004003`. Lock check (a). The container must expose the comment-holder interface
  `41016b1a-…` else `0x80004005`; its current attached comment is queried (slot 4): only when that reports 1 with no
  object (no comment yet) does the command continue, else `0x80004005`. A comment object is created from preset
  **`Comment.Preset`** (class `77db4b2d-9e05-462c-a7c9-ed91d7783133`); attached to the holder (slot 5); register (c);
  event (d). Output `Shader` = the comment object.

**Wire contract:** `AddShaderAttachedComment(Container) → comment` created from `Comment.Preset` and attached to the
container; at most one per container (second call E_FAIL).

### `CreateShadersFromMaterialPreset`: SPEC-PARTIAL

Args: `PresetObj` (Preset), `Container`, method 4, return `Shader`.
- UnPackArg: preset via `F3DCmdGetPreset` (failure returned); no `Name`.
- Behaviour: preset or container missing → `0x80004003`. Lock check (a); `ClearTasks`.
  1. The preset is instantiated (`SICreateObjectAndUpgradeFromPreset`). If the object is **not a material** (no
     interface `0x180065d88`), it is only passed to a cleanup helper and the command fails (`0x80004005`).
  2. For a material: its parameters are walked (flag `0x1800`). For each parameter of variant type 3 with flag bit
     4 (inferred: a port with a shader connected) the connected shader is recorded together with the **material port's
     name** (`SISCShaderParameterInfo`), and the connection is **cut** by running the worker of
     `RemoveShaderFromCnxPoint` (`be45d284-e229-11d2-aa69-00aa0068d2c0`) on the shader and the port. The detached
     shaders are taken out of the preset's render tree (container interface slot 9, keeping their connection port
     references in a list).
  3. Each detached shader is added to `Container` (b) (id `0xd2` error as usual), and filed in a name → shader map
     keyed by a name built from the material port name (`0x18002c260`, not decoded).
  4. If the map is not empty, its first shader is registered (c) and kept as the command's main object.
  5. With undo on, a soft reference to every recorded port reference is stored.
- **Answer to PR #193 Q3:** the material's own parameter values are **not** copied to the container (the material
  object is only a carrier and is dropped, inferred from no copy step being present); shader-to-shader connections
  inside the preset are kept (the shaders move with their port references); the material-to-shader connections are
  removed, not re-made on the container.
- **Missing:** the exact name each shader gets (`0x18002c260`), which shader is returned in `Shader` (map order,
  inferred: first port in parameter order), and what the non-material branch does before failing.

**Wire contract:** `CreateShadersFromMaterialPreset(PresetObj, Container) → Shader`: the shaders plugged into the
preset material's ports are added to the container with their mutual connections; no material values; no
connections to the container's ports.

### `CreateShaderFromPreset`: SPEC-PARTIAL

Args: `PresetObj`, `Container`, `Name` (""), method 0 (registry default), return `Shader`.
- Do: no preset → `0x80004003`. Worker slot 9: lock check (a); a global generic object (`DSQueryGenericObject`,
  inferred: notification suspender) is acquired; the shader is created from the preset (`DSCreateObjectFromPreset`,
  queried for the nested-shader interface); named (`Name` or default); added (b); then the shader instance actually
  stored in the container is looked up in a hash of the container's shaders and becomes `Shader`; register (c);
  event (d). The generic object is released at the end.
- **Missing:** the lookup step in detail; whether `Name` empty keeps the preset name (inferred yes).

### `SIAddArrayElement`: SPEC

Args: `Object` (array port), return `OutputObj`.
- UnPackArg: `Object` resolved to a port reference; null shader / index `0xffff` → `0x80070057`; port must be an
  array (type `0x41`, see 2) else `0x80070057`.
- Do: worker slot 9 with (port reference, undo, out, 0).
- Worker: lock test (id `0xd7`, E_FAIL). The port's item definition (`0x180065b18`) is fetched; none → E_FAIL.
  A new element is **appended** to the array (port interface `4f3a1eff-1aaf-481f-a361-a458d7208a0e` slot 14, insert
  position argument 0 from Do, inferred: end); the output is the port reference (shader, new element index). With undo
  on, a soft reference to it is kept. The shader is notified (slot 26, inferred: dirty / refresh). S_OK.

**Wire contract:** `SIAddArrayElement(Object) → new element` at the end of the array parameter.

### `SIRemoveArrayElement`: SPEC-PARTIAL

Args (registry): `Object`, `Index` (0).
- **UnPackArg does not read `Index`.** `Object` must be an **element** of an array port: its parent port (slot 56)
  must be an array (type `0x41`, second attribute 0) and the element itself must have second attribute 0; else
  `0x80070057`.
- Worker (`0x180007b40`): no element / index `0xffff` → nothing. Element index 0 or `0xffff` (not a real element) →
  nothing. Parent array port object missing → id `0xd8`; locked → id `0xd7` (both E_FAIL with log).
  Otherwise: the element's connections are collected (`0x180008a60`); with undo on, the element's values and
  connections and two neighbour indices are saved; every collected connection is cut with the
  `RemoveShaderFromCnxPoint` worker; if the shader's owning model is a locked reference
  (`F3DIsReferencedLocked`), a sub-task (`0x180065238` class, not identified; inferred: reference delta recording)
  is run with flag `0x100` and added for undo; then the element is removed from the array (port interface slot 16);
  shader notified.
- **Missing:** Do stub (no Ghidra function), the delta sub-task identity, the return value (a register Ghidra did
  not track; return S_OK).

**Wire contract:** `SIRemoveArrayElement(Object=element)`: disconnects then deletes that element; `Index` is ignored.

### `SISwapArrayElements`: SPEC

Args: `Object` (array port), `IndexA` (0), `IndexB` (0).
- UnPackArg: `IndexA`, `IndexB` read as integers, each must be ≥ 0 else `0x80070057`; `Object` must be an array port
  as in 2.
- Do: worker slot 9 (port, IndexA, IndexB, undo).
- Worker: port object missing → id `0xd9`; locked → id `0xd7` (E_FAIL). Array interface missing → E_FAIL.
  `IndexA == IndexB` → S_OK, nothing done. The elements are walked in order; both indices must be **< element count**
  else `0x80070057`. The two elements are swapped (array slot 35); then, for each of the two elements, its
  connections / references are re-targeted from the old index to the new one (array slot 33 with flag 1), and the
  shader is notified. S_OK.

**Wire contract:** `SISwapArrayElements(Object, IndexA, IndexB)`: swap the two elements including their connections;
out of range ⇒ E_INVALIDARG; equal ⇒ no-op.

### `SIAppendBone` (`viewinteraction.dll`): SPEC-PARTIAL

Args: `InputObjs`, `Ex`, `Ey`, `Ez` (double, 0), `Pin` (true), `AlignRootToFirstBone` (false), return `Value`.
- Execute (`0x180181080`): reads Ex, Ey, Ez as VT_R8, Pin and AlignRootToFirstBone as booleans, `InputObjs` as a
  collection. **The collection must hold exactly one item**; otherwise the command returns 1 (S_FALSE) and does
  nothing. Interactive-pick status `0x562e80c7` is propagated. Calls the worker with (item, position (Ex, Ey, Ez),
  pin mode = Pin ? 1 : 2, align mode = AlignRootToFirstBone ? 3 : 2, undo, …, out new bone). If an object comes
  back it is written to `Value` (VT_UNKNOWN).
- Worker (`0x180182060`), observable steps:
  1. The input is resolved to its chain parts (root, last bone, effector, chain object; `0x180186550`); if that fails
     → returns 1, nothing.
  2. If the chain belongs to a referenced model (`F3DIsAReference`) → `0x80070005`.
  3. When align mode 3 (or 2) is asked, the root is of kind 3 (inferred: 3D chain) and Pin is on, the root is
     aligned to the first bone (helper slot 14 at +0xd0, flag = align true).
  4. A new bone is created after the last bone (helper at +0xb8 slot 10, class `0x18021bb48`); with undo on, object
     references to the new bone, the previous last bone and the effector are kept.
  5. The effector is moved to (Ex, Ey, Ez) and re-parented to the new bone (`0x180183f00`, not decoded); a chain
     operator object (class `0x18021d128`) is created and attached; with Pin on (mode 1, align off) the effector's
     global transform is kept using the user's compensation mode (`F3DGetCompensationMode`; 0 → no compensation,
     otherwise `0x7f` flags).
  6. If the chain has a "preferred / rest" property at the current time, it is updated (slots 67 / 103 of the
     chain).
  7. Output: the new bone.
- **Missing:** the bone placement helper (`0x180183f00`), how Ex/Ey/Ez are interpreted (global position of the new
  effector, inferred), the meaning of align mode 2 vs. 3 beyond the root alignment.

**Wire contract:** `SIAppendBone(InputObjs=[one chain element], Ex, Ey, Ez, Pin=true, AlignRootToFirstBone=false) →
new bone`: one bone appended at the end of the chain, effector moved to (Ex, Ey, Ez); referenced model ⇒
E_ACCESSDENIED; more or fewer than one input ⇒ S_FALSE, nothing.

### `SetReference2`, `Add3DObjectToScene`, `PaintWeights`: not located

- `SetReference2` (`de9980e7-…`): not in the `shadertasks.dll` chain (immediates checked), shaderhelper and
  sicoresdk have no `DllGetClassObject`; the only remaining registry candidate is **`tasks.dll`** (inferred).
- `Add3DObjectToScene` (`a0d59008-…`): modeltasks (batch 15a) and primtasks (callers only, DLL map) excluded,
  sicoresdk is a caller; remaining candidates **`tasks.dll`, `_3dobject2.dll`, `scnmgr.dll`**.
- `PaintWeights` (`73c34ae0-…`): optasks excluded (batch 12), sicoresdk is a caller; remaining candidate
  **`gap.dll`** (inferred by elimination).

## 4. Corrections for the wire agent

1. `CreateShaderFromCLSID`: drop the CLSID → ProgID table and the "not known in this build" failure path; the CLSID
   goes straight to shader instantiation (look the shader definition up by CLSID in the SPDL registry). Default name
   = SPDL default name for that CLSID; `Name` wins when non-empty.
2. All `bbbbee29` commands: a **locked container** fails with the lock error / `0x80070005` before anything is
   created; a compound that refuses the shader gives E_FAIL with the `XSISHADERTASKS` 0xd2 message.
3. `CreateShaderFromProgID`: unknown ProgID ⇒ E_FAIL (matches); default name = the definition's name.
4. `CreateShadersFromMaterialPreset`: a **non-material** preset fails (E_FAIL); for a material preset, add the
   shaders connected to the material's ports (with their mutual connections), not the material's values and not the
   material-to-shader connections; remove the "not yet attested" log for that question.
5. `AddShaderAttachedComment` (shellsB15Else.ts): it is the same task (method 3); create a comment object from
   `Comment.Preset`, attach it to the container, return it; second comment on the same container ⇒ E_FAIL; drop the
   "nothing is created" shell. Not undoable=false: it records undo like the others.
6. `SISwapArrayElements`: negative index ⇒ E_INVALIDARG at argument time; out-of-range ⇒ E_INVALIDARG; equal ⇒
   no-op (matches); also move each element's connections with it; a non-array `Object` ⇒ E_INVALIDARG (not a log).
7. `SIRemoveArrayElement` (shadertasksB12f helper): the command form takes the **element** as `Object` and ignores
   `Index`; it disconnects the element's connections before removing it.
8. `SIAppendBone`: require exactly one item in `InputObjs` (else return without doing anything, no throw); accept any
   chain element (root, bone, effector), not only an effector or root; referenced model ⇒ E_ACCESSDENIED; Pin true
   keeps the effector's global pose; AlignRootToFirstBone is done inside the task (only for a 3D chain with Pin on),
   not by running the `AlignRootToFirstBone` command; return the new bone as `Value`.
9. Batch-12 shells that call `SIAddArrayElement` / `SIRemoveArrayElement` as sub-tasks may now cite this note
   (handler `shadertasks.dll`) instead of "other DLL".

## 5. Open questions

1. `SetReference2`, `Add3DObjectToScene`, `PaintWeights` handlers: open `tasks.dll`, `gap.dll`, `_3dobject2.dll`,
   `scnmgr.dll` next (their chains may also use immediates: check the decompiled `DllGetClassObject`, not only a byte
   search of the full GUID).
2. Naming helper `0x18002c260` and returned shader of `CreateShadersFromMaterialPreset`.
3. `SIAppendBone` placement helper `0x180183f00` and chain-part resolver `0x180186550`.
4. `SIRemoveArrayElement` sub-task class at `0x180065238` (shadertasks).
5. Message texts of `XSISHADERTASKS` ids `0xd2`, `0xd7`, `0xd8`, `0xd9` (dictionary not in the repo).
