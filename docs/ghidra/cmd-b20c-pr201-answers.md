# CMD-B20c: answers to wire PR #201 questions (B19a, B19d)

Run: 2026-11-21, si-analyst batch 20 (binary first, REA + Ghidra 12.1.4 on the PC).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced; behaviour is
described in prose. Statements are read from the binary unless marked `(inferred)`.

Binaries opened (one at a time, each closed):

| DLL | sha256 |
|-----|--------|
| `Application\bin\rendercore.dll` | `df47a0fda7b38ceb2533e487469f9ad331068de9797c7d8e2116f41efb7ec167` (same build as CMD-B19a) |
| `Application\bin\selectionmgr.dll` | `77d0a1e7bcba8ca784da3b1838121bb36bff17be6d896351f1a5d1deeb3c3bc9` (same build as CMD-B19d) |

`mcp.dll` and `toolbarobj.dll` were **not** opened in this batch (budget of two binaries); questions 38 and 43 are
answered only from repository data. Repository data used: `data/command_registry.json`, `data/spdl/spdl.json`
(rendering preferences), `data/si/keymaps/Softimage.xsikm` and `SI3D.xsikm`, `docs/ghidra/cmd-b6e-…` (scripts).

Summary: **8 answered, 10 partly, 2 not done.** No command status changes (see the end).

---

## B19a (`rendercore.dll`)

### Q1: default `Viewport` of ToggleVisibility / Refresh / ToggleSelectionTracking
**Answered** (registry). The registry has **two entries** with the same scripting name for each of these three
commands, served by the same handler CLSID:

| scripting name | entry (index, command GUID, label) | `Viewport` default |
|---|---|---|
| `RenderRegionToggleVisibility` | 1890 `34d68621…` "Show/Hide Render Region" | `siViewportCurrent` |
| | 1903 `df2f2175…` "Show/Hide All Render Regions" | `siViewportAll` |
| `RenderRegionRefresh` | 1891 `4ded3be0…` "Refresh Render Region" | `siViewportCurrent` |
| | 1902 `0a8550fc…` "Refresh All Render Regions" | `siViewportAll` |
| `RenderRegionToggleSelectionTracking` | 1893 `5421b2f8…` "Toggle Selection Tracking for Render Region" | `siViewportCurrent` |
| | 1904 `12e54a85…` "Toggle Selection Tracking for All Render Regions" | `siViewportAll` |
| `RenderRegionToggleAutoRefresh` | 1892 `4593cb12…` and 1905 `dced912c…` | `siViewportAll` (both) |
| `RenderRegionSetRefreshMode` | 1897 `388ea045…`, 1912 / 1913 / 1914 (Interactive / CTRS / Manual) | `siViewportAll` (all four) |

The handler does not look at the command GUID (B19a §1), so the default is purely the registry entry's. The
"for Render Region" entry (Current) comes first in the registry and carries the plain label (inferred: it is the one
a script call by scripting name gets; the "All" entries are menu items that pass All). Both the catalogue (All) and
note §3 (Current) are each right for one of the two entries. Affects: wire correction 1 below.

### Q2: ToggleAutoRefresh enum values
**Answered.** Worker `0x18007b0a0`: it reads each resolved region's refresh mode (region slot 0x48); if **any** region
is in mode **0** the new mode is **1**, otherwise the new mode is **0**; every region gets the new mode (slot 0x40).
So the toggle is 0 ↔ 1, and a region in mode 2 counts as "not 0" (a Manual region is switched to 0). With All, the
**integer** preference `rendering.region_refresh_mode` is written with that 0/1 value.
Enum values, from the rendering preference definition (`data/spdl/spdl.json`, `GUID_PrefsRen_Region_RefreshMode`,
combo items "Interactive" 0 and "Manual" 2) and the registry's three `RenderRegionSetRefreshMode` entries:
`siRenderRegionRefreshModeInteractive` = **0**, `siRenderRegionRefreshModeCTRS` (Camera, Time and Region State) =
**1**, `siRenderRegionRefreshModeManual` = **2**. ToggleAutoRefresh therefore flips **Interactive ↔ CTRS**, never
Manual. It does **not** touch the separate boolean preference `rendering.region_auto_refresh` (default true).
Display type (same file): 0 Alpha-Blended RGB (`siRenderRegionDisplayRGBA`), 1 RGB, 2 Alpha, 3 Red, 4 Green, 5 Blue;
preference `region_display_mode` default 1. B19a open question 3 is closed.

