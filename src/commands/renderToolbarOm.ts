// Softimage Render toolbar OM scripting names — unlock_render_toolbar_om_probe + commands_full.json.
// Dump-backed labels/args only. Region HWND crop chrome from modules-gdi DUMP_READY harvest.
import { App } from '../core/commands';
import inventory from '../data/si/render_toolbar_om_cmds.json';
import regionSpdl from '../data/si/render_options_region.json';

type RrState = {
  visible: boolean;
  track: boolean;
  refresh: string;
  display: string;
  autoRefresh: boolean;
  channel: string;
  showRenderedImage: boolean;
  /** Softimage RenderRegionCreate normalized fractions (commands_full defaults). */
  left: number;
  right: number;
  top: number;
  bottom: number;
  open: boolean;
};

// Softimage SwitchToolbar Target: 1–6 dump map; true-95pct unlock attests Target **7** → Hair (ACTIVE invoke OK).
const TOOLBAR_TARGET: Record<number, App['module']> = {
  1: 'Model',
  2: 'Animate',
  3: 'Render',
  4: 'ICE',
  5: 'Simulate',
  6: 'Hair',
  7: 'Hair',
};

const createDefaults = (regionSpdl as { create_defaults?: Record<string, number> }).create_defaults
  ?? { Left: 0.1, Right: 0.9, Top: 0.1, Bottom: 0.9 };

export function getSiRenderRegion(): RrState {
  const w = window as any;
  if (!w.__siRenderRegion) {
    w.__siRenderRegion = {
      visible: true,
      track: false,
      refresh: 'Interactive',
      display: 'RGBA',
      autoRefresh: true,
      channel: 'Main',
      showRenderedImage: true,
      left: createDefaults.Left,
      right: createDefaults.Right,
      top: createDefaults.Top,
      bottom: createDefaults.Bottom,
      open: false,
    } satisfies RrState;
  }
  const rr = w.__siRenderRegion as RrState;
  // Backfill fields for older moduleToolbar init that only set a subset.
  if (rr.autoRefresh === undefined) rr.autoRefresh = true;
  if (rr.channel === undefined) rr.channel = 'Main';
  if (rr.showRenderedImage === undefined) rr.showRenderedImage = true;
  if (rr.left === undefined) rr.left = createDefaults.Left;
  if (rr.right === undefined) rr.right = createDefaults.Right;
  if (rr.top === undefined) rr.top = createDefaults.Top;
  if (rr.bottom === undefined) rr.bottom = createDefaults.Bottom;
  if (rr.open === undefined) rr.open = false;
  return rr;
}

