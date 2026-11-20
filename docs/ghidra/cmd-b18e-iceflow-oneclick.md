# CMD-B18e: OneClick "Send To Maya / 3ds Max / Mudbox" commands (`iceflow.dll`)

Row: **CMD-B18e**. Status: **SPEC** for 7 commands (`OneClickGetState`, `OneClickGetStatusText`, `OneClickSelectObjects`,
`OneClickSendToMayaSelectPreviousObjects`, `OneClickSendTo3dsMaxSelectPreviousObjects`,
`OneClickSendToMudboxSelectPreviousObjects`, `OneClickSetup`), **SPEC-PARTIAL** for 12 (the send commands,
`OneClickSendTo`, `OneClickSendToMax`, `OneClickGetRemoteAppName`).
Run: 2026-11-20, si-analyst worker, unattended, batch 18 (binary first, REA + Ghidra 12.1.4)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced; behaviour is
described in my own words.

## 1. Source

| Binary | bytes | sha256 (prefix) | export timestamp |
|---|---|---|---|
| `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\Plugins\iceflow.dll` (DLL name `ICEFlow.dll`, PE32+ amd64, base `0x180000000`) | 491336 | `a01733f6` | 1442478260 |

Source files named in trace strings: `OneClick.cpp`, `ICE_Workflow.cpp`, `Mudbox_Workflow.cpp`, `OneClick_Manager.cpp`,
`OneClick_Helper.cpp`, `OneClick_SendBack.cpp`, and the Autodesk Synergy library `synOneClick_0.23.0`
(`synOneClickInterAppHandler.impl.h`, `synOneClickMudbox.impl.h`, `synOneClickICE.impl.h`).

Functions read (image addresses):

| Address | Role (my name) |
|---|---|
| exports `0x180023be0`…`0x1800277b0` | the 19 `_Execute` handlers (see table 2); `_Init` `0x180023d60`, `0x180025bc0`, `0x1800259f0` (shared by SelectObjects / SendToMax / Setup), `0x180027640` |
| `0x1800429f0` | OneClickManager singleton accessor |
| `0x180013740` | ICEWorkflow singleton accessor (Maya / 3ds Max path) |
| `0x180020280` | MudboxWorkflow singleton accessor |
| `0x18003a190` / `0x18003a1a0` / `0x180038a00` | remote-app name constants `"Maya"` (`0x18005e0d8`), `"Mudbox"`, `"3ds Max"` |
| `0x18003a4c0`, `0x18003a920`, `0x18003aa00`, `0x180022c20` | manager: remote app name, "connected" test (link state == 2), busy flag, status text |
| `0x180019ba0` / `0x18001a810` / `0x18000e840` / `0x180018300` | ICEWorkflow SendNewScene / UpdateCurrentScene / AddToCurrentScene / SelectPreviousObjects |
| `0x180016270` | ICEWorkflow::PrepareToSend |
| `0x180018400` | ICEWorkflow::SendBack (used for 3ds Max) |
| `0x180021d20` / `0x180021ec0` / `0x1800200e0` / `0x180021c20` | MudboxWorkflow SendNewScene / UpdateCurrentScene / AddToCurrentScene / SelectPreviousObjects |
| `0x180020b10` | MudboxWorkflow::PrepareToSend |
| `0x180043700` / `0x1800438a0` | manager: remember selection as text / restore it |
| `0x180042cf0` | OneClickManager::GetTempFileNamePath |
| `0x1800420a0` | OneClickManager::ExportFBXFile |
| `0x18003c820` | Synergy OneClickInterAppHandler::raiseRemoteAppWindow |
| embedded VBScript strings `0x180055c60`…`0x180058ea8` | `OneClickExportFBX`, `MudboxImportFBX`, `ICEFlowImportFBX`, `SetupOptionalPanelForMudbox`, `SetOneClickStatus`, `UpdateOneClickStatus`, `OneClickSelectAll` |

