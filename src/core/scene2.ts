// Object types and operators beyond polygon meshes: NURBS curves and surfaces, generators that reference
// other objects, lattices, implicit primitives, skeleton chains, text, and the richer deformers.
import { siParamDefs, siLayout, siName } from './opdefs';
import * as THREE from 'three';
import { X3DObject, Primitive, Operator, Node, makeDisplay, makeGeomApprox, threeOrder, stampOf } from './scene';
import { num, int, bool, enumP, str } from './params';
import { MeshData } from './geometry';
import * as C from './curves';
import * as N from './nurbs';
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
import type { CurveData, V3 } from './curves';
import * as T2 from './topology2';
import type { LatticeData } from './topology2';
import type { CompSel } from './topology';

// ------------------------------------------------------------------ curves
export class CurveGeomOperator extends Operator {
  constructor(readonly preset: string, defs: any[]) { super('Geometry', 'crvgeom', defs); }
  apply(): CurveData {
    const v = (n: string) => Number(this.val(n));
    switch (this.preset) {
      case 'Circle': return C.circleCurve(v('radius'));
      case 'Arc': return C.arcCurve(v('radius'), v('start'), v('end'), v('cvs'));
      case 'Spiral': return C.spiralCurve(v('startradius'), v('endradius'), v('height'), v('revolutions'), v('cvs'));
      case 'Square': return C.squareCurve(v('length'));
    }
    return C.makeCurve([[0, 0, 0], [4, 0, 0]], 1);
  }
}
export function makeCurveGeomOperator(preset: string) {
  switch (preset) {
    case 'Circle': return new CurveGeomOperator(preset, [num('radius', 4, 'Radius', { min: 0.01 })]);
    case 'Arc': return new CurveGeomOperator(preset, [num('radius', 4, 'Radius', { min: 0.01 }), num('start', 0, 'Start Angle', { min: -360, max: 360 }), num('end', 180, 'End Angle', { min: -360, max: 360 }), int('cvs', 8, 'Nb Control Points', { min: 4, max: 64 })]);
    case 'Spiral': return new CurveGeomOperator(preset, [num('startradius', 1, 'Start Radius', { min: 0 }), num('endradius', 4, 'End Radius', { min: 0 }), num('height', 8, 'Height'), num('revolutions', 3, 'Revolutions', { min: 0.1, max: 50 }), int('cvs', 48, 'Nb Control Points', { min: 4, max: 400 })]);
    default: return new CurveGeomOperator('Square', [num('length', 8, 'Length', { min: 0.01 })]);
  }
}
/** A curve drawn by hand or frozen: holds its CVs directly. */
export class DrawnCurveOperator extends Operator {
  constructor(public points: V3[], degree: number, closed = false) { super('Geometry', 'crvgeom', [int('degree', degree, 'Degree', { min: 1, max: 7 }), bool('closed', closed, 'Closed')]); }
  apply(): CurveData { return C.makeCurve(this.points, this.val('degree'), this.val('closed')); }
}
export class CurveEditOperator extends Operator {
  constructor(readonly preset: string, defs: any[] = []) { super(preset, 'crvop', [...defs, bool('mute', false, 'Mute')]); }
  apply(c: CurveData | null): CurveData | null {
    if (!c || this.val('mute')) return c;
    switch (this.preset) {
      case 'Inverse': return C.reverseCurve(c);
      case 'Open/Close': return C.toggleClosed(c);
      case 'Insert Knot': { const [u0, u1] = C.curveDomain(c); return C.insertKnot(c, u0 + (u1 - u0) * Number(this.val('position') ?? 0.5)); }
      case 'Bezier Knots': return C.setKnotMultiplicity(c, c.degree);
      case 'Bezier Corners': return C.setKnotMultiplicity(c, c.degree);
      case 'Linear Segments': return C.linearizeSegments(c);
      case 'Non-Bezier Knots': return C.unbezier(c);
      case 'Raise Degree': return C.raiseDegree(c);
      case 'Clean': return C.cleanCurve(c, this.val('tolerance'));
      case 'Reparameterize': return C.reparameterize(c);
      case 'Shift U': return C.shiftCurve(c, this.val('shift'));
      case 'Fit on Curve': return C.fitCurve(c, this.val('cvs'), this.val('degree'));
      case 'Extract Segment': return C.extractSegment(c, this.val('start'), this.val('end'));
      case 'Remove Knots': { const [u0, u1] = C.curveDomain(c); return C.removeKnot(c, u0 + (u1 - u0) * Number(this.val('position') ?? 0.5)); }
    }
    return c;
  }
}
export function makeCurveEditOperator(preset: string) {
  switch (preset) {
    case 'Clean': return new CurveEditOperator(preset, [num('tolerance', 0.01, 'Tolerance', { min: 0, max: 10 })]);
    case 'Shift U': return new CurveEditOperator(preset, [int('shift', 1, 'Shift', { min: -64, max: 64 })]);
    case 'Fit on Curve': return new CurveEditOperator(preset, [int('cvs', 8, 'Nb Control Points', { min: 2, max: 400 }), int('degree', 3, 'Degree', { min: 1, max: 7 })]);
    case 'Extract Segment': return new CurveEditOperator(preset, [num('start', 0, 'Start', { min: 0, max: 1 }), num('end', 0.5, 'End', { min: 0, max: 1 })]);
    case 'Insert Knot': case 'Remove Knots': return new CurveEditOperator(preset, [num('position', 0.5, 'Position (U)', { min: 0, max: 1 })]);
    case 'Inverse': case 'Open/Close': case 'Raise Degree': case 'Reparameterize': case 'Bezier Knots': case 'Bezier Corners': case 'Linear Segments': case 'Non-Bezier Knots': return new CurveEditOperator(preset);
  }
  return null;
}

