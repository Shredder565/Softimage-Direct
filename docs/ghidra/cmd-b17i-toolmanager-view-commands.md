# CMD-B17i: remaining "toolmanager" handler families (Escape Pick Session, Reset / Frame / Grid / Back faces, manipulator cycling) and answers to PR #195 Q1–Q7

Row: **CMD-B17i** (closes the `toolmanager.dll` part of CMD-B16-NEXT). Status: **SPEC** 10 names, **SPEC-PARTIAL** 3 names
(per command below).
Run: 2026-11-20, si-analyst worker, unattended, batch 17 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Key finding: of the nine handler CLSIDs in the task, only `0461b2b3` and `0461b2bc` are served by `toolmanager.dll`
(its `DllGetClassObject` has 11 compares, none for `0461b2b4/b6/c0/c1/c2/c4`). The others live where the registry
`handler_dlls` field says: `0461b2b4`, `0461b2b6`, `0461b2c1`, `0461b2c2` in **`vm.dll`**, `0461b2c0`, `0461b2c4` in
**`manipmgr.dll`**. `0461b2b4` (Reset) and `0461b2c1` (Hide Back Facing Polygons) were already read in CMD-B11h
(`cmd-b11h-vm-view-commands-b10-confirmations-binary.md`) and are reused here.

## Sources

| File | bytes | sha256 (prefix) | read |
|---|---|---|---|
| `Application\bin\toolmanager.dll` | 180040 | `aa91046ebfddd37f` | partly (handlers `0461b2b3`, `0461b2bc`, tool manager + channel methods, dispatcher `7c037c30`) |
| `Application\bin\vm.dll` | – | `4c869d2174ba6a04` | partly (`DllGetClassObject`, `0461b2b6`, `0461b2c2` factories / tasks) |
| `Application\bin\manipmgr.dll` | – | `bdcd1b32cce66da4` | partly (`DllGetClassObject` (3 classes), `0461b2c0`, `0461b2c4` tasks) |
| `Application\bin\viewinteraction.dll` | – | `1c94d24c3bd9bc01` | byte search only + Dolly tool class category (Q1, Q7) |
| `data/command_registry.json` | | | names, GUIDs, args, defaults |

Each binary was opened alone and closed before the next.

## Handler table

| Command | file | procedure (factory ctor → create → task ctor; Do; UnPackArg) | Status |
|---|---|---|---|
| `Escape Pick Session` {45af19b0-e8d8-11d0-96c1-00a024191bac}, flags 8, no args | toolmanager.dll, handler `0461b2b3` | factory vtable `0x180021de8` → create `0x1800159a0` → ctor `0x1800030f0` (0x48); task vtable `0x18001a6b0`, ITask `0x18001a700`; Do = ITask slot 5 `0x180003220`; UnPack/RePack stub `0x180004250` | SPEC |
| `Escape Pick Session` {41ee76f1-99cd-11d1-8049-00a0243e2717}, flags 4, no args | toolmanager.dll, handler `0461b2bc` | factory `0x180021f00` → create `0x180015b60` → ctor `0x180005060` (0x38, base `0x1800049b0`); vtable `0x18001d6c0`, ITask `0x18001d720`; Do = ITask slot 3 `0x180005110`; UnPack = primary slot 9 `0x180004b60`; worker = dispatcher slot 7 `0x180007fd0` | SPEC-PARTIAL |
| `Reset Camera` (CameraReset) {56aa96f7-…}, `Reset (All 3D Views)` (ResetAllViews) {9d5809b0-81d4-11d3-b7c2-0008c7a011a6} | vm.dll, `0461b2b4` | see CMD-B11h (`0x18000d7b0` → `0x18000f730` → `0x180001da0`, Do `0x180001f90`) | SPEC (B11h) |
| `Frame Selection` {633b1811-…}, `Frame Selection (All 3D Views)` (FrameSelection) {56aa96f8-…}, `Frame All` {e08564b0-…}, `Frame All (All 3D Views)` (FrameAll) {56aa96f9-…} | vm.dll, `0461b2b6` | factory ctor `0x18000d900` (vtable `0x180043d90`) → create `0x18000f880` → task ctor `0x180003af0` (0x78); vtable `0x18003b170`; Do slot 5 `0x180003e10`; UnPackArg slot 8 `0x1800041e0`; Undo/Redo stub `0x1800073a0` | SPEC |
| `Hide Back Facing Polygons` {782914f0-…} | vm.dll, `0461b2c1` | see CMD-B11h (Do `0x180007b50`) | SPEC (B11h) |
| `Show/Hide Grid` {e56444f0-99a6-11d1-84bf-00aa00135f7b}, no args | vm.dll, `0461b2c2` | factory ctor `0x18000de40` (vtable `0x1800441f0`) → create `0x18000fdc0` → task ctor `0x180007c90` (0x70); vtable `0x18003caa0`; Do slot 5 `0x180007e00`; UnPackArg slot 8 `0x180007110` (view helper init only) | SPEC |
| `Show Next Manipulator` {fa57c6b0-…} (`Next`=True), `Show Previous Manipulator` {f4ae64d0-…} (`Next`=False) | manipmgr.dll, `0461b2c0` | factory `0x18000a060` → create `0x180005340` → ctor `0x180004ab0` (0x30, `Next` default 1); vtable `0x180008d30`, ITask `0x180008d80`; Do = ITask slot 3 `0x180004b70`; UnPackArg primary slot 8 `0x180004d70` | SPEC-PARTIAL |
| `Toggle Manipulator mode` {56aa96fa-…}, no args | manipmgr.dll, `0461b2c4` | factory `0x18000a0d0` → create `0x1800053c0` → ctor `0x180004e40`; vtable `0x180009410`, ITask `0x180009460`; Do = ITask slot 3 `0x180004ef0`; UnPackArg `0x180004980` (manager lookup only) | SPEC-PARTIAL |

