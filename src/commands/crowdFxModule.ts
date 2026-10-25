// Softimage CrowdFX under ICE MCP — dump-backed (modules_crowdfx + PE MENU 303 + ICEOperators prefs).
// Actors/Crowd/Simulation PE ids 41644/41646/41645 stay Anchor-to-Delete LOCK (no invent compounds).
// FROST stays parallel; this is Softimage 1:1 fidelity, not a FROST substitute.
import { App } from '../core/commands';
import { Null, Property, X3DObject } from '../core/scene';
import { bool, str } from '../core/params';
import crowdfxModule from '../data/si/crowdfx_module.json';
import crowdfxPrefs from '../data/si/crowdfx_prefs.json';
import crowdfxDesktopMenu from '../data/si/crowdfx_desktop_menu.json';

const addObject = (app: App, obj: X3DObject, parent?: X3DObject | null) => {
  const p = parent ?? app.scene.root;
  app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj));
  return obj;
};

const crowdProp = (name: string, kind: string, extra: Parameters<typeof Property.prototype.add>[0][] = []) =>
  new Property(name, 'crowdfx', [str('kind', kind, 'CrowdFX Kind', { readOnly: true }), bool('enabled', true, 'Enabled'), ...extra]);

type PrefsDump = {
  softimage: string;
  categories: Record<string, Record<string, string | number | boolean>>;
  crowdfx_path_keys: string[];
};

/** CrowdFX path-key names from Desktop tour — live values live on C3DPrefsICEOperators / C3DPrefsSimulation. */
export function applyCrowdFxPrefs(app: App) {
  const dump = crowdfxPrefs as PrefsDump;
  (app as any).crowdFxPathKeys = [...(dump.crowdfx_path_keys ?? [])];
}

const prefParams = (key: string): Record<string, unknown> | null => {
  const prefSets = (window as any).__prefSets as Map<string, { params: { name: string; value: unknown }[] }> | undefined;
  const set = prefSets?.get(key);
  return set ? Object.fromEntries(set.params.map(p => [p.name, p.value])) : null;
};

