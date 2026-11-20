# CMD-B16a: tool activation commands (`toolmanager.dll` handlers `0461b2c6`, `0461b2c7`, `0461b2bd`; 72 commands)

Row: **CMD-B16a**. Status: **SPEC** (69 names: the 68 `0461b2c6` commands and `XYZ Transform `),
**SPEC-PARTIAL** (3 names: `Delete Components`, `Paint Tool` {cf80cbc2-…}, `Add Surface Point Tool`, the `0461b2bd`
command-tool / pick-session path; see section 4).
Run: 2026-11-20, si-analyst worker, unattended, batch 16 (binary first, REA + Ghidra).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary (opened alone, closed at the end):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\toolmanager.dll`, image base `0x180000000`,
  sha256 `aa91046ebfddd37f590e91540b4c58c2d1c4fd91d7b153b90b4766c772d63967` (PDB `toolmanager.pdb`, not loaded).
  `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll` were not needed: toolmanager.dll serves all three handler CLSIDs.

Method: `search_bytes` for the little-endian handler CLSIDs (CLSID table at `0x1800210b8…0x180021147`);
decompilation of `DllGetClassObject` (`0x180015d50`, 11 inline compares); `read_bytes` of factory vtables (slot 6 =
create), task vtables (primary and the ITask interface at object +0x18) and of the tool-manager vtable; decompilation
of create, constructor, UnPackArg, Do and their helpers; decompilation of the tool-manager methods the handlers call
and of the two methods of the command-tool dispatcher object they call. Argument defaults come from
`data/command_registry.json`. Every UnPackArg reads exactly the registry argument names (`Clsid`; `Property`;
`Clsid` + the command's own CmdID), which confirms the mapping.
All statements are behaviour read from the binary unless marked `(inferred)`.

Note on the registry data: for arguments with `vt` 72 (VT_CLSID) the extractor stores the default CLSID in the field
named `handler_clsid`. It is the argument's **default value**, not an argument handler. So every `Clsid=None` entry of
the batch list has a real default: `Translate Tool` = `3a711ff0-8798-11d1-84b1-00aa00135f7b`, `Rotation Tool` =
`ecbad3a0-974b-11d1-84bf-00aa00135f7b`, `Scaling Tool` = `f500bd80-974b-11d1-84bf-00aa00135f7b`,
`MoveComponent Tool` = `da55a810-5f86-11d2-b11c-00a0c906811e`, `Modify Projection` = `0bf11154-359a-11d4-b4c4-00d0b7142c4c`,
`Last Auxiliary Tool` = GUID_NULL, etc. (all listed per command below). The binary confirms it: the activate handler
special-cases exactly `3a711ff0` / `ecbad3a0` / `f500bd80` as the Translate / Rotate / Scale tools.

## 1. Handler table

All factories are 0x48 bytes, 7 slots (slot 6 = create). Task objects carry the primary vtable at +0 and the ITask
interface at +0x18 (ITask slot 5 = Do, slot 8 = UnPackArg for `0461b2c6`).

| Handler CLSID | Commands | Factory vtable | Create | Constructor (size) | Task vtable / ITask vtable | Do | UnPackArg | Worker |
|---|---|---|---|---|---|---|---|---|
| `0461b2c6-0ae3-11d2-8065-00a0c955b335` | 68 (activate tool) | `0x180021d78` | `0x180015aa0` | `0x1800039e0` (0x68) | `0x18001be70` / `0x18001bed0` | `0x180004140` (ITask slot 5) | `0x180004330` (ITask slot 8) | activation core `0x180003ea0` (interface at +0x40, slot 3); activate helper `0x180003cc0` (primary slot 8); deactivate helper `0x180004260` (primary slot 9); last-aux recorder `0x1800044b0`; supra filter `0x180003c20` |
| `0461b2c7-0ae3-11d2-8065-00a0c955b335` | `XYZ Transform ` | `0x180021e90` | `0x1800159e0` | `0x180003350` (0x50) | `0x18001add0` / `0x18001ae30` | `0x180003480` (ITask slot 3) | `0x1800034c0` (primary slot 9) | dispatcher slot 4 `0x180007680` |
| `0461b2bd-0ae3-11d2-8065-00a0c955b335` | `Delete Components`, `Paint Tool` {cf80cbc2}, `Add Surface Point Tool` | `0x180021ec8` | `0x180015a20` | `0x180003690` (0x58) | `0x18001b4f0` / `0x18001b550` | `0x180003790` (ITask slot 3) | `0x1800037f0` (primary slot 9) | dispatcher slot 5 `0x180007120` |

Other classes served by the same `DllGetClassObject` (for the DLL map): `5007914f-bf6d-11d1-9157-00a0c9612e3a`
(factory `0x180021f38`), the tool manager `e99d46d0-b9bc-11d1-9153-00a0c9612e3a` (factory `0x180021f70`, object
0xa0 bytes, ctor `0x180011370`, installs thread mouse / keyboard hooks), the handlers `0461b2b3` and `0461b2bc`
(both `Escape Pick Session`) and `0461b2c5`, the tool class `d97e3888-012c-11d6-a2e3-08003658d403` (factory
`0x180021e58`), the command-tool dispatcher `7c037c30-ffe2-11d1-8063-00a0c955b335` (factory `0x180021fa8`, object
0x100 bytes, ctor `0x180005620`, queried for interface `b86eac06-0f6b-11d2-8067-00a0c955b335`), and
`547bccf8-9979-4015-b966-d997e7f310f0` (factory `0x180021db0`).

## 2. Tool manager model (shared facts)

- The handlers reach the tool manager with a generic-object query for class `e99d46d0-b9bc-11d1-9153-00a0c9612e3a`,
  interface `a25c423d-d603-11d1-916b-00a0c9612e3a` (the singleton in this DLL).
- The manager keeps a list of tool **channels**, each identified by a category GUID. For any per-tool request the
  manager instantiates the tool class (`SICreateInstance(clsid, iface 0x180020ff8)`), asks the tool for its category
  GUID, and forwards the request to the channel with that category. When the class cannot be created the category
  stays GUID_NULL, i.e. the request goes to the default channel (read); there is **no error** raised for an unknown
  or uncreatable class by the command itself.
- Manager methods used (vtable offsets, interface at +0x18 of the manager, vtable `0x180020460`):
  `+0x20` get tool state (`0x180011ba0`, E_FAIL if no channel); `+0x28` get the current tool object of a category;
  `+0x38` "is current" query (`0x180012ca0`; S_FALSE (1) when no channel matches, otherwise the channel's answer:
  0 = the tool is current, 1 = it is not (inferred from use)); `+0x50` deactivate; `+0x68` set tool mode
  (`0x180013770`); `+0x88` activate; `+0x90` store "previous SRT tool" (`0x180013930`, meaning inferred);
  `+0xa8` channel eligibility query (`0x180012b90`, S_FALSE when no channel; meaning not read, see Open questions);
  `+0xc0` used only with a non-null callback (never from these commands); `+0xf0` record last auxiliary tool;
  `+0xf8` get last auxiliary tool of a category (`0x180011e00`; GUID_NULL out and S_FALSE when no channel).
- Tool mode values the handler sets: 1 after a normal (sticky) activation, 2 after a key-down (supra) activation,
  6 at key-up when the tool state is 5 (names of the modes inferred from the paths that set them).
- Preferences read: `Interaction.stickytoggle` (bool), `Interaction.stickykeys` (bool).
- Execution context words: UnPackArg of `0461b2c6` stores two 32-bit words obtained from the exec context
  (context vtable +0x38 and +0x40) next to the class; called **A** (invocation flags) and **B** (modifier flags)
  below. A bit 0x4 = key invocation, A bit 0x2 = key-down (with 0x4) (meaning inferred from the paths, matching the
  CMD-B7a note "exec context flag bits 2 and 4"); B bit 0x10 = "restart" (inferred). A plain script / menu call has
  neither 0x4 nor 0x2 (inferred).
- No handler records undo, logs, or returns a value to the script. The Do of `0461b2c6` returns whatever the
  activation core leaves in its return register; the decompiler could not settle it (treat as S_OK, inferred).

## 3. `0461b2c6`: activate tool (68 commands)

### 3.1 UnPackArg (`0x180004330`)
1. Read exec-context words A and B.
2. Read argument `Clsid` (VT_CLSID) into the task.
3. If `Clsid` is GUID_NULL: ask the tool manager for the last auxiliary tool of the default category (key GUID_NULL,
   method +0xf8) and use that class instead. This is how `Last Auxiliary Tool` works; it also applies to any tool
   command called with an explicit null `Clsid`.

The tool class therefore always comes from the `Clsid` argument (its registry default unless overridden); the
command GUID is not used.

### 3.2 Do (`0x180004140` → core `0x180003ea0`)
- If the class is GUID_NULL: return, nothing happens.
- Query "is current" (+0x38) for the class.
- **Plain invocation (A bit 0x4 clear):**
  - tool not current: run the activate helper (3.3); if it succeeds (S_OK): run the last-aux recorder (3.4), then set
    tool mode 1.
  - tool already current: if neither `Interaction.stickytoggle` is on nor B bit 0x10 is set, nothing happens.
    Otherwise run the deactivate helper (manager +0x50: the tool is switched off, the channel falls back to its
    previous tool (inferred)). Then, only when B bit 0x10 is set, activate it again (3.3), and on success set mode 1
    (the recorder is not run on this path).
- **Key invocation, key-down (A bits 0x4 and 0x2):** only when the tool is not current: activate (3.3), then the
  supra filter: when `Interaction.stickykeys` is off and the class is Translate / Rotate / Scale, stop (tool stays
  activated, mode not set); otherwise, when `Interaction.stickykeys` is on, stop too, except for the Maya Zoom tool
  `462d51a8-dc72-46e9-ad70-afbf3cf87835`; when it passes, set tool mode 2 (supra).
- **Key invocation, key-up (A bit 0x4 without 0x2):** only when the tool is current: read its tool state S.
  - S == 0 and the eligibility query (+0xa8) succeeds: run the last-aux recorder and set mode 1 (the key press made
    the tool sticky).
  - otherwise: store GUID_NULL as "previous SRT tool" (+0x90); if S == 5 set mode 6; else, when
    `Interaction.stickytoggle` is on or S != 1, deactivate the tool (end of the supra activation).

### 3.3 Activate helper (`0x180003cc0`)
1. Get the tool state S of the new class (+0x20). On failure, return the error (nothing activated).
2. Unless the class is the Pick Session tool `cf80cbc3-984e-11d1-96e7-00a024191bac`: when the state query returned
   S_OK and (S == 0 or the eligibility query fails) return S_FALSE: nothing is activated.
3. When S == 1 (SRT-memory step): read the current tool of the default category; if its class is Translate
   `3a711ff0-…`, Rotate `ecbad3a0-…` or Scale `f500bd80-…` store it with +0x90, else store GUID_NULL.
4. Activate the class (+0x88) with the context. Its result is the helper's result.

### 3.4 Last auxiliary tool recorder (`0x1800044b0`)
Runs after a successful activation. When the activated class belongs to the default category (GUID_NULL, or the class
cannot be created), it reads the current tool of the default category and records its class as the last auxiliary
tool (+0xf0) **unless** the class is one of:
`11778840-8c5c-11d1-84b5-00aa00135f7b` (selection tool), `3a711ff0-8798-11d1-84b1-00aa00135f7b` (Translate),
`ecbad3a0-974b-11d1-84bf-00aa00135f7b` (Rotate), `f500bd80-974b-11d1-84bf-00aa00135f7b` (Scale),
`36ad0600-98dc-11d1-84bf-00aa00135f7b` (Manipulate), `988e8c81-0a1f-11d3-bfe4-00a0248f9397` (Navigation),
`a31f01db-e282-4d0a-8a62-3d36a544da7a` (3ds Max Navigation), `d97e3888-012c-11d6-a2e3-08003658d403` (a tool class
of toolmanager.dll itself). This matches the command description "last auxiliary (non-Selection/SRT/Navigate) tool".
Tools of other categories are never recorded.

## 4. `0461b2bd`: command-tool / pick-session dispatcher (3 commands)

- Unpack (`0x1800037f0`): reads exec-context word A, the command's own CmdID from the exec context
  (`F3DCmdGetCmdId`), and argument `Clsid`. (The registry `CmdID` argument equals the command GUID in all three
  commands; the binary reads the context's CmdID, not the argument.)
- Do (`0x180003790`): calls dispatcher `7c037c30-…` interface `b86eac06-…` slot 5 (`0x180007120`) with
  (CmdID, word A, Clsid).
- Dispatcher behaviour (read in outline): with A bit 0x2 set it **starts** a command-tool session for (CmdID,
  Clsid): if another session is pending the request is queued (returns S_OK); if one is running it is ended first;
  a veto object can cancel the start silently; then the tool is installed (+0x90 of the dispatcher, then +0xe0).
  With A bits 0x2 and 0x1 clear it **ends** the session for that CmdID (removes it from the queue when queued,
  otherwise finishes / restores the previous tool). With only A bit 0x1 set: S_OK, nothing. Errors of the inner
  calls are returned. A plain script call (A = 0) therefore ends rather than starts the session (inferred from the
  flag test; not executed). Gap: the dispatcher's internal states (+0x70/+0x74/+0x78 flags, the +0x80/+0x90 slots)
  are not specified.

## 5. `0461b2c7`: `XYZ Transform `

- Unpack (`0x1800034c0`): reads exec-context word A, the command's CmdID (`F3DCmdGetCmdId`, i.e.
  `b4238eb0-1d86-11d1-806d-00a024c78ee3`) and argument `Property` (string; default `SI3D_COMMAND_EXECUTED`).
- Do (`0x180003480`): calls dispatcher `7c037c30-…` slot 4 (`0x180007680`) with (CmdID, GUID_NULL, Property).
- Dispatcher slot 4: `Property` must be exactly one of `SI3D_SUPRA_COMMAND_ACTIVATED`,
  `SI3D_SUPRA_COMMAND_DEACTIVATED`, `SI3D_STICKY_COMMAND_ACTIVATED`, `SI3D_STICKY_COMMAND_DEACTIVATED`,
  `SI3D_COMMAND_EXECUTED`; anything else (or a null string, or a null CmdID) returns `E_INVALIDARG` (0x80070057).
  Otherwise it fires the named notification through the dispatcher's event sink (object +0x50, slot 6) with one
  argument, a by-reference pointer to the CmdID (a second argument, the class, is added only when it is not
  GUID_NULL: never for this command).
- So `XYZ Transform ` is a **notification relay**: it broadcasts "command `b4238eb0-…` executed" (or one of the
  supra / sticky activated / deactivated states) to listeners of the command-state events, e.g. toolbar buttons
  that light up (listeners inferred). It changes no scene data.

## 6. Per-command sections

### `XYZ Transform ` ((none)): SPEC

Command GUID `b4238eb0-1d86-11d1-806d-00a024c78ee3`, registry flags 4. Handler `0461b2c7`. Arguments: `Property`=SI3D_COMMAND_EXECUTED. **Wire contract:** validate `Property` against the five `SI3D_*` names (else E_INVALIDARG 0x80070057) and emit that command-state notification with the command GUID `b4238eb0-1d86-11d1-806d-00a024c78ee3` as argument; no scene change, no undo, returns nothing (section 5).

### `Translate Tool` (TranslateTool): SPEC

Command GUID `a05af491-aa05-11d0-b6da-00aa0068bf56`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=3a711ff0-8798-11d1-84b1-00aa00135f7b. **Wire contract:** activate tool class `3a711ff0-8798-11d1-84b1-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. One of the three classes the SRT-memory step of the activation helper recognises (section 3.3). Translate is excluded from Last Auxiliary Tool.