Not read: `XSILoadPlugin` (`0x180027b60`, menu registration), the events (`OneClickStartup/ProcessEvents/NewScene/
SceneOpen/ProjectChange_OnEvent`), `0x18003a310` (name lookup), `0x18003d550` (send message), `0x180044980` and
`0x180022230` (message builders), the ICE gather / cache helpers called from PrepareToSend (`0x1800113a0`,
`0x180019d50`, `0x180014150`, `0x18000e9f0`, `0x180011f00`, `0x180018050`, `0x180012ce0`, `0x180013540`,
`0x180015820`, `0x180011520`), `0x1800417c0` (cache-dir creation), `0x180043e60` / `0x180043c20` / `0x1800437a0` /
`0x180043950` / `0x1800441c0` (status, progress bar, show-state helpers), `0x1800106e0`, `0x18000f030`, `0x180012440`,
`0x1800137c0`, `0x1800121c0`, `0x180013bc0` (SendBack steps).

## 2. Handler table

| Command | handler address | Status |
|---|---|---|
| `OneClickGetRemoteAppName` | `0x180023be0` | SPEC-PARTIAL |
| `OneClickGetState` | `0x180023ed0` | SPEC |
| `OneClickGetStatusText` | `0x180024400` | SPEC |
| `OneClickSelectObjects` | `0x180024e50` | SPEC |
| `OneClickSendTo3dsMaxAddToCurrentScene` | `0x180024f40` | SPEC-PARTIAL |
| `OneClickSendTo3dsMaxSelectPreviousObjects` | `0x1800251b0` | SPEC |
| `OneClickSendTo3dsMaxSendAsNewScene` | `0x180025400` | SPEC-PARTIAL |
| `OneClickSendTo3dsMaxUpdateCurrentScene` | `0x180025670` | SPEC-PARTIAL |
| `OneClickSendToMax` | `0x1800258e0` | SPEC-PARTIAL |
| `OneClickSendToMayaAddToCurrentScene` | `0x180025ac0` | SPEC-PARTIAL |
| `OneClickSendToMayaSelectPreviousObjects` | `0x180025d30` | SPEC |
| `OneClickSendToMayaSendAsNewScene` | `0x180025f80` | SPEC-PARTIAL |
| `OneClickSendToMayaUpdateCurrentScene` | `0x1800261f0` | SPEC-PARTIAL |
| `OneClickSendToMudboxAddToCurrentScene` | `0x180026460` | SPEC-PARTIAL |
| `OneClickSendToMudboxSelectPreviousObjects` | `0x1800266b0` | SPEC |
| `OneClickSendToMudboxSendAsNewScene` | `0x180026900` | SPEC-PARTIAL |
| `OneClickSendToMudboxUpdateCurrentScene` | `0x180026b50` | SPEC-PARTIAL |
| `OneClickSendTo` | `0x1800274c0` | SPEC-PARTIAL |
| `OneClickSetup` | `0x1800277b0` | SPEC |

The DLL also exports `OneClickSendToMudbox_Execute/_Init` (`0x180026da0` / `0x180027190`), which is **not** in
`commands_full.json` (not read; (inferred) a legacy or unregistered entry point).

## 3. Shared model

### Registration
Every `_Init` takes the command from the context and sets two capability flags: `0x800000` (siNoLogging) **true** and
`0x40000` **false** (observed on the shared Init `0x1800259f0`; the others make the same two calls, values assumed
identical (inferred)). Only `OneClickSendTo` adds an argument: `RemoteApp`, default an empty CValue. No command is
undoable; none sets a return value except the three `OneClickGet*` commands (attribute `ReturnValue`).

### Transport
Not a file/pipe protocol written by the plug-in itself: the link is Autodesk **Synergy "OneClick"** (`SynHub` hub,
import `SynHub_AppLink_startServerOnPort`), wrapped in `Synergy::OneClickInterAppHandler`. Strings: `port: `,
`Could not get network port.  Will use local one instead.`, `Connecting to a specific server port `,
`Connection is not initiated, and cannot be started.` Message classes: `OneClickDCCToICEMessage` /
`OneClickICEToDCCMessage` (Maya / 3ds Max), `OneClickDCCToMudboxMessage` / `OneClickMudboxToDCCMessage` (Mudbox);
message kinds `OneClickICESend`, `OneClickICESendToDCC`, `OneClickMudboxSend`, `OneClickMudboxSendToDCC`,
`OneClickBusyState`, `OneClickAcknowledge`, `OneClickExecute`; field name `MudboxScenePath`. The payload carries the
temp FBX path plus flags (new-scene, add-to-scene) (inferred from the builder arguments). Encoding/port numbers were
not read.

