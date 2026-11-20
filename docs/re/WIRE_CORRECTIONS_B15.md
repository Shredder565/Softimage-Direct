# Wire corrections from analyst batch 15 (2026-11-20)

Read from the binaries (REA + Ghidra) and, for script commands, from the shipped script files opened through REA
as headerless images; no XSIBATCH golden. Details and evidence are in the notes named per item.

## Face Robot (answers to wire PR #189, cmd-b15-fr-pr189-answers)

1. Mystery strings: `0x1802d1e38` = `CDKMetaMouthOp`, `0x1802d1dc8` = `CDKMetaMouthSymMap`, `0x1802d2600` = `CDKFaceRetargetOp`, `0x1802d2698` = `ZeroPoseO`, `0x1802d2668` = `ZeroPose`. The six `meshnames` are `Mesh`, `LEye`, `REye`, `UpperTeeth`, `LowerTeeth`, `Tongue`.
2. `fr_RegenerateMouth` / `fr_ResetControllerDB` delete the blobs `ZeroPoseO` and `ZeroPose` (not the mouth-sculpt blobs B14e guessed).
3. `fr_AddObjectInPlace` sets siNotInspectable (8) to **false** (B14a said true); parameters named in `inParamTags` get tag 1 (siTag1).
4. `fr_MuteSources`: `b_ResetTransforms` is never used; the reset is gated by `b_Mute`, and `b_Mute` is what is passed to `fr_ResetRetarget`.
5. `GetFaceWeightMap`: MapName is split on `_`; a property matches only when every piece equals one of its user keywords (case-insensitive). Not a prefix match.
6. `fr_NeighborIndex`: mode 0 returns the first neighbour; any other mode returns the neighbour whose local-space direction has the largest Y (ties keep the earlier); vertex 0 is rejected with 0x80020003.
7. Selection fallback of `fr_NeighborIndex`, `fr_GetNormalArray`, `fr_GetOperatorsInStack` passes the Selection object itself, so it always fails with 0x80020003 (shipped behaviour). `fr_GetPointArray` uses item 0 correctly.
8. `fr_CrawlToVertex`: the first selected vertex is not in the output; direction recomputed each step as pos(b) − pos(current); a neighbour touching the target is taken at once; at most 1024 vertices per pair (not 1023).
9. `fr_SculptMouthEnd`: helper `0x1800aded0` stores the corrections into the mouth blob, so `cancel` = true applies (not reverts).
10. `fr_SolveTongue` without `meshes/Tongue`: returns true / S_OK, does not write `FaceConnections.Tongue`, always deletes the `Tongue*Marker` children of `Fit`.
11. `AddFaceControl`: offset parent is named `<Nom>_Parent`; 0x232 is its wireframe colour (`wirecol`).
12. `fr_GetFilesForBrowser`: element 0 is 3 × file count; extensions are not re-checked (8.3 quirk inherited).
13. Game shader "Constant" is a lookup by material name; clip slots pair with the port table by index (label/port mismatch is shipped).
14. `fr_CalibrateFace` with an empty argument writes 0.0. `fr_RepairNan` NURBS format 0 (siSINurbs). `frf_visgroup`: a group whose parent is a `#model`, if its `viewvis` is not 2, or is 2 and the group has a `visibility` property.
15. `fr_GetFile`, `fr_GetPointsAsText`, `fr_GetKeyed_safe`, `SetControlKeys`, `fr_ResetRetarget` are **not** registered by FR.dll; FR.dll only runs them by name. Their script file is still unidentified; keep the shells.

## modeltasks.dll (cmd-b15a)

16. `SICreateModel` is in `modeltasks.dll`: creates the model, runs `Add3DObjectToScene` under Parent, `ParentObj` on the inputs, then `AddGroup` when exactly one group was passed; undo records the sub-tasks.
17. `Add3DObjectToScene`, `SIAddImageSource`, `SIAddImageClip` are **not** in modeltasks.dll (the last two are in imageclip.dll, item 33).
18. `ImportMixer` / `MergeMixer`: one task; checks the `.xsimixer` file and opens its `Contents` stream before importing.
19. `ApplyDelta`: no undo flag. `SIImportMatLib`: any non-zero ShareOptions = referenced import; `SIImportReferencedMatLib` = same task with ShareOptions 1. `ExportMaterialLibrary`: `Binary` always false; no InputObjs = current material library.
20. `SIGetModel`: empty input = scene root; otherwise the closest model owning all inputs; none → 0x80004005.
21. Ref-model commands (SISetResolutionOfRefModels, Add/RemoveRefModelResolution, SICreateRefModel, ApplyDelta, ImportDelta) do nothing when licence bit 0x40 is missing (return value unknown). SIExportIges, ImportDelta, ExportMaterialLibrary return 0x80004021 in the restricted application mode.

## propertytasks.dll (cmd-b15b)

