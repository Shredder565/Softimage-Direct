// Ledger row CMD-B8f, curve drawing step commands (sicurvetasks). Brief:
// docs/ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md, "Wire contract" and shared facts 2.4.
// Original code written from that prose contract only. See meshCurveStepTasks.ts for the conventions.
//
//   SICreateCurve SISetCurvePoints SIAddPointOnCurve SIAddPointOnCurveAtStart SIAddPointOnCurveAtEnd
//   SIDeletePointOnCurve CurveDirectManip
//
// How the contract is mapped onto this build:
//  * The curve-creation operator (2.4) is CurveCreationOperator: an ordered point list with degree and type code.
//    It is the generator of the object SICreateCurve makes; with fewer than two points the curve list is empty.
//  * The operators the commands apply are named by the project's SPDL data: `extendcrv2pt` (class 57437ad3-...),
//    `addpt_middlecrv` (b4ab59b0-...), `delpt_crv` (992f08e0-...), `constraincurveisopointop` (5c0af205-...).
//    The numeric parameter ids of the contract match the parameter order of the first two in that data, which
//    gives the names used here (bound / posx posy posz / cont / mode; posx posy posz / percentage /
//    keepotherpointsanchored / mode). For `delpt_crv` the contract's meaning is followed (curve index -> crvindex,
//    point index -> cvindex) although the SPDL order is the other way round (question for the analyst).
//  * Points are control points. The other editing modes of the SPDL data (Knot Points, Via Points) and CurveType 3
//    are stored on the operators but not evaluated differently; the commands log that (Q6).
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, Operator, Primitive, Cluster, makeDisplay } from '../core/scene';
import { num, int, bool } from '../core/params';
import { makeCurve, type CurveData } from '../core/curves';
import { unset, boolArg, siConst, findNode, findObject } from './viewEditPropertyHelpers';
import {
  fail, setStatus, setOut, logNya, stateOf, objectOf, dblArg, intArg, msgId, type V3,
  S_OK, S_NOTHING, E_INVALIDARG,
} from './meshCurveStepTasks';

type CurveList = CurveData & { subcurves?: CurveData[] };
export const TYPE_UNSPECIFIED = 0x7f;
/** Scripting CurveType -> internal one-byte code (0 -> 1, 1 -> 0, 3 -> 3); null = any other value. */
export function typeCode(curveType: any): number | null {
  const n = typeof curveType === 'boolean' ? Number(curveType) : Number(curveType);
  return n === 0 ? 1 : n === 1 ? 0 : n === 3 ? 3 : null;
}
/** Internal code -> the integer "type" parameter of an add-point operator (1 -> 0, 0 -> 1, 3 -> 3, 0x7f -> 2). */
export const typeParam = (code: number) => code === 1 ? 0 : code === 0 ? 1 : code === 3 ? 3 : 2;
const xyz = (c: number[]): V3 => [c[0], c[1], c[2]];
const curvesOf = (c: CurveList): CurveData[] => [{ ...c, subcurves: undefined } as CurveData, ...(c.subcurves ?? [])];
const listOf = (curves: CurveData[]): CurveList => curves.length > 1 ? { ...curves[0], subcurves: curves.slice(1) } as CurveList : { ...curves[0] };
const rebuilt = (c: CurveData, points: V3[]): CurveData => makeCurve(points, Math.max(1, Math.min(c.degree, points.length - 1)), c.closed);

