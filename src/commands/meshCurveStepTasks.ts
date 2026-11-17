// Ledger row CMD-B8f. Brief: docs/ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md, "Wire contract" sections and
// "Shared facts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   simeshtasks   AddPointToNewPolygon RemovePointFromPolygon ConnectNewPolygonToPoint ConnectNewPolygonToEdge
//                 AddPointInteriorToPolygon RemoveLastPointInteriorToPolygon TerminateAddEdgeWithInteriorPoints
//                 SnapOffsetToPointForSlicePolygons
//   (cluster commands of simeshtasks: meshCurveStepTasksClusters.ts; sicurvetasks: meshCurveStepTasksCurves.ts)
//
// How the contract is mapped onto this build:
//  * The polygon-builder operator (2.2) is PolygonBuilderOperator below: the ordered entry list of the contract
//    (kind, xyz, id, flag) with its six methods. The step commands never create it; the tool does, here through
//    the seam `app.meshCurveStepTasks.tool.applyPolygonBuilder(obj)`.
//  * The interior-point operator (2.3) is this build's Add Edge operator (type `addedgeop`); its interior point
//    list is kept beside the operator (`interiorPointsOf`).
//  * Task status codes that are not failures (0, 1) are kept in `app.meshCurveStepTasks.lastStatus`; failure
//    statuses are thrown as SiStatusError. Message texts of ids 0x3fc, 0x91, 0xd0 are not resolved: lines carry the id.
//  * Output arguments (RePackArg) are written back into the argument record of the call and into
//    `app.meshCurveStepTasks.out[<command>]`.
//  * Undo / redo: every change goes through `app.record`, so the command bus undoes the step as one entry.
// None of the 19 names was registered before this row.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Operator, Cluster } from '../core/scene';
import { bool, num } from '../core/params';
import { toPolys, fromPolys, selPoints } from '../core/topology';
import type { MeshData } from '../core/geometry';
import { SiStatusError } from './alembicSeqCam';
import { unset, boolArg, findNode, findObject } from './viewEditPropertyHelpers';
import { TopologyOperator2 } from './model';
import { registerMeshCurveStepTaskClusters } from './meshCurveStepTasksClusters';
import { registerMeshCurveStepTaskCurves } from './meshCurveStepTasksCurves';

export const NOTE = 'docs/ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md';
export const S_OK = 0;
export const S_NOTHING = 1;
export const E_NOTIMPL = 0x80004001;
export const E_NOINTERFACE = 0x80004002;
export const E_POINTER = 0x80004003;
export const E_FAIL = 0x80004005;
export const E_OUTOFMEMORY = 0x8007000e;
export const E_INVALIDARG = 0x80070057;
export const E_UNEXPECTED = 0x8000ffff;
export type V3 = [number, number, number];

export interface InteriorPoint { offsets: [number, number, number]; weights: [number, number, number]; height: number }
export interface MeshCurveStepTasksState {
  lastStatus: { command: string; status: number } | null;
  /** Output arguments of the last call of each command. */
  out: Record<string, Record<string, any>>;
  quirks: {
    /** Q3: scripting names of the Slice Polygons parameters the snap command addresses by numeric id. `null` = not attested. */
    sliceParams: { offset: string | null; angle: string | null; id0x10: string | null; id0x11: string | null };
  };
  /** What the interactive tools do before they run the step commands (the commands never create these operators). */
  tool: {
    applyPolygonBuilder(obj: X3DObject | string): PolygonBuilderOperator;
    applyAddEdge(obj: X3DObject | string, a: number, b: number): Operator;
    applySlicePolygons(obj: X3DObject | string): Operator;
  };
  polygonBuilderOf(obj: X3DObject | string): PolygonBuilderOperator | null;
  interiorPoints(op: Operator): InteriorPoint[];
  endEdge(op: Operator): number | null;
  /** Reference-model lock check of CurveDirectManip (lock levels 4 and 1). Seam: locks are not modelled on objects here. */
  isLocked: ((obj: X3DObject) => boolean) | null;
  /** Set by meshCurveStepTasksClusters.ts: the operator port group a cluster is connected to. */
  portConnection?: (c: Cluster) => { operator: Operator; group: number } | null;
  connectedClusters?: (op: Operator) => { cluster: Cluster; group: number }[];
  /** The two geometric readings of ConnectNewPolygonToEdge, for the check script. */
  geometry: { edgeInfo: typeof edgeInfo; segmentsCross: typeof segmentsCross };
}
export const stateOf = (app: App): MeshCurveStepTasksState => (app as any).meshCurveStepTasks;

