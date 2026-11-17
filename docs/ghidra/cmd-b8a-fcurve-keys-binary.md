# CMD-B8a: Fcurve / key commands read from `fcurve.dll` (key save / remove / navigation, fcurve info, activation, animation removal)

Row: **CMD-B8a**. Status: **SPEC** (22 names), **SPEC-PARTIAL** (0 names); per command below.
Batch 9 (2026-11-17): `ActivateFCurve*` and `RemoveAnimation` closed after reading `0x180001240`, `0x180038d20`, `0x18003a440`, `0x18003a970` and the Layer Clip Helper (`0x180030b70`, `0x180034a40`, `0x180032f70`).
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fcurve.dll`, image base `0x180000000`, sha256 `70778c1a...610cbc62`.
Method: Ghidra decompilation of the task methods (12 handler classes) plus local static
vtable / thunk reading. All statements are behaviour read from the binary unless marked
`(inferred)`.

## 1. Handler table

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `IsAnimated` | `5196a050-cdad-11d3-acc4-0090275802bf` | `0x18004a1c0` | `0x180063720` | Do `0x18001fed0` -> `motionhelp.dll!SIIsAnimated` | `0x180020180` | `0x180020080` |
| `GetSource` | `30db8dc4-1788-11d3-bc37-00a0c9612b97` | `0x18004a140` | `0x180062720` | Do `0x18001f710` (thunk into `mohelper.dll!F3DGetAnimSources`) | `0x18001f7a0` | `0x18001f730` |
| `EvalFCurve` | `6913be21-7689-11d3-8d49-00609419fcaf` | `0x180049e40` | `0x18005da90` | Do `0x180014c60` -> `0x180014c10` | `0x180014d60` | `0x180014d40` |
| `GetFCurveInfo` | `e1d91ef4-1835-11d3-bc37-00a0c9612b97` | `0x180049f80` | `0x1800609d0` | Do `0x18001cf50` -> `0x18001cdf0` | `0x18001d1e0` | `0x18001cfb0` |
| `GetKeyInfo` | `ee2f6429-1868-11d3-bc37-00a0c9612b97` | `0x180049fc0` | `0x180060c20` | Do `0x18001d8b0` -> `0x18001d3f0` | `0x18001dc40` | `0x18001d950` |
| `AddFCurve` | `920f5f50-5d55-11d2-8082-00a0c955b335` | `0x180049c00` (ctor `0x18000a630`) | `0x180058f80` | slot 5 imported `OnDo`; per item slot 15 `0x18000aae0` -> `0x18000a7b0` (first run) / `0x18000a8e0` (redo) | `0x18000e800` (shared base) | imported base |
| `SetCurveType` | `2062ae20-0a3b-11d3-80d7-00a0c9ac19a9` | `0x18004a700` (ctor `0x1800450f0`) | `0x18006db30` | Do `0x1800454c0` -> list driver `0x180045490`; per item slot 15 `0x180045520` -> `0x1800452d0` | `0x180045690` | imported base |
| `SaveKey`, `SaveKeyOnKeyable`, `SaveKeyOnMarkedKeyable` (native entries) | `5ad1fd80-5d5d-11d2-8082-00a0c955b335` | `0x180049bc0` (ctor `0x1800054b0`) | `0x1800585a0` | Do `0x180008990` -> list driver `0x1800070e0`; per item slot 15 `0x180008a00` -> `0x180005ff0`; key writer `0x18001adb0` | `0x1800090a0` -> `0x18001c880` -> `0x18000e800` | imported base |
| `RemoveKey`, `RemoveKeyOnKeyable`, `RemoveKeyOnMarkedKeyable` | `5ad1fd81-5d5d-11d2-8082-00a0c955b335` | `0x18004a540` (ctor `0x18003b180`) | `0x18006ad40` | Do `0x18003c1d0` -> list driver `0x18003be80`; per item slot 15 `0x18003c250` -> `0x18003b300`; key remover `0x18001c0f0` | `0x18003c510` -> `0x18001c880` -> `0x18000e800` | imported base |
| `NextKey` | `5ad1fd82-5d5d-11d2-8082-00a0c955b335` | `0x18004a440` (ctor `0x180038590`) | `0x1800692f0` | Do `0x180047140` -> `0x180046a10`; per item `0x1800471a0` -> slot 29 `0x1800386f0` -> `0x180046ec0` | `0x1800474d0` | `0x180047480` |
| `PrevKey` | `5ad1fd83-5d5d-11d2-8082-00a0c955b335` | `0x18004a4c0` (ctor `0x180038860`) | `0x180069b70` | same Do; slot 29 `0x1800389b0` -> `0x180047200` | `0x1800474d0` | `0x180047480` |
| `FirstKey` | `ef512d00-07d8-11d3-80d6-00a0c9ac19a9` | `0x180049f40` (ctor `0x18001c980`) | `0x1800607a0` | same Do; slot 29 `0x18001caf0` -> `0x180046ac0` | `0x1800474d0` | `0x180047480` |
| `LastKey` | `ef512cf4-07d8-11d3-80d6-00a0c9ac19a9` | `0x18004a340` (ctor `0x18002f310`) | `0x180067160` | same Do; slot 29 `0x18002f470` -> `0x180046d20` | `0x1800474d0` | `0x180047480` |
| `SaveActionKey` (native entry) | `17383405-4517-11d3-b88c-00a0c92469be` | `0x18004a6c0` (ctor `0x180044690`) | `0x18006d2b0` | slot 5 imported `OnDo`; per item slot 15 `0x180044e10` -> `0x180044c30` -> `0x18001adb0`; source lookup slot 24 `0x1800447f0` | `0x180044fc0` -> `0x18001c880` | imported base |
| `ActivateFCurve`, `ActivateFCurveOnKeyable`, `ActivateFCurveOnMarkedKeyable` | `ab081aa2-10b5-4392-8a1d-bf44ac209826` | `0x180049b40` | `0x180056f80` | Do `0x180002380` -> list driver `0x180002110` -> per parameter `0x180001240`; Undo `0x1800026f0`; Redo `0x180002690` | `0x180002860` | imported base |
| `RemoveAnimation` | `5ad1fd7e-5d5d-11d2-8082-00a0c955b335` | `0x18004a500` | `0x18006a490` | Do `0x18003a660` -> `0x180039b70` (per parameter collector `0x180038d20`); Undo `0x180013d60`; Redo `0x18003a690` | `0x18003b090` | imported base |

Note: the static locator reports `0x18005ff30` / `0x18005aa60` / `0x18006ecb0` as the first
vtable of several classes; those are the shared base-class vtables. The constructors
overwrite them with the derived vtables listed above.

## 2. Shared facts

### 2.1 Registry: native entry versus script wrapper

`SaveKey`, `SaveKeyOnKeyable`, `SaveKeyOnMarkedKeyable` and `SaveActionKey` each appear
twice in `data/command_registry.json` under the same scripting name:

- a native entry handled by `fcurve.dll` (CLSIDs above; command GUIDs `27e3f6ca-9ec4-11d3-8107-00a0c9ac19a9`
  SaveKey, `89a18a33-899d-4a9e-8e82-ea02843320e5` SaveKeyOnKeyable,
  `1922f6c3-3882-49bd-a15b-fc7e66c07e51` SaveKeyOnMarkedKeyable,
  `17383407-4517-11d3-b88c-00a0c92469be` SaveActionKey);
- a wrapper entry with handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9` (not in
  `fcurve.dll`; handler DLL list `tasks.dll, scnmgr.dll, xsievents.dll`) that adds a
  `Source` argument (default `"FCurve"`, `"Action"` for the SaveActionKey wrapper) and,
  for the two keyable variants, a `MarkedOnly` boolean (default `False` for
  `SaveKeyOnKeyable`, `True` for `SaveKeyOnMarkedKeyable`). Wrapper GUIDs:
  `6b5d7cd2-fc8f-11d1-9727-00a0243e3463` (SaveKey), `7cdb8f89-7ad7-4322-9c86-6077b662f7e5`
  (SaveKeyOnKeyable), `14c3c078-6b15-45fe-8eda-678e90e3dce5` (SaveKeyOnMarkedKeyable),
  `d6cace26-9dfb-11d3-8107-00a0c9ac19a9` (SaveActionKey), plus twelve preset SaveKey
  wrappers whose `InputObjs` default is a kine.local pos / rot / scl parameter string.

