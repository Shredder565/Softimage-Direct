// Ledger row CMD-B15c: shared model and helpers of the legacy particle (Sparks) native commands.
// Brief: docs/ghidra/cmd-b15c-particles.md ("Shared facts" and "Contracts") and docs/re/WIRE_CORRECTIONS_B15.md items 27-29.
// Original code written from that prose contract only; no XSIBATCH golden exists.
//
// Model (an ORIGINAL stand-in built on the CMD-03b model of particleScripts.ts, which this file reuses):
//  * Particle types = `particleScripts(app).particleTypes` (Property type `ParType`, the "global particle type container").
//    A type carries `renderType` (string), `userParams` ({name, type}[]) and `particleElements` (events / goals hung on it).
//  * Clouds = X3DObject type `cloud` whose primitive holds the simulation operator (Sparks `ParticlesOp`, HyperFlow
//    `FluidOp`, BlowUp `ExplosionOp`); its `connections` record (main / emitters / obstacles / forces / initialState /
//    particleTypes) stands for the operator's port groups. Extra groups are kept as `op.portGroups[<n>]`, event sources as
//    `connections.eventSources`.
//  * Emission property = Property `EmissionProp` (`parType` field = its type slot), obstacle property = `ObstacleProp`,
//    goal = `ParticleGoal`, event = `ParticleEvent` (field `eventSource`, `obstacle`, `sources`), event source = `EventSource`,
//    initial state = `ParticleInitState`, weight map connection operator = Operator `WMCnxOp` (kept in `rows.wmConnections`).
//  * Particles added by AddParticles live in an operator `AddParticleOp` on the cloud's primitive (`particles` field).
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). The dictionary texts behind the
//    message ids 0x6f / 0x126 / XSIFORCES 0x34 are not in the repo: they are named by id in the message / log line.
//  * S_FALSE (1) results are kept in `app.particlesB15c.status[<command>]` (the bus has no HRESULT channel); S_OK is 0.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15c)".
import { App } from '../core/commands';
import { Node, X3DObject, Property, Primitive, Operator, Group, Cluster } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { particleScripts, nodesOf, unset } from './particleScripts';
import { resolve as resolveCluster } from './optasksB12eShared';

export { unset, nodesOf, particleScripts };
export { Node, X3DObject, Property, Primitive, Operator, Group, Cluster };

export const ROW = 'CMD-B15c';
export const NOTE = 'docs/ghidra/cmd-b15c-particles.md';
export const S_OK = 0, S_FALSE = 1;
export const E_FAIL = 0x80004005, E_POINTER = 0x80004003, E_INVALIDARG = 0x80070057, E_UNEXPECTED_ARG = 0x8000ffff;

export const SPARKS = 'ParticlesOp', HYPERFLOW = 'FluidOp', BLOWUP = 'ExplosionOp';
export const isSparks = (op: any) => op?.type === SPARKS;
export const isSimOp = (op: any) => op?.type === SPARKS || op?.type === HYPERFLOW || op?.type === BLOWUP;

export interface WMCnx { op: Operator; geometry: X3DObject; cluster: Cluster; map: Property; target: Node }
export interface B15cState {
  status: Record<string, number>;
  /** Message box hook (SetParticleInitState): returns 'yes' | 'no' | 'cancel'. Without it the box is not shown (mode 1). */
  hooks: { messageBox?: (text: string, title: string) => 'yes' | 'no' | 'cancel' };
  /** Stands for "UI present" of SetParticleInitState (false = batch). */
  ui: boolean;
  wmConnections: WMCnx[];
}
export const b15c = (app: App): B15cState => ((app as any).particlesB15c ??= { status: {}, hooks: {}, ui: false, wmConnections: [] } as B15cState);
export const setStatus = (app: App, command: string, s: number) => { b15c(app).status[command] = s; };

