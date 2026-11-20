// Ledger row CMD-B15c: the legacy (Sparks) particle commands of sparks.dll and forces.dll.
//   ConnectWeightMapToComponent ConnectParticleInitState DisconnectParticleInitState SetParticleInitState
//   UpdateParticleTypeConnections AddParticleEmitter AddParticleObstacle AddParticles SetParticleType CreateParticleType
//   SIAddParticleGoal CreateEventSource AddUserParameter RemoveUserParameter SIAddParticleEvent SetEventObstacle
//   SIAddParticleForce
// Brief: docs/ghidra/cmd-b15c-particles.md (section 3, "Wire contract", including the `(inferred)` parts) and
// docs/re/WIRE_CORRECTIONS_B15.md items 27-29. Parameter lists of the objects these commands create come from
// data/spdl/spdl.json (C3DParType, C3DParEmitter, C3DEventSource, C3DParticleEvent, C3DParticleGoal, C3DParObstacle,
// C3DParticleInitStateProperty, C3DAddParticleOp, C3DWMCnxOp). Original code written from that prose only; no golden.
//
// Mapping onto this build (shared with the CMD-03b particle scripts, src/commands/particleScripts.ts):
//  * Clouds are X3DObjects of type 'cloud'; the simulation operator sits on the cloud primitive. Operator types:
//    Sparks 'ParticlesOp', HyperFlow 'FluidOp', BlowUp 'ExplosionOp', Cloth 'clothop', SoftBody any op type matching
//    /softbody/i. The global particle type container is `particleScripts(app).particleTypes`.
//  * Port groups of the legacy ops are the `connections` record of CMD-03b: group 1 emitters, 3 forces, 4 initial
//    state, 5 particle types, obstacles, and (new here) 6 event sources `eventSources`. Ops without that record
//    (cloth, soft body) keep `portGroups[<n>]` lists.
//  * Elements hung on a particle type or obstacle property (events, goals) go to its `particleElements` list, as in
//    CMD-03b.
//  * Item 28: a command registered twice ("Pick …" string entry + list entry) is one bus command with the list entry's
//    argument list; both registry entries are kept in `app.particlesB15c.entries[<name>]` (same argument names).
//  * Out arguments (Output, OutputObj) are written into the argument record and returned. A non-failing S_FALSE (1) is
//    kept in `app.particlesB15c.status[<command>]` (item 29). Failures throw SiStatusError with the contract's HRESULT;
//    dictionary texts (sparks 0x6f, 0x126; XSIFORCES 0x34) are not in the repo and are logged by id.
//  * Collection arguments whose catalogue default is empty fall back to the selection (inferred: the Collection
//    argument handler); the in/out "empty collection" GUID default does not.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15c)".
import * as THREE from 'three';
import { App, type ArgDef } from '../core/commands';
import { X3DObject, Node, Property, Primitive, Operator, Group, Cluster, Material, Shader, makeDisplay, makeSiShader } from '../core/scene';
import { str, int, num, bool } from '../core/params';
import { particleScripts } from './particleScripts';
import { SiStatusError } from './alembicSeqCam';
import { registerShaderCreationB15Commands } from './particlesB15cShaders';

const ROW = 'CMD-B15c';
const CAT = 'Simulation';
export const S_OK = 0, S_FALSE = 1;
export const E_FAIL = 0x80004005, E_POINTER = 0x80004003, E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff, E_NOINTERFACE = 0x80004002;
const EMPTY_COLLECTION = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
const SPARKS = 'ParticlesOp', HYPERFLOW = 'FluidOp', BLOWUP = 'ExplosionOp', CLOTH = 'clothop';

export interface ParticlesB15cState {
  status: Record<string, number>;
  /** Both registry entries of the twice-registered names (item 28). */
  entries: Record<string, { label: string; args: ArgDef[] }[]>;
  /** UI present (SetParticleInitState asks before replacing an initial state). */
  interactive: boolean;
  hooks: { msgBox?: (text: string, caption: string, flags: number) => number };
  /** What the last "Auto Inspect" sub-command of AddParticleEmitter was handed. */
  lastAutoInspect: Node[] | null;
  /** Message boxes shown (text, answer). */
  boxes: { text: string; answer: number }[];
}
export function particlesB15c(app: App): ParticlesB15cState {
  return ((app as any).particlesB15c ??= { status: {}, entries: {}, interactive: true, hooks: {}, lastAutoInspect: null, boxes: [] } as ParticlesB15cState);
}
const setStatus = (app: App, C: string, s: number) => { particlesB15c(app).status[C] = s; };
const fail = (status: number, what: string) => new SiStatusError(status, what);
/** Raised error with a sparks dictionary id (severity 2 = error). */
function raise(app: App, C: string, status: number, id: number, what: string): SiStatusError {
  app.logMsg('error', `${C}: [sparks 0x${id.toString(16)}] ${what}`);
  return fail(status, `${C}: ${what}`);
}
const nya = (app: App, C: string, what: string) => app.logMsg('info', `${C}: not yet attested: ${what} (${ROW})`);

// ------------------------------------------------------------------ argument resolution

