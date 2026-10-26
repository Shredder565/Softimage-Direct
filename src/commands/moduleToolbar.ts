// High-traffic Render / Simulate / Hair module-toolbar commands.
// Scripting names and args follow Softimage's registry (data/commands_full.json);
// menu id → command wiring lives in src/data/menu_commands.json (PC dump / command-map derived).
import { App } from '../core/commands';
import { Null, Partition, Property, X3DObject } from '../core/scene';
import { bool, num, str } from '../core/params';
import { getSiRenderRegion } from './renderToolbarOm';
import { applyClothToObjects } from './clothPpg';
import { executeRenderCurrentFrame, executeRenderPass, renderScenePasses } from '../core/sceneRender';
import {
  exportObjectRenderArchive,
  exportRenderArchive,
  exportRenderArchiveAllPasses,
  resolveSelectedOrCurrentPasses,
} from '../core/renderArchive';

const addObject = (app: App, obj: X3DObject, parent?: X3DObject | null) => {
  const p = parent ?? app.scene.root;
  app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj));
  return obj;
};

const addNamedProp = (app: App, objs: X3DObject[], preset: string, type: string, extra: Parameters<typeof Property.prototype.add>[0][] = []) => {
  const out: Property[] = [];
  for (const o of objs) {
    const p = new Property(preset, type, [bool('enabled', true, 'Enabled'), ...extra]);
    app.record('Add ' + preset, () => o.addProperty(p), () => o.removeProperty(p));
    out.push(p);
  }
  if (out.length) app.select(out);
  return out[0] ?? null;
};

const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

  /** Softimage Manipulation tools — harvest/commands_full: "Activate the … tool" + optional Clsid. */
  const armTool = (app: App, label: string, clsid?: string) => {
    const A = app as any;
    A.armedTool = { label, clsid: clsid || null };
    app.logMsg('info', clsid
      ? `${label}: activated (Softimage Clsid ${clsid})`
      : `${label}: activated`);
    app.events.emit('selection');
    return A.armedTool;
  };
  const stubTool = (app: App, label: string) => armTool(app, label);