This fragment documents the native entries. The native task never reads `Source` or
`MarkedOnly`.

### 2.2 Class families

- **Key iterator base** (`C3DCoreIteratorTask` subclass, base vtable `0x18005ff30`, base
  UnPackArg `0x18001c880`): used by SaveKey*, RemoveKey*, SaveActionKey and the four
  navigation commands. Virtual slots after the standard ones:
  23 create fcurve, 24 get fcurve for (parameter, time), 25 get the fcurve of a given
  animation layer (`0x18000e580`, `corehelper.dll!F3DGetComponentLayerSource`; a negative
  layer means `F3DGetCurrentKeyingLayer`), 26 ensure fcurve (`0x18000de70`: get, and if
  absent create then connect), 27 connect source to parameter, 28 disconnect source,
  29 command-specific worker.
- **FCurve iterator base** (base vtable `0x18005aa60`, base UnPackArg `0x18000e800`):
  AddFCurve and SetCurveType. Slot 23 `0x18000dfd0` = `actionhelper.dll!F3DCreateFCurve`,
  slot 24 `0x18000e560` = `actionhelper.dll!F3DGetFCurve`, slot 27 `0x18000df30` connects
  the source to the parameter, slot 28 `0x18000dff0` disconnects it.
- Both bases iterate the `InputObjs` list with the imported
  `C3DCoreIteratorTask::ForEach`; the current item is exposed to the per-item worker as a
  (component hierarchy, component) pair, i.e. one parameter per item.

### 2.3 How the parameter set is chosen (plain / OnKeyable / OnMarkedKeyable)

Read in the shared base UnPackArg `0x18000e800`, which runs for AddFCurve, SetCurveType,
SaveKey*, RemoveKey*, SaveActionKey, NextKey, PrevKey, FirstKey, LastKey; the same logic
is duplicated in the ActivateFCurve UnPackArg `0x180002860`.

1. The imported `C3DCoreIteratorTask::UnPackArg` fetches the `InputObjs` list.
2. The task asks the exec context (interface `26444edd-799f-11d2-8733-00a0c906816c`) for
   the GUID of the command being executed and compares it with fixed constants:

   | Command GUID | Command | Mode stored in the task |
   |---|---|---|
   | `89a18a33-899d-4a9e-8e82-ea02843320e5` | SaveKeyOnKeyable | 1 |
   | `b818591a-9b80-4841-a44c-50a54f0c8698` | RemoveKeyOnKeyable | 1 |
   | `1922f6c3-3882-49bd-a15b-fc7e66c07e51` | SaveKeyOnMarkedKeyable | 2 |
   | `7ce53211-ec01-4f9e-9f5e-aed87f70f718` | RemoveKeyOnMarkedKeyable | 2 |
   | `9e1b7471-12f0-4ac0-8e2b-056725019dc7` | ActivateFCurveOnKeyable | 1 (ActivateFCurve class) |
   | `e002fde5-1642-4c89-ab9a-82d2763038cf` | ActivateFCurveOnMarkedKeyable | 2 (ActivateFCurve class) |
   | any other | plain commands | 0 |

3. Mode 0: the list is used as delivered by the argument handler. For the plain
   commands the `InputObjs` argument handler is `fa0b5d32-5ec6-11d2-8083-00a0c955b335`
   (parameter-list handler; when the argument is omitted it supplies the marked
   parameters of the selection `(inferred from the registry descriptions "on marked
   parameters"; the handler lives outside fcurve.dll)`).
4. Mode 1 or 2: the `InputObjs` argument handler is `7834cb8c-5252-11d2-a5cc-00a0c91412de`
   (object list; default is the selection `(inferred)`). The task then calls
   `mohelper.dll!F3DGetKeyableParams(list, false, false, true, markedOnly, &out)` with
   `markedOnly = (mode == 2)` and **replaces** its working list by the returned list.
   So `...OnKeyable` works on the keyable parameters of the input objects and
   `...OnMarkedKeyable` on the subset of those that is also marked. A negative status
   from the helper aborts UnPackArg with that status.
5. What the helper returns when nothing is marked is decided inside `mohelper.dll` and
   was not read. What `fcurve.dll` does with an empty resulting list is read: see each
   command (SaveKey logs message `0x26` and returns status 1; RemoveKey returns status 1
   silently).

### 2.4 Shared scalar argument handling (key iterator base `0x18001c880`)

- `Time` (frames) is read as a double and converted with `SIFramesToSeconds`; all key
  times inside the task are seconds.
- `Tolerance` (frames): must be `-1` or `>= 0`. Any other negative value raises error
  `0x80070057` with message id `0xb9` (severity 2). A positive value is converted to
  seconds. `-1` means "default": where a default is needed the code uses half a frame
  (`SIFramesToSeconds(0.5)`).
- Parameters whose hierarchy exposes the time-mapping interface
  `16ae2827-83ee-11d3-b36d-00105a1e6ce9` have the key time and the tolerance mapped
  through it before the fcurve is touched.

### 2.5 Per-parameter precheck (`0x18000ea30`), used by AddFCurve, SaveKey, RemoveKey, navigation

Returns "skip this parameter" (status 1, not an error) when: the parameter answers the
attribute query `a7e8a2d0-769f-11d3-9e90-00a0248f947c` with S_OK; or the parameter is
locked (`CSILockStatus::IsLocked(2)`) and the lock is not a reference-model lock, in
which case the lock error is raised through `CSILockStatus::RaiseError`; or the
get-fcurve slot fails with `0x80004005`. Any other failure of the get-fcurve slot is
returned as an error.

### 2.6 Message catalogue ids seen (`DictLoadIdstring(L"XSIFCURVE", id)`)