const unset = (v: any) => v === undefined || v === null || v === '' || v === EMPTY_COLLECTION;
function listOf(v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(listOf);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [v];
}
const same = (a: any, b: string) => String(a ?? '').toLowerCase() === b.toLowerCase();
/** A node by object or name / path: particle types, scene objects, clusters, properties (on objects, clusters, types). */
function resolve(app: App, x: any): Node | null {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  const types = particleScripts(app).particleTypes;
  const t = types.find(p => p.name === s || p.fullName === s); if (t) return t;
  const o = app.scene.find(s); if (o) return o;
  const g = app.scene.groupList.find(gr => gr.name === s); if (g) return g;
  const i = s.lastIndexOf('.'); if (i <= 0) return null;
  const head = s.slice(0, i), tail = s.slice(i + 1);
  const owner = resolve(app, head.replace(/\.cls$/, ''));
  if (owner instanceof X3DObject) return owner.cluster(tail) ?? owner.allProperties().find(p => same(p.name, tail) || same(p.type, tail)) ?? null;
  if (owner instanceof Cluster) return owner.properties.find(p => same(p.name, tail) || same(p.type, tail)) ?? null;
  if (owner) return elementsOf(owner).find(p => same(p.name, tail)) ?? null;
  return null;
}
function nodes(app: App, v: any, selectionFallback = false): Node[] {
  if (unset(v)) return selectionFallback && (v === null || v === undefined || v === '') ? [...app.selection] : [];
  const out: Node[] = [];
  for (const x of listOf(v)) { const n = resolve(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
/** Expanded list (groups flattened to their members). */
function expand(list: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of list) for (const m of n instanceof Group ? n.members : [n]) if (!out.includes(m)) out.push(m);
  return out;
}

// ------------------------------------------------------------------ classification

const isCloud = (n: any): n is X3DObject => n instanceof X3DObject && n.type === 'cloud';
const isPType = (n: any): n is Property => n instanceof Property && n.type === 'ParType';
const isEmission = (n: any): n is Property => n instanceof Property && n.type === 'EmissionProp';
const isEvent = (n: any): n is Property => n instanceof Property && n.type === 'ParticleEvent';
const isEventSource = (n: any): n is Property => n instanceof Property && n.type === 'EventSource';
const isObstacle = (n: any): n is Property => n instanceof Property && n.type === 'ObstacleProp';
const isObstExt = (n: any): n is Property => n instanceof Property && n.type === 'ParObstExtSparks';
const isForce = (n: any): n is X3DObject => n instanceof X3DObject && n.get('forcetype') !== undefined;
const isSoftBody = (op: Operator) => /softbody/i.test(op.type);
const opKind = (op: Operator | null | undefined) => op?.type;
const SIM_TYPES = [SPARKS, HYPERFLOW, BLOWUP];
/** Owning 3D object of a node (cloud of a primitive / operator). */
function objectOf(n: Node | null | undefined): X3DObject | null {
  let x: any = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x;
}
function opsOf(o: X3DObject | null | undefined): Operator[] { return o?.primitive?.operators ?? []; }
/** "Find sim op": the first Sparks / HyperFlow / BlowUp operator of the cloud. */
function simOp(o: X3DObject | null | undefined): Operator | null { return opsOf(o).find(op => SIM_TYPES.includes(op.type)) ?? null; }
function findSimOp(app: App, C: string, cloud: X3DObject, sparksOnly = false): Operator {
  const op = simOp(cloud);
  if (!op || (sparksOnly && op.type !== SPARKS)) throw raise(app, C, E_FAIL, 0x6f, `${cloud.name} has no ${sparksOnly ? 'Sparks' : 'simulation'} operator`);
  return op;
}
const allClouds = (app: App) => [...app.scene.allObjects()].filter(isCloud);
const allSimOps = (app: App) => allClouds(app).flatMap(c => opsOf(c).filter(op => SIM_TYPES.includes(op.type)));

// ------------------------------------------------------------------ port groups

export interface Conn { main: Node[]; emitters: Node[]; obstacles: Node[]; forces: Node[]; initialState: Node[]; particleTypes: Node[]; eventSources: Node[]; inputs?: any[] }
type Key = Exclude<keyof Conn, 'inputs'>;
const GROUP_KEY: Record<number, Key> = { 1: 'emitters', 3: 'forces', 4: 'initialState', 5: 'particleTypes', 6: 'eventSources' };
function conn(op: Operator): Conn {
  const c = ((op as any).connections ??= { main: [], emitters: [], obstacles: [], forces: [], initialState: [], particleTypes: [] }) as Conn;
  c.eventSources ??= [];
  return c;
}
/** A port group list of any op: the legacy ops' `connections`, other ops `portGroups[<n>]`. */
function groupOf(op: Operator, key: Key | number): Node[] {
  if (SIM_TYPES.includes(op.type) || (op as any).connections) { const k = typeof key === 'number' ? GROUP_KEY[key] : key; if (k) return conn(op)[k]; }
  const pg = ((op as any).portGroups ??= {}) as Record<string, Node[]>;
  return (pg[String(key)] ??= []);
}
function setGroup(app: App, op: Operator, key: Key | number, list: Node[]) {
  const before = [...groupOf(op, key)], after = [...list];
  if (before.length === after.length && before.every((x, i) => x === after[i])) return;
  app.record('Port group', () => { const g = groupOf(op, key); g.splice(0, g.length, ...after); }, () => { const g = groupOf(op, key); g.splice(0, g.length, ...before); });
}
/** Port-group connect helper: appends what is not connected yet (undoable). */
function connectGroup(app: App, op: Operator, key: Key | number, items: Node[]) { const cur = groupOf(op, key); setGroup(app, op, key, [...cur, ...items.filter(x => !cur.includes(x))]); }

// ------------------------------------------------------------------ element factories (parameters from data/spdl/spdl.json)

function addPropRec(app: App, owner: Node, p: Property) {
  if (owner instanceof X3DObject || owner instanceof Cluster) { const o = owner; app.record('Add ' + p.name, () => { o.addProperty(p); }, () => { o.removeProperty(p); }); return; }
  const list: Property[] = ((owner as any).particleElements ??= []);
  app.record('Add ' + p.name, () => { if (!list.includes(p)) list.push(p); p.parent = owner; }, () => { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); p.parent = null; });
}
function removePropRec(app: App, p: Property) {
  const owner = p.parent as any; if (!owner) return;
  if (owner instanceof X3DObject || owner instanceof Cluster) { const o = owner; app.record('Delete ' + p.name, () => { o.removeProperty(p); }, () => { o.addProperty(p); }); return; }
  const list: Property[] = owner.particleElements ?? []; const i = list.indexOf(p); if (i < 0) return;
  app.record('Delete ' + p.name, () => { list.splice(list.indexOf(p), 1); p.parent = null; }, () => { list.splice(i, 0, p); p.parent = owner; });
}
function elementsOf(n: Node): Property[] { return n instanceof X3DObject ? n.properties : n instanceof Cluster ? n.properties : ((n as any).particleElements ?? []); }
/** The particle type slot (ba486df3) of an emission / event source / event. */
const typeSlot = (h: Node): Property | null => (h as any).parType ?? null;
function setTypeSlot(app: App, h: Property, t: Property | null) {
  const old = typeSlot(h), oldText = h.val('ParType');
  app.record('Set particle type', () => { (h as any).parType = t; if (h.get('ParType')) h.set('ParType', t?.name ?? ''); }, () => { (h as any).parType = old; if (h.get('ParType')) h.set('ParType', oldText); });
}

function newParticleType(app: App, renderType: string): Property {
  const types = particleScripts(app).particleTypes;
  const taken = new Set(types.map(p => p.name));
  let name = 'PType', i = 1; while (taken.has(name)) name = `PType${i++}`;                   // inferred: default name (as CMD-03b)
  const id = types.reduce((m, p) => Math.max(m, Number(p.val('ID')) || 0), 0) + 1;          // inferred: next free ID
  const pt = new Property(name, 'ParType', [
    str('Name', name, 'Name'), int('ID', id, 'Part. Type ID', { readOnly: true }),
    num('Size', 1, 'Size', { min: 0 }), num('SizeVar', 0, 'Var.', { min: 0 }), num('Life', 1, 'Max. Life', { min: 0 }), num('LifeVar', 0, 'Var.', { min: 0 }),
    str('rendertype', renderType, 'Render Type', { readOnly: true }),                          // inferred: where the render type is kept
  ]);
  (pt as any).renderType = renderType;
  return pt;
}
function newEmission(name: string): Property {
  const p = new Property(name, 'EmissionProp', [
    str('Name', name, 'Name'), bool('Mute', false, 'Mute'), str('ParType', '', 'ParType', { readOnly: true }),
    int('Generation', 2, 'Generation', { min: 0, max: 4 }), int('EmissionDir', 0, 'Direction', { min: 0, max: 2 }), bool('Stratified', false, 'Stratified Emission'),
    bool('Randomize', false, 'Randomize Position'), int('SamplingSteps', 1, 'Steps', { min: 1, max: 10 }),
    num('Rate', 50, 'Rate', { min: 0 }), num('Spread', 0, 'Spread', { min: 0, max: 180 }), num('Speed', 5, 'Speed', { min: 0, max: 100000 }), num('InheritVel', 0, 'Inherit', { min: 0 }),
  ]);
  (p as any).parType = null;
  return p;
}
function newEventSource(name: string): Property {
  const p = new Property(name, 'EventSource', [
    str('Name', name, 'Name'), bool('Mute', false, 'Mute'), str('ParType', '', 'ParType', { readOnly: true }), bool('Stratified', false, 'Stratified'),
    num('Azimuth', 0, 'Azimuth'), num('Declination', 0, 'Declination'), num('Radius', 0, 'Radius', { min: 0 }),
    num('Rate', 50, 'Rate', { min: 0 }), num('Spread', 0, 'Spread', { min: 0, max: 90 }), num('Speed', 5, 'Speed', { min: 0, max: 100000 }), num('InheritVel', 0, 'InheritVel', { min: 0 }),
  ]);
  (p as any).parType = null;
  return p;
}
function newEvent(name: string): Property {
  const p = new Property(name, 'ParticleEvent', [
    str('Name', name, 'Name'), bool('Mute', false, 'Mute'), int('EventTrigger', 0, 'Trigger'), int('EventAction', 0, 'Action'),   // inferred: first items (no SPDL default)
    num('TriggerValue', 100, 'Value'), num('TriggerValueVar', 0, 'Var', { min: 0 }),
    str('EmissionProp', '', 'Emission', { readOnly: true }), str('ObstacleProp', '', 'Obstacle', { readOnly: true }),
    bool('UseScriptFile', false, 'Use Script File'), str('ScriptProc', '', 'Proc.'),
  ]);
  (p as any).parType = null;
  return p;
}
function newGoal(name: string): Property {
  return new Property(name, 'ParticleGoal', [
    str('Name', name, 'Particle Goal Name'), bool('Mute', false, 'Mute'), int('Behavior', 3, 'Goal Behavior', { min: 0, max: 4 }),
    num('Scalar1', 1, 'Scalar1'), num('Scalar2', 1, 'Scalar2'), int('Target', 2, 'Target', { min: 0, max: 4 }), int('Influence', 1, 'Influence', { min: 0, max: 1 }),
    num('LocalRadius', 10, 'Local Radius', { min: 0 }), num('Weight', 1, 'Weight', { min: 0 }),
    num('OffsetX', 100, 'Offset X', { min: 0 }), num('OffsetY', 100, 'Offset Y', { min: 0 }), num('OffsetZ', 100, 'Offset Z', { min: 0 }), int('OffsetReference', 2, 'Offset Reference', { min: 0, max: 2 }),
  ]);
}
function newObstacle(name: string): Property {
  return new Property(name, 'ObstacleProp', [
    str('Name', name, 'Obstacle Name'), bool('Mute', false, 'Mute'), int('ObstacleType', 1, 'Obstacle Type', { min: 0, max: 3 }),
    num('Friction', 1, 'Friction', { min: 0, max: 1 }), num('Elasticity', 1, 'Elasticity', { min: 0, max: 100 }), num('PushLength', 0.01, 'Push length', { min: 0, max: 1e6 }),
    num('Tolerance', 0.1, 'Tolerance', { min: 0, max: 10 }), bool('UseDeformation', false, 'Animatable Deformation'), bool('DoubleFaceCollision', false, 'Double Face Collision'),
  ]);
}
/** Init-state property (class 4e2d2322, SIAddProp preset 1edf2c8b). Name as the CMD-03b scripts use it. */
function newInitState(): Property {
  return new Property('ParticleInitialStateProp', 'ParticleInitState', [bool('mute', false, 'Mute'), bool('transfervelocity', false, 'Transfer velocity'), bool('liveforever', false, 'Live forever')]);
}
function ensureObstacle(app: App, o: Node): Property | null {
  if (isObstacle(o)) return o;
  if (!(o instanceof X3DObject)) return null;
  const have = o.properties.find(isObstacle); if (have) return have;
  const p = newObstacle(`${o.name}_obstacle`); addPropRec(app, o, p); return p;
}
/** A new cloud object (SIGetPrim, cloud class a8435ec0) under `parent`. */
function newCloud(app: App, name: string, parent: X3DObject): X3DObject {
  const cloud = new X3DObject(app.scene.uniqueName(name), 'cloud');
  const prim = new Primitive('cloud', 'cloud'); cloud.setPrimitive(prim); cloud.addProperty(makeDisplay());
  app.record('Add ' + cloud.name, () => { parent.addChild(cloud); }, () => { parent.removeChild(cloud); });
  return cloud;
}
/** Particles currently held by a cloud: the payloads of its AddParticleOp operators (inferred: no simulation here). */
function particlesOf(cloud: X3DObject): { positions: number[]; velocities: number[]; type: Property | null }[] {
  return opsOf(cloud).filter(op => op.type === 'AddParticleOp').map(op => (op as any).particles).filter(Boolean);
}
/** The particle types of a cloud: those connected on its sim op's type group (inferred: the cloud's ParTypes list). */
function typesOfCloud(cloud: X3DObject): Property[] {
  const op = simOp(cloud); return op ? groupOf(op, 'particleTypes').filter(isPType) : [];
}
/** The sim ops an element works for (the holder's op): ops whose types / emitters / event sources reach it (inferred). */
function opsReaching(app: App, n: Node): Operator[] {
  const out: Operator[] = [];
  let t: Node | null = n;
  if (isEvent(n) || isEventSource(n) || n instanceof Property && (n.type === 'ParticleGoal')) t = (n.parent as Node) ?? null;
  for (const op of allSimOps(app)) {
    const c = conn(op);
    const owner = objectOf(n);
    if ((t && c.particleTypes.includes(t)) || (owner && c.emitters.includes(owner)) || c.eventSources.includes(n) || c.obstacles.includes(n) || (t && c.obstacles.includes(t))) out.push(op);
  }
  return out;
}

// ------------------------------------------------------------------ UpdateParticleTypeConnections

/** Op case (worker slot 10): the op's type group follows the types its emitters / event sources use. */
function uptcOp(app: App, op: Operator) {
  if (op.type !== SPARKS && op.type !== HYPERFLOW) return;
  const c = conn(op);
  const used = new Set<Node>();
  for (const e of c.emitters) for (const p of isEmission(e) ? [e] : elementsOf(e).filter(isEmission)) { const t = typeSlot(p); if (t) used.add(t); }
  for (const s of c.eventSources) { const t = typeSlot(s); if (t) used.add(t); }
  // walk the global container: connect the used ones missing from group 5, drop links to types no longer used (inferred
  // which types count as "missing"; the contract names the container walk, the compare and the connect / delete)
  const wanted = particleScripts(app).particleTypes.filter(t => used.has(t));
  setGroup(app, op, 'particleTypes', wanted);
}
function updateParticleTypeConnections(app: App, a: Record<string, any>) {
  const C = 'UpdateParticleTypeConnections';
  let slot: 'A' | 'B' | 'C' | 'D' | 'E' | null = null, item: Node | null = null;
  for (const n of nodes(app, a.InputObj, true)) {
    if (isCloud(n)) slot = 'A'; else if (n instanceof Operator) slot = 'B'; else if (isEmission(n) || isEventSource(n)) slot = 'C';
    else if (isPType(n)) slot = 'D'; else if (isObstExt(n)) slot = 'E';
    if (slot) { item = n; break; }
  }
  if (!slot || !item) throw raise(app, C, E_FAIL, 0x6f, 'InputObj has no cloud, operator, emission, particle type or obstacle extension');
  if (slot === 'A') uptcOp(app, findSimOp(app, C, item as X3DObject));
  else if (slot === 'B') uptcOp(app, item as Operator);
  else if (slot === 'C' || slot === 'D') {
    nya(app, C, `the ${slot === 'C' ? 'emission (worker slot 11)' : 'particle type (worker slot 12)'} path; the operators that reach the item are updated as operators instead`);
    for (const op of opsReaching(app, item)) uptcOp(app, op);   // inferred
  } else nya(app, C, 'the obstacle extension path (worker slot 13)');
  setStatus(app, C, S_OK);
}
const uptc = (app: App, x: Node) => app.run('UpdateParticleTypeConnections', { InputObj: [x] });

// ------------------------------------------------------------------ commands

function createParticleType(app: App, a: Record<string, any>) {
  const C = 'CreateParticleType';
  let rt = unset(a.RenderType) ? 'siBillboardType' : String(a.RenderType);                 // inferred: the constructor's global default
  const m = /^:?([A-Za-z]+Type)(:siParticleRenderType)?$/.exec(rt); if (m) rt = m[1];
  const pt = newParticleType(app, rt);
  const list = particleScripts(app).particleTypes;
  app.record('Create particle type', () => { if (!list.includes(pt)) list.push(pt); }, () => { const k = list.indexOf(pt); if (k >= 0) list.splice(k, 1); });
  a.Output = pt; setStatus(app, C, S_OK);
  return pt;
}

/** Target / InputObj type collection of the user-parameter commands. */
function userParamTypes(app: App, C: string, a: Record<string, any>, withType: boolean): Property[] {
  const name = String(a.Name ?? ''), type = Number(a.Type ?? 0);
  const targets = nodes(app, a.Target, true);
  if (!name || (withType && !(type >= 0 && type < 7)) || !targets.length) throw raise(app, C, E_FAIL, 0x6f, !name ? 'Name is empty' : !targets.length ? 'Target is empty' : `Type ${a.Type} is not below 7`);
  const types: Property[] = [];
  for (const n of targets) for (const t of isPType(n) ? [n] : isCloud(n) ? typesOfCloud(n) : []) if (!types.includes(t)) types.push(t);
  if (!types.length) throw raise(app, C, E_FAIL, 0x6f, 'no particle type in Target');
  return types;
}
const userParams = (t: Property): Record<string, number> => ((t as any).userParameters ??= {});
/** Clouds using a type are refreshed (two cloud calls, inferred: invalidate + re-evaluate). */
function refreshClouds(app: App, t: Property) {
  for (const c of allClouds(app)) if (typesOfCloud(c).includes(t)) { (c as any).particleRefresh = ((c as any).particleRefresh ?? 0) + 1; if (c.primitive) c.primitive.dirty = true; }
}
function addUserParameter(app: App, a: Record<string, any>) {
  const C = 'AddUserParameter';
  const types = userParamTypes(app, C, a, true); const name = String(a.Name), type = Number(a.Type ?? 0);
  for (const t of types) {
    const up = userParams(t), had = name in up, old = up[name];
    app.record('Add user parameter', () => { up[name] = type; }, () => { if (had) up[name] = old; else delete up[name]; });
    refreshClouds(app, t);
  }
  setStatus(app, C, S_OK);
}
function removeUserParameter(app: App, a: Record<string, any>) {
  const C = 'RemoveUserParameter';
  const types = userParamTypes(app, C, a, false); const name = String(a.Name);
  let missing = false;
  for (const t of types) {
    const up = userParams(t);
    if (!(name in up)) { missing = true; continue; }
    const old = up[name] ?? 7;                                                                    // 7 when the type is unknown
    app.record('Remove user parameter', () => { delete up[name]; }, () => { up[name] = old; });
    refreshClouds(app, t);
  }
  setStatus(app, C, missing ? S_FALSE : S_OK);
  return missing ? S_FALSE : undefined;
}

/** InputObj of the init-state commands: the first cloud, else the first operator ("op" slot). */
function initStateInput(app: App, C: string, v: any): { cloud: X3DObject | null; op: Operator | null } {
  const list = nodes(app, v, true);
  const cloud = list.find(isCloud) ?? null; if (cloud) return { cloud, op: null };
  const op = list.find((n): n is Operator => n instanceof Operator) ?? null;
  if (!op) throw raise(app, C, E_FAIL, 0x6f, 'InputObj is neither a cloud nor an operator');
  return { cloud: null, op };
}
function connectParticleInitState(app: App, a: Record<string, any>) {
  const C = 'ConnectParticleInitState';
  const inp = initStateInput(app, C, a.InputObj);
  const init = nodes(app, a.InitCloud).find(isCloud);
  if (!init) throw raise(app, C, E_FAIL, 0x6f, 'InitCloud is not a cloud');
  const op = inp.op ?? findSimOp(app, C, inp.cloud!);
  if (op.type !== SPARKS) throw raise(app, C, E_FAIL, 0x6f, `${op.name} is not a Sparks operator`);
  let prop = init.properties.find(p => p.type === 'ParticleInitState');
  if (!prop) { prop = newInitState(); addPropRec(app, init, prop); }
  connectGroup(app, op, 4, [prop]);
  uptc(app, op);
  setStatus(app, C, S_OK);
}
function disconnectParticleInitState(app: App, a: Record<string, any>) {
  const C = 'DisconnectParticleInitState';
  const inp = initStateInput(app, C, a.InputObj);
  const op = inp.op ?? findSimOp(app, C, inp.cloud!);
  if (op.type !== SPARKS) throw raise(app, C, E_FAIL, 0x6f, `${op.name} is not a Sparks operator`);
  setGroup(app, op, 4, []);
  uptc(app, op);
  setStatus(app, C, S_OK);
}
const YES = 6, NO = 7, CANCEL = 2;
function setParticleInitState(app: App, a: Record<string, any>) {
  const C = 'SetParticleInitState';
  const list = nodes(app, a.InputObj, true);
  if (!list.length) { setStatus(app, C, S_FALSE); return S_FALSE; }
  const st = particlesB15c(app); let processed = 0;
  for (const cloud of list.filter(isCloud)) {
    processed++;
    const op = findSimOp(app, C, cloud, true);
    const old = groupOf(op, 4)[0];
    if (old) {
      let mode = Number(a.Overwrite) || 0;                                                         // inferred: non-zero Overwrite is the mode
      if (!mode) {
        if (st.interactive && st.hooks.msgBox) {
          const text = 'This cloud already has an initial state. Do you wish to replace it?';
          const ans = st.hooks.msgBox(text, 'SOFTIMAGE® | XSI®', 3); st.boxes.push({ text, answer: ans });
          mode = ans === YES ? 1 : ans === NO ? 2 : ans === CANCEL ? 3 : 3;
        } else mode = 1;
      }
      if (mode === 3) continue;
      if (mode === 1) { const oldCloud = objectOf(old); if (oldCloud) app.run('DeleteObj', { InputObj: [oldCloud] }); setGroup(app, op, 4, groupOf(op, 4).filter(x => x !== old)); }
      else if (mode === 2) app.run('DisconnectParticleInitState', { InputObj: [cloud] });
    }
    const parent = cloud.parentObj ?? app.scene.root;
    const init = newCloud(app, `${cloud.name}_InitState`, parent);
    const copy = particlesOf(cloud).map(p => ({ positions: [...p.positions], velocities: [...p.velocities], type: p.type }));
    app.record('Copy particles', () => { (init as any).particles = copy; }, () => { delete (init as any).particles; });
    nya(app, C, 'the two parameters of the 11ebe302 property (d636f4d0, a9d242e0) set to false on the new cloud');
    addPropRec(app, init, newInitState());
    // operators of the source cloud other than Sparks / HyperFlow / BlowUp are not copied onto the new cloud here,
    // so the strip step has nothing to delete (inferred)
    app.run('ConnectParticleInitState', { InputObj: [cloud], InitCloud: [init] });
  }
  setStatus(app, C, processed ? S_OK : S_FALSE);
  return processed ? undefined : S_FALSE;
}

function addParticleEmitter(app: App, a: Record<string, any>) {
  const C = 'AddParticleEmitter';
  const inputs = nodes(app, a.InputObj);
  const interactive = a.Interactive === undefined ? true : !(a.Interactive === false || a.Interactive === 0 || same(a.Interactive, 'false'));
  const cloud = expand(nodes(app, a.Target, true)).map(n => objectOf(n)).find(o => !!o && opsOf(o).some(op => op.type === SPARKS || op.type === HYPERFLOW)) ?? null;
  if (!cloud) throw fail(E_INVALIDARG, `${C}: no Target carries a Sparks or HyperFlow operator`);
  const op = opsOf(cloud).find(x => x.type === SPARKS || x.type === HYPERFLOW)!;
  const created: Property[] = [], add: Node[] = [];
  for (const n of expand(inputs)) {
    if (!(n instanceof X3DObject) || n.type === 'cloud') continue;
    if (op.type === HYPERFLOW) {
      const preset = String((n.primitive?.operators[0] as any)?.preset ?? n.type);
      if (!['disc', 'cube', 'square'].includes(preset.toLowerCase())) continue;
    }
    let em = n.properties.find(isEmission);
    if (!em) { em = newEmission(`${n.name}_emission`); addPropRec(app, n, em); created.push(em); }
    add.push(n);                                                                                   // the emitter group lists the owning object (as CMD-03b)
  }
  if (op.type === SPARKS) (op as any).emitterEntries = 3;                                           // Sparks: group 1, three entries per emitter
  connectGroup(app, op, 1, add);
  uptc(app, op);
  if (created.length && created.some(p => !typeSlot(p))) nya(app, C, 'the particle type of a new "Emission Property" preset (left empty)');
  if (interactive && created.length) { particlesB15c(app).lastAutoInspect = [...created]; if (app.autoInspect) app.events.emit('inspect', created[0]); }
  setStatus(app, C, S_OK);
}

function addParticleObstacle(app: App, a: Record<string, any>) {
  const C = 'AddParticleObstacle';
  const inputs = expand(nodes(app, a.InputObj));
  for (const t of expand(nodes(app, a.Target, true))) {
    const o = objectOf(t);
    const op = opsOf(o).find(x => SIM_TYPES.includes(x.type) || x.type === CLOTH || isSoftBody(x)) ?? null;
    if (!op) { nya(app, C, `${t.name} has no Sparks / HyperFlow / BlowUp / SoftBody / Cloth operator (the sixth class 4bd7a7ff is not mapped)`); continue; }
    const obstacles = inputs.map(n => ensureObstacle(app, n)).filter((p): p is Property => !!p);
    if (op.type === SPARKS) {
      for (const pt of [...particleScripts(app).particleTypes]) for (const ob of obstacles) {
        const evs = app.run('SIAddParticleEvent', { Target: [pt], Source: [] }) as Node[];
        for (const ev of evs ?? []) if (ev instanceof Property) setEventObstacleRef(app, ev, ob);   // inferred: one "on obstacle" event per type
      }
      if (obstacles.length) nya(app, C, 'the event parameter values of the Sparks obstacle events');
    } else {
      connectGroup(app, op, 'obstacles', obstacles);
      nya(app, C, `the port group number of the obstacles on ${op.type}`);
    }
    uptc(app, op);
  }
  setStatus(app, C, S_OK);
}
function setEventObstacleRef(app: App, ev: Property, ob: Property) {
  const old = (ev as any).obstacle ?? null, oldText = ev.val('ObstacleProp');
  app.record('Set event obstacle', () => { (ev as any).obstacle = ob; ev.set('ObstacleProp', ob.fullName); }, () => { (ev as any).obstacle = old; ev.set('ObstacleProp', oldText); });
}

function numbers(v: any): number[] | null {
  if (Array.isArray(v)) { const f = v.flat(Infinity as 1).map(Number); return f.every(Number.isFinite) ? f : null; }
  if (ArrayBuffer.isView(v)) return Array.from(v as any as ArrayLike<number>);
  return null;
}
function addParticles(app: App, a: Record<string, any>) {
  const C = 'AddParticles';
  a.OutputObj = null;
  let cloud = nodes(app, a.InputObj).find(isCloud) ?? null;
  const ptArg = resolve(app, Array.isArray(a.ParType) ? a.ParType[0] : a.ParType); let ptype = isPType(ptArg) ? ptArg : null;
  const pos = numbers(a.Positions);
  if (!pos || !pos.length) throw fail(E_INVALIDARG, `${C}: Positions must be a non-empty array`);
  let vel: number[];
  if (unset(a.Velocities) || (Array.isArray(a.Velocities) && !a.Velocities.length)) vel = new Array(pos.length).fill(0);
  else { const v = numbers(a.Velocities); if (!v) throw fail(E_INVALIDARG, `${C}: Velocities must be an array`); vel = v; }
  const count = Math.floor(pos.length / 3);
  let created = false;
  if (!cloud) {
    cloud = newCloud(app, 'cloud', app.scene.root); created = true;                               // inferred: name
    const mat = new Material(app.scene.uniqueName('Material'));
    const sh = makeSiShader('Particle_Renderer', 'Particle_Renderer') ?? new Shader('Particle_Renderer', 'Particle_Renderer', []);
    mat.setSurface(sh);
    const c = cloud, mats = app.scene.materials;
    app.record('Apply Particle_Renderer', () => { mats.push(mat); c.setMaterial(mat); }, () => { const i = mats.indexOf(mat); if (i >= 0) mats.splice(i, 1); c.setMaterial(null); });
  }
  if (!ptype) {
    const types = particleScripts(app).particleTypes;
    if (!types.length) app.run('CreateParticleType', {});
    ptype = types[0] ?? null;                                                                      // inferred: the container's first type
  }
  const op = new Operator('AddParticleOp', 'AddParticleOp', [
    num('Speed', 5, 'Speed', { min: 0, max: 100000 }), num('SpeedVar', 0, 'Var', { min: 0, max: 100000 }), int('SpeedSeed', 0, 'Speed Seed', { min: 0 }),
    int('Multiplicity', 20, 'Multiplicity', { min: 1, max: 100000 }), num('Radius', 0.2, 'Radius', { min: 0.1, max: 100000 }), int('RadiusSeed', 0, 'Radius Seed', { min: 0 }),
    num('Spread', 5, 'Spread', { min: 0, max: 180 }), int('SpreadSeed', 0, 'Spread Seed', { min: 0 }),
  ]);
  const P = pos.slice(0, count * 3), V = vel.slice(0, count * 3);
  while (V.length < count * 3) V.push(0);
  if (a['World Referential'] === undefined || a['World Referential'] === true || a['World Referential'] === 1 || same(a['World Referential'], 'true')) {
    const inv = cloud.globalMatrix().invert(); const rot = new THREE.Matrix3().setFromMatrix4(inv);
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      p.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(inv); P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      v.set(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]).applyMatrix3(rot); V[i * 3] = v.x; V[i * 3 + 1] = v.y; V[i * 3 + 2] = v.z;
    }
  }
  (op as any).particles = { positions: P, velocities: V, type: ptype };
  const prim = cloud.primitive!;
  app.record('Apply AddParticleOp', () => { prim.addOperator(op); }, () => { prim.removeOperator(op); });
  nya(app, C, 'the AddParticleOp parameter layout of the stored particles and its port-group connection');
  if (created) a.OutputObj = cloud;
  setStatus(app, C, S_OK);
  return created ? cloud : undefined;
}

