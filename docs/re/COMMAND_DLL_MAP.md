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
| `InspectMaterial` | `Application\DSScripts\uixsiscripts.vbs` | `InspectMaterial` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `AddToContainer` | `Application\DSScripts\uixsiscripts.vbs` | `AddToContainer` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `RemoveFromContainer` | `Application\DSScripts\uixsiscripts.vbs` | `RemoveFromContainer` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `SaveActionKey` | `Application\DSScripts\uixsiscripts.vbs` | `SaveKeyProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `SaveKeyOnMarkedKeyable` | `Application\DSScripts\uixsiscripts.vbs` | `SaveKeyOnKeyableProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC-PARTIAL |
| `SaveShapeKey` | `Application\DSScripts\uixsiscripts.vbs` | `SaveShapeKeyProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `OffsetValueMap` | `Application\DSScripts\uixsiscripts.vbs` | `OffsetValueMapProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `SaveOffsetKeys` | `Application\DSScripts\uixsiscripts.vbs` | `SaveOffsetKeysProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `CreateCurve` | `Application\DSScripts\uixsiscripts.vbs` | `CreateCurve` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedCacheSources` | `Application\DSScripts\uixsiscripts.vbs` | `CleanCacheSourceProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedImageSources` | `Application\DSScripts\uixsiscripts.vbs` | `CleanImageSourceProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedImageClips` | `Application\DSScripts\uixsiscripts.vbs` | `CleanImageClipProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedAnimationSources` | `Application\DSScripts\uixsiscripts.vbs` | `CleanAnimationSourceProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedAudioSources` | `Application\DSScripts\uixsiscripts.vbs` | `CleanAudioSourceProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteAllUnusedMaterials` | `Application\DSScripts\uixsiscripts.vbs` | `RemoveAllUnusedMaterialsProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `DeleteUnusedMaterials` | `Application\DSScripts\uixsiscripts.vbs` | `RemoveUnusedMaterialsProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `AddComponentTool` | `Application\DSScripts\uixsiscripts.vbs` | `InsertCompoOnSelectionProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `AssembleNurbsMesh` | `Application\DSScripts\uixsiscripts.vbs` | `AssembleNurbsMeshProc, ScriptAssembleNurbsMeshProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `ApplyPath` | `Application\DSScripts\uixsiscripts.vbs` | `GetInputAndApplyPathProc, ApplyPathProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `MergeScene` | `Application\DSScripts\uixsiscripts.vbs` | `MergeSceneProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `ToggleContinuousDraw` | `Application\DSScripts\uixsiscripts.vbs` | `ToggleValueProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `StoreGeomApproxProperties` | `Application\DSScripts\uixsiscripts.vbs` | `StorePropertiesProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `StoreMaterialProperties` | `Application\DSScripts\uixsiscripts.vbs` | `StorePropertiesProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `StoreVisibilityProperties` | `Application\DSScripts\uixsiscripts.vbs` | `StorePropertiesProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `Align` | `Application\DSScripts\uixsiscripts.vbs` | `GetInputAndAlignProc, AlignProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
| `CreateImageClip2` | `Application\DSScripts\uixsiscripts.vbs` | `CreateImageClipProc2` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `AddImageSource` | `Application\DSScripts\uixsiscripts.vbs` | `CreateImageSourceProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `AddWritableImageSource` | `Application\DSScripts\uixsiscripts.vbs` | `CreateWritableImageSourceProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `AddModelSource` | `Application\DSScripts\uixsiscripts.vbs` | `CreateModelSourceProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `CreateModelClip` | `Application\DSScripts\uixsiscripts.vbs` | `CreateModelClipProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `AddModelClip` | `Application\DSScripts\uixsiscripts.vbs` | `AddModelClipProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `LoadPreset` | `Application\DSScripts\uixsiscripts.vbs` | `LoadPresetProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `InstallAddon` | `Application\DSScripts\uixsiscripts.vbs` | `InstallAddonProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `UnInstallAddon` | `Application\DSScripts\uixsiscripts.vbs` | `UnInstallAddonProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `CreateReferencePlane` | `Application\DSScripts\uixsiscripts.vbs` | `CreateRefPlaneProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetTransientReferencePlane` | `Application\DSScripts\uixsiscripts.vbs` | `SetTransientRefPlaneProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `InspectSnapProperties` | `Application\DSScripts\uixsiscripts.vbs` | `InspectSnapProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `InspectTransformProperties` | `Application\DSScripts\uixsiscripts.vbs` | `InspectTransformProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `InspectViewCubeProperties` | `Application\DSScripts\uixsiscripts.vbs` | `InspectViewCubeProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `MoveCtr2Vertices` | `Application\DSScripts\uixsiscripts.vbs` | `Centre2Vertices, Centre2PointCluster, Center2ObjCenter` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `MatchTransform` | `Application\DSScripts\uixsiscripts.vbs` | `MatchPoseProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetTransformRefMode` | `Application\DSScripts\uixsiscripts.vbs` | `SetTransformRefMode` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `IncreaseManipulatorSize` | `Application\DSScripts\uixsiscripts.vbs` | `IncreaseManipulatorSizeProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `DecreaseManipulatorSize` | `Application\DSScripts\uixsiscripts.vbs` | `DecreaseManipulatorSizeProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `ToggleBackgroundColor` | `Application\DSScripts\uixsiscripts.vbs` | `ToggleBackgroundColorProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `ToggleFullscreenLayout` | `Application\DSScripts\uixsiscripts.vbs` | `ToggleFullscreenLayoutProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `RotoscopyOptions` | `Application\DSScripts\uixsiscripts.vbs` | `RotoscopyOptionsProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetLightingDisplayMode` | `Application\DSScripts\uixsiscripts.vbs` | `SetLightingDisplayModeProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetNURBSDisplayQualityDefault` | `Application\DSScripts\uixsiscripts.vbs` | `SetNURBSDisplayQualityProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetNURBSDisplayQualityHigh` | `Application\DSScripts\uixsiscripts.vbs` | `SetNURBSDisplayQualityProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetNURBSDisplayQualityLow` | `Application\DSScripts\uixsiscripts.vbs` | `SetNURBSDisplayQualityProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `SetNURBSDisplayQualityMedium` | `Application\DSScripts\uixsiscripts.vbs` | `SetNURBSDisplayQualityProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC |
| `DisplayPortValues` | `Application\DSScripts\uixsiscripts.vbs` | `GetInputAndDisplayPortValuesProc` | CMD-B6b | [cmd-b6b-uixsi-clips-display-addons.md](../ghidra/cmd-b6b-uixsi-clips-display-addons.md) | SPEC-PARTIAL |
| `ManCharacterOnUpdate` | `Application\DSScripts\uixsiscripts.vbs` | `CharacterManUpdateProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `BipedRigOnUpdate` | `Application\DSScripts\uixsiscripts.vbs` | `BipedRigUpdateProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `GetShaderOnCnxPointFunction` | `Application\DSScripts\uixsiscripts.vbs` | `GetShaderOnCnxPointFunc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `RenamePropAndRebind` | `Application\DSScripts\uixsiscripts.vbs` | `RenamePropAndRebindProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `RenamePropAndRebindUI` | `Application\DSScripts\uixsiscripts.vbs` | `RenamePropAndRebindUIProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `ImportPreferences` | `Application\DSScripts\uixsiscripts.vbs` | `ImportPreferencesProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `ExportPreferences` | `Application\DSScripts\uixsiscripts.vbs` | `ExportPreferencesProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `RestoreDefaultPreference` | `Application\DSScripts\uixsiscripts.vbs` | `RestoreDefaultPrefProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `InspectLocks` | `Application\DSScripts\uixsiscripts.vbs` | `InspectLocksProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `InfoGeometry` | `Application\DSScripts\uixsiscripts.vbs` | `InfoGeometryProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `ParamBracketing` | `Application\DSScripts\uixsiscripts.vbs` | `ParameterBracketingProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SwitchToView` | `Application\DSScripts\uixsiscripts.vbs` | `SwitchToViewProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SwitchToViewByType` | `Application\DSScripts\uixsiscripts.vbs` | `SwitchToViewByTypeProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `InspectPreferences` | `Application\DSScripts\uixsiscripts.vbs` | `InspectPreferencesProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SavePivotKey` | `Application\DSScripts\uixsiscripts.vbs` | `SavePivotKeyProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SIUpdateCamerasFromGlobalPref` | `Application\DSScripts\uixsiscripts.vbs` | `UpdateCamerasFromGlobalPrefProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SIUpdateFxTreesFromGlobalPref` | `Application\DSScripts\uixsiscripts.vbs` | `UpdateFxTreesFromGlobalPrefProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SIUpdatePlayControlFromGlobalPref` | `Application\DSScripts\uixsiscripts.vbs` | `UpdatePlayControlFromGlobalPrefProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `GetViewportUnderMouse` | `Application\DSScripts\uixsiscripts.vbs` | `ViewMgrViewportProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC-PARTIAL |
| `SetFocusedViewport` | `Application\DSScripts\uixsiscripts.vbs` | `SetFocusedViewportProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `TransferShapeAnimation` | `Application\DSScripts\uixsiscripts.vbs` | `TransferShapeAnimationProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `GroupPointClouds` | `Application\DSScripts\uixsiscripts.vbs` | `FGroupPointCloudsProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SplitCloud` | `Application\DSScripts\uixsiscripts.vbs` | `FSplitCloudProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `MakeICETreeBranch` | `Application\DSScripts\uixsiscripts.vbs` | `MakeMDOpBranchProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `PromoteICETree` | `Application\DSScripts\uixsiscripts.vbs` | `PromoteMDOpProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `SetCameraSequencerLayout` | `Application\DSScripts\uixsiscripts.vbs` | `SetCameraSequencerLayoutProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `PlotCameraSequencer` | `Application\DSScripts\uixsiscripts.vbs` | `PlotCameraSequencerProc` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC |
| `LockEnvelopeDeformerWeights` | `Application\DSScripts\uixsiscripts.vbs` | `LockEnvelopeDeformerWeightsProc (commented out; no live procedure)` | CMD-B6c | [cmd-b6c-uixsi-prefs-ice-views.md](../ghidra/cmd-b6c-uixsi-prefs-ice-views.md) | SPEC-PARTIAL |
| `AddEdge` | `Application\DSScripts\operators.vbs` | `ApplyAddEdgeFunc, ApplyAddEdgeProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `SplitPolygon` | `Application\DSScripts\operators.vbs` | `ApplySplitPolygonFunc, ApplySplitPolygonProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `InsertCurveKnot` | `Application\DSScripts\operators.vbs` | `ApplyInsertCurveKnotOpFunc, ApplyInsertCurveKnotOpProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `DuplicateMeshComponent` | `Application\DSScripts\operators.vbs` | `DuplicateComponentFunc, DuplicateComponentProc, DuplicateComponentNoAutoInspectProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `MeshSubdivideWithCenter` | `Application\DSScripts\operators.vbs` | `MeshSubdivideWithCenterProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `DuplicateUsingGeomApprox` | `Application\DSScripts\operators.vbs` | `DuplicateUsingGeomApprox` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `TrimWith` | `Application\DSScripts\operators.vbs` | `TrimWithProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `Convert` | `Application\DSScripts\operators.vbs` | `Convert` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `CreateClusterCenter` | `Application\DSScripts\operators.vbs` | `CreateClusterCenterProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `CreateClusterCenterWithNull` | `Application\DSScripts\operators.vbs` | `CreateClusterCenterWithNullProc, CreateClusterCenterWithNullFunc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `CreateNonOverlappingCluster` | `Application\DSScripts\operators.vbs` | `CreateNonOverlappingClusterProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `CreateSimulationBracket` | `Application\DSScripts\operators.vbs` | `CreateSimulationBracketProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `ApplyDeformBySpine` | `Application\DSScripts\operators.vbs` | `ApplyDeformBySpineProc, ApplyDeformBySpineFunc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `ApplySpringOp` | `Application\DSScripts\operators.vbs` | `ApplySpringOpProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `InspectSpringPropertiesProc` | `Application\DSScripts\operators.vbs` | `InspectSpringPropertiesProc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `BurnAndDeleteGATOROperator` | `Application\DSScripts\operators.vbs` | `BurnAndDeleteGATOROperator` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `ChangeVertexColorDatatype` | `Application\DSScripts\operators.vbs` | `ChangeVertexColorDatatypeFunc` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `SetSymmetrizePolygonOpRefPlane` | `Application\DSScripts\operators.vbs` | `SetSymmetrizePolygonOpRefPlane` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `SetRefPlaneFromSymmetrizePolygonOp` | `Application\DSScripts\operators.vbs` | `SetRefPlaneFromSymmetrizePolygonOp` | CMD-B6d | [cmd-b6d-operators-scripts.md](../ghidra/cmd-b6d-operators-scripts.md) | SPEC |
| `CopyAllAnimation2` | `Application\DSScripts\duplicate.vbs` | `CopyAllAnimationProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `RemoveAllAnimation` | `Application\DSScripts\duplicate.vbs` | `RemoveAllAnimationProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `DuplicateFromAnim` | `Application\DSScripts\duplicate.vbs` | `DuplicateFromAnimProc, GetInputAndDuplicateFromAnimProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `SaveKeyAtMultipleFrames` | `Application\DSScripts\duplicate.vbs` | `SaveKeyAtMultipleFramesProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `CreateEmptyPartition` | `Application\DSScripts\Rendering.vbs` | `CreateEmptyPartitionProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `SICreatePartition` | `Application\DSScripts\Rendering.vbs` | `SICreatePartitionProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `CreatePassWithPartition` | `Application\DSScripts\Rendering.vbs` | `CreatePassWithPartitionProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `GetPass` | `Application\DSScripts\Rendering.vbs` | `GetMorePassesProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ConnectImageTo3DO` | `Application\DSScripts\Rendering.vbs` | `ConnectImageTo3DO` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ShowNextOGLProjection` | `Application\DSScripts\Rendering.vbs` | `ShowNextOGLProjection` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ShowPreviousOGLProjection` | `Application\DSScripts\Rendering.vbs` | `ShowPreviousOGLProjection` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `CreateCGFX` | `Application\DSScripts\Rendering.vbs` | `CreateCGFXProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `CreateFX` | `Application\DSScripts\Rendering.vbs` | `CreateFXProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `LaunchFlipbookForPass` | `Application\DSScripts\Rendering.vbs` | `LaunchFlipbookOnInspectedPassesProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ExportMI2File` | `Application\DSScripts\Rendering.vbs` | `ExportMI2FileProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ExportAllPassesToMI2` | `Application\DSScripts\Rendering.vbs` | `ExportAllPassesToMI2Proc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC-PARTIAL |
| `EditShaderCompoundPPGLogic` | `Application\DSScripts\Rendering.vbs` | `EditShaderCompoundPPGLogic` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `StoreEnvironmentCacheToMixer` | `Application\DSScripts\simulation.vbs` | `StoreEnvironmentCacheToMixerProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `StoreEnvironmentCachesToMixer` | `Application\DSScripts\simulation.vbs` | `StoreEnvironmentCachesToMixerProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `MergeSimulationEnvironments` | `Application\DSScripts\simulation.vbs` | `MergeSimulationEnvironmentsProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `ChangeEnvironmentDynamicsOperator` | `Application\DSScripts\simulation.vbs` | `ChangeEnvironmentDynamicsOperatorProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `CacheObjectsIntoFileDialog` | `Application\DSScripts\simulation.vbs` | `CacheObjectsIntoFileDialogProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `EditICECompoundPPGLogic` | `Application\DSScripts\simulation.vbs` | `EditICECompoundPPGLogicProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `FindPeriods` | `Application\DSScripts\action.vbs` | `GetInputAndFindPeriodsProc` | CMD-B6e | [cmd-b6e-duplicate-rendering-simulation-scripts.md](../ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md) | SPEC |
| `SetThumbnail` | `Application\bin\siuitasks.dll` | create `0x180005070`, Do `0x18000a510` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SetThumbnailFromRegion` | `Application\bin\siuitasks.dll` | create `0x180005030`, Do `0x1800098e0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `ClearThumbnail` | `Application\bin\siuitasks.dll` | create `0x180004eb0`, Do `0x180008b10` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `SetParameterColor` | `Application\bin\siuitasks.dll` | create `0x180004ff0`, Do `0x18000b760` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `ClearParameterColor` | `Application\bin\siuitasks.dll` | create `0x180004e70`, Do `0x18000b0b0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `SetUserKeyword` | `Application\bin\siuitasks.dll` | create `0x1800050b0`, Do `0x18000e570` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `SetUserTab` | `Application\bin\siuitasks.dll` | create `0x1800050b0`, Do `0x18000e570` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `GetUserKeyword` | `Application\bin\siuitasks.dll` | create `0x180004f70`, Do `0x18000d1d0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `GetUserTab` | `Application\bin\siuitasks.dll` | create `0x180004f70`, Do `0x18000d1d0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `ClearUserKeyword` | `Application\bin\siuitasks.dll` | create `0x180004ef0`, Do `0x18000c710` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `ClearUserTab` | `Application\bin\siuitasks.dll` | create `0x180004ef0`, Do `0x18000c710` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `RemoveUserKeyword` | `Application\bin\siuitasks.dll` | create `0x180004fb0`, Do `0x18000d830` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `RemoveUserTab` | `Application\bin\siuitasks.dll` | create `0x180004fb0`, Do `0x18000d830` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `AssignObjectGroup` | `Application\bin\grouptask.dll` | create `0x18000b4a0`, Do `0x180004ee0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SetParTypeInstanceGroup` | `Application\bin\grouptask.dll` | create `0x18000b4a0`, Do `0x180004ee0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `UnassignObjectGroup` | `Application\bin\grouptask.dll` | create `0x18000b5a0`, Do `0x18000a820` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `RemoveParTypeInstanceGroup` | `Application\bin\grouptask.dll` | create `0x18000b5a0`, Do `0x18000a820` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `OpenAttachments` | `Application\bin\siviewtasks.dll` | create `0x180006430`, Do `0x180002e00` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `OpenTransientExplorer` | `Application\bin\siviewtasks.dll` | create `0x180006470`, Do `0x1800047f0` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `OpenXSIExplorer` | `Application\bin\siviewtasks.dll` | create `0x1800064b0`, Do `0x180005540` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC |
| `ClusterNonOverlapEnforcement` | `Application\bin\siclustertasks.dll` | create `0x180010a60`, Do `0x18000ae60` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SITogglePolygonVisibility` | `Application\bin\siclustertasks.dll` | create `0x180010b20`, Do `0x18000f310` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SetActiveElements` | `Application\bin\selectionmgr.dll` | create `0x180005990`, Do `0x180017160` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SetAndToggleActiveElements` | `Application\bin\selectionmgr.dll` | create `0x180005a20`, Do `0x180012110` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `ActivateElements` | `Application\bin\selectionmgr.dll` | create `0x180005530`, Do `0x180012110` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `DeactivateElements` | `Application\bin\selectionmgr.dll` | create `0x180005810`, Do `0x180017020` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `ToggleActiveElements` | `Application\bin\selectionmgr.dll` | create `0x1800056e0`, Do `0x180012110` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `ActivateSampledPointSelTool` | `Application\bin\selectionmgr.dll` | create `0x180005660`, Do `0x18000e260` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `ActivateSampledPointSelToolWithNoObjStateChange` | `Application\bin\selectionmgr.dll` | create `0x180005660`, Do `0x18000e260` | CMD-B7a | [cmd-b7a-uitasks-group-view-binary.md](../ghidra/cmd-b7a-uitasks-group-view-binary.md) | SPEC-PARTIAL |
| `SyGetCollidePnts` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetClothPoints_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetCollidePolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetMimic` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetNail` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetPin` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetPin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetSelfCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetSelfPolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyPinGetMesh` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `GetPinMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetCollidePnts` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetClothPoints_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetCollidePolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetMimic` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetNail` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetPin` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetPin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetSelfCollidePols` | `Addons\Syflex30X50\Application\Plugins\getset.vbs` | `SetSelfPolys_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyClearAllCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `ClearAllCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyClearCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `ClearCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCloth` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateCloth_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateFlesh` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateFlesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateSkin` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `CreateSkin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetMassMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetMassMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyGetSpringMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetSpringMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetMassMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SetMassMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetSpringMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SetSpringMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `sySaveCache` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `SaveCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateAir` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddAir_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateDamp` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddDamp_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateGravity` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddGravity_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateSpring` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `CreateSpring_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateTurbulence` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddTurbulence_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateVolume` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddVolume_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateWind` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `AddWind_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateZipper` | `Addons\Syflex30X50\Application\Plugins\force.vbs` | `CreateZipper_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCollideGetMesh` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `GetCollideMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCollideMesh` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollideMesh_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateCollidePla` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollidePla_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
| `SyCreateCollideSph` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `CollideSph_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
| `SyCreateSelfCollide` | `Addons\Syflex30X50\Application\Plugins\collid.vbs` | `SelfCollide_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateMimic` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreateMimic_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreateNail` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreateNail_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCreatePin` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `CreatePin_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SySetConstraintMap` | `Addons\Syflex30X50\Application\Plugins\constr.vbs` | `SetConstraintMap_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCachePaint1` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap1_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCachePaint2` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap2_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syCreateCache` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `CreateCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syClearState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `ResetState_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `syClearVelocityState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `ResetVelocities_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `sySetState` | `Addons\Syflex30X50\Application\Plugins\state.vbs` | `SetState_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC |
| `SyCmdSaveCache` | `Addons\Syflex30X50\Application\Plugins\syCmd.64.dll` | `CmdSaveCache_Execute` | CMD-B7b | [cmd-b7b-syflex-scripts.md](../ghidra/cmd-b7b-syflex-scripts.md) | SPEC-PARTIAL |
| `AddToList` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `AddToList_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetItemsAsString` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `GetItemsAsString_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetObjectsFromSource` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `GetObjectsFromSource_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ReadCachesFile` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `ReadCachesFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RefreshCachesPathProp` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RefreshCachesPathProp_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RemoveFromList` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RemoveFromList_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RemoveNumbering` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `RemoveNumbering_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SelectionValueToItemName` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `SelectionValueToItemName_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `UpdateCacheManager` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `UpdateCacheManager_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `WriteCachesFile` | `Addons\CacheManager\Application\Plugins\CacheManager.js` | `WriteCachesFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetCacheOnFile` | `Addons\CacheManager\Application\Plugins\CacheManagerVBS.vbs` | `GetCacheOnFile_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `OpenOutputFormatPreferences` | `Addons\RenderManager\Application\Plugins\RenderManager.vbs` | `OpenOutputFormatPreferences_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `OverrideMarkedPassParameters` | `Addons\RenderManager\Application\Plugins\RenderManager.vbs` | `OverrideMarkedPassParameters_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `DeleteUnusedShaders` | `Addons\RTUserTools\Application\Plugins\RTUserTools.js` | `DeleteUnusedShaders_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `RTShaderSetCategories` | `Addons\RTUserTools\Application\Plugins\RTShaderCategories.js` | `RTShaderSetCategories_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaDisplayType` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaDisplayType_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaEmitMPVolume` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaEmitMPVolume_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaTagCollisionObject` | `Addons\Lagoa\Application\Plugins\Lagoa_Commands.js` | `LagoaTagCollisionObject_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaSetupAdvectMesh` | `Addons\ICEFlowBuilder\Application\Plugins\ICEfxBuilder.vbs` | `LagoaSetupAdvectMesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `LagoaSetupClothMesh` | `Addons\ICEFlowBuilder\Application\Plugins\ICEfxBuilder.vbs` | `LagoaSetupClothMesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ICEFlowInsertSimulationRoot` | `Addons\ICEFlowBuilder\Application\Plugins\ICEFlowInsertSimulationRoot.vbs` | `ICEFlowInsertSimulationRoot_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SIGetExternalFilesViewerProp` | `Addons\sdkui\Application\Plugins\ExternalFileListViewer.js` | `SIGetExternalFilesViewerProp_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SISetExternalFilesManagerTarget` | `Addons\sdkui\Application\Plugins\ExternalFileListViewer.js` | `SISetExternalFilesManagerTarget_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `ConnectToWorkgroupUI` | `Addons\sdkui\Application\Plugins\PluginTreeActions.js` | `ConnectToWorkgroupUI_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `GetShaderDefHelper` | `Addons\sdkui\Application\Plugins\ShaderDefHelper.js` | `GetShaderDefHelper_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC-PARTIAL |
| `GetWizardParamTab` | `Addons\sdkui\Application\Plugins\WizardParamTab.js` | `GetWizardParamTab_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC-PARTIAL |
| `PPGLayoutControl` | `Addons\sdkui\Application\Plugins\PPGLayoutControl.js` | `PPGLayoutControl_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `SDKGetScriptGenerator` | `Addons\sdkui\Application\Plugins\SDKScriptGenerator.js` | `SDKGetScriptGenerator_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |
| `Create_Polygonizer_Polymesh` | `Addons\Polygonizer\Application\Plugins\Create_Polygonizer_PolymeshPlugin.vbs` | `Create_Polygonizer_Polymesh_Execute` | CMD-B7c | [cmd-b7c-addon-scripts.md](../ghidra/cmd-b7c-addon-scripts.md) | SPEC |

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
- customcommands.dll sha256 ff7a2aea29aa… | single export `XSIOnCommand` 0x180010d60 (dispatch by command display name: "OBJ Export function", "Obj Import function", ...); OBJ export worker 0x180002590 (`SIObjExport`), OBJ import worker 0x180008df0 (`ObjImport`), `TrackRig` worker 0x180017280. Contracts not read yet (CMD-01-OBJ-BIN)
- Bin-wide string scan, 2026-11-17 (200 binaries of `Application\bin` staged and scanned for ASCII and UTF-16 strings): of 932 built-in C++ scripting names only 86 occur anywhere, and those are callers, not registrations (for example `SIConnectShaderToCnxPoint` only in `dotxsi_ie.dll`, which calls it). Task ProgID strings (`SI.3D.*Task`) exist only in `shadertasks.dll` (34), `propertytasks.dll` (9), `primtasks.dll` (3), `tasks.dll` (2). Built-in commands are therefore bound by CLSID outside the binaries (ledger row CMD-REGISTRY); a name search cannot build this map for them
- Tool commands whose names occur only in `viewinteraction.dll` (tool registration by name, starting point): `CursorTransformTool`, `DirectManipTool`, `TimeSliderTool`, `VirtualSliderTool` (still TODO), and the already-named `AddVertexTool`, `BezierCurveTool`, `LinearCurveTool`, `MovePointTool`, `PaintVertexColorTool`, `ProbeMaterialTool`, `PropTransformTool`, `RotationTool`, `ScalingTool`, `SketchCurveTool`, `SplitEdgeTool`, `TranslateTool`, `TweakNormalsTool`, `TweakTool`, `WeldPointTool`

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