### Remote-app names (exact strings)
`"Maya"`, `"3ds Max"` (with the space), `"Mudbox"`.

### Temp files
- FBX: `GetTempFileNameA(dir, prefix, 0)` where dir = a manager-held folder or, if empty, `GetTempPathA`; the
  returned name's last 4 characters (`.tmp`) are cut and `.fbx` appended. Prefix `ICE` (Maya / 3ds Max) or `MBX`
  (Mudbox, dir always `%TEMP%`). Because the unique number is 0 the API also creates the `.tmp` file, which stays
  (inferred). Empty result → abort (trace `File name length is empty`).
- ICE cache folder (Maya / 3ds Max only): `CUtils::BuildPath(<workflow folder>, "ITXXXXXX")` then created
  (mktemp-style template; string `mkstemp failed`). Failure → abort (trace `Cannot write cache files`).
- Environment variable `ONECLICK_KEEP_TEMP_FILES` (read by the manager; (inferred) keeps the temp files).

### FBX export (embedded VBScript `OneClickExportFBX(fname, setName, exportSelection, remoteAppName)`)
Run through the plug-in's script helper with 4 arguments: path, group/set name, `"true"`/`"false"`, app name.
1. If the scene root has `ExportFBXOptions`, rename it `OneClickBackupFBXExportOptions`.
2. `FBXExport "options"`, `FBXExportSelection exportSelection`, `ExportFBXOptions.ExportOneClickMode` = 1,
   `GeometryCacheFile` = False; when a set name is given (inferred condition) `GeometryCacheFile` = True and
   `FBXExportGroupAsCache setName`.
3. Remote app `"Maya"`: `ExportVisibilityAsShow` = `ICEFlowState.ExportVisibilityAsShow`; otherwise False.
4. `FBXExport fname`; delete `ExportFBXOptions`; rename the backup back to `ExportFBXOptions`.
Option semantics: same as `FBXExport` / `FBXExportSelection` / `FBXExportGroupAsCache` in `cmd-01a-fbx.md`
(`ExportOneClickMode` row there). A script result of `0x80040200` (as int, −0x7ffbfe00) means "user cancelled" → export
reports failure.

### UI strings
All user text is `XSI::CUtils::Translate(<id>, "XSIPLUGINUI")`: `0x1c6a` status at start of a send, `0x1c63` progress-
bar caption, `0x1c65` prompt template (printf `%s` = remote app name), `0x1c69` prompt title, `0x1c6c` status at end,
`0x1c55` / `0x1c66` / `0x1c67` SendBack error box title / text / log line, `0x1c6d` / `0x1c6e` state strings. Texts
themselves live in the XSIPLUGINUI dictionary (not read).

### Status view
VBScript `SetOneClickStatus` / `UpdateOneClickStatus` drive the layout view `sendtostatus` (NetView url
`$XSI_HOME/Addons/NetView_Database/OneClickStatus.html`); `SetupOptionalPanelForMudbox` shows optional panel
`sendtostatus` and sets viewport views (`explorer`, `Render Tree`, `ICE Tree`, layout `maximize:B`).

### Remembered selection
At the start of every PrepareToSend the manager stores `Selection.GetAsText()` in one process-wide string; the
"SelectPreviousObjects" commands put it back with `Selection.SetAsText`.

## 4. Wire contract

### `OneClickSetup` (SPEC)
No args, no return value. Find the `ICEFlowState` property on the active scene root; if absent, `AddProperty
("ICEFlowState")` on the scene root and look it up again. Then `InspectObj` with that property (default inspect mode).
`ICEFlowState` (defined by `ICEFlowState_Define` `0x180022c70`, not read) holds at least `CrowdExportType` and
`ExportVisibilityAsShow`.