const isHolder = (n: any) => isEmission(n) || isEvent(n) || isEventSource(n);
function setParticleType(app: App, a: Record<string, any>) {
  const C = 'SetParticleType';
  const holders: Property[] = [];
  for (const x of listOf(a.Target).length ? listOf(a.Target) : [...app.selection]) {
    let n = resolve(app, x);
    const full = typeof x === 'string' ? x.trim() : n?.fullName ?? ''; const i = full.lastIndexOf('.');
    const typeItem = isPType(n) || (!n && i > 0 && particleScripts(app).particleTypes.some(t => t.name === full.slice(i + 1)));
    if (typeItem) {
      // a particle type item is resolved through its parent name (text before the last '.') to the holder (inferred)
      const h = i > 0 ? resolve(app, full.slice(0, i)) : null;
      n = h instanceof X3DObject ? (h.properties.find(isEmission) ?? null) : h;
    } else if (n instanceof X3DObject) n = n.properties.find(isEmission) ?? null;                // inferred: an emitter object stands for its emission
    if (isHolder(n) && !holders.includes(n)) holders.push(n);
  }
  let src: Property | null = null;
  for (const n of nodes(app, a.Source)) if (isPType(n)) src = n;
  if (!src) src = app.run('CreateParticleType', {}) as Property;
  for (const h of holders) { setTypeSlot(app, h, src); uptc(app, h); }
  setStatus(app, C, S_OK);
}

