// Ledger rows CMD-B12a and CMD-B12b (optasks.dll ICE compound / node / port commands): one entry for both rows.
// Briefs: docs/ghidra/cmd-b12a-optasks-ice-compound-ports-binary.md, docs/ghidra/cmd-b12b-optasks-ice-nodes-ports-simstate-binary.md.
import { App } from '../core/commands';
import { optasksB12CompoundDefs } from './optasksB12iceCompound';
import { optasksB12NodeDefs } from './optasksB12iceNodes';
import { stateOf } from './optasksB12iceModel';

export function registerOptasksB12IceCommands(app: App) {
  stateOf(app);
  for (const def of [...optasksB12CompoundDefs(), ...optasksB12NodeDefs()]) app.register(def);
}