export const fail = (status: number, what: string) => new SiStatusError(status, what);
export const logNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`);
export const ptypes = (app: App): Property[] => particleScripts(app).particleTypes;

export const isCloud = (n: any): n is X3DObject => n instanceof X3DObject && n.type === 'cloud';
export const isPType = (n: any): n is Property => n instanceof Property && n.type === 'ParType';
export const isEmission = (n: any): n is Property => n instanceof Property && n.type === 'EmissionProp';
export const isObstacleProp = (n: any): n is Property => n instanceof Property && n.type === 'ObstacleProp';
export const isEvent = (n: any): n is Property => n instanceof Property && n.type === 'ParticleEvent';
export const isOperator = (n: any): n is Operator => n instanceof Operator;

/** Resolve a list argument (nodes, names, comma lists); the selection when omitted and `selection` is set. */
export function items(app: App, arg: any, selection = false): Node[] {
  if (unset(arg)) return selection ? [...app.selection] : [];
  const list: any[] = Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg];
  const out: Node[] = [];
  for (const x of list) {
    let n: Node | null | undefined = x instanceof Node ? x : nodesOf(app, x)[0];
    if (!n && typeof x === 'string') n = resolveCluster(app, x);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
/** Groups flattened to their members. */
export function expand(list: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of list) for (const m of n instanceof Group ? n.members : [n]) if (!out.includes(m)) out.push(m);
  return out;
}

// ------------------------------------------------------------------ simulation operators
/** The simulation operator of a cloud (Sparks / HyperFlow / BlowUp), or null. */
export const simOpOf = (cloud: X3DObject | null | undefined): Operator | null => cloud?.primitive?.operators.find(isSimOp) ?? null;
/** "Find sim op": raises 0x80004005 (message id 0x6f) when there is none. */
export function findSimOp(cloud: X3DObject | null, command: string, sparksOnly = false): Operator {
  const op = simOpOf(cloud);
  if (!op || (sparksOnly && !isSparks(op))) throw fail(E_FAIL, `${command}: no ${sparksOnly ? 'Sparks ' : ''}simulation operator found (message id 0x6f)`);
  return op;
}
export const cloudOfOp = (op: Operator): X3DObject | null => { const p: any = op.parent; return p instanceof Primitive && p.parent instanceof X3DObject ? p.parent : null; };
export interface Conn { main: Node[]; emitters: Node[]; obstacles: Node[]; forces: Node[]; initialState: Node[]; particleTypes: Node[]; eventSources?: Node[] }
export function connOf(op: Operator): Conn {
  const o: any = op;
  return (o.connections ??= { main: [], emitters: [], obstacles: [], forces: [], initialState: [], particleTypes: [] });
}
/** Every simulation operator of the scene. */
export function allSimOps(app: App): Operator[] {
  const out: Operator[] = [];
  for (const o of app.scene.allObjects()) if (isCloud(o)) { const op = simOpOf(o); if (op) out.push(op); }
  return out;
}

/** Undoable replacement of a list field. */
export function setList(app: App, label: string, host: any, key: string, after: any[]) {
  const before = [...(host[key] ?? [])];
  app.record(label, () => { host[key] = [...after]; }, () => { host[key] = [...before]; });
}
/** Undoable append (no duplicates) to a list field. */
export function addTo(app: App, label: string, host: any, key: string, add: Node[]) {
  const before = [...(host[key] ?? [])];
  const after = [...before, ...add.filter(n => !before.includes(n))];
  app.record(label, () => { host[key] = [...after]; }, () => { host[key] = [...before]; });
}

/** Refresh a cloud (cache invalidation; the stand-in for "re-evaluate"). */
export function touchCloud(app: App, cloud: X3DObject | null) {
  const p: any = cloud?.primitive; if (!p) return;
  const v = p.version;
  app.record('Refresh cloud', () => { p.dirty = true; p.version = (v ?? 0) + 1; }, () => { p.dirty = true; p.version = v; });
}

/** UpdateParticleTypeConnections, op case: the types connected on the type group follow the emission / event sources. */
export function updateOp(app: App, op: Operator) {
  if (op.type !== SPARKS && op.type !== HYPERFLOW) return;
  const c = connOf(op); const want: Node[] = [];
  const take = (t: any) => { if (isPType(t) && !want.includes(t)) want.push(t); };
  for (const e of c.emitters) if (e instanceof X3DObject) for (const p of e.properties) if (isEmission(p)) take((p as any).parType);
  for (const s of c.eventSources ?? []) take((s as any).parType);
  if (want.length !== c.particleTypes.length || want.some((t, i) => c.particleTypes[i] !== t)) setList(app, 'Update particle type connections', c, 'particleTypes', want);
}
export function updateCloud(app: App, cloud: X3DObject, command: string) { updateOp(app, findSimOp(cloud, command)); }

/** Clouds (with a simulation operator) whose emitters include the object, or whose types / events refer to the node. */
export function opsUsing(app: App, node: Node): Operator[] {
  return allSimOps(app).filter(op => { const c = connOf(op); return c.emitters.includes(node) || c.obstacles.includes(node) || (c.eventSources ?? []).includes(node) || c.particleTypes.includes(node); });
}

// ------------------------------------------------------------------ particle types
const RENDER_NAMES = ['siBillboardType', 'siSphereType', 'siBlobType'];
/** ":siBillboardType:siParticleRenderType" -> "siBillboardType"; a number indexes the enum (0 billboard, 1 sphere, 2 blob, inferred). */
export function renderTypeName(v: any): string {
  if (typeof v === 'number') return RENDER_NAMES[v] ?? String(v);
  const s = String(v ?? '');
  const m = /^:([^:]+):/.exec(s);
  return m ? m[1] : s;
}
/** A new particle type in the global container (default name PType, PType1, ...; same names as CMD-03b). */
export function newParticleType(app: App, renderType: any): Property {
  const taken = new Set(ptypes(app).map(p => p.name));
  let name = 'PType', i = 1; while (taken.has(name)) name = `PType${i++}`;
  const rt = renderTypeName(renderType);
  const pt = new Property(name, 'ParType', [{ name: 'rendertype', type: 'string', default: rt, label: 'Render Type', readOnly: true }]);
  (pt as any).renderType = rt; (pt as any).userParams = [];
  const list = ptypes(app);
  app.record('Create particle type', () => { list.push(pt); }, () => { const k = list.indexOf(pt); if (k >= 0) list.splice(k, 1); });
  return pt;
}

/** Hang an element on a target: a 3D object takes a property; a particle type / property keeps it in `particleElements`. */
export function attach(app: App, target: Node, el: Property) {
  if (target instanceof X3DObject) { app.record('Add ' + el.name, () => { target.addProperty(el); }, () => { target.removeProperty(el); }); return; }
  const list: Property[] = ((target as any).particleElements ??= []);
  app.record('Add ' + el.name, () => { list.push(el); el.parent = target; }, () => { const i = list.indexOf(el); if (i >= 0) list.splice(i, 1); el.parent = null; });
}
export function uniqueElementName(target: Node, base: string): string {
  const have = new Set<string>([...(target instanceof X3DObject ? target.properties : (target as any).particleElements ?? [])].map((p: Node) => p.name));
  let n = base, i = 1; while (have.has(n)) n = `${base}${i++}`;
  return n;
}
/** Obstacle property `<name>_obstacle` on an object (existing one reused). */
export function ensureObstacle(app: App, obj: Node): Property {
  if (isObstacleProp(obj)) return obj;
  if (obj instanceof X3DObject) {
    const have = obj.properties.find(isObstacleProp); if (have) return have;
    const p = new Property(`${obj.name}_obstacle`, 'ObstacleProp', []);
    app.record('Add obstacle property', () => { obj.addProperty(p); }, () => { obj.removeProperty(p); });
    return p;
  }
  throw fail(E_POINTER, `an obstacle property needs a 3D object, got ${obj.name}`);
}
/** Emission property `<name>_emission` (existing one reused); `fresh` collects the new ones. */
export function ensureEmission(app: App, obj: X3DObject, fresh: Property[]): Property {
  const have = obj.properties.find(isEmission); if (have) return have;
  const p = new Property(`${obj.name}_emission`, 'EmissionProp', [
    { name: 'Generation', type: 'int', default: 0, label: 'Generation' },
    { name: 'ParType', type: 'string', default: '', label: 'Particle Type', readOnly: true },
  ]);
  app.record('Add emission property', () => { obj.addProperty(p); }, () => { obj.removeProperty(p); });
  fresh.push(p);
  return p;
}
/** The type slot of an emission property / event (the holder's current type). */
export const slotType = (h: Node): Node | null => ((h as any).parType as Node) ?? null;
export function putSlotType(app: App, h: Node, t: Node | null) {
  const old = (h as any).parType ?? null; const prm = (h as any).get?.('ParType'); const oldTxt = prm?.value;
  app.record('Set particle type', () => { (h as any).parType = t; if (prm) prm.value = t ? t.name : ''; }, () => { (h as any).parType = old; if (prm) prm.value = oldTxt; });
}

/** The event source made by CreateEventSource for an event holder, connected to the holder's simulation operator. */
export function makeEventSource(app: App, holder: Node, command: string): { src: Property; existed: boolean } {
  const have: Property | undefined = (holder as any).eventSource;
  if (have) return { src: have, existed: true };
  const src = new Property(`${holder.name}_Emission`, 'EventSource', []);
  const first = ptypes(app)[0];
  (src as any).parType = first ?? null; (src as any).holder = holder;
  app.record('Create event source', () => { (holder as any).eventSource = src; src.parent = holder; }, () => { (holder as any).eventSource = undefined; src.parent = null; });
  const ops = opsUsing(app, holder).concat(holder.parent ? opsUsing(app, holder.parent as Node) : []);
  const op = ops[0] ?? allSimOps(app).find(o => connOf(o).particleTypes.includes((holder.parent as Node) ?? holder));
  if (op) {
    // Sparks op: disconnect / reconnect on port group 6; other ops: a port-group connect (the group number is not attested for them)
    addTo(app, 'Connect event source', connOf(op), 'eventSources', [src]);
    if (!isSparks(op)) logNya(app, command, 'the port group an event source connects to on a HyperFlow / BlowUp operator');
    updateOp(app, op);
  } else logNya(app, command, `the simulation operator of ${holder.name} (the source is attached but connected to no operator)`);
  return { src, existed: false };
}