### `Rotation Tool` (RotationTool): SPEC

Command GUID `a05af492-aa05-11d0-b6da-00aa0068bf56`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=ecbad3a0-974b-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `ecbad3a0-974b-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Excluded from Last Auxiliary Tool. One of the three classes of the SRT-memory step (section 3.3).

### `Scaling Tool` (ScalingTool): SPEC

Command GUID `a05af493-aa05-11d0-b6da-00aa0068bf56`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=f500bd80-974b-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `f500bd80-974b-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Excluded from Last Auxiliary Tool. One of the three classes of the SRT-memory step (section 3.3).

### `Last Auxiliary Tool` (LastTool): SPEC

Command GUID `edb85710-b30c-4cbb-b336-0756dcfed597`, registry flags 648. Handler `0461b2c6`. Arguments: `Clsid`=00000000-0000-0000-0000-000000000000. **Wire contract:** activate the recorded last auxiliary tool (section 3.4); no-op when none recorded; no undo, returns nothing. Clsid default is GUID_NULL, so UnPackArg replaces it with the recorded last auxiliary tool (tool manager query, key GUID_NULL); when nothing is recorded the class stays GUID_NULL and Do does nothing.

### `Direct Manip Tool` (DirectManipTool): SPEC

Command GUID `5c960195-d24c-4855-80a4-6b15b6369bfb`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=907a713d-ed09-46cd-8960-d58345e95a02. **Wire contract:** activate tool class `907a713d-ed09-46cd-8960-d58345e95a02` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Scaling Tool` (HairScalingTool): SPEC

Command GUID `5e413414-10cb-4947-ae6f-9f30eafbadc0`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=b3672c3b-31d5-4a34-a6d1-3b5d019d405f. **Wire contract:** activate tool class `b3672c3b-31d5-4a34-a6d1-3b5d019d405f` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Clump Tool` (HairClumpTool): SPEC

