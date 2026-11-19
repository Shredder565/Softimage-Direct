// Ledger row CMD-B11b: System and the commands of the shared GUID-table handler b5097d5a of tasks.dll
// (CrashXSI, DumpMemoryStats, IsSoftimageDevDrop, SIGetHelpPath, ICEOfflineRefresh, UnloadAddonLib, ReloadAddonLib,
// UnloadAllAddonLibs, ReloadAllAddonLibs, UnloadAllCOMLibs, TestPluginHost; GetUnevaluatedPrimitiveForConstruction-
// History is in tasksB11bScene.ts). Brief: docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md.
// Original code from the prose contract. The shared-handler commands have no Undo / Redo.
import type { App } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import {
  b11b, fail, setStatus, logNya, msgText, unset, B11bPlugin,
  E_INVALIDARG, E_FAIL, DISP_E_MEMBERNOTFOUND, S_OK, S_FALSE,
} from './tasksB11bShared';

type Reg = (name: string, def: { description?: string; undoable?: boolean; execute: (app: App, a: Record<string, any>) => any }) => void;

const HELP_PATH_MAX = 260;
const MSG_FACTORY_UNLOAD = 0x118, MSG_FACTORY_RELOAD = 0x11d, MSG_UNLOAD_FAILED = 0x127, MSG_RELOAD_FAILED = 0x128;
/** The file-browser description the argument editor gets for FileName (row `+8` of the two single-file rows). */
export const ADDON_LIB_BROWSER = {
  UnloadAddonLib: { filter: '.dll|.so', types: 'Library (*.dll)|*.dll||', startFolderPath: 1, title: 'Select library to unload' },
  ReloadAddonLib: { filter: '.dll|.so', types: 'Library (*.dll)|*.dll||', startFolderPath: 1, title: 'Select library to reload' },
};

const sameFile = (a: string, b: string) => a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase();

/** SIUnloadPlugin / SIReloadPlugin on the stand-in manager: false when the plug-in is unknown. */
function pluginOp(p: B11bPlugin | undefined, reload: boolean): boolean {
  if (!p) return false;
  if (reload) { p.loaded = true; p.loads++; } else p.loaded = false;
  return true;
}

function singleLib(app: App, C: string, a: Record<string, any>, reload: boolean) {
  const st = b11b(app); const file = unset(a.FileName) ? '' : String(a.FileName);
  const p = st.plugins.find(x => sameFile(x.file, file) || sameFile(x.name, file));
  if (p?.factory) { app.logMsg('info', msgText(reload ? MSG_FACTORY_RELOAD : MSG_FACTORY_UNLOAD, p.name)); setStatus(app, C, S_FALSE); return undefined; }
  if (!pluginOp(p, reload)) {
    const m = msgText(reload ? MSG_RELOAD_FAILED : MSG_UNLOAD_FAILED, file);
    app.logMsg('error', m); throw fail(E_FAIL, `${C}: ${m}`);
  }
  setStatus(app, C, S_FALSE); // a successful run makes the dispatcher return S_FALSE
  return undefined;
}

function allLibs(app: App, C: string, reload: boolean) {
  const st = b11b(app);
  for (const lib of st.libraries) {
    if (st.plugins.some(p => sameFile(p.file, lib.file))) continue; // known to the plug-in manager
    if (reload) { lib.loaded = true; lib.loads++; } else lib.loaded = false; // SIReloadPluginLibrary / SIUnloadPluginLibrary
  }
  for (const p of st.plugins) {
    if (p.factory) { app.logMsg('info', msgText(reload ? MSG_FACTORY_RELOAD : MSG_FACTORY_UNLOAD, p.name)); continue; }
    if (!pluginOp(p, reload)) app.logMsg('error', msgText(reload ? MSG_RELOAD_FAILED : MSG_UNLOAD_FAILED, p.name));
  }
  setStatus(app, C, S_OK);
  return undefined;
}

