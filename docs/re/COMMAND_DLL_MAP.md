# Command → implementing binary / script map

Index kept by `si-analyst`: for each Softimage command, the file that implements it and the
handler (script procedure name, or image address of the C++ handler). Extended every run.
Addresses are image addresses in the shipped 2015 SP2 binaries. Status is the analyst status
of the command's contract (see the note). No code is recorded here.

## Commands

| Command | Implemented in | Handler | Row | Note | Status |
|---------|----------------|---------|-----|------|--------|
| `GetAddonDocHelper` | `Addons\sdkui\Application\Plugins\AddonDoc.js` | `GetAddonDocHelper_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC-PARTIAL |
| `GetAddonDocPath` | `Addons\sdkui\Application\Plugins\AddonDoc.js` | `GetAddonDocPath_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC |
| `GetAddonUpdateArray` | `Addons\sdkui\Application\Plugins\AddonDoc.js` | `GetAddonUpdateArray_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC |
| `GetNbUpdatesPending` | `Addons\sdkui\Application\Plugins\AddonDoc.js` | `GetNbUpdatesPending_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC |
| `CreateXMLDoc` | `Addons\sdkui\Application\Plugins\SDKWizards.js` | `CreateXMLDoc_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC |
| `WizardHelper` | `Addons\sdkui\Application\Plugins\SDKWizards.js` | `WizardHelper_Execute` | CMD-01-ADDONDOC | [cmd-01-addondoc-wizardhelper.md](../ghidra/cmd-01-addondoc-wizardhelper.md) | SPEC-PARTIAL |
| `UIApplyShaderToCnxPoints` | `Application\bin\shadertasks.dll (ProgID SI.3D.UIApplyShaderToCnxPointsTask)` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |
| `Texture Pop-up Menu` | `Application\bin\shadertasks.dll + shaderhelper.dll C3DShaderMenuHelper (inferred)` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |
| `ClipMatch` | `Application\DSScripts\action.vbs` | `ClipMatchProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `CreateScaleEffect` | `Application\DSScripts\action.vbs` | `CreateScaleEffectProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `CrossfadeClipWeights` | `Application\DSScripts\action.vbs` | `CrossfadeClipWeightsProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `CutClip` | `Application\DSScripts\action.vbs` | `CutClipFunc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `DeleteUnusedCamSeqTracks` | `Application\DSScripts\action.vbs` | `DeleteUnusedCamSequencerTracksProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `FreezeAndReplaceClips` | `Application\DSScripts\action.vbs` | `FreezeClipsAndReplaceFunc / GetInputAndFreezeAndReplaceClipsProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `FreezeClips` | `Application\DSScripts\action.vbs` | `FreezeClipsFunc / GetInputAndFreezeClipsProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ImportActionAndAddClip` | `Application\DSScripts\action.vbs` | `ImportActionAndAddClipProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ImportActionAndApply` | `Application\DSScripts\action.vbs` | `ImportActionAndApplyProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ImportAudioAndAddClip` | `Application\DSScripts\action.vbs` | `ImportAudioAndAddClip` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `OffloadAction` | `Application\DSScripts\action.vbs` | `OffloadActionProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `PartialOffloadAction` | `Application\DSScripts\action.vbs` | `PartialOffloadActionProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ReloadAction` | `Application\DSScripts\action.vbs` | `ReloadActionProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ResetAllEffectCurves` | `Application\DSScripts\action.vbs` | `ResetAllEffectCurvesProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ResetEffectAtFrame` | `Application\DSScripts\action.vbs` | `ResetEffectAtFrameProc / ResetEffectAtFrameUIProc (uixsiscripts.vbs)` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `ResetSelectedEffectCurves` | `Application\DSScripts\action.vbs` | `ResetSelectedEffectCurvesProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `SelectActionsFromObjects` | `Application\DSScripts\action.vbs` | `SelectActionsFromObjectsFunc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `SelectObjectsFromAction` | `Application\DSScripts\action.vbs` | `SelectObjectsFromActionFunc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `TrimAfter` | `Application\DSScripts\action.vbs` | `CutClipLoopProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `TrimBefore` | `Application\DSScripts\action.vbs` | `CutClipLoopProc` | CMD-10a | [cmd-10a-mixer-action-scripts.md](../ghidra/cmd-10a-mixer-action-scripts.md) | SPEC |
| `RetargetRigToRig` | `Application\DSScripts\animation.vbs` | `RetargetRigToRigProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `RetargetTagRig` | `Application\DSScripts\animation.vbs` | `RetargetTagRig` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `TogglePinObjectInPosition` | `Application\DSScripts\animation.vbs` | `TogglePinObjectInPositionProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `AppendBone` | `Application\DSScripts\chains.vbs` | `AppendBoneProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `AddProxyParamToCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `AddProxyParameterToCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `CreateSubCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `CreateSubCharacterSetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `DeleteCurrentCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `DeleteCurrentCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `GetAllCharacterKeySets` | `Application\DSScripts\CharacterKeySets.vbs` | `GetAllCharacterKeySetsCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `GetCurrentCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `GetCurrentCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `InspectCurrentCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `InspectCurrentCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `OpenAnimationEditorOnCurrentCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `OpenAnimationEditorOnCurrentCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `RemoveKeyOnCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `RemoveKeyOnCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `SaveKeyOnCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `SaveKeyOnCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `SaveZeroKeyOnCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `SaveZeroKeyOnCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `SelectObjectsFromCharacterKeySet` | `Application\DSScripts\CharacterKeySets.vbs` | `SelectObjectsFromCharacterKeySetCommand` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `SymEnvWeight` | `Application\DSScripts\enveloping.vbs` | `SymmetryEnvelopeWeightProc / UISymmetryEnvelopeWeightProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `ClosestPaintShapeKey` | `Application\DSScripts\fxscripts.js` | `ClosestPaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `DeletePaintShapeKey` | `Application\DSScripts\fxscripts.js` | `DeletePaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `FirstPaintShapeKey` | `Application\DSScripts\fxscripts.js` | `FirstPaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `LastPaintShapeKey` | `Application\DSScripts\fxscripts.js` | `LastPaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `NextPaintShapeKey` | `Application\DSScripts\fxscripts.js` | `NextPaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `PaintShapeManipTool` | `Application\DSScripts\fxscripts.js` | `PaintShapeManipToolProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `PrevPaintShapeKey` | `Application\DSScripts\fxscripts.js` | `PrevPaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `SavePaintShapeKey` | `Application\DSScripts\fxscripts.js` | `SavePaintShapeKeyProc` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `AcclaimImport` | `Application\DSScripts\importexport.vbs` | `AcclaimImportSub` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `BiovisionImport` | `Application\DSScripts\importexport.vbs` | `BiovisionImportSub` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `ObjExport` | `Application\DSScripts\importexport.vbs` | `WavefrontExport / WavefrontExportProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `SetupDisplacement` | `Application\DSScripts\importexport.vbs` | `SetupDisplacementProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `SI_InspectWavefrontImportOptions` | `Application\DSScripts\importexport.vbs` | `InspectWavefrontImportOptions` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `UnhideAllPolygonClusters` | `Application\DSScripts\layers.vbs` | `UnhideAllPolygonClustersProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `UnhideAllPolygons` | `Application\DSScripts\layers.vbs` | `UnhideAllPolygonsProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `CreateModelAndConvertToRef` | `Application\DSScripts\Model.vbs` | `CreateModelAndConvertToRefProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `CreateRefModel` | `Application\DSScripts\Model.vbs` | `CreateRefModelProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `ExportDotXSI` | `Application\DSScripts\Model.vbs` | `ExportDotXSIProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `ImportDotXSI` | `Application\DSScripts\Model.vbs` | `ImportDotXSIProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `ImportIges` | `Application\DSScripts\Model.vbs` | `ImportIgesProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `RemoveUnusedDeltas` | `Application\DSScripts\Model.vbs` | `RemoveUnusedDeltas` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `ToggleReferencedModel` | `Application\DSScripts\Model.vbs` | `ToggleReferencedModelProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `SetKeyableAttributes` | `Application\DSScripts\parameters.vbs` | `SetKeyableAttributesProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `CreateShotCamera` | `Application\DSScripts\primitives.vbs` | `CreateShotCameraProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `CreateShotCameraAndSwitch` | `Application\DSScripts\primitives.vbs` | `CreateShotCameraAndSwitchProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `GetPrimCameraWithoutInterest` | `Application\DSScripts\primitives.vbs` | `GetPrimCameraWithoutInterestProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `SearchAndReplacePath` | `Application\DSScripts\Scene.vbs` | `GetInputAndReplacePathProc` | CMD-04b | [cmd-04b-import-export-model-scripts.md](../ghidra/cmd-04b-import-export-model-scripts.md) | SPEC |
| `SelectUVRow` | `Application\DSScripts\selection.vbs` | `SelectUVRowProc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `DrawImplicitPrimitiveTool` | `Application\DSScripts\tools.vbs` | `DrawImplicitPrimitiveTool` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `DrawNullTool` | `Application\DSScripts\tools.vbs` | `DrawImplicitPrimitiveTool` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `DrawPrimitiveTool` | `Application\DSScripts\tools.vbs` | `DrawPrimitiveTool` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `DuplicateTool` | `Application\DSScripts\tools.vbs` | `DuplicateTool` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `CreateUserDataMap` | `Application\DSScripts\UserDataScripts.vbs` | `CreateUserDataMapFunc` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `SIInspectUserData` | `Application\DSScripts\UserDataScripts.vbs` | `InspectUserDataSub` | CMD-B5f | [cmd-b5f-misc-dsscripts.md](../ghidra/cmd-b5f-misc-dsscripts.md) | SPEC |
| `AbcExport` | `Application\Plugins\AbcImportExport.dll` | `0x180002640` | CMD-01e | [cmd-01e-alembic.md](../ghidra/cmd-01e-alembic.md) | SPEC |
| `AbcImport` | `Application\Plugins\AbcImportExport.dll` | `0x180003290` | CMD-01e | [cmd-01e-alembic.md](../ghidra/cmd-01e-alembic.md) | SPEC |
| `AbcVer` | `Application\Plugins\AbcImportExport.dll` | `0x180003bd0` | CMD-01e | [cmd-01e-alembic.md](../ghidra/cmd-01e-alembic.md) | SPEC |
| `OnAbcExportMenu` | `Application\Plugins\AbcImportExport.dll` | `0x180005bb0` | CMD-01e | [cmd-01e-alembic.md](../ghidra/cmd-01e-alembic.md) | SPEC |
| `OnAbcImportMenu` | `Application\Plugins\AbcImportExport.dll` | `0x180006950` | CMD-01e | [cmd-01e-alembic.md](../ghidra/cmd-01e-alembic.md) | SPEC |
| `AddPhysicalSky` | `Application\Plugins\AddPhysicalSky.js` | `AddPhysicalSky_Execute` | CMD-01d | [cmd-01d-keysets-paintkeys-sky.md](../ghidra/cmd-01d-keysets-paintkeys-sky.md) | SPEC |
| `ApplyCamSeqFileCacheSources` | `Application\Plugins\SeqCam.dll` | `0x180008880` | CMD-19a | [cmd-19a-seqcam.md](../ghidra/cmd-19a-seqcam.md) | SPEC |
| `PlotCamSeqForCachedObjects` | `Application\Plugins\SeqCam.dll` | `0x180008f10` | CMD-19a | [cmd-19a-seqcam.md](../ghidra/cmd-19a-seqcam.md) | SPEC |
| `PlotSequencerCamera` | `Application\Plugins\SeqCam.dll` | `0x180009ae0` | CMD-19a | [cmd-19a-seqcam.md](../ghidra/cmd-19a-seqcam.md) | SPEC |
| `AddParticleEvent` | `DSScripts/particle.vbs` | `AddParticleEventProc / AddParticleEventUIProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `AddParticleForce` | `DSScripts/particle.vbs` | `AddParticleForceProc / AddParticleForceUIProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `AddParticleGoal` | `DSScripts/particle.vbs` | `AddParticleGoalProc / AddParticleGoalUIProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateExplosion` | `DSScripts/particle.vbs` | `CreateExplosionProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateFluid` | `DSScripts/particle.vbs` | `CreateFluidProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateInspectParticleTypeBillboard` | `DSScripts/particle.vbs` | `CreatePTypeProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateInspectParticleTypeBlob` | `DSScripts/particle.vbs` | `CreatePTypeProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateInspectParticleTypeSphere` | `DSScripts/particle.vbs` | `CreatePTypeProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateParticleCloud` | `DSScripts/particle.vbs` | `CreateParticleCloudProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CreateParticleSimulationFromFile` | `DSScripts/particle.vbs` | `CreateParticleSimulationFromFileProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `EmitPointsFromObject` | `DSScripts/particle.vbs` | `EmitPointsFromObjectProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `InspectInitStateProp` | `DSScripts/particle.vbs` | `InspectInitStatePropProc / InspectParticleOperatorProc` | CMD-03b | [cmd-03b-particle-scripts.md](../ghidra/cmd-03b-particle-scripts.md) | SPEC |
| `CameraTextureProj` | `DSScripts/Texture.vbs` | `CameraTextureProjProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `ConnectToTextureProj` | `DSScripts/Texture.vbs` | `ConnectToSupportProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `CreateSubprojection` | `DSScripts/Texture.vbs` | `CreateSubprojectionProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `CreateTextureProj` | `DSScripts/Texture.vbs` | `CreateTextureProjProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `CreateTextureSpatial` | `DSScripts/Texture.vbs` | `CreateTextureSpatialProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `CreateTextureUVDomain` | `DSScripts/Texture.vbs` | `CreateTextureUVDomainProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `FitSubcomponentUVsToImage` | `DSScripts/Texture.vbs` | `FitSubcomponentUVsToImage` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `HideTextureUVDomains` | `DSScripts/Texture.vbs` | `ToggleVisibilityOfTextureUVDomainsProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `ModifyUVSetByContourStretching` | `DSScripts/Texture.vbs` | `ModifyUVSetByContourStretchingFunc / ModifyUVSetByContourStretchingProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `SetCheckerboardMode` | `DSScripts/Texture.vbs` | `SetCheckerboardMode` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `ToggleVisibilityOfTextureUVDomains` | `DSScripts/Texture.vbs` | `ToggleVisibilityOfTextureUVDomainsProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `UnhideTextureUVDomains` | `DSScripts/Texture.vbs` | `ToggleVisibilityOfTextureUVDomainsProc` | CMD-12a | [cmd-12a-texture-projection-scripts.md](../ghidra/cmd-12a-texture-projection-scripts.md) | SPEC |
| `SIApplyShaderToCnxPoint2` | `not located` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |
| `SIApplyShaderToCnxPoint` | `not located (15 DLLs ruled out by name)` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |
| `SIConnectShaderToCnxPoint` | `not located; converter table in Application\bin\shaderhelper.dll` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |
| `Modify Texture Pop-up Menu` | `same (inferred)` | `` | CMD-01c-CNX | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) | SPEC-PARTIAL |

