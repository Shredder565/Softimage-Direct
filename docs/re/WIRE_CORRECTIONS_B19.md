# Wire corrections, batch 19 (si-analyst, 2026-11-20)

Corrections to the current wiring in `src/` found while reading the batch-19 handlers (built-in commands that had no
contract in any note). The items are copied from §5 of each note; the full contracts are in the notes. The analyst
does not edit `src/`.

## CMD-B19a ([cmd-b19a-rendercore-region-passes.md](../ghidra/cmd-b19a-rendercore-region-passes.md))

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

## CMD-B19b ([cmd-b19b-tasks-scene-layers-loops.md](../ghidra/cmd-b19b-tasks-scene-layers-loops.md))

1. `NewScene` (`src/commands/index.ts` 357): `Confirm` default is **true** (src false); add `ProjectPathName`;
   honour preference `data_management.default_scene_path` (open that scene when usable, else warning + empty).
2. `DeleteAll` (`src/commands/viewEditProperty.ts` 414): same handler as `NewScene`; it is a new-scene, not a
   delete-traverser over all objects (inferred; same CmdID); not undoable.
3. `OpenScene` / `SaveScene` (`src/commands/ui.ts` 32-33): add `SceneFileName`, `Confirm=true`,
   `ApplyAuxiliaryData=false` to OpenScene; non-`.scn` files go through custom import/export handlers (none ->
   E_INVALIDARG); SaveScene failure -> E_FAIL "save failed".
4. `Copy` / `Paste` (`src/commands/model2.ts` 475-476): add `InputObjs` (default selection); Paste pastes the
   clipboard under each target (default scene root model) rather than `Duplicate` of the copied list.
5. `Cut`: no command is registered (keymap does Copy + DeleteObj). Register `Cut(InputObjs)`: empty list ->
   E_INVALIDARG (message 0x78); otherwise copy + undoable delete.
6. `SetCurrentLayer` (`src/commands/anim.ts` 239): args are `Value` (object) and `Type` (default 1), not `Name`;
   class check -> E_FAIL; **undoable**. Same code as `SetCurrentParType`.
7. `SetCurrentPass`: only a trace stand-in exists; register it as `SetCurrentParType` with Type default 0
   (pass-change events 0x20510029 / 0x2051002a).
8. `CreateLayerGroup` (`src/commands/selectionGroupLayer.ts` 617): binary creates a **layer** from the preset (via
   SICreateLayer) and moves `InputObj` **into** it (MoveObjectToLayer); src builds a separate LayerGroup and
   treats InputObj as the parent.
9. `SICreateLayer2` (`selectionGroupLayer.ts` 606 / `createLayer` 245): LayerGroupName is ignored by the binary
   (no "layer group not found" error, no placement in a group).
10. `SICreateLayer` / `SICreateLayer2`: a non-layer preset -> warning 0x419 and no layer; no name uniquifying in
    the task; missing PresetObj -> E_INVALIDARG.
11. `CutLayerParent` (`selectionGroupLayer.ts` 626): only the **first** layer of InputObjs is processed; no layer
    -> E_INVALIDARG (src loops all nodes, returns a count).
12. `MoveObjectToLayer` (`selectionGroupLayer.ts` 608): empty / layer-less Target -> E_INVALIDARG (not
    `Unattested`); only the first layer of Target is used; a layer as input is nested under the target.
13. `GrowSelectedLoops` / `ShrinkSelectedLoops` (`selectionGroupLayer.ts` 474-476): point and polygon selections
    are handled too (not edges only); Grow = SelectObj(input) + AddToSelection(new), Shrink = SelectObj(input) +
    RemoveFromSelection(removed), each undoable.
14. `AddContainerToEnvironment` call in `src/commands/operatorsScriptsMore.ts` 219 passes `Family` / `Type: 1`;
    registry args are `Environment, Type (string "Default"), Support3DObject (bool), Name`.
15. `InstallCustomPreferences`, `RemoveFolder`, `CopyUVW`, `PasteUVW`, `SIGetPreset`: only inferred arg stubs /
    trace stand-ins exist; wire from section 3.
