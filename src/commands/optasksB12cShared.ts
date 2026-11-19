// Ledger row CMD-B12c: shared state and helpers of the optasks.dll commands wired in optasksB12cEnvelope.ts,
// optasksB12cWeights.ts and optasksB12cVolumes.ts. Brief: docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md
// ("Wire contract" per command). Original code written from that prose contract only; no XSIBATCH golden exists.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). Statuses that are not
//    failures (0, 1 = S_FALSE "nothing to do", 0x562e80c7 "cancelled") are kept in `app.optasksB12c.lastStatus`.
//  * Message ids (dictionary XSIOPTASKS; texts not in the repo, note open question 8) are logged with their id:
//    severity 4 as a WARNING line, severity 2 as an error line.
//  * Property-change notifications (SI3D_ENVELOPEWEIGHTPROP_CREATED / _REMOVED) are appended to
//    `app.optasksB12c.notifications`.
//  * The envelope family records undo steps only when the run is interactive (note 2: "Undo fails with 0x8000FFFF
//    when the task did not record sub-tasks"); a non-interactive run changes the scene without an undo entry.
//  * Concepts this build has no class for get small stand-ins here: the lock-envelope-weights operator, the weight
//    maps mixer operator, the weight-map input ports of an operator and the connection graph CycleChecking walks.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Cluster, Operator, Property } from '../core/scene';
import { ChainRoot } from '../core/scene2';
import { EnvelopeOperator, envelopeOf } from '../core/envelope';
import { SiStatusError } from './alembicSeqCam';
import { findNode, unset } from './viewEditPropertyHelpers';
import { type CsItem, collectionItems, connectionGroups, meshOf, ownerObject, pointsOf } from './operatorsScriptsOps';

export { unset, collectionItems, connectionGroups, meshOf, ownerObject, pointsOf, type CsItem };

export const NOTE = 'docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md';
export const ROW = 'CMD-B12c';
export const S_OK = 0, S_FALSE = 1, SI_CANCELLED = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_UNEXPECTED = 0x8000ffff;
/** Message ids of the note (section 2 / 3). */
export const MSG_NO_VALID_INPUT = 0x29, MSG_LOCKED_POINTS = 0x1d0, MSG_CYCLE = 0x1e;
export const ENV_CREATED = 'SI3D_ENVELOPEWEIGHTPROP_CREATED', ENV_REMOVED = 'SI3D_ENVELOPEWEIGHTPROP_REMOVED';
/** Class names of the note (section 2), kept on the stand-ins so a script can tell them apart. */
export const CLS = {
  envelope: 'c3denvelopop', envelopeAutoAssign: 'c3denvelopeautoassignop2', cageDeform: 'c3dcagedeformop', cageAutoAssign: 'c3dcageautoassignop',
  weightMap: 'c3dweightprop', mixer: 'C3DWeightMapsMixerOp', lockWeights: 'c3dlockenvelopeweightsop', propVolume: 'c3dpropvolumeop',
};

export interface OptasksB12cState {
  lastStatus: { command: string; status: number } | null;
  notifications: { name: string; command: string; objects: string[] }[];
  /** TogglePropVolume: the per-object enable state (stand-in for the object's boolean parameter id 2). */
  propVolumeEnabled: WeakMap<X3DObject, boolean>;
  /** Stand-in classes and graph helpers, reachable from scripts and the check script. */
  api: Record<string, any>;
}
export function stateOf(app: App): OptasksB12cState {
  const app2 = app as any;
  if (app2.optasksB12c) return app2.optasksB12c;
  const st: OptasksB12cState = { lastStatus: null, notifications: [], propVolumeEnabled: new WeakMap(), api: {} };
  st.api = { weightMapPorts, hasCycle: (n: Node) => hasCycle(app, n), extraOperators, LockEnvelopeWeightsOperator, WeightMapsMixerOperator };
  app2.optasksB12c = st;
  return st;
}

