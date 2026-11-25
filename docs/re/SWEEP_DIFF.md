# Command sweep diff

AfterImage sweep: `docs/re/sweep_afterimage.json` (2095 commands). No Softimage sweep yet: run `tools/si_command_sweep.js` in Softimage 2015 SP2 (XSIBATCH) and pass its .jsonl.

Every command is run with its default arguments on the ?demo starter scene (cube selected), then undone. "silent" means no undo entry, return value, log line, selection / DOM / module / scene change or UI event was seen; viewport-camera and preference changes are not observed, so a silent command is a lead, not proof of a gap.

| AfterImage class | Commands |
|---|---:|
| ok | 852 |
| status_fail | 473 |
| placeholder | 282 |
| silent | 278 |
| precondition | 142 |
| unregistered | 62 |
| crash | 5 |
| hang | 1 |

## AfterImage: unregistered (62)

| Command | AfterImage | Detail |
|---|---|---|
| `Activate Group/Cluster Select Tool using Filter` | unregistered |  |
| `ApplyOperator` | unregistered |  |
| `ApplyPolygonizer` | unregistered |  |
| `Bottom View` | unregistered |  |
| `CacheObjectsIntoFile` | unregistered |  |
| `Camera Visibility Options` | unregistered |  |
| `Center Selection` | unregistered |  |
| `Clip` | unregistered |  |
| `DisconnectICENodePort` | unregistered |  |
| `Frame Preview Active Camera` | unregistered |  |
| `Freeform Select Tool` | unregistered |  |
| `GetBBox` | unregistered |  |
| `GetICECompoundProperties` | unregistered |  |
| `GetShaderCompoundProperties` | unregistered |  |
| `GetValue` | unregistered |  |
| `InitPropVolume` | unregistered |  |
| `Inspect Rendering Preferences` | unregistered |  |
| `Instantiate` | unregistered |  |
| `Isometric View` | unregistered |  |
| `Lasso Select Tool` | unregistered |  |
| `Left View` | unregistered |  |
| `Lock` | unregistered |  |
| `Maximize/Restore Current Viewport` | unregistered |  |
| `OpenNetView` | unregistered |  |
| `Paint Properties` | unregistered |  |
| `Parent Tool` | unregistered |  |
| `Perspective View` | unregistered |  |
| `Polygon Cluster Visibility Property` | unregistered |  |
| `Raycast Select Tool` | unregistered |  |
| `Rectangle Raycast Select Tool` | unregistered |  |
| `Rectangle Select Tool` | unregistered |  |
| `Redo (alternate)` | unregistered |  |
| `Redo Camera (alternate)` | unregistered |  |
| `Refresh` | unregistered |  |
| `Remove Key Hot Key` | unregistered |  |
| `SIConvert` | unregistered |  |
| `SIExportDotXSIFile` | unregistered |  |
| `SIFilter` | unregistered |  |
| `SIGetPrim` | unregistered |  |
| `SIGetShaderOnCnxPoint` | unregistered |  |
| `SIImportDotXSIFile` | unregistered |  |
| `Save Key Hot Key` | unregistered |  |
| `Scene Camera View` | unregistered |  |
| `SetCurrentReferencePlane` | unregistered |  |
| `SetShaderCompoundPropertiesEx` | unregistered |  |
| `StartChannelCapture` | unregistered |  |
| `StopChannelCapture` | unregistered |  |
| `Toggle AutoKey` | unregistered |  |
| `Toggle Curve Snap` | unregistered |  |
| `Toggle Field Guide` | unregistered |  |
| `Toggle Grid Snap` | unregistered |  |
| `Toggle Pixel Zoom` | unregistered |  |
| `Toggle Point Snap` | unregistered |  |
| `Toggle Proportional` | unregistered |  |
| `Top View` | unregistered |  |
| `Triangulate` | unregistered |  |
| `Undo (alternate)` | unregistered |  |
| `Undo Camera (alternate)` | unregistered |  |
| `Unlock` | unregistered |  |
| `Zoom In` | unregistered |  |
| `Zoom Out` | unregistered |  |
| `siTrimWith` | unregistered |  |

## AfterImage: crash (5)

| Command | AfterImage | Detail |
|---|---|---|
| `AddToList` | crash | TypeError: Cannot read properties of null (reading 'UIItems') |
| `Create2DSkeleton` | crash | RangeError: Maximum call stack size exceeded |
| `GetObjectsFromSource` | crash | TypeError: Cannot read properties of null (reading 'Parent') |
| `SelectionValueToItemName` | crash | TypeError: Cannot read properties of null (reading 'PPGLayout') |
| `SetValue` | crash | TypeError: Cannot read properties of undefined (reading 'split') |

## AfterImage: hang (1)

| Command | AfterImage | Detail |
|---|---|---|
| `FreezeAndReplaceClips` | hang | timeout |

## AfterImage: placeholder (282)