Other classes in these DLLs (for the DLL map): `manipmgr.dll` also serves `291f2030-2a0a-11d1-84a4-00aa00135f7b`
(the manipulator manager singleton the two manip handlers query). `vm.dll`'s 25-entry chain is listed in CMD-B11h.

## Shared facts read in toolmanager.dll (needed for the contracts and Q1–Q7)

**Tool manager → channel forwarding** (manager vtable `0x180020460`, interface at +0x18). Every per-class method creates
the class (`SICreateInstance`, iface `0x180020ff8`), reads its category GUID (tool slot +0x60) and forwards to the
channel with that category. A channel is a 0x2a0-ish object (ctor `0x18000b720`, vtable `0x18001f9e0`), category at
+0x240. Mapping manager → channel slot: +0x20 state → 0x68 (`0x18000c3a0`); +0x50 deactivate → 0x98 (`0x18000f150`);
+0x88 activate → 0x88 (`0x18000cfe0`) then 0xb0 set-mode when a mode is passed; +0x90 store fallback → 0xb8
(`0x18000ecf0`); +0xa8 eligibility → 0x100 (`0x18000da00`); +0x68 set mode → 0xb0 (`0x18000e6f0`). No channel for the
category: state E_FAIL (0x80004005), +0x90 E_FAIL, +0xa8 S_FALSE, +0x50 S_FALSE.

**Channel fields**: +0x220 current tool object; +0x78 its record (mode word at record +0x198, activation time at
record +0x190); +0x38 list of earlier tool records (tool history); +0x214 lock flag (set during an interaction,
inferred); +0x250 fallback class ("+0x90 tool"); +0x240 category.

