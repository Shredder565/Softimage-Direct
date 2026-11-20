// Ledger row CMD-B15f: remaining script-implemented commands. Entry point; see the header of
// miscScriptsB15fShared.ts for the stand-ins and docs/ghidra/cmd-b15f-misc-scripts.md for the contract.
//   sdkui wizards   miscScriptsB15fWizards.ts (+ Gen: code generators, also installed on the WizardHelper object)
//   Evolver         miscScriptsB15fLipSync.ts   GenerateLipSync
//   Shaders         miscScriptsB15fShaders.ts   UpgradeShaders
//   Misc            miscScriptsB15fMisc.ts      "Get default camera", "OBJ Import...", "Save Zero Key Hot Key", GenNormalMap, GenDiffuseMap
// Already wired by CMD-B7b and checked here (not registered again): syCachePaint1/2, SyGetMassMap, SyGetSpringMap.
// Not in this row: CreateInspectParticleType{Sphere,Blob,Billboard} (the particle worker wires them).
import { App } from '../core/commands';
import { freshMiscState } from './miscScriptsB15fShared';
import { registerMiscB15fWizardCommands } from './miscScriptsB15fWizards';
import { registerMiscB15fLipSyncCommand } from './miscScriptsB15fLipSync';
import { registerMiscB15fShaderCommands } from './miscScriptsB15fShaders';
import { registerMiscB15fMiscCommands } from './miscScriptsB15fMisc';

export function registerMiscScriptsB15fCommands(app: App) {
  const old = (app as any).miscScriptsB15f;   // created early when a wizard-helper generator ran before registration
  const st = Object.assign(freshMiscState(), old ?? {});
  (app as any).miscScriptsB15f = st;
  registerMiscB15fWizardCommands(app);
  registerMiscB15fLipSyncCommand(app);
  registerMiscB15fShaderCommands(app);
  registerMiscB15fMiscCommands(app);
}