Command GUID `33946083-0f3a-48cc-bf3e-b32b2fad1c04`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=aa0b2dff-4b7e-42de-ab2e-2f77f084d99b. **Wire contract:** activate tool class `aa0b2dff-4b7e-42de-ab2e-2f77f084d99b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Stand On End Tool` (HairStandOnEndTool): SPEC

Command GUID `cff668a4-1156-49d8-b8a7-bd4be5a5ffe8`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=9f91cac4-0cff-420a-881d-2c68f99fab7c. **Wire contract:** activate tool class `9f91cac4-0cff-420a-881d-2c68f99fab7c` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Puff Roots` (HairPuffRootsTool): SPEC

Command GUID `31d3e298-e2cf-11d5-a2dd-08003658d403`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=481adb88-e2cf-11d5-a2dd-08003658d403. **Wire contract:** activate tool class `481adb88-e2cf-11d5-a2dd-08003658d403` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Rotate Root Tool` (HairRotateRootTool): SPEC

Command GUID `27d6baef-5c4e-4783-8db8-8139fc659ce6`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=825fcd04-4e50-4938-8de1-258db92cf19e. **Wire contract:** activate tool class `825fcd04-4e50-4938-8de1-258db92cf19e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Rotate Tip Tool` (HairRotateTipTool): SPEC

