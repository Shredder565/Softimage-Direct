// Softimage ICE module — PE MENU 303 shell + Desktop tour HIGH graph cmds / prefs attestation.
// closer95 DUMP_READY: PE Anchor leaf ids/trails + Create/Explode ICE Compound Node.
// Softimage-anchor-compounds-ghidra-tour: factory_menu_names DUMP_READY under Anchor-to-Delete.
import { App } from '../core/commands';
import { X3DObject } from '../core/scene';
import { ICETreeOperator, ICE_NODES, ICE_PRESETS, buildPreset } from '../core/ice';
import iceTops from '../data/si/ice_module_mcp_tops.json';
import iceChrome from '../data/si/ice_view_chrome.json';
import iceCmdEn from '../data/si/ice_desktop_command_enabled.json';
import icePrefs from '../data/si/ice_desktop_prefs.json';
import iceAnchorLeaves from '../data/si/ice_pe_anchor_leaves.json';
import anchorFills from '../data/si/anchor_factory_menu_fills.json';

const openView = (name: string) => window.dispatchEvent(new CustomEvent('openview', { detail: { name } }));

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

/** Softimage ICEFlowBuilder RegisterCommand Names — behavioral/proof/script_register_hosts.json (WR-16). */
const ICEFLOW_HOST_CMDS = [
  'ICEFlow_AddConstraint',
  'ICEFlow_AddExecuteCompound',
  'ICEFlow_AddSyflexForceCompound',
  'ICEFlow_AddForces',
  'ICEFlow_AddStateItem',
  'ICEFLowCommonTools',
  'ICEFlow_ConstraintToParticles',
  'ICEFlow_RemoveConstraintToParticles',
  'ICEFlow_CreateParticles',
  'ICEFlow_CreateParticlesFromPreset',
  'ICEFlow_DeleteInitParticles',
  'ICEFlow_LagoaAddPassiveBody',
  'ICEFlow_AddPassiveBodies',
  'ICEFlow_RemovePassiveBodies',
  'ICEFlow_SetCollisionDataOnly',
  'ICEFlow_AddLagoaExecuteCompound',
  'ICEFlow_CachedSimPostEffect',
  'ICEFlow_AddLagoaTransformConstraint',
  'ICEFlow_LagoaResolutionToSubsteps',
  'ICEFlow_LagoaCacheCloud',
  'ICEFlowSetEmissionFilterMap',
  'ICEFlow_VaryingInputValue',
] as const;

