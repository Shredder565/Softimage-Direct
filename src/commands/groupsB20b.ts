// Ledger row CMD-B20b: partitions / groups (grouptask.dll), environments (environments.dll), MoveJoint / SICreateSkeleton
// (viewinteraction.dll), vertex colours (gap.dll), CopyCluster (siclustertasks.dll), SaveKeyOnPath (pathanimtask.dll).
// Brief: docs/ghidra/cmd-b20b-groups-env-skeleton-vcolor.md section 3 ("Wire contract" per command) and section 5, and the
// CMD-B20b section of docs/re/WIRE_CORRECTIONS_B20.md. Original code written from that prose contract only; no XSIBATCH
// golden exists for the row.
//
// Earlier registrations of these names were removed and point here: moduleToolbar.ts (AddToPartition /
// RemoveFromPartition), selectionGroupLayer.ts (SIAddToGroupLowLevel / SIRemoveFromGroup / SICreateGroup / AddGroup and
// its duplicate SetInstanceGroup / RemoveInstanceGroup; the CMD-B7a bodies in uiGroupViewTasks.ts stay the only ones),
// inferredB10Scene.ts (SetCurrentEnvironment), model.ts (SICreateSkeleton, CreateVertexColorSupport), model2.ts
// (PaintVertexColors), clusters.ts (CopyCluster), anim.ts (SaveKeyOnPath). model.ts keeps its "MoveJoint" tool-arming
// body because toolsB16a.ts captures it as the body of the Move Joint Tool class before this module replaces the
// scripting name. Argument lists are data/command_registry.json's (output-only arguments left off the list and written
// back into the argument record).
//
// Conventions of the row (as in CMD-B19b):
//  * A failing HRESULT is thrown as SiStatusError ("<command>: <what> (status 0x...)"). Success statuses are kept in
//    `app.groupsB20b.status[<command>]`.
//  * Sub-tasks the contract names (CreateVertexColorSupport, CreateClusterFromSubComponent, AddFileCacheSource, AddClip,
//    SetValue, the per-object path key task) are recorded in `app.groupsB20b.calls` in contract order.
//  * Output arguments are kept in `app.groupsB20b.out[<command>]`, written into the argument record and returned.
//  * Branches the analyst could not read log "<command>: not yet attested: <what> (CMD-B20b)" and change nothing for
//    that branch.
//  * Pieces marked `// inferred` are reasoned from the contract, not read from it.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Cluster, Group, Layer, Partition, Pass, Light, Camera, Constraint, threeOrder } from '../core/scene';
import { ChainRoot, Bone, Effector, makeChain } from '../core/scene2';
import { num, int, str } from '../core/params';
import { curveDomain, evalCurve, type V3 } from '../core/curves';
import { SiStatusError } from './alembicSeqCam';
import { resolve } from './selectionGroupLayer';
import { mapCluster } from './clusters';
import { isLocked } from './inferredB10Scene';
import { b19b } from './tasksB19b';
import { simEnvironment } from './duplicateRenderingSimulationScriptsSimulation';
import { b15d } from './clipsSourcesB15dShared';
import * as T from './selectionGroupLayerTopology';

export const ROW = 'CMD-B20b';
export const S_OK = 0, S_FALSE = 1, SI_NEUTRAL = 0x562e80c7, SI_NOTHING = 0x562e80d2;
export const E_FAIL = 0x80004005, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002, E_UNEXPECTED = 0x8000ffff;
export const E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005, DISP_E_TYPEMISMATCH = 0x80020005, DISP_E_PARAMNOTFOUND = 0x80020008;

// ------------------------------------------------------------------ state
export interface B20bState {
  status: Record<string, number>;
  calls: { cmd: string; args: any[] }[];
  out: Record<string, Record<string, any>>;
}
export function b20b(app: App): B20bState {
  const A = app as any;
  return (A.groupsB20b ??= { status: {}, calls: [], out: {} });
}
const call = (app: App, cmd: string, ...args: any[]) => { b20b(app).calls.push({ cmd, args }); };
const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
const setStatus = (app: App, cmd: string, s: number) => { b20b(app).status[cmd] = s; return s; };
const setOut = (app: App, cmd: string, o: Record<string, any>) => { b20b(app).out[cmd] = o; };
export const logNya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
/** A dictionary message: severity 2 = warning, 4 = info, else error (texts not decoded, open question 3). */
function message(app: App, sev: number, dict: string, id: number, text: string) {
  const head = sev === 2 ? 'WARNING' : sev === 4 ? 'INFO' : 'ERROR';
  app.logMsg(sev === 2 || sev === 4 ? 'info' : 'error', `${head} : ${text} (${dict} 0x${id.toString(16)}, text not decoded)`);
}

const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const bool = (v: any, d = false) => v === undefined || v === null || v === '' ? d : typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;
const dbl = (v: any, d = 0) => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? d : n; };
const uniq = <N>(l: N[]): N[] => [...new Set(l)];
/** Keep run() from auto-inspecting a returned node. */
function noInspect(app: App) { if (!app.autoInspect) return; app.autoInspect = false; queueMicrotask(() => { app.autoInspect = true; }); }

// ------------------------------------------------------------------ argument resolution
function partitionByName(app: App, s: string): Partition | null {
  for (const pass of app.scene.passes) for (const p of pass.partitions) {
    if ([p.name, p.fullName, `${pass.name}.${p.name}`, `Passes.${pass.name}.${p.name}`, `${pass.name}.Partitions.${p.name}`, `Passes.${pass.name}.Partitions.${p.name}`].includes(s)) return p;
  }
  return null;
}
function cacheByName(app: App, s: string): Property | null {
  for (const env of b19b(app).environments) for (const c of simEnvironment(env).caches) if (c instanceof Property && (c.name === s || `${env.name}.${c.name}` === s || c.fullName === s)) return c;
  return null;
}
function environmentByName(app: App, s: string): X3DObject | null {
  return b19b(app).environments.find(e => e.name === s || e.fullName === s) ?? null;
}
/** One collection argument as scene nodes; unset = the selection when the argument has the selection-list handler. */
function nodesArg(app: App, v: any, selectionFallback: boolean): Node[] {
  if (unset(v)) return selectionFallback ? [...app.selection] : [];
  const out: Node[] = [];
  const push = (n: Node | null | undefined) => { if (n && !out.includes(n)) out.push(n); };
  for (const x of Array.isArray(v) ? v : [v]) {
    if (x instanceof Node) { push(x); continue; }
    if (typeof x !== 'string') continue;
    for (const tok of x.split(',').map(t => t.trim()).filter(Boolean)) {
      const special = partitionByName(app, tok) ?? cacheByName(app, tok) ?? environmentByName(app, tok);
      if (special) { push(special); continue; }
      for (const n of resolve(app, tok).nodes) push(n);
    }
  }
  return out;
}
const firstNode = (app: App, v: any, selectionFallback = false): Node | null => nodesArg(app, v, selectionFallback)[0] ?? null;