Command GUID `254095e4-eb17-11d5-a2e0-08003658d403`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=b962f218-eb16-11d5-a2e0-08003658d403. **Wire contract:** activate tool class `b962f218-eb16-11d5-a2e0-08003658d403` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Hair Rotate Cursor Tool` (HairRotateCursorTool): SPEC

Command GUID `1bcae6cc-e2cf-11d5-a2dd-08003658d403`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=657cf6b6-e2cf-11d5-a2dd-08003658d403. **Wire contract:** activate tool class `657cf6b6-e2cf-11d5-a2dd-08003658d403` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Particle Tool` (AddParticleTool): SPEC

Command GUID `1a941426-878f-48d8-8c18-61ac27ef4670`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=cc06852c-3d4d-4226-b85c-c8a7b4c2c7a0. **Wire contract:** activate tool class `cc06852c-3d4d-4226-b85c-c8a7b4c2c7a0` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Sketch Curve Tool` (SketchCurveTool): SPEC

Command GUID `126fcf21-a7cb-11d1-a8fe-00a024190119`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=218a3c00-a7ce-11d1-a8fe-00a024190119. **Wire contract:** activate tool class `218a3c00-a7ce-11d1-a8fe-00a024190119` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Point on Curve Tool by Knot Points` (AddPointOnCurveToolByKnotPoints): SPEC

Command GUID `46353acd-408a-4f3f-a0bb-0244a6cc9af5`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=76cff041-a941-4ee6-b011-a46005468130. **Wire contract:** activate tool class `76cff041-a941-4ee6-b011-a46005468130` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Point on Curve Tool by CVs` (AddPointOnCurveToolByCVs): SPEC

Command GUID `2bb0233a-293a-44df-8a83-feea941bce9b`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=23d2d99e-020c-4cbc-ae16-968164c1126e. **Wire contract:** activate tool class `23d2d99e-020c-4cbc-ae16-968164c1126e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Point on Curve Tool by Bezier-Knot Points` (AddPointOnCurveToolByBezierKnotPoints): SPEC

Command GUID `e5ab5b29-a386-4cc5-a040-34956cd44199`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=6eb05159-5482-4508-8da3-28694066c816. **Wire contract:** activate tool class `6eb05159-5482-4508-8da3-28694066c816` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Polygon Tool` ((none)): SPEC

Command GUID `efc008c0-3317-11d4-8c24-009027bc3a0e`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=b1f9ef80-2b54-11d4-8c23-009027bc3a0e. **Wire contract:** activate tool class `b1f9ef80-2b54-11d4-8c23-009027bc3a0e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Slice Polygons Tool` ((none)): SPEC

Command GUID `6ca134e9-64ea-494b-a7ee-e47bf8d16931`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=ba9e4840-f301-40df-b935-4e34b2da853b. **Wire contract:** activate tool class `ba9e4840-f301-40df-b935-4e34b2da853b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Edge Tool` ((none)): SPEC

Command GUID `87f68420-4782-11d4-8c27-009027bc3a0e`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=33cca460-4782-11d4-8c27-009027bc3a0e. **Wire contract:** activate tool class `33cca460-4782-11d4-8c27-009027bc3a0e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Vertex Tool` (AddVertexTool): SPEC

Command GUID `64578190-b32e-11d4-8c47-009027bc3a0e`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=64578190-b32e-11d4-8c47-009027bc3a0e. **Wire contract:** activate tool class `64578190-b32e-11d4-8c47-009027bc3a0e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Split Edge Tool` (SplitEdgeTool): SPEC

Command GUID `cb7d9160-46b2-11d4-8c28-009027bc3a0e`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=dbc628e0-46b2-11d4-8c28-009027bc3a0e. **Wire contract:** activate tool class `dbc628e0-46b2-11d4-8c28-009027bc3a0e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Split Polygon Tool` ((none)): SPEC

Command GUID `c6737510-67ea-11d4-8c2d-009027bc3a0e`, registry flags 664. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=3500a6f0-67dd-11d4-8c2d-009027bc3a0e. **Wire contract:** activate tool class `3500a6f0-67dd-11d4-8c2d-009027bc3a0e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Delete Point on Curve Tool` (DelPointOnCurveTool): SPEC

Command GUID `56f7ecf0-cd24-11d3-a9ba-009027bc65d7`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=56f7ecf1-cd24-11d3-a9ba-009027bc65d7. **Wire contract:** activate tool class `56f7ecf1-cd24-11d3-a9ba-009027bc65d7` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `CV NURBS Curve Tool` (CVNURBSCurveTool): SPEC

Command GUID `218a18dd-d349-11d2-91ef-00a0c9612e3a`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=7cfe3e5b-d182-11d2-91ed-00a0c9612e3a. **Wire contract:** activate tool class `7cfe3e5b-d182-11d2-91ed-00a0c9612e3a` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Interpolating NURBS Curve Tool` (NURBSCurveTool): SPEC

Command GUID `24c6539c-e239-11d2-9205-00a0c9612e3a`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=24c6539b-e239-11d2-9205-00a0c9612e3a. **Wire contract:** activate tool class `24c6539b-e239-11d2-9205-00a0c9612e3a` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Bezier Curve Tool` (BezierCurveTool): SPEC

