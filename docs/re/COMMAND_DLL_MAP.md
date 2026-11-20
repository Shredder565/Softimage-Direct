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
| `SaveKeyOnMarkedKeyable` | `Application\DSScripts\uixsiscripts.vbs` | `SaveKeyOnKeyableProc` | CMD-B6a | [cmd-b6a-uixsi-keys-sources-materials.md](../ghidra/cmd-b6a-uixsi-keys-sources-materials.md) | SPEC |
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
| `IsAnimated` | `Application\bin\fcurve.dll` | Do 0x18001fed0 / worker motionhelp.dll!SIIsAnimated | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `GetSource` | `Application\bin\fcurve.dll` | Do 0x18001f710 / worker mohelper.dll!F3DGetAnimSources | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `EvalFCurve` | `Application\bin\fcurve.dll` | Do 0x180014c60 / worker 0x180014c10 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `GetFCurveInfo` | `Application\bin\fcurve.dll` | Do 0x18001cf50 / worker 0x18001cdf0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `GetKeyInfo` | `Application\bin\fcurve.dll` | Do 0x18001d8b0 / worker 0x18001d3f0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `AddFCurve` | `Application\bin\fcurve.dll` | Do OnDo (imported) / worker 0x18000aae0 -> 0x18000a7b0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `SetCurveType` | `Application\bin\fcurve.dll` | Do 0x1800454c0 / worker 0x1800452d0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `SaveKey` | `Application\bin\fcurve.dll` | Do 0x180008990 / worker 0x1800070e0 -> 0x180005ff0 -> 0x18001adb0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `SaveKeyOnKeyable` | `Application\bin\fcurve.dll` | Do 0x180008990 / worker 0x1800070e0 -> 0x180005ff0 (mode 1 in UnPackArg 0x18000e800) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `SaveKeyOnMarkedKeyable` (native entry) | `Application\bin\fcurve.dll` | Do 0x180008990 / worker 0x1800070e0 -> 0x180005ff0 (mode 2 in UnPackArg 0x18000e800) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `RemoveKey` | `Application\bin\fcurve.dll` | Do 0x18003c1d0 / worker 0x18003be80 -> 0x18003b300 -> 0x18001c0f0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `RemoveKeyOnKeyable` | `Application\bin\fcurve.dll` | Do 0x18003c1d0 / worker 0x18003b300 (mode 1 in UnPackArg 0x18000e800) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `RemoveKeyOnMarkedKeyable` | `Application\bin\fcurve.dll` | Do 0x18003c1d0 / worker 0x18003b300 (mode 2 in UnPackArg 0x18000e800) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `NextKey` | `Application\bin\fcurve.dll` | Do 0x180047140 / worker 0x1800386f0 -> 0x180046ec0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `PrevKey` | `Application\bin\fcurve.dll` | Do 0x180047140 / worker 0x1800389b0 -> 0x180047200 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `FirstKey` | `Application\bin\fcurve.dll` | Do 0x180047140 / worker 0x18001caf0 -> 0x180046ac0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `LastKey` | `Application\bin\fcurve.dll` | Do 0x180047140 / worker 0x18002f470 -> 0x180046d20 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `SaveActionKey` (native entry) | `Application\bin\fcurve.dll` | Do OnDo (imported) / worker 0x180044e10 -> 0x180044c30, source lookup 0x1800447f0 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `ActivateFCurve` | `Application\bin\fcurve.dll` | Do 0x180002380 / worker 0x180002110 -> 0x180001240 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `ActivateFCurveOnKeyable` | `Application\bin\fcurve.dll` | Do 0x180002380 / worker 0x180002110 -> 0x180001240 (mode 1 in UnPackArg 0x180002860) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `ActivateFCurveOnMarkedKeyable` | `Application\bin\fcurve.dll` | Do 0x180002380 / worker 0x180002110 -> 0x180001240 (mode 2 in UnPackArg 0x180002860) | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `RemoveAnimation` | `Application\bin\fcurve.dll` | Do 0x18003a660 / worker 0x180039b70 / collector 0x180038d20 | CMD-B8a | [cmd-b8a-fcurve-keys-binary.md](../ghidra/cmd-b8a-fcurve-keys-binary.md) | SPEC |
| `GetCurrentAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c8a0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `SetCurrentAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c950 / worker 0x18002c080 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `GetNumberOfAnimationLayers` | `Application\bin\fcurve.dll` | Do 0x18002c8d0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `AddAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c820 / worker 0x18002a5d0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `DeleteAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c940 / worker 0x18002baf0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `DuplicateAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c890 / worker 0x18002ac60 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `LockAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c910 / worker 0x18002b7d0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `UnlockAnimationLayer` | `Application\bin\fcurve.dll` | Do 0x18002c910 / worker 0x18002b7d0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `IsAnimationLayerLocked` | `Application\bin\fcurve.dll` | Do 0x18002c900 / worker 0x18002b4a0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `SetMarking` | `Application\bin\fcurve.dll` | Do 0x18000db50 / worker 0x180046730 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `ClearMarking` | `Application\bin\fcurve.dll` | Do 0x18000db50 / worker 0x180046730 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `AddToMarking` | `Application\bin\fcurve.dll` | Do 0x18000db50 / worker 0x18000daf0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `RemoveFromMarking` | `Application\bin\fcurve.dll` | Do 0x18000db50 / worker 0x18003c660 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `GetMarking` | `Application\bin\fcurve.dll` | Do 0x18001df20 / worker 0x18001def0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `SetExpr` | `Application\bin\fcurve.dll` | Do 0x180004360 / worker 0x180003150 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `EditExpr` | `Application\bin\fcurve.dll` | Do 0x180015270 / worker 0x180015030 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `SetRelativeValues` | `Application\bin\fcurve.dll` | Do 0x180046530 / worker 0x1800458e0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `GetNumRelativeValues` | `Application\bin\fcurve.dll` | Do 0x18001e710 / worker 0x18001e4a0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `GetRelativeValue` | `Application\bin\fcurve.dll` | Do 0x18001f0f0 / worker 0x18001eea0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `RemoveRelativeValue` | `Application\bin\fcurve.dll` | Do 0x18003f0e0 / worker 0x18003f050 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `ConnectSource` | `Application\bin\fcurve.dll` | Do 0x18000f9d0 / worker 0x18000f6d0 | CMD-B8b | [cmd-b8b-fcurve-layers-marking-expr-binary.md](../ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md) | SPEC |
| `CopyAnimContainer` | `Application\bin\fcurve.dll` | Do 0x180011530 / worker 0x1800113f0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `CopyAllAnimation` | `Application\bin\fcurve.dll` | Do 0x180013a40 / worker 0x180012ed0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `CopyAnimation` | `Application\bin\fcurve.dll` | Do 0x180013a40 / worker 0x180012ed0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `PasteAllAnimation` | `Application\bin\fcurve.dll` | Do 0x180013a70 / worker 0x1800138d0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `PasteAnimation` | `Application\bin\fcurve.dll` | Do 0x180013a70 / worker 0x1800138d0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `CopyKeys` | `Application\bin\fcurve.dll` | Do 0x180025a00 / worker 0x180023b30 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `CutKeys` | `Application\bin\fcurve.dll` | Do 0x180025bb0 / worker 0x1800246b0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `DeleteKeys` | `Application\bin\fcurve.dll` | Do 0x180025bb0 / worker 0x1800246b0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `PasteKeys` | `Application\bin\fcurve.dll` | Do 0x180025da0 / worker 0x180025350 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `SelectKeysInTimespan` | `Application\bin\fcurve.dll` | Do 0x18002dd80 / worker 0x18002e5a0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `DeselectAllKeys` | `Application\bin\fcurve.dll` | Do 0x18002dd80 / worker 0x18002d9f0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `ConvertEulerToQuat` | `Application\bin\fcurve.dll` | Do 0x18000d790 / worker 0x18000c3f0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `ConvertQuatToEuler` | `Application\bin\fcurve.dll` | Do 0x18003df60 / worker 0x18003cb40 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `MakeRotationsContinuous` | `Application\bin\fcurve.dll` | Do 0x1800373c0 / worker 0x180037520 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `Sequence` | `Application\bin\fcurve.dll` | Do 0x180041da0 / worker 0x1800405b0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `SISequence` | `Application\bin\fcurve.dll` | Do 0x180041da0 / worker 0x1800405b0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `ScaleAndOffset` | `Application\bin\fcurve.dll` | Do 0x180041da0 / worker 0x1800405b0 | CMD-B8c | [cmd-b8c-fcurve-copy-paste-rotation-binary.md](../ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md) | SPEC |
| `SIFindUniqueTextureName` | `Application\bin\primtasks.dll` | Do 0x18000aa70 / worker 0x180003570 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SICreateTexturePureImplicit` | `Application\bin\primtasks.dll` | Do 0x18001f1c0 / worker 0x18001eec0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SICreateTextureBasicGeo` | `Application\bin\primtasks.dll` | Do 0x180023b30 / worker 0x1800235d0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SICreateTextureProj` | `Application\bin\primtasks.dll` | Do 0x180023b30 / worker 0x1800235d0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `SICreateTextureUVDomain` | `Application\bin\primtasks.dll` | Do 0x18001e0a0 / worker 0x18001d620 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `SIConnectToSupport` | `Application\bin\primtasks.dll` | Do 0x180008350 / worker 0x180008040 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SIConnectToProjection` | `Application\bin\primtasks.dll` | Do 0x180007990 / worker 0x180007670 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `SICameraTextureProj` | `Application\bin\primtasks.dll` | Do 0x1800068d0 / worker 0x1800065f0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SICreateTextureSpatial` | `Application\bin\primtasks.dll` | Do 0x18000c050 / worker 0x18000bea0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `SIGetTextureUVDomains` | `Application\bin\primtasks.dll` | Do 0x1800108c0 / worker 0x18000f8e0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `ChangeUVInput` | `Application\bin\primtasks.dll` | Do 0x1800071a0 / worker 0x180006ee0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `HealUVW` | `Application\bin\primtasks.dll` | Do 0x180011aa0 / worker 0x1800114f0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `MatchUVW` | `Application\bin\primtasks.dll` | Do 0x18001c430 / worker 0x18001bcf0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `CycleUVW` | `Application\bin\primtasks.dll` | Do 0x18000b880 / worker 0x1800096c0 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `FlipUVW` | `Application\bin\primtasks.dll` | Do 0x18000b880 / worker 0x18000b450 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC |
| `RelaxUVW` | `Application\bin\primtasks.dll` | Do 0x180011aa0 / worker 0x18001f850 | CMD-B8d | [cmd-b8d-primtasks-texture-binary.md](../ghidra/cmd-b8d-primtasks-texture-binary.md) | SPEC-PARTIAL |
| `SIGetRigidCns` | `Application\bin\primtasks.dll` | Do 0x18000ec60 / worker 0x18000e260 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIAssembleNurbsMesh` | `Application\bin\primtasks.dll` | Do 0x180031330 / worker 0x180031030 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC-PARTIAL |
| `SIGetPrimLight` | `Application\bin\primtasks.dll` | Do 0x18001b680 / worker 0x18001aea0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIGetPrimCamera` | `Application\bin\primtasks.dll` | Do 0x180021fb0 / worker 0x180004e60 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIGetPrimSpotLight` | `Application\bin\primtasks.dll` | Do 0x180021fb0 / worker 0x1800219e0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIGetPrimLattice` | `Application\bin\primtasks.dll` | Do 0x18001a330 / worker 0x180019ae0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIGetPrimVolumeDeform` | `Application\bin\primtasks.dll` | Do 0x180025200 / worker 0x180024a30 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC-PARTIAL |
| `SIInstantiate` | `Application\bin\primtasks.dll` | Do 0x180018bd0 / worker 0x180017ac0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `GetMaster` | `Application\bin\primtasks.dll` | Do 0x180018ba0 / worker 0x1800175f0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `GetInstances` | `Application\bin\primtasks.dll` | Do 0x180018ba0 / worker 0x1800173e0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `GetURLAt` | `Application\bin\primtasks.dll` | Do 0x180010dc0 / worker 0x180010bc0 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `ImportEPS` | `Application\bin\primtasks.dll` | Do 0x180014fd0 / worker 0x180014a90 | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC-PARTIAL |
| `GetNbTriangles` | `Application\bin\primtasks.dll` | Do 0x18000c2e0 / worker SIGetNbTriangles (import) | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC |
| `SIAssignMaterial` | `Application\bin\not primtasks.dll (caller only at 0x18002bd90)` | Do not located / worker not located | CMD-B8e | [cmd-b8e-primtasks-prims-binary.md](../ghidra/cmd-b8e-primtasks-prims-binary.md) | SPEC-PARTIAL |
| `AddPointToNewPolygon` | `Application\bin\simeshtasks.dll` | Do 0x180001950 / worker 0x1800017d0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `RemovePointFromPolygon` | `Application\bin\simeshtasks.dll` | Do 0x1800071d0 / worker 0x180006fc0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `AddPointInteriorToPolygon` | `Application\bin\simeshtasks.dll` | Do 0x180001360 / worker 0x180001220 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `RemoveLastPointInteriorToPolygon` | `Application\bin\simeshtasks.dll` | Do 0x180006c70 / worker 0x180006b70 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `TerminateAddEdgeWithInteriorPoints` | `Application\bin\simeshtasks.dll` | Do 0x180009050 / worker 0x180008920 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC-PARTIAL |
| `SnapOffsetToPointForSlicePolygons` | `Application\bin\simeshtasks.dll` | Do 0x1800082b0 / worker 0x1800077d0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC-PARTIAL |
| `ConnectNewPolygonToEdge` | `Application\bin\simeshtasks.dll` | Do 0x1800027a0 / worker 0x180002060 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `ConnectNewPolygonToPoint` | `Application\bin\simeshtasks.dll` | Do 0x180002f50 / worker 0x180002ce0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `CreateMeshPartitionClusters` | `Application\bin\simeshtasks.dll` | Do 0x180005b20 / worker 0x1800051d0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `CreateClustersAlongDepthFromCurvesToMeshOperator` | `Application\bin\simeshtasks.dll` | Do 0x1800047d0 / worker 0x180003970 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `CreateClustersFromSlicePolygonsOperator` | `Application\bin\simeshtasks.dll` | Do 0x1800064a0 / worker 0x180005db0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SICreateCurve` | `Application\bin\sicurvetasks.dll` | Do 0x180005430 / worker 0x180005030 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SISetCurvePoints` | `Application\bin\sicurvetasks.dll` | Do 0x180009450 / worker 0x180009250 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SIAddPointOnCurve` | `Application\bin\sicurvetasks.dll` | Do 0x180003450 / worker 0x1800024c0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SIAddPointOnCurveAtStart` | `Application\bin\sicurvetasks.dll` | Do 0x180001fb0 / worker 0x180001b10 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SIAddPointOnCurveAtEnd` | `Application\bin\sicurvetasks.dll` | Do 0x180001fb0 / worker 0x180001150 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `SIDeletePointOnCurve` | `Application\bin\sicurvetasks.dll` | Do 0x180007c00 / worker 0x180007940 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `CreateCurvePartitionClusters` | `Application\bin\sicurvetasks.dll` | Do 0x180004890 / worker 0x1800041b0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `CurveDirectManip` | `Application\bin\sicurvetasks.dll` | Do 0x1800060c0 / worker 0x1800059d0 | CMD-B8f | [cmd-b8f-mesh-curve-step-tasks-binary.md](../ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md) | SPEC |
| `AddPaintShapePoint` | `Application\bin\xsipaint.dll` | Do `0x18003d380` -> `0x18003d190` -> shape method `0x18000d0e0` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `ClearPaintSelection` | `Application\bin\xsipaint.dll` | Do `0x180046f90` -> `0x180046c30` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `DecPaintShapePointWeight` | `Application\bin\xsipaint.dll` | Do `0x18004bcc0` -> Inc `0x18004bac0` / Dec `0x18004b940` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `EllipsePaintRaster` | `Application\bin\xsipaint.dll` | Do `0x180048e00` -> `0x180049040` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC-PARTIAL |
| `GetClosestPaintShapeKey` | `Application\bin\xsipaint.dll` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `GetFirstPaintShapeKey` | `Application\bin\xsipaint.dll` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `GetLastPaintShapeKey` | `Application\bin\xsipaint.dll` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `GetNextPaintShapeKey` | `Application\bin\xsipaint.dll` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `GetPrevPaintShapeKey` | `Application\bin\xsipaint.dll` | Do `0x18004d700` -> worker interface `0x18007f3f0`: First `0x18004d440`, Prev `0x18004d7f0`, Closest `0x18004ce90`, Next `0x18004d500`, Last `0x18004d460`; shared bodies `0x18004cf50` (First / Last) and `0x18004d0d0` (Prev / Closest) | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `IncPaintShapePointWeight` | `Application\bin\xsipaint.dll` | Do `0x18004bcc0` -> Inc `0x18004bac0` / Dec `0x18004b940` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `InvertPaintStencil` | `Application\bin\xsipaint.dll` | Do `0x180046f90` -> `0x1800472d0` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `RectanglePaintRaster` | `Application\bin\xsipaint.dll` | Do `0x180048e00` -> `0x180049040` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC-PARTIAL |
| `SetPaintMaskStore` | `Application\bin\xsipaint.dll` | Do `0x180044ee0` -> `0x1800452f0` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `SetPaintMergeStore` | `Application\bin\xsipaint.dll` | Do `0x180044ee0` -> `0x1800452f0` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `SetPaintStore` | `Application\bin\xsipaint.dll` | Do `0x180044ee0` -> `0x1800452f0` | CMD-B9a | [cmd-b9a-xsipaint-shapes-keys-stores-binary.md](../ghidra/cmd-b9a-xsipaint-shapes-keys-stores-binary.md) | SPEC |
| `AddAlphaFloodFillPaintShape` | `Application\bin\xsipaint.dll` | `0x18003e0a0` -> `0x18003dbc0` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC-PARTIAL |
| `AddBoundaryFillPaintShape` | `Application\bin\xsipaint.dll` | `0x18003e0a0` -> `0x18003dbc0` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC-PARTIAL |
| `AddBrushStroke` | `Application\bin\xsipaint.dll` | `0x18003c480` -> `0x18003b0d0` (stroke reuse test `0x18003c1d0`) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddClearImageShape` | `Application\bin\xsipaint.dll` | `0x180043520` -> `0x180042e80` (ClearImage) / `0x1800431a0` (DeleteAll) / `0x180042a80` (AddClearImageShape) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddColorPaintShape` | `Application\bin\xsipaint.dll` | `0x18003e0a0` -> `0x18003dbc0` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddEllipsePaintShape` | `Application\bin\xsipaint.dll` | `0x180049e80` -> `0x180049910` (geometry builders `0x18000f270` rectangle, `0x18000f0c0` ellipse) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddFloodFillPaintShape` | `Application\bin\xsipaint.dll` | `0x18003e0a0` -> `0x18003dbc0` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddFxMaskShape` | `Application\bin\xsipaint.dll` | `0x18003e0a0` -> `0x18003dbc0` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC-PARTIAL |
| `AddRectanglePaintShape` | `Application\bin\xsipaint.dll` | `0x180049e80` -> `0x180049910` (geometry builders `0x18000f270` rectangle, `0x18000f0c0` ellipse) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `ClearImage` | `Application\bin\xsipaint.dll` | `0x180043520` -> `0x180042e80` (ClearImage) / `0x1800431a0` (DeleteAll) / `0x180042a80` (AddClearImageShape) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `DeleteAllPaintShapes` | `Application\bin\xsipaint.dll` | `0x180043520` -> `0x180042e80` (ClearImage) / `0x1800431a0` (DeleteAll) / `0x180042a80` (AddClearImageShape) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `DeletePaintShapePoints` | `Application\bin\xsipaint.dll` | `0x18003ec50` -> `0x18003ea60` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `MovePaintShapeHandle` | `Application\bin\xsipaint.dll` | `0x180041c80` -> `0x180041b10` (Move) / `0x180041f30` (Set) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `SetPaintShapeHandle` | `Application\bin\xsipaint.dll` | `0x180041c80` -> `0x180041b10` (Move) / `0x180041f30` (Set) | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `TranslatePaintShapePoint` | `Application\bin\xsipaint.dll` | `0x18004c670` -> `0x18004c850` | CMD-B9b | [cmd-b9b-xsipaint-add-shapes-binary.md](../ghidra/cmd-b9b-xsipaint-add-shapes-binary.md) | SPEC |
| `AddPaintMaskShape` | `Application\bin\xsipaint.dll` | `0x180045f50` / `0x180046120` / `0x180046030` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `AddToPaintShapePointSelection` | `Application\bin\xsipaint.dll` | `0x1800441c0` / `0x1800442d0` / `0x180044220` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `EllipticalPaintMask` | `Application\bin\xsipaint.dll` | `0x180045f50` / `0x180046120` / `0x180046030` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `FloodFillRaster` | `Application\bin\xsipaint.dll` | `0x180047c50` / `0x180047c90` / `0x180047c70` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC-PARTIAL |
| `ImportMatadorShapeList` | `Application\bin\xsipaint.dll` | `0x1800405b0` / `0x1800406f0` (stub) / `0x180040630` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `InsertPaintShapePoint` | `Application\bin\xsipaint.dll` | `0x180041450` / `0x180041510` / `0x180041480` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `MagicWandPaintMask` | `Application\bin\xsipaint.dll` | `0x180045f50` / `0x180046120` / `0x180046030` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `PaintRasterLine` | `Application\bin\xsipaint.dll` | `0x1800483a0` / `0x180048460` / `0x180048400` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `RectangularPaintMask` | `Application\bin\xsipaint.dll` | `0x180045f50` / `0x180046120` / `0x180046030` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `ResetPaintColor` | `Application\bin\xsipaint.dll` | `0x18004ae40` / `0x18004afe0` / `0x18004af10` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `SelectPaintShapePoint` | `Application\bin\xsipaint.dll` | `0x1800441c0` / `0x1800442d0` / `0x180044220` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `SetPaintBrush` | `Application\bin\xsipaint.dll` | `0x18004a850` / `0x18004a920` / `0x18004a8c0` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `SetPaintColor` | `Application\bin\xsipaint.dll` | `0x18004ae40` / `0x18004afe0` / `0x18004af10` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `SwapPaintColors` | `Application\bin\xsipaint.dll` | `0x18004ae40` / `0x18004afe0` / `0x18004af10` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `TogglePaintShapePointSelection` | `Application\bin\xsipaint.dll` | `0x1800441c0` / `0x1800442d0` / `0x180044220` | CMD-B9c | [cmd-b9c-xsipaint-masks-select-color-binary.md](../ghidra/cmd-b9c-xsipaint-masks-select-color-binary.md) | SPEC |
| `ExtractPhonemesToSpeechOp` | `Application\bin\phonemeui.dll` | Do `0x18001d290` -> guided recogniser `0x180004fa0` / unguided `0x180005530`; result array builder `0x18001d6a0` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `ExtractPhonemesToSpeechOpJapanese` | `Application\bin\phonemeui.dll` | Do `0x18001d290` -> guided recogniser `0x180004fa0` / unguided `0x180005530`; result array builder `0x18001d6a0` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `GetPhonemeBlendFromSpeechClip` | `Application\bin\phonemeui.dll` | Do `0x18001f040` -> phoneme table `0x18001f4c0` / blend table `0x18001f290` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC-PARTIAL |
| `GetPhonemesFromSpeechClip` | `Application\bin\phonemeui.dll` | Do `0x18001f040` -> phoneme table `0x18001f4c0` / blend table `0x18001f290` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `PlaybackTimeRange` | `Application\bin\phonemeui.dll` | Do `0x18001cb20` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC-PARTIAL |
| `SIExtractPhonemes` | `Application\bin\phonemeui.dll` | Do `0x18001d290` -> guided recogniser `0x180004fa0` / unguided `0x180005530`; result array builder `0x18001d6a0` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpDeletePhonemes` | `Application\bin\phonemeui.dll` | Do `0x18001e8c0` -> word remover `0x180004eb0` / phoneme remover `0x18001e740` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpDeleteWords` | `Application\bin\phonemeui.dll` | Do `0x18001e8c0` -> word remover `0x180004eb0` / phoneme remover `0x18001e740` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpInsertWord` | `Application\bin\phonemeui.dll` | Do `0x180020370` -> `0x18001fdc0` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpMovePhoneme` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpMoveWords` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpScalePhonEnd` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpScalePhonStart` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpScaleWordEnd` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpScaleWordStart` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesBlendIn` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesBlendOut` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesFalloffIn` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesFalloffOut` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesIPAValue` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesShapeFalloffIn` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesShapeFalloffOut` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesShapeWeight` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesVariation` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSetPhonemesWeight` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> worker `0x180020e70` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `SpeechOpSplitPhonemes` | `Application\bin\phonemeui.dll` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | CMD-B9d | [cmd-b9d-phonemeui-speech-binary.md](../ghidra/cmd-b9d-phonemeui-speech-binary.md) | SPEC |
| `ClearPaintClipFrameSelection` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `CreateFxTree` | `Application\bin\fxcore.dll` | Do `0x1800786b0` -> worker `0x1800784c0` | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `DisconnectFxOp` | `Application\bin\fxcore.dll` | Do `0x180078ce0` -> worker `0x180078b40` | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC-PARTIAL |
| `GotoSelectedPaintClipFrame` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `MakeWarperShapePair` | `Application\bin\fxcore.dll` | Do `0x18007f480` -> list driver `0x18007f2f0` -> per shape `0x18007f060` (helpers `0x18007ede0`, `0x18007ebf0`, `0x18007f5a0`) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC-PARTIAL |
| `NextModifiedPaintClipFrame` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `PrevModifiedPaintClipFrame` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `RenderFxOp` | `Application\bin\fxcore.dll` | Do `0x180079220` -> worker `0x180079310` | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `RevertPaintClip` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC-PARTIAL |
| `RevertPaintClipFrame` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `RevertSelectedPaintClipFrame` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `SavePaintClip` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `SaveSelectedPaintClipFrames` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `SelectPaintClipFrames` | `Application\bin\fxcore.dll` | Do `0x18005b1c0` -> paint clip interface methods (table in 2.2) | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `SetFxOpPos` | `Application\bin\fxcore.dll` | Do `0x18007aeb0` -> worker `0x18007b060` | CMD-B9e | [cmd-b9e-fxcore-paintclip-fxtree-binary.md](../ghidra/cmd-b9e-fxcore-paintclip-fxtree-binary.md) | SPEC |
| `Add2DShape` | `Application\bin\fxcore.dll` | `0x180072030` -> `0x180071ab0` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Add2DShapePoint` | `Application\bin\fxcore.dll` | `0x180071080` -> single point `0x180070e90`, array `0x180070f70` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Add2DShapePointArray` | `Application\bin\fxcore.dll` | `0x180071080` -> single point `0x180070e90`, array `0x180070f70` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `AddPassInputFxOp` | `Application\bin\fxcore.dll` | `0x180076d40` -> `0x180076740` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC-PARTIAL |
| `ConnectFxOp` | `Application\bin\fxcore.dll` | `0x180077e70` -> `0x180077930` -> connect helper `0x18000fc60` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `CurrentFxTracking` | `Application\bin\fxcore.dll` | `0x18007e2c0` -> `0x18007e600` / `0x18007e5f0` / `0x18007e610` -> shared `0x18007e1e0` (helpers `0x18007e420`, `0x18007df50`) | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC-PARTIAL |
| `Insert2DShapePoint` | `Application\bin\fxcore.dll` | `0x180071080` -> single point `0x180070e90`, array `0x180070f70` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Move2DShape` | `Application\bin\fxcore.dll` | `0x180074080` -> `0x180074150` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Move2DShapePin` | `Application\bin\fxcore.dll` | `0x180074080` -> `0x180074150` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Scale2DShape` | `Application\bin\fxcore.dll` | `0x180074080` -> `0x180074150` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `Set2DShapeRotation` | `Application\bin\fxcore.dll` | `0x180074080` -> `0x180074150` | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC |
| `SetFxOpAttrib` | `Application\bin\fxcore.dll` | `0x180079dd0` -> `0x180079fb0` (name table lookup `0x18007cf10`) | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC-PARTIAL |
| `StartFxTracking` | `Application\bin\fxcore.dll` | `0x18007e2c0` -> `0x18007e600` / `0x18007e5f0` / `0x18007e610` -> shared `0x18007e1e0` (helpers `0x18007e420`, `0x18007df50`) | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC-PARTIAL |
| `StepFxTracking` | `Application\bin\fxcore.dll` | `0x18007e2c0` -> `0x18007e600` / `0x18007e5f0` / `0x18007e610` -> shared `0x18007e1e0` (helpers `0x18007e420`, `0x18007df50`) | CMD-B9f | [cmd-b9f-fxcore-2dshape-connect-tracking-binary.md](../ghidra/cmd-b9f-fxcore-2dshape-connect-tracking-binary.md) | SPEC-PARTIAL |
| `AddFxOp` | `Application\bin\fxcore.dll` | Do `0x180075fb0` -> worker `0x180075da0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC-PARTIAL |
| `AddImageClipFxOp` | `Application\bin\fxcore.dll` | Do `0x180075670` -> worker `0x180074cb0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC-PARTIAL |
| `CopyFxOp` | `Application\bin\fxcore.dll` | Do `0x18007c030` -> copy/cut worker `0x18007b6e0` or paste worker `0x18007c160` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `CutFxOp` | `Application\bin\fxcore.dll` | Do `0x18007c030` -> copy/cut worker `0x18007b6e0` or paste worker `0x18007c160` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Delete2DShapePoint` | `Application\bin\fxcore.dll` | Do `0x180072840` -> worker `0x180072660` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Key2DShapePoints` | `Application\bin\fxcore.dll` | Do `0x180073030` -> worker `0x180072de0` (key helper `0x180073100`) | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Move2DShapeLHandle` | `Application\bin\fxcore.dll` | Do `0x180073b30` -> worker `0x1800735a0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Move2DShapePoint` | `Application\bin\fxcore.dll` | Do `0x180073b30` -> worker `0x1800735a0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Move2DShapeRHandle` | `Application\bin\fxcore.dll` | Do `0x180073b30` -> worker `0x1800735a0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `PasteFxOp` | `Application\bin\fxcore.dll` | Do `0x18007c030` -> copy/cut worker `0x18007b6e0` or paste worker `0x18007c160` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `SetFxOpCnxFlag` | `Application\bin\fxcore.dll` | Do `0x18007a770` -> worker `0x18007a860` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `SetFxTrackerSearchArea` | `Application\bin\fxcore.dll` | Do `0x18007d1c0` -> workers `0x18007d8c0` (point), `0x18007d7f0` (template), `0x18007d720` (search) -> per-value helper `0x18007d3f0`, then `0x18007d2f0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `SetFxTrackerTemplateArea` | `Application\bin\fxcore.dll` | Do `0x18007d1c0` -> workers `0x18007d8c0` (point), `0x18007d7f0` (template), `0x18007d720` (search) -> per-value helper `0x18007d3f0`, then `0x18007d2f0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `SetFxTrackerTrackedPoint` | `Application\bin\fxcore.dll` | Do `0x18007d1c0` -> workers `0x18007d8c0` (point), `0x18007d7f0` (template), `0x18007d720` (search) -> per-value helper `0x18007d3f0`, then `0x18007d2f0` | CMD-B9g | [cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md](../ghidra/cmd-b9g-fxcore-fxop-shapepoints-tracker-binary.md) | SPEC |
| `Particle Type Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> menu 0x180061890, filler 0x180061490` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `SIMatchSubComponent` | `Application\bin\tasks.dll` | `Do 0x180038650 -> 0x180038600` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `CopyCacheFiles` | `Application\bin\tasks.dll` | `Do 0x1800760d0 -> worker 0x1800744a0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `Goal Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> menu 0x180061890, filler 0x180061020` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `RenameCPSetLayoutItems` | `Application\bin\tasks.dll` | `Do 0x180064890 (body 0x1800648c0)` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `CreateObjectFromPreset` | `Application\bin\tasks.dll` | `Do 0x18006f810 -> worker 0x18006f630` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `ObjImport` | `Application\bin\tasks.dll` | `Do 0x180033b90 -> bridge 0x180032fc0 -> XSIOnCommand loader 0x180033430` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `SIObjExport` | `Application\bin\tasks.dll` | `Do 0x180033b90 -> bridge 0x180032fc0 -> XSIOnCommand loader 0x180033430` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `FindObjects` | `Application\bin\tasks.dll` | `Do 0x180035510 -> 0x1800350a0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `GetCurrentPass` | `Application\bin\tasks.dll` | `Do 0x1800372e0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `SetCurrentParType` | `Application\bin\tasks.dll` | `Do 0x180048f50 -> 0x180048710` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `SetDefaultKeyMap` | `Application\bin\tasks.dll` | `Do 0x180024e30 -> 0x180024d70` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `DumpCacheHeader` | `Application\bin\tasks.dll` | `Do 0x18007d400 -> 0x18007d320` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `CollapseOp` | `Application\bin\tasks.dll` | `Do 0x180011790 -> 0x180010cf0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `ReorderSceneItem` | `Application\bin\tasks.dll` | `Do 0x180039120 -> 0x180038d60` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `ImportPrefs` | `Application\bin\tasks.dll` | `Do 0x18007dad0 -> callback 0x18007da80 -> 0x18007d9c0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `CacheObjectsIntoFile_Private` | `Application\bin\tasks.dll` | `Do 0x180079fd0 -> 0x180079750` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `PickPosition` | `Application\bin\tasks.dll` | `Do 0x18006ed60` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC |
| `FilterPSet` | `Application\bin\tasks.dll` | `Do 0x180038260 -> 0x1800380e0 -> predicate 0x180037cd0` | CMD-B11a | [cmd-b11a-tasks-cache-preset-pick-binary.md](../ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md) | SPEC-PARTIAL |
| `PickElement` | `Application\bin\tasks.dll` | `Do 0x18006e350 (UnPack 0x18006e9e0, RePack 0x18006e700)` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `PickObject` | `Application\bin\tasks.dll` | `same task as PickElement` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `GetNumberOfKnots` | `Application\bin\tasks.dll` | `Do 0x18006db30` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `GetCurvePercentageAtKnotIndex` | `Application\bin\tasks.dll` | `Do 0x18006ded0` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `EnumElements` | `Application\bin\tasks.dll` | `Do 0x180031570` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `Obstalce Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> 0x180061890` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `GetExternalReferences` | `Application\bin\tasks.dll` | `Do 0x18001f5f0 -> worker 0x18001f2e0` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `UpdateExternalReference` | `Application\bin\tasks.dll` | `Do 0x18002c470 -> worker 0x18002be70` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `ImportCustomFile` | `Application\bin\tasks.dll` | `Do 0x180022280 -> worker 0x180021910` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `System` | `Application\bin\tasks.dll` | `Do 0x180053290 -> worker 0x180053160` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `SetReferencePlane` | `Application\bin\tasks.dll` | `Do 0x180050770 -> worker 0x18004fc30` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `CrashXSI` | `Application\bin\tasks.dll` | `dispatch row 11 run 0x180054ec0` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `DumpMemoryStats` | `Application\bin\tasks.dll` | `dispatch row 12 run 0x180054f10` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `GetUnevaluatedPrimitiveForConstructionHistory` | `Application\bin\tasks.dll` | `dispatch row 13 run 0x180055070` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `IsSoftimageDevDrop` | `Application\bin\tasks.dll` | `dispatch row 15 run 0x180055290` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `SIGetHelpPath` | `Application\bin\tasks.dll` | `dispatch row 5 run 0x180054fe0` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `ICEOfflineRefresh` | `Application\bin\tasks.dll` | `dispatch row 16 run 0x180055270` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `UnloadAddonLib` | `Application\bin\tasks.dll` | `dispatch row 0 run 0x18002ce20 (+8 browser 0x18002d000)` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `UnloadAllAddonLibs` | `Application\bin\tasks.dll` | `dispatch row 3 run 0x18002d310` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `ReloadAddonLib` | `Application\bin\tasks.dll` | `dispatch row 1 run 0x18002c6a0 (+8 browser 0x18002c880)` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `ReloadAllAddonLibs` | `Application\bin\tasks.dll` | `dispatch row 4 run 0x18002cb90` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `UnloadAllCOMLibs` | `Application\bin\tasks.dll` | `dispatch row 2 run 0x18002d5b0` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC |
| `TestPluginHost` | `Application\bin\tasks.dll` | `no dispatch row` | CMD-B11b | [cmd-b11b-tasks-pick-curve-extref-misc-binary.md](../ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md) | SPEC-PARTIAL |
| `SICreateRefPlane` | `Application\bin\tasks.dll` | `Do 0x18003d6e0 -> worker 0x18003d290` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `SaveSceneAs` | `Application\bin\tasks.dll` | `Do 0x180084ba0` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `AddToTOC` | `Application\bin\tasks.dll` | `Do thunk 0x1800575d0 -> worker 0x180057430` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `Open SE on Override parent` | `Application\bin\tasks.dll` | `Do 0x180063070 -> worker 0x180062ec0` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC-PARTIAL |
| `SetReference` | `Application\bin\tasks.dll` | `Do 0x1800269e0 -> worker 0x180026780` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC-PARTIAL |
| `GetCurveLength` | `Application\bin\tasks.dll` | `Do 0x18006d750` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `EvaluateCurveAt` | `Application\bin\tasks.dll` | `Do 0x18006cb40` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `Event Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> 0x180061890; collector 0x180060b90` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `SISaveDuplicateXformForUndo` | `Application\bin\tasks.dll` | `Do 0x180024940, Undo 0x180024a60` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `CopyCacheFiles2` | `Application\bin\tasks.dll` | `Do 0x180076120 -> worker 0x180075260` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `ExportCustomFile` | `Application\bin\tasks.dll` | `Do 0x180018190 -> worker 0x180017c80` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `CreatePreset` | `Application\bin\tasks.dll` | `Do 0x18006ffa0 -> worker 0x18006fd90` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `SILoadPreset` | `Application\bin\tasks.dll` | `Do 0x1800716c0 -> worker 0x180070d50` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `InspectBrowse` | `Application\bin\tasks.dll` | `Do thunk 0x180061f10 -> worker 0x180061dd0` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `InspectExternalReference` | `Application\bin\tasks.dll` | `Do thunk 0x180022a90 -> worker 0x180022660` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `GetKeyboardState` | `Application\bin\tasks.dll` | `Do thunk 0x180037620 -> 0x180037580` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `Force Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> 0x180061890; collector 0x180060dc0` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `SavePreset` | `Application\bin\tasks.dll` | `Do 0x180073cf0 -> worker 0x180072d60` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `TagForDelete` | `Application\bin\tasks.dll` | `Do thunk 0x18005fbc0 -> 0x18005fb40; Undo 0x18005fc10` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `GetUserPref` | `Application\bin\tasks.dll` | `Do 0x180036790 -> worker 0x180036640` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `Emission Pop-up Menu` | `Application\bin\tasks.dll` | `Do 0x180061930 -> 0x180061890; collector 0x1800607e0` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `SaveBackupScene` | `Application\bin\tasks.dll` | `Do 0x180084460` | CMD-B11c | [cmd-b11c-tasks-scene-preset-curve-inspect-binary.md](../ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md) | SPEC |
| `NavigateNode` | `Application\bin\tasks.dll` | `Do 0x18008c630 -> worker 0x18008b890; UnPackArg 0x18008c830` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `SelectNeighborObj` | `Application\bin\tasks.dll` | `script-backed command object (0x18003fe50 runs the command script); task Do/Undo/Redo no-ops` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `CreateFolder` | `Application\bin\tasks.dll` | `Do 0x180085fb0 -> worker 0x180085bf0; UnPackArg 0x1800862d0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `MoveToFolder` | `Application\bin\tasks.dll` | `Do 0x180088980 -> worker 0x180086c10; UnPackArg 0x1800877a0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `RemoveFromFolder` | `Application\bin\tasks.dll` | `Do 0x180088980 -> worker 0x1800885e0; UnPackArg 0x180088f40` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `PinUVComponents` | `Application\bin\tasks.dll` | `Do 0x1800562d0 -> worker 0x180056570 (mode by script name: Pin 1, PinAll 2, UnPin 3, UnPinAll 4); UnPackArg 0x180056fa0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `UnPinUVComponents` | `Application\bin\tasks.dll` | `Do 0x1800562d0 -> worker 0x180056570 (mode by script name: Pin 1, PinAll 2, UnPin 3, UnPinAll 4); UnPackArg 0x180056fa0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `PinAllUVComponents` | `Application\bin\tasks.dll` | `Do 0x1800562d0 -> worker 0x180056570 (mode by script name: Pin 1, PinAll 2, UnPin 3, UnPinAll 4); UnPackArg 0x180056fa0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `UnPinAllUVComponents` | `Application\bin\tasks.dll` | `Do 0x1800562d0 -> worker 0x180056570 (mode by script name: Pin 1, PinAll 2, UnPin 3, UnPinAll 4); UnPackArg 0x180056fa0` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `GetSize` | `Application\bin\tasks.dll` | `Do 0x180037950 -> worker 0x180037880; outputs 0x180037a30` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `Tag` | `Application\bin\tasks.dll` | `Do 0x180080990 -> 0x18007f4d0 -> tag path 0x1800821f0 (add 0x1800805b0); UnPackArg 0x180082e00` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `Untag` | `Application\bin\tasks.dll` | `Do 0x180080990 -> 0x18007f4d0 -> tag path 0x1800821f0 (remove 0x1800828c0); UnPackArg 0x180082e00` | CMD-B11d | [cmd-b11d-tasks-b10-confirmations-binary.md](../ghidra/cmd-b11d-tasks-b10-confirmations-binary.md) | SPEC |
| `MoveComponent` | `not in transformmanager.dll (see note)` | `not implemented in transformmanager.dll (CLSID bytes at 0x18006c2a8, one consumer ref 0x180051f05; absent from DllGetCla` | CMD-B11i | [cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md](../ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `CreateConnectionMap` | `Application\bin\action.dll` | `Do 0x180029780 -> worker 0x180029630 -> full map 0x1800288a0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `CreateEmptyConnectionMap` | `Application\bin\action.dll` | `Do 0x180029780 -> worker 0x180029630 -> empty map 0x180029430` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `CreateValueMap` | `Application\bin\action.dll` | `Do 0x180032750 -> worker 0x180032600 -> full map 0x1800314b0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `CreateEmptyValueMap` | `Application\bin\action.dll` | `Do 0x180032750 -> worker 0x180032600 -> empty map 0x1800313a0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `AddMappingRule` | `Application\bin\action.dll` | `Do 0x180001480 -> worker 0x180001320` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `DeleteMappingRule` | `Application\bin\action.dll` | `Do 0x180036530 -> worker 0x1800363a0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `GetMappingRule` | `Application\bin\action.dll` | `Do 0x18003da30 -> worker 0x18003d8c0; RePack 0x18003db40` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `GetNumMappingRules` | `Application\bin\action.dll` | `Do 0x18003dea0 -> worker 0x18003de40; RePack 0x18003df50` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `SetMappingRule` | `Application\bin\action.dll` | `Do 0x180060470 -> worker 0x1800601e0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `RemoveActionItem` | `Application\bin\action.dll` | `Do 0x180056e30 -> worker 0x180056a40` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `GetStoreActionDefaults` | `Application\bin\action.dll` | `Do 0x1800652d0 -> store worker 0x180063c90; RePack 0x180066a70` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `LoadActionPreset` | `Application\bin\action.dll` | `Do 0x180040c10 -> worker 0x18003f510` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC-PARTIAL |
| `CopySourceActionToFolder` | `Application\bin\action.dll` | `Do 0x180028310 -> worker 0x180027ee0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `AddPoseActionItems` | `Application\bin\action.dll` | `Do 0x180001dc0 -> worker 0x180001d20 -> 0x180001a20` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC |
| `MergeClips` | `Application\bin\action.dll` | `Do 0x180044bb0 -> worker 0x180044210; RePack 0x1800453e0` | CMD-B11e | [cmd-b11e-action-maps-rules-sources-binary.md](../ghidra/cmd-b11e-action-maps-rules-sources-binary.md) | SPEC-PARTIAL |
| `StoreViseme` | `Application\bin\action.dll` | `Do 0x180071880 -> worker 0x180070f00` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `SetupEvolverVisemes` | `Application\bin\action.dll` | `Do 0x180069cf0 -> worker 0x180068990` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC-PARTIAL |
| `CreateVisemeAction` | `Application\bin\action.dll` | `Do 0x180030ab0 -> worker 0x180030170` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CreateEvolverSpeechAction` | `Application\bin\action.dll` | `Do 0x18002a9d0 -> worker 0x180029fa0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CreateSpeechAction` | `Application\bin\action.dll` | `Do 0x18002f630 -> worker 0x18002e6b0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `FreezeLipSync` | `Application\bin\action.dll` | `Do 0x18003c200 (not decompiled) -> worker 0x18003b710` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CopyShape` | `Application\bin\action.dll` | `Do 0x180027700 -> worker 0x180027370, copier 0x180026c00` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CreateShapeGroup` | `Application\bin\action.dll` | `Do 0x18002d710 -> worker 0x18002cf20` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `SetShapeGroup` | `Application\bin\action.dll` | `Do 0x180060ec0 -> worker 0x180060cd0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `StripDeformOperators` | `Application\bin\action.dll` | `Do 0x1800727e0 -> worker 0x180072470, stripper 0x180072950` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `Open SE for Link With Deform` | `Application\bin\action.dll` | `Do 0x1800480e0 -> worker 0x180047f70` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `RemoveEffect` | `Application\bin\action.dll` | `Do 0x180057ec0 -> worker 0x1800577d0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `ResetOffset` | `Application\bin\action.dll` | `Do 0x18005a240 -> worker 0x180059bf0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CutClipInSpace` | `Application\bin\action.dll` | `Do 0x180033ac0 -> worker 0x1800331e0` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `CreateOffsetEffect` | `Application\bin\action.dll` | `Do 0x18002b980 -> worker 0x18002b020` | CMD-B11f | [cmd-b11f-action-speech-shape-effects-binary.md](../ghidra/cmd-b11f-action-speech-shape-effects-binary.md) | SPEC |
| `PlotCamSeqToActions` | `Application\bin\action.dll` | `Do 0x180049e40 -> worker 0x1800490f0 (apply/cleanup 0x180048a00)` | CMD-B11g | [cmd-b11g-action-camseq-b10-confirmations-binary.md](../ghidra/cmd-b11g-action-camseq-b10-confirmations-binary.md) | SPEC |
| `GetSceneFrameSetFromCamSeq` | `Application\bin\action.dll` | `Do 0x18003e260 (UnPackArg 0x18003e680, Undo/Redo no-op 0x180027ae0)` | CMD-B11g | [cmd-b11g-action-camseq-b10-confirmations-binary.md](../ghidra/cmd-b11g-action-camseq-b10-confirmations-binary.md) | SPEC |
| `PlotCamSeqShape` | `Application\bin\action.dll` | `Do 0x18004d530 -> worker 0x18004bf80` | CMD-B11g | [cmd-b11g-action-camseq-b10-confirmations-binary.md](../ghidra/cmd-b11g-action-camseq-b10-confirmations-binary.md) | SPEC |
| `ToggleMuteSolo` | `Application\bin\vm.dll` | `Do 0x180006c60 (UnPack 0x180006ce0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `SetViewCamera` | `Application\bin\vm.dll` | `Do 0x1800072f0 -> resolver 0x1800073c0` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `AlignViewCamera` | `Application\bin\vm.dll` | `Do 0x180001910 -> worker 0x180001400` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ViewTranslate` | `Application\bin\vm.dll` | `Do 0x180008c40 (shared task, UnPack 0x1800093b0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ViewNudgeLeft` | `Application\bin\vm.dll` | `Do 0x180008c40 (shared task, UnPack 0x1800093b0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ViewNudgeRight` | `Application\bin\vm.dll` | `Do 0x180008c40 (shared task, UnPack 0x1800093b0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ViewNudgeUp` | `Application\bin\vm.dll` | `Do 0x180008c40 (shared task, UnPack 0x1800093b0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ViewNudgeDown` | `Application\bin\vm.dll` | `Do 0x180008c40 (shared task, UnPack 0x1800093b0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ExportImageClip` | `Application\bin\vm.dll` | `Do 0x180031df0 (UnPack 0x180032440)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `CameraUndo` | `Application\bin\vm.dll` | `Do 0x1800029d0` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `CameraRedo` | `Application\bin\vm.dll` | `Do 0x180001d00` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `ResetAllViews` | `Application\bin\vm.dll` | `Do 0x180001f90 (Undo 0x180002400, Redo 0x1800023f0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `Frame Contextual` | `Application\bin\vm.dll` | `Do 0x180003fc0` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `GetViewIndex` | `Application\bin\vm.dll` | `Do 0x180004c90 (RePack 0x180004ce0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `Hide Back Facing Polygons` | `Application\bin\vm.dll` | `Do 0x180007b50` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `SaveFastPlaybackCache` | `Application\bin\vm.dll` | `Do 0x180003660` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `LoadFastPlaybackCache` | `Application\bin\vm.dll` | `Do 0x1800032e0` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `Show3DContextMenu` | `Application\bin\vm.dll` | `Do 0x180007980` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC |
| `StartTimedPlayback` | `Application\bin\vm.dll` | `Do 0x1800301d0 (mode 2 of shared Capture/Flipbook task; UnPack 0x1800316a0)` | CMD-B11h | [cmd-b11h-vm-view-commands-b10-confirmations-binary.md](../ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `TranslateUVW` | `Application\bin\transformmanager.dll` | `UnPackArg 0x180053e40 (shared reader 0x180052d00); Do 0x1800503c0 shared` | CMD-B11i | [cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md](../ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `RotateUVW` | `Application\bin\transformmanager.dll` | `UnPackArg 0x180023610 (shared reader 0x180052d00); Do 0x1800503c0 shared` | CMD-B11i | [cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md](../ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `ScaleUVW` | `Application\bin\transformmanager.dll` | `UnPackArg 0x1800239f0 (shared reader 0x180052d00); Do shared (inferred)` | CMD-B11i | [cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md](../ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `TranslatePivot` | `not in transformmanager.dll (see note)` | `not implemented in transformmanager.dll (CLSID 8eee27b3-... absent from DllGetClassObject)` | CMD-B11i | [cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md](../ghidra/cmd-b11i-transformmanager-uvw-movecomponent-b10-confirmations-binary.md) | SPEC-PARTIAL |
| `GetConnectionSet` | `Application\bin\optasks.dll` | Do `0x180020090`, CLSID `825449e3-8706-11d2-8091-00a0c955b335` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC-PARTIAL |
| `GetSurfaceFromCurvesConnectionSet` | `Application\bin\optasks.dll` | Do `0x180020090`, CLSID `825449e3-8706-11d2-8091-00a0c955b335` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC-PARTIAL |
| `GetGeneratorInputsForDisposal` | `Application\bin\optasks.dll` | Do `0x180031860`, CLSID `85759d87-aacb-4837-863b-b268035a3f7d` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `TogglePropVolume` | `Application\bin\optasks.dll` | Do `0x180063950`, CLSID `e9bba0e0-4a7f-48f6-aade-95c94e0888f6` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `GetConnectedPropVolume` | `Application\bin\optasks.dll` | Do `0x18005e6b0`, CLSID `9230d7a9-5c92-491a-908e-e1f8bdf7b396` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `InspectPropVolume` | `Application\bin\optasks.dll` | Do `0x1800611f0`, CLSID `05af89a5-3b06-48af-a897-4204529e0828` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `SITransferCenter` | `Application\bin\optasks.dll` | Do `0x1800664e0`, CLSID `412f8ee4-c4e2-11d4-b863-009027bc6587` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `SIApplyFlexEnv` | `Application\bin\optasks.dll` | Do `0x180075c60`, CLSID `f8c8c073-acdc-11d2-99b7-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `SIApplyFlexEnvWithWeight` | `Application\bin\optasks.dll` | Do `0x1800766e0`, CLSID `2fd07801-c7cc-4292-a8ef-8f09bce70620` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `SIApplyDeformByCage` | `Application\bin\optasks.dll` | Do `0x18006f1a0`, CLSID `6f378031-89b6-4216-a31c-3d84e01c927f` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `SILocalAssignFlexEnv` | `Application\bin\optasks.dll` | Do `0x18007a170`, CLSID `56242c30-fdc4-11d2-99c2-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `ResetFlexEnvPtsAssignment` | `Application\bin\optasks.dll` | Do `0x18007a170`, CLSID `56242c30-fdc4-11d2-99c2-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `SIModifyFlexEnvWght` | `Application\bin\optasks.dll` | Do `0x18007ffc0`, CLSID `61199760-1a84-11d3-99c3-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `SISymEnvWeight` | `Application\bin\optasks.dll` | Do `0x1800917e0`, CLSID `d4a5193a-7b48-43e3-9372-b63e780d9f49` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `LockEnvelopeWeights` | `Application\bin\optasks.dll` | Do `0x18007d5a0`, CLSID `ee4cc939-6415-48de-9245-33b1bcce8349` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `ConnectWeightMap` | `Application\bin\optasks.dll` | Do `0x1800e7af0`, CLSID `31ca68f0-bd5c-11d2-99b8-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC |
| `AddMappingNode` | `Application\bin\optasks.dll` | Do `0x18003f140`, CLSID `e04fcc31-79d2-11d2-99ad-00a0243f0e60` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `ConnectOperatorParameter` | `Application\bin\optasks.dll` | Do `0x18002bf10`, CLSID `6834c96b-0b64-412a-9f65-68d4939b172b` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `DisconnectOperatorParameter` | `Application\bin\optasks.dll` | Do `0x1800bffd0`, CLSID `e1e79b2c-c035-41dd-ae0e-eadd3249c24b` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `UpdateConnectOnOp` | `Application\bin\optasks.dll` | Do `0x1800356f0`, CLSID `9c8384e2-da33-11d2-ac75-00a02485cecb` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `MoveOperator` | `Application\bin\optasks.dll` | Do `0x180032d40`, CLSID `3fb6dc14-739e-11d4-bdd0-00a0c9615daf` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `ChangeGeneratorInputReadPosition` | `Application\bin\optasks.dll` | Do `0x180052440`, CLSID `f6d1643e-b6d2-4b98-b22a-96fe98fad39d` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `GetGeneratorInputReadPosition` | `Application\bin\optasks.dll` | Do `0x180060980`, CLSID `49451678-ec7a-4537-a27e-38e5c13bfa10` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `GetGeneratorInputReadPosition_UIOnly` | `Application\bin\optasks.dll` | Do `0x180060980`, CLSID `49451678-ec7a-4537-a27e-38e5c13bfa10` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `CopyAnimationAcrossGenerator` | `Application\bin\optasks.dll` | Do `0x180059190`, CLSID `4a2386fc-aac4-4b83-89a6-396bead3dac3` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC-PARTIAL |
| `CycleChecking` | `Application\bin\optasks.dll` | Do `0x18002eab0`, CLSID `8fb755e3-06e3-11d7-be20-00a0c9615daf` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `ReplaceICECompoundNode` | `Application\bin\optasks.dll` | Do `0x1800c3b30`, CLSID `ce6ac9da-b883-4129-a6c4-2ba96eee4bce` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC-PARTIAL |
| `PrivateGetCompoundConstructionMode` | `Application\bin\optasks.dll` | Do `0x1800aa710`, CLSID `fc8efed4-79b8-48be-90ca-e44cddd8feb7` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `CleanDisconnectedICENodes` | `Application\bin\optasks.dll` | Do `0x1800abff0`, CLSID `6489ed18-8f26-4062-b1e0-726ba316a1f9` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `AddAttributeToSetDataICENode` | `Application\bin\optasks.dll` | Do `0x180092b60`, CLSID `80f29d44-c124-4eef-b261-1592123d61a3` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `RemoveAttributeFromSetDataICENode` | `Application\bin\optasks.dll` | Do `0x1800bd0c0`, CLSID `b1b29707-e69c-47d0-b28d-e52ce4fc5970` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `AddPortToICENode2` | `Application\bin\optasks.dll` | Do `0x1800a34b0`, CLSID `443328d5-87ac-40f5-8f21-e5d8a6de4dd1` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `RemovePortFromICENode` | `Application\bin\optasks.dll` | Do `0x1800bffd0`, CLSID `87f7b094-2482-4112-883d-75574f5f3573` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC-PARTIAL |
| `TransferICETree` | `Application\bin\optasks.dll` | Do `0x1800bc3e0`, CLSID `3613f42b-4b81-4390-854c-fad9bb6c222e` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `SetICESimInitState` | `Application\bin\optasks.dll` | Do `0x1800c48c0`, CLSID `af2d7c8e-e256-4d35-98c5-aad158924d09` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC-PARTIAL |
| `RemoveICESimInitState` | `Application\bin\optasks.dll` | Do `0x1800048c0`, CLSID `c12151b0-ff9a-4d5c-b485-9d9b337b0b65` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC-PARTIAL |
| `CreateICENodeComment` | `Application\bin\optasks.dll` | Do `0x1800b0d60`, CLSID `bfb82c5f-307b-40ea-b9fb-8f9a329c0288` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `AddNodeToICECompoundNode` | `Application\bin\optasks.dll` | Do `0x1800a1dc0`, CLSID `84f10d5c-d904-4b8e-83f5-a24976d3f3d6` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `RemoveNodeFromICECompoundNode` | `Application\bin\optasks.dll` | Do `0x1800a1dc0`, CLSID `c83a610b-fc27-404f-9c07-1e3d3feada85` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `AddExposedParamToICECompoundNode` | `Application\bin\optasks.dll` | Do `0x180093f00`, CLSID `26cb16ed-194a-4427-b56a-be703f019673` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC-PARTIAL |
| `EditExposedParamInICECompoundNode` | `Application\bin\optasks.dll` | Do `0x1800b5c60`, CLSID `60381d74-bde7-4980-82d4-a48f6f5780c5` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `RemoveExposedParamFromICECompoundNode` | `Application\bin\optasks.dll` | Do `0x1800bff80`, CLSID `bf8f591a-6c3e-417c-a2ff-25e6f765f374` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `RemoveExposedPortPassThrough` | `Application\bin\optasks.dll` | Do `0x1800bffd0`, CLSID `a91d22e2-c883-41ab-9330-4e1a317f56b5` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `SetPortType` | `Application\bin\optasks.dll` | Do `0x180006220`, CLSID `66803e82-0cdb-445a-af5d-128efaaf5dec` | CMD-B12b | [cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md](../ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md) | SPEC |
| `SubstituteOpInput` | `Application\bin\optasks.dll` | Do `0x18005ceb0`, CLSID `4b382841-216f-11d5-ad0a-0090275802bf` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `AddInputToOperator` | `Application\bin\optasks.dll` | Do `0x18005ceb0`, CLSID `4b382841-216f-11d5-ad0a-0090275802bf` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `RemoveInputFromOperator` | `Application\bin\optasks.dll` | Do `0x18005ceb0`, CLSID `4b382841-216f-11d5-ad0a-0090275802bf` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `SIBasicTransferClusterPropertiesAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x180050190`, CLSID `7be54750-3839-464f-9d42-5e1822056f25` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC-PARTIAL |
| `SIBasicTransferClustersAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x18004f690`, CLSID `81f70f51-067c-42c9-8a7b-3db10ace0688` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `TransferPropertiesAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x180069f20`, CLSID `edca5404-3e79-4ede-b59a-d438b050c362` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC-PARTIAL |
| `TransferClusterPropertiesAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x180067740`, CLSID `f00335b8-9ed0-4595-93f5-886e7f2aa73d` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC-PARTIAL |
| `GenerateAutomaticUVs` | `Application\bin\optasks.dll` | Do `0x18005e290`, CLSID `706986e9-06f3-4604-b7c3-5d0f396de0f3` | CMD-B12c | [cmd-b12c-optasks-envelope-weights-volumes-binary.md](../ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md) | SPEC-PARTIAL |
| `TransferShapeAnimationAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x18006ad80`, CLSID `b261a1ba-ab27-4bd5-9bec-f17314245140` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC |
| `DisconnectFromSimulationOp` | `Application\bin\optasks.dll` | Do `0x180030bc0`, CLSID `84854b58-b16a-4b4a-9c37-54483ff41aa1` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `ConnectBevelProfileCurve` | `Application\bin\optasks.dll` | Do `0x18005a9f0`, CLSID `777f2102-a2e7-4721-b977-0030b1b2f6a9` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `DisconnectBevelProfileCurve` | `Application\bin\optasks.dll` | Do `0x18005c3e0`, CLSID `73849979-93e6-470e-8f61-2b3e2b54b247` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `ConnectPlaneReferenceToSlicePolygonsOp` | `Application\bin\optasks.dll` | Do `0x180053eb0`, CLSID `53e49e93-b205-4c81-a553-4c82e36c92d9` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `DisconnectPlaneReferenceFromSlicePolygonsOp` | `Application\bin\optasks.dll` | Do `0x18005c3e0`, CLSID `e85b7bc9-d0d0-4859-9fed-b975d3e1be4d` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `CreateGridAndConnectToSlicePolygonsOp` | `Application\bin\optasks.dll` | Do `0x18005a9f0`, CLSID `e22d0a9f-7e9e-474c-bd97-3bf58a796fe8` | CMD-B12d | [cmd-b12d-optasks-operator-inputs-connections-binary.md](../ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md) | SPEC |
| `PropertyTransfer` | `Application\bin\optasks.dll` | Do `0x180003710`, CLSID `d5b91e0f-d65f-4ced-8cac-811e801f54e8` | CMD-B12e | [cmd-b12e-optasks-generator-transfers-binary.md](../ghidra/cmd-b12e-optasks-generator-transfers-binary.md) | SPEC-PARTIAL |
| `GetICECompoundPortProperties` | `Application\bin\optasks.dll` | Do `0x1800b80c0`, CLSID `55fec68a-1300-4425-af00-52a29fca153d` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `HideAllPortValues` | `Application\bin\optasks.dll` | Do `0x1800ba750`, CLSID `a7c8afef-aabf-4bc6-a6cb-505e4065327c` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `MoveICECompoundPort` | `Application\bin\optasks.dll` | Do `0x1800b9df0`, CLSID `f1b5f0c8-a84f-431b-9581-a64349401c84` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `RenameICEPPGLayoutGroup` | `Application\bin\optasks.dll` | Do `0x180004e50`, CLSID `6c0a3174-80f4-4e8b-b6d2-2b617206c665` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `MoveICECompoundPortsAndLayoutGroups` | `Application\bin\optasks.dll` | Do `0x180005580`, CLSID `7713d549-6ba4-4cbc-b57a-7f182e778408` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC-PARTIAL |
| `CreateLayoutGroupInICECompoundNode` | `Application\bin\optasks.dll` | Do `0x180001750`, CLSID `e6a70747-727c-4c59-8967-df7e35f45e4d` | CMD-B12a | [cmd-b12a-optasks-ice-compound-ports-binary.md](../ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md) | SPEC |
| `AddObjectsToShader` | `Application\bin\shadertasks.dll` | Do `0x180038410`, CLSID `c85e1a71-db03-11d2-aa5f-00aa0068d2c0` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC |
| `RemoveObjectsFromShader` | `Application\bin\shadertasks.dll` | Do `0x180038410`, CLSID `187240f1-e211-11d2-aa69-00aa0068d2c0` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC |
| `RemoveShaderFromCnxPoint` | `Application\bin\shadertasks.dll` | Do `0x18000ca50`, CLSID `be45d284-e229-11d2-aa69-00aa0068d2c0` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC |
| `RemoveAllShadersFromCnxPoint` | `Application\bin\shadertasks.dll` | Do `0x18000c060`, CLSID `46919ce1-ec5d-11d2-aa71-00aa0068d2c0` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC |
| `UIMapButton` | `Application\bin\shadertasks.dll` | Do `0x18003a790`, CLSID `34f30cd2-12b8-11d3-aa89-00aa0068d2c0` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `SetInstanceDataValue` | `Application\bin\shadertasks.dll` | Do `0x18004b6f0`, CLSID `fae06638-2003-11d3-a06b-0000f875df68` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `SIGetMaterialShader` | `Application\bin\shadertasks.dll` | Do `0x18000da70`, CLSID `5e28e280-24e7-11d3-bffa-00a0248f9397` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `ReplaceShader` | `Application\bin\shadertasks.dll` | Do `0x180035dc0`, CLSID `91c3b502-3965-11d3-b22e-00a0c9a8ad15` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `ReplaceShaderWithProgID` | `Application\bin\shadertasks.dll` | Do `0x180036a10`, CLSID `5db21aad-4449-4dd8-98a9-745e801059bd` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `ReplaceShaderWithPreset` | `Application\bin\shadertasks.dll` | Do `0x180037310`, CLSID `b5a3c021-3b8c-11d3-b22e-00a0c9a8ad15` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC |
| `SIRebindByNameUserData` | `Application\bin\shadertasks.dll` | Do `0x1800454f0`, CLSID `4a1613c1-572c-4d7d-8e95-19271f58b0fc` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `RenamePropAndRebind_Internal` | `Application\bin\shadertasks.dll` | Do `0x180048af0`, CLSID `cf3d546a-458d-4d02-ace0-b39ee913fdda` | CMD-B12f | [cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md](../ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md) | SPEC-PARTIAL |
| `CreateShaderCompound` | `Application\bin\shadertasks.dll` | Do `0x180011cc0`, CLSID `3b0965e0-dc2f-4bb6-818d-08cd2c3c6211` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `NestShaders` | `Application\bin\shadertasks.dll` | Do `0x180024c50`, CLSID `482fe713-3adc-4a55-a11c-1c5d7d923266` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `UnnestShaders` | `Application\bin\shadertasks.dll` | Do `0x1800261a0`, CLSID `7939d67b-77af-4649-ad94-7afa93943562` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `AddShaderCompoundPort` | `Application\bin\shadertasks.dll` | Do `0x18000f9e0`, CLSID `b4eca6f7-0b60-4769-a13f-fe8d1d0d404e` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `RemoveShaderCompoundPort` | `Application\bin\shadertasks.dll` | Do `0x18001c580`, CLSID `4429f144-8c5d-499c-aafe-cbdc9ca57044` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `MoveShaderCompoundPort` | `Application\bin\shadertasks.dll` | Do `0x1800193d0`, CLSID `b88b985e-20e0-4771-b85c-d45d5027ddcd` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `RenameShaderCompoundPort` | `Application\bin\shadertasks.dll` | Do `0x180020480`, CLSID `41deb46b-b08f-4adb-a253-2427ed78b8e7` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `ExportShaderCompound` | `Application\bin\shadertasks.dll` | Do `0x18004f680`, CLSID `b1679add-fd7a-4e8c-acea-45ef795e7f7d` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `ImportShaderCompound` | `Application\bin\shadertasks.dll` | Do `0x180051ad0`, CLSID `34f0f2e9-6f5b-4ace-a4a3-55c5ecb319f2` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `ExplodeShaderCompound` | `Application\bin\shadertasks.dll` | Do `0x1800161c0`, CLSID `c95d3960-2733-4383-a941-833de2aa502c` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `SetShaderCompoundProperties` | `Application\bin\shadertasks.dll` | Do `0x180022aa0`, CLSID `6e1f9169-09f8-4915-8b7a-68446ca86a37` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `SetShaderCompoundPortProperties` | `Application\bin\shadertasks.dll` | Do `0x180021f20`, CLSID `a5485033-b832-40fd-ba19-41752d542b81` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `GetShaderCompoundPortProperties` | `Application\bin\shadertasks.dll` | Do `0x1800172a0`, CLSID `28a7cd73-9a39-4175-8539-53d8069dbffa` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `ExportShaderTree` | `Application\bin\shadertasks.dll` | Do `0x1800511a0`, CLSID `60c4f494-a0e4-42d6-b260-3ad35ae3497f` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `ImportShaderTree` | `Application\bin\shadertasks.dll` | Do `0x180051ad0`, CLSID `4127c28c-fde9-4325-bdd9-aafc0a83a9ba` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC |
| `ExportShaderDefinition` | `Application\bin\shadertasks.dll` | Do `0x18004fd60`, CLSID `de3bfbe1-eab2-4a5d-a9d4-60ad12a00d8b` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `ReplaceShadersDefinition` | `Application\bin\shadertasks.dll` | Do `0x180054760`, CLSID `3323a961-6741-4860-8504-a54f490e0417` | CMD-B12g | [cmd-b12g-shadertasks-compounds-trees-binary.md](../ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md) | SPEC-PARTIAL |
| `BvrInitActor` | `Application\Plugins\bvrexport.dll` | `Initialize_Execute` `0x180006b80` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrSetHome` | `Application\Plugins\bvrexport.dll` | `SetHome_Execute` `0x1800081d0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC-PARTIAL |
| `BvrGotoHome` | `Application\Plugins\bvrexport.dll` | `GotoHome_Execute` `0x180006850` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrGenerateActor` | `Application\Plugins\bvrexport.dll` | `Generate_Execute` `0x1800066e0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC-PARTIAL |
| `BvrSetCOG` | `Application\Plugins\bvrexport.dll` | `SetCOG_Execute` `0x180007af0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrSetFoot` | `Application\Plugins\bvrexport.dll` | `SetFoot_Execute` `0x180008030` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrAddColSphere` | `Application\Plugins\bvrexport.dll` | `AddColSphere_Execute` `0x180005aa0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrAddFloor` | `Application\Plugins\bvrexport.dll` | `AddFloor_Execute` `0x180005c40` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrSetCollisionOnly` | `Application\Plugins\bvrexport.dll` | `SetCollisionOnly_Execute` `0x180007c80` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrSetVisualOnly` | `Application\Plugins\bvrexport.dll` | `SetVisualOnly_Execute` `0x180008370` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrSetDefault` | `Application\Plugins\bvrexport.dll` | `SetDefault_Execute` `0x180007ea0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrAddJointLimit` | `Application\Plugins\bvrexport.dll` | `AddJointLimit_Execute` `0x180005dd0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrMakeSkill` | `Application\Plugins\bvrexport.dll` | `MakeSkill_Execute` `0x180007080` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC-PARTIAL |
| `BvrMakeLoop` | `Application\Plugins\bvrexport.dll` | `MakeLoop_Execute` `0x180006d70` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrRenderSetup` | `Application\Plugins\bvrexport.dll` | `RenderSetup_Execute` `0x180007950` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrImportBVHAction` | `Application\Plugins\bvrexport.dll` | `ImportBVHAction_Execute` `0x1800069e0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrAddBVHAction` | `Application\Plugins\bvrexport.dll` | `AddBVHAction_Execute` `0x1800053c0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC-PARTIAL |
| `BvrRemoveCOG` | `Application\Plugins\bvrexport.dll` | `RemoveCOG_Execute` `0x180007390` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrRemoveFoot` | `Application\Plugins\bvrexport.dll` | `RemoveFoot_Execute` `0x180007670` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrRemoveFloor` | `Application\Plugins\bvrexport.dll` | `RemoveFloor_Execute` `0x180007500` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrRemoveJointLimit` | `Application\Plugins\bvrexport.dll` | `RemoveJointLimit_Execute` `0x1800077e0` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC |
| `BvrGenerateRenderSetup` | `Application\Plugins\bvrexport.dll` | `GenerateRenderSetup_Execute` `0x180005f40` | CMD-B13a | [cmd-b13a-bvrexport-behavior-binary.md](../ghidra/cmd-b13a-bvrexport-behavior-binary.md) | SPEC-PARTIAL |
| `UnfoldApply` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldApply_Execute` `0x180014940` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldApplySel` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldApplySel_Execute` `0x180016320` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldAddToCut` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldAddToCut_Execute` `0x180017b60` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldRemoveFromCut` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldRemoveFromCut_Execute` `0x1800186b0` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldSetCut` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldSetCut_Execute` `0x180018930` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldClearCut` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldClearCut_Execute` `0x180017de0` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldSelectCut` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldSelectCut_Execute` `0x180026dc0` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldUpdate` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldUpdate_Execute` `0x180027740` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldPackUpdate` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldPackUpdate_Execute` `0x18001ae50` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldAdjustUpdate` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldAdjustUpdate_Execute` `0x180014090` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldRegularize` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldRegularize_Execute` `0x180015ec0` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `UnfoldRelax` | `Addons\Unfold3D\Application\Plugins\Unfold3D.64.dll` | `UnfoldRelax_Execute` `0x1800160f0` | CMD-B13b | [cmd-b13b-unfold3d-binary.md](../ghidra/cmd-b13b-unfold3d-binary.md) | SPEC |
| `CreateExportCrosswalkOptions` | `Application\Plugins\dotXSIConverter.64.dll` | `CreateExportCrosswalkOptions_Execute` `0x18005e4a0` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC |
| `CreateExportFTKOptions` | `Application\Plugins\dotXSIConverter.64.dll` | `CreateExportFTKOptions_Execute` `0x18005e920` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC |
| `CreateImportCrosswalkOptions` | `Application\Plugins\dotXSIConverter.64.dll` | `CreateImportCrosswalkOptions_Execute` `0x18005eda0` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC |
| `CreateImportFTKOptions` | `Application\Plugins\dotXSIConverter.64.dll` | `CreateImportFTKOptions_Execute` `0x18005f220` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC |
| `CrosswalkVersion` | `Application\Plugins\dotXSIConverter.64.dll` | `CrosswalkVersion_Execute` `0x1800668b0` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC |
| `ExportCrosswalk` | `Application\Plugins\dotXSIConverter.64.dll` | `ExportCrosswalk_Execute` `0x18006a5a0` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `ExportFTK` | `Application\Plugins\dotXSIConverter.64.dll` | `ExportFTK_Execute` `0x18006ac00` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `ImportCrosswalk` | `Application\Plugins\dotXSIConverter.64.dll` | `ImportCrosswalk_Execute` `0x18006bb50` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `ImportFTK` | `Application\Plugins\dotXSIConverter.64.dll` | `ImportFTK_Execute` `0x18006c2a0` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `CrosswalkExportMatLib` | `Application\Plugins\dotXSIConverter.64.dll` | `CrosswalkExportMatLib_Execute` `0x180060400` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `CrosswalkImportMatLib` | `Application\Plugins\dotXSIConverter.64.dll` | `CrosswalkImportMatLib_Execute` `0x180063150` | CMD-B13c | [cmd-b13c-dotxsiconverter-binary.md](../ghidra/cmd-b13c-dotxsiconverter-binary.md) | SPEC-PARTIAL |
| `CleanTagsFromRig` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `CleanTagsFromRig_Execute` `0x180009480` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `RemoveMOTOROperators` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RemoveMOTOROperators_Execute` `0x18000bf30` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `RemoveAllMotorPropsAndOps` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RemoveAllMotorPropsAndOps_Execute` `0x18000bca0` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `RetargetExtractStartFrame` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RetargetExtractStartFrame_Execute` `0x18000cc20` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `RetargetExtractEndFrame` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RetargetExtractEndFrame_Execute` `0x18000ca00` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `SaveMOTORAdjustmentPresetFile` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `SaveMOTORAdjustmentPresetFile_Execute` `0x18000e120` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC |
| `LoadMOTORAdjustmentPresetFile` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `LoadMOTORAdjustmentPresetFile_Execute` `0x18000a1e0` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `LoadTagTemplateFile` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `LoadTagTemplateFile_Execute` `0x18000ad40` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `InheritRetargetSetup` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `InheritRetargetSetup_Execute` `0x180009c50` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `SaveTagTemplateFile` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `SaveTagTemplateFile_Execute` `0x18000ed60` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `LoadMotorFile` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `LoadMotorFile_Execute` `0x18000a760` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `RetargetBVH` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RetargetBVH_Execute` `0x18000c1c0` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `RetargetC3DData` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `RetargetC3DData_Execute` `0x18000c680` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `SaveC3DPoseMap` | `Addons\MotionTransformation\Application\Plugins\CDKMotionTransform.64.dll` | `SaveC3DPoseMap_Execute` `0x18000d8e0` | CMD-B13d | [cmd-b13d-motiontransform-binary.md](../ghidra/cmd-b13d-motiontransform-binary.md) | SPEC-PARTIAL |
| `poMDDFrames` | `Addons\PointOven\Application\Plugins\PO_MDDScriptTools.64.dll` | `poMDDFrames_Execute` `0x1800025e0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `poMDDPoints` | `Addons\PointOven\Application\Plugins\PO_MDDScriptTools.64.dll` | `poMDDPoints_Execute` `0x180002bd0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `poMDDTimes` | `Addons\PointOven\Application\Plugins\PO_MDDScriptTools.64.dll` | `poMDDTimes_Execute` `0x1800032b0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `poMDDFrameData` | `Addons\PointOven\Application\Plugins\PO_MDDScriptTools.64.dll` | `poMDDFrameData_Execute` `0x180001880` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `CrowdFBXPlot_ExportMode` | `Addons\CrowdFX\Application\Plugins\CrowdFX.64.dll` | `CrowdFBXPlot_ExportMode_Execute` `0x18000d380` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `CrowdFBXPlot_ExportBegin` | `Addons\CrowdFX\Application\Plugins\CrowdFX.64.dll` | `CrowdFBXPlot_ExportBegin_Execute` `0x18000c070` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `CrowdFBXPlot_ExportEnd` | `Addons\CrowdFX\Application\Plugins\CrowdFX.64.dll` | `CrowdFBXPlot_ExportEnd_Execute` `0x18000cfb0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `FBXPlotAndExportCrowd` | `Addons\CrowdFX\Application\Plugins\CrowdFX.64.dll` | `FBXPlotAndExportCrowd_Execute` `0x18000d5f0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `FindUltimapperDistance` | `Application\Plugins\ultimapper.dll` | `FindUltimapperDistance_Execute` `0x180002f90` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `GenerateUltimapper` | `Application\Plugins\ultimapper.dll` | `GenerateUltimapper_Execute` `0x1800032e0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `fr_AddSamplerDataCache` | `Application\Plugins\ShapeWeight.64.dll` | `fr_AddSamplerDataCache_Execute` `0x180005450` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `fr_ApplyShapeWeightOp` | `Application\Plugins\ShapeWeight.64.dll` | `fr_ApplyShapeWeightOp_Execute` `0x180005830` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `PO_XSI_ImportLWO` | `Addons\PointOven\Application\Plugins\PO_XSI_ImportLWO.64.dll` | `PO_XSI_ImportLWO_Execute` `0x1800112a0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `XSI_Import_POScene` | `Addons\PointOven\Application\Plugins\PO_XSI_ImportLWO.64.dll` | `XSI_Import_POScene_Execute` `0x18000e6f0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `PO_XSI_ExportLWO` | `Addons\PointOven\Application\Plugins\PO_XSI_ExportLWO.64.dll` | `PO_XSI_ExportLWO_Execute` `0x1800011c0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `PO_XSI_Baker` | `Addons\PointOven\Application\Plugins\PO_XSI_Baker.64.dll` | `PO_XSI_Baker_Execute` `0x180009ba0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `ClearRealtimeShaderCache` | `Application\Plugins\HWParsers.dll` | `ClearRealtimeShaderCache_Execute` `0x1800246a0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `DXExport` | `Application\Plugins\DirectXExport.dll` | `DXExport_Execute` `0x180007180` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `DXImport` | `Application\Plugins\DirectXImport.dll` | `DXImport_Execute` `0x180005410` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `BoneCreateTool_UpdateBone` | `Application\Plugins\BoneCreateTool.dll` | `BoneCreateTool_UpdateBone_Execute` `0x1800041e0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC |
| `Applypolymatricks` | `Application\Plugins\polymatricks.dll` | `Applypolymatricks_Execute` `0x180001000` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `FR_Import_Animation_Rig_To_ICE` | `Application\Plugins\FR_ICE_Import.64.dll` | `FR_Import_Animation_Rig_To_ICE_Execute` `0x1800037e0` | CMD-B13e | [cmd-b13e-small-plugins-binary.md](../ghidra/cmd-b13e-small-plugins-binary.md) | SPEC-PARTIAL |
| `fr_FileDelete` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FileDelete_Execute` `0x180123c70` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sget` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sget_Execute` `0x180030ba0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_GetCurrentObjState` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetCurrentObjState_Execute` `0x1801ac070` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_IsDesigner` | `FaceRobot\Application\Plugins\FR.dll` | `fr_IsDesigner_Execute` `0x1801ac070` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_GetCommand` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetCommand_Execute` `0x1801abce0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sdump` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sdump_Execute` `0x180030880` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_Mute` | `FaceRobot\Application\Plugins\FR.dll` | `fr_Mute_Execute` `0x18011c050` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sstring` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sstring_Execute` `0x1800313d0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_Callstack_IsDebugMode` | `FaceRobot\Application\Plugins\FR.dll` | `fr_Callstack_IsDebugMode_Execute` `0x18011d370` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_NeighborIndex` | `FaceRobot\Application\Plugins\FR.dll` | `fr_NeighborIndex_Execute` `0x18018af40` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC (B15-FR, cmd-b15-fr-pr189-answers.md) |
| `fr_GetFaceModel` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetFaceModel_Execute` `0x18000dcf0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC-PARTIAL |
| `GetFaceWeightMap` | `FaceRobot\Application\Plugins\FR.dll` | `GetFaceWeightMap_Execute` `0x18000d3a0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_AddToGroup` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AddToGroup_Execute` `0x180121ea0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_GlueMeshGlobal` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GlueMeshGlobal_Execute` `0x180122600` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sdelete` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sdelete_Execute` `0x1800306c0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `GetFaceCluster` | `FaceRobot\Application\Plugins\FR.dll` | `GetFaceCluster_Execute` `0x18000cff0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_GetOperatorsInStack` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetOperatorsInStack_Execute` `0x18018a760` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sindices` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sindices_Execute` `0x180030e80` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_FileWrite` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FileWrite_Execute` `0x180124260` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_Visible` | `FaceRobot\Application\Plugins\FR.dll` | `fr_Visible_Execute` `0x180122ab0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_RepairNan` | `FaceRobot\Application\Plugins\FR.dll` | `fr_RepairNan_Execute` `0x18011ea70` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC (B15-FR, cmd-b15-fr-pr189-answers.md) |
| `fr_MuteSources` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MuteSources_Execute` `0x18000df70` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC (B15-FR, cmd-b15-fr-pr189-answers.md) |
| `fr_sset` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sset_Execute` `0x180031070` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_AddObjectInPlace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AddObjectInPlace_Execute` `0x1801217a0` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC (B15-FR, cmd-b15-fr-pr189-answers.md) |
| `fr_GetNormalArray` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetNormalArray_Execute` `0x18018a280` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_FileRead` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FileRead_Execute` `0x180123e10` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_GetPointArray` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetPointArray_Execute` `0x18018ac80` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_sfeatures` | `FaceRobot\Application\Plugins\FR.dll` | `fr_sfeatures_Execute` `0x180030a60` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC-PARTIAL |
| `fr_GetFilesForBrowser` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetFilesForBrowser_Execute` `0x18011a860` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_PrepareExport` | `FaceRobot\Application\Plugins\FR.dll` | `fr_PrepareExport_Execute` `0x18000e320` | CMD-B14a | [cmd-b14a-fr-utilities-storage.md](../ghidra/cmd-b14a-fr-utilities-storage.md) | SPEC |
| `fr_SculptBegin` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptBegin_Execute` `0x1801029e0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_SculptEyelidBegin` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptEyelidBegin_Execute` `0x180102d60` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_SculptPuffingBegin` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptPuffingBegin_Execute` `0x180103020` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_SculptTendonBegin` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptTendonBegin_Execute` `0x180103240` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_DeleteAllSculptSessions` | `FaceRobot\Application\Plugins\FR.dll` | `fr_DeleteAllSculptSessions_Execute` `0x1801136b0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_InspectSculptHistory` | `FaceRobot\Application\Plugins\FR.dll` | `fr_InspectSculptHistory_Execute` `0x1801145b0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_RefreshSculptHistory` | `FaceRobot\Application\Plugins\FR.dll` | `fr_RefreshSculptHistory_Execute` `0x1801145e0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_MirrorMouthSculpt` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MirrorMouthSculpt_Execute` `0x1800c4ec0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_StickLips` | `FaceRobot\Application\Plugins\FR.dll` | `fr_StickLips_Execute` `0x1800bf4e0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC |
| `fr_SculptEnd` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptEnd_Execute` `0x18010b180` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_SculptEyelidEnd` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptEyelidEnd_Execute` `0x18010b4d0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_SculptPuffingEnd` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptPuffingEnd_Execute` `0x18010b6f0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_SculptTendonEnd` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptTendonEnd_Execute` `0x18010b890` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_ApplySculptPose` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ApplySculptPose_Execute` `0x180112f10` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_DeleteSculptSession` | `FaceRobot\Application\Plugins\FR.dll` | `fr_DeleteSculptSession_Execute` `0x180113ec0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_ToggleMuteSculptSession` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ToggleMuteSculptSession_Execute` `0x1801149e0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_MirrorSculpt` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MirrorSculpt_Execute` `0x1800f42e0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_SculptMouthBegin` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptMouthBegin_Execute` `0x1800c51a0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_SculptMouthEnd` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SculptMouthEnd_Execute` `0x1800c54d0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_AdjustMetaMouth` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AdjustMetaMouth_Execute` `0x1800ef080` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_ProxyMouth` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ProxyMouth_Execute` `0x1800ef0b0` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_VectorMouth` | `FaceRobot\Application\Plugins\FR.dll` | `fr_VectorMouth_Execute` `0x1800f0590` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `fr_ResetControllerDB` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ResetControllerDB_Execute` `0x1800eff50` | CMD-B14b | [cmd-b14b-fr-sculpt-mouth.md](../ghidra/cmd-b14b-fr-sculpt-mouth.md) | SPEC-PARTIAL |
| `AddFaceControl` | `FaceRobot\Application\Plugins\FR.dll` | `AddFaceControl_Execute` `0x180007af0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `MakeFaceStructure` | `FaceRobot\Application\Plugins\FR.dll` | `MakeFaceStructure_Execute` `0x18000dae0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_MakeEyeBall` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MakeEyeBall_Execute` `0x18004f470` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `MakeEyeRig` | `FaceRobot\Application\Plugins\FR.dll` | `MakeEyeRig_Execute` `0x180079580` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `MakeEyelids` | `FaceRobot\Application\Plugins\FR.dll` | `MakeEyelids_Execute` `0x180070d90` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `RegenerateEyelids` | `FaceRobot\Application\Plugins\FR.dll` | `RegenerateEyelids_Execute` `0x180071410` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_GetEyelashMedian` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetEyelashMedian_Execute` `0x1800507a0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_AnimateEyes` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AnimateEyes_Execute` `0x18011a5b0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_EyelidsDeformCurves` | `FaceRobot\Application\Plugins\FR.dll` | `fr_EyelidsDeformCurves_Execute` `0x18011a6b0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_EyelidsInfluenceMaps` | `FaceRobot\Application\Plugins\FR.dll` | `fr_EyelidsInfluenceMaps_Execute` `0x18011a6e0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawDeflationEaseInCurves` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawDeflationEaseInCurves_Execute` `0x18011b370` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawFattening` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawFattening_Execute` `0x18011b690` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawLowerDeflation` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawLowerDeflation_Execute` `0x18011b850` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawSlidingEaseInCurves` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawSlidingEaseInCurves_Execute` `0x18011ba10` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawSliding` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawSliding_Execute` `0x18011bbd0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_JawUpperDeflation` | `FaceRobot\Application\Plugins\FR.dll` | `fr_JawUpperDeflation_Execute` `0x18011bd90` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_MapRegion` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MapRegion_Execute` `0x18009c600` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_MapStress` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MapStress_Execute` `0x18009c720` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_MapTendon` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MapTendon_Execute` `0x18009c9a0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_StartRegionPaint` | `FaceRobot\Application\Plugins\FR.dll` | `fr_StartRegionPaint_Execute` `0x18009cac0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_ToggleShowMaps` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ToggleShowMaps_Execute` `0x18009d280` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_ToggleShowMapsUnselected` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ToggleShowMapsUnselected_Execute` `0x18009d150` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_ApplyStress` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ApplyStress_Execute` `0x180190e20` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_MakeNormalMap` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MakeNormalMap_Execute` `0x180191130` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_MakeRegionMasks` | `FaceRobot\Application\Plugins\FR.dll` | `fr_MakeRegionMasks_Execute` `0x180196b30` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_AnimateRegionMasks` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AnimateRegionMasks_Execute` `0x1801967a0` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC-PARTIAL |
| `fr_RemoveTongue` | `FaceRobot\Application\Plugins\FR.dll` | `fr_RemoveTongue_Execute` `0x180099280` | CMD-B14c | [cmd-b14c-fr-eyes-jaw-regions.md](../ghidra/cmd-b14c-fr-eyes-jaw-regions.md) | SPEC |
| `fr_LoadC3D` | `FaceRobot\Application\Plugins\FR.dll` | `fr_LoadC3D_Execute` `0x180168d40` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_WriteC3D` | `FaceRobot\Application\Plugins\FR.dll` | `fr_WriteC3D_Execute` `0x180169e60` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_C3DDebugFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_C3DDebugFace_Execute` `0x180167490` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_C3DToFaceRobot` | `FaceRobot\Application\Plugins\FR.dll` | `fr_C3DToFaceRobot_Execute` `0x180167830` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_CalibrateFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_CalibrateFace_Execute` `0x180167e20` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_LogFaceCalibration` | `FaceRobot\Application\Plugins\FR.dll` | `fr_LogFaceCalibration_Execute` `0x180169230` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_AdjustRetargetedFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_AdjustRetargetedFace_Execute` `0x180166ff0` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_CalibrateRetargetedFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_CalibrateRetargetedFace_Execute` `0x180168920` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_FlushRetargetedFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FlushRetargetedFace_Execute` `0x180168c80` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_PlotRetargetedFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_PlotRetargetedFace_Execute` `0x180169760` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_PlotRetargetedFaceUI` | `FaceRobot\Application\Plugins\FR.dll` | `fr_PlotRetargetedFaceUI_Execute` `0x180169480` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_SaveFacePose` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SaveFacePose_Execute` `0x180169c10` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_ApplyFacePose` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ApplyFacePose_Execute` `0x180167020` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_CreateFaceMap` | `FaceRobot\Application\Plugins\FR.dll` | `fr_CreateFaceMap_Execute` `0x180168950` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_FacialMocapTools` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FacialMocapTools_Execute` `0x180168c50` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `FaceRobot` | `FaceRobot\Application\Plugins\FR.dll` | `FaceRobot_Execute` `0x1801a9450` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC-PARTIAL |
| `fr_GetCurrentStage` | `FaceRobot\Application\Plugins\FR.dll` | `fr_GetCurrentStage_Execute` `0x1800107a0` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_SwitchFaceLayout` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SwitchFaceLayout_Execute` `0x18011ce80` | CMD-B14d | [cmd-b14d-fr-retarget-mocap.md](../ghidra/cmd-b14d-fr-retarget-mocap.md) | SPEC |
| `fr_ExportLWScene` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportLWScene_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ExportModel` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportModel_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ExportMotionFile` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportMotionFile_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ExportPointOvenCache` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportPointOvenCache_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ExportPointOvenScene` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportPointOvenScene_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ExportShape` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportShape_Execute` `0x180119cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ApplyFaceRobotGameShader` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ApplyFaceRobotGameShader_Execute` `0x180170770` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ClipWeights` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ClipWeights_Execute` `0x180174cb0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_ShakeFit` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ShakeFit_Execute` `0x180199230` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC |
| `fr_CrawlToVertex` | `FaceRobot\Application\Plugins\FR.dll` | `fr_CrawlToVertex_Execute` `0x180197d30` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC (B15-FR, cmd-b15-fr-pr189-answers.md) |
| `fr_FitTongue` | `FaceRobot\Application\Plugins\FR.dll` | `fr_FitTongue_Execute` `0x180061e60` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_SolveTongue` | `FaceRobot\Application\Plugins\FR.dll` | `fr_SolveTongue_Execute` `0x180099950` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_RegenerateMouth` | `FaceRobot\Application\Plugins\FR.dll` | `fr_RegenerateMouth_Execute` `0x1800ef2c0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_DuplicateFace` | `FaceRobot\Application\Plugins\FR.dll` | `fr_DuplicateFace_Execute` `0x1801778a0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_DeformerToWeightMap` | `FaceRobot\Application\Plugins\FR.dll` | `fr_DeformerToWeightMap_Execute` `0x18019f050` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_DeformerTransfer` | `FaceRobot\Application\Plugins\FR.dll` | `fr_DeformerTransfer_Execute` `0x18019f520` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_EnvelopeAliasing` | `FaceRobot\Application\Plugins\FR.dll` | `fr_EnvelopeAliasing_Execute` `0x18017bce0` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `fr_ExportGameHierarchy` | `FaceRobot\Application\Plugins\FR.dll` | `fr_ExportGameHierarchy_Execute` `0x180187920` | CMD-B14e | [cmd-b14e-fr-export-weights.md](../ghidra/cmd-b14e-fr-export-weights.md) | SPEC-PARTIAL |
| `SICreateModel` | `Application\bin\modeltasks.dll` | Do `0x18000a190`, worker `0x180009bd0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIMergeScene` | `Application\bin\modeltasks.dll` | Do `0x180032320`, worker `0x18002df80` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC-PARTIAL |
| `SIImportModel` | `Application\bin\modeltasks.dll` | Do `0x180023eb0`, worker `0x180023ab0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIGetModel` | `Application\bin\modeltasks.dll` | Do stub `0x180016690`, worker `0x1800160c0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIImportIges` | `Application\bin\modeltasks.dll` | Do `0x18001a2a0`, worker `0x180019c90` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIExportIges` | `Application\bin\modeltasks.dll` | Do `0x18000f030`, worker `0x18000e980` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `MergeMixer` | `Application\bin\modeltasks.dll` | Do `0x18001db00`, worker slot 10 `0x18001d850` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `ImportMixer` | `Application\bin\modeltasks.dll` | same task as MergeMixer | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIImportMatLib` | `Application\bin\modeltasks.dll` | Do `0x18001bae0`, worker `0x18001ad60` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SIImportReferencedMatLib` | `Application\bin\modeltasks.dll` | same task, ShareOptions 1 | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `ExportMaterialLibrary` | `Application\bin\modeltasks.dll` | Do `0x180010760`, worker `0x1800103c0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `GetLightListOnModelClip` | `Application\bin\modeltasks.dll` | worker `0x180015240` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SetLightListOnModelClip` | `Application\bin\modeltasks.dll` | Do stub `0x18003a8e0`, worker `0x18003a7d0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SISetResolutionOfRefModels` | `Application\bin\modeltasks.dll` | Do stub `0x18003b580`, worker `0x18003add0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `RemoveRefModelResolution` | `Application\bin\modeltasks.dll` | Do `0x1800015d0`, worker `0x1800012d0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `AddRefModelResolution` | `Application\bin\modeltasks.dll` | same task as RemoveRefModelResolution | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `SICreateRefModel` | `Application\bin\modeltasks.dll` | Do `0x18000bbb0`, worker `0x18000b6a0` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `CreateEmptyRefModel` | `Application\bin\modeltasks.dll` | same task as SICreateRefModel | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `ApplyDelta` | `Application\bin\modeltasks.dll` | Do stub `0x180001d90`, worker `0x180001b60` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC |
| `ImportReferencedDelta` | `Application\bin\modeltasks.dll` | Do `0x1800179d0`, worker `0x180017140` | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC-PARTIAL |
| `ImportDelta` | `Application\bin\modeltasks.dll` | same task as ImportReferencedDelta | CMD-B15a | [cmd-b15a-modeltasks.md](../ghidra/cmd-b15a-modeltasks.md) | SPEC-PARTIAL |
| `SIAddCustomParam` | `Application\bin\propertytasks.dll` | Do `0x180001ca0`, worker `0x180014380` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `SICreateMaterialDD` | `Application\bin\propertytasks.dll` | Do `0x180023100`, worker `0x180022660` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `CreateUserNormals` | `Application\bin\propertytasks.dll` | Do stub `0x180037fb0` → `0x180033dc0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `RemoveUserNormals` | `Application\bin\propertytasks.dll` | Do stub `0x180037fb0` → `0x18001a0c0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SetVertexUserNormals` | `Application\bin\propertytasks.dll` | Do stub `0x180037fb0` → `0x180036e70` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SetPolygonUserNormals` | `Application\bin\propertytasks.dll` | Do stub `0x180037fb0` → `0x1800329c0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SetUserNormalValues` | `Application\bin\propertytasks.dll` | Do `0x180036740`, worker `0x180035610` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIAddShaderEntryToOverride` | `Application\bin\propertytasks.dll` | Do `0x180047aa0`, worker `0x180046dd0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIAddParameterEntryToOverride` | `Application\bin\propertytasks.dll` | same task (51297d82) | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIAddConnectionEntryToOverride` | `Application\bin\propertytasks.dll` | same task (51297d82) | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIRemoveEntryFromOverride` | `Application\bin\propertytasks.dll` | Do `0x1800502f0`, worker `0x18004fae0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIGetOriginalValueOfOverridden` | `Application\bin\propertytasks.dll` | Do `0x18004c6d0`, worker `0x18004b980` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `SIGetOverriddenParameters` | `Application\bin\propertytasks.dll` | Do `0x18004b2f0`, worker `0x18004abf0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `Add property extended` | `Application\bin\propertytasks.dll` | Do `0x180038d10` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `siCreateRetargetMapping` | `Application\bin\propertytasks.dll` | Do `0x180024560`, worker `0x180023b60` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC-PARTIAL |
| `siWriteRetargetMapping` | `Application\bin\propertytasks.dll` | Do `0x18003d0c0`, worker `0x18003ceb0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `siWriteRetargetComponentData` | `Application\bin\propertytasks.dll` | Do `0x18003c040`, worker `0x18003b980` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `SetClusterPropertyValues` | `Application\bin\propertytasks.dll` | Do `0x18001be30`, worker `0x18001b4c0` | CMD-B15b | [cmd-b15b-propertytasks.md](../ghidra/cmd-b15b-propertytasks.md) | SPEC |
| `ConnectWeightMapToComponent` | `Application\bin\sparks.dll` | Do `0x1801459f0`, worker `0x1801455a0` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `ConnectParticleInitState` | `Application\bin\sparks.dll` | Do `0x180144fd0`, worker `0x180144a00` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `DisconnectParticleInitState` | `Application\bin\sparks.dll` | Do `0x1801472f0`, worker `0x180146f30` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `SetParticleInitState` | `Application\bin\sparks.dll` | Do `0x1801497c0`, worker `0x180149660` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `UpdateParticleTypeConnections` | `Application\bin\sparks.dll` | Do `0x18014d690` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `AddParticleEmitter` | `Application\bin\sparks.dll` | Do stub `0x18013bd60`, worker `0x18013b260` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `AddParticleObstacle` | `Application\bin\sparks.dll` | Do `0x180140410`, worker `0x180140250` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `AddParticles` | `Application\bin\sparks.dll` | Do `0x180142f50`, worker `0x180141a90` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `SetParticleType` | `Application\bin\sparks.dll` | Do `0x18014a780` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `CreateParticleType` | `Application\bin\sparks.dll` | Do stub `0x180146460`, worker `0x1801462c0` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `SIAddParticleGoal` | `Application\bin\sparks.dll` | Do `0x18013e620`, worker `0x18013e450` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `CreateEventSource` | `Application\bin\sparks.dll` | Do stub `0x18013d180`, worker `0x18013c780` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `AddUserParameter` | `Application\bin\sparks.dll` | Do `0x1801440c0`, worker `0x180143d80` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `RemoveUserParameter` | `Application\bin\sparks.dll` | Do `0x180147bb0`, worker `0x180147810` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `SIAddParticleEvent` | `Application\bin\sparks.dll` | Do `0x180141340`, worker `0x1801411f0` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `SetEventObstacle` | `Application\bin\sparks.dll` | Do stub `0x180148eb0`, worker `0x1801485e0` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC-PARTIAL |
| `SIAddParticleForce` | `Application\bin\forces.dll` | Do `0x180001d00`, worker `0x180001b40` | CMD-B15c | [cmd-b15c-particles.md](../ghidra/cmd-b15c-particles.md) | SPEC |
| `SIAddImageSourceOp` | `Application\bin\imageclip.dll` | Do `0x180010bc0`, worker `0x180010590` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `SIAddImageOp` | `Application\bin\imageclip.dll` | Do `0x1800100b0`, worker `0x18000fa00` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `SIAddWritableImageSource` | `Application\bin\imageclip.dll` | Do `0x1800140b0`, worker `0x180013a00` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `SICreateImageClip2` | `Application\bin\imageclip.dll` | Do `0x180015e60`, worker `0x180015010` (mode 2) | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `SICreateDefaultImageClip` | `Application\bin\imageclip.dll` | same handler, mode 4 | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `SetImageSource` | `Application\bin\imageclip.dll` | Do stub `0x18001a7d0`, worker `0x18001a2d0` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `SIAddModelSource` | `Application\bin\imageclip.dll` | Do `0x180013050`, worker `0x180012af0` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `SICreateModelClip` | `Application\bin\imageclip.dll` | Do `0x1800178e0`, worker `0x180016730` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `SIAddModelClip` | `Application\bin\imageclip.dll` | Do `0x1800178b0` (always fails) | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `AddFileCacheSource` | `Application\bin\imageclip.dll` | Do `0x18000e4f0`, worker `0x18000cd00` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `AddFileCacheSource2` | `Application\bin\imageclip.dll` | same task as AddFileCacheSource | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC-PARTIAL |
| `SIAddImageSource` | `Application\bin\imageclip.dll` | Do `0x1800121a0`, worker `0x180011460` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `SIAddImageClip` | `Application\bin\imageclip.dll` | Do `0x18000f310`, worker `0x18000ee50` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `AddAudioClip` | `Application\bin\moaudio.dll` | OnDo `0x18000f610` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `ImportAudio` | `Application\bin\moaudio.dll` | OnDo `0x180011010` | CMD-B15d | [cmd-b15d-clips-sources.md](../ghidra/cmd-b15d-clips-sources.md) | SPEC |
| `MakeRigIcon` | `Application\DSScripts\CharacterRigging\makeRigIcon.js` | `makeRigIcon` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBiped` | `Application\DSScripts\CharacterRigging\makeBiped.js` | `makeBiped` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBipedDogLeg` | `Application\DSScripts\CharacterRigging\makeBipedDogLeg.js` | `makeBipedDogLeg` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeQuadruped` | `Application\DSScripts\CharacterRigging\makeQuadruped.js` | `makeQuadruped` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeTorso` | `Application\DSScripts\CharacterRigging\makeTorso.js` | `makeTorso` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeSpine` | `Application\DSScripts\CharacterRigging\makeSpine.js` | `makeSpine` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeArm` | `Application\DSScripts\CharacterRigging\makeArm.js` | `makeArm` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeHand` | `Application\DSScripts\CharacterRigging\makeHand.js` | `makeHand` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeLeg` | `Application\DSScripts\CharacterRigging\makeLeg.js` | `makeLeg` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeFoot` | `Application\DSScripts\CharacterRigging\makeFoot.js` | `makeFoot` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeDogLeg` | `Application\DSScripts\CharacterRigging\makeDogLeg.js` | `makeDogLeg` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeHead` | `Application\DSScripts\CharacterRigging\makeHead.js` | `makeHead` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBelly` | `Application\DSScripts\CharacterRigging\makeBelly.js` | `makeBelly` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBicepRoll` | `Application\DSScripts\CharacterRigging\makeBicepRoll.js` | `makeBicepRoll` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeForearmRoll` | `Application\DSScripts\CharacterRigging\makeForearmRoll.js` | `makeForearmRoll` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `Make2PointSlide` | `Application\DSScripts\CharacterRigging\make2PointSlide.js` | `make2PointSlide` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeThighSlide` | `Application\DSScripts\CharacterRigging\makeThighSlide.js` | `makeThighSlide` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeJointCompression` | `Application\DSScripts\CharacterRigging\makeJointCompression.js` | `makeJointCompression` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeHip` | `Application\DSScripts\CharacterRigging\makeHip.js` | `makeHip` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeShadowChain` | `Application\DSScripts\CharacterRigging\makeShadowChain.js` | `makeShadowChain` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeShadowSpine` | `Application\DSScripts\CharacterRigging\makeShadowSpine.js` | `makeShadowSpine` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBipedCharacterKeySet` | `Application\DSScripts\CharacterRigging\makeCharacterKeySet.js` | `makeBipedCharacterKeySet` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeQuadrupedCharacterKeySet` | `Application\DSScripts\CharacterRigging\makeCharacterKeySet.js` | `makeQuadrupedCharacterKeySet` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `SetKeyableRig` | `Application\DSScripts\CharacterRigging\makeCharacterKeySet.js` | `setKeyableRig` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `MakeBiped (2nd registration)` | `Application\DSScripts\Charac_RigFromBiped.vbs` | `MakeBipedUI` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC-PARTIAL (file > 64 KB, unread) |
| `MakeBipedDogLeg (2nd registration)` | `Application\DSScripts\Charac_RigFromBiped.vbs` | `MakeBipedDogLegUI` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC-PARTIAL (file > 64 KB, unread) |
| `MakeQuadruped (2nd registration)` | `Application\DSScripts\Charac_RigFromQuadruped.vbs` | `MakeQuadrupedUI` | CMD-B15e | [cmd-b15e-character-rigging-scripts.md](../ghidra/cmd-b15e-character-rigging-scripts.md) | SPEC |
| `CreateInspectParticleTypeSphere` | `Application\DSScripts\particle.vbs` | `CreatePTypeProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateInspectParticleTypeBlob` | `Application\DSScripts\particle.vbs` | `CreatePTypeProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateInspectParticleTypeBillboard` | `Application\DSScripts\particle.vbs` | `CreatePTypeProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateCommandWizard` | `Addons\sdkui\Application\Plugins\CommandWizard.js` | `CreateCommandWizard_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `AddCommandToPlugin` | `Addons\sdkui\Application\Plugins\CommandWizard.js` | `AddCommandToPlugin_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `GenerateCommandPlugin` | `Addons\sdkui\Application\Plugins\CommandWizard.js` | `GenerateCommandPlugin_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreatePluginWizard` | `Addons\sdkui\Application\Plugins\PluginWizard.js` | `CreatePluginWizard_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `SIGeneratePlugin` | `Addons\sdkui\Application\Plugins\PluginWizard.js` | `SIGeneratePlugin_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateToolbarWizard` | `Addons\sdkui\Application\Plugins\ToolbarWizard.js` | `CreateToolbarWizard_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `SIGenerateToolbar` | `Addons\sdkui\Application\Plugins\ToolbarWizard.js` | `SIGenerateToolbar_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateTemplateWizard` | `Addons\sdkui\Application\Plugins\TemplateWizard.js` | `CreateTemplateWizard_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `CreateMRShaderWizard` | `Addons\sdkui\Application\Plugins\ShaderWizard.js` | `CreateMRShaderWizard_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC-PARTIAL (file > 64 KB, unread) |
| `GenerateLipSync` | `Application\DSScripts\EvolverLipSync.js` | `GenerateLipSyncProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `UpgradeShaders` | `Application\DSScripts\UpgradeShaders.vbs` | `UpgradeShaders` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `syCachePaint1` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap1_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `syCachePaint2` | `Addons\Syflex30X50\Application\Plugins\cache.vbs` | `PaintMap2_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `SyGetMassMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetMassMap_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `SyGetSpringMap` | `Addons\Syflex30X50\Application\Plugins\cloth.vbs` | `GetSpringMap_Execute` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `Get default camera` | `Application\DSScripts\primitives.vbs` | `GetPrimCameraDefaultProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `OBJ Import...` | `Application\DSScripts\importexport.vbs` | `WavefrontImport` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC |
| `Save Zero Key Hot Key` | `Application\DSScripts\uixsiscripts.vbs` | `SaveZeroKeyHotKeyProc` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC-PARTIAL (file > 64 KB, inferred) |
| `GenNormalMap` | `GPUSurfaceFX.js (not shipped in the install)` | `XSI_GenerateNormalMap` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC-PARTIAL |
| `GenDiffuseMap` | `GPUSurfaceFX.js (not shipped in the install)` | `XSI_GenerateDiffuseMap` | CMD-B15f | [cmd-b15f-misc-scripts.md](../ghidra/cmd-b15f-misc-scripts.md) | SPEC-PARTIAL |

| `XYZ Transform ` | `Application\bin\toolmanager.dll` | Do `0x180003480`, relay `0x180007680` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `TranslateTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `RotationTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `ScalingTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `LastTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `DirectManipTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairScalingTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairClumpTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairStandOnEndTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairPuffRootsTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairRotateRootTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairRotateTipTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `HairRotateCursorTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `AddParticleTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `SketchCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `AddPointOnCurveToolByKnotPoints` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `AddPointOnCurveToolByCVs` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `AddPointOnCurveToolByBezierKnotPoints` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Add Polygon Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Slice Polygons Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Add Edge Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `AddVertexTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `SplitEdgeTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Split Polygon Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `DelPointOnCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CVNURBSCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `NURBSCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `BezierCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `LinearCurveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Activate Current Select Tool using Filter` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamPanZoomTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamZoomTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamMayaZoomTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamRectZoomTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamOrbitTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamDollyTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamTrackTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamPivotTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamWalkTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamFlyTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamDriveTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamRollTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CamNavigTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Cam3dsMaxNavigTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Delete Components` | `Application\bin\toolmanager.dll` | Do `0x180003790`, session dispatcher `0x180007120` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC-PARTIAL |
| `ManipulateTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `DoNothing` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `TimeSliderTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `VirtualSliderTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `PaintTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `PaintVertexColorTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `PaintTextureTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `ProbeMaterialTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `PaintSelectTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Paint Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Paint Tool` | `Application\bin\toolmanager.dll` | Do `0x180003790`, session dispatcher `0x180007120` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC-PARTIAL |
| `Delete Objects Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `RenderRegionTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Add Surface Point Tool` | `Application\bin\toolmanager.dll` | Do `0x180003790`, session dispatcher `0x180007120` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC-PARTIAL |
| `PickDeformerByVertexTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `MoveComponent Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `MovePointTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `TweakTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `TweakNormalsTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `WeldPointTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CursorTransformTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `PropTransformTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `2D Chain Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `3D Chain Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `ToggleProjectionTool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Pick Session Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `Move Joint Tool` | `Application\bin\toolmanager.dll` | Do `0x180004140` → core `0x180003ea0`, UnPackArg `0x180004330` | CMD-B16a | [cmd-b16a-tool-activation-commands.md](../ghidra/cmd-b16a-tool-activation-commands.md) | SPEC |
| `CreateShaderFromCLSID` | `Application\bin\shadertasks.dll` | Do `0x18002e250`, worker slot 10 `0x18002d0f0` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC |
| `CreateShaderFromProgID` | `Application\bin\shadertasks.dll` | worker slot 11 `0x18002de80` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC |
| `AddShaderAttachedComment` | `Application\bin\shadertasks.dll` | worker slot 12 `0x18002cef0` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC |
| `CreateShadersFromMaterialPreset` | `Application\bin\shadertasks.dll` | worker slot 13 `0x18002d560` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC-PARTIAL |
| `CreateShaderFromPreset` | `Application\bin\shadertasks.dll` | worker slot 9 `0x18002d9b0` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC-PARTIAL |
| `SIAddArrayElement` | `Application\bin\shadertasks.dll` | Do `0x180006f00`, worker `0x180006d30` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC |
| `SIRemoveArrayElement` | `Application\bin\shadertasks.dll` | worker `0x180007b40` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC-PARTIAL |
| `SISwapArrayElements` | `Application\bin\shadertasks.dll` | Do `0x180009880`, worker `0x180009570` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC |
| `SIAppendBone` | `Application\bin\viewinteraction.dll` | Execute `0x180181080`, worker `0x180182060` | CMD-B16b | [cmd-b16b-shader-array-bone-commands.md](../ghidra/cmd-b16b-shader-array-bone-commands.md) | SPEC-PARTIAL |
| `BeginUndo` | `Application\bin\tasks.dll` | b5097d5a row 6 `0x180054dc0` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `EndUndo` | `Application\bin\tasks.dll` | row 7 `0x180054f70` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `Undo` | `Application\bin\tasks.dll` | row 8 `0x180055630` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `Redo` | `Application\bin\tasks.dll` | row 9 `0x1800553f0` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `RefreshCustomPreferences` | `Application\bin\tasks.dll` | row 10 `0x180055520` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `ResetDirectX` | `Application\bin\tasks.dll` | row 14 `0x1800555d0` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `SetDropMessage` | `Application\bin\tasks.dll` | Do `0x180049560` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `DelayedRefresh` | `Application\bin\tasks.dll` | Do `0x18003dbf0` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `RunPerformanceTest` | `Application\bin\tasks.dll` | worker `0x18003ef80` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC-PARTIAL |
| `DeleteObj` | `Application\bin\tasks.dll` | worker `0x180012a40` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC-PARTIAL |
| `DeleteCurrentLayer` | `Application\bin\tasks.dll` | DeleteObj worker `0x180012a40` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `DeleteCurrentPass` | `Application\bin\tasks.dll` | DeleteObj worker `0x180012a40` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC |
| `CopyPaste` | `Application\bin\tasks.dll` | worker `0x1800588c0` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC-PARTIAL |
| `Add3DObjectToScene` | `Application\bin\tasks.dll` | task slot 15 `0x18002da30` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC-PARTIAL |
| `SetReference2` | `Application\bin\tasks.dll` | worker `0x180025630` | CMD-B16c | [cmd-b16c-tasks-undo-refresh-delete.md](../ghidra/cmd-b16c-tasks-undo-refresh-delete.md) | SPEC-PARTIAL |
| `Mesh Filter` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Dice Object/Polygons` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Delete Selected` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Duplicate/Extrude Single` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Duplicate/Extrude Multiple` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Invert Polygons` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Move Component Tool` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `Subdivide` | `Application\bin\scnmgr.dll` | command manager filter-map executor `0x1800330a0` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `MarkObjectDirty` | `Application\bin\scnmgr.dll` | null-handler branch `0x180032fa0` (no task class) | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC |
| `CopyPartition` | `Application\bin\rendercore.dll` | worker `0x180084290` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `RegenerateMaps` | `Application\bin\rendercore.dll` | worker `0x180086d70` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC-PARTIAL |
| `GetSkeleton` | `Application\bin\kinechain.dll` | worker `0x1800021a0`, RePackArg `0x180002490` | CMD-B16d | [cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md](../ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md) | SPEC |
| `TransferAllPropertiesAcrossGenOp` | `Application\bin\optasks.dll` | Do `0x180065640`, worker `0x180064d60` | CMD-B16e | [cmd-b16e-actioncore-optasks-gap-environments.md](../ghidra/cmd-b16e-actioncore-optasks-gap-environments.md) | SPEC-PARTIAL |
| `AddShotClip` | `Application\bin\actioncore.dll` | Do `0x1800439e0`, worker `0x180040a10` | CMD-B16e | [cmd-b16e-actioncore-optasks-gap-environments.md](../ghidra/cmd-b16e-actioncore-optasks-gap-environments.md) | SPEC-PARTIAL |
| `GetShotClip` | `Application\bin\actioncore.dll` | Do `0x180059ba0` | CMD-B16e | [cmd-b16e-actioncore-optasks-gap-environments.md](../ghidra/cmd-b16e-actioncore-optasks-gap-environments.md) | SPEC-PARTIAL |
| `PaintWeights` | `Application\bin\gap.dll` | Do `0x18001d600`, worker `0x18001d230` | CMD-B16e | [cmd-b16e-actioncore-optasks-gap-environments.md](../ghidra/cmd-b16e-actioncore-optasks-gap-environments.md) | SPEC-PARTIAL |

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
- fcurve.dll sha256 70778c1ac396… | 46 handler classes located statically (CLSID in `DllGetClassObject` → factory vtable slot 6 → creation function → task vtable); message catalogue `XSIFCURVE`; CLSIDs present but not served here (callers only): `Lock`/`Unlock`/`Tag`/`Untag`, `AddLayerClip`, `AddTrack`, `AddMarker`, `CycleChecking`
- primtasks.dll sha256 f7dab2efd123… | 34 handler classes located; not served here (callers only): `SIAssignMaterial`, `SelectObj` family, `ParentObj`, `SIAddToGroupLowLevel`, `Add3DObjectToScene`, `SIApplyConstraint`, `InitPropVolume`, `MoveOperator*`, `SIAddToCluster`, `CreateClusterFromSubComponent`, `SICreateModel`
- simeshtasks.dll (11 classes) and sicurvetasks.dll (8 classes): all registry commands with a unique CLSID there are now read (CMD-B8f); callers only: `SelectObj` family, `CreateClusterFromSubComponent`, `GetConnectionSet`, `FreezeObj`
- mohelper.dll sha256 26ac0f054925… | `F3DGetKeyableParams` export ordinal 290 at 0x1800e3b50 (read, see cmd-b8a addendum); exports carry demangled names in Ghidra, so helpers can be decompiled by plain name (`F3DGetAnimSources`, `F3DGetMarkedComponents`, `F3DGetAllAnimationComponents` are the next ones wanted)
- Static locator recipe (2026-11-17): with pefile + capstone, follow the RIP-relative references to each handler CLSID inside `DllGetClassObject`; the first `lea` after the CLSID compare is the factory vtable. When several candidate vtables are installed by the constructor, the task vtable is the one whose slot 10 is `C3DCoreBaseTask::OnUpdateUI` or an override next to `RePackArg`; the first candidate is often the `CDSCOMObject` part

## Registry-declared homes of commands still TODO

(2026-11-19, batch 13: rows of the 17 plug-in DLLs read in CMD-B13a–e removed; the script rows are not re-checked against the current scan.)

From the `file` field of `data/commands_full.json` (self-installing plug-ins and script commands).
Commands with an empty `file` (about 600, built-in C++) are not listed; locate them by string search when a DLL is opened.

| Language | File | Commands | Names |
|----------|------|---------:|-------|
| CPP | `FR.dll` | 110 | `AddFaceControl`, `GetFaceCluster`, `GetFaceWeightMap`, `MakeEyeRig`, `MakeEyelids`, `MakeFaceStructure`, `RegenerateEyelids`, `fr_AddObjectInPlace`, `fr_AddToGroup`, `fr_AdjustMetaMouth`, `fr_AdjustRetargetedFace`, `fr_AnimateEyes`, `fr_AnimateRegionMasks`, `fr_ApplyFacePose`, `fr_ApplyFaceRobotGameShader`, `fr_ApplySculptPose`, `fr_ApplyStress`, `fr_C3DDebugFace`, `fr_C3DToFaceRobot`, `fr_CalibrateFace`, `fr_CalibrateRetargetedFace`, `fr_Callstack_IsDebugMode`, `fr_ClipWeights`, `fr_CrawlToVertex`, `fr_CreateFaceMap`, `fr_DeformerToWeightMap`, `fr_DeformerTransfer`, `fr_DeleteAllSculptSessions`, `fr_DeleteSculptSession`, `fr_DuplicateFace`, `fr_EnvelopeAliasing`, `fr_ExportGameHierarchy`, `fr_ExportLWScene`, `fr_ExportModel`, `fr_ExportMotionFile`, `fr_ExportPointOvenCache`, `fr_ExportPointOvenScene`, `fr_ExportShape`, `fr_EyelidsDeformCurves`, `fr_EyelidsInfluenceMaps`, `fr_FacialMocapTools`, `fr_FileDelete`, `fr_FileRead`, `fr_FileWrite`, `fr_FlushRetargetedFace`, `fr_GetCommand`, `fr_GetCurrentObjState`, `fr_GetEyelashMedian`, `fr_GetFaceModel`, `fr_GetFilesForBrowser`, `fr_GetNormalArray`, `fr_GetOperatorsInStack`, `fr_GetPointArray`, `fr_GlueMeshGlobal`, `fr_InspectSculptHistory`, `fr_IsDesigner`, `fr_JawDeflationEaseInCurves`, `fr_JawFattening`, `fr_JawLowerDeflation`, `fr_JawSliding`, `fr_JawSlidingEaseInCurves`, `fr_JawUpperDeflation`, `fr_LoadC3D`, `fr_LogFaceCalibration`, `fr_MakeEyeBall`, `fr_MakeNormalMap`, `fr_MakeRegionMasks`, `fr_MapRegion`, `fr_MapStress`, `fr_MapTendon`, `fr_MirrorMouthSculpt`, `fr_MirrorSculpt`, `fr_Mute`, `fr_MuteSources`, `fr_NeighborIndex`, `fr_PlotRetargetedFace`, `fr_PlotRetargetedFaceUI`, `fr_PrepareExport`, `fr_ProxyMouth`, `fr_RefreshSculptHistory`, `fr_RemoveTongue`, `fr_RepairNan`, `fr_ResetControllerDB`, `fr_SaveFacePose`, `fr_SculptBegin`, `fr_SculptEnd`, `fr_SculptEyelidBegin`, `fr_SculptEyelidEnd`, `fr_SculptMouthBegin`, `fr_SculptMouthEnd`, `fr_SculptPuffingBegin`, `fr_SculptPuffingEnd`, `fr_SculptTendonBegin`, `fr_SculptTendonEnd`, `fr_ShakeFit`, `fr_StartRegionPaint`, `fr_StickLips`, `fr_ToggleMuteSculptSession`, `fr_ToggleShowMaps`, `fr_ToggleShowMapsUnselected`, `fr_VectorMouth`, `fr_Visible`, `fr_WriteC3D`, `fr_sdelete`, `fr_sdump`, `fr_sfeatures`, `fr_sget`, `fr_sindices`, `fr_sset`, `fr_sstring` |
| VBScript | `uixsiscripts.vbs` | 81 | `AddComponentTool`, `AddImageSource`, `AddModelClip`, `AddModelSource`, `AddToContainer`, `AddWritableImageSource`, `Align`, `ApplyPath`, `AssembleNurbsMesh`, `BipedRigOnUpdate`, `CreateCurve`, `CreateImageClip2`, `CreateModelClip`, `CreateReferencePlane`, `DecreaseManipulatorSize`, `DeleteAllUnusedMaterials`, `DeleteUnusedAnimationSources`, `DeleteUnusedAudioSources`, `DeleteUnusedCacheSources`, `DeleteUnusedImageClips`, `DeleteUnusedImageSources`, `DeleteUnusedMaterials`, `DisplayPortValues`, `ExportPreferences`, `GetShaderOnCnxPointFunction`, `GetViewportUnderMouse`, `GroupPointClouds`, `ImportPreferences`, `IncreaseManipulatorSize`, `InfoGeometry`, `InspectLocks`, `InspectMaterial`, `InspectPreferences`, `InspectSnapProperties`, `InspectTransformProperties`, `InspectViewCubeProperties`, `InstallAddon`, `LoadPreset`, `LockEnvelopeDeformerWeights`, `MakeICETreeBranch`, `ManCharacterOnUpdate`, `MatchTransform`, `MergeScene`, `MoveCtr2Vertices`, `OffsetValueMap`, `ParamBracketing`, `PlotCameraSequencer`, `PromoteICETree`, `RemoveFromContainer`, `RenamePropAndRebind`, `RenamePropAndRebindUI`, `RestoreDefaultPreference`, `RotoscopyOptions`, `SIUpdateCamerasFromGlobalPref`, `SIUpdateFxTreesFromGlobalPref`, `SIUpdatePlayControlFromGlobalPref`, `SaveActionKey`, `SaveKeyOnMarkedKeyable`, `SaveOffsetKeys`, `SavePivotKey`, `SaveShapeKey`, `SetCameraSequencerLayout`, `SetFocusedViewport`, `SetLightingDisplayMode`, `SetNURBSDisplayQualityDefault`, `SetNURBSDisplayQualityHigh`, `SetNURBSDisplayQualityLow`, `SetNURBSDisplayQualityMedium`, `SetTransformRefMode`, `SetTransientReferencePlane`, `SplitCloud`, `StoreGeomApproxProperties`, `StoreMaterialProperties`, `StoreVisibilityProperties`, `SwitchToView`, `SwitchToViewByType`, `ToggleBackgroundColor`, `ToggleContinuousDraw`, `ToggleFullscreenLayout`, `TransferShapeAnimation`, `UnInstallAddon` |
| VBScript | `operators.vbs` | 19 | `AddEdge`, `ApplyDeformBySpine`, `ApplySpringOp`, `BurnAndDeleteGATOROperator`, `ChangeVertexColorDatatype`, `Convert`, `CreateClusterCenter`, `CreateClusterCenterWithNull`, `CreateNonOverlappingCluster`, `CreateSimulationBracket`, `DuplicateMeshComponent`, `DuplicateUsingGeomApprox`, `InsertCurveKnot`, `InspectSpringPropertiesProc`, `MeshSubdivideWithCenter`, `SetRefPlaneFromSymmetrizePolygonOp`, `SetSymmetrizePolygonOpRefPlane`, `SplitPolygon`, `TrimWith` |
| VBScript | `getset.vbs` | 13 | `SyGetCollidePnts`, `SyGetCollidePols`, `SyGetMimic`, `SyGetNail`, `SyGetPin`, `SyGetSelfCollidePols`, `SyPinGetMesh`, `SySetCollidePnts`, `SySetCollidePols`, `SySetMimic`, `SySetNail`, `SySetPin`, `SySetSelfCollidePols` |
| VBScript | `Rendering.vbs` | 13 | `ConnectImageTo3DO`, `CreateCGFX`, `CreateEmptyPartition`, `CreateFX`, `CreatePassWithPartition`, `EditShaderCompoundPPGLogic`, `ExportAllPassesToMI2`, `ExportMI2File`, `GetPass`, `LaunchFlipbookForPass`, `SICreatePartition`, `ShowNextOGLProjection`, `ShowPreviousOGLProjection` |
| JScript | `CacheManager.js` | 10 | `AddToList`, `GetItemsAsString`, `GetObjectsFromSource`, `ReadCachesFile`, `RefreshCachesPathProp`, `RemoveFromList`, `RemoveNumbering`, `SelectionValueToItemName`, `UpdateCacheManager`, `WriteCachesFile` |
| VBScript | `cloth.vbs` | 9 | `SyClearAllCache`, `SyClearCache`, `SyCreateFlesh`, `SyCreateSkin`, `SyGetMassMap`, `SyGetSpringMap`, `SySetMassMap`, `SySetSpringMap`, `sySaveCache` |
| VBScript | `force.vbs` | 8 | `SyCreateAir`, `SyCreateDamp`, `SyCreateGravity`, `SyCreateSpring`, `SyCreateTurbulence`, `SyCreateVolume`, `SyCreateWind`, `SyCreateZipper` |
| VBScript | `simulation.vbs` | 7 | `CacheObjectsIntoFile`, `CacheObjectsIntoFileDialog`, `ChangeEnvironmentDynamicsOperator`, `EditICECompoundPPGLogic`, `MergeSimulationEnvironments`, `StoreEnvironmentCacheToMixer`, `StoreEnvironmentCachesToMixer` |
| VBScript | `collid.vbs` | 5 | `SyCollideGetMesh`, `SyCreateCollideMesh`, `SyCreateCollidePla`, `SyCreateCollideSph`, `SyCreateSelfCollide` |
| VBScript | `constr.vbs` | 4 | `SyCreateMimic`, `SyCreateNail`, `SyCreatePin`, `SySetConstraintMap` |
| VBScript | `duplicate.vbs` | 4 | `CopyAllAnimation2`, `DuplicateFromAnim`, `RemoveAllAnimation`, `SaveKeyAtMultipleFrames` |
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
| VBScript | `RenderManager.vbs` | 2 | `OpenOutputFormatPreferences`, `OverrideMarkedPassParameters` |
| JScript | `ToolbarWizard.js` | 2 | `CreateToolbarWizard`, `SIGenerateToolbar` |
| VBScript | `action.vbs` | 1 | `FindPeriods` |
| VBScript | `CacheManagerVBS.vbs` | 1 | `GetCacheOnFile` |
| VBScript | `Charac_RigFromQuadruped.vbs` | 1 | `MakeQuadruped` |
| VBScript | `Create_Polygonizer_PolymeshPlugin.vbs` | 1 | `Create_Polygonizer_Polymesh` |
| JScript | `EvolverLipSync.js` | 1 | `GenerateLipSync` |
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
| CPP | `Polygonizer.64.dll` | 1 | `ApplyPolygonizer` |
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
| `InspectObj` | `uixsiscripts.vbs` (VBScript) | `InspectObjProc` |
| `SetValue` | (CLSID not specific to one binary) | CLSID `{c089b901-8481-11d2-b118-00a024c79287}` |
| `GetValue` | `tasks.dll` | CLSID `{32455721-e6bc-11d2-ac79-00a02485cecb}` |
| `SetReference2` | `shadertasks.dll`, `tasks.dll`, `shaderhelper.dll`, `sicoresdk.dll` | CLSID `{de9980e7-3d8e-41fd-9fea-ed65f79a6d62}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `AutoInspect` | `uixsiscripts.vbs` (VBScript) | `AutoInspectProc` |
| `AutoInspectEnabled` | `uixsiscripts.vbs` (VBScript) | `FAutoInspectEnabled` |
| `InspectEnvelopeWeights` | `uixsiscripts.vbs` (VBScript) | `InspectEnvelopeWeightsProc` |
| `SetUserPref` | `tasks.dll` | CLSID `{6f80466d-06f2-11d3-80d5-00a0c9ac19a9}` |
| `GetBBox` | `tasks.dll` | CLSID `{3329ba54-fe3c-11d2-bc28-00a0c9612b97}` |
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
| `FreezeObj` | `optasks.dll`, `propertytasks.dll`, `sicurvetasks.dll`, `tasks.dll`, `action.dll`, `corehelper.dll` … | CLSID `{761b65c4-2f0a-11d3-9196-00a0243e34c4}` |
| `FreezeModeling` | `uixsiscripts.vbs` (VBScript) | `FreezeModelingProc` |
| `InspectLastOperator` | `tasks.dll` | CLSID `{ee0d5df0-58e0-11d4-bc9c-00d0b719022b}` |
| `Freeze Selected` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `Delete Selected Branch` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `DeleteMotionDerivator` | `optasks.dll` | CLSID `{38b25a31-26da-11d4-8bd6-009027bc381b}` |
| `DeleteAll` | `tasks.dll` | CLSID `{6e4d3de5-5ad1-48fa-9811-49f8be59a576}` |
| `Duplicate` | `duplicate.vbs` (VBScript) | `DuplicateProc` |
| `Clone` | `duplicate.vbs` (VBScript) | `CloneProc` |
| `SIDuplicate` | (CLSID not specific to one binary) | CLSID `{747d257f-d01b-11d2-80c4-00a0c9ac19a9}` |
| `DuplicateSymmetry` | `duplicate.vbs` (VBScript) | `DuplicateSymmetryFunc` |
| `Duplicate/Extrude Single` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Duplicate/Extrude Multiple` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Instance` | `duplicate.vbs` (VBScript) | `OldInstanceToCloneProc` |
| `SIGetPreset` | `tasks.dll` | CLSID `{393c6ad2-e6b4-11d2-a02c-0000f875df68}` |
| `Add3DObjectToScene` | `modeltasks.dll`, `primtasks.dll`, `tasks.dll`, `_3dobject2.dll`, `scnmgr.dll`, `sicoresdk.dll` | CLSID `{a0d59008-3e15-11d3-8bac-00a024ee586f}` |
| `CreateEnvironment` | `tasks.dll`, `corehelper.dll`, `environments.dll` | CLSID `{98531be5-b33d-46fa-80d4-41d795584ad5}` |
| `SetCurrentEnvironment` | `environments.dll` | CLSID `{9b4cc51c-20c2-4d0d-9c7c-abdd509b55ca}` |
| `AddContainerToEnvironment` | `tasks.dll`, `environments.dll` | CLSID `{6eed640c-73b9-4b7b-86c3-ae582eebf9cb}` |
| `CreateEnvironmentCache` | `corehelper.dll`, `environments.dll`, `simulationop.dll` | CLSID `{3d2a7149-320c-49a4-9625-8d61bda0c60c}` |
| `SIStoreEnvironmentCacheToMixer` | `environments.dll` | CLSID `{8ffda6cb-588f-419f-afac-31070af56815}` |
| `RemoveFolder` | `tasks.dll` | CLSID `{de5fd1e2-2dc3-11d4-b6a4-006094eb029c}` |
| `SetCurrentReferencePlane` | `tasks.dll`, `viewinteraction.dll` | CLSID `{2f76bc8f-f028-11d2-ac7c-00a02485cecb}` |
| `Instantiate` | `duplicate.vbs` (VBScript) | `InstanceProc` |
| `CopyStyle` | (CLSID not specific to one binary) | CLSID `{3f4aac42-27d6-11d6-9e5b-0000e22bd0d9}` |
| `SetInstanceGroup` | `grouptask.dll` | CLSID `{e0717f47-0ac4-4faa-b35a-7c56951e6ddf}` |
| `RemoveInstanceGroup` | `grouptask.dll` | CLSID `{d534de9f-55e4-41c2-a5ca-2cfbe354d3e6}` |
| `SceneRefresh` | `tasks.dll` | CLSID `{2168f0b6-0d40-11d7-be20-00a0c9615daf}` |
| `BeginUndo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `EndUndo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Undo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Undo (alternate)` | `uixsiscripts.vbs` (VBScript) | `UndoProc` |
| `Redo` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `Redo (alternate)` | `uixsiscripts.vbs` (VBScript) | `RedoProc` |
| `SelectObj` | `optasks.dll`, `primtasks.dll`, `sicurvetasks.dll`, `simeshtasks.dll`, `tasks.dll`, `action.dll` … | CLSID `{79581ba0-99bb-11d2-8bbb-00aa00135f7b}` |
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
| `InfoSelection` | `uixsiscripts.vbs` (VBScript) | `InfoSelectionProc` |
| `InfoScene` | `uixsiscripts.vbs` (VBScript) | `InfoSceneProc` |
| `ToggleParameterValue` | `uixsiscripts.vbs` (VBScript) | `ToggleParameterValueProc` |
| `ToggleSelectability` | `uixsiscripts.vbs` (VBScript) | `ToggleParameterValueProc` |
| `MakeAllUnselectable` | `selection.vbs` (VBScript) | `MakeAllSelectableProc` |
| `SelectEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendEdgeLoopProc` |
| `SelectBoundaryEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendBoundaryEdgeLoopProc` |
| `SelectParallelEdgeLoop` | `selection.vbs` (VBScript) | `SelectExtendParallelEdgeLoopProc` |
| `SelectNSidedPolygons` | `selection.vbs` (VBScript) | `SelectNSidedPolygonProc` |
| `GenerateInfoReport` | `tasks.dll` | CLSID `{bf217ee1-695a-4def-8fa3-98e4c6e01ce8}` |
| `Translate` | `transformmanager.dll` | CLSID `{b2f1ad2e-83bd-11d2-91cf-00a0c9612e3a}` |
| `Rotate` | `transformmanager.dll` | CLSID `{b2f1ad2d-83bd-11d2-91cf-00a0c9612e3a}` |
| `Scale` | `transformmanager.dll` | CLSID `{b2f1ad2c-83bd-11d2-91cf-00a0c9612e3a}` |
| `ResetTransform` | `transformmanager.dll` | CLSID `{bf88c89d-8e18-11d2-91d3-00a0c9612e3a}` |
| `Turn ON Interactive SRT` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `Turn OFF Interactive SRT` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `XYZ Transform ` | `toolmanager.dll` | CLSID `{0461b2c7-0ae3-11d2-8065-00a0c955b335}` |
| `Transform Set New ` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `Toggle Snapping` | `transformmanager.dll` | CLSID `{e60d5ac3-ed4f-454d-a1ef-6c82c7276ca6}` |
| `Toggle Point Snap` | `transformmanager.dll` | CLSID `{95c4c0ea-1b0e-42dd-a971-81bcbdd0e9fc}` |
| `Toggle Grid Snap` | `transformmanager.dll` | CLSID `{b01473fe-af48-4646-949b-f289be7da553}` |
| `Toggle Curve Snap` | `transformmanager.dll` | CLSID `{a8924726-2a79-4457-a495-64c5e5ca3849}` |
| `Toggle Proportional` | `transformmanager.dll` | CLSID `{03a88ea8-2ddc-476e-9f19-8c3124b626cd}` |
| `SetNeutralPose` | `tasks.dll` | CLSID `{651b8bdb-a324-4be5-a63a-a849c8ed35c3}` |
| `SaveKeyOnPath` | `pathanimtask.dll`, `kinecns.dll` | CLSID `{aef278f7-e088-11d2-977c-00a0243e3463}` |
| `ApplyCns` | `uixsiscripts.vbs` (VBScript) | `ApplyTrajectoryProc` |
| `ConvertPosAnimToPath` | `uixsiscripts.vbs` (VBScript) | `ConvertPosAnimToPathProc` |
| `PathRetime` | `uixsiscripts.vbs` (VBScript) | `PathRetimeProc` |
| `AddProp` | `uixsiscripts.vbs` (VBScript) | `AddPropProc` |
| `CreateWeightMap` | `uixsiscripts.vbs` (VBScript) | `CreateWeightMap` |
| `CreateVertexColorSupport` | `gap.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{ab483760-38c0-11d4-b8ff-0800690c8bd0}` |
| `PaintVertexColors` | `gap.dll`, `mentalray.dll` | CLSID `{17007160-416e-11d4-b902-0800690c8bd0}` |
| `PaintWeights` | `optasks.dll`, `gap.dll`, `sicoresdk.dll` | CLSID `{73c34ae0-9d75-11d4-b918-0800690c8bd0}` | batch 12: CLSID not in the `optasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `SIMakeLocal` | `optasks.dll`, `propertytasks.dll` | CLSID `{2975a557-2276-11d3-80e6-00a0c9ac19a9}` |
| `MakeLocal` | `uixsiscripts.vbs` (VBScript) | `MakeLocalFunc` |
| `RemoveAllProperties` | `uixsiscripts.vbs` (VBScript) | `RemoveAllPropertiesProc` |
| `RemoveProperties` | `uixsiscripts.vbs` (VBScript) | `RemovePropertiesProc` |
| `RemoveCustomParam` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{bbee42c4-2fe7-11d3-a617-00a0c9ec5ef7}` |
| `SIAddCustomParam` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{1d4d499c-d0c4-11d2-a5fa-00a0c9ec5ef7}` |
| `EditParameterDefinition` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{d56b12d2-699a-11d4-a657-00a0c9ec5ef7}` |
| `SIAddProp` | (CLSID not specific to one binary) | CLSID `{6fa26e30-7fe6-11d2-a938-00a024190119}` |
| `SIAddPropEx` | `propertytasks.dll` | CLSID `{b683cd81-22c1-11d3-80e6-00a0c9ac19a9}` |
| `SIUnAssignMaterial` | `propertytasks.dll` | CLSID `{c11ffe86-8e6b-4986-a698-c030d1ee45c3}` |
| `SICreateMaterial` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{3b75c06e-4d3f-458a-b591-13b65ed6603a}` |
| `SICreateMaterialDD` | `propertytasks.dll`, `shadertasks.dll`, `sicoresdk.dll` | CLSID `{3b75c06e-4d3f-458a-b591-13b65ed6603a}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `SelectObjectsUsingMaterial` | `uixsiscripts.vbs` (VBScript) | `SelectObjectsUsingMaterialProc` |
| `SelectMaterialsUsedBy` | `uixsiscripts.vbs` (VBScript) | `SelectMaterialsUsedByProc` |
| `SIAddCustomParameter` | `propertytasks.dll`, `sicoresdk.dll` | CLSID `{1d4d499c-d0c4-11d2-a5fa-00a0c9ec5ef7}` |
| `SetClusterPropertyValues` | `optasks.dll`, `propertytasks.dll`, `tasks.dll`, `si3dobjectmodel10.dll`, `sicppsdk.dll`, `weighteditor.dll` … | CLSID `{35fba75e-3ddf-11d3-bc3c-00a0c9612b97}` | batch 12: CLSID not in the `optasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
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
| `siCreateRetargetMapping` | `propertytasks.dll` | CLSID `{cbe3e960-1e81-4a77-a16f-28c075787a5c}` |
| `siWriteRetargetMapping` | `propertytasks.dll` | CLSID `{b8b04cc5-fe11-438e-a42c-c7c58eb5c4b6}` |
| `siWriteRetargetComponentData` | `propertytasks.dll` | CLSID `{06602467-ed04-48d7-9c52-c257b40768e2}` |
| `CreateUserMotion` | `uixsiscripts.vbs` (VBScript) | `CreateUserMotionProc` |
| `ApplyOperator` | (CLSID not specific to one binary) | CLSID `{46cee370-8bb2-11d2-ac56-00a02485cecb}` |
| `ApplyOp` | `operators.vbs` (VBScript) | `ApplyOpFunc` |
| `SelectGeneratorInputs` | `operators.vbs` (VBScript) | `SelectGeneratorInputs` |
| `HideGeneratorInputs` | `operators.vbs` (VBScript) | `HideGeneratorInputs` |
| `DeleteGeneratorInputs` | `operators.vbs` (VBScript) | `DeleteGeneratorInputs` |
| `ApplyTopoOp` | `operators.vbs` (VBScript) | `ApplyTopoOpFunc` |
| `ApplyGenOp` | `operators.vbs` (VBScript) | `ApplyGenOpFunc` |
| `ApplySnapFaceOp` | `operators.vbs` (VBScript) | `ApplySnapFaceOpFunc` |
| `ApplyPropVolumeOp` | `operators.vbs` (VBScript) | `ApplyPropVolumeOpProc` |
| `InitPropVolume` | `optasks.dll`, `primtasks.dll` | CLSID `{c5dc6089-0efd-4361-a84f-0840b708a657}` |
| `SpinEdgeForward` | `uixsiscripts.vbs` (VBScript) | `SpinEdgeForwardProc` |
| `SpinEdgeBackward` | `uixsiscripts.vbs` (VBScript) | `SpinEdgeBackwardProc` |
| `SetCurveKnotMultiplicity` | `operators.vbs` (VBScript) | `ApplySetCurveKnotMultiplicityOpFunc` |
| `ExtractFromComponents` | `operators.vbs` (VBScript) | `ApplyExtractFromPartClsFunc` |
| `siTrimWith` | `optasks.dll` | CLSID `{222cbe2b-217e-431c-a6d0-d2abfe8194c2}` |
| `ApplyFlexEnv` | `operators.vbs` (VBScript) | `ApplyFlexibleEnvelopeProc` |
| `SIApplyDeformBySpine` | `optasks.dll` | CLSID `{f9498641-02f5-11d3-9137-00a0244eeb76}` |
| `ApplyDeformByCage` | `operators.vbs` (VBScript) | `ApplyDeformByCageFunc` |
| `SISmoothEnvWght` | `optasks.dll` | CLSID `{083e381f-ccc3-426e-82de-4c1a150250e7}` |
| `LimitEnvelopeDeformers` | `uixsiscripts.vbs` (VBScript) | `LimitEnvelopeDeformersProc` |
| `RemoveFlexEnvDeformer` | `optasks.dll` | CLSID `{a3293413-b294-11d3-99d6-009027bc6509}` |
| `RemoveFlexEnv` | `optasks.dll` | CLSID `{936e8bd0-ae82-11d3-99d6-009027bc6509}` |
| `LockEnvelopePointWeights` | `optasks.dll` | CLSID `{7eab797e-361e-45db-bba4-5c9a3f987025}` |
| `ClearEnvelopeWeightLocks` | `optasks.dll` | CLSID `{119de848-61f4-44bc-9121-ebe0db32df64}` |
| `LocalAssignFlexEnv` | `operators.vbs` (VBScript) | `LocalAssignFlexibleEnvelopeFunc` |
| `ApplyKinematicOp` | `operators.vbs` (VBScript) | `ApplyKinematicOpFunc` |
| `SplitEdge` | `operators.vbs` (VBScript) | `ApplySplitEdgeFunc` |
| `Mesh Filter` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Triangulate` | `operators.vbs` (VBScript) | `TriangulateProc` |
| `Dice Object/Polygons` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `WeldPoints` | `operators.vbs` (VBScript) | `ApplyWeldPointsFunc` |
| `MoveOperatorAfter` | `optasks.dll`, `primtasks.dll`, `viewinteraction.dll` | CLSID `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}` |
| `MoveOperatorBefore` | `optasks.dll`, `primtasks.dll`, `viewinteraction.dll` | CLSID `{3fb6dc14-739e-11d4-bdd0-00a0c9615daf}` |
| `SwapOperators` | `optasks.dll` | CLSID `{3fb6dc06-739e-11d4-bdd0-00a0c9615daf}` |
| `DeactivateAbove` | `optasks.dll`, `tasks.dll` | CLSID `{f474765c-67ba-40d4-8f92-b83d81b08b46}` |
| `ResetActor` | `optasks.dll` | CLSID `{de9ced62-dd93-406d-b8db-ed7e4c5350ab}` |
| `ConnectICENodes` | `optasks.dll` | CLSID `{deb83777-b5d9-4a1c-be8b-848fa6eca194}` |
| `DisconnectICENodePort` | `optasks.dll` | CLSID `{9821e356-5283-45f9-965b-dd69004cc0a5}` |
| `AddICENode` | `optasks.dll` | CLSID `{2ca63f7d-4d58-4ba4-a226-bd981e110f66}` |
| `AddICECompoundNode` | `optasks.dll`, `rendertree.dll` | CLSID `{b7bbf3e0-50ba-47e1-a121-a85ed2e18101}` |
| `SIApplyICEOp` | `optasks.dll` | CLSID `{14c0ed4c-4d33-4697-8f84-bbde2c0baa58}` |
| `ApplyICEOp` | `operators.vbs` (VBScript) | `FApplyICEOpProc` |
| `ExportICECompoundNode` | `optasks.dll` | CLSID `{01b0b17d-ef3d-438f-81d5-3e8f90f7d9be}` |
| `ApplyICETemplate` | `operators.vbs` (VBScript) | `ApplyMDTemplateProc` |
| `GeneratePointCloudWithICETerminal` | `operators.vbs` (VBScript) | `GeneratePointCloudProc` |
| `GeneratePointCloudWithICETemplate` | `operators.vbs` (VBScript) | `GeneratePointCloudWithTemplateProc` |
| `AddPortToICENode` | `optasks.dll` | CLSID `{443328d5-87ac-40f5-8f21-e5d8a6de4dd1}` |
| `CreateICECompoundNode` | `optasks.dll` | CLSID `{63e1ca40-eea3-41f1-aa52-a5b1bacef904}` |
| `ExplodeICECompoundNode` | `optasks.dll` | CLSID `{b1be0f7b-6022-4e29-abad-b1711a51fb8c}` |
| `EditICECompoundProperties` | `optasks.dll` | CLSID `{3e56120d-af46-4263-9280-dfe9507db032}` |
| `SetStaticICEAttributeType` | `optasks.dll` | CLSID `{bf1968c3-aecc-4751-b015-3bead256214f}` |
| `AddStaticICEAttribute` | `optasks.dll`, `sicoresdk.dll` | CLSID `{a3386f3d-c5c1-4e16-8dfb-ecfeecc56baf}` |
| `RemoveStaticICEAttribute` | `optasks.dll`, `sicoresdk.dll` | CLSID `{ba2015ca-7fe1-4688-b403-fcafa2e0852c}` |
| `RenameStaticICEAttribute` | `optasks.dll` | CLSID `{4758bede-b77e-4634-834a-1a6b69629265}` |
| `ToggleICEAttributeAlwaysEvaluated` | `optasks.dll` | CLSID `{c98dd3f8-d700-4d95-8910-5096f1400e13}` |
| `Invert Polygons` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `Subdivide` | `scnmgr.dll`, `xsievents.dll` | CLSID `{48becc30-5e5e-11d4-8c2c-009027bc3a0e}` |
| `TransferAllPropertiesAcrossGenOp` | `optasks.dll` | CLSID `{e73d3b5a-354e-466b-b12b-e666f3a560f5}` |
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
| `ConvertScriptedOp` | `scriptedopeditor.dll` | CLSID `{532b8303-b52e-11d5-81a9-00a0c9ac19a9}` |
| `AddScriptedOp` | `ophost.dll`, `sicoresdk.dll` | CLSID `{f44c09e7-3b99-4e69-b5f8-8c88cd1b25c9}` |
| `AddCustomOp` | `action.dll`, `ophost.dll`, `sicoresdk.dll` | CLSID `{f33c09e7-3b99-4e69-b5f8-8c88cd1b25c8}` |
| `AddScriptedOpFromFile` | `ophost.dll` | CLSID `{7fba5233-d05d-4cb7-a107-b5b08e513f1c}` |
| `AlignBezierKnotsTangents` | `operators.vbs` (VBScript) | `AlignBezierKnotsTangentsFunc` |
| `CreateSimulatedICETree` | `operators.vbs` (VBScript) | `CreateSimulatedICETreeProc` |
| `GetICECompoundProperties` | `optasks.dll` | CLSID `{1728169f-6fdc-4d78-b1b5-7db9226fcb5c}` |
| `ApplyThickness` | `operators.vbs` (VBScript) | `ApplyThicknessProc` |
| `CapHole` | `operators.vbs` (VBScript) | `CapHoleProc` |
| `ApplySliceBetweenTwoVertices` | `operators.vbs` (VBScript) | `ApplySliceBetweenTwoVerticesProc` |
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
| `ExportAction` | `action.dll` | CLSID `{12a3efd1-e543-11d2-b352-00105a1e6ce9}` |
| `SIStoreAction` | `action.dll`, `imageclip.dll`, `actioncore.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{12a3efcd-e543-11d2-b352-00105a1e6ce9}` |
| `StoreAction` | `action.vbs` (VBScript) | `StoreActionProc` |
| `GetInputAndStoreAction` | `action.vbs` (VBScript) | `GetInputAndStoreActionProc` |
| `GetInputAndStoreAction2` | `action.vbs` (VBScript) | `GetInputAndStoreActionProc2` |
| `GenerateLipSync` | `EvolverLipSync.js` (JScript) | `GenerateLipSyncProc` |
| `AddTransition` | `action.dll`, `actioncore.dll` | CLSID `{c030ada0-1a8f-11d3-b35b-00105a1e6ce9}` |
| `AddClipRelation` | `actioncore.dll`, `sicoresdk.dll` | CLSID `{2b6f1f13-69fd-4fea-96ac-d2ff702774db}` |
| `SwapRelationMasterAndSlaveClip` | `actioncore.dll`, `sicoresdk.dll` | CLSID `{7aabbe2d-5a4d-4644-a1e9-39d983053bc1}` |
| `PlotToAction` | `action.dll` | CLSID `{12a3efd0-e543-11d2-b352-00105a1e6ce9}` |
| `ApplyAction` | `action.dll`, `imageclip.dll`, `_3dobject2.dll`, `actioncore.dll`, `actionhelper.dll` | CLSID `{12a3efd3-e543-11d2-b352-00105a1e6ce9}` |
| `PlotAndApplyAction` | `uixsiscripts.vbs` (VBScript) | `PlotAndApplyActionProc` |
| `PasteAction` | `action.vbs` (VBScript) | `GetInputAndPasteActionProc` |
| `GetDrivingActions` | `action.dll`, `graphic.dll` | CLSID `{7249a5d5-c3e9-11d4-b8b5-00a0c92469be}` |
| `PlotCurve` | `uixsiscripts.vbs` (VBScript) | `PlotCurveProc` |
| `PlotShape` | `action.dll` | CLSID `{aaf411c1-bcb2-11d4-b4dd-00d0b7142c4a}` |
| `EqualizeAction` | `action.dll` | CLSID `{03819cd3-43c5-11d4-bdde-00a0c961747d}` |
| `GetInputAndPlotKeyableToAction` | `uixsiscripts.vbs` (VBScript) | `GetInputAndPlotKeyableToActionProc` |
| `PlotConstrainedTransforms` | `uixsiscripts.vbs` (VBScript) | `PlotConstrainedTransformsProc` |
| `SetDefaultWeight` | `action.vbs` (VBScript) | `SetDefaultWeightProc` |
| `EditClip` | `action.vbs` (VBScript) | `EditClipProc` |
| `EqualizeClips` | `action.vbs` (VBScript) | `EqualizeClipsProc` |
| `AddBridgeTransition` | `action.vbs` (VBScript) | `AddBridgeTransitionFunc` |
| `AddTWTransition` | `action.dll` | CLSID `{7bec3ab9-5655-11d4-bde6-00a0c961747d}` |
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
| `Remove Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `RemoveKeyHotKeyProc` |
| `Toggle AutoKey` | `uixsiscripts.vbs` (VBScript) | `ToggleAutoKeyProc` |
| `AddExpr` | `uixsiscripts.vbs` (VBScript) | `AddExprProc` |
| `SetKey` | `uixsiscripts.vbs` (VBScript) | `SISetKeyProc` |
| `Save Zero Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `SaveZeroKeyHotKeyProc` |
| `Save Key Hot Key` | `uixsiscripts.vbs` (VBScript) | `SaveKeyHotKeyProc` |
| `CreateMarkingSet` | `animation.vbs` (VBScript) | `CreateMarkingSetProc` |
| `ActivateMarkingSet` | `animation.vbs` (VBScript) | `ActivateMarkingSetProc` |
| `DeleteMarkingSet` | `animation.vbs` (VBScript) | `DeleteMarkingSetProc` |
| `SetKeyUsingMarkingSet` | `animation.vbs` (VBScript) | `SetKeyUsingMarkingSetProc` |
| `CreateCharacterKeySet` | `CharacterKeySets.vbs` (VBScript) | `CreateCharacterSetCommand` |
| `SetCurrentCharacterKeySet` | `CharacterKeySets.vbs` (VBScript) | `SetCurrentCharacterKeySetCommand` |
| `StoreShapeKey` | `action.dll` | CLSID `{12a3efd2-e543-11d2-b352-00105a1e6ce9}` |
| `SelectShapeKey` | `action.dll` | CLSID `{eaa03724-f9bd-11d2-9c61-0060970a2bc8}` |
| `ApplyShapeKey` | `action.dll` | CLSID `{12a3efd4-e543-11d2-b352-00105a1e6ce9}` |
| `ReplaceShapeKey` | `action.dll` | CLSID `{eaa03725-f9bd-11d2-9c61-0060970a2bc8}` |
| `ConvertShapeReferenceMode` | `action.dll` | CLSID `{b0adeabc-9e68-42a0-949a-116a0e31aeef}` |
| `LinkDeform` | `action.dll` | CLSID `{14fafb72-9954-48eb-8d61-ba60dea49dc7}` |
| `LinkDeformWithOri` | `action.dll` | CLSID `{14fafb72-9954-48eb-8d61-ba60dea49dc7}` |
| `SaveDeformKey` | `uixsiscripts.vbs` (VBScript) | `SaveDeformKeyProc` |
| `ApplyDeformKey` | `uixsiscripts.vbs` (VBScript) | `ApplyDeformKeyProc` |
| `OpenShapeEditor` | `uixsiscripts.vbs` (VBScript) | `OpenShapeEditorProc` |
| `SITransferShapeAnimation` | `optasks.dll`, `action.dll` | CLSID `{3b019512-6257-4a4d-b10e-8558ab464b55}` | batch 12: CLSID not in the `optasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
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
| `GetPrim` | `primitives.vbs` (VBScript) | `GetPrimProc` |
| `CreatePrim` | `primitives.vbs` (VBScript) | `CreatePrimProc` |
| `GetPresetModel` | `primitives.vbs` (VBScript) | `GetPresetModelProc` |
| `GetProportionalGuide` | `Charac_LoadBipedGuide.vbs` (VBScript) | `load_biped_guide` |
| `CreateHierarchyFromBiped` | `Charac_HierachyFromBiped.vbs` (VBScript) | `HierachyFromBipedProc` |
| `SIGetPrim` | (CLSID not specific to one binary) | CLSID `{29668d60-591f-11d1-bafa-444553540000}` |
| `CreateMeshText` | `operators.vbs` (VBScript) | `TextToCurveListToMeshFunc` |
| `GetPrimLight` | `primitives.vbs` (VBScript) | `GetPrimLightProc` |
| `GetPrimCamera` | `primitives.vbs` (VBScript) | `GetPrimCameraProc` |
| `Get default camera` | `primitives.vbs` (VBScript) | `GetPrimCameraDefaultProc` |
| `GetPrimLattice` | `primitives.vbs` (VBScript) | `GetPrimLatticeProc` |
| `GetPrimVolumeDeform` | `primitives.vbs` (VBScript) | `GetPrimVolumeDeformProc` |
| `GetPrimWave` | `primitives.vbs` (VBScript) | `GetPrimWaveProc` |
| `UIAssembleNurbsMesh` | `uixsiscripts.vbs` (VBScript) | `UIAssembleNurbsMeshProc` |
| `AddAudioClip` | `moaudio.dll` | CLSID `{11b04f15-0353-11d3-b646-006094eb029c}` |
| `ImportAudio` | `moaudio.dll` | CLSID `{11b04f16-0353-11d3-b646-006094eb029c}` |
| `SIAddImageSourceOp` | `imageclip.dll` | CLSID `{041f67fd-53f8-43d7-95ec-69671c7925b4}` |
| `SIAddImageOp` | `imageclip.dll` | CLSID `{327d6270-8007-4524-982c-e1775b1bbed6}` |
| `SIAddImageSource` | `modeltasks.dll`, `imageclip.dll`, `shaderhelper.dll` | CLSID `{0f42cf75-1de8-11d3-b37a-00105a1e70de}` |
| `SIAddWritableImageSource` | `imageclip.dll` | CLSID `{a7fdb2d1-73f0-486a-ac47-621f31517299}` |
| `SIAddImageClip` | `modeltasks.dll`, `shadertasks.dll`, `imageclip.dll`, `shaderhelper.dll` | CLSID `{eef8d702-1ebe-11d3-b37a-00105a1e70de}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
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
| `Refresh` | `tasks.dll` | CLSID `{1600581c-1a86-11d3-bc37-00a0c9612b97}` |
| `DelayedRefresh` | `tasks.dll` | CLSID `{c57f98e2-6a92-4328-b7c1-692aed6b130a}` |
| `UnhideAll` | `layers.vbs` (VBScript) | `UnhideAllProc` |
| `UnghostAll` | `layers.vbs` (VBScript) | `UnhideAllProc` |
| `HideAndUnselect` | `layers.vbs` (VBScript) | `HideAndUnselectProc` |
| `HideUnselected` | `layers.vbs` (VBScript) | `HideUnselectedProc` |
| `SIHideObjects` | `layers.vbs` (VBScript) | `HideObjectsProc` |
| `SIUnhideObjects` | `layers.vbs` (VBScript) | `UnhideObjectsProc` |
| `CameraReset` | `vm.dll` | CLSID `{0461b2b4-0ae3-11d2-8065-00a0c955b335}` |
| `Undo Camera (alternate)` | `uixsiscripts.vbs` (VBScript) | `CameraUndoProc` |
| `Redo Camera (alternate)` | `uixsiscripts.vbs` (VBScript) | `CameraRedoProc` |
| `GetViewCamera` | `vm.dll` | CLSID `{8d8bbbd5-af43-45ea-853d-a31a47109cf2}` |
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
| `Center Selection` | `vm.dll` | CLSID `{d048b3fd-8bcd-4292-83c9-3b93eea82ea2}` |
| `Frame All` | `vm.dll` | CLSID `{0461b2b6-0ae3-11d2-8065-00a0c955b335}` |
| `Show/Hide Grid` | `vm.dll` | CLSID `{0461b2c2-0ae3-11d2-8065-00a0c955b335}` |
| `Toggle Field Guide` | `uixsiscripts.vbs` (VBScript) | `ToggleFieldGuideProc` |
| `Toggle Pixel Zoom` | `vm.dll` | CLSID `{6399a7e0-50dc-4731-bd1f-1a874c17d35b}` |
| `Zoom In` | `vm.dll` | CLSID `{553c67a0-c71d-4e6d-b862-80d0bc44c03c}` |
| `Zoom Out` | `vm.dll` | CLSID `{553c67a0-c71d-4e6d-b862-80d0bc44c03c}` |
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
| `CaptureViewport` | `vm.dll` | CLSID `{f8b60ef4-7ec2-11d3-8e88-00a0c982dd9a}` |
| `SwitchToolbar` | `toolbarobj.dll` | CLSID `{b5c21641-0f82-11d3-bfe8-00a0248f9397}` |
| `OpenICETreeView` | `uixsiscripts.vbs` (VBScript) | `OpenICETreeProc` |
| `Cut` | `tasks.dll`, `xsievents.dll` | CLSID `{ec7663e5-2f0b-11d3-bffd-00a0248f9397}` |
| `Copy` | `tasks.dll` | CLSID `{ec7663e4-2f0b-11d3-bffd-00a0248f9397}` |
| `Paste` | `tasks.dll`, `xsievents.dll` | CLSID `{ec7663e6-2f0b-11d3-bffd-00a0248f9397}` |
| `CopyPaste` | `optasks.dll`, `tasks.dll`, `actioncore.dll` | CLSID `{2c8a5f31-8556-11d3-b4a2-00a02485cecb}` | batch 12: CLSID not in the `optasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `OpenAnimationEditor` | `siviewtasks.dll` | CLSID `{a64dac70-1e45-11d5-bced-00d0b719022b}` |
| `OpenNetView` | `siviewtasks.dll` | CLSID `{c7461ff7-d02c-438a-a507-d4ebd588ef6f}` |
| `SetDisplayMode` | `uixsiscripts.vbs` (VBScript) | `SetDisplayMode` |
| `ToggleValue` | `uixsiscripts.vbs` (VBScript) | `ToggleValueProc` |
| `` | `tasks.dll` | CLSID `{82382d12-3bf6-11d4-bc93-00d0b719022b}` |
| `RunPerformanceTest` | `tasks.dll`, `gppgcmdlauncherctrl.dll` | CLSID `{0ed17cf6-d6a3-4b06-ba4d-9be4b7924df9}` |
| `AddUserTab` | `siuitasks.dll` | CLSID `{f4b294dd-2e8f-422a-a10f-f0e9a1c6ee4c}` |
| `AddUserKeyword` | `siuitasks.dll` | CLSID `{f4b294dd-2e8f-422a-a10f-f0e9a1c6ee4c}` |
| `GetFocusedViewport` | `uixsiscripts.vbs` (VBScript) | `ViewMgrViewportProc` |
| `SetDropMessage` | `tasks.dll` | CLSID `{e0a73360-723e-4ec6-9b76-d27aa77c7eb7}` |
| `ResetDirectX` | `tasks.dll` | CLSID `{b5097d5a-0331-42fb-bf47-e87677da16a8}` |
| `SIMergeScene` | `modeltasks.dll` | CLSID `{81ab7cd1-2262-11d3-b949-00a024c78ee3}` |
| `MarkObjectDirty` | (CLSID not specific to one binary) | CLSID `{00000000-0000-0000-0000-000000000000}` |
| `NewScene` | `tasks.dll` | CLSID `{6e4d3de5-5ad1-48fa-9811-49f8be59a576}` |
| `SaveScene` | `tasks.dll` | CLSID `{973f7447-bd33-4349-9d59-d1c9cad1b3a3}` |
| `OpenScene` | `tasks.dll` | CLSID `{fcad9bc1-645a-11d5-ad18-0090275802bf}` |
| `CopyExtFilesIntoProject` | `modeltasks.dll`, `tasks.dll` | CLSID `{cf8c9f24-9d07-11d3-b96b-009027bc3e07}` |
| `CacheObjectsIntoFile` | `simulation.vbs` (VBScript) | `CacheObjectsIntoFileProc` |
| `ApplySoftBody` | `particle.vbs` (VBScript) | `ApplySoftBodyProc` |
| `ApplyCloth` | `particle.vbs` (VBScript) | `ApplyClothProc` |
| `ApplyParticleShader` | `particle.vbs` (VBScript) | `ApplyParticleShaderProc` |
| `ConnectWeightMapToComponent` | `sparks.dll` | CLSID `{6f83fddc-ae40-11d3-affb-0050da2873c1}` |
| `ConnectParticleInitState` | `sparks.dll` | CLSID `{d3b53df8-39b4-4c0c-b175-7a0daaa627be}` |
| `DisconnectParticleInitState` | `sparks.dll` | CLSID `{12291e58-62b3-46f3-9980-22ef0a372fbc}` |
| `SetParticleInitState` | `sparks.dll` | CLSID `{21bc9523-f52e-47a3-9595-85c859fd995d}` |
| `UpdateParticleTypeConnections` | `optasks.dll`, `activedb.dll`, `sparks.dll` | CLSID `{4b5e7344-9b4d-4f34-bb1a-075a7a9886e0}` | batch 12: CLSID not in the `optasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
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
| `AddUserParameter` | `sparks.dll`, `sicoresdk.dll` | CLSID `{a289896c-c37f-40cf-b471-2b57b4f3fcb8}` |
| `RemoveUserParameter` | `sparks.dll`, `sicoresdk.dll` | CLSID `{e8b1490d-8471-4e7a-94ba-5295e1bb7980}` |
| `CreateFramebuffer` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{16da976b-687f-43eb-8a05-c30e7e1752f7}` |
| `CreateRenderChannel` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{fda875ff-245b-4dd9-a52c-3dbbb8f60167}` |
| `RemoveRenderChannel` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{63ea7a1d-2ade-424c-8aa6-9962014d252f}` |
| `SICreatePass` | `rendercore.dll`, `sicoresdk.dll` | CLSID `{8df69d1c-68a0-487a-bbf6-395a39040b5e}` |
| `CreatePass` | `Rendering.vbs` (VBScript) | `CreatePassProc` |
| `CreatePassFromLayers` | `Rendering.vbs` (VBScript) | `CreatePassFromLayersProc` |
| `CreateImageBasedLightingPass` | `Rendering.vbs` (VBScript) | `CreateImageBasedLightingPass` |
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
| `FreezeUVWTransformation` | `Texture.vbs` (VBScript) | `SIFreezeUVWTransformationProc` |
| `GenerateUniqueUVs` | `Texture.vbs` (VBScript) | `GenerateUniqueUVsProc` |
| `GenerateUVSetByContourStretching` | `Texture.vbs` (VBScript) | `GenerateUVSetByContourStretchingProc` |
| `CreateTextureSupport` | `Texture.vbs` (VBScript) | `CreateTextureSupportProc` |
| `IslandHealUVW` | `Texture.vbs` (VBScript) | `IslandHealUVWProc` |
| `CopyUVW` | `tasks.dll` | CLSID `{a1c9cbeb-2a8e-40d5-93e1-12e142a01c94}` |
| `PasteUVW` | `tasks.dll` | CLSID `{594ea9c2-b64c-499f-9ae3-ba03147ab375}` |
| `Create2DMap` | `propertytasks.dll` | CLSID `{3aece858-543f-11d5-b0c3-00a0c982e397}` |
| `Create2DMapWithProjection` | `propertytasks.dll` | CLSID `{8d9c7d7d-547c-11d5-b0c3-00a0c982e397}` |
| `SwimUVW` | `Texture.vbs` (VBScript) | `SwimUVWProc` |
| `StickUVW` | `Texture.vbs` (VBScript) | `StickUVWProc` |
| `ReprojectUVW` | `Texture.vbs` (VBScript) | `ReprojectUVWProc` |
| `InspectUVW` | `Texture.vbs` (VBScript) | `InspectUVWProc` |
| `InspectAllUVW` | `Texture.vbs` (VBScript) | `InspectAllUVWProc` |
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
| `CreateUserDataMapAndPickTemplate` | `UserDataScripts.vbs` (VBScript) | `CreateUserDataMapAndPickTemplateFunc` |
| `InspectUserData` | `UserDataScripts.vbs` (VBScript) | `InspectUserDataFromObjListSub` |
| `DeformMotion` | `customcommands.dll` (None) | `None` |
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
| `SIGetShaderOnCnxPoint` | `shadertasks.dll` | CLSID `{09decdf0-82a5-11d3-ae46-00a0c96e63e1}` |
| `SIApplyShader` | `propertytasks.dll`, `shadertasks.dll`, `sparks.dll`, `xsievents.dll`, `sicoresdk.dll` | CLSID `{41080962-e785-11d2-aa70-00aa0068d2c0}` |
| `ApplyShader` | `uixsiscripts.vbs` (VBScript) | `GetMaterialProc` |
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
| `SIAddArrayElement` | `shadertasks.dll`, `shaderhelper.dll`, `sparks.dll`, `si3dobjectmodel.dll`, `sicoresdk.dll` | CLSID `{17e2221e-3c31-4bf7-b49a-4abf7ad010d8}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `SIRemoveArrayElement` | `shadertasks.dll`, `sparks.dll`, `sicoresdk.dll` | CLSID `{a60a917a-cf1c-4be0-b5d1-197d750a4d31}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `SISwapArrayElements` | `shadertasks.dll`, `sicoresdk.dll` | CLSID `{6fbe63cb-d6fc-47d0-8c6d-2e419127faa8}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `CreateShaderFromPreset` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` |
| `CreateShadersFromMaterialPreset` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `CreateShaderFromCLSID` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `CreateShaderFromProgID` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `AddShaderAttachedComment` | `shadertasks.dll`, `molight.dll`, `shaderhelper.dll`, `sparks.dll`, `xgs.dll`, `props.dll` … | CLSID `{bbbbee29-9a74-46fc-8f43-bfebbabfd1bd}` | batch 12: CLSID not in the `shadertasks.dll` `DllGetClassObject` chain (row CMD-B12-ELSE) |
| `SetShaderCompoundPropertiesEx` | `shadertasks.dll` | CLSID `{6e1f9169-09f8-4915-8b7a-68446ca86a37}` |
| `GetShaderCompoundProperties` | `shadertasks.dll` | CLSID `{c54f9fef-b202-470a-9265-61bc5dea95fa}` |
| `ShowFaceRobotActPanel` | `siuitasks.dll` | CLSID `{3ea2aaac-44c4-4fb0-9a62-248ee72edead}` |
<!-- END GENERATED: registry -->