// ------------------------------------------------------------------ group kinds (2.1)
const isLightPartition = (p: Partition) => (p as any).partitionType === 'siLightPartition' || p.name === 'Background_Lights_Partition';
/**
 * Group kind of a group-like node: 3 = ordinary group, 5 / 6 = the two partition kinds (which one is object vs light is
 * not established: here 5 = object partition, 6 = light partition, // inferred). Layers are group-like too, but their
 * kind is not given by the contract: null (they are neither targets nor expanded).
 */
function groupKind(n: Node): number | null {
  if (n instanceof Group) return 3;
  if (n instanceof Partition) return isLightPartition(n) ? 6 : 5;
  return null;
}
const isGroupLike = (n: Node) => n instanceof Group || n instanceof Partition || n instanceof Layer;
const passOf = (app: App, p: Partition): Pass | undefined => app.scene.passes.find(x => x.partitions.includes(p));
/** The partition of `pass` holding `o`: its explicit membership, else the background partition of its class (inferred:
 *  every object sits in a background partition of each pass until it is moved; cameras sit in none). */
function partitionHolding(pass: Pass, o: X3DObject): Partition | null {
  const explicit = pass.partitions.find(p => p.members.has(o)); if (explicit) return explicit;
  if (o instanceof Camera) return null;
  const name = o instanceof Light ? 'Background_Lights_Partition' : 'Background_Objects_Partition';
  return pass.partitions.find(p => p.name === name) ?? null;
}

// ------------------------------------------------------------------ AddToPartition / RemoveFromPartition
interface PartitionArgs { target: Partition | null; objs: Node[] }
/** UnPack of both partition commands: Target as a group (absent is accepted), InputObjs split as in 2.1. */
function splitPartitionArgs(app: App, C: string, a: Record<string, any>): PartitionArgs {
  let target: Partition | null = null;
  if (!unset(a.Target)) {
    const t = firstNode(app, a.Target);
    if (!t) throw fail(C, E_INVALIDARG, `Target "${a.Target?.name ?? a.Target}" does not resolve`);   // inferred status
    const k = groupKind(t);
    if (k === null) throw fail(C, isGroupLike(t) ? E_INVALIDARG : E_NOINTERFACE, `${t.name} is not a partition`);
    if (k !== 5 && k !== 6) throw fail(C, E_INVALIDARG, `${t.name} is not a partition (group kind ${k})`);
    target = t as Partition;
  }
  const objs: Node[] = [];
  for (const n of nodesArg(app, a.InputObjs, true)) {
    const k = groupKind(n);
    if (k !== null && k >= 4 && k <= 6) { if (!target) target = n as Partition; continue; }   // implicit target (first one only)
    if (k === 3) { for (const m of (n as Group).members) if (!objs.includes(m)) objs.push(m); continue; }   // ordinary group: its members
    if (n instanceof X3DObject) { if (!objs.includes(n)) objs.push(n); continue; }
    // other items are ignored
  }
  return { target, objs };
}
function addToPartition(app: App, a: Record<string, any>) {
  const C = 'AddToPartition';
  const { target, objs } = splitPartitionArgs(app, C, a);
  if (!target) throw fail(C, E_INVALIDARG, 'no Target partition (given or in InputObjs)');
  const pass = passOf(app, target);
  if (!pass) throw fail(C, E_INVALIDARG, `${target.name} belongs to no pass`);   // inferred
  if (objs.some(o => !(o instanceof X3DObject))) throw fail(C, E_INVALIDARG, 'an input item is not an object');
  const list = objs as X3DObject[];
  const sources = uniq(list.map(o => partitionHolding(pass, o)));
  if (!list.length || sources.length !== 1 || !sources[0]) {
    message(app, 2, 'XSIGROUPTASKS', 0x93, `${C}: the objects do not come from one partition of ${pass.name}`);
    throw fail(C, E_INVALIDARG, `the objects do not come from one partition of ${pass.name} (message 0x93)`);
  }
  const source = sources[0];
  // a move: out of the source partition, into the Target (inferred: partitions of a pass are exclusive)
  const before = new Map(pass.partitions.map(p => [p, new Set(p.members)] as const));
  app.record(C, () => { for (const o of list) { source.members.delete(o); target.members.add(o); } },
    () => { for (const [p, m] of before) { p.members.clear(); for (const o of m) p.members.add(o); } });
  setOut(app, C, { objects: [...list], source, target });
  setStatus(app, C, S_OK);
  return target;
}
function removeFromPartition(app: App, a: Record<string, any>) {
  const C = 'RemoveFromPartition';
  let { target, objs } = splitPartitionArgs(app, C, a);
  const list = objs.filter((o): o is X3DObject => o instanceof X3DObject);
  if (!target) {
    // derived from the objects: the partition (explicit membership) holding the first object // inferred: the helper's rule
    for (const pass of app.scene.passes) { const p = pass.partitions.find(q => list.length && q.members.has(list[0])); if (p) { target = p; break; } }
    if (!target) throw fail(C, E_INVALIDARG, 'no partition given, found in InputObjs or holding the objects');
  }
  const part = target;
  const gone = list.filter(o => part.members.has(o));
  logNya(app, C, 'where the removed objects go; in this build they fall back to the background partition of the pass');
  if (gone.length) app.record(C, () => { for (const o of gone) part.members.delete(o); }, () => { for (const o of gone) part.members.add(o); });
  setOut(app, C, { objects: gone, partition: part });
  setStatus(app, C, S_OK);
  return part;
}