/** Softimage CrowdFX addon scripting names (commands_full + modules_crowdfx Desktop sweep). */
export function registerCrowdFxModuleCommands(app: App) {
  applyCrowdFxPrefs(app);

  const ensure = (def: Parameters<App['register']>[0]) => {
    if (!app.commands.has(def.name)) app.register(def);
  };

  // ——— Crowd / Actor Custom (CrowdFX_Plugin.py) ———
  ensure({
    name: 'CreateCrowd',
    label: 'Create Crowd',
    category: 'Custom',
    description: 'Create a new Crowd',
    args: [{ name: 'BehaviorPreset', default: 'Basic' }],
    execute(app, a) {
      const n = new Null(app.scene.uniqueName('Crowd'));
      n.addProperty(crowdProp('CrowdFX', 'crowd', [str('behavior', String(a.BehaviorPreset || 'Basic'), 'Behavior Preset')]));
      addObject(app, n);
      app.select([n]);
      app.logMsg('info', `CreateCrowd BehaviorPreset=${a.BehaviorPreset || 'Basic'}`);
      return n;
    },
  });
  ensure({
    name: 'CreateCrowdEmitter',
    label: 'Create Crowd Emitter',
    category: 'Custom',
    args: [],
    execute(app) {
      const n = new Null(app.scene.uniqueName('CrowdEmitter'));
      n.addProperty(crowdProp('CrowdEmitter', 'emitter'));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  ensure({
    name: 'CreateCrowdStadiumEmitter',
    label: 'Create Crowd Stadium Emitter',
    category: 'Custom',
    args: [],
    execute(app) {
      const n = new Null(app.scene.uniqueName('CrowdStadiumEmitter'));
      n.addProperty(crowdProp('CrowdStadiumEmitter', 'stadium_emitter'));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  ensure({
    name: 'CreateCrowdFromGeometry',
    label: 'Create Crowd From Geometry',
    category: 'Custom',
    args: [
      { name: 'EmitterType', default: 'Locomotion' },
      { name: 'UseCollisionAvoidance', default: true },
      { name: 'SkeletonAnimationType', default: 'Set Locomotion' },
    ],
    execute(app, a) {
      const src = app.selectedObjects[0];
      if (!src) throw new Error('Select geometry for Crowd From Geometry');
      const n = new Null(app.scene.uniqueName('CrowdFromGeometry'));
      n.addProperty(crowdProp('CrowdFromGeometry', 'from_geometry', [
        str('source', src.name, 'Source', { readOnly: true }),
        str('emitter_type', String(a.EmitterType || 'Locomotion'), 'Emitter Type'),
        bool('collision_avoidance', a.UseCollisionAvoidance !== false, 'Use Collision Avoidance'),
        str('skel_anim', String(a.SkeletonAnimationType || 'Set Locomotion'), 'Skeleton Animation Type'),
      ]));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  ensure({
    name: 'AddActorSource',
    label: 'Add Actor Source',
    category: 'Custom',
    description: 'Add an Actor Source to the Crowd',
    args: [
      { name: 'inSourceMesh', default: null },
      { name: 'inCOG', default: null },
      { name: 'inIndex', default: -1 },
    ],
    execute(app, a) {
      const mesh = a.inSourceMesh
        ? app.scene.find(String(a.inSourceMesh))
        : app.selectedObjects[0];
      if (!mesh) throw new Error('Select a source mesh (or pass inSourceMesh)');
      const n = new Null(app.scene.uniqueName('ActorSource'));
      n.addProperty(crowdProp('ActorSource', 'actor_source', [
        str('source_mesh', mesh.name, 'Source Mesh', { readOnly: true }),
        str('cog', a.inCOG != null ? String(a.inCOG) : '', 'COG'),
        str('index', String(a.inIndex ?? -1), 'Index'),
      ]));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  ensure({
    name: 'RemoveActorProxy',
    label: 'Remove Actor Proxy',
    category: 'Custom',
    description: 'Remove an Actor Proxy from the Crowd',
    args: [{ name: 'inCollection', default: null }],
    execute(app, a) {
      const targets = a.inCollection
        ? String(a.inCollection).split(',').map(s => s.trim()).filter(Boolean).map(n => app.scene.find(n)).filter(Boolean) as X3DObject[]
        : app.selectedObjects.filter(o => o.properties.some(p => p.type === 'crowdfx' && p.val('kind') === 'actor_proxy'));
      for (const o of targets) {
        if (o === app.scene.root) continue;
        const p = o.parentObj;
        if (p) app.record('Remove Actor Proxy', () => p.removeChild(o), () => p.addChild(o));
      }
      app.select([]);
      app.logMsg('info', `RemoveActorProxy (${targets.length})`);
      return targets.length;
    },
  });
  ensure({
    name: 'CacheActorCopies',
    label: 'Cache Actor Copies',
    category: 'Custom',
    description: 'Create a cache from the actor copies geometry',
    args: [{ name: 'inName', default: 'Cache Actor Copies' }],
    execute(app, a) {
      const n = new Null(app.scene.uniqueName(String(a.inName || 'CacheActorCopies').replace(/\s+/g, '_')));
      n.addProperty(crowdProp('CacheActorCopies', 'cache'));
      addObject(app, n);
      app.select([n]);
      return n;
    },
  });
  ensure({
    name: 'CrowdSetupStadiumActor',
    label: 'Crowd Setup Stadium Actor',
    category: 'Custom',
    description: 'Setup Actor for Stadium Crowd',
    args: [{ name: 'inProp', default: null }],
    execute(app, a) {
      const o = a.inProp ? app.scene.find(String(a.inProp)) : app.selectedObjects[0];
      if (!o) throw new Error('Select an actor (or pass inProp)');
      let p = o.properties.find(x => x.type === 'crowdfx' && x.val('kind') === 'stadium_actor');
      if (!p) {
        p = crowdProp('StadiumActor', 'stadium_actor');
        app.record('Stadium Actor', () => o.addProperty(p!), () => o.removeProperty(p!));
      }
      app.select([p]);
      return p;
    },
  });
  ensure({
    name: 'CrowdSetupPedestrianActor',
    label: 'Crowd Setup Pedestrian Actor',
    category: 'Custom',
    description: 'Setup Actor for Pedestrian Crowd',
    args: [{ name: 'inProp', default: null }],
    execute(app, a) {
      const o = a.inProp ? app.scene.find(String(a.inProp)) : app.selectedObjects[0];
      if (!o) throw new Error('Select an actor (or pass inProp)');
      let p = o.properties.find(x => x.type === 'crowdfx' && x.val('kind') === 'pedestrian_actor');
      if (!p) {
        p = crowdProp('PedestrianActor', 'pedestrian_actor');
        app.record('Pedestrian Actor', () => o.addProperty(p!), () => o.removeProperty(p!));
      }
      app.select([p]);
      return p;
    },
  });
  ensure({
    name: 'AddActorProxyAnimations',
    label: 'Add Actor Proxy Animations',
    category: 'Custom',
    args: [],
    execute(app) {
      const o = app.selectedObjects[0];
      if (!o) throw new Error('Select an Actor Proxy');
      let p = o.properties.find(x => x.type === 'crowdfx' && x.val('kind') === 'actor_proxy_anims');
      if (!p) {
        p = crowdProp('ActorProxyAnimations', 'actor_proxy_anims');
        app.record('Actor Proxy Anims', () => o.addProperty(p!), () => o.removeProperty(p!));
      }
      app.logMsg('info', 'AddActorProxyAnimations');
      return p;
    },
  });
  ensure({
    name: 'GLSLActorEnvelopeUpdateDefines',
    label: 'GLSL Actor Envelope Update Defines',
    category: 'Custom',
    args: [{ name: 'inCompound', default: 'GLSL Actor Envelope Update Defines' }],
    undoable: false,
    execute(app, a) {
      app.logMsg('info', `GLSLActorEnvelopeUpdateDefines (${a.inCompound || 'GLSL Actor Envelope Update Defines'}) — compound body LOCK`);
      return null;
    },
  });
  ensure({
    name: 'GLSLActorEnvelopeLinkICEAttributes',
    label: 'GLSL Actor Envelope Link ICE Attributes',
    category: 'Custom',
    args: [{ name: 'inCompound', default: 'GLSL Actor Envelope Link ICE Attributes' }],
    undoable: false,
    execute(app, a) {
      app.logMsg('info', `GLSLActorEnvelopeLinkICEAttributes (${a.inCompound || 'GLSL Actor Envelope Link ICE Attributes'}) — compound body LOCK`);
      return null;
    },
  });

  // ——— Behavior / BVH actor I/O (bvrexport.dll) — file dialogs stay stubs ———
  ensure({
    name: 'BvrLoadActor',
    label: 'Load Actor',
    category: '',
    args: [],
    undoable: false,
    execute(app) {
      app.logMsg('info', 'BvrLoadActor: Softimage actor file dialog stub (dump-attested scripting name)');
      return null;
    },
  });
  ensure({
    name: 'BvrSaveActor',
    label: 'Save Actor',
    category: '',
    args: [],
    undoable: false,
    execute(app) {
      app.logMsg('info', 'BvrSaveActor: Softimage actor file dialog stub (dump-attested scripting name)');
      return null;
    },
  });
  ensure({
    name: 'BvrImportBVHActor',
    label: 'Import BVH Actor',
    category: '',
    args: [],
    undoable: false,
    execute(app) {
      app.logMsg('info', 'BvrImportBVHActor: Softimage BVH import dialog stub (dump-attested scripting name)');
      return null;
    },
  });

  // ——— FBX scale factor helpers swept with CrowdFX actor I/O ———
  ensure({
    name: 'FBXExportScaleFactor',
    label: 'FBXExportScaleFactor',
    category: '',
    args: [{ name: 'Factor', default: null }],
    undoable: false,
    execute(app, a) {
      const A = app as any;
      if (a.Factor != null) A.fbxExportScaleFactor = Number(a.Factor);
      app.logMsg('info', `FBXExportScaleFactor=${A.fbxExportScaleFactor ?? a.Factor ?? ''}`);
      return A.fbxExportScaleFactor ?? a.Factor ?? null;
    },
  });
  ensure({
    name: 'FBXImportScaleFactor',
    label: 'FBXImportScaleFactor',
    category: '',
    args: [{ name: 'Factor', default: null }],
    undoable: false,
    execute(app, a) {
      const A = app as any;
      if (a.Factor != null) A.fbxImportScaleFactor = Number(a.Factor);
      app.logMsg('info', `FBXImportScaleFactor=${A.fbxImportScaleFactor ?? a.Factor ?? ''}`);
      return A.fbxImportScaleFactor ?? a.Factor ?? null;
    },
  });
}

/** Audit for __uiAudit / compare_crowdfx_module — dump-backed CrowdFX under ICE. */
export function crowdFxModuleAudit(app: App): Record<string, unknown> {
  const mod = crowdfxModule as typeof crowdfxModule & {
    softimage: string;
    menu_id: number;
    mcp_top: string;
    buttons: string[];
    pe_menu_ids: Record<string, number>;
    switch_toolbar_target: number;
    runtime_anchors: { status: string };
    sdk_anchors: Record<string, number>;
    commands: { scriptingname: string }[];
  };
  const A = app as any;
  const wantCmds = (mod.commands ?? []).map(c => c.scriptingname);
  const wired = wantCmds.filter(n => app.commands.has(n));
  const dump = crowdfxPrefs as PrefsDump;
  // Prefer live File>Preferences propsets (ICE #97 / Simulate #99); fall back to dump keys only.
  const iceOpsLive = prefParams('C3DPrefsICEOperators') ?? A.iceOperatorsPrefs ?? dump.categories?.['preferences.ICEOperators'] ?? {};
  const simLive = prefParams('C3DPrefsSimulation') ?? A.simulationPrefs ?? dump.categories?.['preferences.simulation'] ?? {};
  const iceTreeLive = prefParams('C3DPrefsICETree') ?? A.icetreePrefs ?? dump.categories?.['preferences.icetree'] ?? {};
  const pathKeys = (A.crowdFxPathKeys ?? dump.crowdfx_path_keys ?? []) as string[];
  const pathOk = pathKeys.every((k: string) => Object.prototype.hasOwnProperty.call(iceOpsLive, k));
  const desk = crowdfxDesktopMenu as {
    status: string;
    host_module: string;
    reachability: {
      path: string[];
      buttons: string[];
      pe_menu_ids: Record<string, number>;
      submenu_live: boolean;
      runtime_anchors: string;
    };
    desktop_paths: Record<string, string>;
  };
  const iceMenubar = !!document.querySelector('#menubar .m[data-si-menu="ICE"]');
  return {
    softimage: mod.softimage,
    menuId: mod.menu_id,
    underIce: true,
    mcpTop: mod.mcp_top,
    buttons: mod.buttons,
    peMenuIds: mod.pe_menu_ids,
    switchToolbarTarget: mod.switch_toolbar_target,
    runtimeAnchors: mod.runtime_anchors?.status ?? 'LOCK',
    sdkAnchors: mod.sdk_anchors,
    commandsWanted: wantCmds,
    commandsWired: wired,
    commandsWiredCount: wired.length,
    createCrowd: app.commands.has('CreateCrowd'),
    iceOperatorsPrefs: iceOpsLive,
    simulationPrefs: simLive,
    icetreePrefs: iceTreeLive,
    crowdFxPathKeys: pathKeys,
    crowdFxPathKeysPresent: pathOk,
    propsets: {
      ICEOperators: 'C3DPrefsICEOperators',
      simulation: 'C3DPrefsSimulation',
      icetree: 'C3DPrefsICETree',
    },
    preferencesCategories: {
      ICEOperators: !!app.Preferences.Categories('preferences.ICEOperators'),
      simulation: !!app.Preferences.Categories('preferences.simulation'),
      icetree: !!app.Preferences.Categories('preferences.icetree'),
    },
    currentModule: app.module,
    // Desktop menubar ICE → CrowdFX Actors/Crowd/Simulation (DUMP_READY harvest)
    desktopMenu: {
      status: desk.status,
      host: desk.host_module,
      path: desk.reachability?.path,
      buttons: desk.reachability?.buttons,
      peMenuIds: desk.reachability?.pe_menu_ids,
      submenuLive: desk.reachability?.submenu_live ?? false,
      runtimeAnchors: desk.reachability?.runtime_anchors ?? 'LOCK',
      media: desk.desktop_paths,
      menubarPresent: iceMenubar,
    },
  };
}
