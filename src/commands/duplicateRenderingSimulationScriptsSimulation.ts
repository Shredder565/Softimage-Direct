// Ledger row CMD-B6e, simulation.vbs part. Brief: docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md.
// Original code written from that contract only.
//
// StoreEnvironmentCacheToMixer, StoreEnvironmentCachesToMixer, MergeSimulationEnvironments,
// ChangeEnvironmentDynamicsOperator, CacheObjectsIntoFileDialog, EditICECompoundPPGLogic.
//
// A simulation environment of this build is a null with a `simenv` marker parameter (CreateEnvironment). Its
// containers, caches and dynamics operator are not modelled, so the commands here read and write an inferred record
// on the environment (`simulationEnvironment`: containers, caches, operators). The C++ callees
// (SIStoreEnvironmentCacheToMixer, AddContainerToEnvironment, RemoveFromContainer, CreateEnvironmentCache, the
// EvolveOp / DynamicsOp / NXDynamicsOp presets of ApplyOp, CacheObjectsIntoFile, InspectPreferences,
// GetICECompoundProperties / EditICECompoundProperties) run when another row has put them on the bus; otherwise the
// call is traced and either produced on that record or logged as not yet attested.
import { App, type CommandDef } from '../core/commands';
import { Node, X3DObject, Property } from '../core/scene';
import { str, bool, int, enumP } from '../core/params';
import type { LayoutNode } from '../core/opdefs';
import {
  stateOf, text, unset, truthy, info, logError, nya, enumName, trace, busCall, siName, collection, nodeOf,
  after, modalPage, layoutBuilder, withRootProperty, interactive,
} from './duplicateRenderingSimulationScriptsShared';
import { editCompoundLogic, type LogicEditorSpec } from './duplicateRenderingSimulationScriptsRendering';

type Reg = (def: CommandDef) => void;

// ------------------------------------------------------------------ the inferred environment record
export interface SimContainer { name: string; type: string; members: Node[] }
export interface SimEnvironmentData { containers: SimContainer[]; caches: any[]; operators: { name: string; inputPorts?: { target: any }[] }[] }
export const simEnvironment = (env: Node): SimEnvironmentData => ((env as any).simulationEnvironment ??= { containers: [], caches: [], operators: [] });
const isEnvironment = (n: unknown): n is X3DObject => n instanceof X3DObject && (!!n.get('simenv') || !!(n as any).simulationEnvironment);
const EVOLVE_CLASS_ID = '{CBB627A6-84EC-42A3-894D-09F78FCF0293}';

// ------------------------------------------------------------------ StoreEnvironmentCache(s)ToMixer
function storeWorker(app: App, cache: unknown, name: string, addClip: boolean): unknown {
  const WORKER = 'SIStoreEnvironmentCacheToMixer';
  if (app.commands.has(WORKER)) { trace(app, WORKER, [cache, name, addClip], 'bus'); return app.ExecuteCommand(WORKER, [cache, name, addClip]); }
  trace(app, WORKER, [cache, name, addClip], 'not-attested');
  nya(app, WORKER, 'the C++ worker is not on the bus; nothing is stored in the mixer');
  return undefined;
}
function storeToMixer(app: App, command: 'StoreEnvironmentCacheToMixer' | 'StoreEnvironmentCachesToMixer', target: unknown, a: Record<string, any>) {
  const many = command === 'StoreEnvironmentCachesToMixer';
  const st = stateOf(app);
  const subject: unknown = target instanceof Node ? target : typeof target === 'string' && target ? nodeOf(app, target) ?? target : target;
  let name = unset(a.Name) ? 'SimulationRun' : String(a.Name); let addClip = truthy(a.AddClip);
  const run = () => {
    st.out[command] = { Name: name, AddClip: addClip };
    if (!many) { storeWorker(app, subject, name, addClip); return undefined; }   // the worker's result is discarded
    const caches = subject instanceof Node ? simEnvironment(subject).caches : [];
    return caches.map(c => storeWorker(app, c, name, addClip));
  };
  if (name !== '(UIOnly)') return run();
  name = 'SimulationRun';
  const prop = new Property('StoreEnvironmentCacheToMixer', 'customparamset', [
    str('ActionsName', 'SimulationRun', 'RBD Action Name', { desc: 'If RBD included in the simualtion, the name given to the new action created' }),
    bool('AddClip', false, 'Add Clip To Mixer', { desc: 'If checked, adds a clip to the mixer on a new track' }),
  ]);
  const remove = withRootProperty(app, prop);
  let ok: boolean | Promise<boolean>;
  try { ok = modalPage(app, command, text(many ? 1134 : 1133), prop, layoutBuilder(prop, [{ param: 'ActionsName' }, { param: 'AddClip' }])); } catch (e) { remove(); throw e; }
  return after(ok, (okay) => {
    try {
      if (!okay) { st.out[command] = { Name: name, AddClip: addClip }; return many ? [] : undefined; }   // Cancel: no call, no error
      name = String(prop.val('ActionsName') ?? ''); addClip = !!prop.val('AddClip');
      return run();
    } finally { remove(); }
  });
}

