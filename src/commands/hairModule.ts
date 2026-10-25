// Softimage Hair module toolbar / ApplyHair* commands — dump-backed (MENU 297 + modules_hair.json).
// Hair Panel view shell from hairpanel.xsivw; client GDI LOCK (no invent). FROST Character Hair stays parallel.
import { App } from '../core/commands';
import { Property } from '../core/scene';
import { str } from '../core/params';
import hairTops from '../data/si/hair_module_mcp_tops.json';
import hairViewChrome from '../data/si/hair_view_chrome.json';

const addHairOp = (app: App, label: string, type: string) => {
  const o = app.selectedObjects[0];
  if (!o) throw new Error('Select a hair object');
  const p = new Property(label, type, [str('preset', label, 'Preset', { readOnly: true })]);
  app.record(label, () => o.addProperty(p), () => o.removeProperty(p));
  app.select([p]);
  return p;
};

/** Softimage Hair module switcher attestation + dump-gap ApplyHair* ops (Scale/Rotate/Puff/Clump). */
export function registerHairModuleCommands(app: App) {
  // Softimage OpenView("Hair Panel") — no separate Command Name in commands_full (unlike OpenICETreeView).
  // View Shortcuts keymap name "Hair Panel" + SI_VIEWS / openview event open the xsivw shell.

  // commands_full Modeling ops attested in modules_hair.json — fill gaps not already in moduleToolbar.
  const gapOps: [string, string][] = [
    ['ApplyHairPuffOp', 'Hair Puff Operator'],
    ['ApplyHairClumpOp', 'Hair Clump Operator'],
    ['ApplyHairScaleOp', 'Hair Scale Operator'],
    ['ApplyHairRotateOp', 'Hair Rotate Operator'],
  ];
  for (const [name, label] of gapOps) {
    if (app.commands.has(name)) continue;
    app.register({
      name,
      label,
      category: 'Modeling',
      args: [{ name: 'InputObjs', default: null }],
      execute(app) {
        return addHairOp(app, label, name.toLowerCase());
      },
    });
  }

  // ActivateTipSelTool — Selection category (modules_hair.json)
  if (!app.commands.has('ActivateTipSelTool')) {
    app.register({
      name: 'ActivateTipSelTool',
      label: 'Hair Tip Select Tool',
      category: 'Selection',
      args: [],
      undoable: false,
      execute(app) {
        app.setSelMode('object');
        app.logMsg('info', 'Hair Tip Select Tool: filter Hair Tip (stub)');
        return null;
      },
    });
  }

  // Ensure SwitchToolbar Target=6 (Hair) exists even if Render OM register order changes.
  if (!app.commands.has('SwitchToolbar')) {
    app.register({
      name: 'SwitchToolbar',
      label: 'Switch to Hair Toolbar',
      category: 'Toolbar',
      args: [{ name: 'Target', default: 6 }],
      undoable: false,
      execute(app, a) {
        const map: Record<number, App['module']> = { 1: 'Model', 2: 'Animate', 3: 'Render', 4: 'ICE', 5: 'Simulate', 6: 'Hair' };
        const mod = map[Number(a.Target)] ?? 'Hair';
        app.module = mod;
        app.events.emit('module');
        return mod;
      },
    });
  }
}

/** Audit for __uiAudit / compare_hair_module — dump-backed Hair MCP tops + ApplyHair* + Hair Panel xsivw shell. */
export function hairModuleAudit(app: App): Record<string, unknown> {
  const tops = hairTops as typeof hairTops & {
    tops: string[];
    buttons: Record<string, string[]>;
    switch_toolbar_target: number;
    apply_hair_ops: string[];
    hair_tools: string[];
    hair_panel: {
      status: string;
      openview?: string;
      defaultsize?: string;
      category?: string;
      client_gdi?: string;
      clsid?: string;
    };
    flyout_pixels: { status: string };
  };
  const chrome = hairViewChrome as {
    views: Record<string, { defaultsize: number[]; category: string; status?: string; client_gdi?: string; clsid?: string }>;
  };
  const panel = chrome.views['Hair Panel'];
  const applyWired = (tops.apply_hair_ops ?? []).filter(n => app.commands.has(n));
  const toolsWired = (tops.hair_tools ?? []).filter(n => app.commands.has(n));
  return {
    softimage: tops.softimage,
    menuId: tops.menu_id,
    moduleSelect: tops.module_select,
    tops: tops.tops,
    buttons: tops.buttons,
    switchToolbarTarget: tops.switch_toolbar_target,
    switchCommand: tops.switch_command,
    keymap: tops.keymap,
    applyHairOpsWired: applyWired,
    applyHairOpsCount: applyWired.length,
    applyHairOpsExpected: (tops.apply_hair_ops ?? []).length,
    hairToolsWired: toolsWired,
    hairPanel: tops.hair_panel?.status ?? panel?.status ?? 'LOCK',
    hairPanelClientGdi: tops.hair_panel?.client_gdi ?? panel?.client_gdi ?? 'LOCK',
    hairPanelDefaultSize: panel?.defaultsize,
    hairPanelCategory: panel?.category,
    hairPanelClsid: panel?.clsid,
    hairPanelOpenView: tops.hair_panel?.openview ?? 'Hair Panel',
    flyoutPixels: tops.flyout_pixels?.status ?? 'LOCK',
    switchToolbar: app.commands.has('SwitchToolbar'),
    currentModule: app.module,
  };
}

/** Lightweight smoke: ApplyHairOp adds a hair property on selection. */
export function hairApplySmoke(app: App): { ok: boolean; name?: string; err?: string } {
  try {
    const before = app.selectedObjects[0];
    if (!before) {
      app.run('GetPrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface' });
    }
    const o = app.selectedObjects[0];
    if (!o) return { ok: false, err: 'no selection after GetPrim' };
    app.run('ApplyHairOp', { PresetObj: 'Hair-Default' });
    const p = o.properties.find(x => x.type === 'hair');
    return p ? { ok: true, name: p.name } : { ok: false, err: 'no hair property' };
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e) };
  }
}