### Q3: siViewportAll with no regions; Get on a viewport without a region
**Answered.** The common Do (`0x18007b700`) is a plain forward: it loads the stored viewport code and calls the worker;
it never looks at the resolver's S_FALSE. Inside the workers read (`0x18007b0a0`, `0x18007b2d0`, `0x18007ab50`;
SetDisplayType `0x18007a990` not re-read, inferred to match SetRefreshMode) the resolver's status is ignored, the region loop simply runs zero
times, and the `Viewport == −1` branch still runs. So with All and **no regions**:
- `RenderRegionSetRefreshMode` / `SetDisplayType`: the preference is written with the argument and the viewports are
  refreshed.
- `RenderRegionToggleAutoRefresh`: the new mode is computed from the (empty) region set, so it is **0**; the
  preference becomes 0 whatever it was before (not a toggle of the preference).
- `RenderRegionToggleSelectionTracking`: "any region tracks" is false, so the new state is **true**; the preference
  becomes true whatever it was before.
- The Get workers (`0x180079f90`, `0x18007a0a0`) with −1 read the preference **without resolving any region**, so
  they return the preference even when no region exists.
Get with a non-All code and no region: the resolver leaves the map empty and the worker reads the first element of
the empty map; that element is the map's sentinel node, whose value slot is never initialised (the sentinel is a
0x30-byte allocation, `0x180078740`, that sets only its links and flags). The binary then calls through an
uninitialised pointer: no defined result (inferred: an access violation caught by the command layer, or garbage).
`RenderRegionGetRenderChannel` has the same unchecked read. B19a open question 2 is closed as "undefined".

### Q4: does a script passing `""` get the registry default?
**Partly.** Read in rendercore (`SICreateEmptyPartition` UnPack `0x18008a960`, worker `0x180084e20`): `Name` must be
VT_BSTR with a non-null pointer, else `E_INVALIDARG` in UnPack; a non-null empty string passes UnPack and is refused by
the worker (`E_INVALIDARG`) before any pass is touched. `Type` is taken only when VT_I4; any other variant type
leaves the task's constructor value in place (no error). The handler itself never substitutes the registry default.
Whether the command dispatcher replaces an explicit `""` with the registry default before UnPack is **not in
rendercore** (not read). `SICreatePass`'s `Name` is the opposite case: an empty name is accepted and simply means "do
not rename" (worker `0x180085230`).
Consequence for `CreatePassWithPartition` (script, `cmd-b6e`): it calls `SICreatePartition` with `ParamName` (default
`""`), which calls `SICreateEmptyPartition Target, Name, …`. If the dispatcher does not substitute, the default call
creates the pass but no partition (the error stops `SICreatePartition`). This needs an XSIBATCH probe; until then the
handler behaviour (empty → `E_INVALIDARG`) is the attested one.

### Q5: frame-set grammar of parser `0x1800a77e0`
**Answered.** Behaviour (helpers `0x1800a7730` single number, `0x180030eb0` ordered-set insert):
1. An empty string → `E_INVALIDARG`. The output set is cleared first.
2. The text is split on `,`. No token at all → `E_INVALIDARG`. Each token is trimmed (both ends); an **empty token**
   (e.g. `"1,,3"` or a trailing comma) makes the whole set invalid.
3. A token is a **range** only if it contains `-` at a position **after the first character**; the split is at the
   **first** such `-`. A leading `-` (or `+`) is a sign, so `"-5"` is a single frame.
4. Number check (for a single number and for each side of a range, after trimming): one leading `+` or `-` is
   skipped; then every character that is not a digit but is punctuation is counted, and a **second punctuation
   character makes the token invalid**. Letters and inner spaces are not rejected by this check; the value is then
   `_wtof` of the text, which reads the longest numeric prefix (`"5abc"` → 5, `"abc"` → 0, `"1 0"` → 1,
   `"2.5"` → 2.5).
