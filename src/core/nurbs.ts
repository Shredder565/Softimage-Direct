// NURBS surface meshes as control-point grids (Softimage "Surf. Mesh" objects), with the Modify > Surf. Mesh and
// Create > Surf. Mesh operators: Open/Close, Snip, Extend to Curve, Stitch, Snap Boundary, Fit, Fillet, Trim.
// Surfaces are evaluated as uniform B-splines of the stored degree and tessellated to MeshData; the grid rides along on
// the mesh as `mesh.nurbs` so later operators keep editing control points rather than triangles.
import { MeshData } from './geometry';
import { fromPolys } from './topology';
import { CurveData, evalCurve, curveDomain, V3 } from './curves';

export interface NurbsSurface { nu: number; nv: number; degU: number; degV: number; closedU: boolean; closedV: boolean; cps: V3[]; }
export type NMesh = MeshData & { nurbs?: NurbsSurface; trims?: { axis: number; poly: [number, number][]; keepInside: boolean }[] };

export const cpAt = (s: NurbsSurface, i: number, j: number): V3 => { const nu = s.nu, nv = s.nv; i = s.closedU ? ((i % nu) + nu) % nu : Math.max(0, Math.min(nu - 1, i)); j = s.closedV ? ((j % nv) + nv) % nv : Math.max(0, Math.min(nv - 1, j)); return s.cps[j * nu + i]; };
export function cloneSurf(s: NurbsSurface): NurbsSurface { return { ...s, cps: s.cps.map(p => [p[0], p[1], p[2]] as V3) }; }

/** Uniform B-spline basis blend of the `deg+1` control points around parameter t (t in control-point units). */
function spline1(deg: number, n: number, closed: boolean, t: number, pick: (i: number) => V3): V3 {
  if (deg <= 1) { const i = Math.floor(t), a = t - i; const p = pick(i), q = pick(i + 1); return [p[0] + (q[0] - p[0]) * a, p[1] + (q[1] - p[1]) * a, p[2] + (q[2] - p[2]) * a]; }
  // cubic uniform B-spline (deg 2 handled as cubic for simplicity); clamp ends by repeating end points on open surfaces
  const i = Math.floor(t), a = t - i; const b0 = (1 - a) ** 3 / 6, b1 = (3 * a ** 3 - 6 * a ** 2 + 4) / 6, b2 = (-3 * a ** 3 + 3 * a ** 2 + 3 * a + 1) / 6, b3 = a ** 3 / 6;
  const P = [pick(i - 1), pick(i), pick(i + 1), pick(i + 2)]; const w = [b0, b1, b2, b3]; const out: V3 = [0, 0, 0];
  for (let k = 0; k < 4; k++) for (let x = 0; x < 3; x++) out[x] += P[k][x] * w[k];
  void n; void closed; return out;
}
/** Evaluate at (u, v) in [0,1]. Degree-1 grids interpolate control points exactly, so primitives tessellate as before. */
export function evalSurf(s: NurbsSurface, u: number, v: number): V3 {
  const spansU = s.closedU ? s.nu : s.nu - 1, spansV = s.closedV ? s.nv : s.nv - 1;
  const tu = Math.min(u, 1 - 1e-9) * spansU, tv = Math.min(v, 1 - 1e-9) * spansV;
  const row = (j: number) => spline1(s.degU, s.nu, s.closedU, tu, i => cpAt(s, i, j));
  return spline1(s.degV, s.nv, s.closedV, tv, j => row(j));
}
export function tessellateNurbs(s: NurbsSurface, usub?: number, vsub?: number): NMesh {
  const su = usub ?? (s.closedU ? s.nu : s.nu - 1) * (s.degU > 1 ? 2 : 1), sv = vsub ?? (s.closedV ? s.nv : s.nv - 1) * (s.degV > 1 ? 2 : 1);
  const verts: V3[] = [], faces: number[][] = []; const nu = s.closedU ? su : su + 1, nv = s.closedV ? sv : sv + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) verts.push(evalSurf(s, i / su, j / sv));
  const idx = (i: number, j: number) => ((j % nv) * nu) + (i % nu);
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const f = [idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]; const uniq = [...new Set(f)]; if (uniq.length >= 3) faces.push(uniq); }
  const m = fromPolys(verts, faces) as NMesh; m.nurbs = s; return m;
}
/** Control grid of a mesh: its NURBS grid when it has one, else the mesh points reinterpreted as a (sqrt-ish) grid. */
export function surfOf(m: NMesh | null): NurbsSurface | null {
  if (!m) return null; if (m.nurbs) return m.nurbs;
  const n = m.positions.length / 3; const nu = Math.max(2, Math.round(Math.sqrt(n))); const nv = Math.max(2, Math.floor(n / nu)); const cps: V3[] = [];
  for (let k = 0; k < nu * nv; k++) cps.push([m.positions[k * 3], m.positions[k * 3 + 1], m.positions[k * 3 + 2]]);
  return { nu, nv, degU: 1, degV: 1, closedU: false, closedV: false, cps };
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]); const dist = (a: V3, b: V3) => len(sub(a, b)); const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export type Boundary = 'umin' | 'umax' | 'vmin' | 'vmax';
export function boundaryIndices(s: NurbsSurface, b: Boundary): [number, number][] { const out: [number, number][] = []; if (b === 'umin' || b === 'umax') { const i = b === 'umin' ? 0 : s.nu - 1; for (let j = 0; j < s.nv; j++) out.push([i, j]); } else { const j = b === 'vmin' ? 0 : s.nv - 1; for (let i = 0; i < s.nu; i++) out.push([i, j]); } return out; }
export function closestPointOnSurf(s: NurbsSurface, p: V3, steps = 24): { u: number; v: number; p: V3 } { let best = { u: 0, v: 0, p: evalSurf(s, 0, 0) }, bd = Infinity; for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) { const q = evalSurf(s, i / steps, j / steps); const d = dist(q, p); if (d < bd) { bd = d; best = { u: i / steps, v: j / steps, p: q }; } } return best; }
export function surfNormal(s: NurbsSurface, u: number, v: number): V3 { const e = 1e-3; const du = sub(evalSurf(s, Math.min(1, u + e), v), evalSurf(s, Math.max(0, u - e), v)), dv = sub(evalSurf(s, u, Math.min(1, v + e)), evalSurf(s, u, Math.max(0, v - e))); return norm(cross(du, dv)); }
/** The boundary of `s` closest to the other surface/point set. */
export function nearestBoundary(s: NurbsSurface, target: (p: V3) => V3): Boundary { let best: Boundary = 'umin', bd = Infinity; for (const b of ['umin', 'umax', 'vmin', 'vmax'] as Boundary[]) { let d = 0; for (const [i, j] of boundaryIndices(s, b)) { const p = cpAt(s, i, j); d += dist(p, target(p)); } if (d < bd) { bd = d; best = b; } } return best; }

