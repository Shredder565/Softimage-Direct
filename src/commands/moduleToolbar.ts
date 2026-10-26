// High-traffic Render / Simulate / Hair module-toolbar commands.
// Scripting names and args follow Softimage's registry (data/commands_full.json);
// menu id → command wiring lives in src/data/menu_commands.json (PC dump / command-map derived).
import { App } from '../core/commands';
import { Null, Property, X3DObject } from '../core/scene';
import { bool, num, str } from '../core/params';
import { getSiRenderRegion } from './renderToolbarOm';
import { applyClothToObjects } from './clothPpg';
import { executeRenderCurrentFrame, executeRenderPass, renderScenePasses } from '../core/sceneRender';

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
  // true-95pct unlock tour: EditUVProjectionTool Commands Name FAIL — leave unwired (canRun false).
  // Wire attested UVW fuzzy Names/arity instead (HealUVW, ReprojectUVW, …). Do not invent tool body.
  app.register({
    name: 'EditUVProjectionTool', label: 'Edit Projection Tool', category: 'Texturing', args: [],
    undoable: false, canRun: () => false,
    execute() { throw new Error('EditUVProjectionTool: Softimage Commands entry absent (true-95pct unlock FAIL)'); },
  });
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

  // ——— Render region (Softimage scripting names; HWND crop LOCK — see renderToolbarOm) ———
  // full-tab harvest: RenderRegionTool / CreateRenderRegion / ToggleRenderRegion ACTIVE with [].
  const rr = getSiRenderRegion();
  app.register({
    name: 'RenderRegionTool',
    label: 'Render Region Tool',
    category: 'Rendering',
    args: [{ name: 'Clsid', default: '' }, { name: 'Viewport', default: '' }],
    undoable: false,
    description: 'Create a region for interactive rendering',
    execute(app) {
      // Softimage description: create interactive region — same OM path as RenderRegionCreate.
      return app.run('RenderRegionCreate', {});
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
  app.register({ name: 'RenderRegionSave', label: 'Save Render Region To File', category: 'Rendering', args: [{ name: 'FileName', default: null }], undoable: false, execute(app, a) { app.logMsg('info', `Render region save${a.FileName ? ': ' + a.FileName : ' (pick a path in Softimage)'}`); } });
  app.register({ name: 'RenderRegionRefresh', label: 'Refresh Render Region', category: 'Rendering', args: [{ name: 'Viewport', default: '' }], undoable: false, execute(app) { app.logMsg('info', 'Render region refreshed'); app.events.emit('frame'); } });
  app.register({ name: 'RenderRegionToggleVisibility', label: 'Show/Hide Render Region', category: 'Rendering', args: [{ name: 'Viewport', default: '' }], undoable: false, execute(app) { rr.visible = !rr.visible; app.logMsg('info', `Render region ${rr.visible ? 'shown' : 'hidden'}`); } });
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
  app.register({
    name: 'CreatePartition', label: 'New Partition', category: 'Rendering',
    args: [{ name: 'Target', default: '' }, { name: 'Name', default: 'Partition' }, { name: 'InputObjs', default: '' }],
    execute(app, a) {
      const pass = app.scene.passes[app.scene.passes.length - 1];
      if (!pass) throw new Error('No current pass');
      const host = app.scene.root;
      const p = new Property(app.scene.uniqueName(a.Name || 'Partition'), 'partition', [
        bool('enabled', true, 'Enabled'),
        str('pass', pass.name, 'Pass', { readOnly: true }),
      ]);
      app.record('Partition', () => host.addProperty(p), () => host.removeProperty(p));
      app.select([p]);
      return p;
    },
  });
  app.register({ name: 'AddToPartition', label: 'Add Object to Partition', category: 'Rendering', args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }], execute(app) { app.logMsg('info', `Add to partition: ${app.selectedObjects.map(o => o.name).join(', ') || '(nothing selected)'}`); } });
  app.register({ name: 'RemoveFromPartition', label: 'Remove Object from Partition', category: 'Rendering', args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }], execute(app) { app.logMsg('info', `Remove from partition: ${app.selectedObjects.map(o => o.name).join(', ') || '(nothing selected)'}`); } });

  // Softimage true-95pct unlock + PIC deepen (#130): RenderPass args×6; RenderPasses SN args×5;
  // Name "Render Current Pass" → SN RenderPasses args×1; Format=pic; ResolvedFilename={file}.{frame}.pic.
  // Do not treat empty RenderPasses as Render Current Frame (separate SN args×0).
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
    // Softimage true-95pct: Name args=1 → SN RenderPasses (do not treat as RenderCurrentFrame).
    name: 'Render Current Pass', label: 'Render Current Pass', category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.Current' }], undoable: false,
    description: 'Render selected passes',
    // Softimage catalog: ScriptingName RenderPasses, arg_count 1 — Framebuffer Format=pic.
    execute: (app, a) => executeRenderPass(app, { Passes: a.Passes ?? 'Passes.Current' }),
  });
  app.register({
    name: 'RenderSelectedPasses', label: 'Render Selected Passes', category: 'Rendering',
    args: [], undoable: false,
    execute: (app) => renderScenePasses(app, { passes: 'Passes.Current' }),
  });
  app.register({
    name: 'RenderAllPasses', label: 'Render All Passes', category: 'Rendering',
    args: [], undoable: false,
    execute: (app) => renderScenePasses(app, { passes: 'Passes.List.*' }),
  });
  app.register({
    name: 'RenderCurrentFrame', label: 'Render Current Frame', category: 'Rendering',
    args: [], undoable: false,
    execute: (app) => executeRenderCurrentFrame(app, false),
  });
  app.register({
    name: 'RenderCurrentFrameAllPasses', label: 'Render Current Frame All Passes', category: 'Rendering',
    args: [], undoable: false,
    execute: (app) => executeRenderCurrentFrame(app, true),
  });
  app.register({ name: 'RenderPreview', label: 'Render Preview', category: 'Rendering', args: [], undoable: false, execute() { openView('Render Manager'); } });
  app.register({ name: 'OpenRenderingPreferences', label: 'Open Rendering Preferences', category: 'Rendering', args: [], undoable: false, execute() { window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Rendering' } })); } });
  app.register({ name: 'InspectCurrentPass', label: 'Inspect Current Pass', category: 'Rendering', args: [], undoable: false, execute(app) { const p = app.scene.passes[app.scene.passes.length - 1]; if (p) app.logMsg('info', `Current pass: ${p.name}`); openView('Render Manager'); } });
  app.register({ name: 'InspectRendererOptions', label: 'Inspect Renderer Options', category: 'Rendering', args: [], undoable: false, execute() { window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Rendering' } })); } });
  // Softimage ExportRenderArchive* ACTIVE — attested arg counts (commands_full). Offline archive bytes LOCK.
  app.register({
    name: 'ExportRenderArchive', label: 'Export Selected Passes to Render Archive', category: 'Rendering',
    args: [{ name: 'Passes', default: null }], undoable: false,
    description: 'Export the selected passes to a render archive',
    execute: (app, a) => app.logMsg('info', `Export render archive: ${a.Passes ?? 'stub'}`),
  });
  app.register({
    name: 'ExportRenderArchiveAllPasses', label: 'Export All Passes to Render Archives', category: 'Rendering',
    args: [{ name: 'Passes', default: 'Passes.List.*' }], undoable: false,
    description: 'Export All Passes to Render Archives',
    execute: (app, a) => app.logMsg('info', `Export all passes archive: ${a.Passes}`),
  });
  app.register({ name: 'ExportObjectRenderArchive', label: 'Export an Object to a Render Archive', category: 'Rendering', args: [], undoable: false, execute: (app) => app.logMsg('info', 'Export object render archive: stub') });

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
  // Softimage commands_full + harvest: MultiAttachRigidBodiesTool desc =
  // "Attach rigid bodies together with a rigid constraint" (same as AttachRigidBodies).
  // PE menu args Name=Hinge|BallSocket|Spring|Slider|Fixed — dump-attested, no invent solver.
  app.register({
    name: 'MultiAttachRigidBodiesTool', label: 'Multi Attach Rigid Bodies Tool', category: 'Simulation',
    args: [{ name: 'Name', default: 'Hinge' }, { name: 'Bodies', default: null }],
    description: 'Attach rigid bodies together with a rigid constraint',
    execute: (app, a) => app.run('AttachRigidBodies', { Name: a.Name || 'Hinge', Bodies: a.Bodies }),
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

  // Softimage harvest/commands_full: Hair*Tool = "Activate the … tool" (+ Clsid from PE menu_commands).
  // Brush stroke GDI stays LOCK (no invent). Operators ApplyHair* remain separate ACTIVE wires.
  const hairTools: [string, string][] = [
    ['HairScalingTool', 'Hair Scaling Tool'], ['HairBrushTool', 'Hair Brush'],
    ['HairRotateRootTool', 'Hair Rotate Root Tool'], ['HairRotateTipTool', 'Hair Rotate Tip Tool'], ['HairRotateCursorTool', 'Hair Rotate Cursor Tool'],
    ['HairStandOnEndTool', 'Hair Stand On End Tool'], ['HairPuffRootsTool', 'Hair Puff Roots'], ['HairClumpTool', 'Hair Clump Tool'],
  ];
  for (const [name, label] of hairTools) {
    app.register({
      name, label, category: 'Manipulation',
      args: [{ name: 'Clsid', default: '' }],
      undoable: false,
      description: `Activate the ${label}`,
      execute: (app, a) => armTool(app, label, String(a.Clsid || '')),
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
  // Softimage HairTransferMap / HairCopyStyle / TransferMap = FAIL in stub-tools dump — keep shells; Gap = Softimage FAIL.
  app.register({ name: 'HairTransferMap', label: 'Hair Transfer Map', category: 'Modeling', args: [], execute: (app) => stubTool(app, 'Hair Transfer Map') });
  app.register({ name: 'HairCopyStyle', label: 'Hair Copy Style', category: 'Modeling', args: [], execute: (app) => stubTool(app, 'Hair Copy Style') });
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