// ------------------------------------------------------------------ groups
const groupsHolding = (app: App, o: X3DObject) => app.scene.groupList.filter(g => g.members.includes(o));
function addMembers(app: App, g: Group, objs: X3DObject[]): X3DObject[] {
  const added = uniq(objs).filter(o => !g.members.includes(o)); if (!added.length) return added;
  app.record('Add to Group', () => { g.members.push(...added); }, () => { for (const o of added) { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); } });
  return added;
}
function removeMembers(app: App, g: Group, objs: X3DObject[]): X3DObject[] {
  const before = [...g.members]; const gone = before.filter(o => objs.includes(o)); if (!gone.length) return gone;
  app.record('Remove from Group', () => { g.members.splice(0, g.members.length, ...before.filter(o => !gone.includes(o))); }, () => { g.members.splice(0, g.members.length, ...before); });
  return gone;
}
/** Target given as an ordinary (kind-3) group, else null when absent. */
function givenGroup(app: App, C: string, v: any): Group | null {
  if (unset(v)) return null;
  const t = firstNode(app, v);
  if (!t) throw fail(C, E_INVALIDARG, `Target "${v?.name ?? v}" does not resolve`);   // inferred status
  if (!isGroupLike(t)) throw fail(C, E_UNEXPECTED, `${t.name} is not a group`);   // a group without kind interface
  if (groupKind(t) !== 3) throw fail(C, E_INVALIDARG, `${t.name} is not an ordinary group`);   // inferred status: filter kind 3
  return t as Group;
}
function siAddToGroupLowLevel(app: App, a: Record<string, any>) {
  const C = 'SIAddToGroupLowLevel';
  let target = givenGroup(app, C, a.Target);
  const members: X3DObject[] = [];
  // InputObjs (vt 9, no selection handler): the first kind-3 group is the target when none is given; other groups skipped
  for (const n of nodesArg(app, a.InputObjs, false)) {
    if (isGroupLike(n)) { if (!target && groupKind(n) === 3) target = n as Group; continue; }
    if (n instanceof X3DObject && n !== app.scene.root && !members.includes(n)) members.push(n);
  }
  if (!target) { setStatus(app, C, S_FALSE); return undefined; }   // not applicable: no target found
  const added = addMembers(app, target, members);
  // the add and the OutputObj value come from an imported base class (open question 1)
  logNya(app, C, 'the OutputObj value (imported base class); the members added are returned');
  a.OutputObj = added; setOut(app, C, { Target: target, OutputObj: added });
  setStatus(app, C, S_OK);
  return added;
}
function siRemoveFromGroup(app: App, a: Record<string, any>) {
  const C = 'SIRemoveFromGroup';
  let target = givenGroup(app, C, a.Target);
  const members: X3DObject[] = [];
  for (const n of nodesArg(app, a.InputObjs, true)) {
    if (isGroupLike(n)) { if (!target && groupKind(n) === 3) target = n as Group; continue; }
    if (n instanceof X3DObject && !members.includes(n)) members.push(n);
  }
  if (!target && members.length) {
    // the kind-3 group holding the first member; any member in another group (or none) -> no target
    // inferred: "the group holding a member" = its first group in the scene's group list
    const cand = groupsHolding(app, members[0])[0] ?? null;
    if (cand && members.every(o => groupsHolding(app, o)[0] === cand)) target = cand;
  }
  if (!target) { setStatus(app, C, S_FALSE); return 0; }   // no target: the command does nothing
  const gone = removeMembers(app, target, members);
  setOut(app, C, { Target: target, removed: gone });
  setStatus(app, C, S_OK);
  return gone.length;
}
function uniqueGroupName(app: App, base: string): string {
  const taken = new Set<string>(app.scene.groupList.map(g => g.name));
  let name = app.scene.uniqueName(base); if (!taken.has(name)) return name;
  for (let i = 1; ; i++) { name = `${base}${i}`; if (!taken.has(name) && app.scene.uniqueName(name) === name) return name; }
}
/** Container slot 21: the container refuses groups. inferred: a referenced model (its structure comes from the file). */
const refusesGroups = (m: Model) => !!(m as any).ref || (m as any).refusesGroups === true;
function siCreateGroup(app: App, a: Record<string, any>) {
  const C = 'SICreateGroup';
  if (a.Name !== undefined && a.Name !== null && typeof a.Name !== 'string') throw fail(C, E_INVALIDARG, 'Name must be a string');
  const p = unset(a.Parent) ? null : firstNode(app, a.Parent);
  const container: Model = p instanceof Model ? p : app.scene.root;   // missing / not a container: the current scene model
  if (refusesGroups(container)) {
    message(app, 2, 'XSIGROUPTASKS', 11, `${C}: ${container.name} does not accept groups`);
    setStatus(app, C, S_FALSE); a.Value = null; return undefined;
  }
  const name = typeof a.Name === 'string' && a.Name ? a.Name : 'Group';   // empty: the container's default naming // inferred
  const g = new Group(uniqueGroupName(app, name)); g.parent = container;
  // the group flag at kind-interface slot 12 (set to 1) has no counterpart in this build's Group
  const list = app.scene.groupList;
  app.record(C, () => { if (!list.includes(g)) list.push(g); }, () => { const i = list.indexOf(g); if (i >= 0) list.splice(i, 1); app.selection = app.selection.filter(n => n !== g); });
  a.Value = g; setOut(app, C, { Value: g });
  setStatus(app, C, S_OK); noInspect(app);
  return g;
}
function addGroup(app: App, a: Record<string, any>) {
  const C = 'AddGroup';
  if (unset(a.Target)) { logNya(app, C, 'AddGroup without a Target container (the argument handler is not traced); nothing moved'); setStatus(app, C, S_FALSE); return undefined; }
  const t = firstNode(app, a.Target);
  if (!(t instanceof Model)) throw fail(C, E_NOINTERFACE, `Target "${a.Target?.name ?? a.Target}" is not a group container`);   // inferred status
  if (isLocked(app, t, 0xffff)) { app.logMsg('error', `${C}: ${t.name} is locked`); throw fail(C, E_ACCESSDENIED, `${t.name} is locked`); }
  const items = nodesArg(app, a.InputObjs, true);
  if (!items.length) throw fail(C, E_FAIL, 'the InputObjs list is empty');
  const groups: Group[] = [];
  for (const n of items) {
    if (!isGroupLike(n)) continue;   // only group-like (kind 8) items are tested
    // movable into the Target: inferred = an ordinary group that is not locked (layers / partitions belong to the scene)
    if (n instanceof Group && !isLocked(app, n, 0xffff)) { groups.push(n); continue; }
    message(app, 4, 'XSIGROUPTASKS', 0x34, `${C}: ${n.fullName} cannot be moved to ${t.name}`);
  }
  if (!groups.length) { setStatus(app, C, SI_NOTHING); return undefined; }   // nothing left: no-op
  const prev = groups.map(g => g.parent);
  app.record(C, () => { for (const g of groups) g.parent = t; }, () => { groups.forEach((g, i) => { g.parent = prev[i]; }); });
  setOut(app, C, { Target: t, groups: [...groups], from: prev });
  setStatus(app, C, S_OK);
  return undefined;
}