// ------------------------------------------------------------------ MergeSimulationEnvironments
function addContainer(app: App, env: X3DObject, type: string, name: string) {
  const NAME = 'AddContainerToEnvironment';
  if (app.commands.has(NAME)) { trace(app, NAME, [env, type, 1, name], 'bus'); app.ExecuteCommand(NAME, [env, type, 1, name]); return; }
  trace(app, NAME, [env, type, 1, name], 'stand-in');
  const data = simEnvironment(env); const c: SimContainer = { name, type, members: [] };
  app.record('Add container', () => { data.containers.push(c); }, () => { const i = data.containers.indexOf(c); if (i >= 0) data.containers.splice(i, 1); });
}
function mergeEnvironments(app: App, a: Record<string, any>) {
  const CMD = 'MergeSimulationEnvironments';
  // 1. filter
  const envs = (collection(app, a.SimulationEnvironments) ?? []).filter(isEnvironment);
  if (!envs.length) { logError(app, 'MergeEnvironments: You need to select at least two environments in order to merge them.'); return undefined; }
  if (envs.length === 1) { logError(app, 'MergeEnvironments : You need to select more than an environment object.'); return undefined; }
  // 2. destination containers
  const dest = envs[0]; const destData = simEnvironment(dest); const sources = envs.slice(1);
  if (!destData.containers.length) for (const [type, name] of [['RigidBody', 'RigidBodies'], ['Constraint', 'Constraints'], ['Force', 'Forces']]) addContainer(app, dest, type, name);
  // 3. members move to the destination container of the same name
  for (const src of sources) for (const c of simEnvironment(src).containers) {
    const to = destData.containers.find(d => d.name === c.name);
    if (!to) { nya(app, CMD, `container "${c.name}" of ${siName(app, src)} has no counterpart in ${siName(app, dest)}; its members are not moved`, 'Q8'); continue; }
    const moved = [...c.members]; const added = moved.filter(m => !to.members.includes(m));
    trace(app, 'AddMember', [`${siName(app, dest)}.${to.name}`, moved], 'stand-in');
    for (const m of moved) trace(app, 'RemoveFromContainer', [`${siName(app, src)}.${c.name}`, m], app.commands.has('RemoveFromContainer') ? 'bus' : 'stand-in');
    app.record('Merge containers', () => { to.members.push(...added); c.members.splice(0, c.members.length); }, () => { for (const m of added) { const i = to.members.indexOf(m); if (i >= 0) to.members.splice(i, 1); } c.members.push(...moved); });
  }
  // 4. simulation operators of the merged environments are re-targeted, last to first
  const evolve: { op: any; prim: any }[] = [];
  for (const o of app.scene.allObjects()) for (const op of ((o.primitive as any)?.operators ?? [])) if ((op as any).classId === EVOLVE_CLASS_ID || /^evolve/i.test(String(op.type))) evolve.push({ op, prim: o.primitive });
  for (const { op } of evolve.reverse()) {
    const ports: { target: any }[] | undefined = op.inputPorts;
    if (!ports || !ports.length) continue;   // the scene default operator
    const env = ports[2]?.target?.parent;
    if (!sources.includes(env)) continue;
    const prim = ports[0]?.target; const model = prim?.parent?.model;
    const cache = destData.caches.find(c => c?.model === model);
    if (!cache) { nya(app, CMD, `no cache for ${model ? siName(app, model) : 'the model'} in ${siName(app, dest)}: that branch is defective as shipped, the operator is left as it is`, 'Q7'); continue; }
    trace(app, 'DeleteObj', [op], 'not-attested');
    trace(app, 'ApplyOp', ['EvolveOp', `${prim?.fullName};${prim?.fullName};${siName(app, dest)}.simtimectrl;${cache?.fullName ?? cache?.name}`], 'not-attested');
    nya(app, CMD, 'evolve operators carry no port connections in this build; the operator is not re-applied');
  }
  // 5. the list goes back to the argument; the merged environments are deleted in one call
  stateOf(app).out[CMD] = { SimulationEnvironments: envs.map(e => siName(app, e)).join(',') };
  busCall(app, 'DeleteObj', { InputObj: sources }, [sources]);
  return undefined;
}