Command GUID `784a7f35-70cf-4ebf-a3f9-e5b9d05881db`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=cc5c427c-0a50-411d-bda5-e03f3dcd0f25. **Wire contract:** activate tool class `cc5c427c-0a50-411d-bda5-e03f3dcd0f25` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Linear Curve Tool` (LinearCurveTool): SPEC

Command GUID `d8c56033-e2e0-11d2-9205-00a0c9612e3a`, registry flags 152. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bf47dbf9-e2e0-11d2-9205-00a0c9612e3a. **Wire contract:** activate tool class `bf47dbf9-e2e0-11d2-9205-00a0c9612e3a` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Activate Current Select Tool using Filter` ((none)): SPEC

Command GUID `9b419340-0aa8-11d2-84cb-00aa00135f7b`, registry flags 136. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=11778840-8c5c-11d1-84b5-00aa00135f7b. **Wire contract:** activate tool class `11778840-8c5c-11d1-84b5-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Class `11778840-8c5c-11d1-84b5-00aa00135f7b` (selection tool) is excluded from Last Auxiliary Tool.

### `Pan and Zoom Tool` (CamPanZoomTool): SPEC

Command GUID `5d11c410-9975-11d1-84bf-00aa00135f7b`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bf330862-9693-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `bf330862-9693-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Zoom Tool` (CamZoomTool): SPEC

Command GUID `2ca3dde2-e365-4a58-b8c6-cb9ae2796437`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=7cced755-7501-4bba-baa8-38a58284faea. **Wire contract:** activate tool class `7cced755-7501-4bba-baa8-38a58284faea` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Maya Zoom Tool` (CamMayaZoomTool): SPEC

Command GUID `b6bd7115-c77b-4220-ac14-29f3b2beeaaa`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=462d51a8-dc72-46e9-ad70-afbf3cf87835. **Wire contract:** activate tool class `462d51a8-dc72-46e9-ad70-afbf3cf87835` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Key-down (supra) path: this class is always allowed to enter supra mode, whatever `Interaction.stickykeys` says (read).

### `Rectangular Zoom Tool` (CamRectZoomTool): SPEC

Command GUID `29c0eff0-9981-11d1-84bf-00aa00135f7b`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=880441f1-570c-11d2-817f-00a0248f9397. **Wire contract:** activate tool class `880441f1-570c-11d2-817f-00a0248f9397` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Orbit Tool` (CamOrbitTool): SPEC

Command GUID `212e0191-9027-11d0-b6cc-00aa0068bf56`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=1ceb5700-7881-11d1-84b0-00aa00135f7b. **Wire contract:** activate tool class `1ceb5700-7881-11d1-84b0-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Dolly Tool` (CamDollyTool): SPEC

Command GUID `04a30561-9a50-11d0-b6d5-00aa0068bf56`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bf330860-9693-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `bf330860-9693-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Track Tool` (CamTrackTool): SPEC

Command GUID `f6da35be-bae1-419f-afbc-1f2159af07f3`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=b10a6117-ab64-4601-8795-e157bf485674. **Wire contract:** activate tool class `b10a6117-ab64-4601-8795-e157bf485674` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Pivot Tool` (CamPivotTool): SPEC

Command GUID `0eb9ea14-bc2f-49b4-a743-75ef4b2476ec`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=4ad8fa2b-1ffe-4934-a0e8-0ec2dcba6720. **Wire contract:** activate tool class `4ad8fa2b-1ffe-4934-a0e8-0ec2dcba6720` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Walk Tool` (CamWalkTool): SPEC

Command GUID `1bf8a181-58df-4e78-a65a-c5c52e1baa57`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=0f77efe5-07a5-40d9-9d62-f6fa0ffbea92. **Wire contract:** activate tool class `0f77efe5-07a5-40d9-9d62-f6fa0ffbea92` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Fly Tool` (CamFlyTool): SPEC

Command GUID `39109d08-0bf0-4209-a216-16dbc466e946`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=856b0cb2-c291-4d0a-88d6-aba1160c240a. **Wire contract:** activate tool class `856b0cb2-c291-4d0a-88d6-aba1160c240a` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Drive Tool` (CamDriveTool): SPEC

Command GUID `1f7426d4-4bb7-11d6-a2e8-08003658d403`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=14ee0590-4bb7-11d6-a2e8-08003658d403. **Wire contract:** activate tool class `14ee0590-4bb7-11d6-a2e8-08003658d403` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Roll Tool` (CamRollTool): SPEC

Command GUID `9a0c5f90-6740-11d1-84ab-00aa00135f7b`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bf330861-9693-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `bf330861-9693-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Navigation Tool` (CamNavigTool): SPEC

Command GUID `55b52481-0a27-11d3-bfe4-00a0248f9397`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=988e8c81-0a1f-11d3-bfe4-00a0248f9397. **Wire contract:** activate tool class `988e8c81-0a1f-11d3-bfe4-00a0248f9397` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Navigation Tool` (Cam3dsMaxNavigTool): SPEC

Command GUID `fe621e60-85df-4b78-a38e-9ea5e81ffe52`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=a31f01db-e282-4d0a-8a62-3d36a544da7a. **Wire contract:** activate tool class `a31f01db-e282-4d0a-8a62-3d36a544da7a` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Delete Components` ((none)): SPEC-PARTIAL

Command GUID `56aa96f5-7ae3-11d1-8036-00a0243e2717`, registry flags 648. Handler `0461b2bd` (command-tool / pick-session dispatcher). Arguments: `Clsid`=dac73700-99c8-11d1-84bf-00aa00135f7b; `CmdID`=56aa96f5-7ae3-11d1-8036-00a0243e2717. **Wire contract:** start (key-down / plain invocation, see section 4) the command-tool session for command `56aa96f5-7ae3-11d1-8036-00a0243e2717` with tool class `dac73700-99c8-11d1-84bf-00aa00135f7b`; ending it ends the session; no undo, returns nothing. Gap: the session bookkeeping inside the dispatcher object (`7c037c30-…`, slot 5 `0x180007120`) is read only in outline.