// ------------------------------------------------------------------ environments
const isEnvironment = (n: unknown): n is X3DObject => n instanceof X3DObject && (!!n.get('simenv') || !!(n as any).simulationEnvironment);
function setCurrentEnvironment(app: App, a: Record<string, any>) {
  const C = 'SetCurrentEnvironment';
  const first = firstNode(app, a.InputObj, true);
  if (first && !isEnvironment(first)) throw fail(C, E_NOINTERFACE, `${first.name} is not a simulation environment`);
  if (!first) throw fail(C, E_POINTER, 'no environment');
  const env = first;
  // the environment container (F3DGetEnvironmentContainer): its current environment (slot 3), set (slot 4)
  const s = app.scene as any; const prev = s.currentEnvironment ?? null;
  app.record(C, () => { s.currentEnvironment = env; }, () => { s.currentEnvironment = prev; });
  setOut(app, C, { environment: env, previous: prev });
  setStatus(app, C, S_OK);
  return env;
}
/** A cached item of an environment cache (24-word records in the binary; not modelled: a record list on the cache). */
interface CacheItem { name: string; type?: number; file?: string; start?: number; count?: number }
function siStoreEnvironmentCacheToMixer(app: App, a: Record<string, any>) {
  const C = 'SIStoreEnvironmentCacheToMixer';
  const cache = firstNode(app, a.EnvironmentCache);
  if (!(cache instanceof Property) || cache.type !== 'EnvironmentCache') throw fail(C, E_NOINTERFACE, `${cache?.name ?? 'EnvironmentCache'} is not an environment cache`);
  if (a.Name !== undefined && a.Name !== null && typeof a.Name !== 'string') throw fail(C, E_INVALIDARG, 'Name must be a string');
  const addClip = bool(a.AddClip, false);
  const fullName = cache.fullName;
  // the environment item among the cache's children (this build keeps the environment on the cache record)
  const env: Node | null = (cache as any).environment ?? null;
  if (!env) logNya(app, C, 'a cache without an environment item; no time range is read');
  const model: Model = (cache as any).model instanceof Model ? (cache as any).model : (cache as any).model?.model ?? app.scene.root;
  const name = typeof a.Name === 'string' && a.Name ? a.Name : 'SimulationRun';
  // simulation time range from the environment's time-control property (kind 6)
  const tc = env instanceof X3DObject ? env.properties.find(p => /timecontrol/i.test(p.type)) : undefined;
  let start = app.anim.startFrame, end = app.anim.endFrame;
  if (tc) { start = dbl(tc.val('StartFrame') ?? tc.val('start'), start); end = dbl(tc.val('EndFrame') ?? tc.val('end'), end); }
  else logNya(app, C, 'the environment time-control property is not modelled; the scene play range is used');
  const fps = app.anim.fps || 30;
  // inferred parameter names: the action's start / end, stored in seconds as the contract says
  const action = new Property(name, 'actionsource', [num('StartTime', start / fps, 'Start'), num('EndTime', end / fps, 'End'), int('items', 0, 'Items', { readOnly: true }), str('cache', fullName, 'Cache', { readOnly: true })]);
  (action as any).fileCacheItems = [] as { target: string; file: string }[];
  const items: CacheItem[] = Array.isArray((cache as any).items) ? (cache as any).items : [];
  const tmpl = b15d(app).cacheTemplate || '[model]_[object]';
  const kept: { target: string; file: string }[] = [];
  for (const it of items) {
    const target = `${model.name}.${it.name}`;
    let file = it.file ?? '';
    if (it.type === 0x15 && !file) {
      logNya(app, C, 'the file-name template helper (tokens beyond object / model / version); the cache template preference is used');
      file = tmpl.replace(/\[object\]/gi, it.name).replace(/\[model\]/gi, model.name).replace(/\[version\]/gi, '1');   // inferred version
      if (!file.includes('#')) file += '.#';   // inferred: a frame token where the template has none
    }
    if (file.includes('#')) { const s0 = Math.trunc(it.start ?? start); file = file.replace('#', `[${s0}..${s0 + Math.trunc(it.count ?? (end - start))}]`); }
    if (!file) continue;   // the item's AddFileCacheSource fails: removed from the action
    call(app, 'AddFileCacheSource', action.name, target, file);
    kept.push({ target, file });
  }
  const stored = kept.length > 0;
  if (stored) {
    const list = (action as any).fileCacheItems as { target: string; file: string }[];
    app.record(C, () => { list.splice(0, list.length, ...kept); action.set('items', kept.length); model.addProperty(action); },
      () => { model.removeProperty(action); list.length = 0; });
    if (addClip) {
      call(app, 'AddClip', action.name, start, 1.0);
      try { app.run('AddClip', { Source: action.name, Time: start, Name: action.name }); }
      catch (e: any) { logNya(app, C, `the AddClip sub-task on ${model.name} (${e?.message ?? e})`); }
      logNya(app, C, 'when the time control asks for the SetValue sub-task (type 0x402, id 5, false) that switches the live simulation off');
    }
  } else logNya(app, C, 'nothing stored: the cache has no item this build can turn into a file-cache source');
  a.Action = action; a.EnvironmentCache = cache;
  setOut(app, C, { EnvironmentCache: cache, Action: action, stored });
  setStatus(app, C, S_OK); noInspect(app);
  return action;
}

