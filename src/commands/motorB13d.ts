// Ledger row CMD-B13d: entry point of the MOTOR motion-retargeting commands of CDKMotionTransform.64.dll
// (CleanTagsFromRig, InheritRetargetSetup, LoadMOTORAdjustmentPresetFile, LoadMotorFile, LoadTagTemplateFile,
// RemoveAllMotorPropsAndOps, RemoveMOTOROperators, RetargetBVH, RetargetC3DData, RetargetExtractEndFrame,
// RetargetExtractStartFrame, SaveC3DPoseMap, SaveMOTORAdjustmentPresetFile, SaveTagTemplateFile).
// Brief: docs/ghidra/cmd-b13d-motiontransform-binary.md. The seven other commands the plug-in registers (Retarget,
// ImportC3DFile, SetTagValue, ApplyTagsToRig, SetStructureFile, SaveMotorFile, PlotRetargetMotion) belong to other rows,
// have no contract in the note and are not in data/command_registry.json, so they are not registered here.
import { App } from '../core/commands';
import { stateOf } from './motorB13dShared';
import { registerMotorB13dTagCommands } from './motorB13dTags';
import { registerMotorB13dFileCommands } from './motorB13dFiles';

export function registerMotorB13dCommands(app: App) {
  stateOf(app);
  registerMotorB13dTagCommands(app);
  registerMotorB13dFileCommands(app);
}
