// Ledger row CMD-B12d (optasks.dll): shared state and the "port group instance" service of the operator-input,
// connection and cycle-check commands wired in optasksB12dInputs.ts and optasksB12dConnect.ts.
// Brief: docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md ("Wire contract" per command).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Operators of this build have no input ports. A small stand-in keeps them per operator: port groups, each with a
//    port count, a "dynamic" flag and a list of instances (one connected element per port). Every operator in a stack
//    gets group 0 "In" (one port, the primitive it modifies; the generator has none). The bevel and the Slice
//    Polygons operators get group 1 (dynamic, one port: the profile curve / the plane reference), note section 2.
//  * The four generic child tasks of note section 2 (add / remove / substitute port-group instance, disconnect ports)
//    are `addInstance`, `removeInstance`, `substituteInstance` and `disconnectPorts`; each is one undo record.
//  * A port is passed as a `PortRef` (operator, group, instance, port) or as the string "<operator path>.port[g,i,p]"
//    (inferred spelling: the object model's port names are not in the note).
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). Statuses that are not
//    failures (0, 1, the pick result 0x562e80c7) are kept in `app.optasksB12d.lastStatus`.
//  * XSIOPTASKS message ids are logged with the id; the texts are not in data/si (open question 7).
import { App } from '../core/commands';
import { Node, X3DObject, Operator, Primitive, Cluster } from '../core/scene';
import { Parameter } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { findNode, unset } from './viewEditPropertyHelpers';

export { unset };
export const NOTE = 'docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md';
export const ROW = 'CMD-B12d';
export const S_OK = 0, S_FALSE = 1, SI_PICK = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002, E_FAIL = 0x80004005,
  E_ACCESSDENIED = 0x80070005, E_PENDING = 0x8000000a, E_NOTIMPL = 0x80004001;

/** A sub-component (element kind 7): components of one object. */
export interface SubComponent { obj: X3DObject; kind: 'pnt' | 'edge' | 'poly'; indices: number[] }
export type Connectable = Node | SubComponent;
export interface PortGroup { name: string; ports: number; dynamic: boolean; instances: (Connectable | null)[][] }
/** A port of an operator (the Reference / InputObj port forms of the note). */
export class PortRef {
  constructor(readonly op: Operator, readonly group: number, readonly instance: number, readonly port: number) {}
  get target(): Connectable | null { return groupsOf(this.op)[this.group]?.instances[this.instance]?.[this.port] ?? null; }
  get fullName() { return `${this.op.fullName}.port[${this.group},${this.instance},${this.port}]`; }
}
/** Which port group / instance / ports drive an operator parameter (ConnectOperatorParameter). */
export interface ParamDriver { group: number; instance: number; ports: number[] }

export interface OptasksB12dState {
  lastStatus: { command: string; status: number } | null;
  /** Output arguments of the last run, by command. */
  out: Record<string, Record<string, any>>;
  hooks: {
    /** Interactive pick (prompt XSIOPTASKS 0x3fa): return the picked element, or null when the pick is cancelled. */
    pick?: (prompt: string, command: string) => any;
  };
  /** The undo records of MoveOperator (action, direction, operator, reference, new neighbour). */
  moves: { action: number; direction: number; op: Operator; reference: Node | null; neighbour: Operator | null }[];
  groupsOf(op: Operator): PortGroup[];
  port(op: Operator, group: number, instance: number, port: number): PortRef;
  /** The element a parameter is connected to on delta (F3DConnectOperatorParameterOnDelta stand-in). */
  paramConnection(p: Parameter): Connectable | null;
  /** Declare the ports that drive an operator parameter (the operator's own answer in Softimage). */
  setParamDriver(op: Operator, param: string, d: ParamDriver): void;
}

const groupStore = new WeakMap<Operator, PortGroup[]>();
const paramDrivers = new WeakMap<Operator, Map<string, ParamDriver>>();
export const paramConnections = new WeakMap<Parameter, Connectable>();