// ------------------------------------------------------------------ MoveJoint
function chainOf(n: Node | null): { root: ChainRoot; index: number } | null {
  if (!(n instanceof X3DObject)) return null;
  let r: X3DObject | null = n;
  while (r && !(r instanceof ChainRoot)) r = r.parentObj;
  if (!(r instanceof ChainRoot)) return null;
  if (n === r) return { root: r, index: 0 };
  const bi = r.bones.indexOf(n as Bone); if (bi >= 0) return { root: r, index: bi };
  if (n === r.effector || n instanceof Effector) return { root: r, index: r.bones.length };
  return null;
}
const KEYS = ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'];
function chainSnapshot(root: ChainRoot) {
  const nodes: X3DObject[] = [root, ...root.bones, ...(root.effector ? [root.effector] : [])];
  return nodes.map(o => ({ o, v: KEYS.map(k => o.kinematics.local.val(k)), len: o instanceof Bone ? o.val('length') : null }));
}
function chainRestore(s: ReturnType<typeof chainSnapshot>) {
  for (const { o, v, len } of s) { KEYS.forEach((k, i) => o.kinematics.local.set(k, v[i])); if (len !== null) o.set('length', len); }
}
const gpos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());
/** Global joint positions: root, the start of every bone after the first, the chain end. */
function jointPositions(root: ChainRoot): THREE.Vector3[] {
  const P = [gpos(root)];
  for (let i = 1; i < root.bones.length; i++) P.push(gpos(root.bones[i]));
  P.push(root.bones.length ? root.chainEnd() : gpos(root));
  return P;
}
/** Re-place a chain through the global joint positions P (bone lengths and orientations follow). */
function placeChain(root: ChainRoot, P: THREE.Vector3[]) {
  const parentInv = root.parentObj ? root.parentObj.globalMatrix().invert() : new THREE.Matrix4();
  const lp = P[0].clone().applyMatrix4(parentInv); const L = root.kinematics.local;
  L.set('posx', lp.x); L.set('posy', lp.y); L.set('posz', lp.z);
  let prevG = root.globalMatrix(); let last = 0;
  root.bones.forEach((bone, i) => {
    const d = P[i + 1].clone().sub(P[i]); const len = Math.max(0.01, d.length());
    const dir = d.lengthSq() > 1e-18 ? d.normalize() : new THREE.Vector3(1, 0, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    const pp = new THREE.Vector3(), pq = new THREE.Quaternion(), ps = new THREE.Vector3(); prevG.decompose(pp, pq, ps);
    const local = pq.clone().invert().multiply(q);
    const e = new THREE.Euler().setFromQuaternion(local, threeOrder(bone.kinematics.local.val('rotorder')));
    const l = bone.kinematics.local;
    l.set('rotx', e.x * 180 / Math.PI); l.set('roty', e.y * 180 / Math.PI); l.set('rotz', e.z * 180 / Math.PI);
    l.set('posx', i > 0 ? root.bones[i - 1].val('length') : 0); l.set('posy', 0); l.set('posz', 0);
    bone.set('length', len); last = len; prevG = bone.globalMatrix();
  });
  if (root.effector && root.bones.length) { const l = root.effector.kinematics.local; l.set('posx', last); l.set('posy', 0); l.set('posz', 0); }
}
function moveJoint(app: App, a: Record<string, any>) {
  const C = 'MoveJoint';
  const el = chainOf(firstNode(app, a.InputObjs, true));
  if (!el) throw fail(C, E_INVALIDARG, 'InputObjs does not resolve to a chain element');   // inferred status (helper failure)
  const X = dbl(a.X), Y = dbl(a.Y), Z = dbl(a.Z);
  const branch = bool(a.MoveJointBranch), boneFlag = bool(a.MoveJointBone);
  const { root, index } = el;
  const model = root.model;
  if (model && (model as any).ref && isLocked(app, model, 0xffff)) { app.logMsg('error', `${C}: ${model.name} is a locked referenced model`); throw fail(C, E_ACCESSDENIED, `${model.name} is a locked referenced model`); }   // inferred lock test
  if (isLocked(app, root, 0xffff)) { app.logMsg('error', `${C}: ${root.name} is locked`); throw fail(C, E_ACCESSDENIED, `${root.name} is locked`); }
  const before = chainSnapshot(root);   // worker slot 10: the pre-move snapshot
  const P = jointPositions(root); const to = new THREE.Vector3(X, Y, Z); const delta = to.clone().sub(P[index]);
  // flag meanings are inferred (open question 5): Branch = the downstream joints follow rigidly; Bone = the bone that
  // starts at the joint moves rigidly (its length is kept, its neighbours stretch). Branch wins when both are set.
  const moved = branch ? P.map((_, i) => i >= index) : boneFlag ? P.map((_, i) => i === index || i === index + 1) : P.map((_, i) => i === index);
  const Q = P.map((p, i) => moved[i] ? p.clone().add(delta) : p.clone());
  placeChain(root, Q);
  const after = chainSnapshot(root);
  chainRestore(before);
  app.record(C, () => chainRestore(after), () => chainRestore(before));
  setOut(app, C, { element: [root, ...root.bones, root.effector][index], position: [X, Y, Z], branch, bone: boneFlag });
  setStatus(app, C, S_OK);
  return undefined;
}

// ------------------------------------------------------------------ SICreateSkeleton
function siCreateSkeleton(app: App, a: Record<string, any>): ChainRoot | undefined {
  const C = 'SICreateSkeleton';
  const type = Math.trunc(dbl(a.SkeletonType, 2));
  const mode = type === 2 ? 1 : 2;   // builder mode
  const viewType = type === 2 ? Math.trunc(dbl(a.ViewType, 3)) : -1;   // ViewType is read only for SkeletonType 2
  const R: V3 = [dbl(a.Rx), dbl(a.Ry), dbl(a.Rz)], E: V3 = [dbl(a.Ex, 1), dbl(a.Ey), dbl(a.Ez)], N: V3 = [dbl(a.Nx), dbl(a.Ny), dbl(a.Nz, 1)];
  const align = bool(a.AlignRootToFirstBone);
  // inferred guard: the builder needs a bone of some length
  if (Math.hypot(E[0] - R[0], E[1] - R[1], E[2] - R[2]) < 1e-9) throw fail(C, E_INVALIDARG, 'the root and the effector are at the same position');
  logNya(app, C, 'the chain builder (bone orientation from the normal and the view type, root alignment); the bone points from R to E');
  const root = makeChain(app.scene.uniqueName('root'), [R, E], mode === 1);
  (root as any).chainKind = mode === 1 ? 2 : 3;   // read by SIAppendBone (2D vs 3D chain)
  (root as any).chainNormal = N; (root as any).builder = { mode, viewType, align };
  if (align) {
    const b = root.bones[0]; const rl = root.kinematics.local, bl = b.kinematics.local;
    for (const ax of ['x', 'y', 'z']) { rl.set('rot' + ax, bl.val('rot' + ax)); bl.set('rot' + ax, 0); }
  }
  app.record('Add ' + root.name, () => app.scene.root.addChild(root), () => app.scene.root.removeChild(root));
  const bone = root.bones[0] ?? null, eff = root.effector ?? null;
  if (root) a.Value = root; if (bone) a.Bone = bone; if (eff) a.Effector = eff;
  setOut(app, C, { Value: root, Bone: bone, Effector: eff, mode, viewType });
  setStatus(app, C, S_OK);
  return root;
}

// ------------------------------------------------------------------ vertex colours
const meshOf = (o: X3DObject | null | undefined) => o?.primitive?.mesh() ?? null;
function ownerObject(n: Node | null): X3DObject | null {
  let x: any = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null;
}
function createVertexColorSupport(app: App, a: Record<string, any>) {
  const C = 'CreateVertexColorSupport';
  // PresetObj is not read
  const base = typeof a.PropertyName === 'string' && a.PropertyName ? a.PropertyName : 'Vertex_Color';
  const items = nodesArg(app, a.InputObjs, true);
  if (!items.length) { setStatus(app, C, S_FALSE); return undefined; }   // nothing done
  const objs = uniq(items.map(n => n instanceof X3DObject ? n : null).filter((o): o is X3DObject => !!o && !!meshOf(o)));
  // a unique property name over the objects (inferred rule: base, base1, base2, ...)
  const taken = new Set(objs.flatMap(o => o.allProperties().map(p => p.name)));
  let name = base; for (let i = 1; taken.has(name); i++) name = `${base}${i}`;
  const created: Property[] = [];
  for (const o of objs) {
    const p = new Property(name, 'vertexcolor', [num('min', 0, 'Minimum', { readOnly: true }), num('max', 1, 'Maximum', { readOnly: true })]);
    (p as any).values = new Map<number, V3>(); (p as any).nodeColors = new Map<number, number[]>();
    const cl = mapCluster(app, o, 'sample');
    app.record(C, () => cl.addProperty(p), () => cl.removeProperty(p));
    created.push(p);
  }
  if (!created.length) throw fail(C, DISP_E_TYPEMISMATCH, 'no colour-at-vertices property could be created (no geometric object)');
  a.PropertyName = name; a.Value = created;
  setOut(app, C, { PropertyName: name, Value: created });
  setStatus(app, C, S_OK); noInspect(app);
  return created;
}
const vcOf = (o: X3DObject) => o.allProperties().find(p => p.type === 'vertexcolor') ?? null;
/** The point index of each polynode (the polygons' vertex lists, in order). */
const nodePoints = (o: X3DObject): number[] => (meshOf(o)?.polygons ?? []).flatMap(f => [...f]);
function colorList(v: any): number[][] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(Number) : [];
  if (arr.length && Array.isArray(arr[0])) return arr.map((c: any) => c.map(Number));
  const out: number[][] = []; for (let i = 0; i + 4 <= arr.length; i += 4) out.push(arr.slice(i, i + 4).map(Number));   // inferred: a flat RGBA array, four values per node
  return out;
}
function paintVertexColors(app: App, a: Record<string, any>) {
  const C = 'PaintVertexColors';
  const first = firstNode(app, a.InputObj, true);
  let prop: Property | null = null, obj: X3DObject | null = null;
  if (first instanceof Property && first.type === 'vertexcolor') { prop = first; obj = ownerObject(first); }
  else if (first instanceof Cluster) { obj = first.obj; prop = first.property('vertexcolor') ?? null; }
  else if (first instanceof X3DObject) { obj = first; prop = vcOf(first); }   // inferred: the object's (first) colour property is the current one
  if (!obj) throw fail(C, E_INVALIDARG, 'InputObj is not a colour property, cluster or object');   // inferred status
  const nodes = (Array.isArray(a.Polynodes) ? a.Polynodes : typeof a.Polynodes === 'string' && a.Polynodes ? a.Polynodes.split(',') : []).map(Number);
  const colors = colorList(a.Colors);
  if (!nodes.length || !colors.length) throw fail(C, E_INVALIDARG, 'Polynodes and Colors must not be empty');
  const mode = Math.trunc(dbl(a.Mode, 0));
  const target = obj;
  if (!prop) {
    call(app, 'CreateVertexColorSupport', 'Vertex_Color', target.name);
    const r = app.run('CreateVertexColorSupport', { PropertyName: 'Vertex_Color', InputObjs: [target] });
    prop = Array.isArray(r) ? r[0] ?? null : null;
    if (!prop) throw fail(C, E_FAIL, 'no Vertex_Color property could be created');   // inferred
  }
  if (mode !== 0 && mode !== 1) {
    // any other Mode: sub-tasks undone and cleared, nothing painted (the nested CreateVertexColorSupport rolls back
    // with the failing command)
    throw fail(C, E_INVALIDARG, `Mode ${mode} paints nothing`);   // inferred: the status of this branch is not given
  }
  if (mode === 1) logNya(app, C, 'the Mode 1 array layout; the colours are read as for Mode 0 (one RGBA per polynode)');
  const p = prop as any;
  if (!p.values) p.values = new Map(); if (!p.nodeColors) p.nodeColors = new Map();
  const values: Map<number, any> = p.values, nodeColors: Map<number, number[]> = p.nodeColors;
  const before = { values: new Map(values), nodes: new Map(nodeColors) };
  const pts = nodePoints(target);
  const after = { values: new Map(values), nodes: new Map(nodeColors) };
  let skipped = 0;
  nodes.forEach((n, i) => {
    const c = colors[Math.min(i, colors.length - 1)];
    if (!Number.isInteger(n) || n < 0 || n >= pts.length) { skipped++; return; }
    const rgba = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 1];   // weight 1.0: the colour replaces the old one
    after.nodes.set(n, rgba); after.values.set(pts[n], [rgba[0], rgba[1], rgba[2]]);
  });
  if (skipped) logNya(app, C, `${skipped} polynode index(es) outside the geometry; skipped`);
  const set = (s: typeof before) => { values.clear(); for (const [k, v] of s.values) values.set(k, v); nodeColors.clear(); for (const [k, v] of s.nodes) nodeColors.set(k, v); };
  app.record(C, () => set(after), () => set(before));
  setOut(app, C, { OutputObj: prop });
  a.OutputObj = prop; setStatus(app, C, S_OK); noInspect(app);
  return prop;
}