function siAddParticleGoal(app: App, a: Record<string, any>) {
  const C = 'SIAddParticleGoal';
  const out: Property[] = [];
  const goals = expand(nodes(app, a.InputObj)).filter(n => n instanceof X3DObject);
  for (const t of expand(nodes(app, a.Target))) {
    const types = isCloud(t) ? typesOfCloud(t) : isPType(t) ? [t] : [];
    for (const pt of types) for (const g of goals) {
      const goal = newGoal(`${g.name}_goal`);                                                     // inferred: <goal object name>_goal
      (goal as any).goalObject = g;
      addPropRec(app, pt, goal);                                                                   // inferred: the goal property hangs on the type
      out.push(goal);
      nya(app, C, 'which goal parameter is set to 4 at the current time');
      uptc(app, pt);
    }
  }
  a.Output = out; setStatus(app, C, S_OK);
  return out;
}

function createEventSource(app: App, a: Record<string, any>) {
  const C = 'CreateEventSource';
  a.Output = null;
  const items = listOf(a.Target);
  if (items.length > 1) throw fail(E_UNEXPECTED, `${C}: Target must hold at most one item`);
  const holder = items.length ? resolve(app, items[0]) : null;
  if (!isEvent(holder)) throw fail(E_NOINTERFACE, `${C}: Target is not a particle event`);         // inferred status: the interface query fails
  const have: Property | null = (holder as any).eventSource ?? null;
  if (have) { a.Output = have; setStatus(app, C, S_FALSE); return have; }
  const src = newEventSource(`${holder.name}_Emission`);
  const old = (holder as any).eventSource ?? null, oldText = holder.val('EmissionProp');
  addPropRec(app, holder, src);
  app.record('Attach event source', () => { (holder as any).eventSource = src; holder.set('EmissionProp', src.fullName); }, () => { (holder as any).eventSource = old; holder.set('EmissionProp', oldText); });
  const first = particleScripts(app).particleTypes[0] ?? null; if (first) setTypeSlot(app, src, first);
  const ops = opsReaching(app, holder);
  if (!ops.length) nya(app, C, `the simulation operator of ${holder.name} (none found; the source is not connected)`);
  for (const op of ops) {
    if (op.type === SPARKS) { const cur = groupOf(op, 6).filter(x => x !== src); setGroup(app, op, 6, []); setGroup(app, op, 6, [...cur, src]); }   // disconnect / reconnect group 6
    else connectGroup(app, op, 'eventSources', [src]);
    uptc(app, op);
  }
  a.Output = src; setStatus(app, C, S_OK);
  return src;
}