`0x30` save-key refused because the keying layer is locked (takes parameter names);
`0x31` remove-key refused because the keying layer is locked; `0x28`, `0x25`, `0x27`
SaveKey per-list warnings (see SaveKey steps 3b to 3d); `0x26` SaveKey "nothing to key";
`0x37` RemoveAnimation layer warning. The texts were not read (they are in the
dictionary, not in the DLL code).

### 2.7 Layer Clip Helper (class `42eb14da-bcab-4e24-bee6-b8a0bb496c3a`, read 2026-11-17, batch 9)

Served by `fcurve.dll` itself (registered name `Layer Clip Helper`; creation function
`0x18004a380`, constructor `0x1800304c0`, task interface `d3e8ed6d-0324-4e7c-acf7-28239d9ff495`
with vtable `0x180068220`). It is a small task that batches edits to the action source
of animation-layer clips and is used by `RemoveAnimation`, `RemoveKey`, `PasteAnimation`
and `DuplicateAnimationLayer`.

- Slot 9 (`0x180030b70`), "register clip": the object must be a `Mixer Layer Clip`
  (class `bb3ca994-...`), else `0x80070057`; after a commit the helper refuses with
  `0x80004005`. A per-clip record with a soft reference is created once.
- Slot 12 (`0x180034a40`), "remove item by name": registers the clip if needed and adds
  the name to that clip's edit map with no replacement source.
- Slots 10 / 11 (`0x180031470`, `0x180030dc0`) add a replacement source under a name
  (used by `PasteAnimation`; bodies not read here).
- Slot 13 (`0x180032f70`), "commit(duplicate flag)". Because the items of an action
  source are not edited in place, each registered layer is **rebuilt**:
  1. the clip, its track, its model (`SIGetPrimaryModelForAction`) and its action source
     are resolved; the lock state of the layer and the names of clip, track and source
     are read;
  2. every active item of the old source whose name is **not** in the edit map and
     that holds a plain source is duplicated (duplicate task `747d257f-...`) and kept
     with its name; names in the edit map are not carried over;
  3. the position of the old track among the mixer tracks is counted;
  4. flag 0 only: the old clip is deleted with a `DeleteObj` task (option `0x10`), kept
     in the record for undo;
  5. a new action source (class `12a3efc5-...`) is created, named like the old one,
     filled with the carried-over items and then with the edit-map entries, added to
     the mixer's source container and to the mixer;
  6. a new layer track is created at the counted position with the `AddTrack` task
     (`67b8773c-...`, type `d9fa2370-...`), named like the old track; a new layer clip
     (class `bb3ca994-...`) instancing the new source is put on it;
  7. flag 0: if the old layer was locked the new clip is locked again with the
     `LockAnimationLayer` task (`f9ce2086-...`). Flag 1 (duplicate): the old clip is
     kept, and the new source, track and clip names get the suffix `_copy` (unless the
     name already contains `_copy`);
  8. soft references to the new track and the mixer are stored for undo; afterwards the
     edit map is cleared and the helper is marked committed. Returns 0.
- Helper `0x180031810` (called with the model and the old / new clip around the
  rebuild) was not read.

---

## 3. Contracts

### `IsAnimated`: SPEC

**Wire contract**

- Purpose: report whether an object / parameter is driven by an animation source, and
  optionally return the animated components.
- Arguments: `InputObj` (in, object list, handler `7834cb8c-...`); `SourceMask` (in,
  string enum, default `siAnySource`); `BranchFlag` (in, default `siUnspecified` = 3);
  `AnimComponents` (out, VT_DISPATCH list); `Local` (in, bool, default False);
  `Value` (return, bool).
- Steps:
  1. `InputObj` is fetched as a list. Empty list: error `0x80070057`, message id `0x3eb`,
     severity 2.
  2. Only the first item is used. If the list holds more than one item a warning
     (severity 4, message id `0x3d`) is logged with the name of the first item, and the
     command continues with that item.
  3. `SourceMask` and `BranchFlag` are read as longs. If `BranchFlag` is 3
     (`siUnspecified`) the item's own branch flag is used instead.
  4. The item is resolved to its component hierarchy (interface
     `4aeaeaea-1a43-11d2-8d66-00a0c982a649`).
  5. `AnimComponents` is inspected only to decide whether the caller wants the list:
     the list is requested unless the incoming variant is a VT_DISPATCH holding a null
     pointer.
  6. `Local` is read as a boolean.
  7. Do: when the effective branch flag is 0 (`siNode`) and the hierarchy supports
     interface `eff95863-6291-11d1-be9e-00a024ee478d`, the hierarchy is replaced by the
     object obtained from it with `2323fb8f-c53b-11d2-80eb-00a0c9615daf` (node-only
     scope). Then `motionhelp.dll!SIIsAnimated(hierarchy, NULL, SourceMask, Local,
     wantList ? &list : NULL)` is called.
- Return: `Value` = true exactly when the helper returns status 0; status 1 gives false.
  `AnimComponents` is written (as VT_DISPATCH) only when a list was produced.
- Undo / Redo: none (both slots are the shared no-op `0x180016fa0`).
- Errors: negative helper status is returned unchanged.

### `GetSource`: SPEC

**Wire contract**

- Purpose: return the animation sources attached to the input parameters.
- Arguments: `InputObjs` (in, parameter list, handler `fa0b5d32-...`); `SourceMask` (in,
  string enum read as long, default `siAnySource`); `Value` (return, object).
- Steps: `InputObjs` is fetched as a list (list IID `f49f6470-4211-11d0-8463-00a024c7919c`),
  `SourceMask` as a long. Do is a tail call to
  `mohelper.dll!F3DGetAnimSources(list, SourceMask, &result)`; the result is a new list
  of source objects matching the mask `(inferred from the helper name and description)`.
- Return: when the helper produced a list, `Value` is set to it as an object reference
  (variant type 13); when it produced nothing RePackArg returns status 1 and `Value` is
  left untouched.
- Undo / Redo: none.

### `EvalFCurve`: SPEC

**Wire contract**

- Purpose: evaluate the fcurve attached to a parameter at a given frame.
- Arguments: `InputObj` (in, parameter list); `Time` (in, frames, time handler
  `e9bae81a-...`, default current time `(inferred from the handler)`); `Value` (return,
  double).
- Steps:
  1. `InputObj` is fetched as a list and passed to
     `mohelper.dll!F3DGetAnimSources(list, 1, &sources)`; mask 1 selects fcurve sources.
  2. Only when the helper returns status 0, the first source is taken and its fcurve
     interface `c1afbd50-debf-11cf-8290-00a0243f1013` is kept.
  3. `Time` is read as a double and converted to seconds.
  4. Do: if an fcurve was found it is evaluated at that time (fcurve method at vtable
     offset `0x78`) and the result stored.
- Return: `Value` = the evaluated double. If the parameter has no fcurve source the
  evaluation is skipped, Do answers status 1, and the result field is **not
  initialised** by the constructor `0x180014ac0` (it clears only the fcurve pointer
  and one flag), so `Value` is undefined in that case; an implementation should
  return an empty / zero value and treat the call as "nothing evaluated".
- Undo / Redo: none.

### `GetFCurveInfo`: SPEC

**Wire contract**

