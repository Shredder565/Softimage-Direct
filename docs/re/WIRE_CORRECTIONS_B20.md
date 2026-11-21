# Wire corrections, batch 20 (si-analyst, 2026-11-21)

Corrections to the current wiring in `src/` found while reading the batch-20 handlers. Items are copied from the
corrections section of each note; full contracts are in the notes. The analyst does not edit `src/`.

## CMD-B20a ([cmd-b20a-action-actioncore.md](../ghidra/cmd-b20a-action-actioncore.md))

Current wiring read in `src/commands/anim.ts` (registered first in `src/main.ts`, so it wins over
`animateSurface.ts`) and `src/commands/animateSurface.ts`. Read only.

1. `EqualizeAction` (`anim.ts:573`) is an alias of `EqualizeClips` (lays clips end to end). Wrong: it is the band
   equalizer of §3 (args `Source`, `Time`, `Duration`, `Name`; makes `<Name>_Band_<k>` sources, track
   `<Name>_Equalizer_Track`, compound `<Name>_Equalizer_Clip`; returns the compound clip; errors for non-fcurve items and
   unequal key counts).
2. `ExportAction` (`anim.ts:602`) ignores `Action` / `FileName` and writes JSON to localStorage. Should resolve
   `Action` (source, or clip → source), export only `.eani` / `.xsi` (case-sensitive), return E_FAIL for other
   extensions, fire file events `0x20510013` / `0x20510014`, return S_FALSE on success.
3. `ImportRefAction` (`anim.ts:620`) has no args and calls `ImportAction` unchanged. It must pass `ActionStorage = −1`
   (keep the file reference); `ImportAction` (`anim.ts:609`) lacks `ActionStorage` (default 0) and the extension
   validation (`.Preset`/`.xsi`/`.eani`, else 0x80070057).
4. `ReplaceShapeKey` (`anim.ts:346`) has no args and stores the raw (deformed) mesh positions. Should take
   `InputObj` + `ForceDeformStripping`, invert animation deformers at the current frame, honour the key's reference
   mode (absolute vs delta in reference frames), check element count (0x80004005), lock check, save old values for
   undo, and run `StripDeformOperators` when needed or forced.
5. `SIStoreAction` (`animateSurface.ts:744`, via `storeOverlapping`) forwards `Mode` raw and drops `Type`. Needs the
   Mode → class-mask table (0,1,2,4,8,0xe,0xf), `Type` = `ReturnOnly` / `TransientAction` / `UnownedAction` handling,
   and default `Name` `StoredAction`.
6. `AddTransition` (`anim.ts:517`): has a `Length` arg Softimage does not have and no `Type` arg; default name is
   `<from>_to_<to>`. Should take `Type` (0..2, >2 → 0) and `Name` (default `Transition`), fail on From == To
   (0x80004005) and on locked clips, delete the existing transitions on From's start side / To's end side first, refuse
   clips in different containers, and set the transition type parameter.
7. `AddTWTransition` (`anim.ts:533`): has `Length`, lacks `From Period` / `To Period` / `Name`; Softimage validates
   periods against clip spans, overlap and extrapolation (three errors of §3) and delegates to AddTransition type 2. The
   Desktop-attested `TW1` naming may stay, but the argument list and the checks should follow §3.
8. `AddMarker` (`animateSurface.ts:582`): stores JSON on the mixer, ignores `Container`, default name empty, returns a
   count. Should create a marker object in `Container` (or the model mixer), name `Marker` when empty, set time and
   duration, and return the marker.
9. `ReconnectMixer` (`anim.ts:597`) only logs counts. Should ask the model's (or given) mixer to reconnect; not
   undoable; 0x80004003 when no mixer.
10. `SwapRelationMasterAndSlaveClip` (`anim.ts:593`) swaps **all** relations and takes no args. Should take one
    `Relation` and swap only it; undo = swap again.
11. `AddClipRelation` (`anim.ts:588`) uses args `Master` / `Slave`. Registry / binary: `From`, `To`, `Name` (default
    `Relation`), output `Relation`; a two-item `From` list supplies both clips; refusal → log 0x16 + 0x80004005.
