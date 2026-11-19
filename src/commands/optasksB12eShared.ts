// Ledger row CMD-B12e (optasks.dll): shared state and helpers of the generator-input and transfer-across-generator
// commands wired in optasksB12eGen.ts and optasksB12eTransfer.ts.
// Brief: docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md ("Wire contract" per command). Original code
// written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). Statuses that are not
//    failures (0, 1 = S_FALSE, the "cancelled" 0x562e80c7) are kept in `app.optasksB12e.lastStatus`.
//  * Task errors 0x111..0x115 and the XSIOPTASKS prompts 0x409 / 0x40a are logged with their id (texts not in the
//    repo, note open question 5).
//  * A generator's input connection in this build is an entry of GeneratorOperator.inputs; the generator evaluates
//    every input at its `inputreadregion` (C3DGenerator) level. The position of each input connection in the input's
//    construction stack is kept here per input (stand-in for the construction-marker walk of the note, section 2) and
//    mirrored onto `inputreadregion` so that the geometry follows the move.
//  * Sub-tasks that have no undoable command on this build's bus (MoveOperator, DeleteObj on a shape key or an
//    envelope, SITransferShapeAnimation, ApplyOperator of the PropertyXferOp) are small undoable steps recorded with
//    the sub-task's name; sub-tasks that are commands of this row run through `app.run`, so on a failure the whole
//    command, including already-run sub-tasks, is undone by the command bus.
import { App } from '../core/commands';
import { Node, X3DObject, Operator, Cluster, Property, Material, REGIONS, construction } from '../core/scene';
import { GeneratorOperator } from '../core/scene2';
import { EnvelopeOperator } from '../core/envelope';
import { SiStatusError } from './alembicSeqCam';
import { findNode, siConst, unset } from './viewEditPropertyHelpers';
import { listOf } from './tasksB11cShared';

export { unset, listOf };
export const NOTE = 'docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md';
export const ROW = 'CMD-B12e';
export const S_OK = 0, S_FALSE = 1, SI_CANCEL = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_NOTIMPL = 0x80004001,
  E_UNEXPECTED = 0x8000ffff, E_OUTOFMEMORY = 0x8007000e;
/** XSIOPTASKS prompts (note section 2). */
export const MSG_UNTRANSFER = 0x409, MSG_TRANSFER_REMAINING = 0x40a;
/** Task error ids (note section 2). */
export const ERR_GENERATOR = 0x111, ERR_OBJECT = 0x112, ERR_CLUSTER = 0x113, ERR_CLUSTER_PROP = 0x114, ERR_PROPERTY = 0x115;
/** Construction-marker operator classes and the read position each one stands for (note section 2). */
export const MARKER_CLASSES: Record<string, number> = {
  '9b82aced-9947-4fd0-87ae-4ac0a3d42bea': 0, 'b0a5373d-e8b3-4816-bc5a-a6a31e4b4158': 1,
  '0d29533c-b095-48f8-88b9-bdf8419453e7': 2, 'dba00978-85be-4d94-aec5-422ecb4ee4bd': 3,
};
/** Operator preset class ApplyOperator receives from PropertyTransfer (the PropertyXferOp class, inferred by the analyst). */
export const PROPERTY_XFER_PRESET = 'd46e5407-66fc-46b4-8fc4-aefd5f9f906f';

export type Answer = 'yes' | 'no' | 'cancel';
export interface ClusterLink { source: Cluster | Property; op: Operator; mode: number; command: string }
export interface MoveRecord { op: Operator; input: X3DObject; position: number; action: 'top' | 2 }

export interface OptasksB12eState {
  lastStatus: { command: string; status: number } | null;
  /** Position of each input connection of a generator in its input's construction stack (0..3). */
  readPositions: Map<Operator, Map<X3DObject, number>>;
  /** Clusters / cluster properties created on a generated object, linked to their source through the generator. */
  links: Map<Node, ClusterLink>;
  /** Clusters registered with a generator operator. */
  opClusters: Map<Operator, Cluster[]>;
  /** Shape keys transferred onto a generated object: key -> source key and generator. */
  transferredShapes: Map<Property, { source: Property; op: Operator }>;
  /** Nodes created by a command of the row, with the creating command (the "created by this command" mark). */
  createdBy: Map<Node, string>;
  /** MoveOperator sub-tasks run (newest last). */
  moves: MoveRecord[];
  /** Yes / No / Cancel boxes shown (id, command, answer). */
  prompts: { id: number; command: string; answer: Answer }[];
  hooks: {
    /** The Yes / No / Cancel message box. Without a hook the box is logged as not yet attested and answered No. */
    prompt?: (id: number, command: string) => Answer | null | undefined;
  };
}

