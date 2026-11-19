// Ledger row CMD-B13a: entry point of the bvrexport.dll "Behavior Export Command Plugin" commands (22 row names plus
// the extras BvrSaveActor, BvrLoadActor, BvrImportBVHActor). Brief: docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md.
import { App } from '../core/commands';
import { stateOf } from './bvrB13aShared';
import { registerBvrB13aActorCommands } from './bvrB13aActor';
import { registerBvrB13aSkillCommands } from './bvrB13aSkills';

export function registerBvrB13aCommands(app: App) {
  stateOf(app);
  registerBvrB13aActorCommands(app);
  registerBvrB13aSkillCommands(app);
}
