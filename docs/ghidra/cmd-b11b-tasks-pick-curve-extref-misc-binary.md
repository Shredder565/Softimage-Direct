# CMD-B11b: picking, curve knot queries, external references, custom import, System, reference plane, obstacle menu and the shared "misc" handler, read from `tasks.dll`

Row: **CMD-B11b**. Status: **SPEC** (21 names), **SPEC-PARTIAL** (2 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
No XSIBATCH golden: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\tasks.dll`, image base `0x180000000`, sha256 `d760b7aad9b433e4b40448aff1030b87cbcdee596f99fbf13212b4214fde9914`.
Method: CLSIDs located in `DllGetClassObject` (`0x180009700`, a long chain of inline 16-byte
compares, each building a class factory with its own vtable); factory slot 6 read for the
constructor; constructors decompiled for the task vtables; Do / UnPackArg / RePackArg / Undo /
Redo and the worker methods decompiled (about 45 functions). Seven small methods Ghidra has
no function for (`0x18001f5f0`, `0x180031570`, `0x1800315b0`, `0x180050770`, `0x180050790`,
`0x180053390`, `0x1800533d0`) were read as raw bytes and decoded locally. The shared CLSID's
dispatch table (`0x1800e3180`) and the GUID pool it points at were read as raw data. All
statements are behaviour read from the binary unless marked `(inferred)`.

Command list note: the task named 25 entries; the `clsid` range `5c87875c`..`b5097d5a` in
`tasks.dll.json` holds 23 (11 distinct handlers + 12 names on `b5097d5a`). All 23 are covered.

## 1. Handler table

Factory layout: 7-slot vtable, slot 3 = the common `CreateInstance` (`0x180004fd0`, refuses
aggregation with `0x80040110`), slot 6 = "construct task". Two task layouts occur:
(a) `C3DCoreBaseTask` at offset 0, `CDSCOMObject` at `+0x20`, worker/helper sub-object at `+0x38`;
(b) `CDSCOMObject` at 0, `C3DCoreBaseTask` at `+0x18`, worker sub-object at `+0x38`.
Task vtable = the one on the `C3DCoreBaseTask` part; slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg,
9 RePackArg. `0x18000e460` (shared Undo/Redo stub) and `0x18008cd12` / `0x18008ccfa` (imported
base-class defaults) mean "nothing task-specific".

| Command(s) | Handler CLSID | Factory vtable -> slot 6 -> constructor (size) | Task vtable | Do | UnPackArg | RePackArg | Undo / Redo | Worker |
|---|---|---|---|---|---|---|---|---|
| `PickElement`, `PickObject` | `5c87875c-0a31-11d3-bc2d-00a0c9612b97` | `0x1800a15b0` -> `0x180008b20` -> `0x18006e120` (0xa0, layout a + `C3DPickingHelper` at `+0x20`) | `0x1800b3790` | `0x18006e350` | `0x18006e9e0` | `0x18006e700` | stub | `C3DPickingHelper::InitPickSession` (import) |
| `GetNumberOfKnots` | `656fc3b1-7c05-11d3-97b9-00a0243e3463` | `0x1800a1690` -> `0x1800080d0` -> `0x18006d9e0` (0x58) | `0x1800b3450` | `0x18006db30` | `0x18006dce0` | `0x18006dc30` | stub | - |
| `GetCurvePercentageAtKnotIndex` | `656fc3b2-7c05-11d3-97b9-00a0243e3463` | `0x1800a16c8` -> `0x180008110` -> `0x18006dd80` (0x60) | `0x1800b35b0` | `0x18006ded0` | `0x18006e0c0` | `0x18006e010` | stub | - |
| `EnumElements` | `6d34bf79-18fc-11d3-bc37-00a0c9612b97` | `0x1800a1700` -> `0x180007cb0` -> `0x180031410` (0x60) | `0x1800a9330` | `0x180031570` (no Ghidra function) | `0x1800315e0` | `0x1800315b0` (no Ghidra function) | stub | imports `SIEnumElementParents` (`0x18009b0c8`) / neighbour slot `0x18009b0d0` |
| `Obstalce Pop-up Menu` | `8fbbf318-15f8-4e96-8c09-92fbe12bfef7` | `0x1800a2010` -> `0x1800088f0` (inline construct, base `0x18005ff50`, 0xb0) | `0x1800a1f40` | `0x180061930` -> own slot 14 `0x180061890` | `0x180061a60` | default | stub | menu fill `0x1800605e0` / `0x180061230`; pick action `0x1800616d0` |
| `GetExternalReferences` | `687fafb2-ad49-4b97-8f5d-e3faca1e42db` | `0x1800a23b8` -> `0x180008150` -> `0x18001f190` (0x50, layout b) | `0x1800a66f0` | `0x18001f5f0` (no Ghidra function) -> worker slot 9 | default (`0x18008cd12`) | `0x18001f6a0` | `0x180070020` (both) | `0x18001f2e0` (vtable `0x1800a6760`) |
| `UpdateExternalReference` | `a3e3dfe1-c2bc-46d7-8977-271f04fcd1ac` | `0x1800a2428` -> `0x1800094c0` -> `0x18002bcb0` (0x70, layout b) | `0x1800a86c0` | `0x18002c470` | `0x18002c630` | default | Undo `0x18002c500`, Redo `0x18002c4b0` | `0x18002be70` (vtable `0x1800a8730`) |
| `ImportCustomFile` | `8c51ca84-fe5f-46f3-b6ec-69db89dd3d78` | `0x1800a24d0` -> `0x180008420` -> `0x180021720` (0x98) | `0x1800a6d00` | `0x180022280` | `0x180022410` | `0x18007dc50` (shared) | stub | `0x180021910` (vtable `0x1800a6dc0`) |
| `System` | `a121de74-7132-11d3-8d44-00609419fcaf` | `0x1800a2578` -> `0x180009380` -> `0x180052fe0` (0x68) | `0x1800aed40` | `0x180053290` | `0x1800533d0` (no Ghidra function) | `0x180053390` (no Ghidra function) | stub | `0x180053160` (vtable `0x1800aee00`) |
| `SetReferencePlane` | `9860fe78-9aa3-4a4a-b764-5d52578b4f36` | `0x1800a2968` -> `0x1800091c0` -> `0x18004f9d0` (0x178) | `0x1800ae6e0` | `0x180050770` (no Ghidra function) | `0x180050bd0` | default | Undo `0x1800507b0`, Redo `0x180050790` | `0x18004fc30` (vtable `0x1800ae7a0`); apply helper `0x1800509f0` |
| 12 names below (+ 6 names of other rows) | `b5097d5a-0331-42fb-bf47-e87677da16a8` | `0x1800a3490` -> `0x180007620` -> `0x18000e210` (0x30, `CDSCOMObject` only, no `C3DCoreBaseTask`) | interface vtables `0x1800a4cd0` (`+0x18`) and `0x1800a4d18` (`+0x20`) | dispatcher `0x18000e490` | - | - | - | per-command function from table `0x1800e3180` |

### 1.1 The shared CLSID `b5097d5a`: dispatch by command GUID

The object built for `b5097d5a` is not a task. Its execute entry (`0x18000e490`, slot 3 of the
`+0x18` interface) receives the exec context, asks it (interface `0x18009dbb8`) for the
command definition's GUID, and walks a static table set up in `InitInstance` (`0x180005280`
stores `0x1800e3180` in `0x1800e4178`). Each table row is 0x30 bytes:
`{+0 run(execContext), +8 optional arg-setup(…), +0x10 pointer to command GUID, +0x18 DLL
name (char*), +0x20 export name (char*), +0x28 HMODULE cache}`; a NULL GUID pointer ends the
table. If the row's `run` pointer is NULL and DLL / export names are present, the DLL is
loaded with `LoadLibraryExW(..., LOAD_WITH_ALTERED_SEARCH_PATH)` and the export resolved
(no row in this build uses that path). A successful `run` makes the dispatcher return `1`
(S_FALSE); a `run` failure HRESULT is returned as is; an unknown GUID returns
`0x80020003` (DISP_E_MEMBERNOTFOUND); a failed `LoadLibrary` returns `0x80004005`.
A second entry (`0x18000e690`, slot 3 of the `+0x20` interface) finds the row of a stored GUID
and calls its `+8` function with four arguments; it returns `0x8000FFFF` when no GUID is
stored and `0x80020003` when the row or function is missing. Only the two `*AddonLib`
single-file rows have a `+8` function; it fills a file-browser description for the
`FileName` argument (inferred: the argument-editor hook).

Table rows (row index, `run`, `+8`, command GUID, command):

| # | run | +8 | command GUID | command |
|---|---|---|---|---|
| 0 | `0x18002ce20` | `0x18002d000` | `d0aff13e-5450-4769-ae9a-f6481f614d8a` | `UnloadAddonLib` |
| 1 | `0x18002c6a0` | `0x18002c880` | `cf3967fc-49ba-4e4e-8bf6-e076bee709e1` | `ReloadAddonLib` |
| 2 | `0x18002d5b0` | - | `30798b2d-453e-4d53-ad88-13ad5c7d477a` | `UnloadAllCOMLibs` |
| 3 | `0x18002d310` | - | `ae421ac2-f192-4968-8605-6c1317f5daba` | `UnloadAllAddonLibs` |
| 4 | `0x18002cb90` | - | `61077d35-dbb0-4e1e-9d87-89c685fa4be5` | `ReloadAllAddonLibs` |
| 5 | `0x180054fe0` | - | `f0817189-1544-4df0-af4b-ff72f9bf43d4` | `SIGetHelpPath` |
| 6-10 | … | - | … | `BeginUndo`, `EndUndo`, `Undo`, `Redo`, `RefreshCustomPreferences` (other rows) |
| 11 | `0x180054ec0` | - | `3053e1b7-be89-4cf2-b29e-70527c23306c` | `CrashXSI` |
| 12 | `0x180054f10` | - | `6893ad3e-e8c3-4357-af44-7f35bf7f6656` | `DumpMemoryStats` |
| 13 | `0x180055070` | - | `71a80c5a-06c9-442a-bfc4-01d481c8c5b3` | `GetUnevaluatedPrimitiveForConstructionHistory` |
| 14 | `0x1800555d0` | - | `ccf5c2aa-8c30-4c74-a799-0e7e74132fd5` | `ResetDirectX` (other row) |
| 15 | `0x180055290` | - | `ed619387-2588-404c-957d-268e2fdbc490` | `IsSoftimageDevDrop` |
| 16 | `0x180055270` | - | `338ab613-507a-4953-976b-02321eeec05a` | `ICEOfflineRefresh` |

`TestPluginHost` (`a4caffae-2bdd-486d-8739-47a0f70d1bd9`) has no row: its GUID bytes do not
occur anywhere in `tasks.dll`.

## 2. Shared facts

- HRESULTs used: `0x80070057` E_INVALIDARG, `0x80004003` E_POINTER, `0x80004002`
  E_NOINTERFACE, `0x8000FFFF` E_UNEXPECTED, `0x80004005` E_FAIL; `0x562E80C7` is the
  Softimage "success with information" code that the UnPackArg helpers propagate.
- Argument fetch helpers (imports): `F3DGetArgPtrValueFromName2` (object argument with an
  interface), `SICmdGet{Boolean,Long,ULong,Double,String}ArgFromName`, raw variant get
  (exec-context slot 0x68) and set (slot 0x60); output object arguments go through a local
  helper `0x180010500` (name, VT 13 = VT_UNKNOWN, object).
- Interfaces requested: generic scene item `0x18009de88` (Target of SetReferencePlane /
  UpdateExternalReference / EnumElements InputObj), X3DObject-like `0x18009bcf8` (curve
  commands, ImportCustomFile Target, GetUnevaluated...), list `0x18009dfa8` (class
  `0x18009df78`, the `XSICollection`-style list used for every list result).
- Text resources: dictionary `XSITASKS` ids `0x40f`, `0x426`, `0x42f`; catalog `simsgcat`
  message ids `0x118`, `0x11d`, `0x127`, `0x128`; `SILogMessage` severities 2 (error/warning)
  and 4 (info).

## 3. Contracts

### `PickElement`: SPEC

Interactive picking session; returns what was picked.
**Wire contract**
- UnPackArg: `SelFilter` (object, filter interface `0x18009c928`, failure aborts); `LeftMessage`
  and `MiddleMessage` must be strings (VT_BSTR) else `0x80070057`; `SelRegionMode` optional:
  kept only when it is an integer 1..6, otherwise 0 (a non-integer variant sets the result to
  `0x80070057` but parsing continues).
- Do: first asks a global service (`0x18009df38` / `0x18009df08`) whether interaction is
  possible; if it answers "no" the command returns without picking (inferred: batch / no UI).
  The right-button prompt is `XSITASKS` id `0x40f`. If `SelRegionMode` is non-zero and differs
  from ambient value `SI3D_RECTSEL_REGION_MODE`, the ambient value is set for the session and
  restored afterwards. Runs `C3DPickingHelper::InitPickSession(filter, LeftMessage,
  MiddleMessage, rightMsg, 1, 2, &pickedList)`.
- RePackArg outputs: `PickedElement` = first element of the picked list (VT_UNKNOWN), only
  when something was picked; `ButtonPressed` (VT_I4): 0 = nothing / cancelled (flag 0x2),
  1 = left (flag 0x1, or default), 2 = middle (flag 0x10); when the picked item is of kind 2
  its own button query maps 0 -> 1, 1 -> 2. `ModifierPressed` (VT_I4) bit 1 = Shift (flag 0x4),
  bit 2 = Ctrl (0x8), bit 4 = Alt (0x80). No pick -> both outputs 0, `PickedElement` unset.
- Not undoable (Undo/Redo stubs).

### `PickObject`: SPEC

Same task and code as `PickElement`. `SelFilter` arrives as a string (default
`{1128E000-DBE2-11d2-8BCF-00AA006130EF}:object`) and is converted by the argument handler to
the filter object. It has no `SelRegionMode` argument, so the region mode stays 0 and the
ambient value is untouched.

### `GetNumberOfKnots`: SPEC

**Wire contract**
- UnPackArg: `InputObj` (interface `0x18009bcf8`), failure returned.
- Do: at the current time asks the object for its curve geometry (interface `0x18009d4c8`);
  failure returned; no geometry -> `0x80004002`. Stores the knot count.
- RePackArg: `NbItems` = knot count as VT_I4 (default 0).

### `GetCurvePercentageAtKnotIndex`: SPEC

**Wire contract**
- UnPackArg: `InputObj` (`0x18009bcf8`), `Index` as unsigned long.
- Do: gets curve geometry at the current time; if `Index` < knot count, reads the knot's
  parameter (geometry method 0xf0) and converts it to a length percentage (method 0xd0);
  if `Index` is out of range nothing is computed and the output stays 0.0 (no error raised).
- RePackArg: `Percentage` VT_R8.

### `EnumElements`: SPEC

**Wire contract**
- UnPackArg: `InputObj` (`0x18009de88`), `EnumChildren` boolean (default true),
  `Capabilities` unsigned long (default 524288 = 0x80000).
- Do: no object or no output slot -> `0x80004003`. `EnumChildren` true -> calls the import at
  `0x18009b0d0` (inferred `SIEnumElementChildren`), false -> `SIEnumElementParents`
  (`0x18009b0c8`), each with (object, Capabilities, &result list).
- RePackArg: `Value` = result list (VT_UNKNOWN) when non-NULL.

### `Obstalce Pop-up Menu`: SPEC

(Scripting name spelled so in the registry.)
**Wire contract**
- UnPackArg: `EmbeddedCommand` variant (VT_UNKNOWN) is kept; records the foreground window
  and cursor position; if the window under the cursor is a `BUTTON`, the menu anchor becomes
  the button's right edge, one third down its height. `InputObjs` list (`0x18009dfa8`);
  an empty list returns 1 (S_FALSE, nothing to do).
- Do: fills a popup menu with the obstacles connected to the input (via the object's
  simulation operators `F3DGetSimulationOps`, then for objects whose class id is one of three
  obstacle-related classes `3ee7b553-394f-11d3-…`, `71240cfd-8df9-11d3-…` (kind 2) or
  `c41aa2c3-b58a-11d4-…` (kind 3), their connected items), shows it with
  `TrackPopupMenu(TPM_RETURNCMD|TPM_RIGHTBUTTON)`; when an entry is chosen, runs command
  `InspectObj` (`dda48140-134f-11d1-8062-00a024c78ee3`) on it with `Keywords = "General"`
  (the keywords are set only when the task's mode field is 0). Then marks itself done and
  notifies the embedded command (its slot 0x58).
- Not undoable.

### `GetExternalReferences`: SPEC

**Wire contract**
- No inputs. Do calls the worker with the output slot; NULL slot -> `0x80004003`.
- Worker: creates the result list (`0x18009df78`); enumerates objects from a global service
  (`0x18009d068` / `0x18009d058`); for each object that exposes the resolution interface
  `0x18009d6b8` and whose methods 0x130 / 0x138 say it is not being switched and has
  resolutions, adds an element reference to the list; if the object is a model
  (`0x18009d288`) whose referenced-model sub-object (`0x18009de18`) is active, the model
  itself (looked up by `0x1800b7820`) is added instead. Uses
  `F3DSetSwitchingResolutionGlobalFlag(1/0)` around each query.
- RePackArg: `Value` = list (VT_UNKNOWN). Undo/Redo stubs.

### `UpdateExternalReference`: SPEC

**Wire contract**
- UnPackArg: `Target` (`0x18009de88`), `InputObjs` = comma separated list of reference
  paths (default empty).
- Do: worker(Target, paths, undoFlag). Empty path list -> returns 1 (no change). On the first
  undoable call, captures the current paths into the undo string (helper class
  `0x18009cd68`). Each path is validated as an element reference; an invalid one logs
  `Invalid reference [<path>]` (severity 2) and returns that error. If the target lacks the
  sub-object `0x18009cb28`, logs `XSITASKS` id `0x42f` (info) and succeeds. Otherwise finds
  the resolution object (through the referenced-model branch `0x18009c9b8` or directly
  `0x18009d6b8`); the number of paths must equal its resolution count, then entry i gets path i.
  Not found / count mismatch -> `0x80070057`.
- Undo: re-applies the saved old paths (flag 0); Redo: re-applies the new paths. Both return
  `0x8000FFFF` if the Do never ran with undo enabled. `Value` output is not written
  (registry default false).

### `ImportCustomFile`: SPEC

**Wire contract**
- UnPackArg (no failures propagated): `FileName` string, `Target` (`0x18009bcf8`),
  `Reference` boolean, `Name` string, `Frame` as a long (registry declares an object;
  binary reads a long), `UserData` variant.
- Do -> worker: extension = text after the last `.`; `SIValidateFile` failure logs message
  `0x11c` and returns `0x80070057`; no custom converter for event `0x20510026` and that
  extension -> logs `XSITASKS` `0x426` + extension, `0x80070057`. Target NULL -> current
  scene root. If the target is a referenced model that is still queued
  (`C3DRefModelInstaller`), property propagation is allowed on it for the import and
  suspended afterwards. Fires file event `0x20510015` (pre, file-type 0x1f, Reference, Name);
  a `0x562E80C7` answer aborts with that code; else fires the converter event
  `0x20510026` by name with (file, 0x1f, Frame, UserData), then post event `0x20510016`.
- Not undoable.

### `System`: SPEC

**Wire contract**
- UnPackArg: `Pathname` string.
- Do: worker runs the C runtime `system()` with the narrow-converted string. If no command
  processor exists, or `system` returns < 0 (message from `strerror(errno)`), raises error
  `0x80070057` with that text (`SIRaiseError`) and returns `0x80004005`. Do maps any
  non-failure to 1.
- RePackArg: `Value` = exit code as VT_R8 (double).

### `SetReferencePlane`: SPEC (promoted 2026-11-19, batch 12; see "Batch 12 answers")

**Wire contract**
- UnPackArg: NULL context -> `0x80004003`; `Target` (`0x18009de88`); `InputObj` list, first
  element stored.
- Do/Redo -> worker(Target, element, undoFlag). The target must expose the reference-plane
  property `cc0be455-09b0-11d4-b7e0-0008c7a011a6`; NULL element -> returns 1. Element kind 2
  (object): uses its global transform at the current time and its bounding box; plane half
  sizes = half the box extents, each at least 2.0. Element kind 6 (component): builds the
  plane axes from the component frame. The property is then set by helper `0x1800509f0`
  (matrix, active flag 1, sizeU, sizeV, 1). With undo on, the previous plane matrix, sizes and
  flags are saved first.
- Undo: re-applies the saved matrix / sizes / flags.
- Missing: other element kinds and the full component-frame path of the worker were not read.

### `CrashXSI`: SPEC

Shared dispatcher row 11. If environment variable `XSI_SUPPORT_CRASH_XSI_COMMAND` is set,
raises `EXCEPTION_ACCESS_VIOLATION` (`0xC0000005`) via `RaiseException`; otherwise does
nothing. Returns 1.

### `DumpMemoryStats`: SPEC

Row 12. Calls `CSISlabAllocator::DumpAllStats` with an output sink that writes to the script
log. Returns 1.

### `GetUnevaluatedPrimitiveForConstructionHistory`: SPEC

Row 13. **Wire contract**: `X3DObject` (`0x18009bcf8`), failure returned. Gets the object's
primitive (`0x1800b7820`); creates a helper (`0x18009cbd8` / `0x18009cbf8`) and asks it for the
unevaluated primitive at the construction-history base; `Value` = that object (VT_UNKNOWN), or
an empty VT_DISPATCH when the object has no primitive. Returns 0.

### `IsSoftimageDevDrop`: SPEC

Row 15. `Value` (boolean as VT_I4) = 1 when install path kind 3 is available and the file
`<path>\Application\test\cscmd.dll` exists (folder `Application\test` checked first), else 0.

### `SIGetHelpPath`: SPEC

Row 5. `Value` = `DsGetHelpFilesPath` result (string, up to 260 chars); failure of that call is
returned.

### `ICEOfflineRefresh`: SPEC

Row 16. Calls `F3DFlushDirtyServiceModeObjects`. Returns 0.

### `UnloadAddonLib`: SPEC

Row 0. **Wire contract**: `FileName` string. Looks the file up in the plugin manager
(`0x18009d788` / `0x18009d7a8`); if the plugin is in state 3 (inferred: in use / cannot
unload) logs `simsgcat` 0x118 (info) with its name and returns 1; else `SIUnloadPlugin`;
failure logs `simsgcat` 0x127 (severity 2) and returns the error. Argument browser (row `+8`):
filter `.dll|.so`, `Library (*.dll)|*.dll||`, start folder = install path 1, title
`Select library to unload`.

### `ReloadAddonLib`: SPEC

Row 1. Same as `UnloadAddonLib` but uses `SIReloadPlugin`; busy message `simsgcat` 0x11d,
failure message 0x128; browser title `Select library to reload`.

### `UnloadAllAddonLibs`: SPEC

Row 3. For every plugin library (`SIGetPluginLibraryCount` / `SIGetPluginLibraryInfo`) not
known to the plugin manager, `SIUnloadPluginLibrary` (failure logs 0x127). Then for every
plugin in the manager: state 3 -> info 0x118; otherwise `SIUnloadPlugin` (failure logs
0x127). Returns 0 (or the manager query failure).

### `ReloadAllAddonLibs`: SPEC

Row 4. Same walk as `UnloadAllAddonLibs` with `SIReloadPluginLibrary` / `SIReloadPlugin`,
messages 0x11d / 0x128.

### `UnloadAllCOMLibs`: SPEC

Row 2. Calls `CoFreeUnusedLibraries`. Returns 0.

### `TestPluginHost`: SPEC-PARTIAL

Registered on CLSID `b5097d5a` but its command GUID `a4caffae-2bdd-486d-8739-47a0f70d1bd9`
has no row in the dispatch table and does not occur in `tasks.dll`; invoked through this
handler it fails with `0x80020003` (DISP_E_MEMBERNOTFOUND). The `Destroy` argument is never
read here. Missing: whatever implementation (if any) exists elsewhere.

### Note on the shared-CLSID commands

All shared-CLSID commands are executed directly from the exec context (no Undo/Redo, no
UnPack/RePack split); outputs are written with `C3DExecContextHelper::SetArgValueFromName`.

## Open questions

- `EnumElements` children import at `0x18009b0d0` is named from its neighbour only; confirm
  the import name.
- `SetReferencePlane` worker branches beyond element kinds 2 and 6.
- `PickElement` "can interact" service `0x18009df38` / `0x18009df08`: identity not confirmed.
- `TestPluginHost`: no implementation in `tasks.dll`; check whether another DLL registers it.
- `ImportCustomFile` `Frame` is read as a long although the registry describes an object
  argument; the argument handler conversion was not read.

## Batch 12 answers (PR #183 questions)

Run: 2026-11-19, si-analyst worker, batch 12, REA + Ghidra 12.1.4 on `tasks.dll` (same sha256).
Behaviour only; no decompiler output reproduced. Message texts: `data/si/dict.json` `XSITASKS`.

**Q1 — XSITASKS `0x42f` (1071) and `0x128` (296).** Open. Neither id is in the 41-entry
`XSITASKS` table of `data/si/dict.json`, and `tasks.dll` holds only the table name (texts are
loaded at run time with `DictLoadIdstring`). The dictionary file in the install was not
reachable this run (install folder not connected). Wire: keep a placeholder text, but use the
attested severities: `0x42f` is logged with severity **4** (UpdateExternalReference, see Q3);
`0x128` severity as in the reload / unload notes (2).

**Q2 — knot count and percentage scale.** (`GetNumberOfKnots` Do `0x18006db30`,
`GetCurvePercentageAtKnotIndex` Do `0x18006ded0`.)
- Both ask the input for its curve-list geometry at the current time (interface
  `e14a9f51-6cc4-11d1-b79b-00a0243e3694`, `.rdata` `0x18009d4c8`); no geometry -> `0x80004002`.
- Knot count = that interface's count method (slot `0xe0`); `tasks.dll` does no arithmetic on
  it. The knot-index method (slot `0xf0`) returns a pair **(sub-curve index, U)**, so the knot
  index runs over **all sub-curves of the curve list**, and the percentage method (slot `0xd0`)
  takes that pair. Whether the count is the full knot vector or distinct knots is decided in
  the geometry DLL, not here: open. Keep the wire's SDK-vector reading `(inferred)`.
- Percentage: the geometry method's value is written to `Percentage` unchanged (no scaling in
  `tasks.dll`). Scale **0..100** `(inferred)` from the SDK `GetPercentageFromU` convention; it
  is not attested in this DLL.
- Correction: `GetCurvePercentageAtKnotIndex` with `Index >= count` writes nothing (output 0.0)
  and the Do's return code is not set on that path (treat as success, `(inferred)`).

**Q3 — UpdateExternalReference validation** (worker `0x18002be70`). Corrects the B11b contract:
1. `Target` NULL -> `0x80004003`. Empty `InputObjs` -> return 1 (S_FALSE), nothing changes.
2. Undo capture (first undoable call): the current paths are saved before any change.
3. `InputObjs` is split on `,`. Each piece is given to a fresh element-reference object as a
   path string; **any non-zero result (also S_FALSE) means invalid**: logs
   `Invalid reference [<path>]` with severity 2 and returns that code. So the path must resolve
   to an existing scene element; there is no other syntax check.
4. Target is asked for sub-object `0x18009cb28`; **when it is found** (lookup S_OK) the task logs
   XSITASKS `0x42f` (severity 4) and **returns S_OK without changing anything**. (The B11b note
   said "when it lacks"; the branch is taken on a successful lookup.)
5. Otherwise: referenced-model branch (sub-object `0x18009c9b8`, its model found by a typed
   child search) or the target's own resolution object (`0x18009d6b8`). Around the update the
   global "switching resolution" flag is set to 1, then back to 0; the resolution object gets a
   begin call (slot `0x130`), its count (slot `0x138`), one set call per entry
   (slot `0x148`, entry i = path i) and an end call (slot `0x128`).
6. **Count 0** -> nothing set, success. **Path count != resolution count -> return 1 (S_FALSE),
   no change** (not `0x80070057`). Neither branch found -> `0x80070057`.

**Q4 — SetReferencePlane** (worker `0x18004fc30`). Now complete enough for SPEC.
- Target NULL, or Target without the reference-plane property `cc0be455-09b0-11d4-b7e0-0008c7a011a6`
  -> `0x80070057`. NULL element -> 1.
- Element kind (from the element, slot `0x180`): **2 = object**, **6 = component (subcomponent of
  a geometry)**, **7 = component given through a cluster-style sub-element**; any other kind ->
  returns 1, no change.
- Kind 6 / 7: a component-frame helper returns an origin and three axis vectors with three
  validity flags. When all three are valid the plane matrix is rows {axis 1, axis 2, axis 3,
  origin (w = 1)}; otherwise identity. Then the object path below runs with that matrix.
- Object path (all kinds): the owning object's global transform at the current time is
  combined (component matrix x global). The object's bounding box (object space,
  `(inferred)`) gives **sizeU = (maxX - minX) / 2, sizeV = (maxZ - minZ) / 2**, each clamped to a
  minimum of **2.0**. (Confirms the wire's U = X extent, V = Z extent; values are half extents.)
- The property is set with (matrix, active = 1, sizeU, sizeV, 1).
- Undo data (undoable call): target and element references, the property's previous matrix,
  flag, sizes and second flag. Return: 0 on the undoable call, 1 when called without undo.

**Q5.**
- `EnumElements` Capabilities bits: passed unchanged to the imported enumerators; their meaning
  is not in `tasks.dll`. Open (default `0x80000` stays).
- Obstacle pop-up class mapping: no new reading; the three classes and kinds 2 / 3 in the
  contract above stand.
- `ImportCustomFile` `Frame`: read with the generic "long" argument getter (variant converted
  to a 32-bit integer by the exec-context helper; `(inferred)` OLE conversion, so a double is
  rounded). A missing `Frame` leaves the constructor value.
- `TestPluginHost`: still not found in `tasks.dll`; open.

Status after this run: `SetReferencePlane` **SPEC**; `UpdateExternalReference` stays SPEC with
the corrections in Q3. `TestPluginHost` stays SPEC-PARTIAL.