export function stateOf(app: App): OptasksB12eState {
  const a: any = app;
  if (a.optasksB12e) return a.optasksB12e;
  const st: OptasksB12eState = {
    lastStatus: null, readPositions: new Map(), links: new Map(), opClusters: new Map(), transferredShapes: new Map(),
    createdBy: new Map(), moves: [], prompts: [], hooks: {},
  };
  a.optasksB12e = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
export const hex = (n: number) => '0x' + n.toString(16);
/** A task error raised with its id at severity 2, then the command fails with 0x80070057 (note section 2). */
export function raiseInvalid(app: App, command: string, id: number, detail: string): SiStatusError {
  app.logMsg('error', `${command}: [XSIOPTASKS ${hex(id)}] ${detail}`);
  return fail(E_INVALIDARG, `${command}: ${detail}`);
}
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }

// ------------------------------------------------------------------ arguments
/** Resolve one item of an argument: nodes, names, and cluster properties by full name. */
export function resolve(app: App, x: any): Node | null {
  const n = findNode(app, x); if (n) return n;
  if (typeof x !== 'string') return null;
  for (const o of app.scene.allObjects()) for (const c of o.clusters) {
    if (c.fullName === x) return c;
    for (const p of c.properties) if (p.fullName === x || `${o.name}.${c.name}.${p.name}` === x || `${o.name}.cls.${c.name}.${p.name}` === x) return p;
  }
  return null;
}
/** A list argument; when omitted, the selection (SingleObj / Collection argument handlers, inferred like CMD-B11c). */
export function nodesArg(app: App, v: any, selectionDefault = true): Node[] {
  if (unset(v)) return selectionDefault ? [...app.selection] : [];
  const out: Node[] = [];
  for (const x of listOf(v)) { const n = resolve(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
export const nodeArg = (app: App, v: any, selectionDefault = true): Node | null => nodesArg(app, v, selectionDefault)[0] ?? null;
export function numArg(v: any, dflt: number): number { if (unset(v)) return dflt; const n = Number(v); return Number.isFinite(n) ? n : dflt; }
export function boolArg(v: any, dflt: boolean): boolean {
  if (unset(v)) return dflt;
  if (typeof v === 'string') return !/^(false|0|no)$/i.test(v.trim());
  return !!v;
}

// ------------------------------------------------------------------ construction modes
/** siConstructionMode names (inferred from the SDK enum by the analyst; the numbers are attested). 4 = current mode. */
const MODE_NAMES: Record<string, number> = {
  siConstructionModeModeling: 0, siConstructionModePrimaryShape: 1, siConstructionModeAnimation: 2, siConstructionModeSecondaryShape: 3,
  siConstructionModeDefault: 4,   // inferred: the name of "the scene's current construction mode"
  modeling: 0, shape: 1, animation: 2, secondaryshape: 3,
};
/** A construction-mode argument: a number, a mode name; NaN when unreadable. */
export function modeArg(v: any): number {
  const c = siConst(v); if (c === null) return NaN;
  if (typeof c === 'number') return c;
  const k = Object.keys(MODE_NAMES).find(n => n.toLowerCase() === c.toLowerCase());
  return k === undefined ? NaN : MODE_NAMES[k];
}
export const currentMode = (): number => Math.max(0, REGIONS.indexOf(construction.mode));

// ------------------------------------------------------------------ generators
export function isGenerator(n: any): n is Operator & { inputs: X3DObject[] } {
  if (n instanceof GeneratorOperator) return true;
  return n instanceof Operator && Array.isArray((n as any).inputs) && typeof (n as any).owner === 'function';
}
/** The operator's input connections (their objects). Operators without inputs have none. */
export function genInputs(op: Node | null): X3DObject[] {
  const ins = (op as any)?.inputs; return Array.isArray(ins) ? ins.filter((o: any): o is X3DObject => o instanceof X3DObject) : [];
}
/** The object the generator writes (its output). */
export function genOwner(op: Node | null): X3DObject | null {
  if (!op) return null;
  const f = (op as any).owner; const o = typeof f === 'function' ? f() : null;
  if (o instanceof X3DObject) return o;
  const p = (op as any).parent?.parent; return p instanceof X3DObject ? p : null;
}
/** The generator operator found on an object's geometry (at the current time). */
export function generatorOn(o: Node): Operator | null {
  if (!(o instanceof X3DObject)) return null;
  return (o.primitive?.operators.find(op => isGenerator(op)) as Operator | undefined) ?? null;
}
/** Read position of one input connection (note section 2: no marker found, or the operator itself reached first -> 3). */
export function readPositionOf(app: App, op: Operator, input: X3DObject): number {
  if (input.primitive?.operators.includes(op)) return 3;
  const stored = stateOf(app).readPositions.get(op)?.get(input); if (stored !== undefined) return stored;
  const p = op.get('inputreadregion');
  if (p) { const v = Number(p.value); if (v >= 0 && v <= 3) return v; }
  return 3;
}
/** MoveOperator sub-task stand-in: move the input connection to `position` (3 = top of the stack, 0..2 = at that marker). */
export function moveInputConnection(app: App, op: Operator, input: X3DObject, position: number) {
  const st = stateOf(app);
  const map = st.readPositions.get(op) ?? new Map<X3DObject, number>();
  const had = map.has(input), old = map.get(input);
  const rec: MoveRecord = { op, input, position, action: position === 3 ? 'top' : 2 };
  app.record('MoveOperator', () => {
    map.set(input, position); st.readPositions.set(op, map); st.moves.push(rec);
    const prim = genOwner(op)?.primitive; if (prim) prim.dirty = true;
  }, () => {
    if (had) map.set(input, old!); else map.delete(input);
    const i = st.moves.lastIndexOf(rec); if (i >= 0) st.moves.splice(i, 1);
    const prim = genOwner(op)?.primitive; if (prim) prim.dirty = true;
  });
}

// ------------------------------------------------------------------ shape and envelope items
export interface ShapeItem { item: Property; sources: Property[]; input: X3DObject }
/** The generator's shape items: the shape keys of its inputs as seen through the generator. Each item references its
 *  source keys (`shapeSources` on the key when set, else the key itself).   // inferred: list not described by the note */
export function genShapeItems(op: Node | null): ShapeItem[] {
  const out: ShapeItem[] = [];
  for (const input of genInputs(op)) for (const k of input.properties) if (k.type === 'shapekey') {
    const s = (k as any).shapeSources; out.push({ item: k, sources: Array.isArray(s) ? s : [k], input });
  }
  return out;
}
/** Shape keys transferred onto the generated object through this generator (still on it). */
export function transferredShapesOf(app: App, op: Operator): Property[] {
  const o = genOwner(op); if (!o) return [];
  return [...stateOf(app).transferredShapes].filter(([k, v]) => v.op === op && o.properties.includes(k)).map(([k]) => k);
}
/** Envelope items of the generated object.   // inferred: every envelope operator on the generated object's stack */
export function envelopesOf(op: Operator): Operator[] {
  return (genOwner(op)?.primitive?.operators ?? []).filter(x => x instanceof EnvelopeOperator);
}
/** Animation items an object holds (shape keys, animation-region operators).   // inferred */
export function animationItems(o: X3DObject): Node[] {
  return [...o.properties.filter(p => p.type === 'shapekey'), ...(o.primitive?.operators.filter((x, i) => i > 0 && x.region === 'animation') ?? [])];
}

/** The tri-state "ask" rule (note section 2): 0 do it, 1 do not, 2 ask; Yes / No are stored back into the argument. */
export function triState(app: App, command: string, a: Record<string, any>, arg: string, msgId: number): 'do' | 'dont' | 'cancel' {
  const v = Number(a[arg]);
  if (v === 0) return 'do';
  if (v === 1) return 'dont';
  const st = stateOf(app);
  let ans = st.hooks.prompt?.(msgId, command) ?? null;
  app.logMsg('info', `${command}: [XSIOPTASKS ${hex(msgId)}] Yes / No / Cancel`);
  if (ans !== 'yes' && ans !== 'no' && ans !== 'cancel') { logNya(app, command, `the text of message box XSIOPTASKS ${hex(msgId)}; answered No`); ans = 'no'; }
  st.prompts.push({ id: msgId, command, answer: ans });
  if (ans === 'cancel') return 'cancel';
  a[arg] = ans === 'yes' ? 0 : 1;
  return ans === 'yes' ? 'do' : 'dont';
}

/** DeleteObj sub-task (delete flag 0x10) on a shape key or an envelope operator: an undoable removal. */
export function deleteItem(app: App, n: Node) {
  if (n instanceof Operator) {
    const prim: any = n.parent; if (!prim?.operators) return;
    const i = prim.operators.indexOf(n);
    app.record('DeleteObj', () => prim.removeOperator(n), () => { prim.operators.splice(Math.min(i, prim.operators.length), 0, n); n.parent = prim; prim.dirty = true; });
  } else if (n instanceof Property) {
    const owner: any = n.parent; if (!owner?.properties) return;
    const i = owner.properties.indexOf(n);
    app.record('DeleteObj', () => owner.removeProperty(n), () => { owner.properties.splice(Math.min(i, owner.properties.length), 0, n); n.parent = owner; });
  }
}

/** A copy of a property: same type and parameter values (array values copied). */
export function copyProperty(p: Property, name: string): Property {
  const dup = (v: any): any => Array.isArray(v) ? v.map(dup) : ArrayBuffer.isView(v) ? (v as any).slice() : v;
  return new Property(name || p.name, p.type, p.params.map(x => ({ ...x.def, value: dup(x.value) })));
}
/** Unique name among siblings. */
export const uniqueIn = (list: { name: string }[], base: string) => { if (!list.some(x => x.name === base)) return base; let i = 1; while (list.some(x => x.name === `${base}${i}`)) i++; return `${base}${i}`; };
/** The object a node belongs to (property, cluster, cluster property, material owner). */
export function ownerObject(n: Node): X3DObject | null {
  let p: any = n;
  while (p && !(p instanceof X3DObject)) p = p.parent ?? null;
  return p ?? null;
}
export { X3DObject, Operator, Cluster, Property, Material, Node };