// ------------------------------------------------------------------ ChangeEnvironmentDynamicsOperator
function changeDynamicsOperator(app: App, a: Record<string, any>) {
  const CMD = 'ChangeEnvironmentDynamicsOperator';
  let env: unknown;
  if (unset(a.InputEnvironment)) {
    // inferred: the scene's active environment is kept on the scene by this build's stand-in (CreateEnvironment does not set it)
    env = (app.scene as any).activeSimulationEnvironment;
    if (!env) { logError(app, 'There is no active simulation environment in this scene.'); return undefined; }
  } else env = a.InputEnvironment instanceof Node ? a.InputEnvironment : nodeOf(app, Array.isArray(a.InputEnvironment) ? a.InputEnvironment[0] : a.InputEnvironment);
  if (!isEnvironment(env)) { logError(app, 'You must specify a Simulation Environment.'); return undefined; }
  const data = simEnvironment(env); const op = data.operators[0];
  const name = String(op?.name ?? '').split('.').pop() ?? '';
  const engine = enumName(a.DynamicsEngine);
  if (typeof engine === 'number') { nya(app, CMD, `numeric engine ${engine} (siRBDEngine values are not attested)`); return undefined; }
  const swap = (message: string, preset: string, newName: string) => {
    info(app, message);
    trace(app, 'DeleteObj', [`${siName(app, env as X3DObject)}.${name}`], 'stand-in');
    trace(app, 'ApplyOp', [preset, env], 'stand-in');   // the bus ApplyOp knows deformers only
    const made = { name: newName };   // inferred: the applied operator carries the name the script tests for
    app.record('Change dynamics operator', () => { data.operators[0] = made; }, () => { data.operators[0] = op; });
  };
  if (name === 'NXDynamicsop' && engine === 'siOpenDynamicsEngine') swap('Switched to ODE', 'DynamicsOp', 'dynamicsop');
  else if (name === 'dynamicsop' && engine === 'siPhysXEngine') swap('Switched to Ageia physX', 'NXDynamicsOp', 'NXDynamicsop');
  return undefined;
}

// ------------------------------------------------------------------ CacheObjectsIntoFileDialog
const STANDARD_POINTCLOUD = ['PointPosition', 'Color', 'Force', 'Mass', 'Orientation', 'PointVelocity', 'Scale', 'Shape', 'ShapeInstanceTime', 'SimulatedFrameFraction', 'Size',
  'SpriteAngle', 'State_ID', 'State_Transition_Time', 'StrandOrientation', 'StrandPosition', 'StrandSize', 'StrandVelocity'].map(s => s.toLowerCase());