16. `DeselectAllUsingFilter` (`selectionGroupLayer.ts` 384): binary removes only the filter-matching components
    (not all components of that kind of the current object) and is undoable via RemoveFromSelection.

## CMD-B19c ([cmd-b19c-optasks-ice-cns-envelope.md](../ghidra/cmd-b19c-optasks-ice-cns-envelope.md))

1. `AddStaticICEAttribute` / `Remove…` / `Rename…` / `SetStaticICEAttributeType` / `Toggle…`
   (`src/commands/iceModule.ts` 418–500): they ignore `Object` and act on `app.selectedObjects`; they model
   attributes as properties. Binary: attributes live on the **geometry** of `Object`; `AttributeName` is a
   comma list; strict validation and error ids (§2); Add rejects existing names (`0x435`); Remove/Rename/
   SetType require a persisted attribute (`0x434`); Rename requires exactly one name and a free, normalised
   new name; SetType's `None` values mean keep; Toggle flips per attribute (no property created).
2. `ExportICECompoundNode` (iceModule 358): writes `.icetree.json`. Binary path rule `Directory\Name[.maj.min].xsicompound(p)`,
   renames compound when `Name` differs, sets `Output` to the path; Private refusal `0x427`.
3. `CreateICECompoundNode` (iceModule 301): adds a Comment node with default name `Compound`; binary default
   name is `CompoundNode`, a real compound containing the input nodes, missing nodes → `0x80070057` / `0x173`.
4. `ExplodeICECompoundNode` (iceModule 346): log only; binary removes the compound and moves nodes out.
5. `EditICECompoundProperties`: no direct registration (only used by the PPG-logic script path); add it with the
   `SetMask` bit table and language check (`0x1a6`).
6. `RemoveCns` (`src/commands/constraints.ts:79`): wired with args `InputObjs`, `Type` and removes only the
   last constraint. Binary args are `ConstrainedObj`, `ConstrainingObj`, `ForceDeletion`; removes all
   constraints (or those to `ConstrainingObj`); may start a pick session for one object.
7. `RemoveCnsType` (`viewEditPropertyMore.ts:224`): empty Type is a log-and-return; binary: non-string → E_INVALIDARG,
   unknown name → `SIGetKineCnsIDFromName` error, ids 0/17/29 and non-object items → E_INVALIDARG; one undoable
   `DeleteObj`.
8. `RemoveFlexEnv` (`rigging.ts:61`): deletes envelope op + property directly; binary goes through `DeleteObj`
   of the envelope-related objects and accepts clusters too.
9. `LockEnvelopePointWeights` / `ClearEnvelopeWeightLocks` (`rigging.ts:66-67`): use selection, ignore
   `PropObj`/`SubComp`; binary creates the lock operator on demand, returns it as `OutputObj`, warnings `0x6f` /
   `0x80` with status 1, skips points outside the envelope.
10. `DeleteMotionDerivator` (`inferredB10Scene.ts:523`): searches the primitive stack by name; binary searches
    the global kinematic state's operators by class, deletes only the first per object, and sets
    kine-state `velaccactive` (index 0x1b, inferred) to 0.
11. `ConnectMap` (`inferredB10Scene.ts:364`): should apply a `MapComponentOp` (`c70b63f1-…`) with inputs
    [PropObj, Target], mode 2, and do nothing if Target already has one.
12. `RemoveProxyParam` (`anim.ts:273`): removes any proxied/expression param of the first custom set of selected
    objects; binary removes only the listed proxy parameters, empty list → warning `0x2b` status `0x562e80d2`.
13. `SwapOperators` (`viewEditProperty.ts:486`): check that the four error mappings and the status-1 warning
    `0x5f` (nothing swapped) exist.
14. `GetConstrainedObjects` (`viewEditPropertyMore.ts:237`): output should be an `OutputObjs` collection in the
    kinematics' order; matches otherwise.

## CMD-B19d ([cmd-b19d-selection-playback-isolate.md](../ghidra/cmd-b19d-selection-playback-isolate.md))

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
