# Wire corrections from analyst batch 17 (2026-11-20)

Read from shipped scripts (REA raw 6502 load) and binaries (REA + Ghidra); no XSIBATCH golden. Each section is copied
from the "Corrections for the wire agent" section of the named note; details and evidence are in the note. Items
marked `(inferred)` stay inferred.

## cmd-b17a-selection-layers-scripts.md

- `MakeAllUnselectable` makes everything **selectable** (display name "Make All Objects Selectable").
- `SelectEdgeLoop` / `SelectBoundaryEdgeLoop` / `SelectParallelEdgeLoop` ignore their input and always start a pick
  session; a batch implementation has nothing to do without picks.
- `GrowSelection` with mixed component types leaves only the last type's grown set selected.
- `ShrinkSelection` takes no argument and works on the global selection.
- `MoveToLayer` has two registry entries with the same scripting name (C++ and script); the script one writes the
  current layer back into its `Target` argument.

## cmd-b17b-chains-model-scripts.md

- `SetBoneRotationToPrefRotation` registry display name is "Set Bone Max Rot Limit" (copy error in the shipped
  registry); the behaviour is "rotate to preferred rotation".
- `CommitToReference` with default arguments does nothing in batch mode (the confirmation answer is OK, not Yes).
- `DeleteModelFromObj` / `DuplicateModelFromObj` act on the **owning model** in branch, not on the object.
- `CreateChainfromCurve` plain chains always get the (1,0,0) chain normal (tolerance test written as
  "dot − 1 < 1e-5", always true).

## cmd-b17c-rendering-texture-simulation-scripts.md

- `CreateRenderChannel`, `CreateFramebuffer`, `ExportObjectRenderArchive`, `RenderPasses`, `RenderAllPasses` each
  have both a C++ entry and a script entry under one scripting name; only the script entry is in this row.
- `ConnectToSupport`'s scripted procedure is the one already specified as `ConnectToTextureProj` (`cmd-12a`).
- `FreezeUVWTransformation`: no `SIFreezeUVWTransformation` exists in the registry; do not assume one.

## cmd-b17d-operators-scripts.md

- `WeldPoints` has a "No PPG" entry whose `ImmediateMode` default is the empty string, not `siPersistentOperation`.
- `ExtractFromComponents` "Polygon Detach" is the same preset as "Polygon Extract" with `DeleteInputComponents` True
  and name `polymsh_detached`.

## cmd-b17e-animation-action-scripts.md

- `ActivateMarkingSet` ignores its `InputObjs` argument; it always calls `SetMarking "MarkingSet"`.
- External-constraint commands act on the first scene object of the input only, not on every input.
- `CreateMarkingSet` "Add To" (Reset False) keeps an existing `MarkingSet` property and appends proxies.

## cmd-b17f-primitives-particle-scripts.md

- `ApplyParticleShader`'s `Inspect` argument is ignored by `ApplyParticleShaderProc`.
- `CreateForce` connects the force only to particle clouds and to objects carrying SoftBodyOp / ClothOp /
  hairDynamicsOp, and always adds it to the active simulation environment's `Forces` container (creating containers
  and the dynamics operator when missing).

## cmd-b17g-parameters-tools-enveloping-userdata-scripts.md

- `InspectUserData` reads the global selection, not its `InputObjs` argument.
- `ShadeObject` writes nine `display` view-mode parameters (sel / unselnear / unselfar × static / interactive /
  playback), after making the display property local with node or branch propagation per mouse button.
- `CreateDisplayInfo` falls back to `Scene_Root` when the property cannot be added to an input item.

## cmd-b17h-command-rigs-charac-duplicate-scripts.md

- `GetProportionalGuide` returns nothing (its procedure is a Sub) although the registry declares a return value.
- `TagStepMarks` ignores `InputObj` and works from the global selection's model and the `RightFoot` / `LeftFoot` tag
  properties.
- `CreateSpine` writes its `Interactive` argument back as False.

## cmd-b17i-toolmanager-view-commands.md

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

## cmd-b17j-tasks-pr195-answers.md

1. `CopyPaste`: Mode 1 must delete the source after pasting (move), Mode 2 must duplicate then freeze the copy;
   Mode 3 pastes the source itself.
2. `Add3DObjectToScene`: skip input objects that already have a parent (do not reparent them); add a Visibility
   property to objects lacking one.
3. `SetReference2`: a Value of the wrong class for the port filter (object/camera/light/material/shader/geometry/
   userdatablob) silently disconnects instead of connecting; a Value equal to the port owner disconnects.
4. `DeleteObj`: refuse (warning, nothing deleted) when every non-locked scene camera would be deleted; remove
   deleted objects from the selection first (undoable); partial failures warn with the dropped names.
5. `RunPerformanceTest`: report layout per Q20; no Duration clamp.
6. `Undo`/`Redo(Repetitions=0)`: do nothing and leave Repetitions at 0.