| Command | AfterImage | Detail |
|---|---|---|
| `3D Chain Tool` | placeholder | info: 3D Chain Tool: not yet attested: joint placement in depth (the 3D chain differs from the 2D chain in how joints follow the view); poin |
| `AbcImport` | placeholder | info: AbcImport_Execute called; info: not yet attested: reading an Alembic archive (no Alembic framework in this build) (AbcImport; docs/ghi |
| `AbcVer` | placeholder | info: Unable to load the Alembic Framwork library (not yet attested: Alembic framework version texts (AbcVer; docs/ghidra/cmd-01e-alembic.md |
| `AcclaimImport` | placeholder | info: AcclaimImport: not yet attested: batch mode: the modal inspection is treated as Cancel (docs/ghidra/cmd-04b-import-export-model-script |
| `ActivateSampledPointSelTool` | placeholder | info: ActivateSampledPointSelTool: not yet attested: the set-filter task {91d68770-dbe9-11d2-8bcf-00aa006130ef} for the SampledPoint filter  |
| `ActivateSampledPointSelToolWithNoObjStateChange` | placeholder | info: ActivateSampledPointSelToolWithNoObjStateChange: not yet attested: the set-filter task {91d68770-dbe9-11d2-8bcf-00aa006130ef} for the  |
| `ActivateSelectTool` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `ActivateTipSelTool` | placeholder | info: Selection filter: Tip; info: ActivateTipSelTool: not yet attested: picking hair tips in the viewport (this build has no such component |
| `Add Surface Point Tool` | placeholder | info: Add Surface Point Tool: not yet attested: the Add Surface Point tool (class {DCCB8091-B82C-11D1-A900-00A024190119}): no such viewport  |
| `AddFaceControl` | placeholder | info: AddFaceControl: not yet attested: the face-model getter 0x18000f3f0(1); a model `Face` is created (inferred get-or-create) (CMD-B14c) |
| `AddGroup` | placeholder | info: AddGroup: not yet attested: AddGroup without a Target container (the argument handler is not traced); nothing moved (CMD-B20b) |
| `AddImageSource` | placeholder | info: AddImageSource: not yet attested: an empty file name (file browsing belongs to the low-level command); no source was produced (docs/gh |
| `AddModelClip` | placeholder | info: AddModelClip: not yet attested: "" is not a model source of this build's store; no clip was produced (docs/ghidra/cmd-b6b-uixsi-clips- |
| `AddModelSource` | placeholder | info: AddModelSource: not yet attested: an empty file name; no model source was produced (docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md  |
| `AddParticleForce` | placeholder | info: Pick Force; info: AddParticleForce: not yet attested: connecting forces to cube (not a legacy particle cloud of this build) (docs/ghid |
| `AddParticleObstacle` | placeholder | info: AddParticleObstacle: not yet attested: the simulation operator of cube (not a cloud, cloth or soft body of this build) (CMD-B15c) |
| `AddScriptedOp` | placeholder | info: AddScriptedOp: not yet attested: running the JScript Update code (the operator is connected and passes its input through) (CMD-B10 inf |
| `AddWritableImageSource` | placeholder | info: AddWritableImageSource: not yet attested: an empty file name (file browsing belongs to the low-level command); no source was produced  |
| `ApplySoftBody` | placeholder | info: ApplySoftBody: not yet attested: the SoftBodyOp simulation (the operator is placed on the stack; it does not deform here) (docs/ghidra |
| `BiovisionImport` | placeholder | info: BiovisionImport: not yet attested: batch mode: the modal inspection is treated as Cancel (docs/ghidra/cmd-04b-import-export-model-scri |
| `BvrGenerateActor` | placeholder | info: Behavior Export: The source actor description must be contained by a single model (scene root not supported). |
| `BvrGotoHome` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrImportBVHAction` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrImportBVHActor` | placeholder | info: BvrImportBVHActor: not yet attested: the value written to BVHActor.Mode (CMD-B13a); info: BvrImportBVHActor: not yet attested: buildin |
| `BvrInitActor` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrLoadActor` | placeholder | info: BvrLoadActor: not yet attested: the "Load Actor" file dialog (no file browser in this build without a hook); cancelled (CMD-B13a) |
| `BvrMakeLoop` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrMakeSkill` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrSaveActor` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `BvrSetCOG` | placeholder | info: Behavior Export: The actor description must be contained by a single model (scene root not supported). |
| `BvrSetHome` | placeholder | info: Behavior Export: Actor descriptions must be contained by a single model (scene root not supported). |
| `CacheObjectsIntoFile_Private` | placeholder | info: CacheObjectsIntoFile_Private: not yet attested: the per-sample cache writer (0x180078240) and the cache file format; the planned sampl |
| `Cam3dsMaxNavigTool` | placeholder | info: Cam3dsMaxNavigTool: not yet attested: the 3ds Max-style mouse mapping; the generic Navigation Tool is used (CMD-B10 inferred batch) |
| `CamMayaZoomTool` | placeholder | info: CamMayaZoomTool: not yet attested: the Maya-style mouse mapping; the generic Zoom Tool is used (CMD-B10 inferred batch) |
| `CameraTextureProj` | placeholder | error: SICameraTextureProj: There were no valid camera selected; info: SICameraTextureProj: not yet attested: the status returned after this |
| `CollapseLayers` | placeholder | info: CollapseLayers: not yet attested: the collapse worker (StartFrame / EndFrame / StepFrame / Fit FCurve / Fit Tolerance); the earlier la |
| `ColorizeObject` | placeholder | info: ColorizeObject: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts |
| `ConnectNewPolygonToEdge` | placeholder | info: ConnectNewPolygonToEdge: not yet attested: the status returned when the object has no geometry; the command stops (docs/ghidra/cmd-b8f |
| `ConnectNewPolygonToPoint` | placeholder | info: ConnectNewPolygonToPoint: not yet attested: the status returned when the object has no geometry; the command stops (docs/ghidra/cmd-b8 |
| `ConnectToTextureProj` | placeholder | error: SIConnectToSupport: There were no valid texture control selected; info: SIConnectToSupport: not yet attested: the status returned aft |
| `Convert` | placeholder | info: Convert: not yet attested: the conversion is the C++ command SIConvert, which is not available; SIConvert "", "" was not run (docs/ghi |
| `ConvertSelection` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `ConvertSelectionToEdges` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `ConvertSelectionToPoints` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `ConvertSelectionToPolygons` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `ConvertShapeReferenceMode` | placeholder | info: ConvertShapeReferenceMode: not yet attested: the value conversion of the convert worker (keys of this build are stored as absolute pos |
| `CopyExtFilesIntoProject` | placeholder | info: CopyExtFilesIntoProject: not yet attested: the external-file copy itself (modeltasks.dll); the request is recorded in app.tasksB11c.co |
| `Create3DSkeleton` | placeholder | info: GetUserPref: not yet attested: the legacy-name table and the CPM helper; "SI3D_ALIGN_ROOT_1ST_BONE" is not known (CMD-B11c); error: Ge |
| `CreateAndEditCommand` | placeholder | info: CreateAndEditCommand: not yet attested: the modal inspect of the command editor; treated as Cancel (CMD-B17h) |
| `CreateCGFX` | placeholder | info: CreateCGFX: not yet attested: a file name without a dot ("") has no defined result; nothing is created (docs/ghidra/cmd-b6e-duplicate- |
| `CreateEventSource` | placeholder | info: CreateEventSource: not yet attested: what a target that is not an event holder does (CMD-B15c) |
| `CreateExplosion` | placeholder | info: CreateExplosion: not yet attested: the simulation of operator BlowUpOp and whether it can still be created in 2015 SP2 (docs/ghidra/cm |
| `CreateExportCrosswalkOptions` | placeholder | info: CreateExportCrosswalkOptions: not yet attested: the export target capability table of InfoGrid (0x1800582f0); the grid is left empty ( |
| `CreateExportFTKOptions` | placeholder | info: CreateExportFTKOptions: not yet attested: the export target capability table of InfoGrid (0x1800582f0); the grid is left empty (CMD-B1 |
| `CreateFluid` | placeholder | info: CreateFluid: not yet attested: the parameters and owner of the particle type made by CreateParticleType (docs/ghidra/cmd-03b-particle- |
| `CreateImageClip2` | placeholder | info: CreateImageClip2: not yet attested: an empty file name (file browsing belongs to the low-level command); no clip was produced (docs/gh |
| `CreateImportCrosswalkOptions` | placeholder | info: CreateImportCrosswalkOptions: not yet attested: the import target capability table of InfoGrid (0x1800582f0); the grid is left empty ( |
| `CreateImportFTKOptions` | placeholder | info: CreateImportFTKOptions: not yet attested: the import target capability table of InfoGrid (0x1800582f0); the grid is left empty (CMD-B1 |
| `CreateMRShaderWizard` | placeholder | info: CreateMRShaderWizard: not yet attested: the property parameters, page layout and generated files (SPDL, C++ source, project) of Shader |
| `CreateModelClip` | placeholder | info: CreateModelClip: not yet attested: an empty file name (file browsing belongs to the low-level command); no clip was produced (docs/ghi |
| `CreateParticleCloud` | placeholder | info: CreateParticleCloud: not yet attested: the parameters and owner of the particle type made by CreateParticleType (docs/ghidra/cmd-03b-p |
| `CreatePluginWizard` | placeholder | info: CreatePluginWizard: not yet attested: batch mode: the modal inspection of "Plug-in Wizard" is treated as Cancel (CMD-B15f) |
| `CreateTextureUVDomain` | placeholder | info: SICreateTextureUVDomain: no valid input (message 0x36; text not yet attested, Q10) |
| `CreateToolbarWizard` | placeholder | info: CreateToolbarWizard: not yet attested: batch mode: the modal inspection of "Toolbar Wizard" is treated as Cancel (CMD-B15f) |
| `Create_Polygonizer_Polymesh` | placeholder | info: Create_Polygonizer_Polymesh: not yet attested: the command ApplyPolygonizer is not in this build; the call ApplyPolygonizer() was not  |
| `CrosswalkImportMatLib` | placeholder | info: CrosswalkImportMatLib: not yet attested: the import target capability table of InfoGrid (0x1800582f0); the grid is left empty (CMD-B13 |
| `CursorTransformTool` | placeholder | info: CursorTransformTool: not yet attested: the Cursor Transform tool (class {BAAA041A-D204-45DF-8D4F-E2C524678315}): no such viewport tool |
| `DXExport` | placeholder | info: DXExport: not yet attested: the modal property page of DXExportProperty (no dialog host); cancelled (CMD-B13e) |
| `DXImport` | placeholder | info: DXImport: not yet attested: the modal property page of DXImportProperty (no dialog host); cancelled (CMD-B13e) |
| `Delete Components` | placeholder | info: Delete Components: not yet attested: the Delete tool (interactively deletes picked objects / components) (class {DAC73700-99C8-11D1-84 |
| `Delete Objects Tool` | placeholder | info: Delete Objects Tool: not yet attested: the Delete tool (interactively deletes picked objects / components) (class {DAC73700-99C8-11D1- |
| `DeleteAll` | placeholder | info: NewScene: not yet attested: the save-changes confirmation of the scene I/O service (outside tasks.dll); the scene is replaced without  |
| `DeleteAnimationLayer` | placeholder | error: DeleteAnimationLayer: invalid layer index for Scene_Root (message 0x27; text not yet attested, Q1) |
| `DeleteCurrentLayer` | placeholder | info: DeleteCurrentLayer: not yet attested: deleting the last layer (Layer_Default) (CMD-B16c) |
| `DeleteCurrentPass` | placeholder | info: DeleteCurrentPass: not yet attested: deleting the last pass (Default_Pass) (CMD-B16c) |
| `DeleteObjPermanent` | placeholder | info: DeleteObjPermanent: not yet attested: what "permanently" does beyond DeleteObj |
| `Dice Object/Polygons` | placeholder | info: Dice Object/Polygons: not yet attested: the "Dice Object" topology preset (DiceObject) is not in this build; group 2 (object) skipped  |
| `DisplayPortValues` | placeholder | info: DisplayPortValues: not yet attested: a call without a port (who supplies the port and its data type, context and structure is open; do |
| `DrawImplicitPrimitiveTool` | placeholder | info: DrawImplicitPrimitiveTool: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-mis |
| `DrawNullTool` | placeholder | info: DrawNullTool: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts.m |
| `DrawPrimitiveTool` | placeholder | info: DrawPrimitiveTool: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscri |
| `DumpMemoryStats` | placeholder | info: DumpMemoryStats: not yet attested: the CSISlabAllocator statistics (allocator names and counters); this build has no slab allocator an |
| `Duplicate/Extrude Multiple` | placeholder | info: Duplicate/Extrude Multiple: not yet attested: the options dialog of "Duplicate Multiple" (duplicate.vbs:DuplicateWizardProc); the targ |
| `DuplicateAnimationLayer` | placeholder | error: DuplicateAnimationLayer: invalid layer index for Scene_Root (message 0x27; text not yet attested, Q1) |
| `DuplicateModelFromObj` | placeholder | info: DuplicateModelFromObj: not yet attested: Duplicate "B:Scene.Scene_Root.cube" option arguments (only TextureSupports = 1 is set by the  |
| `DuplicateTool` | placeholder | info: DuplicateTool: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts. |
| `EditExpr` | placeholder | info: EditExpr: not yet attested: the expression editor view itself (class {ae04e220-...}); this build opens its stand-in editor and records |
| `EditICECompoundPPGLogic` | placeholder | info: EditICECompoundPPGLogic: not yet attested: GetICECompoundProperties is not on the bus and cube carries no compound property array (doc |
| `EditShaderCompoundPPGLogic` | placeholder | info: EditShaderCompoundPPGLogic: not yet attested: GetShaderCompoundProperties is not on the bus and cube carries no compound property arra |
| `EmitPointsFromObject` | placeholder | info: EmitPointsFromObject: not yet attested: the emission compounds and the simulate node are placeholders in this build's ICE node catalog |
| `EvalFCurve` | placeholder | info: EvalFCurve: not yet attested: the value returned when the parameter has no fcurve (result field as initialised) (docs/ghidra/cmd-b8a-f |
| `ExportDotXSI` | placeholder | info: ExportDotXSI: not yet attested: batch mode: the modal inspection of the export options is treated as Cancel (docs/ghidra/cmd-04b-impor |
| `ExportPreferences` | placeholder | info: ExportPreferences: not yet attested: Preferences.Export with an empty file name; nothing was exported (docs/ghidra/cmd-b6c-uixsi-prefs |
| `ExportRenderArchiveAllPasses` | placeholder | info: ExportRenderArchiveAllPasses: not yet attested: pass-list preparation (0x180090690) (CMD-B19a); info: ExportRenderArchiveAllPasses: no |
| `ExportRenderArchiveFrameSet` | placeholder | info: ExportRenderArchiveFrameSet: not yet attested: pass-list preparation (0x180090690) (CMD-B19a); info: ExportRenderArchiveFrameSet: not  |
| `FaceRobot` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `FilterPSet` | placeholder | info: FilterPSet: not yet attested: the numeric values of siPSetRelationship (siContainedPSet = 1, siSharedPSet = 2, siInheritedPSet = 4 are |
| `GenerateUltimapper` | placeholder | info: GenerateUltimapper: not yet attested: the map generator (0x180006970); no maps written (CMD-B13e) |
| `Get default camera` | placeholder | info: SIGetPrimCamera: not yet attested: the constraint parameter with id 4 that the pose setup sets to true (name not resolved) (docs/ghidr |
| `GetFCurveInfo` | placeholder | info: GetFCurveInfo: not yet attested: the status when InputObj cannot be converted to an fcurve; nothing is returned |
| `GetKeyInfo` | placeholder | info: GetKeyInfo: not yet attested: the status when InputObj cannot be converted to an fcurve; nothing is returned |
| `GetKeyed` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); info: GetKeyed: not yet attested: |
| `GetKeyed2` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); info: GetKeyed2: not yet attested |
| `GetPresetModel` | placeholder | info: GetPresetModel: not yet attested: C:/Program Files/Autodesk/Softimage 2015 SP2/Data/XSI_SAMPLES/Models/WomanSkeleton_Rig.emdl (this sa |
| `GetPrimStereoCamera` | placeholder | info: GetPrimStereoCamera: not yet attested: the StereoCameraRig / StereoCameraSecondaryRig ICE compounds (side-camera placement, ToeIn): th |
| `GetPrimVolumeDeform` | placeholder | info: SIGetPrimVolumeDeform: not yet attested: the helper sub-task that receives the primitive and the inputs (presumably sizing the volume  |
| `GetProportionalGuide` | placeholder | info: GetProportionalGuide: modal dialog "Create Biped Guide" not available in this session; taken as OK with the values shown (stand-in, CM |
| `GetShotClip` | placeholder | info: GetShotClip: not yet attested: which clip the sequencer returns at frame 0, outside every clip (none returned, not directly over) (CMD |
| `Hide Back Facing Polygons` | placeholder | info: Hide Back Facing Polygons: not yet attested: drawing with back faces culled (meaning of display flag 5 assumed from the name; the view |
| `ICEFlowInsertSimulationRoot` | placeholder | info: ICEFlowInsertSimulationRoot: not yet attested: the root ports of an ICE tree (the build's ICE tree has no root ports and no Simulation |
| `ICEOfflineRefresh` | placeholder | info: ICEOfflineRefresh: not yet attested: ICE offline editing mode (dirty service-mode objects) is not modelled in this build; nothing was  |
| `ImportDotXSI` | placeholder | info: ImportDotXSI: not yet attested: batch mode: the modal inspection of the import options is treated as Cancel (docs/ghidra/cmd-04b-impor |
| `ImportPreferences` | placeholder | info: ImportPreferences: not yet attested: Preferences.Import with an empty file name; nothing was imported (docs/ghidra/cmd-b6c-uixsi-prefs |
| `ImportRefModels` | placeholder | info: ReconnectModel: not yet attested: restoring the external connections of RefModel from "Scene.Scene_Root.RefModel," (CMD-B10 inferred b |
| `InfoGeometry` | placeholder | info: InfoGeometry: not yet attested: the content of InfoGeometry.htm (a Softimage page); a Net View window showing its address was opened ( |
| `InfoScene` | placeholder | info: InfoScene: general: 6 objects, 0 models, 0 groups, 1 layers, 124 points, 134 polygons, 236 triangles; info: InfoScene: animation: 9 fc |
| `InfoSelection` | placeholder | info: InfoSelection: cube (polymsh): 8 points, 12 edges, 6 polygons, 12 triangles, 0 children; info: InfoSelection: 1 object(s); not yet att |
| `InspectInitStateProp` | placeholder | info: InspectInitStateProp: not yet attested: InspectObj on an empty collection (docs/ghidra/cmd-03b-particle-scripts.md Wire contract: the  |
| `InspectLocks` | placeholder | info: InspectLocks: not yet attested: the content of InfoLocks.htm (a Softimage page); a Net View window showing its address was opened (doc |
| `InspectPreferences` | placeholder | info: OpenXSIExplorer: not yet attested: the number of the enum member siExplorerScopeCustom (docs/ghidra/cmd-b7a-uitasks-group-view-binary. |
| `InspectSnapProperties` | placeholder | info: InspectSnapProperties: not yet attested: the property page of Preferences.SnapProperties is not modelled in this build; nothing was op |
| `InspectSpringPropertiesProc` | placeholder | info: InspectSpringPropertiesProc: not yet attested: InspectObj with an empty list; nothing was opened (docs/ghidra/cmd-b6d-operators-script |
| `InstallAddon` | placeholder | info: InstallAddon: not yet attested: the object-model add-on installer with an empty file name (docs/ghidra/cmd-b6b-uixsi-clips-display-add |
| `IsAnimationLayerLocked` | placeholder | error: IsAnimationLayerLocked: invalid layer index for Scene_Root (message 0x27; text not yet attested, Q1) |
| `LagoaEmitMPVolume` | placeholder | info: cube; info: LagoaEmitMPVolume: not yet attested: the Lagoa compounds and the root ports of an ICE tree are not in this build: the comp |
| `LagoaSetupAdvectMesh` | placeholder | info: LagoaSetupAdvectMesh: not yet attested: ICEFlow_CreateParticlesFromPreset and the preset "Lagoa Setup Advect Mesh" (the call with 8 ar |
| `LagoaSetupClothMesh` | placeholder | info: LagoaSetupClothMesh: not yet attested: ICEFlow_CreateParticlesFromPreset and the preset "Lagoa Setup Cloth Mesh" (the call with 5 argu |
| `LagoaTagCollisionObject` | placeholder | info: Object -->cube tagged with Set Collision Data node, inspect ICEtree; info: WARNING : Objects tagged! Make sure these objects are added |
| `LinkDeform` | placeholder | info: LinkDeform: not yet attested: the command script of the script-backed handler 5c0cf8b6 (not read in this row); nothing is linked (CMD- |
| `LinkDeformWithOri` | placeholder | info: LinkDeformWithOri: not yet attested: the link worker (UnPack reads Cluster, LinkWithOri, Parameter list); LinkDeform is run (CMD-B20a) |
| `LoadFastPlaybackCache` | placeholder | info: LoadFastPlaybackCache: not yet attested: the modal file browser "Load Fast Playback Cache" (no file browser in this build; treated as  |
| `LockAnimationLayer` | placeholder | error: LockAnimationLayer: invalid layer index for Scene_Root (message 0x27; text not yet attested, Q1) |
| `LockEnvelopeDeformerWeights` | placeholder | info: LockEnvelopeDeformerWeights: not yet attested: no envelope on the given weight property; nothing locked (docs/ghidra/cmd-b6c-uixsi-pre |
| `MakeBiped` | placeholder | info: Make Biped: modal dialog not available (stand-in); applying the default option values (inferred, CMD-B15e); error: makeBiped: No Biped |
| `MakeBipedDogLeg` | placeholder | info: Make Biped Dog Leg: modal dialog not available (stand-in); applying the default option values (inferred, CMD-B15e); error: makeBipedDo |
| `MakeFaceStructure` | placeholder | info: MakeFaceStructure: not yet attested: the six names of the meshnames table (0x1802d0040); six empty names are stored (CMD-B14c); info:  |
| `MakeHip` | placeholder | info: MakeHip: not yet attested: interactive PickPosition ("Pick Top of Hip Position" / "Pick Side of Hip Position"); the Top / Side argumen |
| `MakeQuadruped` | placeholder | info: Make Quadruped: modal dialog not available (stand-in); applying the default option values (inferred, CMD-B15e); error: makeQuadruped:  |
| `MatchTransform` | placeholder | info: MatchTransform: not yet attested: picking the target without a user session; nothing was matched (docs/ghidra/cmd-b6b-uixsi-clips-disp |
| `Modify Texture Pop-up Menu` | placeholder | error: Modify Texture Pop-up Menu: not yet attested: the item order, the list of connected shaders, which task serves the command and what a |
| `MoveComponent Tool` | placeholder | info: MoveComponent Tool: not yet attested: the MoveComponent tool class {DA55A810-5F86-11D2-B11C-00A0C906811E}; the Tweak tool body stands  |
| `NewScene` | placeholder | info: NewScene: not yet attested: the save-changes confirmation of the scene I/O service (outside tasks.dll); the scene is replaced without  |
| `OBJ Import...` | placeholder | info: SI_InspectWavefrontImportOptions: not yet attested: batch mode: the modal inspection is treated as Cancel (docs/ghidra/cmd-04b-import- |
| `ObjExport` | placeholder | info: cube; info: SIObjExport: not yet attested: the OBJ Export function worker of customcommands.dll (OBJ writer, ledger row CMD-01-OBJ-BIN |
| `ObjImport` | placeholder | info: ObjImport: not yet attested: the Obj Import function worker of customcommands.dll (OBJ reader, ledger row CMD-01-OBJ-BIN); nothing is  |
| `OffsetValueMap` | placeholder | info: OffsetValueMap: attested command (no behavioral golden in the committed Animate dumps); info: OffsetValueMap: not yet attested: the na |
| `OneClickSendTo` | placeholder | info: OneClickSendTo: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendTo: not yet attested: ICE gather / |
| `OneClickSendTo3dsMaxAddToCurrentScene` | placeholder | info: OneClickSendTo3dsMaxAddToCurrentScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendTo3dsMaxAdd |
| `OneClickSendTo3dsMaxSendAsNewScene` | placeholder | info: OneClickSendTo3dsMaxSendAsNewScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendTo3dsMaxSendAs |
| `OneClickSendTo3dsMaxUpdateCurrentScene` | placeholder | info: OneClickSendTo3dsMaxUpdateCurrentScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendTo3dsMaxUp |
| `OneClickSendToMax` | placeholder | info: OneClickSendToMax: not yet attested: SendBack gather / cache steps (time span etc.) (CMD-B18e); info: OneClickSendToMax: Aborting the  |
| `OneClickSendToMayaAddToCurrentScene` | placeholder | info: OneClickSendToMayaAddToCurrentScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendToMayaAddToCu |
| `OneClickSendToMayaSendAsNewScene` | placeholder | info: OneClickSendToMayaSendAsNewScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendToMayaSendAsNewS |
| `OneClickSendToMayaUpdateCurrentScene` | placeholder | info: OneClickSendToMayaUpdateCurrentScene: not yet attested: ICE gather step after the time span (CMD-B18e); info: OneClickSendToMayaUpdate |
| `OneClickSendToMudboxAddToCurrentScene` | placeholder | info: OneClickSendToMudboxAddToCurrentScene: not yet attested: FBXExport "C:\Temp\MBX70D8.fbx" (FBX file writing, SYS-03) (CMD-B18e); info:  |
| `OneClickSendToMudboxSendAsNewScene` | placeholder | info: OneClickSendToMudboxSendAsNewScene: not yet attested: FBXExport "C:\Temp\MBXEB07.fbx" (FBX file writing, SYS-03) (CMD-B18e); info: One |
| `OneClickSendToMudboxUpdateCurrentScene` | placeholder | info: OneClickSendToMudboxUpdateCurrentScene: not yet attested: FBXExport "C:\Temp\MBX8574.fbx" (FBX file writing, SYS-03) (CMD-B18e); info: |
| `OneClickSetup` | placeholder | info: OneClickSetup: not yet attested: ICEFlowState_Define (other parameters, defaults and layout) (CMD-B18e) |
| `OpenScene` | placeholder | info: OpenScene: not yet attested: browsing for a scene file when SceneFileName is empty (file argument handler 6f97fb91); the File > Open d |
| `OpenTransientExplorer` | placeholder | info: OpenTransientExplorer: not yet attested: the transient explorer without a user interface; an empty list is returned |
| `PaintPushTool` | placeholder | info: PaintPushTool: not yet attested: the Push operator modulated by PushMap: this build's Push operator ignores the weight map (CMD-B17g); |
| `ParamBracketing` | placeholder | info: ParamBracketing: not yet attested: the content of ParamBracketing.htm (a Softimage page); a Net View window showing its address was op |
| `Pick Session Tool` | placeholder | info: Pick Session Tool: not yet attested: what the pick session tool does without a running pick session (it is the current tool) (CMD-B16a |
| `PlaybackTimeRange` | placeholder | info: PlaybackTimeRange: not yet attested: which spans and which integer setting of the playback controller are saved and forced; taken as t |
| `PlotCamSeqToActions` | placeholder | info: PlotCamSeqToActions: not yet attested: what PlotFrameSetToActions makes of an empty parameter list (no source is made here) (CMD-B11g) |
| `PlotShape` | placeholder | info: PlotShape: not yet attested: the command script of the script-backed handler 5c0cf8b6 (not read in this row); the shape keys of the in |
| `PlotToAction` | placeholder | info: PlotToAction: not yet attested: the plot worker (FCurve Kind, DefaultSegKind, Fit FCurve, Fit Tolerance, ProcessContRots); the values  |
| `PlotToActions` | placeholder | info: PlotToActions: not yet attested: the plot worker (FCurve Kind, DefaultSegKind, Fit FCurve, Fit Tolerance, ProcessContRots); the values |
| `ReconnectMixer` | placeholder | info: ReconnectMixer: not yet attested: the mixer reconnect call (slot 8, constant 0x180091700); the mixer is re-synchronised and re-evaluat |
| `RegenerateMaps` | placeholder | info: RegenerateMaps: not yet attested: the render-map job for Scene.Scene_Root.cube (accepted property types, output paths; tile size 32);  |
| `RemoveICESimInitState` | placeholder | info: RemoveICESimInitState: not yet attested: the simulation service side of the removal (the stand-in initial state is dropped) (CMD-B12b) |
| `RemoveProperties` | placeholder | info: RemoveProperties: not yet attested: an empty Type; nothing is removed |
| `RenamePropAndRebind` | placeholder | info: RenamePropAndRebind: not yet attested: the rename command with an empty name; nothing was renamed (docs/ghidra/cmd-b6c-uixsi-prefs-ice |
| `RenderPassesFrameSet` | placeholder | info: RenderPassesFrameSet: not yet attested: render job builder (0x180083320) and the job-name suffix; jobs are named after their pass (CMD |
| `RenderRegionGetDisplayType` | placeholder | info: RenderRegionGetDisplayType: not yet attested: Get on a viewport without a region (the handler reads an empty map unchecked: undefined) |
| `RenderRegionGetRefreshMode` | placeholder | info: RenderRegionGetRefreshMode: not yet attested: Get on a viewport without a region (the handler reads an empty map unchecked: undefined) |
| `RenderRegionGetRenderChannel` | placeholder | info: RenderRegionGetRenderChannel: not yet attested: Get on a viewport without a region (the handler reads an empty map unchecked) (CMD-B19 |
| `RestoreDefaultPreference` | placeholder | info: RestoreDefaultPreference: not yet attested: Preferences.RestoreDefault "" (not a category or preference of this build); nothing was re |
| `RetargetRigToRig` | placeholder | info: RetargetRigToRig: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscrip |
| `RetargetTagRig` | placeholder | info: Selection filter: Model; info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the sc |
| `RotoscopyOptions` | placeholder | info: RotoscopyOptions: not yet attested: the property page Views.ViewB.Camera.rotoscope is not modelled; the camera display property is ins |
| `SIAddWritableImageSource` | placeholder | info: SIAddWritableImageSource: not yet attested: the file browser an empty FileName opens; no file name was chosen (CMD-B15d) |
| `SICameraTextureProj` | placeholder | error: SICameraTextureProj: There were no valid camera selected; info: SICameraTextureProj: not yet attested: the status returned after this |
| `SIConnectToProjection` | placeholder | error: SIConnectToProjection: There were no valid texture projection selected; info: SIConnectToProjection: not yet attested: the status ret |
| `SIConnectToSupport` | placeholder | error: SIConnectToSupport: There were no valid texture control selected; info: SIConnectToSupport: not yet attested: the status returned aft |
| `SICreateDefaultImageClip` | placeholder | info: SICreateDefaultImageClip: not yet attested: the preference default image is empty in this build (set app.clipsSourcesB15d.defaultImage |
| `SICreateSkeleton` | placeholder | info: SICreateSkeleton: not yet attested: the chain builder (bone orientation from the normal and the view type, root alignment); the bone p |
| `SICreateTextureUVDomain` | placeholder | info: SICreateTextureUVDomain: no valid input (message 0x36; text not yet attested, Q10) |
| `SIGetPreset` | placeholder | info: SIGetPreset: not yet attested: the modal preset browser (DSDoModalPresetBrowser) is not available in this build (set app.tasksB19b.hoo |
| `SIObjExport` | placeholder | info: SIObjExport: not yet attested: the OBJ Export function worker of customcommands.dll (OBJ writer, ledger row CMD-01-OBJ-BIN); nothing i |
| `SIRenderPass` | placeholder | info: SIRenderPass: not yet attested: render job builder (0x180083320) and the job-name suffix; jobs are named after their pass (CMD-B19a);  |
| `SIStoreAction` | placeholder | info: SIStoreAction: not yet attested: the exact effect of RemoveAnim inside the store worker; the stored fcurves / expressions are removed  |
| `SITogglePolygonVisibility` | placeholder | info: SITogglePolygonVisibility: not yet attested: cube has no InvisiblePolygons cluster; whether one is created was not read, nothing is do |
| `SI_InspectWavefrontImportOptions` | placeholder | info: SI_InspectWavefrontImportOptions: not yet attested: batch mode: the modal inspection is treated as Cancel (docs/ghidra/cmd-04b-import- |
| `SampleParameterValues` | placeholder | info: SampleParameterValues: not yet attested: which CaptureMethod value ("0") is the capture / capture plain / render method; the display-p |
| `Save Zero Key Hot Key` | placeholder | info: Save Zero Key Hot Key: not yet attested: SaveZeroKeyHotKeyProc (uixsiscripts.vbs was not read; note Q2): nothing is keyed (CMD-B15f) |
| `SaveDeformKey` | placeholder | info: StoreShapeKey: not yet attested: Content :siShapeContentSecondaryShape:siShapeContent (the shape content selection of the store worker |
| `SaveFastPlaybackCache` | placeholder | info: SaveFastPlaybackCache: not yet attested: the modal file browser "Save Fast Playback Cache" (no file browser in this build; treated as  |
| `SaveKeyOnMarkedKeyable` | placeholder | info: SaveKeyOnMarkedKeyable: severity 8 or 2, XSIFCURVE message 0x26 (text not yet attested, Q8) |
| `SaveOffsetKeys` | placeholder | info: SaveOffsetKeys: attested command (no behavioral golden in the committed Animate dumps); info: SaveOffsetKeys: not yet attested: the na |
| `SavePaintShapeKey` | placeholder | info: SavePaintShapeKey: not yet attested: native save of a paint shape key; no key was saved (docs/ghidra/cmd-01d-keysets-paintkeys-sky.md  |
| `SavePivotKey` | placeholder | info: SavePivotKey: not yet attested: local kinematics parameter(s) psclx, pscly, psclz, pcsclx, pcscly, pcsclz, protx, proty, protz, pcrotx |
| `SaveScene` | placeholder | info: SaveScene: not yet attested: saving an untitled scene (no current scene file); the File > Save As dialog is used (CMD-B19b) |
| `SaveSceneAs` | placeholder | info: SaveSceneAs: not yet attested: the .scn binary format; "C:\Users\user\Autodesk\Softimage_2015_SP2\Data\XSI_SAMPLES\Scenes\Untitled.scn |
| `SaveShapeKey` | placeholder | info: Warning: Shapes only store deformations you applied while in a shape modeling construction mode.

You are not in a shape modeling mode |
| `SearchAndReplacePath` | placeholder | info: SearchAndReplacePath: not yet attested: batch mode: the modal inspection is treated as Cancel (docs/ghidra/cmd-04b-import-export-model |
| `SelectBoundaryEdgeLoop` | placeholder | info: SelectBoundaryEdgeLoop: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-d |
| `SelectEdgeLoop` | placeholder | info: SelectEdgeLoop: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts |
| `SelectModel` | placeholder | info: SelectModel: not yet attested: cube is not inside a model below the scene root; selection kept (CMD-B19c) |
| `SelectParallelEdgeLoop` | placeholder | info: SelectParallelEdgeLoop: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-d |
| `SelectSampledPointFilter` | placeholder | info: Selection filter: SampledPoint; info: SelectSampledPointFilter: not yet attested: picking sampled points in the viewport (this build h |
| `SelectShapeKey` | placeholder | info: SelectShapeKey: not yet attested: the select-shape worker (RefMode / ApplyKeys / Relational); inferred from the public SDK description |
| `SelectUVRow` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `SetAndToggleActiveElements` | placeholder | info: SetAndToggleActiveElements: not yet attested: the rule that splits the list against the active list; the whole list is taken as the fi |
| `SetAndToggleSelection` | placeholder | info: SetAndToggleSelection: not yet attested: an empty SelectionList (the split is called with no list); the selection is not touched (CMD- |
| `SetCurveType` | placeholder | info: SetCurveType: not yet attested: interpolation value 0 (documented values are 1 constant, 2 linear, 3 cubic); applied as cubic |
| `SetDefaultKeyMap` | placeholder | info: SetDefaultKeyMap: not yet attested: what the keyboard-mapping manager does with the key map name "" (outside tasks.dll); the active ke |
| `SetExpr` | placeholder | info: SetExpr: not yet attested: which parameters of the selection the argument handler supplies when nothing is marked |
| `SetICESimInitState` | placeholder | info: SetICESimInitState: not yet attested: the simulation service: the property that stores the initial state and the behaviour on non-simu |
| `SetRelativeValues` | placeholder | info: SetRelativeValues: not yet attested: which parameters of the selection the argument handler supplies when nothing is marked |
| `SetSampleSelectionFilter` | placeholder | info: SetSampleSelectionFilter: filter set to SampledPoint; not yet attested: sampled-point component picking (no sample component kind in t |
| `SetSelFilter` | placeholder | info: ActivateSelectTool: not yet attested: whether the exec context's "do not record" also suppresses the script log line; the line is logg |
| `SetThumbnailFromRegion` | placeholder | info: SetThumbnailFromRegion: not yet attested: which view has a render region (the region of this build is private to its viewports); taken |
| `ShadeObject` | placeholder | info: ShadeObject: not yet attested: picking without a user session; the pick is treated as cancelled (docs/ghidra/cmd-b5f-misc-dsscripts.md |
| `Show Next Manipulator` | placeholder | info: Show Next Manipulator: not yet attested: stepping the manipulator manager itself (which manipulator is shown); treated as "could not s |
| `Show Previous Manipulator` | placeholder | info: Show Previous Manipulator: not yet attested: stepping the manipulator manager itself (which manipulator is shown); treated as "could n |
| `ShowFaceRobotActPanel` | placeholder | info: ShowFaceRobotActPanel: not yet attested: what tool {1E0A3AAB-05DA-4716-9E7C-05FFE14242C9} shows; the floating synoptic panel "Face Rob |
| `StartTimedPlayback` | placeholder | info: StartTimedPlayback: 277 ms; info: StartTimedPlayback: not yet attested: the text of message XSIVM 0x13e (the elapsed time is logged as |
| `StoreShapeKey` | placeholder | info: StoreShapeKey: not yet attested: Content :siShapeContentSecondaryShape:siShapeContent (the shape content selection of the store worker |
| `StoreVisibilityProperties` | placeholder | info: StoreVisibilityProperties: not yet attested: the override parameters SIStoreProp creates; 1 local visibility property recorded on Scen |
| `SyCmdSaveCache` | placeholder | info: SyCmdSaveCache: not yet attested: the cache file layout, the source of the four-digit number, the open mode and the return value; no f |
| `SyCreateCloth` | placeholder | info: syCloth: not yet attested: the evaluation of the syCloth operator "syCloth" (the Syflex operators are not in the install, ledger row C |
| `SyCreateFlesh` | placeholder | info: syCloth: not yet attested: the evaluation of the syCloth operator "syCloth" (the Syflex operators are not in the install, ledger row C |
| `SyCreateSkin` | placeholder | info: syCloth: not yet attested: the evaluation of the syCloth operator "syCloth" (the Syflex operators are not in the install, ledger row C |
| `TagStepMarks` | placeholder | info: RFoot: ; info: LFoot: ; info: cog: ; info: TagStepMarks: modal dialog "Test Step Detection" not available in this session; taken as OK |
| `Texture Pop-up Menu` | placeholder | error: Texture Pop-up Menu: not yet attested: the item order, which task serves the command and what a pick runs (docs/ghidra/cmd-01c-textur |
| `ToggleProjectionTool` | placeholder | info: ToggleProjectionTool: not yet attested: the Modify Projection tool (texture projection manipulation) (class {0BF11154-359A-11D4-B4C4-0 |
| `TogglePropVolume` | placeholder | info: TogglePropVolume: not yet attested: the initialisation values of the new proportional volume on cube (0x180063800 / 0x1800622d0); the  |
| `TrimWith` | placeholder | info: TrimWith: not yet attested: no input item, so nothing has a trimwithmode parameter; the mode is not written there (docs/ghidra/cmd-b6d |
| `UIApplyShaderToCnxPoints` | placeholder | error: UIApplyShaderToCnxPoints: not yet attested: the item order of the menu shown at (0, 0) and what a pick applies to the 0 connection po |
| `UIMapButton` | placeholder | info: UIMapButton: not yet attested: the items of the shader pop-up menu (C3DShaderMenuHelper) for cube and the meaning of Flags=0; an empty |
| `UnInstallAddon` | placeholder | info: UnInstallAddon: not yet attested: the object-model add-on uninstaller with an empty file name (docs/ghidra/cmd-b6b-uixsi-clips-display |
| `UnloadAllCOMLibs` | placeholder | info: UnloadAllCOMLibs: not yet attested: COM libraries do not exist in this build; nothing was unloaded (CMD-B11b) |
| `UnlockAnimationLayer` | placeholder | error: UnlockAnimationLayer: invalid layer index for Scene_Root (message 0x27; text not yet attested, Q1) |
| `fr_AddEyeBalls` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_AddEyeSocket` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_AddMouthInterior` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_AddObjectInPlace` | placeholder | info: fr_AddObjectInPlace: not yet attested: the length size parameter of preset Cube (not present on this build's Cube) (CMD-B14a) |
| `fr_AnimateEyes` | placeholder | info: fr_AnimateEyes: not yet attested: the branch without a face model BlinkProperties property (CMD-B14c) |
| `fr_AnimateRegionMasks` | placeholder | info: Plotting Masks Animation; info: fr_AnimateRegionMasks: not yet attested: the name-table filler 0x180191490 (CMD-B14c) |
| `fr_ApplyGameSmoothFromMap` | placeholder | info: GameExport — FaceRobot script_register_hosts RegisterCommand shell; plugin body LOCK; info: fr_ApplyGameSmoothFromMap: not yet atteste |
| `fr_ApplyStress` | placeholder | info: fr_ApplyStress: not yet attested: the stress-mesh duplicator 0x1801768d0 (Q8) (CMD-B14c) |
| `fr_BuildTongueAfterSolve` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); error: FaceRobot model was not fo |
| `fr_Diagnose` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d); info: FaceRobot: not yet attested |
| `fr_ExportGameHierarchy` | placeholder | info: fr_ExportGameHierarchy: not yet attested: driver 0x1801841c0 without a valid lowResMesh (nothing is exported) (CMD-B14e) |
| `fr_EyelidsDeformCurves` | placeholder | info: fr_EyelidsDeformCurves: not yet attested: the branch without a face model EyeProperties property (CMD-B14c) |
| `fr_EyelidsInfluenceMaps` | placeholder | info: fr_EyelidsInfluenceMaps: not yet attested: the branch without a face model BlinkProperties property (CMD-B14c) |
| `fr_FacialMocapTools` | placeholder | info: fr_FacialMocapTools: not yet attested: C3DDir default (Application.InstallationPath enum, Q4) (CMD-B14d); info: fr_FacialMocapTools: n |
| `fr_Freeze` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_GetFaceModel` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a) |
| `fr_GetGameSmoothMap` | placeholder | info: GameExport — FaceRobot script_register_hosts RegisterCommand shell; plugin body LOCK; info: fr_GetGameSmoothMap: not yet attested: Gam |
| `fr_GetKeyed_safe` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); info: fr_GetKeyed_safe: not yet a |
| `fr_Holes` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_ImportSpeech` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); error: ImportSpeech: invalid audi |
| `fr_ImportVisemes` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); error: File <.csv> is invalid; in |
| `fr_KeyAllControls` | placeholder | info: fr_KeyAllControls: not yet attested: SaveKey with an empty parameter collection (nothing keyed here) (CMD-B18a) |
| `fr_KeySelControls` | placeholder | info: fr_KeySelControls: not yet attested: SaveKey with an empty parameter collection (nothing keyed here) (CMD-B18a) |
| `fr_MakeEyeBall` | placeholder | info: fr_MakeEyeBall: not yet attested: the eyeball / cornea / iris geometry and operator numerics (0x18004b8c0 / 0x18004c650), the CorneaPh |
| `fr_MakeRegionMasks` | placeholder | info: fr_MakeRegionMasks: not yet attested: the branch without a low-resolution mesh (CMD-B14c) |
| `fr_PickEyeProximity` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_PickMouthProximity` | placeholder | info: FaceRobot: not yet attested: settings reset 0x180027660(false) and 0x18002d0e0(0, false) (CMD-B14d) |
| `fr_PoseAll` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a) |
| `fr_PoseSel` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); error: no controls found to save  |
| `fr_RemoveTongue` | placeholder | info: fr_RemoveTongue: not yet attested: the call 0x180118890 (inferred UI refresh) (CMD-B14c) |
| `fr_ResetControllerDB` | placeholder | info: fr_ResetControllerDB: not yet attested: what the per-controller reset helper does to each controller's FaceControl property (ID) (CMD- |
| `fr_SaveVisemePose` | placeholder | info: fr_GetFaceModel: not yet attested: the "Head" face-model test (0x180009bb0); not applied (CMD-B14a); info: fr_GetFaceModel: not yet at |
| `fr_SculptMouthBegin` | placeholder | info: fr_SculptMouthBegin: not yet attested: the view state set by 0x1800cf880 (view name from a runtime global) (CMD-B14b) |
| `fr_SolveTongue` | placeholder | info: fr_SolveTongue: not yet attested: stage refresh: Interaction.stickytoggle value and the user camera (fov 20, posy 1, posz 42, interest |
| `fr_SolveTongueAfterSolveStage` | placeholder | info: fr_SolveTongue: not yet attested: stage refresh: Interaction.stickytoggle value and the user camera (fov 20, posy 1, posz 42, interest |
| `fr_VectorMouth` | placeholder | info: fr_VectorMouth: not yet attested: the mouth-state check 0x1800a7cd0 and the worker 0x1800aba80 (mode 0, no face mesh) (CMD-B14b) |
| `fr_sfeatures` | placeholder | info: fr_sfeatures: not yet attested: how the features table is filled (state rebuild 0x18002d110) and the two record formatters; table abse |
| `syCreateCache` | placeholder | info: syCache: not yet attested: the evaluation of the syCache operator "syCache" (the Syflex operators are not in the install, ledger row C |

## AfterImage: silent (278)

| Command | AfterImage | Detail |
|---|---|---|
| `Activate Current Select Tool using Filter` | silent |  |
| `ActivateElements` | silent |  |
| `ActivateFCurve` | silent |  |
| `ActivateFCurveOnKeyable` | silent |  |
| `ActivateFCurveOnMarkedKeyable` | silent |  |
| `Add3DObjectToScene` | silent |  |
| `AddImageClip` | silent |  |
| `AddStaticICEAttribute` | silent |  |
| `AddToMarking` | silent |  |
| `AddToSelection` | silent |  |
| `AddToTOC` | silent |  |
| `AddUserKeyword` | silent |  |
| `AddUserTab` | silent |  |
| `Align` | silent |  |
| `AlignViewCamera` | silent |  |
| `ApplyPath` | silent |  |
| `Applypolymatricks` | silent |  |
| `AssembleNurbsMesh` | silent |  |
| `AssociateEnvelopeBoundingVolume` | silent |  |
| `BeginUndo` | silent |  |
| `BipedRigOnUpdate` | silent |  |
| `BoneCreateTool_UpdateBone` | silent |  |
| `BurnAndDeleteGATOROperator` | silent |  |
| `BvrAddBVHAction` | silent |  |
| `BvrRemoveCOG` | silent |  |
| `BvrRemoveFloor` | silent |  |
| `BvrRemoveFoot` | silent |  |
| `BvrRemoveJointLimit` | silent |  |
| `CamDollyTool` | silent |  |
| `CamDriveTool` | silent |  |
| `CamFlyTool` | silent |  |
| `CamNavigTool` | silent |  |
| `CamOrbitTool` | silent |  |
| `CamPanZoomTool` | silent |  |
| `CamPivotTool` | silent |  |
| `CamRectZoomTool` | silent |  |
| `CamRollTool` | silent |  |
| `CamTrackTool` | silent |  |
| `CamWalkTool` | silent |  |
| `CamZoomTool` | silent |  |
| `CameraRedo` | silent |  |
| `CameraUndo` | silent |  |
| `CenterSelection` | silent |  |
| `ChangeGeneratorInputReadPosition` | silent |  |
| `CleanSources` | silent |  |
| `ClearParameterColor` | silent |  |
| `ClearRealtimeShaderCache` | silent |  |
| `ConnectMap` | silent |  |
| `CopyAllAnimation` | silent |  |
| `CopyAllAnimation2` | silent |  |
| `CopyAnimation` | silent |  |
| `CopyAnimationAcrossGenerator` | silent |  |
| `CopyKeys` | silent |  |
| `CopyPartition` | silent |  |
| `CrashXSI` | silent |  |
| `CreateCurvePartitionClusters` | silent |  |
| `CreateMeshPartitionClusters` | silent |  |
| `CreateParticleSimulationFromFile` | silent |  |
| `CreateScaleEffect` | silent |  |
| `CreateSpine` | silent |  |
| `CrowdFBXPlot_ExportEnd` | silent |  |
| `CrowdFBXPlot_ExportMode` | silent |  |
| `CutObj` | silent |  |
| `DeactivateElements` | silent |  |
| `DecreaseManipulatorSize` | silent |  |
| `DelayedRefresh` | silent |  |
| `DeleteCurrentCharacterKeySet` | silent |  |
| `DeleteGeneratorInputs` | silent |  |
| `DeleteMotionDerivator` | silent |  |
| `DeleteOverride` | silent |  |
| `DeleteUnusedAudioSources` | silent |  |
| `DeleteUnusedCacheSources` | silent |  |
| `DeleteUnusedCamSeqTracks` | silent |  |
| `DeleteUnusedImageClips` | silent |  |
| `DeleteUnusedImageSources` | silent |  |
| `DeleteUnusedShaders` | silent |  |
| `DoNothing` | silent |  |
| `EditICECompoundProperties` | silent |  |
| `Emission Pop-up Menu` | silent |  |
| `EndUndo` | silent |  |
| `Escape Pick Session` | silent |  |
| `Event Pop-up Menu` | silent |  |
| `ExportMI2File` | silent |  |
| `FBXExportConvert2Tif` | silent |  |
| `FitSubcomponentUVsToImage` | silent |  |
| `Force Pop-up Menu` | silent |  |
| `Frame All` | silent |  |
| `Frame Contextual` | silent |  |
| `Frame Selection` | silent |  |
| `FrameAll` | silent |  |
| `FrameContextual` | silent |  |
| `FrameSelection` | silent |  |
| `Freeze Selected` | silent |  |
| `FreezeModeling` | silent |  |
| `FreezeObj` | silent |  |
| `GetInstances` | silent |  |
| `GetMaster` | silent |  |
| `GetShaderOnCnxPointFunction` | silent |  |
| `Goal Pop-up Menu` | silent |  |
| `GroupPointClouds` | silent |  |
| `GrowSelectedLoops` | silent |  |
| `GrowSelection` | silent |  |
| `HideAllPortValues` | silent |  |
| `HideGeneratorInputs` | silent |  |
| `HideTextureUVDomains` | silent |  |
| `IncreaseManipulatorSize` | silent |  |
| `InspectChainProperties` | silent |  |
| `InspectCurrentCharacterKeySet` | silent |  |
| `InspectObj` | silent |  |
| `InspectPropVolume` | silent |  |
| `InvertSelection` | silent |  |
| `KeyAllBoneRotations` | silent |  |
| `LagoaDisplayType` | silent |  |
| `LockEnvelopeWeights` | silent |  |
| `MakeICETreeBranch` | silent |  |
| `ManipulateTool` | silent |  |
| `MoveOperator` | silent |  |
| `MoveTextureLayers` | silent |  |
| `MoveToFolder` | silent |  |
| `Obstalce Pop-up Menu` | silent |  |
| `OffloadAction` | silent |  |
| `OneClickSendTo3dsMaxSelectPreviousObjects` | silent |  |
| `OneClickSendToMayaSelectPreviousObjects` | silent |  |
| `OneClickSendToMudboxSelectPreviousObjects` | silent |  |
| `Open SE on Override parent` | silent |  |
| `OpenAnimationEditorOnCurrentCharacterKeySet` | silent |  |
| `PaintGameExport` | silent |  |
| `PartialOffloadAction` | silent |  |
| `Particle Type Pop-up Menu` | silent |  |
| `PasteKeys` | silent |  |
| `PromoteICETree` | silent |  |
| `ReadCachesFile` | silent |  |
| `RefreshCustomPreferences` | silent |  |
| `ReloadAction` | silent |  |
| `ReloadAllAddonLibs` | silent |  |
| `RemoveAllAnimation` | silent |  |
| `RemoveAnimation` | silent |  |
| `RemoveFlexEnv` | silent |  |
| `RemoveFolder` | silent |  |
| `RemoveFromGroup` | silent |  |
| `RemoveFromList` | silent |  |
| `RemoveFromMarking` | silent |  |
| `RemoveGroup` | silent |  |
| `RemoveKeyOnCharacterKeySet` | silent |  |
| `RemoveKeyOnMarkedKeyable` | silent |  |
| `RemoveRigidBody` | silent |  |
| `RemoveStaticICEAttribute` | silent |  |
| `RemoveTextureLayers` | silent |  |
| `RemoveUnusedDeltas` | silent |  |
| `RemoveUserKeyword` | silent |  |
| `RemoveUserNormals` | silent |  |
| `RemoveUserTab` | silent |  |
| `RenderRegionClose` | silent |  |
| `RenderRegionRefresh` | silent |  |
| `RenderRegionSetDisplayType` | silent |  |
| `RenderRegionSetRenderChannel` | silent |  |
| `RenderRegionToggleVisibility` | silent |  |
| `ReplaceShapeKey` | silent |  |
| `ResetAllEffectCurves` | silent |  |
| `ResetEffectAtFrame` | silent |  |
| `ResetFlexEnvPtsAssignment` | silent |  |
| `Rotate` | silent |  |
| `RotationTool` | silent |  |
| `SDKGetScriptGenerator` | silent |  |
| `SIAddImageSource` | silent |  |
| `SIAddImageSourceOp` | silent |  |
| `SIAddParticleForce` | silent |  |
| `SIAddToGroupLowLevel` | silent |  |
| `SIAppendBone` | silent |  |
| `SIConnectShaderWithBlendsInsp` | silent |  |
| `SICreateImageClip` | silent |  |
| `SILocalAssignFlexEnv` | silent |  |
| `SISequence` | silent |  |
| `SISetExternalFilesManagerTarget` | silent |  |
| `SIUnAssignMaterial` | silent |  |
| `SIUnhideObjects` | silent |  |
| `SIUpdateFxTreesFromGlobalPref` | silent |  |
| `Scale` | silent |  |
| `ScaleAndOffset` | silent |  |
| `ScalingTool` | silent |  |
| `SelectAdjacent` | silent |  |
| `SelectAllComponentLoops` | silent |  |
| `SelectAllConnectedComponents` | silent |  |
| `SelectBranch` | silent |  |
| `SelectChain` | silent |  |
| `SelectChildNodes` | silent |  |
| `SelectGeneratorInputs` | silent |  |
| `SelectGeometryComponents` | silent |  |
| `SelectNeighborObj` | silent |  |
| `SelectObj` | silent |  |
| `SelectPolygonOutline` | silent |  |
| `SelectTree` | silent |  |
| `Sequence` | silent |  |
| `SetBoneRotationToPrefRotation` | silent |  |
| `SetCameraSequencerLayout` | silent |  |
| `SetCurrentAnimationLayer` | silent |  |
| `SetCurrentCharacterKeySet` | silent |  |
| `SetDropMessage` | silent |  |
| `SetFocusedViewport` | silent |  |
| `SetKeyUsingMarkingSet` | silent |  |
| `SetKeyableAttributes` | silent |  |
| `SetMarking` | silent |  |
| `SetNURBSDisplayQualityDefault` | silent |  |
| `SetNURBSDisplayQualityHigh` | silent |  |
| `SetNURBSDisplayQualityLow` | silent |  |
| `SetNURBSDisplayQualityMedium` | silent |  |
| `SetParameterColor` | silent |  |
| `SetParticleInitState` | silent |  |
| `SetResolutionOfRefModels` | silent |  |
| `SetStaticICEAttributeType` | silent |  |
| `SetTransformRefMode` | silent |  |
| `SetUserPref` | silent |  |
| `SetViewDisplayMode` | silent |  |
| `SetupDisplacement` | silent |  |
| `Show/Hide Grid` | silent |  |
| `Show3DContextMenu` | silent |  |
| `ShrinkSelectedLoops` | silent |  |
| `ShrinkSelection` | silent |  |
| `SplitCloud` | silent |  |
| `SwitchToView` | silent |  |
| `SwitchToViewByType` | silent |  |
| `SyCollideGetMesh` | silent |  |
| `SyPinGetMesh` | silent |  |
| `Toggle Manipulator mode` | silent |  |
| `ToggleActiveElements` | silent |  |
| `ToggleBackgroundColor` | silent |  |
| `ToggleFullscreenLayout` | silent |  |
| `ToggleHeadlightDisplayMode` | silent |  |
| `ToggleICEAttributeAlwaysEvaluated` | silent |  |
| `ToggleMuteSolo` | silent |  |
| `ToggleSelection` | silent |  |
| `ToggleViewDisplayMode` | silent |  |
| `ToggleVisibilityOfTextureUVDomains` | silent |  |
| `ToggleWireOnShadedDisplay` | silent |  |
| `TransferShapeAnimationAcrossGenOp` | silent |  |
| `Transform Set New ` | silent |  |
| `Translate` | silent |  |
| `TranslateTool` | silent |  |
| `TrimAfter` | silent |  |
| `TrimBefore` | silent |  |
| `Turn OFF Interactive SRT` | silent |  |
| `Turn ON Interactive SRT` | silent |  |
| `UnAssignMaterial` | silent |  |
| `UnhideAllPolygonClusters` | silent |  |
| `UnhideAllPolygons` | silent |  |
| `UnhideTextureUVDomains` | silent |  |
| `UnloadAllAddonLibs` | silent |  |
| `UpdateCacheManager` | silent |  |
| `UpdateReferencedModel` | silent |  |
| `fr_AddToGroup` | silent |  |
| `fr_ApplySculptPose` | silent |  |
| `fr_ApplyType` | silent |  |
| `fr_BuildEyesConstraint` | silent |  |
| `fr_CalibrateFace` | silent |  |
| `fr_DeformerTransfer` | silent |  |
| `fr_DeleteAllSculptSessions` | silent |  |
| `fr_DeleteSculptSession` | silent |  |
| `fr_ExportLWScene` | silent |  |
| `fr_ExportModel` | silent |  |
| `fr_ExportMotionFile` | silent |  |
| `fr_ExportPointOvenCache` | silent |  |
| `fr_ExportPointOvenScene` | silent |  |
| `fr_ExportShape` | silent |  |
| `fr_FlushRetargetedFace` | silent |  |
| `fr_InspectSculptHistory` | silent |  |
| `fr_LogFaceCalibration` | silent |  |
| `fr_RefreshSculptHistory` | silent |  |
| `fr_RepairNan` | silent |  |
| `fr_ResetSel` | silent |  |
| `fr_SculptMouthEnd` | silent |  |
| `fr_SetPickPoints` | silent |  |
| `fr_ShakeFit` | silent |  |
| `fr_ToggleMuteSculptSession` | silent |  |
| `fr_WriteC3D` | silent |  |
| `fr_sdelete` | silent |  |
| `fr_sset` | silent |  |
| `poMDDFrames` | silent |  |
| `poMDDPoints` | silent |  |

