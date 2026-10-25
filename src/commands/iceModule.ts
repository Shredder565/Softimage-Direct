// Softimage ICE module toolbar / view commands — dump-backed (commands_full.json + PE MENU 303).
// Runtime Anchor-to-Delete particle/CrowdFX compounds stay LOCK (no invent).
import { App } from '../core/commands';
import { Property } from '../core/scene';
import { bool, str } from '../core/params';
import iceTops from '../data/si/ice_module_mcp_tops.json';
import iceChrome from '../data/si/ice_view_chrome.json';

const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

const attrOn = (app: App, name: string, extra: Parameters<typeof Property.prototype.add>[0][] = []) => {
  const o = app.selectedObjects[0];
  if (!o) throw new Error('Select an object');
  const p = new Property(name, 'iceattr', [bool('enabled', true, 'Enabled'), str('attribute', name, 'Attribute', { readOnly: true }), ...extra]);
  app.record(name, () => o.addProperty(p), () => o.removeProperty(p));
  app.select([p]);
  return p;
};

/** Softimage ICE module switcher + attested toolbar / tree-open commands. */
export function registerIceModuleCommands(app: App) {
  // commands_full: OpenICETreeView → OpenICETreeProc (Property|Edit)
  app.register({
    name: 'OpenICETreeView',
    label: 'Open ICE Tree View',
    category: 'Property|Edit',
    args: [],
    undoable: false,
    execute() { openView('ICE Tree'); },
  });

  // Softimage CreateSimulatedICETree — thin shell onto ApplyICEOp (no invent compounds).
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

  // Category ICE scripting names from commands_full / si_module_commands_gap.json
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

  // Ensure SwitchToolbar Target=4 (ICE) exists even if Render OM register order changes.
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

/** Audit for __uiAudit / compare_ice_module — dump-backed ICE MCP tops + view chrome. */
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
  const tree = chrome.views['ICE Tree'];
  const hasOpen = app.commands.has('OpenICETreeView');
  const hasSim = app.commands.has('CreateSimulatedICETree');
  const iceCmds = [
    'OpenICETreeView', 'CreateSimulatedICETree', 'AddStaticICEAttribute', 'RemoveStaticICEAttribute',
    'RenameStaticICEAttribute', 'SetStaticICEAttributeType', 'ToggleICEAttributeAlwaysEvaluated', 'SwitchToolbar',
  ].filter(n => app.commands.has(n));
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
    commandsWired: iceCmds,
    openICETreeView: hasOpen,
    createSimulatedICETree: hasSim,
    currentModule: app.module,
  };
}
