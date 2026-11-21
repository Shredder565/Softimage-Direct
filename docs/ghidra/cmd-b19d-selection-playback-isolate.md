# CMD-B19d: selection manager commands (`selectionmgr.dll`: SelectAll / SelectAllUsingFilter / SelectMembers / SetAndToggleSelection / Select*Filter / 13 `Activate…SelTool`), playback transport (`mcp.dll`), Center / Isolate / FrameContextual (`vm.dll`), `SwitchToolbar` (`toolbarobj.dll`), `RenderRegionSave` (`rendercore.dll`), `ShowFaceRobotActPanel` (`siuitasks.dll`)

Row: **CMD-B19d**. Status: **SPEC** 37, **SPEC-PARTIAL** 2 (`SetAndToggleSelection`, `ShowFaceRobotActPanel`), **LOCK** 0.
Run: 2026-11-20, si-analyst worker batch 19 (binary first, REA + Ghidra 12.1.4 on the PC, unattended).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

## Binaries (opened one at a time, each closed)

| DLL | image base | sha256 |
|-----|-----------|--------|
| `Application\bin\vm.dll` | `0x180000000` | `4c869d2174ba6a049102509ef165f1514765ce07ef3b91dfa9ee6cadb200ebf2` |
| `Application\bin\mcp.dll` | `0x180000000` | `3e55921be79fb38a1c753b6181c987ac5503398706c6b61a56e3a9790392878f` |
| `Application\bin\selectionmgr.dll` | `0x180000000` | `77d0a1e7bcba8ca784da3b1838121bb36bff17be6d896351f1a5d1deeb3c3bc9` |
| `Application\bin\rendercore.dll` | `0x180000000` | `df47a0fda7b38ceb2533e487469f9ad331068de9797c7d8e2116f41efb7ec167` |
| `Application\bin\siuitasks.dll` | `0x180000000` | `07b753a550e313ac7f705af535889a26d25c5b68c44742de9460d2308f41bc58` |
| `Application\bin\toolbarobj.dll` | `0x180000000` | `c99ba34deb1b8f3136b728e17fea255c25e9a59429e3255d7d4ede3ec408a2b6` |

## Method