// ---------------------------------------------------------------- surfaces
export class SurfaceGeomOperator extends Operator {
  constructor(readonly preset: string, defs: any[]) { super('Geometry', 'srfgeom', defs); }
  apply(): MeshData | null {
    const p: Record<string, number> = {}; for (const x of this.params) p[x.name] = Number(x.value);
    const f = C.surfacePrimitives[this.preset]; if (!f) return null; const { fn, closedU, closedV } = f(p);
    const m = C.tessellateSurface(fn, p.subdivu, p.subdivv, closedU, closedV) as any;
    const nu = closedU ? p.subdivu : p.subdivu + 1, nv = closedV ? p.subdivv : p.subdivv + 1; const cps: [number, number, number][] = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) cps.push(fn(i / p.subdivu, j / p.subdivv));
    m.nurbs = { nu, nv, degU: 1, degV: 1, closedU, closedV, cps }; return m;
  }
}
export function makeSurfaceGeomOperator(preset: string) {
  const common = (extra: any[], u = 8, v = 8) => [...extra, int('subdivu', u, 'Subdivisions U', { min: 1, max: 128 }), int('subdivv', v, 'Subdivisions V', { min: 1, max: 128 })];
  switch (preset) {
    case 'Sphere': return new SurfaceGeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 })], 12, 8));
    case 'Torus': return new SurfaceGeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('innerradius', 1.5, 'Inner Radius', { min: 0.01 })], 12, 8));
    case 'Cylinder': case 'Cone': return new SurfaceGeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('height', 8, 'Height', { min: 0.01 })], 12, 4));
    case 'Disc': return new SurfaceGeomOperator(preset, common([num('radius', 4, 'Radius', { min: 0.01 }), num('innerradius', 1, 'Inner Radius', { min: 0 })], 12, 3));
    case 'Grid': return new SurfaceGeomOperator(preset, common([num('ulength', 8, 'U Length', { min: 0.01 }), num('vlength', 8, 'V Length', { min: 0.01 })], 4, 4));
    case 'Cube': return new SurfaceGeomOperator(preset, common([num('length', 8, 'Length', { min: 0.01 })], 4, 24));
  }
  return null;
}

