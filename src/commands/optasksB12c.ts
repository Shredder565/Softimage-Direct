// Ledger row CMD-B12c: entry point of the optasks.dll commands of the row (flexible envelope and cage apply, local
// reassignment, envelope weight editing / symmetry / locks, weight-map connections, proportional volume, automatic UVs).
// Brief: docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md.
import { App } from '../core/commands';
import { stateOf } from './optasksB12cShared';
import { registerOptasksB12cEnvelopeCommands } from './optasksB12cEnvelope';
import { registerOptasksB12cWeightCommands } from './optasksB12cWeights';
import { registerOptasksB12cVolumeCommands } from './optasksB12cVolumes';

export function registerOptasksB12cCommands(app: App) {
  stateOf(app);
  registerOptasksB12cEnvelopeCommands(app);
  registerOptasksB12cWeightCommands(app);
  registerOptasksB12cVolumeCommands(app);
}