// ------------------------------------------------------------------ small helpers
export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
export const msgId = (id: number) => `message ${hex(id)}; text not yet attested`;
export function fail(status: number, what: string, id?: number): SiStatusError {
  return new SiStatusError(status, id === undefined ? what : `${what} (${msgId(id)})`);
}
export function setStatus(app: App, command: string, status: number): void { stateOf(app).lastStatus = { command, status }; }
export function setOut(app: App, command: string, a: Record<string, any>, values: Record<string, any>): void {
  Object.assign(a, values); stateOf(app).out[command] = { ...values };
}
export function logNya(app: App, command: string, what: string, question = ''): void {
  app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
}
export const intArg = (v: any, dflt = 0): number => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : dflt; };
export const dblArg = (v: any, dflt = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : dflt; };
export function objectOf(app: App, x: any): X3DObject | null {
  if (x instanceof X3DObject) return x;
  if (Array.isArray(x)) return x.length ? objectOf(app, x[0]) : null;
  if (typeof x === 'string' && x) return findObject(app, x.trim()) ?? null;
  return null;
}
export function operatorOf(app: App, x: any): Operator | null {
  if (Array.isArray(x)) return x.length ? operatorOf(app, x[0]) : null;
  const n = x instanceof Node ? x : typeof x === 'string' ? findNode(app, x.trim()) : undefined;
  return n instanceof Operator ? n : null;
}
export function ownerOf(op: Operator): X3DObject | null {
  const o = (op.parent as any)?.parent; return o instanceof X3DObject ? o : null;
}
/** Geometry entering an operator: the stack below it, evaluated. */
export function inputGeom(op: Operator): any {
  const prim: any = op.parent; if (!prim?.operators) return null;
  let g: any = null;
  for (const x of prim.operators as Operator[]) { if (x === op) break; try { g = x.apply(g); } catch { /* an operator that cannot evaluate passes nothing on */ } }
  return g;
}
export function touch(app: App, op: Operator): void { const prim: any = op.parent; if (prim) prim.dirty = true; app.events.emit('scene'); }
/** A point sub-component argument: the owner and its indices. Accepts "obj.pnt[3,5-7]", a point cluster, or { obj, kind, indices }. */
export function pointSubComponent(app: App, x: any): { obj: X3DObject; indices: number[] } | null {
  if (Array.isArray(x)) return x.length ? pointSubComponent(app, x[0]) : null;
  if (x instanceof Cluster) return x.compKind === 'pnt' && x.obj ? { obj: x.obj, indices: [...x.elements].map(Number) } : null;
  if (typeof x === 'string') {
    const m = /^(.*)\.pnt\[([^\]]*)\]$/.exec(x.trim());
    if (m) {
      const obj = findObject(app, m[1]); if (!obj) return null;
      const indices: number[] = [];
      for (const part of m[2].split(',')) {
        const r = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part); if (!r) continue;
        for (let i = Number(r[1]); i <= Number(r[2] ?? r[1]); i++) indices.push(i);
      }
      return { obj, indices };
    }
    const n = findNode(app, x.trim()); return n instanceof Cluster ? pointSubComponent(app, n) : null;
  }
  if (x && typeof x === 'object') {
    const obj = objectOf(app, x.obj); const kind = x.kind ?? x.type;
    if (!obj || (kind !== 'point' && kind !== 'pnt')) return null;
    const src = x.indices ?? x.points ?? x.elements ?? [];
    return { obj, indices: [...src].map(Number) };
  }
  return null;
}

