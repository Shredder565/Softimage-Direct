// Ledger row CMD-B11a: the 19 tasks.dll commands of docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md.
// Original code written from the note's Wire contracts only (no XSIBATCH golden exists for the row).
//   tasksB11aMenus.ts  Particle Type Pop-up Menu, Goal Pop-up Menu, SIMatchSubComponent, FindObjects, GetCurrentPass,
//                      SetCurrentParType, FilterPSet, ReorderSceneItem, CollapseOp
//   tasksB11aCache.ts  CopyCacheFiles, DumpCacheHeader, CacheObjectsIntoFile_Private
//   tasksB11aMisc.ts   RenameCPSetLayoutItems, CreateObjectFromPreset, ObjImport, SIObjExport, SetDefaultKeyMap,
//                      ImportPrefs, PickPosition
// State for scripts and checks: `app.tasksB11a` (tasksB11aShared.ts).
import { App } from '../core/commands';
import { b11a } from './tasksB11aShared';
import { registerTasksB11aMenus } from './tasksB11aMenus';
import { registerTasksB11aCache } from './tasksB11aCache';
import { registerTasksB11aMisc } from './tasksB11aMisc';

export function registerTasksB11aCommands(app: App) {
  b11a(app);
  registerTasksB11aMenus(app);
  registerTasksB11aCache(app);
  registerTasksB11aMisc(app);
}