function siAddParticleEvent(app: App, a: Record<string, any>) {
  const C = 'SIAddParticleEvent';
  const out: Property[] = [];
  const sources = nodes(app, a.Source).filter(isPType);
  for (const t of expand(nodes(app, a.Target))) {
    if (!isPType(t) && !isObstacle(t) && !isObstExt(t)) continue;                                // per-target worker fails
    const taken = new Set(elementsOf(t).map(p => p.name));
    let name = 'ParticleEvent', i = 1; while (taken.has(name)) name = `ParticleEvent${i++}`;       // inferred: name
    const ev = newEvent(name);
    addPropRec(app, t, ev);
    app.run('CreateEventSource', { Target: [ev] });
    const slot = sources[0] ?? (isPType(t) ? t : particleScripts(app).particleTypes[0] ?? null);    // inferred: role of Source
    if (slot) setTypeSlot(app, ev, slot);
    out.push(ev);
    if (isPType(t)) uptc(app, t);
  }
  if (!out.length) { app.logMsg('error', `${C}: [sparks 0x126] no event could be added`); throw fail(E_INVALIDARG, `${C}: no Target accepted an event`); }
  nya(app, C, 'the role of Source and the event parameter values');
  a.Output = out; setStatus(app, C, S_OK);
  return out;
}