5. Range: start = value of the left side, end = value of the right side; **end < start → invalid** (no descending
   ranges). Frames start, start+1, start+2, … while ≤ end (always **step 1**, doubles, so `"1.5-3"` gives 1.5, 2.5).
   There is **no step syntax**: `"1-10x2"` reads as 1..10 (the `x2` is ignored by `_wtof`), `"1-10:2"` the same (one
   punctuation character is allowed). A right side with its own `-` is accepted once (`"1-2-3"` → 1..2).
   A negative start cannot be written as a range: `"-5-3"` is taken as a single number and gives frame −5.
6. Frames go into an **ordered set of doubles**: duplicates are dropped and the result is sorted ascending,
   whatever the order typed.
7. Result: `S_OK`, or `E_INVALIDARG` on the first invalid token (frames added before it stay in the set, but the
   caller treats the status as failure).

### Q6: render job range type vs export range sources; is parameter 0x1b used by render?
**Partly.** Render slot 9 (`0x180086fe0`) does not read any pass parameter itself: it builds the jobs with the job
builder `0x180083320` (render mode 0), then for each job asks the job's frame source (job slot 0x68 → slot 0xe0) for
a range record {start, end, step, type, count, list}; the frame count is by **type** 0 → 0 frames, 1 →
`(end − start) / step + 1` (integer), 2 → explicit count. The job builder sets job properties `pass`, `pass_name`,
`pass_index`, `pass_count`, `camera_index`, `camera_count`, `render_type` = `"Pass"`, `preview` = false,
`progressive` = false, and `object_list` for passes that need it; it does **not** read parameter 0x1b or the frame
parameters. The range record is produced by the render manager (generic object `368229bd-0046-472f-9aec-4cb6f8be3794`,
slot 0xa8), which is **not implemented in rendercore** (its CLSID appears only as a reference). So whether the
renderer's own-range follows the same 0x1b source switch as export (0 start/end/step, 1 frame set, 2 timeline,
3 render options) is not visible here (inferred: yes, type 1 ↔ sources 0/2/3, type 2 ↔ source 1). A job whose range
query fails ends the command with `E_FAIL` (`0x80004005`). A pass list item that is not a pass gives `E_POINTER` in
the job builder; a pass that has no render options logs `XSIRENDERCORE` 0x51 with the pass name (severity 2).

### Q7: RemoveRenderChannel case sensitivity; does the manager refuse `Main`?
**Partly.** Worker `0x180086ac0`: lookup and removal are both calls on the render-channel interface
(`7372a22e-9711-4e4a-8498-9524d7c3ea2d`) of the render manager `368229bd-…` (lookup slot 0x28 by name, remove
slot 0x20 by name). The manager is not served by rendercore, so case sensitivity and any `Main` refusal live in the
other DLL; the handler has no comparison of its own and no `Main` check. Order observed: lookup (null → `E_INVALIDARG`),
with undo keep the channel type (slot 0x20 of the channel), walk every pass of the pass container and collect the
framebuffers that use the channel (pass slot 0xc0 then non-empty test), delete them with one `DeleteObj` sub-task
(undo flag passed), then remove the channel; a failure of the remove is returned as is, success → `S_OK`.
For comparison, `RenderRegionSetRenderChannel` does its own case-insensitive match (B19a §3).

### Q8: SICreatePass: what counts as a pass (error 0x17), the third timing value, "flag bit 8"
**Partly.** Worker `0x180085230`, partition fill `0x18008c760`:
- **Pass test**: the object created from the preset (`SICreateObjectAndUpgradeFromPreset`) must answer the pass
  interface `d233acd7-b2f5-4f26-9847-4752712f9260` (the same interface `SICreateEmptyPartition` uses to keep pass
  targets). Any preset whose object does not is refused with `XSIRENDERCORE` 0x17 formatted with the **preset's
  name** (severity 2). It is a capability test on the created object, not a test on the preset name.
- Name non-empty → set through the name interface `9ee6ddb1-65cc-11d1-b0ce-00a024c79287` (failure stops); empty →
  the preset's own name is kept.
