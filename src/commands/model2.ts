// The remaining Model-menu commands: NURBS surface operators (Create/Modify > Surf. Mesh), curve fillet, spine/tail/
// control-spline rigging, referenced models and deltas, user normals, paint tools, GATOR, light rig from image,
// stand-in / geometry-shader primitives, the ICE Particle Volume shader and the Footprints ICE deformer.
import * as THREE from 'three';
import { App, InteractiveTool } from '../core/commands';
import { X3DObject, Model, Null, Primitive, Operator, Property, Light, MoveComponentOperator, makeDisplay, makeGeomApprox, makePhong } from '../core/scene';
import { num, int, bool, str, enumP, color } from '../core/params';
import { ChainRoot, makeChain, makeImplicit, CurveGeomOperator } from '../core/scene2';
import { MeshData } from '../core/geometry';
import { fromPolys } from '../core/topology';
import { makeCurve, evalCurve, curveDomain, tessellateCurve, filletCurves, CurveData, V3 } from '../core/curves';
import * as N from '../core/nurbs';
import { buildPresetModel, PRESET_MODELS, fetchMaybeGzip } from './presets';
import { mapCluster } from './clusters';
import { EnvelopeOperator } from '../core/envelope';
import { ICETreeOperator, ICE_PRESETS, buildPreset } from '../core/ice';
import { Cluster } from '../core/scene';
import { isCfbOle, parseEmdlBytes, softimageEmdlToOm } from '../core/emdlBinary';
/** GATOR attribute transfer: each target point takes the value of the nearest source point (world space). */
function transferValues<T>(src: X3DObject, dst: X3DObject, values: Map<number, T>): Map<number, T> { const sm = src.primitive?.mesh(), dm = dst.primitive?.mesh(); const out = new Map<number, T>(); if (!sm || !dm) return out; const S = src.globalMatrix(), D = dst.globalMatrix(); const sp: number[][] = []; for (let i = 0; i < sm.positions.length; i += 3) { const v = new THREE.Vector3(sm.positions[i], sm.positions[i + 1], sm.positions[i + 2]).applyMatrix4(S); sp.push([v.x, v.y, v.z]); } for (let j = 0; j < dm.positions.length / 3; j++) { const v = new THREE.Vector3(dm.positions[j * 3], dm.positions[j * 3 + 1], dm.positions[j * 3 + 2]).applyMatrix4(D); let best = -1, bd = Infinity; for (let i = 0; i < sp.length; i++) { const d = (sp[i][0] - v.x) ** 2 + (sp[i][1] - v.y) ** 2 + (sp[i][2] - v.z) ** 2; if (d < bd) { bd = d; best = i; } } const val = best >= 0 ? values.get(best) : undefined; if (val !== undefined) out.set(j, val); } return out; }

const addObject = (app: App, obj: X3DObject, parent?: X3DObject | null) => { const p = parent ?? app.scene.root; app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj)); return obj; };
const addOp = (app: App, obj: X3DObject, op: Operator) => { const prim = obj.primitive!; app.record(op.name, () => prim.addOperator(op), () => prim.removeOperator(op)); app.select([obj]); return op; };
function newObj(app: App, name: string, primType: 'polymsh' | 'surfmsh' | 'crvlist', gen: Operator) { const obj = new X3DObject(app.scene.uniqueName(name), primType); const prim = new Primitive(primType === 'polymsh' ? 'Polygon Mesh' : primType === 'surfmsh' ? 'NURBS Surface Mesh' : 'NURBS Curve List', primType); prim.addOperator(gen); obj.setPrimitive(prim); obj.addProperty(makeDisplay()); if (primType !== 'crvlist') obj.addProperty(makeGeomApprox()); return obj; }
class Frozen extends Operator { constructor(readonly data: any, label = 'Frozen Geometry') { super(label, 'geom', []); } apply() { return this.data; } }
const surfaces = (app: App, set: any) => app.targets(set).filter(o => o.primitive?.type === 'surfmsh' && o.primitive.mesh());
const BOUNDARIES = [{ label: 'U Min', value: 'umin' }, { label: 'U Max', value: 'umax' }, { label: 'V Min', value: 'vmin' }, { label: 'V Max', value: 'vmax' }];

// ---------------------------------------------------------------- NURBS operators
class NurbsOp extends Operator {
  constructor(name: string, type: string, defs: any[], readonly fn: (s: N.NurbsSurface, op: NurbsOp, input: N.NMesh) => N.NurbsSurface | N.NMesh | null) { super(name, type, [...defs, bool('mute', false, 'Mute')]); }
  apply(input: N.NMesh | null) {
    if (!input || this.val('mute')) return input; const s = N.surfOf(input); if (!s) return input;
    const r = this.fn(s, this, input); if (!r) return input; if ((r as any).positions) return r as N.NMesh;
    const out = N.tessellateNurbs(r as N.NurbsSurface); out.trims = input.trims; return N.applyTrims(out);
  }
}
const wrap = (app: App, name: string, patch: (def: any) => void) => { const d = app.commands.get(name); if (!d) return; patch(d); };