// ------------------------------------------------------------------ the polygon-builder operator (2.2)
export interface BuilderEntry { /** 0 = reference to an existing mesh point, non-zero = new point */ kind: number; x: number; y: number; z: number; id: number; flag: number }
/** The ordered point list of the polygon under construction. Position index 0 means "append at the end". */
export class PolygonBuilderOperator extends Operator {
  private list: BuilderEntry[] = [];
  // The operator's class name is not in the contract; the label is this build's Add Polygon tool name.
  constructor() { super('Add Polygon', 'polygonbuilderop', [bool('mute', false, 'Mute')]); }
  private inputCounts(): { points: number; polygons: number } {
    const g = inputGeom(this); return { points: g?.positions ? g.positions.length / 3 : 0, polygons: g?.polygons?.length ?? 0 };
  }
  private place(position: number, e: BuilderEntry): void { if (position === 0 || position >= this.list.length) this.list.push(e); else this.list.splice(position, 0, e); }
  /** Slot 3. */
  insertNew(position: number, x: number, y: number, z: number): void { this.place(position, { kind: 1, x, y, z, id: -1, flag: 0 }); }
  /** Slot 4. */
  insertExisting(position: number, id: number, invert: boolean): void { this.place(position, { kind: 0, x: 0, y: 0, z: 0, id, flag: invert ? 1 : 0 }); }
  /** Slot 5. */
  removeAt(index: number): void { if (index >= 0 && index < this.list.length) this.list.splice(index, 1); }
  /** Slot 7. */
  get count(): number { return this.list.length; }
  /** Slot 8: a copy of all entries. inferred: a new point's id field is the id the mesh gives it, input point
   *  count + its rank among the new points (the contract only says the id field is what AddPointToNewPolygon returns). */
  entries(): BuilderEntry[] {
    const base = this.inputCounts().points; let k = 0;
    return this.list.map(e => e.kind !== 0 ? { ...e, id: base + k++ } : { ...e });
  }
  /** Slot 6, published as PolygonID. inferred (Q8): the index of the polygon the list produces, -1 while it produces none. */
  polygonId(): number { return this.producesPolygon() ? this.inputCounts().polygons : -1; }
  private producesPolygon(): boolean { return new Set(this.entries().map(e => e.id)).size >= 3; }
  apply(m: MeshData | null): MeshData | null {
    if (!m || !m.positions || this.val('mute')) return m;
    const es = this.entries(); const fresh = es.filter(e => e.kind !== 0);
    const { verts, faces } = toPolys(m);
    if (new Set(es.map(e => e.id)).size < 3 || es.some(e => e.kind === 0 && (e.id < 0 || e.id >= verts.length))) return m;
    for (const e of fresh) verts.push([e.x, e.y, e.z]);
    const face = es.map(e => e.id);
    // inferred: the invert flag given with an existing point reverses the winding of the polygon under construction
    if (es.some(e => e.flag !== 0)) face.reverse();
    faces.push(face);
    return fromPolys(verts, faces);
  }
}
export function findBuilder(obj: X3DObject): PolygonBuilderOperator | null {
  const ops = obj.primitive?.operators ?? [];
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i] instanceof PolygonBuilderOperator) return ops[i] as PolygonBuilderOperator;
  return null;
}
const prevIndex = (position: number, count: number) => ((position - 1) % count + count) % count;