**Default / fallback activation** (`0x18000d2e0`): activates the stored fallback class (+0x250); when it is GUID_NULL,
or when the channel is the default one and preference `Interaction.niltool` is true, it activates the nil tool
`d97e3888-012c-11d6-a2e3-08003658d403` (toolmanager's own tool class) instead; then sets mode 1. It runs when the
first channel is added with no current tool, when +0x90 stores a class while the channel is empty, and at the end of
a deactivate that leaves the default channel empty.

**Constants**: `0x180020d78` = selection tool `11778840-8c5c-11d1-84b5-00aa00135f7b`; `0x180021088` = nil tool
`d97e3888-…`; `0x1800210a8` = command `45af19b0-…` (Escape Pick Session); `0x180021108` = command `41ee76f1-…`
(Escape Pick Session #2); default sticky command class in the dispatcher = `ba315211-9be1-11d0-b6d6-00aa0068bf56`
(dispatcher ctor, +0xc8).

## Wire contracts

### `Escape Pick Session` {45af19b0-e8d8-11d0-96c1-00a024191bac} (handler `0461b2b3`): SPEC
No arguments, nothing unpacked. **Wire contract:** get the current tool of the default category (manager +0x28, key
GUID_NULL). If there is one and its class is Translate `3a711ff0-…`, Rotate `ecbad3a0-…` or Scale `f500bd80-…`, first
store the **selection tool** `11778840-…` as the default channel's fallback (manager +0x90). Then deactivate the
default channel's tool (manager +0x50, key GUID_NULL; see Q4 for what becomes current). If the query returned a
value ≥ 2 (no channel / error) the deactivate still runs. If the query succeeded but there is no tool object, the
command returns E_FAIL (0x80004005) and changes nothing. A failing class query returns that error. Not undoable, no
log, returns nothing to scripts. Effect for the user: Esc ends the current tool; after Translate / Rotate / Scale the
selection tool comes back.

### `Escape Pick Session` {41ee76f1-99cd-11d1-8049-00a0243e2717} (handler `0461b2bc`): SPEC-PARTIAL
UnPackArg reads exec-context word A (context +0x38) into the task and lazily resolves the command-tool dispatcher
(`7c037c30-…`, iface `b86eac06-…`); A is not used afterwards. Do = dispatcher slot 7 (`0x180007fd0`), no arguments.
**Wire contract** (dispatcher state names from Q5):
1. A supra (key-held) command session is active: set the "escaping supra" flag, end the supra session
   (`0x180007f00`: ends it, then re-announces the sticky session with `SI3D_STICKY_COMMAND_ACTIVATED` and makes its
   tool current again, or clears the status bar / cursor when there is none). If that returned S_OK and no sticky
   session exists, fire `SI3D_COMMAND_EXECUTED` for command `41ee76f1-…`.
2. Else a sticky session is active: set the "escaping sticky" flag, end it (`0x180007e00`: ends the sticky session;
   when the dispatcher's "return to default" flag is set it clears status / cursor, else restarts the default sticky
   command class `ba315211-…`). If S_OK and the dispatcher flag +0xa0 is set, fire `SI3D_COMMAND_EXECUTED` for
   `41ee76f1-…`.
3. Afterwards, when no session of either kind remains: tell the host (dispatcher +0x120 object) / restore the normal
   tool (interface at +0x38 slot 12; meaning inferred).
4. No session at all: only step 3. Errors of the inner calls are returned; not undoable, no log.
Gap: the bodies of dispatcher slots +0xd8 / +0x68 / +0xc0 / +0xf0 / +0xf8 (session bookkeeping) were not read.

### `Reset Camera` (CameraReset) and `Reset (All 3D Views)` (ResetAllViews) (`0461b2b4`, vm.dll): SPEC
Same as CMD-B11h §ResetAllViews: args `View` (-1 = active view), `AllViews` (CameraReset false, ResetAllViews true).
Per view: save camera for undo, label "Reset", camera home reset; undoable.

### `Frame Selection`, `Frame Selection (All 3D Views)` (FrameSelection), `Frame All`, `Frame All (All 3D Views)` (FrameAll) (`0461b2b6`, vm.dll): SPEC
UnPackArg (`0x1800041e0`) initialises the view-manager helper (fails → that error), then reads by name `AllObjects`
(bool), `AllViews` (bool), `View` (int). Registry defaults:

| Command | GUID | AllObjects | AllViews | View |
|---|---|---|---|---|
| `Frame Selection` | 633b1811-9fa6-11d0-b6d7-00aa0068bf56 | False | False | -1 |
| `Frame Selection (All 3D Views)` / FrameSelection | 56aa96f8-7ae3-11d1-8036-00a0243e2717 | False | True | -1 |
| `Frame All` | e08564b0-c26b-11d0-847c-00a024c7919c | True | False | -1 |
| `Frame All (All 3D Views)` / FrameAll | 56aa96f9-7ae3-11d1-8036-00a0243e2717 | True | True | -1 |

**Wire contract** (Do `0x180003e10`): one handler, the four commands differ only by defaults.
- `AllViews` false: target = active 3D view when `View` = -1, else the view with that index. If found: set the camera
  change label "Frame", open a camera-change bracket, frame (view method +0xc0) with mode `AllObjects` (true = frame
  everything, false = frame the selection) and flag 1, close the bracket (so it enters the per-view camera undo
  history used by CameraUndo/CameraRedo, see B11h). No view: nothing.
- `AllViews` true: for every 3D view index of the view manager, label "Frame" and frame with `AllObjects`; **no**
  bracket (not recorded in the per-view camera history). `View` is ignored.
- Always returns S_OK (no error for a missing view). Command undo: none (stub). No log.

### `Hide Back Facing Polygons` (`0461b2c1`, vm.dll): SPEC
Same as CMD-B11h: toggles display flag 5 of the active view; not undoable.

### `Show/Hide Grid` {e56444f0-…} (`0461b2c2`, vm.dll): SPEC
**Wire contract** (Do `0x180007e00`): active 3D view (none → S_OK, nothing). From the view (view method +0x68) get its
grid / display object, query its parameter interface (none → E_NOINTERFACE 0x80004002), read its current visibility
value, and write the opposite boolean into the parameter identified by `c896a8a2-c091-11d0-b6f4-00aa0068bf56` (the
grid-visible parameter, name inferred). Then ask the redraw service (generic object `0x18003e738` / iface
`0x18003e718`) for the view's refresher and call it with 1 (redraw now). Toggle, active view only, not undoable.

### `Show Next Manipulator` / `Show Previous Manipulator` (`0461b2c0`, manipmgr.dll): SPEC-PARTIAL
UnPackArg: resolves the manipulator manager (`291f2030-2a0a-11d1-84a4-00aa00135f7b`, iface
`d8981b00-a524-11d0-8478-00a024c7919c`), then reads `Next` (bool; registry default True for Next, False for
Previous). **Wire contract** (Do `0x180004b70`):
1. Ask the manipulator manager to step to the next (+1) or previous (-1) manipulator (manager slot 9). Error → return it.
   S_OK → done.
2. S_FALSE (the manager could not step: end of the manipulator list, inferred) → switch the SRT tool instead: query
   the tool manager "is current" for Translate / Rotate / Scale and run the matching tool command through the command
   bus (`F3DExecuteCmd`, category `50830560-31b5-11d0-82e7-00a0243e268d`):
   - Translate current: Next → `RotationTool` (a05af492-…), Previous → `ScalingTool` (a05af493-…)
   - Rotate current: Next → `ScalingTool`, Previous → `TranslateTool` (a05af491-…)
   - Scale current: Next → `TranslateTool`, Previous → `RotationTool`
   - none of them current: nothing.
3. Returns S_OK. No undo, no log. Gap: the manipulator manager's own step (which manipulator is shown) was not read.

### `Toggle Manipulator mode` {56aa96fa-…} (`0461b2c4`, manipmgr.dll): SPEC-PARTIAL
No arguments. **Wire contract** (Do `0x180004ef0`): read the manipulator manager's 8-byte setting (manager slot 8),
invert its second 32-bit field (0 ↔ 1), write it back (slot 7). Errors returned. Not undoable, no log. The field is the
"manipulators set by mode" switch named by the registry description "Toggle Manipulators Set By Mode" (inferred; the
manager side was not read).

## Answers to PR #195 Q1–Q7

**Q1 (camera tool category) – partly.** The 14 camera tool classes are not in toolmanager.dll; byte search finds
them in `viewinteraction.dll` (e.g. `bf330860/61/62-…` Dolly / Roll / Pan&Zoom at `0x18021c018/38/48`, Track
`b10a6117-…` at `0x18021c028`, all referenced from its `DllGetClassObject` `0x180025140`). The Dolly tool's category
method (vtable `0x1802448b0` slot +0x60, `0x180132fe0`) returns **GUID_NULL** (constant `0x18025bba0`). So at least
Dolly is a default-category tool and **is** recorded as the last auxiliary tool by the 0461b2c6 recorder; only the two
Navigation tools (`988e8c81-…`, `a31f01db-…`) are excluded by the recorder's list. The other 13 classes' category
methods were not read individually (same pattern expected, inferred).

**Q2 (tool-state values, eligibility) – answered.** The state query does not depend on the class beyond choosing the
channel: channel slot 0x68 returns the **mode of the channel's current tool** (record +0x198), whatever class was
asked. Results: no channel for the category → E_FAIL; channel without a current tool → S_FALSE, S stays 0; channel
lock flag +0x214 set → S_OK, S = 5; otherwise S_OK, S = current tool's mode (0 = not yet given a mode, 1 = sticky,
2 = supra/held, 6 = set at key-up while locked; the dispatcher also uses 4 / 7 on its own channels). So a non-current
class on a plain call reports the current tool's mode, normally **1**. Eligibility (channel slot 0x100): S_FALSE when
the channel has no tool or the class is not the current tool's class; otherwise it is S_OK exactly when the current
tool is "held": mode 2 or 6, or the time since activation ≥ preference `Interaction.stickytime` (seconds; channel slot
0x110) — in that case a mode 0 is promoted to 2. Consequences (corrections to CMD-B16a §3.2 / §3.3 below).

**Q3 (three `Paint Tool` entries) – partly.** Registry level only: entries at index 1272 (`0b553b32-…`, scripting name
`PaintTool`, handler 0461b2c6), 1277 (`9d9b5d4a-…`, no scripting name, handler 0461b2c6, "Painter status") and 1278
(`cf80cbc2-…`, no scripting name, handler 0461b2bd). A scripting-name lookup can only return `0b553b32` (the only one
with a scripting name). No name-lookup code exists in toolmanager.dll (it never resolves commands by name; it
executes by GUID via `F3DExecuteCmd` in manipmgr.dll), so the display-name rule is open; with a first-match by
registry order a lookup of "Paint Tool" returns `0b553b32` and {CF80CBC2} is reachable only by GUID (inferred).

**Q4 (Deactivate fallback) – answered.** Channel deactivate (`0x18000f150`): (a) if the command-tool dispatcher has an
active session (dispatcher slot 3 returns S_OK) and this is the default channel, it escapes the dispatcher session
(dispatcher slot 6) instead and returns; (b) otherwise, on the default channel when channel flag +0x210 == 1, a
current tool that is not in the 8-class exclusion list is recorded as last auxiliary tool (channel slot 0xc0); (c) the
current tool is removed and the **previous tool from the channel's tool history** becomes current again (arrow cursor
restored); (d) if the default channel is then empty, the **+0x90 fallback** class is activated (e.g. the selection
tool stored by Escape / the SRT step, or the remembered Translate/Rotate/Scale), or the nil tool `d97e3888-…` when no
fallback is stored or `Interaction.niltool` is on. So: previous tool first, then the +0x90 tool, then the nil tool.

