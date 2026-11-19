// Ledger row CMD-B11c: entry point of the tasks.dll commands of the row (scene save, presets, curve queries,
// inspection history, keyboard state, user preferences, reference planes, particle pop-up menus).
// Brief: docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md. `AddToTOC` (also listed in the row) is a
// CMD-B10 command owned by the B10 corrections and is not registered here.
import { App } from '../core/commands';
import { stateOf } from './tasksB11cShared';
import { registerTasksB11cSceneCommands } from './tasksB11cScene';
import { registerTasksB11cPresetCommands } from './tasksB11cPresets';
import { registerTasksB11cCurveCommands } from './tasksB11cCurves';

export function registerTasksB11cCommands(app: App) {
  stateOf(app);
  registerTasksB11cSceneCommands(app);
  registerTasksB11cPresetCommands(app);
  registerTasksB11cCurveCommands(app);
}