// -------------------------------------------------------------- generators
/** Generators read other objects' geometry (curves or meshes) at evaluation time. */
/** Softimage op type for each generator preset (ApplyGenOp PresetObj). */
export const GEN_TYPES: Record<string, string> = { 'Extrusion Along Axis': 'extrusion', 'Revolution Around Axis': 'revolution', 'Loft': 'loft', 'Extrusion Along Curve': 'extrusion', 'Birail': 'birail', 'Four-Sided': 'foursided', 'Curve Net': 'crvnet', 'Curves To Mesh': 'CurveListToMesh', 'Boolean': 'booleansrftopoop', 'Blend': 'blendcrv', 'Merge Curves': 'mergecrv', 'Merge Meshes': 'mergemesh', 'Nurbs To Mesh': 'nurbstomesh', 'Extract Curve From Surface': 'extractcrvseg' };
export class GeneratorOperator extends Operator {
  private inputVersions: number[] = [];
  readonly siType: string;
  constructor(readonly preset: string, readonly inputs: X3DObject[], readonly owner: () => X3DObject | null, defs: any[]) {
    const t = GEN_TYPES[preset] ?? 'genop'; const si = siParamDefs(t); const names = new Set(si.map(d => d.name));
    super(siName(t, preset), t, [...si, ...defs.filter(d => !names.has(d.name))]);
    this.siType = t; this.layout = siLayout(t);
  }
  /** Read a Softimage parameter, falling back to a legacy name. */
  p(si: string, legacy?: string, dflt = 0): number { const a = this.get(si); if (a) return Number(a.value); const b = legacy ? this.get(legacy) : undefined; return b ? Number(b.value) : dflt; }
  inputsChanged() { const vs = this.inputs.map(o => o.primitive?.version ?? -1); const ch = vs.some((v, i) => v !== this.inputVersions[i]); this.inputVersions = vs; return ch; }
  depStamp() { return stampOf([...this.inputs, this.owner()]); }
  apply(): any {
    const v = (n: string) => Number(this.val(n));
    const me = this.owner(); const invMe = me ? me.globalMatrix().invert() : new THREE.Matrix4();
    const curveOf = (o: X3DObject): CurveData | null => { const c = o.primitive?.curve(); if (!c) return null; const M = invMe.clone().multiply(o.globalMatrix()); return { ...c, cvs: c.cvs.map(p => { const q = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(M); return [q.x, q.y, q.z, p[3]] as [number, number, number, number]; }) }; };
    const meshOf = (o: X3DObject) => { const m = o.primitive?.mesh(); if (!m) return null; return T2.mergeMeshes([{ mesh: m, matrix: invMe.clone().multiply(o.globalMatrix()).elements as any }]); };
    const curves = this.inputs.map(curveOf).filter((c): c is CurveData => !!c);
    // Softimage axis flags (alongx/alongy/alongz, revx/revy/revz) or the legacy axis enum
    const flagAxis = (pre: string): V3 => { if (this.get(pre + 'x')) { const f = [!!this.val(pre + 'x'), !!this.val(pre + 'y'), !!this.val(pre + 'z')]; const i = f.indexOf(true); return [[1, 0, 0], [0, 1, 0], [0, 0, 1]][i < 0 ? 1 : i] as V3; } return [[1, 0, 0], [0, 1, 0], [0, 0, 1]][Number(this.val('axis') ?? 1)] as V3; };
    const U = () => Math.max(1, this.p('subdivu', 'usub', 10)), W = () => Math.max(1, this.p('subdivv', 'vsub', 10));
    switch (this.preset) {
      // generators build true NURBS surfaces (knots, weights) and tessellate them; the grid rides on the mesh as `nurbs`
      case 'Extrusion Along Axis': { if (!curves[0]) return null; let ax = flagAxis('along'); if (this.val('localaxis') && this.inputs[0]) { const q = new THREE.Vector3(...ax).transformDirection(invMe.clone().multiply(this.inputs[0].globalMatrix())); ax = [q.x, q.y, q.z]; }
        const srf = N.extrudeNurbs(curves[0], ax, this.p('length', undefined, 10), W(), this.p('startpos', undefined, 0), !!this.val('fromcenter')); if (this.val('closev')) srf.closedV = true; return N.tessellateNurbs(srf, U(), W()); }
      case 'Revolution Around Axis': { if (!curves[0]) return null; let ax = flagAxis('rev'); let org: V3 = [0, 0, 0]; if (this.val('localaxis') && this.inputs[0]) { const M = invMe.clone().multiply(this.inputs[0].globalMatrix()); const q = new THREE.Vector3(...ax).transformDirection(M); ax = [q.x, q.y, q.z]; const o = new THREE.Vector3().applyMatrix4(M); org = [o.x, o.y, o.z]; }
        const srf = N.revolveNurbs(curves[0], ax, this.p('ang', 'angle', 360), this.p('startang', undefined, 0), org); return N.tessellateNurbs(srf, W(), U()); }
      case 'Loft': { if (curves.length < 2) return null; const srf = N.loftNurbs(curves, { startScale: this.p('startscl', undefined, 1), endScale: this.p('endscl', undefined, 1), closeV: !!this.val('closev'), degV: this.p('startcont', undefined, 2) === 0 ? 1 : 3 }); if (this.val('closeu')) srf.closedU = true; return N.tessellateNurbs(srf, U(), W()); }
      case 'Extrusion Along Curve': { if (curves.length < 2) return null; const srf = N.sweepNurbs(curves[0], curves[1], W(), this.get('snapprof') ? !!this.val('snapprof') : true, this.get('align') ? this.p('align', undefined, 2) !== 0 : true); return N.tessellateNurbs(srf, U(), W()); }
      case 'Birail': { if (curves.length < 3) return null; const srf = N.birailNurbs(curves[0], curves[1], curves[2], W()); return N.tessellateNurbs(srf, U(), W()); }
      case 'Four-Sided': { if (curves.length < 4) return null; const [A, B, Cc, D] = curves.slice(0, 4).map(x => C.sampleCurve(x, 33)); const at = (pts: V3[], t: number) => pts[Math.round(t * 32)];
        const srf = N.gridNurbs((u, v) => { const l = add3(mul3(at(A, u), 1 - v), mul3(at(Cc, u), v)), r = add3(mul3(at(D, v), 1 - u), mul3(at(B, v), u)); const b = add3(add3(mul3(A[0], (1 - u) * (1 - v)), mul3(A[32], u * (1 - v))), add3(mul3(Cc[0], (1 - u) * v), mul3(Cc[32], u * v))); return sub3(add3(l, r), b); }, Math.max(4, U() + 1), Math.max(4, W() + 1)); return N.tessellateNurbs(srf, U(), W()); }
      case 'Curve Net': { if (curves.length < 2) return null; const nbU = Math.max(1, Math.min(curves.length - (this.get('nbvcurves') ? 0 : 1), this.p('nbucurves', undefined, Math.ceil(curves.length / 2)))); const fn = N.curveNetFn(curves.slice(0, nbU), curves.slice(nbU)); const srf = N.gridNurbs(fn, Math.max(4, U() + 1), Math.max(4, W() + 1)); return N.tessellateNurbs(srf, U(), W()); }
      case 'Curves To Mesh': return curves[0] ? C.curveToMesh(curves[0], Math.max(3, this.p('stepcontour', 'segments', 3) * 8)) : null;
      case 'Blend': return curves.length >= 2 ? C.blendCurves(curves[0], curves[1]) : null;
      case 'Merge Curves': return curves.length >= 2 ? C.mergeCurves(curves[0], curves[1]) : null;
      case 'Merge Meshes': { const parts = this.inputs.map(meshOf).filter((m): m is MeshData => !!m); return parts.length ? T2.mergeMeshes(parts.map(m => ({ mesh: m, matrix: new THREE.Matrix4().elements as any }))) : null; }
      case 'Nurbs To Mesh': return this.inputs[0] ? meshOf(this.inputs[0]) : null;
      case 'Boolean': { const parts = this.inputs.map(meshOf).filter((m): m is MeshData => !!m); if (parts.length < 2) return null; const bm = this.get('booleanmode') ? [1, 2, 0][Number(this.val('booleanmode'))] : this.val('operation'); return booleanOp(parts[0], parts[1], bm); }
      case 'Extract Curve From Surface': { const m = this.inputs[0] ? meshOf(this.inputs[0]) : null; if (!m) return null; const f = m.polygons[0] ?? []; return C.makeCurve(f.map(i => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]] as V3), 1, true); }
    }
    return null;
  }
}
export function makeGeneratorOperator(preset: string, inputs: X3DObject[], owner: () => X3DObject | null) {
  const uv = (u = 8, v = 8) => [int('usub', u, 'Subdivisions U', { min: 1, max: 200 }), int('vsub', v, 'Subdivisions V', { min: 1, max: 200 })];
  const axis = enumP('axis', 1, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Axis');
  switch (preset) {
    case 'Extrusion Along Axis': return new GeneratorOperator(preset, inputs, owner, [axis, num('length', 5, 'Length', { min: -100, max: 100 }), int('subdivs', 1, 'Subdivisions', { min: 1, max: 100 }), int('usub', 16, 'Profile Subdivisions', { min: 2, max: 200 })]);
    case 'Revolution Around Axis': return new GeneratorOperator(preset, inputs, owner, [axis, num('angle', 360, 'Angle', { min: -360, max: 360 }), ...uv(16, 8)]);
    case 'Loft': case 'Extrusion Along Curve': case 'Birail': case 'Four-Sided': case 'Curve Net': return new GeneratorOperator(preset, inputs, owner, uv(12, 12));
    case 'Curves To Mesh': return new GeneratorOperator(preset, inputs, owner, [int('segments', 24, 'Segments', { min: 3, max: 400 })]);
    case 'Boolean': return new GeneratorOperator(preset, inputs, owner, [enumP('operation', 0, [{ label: 'Difference', value: 0 }, { label: 'Intersection', value: 1 }, { label: 'Union', value: 2 }], 'Operation')]);
    case 'Blend': case 'Merge Curves': case 'Merge Meshes': case 'Nurbs To Mesh': case 'Extract Curve From Surface': return new GeneratorOperator(preset, inputs, owner, []);
  }
  return null;
}

// ---------------------------------------------------------------- boolean (three-bvh-csg)
let csg: any = null;
export async function loadCSG() { if (!csg) csg = await import('three-bvh-csg'); return csg; }
export function booleanOp(a: MeshData, b: MeshData, op: number): MeshData | null {
  if (!csg) { loadCSG().then(() => { /* re-evaluated on next sync */ }); return a; }
  const toGeo = (m: MeshData) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.positions), 3)); g.setIndex(Array.from(m.indices)); g.computeVertexNormals(); return g; };
  const A = new csg.Brush(toGeo(a)), B = new csg.Brush(toGeo(b)); A.updateMatrixWorld(); B.updateMatrixWorld();
  const ev = new csg.Evaluator(); ev.attributes = ['position'];
  const res = ev.evaluate(A, B, [csg.SUBTRACTION, csg.INTERSECTION, csg.ADDITION][op]);
  const pos = res.geometry.getAttribute('position'); const verts: V3[] = []; const faces: number[][] = [];
  const key = new Map<string, number>();
  const idx = (i: number) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const k = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`; if (!key.has(k)) { key.set(k, verts.length); verts.push([x, y, z]); } return key.get(k)!; };
  const n = res.geometry.index ? res.geometry.index.count : pos.count; const ix = res.geometry.index;
  for (let i = 0; i + 2 < n; i += 3) { const t = [idx(ix ? ix.getX(i) : i), idx(ix ? ix.getX(i + 1) : i + 1), idx(ix ? ix.getX(i + 2) : i + 2)]; if (new Set(t).size === 3) faces.push(t); }
  const out = T2.mergeMeshes([]); void out;
  const { fromPolys } = require_topology(); return fromPolys(verts, faces);
}
import * as topoMod from './topology';
function require_topology() { return topoMod; }

// --------------------------------------------------------------- deformers (referencing objects)
export class RefDeformOperator extends Operator {
  constructor(readonly preset: string, readonly refs: X3DObject[], readonly owner: () => X3DObject | null, readonly sel: CompSel | null, defs: any[]) { super(preset, 'refdeform', [...defs, bool('mute', false, 'Mute')]); this.rest = refs[0] ? refs[0].globalMatrix().clone() : null; }
  rest: THREE.Matrix4 | null; restPts: V3[] | null = null; restCage: MeshData | null = null; cageWeights: Float32Array[] | null = null;
  depStamp() { return stampOf([...this.refs, this.owner()]); }
  apply(m: MeshData | null): MeshData | null {
    if (!m || this.val('mute')) return m; const me = this.owner(); const ref = this.refs[0]; if (!me || !ref) return m;
    const meG = me.globalMatrix(), refG = ref.globalMatrix();
    switch (this.preset) {
      case 'by Lattice': { const lat = ref.primitive?.lattice(); if (!lat) return m; const toLat = refG.clone().invert().multiply(meG); const fromLat = meG.clone().invert().multiply(refG); return T2.latticeDeform(m, lat, toLat.elements as any, fromLat.elements as any); }
      case 'by Curve': { const c = ref.primitive?.curve(); if (!c) return m; const M = meG.clone().invert().multiply(refG); const pts = C.sampleCurve(c, 96).map(p => { const q = new THREE.Vector3(...p).applyMatrix4(M); return [q.x, q.y, q.z] as V3; }); const v = (n: string, d: number) => { const p = this.get(n); return p ? Number(p.value) : d; }; return T2.curveDeformFull(m, pts, { axis: v('axis', 1), poscurve: v('poscurve', 0), posnormal: v('posnormal', 0), posbinormal: v('posbinormal', 0), sclcurve: v('sclcurve', 1), sclnormal: v('sclnormal', 1), sclbinormal: v('sclbinormal', 1), roll: v('roll', 0) }); }
      case 'by Spine': { const c = ref.primitive?.curve(); if (!c) return m; const M = meG.clone().invert().multiply(refG); const cur = C.sampleCurve(c, 64).map(p => { const q = new THREE.Vector3(...p).applyMatrix4(M); return [q.x, q.y, q.z] as V3; }); if (!this.restPts) this.restPts = cur; return T2.spineDeform(m, this.restPts, cur, Number(this.val('radius') ?? 4), Number(this.val('falloff') ?? 1)); }
      case 'by Cage': { const cage = ref.primitive?.mesh(); if (!cage) return m; const M = meG.clone().invert().multiply(refG); const cageNow = T2.mergeMeshes([{ mesh: cage, matrix: M.elements as any }]); if (!this.cageWeights || this.cageWeights.length !== m.positions.length / 3) { const restCage = this.restCage ?? cageNow; this.restCage = restCage; this.cageWeights = T2.cageWeights(m, restCage); } return T2.cageDeform(m, this.cageWeights, cageNow); }
      case 'Shrink Wrap': { const t = ref.primitive?.mesh(); if (!t) return m; return T2.shrinkWrap(m, t, refG.clone().invert().multiply(meG).elements as any, meG.clone().invert().multiply(refG).elements as any, this.val('amount')); }
      case 'Cluster Center': { const restC = new THREE.Vector3().setFromMatrixPosition(this.rest ?? refG).applyMatrix4(meG.clone().invert()); const nowC = new THREE.Vector3().setFromMatrixPosition(refG).applyMatrix4(meG.clone().invert()); return T2.clusterCenter(m, this.sel ?? { kind: 'point', indices: [] }, [nowC.x, nowC.y, nowC.z], [restC.x, restC.y, restC.z]); }
      case 'by Volume': { // points inside the control object's sphere follow its displacement from rest, with falloff
        const restC = new THREE.Vector3().setFromMatrixPosition(this.rest ?? refG), nowC = new THREE.Vector3().setFromMatrixPosition(refG); const d = nowC.clone().sub(restC).applyMatrix4(new THREE.Matrix4().extractRotation(meG.clone().invert()));
        const centre = restC.clone().applyMatrix4(meG.clone().invert()); const r = this.val('radius'); const out = { ...m, positions: new Float32Array(m.positions) };
        for (let i = 0; i < out.positions.length; i += 3) { const dist = Math.hypot(out.positions[i] - centre.x, out.positions[i + 1] - centre.y, out.positions[i + 2] - centre.z); if (dist > r) continue; const w = 1 - dist / r; out.positions[i] += d.x * w; out.positions[i + 1] += d.y * w; out.positions[i + 2] += d.z * w; }
        return out; }
    }
    return m;
  }
}
export function makeRefDeformOperator(preset: string, refs: X3DObject[], owner: () => X3DObject | null, sel: CompSel | null) {
  switch (preset) {
    case 'by Lattice': case 'Cluster Center': return new RefDeformOperator(preset, refs, owner, sel, []);
    case 'by Curve': { const si = siParamDefs('crvdeform'); return new RefDeformOperator(preset, refs, owner, sel, si.length ? si : [enumP('axis', 1, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Axis'), num('poscurve', 0, 'Position along Curve'), num('posnormal', 0, 'Position along Normal'), num('posbinormal', 0, 'Position along Binormal'), num('sclcurve', 1, 'Scale along Curve'), num('sclnormal', 1, 'Scale along Normal'), num('sclbinormal', 1, 'Scale along Binormal'), num('roll', 0, 'Roll')]); }
    case 'by Spine': return new RefDeformOperator(preset, refs, owner, sel, [num('radius', 4, 'Radius', { min: 0.01, max: 100 }), num('falloff', 1, 'Falloff', { min: 0.1, max: 8 })]);
    case 'by Cage': return new RefDeformOperator(preset, refs, owner, sel, []);
    case 'Shrink Wrap': return new RefDeformOperator(preset, refs, owner, sel, [num('amount', 1, 'Amount', { min: 0, max: 1 })]);
    case 'by Volume': return new RefDeformOperator(preset, refs, owner, sel, [num('radius', 6, 'Radius', { min: 0.01, max: 100 })]);
  }
  return null;
}
export class MeshDeformOperator2 extends Operator {
  constructor(readonly preset: string, defs: any[]) { super(preset + ' Op', 'deform2', [...defs, bool('mute', false, 'Mute')]); }
  apply(m: MeshData | null) {
    if (!m || this.val('mute')) return m; const v = (n: string) => Number(this.val(n));
    switch (this.preset) {
      case 'Bend': return T2.bendDeform(m, v('angle'), v('axis'), v('bendaxis'));
      case 'Fold': return T2.foldDeform(m, v('angle'), v('axis'), v('position'));
      case 'Wave': return T2.waveDeform(m, v('amplitude'), v('wavelength'), v('phase'), v('axis'));
      case 'Quick Stretch': return T2.quickStretch(m, [v('vx'), v('vy'), v('vz')], v('amount'));
      case 'Shape Jitter': return T2.waveDeform(m, v('amplitude') * 0.3, 0.7, v('phase') * 3.1, 0);
    }
    return m;
  }
}
export function makeMeshDeformOperator2(preset: string) {
  const axis = enumP('axis', 1, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Axis');
  switch (preset) {
    case 'Bend': return new MeshDeformOperator2(preset, [num('angle', 45, 'Angle', { min: -360, max: 360 }), axis, enumP('bendaxis', 0, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Bend Around')]);
    case 'Fold': return new MeshDeformOperator2(preset, [num('angle', 60, 'Angle', { min: -180, max: 180 }), axis, num('position', 0, 'Fold Position', { min: -50, max: 50 })]);
    case 'Wave': return new MeshDeformOperator2(preset, [num('amplitude', 1, 'Amplitude', { min: -20, max: 20, keyable: true }), num('wavelength', 4, 'Wavelength', { min: 0.1, max: 100 }), num('phase', 0, 'Phase', { min: -50, max: 50, keyable: true }), axis]);
    case 'Quick Stretch': return new MeshDeformOperator2(preset, [num('vx', 0, 'Velocity X'), num('vy', 1, 'Velocity Y'), num('vz', 0, 'Velocity Z'), num('amount', 0.5, 'Amount', { min: 0, max: 5 })]);
    case 'Shape Jitter': return new MeshDeformOperator2(preset, [num('amplitude', 1, 'Amplitude', { min: 0, max: 20 }), num('phase', 0, 'Phase', { min: -50, max: 50, keyable: true })]);
  }
  return null;
}
/** Crease / hard-edge marks live in the construction history and feed subdivision. */
export class CreaseOperator extends Operator {
  constructor(readonly edges: string[], value: number) { super('Edge Crease', 'crease', [num('crease', value, 'Crease Value', { min: 0, max: 10 })]); }
  apply(m: MeshData | null) { if (!m) return m; const cr = new Map((m as any).creases ?? []); for (const e of this.edges) cr.set(e, Number(this.val('crease'))); return { ...m, creases: cr } as MeshData; }
}

// ------------------------------------------------------------------ lattice
export class LatticeGeomOperator extends Operator {
  points: V3[] | null = null;  // user-edited lattice points (null = regular)
  constructor() { super('Lattice', 'latticegeom', [int('subdivx', 2, 'Subdivisions X', { min: 1, max: 32 }), int('subdivy', 2, 'Subdivisions Y', { min: 1, max: 32 }), int('subdivz', 2, 'Subdivisions Z', { min: 1, max: 32 }), num('sizex', 8, 'Size X', { min: 0.01 }), num('sizey', 8, 'Size Y', { min: 0.01 }), num('sizez', 8, 'Size Z', { min: 0.01 })]); }
  apply(): LatticeData {
    const s: [number, number, number] = [this.val('subdivx'), this.val('subdivy'), this.val('subdivz')]; const h = [this.val('sizex') / 2, this.val('sizey') / 2, this.val('sizez') / 2];
    const lat = T2.makeLattice(s, [-h[0], -h[1], -h[2]], [h[0], h[1], h[2]]);
    if (this.points && this.points.length === lat.points.length) lat.points = this.points.map(p => [...p] as V3);
    return lat;
  }
}
export function makeLatticeObject(name: string): X3DObject {
  const o = new X3DObject(name, 'lattice'); const p = new Primitive('Lattice', 'lattice'); p.addOperator(new LatticeGeomOperator()); o.setPrimitive(p); o.addProperty(makeDisplay()); return o;
}

// ---------------------------------------------------------------- implicit
export function makeImplicit(name: string, shape: string): X3DObject {
  const o = new X3DObject(name, 'implicit'); const p = new Primitive(shape, 'implicit'); p.add(str('shape', shape, 'Shape', { readOnly: true })); p.add(num('size', 4, 'Size', { min: 0.01 })); o.setPrimitive(p); o.addProperty(makeDisplay()); return o;
}

// ------------------------------------------------------------------- text
let fontPromise: Promise<any> | null = null;
export function loadFont() {
  if (!fontPromise) fontPromise = Promise.all([import('three/examples/jsm/loaders/FontLoader.js'), import('three/examples/fonts/helvetiker_regular.typeface.json')]).then(([m, data]) => new m.FontLoader().parse((data as any).default ?? data));
  return fontPromise;
}
export class TextGeomOperator extends Operator {
  font: any = null;
  constructor(readonly mode: 'curves' | 'planar' | 'solid', text: string) { super('Text', 'textgeom', [str('text', text, 'Text'), num('size', 5, 'Size', { min: 0.1 }), enumP('align', 0, [{ label: 'Left', value: 0 }, { label: 'Center', value: 1 }, { label: 'Right', value: 2 }], 'Alignment'), num('spacing', 0, 'Character Spacing'), num('linespacing', 1.2, 'Line Spacing', { min: 0.5, max: 4 }), num('depth', 1, 'Extrusion Depth', { min: 0.01 }), bool('bevel', false, 'Bevel'), num('bevelsize', 0.2, 'Bevel Size', { min: 0.01 }), int('bevelsegments', 2, 'Bevel Segments', { min: 1, max: 8 }), int('segments', 4, 'Curve Segments', { min: 1, max: 12 })]); loadFont().then(f => { this.font = f; this.parent && ((this.parent as any).dirty = true); }); }
  apply(): any {
    if (!this.font) return null;
    const size = Number(this.val('size')); const align = Number(this.val('align') ?? 0), spacing = Number(this.val('spacing') ?? 0), lsp = Number(this.val('linespacing') ?? 1.2);
    // per line / per character so alignment and spacing work (three's generateShapes has neither)
    const lines = String(this.val('text')).split(/\r?\n/); const shapes: THREE.Shape[] = [];
    lines.forEach((ln, li) => { const glyphs: { s: THREE.Shape[]; w: number }[] = []; let total = 0; for (const ch of ln) { const sh: THREE.Shape[] = this.font.generateShapes(ch, size); const w = ch === ' ' ? size * 0.3 : (() => { let mx = 0; for (const q of sh) for (const pt of q.getPoints(2)) mx = Math.max(mx, pt.x); return mx; })(); glyphs.push({ s: sh, w }); total += w + spacing; }
      let x = align === 1 ? -total / 2 : align === 2 ? -total : 0; const y = -li * size * lsp; for (const g of glyphs) { for (const q of g.s) { const m = new THREE.Matrix3().set(1, 0, x, 0, 1, y, 0, 0, 1); const sh2 = new THREE.Shape(q.getPoints(this.val('segments')).map(pt => pt.clone().applyMatrix3(m))); sh2.holes = q.holes.map(h => new THREE.Path(h.getPoints(this.val('segments')).map(pt => pt.clone().applyMatrix3(m)))); shapes.push(sh2); } x += g.w + spacing; } });
    if (this.mode === 'curves') { const pts = shapes[0]?.getPoints(this.val('segments')) ?? []; return C.makeCurve(pts.map(p => [p.x, p.y, 0] as V3), 1, true); }
    const geo = this.mode === 'planar' ? new THREE.ShapeGeometry(shapes, this.val('segments')) : new THREE.ExtrudeGeometry(shapes, { depth: Number(this.val('depth')), bevelEnabled: !!this.val('bevel'), bevelThickness: Number(this.val('bevelsize') ?? 0.2), bevelSize: Number(this.val('bevelsize') ?? 0.2), bevelSegments: Number(this.val('bevelsegments') ?? 2), curveSegments: this.val('segments') });
    const pos = geo.getAttribute('position'); const ix = geo.index; const verts: V3[] = []; const key = new Map<string, number>();
    const id = (i: number) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`; if (!key.has(k)) { key.set(k, verts.length); verts.push([x, y, z]); } return key.get(k)!; };
    const faces: number[][] = []; const n = ix ? ix.count : pos.count; for (let i = 0; i + 2 < n; i += 3) { const t = [id(ix ? ix.getX(i) : i), id(ix ? ix.getX(i + 1) : i + 1), id(ix ? ix.getX(i + 2) : i + 2)]; if (new Set(t).size === 3) faces.push(t); }
    return topoMod.fromPolys(verts, faces);
  }
}