22. `SetClusterPropertyValues` is handled by propertytasks.dll. `SICreateMaterial` and `SICreateMaterialDD` share CLSID 3b75c06e in propertytasks.dll (not shadertasks.dll).
23. `SIAddEntryToOverride` and `SIStoreProp` share 51297d82 with the three `SIAdd*EntryToOverride` commands; they differ only by the Type default: 65535 asks the user, 1 property entry, 0 connection / shader entry, 2 parameter value entry.
24. `SIAddCustomParam` = `SIAddCustomParameter` (one task); empty ScriptName fails with 0x8007000E; SuggMin == SuggMax makes the suggested range equal to Min/Max.
25. All user-normal commands store normals in a sample cluster `User_Normal_Cluster` with the `User Normal Property` preset, write values through a SetClusterPropertyValues sub-task and run FreezeObj at the end when a scene setting is on.
26. The user tab / keyword commands (`SetUserTab`, `GetUserTab`, `ClearUserTab`, `RemoveUserTab`, `GetUserKeyword`, `RemoveUserKeyword`) are already SPEC from siuitasks.dll (CMD-B7a); they are still counted missing because their names are only built at runtime in `src` — register them literally.

## Particles (cmd-b15c)

27. `SIAddParticleEvent`, `SetEventObstacle`, `UpdateParticleTypeConnections` are served by **sparks.dll** (not activedb.dll / optasks.dll).
28. Every command registered twice ("Pick …" and the list entry) is one task; wire both to the same handler with the two argument lists.
29. S_FALSE (1): CreateEventSource when the target already has an emission source; RemoveUserParameter when the parameter is not found; SetParticleInitState when no cloud was processed / no input. Raised 0x80004005 when no simulation operator is found or the wrong one; SIAddParticleEvent 0x80070057 when no target succeeds; AddParticleEmitter 0x80070057 when no Target carries a Sparks or HyperFlow op; CreateEventSource 0x8000ffff with more than one Target; SetEventObstacle 0x8000ffff with empty Target or Source.

## Clips and sources (cmd-b15d)

30. `SIAddModelClip` is obsolete: logs "Obsolete command, to create a clip you have to change the model source resolution." (severity 2), returns 0x80004005, creates nothing.
31. `SICreateModelClip`: no Resolution argument, always resolution 2; optional `Source`; empty FileName and no Source → 0x80070057; default names `ModelClip_<base>` / `ModelSource_<base>`. `SIAddModelSource` default name `ModelSource_<basename>`.
32. `SICreateImageClip`, `SICreateImageClip2`, `SICreateDefaultImageClip` share handler e2be2c7c; the command GUID selects mode 0 / 2 / 4. Default clip uses the user-preference default image; ImageClip2 returns a collection, one clip per sub-image named `V%d_%s` after the first.
33. `SIAddImageSource` (imageclip.dll) reuses an existing source whose resolved path matches (case-insensitive). `SIAddImageClip` runs SIAddImageSourceOp(Clip, Source); empty Name takes the source's name.
34. `AddAudioClip`: no Track → AddTrack audio track; sets "Project Audio Sample Rate" to the source rate (refuses when the scene rate is fixed); clip does not fit → E_FAIL; locked track → 0x80070005. `ImportAudio`: Model and FileName required (0x80004003); folder stored under `Nle\animmix\audio`; empty Name → file name.

## Scripts (cmd-b15e, cmd-b15f)

35. `MakeBiped` / `MakeBipedDogLeg` / `MakeQuadruped` (JScript): last argument `SelectUsingUI` false (default) shows the modal dialog and ignores the other arguments; true uses the arguments. Each is registered twice (JScript and VBScript UI wrapper); the live one depends on load order.
36. `TorsoType` 1 quaternion, 2 skeleton, 3 world-aligned, 4 near-axis aligned; MakeTorso `SpineType` 0 polygon quaternion, 1 implicit, 2 skeleton, 3 / 4 axis-aligned variants. `MakeHead` AssemblyType 0 skeleton / 1 spine head and neck, HeadType 0 biped / 1 quadruped (MakeBiped passes its HeadType as AssemblyType).
37. `MakeShadowChain` registry `ShadowType` actually means "null shadow" (non-zero → null hierarchy). MakeQuadruped / MakeDogLeg call MakeFoot without ThreeBoneToe → two-bone toes. Builders return JScript objects (members listed in the note); MakeRigIcon / MakeHip return the X3DObject; SetKeyableRig returns nothing.
38. Registry return flags vs behaviour: `AddCommandToPlugin` always returns false; `syCachePaint1/2`, `SyGetMassMap/SpringMap` return nothing and only select a weight map (no paint tool); `SIGeneratePlugin` / `SIGenerateToolbar` return empty on the output-directory errors. `GenerateCommandPlugin` runs the new command once after loading a script plug-in. `UpgradeShaders` colour-to-scalar port transfer always fails as shipped.
39. `GenNormalMap` / `GenDiffuseMap`: `GPUSurfaceFX.js` is not shipped in the install (inferred: the commands fail to find their script).