**Q5 (dispatcher `7c037c30`) – answered (internals of a few helpers open).** The dispatcher keeps two sessions: a
**sticky** session (command id at object +0xa8, previous sticky id at +0xd8, tool handle +0x88) and a **supra**
session (command id at +0xb8, handle +0x80), plus a queue (+0xe8) of commands that arrived while a supra session was
held. The "pending" state in CMD-B16a = the supra session id: set by dispatcher **+0x90** = start supra session (null
CmdID → E_INVALIDARG 0x80070057, null class → 0x80004005): install the class in the supra tool slot (+0xb8), fire
`SI3D_SUPRA_COMMAND_ACTIVATED` (command id), set mode 7 (+0x70), register (+0xd0 kind 1), store the id; cleared by
+0x98 (fires `SI3D_SUPRA_COMMAND_DEACTIVATED`). **+0x80** is the sticky counterpart (mode 4,
`SI3D_STICKY_COMMAND_ACTIVATED`; +0x88 ends it with `SI3D_STICKY_COMMAND_DEACTIVATED`). **+0xe0**(handle) makes that
handle's tool live: it queries the handle for interface `0x180020d08` and calls its slot 8 (activate / give focus,
inferred). Slot 5 (the 0461b2bd Do) with A bit 0x2 (key-down): queue if a supra session is held; else veto check
(host +0x120 slot 14; S_FALSE cancels silently) when no sticky session; then start supra (+0x90) and +0xe0. With A bits
0x2 and 0x1 clear: remove from the queue if queued; if it is the held supra command: when its state is 0 and the
"tap" flag (+0x9c) is set, either end supra + end sticky + restart the default sticky class `ba315211-…` (when supra
== sticky id and +0x98 flag set) or convert (+0xb0); otherwise end the supra session; if no supra session: **start
it as a sticky session** (end the old sticky session, +0x80, +0xe0) unless it already is the sticky one.