- Then the pass is added to the pass container (container slot 0x38).
- **Timing**: the scene content container returns an object (`25571b20-cb95-11d2-88c8-00a024ee6238`, parameter
  interface `6de1b670-8072-11d5-aeed-0090275802c9`, read by index): index **1** must be a double, index **2** a double,
  index **6** an unsigned int (VT_UI4). (inferred: PlayControl In, Out, and its integer step/format field.) The new
  pass gets 0x1c = index 1 rounded **half away from zero**, 0x1d = index 2 rounded the same way, 0x1e = index 6 as
  int, 0x1f = `"%d-%d"` of index 1 and index 2 **truncated toward zero** (not rounded: In 1.6 gives FrameStart 2 but
  FrameSet `"1-…"`).
- If any of the three reads has the wrong variant type, **everything after it is skipped**: no frame parameters, no
  partition fill, no `Value`, no undo record (the pass is already in the container).
- **Partition fill**: the pass's two partition members lists are taken from pass slots 0x38 (first) and 0x30
  (second) through the group-members interface `b0cbf80e-c0d5-11d0-a586-00a0c91412de`. Every X3DObject the scene
  enumerates (class `5fc0ccae-3dc8-11d0-9449-00aa006d3165`, recursive) is visited: the object's **owning model** is
  looked up (first owner answering the model interface `3ded5562-0bb6-11d3-ac82-00a02485cecb`); an object with no
  owning model is skipped; a flag word is read from that model's component hierarchy (`4aeaeaea-…` slot 0xc0) and
  the object is skipped when **bit 0x8** is set (inferred: content of a referenced / special model, not the object's
  own flags). Then by the object's class id: `3a9eca63-4f91-11d0-aa46-00a0243e34c4` → first list (slot 0x38);
  `9f43b240-58e5-11d0-8469-00a024c7919c` → skipped; anything else → second list (slot 0x30). (inferred: lights →
  background lights, cameras skipped, others → background objects.)
- Still open: exact identity of the timing object and of index 6, the two classes, the meaning of model flag 0x8.
  `SICreatePass` stays SPEC-PARTIAL.

### Q9: SICreateEmptyPartition lock test
**Answered.** Worker `0x180084e20`: for each target pass a lock-status object is built on the pass and asked
`IsLocked` with level argument **1**; locked → the lock status raises its own error and the pass is skipped (the
loop continues); not locked → the partition is created. The numeric level is 1 (inferred: the general/any lock level;
the enum name is not in the DLL). A target item that is not a pass stops the loop with `E_POINTER` (UnPack already
filters non-passes, so scripts never reach it). Also confirmed: empty Name or Type outside 1..2 → `E_INVALIDARG`
before any pass is touched; Type 1 → class `8b291ad2-aac2-4f09-a027-b47e6c11e4ac`, 2 →
`7a1bb9d6-58a3-49d6-84ba-39429edad489`.

---

## B19d (`selectionmgr.dll`; `mcp.dll` not opened)

### Q35: SetAndToggleSelection owner pre-check (slot 10) and the DeactivateElements list
**Partly.** Worker `0x180011ea0`, pre-check `0x1800152d0` (reached through slot-10 thunk `0x180005ed0`), set helper
`0x180015090`, split `0x180010940`.
- UnPack (`0x1800118e0`): `HierarchyLevel` missing → 0; taken only when VT_I4 (3) and < 8, anything else
  `E_INVALIDARG`; worker refuses 4. `SupportPostSelectionScript` via the boolean reader (default false).
- **Non-empty** `SelectionList`: expanded at the hierarchy level by the selection service (`0x180010890`, service
  slot 0xe8). **Pre-check (slot 10)**: the expanded list is copied/filtered by list slot 0x88 into the working list;
  if that result is **empty** the command ends with "nothing changed" (`0x562e80c7`) and the selection is **not**
  touched. It is not an owner test.
- **Empty** `SelectionList`: no expansion, no pre-check, and the split is called with **no list** (null): undefined
  in the binary (inferred: a fault caught by the command layer). Not a defined error code.
- With undo: sub-tasks are cleared and a snapshot of the current selection is taken (`0x1800103e0`).
- Split, mode 1 (toggle): for each item, a component item (type 7) is compared index by index with the components of
  that object currently selected (at the current time); unselected indices go to list **A** (a new component
  reference when only part is unselected, the item as is when none is selected); a non-component item goes to A when
  it is not selected. In mode 1 nothing goes to the second list, so the `E_UNEXPECTED` branch (second list
  non-empty) is unreachable here.