export function registerModelCommands2(app: App) {
  // ---- ApplyTopoOp: Surf. Mesh presets + Make Bezier-Knots Corners
  wrap(app, 'ApplyTopoOp', (def) => {
    const prevCan = def.canRun, prevExec = def.execute, prevSup = def.supported;
    const mine = ['SrfOpenClose', 'Snip', 'CrvExtendTo', 'SrfStitch', 'TrimByProjection', 'DeleteTrim', 'Make Bezier-Knots Corners', 'SrfInverse', 'Invert Normals', 'InsertNurbsSrfKnot', 'SrfInsertKnot', 'InsertSrfKnot', 'Insert Surface Knot', 'RemoveNurbsSrfKnot', 'RemoveSrfKnot', 'Remove Surface Knot', 'SrfSwap', 'Surface Swap', 'SrfShift', 'Surface Shift', 'SrfClean', 'Surface Clean', 'SrfReparam', 'Surface Reparameterize'];
    const key = (a: any) => mine.includes(a.PresetObj) ? a.PresetObj : mine.includes(a.Preset) ? a.Preset : null;
    def.supported = (a: any) => !!key(a) || (prevSup ? prevSup(a) : false);
    def.canRun = (a: any) => {
      const k = key(a);
      if (k === 'Make Bezier-Knots Corners' || k === 'CrvExtendTo') return app.selectedObjects.some(x => x.primitive?.type === 'crvlist' || !!x.primitive?.curve());
      if (k) return app.selectedObjects.some(x => x.primitive?.type === 'surfmsh');
      return prevCan ? prevCan(a) : true;
    };
    def.execute = (app: App, a: any) => {
      const k = key(a); if (!k) return prevExec(app, a);
      const sel = app.selectedObjects.length ? app.selectedObjects : app.selection.map(ownerOf).filter((x): x is X3DObject => !!x);
      if (k === 'Make Bezier-Knots Corners') {
        const o = sel.find(x => x.primitive?.type === 'crvlist'); if (!o) throw new Error('Select a curve (and its points) first');
        const cs = app.componentSel(); const pts = cs?.obj === o && cs.sel.kind === 'point' ? cs.sel.indices.slice() : null;
        const op = new (class extends Operator { constructor() { super('Make Bezier-Knots Corners', 'crvcorners', [bool('mute', false, 'Mute')]); } apply(c: CurveData | null) { if (!c || this.val('mute')) return c; const idx = new Set(pts ?? c.cvs.map((_, i) => i)); const cvs: any[] = []; c.cvs.forEach((cv, i) => { cvs.push(cv); if (idx.has(i)) for (let r = 1; r < c.degree; r++) cvs.push([...cv]); }); return makeCurve(cvs.map(v => [v[0], v[1], v[2]] as V3), c.degree, c.closed); } })();
        return addOp(app, o, op);
      }
      const o = sel.find(x => x.primitive?.type === 'surfmsh'); if (!o) throw new Error(`${k}: select a NURBS surface mesh first`);
      switch (k) {
        case 'SrfSwap': case 'Surface Swap': return addOp(app, o, new NurbsOp('Swap UV', 'swapsrfuv', [bool('swap', true, 'Swap U and V')], (s, op) => op.val('swap') ? N.inverseSurf(s, false, false, true) : s));
        case 'SrfShift': case 'Surface Shift': return addOp(app, o, new NurbsOp('Shift', 'srfshift', [int('shiftu', 1, 'Shift U', { min: -64, max: 64 }), int('shiftv', 0, 'Shift V', { min: -64, max: 64 })], (s, op) => { const su = s.closedU ? Number(op.val('shiftu')) : 0, sv = s.closedV ? Number(op.val('shiftv')) : 0; if (!su && !sv) return s; const o2 = N.cloneSurf(s); for (let j = 0; j < s.nv; j++) for (let i = 0; i < s.nu; i++) o2.cps[j * s.nu + i] = s.cps[(((j + sv) % s.nv + s.nv) % s.nv) * s.nu + (((i + su) % s.nu + s.nu) % s.nu)]; return o2; }));
        case 'SrfClean': case 'Surface Clean': return addOp(app, o, new NurbsOp('Clean', 'cleansrf', [bool('cleanu', true, 'Clean U'), bool('cleanv', true, 'Clean V'), num('cleantolu', 0.05, 'Tolerance U', { min: 0 }), num('cleantolv', 0.05, 'Tolerance V', { min: 0 })], (s, op) => { let cur = s; const tol = (u: boolean) => Number(op.val(u ? 'cleantolu' : 'cleantolv')); for (const u of [true, false]) { if (!op.val(u ? 'cleanu' : 'cleanv')) continue; const n = u ? cur.nu : cur.nv; if (n <= (u ? cur.degU : cur.degV) + 1) continue; const keep: number[] = [0]; for (let k = 1; k < n; k++) { let far = false; for (let L = 0; L < (u ? cur.nv : cur.nu); L++) { const a = u ? cur.cps[L * cur.nu + k] : cur.cps[k * cur.nu + L], b = u ? cur.cps[L * cur.nu + keep[keep.length - 1]] : cur.cps[keep[keep.length - 1] * cur.nu + L]; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > tol(u)) { far = true; break; } } if (far || k === n - 1) keep.push(k); } if (keep.length === n) continue; const cps: any[] = []; for (let j = 0; j < (u ? cur.nv : keep.length); j++) for (let i = 0; i < (u ? keep.length : cur.nu); i++) cps.push(u ? cur.cps[j * cur.nu + keep[i]] : cur.cps[keep[j] * cur.nu + i]); cur = { ...N.uniformize(cur), nu: u ? keep.length : cur.nu, nv: u ? cur.nv : keep.length, cps }; } return cur; }));
        case 'SrfReparam': case 'Surface Reparameterize': return addOp(app, o, new NurbsOp('Reparameterize', 'srfreparam', [enumP('reparamu', 1, [{ label: 'None', value: 0 }, { label: 'Uniform', value: 1 }], 'Reparameterize U'), enumP('reparamv', 1, [{ label: 'None', value: 0 }, { label: 'Uniform', value: 1 }], 'Reparameterize V')], (s, op) => { const o2 = N.cloneSurf(s); if (op.val('reparamu')) delete o2.knotsU; if (op.val('reparamv')) delete o2.knotsV; return o2; }));
        case 'Invert Normals': return addOp(app, o, new NurbsOp('Invert Normals', 'invsrf', [bool('inv', true, 'Invert')], (s, op) => op.val('inv') ? N.inverseSurf(s, true, false, false) : s));
        case 'SrfInverse': return addOp(app, o, new NurbsOp('Inverse', 'srfinverse', [bool('flipu', true, 'Invert U'), bool('flipv', false, 'Invert V'), bool('swap', false, 'Swap U and V')], (s, op) => N.inverseSurf(s, !!op.val('flipu'), !!op.val('flipv'), !!op.val('swap'))));
        case 'InsertNurbsSrfKnot': case 'SrfInsertKnot': case 'InsertSrfKnot': case 'Insert Surface Knot': return addOp(app, o, new NurbsOp('Insert Knot', 'srfinsertknot', [enumP('direction', 0, [{ label: 'U', value: 0 }, { label: 'V', value: 1 }], 'Direction'), num('position', 0.5, 'Position', { min: 0, max: 1 })], (s, op) => N.insertKnotSurf(s, Number(op.val('position')), op.val('direction') === 0)));
        case 'RemoveNurbsSrfKnot': case 'RemoveSrfKnot': case 'Remove Surface Knot': return addOp(app, o, new NurbsOp('Remove Knot', 'srfremoveknot', [enumP('direction', 0, [{ label: 'U', value: 0 }, { label: 'V', value: 1 }], 'Direction'), num('position', 0.5, 'Position', { min: 0, max: 1 })], (s, op) => { const u = op.val('direction') === 0; const n = u ? s.nu : s.nv; if (n <= (u ? s.degU : s.degV) + 1) return s; const k = Math.max(1, Math.min(n - 2, Math.round(Number(op.val('position')) * (n - 1)))); const o2 = N.uniformize(s); const cps: any[] = []; for (let j = 0; j < s.nv; j++) for (let i = 0; i < s.nu; i++) if (!(u ? i === k : j === k)) cps.push(s.cps[j * s.nu + i]); return { ...o2, nu: u ? s.nu - 1 : s.nu, nv: u ? s.nv : s.nv - 1, cps }; }));
        case 'SrfOpenClose': return addOp(app, o, new NurbsOp('Open/Close', 'srfopenclose', [bool('closeu', !!N.surfOf(o.primitive!.mesh())?.closedU, 'Close in U'), bool('closev', !!N.surfOf(o.primitive!.mesh())?.closedV, 'Close in V')], (s, op) => N.openClose(s, !!op.val('closeu'), !!op.val('closev'))));
        case 'Snip': {
          const op = new NurbsOp('Snip', 'srfsnip', [enumP('direction', 0, [{ label: 'U', value: 0 }, { label: 'V', value: 1 }], 'Direction'), num('position', 0.5, 'Position', { min: 0, max: 1 })], (s, op) => N.snip(s, op.val('direction') === 0, Number(op.val('position')))[0]);
          addOp(app, o, op); const rest = N.snip(N.surfOf(o.primitive!.mesh())!, true, 0.5)[1];
          if (rest) { const o2 = newObj(app, o.name + '_snip', 'surfmsh', new Frozen(N.tessellateNurbs(rest))); for (const p of o.kinematics.local.params) o2.kinematics.local.get(p.name)!.value = p.value; addObject(app, o2); }
          app.select([op]); return op;
        }
        case 'CrvExtendTo': { const c = sel.find(x => x.primitive?.type === 'crvlist'); if (!c) throw new Error('Extend to Curve: select the surface and a curve'); const curve = c.primitive!.curve()!; const s0 = N.surfOf(o.primitive!.mesh())!; const bnd = N.nearestBoundary(s0, p => evalCurve(curve, curveDomain(curve)[0])); return addOp(app, o, new NurbsOp('Extend to Curve', 'srfextendtocurve', [enumP('boundary', bnd, BOUNDARIES, 'Boundary')], (s, op) => N.extendToCurve(s, op.val('boundary'), c.primitive!.curve()!))); }
        case 'SrfStitch': { const b = sel.find(x => x !== o && x.primitive?.type === 'surfmsh'); if (!b) throw new Error('Stitch: select two NURBS surfaces'); const sb = N.surfOf(b.primitive!.mesh())!; const bnd = N.nearestBoundary(N.surfOf(o.primitive!.mesh())!, p => N.closestPointOnSurf(sb, p).p); return addOp(app, o, new NurbsOp('Stitch', 'srfstitch', [enumP('boundary', bnd, BOUNDARIES, 'Boundary'), num('blend', 1, 'Blend', { min: 0, max: 1 })], (s, op) => N.snapBoundary(s, op.val('boundary'), N.surfOf(b.primitive!.mesh())!, Number(op.val('blend'))))); }
        case 'TrimByProjection': { const c = sel.find(x => x.primitive?.type === 'crvlist'); if (!c) throw new Error('Trim by Projection: select the surface and a projection curve'); return addOp(app, o, new NurbsOp('Trim by Projection', 'srftrim', [enumP('axis', 1, [{ label: 'X', value: 0 }, { label: 'Y', value: 1 }, { label: 'Z', value: 2 }], 'Projection Axis'), bool('keepinside', false, 'Keep Inside')], (_s, op, input) => { const pts = tessellateCurve(c.primitive!.curve()!, 6); const ax = Number(op.val('axis')); const poly = pts.map(p => (ax === 0 ? [p[1], p[2]] : ax === 1 ? [p[0], p[2]] : [p[0], p[1]]) as [number, number]); const out = { ...input, trims: [...(input.trims ?? []), { axis: ax, poly, keepInside: !!op.val('keepinside') }] } as N.NMesh; return N.applyTrims(out); })); }
        case 'DeleteTrim': { const prim = o.primitive!; const t = [...prim.operators].reverse().find(x => x.type === 'srftrim'); if (!t) throw new Error('No trim on ' + o.name); app.record('Delete Trim', () => prim.removeOperator(t), () => prim.addOperator(t)); app.select([o]); return null; }
      }
      return prevExec(app, a);
    };
  });
  // ---- ApplyOp: Continuity Manager (SCMFixer2) on surfaces
  wrap(app, 'ApplyOp', (def) => {
    const prevCan = def.canRun, prevExec = def.execute;
    def.canRun = (a: any) => a.PresetObj === 'SCMFixer2' || a.Preset === 'SCMFixer2' || prevCan(a);
    def.execute = (app: App, a: any) => {
      if (a.PresetObj !== 'SCMFixer2' && a.Preset !== 'SCMFixer2') return prevExec(app, a);
      const ops: Operator[] = [];
      for (const o of surfaces(app, a.ConnectionSet)) ops.push(addOp(app, o, new NurbsOp('Continuity Manager', 'scmfixer', [enumP('continuity', 1, [{ label: 'G0 (Position)', value: 0 }, { label: 'G1 (Tangent)', value: 1 }, { label: 'G2 (Curvature)', value: 2 }], 'Continuity'), num('tolerance', 0.1, 'Tolerance', { min: 0 })], (s, op) => {
        // G1 across each open boundary: align the second row with the boundary row's tangent direction
        const c = Number(op.val('continuity')); if (c < 1) return s; const o2 = N.cloneSurf(s);
        for (const b of ['umin', 'umax', 'vmin', 'vmax'] as N.Boundary[]) { const idx = N.boundaryIndices(s, b); for (const [i, j] of idx) { const di = b === 'umin' ? 1 : b === 'umax' ? -1 : 0, dj = b === 'vmin' ? 1 : b === 'vmax' ? -1 : 0; const p0 = N.cpAt(s, i, j), p1 = N.cpAt(s, i + di, j + dj), p2 = N.cpAt(s, i + 2 * di, j + 2 * dj); const t = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]; const k = 0.5 * Number(op.val('tolerance')); o2.cps[(j + dj) * s.nu + (i + di)] = [p1[0] * (1 - k) + (p0[0] + t[0] / 2) * k, p1[1] * (1 - k) + (p0[1] + t[1] / 2) * k, p1[2] * (1 - k) + (p0[2] + t[2] / 2) * k]; } }
        return o2;
      })));
      if (!ops.length) throw new Error('Continuity Manager: select a NURBS surface mesh'); return ops;
    };
  });
  // ---- Snap Boundary (Softimage ApplySnapFaceOp args×4 — stub-tools dump ACTIVE)
  app.register({
    name: 'ApplySnapFaceOp', label: 'Snap Boundary', category: 'Modeling',
    args: [
      { name: 'ConnectionSet', default: '' },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
      { name: 'ImmediateMode', default: ':siPersistentOperation:siOperationMode' },
      { name: 'OutputObjs', default: null },
    ],
    execute(app, a) {
      const fromSet = a.ConnectionSet ? app.targets(a.ConnectionSet) : [];
      const s = (fromSet.length ? fromSet : app.selectedObjects).filter(o => o.primitive?.type === 'surfmsh');
      if (s.length < 2) throw new Error('Snap Boundary: select the surface to snap, then the target surface');
      const [o, target] = s;
      const st = N.surfOf(target.primitive!.mesh())!;
      const bnd = N.nearestBoundary(N.surfOf(o.primitive!.mesh())!, p => N.closestPointOnSurf(st, p).p);
      return addOp(app, o, new NurbsOp('Snap Boundary', 'srfsnapboundary', [enumP('boundary', bnd, BOUNDARIES, 'Boundary')], (sf, op) => N.snapBoundary(sf, op.val('boundary'), N.surfOf(target.primitive!.mesh())!, 1)));
    },
  });
  // ---- ApplyGenOp: Surface Fit, Surface Fillet, Curve Fillet, GATOR
  wrap(app, 'ApplyGenOp', (def) => {
    const prevCan = def.canRun, prevExec = def.execute; const mine = ['SrfFit', 'SrfFillet', 'CrvFillet', 'Gator'];
    const key = (a: any) => mine.includes(a.PresetObj) ? a.PresetObj : mine.includes(a.Preset) ? a.Preset : null;
    def.canRun = (a: any) => !!key(a) || prevCan(a);
    def.execute = (app: App, a: any) => {
      const k = key(a); if (!k) return prevExec(app, a);
      const inputs = app.targets(a.ConnectionSet).filter(o => o.primitive && (o.primitive.mesh() || o.primitive.curve()));
      if (k === 'SrfFit') { const src = inputs[0]; if (!src?.primitive?.mesh()) throw new Error('Fit: select a surface or polygon mesh'); const gen = new (class extends Operator { constructor() { super('Fit', 'srffit', [int('subdivu', 8, 'Subdivisions U', { min: 2, max: 64 }), int('subdivv', 8, 'Subdivisions V', { min: 2, max: 64 })]); } apply() { return N.tessellateNurbs(N.fitSurface(src.primitive!.mesh() as N.NMesh, Number(this.val('subdivu')) + 1, Number(this.val('subdivv')) + 1)); } })(); const obj = newObj(app, src.name + '_fit', 'surfmsh', gen); for (const p of src.kinematics.local.params) obj.kinematics.local.get(p.name)!.value = p.value; addObject(app, obj); app.select([gen]); return obj; }
      if (k === 'SrfFillet') { const s = inputs.filter(o => o.primitive!.type === 'surfmsh'); if (s.length < 2) throw new Error('Fillet Intersection: select two NURBS surfaces'); const [A, B] = s; const gen = new (class extends Operator { constructor() { super('Fillet Intersection', 'srffillet', [num('radius', 1, 'Radius', { min: 0.01 }), int('sections', 12, 'Sections', { min: 2, max: 64 })]); } apply() { const f = N.filletSurfaces(N.surfOf(A.primitive!.mesh())!, N.surfOf(B.primitive!.mesh())!, Number(this.val('radius')), Number(this.val('sections'))); return f ? N.tessellateNurbs(f) : null; } })(); const obj = newObj(app, 'fillet', 'surfmsh', gen); addObject(app, obj); app.select([gen]); if (!obj.primitive!.mesh()) app.logMsg('info', 'Fillet Intersection: the surfaces do not come within the fillet radius of each other'); return obj; }
      if (k === 'CrvFillet') { const c = inputs.filter(o => o.primitive!.curve()); if (c.length < 2) throw new Error('Fillet Intersection: select two curves'); const [A, B] = c; const gen = new (class extends Operator { constructor() { super('Curve Fillet', 'crvfillet', [num('radius', 0.5, 'Radius', { min: 0 }), int('subdiv', 8, 'Subdivisions', { min: 2, max: 32 })]); } apply() {
        // Softimage filletcrv (rad default 0.5): fillet in world space so object transforms are honoured
        const worldCurve = (o: X3DObject): CurveData => {
          const src = o.primitive!.curve()!; const M = o.globalMatrix();
          return { ...src, cvs: src.cvs.map(q => { const v = new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(M); return [v.x, v.y, v.z, q[3] || 1] as [number, number, number, number]; }) };
        };
        return filletCurves(worldCurve(A), worldCurve(B), Number(this.val('radius')), Number(this.val('subdiv')));
      } })(); const obj = newObj(app, 'fillet', 'crvlist', gen); addObject(app, obj); app.select([gen]); return obj; }
      // GATOR: transfer material / texture projection / weight maps from the other selected objects to the first
      const [target, ...sources] = app.selectedObjects; if (!target || !sources.length) throw new Error('GATOR: select the target object, then the source object(s)');
      const src = sources[0]; const oldMat = target.material; const addedProps: [Cluster, Property][] = [];
      app.record('GATOR', () => { if (src.material) target.setMaterial(src.material); for (const p of src.allProperties()) if (['uvprojection', 'weightmap', 'vertexcolor', 'usernormals', 'envelope'].includes(p.type) && !target.allProperties().includes(p)) { const np = new Property(p.name, p.type, p.params.map(x => ({ ...x.def, value: x.value }))); if ((p as any).values) (np as any).values = transferValues(src, target, (p as any).values); if ((p as any).normals) (np as any).normals = transferValues(src, target, (p as any).normals); if ((p as any).uvs) (np as any).uvs = (p as any).uvs; const cl = mapCluster(app, target, p.type === 'weightmap' || p.type === 'usernormals' || p.type === 'envelope' ? 'pnt' : 'sample'); cl.addProperty(np); addedProps.push([cl, np]); } }, () => { target.setMaterial(oldMat); for (const [cl, p] of addedProps) cl.removeProperty(p); addedProps.length = 0; });
      app.logMsg('info', `GATOR: transferred ${[src.material ? 'material' : '', ...addedProps.map(([, p]) => p.name)].filter(Boolean).join(', ') || 'nothing (no material / maps on the source)'} from ${src.name} to ${target.name}`);
      app.select([target]); return target;
    };
  });
  // ---- ICE: ApplyICEOp creates an ICE Tree operator (File = factory compound; Cap Hole = CapHoleProc Cap_Hole:ICETree)
  wrap(app, 'ApplyICEOp', (def) => {
    def.canRun = (a: any) => !a.File || ICE_PRESETS.includes(a.File) || a.File === 'ICETree' || /^Cap\s*Hole$/i.test(String(a.File || ''));
    def.args = [{ name: 'File', default: '' }, { name: 'Target', default: '' }, { name: 'Input', default: '' }];
    def.execute = (app: App, a: any) => {
      // Softimage ApplyICEOp targets polymesh or point cloud (Desktop GeneratePointCloudWithICE*).
      const isIceHost = (x: any) => !!x?.primitive && (!!x.primitive.mesh() || x.type === 'pointcloud' || /point\s*cloud/i.test(String(x.type || '')));
      const host = (a.Target ? app.targets(a.Target)[0] : undefined) ?? app.selectedObjects.find(isIceHost);
      if (!isIceHost(host)) throw new Error(`${a.File || 'ICE Tree'}: select a polygon mesh or point cloud`);
      const o = host as import('../core/scene').X3DObject;
      // Softimage CapHoleProc names the tree Cap_Hole (history Cap_Hole:ICETree); other presets collapse spaces.
      const file = String(a.File || '');
      const opName = !file || file === 'ICETree' ? 'ICETree' : /^Cap\s*Hole$/i.test(file) ? 'Cap_Hole' : file.replace(/\s+/g, '');
      const op = new ICETreeOperator(opName, () => o); op.getTime = () => ({ frame: app.anim.frame, time: (app.anim.frame - 1) / (app.anim.fps || 30) });
      if (a.File && a.File !== 'ICETree') buildPreset(op, String(a.File));
      return addOp(app, o, op);
    };
  });
  app.register({ name: 'CreateICETree', label: 'Create ICE Tree', category: 'ICE', args: [{ name: 'InputObjs', default: '' }], execute: (app, a) => app.run('ApplyICEOp', { File: '', Target: a.InputObjs }) });
  app.register({ name: 'ApplyICECompound', label: 'Apply ICE Compound', category: 'ICE', args: [{ name: 'Compound', default: 'Turbulize Mesh' }, { name: 'InputObjs', default: '' }], execute: (app, a) => app.run('ApplyICEOp', { File: a.Compound, Target: a.InputObjs }) });
  // ---- Skeleton: Create Spine / Tail / Control Splines
  app.register({ name: 'CreateSpine', label: 'Create Spine', category: 'Character Rigging', args: [{ name: 'Hip', default: '' }, { name: 'Chest', default: '' }, { name: 'NumVertebrae', default: 3 }], execute(app, a) {
    const hip = a.Hip ? app.scene.find(a.Hip) : app.selectedObjects[0], chest = a.Chest ? app.scene.find(a.Chest) : app.selectedObjects[1]; if (!hip || !chest) throw new Error('Create Spine: select the hip object, then the chest object');
    const P = (o: X3DObject): V3 => { const m = o.globalMatrix(); return [m.elements[12], m.elements[13], m.elements[14]]; }; const h = P(hip), c = P(chest); const n = Math.max(1, Number(a.NumVertebrae)); const pts: V3[] = []; for (let i = 0; i <= n; i++) pts.push([h[0] + (c[0] - h[0]) * i / n, h[1] + (c[1] - h[1]) * i / n, h[2] + (c[2] - h[2]) * i / n]);
    const root = makeChain(app.scene.uniqueName('Spine'), pts, false); addObject(app, root); const vert: X3DObject[] = []; for (let i = 0; i < n; i++) { const v = new Null(`Vertebra${i + 1}`); const l = v.kinematics.local; l.set('posx', pts[i][0]); l.set('posy', pts[i][1]); l.set('posz', pts[i][2]); addObject(app, v); vert.push(v); }
    app.select([root]); return root;
  } });
  app.register({ name: 'MakeTail', label: 'Create Tail', category: 'Character Rigging', args: [{ name: 'Parent', default: '' }, { name: 'NbTailBones', default: 4 }, { name: 'Length', default: 4 }], execute(app, a) {
    const parent = a.Parent ? app.scene.find(a.Parent) : app.selectedObjects[0]; if (!parent) throw new Error('Create Tail: select the object to attach the tail to');
    const m = parent.globalMatrix(); const base: V3 = [m.elements[12], m.elements[13], m.elements[14]]; const n = Math.max(1, Number(a.NbTailBones) || 4), L = Number(a.Length) || 4; const pts: V3[] = []; for (let i = 0; i <= n; i++) pts.push([base[0], base[1] - 0.15 * L * i / n, base[2] - L * i / n]);
    const root = makeChain(app.scene.uniqueName('Tail'), pts, false); addObject(app, root, parent); app.select([root]); return root;
  } });
  app.register({ name: 'MakeControlSplines', label: 'Create Control Splines', category: 'Character Rigging', args: [{ name: 'NbDivisions', default: 6 }, { name: 'Scale', default: 1 }], execute(app, a) {
    let root: any = app.selectedObjects[0]; while (root && !(root instanceof ChainRoot)) root = root.parentObj; if (!root) throw new Error('Create Control Splines: select a chain');
    const r = root as ChainRoot; const pts: V3[] = []; const P = (o: X3DObject): V3 => { const m = o.globalMatrix(); return [m.elements[12], m.elements[13], m.elements[14]]; }; pts.push(P(r)); for (const b of r.bones) { const e = r.chainEnd(); void e; pts.push(P(b)); } const end = r.chainEnd(); pts.push([end.x, end.y, end.z]);
    const curve = newObj(app, r.name + '_spline', 'crvlist', new Frozen(makeCurve(pts, 3, false), 'Control Spline')); addObject(app, curve);
    const made: X3DObject[] = [curve]; for (const [i, p] of [pts[0], pts[pts.length - 1]].entries()) { const c = makeImplicit(app.scene.uniqueName(r.name + (i ? '_endCtrl' : '_startCtrl')), 'Cube'); c.primitive!.set('size', Number(a.Scale) || 1); const l = c.kinematics.local; l.set('posx', p[0]); l.set('posy', p[1]); l.set('posz', p[2]); addObject(app, c); made.push(c); }
    app.select(made); return curve;
  } });
  // ---- Referenced models and deltas (Direct JSON OM + Softimage binary OLE .emdl)
  const EMDL_FORMAT = 'softimage-direct-emdl-json';
  const EMDL_VERSION = 1;
  const exportModel = (model: X3DObject) => {
    const nodes: any[] = []; const walk = (o: X3DObject, parent: string | null) => { const l = o.kinematics.local; const n: any = { name: o.name, type: o instanceof Model ? '#model' : o.type, parent, xf: { pos: [l.val('posx'), l.val('posy'), l.val('posz')], rot: [l.val('rotx'), l.val('roty'), l.val('rotz')], scl: [l.val('sclx'), l.val('scly'), l.val('sclz')], rotorder: l.val('rotorder') ?? 0 } };
      const m = o.primitive?.mesh(); if (o.primitive?.type === 'polymsh' && m) { n.mesh = { points: Array.from(m.positions), polys: m.polygons }; const d = o.material?.surface?.val('diffuse'); if (d) n.material = { name: o.material!.name, diffuse: d }; } if (o.type === 'bone') n.length = o.val('length'); const c = o.primitive?.curve(); if (c) n.curve = { degree: c.degree, closed: c.closed, cps: c.cvs.flatMap(v => [v[0], v[1], v[2]]) }; if (o.type === 'implicit') n.type = String(o.primitive?.val('shape') ?? 'Cube').toLowerCase();
      nodes.push(n); for (const ch of o.children) walk(ch, o.name); };
    walk(model, null);
    return {
      format: EMDL_FORMAT, version: EMDL_VERSION,
      softimage_compat: { binary_emdl: false, note: 'Direct JSON OM export; File Open/ImportModel also reads Softimage OLE .emdl via CFB + dump-backed goldens' },
      preset: model.name, file: model.name + '.emdl', model: model.name, nodes,
    };
  };
  /** Canonical JSON bytes for Direct .emdl/.delta roundtrip locks (stable key order via JSON.stringify of built object). */
  const emdlBytes = (data: any) => JSON.stringify(data);
  const refOf = (o: X3DObject | undefined) => o && (o as any).ref ? (o as any).ref as { file: string; resolution: number; resolutions: string[]; data?: any } : null;
  const modelOf = (app: App) => { let o: any = app.selectedObjects[0] ?? app.selection[0]; while (o && !(o instanceof Model)) o = o.parentObj ?? o.parent; return o as Model | undefined; };
  const loadData = async (file: string): Promise<any> => { const ls = localStorage.getItem('si.refmodel.' + file); if (ls) return JSON.parse(ls); const preset = Object.values(PRESET_MODELS).includes(file) ? file : Object.entries(PRESET_MODELS).find(([k]) => k === file)?.[1]; if (!preset) throw new Error(`Referenced model file "${file}" not found`); return JSON.parse(await fetchMaybeGzip(`si/models/${preset}.json.gz`)); };
  const replaceChildren = (app: App, model: X3DObject, data: any | null) => { const old = model.children.slice(); app.record('Reload reference', () => { for (const c of old) model.removeChild(c); if (data) { const tmp = buildPresetModel(app, data, '__tmp'); app.scene.root.removeChild(tmp); for (const c of tmp.children.slice()) model.addChild(c); } }, () => { for (const c of model.children.slice()) model.removeChild(c); for (const c of old) model.addChild(c); }); };
  /** Pick .emdl/.json as bytes so Softimage OLE Compound Files are not UTF-8-mangled. */
  const pickFile = (accept: string): Promise<{ name: string; fileName: string; buf: ArrayBuffer; text?: string } | null> => new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) { res(null); return; }
      const stem = f.name.replace(/\.(emdl|json)(\.json)?$/i, '');
      f.arrayBuffer().then(buf => {
        const head = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
        const text = isCfbOle(head) ? undefined : new TextDecoder().decode(buf);
        res({ name: stem, fileName: f.name, buf, text });
      }).catch(() => res(null));
    };
    inp.click(); setTimeout(() => res(null), 120000);
  });
  const omFromPicked = async (f: { name: string; fileName: string; buf: ArrayBuffer; text?: string }) => {
    if (isCfbOle(f.buf)) return softimageEmdlToOm(f.buf, f.fileName);
    const text = f.text ?? new TextDecoder().decode(f.buf);
    return JSON.parse(text);
  };
  const download = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); };
  app.register({ name: 'ExportModel', label: 'Export Model', category: 'Model', args: [{ name: 'InputObj', default: '' }, { name: 'FileName', default: '' }, { name: 'IncludeChildren', default: true }, { name: 'Data', default: false }], undoable: false, execute(app, a) { const m = (a.InputObj ? app.targets(a.InputObj)[0] : undefined) ?? modelOf(app) ?? app.selectedObjects[0]; if (!m) throw new Error('Select a model'); const data = exportModel(m); const text = emdlBytes(data); const name = (a.FileName || m.name) + '.emdl'; localStorage.setItem('si.refmodel.' + (a.FileName || m.name), text); if (!a.Data) download(name, text); app.logMsg('info', `Exported ${m.name} (${data.nodes.length} nodes) to ${name} [${EMDL_FORMAT} v${EMDL_VERSION}]`); return a.Data ? data : name; } });
  app.register({
    name: 'ImportModel', label: 'Import Model', category: 'Model',
    args: [{ name: 'FileName', default: '' }, { name: 'Parent', default: '' }, { name: 'Data', default: null }, { name: 'Bytes', default: null }],
    undoable: false,
    execute(app, a) {
      const go = (data: any) => {
        const m = app.run('ImportPresetModelData', { Data: data, Name: data.model || data.preset });
        const bin = data?.softimage_compat?.binary_emdl;
        const stats = data?.mesh_stats ? ` mesh_stats=${JSON.stringify(data.mesh_stats)}` : '';
        app.logMsg('info', `Imported model ${data.model || data.preset} (${data.nodes?.length ?? 0} nodes)${bin ? ' [Softimage OLE .emdl]' : ''}${stats}`);
        app.events.emit('scene');
        return m;
      };
      if (a.Data && typeof a.Data === 'object') return go(a.Data);
      if (a.Bytes) {
        const buf = a.Bytes instanceof ArrayBuffer ? a.Bytes : (a.Bytes.buffer ?? a.Bytes);
        return parseEmdlBytes(buf, a.FileName || 'model.emdl').then(go).catch(e => app.logMsg('error', `ImportModel: ${e?.message ?? e}`));
      }
      if (a.FileName) {
        // Absolute/relative URL or object URL for binary .emdl, else preset / localStorage JSON OM name.
        if (/^(blob:|https?:|\/|\.\/)/i.test(a.FileName) || /\.emdl$/i.test(a.FileName)) {
          return fetch(a.FileName).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
            .then(buf => parseEmdlBytes(buf, a.FileName.split(/[/\\]/).pop() || 'model.emdl'))
            .then(data => { try { localStorage.setItem('si.refmodel.' + (data.model || 'model'), JSON.stringify({ ...data, nodes: data.nodes?.map((n: any) => n.mesh ? { ...n, mesh: { points: `[${n.mesh.points?.length ?? 0} floats]`, polys: n.mesh.polys?.length } } : n) })); } catch { /* quota */ } return go(data); })
            .catch(e => app.logMsg('error', `ImportModel: ${e?.message ?? e}`));
        }
        return loadData(a.FileName).then(go).catch(e => app.logMsg('error', `ImportModel: ${e?.message ?? e}`));
      }
      return pickFile('.emdl,.json').then(async f => {
        if (!f) return null;
        const data = await omFromPicked(f);
        try { localStorage.setItem('si.refmodel.' + f.name, JSON.stringify(data)); } catch { /* large mesh may exceed quota — ignore */ }
        return go(data);
      }).catch(e => app.logMsg('error', `ImportModel: ${e?.message ?? e}`));
    },
  });
  app.register({ name: 'AddRefModelResolution', label: 'Add Resolution', category: 'Model', args: [{ name: 'InputObjs', default: '' }, { name: 'FileName', default: '' }], undoable: false, execute(app, a) { const m = modelOf(app); const r = refOf(m); if (!m || !r) throw new Error('Select a referenced model'); const add = (file: string) => { if (!r.resolutions.includes(file)) r.resolutions.push(file); app.logMsg('info', `${m.name}: resolution ${r.resolutions.length} = ${file}`); app.events.emit('scene'); }; if (a.FileName) { add(a.FileName); return null; } return pickFile('.emdl,.json').then(async f => { if (!f) return null; try { const data = await omFromPicked(f); localStorage.setItem('si.refmodel.' + f.name, JSON.stringify(data)); } catch { /* */ } add(f.name); return null; }); } });
  app.register({ name: 'ImportRefModels', label: 'New Referenced Model', category: 'Model', args: [{ name: 'FileName', default: '' }, { name: 'Parent', default: '' }], undoable: false, execute(app, a) {
    let file = a.FileName; if (!file) { const names = [...Object.values(PRESET_MODELS), ...Object.keys(localStorage).filter(k => k.startsWith('si.refmodel.')).map(k => k.slice(12))]; file = prompt('Referenced model file (number, name, or "browse" to pick a .emdl file):\n' + names.map((n, i) => `${i + 1}. ${n}`).join('\n'), '1') ?? ''; if (/^\d+$/.test(file)) file = names[Number(file) - 1]; if (/^b(rowse)?$/i.test(file)) return pickFile('.emdl,.json').then(async f => { if (!f) return null; try { const data = await omFromPicked(f); localStorage.setItem('si.refmodel.' + f.name, JSON.stringify(data)); } catch { /* */ } return app.run('ImportRefModels', { FileName: f.name, Parent: a.Parent }); }); } if (!file) return null;
    return loadData(file).then(data => { const m = app.run('ImportPresetModelData', { Data: data, Name: data.model }); (m as any).ref = { file, resolution: 1, resolutions: [file] }; app.events.emit('scene'); return m; }).catch(e => app.logMsg('error', `ImportRefModels: ${e?.message ?? e}`));
  } });
  app.register({ name: 'CreateEmptyRefModel', label: 'New Empty Referenced Model', category: 'Model', args: [{ name: 'Name', default: 'RefModel' }], execute(app, a) { const m = new Model(app.scene.uniqueName(a.Name || 'RefModel')); (m as any).ref = { file: '', resolution: 0, resolutions: [] }; addObject(app, m); app.select([m]); return m; } });
  app.register({ name: 'ConvertToRefModel', label: 'Convert To Reference', category: 'Model', args: [{ name: 'Model', default: '' }, { name: 'FileName', default: '' }], execute(app, a) { const m = a.Model ? app.scene.find(a.Model) : modelOf(app); if (!(m instanceof Model)) throw new Error('Convert To Reference: select a model'); const file = a.FileName || prompt('Reference file name', m.name) || m.name; localStorage.setItem('si.refmodel.' + file, JSON.stringify(exportModel(m))); (m as any).ref = { file, resolution: 1, resolutions: [file] }; app.logMsg('info', `${m.name} is now a referenced model (${file})`); app.events.emit('scene'); return m; } });
  app.register({ name: 'UpdateReferencedModel', label: 'Update Referenced Model', category: 'Model', args: [{ name: 'InputObjs', default: '' }], undoable: false, execute(app) { const m = modelOf(app); const r = refOf(m); if (!m || !r) throw new Error('Select a referenced model'); if (!r.file) return null; return loadData(r.file).then(d => { app.run('ReloadRefModelData', { Model: m.fullName, Data: d }); }).catch(e => app.logMsg('error', String(e?.message ?? e))); } });
  app.register({ name: 'ReloadRefModelData', label: 'Reload Referenced Model', category: 'Model', args: [{ name: 'Model', default: '' }, { name: 'Data', default: null }], execute(app, a) { const m = app.scene.find(a.Model); if (!m) throw new Error('No model'); replaceChildren(app, m, a.Data); app.select([m]); return m; } });
  app.register({ name: 'SetResolutionOfRefModels', label: 'Set Resolution', category: 'Model', args: [{ name: 'InputObjs', default: '' }, { name: 'resolution', default: 1 }], undoable: false, execute(app, a) {
    const m = modelOf(app); const r = refOf(m); if (!m || !r) throw new Error('Select a referenced model'); const res = Number(a.resolution);
    if (res === 0) { r.resolution = 0; app.run('ReloadRefModelData', { Model: m.fullName, Data: null }); app.logMsg('info', `${m.name}: OffLoaded`); return null; }
    const file = r.resolutions[Math.min(res, r.resolutions.length) - 1] ?? r.file; if (!file) throw new Error('This referenced model has no file for that resolution');
    r.resolution = res; return loadData(file).then(d => { app.run('ReloadRefModelData', { Model: m.fullName, Data: d }); app.logMsg('info', `${m.name}: resolution ${res} (${file})`); }).catch(e => app.logMsg('error', String(e?.message ?? e)));
  } });
  app.register({ name: 'MakeModelLocal', label: 'Make Referenced Model Local', category: 'Model', args: [{ name: 'InputObjs', default: '' }], execute(app) { const m = modelOf(app); if (!m || !refOf(m)) throw new Error('Select a referenced model'); const r = (m as any).ref; app.record('Make local', () => { delete (m as any).ref; }, () => { (m as any).ref = r; }); app.logMsg('info', `${m.name} is now a local model`); return m; } });
  app.register({ name: 'CommitToReference', label: 'Commit To Reference', category: 'Model', args: [{ name: 'IncludeNestedRefModels', default: false }, { name: 'Confirm', default: true }], execute(app) { const m = modelOf(app); const r = refOf(m); if (!m || !r?.file) throw new Error('Select a referenced model with a file'); localStorage.setItem('si.refmodel.' + r.file, JSON.stringify(exportModel(m))); app.logMsg('info', `Committed ${m.name} to ${r.file}`); return m; } });
  app.register({ name: 'AddDelta', label: 'Add Empty Delta', category: 'Model', args: [], execute(app) { const m = modelOf(app); if (!m) throw new Error('Select a model'); const d = new Property(app.scene.uniqueName('Delta'), 'delta', [str('target', m.name, 'Model', { readOnly: true }), int('changes', 0, 'Changes', { readOnly: true }), bool('active', true, 'Active')]); (d as any).changes = new Map<string, any>(); app.record('Add Delta', () => m.addProperty(d), () => m.removeProperty(d)); app.select([d]); return d; } });
  // every parameter change inside a referenced model with a Delta is recorded in it (relative path → value), like Softimage's delta modifications
  const relPath = (p: any, m: X3DObject): string | null => { const chain: string[] = []; let n: any = p; while (n && n !== m) { chain.unshift(n.name); n = n.owner ?? n.parent ?? n.parentObj; } return n === m ? chain.join('.') : null; };
  app.events.on('params', (p: any) => { if (!p || !p.name) return; let n: any = p; while (n && !(n instanceof Model)) n = n.owner ?? n.parent ?? n.parentObj; const m = n as Model | undefined; if (!m || !refOf(m)) return; const d = m.properties.find(x => x.type === 'delta' && x.val('active') !== false) as any; if (!d) return; const path = relPath(p, m); if (!path) return; d.changes.set(path, p.value); d.set('changes', d.changes.size); });
  const descendants = (o: X3DObject): X3DObject[] => o.children.flatMap(c => [c, ...descendants(c)]);
  const buildDelta = (m: Model) => {
    const r = refOf(m); if (!r?.file) throw new Error('Select a referenced model');
    const base = JSON.parse(localStorage.getItem('si.refmodel.' + r.file) ?? 'null');
    const cur = exportModel(m); const delta: any[] = [];
    for (const n of cur.nodes) { const b = base?.nodes?.find((x: any) => x.name === n.name); if (!b || JSON.stringify(b.xf) !== JSON.stringify(n.xf)) delta.push({ name: n.name, xf: n.xf }); }
    const params = Object.fromEntries([...((m.properties.find(x => x.type === 'delta') as any)?.changes ?? new Map())]);
    return { format: 'softimage-direct-delta-json', version: EMDL_VERSION, model: m.name, file: r.file, delta, params };
  };
  const applyDeltaPayload = (app: App, m: Model, d: any) => {
    let n = 0;
    for (const e of d.delta ?? []) {
      const o = [...m.children, ...descendants(m)].find(x => x.name === e.name); if (!o) continue;
      const l = o.kinematics.local; const { pos, rot, scl } = e.xf;
      app.setParam(l.get('posx')!, pos[0]); app.setParam(l.get('posy')!, pos[1]); app.setParam(l.get('posz')!, pos[2]);
      app.setParam(l.get('rotx')!, rot[0]); app.setParam(l.get('roty')!, rot[1]); app.setParam(l.get('rotz')!, rot[2]);
      app.setParam(l.get('sclx')!, scl[0]); app.setParam(l.get('scly')!, scl[1]); app.setParam(l.get('sclz')!, scl[2]); n++;
    }
    for (const [path, v] of Object.entries(d.params ?? {})) {
      const parts = String(path).split('.'); let node: any = m;
      for (const part of parts.slice(0, -1)) node = node?.children?.find((c: any) => c.name === part) ?? node?.properties?.find((c: any) => c.name === part) ?? (node?.primitive?.name === part ? node.primitive : null) ?? node?.primitive?.operators?.find((c: any) => c.name === part) ?? (part === 'kine' || part === 'Kinematics' ? node.kinematics : part === 'local' || part === 'Local' || part === 'Local Transform' ? (node.local ?? node.kinematics?.local ?? node) : part === 'global' || part === 'Global' ? (node.global ?? node) : null);
      const prm = node?.get?.(parts[parts.length - 1]); if (prm) { app.setParam(prm, v); n++; }
    }
    return n;
  };
  app.register({
    name: 'ExportDelta', label: 'Export Delta', category: 'Model',
    args: [{ name: 'FileName', default: '' }, { name: 'Data', default: false }],
    execute(app, a) {
      const m = modelOf(app); if (!m) throw new Error('Select a referenced model');
      const payload = buildDelta(m); const text = JSON.stringify(payload, null, 1);
      const key = a.FileName || (m.name + '.delta');
      localStorage.setItem('si.delta.' + key, text);
      if (!a.Data && !a.FileName) { const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); el.download = m.name + '.delta.json'; el.click(); }
      app.logMsg('info', `Exported delta with ${payload.delta.length} change(s)` + (a.FileName ? ` to ${key}` : ''));
      return a.Data ? payload : payload.delta;
    },
  });
  app.register({
    name: 'ImportDelta', label: 'Import Delta', category: 'Model',
    args: [{ name: 'Reference', default: false }, { name: 'FileName', default: '' }, { name: 'Data', default: null }],
    undoable: false,
    execute(app, a) {
      const m = modelOf(app); if (!m) throw new Error('Select a model');
      const apply = (d: any) => { const n = applyDeltaPayload(app, m, d); app.logMsg('info', `Imported delta: ${n} change(s)`); return n; };
      if (a.Data && typeof a.Data === 'object') return apply(a.Data);
      if (a.FileName) {
        const ls = localStorage.getItem('si.delta.' + a.FileName) ?? localStorage.getItem('si.delta.' + a.FileName + '.delta');
        if (!ls) throw new Error(`Delta file "${a.FileName}" not found`);
        return apply(JSON.parse(ls));
      }
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(t => apply(JSON.parse(t))); };
      inp.click(); return null;
    },
  });
  // ---- User normals (a "User Normals" property holding per-point normals; the viewport shades with them)
  const normalsProp = (app: App, o: X3DObject, create = true) => { let p = o.property('usernormals'); if (!p && create) { p = new Property('User Normals', 'usernormals', [num('length', 1, 'Display Length', { min: 0 }), bool('show', true, 'Show in Viewports')]); (p as any).normals = new Map<number, V3>(); const pp = p; const cl = mapCluster(app, o, 'pnt'); app.record('User Normals', () => cl.addProperty(pp), () => cl.removeProperty(pp)); } return p; };
  const computedNormals = (m: MeshData): V3[] => { const n: V3[] = Array.from({ length: m.positions.length / 3 }, () => [0, 0, 0] as V3); for (let t = 0; t < m.indices.length; t += 3) { const a = m.indices[t], b = m.indices[t + 1], c = m.indices[t + 2]; const A = [m.positions[a * 3], m.positions[a * 3 + 1], m.positions[a * 3 + 2]], B = [m.positions[b * 3], m.positions[b * 3 + 1], m.positions[b * 3 + 2]], C = [m.positions[c * 3], m.positions[c * 3 + 1], m.positions[c * 3 + 2]]; const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; for (const i of [a, b, c]) { n[i][0] += nn[0]; n[i][1] += nn[1]; n[i][2] += nn[2]; } } return n.map(v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l] as V3; }); };
  const selPoints = (app: App, o: X3DObject) => { const cs = app.componentSel(); const m = o.primitive!.mesh()!; if (cs?.obj === o) { if (cs.sel.kind === 'point') return cs.sel.indices; if (cs.sel.kind === 'polygon') return [...new Set(cs.sel.indices.flatMap(p => m.polygons[p]))]; return [...new Set((cs.sel.edges ?? []).flat())]; } return Array.from({ length: m.positions.length / 3 }, (_, i) => i); };
  const ownerOf = (n: any): X3DObject | undefined => { let o = n; while (o && !(o instanceof X3DObject)) o = o.parentObj ?? o.parent; return o; };
  const meshObj = (app: App) => { const o = app.selectedObjects.find(x => x.primitive?.mesh()) ?? app.compSel?.obj ?? app.selection.map(ownerOf).find(x => x?.primitive?.mesh()); if (!o?.primitive?.mesh()) throw new Error('Select a polygon mesh'); return o; };
  let normalClipboard: V3[] = [];
  // Softimage stub-tools dump ACTIVE — Property scripting names + arg counts from commands_full.
  app.register({
    name: 'ResetUserNormals', label: 'Reset User Normals', category: 'Property',
    args: [{ name: 'InputObjs', default: null }, { name: 'BleedSelection', default: null }],
    execute(app, a) {
      const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals;
      const before = new Map(map);
      app.record('Reset normals', () => { for (const i of selPoints(app, o)) map.delete(i); }, () => { map.clear(); for (const [k, v] of before) map.set(k, v); });
      app.events.emit('scene'); return p;
    },
  });
  app.register({
    name: 'AverageUserNormals', label: 'Average User Normals', category: 'Property',
    args: [{ name: 'InputObjs', default: null }, { name: 'Distance', default: null }, { name: 'BleedSelection', default: null }],
    execute(app) {
      const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals; const m = o.primitive!.mesh()!;
      const comp = computedNormals(m); const nb = new Map<number, Set<number>>();
      for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (!nb.has(a)) nb.set(a, new Set()); if (!nb.has(b)) nb.set(b, new Set()); nb.get(a)!.add(b); nb.get(b)!.add(a); }
      const cur = (i: number) => map.get(i) ?? comp[i]; const before = new Map(map); const next = new Map<number, V3>();
      for (const i of selPoints(app, o)) { const acc: V3 = [...cur(i)]; for (const j of nb.get(i) ?? []) { const q = cur(j); acc[0] += q[0]; acc[1] += q[1]; acc[2] += q[2]; } const l = Math.hypot(...acc) || 1; next.set(i, [acc[0] / l, acc[1] / l, acc[2] / l]); }
      app.record('Average normals', () => { for (const [k, v] of next) map.set(k, v); }, () => { map.clear(); for (const [k, v] of before) map.set(k, v); });
      app.events.emit('scene'); return p;
    },
  });
  app.register({
    name: 'NormalizeUserNormals', label: 'Normalize User Normals', category: 'Property',
    args: [{ name: 'InputObjs', default: null }, { name: 'BleedSelection', default: null }],
    execute(app) {
      const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals;
      for (const [k, v] of map) { const l = Math.hypot(...v) || 1; map.set(k, [v[0] / l, v[1] / l, v[2] / l]); }
      app.events.emit('scene'); return p;
    },
  });
  // Softimage: "Set the normals associated with the input components to the inverse normal" — NOT InvertPolygons.
  app.register({
    name: 'InvertUserNormals', label: 'Invert User Normals', category: 'Property',
    args: [{ name: 'InputObjs', default: null }, { name: 'BleedSelection', default: null }],
    execute(app) {
      const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals;
      const comp = computedNormals(o.primitive!.mesh()!); const before = new Map(map); const next = new Map<number, V3>();
      for (const i of selPoints(app, o)) { const n = map.get(i) ?? comp[i]; next.set(i, [-n[0], -n[1], -n[2]]); }
      app.record('Invert user normals', () => { for (const [k, v] of next) map.set(k, v); }, () => { map.clear(); for (const [k, v] of before) map.set(k, v); });
      app.events.emit('scene'); return p;
    },
  });
  app.register({
    name: 'CopyUserNormals', label: 'Copy User Normals', category: 'Property',
    args: [{ name: 'InputObjs', default: null }], undoable: false,
    execute(app) {
      const o = meshObj(app); const p = normalsProp(app, o, false); const comp = computedNormals(o.primitive!.mesh()!);
      normalClipboard = selPoints(app, o).map(i => ((p as any)?.normals?.get(i) ?? comp[i]) as V3);
      app.logMsg('info', `Copied ${normalClipboard.length} user normal(s)`);
      return normalClipboard.length;
    },
  });
  app.register({
    name: 'PasteUserNormals', label: 'Paste User Normals', category: 'Property',
    args: [
      { name: 'InputObjs', default: null }, { name: 'BleedSelection', default: null },
      { name: 'X', default: null }, { name: 'Y', default: null }, { name: 'Z', default: null },
      { name: 'Local', default: null }, { name: 'Normalize', default: null },
    ],
    execute(app, a) {
      if (!normalClipboard.length) throw new Error('Paste User Normals: nothing copied');
      const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals;
      const before = new Map(map); const pts = selPoints(app, o);
      const norm = a.Normalize == null ? true : !!a.Normalize;
      app.record('Paste user normals', () => {
        pts.forEach((i, k) => {
          let v = [...normalClipboard[Math.min(k, normalClipboard.length - 1)]] as V3;
          if (a.X != null) v[0] = Number(a.X); if (a.Y != null) v[1] = Number(a.Y); if (a.Z != null) v[2] = Number(a.Z);
          if (norm) { const l = Math.hypot(...v) || 1; v = [v[0] / l, v[1] / l, v[2] / l]; }
          map.set(i, v);
        });
      }, () => { map.clear(); for (const [k, v] of before) map.set(k, v); });
      app.events.emit('scene'); return p;
    },
  });
  app.register({ name: 'Copy', label: 'Copy', category: 'Edit', args: [], undoable: false, execute(app) { if (app.compSel) return app.run('CopyUserNormals', {}); (app as any).clipboard = app.selectedObjects.slice(); return app.selectedObjects.length; } });
  app.register({ name: 'Paste', label: 'Paste', category: 'Edit', args: [], execute(app) { if (app.compSel && normalClipboard.length) return app.run('PasteUserNormals', {}); const objs: X3DObject[] = (app as any).clipboard ?? []; if (objs.length) return app.run('Duplicate', { InputObjs: objs }); return null; } });
  // Softimage SetUserNormalsSettings / "Set User Normals Settings" = FAIL in stub-tools dump — keep inspect shell only; Gap = Softimage FAIL.
  app.register({ name: 'SetUserNormalsSettings', label: 'User Normals Settings', category: 'Modeling', args: [], execute(app) { const o = meshObj(app); const p = normalsProp(app, o)!; app.events.emit('inspect', p); return p; } });
  app.register({ name: 'TweakNormalsTool', label: 'Tweak User Normals Tool', category: 'Modeling', args: [{ name: 'Clsid', default: '{D0DDA3E5-A9BE-449F-AB49-5EDB120DE5A4}' }], undoable: false, description: 'Activate the Tweak Normals tool', execute(app) {
    const o = meshObj(app); const p = normalsProp(app, o)!; const map: Map<number, V3> = (p as any).normals; const comp = computedNormals(o.primitive!.mesh()!);
    const tool: InteractiveTool & { onPaint?: any } = { name: 'Tweak User Normals', prompt: 'Tweak User Normals: drag on a point to tilt its normal (Enter/right-click to finish)', pickKind: 'point', onClick: (_p, pick) => { if (pick && pick.kind === 'point') { const i = pick.item as number; const n = map.get(i) ?? comp[i]; const t: V3 = [n[0] + 0.3, n[1], n[2]]; const l = Math.hypot(...t); map.set(i, [t[0] / l, t[1] / l, t[2] / l]); app.events.emit('scene'); } }, onFinish() { app.setTool(null); }, onCancel() { } };
    tool.onPaint = (_w: V3, _obj: X3DObject, pick: any, delta: V3) => { if (!pick || pick.kind !== 'point') return; const i = pick.item as number; const n = map.get(i) ?? comp[i]; const t: V3 = [n[0] + delta[0] * 0.05, n[1] + delta[1] * 0.05, n[2] + delta[2] * 0.05]; const l = Math.hypot(...t) || 1; map.set(i, [t[0] / l, t[1] / l, t[2] / l]); app.events.emit('scene'); };
    app.setTool(tool); return tool;
  } });
  // ---- Paint tools (Weight Map / vertex colours / push)
  const brush = () => { let b = (app as any).brush as Property | undefined; if (!b) { b = new Property('Brush Properties', 'brush', [num('radius', 1.5, 'Radius', { min: 0.01, uimin: 0.1, uimax: 20 }), num('opacity', 0.5, 'Opacity', { min: 0, max: 1 }), num('weight', 1, 'Weight', { min: 0, max: 1 }), enumP('mode', 0, [{ label: 'Add', value: 0 }, { label: 'Erase', value: 1 }, { label: 'Smooth', value: 2 }], 'Mode'), color('color', [1, 0, 0], 'Vertex Color'), num('push', 0.2, 'Push Amount', { min: -5, max: 5 })]); (app as any).brush = b; } return b; };
  const mapProp = (app: App, o: X3DObject, type: 'weightmap' | 'vertexcolor') => { let p = o.property(type); if (!p) { const q = new Property(type === 'weightmap' ? 'Weight Map' : 'Vertex Color', type, [num('min', 0, 'Minimum', { readOnly: true }), num('max', 1, 'Maximum', { readOnly: true })]); (q as any).values = new Map<number, number | V3>(); const cl = mapCluster(app, o, type === 'weightmap' ? 'pnt' : 'sample'); app.record('Add ' + q.name, () => cl.addProperty(q), () => cl.removeProperty(q)); p = q; } return p; };
  const paintTool = (app: App, kind: 'weight' | 'color' | 'push'): InteractiveTool & { onPaint?: any } => {
    const o = meshObj(app); const b = brush();
    // painting with an Envelope_Weights property selected paints that deformer's envelope weight (others renormalise)
    const envProp = kind === 'weight' ? (app.selection.find(n => n.type === 'envelope') as any) : null; const envOp = envProp?.op as EnvelopeOperator | undefined;
    const prop = kind === 'push' ? null : envProp ?? mapProp(app, o, kind === 'weight' ? 'weightmap' : 'vertexcolor'); const values: Map<number, any> | null = envOp ? null : prop ? (prop as any).values : null;
    const envSet = (i: number, v: number) => { if (!envOp) return; const k = Number(envProp.val('deformer') ?? 0); const w = envOp.weights[i]; if (!w) return; const rest = 1 - w[k]; const nv = Math.max(0, Math.min(1, v)); if (rest > 1e-6) { const f = (1 - nv) / rest; for (let j = 0; j < w.length; j++) if (j !== k) w[j] *= f; } else for (let j = 0; j < w.length; j++) if (j !== k) w[j] = (1 - nv) / Math.max(1, w.length - 1); w[k] = nv; };
    const envGet = (i: number) => envOp ? (envOp.weights[i]?.[Number(envProp.val('deformer') ?? 0)] ?? 0) : 0;
    const stroke = (w: V3) => { const m = o.primitive!.mesh()!; const M = o.globalMatrix(); const r = Number(b.val('radius')), op = Number(b.val('opacity')), mode = Number(b.val('mode')); let n = 0; const P = m.positions; const inv = M.clone().invert(); const lp = [w[0], w[1], w[2], 1]; const lx = inv.elements[0] * lp[0] + inv.elements[4] * lp[1] + inv.elements[8] * lp[2] + inv.elements[12], ly = inv.elements[1] * lp[0] + inv.elements[5] * lp[1] + inv.elements[9] * lp[2] + inv.elements[13], lz = inv.elements[2] * lp[0] + inv.elements[6] * lp[1] + inv.elements[10] * lp[2] + inv.elements[14];
      const comp = kind === 'push' ? computedNormals(m) : null; const prim = o.primitive!; let moveOp: any = prim.operators[prim.operators.length - 1]; if (kind === 'push' && !(moveOp && moveOp.deltas)) moveOp = null;
      for (let i = 0; i < P.length / 3; i++) { const d = Math.hypot(P[i * 3] - lx, P[i * 3 + 1] - ly, P[i * 3 + 2] - lz); if (d > r) continue; const f = (1 - d / r) * op; n++;
        if (kind === 'weight') { const cur = envOp ? envGet(i) : Number(values!.get(i) ?? 0); const nv = Math.max(0, Math.min(1, mode === 1 ? cur - f : mode === 2 ? cur + (0.5 - cur) * f : cur + (Number(b.val('weight')) - cur) * f)); if (envOp) { if (!envOp.locked.has(i)) envSet(i, nv); } else values!.set(i, nv); }
        else if (kind === 'color') { const cur = (values!.get(i) as V3) ?? [0.5, 0.5, 0.5]; const c = b.val('color') as V3; values!.set(i, mode === 1 ? [cur[0] + (0.5 - cur[0]) * f, cur[1] + (0.5 - cur[1]) * f, cur[2] + (0.5 - cur[2]) * f] : [cur[0] + (c[0] - cur[0]) * f, cur[1] + (c[1] - cur[1]) * f, cur[2] + (c[2] - cur[2]) * f]); }
        else { if (!moveOp) { moveOp = app.run('MovePointTool', { InputObjs: [o], Create: true }); } const nrm = comp![i]; const amt = Number(b.val('push')) * f * (mode === 1 ? -1 : 1); const cur = moveOp.deltas.get(i) ?? [0, 0, 0]; moveOp.deltas.set(i, [cur[0] + nrm[0] * amt, cur[1] + nrm[1] * amt, cur[2] + nrm[2] * amt]); prim.dirty = true; } }
      if (n) { if (envOp) o.primitive!.dirty = true; app.events.emit('scene'); } };
    const t: InteractiveTool & { onPaint?: any } = { name: kind === 'weight' ? 'Paint Tool' : kind === 'color' ? 'Paint Vertex Color Tool' : 'Paint Push Tool', prompt: `${kind === 'weight' ? 'Paint weights' : kind === 'color' ? 'Paint vertex colours' : 'Push points'} on ${o.name}: drag over the surface (R = brush radius, Enter/right-click to finish)`, pickKind: 'polygon', onClick: (p, pick) => { if (pick) stroke(pick.worldPoint); else stroke(p); }, onFinish() { app.setTool(null); if (prop) app.select([prop]); }, onCancel() { } };
    t.onPaint = (w: V3) => stroke(w); (t as any).paintObj = o; return t;
  };
  // Softimage PaintTool ACTIVE args×3 (Clsid/CmdID/KeyboardProcess). Stroke GDI LOCK — arm tool only.
  const armPaint = (app: App, kind: 'weight' | 'color' | 'push') => {
    try { const t = paintTool(app, kind); app.setTool(t); return t; }
    catch {
      const label = kind === 'weight' ? 'Paint Tool' : kind === 'color' ? 'Paint Vertex Color Tool' : 'Paint Push Tool';
      (app as any).armedTool = { label, clsid: null };
      app.logMsg('info', `${label}: activated (select a mesh to paint)`);
      app.events.emit('selection');
      return (app as any).armedTool;
    }
  };
  app.register({
    name: 'PaintTool', label: 'Paint Tool', category: 'Paint',
    args: [
      { name: 'Clsid', default: '{BABE02C7-A8B6-11D1-9306-0060970A2BC8}' },
      { name: 'CmdID', default: '{0B553B32-8F88-11D2-85D6-00C04F8EDF15}' },
      { name: 'KeyboardProcess', default: true },
    ],
    undoable: false, description: 'Activate the paint tool',
    execute: (app) => armPaint(app, 'weight'),
  });
  app.register({
    name: 'PaintPushTool', label: 'Paint Push Tool', category: 'Modeling|Paint',
    args: [], undoable: false, execute: (app) => armPaint(app, 'push'),
  });
  app.register({
    name: 'PaintVertexColorTool', label: 'Paint Vertex Color Tool', category: 'Paint',
    args: [
      { name: 'Clsid', default: '{D9066020-ADD5-11D4-B91C-0800690C8BD0}' },
      { name: 'CmdID', default: '{77120620-ADDB-11D4-B91C-0800690C8BD0}' },
      { name: 'KeyboardProcess', default: true },
    ],
    undoable: false, execute: (app) => armPaint(app, 'color'),
  });
  // Softimage PaintVertexColors ACTIVE args×5 — arms vertex-color paint (stroke GDI LOCK).
  app.register({
    name: 'PaintVertexColors', label: 'Paint Vertex Color', category: 'Property|Paint',
    args: [
      { name: 'InputObj', default: null }, { name: 'Polynodes', default: null },
      { name: 'Colors', default: null }, { name: 'Mode', default: 0 }, { name: 'OutputObj', default: null },
    ],
    undoable: false, description: 'Paint Vertex Color',
    execute: (app) => armPaint(app, 'color'),
  });
  (app as any).brushProps = brush;
  // Softimage "Brush Properties" Name = FAIL in stub-tools dump — keep inspect helper; Gap = Softimage FAIL.
  app.register({ name: 'BrushProperties', label: 'Brush Properties', category: 'Property', args: [], undoable: false, execute(app) { app.events.emit('inspect', brush()); return brush(); } });
  // Move Point tool op factory used by Paint Push (creates/returns the top MoveComponent op)
  app.register({ name: 'MovePointTool', label: 'Move Point', category: 'Modeling', args: [{ name: 'InputObjs', default: '' }, { name: 'Create', default: false }], undoable: false, execute(app, a) { const o = app.targets(a.InputObjs)[0] ?? meshObj(app); const prim = o.primitive!; const top: any = prim.operators[prim.operators.length - 1]; if (top && top.deltas) return top; const op = new MoveComponentOperator(); app.record('Move Component', () => prim.addOperator(op), () => prim.removeOperator(op)); return op; } });
  // ---- GetPrim: Stand-in and Geometry Shader primitives
  wrap(app, 'GetPrim', (def) => {
    const prevCan = def.canRun, prevExec = def.execute;
    def.canRun = (a: any) => a.PresetObj === 'Stand-in' || a.PresetObj === 'GeoShader' || prevCan(a);
    def.execute = (app: App, a: any) => {
      if (a.PresetObj === 'Stand-in') { const o = new X3DObject(app.scene.uniqueName(a.Name || 'Standin'), 'standin'); const p = new Primitive('Stand-in', 'standin'); p.add(str('filename', '', 'File (.mi archive)')); p.add(num('bboxminx', -1, 'Bounding Box Min X')); p.add(num('bboxminy', -1, 'Min Y')); p.add(num('bboxminz', -1, 'Min Z')); p.add(num('bboxmaxx', 1, 'Max X')); p.add(num('bboxmaxy', 1, 'Max Y')); p.add(num('bboxmaxz', 1, 'Max Z')); p.add(enumP('display', 0, [{ label: 'Bounding Box', value: 0 }, { label: 'Point', value: 1 }, { label: 'Proxy Geometry', value: 2 }], 'Display')); o.setPrimitive(p); o.addProperty(makeDisplay()); addObject(app, o, a.Parent ? app.scene.find(a.Parent) : null); app.select([o]); return o; }
      if (a.PresetObj === 'GeoShader') { const o = new X3DObject(app.scene.uniqueName(a.Name || 'GeoShader'), 'geoshader'); const p = new Primitive('Geometry Shader', 'geoshader'); p.add(str('shader', '', 'Geometry Shader')); p.add(num('size', 2, 'Icon Size', { min: 0.1 })); o.setPrimitive(p); o.addProperty(makeDisplay()); addObject(app, o, a.Parent ? app.scene.find(a.Parent) : null); app.select([o]); return o; }
      return prevExec(app, a);
    };
  });
  // ---- Light rig from image: infinite lights aimed from the brightest regions of a picture
  app.register({ name: 'CreateLightRigFromImage', label: 'Light Rig from Image', category: 'Primitive', description: 'Median-cut light extraction from an environment image (HDR or LDR): 2^layers infinite lights with the energy, colour and direction of each region.', args: [{ name: 'Filename', default: '' }, { name: 'Number_Layers', default: 3 }, { name: 'AreaHigh', default: 80 }, { name: 'LightDistHigh', default: 40 }], undoable: false, execute(app, a) {
    /** data: RGB floats (linear), W×H lat-long map */
    const build = (data: Float32Array, W: number, H: number, name: string) => {
      const lum = new Float32Array(W * H); for (let y = 0; y < H; y++) { const sinPhi = Math.sin(((y + 0.5) / H) * Math.PI); for (let x = 0; x < W; x++) { const k = y * W + x; lum[k] = (0.2126 * data[k * 3] + 0.7152 * data[k * 3 + 1] + 0.0722 * data[k * 3 + 2]) * sinPhi; } } // solid-angle weighted energy
      // summed-area table for fast region sums
      const sat = new Float64Array((W + 1) * (H + 1)); for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) sat[y * (W + 1) + x] = lum[(y - 1) * W + (x - 1)] + sat[(y - 1) * (W + 1) + x] + sat[y * (W + 1) + x - 1] - sat[(y - 1) * (W + 1) + x - 1];
      const sum = (x0: number, y0: number, x1: number, y1: number) => sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0];
      type R = [number, number, number, number]; let regions: R[] = [[0, 0, W, H]]; const layers = Math.max(0, Math.min(6, Number(a.Number_Layers) | 0));
      for (let l = 0; l < layers; l++) regions = regions.flatMap(([x0, y0, x1, y1]) => { // split the longer side where the energy halves
        const w = (x1 - x0) * Math.sin(((y0 + y1) / 2 / H) * Math.PI), h = y1 - y0; const total = sum(x0, y0, x1, y1); if (total <= 0 || (x1 - x0 < 2 && y1 - y0 < 2)) return [[x0, y0, x1, y1] as R];
        if (w >= h) { let best = x0 + 1, bd = Infinity; for (let x = x0 + 1; x < x1; x++) { const d = Math.abs(sum(x0, y0, x, y1) - total / 2); if (d < bd) { bd = d; best = x; } } return [[x0, y0, best, y1], [best, y0, x1, y1]] as R[]; }
        let best = y0 + 1, bd = Infinity; for (let y = y0 + 1; y < y1; y++) { const d = Math.abs(sum(x0, y0, x1, y) - total / 2); if (d < bd) { bd = d; best = y; } } return [[x0, y0, x1, best], [x0, best, x1, y1]] as R[]; });
      const totalE = sum(0, 0, W, H) || 1; const rig = new Model(app.scene.uniqueName(name + '_LightRig')); const R = Number(a.LightDistHigh) || 40; let made = 0;
      regions.forEach((r, i) => { const [x0, y0, x1, y1] = r; const e = sum(x0, y0, x1, y1); if (e <= 1e-9) return; // light at the energy centroid, colour = energy-weighted average
        let cx = 0, cy = 0, cr = 0, cg = 0, cb = 0, cw = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = y * W + x; const w = lum[k]; cx += x * w; cy += y * w; cw += w; cr += data[k * 3] * w; cg += data[k * 3 + 1] * w; cb += data[k * 3 + 2] * w; } if (cw <= 0) return; cx /= cw; cy /= cw; const col: V3 = [cr / cw, cg / cw, cb / cw]; const mx = Math.max(col[0], col[1], col[2]) || 1;
        const th = ((cx + 0.5) / W) * 2 * Math.PI, ph = ((cy + 0.5) / H) * Math.PI; const L = new Light(`light${i + 1}`, 'infinite'); const l = L.kinematics.local; l.set('posx', R * Math.sin(ph) * Math.cos(th)); l.set('posy', R * Math.cos(ph)); l.set('posz', R * Math.sin(ph) * Math.sin(th)); l.set('roty', -th * 180 / Math.PI + 90); l.set('rotx', (ph - Math.PI / 2) * 180 / Math.PI);
        L.primitive!.set('soft_light.color', [col[0] / mx, col[1] / mx, col[2] / mx]); L.primitive!.set('soft_light.intensity', Math.min(10, (e / totalE) * regions.length * 0.75 * mx)); L.shader.set('color', [col[0] / mx, col[1] / mx, col[2] / mx]); L.shader.set('intensity', Math.min(10, (e / totalE) * regions.length * 0.75 * mx)); rig.addChild(L); made++; });
      app.record('Light rig', () => app.scene.root.addChild(rig), () => app.scene.root.removeChild(rig)); app.select([rig]); app.logMsg('info', `Light rig: ${made} infinite lights (median cut, ${layers} layers) from ${name}`); app.events.emit('scene'); return rig; };
    const fromImage = (img: HTMLImageElement, name: string) => { const cv = document.createElement('canvas'); const W = cv.width = 128, H = cv.height = 64; const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0, W, H); const d = ctx.getImageData(0, 0, W, H).data; const f = new Float32Array(W * H * 3); for (let k = 0; k < W * H; k++) { f[k * 3] = Math.pow(d[k * 4] / 255, 2.2); f[k * 3 + 1] = Math.pow(d[k * 4 + 1] / 255, 2.2); f[k * 3 + 2] = Math.pow(d[k * 4 + 2] / 255, 2.2); } build(f, W, H, name); };
    const fromHDR = async (buf: ArrayBuffer, name: string) => { const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js'); const tex: any = new RGBELoader().parse(buf); if (!tex?.data) throw new Error('bad HDR'); const W = tex.width, H = tex.height, src = tex.data as Float32Array | Uint16Array; const f = new Float32Array(W * H * 3); const half = src instanceof Uint16Array; const h2f = (h: number) => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; return e === 0 ? s * Math.pow(2, -14) * (m / 1024) : e === 31 ? s * Infinity : s * Math.pow(2, e - 15) * (1 + m / 1024); }; for (let k = 0; k < W * H; k++) for (let c = 0; c < 3; c++) f[k * 3 + c] = half ? h2f(src[k * 4 + c]) : src[k * 4 + c]; build(f, W, H, name); };
    const fromFile = (f: File) => { const name = f.name.replace(/\.[^.]+$/, ''); if (/\.hdr$/i.test(f.name)) f.arrayBuffer().then(b => fromHDR(b, name)).catch(e => app.logMsg('error', 'Light Rig from Image: ' + e.message)); else { const img = new Image(); img.onload = () => fromImage(img, name); img.src = URL.createObjectURL(f); } };
    if (a.Filename) { const name = String(a.Filename).split(/[\\/]/).pop()!.replace(/\.[^.]+$/, ''); if (/\.hdr$/i.test(a.Filename)) { fetch(a.Filename).then(r => r.arrayBuffer()).then(b => fromHDR(b, name)).catch(e => app.logMsg('error', 'Light Rig from Image: ' + e.message)); return null; } const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => fromImage(img, name); img.onerror = () => app.logMsg('error', 'Light Rig from Image: cannot load ' + a.Filename); img.src = a.Filename; return null; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.hdr'; inp.onchange = () => { const f = inp.files?.[0]; if (f) fromFile(f); }; inp.click(); return null;
  } });
  // Stand-in proxy: load an .obj (or exported-mesh JSON) as the stand-in's display geometry and bounding box
  const parseOBJ = (text: string): MeshData => { const verts: V3[] = [], faces: number[][] = []; for (const line of text.split(/\r?\n/)) { const t = line.trim().split(/\s+/); if (t[0] === 'v') verts.push([+t[1], +t[2], +t[3]]); else if (t[0] === 'f') { const f = t.slice(1).map(x => { const i = parseInt(x.split('/')[0], 10); return i < 0 ? verts.length + i : i - 1; }).filter(i => i >= 0 && i < verts.length); if (f.length >= 3) faces.push(f); } } return fromPolys(verts, faces); };
  const meshToOBJ = (o: X3DObject) => {
    const m = o.primitive?.mesh(); if (!m) return null;
    const lines = [`# Softimage-Direct OBJ — ${o.name}`, `o ${o.name}`];
    for (let i = 0; i < m.positions.length; i += 3) lines.push(`v ${m.positions[i]} ${m.positions[i + 1]} ${m.positions[i + 2]}`);
    for (const f of m.polygons) lines.push('f ' + f.map(i => i + 1).join(' '));
    return lines.join('\n');
  };
  app.register({
    name: 'ImportObjFile', label: 'Import Obj File', category: 'File', args: [{ name: 'FileName', default: '' }], undoable: false,
    execute(app, a) {
      const go = (text: string, name: string) => {
        const mesh = parseOBJ(text); if (!mesh.positions.length) throw new Error('No vertices in OBJ');
        const obj = newObj(app, name.replace(/\.[^.]+$/, '') || 'obj', 'polymsh', new Frozen(mesh, 'Imported OBJ'));
        addObject(app, obj); app.select([obj]); app.events.emit('scene'); app.logMsg('info', `Imported OBJ "${name}" (${mesh.positions.length / 3} points)`); return obj;
      };
      if (a.FileName) return fetch(String(a.FileName)).then(r => r.text()).then(t => go(t, String(a.FileName).split(/[\\/]/).pop()!)).catch(e => app.logMsg('error', 'Import Obj: ' + (e?.message ?? e)));
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.obj,text/plain'; inp.onchange = () => { const f = inp.files?.[0]; if (f) f.text().then(t => go(t, f.name)).catch(e => app.logMsg('error', 'Import Obj: ' + e.message)); }; inp.click(); return null;
    },
  });
  app.register({
    name: 'ExportObjFile', label: 'Export Obj File', category: 'File', args: [{ name: 'InputObjs', default: '' }, { name: 'FileName', default: '' }], undoable: false,
    execute(app, a) {
      const objs = (a.InputObjs ? app.targets(a.InputObjs) : app.selectedObjects).filter(o => o.primitive?.mesh());
      if (!objs.length) throw new Error('Select a polygon mesh to export');
      const parts = objs.map(o => meshToOBJ(o)!).filter(Boolean);
      const name = (a.FileName || objs[0].name) + (/\.obj$/i.test(a.FileName || '') ? '' : '.obj');
      const blob = new Blob([parts.join('\n\n')], { type: 'text/plain' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click();
      app.logMsg('info', `Exported OBJ "${name}" (${objs.length} object${objs.length === 1 ? '' : 's'})`);
      return name;
    },
  });
  app.register({ name: 'LoadStandinProxy', label: 'Load Stand-in Proxy', category: 'Primitive', args: [{ name: 'InputObjs', default: '' }, { name: 'FileName', default: '' }], undoable: false, execute(app, a) {
    const o = app.targets(a.InputObjs).find(x => x.type === 'standin'); if (!o) throw new Error('Select a Stand-in'); const apply = (mesh: MeshData, name: string) => { const p = o.primitive!; (p as any).proxy = mesh; p.set('filename', name); const P = mesh.positions; const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); } p.set('bboxminx', mn[0]); p.set('bboxminy', mn[1]); p.set('bboxminz', mn[2]); p.set('bboxmaxx', mx[0]); p.set('bboxmaxy', mx[1]); p.set('bboxmaxz', mx[2]); p.set('display', 2); app.events.emit('scene'); app.logMsg('info', `${o.name}: proxy ${name} (${P.length / 3} points)`); };
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.obj,.json'; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; f.text().then(t => { if (/\.obj$/i.test(f.name)) apply(parseOBJ(t), f.name); else { const d = JSON.parse(t); const node = d.nodes?.find((n: any) => n.mesh) ?? d; const pts = node.mesh?.points ?? node.points; const polys = node.mesh?.polys ?? node.polys; if (!pts || !polys) throw new Error('No mesh in file'); const verts: V3[] = []; for (let i = 0; i < pts.length; i += 3) verts.push([pts[i], pts[i + 1], pts[i + 2]]); apply(fromPolys(verts, polys), f.name); } }).catch(e => app.logMsg('error', 'Stand-in proxy: ' + e.message)); }; inp.click(); return null;
  } });
  // ---- ICE Particle Volume shader preset
  wrap(app, 'ApplyShader', (def) => { if (!def) return; const prevCan = def.canRun, prevExec = def.execute; const isIce = (a: any) => a.PresetObj === 'ICEParticleVolumeShader' || a.PresetObj === 'ICE Particle Volume'; def.canRun = (a: any) => isIce(a) || (prevCan ? prevCan(a) : true); def.execute = (app: App, a: any) => { if (!isIce(a)) return prevExec(app, a); for (const o of app.targets(a.InputObjs)) { const sh = makePhong('ICE Particle Volume'); sh.add(num('density', 1, 'Density', { min: 0 })); sh.add(num('density_scale', 1, 'Density Scale', { min: 0 })); sh.add(enumP('shape', 0, [{ label: 'Sphere', value: 0 }, { label: 'Blob', value: 1 }, { label: 'Point', value: 2 }], 'Shape')); const mat = app.scene.newMaterial(o.name + '_Mat', sh); const old = o.material; app.record('Apply shader', () => o.setMaterial(mat), () => o.setMaterial(old)); app.select([sh]); } return null; }; });

  // Softimage stub-tools dump ACTIVE Names (empty ScriptingName) — Name + attested arity.
  // Scripting AddPolygonTool / SplitPolygonTool / KnifeTool = FAIL — skip those SNs.
  const nameAlias = (name: string, target: string, args: { name: string; default: any }[] = [{ name: 'Clsid', default: '' }]) =>
    app.register({
      name, label: name, category: 'Modeling|Drawing', args, undoable: false,
      execute: (app, a) => app.run(target, a),
    });
  nameAlias('Add Polygon Tool', 'AddPolygonTool');
  nameAlias('Split Polygon Tool', 'SplitPolygonTool');
  nameAlias('Add Vertex Tool', 'AddVertexTool');
  nameAlias('Split Edge Tool', 'SplitEdgeTool');
  app.register({
    name: 'Paint Tool', label: 'Paint Tool', category: 'Paint',
    args: [{ name: 'Clsid', default: '{BABE02C7-A8B6-11D1-9306-0060970A2BC8}' }],
    undoable: false, execute: (app, a) => app.run('PaintTool', a),
  });
  app.register({
    name: 'Snap Boundary', label: 'Snap Boundary', category: 'Operator',
    args: [
      { name: 'ConnectionSet', default: null },
      { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' },
      { name: 'ImmediateMode', default: ':siPersistentOperation:siOperationMode' },
      { name: 'OutputObjs', default: null },
    ],
    execute: (app, a) => app.run('ApplySnapFaceOp', a),
  });

  void CurveGeomOperator; void fromPolys;
}
