// Ledger row CMD-B12e: entry point of the optasks.dll commands of the row (generator input read positions, inputs for
// disposal, transfers of clusters / properties / animation / shape animation across generator operators,
// PropertyTransfer, SITransferCenter). Brief: docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md.
import { App } from '../core/commands';
import { stateOf } from './optasksB12eShared';
import { registerOptasksB12eGenCommands } from './optasksB12eGen';
import { registerOptasksB12eTransferCommands } from './optasksB12eTransfer';

export function registerOptasksB12eCommands(app: App) {
  stateOf(app);
  registerOptasksB12eGenCommands(app);
  registerOptasksB12eTransferCommands(app);
}