### `Manipulate Tool` (ManipulateTool): SPEC

Command GUID `57bd0990-98dc-11d1-84bf-00aa00135f7b`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=36ad0600-98dc-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `36ad0600-98dc-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Excluded from Last Auxiliary Tool (class `36ad0600-…` is in the exclusion list).

### `DoNothing` ((none)): SPEC

Command GUID `2b2ffb2d-5987-11d2-8411-00a0c961747d`, registry flags 4. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=2b2ffb2e-5987-11d2-8411-00a0c961747d. **Wire contract:** activate tool class `2b2ffb2e-5987-11d2-8411-00a0c961747d` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Activates class `2b2ffb2e-5987-11d2-8411-00a0c961747d` like any other tool (not served by toolmanager.dll; the class is a tool that does nothing, so the effect is "replace the current tool by an inert one" (inferred)). It is not a no-op command.

### `Time Slider Tool` (TimeSliderTool): SPEC

Command GUID `d84a017c-4908-4fec-ad99-33756a2676e1`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=c68cf93c-fd82-4166-8b73-eeee95eadb9c. **Wire contract:** activate tool class `c68cf93c-fd82-4166-8b73-eeee95eadb9c` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Virtual Slider Tool` (VirtualSliderTool): SPEC

Command GUID `282446f8-7002-466f-b8d4-ea7d5e8a36e5`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=b3e7200c-2273-4d19-8428-c206ec058d0d. **Wire contract:** activate tool class `b3e7200c-2273-4d19-8428-c206ec058d0d` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Tool` (PaintTool): SPEC

Command GUID `0b553b32-8f88-11d2-85d6-00c04f8edf15`, registry flags 8389258. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=babe02c7-a8b6-11d1-9306-0060970a2bc8; `CmdID`=0b553b32-8f88-11d2-85d6-00c04f8edf15; `KeyboardProcess`=True. **Wire contract:** activate tool class `babe02c7-a8b6-11d1-9306-0060970a2bc8` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Vertex Color Tool` (PaintVertexColorTool): SPEC

Command GUID `77120620-addb-11d4-b91c-0800690c8bd0`, registry flags 650. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=d9066020-add5-11d4-b91c-0800690c8bd0; `CmdID`=77120620-addb-11d4-b91c-0800690c8bd0; `KeyboardProcess`=True. **Wire contract:** activate tool class `d9066020-add5-11d4-b91c-0800690c8bd0` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Texture Tool` (PaintTextureTool): SPEC

Command GUID `ef59c982-e6d2-4182-a07d-01eb9a60d01a`, registry flags 654. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=ca6011f0-aa0d-48f6-9935-e7f9a4174240; `CmdID`=ef59c982-e6d2-4182-a07d-01eb9a60d01a; `KeyboardProcess`=True. **Wire contract:** activate tool class `ca6011f0-aa0d-48f6-9935-e7f9a4174240` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Probe Material Tool` (ProbeMaterialTool): SPEC

Command GUID `5a5f547a-c9fa-427b-85db-d123b1d9d46d`, registry flags 650. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=8536fc0b-f58d-4bbf-92b8-9f139aa21f26; `CmdID`=5a5f547a-c9fa-427b-85db-d123b1d9d46d; `KeyboardProcess`=True. **Wire contract:** activate tool class `8536fc0b-f58d-4bbf-92b8-9f139aa21f26` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Select Tool` (PaintSelectTool): SPEC

Command GUID `68073608-2078-11d3-864f-00c04f8edf15`, registry flags 650. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bcb4b0ff-aeaa-11d4-b804-0008c7a011a6; `CmdID`=68073608-2078-11d3-864f-00c04f8edf15; `KeyboardProcess`=True. **Wire contract:** activate tool class `bcb4b0ff-aeaa-11d4-b804-0008c7a011a6` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Tool` ((none)): SPEC

Command GUID `9d9b5d4a-8fb8-11d2-85d6-00c04f8edf15`, registry flags 4. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=babe02c7-a8b6-11d1-9306-0060970a2bc8. **Wire contract:** activate tool class `babe02c7-a8b6-11d1-9306-0060970a2bc8` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Paint Tool` ((none)): SPEC-PARTIAL

Command GUID `cf80cbc2-984e-11d1-96e7-00a024191bac`, registry flags 516. Handler `0461b2bd` (command-tool / pick-session dispatcher). Arguments: `Clsid`=cf80cbc3-984e-11d1-96e7-00a024191bac; `CmdID`=cf80cbc2-984e-11d1-96e7-00a024191bac. **Wire contract:** start (key-down / plain invocation, see section 4) the command-tool session for command `cf80cbc2-984e-11d1-96e7-00a024191bac` with tool class `cf80cbc3-984e-11d1-96e7-00a024191bac`; ending it ends the session; no undo, returns nothing. Gap: the session bookkeeping inside the dispatcher object (`7c037c30-…`, slot 5 `0x180007120`) is read only in outline.

### `Delete Objects Tool` ((none)): SPEC

Command GUID `56aa96f3-7ae3-11d1-8036-00a0243e2717`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=dac73700-99c8-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `dac73700-99c8-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Render Region Tool` (RenderRegionTool): SPEC

Command GUID `a281d992-5a0f-473b-843a-bae619ae0b09`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=70f24601-a6f1-11d1-9c1a-00a0243f0f55; `KeyboardProcess`=True. **Wire contract:** activate tool class `70f24601-a6f1-11d1-9c1a-00a0243f0f55` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Add Surface Point Tool` ((none)): SPEC-PARTIAL