// ------------------------------------------------------------------ operators
/** 2.4: the point list a Draw Curve tool feeds. Slots 3/4/7/8/9/10/12/13/16 of the private interface. */
export class CurveCreationOperator extends Operator {
  readonly points: V3[] = [];
  constructor(public degree: number, public typeCodeValue: number) { super('CurveCreation', 'CurveCreationOp', []); }
  get count(): number { return this.points.length; }
  /** Slot 3. Returns 1 when nothing was added. inferred: an index outside 0..count is what "nothing added" means. */
  insert(index: number, p: V3): number { if (index < 0 || index > this.points.length) return 1; this.points.splice(index, 0, [...p] as V3); this.dirty(); return 0; }
  /** Slot 9. */
  append(p: V3): number { this.points.push([...p] as V3); this.dirty(); return 0; }
  /** Slots 4 and 10. */
  removeAt(index: number): void { if (index >= 0 && index < this.points.length) { this.points.splice(index, 1); this.dirty(); } }
  private dirty(): void { const prim: any = this.parent; if (prim) prim.dirty = true; }
  apply(): CurveData | null {
    const n = this.points.length; if (n < 2) return null;
    return makeCurve(this.points, Math.max(1, Math.min(this.degree, n - 1)), false);
  }
}
/** Class 57437ad3-...: add a point at the start (bound 0) or the end (bound 1) of the curve. */
export class ExtendCurveToPointOperator extends Operator {
  constructor() {
    super('Extend Curve To Point', 'extendcrv2pt', [int('bound', 0, 'Boundary'), int('cont', 0, 'Continuiy'), num('scl', 1, 'Scaling'),
      num('posx', 0, 'Xpos'), num('posy', 0, 'Ypos'), num('posz', 0, 'Zpos'), int('mode', 2, 'Mode'), bool('mute', false, 'Mute')]);
  }
  apply(c: CurveList | null): CurveList | null {
    if (!c || !c.cvs || this.val('mute')) return c;
    const curves = curvesOf(c); const p: V3 = [Number(this.val('posx')), Number(this.val('posy')), Number(this.val('posz'))];
    const pts = curves[0].cvs.map(xyz);
    curves[0] = rebuilt(curves[0], Number(this.val('bound')) === 0 ? [p, ...pts] : [...pts, p]);
    return listOf(curves);
  }
}
/** Class b4ab59b0-...: add a point inside the curve at a normalised position. */
export class AddPointInsideCurveOperator extends Operator {
  constructor() {
    super('Add Point Inside Curve', 'addpt_middlecrv', [num('posx', 0, 'X Position'), num('posy', 0, 'Y Position'), num('posz', 0, 'Z Position'),
      num('percentage', 0.5, 'Percentage'), bool('keepotherpointsanchored', false, 'keep other points anchored'), int('mode', 2, 'Mode'), bool('mute', false, 'Mute')]);
  }
  apply(c: CurveList | null): CurveList | null {
    if (!c || !c.cvs || this.val('mute')) return c;
    const curves = curvesOf(c); const pts = curves[0].cvs.map(xyz);
    // inferred stand-in: the new control point goes between the two control points the position falls between
    const at = Math.min(pts.length, Math.floor(Math.max(0, Math.min(1, Number(this.val('percentage')))) * (pts.length - 1)) + 1);
    pts.splice(at, 0, [Number(this.val('posx')), Number(this.val('posy')), Number(this.val('posz'))]);
    curves[0] = rebuilt(curves[0], pts);
    return listOf(curves);
  }
}
/** Class 992f08e0-...: delete one control point of one curve of the list. */
export class DeletePointFromCurveOperator extends Operator {
  constructor() { super('Delete Point From Curve', 'delpt_crv', [int('cvindex', 0, 'Cv index'), int('crvindex', 0, 'Curve index'), bool('mute', false, 'Mute')]); }
  apply(c: CurveList | null): CurveList | null {
    if (!c || !c.cvs || this.val('mute')) return c;
    const curves = curvesOf(c); const k = Number(this.val('crvindex')), i = Number(this.val('cvindex'));
    const cur = curves[k]; if (!cur || i < 0 || i >= cur.cvs.length || cur.cvs.length <= 2) return c;
    const pts = cur.cvs.map(xyz); pts.splice(i, 1);
    curves[k] = rebuilt(cur, pts);
    return listOf(curves);
  }
}
/** Class 5c0af205-...: the curve direct-manipulation deformer on one isopoint. Its deformation is not attested: it passes the curve through. */
export class ConstrainCurveIsopointOperator extends Operator {
  cluster: Cluster | null = null;
  constructor() { super('ConstrainVirtualComponent', 'constraincurveisopointop', [int('mode', 0, 'Mode'), num('trnsx', 0, 'Translation X'), num('trnsy', 0, 'Translation Y'), num('trnsz', 0, 'Translation Z')]); }
  apply(c: any): any { return c; }
}
export function findCreationOperator(obj: X3DObject): CurveCreationOperator | null {
  // the first nested operator of the curve-creation family
  return (obj.primitive?.operators.find(op => op instanceof CurveCreationOperator) as CurveCreationOperator | undefined) ?? null;
}