// ---------------------------------------------------------------- chains / IK
export class ChainRoot extends X3DObject {
  bones: Bone[] = []; effector: Effector | null = null;
  constructor(name: string) { super(name, 'root'); this.addProperty(makeDisplay()); this.add(bool('ik', true, 'IK Enabled')); this.add(int('iterations', 12, 'IK Iterations', { min: 1, max: 100 })); }
  /** CCD inverse kinematics: rotate bones so the chain end reaches the effector (in root space). */
  solveIK() {
    if (!this.val('ik') || !this.effector || !this.bones.length) return;
    const rootInv = this.globalMatrix().invert(); const target = new THREE.Vector3().setFromMatrixPosition(this.effector.globalMatrix()).applyMatrix4(rootInv);
    for (let it = 0; it < this.val('iterations'); it++) for (let b = this.bones.length - 1; b >= 0; b--) {
      const bone = this.bones[b]; const end = this.chainEnd().applyMatrix4(rootInv); const boneG = bone.globalMatrix(); const pivot = new THREE.Vector3().setFromMatrixPosition(boneG).applyMatrix4(rootInv);
      const v1 = end.clone().sub(pivot), v2 = target.clone().sub(pivot); if (v1.length() < 1e-6 || v2.length() < 1e-6) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(v1.normalize(), v2.normalize());
      // apply in the bone's parent space
      const parentG = bone.parentObj ? bone.parentObj.globalMatrix() : new THREE.Matrix4(); const toRoot = rootInv.clone().multiply(parentG); const rotParent = new THREE.Quaternion().setFromRotationMatrix(toRoot).invert();
      const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.kinematics.local.val('rotx') * Math.PI / 180, bone.kinematics.local.val('roty') * Math.PI / 180, bone.kinematics.local.val('rotz') * Math.PI / 180, threeOrder(bone.kinematics.local.val('rotorder'))));
      const nq = rotParent.clone().multiply(q).multiply(rotParent.clone().invert()).multiply(local);
      const e = new THREE.Euler().setFromQuaternion(nq, threeOrder(bone.kinematics.local.val('rotorder'))); const l = bone.kinematics.local; (l.get('rotx') as any)._value = e.x * 180 / Math.PI; (l.get('roty') as any)._value = e.y * 180 / Math.PI; (l.get('rotz') as any)._value = e.z * 180 / Math.PI;
    }
  }
  chainEnd(): THREE.Vector3 { const last = this.bones[this.bones.length - 1]; return new THREE.Vector3(last.val('length'), 0, 0).applyMatrix4(last.globalMatrix()); }
}
export class Bone extends X3DObject { constructor(name: string, length: number) { super(name, 'bone'); this.add(num('length', length, 'Length', { min: 0.01 })); this.add(num('prefrotx', 0, 'Preferred Rot X')); this.add(num('prefroty', 0, 'Preferred Rot Y')); this.add(num('prefrotz', 0, 'Preferred Rot Z')); this.addProperty(makeDisplay()); } }
export class Effector extends X3DObject { constructor(name: string) { super(name, 'eff'); this.addProperty(makeDisplay()); } }
/** Build a chain through the given root-space points: root at pts[0], a bone per segment, effector at the end. */
export function makeChain(name: string, pts: V3[], planar: boolean): ChainRoot {
  const root = new ChainRoot(name); root.kinematics.local.set('posx', pts[0][0]); root.kinematics.local.set('posy', pts[0][1]); root.kinematics.local.set('posz', pts[0][2]);
  let parent: X3DObject = root; let prevG = root.globalMatrix();
  for (let i = 1; i < pts.length; i++) {
    const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]); const len = a.distanceTo(b);
    const bone = new Bone(`${name === 'root' ? '' : name + '_'}bone${i}`, len);
    // orient bone X toward b, in parent's space
    const dir = b.clone().sub(a).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    const parentRot = new THREE.Quaternion().setFromRotationMatrix(prevG); const local = parentRot.clone().invert().multiply(q); const e = new THREE.Euler().setFromQuaternion(local, threeOrder(bone.kinematics.local.val('rotorder')));
    const l = bone.kinematics.local; l.set('rotx', e.x * 180 / Math.PI); l.set('roty', e.y * 180 / Math.PI); l.set('rotz', e.z * 180 / Math.PI);
    if (i > 1) l.set('posx', (parent as Bone).val('length'));
    parent.addChild(bone); root.bones.push(bone); parent = bone; prevG = bone.globalMatrix();
    void planar;
  }
  const eff = new Effector('eff'); eff.kinematics.local.set('posx', (parent as Bone).val('length')); parent.addChild(eff); root.effector = eff;
  // Softimage parents the effector to the root; keep it under the last bone for simplicity but expose it on the root
  return root;
}

// ------------------------------------------------------------ cameras/lights presets
export const CAMERA_PRESETS: Record<string, number> = { Perspective: 53.6, Telephoto: 20, 'Wide Angle': 90, Orthographic: 0 };
export const LIGHT_PRESETS: Record<string, 'point' | 'infinite' | 'spot' | 'area'> = { Point: 'point', Infinite: 'infinite', Spot: 'spot', 'Light Box': 'area', Neon: 'area', Flat: 'area' };
export { Node, makeGeomApprox };