## Registry-derived index (generated)

Generated by `tools/parse_dscommandmap.py` from `Application\CommandMaps\XSI.DSCommandMap` (see [cmd-registry-dscommandmap.md](../ghidra/cmd-registry-dscommandmap.md)); data in `data/command_registry.json`. One row per registry command not listed above. Script commands: script file and procedure as registered. Native commands: DLLs under the install that contain the handler CLSID bytes (one DLL = the implementing DLL; several = candidates, implementer first by heuristic, *inferred*); the handler is the COM class with that CLSID (find it through `DllGetClassObject`, see CMD-B7a). No contract yet for these rows.

<!-- BEGIN GENERATED: registry -->
| Command | Implemented in | Handler |
|---------|----------------|---------|
| `CrashXSI` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `DumpMemoryStats` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `GetUnevaluatedPrimitiveForConstructionHistory` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `IsSoftimageDevDrop` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `System` | `tasks.dll` | CLSID `{a121de74-7132-11d3-8d44-00609419fcaf}` |
| `InspectObj` | `uixsiscripts.vbs` (VBScript) | `InspectObjProc` |
| `SetValue` | (CLSID not specific to one binary) | CLSID `{c089b901-8481-11d2-b118-00a024c79287}` |
| `GetValue` | `tasks.dll` | CLSID `{32455721-e6bc-11d2-ac79-00a02485cecb}` |
| `SetReference` | `tasks.dll` | CLSID `{bdc2d423-8da5-11d4-aefd-0090275ae282}` |
| `SetReference2` | `shadertasks.dll`, `tasks.dll`, `shaderhelper.dll`, `sicoresdk.dll` | CLSID `{de9980e7-3d8e-41fd-9fea-ed65f79a6d62}` |
| `AutoInspect` | `uixsiscripts.vbs` (VBScript) | `AutoInspectProc` |
| `AutoInspectEnabled` | `uixsiscripts.vbs` (VBScript) | `FAutoInspectEnabled` |
| `InspectEnvelopeWeights` | `uixsiscripts.vbs` (VBScript) | `InspectEnvelopeWeightsProc` |
| `InspectBrowse` | `tasks.dll` | CLSID `{e33918d2-8d40-11d3-b4a4-00a02485cecb}` |
| `SetUserPref` | `tasks.dll` | CLSID `{6f80466d-06f2-11d3-80d5-00a0c9ac19a9}` |
| `GetUserPref` | `tasks.dll` | CLSID `{ef512ce5-07d8-11d3-80d6-00a0c9ac19a9}` |
| `SetDefaultKeyMap` | `tasks.dll` | CLSID `{42769051-e0a2-436e-92c3-8c96f1a94c95}` |
| `GetKeyboardState` | `tasks.dll` | CLSID `{e641d1ef-0ecf-11d3-80dd-00a0c9ac19a9}` |
| `GetBBox` | `tasks.dll` | CLSID `{3329ba54-fe3c-11d2-bc28-00a0c9612b97}` |
| `SIMatchSubComponent` | `tasks.dll` | CLSID `{04791ffa-bfa7-11d2-80ae-00a0c955b335}` |
| `SIFilter` | `tasks.dll`, `corehelper.dll`, `mohelper.dll` | CLSID `{bb18b93e-b9f6-11d2-80ad-00a0c955b335}` |
| `Parent Tool` | `tasks.dll`, `mcp.dll` | CLSID `{90e7affb-c38b-11d2-ac73-00a02485cecb}` |
| `Delete Selected` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `DeleteObj` | `uixsiscripts.vbs` (VBScript) | `DeleteObjProc` |
| `DeleteObjPermanent` | `uixsiscripts.vbs` (VBScript) | `DeleteNoUndoProc` |
| `CutObj` | `tasks.dll`, `scnmgr.dll`, `sicoresdk.dll` | CLSID `{eefc85f1-c81a-11d2-ac73-00a02485cecb}` |
| `ParentObj` | `modeltasks.dll`, `primtasks.dll`, `tasks.dll`, `scnmgr.dll`, `sicoresdk.dll`, `uiut.dll` … | CLSID `{90e7afe3-c38b-11d2-ac73-00a02485cecb}` |
| `CreateTransformGroup` | `uixsiscripts.vbs` (VBScript) | `FCreateTransformGroup` |
| `RemoveTransformGroup` | `uixsiscripts.vbs` (VBScript) | `FRemoveTransformGroup` |
| `ParentObjects` | `uixsiscripts.vbs` (VBScript) | `ParentObjectsProc` |
| `TagForDelete` | `tasks.dll` | CLSID `{ec7663e7-2f0b-11d3-bffd-00a0248f9397}` |
| `FreezeObj` | `optasks.dll`, `propertytasks.dll`, `sicurvetasks.dll`, `tasks.dll`, `action.dll`, `corehelper.dll` … | CLSID `{761b65c4-2f0a-11d3-9196-00a0243e34c4}` |
| `FreezeModeling` | `uixsiscripts.vbs` (VBScript) | `FreezeModelingProc` |
| `CollapseOp` | `tasks.dll` | CLSID `{46ff1dac-9ec0-40f5-a19b-f5ac46846da4}` |
| `InspectLastOperator` | `tasks.dll` | CLSID `{ee0d5df0-58e0-11d4-bc9c-00d0b719022b}` |
| `Freeze Selected` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `Delete Selected Branch` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `DeleteMotionDerivator` | `optasks.dll` | CLSID `{38b25a31-26da-11d4-8bd6-009027bc381b}` |
| `DeleteAll` | `tasks.dll` | CLSID `{6e4d3de5-5ad1-48fa-9811-49f8be59a576}` |
| `Duplicate` | `duplicate.vbs` (VBScript) | `DuplicateProc` |
| `SISaveDuplicateXformForUndo` | `tasks.dll` | CLSID `{d6d73e5d-d6ea-47e1-83c0-051ce5230f99}` |
| `Clone` | `duplicate.vbs` (VBScript) | `CloneProc` |
| `SIDuplicate` | (CLSID not specific to one binary) | CLSID `{747d257f-d01b-11d2-80c4-00a0c9ac19a9}` |
| `DuplicateSymmetry` | `duplicate.vbs` (VBScript) | `DuplicateSymmetryFunc` |
| `Duplicate/Extrude Single` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Duplicate/Extrude Multiple` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Instance` | `duplicate.vbs` (VBScript) | `OldInstanceToCloneProc` |
| `SIGetPreset` | `tasks.dll` | CLSID `{393c6ad2-e6b4-11d2-a02c-0000f875df68}` |
| `PickPosition` | `tasks.dll` | CLSID `{525195c8-0fbf-11d3-bc2f-00a0c9612b97}` |
| `EnumElements` | `tasks.dll` | CLSID `{6d34bf79-18fc-11d3-bc37-00a0c9612b97}` |
| `FilterPSet` | `tasks.dll` | CLSID `{5aa63e2d-1f52-11d3-80e6-00a0c9ac19a9}` |
| `SavePreset` | `tasks.dll`, `action.dll`, `sipluginhosts.dll`, `sicoresdk.dll` | CLSID `{ec19ceb7-b236-11d3-8d7b-00609419fcaf}` |
| `SILoadPreset` | `tasks.dll`, `chanmgr.dll` | CLSID `{d93084b1-5587-11d3-801f-00a0248f9397}` |
| `CreatePreset` | `tasks.dll`, `sicoresdk.dll` | CLSID `{d90e0a30-b0df-11d3-ae58-00a0c96e63e1}` |
| `CreateObjectFromPreset` | `tasks.dll` | CLSID `{24221da9-7761-11d3-80f8-00a0c9ac19a9}` |
| `FindObjects` | `tasks.dll`, `sicoresdk.dll` | CLSID `{2b24aba0-b7f6-11d3-ae58-00a0c96e63e1}` |
| `Add3DObjectToScene` | `modeltasks.dll`, `primtasks.dll`, `tasks.dll`, `_3dobject2.dll`, `scnmgr.dll`, `sicoresdk.dll` | CLSID `{a0d59008-3e15-11d3-8bac-00a024ee586f}` |
| `CreateFolder` | `tasks.dll`, `ut.dll` | CLSID `{c0cd68b0-2832-11d4-b6a3-006094eb029c}` |
| `CreateEnvironment` | `tasks.dll`, `corehelper.dll`, `environments.dll` | CLSID `{98531be5-b33d-46fa-80d4-41d795584ad5}` |
| `SetCurrentEnvironment` | `environments.dll` | CLSID `{9b4cc51c-20c2-4d0d-9c7c-abdd509b55ca}` |
| `AddContainerToEnvironment` | `tasks.dll`, `environments.dll` | CLSID `{6eed640c-73b9-4b7b-86c3-ae582eebf9cb}` |
| `CreateEnvironmentCache` | `corehelper.dll`, `environments.dll`, `simulationop.dll` | CLSID `{3d2a7149-320c-49a4-9625-8d61bda0c60c}` |
| `SIStoreEnvironmentCacheToMixer` | `environments.dll` | CLSID `{8ffda6cb-588f-419f-afac-31070af56815}` |
| `MoveToFolder` | `tasks.dll` | CLSID `{a907fa52-2cb9-11d4-b6a3-006094eb029c}` |
| `RemoveFromFolder` | `tasks.dll` | CLSID `{2c1c6594-2dba-11d4-b6a4-006094eb029c}` |
| `RemoveFolder` | `tasks.dll` | CLSID `{de5fd1e2-2dc3-11d4-b6a4-006094eb029c}` |
| `SICreateRefPlane` | `tasks.dll` | CLSID `{b85255a9-1c5a-11d4-b7e9-0008c7a011a6}` |
| `SetCurrentReferencePlane` | `tasks.dll`, `viewinteraction.dll` | CLSID `{2f76bc8f-f028-11d2-ac7c-00a02485cecb}` |
| `SetReferencePlane` | `tasks.dll`, `viewinteraction.dll` | CLSID `{9860fe78-9aa3-4a4a-b764-5d52578b4f36}` |
| `SIInstantiate` | `primtasks.dll` | CLSID `{177b5057-fb54-45cf-afac-60fdfb0c58b4}` |
| `Instantiate` | `duplicate.vbs` (VBScript) | `InstanceProc` |
| `GetMaster` | `primtasks.dll` | CLSID `{c536b66e-0c88-4b9d-9eff-34d04d60bd66}` |
| `GetInstances` | `primtasks.dll`, `imageclip.dll` | CLSID `{48492eb6-da48-406e-bcea-d1f8e0efc92b}` |
| `CopyStyle` | (CLSID not specific to one binary) | CLSID `{3f4aac42-27d6-11d6-9e5b-0000e22bd0d9}` |
| `SetInstanceGroup` | `grouptask.dll` | CLSID `{e0717f47-0ac4-4faa-b35a-7c56951e6ddf}` |
| `RemoveInstanceGroup` | `grouptask.dll` | CLSID `{d534de9f-55e4-41c2-a5ca-2cfbe354d3e6}` |
| `SceneRefresh` | `tasks.dll` | CLSID `{2168f0b6-0d40-11d7-be20-00a0c9615daf}` |
| `SIGetHelpPath` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `BeginUndo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `EndUndo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Undo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Undo (alternate)` | `uixsiscripts.vbs` (VBScript) | `UndoProc` |
| `Redo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Redo (alternate)` | `uixsiscripts.vbs` (VBScript) | `RedoProc` |
| `GetExternalReferences` | `tasks.dll` | CLSID `{687fafb2-ad49-4b97-8f5d-e3faca1e42db}` |
| `InspectExternalReference` | `tasks.dll` | CLSID `{e5b3bcb8-af83-4e7b-b288-854226695785}` |
| `UpdateExternalReference` | `tasks.dll` | CLSID `{a3e3dfe1-c2bc-46d7-8977-271f04fcd1ac}` |
| `ReorderSceneItem` | `tasks.dll`, `schematicview.dll` | CLSID `{495b9325-f3f1-4fdb-8a61-9f8aeb30dcce}` |
| `ImportCustomFile` | `tasks.dll` | CLSID `{8c51ca84-fe5f-46f3-b6ec-69db89dd3d78}` |
| `ExportCustomFile` | `tasks.dll` | CLSID `{d8e1ecec-d9d0-45e8-a074-be3f73c4bc01}` |
| `ICEOfflineRefresh` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `SelectObj` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `SelectNeighborObj` | `selection.vbs` (VBScript) | `SelectNeighborObj` |
| `SelectGeometryComponents` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `AddToSelection` | `tasks.dll`, `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{38eddd00-d255-11d2-8bcf-00aa006130ef}` |
| `RemoveFromSelection` | `tasks.dll`, `selectionmgr.dll`, `actioncore.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{38eddd02-d255-11d2-8bcf-00aa006130ef}` |
| `SetAndToggleSelection` | `selectionmgr.dll` | CLSID `{1d11f9b0-a9a7-11d2-8bc6-00aa006130ef}` |
| `ToggleSelection` | `selectionmgr.dll`, `viewinteraction.dll` | CLSID `{1d11f9b2-a9a7-11d2-8bc6-00aa006130ef}` |
| `DeselectAll` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `SelectAll` | `selectionmgr.dll` | CLSID `{8629cad0-9460-11d2-8bbb-00aa00135f7b}` |
| `InvertSelection` | `selectionmgr.dll` | CLSID `{6afca7d1-0488-11d3-b89e-080036f3cc02}` |
| `GetNeighborSubcomponents` | `Selection.vbs` (VBScript) | `GetNeighborsFunc` |
| `SelectAdjacent` | `selection.vbs` (VBScript) | `SelectAdjacentProc` |
| `ConvertSelection` | `selection.vbs` (VBScript) | `ConvertSelectionProc` |
| `ConvertSelectionToPoints` | `selection.vbs` (VBScript) | `ConvertSelectionProc` |
| `ConvertSelectionToEdges` | `selection.vbs` (VBScript) | `ConvertSelectionProc` |
| `ConvertSelectionToPolygons` | `selection.vbs` (VBScript) | `ConvertSelectionProc` |
| `ShrinkSelection` | `selection.vbs` (VBScript) | `ShrinkSelectionProc` |
| `GrowSelection` | `selection.vbs` (VBScript) | `GrowSelectionProc` |
| `SelectAllUsingFilter` | `selectionmgr.dll` | CLSID `{8629cad0-9460-11d2-8bbb-00aa00135f7b}` |
| `SelectBranch` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `SelectTree` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `SelectChain` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `SelectModel` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
| `DeselectAllUsingFilter` | `tasks.dll`, `selectionmgr.dll`, `pickmgr.dll` | CLSID `{16532fa0-0c74-11d3-b8a0-080036f3cc02}` |
| `SelectChildNodes` | `selectionmgr.dll` | CLSID `{8629cad0-9460-11d2-8bbb-00aa00135f7b}` |
| `SelectMembers` | `selectionmgr.dll` | CLSID `{9ab38d10-0e0b-11d3-b8a0-080036f3cc02}` |
| `SelectObjectFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `SelectVertexFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `SelectPolygonFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `SelectEdgeFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `SelectSampledPointFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `SelectFilter` | `selectionmgr.dll`, `pickmgr.dll`, `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{91d68770-dbe9-11d2-8bcf-00aa006130ef}` |
| `ToggleObjectComponentSelectionFilter` | `uixsiscripts.vbs` (VBScript) | `ToggleObjectComponentSelectionFilterProc` |
| `SetPointSelectionFilter` | `uixsiscripts.vbs` (VBScript) | `SetPointSelectionFilterProc` |
| `SetEdgeSelectionFilter` | `uixsiscripts.vbs` (VBScript) | `SetEdgeSelectionFilterProc` |
| `SetPolygonSelectionFilter` | `uixsiscripts.vbs` (VBScript) | `SetPolygonSelectionFilterProc` |
| `SetSampleSelectionFilter` | `uixsiscripts.vbs` (VBScript) | `SetSampleSelectionFilterProc` |
| `SelectAllComponentLoops` | `tasks.dll` | CLSID `{14ba7973-1452-4f83-bedb-d87c9c045c29}` |
| `GrowSelectedLoops` | `tasks.dll` | CLSID `{79a24a0c-d64f-4ead-acda-d6d98178596c}` |
| `ShrinkSelectedLoops` | `tasks.dll` | CLSID `{2ab971bf-a7db-495d-9a3d-8973a2fb51fe}` |
| `SelectPolygonOutline` | `tasks.dll` | CLSID `{9b13ed79-f264-46ef-9982-4b025b238d02}` |
| `SelectAllConnectedComponents` | `tasks.dll` | CLSID `{35ced1f5-b9da-43d5-af12-17de288ca1db}` |
| `Cycle Selection Mode` | `uixsiscripts.vbs` (VBScript) | `CycleSelectionModeProc` |
| `PickElement` | `tasks.dll` | CLSID `{5c87875c-0a31-11d3-bc2d-00a0c9612b97}` |
| `PickObject` | `tasks.dll` | CLSID `{5c87875c-0a31-11d3-bc2d-00a0c9612b97}` |
| `InfoSelection` | `uixsiscripts.vbs` (VBScript) | `InfoSelectionProc` |
| `InfoScene` | `uixsiscripts.vbs` (VBScript) | `InfoSceneProc` |
| `NavigateNode` | `tasks.dll`, `expressions.dll` | CLSID `{74debd17-439a-11d4-b49e-00d0b71903e4}` |
| `ToggleParameterValue` | `uixsiscripts.vbs` (VBScript) | `ToggleParameterValueProc` |
| `ToggleSelectability` | `uixsiscripts.vbs` (VBScript) | `ToggleParameterValueProc` |
| `MakeAllUnselectable` | `selection.vbs` (VBScript) | `MakeAllSelectableProc` |
| `SelectEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendEdgeLoopProc` |
| `SelectBoundaryEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendBoundaryEdgeLoopProc` |
| `SelectParallelEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendParallelEdgeLoopProc` |
| `SelectNSidedPolygons` | `selection.vbs` (VBScript) | `SelectNSidedPolygonProc` |
| `GenerateInfoReport` | `tasks.dll` | CLSID `{bf217ee1-695a-4def-8fa3-98e4c6e01ce8}` |
| `GetSize` | `tasks.dll` | CLSID `{af3e86ea-eb7c-490c-a557-8462c690f428}` |
| `Translate` | `transformmanager.dll` | CLSID `{b2f1ad2e-83bd-11d2-91cf-00a0c9612e3a}` |
| `Rotate` | `transformmanager.dll` | CLSID `{b2f1ad2d-83bd-11d2-91cf-00a0c9612e3a}` |
| `Scale` | `transformmanager.dll` | CLSID `{b2f1ad2c-83bd-11d2-91cf-00a0c9612e3a}` |
| `ResetTransform` | `transformmanager.dll` | CLSID `{bf88c89d-8e18-11d2-91d3-00a0c9612e3a}` |
| `Turn ON Interactive SRT` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `Turn OFF Interactive SRT` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `XYZ Transform ` | `toolmanager.dll` | CLSID `{0461b2c7-0ae3-11d2-8065-00a0c955b335}` |
| `Transform Set New ` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `TranslateUVW` | `transformmanager.dll` | CLSID `{b2f1ad2e-83bd-11d2-91cf-00a0c9612e3a}` |
| `RotateUVW` | `transformmanager.dll` | CLSID `{b2f1ad2d-83bd-11d2-91cf-00a0c9612e3a}` |
| `ScaleUVW` | `transformmanager.dll` | CLSID `{b2f1ad2c-83bd-11d2-91cf-00a0c9612e3a}` |
| `Toggle Snapping` | `transformmanager.dll` | CLSID `{e60d5ac3-ed4f-454d-a1ef-6c82c7276ca6}` |
| `Toggle Point Snap` | `transformmanager.dll` | CLSID `{95c4c0ea-1b0e-42dd-a971-81bcbdd0e9fc}` |
| `Toggle Grid Snap` | `transformmanager.dll` | CLSID `{b01473fe-af48-4646-949b-f289be7da553}` |
| `Toggle Curve Snap` | `transformmanager.dll` | CLSID `{a8924726-2a79-4457-a495-64c5e5ca3849}` |
| `Toggle Proportional` | `transformmanager.dll` | CLSID `{03a88ea8-2ddc-476e-9f19-8c3124b626cd}` |
| `SetNeutralPose` | `tasks.dll` | CLSID `{651b8bdb-a324-4be5-a63a-a849c8ed35c3}` |
| `TranslatePivot` | `tasks.dll`, `viewinteraction.dll` | CLSID `{8eee27b3-a9e4-4987-a355-92f0665be870}` |
| `SaveKeyOnPath` | `pathanimtask.dll`, `kinecns.dll` | CLSID `{aef278f7-e088-11d2-977c-00a0243e3463}` |
| `ApplyCns` | `uixsiscripts.vbs` (VBScript) | `ApplyTrajectoryProc` |
| `ConvertPosAnimToPath` | `uixsiscripts.vbs` (VBScript) | `ConvertPosAnimToPathProc` |
| `PathRetime` | `uixsiscripts.vbs` (VBScript) | `PathRetimeProc` |
| `SICreateCurve` | `pathanimtask.dll`, `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{8f351a3d-edf2-11d2-9224-00a0c9612e3a}` |
| `SISetCurvePoints` | `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{1808e581-f9b7-11d2-9244-00aa0068bf56}` |
| `SIAddPointOnCurve` | `pathanimtask.dll`, `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{cfb524a3-eeb9-11d2-9224-00a0c9612e3a}` |
| `SIAddPointOnCurveAtStart` | `pathanimtask.dll`, `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{d62480c3-eddd-11d2-9222-00a0c9612e3a}` |
| `SIAddPointOnCurveAtEnd` | `pathanimtask.dll`, `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{cfb524a4-eeb9-11d2-9224-00a0c9612e3a}` |
| `GetCurveLength` | `tasks.dll` | CLSID `{c1e68290-0d3a-11d3-bc2e-00a0c9612b97}` |
| `EvaluateCurveAt` | `tasks.dll` | CLSID `{c54341b9-0d52-11d3-bc2e-00a0c9612b97}` |
| `GetNumberOfKnots` | `tasks.dll` | CLSID `{656fc3b1-7c05-11d3-97b9-00a0243e3463}` |
| `GetCurvePercentageAtKnotIndex` | `tasks.dll` | CLSID `{656fc3b2-7c05-11d3-97b9-00a0243e3463}` |
| `SIDeletePointOnCurve` | `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{be413b72-cd20-11d3-a9ba-009027bc65d7}` |
| `AddProp` | `uixsiscripts.vbs` (VBScript) | `AddPropProc` |
| `CreateWeightMap` | `uixsiscripts.vbs` (VBScript) | `CreateWeightMap` |
| `CreateVertexColorSupport` | `gap.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{ab483760-38c0-11d4-b8ff-0800690c8bd0}` |
| `PaintVertexColors` | `gap.dll`, `mentalray.dll` | CLSID `{17007160-416e-11d4-b902-0800690c8bd0}` |
| `PaintWeights` | `optasks.dll`, `gap.dll`, `sicoresdk.dll` | CLSID `{73c34ae0-9d75-11d4-b918-0800690c8bd0}` |
| `SIMakeLocal` | `optasks.dll`, `propertytasks.dll` | CLSID `{2975a557-2276-11d3-80e6-00a0c9ac19a9}` |
| `MakeLocal` | `uixsiscripts.vbs` (VBScript) | `MakeLocalFunc` |
| `RemoveAllProperties` | `uixsiscripts.vbs` (VBScript) | `RemoveAllPropertiesProc` |
| `RemoveProperties` | `uixsiscripts.vbs` (VBScript) | `RemovePropertiesProc` |
| `RemoveCustomParam` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{bbee42c4-2fe7-11d3-a617-00a0c9ec5ef7}` |
| `SIAddCustomParam` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{1d4d499c-d0c4-11d2-a5fa-00a0c9ec5ef7}` |
| `EditParameterDefinition` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{d56b12d2-699a-11d4-a657-00a0c9ec5ef7}` |
| `SIAddProp` | (CLSID not specific to one binary) | CLSID `{6fa26e30-7fe6-11d2-a938-00a024190119}` |
| `SIAddPropEx` | `propertytasks.dll` | CLSID `{b683cd81-22c1-11d3-80e6-00a0c9ac19a9}` |
| `SIAssignMaterial` | `modeltasks.dll`, `primtasks.dll`, `propertytasks.dll`, `action.dll`, `activedb.dll`, `scnmgr.dll` … | CLSID `{b81121a4-7ef2-4606-bef3-f9b01f582e35}` |
| `SIUnAssignMaterial` | `propertytasks.dll` | CLSID `{c11ffe86-8e6b-4986-a698-c030d1ee45c3}` |
| `SICreateMaterial` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{3b75c06e-4d3f-458a-b591-13b65ed6603a}` |
| `SICreateMaterialDD` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{3b75c06e-4d3f-458a-b591-13b65ed6603a}` |
| `SelectObjectsUsingMaterial` | `uixsiscripts.vbs` (VBScript) | `SelectObjectsUsingMaterialProc` |
| `SelectMaterialsUsedBy` | `uixsiscripts.vbs` (VBScript) | `SelectMaterialsUsedByProc` |
| `SIAddCustomParameter` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{1d4d499c-d0c4-11d2-a5fa-00a0c9ec5ef7}` |
| `SetClusterPropertyValues` | `optasks.dll`, `propertytasks.dll`, `tasks.dll`, `si3dobjectmodel10.dll`, `sicppsdk.dll`, `weighteditor.dll` … | CLSID `{35fba75e-3ddf-11d3-bc3c-00a0c9612b97}` |
| `CreateUserNormals` | `propertytasks.dll` | CLSID `{695279f7-58a5-4dd9-8380-d5da89ef2294}` |
| `ResetUserNormals` | `propertytasks.dll` | CLSID `{ee56a128-e3ce-47a2-add3-4e02ffa92a93}` |
| `RemoveUserNormals` | `propertytasks.dll` | CLSID `{1ffdd217-e4c2-45c9-91da-b85c536314b4}` |
| `AverageUserNormals` | `propertytasks.dll` | CLSID `{5126b672-f5fa-4c44-b5db-fa3cd7ff8faa}` |
| `SetVertexUserNormals` | `propertytasks.dll` | CLSID `{4ee3fc26-9412-465e-8b65-31be144e444a}` |
| `SetPolygonUserNormals` | `propertytasks.dll` | CLSID `{30e91087-efb6-4e65-a6ef-8114b9537b36}` |
| `InvertUserNormals` | `propertytasks.dll` | CLSID `{de521d76-569f-48ce-bd68-f749de1c9b1f}` |
| `NormalizeUserNormals` | `propertytasks.dll` | CLSID `{813832c9-742d-463c-bcc2-b5cf64794018}` |
| `SetUserNormalValues` | `propertytasks.dll`, `viewinteraction.dll` | CLSID `{6bfbea8d-8dda-4be4-97ec-4af8e1821832}` |
| `CopyUserNormals` | `propertytasks.dll` | CLSID `{46ce9bdb-8137-46bc-bfa8-57465a0d7a22}` |
| `PasteUserNormals` | `propertytasks.dll` | CLSID `{fa8161f0-cd6a-4f3d-b3b7-1c2be4bb169e}` |
| `SIRemoveEntryFromOverride` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{9d6c1334-60ab-11d3-9e86-00a0248f947c}` |
| `SIAddShaderEntryToOverride` | `propertytasks.dll`, `imageclip.dll`, `sicoresdk.dll` | CLSID `{51297d82-1ac1-11d3-9e82-00a0248f947c}` |
| `SIAddEntryToOverride` | `propertytasks.dll`, `imageclip.dll`, `sicoresdk.dll` | CLSID `{51297d82-1ac1-11d3-9e82-00a0248f947c}` |
| `SIAddParameterEntryToOverride` | `propertytasks.dll`, `imageclip.dll`, `sicoresdk.dll` | CLSID `{51297d82-1ac1-11d3-9e82-00a0248f947c}` |
| `SIAddConnectionEntryToOverride` | `propertytasks.dll`, `imageclip.dll`, `sicoresdk.dll` | CLSID `{51297d82-1ac1-11d3-9e82-00a0248f947c}` |
| `SIGetOriginalValueOfOverridden` | `propertytasks.dll` | CLSID `{7e0f4019-60d2-4395-a42f-06c26c7fd459}` |
| `SIGetOverriddenParameters` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{bc652f97-d8cf-4bc5-bfdd-7c2569f56729}` |
| `SIStoreProp` | `propertytasks.dll`, `imageclip.dll`, `sicoresdk.dll` | CLSID `{51297d82-1ac1-11d3-9e82-00a0248f947c}` |
| `Open SE on Override parent` | `tasks.dll` | CLSID `{bd7111d4-3ee8-11d3-9e84-00a0248f947c}` |
| `SetEnvelopeRefPoses` | `propertytasks.dll` | CLSID `{fc604326-7a6e-11d3-99ca-00a0243f0e60}` |
| `AddProxyParam` | `propertytasks.dll`, `action.dll`, `sicoresdk.dll` | CLSID `{7df95d5e-2121-11d4-a64f-00a0c9ec5ef7}` |
| `RemoveProxyParam` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{d3520b6e-21cd-11d4-a64f-00a0c9ec5ef7}` |
| `RandomizeParameters` | `parameters.vbs` (VBScript) | `RandomizeParamsProc` |
| `Add property extended` | `propertytasks.dll` | CLSID `{dc53bba1-c468-11d3-acbd-0090275802bf}` |
| `DeleteOverride` | `uixsiscripts.vbs` (VBScript) | `DeleteOverride` |
| `CreateSymmetryMappingTemplate` | `enveloping.vbs` (VBScript) | `CreateSymmetryMappingTemplateProc` |
| `CreateSymmetryMap` | `uixsiscripts.vbs` (VBScript) | `CreateSymmetryMap` |
| `IncreaseSubdivision` | `uixsiscripts.vbs` (VBScript) | `ChangeSubdivisionProc` |
| `DecreaseSubdivision` | `uixsiscripts.vbs` (VBScript) | `ChangeSubdivisionProc` |
| `CreateDisplayInfo` | `parameters.vbs` (VBScript) | `CreateDisplayInfoFromMarkedParametersProc` |
| `SampleParameterValues` | `parameters.vbs` (VBScript) | `SampleParamValuesProc` |
| `TagObject` | `Charac_Tools.js` (JScript) | `tagObjectProc` |
| `TagStepMarks` | `Charac_Tools.js` (JScript) | `TagStepMarksProc` |
| `GenDiffuseMap` | `GPUSurfaceFX.js` (JScript) | `XSI_GenerateDiffuseMap` |
| `GenNormalMap` | `GPUSurfaceFX.js` (JScript) | `XSI_GenerateNormalMap` |
| `RenameCPSetLayoutItems` | `tasks.dll` | CLSID `{1bbd2841-aefc-478a-a61e-d2e34766c3cd}` |
| `siCreateRetargetMapping` | `propertytasks.dll` | CLSID `{cbe3e960-1e81-4a77-a16f-28c075787a5c}` |
| `siWriteRetargetMapping` | `propertytasks.dll` | CLSID `{b8b04cc5-fe11-438e-a42c-c7c58eb5c4b6}` |
| `siWriteRetargetComponentData` | `propertytasks.dll` | CLSID `{06602467-ed04-48d7-9c52-c257b40768e2}` |
| `CreateUserMotion` | `uixsiscripts.vbs` (VBScript) | `CreateUserMotionProc` |
| `ApplyOperator` | (CLSID not specific to one binary) | CLSID `{46cee370-8bb2-11d2-ac56-00a02485cecb}` |
| `GetConnectionSet` | `optasks.dll`, `sicurvetasks.dll`, `sparks.dll`, `sicoresdk.dll` | CLSID `{825449e3-8706-11d2-8091-00a0c955b335}` |
| `GetSurfaceFromCurvesConnectionSet` | `optasks.dll`, `sicurvetasks.dll`, `sparks.dll`, `sicoresdk.dll` | CLSID `{825449e3-8706-11d2-8091-00a0c955b335}` |
| `ApplyOp` | `operators.vbs` (VBScript) | `ApplyOpFunc` |
| `GetGeneratorInputsForDisposal` | `optasks.dll` | CLSID `{85759d87-aacb-4837-863b-b268035a3f7d}` |
| `SelectGeneratorInputs` | `operators.vbs` (VBScript) | `SelectGeneratorInputs` |
| `HideGeneratorInputs` | `operators.vbs` (VBScript) | `HideGeneratorInputs` |
| `DeleteGeneratorInputs` | `operators.vbs` (VBScript) | `DeleteGeneratorInputs` |
| `ApplyTopoOp` | `operators.vbs` (VBScript) | `ApplyTopoOpFunc` |
| `ApplyGenOp` | `operators.vbs` (VBScript) | `ApplyGenOpFunc` |
| `ApplySnapFaceOp` | `operators.vbs` (VBScript) | `ApplySnapFaceOpFunc` |
| `ApplyPropVolumeOp` | `operators.vbs` (VBScript) | `ApplyPropVolumeOpProc` |
| `InitPropVolume` | `optasks.dll`, `primtasks.dll` | CLSID `{c5dc6089-0efd-4361-a84f-0840b708a657}` |
| `TogglePropVolume` | `optasks.dll` | CLSID `{e9bba0e0-4a7f-48f6-aade-95c94e0888f6}` |
| `GetConnectedPropVolume` | `optasks.dll` | CLSID `{9230d7a9-5c92-491a-908e-e1f8bdf7b396}` |
| `InspectPropVolume` | `optasks.dll` | CLSID `{05af89a5-3b06-48af-a897-4204529e0828}` |
| `SpinEdgeForward` | `uixsiscripts.vbs` (VBScript) | `SpinEdgeForwardProc` |
| `SpinEdgeBackward` | `uixsiscripts.vbs` (VBScript) | `SpinEdgeBackwardProc` |
| `SetCurveKnotMultiplicity` | `operators.vbs` (VBScript) | `ApplySetCurveKnotMultiplicityOpFunc` |
| `SITransferCenter` | `optasks.dll` | CLSID `{412f8ee4-c4e2-11d4-b863-009027bc6587}` |
| `ExtractFromComponents` | `operators.vbs` (VBScript) | `ApplyExtractFromPartClsFunc` |
| `siTrimWith` | `optasks.dll` | CLSID `{222cbe2b-217e-431c-a6d0-d2abfe8194c2}` |
| `ApplyFlexEnv` | `operators.vbs` (VBScript) | `ApplyFlexibleEnvelopeProc` |
| `SIApplyFlexEnv` | `optasks.dll`, `sicoresdk.dll` | CLSID `{f8c8c073-acdc-11d2-99b7-00a0243f0e60}` |
| `SIApplyFlexEnvWithWeight` | `optasks.dll` | CLSID `{2fd07801-c7cc-4292-a8ef-8f09bce70620}` |
| `SIApplyDeformBySpine` | `optasks.dll` | CLSID `{f9498641-02f5-11d3-9137-00a0244eeb76}` |
| `SIApplyDeformByCage` | `optasks.dll` | CLSID `{6f378031-89b6-4216-a31c-3d84e01c927f}` |
| `ApplyDeformByCage` | `operators.vbs` (VBScript) | `ApplyDeformByCageFunc` |
| `SILocalAssignFlexEnv` | `optasks.dll` | CLSID `{56242c30-fdc4-11d2-99c2-00a0243f0e60}` |
| `ResetFlexEnvPtsAssignment` | `optasks.dll` | CLSID `{56242c30-fdc4-11d2-99c2-00a0243f0e60}` |
| `SIModifyFlexEnvWght` | `optasks.dll`, `weighteditor.dll` | CLSID `{61199760-1a84-11d3-99c3-00a0243f0e60}` |
| `SISmoothEnvWght` | `optasks.dll` | CLSID `{083e381f-ccc3-426e-82de-4c1a150250e7}` |
| `LimitEnvelopeDeformers` | `uixsiscripts.vbs` (VBScript) | `LimitEnvelopeDeformersProc` |
| `SISymEnvWeight` | `optasks.dll` | CLSID `{d4a5193a-7b48-43e3-9372-b63e780d9f49}` |
| `RemoveFlexEnvDeformer` | `optasks.dll` | CLSID `{a3293413-b294-11d3-99d6-009027bc6509}` |
| `RemoveFlexEnv` | `optasks.dll` | CLSID `{936e8bd0-ae82-11d3-99d6-009027bc6509}` |
| `LockEnvelopeWeights` | `optasks.dll` | CLSID `{ee4cc939-6415-48de-9245-33b1bcce8349}` |
| `LockEnvelopePointWeights` | `optasks.dll` | CLSID `{7eab797e-361e-45db-bba4-5c9a3f987025}` |
| `ClearEnvelopeWeightLocks` | `optasks.dll` | CLSID `{119de848-61f4-44bc-9121-ebe0db32df64}` |
| `ConnectWeightMap` | `optasks.dll` | CLSID `{31ca68f0-bd5c-11d2-99b8-00a0243f0e60}` |
| `AddMappingNode` | `optasks.dll` | CLSID `{e04fcc31-79d2-11d2-99ad-00a0243f0e60}` |
| `ConnectOperatorParameter` | `optasks.dll` | CLSID `{6834c96b-0b64-412a-9f65-68d4939b172b}` |
| `DisconnectOperatorParameter` | `optasks.dll` | CLSID `{e1e79b2c-c035-41dd-ae0e-eadd3249c24b}` |
| `UpdateConnectOnOp` | `optasks.dll`, `activedb.dll`, `adaptorop.dll`, `textureop.dll` | CLSID `{9c8384e2-da33-11d2-ac75-00a02485cecb}` |
| `LocalAssignFlexEnv` | `operators.vbs` (VBScript) | `LocalAssignFlexibleEnvelopeFunc` |
| `ApplyKinematicOp` | `operators.vbs` (VBScript) | `ApplyKinematicOpFunc` |
| `AddPointToNewPolygon` | `simeshtasks.dll` | CLSID `{a8956b40-3bf3-11d4-8c25-009027bc3a0e}` |
| `RemovePointFromPolygon` | `simeshtasks.dll` | CLSID `{9ff8f6d0-9ebf-11d4-8c45-009027bc3a0e}` |
| `AddPointInteriorToPolygon` | `simeshtasks.dll` | CLSID `{d53d6794-8033-4693-88ed-4f6d6a25f028}` |
| `RemoveLastPointInteriorToPolygon` | `simeshtasks.dll` | CLSID `{0bc15cdd-ff40-4ebd-9f83-06091226d41d}` |
| `TerminateAddEdgeWithInteriorPoints` | `simeshtasks.dll` | CLSID `{247117fc-bce0-4988-8fa3-dc1ad7983f36}` |
| `SnapOffsetToPointForSlicePolygons` | `simeshtasks.dll` | CLSID `{4b596493-d616-49d4-893f-f8fcc4c23c5a}` |
| `ConnectNewPolygonToEdge` | `simeshtasks.dll` | CLSID `{321c2390-3e2f-11d4-8c25-009027bc3a0e}` |
| `ConnectNewPolygonToPoint` | `simeshtasks.dll` | CLSID `{34a206f0-4ca6-11d4-8c28-009027bc3a0e}` |
| `SplitEdge` | `operators.vbs` (VBScript) | `ApplySplitEdgeFunc` |
| `Mesh Filter` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Triangulate` | `operators.vbs` (VBScript) | `TriangulateProc` |
| `Dice Object/Polygons` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `WeldPoints` | `operators.vbs` (VBScript) | `ApplyWeldPointsFunc` |
| `MoveOperatorAfter` | `optasks.dll`, `primtasks.dll`, `viewinteraction.dll` | CLSID `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}` |
| `MoveOperatorBefore` | `optasks.dll`, `primtasks.dll`, `viewinteraction.dll` | CLSID `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}` |
| `MoveOperator` | `optasks.dll`, `primtasks.dll`, `viewinteraction.dll` | CLSID `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}` |
| `ChangeGeneratorInputReadPosition` | `optasks.dll` | CLSID `{f6d1643e-b6d2-4b98-b22a-96fe98fad39d}` |
| `GetGeneratorInputReadPosition` | `optasks.dll` | CLSID `{49451678-ec7a-4537-a27e-38e5c13bfa10}` |
| `GetGeneratorInputReadPosition_UIOnly` | `optasks.dll` | CLSID `{49451678-ec7a-4537-a27e-38e5c13bfa10}` |
| `CopyAnimationAcrossGenerator` | `optasks.dll` | CLSID `{4a2386fc-aac4-4b83-89a6-396bead3dac3}` |
| `SwapOperators` | `optasks.dll` | CLSID `{3fb6dc06-739e-11d4-bdd0-00a0c9615daf}` |
| `DeactivateAbove` | `optasks.dll`, `tasks.dll` | CLSID `{f474765c-67ba-40d4-8f92-b83d81b08b46}` |
| `CycleChecking` | `optasks.dll`, `fcurve.dll` | CLSID `{8fb755e3-06e3-11d7-be20-00a0c9615daf}` |
| `ResetActor` | `optasks.dll` | CLSID `{de9ced62-dd93-406d-b8db-ed7e4c5350ab}` |
| `ConnectICENodes` | `optasks.dll` | CLSID `{deb83777-b5d9-4a1c-be8b-848fa6eca194}` |
| `DisconnectICENodePort` | `optasks.dll` | CLSID `{9821e356-5283-45f9-965b-dd69004cc0a5}` |
| `AddICENode` | `optasks.dll` | CLSID `{2ca63f7d-4d58-4ba4-a226-bd981e110f66}` |
| `AddICECompoundNode` | `optasks.dll`, `rendertree.dll` | CLSID `{b7bbf3e0-50ba-47e1-a121-a85ed2e18101}` |
| `ReplaceICECompoundNode` | `optasks.dll`, `scnmgr.dll` | CLSID `{ce6ac9da-b883-4129-a6c4-2ba96eee4bce}` |
| `SIApplyICEOp` | `optasks.dll` | CLSID `{14c0ed4c-4d33-4697-8f84-bbde2c0baa58}` |
| `ApplyICEOp` | `operators.vbs` (VBScript) | `FApplyICEOpProc` |
| `PrivateGetCompoundConstructionMode` | `optasks.dll` | CLSID `{fc8efed4-79b8-48be-90ca-e44cddd8feb7}` |
| `ExportICECompoundNode` | `optasks.dll` | CLSID `{01b0b17d-ef3d-438f-81d5-3e8f90f7d9be}` |
| `ApplyICETemplate` | `operators.vbs` (VBScript) | `ApplyMDTemplateProc` |
| `GeneratePointCloudWithICETerminal` | `operators.vbs` (VBScript) | `GeneratePointCloudProc` |
| `GeneratePointCloudWithICETemplate` | `operators.vbs` (VBScript) | `GeneratePointCloudWithTemplateProc` |
| `CleanDisconnectedICENodes` | `optasks.dll` | CLSID `{6489ed18-8f26-4062-b1e0-726ba316a1f9}` |
| `AddAttributeToSetDataICENode` | `optasks.dll` | CLSID `{80f29d44-c124-4eef-b261-1592123d61a3}` |
| `RemoveAttributeFromSetDataICENode` | `optasks.dll` | CLSID `{b1b29707-e69c-47d0-b28d-e52ce4fc5970}` |
| `AddPortToICENode` | `optasks.dll` | CLSID `{443328d5-87ac-40f5-8f21-e5d8a6de4dd1}` |
| `AddPortToICENode2` | `optasks.dll` | CLSID `{443328d5-87ac-40f5-8f21-e5d8a6de4dd1}` |
| `RemovePortFromICENode` | `optasks.dll` | CLSID `{87f7b094-2482-4112-883d-75574f5f3573}` |
| `TransferICETree` | `optasks.dll` | CLSID `{3613f42b-4b81-4390-854c-fad9bb6c222e}` |
| `SetICESimInitState` | `optasks.dll` | CLSID `{af2d7c8e-e256-4d35-98c5-aad158924d09}` |
| `RemoveICESimInitState` | `optasks.dll` | CLSID `{c12151b0-ff9a-4d5c-b485-9d9b337b0b65}` |
| `CreateICECompoundNode` | `optasks.dll` | CLSID `{63e1ca40-eea3-41f1-aa52-a5b1bacef904}` |
| `CreateICENodeComment` | `optasks.dll` | CLSID `{bfb82c5f-307b-40ea-b9fb-8f9a329c0288}` |
| `ExplodeICECompoundNode` | `optasks.dll` | CLSID `{b1be0f7b-6022-4e29-abad-b1711a51fb8c}` |
| `AddNodeToICECompoundNode` | `optasks.dll` | CLSID `{84f10d5c-d904-4b8e-83f5-a24976d3f3d6}` |
| `RemoveNodeFromICECompoundNode` | `optasks.dll` | CLSID `{c83a610b-fc27-404f-9c07-1e3d3feada85}` |
| `AddExposedParamToICECompoundNode` | `optasks.dll` | CLSID `{26cb16ed-194a-4427-b56a-be703f019673}` |
| `EditExposedParamInICECompoundNode` | `optasks.dll` | CLSID `{60381d74-bde7-4980-82d4-a48f6f5780c5}` |
| `EditICECompoundProperties` | `optasks.dll` | CLSID `{3e56120d-af46-4263-9280-dfe9507db032}` |
| `RemoveExposedParamFromICECompoundNode` | `optasks.dll` | CLSID `{bf8f591a-6c3e-417c-a2ff-25e6f765f374}` |
| `RemoveExposedPortPassThrough` | `optasks.dll` | CLSID `{a91d22e2-c883-41ab-9330-4e1a317f56b5}` |
| `SetPortType` | `optasks.dll` | CLSID `{66803e82-0cdb-445a-af5d-128efaaf5dec}` |
| `SetStaticICEAttributeType` | `optasks.dll` | CLSID `{bf1968c3-aecc-4751-b015-3bead256214f}` |
| `AddStaticICEAttribute` | `optasks.dll`, `sicoresdk.dll` | CLSID `{a3386f3d-c5c1-4e16-8dfb-ecfeecc56baf}` |
| `RemoveStaticICEAttribute` | `optasks.dll`, `sicoresdk.dll` | CLSID `{ba2015ca-7fe1-4688-b403-fcafa2e0852c}` |
| `RenameStaticICEAttribute` | `optasks.dll` | CLSID `{4758bede-b77e-4634-834a-1a6b69629265}` |
| `ToggleICEAttributeAlwaysEvaluated` | `optasks.dll` | CLSID `{c98dd3f8-d700-4d95-8910-5096f1400e13}` |
| `Invert Polygons` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Subdivide` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `SubstituteOpInput` | `optasks.dll` | CLSID `{4b382841-216f-11d5-ad0a-0090275802bf}` |
| `AddInputToOperator` | `optasks.dll` | CLSID `{4b382841-216f-11d5-ad0a-0090275802bf}` |
| `RemoveInputFromOperator` | `optasks.dll` | CLSID `{4b382841-216f-11d5-ad0a-0090275802bf}` |
| `SIBasicTransferClusterPropertiesAcrossGenOp` | `optasks.dll` | CLSID `{7be54750-3839-464f-9d42-5e1822056f25}` |
| `SIBasicTransferClustersAcrossGenOp` | `optasks.dll` | CLSID `{81f70f51-067c-42c9-8a7b-3db10ace0688}` |
| `TransferAllPropertiesAcrossGenOp` | `optasks.dll` | CLSID `{e73d3b5a-354e-466b-b12b-e666f3a560f5}` |
| `TransferPropertiesAcrossGenOp` | `optasks.dll` | CLSID `{edca5404-3e79-4ede-b59a-d438b050c362}` |
| `TransferClusterPropertiesAcrossGenOp` | `optasks.dll` | CLSID `{f00335b8-9ed0-4595-93f5-886e7f2aa73d}` |
| `GenerateAutomaticUVs` | `optasks.dll` | CLSID `{706986e9-06f3-4604-b7c3-5d0f396de0f3}` |
| `TransferShapeAnimationAcrossGenOp` | `optasks.dll` | CLSID `{b261a1ba-ab27-4bd5-9bec-f17314245140}` |
| `DisconnectFromSimulationOp` | `optasks.dll` | CLSID `{84854b58-b16a-4b4a-9c37-54483ff41aa1}` |
| `ApplyHairOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairOp` |
| `ApplyHairDynamicsOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairDynamicsOp` |
| `ApplyHairSplineGenOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairSplineGenOp` |
| `ApplyHairCombOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairCombOp` |
| `ApplyHairCombNormalOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairCombNormalOp` |
| `ApplyHairCutOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairCutOp` |
| `ApplyHairAttenuateOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairAttenuateOp` |
| `ApplyHairPopOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairPopOp` |
| `ApplyHairPopSelectedOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairPopSelectedOp` |
| `ApplyHairResampleOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairResampleOp` |
| `ApplyHairSplitOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairSplitOp` |
| `ApplyHairShatterOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairShatterOp` |
| `ApplyHairMergeOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairMergeOp` |
| `ApplyHairLockOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairLockOp` |
| `ApplyHairUnlockOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairUnlockOp` |
| `ApplyHairRecombOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairRecombOp` |
| `ApplyHairScaleOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairScaleOp` |
| `ApplyHairClumpOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairClumpOp` |
| `ApplyHairPuffOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairPuffOp` |
| `ApplyHairRotateOp` | `uixsiscripts.vbs` (VBScript) | `ApplyHairRotateOp` |
| `ConnectMap` | `optasks.dll` | CLSID `{c70b63f3-2d25-11d5-bdeb-00a0c9615daf}` |
| `ConnectBevelProfileCurve` | `optasks.dll` | CLSID `{777f2102-a2e7-4721-b977-0030b1b2f6a9}` |
| `DisconnectBevelProfileCurve` | `optasks.dll` | CLSID `{73849979-93e6-470e-8f61-2b3e2b54b247}` |
| `ConnectPlaneReferenceToSlicePolygonsOp` | `optasks.dll` | CLSID `{53e49e93-b205-4c81-a553-4c82e36c92d9}` |
| `DisconnectPlaneReferenceFromSlicePolygonsOp` | `optasks.dll` | CLSID `{e85b7bc9-d0d0-4859-9fed-b975d3e1be4d}` |
| `CreateGridAndConnectToSlicePolygonsOp` | `optasks.dll` | CLSID `{e22d0a9f-7e9e-474c-bd97-3bf58a796fe8}` |
| `ConvertScriptedOp` | `scriptedopeditor.dll` | CLSID `{532b8303-b52e-11d5-81a9-00a0c9ac19a9}` |
| `AddScriptedOp` | `ophost.dll`, `sicoresdk.dll` | CLSID `{f44c09e7-3b99-4e69-b5f8-8c88cd1b25c9}` |
| `AddCustomOp` | `action.dll`, `ophost.dll`, `sicoresdk.dll` | CLSID `{f33c09e7-3b99-4e69-b5f8-8c88cd1b25c8}` |
| `AddScriptedOpFromFile` | `ophost.dll` | CLSID `{7fba5233-d05d-4cb7-a107-b5b08e513f1c}` |
| `PropertyTransfer` | `optasks.dll` | CLSID `{d5b91e0f-d65f-4ced-8cac-811e801f54e8}` |
| `CurveDirectManip` | `sicurvetasks.dll`, `viewinteraction.dll` | CLSID `{2012b58b-55bb-4512-a6d0-8f95a6c92c9a}` |
| `AlignBezierKnotsTangents` | `operators.vbs` (VBScript) | `AlignBezierKnotsTangentsFunc` |
| `CreateSimulatedICETree` | `operators.vbs` (VBScript) | `CreateSimulatedICETreeProc` |
| `GetICECompoundProperties` | `optasks.dll` | CLSID `{1728169f-6fdc-4d78-b1b5-7db9226fcb5c}` |
| `GetICECompoundPortProperties` | `optasks.dll` | CLSID `{55fec68a-1300-4425-af00-52a29fca153d}` |
| `ApplyThickness` | `operators.vbs` (VBScript) | `ApplyThicknessProc` |
| `CapHole` | `operators.vbs` (VBScript) | `CapHoleProc` |
| `ApplySliceBetweenTwoVertices` | `operators.vbs` (VBScript) | `ApplySliceBetweenTwoVerticesProc` |
| `HideAllPortValues` | `optasks.dll` | CLSID `{a7c8afef-aabf-4bc6-a6cb-505e4065327c}` |
| `MoveICECompoundPort` | `optasks.dll` | CLSID `{f1b5f0c8-a84f-431b-9581-a64349401c84}` |
| `RenameICEPPGLayoutGroup` | `optasks.dll` | CLSID `{6c0a3174-80f4-4e8b-b6d2-2b617206c665}` |
| `MoveICECompoundPortsAndLayoutGroups` | `optasks.dll` | CLSID `{7713d549-6ba4-4cbc-b57a-7f182e778408}` |
| `CreateLayoutGroupInICECompoundNode` | `optasks.dll` | CLSID `{e6a70747-727c-4c59-8967-df7e35f45e4d}` |
| `SIConvert` | `optasks.dll`, `sicoresdk.dll` | CLSID `{6c5fded2-994f-11d2-ac5c-00a02485cecb}` |
| `RemoveCnsType` | `optasks.dll`, `sicoresdk.dll` | CLSID `{f65e43d2-cc09-11d2-ac73-00a02485cecb}` |
| `RemoveCns` | `optasks.dll` | CLSID `{f65e43d3-cc09-11d2-ac73-00a02485cecb}` |
| `RemoveAllCns` | `uixsiscripts.vbs` (VBScript) | `RemoveAllCnsProc` |
| `SIApplyConstraint` | `optasks.dll`, `pathanimtask.dll`, `primtasks.dll`, `action.dll`, `sicoresdk.dll` | CLSID `{ce420851-b9eb-11d2-ac6e-00a02485cecb}` |
| `SIApplyCns` | `optasks.dll` | CLSID `{885f35c3-bc56-11d2-ac71-00a02485cecb}` |
| `SelectConstrainingObjects` | `uixsiscripts.vbs` (VBScript) | `SelectConstrainingObjects` |
| `SelectConstrainedObjects` | `uixsiscripts.vbs` (VBScript) | `SelectConstrainedObjects` |
| `GetConstrainedObjects` | `optasks.dll` | CLSID `{06c26ea2-2c2e-4c02-93e6-aa47bf861c57}` |
| `SelectExternalConstraints` | `animation.vbs` (VBScript) | `ManageExternalConstraintProc` |
| `ActivateExternalConstraints` | `animation.vbs` (VBScript) | `ManageExternalConstraintProc` |
| `DeactivateExternalConstraints` | `animation.vbs` (VBScript) | `ManageExternalConstraintProc` |
| `RemoveExternalConstraints` | `animation.vbs` (VBScript) | `ManageExternalConstraintProc` |
| `CreateCluster` | `uixsiscripts.vbs` (VBScript) | `CreateClusterFunc` |
| `RemoveCluster` | `uixsiscripts.vbs` (VBScript) | `RemoveCluster` |
| `RemoveFromCluster` | `uixsiscripts.vbs` (VBScript) | `RemoveFromCluster` |
| `AddToCluster` | `uixsiscripts.vbs` (VBScript) | `AddToCluster` |
| `CreateClusterFromSubComponent` | `optasks.dll`, `primtasks.dll`, `siclustertasks.dll`, `sicurvetasks.dll`, `action.dll`, `gap.dll` … | CLSID `{5f1f5163-8b90-11d2-a93c-00a024190119}` |
| `SICreateCluster` | (CLSID not specific to one binary) | CLSID `{5f1f5161-8b90-11d2-a93c-00a024190119}` |
| `SIAddToCluster` | `optasks.dll`, `primtasks.dll`, `propertytasks.dll`, `siclustertasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{5f1f5165-8b90-11d2-a93c-00a024190119}` |
| `SIRemoveFromCluster` | `propertytasks.dll`, `siclustertasks.dll` | CLSID `{5f1f5167-8b90-11d2-a93c-00a024190119}` |
| `CopyCluster` | `siclustertasks.dll`, `action.dll` | CLSID `{88f1aa51-7dc9-11d4-9c8a-00d0b719049e}` |
| `CreateMeshPartitionClusters` | `simeshtasks.dll` | CLSID `{e487669d-e540-422b-9f8d-690c0d6bc50c}` |
| `CreateClustersAlongDepthFromCurvesToMeshOperator` | `simeshtasks.dll` | CLSID `{9237b4fb-2165-4128-a23f-b255fb35f393}` |
| `CreateClustersFromSlicePolygonsOperator` | `simeshtasks.dll` | CLSID `{a8e33f35-21c0-4c29-8ecb-5b606a789d01}` |
| `CreateCurvePartitionClusters` | `sicurvetasks.dll` | CLSID `{2fb4eae2-5671-4a2b-b0f6-749ebc7d23d7}` |
| `Polygon Cluster Visibility Property` | `layers.vbs` (VBScript) | `AddVisPropToPolygonCluster` |
| `CreateGroup` | `uixsiscripts.vbs` (VBScript) | `FCreateGroup` |
| `AddToGroup` | `uixsiscripts.vbs` (VBScript) | `AddToGroup` |
| `RemoveFromGroup` | `uixsiscripts.vbs` (VBScript) | `RemoveFromGroupProc` |
| `SIRemoveFromGroup` | `grouptask.dll`, `_3dobject2.dll`, `mcp.dll`, `sicoresdk.dll` | CLSID `{0b9f8322-832d-11d2-b904-00a024c78ee3}` |
| `RemoveGroup` | `uixsiscripts.vbs` (VBScript) | `RemoveGroup` |
| `SICreateGroup` | `grouptask.dll`, `_3dobject2.dll`, `scnmgr.dll`, `sicoresdk.dll` | CLSID `{03f2fdf0-7fcf-11d2-b903-00a024c78ee3}` |
| `SIAddToGroup` | `uixsiscripts.vbs` (VBScript) | `AddToGroupProc` |
| `SIAddToGroupLowLevel` | `grouptask.dll`, `primtasks.dll`, `tasks.dll`, `_3dobject2.dll`, `sicoresdk.dll` | CLSID `{0b9f8320-832d-11d2-b904-00a024c78ee3}` |
| `AddGroup` | `grouptask.dll`, `modeltasks.dll` | CLSID `{06af33ae-66c9-11d3-aca7-0090275802bf}` |
| `AddToPartition` | `grouptask.dll`, `sicoresdk.dll` | CLSID `{4e021856-251e-11d4-8124-00a0c9ac19a9}` |
| `RemoveFromPartition` | `grouptask.dll`, `sicoresdk.dll` | CLSID `{4e021857-251e-11d4-8124-00a0c9ac19a9}` |
| `CreateGroupFromObjects` | `uixsiscripts.vbs` (VBScript) | `FCreateGroupFromObjects` |
| `SICreateLayer` | `tasks.dll` | CLSID `{42570b11-1267-4a95-8ce0-d781ce23a79f}` |
| `SICreateLayer2` | `tasks.dll` | CLSID `{42570b11-1267-4a95-8ce0-d781ce23a79f}` |
| `SICreateLayerFromSelection` | `layers.vbs` (VBScript) | `CreateLayerFromSelection` |
| `SICreateLayerFromSelection2` | `layers.vbs` (VBScript) | `CreateLayerFromSelection2` |
| `MoveToLayer` | `modeltasks.dll`, `tasks.dll`, `action.dll`, `imageclip.dll`, `rendercore.dll`, `_3dobject2.dll` | CLSID `{1c7c2c98-dd95-45c5-802b-3c7334b7edc0}` |
| `MoveObjectToLayer` | `tasks.dll`, `sicoresdk.dll` | CLSID `{8416ea77-4b04-46f3-a153-f7277562ae49}` |
| `CreateLayerGroup` | `tasks.dll` | CLSID `{38e33817-0836-4a54-97ee-07d0759e713c}` |
| `CutLayerParent` | `tasks.dll`, `sicoresdk.dll` | CLSID `{7d1b0d6f-0815-4f0b-aa7a-cc7498015863}` |
| `ToggleVisibility` | `layers.vbs` (VBScript) | `ToggleVisibilityParameter` |
| `ToggleGhosting` | `layers.vbs` (VBScript) | `ToggleVisibilityParameter` |
| `CreateLayer` | `layers.vbs` (VBScript) | `CreateLayer` |
| `DeleteCurrentLayer` | (CLSID not specific to one binary) | CLSID `{dd531990-ccc2-11d2-ac73-00a02485cecb}` |
| `ToggleCurrentLayerProperty` | `layers.vbs` (VBScript) | `ToggleCurrentLayerProperty` |
| `GetCurrentLayer` | `tasks.dll` | CLSID `{2f76bc83-f028-11d2-ac7c-00a02485cecb}` |
| `SetCurrentLayer` | `tasks.dll`, `viewinteraction.dll` | CLSID `{2f76bc8f-f028-11d2-ac7c-00a02485cecb}` |
| `AddClip` | `action.dll`, `imageclip.dll`, `actioncore.dll`, `environments.dll` | CLSID `{67b8773b-e316-11d2-b350-00105a1e6ce9}` |
| `AddLayerClip` | `fcurve.dll`, `actioncore.dll` | CLSID `{75bea1d4-81aa-41ea-9412-f93677996c20}` |
| `AddTrack` | `modeltasks.dll`, `action.dll`, `fcurve.dll`, `imageclip.dll`, `actioncore.dll`, `moaudio.dll` | CLSID `{67b8773c-e316-11d2-b350-00105a1e6ce9}` |
| `MoveClipToTrack` | `actioncore.dll` | CLSID `{67b8773e-e316-11d2-b350-00105a1e6ce9}` |
| `CopyClipToTrack` | `action.dll`, `actioncore.dll` | CLSID `{acd20b45-617e-11d4-b4b4-00d0b7142c4a}` |
| `AddMarker` | `fcurve.dll`, `actioncore.dll` | CLSID `{f4a11b4a-ed7b-11d2-b353-00105a1e6ce9}` |
| `CreateCompound` | `action.dll`, `actioncore.dll` | CLSID `{67b8773d-e316-11d2-b350-00105a1e6ce9}` |
| `ExplodeCompound` | `actioncore.dll` | CLSID `{9517f6f5-6d59-11d4-b4c1-00d0b7142c4a}` |
| `ImportAction` | `action.dll` | CLSID `{12a3efcf-e543-11d2-b352-00105a1e6ce9}` |
| `ImportRefAction` | `action.dll` | CLSID `{12a3efcf-e543-11d2-b352-00105a1e6ce9}` |
| `LoadActionPreset` | `action.dll` | CLSID `{12a3efcf-e543-11d2-b352-00105a1e6ce9}` |
| `ExportAction` | `action.dll` | CLSID `{12a3efd1-e543-11d2-b352-00105a1e6ce9}` |
| `SIStoreAction` | `action.dll`, `imageclip.dll`, `actioncore.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{12a3efcd-e543-11d2-b352-00105a1e6ce9}` |
| `StoreAction` | `action.vbs` (VBScript) | `StoreActionProc` |
| `GetInputAndStoreAction` | `action.vbs` (VBScript) | `GetInputAndStoreActionProc` |
| `GetInputAndStoreAction2` | `action.vbs` (VBScript) | `GetInputAndStoreActionProc2` |
| `GetStoreActionDefaults` | `action.dll`, `imageclip.dll`, `actioncore.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{12a3efcd-e543-11d2-b352-00105a1e6ce9}` |
| `CreateSpeechAction` | `action.dll` | CLSID `{f4a0e1e6-77ef-4ea5-b92a-193c0bf2c178}` |
| `FreezeLipSync` | `action.dll` | CLSID `{bc71a1b3-439e-48eb-be67-934acc6147c6}` |
| `CreateVisemeAction` | `action.dll` | CLSID `{5e9f232b-9446-47e3-bc71-2b4419dc414e}` |
| `StoreViseme` | `action.dll` | CLSID `{073dfffa-4f94-413a-b386-2db1c0a4d610}` |
| `SetupEvolverVisemes` | `action.dll` | CLSID `{54a09888-4c17-4120-a57f-39c3395d0bca}` |
| `CreateEvolverSpeechAction` | `action.dll` | CLSID `{afc0e8f6-2cbb-43c2-befa-e68ed151a8a8}` |
| `GenerateLipSync` | `EvolverLipSync.js` (JScript) | `GenerateLipSyncProc` |
| `AddTransition` | `action.dll`, `actioncore.dll` | CLSID `{c030ada0-1a8f-11d3-b35b-00105a1e6ce9}` |
| `AddClipRelation` | `actioncore.dll`, `sicoresdk.dll` | CLSID `{2b6f1f13-69fd-4fea-96ac-d2ff702774db}` |
| `SwapRelationMasterAndSlaveClip` | `actioncore.dll`, `sicoresdk.dll` | CLSID `{7aabbe2d-5a4d-4644-a1e9-39d983053bc1}` |
| `PlotToAction` | `action.dll` | CLSID `{12a3efd0-e543-11d2-b352-00105a1e6ce9}` |
| `ApplyAction` | `action.dll`, `imageclip.dll`, `_3dobject2.dll`, `actioncore.dll`, `actionhelper.dll` | CLSID `{12a3efd3-e543-11d2-b352-00105a1e6ce9}` |
| `PlotAndApplyAction` | `uixsiscripts.vbs` (VBScript) | `PlotAndApplyActionProc` |
| `PasteAction` | `action.vbs` (VBScript) | `GetInputAndPasteActionProc` |
| `CreateValueMap` | `action.dll` | CLSID `{004f7515-fcbd-11d2-bdfe-00a0243e3543}` |
| `CreateEmptyValueMap` | `action.dll` | CLSID `{004f7515-fcbd-11d2-bdfe-00a0243e3543}` |
| `CreateConnectionMap` | `action.dll` | CLSID `{004f7514-fcbd-11d2-bdfe-00a0243e3543}` |
| `CreateEmptyConnectionMap` | `action.dll` | CLSID `{004f7514-fcbd-11d2-bdfe-00a0243e3543}` |
| `AddMappingRule` | `action.dll` | CLSID `{280a45b1-4422-11d3-9c67-0060970a2bc8}` |
| `SetMappingRule` | `action.dll` | CLSID `{fd595ace-c3d9-11d3-b38d-00105a1e6ce9}` |
| `DeleteMappingRule` | `action.dll` | CLSID `{87eab571-443d-11d3-9c67-0060970a2bc8}` |
| `GetNumMappingRules` | `action.dll` | CLSID `{bdd3f140-4446-11d3-9c67-0060970a2bc8}` |
| `GetMappingRule` | `action.dll` | CLSID `{9b4b0f32-4456-11d3-9c67-0060970a2bc8}` |
| `GetDrivingActions` | `action.dll`, `graphic.dll` | CLSID `{7249a5d5-c3e9-11d4-b8b5-00a0c92469be}` |
| `PlotCurve` | `uixsiscripts.vbs` (VBScript) | `PlotCurveProc` |
| `PlotShape` | `action.dll` | CLSID `{aaf411c1-bcb2-11d4-b4dd-00d0b7142c4a}` |
| `EqualizeAction` | `action.dll` | CLSID `{03819cd3-43c5-11d4-bdde-00a0c961747d}` |
| `GetInputAndPlotKeyableToAction` | `uixsiscripts.vbs` (VBScript) | `GetInputAndPlotKeyableToActionProc` |
| `PlotConstrainedTransforms` | `uixsiscripts.vbs` (VBScript) | `PlotConstrainedTransformsProc` |
| `AddPoseActionItems` | `action.dll` | CLSID `{9e1ddb90-ead8-11d3-b395-00105a1e6ce9}` |
| `CopySourceActionToFolder` | `action.dll` | CLSID `{600255c0-46ac-11d4-b4ab-00d0b7142c4a}` |
| `MergeClips` | `action.dll` | CLSID `{eb00f267-d99b-46a3-ae61-7d8b923b5f59}` |
| `SetDefaultWeight` | `action.vbs` (VBScript) | `SetDefaultWeightProc` |
| `EditClip` | `action.vbs` (VBScript) | `EditClipProc` |
| `CreateOffsetEffect` | `action.dll` | CLSID `{beebd686-5c15-11d4-a53d-009027bc6584}` |
| `ResetOffset` | `action.dll` | CLSID `{b08e95bb-58f1-11d4-a53c-009027bc6584}` |
| `RemoveEffect` | `action.dll` | CLSID `{37a40422-ab72-11d4-a54d-009027bc6584}` |
| `RemoveActionItem` | `action.dll` | CLSID `{0be818ac-36cd-400f-a05c-e622a8a24e55}` |
| `EqualizeClips` | `action.vbs` (VBScript) | `EqualizeClipsProc` |
| `AddBridgeTransition` | `action.vbs` (VBScript) | `AddBridgeTransitionFunc` |
| `AddTWTransition` | `action.dll` | CLSID `{7bec3ab9-5655-11d4-bde6-00a0c961747d}` |
| `CutClipInSpace` | `action.dll` | CLSID `{ba76fd14-6ec1-11d4-b4c1-00d0b7142c4a}` |
| `ReconnectMixer` | `actioncore.dll` | CLSID `{c976d03e-61ec-41c4-a40a-21869c2a7ed8}` |
| `DeleteUnusedMixerTracks` | `action.vbs` (VBScript) | `DeleteUnusedMixerTracksProc` |
| `CollapseLayers` | `action.dll` | CLSID `{afdd0f73-3eb4-4c3d-a36e-6ee27e92185c}` |
| `PlotToActions` | `action.dll` | CLSID `{7bff0142-531f-410b-bdd5-194614f0c911}` |
| `PlotFrameSetToActions` | `action.dll` | CLSID `{7bff0142-531f-410b-bdd5-194614f0c911}` |
| `PlotAndApplyActions` | `uixsiscripts.vbs` (VBScript) | `PlotAndApplyActionsProc` |
| `PlotConstrainedTransformsToActions` | `uixsiscripts.vbs` (VBScript) | `PlotConstrainedTransformsToActionsProc` |
| `PlotKeyableToActions` | `uixsiscripts.vbs` (VBScript) | `PlotKeyableToActionsProc` |
| `AddShotClip` | `modeltasks.dll`, `actioncore.dll` | CLSID `{65cfe35a-a90c-4786-8d8c-b87a128004fb}` |
| `GetShotClip` | `actioncore.dll` | CLSID `{fd3d98b2-7b7b-4246-9a2f-9abcdc2583c1}` |
| `PlotCamSeqToActions` | `action.dll` | CLSID `{d1404f70-9769-409d-bfb8-008a6a69caa0}` |
| `PlotCamSeqShape` | `action.dll` | CLSID `{6868201f-0d9e-4689-9a38-b7d823796d57}` |
| `GetSceneFrameSetFromCamSeq` | `action.dll` | CLSID `{8ece62e1-41c9-4e18-84cc-97a1b0d8d625}` |
| `Create2DSkeleton` | `chains.vbs` (VBScript) | `CreateSkeletonProc` |
| `Create3DSkeleton` | `chains.vbs` (VBScript) | `CreateSkeletonProc` |
| `SICreateSkeleton` | `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{59c1e31b-bdf1-11d2-8433-00a0c961747d}` |
| `SIAppendBone` | `sicoresdk.dll`, `viewinteraction.dll` | CLSID `{59c1e31d-bdf1-11d2-8433-00a0c961747d}` |
| `GetSkeleton` | `kinechain.dll` | CLSID `{9dc2d898-a3b8-11d3-a4f7-009027bc6584}` |
| `AddBoneToEnd` | `chains.vbs` (VBScript) | `AddBoneToEndProc` |
| `SetBoneMinRotLimit` | `chains.vbs` (VBScript) | `SetJointMinMaxProc` |
| `SetBoneMaxRotLimit` | `chains.vbs` (VBScript) | `SetJointMinMaxProc` |
| `SetBoneRotationToPrefRotation` | `chains.vbs` (VBScript) | `SetJointsToPrefRotations` |
| `AlignRootToFirstBone` | `chains.vbs` (VBScript) | `AlignRootToFirstBone` |
| `BreakChainAtBone` | `chains.vbs` (VBScript) | `BreakChainAtJointProc` |
| `CreateChainfromCurve` | `chains.vbs` (VBScript) | `CreateChainFromCurveProc` |
| `KeyAllBoneRotations` | `chains.vbs` (VBScript) | `KeyAllBoneRotationsProc` |
| `InspectChainProperties` | `chains.vbs` (VBScript) | `InspectChainPropertiesProc` |
| `CreateRigFromGuide` | `Charac_RigFromBiped.vbs` (VBScript) | `CreateRigFromBipedGuideProc` |
| `CreateRigFromQuadruped` | `Charac_RigFromQuadruped.vbs` (VBScript) | `CreateRigFromQuadrupedProc` |
| `CreateSpine` | `rigs.vbs` (VBScript) | `CreateSpineFunc` |
| `SelectDeformersFromEnvelope` | `enveloping.vbs` (VBScript) | `SelectDeformersFromEnvelopeProc` |
| `AssociateEnvelopeBoundingVolume` | `enveloping.vbs` (VBScript) | `EnvelopeAssociateBoundingVolumesProc` |
| `MoveJoint` | `viewinteraction.dll` | CLSID `{ca6a8073-ab30-4b7f-bdec-6a6a5ad6859a}` |
| `GetSource` | `fcurve.dll` | CLSID `{30db8dc4-1788-11d3-bc37-00a0c9612b97}` |
| `IsAnimated` | `fcurve.dll` | CLSID `{5196a050-cdad-11d3-acc4-0090275802bf}` |
| `AddFCurve` | `action.dll`, `fcurve.dll` | CLSID `{920f5f50-5d55-11d2-8082-00a0c955b335}` |
| `SetCurrentAnimationLayer` | `action.dll`, `fcurve.dll` | CLSID `{adf44f2c-3eb5-4644-961e-124d9b9ac7cb}` |
| `GetCurrentAnimationLayer` | `fcurve.dll` | CLSID `{5d501435-825b-4c5e-9d37-bf599c3fa721}` |
| `GetNumberOfAnimationLayers` | `fcurve.dll` | CLSID `{3cd9b582-f774-4ff3-a3b9-4b7349e37598}` |
| `AddAnimationLayer` | `fcurve.dll` | CLSID `{18b7bbf8-9f0d-4690-b04f-23876a305985}` |
| `DeleteAnimationLayer` | `fcurve.dll` | CLSID `{f84a352a-2f6f-422c-b815-f35fa55eec1c}` |
| `DuplicateAnimationLayer` | `fcurve.dll` | CLSID `{f37a1f2a-e2ed-47eb-afeb-d4cdc4e8ef77}` |
| `LockAnimationLayer` | `action.dll`, `fcurve.dll` | CLSID `{f9ce2086-dfb8-4f6f-a722-4c29a4204242}` |
| `UnlockAnimationLayer` | `action.dll`, `fcurve.dll` | CLSID `{f9ce2086-dfb8-4f6f-a722-4c29a4204242}` |
| `IsAnimationLayerLocked` | `fcurve.dll` | CLSID `{c6dfe971-4f51-47f5-bc0f-6f4d5a7db562}` |
| `ConvertEulerToQuat` | `fcurve.dll` | CLSID `{a12faa27-9db9-402d-bd47-6bf3f1a44e98}` |
| `ConvertQuatToEuler` | `fcurve.dll` | CLSID `{a2fd91a0-c55e-4b68-ba16-d1aa1ab9da15}` |
| `MakeRotationsContinuous` | `fcurve.dll` | CLSID `{b862933c-f2ae-4c9e-98d3-2b3d705b40d9}` |
| `RemoveAnimation` | `propertytasks.dll`, `action.dll`, `fcurve.dll`, `sicoresdk.dll` | CLSID `{5ad1fd7e-5d5d-11d2-8082-00a0c955b335}` |
| `SaveKey` | `pathanimtask.dll`, `action.dll`, `fcurve.dll`, `chanmgr.dll`, `expressions.dll`, `fxcore.dll` … | CLSID `{5ad1fd80-5d5d-11d2-8082-00a0c955b335}` |
| `SaveKeyOnKeyable` | `pathanimtask.dll`, `action.dll`, `fcurve.dll`, `chanmgr.dll`, `expressions.dll`, `fxcore.dll` … | CLSID `{5ad1fd80-5d5d-11d2-8082-00a0c955b335}` |
| `Remove Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `RemoveKeyHotKeyProc` |
| `Toggle AutoKey` | `uixsiscripts.vbs` (VBScript) | `ToggleAutoKeyProc` |
| `RemoveKey` | `fcurve.dll` | CLSID `{5ad1fd81-5d5d-11d2-8082-00a0c955b335}` |
| `RemoveKeyOnKeyable` | `fcurve.dll` | CLSID `{5ad1fd81-5d5d-11d2-8082-00a0c955b335}` |
| `RemoveKeyOnMarkedKeyable` | `fcurve.dll` | CLSID `{5ad1fd81-5d5d-11d2-8082-00a0c955b335}` |
| `NextKey` | `fcurve.dll` | CLSID `{5ad1fd82-5d5d-11d2-8082-00a0c955b335}` |
| `PrevKey` | `fcurve.dll` | CLSID `{5ad1fd83-5d5d-11d2-8082-00a0c955b335}` |
| `LastKey` | `fcurve.dll` | CLSID `{ef512cf4-07d8-11d3-80d6-00a0c9ac19a9}` |
| `FirstKey` | `fcurve.dll` | CLSID `{ef512d00-07d8-11d3-80d6-00a0c9ac19a9}` |
| `Sequence` | `fcurve.dll`, `props.dll` | CLSID `{63b4d611-38cd-11d4-8bdb-009027bc381b}` |
| `SISequence` | `fcurve.dll`, `props.dll` | CLSID `{63b4d611-38cd-11d4-8bdb-009027bc381b}` |
| `ScaleAndOffset` | `fcurve.dll`, `props.dll` | CLSID `{63b4d611-38cd-11d4-8bdb-009027bc381b}` |
| `ActivateFCurve` | `fcurve.dll` | CLSID `{ab081aa2-10b5-4392-8a1d-bf44ac209826}` |
| `ActivateFCurveOnKeyable` | `fcurve.dll` | CLSID `{ab081aa2-10b5-4392-8a1d-bf44ac209826}` |
| `ActivateFCurveOnMarkedKeyable` | `fcurve.dll` | CLSID `{ab081aa2-10b5-4392-8a1d-bf44ac209826}` |
| `SetExpr` | `action.dll`, `fcurve.dll`, `imageclip.dll`, `activedb.dll`, `shaderhelper.dll`, `sicoresdk.dll` | CLSID `{7247ac41-db1d-11d2-a5fb-00a0c9ec5ef7}` |
| `AddExpr` | `uixsiscripts.vbs` (VBScript) | `AddExprProc` |
| `EditExpr` | `fcurve.dll` | CLSID `{0d24b3b6-1860-11d3-a60f-00a0c9ec5ef7}` |
| `SetRelativeValues` | `action.dll`, `fcurve.dll` | CLSID `{94d0dc72-1b48-11d3-a611-00a0c9ec5ef7}` |
| `SetMarking` | `fcurve.dll` | CLSID `{2062ade9-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `ClearMarking` | `fcurve.dll` | CLSID `{2062ade9-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `AddToMarking` | `fcurve.dll`, `sicoresdk.dll` | CLSID `{2062adf6-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `RemoveFromMarking` | `fcurve.dll`, `sicoresdk.dll` | CLSID `{2062ae02-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `GetMarking` | `fcurve.dll` | CLSID `{2062ae11-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `GetFCurveInfo` | `fcurve.dll` | CLSID `{e1d91ef4-1835-11d3-bc37-00a0c9612b97}` |
| `GetKeyInfo` | `fcurve.dll` | CLSID `{ee2f6429-1868-11d3-bc37-00a0c9612b97}` |
| `SetCurveType` | `fcurve.dll` | CLSID `{2062ae20-0a3b-11d3-80d7-00a0c9ac19a9}` |
| `SetKey` | `uixsiscripts.vbs` (VBScript) | `SISetKeyProc` |
| `ConnectSource` | `action.dll`, `fcurve.dll` | CLSID `{ec7663e9-2f0b-11d3-bffd-00a0248f9397}` |
| `EvalFCurve` | `fcurve.dll` | CLSID `{6913be21-7689-11d3-8d49-00609419fcaf}` |
| `CopyAnimContainer` | `fcurve.dll` | CLSID `{0e765af2-7b31-11d3-b4a2-00a02485cecb}` |
| `CopyAllAnimation` | `fcurve.dll` | CLSID `{77f8d68e-8f15-11d4-be8e-00a0c982ddd4}` |
| `CopyAnimation` | `fcurve.dll` | CLSID `{77f8d68e-8f15-11d4-be8e-00a0c982ddd4}` |
| `PasteAllAnimation` | `fcurve.dll` | CLSID `{77f8d68f-8f15-11d4-be8e-00a0c982ddd4}` |
| `PasteAnimation` | `fcurve.dll` | CLSID `{77f8d68f-8f15-11d4-be8e-00a0c982ddd4}` |
| `Save Zero Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `SaveZeroKeyHotKeyProc` |
| `Save Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `SaveKeyHotKeyProc` |
| `CopyKeys` | `action.dll`, `fcurve.dll` | CLSID `{cc482f24-4e8a-11d4-b270-00a0c9a8ad15}` |
| `CutKeys` | `action.dll`, `fcurve.dll` | CLSID `{cc482f25-4e8a-11d4-b270-00a0c9a8ad15}` |
| `DeleteKeys` | `action.dll`, `fcurve.dll` | CLSID `{cc482f25-4e8a-11d4-b270-00a0c9a8ad15}` |
| `PasteKeys` | `action.dll`, `fcurve.dll`, `uiut.dll` | CLSID `{cc482f26-4e8a-11d4-b270-00a0c9a8ad15}` |
| `SelectKeysInTimespan` | `fcurve.dll`, `dopesheet.dll` | CLSID `{1ca27ec8-31a3-4487-9d28-98c689ac500d}` |
| `DeselectAllKeys` | `fcurve.dll`, `dopesheet.dll` | CLSID `{1ca27ec8-31a3-4487-9d28-98c689ac500d}` |
| `CreateMarkingSet` | `animation.vbs` (VBScript) | `CreateMarkingSetProc` |
| `ActivateMarkingSet` | `animation.vbs` (VBScript) | `ActivateMarkingSetProc` |
| `DeleteMarkingSet` | `animation.vbs` (VBScript) | `DeleteMarkingSetProc` |
| `SetKeyUsingMarkingSet` | `animation.vbs` (VBScript) | `SetKeyUsingMarkingSetProc` |
| `GetNumRelativeValues` | `fcurve.dll` | CLSID `{7c40e3dc-47bc-4ca3-893d-8f38e21e9deb}` |
| `GetRelativeValue` | `fcurve.dll` | CLSID `{756b2c1a-835d-4083-ba74-3aeaa3dc7832}` |
| `RemoveRelativeValue` | `fcurve.dll` | CLSID `{b4015192-e0ff-4a28-bf8d-b5ee560deeed}` |
| `CreateCharacterKeySet` | `CharacterKeySets.vbs` (VBScript) | `CreateCharacterSetCommand` |
| `SetCurrentCharacterKeySet` | `CharacterKeySets.vbs` (VBScript) | `SetCurrentCharacterKeySetCommand` |
| `StoreShapeKey` | `action.dll` | CLSID `{12a3efd2-e543-11d2-b352-00105a1e6ce9}` |
| `SelectShapeKey` | `action.dll` | CLSID `{eaa03724-f9bd-11d2-9c61-0060970a2bc8}` |
| `ApplyShapeKey` | `action.dll` | CLSID `{12a3efd4-e543-11d2-b352-00105a1e6ce9}` |
| `ReplaceShapeKey` | `action.dll` | CLSID `{eaa03725-f9bd-11d2-9c61-0060970a2bc8}` |
| `CopyShape` | `action.dll` | CLSID `{7116d731-7ec0-11d4-9c8a-00d0b719049e}` |
| `ConvertShapeReferenceMode` | `action.dll` | CLSID `{b0adeabc-9e68-42a0-949a-116a0e31aeef}` |
| `LinkDeform` | `action.dll` | CLSID `{14fafb72-9954-48eb-8d61-ba60dea49dc7}` |
| `LinkDeformWithOri` | `action.dll` | CLSID `{14fafb72-9954-48eb-8d61-ba60dea49dc7}` |
| `SaveDeformKey` | `uixsiscripts.vbs` (VBScript) | `SaveDeformKeyProc` |
| `ApplyDeformKey` | `uixsiscripts.vbs` (VBScript) | `ApplyDeformKeyProc` |
| `Open SE for Link With Deform` | `action.dll` | CLSID `{e04f9e50-7db5-4ae8-a2b5-b62a9ac617a0}` |
| `OpenShapeEditor` | `uixsiscripts.vbs` (VBScript) | `OpenShapeEditorProc` |
| `StripDeformOperators` | `action.dll` | CLSID `{eaa03726-f9bd-11d2-9c61-0060970a2bc8}` |
| `SITransferShapeAnimation` | `optasks.dll`, `action.dll` | CLSID `{3b019512-6257-4a4d-b10e-8558ab464b55}` |
| `CreateShapeGroup` | `action.dll` | CLSID `{e2997ab9-1abd-4fa5-b883-57924b83b469}` |
| `SetShapeGroup` | `action.dll`, `sicoresdk.dll` | CLSID `{d7e2480b-7d29-4455-a82a-882835edb6d5}` |
| `SetSelFilter` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivatePolygonSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivatePolygonSelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateRaycastPolySelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateRaycastPolySelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateVertexSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateVertexSelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateEdgeSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateTipSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateEdgeSelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateRaycastEdgeSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateRaycastEdgeSelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateObjectSelTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateObjectSelToolWithNoObjStateChange` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `ActivateSelectTool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `TranslateTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `RotationTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `ScalingTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `LastTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `DirectManipTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairScalingTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairClumpTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairStandOnEndTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairPuffRootsTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairRotateRootTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairRotateTipTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `HairRotateCursorTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `AddParticleTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `SketchCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `AddPointOnCurveToolByKnotPoints` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `AddPointOnCurveToolByCVs` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `AddPointOnCurveToolByBezierKnotPoints` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Add Polygon Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Slice Polygons Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Add Edge Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `AddVertexTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `SplitEdgeTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Split Polygon Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `DelPointOnCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CVNURBSCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `NURBSCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `BezierCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `LinearCurveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Rectangle Select Tool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `Lasso Select Tool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `Freeform Select Tool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `Raycast Select Tool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `Rectangle Raycast Select Tool` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `Activate Current Select Tool using Filter` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamPanZoomTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamZoomTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamMayaZoomTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamRectZoomTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamOrbitTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamDollyTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamTrackTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamPivotTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamWalkTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamFlyTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamDriveTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamRollTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CamNavigTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Cam3dsMaxNavigTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Delete Components` | `toolmanager.dll` | CLSID `{0461b2bd-0ae3-11d2-8065-00a0c955b335}` |
| `ManipulateTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `DoNothing` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `TimeSliderTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `VirtualSliderTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Paint Properties` | `gap.dll` | CLSID `{a46e331f-75a4-11d2-85cb-00c04f8edf15}` |
| `PaintTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `PaintVertexColorTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `PaintTextureTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `ProbeMaterialTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `PaintSelectTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Paint Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `PaintPushTool` | `tools.vbs` (VBScript) | `PaintPushTool` |
| `Delete Objects Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `RenderRegionTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Add Surface Point Tool` | `toolmanager.dll` | CLSID `{0461b2bd-0ae3-11d2-8065-00a0c955b335}` |
| `Activate Group/Cluster Select Tool using Filter` | `selectionmgr.dll` | CLSID `{d9eb4110-dcac-11d2-8bd1-00aa006130ef}` |
| `PickDeformerByVertexTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `MoveComponent Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Move Component Tool` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `MovePointTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `TweakTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `TweakNormalsTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `WeldPointTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `CursorTransformTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `PropTransformTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `ToggleBooleanUserPref` | `uixsiscripts.vbs` (VBScript) | `ToggleBooleanUserPref` |
| `ToggleBooleanUserPrefProc` | `uixsiscripts.vbs` (VBScript) | `ToggleBooleanUserPrefProc` |
| `2D Chain Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `3D Chain Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `ToggleProjectionTool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Pick Session Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Escape Pick Session` | `toolmanager.dll` | CLSID `{0461b2bc-0ae3-11d2-8065-00a0c955b335}` |
| `ColorizeObject` | `tools.vbs` (VBScript) | `ColorizeObjectTool` |
| `ShadeObject` | `tools.vbs` (VBScript) | `ShadeObjectTool` |
| `Move Joint Tool` | `siuitasks.dll`, `tasks.dll`, `selectionmgr.dll`, `toolmanager.dll` | CLSID `{0461b2c6-0ae3-11d2-8065-00a0c955b335}` |
| `Show Previous Manipulator` | `manipmgr.dll` | CLSID `{0461b2c0-0ae3-11d2-8065-00a0c955b335}` |
| `Show Next Manipulator` | `manipmgr.dll` | CLSID `{0461b2c0-0ae3-11d2-8065-00a0c955b335}` |
| `MoveComponent` | `tasks.dll`, `imageclipeditor.dll`, `transformmanager.dll`, `viewinteraction.dll` | CLSID `{da55a811-5f86-11d2-b11c-00a0c906811e}` |
| `GetPrim` | `primitives.vbs` (VBScript) | `GetPrimProc` |
| `CreatePrim` | `primitives.vbs` (VBScript) | `CreatePrimProc` |
| `GetPresetModel` | `primitives.vbs` (VBScript) | `GetPresetModelProc` |
| `GetProportionalGuide` | `Charac_LoadBipedGuide.vbs` (VBScript) | `load_biped_guide` |
| `CreateHierarchyFromBiped` | `Charac_HierachyFromBiped.vbs` (VBScript) | `HierachyFromBipedProc` |
| `SIGetPrim` | (CLSID not specific to one binary) | CLSID `{29668d60-591f-11d1-bafa-444553540000}` |
| `SIGetRigidCns` | `primtasks.dll` | CLSID `{5b102c14-05e9-4285-a18b-3ccc5280dce3}` |
| `CreateMeshText` | `operators.vbs` (VBScript) | `TextToCurveListToMeshFunc` |
| `GetPrimLight` | `primitives.vbs` (VBScript) | `GetPrimLightProc` |
| `SIGetPrimLight` | `primtasks.dll`, `customdisplayhost.dll`, `xsievents.dll` | CLSID `{af3aae91-d26f-11d2-a019-0000f875df68}` |
| `SIGetPrimSpotLight` | `primtasks.dll` | CLSID `{6b0736c4-82f0-11d2-88ad-00a0c9067c03}` |
| `GetPrimCamera` | `primitives.vbs` (VBScript) | `GetPrimCameraProc` |
| `Get default camera` | `primitives.vbs` (VBScript) | `GetPrimCameraDefaultProc` |
| `SIGetPrimCamera` | `primtasks.dll`, `customdisplayhost.dll`, `xsievents.dll` | CLSID `{c2051a90-7a6e-11d2-a938-00a024190119}` |
| `GetPrimLattice` | `primitives.vbs` (VBScript) | `GetPrimLatticeProc` |
| `SIGetPrimLattice` | `primtasks.dll`, `sicoresdk.dll` | CLSID `{afd20460-83db-11d2-a939-00a024190119}` |
| `GetPrimVolumeDeform` | `primitives.vbs` (VBScript) | `GetPrimVolumeDeformProc` |
| `SIGetPrimVolumeDeform` | `primtasks.dll` | CLSID `{7f788cdc-3943-4e9d-839d-b26dc86054a8}` |
| `GetPrimWave` | `primitives.vbs` (VBScript) | `GetPrimWaveProc` |
| `UIAssembleNurbsMesh` | `uixsiscripts.vbs` (VBScript) | `UIAssembleNurbsMeshProc` |
| `SIAssembleNurbsMesh` | `primtasks.dll` | CLSID `{e900e81a-1449-11d3-b803-00a0243e3694}` |
| `GetNbTriangles` | `primtasks.dll` | CLSID `{9a88ed34-d7fb-11d3-b497-009027bc38d5}` |
| `ImportEPS` | `primtasks.dll` | CLSID `{65cc25d5-8d3f-4054-ac6d-0b3d4ca4abe6}` |
| `GetURLAt` | `primtasks.dll` | CLSID `{fac83696-47a1-40fe-86db-dde2a087bdd5}` |
| `AddAudioClip` | `moaudio.dll` | CLSID `{11b04f15-0353-11d3-b646-006094eb029c}` |
| `ImportAudio` | `moaudio.dll` | CLSID `{11b04f16-0353-11d3-b646-006094eb029c}` |
| `SIAddImageSourceOp` | `imageclip.dll` | CLSID `{041f67fd-53f8-43d7-95ec-69671c7925b4}` |
| `SIAddImageOp` | `imageclip.dll` | CLSID `{327d6270-8007-4524-982c-e1775b1bbed6}` |
| `SIAddImageSource` | `modeltasks.dll`, `imageclip.dll`, `shaderhelper.dll` | CLSID `{0f42cf75-1de8-11d3-b37a-00105a1e70de}` |
| `SIAddWritableImageSource` | `imageclip.dll` | CLSID `{a7fdb2d1-73f0-486a-ac47-621f31517299}` |
| `SIAddImageClip` | `modeltasks.dll`, `shadertasks.dll`, `imageclip.dll`, `shaderhelper.dll` | CLSID `{eef8d702-1ebe-11d3-b37a-00105a1e70de}` |
| `SICreateImageClip` | `imageclip.dll`, `shaderhelper.dll`, `sparks.dll`, `spreadsheet.dll`, `si3dobjectmodel.dll` | CLSID `{e2be2c7c-364b-11d3-b37b-00105a1e70de}` |
| `SICreateImageClip2` | `imageclip.dll`, `shaderhelper.dll`, `sparks.dll`, `spreadsheet.dll`, `si3dobjectmodel.dll` | CLSID `{e2be2c7c-364b-11d3-b37b-00105a1e70de}` |
| `SICreateDefaultImageClip` | `imageclip.dll`, `shaderhelper.dll`, `sparks.dll`, `spreadsheet.dll`, `si3dobjectmodel.dll` | CLSID `{e2be2c7c-364b-11d3-b37b-00105a1e70de}` |
| `SetImageSource` | `imageclip.dll` | CLSID `{9ce3bb3a-388b-11d3-b37b-00105a1e70de}` |
| `CreateImageClip` | `uixsiscripts.vbs` (VBScript) | `CreateImageClipProc` |
| `AddImageClip` | `uixsiscripts.vbs` (VBScript) | `AddImageClipProc` |
| `Clip` | `imageclip.dll` | CLSID `{5faa89b0-acbc-11d3-b4b1-009027bc38d5}` |
| `SIAddModelSource` | `imageclip.dll` | CLSID `{be75f460-439c-11d4-b989-009027bc3e07}` |
| `SICreateModelClip` | `imageclip.dll` | CLSID `{be75f461-439c-11d4-b989-009027bc3e07}` |
| `SIAddModelClip` | `imageclip.dll` | CLSID `{be5455b0-45e2-11d4-b989-009027bc3e07}` |
| `ExportMaterialLibrary` | `modeltasks.dll`, `imageclip.dll` | CLSID `{200bfe4d-e316-4464-a9a5-fde08f290898}` |
| `AssignMaterial` | `uixsiscripts.vbs` (VBScript) | `AssignMaterialProc` |
| `UnAssignMaterial` | `uixsiscripts.vbs` (VBScript) | `UnAssignMaterialProc` |
| `ExportImageClip` | `vm.dll` | CLSID `{f7c3aa73-4d27-4333-a281-3774a90b194b}` |
| `CreateLibrary` | `modeltasks.dll`, `imageclip.dll` | CLSID `{00f3ee76-b355-4c3d-bc54-45db22466e30}` |
| `MoveToLibrary` | `imageclip.dll` | CLSID `{adf52b4f-f0f3-40ad-ae77-d079ca84f3b6}` |
| `SetCurrentMaterialLibrary` | `modeltasks.dll`, `imageclip.dll` | CLSID `{e9e64654-0032-4193-87a0-310a9612df72}` |
| `GetLightListOnModelClip` | `modeltasks.dll` | CLSID `{ae697746-da60-44d3-a9fe-1895286de460}` |
| `SetLightListOnModelClip` | `modeltasks.dll` | CLSID `{e10a6971-7a7b-4021-9239-3508fdede180}` |
| `AddFileCacheSource` | `imageclip.dll`, `environments.dll` | CLSID `{5b3f5d9d-5c76-4c97-bd68-2e451d3b342e}` |
| `AddFileCacheSource2` | `imageclip.dll`, `environments.dll` | CLSID `{5b3f5d9d-5c76-4c97-bd68-2e451d3b342e}` |
| `NextFrame` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PrevFrame` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `FirstFrame` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `LastFrame` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayFrame` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayRealTime` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlaybackStop` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayForwards` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayBackwards` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayRealTimeFromStart` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayForwardsFromStart` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `PlayBackwardsFromEnd` | `mcp.dll` | CLSID `{9ff65990-22a3-11d3-bff8-00a0248f9397}` |
| `StartTimedPlayback` | `vm.dll` | CLSID `{f8b60ef4-7ec2-11d3-8e88-00a0c982dd9a}` |
| `Refresh` | `tasks.dll` | CLSID `{1600581c-1a86-11d3-bc37-00a0c9612b97}` |
| `DelayedRefresh` | `tasks.dll` | CLSID `{c57f98e2-6a92-4328-b7c1-692aed6b130a}` |
| `UnhideAll` | `layers.vbs` (VBScript) | `UnhideAllProc` |
| `UnghostAll` | `layers.vbs` (VBScript) | `UnhideAllProc` |
| `HideAndUnselect` | `layers.vbs` (VBScript) | `HideAndUnselectProc` |
| `HideUnselected` | `layers.vbs` (VBScript) | `HideUnselectedProc` |
| `SIHideObjects` | `layers.vbs` (VBScript) | `HideObjectsProc` |
| `SIUnhideObjects` | `layers.vbs` (VBScript) | `UnhideObjectsProc` |
| `CameraReset` | `vm.dll` | CLSID `{0461b2b4-0ae3-11d2-8065-00a0c955b335}` |
| `CameraUndo` | `vm.dll` | CLSID `{41973541-1cf0-4935-abf2-1ef3f1a71db4}` |
| `Undo Camera (alternate)` | `uixsiscripts.vbs` (VBScript) | `CameraUndoProc` |
| `CameraRedo` | `vm.dll` | CLSID `{0f2e5216-a4ff-435f-a934-eb69d88395f9}` |
| `Redo Camera (alternate)` | `uixsiscripts.vbs` (VBScript) | `CameraRedoProc` |
| `GetViewCamera` | `vm.dll` | CLSID `{8d8bbbd5-af43-45ea-853d-a31a47109cf2}` |
| `GetViewIndex` | `vm.dll` | CLSID `{1b211a79-d67f-4b2f-b8cc-8f4027f126cd}` |
| `SaveFastPlaybackCache` | `vm.dll` | CLSID `{4927de03-3e0e-4126-8d59-6d34ce0b7ddd}` |
| `LoadFastPlaybackCache` | `vm.dll` | CLSID `{b613c9a6-acb1-4a63-a674-d64609dbefc0}` |
| `ViewTranslate` | `vm.dll` | CLSID `{ad992d4b-5d42-431b-959e-d569b6495687}` |
| `ViewNudgeLeft` | `vm.dll` | CLSID `{ad992d4b-5d42-431b-959e-d569b6495687}` |
| `ViewNudgeRight` | `vm.dll` | CLSID `{ad992d4b-5d42-431b-959e-d569b6495687}` |
| `ViewNudgeUp` | `vm.dll` | CLSID `{ad992d4b-5d42-431b-959e-d569b6495687}` |
| `ViewNudgeDown` | `vm.dll` | CLSID `{ad992d4b-5d42-431b-959e-d569b6495687}` |
| `SetViewDisplayMode` | `uixsiscripts.vbs` (VBScript) | `SetViewDisplayModeProc` |
| `ToggleHeadlightDisplayMode` | `uixsiscripts.vbs` (VBScript) | `ToggleHeadlightDisplayModeProc` |
| `ToggleViewDisplayMode` | `uixsiscripts.vbs` (VBScript) | `ToggleViewDisplayModeProc` |
| `ToggleWireOnShadedDisplay` | `uixsiscripts.vbs` (VBScript) | `ToggleWireOnShadedDisplayProc` |
| `FrameSelection` | `vm.dll` | CLSID `{0461b2b6-0ae3-11d2-8065-00a0c955b335}` |
| `FrameContextual` | `vm.dll` | CLSID `{248c1d05-7023-4107-bb0f-905b655e0dc8}` |
| `CenterSelection` | `vm.dll` | CLSID `{d048b3fd-8bcd-4292-83c9-3b93eea82ea2}` |
| `FrameAll` | `vm.dll` | CLSID `{0461b2b6-0ae3-11d2-8065-00a0c955b335}` |
| `Toggle Manipulator mode` | `manipmgr.dll` | CLSID `{0461b2c4-0ae3-11d2-8065-00a0c955b335}` |
| `Frame Selection` | `vm.dll` | CLSID `{0461b2b6-0ae3-11d2-8065-00a0c955b335}` |
| `Frame Contextual` | `vm.dll` | CLSID `{248c1d05-7023-4107-bb0f-905b655e0dc8}` |
| `Center Selection` | `vm.dll` | CLSID `{d048b3fd-8bcd-4292-83c9-3b93eea82ea2}` |
| `Hide Back Facing Polygons` | `vm.dll` | CLSID `{0461b2c1-0ae3-11d2-8065-00a0c955b335}` |
| `Frame All` | `vm.dll` | CLSID `{0461b2b6-0ae3-11d2-8065-00a0c955b335}` |
| `Show/Hide Grid` | `vm.dll` | CLSID `{0461b2c2-0ae3-11d2-8065-00a0c955b335}` |
| `Toggle Field Guide` | `uixsiscripts.vbs` (VBScript) | `ToggleFieldGuideProc` |
| `Toggle Pixel Zoom` | `vm.dll` | CLSID `{6399a7e0-50dc-4731-bd1f-1a874c17d35b}` |
| `Zoom In` | `vm.dll` | CLSID `{553c67a0-c71d-4e6d-b862-80d0bc44c03c}` |
| `Zoom Out` | `vm.dll` | CLSID `{553c67a0-c71d-4e6d-b862-80d0bc44c03c}` |
| `SetViewCamera` | `vm.dll` | CLSID `{c6f8fc98-6363-4661-aa78-c92d895b75aa}` |
| `AlignViewCamera` | `vm.dll` | CLSID `{075fb349-89bd-42fa-8d2d-b9e83c0f284d}` |
| `Top View` | `uixsiscripts.vbs` (VBScript) | `TopViewProc` |
| `Bottom View` | `uixsiscripts.vbs` (VBScript) | `BottomViewProc` |
| `Right View` | `uixsiscripts.vbs` (VBScript) | `RightViewProc` |
| `Left View` | `uixsiscripts.vbs` (VBScript) | `LeftViewProc` |
| `Front View` | `uixsiscripts.vbs` (VBScript) | `FrontViewProc` |
| `Back View` | `uixsiscripts.vbs` (VBScript) | `BackViewProc` |
| `Isometric View` | `uixsiscripts.vbs` (VBScript) | `IsometricViewProc` |
| `Perspective View` | `uixsiscripts.vbs` (VBScript) | `PerspectiveViewProc` |
| `Scene Camera View` | `uixsiscripts.vbs` (VBScript) | `SceneCameraViewProc` |
| `IsolateSelected` | `vm.dll` | CLSID `{93c85bba-fbca-41a0-80e2-c2c9e5fada31}` |
| `IsolateAddSelected` | `vm.dll` | CLSID `{93c85bba-fbca-41a0-80e2-c2c9e5fada31}` |
| `IsolateRemoveSelected` | `vm.dll` | CLSID `{93c85bba-fbca-41a0-80e2-c2c9e5fada31}` |
| `IsolateToggleSelected` | `vm.dll` | CLSID `{93c85bba-fbca-41a0-80e2-c2c9e5fada31}` |
| `IsolateAll` | `vm.dll` | CLSID `{93c85bba-fbca-41a0-80e2-c2c9e5fada31}` |
| `Maximize/Restore Current Viewport` | `vm.dll` | CLSID `{ff811500-0d20-11d3-bfe5-00a0248f9397}` |
| `Camera Visibility Options` | `vm.dll` | CLSID `{6ff26831-0d57-11d3-bfe5-00a0248f9397}` |
| `ToggleMuteSolo` | `vm.dll` | CLSID `{7ad7df80-1441-11d3-bfec-00a0248f9397}` |
| `CaptureViewport` | `vm.dll` | CLSID `{f8b60ef4-7ec2-11d3-8e88-00a0c982dd9a}` |
| `SwitchToolbar` | `toolbarobj.dll` | CLSID `{b5c21641-0f82-11d3-bfe8-00a0248f9397}` |
| `OpenICETreeView` | `uixsiscripts.vbs` (VBScript) | `OpenICETreeProc` |
| `Cut` | `tasks.dll`, `xsievents.dll` | CLSID `{ec7663e5-2f0b-11d3-bffd-00a0248f9397}` |
| `Copy` | `tasks.dll` | CLSID `{ec7663e4-2f0b-11d3-bffd-00a0248f9397}` |
| `Paste` | `tasks.dll`, `xsievents.dll` | CLSID `{ec7663e6-2f0b-11d3-bffd-00a0248f9397}` |
| `CopyPaste` | `optasks.dll`, `tasks.dll`, `actioncore.dll` | CLSID `{2c8a5f31-8556-11d3-b4a2-00a02485cecb}` |
| `AddToTOC` | `tasks.dll`, `action.dll` | CLSID `{bd02d462-9240-11d3-b4a8-009027bc38d5}` |
| `OpenAnimationEditor` | `siviewtasks.dll` | CLSID `{a64dac70-1e45-11d5-bced-00d0b719022b}` |
| `OpenNetView` | `siviewtasks.dll` | CLSID `{c7461ff7-d02c-438a-a507-d4ebd588ef6f}` |
| `SetDisplayMode` | `uixsiscripts.vbs` (VBScript) | `SetDisplayMode` |
| `ToggleValue` | `uixsiscripts.vbs` (VBScript) | `ToggleValueProc` |
| `ResetAllViews` | `vm.dll` | CLSID `{0461b2b4-0ae3-11d2-8065-00a0c955b335}` |
| `` | `tasks.dll` | CLSID `{82382d12-3bf6-11d4-bc93-00d0b719022b}` |
| `Show3DContextMenu` | `vm.dll` | CLSID `{0fd6b0ba-6d51-11d4-a8c2-00c04f8edf15}` |
| `ImportPrefs` | `tasks.dll` | CLSID `{4a4c8cc1-a451-11d4-b4b0-00d0b71903e4}` |
| `RunPerformanceTest` | `tasks.dll`, `gppgcmdlauncherctrl.dll` | CLSID `{0ed17cf6-d6a3-4b06-ba4d-9be4b7924df9}` |
| `AddUserTab` | `siuitasks.dll` | CLSID `{f4b294dd-2e8f-422a-a10f-f0e9a1c6ee4c}` |
| `AddUserKeyword` | `siuitasks.dll` | CLSID `{f4b294dd-2e8f-422a-a10f-f0e9a1c6ee4c}` |
| `GetFocusedViewport` | `uixsiscripts.vbs` (VBScript) | `ViewMgrViewportProc` |
| `SetDropMessage` | `tasks.dll` | CLSID `{e0a73360-723e-4ec6-9b76-d27aa77c7eb7}` |
| `ResetDirectX` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `SIMergeScene` | `modeltasks.dll` | CLSID `{81ab7cd1-2262-11d3-b949-00a024c78ee3}` |
| `MarkObjectDirty` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `NewScene` | `tasks.dll` | CLSID `{6e4d3de5-5ad1-48fa-9811-49f8be59a576}` |
| `SaveSceneAs` | `tasks.dll` | CLSID `{b8686985-61cf-11d5-ad17-0090275802bf}` |
| `SaveScene` | `tasks.dll` | CLSID `{973f7447-bd33-4349-9d59-d1c9cad1b3a3}` |
| `SaveBackupScene` | `tasks.dll` | CLSID `{f2ddabc1-983c-4f6b-8998-26da7e72f47f}` |
| `OpenScene` | `tasks.dll` | CLSID `{fcad9bc1-645a-11d5-ad18-0090275802bf}` |
| `CopyExtFilesIntoProject` | `modeltasks.dll`, `tasks.dll` | CLSID `{cf8c9f24-9d07-11d3-b96b-009027bc3e07}` |
| `CopyCacheFiles` | `tasks.dll` | CLSID `{0e36c4ee-ef78-4f41-b381-2e960ff33d68}` |
| `DumpCacheHeader` | `tasks.dll` | CLSID `{46a94ed1-aa64-4832-836b-7242f5c7b276}` |
| `CopyCacheFiles2` | `tasks.dll` | CLSID `{d8c94826-abd7-4d76-8cf2-fa206ad224bb}` |
| `CacheObjectsIntoFile` | `simulation.vbs` (VBScript) | `CacheObjectsIntoFileProc` |
| `CacheObjectsIntoFile_Private` | `tasks.dll` | CLSID `{4c0c8234-baaa-4a8f-a94c-5e890b1e1785}` |
| `ApplySoftBody` | `particle.vbs` (VBScript) | `ApplySoftBodyProc` |
| `ApplyCloth` | `particle.vbs` (VBScript) | `ApplyClothProc` |
| `ApplyParticleShader` | `particle.vbs` (VBScript) | `ApplyParticleShaderProc` |
| `ConnectWeightMapToComponent` | `sparks.dll` | CLSID `{6f83fddc-ae40-11d3-affb-0050da2873c1}` |
| `ConnectParticleInitState` | `sparks.dll` | CLSID `{d3b53df8-39b4-4c0c-b175-7a0daaa627be}` |
| `DisconnectParticleInitState` | `sparks.dll` | CLSID `{12291e58-62b3-46f3-9980-22ef0a372fbc}` |
| `SetParticleInitState` | `sparks.dll` | CLSID `{21bc9523-f52e-47a3-9595-85c859fd995d}` |
| `UpdateParticleTypeConnections` | `optasks.dll`, `activedb.dll`, `sparks.dll` | CLSID `{4b5e7344-9b4d-4f34-bb1a-075a7a9886e0}` |
| `AddParticleEmitter` | `sparks.dll` | CLSID `{d9a016a1-451e-11d3-800a-00a0248f9397}` |
| `AddParticleObstacle` | `sparks.dll` | CLSID `{e46afe32-48ff-11d3-8a87-00a024197c03}` |
| `AddClothClusters` | `sparks.dll` | CLSID `{cfdc1390-8aaa-11d4-a256-00d0b7190223}` |
| `SIAddParticleEvent` | `activedb.dll`, `sparks.dll` | CLSID `{09bfd8e3-42fe-11d4-a961-00c04f8edeb9}` |
| `AddParticles` | `sparks.dll`, `viewinteraction.dll` | CLSID `{4cb50c6f-4a51-46bc-a4db-b06c09b0f197}` |
| `SetParticleType` | `sparks.dll` | CLSID `{ba486ded-46ea-11d4-a961-00c04f8edeb9}` |
| `CreateParticleType` | `sparks.dll` | CLSID `{09bfd8e4-42fe-11d4-a961-00c04f8edeb9}` |
| `CreateForce` | `particle.vbs` (VBScript) | `CreateForceProc` |
| `SIAddParticleGoal` | `sparks.dll` | CLSID `{1a41b159-1366-4511-84e6-80d7f751e728}` |
| `SIAddParticleForce` | `forces.dll`, `sicoresdk.dll` | CLSID `{4cfc0e50-e434-11d5-a281-00d0b7190223}` |
| `CreateEventSource` | `sparks.dll` | CLSID `{68f37254-3a7d-4739-843d-05eaf66343cf}` |
| `SetEventObstacle` | `activedb.dll`, `sparks.dll` | CLSID `{266f48d4-8ddd-40ac-a3b0-99c2bbd841a0}` |
| `SetCurrentParType` | `tasks.dll`, `viewinteraction.dll` | CLSID `{2f76bc8f-f028-11d2-ac7c-00a02485cecb}` |
| `AddUserParameter` | `sparks.dll`, `sicoresdk.dll` | CLSID `{a289896c-c37f-40cf-b471-2b57b4f3fcb8}` |
| `RemoveUserParameter` | `sparks.dll`, `sicoresdk.dll` | CLSID `{e8b1490d-8471-4e7a-94ba-5295e1bb7980}` |
| `Particle Type Pop-up Menu` | `tasks.dll` | CLSID `{025698cb-cc9f-48b4-b196-b631960e5c4b}` |
| `Event Pop-up Menu` | `tasks.dll` | CLSID `{ca5c1755-7e4f-4d48-8a61-f33e2a605c43}` |
| `Goal Pop-up Menu` | `tasks.dll` | CLSID `{10fd904a-159a-4118-b255-c69244eccd6a}` |
| `Obstalce Pop-up Menu` | `tasks.dll` | CLSID `{8fbbf318-15f8-4e96-8c09-92fbe12bfef7}` |
| `Emission Pop-up Menu` | `tasks.dll` | CLSID `{f036a29f-357a-4be7-bef6-16f4238cedfa}` |
| `Force Pop-up Menu` | `tasks.dll` | CLSID `{e6d29635-a3a0-4d60-88e8-5e86605360cb}` |
| `CreateFramebuffer` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{16da976b-687f-43eb-8a05-c30e7e1752f7}` |
| `CreateRenderChannel` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{fda875ff-245b-4dd9-a52c-3dbbb8f60167}` |
| `RemoveRenderChannel` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{63ea7a1d-2ade-424c-8aa6-9962014d252f}` |
| `SICreatePass` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{8df69d1c-68a0-487a-bbf6-395a39040b5e}` |
| `CreatePass` | `Rendering.vbs` (VBScript) | `CreatePassProc` |
| `CreatePassFromLayers` | `Rendering.vbs` (VBScript) | `CreatePassFromLayersProc` |
| `CreateImageBasedLightingPass` | `Rendering.vbs` (VBScript) | `CreateImageBasedLightingPass` |
| `GetCurrentPass` | `tasks.dll` | CLSID `{2f76bc83-f028-11d2-ac7c-00a02485cecb}` |
| `SetCurrentPass` | `tasks.dll`, `viewinteraction.dll` | CLSID `{2f76bc8f-f028-11d2-ac7c-00a02485cecb}` |
| `DeleteCurrentPass` | (CLSID not specific to one binary) | CLSID `{dd531990-ccc2-11d2-ac73-00a02485cecb}` |
| `SICreateEmptyPartition` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{075d89ea-2e77-47a3-b5cb-7f714aef264a}` |
| `CreatePartition` | `Rendering.vbs` (VBScript) | `CreatePartitionProc` |
| `CopyPartition` | `rendercore.dll` | CLSID `{0ee6c6df-96f5-4b4d-ac9b-f5053b033157}` |
| `MoveToPartition` | `rendercore.dll` | CLSID `{bb1fd79d-2945-421e-b9f4-05648b1f4d54}` |
| `RenderAllPasses` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `RenderPasses` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `RenderPassesFrameSet` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `RenderSelectedPasses` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `ExportRenderArchiveAllPasses` | `rendercore.dll` | CLSID `{c2906297-0edf-42df-a611-367520adc2e5}` |
| `ExportRenderArchive` | `rendercore.dll` | CLSID `{c2906297-0edf-42df-a611-367520adc2e5}` |
| `ExportRenderArchiveFrameSet` | `rendercore.dll` | CLSID `{c2906297-0edf-42df-a611-367520adc2e5}` |
| `ExportObjectRenderArchive` | `rendercore.dll` | CLSID `{caae1591-2682-4475-bce9-27982365870f}` |
| `RenderRegionCreate` | `rendercore.dll` | CLSID `{0e8b832b-771e-4401-9da1-d38319555528}` |
| `RenderRegionClose` | `rendercore.dll` | CLSID `{ed9ad458-288e-4ab1-9ccb-3055acd43f42}` |
| `RenderRegionToggleVisibility` | `rendercore.dll` | CLSID `{8eb36c47-f274-4db5-b865-1c830e58c94d}` |
| `RenderRegionRefresh` | `rendercore.dll` | CLSID `{73c236cc-0ae6-471f-9ca6-4f2d43436216}` |
| `RenderRegionToggleAutoRefresh` | `rendercore.dll` | CLSID `{7397235e-40ea-4e67-8c2d-b4870d3ee2ab}` |
| `RenderRegionToggleSelectionTracking` | `rendercore.dll` | CLSID `{b8111b1f-3e61-46aa-9937-295b9bed883c}` |
| `RenderRegionSave` | `siuitasks.dll`, `rendercore.dll` | CLSID `{8ab0e935-9a8d-4027-9d44-f78e8b0edfad}` |
| `RenderRegionSetDisplayType` | `rendercore.dll` | CLSID `{e05bf051-f510-4b48-b1b0-2138e3d6dd28}` |
| `RenderRegionGetDisplayType` | `rendercore.dll` | CLSID `{22d5b7bd-0a2a-46b1-9cec-19ed299db86f}` |
| `RenderRegionSetRefreshMode` | `rendercore.dll` | CLSID `{23366fa3-73f6-4f9e-8d67-60c899fa07fa}` |
| `RenderRegionGetRefreshMode` | `rendercore.dll` | CLSID `{fe8e6c35-ca2a-4bb8-9a9f-6903e08919e8}` |
| `RenderRegionSetRenderChannel` | `rendercore.dll` | CLSID `{d2db1c46-30dd-49c1-b288-e7a52237cc26}` |
| `RenderRegionGetRenderChannel` | `rendercore.dll` | CLSID `{9fe194dc-eb14-426e-9bec-abf4aa90bbdf}` |
| `DisposeRenderingCache` | (CLSID not specific to one binary) | CLSID `{884a8a54-6fb4-4e0b-99b3-0ba353ff7277}` |
| `InspectViewportRenderRegionOptions` | `Rendering.vbs` (VBScript) | `InspectViewportRenderRegionOptionsProc` |
| `Frame Preview Active Camera` | `Rendering.vbs` (VBScript) | `FramePreviewActiveCameraProc` |
| `Flipbook` | `vm.dll` | CLSID `{f8b60ef4-7ec2-11d3-8e88-00a0c982dd9a}` |
| `RegenerateMaps` | `rendercore.dll` | CLSID `{81518c0b-2be4-46b8-a5d2-624edc7d71ab}` |
| `LightAssociate` | `Rendering.vbs` (VBScript) | `LightAssociateProc` |
| `CreateLightRigFromImage` | `Rendering.vbs` (VBScript) | `CreateLightRigFromImage` |
| `RenderPass` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `SIRenderPass` | `rendercore.dll` | CLSID `{789e9083-fc7a-4e23-845f-404369ad25e8}` |
| `RenderPassToggleShowRenderedImage` | `rendercore.dll` | CLSID `{4dd638c4-f560-4a7d-8902-aa297361a1be}` |
| `CreateProjection` | `Texture.vbs` (VBScript) | `CreateProjectionProc` |
| `ConnectToSupport` | `Texture.vbs` (VBScript) | `ConnectToSupportProc` |
| `ConnectToProjection` | `Texture.vbs` (VBScript) | `ConnectToProjectionProc` |
| `SIGetTextureUVDomains` | `primtasks.dll` | CLSID `{c781dcf0-d426-11d3-9e9e-009027bc38dd}` |
| `SIFindUniqueTextureName` | `primtasks.dll`, `propertytasks.dll` | CLSID `{569410a0-88a2-11d3-bc5a-00a0c9612b97}` |
| `SIConnectToSupport` | `primtasks.dll`, `action.dll` | CLSID `{7f6f4436-c668-11d2-8250-00a0c982dd9a}` |
| `SIConnectToProjection` | `primtasks.dll` | CLSID `{9d173301-324f-11d4-ae61-00a0c96e63e1}` |
| `SICameraTextureProj` | `primtasks.dll` | CLSID `{38f8038e-4f55-11d3-b0c9-00a0c982dd9a}` |
| `SICreateTextureUVDomain` | `primtasks.dll`, `si3dobjectmodel.dll` | CLSID `{84fad572-857e-11d2-a939-00a024190119}` |
| `SICreateTextureSpatial` | `primtasks.dll` | CLSID `{54e02e68-09fa-4972-8383-4d956eeffe4c}` |
| `SICreateTextureBasicGeo` | `primtasks.dll`, `si3dobjectmodel.dll` | CLSID `{84fad570-857e-11d2-a939-00a024190119}` |
| `SICreateTexturePureImplicit` | `primtasks.dll` | CLSID `{49c078d0-4bad-11d4-ae65-00a0c96e63e1}` |
| `FreezeUVWTransformation` | `Texture.vbs` (VBScript) | `SIFreezeUVWTransformationProc` |
| `GenerateUniqueUVs` | `Texture.vbs` (VBScript) | `GenerateUniqueUVsProc` |
| `GenerateUVSetByContourStretching` | `Texture.vbs` (VBScript) | `GenerateUVSetByContourStretchingProc` |
| `SICreateTextureProj` | `primtasks.dll`, `si3dobjectmodel.dll` | CLSID `{84fad570-857e-11d2-a939-00a024190119}` |
| `CreateTextureSupport` | `Texture.vbs` (VBScript) | `CreateTextureSupportProc` |
| `HealUVW` | `primtasks.dll` | CLSID `{e06b57d2-a59c-4a1b-87cd-56f9d77c32b3}` |
| `IslandHealUVW` | `Texture.vbs` (VBScript) | `IslandHealUVWProc` |
| `CycleUVW` | `primtasks.dll` | CLSID `{bde6f551-fdb8-46ef-9fb0-dc4df94c547d}` |
| `FlipUVW` | `primtasks.dll` | CLSID `{1ddc14e2-67db-43b4-9605-6d3e84ec8c5e}` |
| `RelaxUVW` | `primtasks.dll` | CLSID `{db7c3b91-2e81-4f2d-90f1-d941b298370d}` |
| `MatchUVW` | `primtasks.dll` | CLSID `{4a50f2fd-31c9-4323-b49f-2eeaf3ef7ef1}` |
| `CopyUVW` | `tasks.dll` | CLSID `{a1c9cbeb-2a8e-40d5-93e1-12e142a01c94}` |
| `PasteUVW` | `tasks.dll` | CLSID `{594ea9c2-b64c-499f-9ae3-ba03147ab375}` |
| `Create2DMap` | `propertytasks.dll` | CLSID `{3aece858-543f-11d5-b0c3-00a0c982e397}` |
| `Create2DMapWithProjection` | `propertytasks.dll` | CLSID `{8d9c7d7d-547c-11d5-b0c3-00a0c982e397}` |
| `ChangeUVInput` | `primtasks.dll` | CLSID `{21bb3f0a-e163-475b-b411-8bd9dcc39a5d}` |
| `SwimUVW` | `Texture.vbs` (VBScript) | `SwimUVWProc` |
| `StickUVW` | `Texture.vbs` (VBScript) | `StickUVWProc` |
| `ReprojectUVW` | `Texture.vbs` (VBScript) | `ReprojectUVWProc` |
| `InspectUVW` | `Texture.vbs` (VBScript) | `InspectUVWProc` |
| `InspectAllUVW` | `Texture.vbs` (VBScript) | `InspectAllUVWProc` |
| `PinUVComponents` | `tasks.dll`, `sicoresdk.dll` | CLSID `{00bef78c-5d15-4cec-8038-d31c6c7f4fb2}` |
| `PinAllUVComponents` | `tasks.dll`, `sicoresdk.dll` | CLSID `{00bef78c-5d15-4cec-8038-d31c6c7f4fb2}` |
| `UnPinUVComponents` | `tasks.dll`, `sicoresdk.dll` | CLSID `{00bef78c-5d15-4cec-8038-d31c6c7f4fb2}` |
| `UnPinAllUVComponents` | `tasks.dll`, `sicoresdk.dll` | CLSID `{00bef78c-5d15-4cec-8038-d31c6c7f4fb2}` |
| `SICreateModel` | `modeltasks.dll`, `primtasks.dll`, `imageclip.dll`, `converter.dll`, `customdisplayhost.dll`, `xsievents.dll` … | CLSID `{bcb70445-0a0d-11d3-ac82-00a02485cecb}` |
| `CreateModel` | `Model.vbs` (VBScript) | `CreateModelProc` |
| `ExportModel` | `modeltasks.dll`, `_3dobject2.dll` | CLSID `{4e8acff0-7767-11d3-8902-00a024ee6238}` |
| `SIImportModel` | `modeltasks.dll`, `imageclip.dll`, `_3dobject2.dll`, `factorydisplay.dll`, `shaderballmanager.dll` | CLSID `{dafd4082-7c00-11d3-8907-00a024ee6238}` |
| `ImportModel` | `Model.vbs` (VBScript) | `ImportModelProc` |
| `ImportRefModels` | `Model.vbs` (VBScript) | `ImportRefModelsProc` |
| `SIGetModel` | `modeltasks.dll` | CLSID `{5b56d822-93da-11d3-acaf-0090275802bf}` |
| `SIImportIges` | `modeltasks.dll` | CLSID `{1579fa20-95f0-11d3-a9a6-009027bc65d7}` |
| `SIExportIges` | `modeltasks.dll` | CLSID `{4b30f510-9d36-11d3-a9a9-009027bc65d7}` |
| `UpdateReferencedModel` | `Model.vbs` (VBScript) | `UpdateReferencedModelProc` |
| `MakeModelLocal` | `Model.vbs` (VBScript) | `MakeModelLocalProc` |
| `SIImportDotXSIFile` | `modeltasks.dll`, `imageclip.dll`, `_3dobject2.dll` | CLSID `{25dca0f7-a6cb-11d4-b7a4-00a0c9ec5ea3}` |
| `SIExportDotXSIFile` | `modeltasks.dll`, `_3dobject2.dll` | CLSID `{c73a9270-bca4-11d4-b7a8-00a0c9ec5ea3}` |
| `ExportMixer` | `modeltasks.dll`, `imageclip.dll`, `_3dobject2.dll` | CLSID `{a742f55c-35ca-11d6-92de-009027219f81}` |
| `ImportMixer` | `modeltasks.dll`, `imageclip.dll`, `_3dobject2.dll` | CLSID `{201be048-35d4-11d6-92de-009027219f81}` |
| `MergeMixer` | `modeltasks.dll`, `imageclip.dll`, `_3dobject2.dll` | CLSID `{201be048-35d4-11d6-92de-009027219f81}` |
| `SetResolutionOfRefModels` | `Model.vbs` (VBScript) | `SetResolutionOfAllRefModelsProc` |
| `SISetResolutionOfRefModels` | `modeltasks.dll` | CLSID `{50f25519-a047-40be-ae15-ea3d37f78a94}` |
| `ReconnectModel` | `modeltasks.dll` | CLSID `{542ad70a-0016-428e-8227-56f243348606}` |
| `SIImportMatLib` | `modeltasks.dll`, `imageclip.dll` | CLSID `{d46667ad-4d3c-4f57-b3d1-6872c37cbf1f}` |
| `SIImportReferencedMatLib` | `modeltasks.dll`, `imageclip.dll` | CLSID `{d46667ad-4d3c-4f57-b3d1-6872c37cbf1f}` |
| `DeleteModelFromObj` | `Model.vbs` (VBScript) | `DeleteModelFromObjectProc` |
| `MakeLocalMaterialsForHierarchy` | `Model.vbs` (VBScript) | `MakeLocalMaterialsForHierarchyProc` |
| `DuplicateModelFromObj` | `Model.vbs` (VBScript) | `DuplicateModelFromObjectProc` |
| `AddRefModelResolution` | `modeltasks.dll` | CLSID `{978d84be-44e7-46b3-9785-415106fcb43c}` |
| `RemoveRefModelResolution` | `modeltasks.dll` | CLSID `{978d84be-44e7-46b3-9785-415106fcb43c}` |
| `SICreateRefModel` | `modeltasks.dll`, `scnmgr.dll` | CLSID `{4e948e41-64da-4723-a8dd-6b03c4193f4a}` |
| `CreateEmptyRefModel` | `modeltasks.dll`, `scnmgr.dll` | CLSID `{4e948e41-64da-4723-a8dd-6b03c4193f4a}` |
| `CommitToReference` | `Model.vbs` (VBScript) | `CommitToReferenceProc` |
| `ConvertToRefModel` | `modeltasks.dll` | CLSID `{37c72455-4219-4518-b1ad-fb333fb27ebc}` |
| `ApplyDelta` | `modeltasks.dll` | CLSID `{11bcdc3d-c2f3-42a6-a2d5-cf7e77bcd01b}` |
| `ExportDelta` | `modeltasks.dll` | CLSID `{f28379fb-79f3-42fb-a3ab-475f4f8d4df3}` |
| `ImportDelta` | `modeltasks.dll` | CLSID `{988b8420-adef-4e60-8b16-b20872edaabe}` |
| `ImportReferencedDelta` | `modeltasks.dll` | CLSID `{988b8420-adef-4e60-8b16-b20872edaabe}` |
| `AddDelta` | `Model.vbs` (VBScript) | `AddDeltaProc` |
| `Lock` | `modeltasks.dll`, `tasks.dll`, `fcurve.dll`, `imageclip.dll`, `actionhelper.dll`, `props.dll` … | CLSID `{b3c0b1a1-0a4c-11d4-b980-009027bc3e07}` |
| `Unlock` | `modeltasks.dll`, `tasks.dll`, `fcurve.dll`, `imageclip.dll`, `actionhelper.dll`, `props.dll` … | CLSID `{b3c0b1a1-0a4c-11d4-b980-009027bc3e07}` |
| `Tag` | `modeltasks.dll`, `tasks.dll`, `fcurve.dll`, `imageclip.dll`, `actionhelper.dll`, `props.dll` … | CLSID `{b3c0b1a1-0a4c-11d4-b980-009027bc3e07}` |
| `Untag` | `modeltasks.dll`, `tasks.dll`, `fcurve.dll`, `imageclip.dll`, `actionhelper.dll`, `props.dll` … | CLSID `{b3c0b1a1-0a4c-11d4-b980-009027bc3e07}` |
| `UnloadAddonLib` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `UnloadAllAddonLibs` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `ReloadAddonLib` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `ReloadAllAddonLibs` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `UnloadAllCOMLibs` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `TestPluginHost` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `AddFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{88f181e0-1e0b-11d5-b93e-0800690c8bd0}` |
| `SetFxOpCnxFlag` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{dec69f6f-79bf-4720-843c-77ba07a9d75a}` |
| `ConnectFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{6a122800-4e2c-11d5-b953-0800690c8bd0}` |
| `DisconnectFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{c8530d7d-aecc-4232-b272-c50455c05f8a}` |
| `AddImageClipFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{27f96e05-1e1b-45bc-aaa5-266606670ad3}` |
| `AddPassInputFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{cee1c8a0-803d-11d5-a279-00d0b7190223}` |
| `RenderFxOp` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{2031f707-f7d2-47a8-9155-6e453c727701}` |
| `SetFxOpAttrib` | `fxcore.dll` | CLSID `{b345b4dc-7ad5-46aa-8028-1d231fea6180}` |
| `SetFxOpPos` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{a07d815e-92a8-4076-b71b-f1202bcc7b01}` |
| `CreateFxTree` | `fxcore.dll`, `si3dobjectmodel.dll` | CLSID `{3d1b717e-162d-459b-b978-4183a9567141}` |
| `Add2DShape` | `fxcore.dll` | CLSID `{205f3d8b-57c3-42e5-818d-639784adc23d}` |
| `Add2DShapePoint` | `fxcore.dll` | CLSID `{c7d2cdbd-86cb-49e3-bf9d-2512b7b52dd7}` |
| `Add2DShapePointArray` | `fxcore.dll` | CLSID `{c7d2cdbd-86cb-49e3-bf9d-2512b7b52dd7}` |
| `Insert2DShapePoint` | `fxcore.dll` | CLSID `{c7d2cdbd-86cb-49e3-bf9d-2512b7b52dd7}` |
| `Move2DShape` | `fxcore.dll` | CLSID `{2bda6dc3-a2e7-4938-a5ce-1cdc64748587}` |
| `Scale2DShape` | `fxcore.dll` | CLSID `{2bda6dc3-a2e7-4938-a5ce-1cdc64748587}` |
| `Move2DShapePin` | `fxcore.dll` | CLSID `{2bda6dc3-a2e7-4938-a5ce-1cdc64748587}` |
| `Set2DShapeRotation` | `fxcore.dll` | CLSID `{2bda6dc3-a2e7-4938-a5ce-1cdc64748587}` |
| `Move2DShapePoint` | `fxcore.dll` | CLSID `{52af562a-62c6-4dcd-a493-b2f4db352668}` |
| `Move2DShapeLHandle` | `fxcore.dll` | CLSID `{52af562a-62c6-4dcd-a493-b2f4db352668}` |
| `Move2DShapeRHandle` | `fxcore.dll` | CLSID `{52af562a-62c6-4dcd-a493-b2f4db352668}` |
| `Delete2DShapePoint` | `fxcore.dll` | CLSID `{0d017291-4351-471e-87fd-b78f80d97ea5}` |
| `Key2DShapePoints` | `fxcore.dll` | CLSID `{b91ef230-1686-434d-b61e-de0ab8815012}` |
| `CutFxOp` | `fxcore.dll` | CLSID `{0322d097-8d58-411b-95ee-a3fb0707052a}` |
| `CopyFxOp` | `fxcore.dll` | CLSID `{0322d097-8d58-411b-95ee-a3fb0707052a}` |
| `PasteFxOp` | `fxcore.dll` | CLSID `{0322d097-8d58-411b-95ee-a3fb0707052a}` |
| `AddColorPaintShape` | `xsipaint.dll` | CLSID `{6ca3aa0b-9967-40a8-ad6c-ff1644ad1539}` |
| `AddFxMaskShape` | `xsipaint.dll` | CLSID `{6ca3aa0b-9967-40a8-ad6c-ff1644ad1539}` |
| `AddFloodFillPaintShape` | `xsipaint.dll` | CLSID `{6ca3aa0b-9967-40a8-ad6c-ff1644ad1539}` |
| `AddAlphaFloodFillPaintShape` | `xsipaint.dll` | CLSID `{6ca3aa0b-9967-40a8-ad6c-ff1644ad1539}` |
| `AddBoundaryFillPaintShape` | `xsipaint.dll` | CLSID `{6ca3aa0b-9967-40a8-ad6c-ff1644ad1539}` |
| `AddPaintShapePoint` | `xsipaint.dll` | CLSID `{6ffabcb8-27fc-4d19-8e9a-a5deffda85a0}` |
| `InsertPaintShapePoint` | `xsipaint.dll` | CLSID `{b0cead3d-6d8f-4348-a4da-e50cd799e5f8}` |
| `DeletePaintShapePoints` | `xsipaint.dll` | CLSID `{7ae8bd3a-9a52-4a45-bdb5-31217e3d0bed}` |
| `AddBrushStroke` | `xsipaint.dll` | CLSID `{e890d4ec-48cd-4abc-9a37-11a9ddca18d9}` |
| `ImportMatadorShapeList` | `xsipaint.dll` | CLSID `{6a95269b-c073-495e-a535-ec1d42364afd}` |
| `SelectPaintShapePoint` | `xsipaint.dll` | CLSID `{e9fc9ffe-c411-4119-8868-f9a497d86908}` |
| `TogglePaintShapePointSelection` | `xsipaint.dll` | CLSID `{e9fc9ffe-c411-4119-8868-f9a497d86908}` |
| `AddToPaintShapePointSelection` | `xsipaint.dll` | CLSID `{e9fc9ffe-c411-4119-8868-f9a497d86908}` |
| `TranslatePaintShapePoint` | `xsipaint.dll` | CLSID `{65aff90b-a34e-40fa-92bd-386c90116b78}` |
| `MovePaintShapeHandle` | `xsipaint.dll` | CLSID `{ff7c5cd6-d75d-445c-81ba-93db1f591c65}` |
| `SetPaintShapeHandle` | `xsipaint.dll` | CLSID `{ff7c5cd6-d75d-445c-81ba-93db1f591c65}` |
| `RectangularPaintMask` | `xsipaint.dll` | CLSID `{ccce0968-ef9e-4828-b55a-b4c37b22bde0}` |
| `EllipticalPaintMask` | `xsipaint.dll` | CLSID `{ccce0968-ef9e-4828-b55a-b4c37b22bde0}` |
| `MagicWandPaintMask` | `xsipaint.dll` | CLSID `{ccce0968-ef9e-4828-b55a-b4c37b22bde0}` |
| `AddPaintMaskShape` | `xsipaint.dll` | CLSID `{ccce0968-ef9e-4828-b55a-b4c37b22bde0}` |
| `ClearPaintSelection` | `xsipaint.dll` | CLSID `{56cf0363-eba7-49d0-be96-8861004dbeb7}` |
| `InvertPaintStencil` | `xsipaint.dll` | CLSID `{e75d6028-3a67-492c-9663-90ecfb0ff853}` |
| `SetPaintStore` | `xsipaint.dll` | CLSID `{9da75f7c-ffaa-47a4-906f-846e6c223995}` |
| `SetPaintMergeStore` | `xsipaint.dll` | CLSID `{9da75f7c-ffaa-47a4-906f-846e6c223995}` |
| `SetPaintMaskStore` | `xsipaint.dll` | CLSID `{9da75f7c-ffaa-47a4-906f-846e6c223995}` |
| `PaintRasterLine` | `xsipaint.dll` | CLSID `{414b4ea8-91f3-43fe-b78d-104e5bd27bb7}` |
| `FloodFillRaster` | `xsipaint.dll` | CLSID `{2612bc0f-435a-425d-8f43-a2e80a3ece66}` |
| `ClearImage` | `xsipaint.dll` | CLSID `{e2252486-5ef1-44cc-8703-d311971256f0}` |
| `DeleteAllPaintShapes` | `xsipaint.dll` | CLSID `{e2252486-5ef1-44cc-8703-d311971256f0}` |
| `AddClearImageShape` | `xsipaint.dll` | CLSID `{e2252486-5ef1-44cc-8703-d311971256f0}` |
| `RectanglePaintRaster` | `xsipaint.dll` | CLSID `{30274025-9dd5-490c-b0e1-eae8e11b0a1f}` |
| `EllipsePaintRaster` | `xsipaint.dll` | CLSID `{30274025-9dd5-490c-b0e1-eae8e11b0a1f}` |
| `AddRectanglePaintShape` | `xsipaint.dll` | CLSID `{48d67c0e-b397-4c62-80fe-304a6253a46d}` |
| `AddEllipsePaintShape` | `xsipaint.dll` | CLSID `{48d67c0e-b397-4c62-80fe-304a6253a46d}` |
| `SetPaintColor` | `xsipaint.dll` | CLSID `{46f73afb-6e8a-41f6-adba-0f74f5a0d698}` |
| `ResetPaintColor` | `xsipaint.dll` | CLSID `{46f73afb-6e8a-41f6-adba-0f74f5a0d698}` |
| `SwapPaintColors` | `xsipaint.dll` | CLSID `{46f73afb-6e8a-41f6-adba-0f74f5a0d698}` |
| `SetPaintBrush` | `xsipaint.dll` | CLSID `{fd108e2b-b7bb-4cd0-8d9e-c7a9d40afede}` |
| `IncPaintShapePointWeight` | `xsipaint.dll` | CLSID `{722fb33e-7c86-4e27-a546-bf0514acba09}` |
| `DecPaintShapePointWeight` | `xsipaint.dll` | CLSID `{722fb33e-7c86-4e27-a546-bf0514acba09}` |
| `SavePaintClip` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `SaveSelectedPaintClipFrames` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `RevertPaintClip` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `RevertPaintClipFrame` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `RevertSelectedPaintClipFrame` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `GotoSelectedPaintClipFrame` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `PrevModifiedPaintClipFrame` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `NextModifiedPaintClipFrame` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `SelectPaintClipFrames` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `ClearPaintClipFrameSelection` | `fxcore.dll` | CLSID `{64a5ea2b-225f-45a6-a47e-af53bdb4e31b}` |
| `StartFxTracking` | `fxcore.dll` | CLSID `{f8fb7cca-a7cc-4800-8249-1cb690e2e521}` |
| `CurrentFxTracking` | `fxcore.dll` | CLSID `{f8fb7cca-a7cc-4800-8249-1cb690e2e521}` |
| `StepFxTracking` | `fxcore.dll` | CLSID `{f8fb7cca-a7cc-4800-8249-1cb690e2e521}` |
| `SetFxTrackerTrackedPoint` | `fxcore.dll` | CLSID `{f010c658-5a8e-4754-a9e0-097bc43f9c00}` |
| `SetFxTrackerTemplateArea` | `fxcore.dll` | CLSID `{f010c658-5a8e-4754-a9e0-097bc43f9c00}` |
| `SetFxTrackerSearchArea` | `fxcore.dll` | CLSID `{f010c658-5a8e-4754-a9e0-097bc43f9c00}` |
| `GetFirstPaintShapeKey` | `xsipaint.dll` | CLSID `{2bd686e4-d548-4a00-b317-0ae5cfbb23bb}` |
| `GetPrevPaintShapeKey` | `xsipaint.dll` | CLSID `{2bd686e4-d548-4a00-b317-0ae5cfbb23bb}` |
| `GetClosestPaintShapeKey` | `xsipaint.dll` | CLSID `{2bd686e4-d548-4a00-b317-0ae5cfbb23bb}` |
| `GetNextPaintShapeKey` | `xsipaint.dll` | CLSID `{2bd686e4-d548-4a00-b317-0ae5cfbb23bb}` |
| `GetLastPaintShapeKey` | `xsipaint.dll` | CLSID `{2bd686e4-d548-4a00-b317-0ae5cfbb23bb}` |
| `MakeWarperShapePair` | `fxcore.dll` | CLSID `{f7be9196-958b-4f3d-a68e-90fe38e77b87}` |
| `CreateUserDataMapAndPickTemplate` | `UserDataScripts.vbs` (VBScript) | `CreateUserDataMapAndPickTemplateFunc` |
| `InspectUserData` | `UserDataScripts.vbs` (VBScript) | `InspectUserDataFromObjListSub` |
| `DeformMotion` | `customcommands.dll` (None) | `None` |
| `ObjImport` | `customcommands.dll` (None) | `None` |
| `SIObjExport` | `customcommands.dll` (None) | `None` |
| `OBJ Import...` | `importexport.vbs` (VBScript) | `WavefrontImport` |
| `InspectDevices` | `uixsiscripts.vbs` (VBScript) | `InspectDevicesProc` |
| `StartChannelCapture` | `uixsiscripts.vbs` (VBScript) | `StartCaptureProc` |
| `StopChannelCapture` | `uixsiscripts.vbs` (VBScript) | `StopCaptureProc` |
| `EnableAllDevices` | `uixsiscripts.vbs` (VBScript) | `EnableAllDevicesProc` |
| `DisableAllDevices` | `uixsiscripts.vbs` (VBScript) | `DisableAllDevicesProc` |
| `SetRigidBodyInitState` | `tasks.dll`, `transformmanager.dll`, `viewinteraction.dll` | CLSID `{1a0c0d9e-baf8-4327-a9aa-d14e8764e46a}` |
| `GetRigidBodyInitStateFromAnim` | `simulation.vbs` (VBScript) | `GetRigidBodyInitialStateFromAnimProc` |
| `CreateActiveRigidBody` | `simulation.vbs` (VBScript) | `SetActiveRigidBodyProc` |
| `CreatePassiveRigidBody` | `simulation.vbs` (VBScript) | `SetPassiveRigidBodyProc` |
| `RemoveRigidBody` | `simulation.vbs` (VBScript) | `RemoveRigidBodyProc` |
| `AttachRigidBodies` | `simulation.vbs` (VBScript) | `AttachRigidBodiesProc` |
| `MultiAttachRigidBodiesTool` | `simulation.vbs` (VBScript) | `MultiAttachRigidBodiesTool` |
| `InspectRigidBodySimulationProperties` | `simulation.vbs` (VBScript) | `InspectRigidBodySimulationProperties` |
| `CreateCompoundRigidBody` | `simulation.vbs` (VBScript) | `CreateCompoundRigidBodyProc` |
| `AddCompoundShapeToRigidBody` | `simulation.vbs` (VBScript) | `AddCompoundShapeToRigidBodyProc` |
| `InstallCustomPreferences` | `tasks.dll` | CLSID `{3d2d0215-acbc-4b8b-8acf-ad835041f392}` |
| `RefreshCustomPreferences` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `SIUpdateRenderOptionsFromGlobalPref` | `uixsiscripts.vbs` (VBScript) | `UpdateRenderOptionsFromGlobalPrefProc` |
| `Inspect Rendering Preferences` | `uixsiscripts.vbs` (VBScript) | `InspectPreferencesProc` |
| `EditCommand` | `command.js` (JScript) | `EditCommandProc` |
| `CreateAndEditCommand` | `command.js` (JScript) | `CreateAndEditCommand` |
| `Make2PointSlide` | `CharacterRigging\make2PointSlide.js` (JScript) | `make2PointSlide` |
| `MakeThighSlide` | `CharacterRigging\makeThighSlide.js` (JScript) | `makeThighSlide` |
| `MakeArm` | `CharacterRigging\makeArm.js` (JScript) | `makeArm` |
| `MakeHand` | `CharacterRigging\makeHand.js` (JScript) | `makeHand` |
| `MakeBelly` | `CharacterRigging\makeBelly.js` (JScript) | `makeBelly` |
| `MakeBicepRoll` | `CharacterRigging\makeBicepRoll.js` (JScript) | `makeBicepRoll` |
| `MakeForearmRoll` | `CharacterRigging\makeForearmRoll.js` (JScript) | `makeForearmRoll` |
| `MakeShadowChain` | `CharacterRigging\makeShadowChain.js` (JScript) | `makeShadowChain` |
| `MakeShadowSpine` | `CharacterRigging\makeShadowSpine.js` (JScript) | `makeShadowSpine` |
| `MakeSpine` | `CharacterRigging\makeSpine.js` (JScript) | `makeSpine` |
| `MakeJointCompression` | `CharacterRigging\makeJointCompression.js` (JScript) | `makeJointCompression` |
| `MakeLeg` | `CharacterRigging\makeLeg.js` (JScript) | `makeLeg` |
| `MakeDogLeg` | `CharacterRigging\makeDogLeg.js` (JScript) | `makeDogLeg` |
| `MakeFoot` | `CharacterRigging\makeFoot.js` (JScript) | `makeFoot` |
| `MakeControlSplines` | `CharacterRigging\makeControlSplines.js` (JScript) | `makeControlSplines` |
| `MakeRigIcon` | `CharacterRigging\makeRigIcon.js` (JScript) | `makeRigIcon` |
| `MakeHead` | `CharacterRigging\makeHead.js` (JScript) | `makeHead` |
| `MakeTorso` | `CharacterRigging\makeTorso.js` (JScript) | `makeTorso` |
| `MakeTail` | `CharacterRigging\makeTail.js` (JScript) | `makeTail` |
| `MakeHip` | `CharacterRigging\makeHip.js` (JScript) | `makeHip` |
| `MakeBiped` | `CharacterRigging\makeBiped.js` (JScript) | `makeBiped` |
| `MakeQuadruped` | `CharacterRigging\makeQuadruped.js` (JScript) | `makeQuadruped` |
| `MakeBipedDogLeg` | `CharacterRigging\makeBipedDogLeg.js` (JScript) | `makeBipedDogLeg` |
| `MakeBipedCharacterKeySet` | `CharacterRigging\makeCharacterKeySet.js` (JScript) | `makeBipedCharacterKeySet` |
| `MakeQuadrupedCharacterKeySet` | `CharacterRigging\makeCharacterKeySet.js` (JScript) | `makeQuadrupedCharacterKeySet` |
| `SetKeyableRig` | `CharacterRigging\makeCharacterKeySet.js` (JScript) | `setKeyableRig` |
| `AddObjectsToShader` | `shadertasks.dll`, `action.dll`, `imageclip.dll` | CLSID `{c85e1a71-db03-11d2-aa5f-00aa0068d2c0}` |
| `RemoveObjectsFromShader` | `shadertasks.dll` | CLSID `{187240f1-e211-11d2-aa69-00aa0068d2c0}` |
| `SIGetShaderOnCnxPoint` | `shadertasks.dll` | CLSID `{09decdf0-82a5-11d3-ae46-00a0c96e63e1}` |
| `RemoveShaderFromCnxPoint` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{be45d284-e229-11d2-aa69-00aa0068d2c0}` |
| `RemoveAllShadersFromCnxPoint` | `shadertasks.dll` | CLSID `{46919ce1-ec5d-11d2-aa71-00aa0068d2c0}` |
| `SIApplyShader` | `propertytasks.dll`, `shadertasks.dll`, `sparks.dll`, `xsievents.dll`, `sicoresdk.dll` | CLSID `{41080962-e785-11d2-aa70-00aa0068d2c0}` |
| `ApplyShader` | `uixsiscripts.vbs` (VBScript) | `GetMaterialProc` |
| `UIMapButton` | `shadertasks.dll` | CLSID `{34f30cd2-12b8-11d3-aa89-00aa0068d2c0}` |
| `SetInstanceDataValue` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{fae06638-2003-11d3-a06b-0000f875df68}` |
| `SIGetMaterialShader` | `shadertasks.dll` | CLSID `{5e28e280-24e7-11d3-bffa-00a0248f9397}` |
| `ReplaceShader` | `shadertasks.dll` | CLSID `{91c3b502-3965-11d3-b22e-00a0c9a8ad15}` |
| `ReplaceShaderWithProgID` | `shadertasks.dll` | CLSID `{5db21aad-4449-4dd8-98a9-745e801059bd}` |
| `ReplaceShaderWithPreset` | `shadertasks.dll` | CLSID `{b5a3c021-3b8c-11d3-b22e-00a0c9a8ad15}` |
| `SIConnectShaderWithBlendsInsp` | `Rendering.vbs` (VBScript) | `SIConnectShaderWithBlendsInsp` |
| `BlendInPresetsWithPorts` | `Rendering.vbs` (VBScript) | `BlendInPresetsWithPorts` |
| `BlendInPresetsWithPortsInsp` | `Rendering.vbs` (VBScript) | `BlendInPresetsWithPortsInsp` |
| `BlendInPresets` | `Rendering.vbs` (VBScript) | `BlendInPresets` |
| `BlendInPresetsInsp` | `Rendering.vbs` (VBScript) | `BlendInPresetsInsp` |
| `BlendInTextureLayersWithPorts` | `Rendering.vbs` (VBScript) | `BlendInTextureLayersWithPorts` |
| `BlendInTextureLayersWithPortsInsp` | `Rendering.vbs` (VBScript) | `BlendInTextureLayersWithPortsInsp` |
| `BlendInTextureLayers` | `Rendering.vbs` (VBScript) | `BlendInTextureLayers` |
| `BlendInTextureLayersInsp` | `Rendering.vbs` (VBScript) | `BlendInTextureLayersInsp` |
| `BlendClipsInTextureLayersWithPorts` | `Rendering.vbs` (VBScript) | `BlendClipsInTextureLayersWithPorts` |
| `BlendClipsInTextureLayersWithPortsInsp` | `Rendering.vbs` (VBScript) | `BlendClipsInTextureLayersWithPortsInsp` |
| `BlendClipsInTextureLayers` | `Rendering.vbs` (VBScript) | `BlendClipsInTextureLayers` |
| `BlendClipsInTextureLayersInsp` | `Rendering.vbs` (VBScript) | `BlendClipsInTextureLayersInsp` |
| `UpgradeShaders` | `UpgradeShaders.vbs` (VBScript) | `UpgradeShaders` |
| `SIRebindByNameUserData` | `optasks.dll`, `shadertasks.dll` | CLSID `{4a1613c1-572c-4d7d-8e95-19271f58b0fc}` |
| `RenamePropAndRebind_Internal` | `shadertasks.dll` | CLSID `{cf3d546a-458d-4d02-ace0-b39ee913fdda}` |
| `DisconnectAndDeleteShaders` | `shadertasks.dll` | CLSID `{16e87237-87c4-4cfb-9e60-c8c6d9517a2c}` |
| `DisconnectAndDeleteOrUnnestShaders` | `shadertasks.dll` | CLSID `{16e87237-87c4-4cfb-9e60-c8c6d9517a2c}` |
| `InsertShader` | `Rendering.vbs` (VBScript) | `InsertShader` |
| `AddTextureLayer` | `shadertasks.dll`, `shaderhelper.dll`, `sicoresdk.dll` | CLSID `{ed63560a-1ee7-4f76-9d21-d3db5c23db83}` |
| `AddImageTextureLayer` | `Rendering.vbs` (VBScript) | `AddImageTextureLayer` |
| `AddClipTextureLayer` | `Rendering.vbs` (VBScript) | `AddClipTextureLayer` |
| `AddPresetTextureLayer` | `Rendering.vbs` (VBScript) | `AddPresetTextureLayer` |
| `RemoveTextureLayers` | `shadertasks.dll`, `sicoresdk.dll` | CLSID `{e83f9a34-0de0-4244-ae6a-d551ba2f7272}` |
| `MoveTextureLayers` | `shadertasks.dll`, `sicoresdk.dll` | CLSID `{1da1ee90-8a55-4257-a7dc-8221e2fcf029}` |
| `AddTextureLayerPorts` | `shadertasks.dll`, `shaderhelper.dll`, `sicoresdk.dll` | CLSID `{612fe1e6-12cd-46b3-8679-fcfaab16fa5f}` |
| `SIAddArrayElement` | `shadertasks.dll`, `shaderhelper.dll`, `sparks.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{17e2221e-3c31-4bf7-b49a-4abf7ad010d8}` |
| `SIRemoveArrayElement` | `shadertasks.dll`, `sparks.dll`, `sicoresdk.dll` | CLSID `{a60a917a-cf1c-4be0-b5d1-197d750a4d31}` |
| `SISwapArrayElements` | `shadertasks.dll`, `sicoresdk.dll` | CLSID `{6fbe63cb-d6fc-47d0-8c6d-2e419127faa8}` |
| `CreateShaderFromPreset` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `CreateShadersFromMaterialPreset` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `CreateShaderFromCLSID` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `CreateShaderFromProgID` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `AddShaderAttachedComment` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `CreateShaderCompound` | `shadertasks.dll` | CLSID `{3b0965e0-dc2f-4bb6-818d-08cd2c3c6211}` |
| `NestShaders` | `modeltasks.dll`, `shadertasks.dll`, `shaderhelper.dll` | CLSID `{482fe713-3adc-4a55-a11c-1c5d7d923266}` |
| `UnnestShaders` | `modeltasks.dll`, `shadertasks.dll` | CLSID `{7939d67b-77af-4649-ad94-7afa93943562}` |
| `AddShaderCompoundPort` | `shadertasks.dll`, `shaderhelper.dll` | CLSID `{b4eca6f7-0b60-4769-a13f-fe8d1d0d404e}` |
| `RemoveShaderCompoundPort` | `shadertasks.dll` | CLSID `{4429f144-8c5d-499c-aafe-cbdc9ca57044}` |
| `MoveShaderCompoundPort` | `shadertasks.dll` | CLSID `{b88b985e-20e0-4771-b85c-d45d5027ddcd}` |
| `RenameShaderCompoundPort` | `shadertasks.dll` | CLSID `{41deb46b-b08f-4adb-a253-2427ed78b8e7}` |
| `ExportShaderCompound` | `shadertasks.dll` | CLSID `{b1679add-fd7a-4e8c-acea-45ef795e7f7d}` |
| `ImportShaderCompound` | `shadertasks.dll` | CLSID `{34f0f2e9-6f5b-4ace-a4a3-55c5ecb319f2}` |
| `ExplodeShaderCompound` | `shadertasks.dll` | CLSID `{c95d3960-2733-4383-a941-833de2aa502c}` |
| `SetShaderCompoundProperties` | `shadertasks.dll` | CLSID `{6e1f9169-09f8-4915-8b7a-68446ca86a37}` |
| `SetShaderCompoundPropertiesEx` | `shadertasks.dll` | CLSID `{6e1f9169-09f8-4915-8b7a-68446ca86a37}` |
| `GetShaderCompoundProperties` | `shadertasks.dll` | CLSID `{c54f9fef-b202-470a-9265-61bc5dea95fa}` |
| `SetShaderCompoundPortProperties` | `shadertasks.dll`, `shaderhelper.dll` | CLSID `{a5485033-b832-40fd-ba19-41752d542b81}` |
| `GetShaderCompoundPortProperties` | `shadertasks.dll`, `rendertree.dll`, `shaderhelper.dll` | CLSID `{28a7cd73-9a39-4175-8539-53d8069dbffa}` |
| `ExportShaderTree` | `shadertasks.dll` | CLSID `{60c4f494-a0e4-42d6-b260-3ad35ae3497f}` |
| `ImportShaderTree` | `shadertasks.dll` | CLSID `{4127c28c-fde9-4325-bdd9-aafc0a83a9ba}` |
| `ExportShaderDefinition` | `shadertasks.dll` | CLSID `{de3bfbe1-eab2-4a5d-a9d4-60ad12a00d8b}` |
| `ReplaceShadersDefinition` | `shadertasks.dll`, `rendercore.dll`, `shadercodeeditor.dll`, `shaderhelper.dll` | CLSID `{3323a961-6741-4860-8504-a54f490e0417}` |
| `ShowFaceRobotActPanel` | `siuitasks.dll` | CLSID `{3ea2aaac-44c4-4fb0-9a62-248ee72edead}` |
| `ExtractPhonemesToSpeechOp` | `phonemeui.dll` | CLSID `{508c8c1f-4f64-4dee-8a10-45e99d0f7516}` |
| `ExtractPhonemesToSpeechOpJapanese` | `phonemeui.dll` | CLSID `{508c8c1f-4f64-4dee-8a10-45e99d0f7516}` |
| `PlaybackTimeRange` | `phonemeui.dll` | CLSID `{9ec070f3-b757-4d9d-bfd1-5ca2613c0c70}` |
| `SpeechOpDeleteWords` | `phonemeui.dll` | CLSID `{78f069c0-5621-417f-9382-a6dcd9bf7557}` |
| `SpeechOpDeletePhonemes` | `phonemeui.dll` | CLSID `{78f069c0-5621-417f-9382-a6dcd9bf7557}` |
| `SpeechOpInsertWord` | `phonemeui.dll` | CLSID `{2a14054a-510b-433f-b555-208f5b9e158f}` |
| `SpeechOpMoveWords` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpMovePhoneme` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpScaleWordStart` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpScaleWordEnd` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpScalePhonStart` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpScalePhonEnd` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSplitPhonemes` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesIPAValue` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesWeight` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesFalloffIn` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesFalloffOut` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesShapeWeight` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesShapeFalloffIn` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesShapeFalloffOut` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesBlendIn` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesBlendOut` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SpeechOpSetPhonemesVariation` | `phonemeui.dll` | CLSID `{1bdb1e5f-546a-4902-8d12-a0c049779d69}` |
| `SIExtractPhonemes` | `phonemeui.dll` | CLSID `{508c8c1f-4f64-4dee-8a10-45e99d0f7516}` |
| `GetPhonemesFromSpeechClip` | `phonemeui.dll` | CLSID `{3335b7b3-8a64-436a-aad1-dd60969dac56}` |
| `GetPhonemeBlendFromSpeechClip` | `phonemeui.dll` | CLSID `{3335b7b3-8a64-436a-aad1-dd60969dac56}` |
<!-- END GENERATED: registry -->
