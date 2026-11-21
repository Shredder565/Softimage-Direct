# CMD-B19b: scene New/Open/Save/DeleteAll, Copy/Cut/Paste, CopyUVW/PasteUVW, layers, loop selection, presets, environments and other `tasks.dll` handlers (30 commands)

Row: **CMD-B19b**. Status: **SPEC** 10, **SPEC-PARTIAL** 20, **LOCK** 0 (per command below).
Run: 2026-11-20, si-analyst worker, unattended, batch 19 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced; only
addresses, GUIDs, constants, string ids and behaviour.

Binaries (opened one at a time, each closed):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\tasks.dll`, image base `0x180000000`, sha256
  `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914` (same build as CMD-B11a..d, B16c, B17j).
- `...\bin\environments.dll`, sha256 `fca52f0c7310761d76e9ffd7ec74842534a3d2dc377eca5319a638842b8fdaf5`.
- `...\bin\selectionmgr.dll`, sha256 `77d0a1e7bcba8ca784da3b1838121bb36bff17be6d896351f1a5d1deeb3c3bc9`.
- Not opened: `viewinteraction.dll`, `sicoresdk.dll`, `corehelper.dll`, `xsievents.dll`, `scnmgr.dll`,
  `pickmgr.dll` (tasks.dll / environments.dll / selectionmgr.dll already serve every CLSID of this group).

Method: `tasks.dll` `DllGetClassObject` (`0x180009700`) was decompiled once and its 117 inline two-64-bit CLSID
compares parsed into a CLSID -> factory-vtable map (113 regular compares + one 3-way OR branch + the final
compare). 27 of the 30 commands' CLSIDs are served there; `98531be5` / `6eed640c` (environment commands) are not
and were found in `environments.dll`; `16532fa0` (`DeselectAllUsingFilter`) in `selectionmgr.dll` (byte search
of the first 8 CLSID bytes, xref into `DllGetClassObject`). Then: factory slot 6 (create) -> constructor -> task
vtable slots 5..9 (Do, Undo, Redo, UnPackArg, RePackArg) and the worker vtable (slot 9) read with `read_bytes`;
create / ctor / Do / UnPackArg / worker decompiled (about 60 functions); GUID tables at `0x18009c008`,
`0x18009c258`, `0x18009c848`, `0x18009cd48`, `0x18009da88..0x18009db68` decoded. Statements are behaviour read
from the binary unless marked `(inferred)`.

Two task layouts occur (as in CMD-B11a 2.1): **(A)** `C3DCoreBaseTask` at `+0`, `CDSCOMObject` at `+0x20`,
worker at `+0x38`; **(B)** `CDSCOMObject` at `+0`, `C3DCoreBaseTask` at `+0x18` (task vtable at `+0x18`),
worker at `+0x38`. Stub `0x18000e460` = no-op Undo/Redo; `0x18008ccfa` = imported default RePackArg;
`0x18007dc50` = shared trivial slot.

## 1. Handler table

| Command | scripting name | DLL | Handler (CLSID, factory vtable -> create -> ctor, task vtable, Do / UnPackArg / worker) | Status |
|---|---|---|---|---|
| Last Operator in Stack | `InspectLastOperator` | tasks.dll | `ee0d5df0-58e0-11d4-bc9c-00d0b719022b`; `0x1800a2620` -> `0x180008520` -> `0x180062170` (0x50, layout A); task vt `0x1800b1270`; Do `0x180062c30`, UnPack `0x180062d00`, Undo/Redo stub | SPEC-PARTIAL |
| Delete All | `DeleteAll` | tasks.dll | `6e4d3de5-5ad1-48fa-9811-49f8be59a576` (shared with `NewScene`); `0x1800a31c0` -> `0x180008860` (inline ctor, 0x68); task vt `0x1800a30e0`; Do `0x180083bf0`, UnPack `0x180085880` (stores exec context), Undo/Redo stub | SPEC-PARTIAL |
| New Scene | `NewScene` | tasks.dll | same handler as `DeleteAll` | SPEC-PARTIAL |
| Save Scene | `SaveScene` | tasks.dll | `973f7447-bd33-4349-9d59-d1c9cad1b3a3`; `0x1800a3328` -> `0x180008e70` (inline, 0x68); task vt `0x1800a3200`; Do `0x180085100`, UnPack `0x180085880` | SPEC-PARTIAL |
| Open Scene | `OpenScene` | tasks.dll | `fcad9bc1-645a-11d5-ad18-0090275802bf`; `0x1800a30a0` -> `0x180008980` (inline, 0x68); task vt `0x1800a2fc0`; Do `0x180083f40`, UnPack `0x180085660`, RePack `0x180085520` | SPEC-PARTIAL |
| Browse presets | `SIGetPreset` | tasks.dll | `393c6ad2-e6b4-11d2-a02c-0000f875df68`; `0x1800a1508` -> `0x1800081d0` -> `0x1800701a0` (0x68, B); task vt `0x1800b4020`; Do `0x180070490` (thunk) -> worker `0x180070320`; UnPack `0x1800705c0`, RePack `0x180070540`, Undo/Redo `0x180070020` | SPEC |
| RemoveFolder | `RemoveFolder` | tasks.dll | `de5fd1e2-2dc3-11d4-b6a4-006094eb029c`; `0x1800a28c0` -> `0x180008c20` -> `0x1800878b0` (0x160, A); task vt `0x1800b6fc0`; Do `0x180087f20` -> worker `0x180087bd0`; UnPack `0x180088260`; Undo `0x180087f60`, Redo `0x180087f40` | SPEC-PARTIAL |
| Loops From Selection | `SelectAllComponentLoops` | tasks.dll | `14ba7973-1452-4f83-bedb-d87c9c045c29`; `0x1800a3538` -> `0x180009000` -> `0x1800403e0` (0x60, B); task vt `0x1800ad290`; Do `0x180040580`, UnPack `0x180043500` | SPEC-PARTIAL |
| Grow Loops | `GrowSelectedLoops` | tasks.dll | `79a24a0c-d64f-4ead-acda-d6d98178596c`; `0x1800a35a8` -> `0x180008320` -> `0x180041ce0`; task vt `0x1800ad510`; Do `0x180041e80`, UnPack `0x180043500` | SPEC-PARTIAL |
| Shrink Loops | `ShrinkSelectedLoops` | tasks.dll | `2ab971bf-a7db-495d-9a3d-8973a2fb51fe`; `0x1800a3618` -> `0x180009340` -> `0x180043580`; task vt `0x1800ad7b0`; Do `0x180043720`, UnPack `0x180043500` | SPEC-PARTIAL |
| Select Polygon Outline | `SelectPolygonOutline` | tasks.dll | `9b13ed79-f264-46ef-9982-4b025b238d02`; `0x1800a3688` -> `0x180009040` -> `0x1800454a0` (0x50); task vt `0x1800ada10`; Do `0x1800455f0`, UnPack `0x1800465f0` | SPEC-PARTIAL |
| Island From Selection | `SelectAllConnectedComponents` | tasks.dll | `35ced1f5-b9da-43d5-af12-17de288ca1db`; `0x1800a36f8` -> `0x180008fc0` -> `0x180046630` (0x50); task vt `0x1800adc60`; Do `0x180046790`, UnPack `0x1800465f0` | SPEC-PARTIAL |
| Create New Layer | `SICreateLayer` | tasks.dll | `42570b11-1267-4a95-8ce0-d781ce23a79f` (shared with `SICreateLayer2`); `0x1800a1850` -> `0x1800078e0` -> `0x18002f3b0` (200, B); task vt `0x1800a8ed0`; Do `0x18002f930` -> worker `0x18002f5f0`; UnPack `0x18002fc50`, RePack `0x18002fb30`; Undo `0x18002fa00`, Redo `0x18002f970` | SPEC |
| Create New Layer 2 | `SICreateLayer2` | tasks.dll | same handler as `SICreateLayer` | SPEC |
| Create Layer Group | `CreateLayerGroup` | tasks.dll | `38e33817-0836-4a54-97ee-07d0759e713c`; `0x1800a18c0` -> `0x1800078a0` -> `0x1800397e0` (0xf0, B); task vt `0x1800abb10`; Do `0x18003c070` (thunk) -> worker `0x18003a0a0`; UnPack `0x18003c830`, RePack `0x18003c620`; Undo `0x18003c3f0`, Redo `0x18003c250` | SPEC |
| Move Object To Layer | `MoveObjectToLayer` | tasks.dll | `8416ea77-0484-46f3-a153-f7277562ae49`; `0x1800a18f8` -> `0x180008760` -> `0x1800399a0` (0x120, B); task vt `0x1800abc20`; Do `0x18003c0d0` (thunk) -> worker `0x18003a9e0`; UnPack `0x18003cae0`; Undo `0x18003c320`, Redo `0x18003c190` | SPEC-PARTIAL |
| Cut Layer Parent Task | `CutLayerParent` | tasks.dll | `7d1b0d6f-0815-4f0b-aa7a-cc7498015863`; `0x1800a1888` -> `0x180007a20` -> `0x1800398d0` (0xd0, B); task vt `0x1800aba00`; Do `0x18003c0b0` (thunk) -> worker `0x18003a2b0`; UnPack `0x18003c940`; Undo `0x18003c270`, Redo `0x18003c110` | SPEC-PARTIAL |
| Set Current Layer | `SetCurrentLayer` | tasks.dll | `2f76bc8f-f028-11d2-ac7c-00a02485cecb` = the `SetCurrentParType` handler of CMD-B11a; `0x1800a1818` -> `0x1800090c0` -> `0x180048500`; task vt `0x1800adf70`; Do `0x180048f50`, worker `0x180048eb0`, UnPack `0x1800491b0` | SPEC |
| Set Current Pass | `SetCurrentPass` | tasks.dll | same handler as `SetCurrentLayer` | SPEC |
| Plot Shape | `PlotShape` | tasks.dll (script-backed) | `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`; `0x1800a1460` -> `0x180008f80` -> `0x18003fd30`; task vt `0x1800acf40` (Do/Undo/Redo all stub) | SPEC-PARTIAL |
| LinkDeform | `LinkDeform` | tasks.dll (script-backed) | same as `PlotShape` | SPEC-PARTIAL |
| Cut | `Cut` | tasks.dll | `ec7663e5-2f0b-11d3-bffd-00a0248f9397`; `0x1800a1ab8` -> `0x180007a60` -> `0x18005b1f0` (0x68, B); task vt `0x1800b0400`; Do `0x180059e50` -> task slot 20 `0x18005b3a0`; UnPack `0x180057920`; Undo `0x18005b650`, Redo `0x18005b5d0` | SPEC-PARTIAL |
| Copy | `Copy` | tasks.dll | `ec7663e4-…`; `0x1800a1a48` -> `0x180007760` -> `0x180059b90`; task vt `0x1800b0000`; Do `0x180059e50` -> slot 20 `0x180059e10`; UnPack `0x180057920`; Undo/Redo stub | SPEC-PARTIAL |
| Paste | `Paste` | tasks.dll | `ec7663e6-…`; `0x1800a1b28` -> `0x180008aa0` -> `0x18005b7b0` (0x88); task vt `0x1800b0640`; Do `0x180059e50` -> slot 20 `0x18005ba20`; UnPack `0x180057920`; Undo `0x18005c390`, Redo `0x18005c2a0` | SPEC-PARTIAL |
| Copy UVW | `CopyUVW` | tasks.dll | `a1c9cbeb-2a8e-40d5-93e1-12e142a01c94`; `0x1800a2b28` -> `0x1800077a0` -> `0x180059f10` (0x60, A); task vt `0x1800b0220`; Do `0x18005ad40`, UnPack `0x18005b040` | SPEC-PARTIAL |
| Paste UVW | `PasteUVW` | tasks.dll | `594ea9c2-b64c-499f-9ae3-ba03147ab375`; `0x1800a2b60` -> `0x180008ae0` -> `0x18005c800` (0x70, A); task vt `0x1800b0970`; Do `0x18005db40`, UnPack `0x18005f720`; Undo `0x18005dc50`, Redo `0x18005dc20` | SPEC-PARTIAL |
| InstallCustomPreferences | `InstallCustomPreferences` | tasks.dll | `3d2d0215-acbc-4b8b-8acf-ad835041f392`; `0x1800a3780` -> `0x1800085a0` -> `0x18007dde0` (0x68, A); task vt `0x1800b5cf0`; Do `0x18007e620` -> worker `0x18007dfb0`; UnPack `0x18007e780` | SPEC |
| CreateEnvironment | `CreateEnvironment` | **environments.dll** | `98531be5-b33d-46fa-80d4-41d795584ad5`; `DllGetClassObject 0x1800158e0`; factory vt `0x1800257e0` -> `0x1800155f0` -> `0x180003190` (0xa8, A); task vt `0x18001d310`; Do `0x180003690` -> worker `0x180003380`; UnPack `0x1800039c0`, RePack `0x1800038a0`; Undo `0x180003760`, Redo `0x180003700` | SPEC |
| AddContainerToEnvironment | `AddContainerToEnvironment` | **environments.dll** | `6eed640c-73b9-4b7b-86c3-ae582eebf9cb`; factory vt `0x1800257a8` -> `0x180015570` -> `0x1800010a0` (0x108, A); task vt `0x18001b9d0`; Do `0x180001a50` -> worker `0x180001700`; UnPack `0x180001ea0`, RePack `0x180001d20`; Undo `0x180001ba0`, Redo `0x180001b00` | SPEC |
| Deselect All Using Filter | `DeselectAllUsingFilter` | **selectionmgr.dll** | `16532fa0-0c74-11d3-b8a0-080036f3cc02`; `DllGetClassObject 0x180005ef0`; factory vt `0x18001d2c8` -> `0x180004fa0` -> `0x1800121c0` (0x50, B); task vt `0x180022620`; Do `0x180012ac0`, UnPack `0x180012ba0`, worker `0x180012950` | SPEC |

## 2. Shared facts

- **Selection sub-task classes** (GUID table `0x18009db08..`, cross-checked with `data/command_registry.json`):
  `79581ba0-99bb-11d2-8bbb-00aa00135f7b` = `SelectObj` (slot 10 with (list, 0, 0, undo) = replace the
  selection with the list), `38eddd00-d255-11d2-8bcf-00aa006130ef` = `AddToSelection`,
  `38eddd02-d255-11d2-8bcf-00aa006130ef` = `RemoveFromSelection` (slot 9 with (list, 0, undo)). Every such
  sub-task is queued for undo when the command records undo.
- **Other sub-task classes used here**: `dd531990-ccc2-11d2-ac73-00a02485cecb` = `DeleteObj` (CMD-B16c);
  `f3c49aa1-db80-11d1-9172-00a0c9612e3a` = the InspectObj task (`0x18009c268`); `42570b11-…` = this note's
  `SICreateLayer` task (used by `CreateLayerGroup`); `8416ea77-…` = `MoveObjectToLayer` (used by
  `CreateLayerGroup` and `CutLayerParent`); `fcad9bc1-…` = `OpenScene` (used by `NewScene`).
- **Sub-component type GUIDs**: `3df7f9e0-89ee-11d0-9964-00a0243f0e60` (point), `3df7f9e1-…` (edge),
  `3df7f9e2-…` (polygon). Loop commands accept only these three; other component kinds are skipped silently.
- **Layer test**: an object is a layer when its component-hierarchy type (slot 8, `IDSComponentHierarchy`) is
  **4**; the layer class id is `479f2e10-3900-11d1-b0b3-00a024c79287` (also the "parent is a layer" test used
  by `CutLayerParent` / `MoveObjectToLayer`: layers nest, a "layer group" is a layer that holds layers).
- **Scene I/O service**: framework interface QI `76354f42-8101-4310-8594-cc500a7003cc` (`0x18009c048`); slot 3
  = new scene (takes the exec context, i.e. `Confirm`), slot 4 = open `.scn`, slot 5 = save, slot 6 = save in
  the alternative app mode (inferred: export / `.exp`). The service lives outside tasks.dll.
- Message ids (dictionary `XSITASKS`, severity 2 = warning): `0x419` preset is not a layer preset, `0x41a`
  layer move refused, `0x422` default scene path not usable, `0x429` no custom preferences installed, `0x435`
  object cannot go to that layer (raised with E_INVALIDARG), `0x439` save failed (composed with the file name,
  raised with E_FAIL), `0x78` nothing to cut (raised with E_INVALIDARG).
- Custom file-format events: `0x20510026` (custom import, used by `OpenScene` for non-`.scn` files) and
  `0x20510027` (custom export, used by `SaveScene`), found with `F3DFindCustomConverterEventName` by extension.
- Return convention: most Do functions return 1 (S_FALSE) on success; `0x562E80C7` = cancelled / info.

## 3. Contracts

### `NewScene` and `DeleteAll` (handler `6e4d3de5`): SPEC-PARTIAL

Args: `NewScene(ProjectPathName="", Confirm=true, CmdMapClient, CmdID)`, `DeleteAll(Confirm=true, CmdMapClient,
CmdID)`; both registry rows default `CmdMapClient = {7ba6c800-572c-11d2-806f-00a0c96e63e1}` and
`CmdID = {13e596d1-17c4-11d3-b949-00a024c78ee3}`. UnPackArg only keeps the exec context.
Do, observable order:
1. No exec context -> raises `0x8000FFFF`.
2. Gets the scene I/O service from the framework; absent -> nothing happens.
3. Reads preference `data_management.default_scene_path`.
   - Empty -> closes any progress bar and calls the service's **new scene** with the exec context (the service
     handles `Confirm`, inferred).
   - Not empty -> builds a file object for it and checks it; when it is not usable, logs warning `0x422` with
     the path and falls back to the plain new scene. When usable: sets ambient `DS_SZ_SEGMENT_PATHNAME` to the
     resolved path, writes the path into argument 0 of the exec context, runs an **`OpenScene`** task (class
     `fcad9bc1-…`) with the context, then resets `DS_SZ_SEGMENT_PATHNAME`.
- Not undoable. `DeleteAll` runs exactly the same code (same handler, same default CmdID) (inferred: "Delete All"
  = new scene).
- **Missing:** the service's own new-scene behaviour (outside tasks.dll), what makes the default scene file
  "usable" (file object slot 14), and `ProjectPathName` handling (not read by tasks.dll).
**Wire contract:** `NewScene(ProjectPathName="", Confirm=true)` / `DeleteAll(Confirm=true)` empty the scene
(confirmation when `Confirm`); if the default-scene-path preference names a usable scene file, that scene is
opened instead; unusable path -> warning, empty scene. Not undoable.

### `OpenScene`: SPEC-PARTIAL

Args: `SceneFileName` (file handler `6f97fb91-…`), `Confirm=true`, `ApplyAuxiliaryData=false`, CmdMapClient,
CmdID `{738372e0-17c1-11d3-b949-00a024c78ee3}`.
- UnPackArg reads `ApplyAuxiliaryData` only when the running command's GUID is `eb70db2a-7755-11d3-bde5-
  009027319c01` (this command; the handler is also used as a sub-task by `NewScene`).
- Do: no exec context -> raise `0x8000FFFF`; no framework / service -> `0x80004005`. Gets the file name,
  sets ambient `c3dsceneiotask.scenename` to the base name.
  - Extension `.SCN` (or `.EXP` in the alternative app mode): service **open** with the context.
  - Any other extension: service **new scene** first (returning 1 = cancelled -> `0x562E80C7`); then the
    custom-import event `0x20510026` for that extension; no registered handler -> `0x80070057`. Fires it on the
    current scene model with the path; sets ambient `DS_SZ_SEGMENT_PATHNAME`; writes preferences
    `data_management.last_sequence_name` and `data_management.last_sequence_dir`; with a UI, adds the file to
    the `RECENT_SCENES_MENU` recent-file list.
  - On success: if the opened scene reports auxiliary data and `ApplyAuxiliaryData` is true, applies it; then a
    post-open refresh (`0x180083230`). Returns 1. Open failure -> `0x562E80C7`.
- Not undoable.
**Wire contract:** `OpenScene(SceneFileName, Confirm=true, ApplyAuxiliaryData=false)` loads a `.scn`; other
extensions go through a registered custom importer into a new scene (none -> E_INVALIDARG); a cancelled
confirmation returns without change.

### `SaveScene`: SPEC-PARTIAL

Args: CmdMapClient, CmdID `{13e596d0-17c4-11d3-b949-00a024c78ee3}` (no file argument: it saves the current
scene file).
- Do: progress bar closed; no exec context -> raise `0x8000FFFF`; no framework/service -> `0x80004005`. Takes the
  current scene file name and its extension:
  - alternative app mode and `.SCN` -> service slot 6 (inferred: save as export);
  - `.SCN`, no extension, or (alternative mode and `.EXP`) -> service **save**;
  - other extensions -> custom-export event `0x20510027` for the extension (none -> `0x80070057`), fired on the
    scene model with the path.
  - Any failure: raises `0x80004005` with message `0x439` + file name (warning severity). Success -> 1.
- Not undoable.
**Wire contract:** `SaveScene()` writes the current scene to its own file (`.scn` natively, other extensions via
a registered custom exporter); failure -> E_FAIL with "save failed <file>".

### `SIGetPreset`: SPEC

Args: `Path` (string, ""), `Family` (string, ""), `PresetObj` (out).
- UnPackArg: no context -> `0x80004003`. A non-empty string `Path` is copied. `Family` must be a string, else
  `0x80070057`; a non-empty family name is looked up (`SIFindFamily`), unknown -> `0x80070057`.
- Do -> worker: no output -> `0x80004003`. Starts at the installation common root (`DSIOGetCommonRoot`), appends
  `Path` when given, and opens the **modal preset browser** (`DSDoModalPresetBrowser`) filtered on the family
  GUID. Returns 0 when a preset was chosen (written to `PresetObj` by RePackArg), 1 when the browser failed or was
  cancelled. Not undoable.
**Wire contract:** `SIGetPreset(Path="", Family="")` shows the preset browser (rooted at the factory root + Path,
filtered by Family) and returns the chosen preset; cancel -> nothing (S_FALSE); bad family -> E_INVALIDARG.

### `InspectLastOperator`: SPEC-PARTIAL

Args: `InputObjs` (list). UnPackArg: no context -> `0x80070057`; reads `InputObjs`.
- Do: builds a list (`0x1800622c0`) from InputObjs: for each item of kind 2 or 4 (object-like) the last operator
  of its primitive is added (`0x1800624b0`); kind 8 items go through `0x1800629f0`; other items through
  `0x180062870` with interface `6de1b670-8072-11d5-aeed-0090275802c9` (not decoded). Empty result ->
  `0x80004005`. Otherwise runs the InspectObj task (`f3c49aa1-…`, slot 9 with (list, 0, 0, 1)) and returns 1.
  Not undoable.
- **Missing:** the three per-kind collectors (which operator counts as "last" for clusters / properties).
**Wire contract:** `InspectLastOperator(InputObjs)` opens a property page on the top (last) operator of each
input's operator stack; nothing found -> E_FAIL.

### `RemoveFolder`: SPEC-PARTIAL

Args: `InputObjs` (scene item, handler `55f36231-…`).
- Worker `0x180087bd0`: no input -> 1, nothing done. The item's owner must expose the folder interface
  (`0x18009d828`), otherwise 1, nothing done. It finds the folder's parent container of kind `0x18009d838`
  (none -> 1) and removes the folder from it at its index (component kind `0x402`). With undo it keeps soft
  references to the parent and the folder and the folder's state (two snapshots) for Undo / Redo.
- (inferred) the folder object itself is removed from its parent; its members are not deleted (the folder
  family of CMD-B11d: `CreateFolder`, `MoveToFolder`, `RemoveFromFolder`).
**Wire contract:** `RemoveFolder(InputObjs)` removes the given folder from its parent; non-folders are ignored
silently (S_FALSE); undoable.

### `SelectAllComponentLoops`, `GrowSelectedLoops`, `ShrinkSelectedLoops`: SPEC-PARTIAL

Args: `InputObjs` (list, default selection), `AroundCorners` (bool, default **true**; ctor default 1).
UnPackArg (shared `0x180043500`): no context -> `0x80004003`; reads both.
Do, common part: at the current time, for each input item that is a **sub-component selection** (kind 7) on a
geometry whose sub-component type is point, edge or polygon (other types skipped), the geometry's adjacency
services are queried and, for each pair of selected components, the loop path between them is asked from the
geometry (mode 2); paths shorter than the pair are dropped. When `AroundCorners` is false the path is cut at
corner points (`0x180040140`). Results become sub-component lists of the same type.
- `SelectAllComponentLoops`: result list -> `SelectObj` (replace selection).
- `GrowSelectedLoops`: first `SelectObj` with the **input** list, then `AddToSelection` with the components
  added at the ends of each loop.
- `ShrinkSelectedLoops`: first `SelectObj` with the input list, then `RemoveFromSelection` with the end
  components removed.
- All selection sub-tasks are queued for undo. Return 0.
- **Missing:** the exact per-type path rules (point / edge / polygon loop walking, `0x180040140` corner rule).
**Wire contract:** `SelectAllComponentLoops(InputObjs, AroundCorners=true)` selects the loops through the
selected points / edges / polygons; Grow / Shrink extend / trim the selected loops by one component at each end
and work for **all three** component types (not edges only); undoable through the selection commands.

### `SelectPolygonOutline`: SPEC-PARTIAL

Args: `InputObjs`. UnPackArg `0x1800465f0` (no context -> `0x80004003`). Do accepts only **polygon**
sub-component selections (`3df7f9e2`); computes the boundary and replaces the selection with it through
`SelectObj` (undoable). Missing: the boundary rule detail.
**Wire contract:** `SelectPolygonOutline(InputObjs)` replaces the selection with the outline edges of the selected
polygons; other selections do nothing.

### `SelectAllConnectedComponents`: SPEC-PARTIAL

Args: `InputObjs`. Same UnPackArg as above. Do handles point / edge / polygon selections and replaces the
selection (`SelectObj`) with all components connected to the selected ones (island). Missing: connectivity rule
per type.
**Wire contract:** `SelectAllConnectedComponents(InputObjs)` selects the islands touched by the component
selection; undoable.

### `SICreateLayer`, `SICreateLayer2`: SPEC

Args: `PresetObj` (preset, default `{42FC2493-732F-11d2-AC52-00A02485CECB}:Default_New_Layer`), `Name` (""),
`SICreateLayer2` also `LayerGroupName` (""), `Value` (out).
- UnPackArg: `PresetObj` missing (`DISP_E_PARAMNOTFOUND`) -> `0x80070057`; `Name` and `LayerGroupName` are
  taken only when they are strings.
- Worker `0x18002f5f0`: no preset -> nothing. Creates the object from the preset
  (`SICreateObjectAndUpgradeFromPreset`); if it is not a layer (hierarchy type 4) -> warning `0x419` with the
  preset name, no layer, success return. Non-empty `Name` is set on the layer (failure aborts); then the layer
  is added to the **layer container** (`F3DGetLayerContainer`, slot 7 with position 0). `Value` = the layer. With
  undo: soft reference to the layer, the preset name and Name kept for Undo / Redo.
- **`LayerGroupName` is read but not used by the worker**: `SICreateLayer2` creates the layer at the top level
  exactly like `SICreateLayer`.
- The current layer and the selection are not changed.
**Wire contract:** `SICreateLayer(PresetObj, Name="")` / `SICreateLayer2(PresetObj, Name="", LayerGroupName="")`
create one layer from the preset in the layer container, named Name (preset name when empty), return it,
undoable; a non-layer preset -> warning, nothing created.

### `CreateLayerGroup`: SPEC

Args: `PresetObj` (default new-layer preset), `InputObj` (scene item), `Name` (default "LayerGroup"), `Value`.
- UnPackArg: missing preset -> `0x80070057`; `InputObj`, when given, is queried for the element interface
  `4aeaeaea-1a43-11d2-8d66-00a0c982a649`; `Name` read as string.
- Worker `0x18003a0a0`: runs the **`SICreateLayer` task** (`42570b11-…`) with the preset and `Name` (an empty
  Name becomes `"LayerGroup"`), group name "" -> new layer. Queued for undo. When `InputObj` was given, runs a
  **`MoveObjectToLayer` task** (`8416ea77-…`) with (new layer, InputObj) and queues it. Value = the new layer.
- (inferred) a layer group is an ordinary layer that receives other layers.
**Wire contract:** `CreateLayerGroup(PresetObj, InputObj=null, Name="LayerGroup")` creates a layer from the preset
(the "group") and, if InputObj is given, moves InputObj into it; returns the new layer; undoable.

### `MoveObjectToLayer`: SPEC-PARTIAL

Args: `Target` (list), `InputObjs` (list).
- UnPackArg: takes the **first layer** in `Target` (type 4, layer interface); none -> `0x80070057`. Then reads
  `InputObjs`.
- Worker `0x18003a9e0` (inside the task, undo recorded with soft references):
  - An input that is not a component hierarchy goes through a fallback sub-task (class `0x18009cdb8`, slot 9).
  - An input that is a **layer**: it is re-parented under the target layer (nested layer); a refused move
    (`0x80070005`) logs warning `0x41a` with the names.
  - Other objects: removed from their current layer and added to the target layer; locked referenced models
    get the local-modification flag `0x40` handled (`F3DRemoveLocalModifOnRefModel`); objects that cannot go to
    the layer raise `0x80070057` with message `0x435`. Afterwards render visibility is re-evaluated
    (`F3DCanBeRendered`).
- **Missing:** the pass-container branch (`F3DGetPassContainer`) and the fallback sub-task identity.
**Wire contract:** `MoveObjectToLayer(Target, InputObjs)` moves each input into the first layer of Target (layers
nest under it); no layer in Target -> E_INVALIDARG; undoable.

### `CutLayerParent`: SPEC-PARTIAL

Args: `InputObjs`. UnPackArg: first **layer** in InputObjs (none -> `0x80070057`); only that one is used.
- Worker `0x18003a2b0`: input must be a layer (else `0x80070057`). If its parent is a layer (class
  `479f2e10-…`), the layer is detached from it and put back at the top of the layer container under the same
  name, and stored connection deltas are renamed (`F3DUpdateDeltasWithNewCnxName`). Refused detach
  (`0x80070005`) -> logs the name, returns 1. Called as a sub-task with a target, it delegates to
  `MoveObjectToLayer`. Undoable (soft references).
**Wire contract:** `CutLayerParent(InputObjs)` takes the first layer of the list out of its parent layer (group)
to the top level; no layer -> E_INVALIDARG; undoable.

### `SetCurrentLayer`, `SetCurrentPass`: SPEC (same as `SetCurrentParType`, CMD-B11a)

Same handler `2f76bc8f`, contracted in CMD-B11a as `SetCurrentParType`. Args: `Value` (object, required),
`Type` (long): **`SetCurrentLayer` Type default 1 (layer)**, **`SetCurrentPass` Type default 0 (pass)**.
UnPackArg checks Value's class against Type (0 pass `bfdaf164-…`, 1 layer `479f2e10-…`, 2 `a15b3913-…`, 3
particle type `4c038ff0-…`): mismatch `0x80004005`, no class interface `0x80004002`. Do sets the object current
in the pass / layer container (pass change fires events `0x20510029` before / `0x2051002a` after); undoable
(Undo restores the previous current object).
**Wire contract:** `SetCurrentLayer(Value)` / `SetCurrentPass(Value)` make Value the current layer / pass; wrong
object kind -> E_FAIL; undoable.

### `PlotShape`, `LinkDeform`: SPEC-PARTIAL (script-backed)

Handler `5c0cf8b6` is the script-backed command class (CMD-B11d 3.2, CMD-B16d 2): the tasks.dll object's
Do / Undo / Redo are no-ops and the command runs its script implementation through the command manager. No
native behaviour in tasks.dll; the scripts were not read in this row.
**Wire contract:** implement from the command's script (not from tasks.dll); arguments as in the registry.

### `Copy`, `Cut`, `Paste` (clipboard tasks): SPEC-PARTIAL

Args (all three): `InputObjs` (list; default the selection). UnPackArg `0x180057920` copies the list into a new
list (CLSID `0x18009df78`). Do calls the task's slot 20 with (list, undo flag); a clipboard service object held by
the task (`+0x20` of the task part) does the work.
- **Copy**: clipboard "copy" (slot 3) of the list, then commit (slot 11). Not undoable.
- **Cut**: empty list -> raises `0x80070057` with message `0x78`. Clipboard "cut" (slot 4); with undo, the
  clipboard returns its deletion sub-tasks (slot 10), which are queued, and a selection snapshot (class
  `0x18009df98`) of the input is kept; then commit. Undoable.
- **Paste**: inside a graph-update bracket; empty InputObjs -> the target is the **current scene model**. For each
  target and each clipboard item, the clipboard pastes the item onto the target (slot 12, returns flags); items
  with flag `0x10` that the clipboard does not accept (slot 13) go to a discard list which is deleted with a
  `DeleteObj` sub-task; with undo the clipboard's sub-tasks are queued and the pasted objects are recorded.
  Undoable.
- **Missing:** the clipboard service (outside tasks.dll): what "copy" stores (objects vs. serialized data) and
  the paste flags.
**Wire contract:** `Copy(InputObjs)` puts the objects on the scene clipboard (not undoable); `Cut(InputObjs)` = copy
+ undoable delete (empty -> E_INVALIDARG); `Paste(InputObjs)` pastes the clipboard under each target (default the
scene root model), undoable.

### `CopyUVW`, `PasteUVW`: SPEC-PARTIAL

Args: `TextureProjection` (scene item), `SubComp` (scene item), PasteUVW also `PasteUVsMode` (long, default
`siDefaultPasteUVsMode`).
- UnPackArg: TextureProjection queried for interface `5247da40-4f03-11d1-925b-08003629ea02`; SubComp missing -> the projection's
  own cluster is used (element kind 6); otherwise SubComp's element kind is read. PasteUVW reads `PasteUVsMode`.
- Do: kind 6 (cluster) -> resolves the cluster and copies / pastes the UVs of the whole cluster (task slot 15);
  kind 7 (sub-component) -> the sub-component variant (slot 16); other kinds -> nothing. CopyUVW not undoable;
  PasteUVW undoable.
- **Missing:** the UV clipboard storage and the paste modes.
**Wire contract:** `CopyUVW(TextureProjection, SubComp)` stores the UVs of SubComp (default the projection's
cluster); `PasteUVW(TextureProjection, SubComp, PasteUVsMode)` writes them back, undoable.

### `InstallCustomPreferences`: SPEC

Args: `InputObjs` (list), `Name` (""). UnPackArg: InputObjs failure -> `0x80070057`.
- Worker `0x18007dfb0`, for each input that holds a custom property set (interface `76332573-d242-11d0-b69c-
  00aa003b3ea6`):
  1. Name = `Name` arg, or the property's own name when empty.
  2. Saves a preset file `<UserPath>\Data\Preferences\<Name>.Preset` (description `"Custom Preferences Set"`),
     queued for undo.
  3. Registers that file with the custom-preferences manager of the 3D content container; on failure the file
     is deleted and the loop stops.
  4. On success runs a `DeleteObj` sub-task on the original property (it now lives in the preferences),
     queued; counts it.
- None installed -> warning `0x429`. With undo and at least one installed, keeps a selection snapshot.
**Wire contract:** `InstallCustomPreferences(InputObjs, Name="")` turns each custom property into an installed
preference set (preset file under the user Data\Preferences folder) and deletes the original; nothing to install
-> warning; undoable.

### `CreateEnvironment` (environments.dll): SPEC

Args: `Name` (default "Environment"), `Environment` (out). UnPackArg reads Name.
- Worker `0x180003380`: creates an environment object (class at `0x180026018`), adds it to the **environment
  container** (`F3DGetEnvironmentContainer`), sets its name parameter when Name is given; with undo keeps a soft
  reference. RePackArg writes `Environment`. Undoable.
**Wire contract:** `CreateEnvironment(Name="Environment")` creates and returns a new simulation environment in the
environment container; undoable.

### `AddContainerToEnvironment` (environments.dll): SPEC

Args: `Environment` (scene item), `Type` (string, "Default"), `Support3DObject` (bool, true), `Name`
("MyGroup"), `Container` (out).
- UnPackArg: Environment must be an environment object (class `6c6af87f-4044-43dd-b45d-87f95a367c5b`); then reads
  Type, Support3DObject, Name.
- Worker `0x180001700`: creates a container object; class depends on `Support3DObject` (true `0x180025e78`,
  false `0x180026028`); sets its Name; sets attribute 0 = the environment container and attribute 1 = `Type`
  (string); adds it to the environment (slot 3, flag 1). Container = the new object. Undoable (soft references
  to environment and container).
**Wire contract:** `AddContainerToEnvironment(Environment, Type="Default", Support3DObject=true, Name="MyGroup")`
adds a named container of the given type to the environment and returns it; undoable.

### `DeselectAllUsingFilter` (selectionmgr.dll): SPEC

Args: `SelFilter` (filter, handler `1128e000-…`). UnPackArg: no context -> `0x80004003`; reads the filter.
- Worker `0x180012950`: clears its sub-task list, creates a `RemoveFromSelection` task (`38eddd02-…`).
  - Object filter (filter slot 12 = 0): the global selection is passed through the filter; the matching items
    form the list.
  - Component filter: for each selected geometry object (kind 2), every component type the filter supports is
    tested; matching components at the current time become sub-component items.
  - Non-empty list -> `RemoveFromSelection(list)`, queued for undo; the list is returned. Empty -> nothing.
**Wire contract:** `DeselectAllUsingFilter(SelFilter)` removes from the selection every item (or component) that
passes the filter, keeping the rest; undoable.

## 4. Open questions

1. Scene I/O service slots (new / open / save) and the auxiliary-data apply step live outside tasks.dll.
2. Loop / outline / island per-type rules (`0x180040580`, `0x180041e80`, `0x180043720`, `0x1800455f0`,
   `0x180046790`) are only summarised.
3. Clipboard service (Copy/Cut/Paste) and UV clipboard (CopyUVW/PasteUVW) storage.
4. `MoveObjectToLayer` fallback sub-task `0x18009cdb8` and pass-container branch.
5. `PlotShape` / `LinkDeform` script sources.
6. Bonus: `CreateEnvironmentCache` (`3d2a7149-320c-49a4-9625-8d61bda0c60c`, "not located" in CMD-B16d) **is served by
   `environments.dll`** (factory vtable `0x1800258f8`); not decoded here.

## 5. Corrections for the wire agent

1. `NewScene` (`src/commands/index.ts` 357): `Confirm` default is **true** (src false); add `ProjectPathName`;
   honour preference `data_management.default_scene_path` (open that scene when usable, else warning + empty).
2. `DeleteAll` (`src/commands/viewEditProperty.ts` 414): same handler as `NewScene`; it is a new-scene, not a
   delete-traverser over all objects (inferred; same CmdID); not undoable.
3. `OpenScene` / `SaveScene` (`src/commands/ui.ts` 32-33): add `SceneFileName`, `Confirm=true`,
   `ApplyAuxiliaryData=false` to OpenScene; non-`.scn` files go through custom import/export handlers (none ->
   E_INVALIDARG); SaveScene failure -> E_FAIL "save failed".
4. `Copy` / `Paste` (`src/commands/model2.ts` 475-476): add `InputObjs` (default selection); Paste pastes the
   clipboard under each target (default scene root model) rather than `Duplicate` of the copied list.
5. `Cut`: no command is registered (keymap does Copy + DeleteObj). Register `Cut(InputObjs)`: empty list ->
   E_INVALIDARG (message 0x78); otherwise copy + undoable delete.
6. `SetCurrentLayer` (`src/commands/anim.ts` 239): args are `Value` (object) and `Type` (default 1), not `Name`;
   class check -> E_FAIL; **undoable**. Same code as `SetCurrentParType`.
7. `SetCurrentPass`: only a trace stand-in exists; register it as `SetCurrentParType` with Type default 0
   (pass-change events 0x20510029 / 0x2051002a).
8. `CreateLayerGroup` (`src/commands/selectionGroupLayer.ts` 617): binary creates a **layer** from the preset (via
   SICreateLayer) and moves `InputObj` **into** it (MoveObjectToLayer); src builds a separate LayerGroup and
   treats InputObj as the parent.
9. `SICreateLayer2` (`selectionGroupLayer.ts` 606 / `createLayer` 245): LayerGroupName is ignored by the binary
   (no "layer group not found" error, no placement in a group).
10. `SICreateLayer` / `SICreateLayer2`: a non-layer preset -> warning 0x419 and no layer; no name uniquifying in
    the task; missing PresetObj -> E_INVALIDARG.
11. `CutLayerParent` (`selectionGroupLayer.ts` 626): only the **first** layer of InputObjs is processed; no layer
    -> E_INVALIDARG (src loops all nodes, returns a count).
12. `MoveObjectToLayer` (`selectionGroupLayer.ts` 608): empty / layer-less Target -> E_INVALIDARG (not
    `Unattested`); only the first layer of Target is used; a layer as input is nested under the target.
13. `GrowSelectedLoops` / `ShrinkSelectedLoops` (`selectionGroupLayer.ts` 474-476): point and polygon selections
    are handled too (not edges only); Grow = SelectObj(input) + AddToSelection(new), Shrink = SelectObj(input) +
    RemoveFromSelection(removed), each undoable.
14. `AddContainerToEnvironment` call in `src/commands/operatorsScriptsMore.ts` 219 passes `Family` / `Type: 1`;
    registry args are `Environment, Type (string "Default"), Support3DObject (bool), Name`.
15. `InstallCustomPreferences`, `RemoveFolder`, `CopyUVW`, `PasteUVW`, `SIGetPreset`: only inferred arg stubs /
    trace stand-ins exist; wire from section 3.
16. `DeselectAllUsingFilter` (`selectionGroupLayer.ts` 384): binary removes only the filter-matching components
    (not all components of that kind of the current object) and is undoable via RemoveFromSelection.