function addPointToNewPolygon(app: App, a: Record<string, any>): number {
  const C = 'AddPointToNewPolygon';
  const obj = objectOf(app, a.InputObj); if (!obj) throw fail(E_POINTER, `${C}: no input object`);
  const op = findBuilder(obj); if (!op) throw fail(E_UNEXPECTED, `${C}: no polygon-builder operator on ${obj.name}`);
  const pos = intArg(a.InsertPosition); const x = dblArg(a.X), y = dblArg(a.Y), z = dblArg(a.Z);   // no space conversion
  app.record(C, () => { op.insertNew(pos, x, y, z); touch(app, op); }, () => { op.removeAt(pos === 0 ? op.count - 1 : pos); touch(app, op); });
  const es = op.entries(); const e = pos === 0 ? es[es.length - 1] : es[pos];
  const value = e ? e.id : -1;
  setOut(app, C, a, { PolygonID: op.polygonId(), Value: value }); setStatus(app, C, S_OK);
  return value;
}
function removePointFromPolygon(app: App, a: Record<string, any>): void {
  const C = 'RemovePointFromPolygon';
  const obj = objectOf(app, a.InputObj); if (!obj) throw fail(E_POINTER, `${C}: no input object`);
  const op = findBuilder(obj); if (!op) throw fail(E_UNEXPECTED, `${C}: no polygon-builder operator on ${obj.name}`);
  const id = intArg(a.PointID); const es = op.entries();
  const index = es.findIndex(e => e.id === id);   // the entry kind is not checked
  if (index < 0) throw fail(E_INVALIDARG, `${C}: no entry with point id ${id}`);
  const saved = es[index];
  app.record(C, () => { op.removeAt(index); touch(app, op); }, () => {
    // as read: a saved index equal to the current count is re-inserted at position 0 (append)
    if (index > op.count) throw fail(E_UNEXPECTED, `${C}: undo index ${index} out of range`);
    const at = index === op.count ? 0 : index;
    if (saved.kind !== 0) op.insertNew(at, saved.x, saved.y, saved.z); else op.insertExisting(at, saved.id, saved.flag !== 0);
    touch(app, op);
  });
  setOut(app, C, a, { PolygonID: op.polygonId() }); setStatus(app, C, S_OK);
}
/** Remove the kind-0 entry whose id is `id` (undo of the two Connect commands). */
function removeExisting(op: PolygonBuilderOperator, id: number): void {
  const i = op.entries().findIndex(e => e.kind === 0 && e.id === id); if (i >= 0) op.removeAt(i);
}
function connectNewPolygonToPoint(app: App, a: Record<string, any>): number | undefined {
  const C = 'ConnectNewPolygonToPoint';
  const stop = (why: string) => { logNya(app, C, `the status returned when ${why}; the command stops`, 'Q1'); setStatus(app, C, S_NOTHING); return undefined; };
  const obj = objectOf(app, a.InputObj);
  if (!obj?.primitive?.mesh()) return stop('the object has no geometry');
  const op = findBuilder(obj); if (!op) return stop('no polygon-builder operator is on the object');
  const id = intArg(a.PointID), pos = intArg(a.InsertPosition), invert = boolArg(a.InvertPolygon);
  const es = op.entries(); const n = es.length;
  const neighbour = n > 0 && (es[pos]?.id === id || es[prevIndex(pos, n)]?.id === id);
  let status = S_NOTHING;
  if (!neighbour && id !== -1) {
    app.record(C, () => { op.insertExisting(pos, id, invert); touch(app, op); }, () => { removeExisting(op, id); touch(app, op); });
    status = S_OK;
  }
  const polygonId = op.polygonId();
  setOut(app, C, a, { PolygonID: polygonId }); setStatus(app, C, status);
  return polygonId;
}

/** Edge description behind geometry slots 77/78/86/87/88. inferred: edge ids follow the first appearance of an edge
 *  walking the polygons; the first end point (slot 77) and second (slot 78) are in the direction the first polygon
 *  walks the edge; the slot-88 side is the polygon walking it first -> second, the slot-87 side the one walking it
 *  second -> first. With that reading the contract's choice of A and B gives the new polygon the winding opposite to
 *  its neighbour across the edge, which is the stated purpose. */
export function edgeInfo(m: MeshData, edgeId: number): { first: number; second: number; side87: number; side88: number } | null {
  const seen = new Map<string, number>(); let found: { first: number; second: number } | null = null;
  for (const f of m.polygons) {
    for (let i = 0; i < f.length; i++) {
      const p = f[i], q = f[(i + 1) % f.length]; const k = p < q ? `${p}-${q}` : `${q}-${p}`;
      if (seen.has(k)) continue;
      if (seen.size === edgeId) found = { first: p, second: q };
      seen.set(k, seen.size);
    }
    if (found) break;
  }
  if (!found) return null;
  let side87 = -1, side88 = -1;
  m.polygons.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const p = f[i], q = f[(i + 1) % f.length];
      if (p === found!.first && q === found!.second && side88 < 0) side88 = fi;
      if (p === found!.second && q === found!.first && side87 < 0) side87 = fi;
    }
  });
  return { ...found, side87, side88 };
}
const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
/** Step 4: do segment p0 -> p1 and segment q0 -> q1 cross? The closest point of the first line to the second line
 *  must lie on the first segment (parameter in (-1e-6, 1.000001)) and within 1e-6 of the second segment.
 *  Closest points of two lines: the standard skew-line formula (public geometry). */