// ------------------------------------------------------------------ CopyCluster
function componentCount(o: X3DObject, kind: Cluster['compKind']): number {
  const m = meshOf(o); if (!m) return 0;
  if (kind === 'pnt') return m.positions.length / 3;
  if (kind === 'poly') return m.polygons.length;
  if (kind === 'sample') return m.polygons.reduce((s, f) => s + f.length, 0);
  return T.adjacencyOf(m).edges.length;
}
/** Element indices of a cluster (edge clusters of this build may hold "a-b" keys). */
function elementIndices(c: Cluster): number[] {
  const o = c.obj; const m = meshOf(o);
  return [...c.elements].map(e => typeof e === 'number' ? e : m ? T.adjacencyOf(m).edgeIndex.get(String(e)) ?? -1 : -1);
}
function copyCluster(app: App, a: Record<string, any>) {
  const C = 'CopyCluster';
  const src = firstNode(app, a.Cluster);
  if (!(src instanceof Cluster)) throw fail(C, E_NOINTERFACE, `${src?.name ?? 'Cluster'} is not a cluster`);
  const idx = elementIndices(src);
  const usesKeys = [...src.elements].some(e => typeof e === 'string');
  const out: Cluster[] = [];
  for (const n of nodesArg(app, a.Target, true)) {
    // the target's 3D object: directly, through its primitive, or through an owner
    const o = ownerObject(n);
    if (!o) continue;
    if (!meshOf(o)) { message(app, 2, 'siclustertasks', 0x62, `${C}: ${o.name} does not support ${src.compKind} clusters`); throw fail(C, E_FAIL, `${o.name} does not support the cluster type (message 0x62)`); }
    const count = componentCount(o, src.compKind);
    if (count < idx.length || idx.some(i => i < 0 || i >= count)) { message(app, 2, 'siclustertasks', 0x61, `${C}: ${o.name} has too few components for ${src.name}`); throw fail(C, E_FAIL, `${o.name}: cluster index out of range (message 0x61)`); }
    let name = src.name; for (let i = 1; o.clusters.some(c => c.name === name); i++) name = `${src.name}${i}`;   // inferred naming
    const edges = usesKeys ? T.adjacencyOf(meshOf(o)!).edges : null;
    const copy = new Cluster(name, src.compKind, new Set(idx.map(i => edges ? edges[i] : i)));
    (copy as any).copyFlag = 3;   // the flag at slot 0x130 (meaning not decoded)
    call(app, 'CreateClusterFromSubComponent', o.name, src.compKind, idx);
    app.record('CreateClusterFromSubComponent', () => o.addCluster(copy), () => o.removeCluster(copy));
    out.push(copy);
  }
  setOut(app, C, { Value: out });
  setStatus(app, C, S_OK); noInspect(app);
  return out;
}

