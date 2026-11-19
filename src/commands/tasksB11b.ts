// Ledger row CMD-B11b: entry point of the 23 tasks.dll commands of docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md
// (picking, curve knot queries, external references, custom file import, System, reference plane, obstacle menu and
// the commands of the shared GUID-table handler b5097d5a). Original code written from the note's Wire contracts.
//
//   tasksB11bPick.ts   PickElement PickObject EnumElements "Obstalce Pop-up Menu"
//   tasksB11bScene.ts  GetNumberOfKnots GetCurvePercentageAtKnotIndex GetExternalReferences UpdateExternalReference
//                      ImportCustomFile SetReferencePlane GetUnevaluatedPrimitiveForConstructionHistory
//   tasksB11bMisc.ts   System CrashXSI DumpMemoryStats IsSoftimageDevDrop SIGetHelpPath ICEOfflineRefresh UnloadAddonLib
//                      ReloadAddonLib UnloadAllAddonLibs ReloadAllAddonLibs UnloadAllCOMLibs TestPluginHost
//
// None of these names had an earlier registration on the bus. SetReferencePlane is the low-level command the
// uixsiscripts row (SetTransientReferencePlane) delegates to; it writes the plane record that row keeps.
import type { App, CommandDef } from '../core/commands';
import { b11b, B11B_ARGS, B11B_LABEL } from './tasksB11bShared';
import { registerTasksB11bPick } from './tasksB11bPick';
import { registerTasksB11bScene } from './tasksB11bScene';
import { registerTasksB11bMisc } from './tasksB11bMisc';

const CATEGORY: Record<string, string> = {
  SetReferencePlane: 'Modeling', SIGetHelpPath: 'File', UnloadAddonLib: 'File', ReloadAddonLib: 'File', UnloadAllAddonLibs: 'File',
  ReloadAllAddonLibs: 'File', UnloadAllCOMLibs: 'File',
};

export function registerTasksB11bCommands(app: App) {
  const st = b11b(app);
  const reg = (name: string, def: { description?: string; undoable?: boolean; execute: (app: App, a: Record<string, any>) => any }) => {
    const args = B11B_ARGS[name]; if (!args) throw new Error(`CMD-B11b: no registry argument list for ${name}`);
    if (app.commands.has(name)) st.replaced.push(name);
    app.register({
      name, label: B11B_LABEL[name] ?? name, category: CATEGORY[name] ?? 'General', description: def.description ?? '',
      undoable: def.undoable, execute: def.execute, args: args.map(x => ({ ...x })),
    } as CommandDef);
    st.registered.push(name);
  };
  registerTasksB11bPick(app, reg);
  registerTasksB11bScene(app, reg);
  registerTasksB11bMisc(app, reg);
}