- The selection is then **set to A even when A is empty** (everything listed was selected → the selection becomes
  empty: the toggle-off case). Status: `0x562e80c7` only when both the split and the set report "no change".
- **Set helper**: the selection manager's set method (+0x110) returns two lists. Only when it returns exactly `S_OK`:
  the **first** list runs a `RemoveFromSelection` sub-task (`38eddd02`), then the **second** list runs a
  `DeactivateElements` sub-task (`9dcec2b3`); each is attached to the command when undo is recorded. How the manager
  forms the two lists (+0x110 internals) is still not read. Command stays SPEC-PARTIAL.

### Q36: tool `e9cdd760` and type `0f47fe72`; SelRegionMode 3–6
**Partly.** Tool chooser `0x18000e0a0`: default tool `11778840-8c5c-11d1-84b5-00aa00135f7b`. The effective filter is
`SelFilter` or, if absent, the selection manager's current filter. If the filter says it is a component filter
(filter slot 0x60) and its filter interface `93c3a700-fcd4-11d2-8bdf-00aa006130ef` (slot 0xb8, recursive flag 1)
accepts family **`0f47fe72-d0e9-11d2-b7f9-00a0243e3694`**, the tool is **`e9cdd760-d183-11d2-8bcf-00aa006130ef`**.
`0f47fe72` is a **component family root**: `SelectAll`'s component collector (`0x180013900`) uses the same GUID with
the families manager ("is this family derived from `0f47fe72`") to pick the component families it expands. So
(inferred, strong): every sub-component filter (point, edge, polygon, tip, sampled point …) activates
`e9cdd760`, the component variant of the select tool; an object filter keeps `11778840`. The tool itself is not in
selectionmgr. `SelRegionMode` 3–6: UnPack only range-checks 1..6 and the value is written to ambient
`SI3D_RECTSEL_REGION_MODE` unchanged; the meaning belongs to the select tool (not read). Not done for 3–6.

### Q37: add / remove lists on a filter change; other-type components under NoObjStateChange
**Partly.** The two lists come from the selection manager's set-filter method (`a003cac0` +0x18), not read. From the
worker `0x18000eff0` (B19d §3.5): the **remove** list is applied (as `RemoveFromSelection`) **only when
`DeselectOnNewFilter` is true**; the **add** list is applied always. So under the `…WithNoObjStateChange` variants
(`DeselectOnNewFilter` false) the command removes nothing: selected components of another type and selected objects
stay selected (whatever the manager put in the remove list), and the previously tagged items of the new type are
added. What the manager puts in each list is still open.

### Q38: player range flag and frame increment
**Not done** (`mcp.dll` not opened this batch).

### Q40: HierarchyLevel enum numeric mapping (`{0907F360…}`)
**Partly.** selectionmgr only ever sees an integer: UnPack accepts VT_I4 0..7 (4 refused by the worker), so the name →
number conversion of `"{0907F360-B147-11d2-8BC8-00AA006130EF}:<NAME>"` is done before the handler (command layer,
not read). The names the registry uses with this enum are `ASITIS`, `NODE OR BRANCH`, `BRANCH`, `TREE`, `CHAIN`,
`MODEL` (`data/command_registry.json`); `ASITIS` is 0 (the unexpanded case). The numbers of the others are not in
the DLLs read.

### Q41: key-held Activate*: repeat bit; does "do not record" also suppress the log line?
**Partly.** Do `0x18000e260`: the exec context's state word is read once; bit **0x4** marks a key-held (supra) call,
and bit **0x2** of the same word (taken only when 0x4 is set) marks the key-down transition; a second flag word
bit 0x2 lets a held call still run the filter / ambient steps. The filter step's sub-task reports whether it changed
something. At the end: **if the filter step reported a change → `S_OK`** (recorded normally); **otherwise the exec
context is asked "do not record" (context slot 0x98 with value 2) and the command returns `S_FALSE`**. This applies to
**normal** (not held) calls too: an Activate call that does not change the filter (filter already current, or no
`SelFilter`, as for `ActivateSelectTool`) is not recorded. Whether context value 2 also suppresses the script log
line is decided by the exec context (not in selectionmgr). On the key-down of a held call the original
`SI3D_GROUP_SEL_MODE` is saved in module globals when it is changed.

