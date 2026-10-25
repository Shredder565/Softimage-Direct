// Softimage ICE module — PE MENU 303 shell + Desktop tour HIGH graph cmds / prefs attestation.
// Runtime Anchor-to-Delete particle/CrowdFX compounds stay LOCK (no invent).
import { App } from '../core/commands';
import { Property, X3DObject } from '../core/scene';
import { bool, str } from '../core/params';
import { ICETreeOperator, ICE_NODES, ICE_PRESETS, buildPreset } from '../core/ice';
import iceTops from '../data/si/ice_module_mcp_tops.json';
import iceChrome from '../data/si/ice_view_chrome.json';
import iceCmdEn from '../data/si/ice_desktop_command_enabled.json';
import icePrefs from '../data/si/ice_desktop_prefs.json';

const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

const attrOn = (app: App, name: string, extra: Parameters<typeof Property.prototype.add>[0][] = []) => {
  const o = app.selectedObjects[0];
  if (!o) throw new Error('Select an object');
  const p = new Property(name, 'iceattr', [bool('enabled', true, 'Enabled'), str('attribute', name, 'Attribute', { readOnly: true }), ...extra]);
  app.record(name, () => o.addProperty(p), () => o.removeProperty(p));
  app.select([p]);
  return p;
};

const treeOn = (o: X3DObject | undefined | null): ICETreeOperator | null => {
  if (!o?.primitive) return null;
  return (o.primitive.operators.slice().reverse().find(op => op instanceof ICETreeOperator) as ICETreeOperator) ?? null;
};

const resolveTree = (app: App, container?: unknown): ICETreeOperator | null => {
  if (container instanceof ICETreeOperator) return container;
  const sel = app.selection[app.selection.length - 1] as any;
  if (sel instanceof ICETreeOperator) return sel;
  for (const o of app.selectedObjects) {
    const t = treeOn(o);
    if (t) return t;
  }
  return null;
};

const ensureTree = (app: App, target?: unknown): ICETreeOperator => {
  const existing = resolveTree(app, target);
  if (existing) return existing;
  const o = (typeof target === 'string' && target ? app.targets(target)[0] : undefined)
    ?? app.selectedObjects.find(x => x.primitive?.mesh() || x.type === 'pointcloud')
    ?? app.selectedObjects[0];
  if (!o) throw new Error('Select an object for ICE Tree');
  return app.run('ApplyICEOp', { File: '', Target: o.fullName }) as ICETreeOperator;
};

const presetBase = (file: string) => String(file || '').replace(/^.*[\\/]/, '').replace(/\.(Preset|xsicompound|xsice)$/i, '').trim();

const resolveNodeType = (preset: string): { type: string; compound?: string } => {
  const base = presetBase(preset);
  if (!base) return { type: 'Get Data' };
  if (ICE_NODES[base]) return { type: base };
  const hit = Object.keys(ICE_NODES).find(k => k.toLowerCase() === base.toLowerCase());
  if (hit) return { type: hit };
  if (ICE_PRESETS.includes(base) || ICE_PRESETS.some(p => p.toLowerCase() === base.toLowerCase())) {
    const p = ICE_PRESETS.find(x => x.toLowerCase() === base.toLowerCase()) ?? base;
    return { type: 'Get Data', compound: p };
  }
  // Softimage compound path unknown in AfterImage catalog — Comment placeholder (no invent compound graph).
  return { type: 'Comment' };
};

const emptyPointCloud = (app: App) =>
  app.run('GetPrim', { PresetObj: 'EmptyPointCloud', Name: '' }) as X3DObject;

