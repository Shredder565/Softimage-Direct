# CMD-B11a: `tasks.dll` commands, CLSID range `025698cb`..`5aa63e2d` (particle / goal pop-up menus, cache files, presets, OBJ bridge, FindObjects, current pass / particle type, key map, reorder, prefs import, pick position, FilterPSet)

Row: **CMD-B11a**. Status: **SPEC** (16 names), **SPEC-PARTIAL** (3 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\tasks.dll`, image base `0x180000000`, sha256 `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914` (PDB name `Tasks.pdb`, not loaded).
Method: Ghidra decompilation of `DllGetClassObject`, the class-factory create slots, the
task constructors and the Do / Undo / UnPackArg / RePackArg / worker methods (about 75
functions); vtables and GUID constants read from `.rdata` byte dumps and decoded locally;
two functions Ghidra has no body for (`0x180064890`, `0x18007d400`) read from raw bytes
with a local disassembler. Message texts from `data/si/dict/XSITASKS.dict` (ids are
big-endian u16 in that file). Command GUIDs from `data/command_registry.json`. All
statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

"Factory" is the class-factory vtable installed by `DllGetClassObject`; "create" is its
slot 6 (allocate + construct). "Task vtable" is the `C3DCoreBaseTask` vtable (slot 5 Do,
6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg). "Worker" is slot 9 of the secondary interface
at task `+0x38` that Do forwards to. `stub` = `0x18000e460` (shared Undo/Redo stub, not
decompilable in Ghidra; `(inferred: no-op success)`), `0x18007dc50` returns 0,
`0x18008ccfa` is the shared default RePackArg thunk.

| Command(s) | Handler CLSID | Factory / create -> ctor | Task vtable | Do (-> worker) | UnPackArg | RePackArg | Undo / Redo |
|---|---|---|---|---|---|---|---|
| `Particle Type Pop-up Menu` | `025698cb-cc9f-48b4-b196-b631960e5c4b` | `0x1800a1dc0` / `0x180008a10` (inline ctor, base `0x18005ff50`) | `0x1800a1cf0` | `0x180061930` -> menu `0x180061890`, filler slot 16 `0x180061490` | `0x180061a60` | default | stub / stub |
| `Goal Pop-up Menu` | `10fd904a-159a-4118-b255-c69244eccd6a` | `0x1800a2380` / `0x180008290` (inline ctor) | `0x1800a22b0` | `0x180061930` -> `0x180061890`, filler `0x180061020` | `0x180061a60` | default | stub / stub |
| `SIMatchSubComponent` | `04791ffa-bfa7-11d2-80ae-00a0c955b335` | `0x1800a11f8` / `0x1800086e0` -> `0x180038430` | `0x1800ab2e0` (task at `+0x18`) | `0x180038650` -> `0x180038600` | `0x180038820` | `0x180038740` | stub / stub |
| `CopyCacheFiles` | `0e36c4ee-ef78-4f41-b381-2e960ff33d68` | `0x1800a2700` / `0x1800075a0` -> `0x180074100` | `0x1800b4b50` | `0x1800760d0` -> `0x1800744a0` | `0x180076270` | `0x18007dc50` | stub / stub |
| `RenameCPSetLayoutItems` | `1bbd2841-aefc-478a-a61e-d2e34766c3cd` | factory built by `0x180064620` (vtable `0x1800b1b88`) / `0x180064850` -> `0x180064120` | `0x1800b1a80` | `0x180064890` (body `0x1800648c0`) | `0x1800652d0` | default | `0x180064aa0` / `0x180064a70` |
| `CreateObjectFromPreset` | `24221da9-7761-11d3-80f8-00a0c9ac19a9` | `0x1800a25b0` / `0x180007920` -> `0x18006f370` | `0x1800b3c60` | `0x18006f810` -> `0x18006f630` (worker at `+0x40`) | `0x18006fb60` | `0x18006faa0` (not decompilable) | `0x18006f8f0` / `0x18006f880` |
| `ObjImport`, `SIObjExport` | `242679d3-3b42-11d5-ad11-0090275802bf` (same compare branch also accepts `89b8582b-a757-4acf-ad11-d6075aae4830` and `001d605b-f285-4a60-80fa-10e63b2360d4`) | `0x1800a2b98` / `0x180007dc0` -> `0x1800317a0` | `0x1800a98e0` | `0x180033b90` -> bridge object (vtable `0x1800a9e50`) slot 9 `0x180032fc0` -> `0x180033430` | `0x180034060` | default | `0x18007dc50` / `0x18007dc50` |
| `FindObjects` | `2b24aba0-b7f6-11d3-ae58-00a0c96e63e1` | `0x1800a1578` / `0x180007e80` -> `0x180034ec0` | `0x1800aa1f0` (task at `+0x18`) | `0x180035510` -> `0x180035070` -> `0x1800350a0` | `0x180035610` | `0x18003d870` | `0x180070020` / same |
| `GetCurrentPass` | `2f76bc83-f028-11d2-ac7c-00a02485cecb` | `0x1800a17e0` / `0x180008050` -> `0x180037190` | `0x1800aac50` | `0x1800372e0` | `0x1800373c0` | `0x180037390` | stub / stub |
| `SetCurrentParType` | `2f76bc8f-f028-11d2-ac7c-00a02485cecb` | `0x1800a1818` / `0x1800090c0` -> `0x180048500` | `0x1800adf70` | `0x180048f50` -> `0x180048710` (worker `0x180048eb0`) | `0x1800491b0` | default | `0x180048fd0` / `0x180048fc0` |
| `SetDefaultKeyMap` | `42769051-e0a2-436e-92c3-8c96f1a94c95` | `0x1800a28f8` / `0x180009100` -> `0x180024bf0` | `0x1800a79a0` | `0x180024e30` -> `0x180024d70` | `0x180024fa0` | default | `0x180024ec0` / `0x180024e80` |
| `DumpCacheHeader` | `46a94ed1-aa64-4832-836b-7242f5c7b276` | `0x1800a2770` / `0x180007b60` -> `0x18007d1a0` | `0x1800b5850` | `0x18007d400` (thunk) -> `0x18007d320` | `0x18007d4c0` | default | stub / stub |
| `CollapseOp` | `46ff1dac-9ec0-40f5-a19b-f5ac46846da4` | `0x1800a1380` / `0x180007660` -> `0x18000e980` | `0x1800a4ea0` | `0x180011790` -> `0x180010cf0` | `0x180011b70` | `0x1800118d0` | `0x180011800` / `0x1800117d0` |
| `ReorderSceneItem` | `495b9325-f3f1-4fdb-8a61-9f8aeb30dcce` | `0x1800a2460` / `0x180008720` -> `0x180038940` | `0x1800ab500` | `0x180039120` -> `0x180038d60` | `0x180039660` | default | `0x1800391c0` / `0x180039170` |
| `ImportPrefs` | `4a4c8cc1-a451-11d4-b4b0-00d0b71903e4` | `0x1800a2af0` / `0x180008460` -> `0x18007d540` | `0x1800b5a80` | `0x18007dad0` (callback `0x18007da80` -> worker `0x18007d9c0`) | `0x18007dc60` | `0x18007dc50` | stub / stub |
| `CacheObjectsIntoFile_Private` | `4c0c8234-baaa-4a8f-a94c-5e890b1e1785` | `0x1800a2738` / `0x1800075e0` -> `0x180077ff0` | `0x1800b5100` | `0x180079fd0` -> `0x180079750` | `0x18007a3a0` | `0x18007a110` | stub / stub |
| `PickPosition` | `525195c8-0fbf-11d3-bc2f-00a0c9612b97` | `0x1800a15e8` / `0x180008b60` -> `0x18006ebd0` | `0x1800b3ac0` | `0x18006ed60` | `0x18006f250` | `0x18006f0e0` | stub / stub |
| `FilterPSet` | `5aa63e2d-1f52-11d3-80e6-00a0c9ac19a9` | `0x1800a1a10` / `0x1800085e0` -> `0x180037b40` | `0x1800ab0e0` | `0x180038260` -> slot 10 `0x1800380e0` -> predicate slot 9 `0x180037cd0` | `0x1800383b0` | `0x180038330` | stub / stub |

## 2. Shared facts

### 2.1 Dispatch layout of `tasks.dll` (for all B11 workers)

- `DllGetClassObject` (`0x180009700`) is one long chain of inline CLSID compares (two
  8-byte compares per CLSID; 114 compare sites, some branches accept 2-3 CLSIDs). There
  is no ATL object map. On a match it allocates a 0x48-byte class factory: vtable at +0,
  reference count 1 at +8, a `CSICriticalSection` at +0x10, zero at +0x40; it increments
  a per-class module lock counter (a pointer global in `.data`, defaulting to the shared
  counter `0x1800e38d8`). Some branches build the factory through a helper (for example
  `0x180064620` for `RenameCPSetLayoutItems`); a few branches overwrite the factory vtable
  with a derived one after construction (for example the branch for `0461b2b9-...`).
- After the chain, if no factory was made the function returns `0x8007000E`
  (E_OUTOFMEMORY, not CLASS_E_CLASSNOTAVAILABLE); otherwise it queries the factory for the
  requested IID and releases its own reference.
- Factory vtable, 7 slots: 0 QueryInterface `0x180009540`, 1 AddRef `0x180004fc0`,
  2 Release `0x180009670`, 3 CreateInstance (shared variants `0x180004fd0`, `0x180005190`,
  `0x1800050b0`), 4 and 5 per class (not read), 6 per class "create object". The shared
  CreateInstance (`0x180004fd0`) returns `0x80004003` for a null out pointer, enters the
  critical section, calls slot 6, returns `0x8007000E` if slot 6 produced nothing,
  `0x80040110` (CLASS_E_NOAGGREGATION) when an outer unknown is given, else queries the
  object's COM part at object `+0x20` for the IID.
- Task object layout, current style: `C3DCoreBaseTask` at +0 (task vtable), `CDSCOMObject`
  at +0x20, a worker interface at +0x38 (slot 9 = the worker; Do calls it with the stored
  arguments and the framework's "first run" flag), sometimes more interfaces at +0x40 /
  +0x48. Older style (here `SIMatchSubComponent`, `FindObjects`): `CDSCOMObject` at +0,
  `C3DCoreBaseTask` at +0x18.
- Several CLSIDs serve more than one command; the task then reads the running command's
  GUID (stored at a fixed task offset, e.g. `+0x100` in the RenameCPSetLayoutItems task,
  or obtained from the exec context with `IDSExecContext` slot 15 index 2 as in the OBJ
  bridge) and compares it to constants.

### 2.2 Common helpers and constants

- Object list interface `f49f6470-4211-11d0-8463-00a024c7919c`, list class
  `f49f6471-...` (created with `SICreateInstance` for output lists); element reference
  `872903d0-3ef3-11d0-8463-00a024c7919c`; component hierarchy
  `4aeaeaea-1a43-11d2-8d66-00a0c982a649`; active data `6de1b670-8072-11d5-aeed-0090275802c9`;
  class-id interface `0000010c-0000-0000-c000-000000000046`.
- RePackArg writer `0x180010500(ctx, "Value", 0xd, list)` writes an output list to the
  argument named `Value` (string at `0x1800a5000`); `0x180037070` writes a single object.
- HRESULT `0x562e80c7` is treated as a "success with warning" code by every result-merge
  step (a later success never overrides it).
- Commands that run another command use `F3DCreateExecContext` / `F3DExecuteCmd` with the
  command map client `{50830560-31b5-11d0-82e7-00a0243e268d}` and the target command
  GUID: `InspectObj` `{dda48140-134f-11d1-8062-00a024c78ee3}`, `OpenNetView`
  `{8bf3741c-26b9-4546-b34e-31b72a7aa69b}`.

## 3. Contracts

### `Particle Type Pop-up Menu`: SPEC

Wire contract:
- Args: `InputObjs` (list, required), `EmbeddedCommand` (stored, not used by the menu code read here).
- UnPackArg: keeps `EmbeddedCommand`; records the foreground window and the cursor
  position. If the window under the cursor has class `BUTTON`, the menu anchor becomes the
  button's right edge, one third down from its top. Reads `InputObjs`; an empty list
  returns 1 (S_FALSE: nothing to do).
- Do builds a menu from the first input object's simulation operators
  (`F3DGetSimulationOps`): for each operator whose class id is one of
  `3ee7b553-394f-11d3-8a80-00a024197c03`, `71240cfd-8df9-11d3-ba02-08003639d903`,
  `c41aa2c3-b58a-11d4-a96f-00c04f8edeb9`, it walks the operator's port group 5 from the
  last port to the first; each connected object exposing interface
  `4c038ff6-3b9b-11d3-a1f7-00a0248f9567` (particle type) becomes a menu entry (stored as
  an element reference in an internal list). Operators of other classes are skipped.
- Shows the menu with `TrackPopupMenu` (flags `0x102`: return command id, right button)
  at the anchor. Choosing entry N runs `InspectObj` with `InputObjs` = that particle type
  and no `Keywords` (this task sets its "keyword" flag at construction). Cancel: nothing.
- Undoable: no (shared stub Undo/Redo).

### `Goal Pop-up Menu`: SPEC

Wire contract: same as `Particle Type Pop-up Menu` except:
- Only operators of class `3ee7b553-394f-11d3-8a80-00a024197c03` are used; their port
  group 7 (port sub-index 2) is walked; connected objects must expose interface
  `82c5f4fe-19c7-4e82-b501-be540fc319e6` (goal); the entry stores that object.
- Choosing an entry runs `InspectObj` with `InputObjs` = the goal and `Keywords` = `General`.

### `SIMatchSubComponent`: SPEC

Wire contract:
- Args: `InputObj` (component hierarchy), `SubComp` (element reference); both required
  (UnPackArg fails with the argument read error otherwise).
- Do calls `F3DMatchSubComponent(InputObj, SubComp)`. `Result` = true exactly when that
  call returns S_OK; a failing HRESULT is returned unchanged. On success Do returns 1.
- RePackArg writes `Result` as a VT_BOOL. Not undoable.

### `CopyCacheFiles`: SPEC

Wire contract:
- Args: `ObjectsToCache` (list), `SourcePathID` (default -1), `TargetPathID` (default -1),
  `Overwrite` (false), `ShowProgressbar` (true), `Version` (`A`).
- Both path ids must be < 5 (unsigned, so the default -1 fails): otherwise the call
  returns `0x80070057` without a message.
- Reads five path-template preferences (ids 0..4) and the cache file-name preference;
  the file name is checked for the `.pc2` extension.
- Empty source template: logs (severity 2) message 0x41e "The source path template %d is
  empty." and returns `0x80070057`. Empty target template: message 0x41f "The target path
  template %d is empty.", `0x80070057`.
- Collects (model name, object name, first frame, frame count) per input object
  (`0x180076730`, not read; `(inferred: from each object's cache settings)`).
- Optional progress bar titled with message 0x433 "Copying cache files...", item text
  "Copying cache files for <model>.<object>".
- Per object: creates a path resolver (`SICreateInstance` class `cf18...`, not named
  here), sets the current time, sets tokens `model`, `object`, `version`; resolves the
  target directory and creates it (`DSCreateDirectories`). If that fails it logs 0x420
  "Cannot copy files. The path %s is invalid." and skips the object. Otherwise, for each
  frame from first to first+count-1 it resolves the source and target file names and
  copies the file with `CopyFileW` (fail-if-exists = not `Overwrite`) when the source
  exists; a missing source counts as a failure. For `.pc2` caches only the first frame
  is copied (one file holds all frames).
- A token resolution failure returns `0x8000FFFF`.
- At the end, if any file failed: logs (severity 4) 0x41c "Copied %d files." and 0x41d
  "%d files could not be copied.". Returns 1 (S_FALSE) on completion. Not undoable.

### `RenameCPSetLayoutItems`: SPEC

Wire contract:
- Args: `InputObj` (custom property), `LayoutName` (default `Default`), `Indices`
  (array), `Name` (string).
- The task class only acts when the running command GUID equals
  `bf6f5f3b-4adf-4256-9f09-c2a0ca2768aa` (this command); otherwise Do / Undo return
  `0x8000FFFF` and UnPackArg does nothing.
- UnPackArg reads the four arguments in order (helpers `0x1800655d0`, `0x1800656c0`,
  `0x180065410`).
- Do: resolves the layout; if no layout, fails `0x80020004`. For each index in
  `Indices` (indices outside the item count are skipped), takes the layout item; on the
  first run it saves the item's current label (attribute `3613a916-7b20-11d2-bf3a-00a0c982ce5d`)
  for undo, then sets that attribute to `Name`. Afterwards the layout is refreshed.
- Undo runs the same body with the first-run flag clear `(inferred: restores the saved labels)`. Returns 0.

### `CreateObjectFromPreset`: SPEC

Wire contract:
- Args: `PresetObj` (preset, interface `0e9ce960-95a9-11d0-b685-00a024191ae0`), `Name`
  (default empty), `Value` (return).
- Worker: `SICreateObjectAndUpgradeFromPreset`; when `Name` is non-empty it renames the
  new object (component hierarchy set-name); the object is put in the transient object
  container (`F3DAddObjectToTransientObjectContainer`). On the first run it records the
  preset file path (`SIGetFilePathFromPreset`) and a soft reference to the object.
- Return value: the created object.
- Undo (only after a successful Do, else `0x8000FFFF`): if the object is a scene
  hierarchy object it is deleted through the delete helper class `dd531990-...`
  (slot 10); otherwise it is removed from the transient container.

### `ObjImport`, `SIObjExport`: SPEC

Wire contract (shared "custom command bridge" task):
- UnPackArg reads `Category` as a GUID. Category GUIDs `81f41aa1/81f41aa2-3b4d-11d5-...`
  and `a7931301-3f23-11d5-...` choose one bridge class, `81f41aa3-...` another. For both
  OBJ commands `Category` is the integer 4, so the GUID read fails and the class is chosen
  from the handler CLSID: `242679d3-...` -> bridge `0x180031910`; `89b8582b-...` and
  `001d605b-...` -> bridge `0x180031890`. No bridge: `0x80004005`.
- Bridge UnPackArg: hidden argument `_ScriptName` gives the plug-in file; `Name` (the
  hidden name argument: `Obj Import function` / `OBJ Export function`) gives the
  command name passed on.
- Do collects every argument that is not hidden (flag bit 0 clear) into a VARIANT array,
  loads the plug-in (extension must be `dll` or `so`, else `0x8000FFFF`) through the
  plug-in manager as a "Custom Command", and calls its export `XSIOnCommand(name, args,
  count, &ret)` (or `XSIOnCommandCPP` through an adapter). Load failure raises message
  0x416 and returns `0x80020009`; missing export raises id 0x7e and returns `0x80004005`.
  Afterwards output arguments (flag bit 2) receive the updated array values and the
  return-value argument (flag bit 9) receives `ret`.
- The OBJ work itself is in `customcommands.dll` (`XSIOnCommand` `0x180010d60`, export
  worker `0x180002590`, import worker `0x180008df0`; see CMD-01-OBJ-BIN). Undo/Redo: no-op.

### `FindObjects`: SPEC

Wire contract:
- Args: `Path` (string), `Type` (string), `Value` (return list).
- Both non-empty: raises "Both path and type given" (id 0x3eb) and returns `0x80070057`.
- Only `Path`, or neither: raises id 0x3eb with the type text and returns `0x80004001`
  (path search not implemented).
- `Type` only: converted to a class id (variant type 0x60), then all objects of that class
  are enumerated through the object database (generic object queried with the GUID pair at
  `0x18009d068` / `0x18009d058`). Objects whose owning model has flag bit 3 set are skipped
  `(inferred: referenced / internal models)`. The rest are added to the output list,
  optionally through a filter callback.
- RePackArg writes `Value`. Returns 1 when the enumeration ends. Undo/Redo `0x180070020`.

### `GetCurrentPass`: SPEC

Wire contract:
- Args: `Type` (bool, default false), `Value` (return).
- `Type` false: current item of the pass container (`F3DGetPassContainer`); true: current
  item of the layer container (`F3DGetLayerContainer`). Value = that object. Not undoable.

### `SetCurrentParType`: SPEC

Wire contract:
- Args: `Value` (object), `Type` (long, default 3).
- UnPackArg checks the object's class id against `Type`: 0 = pass
  `bfdaf164-5dd8-4422-9f1e-35527cdc2a02`, 1 = layer `479f2e10-3900-11d1-b0b3-00a024c79287`,
  2 = `a15b3913-073f-11d4-b7df-0008c7a011a6` (held by the 3D content container), 3 =
  particle type `4c038ff0-3b9b-11d3-a1f7-00a0248f9567`. Mismatch: `0x80004005`; no
  class-id interface: `0x80004002`.
- Do (inside a graph-update bracket): Type 0/1 makes the object current in the pass / layer
  container; for passes it fires two events (ids `0x20510029` before, `0x2051002a`
  after) carrying the old and new pass names. Type 2 sets it current in the content
  container's sub-container; Type 3 in the particle type container
  (`F3DGetParTypeContainer`). Other types: `0x8000FFFF`. On the first run the old current
  object and the new one are stored as soft references. Then the 3D content container is
  told to refresh.
- Undo restores the previous current object and refreshes.

### `SetDefaultKeyMap`: SPEC

Wire contract:
- Arg: `Name` (key map name).
- First run: saves the current default key map preference string for undo. Calls the
  keyboard-mapping manager (generic object `75477b70-e9fb-11ce-80eb-00aa006297e2`, slot 62)
  with `Name`. Manager missing: `0x80004005`. Returns 1 on the first run, 0 on redo.
- Undo calls the same with the saved name.

### `DumpCacheHeader`: SPEC

Wire contract:
- Args: `SourcePath` (string), `ShowInNetview` (default true).
- Empty path: `0x80070057`. Otherwise `F3DDumpCacheHeaderFromFile(path, out xmlPath)`;
  when the UI is running and `ShowInNetview` is true, runs `OpenNetView` with `URL` = the
  produced file. Returns 0. Not undoable.

### `CollapseOp`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (list), `Relative` (default true), `CollapseOperators` (output list).
- Do clears the child tasks, collects the operators of the input objects (image-operator
  interface `473feb00-64ed-11d1-84c6-00a0243e3543`), and for each one walks its input
  connections, calling the task's own per-operator collapse step (task slot 15) with
  `Relative`; resulting objects are appended to the output list. Undo needs a completed
  Do (else `0x8000FFFF`) and undoes the child tasks.
- RePackArg writes the list to the argument named `Value`.
- Missing: the per-operator collapse step (task slot 15) and the family test
  (`9440e671-...`, `16681c01-...`) were not read.

### `ReorderSceneItem`: SPEC

Wire contract:
- Args: `Parent`, `InputObj`, `MoveAction` (0..3), `Marker` (read only for actions 1 and 2).
- The worker requires both objects; actions 1 and 2 require `Marker`; actions other
  than 0..3 do nothing. If the item is locked, the lock error is raised. Otherwise
  `SIMoveObjectInHier(item, parent, action, marker)`; on S_OK it notifies the object and,
  on the first run, records soft references (object, parent, previous neighbour returned
  by the move, marker) and the action for undo.
- Undo (only after Do, else `0x8000FFFF`) calls `SIMoveObjectInHier` again and refreshes.

### `ImportPrefs`: SPEC

Wire contract:
- Arg: `FileName`.
- UnPackArg: missing argument `0x80070057`; the file must exist and end in `.DSPrefs`,
  else error id 0x33 with the name and `0x80070057`.
- Do posts request id `0x1bb0` to the service `4759ee60-c94e-11cf-b647-00a024191ae0`
  with this task as callback `(inferred: deferred execution)`; on that id the callback
  re-validates and loads the file through the framework preference loader. Returns 0.

### `CacheObjectsIntoFile_Private`: SPEC-PARTIAL

Wire contract:
- Args as registered; UnPackArg reads `ObjectsToCache`, `PathID`, `FirstFrame`,
  `FramesPerStep`, `Overwrite`, `ShowProgressbar`, `Attributes` (string or array),
  `Version`, `AlternativePath`, `KineAnimation`, `Type` (failed read = 0), then `LastFrame`
  for Type 0 or `FrameSet` (array of numbers; not an array: `0x80070057`) for Type 1, then
  `TargetCacheObjects`.
- Do builds the object/attribute plan, reads the cache name preference, optionally shows
  a progress bar and sets ambient value `Datamanagement_CachingToFiles` to 1 (back to 0
  at the end). Type 0 writes the frame range, Type 1 the frame set (only if given); other
  Type: `0x80004001`.
- RePackArg writes `ResolvedPath` with its last character removed.
- Missing: the writer functions `0x180079ac0`, `0x180079dd0` and the plan builder
  `0x180078660` (file naming, cache format) were not read.

### `PickPosition`: SPEC

Wire contract:
- Args: `LeftMessage`, `MiddleMessage` (must be strings, else `0x80070057`), outputs
  `PosX`, `PosY`, `PosZ`, `ButtonPressed`.
- Do clears the outputs; if the interaction service reports it cannot start a session it
  returns 0 with outputs 0. Otherwise it creates the pick tool (`0461b2c6-0ae3-11d2-...`),
  starts the position picker; S_FALSE from the start ends with outputs 0. The status text
  is `\n<LeftMessage>\n<MiddleMessage>\n` + message 0x40f "End". A sub message loop runs
  until the pick ends, then a command post. The tool writes the 3D position and the button
  (0 when cancelled `(inferred)`). Not undoable.

### `FilterPSet`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs`, `Relationship` (siPSetRelationship as a long), `Include`
  (default true), `Value` (return list).
- For each input object the predicate reads its property relationship flags; it keeps the
  object when (flags AND `Relationship`) is non-zero if `Include` is true, or zero if
  false. A kept multi-owner shared property, with `Include` true, is kept only when the
  owner count is below 3. Kept objects go to the output list; Do returns 1.
- Missing: the numeric values of `siPSetRelationship` (not in the repo).

## Open questions

| # | Question | Where to look |
|---|---|---|
| Q1 | CollapseOp per-operator step (task vtable `0x1800a4ea0` slot 15) | decompile slot 15 |
| Q2 | CacheObjectsIntoFile_Private writers / file naming | `0x180078660`, `0x180079ac0`, `0x180079dd0` |
| Q3 | ReorderSceneItem Undo repeats the move with the stored arguments, not the recorded previous position | `0x1800391c0`, `0x180039510` |
| Q4 | Preference names read by CopyCacheFiles / SetDefaultKeyMap (decompiler dropped the arguments) | disassemble the calls |
| Q5 | siPSetRelationship numeric values | SDK enum headers |
