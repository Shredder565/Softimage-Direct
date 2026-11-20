// Ledger row CMD-B18b (Face Robot JScript plug-ins PreparationTools.js and GameExport_EyelidTools.js): the 15 commands
// fr_CleanMeshModel, fr_Diagnose, fr_Freeze, fr_Holes, fr_PickEyeProximity, fr_PickMouthProximity, fr_AddMouthInterior,
// fr_AddEyeSocket, fr_AddEyeBalls, fr_GetGameSmoothMap, fr_ApplyGameSmoothFromMap, fr_CopyEyelashes,
// fr_TransferEyelashEnvelope, ClipDeformers, UndoGameSmooth.
// Brief: the "Wire contract" sections of docs/ghidra/cmd-b18b-fr-preparation-eyelid-scripts.md, the polymesh helper of
// docs/ghidra/cmd-b18d-fr-small-scripts.md §2 and docs/re/WIRE_CORRECTIONS_B18.md items 1-3 and 11. These replace the
// argument-less shells of src/commands/faceRobotModule.ts. Original code written from that prose only; no golden exists.
//
// Mapping notes:
//  * The "diagnose message" is the Face Robot panel's diagnose box: FaceState.Message plus registry `_`/`Diagnose`.
//  * Envelope weights: this build's EnvelopeOperator keeps per-point weights normalised to 1; the scripts work in percent
//    (0-100), so values are scaled by 100 on read and back on write.
//  * Helpers that the notes name but do not contract (GameExport, fr_GetGameFaceFromProperty, fr_GetEyelashes,
//    fr_ResetRetarget, SetPropertyDisplay) are called when this build has a working command; otherwise a stand-in is
//    used and "not yet attested" is logged.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Model, Cluster, Operator, Primitive, Constraint, Group, makeDisplay } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import { build } from '../core/geometry';
import { evalCurve, curveDomain, type CurveData } from '../core/curves';
import { EnvelopeOperator } from '../core/envelope';
import { FrozenGeomOperator } from './model';
import { frStore, entryObject, propNamed, addProperty, addObject, unset, isInScene, boolArg, intArg, msgBox, newNull, groupNamed, addToGroup } from './faceRobotB14Shared';
import { deleteNode, globalPos, setGlobalPos, setGlobalMatrix, reparent, keywordsOf } from './faceRobotB14deShared';
import { eyeballPropertyDefs } from './faceRobotB14c';
import {
  CAT, b18, nyaB, siError, siInfo, scriptError, call, inspect, ensureParam, newModel, isPolymesh, objOrName, sgetFaceModel,
  sgetMesh, addCluster, addClusterProp, ProgressBar, neighbours, mappingTemplate, meshPositions, worldPoints, newProp, V3,
} from './faceRobotB18bcShared';
import { PolyHelper, getPolymesh } from './faceRobotB18bPoly';