export function registerTasksB11bMisc(app: App, reg: Reg) {
  reg('System', {
    description: 'Used to execute a string through the OS', undoable: false,
    execute(app, a) {
      const C = 'System'; const st = b11b(app);
      const cmd = unset(a.Pathname) ? '' : String(a.Pathname);
      if (!st.commandProcessor) {
        const m = 'no command processor is available'; // inferred text: the browser build has no command processor
        app.logMsg('error', `${C}: ${m} (raised as 0x${E_INVALIDARG.toString(16)})`); // SIRaiseError(E_INVALIDARG, text)
        throw fail(E_FAIL, `${C}: ${m}`);
      }
      const code = st.commandProcessor(cmd);
      if (!(code >= 0)) { const m = `the command processor failed (${code})`; app.logMsg('error', `${C}: ${m} (raised as 0x${E_INVALIDARG.toString(16)})`); throw fail(E_FAIL, `${C}: ${m}`); }
      setStatus(app, C, S_FALSE); // Do maps any non-failure to 1
      return Number(code); // Value, VT_R8
    },
  });

  reg('CrashXSI', {
    description: 'Cause Softimage to crash', undoable: false,
    execute(app) {
      const C = 'CrashXSI'; const st = b11b(app);
      if (st.env.XSI_SUPPORT_CRASH_XSI_COMMAND !== undefined) {
        // Softimage raises EXCEPTION_ACCESS_VIOLATION (0xC0000005) here. This build never crashes: it only says so.
        app.logMsg('info', `${C}: XSI_SUPPORT_CRASH_XSI_COMMAND is set: Softimage would raise EXCEPTION_ACCESS_VIOLATION (0xC0000005) here; this build does not crash`);
      }
      setStatus(app, C, S_FALSE);
      return undefined;
    },
  });

  reg('DumpMemoryStats', {
    description: 'Outputs debug information about memory usage to the script window', undoable: false,
    execute(app) {
      const C = 'DumpMemoryStats'; const st = b11b(app);
      logNya(app, C, 'the CSISlabAllocator statistics (allocator names and counters); this build has no slab allocator and reports the browser heap instead');
      const mem: any = (performance as any)?.memory;
      app.logMsg('info', mem ? `${C}: JS heap used ${mem.usedJSHeapSize} bytes, total ${mem.totalJSHeapSize} bytes, limit ${mem.jsHeapSizeLimit} bytes` : `${C}: heap statistics are not available in this browser`);
      st.memoryDumps++;
      setStatus(app, C, S_FALSE);
      return undefined;
    },
  });

  reg('IsSoftimageDevDrop', {
    description: 'Is this a Softimage developer drop (vs a setup)?', undoable: false,
    execute(app) {
      const C = 'IsSoftimageDevDrop'; const st = b11b(app);
      const base = st.installPaths[3] ?? (app as any).sdkHelpers?.paths?.[3];
      let v = 0;
      if (base) { const dir = hostFs.join(hostFs.join(base, 'Application'), 'test'); if (hostFs.isFolder(dir) && hostFs.isFile(hostFs.join(dir, 'cscmd.dll'))) v = 1; }
      setStatus(app, C, S_FALSE);
      return v; // boolean written as VT_I4
    },
  });

  reg('SIGetHelpPath', {
    description: 'Returns the Softimage top level help path', undoable: false,
    execute(app) {
      const C = 'SIGetHelpPath'; const p = b11b(app).helpPath;
      if (unset(p)) throw fail(E_FAIL, `${C}: the help files path is not available`);
      setStatus(app, C, S_FALSE);
      return String(p).slice(0, HELP_PATH_MAX);
    },
  });

  reg('ICEOfflineRefresh', {
    description: 'Refresh ICE trees and related data marked as dirty during ICE offline editing mode', undoable: false,
    execute(app) {
      const C = 'ICEOfflineRefresh'; const st = b11b(app);
      st.flushes++; // F3DFlushDirtyServiceModeObjects
      logNya(app, C, 'ICE offline editing mode (dirty service-mode objects) is not modelled in this build; nothing was flushed');
      app.events.emit('scene');
      setStatus(app, C, S_OK);
      return undefined;
    },
  });

  reg('UnloadAddonLib', { description: 'Unload Addon library', undoable: false, execute: (app, a) => singleLib(app, 'UnloadAddonLib', a, false) });
  reg('ReloadAddonLib', { description: 'Reload Addon library', undoable: false, execute: (app, a) => singleLib(app, 'ReloadAddonLib', a, true) });
  reg('UnloadAllAddonLibs', { description: 'Unload All Addon libraries', undoable: false, execute: app => allLibs(app, 'UnloadAllAddonLibs', false) });
  reg('ReloadAllAddonLibs', { description: 'Reload All Addon libraries', undoable: false, execute: app => allLibs(app, 'ReloadAllAddonLibs', true) });

  reg('UnloadAllCOMLibs', {
    description: 'Unload unused COM libraries', undoable: false,
    execute(app) {
      const C = 'UnloadAllCOMLibs'; const st = b11b(app);
      st.comFrees++; // CoFreeUnusedLibraries
      logNya(app, C, 'COM libraries do not exist in this build; nothing was unloaded');
      setStatus(app, C, S_OK);
      return undefined;
    },
  });

  reg('TestPluginHost', {
    description: 'Test plugin host', undoable: false,
    execute(app) {
      // No row of the shared handler's table carries this command's GUID: the dispatcher answers DISP_E_MEMBERNOTFOUND.
      logNya(app, 'TestPluginHost', 'an implementation outside tasks.dll (the shared handler has no row for this command)');
      throw fail(DISP_E_MEMBERNOTFOUND, 'TestPluginHost: the command handler has no entry for this command');
    },
  });
}