function setEventObstacle(app: App, a: Record<string, any>) {
  const C = 'SetEventObstacle';
  const t = listOf(a.Target)[0], s = listOf(a.Source)[0];
  if (t === undefined || s === undefined) throw fail(E_UNEXPECTED, `${C}: Target and Source must not be empty`);
  const ev = resolve(app, t), src = resolve(app, s);
  if (!isEvent(ev)) throw fail(E_NOINTERFACE, `${C}: Target is not a particle event`);           // inferred status
  const ob = src ? ensureObstacle(app, src) : null;
  if (!ob) throw fail(E_NOINTERFACE, `${C}: Source is not an object`);                            // inferred status
  setEventObstacleRef(app, ev, ob);                                                                // inferred: the event's ObstacleProp slot
  const ops = opsReaching(app, ev);
  for (const op of ops) { connectGroup(app, op, 'obstacles', [ob]); uptc(app, op); }
  if (!ops.length) nya(app, C, `the simulation operator of ${ev.name} (none found)`);
  setStatus(app, C, S_OK);
}

/** SIAddParticleForce (forces.dll): op class → port group / flag. */
function forceGroup(op: Operator): { group: number; flag: number } | null {
  if (op.type === SPARKS || op.type === HYPERFLOW || op.type === CLOTH) return { group: 3, flag: 1 };
  if (isSoftBody(op)) return { group: 2, flag: 1 };
  if (op.type === BLOWUP) return { group: 4, flag: 0 };
  return null;
}
function siAddParticleForce(app: App, a: Record<string, any>) {
  const C = 'SIAddParticleForce';
  const forces = expand(nodes(app, a.InputObj));
  for (const t of expand(nodes(app, a.Target))) {
    const o = objectOf(t);
    let op: Operator | null = null, fg: { group: number; flag: number } | null = null;
    for (const x of opsOf(o)) { const g = forceGroup(x); if (g) { op = x; fg = g; break; } }
    if (!op || !fg) continue;                                                                      // no op: nothing done, S_OK
    // the legacy ops keep forces in their `forces` group whatever the group number; others in portGroups[<n>]
    const key: Key | number = SIM_TYPES.includes(op.type) ? 'forces' : fg.group;
    (op as any).forceGroup = fg;
    for (const f of forces) {
      if (!isForce(f)) continue;                                                                   // not a force primitive: skipped silently
      if (groupOf(op, key).includes(f)) { app.logMsg('info', `WARNING : ${f.name}: [XSIFORCES 0x34]`); continue; }
      connectGroup(app, op, key, [f]);
    }
  }
  setStatus(app, C, S_OK);
}