// ================================================================== PreparationTools.js shared helpers (§2)
/** The diagnose box: FaceState.Message (added when missing) and fr_sset("Diagnose", text). */
function diagnose(app: App, text: string) {
  const fm = sgetFaceModel(app); const fs = fm ? propNamed(fm, 'FaceState') : undefined;
  if (fs) { const q = ensureParam(app, fs, str('Message', '', 'Message', { animatable: false })); app.setParam(q, text); }
  const st = frStore(app); const old = st.raw('_', 'Diagnose');
  app.record('fr_sset Diagnose', () => st.put('_', 'Diagnose', text), () => { if (old === undefined) st.delete('_', 'Diagnose'); else st.put('_', 'Diagnose', old); });
}
/** get head (name): meshes/Mesh, after FaceRobot(,,"15") when empty; else the diagnose message and null. */
function getHead(app: App, name: string): X3DObject | null {
  let m = sgetMesh(app, 'Mesh');
  if (!m) { call(app, 'FaceRobot', { cmd: '', arg: '', id: '15' }); m = sgetMesh(app, 'Mesh'); }
  if (!m) { diagnose(app, `<b>Pick Objects</b> before ${name}.`); return null; }
  return m;
}
/** transform check: translation length 0, rotation angles 0, scale exactly (1, 1, 1). */
function transformOk(o: X3DObject): boolean {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); o.globalMatrix().decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q); const E = 1e-9;
  return p.length() <= E && new THREE.Vector3(e.x, e.y, e.z).length() <= E && Math.abs(s.x - 1) <= E && Math.abs(s.y - 1) <= E && Math.abs(s.z - 1) <= E;
}
const constraintsOf = (o: X3DObject) => o.properties.filter(p => p instanceof Constraint);
/** freeze face: per registered mesh, constraints deleted (live collection by increasing index), animation removed; then one FreezeObj. */
function freezeFace(app: App) {
  const meshes: X3DObject[] = [];
  for (const k of frStore(app).keys('meshes')) { const m = entryObject(app, 'meshes', k); if (m && !meshes.includes(m)) meshes.push(m); }
  for (const m of meshes) {
    for (let i = 0; i < constraintsOf(m).length; i++) deleteNode(app, constraintsOf(m)[i]);   // (inferred) every second one survives
    call(app, 'RemoveAllAnimation', { InputObjs: [m] });
  }
  if (meshes.length) call(app, 'FreezeObj', { InputObjs: meshes });
}
const SNAP = { Enable: 1, Enable0D: 0, Enable1D: 0, Enable2D: 1, EnableGrid: 0, Faces: 1, Surfaces: 0, IgnoreBackfacing: 1 };
/** pick loop: snapping preferences set (and restored), PickPosition until a right click or `max` picks. */
function pickLoop(app: App, max: number): THREE.Vector3[] {
  const st = b18(app); const saved = { ...st.snapping }; Object.assign(st.snapping, SNAP);
  const out: THREE.Vector3[] = [];
  try {
    while (out.length < max) {
      b18(app).calls.push({ name: 'PickPosition', args: { LeftMessage: 'pick', MiddleMessage: 'pick' } });
      const r = st.hooks.pick?.(out.length);
      if (!r || !r.button) break;
      out.push(new THREE.Vector3(...r.pos));
    }
  } finally { st.snapping = saved; }
  return out;
}
const unique = <T,>(a: T[]) => a.filter((x, i) => a.indexOf(x) === i);
/** Replace an object's geometry (FreezeObj + Geometry.Set): a frozen generator with the new points and polygons. */
function setGeometry(app: App, o: X3DObject, positions: ArrayLike<number>, polygons: number[][]) {
  const prim = o.primitive; if (!prim) return;
  const verts: number[][] = []; for (let i = 0; i < positions.length; i += 3) verts.push([positions[i], positions[i + 1], positions[i + 2]]);
  const op = new FrozenGeomOperator(build(verts, polygons.map(f => f.slice())), 'Geometry'); const old = [...prim.operators];
  app.record('Geometry.Set', () => { prim.operators.splice(0, prim.operators.length, op); op.parent = prim; prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
}
function reparentKeep(app: App, o: X3DObject, parent: X3DObject) { const g = o.globalMatrix().clone(); reparent(app, o, parent); setGlobalMatrix(app, o, g); }
/** fr_CleanMeshModel(Del) body (also used by the other commands to get their container). */
function cleanMeshModel(app: App, del: any): Model | undefined {
  const found = [...app.scene.root.descendants()].find(o => o.name === 'fr_MeshClean' && o.type === '#model') as Model | undefined;
  if (boolArg(del, false)) {
    getHead(app, '');
    freezeFace(app);
    if (found) deleteNode(app, found);
    return undefined;
  }
  return found ?? newModel(app, 'fr_MeshClean');
}

// ================================================================== mouth interior (scripted operator `mouthInterior`)
const SIDE: V3[] = [[0.5, 0, 0], [0.736, -0.001, -0.101], [0.838, -0.001, -0.168], [1, -0.001, -0.271], [1, -0.001, -0.573], [1, -0.001, -0.754], [0.502, 0.001, -0.957], [0.278, -0.483, -1.048]];
const BOTTOM: V3[] = [[0, 0, 0], [0, -0.033, -0.087], [0, -0.194, -0.067], [0, -0.304, -0.098], [0, -0.304, -0.289], [0, -0.28, -0.573], [0, -0.245, -0.877], [0, -0.473, -0.94]];
const TOP: V3[] = [[0, 0, 0], [0, 0.028, -0.099], [0, 0.209, -0.095], [0, 0.388, -0.201], [0, 0.412, -0.573], [0, 0.369, -0.998], [0, 0.027, -1.118], [0, -0.493, -1.127]];
/** Knots 0,0,0,1,2,3,4,5,5,5 (Softimage form, end knots implied); this build's curve keeps n + degree + 1 knots. */
const GUIDE_KNOTS = [0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5];
const MOUTH_CROSS = { keys: [[0, 0], [0.2, 1], [0.5, 0.8], [0.7, 1]], tangents: [[0, 0, 0.01, 0.4], [-0.1, 0, 0.1, 0], [-0.1, 0, 0.1, 0], [-0.1, 0, 0.2, 0]] };
function guideCurve(app: App, name: string, parent: X3DObject, shape: V3[], scale: V3, off: THREE.Vector3): X3DObject {
  const obj = new X3DObject(app.scene.uniqueName(name), 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
  const data: CurveData = { degree: 3, closed: false, knots: GUIDE_KNOTS.slice(), cvs: shape.map(p => [p[0] * scale[0] + off.x, p[1] * scale[1] + off.y, p[2] * scale[2] + off.z, 1] as [number, number, number, number]) };
  prim.addOperator(new FrozenGeomOperator(data, 'Curve')); obj.setPrimitive(prim);
  // local Display Property, wire colour 22 (this build's `wirecol` is the use-wire-colour flag; the palette index is kept beside it)
  const d = makeDisplay(false); d.set('wirecol', true); (d as any).wireColorIndex = 22; obj.addProperty(d);
  addObject(app, obj, parent); return obj;
}
/** Point at an arc-length percentage of a curve (EvaluatePositionFromPercentage), in the curve's local space. */
export function curveAtPercent(c: CurveData, pct: number): THREE.Vector3 {
  const [u0, u1] = curveDomain(c); const N = 400; const pts: THREE.Vector3[] = []; const len: number[] = [0];
  for (let i = 0; i <= N; i++) { pts.push(new THREE.Vector3(...evalCurve(c, u0 + (u1 - u0) * i / N))); if (i) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1])); }
  const target = Math.max(0, Math.min(100, pct)) / 100 * len[N];
  for (let i = 1; i <= N; i++) if (len[i] >= target) { const t = (target - len[i - 1]) / Math.max(1e-12, len[i] - len[i - 1]); return pts[i - 1].clone().lerp(pts[i], t); }
  return pts[N].clone();
}
/** Bezier fcurve with (left dx, dy / right dx, dy) tangents per key, evaluated at x. */
export function evalTangentFCurve(fc: { keys: number[][]; tangents: number[][] }, x: number): number {
  const K = fc.keys, T = fc.tangents; if (!K.length) return 0;
  if (x <= K[0][0]) return K[0][1]; if (x >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0; while (i < K.length - 2 && x > K[i + 1][0]) i++;
  const p0 = K[i], p3 = K[i + 1]; const p1 = [p0[0] + T[i][2], p0[1] + T[i][3]], p2 = [p3[0] + T[i + 1][0], p3[1] + T[i + 1][1]];
  const bx = (t: number) => (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0];
  let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
  const t = (lo + hi) / 2; return (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1];
}
export class MouthInteriorOp extends Operator {
  constructor(readonly mesh: X3DObject, readonly curves: X3DObject[], readonly prop: Property, readonly holePoints: number[], readonly spans: number[]) {
    super('mouthInterior', 'mouthInterior', []);
    (this as any).inputs = { mesh, curves: curves.map(c => c.name), kinematics: curves.map(c => `${c.name}.kine.global`), prop: prop.name };
  }
  depStamp() { return `${this.prop.val('Sections')}|${String(this.prop.val('MouthUpperCross'))}|` + this.curves.map(c => c.globalMatrix().elements.map(v => v.toFixed(5)).join(',') + ':' + (c.primitive?.version ?? 0)).join('|'); }
  apply(m: any) {
    if (!m?.positions) return m;
    const S = Math.max(1, Number(this.prop.val('Sections')) || 16);
    const pos = Array.from(m.positions as Float32Array); const polys: number[][] = m.polygons.map((f: number[]) => f.slice());
    const inv = this.mesh.globalMatrix().clone().invert();
    const crv = this.curves.map(c => ({ data: c.primitive?.curve(), g: c.globalMatrix() }));
    if (crv.some(c => !c.data)) return m;
    let fc: any = MOUTH_CROSS; try { fc = JSON.parse(String(this.prop.val('MouthUpperCross'))); } catch { /* default keys */ }
    const N = this.holePoints.length; const quad: number[] = []; const tt: number[] = [];
    // quadrant and position within it, per hole point (spans consumed in order)
    for (let i = 0, q = 0, start = 0; i < N; i++) {
      while (q < 3 && i >= start + this.spans[q]) { start += this.spans[q]; q++; }
      let t = this.spans[q] ? (i - start) / this.spans[q] : 0; if (q === 1 || q === 3) t = 1 - t;
      quad.push(q); tt.push(t);
    }
    const yBlend = tt.map(t => evalTangentFCurve(fc, t / 2));   // sampled once (first row)
    const PAIRS = [[0, 1], [2, 1], [2, 3], [0, 3]];   // curves R0 B1 L2 T3: Q0 (R,B) Q1 (L,B) Q2 (L,T) Q3 (R,T)
    const rows: number[][] = [this.holePoints.slice()];
    for (let k = 1; k <= S + 1; k++) {
      const pct = Math.min(100, k * 100 / S);
      const at = crv.map(c => curveAtPercent(c.data!, pct).applyMatrix4(c.g));
      const row: number[] = [];
      for (let i = 0; i < N; i++) {
        const [ai, bi] = PAIRS[quad[i]]; const A = at[ai], B = at[bi]; const t = tt[i];
        const w = new THREE.Vector3(A.x + t * (B.x - A.x), A.y + yBlend[i] * (B.y - A.y), A.z + t * (B.z - A.z)).applyMatrix4(inv);
        row.push(pos.length / 3); pos.push(w.x, w.y, w.z);
      }
      rows.push(row);
    }
    for (let r = 1; r <= S; r++) { const p = rows[r - 1], c = rows[r]; for (let j = 0; j < N; j++) { const j1 = (j + 1) % N; polys.push([p[j], p[j1], c[j1], c[j]]); } }
    polys.push(rows[S].slice());   // cap; row S+1 points stay orphans
    return build(Array.from({ length: pos.length / 3 }, (_, i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]), polys);
  }
}
function mouthInteriorDefs() {
  return [
    num('Depth', 1, 'Depth', { min: 0.1, max: 1000, uimin: 0.1, uimax: 10, inspectable: false }),
    num('Height', 1, 'Height', { min: 0.1, max: 1000, uimin: 0.1, uimax: 10, inspectable: false }),
    int('Sections', 16, 'Sections', { min: 8, max: 1000, uimin: 8, uimax: 100, animatable: true }),
    bool('Uvula', true, 'Uvula', { inspectable: false }),
    bool('Tongue', true, 'Tongue', { inspectable: false }),
    str('MouthUpperCross', JSON.stringify(MOUTH_CROSS), 'MouthUpperCross', { desc: 'FCurve' }),
  ];
}
function addOp(app: App, o: X3DObject, op: Operator) { const prim = o.primitive!; app.record('AddScriptedOp ' + op.name, () => prim.addOperator(op), () => prim.removeOperator(op)); }

// ================================================================== eye socket (scripted operator `eyeSocket`)
function eyeSocketDefs(n: number, rad: number, lastOld: number) {
  const A = { animatable: true }, NI = { animatable: false, inspectable: false };
  const h = Math.floor(n / 2);
  return [
    bool('CapEyeSocket', true, 'CapEyeSocket', A),
    int('Precision', 8, 'Precision', { min: 4, max: 20, ...NI }),
    bool('InvertPolys', true, 'InvertPolys', A),
    int('LacrimalGland', 0, 'LacrimalGland', { min: 0, max: Math.max(0, h - 1), uimin: 0, uimax: h, ...A }),
    int('ShiftLacrimal', 0, 'ShiftLacrimal', { min: -h, max: h, ...A }),
    num('Edge', 0, 'Edge', { min: 0, max: 1, ...A }),
    num('Radius', rad, 'Radius', { min: 0, max: 10 * rad, ...A }),
    num('RadialDensity', 1, 'RadialDensity', { min: 0.1, max: 2, ...A }),
    num('CenterDiflection', 0.5, 'CenterDiflection', { min: 0, max: 1, ...A }),
    int('lastOldPoint', lastOld, 'lastOldPoint', { min: 0, max: 1e7, ...NI }),
    int('lastNewPoint', 0, 'lastNewPoint', { min: 0, max: 1e7, ...NI }),
    num('centerX', 0, 'centerX', { min: -1e7, max: 1e7, ...NI }), num('centerY', 0, 'centerY', { min: -1e7, max: 1e7, ...NI }), num('centerZ', 0, 'centerZ', { min: -1e7, max: 1e7, ...NI }),
    num('rad', 0, 'rad', { min: 0, max: 1e7, ...NI }),
  ];
}
const WRITTEN = new Set(['lastNewPoint', 'centerX', 'centerY', 'centerZ', 'rad']);
export class EyeSocketOp extends Operator {
  constructor(readonly mesh: X3DObject, readonly prop: Property, readonly centroid: X3DObject, readonly holePoints: number[], readonly inner: number, readonly outer: number, readonly lacrimal: { point: number; position: number }) {
    super('eyeSocket', 'eyeSocket', []);
    (this as any).inputs = [mesh, prop, centroid];
  }
  depStamp() { return this.prop.params.filter(p => !WRITTEN.has(p.name)).map(p => String(p.value)).join(',') + '|' + this.centroid.globalMatrix().elements.map(v => v.toFixed(5)).join(','); }
  apply(m: any) {
    if (!m?.positions) return m;
    const P = this.prop; const v = (n: string) => Number(P.val(n));
    const pos = Array.from(m.positions as Float32Array); const polys: number[][] = m.polygons.map((f: number[]) => f.slice());
    const get = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const add = (p: THREE.Vector3) => { pos.push(p.x, p.y, p.z); return pos.length / 3 - 1; };
    const inv = this.mesh.globalMatrix().clone().invert();
    const c = globalPos(this.centroid).applyMatrix4(inv);
    const inner = get(this.inner), outer = get(this.outer); const mid = inner.clone().add(outer).multiplyScalar(0.5);
    const X = inner.clone().sub(outer); if (inner.x > outer.x) X.negate(); X.normalize();
    const Zp = X.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const Z = Zp.clone().lerp(new THREE.Vector3(0, 0, -1), v('CenterDiflection'));
    const C = mid.clone().addScaledVector(Z, v('Radius')); const median = mid.clone().sub(C); let r = outer.distanceTo(C);
    let yaw = Z.angleTo(new THREE.Vector3(0, 0, -1)); if (outer.x < 0) yaw = -yaw;
    if (!P.val('CapEyeSocket')) return m;   // (inferred) nothing added, lastNewPoint left empty
    const invert = !!P.val('InvertPolys');
    const quad = (a: number, b: number, cc: number, d: number) => polys.push(invert ? [a, b, cc, d] : [d, cc, b, a]);
    const tri = (a: number, b: number, cc: number) => polys.push(invert ? [a, b, cc] : [cc, b, a]);
    let H = this.holePoints.slice(); const n = H.length;
    const L = Math.trunc(v('LacrimalGland'));
    if (L > 0 && n >= 2 * L + 1) {
      const s = this.lacrimal.position - L + Math.trunc(v('ShiftLacrimal'));
      const seg = Array.from({ length: 2 * L + 1 }, (_, j) => H[(((s + j) % n) + n) % n]);
      let prev: number[] = [seg[L]];
      for (let rr = 1; rr <= L; rr++) {
        const a = get(seg[L - rr]), b = get(seg[L + rr]); const row: number[] = [];
        for (let k = 1; k <= 2 * rr - 1; k++) row.push(add(a.clone().lerp(b, k / (2 * rr))));
        const B = [seg[L - rr], ...row, seg[L + rr]];
        tri(B[0], B[1], prev[0]); tri(B[2 * rr - 1], B[2 * rr], prev[2 * rr - 2]);
        for (let j = 0; j <= 2 * rr - 3; j++) quad(prev[j], B[j + 1], B[j + 2], prev[j + 1]);
        prev = B;
      }
      for (let k = 1; k <= 2 * L - 1; k++) H[(((s + k) % n) + n) % n] = prev[k];
    }
    const e = v('Edge');
    if (e > 0) {
      C.z -= r * e;
      const row = H.map(i => add(get(i).add(new THREE.Vector3(0, 0, -r * e))));
      for (let j = 0; j < H.length; j++) { const j1 = (j + 1) % H.length; quad(H[j], H[j1], row[j1], row[j]); }
      H = row;
    }
    const sx = this.centroid.kinematics.local.val('sclx'), sy = this.centroid.kinematics.local.val('scly');
    const dirs = H.map(i => { const d = get(i).sub(c); d.z = 0; d.y *= sy * v('RadialDensity'); d.x *= sx; return d.lengthSq() ? d.normalize() : new THREE.Vector3(1, 0, 0); });
    const alpha = H.map(i => get(i).sub(C).angleTo(median));
    const Pn = Math.max(1, Math.trunc(v('Precision'))); const rot = new THREE.Matrix4().makeRotationY(yaw);
    let prevRow = H;
    for (let k = 1; k < Pn; k++) {
      const row = H.map((_, i) => { const th = alpha[i] + (Math.PI - alpha[i]) * k / Pn; const l = new THREE.Vector3(Math.sin(th) * dirs[i].x * r, Math.sin(th) * dirs[i].y * r, Math.cos(th) * r).applyMatrix4(rot); return add(l.add(C)); });
      for (let j = 0; j < H.length; j++) { const j1 = (j + 1) % H.length; quad(prevRow[j], prevRow[j1], row[j1], row[j]); }
      prevRow = row;
    }
    const apex = add(new THREE.Vector3(0, 0, -r).applyMatrix4(rot).add(C));
    for (let j = 0; j < H.length; j++) tri(prevRow[j], prevRow[(j + 1) % H.length], apex);
    // writes back into its input property (cmd-b18b open question 5)
    P.set('lastNewPoint', apex); P.set('centerX', C.x); P.set('centerY', C.y); P.set('centerZ', C.z); P.set('rad', r);
    return build(Array.from({ length: pos.length / 3 }, (_, i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]), polys);
  }
}

// ================================================================== GameExport_EyelidTools.js helpers (§4)
const CLAMP_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10];
const isEnvelopeOp = (op: Operator) => op instanceof EnvelopeOperator || op.name === 'Envelope Operator';
const envelopesOf = (o: X3DObject | null | undefined): EnvelopeOperator[] => (o?.primitive?.operators ?? []).filter(isEnvelopeOp) as EnvelopeOperator[];
/** GameExport(null, true): the game property (no inspect). */
function gameProperty(app: App, C: string): Property | null {
  const r = call(app, 'GameExport', { inObj: null, inNoInspect: true });
  if (r instanceof Property) return r;
  for (const o of app.scene.allObjects()) { const p = o.properties.find(q => /^GameExport/i.test(q.name)); if (p) { nyaB(app, C, 'GameExport(null, true) (Game_Export.js not contracted); the first `GameExport*` property of the scene is used'); return p; } }
  nyaB(app, C, 'GameExport(null, true) (Game_Export.js not contracted): no game property in this scene');
  return null;
}
function gameFaceFromProperty(app: App, C: string, prop: Property | null): X3DObject | null {
  const r = call(app, 'fr_GetGameFaceFromProperty', { inProp: prop });
  if (r instanceof X3DObject) return r;
  if (!prop) return null;
  nyaB(app, C, 'fr_GetGameFaceFromProperty (Game_Export.js not contracted); the property\'s GameFace / Game_Face / GameMesh value is used');
  for (const n of ['GameFace', 'Game_Face', 'GameMesh']) { const v = prop.val(n); const o = v instanceof X3DObject ? v : objOrName(app, v); if (isPolymesh(o)) return o; }
  return null;
}
interface FaceParts { face: X3DObject | null; prop: Property | null; step: number; clip: number; gameFace: X3DObject; envelope: EnvelopeOperator; [k: string]: any }
function faceParts(app: App, C: string, exportMesh: any): FaceParts | null {
  const face = sgetMesh(app, 'Mesh');
  const prop = gameProperty(app, C);
  const step = CLAMP_STEPS[intArg(prop?.val('OptimizeWeights'), 0)] ?? NaN;
  const clip = Number(prop?.val('Weights_Per_Bone'));
  const given = objOrName(app, exportMesh);
  const gameFace = isPolymesh(given) ? given : gameFaceFromProperty(app, C, prop);
  if (!gameFace) { siError(app, 'Could Not find game face, please pick game face in game export and run command again'); call(app, 'GameExport', {}); return null; }
  const env = envelopesOf(gameFace);
  if (env.length !== 1) { siError(app, `Incorrect number of Envelope Operators were found! [${env.length}] , this function is a postprocess command, first apply Game Export...`); call(app, 'GameExport', {}); return null; }
  return { face, prop, step, clip, gameFace, gameModel: gameFace.model, envelope: env[0] };
}
/** envelope arrays: per point one value per deformer, in percent. */
const readWeights = (env: EnvelopeOperator, n: number) => Array.from({ length: n }, (_, i) => Array.from(env.weights[i] ?? new Float32Array(env.deformers.length), w => w * 100));
function writeWeights(app: App, env: EnvelopeOperator, w: number[][]) {
  const old = env.weights.map(x => x.slice()); const next = w.map(r => Float32Array.from(r, x => x / 100));
  const prim: any = env.parent;
  app.record('SetEnvelopeWeights', () => { env.weights = next.map(x => x.slice()); if (prim) prim.dirty = true; }, () => { env.weights = old.map(x => x.slice()); if (prim) prim.dirty = true; });
}
/** clip weights (clip, step), cmd-b18b §4. */
export function clipWeights(w: number[][], clip: any, step: any): number[][] {
  const st = Math.max(Number(step), 0.1); const k = Number(clip);
  return w.map(row => {
    const order = row.map((_, i) => i).sort((a, b) => row[b] - row[a] || b - a);
    const out = new Array(row.length).fill(0);
    const top = order.slice(0, k); const sum = Array.from({ length: k }, (_, i) => row[order[i]]).reduce((s, x) => s + x, 0);   // missing entries -> NaN
    for (const i of top) out[i] = row[i] / sum * 100;
    if (top.length < k) out.fill(NaN);
    for (let i = 0; i < out.length; i++) if (out[i]) { const q = Math.floor(out[i] / st); const rem = out[i] - q * st; out[i] = rem > st / 2 ? (q + 1) * st : q * st; }
    let big = 0; for (let i = 1; i < out.length; i++) if (out[i] > out[big]) big = i;
    const s2 = out.reduce((s, x) => s + x, 0); out[big] += 100 - s2;
    return out;
  });
}
/** stack mute: `mute` of every construction-history operator that has one. */
function stackMute(app: App, o: X3DObject | null | undefined, on: boolean) { for (const op of o?.primitive?.operators ?? []) { const q = op.get('mute'); if (q) q.value = on; } if (o?.primitive) o.primitive.dirty = true; void app; }
const weightMapValues = (p: Property): Map<number, number> => ((p as any).values ??= new Map<number, number>());
function newWeightMap(name: string, values: Map<number, number>, rgb: [number, number, number] = [255, 0, 0]) {
  const p = new Property(name, 'weightmap', [num('min', 0, 'Minimum'), num('max', 1, 'Maximum'), int('red', rgb[0], 'red'), int('green', rgb[1], 'green'), int('blue', rgb[2], 'blue')]);
  (p as any).values = values; (p as any).label = 'Weight Map Property'; return p;
}
/** eyelash deformers (obj): objects under the object's model with FaceElement ID set and Type EyelashDeformer, one per ID. */
function eyelashDeformers(o: X3DObject | null): X3DObject[] {
  const m = o?.model; if (!m) return []; const seen = new Set<string>(); const out: X3DObject[] = [];
  for (const x of m.descendants()) { const fe = propNamed(x, 'FaceElement'); const id = fe?.val('ID'); if (fe && id !== undefined && id !== null && id !== '' && fe.val('Type') === 'EyelashDeformer' && !seen.has(String(id))) { seen.add(String(id)); out.push(x); } }
  return out;
}
/** fr_GetEyelashes(obj) (MakeEyelashes.js, not contracted). */
function getEyelashes(app: App, C: string, o: X3DObject | null): X3DObject[] {
  if (!o) return [];
  const r = call(app, 'fr_GetEyelashes', { inObj: o });
  if (Array.isArray(r)) return r.filter((x): x is X3DObject => x instanceof X3DObject);
  nyaB(app, C, 'fr_GetEyelashes (MakeEyelashes.js not contracted); objects under the model whose FaceElement.Type is `Eyelash` or keyed `Eyelash` are used');
  const m = o.model ?? o; const out: X3DObject[] = [];
  for (const x of m.descendants()) { const fe = propNamed(x, 'FaceElement'); if ((fe && fe.val('Type') === 'Eyelash') || keywordsOf(x).includes('Eyelash')) out.push(x); }
  return out;
}
function duplicateUnder(app: App, src: X3DObject, parent: X3DObject): X3DObject | null {
  const sel = app.selection.slice();
  const r = call(app, 'Duplicate', { InputObjs: [src], NbCopies: 1 });
  app.select(sel);   // selection unchanged
  const d = (Array.isArray(r) ? r[0] : r) as X3DObject | undefined;
  if (!(d instanceof X3DObject)) return null;
  // "current history": when this build's Duplicate leaves the copy without the source's geometry, the source's current
  // result is frozen onto the copy (the copy keeps no history either way).
  const sm = src.primitive?.mesh();
  if (sm && d.primitive && !d.primitive.mesh()) { const pos = Array.from(sm.positions); setGeometry(app, d, pos, sm.polygons); }
  reparent(app, d, parent);
  const old = d.name; app.record('Rename', () => { d.name = src.name; }, () => { d.name = old; });
  return d;
}