### `OneClickGetState` (SPEC)
No args; returns a string. Not connected (link state ≠ 2) → `""`. Connected and not busy → Translate `0x1c6d`;
connected and busy (manager flag) → Translate `0x1c6e`.

### `OneClickGetStatusText` (SPEC)
No args; returns the manager's current status string (one process-wide string, (inferred) the last text set by the
status helper, e.g. `0x1c6a` / `0x1c6c`).

### `OneClickGetRemoteAppName` (SPEC-PARTIAL)
No args; returns the name of the remote application of the current link as a string (from the link handler; lookup
`0x18003a310` not read; (inferred) `"Maya"`, `"3ds Max"`, `"Mudbox"` or empty).

### `OneClickSelectObjects`, `OneClickSendToMayaSelectPreviousObjects`, `OneClickSendTo3dsMaxSelectPreviousObjects`, `OneClickSendToMudboxSelectPreviousObjects` (SPEC)
No args, no return value. Replace the selection with the remembered selection text (§3); nothing is sent. All four
behave identically (the Maya / Max / SelectObjects entries go through ICEWorkflow, Mudbox through MudboxWorkflow; both
call the same manager restore). Before any send the remembered text is empty, so the selection is cleared (inferred).

### ICE send: `OneClickSendToMaya*` and `OneClickSendTo3dsMax*` SendAsNewScene / UpdateCurrentScene / AddToCurrentScene (SPEC-PARTIAL)
No args, no return value. App = `"Maya"` or `"3ds Max"`. Flags (newScene, addToScene): SendAsNewScene (1, 0),
UpdateCurrentScene (0, 0), AddToCurrentScene (0, 1).
PrepareToSend:
1. Status = Translate `0x1c6a`; remember the scene's `FileName`; clean previous workflow data (trace `CleanData failed`
   is only logged).
2. Progress bar with caption `0x1c63` (incremented between steps).
3. Remember the selection (§3). If the selection is empty: `MsgBox(sprintf(0x1c65, app), OK/Cancel (1), title 0x1c69)`;
   Cancel (2) → remove progress bar, abort (trace `Aborting the Send operation as user does not want to send the entire
   scene`); OK → run VBScript `OneClickSelectAll("")` (selects everything) and continue.
4. Gather the time span (scene in/out into the workflow), further gather step `0x180019d50`.
5. Create the cache folder `…\ITXXXXXX` (§3) — failure aborts; make the temp FBX name with prefix `ICE` — empty aborts.
6. Read `ICEFlowState.CrowdExportType` on the scene root (0 when the property is missing) and run
   `CrowdFBXPlot_ExportMode(<type>)` (see `cmd-b13e-small-plugins-binary.md`).
7. ICE gather / cache steps (not read), then `OneClickExportFBX(fbx, <group name>, "true", app)` (§3; the ICE path always
   exports the selection).
8. Set the cached ICE attribute list to `PointVelocity,Age,AgeLimit,Orientation,AngularVelocity,Position,Id,Color,Size,
   Mass`; write the caches (not read).
9. Build the DCC→ICE message (paths + addToScene flag); remove the progress bar; show state; status = Translate `0x1c6c`.
   Any failed step counts an error; PrepareToSend succeeds only with zero errors.
On success: raise/launch the remote app window through the link (`Connection is not initiated, and cannot be started.`
if impossible), then send the message to `app`. On failure nothing is sent; no error is returned to the caller.

### `OneClickSendToMax` (SPEC-PARTIAL)
No args, no return value. ICEWorkflow::SendBack with app `"3ds Max"` (answers a workflow started from 3ds Max; trace
`We cannot initiate the workflow from XSI for 3ds Max` on the failure path).
1. Status `0x1c6a`; read scene `FileName`; clean data; progress bar `0x1c63`; a chain of gather/cache steps (time span
   etc., not read), each failure counted.
2. No failures but no ICE tree recorded → `MsgBox(sprintf(0x1c65, app), title 0x1c55)`, remove progress, abort (trace
   `Aborting the Send operation as there are no ICE Tree to cache`).
3. No failures → two further write steps, build an ICE→DCC message with addToScene 0 and send it to `"3ds Max"` (no
   raise-window call here).