function connectWeightMapToComponent(app: App, a: Record<string, any>) {
  const C = 'ConnectWeightMapToComponent';
  const t = nodes(app, a.Target, true)[0] ?? null;
  let geometry: Primitive | null = null, cluster: Cluster | null = null;
  if (t instanceof Primitive) geometry = t;
  else if (t instanceof X3DObject) geometry = t.primitive;
  else if (t instanceof Cluster) { cluster = t; geometry = t.obj?.primitive ?? null; }
  const wm = nodes(app, a.PropObj)[0] ?? null;
  const map = wm instanceof Property ? wm : null;
  if (map && !cluster && map.parent instanceof Cluster) cluster = map.parent;
  const target = objectOf(t);
  if (!geometry || !cluster || !map || !target) throw fail(E_POINTER, `${C}: ${!geometry ? 'no geometry' : !cluster ? 'no cluster' : !map ? 'no weight map' : 'no target'}`);
  const op = new Operator('WMCnxOp', 'WMCnxOp', []);
  (op as any).inputs = [geometry, cluster, map];                                                   // port group 1
  (op as any).outputs = [target, target];                                                         // output ports 0 and 1 → the target's cnx points
  const prim = geometry;
  app.record('Apply WMCnxOp', () => { prim.addOperator(op); }, () => { prim.removeOperator(op); });
  nya(app, C, 'the meaning of the two bidirectional output port connections');
  setStatus(app, C, S_OK);
  return op;
}