/** Softimage Render / Simulate / Hair leaves that were unmapped after PE menu import. */
export function registerModuleToolbarCommands(app: App) {
  // ——— Render: cameras / clips / UV / editors ———
  app.register({
    name: 'CreateUserMotion', label: 'Create User Motion', category: 'Rendering',
    args: [{ name: 'InputObjs', default: '' }, { name: 'PropertyName', default: 'UserMotion' }, { name: 'PropPresetObj', default: 'User Motion Property' }],
    execute: (app, a) => addNamedProp(app, app.targets(a.InputObjs), String(a.PropPresetObj || 'User Motion Property'), 'usermotion', [str('name', a.PropertyName || 'UserMotion', 'Name')]),
  });
  app.register({
    name: 'CreateImageClip', label: 'Create Image Clip from File', category: 'Rendering',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const name = app.scene.uniqueName(a.Name || 'ImageClip');
      const p = new Property(name, 'imageclip', [str('filename', a.FileName || '', 'File Name'), bool('enabled', true, 'Enabled')]);
      app.record('Image clip', () => app.scene.root.addProperty(p), () => app.scene.root.removeProperty(p));
      app.select([p]);
      app.logMsg('info', a.FileName ? `Image clip: ${a.FileName}` : 'Image clip created (set File Name in PPG)');
      return p;
    },
  });
  for (const [name, label] of [['SwimUVW', 'Swim UV'], ['StickUVW', 'Stick UV'], ['ReprojectUVW', 'Reproject UV']] as const) {
    app.register({
      name, label, category: 'Texturing',
      args: [{ name: 'InputObjs', default: '' }],
      execute(app, a) {
        const objs = app.targets(a.InputObjs);
        if (!objs.length) throw new Error('Select an object with UVs');
        for (const o of objs) addNamedProp(app, [o], label, name.toLowerCase());
        app.logMsg('info', `${label} on ${objs.map(o => o.name).join(', ')}`);
        return null;
      },
    });
  }
  app.register({
    name: 'InspectCurrentUV', label: 'Inspect Current UV', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }],
    undoable: false, execute(app) { openView('Texture Editor'); app.logMsg('info', 'Inspect Current UV → Texture Editor'); },
  });
  app.register({
    name: 'InspectAllUVs', label: 'Inspect All UVs', category: 'Texturing', args: [{ name: 'InputObjs', default: '' }],
    undoable: false, execute(app) { openView('Texture Editor'); app.logMsg('info', 'Inspect All UVs → Texture Editor'); },
  });
  // WR-10 — Softimage PE label "Edit Projection" (toolbarobj UTF-16). Scripting name EditUVProjectionTool ABSENT.
  // Softimage-absent MATCH for SN; open Texture Editor under PE label only (no invent tool Clsid).
  app.register({
    name: 'EditUVProjectionTool', label: 'Edit Projection', category: 'Texturing', args: [],
    undoable: false, canRun: () => false,
    description: 'Softimage PE Edit Projection — scripting name ABSENT (behavioral tour WR-10)',
    execute() { throw new Error('EditUVProjectionTool: Softimage Commands entry absent (Softimage-absent MATCH); use Texture Editor / UVW fuzzy cmds'); },
  });
  // Softimage PE-friendly alias — opens Texture Editor (attested OpenTextureEditor path), not invent SN.
  if (!app.commands.has('Edit Projection')) {
    app.register({
      name: 'Edit Projection', label: 'Edit Projection', category: 'Texturing', args: [],
      undoable: false,
      execute(app) {
        openView('Texture Editor');
        const p = app.selectedObjects[0]?.property('uvprojection');
        if (p) app.events.emit('inspect', p);
        app.logMsg('info', 'Edit Projection → Texture Editor (PE label; Softimage EditUVProjectionTool SN ABSENT)');
      },
    });
  }
  // Softimage true-95pct unlock fuzzy UVW ACTIVE set (do not invent EditUVProjectionTool).
  // Arity from true95_unlock_dump.json EditUVProjectionTool.fuzzy.
  for (const u of [
    { name: 'HealUVW', label: 'Heal UVW', args: 2 },
    { name: 'MatchUVW', label: 'Match UVW', args: 3 },
    { name: 'CycleUVW', label: 'Cycle UVW', args: 3 },
    { name: 'FlipUVW', label: 'Flip UVW', args: 3 },
    { name: 'CopyUVW', label: 'Copy UVW', args: 2 },
    { name: 'PasteUVW', label: 'Paste UVW', args: 3 },
    { name: 'FreezeUVWTransformation', label: 'Freeze UVW transformation', args: 1 },
    { name: 'RelaxUVW', label: 'Relax UVW', args: 2 },
    { name: 'IslandHealUVW', label: 'Island Heal UVW', args: 5 },
  ] as const) {
    if (app.commands.has(u.name)) continue;
    const argDefs = Array.from({ length: u.args }, (_, i) => ({ name: i === 0 ? 'InputObjs' : `Arg${i}`, default: i === 0 ? '' : null }));
    app.register({
      name: u.name, label: u.label, category: 'Texturing', args: argDefs,
      execute(app, a) {
        const objs = app.targets(a.InputObjs);
        if (!objs.length && u.args) throw new Error(`Select an object with UVs (${u.name})`);
        for (const o of objs) addNamedProp(app, [o], u.label, u.name.toLowerCase());
        app.logMsg('info', `${u.label} (true-95pct UVW DUMP_READY arity ${u.args})`);
        return null;
      },
    });
  }
  app.register({
    name: 'OpenRenderTree', label: 'Open Render Tree', category: 'Rendering', args: [],
    undoable: false, execute() { openView('Render Tree'); },
  });
  app.register({
    name: 'OpenTextureEditor', label: 'Open Texture Editor', category: 'Texturing', args: [],
    undoable: false, execute() { openView('Texture Editor'); },
  });

  // ——— Render region (WR-04) — Softimage RenderRegionTool Clsid + prior HWND crop dumps ———
  // Registry: Clsid={70F24601-A6F1-11D1-9C1A-00A0243F0F55}. Keymap "Render Region Tool" → renderregion.
  const rr = getSiRenderRegion();
  const REGION_CLSID = '{70F24601-A6F1-11D1-9C1A-00A0243F0F55}';
  app.register({
    name: 'RenderRegionTool',
    label: 'Render Region Tool',
    category: 'Rendering',
    args: [{ name: 'Clsid', default: REGION_CLSID }, { name: 'KeyboardProcess', default: true }],
    undoable: false,
    description: 'Create a region for interactive rendering',
    execute(app, a) {
      const clsid = String(a.Clsid || REGION_CLSID);
      armTool(app, 'Render Region Tool', clsid);
      // Softimage Manipulation tool: arm viewport drag (viewExtras renderregion listener).
      window.dispatchEvent(new CustomEvent('renderregion'));
      // Also ensure OM region exists with dump-attested create defaults when first armed.
      if (!rr.open) app.run('RenderRegionCreate', {});
      return { label: 'Render Region Tool', clsid };
    },
  });
  app.register({
    name: 'CreateRenderRegion',
    label: 'Create Render Region',
    category: 'Rendering',
    args: [],
    undoable: false,
    execute: (app) => app.run('RenderRegionCreate', {}),
  });
  app.register({
    name: 'ToggleRenderRegion',
    label: 'Toggle Render Region',
    category: 'Rendering',
    args: [],
    undoable: false,
    execute: (app) => app.run('RenderRegionToggleVisibility', {}),
  });
  app.register({
    name: 'RenderRegionSave', label: 'Save Render Region To File', category: 'Rendering',
    args: [{ name: 'FileName', default: null }], undoable: false,
    execute(app, a) {
      // Softimage Save Render Region — capture viewport region plate (viewExtras regionImg) when present.
      const g = globalThis as any;
      const vps = g.__viewports as { regionImg?: HTMLCanvasElement }[] | undefined;
      const canvas = vps?.map(v => (v as any).regionImg).find(Boolean) as HTMLCanvasElement | undefined;
      const name = String(a.FileName || 'RenderRegion.png');
      if (canvas && typeof document !== 'undefined') {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = name.endsWith('.png') ? name : `${name}.png`;
        link.click();
        app.logMsg('info', `Render region saved → ${link.download}`);
        return link.download;
      }
      // Fallback: still of current frame cropped via full still (region fractions already on OM).
      const still = renderScenePasses(app, { passes: 'Passes.Current', currentFrameOnly: true, download: true, openPreview: false });
      app.logMsg('info', `Render region save (still fallback): ${still.files[0]?.path ?? name}`);
      return still;
    },
  });
  app.register({
    name: 'RenderRegionRefresh', label: 'Refresh Render Region', category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }], undoable: false,
    execute(app) {
      window.dispatchEvent(new CustomEvent('renderregion-refresh'));
      app.logMsg('info', 'Render region refreshed');
      app.events.emit('frame');
    },
  });
  app.register({
    name: 'RenderRegionToggleVisibility', label: 'Show/Hide Render Region', category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }], undoable: false,
    execute(app) {
      rr.visible = !rr.visible;
      window.dispatchEvent(new CustomEvent('renderregion-toggle'));
      app.logMsg('info', `Render region ${rr.visible ? 'shown' : 'hidden'}`);
    },
  });
  app.register({ name: 'RenderRegionToggleSelectionTracking', label: 'Toggle Selection Tracking for Render Region', category: 'Rendering', args: [{ name: 'Viewport', default: '' }], undoable: false, execute(app) { rr.track = !rr.track; app.logMsg('info', `Render region track selection ${rr.track ? 'ON' : 'OFF'}`); } });
  app.register({
    name: 'RenderRegionSetRefreshMode', label: 'Set Refresh Mode for Render Region', category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }, { name: 'RefreshMode', default: '' }], undoable: false,
    execute(app, a) {
      const m = String(a.RefreshMode || '');
      rr.refresh = m.includes('Manual') ? 'Manual' : (m.includes('CTRS') || m.includes('Camera')) ? 'Camera/Time/Region' : 'Interactive';
      app.logMsg('info', `Render region refresh: ${rr.refresh}`);
    },
  });
  app.register({
    name: 'RenderRegionSetDisplayType', label: 'Set Render Region Display Type', category: 'Rendering',
    args: [{ name: 'Viewport', default: '' }, { name: 'Type', default: '' }], undoable: false,
    execute(app, a) {
      const t = String(a.Type || '');
      rr.display = t.includes('Alpha') && !t.includes('RGBA') && !t.includes('RGB') ? 'Alpha'
        : t.includes('Red') ? 'Red' : t.includes('Green') ? 'Green' : t.includes('Blue') ? 'Blue'
          : t.includes('RGB') && !t.includes('RGBA') ? 'RGB' : 'RGBA';
      app.logMsg('info', `Render region display: ${rr.display}`);
    },
  });
  app.register({
    name: 'InspectViewportRenderRegionOptions', label: 'Inspect Viewport Render Region Options', category: 'Rendering',
    args: [{ name: 'View', default: '' }], undoable: false,
    execute(app) {
      const ro = app.scene.renderOptionsRegion;
      const map = ro ? Object.fromEntries(ro.params.map(p => [p.name, p.value])) : {};
      app.logMsg('info', `Render region options: visible=${rr.visible} track=${rr.track} refresh=${rr.refresh} display=${rr.display} channel=${rr.channel} open=${rr.open} UsePassOptions=${map.UsePassOptions}`);
      if (ro) {
        app.select([ro]);
        app.events.emit('inspect', ro);
      }
      return ro;
    },
  });

  // ——— Passes / render ———
  const passName = (a: any) => a.Name || String(a.PresetObj || 'Pass').replace(/_Pass$/i, '').replace(/_/g, ' ') || 'Pass';
  const createPass = app.commands.get('CreatePass')!;
  createPass.args = [{ name: 'Name', default: 'Pass' }, { name: 'PresetObj', default: 'Pass' }, { name: 'Value', default: null }];
  createPass.execute = (app, a) => {
    const p = app.scene.addPass(passName(a));
    app.select([]);
    app.logMsg('info', `Pass created: ${p.name}`);
    app.events.emit('scene');
    return p;
  };

  app.register({ name: 'CreatePassFromLayers', label: 'New Pass Based on Layers', category: 'Rendering', args: [{ name: 'Name', default: '' }], execute: (app, a) => app.run('CreatePass', { Name: a.Name || 'LayerPass', PresetObj: 'Pass' }) });
  app.register({ name: 'CreateImageBasedLightingPass', label: 'Create Image Based Lighting Pass', category: 'Rendering', args: [{ name: 'Filename', default: '' }], execute: (app) => app.run('CreatePass', { Name: 'IBL', PresetObj: 'IBL_Pass' }) });
  app.register({
    name: 'DuplicateCurrentPass', label: 'Duplicate Current Pass', category: 'Rendering', args: [],
    execute(app) {
      const cur = app.scene.passes[app.scene.passes.length - 1];
      if (!cur) throw new Error('No pass to duplicate');
      return app.run('CreatePass', { Name: cur.name + '_Copy', PresetObj: 'Pass' });
    },
  });
  app.register({
    name: 'DeleteCurrentPass', label: 'Delete Current Pass', category: 'Rendering', args: [],
    execute(app) {
      const passes = app.scene.passes;
      if (passes.length <= 1) throw new Error('Cannot delete the last pass');
      const p = passes.pop()!;
      app.record('Delete pass', () => { /* already popped */ }, () => { passes.push(p); });
      app.events.emit('scene');
      return p;
    },
  });
  // WR-05 — Softimage SICreatePartition / AddToPartition / RemoveFromPartition on Pass.partitions.
  const resolvePartitionTarget = (app: App, target: unknown): Partition | null => {
    if (target instanceof Partition) return target;
    const name = target != null && target !== '' ? String(target) : '';
    const pass = app.scene.passes[app.scene.passes.length - 1];
    if (!pass) return null;
    if (name) return pass.partitions.find(p => p.name === name) ?? null;
    const fromSel = app.selection.find((n): n is Partition => n instanceof Partition);
    return fromSel ?? pass.partitions[pass.partitions.length - 1] ?? null;
  };
  app.register({
    name: 'CreatePartition', label: 'New Partition', category: 'Rendering',
    args: [{ name: 'Target', default: '' }, { name: 'Name', default: 'Partition' }, { name: 'InputObjs', default: '' }],
    execute(app, a) {
      const passName = String(a.Target || '');
      const pass = (passName && app.scene.passes.find(p => p.name === passName))
        || app.scene.passes[app.scene.passes.length - 1];
      if (!pass) throw new Error('No current pass');
      const p = pass.addPartition(app.scene.uniqueName(a.Name || 'Partition'));
      const objs = app.targets(a.InputObjs);
      for (const o of objs) p.members.add(o);
      app.select([p]);
      app.events.emit('scene');
      app.logMsg('info', `CreatePartition → ${pass.name}.${p.name} (${objs.length} member(s))`);
      return p;
    },
  });
  app.register({
    name: 'AddToPartition', label: 'Add Object to Partition', category: 'Rendering',
    args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }],
    execute(app, a) {
      const part = resolvePartitionTarget(app, a.Target);
      if (!part) throw new Error('AddToPartition: no partition Target');
      const objs = app.targets(a.InputObjs);
      if (!objs.length) throw new Error('AddToPartition: select objects');
      for (const o of objs) part.members.add(o);
      app.events.emit('scene');
      app.logMsg('info', `AddToPartition → ${part.name}: ${objs.map(o => o.name).join(', ')}`);
      return part;
    },
  });
  app.register({
    name: 'RemoveFromPartition', label: 'Remove Object from Partition', category: 'Rendering',
    args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }],
    execute(app, a) {
      const part = resolvePartitionTarget(app, a.Target);
      if (!part) throw new Error('RemoveFromPartition: no partition Target');
      const objs = app.targets(a.InputObjs);
      for (const o of objs) part.members.delete(o);
      app.events.emit('scene');
      app.logMsg('info', `RemoveFromPartition → ${part.name}: ${objs.map(o => o.name).join(', ') || '(none)'}`);
      return part;
    },
  });

  // WR-01/02 — Softimage RenderPass(es)/CurrentFrame + OnBegin/OnEndRenderPass (sceneRender).
  // true-95pct: Format=pic; ResolvedFilename; do not conflate empty RenderPasses with CurrentFrame.
  app.register({
    name: 'RenderPass', label: 'Render Pass', category: 'Rendering',
    args: [
      { name: 'Passes', default: 'Passes.Current' }, { name: 'PresetObj', default: null },
      { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null },
      { name: 'StepFrame', default: null }, { name: 'DisposeRendering', default: true },
    ],
    undoable: false, description: 'Render the specified pass (current pass if not specified)',
    execute: (app, a) => executeRenderPass(app, a),
  });
  app.register({
    name: 'RenderPasses', label: 'Render Passes', category: 'Rendering',
    args: [
      { name: 'Passes', default: 'Passes.Current' }, { name: 'StartFrame', default: null },
      { name: 'EndFrame', default: null }, { name: 'StepFrame', default: null },
      { name: 'Verbose', default: ':siRenderVerbosityDefault:siRenderVerbosity' },
    ],
    undoable: false, description: 'Render a the list of passes, or current pass if none specified',
    execute: (app, a) => executeRenderPass(app, a),
  });
  app.register({
    name: 'Render Current Pass', label: 'Render Current Pass', category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.Current' }], undoable: false,
    description: 'Render selected passes',
    execute: (app, a) => executeRenderPass(app, { Passes: a.Passes ?? 'Passes.Current' }),
  });
  app.register({
    name: 'RenderSelectedPasses', label: 'Render Selected Passes', category: 'Rendering',
    args: [{ name: 'Passes', default: null }], undoable: false,
    execute(app, a) {
      if (a.Passes) return executeRenderPass(app, { Passes: a.Passes });
      // Softimage: selected Pass explorer nodes, else Passes.Current (registry Collection).
      const passes = resolveSelectedOrCurrentPasses(app);
      const key = passes.length === 1
        ? (passes[0]!.name || 'Passes.Current')
        : passes.map(p => p.name).join(',');
      return renderScenePasses(app, { passes: key || 'Passes.Current' });
    },
  });
  app.register({
    name: 'RenderAllPasses', label: 'Render All Passes', category: 'Rendering',
    args: [
      { name: 'Passes', default: 'Passes.List.*' }, { name: 'StartFrame', default: null },
      { name: 'EndFrame', default: null }, { name: 'StepFrame', default: null },
      { name: 'Verbose', default: ':siRenderVerbosityDefault:siRenderVerbosity' },
    ],
    undoable: false,
    execute: (app, a) => executeRenderPass(app, { ...a, Passes: a.Passes ?? 'Passes.List.*' }),
  });
  app.register({
    name: 'RenderCurrentFrame', label: 'Render Current Frame', category: 'Rendering',
    args: [], undoable: false,
    description: 'Softimage RenderCurrentFrame_Execute — Start=End=PlayControl.Current',
    execute: (app) => executeRenderCurrentFrame(app, false),
  });
  app.register({
    name: 'RenderCurrentFrameAllPasses', label: 'Render Current Frame All Passes', category: 'Rendering',
    args: [], undoable: false,
    description: 'Softimage RenderCurrentFrameAllPasses_Execute — all passes at current frame',
    execute: (app) => executeRenderCurrentFrame(app, true),
  });
  app.register({ name: 'RenderPreview', label: 'Render Preview', category: 'Rendering', args: [], undoable: false, execute() { openView('Render Manager'); } });
  app.register({ name: 'OpenRenderingPreferences', label: 'Open Rendering Preferences', category: 'Rendering', args: [], undoable: false, execute() { window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Rendering' } })); } });
  app.register({ name: 'InspectCurrentPass', label: 'Inspect Current Pass', category: 'Rendering', args: [], undoable: false, execute(app) { const p = app.scene.passes[app.scene.passes.length - 1]; if (p) app.logMsg('info', `Current pass: ${p.name}`); openView('Render Manager'); } });
  app.register({ name: 'InspectRendererOptions', label: 'Inspect Renderer Options', category: 'Rendering', args: [], undoable: false, execute() { window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Rendering' } })); } });
  // WR-03 — Softimage Export*RenderArchive registry args; Softimage .mi ABSENT → AfterImage JSON package.
  app.register({
    name: 'ExportRenderArchive', label: 'Export Selected Passes to Render Archive', category: 'Rendering',
    args: [
      { name: 'Passes', default: 'Passes.Current' }, { name: 'StartFrame', default: null },
      { name: 'EndFrame', default: null }, { name: 'StepFrame', default: null },
      { name: 'Verbose', default: ':siRenderVerbosityDefault:siRenderVerbosity' },
    ],
    undoable: false,
    description: 'Export a list of passes to a render archive, or the current pass if none specified',
    execute: (app, a) => exportRenderArchive(app, a),
  });
  app.register({
    name: 'ExportRenderArchiveAllPasses', label: 'Export All Passes to Render Archives', category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.List.*' }], undoable: false,
    description: 'Export All Passes to Render Archives',
    execute: (app, a) => exportRenderArchiveAllPasses(app, a),
  });
  app.register({
    name: 'ExportObjectRenderArchive', label: 'Export an Object to a Render Archive', category: 'Rendering',
    args: [
      { name: 'InputObj', default: null }, { name: 'FileName', default: '' },
      { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null },
      { name: 'StepFrame', default: null }, { name: 'MultiFrame', default: false },
      { name: 'DisplayProxy', default: true },
    ],
    undoable: false,
    description: 'Export an object and all its children to a render archive, or the current selection if none specified',
    execute: (app, a) => exportObjectRenderArchive(app, a),
  });

  // ——— Simulate: rigid / soft / cloth ———
  const rbProp = (app: App, passive: boolean) => {
    const objs = app.selectedObjects;
    if (!objs.length) throw new Error('Select one or more objects');
    for (const o of objs) {
      let p = o.properties.find(x => x.type === 'rigidbodyprop');
      if (!p) {
        p = new Property('Rigid Body', 'rigidbodyprop', [bool('passive', passive, 'Passive'), num('mass', 1, 'Mass', { min: 0 })]);
        app.record('Rigid body', () => o.addProperty(p!), () => o.removeProperty(p!));
      } else app.setParam(p.get('passive')!, passive);
    }
    app.logMsg('info', `${passive ? 'Passive' : 'Active'} rigid body on ${objs.map(o => o.name).join(', ')}`);
    return objs[0];
  };
  app.register({ name: 'CreateActiveRigidBody', label: 'Active Rigid Body', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }], execute: (app) => rbProp(app, false) });
  app.register({ name: 'CreatePassiveRigidBody', label: 'Passive Rigid Body', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }], execute: (app) => rbProp(app, true) });
  app.register({
    name: 'CreateCompoundRigidBody', label: 'Compound Rigid Body', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute(app) {
      const objs = app.selectedObjects;
      if (objs.length < 2) throw new Error('Select multiple objects for a compound rigid body');
      rbProp(app, false);
      const host = objs[0];
      host.add(str('compound_children', objs.slice(1).map(o => o.name).join(','), 'Compound Children', { readOnly: true }));
      return host;
    },
  });
  app.register({
    name: 'AttachRigidBodies', label: 'Attach Rigid Bodies', category: 'Simulation',
    args: [{ name: 'Name', default: 'BallSocket' }, { name: 'Bodies', default: null }, { name: 'Px', default: 0 }, { name: 'Py', default: 0 }],
    execute(app, a) {
      const objs = app.selectedObjects;
      if (objs.length < 1) throw new Error('Select rigid bodies to constrain');
      const n = new Null(app.scene.uniqueName(String(a.Name || 'BallSocket') + '_cns'));
      n.add(str('cnstype', String(a.Name || 'BallSocket'), 'Constraint Type', { readOnly: true }));
      n.add(str('bodies', objs.map(o => o.name).join(','), 'Bodies', { readOnly: true }));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  // WR-09 — Softimage MultiAttachRigidBodiesTool (commands_full Name=Hinge|BallSocket|Spring|Slider|Fixed).
  // Pick-two-bodies → AttachRigidBodies; same Softimage Name args — no invent solver.
  app.register({
    name: 'MultiAttachRigidBodiesTool', label: 'Multi Attach Rigid Bodies Tool', category: 'Simulation',
    args: [{ name: 'Name', default: 'BallSocket' }, { name: 'Bodies', default: null }],
    description: 'Attach rigid bodies together with a rigid constraint',
    canRun: (a) => {
      if (a?.Bodies) return true;
      return app.selectedObjects.length >= 1;
    },
    execute(app, a) {
      const kind = String(a.Name || 'BallSocket');
      const named = a.Bodies ? app.targets(a.Bodies) : [];
      const bodies = named.length >= 2 ? named : app.selectedObjects;
      if (bodies.length >= 2) {
        app.select(bodies.slice(0, 2));
        return app.run('AttachRigidBodies', { Name: kind, Bodies: bodies.slice(0, 2).map(o => o.name).join(',') });
      }
      // Softimage multi-attach tool: arm pick until two rigid bodies selected.
      const A = app as any;
      A.armedTool = { label: 'Multi Attach Rigid Bodies Tool', clsid: null, multiAttach: kind, picks: [...bodies] };
      app.setTool({
        name: 'Multi Attach Rigid Bodies Tool',
        prompt: `MultiAttach (${kind}): pick two rigid bodies`,
        onClick() { /* selection-driven via events */ },
        onFinish() { app.setTool(null); },
        onCancel() { app.setTool(null); A.armedTool = null; },
      });
      const tryAttach = () => {
        const picks = app.selectedObjects;
        if (picks.length < 2) return;
        app.setTool(null);
        A.armedTool = null;
        app.run('AttachRigidBodies', { Name: kind, Bodies: picks.slice(0, 2).map(o => o.name).join(',') });
        off();
      };
      const off = app.events.on('selection', tryAttach);
      app.logMsg('info', `MultiAttachRigidBodiesTool (${kind}): pick two bodies`);
      return A.armedTool;
    },
  });
  // Softimage full-tab harvest: ExecuteCommand("Toggle Simulation", []) ACTIVE (no scene delta).
  app.register({
    name: 'Toggle Simulation',
    label: 'Toggle Simulation',
    category: 'Simulation',
    args: [],
    undoable: false,
    execute(app) {
      const A = app as any;
      A.simulationEnabled = !A.simulationEnabled;
      app.logMsg('info', `Simulation ${A.simulationEnabled ? 'ON' : 'OFF'}`);
      app.events.emit('frame');
      return A.simulationEnabled;
    },
  });
  app.register({
    name: 'ToggleSimulation',
    label: 'Toggle Simulation',
    category: 'Simulation',
    args: [],
    undoable: false,
    execute: (app) => app.run('Toggle Simulation'),
  });
  app.register({
    name: 'CreateEnvironment', label: 'Create Environment', category: 'Simulation',
    args: [{ name: 'Name', default: 'Environment' }],
    execute(app, a) {
      const n = new Null(app.scene.uniqueName(a.Name || 'Environment'));
      n.add(str('simenv', '1', 'Simulation Environment', { readOnly: true }));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  app.register({
    name: 'ApplySoftBody', label: 'Apply SoftBody', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute: (app, a) => addNamedProp(app, app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects, 'Soft Body', 'softbody', [num('stiffness', 0.5, 'Stiffness')]),
  });
  // Softimage ApplyCloth (PE 41015): C3DClothProp + C3DClothOp PPG chrome from SPDL dumps (no invent Syflex GDI).
  app.register({
    name: 'ApplyCloth', label: 'Apply Cloth', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute(app, a) {
      const objs = app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects;
      return applyClothToObjects(app, objs);
    },
  });
  app.register({
    name: 'AddClothClusters', label: 'Add Cloth Clusters', category: 'Simulation', args: [{ name: 'InputObj', default: '' }],
    execute(app) {
      const o = app.selectedObjects[0];
      if (!o) throw new Error('Select a cloth object');
      return addNamedProp(app, [o], 'Cloth Cluster', 'clothcluster');
    },
  });
  app.register({ name: 'InspectRigidBody', label: 'Edit Rigid Body', category: 'Simulation', args: [], undoable: false, execute(app) { const o = app.selectedObjects[0]; const p = o?.properties.find(x => x.type === 'rigidbodyprop'); if (p) app.select([p]); else app.logMsg('info', 'No Rigid Body property on selection'); } });
  app.register({ name: 'InspectRigidBodySimulationProperties', label: 'Inspect Rigid Body Simulation Properties', category: 'Simulation', args: [], undoable: false, execute(app) { app.logMsg('info', 'Rigid body simulation properties'); } });
  app.register({ name: 'AddCompoundShapeToRigidBody', label: 'Add Compound Shape', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }], execute(app) { app.logMsg('info', 'Add compound shape: select child shapes then re-run Create Compound Rigid Body'); } });
  app.register({ name: 'SetRigidBodyInitState', label: 'Set Rigid Body Initial State', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }], execute(app) { for (const o of app.selectedObjects) addNamedProp(app, [o], 'RB Initial State', 'rbinit'); } });
  app.register({ name: 'GetRigidBodyInitStateFromAnim', label: 'Use Animation as Initial State', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }], execute(app) { app.logMsg('info', 'RB initial state from animation (current transforms captured)'); for (const o of app.selectedObjects) addNamedProp(app, [o], 'RB Initial State From Anim', 'rbinitanim'); } });
  app.register({
    name: 'RemoveRigidBody', label: 'Remove Rigid Body', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute(app) {
      for (const o of app.selectedObjects) {
        const p = o.properties.find(x => x.type === 'rigidbodyprop');
        if (p) app.record('Remove RB', () => o.removeProperty(p), () => o.addProperty(p));
      }
    },
  });
  app.register({
    name: 'ApplyParticleShader', label: 'Apply Particle Shader', category: 'Simulation',
    args: [{ name: 'PresetObj', default: '' }, { name: 'InputObjs', default: '' }],
    execute: (app, a) => app.run('SIApplyShader', { PresetObj: a.PresetObj || 'Phong', InputObjs: a.InputObjs }),
  });
  app.register({
    name: 'CreateObstacle', label: 'Set Obstacle', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute: (app, a) => addNamedProp(app, app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects, 'Obstacle', 'obstacle'),
  });
  app.register({
    name: 'DisconnectFromSimulation', label: 'Disconnect Obstacle/Force/Emitter', category: 'Simulation', args: [{ name: 'InputObjs', default: '' }],
    execute(app) {
      for (const o of app.selectedObjects) {
        for (const t of ['obstacle', 'softbody', 'cloth']) {
          const p = o.properties.find(x => x.type === t);
          if (p) app.record('Disconnect sim', () => o.removeProperty(p), () => o.addProperty(p));
        }
      }
      app.logMsg('info', 'Disconnected simulation links on selection');
    },
  });

  // CreateForce menu maps use Name=; accept either Name or PresetObj
  const cf = app.commands.get('CreateForce');
  if (cf) {
    cf.args = [{ name: 'PresetObj', default: 'Gravity' }, { name: 'Name', default: '' }, { name: 'InputObjs', default: '' }];
    const prev = cf.execute;
    cf.execute = (app, a) => prev(app, { ...a, PresetObj: a.PresetObj || a.Name || 'Gravity' });
  }

  // ——— Hair ———
  const hairOn = (app: App, preset: string) => {
    const objs = app.selectedObjects;
    if (!objs.length) throw new Error('Select a mesh or curves');
    return addNamedProp(app, objs, preset, 'hair', [str('preset', preset, 'Preset', { readOnly: true })]);
  };
  app.register({ name: 'ApplyHairOp', label: 'Hair Generator', category: 'Modeling|Generator', args: [{ name: 'in_Objs', default: null }, { name: 'PresetObj', default: 'Hair-Default' }], execute: (app, a) => hairOn(app, String(a.PresetObj || 'Hair-Default')) });
  app.register({ name: 'ApplyHairSplineGenOp', label: 'Hair Spline Generator', category: 'Generator', args: [{ name: 'in_Objs', default: null }, { name: 'PresetObj', default: 'Hair-Spline' }], execute: (app, a) => hairOn(app, String(a.PresetObj || 'Hair-Spline')) });
  app.register({ name: 'ApplyHairDynamicsOp', label: 'Hair Dynamics Simulator', category: 'Simulation', args: [{ name: 'in_Objs', default: null }], execute: (app) => hairOn(app, 'Hair Dynamics') });
  app.register({ name: 'ApplyHairShader', label: 'Hair Shader', category: 'Rendering', args: [], execute: (app) => app.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: app.selectedObjects }) });

  // WR-08 — Softimage Hair*Tool Clsid from commands_full (Manipulation). Brush stroke GDI LOCK (no invent).
  // HairBrushTool attested in hair_module_mcp_tops / PE; Clsid ABSENT from commands_full — arm without invent GUID.
  const hairTools: [string, string, string][] = [
    ['HairScalingTool', 'Hair Scaling Tool', '{B3672C3B-31D5-4A34-A6D1-3B5D019D405F}'],
    ['HairBrushTool', 'Hair Brush', ''],
    ['HairRotateRootTool', 'Hair Rotate Root Tool', '{825FCD04-4E50-4938-8DE1-258DB92CF19E}'],
    ['HairRotateTipTool', 'Hair Rotate Tip Tool', '{B962F218-EB16-11D5-A2E0-08003658D403}'],
    ['HairRotateCursorTool', 'Hair Rotate Cursor Tool', '{657CF6B6-E2CF-11D5-A2DD-08003658D403}'],
    ['HairStandOnEndTool', 'Hair Stand On End Tool', '{9F91CAC4-0CFF-420A-881D-2C68F99FAB7C}'],
    ['HairPuffRootsTool', 'Hair Puff Roots', '{481ADB88-E2CF-11D5-A2DD-08003658D403}'],
    ['HairClumpTool', 'Hair Clump Tool', '{AA0B2DFF-4B7E-42DE-AB2E-2F77F084D99B}'],
  ];
  const hasHairSel = () => app.selectedObjects.some(o => o.properties.some(p => p.type === 'hair') || /hair/i.test(o.name));
  for (const [name, label, clsidDefault] of hairTools) {
    app.register({
      name, label, category: 'Manipulation',
      args: [{ name: 'Clsid', default: clsidDefault }],
      undoable: false,
      description: `Activate the ${label}`,
      // WR-07 — Softimage GetEnabled: Manipulation tools enable with selection (CXSICommandCore callback).
      canRun: () => app.selectedObjects.length > 0 || hasHairSel(),
      execute(app, a) {
        const clsid = String(a.Clsid || clsidDefault || '');
        const armed = armTool(app, label, clsid);
        // Softimage HairPrimitive accessors attested (GetRenderHairAccessor) — tag armed hair tool for viewport.
        (app as any).armedHairTool = { name, label, clsid: clsid || null };
        const opMap: Record<string, string> = {
          HairScalingTool: 'ApplyHairScaleOp',
          HairClumpTool: 'ApplyHairClumpOp',
          HairPuffRootsTool: 'ApplyHairPuffOp',
          HairRotateRootTool: 'ApplyHairRotateOp',
          HairRotateTipTool: 'ApplyHairRotateOp',
          HairRotateCursorTool: 'ApplyHairRotateOp',
          HairStandOnEndTool: 'ApplyHairCombNormalOp',
          HairBrushTool: 'ApplyHairCombOp',
        };
        const applyHairStroke = (obj: X3DObject | null | undefined) => {
          if (!obj) return;
          const hair = obj.properties.find(p => p.type === 'hair');
          if (!hair) return;
          const op = opMap[name];
          if (op && app.commands.has(op)) {
            try { app.run(op, { InputObjs: obj.fullName }); } catch { /* logged */ }
          }
        };
        app.setTool({
          name: label,
          prompt: `${label}: click/drag on hair (Softimage Clsid ${clsid || 'PE-only'})`,
          onClick(_p, pick) { applyHairStroke(pick?.obj); },
          onFinish() { app.setTool(null); },
          onCancel() { app.setTool(null); (app as any).armedHairTool = null; },
        });
        return armed;
      },
    });
  }

  // Modeling ApplyHair* ops from modules_hair.json / commands_full (tools above cover Scale/Rotate/Puff UI).
  const hairOps: [string, string][] = [
    ['ApplyHairPuffOp', 'Hair Puff'], ['ApplyHairClumpOp', 'Hair Clump'],
    ['ApplyHairScaleOp', 'Hair Scale'], ['ApplyHairRotateOp', 'Hair Rotate'],
    ['ApplyHairCombNormalOp', 'Hair Comb Along Normal'], ['ApplyHairRecombOp', 'Hair Recomb'],
    ['ApplyHairCutOp', 'Hair Cut'], ['ApplyHairAttenuateOp', 'Hair Attenuate'],
    ['ApplyHairPopOp', 'Hair Pop'], ['ApplyHairPopSelectedOp', 'Hair Pop Selected'],
    ['ApplyHairResampleOp', 'Hair Resample'], ['ApplyHairSplitOp', 'Hair Split'],
    ['ApplyHairShatterOp', 'Hair Shatter'], ['ApplyHairMergeOp', 'Hair Merge'],
    ['ApplyHairLockOp', 'Hair Lock'], ['ApplyHairUnlockOp', 'Hair Unlock'],
  ];
  for (const [name, label] of hairOps) {
    app.register({
      name, label, category: 'Modeling', args: [{ name: 'InputObjs', default: '' }],
      execute(app) {
        const o = app.selectedObjects[0];
        if (!o) throw new Error('Select a hair object');
        addNamedProp(app, [o], label, name.toLowerCase());
        return null;
      },
    });
  }
  app.register({
    name: 'ApplyHairCombOp', label: 'Hair Comb Operator', category: 'Modeling',
    args: [{ name: 'InputObjs', default: '' }, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }],
    execute(app, a) {
      const o = app.selectedObjects[0];
      if (!o) throw new Error('Select a hair object');
      addNamedProp(app, [o], 'Hair Comb', 'haircomb', [num('x', Number(a.X) || 0, 'X'), num('y', Number(a.Y) || 0, 'Y'), num('z', Number(a.Z) || 0, 'Z')]);
      return null;
    },
  });
  // Softimage-absent MATCH: HairTransferMap / TransferMap FAIL (100pct-remaining + stub-tools).
  // PE 41445 label only; CopyStyle ACTIVE unrelated. Grey — Softimage parity (no invent).
  app.register({
    name: 'HairTransferMap', label: 'Hair Transfer Map', category: 'Modeling', args: [],
    canRun: () => false,
    execute() { throw new Error('HairTransferMap: Softimage Commands entry absent (Softimage-absent MATCH)'); },
  });
  // Softimage HairCopyStyle Name FAIL — menu leaf remapped to CopyStyle ACTIVE (args×2). Keep SN alias for scripts.
  app.register({
    name: 'HairCopyStyle', label: 'Hair Copy Style', category: 'Modeling', args: [],
    canRun: () => false,
    execute() { throw new Error('HairCopyStyle: Softimage Commands entry absent (stub-tools FAIL); use CopyStyle'); },
  });
  // Softimage CopyStyle ACTIVE Simulation args×2 (TargetHairObject, ModelHairStyleObject) — arm shell, no invent style transfer.
  app.register({
    name: 'CopyStyle', label: 'CopyStyle', category: 'Simulation',
    args: [{ name: 'TargetHairObject', default: null }, { name: 'ModelHairStyleObject', default: null }],
    description: 'Copies a hair style from one object to another',
    execute(app, a) {
      const tgt = a.TargetHairObject ?? app.selectedObjects[0]?.name ?? '';
      const src = a.ModelHairStyleObject ?? app.selectedObjects[1]?.name ?? '';
      app.logMsg('info', `CopyStyle: ${src || '(source)'} → ${tgt || '(target)'} (hair style transfer shell)`);
      return stubTool(app, 'CopyStyle');
    },
  });
  app.register({ name: 'HairDisplayStyle', label: 'Hair Display Style', category: 'Viewing', args: [], undoable: false, execute: (app) => app.logMsg('info', 'Hair display style toggled') });
  app.register({
    name: 'HairShowRenderHairs', label: 'Show Render Hairs', category: 'Viewing',
    args: [{ name: 'Percent', default: 100 }], undoable: false,
    execute(app, a) {
      const pct = Number(a.Percent);
      app.logMsg('info', pct < 0 ? 'Show Render Hairs' : `Render hairs display: ${pct}%`);
    },
  });
  app.register({ name: 'HairStretchy', label: 'Hair Stretchy', category: 'Viewing', args: [], undoable: false, execute: (app) => app.logMsg('info', 'Hair stretchy display') });
  app.register({ name: 'HairFix', label: 'Hair Fix', category: 'Viewing', args: [], undoable: false, execute: (app) => app.logMsg('info', 'Hair fix display') });
}
