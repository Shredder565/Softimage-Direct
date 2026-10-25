// Softimage Simulate module toolbar / prefs — dump-backed (modules_simulate.json + PE MENU 205).
// FROST cloth (src/frost/) stays parallel. No invent Syflex client GDI.
import { App } from '../core/commands';
import { pref } from '../ui/prefs';
import simTops from '../data/si/simulate_module_mcp_tops.json';

/** Softimage Simulate module switcher + SyCreateCloth Name + audit helpers. */
export function registerSimulateModuleCommands(app: App) {
  // commands_full: SyCreateCloth (Custom, Syflex cloth.vbs CreateCloth_Execute).
  // PE Create > Cloth > From Selection maps to ApplyCloth (id 41015) — route Name there; no Syflex GDI.
  if (!app.commands.has('SyCreateCloth')) {
    app.register({
      name: 'SyCreateCloth',
      label: 'Create Cloth',
      category: 'Custom',
      args: [{ name: 'InputObjs', default: '' }],
      execute(app, a) {
        return app.run('ApplyCloth', { InputObjs: a.InputObjs ?? '' });
      },
    });
  }

  // Ensure SwitchToolbar Target=5 (Simulate) exists even if Render OM register order changes.
  if (!app.commands.has('SwitchToolbar')) {
    app.register({
      name: 'SwitchToolbar',
      label: 'Switch to Simulate Toolbar',
      category: 'Toolbar',
      args: [{ name: 'Target', default: 5 }],
      undoable: false,
      execute(app, a) {
        const map: Record<number, App['module']> = { 1: 'Model', 2: 'Animate', 3: 'Render', 4: 'ICE', 5: 'Simulate', 6: 'Hair' };
        const mod = map[Number(a.Target)] ?? 'Simulate';
        app.module = mod;
        app.events.emit('module');
        return mod;
      },
    });
  }
}

/** Audit for __uiAudit / compare_simulate_module — dump-backed Simulate MCP tops + prefs + cmds. */
export function simulateModuleAudit(app: App): Record<string, unknown> {
  const tops = simTops as typeof simTops & {
    tops: string[];
    buttons: Record<string, string[]>;
    switch_toolbar_target: number;
    flyout_pixels?: { status: string };
    syflex_client_gdi?: { status: string };
    preferences?: { simulation?: { full: string; param_count: number; params: Record<string, unknown> } };
    command_name_map?: Record<string, unknown>;
  };
  const simCmds = [
    'SwitchToolbar',
    'SyCreateCloth',
    'ApplyCloth',
    'CreateActiveRigidBody',
    'CreatePassiveRigidBody',
    'CreateCompoundRigidBody',
    'ApplySoftBody',
    'AddClothClusters',
    'RemoveRigidBody',
    'CreateEnvironment',
    'CreateForce',
  ].filter(n => app.commands.has(n));
  const dumpSim = tops.preferences?.simulation;
  const livePrefs = {
    rbdengine: pref('C3DPrefsSimulation', 'rbdengine'),
    cachefiletypestring: pref('C3DPrefsSimulation', 'cachefiletypestring'),
    cachetemplatefilename: pref('C3DPrefsSimulation', 'cachetemplatefilename'),
    defaulttemplateindex: pref('C3DPrefsSimulation', 'defaulttemplateindex'),
    cachefiletype: pref('C3DPrefsSimulation', 'cachefiletype'),
  };
  const A = app as any;
  return {
    softimage: tops.softimage,
    menuId: tops.menu_id,
    moduleSelect: tops.module_select,
    tops: tops.tops,
    buttons: tops.buttons,
    switchToolbarTarget: tops.switch_toolbar_target,
    flyoutPixels: tops.flyout_pixels?.status ?? 'LOCK',
    syflexClientGdi: tops.syflex_client_gdi?.status ?? 'LOCK',
    commandNameMap: tops.command_name_map ?? {},
    commandsWired: simCmds,
    syCreateCloth: app.commands.has('SyCreateCloth'),
    applyCloth: app.commands.has('ApplyCloth'),
    createActiveRigidBody: app.commands.has('CreateActiveRigidBody'),
    applySoftBody: app.commands.has('ApplySoftBody'),
    prefsFullName: dumpSim?.full ?? 'preferences.simulation',
    prefsParamCount: dumpSim?.param_count ?? 10,
    prefsDumpDefaults: dumpSim?.params ?? {},
    prefsLive: livePrefs,
    simulationPrefs: A.simulationPrefs ?? null,
    currentModule: app.module,
    frostUntouched: true,
  };
}
