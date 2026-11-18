# CMD-B11h: view manager commands read from `vm.dll` (CMD-B10 confirmations: ToggleMuteSolo, SetViewCamera, AlignViewCamera, ViewTranslate / ViewNudge*, camera undo / reset / frame, fast playback cache, timed playback; new: ExportImageClip)

Row: **CMD-B11h**. Status: **SPEC** (15 names), **SPEC-PARTIAL** (4 names); per command below.
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\vm.dll`, image base `0x180000000`, sha256 `4c869d2174ba6a049102509ef165f1514765ce07ef3b91dfa9ee6cadb200ebf2` (PE x86-64, 2306 functions, PDB `vm.pdb` not loaded).
Method: Ghidra decompilation of `DllGetClassObject`, the class factory constructors and their
create slots, the task constructors, Do / UnPackArg / RePackArg of each task, and the three
workers they call (`0x1800073c0` SetViewCamera resolver, `0x180001400` AlignViewCamera,
`0x180008c40` ViewTranslate); vtables read with `read_bytes`. Interface method names on the
view (`I3DView`) are named by what the code passes to them and are marked `(inferred)` where
only the call site was read. Purpose of this row: answer questions 3-6 of the CMD-B10
analyst list and confirm / correct the inferred wiring in `src/commands/inferredB10Views.ts`.

## 1. Handler table

`DllGetClassObject` (`0x1800107c0`) is a chain of 25 inline CLSID compares (two 8-byte
compares each); unknown CLSIDs return `0x80040111` (CLASS_E_CLASSNOTAVAILABLE), allocation
failure `0x8007000e`. Each match allocates a 0x48-byte class factory whose constructor
installs a factory vtable. Factory slot 3 (`0x18000ee10`, shared) calls factory slot 6, which
allocates and constructs the task; most factories use a derived vtable whose slot 6 also
calls the new task's `+0x20` sub-object slot 7 (init) and frees the task on failure. In
every task here the `C3DCoreBaseTask` vtable is at object offset `+0x00`, a COM part at
`+0x20`, and a view-manager helper at `+0x40` (initialised by `0x1800089d0` in UnPackArg;
helper slot 1 = index of the active view, slot 2 = active view (+ its index), slot 3 = view
by index). Task vtable slot 5 = Do, 6 = Undo, 7 = Redo, 8 = UnPackArg, 9 = RePackArg. Slots
6/7 = `0x1800073a0` (shared stub, nothing to undo) unless listed.

| Command(s) | Handler CLSID | Factory ctor -> create -> task ctor | Task vtable | Do | UnPackArg | Undo / Redo |
|---|---|---|---|---|---|---|
| `ToggleMuteSolo` (2 entries) | `7ad7df80-1441-11d3-bfec-00a0248f9397` | `0x18000e0c0` -> `0x180010380` -> `0x180006af0` | `0x18003bbe0` | `0x180006c60` | `0x180006ce0` | stub |
| `SetViewCamera` | `c6f8fc98-6363-4661-aa78-c92d895b75aa` | `0x18000dcf0` -> `0x18000fc70` -> `0x180007130` | `0x18003c590` | `0x1800072f0` -> `0x1800073c0` | `0x1800076f0` | stub |
| `AlignViewCamera` | `075fb349-89bd-42fa-8d2d-b9e83c0f284d` | `0x18000d6d0` -> `0x18000f650` -> `0x180001280` | `0x18003a3b0` | `0x180001910` -> `0x180001400` | `0x1800019b0` | stub |
| `ViewTranslate`, `ViewNudgeLeft/Right/Up/Down` | `ad992d4b-5d42-431b-959e-d569b6495687` | `0x18000df20` -> `0x18000fea0` -> `0x180008ab0` | `0x18003dbc0` | `0x180008c40` | `0x1800093b0` | `0x180013520` (both) |
| `ExportImageClip` | `f7c3aa73-4d27-4333-a281-3774a90b194b` | `0x18000e060` -> `0x180010180` -> `0x180031a10` | `0x18004bcb0` | `0x180031df0` | `0x180032440` | stub |
| `CameraUndo` | `41973541-1cf0-4935-abf2-1ef3f1a71db4` | `0x18000d820` -> `0x18000f7a0` -> `0x180002860` | `0x18003a940` | `0x1800029d0` | `0x180004a50` | stub |
| `CameraRedo` | `0f2e5216-a4ff-435f-a934-eb69d88395f9` | `0x18000d740` -> `0x18000f6c0` -> `0x180001b90` | `0x18003a5d0` | `0x180001d00` | `0x180004a50` | stub |
| `ResetAllViews` (and `CameraReset`) | `0461b2b4-0ae3-11d2-8065-00a0c955b335` | `0x18000d7b0` -> `0x18000f730` -> `0x180001da0` | `0x18003a7a0` | `0x180001f90` | `0x180002740` | Undo `0x180002400`, Redo `0x1800023f0` |
| `Frame Contextual` (FrameContextual entries) | `248c1d05-7023-4107-bb0f-905b655e0dc8` | `0x18000d970` -> `0x18000f8f0` -> `0x180003b90` | `0x18003b260` | `0x180003fc0` | `0x180004390` | stub |
| `GetViewIndex` | `1b211a79-d67f-4b2f-b8cc-8f4027f126cd` | `0x18000da50` -> `0x18000f9d0` -> `0x180004b00` | `0x18003b640` | `0x180004c90` | `0x180004d60` (RePack `0x180004ce0`) | stub |
| `Hide Back Facing Polygons` | `0461b2c1-0ae3-11d2-8065-00a0c955b335` | `0x18000ddd0` -> `0x18000fd50` -> `0x1800079e0` | `0x18003c920` | `0x180007b50` | `0x180007110` | stub |
| `SaveFastPlaybackCache` | `4927de03-3e0e-4126-8d59-6d34ce0b7ddd` | `0x18000dc80` -> `0x18000fc00` -> `0x180002ff0` | `0x18003ad20` | `0x180003660` | `0x180003a30` | stub |
| `LoadFastPlaybackCache` | `b613c9a6-acb1-4a63-a674-d64609dbefc0` | `0x18000db30` -> `0x18000fab0` -> `0x180002f50` | `0x18003ae10` | `0x1800032e0` | `0x180003a30` | stub |
| `Show3DContextMenu` | `0fd6b0ba-6d51-11d4-a8c2-00c04f8edf15` | `0x18000dd60` -> `0x18000fce0` -> `0x180007810` | `0x18003c7a0` | `0x180007980` | base default | stub |
| `StartTimedPlayback` (shared with `CaptureViewport`, `Flipbook`) | `f8b60ef4-7ec2-11d3-8e88-00a0c982dd9a` | `0x18000e000` -> `0x180010100` -> `0x18002fa70` | `0x18004b310` | `0x1800301d0` | `0x1800316a0` | stub |

Task names found as strings: "Set View Camera Task", "Align View Camera Task", "View Translate
Task", "Get Active View Index Task", "Save / Load Fast Playback Cache Task".

Not in `vm.dll`: `Front View` / `Back View` / `Right View` (`5c0cf8b6-...`, tasks.dll),
`SetDropMessage`, `ResetDirectX`, `RunPerformanceTest`, `DelayedRefresh` (tasks.dll). Not
covered here.

## 2. Shared facts

- **View argument**: `View` = -1 selects the active 3D view (helper slot 2), any other value
  is a 0-based view index (helper slot 3; 0..3 = viewports A..D). When the view cannot be
  found most tasks succeed doing nothing (exceptions: ViewTranslate, below).
- **Camera change bracket** (inferred names): the view methods at `+0x358` / `+0x360` open and
  close a camera change and `+0x2d8(label)` names it; tasks use the labels "Set Camera",
  "Reset XYZ", "Reset", "Frame". This is the per-view camera undo history that `CameraUndo`
  / `CameraRedo` walk (inferred from the pairing).
- After a camera change several tasks notify the view manager (`+0x48` interface, slot 6)
  with the view's id to refresh it.
- HRESULT `0x562e80c7` is a "success with warning" code kept across result merges.

## 3. Contracts

### `ToggleMuteSolo`: SPEC-PARTIAL

**Wire contract**
- Args: `Target` (int, default 4), `Mode` (int; registry entry "Toggle Mute State" passes 0,
  "Toggle Solo State" passes 1).
- `Target` 0..3 = viewport A..D (0-based view index); `Target` 4 = the active view (its
  index is asked from the view manager). Any resolved index >= 4 (Target > 4) does nothing
  and succeeds.
- Effect: one call to the view manager (`+0x48` interface, slot `0x128`) with message code 2,
  the view index in the high 16 bits of the second word and `Mode` (16 bits) as the third:
  the view manager toggles that view's mute (Mode 0) or solo (Mode 1) state.
- Not undoable; no return value.
- Missing: what mute / solo do inside the view manager (whether solo clears the other views'
  solo, what a muted view skips) is in the view manager method, not read.

### `SetViewCamera`: SPEC

**Wire contract**
- Args: `CameraName` (string, default ""), `View` (int, default -1).
- Resolves the view (`View`); no view: success, nothing done.
- Opens a camera change labelled "Set Camera", then resolves `CameraName`:
  1. As an object path. If it names an object, the task looks for it in the view's camera
     lists 0, 2, 3, 4 (list 1 is skipped; lists come from the view, `+0x308(list)`), and on
     the first match selects that camera on the view with (list, position-in-list)
     (`+0x38`). The view then **looks through that camera**: it is the view's camera
     selection, not a one-time copy of its pose.
  2. Otherwise (no object, or object not in any list) by case-insensitive keyword:
     `user` -> (0,0), `top` -> (0,1), `front` -> (0,2), `right` -> (0,3), `render` or
     `render pass` -> (1,0) (the render pass camera). No other keywords (no left / bottom /
     back).
  3. Nothing matched: returns `0x80004005` (E_FAIL), view unchanged.
- On success the view manager is notified to refresh the view.
- Not undoable as a task; the change is in the view's camera history (inferred).

### `AlignViewCamera`: SPEC

**Wire contract**
- Args: `Axis` (int, default 0), `NegativeAxis` (bool), `AlignSelected` (bool), `View`
  (int, -1 = active).
- UnPackArg negates `Axis` when `NegativeAxis` is true; the Do works on the signed value.
- **`Axis` 0 = reset**: if the view holds a saved pre-alignment camera, the camera is
  restored from it (camera change labelled "Reset XYZ") and the saved state is cleared; the
  view's alignment state is set to 0. No saved state: nothing changes.
- **`Axis` 1 / 2 / 3 = X / Y / Z** (sign from NegativeAxis). Mapping to the view's
  standard direction code (`+0x2e0`) and an alignment state (`+0x158`, 1/2/4 = X/Y/Z):
  +X -> direction 4, -X -> 5; +Y -> 0, -Y -> 1; +Z -> 2, -Z -> 3 (state X=1, Y=2, Z=4). The
  direction codes match the standard-view order Top, Bottom, Front, Back, Right, Left
  (inferred), so +Y looks like Top, +Z like Front, +X like Right.
- Any other `Axis` value: `0x80004005`.
- Before the first alignment, the current camera is saved to a memory stream on the view
  (used by Axis 0).
- Alignment uses an identity reference frame (scale 1, no rotation) unless `AlignSelected`
  is true and the selection is non-empty: then the frame is the transform of the first
  selected object, so the camera aligns to that object's local axes (inferred from the
  transform being fetched from the first selected item). It does not aim at the selection
  centre.
- Ends with a view refresh notification and a camera-changed event.

### `ViewTranslate`, `ViewNudgeLeft`, `ViewNudgeRight`, `ViewNudgeUp`, `ViewNudgeDown`: SPEC

One task, no command-name check; the nudge commands differ only in their registry defaults
(`X`,`Y` = (-1,0), (1,0), (0,1), (0,-1); ViewTranslate (0,0)).

**Wire contract**
- Args: `View` (int, -1 = active view; the resolved index is written back), `X`, `Y`
  (double). A Z offset exists in the task but is always 0.
- No view: `0x80070057` (E_INVALIDARG).
- Takes the bounding box of the current selection (scene selection list, evaluated at the
  current time, in the view) and its centre. Projects the centre to the view's window
  coordinates (viewport transform scaled by (width-1)/2, (height-1)/2), adds `X` / `Y`
  there (window units: **one unit = one pixel** of the size the view reports; the registry
  tooltips say "1/2 pixel", the binary applies no 0.5 factor), un-projects at the same
  depth, and takes the world delta.
- Runs the `Translate` command (`79bc75b0-c3f7-11d1-8f2b-00a0c982b651`) through the command
  map with `X`/`Y`/`Z` = the delta, `RefMode` = 4 (Translate's default, siGlobal (inferred);
  4 | 0x800 when bit 11 of the private preference
  `xsiprivate.3D_TRANSFO_REFERENTIAL_CHANGED` is set), `Delta` = true (relative),
  `AxesFilter` = 7 (XYZ), no `InputObjs` (so Translate acts on the selection: objects or
  components, whatever Translate supports).
- Moves happen in the view plane (depth kept). Undo goes through Translate's own undo.
- Empty selection / no bounding box: nothing happens, returns 0.

### `ExportImageClip`: SPEC

**Wire contract**
- Args: `Clip` (image clip, required), `FileName` (string), `StartFrame`, `EndFrame`,
  `StepFrame` (int, defaults 1).
- UnPackArg errors (raised with `0x80070057` and returned): no image clip -> "Argument 1 must
  be an image clip"; empty `FileName` or a file type no image writer supports ->
  "Argument 2 must specify a image file name". `StepFrame` 0 becomes 1. With a negative step
  and Start < End, or a positive step and End < Start, Start and End are swapped.
- Refused in a restricted application mode: message 0x143 of `simsgcat`, `0x80004021`.
- Frame count = |(End - Start + 1) / Step|. When > 1 and the name is not a movie format and
  has no `[`, the sequence token `.[Start..End]` is inserted before the first `.` of the
  file name.
- Opens an image writer for the file (no writer: "Couldn't find an image parser for that
  type"). Logs "Writting <file>" at info level (spelling as in the binary) and " Frame <n>"
  per frame when more than one frame.
- For frame = Start, Start+Step, ... while frame <= End: gets the clip's image at that time
  (scene time format; a failure returns the clip's HRESULT), and writes it as image number
  0, 1, 2, ... On the first frame it writes the header (image size from the clip, frame
  count, field / frame layout from the time format flags); header failure -> "Couldn't open
  file for writting", write failure -> "Couldn't write the file".
- Note: after the swap a negative step leaves Start > End, so nothing is written unless
  Start = End.
- Not undoable; no return value.

### `CameraUndo` / `CameraRedo`: SPEC

- Args: `View` (-1 = active). Inside a camera change bracket the view steps its camera
  history back (`+0x2b8`) or forward (`+0x2c0`). No view: success, nothing.

### `ResetAllViews` (and `CameraReset`, same CLSID): SPEC

- Args: `View` (-1), `AllViews` (bool; ResetAllViews default true, CameraReset false).
- `AllViews` false: the one view (`View`, -1 = active); true: every 3D view index in the
  view manager list.
- Per view: saves its camera (position, interest, up from the look-at, plus projection
  values: a mode value and, by mode, field of view (mode 0) or orthographic values (mode
  1), and one more value) for undo, labels the change "Reset", and calls the view's camera
  reset (`+0x1f8`, home position). Single-view resets are bracketed as a camera change.
- **Undoable**: Undo restores the saved cameras, Redo re-runs the reset.

### `Frame Contextual`: SPEC

- Args: `AllViews` (bool), `View` (-1).
- Mode = frame selection if the selection list or the second query list (component /
  sub-selection, inferred) is non-empty, else frame all.
- `AllViews` false: frames only that view (label "Frame", bracketed); true: every view.

### `GetViewIndex`: SPEC

- Writes the 0-based index of the active 3D view to `Value` (int). No active view: returns
  the helper's error HRESULT; the default 0 stays.

### `Hide Back Facing Polygons`: SPEC

- Toggles display flag 5 of the active view's display options (reads it, writes the
  opposite). Not undoable.

### `SaveFastPlaybackCache` / `LoadFastPlaybackCache`: SPEC-PARTIAL

- Args: `View` (-1), `FileName` (string).
- Empty `FileName`: a modal file browser opens (title "Save / Load Fast Playback Cache",
  filter `*.cache` and all files, start folder `<install>\Render_Pictures`); cancel ends the
  command.
- Finds, among the view's display drivers (from the last down to index 2), the first that
  supports the playback cache interface and calls its save / load with the file name;
  failure -> `0x80004005`. Success and "no view" return 1 (S_FALSE).
- Missing: the cache file layout (inside the display driver, not in vm.dll).

### `Show3DContextMenu`: SPEC

- No args. Asks the viewer controller to show the 3D view context menu (`+0xf8`).

### `StartTimedPlayback`: SPEC-PARTIAL

- One task with `CaptureViewport` and `Flipbook`; UnPackArg picks the mode from the invoking
  command GUID (Flipbook -> 1, CaptureViewport -> 0, StartTimedPlayback
  `03abe29e-fbad-490e-b327-2177365d96d9` -> 2).
- `Target` is **1-based**: the task uses Target-1; Target <= 0 (default -1) = the active view.
  No `Interactive` argument in mode 2.
- Plays the scene's play range once in that view through the playback controller, waits in
  a sub message loop, measures the elapsed time in milliseconds (performance counter) and
  logs XSIVM message 0x13e composed with it at info level; then restores the play range /
  loop settings and the current time. No return value.
- Missing: the text of XSIVM string 0x13e and the exact playback-controller settings.

## Corrections to the CMD-B10 inferred wiring (`inferredB10Views.ts`)

- ToggleMuteSolo: Target 0..3 = A..D and 4 = active is right; Target > 4 is a no-op (not
  "active view"). Mute / solo semantics are the view manager's; the inferred "solo clears
  others" is unconfirmed.
- SetViewCamera: the view looks through the camera (stays attached), so drop the one-time
  pose copy; add keywords user / top / front / right / render / render pass; unknown name
  -> E_FAIL (not a thrown "is not a camera" unless nothing matched); no view -> silent
  success.
- AlignViewCamera: Axis is 1/2/3 = X/Y/Z, 0 = restore the camera saved before the first
  alignment (the inferred clamp 0..2 = X..Z is wrong). AlignSelected aligns to the first
  selected object's axes, not to the selection centre; the camera is not moved to a
  distance around the selection.
- ViewTranslate / ViewNudge*: same unit for all five (one window pixel per unit; drop the
  half-pixel factor for nudges), the move is relative to the selection's bounding-box centre
  projected in the view, executed by `Translate` (global, relative, XYZ) so components move
  too; undo via Translate. No view -> E_INVALIDARG.
- CameraUndo / CameraRedo: confirmed (view camera history).
- ResetAllViews: confirmed, but the task is undoable (saves cameras).
- Frame Contextual: AllViews false frames one view (not "not yet attested").
- GetViewIndex: confirmed (0-based active view index).
- Hide Back Facing Polygons: confirmed as a per-view display flag toggle (flag 5).
- Save / LoadFastPlaybackCache: empty FileName opens a file browser instead of an error; the
  cache is the display driver's image cache (opaque), not a frame list.
- StartTimedPlayback: Target is 1-based (<= 0 = active view); result is a logged elapsed time
  in ms, not a returned fps.

## Answers to the CMD-B10 questions

3. ToggleMuteSolo: `Target` 4 = the active view (0..3 = viewports A..D, > 4 nothing); `Mode`
   0 = mute, 1 = solo (registry entry names "Toggle Mute State" / "Toggle Solo State"; both
   go to one view-manager message).
4. SetViewCamera: the camera becomes the view's camera (the view looks through it and so
   follows it); the view's camera label is the camera's (inferred, the view shows its
   selected camera). Projection: the view uses the chosen camera's own projection (inferred;
   the task does not change projection). Keywords top / front / right select the system
   orthographic cameras.
5. AlignViewCamera: no: `Axis` 1 / 2 / 3 = X / Y / Z, 0 = reset to the pre-alignment camera.
   `AlignSelected` aligns to the first selected object's frame, it does not aim at the
   selection centre.
6. ViewNudge* / ViewTranslate: `X` / `Y` are window pixels of the view (no half-pixel factor
   in the code), applied to the projected bounding-box centre of the selection; the move is
   done by `Translate` on the current selection, so components move too.

## Open questions

- View-manager message 2 (mute / solo) internals; whether solo is exclusive.
- XSIVM dictionary string 0x13e (timed playback report text).
- The fast playback cache file format (display driver DLL).
- The exact display-flag meaning of 5 (assumed back-face culling from the command name).