// ------------------------------------------------------------------ SICreateCurve
function createCurve(app: App, a: Record<string, any>): X3DObject {
  const C = 'SICreateCurve';
  const code = typeCode(a.CurveType);
  if (code === null) throw fail(E_INVALIDARG, `${C}: CurveType ${String(a.CurveType)} (only 0, 1 or 3)`);
  const degree = intArg(a.Degree, 3) & 0xffff;
  // The primitive-creation sub-task with the NURBS Curve List preset, then the curve-creation operator on it.
  const obj = new X3DObject(app.scene.uniqueName('crvlist'), 'crvlist');
  const prim = new Primitive('NURBS Curve List', 'crvlist');
  const op = new CurveCreationOperator(degree, code);
  prim.addOperator(op); obj.setPrimitive(prim); obj.addProperty(makeDisplay());
  const root = app.scene.root;
  app.record(C, () => { root.addChild(obj); }, () => { root.removeChild(obj); });
  const name = unset(a.Name) ? '' : String(a.Name);
  if (name !== '') obj.name = app.scene.uniqueName(name);
  if (code !== 1) logNya(app, C, `the drawing style of CurveType ${Number(a.CurveType)} (the type code is stored; points are used as control points)`, 'Q6');
  app.events.emit('scene');
  setOut(app, C, a, { Value: obj }); setStatus(app, C, S_OK);
  return obj;
}

// ------------------------------------------------------------------ add point (shared base of the three classes)
type Where = 'start' | 'end' | 'middle';
interface AddPoint { command: string; where: Where; obj: X3DObject; point: V3; local: boolean; code: number; preserveTrace: boolean; insertPosition: number }
function curveObject(app: App, command: string, x: any): X3DObject {
  const obj = objectOf(app, x);
  if (!obj || obj.primitive?.type !== 'crvlist') throw fail(E_INVALIDARG, `${command}: InputObj is not a curve object`, 0x3fc);
  return obj;
}
/** Global -> the curve object's local space. */
function toLocal(obj: X3DObject, p: V3): V3 {
  const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(obj.globalMatrix().invert()); return [v.x, v.y, v.z];
}
/** The worker of the add-point classes. Returns true when a point was added by either path. */
function addPoint(app: App, r: AddPoint): boolean {
  const C = r.command; const obj = r.obj; const prim = obj.primitive!;
  const p = r.local ? r.point : toLocal(obj, r.point);
  const creation = findCreationOperator(obj);
  // Compatibility of the creation operator: rejected only when all four conditions hold.
  let usable = !!creation && !(r.code !== TYPE_UNSPECIFIED && creation.count > 0 && creation.degree !== 1 && creation.typeCodeValue !== r.code);
  if (r.where !== 'middle' && r.preserveTrace) usable = false;
  const fractional = r.where === 'middle' && r.insertPosition % 1 !== 0;
  if (usable && creation && !fractional) {
    // ---- fast path
    let index: number;
    if (r.where === 'end') index = creation.count;
    else if (r.where === 'start') index = 0;
    else { if (r.insertPosition < 0) throw fail(E_INVALIDARG, `${C}: negative InsertPosition`, 0x3fc); index = r.insertPosition + 1; }
    if (index > creation.count) { app.logMsg('info', `${C}: nothing added (${msgId(0x91)})`); setStatus(app, C, S_NOTHING); return false; }   // the operator returned 1
    app.record(C, () => { creation.insert(index, p); }, () => { creation.removeAt(index); });
    app.events.emit('scene'); setStatus(app, C, S_OK);
    return true;
  }
  // ---- operator path
  let op: Operator;
  if (r.where === 'middle') {
    if (Math.trunc(r.insertPosition) !== 0) throw fail(E_INVALIDARG, `${C}: InsertPosition ${r.insertPosition} is not a normalised position`, 0x3fc);
    op = new AddPointInsideCurveOperator();
    op.get('posx')!.value = p[0]; op.get('posy')!.value = p[1]; op.get('posz')!.value = p[2];
    op.get('percentage')!.value = r.insertPosition;
    op.get('mode')!.value = typeParam(r.code);              // parameter 6
    op.get('keepotherpointsanchored')!.value = false;       // parameter 5
    logNya(app, C, 'the exact insertion of the "Add Point Inside Curve" operator (the point becomes a control point between its two neighbours at that position)');
  } else {
    op = new ExtendCurveToPointOperator();
    op.get('posx')!.value = p[0]; op.get('posy')!.value = p[1]; op.get('posz')!.value = p[2];
    op.get('bound')!.value = r.where === 'start' ? 0 : 1;   // the end selector
    let type = typeParam(r.code);
    if (r.preserveTrace) { op.get('cont')!.value = 0; type = 2; }   // parameter 2 = 0, type value 2
    op.get('mode')!.value = type;                           // parameter 7
  }
  if (Number(op.get('mode')!.value) !== 0) logNya(app, C, `editing mode ${Number(op.get('mode')!.value)} of the add-point operator (the point is added as a control point)`, 'Q6');
  app.record(C, () => { prim.addOperator(op); }, () => { prim.removeOperator(op); });
  app.events.emit('scene'); setStatus(app, C, S_OK);
  return true;
}
function addPointArgs(app: App, command: string, where: Where, a: Record<string, any>): AddPoint {
  const code = typeCode(a.CurveType) ?? TYPE_UNSPECIFIED;   // any other value, the default -1 included: "not specified"
  return {
    command, where, obj: curveObject(app, command, a.InputObj), point: [dblArg(a.X), dblArg(a.Y), dblArg(a.Z)], local: boolArg(a.Local), code,
    preserveTrace: where !== 'middle' && boolArg(a.PreserveTrace), insertPosition: where === 'middle' ? dblArg(a.InsertPosition) : 0,
  };
}