// ---------------------------------------------------------------- operators (pure functions on grids)
export function openClose(s: NurbsSurface, closeU: boolean, closeV: boolean): NurbsSurface { const o = cloneSurf(s); o.closedU = closeU; o.closedV = closeV; return o; }
/** Split the grid at a parameter along U or V; returns the two halves (the second may be empty). */
export function snip(s: NurbsSurface, alongU: boolean, t: number): [NurbsSurface, NurbsSurface | null] {
  const n = alongU ? s.nu : s.nv; const k = Math.max(1, Math.min(n - 1, Math.round(t * (n - 1)))); if (n < 3) return [cloneSurf(s), null];
  const pick = (ra: number, rb: number): NurbsSurface => { const cps: V3[] = []; const nu = alongU ? rb - ra + 1 : s.nu, nv = alongU ? s.nv : rb - ra + 1; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) cps.push([...cpAt(s, alongU ? ra + i : i, alongU ? j : ra + j)] as V3); return { nu, nv, degU: s.degU, degV: s.degV, closedU: alongU ? false : s.closedU, closedV: alongU ? s.closedV : false, cps }; };
  return [pick(0, k), pick(k, n - 1)];
}
/** Append a row of control points along a curve beyond the given boundary (Modify > Surf. Mesh > Extend to Curve). */
export function extendToCurve(s: NurbsSurface, b: Boundary, curve: CurveData): NurbsSurface {
  const [u0, u1] = curveDomain(curve); const alongV = b === 'vmin' || b === 'vmax'; const count = alongV ? s.nu : s.nv;
  const samples: V3[] = []; for (let k = 0; k < count; k++) samples.push(evalCurve(curve, u0 + (u1 - u0) * (count === 1 ? 0 : k / (count - 1))));
  // orient the samples like the boundary (match first/last ends)
  const bi = boundaryIndices(s, b); const first = cpAt(s, ...bi[0]), last = cpAt(s, ...bi[bi.length - 1]);
  if (dist(first, samples[0]) + dist(last, samples[samples.length - 1]) > dist(first, samples[samples.length - 1]) + dist(last, samples[0])) samples.reverse();
  const o: NurbsSurface = { ...s, cps: [] }; const nu = alongV ? s.nu : s.nu + 1, nv = alongV ? s.nv + 1 : s.nv; o.nu = nu; o.nv = nv;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    let p: V3;
    if (alongV) { const jj = b === 'vmin' ? j - 1 : j; p = (b === 'vmin' && j === 0) || (b === 'vmax' && j === nv - 1) ? samples[i] : cpAt(s, i, jj); }
    else { const ii = b === 'umin' ? i - 1 : i; p = (b === 'umin' && i === 0) || (b === 'umax' && i === nu - 1) ? samples[j] : cpAt(s, ii, j); }
    o.cps.push([...p] as V3);
  }
  return o;
}
/** Move a boundary's control points onto the closest points of another surface (Snap Boundary) or blend with them (Stitch). */
export function snapBoundary(s: NurbsSurface, b: Boundary, target: NurbsSurface, blend = 1): NurbsSurface {
  const o = cloneSurf(s); for (const [i, j] of boundaryIndices(s, b)) { const p = cpAt(s, i, j); const q = closestPointOnSurf(target, p).p; o.cps[j * s.nu + i] = add(p, mul(sub(q, p), blend)); } return o;
}
/** Fit a new NURBS grid (nu x nv, cubic) over an existing surface or mesh (Create > Surf. Mesh > Fit). */
export function fitSurface(src: NMesh, nu: number, nv: number): NurbsSurface {
  const s = surfOf(src); const cps: V3[] = [];
  if (s && src.nurbs) { for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) cps.push(evalSurf(s, i / (nu - 1), j / (nv - 1))); return { nu, nv, degU: 3, degV: 3, closedU: s.closedU, closedV: s.closedV, cps }; }
  // polygon mesh: height-field fit over the bounding box in XZ (sampling the nearest vertex)
  const P = src.positions; let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity; for (let k = 0; k < P.length; k += 3) { minx = Math.min(minx, P[k]); maxx = Math.max(maxx, P[k]); minz = Math.min(minz, P[k + 2]); maxz = Math.max(maxz, P[k + 2]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const x = minx + (maxx - minx) * i / (nu - 1), z = minz + (maxz - minz) * j / (nv - 1); let by = 0, bd = Infinity; for (let k = 0; k < P.length; k += 3) { const d = (P[k] - x) ** 2 + (P[k + 2] - z) ** 2; if (d < bd) { bd = d; by = P[k + 1]; } } cps.push([x, by, z]); }
  return { nu, nv, degU: 3, degV: 3, closedU: false, closedV: false, cps };
}
/** Fillet between two surfaces: a strip of `sections` arcs of the given radius along their approximate intersection. */
export function filletSurfaces(a: NurbsSurface, b: NurbsSurface, radius: number, sections = 12, arcs = 5): NurbsSurface | null {
  // sample A, keep samples that lie within the radius band of B, order them along the longest axis
  const samples: { p: V3; q: V3; na: V3; nb: V3 }[] = []; const steps = 20;
  for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) { const u = i / steps, v = j / steps; const p = evalSurf(a, u, v); const c = closestPointOnSurf(b, p, 16); if (dist(p, c.p) < radius * 1.5) samples.push({ p, q: c.p, na: surfNormal(a, u, v), nb: surfNormal(b, c.u, c.v) }); }
  if (samples.length < 2) return null;
  const axis = [0, 1, 2].map(k => { const vals = samples.map(s => s.p[k]); return Math.max(...vals) - Math.min(...vals); }); const ax = axis.indexOf(Math.max(...axis)); samples.sort((x, y) => x.p[ax] - y.p[ax]);
  const picked: typeof samples = []; for (let k = 0; k < sections; k++) picked.push(samples[Math.min(samples.length - 1, Math.round(k * (samples.length - 1) / Math.max(1, sections - 1)))]);
  const cps: V3[] = [];
  for (let k = 0; k < arcs; k++) { const t = k / (arcs - 1); for (const s of picked) { const mid = mul(add(s.p, s.q), 0.5); const bulge = mul(norm(add(s.na, s.nb)), radius * Math.sin(Math.PI * t)); cps.push(add(add(mul(s.p, 1 - t), mul(s.q, t)), bulge)); } }
  return { nu: picked.length, nv: arcs, degU: 3, degV: 3, closedU: false, closedV: false, cps };
}
/** Hide the polygons whose centre projects inside the trim curve's silhouette along an axis (Trim by Projection). */
export function applyTrims(m: NMesh): NMesh {
  if (!m.trims?.length) return m; const keep: number[][] = [];
  const inside = (x: number, y: number, poly: [number, number][]) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  for (const f of m.polygons) { const c = [0, 0, 0]; for (const v of f) for (let k = 0; k < 3; k++) c[k] += m.positions[v * 3 + k] / f.length; let drop = false; for (const t of m.trims) { const [x, y] = t.axis === 0 ? [c[1], c[2]] : t.axis === 1 ? [c[0], c[2]] : [c[0], c[1]]; const ins = inside(x, y, t.poly); if (ins !== t.keepInside) drop = true; } if (!drop) keep.push(f); }
  const verts: V3[] = []; for (let k = 0; k < m.positions.length; k += 3) verts.push([m.positions[k], m.positions[k + 1], m.positions[k + 2]]);
  const out = fromPolys(verts, keep) as NMesh; out.nurbs = m.nurbs; out.trims = m.trims; return out;
}