- Purpose: return the header information of an fcurve.
- Arguments: `InputObj` (in, single object, handler `55f36231-840c-11d2-b904-00a024c78ee3`:
  the fcurve itself or an object convertible to it); outputs `CurveKind` (long),
  `ValueWhenNoKey` (double), `NbKeys` (long), `ExtrapolationKind` (long),
  `DefaultSegKind` (long), `LowClamp` (double), `HighClamp` (double).
- Steps: `InputObj` is fetched with IID `872903d0-3ef3-11d0-8463-00a024c7919c` and
  converted to the fcurve interface `a619ba60-a3de-11d1-8a23-00a0243e3665`. One call to
  the fcurve "get info" method with field mask `0x3f` yields kind, value-when-no-key,
  key count, default segment kind and the two clamps. The extrapolation kind comes from
  a second interface, `31ca7790-532a-11d2-8d74-00a0c982a649`.
- Return: the seven outputs, written in the order ValueWhenNoKey, LowClamp, HighClamp
  (doubles) then CurveKind, NbKeys, DefaultSegKind, ExtrapolationKind (longs). The enum
  values are passed through unchanged from the fcurve object.
- Errors: null exec context `0x80004003`; fcurve without the second interface
  `0x80004005`.
- Undo / Redo: none.

### `GetKeyInfo`: SPEC

**Wire contract**

- Purpose: return the data of one key, by index.
- Arguments: `InputObj` (in, same handler as GetFCurveInfo); `Index` (in, long, default
  0); outputs `Parameter` (key time), `LeftValue`, `RightValue`, `LeftTanParam`,
  `LeftTanValue`, `RightTanParam`, `RightTanValue` (doubles), `RightSegKind` (long),
  `Constraints` (long bit mask).
- Steps:
  1. Resolve the fcurve as in GetFCurveInfo.
  2. Read the key count (info mask 2). If the count is 0 or `Index >= count`: error
     `0x80070057`.
  3. Read the key record with field mask `0x1fe`; the seven doubles and the segment
     kind are copied as stored (no frame / second conversion is applied here).
  4. `Constraints` is rebuilt bit by bit by asking the fcurve (interface `31ca7790-...`)
     whether each constraint is set on the key at that key time, for the bits `0x1`,
     `0x2`, `0x4`, `0x8`, `0x10`, `0x20`, `0x40`, `0x80`, `0x800`; bit `0x100` is tested
     only when bit `0x800` is set.
- Errors: fcurve without interface `31ca7790-...` gives `0x80004005`.
- Undo / Redo: none.

### `AddFCurve`: SPEC

**Wire contract**

- Purpose: give every input parameter an (empty) fcurve source.
- Arguments: `InputObjs` (in, parameter list; default marked parameters `(inferred)`).
  No return value.
- Steps per parameter (first execution):
  1. Precheck 2.5; a skipped parameter is not an error.
  2. `actionhelper.dll!F3DGetFCurve`: status 0 means the parameter already has an
     fcurve, and the parameter is left alone (status 1).
  3. Otherwise `actionhelper.dll!F3DCreateFCurve` creates one and it is connected to the
     parameter as its source.
  4. An undo record holding a soft reference to the parameter is added.
  5. The new fcurve is appended (as an element reference) to an internal result list.
     Nothing is written back to the exec context.
- Undo: per record, the source is disconnected from the parameter. Redo reconnects the
  same fcurve object.
- Errors: unresolvable fcurve on redo `0x80004002`.

### `SetCurveType`: SPEC

**Wire contract**

- Purpose: set the interpolation type of the fcurves on the input parameters.
- Arguments: `InputObjs` (in, parameter list); `Interpolation` (in, unsigned long,
  default 0). No return value.
- Steps per parameter: `F3DGetFCurve`; a parameter without an fcurve is skipped. On the
  first execution the current interpolation is read from the fcurve and stored with the
  new one in an undo record. The interpolation is then set through the fcurve interface
  `31ca7790-...` (method at vtable offset `0x150`, second argument 0). The numeric value
  is passed through without validation in this DLL; the documented values are
  1 constant, 2 linear, 3 cubic `(inferred from the SDK enum, not checked here)`.
- Undo: the stored previous interpolation is written back the same way; Redo reapplies.

### `SaveKey` (native entry): SPEC

**Wire contract**

- Purpose: set a key at a time on each input parameter, creating the fcurve when
  needed, with support for animation layers, autokey scope and "modified only".
- Arguments: `InputObjs` (in, parameter list, default marked parameters `(inferred)`);
  `Time` (in, frames, default current); `Value` (in, variant, default empty);
  `Tolerance` (in, double frames, default -1); `Layer` (in, long, default -1);
  `ModifiedOnly` (in, bool, default False); `AutokeyScope` (in, long, default 0);
  `Source` (registry only, never read by the native task). No return value.
- Argument decoding: 2.3 and 2.4, then `Value`: an empty variant means "use the
  parameter's current value" (internally the sentinel `DBL_MAX`); a numeric variant
  (I2, I4, R4, R8, BOOL, I1, UI1, UI2, UI4, INT, UINT) is converted to a double; other
  types leave the previous content. `Layer` negative means the current keying layer of
  each parameter.