4. Failures → MsgBox text `sprintf(0x1c66, app)` titled `sprintf(0x1c65, app)`, and `LogMessage(0x1c67)`.
5. Remove progress bar; status `0x1c6c`.

### Mudbox send: `OneClickSendToMudboxSendAsNewScene` / `UpdateCurrentScene` / `AddToCurrentScene` (SPEC-PARTIAL)
No args, no return value. App `"Mudbox"`; flags as for ICE: (1, 0), (0, 0), (0, 1).
1. Status `0x1c6a`; remember `FileName`; progress bar `0x1c63`; gather time span; remember the selection.
2. Empty selection → same OK/Cancel prompt as the ICE path (text `sprintf(0x1c65, "Mudbox")`, title `0x1c69`);
   Cancel aborts; OK continues with exportSelection = false (whole scene; `OneClickSelectAll` is not run here).
   Otherwise exportSelection = true.
3. Temp FBX with prefix `MBX` in `%TEMP%`; empty → abort.
4. `OneClickExportFBX(fbx, "", exportSelection, "Mudbox")` (no geometry cache; visibility-as-show False).
5. Build the DCC→Mudbox message (newScene, fbx path, addToScene); remove progress; show state; status `0x1c6c`.
6. Raise/launch Mudbox through the link and send the message.
Mudbox's reply is imported by VBScript `MudboxImportFBX(mode, fname, textures)`: backs up `ImportFBXOptions` as
`OneClickBackupFBXImportOptions`, `FBXImport "options"`, `FBXImportMode mode`, `FBXImportForceNormEnvelope true`,
`ImportOneClickMode` = 1, then `ImportOneClickMerge` / `ImportOneClickAdd` / `ImportMudboxMergeTexture` all 1 or all 0
(by the textures/merge choice, (inferred)), `FBXImport fname`, delete and restore (same as `FBXImport` in `cmd-01a`).

### `OneClickSendTo` (SPEC-PARTIAL)
Arg `RemoteApp` (string; default empty). No return value. Compares the text exactly:
`"Mudbox"` → Mudbox UpdateCurrentScene; `"3ds Max"` → `OneClickSendToMax` behaviour (SendBack); anything else
(including `"Maya"` and empty) → ICE UpdateCurrentScene with that text as the remote app name.

## 5. Open questions
- XSIPLUGINUI texts for ids `0x1c55`, `0x1c63`, `0x1c65`–`0x1c6e`.
- Synergy message encoding, hub port, how the remote app is launched; `0x18003d550`, `0x180044980`, `0x180022230`.
- ICE cache file format and which ICE trees/attributes are gathered (helpers listed in §1).
- The exact second capability flag `0x40000` name; menus from `XSILoadPlugin`; the unregistered `OneClickSendToMudbox`.
- Who sets the status string read by `OneClickGetStatusText`, and the event handlers that receive replies
  (`OneClickProcessEvents_OnEvent`, `ICEFlowSendBack`).

## 6. Corrections for the wire agent
(`src/commands/iceModule.ts` lines 167–220, read-only grep.)
- All OneClick commands should be registered with siNoLogging (not logged) and none needs an args list except
  `OneClickSendTo(RemoteApp)` (default empty, not `null` semantics of "keep previous").
- Remote-app names are `"Maya"`, `"3ds Max"` (with a space), `"Mudbox"`; current code uses `'3dsMax'` and `'Remote'`.
- `OneClickGetState` returns `""` when not connected and a translated text otherwise, not internal words like `idle` /
  `send_new`; `OneClickGetRemoteAppName` returns the linked app's name, not the last command's target.
- `OneClickSelectObjects` and the three `*SelectPreviousObjects` commands restore the selection saved at the last send
  (`Selection.SetAsText`) and return nothing; current code returns the selected names.
- Send commands return nothing (code returns the state object) and, with an empty selection, prompt OK/Cancel before
  sending the whole scene.
- `OneClickSendTo` dispatches by name to the *Update* variant (Mudbox / ICE) or to SendBack for `"3ds Max"`.
- `OneClickSetup` creates/inspects `ICEFlowState` on the scene root; it does not set a status string.