/** Softimage scripting-name leaves attested on the Render toolbar OM dump. */
export function registerRenderToolbarOmCommands(app: App) {
  const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

  // ——— Render region commands: CMD-B19a (src/commands/renderB19a.ts) ———

  // ——— Render channels ———
  const channels = (window as any).__siRenderChannels
    ?? ((window as any).__siRenderChannels = [{ name: 'Main', type: 'Color' }]);
  app.register({
    name: 'CreateRenderChannel',
    label: 'Create New Render Channel',
    category: 'Rendering',
    args: [{ name: 'Name', default: '' }, { name: 'Type', default: '' }, { name: 'Value', default: '' }],
    execute(app, a) {
      const name = String(a.Name || a.Value || `Channel${channels.length}`);
      const type = String(a.Type || 'Color').replace(/^:siRenderChannel/, '').replace(/Type$/i, '') || 'Color';
      const ch = { name, type };
      app.record('CreateRenderChannel', () => { channels.push(ch); }, () => {
        const i = channels.indexOf(ch); if (i >= 0) channels.splice(i, 1);
      });
      app.logMsg('info', `Render channel created: ${name}`);
      return ch;
    },
  });
  // RemoveRenderChannel: CMD-B19a (renderB19a.ts)
  app.register({
    name: 'DisposeRenderingCache',
    label: 'Dispose Rendering Cache',
    category: 'Rendering',
    args: [],
    undoable: false,
    execute(app) { app.logMsg('info', 'Dispose Rendering Cache'); },
  });
  app.register({
    name: 'SIUpdateRenderOptionsFromGlobalPref',
    label: 'Update Render Options',
    category: 'Rendering|Preferences',
    args: [{ name: 'InputObjs', default: '' }],
    undoable: false,
    execute(app) {
      const prefs = (app as any).renderPrefs;
      const ro = app.scene.renderOptions;
      if (prefs?.renderer && ro.get('Renderer')) app.setParam(ro.get('Renderer')!, prefs.renderer);
      if (prefs?.outputDir && ro.get('OutputDir')) app.setParam(ro.get('OutputDir')!, prefs.outputDir);
      app.logMsg('info', 'Update Render Options from global prefs');
      app.events.emit('params');
    },
  });
  // RenderPassToggleShowRenderedImage, RenderPassesFrameSet, ExportRenderArchiveFrameSet, SIRenderPass: CMD-B19a (renderB19a.ts)
  app.register({
    name: 'CopyRenderOptions',
    label: 'Copy Render Options ',
    category: 'Custom',
    args: [],
    undoable: false,
    execute(app) { app.logMsg('info', 'Copy Render Options'); },
  });
  app.register({
    name: 'MakeRendererLocalToPass',
    label: 'Make Renderer Local to Pass',
    category: 'Custom',
    args: [],
    undoable: false,
    execute(app) {
      const p = app.scene.passes[app.scene.passes.length - 1];
      if (p?.get('Renderer') && app.scene.renderOptions.get('Renderer'))
        app.setParam(p.get('Renderer')!, app.scene.renderOptions.val('Renderer'));
      app.logMsg('info', 'Make Renderer Local to Pass');
    },
  });
  app.register({
    name: 'MakePassRendererGlobal',
    label: 'Make Pass Renderer Global',
    category: 'Custom',
    args: [],
    undoable: false,
    execute(app) {
      const p = app.scene.passes[app.scene.passes.length - 1];
      if (p?.get('Renderer')) app.setParam(p.get('Renderer')!, '');
      app.logMsg('info', 'Make Pass Renderer Global');
    },
  });
  app.register({
    name: 'UpdateRenderManager',
    label: 'Update Render Manager',
    category: 'Custom',
    args: [],
    undoable: false,
    execute() { openView('Render Manager'); },
  });

  // Softimage SwitchToolbar Target: 1 Model … 6 Hair; true-95pct unlock SwitchToolbar(7) → Hair DUMP_READY.
  app.register({
    name: 'SwitchToolbar',
    label: 'Switch to Render Toolbar',
    category: 'Toolbar',
    args: [{ name: 'Target', default: 3 }],
    undoable: false,
    execute(app, a) {
      const t = Number(a.Target);
      const mod = TOOLBAR_TARGET[t] ?? 'Render';
      app.module = mod;
      app.events.emit('module');
      app.logMsg('info', `SwitchToolbar(${t}) → ${mod}`);
      return mod;
    },
  });

  // WR-05 — Softimage CreateFramebuffer / SICreateFramebuffer; Filename pattern from Rendering.vbs flipbook path.
  app.register({
    name: 'CreateFramebuffer',
    label: 'Create New Output Framebuffer on a Pass',
    category: 'Rendering',
    args: [
      { name: 'Pass', default: '' },
      { name: 'Name', default: 'Main' },
    ],
    undoable: true,
    execute(app, a) {
      const passName = String(a.Pass || '');
      const pass = (passName && app.scene.passes.find(p => p.name === passName))
        || app.scene.passes[app.scene.passes.length - 1]
        || app.scene.passes[0];
      if (!pass) { app.logMsg('error', 'CreateFramebuffer: no pass'); return; }
      const fbName = String(a.Name || 'Main');
      const existing = pass.framebuffers.find(f => f.name === fbName);
      if (existing) {
        app.logMsg('info', `CreateFramebuffer: ${pass.name}.${fbName} already exists`);
        return existing;
      }
      const fb = pass.addFramebuffer(fbName);
      // Softimage Framebuffer.GetResolvedPath / Filename token template (Rendering.vbs attested).
      if (fb.get('Filename')) app.setParam(fb.get('Filename')!, '[Pass]_[Framebuffer]');
      if (fb.get('Format')) app.setParam(fb.get('Format')!, 'pic');
      app.events.emit('scene');
      app.logMsg('info', `CreateFramebuffer → ${pass.name}.${fb.name} Format=pic Filename=[Pass]_[Framebuffer]`);
      return fb;
    },
  });

  app.register({
    name: 'DisconnectAndDeleteShaders',
    label: 'RendertreeDeleteShaders',
    category: 'Rendering',
    args: [{ name: 'Shaders', default: null }],
    undoable: false,
    execute(app) { app.logMsg('info', 'RendertreeDeleteShaders'); },
  });
  app.register({
    name: 'DisconnectAndDeleteOrUnnestShaders',
    label: 'RendertreeDeleteOrUnnestShaders',
    category: 'Rendering',
    args: [{ name: 'Shaders', default: null }, { name: 'Containers', default: null }],
    undoable: false,
    execute(app) { app.logMsg('info', 'RendertreeDeleteOrUnnestShaders'); },
  });
  // ToggleCurrentLayerProperty: CMD-B17a (selectionLayersB17a.ts)

  // Softimage empty-scripting-name leaf → OpenRenderingPreferences.
  if (!app.commands.has('InspectRenderingPreferences')) {
    app.register({
      name: 'InspectRenderingPreferences',
      label: 'Inspect Rendering Preferences',
      category: 'Rendering',
      args: [{ name: 'Preference', default: 'Rendering' }],
      undoable: false,
      execute: () => app.run('OpenRenderingPreferences'),
    });
  }
}

/** Compact audit for __uiAudit / compare_render_fidelity — Softimage scripting names present. */
export function renderToolbarOmAudit(app?: App): Record<string, unknown> {
  const A = app ?? (window as any).Application;
  const cmds = (inventory as { cmds: { scripting_name: string; label: string }[] }).cmds;
  const missing: string[] = [];
  const present: string[] = [];
  for (const c of cmds) {
    if (A?.commands?.has?.(c.scripting_name)) present.push(c.scripting_name);
    else missing.push(c.scripting_name);
  }
  const rr = getSiRenderRegion();
  const region = A?.scene?.renderOptionsRegion;
  const regionMap: Record<string, unknown> = {};
  if (region) for (const p of region.params) regionMap[p.name] = p.value;
  return {
    lockId: (inventory as { lock_id?: string }).lock_id,
    softimage: (inventory as { softimage?: string }).softimage,
    inventoryCount: cmds.length,
    presentCount: present.length,
    missing,
    ok: missing.length === 0,
    regionOptions: regionMap,
    regionSpdlParams: (regionSpdl as { params: { sn: string }[] }).params.map(p => p.sn),
    hwndCrop: (regionSpdl as { hwnd_crop_chrome?: { status: string } }).hwnd_crop_chrome?.status ?? 'LOCK',
    createDefaults,
    rr: {
      open: rr.open,
      left: rr.left,
      right: rr.right,
      top: rr.top,
      bottom: rr.bottom,
      channel: rr.channel,
      autoRefresh: rr.autoRefresh,
    },
  };
}