// ------------------------------------------------------------------ registration

const NC = (name: string) => ({ name, default: null as any });
const IO = (name: string) => ({ name, default: EMPTY_COLLECTION });
function entries(app: App, name: string, list: { label: string; args: ArgDef[] }[]) { particlesB15c(app).entries[name] = list; }

export function registerParticlesB15cCommands(app: App) {
  particlesB15c(app);
  const reg = (d: { name: string; label: string; description: string; args: ArgDef[]; execute: (app: App, a: Record<string, any>) => any }) => app.register({ category: CAT, ...d });

  reg({ name: 'ConnectWeightMapToComponent', label: 'Connect weight map to component', description: 'Connect a weight map to a component', args: [NC('Target'), NC('PropObj')], execute: connectWeightMapToComponent });
  entries(app, 'ConnectWeightMapToComponent', [{ label: 'Connect weight map to component', args: [NC('Target'), NC('PropObj')] }, { label: 'Pick Component', args: [{ name: 'Target', default: '' }, { name: 'PropObj', default: '' }] }]);
  reg({ name: 'ConnectParticleInitState', label: 'Connect particle initial state', description: 'Connect an initial state to a particle simulation', args: [NC('InputObj'), NC('InitCloud')], execute: connectParticleInitState });
  reg({ name: 'DisconnectParticleInitState', label: 'Disconnect particle initial state', description: 'Disconnect an initial state from a particle simulation', args: [NC('InputObj')], execute: disconnectParticleInitState });
  reg({ name: 'SetParticleInitState', label: 'Set Particle Init State', description: 'Set the current state of the particle cloud as the simulation initial state', args: [NC('InputObj'), { name: 'Overwrite', default: 0 }], execute: setParticleInitState });
  reg({ name: 'UpdateParticleTypeConnections', label: 'Update Particle Type Connections', description: 'Update the particle type connections of a particle of fluid simulation operator', args: [NC('InputObj')], execute: updateParticleTypeConnections });
  reg({ name: 'AddParticleEmitter', label: 'Add Particle Emitter', description: 'Add an object emitting particles', args: [NC('Target'), NC('InputObj'), { name: 'Interactive', default: true }], execute: addParticleEmitter });
  entries(app, 'AddParticleEmitter', [{ label: 'Add Particle Emitter', args: [NC('Target'), NC('InputObj'), { name: 'Interactive', default: true }] }, { label: 'Pick Emitter', args: [{ name: 'Target', default: '' }, { name: 'InputObj', default: '' }, { name: 'Interactive', default: true }] }]);
  reg({ name: 'AddParticleObstacle', label: 'Add Particle Obstacle Object', description: 'Add an object obstructing particles', args: [NC('Target'), NC('InputObj')], execute: addParticleObstacle });
  entries(app, 'AddParticleObstacle', [{ label: 'Add Particle Obstacle Object', args: [NC('Target'), NC('InputObj')] }, { label: 'Pick Obstacle', args: [{ name: 'Target', default: '' }, { name: 'InputObj', default: '' }] }]);
  reg({ name: 'AddParticles', label: 'Add Particles', description: 'Add particles to a cloud', args: [NC('InputObj'), NC('ParType'), NC('Positions'), NC('Velocities'), { name: 'World Referential', default: true }], execute: addParticles });
  reg({ name: 'SetParticleType', label: 'Set a Particle Type', description: 'Set a Particle Type', args: [NC('Target'), NC('Source')], execute: setParticleType });
  entries(app, 'SetParticleType', [{ label: 'Set a Particle Type', args: [NC('Target'), NC('Source')] }, { label: 'Set a particle type', args: [{ name: 'Target', default: '' }, { name: 'Source', default: '' }] }]);
  reg({ name: 'CreateParticleType', label: 'Create Particle Type', description: 'Create a new Particle Type', args: [{ name: 'RenderType', default: ':siBillboardType:siParticleRenderType' }, NC('Output')], execute: createParticleType });
  entries(app, 'CreateParticleType', [{ label: 'Create Particle Type', args: [{ name: 'RenderType', default: ':siBillboardType:siParticleRenderType' }, NC('Output')] }, { label: 'Create a new particle type', args: [NC('Output')] }]);
  reg({ name: 'SIAddParticleGoal', label: 'SIAddParticleGoal', description: 'Pick a goal for particles', args: [IO('Target'), IO('InputObj'), NC('Output')], execute: siAddParticleGoal });
  reg({ name: 'CreateEventSource', label: 'Create Event Source', description: 'Create an emission source and adds it to a particle event.', args: [NC('Target'), NC('Output')], execute: createEventSource });
  entries(app, 'CreateEventSource', [{ label: 'Create Event Source', args: [NC('Target'), NC('Output')] }, { label: 'Create Event Source', args: [{ name: 'Target', default: '' }, NC('Output')] }]);
  reg({ name: 'AddUserParameter', label: 'Add User Parameter To Particle Types', description: 'Adds a user parameter to the particle types given as input or to those present under the input clouds.', args: [NC('Target'), { name: 'Name', default: '' }, { name: 'Type', default: 0 }], execute: addUserParameter });
  reg({ name: 'RemoveUserParameter', label: 'Remove User Parameter From Particle Types', description: 'Removes a user parameter from the particle types given as input or from those present under the input clouds.', args: [NC('Target'), { name: 'Name', default: '' }], execute: removeUserParameter });
  reg({ name: 'SIAddParticleEvent', label: 'SIAddParticleEvent', description: 'Add a Particle Event to a Particle Type or Obstacle extension property.', args: [IO('Target'), IO('Source'), NC('Output')], execute: siAddParticleEvent });
  reg({ name: 'SetEventObstacle', label: 'Set Event Obstacle', description: 'Set the obstacle of a particle event.', args: [NC('Target'), NC('Source')], execute: setEventObstacle });
  entries(app, 'SetEventObstacle', [{ label: 'Set Event Obstacle', args: [NC('Target'), NC('Source')] }, { label: 'Set Event Obstacle', args: [NC('Target'), NC('Source')] }]);
  reg({ name: 'SIAddParticleForce', label: 'Add Particle Force Object', description: 'Add an object to apply a force to particles', args: [IO('Target'), IO('InputObj')], execute: siAddParticleForce });

  registerShaderCreationB15Commands(app);
}