### Q42: CheckComponentVisibility: hidden points / edges?
**Answered.** `SelectAll` component collector `0x180013900`: for each active object of type 2 that is not hidden
(`F3DFaceRobotIsObjectHidden`), for each family the filter lists that derives from `0f47fe72`, if the geometry has that
family (geometry slot 0x40) it takes the component count (slot 0x38); with `CheckComponentVisibility` set it asks the
geometry for its **visible** count of that family (slot 0xf8) and, if it differs from the total, the visible index
list (slot 0x100); otherwise all indices 0..n−1. There is no family-specific code: points, edges, polygons and other
families all use the geometry's own visible-component answer (inferred: hidden points/edges are excluded exactly as
the geometry reports them). The result list is passed through the filter once more (filter slot 0x20).

### Q43: SIAppModules index order
**Partly** (registry only; `toolbarobj.dll` not re-opened). `SwitchToolbar` registry targets: Model 1, Animate 2,
Render 3, **ICE 4**, Simulate 5, Hair 6, so module indices (Target − 1) are Model 0, Animate 1, Render 2, ICE 3,
Simulate 4, Hair 5. Which other indices `IsModuleValid` accepts was not read.

### Q45: SelectMembers / Isolate group-like type 8
**Not done.** The type code is the item's own answer (item slot 0x180); which classes (layers, layer groups,
partitions) answer 8 is decided in their DLLs, not in selectionmgr.

### Q46: do NextFrame / FirstFrame / LastFrame / PlayForwards / PlayForwardsFromStart share the transport code?
**Answered** (registry). All 23 entries, these five included, have handler CLSID
`9ff65990-22a3-11d3-bff8-00a0248f9397` (`mcp.dll`) with `Type` defaults NextFrame 0, FirstFrame 2, LastFrame 3,
PlayForwards 7, PlayForwardsFromStart 10, each with a `Transport` 1 "Sequence …" twin. Same class, same transport
worker `0x18003d7f0` (B19d §3.7), so they must use the same wire code as the seven already wired.

### Q47: should hotkeys T / E / Y run the Activate* commands?
**Answered** (`data/si/keymaps/Softimage.xsikm` and `SI3D.xsikm`, keylist `XSI`). The default keymap binds the
command GUIDs of the Activate commands:

| key | command |
|---|---|
| T / Shift+T | `ActivateVertexSelTool` / `ActivateVertexSelToolWithNoObjStateChange` |
| E / Shift+E | `ActivateEdgeSelTool` / `ActivateEdgeSelToolWithNoObjStateChange` |
| Y / Shift+Y | `ActivatePolygonSelTool` / `ActivatePolygonSelToolWithNoObjStateChange` |
| U / Shift+U | `ActivateRaycastPolySelTool` / `…WithNoObjStateChange` |
| I / Shift+I | `ActivateRaycastEdgeSelTool` / `…WithNoObjStateChange` |
| Space / Shift+Space | `ActivateObjectSelTool` / `ActivateObjectSelToolWithNoObjStateChange` |
| `'` (VK_OEM_7) | `ActivateTipSelTool` |

The unshifted bindings carry key flags `0x804028a`, the shifted ones `0x804020a` (Shift+U `0x804028a`); bit 0x80
(inferred: "supra" hold-to-activate allowed) is the difference.

---

## Corrections for the wire agent

Against current `src/` (read only).

1. `src/commands/renderB19a.ts` `RenderRegionToggleVisibility` / `RenderRegionRefresh` /
   `RenderRegionToggleSelectionTracking` are registered with default `VP_ALL` and the "All" labels. The registry has
   a Current entry first (index 1890 / 1891 / 1893) and an All entry (1902–1904); a scripting-name call should get
   `siViewportCurrent`, and the "All" menu items should pass `siViewportAll` explicitly (Q1).
2. `renderB19a.ts` Set/Toggle region commands: `if (!r) return undefined` skips the preference write when no region
   exists. With Viewport All the preference must be written (and viewports refreshed) **even with no regions**:
   ToggleAutoRefresh then writes 0, ToggleSelectionTracking writes true, SetRefreshMode / SetDisplayType write the
   argument (Q3).
3. `renderB19a.ts` `getMode`: with Viewport All read the preference **without** resolving regions (currently returns
   nothing when no region exists) (Q3).
