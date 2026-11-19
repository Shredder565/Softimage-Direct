// Ledger row CMD-B12d: entry point of the optasks.dll operator-input, connection and cycle-check commands.
// Brief: docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md.
import { App } from '../core/commands';
import { stateOf } from './optasksB12dShared';
import { registerOptasksB12dInputCommands } from './optasksB12dInputs';
import { registerOptasksB12dConnectCommands } from './optasksB12dConnect';

export function registerOptasksB12dCommands(app: App) {
  stateOf(app);
  registerOptasksB12dInputCommands(app);
  registerOptasksB12dConnectCommands(app);
}
