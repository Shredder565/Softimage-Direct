// NURBS surface meshes as control-point grids (Softimage "Surf. Mesh" objects), with the Modify > Surf. Mesh and
// Create > Surf. Mesh operators: Open/Close, Snip, Extend to Curve, Stitch, Snap Boundary, Fit, Fillet, Trim.
// Surfaces are evaluated as uniform B-splines of the stored degree and tessellated to MeshData; the grid rides along on
// the mesh as `mesh.nurbs` so later operators keep editing control points rather than triangles.
import { MeshData } from './geometry';
import { fromPolys } from './topology';
import { CurveData, evalCurve, curveDomain, sampleCurve, makeCurve, unrollClosed, V3 } from './curves';

export interface NurbsSurface {
  nu: number; nv: number; degU: number; degV: number; closedU: boolean; closedV: boolean; cps: V3[];
  /** Optional true NURBS data: clamped knot vectors (length nu+degU+1 / nv+degV+1) and per-control-point weights. Absent → uniform B-spline. */
  knotsU?: number[]; knotsV?: number[]; weights?: number[];
  /** Open (clamped) rational grid whose last row/column coincides with the first: tessellate as closed without duplicating the seam. */
  seamU?: boolean; seamV?: boolean;
}
/** Clamped uniform knot vector for n control points of degree p. */
export function clampedKnots(n: number, p: number): number[] { const k: number[] = []; for (let i = 0; i <= p; i++) k.push(0); for (let i = 1; i < n - p; i++) k.push(i / (n - p)); for (let i = 0; i <= p; i++) k.push(1); return k; }
const findSpan = (n: number, p: number, u: number, U: number[]) => { if (u >= U[n]) return n - 1; let lo = p, hi = n; let mid = (lo + hi) >> 1; while (u < U[mid] || u >= U[mid + 1]) { if (u < U[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; } return mid; };
const basisFuns = (i: number, u: number, p: number, U: number[]) => { const N = [1], left: number[] = [], right: number[] = []; for (let j = 1; j <= p; j++) { left[j] = u - U[i + 1 - j]; right[j] = U[i + j] - u; let saved = 0; for (let r = 0; r < j; r++) { const den = right[r + 1] + left[j - r]; const temp = den ? N[r] / den : 0; N[r] = saved + right[r + 1] * temp; saved = left[j - r] * temp; } N[j] = saved; } return N; };
export type NMesh = MeshData & { nurbs?: NurbsSurface; trims?: { axis: number; poly: [number, number][]; keepInside: boolean }[] };

export const cpAt = (s: NurbsSurface, i: number, j: number): V3 => { const nu = s.nu, nv = s.nv; i = s.closedU ? ((i % nu) + nu) % nu : Math.max(0, Math.min(nu - 1, i)); j = s.closedV ? ((j % nv) + nv) % nv : Math.max(0, Math.min(nv - 1, j)); return s.cps[j * nu + i]; };
export function cloneSurf(s: NurbsSurface): NurbsSurface { return { ...s, cps: s.cps.map(p => [p[0], p[1], p[2]] as V3), knotsU: s.knotsU?.slice(), knotsV: s.knotsV?.slice(), weights: s.weights?.slice() }; }
/** Drop knots/weights (after an edit that changed the grid size the uniform form is the safe fallback). */
export function uniformize(s: NurbsSurface): NurbsSurface { const o = { ...s }; delete o.knotsU; delete o.knotsV; delete o.weights; return o; }

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
  if ((s.knotsU || s.knotsV || s.weights) && !s.closedU && !s.closedV) { // true NURBS: tensor-product de Boor with rational weights
    const U = s.knotsU ?? clampedKnots(s.nu, s.degU), V = s.knotsV ?? clampedKnots(s.nv, s.degV); const p = s.degU, q = s.degV;
    const uu = U[p] + (U[s.nu] - U[p]) * Math.min(1, Math.max(0, u)), vv = V[q] + (V[s.nv] - V[q]) * Math.min(1, Math.max(0, v));
    const su = findSpan(s.nu, p, uu, U), sv = findSpan(s.nv, q, vv, V); const Nu = basisFuns(su, uu, p, U), Nv = basisFuns(sv, vv, q, V);
    const out = [0, 0, 0, 0];
    for (let l = 0; l <= q; l++) { const j = sv - q + l; for (let k = 0; k <= p; k++) { const i = su - p + k; const idx = j * s.nu + i; const w = (s.weights?.[idx] ?? 1) * Nu[k] * Nv[l]; const P = s.cps[idx]; out[0] += P[0] * w; out[1] += P[1] * w; out[2] += P[2] * w; out[3] += w; } }
    const w = out[3] || 1; return [out[0] / w, out[1] / w, out[2] / w];
  }
  const spansU = s.closedU ? s.nu : s.nu - 1, spansV = s.closedV ? s.nv : s.nv - 1;
  const tu = Math.min(u, 1 - 1e-9) * spansU, tv = Math.min(v, 1 - 1e-9) * spansV;
  const row = (j: number) => spline1(s.degU, s.nu, s.closedU, tu, i => cpAt(s, i, j));
  return spline1(s.degV, s.nv, s.closedV, tv, j => row(j));
}
export function tessellateNurbs(s: NurbsSurface, usub?: number, vsub?: number): NMesh {
  const su = usub ?? (s.closedU ? s.nu : s.nu - 1) * (s.degU > 1 ? 2 : 1), sv = vsub ?? (s.closedV ? s.nv : s.nv - 1) * (s.degV > 1 ? 2 : 1);
  const verts: V3[] = [], faces: number[][] = []; const nu = s.closedU || s.seamU ? su : su + 1, nv = s.closedV || s.seamV ? sv : sv + 1;
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
  const n = alongU ? s.nu : s.nv; if (n < 3) return [cloneSurf(s), null];
  if (!(alongU ? s.closedU : s.closedV) && (alongU ? s.degU : s.degV) >= 1) { const [a, b] = splitSurf(s, Math.max(0.02, Math.min(0.98, t)), alongU); return [a, b]; } // exact NURBS split
  const k = Math.max(1, Math.min(n - 1, Math.round(t * (n - 1))));
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
  const o: NurbsSurface = { ...uniformize(s), cps: [] }; const nu = alongV ? s.nu : s.nu + 1, nv = alongV ? s.nv + 1 : s.nv; o.nu = nu; o.nv = nv;
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


// ----------------------------------------------------------------- true NURBS editing
/** Boehm knot insertion along U (or V) at parameter t in [0,1]; shape is unchanged, the grid gains one column (row). */
export function insertKnotSurf(s: NurbsSurface, t: number, alongU = true): NurbsSurface {
  if (alongU ? s.closedU : s.closedV) return s;
  const p = alongU ? s.degU : s.degV, n = alongU ? s.nu : s.nv; const K = (alongU ? s.knotsU : s.knotsV)?.slice() ?? clampedKnots(n, p);
  const u = K[p] + (K[n] - K[p]) * Math.min(1 - 1e-9, Math.max(0, t)); const k = findSpan(n, p, u, K);
  const W = s.weights ?? s.cps.map(() => 1); const nu2 = alongU ? s.nu + 1 : s.nu, nv2 = alongU ? s.nv : s.nv + 1; const cps: V3[] = new Array(nu2 * nv2); const w2: number[] = new Array(nu2 * nv2);
  const lines = alongU ? s.nv : s.nu;
  for (let L = 0; L < lines; L++) {
    const get = (i: number) => alongU ? L * s.nu + i : i * s.nu + L; const put = (i: number) => alongU ? L * nu2 + i : i * nu2 + L;
    for (let i = 0; i <= n; i++) {
      if (i <= k - p) { cps[put(i)] = s.cps[get(i)]; w2[put(i)] = W[get(i)]; }
      else if (i > k) { cps[put(i)] = s.cps[get(i - 1)]; w2[put(i)] = W[get(i - 1)]; }
      else { const den = K[i + p] - K[i]; const a = den ? (u - K[i]) / den : 0; const A = s.cps[get(i - 1)], B = s.cps[get(i)], wa = W[get(i - 1)], wb = W[get(i)]; const w = (1 - a) * wa + a * wb; cps[put(i)] = [((1 - a) * A[0] * wa + a * B[0] * wb) / w, ((1 - a) * A[1] * wa + a * B[1] * wb) / w, ((1 - a) * A[2] * wa + a * B[2] * wb) / w]; w2[put(i)] = w; }
    }
  }
  K.splice(k + 1, 0, u);
  const out: NurbsSurface = { ...s, nu: nu2, nv: nv2, cps, weights: w2, knotsU: alongU ? K : (s.knotsU ?? clampedKnots(s.nu, s.degU)), knotsV: alongU ? (s.knotsV ?? clampedKnots(s.nv, s.degV)) : K };
  return out;
}
/** Exact split at parameter t: insert the knot `degree` times, then cut the grid. */
export function splitSurf(s: NurbsSurface, t: number, alongU = true): [NurbsSurface, NurbsSurface] {
  let cur = s; const p = alongU ? s.degU : s.degV; for (let r = 0; r < p; r++) cur = insertKnotSurf(cur, t, alongU);
  const K = (alongU ? cur.knotsU : cur.knotsV)!; const n = alongU ? cur.nu : cur.nv; const u = K[p] + (K[n] - K[p]) * t;
  let first = K.findIndex(k => Math.abs(k - u) < 1e-9); if (first < 0) first = findSpan(n, p, u, K) - p + 1;
  const nA = first; // control points 0..first-1 belong to the first piece plus the shared one
  const take = (from: number, count: number): NurbsSurface => { const nu2 = alongU ? count : cur.nu, nv2 = alongU ? cur.nv : count; const cps: V3[] = [], w: number[] = [];
    for (let j = 0; j < nv2; j++) for (let i = 0; i < nu2; i++) { const idx = alongU ? j * cur.nu + from + i : (from + j) * cur.nu + i; cps.push(cur.cps[idx]); w.push(cur.weights?.[idx] ?? 1); }
    const kk = K.slice(from, from + count + p + 1); kk[0] = kk[1]; for (let i = 0; i <= p; i++) { kk[i] = kk[p]; kk[kk.length - 1 - i] = kk[kk.length - 1 - p]; }
    const lo = kk[0], hi = kk[kk.length - 1]; const kn = kk.map(x => (x - lo) / ((hi - lo) || 1));
    return { ...cur, nu: nu2, nv: nv2, cps, weights: w, knotsU: alongU ? kn : cur.knotsU, knotsV: alongU ? cur.knotsV : kn }; };
  return [take(0, nA), take(nA - 1, n - nA + 1)];
}
/** Build a NURBS surface from rows of control points (each row = one curve's CVs) with clamped uniform knots across the rows. */
export function surfFromRows(rows: V3[][], degU: number, degV: number, closedU = false, closedV = false, weights?: number[]): NurbsSurface {
  const nu = rows[0].length, nv = rows.length; const cps: V3[] = []; for (const r of rows) for (let i = 0; i < nu; i++) cps.push(r[i] ?? r[r.length - 1]);
  const dU = Math.max(1, Math.min(degU, nu - 1)), dV = Math.max(1, Math.min(degV, nv - 1));
  const s: NurbsSurface = { nu, nv, degU: dU, degV: dV, closedU, closedV, cps }; if (!closedU && !closedV) { s.knotsU = clampedKnots(nu, dU); s.knotsV = clampedKnots(nv, dV); if (weights) s.weights = weights; }
  return s;
}
/** Rational circle control polygon (9 CVs, degree 2, weights √2/2 at the corners) around `axis` through `center` at `radius`,
 *  for exact NURBS revolutions. Returns points and weights plus the knot vector. */
export function circleCVs(center: V3, radius: number, axis: V3, start: V3, angleDeg = 360): { pts: V3[]; w: number[]; knots: number[] } {
  const a = norm(axis); const x = norm(sub(start, mul(a, dot(start, a)))); const y = cross(a, x); const r2 = Math.SQRT1_2;
  const segs = Math.max(1, Math.ceil(Math.abs(angleDeg) / 90)); const step = angleDeg / segs * Math.PI / 180; const pts: V3[] = [], w: number[] = [];
  for (let i = 0; i <= segs; i++) { const t = i * step; const dir = add(mul(x, Math.cos(t)), mul(y, Math.sin(t))); if (i > 0) { const tm = t - step / 2; const dm = add(mul(x, Math.cos(tm)), mul(y, Math.sin(tm))); pts.push(add(center, mul(dm, radius / Math.cos(step / 2)))); w.push(Math.cos(step / 2)); } pts.push(add(center, mul(dir, radius))); w.push(1); }
  const knots = [0, 0, 0]; for (let i = 1; i < segs; i++) knots.push(i / segs, i / segs); knots.push(1, 1, 1); void r2; return { pts, w, knots };
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];


// ----------------------------------------------------------------- NURBS generators (Create > Surf. Mesh)
/** Rows of control points for a curve, as (points, weights, knots, degree). Closed curves are unrolled so the row has a knot vector. */
function curveRow(c: CurveData, n?: number): { pts: V3[]; w: number[]; knots: number[]; degree: number; closed: boolean } {
  if (n !== undefined && n !== c.cvs.length) { const fit = makeCurve(sampleCurve(c, n, !c.closed), Math.min(3, n - 1), c.closed); return curveRow(fit); }
  if (c.closed) return { pts: c.cvs.map(q => [q[0], q[1], q[2]] as V3), w: c.cvs.map(q => q[3] || 1), knots: [], degree: c.degree, closed: true };
  const [k0, k1] = [c.knots[0], c.knots[c.knots.length - 1]]; return { pts: c.cvs.map(q => [q[0], q[1], q[2]] as V3), w: c.cvs.map(q => q[3] || 1), knots: c.knots.map(k => (k - k0) / ((k1 - k0) || 1)), degree: c.degree, closed: false };
}
function assemble(rows: { pts: V3[]; w: number[] }[], degU: number, knotsU: number[] | undefined, closedU: boolean, degV: number, knotsV?: number[], closedV = false, rowW?: number[]): NurbsSurface {
  const nu = rows[0].pts.length, nv = rows.length; const cps: V3[] = [], w: number[] = [];
  rows.forEach((r, j) => { for (let i = 0; i < nu; i++) { cps.push(r.pts[i] ?? r.pts[r.pts.length - 1]); w.push((r.w[i] ?? 1) * (rowW?.[j] ?? 1)); } });
  const dU = Math.max(1, Math.min(degU, nu - 1)), dV = Math.max(1, Math.min(degV, nv - 1));
  const out: NurbsSurface = { nu, nv, degU: dU, degV: dV, closedU, closedV, cps };
  if (!closedU && !closedV) { out.knotsU = knotsU && knotsU.length === nu + dU + 1 ? knotsU : clampedKnots(nu, dU); out.knotsV = knotsV && knotsV.length === nv + dV + 1 ? knotsV : clampedKnots(nv, dV); if (w.some(x => Math.abs(x - 1) > 1e-9)) out.weights = w; }
  return out;
}
/** Loft: the curves' CVs become the rows of the surface (U = along the curves, V = across them). */
export function loftNurbs(curves: CurveData[], opts: { startScale?: number; endScale?: number; closeV?: boolean; degV?: number } = {}): NurbsSurface {
  const n = Math.max(...curves.map(c => c.cvs.length)); const rows = curves.map(c => curveRow(c, n));
  const sc = (j: number) => { const t = curves.length > 1 ? j / (curves.length - 1) : 0; return (opts.startScale ?? 1) * (1 - t) + (opts.endScale ?? 1) * t; };
  const scaled = rows.map((r, j) => { const k = sc(j); if (Math.abs(k - 1) < 1e-9) return r; let c: V3 = [0, 0, 0]; for (const q of r.pts) c = add(c, q); c = mul(c, 1 / r.pts.length); return { ...r, pts: r.pts.map(q => add(c, mul(sub(q, c), k))) }; });
  return assemble(scaled, rows[0].degree, rows[0].knots, rows[0].closed, opts.degV ?? 3, undefined, !!opts.closeV);
}
/** Extrusion along an axis: profile CVs copied along `axis` (V is linear, `rows` segments). */
export function extrudeNurbs(profile: CurveData, axis: V3, length: number, rows = 1, startPos = 0, fromCenter = false): NurbsSurface {
  const r = curveRow(profile); const a = norm(axis); const base = fromCenter ? startPos - length / 2 : startPos; const out: { pts: V3[]; w: number[] }[] = [];
  for (let j = 0; j <= Math.max(1, rows); j++) { const d = base + length * j / Math.max(1, rows); out.push({ pts: r.pts.map(p => add(p, mul(a, d))), w: r.w }); }
  return assemble(out, r.degree, r.knots, r.closed, 1);
}
/** Revolution: exact rational circles (degree 2, 9 CVs for 360°) swept around `axis` through `origin`; U = profile, V = angle. */
export function revolveNurbs(profile: CurveData, axis: V3, angleDeg = 360, startDeg = 0, origin: V3 = [0, 0, 0]): NurbsSurface {
  const r = curveRow(profile); const a = norm(axis); const full = Math.abs(angleDeg) >= 359.999; const segs = Math.max(1, Math.ceil(Math.abs(angleDeg) / 90)); const step = angleDeg / segs * Math.PI / 180; const s0 = startDeg * Math.PI / 180;
  const rot = (p: V3, ang: number): V3 => { const c = Math.cos(ang), sn = Math.sin(ang); const d = dot(a, sub(p, origin)); const q = sub(p, origin); return add(origin, add(add(mul(q, c), mul(cross(a, q), sn)), mul(a, d * (1 - c)))); };
  const rows: { pts: V3[]; w: number[] }[] = []; const rowW: number[] = []; const knotsV = [0, 0, 0];
  for (let i = 0; i <= segs; i++) {
    const t = s0 + i * step; if (i > 0) { const tm = t - step / 2; const cw = Math.cos(step / 2); rows.push({ pts: r.pts.map(p => { const q = rot(p, tm); const d = dot(a, sub(q, origin)); const radial = sub(sub(q, origin), mul(a, d)); return add(add(origin, mul(a, d)), mul(radial, 1 / cw)); }), w: r.w }); rowW.push(cw); }
    rows.push({ pts: r.pts.map(p => rot(p, t)), w: r.w }); rowW.push(1); if (i > 0 && i < segs) knotsV.push(i / segs, i / segs);
  }
  knotsV.push(1, 1, 1);
  const out = assemble(rows, r.degree, r.knots, r.closed, 2, knotsV, false, rowW);
  if (full) out.seamV = true; // exact rational circle; the last row coincides with the first, so tessellate without a seam
  return out;
}
/** Extrusion along a curve: the profile's CVs are carried along the path with a parallel-transport frame (`rows` sections). */
export function sweepNurbs(profile: CurveData, path: CurveData, rows = 10, snapToPath = true, alignToPath = true): NurbsSurface {
  const r = curveRow(profile); const pathPts = sampleCurve(path, Math.max(2, rows + 1));
  let c: V3 = [0, 0, 0]; for (const q of r.pts) c = add(c, q); c = mul(c, 1 / r.pts.length); const origin = snapToPath ? c : pathPts[0]; const local = r.pts.map(q => sub(q, origin));
  let up: V3 = [0, 1, 0]; const t0 = norm(sub(pathPts[1], pathPts[0])); if (Math.abs(t0[1]) > 0.99) up = [1, 0, 0];
  // the profile's own frame (normal = best plane normal, so a profile drawn in XY sweeps as expected)
  let pn: V3 = [0, 0, 1]; if (local.length >= 3) { let nn: V3 = [0, 0, 0]; for (let i = 1; i + 1 < local.length; i++) nn = add(nn, cross(sub(local[i], local[0]), sub(local[i + 1], local[0]))); if (len(nn) > 1e-9) pn = norm(nn); }
  const px = norm(sub(local.find(q => len(sub(q, mul(pn, dot(q, pn)))) > 1e-9) ?? [1, 0, 0], mul(pn, dot(local.find(q => len(sub(q, mul(pn, dot(q, pn)))) > 1e-9) ?? [1, 0, 0], pn)))), py = cross(pn, px);
  const out: { pts: V3[]; w: number[] }[] = [];
  pathPts.forEach((p, i) => { const t = norm(sub(pathPts[Math.min(i + 1, pathPts.length - 1)], pathPts[Math.max(i - 1, 0)])); const x = norm(cross(up, t)), y = cross(t, x); up = y;
    out.push({ pts: local.map(l => alignToPath ? add(p, add(mul(x, dot(l, px)), add(mul(y, dot(l, py)), mul(t, dot(l, pn))))) : add(p, l)), w: r.w }); });
  return assemble(out, r.degree, r.knots, r.closed, 3);
}
/** Birail: profile CVs carried between the two rails (`rows` sections). */
export function birailNurbs(profile: CurveData, rail1: CurveData, rail2: CurveData, rows = 10): NurbsSurface {
  const r = curveRow(profile); const r1 = sampleCurve(rail1, rows + 1), r2 = sampleCurve(rail2, rows + 1); const p0 = r.pts[0], p1 = r.pts[r.pts.length - 1]; const n = r.pts.length;
  const out: { pts: V3[]; w: number[] }[] = [];
  for (let j = 0; j <= rows; j++) { const a = r1[j], b = r2[j]; out.push({ pts: r.pts.map((q, i) => { const t = n > 1 ? i / (n - 1) : 0; const base = add(p0, mul(sub(p1, p0), t)); const span = add(a, mul(sub(b, a), t)); const k = len(sub(p1, p0)) > 1e-9 ? len(sub(b, a)) / len(sub(p1, p0)) : 1; return add(span, mul(sub(q, base), k)); }), w: r.w }); }
  return assemble(out, r.degree, r.knots, false, 3);
}
/** Grid of sampled points → cubic NURBS (Four-Sided Coons patch, Curve Net Gordon surface). */
export function gridNurbs(f: (u: number, v: number) => V3, nu: number, nv: number): NurbsSurface {
  const rows: { pts: V3[]; w: number[] }[] = []; for (let j = 0; j < nv; j++) { const pts: V3[] = []; for (let i = 0; i < nu; i++) pts.push(f(i / (nu - 1), j / (nv - 1))); rows.push({ pts, w: pts.map(() => 1) }); }
  return assemble(rows, 3, undefined, false, 3);
}
/** Curve Net: Gordon surface through two families of curves (u-curves lofted + v-curves lofted − their bilinear blend). */
export function curveNetFn(ucurves: CurveData[], vcurves: CurveData[]): (u: number, v: number) => V3 {
  const U = ucurves.map(c => sampleCurve(c, 33)), W = vcurves.map(c => sampleCurve(c, 33)); const at = (pts: V3[], t: number) => pts[Math.max(0, Math.min(32, Math.round(t * 32)))];
  const lerpRows = (rows: V3[][], t: number, s: number): V3 => { if (rows.length === 1) return at(rows[0], s); const x = t * (rows.length - 1); const i = Math.min(rows.length - 2, Math.floor(x)); const a = x - i; return add(mul(at(rows[i], s), 1 - a), mul(at(rows[i + 1], s), a)); };
  if (!W.length) return (u, v) => lerpRows(U, v, u);
  return (u, v) => { const A = lerpRows(U, v, u), B = lerpRows(W, u, v); // bilinear through the corner intersections
    const c00 = at(U[0], 0), c10 = at(U[0], 1), c01 = at(U[U.length - 1], 0), c11 = at(U[U.length - 1], 1);
    const bl = add(add(mul(c00, (1 - u) * (1 - v)), mul(c10, u * (1 - v))), add(mul(c01, (1 - u) * v), mul(c11, u * v))); return sub(add(A, B), bl); };
}
void unrollClosed;
