# CMD-B8b: Animation layers, marking, expressions, relative values, source connection read from `fcurve.dll`

Row: **CMD-B8b**. Status: **SPEC** (21 names), **SPEC-PARTIAL** (0 names); per command below.
Batch 9 (2026-11-17): `DuplicateAnimationLayer` closed after re-reading `0x18002ac60` and reading the Layer Clip Helper (`0x180030b70`, `0x180032f70`).
Run: 2026-11-17, `si-analyst`, unattended, batch 8 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLLs).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\fcurve.dll` (sha256 `70778c1a…`, image base `0x180000000`), read with REA + Ghidra 12.1.4
(B) and the local static helper (L). Registry facts (R) from `data/command_registry.json`. Nothing was executed.
No decompiler output or disassembly is reproduced.

## 1. Handler table

| Command(s) | Handler CLSID | Creation function | Task vtable | Do / worker | UnPackArg | RePackArg |
|---|---|---|---|---|---|---|
| `GetCurrentAnimationLayer` | `{5d501435-825b-4c5e-9d37-bf599c3fa721}` | `0x18004a000` | `0x1800658e0` | Do `0x18002c8a0` (calls `corehelper.dll!F3DGetCurrentKeyingLayer`) | `0x18002d2d0` | `0x18002cdb0` |
| `GetNumberOfAnimationLayers` | `{3cd9b582-f774-4ff3-a3b9-4b7349e37598}` | `0x18004a080` | `0x1800659a0` | Do `0x18002c8d0` (calls `corehelper.dll!F3DGetNbKeyingLayers`) | `0x18002d2d0` | `0x18002cdb0` |
| `SetCurrentAnimationLayer` | `{adf44f2c-3eb5-4644-961e-124d9b9ac7cb}` | `0x18004a740` | `0x180065a60` (helper `0x180065b20`) | Do `0x18002c950` / worker `0x18002c080` | `0x18002d490` | base |
| `AddAnimationLayer` | `{18b7bbf8-9f0d-4690-b04f-23876a305985}` | `0x180049dc0` | `0x180065b70` (helper `0x180065c30`) | Do `0x18002c820` / worker `0x18002a5d0` | `0x18002d200` | base |
| `DeleteAnimationLayer` | `{f84a352a-2f6f-422c-b815-f35fa55eec1c}` | `0x18004a5c0` | `0x180065c80` | Do `0x18002c940` / worker `0x18002baf0` | `0x18002d3d0` | base |
| `DuplicateAnimationLayer` | `{f37a1f2a-e2ed-47eb-afeb-d4cdc4e8ef77}` | `0x180049e00` | `0x180065d40` | Do `0x18002c890` / worker `0x18002ac60` | `0x18002d3d0` | base |
| `LockAnimationLayer`, `UnlockAnimationLayer` | `{f9ce2086-dfb8-4f6f-a722-4c29a4204242}` | `0x18004a3c0` | `0x180065e00` (helper `0x180065ec0`) | Do `0x18002c910` / worker `0x18002b7d0`, per-clip `0x18002c3b0` | `0x18002d360` | base |
| `IsAnimationLayerLocked` | `{c6dfe971-4f51-47f5-bc0f-6f4d5a7db562}` | `0x18004a200` | `0x180065f20` | Do `0x18002c900` / worker `0x18002b4a0` | `0x18002d300` | `0x18002ce30` |
| `SetMarking`, `ClearMarking` | `{2062ade9-0a3b-11d3-80d7-00a0c9ac19a9}` | `0x18004a7c0` | `0x18006e4b0` (base `0x18005b210`) | Do `0x18000db50` / worker (slot 14) `0x180046730` | `0x18000ecc0` | base |
| `AddToMarking` | `{2062adf6-0a3b-11d3-80d7-00a0c9ac19a9}` | `0x180049cc0` | `0x18005a110` | Do `0x18000db50` / worker (slot 14) `0x18000daf0` | `0x18000ecc0` | base |
| `RemoveFromMarking` | `{2062ae02-0a3b-11d3-80d7-00a0c9ac19a9}` | `0x18004a580` | `0x18006aeb0` | Do `0x18000db50` / worker (slot 14) `0x18003c660` | `0x18000ecc0` | base |
| `GetMarking` | `{2062ae11-0a3b-11d3-80d7-00a0c9ac19a9}` | `0x18004a040` | `0x1800614b0` (helper `0x180061570`) | Do `0x18001df20` / worker `0x18001def0` | base (no inputs) | `0x18001dfe0` |
| `SetExpr` | `{7247ac41-db1d-11d2-a5fb-00a0c9ec5ef7}` | `0x180049b80` | `0x180057a10` (COM part `0x1800579c0`, helper `0x180057a80`) | Do `0x180004360` / worker `0x180003150` | `0x180004910` | `0x1800047a0` |
| `EditExpr` | `{0d24b3b6-1860-11d3-a60f-00a0c9ec5ef7}` | `0x180049e80` | `0x18005dc40` (helper `0x18005dd00`) | Do `0x180015270` / worker `0x180015030` | `0x180015340` | base |
| `SetRelativeValues` | `{94d0dc72-1b48-11d3-a611-00a0c9ec5ef7}` | `0x18004a780` | `0x18006e3a0` (helper `0x18006e460`) | Do `0x180046530` / worker `0x1800458e0` | `0x180046610` | base |
| `GetNumRelativeValues` | `{7c40e3dc-47bc-4ca3-893d-8f38e21e9deb}` | `0x18004a0c0` | `0x1800616d0` (helper `0x180061790`) | Do `0x18001e710` / workers `0x18001e6a0` (interpolator), `0x18001e4a0` (parameter) | `0x18001e8f0` | `0x18001e880` |
| `GetRelativeValue` | `{756b2c1a-835d-4083-ba74-3aeaa3dc7832}` | `0x18004a100` | `0x180061f70` (helper `0x180062030`) | Do `0x18001f0f0` / workers `0x18001eea0` (interpolator), `0x18001ec60` (parameter) | `0x18001f380` | `0x18001f270` |
| `RemoveRelativeValue` | `{b4015192-e0ff-4a28-bf8d-b5ee560deeed}` | `0x18004a640` | `0x18006bf80` (helper `0x18006c040`) | Do `0x18003f0e0` / workers `0x18003f050` (interpolator), `0x18003ee10` (parameter) | `0x18001f380` | none |
| `ConnectSource` | `{ec7663e9-2f0b-11d3-bffd-00a0248f9397}` | `0x180049d00` | `0x18005bbd0` (COM part `0x18005bb80`, helper `0x18005bc40`) | Do `0x18000f9d0` / worker `0x18000f6d0`, per-target `0x18000f1b0` | `0x18000fd70` | base |

"base" = the unoverridden `C3DCoreBaseTask` import. For `SetExpr` and `ConnectSource` the locator's first vtable
(`0x1800579c0`, `0x18005bb80`) is the `CDSCOMObject` part; the task vtable is the second one in the list.

## 2. Shared facts

- **Do stubs.** Every Do here is a tiny stub (L) that loads the unpacked members and calls slot 9 of a private
  helper interface embedded in the task (or jumps straight to the worker). There is no command-GUID comparison in
  any class of this group; where one class serves two commands (`Lock`/`Unlock`, `Set`/`ClearMarking`) the
  difference comes only from the registry argument defaults.
- **Animation layer = keying layer.** Layers are stored per *model* as tracks of the model's animation mixer.
  Imported helpers (all `corehelper.dll`): `F3DGetNbKeyingLayers`, `F3DGetCurrentKeyingLayer`,
  `F3DGetKeyingLayerTrack`, `F3DGetKeyingLayerClip`, `F3DIsKeyingLayerLocked`, `F3DEnableMixerOnDelta`.
  Layer index 0 is the base layer; it can neither be locked, deleted, duplicated nor queried for lock state.
- **Model list normalisation** (`0x18002a380`, used by Add / Delete / Duplicate / Lock / IsLocked): an empty
  `InputObjs` list is replaced by the scene root (current scene, `SIGetCurrentScene`). Otherwise each item is
  resolved to its owner object; if the owner is not itself a model (`{3ded5562-0bb6-11d3-ac82-00a02485cecb}`)
  `SIGetModelFromObject` finds its model; each model is added to the working list once (duplicates dropped).
  Items whose model cannot be found are silently skipped.
- **Mixer access.** The mixer of a model is asked for with `{f6d95bc2-c9b1-11d2-b34a-00105a1e6ce9}`. Its children
  of kind `0x13` are tracks (interface `{2320122b-d1b9-11d2-b34b-00105a1e6ce9}`, method slot 18 gives the layer
  index of the track); a layer track has class id `{d9fa2370-650f-43a8-88e9-634e731639ea}` (the same GUID is passed
  as the *Type* to `AddTrack`). The mixer child of kind `0x1b` holds, in its child index 1, the parameter with id
  `(0x402, 10)` = current layer index.
- **Sub-tasks.** The layer workers and `SetExpr` / `SetRelativeValues` / `ConnectSource` do their edits through
  other native tasks created by CLSID and, on first execution, appended to the task with
  `C3DCoreBaseTask::AddTask`:
  `{67b8773c-e316-11d2-b350-00105a1e6ce9}` = `AddTrack`; `{75bea1d4-81aa-41ea-9412-f93677996c20}` = `AddLayerClip`;
  `{adf44f2c-…}` = `SetCurrentAnimationLayer` (re-entered); `{c089b901-8481-11d2-b118-00a024c79287}` = `SetValue`;
  `{dd531990-ccc2-11d2-ac73-00a02485cecb}` = `DeleteObj`; `{b3c0b1a1-0a4c-11d4-b980-009027bc3e07}` = `Lock`/`Unlock`;
  `{5ad1fd80-5d5d-11d2-8082-00a0c955b335}` = `SaveKey`; `{5ad1fd7e-5d5d-11d2-8082-00a0c955b335}` = `RemoveAnimation`;
  `{8fb755e3-06e3-11d7-be20-00a0c9615daf}` = `CycleChecking`;
  `{d8b3c0e0-49cf-4f6c-b008-3c24ee218e1b}` (not in the registry; called with owner, component, source object and a
  type number 2 or 4 only when a referenced model is involved: *(inferred)* the "store connection in the model
  delta" task); `{42eb14da-bcab-4e24-bee6-b8a0bb496c3a}` (the Layer Clip Helper: not in the
  registry but served by `fcurve.dll` itself, see Duplicate) and `{ecebf698-1af5-4c04-aa46-46119a508f10}` (not in
  the registry, see SetRelativeValues).
- **Undo / redo of the layer editing tasks.** Undo (`0x18002cba0` / `0x18002cb80`) undoes the recorded sub-tasks
  and then clears them. Redo (`0x18002c980`, `0x18002ca00`, `0x18002ca60`, `0x18002cac0`, `0x18002cb20`) re-resolves
  the stored input reference (a reference object obtained on first execution from the generic object
  `{24be99c0-5eb6-11d2-8bb0-00aa00135f7b}`) and runs the worker again as a first execution (so the sub-tasks are
  rebuilt). The three query tasks (`Get…`, `Is…Locked`) have the "nothing to undo" stub in slots 6 and 7.
- **Messages.** Catalogue `XSIFCURVE` via `DictLoadIdstring`, logged with `SILogMessage(severity, …)`; severity 2 =
  error, 4 = warning. Ids seen: `0x27` invalid layer index, `0x32`/`0x33` layer already locked / already unlocked,
  `0x34`/`0x35` layer cannot be locked / unlocked, `0x36` more than one model given (lock query), `0x2a`/`0x2b`
  title/text of the cycle message box, `0x2c`…`0x2f` SetExpr per-parameter refusals. Texts were not resolved (Q1);
  the meanings above are from the conditions that raise them.
  `CSIErrorHandling::Raise(0x80070057, 2, id, …)` ids: `0x8e` parameter has no expression, `0x8f` expression is not
  a multi-link, `0x90` relative-value index out of range, `0x9f` bad `PathList`, `0x3eb` empty input;
  `Log(4, 0x3d, name)` = more than one input, only the first is used.
- **Marking store.** The marked-parameter list is one application-wide string owned by `dssdk10.dll`:
  `DSGetMarkedParameters`, `DSSetMarkedParameters`, `DSAddMarkedParameters`, `DSRemoveMarkedParameters`,
  `DSResetMarkedParameters`. Scripting-side path lists are converted with `sicommands`/core helpers
  `F3DGetMarkingString` (VARIANT to string), `F3DConvertPathListToMarkedParameters` and
  `F3DConvertMarkedParametersToPathList`. The scripting form is a comma-separated list of parameter paths (the
  output side splits on `","`); the internal "marked parameters" form was not inspected (Q2).
- **Expression object.** A parameter's expression source is asked from the owner with interface
  `{481262ff-7ddb-11d0-a57f-00a0c91412de}` (class `{12723eb2-7ddb-11d0-a57f-00a0c91412de}`). Used methods: slot 3
  set definition string, slot 4 get definition string, slot 11 kind, slot 12/13 driver count / driver path,
  slot 14 single driver path, slot 15 interpolator object, slot 17 link-fcurve parameter id. Kind `3` = link with
  one driver (a link fcurve), kind `4` = link with several drivers (interpolator holding sets of relative values).
  The interpolator interface is `{5dcd499b-4083-4930-a807-7032747959aa}` (slot 5 remove set, slot 8 get set,
  slot 10 number of sets).

## 3. Contracts

### `GetCurrentAnimationLayer` / `GetNumberOfAnimationLayers`: SPEC

**Wire contract**
- Purpose: return the index of the current animation (keying) layer / the number of layers.
- Arguments (R, names confirmed in UnPackArg): `InputObjs` (in, object list, optional); `Value` (out, return
  value, VT_I4 written by RePackArg with the context's "set value by name").
- Steps: UnPackArg fetches the `InputObjs` list as given (no normalisation in this DLL, an empty list is passed
  as is). Do calls `F3DGetCurrentKeyingLayer(list)` / `F3DGetNbKeyingLayers(list)` and stores the returned number;
  Do itself always returns 0. RePackArg writes the number to `Value`.
- Which model is used when the list is empty or has several items is decided inside the helper *(inferred from
  the sibling workers: the scene root when empty)*.
- Nothing is changed; no undo.

### `SetCurrentAnimationLayer`: SPEC

**Wire contract**
- Arguments: `InputObjs` (in, list), `Layer` (in, I4, default 0), `CreateLayer` (in, bool, default false).
- Errors: null list `0x80004003`; `Layer < 0` returns `0x80070057` before anything else.
- Models: if `InputObjs` is empty the scene root is used; otherwise every list item is used directly as the
  model whose layers are edited (no de-duplication here, unlike the other layer tasks).
- Per model: read the layer count. If `CreateLayer` is true and `Layer >= count`, missing layers are created one
  at a time with the `AddLayerClip` task (model, no track, no name) until the count exceeds `Layer` (`0x18002a170`).
  If `Layer` is still `>= count` the model is flagged "invalid index". Otherwise, when the model's current layer
  already equals `Layer` the model counts as done; else the current-layer parameter `(0x402, 10)` in the mixer is
  set to `Layer` through a `SetValue` sub-task (`0x18002ce70`).
- After the loop: if any model was flagged, message `XSIFCURVE` `0x27` is logged, as a warning (4) when at least
  one model succeeded, as an error (2) otherwise.
- Return: 0 when at least one model ended on the requested layer, 1 otherwise.
- Undo / redo: shared scheme (sub-tasks).

### `AddAnimationLayer`: SPEC

**Wire contract**
- Arguments: `InputObjs` (in, list), `Name` (in, string, default `""`), `MakeCurrent` (in, bool, default true).
  No return value.
- Models: normalised list (section 2).
- Per model, in order:
  1. Read layer count `n` and current layer `c`. The new layer goes to index `p = min(c + 1, n)`, i.e. directly
     above the current layer.
  2. Find the insert position among the mixer tracks: walk the tracks (kind `0x13`) counting from 1 and stop at
     the first track whose layer index is below `p`.
  3. `AddTrack` sub-task on the model: type `{d9fa2370-650f-43a8-88e9-634e731639ea}`, track name
     `"<Name>Track"` when a name string was passed, else `"LayerTrack1"`, insert position from step 2.
     Failure to create the task gives `0x8007000e`, no resulting track gives `0x80004005`; both stop the loop.
  4. `AddLayerClip` sub-task on the model and the new track with the layer name `Name`.
  5. If `MakeCurrent`: when the model reports 1 from its method slot 21 (interface
     `{3ded5562-0bb6-11d3-ac82-00a02485cecb}`) `F3DEnableMixerOnDelta(model)` is called *(inferred: referenced
     model)*; then a `SetCurrentAnimationLayer` sub-task is run on that model with layer `p`, `CreateLayer` false.
- Return 0 on success. Undo / redo: shared scheme.

### `DeleteAnimationLayer`: SPEC

**Wire contract**
- Arguments: `InputObjs` (in, list), `Layer` (in, I4, default -1 = the model's current layer). No return value.
- Models: normalised list. Per model: resolve `Layer` (negative means current). If the index is `< 1` or
  `>= count` the model is flagged invalid (the base layer cannot be deleted). Otherwise the layer track with that
  layer index is searched among the mixer tracks of class `{d9fa2370-…}`; when found:
  1. if the layer is the topmost one (`index == count - 1`), the current layer is first moved to `index - 1`
     with a `SetCurrentAnimationLayer` sub-task (done regardless of which layer was current);
  2. the track is deleted with the `DeleteObj` task (`{dd531990-…}`).
- If any model was flagged: message `0x27`, warning when at least one layer was deleted, error otherwise.
- Return (read from the instruction listing, batch 9): 0 when at least one layer was deleted, 1 otherwise.
  Undo / redo: shared scheme.

### `DuplicateAnimationLayer`: SPEC

**Wire contract** (worker re-read and the Layer Clip Helper read 2026-11-17, batch 9)
- Purpose: make a copy of one animation layer directly above it, mute the original and make the copy current.
- Arguments: `InputObjs` (in, list), `Layer` (in, I4, default -1 = current). No return value.
- Models: normalised list (section 2). On first execution a reference to the input list is stored for redo.
- Per model, in order:
  1. Resolve `Layer` (negative means the model's current layer). An index `< 1` or `>= count` flags the model
     invalid and nothing is done for it (the base layer cannot be duplicated).
  2. Find the layer track: among the mixer tracks (kind `0x13`) the one of class `{d9fa2370-…}` whose layer index
     equals `Layer`. Take the first clip of that track (container `{2320123e-d1b9-11d2-b34b-00105a1e6ce9}`,
     clip interface `{2320122c-d1b9-11d2-b34b-00105a1e6ce9}`). No such track or no clip: the model is skipped.
  3. Run the **Layer Clip Helper** (class `{42eb14da-bcab-4e24-bee6-b8a0bb496c3a}`, served by `fcurve.dll`
     itself; creation `0x18004a380`, see below): register the clip (slot 9, `0x180030b70`), then commit with the
     duplicate flag 1 (slot 13, `0x180032f70`). Effect, in order:
     - every active item of the layer's action source (one fcurve per layered parameter) is duplicated with the
       low-level duplicate task `{747d257f-d01b-11d2-80c4-00a0c9ac19a9}`;
     - a new action source (class `{12a3efc5-e543-11d2-b352-00105a1e6ce9}`) is created, named
       `<source name>_copy`, filled with the duplicated items under the **same item names**, and added to the
       mixer's sources;
     - a new layer track is created with the `AddTrack` task (type `{d9fa2370-…}`) at the mixer position of the
       original track, named `<track name>_copy`; it therefore becomes layer `Layer + 1` and the layers above
       move up by one;
     - a new layer clip (class `{bb3ca994-1e49-4aaf-8aa1-fc0fa797ace6}`, `Mixer Layer Clip`) instancing the new
       source is added to the new track and named `<clip name>_copy`;
     - the suffix `_copy` is appended only when the name does not already contain `_copy`;
     - the original clip, track and source are left untouched; the lock state is **not** copied (the copy is
       unlocked).
     The helper is attached as a sub-task on first execution.
  4. Set parameter `(0x402, 8)` of the **original** track to boolean true with a `SetValue` sub-task. In the
     parameter list of the layer track (`C3DAnimLayerTrack.spdl`: type entry, `Name`, `Hidden`, `Active`,
     `ContainerStart`, `ContainerDuration`, `Markers`, `UIProps`, `mute`, …) position 8 is `mute`, so the
     original layer is muted and the copy takes over its contribution *(the id-to-name mapping is inferred from
     the spdl order; it was not confirmed in the binary)*.
  5. Run `SetCurrentAnimationLayer` on the model with layer `Layer + 1`, `CreateLayer` false: the copy becomes the
     current layer.
  A failure in step 3, 4 or 5 ends the whole command with that status; success continues with the next model.
- If any model was flagged invalid: message `XSIFCURVE` `0x27`, as a warning (4) when at least one duplication
  succeeded, as an error (2) otherwise.
- Return (read from the instruction listing): 0 when at least one layer was duplicated, 1 when none was;
  `0x8007000e` when a sub-task object could not be created; a failing sub-task's own status otherwise
  (`0x8000ffff` is also loaded on one failure path whose condition was not traced).
- Undo / redo: shared scheme (sub-tasks undone and cleared; redo re-runs the worker).
- Layer Clip Helper facts used here (read): registering refuses objects that are not a `Mixer Layer Clip`
  (`0x80070057`) and refuses after a commit (`0x80004005`). Its internal call `0x180031810` (made with the model
  and the old / new clip) was not read; full description in
  [cmd-b8a](./cmd-b8a-fcurve-keys-binary.md) section 2.7.

### `LockAnimationLayer` / `UnlockAnimationLayer`: SPEC

**Wire contract**
- One class; the two commands differ only by the registry default of `DoLock` (true / false).
- Arguments: `InputObjs` (in, list), `Layer` (in, I4, default -1 = current), `DoLock` (in, bool).
- `Layer == 0`: message `0x27` is logged as an error and the command returns 1 (base layer cannot be locked).
- Models: normalised list. Per model: resolve `Layer` (negative means current); if `0 < Layer < count` the layer's
  clip is fetched with `F3DGetKeyingLayerClip` and handled by the per-clip step; otherwise the model is flagged
  invalid. A model without the hierarchy interface aborts with `0x80004003`.
- Per-clip step (`0x18002c3b0`): read the present state with `F3DIsKeyingLayerLocked`.
  - Already in the requested state: warning `0x32` (lock) / `0x33` (unlock) with the clip's path; result 1.
  - Otherwise take the clip's time control (`F3DGetTimeControlFromClip`) and the clip's child index 2; if either
    answers no to `CSILockStatus::CanBeLocked`, error `0x34` (lock) / `0x35` (unlock) with the clip path, result
    `0x80004005`.
  - Else build a two-item list (time control, child 2) and run the `Lock`/`Unlock` task `{b3c0b1a1-…}` on it with
    level `0xffff`, sub-type 2, and "unlock" = not `DoLock`; recorded as a sub-task.
- After the loop: if any model was flagged invalid, message `0x27` (warning when some layer was changed, error
  otherwise). Return 0 when at least one layer changed state, else 1. Undo / redo: shared scheme.

### `IsAnimationLayerLocked`: SPEC

**Wire contract**
- Arguments: `InputObjs` (in, list), `Layer` (in, I4, default -1 = current), `Value` (out, bool, default false;
  written by RePackArg with `SICmdSetBooleanArgFromName`).
- `Layer == 0`: error message `0x27`, `Value` stays false.
- Models: normalised list, but **only the first model is examined**. If the list holds more than one model a
  warning `0x36` naming the first model is logged.
- Resolve `Layer` (negative means current). If `0 < Layer < count`, the layer track is fetched with
  `F3DGetKeyingLayerTrack` and `F3DIsKeyingLayerLocked` writes the result; otherwise error message `0x27` and
  `Value` stays false.
- No scene change, no undo.

### `SetMarking` / `ClearMarking` / `AddToMarking` / `RemoveFromMarking`: SPEC

**Wire contract**
- Purpose: replace / clear / extend / reduce the application-wide marked-parameter list.
- How the four differ: three classes share a base (`0x18005b210`: Do, Undo, Redo, UnPackArg) and override only
  the worker in vtable slot 14. `SetMarking` and `ClearMarking` are the **same class and same code**; `ClearMarking`
  is `SetMarking` with the registry default `PathList = ""`. No command-GUID test, no mode number.
- Argument: `PathList` (in). VARIANT for Set/Add/Remove (a string or object reference(s), turned into one string
  by `F3DGetMarkingString`), string defaulting to `""` for `ClearMarking`. No return value.
- UnPackArg: read `PathList`; convert to a string; if the conversion yields no string at all, nothing is stored;
  otherwise convert the scripting path list to the internal marked-parameter string with
  `F3DConvertPathListToMarkedParameters` and keep it. A conversion result of `0x80070057` raises error message
  `0x9f` naming `PathList`.
- Do: if no marking string was stored, return 1 (nothing to do). Otherwise call the worker (string, first flag):
  - first execution only: remember the current marking (`DSGetMarkedParameters`) for undo;
  - Set/Clear worker: an empty string calls `DSResetMarkedParameters` (marking cleared), a non-empty one
    `DSSetMarkedParameters` (marking replaced);
  - Add worker: `DSAddMarkedParameters(string)` (union with the existing marking);
  - Remove worker: `DSRemoveMarkedParameters(string)`.
  A null string gives `0x80004003`; helper failures are returned; success is 0.
- The list is a plain parameter-path list independent of the selection in this code; how relative paths such as
  `kine.local.pos` combine with the selected objects is inside the two conversion helpers and `dssdk10` (Q2).
- Undo: `DSSetMarkedParameters(previous marking)`. Redo: the worker again with first flag 0.

### `GetMarking`: SPEC

**Wire contract**
- Argument: `PathList` (out, return value). No inputs (base UnPackArg).
- Do: `DSGetMarkedParameters` into the task; Do returns 1.
- RePackArg: if a marking string exists it is converted with `F3DConvertMarkedParametersToPathList`, split at
  commas, and returned as a one-dimensional zero-based SAFEARRAY of VARIANT, each element a BSTR parameter path
  (`VT_ARRAY | VT_VARIANT`, `0x200c`). With no marking string nothing is written (the argument keeps its empty
  value). Allocation failure gives `0x8007000e`.
- No scene change, no undo.

### `SetExpr`: SPEC

**Wire contract**
- Arguments: `InputObj` (in, parameter list, fetched with `F3DCmdGetInputObjects`; the argument handler falls
  back to marking/selection), `ExprStr` (in, string, default `""`), `ExprObj` (out, collection of the expression
  objects; written by RePackArg under the name `ExprObj`).
- Per parameter of the list, in order (each refusal logs a **warning** with the parameter's full path and skips
  that parameter only):
  1. Lock test (`CSILockStatus`): locked at level 2 outside a locked referenced model, or locked inside a
     referenced model: message `0x2e`.
  2. Capability test: the parameter must have capability bit 0 (animatable): otherwise message `0x2f`.
  3. Value type must be numeric: VARIANT types 2, 3, 4, 5, 11, 16, 17, 18, 19, 22, 23 (I2, I4, R4, R8, BOOL, I1,
     UI1, UI2, UI4, INT, UINT). Other types are skipped silently.
  4. If the owner reports a source of interface `{c1afbd50-debf-11cf-8290-00a0243f1013}` on the parameter
     *(inferred: an fcurve)*: message `0x2c`.
  5. If the current source object has class id `{386b0f00-65ce-11d1-84c6-00a0243e3543}`: message `0x2d`
     *(class not identified, Q5)*.
  6. Cycle test: unless the preference read from generic object `{b54dca74-e452-11d1-8873-00a024ee6238}`
     (method slot 39, argument 8) is non-zero or a cycle was already reported, the `CycleChecking` task is run on
     the parameter before and after the change; a cycle that appears only after the change sets a flag.
  7. Expression text: if the parameter has no expression source, a new expression object
     (`{12723eb2-7ddb-11d0-a57f-00a0c91412de}`) is created; when `ExprStr` is empty the text becomes the
     parameter's value at the current time, formatted `"%f"` for R4/R8 and `"%d"` (truncated) for the other types.
     If the parameter already has an expression, that object is reused and its old definition is remembered; an
     empty `ExprStr` then leaves the definition untouched.
     The definition handed to the expression is the string `"<full parameter path> = <expression text>"`.
     A definition rejected with `0x80070057` is tolerated (the command goes on); other failures abort.
  8. The expression object is appended to the `ExprObj` output collection.
  9. Connection bookkeeping: unless the parameter is outside a locked referenced model **and**
     `F3DRequiresDeltaCreation` is non-zero, task `{d8b3c0e0-…}` is run with (owner, parameter, expression, type 4)
     and recorded as a sub-task.
- After the loop, if a new cycle was detected, an information message box is shown (`SIMessageBoxInformation`,
  title `XSIFCURVE` `0x2a`, text `0x2b`).
- Undo (`0x180004430`): for every processed parameter, either the previous definition string is put back (and the
  new one kept for redo), or, where there was no expression before, the source is removed and the saved value is
  written back at the current time; then the sub-tasks are undone. Returns `0x8000ffff` if the task never ran or
  the saved-state count does not match the list.
- Redo (`0x1800043d0`): clears the saved state, runs the worker again without an output collection, then redoes
  the sub-tasks.

### `EditExpr`: SPEC

**Wire contract**
- Argument: `InputObj` (in, list; UnPackArg name `InputObj`). No return value. Registry flags mark it not
  undoable; Undo/Redo stubs return 0 (or `0x8000ffff` if never executed).
- Do: create the expression-editor view (`DSCreateView` with class `{ae04e220-0d40-11d3-a60b-00a0c9ec5ef7}`,
  interface `{ae04e221-0d40-11d3-a60b-00a0c9ec5ef7}`; missing interface gives `0x80004002`), reset it (slot 5),
  then for each list item take its path string and hand it to the view (slot 4). The editor therefore opens on
  all the given parameters. No scene data is changed.

### `SetRelativeValues`: SPEC

**Wire contract**
- Argument: `InputObj` (in, parameter list). No return value. Registry description: "Sets a key on the expression
  fcv".
- Do clears previous sub-tasks, then for each parameter (current time is used for all value reads):
  - parameters without an expression source are skipped;
  - the parameter's own value is read (as double) = driven value;
  - expression kind `3` (one driver): the driver path is read from the expression and resolved, the driver's
    value read; a `SaveKey` sub-task (`{5ad1fd80-…}`) keys the expression's link fcurve (parameter id
    `(0x402, <id from expression slot 17>)`) at x = driver value, y = driven value; the parameter's interaction
    node is invalidated (`F3DInvalidateInteractionNodeOnComponent`);
  - expression kind `4` (several drivers): every driver path is resolved and its value collected in driver order;
    if the expression has an interpolator, task `{ecebf698-1af5-4c04-aa46-46119a508f10}` is run with
    (interpolator, driver values, driven value) *(inferred: appends one set of relative values)*;
  - other kinds: nothing;
  - finally, when the owner sits in a locked referenced model, task `{d8b3c0e0-…}` (owner, parameter, expression,
    type 4) is run.
- Undo = undo sub-tasks; Redo = redo sub-tasks.

### `GetNumRelativeValues`: SPEC

**Wire contract**
- Arguments: `InputObj` (in; first item used), `Value` (out, return value, unsigned long via
  `SICmdSetULongArgFromName`).
- Do: if the input object is itself an interpolator (`{5dcd499b-4083-4930-a807-7032747959aa}`), its set count is
  returned. Otherwise the input is treated as a parameter: no expression source raises `0x80070057` with message
  `0x8e`; an expression whose kind is not `4` raises `0x80070057` with message `0x8f`; else the expression's
  interpolator is fetched and its count returned (a missing interpolator leaves the count at its initial value).
- No scene change, no undo.

### `GetRelativeValue`: SPEC

**Wire contract**
- Arguments: `InputObj` (in), `Index` (in, I4, default 0), `Value` (out, return value).
- UnPackArg (`0x18001f380`, shared with Remove): empty input raises `0x80070057` with message `0x3eb`; the first
  item is used; with more than one item a warning (`Log` severity 4, id `0x3d`, first object's name) is logged.
- Do: interpolator resolution exactly as in `GetNumRelativeValues` (same `0x8e` / `0x8f` errors). Then: an `Index`
  `>=` the set count raises message `0x90` (`0x80070057`) and the command ends with status 1. Otherwise the set is
  returned as a SAFEARRAY of doubles (`SIDoubleArrayToSafeArray`): element 0 is the driven value, elements 1..n
  are the driver values in driver order. Allocation failure `0x8007000e`.
- No scene change, no undo.

### `RemoveRelativeValue`: SPEC

**Wire contract**
- Arguments: `InputObj` (in), `Index` (in, I4, default 0). No return value. Same UnPackArg as above.
- Do: interpolator resolution as above (`0x8e` / `0x8f`); then the interpolator removes the set at `Index`
  (slot 5). If it answers 1 (no such set), message `0x90` is raised with `0x80070057` and the command returns 1.
- Undo and Redo are the "nothing to do" stub: the removal is **not undoable** (registry flags `2`).

### `ConnectSource`: SPEC

**Wire contract**
- Arguments (UnPackArg names): `Target` (in, parameter list), `InputObj` (in, the animation source object,
  interface `{872903d0-3ef3-11d0-8463-00a024c7919c}`). No return value.
- For each target parameter, in order:
  1. `RemoveAnimation` sub-task (`{5ad1fd7e-…}`) on that single parameter at the current time with type 4, so any
     existing source is removed first.
  2. An internal per-target task (`0x18000f1b0`) connects the source:
     - source implementing `{c1afbd50-debf-11cf-8290-00a0243f1013}` *(inferred: fcurve)*: the owner's
       "set source" method (slot 18) attaches it to the parameter; source kind recorded as 1, delta type 2;
     - else source implementing the expression interface `{481262ff-…}`: the expression is told the target's
       full path, any object it reports from slot 19 causes the owner's slot 19 to be called first *(inferred:
       disconnect the previous source)*, then it is attached with slot 18; kind 2, delta type 4;
     - neither interface: nothing is attached (kind stays 4), the step still succeeds.
     - When the target lies in a locked referenced model (or its primary owner model
       `{6b579d20-3dc5-11d0-9449-00aa006d3165}` is one), task `{d8b3c0e0-…}` records (owner, parameter, source,
       delta type).
     - On first execution the target's path is stored for undo/redo.
- Any failing step aborts with its status. Undo = undo sub-tasks, Redo = redo sub-tasks (`0x8000ffff` if the
  task never ran).

## Open questions

1. Texts of `XSIFCURVE` messages `0x27`, `0x2a`-`0x2f`, `0x32`-`0x36` and of the error-map ids `0x3d`, `0x8e`,
   `0x8f`, `0x90`, `0x9f`, `0x3eb` (dictionary on the PC, not read).
2. Marking string formats and the selection-relative behaviour: inside `F3DGetMarkingString`,
   `F3DConvertPathListToMarkedParameters`, `F3DConvertMarkedParametersToPathList` (imports) and the
   `dssdk10.dll` `DS*MarkedParameters` functions; also whether an empty `PathList` reaches the worker as an empty
   string (clear) or as "no string" (no-op) depends on `CSIString::GetDynamicMemSize` in UnPackArg `0x18000ecc0`.
3. **Closed 2026-11-17 (batch 9)** for Delete and Duplicate: both return 0 when at least one layer was
   processed and 1 otherwise (local instruction listing). Still open for `0x18002b4a0` (IsLocked): its
   invalid-index path loads `0x80004005` conditionally and was not traced to the end.
4. **Closed 2026-11-17 (batch 9).** Task `{42eb14da-…}` is the `Layer Clip Helper` of `fcurve.dll` itself
   (creation `0x18004a380`); slot 9 registers the layer clip, slot 13 with flag 1 builds the `_copy` source,
   track and clip. Track parameter `(0x402, 8)` is `mute` by spdl position *(inferred)*.
5. `SetExpr`: class `{386b0f00-65ce-11d1-84c6-00a0243e3543}` (refusal `0x2d`), the preference behind generic
   object `{b54dca74-…}` slot 39 argument 8, and confirmation that interface `{c1afbd50-…}` is the fcurve.
6. `GetCurrentAnimationLayer` / `GetNumberOfAnimationLayers`: how `F3DGetCurrentKeyingLayer` /
   `F3DGetNbKeyingLayers` (`corehelper.dll`) pick the model from a raw, possibly empty, list.
7. `SetRelativeValues`: task `{ecebf698-1af5-4c04-aa46-46119a508f10}` (IID `{66297474-3527-4208-8485-b1727edcf9c5}`)
   is outside this DLL.
8. UnPackArg bodies `0x18002d360`, `0x18002d3d0`, `0x18002d300`, `0x18002d490`, `0x18001e8f0` and RePackArg
   `0x18001f270` were not read line by line; argument names there are taken from the registry.
9. Layer Clip Helper internals not read: `0x180031810` (called with the model and the clip around the layer
   rebuild) and its Undo / Redo slots.