const EXCLUDED_ATTRIBUTES = ['Init', 'ID', 'subdloop', 'subdrule'];
const BUTTON = { cache: 'CachingOptions_Cache', prefs: 'CachingOptions_Preferences', uncheck: 'CachingOptions_UncheckAll', check: 'CachingOptions_CheckAll' };
const isGeometry = (n: unknown): n is X3DObject => n instanceof X3DObject && !!n.primitive && ((n.primitive as any).operators?.length ?? 0) > 0;
/** ICE attributes of a geometry. inferred: this build keeps no attribute list, so every geometry has the writable
 *  `PointPosition`; an object may carry an explicit `iceAttributes` list ({ name, readOnly?, dataType? }). */
function iceAttributes(o: X3DObject): { name: string; readOnly?: boolean; dataType?: string }[] {
  const own = (o as any).iceAttributes as { name: string; readOnly?: boolean; dataType?: string }[] | undefined;
  return own ?? [{ name: 'PointPosition' }];
}
function cacheObjectsIntoFileDialog(app: App) {
  const CMD = 'CacheObjectsIntoFileDialog';
  const st = stateOf(app); const root = app.scene.root; const A = app.anim;
  // 1. geometries of the selection
  const geoms = app.selection.filter(isGeometry);
  if (!geoms.length) { logError(app, 'CacheObjectsIntoFileDialog: No valid geometries selected!'); return undefined; }
  // 2. the options property stays in the scene
  let prop = root.properties.find(p => p.name === 'Caching_Options');
  if (!prop) {
    // 3. parameters, only when the property is new
    const prefs: Record<string, any> = (app as any).simulationPrefs ?? {};
    if (!(app as any).simulationPrefs) nya(app, CMD, 'the simulation preferences are not available; path and file name start empty');
    const index = Number(prefs.defaulttemplateindex ?? 0);
    const path = String(prefs[index === 0 ? 'cachetemplateprojectpath' : index === 1 ? 'cachetemplatelocalpath' : index === 2 ? 'cachetemplatepatha' : index === 3 ? 'cachetemplatepathb' : 'cachetemplatepathc'] ?? '');
    let file = String(prefs.cachetemplatefilename ?? '').split('[version]').join('take1'); let format = 'Custom';
    if (file.endsWith('.icecache')) { file = file.slice(0, -'.icecache'.length); format = 'ICECache'; }
    else if (file.endsWith('.pc2')) { file = file.slice(0, -'.pc2'.length); format = 'PC2'; }
    const made = new Property('Caching_Options', 'customparamset', [
      str('FileName', file, 'FileName'),
      enumP('Format', format, [{ label: 'ICECache', value: 'ICECache' }, { label: 'PC2', value: 'PC2' }, { label: 'Custom', value: '' }], 'Format'),
      str('Path', path, 'Path'), str('PathFeedBack', '', 'PathFeedBack', { readOnly: true }),
      int('FrameStart', A.startFrame, 'start', { min: -100000, max: 10000000, uimin: A.startFrame, uimax: A.endFrame }),
      int('FrameEnd', A.endFrame, 'end', { min: -100000, max: 10000000, uimin: A.startFrame, uimax: A.endFrame }),
      int('FrameStep', 1, 'step', { min: 1, max: 10000000, uimin: 1, uimax: 4 }),
      bool('overwrite', true, 'Overwrite existing files'),
    ]);
    app.record('Add property', () => root.addProperty(made), () => root.removeProperty(made));
    prop = made;
  }
  const page = prop;
  // 4. attribute switches (every call)
  const names: string[] = [];
  for (const o of geoms) for (const at of iceAttributes(o)) {
    if (at.readOnly || EXCLUDED_ATTRIBUTES.includes(at.name) || at.name.startsWith('__Init_') || /locator/i.test(String(at.dataType ?? ''))) continue;
    if (!names.includes(at.name) && names.length < 300) names.push(at.name);
  }
  const pointcloud = geoms.some(o => /pointcloud/i.test(o.type));
  for (const n of names) {
    if (page.get(`attr_${n}`)) continue;   // switches from earlier calls keep their values
    const standard = pointcloud ? STANDARD_POINTCLOUD.includes(n.toLowerCase()) : n.toLowerCase() === 'pointposition';
    page.add(bool(`attr_${n}`, standard, n));
  }
  // 5. layout (every call)
  const noLabel = ['NoLabel'];
  const layout: LayoutNode[] = [
    { tab: 'General', items: [
      { row: '', items: [
        { group: 'FileName', items: [{ param: 'FileName', opts: noLabel }] },
        { group: 'Format', items: [{ param: 'Format', opts: noLabel }] },
      ] },
      { group: 'Path', items: [{ param: 'Path', opts: noLabel }, { param: 'PathFeedBack', opts: noLabel }] },
      { group: 'Time Range', items: [{ param: 'FrameStart', label: 'start' }, { param: 'FrameEnd', label: 'end' }, { param: 'FrameStep', label: 'step' }] },
      { group: 'Options', items: [{ param: 'overwrite', label: 'Overwrite existing files' }] },
      { row: '', items: [{ button: BUTTON.cache, label: 'Cache!', opts: ['continue'] }, { button: BUTTON.prefs, label: 'Preferences' }] },
    ] },
    { tab: 'Attributes', items: [
      { row: '', items: [{ button: BUTTON.uncheck, label: 'Uncheck All', opts: ['continue'] }, { button: BUTTON.check, label: 'Check All' }] },
      ...names.map(n => ({ param: `attr_${n}`, label: n })),
    ] },
  ];
  page.layout = layout;
  // 6. page behaviour
  const base = () => {
    const path = String(page.val('Path') ?? ''); let out = path + (/[\\/]$/.test(path) ? '' : '/') + String(page.val('FileName') ?? '');
    const format = String(page.val('Format') ?? '');
    if (format === 'ICECache') out += '.icecache';
    else if (format === 'PC2') out = out.replace(/(_\[frame\]|\.\[frame\]|\[frame\])$/, '') + '.pc2';
    return out;
  };
  const feedback = () => {
    const first = app.selectedObjects[0];
    // XSIUtils.ResolvePath is not modelled: the remaining tokens ([project path], ...) stay as they are (inferred stand-in)
    return base().split('[object]').join(first ? first.name : 'object').split('[model]').join(first ? first.model?.name ?? 'model' : 'model');
  };
  const refresh = () => { const p = page.get('PathFeedBack')!; const v = feedback(); if (p.value !== v) p.value = v; };
  const press = (button: string) => {
    if (button === BUTTON.cache) {
      const attributes = page.params.filter(p => p.name.startsWith('attr_') && p.value).map(p => p.name.slice(5)).join(',');
      const args = { PathID: 5, FirstFrame: Number(page.val('FrameStart')), LastFrame: Number(page.val('FrameEnd')), FramesPerStep: Number(page.val('FrameStep')), Overwrite: !!page.val('overwrite'),
        ShowProgressbar: true, Attributes: attributes, Version: 'take1', AlternativePath: base() };
      // the objects argument is not bound by the page logic: the callee works on the selection at click time (inferred)
      if (app.commands.has('CacheObjectsIntoFile')) busCall(app, 'CacheObjectsIntoFile', args);
      else { trace(app, 'CacheObjectsIntoFile', Object.entries(args).map(([k, v]) => `${k}=${String(v)}`), 'not-attested'); nya(app, CMD, 'CacheObjectsIntoFile is not on the bus; nothing is cached', 'Q12'); }
    } else if (button === BUTTON.prefs) {
      if (app.commands.has('InspectPreferences')) busCall(app, 'InspectPreferences', { InputObjs: 'Simulation' }, ['Simulation']);
      else { trace(app, 'InspectPreferences', ['Simulation'], 'not-attested'); nya(app, CMD, 'InspectPreferences is not on the bus'); }
    } else if (button === BUTTON.uncheck || button === BUTTON.check) {
      const v = button === BUTTON.check;
      trace(app, 'SetValue', [`${page.name}.attr_*`, v], 'stand-in');
      for (const p of page.params) if (p.name.startsWith('attr_')) app.setParam(p, v);
    }
  };
  if (!(page as any).cachingOptionsLogic) {
    (page as any).cachingOptionsLogic = true;
    page.onChange((p) => { if (p.name === 'Path' || p.name === 'FileName' || p.name === 'Format') st.cachingOptions?.property === page && refreshCurrent(app); });
  }
  st.cachingOptions = { property: page, attributes: names, feedback, outputPath: base, press };
  (st.cachingOptions as any).refresh = refresh;
  refresh();   // on open
  // 7. non-modal inspection; nothing is cached until Cache! is pressed
  trace(app, 'InspectObj', [page.name, '', text(1135)], 'stand-in');   // the bus InspectObj resolves scene objects only
  if (interactive(app)) app.events.emit('inspect', page);
  app.events.emit('scene');
  return undefined;
}
function refreshCurrent(app: App) { (stateOf(app).cachingOptions as any)?.refresh?.(); }