/** Softimage ICE module switcher + Desktop tour HIGH toolbar / graph commands. */
export function registerIceModuleCommands(app: App) {
  app.register({
    name: 'OpenICETreeView',
    label: 'Open ICE Tree View',
    category: 'Property|Edit',
    args: [],
    undoable: false,
    execute() { openView('ICE Tree'); },
  });

  app.register({
    name: 'CreateSimulatedICETree',
    label: 'Create Simulated ICETree',
    category: 'Edit',
    args: [
      { name: 'ConnectionSet', default: null },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
      { name: 'ImmediateMode', default: ':siPersistentOperation:siOperationMode' },
    ],
    execute(app, a) {
      return app.run('ApplyICEOp', { File: '', Target: a.ConnectionSet ?? '' });
    },
  });

  // Softimage ApplyICETemplate — same ApplyICEOp File path (commands_full).
  app.register({
    name: 'ApplyICETemplate',
    label: 'Apply ICE Template',
    category: 'Edit',
    args: [
      { name: 'File', default: '' },
      { name: 'Target', default: null },
      { name: 'Inputs', default: '' },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
    ],
    execute: (app, a) => app.run('ApplyICEOp', { File: a.File || '', Target: a.Target, Input: a.Inputs, ConnectType: a.ConnectType }),
  });

  app.register({
    name: 'SIApplyICEOp',
    label: 'Low level Apply ICE Operator',
    category: 'Edit',
    args: [
      { name: 'File', default: '' },
      { name: 'Target', default: null },
      { name: 'Input', default: '' },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
      { name: 'Mode', default: 4 },
    ],
    execute: (app, a) => app.run('ApplyICEOp', { File: a.File || '', Target: a.Target, Input: a.Input, ConnectType: a.ConnectType }),
  });

  app.register({
    name: 'AddICENode',
    label: 'Add ICE Node',
    category: 'Edit',
    args: [{ name: 'PresetObj', default: null }, { name: 'Container', default: null }],
    execute(app, a) {
      const t = ensureTree(app, a.Container);
      const preset = String(a.PresetObj || 'Get Data');
      const r = resolveNodeType(preset);
      if (r.compound) { buildPreset(t, r.compound); app.events.emit('scene'); return t; }
      const n = t.addNode(r.type, 40 + Math.random() * 80, 40 + Math.random() * 80);
      if (r.type === 'Comment' && preset) n.params.set('text', presetBase(preset) || preset);
      app.events.emit('scene');
      return n;
    },
  });

  app.register({
    name: 'AddICECompoundNode',
    label: 'Add ICE Compound Node',
    category: 'Edit',
    args: [{ name: 'File', default: '' }, { name: 'Container', default: null }],
    execute(app, a) {
      const t = ensureTree(app, a.Container);
      const file = String(a.File || '');
      const r = resolveNodeType(file);
      if (r.compound) { buildPreset(t, r.compound); app.events.emit('scene'); return t; }
      // Softimage compound file not in AfterImage factory list — Comment marker only (no invent graph).
      const n = t.addNode('Comment', 60 + Math.random() * 80, 60 + Math.random() * 80);
      n.params.set('text', presetBase(file) || 'ICE Compound');
      app.events.emit('scene');
      return n;
    },
  });

  app.register({
    name: 'CreateICECompoundNode',
    label: 'Create ICE Compound Node',
    category: 'Simulation',
    args: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }],
    execute(app, a) {
      const t = resolveTree(app, a.InputObj) ?? ensureTree(app);
      const name = String(a.Name || 'Compound');
      const n = t.addNode('Comment', 80, 80);
      n.params.set('text', `Compound:${name}`);
      app.logMsg('info', `CreateICECompoundNode → ${name} (shell; export/explode LOCK beyond Comment marker)`);
      app.events.emit('scene');
      return n;
    },
  });

  app.register({
    name: 'ConnectICENodes',
    label: 'Connect ICE Nodes',
    category: 'Edit',
    args: [{ name: 'InputPort', default: null }, { name: 'OutputPort', default: null }],
    execute(app, a) {
      const t = resolveTree(app);
      if (!t) throw new Error('ConnectICENodes: no ICE Tree');
      // Softimage passes port objects; AfterImage accepts {node,port} or "id.port" strings.
      const parse = (p: any): { node: number; port: string } | null => {
        if (!p) return null;
        if (typeof p === 'object' && p.node != null && p.port) return { node: Number(p.node), port: String(p.port) };
        const s = String(p);
        const m = s.match(/(\d+)\s*[.:]\s*(.+)$/);
        if (m) return { node: Number(m[1]), port: m[2] };
        return null;
      };
      const out = parse(a.OutputPort);
      const inp = parse(a.InputPort);
      if (!out || !inp) {
        app.logMsg('info', 'ConnectICENodes: need OutputPort/InputPort as {node,port} or "id.port" (Softimage port objects LOCK)');
        return null;
      }
      t.connect(out.node, out.port, inp.node, inp.port);
      app.events.emit('scene');
      return t;
    },
  });

  app.register({
    name: 'ExplodeICECompoundNode',
    label: 'Explode ICE Compound Node',
    category: 'Simulation',
    args: [{ name: 'InputObj', default: null }, { name: 'OutputObjs', default: null }],
    undoable: false,
    execute(app) {
      app.logMsg('info', 'ExplodeICECompoundNode: Softimage compound explode (shell — nested compound binary LOCK)');
      return null;
    },
  });

  app.register({
    name: 'ExportICECompoundNode',
    label: 'Export ICE Compound',
    category: 'Edit',
    args: [
      { name: 'Compound', default: null },
      { name: 'FullPath', default: '' },
      { name: 'Directory', default: '' },
      { name: 'Name', default: '' },
      { name: 'Version', default: '' },
      { name: 'Private', default: false },
      { name: 'ForceEmbedded', default: false },
      { name: 'Output', default: '' },
    ],
    undoable: false,
    execute(app, a) {
      const t = resolveTree(app, a.Compound);
      if (!t) throw new Error('ExportICECompoundNode: no ICE Tree');
      const blob = JSON.stringify(t.toJSON(), null, 1);
      const name = String(a.Name || t.name || 'ICECompound');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([blob], { type: 'application/json' }));
      link.download = `${name}.icetree.json`;
      link.click();
      app.logMsg('info', `ExportICECompoundNode → ${name}.icetree.json (JSON shell; Softimage .xsicompound binary LOCK)`);
      return t;
    },
  });

  const genCloud = (app: App, file: string, label: string) => {
    const cloud = emptyPointCloud(app);
    const op = app.run('ApplyICEOp', { File: file || '', Target: cloud.fullName });
    app.logMsg('info', `${label} → ${cloud.name}`);
    return { cloud, op };
  };

  app.register({
    name: 'GeneratePointCloudWithICETemplate',
    label: 'Generate Point Cloud with ICE Template',
    category: 'Edit',
    args: [
      { name: 'File', default: '' },
      { name: 'Inputs', default: '' },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
    ],
    execute: (app, a) => genCloud(app, String(a.File || ''), 'GeneratePointCloudWithICETemplate'),
  });

  app.register({
    name: 'GeneratePointCloudWithICETerminal',
    label: 'Generate Point Cloud With ICE Terminal',
    category: 'Edit',
    args: [
      { name: 'File', default: '' },
      { name: 'Inputs', default: '' },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
    ],
    execute: (app, a) => genCloud(app, String(a.File || ''), 'GeneratePointCloudWithICETerminal'),
  });

  app.register({
    name: 'AddStaticICEAttribute',
    label: 'Add Static ICE Attribute',
    category: 'ICE',
    args: [
      { name: 'Object', default: null },
      { name: 'AttributeName', default: '' },
      { name: 'AttributeType', default: ':siComponentDataTypeFloat:siComponentDataType' },
      { name: 'AttributeContext', default: ':siComponentDataContextSingleton:siComponentDataContext' },
      { name: 'AttributeStructure', default: ':siComponentDataStructureSingle:siComponentDataStructure' },
    ],
    execute(app, a) {
      const n = String(a.AttributeName || 'StaticICEAttribute');
      return attrOn(app, n, [str('attr_type', String(a.AttributeType || ''), 'Type', { readOnly: true })]);
    },
  });
  app.register({
    name: 'RemoveStaticICEAttribute',
    label: 'Remove Static ICE Attribute',
    category: 'ICE',
    args: [{ name: 'Object', default: null }, { name: 'AttributeName', default: '' }],
    execute(app, a) {
      const want = String(a.AttributeName || '');
      for (const o of app.selectedObjects) {
        const p = o.properties.find(x => x.type === 'iceattr' && (!want || x.name === want || x.val('attribute') === want));
        if (p) app.record('Remove ICE attr', () => o.removeProperty(p), () => o.addProperty(p));
      }
      return null;
    },
  });
  app.register({
    name: 'RenameStaticICEAttribute',
    label: 'Rename Static ICE Attribute',
    category: 'ICE',
    args: [{ name: 'Object', default: null }, { name: 'AttributeName', default: '' }, { name: 'NewName', default: '' }],
    execute(app, a) {
      const from = String(a.AttributeName || '');
      const to = String(a.NewName || '');
      if (!to) throw new Error('NewName required');
      for (const o of app.selectedObjects) {
        const p = o.properties.find(x => x.type === 'iceattr' && (!from || x.name === from || x.val('attribute') === from));
        if (p) { p.name = to; app.setParam(p.get('attribute')!, to); }
      }
      app.events.emit('scene');
      return null;
    },
  });
  app.register({
    name: 'SetStaticICEAttributeType',
    label: 'Set Static ICE Attribute Type',
    category: 'ICE',
    args: [
      { name: 'Object', default: null },
      { name: 'AttributeName', default: '' },
      { name: 'AttributeType', default: ':siComponentDataTypeNone:siComponentDataType' },
      { name: 'AttributeContext', default: ':siComponentDataContextNone:siComponentDataContext' },
      { name: 'AttributeStructure', default: ':siComponentDataStructureNone:siComponentDataStructure' },
    ],
    execute(app, a) {
      const want = String(a.AttributeName || '');
      for (const o of app.selectedObjects) {
        const p = o.properties.find(x => x.type === 'iceattr' && (!want || x.name === want || x.val('attribute') === want));
        if (p?.get('attr_type')) app.setParam(p.get('attr_type')!, String(a.AttributeType || ''));
        else if (p) p.add(str('attr_type', String(a.AttributeType || ''), 'Type', { readOnly: true }));
      }
      return null;
    },
  });
  app.register({
    name: 'ToggleICEAttributeAlwaysEvaluated',
    label: 'Toggle ICE Attribute Always Evaluated',
    category: 'ICE',
    args: [{ name: 'Object', default: null }, { name: 'AttributeName', default: '' }],
    execute(app, a) {
      const want = String(a.AttributeName || '');
      for (const o of app.selectedObjects) {
        const p = o.properties.find(x => x.type === 'iceattr' && (!want || x.name === want || x.val('attribute') === want));
        if (!p) continue;
        let q = p.get('always_eval');
        if (!q) { p.add(bool('always_eval', true, 'Always Evaluated')); q = p.get('always_eval')!; }
        else app.setParam(q, !q.value);
      }
      app.logMsg('info', 'Toggle ICE Attribute Always Evaluated');
      return null;
    },
  });

  if (!app.commands.has('SwitchToolbar')) {
    app.register({
      name: 'SwitchToolbar',
      label: 'Switch to ICE Toolbar',
      category: 'Toolbar',
      args: [{ name: 'Target', default: 4 }],
      undoable: false,
      execute(app, a) {
        const map: Record<number, App['module']> = { 1: 'Model', 2: 'Animate', 3: 'Render', 4: 'ICE', 5: 'Simulate', 6: 'Hair' };
        const mod = map[Number(a.Target)] ?? 'ICE';
        app.module = mod;
        app.events.emit('module');
        return mod;
      },
    });
  }
}