12. `MoveClipToTrack` / `CopyClipToTrack` (`anim.ts:574` / `:577`) take a track number and no `Time`. Should take
    `Model`, `Clip`, `Compound`, `Track` (track object), `Time` (frames), run the room test and fail with 0x19 / 0x1a +
    0x80004005; shot clips use the scene model.
13. `CreateCompound` (`anim.ts:551`) uses `Name` / `Clips`; should be `Model`, `InputObj`, `Compound`, `Track`, `Time`,
    `Name`, output `Clip`. `ExplodeCompound` (`anim.ts:562`) uses `Name`; should be `Model`, `Compound`.
14. Handler-DLL map: re-point `AddTransition`, `AddClip`, `CopyClipToTrack`, `CreateCompound`, `AddMarker` to
    actioncore.dll; `AddCustomOp` is not action.dll.

## CMD-B20b ([cmd-b20b-groups-env-skeleton-vcolor.md](../ghidra/cmd-b20b-groups-env-skeleton-vcolor.md))

1. `AddToPartition` (`src/commands/moduleToolbar.ts` 281): Target is optional — take the first partition found in
   InputObjs; expand ordinary groups in InputObjs to members; require Target kind partition (else invalid-argument);
   require all objects to sit in one partition of the same pass (else error message 0x93); it is a **move** from that
   partition, recorded for undo (src only `members.add`, no undo).
2. `RemoveFromPartition` (same file 295): Target optional (from InputObjs or derived from the objects); undo record
   missing.
3. `SIAddToGroupLowLevel` (`src/commands/selectionGroupLayer.ts` 428): with empty Target the first ordinary group in
   InputObjs is the target (src throws Unattested); only kind-3 groups qualify (not partitions / layers).
4. `SIRemoveFromGroup` (same file 441): with empty Target remove from the single group all members share (or a group
   given inside InputObjs); src removes from **every** group holding them.
5. `SICreateGroup` (same file 445): a Parent that is not a group container falls back to the current scene model
   (src throws); Name must be a string; container refusal = warning and no group; output via `Value`.
6. `AddGroup` (same file 459): locked Target → access-denied error; empty InputObjs → error; non-movable items warned
   (message 0x34) and dropped; all dropped → silent no-op.
7. `SetInstanceGroup` / `RemoveInstanceGroup` are registered twice (`uiGroupViewTasks.ts` 544/547 and
   `selectionGroupLayer.ts` 478/487); the later one's hair-name test is not in the binary (CMD-B7a: kind-3 group,
   container + index).
8. `SIStoreEnvironmentCacheToMixer`: not registered (only probed in `duplicateRenderingSimulationScriptsSimulation.ts`
   35); implement per §3 and return the Action.
9. `MoveJoint` (`src/commands/model.ts` 323): src only arms the translate tool; the command is an undoable task that
   moves the joint to (X,Y,Z); add `MoveJointBranch` / `MoveJointBone`; locked referenced model → access-denied.
10. `SICreateSkeleton` (`src/commands/chainsModelB17b.ts` 142): ViewType is consulted only when SkeletonType = 2 (else
    view type −1); other SkeletonType values are not an error at this level.
11. `CreateVertexColorSupport` (`src/commands/model.ts` 520): add `PresetObj`, `PropertyName` (default "Vertex_Color",
    made unique, written back) and `Value` (list of created properties); empty input = no-op; none created → type-
    mismatch error.
12. `PaintVertexColors` (`src/commands/model2.ts` 571): src only arms the paint tool (`undoable:false`); the command is
    an undoable write of Colors into Polynodes, auto-creating "Vertex_Color"; empty Polynodes/Colors → invalid-arg;
    Mode 0/1 only.
13. `CopyCluster` (`src/commands/clusters.ts` 75): args are `Cluster`, `Target` (list of objects), not `Name`; the copy
    goes onto each target object (same type and indices) with range/type errors 0x61/0x62; returns the list; src
    copies the cluster inside its own object.
14. `SaveKeyOnPath` (`src/commands/anim.ts` 308): add optional `X`, `Y`, `Z`; Time is required and in frames; the
    second registry entry ("Save Locked Key on Path") defaults `Locked` to true; key every input object, not only the
    first.

## CMD-B20c ([cmd-b20c-pr201-answers.md](../ghidra/cmd-b20c-pr201-answers.md))

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