## Earlier rows (not yet itemised per command)

| Row | Implemented in | Note |
|-----|----------------|------|
| CMD-01a (40 FBX commands) | `Application\Plugins\FBXXSI.64.dll` | [cmd-01a-fbx.md](../ghidra/cmd-01a-fbx.md) |
| CMD-01b (17 SDK helpers) | `Application\Commands\SDKHelpers.js`, `SDKVBHelpers.vbs`, `GlobalVarPlugin.js`, `SimpleProperties.js` | [cmd-01b-sdk-helpers.md](../ghidra/cmd-01b-sdk-helpers.md) |
| CMD-01c groups A–E (21) | `Application\bin\shadertasks.dll` (4 layer tasks), `Application\DSScripts\Rendering.vbs` | [cmd-01c-texture-layers.md](../ghidra/cmd-01c-texture-layers.md) |

## Binary facts collected in bulk

Registration strings, exports and hashes seen while a binary was open; starting points for later rows.

- FBXXSI.64.dll sha256 7986a68b1042… | ImportFBXOptions_Define 0x18008c110
- AbcImportExport.dll sha256 0dd9d96b4c89… | ImportAbcOptions_Define 0x180005610, ExportAbcOptions_Define 0x180004110
- SeqCam.dll sha256 12e72b90f40c… | exports also XSISequencerCamera{Kine,Prim}Op_{Define,Init,Term,Update}, XSISeqCam{NewScene,OpenScene,Startup}_OnEvent
- shadertasks.dll task ProgIDs (bulk, by string table): SetInstanceDataTask, UIPresetPopUpMenuTask, UIApplyShaderToCnxPointsTask, UITextureAssignmentTask, UITextureAppendTask, SIRebindByNameUserDataTask, RenameAndRebindTask, AddTextureLayerTask, AddTextureLayerPortsTask, MoveTextureLayersTask, RemoveTextureLayersTask, AddArrayElementTask, RemoveArrayElementTask, SwapArrayElementsTask, Add/Remove/Move/RenameShaderCompoundPortTask, Create/Explode/Export/ImportShaderCompoundTask, CreateShaderTask, NestShadersTask, UnnestShadersTask, Set/GetShaderCompoundPropertiesTask, Set/GetShaderCompoundPortPropertiesTask, DeleteShadersTask, Export/ImportShaderTreeTask, ExportShaderDefinitionTask, UpdateShaderDefinitionsTask (likely homes of SetInstanceDataValue, RenamePropAndRebind_Internal and the shader-compound commands)
- propertytasks.dll: SI.3D.ConnectShaderToCnxPoint_OverrideInstallTask