// ================================================================== registration
export function registerFaceRobotB18bCommands(app: App) {
  const reg = (name: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label: name, category: CAT, description: '', args: args.map(([n, d]) => ({ name: n, default: d })), execute });

  // ---------------------------------------------------------------- fr_CleanMeshModel (correction 2)
  reg('fr_CleanMeshModel', [['Del', null]], (app, a) => cleanMeshModel(app, a.Del));

  // ---------------------------------------------------------------- fr_Diagnose (correction 3)
  reg('fr_Diagnose', [], (app) => runDiagnose(app));

  // ---------------------------------------------------------------- fr_Freeze
  reg('fr_Freeze', [], (app) => {
    const mesh = getHead(app, 'Freeze Transform'); if (!mesh) return;
    const root = app.scene.root; const kids = [...mesh.children];
    for (const k of kids) reparentKeep(app, k, root);
    const oldParent = mesh.parentObj ?? root; reparentKeep(app, mesh, root);
    // SetNeutralPose(mesh, siSRT, true) then ResetTransform(mesh, siCtr, siSRT, siXYZ): the transform is baked into the
    // points and the local SRT and neutral pose become identity (the net effect; this build's commands work on the selection).
    b18(app).calls.push({ name: 'SetNeutralPose', args: { InputObjs: mesh, Type: 'siSRT', Reset: true } }, { name: 'ResetTransform', args: { InputObj: mesh, Mode: 'siCtr', Type: 'siSRT', Axis: 'siXYZ' } });
    const g = mesh.globalMatrix(); const pos = meshPositions(mesh);
    if (pos) { const out = new Float32Array(pos.length); const v = new THREE.Vector3(); for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(g); out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z; } setGeometry(app, mesh, out, mesh.primitive!.mesh()!.polygons); }
    const L = mesh.kinematics.local;
    for (const n of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'nposx', 'nposy', 'nposz']) { const q = L.get(n); if (q) app.setParam(q, 0); }
    for (const n of ['sclx', 'scly', 'sclz']) app.setParam(L.get(n)!, 1);
    reparent(app, mesh, oldParent);   // the transform is identity now, so the global pose is the parent's
    for (const k of kids) reparentKeep(app, k, mesh);
    runDiagnose(app);
  });

  // ---------------------------------------------------------------- fr_Holes
  reg('fr_Holes', [], (app) => {
    const C = 'fr_Holes';
    const container = cleanMeshModel(app, false)!;
    const mesh = getHead(app, 'Inspect Holes'); if (!mesh) return;
    const helper = getPolymesh(app, mesh);
    if (!helper.Diagnose) runDiagnose(app);
    if (!helper.Holes?.Edges?.length) return;
    let prop = propNamed(container, 'fr_InspectHoles');
    if (!prop) {
      const p = addProperty(app, container, newProp('fr_InspectHoles', [int('Holes', 0, 'Holes')]));
      p.onChange((q) => {
        if (q.name !== 'Holes') return; const k = Number(q.value); const h = b18(app).helper as PolyHelper; const m = sgetMesh(app, 'Mesh');
        if (!m) return;
        if (k === 0) { app.select([m]); return; }
        const edges = h?.Holes?.Edges?.[k - 1]; if (!edges) return;
        (p as any).currentHole = k - 1;
        app.selectComponents(m, 'edge', edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
      });
      prop = p;
    }
    refreshInspectHoles(app, prop);
    void C; inspect(app, prop);
  });

  // ---------------------------------------------------------------- fr_PickEyeProximity
  reg('fr_PickEyeProximity', [], (app) => {
    const mesh = getHead(app, 'PickEyeProximity'); if (!mesh) return;
    let helper = getPolymesh(app, mesh); if (!helper.Holes?.Edges?.length) helper = getPolymesh(app, mesh, 1);
    if (!transformOk(mesh)) { diagnose(app, `${mesh.name} has active tranforms. Freeze before running picking sockets.`); return; }
    if (helper.EyeHoles?.length) diagnose(app, 'Picking new eyeholes will clear previous selection.<br/>Right click to cancel<br/>');
    const picks = pickLoop(app, Infinity);
    if (!picks.length) { diagnose(app, 'No Eye Holes Picked'); return; }
    helper.EyeHoles = []; helper.GetHoles(); app.select([]); app.compSel = null;
    const nh = helper.holeCount();
    if (picks.length > nh) { diagnose(app, `Number of picks (${picks.length}) is greater than number of holes (${nh})`); return; }
    const idx = unique(picks.map(p => helper.GetClosestHole(p)).filter((x): x is number => x !== undefined));
    helper.EyeHoles = idx;
    for (const h of idx) app.selectComponents(mesh, 'edge', helper.Holes!.Edges[h].map(([a, b]) => `${a}-${b}`), 'add');
    diagnose(app, 'Adding Eye Holes: ' + idx.map(i => ` ${i}`).join('') + `<br/><li>Ready to Add (${idx.length}) Eye Sockets`);
  });

  // ---------------------------------------------------------------- fr_PickMouthProximity
  reg('fr_PickMouthProximity', [], (app) => {
    const mesh = getHead(app, 'PickMouthProximity'); if (!mesh) return;
    let helper = getPolymesh(app, mesh); if (!helper.Holes) helper = getPolymesh(app, mesh, 1);
    if (!transformOk(mesh)) { diagnose(app, `${mesh.name} has active tranforms. Freeze before running picking sockets.`); return; }
    if (helper.MouthHoles?.length) diagnose(app, 'Picking new mouth holes will clear previous selection.<br/>Right click to cancel.<br/>');
    const picks = pickLoop(app, 1);
    if (!picks.length) { diagnose(app, 'No Mouth Holes Picked'); return; }
    helper.MouthHoles = []; helper.GetHoles(); app.select([]); app.compSel = null;
    helper.GetHoles(1);   // the hole record has no `length`, so the second GetHoles always runs
    const idx = unique(picks.map(p => helper.GetClosestHole(p)).filter((x): x is number => x !== undefined));
    helper.MouthHoles = idx;
    for (const h of idx) { helper.ReorderHole(h); app.selectComponents(mesh, 'edge', helper.Holes!.Edges[h].map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`), 'add'); }
    diagnose(app, 'Adding Mouth Holes: ' + idx.map(i => ` ${i}`).join('') + `<br/><li>Ready to Add (${idx.length}) Mouth Interior`);
  });

  // ---------------------------------------------------------------- fr_AddMouthInterior
  reg('fr_AddMouthInterior', [], (app) => {
    const C = 'fr_AddMouthInterior';
    const container = cleanMeshModel(app, false)!;
    const mesh = getHead(app, 'Add Mouth Interior'); if (!mesh) return;
    const helper = getPolymesh(app, mesh); helper.GetHoles();
    if (!helper.MouthHoles?.length) { diagnose(app, 'Pick Mouth Proximity First '); return; }
    for (const h of helper.MouthHoles) {
      helper.ReorderHole(h);
      const H = helper.Holes!; const w = H.MajorAxisLength[h]; const q = H.QuadrantIndices?.[h]; const qp = H.QuadrantPoints?.[h];
      if (!q || q.length < 4 || !qp || qp.length < 4) throw scriptError(C, `hole ${h} has fewer than four quadrant points`);
      const prop = addProperty(app, container, newProp('fr_MouthInteriorProperty', mouthInteriorDefs()));
      prop.set('Depth', 2 * w); prop.set('Height', w);
      const N = H.Points[h].length; const spans = [q[1], q[2] - q[1], q[3] - q[2], N - q[3]];
      const P = (i: number) => helper.pos(qp[i]);
      const v = H.Centroids[h].clone(); v.z = P(0).z; const att = 2 * w - (P(1).z - v.z);
      const R = guideCurve(app, 'mGuideRight', container, SIDE, [-w, w, att], v);
      const B = guideCurve(app, 'mGuideBottom', container, BOTTOM, [w, w, 2 * w], P(1));
      const Lv = v.clone(); Lv.z = P(2).z;
      const Lc = guideCurve(app, 'mGuideLeft', container, SIDE, [w, w, att], Lv);
      const T = guideCurve(app, 'mGuideTop', container, TOP, [w, w, 2 * w], P(3));
      addOp(app, mesh, new MouthInteriorOp(mesh, [R, B, Lc, T], prop, H.PointIndices[h]!.slice(), spans));
      inspect(app, prop);
    }
    runDiagnose(app);
  });

  // ---------------------------------------------------------------- fr_AddEyeSocket
  reg('fr_AddEyeSocket', [], (app) => {
    const container = cleanMeshModel(app, false)!;
    const mesh = getHead(app, 'Add Eye Sockets'); if (!mesh) return;
    const helper = getPolymesh(app, mesh); helper.GetHoles();
    if (!helper.EyeHoles?.length) { diagnose(app, 'Pick Eye Proximity First '); return; }
    const st = b18(app); let lead: Property | null = null;
    for (const h of helper.EyeHoles) {
      helper.ReorderHole(h);
      const H = helper.Holes!; const pts = H.Points[h]; const n = pts.length;
      const F = H.FurthestPoints[h], O = H.OppositePoints[h];
      const [inner, outer] = Math.abs(helper.pos(F).x) <= Math.abs(helper.pos(O).x) ? [F, O] : [O, F];
      const rad = 0.75 * helper.pos(inner).distanceTo(helper.pos(outer));
      const maj = H.MajorAxisIndices[h] ?? [0, 0];
      const ends = maj.map(i => ({ position: i, point: pts[i] ?? pts[0] }));
      const lac = Math.abs(helper.pos(ends[0].point).x) <= Math.abs(helper.pos(ends[1].point).x) ? ends[0] : ends[1];
      const c = H.Centroids[h];
      const cen = (call(app, 'fr_AddObjectInPlace', { inPreset: 'Null', inType: 0, inParent: container, inScale: 1, inVector: [c.x, c.y, c.z], inName: 'EyeCentroid', inColor: 100 }) as X3DObject | undefined) ?? (() => { const x = newNull(app, 'EyeCentroid', container); setGlobalPos(app, x, c); return x; })();
      const lastOld = (mesh.primitive?.mesh()?.positions.length ?? 0) / 3;
      const prop = addProperty(app, container, newProp('eyeSocket', eyeSocketDefs(n, rad, lastOld)));
      if (lead) {
        prop.params.forEach((q, i) => {
          const lp = lead!.params[i]; if (!lp || !lp.animatable || !lp.def.animatable) return;
          try { app.anim.setExpression(q, lp.fullName, (nm) => (nm === lp.fullName ? lp : undefined)); } catch { /* errors ignored */ }
        });
      } else { lead = prop; inspect(app, prop); }
      const cls = addCluster(app, mesh, 'EyeEdge', 'pnt', H.PointIndices[h] ?? pts);
      const op = new EyeSocketOp(mesh, prop, cen, (H.PointIndices[h] ?? pts).slice(), inner, outer, lac);
      addOp(app, mesh, op);
      st.sockets.push({ prop, centroid: cen, cluster: cls, op, hole: h });
    }
    runDiagnose(app);
    (st.helper as any).EyeSockets = st.sockets;   // fr_GetFRPolymesh().EyeSockets
    app.select([mesh]);
  });

  // ---------------------------------------------------------------- fr_AddEyeBalls
  reg('fr_AddEyeBalls', [], (app) => {
    const C = 'fr_AddEyeBalls'; const st = b18(app);
    const mesh = getHead(app, 'fr_AddEyeBalls'); if (!mesh) return;
    mesh.primitive?.mesh();   // evaluate, so the socket operators have written their centres
    const ops = (mesh.primitive?.operators ?? []).filter(o => o.type === 'eyeSocket') as EyeSocketOp[];
    st.sockets = ops.map(op => ({ prop: op.prop, centre: new THREE.Vector3(op.prop.val('centerX'), op.prop.val('centerY'), op.prop.val('centerZ')), op }));
    if (!st.sockets.length) { diagnose(app, 'Build EyeSockets first, \n if EyeSockets exist import Eyeballs from Library'); return; }
    const fm = sgetFaceModel(app) ?? mesh;
    const ebp = addProperty(app, mesh, new Property('EyeballProperties', 'EyeballProperties', eyeballPropertyDefs()));
    const actor = entryObject(app, '_', 'Actor');
    const eyes: X3DObject[] = [];
    for (const s of st.sockets) {
      const Cc: THREE.Vector3 = s.centre.clone().applyMatrix4(mesh.globalMatrix()); const R = Number(s.prop.val('rad'));
      const lo = intArg(s.prop.val('lastOldPoint'), 0), hi = intArg(s.prop.val('lastNewPoint'), -1);
      const cls = addCluster(app, mesh, 'EyeSocket', 'pnt', Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i));
      const name = Cc.x > 0 ? 'LEye' : 'Eye';
      const eye = (call(app, 'fr_AddObjectInPlace', { inPreset: 'Null', inType: 0, inParent: actor, inScale: R / 10, inVector: [Cc.x, Cc.y, Cc.z], inName: name, inColor: 0 }) as X3DObject | undefined) ?? (() => { const x = newNull(app, name, actor); setGlobalPos(app, x, Cc); return x; })();
      eyes.push(eye);
      const cornea = call(app, 'fr_MakeEyeBall', { inParent: eye, inScale: 0.8 * R, inVector: [Cc.x, Cc.y, Cc.z], inProp: ebp }) as X3DObject | undefined;
      const iris = cornea?.children[0]; void iris;
      const fc = propNamed(fm, 'FaceConnections');
      if (fc && cornea) { const key = Cc.x > 0 ? 'REye' : 'LEye'; const q = ensureParam(app, fc, str(key, '', key)); app.setParam(q, cornea.fullName); }
      const sw = cornea ? call(app, 'ApplyOp', { PresetObj: 'ShrinkWrap', ConnectionSet: `${mesh.fullName}.polymsh.cls.${cls.name};${cornea.fullName};`, ConnectType: 3, ImmediateMode: 'siPersistentOperation' }) : undefined;
      const swOp = Array.isArray(sw) ? sw[0] : sw;
      if (swOp?.get?.('proj')) app.setParam(swOp.get('proj'), 6);
      else nyaB(app, C, 'the ShrinkWrap operator (not a preset of this build) and the meaning of proj = 6');
    }
    app.select(eyes);
    inspect(app, ebp);
    runDiagnose(app);
  });

  // ---------------------------------------------------------------- fr_GetGameSmoothMap
  reg('fr_GetGameSmoothMap', [['ExportMesh', null], ['HandleExisting', null]], (app, a) => getGameSmoothMap(app, 'fr_GetGameSmoothMap', a.ExportMesh, a.HandleExisting));

  // ---------------------------------------------------------------- fr_ApplyGameSmoothFromMap (HandleExisting ignored)
  reg('fr_ApplyGameSmoothFromMap', [['ExportMesh', null], ['HandleExisting', null]], (app, a) => {
    const C = 'fr_ApplyGameSmoothFromMap';
    const rec = getGameSmoothMap(app, C, a.ExportMesh, 0); if (!rec) return null;
    const env = envelopesOf(rec.gameFace)[0];
    if (!env) { siInfo(app, 'No Envelope Found to Smooth'); return rec; }
    const bar = new ProgressBar(app, 'Applying Smooth Map', 10, true);
    const n = (rec.gameFace.primitive?.mesh()?.positions.length ?? 0) / 3;
    bar.step('Gathering Envelope Data'); if (bar.cancelled()) return rec;
    let w = readWeights(env, n);
    bar.step('Gathering Envelope Data'); if (bar.cancelled()) return rec;
    bar.step('Collecting Neighbor information'); const nb = neighbours(rec.gameFace.primitive!.mesh()!.polygons, n); if (bar.cancelled()) return rec;
    bar.step('Smoothing Envelopes');
    const map: number[] = rec.GameWeightArray ?? [];
    for (let it = 0; it < 5; it++) {
      w = w.map((own, i) => { const A = 0.6 * (map[i] ?? 0); const ns = nb[i]; if (!ns.length) return own.slice(); return own.map((x, k) => (1 - A) * x + (A / ns.length) * ns.reduce((s, j) => s + w[j][k], 0)); });
    }
    if (bar.cancelled()) return rec;
    bar.step('Clipping Deformer Count and Optimizing Weights'); w = clipWeights(w, rec.clip, rec.step); if (bar.cancelled()) return rec;
    bar.step('Applying New Weights'); writeWeights(app, env, w);
    bar.step('Cleaning Up'); bar.hide();
    return rec;
  });

  // ---------------------------------------------------------------- ClipDeformers
  reg('ClipDeformers', [['Object', null], ['ClipDeformerCount', null], ['ClampDeformerStep', null]], (app, a) => {
    const C = 'ClipDeformers';
    const o = objOrName(app, a.Object); if (!o) throw scriptError(C, 'Object must be an object');
    const env = envelopesOf(o)[0];
    if (!env) { siInfo(app, 'No Envelope Found to Smooth'); return null; }
    const count = unset(a.ClipDeformerCount) || Number(a.ClipDeformerCount) === 0 ? 3 : Number(a.ClipDeformerCount);
    const step = unset(a.ClampDeformerStep) ? undefined : a.ClampDeformerStep;   // empty -> undefined step -> NaN weights (as shipped)
    const bar = new ProgressBar(app, 'Clipping Deformers', 5, true);
    const n = (o.primitive?.mesh()?.positions.length ?? 0) / 3;
    bar.step('Gathering Envelope Data'); if (bar.cancelled()) return null;
    let w = readWeights(env, n);
    bar.step('Gathering Envelope Data'); if (bar.cancelled()) return null;
    bar.step('Clipping Deformer Count and Optimizing Weights'); w = clipWeights(w, count, step); if (bar.cancelled()) return null;
    bar.step('Applying New Weights'); writeWeights(app, env, w); if (bar.cancelled()) return null;
    // FreezeObj on the envelope's nested objects (its weight-editing history): this build keeps no such history, so the
    // call is only recorded.
    bar.step('Cleaning Up'); b18(app).calls.push({ name: 'FreezeObj', args: { InputObjs: `${env.name} nested objects` } });
    bar.hide();
    return true;
  });

  // ---------------------------------------------------------------- fr_CopyEyelashes (true even on failure)
  reg('fr_CopyEyelashes', [['Face', null], ['GameFace', null]], (app, a) => {
    const C = 'fr_CopyEyelashes';
    const face = objOrName(app, a.Face) ?? sgetMesh(app, 'Mesh');
    if (!face) { siError(app, 'No Face Robot Face found'); return true; }
    const game = objOrName(app, a.GameFace) ?? gameFaceFromProperty(app, C, gameProperty(app, C));
    if (!game) { siError(app, 'No GameFace found'); call(app, 'GameExport', {}); return true; }
    if (getEyelashes(app, C, game).length) { siError(app, 'Game Face Already has eyelashes!, Delete first, then attempt to copy again'); return true; }
    const lashes = getEyelashes(app, C, face);
    if (!lashes.length) { siError(app, 'No eyelash meshes found.'); return true; }
    const defs = eyelashDeformers(face);
    if (!defs.length) { siError(app, 'No eyelash mehses found.'); return true; }
    const gm = game.model ?? app.scene.root;
    let grp = app.scene.groupList.find(g => g.name === 'Eyelashes' && (g.parent === gm || (g as any).model === gm)) ?? null;
    if (!grp) {
      const g = new Group('Eyelashes'); g.parent = gm as any; (g as any).model = gm; g.add(int('viewvis', 2, 'View Visibility'));
      app.record('AddGroup Eyelashes', () => app.scene.groupList.push(g), () => { const i = app.scene.groupList.indexOf(g); if (i >= 0) app.scene.groupList.splice(i, 1); });
      grp = g;
    }
    for (const l of lashes) { const d = duplicateUnder(app, l, game); if (d) addToGroup(app, grp, d); }
    for (const df of defs) { const d = duplicateUnder(app, df, game); if (d) for (let i = 0; i < constraintsOf(d).length; i++) deleteNode(app, constraintsOf(d)[i]); }
    return true;
  });

  // ---------------------------------------------------------------- fr_TransferEyelashEnvelope (true even on failure)
  reg('fr_TransferEyelashEnvelope', [['FR_HeadNull', null], ['GameFace', null], ['Envelope', null], ['Animation', null]], (app, a) => {
    const C = 'fr_TransferEyelashEnvelope';
    const head = objOrName(app, a.FR_HeadNull), game = objOrName(app, a.GameFace);
    const lashes = getEyelashes(app, C, game);
    if (!lashes.length) return true;
    const valid: X3DObject[] = [];
    for (const l of lashes) { if (!l.cluster('LashAttachCluster')) siError(app, `Cluster <"LashAttachCluster"> not found for mesh, ${l.fullName}, check validity`); else valid.push(l); }
    const gd = eyelashDeformers(game), fd = eyelashDeformers(head);
    if (gd.length !== lashes.length) { siError(app, `(${gd.length}) Game Eyelash Deformers to drive (${lashes.length}) Eyelashes `); return true; }
    if (fd.length !== gd.length) { siError(app, `(${fd.length}) Face Eyelash Deformers to drive (${gd.length}) Game Eyelash Deformers `); return true; }
    gd.forEach((g, i) => { const c = new Constraint('Pose Cns', 'posecns', [], [fd[i]]); addProperty(app, g, c); });
    if (boolArg(a.Envelope, false)) {
      const genv = envelopesOf(game)[0];
      if (!genv) { siError(app, 'No Game Envelope found, Generate game envelope before Transfering Eyelashes'); return true; }
      const gn = (game!.primitive?.mesh()?.positions.length ?? 0) / 3; const gw = readWeights(genv, gn);
      lashes.forEach((l, i) => {
        if (!valid.includes(l)) return;
        call(app, 'fr_ResetRetarget', { inMute: true }); genv.set('mute', true);
        const list: X3DObject[] = [gd[i]]; const tmpl = mappingTemplate(l, game!); const attach = l.cluster('LashAttachCluster')!;
        const rows: number[][] = tmpl.map((t, p) => {
          const row = new Map<number, number>();
          if (!attach.elements.has(p)) row.set(0, 100);
          else t.tri.forEach((v, k) => { (gw[v] ?? []).forEach((wt, d) => { if (wt >= 0.1) { const def = genv.deformers[d]; let at = list.findIndex(x => x === def); if (at < 0) { list.push(def); at = list.length - 1; } row.set(at, (row.get(at) ?? 0) + wt * t.w[k]); } }); });
          return row as any;
        }).map((row: any) => { const r = new Array(list.length).fill(0); for (const [k, v] of row) r[k] = v; return r; });
        for (const old of envelopesOf(l)) deleteNode(app, old);
        call(app, 'ResetActor', { InputObjs: fd }); call(app, 'ResetActor', { InputObjs: list });
        const env = new EnvelopeOperator(list, () => l); env.setReferencePoses();
        app.record('ApplyEnvelope', () => l.primitive!.addOperator(env), () => l.primitive!.removeOperator(env));
        writeWeights(app, env, rows.map(r => r.concat(new Array(Math.max(0, list.length - r.length)).fill(0))));
        const gp = gameProperty(app, C); const step = CLAMP_STEPS[intArg(gp?.val('OptimizeWeights'), 0)];
        app.run('ClipDeformers', { Object: l, ClipDeformerCount: gp?.val('Weights_Per_Bone'), ClampDeformerStep: step });
        genv.set('mute', false); call(app, 'fr_ResetRetarget', { inMute: false });   // inside the per-lash loop, as shipped
      });
      call(app, 'SetPropertyDisplay', { inObj: null, inNames: ['attrselpointsweight'], inValues: [false] });
    }
    if (boolArg(a.Animation, false)) {
      const params = gd.flatMap(g => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'].map(p => `${g.fullName}.kine.local.${p}`));
      call(app, 'PlotAndApplyAction', { InputObj: params.join(','), Name: 'plot', StartFrame: app.anim.startFrame, EndFrame: app.anim.endFrame, StepFrame: 1 });
      nyaB(app, C, 'PlotAndApplyAction arguments beyond the step (20, 1, false, 0.01, true, true, false, true) in this build');
      for (const g of gd) for (let i = 0; i < constraintsOf(g).length; i++) deleteNode(app, constraintsOf(g)[i]);
    }
    return true;
  });

  // ---------------------------------------------------------------- UndoGameSmooth (deprecated)
  reg('UndoGameSmooth', [['ExportMesh', null]], (app, a) => {
    const C = 'UndoGameSmooth';
    const parts = faceParts(app, C, a.ExportMesh);
    if (!parts) throw scriptError(C, 'the face-parts record is missing');
    const props = parts.gameFace.properties.filter(p => p.name.includes('TEMPORARY_Envelope'));
    const last = props[props.length - 1];
    if (!last) { siError(app, 'No More Envelopes Stored...'); return; }
    const env = envelopesOf(parts.gameFace)[0]; const n = (parts.gameFace.primitive?.mesh()?.positions.length ?? 0) / 3;
    const flat = String(last.val('Text') ?? last.val('text') ?? (last as any).text ?? '').split(',').map(Number);
    const k = env?.deformers.length ?? 1;
    if (env) writeWeights(app, env, Array.from({ length: n }, (_, i) => flat.slice(i * k, i * k + k)));
    deleteNode(app, last);
  });
}

/** fr_Diagnose body. */
function runDiagnose(app: App): boolean {
  call(app, 'FaceRobot', {});
  const mesh = getHead(app, 'Diagnose');
  const fm = sgetFaceModel(app); const fs = fm ? propNamed(fm, 'FaceState') : undefined;
  const setValid = (v: boolean) => { if (fs) app.setParam(ensureParam(app, fs, bool('Valid', false, 'Valid')), v); };
  if (!mesh) { setValid(false); return false; }
  const lines: string[] = []; let pass = true; const bad = (t: string) => { lines.push(`<font color=#82140F>${t}</font>`); pass = false; };
  lines.push(`<li>Mesh: <b>${mesh.fullName}</b>`);
  call(app, 'FaceRobot', { cmd: 'next', arg: '', id: '15' });
  lines.push(`<li>Number of Polygons in Mesh: <b>${mesh.primitive?.mesh()?.polygons.length ?? 0}</b>`);
  if (!transformOk(mesh)) bad('Freeze Transform before Scan.');
  const helper = getPolymesh(app, mesh, 1); helper.GetHoles(1);
  if (helper.holeCount() > 1) { bad('Only one hole allowed in at neck base.'); lines.push(`<li>Number of Holes in Mesh: <b>${helper.holeCount()}</b>`); }
  const L = sgetMesh(app, 'LEye'), R = sgetMesh(app, 'REye');
  if (!L || !R) bad('Eyeballs required.');
  else for (const e of [L, R]) {
    const wp = worldPoints(e); if (!wp.length) continue;
    const box = new THREE.Box3().setFromPoints(wp); const t = globalPos(e);
    if (!box.containsPoint(t)) { bad('Center Eyeballs on their pivots.'); break; }
  }
  if (!sgetMesh(app, 'UpperTeeth') || !sgetMesh(app, 'LowerTeeth')) bad('Upper and Lower Teeth required.');
  const dna = fs ? ensureParam(app, fs, str('DNA', '', 'DNA')) : null;
  if (!dna || !String(dna.value ?? '')) bad('Please select the face type in the <b>Type</b> tab above.');
  const stackL: string[] = [], animL: string[] = [], cnsL: string[] = [];
  for (const k of frStore(app).keys('meshes')) {
    const m = entryObject(app, 'meshes', k); if (!m) continue;
    if ((m.primitive?.operators.length ?? 0) > 1) stackL.push(m.name);
    const params = [...m.kinematics.local.params, ...m.properties.flatMap(p => p.params), ...(m.primitive?.params ?? [])];
    if (params.some(p => app.anim.isAnimated(p))) animL.push(m.name);
    if (constraintsOf(m).length) cnsL.push(m.name);
  }
  if (stackL.length) lines.push(`<li>Scan will Freeze Modeling Stack for: <b>${stackL.join(', ')}</b>`);
  if (animL.length) lines.push(`<li>Scan will Delete Animation Sources on: <b>${animL.join(', ')}</b>`);
  if (cnsL.length) lines.push(`<li>Scan will Remove Constraints from: <b>${cnsL.join(', ')}</b>`);
  if (pass) {
    const designer = app.commands.has('fr_IsDesigner') ? !!call(app, 'fr_IsDesigner', {}) : true;
    if (designer) lines.push('<br/><font color=#388387><b>READY TO SCAN.</b></font>');
    else lines.push('<li>Version: <b>Face Robot Animator</b>', '<br/><font color=#833887><b>READY TO SCAN IN FACE ROBOT DESIGNER</font>.</b></font>');
  } else lines.push('<br/><font color=#82140F><b>MESH NOT READY.</b></font>');
  const text = lines.map(l => l + '<br/>').join('');
  diagnose(app, text); helper.Diagnose = text;
  setValid(pass);
  return pass;
}
/** fr_InspectHoles layout: combo items `<mesh> has <n> holes` = 0, Hole_1 = 1 ... Hole_n = n. */
function refreshInspectHoles(app: App, prop: Property) {
  const m = sgetMesh(app, 'Mesh'); const h = b18(app).helper as PolyHelper;
  if (!m || !h?.GetHoles) { (prop as any).items = []; return; }
  h.GetHoles(); const n = h.holeCount();
  (prop as any).items = n ? [{ label: `${m.name} has ${n} holes`, value: 0 }, ...Array.from({ length: n }, (_, i) => ({ label: `Hole_${i + 1}`, value: i + 1 }))] : [];
}

/** fr_GetGameSmoothMap body (also step 1 of fr_ApplyGameSmoothFromMap). */
function getGameSmoothMap(app: App, C: string, exportMesh: any, handle: any): any {
  const mode = unset(handle) || handle === '' ? 0 : intArg(handle, 0);
  const bar = new ProgressBar(app, 'Getting Smooth Map', 4, true);
  if (bar.cancelled()) return null;
  const parts = faceParts(app, C, exportMesh); if (!parts) { bar.hide(); return null; }
  const rec: any = { ...parts, Cls: null, Map: null, GameWeightArray: null };
  const game = parts.gameFace; const ng = (game.primitive?.mesh()?.positions.length ?? 0) / 3;
  bar.step(); if (bar.cancelled()) return null;
  const old = game.cluster('GameEnvelopeSmooth');
  const oldMap = old?.properties.find(p => p.name === 'GameEnvelopeSmooth');
  if (old && oldMap) {
    if (mode === 0) { rec.Cls = old; rec.Map = oldMap; rec.GameWeightArray = Array.from({ length: ng }, (_, i) => weightMapValues(oldMap).get(i) ?? 0); bar.hide(); return rec; }
    if (mode === 1) { const ans = msgBox(app, `Map <<${oldMap.fullName}>> Exists,\nDo you want to Overwrite File?`, 4 | 0x100, 'Game Export Smooth Map'); if (ans === 7) { bar.hide(); return rec; } }
    deleteNode(app, old);
  } else if (old && mode !== 0) deleteNode(app, old);
  // face weights
  const face = parts.face; if (!face?.primitive?.mesh()) { bar.hide(); throw scriptError(C, 'no Face Robot face mesh (meshes/Mesh)'); }
  const fm = face.primitive.mesh()!; const nf = fm.positions.length / 3; const nb = neighbours(fm.polygons, nf);
  const eyelid = new Array(nf).fill(0); const seen = new Array(nf).fill(false);
  for (const c of face.clusters) {
    if (!c.name.includes('Eyelid')) continue; const em = c.properties.find(p => p.name === 'EdgeMap'); if (!em) continue;
    for (const [i, v] of weightMapValues(em)) if (i < nf) { if (!seen[i] || v > eyelid[i]) eyelid[i] = v; seen[i] = true; }
  }
  for (let i = 0; i < nf; i++) eyelid[i] = seen[i] ? 1 - 2 * Math.abs(eyelid[i] - 0.5) : 0;
  const mouth = face.cluster('MouthRegion'), lips = face.cluster('MouthLipRegion');
  if (!mouth || !lips) { siError(app, 'Mouth Clusters not found ...'); bar.hide(); throw scriptError(C, 'mouth clusters missing (inferred)'); }
  const shrink = (c: Cluster, frac: number) => {
    const set = new Set([...c.elements].map(Number)); const target = frac * set.size; let pass = 0;
    while (set.size > target) {
      if (++pass > 100) { siInfo(app, 'Point Set run amok'); break; }
      const border = [...set].filter(p => nb[p]?.some(q => !set.has(q))); if (!border.length) break;
      for (const p of border) set.delete(p);
    }
    return set;
  };
  const m9 = shrink(mouth, 0.9), l2 = shrink(lips, 0.2); const ring = new Set([...m9].filter(p => !l2.has(p)));
  const dist = new Map<number, number>(); let frontier = [...ring].filter(p => nb[p]?.some(q => !ring.has(q)));
  for (const p of frontier) dist.set(p, 1);
  for (let d = 2; frontier.length; d++) { const next: number[] = []; for (const p of frontier) for (const q of nb[p]) if (ring.has(q) && !dist.has(q)) { dist.set(q, d); next.push(q); } frontier = next; }
  const maxD = Math.max(1, ...dist.values());
  const fw = eyelid.map((e, i) => Math.max(e, dist.has(i) ? dist.get(i)! / maxD : 0));
  bar.step(); if (bar.cancelled()) return null;
  stackMute(app, face, true); stackMute(app, game, true);
  const tmpl = mappingTemplate(game, face);
  const gw = tmpl.map(t => t.tri.reduce((s, v, k) => s + fw[v] * t.w[k], 0));
  stackMute(app, face, false); stackMute(app, game, false);
  nyaB(app, C, 'the smoothed-surface point locator (GetClosestLocationsWithinRadius on the subdivided face); the control mesh triangles are used');
  const cls = addCluster(app, game, 'GameEnvelopeSmooth', 'pnt', Array.from({ length: ng }, (_, i) => i));
  const map = addClusterProp(app, cls, newWeightMap('GameEnvelopeSmooth', new Map(gw.map((v, i) => [i, v]))));
  rec.Cls = cls; rec.Map = map; rec.GameWeightArray = gw; rec.FaceWeights = fw;
  bar.step(); bar.hide();
  return rec;
}
export { getGameSmoothMap, runDiagnose, cleanMeshModel, isInScene, Model, groupNamed };