**Q6 (exec-context words) – partly.** Producer not in these DLLs (word A = context method +0x38, B = +0x40, filled by
the command bus). From the consumers: key press A = 0x6 (0x4 key + 0x2 down), key release A = 0x4, auto-repeat bit 0x1
(the dispatcher returns S_OK and does nothing for A = 0x1, inferred "repeat"); a script / menu call A = 0 (inferred;
with 0461b2bd this starts a sticky session, see Q5), B bit 0x10 = re-activate (restart) for 0461b2c6. B is not read
by 0461b2bd / 0461b2bc.

**Q7 (DLL of dac73700, baaa041a, 0bf11154, da55a810) – answered.** All four are in **`viewinteraction.dll`**, CLSID
table entries `0x18021c878` (dac73700, Delete Objects / Delete Components tool), `0x18021c1a8` (baaa041a, Cursor
Transform), `0x18021cba8` (0bf11154, Modify Projection), `0x18021cb38` (da55a810, MoveComponent), each referenced
from `DllGetClassObject` `0x180025140`. Class names are not available (no PDB); the implementations were not read.

## Corrections for the wire agent

1. CMD-B16a §3.3 SRT-memory step: when the current default tool is not Translate/Rotate/Scale the stored +0x90 class is
   the **selection tool** `11778840-…`, not GUID_NULL. §3.2 key-up: also stores the selection tool, not GUID_NULL.
   (`toolManager.ts` `prevSrt = … : GUID_NULL`, line ~219 / ~209.)
