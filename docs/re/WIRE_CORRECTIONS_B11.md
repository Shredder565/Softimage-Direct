# Wire corrections from analyst batch 11 (2026-11-18)

For `afterimage-wire`. The CMD-B10 commands were wired by inference (PR #180). Batch 11 read
their handlers from the binaries; below are the differences between the binary and the
inferred code, per command, as reported in the notes (behaviour only). The full contracts are
in the notes linked per row in `COVERAGE_LEDGER.md` (CMD-B11d, B11g, B11h, B11i). Items marked
`(inferred)` in a note are reasoned, not read.

## CMD-B11d

### `NavigateNode` (SPEC)

- inferred maps NavDirection 0 parent,1 child,2 prev,3 next,4 first,5 last; binary accepts only 1..6: 1 parent, 2 child, 3 next, 4 previous (polarity inferred), 5 first, 6 last; 0 or >6 -> 0x80070057
- default NavDirection 1 is PARENT in the binary (inferred goes to first child)
- inferred walks X3DObject parent/children; binary walks the element/component hierarchy, entering nested sub-hierarchies for child and leaving them for parent
- for root-level elements next/previous is a depth-first walk of the whole hierarchy until an element passes the filter (inferred only looks at siblings)
- inferred ignores NavFilter/NavSubFilter (NYA); binary: NavFilter 1..9 = element type code, 10 = no filter, 11 = Source's type, else 0x80070057; NavSubFilter 1 = also same sub-class code, 0 = type only
- elements with flag bit 0x8 are skipped
- when nothing is found the binary returns Source itself (inferred returns null)
- invalid Source -> 0x80070057 (inferred returns null)
- OutputObj is an element reference, not necessarily an X3DObject

### `SelectNeighborObj` (SPEC)

- inferred NavigateNode copies SelectNeighborObj's 0-based mapping; NavigateNode is 1-based (see NavigateNode)

### `CreateFolder` (SPEC)

- inferred defaults Target to the selection or scene root; binary requires Target (UnPackArg fails) and needs Target's hierarchy to support the insert interface d9347b2a-2b64-11d4-b6a3-006094eb029c
- inferred appends numeric suffixes for uniqueness; the task sets Name verbatim (any de-duplication is the object's own naming, inferred)
- empty Name leaves the class default name (inferred substitutes 'Folder')

### `MoveToFolder` (SPEC-PARTIAL)

- non-folder Target: binary fails at UnPackArg (error, no change) - inferred throw is consistent
- inferred removes the object from its previous folder - not confirmed (unread)
- inferred returns a count; binary returns no value

### `RemoveFromFolder` (SPEC)

- non-folder Target fails at Do (error) - inferred throw is consistent
- inferred returns a count; binary returns no value

### `PinUVComponents` (SPEC)

- inferred filters out-of-range UVComponents silently; binary fails the whole command with 0x80070057 if any index is <0 or >= the UVProp cluster's element count
- inferred accepts an empty/missing UVComponents for PinUVComponents/UnPinUVComponents; binary raises 0x80070057 at UnPackArg
- inferred ignores locks; binary refuses a locked UVProp (lock error, 0x80070005)
- inferred returns the number of ids; binary returns no value (S_FALSE when the list or cluster is empty)
- indices are cluster element indices of the UVProp's cluster (sample indices for a complete sample cluster); state is a per-element bit array: Pin ORs, UnPin clears, PinAll sets all, UnPinAll clears all (inferred Set semantics match)

### `UnPinUVComponents` (SPEC)

- inferred filters out-of-range UVComponents silently; binary fails the whole command with 0x80070057 if any index is <0 or >= the UVProp cluster's element count
- inferred accepts an empty/missing UVComponents for PinUVComponents/UnPinUVComponents; binary raises 0x80070057 at UnPackArg
- inferred ignores locks; binary refuses a locked UVProp (lock error, 0x80070005)
- inferred returns the number of ids; binary returns no value (S_FALSE when the list or cluster is empty)
- indices are cluster element indices of the UVProp's cluster (sample indices for a complete sample cluster); state is a per-element bit array: Pin ORs, UnPin clears, PinAll sets all, UnPinAll clears all (inferred Set semantics match)

### `PinAllUVComponents` (SPEC)

- inferred filters out-of-range UVComponents silently; binary fails the whole command with 0x80070057 if any index is <0 or >= the UVProp cluster's element count
- inferred accepts an empty/missing UVComponents for PinUVComponents/UnPinUVComponents; binary raises 0x80070057 at UnPackArg
- inferred ignores locks; binary refuses a locked UVProp (lock error, 0x80070005)
- inferred returns the number of ids; binary returns no value (S_FALSE when the list or cluster is empty)
- indices are cluster element indices of the UVProp's cluster (sample indices for a complete sample cluster); state is a per-element bit array: Pin ORs, UnPin clears, PinAll sets all, UnPinAll clears all (inferred Set semantics match)

### `UnPinAllUVComponents` (SPEC)

- inferred filters out-of-range UVComponents silently; binary fails the whole command with 0x80070057 if any index is <0 or >= the UVProp cluster's element count
- inferred accepts an empty/missing UVComponents for PinUVComponents/UnPinUVComponents; binary raises 0x80070057 at UnPackArg
- inferred ignores locks; binary refuses a locked UVProp (lock error, 0x80070005)
- inferred returns the number of ids; binary returns no value (S_FALSE when the list or cluster is empty)
- indices are cluster element indices of the UVProp's cluster (sample indices for a complete sample cluster); state is a per-element bit array: Pin ORs, UnPin clears, PinAll sets all, UnPinAll clears all (inferred Set semantics match)

### `GetSize` (SPEC)

- inferred sums over many objects; binary computes only when InputObjs has exactly one object, otherwise all three outputs are 2^64-1 (1.8446744073709552e19)
- inferred invents a byte estimate (params / geometry); binary uses C3DInfoReportTraverser::GetSize (static, dynamic, total) - definitions live in the DLL exporting that class
- outputs are doubles

### `Tag` (SPEC)

- inferred stores level NAMES in a per-parameter Set; binary stores a lock-info record of type 2 (tag) whose Level is a BITMASK (siTags constants, siTagAll = all bits); Untag removes the given bits (not only on siTagAll)
- inferred falls back to marked / keyable transform parameters when InputObjs is unset; binary requires InputObjs (UnPackArg fails)
- inferred treats a non-default SubType as NYA; binary SubType selects the operation: 0 lock, 1 unlock, 2 unlock-all (1 + RemoveAll), 3 tag, 4 untag (so Tag with SubType 4 untags)
- binary: Level 0 -> error 0x80070057, XSITASKS 1073 'The tag level %d is invalid'; inputs with no component id are skipped with warning XSITASKS 1069
- binary returns S_FALSE when no element was processed; inferred returns a count
- same CLSID also implements Lock/Unlock in tasks.dll

### `Untag` (SPEC)

- inferred stores level NAMES in a per-parameter Set; binary stores a lock-info record of type 2 (tag) whose Level is a BITMASK (siTags constants, siTagAll = all bits); Untag removes the given bits (not only on siTagAll)
- inferred falls back to marked / keyable transform parameters when InputObjs is unset; binary requires InputObjs (UnPackArg fails)
- inferred treats a non-default SubType as NYA; binary SubType selects the operation: 0 lock, 1 unlock, 2 unlock-all (1 + RemoveAll), 3 tag, 4 untag (so Tag with SubType 4 untags)
- binary: Level 0 -> error 0x80070057, XSITASKS 1073 'The tag level %d is invalid'; inputs with no component id are skipped with warning XSITASKS 1069
- binary returns S_FALSE when no element was processed; inferred returns a count
- same CLSID also implements Lock/Unlock in tasks.dll

### `MoveComponent` (SPEC-PARTIAL)

- no correction possible from tasks.dll; Q12 stays open

**Answers to PR #180 questions**

- Q1: NavigateNode is 1-based: 1 parent, 2 child, 3 next, 4 previous (polarity inferred from helper pairing), 5 first sibling, 6 last sibling; 0 or >6 is E_INVALIDARG. It is NOT the SelectNeighborObj encoding (tasks.dll's SelectNeighborObj is a script-run shell; its registry presets are 0-based 0..5). NavFilter: 1..9 = element-ref type code to match, 10 = no filter, 11 = same type as Source (default). NavSubFilter: 1 = also same object sub-class code as Source (default), 0 = type only. Not found -> Source returned.
- Q8: UVComponents are element indices of the cluster the UV property belongs to (bound = that cluster's element count; for a complete sample cluster these are sample indices, inferred). Out-of-range -> E_INVALIDARG for the whole command; empty list for Pin/UnPin -> E_INVALIDARG at UnPackArg.
- Q11: Tag/Untag share the lock task: SubType 0 lock, 1 unlock, 2 unlock-all, 3 tag, 4 untag. Level is a bitmask of tag levels (siTags; default siTagAll); tags are lock records of type 2. Level 0 -> error XSITASKS 1073.
- Q12: MoveComponent is not implemented in tasks.dll (CLSID only used by a consumer at 0x18005ed60). Implementor is transformmanager.dll (inferred); stop.
- Q13: GetSize works only on exactly one object; values come from the imported C3DInfoReportTraverser::GetSize (static, dynamic, total; units bytes, inferred). With 0 or >1 objects all outputs are 2^64-1. Static/dynamic definitions are in the DLL that exports the traverser.
- Q14: Error, not no-op: MoveToFolder fails at UnPackArg and RemoveFromFolder at Do when Target's hierarchy lacks the folder membership interface 6be9263a-3aee-11d4-b6a4-006094eb029c; nothing is changed.

## CMD-B11g

### `PlotCamSeqToActions` (SPEC)

- Creates a real action source via the PlotFrameSetToActions task (CLSID 7bff0142-...) and returns it in Value; inferred code returns [] and only keeps samples on a stand-in
- Apply (default true): when exactly one source is produced, ApplyAction is run on it, then the old driving action clips are deleted with DeleteObj (explicit inputs: clips from GetDrivingActions of class 23201244/23201247; no inputs: every clip of the scene clip container, via its compound owner)
- Delete (default false) is only honoured inside the Apply branch: DeleteObj on the produced action source after applying
- Empty frame set: logs XSIMSGCAT 463 at severity 2 (error) and returns 0x562e80c7; inferred code logs info 'nothing to plot' and returns null
- Empty InputObjs: parameters = animated test on the current scene root model with source-type flag 4 (not simply every parameter with an fcurve)
- Plot call uses start=StartFrame, end=DBL_MAX, step 1.0 with the frame array (inferred: keys laid out from StartFrame, one per frame-set entry), plus FCurve Kind / DefaultSegKind / Fit FCurve / Fit Tolerance / ProcessContRots
- No 'nothing to plot' check on an empty parameter list in the binary: the plot task is still run

### `GetSceneFrameSetFromCamSeq` (SPEC)

- Frame list comes from the imported F3DGetGlobalFrameSetFromSequencerRange (not action.dll); gap handling and clip-in/scale mapping are decided there, so the inferred rule (gap frame keeps the sequence frame, ceil(start)..end inclusive, no scaling) is unconfirmed
- Empty result is an empty 1-D variant array (not null); no log message
- Not undoable (Undo/Redo return 0) - matches inferred undoable:false

### `PlotCamSeqShape` (SPEC-PARTIAL)

- Outputs are KeyList (created shape keys) and ClipList (created clips); there is no Value return - the inferred code returns the frame set
- Processes every object of InputObjs (not only the first); empty InputObjs uses a default list built by 0x18004ab60, and a still-empty list logs XSIACTION2 0x446 as a warning
- Empty frame set: XSIMSGCAT 463 error and 0x562e80c7
- Creates scene data (shape keys, shape clips with time control start/clip-in = StartFrame, end = EndFrame) and is undoable; ApplyKeys runs DeleteObj (flag 0x10) on the old shape clips of explicit inputs
- StartFrame/EndFrame are converted to seconds on read and back to frames for the frame set; a progress bar (XSIACTION2 0x445) is shown

**Answers to PR #180 questions**

- QAddShotClip_Parent_Frame_StartEnd_inclusive: open: not in action.dll (modeltasks.dll / actioncore.dll)
- Qshot_clip_time_mapping: open: action.dll never maps shot-clip time itself; all three commands call the imported F3DGetGlobalFrameSetFromSequencerRange(start, end, withoutGaps) which returns one global frame per kept sequence frame, in sequence order
- QGetShotClip_between_clips: open: actioncore.dll
- QGetSceneFrameSetFromCamSeq_gaps_when_PlotWithoutGaps_false: open in detail: the command returns the import's list unchanged; PlotWithoutGaps is only forwarded; empty range -> empty array, no error
- QPlotCamSeqToActions_empty_InputObjs: confirmed in substance: animated parameters under the current scene root model (animated test, source-type flag 4); then plots into a real action source via PlotFrameSetToActions, applies it (Apply), deletes the old driving clips, optionally deletes the source (Delete), returns the source list

## CMD-B11h

### `ToggleMuteSolo` (SPEC-PARTIAL)

- Target > 4 is a no-op, not the active view
- solo clearing other views is unconfirmed (view-manager internal)

### `SetViewCamera` (SPEC)

- View stays attached to the camera (camera selection), not a one-time pose copy
- Add keywords user/top/front/right -> system cameras (0,0..3), render / render pass -> (1,0)
- Unknown name -> E_FAIL 0x80004005; no view -> silent success
- Camera change labelled 'Set Camera' in the view camera history

### `AlignViewCamera` (SPEC)

- Axis is 1-based (1=X,2=Y,3=Z); Axis 0 = reset to pre-alignment camera, other values E_FAIL
- Direction codes: +Y 0, -Y 1, +Z 2, -Z 3, +X 4, -X 5 (Top,Bottom,Front,Back,Right,Left order, inferred)
- AlignSelected uses the first selected object's transform as reference frame (its axes), not the selection centre
- First alignment saves the current camera to a stream on the view

### `ViewTranslate` (SPEC)

- Same unit for all five: one window pixel per X/Y unit (no half-pixel factor for nudges, no name check)
- Offset applied to the selection bounding-box centre projected in the view, un-projected at the same depth
- Executed via the Translate command (RefMode 4 global, Delta relative, AxesFilter 7, no InputObjs) so components move too; undo via Translate
- No view -> E_INVALIDARG 0x80070057; empty selection -> no-op

### `ViewNudgeLeft` (SPEC)

- Same unit for all five: one window pixel per X/Y unit (no half-pixel factor for nudges, no name check)
- Offset applied to the selection bounding-box centre projected in the view, un-projected at the same depth
- Executed via the Translate command (RefMode 4 global, Delta relative, AxesFilter 7, no InputObjs) so components move too; undo via Translate
- No view -> E_INVALIDARG 0x80070057; empty selection -> no-op

### `ViewNudgeRight` (SPEC)

- Same unit for all five: one window pixel per X/Y unit (no half-pixel factor for nudges, no name check)
- Offset applied to the selection bounding-box centre projected in the view, un-projected at the same depth
- Executed via the Translate command (RefMode 4 global, Delta relative, AxesFilter 7, no InputObjs) so components move too; undo via Translate
- No view -> E_INVALIDARG 0x80070057; empty selection -> no-op

### `ViewNudgeUp` (SPEC)

- Same unit for all five: one window pixel per X/Y unit (no half-pixel factor for nudges, no name check)
- Offset applied to the selection bounding-box centre projected in the view, un-projected at the same depth
- Executed via the Translate command (RefMode 4 global, Delta relative, AxesFilter 7, no InputObjs) so components move too; undo via Translate
- No view -> E_INVALIDARG 0x80070057; empty selection -> no-op

### `ViewNudgeDown` (SPEC)

- Same unit for all five: one window pixel per X/Y unit (no half-pixel factor for nudges, no name check)
- Offset applied to the selection bounding-box centre projected in the view, un-projected at the same depth
- Executed via the Translate command (RefMode 4 global, Delta relative, AxesFilter 7, no InputObjs) so components move too; undo via Translate
- No view -> E_INVALIDARG 0x80070057; empty selection -> no-op

### `ResetAllViews` (SPEC)

- Task is undoable (restores saved look-at and projection values)

### `Frame Contextual` (SPEC)

- AllViews false frames only that view (supported, not 'not yet attested')

### `GetViewIndex` (SPEC)

- No active view: error HRESULT from the view manager, not -1

### `SaveFastPlaybackCache` (SPEC-PARTIAL)

- Empty FileName opens a save browser (*.cache, <install>\Render_Pictures) instead of an error
- Cache is the display driver's image cache, not a frame list; failure E_FAIL; success returns S_FALSE

### `LoadFastPlaybackCache` (SPEC-PARTIAL)

- Empty FileName opens a load browser instead of an error
- Loads into the display driver cache, not a frame list

### `StartTimedPlayback` (SPEC-PARTIAL)

- Target is 1-based (Target-1); Target <= 0 = active view
- Result is a logged elapsed time in milliseconds, no fps return value

**Answers to PR #180 questions**

- Q3: Target 4 = active view; 0..3 = viewports A..D; >4 no-op. Mode 0 = mute, 1 = solo (registry entries 'Toggle Mute State' / 'Toggle Solo State'); both go to view-manager message 2.
- Q4: The camera becomes the view's camera (view looks through it, follows it); keywords user/top/front/right/render/render pass also accepted; the task does not change projection (the view uses the camera's own, inferred); unknown name -> E_FAIL.
- Q5: No: Axis 1/2/3 = X/Y/Z (NegativeAxis negates), Axis 0 = restore the camera saved before the first alignment. AlignSelected aligns to the first selected object's axes, it does not aim at the selection centre.
- Q6: X/Y are window pixels of the view (no half-pixel factor in the code) added to the projected selection bounding-box centre; the move is executed by Translate (global, relative, XYZ) on the current selection, so components move too.

## CMD-B11i

### `TranslateUVW` (SPEC-PARTIAL)

- AxesFilter is a bit field: siU=1, siV=2, siW=4 (siUVW=7, also the value when the arg is absent); axesOf() string-matching on the constant name works for named values but must also accept numeric values (e.g. 3 = UV, 5 = UW): decode as bits (v&1 -> U, v&2 -> V, v&4 -> W).
- Delta is read as a boolean: siAbsolute=0, siRelative=1; constName() comparison should treat numeric 0 as siAbsolute.
- W (Z) is a real third coordinate: keep logging NYA if 2D-only, but do not treat a non-zero Z as an error.
- SplitLocalComponents true = split moved samples from shared neighbours (inferred); false (default) keeps shared samples together - current NYA log is fine.
- Undeclared Snap/SnapFilter/SnapReference may appear in tool-generated logs; ignore them.

### `RotateUVW` (SPEC-PARTIAL)

- AxesFilter is a bit field: siU=1, siV=2, siW=4 (siUVW=7, also the value when the arg is absent); axesOf() string-matching on the constant name works for named values but must also accept numeric values (e.g. 3 = UV, 5 = UW): decode as bits (v&1 -> U, v&2 -> V, v&4 -> W).
- Delta is read as a boolean: siAbsolute=0, siRelative=1; constName() comparison should treat numeric 0 as siAbsolute.
- Z in degrees as the in-plane angle is confirmed (current code correct).
- X/Y are real rotations about U/V (out-of-plane, change W) - not ignorable; keep NYA log but the message is accurate.
- AspectRatio only applies when TextureProjection is given (else 1.0): use 1.0 when a.TextureProjection is unset.
- Pivot=false: pivot is the reference-mode default (centroid inferred) - current centroid is acceptable; Pivot=true uses PivotU/V(/W) - correct.

### `ScaleUVW` (SPEC-PARTIAL)

- AxesFilter is a bit field: siU=1, siV=2, siW=4 (siUVW=7, also the value when the arg is absent); axesOf() string-matching on the constant name works for named values but must also accept numeric values (e.g. 3 = UV, 5 = UW): decode as bits (v&1 -> U, v&2 -> V, v&4 -> W).
- Delta is read as a boolean: siAbsolute=0, siRelative=1; constName() comparison should treat numeric 0 as siAbsolute.
- Clamp each scale factor: if |f|<1e-12 use 1e-12 with f's sign (0 -> +1e-12).
- Filtered-out axes use factor 1.0 (current code skips them: equivalent).

### `MoveComponent` (SPEC-PARTIAL)

- No correction possible from this binary; keep the inferred implementation and its NYA logs.

**Answers to PR #180 questions**

- Q7: siUVWAxesFilter is a bit field siU=1, siV=2, siW=4 (siUV=3, siUW=5, siVW=6, siUVW=7; 7 also when absent); ScaleUVW reads X/Y/Z only for set bits (others stay 1.0). siDeltaMode: siAbsolute=0, siRelative=1, read as a boolean; for translate it also selects increment vs target snapping; its effect on rotate/scale lives in the unread apply step 0x18002be30 (inferred: absolute sets rather than composes). Rotation: X/Y/Z degrees -> one Euler rotation, order XYZ; Z (about W) is the in-plane rotation; X/Y are genuine out-of-plane rotations. AspectRatio is read only by RotateUVW and only when TextureProjection resolves (else 1.0); applied in the unread apply step (inferred: aspect-corrected rotation). Scale factors below 1e-12 are clamped to +-1e-12. Edges: no conversion in the UV argument path; components go to the transform manager as-is (inferred: edge endpoint samples move) - not confirmed. Pivot=true uses PivotU/V/W (Translate has no pivot); SplitLocalComponents selects reference mode 6 (split) vs 0x16 (default).
- Q12: Not answerable from transformmanager.dll: MoveComponent's CLSID is present only as data referenced by transform-task code (0x180051f05) and is not created by DllGetClassObject. tasks.dll does not implement it either (b11d); next candidate viewinteraction.dll (inferred), then imageclipeditor.dll.