- Handler CLSID → `DllGetClassObject` (inline two-qword compares; vm `0x1800107c0`, mcp `0x180005310`,
  selectionmgr `0x180005ef0`, rendercore `0x18009fb90`; siuitasks / toolbarobj located by `search_bytes` on the
  GUID's first 8 bytes + xrefs + reading the branch bytes) → factory vtable slot 6 (create) → task constructor →
  task vtable (slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg). selectionmgr / rendercore tasks keep the
  `C3DCoreBaseTask` vtable at object `+0x18` and a worker sub-object at `+0x38` (slot 9 = real work).
- Decompiled: every create / ctor / UnPackArg / Do of the handlers below, the Undo of Isolate / Set*Filter / mcp
  transport, and the workers they reach (isolate collector `0x1800057f0`, mcp transport `0x18003d7f0`, selectionmgr
  set-filter worker `0x18000eff0` + its two kind paths, the list split helper `0x180010940`, SelectAll collectors,
  SelectMembers expander `0x180015a80`, set-selection helper `0x180015090`, rendercore region writer `0x18007a4b0`).
- GUID tables read with `read_bytes` (selectionmgr `.rdata` `0x18001b300..0x18001b860`, vm `0x18003ed18..`, siuitasks
  `0x1800131e8..`) and decoded locally. Helper classes matched against `data/command_registry.json` and earlier notes.
- Facts reused: CMD-B11h (vm.dll chain, view helper, camera bracket, `FrameContextual`), CMD-B17i (`Frame*` frame
  method +0xc0), CMD-B7a (selectionmgr active-elements list, `Activate…SelTool` first read), CMD-B19b (selection sub-task
  classes `79581ba0` SelectObj / `38eddd00` AddToSelection / `38eddd02` RemoveFromSelection), CMD-B16a / B17i (tool
  manager, activate-tool task `0461b2c6`, selection tool `11778840`), CMD-B19a (render-region viewport resolver
  `0x18007c9a0`).
- Statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

| Command | scripting name | DLL | handler addresses | status |
|---|---|---|---|---|
| Set And Toggle Selection | `SetAndToggleSelection` | selectionmgr | CLSID `1d11f9b0…`, factory vt `0x18001cde8`, create `0x1800053e0` → `0x180005ab0` (0x78), task vt `0x18001cd30`: Do `0x180012110`, Undo `0x180010670`, Redo `0x1800105b0`, UnPack `0x180005e20`; worker `0x180011ea0` | SPEC-PARTIAL |
| Select All Objects | `SelectAll` | selectionmgr | CLSID `8629cad0…`, factory vt `0x18001d418`, create `0x1800051c0`, ctor `0x180013490` (0x78), task vt `0x180023090`: Do `0x180013620`, Undo `0x180012ae0`, Redo `0x180014b80`, UnPack `0x180013f20`, RePack `0x180013730` | SPEC |
| Select All Using Filter | `SelectAllUsingFilter` | selectionmgr | same class as SelectAll | SPEC |
| Select Members/Components | `SelectMembers` | selectionmgr | CLSID `9ab38d10…`, factory vt `0x18001d4f8`, create `0x1800052c0`, ctor `0x180015320` (0x60), task vt `0x1800241f0`: Do `0x180015480`, Undo `0x180012ae0`, Redo `0x180014b80`, UnPack `0x180015f90`, RePack `0x1800159e0`; expander `0x180015a80` | SPEC |
| Set Filter to Object / Point / Polygon / Edge / SampledPoint | `SelectObjectFilter`, `SelectVertexFilter`, `SelectPolygonFilter`, `SelectEdgeFilter`, `SelectSampledPointFilter` | selectionmgr | CLSID `91d68770…`, factory vt `0x18001d568`, create `0x180005430`, ctor `0x18000ed10` (0x80), task vt `0x180020450`: Do `0x18000f2a0`, Undo `0x18000f3c0`, Redo `0x18000f2f0`, UnPack `0x18000f610`; worker slot 9 `0x18000eff0` (component path `0x18000fa40`, object path `0x18000f700`) | SPEC |
| 13 `Activate…SelTool…` entries (list in §3.6) | `ActivatePolygonSelTool`, `…WithNoObjStateChange`, `ActivateRaycastPolySelTool`, `…WithNoObjStateChange`, `ActivateVertexSelTool`, `…WithNoObjStateChange`, `ActivateEdgeSelTool`, `…WithNoObjStateChange`, `ActivateRaycastEdgeSelTool`, `…WithNoObjStateChange`, `ActivateTipSelTool`, `ActivateObjectSelToolWithNoObjStateChange`, `ActivateSelectTool` | selectionmgr | CLSID `d9eb4110…`, factory vt `0x18001d7e8`, create `0x180004f20`, ctor `0x18000df20` (0x78), task vt `0x18001fb40`: Do `0x18000e260`, Undo `0x18000e910`, Redo `0x18000e8e0`, UnPack `0x18000eae0`; tool chooser `0x18000e0a0` | SPEC |
| Previous Frame, Play/Reverse Play, Play in Real Time, Stop, Play Backwards, Play in Real Time From Start, Play Backwards From End | `PrevFrame`, `PlayFrame`, `PlayRealTime`, `PlaybackStop`, `PlayBackwards`, `PlayRealTimeFromStart`, `PlayBackwardsFromEnd` | mcp | CLSID `9ff65990…`, factory ctor `0x1800018e0` (vt `0x180049788`), create `0x180003220`, ctor `0x18003d670` (0x218), task vt `0x18005c640`: Do `0x18003e4b0` (thunk), Undo `0x18003e4e0`, Redo `0x18003e4c0`, UnPack `0x18003e6d0`; transport worker `0x18003d7f0` | SPEC |
| Frame Contextual (All 3D Views) | `FrameContextual` | vm | CLSID `248c1d05…` (CMD-B11h: `0x18000d970` → `0x18000f8f0` → `0x180003b90`, Do `0x180003fc0`) | SPEC (B11h) |
| Center Selection (All 3D Views) | `CenterSelection` | vm | CLSID `d048b3fd…`, factory ctor `0x18000d890` (vt `0x180043e70`), create `0x18000f810`, ctor `0x180002a70` (0x80), task vt `0x18003aae0`: Do `0x180002bf0`, UnPack `0x180002da0`, Undo/Redo stub `0x1800073a0` | SPEC |
| Isolate Selected / Add / Remove / Toggle / All | `IsolateSelected`, `IsolateAddSelected`, `IsolateRemoveSelected`, `IsolateToggleSelected`, `IsolateAll` | vm | CLSID `93c85bba…`, factory ctor `0x18000dac0` (vt `0x180043ee0`), create `0x18000fa40`, ctor `0x180004d80` (0x88), task vt `0x18003b830`: Do `0x180004f30`, Undo `0x180005530`, Redo `0x180005520`, UnPack `0x180005680`; collector `0x1800057f0` | SPEC |
| Switch to Model/Animate/Render/ICE/Simulate/Hair Toolbar | `SwitchToolbar` | toolbarobj | CLSID `b5c21641…`, factory ctor `0x1800105e0` (vt `0x180024c38`), create `0x180010c80`, ctor `0x1800047d0` (0x50), task vt `0x18001e2c0`: Do `0x180004950`, Undo/Redo `0x180004980`, UnPack `0x180004a50` | SPEC |
| Save Render Region To File | `RenderRegionSave` | **rendercore** (siuitasks only *uses* the class) | CLSID `8ab0e935…`, factory vt `0x1800eefb0`, create `0x18009f0a0`, ctor `0x18009b280` (0x78), task vt `0x1800eeed0`: Do `0x18007b710`, Undo/Redo `0x18002a0b0`, UnPack `0x18007c3e0`, RePack `0x18007c0d0`; worker slot 9 `0x18007a4b0` | SPEC |
| Face Robot Act Floating Panel | `ShowFaceRobotActPanel` | siuitasks | CLSID `3ea2aaac…`, factory vt `0x180014758`, create `0x180004f30`, ctor `0x18000ef30` (0x68), task vt `0x180018320`: Do `0x18000f0e0`, Undo/Redo `0x1800028a0` (stub), UnPack `0x18000f350` | SPEC-PARTIAL |

## 2. Shared facts

- **Selection manager** = generic object `a003cac3-e4f3-11d1-84c6-00aa00135f7b` (selectionmgr's first class). Its
  interfaces: `a003cac0` (current selection filter: get +0x20, set +0x18), `a003cac1` (the selection list),
  `a003cac2` (the "active elements" list of CMD-B7a: objects whose components are being edited).
- **Selection sub-task classes** (all in selectionmgr, run as undoable sub-tasks when the command records undo):
  `79581ba0` SelectObj (replace), `38eddd00` AddToSelection, `38eddd02` RemoveFromSelection, `9dcec2b0`
  SetActiveElements, `9dcec2b2` ActivateElements, `9dcec2b3` DeactivateElements, `91d68770` the set-filter task
  (= `Select*Filter`, §3.5).
- **Ambient values** written by selection tools: `SI3D_GROUP_SEL_MODE` (bool), `SI3D_RECTSEL_REGION_MODE` (int 1..6).
- **HRESULTs**: `0x80070057` E_INVALIDARG, `0x8000ffff` E_UNEXPECTED, `0x80004003` E_POINTER, `0x80004004` E_ABORT,
  `0x562e80c7` "success, nothing changed" (kept across result merges).
- **vm view helper**: `View` = −1 → active 3D view (its index is remembered), otherwise the 0-based view index
  (0..3 = A..D). Camera-change bracket and label as in CMD-B11h.

## 3. Wire contracts

### 3.1 `SetAndToggleSelection` — SPEC-PARTIAL
**Wire contract** (`1d11f9b0`; same worker `0x180011ea0` as CMD-B7a `SetAndToggleActiveElements`, but its virtual
list owner is the **selection list**, not the active-elements list).
- Args: `SelectionList` (list), `HierarchyLevel` (int 0..7, default 0 = as is; registry default `…:ASITIS`; any other
  value or non-integer → `0x80070057`), `SupportPostSelectionScript` (bool, default false), `CheckObjectSelectability`
  (registered, **not read** by this class).
- `HierarchyLevel` 4 → `0x80070057`.
- Non-empty list: expanded to the hierarchy level (selection service), then an owner pre-check (slot 10
  `0x180005ed0`, unread) may end with "nothing changed" (`0x562e80c7`) or `0x8000ffff`.
- Split (helper `0x180010940`, mode 1): for each item, components are compared index by index with the same
  object's currently selected components; the result **A** = items / component indices **not currently selected**.
  The selection is then **set to A** (set-selection helper `0x180015090`, passing `SupportPostSelectionScript`): so
  listed items that were already selected are dropped and everything else that was selected is deselected.
- Removed items become a `RemoveFromSelection` sub-task, and an accompanying `DeactivateElements` sub-task is run for
  the second list the selection manager returns (inferred: active elements that no longer apply).
- Returns `0x562e80c7` when A was empty and nothing changed. Undo/Redo: base task undo of the sub-tasks.
- Missing: owner pre-check slot 10 and the selection manager's set method (+0x110) internals.

### 3.2 `SelectAll` and `SelectAllUsingFilter` — SPEC
One class (`8629cad0`); the two commands differ only by registry arguments.
- Args read: `SelFilter` (filter object `af5d00d4-…`; failure to resolve it fails the command), `CheckObjectSelectability`
  (bool), `CheckComponentVisibility` (bool/enum: `SelectAll` has none → false; `SelectAllUsingFilter` default
  `siIgnoreComponentVisibility`), `SelectionList` (optional, not registered for these two), `AffectSelectionList`
  (bool; **missing or unreadable → true**). `Value` is the output list (RePackArg).
- No `SelectionList`: the candidate list is built from the current scene root's descendants (root method +0x60 with
  mode 2, then the selection service `24be99c0` slot +0x78) (inferred: all scene objects).
- **Object filter** (filter's "is component filter" test false): the selection service collects from the candidate
  list every object accepted by `SelFilter` (method +0xa8 with filter engine `f384b821`). No visibility test of its own.
- **Component filter**: for every object of type 2 in the **active-elements list** (`a003cac2`) that is not hidden
  (`F3DFaceRobotIsObjectHidden` false) and whose geometry has the filter's component family, a component reference
  with **all** component indices 0..n−1 of that family is built; with `CheckComponentVisibility` true only the
  visible components are taken. The result is passed through the filter once more.
- If `AffectSelectionList`: a `SelectObj` sub-task replaces the selection with the result (`CheckObjectSelectability`
  passed through). Result list returned in `Value` either way. Undo / Redo = the sub-task.

### 3.3 `SelectMembers` — SPEC
- Args: `SelectionList` (required, failure returned), `AffectSelectionList` (missing → true),
  `CheckObjectSelectability` (default false); output `Value`.
- Each item of the list: **group-like** objects (type 8) are replaced by their members (interface `b0cbf80e`);
  **clusters** (type 6) are replaced by a component reference to their owner geometry holding the cluster's element
  indices at the current time; any other item is copied as is.
- When **every** item is a cluster and all give the same component type, the matching selection filter is looked up
  in the filter registry (`e1c35d82` / `e22d6212`, method +0xa0 with mode 3) and kept; a mix drops it.
- If `AffectSelectionList`: `SelectObj` sub-task with the member list (`CheckObjectSelectability`), then, if a common
  filter was found, the set-filter task (§3.5) with `DeselectOnNewFilter` = false, then ambient
  `SI3D_GROUP_SEL_MODE` := false. Undo/Redo = sub-tasks (the ambient value is not restored, inferred from no record).

### 3.4 `FrameContextual` — SPEC
Same as CMD-B11h §Frame Contextual (`248c1d05`): frame the selection when the selection list or the active-elements
list is non-empty, else frame all; `AllViews` false → the one view (`View`, −1 = active) inside a camera bracket labelled
"Frame"; true → every 3D view, no bracket. Not undoable.

### 3.5 `SelectObjectFilter`, `SelectVertexFilter`, `SelectPolygonFilter`, `SelectEdgeFilter`, `SelectSampledPointFilter` — SPEC
One class (`91d68770`); the registry default of `SelFilter` names the filter (`{1128E000-…}:object`, `vertex`,
`polygon`, `edge`, `SampledPoint`); `DeselectOnNewFilter` default true.
- UnPack: `SelFilter` (filter object, optional), `DeselectOnNewFilter` (bool, default false when unreadable).
- No filter → returns `S_FALSE` (1), nothing done.
- Worker, in order: clear sub-tasks; on the first execution remember the **current filter** for undo; ask the selection
  manager to make `SelFilter` current (filter interface `a003cac0` +0x18), which returns two lists: items to **add**
  and items to **remove** (inferred: previously tagged components of the new type / items incompatible with it).
- Kind-specific step (filter kind byte from the filter, +0x50):
  - **component filter (kind 4)**, path `0x18000fa40`: every selected 3D object becomes an **active element**
    (`ActivateElements` sub-task); with `DeselectOnNewFilter` the selected objects are first queued for removal (and
    for an object that already has an active-element state its components of the new type are gathered instead);
    selected non-object items whose owner is not yet active add their owner to the active list; component items stay.
    With `DeselectOnNewFilter`, a `RemoveFromSelection` sub-task removes the queued objects.
  - **object filter (kind bit 1)**, path `0x18000f700`: if the active-elements list is non-empty: without
    `DeselectOnNewFilter` and with a non-empty selection, the active objects that are not selected/unselectable
    (owner flags (0,4)/(1,4) clear) are added to the selection; otherwise all active objects are added
    (`AddToSelection`). Then the active-elements list is cleared (`SetActiveElements` with nothing).
- Then: if `DeselectOnNewFilter` and the "remove" list is non-empty → `RemoveFromSelection` sub-task; if the "add" list
  is non-empty → `AddToSelection` sub-task ("selects previously tagged …" of the registry descriptions).
- Return S_OK (`1` when there was no filter). **Undo**: undo the sub-tasks, then set the remembered filter back
  (without deselecting). Redo: re-run.

### 3.6 `Activate…SelTool…` (13 commands) — SPEC
One class (`d9eb4110`). Registry defaults:

| scripting name | SelFilter | DeselectOnNewFilter | SelRegionMode / GroupMode |
|---|---|---|---|
| `ActivatePolygonSelTool` | polygon | true | SelRegionMode 1 |
| `ActivatePolygonSelToolWithNoObjStateChange` | polygon | false | 1 |
| `ActivateRaycastPolySelTool` | polygon | true | 2 |
| `ActivateRaycastPolySelToolWithNoObjStateChange` | polygon | false | 2 |
| `ActivateVertexSelTool` | vertex | true | 1 |
| `ActivateVertexSelToolWithNoObjStateChange` | vertex | false | 1 |
| `ActivateEdgeSelTool` | edge | true | 1 |
| `ActivateEdgeSelToolWithNoObjStateChange` | edge | false | 1 |
| `ActivateRaycastEdgeSelTool` | edge | true | 2 |
| `ActivateRaycastEdgeSelToolWithNoObjStateChange` | edge | false | 2 |
| `ActivateTipSelTool` | tip | true | 1 |
| `ActivateObjectSelToolWithNoObjStateChange` | object_only_if_current_is_subcomponent_one | false | GroupMode false |
| `ActivateSelectTool` | (no args) | – | – |

- UnPack: `SelFilter` optional; `DeselectOnNewFilter` is read **only** when the global object `e99d46d0` (iface
  `a25c423d`) +0x38 with key `cf80cbc3-984e-11d1-96e7-00a024191bac` answers non-zero, otherwise forced false
  (CMD-B7a reading: "that tool is current"); `GroupMode` optional (sets a "has group mode" flag); `SelRegionMode`
  optional, valid 1..6 else `0x80070057` (1 = rectangle, 2 = raycast per the registry descriptions; 3..6 not named here).
- Do (scripted / normal invocation), in order:
  1. With `SelFilter`: run the set-filter task (§3.5) with (`SelFilter`, `DeselectOnNewFilter`) as an undoable
     sub-task (only kept when it changed something).
  2. With `GroupMode`: ambient `SI3D_GROUP_SEL_MODE` := `GroupMode` when different.
  3. With `SelRegionMode`: ambient `SI3D_RECTSEL_REGION_MODE` := value when different.
  4. Choose the tool: default the **selection tool** `11778840-8c5c-11d1-84b5-00aa00135f7b`; when the effective filter
     (`SelFilter`, else the current filter) is a component filter whose family test (interface `93c3a700` +0xb8,
     type `0f47fe72-d0e9-11d2-b7f9-00a0243e3694`) passes, tool `e9cdd760-d183-11d2-8bcf-00aa006130ef` (inferred: the
     component/tag variant of the select tool).
  5. Activate it through the activate-tool task `0461b2c6` (CMD-B16a generic activation, interface `bdd75b60`, with
     the exec context's key state) unless the tool manager reports it already active.
- **Correction to CMD-B7a**: the activated tool is `11778840` / `e9cdd760` via task `0461b2c6`; `0461b2c6` is the
  activation task, not the tool.
- Key-held ("supra") invocations (exec-context flag bits 4 / 2): steps 1–3 are skipped on the repeat, and the original
  `SI3D_GROUP_SEL_MODE` is remembered in module globals and restored when the temporary activation ends; such calls
  return `S_FALSE` after asking the exec context (+0x98, 2) not to record (inferred: no undo/log entry).
- Undo / Redo (`0x18000e910` / `0x18000e8e0`): the sub-tasks (filter change) (inferred: ambient values not restored).

### 3.7 Playback transport (`mcp.dll`, `9ff65990`) — SPEC
All 23 registry entries share the class and pass `Type` (int) and `Transport` (int): `NextFrame` 0, `PrevFrame` 1,
`FirstFrame` 2, `LastFrame` 3, `PlayFrame` 4, `PlayRealTime` 5, `PlaybackStop` 6, `PlayForwards` 7,
`PlayBackwards` 8, `PlayRealTimeFromStart` 9, `PlayForwardsFromStart` 10, `PlayBackwardsFromEnd` 11. Each has a
"Sequence …" twin with `Transport` 1.
- UnPack: `Type` and `Transport` only taken when VT 0x17 (unsigned int).
- Player: `Transport` 0 → the main timeline player (global object, method +0x20); non-zero → the sequence player
  (other generic object, method +0x30) (registry names "Sequence …"). Player missing → nothing, S_OK.
- First execution reads the full player state (0x1c0 bytes, mask 0xfff) and keeps it for **Undo**, which writes it back
  (time, direction, play mode). Redo re-runs the type without saving. (So frame stepping is undoable.)
- Terms: *start* / *end* = the player's current range (when its range flag is set the loop range is used, inferred);
  *step* = the player's signed frame increment; "stopped" = player state 1.

| Type | behaviour |
|---|---|
| 0 next | if range flag set and current ≥ end → go to start; else advance by \|step\| frames (player +0x58) |
| 1 prev | if range flag set and current ≤ start → go to end; else go back by \|step\| (player +0x60) |
| 2 first | go to start (if start is finite) |
| 3 last | go to end (if finite) |
| 4 play/reverse | stopped: if at start while stepping backwards, or at end while stepping forwards, the direction is reversed; then play frame-by-frame (mode 2). Playing: stop, reverse the direction, play again (mode 2) |
| 5 real time | stopped: if current ≥ end go to start; read preference `Interaction.realtimeplaybackrate` (percent); ≠100 → play at rate ×0.01 (+0x68), else play real time (mode 0). Playing: stop |
| 6 stop | stop |
| 7 forwards | stopped: force direction positive; if current ≥ end go to start; play mode 2. Playing: stop |
| 8 backwards | stopped: force direction negative; if current ≤ start go to end; play mode 2. Playing: stop |
| 9 real time from start | stopped: go to start, then as 5. Playing: stop |
| 10 forwards from start | stopped: direction positive, go to start, play mode 2. Playing: stop |
| 11 backwards from end | stopped: direction negative, go to end, play mode 2. Playing: stop |
| other | nothing, S_OK |

### 3.8 `CenterSelection` — SPEC
- Args: `AllObjects` (bool, default false), `AllViews` (bool, default true; the "Center Selection" twin false), `View`
  (int −1). UnPack failure of any → error.
- Same structure as `FrameSelection` (CMD-B17i) with label **"Center"** and the frame method +0xc0 called with
  (`AllObjects`, **0**): flag 0 = centre without zoom (Frame uses 1) (inferred meaning of the flag). `AllObjects`
  true centres on everything, false on the selection.
- `AllViews` false: one view (active or `View` index), inside the camera-change bracket (enters the per-view camera
  history). True: every 3D view, no bracket, `View` ignored. Always S_OK; not undoable (stub).

### 3.9 Isolate commands — SPEC
One class (`93c85bba`). UnPack: `All` (taken only when VT_BOOL), `View` (only when VT_I4), `Mode` (only when VT_I4;
default 0 when absent). Registry: `IsolateSelected` (All false, no Mode → 0), `IsolateAddSelected` Mode 1,
`IsolateRemoveSelected` 2, `IsolateToggleSelected` 3, `IsolateAll` (All true).
- View: −1 → active view (index stored); else that index. No view or index > 3 → `0x80070057`.
- The isolation list belongs to the view's display object (view +0x68; get +0x598, set +0x590).
- First execution: a copy of the current isolation list is kept for undo (only when non-empty).
- `All` true: isolation of **that one view** is cleared (set to nothing, notify flag 0) → every object shown.
- `All` false: build the candidate list from the **selection list** (`a003cac1`), or, when that gives nothing, from
  the active-elements list (`a003cac2`). Collection rule: group-like items (type 8) are replaced recursively by their
  members; any other item is replaced by its owning 3D object (components → their object).
  - Mode 0: isolation := candidates.
  - Mode 1 / 2 / 3 with an existing isolation list: copy it; for each candidate: 1 add if absent, 2 remove if present,
    3 toggle. Isolation := the copy.
  - No existing isolation: Mode 1 / 3 → isolation := candidates; Mode 2 → isolation cleared.
  - An empty result clears isolation. Set with notify flag 1.
- Then the view manager refreshes that view. Returns S_OK.
- **Undo**: restores the saved list (or clears) on the same view and refreshes. Redo: re-run without saving.

### 3.10 `SwitchToolbar` — SPEC
- Arg `Target` (int, 1-based). If module `Target − 1` is valid (`SIAppModules::IsModuleValid`) it becomes the current
  module (`ChangeCurrentModule`); otherwise nothing. Always S_OK, no return value, not undoable.
- Registry: Model 1, Animate 2, Render 3, ICE 4, Simulate 5, Hair 6.

### 3.11 `RenderRegionSave` — SPEC
Served by **rendercore.dll** (siuitasks' thumbnail code only calls the same class, CMD-B7a).
- UnPack: `Viewport` (same resolver as CMD-B19a: ≥0 view id, −1 all, −2 current (default), −3 the other designated
  one); `FileName` must be a string and `WaitUntilComplete` a bool, else the remaining reads are skipped.
  The file name's extension (with the dot) is written to preference `rendering.default_savepicture_filetype` when
  non-empty.
- Worker: collect the render regions of the resolved viewport(s), dropping those not currently shown. None →
  log `XSIRENDERCORE` id 4 (severity 4) and return `0x80004004`.
- File names: one region → `FileName` as is; several → `FileName` with `_<view>` inserted before the last `.` (or
  appended), `<view>` = `A`..`D` for views 0..3 else `View<n>`.
- Per region: take its image (with `WaitUntilComplete` the multithreaded render lock is fully released while the image
  is fetched, then re-taken); write with `DSWriteImageToFile`. Failure → log id 6 (view, path) severity 2 and continue;
  success → log id 5 (view, path) severity 16 (single) or 8 (several). Return S_OK. Not undoable.

### 3.12 `ShowFaceRobotActPanel` — SPEC-PARTIAL
- Args: `Path` (string), `OffsetX`, `OffsetY` (long); the exec context is kept.
- Do: empty `Path`, or a path the file-path object cannot resolve (environment variables such as `$FACEROBOTROOT`
  expanded) → `0x8000ffff`. Otherwise the resolved path is given to generic object `05aa1bc9-f92b-11d4-beaf-00a0c982ddd4`
  (iface `05aa1bca`, +0x50) and the offset pair (+0x60), then tool `1e0a3aab-05da-4716-9e7c-05ffe14242c9` is
  activated through the activate-tool task `0461b2c6` with the key state of the exec context. Returns `S_FALSE` (1).
  Not undoable.
- Missing: what tool `1e0a3aab` shows (inferred: the floating synoptic panel at the given offset).

## 4. Open questions

- Q1 `SetAndToggleSelection`: owner pre-check slot 10 (`0x180005ed0`) and the selection manager's set method (+0x110):
  how the second returned list (DeactivateElements) is formed.
- Q2 Activate tools: identity of tool `e9cdd760-…` and of type `0f47fe72-…`; meaning of `SelRegionMode` 3..6.
- Q3 Filter worker: exact rule the selection manager uses to build the add/remove lists when the filter changes.
- Q4 mcp: which state field is the "range flag" (loop vs. play range).
- Q5 ShowFaceRobotActPanel: the tool `1e0a3aab-…` behaviour.

## 5. Corrections for the wire agent

1. `SelectAll` (`src/commands/index.ts`): registered with no args. Add `SelFilter` (default object filter),
   `AffectSelectionList` (true), `CheckObjectSelectability` (false); return the list (`Value`). Object filter: all scene
   objects the filter accepts (no visibility test of its own); component filter: all components of that type on the
   active (component-edit) objects. `AffectSelectionList` false must only return the list.
2. `SelectAllUsingFilter`: default `CheckComponentVisibility` is `siIgnoreComponentVisibility` (src has
   `siCheckComponentVisibility`); component path should use the active-elements objects, all components (visible only
   when the flag is set).
3. `SelectMembers`: with only clusters of one type the selection filter switches to that type (`DeselectOnNewFilter`
   false) and `SI3D_GROUP_SEL_MODE` becomes false; groups are replaced by members; returns `Value`.
4. `Select*Filter`: implement `DeselectOnNewFilter` (remove incompatible selection, add previously tagged items) and
   the active-element transitions (component filter → selected objects become active elements; object filter → active
   objects are added to the selection and the active list cleared); undo restores the previous filter.
5. `Activate*SelTool` (`src/commands/ui.ts`): beyond `setSelMode`: run the filter change with `DeselectOnNewFilter`
   (the `…WithNoObjStateChange` variants keep the selection), write ambient `SI3D_RECTSEL_REGION_MODE` (1 rectangle,
   2 raycast), `SI3D_GROUP_SEL_MODE` (object variant), activate the selection tool `11778840`. `SelRegionMode` outside
   1..6 → error.
6. `SetAndToggleSelection`: `HierarchyLevel` 4 or outside 0..7 → `0x80070057`; arg `SupportPostSelectionScript`
   (registry) missing in `LIST_ARGS`; `CheckObjectSelectability` is not used by the handler.
7. `PrevFrame` (`index.ts`): no clamping at the start; wraps to end when the range flag is set and at/before start;
   step is the player's increment; `Type`/`Transport` args missing; the step is undoable in Softimage.
8. `PlayRealTime`, `PlayRealTimeFromStart`, `PlayBackwards` (`anim.ts`), `PlayBackwardsFromEnd`: when already playing
   they **stop** (toggle). `PlayRealTime` honours `Interaction.realtimeplaybackrate` (percent) and jumps to start when
   at/after end. `PlayBackwards` jumps to end when at/before start.
9. `PlayFrame` when stopped: reverses direction only at the range boundary of the current direction, otherwise plays in
   the current direction (src always starts forwards).
10. `IsolateAll`: clears isolation of the one view (`View`, −1 = active), not every viewport.
11. `IsolateAdd/Remove/ToggleSelected`: when the view is not isolated, Add/Toggle start isolation with the selection
    (Remove clears); components count as their objects, groups as their members; empty selection falls back to the
    active-elements list; undoable (restores the previous isolation list); index > 3 → `0x80070057`.
12. `IsolateSelected` (`ui.ts`): must set the view's isolation list (Mode 0), not write `viewvis` visibility parameters
    on all objects; the `Force` argument does not exist in the handler.
13. `CenterSelection`: `AllObjects` true centres on all objects (not "not yet attested"); single-view call enters the
    per-view camera history (label "Center"); centring does not zoom.
14. `SwitchToolbar` (`iceModule.ts`): invalid `Target` leaves the module unchanged (src falls back to ICE); `7` is not a
    Hair alias; returns nothing.
15. `RenderRegionSave` (`moduleToolbar.ts`): args `Viewport` (current) and `WaitUntilComplete` missing; with no region
    shown it logs a warning and fails (`E_ABORT`) instead of rendering a still; several regions write `<name>_A.ext`…;
    sets preference `rendering.default_savepicture_filetype`.
16. `ShowFaceRobotActPanel`: empty or unresolvable `Path` → `0x8000ffff` (src opens the view anyway).