// ------------------------------------------------------------------ registration
const ICE_LOGIC: LogicEditorSpec = {
  command: 'EditICECompoundPPGLogic', getter: 'GetICECompoundProperties', setter: 'EditICECompoundProperties', minLength: 13, logicIndex: 11, languageIndex: 12,
  propName: 'ICE Compound PPG Logic', titleId: 1516,
  // values 0 to 10 go back unchanged, then the new logic and language
  setterArgs: (node, values, logic, language) => ({ positional: [node, ...values.slice(0, 11), logic, language] }),
};

export function registerSimulationScriptCommands(app: App, reg: Reg) {
  const CAT = 'Simulation';
  reg({
    name: 'StoreEnvironmentCacheToMixer', label: 'StoreEnvironmentCacheToMixer', category: CAT,
    args: [{ name: 'EnvironmentCache', default: null }, { name: 'Name', default: 'SimulationRun' }, { name: 'AddClip', default: false }],
    execute: (app, a) => storeToMixer(app, 'StoreEnvironmentCacheToMixer', a.EnvironmentCache, a),
  });
  reg({
    name: 'StoreEnvironmentCachesToMixer', label: 'StoreEnvironmentCachesToMixer', category: CAT,
    args: [{ name: 'Environment', default: null }, { name: 'Name', default: 'SimulationRun' }, { name: 'AddClip', default: false }],
    execute: (app, a) => storeToMixer(app, 'StoreEnvironmentCachesToMixer', a.Environment, a),
  });
  reg({ name: 'MergeSimulationEnvironments', label: 'MergeEnvironments', category: CAT, args: [{ name: 'SimulationEnvironments', default: null }], execute: (app, a) => mergeEnvironments(app, a) });
  reg({
    name: 'ChangeEnvironmentDynamicsOperator', label: 'ChangeEnvironmentDynamicsOperator', category: CAT, description: 'Change Rigid Body Dynamics Engine',
    args: [{ name: 'InputEnvironment', default: null }, { name: 'DynamicsEngine', default: ':siPhysXEngine:siRBDEngine' }], execute: (app, a) => changeDynamicsOperator(app, a),
  });
  reg({
    name: 'CacheObjectsIntoFileDialog', label: 'Cache Objects Into File With Dialog', category: 'File', description: 'Creates cache files for objects',
    // the registry lists one placeholder argument (direction -1); the procedure takes none
    args: [{ name: 'CreatedObj', default: 'VBScript' }], execute: (app) => cacheObjectsIntoFileDialog(app),
  });
  reg({
    name: 'EditICECompoundPPGLogic', label: 'EditICECompoundPPGLogic', category: CAT, description: 'Edit ICE Compound PPG Logic with a modal text editor.',
    args: [{ name: 'InputObj', default: null }], execute: (app, a) => editCompoundLogic(app, ICE_LOGIC, a.InputObj),
  });
  // The Property Editor's layout buttons run a bus command; the page buttons of Caching_Options are page logic, so
  // their clicks are picked up here.
  if (typeof document !== 'undefined' && !(app as any).__cachingOptionsClicks) {
    (app as any).__cachingOptionsClicks = true;
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement | null)?.closest?.('.ppg-spdl-btn') as HTMLElement | null;
      const id = b?.dataset.button ?? '';
      if (id.startsWith('CachingOptions_')) stateOf(app).cachingOptions?.press(id);
    });
  }
}
