# Wire corrections from analyst batch 14 (2026-11-19)

Read from the binaries with REA + Ghidra; no XSIBATCH golden. Details and evidence are in the notes named per item.

## Face Robot commands already registered by inference (`src/commands/faceRobotModule.ts`)

Six `FR.dll` commands were on the bus before any contract existed. The binary contracts differ:

1. **`fr_GetCurrentStage`** (cmd-b14d): returns the raw stage **code** `0, 10, 15, 30, 40, 50, 60`, not `1..6`.
2. **`fr_SwitchFaceLayout`** (cmd-b14d): `inLayoutID` `0` means "the current stage"; an id `< 10` is multiplied by 10, stage = id / 10. Activates the layout named `Face Robot` every call; if it does not exist, logs "Unable to locate Face Robot layout.  Terminating. (...)" and returns `E_FAIL`. For id 50 it shows the `timeline` and `toolset` optional panels. Does nothing (OK) when not interactive. No return value.
3. **`FaceRobot`** (cmd-b14d, SPEC-PARTIAL): clears the selection; `cmd` `analyze` / `solve` blank both `cmd` and `arg` (so they act like an empty command); `General.undo` is set to 0 while it runs and restored after; `id` logs "Autodesk|FACE ROBOT 2.0"; unknown commands log "Unknown Face Robot command: <cmd>"; `""` / `clear` / `next` run the stage actions and finish with the layout switch of item 2 using the stage read **before** the action. Never puts a return value.
4. **`fr_FitTongue`** (cmd-b14e, SPEC-PARTIAL): does not attach a property. Fails with E_FAIL when `TongueMesh` is invalid or fewer than 4 markers; returns S_FALSE (1) without change when a tongue is already registered; otherwise registers the mesh, adds it to group `Tongue`, runs `SetUserKeyword(<mesh>, "Tongue,Mesh")`, creates one `<marker>_Marker` null per marker under the `Fit` null and returns them; `MustDeleteMarkers` deletes the passed markers. `TongueMarkers` default is an empty array (registry says "").
5. **`fr_SolveTongue`** (cmd-b14e, SPEC-PARTIAL): returns `true` at once if a control keyed "Tongue,Base" exists; otherwise creates `TongueBase_Control`, `TongueBack_Control`, `TongueFront_Control`, `TongueTip_Control` (keywords "Tongue,Base" …), deletes the `Tongue*Marker` nulls, sets `FaceConnections.Tongue`, returns `true`; with fewer than 4 markers logs "Tongue markers are missing" and returns `false` with status S_FALSE.
6. **`fr_RegenerateMouth`** (cmd-b14e, SPEC-PARTIAL): Yes/No/Cancel box (caption "SOFTIMAGE|Face Robot", text "Regenerate will delete all mouth sculpts.  Are you sure you want to continue?"); anything but Yes does nothing. On Yes it zeroes and deactivates the controls' local transforms, deletes the mouth-sculpt blobs, refits the mouth and rebuilds operator `fro_MetaMouthOp2` named "MetaMouthOperator". No return value.

## Other Face Robot facts that affect existing code

7. The six `fr_Export*` commands (`fr_ExportLWScene`, `fr_ExportModel`, `fr_ExportMotionFile`, `fr_ExportPointOvenCache`, `fr_ExportPointOvenScene`, `fr_ExportShape`) share one handler that reads two strings and **does nothing** (S_OK, no file). Register them as no-ops.
8. `fr_IsDesigner` and `fr_GetCurrentObjState` share one handler and always return `true`; `fr_Callstack_IsDebugMode` always returns `false` (cmd-b14a).
9. `fr_GetCommand` permanently sets the no-logging flag on the command it looks up (cmd-b14a).
10. Registry return-value flags are not reliable for FR commands: several Inits never enable a return value (see §4 of each note).

## BVR answers to wire PR #187 Q1–Q7 (cmd-b13a §5)

11. `BvrSetCollisionOnly` → `VisualizationOnly` false, `CollisionOnly` true; `BvrSetVisualOnly` → true, false; `BvrSetDefault` → false, false.
12. `BVHActor.Mode`: 11 from `BvrImportBVHAction`, 0 from `BvrImportBVHActor`. `Skill.Source` = 0 when an X3DObject is selected; for an ActionSource it is the index of the first name match in `Model.Sources` (the count if none). `LoopSkill.Source` same (inferred).
13. The bound helper takes a global/local flag: `BvrAddColSphere` uses global Y, `BvrAddFloor` local Y; the two are consistent.
14. `BvrSetFoot` (corrected): spheres go under the lowest-Z (heel) and highest-Z (toe) nodes of the foot subtree including the foot, named `<host>_CS`; radius = 0.25 × the **foot's own** `RTKHomePose.py` (0.25 if absent); heel sphere global Y = radius + foot global Y − home py.
15. Rotate in the home pass: Delta `0` = siAbsolute, RefMode `1` (inferred siGlobal).
16. The actor-model walk starts at the selected node itself; `RTKEnd` is added only when `GetChildren` is empty, so lights and cameras count as children (light / camera nodes and their subtrees are skipped). Prompt texts for Q6 are in the note.
17. Still open: the MakeSkill source `type` value (Q2) and whether the home store includes the model node (Q7).