Command GUID `dccb8090-b82c-11d1-a900-00a024190119`, registry flags 648. Handler `0461b2bd` (command-tool / pick-session dispatcher). Arguments: `Clsid`=dccb8091-b82c-11d1-a900-00a024190119; `CmdID`=dccb8090-b82c-11d1-a900-00a024190119. **Wire contract:** start (key-down / plain invocation, see section 4) the command-tool session for command `dccb8090-b82c-11d1-a900-00a024190119` with tool class `dccb8091-b82c-11d1-a900-00a024190119`; ending it ends the session; no undo, returns nothing. Gap: the session bookkeeping inside the dispatcher object (`7c037c30-…`, slot 5 `0x180007120`) is read only in outline.

### `Pick Deformer By Vertex Tool` (PickDeformerByVertexTool): SPEC

Command GUID `4d0ab010-d108-4b8d-a83c-33efb70096a5`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=f0afddd4-bc35-4798-a944-cf35ed6c2937. **Wire contract:** activate tool class `f0afddd4-bc35-4798-a944-cf35ed6c2937` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `MoveComponent Tool` ((none)): SPEC

Command GUID `da55a813-5f86-11d2-b11c-00a0c906811e`, registry flags 4. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=da55a810-5f86-11d2-b11c-00a0c906811e. **Wire contract:** activate tool class `da55a810-5f86-11d2-b11c-00a0c906811e` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Move Point Tool` (MovePointTool): SPEC

Command GUID `ec9ec01e-b5c4-4335-9625-5f32f16875c6`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=f500bd81-974b-11d1-84bf-00aa00135f7b. **Wire contract:** activate tool class `f500bd81-974b-11d1-84bf-00aa00135f7b` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Tweak Tool` (TweakTool): SPEC

Command GUID `0d41ff0c-8af4-4e18-9c1b-83277acf12ef`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=9eebc290-e6b8-437a-b3e4-84e9a4fff3a3. **Wire contract:** activate tool class `9eebc290-e6b8-437a-b3e4-84e9a4fff3a3` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Tweak Normals Tool` (TweakNormalsTool): SPEC

Command GUID `612ed5cc-9426-4459-a3c4-92a8983fdd27`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=d0dda3e5-a9be-449f-ab49-5edb120de5a4. **Wire contract:** activate tool class `d0dda3e5-a9be-449f-ab49-5edb120de5a4` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Weld Point Tool` (WeldPointTool): SPEC

Command GUID `45ba55db-1280-46fc-96f2-d8385916d61f`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=43e49832-44fa-475e-86df-e224cc51ca54. **Wire contract:** activate tool class `43e49832-44fa-475e-86df-e224cc51ca54` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Cursor Transform Tool` (CursorTransformTool): SPEC

Command GUID `401c5b7b-3ca8-4675-ac2f-6383b855f747`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=baaa041a-d204-45df-8d4f-e2c524678315. **Wire contract:** activate tool class `baaa041a-d204-45df-8d4f-e2c524678315` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Proportional Transform Tool` (PropTransformTool): SPEC

Command GUID `fa9493c0-0a22-41f4-8980-6e63ad875e0b`, registry flags 648. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=bb67e5d2-1b1f-4336-87c7-19b43ee1a9a1. **Wire contract:** activate tool class `bb67e5d2-1b1f-4336-87c7-19b43ee1a9a1` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `2D Chain Tool` ((none)): SPEC

Command GUID `4a6a5d55-c1d6-11d2-8437-00a0c961747d`, registry flags 128. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=4a6a5d56-c1d6-11d2-8437-00a0c961747d. **Wire contract:** activate tool class `4a6a5d56-c1d6-11d2-8437-00a0c961747d` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `3D Chain Tool` ((none)): SPEC