/** Audit for __uiAudit / compare_ice_module — dump-backed ICE MCP tops + tour HIGH. */
export function iceModuleAudit(app: App): Record<string, unknown> {
  const tops = iceTops as typeof iceTops & {
    tops: string[];
    buttons: Record<string, string[]>;
    switch_toolbar_target: number;
    runtime_anchors: { status: string };
  };
  const chrome = iceChrome as typeof iceChrome & {
    views: Record<string, { defaultsize: number[]; category: string }>;
  };
  const en = (iceCmdEn as { enabled_by_scriptingname: Record<string, boolean> }).enabled_by_scriptingname;
  const prefsDump = icePrefs as {
    softimage: string;
    'preferences.icetree': { param_count: number; params: Record<string, unknown>; propset: string };
    'preferences.ICEOperators': { param_count: number; params: Record<string, unknown>; propset: string };
  };
  const tree = chrome.views['ICE Tree'];
  const high = Object.keys(en);
  const wired = high.filter(n => app.commands.has(n));
  const prefSets = (window as any).__prefSets as Map<string, { params: { name: string; value: unknown }[] }> | undefined;
  const iceTreeSet = prefSets?.get('C3DPrefsICETree');
  const iceOpsSet = prefSets?.get('C3DPrefsICEOperators');
  const treeParams = iceTreeSet ? Object.fromEntries(iceTreeSet.params.map(p => [p.name, p.value])) : null;
  const opsParams = iceOpsSet ? Object.fromEntries(iceOpsSet.params.map(p => [p.name, p.value])) : null;
  return {
    softimage: tops.softimage,
    menuId: tops.menu_id,
    moduleSelect: tops.module_select,
    tops: tops.tops,
    buttons: tops.buttons,
    switchToolbarTarget: tops.switch_toolbar_target,
    runtimeAnchors: tops.runtime_anchors?.status ?? 'LOCK',
    iceTreeDefaultSize: tree?.defaultsize,
    iceTreeCategory: tree?.category,
    commandsWired: wired,
    highEnabled: en,
    highWiredCount: wired.length,
    highExpectedCount: high.length,
    openICETreeView: app.commands.has('OpenICETreeView'),
    createSimulatedICETree: app.commands.has('CreateSimulatedICETree'),
    applyICETemplate: app.commands.has('ApplyICETemplate'),
    addICENode: app.commands.has('AddICENode'),
    connectICENodes: app.commands.has('ConnectICENodes'),
    generatePointCloudTemplate: app.commands.has('GeneratePointCloudWithICETemplate'),
    generatePointCloudTerminal: app.commands.has('GeneratePointCloudWithICETerminal'),
    prefs: {
      softimage: prefsDump.softimage,
      icetreeCount: prefsDump['preferences.icetree'].param_count,
      iceOperatorsCount: prefsDump['preferences.ICEOperators'].param_count,
      icetreePropset: prefsDump['preferences.icetree'].propset,
      iceOperatorsPropset: prefsDump['preferences.ICEOperators'].propset,
      icetreeLive: treeParams,
      iceOperatorsLive: opsParams,
      icetreeMatch: treeParams
        ? Object.keys(prefsDump['preferences.icetree'].params).every(k => k in treeParams)
        : false,
      iceOperatorsMatch: opsParams
        ? Object.keys(prefsDump['preferences.ICEOperators'].params).every(k => k in opsParams)
        : false,
    },
    currentModule: app.module,
  };
}