- Steps:
  1. Empty input list: fall through to step 4.
  2. List pre-pass, per parameter (compound parameters are first resolved to the real
     parameter with `F3DGetRealComponentFromCompound`):
     a. parameter locked inside a reference model: lock error raised, parameter dropped;
     b. effective layer is not the base layer and `F3DIsKeyingLayerLocked`: dropped, name
        collected for message `0x30`;
     c. effective layer > 0 and the parameter's attribute `e34e4618-6367-4505-9a08-b5b864b45599`
        is non-empty: dropped, name collected for message `0x28`;
     d. effective layer is not the base layer and the helper `0x180005e10` returns
        non-zero (it walks the parameter and its parents looking for a mixer entry with
        filter value `0x28` and returns 1 when none is found; meaning of the filter not
        established): dropped, name collected for message `0x25`;
     e. effective layer index >= `F3DGetNbKeyingLayers`: dropped, name collected for
        message `0x27`;
     f. duplicates of an already accepted parameter are dropped silently;
     g. when no explicit `Value` was given or `ModifiedOnly` is true, the parameter's
        current value and its animated value at `Time` are recorded per parameter
        (rotation parameters of one object are linked as an Euler triple so that a layer
        key stores a proper rotation offset);
     h. when keying a layer (> 0) the layer fcurve is created up front if missing.
  3. Warnings (severity 4) are logged once per category with the collected names:
     `0x30`, `0x28`, `0x25`, `0x27`.
  4. If the filtered list is empty the command returns status 1. When none of the
     categories b, d, e fired, message `0x26` is logged, at severity 8 in the application
     mode tested by the code and severity 2 otherwise.
  5. First execution only: a persistent reference to the filtered list is stored for redo.
  6. Per parameter (`0x180005ff0`):
     - precheck 2.5; reference-model lock check; locked keying layer logs `0x30` at
       severity 2 and skips;
     - `AutokeyScope`: 0 keys every parameter; non-zero requires the parameter to have
       an fcurve already (otherwise skipped silently); 1 additionally requires an
       existing key at `Time` within half a frame;
     - `ModifiedOnly`: when true and the parameter has an fcurve and its current value
       differs from its animated value by no more than 1e-9, no key is set;
     - layer keys: the stored value is the offset (current value minus animated value
       plus the layer curve's value at `Time`); boolean parameters use -1 / 0 / 1; Euler
       triples go through a rotation composition;
     - the key writer `0x18001adb0`: reads the current value when the value is the
       sentinel; ensures the fcurve (create and connect if absent); if a key already
       exists at `Time` within `Tolerance` its old value is remembered and, for standard
       fcurves, its tangent handles and key constraint flags are saved and restored
       around the write; then the fcurve "set key" method is called with (time, value,
       tolerance). When `Time` is not the current time, port notifications are suspended
       during the write and a refresh notification is sent afterwards; when it is the
       current time the interaction node of the parameter is invalidated;
     - `corehelper.dll!F3DRequiresDeltaCreation`: when it returns 0 a helper task (class
       `d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b`, mode 2) is run and attached as a sub-task
       (reference-model delta recording `(inferred)`);
     - first execution: an undo record (parameter reference, time, new value, old value,
       "key existed" flag, saved fcurve state) is added.
- Created / changed: fcurve source on parameters that had none (on a layer: an fcurve in
  that layer's action source, created by slot 23 `0x180005800`); one key per accepted
  parameter. Selection and marking are not touched.
- Undo: per record, if the key did not exist before it is removed (`0x18001c0f0`),
  otherwise the old value is written back; saved fcurve state is restored; fcurves
  created for the command are disconnected; sub-tasks are undone. Redo recreates layer
  fcurves where needed and replays.
- Errors / statuses: `0x80070057` + message `0xb9` for a bad `Tolerance`; status 1 when
  nothing was keyed; null list `0x80004003`.

### `SaveKeyOnKeyable` (native entry): SPEC

Same class and contract as `SaveKey`, with these differences (all read):

- `InputObjs` is an object list (handler `7834cb8c-...`, default selection `(inferred)`).
- Mode 1 of 2.3: before anything else the list is replaced by
  `F3DGetKeyableParams(list, false, false, true, false, &out)`, i.e. the keyable
  parameters of the input objects regardless of marking.
- Everything after that is the SaveKey contract applied to that list (`Time`, `Value`,
  `Tolerance`, `Layer`, `ModifiedOnly`, `AutokeyScope` identical).

### `SaveKeyOnMarkedKeyable` (native entry): SPEC

Read and established:

- Same class as `SaveKey`; command GUID `1922f6c3-3882-49bd-a15b-fc7e66c07e51` selects
  mode 2 of 2.3.
- `InputObjs` is an object list (handler `7834cb8c-...`). The working list is replaced
  by `F3DGetKeyableParams(list, false, false, true, true, &out)`: the only difference
  from `SaveKeyOnKeyable` is the fifth argument (`true`), the "marked only" switch.
- No other code path in `fcurve.dll` looks at marking: there is no fallback to "all
  keyable" inside this DLL. If the helper returns an empty list, SaveKey step 4 applies:
  status 1, message `0x26`, no key set, no undo data.
- The rest is the SaveKey contract (same arguments, layers, autokey scope, modified
  only, undo).
- The wrapper entry of the same scripting name (GUID `14c3c078-...`, handler
  `5c0cf8b6-...`) carries `MarkedOnly` default `True`; the `SaveKeyOnKeyable` wrapper
  carries `MarkedOnly` default `False`. That agrees with the native pair differing only
  in the marked switch.

Update 2026-11-17: the helper was read afterwards (see the addendum at the end of this note); the paragraph below is kept for the record. Originally missing: the body of `mohelper.dll!F3DGetKeyableParams` was not read, so
the exact definition of "marked keyable" (intersection of marked and keyable, treatment
of compound markings such as a marked `kine.local.pos`, and whether it falls back to all
keyable parameters when nothing is marked) is not established; nor is the wrapper
handler `5c0cf8b6-...` that decides between the native entries.

### `RemoveKey`: SPEC

**Wire contract**

- Purpose: remove the key at a time from each input parameter's fcurve.
- Arguments: `InputObjs` (in, parameter list, default marked parameters `(inferred)`);
  `Time` (in, frames, default current); `Tolerance` (in, double frames, default -1);
  `Layer` (in, long, default -1 = current keying layer). No return value.
- Steps:
  1. List pre-pass: parameters whose effective layer is not the base layer and whose
     keying layer is locked are dropped; their names are logged once in warning `0x31`
     (severity 4). Empty resulting list: status 1, nothing logged.
  2. Per parameter (`0x18003b300`): precheck 2.5; reference-model lock check; locked
     layer logs `0x31` at severity 2 and skips; the fcurve for the layer is fetched;
     the key remover `0x18001c0f0` runs:
     - no fcurve, or no key at `Time` within `Tolerance`: nothing happens for that
       parameter;
     - the key's value (and quaternion key data for rotation curves) is saved first;
     - if the fcurve has more than one key, or belongs to a layer, or is a quaternion
       curve, the key is removed from the curve; a layer curve left with its single key
       removed is reset;
     - if it was the last key of a base-layer standard fcurve, the fcurve is
       disconnected from the parameter instead (the parameter becomes unanimated) and the
       "source removed" flag is set;
     - when the task flag at offset `0xe8` is set (origin not read) and the removal
       succeeded, the parameter value is re-applied at `Time` after the removal: the
       saved key value when the parameter has no layers, otherwise the value read from
       the parameter just before the removal;
     - a `0x80004005` answer from the curve's remove-key method is tolerated.
  3. When the source was removed and `F3DRequiresDeltaCreation` returns 0, two delta
     helper tasks (class `d8b3c0e0-...`, modes 2 and 1) are run and attached as
     sub-tasks.
  4. When a layer fcurve ends up with no keys, the corresponding item is removed from
     the layer's action source through the Layer Clip Helper (class `42eb14da-...`,
     2.7, "remove item by name").
  5. First execution: undo record with parameter reference, time, removed value and
     saved fcurve state.
- Undo: the key is written back with the key writer `0x18001adb0` (same time, saved
  value, saved quaternion key), the saved fcurve state is restored and sub-tasks are
  undone. Redo replays the removal.
- Errors: bad `Tolerance` as in 2.4.

### `RemoveKeyOnKeyable`: SPEC

Same class and contract as `RemoveKey`; command GUID `b818591a-...` selects mode 1, so
the working list is `F3DGetKeyableParams(list, false, false, true, false, &out)` computed
from the input object list (handler `7834cb8c-...`).

### `RemoveKeyOnMarkedKeyable`: SPEC

Same class and contract as `RemoveKey`; command GUID `7ce53211-...` selects mode 2, so
the working list is `F3DGetKeyableParams(list, false, false, true, true, &out)`. An empty
list returns status 1 without any message. The definition of the marked subset is inside
the helper (same limitation as `SaveKeyOnMarkedKeyable`; here it does not change the
fcurve.dll contract).

### `NextKey` / `PrevKey` / `FirstKey` / `LastKey`: SPEC

**Wire contract**

- Purpose: find a key time across the input parameters and move the current time to it.
- Arguments: `InputObjs` (in, parameter list, default marked parameters `(inferred)`);
  `Time` (in, frames, default current); `Tolerance` (in, double frames, default -1;
  registered for NextKey and PrevKey only); `Layer` (in, long, default -1);
  `Value` (return, double, frames).
- The four commands are four classes sharing every method except virtual slot 29, the
  per-parameter search; nothing is keyed on the command GUID.

  | Command | Slot 29 | Search on each parameter's fcurve | Combination across parameters |
  |---|---|---|---|
  | NextKey | `0x1800386f0` -> `0x180046ec0` | first key after `Time` (fcurve method at offset `0xc8`, with tolerance) | smallest candidate |
  | PrevKey | `0x1800389b0` -> `0x180047200` | last key before `Time` (offset `0xc0`, with tolerance) | largest candidate |
  | FirstKey | `0x18001caf0` -> `0x180046ac0` | first key of the curve (offset `0xb0`) | smallest candidate |
  | LastKey | `0x18002f470` -> `0x180046d20` | last key of the curve (offset `0xb8`) | largest candidate |

- Steps:
  1. Arguments per 2.3 / 2.4, then `Layer`.
  2. Per parameter: precheck 2.5; the fcurve of the requested layer is fetched through
     slot 25 (`F3DGetComponentLayerSource`; negative layer = current keying layer);
     parameters without an fcurve or with zero keys are ignored; NextKey / PrevKey use
     `Tolerance` (-1 means half a frame) so that a key at `Time` itself is not returned.
     Time-mapped parameters (2.4) are mapped in and the result mapped back.
  3. If a time was found, the scene's current time is set to it through the playback
     object (`DSQueryGenericObject` class `3e57caba-2b4c-438b-89aa-eee5fe5bbf38`).
     If none was found the Do returns status 1 and the current time is not changed.
- Return: `Value` = found time converted with `SISecondsToFrames`. When nothing was
  found the internal sentinel (plus or minus `DBL_MAX`) is doubled and returned as is,
  i.e. a non-finite number.
- Undo (`0x18001cba0`): the current time is set back to the `Time` argument (the time
  the search started from, task field in seconds). Redo (`0x18001cb90`): the current
  time is set to the found time again. Both go through `0x18001c7e0`, which uses the
  playback object and answers `0x80070057` when the stored time is the plus or minus
  `DBL_MAX` sentinel (nothing was found).

### `SaveActionKey` (native entry): SPEC

**Wire contract**

- Purpose: set a key in the fcurve of an action source when that action is the only
  thing driving the parameter at the given time.
- Arguments: `InputObjs` (in, parameter list); `Time` (in, frames, default current);
  `Value` (in, variant, default empty = current value); `Tolerance` (in, double frames,
  default -1). The wrapper's `Layer`, `ModifiedOnly`, `AutokeyScope`, `Source` are not
  read by the native task. No return value.
- Steps per parameter:
  1. Source lookup (slot 24, `0x1800447f0`): the real parameter is resolved from
     compounds; the animation-mixer drivers of the parameter at `Time` are enumerated;
     exactly one active driver must exist and it must not be blended; its fcurve
     (interface `c1afbd50-...`) is returned and `Time` is replaced by the corresponding
     time local to that clip. Any other situation gives `0x80004005`.
  2. The shared key writer `0x18001adb0` sets the key (same existing-key handling as
     SaveKey). A parameter for which the lookup yields no fcurve is skipped without
     error.
  3. First execution: undo record (time, new value, old value, existed flag).
- Undo (`0x180044e60`): the key is removed if it did not exist before, otherwise the old
  value is written back. Redo replays.
- No layer filtering, no autokey scope, no `ModifiedOnly`, no delta task in this class.

### `ActivateFCurve` / `ActivateFCurveOnKeyable` / `ActivateFCurveOnMarkedKeyable`: SPEC

**Wire contract** (range branch and helper sub-tasks read 2026-11-17, batch 9)

- Purpose: mute / unmute whole fcurves, or deactivate / reactivate a frame range of
  them. On **boolean** fcurves the range form instead writes the on / off state as keys.
- Arguments: `InputObjs` (in; parameter list handler `fa0b5d32-...` for ActivateFCurve,
  object list handler `7834cb8c-...` for the two keyable variants); `Activate` (in,
  bool, default True); `StartFrame`, `EndFrame` (in, variant, default empty);
  `Type` (in, `siParameterScope` read as long, default `siInputParams`, ActivateFCurve
  only). No return value.
- Parameter set:
  - ActivateFCurve (mode 0) reads `Type`: value 3 = every fcurve of the scene
    (`motionhelp.dll!F3DCollectAllFCurvesFromActiveDB`; `InputObjs` is not read at all;
    the callback `0x1800025b0` keeps fcurves of kind 0 or 4 whose curve object answers
    true to a query at vtable offset `0x298`); value 2 = for every input object, all
    its fcurve-animated parameters (`SIIsAnimated` with mask 1, node or branch according
    to the item); any other value = the input list as given.
  - OnKeyable (mode 1) / OnMarkedKeyable (mode 2): `Type` is not read; the list is
    replaced by `F3DGetKeyableParams(list, false, false, true, mode == 2, &out)` (2.3).
- Range decoding: if `StartFrame` is empty the whole curve is addressed. Otherwise
  `StartFrame` must be numeric and `EndFrame` is read: empty again means whole curve,
  numeric gives the range end. Both are converted to seconds; a reversed range is
  swapped in the worker (start = the smaller time, end = the larger).
- Per parameter (`0x180001240`), step 1, which curve is addressed:
  - the parameter's fcurve source (interface `01dfa2a0-6962-11ce-b8ac-00aa005c18ec`) is
    used when it has one;
  - a parameter **without** an fcurve whose capability flags have bit 0 set (animatable)
    gets a *temporary* fcurve from the fcurve creator class
    `ceb464fa-00f9-11cf-80f1-00aa006297e2` (interface `2fa89991-6633-11ce-b8ac-00aa005c18ec`),
    only so that its kind and constant values can be read; the creator takes it back at
    the end of the step. Below this is "the temporary case";
  - a parameter with neither is left alone.
  The curve kind is then read; kind `10` is the boolean fcurve kind.
- Step 2, whole curve (no range):
  - real fcurve, any kind: the mute state is set to the inverse of `Activate` (interface
    `31ca7790-...`, method at offset `0x1a8`); the parameter is recorded for undo when the
    call answers status 0.
  - temporary case, boolean parameter: the parameter's value at the current time is read
    and the **logical inverse** of it is written back at the current time through a
    `SetValue` sub-task (`c089b901-8481-11d2-b118-00a024c79287`). `Activate` is not
    looked at on this path: an unanimated boolean parameter is simply toggled.
  - temporary case, other kinds: nothing (status 1).
- Step 3, range on a non-boolean fcurve: the range is deactivated (offset `0x1c8`,
  `Activate` false) or reactivated (offset `0x1d0`, `Activate` true) between the two
  times; recorded for undo when the call answers status 0. In the temporary case the
  call only touches the throw-away curve, so nothing lasting happens `(inferred)`.
- Step 4, range on a **boolean** fcurve (kind 10). Let `v` = 1.0 when `Activate` is
  true, 0.0 when false, and `!v` the other one. The edit is done entirely with nested
  key commands, so that the curve reads `v` over `[start, end]` and keeps what it had
  outside:
  1. Early out: the curve is asked for its value at `start` and at `end` (curve method
     at offset `0x68`, mode 2, tolerance 1e-12). When both queries answer a non-zero
     status and the value at `start` already equals `v` while the value at `end` differs
     from `v`, nothing is done for this parameter.
  2. All key times are listed. The first key strictly after `start` is located; the
     value the curve holds on the left side of that key is the *value before the range*.
     Every key with `start < time <= end` is collected. The first key after `end` gives,
     by its left-side value, the *value after the range*; when there is no key after
     `end` the curve's trailing constant (curve getter at offset `0x188`) is used.
     When no key lies after `start` at all, the value before the range is taken equal to
     that trailing constant. In the temporary case both values come from the curve's two
     constant getters (offsets `0x170` and `0x188`).
  3. Each collected key is removed with a `RemoveKey`-class sub-task
     (`5ad1fd81-5d5d-11d2-8082-00a0c955b335`, run with owner, parameter, key time).
  4. If the value before the range differs from `v`: a key with value `v` is set at
     `start` with a `SaveKey`-class sub-task (`5ad1fd80-5d5d-11d2-8082-00a0c955b335`, run
     with owner, parameter, time, value). When the first key after `start` was the very
     first key of the curve (or in the temporary case), a key with value `!v` is set
     first, one time unit before `start` (a `CDSTime` built from the value 1.0;
     one frame `(inferred)`), so that the curve does not read `v` before the range.
  5. If the value after the range differs from `v`: a key with value `!v` is set at
     `end` with another `SaveKey`-class sub-task.
  6. Each sub-task that answers status 0 is attached to the command on first execution.
     The parameter is **not** put on the command's own undo list on this path; the
     sub-tasks carry the undo.
- After a real fcurve was edited its end-of-edit notification (fcurve method at offset
  `0x90`) is sent. Parameters recorded for undo are kept as a soft list reference.
- Undo: sub-tasks are undone, then the mute / range operation is applied to the recorded
  parameters with `Activate` inverted. Redo: sub-tasks are redone and the operation
  reapplied.
- Errors: fcurve without interface `31ca7790-...` gives `0x80004002`; failures of the
  creator, of a sub-task or of `AddTask` are returned unchanged.
- Not confirmed (does not block the contract): the symbolic names of the
  `siParameterScope` values other than the tested 2 and 3.

### `RemoveAnimation`: SPEC

**Wire contract** (collector and layer removal read 2026-11-17, batch 9)

- Purpose: remove animation sources from the input parameters while keeping their
  value at a given time.
- Arguments (UnPackArg `0x18003b090`, read): `InputObjs` (in, parameter list, default
  marked parameters `(inferred)`); `Time` (in, frames, converted to seconds);
  `StaticFCurves` (in, bool, default False); `BaseAnimation` (in, bool, default True);
  `LayerAnimation` (in, bool, default True; the task presets True before reading);
  `SourceMask` (in, `siSourceType` read as long, default `siAnySource`; the task presets
  4 before reading). No return value.
- `SourceMask` bits as tested by the code: `1` = fcurve sources (interface
  `c1afbd50-debf-11cf-8290-00a0243f1013`), `2` = expression sources (interface
  `481262ff-7ddb-11d0-a57f-00a0c91412de`), `4` = any source, `0x10` = constraints. The
  layer pass runs for masks containing `1` or `4`; the constraint pass for masks
  containing `4` or `0x10`.
- "Static" test (`0x18003a440`), used when `StaticFCurves` is true: the source must be
  an fcurve (interface `31ca7790-...`). A curve without keys is static. Otherwise every
  key must have the same value as the first key (difference at most 1e-12) and both
  tangent slopes of every key must be at most 1e-6 in magnitude. For layer curves the
  first key's value must additionally be zero (magnitude at most 1e-12), i.e. a layer
  curve that adds nothing. A non-fcurve source is never static.
- Steps:
  1. Per parameter the value at `Time` is read and saved. A parameter whose value
     getter answers `0x80004001` is skipped.
  2. The collector `0x180038d20` runs per parameter:
     a. `motionhelp.dll!F3DGetCompleteAnimationState(owner, parameter, Time, &flags, 1,
        &source)` gives the driving source and state flags (bits 16, 17 and 18 are used
        below; their names are inside the helper). The ambient value
        `RefmodelIsApplyingDelta` is read.
     b. Choice of the object to remove: the reported source is used directly when one
        exists, flag bit 17 is clear, and either a reference-model delta is being
        applied or flag bit 18 is clear. Otherwise the parameter's directly connected
        source is used when it has one; failing that, when flag bit 17 is set and the
        mask allows constraints, the constraint found by
        `F3DIsComponentConstrained` is used. When the mask allows constraints and a
        constraint exists next to another source, the constraint is remembered as a
        second object to delete.
     c. No object chosen: only the layer pass (step 6) is tried for this parameter.
     d. Object chosen: a parameter locked at level 2 outside a locked reference model
        raises the lock error and is skipped. An owner exposing interface
        `12a3ef95-e543-11d2-b352-00105a1e6ce9` (an action source: the parameter lives
        inside a stored action) is skipped. The layer pass (step 6) runs.
     e. Type filter: mask bit 4 accepts anything; otherwise bit 1 accepts an fcurve
        source and bit 2 an expression source.
     f. The source is queued for removal only when `BaseAnimation` is true, the type
        filter accepted it, and, when `StaticFCurves` is true, the source passes the
        static test **and** the parameter has no animation-layer entries
        (`C3DComponentLayerEnum` count 0). With `StaticFCurves` false every accepted
        source is queued.
     g. Queuing: one `DeleteObj` task (`dd531990-ccc2-11d2-ac73-00a02485cecb`) and one
        object list are created lazily and shared by all parameters; the source (and the
        remembered constraint, if any) is appended to that list.
     h. Reference models: when `F3DRequiresDeltaCreation` answers 0, delta tasks
        (`d8b3c0e0-...`) are run and attached on first execution: type 4 when flag bit
        16 is set, type 8 when bit 18 is set, otherwise type 2 only if the source was
        queued (the source's interface `7fac8dc7-85ab-45b0-9924-02b39e7c0382` is also
        told 0 through its first method); then always one of type 1.
  3. If nothing was queued and no layer work exists, the command returns status 1.
  4. Otherwise locks are suspended (`CSILockSuspender`, level 3), the `DeleteObj` task
     is executed on the queued sources, locks are resumed, and on first execution the
     task is attached for undo.
  5. Second pass: for each parameter with a numeric saved value for which the helper
     `0x180005e10` returns 1 (no remaining mixer entry on the parameter or its parents)
     the saved value is written back at `Time`, so the parameter keeps the value it
     showed.
  6. Layer pass (`0x18003a970`; runs only when `LayerAnimation` is true and the mask
     contains 1 or 4; also replayed by Redo): the real parameter is resolved from
     compounds; the mixer drivers of the parameter at `Time` are enumerated; for each
     driver whose clip is an animation-layer clip (class
     `bb3ca994-1e49-4aaf-8aa1-fc0fa797ace6`, `Mixer Layer Clip`):
     - with `StaticFCurves` true the layer's curve for this parameter must pass the
       static test in its layer form (constant **and** zero); a non-static layer curve
       is left in place;
     - a locked keying layer (`F3DIsKeyingLayerLocked`) logs warning `XSIFCURVE` `0x37`
       (severity 4) with the layer's path; the removal request is still issued;
     - the parameter's item name in that layer is handed to the Layer Clip Helper
       (class `42eb14da-...`, 2.7 below, "remove item by name"), which is created once
       per command.
     A parameter for which at least one layer item was requested is appended (as an
     element reference) to the command's layer work list.
- Undo: the Layer Clip Helper is undone, then the sub-tasks. Redo: sub-tasks, then the
  layer pass again.
- Errors: failures of the helpers and of task creation are returned unchanged.
- Not confirmed (does not block the contract): the names of state-flag bits 16 to 18 of
  `F3DGetCompleteAnimationState`, and the hierarchy query at vtable offset `0xa0` that
  must answer non-zero before step 2e (identified only by its slot).

---

## Addendum: `mohelper.dll!F3DGetKeyableParams` (read 2026-11-17, closes open question 1)

`mohelper.dll` (sha256 `26ac0f05…`), export ordinal 290 at `0x1800e3b50`, signature
`(input list, bool a2, bool a3, bool a4, bool markedOnly, out list*)`. `fcurve.dll` calls it
with `a2 = false, a3 = false, a4 = true`. Behaviour, in order:

1. A null input list or null out pointer gives `0x80004003`. When the caller passed no
   output list one is created (`0x8000ffff` if that fails).
2. When `markedOnly` is true the application-wide marking string is read
   (`DSGetMarkedParameters`). A new empty list is built; if a marking string exists it is
   filled with the marked components resolved on the input objects
   (`F3DGetMarkedComponents(input, marking, mask, list, true)`, mask `0x807`, or `0x1807`
   when `a3`). That list then **replaces** the input list. With nothing marked the working
   list is therefore empty: there is **no fallback** to all keyable parameters.
3. If the working list is not empty, each item is resolved to (owner hierarchy, component)
   and `F3DGetAllAnimationComponents(owner, component, mask, a2, true, false, null, out)`
   appends to the output; mask is `0x1000`, plus `0x2000` when `a3`, plus `0x4000` when
   `a4` (so `0x5000` for every `fcurve.dll` caller). That the `0x1000` bit selects the
   keyable capability is *(inferred)* from the function name. A marked compound (for
   example a marked `kine.local.pos`) is expanded to its keyable leaf parameters
   *(inferred from the "all animation components" walk)*.
4. Return value is decided only by the output list: `0` when it holds at least one
   parameter, `1` when it is empty. Failures of the marking helpers are not propagated;
   they end up as an empty result.

Consequences: `...OnKeyable` works on the keyable parameters under the input objects;
`...OnMarkedKeyable` on the keyable parameters under the *marked* components of the input
objects. Nothing marked gives an empty list, so `SaveKeyOnMarkedKeyable` returns status 1
with `XSIFCURVE` message `0x26` and sets no key, and `RemoveKeyOnMarkedKeyable` returns
status 1 silently. The script entry of the same name (handler `5c0cf8b6-…`, the generic
script-command handler; procedure `SaveKeyOnKeyableProc` in `uixsiscripts.vbs`) carries
the hidden registry argument `MarkedOnly` with default `True` (`False` for
`SaveKeyOnKeyable`), which closes Q1 of [cmd-b6a](./cmd-b6a-uixsi-keys-sources-materials.md).

## Open questions

1. **Closed, see addendum.** `mohelper.dll!?F3DGetKeyableParams@@YAJPEAUI3DList@@_N111PEAPEAU1@@Z`: meaning of
   the three leading booleans (called as false, false, true) and the result when the
   fifth (marked only) is true and nothing is marked. Decides the open
   `SaveKeyOnMarkedKeyable` item; it is outside `fcurve.dll`.
2. Wrapper handler `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9` (`tasks.dll` / `scnmgr.dll` /
   `xsievents.dll`): how the `Source` and `MarkedOnly` arguments choose between the
   native entries (`SaveKey*`, `SaveActionKey`, and presumably expression / other source
   handlers listed in `handler_dlls`), and which of the two same-named registry entries
   a script call resolves to.
3. **Closed 2026-11-17 (batch 9).** `0x180038d20` / `0x18003a970` read: `BaseAnimation`
   gates the deletion of the base source, `StaticFCurves` restricts it to constant
   curves on parameters without layers (and layer curves to constant zero),
   `SourceMask` bits are 1 fcurve, 2 expression, 4 any, 0x10 constraint; layers are
   edited through the Layer Clip Helper (2.7).
4. **Closed 2026-11-17 (batch 9).** `0x180001240` read: the three classes are
   `RemoveKey` (`5ad1fd81-...`), `SaveKey` (`5ad1fd80-...`) and `SetValue`
   (`c089b901-...`); they are used only for boolean fcurves (kind 10), see the contract.
5. **Closed 2026-11-17 (batch 9).** `0x180014ac0` does not initialise the result field;
   without an fcurve Do answers status 1 and `Value` is undefined.
6. **Closed 2026-11-17 (batch 9).** Navigation Undo restores the start time, Redo
   re-applies the found time (`0x18001c7e0`). `0x18001c6c0` allocates a 0xa0-byte undo
   record holding the parameter soft reference, key time, new value, old value, the
   "key existed" flag, an optional quaternion key and the saved fcurve state.
7. `0x18001b800` / `0x180046c60` (iterator slot 32, argument-handler configuration
   callback keyed on the argument handler CLSIDs `fa0b5d32-...` and `7834cb8c-...`):
   meaning of the returned variants (it is what parameterises the default of
   `InputObjs`, e.g. marked parameters versus selection).
8. SaveKey pre-pass: attribute `e34e4618-6367-4505-9a08-b5b864b45599` (rejection with
   message `0x28`) and the precheck attribute `a7e8a2d0-769f-11d3-9e90-00a0248f947c` are
   identified only by GUID. Texts of `XSIFCURVE` messages `0x25` to `0x37` not read.
9. `0x180009dc0`, `0x1800096b0`, `0x18000a2b0` (SaveKey Euler-triple / layer offset
   helpers) were read only through their call sites.
10. `0x180031810` (Layer Clip Helper, called around the layer rebuild with the model and
    the clip) and helper slots 10 / 11 (`0x180031470`, `0x180030dc0`) were not read.
11. `F3DGetCompleteAnimationState` (`motionhelp.dll`): names of state-flag bits 16, 17
    and 18 used by the RemoveAnimation collector.