export function stateOf(app: App): OptasksB12dState {
  const a = app as any;
  if (a.optasksB12d) return a.optasksB12d;
  const st: OptasksB12dState = {
    lastStatus: null, out: {}, hooks: {}, moves: [],
    groupsOf, port: (op, g, i, p) => new PortRef(op, g, i, p),
    paramConnection: (p) => paramConnections.get(p) ?? null,
    setParamDriver(op, param, d) { driversOf(op).set(param.toLowerCase(), d); },
  };
  a.optasksB12d = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export function setOut(app: App, command: string, a: Record<string, any>, values: Record<string, any>) {
  stateOf(app).out[command] = values; Object.assign(a, values);
}
/** An XSIOPTASKS message: severity 2 = error line, 4 = warning (texts not in data/si, open question 7). */
export function message(app: App, command: string, id: number, severity: 2 | 4 = 2, detail = '') {
  const t = `${command}: [XSIOPTASKS 0x${id.toString(16)}]${detail ? ' ' + detail : ''}`;
  if (severity === 2) app.logMsg('error', t); else app.logMsg('info', `WARNING : ${t}`);
}
export function logNya(app: App, command: string, what: string, q: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW}, ${NOTE} ${q})`); }
export const lockLevel = (x: any): number => Number(x?.lockLevel ?? 0) | 0;

// ------------------------------------------------------------------ the operator model of this build
export const primOf = (op: Operator): Primitive | null => op.parent instanceof Primitive ? op.parent : null;
export const ownerOf = (op: Operator): X3DObject | null => { const o = (op.parent as any)?.parent; return o instanceof X3DObject ? o : null; };
export const isSlice = (op: Operator) => op.type === 'slicepolygonsop';
export const isBevel = (op: Operator) => op.type === 'bevelop';
export const isGenerator = (op: Operator) => { const p = primOf(op); return !!p && p.operators[0] === op; };

/** The port groups of an operator (stand-in, see the header). */
export function groupsOf(op: Operator): PortGroup[] {
  let g = groupStore.get(op);
  if (!g) {
    const prim = primOf(op);
    g = [{ name: 'In', ports: 1, dynamic: false, instances: prim && prim.operators[0] !== op ? [[prim]] : [] }];
    // inferred: group 1 of the bevel / Slice Polygons operators holds the profile curve / plane reference (note 3)
    if (isBevel(op) || isSlice(op)) g.push({ name: isBevel(op) ? 'ProfileCurve' : 'PlaneReference', ports: 1, dynamic: true, instances: [] });
    groupStore.set(op, g);
  }
  return g;
}
function driversOf(op: Operator): Map<string, ParamDriver> { let m = paramDrivers.get(op); if (!m) { m = new Map(); paramDrivers.set(op, m); } return m; }
/** The ports driving a parameter. inferred: a parameter nobody declared gets its own dynamic one-port group, instance 0. */
export function paramDriver(op: Operator, param: string): ParamDriver {
  const m = driversOf(op); const k = param.toLowerCase(); let d = m.get(k);
  if (!d) {
    const groups = groupsOf(op); groups.push({ name: `Param_${param}`, ports: 1, dynamic: true, instances: [] });
    d = { group: groups.length - 1, instance: 0, ports: [0] }; m.set(k, d);
  }
  return d;
}

const snapshot = (g: PortGroup) => g.instances.map(i => [...i]);
export function editGroup(app: App, label: string, op: Operator, group: number, mutate: (g: PortGroup) => void) {
  const g = groupsOf(op)[group]; if (!g) throw fail(E_INVALIDARG, `${label}: ${op.name} has no port group ${group}`);
  const before = snapshot(g); mutate(g); const after = snapshot(g);
  const prim = primOf(op);
  app.record(label, () => { g.instances = after.map(i => [...i]); if (prim) prim.dirty = true; }, () => { g.instances = before.map(i => [...i]); if (prim) prim.dirty = true; });
}
/** Child task "add port-group instance": inserted at `instance`, one element per port. */
export function addInstance(app: App, label: string, op: Operator, group: number, instance: number, inputs: (Connectable | null)[]) {
  editGroup(app, label, op, group, g => {
    const row = Array.from({ length: g.ports }, (_, i) => inputs[Math.min(i, inputs.length - 1)] ?? null);
    g.instances.splice(Math.max(0, Math.min(instance, g.instances.length)), 0, row);
  });
}
/** Child task "remove port-group instance". */
export function removeInstance(app: App, label: string, op: Operator, group: number, instance: number) {
  editGroup(app, label, op, group, g => { if (instance < g.instances.length) g.instances.splice(instance, 1); });
}
/** Child task "substitute port-group instance": replaces the inputs of an existing instance. */
export function substituteInstance(app: App, label: string, op: Operator, group: number, instance: number, inputs: (Connectable | null)[]) {
  editGroup(app, label, op, group, g => {
    while (g.instances.length <= instance) g.instances.push(Array(g.ports).fill(null));   // inferred: a missing instance is created
    g.instances[instance] = Array.from({ length: g.ports }, (_, i) => inputs[Math.min(i, inputs.length - 1)] ?? null);
  });
}
/** Child task "disconnect ports". */
export function disconnectPorts(app: App, label: string, op: Operator, group: number, instance: number, ports: number[]) {
  editGroup(app, label, op, group, g => { const row = g.instances[instance]; if (row) for (const p of ports) if (p < row.length) row[p] = null; });
}
/** Child task "connect ports" (ConnectOperatorParameter). */
export function connectPorts(app: App, label: string, op: Operator, group: number, instance: number, ports: number[], x: Connectable) {
  editGroup(app, label, op, group, g => {
    while (g.instances.length <= instance) g.instances.push(Array(g.ports).fill(null));
    const row = g.instances[instance]; for (const p of ports) if (p < row.length) row[p] = x;
  });
}

// ------------------------------------------------------------------ arguments
/** Items of a list argument: an array, a comma-separated string (commas inside [...] do not split), or one item. */
export function listOf(v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(listOf);
  if (typeof v !== 'string') return [v];
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of v) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(s => s.trim()).filter(Boolean);
}
const COMP: Record<string, SubComponent['kind']> = { pnt: 'pnt', edge: 'edge', poly: 'poly' };
/** An element argument: a PortRef, a sub-component ("obj.pnt[1,2]", a cluster, { obj, kind, indices }) or a node. */
export function elementOf(app: App, x: any): PortRef | SubComponent | Node | null {
  if (unset(x)) return null;
  if (x instanceof PortRef || x instanceof Node) return x;
  if (x && typeof x === 'object' && x.obj instanceof X3DObject && COMP[x.kind] && Array.isArray(x.indices)) return x as SubComponent;
  if (typeof x !== 'string') return null;
  const s = x.trim();
  const pm = /^(.*)\.port\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]$/i.exec(s);
  if (pm) { const op = findNode(app, pm[1]); return op instanceof Operator ? new PortRef(op, +pm[2], +pm[3], +pm[4]) : null; }
  const cm = /^(.*)\.(pnt|edge|poly)\[([^\]]*)\]$/i.exec(s);
  if (cm) {
    const o = findNode(app, cm[1]); if (!(o instanceof X3DObject)) return null;
    const indices: number[] = [];
    for (const part of cm[3].split(',').map(t => t.trim()).filter(Boolean)) { const r = /^(\d+)-(\d+)$/.exec(part); if (r) for (let i = +r[1]; i <= +r[2]; i++) indices.push(i); else if (/^\d+$/.test(part)) indices.push(+part); }
    return { obj: o, kind: COMP[cm[2].toLowerCase()], indices };
  }
  return findNode(app, s) ?? null;
}
export const isSubComponent = (x: any): x is SubComponent => !!x && !(x instanceof Node) && !(x instanceof PortRef) && x.obj instanceof X3DObject && !!COMP[x.kind];
/** Element kind of the note: 7 = a sub-component, 2 = an object, 0 = anything else (inferred numbering of the rest). */
export const elementKind = (x: any): number => isSubComponent(x) || x instanceof Cluster ? 7 : x instanceof X3DObject ? 2 : 0;
/** The object an element belongs to. */
export function ownerObject(x: any): X3DObject | null {
  if (x instanceof X3DObject) return x;
  if (isSubComponent(x)) return x.obj;
  if (x instanceof Cluster) return x.obj;
  if (x instanceof Operator) return ownerOf(x);
  for (let n: any = x?.parent; n; n = n.parent) if (n instanceof X3DObject) return n;
  return null;
}
export const sameElement = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (isSubComponent(a) && isSubComponent(b)) return a.obj === b.obj && a.kind === b.kind && a.indices.join() === b.indices.join();
  return false;
};
export const nameOf = (x: any): string => x == null ? '' : isSubComponent(x) ? `${x.obj.fullName}.${x.kind}[${x.indices.join(',')}]` : String(x.fullName ?? x.name ?? x);
/** A parameter argument: a Parameter, or "<node path>.<parameter>". */
export function paramArg(app: App, x: any): Parameter | null {
  if (unset(x)) return null;
  if (x instanceof Parameter) return x;
  if (typeof x !== 'string') return null;
  const i = x.lastIndexOf('.'); if (i <= 0) return null;
  const n = findNode(app, x.slice(0, i)); return n?.get(x.slice(i + 1)) ?? null;
}
/** First element of a Target / Source list (the bevel and slice commands); null when the list is empty. */
export function firstOfList(app: App, v: any): any { const l = listOf(v); return l.length ? elementOf(app, l[0]) ?? l[0] : null; }
