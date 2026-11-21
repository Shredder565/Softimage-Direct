# CMD-B19a: render region, pass rendering / render-archive export, render channels, passes and partitions (`rendercore.dll`)

Row: **CMD-B19a**. Status: **SPEC** 16 (the 12 `RenderRegion*` commands, `RemoveRenderChannel`,
`SICreateEmptyPartition`, `MoveToPartition`, `RenderPassToggleShowRenderedImage`), **SPEC-PARTIAL** 6 (`SICreatePass`,
`SIRenderPass`, `RenderPassesFrameSet`, `RenderSelectedPasses`, `ExportRenderArchiveFrameSet`,
`ExportRenderArchiveAllPasses`), **LOCK** 0.
Run: 2026-11-20, si-analyst worker batch 19 (binary first, REA + Ghidra).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary (opened alone, closed at the end):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\rendercore.dll`, sha256
  `df47a0fda7b38ceb2533e487469f9ad331068de9797c7d8e2116f41efb7ec167` (same build as `cmd-b16d`).
- `sicoresdk.dll` (second registry candidate for `RemoveRenderChannel`, `SICreatePass`, `SICreateEmptyPartition`): not
  opened; all three handler CLSIDs are served by rendercore's `DllGetClassObject`, so it is not needed.

Method: the 19 distinct handler CLSIDs were byte-searched; rendercore keeps an `.rdata` table of GUID copies at
`0x1800ebb00…0x1800ebe80` where each handler CLSID sits next to its command GUID. `DllGetClassObject` (`0x18009fb90`)
compares CLSIDs as two 64-bit immediates; each branch allocates a 0x48-byte factory with its own vtable (slot 6 =
create). Create → constructor → task object; the task sub-object at +0x18 has the task vtable (slot 5 = Do, slot 8 =
UnPackArg, slot 9 = RePackArg) and the sub-object at +0x38 the worker vtable (slot 9 = real work, slots 10/11 =
variants). All of create / ctor / UnPackArg / RePackArg / Do / worker were decompiled for every command; helper task
CLSIDs were matched to `data/command_registry.json`. Statements are behaviour read from the binary unless marked
`(inferred)`.

## 1. Handler table

| Command | scripting name | DLL | Handler (CLSID, factory vtable, create, task vtable: Do / UnPackArg / RePackArg, worker) | Status |
|---|---|---|---|---|
| Create Render Region | `RenderRegionCreate` | rendercore | `0e8b832b…` fvt `0x1800ee7b0`, create `0x18009ef60`, tvt `0x1800ee6f0` Do `0x18007b6c0` / Unpack `0x18007c1c0`, worker `0x180079db0` | SPEC |
| Close Render Region | `RenderRegionClose` | rendercore | `ed9ad458…` fvt `0x1800ee900`, create `0x18009ef20`, tvt `0x1800ee840` Do `0x18007b700` / Unpack `0x18007c8a0`, worker `0x180079c70` | SPEC |
| Show/Hide Render Region | `RenderRegionToggleVisibility` | rendercore | `8eb36c47…` fvt `0x1800eea50`, create `0x18009f260`, tvt `0x1800ee990` Do `0x18007b700` / `0x18007c8a0`, worker `0x18007b500` | SPEC |
| Refresh Render Region | `RenderRegionRefresh` | rendercore | `73c236cc…` fvt `0x1800eeba0`, create `0x18009f060`, tvt `0x1800eeae0` Do `0x18007b700` / `0x18007c8a0`, worker `0x18007a320` | SPEC |
| Toggle Auto-Refresh | `RenderRegionToggleAutoRefresh` | rendercore | `7397235e…` fvt `0x1800eecf0`, create `0x18009f1e0`, tvt `0x1800eec30` Do `0x18007b700` / `0x18007c8a0`, worker `0x18007b0a0` | SPEC |
| Toggle Selection Tracking | `RenderRegionToggleSelectionTracking` | rendercore | `b8111b1f…` fvt `0x1800eee40`, create `0x18009f220`, tvt `0x1800eed80` Do `0x18007b700` / `0x18007c8a0`, worker `0x18007b2d0` | SPEC |
| Set Display Type | `RenderRegionSetDisplayType` | rendercore | `e05bf051…` fvt `0x1800ef100`, create `0x18009f120`, tvt `0x1800ef040` Do `0x18007b730` / Unpack `0x18007c5c0`, worker `0x18007a990` | SPEC |
| Get Display Type | `RenderRegionGetDisplayType` | rendercore | `22d5b7bd…` fvt `0x1800ef250`, create `0x18009efa0`, tvt `0x1800ef190` Do `0x18007b700` / `0x18007c8a0` / RePack `0x18007bfa0`, worker `0x180079f90` | SPEC |
| Set Refresh Mode | `RenderRegionSetRefreshMode` | rendercore | `23366fa3…` fvt `0x1800ef3a0`, create `0x18009f160`, tvt `0x1800ef2e0` Do `0x18007b730` / Unpack `0x18007c6b0`, worker `0x18007ab50` | SPEC |
| Get Refresh Mode | `RenderRegionGetRefreshMode` | rendercore | `fe8e6c35…` fvt `0x1800ef4f0`, create `0x18009efe0`, tvt `0x1800ef430` Do `0x18007b700` / `0x18007c8a0` / RePack `0x18007bfa0`, worker `0x18007a0a0` | SPEC |
| Set Viewing Render Channel | `RenderRegionSetRenderChannel` | rendercore | `d2db1c46…` fvt `0x1800ef640`, create `0x18009f1a0`, tvt `0x1800ef580` Do `0x18007b750` / Unpack `0x18007c7a0`, worker `0x18007ad00` | SPEC |
| Get Viewing Render Channel | `RenderRegionGetRenderChannel` | rendercore | `9fe194dc…` fvt `0x1800ef790`, create `0x18009f020`, tvt `0x1800ef6d0` Do `0x18007b700` / `0x18007c8a0` / RePack `0x18007c030`, worker `0x18007a1b0` | SPEC |
| Remove Render Channel | `RemoveRenderChannel` | rendercore | `63ea7a1d…` fvt `0x1800ef838`, create `0x18009ec60` (0x68), tvt `0x1800e6c50` Do `0x1800881f0` (no Ghidra function) / Unpack `0x18008bf50`, worker `0x180086ac0` | SPEC |
| Low Level Create Pass | `SICreatePass` | rendercore | `8df69d1c…` fvt `0x1800ef950`, create `0x18009eb20` (0xb8), tvt `0x1800e72b0` Do `0x180087ea0` / Unpack `0x18008abb0` / RePack `0x180089ef0`, worker `0x180085230`, partition fill `0x18008c760` | SPEC-PARTIAL |
| Create Empty Partition | `SICreateEmptyPartition` | rendercore | `075d89ea…` fvt `0x1800ef988`, create `0x18009eae0` (0x80), tvt `0x1800e73c0` Do `0x180087e60` / Unpack `0x18008a960` / RePack `0x180089ec0`, worker `0x180084e20` | SPEC |
| Move to Partition | `MoveToPartition` | rendercore | `bb1fd79d…` fvt `0x1800ef9f8`, create `0x18009ec20` (0x58), tvt `0x1800e75e0` Do `0x180088120` / Unpack `0x18008bb10` (delegates to task `1c7c2c98`) | SPEC |
| Render Pass / Render Passes Using a Frame Set / Render Selected Passes | `SIRenderPass`, `RenderPassesFrameSet`, `RenderSelectedPasses` | rendercore | `789e9083…` (shared) fvt `0x1800ef870`, create `0x18009eee0` (0xb0), tvt `0x1800e6d60` Do `0x180088410` / Unpack `0x18008c130`, worker slots 9/10/11 `0x180086fe0` / `0x1800875b0` / `0x180087ac0` | SPEC-PARTIAL |
| Export Passes to Render Archive / Export All Passes | `ExportRenderArchiveFrameSet`, `ExportRenderArchiveAllPasses` | rendercore | `c2906297…` (shared) fvt `0x1800ef8a8`, create `0x18009ebe0` (0xb8), tvt `0x1800e6eb0` Do `0x180088010` / Unpack `0x18008b550`, worker slots 9/10/11 `0x1800860f0` / `0x180087320` / `0x180087870` | SPEC-PARTIAL |
| Toggle Show Rendered Image | `RenderPassToggleShowRenderedImage` | rendercore | `4dd638c4…` fvt `0x1800efa30`, create `0x18009eea0` (0x48), tvt `0x1800e76f0` Do `0x180088220` (no UnPackArg: slot 8 is the base stub) | SPEC |

None of the shared-CLSID handlers branches on the command GUID or name: they differ only by which arguments the
registry entry provides (a missing argument reads as VT_EMPTY).

## 2. Shared facts

### 2.1 Render-region viewport resolution (all 12 `RenderRegion*` commands)
- Every UnPackArg first reads `Viewport` (VT_BSTR → `_wtol`, or VT_I4). A value **below −3** logs
  `XSIRENDERCORE` string 2 (formatted with the value, severity 4) and resolves to nothing.
- The resolver (`0x18007c9a0`, args: viewport code, create flag, out map viewport-id → region) asks the viewport
  manager for the list of viewport ids, then:
  - **≥ 0**: the viewport whose id equals the code (inferred: `siViewportA..D` = 0..3);
  - **−1**: every viewport (`siViewportAll`);
  - **−2**: the manager's current/focused viewport (`siViewportCurrent`) (inferred name);
  - **−3**: the manager's other designated viewport (inferred: `siViewportUnderMouse`).
  For each resolved viewport it asks the render-region service for that viewport's region; **only Create passes the
  create flag**, so every other command acts only on viewports that already have a region. Nothing resolved → status
  1 (S_FALSE), and the command does nothing. Missing services → `E_POINTER`.
- When the code is **−1 (All)**, the Set/Toggle commands also write the matching **user preference** and ask the
  viewport manager to refresh; the Get commands with −1 read the preference instead of a region.
- None of the region commands is undoable (no undo storage, no AddTask); none returns a value except through the
  `Value` output argument of the three Get commands.

### 2.2 Pass-list argument (render and export handlers)
UnPackArg builds a new list from `Passes`: each item that supports the pass interface is kept; an item that is not a
pass but has a name is skipped with log `XSIRENDERCORE` string 0x19 (formatted with its name, severity 4). An
**empty result** logs `XSIRENDERCORE` string 0x1a with severity 2 (error) and no frame arguments are read.
Frame arguments, first match wins:
1. `FrameSet` is a string: parsed by the frame-set parser (`0x1800a77e0`); a valid, non-empty set is used. An
   empty / unparsable string leaves no frame set (and `Verbose` is then not read).
2. Otherwise `StartFrame`, `EndFrame` (VT_EMPTY = not given), `StepFrame`; when Start and End are both given and Step
   is not, Step = 1. Render converts Start/End to **double**, Export to **int**; Step is int.
3. `Verbose` is kept only if it is VT_I4 **0 or 1**, else −1 (default verbosity).

## 3. Wire contracts

### `RenderRegionCreate`: SPEC
- Args: `Viewport` (default `siViewportCurrent`), `Left` 0.1, `Right` 0.9, `Top` 0.1, `Bottom` 0.9. The four bounds
  are taken only if **all four are VT_R4**; otherwise none is stored (inferred: the region keeps its zero bounds).
- Steps: (1) raise the notification property `RENCORE_FLUSH_DELAYED_RENDERREGION_INIT`; (2) resolve viewports **with
  create** (a region object is made for a viewport that has none); (3) for each region set bounds (left, right, top,
  bottom, in that order), then make it **visible**.
- Returns nothing. Not undoable.

### `RenderRegionClose`: SPEC
Resolve viewports (no create) and close each region (region slot 0x78). Nothing if no region. Returns nothing.

### `RenderRegionToggleVisibility`: SPEC
Over the resolved regions: if **any** is visible, hide **all**; otherwise show all (one shared new state). No
preference write. Returns nothing.

### `RenderRegionRefresh`: SPEC
Each resolved region that is **visible** is re-rendered (slot 0x68); hidden regions are skipped. Then one global
render-service refresh is requested (`DSQueryGenericObject` object at `0x1800eb220`, slot 0x398) regardless of how
many regions there were. Returns nothing.

### `RenderRegionToggleAutoRefresh`: SPEC
Default viewport **All**. If **any** resolved region has refresh mode **0**, all regions get mode **1**; otherwise all
get mode **0**. With All, the preference `rendering.region_refresh_mode` is set to the new mode and the viewports are
refreshed. (Inferred: mode 0 = `siRenderRegionRefreshModeInteractive`/automatic, 1 = manual; the toggle is therefore
"auto-refresh off if any region is auto".)

### `RenderRegionToggleSelectionTracking`: SPEC
If **any** resolved region tracks selection, all stop; otherwise all start. With All, preference
`rendering.region_track_selection` = new state, viewports refreshed. Default viewport is `siViewportCurrent`, so the
preference is written only when the caller passes All.

### `RenderRegionSetDisplayType`: SPEC
`Type` (VT_BSTR → `_wtol`, or VT_I4; default `siRenderRegionDisplayRGBA`) is passed unchanged to every resolved region
(slot 0x80). With All: preference `rendering.region_display_mode` = Type, viewports refreshed. No range check.

### `RenderRegionGetDisplayType`: SPEC
Viewport All → reads preference `rendering.region_display_mode`; otherwise the display type of the **first** resolved
region. RePackArg writes output `Value` as **VT_INT (22)**. No region for a non-All viewport: the binary reads the
empty map without checking (undefined; see open questions).

### `RenderRegionSetRefreshMode`: SPEC
Same as SetDisplayType with arg `RefreshMode` (default `siRenderRegionRefreshModeInteractive`, default viewport
**All**), region slot 0x40, preference `rendering.region_refresh_mode`.

### `RenderRegionGetRefreshMode`: SPEC
Same as GetDisplayType with preference `rendering.region_refresh_mode` / region slot 0x48; `Value` VT_INT.

### `RenderRegionSetRenderChannel`: SPEC
- `RenderChannel` must be VT_BSTR; empty → **`Main`**.
- Phase 1: every resolved region must offer a channel (its framebuffer/channel list, slot 0x98) whose name equals the
  argument **case-insensitively**; a region without it → **`E_INVALIDARG`** and nothing changes. A null list item →
  `E_POINTER`.
- Phase 2: each region's current channel is set to the matching item. Returns nothing. No preference write.

### `RenderRegionGetRenderChannel`: SPEC
Viewport **All → `E_INVALIDARG`** (there is no preference for it). Otherwise the first resolved region's current
channel name; no current channel → `E_POINTER`. Output `Value` VT_BSTR.

### `RemoveRenderChannel`: SPEC
- `Name` must be a **non-empty** VT_BSTR, else `E_INVALIDARG`.
- Worker: get the render-channel manager (`E_POINTER` if absent); look the channel up by name; **not found →
  `E_INVALIDARG`**. With undo, the channel's type is saved first.
- Walk all passes of the pass container (`F3DGetPassContainer`); for each pass collect the framebuffers that use the
  channel (pass slot 0xc0); if any were found, run the low-level **`DeleteObj`** task (`dd531990-ccc2-11d2-ac73-…`,
  `Delete Objects`) on them (undo recorded), so **every pass's framebuffers on that channel are deleted** first.
- Then remove the channel from the manager. Returns nothing (no RePackArg). The handler has no special case for
  `Main` (whether the manager refuses it is not visible here).

### `SICreatePass`: SPEC-PARTIAL
- Args: `PresetObj` (preset, required: a missing argument `0x80020008` is turned into `E_INVALIDARG`), `Name`
  (optional string), output `Value`.
- Worker: create the object from the preset (`SICreateObjectAndUpgradeFromPreset`). If the result is **not a pass**:
  log `XSIRENDERCORE` 0x17 (formatted with the preset name, severity 2) and stop. If `Name` is non-empty, set it
  (failure stops). Add the pass to the pass container. Then read the scene's timing object (inferred: PlayControl
  `In`, `Out` and a step-type value) and set four parameters of the new pass, ids **0x1c** = round(In), **0x1d** =
  round(Out), **0x1e** = the third value (int), **0x1f** = the string `"<In>-<Out>"` (inferred: `FrameStart`,
  `FrameEnd`, `FrameStep`, `FrameSet`). Then fill the pass's default partitions (`0x18008c760`): every scene object
  without flag bit 8 is added to one of the two pass partitions — objects of class `3a9eca63-4f91-11d0-…` to the first,
  everything except class `9f43b240-58e5-11d0-…` to the second (inferred: lights → background lights partition,
  other non-camera objects → background objects partition).
- Undo: soft reference to the pass, preset name and name are kept. `Value` = the new pass (as an element reference).
- The handler does **not** make the pass current (that is the `CreatePass` script's job, `cmd-b17c`).
- Gap: exact identity of the timing parameters and the two partition classes.

### `SICreateEmptyPartition`: SPEC
- Args: `Target` (list; default `Passes.Current`), `Name` (default `Partition`), `Type` (VT_I4; default
  `siObjectPartition`), output `Value`.
- UnPackArg keeps the pass items of `Target`. `Name` must be a non-null VT_BSTR, else `E_INVALIDARG`.
- Worker: empty Name or **Type not 1 or 2 → `E_INVALIDARG`**. For each target pass: a **locked** pass raises the lock
  error and is skipped; otherwise a new partition of class `8b291ad2-aac2-4f09-a027-b47e6c11e4ac` (Type 1) or
  `7a1bb9d6-58a3-49d6-84ba-39429edad489` (Type 2) is created, named `Name`, and added to the pass (inferred: 1 =
  `siObjectPartition`, 2 = `siLightPartition`). A non-pass item reaching the worker → `E_POINTER`.
- `Value` = a collection of the new partitions (one per pass), written as VT_UNKNOWN. Undo keeps copies of the
  target list and the output list plus Name and Type.
- The handler does not make the name unique (inferred: the scene's naming rules apply when the name is set).

### `MoveToPartition`: SPEC
- Args: `Target`, `InputObjs`, `Source` (all object lists, selection handler).
- UnPackArg: Source = the first **pass** in `Source` (may be none). Target = the first item of `Target` that is a
  partition of kind **5 or 6** and, if a Source pass was found, **belongs to that pass** (owner looked up in the pass
  container and compared by identity); none → **`E_INVALIDARG`**. `InputObjs` is taken as is. Missing pass service →
  `E_POINTER`.
- Do: same as `MoveToLayer`'s low-level task (`1c7c2c98-dd95-45c5-802b-3c7334b7edc0`) run on (partition, InputObjs);
  with undo it is added as a sub-task. Returns nothing. (Inferred from `MoveToLayer`: membership is exclusive, the
  objects leave the pass's other partitions.)

### `SIRenderPass`, `RenderPassesFrameSet`, `RenderSelectedPasses`: SPEC-PARTIAL
- One handler; arguments per section 2.2. `SIRenderPass`'s **`PresetObj` and `DisposeRendering` are never read**
  (the string `DisposeRendering` is not in the DLL). `RenderSelectedPasses` has only `Passes` (default: the selection).
- Do, first match: a frame set → worker slot 11 (render jobs with that frame set); Start and End both given → slot 10
  (start, end, step); otherwise slot 9 (each pass's own frame range). A worker result **`E_ABORT` becomes
  `0x562e80c7`** (user cancel status).
- Worker (all three): build one render job per pass (`0x180083320`, render mode), append a suffix to each job name,
  apply the frame choice, set job property **`frame_offset`** = number of frames of all earlier jobs, then set
  **`frame_total`** = total frames on every job, then run the jobs (`0x18008f330`). Frame count per job: start/end/step
  → `(end − start) / step + 1`; frame set → its count; own range → by the pass's range type (0 none, 1 start/end/step,
  2 explicit count). Errors from job setup → `E_FAIL`.
- Gap: the renderer and job internals (`0x180083320`, `0x18008f330`) were not read; display of the rendered image is
  driven by the preference of `RenderPassToggleShowRenderedImage` (inferred).

### `ExportRenderArchiveFrameSet`, `ExportRenderArchiveAllPasses`: SPEC-PARTIAL
- One handler; arguments per section 2.2 (integer frames). `ExportRenderArchiveAllPasses` passes only `Passes`
  (default `Passes.List.*`), so it always exports each pass's own range.
- **Refused in a restricted application mode** (`SIGetAppMode` slot 0x50 true): raises `simsgcat` message 0x143 with
  `0x80004021` (checked in UnPackArg, Do and every worker) (inferred: a licence/edition that cannot export archives).
- Do dispatches like render (frame set → slot 11, start/end → slot 10, else slot 9). Workers prepare the pass list
  (`0x180090690`), build export jobs (`0x180083320`, export mode), suffix the job names, set the range and run the
  export (`0x18008ea60`); no `frame_offset` / `frame_total`.
- Own range (slot 9) is read from the pass: parameter 0x1b is the **range source**; source 3 means "use the scene
  render options" (parameters 0xc–0x10 of the global options object). Source **0** → start 0x1c, end 0x1d, step 0x1e
  (step < 1 → 1); **1** → frame-set string 0x1f (invalid → log `XSIRENDERCORE` 0x37 with the string and the pass
  name, severity 2, `E_INVALIDARG`); **2** → scene timeline In/Out (rounded); anything else → `E_UNEXPECTED`
  (`0x8000ffff`).
- Gap: archive writing itself (`0x18008ea60`) not read; file naming is the renderer's.

### `RenderPassToggleShowRenderedImage`: SPEC
No arguments. Reads preference `rendering.render_pass_show_rendered_images` and runs **`SetValue`** (task
`c089b901-8481-11d2-b118-00a024c79287`) on `Preferences.rendering.render_pass_show_rendered_images` with the negated
value (VT_BOOL); the SetValue is added as an undoable sub-task. Returns nothing.

## 4. Open questions
1. `siViewport` numeric values: −1/−2/−3 behaviour is read from the binary, the enum names attached to −2/−3 are
   inferred; check against the SDK headers.
2. Get commands on a viewport that has no region (non-All): the binary does not check for an empty result.
3. Meaning of refresh modes 0/1 and of the display-type integers (`siRenderRegionDisplayType`) is not in the DLL.
4. `SICreatePass` timing parameter identities (0x1c–0x1f, the third timing value) and the partition classes used by
   the default-partition fill.
5. Render / export job internals (job builder, render loop, archive writer) were not decoded.
6. Whether the render-channel manager refuses removing `Main`.

## 5. Corrections for the wire agent
Current wiring: region commands in `src/commands/renderToolbarOm.ts` and `src/commands/moduleToolbar.ts` (one global
region object), render/export in the same files plus `src/core/sceneRender.ts`, partitions/pass in
`src/commands/duplicateRenderingSimulationScriptsRendering.ts` (stand-ins).
1. All `RenderRegion*`: `Viewport` default is `''`; use the registry enum defaults (`siViewportCurrent`, and
   **`siViewportAll`** for `RenderRegionToggleAutoRefresh` / `RenderRegionSetRefreshMode`) and keep state **per
   viewport**; non-Create commands do nothing for a viewport without a region.
2. `RenderRegionCreate`: returns the region object; Softimage returns nothing. Bounds are used only if all four are
   floats.
3. `RenderRegionToggleVisibility` / `ToggleSelectionTracking` / `ToggleAutoRefresh`: "any on → all off, else all on"
   across the resolved regions; with All also write the preference (`rendering.region_track_selection`,
   `rendering.region_refresh_mode`).
4. `RenderRegionToggleAutoRefresh` toggles the **refresh mode** (0 ↔ 1), not a separate `autoRefresh` flag; wire keeps
   `rr.autoRefresh` unrelated to `rr.refresh`.
5. `RenderRegionRefresh`: only visible regions are re-rendered.
6. `RenderRegionSetDisplayType` / `SetRefreshMode`: the value is an **integer** enum passed through; wire maps name
   substrings to labels. With All, write `rendering.region_display_mode` / `rendering.region_refresh_mode`.
7. `RenderRegionGetDisplayType` / `GetRefreshMode`: return the integer through output `Value` (VT_INT), not a label
   string; with All read the preference.
8. `RenderRegionSetRenderChannel`: validate the channel exists (case-insensitive) on every target region, else
   `E_INVALIDARG` with no change; return nothing (wire returns the name).
9. `RenderRegionGetRenderChannel`: Viewport All must raise `E_INVALIDARG`; value through output `Value`.
10. `RemoveRenderChannel`: empty `Name` and unknown channel are `E_INVALIDARG`; first delete (via `DeleteObj`,
    undoable) every framebuffer using the channel in **all passes**; return nothing (wire returns the removed record
    and has a `Main` guard the handler does not have).
11. `RenderPassToggleShowRenderedImage`: toggle the preference `rendering.render_pass_show_rendered_images` through
    `SetValue` (undoable, logged), not a local `rr.showRenderedImage`; return nothing.
12. `RenderPassesFrameSet`: the frame set is applied to the render jobs; it must **not** be written into the pass's
    `FrameSet` parameter (wire writes it into the last pass). Empty frame set = each pass's own range.
13. `SIRenderPass`: ignore `PresetObj` and `DisposeRendering`; an explicit range needs both Start and End (Step
    defaults to 1); a user abort returns the cancel status `0x562e80c7`.
14. `RenderSelectedPasses` (and the other two): non-pass items are logged (`XSIRENDERCORE` 0x19) and skipped; no pass
    left logs error 0x1a and renders nothing; there is **no fallback to the current pass** in the handler (wire falls
    back).
15. `ExportRenderArchive*`: refuse with `simsgcat` 0x143 / `0x80004021` in the restricted mode; own range follows the
    pass's range source (0 start/end/step, 1 frame set, 2 timeline, 3 render options).
16. `SICreatePass`, `SICreateEmptyPartition`, `MoveToPartition` are not registered on the bus (stand-in functions
    only); register them with the contracts above so scripts and presets can call them.
17. `SICreateEmptyPartition`: `Type` is numeric 1/2 (anything else `E_INVALIDARG`; wire treats numbers as "not
    attested" and falls back to object); an empty `Name` is `E_INVALIDARG` (wire falls back to `Partition`); one
    partition per target pass, `Value` is a collection; the handler does not uniquify the name.
18. `SICreatePass`: set the new pass's frame range from the timeline (`FrameStart`/`FrameEnd`/`FrameStep`/`FrameSet`
    `"<in>-<out>"`, inferred names) and fill its background partitions; a preset that is not a pass logs error 0x17.
19. `MoveToPartition`: resolve `Target` to the first object/light partition of the `Source` pass; none →
    `E_INVALIDARG`.