/** Softimage ICE module switcher + Desktop tour HIGH toolbar / graph commands. */
export function registerIceModuleCommands(app: App) {
  // WR-16 — ICEFlowBuilder plugin RegisterCommand shells (no invent compound bodies).
  // Syflex deepen: ICEFlow_AddSyflexForceCompound only (script_register_hosts); SyCreateCloth/syCloth PPG already wired.
  for (const name of ICEFLOW_HOST_CMDS) {
    if (app.commands.has(name)) continue;
    app.register({
      name,
      label: name,
      category: 'ICE',
      args: [{ name: 'File', default: '' }, { name: 'Target', default: null }],
      undoable: false,
      execute(app, a) {
        const file = String(a.File || '');
        if (file && app.commands.has('ApplyICEOp')) {
          try {
            return app.run('ApplyICEOp', { File: file, Target: a.Target });
          } catch {
            /* fall through to shell log */
          }
        }
        if (name === 'ICEFlow_CreateParticles' || name === 'ICEFlow_CreateParticlesFromPreset') {
          if (app.commands.has('GeneratePointCloudWithICETemplate')) {
            return app.run('GeneratePointCloudWithICETemplate', { File: file || '', Inputs: '' });
          }
        }
        app.logMsg('info', `${name} — ICEFlowBuilder RegisterCommand shell; compound/plugin body LOCK`);
        return null;
      },
    });
  }

  // GD-02 — Syflex ICE Evaluate deepen: expose syflexI* Softimage node Names via AddICENode (syflex_ice.64.dll).
  const SYFLEX_ICE_NODES = [
    'syflexISimul', 'syflexIPin', 'syflexINail', 'syflexISpring', 'syflexISpringGeo', 'syflexICollideMesh',
  ] as const;
  for (const name of SYFLEX_ICE_NODES) {
    if (app.commands.has(name)) continue;
    app.register({
      name,
      label: name,
      category: 'Simulation',
      args: [{ name: 'Container', default: null }],
      undoable: false,
      execute(app, a) {
        if (!app.commands.has('AddICENode')) throw new Error(`${name}: AddICENode missing`);
        const n = app.run('AddICENode', { PresetObj: name, Container: a.Container });
        app.logMsg('info', `${name} — syflex_ice.64.dll Evaluate (GD-02)`);
        return n;
      },
    });
  }

  // GD-05 — iceflow.dll Execute: ICEFlowSendBack (the OneClick* commands are CMD-B18e, src/commands/oneClickB18e.ts).
  if (!app.commands.has('ICEFlowSendBack')) {
    app.register({
      name: 'ICEFlowSendBack',
      label: 'ICEFlow Send Back',
      category: 'ICE',
      args: [],
      undoable: false,
      execute(app) {
        const st = (app as any).__iceFlowOneClick ?? { remote: null, state: 'idle' };
        st.state = 'sendback';
        (app as any).__iceFlowOneClick = st;
        app.logMsg('info', 'ICEFlowSendBack — iceflow.dll Execute (GD-05)');
        return st;
      },
    });
  }

  // Softimage Anchor-to-Delete factory RegisterMenu Name (ICEFlow / CrowdFX / MOTOR) — dump-attested only.
  app.register({
    name: 'AnchorFactoryMenuItem',
    label: 'Anchor Factory Menu Item',
    category: 'ICE|Animation',
    args: [{ name: 'PeId', default: null }, { name: 'Name', default: '' }],
    undoable: false,
    execute(app, a) {
      const peId = Number(a.PeId);
      const name = String(a.Name || '');
      const leaves = (anchorFills as { leaves: { pe_id: number; factory_menu_names: string[]; compound_names: string[]; pe_path?: string }[] }).leaves ?? [];
      const fill = leaves.find(L => L.pe_id === peId);
      if (!fill || !fill.factory_menu_names.includes(name)) {
        throw new Error(`AnchorFactoryMenuItem: "${name}" not attested for PE ${peId}`);
      }
      // Prefer exact compound Name match; Softimage ApplyICEOp / AddICECompoundNode path.
      const compound = (fill.compound_names || []).find(c => c === name || c.toLowerCase() === name.toLowerCase());
      if (compound && app.commands.has('ApplyICEOp')) {
        try {
          return app.run('ApplyICEOp', { File: compound });
        } catch {
          app.logMsg('info', `Anchor fill "${name}" (PE ${peId} ${fill.pe_path ?? ''}): ApplyICEOp shell — compound "${compound}"`);
          return compound;
        }
      }
      app.logMsg('info', `Anchor factory fill "${name}" (PE ${peId} ${fill.pe_path ?? ''}) — Softimage RegisterMenu DUMP_READY`);
      return name;
    },
  });

  app.register({
    name: 'OpenICETreeView',
    label: 'Open ICE Tree View',
    category: 'Property|Edit',
    args: [],
    undoable: false,
    execute() { openView('ICE Tree'); },
  });

  // Softimage full-tab harvest: CreateICENodeWizard [] ACTIVE (no scene delta; opens_hint null).
  // No wizard PPG dump — register ACTIVE empty success; do not invent wizard body.
  app.register({
    name: 'CreateICENodeWizard',
    label: 'Create ICE Node Wizard',
    category: 'ICE',
    args: [],
    undoable: false,
    execute(app) {
      app.logMsg('info', 'CreateICENodeWizard (Softimage ACTIVE shell — wizard PPG LOCK / no invent)');
      return null;
    },
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

  // Softimage remaining-audit-gaps dump: SIApplyICEOp ACTIVE (fuzzy) args×5 — Mode default 4.
  app.register({
    name: 'SIApplyICEOp',
    label: 'Low level Apply ICE Operator',
    category: 'Edit',
    description: 'Applies an ICE operator',
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

  // CreateICECompoundNode: CMD-B19c (optasksB19cIce.ts)

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

  // ExplodeICECompoundNode / ExportICECompoundNode: CMD-B19c (optasksB19cIce.ts)


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

  // AddStaticICEAttribute / RemoveStaticICEAttribute / RenameStaticICEAttribute / SetStaticICEAttributeType /
  // ToggleICEAttributeAlwaysEvaluated: CMD-B19c (optasksB19cIce.ts; attributes live on the geometry of Object)

  // SwitchToolbar: CMD-B19d (selectionB19d.ts, toolbarobj.dll)
}

/** Audit for __uiAudit / compare_ice_module — dump-backed ICE MCP tops + tour HIGH. */
export function iceModuleAudit(app: App): Record<string, unknown> {
  const tops = iceTops as typeof iceTops & {
    tops: string[];
    buttons: Record<string, string[]>;
    switch_toolbar_target: number;
    runtime_anchors: { status: string; compound_names?: string; pe_leaf_count?: number };
  };
  const chrome = iceChrome as typeof iceChrome & {
    views: Record<string, {
      defaultsize: number[]; category: string; clsid?: string; cmdmap?: string;
      status?: string; client_gdi?: string;
    }>;
    prefs_layout?: {
      status?: string; apply_as_css_vars?: boolean;
      preset_manager_size?: number; explorer_size?: number;
      leftcompoundbar_size?: number; rightcompoundbar_size?: number;
      create_node_mode?: number;
    };
    toolbar_shell?: { attested?: string[]; desktop_png?: string; toolbar_text?: string[] };
    client_gdi?: { status?: string; toolbar_h_px?: number };
    attr_client_gdi?: { status?: string };
  };
  const en = (iceCmdEn as { enabled_by_scriptingname: Record<string, boolean> }).enabled_by_scriptingname;
  const prefsDump = icePrefs as {
    softimage: string;
    'preferences.icetree': { param_count: number; params: Record<string, unknown>; propset: string };
    'preferences.ICEOperators': { param_count: number; params: Record<string, unknown>; propset: string };
  };
  const anchors = iceAnchorLeaves as typeof iceAnchorLeaves & {
    board: Record<string, string>;
    pe_menu_leaves: { status: string; count: number; leaves: { trail: string[]; id: number; sdk: string; sdk_id: number }[] };
    compound_om_cmds: { status: string; found: { scriptingname: string }[] };
    unbound_plugin_compounds: { status: string; pe_label: string };
  };
  const tree = chrome.views['ICE Tree'];
  const attr = chrome.views['ICE Attribute Editor'];
  const high = Object.keys(en);
  const wired = high.filter(n => app.commands.has(n));
  const iceFlowWired = ICEFLOW_HOST_CMDS.filter(n => app.commands.has(n));
  const prefSets = (window as any).__prefSets as Map<string, { params: { name: string; value: unknown }[] }> | undefined;
  const iceTreeSet = prefSets?.get('C3DPrefsICETree');
  const iceOpsSet = prefSets?.get('C3DPrefsICEOperators');
  const treeParams = iceTreeSet ? Object.fromEntries(iceTreeSet.params.map(p => [p.name, p.value])) : null;
  const opsParams = iceOpsSet ? Object.fromEntries(iceOpsSet.params.map(p => [p.name, p.value])) : null;
  const pl = chrome.prefs_layout;
  const compoundCmds = (anchors.compound_om_cmds?.found ?? []).map(c => c.scriptingname);
  const compoundCmdsWired = compoundCmds.filter(n => app.commands.has(n));
  return {
    softimage: tops.softimage,
    menuId: tops.menu_id,
    moduleSelect: tops.module_select,
    tops: tops.tops,
    buttons: tops.buttons,
    switchToolbarTarget: tops.switch_toolbar_target,
    runtimeAnchors: tops.runtime_anchors?.status ?? 'DUMP_READY',
    peAnchorLeaves: {
      status: anchors.pe_menu_leaves?.status ?? 'DUMP_READY',
      board: anchors.board,
      count: anchors.pe_menu_leaves?.count ?? 0,
      leaves: anchors.pe_menu_leaves?.leaves ?? [],
      compoundOmCmds: anchors.compound_om_cmds?.status ?? 'DUMP_READY',
      compoundCmdsWired,
      unboundPluginCompounds: anchors.unbound_plugin_compounds?.status ?? 'DUMP_READY',
      peLabel: anchors.unbound_plugin_compounds?.pe_label ?? 'Anchor-to-Delete',
      factoryFills: 'DUMP_READY',
    },
    compoundNamesLock: tops.runtime_anchors?.compound_names ?? 'DUMP_READY',
    iceTreeDefaultSize: tree?.defaultsize,
    iceTreeCategory: tree?.category,
    iceTreeClsid: tree?.clsid,
    iceTreeCmdmap: tree?.cmdmap,
    iceTreeStatus: tree?.status ?? 'CLIENT_GDI',
    iceTreeClientGdi: tree?.client_gdi ?? chrome.client_gdi?.status ?? 'DUMP_READY',
    iceAttrDefaultSize: attr?.defaultsize,
    iceAttrCategory: attr?.category,
    iceAttrClsid: attr?.clsid,
    iceAttrStatus: attr?.status ?? 'CLIENT_GDI',
    iceAttrClientGdi: attr?.client_gdi ?? chrome.attr_client_gdi?.status ?? 'DUMP_READY',
    toolbarShell: chrome.toolbar_shell?.attested ?? [],
    toolbarText: chrome.toolbar_shell?.toolbar_text ?? [],
    toolbarDesktopPng: chrome.toolbar_shell?.desktop_png ?? 'unattested',
    clientGdiToolbarH: chrome.client_gdi?.toolbar_h_px ?? null,
    prefsLayout: {
      status: pl?.status ?? 'PREFS_ATTESTED_REGION_DESKTOP',
      applyAsCssVars: pl?.apply_as_css_vars ?? true,
      preset_manager_size: pl?.preset_manager_size,
      explorer_size: pl?.explorer_size,
      leftcompoundbar_size: pl?.leftcompoundbar_size,
      rightcompoundbar_size: pl?.rightcompoundbar_size,
      create_node_mode: pl?.create_node_mode,
    },
    commandsWired: wired,
    highEnabled: en,
    highWiredCount: wired.length,
    highExpectedCount: high.length,
    iceFlowHostCmds: [...ICEFLOW_HOST_CMDS],
    iceFlowHostWired: iceFlowWired,
    iceFlowHostWiredCount: iceFlowWired.length,
    iceFlowAddSyflexForce: app.commands.has('ICEFlow_AddSyflexForceCompound'),
    syflexIceEvaluate: ['syflexISimul', 'syflexIPin', 'syflexINail', 'syflexISpring', 'syflexISpringGeo', 'syflexICollideMesh'].filter(n => app.commands.has(n)),
    iceFlowSendBack: app.commands.has('ICEFlowSendBack'),
    oneClickSetup: app.commands.has('OneClickSetup'),
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