Command GUID `907cbba1-24dc-11d3-8454-00a0c961747d`, registry flags 128. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=907cbba2-24dc-11d3-8454-00a0c961747d. **Wire contract:** activate tool class `907cbba2-24dc-11d3-8454-00a0c961747d` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Modify Projection` (ToggleProjectionTool): SPEC

Command GUID `cb349f32-365c-11d4-b4c4-00d0b7142c4c`, registry flags 8388746. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=0bf11154-359a-11d4-b4c4-00d0b7142c4c. **Wire contract:** activate tool class `0bf11154-359a-11d4-b4c4-00d0b7142c4c` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.

### `Pick Session Tool` ((none)): SPEC

Command GUID `cf80cbc1-984e-11d1-96e7-00a024191bac`, registry flags 4. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=cf80cbc3-984e-11d1-96e7-00a024191bac. **Wire contract:** activate tool class `cf80cbc3-984e-11d1-96e7-00a024191bac` through the tool manager with the generic activation rules (section 3); no undo, returns nothing. Activates class `cf80cbc3-984e-11d1-96e7-00a024191bac`. This class is the one exception in the activation helper: the tool-state refusal check is skipped for it (read).

### `Move Joint Tool` ((none)): SPEC

Command GUID `abae8f7a-a858-4fff-985d-19f1db8b5e0d`, registry flags 136. Handler `0461b2c6` (activate tool). Arguments: `Clsid`=00d8e0bd-6010-4821-9dff-01ca4776bbd8. **Wire contract:** activate tool class `00d8e0bd-6010-4821-9dff-01ca4776bbd8` through the tool manager with the generic activation rules (section 3); no undo, returns nothing.


## 7. Wire question 5 of PR #193 (trailing-space names, disabled tools)

- `XYZ Transform ` (with the trailing space, GUID `b4238eb0-1d86-11d1-806d-00a024c78ee3`, handler `0461b2c7`):
  the command-state notification relay of section 5. Its registry description "Todo: XYZ transform" is stale; the
  command has a working handler. The trailing space is part of the registry name and should be kept as is.
- `Transform Set New ` (GUID `43178f00-198c-11d1-9245-08003629ea02`): its registry handler CLSID is GUID_NULL, it has
  no arguments, no scripting name, no description, and no handler DLL. There is no code that can run it: in Softimage
  invoking it can only fail at handler creation (inferred: class-not-registered). It should be registered as an inert
  entry (no effect, returns nothing) or disabled; it creates nothing.
- Registry `flags`: the tool commands use 648 (0x288), 664 (0x298), 152 (0x98), 136 (0x88), 128 (0x80), 650 / 654,
  8389258 / 8388746 (0x800000 + …) and 4. The entries with flags 4 (`XYZ Transform `, `Transform Set New `,
  `DoNothing`, `MoveComponent Tool`, `Pick Session Tool`, `Paint Tool` {9d9b5d4a}) are the ones without scripting
  names, i.e. internal entries (inferred). None of the three handlers reads any registry flag or has an enable check
  of its own, and this binary does not interpret the `flags` field; which bit (if any) means "disabled" was not
  established here. Recommendation: register all 72 as enabled; registry flags should not disable them until the
  flag bits are specified by the command-map loader's analysis. `disabled_label` text (e.g. "MoveComponent Tool
  (disabled)") is a menu label for when the command is unavailable, not a flag.

## 8. Tool class → serving DLL (optional)

Byte searches were done only in toolmanager.dll: it serves `d97e3888-012c-11d6-a2e3-08003658d403` and
`547bccf8-9979-4015-b966-d997e7f310f0` (unnamed classes) but **none** of the tool classes the 72 commands activate
(checked for `2b2ffb2e-…` DoNothing; the others were not searched). Their DLLs are left `(inferred / unknown)`; the
contract does not depend on them.

## Corrections for the wire agent

1. `DoNothing`: not a no-op. It activates tool class `2b2ffb2e-5987-11d2-8411-00a0c961747d` with the generic
   activation rules (switches the current tool to an inert tool). Wire: deactivate the current tool
   (`app.setTool(null)` or equivalent), keep the `Clsid` argument.
2. `MoveComponent Tool`: activates class `da55a810-5f86-11d2-b11c-00a0c906811e`, which is **not** the Tweak tool class
   (`9eebc290-e6b8-437a-b3e4-84e9a4fff3a3`). Delegating to `TweakTool` is a stand-in only; mark it so, and do not
   record it as the Tweak tool.
3. `XYZ Transform `: not a no-op. Validate `Property` against the five `SI3D_*` names (else throw E_INVALIDARG,
   0x80070057) and emit the named command-state notification carrying the command GUID `b4238eb0-…`; no scene change.
4. `Transform Set New `: no handler exists (handler CLSID GUID_NULL); keep it inert, but drop the "not yet attested:
   what it creates" log: it creates nothing.
5. `Pick Session Tool`: activates class `cf80cbc3-…` through the same activation path as all tools; this class is
   exempt from the tool-state refusal. Outside a pick session it still becomes the current tool (not a pure no-op).
6. `Add Surface Point Tool` (and `Delete Components`, `Paint Tool` {cf80cbc2}): handler `0461b2bd` is the command-tool
   session dispatcher (start on key-down / A bit 0x2, end otherwise), not the generic activate handler. The `CmdID`
   argument is ignored by the binary (the exec context's command id is used).
7. All 68 `0461b2c6` commands: the `Clsid` argument selects the tool. A call with an explicit `Clsid` activates that
   class whatever the command name is; `Clsid` = GUID_NULL means "last auxiliary tool". `TranslateTool`,
   `RotationTool`, `ScalingTool` (src/commands/ui.ts) register no `Clsid` argument: add it with defaults
   `{3A711FF0-8798-11D1-84B1-00AA00135F7B}`, `{ECBAD3A0-974B-11D1-84BF-00AA00135F7B}`,
   `{F500BD80-974B-11D1-84BF-00AA00135F7B}`.
8. `TweakTool`, `MovePointTool` (src/commands/model.ts) and `PropTransformTool` register `Clsid` with default `''`.
   In Softimage an empty / null class means "activate the last auxiliary tool". Use the registry defaults
   `{9EEBC290-E6B8-437A-B3E4-84E9A4FFF3A3}`, `{F500BD81-974B-11D1-84BF-00AA00135F7B}`,
   `{BB67E5D2-1B1F-4336-87C7-19B43EE1A9A1}`.
9. Re-invoking a tool command while that tool is current does nothing, unless the preference
   `Interaction.stickytoggle` is on, in which case it toggles the tool off. Wire tool commands that re-enter or reset
   the tool on a second call should follow this.
10. `LastTool` / last-auxiliary bookkeeping (src/commands/inferredB10Views.ts): `ManipulateTool` sets `lastAux`, but
    Manipulate is excluded from the last auxiliary tool. Excluded classes: selection tool, Translate, Rotate, Scale,
    Manipulate, both Navigation tools and `d97e3888-…`. Every other tool of the default category activated
    successfully becomes the last auxiliary tool (camera tools other than the two Navigation tools included, if
    their category is the default one: not read).
11. All 72 commands: not undoable, no log line, no script return value, no error for an uncreatable class (the request
    lands on the default channel and simply has no effect). Only `XYZ Transform ` and the `0461b2bd` dispatcher can
    return errors (E_INVALIDARG, or the error of an inner call).
12. Registry `flags` must not be used to disable any of these commands until the flag bits are specified (section 7).

## Open questions

- **Q1** Tool-state values returned by the channels (0, 1, 5) and the eligibility query (+0xa8 → channel slot 0x100)
  were not read; their names (inactive / sticky / supra / tapped) are inferred from how the handler uses them.
- **Q2** The exec-context words A and B (context vtable +0x38 / +0x40) are named from use only; their producer (the
  command bus / key handler) was not read. In particular the value for a plain script call is assumed to be 0.
- **Q3** The command-tool dispatcher `7c037c30-…` slot 5 state machine (pending / running / queued sessions, the veto
  object reached through dispatcher +0x120 → slot 0x70) is only outlined; needed for an exact pick-session contract.
- **Q4** Which DLLs serve the 60-odd tool classes (all outside toolmanager.dll as far as checked).
- **Q5** Registry `flags` bit meanings (0x4, 0x8, 0x80, 0x200, 0x800000) belong to the command-map loader, not to
  these handlers.