4. `renderB19a.ts` `syncRegions`: `rr.autoRefresh = cur.refreshMode === 0` is right only by accident; the toggle is
   Interactive (0) ↔ CTRS (1), and `rendering.region_auto_refresh` is a separate boolean preference the command does
   not touch (Q2).
5. `renderB19a.ts` `parseFrameSet`: replace the regex grammar with the parser of Q5: an empty token invalidates the
   set (src skips empty tokens); no `x<step>` suffix (src accepts it); ranges only with `-` after the first
   character, always step 1; fractional values allowed; lenient numeric prefix (`_wtof`), at most one punctuation
   character per number; result is a **sorted, de-duplicated** set (src keeps typed order and duplicates).
6. `renderB19a.ts` `siCreatePass`: the pass test is "the created object is a pass", not `/pass/i` on the preset name;
   FrameSet is `"<trunc In>-<trunc Out>"` while FrameStart/FrameEnd are rounded half away from zero; skip objects
   with no owning model below the root and keep the two partition lists as "light class → first, camera class →
   none, everything else → second" (src already does lights / non-cameras) (Q8).
7. `renderB19a.ts` `siCreateEmptyPartition`: the lock test is the level-1 lock status of the pass (src uses an
   ad-hoc `locked || lockLevel`); a non-VT_I4 `Type` keeps the default instead of being validated as an enum string
   (Q4, Q9).
8. `renderB19a.ts` `RemoveRenderChannel`: the handler has no `Main` guard and does no comparison of its own; keep the
   lookup in the channel-manager model (its case rule is unattested) and drop the "Main" special-case log (Q7).
9. `src/commands/selectionB19d.ts` `setAndToggleSelection`: when the resolved (expanded) list has no usable item the
   command must return `0x562e80c7` **without touching the selection** (src clears it through `selectObj` with an
   empty list); remove the "owner pre-check" not-yet-attested log (Q35).
10. `selectionB19d.ts` `hierarchyLevel`: `LEVEL_NAMES` lacks `CHAIN` and `NODE OR BRANCH`, so the registry names used by
    other selection commands throw `E_INVALIDARG`; accept all six names (numbers other than ASITIS = 0 still
    unattested) (Q40).
11. `selectionB19d.ts` `activateSelTool`: status is `S_OK` only when the filter change reported a change; otherwise ask
    "do not record" and return `S_FALSE`, for normal calls too (src returns `S_OK` for every non-held call) (Q41).
12. `selectionB19d.ts` `chooseTool`: apply the family test: a component filter whose families derive from
    `0f47fe72` activates `e9cdd760` (src always activates `11778840` and logs not-yet-attested) (Q36).
13. `src/ui/keymap.ts` lines 52–55: "Point / Edge / Polygon / Raycast … / Object Select Tool" (and their Extended
    variants) call `setSelMode` directly; they must run the bound commands (`ActivateVertexSelTool`, … table in Q47)
    so the filter change, ambient values and tool activation happen.
14. `src/commands/ui.ts:12` and `src/commands/index.ts:261` register `ActivateObjectSelTool` as a stand-in; it is the
    same class `d9eb4110` with registry defaults `SelFilter` = `object_only_if_current_is_subcomponent_one`,
    `DeselectOnNewFilter` true, `GroupMode` false, `SelRegionMode` 1; route it to the B19d `activateSelTool`.
15. `src/commands/index.ts:321–326`: `NextFrame`, `FirstFrame`, `LastFrame`, `PlayForwards`, `PlayForwardsFromStart`
    are still stand-ins (NextFrame clamps at the end, PlayForwards does not stop when playing or jump to start at the
    end, all `undoable: false`, no `Type` / `Transport` args, `PlayForwardsFromStart` labelled "Play"). Add them to
    `TRANSPORT_ROWS` in `selectionB19d.ts` with Types 0 / 2 / 3 / 7 / 10 (Q46).
16. `src/ui/keymap.ts:79`: "Play in Real Time" runs `PlayForwards`; it must run `PlayRealTime` (Type 5) (Q46).

## Status changes

None. `SICreatePass` (timing object identity, partition classes, model flag 0x8), `SetAndToggleSelection`
(selection manager +0x110 lists), and the render / export commands (render manager range record) keep
SPEC-PARTIAL; the commands answered here were already SPEC.
