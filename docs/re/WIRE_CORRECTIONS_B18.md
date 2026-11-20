# Wire corrections, batch 18 (si-analyst, 2026-11-20)

Corrections to the current wiring in `src/` found while reading the batch-18 sources. Details and the full
contracts are in the linked notes; the analyst does not edit `src/`.

## Face Robot script commands (CMD-B18a–d)

1. `src/commands/faceRobotModule.ts` `frHostShells` registers most of the ~100 Face Robot script commands as
   argument-less shells returning null and logging "LOCK". They are plug-in scripts (not `FR.dll`) and now have
   contracts: take arguments, defaults and return values from cmd-b18a / b18b / b18c / b18d.
2. `fr_CleanMeshModel`: the argument is `Del` (no default), not `Mode` = 1; `Del` true freezes all Face Robot
   meshes and deletes the `fr_MeshClean` model, false creates / returns it. `faceRobotStage1.ts` passes `{Mode: 1}` (b18b).
3. `fr_Diagnose` returns a bool and sets `FaceState.Valid` / `Message` (b18b).
4. `fr_ToggleFaceLayout` / `fr_SetAltLayout` use the stored "Layout", fall back to "Tools Development Environment"
   and call `fr_SwitchFaceLayout` (b18d).
5. `fr_ObjectView` defaults an empty name to `Sculpt` (b18a).
6. `faceRobotB14a.ts` can resolve the localization file through `fr_GetFile` (`<FACEROBOTROOT>\Application\<file>`) (b18a).
7. `fr_GetPointsAsText` (stand-in in `faceRobotB14e.ts`) also converts a polygon selection to points, replacing the selection (b18a).
8. `faceRobotB14eTongue.ts` calls `fr_IsHeadMesh` / `fr_ScaleTongueMesh` without arguments; both need the tongue mesh,
   `fr_ScaleTongueMesh` also the marker vectors (b18c). `GetTongueMarkers` is registered with siNoLogging.
9. The `getKeyed` stand-in in `faceRobotB14deShared.ts` uses a different match rule from `GetKeyed` / `FilterKeyed` (b18d).
10. The Face Robot `AddUserKeyword` takes (`Obj`, `Key`) and clashes with the scene command of the same name (b18d).
11. Return-value quirks to keep: `fr_ObjectView`, `fr_ApplyType`, `fr_StorePP`, `CleanSources` return nothing;
    `fr_GetGlobalPos` false when not found; `fr_RestorePP` false without a blob; `fr_CopyEyelashes` /
    `fr_TransferEyelashEnvelope` true even on failure; `fr_ApplyGameSmoothFromMap` ignores `HandleExisting` (b18a, b18b).
12. `ui.ts` maps `GetPrimStereoCamera` to a plain GetPrim Camera (b18d).

## OneClick (CMD-B18e, `src/commands/iceModule.ts`)

13. Remote-app names are "Maya", "3ds Max" (with the space) and "Mudbox", not `3dsMax` / `Remote`.
14. All OneClick commands are registered with siNoLogging; send and select commands return nothing.
15. `OneClickGetState` returns "" when not connected, otherwise a translated status text; `OneClickGetRemoteAppName`
    returns the connected application's name.
16. The `…SelectPreviousObjects` / `OneClickSelectObjects` commands restore the selection saved at the last send.
17. `OneClickSetup` creates the `ICEFlowState` property on the scene root and inspects it.
18. `OneClickSendTo` routes by name: "Mudbox" → Mudbox update, "3ds Max" → send-back path, anything else → Maya update.