export function segmentsCross(p0: V3, p1: V3, q0: V3, q1: V3): boolean {
  const d1 = sub(p1, p0), d2 = sub(q1, q0); const n = cross(d1, d2); const nn = dot(n, n);
  if (nn < 1e-12) return false;   // parallel or degenerate: the lines do not meet (status other than 1)
  const w = sub(q0, p0);
  const t = dot(cross(w, d2), n) / nn;
  if (!(t > -1e-6 && t < 1.000001)) return false;
  const c: V3 = [p0[0] + d1[0] * t, p0[1] + d1[1] * t, p0[2] + d1[2] * t];
  const len2 = dot(d2, d2); const s = len2 > 0 ? Math.max(0, Math.min(1, dot(sub(c, q0), d2) / len2)) : 0;
  const on: V3 = [q0[0] + d2[0] * s, q0[1] + d2[1] * s, q0[2] + d2[2] * s];
  return Math.sqrt(dot(sub(c, on), sub(c, on))) < 1e-6;
}
function connectNewPolygonToEdge(app: App, a: Record<string, any>): number | undefined {
  const C = 'ConnectNewPolygonToEdge';
  const stop = (why: string) => { logNya(app, C, `the status returned when ${why}; the command stops`, 'Q1'); setStatus(app, C, S_NOTHING); return undefined; };
  const obj = objectOf(app, a.InputObj); const m = obj?.primitive?.mesh();
  if (!obj || !m) return stop('the object has no geometry');
  const pos = intArg(a.InsertPosition), invert = boolArg(a.InvertPolygon);
  const edge = edgeInfo(m, intArg(a.EdgeID)); if (!edge) return stop('the edge does not exist');
  let A: number | null = null, B: number | null = null;
  if (edge.side88 >= 0) { A = edge.second; B = edge.first; } else if (edge.side87 >= 0) { A = edge.first; B = edge.second; }
  const op = findBuilder(obj); if (!op) return stop('no polygon-builder operator is on the object');
  const es = op.entries(); const n = es.length;
  if (n > 0) {
    if (A !== null && A === es[prevIndex(pos, n)]?.id) A = null;
    if (B !== null && B === es[pos]?.id) B = null;
  }
  if (n > 1 && A !== null && B !== null) {
    const position = (e: BuilderEntry | undefined): V3 | null => !e ? null : e.kind !== 0 ? [e.x, e.y, e.z] : pointOf(m, e.id);
    const before = position(es[prevIndex(pos, n)]), current = position(es[pos]), pa = pointOf(m, A), pb = pointOf(m, B);
    if (before && current && pa && pb && segmentsCross(before, pa, pb, current)) { const t = A; A = B; B = t; }
  }
  const first = A, second = B;
  const insert = () => {
    if (pos === 0) { if (first !== null) op.insertExisting(0, first, invert); if (second !== null) op.insertExisting(0, second, invert); }
    else { if (second !== null) op.insertExisting(pos, second, invert); if (first !== null) op.insertExisting(pos, first, invert); }
    touch(app, op);
  };
  if (first !== null || second !== null) {
    app.record(C, insert, () => { if (first !== null) removeExisting(op, first); if (second !== null) removeExisting(op, second); touch(app, op); });
  }
  const polygonId = op.polygonId();
  setOut(app, C, a, { PolygonID: polygonId }); setStatus(app, C, first !== null || second !== null ? S_OK : S_NOTHING);
  return polygonId;
}
function pointOf(m: MeshData, i: number): V3 | null {
  return i >= 0 && i * 3 + 2 < m.positions.length ? [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]] : null;
}