// ------------------------------------------------------------------ SaveKeyOnPath
function pathCns(o: X3DObject): Constraint | null {
  return (o.properties.find(p => p instanceof Constraint && p.type === 'poscns' && !!p.get('perc') && !!(p as Constraint).targets[0]?.primitive?.curve?.()) as Constraint | undefined) ?? null;
}
/** Path percentage closest to a global position (sampled, then refined). */
function percAt(c: Constraint, at: THREE.Vector3): number {
  const crv = c.targets[0]; const cd = crv.primitive!.curve!()!; const [u0, u1] = curveDomain(cd); const M = crv.globalMatrix();
  const off = new THREE.Vector3(dbl(c.val('offsetx')), dbl(c.val('offsety')), dbl(c.val('offsetz')));
  const d = (pc: number) => { const p = evalCurve(cd, u0 + (u1 - u0) * pc / 100); return new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(M).add(off).distanceToSquared(at); };
  let best = 0, bd = Infinity; for (let i = 0; i <= 200; i++) { const pc = i / 2; const x = d(pc); if (x < bd) { bd = x; best = pc; } }
  let lo = Math.max(0, best - 0.5), hi = Math.min(100, best + 0.5);
  for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (d(m1) < d(m2)) hi = m2; else lo = m1; }
  return (lo + hi) / 2;
}
function saveKeyOnPath(C: string) {
  return (app: App, a: Record<string, any>) => {
    const objs = nodesArg(app, a.InputObj, true).filter((n): n is X3DObject => n instanceof X3DObject);
    if (unset(a.Time) || !Number.isFinite(Number(a.Time))) throw fail(C, DISP_E_PARAMNOTFOUND, 'Time is required (frames)');
    const frame = Number(a.Time); const seconds = frame / (app.anim.fps || 30);
    const given = (['X', 'Y', 'Z'] as const).map(k => unset(a[k]) ? null : dbl(a[k]));
    const flags = given.reduce<number>((f, v, i) => v === null ? f : f | (1 << i), 0);   // bits 1 / 2 / 4 = X / Y / Z given
    const locked = bool(a.Locked, C !== 'SaveKeyOnPath');
    const keyed: X3DObject[] = [];
    for (const o of objs) {
      const c = pathCns(o);
      if (!c) { logNya(app, C, `${o.name} has no path constraint; no key task`); continue; }   // the key task fails: not recorded
      const perc = c.get('perc')!;
      let value = Number(perc.value);
      if (flags) {
        const cur = gpos(o);
        const at = new THREE.Vector3(given[0] ?? cur.x, given[1] ?? cur.y, given[2] ?? cur.z);   // inferred: missing axes keep the current position
        value = percAt(c, at);
      }
      // inferred: the key task writes a path-percentage key at Time, with a locked flag
      const fc = app.anim.fcurve(perc, true)!; const had = fc.keys.find(k => k.time === frame); const old = had ? { ...had } : null;
      call(app, 'PathKeyTask', o.name, seconds, given, locked);
      app.record(C, () => { fc.addKey(frame, value, { locked } as any); },
        () => { if (old) { fc.removeKey(frame); fc.keys.push(old); fc.keys.sort((x, y) => x.time - y.time); } else fc.removeKey(frame); });
      keyed.push(o);
    }
    app.events.emit('params');
    setOut(app, C, { objects: keyed, time: seconds, flags, locked });
    setStatus(app, C, S_OK);
    return keyed.length;
  };
}