## Registry-declared homes of commands still TODO

From the `file` field of `data/commands_full.json` (self-installing plug-ins and script commands).
Commands with an empty `file` (about 600, built-in C++) are not listed; locate them by string search when a DLL is opened.

| Language | File | Commands | Names |
|----------|------|---------:|-------|
| CPP | `FR.dll` | 110 | `AddFaceControl`, `GetFaceCluster`, `GetFaceWeightMap`, `MakeEyeRig`, `MakeEyelids`, `MakeFaceStructure`, `RegenerateEyelids`, `fr_AddObjectInPlace`, `fr_AddToGroup`, `fr_AdjustMetaMouth`, `fr_AdjustRetargetedFace`, `fr_AnimateEyes`, `fr_AnimateRegionMasks`, `fr_ApplyFacePose`, `fr_ApplyFaceRobotGameShader`, `fr_ApplySculptPose`, `fr_ApplyStress`, `fr_C3DDebugFace`, `fr_C3DToFaceRobot`, `fr_CalibrateFace`, `fr_CalibrateRetargetedFace`, `fr_Callstack_IsDebugMode`, `fr_ClipWeights`, `fr_CrawlToVertex`, `fr_CreateFaceMap`, `fr_DeformerToWeightMap`, `fr_DeformerTransfer`, `fr_DeleteAllSculptSessions`, `fr_DeleteSculptSession`, `fr_DuplicateFace`, `fr_EnvelopeAliasing`, `fr_ExportGameHierarchy`, `fr_ExportLWScene`, `fr_ExportModel`, `fr_ExportMotionFile`, `fr_ExportPointOvenCache`, `fr_ExportPointOvenScene`, `fr_ExportShape`, `fr_EyelidsDeformCurves`, `fr_EyelidsInfluenceMaps`, `fr_FacialMocapTools`, `fr_FileDelete`, `fr_FileRead`, `fr_FileWrite`, `fr_FlushRetargetedFace`, `fr_GetCommand`, `fr_GetCurrentObjState`, `fr_GetEyelashMedian`, `fr_GetFaceModel`, `fr_GetFilesForBrowser`, `fr_GetNormalArray`, `fr_GetOperatorsInStack`, `fr_GetPointArray`, `fr_GlueMeshGlobal`, `fr_InspectSculptHistory`, `fr_IsDesigner`, `fr_JawDeflationEaseInCurves`, `fr_JawFattening`, `fr_JawLowerDeflation`, `fr_JawSliding`, `fr_JawSlidingEaseInCurves`, `fr_JawUpperDeflation`, `fr_LoadC3D`, `fr_LogFaceCalibration`, `fr_MakeEyeBall`, `fr_MakeNormalMap`, `fr_MakeRegionMasks`, `fr_MapRegion`, `fr_MapStress`, `fr_MapTendon`, `fr_MirrorMouthSculpt`, `fr_MirrorSculpt`, `fr_Mute`, `fr_MuteSources`, `fr_NeighborIndex`, `fr_PlotRetargetedFace`, `fr_PlotRetargetedFaceUI`, `fr_PrepareExport`, `fr_ProxyMouth`, `fr_RefreshSculptHistory`, `fr_RemoveTongue`, `fr_RepairNan`, `fr_ResetControllerDB`, `fr_SaveFacePose`, `fr_SculptBegin`, `fr_SculptEnd`, `fr_SculptEyelidBegin`, `fr_SculptEyelidEnd`, `fr_SculptMouthBegin`, `fr_SculptMouthEnd`, `fr_SculptPuffingBegin`, `fr_SculptPuffingEnd`, `fr_SculptTendonBegin`, `fr_SculptTendonEnd`, `fr_ShakeFit`, `fr_StartRegionPaint`, `fr_StickLips`, `fr_ToggleMuteSculptSession`, `fr_ToggleShowMaps`, `fr_ToggleShowMapsUnselected`, `fr_VectorMouth`, `fr_Visible`, `fr_WriteC3D`, `fr_sdelete`, `fr_sdump`, `fr_sfeatures`, `fr_sget`, `fr_sindices`, `fr_sset`, `fr_sstring` |
| VBScript | `uixsiscripts.vbs` | 81 | `AddComponentTool`, `AddImageSource`, `AddModelClip`, `AddModelSource`, `AddToContainer`, `AddWritableImageSource`, `Align`, `ApplyPath`, `AssembleNurbsMesh`, `BipedRigOnUpdate`, `CreateCurve`, `CreateImageClip2`, `CreateModelClip`, `CreateReferencePlane`, `DecreaseManipulatorSize`, `DeleteAllUnusedMaterials`, `DeleteUnusedAnimationSources`, `DeleteUnusedAudioSources`, `DeleteUnusedCacheSources`, `DeleteUnusedImageClips`, `DeleteUnusedImageSources`, `DeleteUnusedMaterials`, `DisplayPortValues`, `ExportPreferences`, `GetShaderOnCnxPointFunction`, `GetViewportUnderMouse`, `GroupPointClouds`, `ImportPreferences`, `IncreaseManipulatorSize`, `InfoGeometry`, `InspectLocks`, `InspectMaterial`, `InspectPreferences`, `InspectSnapProperties`, `InspectTransformProperties`, `InspectViewCubeProperties`, `InstallAddon`, `LoadPreset`, `LockEnvelopeDeformerWeights`, `MakeICETreeBranch`, `ManCharacterOnUpdate`, `MatchTransform`, `MergeScene`, `MoveCtr2Vertices`, `OffsetValueMap`, `ParamBracketing`, `PlotCameraSequencer`, `PromoteICETree`, `RemoveFromContainer`, `RenamePropAndRebind`, `RenamePropAndRebindUI`, `RestoreDefaultPreference`, `RotoscopyOptions`, `SIUpdateCamerasFromGlobalPref`, `SIUpdateFxTreesFromGlobalPref`, `SIUpdatePlayControlFromGlobalPref`, `SaveActionKey`, `SaveKeyOnMarkedKeyable`, `SaveOffsetKeys`, `SavePivotKey`, `SaveShapeKey`, `SetCameraSequencerLayout`, `SetFocusedViewport`, `SetLightingDisplayMode`, `SetNURBSDisplayQualityDefault`, `SetNURBSDisplayQualityHigh`, `SetNURBSDisplayQualityLow`, `SetNURBSDisplayQualityMedium`, `SetTransformRefMode`, `SetTransientReferencePlane`, `SplitCloud`, `StoreGeomApproxProperties`, `StoreMaterialProperties`, `StoreVisibilityProperties`, `SwitchToView`, `SwitchToViewByType`, `ToggleBackgroundColor`, `ToggleContinuousDraw`, `ToggleFullscreenLayout`, `TransferShapeAnimation`, `UnInstallAddon` |
| CPP | `bvrexport.dll` | 22 | `BvrAddBVHAction`, `BvrAddColSphere`, `BvrAddFloor`, `BvrAddJointLimit`, `BvrGenerateActor`, `BvrGenerateRenderSetup`, `BvrGotoHome`, `BvrImportBVHAction`, `BvrInitActor`, `BvrMakeLoop`, `BvrMakeSkill`, `BvrRemoveCOG`, `BvrRemoveFloor`, `BvrRemoveFoot`, `BvrRemoveJointLimit`, `BvrRenderSetup`, `BvrSetCOG`, `BvrSetCollisionOnly`, `BvrSetDefault`, `BvrSetFoot`, `BvrSetHome`, `BvrSetVisualOnly` |
| VBScript | `operators.vbs` | 19 | `AddEdge`, `ApplyDeformBySpine`, `ApplySpringOp`, `BurnAndDeleteGATOROperator`, `ChangeVertexColorDatatype`, `Convert`, `CreateClusterCenter`, `CreateClusterCenterWithNull`, `CreateNonOverlappingCluster`, `CreateSimulationBracket`, `DuplicateMeshComponent`, `DuplicateUsingGeomApprox`, `InsertCurveKnot`, `InspectSpringPropertiesProc`, `MeshSubdivideWithCenter`, `SetRefPlaneFromSymmetrizePolygonOp`, `SetSymmetrizePolygonOpRefPlane`, `SplitPolygon`, `TrimWith` |
| CPP | `CDKMotionTransform.64.dll` | 14 | `CleanTagsFromRig`, `InheritRetargetSetup`, `LoadMOTORAdjustmentPresetFile`, `LoadMotorFile`, `LoadTagTemplateFile`, `RemoveAllMotorPropsAndOps`, `RemoveMOTOROperators`, `RetargetBVH`, `RetargetC3DData`, `RetargetExtractEndFrame`, `RetargetExtractStartFrame`, `SaveC3DPoseMap`, `SaveMOTORAdjustmentPresetFile`, `SaveTagTemplateFile` |
| VBScript | `getset.vbs` | 13 | `SyGetCollidePnts`, `SyGetCollidePols`, `SyGetMimic`, `SyGetNail`, `SyGetPin`, `SyGetSelfCollidePols`, `SyPinGetMesh`, `SySetCollidePnts`, `SySetCollidePols`, `SySetMimic`, `SySetNail`, `SySetPin`, `SySetSelfCollidePols` |
| VBScript | `Rendering.vbs` | 13 | `ConnectImageTo3DO`, `CreateCGFX`, `CreateEmptyPartition`, `CreateFX`, `CreatePassWithPartition`, `EditShaderCompoundPPGLogic`, `ExportAllPassesToMI2`, `ExportMI2File`, `GetPass`, `LaunchFlipbookForPass`, `SICreatePartition`, `ShowNextOGLProjection`, `ShowPreviousOGLProjection` |
| CPP | `Unfold3D.64.dll` | 12 | `UnfoldAddToCut`, `UnfoldAdjustUpdate`, `UnfoldApply`, `UnfoldApplySel`, `UnfoldClearCut`, `UnfoldPackUpdate`, `UnfoldRegularize`, `UnfoldRelax`, `UnfoldRemoveFromCut`, `UnfoldSelectCut`, `UnfoldSetCut`, `UnfoldUpdate` |
| CPP | `dotXSIConverter.64.dll` | 11 | `CreateExportCrosswalkOptions`, `CreateExportFTKOptions`, `CreateImportCrosswalkOptions`, `CreateImportFTKOptions`, `CrosswalkExportMatLib`, `CrosswalkImportMatLib`, `CrosswalkVersion`, `ExportCrosswalk`, `ExportFTK`, `ImportCrosswalk`, `ImportFTK` |
| JScript | `CacheManager.js` | 10 | `AddToList`, `GetItemsAsString`, `GetObjectsFromSource`, `ReadCachesFile`, `RefreshCachesPathProp`, `RemoveFromList`, `RemoveNumbering`, `SelectionValueToItemName`, `UpdateCacheManager`, `WriteCachesFile` |
| VBScript | `cloth.vbs` | 9 | `SyClearAllCache`, `SyClearCache`, `SyCreateFlesh`, `SyCreateSkin`, `SyGetMassMap`, `SyGetSpringMap`, `SySetMassMap`, `SySetSpringMap`, `sySaveCache` |
| VBScript | `force.vbs` | 8 | `SyCreateAir`, `SyCreateDamp`, `SyCreateGravity`, `SyCreateSpring`, `SyCreateTurbulence`, `SyCreateVolume`, `SyCreateWind`, `SyCreateZipper` |
| VBScript | `simulation.vbs` | 7 | `CacheObjectsIntoFile`, `CacheObjectsIntoFileDialog`, `ChangeEnvironmentDynamicsOperator`, `EditICECompoundPPGLogic`, `MergeSimulationEnvironments`, `StoreEnvironmentCacheToMixer`, `StoreEnvironmentCachesToMixer` |
| VBScript | `collid.vbs` | 5 | `SyCollideGetMesh`, `SyCreateCollideMesh`, `SyCreateCollidePla`, `SyCreateCollideSph`, `SyCreateSelfCollide` |
| VBScript | `constr.vbs` | 4 | `SyCreateMimic`, `SyCreateNail`, `SyCreatePin`, `SySetConstraintMap` |
| CPP | `CrowdFX.64.dll` | 4 | `CrowdFBXPlot_ExportBegin`, `CrowdFBXPlot_ExportEnd`, `CrowdFBXPlot_ExportMode`, `FBXPlotAndExportCrowd` |
| VBScript | `duplicate.vbs` | 4 | `CopyAllAnimation2`, `DuplicateFromAnim`, `RemoveAllAnimation`, `SaveKeyAtMultipleFrames` |
| CPP | `PO_MDDScriptTools.64.dll` | 4 | `poMDDFrameData`, `poMDDFrames`, `poMDDPoints`, `poMDDTimes` |
| VBScript | `cache.vbs` | 3 | `syCachePaint1`, `syCachePaint2`, `syCreateCache` |
| JScript | `CommandWizard.js` | 3 | `AddCommandToPlugin`, `CreateCommandWizard`, `GenerateCommandPlugin` |
| JScript | `Lagoa_Commands.js` | 3 | `LagoaDisplayType`, `LagoaEmitMPVolume`, `LagoaTagCollisionObject` |
| JScript | `makeCharacterKeySet.js` | 3 | `MakeBipedCharacterKeySet`, `MakeQuadrupedCharacterKeySet`, `SetKeyableRig` |
| VBScript | `state.vbs` | 3 | `syClearState`, `syClearVelocityState`, `sySetState` |
| VBScript | `Charac_RigFromBiped.vbs` | 2 | `MakeBiped`, `MakeBipedDogLeg` |
| JScript | `command.js` | 2 | `CreateAndEditCommand`, `EditCommand` |
| CPP | `customcommands.dll` | 2 | `ObjImport`, `SIObjExport` |
| JScript | `ExternalFileListViewer.js` | 2 | `SIGetExternalFilesViewerProp`, `SISetExternalFilesManagerTarget` |
| JScript | `GPUSurfaceFX.js` | 2 | `GenDiffuseMap`, `GenNormalMap` |
| VBScript | `ICEfxBuilder.vbs` | 2 | `LagoaSetupAdvectMesh`, `LagoaSetupClothMesh` |
| JScript | `PluginWizard.js` | 2 | `CreatePluginWizard`, `SIGeneratePlugin` |
| CPP | `PO_XSI_ImportLWO.64.dll` | 2 | `PO_XSI_ImportLWO`, `XSI_Import_POScene` |
| VBScript | `RenderManager.vbs` | 2 | `OpenOutputFormatPreferences`, `OverrideMarkedPassParameters` |
| CPP | `ShapeWeight.64.dll` | 2 | `fr_AddSamplerDataCache`, `fr_ApplyShapeWeightOp` |
| JScript | `ToolbarWizard.js` | 2 | `CreateToolbarWizard`, `SIGenerateToolbar` |
| CPP | `ultimapper.dll` | 2 | `FindUltimapperDistance`, `GenerateUltimapper` |
| VBScript | `action.vbs` | 1 | `FindPeriods` |
| CPP | `BoneCreateTool.dll` | 1 | `BoneCreateTool_UpdateBone` |
| VBScript | `CacheManagerVBS.vbs` | 1 | `GetCacheOnFile` |
| VBScript | `Charac_RigFromQuadruped.vbs` | 1 | `MakeQuadruped` |
| VBScript | `Create_Polygonizer_PolymeshPlugin.vbs` | 1 | `Create_Polygonizer_Polymesh` |
| CPP | `DirectXExport.dll` | 1 | `DXExport` |
| CPP | `DirectXImport.dll` | 1 | `DXImport` |
| JScript | `EvolverLipSync.js` | 1 | `GenerateLipSync` |
| CPP | `FR_ICE_Import.64.dll` | 1 | `FR_Import_Animation_Rig_To_ICE` |
| CPP | `HWParsers.dll` | 1 | `ClearRealtimeShaderCache` |
| VBScript | `ICEFlowInsertSimulationRoot.vbs` | 1 | `ICEFlowInsertSimulationRoot` |
| JScript | `make2PointSlide.js` | 1 | `Make2PointSlide` |
| JScript | `makeArm.js` | 1 | `MakeArm` |
| JScript | `makeBelly.js` | 1 | `MakeBelly` |
| JScript | `makeBicepRoll.js` | 1 | `MakeBicepRoll` |
| JScript | `makeBiped.js` | 1 | `MakeBiped` |
| JScript | `makeBipedDogLeg.js` | 1 | `MakeBipedDogLeg` |
| JScript | `makeDogLeg.js` | 1 | `MakeDogLeg` |
| JScript | `makeFoot.js` | 1 | `MakeFoot` |
| JScript | `makeForearmRoll.js` | 1 | `MakeForearmRoll` |
| JScript | `makeHand.js` | 1 | `MakeHand` |
| JScript | `makeHead.js` | 1 | `MakeHead` |
| JScript | `makeHip.js` | 1 | `MakeHip` |
| JScript | `makeJointCompression.js` | 1 | `MakeJointCompression` |
| JScript | `makeLeg.js` | 1 | `MakeLeg` |
| JScript | `makeQuadruped.js` | 1 | `MakeQuadruped` |
| JScript | `makeRigIcon.js` | 1 | `MakeRigIcon` |
| JScript | `makeShadowChain.js` | 1 | `MakeShadowChain` |
| JScript | `makeShadowSpine.js` | 1 | `MakeShadowSpine` |
| JScript | `makeSpine.js` | 1 | `MakeSpine` |
| JScript | `makeThighSlide.js` | 1 | `MakeThighSlide` |
| JScript | `makeTorso.js` | 1 | `MakeTorso` |
| JScript | `PluginTreeActions.js` | 1 | `ConnectToWorkgroupUI` |
| CPP | `PO_XSI_Baker.64.dll` | 1 | `PO_XSI_Baker` |
| CPP | `PO_XSI_ExportLWO.64.dll` | 1 | `PO_XSI_ExportLWO` |
| CPP | `Polygonizer.64.dll` | 1 | `ApplyPolygonizer` |
| CPP | `polymatricks.dll` | 1 | `Applypolymatricks` |
| JScript | `PPGLayoutControl.js` | 1 | `PPGLayoutControl` |
| JScript | `RTShaderCategories.js` | 1 | `RTShaderSetCategories` |
| JScript | `RTUserTools.js` | 1 | `DeleteUnusedShaders` |
| JScript | `SDKScriptGenerator.js` | 1 | `SDKGetScriptGenerator` |
| JScript | `ShaderDefHelper.js` | 1 | `GetShaderDefHelper` |
| JScript | `ShaderWizard.js` | 1 | `CreateMRShaderWizard` |
| CPP | `syCmd.64.dll` | 1 | `SyCmdSaveCache` |
| JScript | `TemplateWizard.js` | 1 | `CreateTemplateWizard` |
| VBScript | `UpgradeShaders.vbs` | 1 | `UpgradeShaders` |
| JScript | `WizardParamTab.js` | 1 | `GetWizardParamTab` |