// ------------------------------------------------------------------ the interior-point operator (2.3)
const interior = new WeakMap<Operator, InteriorPoint[]>();
const endEdges = new WeakMap<Operator, number>();
export function interiorPointsOf(op: Operator): InteriorPoint[] { let l = interior.get(op); if (!l) interior.set(op, l = []); return l; }
/** The `Operator` argument of the three Add Edge step commands. */
function addEdgeOperator(app: App, command: string, x: any, needOwner: boolean): Operator {
  if (unset(x)) throw fail(E_POINTER, `${command}: no operator`);
  const op = operatorOf(app, x); if (!op) throw fail(E_POINTER, `${command}: no operator`);
  if (op.type !== 'addedgeop') throw fail(E_NOINTERFACE, `${command}: ${op.name} is not an Add Edge operator`);
  if (needOwner && !ownerOf(op)) throw fail(E_NOINTERFACE, `${command}: the operator has no component hierarchy`);
  return op;
}
function addPointInteriorToPolygon(app: App, a: Record<string, any>): void {
  const C = 'AddPointInteriorToPolygon';
  const op = addEdgeOperator(app, C, a.Operator, true);
  // PolygonID is read but not forwarded to the operator.
  const point: InteriorPoint = {
    offsets: [intArg(a.FirstOffset) >>> 0, intArg(a.SecondOffset) >>> 0, intArg(a.ThirdOffset) >>> 0],
    weights: [dblArg(a.FirstWeight), dblArg(a.SecondWeight), dblArg(a.ThirdWeight)], height: dblArg(a.Height),
  };
  const list = interiorPointsOf(op);
  app.record(C, () => { list.push(point); touch(app, op); }, () => { list.pop(); touch(app, op); });
  logNya(app, C, 'the effect of interior points on the Add Edge result (the point is stored on the operator; inferred reading: three polygon corners, barycentric weights, height off the plane)');
  setStatus(app, C, S_OK);
}
function removeLastPointInteriorToPolygon(app: App, a: Record<string, any>): void {
  const C = 'RemoveLastPointInteriorToPolygon';
  const op = addEdgeOperator(app, C, a.Operator, false);
  const list = interiorPointsOf(op);
  if (!list.length) { setStatus(app, C, S_NOTHING); return; }   // inferred: nothing to read back, nothing removed
  const saved = list[list.length - 1];
  app.record(C, () => { list.pop(); touch(app, op); }, () => { list.push(saved); touch(app, op); });
  setStatus(app, C, S_OK);
}
function terminateAddEdgeWithInteriorPoints(app: App, a: Record<string, any>): void {
  const C = 'TerminateAddEdgeWithInteriorPoints';
  const op = addEdgeOperator(app, C, a.Operator, false);
  // Step 1: port (1, 0, 0) must be connected. inferred: an operator that sits in an object's stack has it connected.
  if (!ownerOf(op)) throw fail(E_UNEXPECTED, `${C}: port (1, 0, 0) of the operator is not connected`);
  const edge = intArg(a.EdgeID) >>> 0, ratio = dblArg(a.Ratio);
  // Step 4: descriptor (0x402, 1). inferred: the operator's first parameter in the SPDL data, `ratioedge`.
  const p = op.get('ratioedge') ?? op.add(num('ratioedge', 0, 'Ratio Edge'));
  // Undo as read: the same worker with edge id -1; the ratio write is undone through the task's own undo context.
  app.record(C, () => { endEdges.set(op, edge); touch(app, op); }, () => { endEdges.set(op, -1); touch(app, op); });
  app.setParam(p, ratio, C);
  logNya(app, C, 'the object reached through port (1, 0, 0) that receives EdgeID, and the returned status (the end edge and Ratio are stored on the operator)', 'Q2');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ Slice Polygons snap
/** Plane of this build's axis Slice Polygons operator in the owner's local space (mirrors its own evaluation). */
function slicePlane(op: any): { axis: 0 | 1 | 2; d: number; offsetParam: any } | null {
  if (op.preset !== 'Slice' || typeof op.p !== 'function') return null;
  const m = inputGeom(op) as MeshData | null; if (!m?.positions) return null;
  const sp = Number(op.p('sliceplane', 'axis', 0)); if (sp > 2) return null;
  const axis = Math.max(0, Math.min(2, sp)) as 0 | 1 | 2;
  const { verts } = toPolys(m); const sel = op.sel ?? { kind: 'polygon', indices: [] };
  const pts = sel.indices?.length ? [...selPoints(m, sel)] : verts.map((_, i) => i);
  let lo = Infinity, hi = -Infinity; for (const v of pts) { lo = Math.min(lo, verts[v][axis]); hi = Math.max(hi, verts[v][axis]); }
  const usebbox = op.get('usebbox') ? !!op.val('usebbox') : true; const percent = op.p('planeoffsetbboxpercentage', undefined, 50);
  const offsetParam = op.get('planeoffset') ?? op.get('offset');
  return { axis, d: (usebbox && pts.length ? lo + (hi - lo) * percent / 100 : 0) + Number(offsetParam?.value ?? 0), offsetParam };
}
function snapOffsetToPointForSlicePolygons(app: App, a: Record<string, any>): void {
  const C = 'SnapOffsetToPointForSlicePolygons';
  const op = operatorOf(app, a.Operator);
  if (!op) throw fail(E_POINTER, `${C}: no operator`);
  if (op.type !== 'slicepolygonsop') throw fail(E_NOINTERFACE, `${C}: ${op.name} is not a Slice Polygons operator`);
  // UnPackArg: a point sub-component with at least one index; only the first index is used.
  const target = pointSubComponent(app, a.Target);
  if (!target || !target.indices.length) throw fail(E_INVALIDARG, `${C}: Target is not a point sub-component with at least one index`);
  const g = target.obj.primitive?.mesh(); const local = g ? pointOf(g, target.indices[0]) : null;
  if (!local) throw fail(E_INVALIDARG, `${C}: ${target.obj.name} has no point ${target.indices[0]}`);
  const owner = ownerOf(op); if (!owner) throw fail(E_UNEXPECTED, `${C}: the operator has no owner object`);
  const e = target.obj.globalMatrix().elements; const mul = (el: ArrayLike<number>, p: V3): V3 =>
    [el[0] * p[0] + el[4] * p[1] + el[8] * p[2] + el[12], el[1] * p[0] + el[5] * p[1] + el[9] * p[2] + el[13], el[2] * p[0] + el[6] * p[1] + el[10] * p[2] + el[14]];
  const global = mul(e, local);
  const inOwner = mul(owner.globalMatrix().invert().elements, global);
  const names = stateOf(app).quirks.sliceParams;
  const read = (name: string | null) => name ? Number(op.get(name)?.value ?? 0) : 0;
  const custom = read(names.id0x11) !== 0;
  if (custom && read(names.id0x10) !== 0) { logNya(app, C, 'the status when parameter 0x10 is non-zero; nothing is written', 'Q3'); setStatus(app, C, S_NOTHING); return; }
  const plane = slicePlane(op);
  if (custom || !plane || !plane.offsetParam) {
    // parameter 0x11 non-zero: the one-step angle estimate on parameter 5. Its parameter name is not attested (Q3).
    logNya(app, C, custom ? 'the angle branch (parameter 5; names of parameters 5, 0x10, 0x11)' : 'the plane of a custom-plane Slice Polygons operator (names of parameters 4, 5, 0x10, 0x11); nothing is written', 'Q3');
    setStatus(app, C, S_NOTHING); return;
  }
  // parameter 0x11 equal to 0: parameter 4 += signed distance from the plane to the target along the unit normal.
  // inferred (Q3): parameter 4 is the plane offset (`planeoffset`).
  const distance = inOwner[plane.axis] - plane.d;
  app.setParam(plane.offsetParam, Number(plane.offsetParam.value) + distance, C);
  touch(app, op);
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ registration
export function registerMeshCurveStepTaskCommands(app: App) {
  const resolve = (x: X3DObject | string): X3DObject => { const o = objectOf(app, x); if (!o?.primitive) throw new Error(`no geometry object ${String((x as any)?.name ?? x)}`); return o; };
  const addOp = (label: string, obj: X3DObject, op: Operator) => { const prim = obj.primitive!; app.record(label, () => { prim.addOperator(op); }, () => { prim.removeOperator(op); }); app.events.emit('scene'); return op; };
  const state: MeshCurveStepTasksState = {
    lastStatus: null, out: {},
    quirks: { sliceParams: { offset: 'planeoffset', angle: null, id0x10: null, id0x11: null } },
    tool: {
      applyPolygonBuilder: (x) => addOp('Add Polygon', resolve(x), new PolygonBuilderOperator()) as PolygonBuilderOperator,
      applyAddEdge: (x, p, q) => addOp('Add Edge', resolve(x), new TopologyOperator2('Connect Points', { kind: 'point', indices: [p, q] })),
      applySlicePolygons: (x) => addOp('Slice Polygons', resolve(x), new TopologyOperator2('Slice', { kind: 'polygon', indices: [] })),
    },
    polygonBuilderOf: (x) => { const o = objectOf(app, x); return o ? findBuilder(o) : null; },
    interiorPoints: (op) => interiorPointsOf(op).map(p => ({ offsets: [...p.offsets], weights: [...p.weights], height: p.height })),
    endEdge: (op) => endEdges.has(op) ? endEdges.get(op)! : null,
    isLocked: null,
    geometry: { edgeInfo, segmentsCross },
  };
  (app as any).meshCurveStepTasks = state;
  const reg = (def: CommandDef) => app.register(def);
  const OBJ = { name: 'InputObj', default: null }, OP = { name: 'Operator', default: null };
  const CAT = 'Modeling|Drawing';

  reg({
    name: 'AddPointToNewPolygon', label: 'Add Point To New Polygon', category: CAT, description: 'Adds a new point to the polygon being drawn by the Add Polygon tool',
    args: [OBJ, { name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }, { name: 'InsertPosition', default: 0 }, { name: 'PolygonID', default: 0 }, { name: 'Value', default: 0 }],
    execute: (app, a) => addPointToNewPolygon(app, a),
  });
  reg({
    name: 'RemovePointFromPolygon', label: 'Remove Point From Polygon', category: CAT, description: 'Removes a point from the polygon being drawn',
    args: [OBJ, { name: 'PointID', default: 0 }, { name: 'PolygonID', default: 0 }],
    execute: (app, a) => removePointFromPolygon(app, a),
  });
  reg({
    name: 'ConnectNewPolygonToPoint', label: 'Connect New Polygon To Point', category: CAT, description: 'Adds an existing mesh point to the polygon being drawn',
    args: [OBJ, { name: 'PointID', default: 0 }, { name: 'InsertPosition', default: 0 }, { name: 'InvertPolygon', default: false }, { name: 'PolygonID', default: 0 }],
    execute: (app, a) => connectNewPolygonToPoint(app, a),
  });
  reg({
    name: 'ConnectNewPolygonToEdge', label: 'Connect New Polygon To Edge', category: CAT, description: 'Adds the end points of an existing mesh edge to the polygon being drawn',
    args: [OBJ, { name: 'EdgeID', default: 0 }, { name: 'InsertPosition', default: 0 }, { name: 'InvertPolygon', default: false }, { name: 'PolygonID', default: 0 }],
    execute: (app, a) => connectNewPolygonToEdge(app, a),
  });
  reg({
    name: 'AddPointInteriorToPolygon', label: 'Add Point Interior To Polygon', category: CAT, description: 'Appends an interior point to the Add Edge operator',
    args: [OP, { name: 'PolygonID', default: 0 }, { name: 'FirstOffset', default: 0 }, { name: 'SecondOffset', default: 0 }, { name: 'ThirdOffset', default: 0 },
      { name: 'FirstWeight', default: 0 }, { name: 'SecondWeight', default: 0 }, { name: 'ThirdWeight', default: 0 }, { name: 'Height', default: 0 }],
    execute: (app, a) => addPointInteriorToPolygon(app, a),
  });
  reg({
    name: 'RemoveLastPointInteriorToPolygon', label: 'Remove Last Point Interior To Polygon', category: CAT, description: 'Removes the last interior point of the Add Edge operator',
    args: [OP, { name: 'PolygonID', default: 0 }],
    execute: (app, a) => removeLastPointInteriorToPolygon(app, a),
  });
  reg({
    name: 'TerminateAddEdgeWithInteriorPoints', label: 'Terminate AddEdge With Interior Points', category: CAT, description: 'Closes an Add Edge stroke that has interior points',
    args: [OP, { name: 'PolygonID', default: 0 }, { name: 'EdgeID', default: 0 }, { name: 'Ratio', default: 0 }],
    execute: (app, a) => terminateAddEdgeWithInteriorPoints(app, a),
  });
  reg({
    name: 'SnapOffsetToPointForSlicePolygons', label: 'SnapOffsetToPointForSlicePolygons', category: CAT, description: 'Moves the plane of a Slice Polygons operator onto a point',
    args: [OP, { name: 'Target', default: null }],
    execute: (app, a) => snapOffsetToPointForSlicePolygons(app, a),
  });
  registerMeshCurveStepTaskClusters(app, reg);
  registerMeshCurveStepTaskCurves(app, reg);
}