// ------------------------------------------------------------------ SISetCurvePoints
const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const GROUP = `\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`;
const POINTS = new RegExp(`^\\s*${GROUP}(?:\\s*,\\s*${GROUP})*$`);
/** `(x,y,z),(x,y,z)...`: exactly three numbers per point, blanks allowed around tokens, the string ends right after
 *  a closing parenthesis. null = an empty string or any deviation. */
export function parsePoints(text: any): V3[] | null {
  const s = unset(text) ? '' : String(text);
  if (s === '' || !POINTS.test(s)) return null;
  const out: V3[] = [];
  for (const m of s.matchAll(new RegExp(GROUP, 'g'))) out.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  return out;
}
function setCurvePoints(app: App, a: Record<string, any>): void {
  const C = 'SISetCurvePoints';
  const points = parsePoints(a.Points);
  if (!points) throw fail(E_INVALIDARG, `${C}: Points is empty or not a list of (x,y,z) groups`);
  const obj = curveObject(app, C, a.InputObj); const local = boolArg(a.Local);
  // One SIAddPointOnCurveAtEnd worker per point: type "not specified", PreserveTrace false. Nothing is cleared.
  for (const point of points) addPoint(app, { command: C, where: 'end', obj, point, local, code: TYPE_UNSPECIFIED, preserveTrace: false, insertPosition: 0 });
  logNya(app, C, 'the closing call on the object after the points are added', 'Q5');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ SIDeletePointOnCurve
function deletePointOnCurve(app: App, a: Record<string, any>): void {
  const C = 'SIDeletePointOnCurve';
  const obj = curveObject(app, C, a.InputObj); const prim = obj.primitive!;
  const c = prim.curve() as CurveList | null; const curves = c ? curvesOf(c) : [];
  let index = intArg(a.InsertPosition, 4), curve = -1;
  for (let k = 0; k < curves.length; k++) {
    const count = curves[k].cvs.length;   // inferred: the two counts read per curve are its degree and its number of points
    if (index < count) { curve = k; break; }
    index -= count;
  }
  if (curve < 0 || index < 0) throw fail(E_INVALIDARG, `${C}: point index beyond the last curve`, 0x3fc);
  if (curves[curve].degree >= curves[curve].cvs.length) throw fail(E_INVALIDARG, `${C}: the curve is at its minimum size`, 0x3fc);
  const op = new DeletePointFromCurveOperator();
  op.get('crvindex')!.value = curve; op.get('cvindex')!.value = index;
  app.record(C, () => { prim.addOperator(op); }, () => { prim.removeOperator(op); });
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ CurveDirectManip
interface Isopoint { obj: X3DObject; curve: number; u: number; cluster: Cluster | null }
/** First item of SubComp: a transient isopoint sub-component ("obj.isopnt[(curve,u)]" or { obj, curve, u }) or an
 *  isopoint cluster holding exactly one element. */
function isopoint(app: App, x: any): Isopoint | null {
  const first = Array.isArray(x) ? x[0] : x;
  const element = (e: any): [number, number] | null => {
    if (Array.isArray(e) && e.length === 2) return [Number(e[0]), Number(e[1])];
    const m = /^\(?\s*(\d+)\s*,\s*([^)\s]+)\s*\)?$/.exec(String(e)); return m ? [Number(m[1]), Number(m[2])] : null;
  };
  let node: any = first;
  if (typeof first === 'string') {
    const m = /^(.*)\.isopnt\[\s*(\([^\]]*\))\s*\]$/.exec(first.trim());
    if (m) { const obj = findObject(app, m[1]); const e = element(m[2]); return obj && e ? { obj, curve: e[0], u: e[1], cluster: null } : null; }
    node = findNode(app, first.trim());
  }
  if (node instanceof Cluster) {
    if ((node.compKind as string) !== 'isopnt' || node.elements.size !== 1 || !node.obj) return null;
    const e = element([...node.elements][0]); return e ? { obj: node.obj, curve: e[0], u: e[1], cluster: node } : null;
  }
  if (node && typeof node === 'object' && !(node instanceof X3DObject)) {
    const obj = objectOf(app, node.obj); if (!obj || unset(node.curve) || unset(node.u)) return null;
    return { obj, curve: Number(node.curve), u: Number(node.u), cluster: null };
  }
  return null;
}
function curveDirectManip(app: App, a: Record<string, any>): null {
  const C = 'CurveDirectManip';
  // ---- UnPackArg
  const iso = isopoint(app, a.SubComp);
  if (!iso || !Number.isFinite(iso.curve) || !Number.isFinite(iso.u) || iso.u < -1e-9 || iso.u > 1 + 1e-9) throw fail(E_INVALIDARG, `${C}: SubComp is not one curve isopoint with a position in [0, 1]`);
  const im = siConst(a.ImmediateMode);
  const immediate = im === 'siPersistentOperation' ? 0 : im === 'siImmediateOperation' ? 1 : Number(im);
  if (immediate !== 0 && immediate !== 1) throw fail(E_INVALIDARG, `${C}: ImmediateMode ${String(a.ImmediateMode)}`);
  const md = siConst(a.Mode);
  // inferred: siCurveIsopointPositionManipMode is the first value of its enumeration; the other names are not in the contract
  const mode = md === 'siCurveIsopointPositionManipMode' ? 0 : Number(md);
  if (!Number.isInteger(mode) || mode < 0 || mode >= 7) throw fail(E_INVALIDARG, `${C}: Mode ${String(a.Mode)}`);
  const obj = iso.obj; const prim = obj.primitive;
  if (!prim || prim.type !== 'crvlist') throw fail(E_INVALIDARG, `${C}: ${obj.name} is not a curve object`);
  // ---- Do
  if (stateOf(app).isLocked?.(obj)) throw new Error(`${C}: ${obj.name} is locked`);
  let cluster = iso.cluster;
  if (!cluster) {
    const made = cluster = new Cluster('Isopoint', 'isopnt' as any, new Set<number | string>([`${iso.curve},${iso.u}`]));
    app.record(C, () => { obj.addCluster(made); }, () => { obj.removeCluster(made); });
  }
  // Reuse the operator on top of the stack, else add a new one.
  const top = prim.operators[prim.operators.length - 1];
  let op: ConstrainCurveIsopointOperator;
  if (top instanceof ConstrainCurveIsopointOperator) op = top;
  else { const made = op = new ConstrainCurveIsopointOperator(); app.record(C, () => { prim.addOperator(made); }, () => { prim.removeOperator(made); }); }
  const target = op, was = op.cluster, now = cluster;
  app.record(C, () => { target.cluster = now; }, () => { target.cluster = was; });   // port group 1
  app.setParam(op.get('mode')!, mode, C);
  app.setParam(op.get('trnsx')!, dblArg(a.X), C); app.setParam(op.get('trnsy')!, dblArg(a.Y), C); app.setParam(op.get('trnsz')!, dblArg(a.Z), C);
  logNya(app, C, 'the deformation the constrain-isopoint operator performs (operator, cluster and parameters are set; the curve passes through unchanged)');
  if (immediate === 1) {
    // inferred: the closing sub-task freezes the operator stack
    const g = prim.geom(); const old = [...prim.operators];
    const frozen = new Operator('Frozen Geometry', 'geom', []); (frozen as any).apply = () => g;
    app.record(C, () => { prim.operators.splice(0, prim.operators.length, frozen); frozen.parent = prim; prim.dirty = true; },
      () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
  }
  prim.dirty = true; app.events.emit('scene');
  // Q7: RePackArg writes nothing, Value stays empty.
  setOut(app, C, a, { Value: null }); stateOf(app).out[C].operator = immediate === 1 ? null : op; setStatus(app, C, S_OK);
  return null;
}

// ------------------------------------------------------------------ registration
export function registerMeshCurveStepTaskCurves(app: App, reg: (def: CommandDef) => void) {
  const OBJ = { name: 'InputObj', default: null };
  const XYZ = [{ name: 'X', default: 0 }, { name: 'Y', default: 0 }, { name: 'Z', default: 0 }];
  const TAIL = [{ name: 'Local', default: false }, { name: 'CurveType', default: -1 }];
  reg({
    name: 'SICreateCurve', label: 'SI Create Curve', category: 'Drawing', description: 'Creates an empty curve object ready to receive points',
    args: [{ name: 'Name', default: '' }, { name: 'Degree', default: 3 }, { name: 'CurveType', default: 0 }, { name: 'Value', default: null }],
    execute: (app, a) => createCurve(app, a),
  });
  reg({
    name: 'SISetCurvePoints', label: 'SISetCurvePoints', category: 'Drawing', description: "Appends the points '(x0,y0,z0),(xn,yn,zn)...' to a curve",
    args: [OBJ, { name: 'Points', default: '' }, { name: 'Local', default: false }],
    execute: (app, a) => setCurvePoints(app, a),
  });
  reg({
    name: 'SIAddPointOnCurve', label: 'SI Add Point On Curve', category: 'Modeling|Drawing', description: 'Adds a point inside a curve',
    args: [OBJ, { name: 'InsertPosition', default: 0 }, ...XYZ, ...TAIL],
    execute: (app, a) => { addPoint(app, addPointArgs(app, 'SIAddPointOnCurve', 'middle', a)); },
  });
  reg({
    name: 'SIAddPointOnCurveAtStart', label: 'SI Add Point On Curve At Start', category: 'Modeling|Drawing', description: 'Adds a point at the start of a curve',
    args: [OBJ, ...XYZ, ...TAIL, { name: 'PreserveTrace', default: false }],
    execute: (app, a) => { addPoint(app, addPointArgs(app, 'SIAddPointOnCurveAtStart', 'start', a)); },
  });
  reg({
    name: 'SIAddPointOnCurveAtEnd', label: 'SI Add Point On Curve At End', category: 'Modeling|Drawing', description: 'Adds a point at the end of a curve',
    args: [OBJ, ...XYZ, ...TAIL, { name: 'PreserveTrace', default: false }, { name: 'Value', default: false }],
    execute: (app, a) => { const C = 'SIAddPointOnCurveAtEnd'; const added = addPoint(app, addPointArgs(app, C, 'end', a)); setOut(app, C, a, { Value: added }); return added; },
  });
  reg({
    name: 'SIDeletePointOnCurve', label: 'SI Delete Point On Curve', category: 'Modeling|Drawing', description: 'Deletes one control point of a curve list',
    args: [OBJ, { name: 'InsertPosition', default: 4 }],
    execute: (app, a) => deletePointOnCurve(app, a),
  });
  reg({
    name: 'CurveDirectManip', label: 'CurveDirectManip', category: 'Modeling|Deformation', description: 'Applies or updates the curve direct-manipulation deformer on one isopoint',
    args: [{ name: 'SubComp', default: null }, { name: 'ImmediateMode', default: ':siPersistentOperation:siOperationMode' }, { name: 'Mode', default: ':siCurveIsopointPositionManipMode:siCurveIsopointManipMode' },
      ...XYZ, { name: 'Value', default: null }],
    execute: (app, a) => curveDirectManip(app, a),
  });
}