2. CMD-B16a §3.2 key-up branch is inverted: recorder + mode 1 (tool becomes sticky) when S == 0 **and eligibility is
   S_FALSE** (key released before `Interaction.stickytime`); otherwise (held long enough / mode set) end the supra
   activation.
3. CMD-B16a §3.3 refusal: activation is refused (S_FALSE, nothing) when the channel has a current tool and its mode is
   0, or the requested class is the current tool and it is being held (eligible). A non-current class with a sticky
   current tool (mode 1) is activated normally.
4. +0x90 is the channel's fallback tool used when the default channel becomes empty (Q4); storing it while the channel
   is empty activates it immediately. Replace the "used once" `prevSrt` stand-in: previous tool from history first,
   then the fallback, then the nil tool `d97e3888-…` (also when `Interaction.niltool` is on).
5. 0461b2bd (`Delete Components`, `Paint Tool` {cf80cbc2}, `Add Surface Point Tool`): a plain script call (A = 0) with
   no held supra session **starts a sticky command session** for (CmdID, Clsid) (ends the previous sticky one); it is
   a no-op only if it already is the sticky session. CMD-B16a §4 said "ends".
6. `Escape Pick Session` {45af19b0} (keymap.ts): deactivate the current default tool (Q4 fallback chain); when the tool
   was Translate/Rotate/Scale, the selection tool becomes the fallback. Not just `onCancel()`.
7. `Escape Pick Session` {41ee76f1}: ends the dispatcher's supra session if held, else its sticky session, and fires
   `SI3D_COMMAND_EXECUTED` for `41ee76f1-…` when nothing remains (see contract).
8. `FrameSelection` / `FrameAll` (src/commands/ui.ts): the arguments are `AllObjects`, `AllViews`, `View` (no
   `Toggle`); defaults per the table above. Single-view framing is bracketed (camera undo history, label "Frame");
   all-views framing is not. `Frame All` / `Frame Selection` (no scripting name) use AllViews = False.
9. `Reset Camera` (keymap.ts maps it to frameall): it is the camera home reset of CMD-B11h, undoable.
10. `Show Next / Previous Manipulator`: when the manipulator manager cannot step, cycle the SRT tool
    Translate → Rotate → Scale → Translate (Next) or the reverse (Previous) by running the tool commands.
11. `Show/Hide Grid`: toggle the active view's grid visibility and redraw that view; not undoable.
12. Camera tools (at least Dolly) are default-category tools: they become the last auxiliary tool (only the two
    Navigation tools are excluded). CMD-B16a correction 10 "not read" is now answered for Dolly.

## Open questions

- Manipulator manager (`291f2030-…`) step and "mode" field semantics (manipmgr.dll manager class not read).
- Dispatcher helpers +0xb0, +0xc0, +0xd0, +0xd8, +0xf0, +0xf8 and the host object behind +0x120 (veto / restore).
- Channel flags +0x210 and +0x214 (who sets them).
- Category of the other 13 camera tool classes (only Dolly read).
- Exec-context word producer (command bus / key handler) and the display-name lookup rule for duplicate names.