// ------------------------------------------------------------------ registration
export function registerGroupsB20bCommands(app: App) {
  const reg = (name: string, label: string, category: string, args: { name: string; default: any }[], execute: (app: App, a: Record<string, any>) => any, description = '') =>
    app.register({ name, label, category, description, args, execute });
  const T0 = { name: 'Target', default: null }, IN = { name: 'InputObjs', default: null };
  reg('AddToPartition', 'Add Object to Partition', 'Group', [T0, IN], addToPartition, 'Add object to partition');
  reg('RemoveFromPartition', 'Remove Object from Partition', 'Group', [T0, IN], removeFromPartition, 'Remove object from partition');
  reg('SIAddToGroupLowLevel', 'Internal Add to Group', 'Group', [T0, IN, { name: 'OutputObj', default: null }], siAddToGroupLowLevel, 'Add an object to a group');
  reg('SIRemoveFromGroup', 'Internal Remove from Group', 'Group', [T0, IN], siRemoveFromGroup, 'Remove the selected members from the group');
  reg('SICreateGroup', 'Group Create', 'Group', [{ name: 'Name', default: '' }, { name: 'Parent', default: null }], siCreateGroup, 'Create a group');
  reg('AddGroup', 'Add groups', 'Group', [T0, IN], addGroup, 'Add a list of groups to a model');
  reg('SetCurrentEnvironment', 'SetCurrentEnvironment', 'Navigation', [{ name: 'InputObj', default: null }], setCurrentEnvironment);
  reg('SIStoreEnvironmentCacheToMixer', 'SIStoreEnvironmentCacheToMixer', 'Simulation', [{ name: 'EnvironmentCache', default: null }, { name: 'Name', default: 'SimulationRun' }, { name: 'AddClip', default: false }], siStoreEnvironmentCacheToMixer);
  reg('MoveJoint', 'Move Joint', 'Animation', [IN, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }, { name: 'MoveJointBranch', default: false }, { name: 'MoveJointBone', default: false }], moveJoint);
  reg('SICreateSkeleton', 'Create a 2D/3D skeleton', 'Animation', [
    { name: 'Rx', default: 0 }, { name: 'Ry', default: 0 }, { name: 'Rz', default: 0 }, { name: 'Ex', default: 1 }, { name: 'Ey', default: 0 }, { name: 'Ez', default: 0 },
    { name: 'Nx', default: 0 }, { name: 'Ny', default: 0 }, { name: 'Nz', default: 1 }, { name: 'ViewType', default: 3 }, { name: 'Bone', default: null }, { name: 'Effector', default: null },
    { name: 'SkeletonType', default: 2 }, { name: 'AlignRootToFirstBone', default: false }], siCreateSkeleton);
  reg('CreateVertexColorSupport', 'Create Vertex Color Support', 'Property|Paint', [{ name: 'PresetObj', default: '{42FC2493-732F-11d2-AC52-00A02485CECB}:ColorAtVertices' }, { name: 'PropertyName', default: 'Vertex_Color' }, IN], createVertexColorSupport, 'Add Color At Vertices Property');
  reg('PaintVertexColors', 'Paint Vertex Color', 'Property|Paint', [{ name: 'InputObj', default: null }, { name: 'Polynodes', default: null }, { name: 'Colors', default: null }, { name: 'Mode', default: 0 }], paintVertexColors, 'Paint Vertex Color');
  reg('CopyCluster', 'Copy Cluster', 'Cluster', [{ name: 'Cluster', default: null }, { name: 'Target', default: null }], copyCluster, 'CopyCluster');
  const PATH = (locked: boolean) => [{ name: 'InputObj', default: null }, { name: 'Time', default: null }, { name: 'X', default: null }, { name: 'Y', default: null }, { name: 'Z', default: null }, { name: 'Locked', default: locked }];
  reg('SaveKeyOnPath', 'Save Key on Path', 'Animation', PATH(false), saveKeyOnPath('SaveKeyOnPath'), 'Save a key at position on path');
  // registry entry 260: same handler and scripting name, Locked defaults to true (display-name entry of this build)
  reg('Save Locked Key on Path', 'Save Locked Key on Path', 'Animation', PATH(true), saveKeyOnPath('Save Locked Key on Path'), 'Save a locked key at position on path');
}
