// Softimage Render toolbar OM scripting names — unlock_render_toolbar_om_probe + commands_full.json.
// Dump-backed labels/args only. Region HWND crop chrome stays LOCK (no invent).
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

const TOOLBAR_TARGET: Record<number, App['module']> = {
  1: 'Model',
  2: 'Animate',
  3: 'Render',
  4: 'ICE',
  5: 'Simulate',
  6: 'Hair',
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
  const rr = getSiRenderRegion();
  const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));
  const renderLog = (a: App, what: string) => {
    a.logMsg('info', `${what} (offline render stub — use Softimage for frames)`);
  };

  // ——— Region create / close (Softimage fractions; no HWND crop invent) ———
  app.register({
    name: 'RenderRegionCreate',
    label: 'Create Render Region',
    category: 'Rendering',
    args: [
      { name: 'Viewport', default: '' },
      { name: 'Left', default: createDefaults.Left },
      { name: 'Right', default: createDefaults.Right },
      { name: 'Top', default: createDefaults.Top },
      { name: 'Bottom', default: createDefaults.Bottom },
    ],
    undoable: false,
    execute(app, a) {
      rr.left = Number(a.Left ?? createDefaults.Left);
      rr.right = Number(a.Right ?? createDefaults.Right);
      rr.top = Number(a.Top ?? createDefaults.Top);
      rr.bottom = Number(a.Bottom ?? createDefaults.Bottom);
      rr.open = true;
      rr.visible = true;
      syncRegionMeta(app, rr);
      app.logMsg('info', `Render region created LRTB=${rr.left},${rr.right},${rr.top},${rr.bottom} (OM fractions; HWND crop LOCK)`);
      app.events.emit('frame');
      return rr;
    },
  });
  app.register({
    name: 'RenderRegionClose',
    label: 'Close Render Region',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }],
    undoable: false,
    execute(app) {
      rr.open = false;
      rr.visible = false;
      app.logMsg('info', 'Render region closed');
      app.events.emit('frame');
    },
  });

  app.register({
    name: 'RenderRegionToggleAutoRefresh',
    label: 'Toggle Auto-Refresh Mode for Render Region',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }],
    undoable: false,
    execute(app) {
      rr.autoRefresh = !rr.autoRefresh;
      app.logMsg('info', `Render region auto-refresh ${rr.autoRefresh ? 'ON' : 'OFF'}`);
    },
  });
  app.register({
    name: 'RenderRegionGetRefreshMode',
    label: 'Get Refresh Mode for Render Region',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }],
    undoable: false,
    execute() { return rr.refresh; },
  });
  app.register({
    name: 'RenderRegionGetDisplayType',
    label: 'Get Render Region Display Type',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }],
    undoable: false,
    execute() { return rr.display; },
  });
  app.register({
    name: 'RenderRegionSetRenderChannel',
    label: 'Set Render Region Viewing Render Channel',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }, { name: 'RenderChannel', default: 'Main' }],
    undoable: false,
    execute(app, a) {
      rr.channel = String(a.RenderChannel || 'Main');
      app.logMsg('info', `Render region channel: ${rr.channel}`);
      return rr.channel;
    },
  });
  app.register({
    name: 'RenderRegionGetRenderChannel',
    label: 'Get Render Region Viewing Render Channel',
    category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }],
    undoable: false,
    execute() { return rr.channel; },
  });

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
  app.register({
    name: 'RemoveRenderChannel',
    label: 'Remove Render Channel',
    category: 'Rendering',
    args: [{ name: 'Name', default: '' }],
    execute(app, a) {
      const name = String(a.Name || '');
      const i = channels.findIndex((c: { name: string }) => c.name === name);
      if (i < 0) throw new Error(`Render channel not found: ${name || '(empty)'}`);
      if (name === 'Main') throw new Error('Cannot remove Main render channel');
      const [removed] = channels.splice(i, 1);
      app.record('RemoveRenderChannel', () => { /* already removed */ }, () => { channels.splice(i, 0, removed); });
      app.logMsg('info', `Render channel removed: ${name}`);
      return removed;
    },
  });

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
  app.register({
    name: 'RenderPassToggleShowRenderedImage',
    label: 'Toggle Show Rendered Image for Pass Rendering',
    category: 'Rendering',
    args: [],
    undoable: false,
    execute(app) {
      rr.showRenderedImage = !rr.showRenderedImage;
      app.logMsg('info', `Show rendered image ${rr.showRenderedImage ? 'ON' : 'OFF'}`);
      return rr.showRenderedImage;
    },
  });
  app.register({
    name: 'RenderPassesFrameSet',
    label: 'Render Passes Using a Frame Set',
    category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.Current' }, { name: 'FrameSet', default: '' }, { name: 'Verbose', default: '' }],
    undoable: false,
    execute: (app, a) => renderLog(app, `Render Passes FrameSet ${a.FrameSet || '(pass frames)'}`),
  });
  app.register({
    name: 'ExportRenderArchiveFrameSet',
    label: 'Export Passes to Render Archive',
    category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.Current' }, { name: 'FrameSet', default: '' }, { name: 'Verbose', default: '' }],
    undoable: false,
    execute: (app, a) => app.logMsg('info', `Export render archive frameset: ${a.FrameSet || 'stub'}`),
  });
  app.register({
    name: 'SIRenderPass',
    label: 'Render Pass',
    category: 'Rendering',
    args: [
      { name: 'Passes', default: 'Passes.Current' },
      { name: 'PresetObj', default: null },
      { name: 'StartFrame', default: null },
      { name: 'EndFrame', default: null },
      { name: 'StepFrame', default: null },
      { name: 'DisposeRendering', default: true },
    ],
    undoable: false,
    execute: (app) => app.run('RenderPass', { Passes: 'Passes.Current' }),
  });
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

  // Softimage SwitchToolbar Target: 1 Model … 3 Render … 6 Hair (commands_full).
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
      app.logMsg('info', `SwitchToolbar → ${mod}`);
      return mod;
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
  app.register({
    name: 'ToggleCurrentLayerProperty',
    label: 'Rendering Visibility of Current Layer',
    category: 'Layer',
    args: [{ name: 'PropName', default: 'rendvis' }],
    undoable: false,
    execute(app, a) {
      const layer = app.scene.layers[app.scene.layers.length - 1];
      const prop = String(a.PropName || 'rendvis');
      app.logMsg('info', `Toggle layer ${layer?.name ?? '?'} .${prop}`);
    },
  });

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

function syncRegionMeta(app: App, rr: RrState) {
  const prop = app.scene.renderOptionsRegion;
  if (!prop) return;
  // Softimage MetaData Region* are ReadOnly; store OM fractions as Width/Height when open.
  // HWND pixel crop stays LOCK — do not invent px.
  const w = Math.max(0, rr.right - rr.left);
  const h = Math.max(0, rr.bottom - rr.top);
  if (prop.get('RegionOffsetX')) app.setParam(prop.get('RegionOffsetX')!, rr.left);
  if (prop.get('RegionOffsetY')) app.setParam(prop.get('RegionOffsetY')!, rr.top);
  if (prop.get('RegionWidth')) app.setParam(prop.get('RegionWidth')!, w);
  if (prop.get('RegionHeight')) app.setParam(prop.get('RegionHeight')!, h);
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