// ------------------------------------------------------------------ status, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export const hex = (n: number) => '0x' + n.toString(16);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
/** A severity-4 message (warning) with its catalogue id; the text is not in the repo (open question 8). */
export function warn(app: App, command: string, id: number, detail = '') { app.logMsg('info', `WARNING : ${command}: [XSIOPTASKS ${hex(id)}]${detail ? ' ' + detail : ''}`); }
/** A severity-2 message (error) with its catalogue id. */
export function errorMsg(app: App, command: string, id: number, detail = '') { app.logMsg('error', `${command}: [XSIOPTASKS ${hex(id)}]${detail ? ' ' + detail : ''}`); }
export function logNya(app: App, command: string, what: string, question = '') { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW}${question ? ', ' + question : ''})`); }
export function notify(app: App, command: string, name: string, objects: X3DObject[]) { stateOf(app).notifications.push({ name, command, objects: objects.map(o => o.fullName) }); }
export const boolOf = (v: any, d = false): boolean => unset(v) ? d : typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;
/** One undo step: recorded on the bus when `record` is true, applied directly otherwise. */
export function step(app: App, record: boolean, label: string, redo: () => void, undo: () => void) { if (record) app.record(label, redo, undo); else redo(); }

// ------------------------------------------------------------------ nodes
/** A node argument: a node, or a name resolved through the scene (objects, properties, clusters, operators). */
export function nodeOf(app: App, v: any): Node | null {
  if (unset(v)) return null;
  if (Array.isArray(v)) return v.length ? nodeOf(app, v[0]) : null;
  if (v instanceof Node) return v;
  const s = String(v).trim(); const n = findNode(app, s); if (n) return n;
  for (const o of app.scene.allObjects()) {
    for (const c of o.clusters) { if (c.fullName === s) return c; for (const p of c.properties) if (p.fullName === s) return p; }
    for (const p of o.properties) if (p.fullName === s) return p;
    for (const op of o.primitive?.operators ?? []) if (op.fullName === s) return op;
  }
  return null;
}
/** The envelope weight property of an envelope operator (on its object's clusters). */
export function envelopeProperty(o: X3DObject, env: EnvelopeOperator): Property | null {
  return o.allProperties().find(p => p.type === 'envelope' && (p as any).op === env) ?? o.allProperties().find(p => p.type === 'envelope') ?? null;
}
/** Envelope operator behind an envelope weight property. */
export const envelopeOfProperty = (p: Node | null): EnvelopeOperator | null => p instanceof Property && p.type === 'envelope' && (p as any).op instanceof EnvelopeOperator ? (p as any).op : null;
export const isEnvelopeProperty = (n: Node | null): n is Property => !!envelopeOfProperty(n);
export const isWeightMap = (n: Node | null): n is Property => n instanceof Property && n.type === 'weightmap';
export { envelopeOf };

/** Deformers named by items: chain roots give their bones, models their bones / nulls, other objects themselves. */
export function deformersOf(objs: X3DObject[]): X3DObject[] {
  const out: X3DObject[] = [];
  for (const o of objs) {
    if (o instanceof ChainRoot) out.push(...o.bones);
    else if (o instanceof Model) out.push(...[...o.descendants()].filter(c => c.type === 'bone' || c.type === 'null'));
    else out.push(o);
  }
  return [...new Set(out)];
}
export const objectsOf = (items: CsItem[]): X3DObject[] => [...new Set(items.map(i => i.obj).filter((o): o is X3DObject => !!o))];
/** Point indices of a sub-component item (polygons / edges give their points). */
export function itemPoints(it: CsItem): number[] | null {
  if (!it.sub || !it.obj) return null;
  if (it.sub.kind === 'pnt') return [...it.sub.indices];
  return pointsOf(it.obj, it.sub.kind, it.sub.kind === 'edge' ? it.sub.edges.map(e => `${e[0]}-${e[1]}`) : it.sub.indices);
}
export function uniqueClusterName(o: X3DObject, base: string) { let n = base, i = 1; while (o.clusters.some(c => c.name === n)) n = `${base}${i++}`; return n; }
/** A new complete point cluster of an object. */
export function newPointCluster(o: X3DObject, name: string): Cluster {
  const n = (meshOf(o)?.positions.length ?? 0) / 3;
  const c = new Cluster(uniqueClusterName(o, name), 'pnt', new Set(Array.from({ length: n }, (_, i) => i))); c.set('alwayscomplete', true);
  return c;
}
/** Envelope snapshot for undo of the deformer / weight changes. */
export function envSnapshot(env: EnvelopeOperator) {
  const deformers = [...env.deformers]; const weights = env.weights.map(w => Float32Array.from(w)); const refPoses = new Map(env.refPoses); const locked = new Set(env.locked);
  return () => { env.deformers = [...deformers]; env.weights = weights.map(w => Float32Array.from(w)); env.refPoses = new Map(refPoses); env.locked = new Set(locked); env.set('nbdeformers', env.deformers.length); };
}

// ------------------------------------------------------------------ stand-in operators
/** Stand-in for c3dlockenvelopeweightsop: lock flags per (point, deformer) pair of one envelope weight property. */
export class LockEnvelopeWeightsOperator extends Operator {
  readonly locks = new Set<string>();
  readonly siClass = CLS.lockWeights;
  constructor(readonly prop: Property) { super('Lock Envelope Weights Op', 'lockenvelopeweightsop', []); }
  isLocked(point: number, deformer: number) { return this.locks.has(`${point}:${deformer}`); }
  setLock(point: number, deformer: number, on: boolean) { const k = `${point}:${deformer}`; if (on) this.locks.add(k); else this.locks.delete(k); }
  /** Points with at least one locked deformer. */
  lockedPoints(): Set<number> { return new Set([...this.locks].map(k => Number(k.split(':')[0]))); }
}
/** Stand-in for C3DWeightMapsMixerOp: mixes its input weight maps into the weight map port it is connected to. */
export class WeightMapsMixerOperator extends Operator {
  readonly siClass = CLS.mixer;
  constructor(readonly inputs: Property[]) { super('Weight Maps Mixer Op', 'weightmapsmixerop', []); }
}

// ------------------------------------------------------------------ weight-map ports and the connection graph
/** Weight-map input ports of an operator. Port A exists on every operator of this build (inferred: no operator class
 *  data says which have one); port B only on operators that declare `secondWeightMapPort`. */
export interface WeightMapPorts { a: Node | null; b: Node | null; hasB: boolean }
const PORTS = new WeakMap<Operator, WeightMapPorts>();
export function weightMapPorts(op: Operator): WeightMapPorts {
  let p = PORTS.get(op); if (!p) PORTS.set(op, p = { a: null, b: null, hasB: !!(op as any).secondWeightMapPort }); return p;
}
/** Nodes an operator writes (stand-in for its output ports): a mixer writes nothing here; other operators may declare
 *  `outputs` (used by the cycle check). */
export const outputsOf = (op: Operator): Node[] => (op as any).outputs ?? [];
/** Operators that read a node through a weight-map port or a mixer input. */
function readersOf(app: App, n: Node): Operator[] {
  const out: Operator[] = [];
  for (const o of app.scene.allObjects()) for (const op of o.primitive?.operators ?? []) { const p = PORTS.get(op); if (p && (p.a === n || p.b === n)) out.push(op); }
  for (const op of extraOperators) { const p = PORTS.get(op); if (p && (p.a === n || p.b === n)) out.push(op); if (op instanceof WeightMapsMixerOperator && op.inputs.includes(n as Property)) out.push(op); }
  return out;
}
/** Operators that are not in a geometry stack (mixers, lock operators) but take part in the graph. */
export const extraOperators = new Set<Operator>();
/** CycleChecking stand-in: does data flow from `start` back to `start`? Edges: node -> operators reading it,
 *  operator -> its outputs, mixer -> the operators it is connected to. */
export function hasCycle(app: App, start: Node): boolean {
  const seen = new Set<Node>(); const stack: Node[] = [start]; let first = true;
  while (stack.length) {
    const n = stack.pop()!;
    if (!first && n === start) return true;
    first = false; if (seen.has(n)) continue; seen.add(n);
    if (n instanceof Operator) { stack.push(...outputsOf(n)); stack.push(...readersOf(app, n)); }
    else stack.push(...readersOf(app, n));
  }
  return false;
}
