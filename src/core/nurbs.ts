// NURBS surface meshes as control-point grids (Softimage "Surf. Mesh" objects), with the Modify > Surf. Mesh and
// Create > Surf. Mesh operators: Open/Close, Snip, Extend to Curve, Stitch, Snap Boundary, Fit, Fillet, Trim.
// Surfaces are evaluated as uniform B-splines of the stored degree and tessellated to MeshData; the grid rides along on
// the mesh as `mesh.nurbs` so later operators keep editing control points rather than triangles.
import { MeshData } from './geometry';
import { fromPolys, slicePolygonsPlane } from './topology';
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
/** Finite-difference partials ∂S/∂u, ∂S/∂v at (u,v) ∈ [0,1]. */
export function surfPartials(s: NurbsSurface, u: number, v: number, e = 1e-4): { Su: V3; Sv: V3; p: V3 } {
  const clamp = (t: number) => Math.min(1, Math.max(0, t));
  const p = evalSurf(s, clamp(u), clamp(v));
  const Su = mul(sub(evalSurf(s, clamp(u + e), clamp(v)), evalSurf(s, clamp(u - e), clamp(v))), 1 / (2 * e));
  const Sv = mul(sub(evalSurf(s, clamp(u), clamp(v + e)), evalSurf(s, clamp(u), clamp(v - e))), 1 / (2 * e));
  return { Su, Sv, p };
}
/** Closest surface point: coarse UV grid, then Newton on |S(u,v)−p|² (Softimage Snap/Stitch/Fillet all depend on this). */
export function closestPointOnSurf(s: NurbsSurface, p: V3, steps = 24): { u: number; v: number; p: V3 } {
  let best = { u: 0, v: 0, p: evalSurf(s, 0, 0) }, bd = Infinity;
  for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) {
    const q = evalSurf(s, i / steps, j / steps); const d = dist(q, p);
    if (d < bd) { bd = d; best = { u: i / steps, v: j / steps, p: q }; }
  }
  let u = best.u, v = best.v;
  for (let iter = 0; iter < 12; iter++) {
    const { Su, Sv, p: q } = surfPartials(s, u, v); const r = sub(q, p);
    const a = Su[0] * Su[0] + Su[1] * Su[1] + Su[2] * Su[2];
    const b = Su[0] * Sv[0] + Su[1] * Sv[1] + Su[2] * Sv[2];
    const c = Sv[0] * Sv[0] + Sv[1] * Sv[1] + Sv[2] * Sv[2];
    const d1 = Su[0] * r[0] + Su[1] * r[1] + Su[2] * r[2];
    const d2 = Sv[0] * r[0] + Sv[1] * r[1] + Sv[2] * r[2];
    const det = a * c - b * b; if (Math.abs(det) < 1e-14) break;
    const du = (b * d2 - c * d1) / det, dv = (b * d1 - a * d2) / det;
    u = Math.min(1, Math.max(0, u + du)); v = Math.min(1, Math.max(0, v + dv));
    if (du * du + dv * dv < 1e-12) break;
  }
  const q = evalSurf(s, u, v); return { u, v, p: q };
}
export function surfNormal(s: NurbsSurface, u: number, v: number): V3 { const { Su, Sv } = surfPartials(s, u, v); return norm(cross(Su, Sv)); }
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
/** Fit a new cubic NURBS grid (nu x nv) over a surface or a polygon mesh by least squares (Create > Surf. Mesh > Fit):
 *  the data points are parametrised on an initial grid (the source surface, or a height-field over the mesh's bounding
 *  box) and the control points solve min Σ|S(u_k,v_k) − P_k|². */
export function fitSurface(src: NMesh, nu: number, nv: number): NurbsSurface {
  nu = Math.max(4, nu | 0); nv = Math.max(4, nv | 0); const s0 = surfOf(src);
  const data: { u: number; v: number; p: V3 }[] = [];
  if (s0 && src.nurbs) { const n = 12; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) data.push({ u: i / n, v: j / n, p: evalSurf(s0, i / n, j / n) }); }
  else { // parametrise mesh points by their XZ position in the bounding box
    const P = src.positions; let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity; for (let k = 0; k < P.length; k += 3) { minx = Math.min(minx, P[k]); maxx = Math.max(maxx, P[k]); minz = Math.min(minz, P[k + 2]); maxz = Math.max(maxz, P[k + 2]); }
    for (let k = 0; k < P.length; k += 3) data.push({ u: (P[k] - minx) / ((maxx - minx) || 1), v: (P[k + 2] - minz) / ((maxz - minz) || 1), p: [P[k], P[k + 1], P[k + 2]] });
  }
  const closedU = !!s0?.closedU && !!src.nurbs, closedV = !!s0?.closedV && !!src.nurbs;
  const out: NurbsSurface = { nu, nv, degU: 3, degV: 3, closedU, closedV, cps: [] }; if (!closedU && !closedV) { out.knotsU = clampedKnots(nu, 3); out.knotsV = clampedKnots(nv, 3); }
  const U = out.knotsU ?? [], V = out.knotsV ?? []; const N = nu * nv;
  // basis matrix rows
  const rows: { idx: number[]; w: number[] }[] = data.map(d => {
    if (closedU || closedV) { // uniform periodic fallback: nearest-grid blend (bilinear hat on the control grid)
      const fu = d.u * (closedU ? nu : nu - 1), fv = d.v * (closedV ? nv : nv - 1); const i0 = Math.floor(fu), j0 = Math.floor(fv), a = fu - i0, b = fv - j0; const idx: number[] = [], w: number[] = [];
      for (const [di, dj, ww] of [[0, 0, (1 - a) * (1 - b)], [1, 0, a * (1 - b)], [0, 1, (1 - a) * b], [1, 1, a * b]] as [number, number, number][]) { const ii = closedU ? (i0 + di) % nu : Math.min(nu - 1, i0 + di), jj = closedV ? (j0 + dj) % nv : Math.min(nv - 1, j0 + dj); idx.push(jj * nu + ii); w.push(ww); } return { idx, w };
    }
    const uu = Math.min(1 - 1e-9, d.u), vv = Math.min(1 - 1e-9, d.v); const su = findSpan(nu, 3, uu, U), sv = findSpan(nv, 3, vv, V); const Nu = basisFuns(su, uu, 3, U), Nv = basisFuns(sv, vv, 3, V); const idx: number[] = [], w: number[] = [];
    for (let l = 0; l <= 3; l++) for (let k = 0; k <= 3; k++) { idx.push((sv - 3 + l) * nu + (su - 3 + k)); w.push(Nu[k] * Nv[l]); } return { idx, w };
  });
  // normal equations (A^T A + λI) x = A^T b, small ridge for unsupported control points
  const A = Array.from({ length: N }, () => new Float64Array(N)); const B = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
  data.forEach((d, r) => { const { idx, w } = rows[r]; for (let a = 0; a < idx.length; a++) { for (let b = 0; b < idx.length; b++) A[idx[a]][idx[b]] += w[a] * w[b]; for (let x = 0; x < 3; x++) B[x][idx[a]] += w[a] * d.p[x]; } });
  // ridge toward the bilinear interpolation of the corner data so empty regions stay sane
  const corner = (i: number, j: number): V3 => { const u = i / (nu - 1), v = j / (nv - 1); let best = data[0], bd = Infinity; for (const d of data) { const dd = (d.u - u) ** 2 + (d.v - v) ** 2; if (dd < bd) { bd = dd; best = d; } } return best.p; };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * nu + i; const c = corner(i, j); A[k][k] += 1e-3; for (let x = 0; x < 3; x++) B[x][k] += 1e-3 * c[x]; }
  const X = solveSPD(A, B); for (let k = 0; k < N; k++) out.cps.push([X[0][k], X[1][k], X[2][k]]);
  return out;
}
/** Gaussian elimination with partial pivoting for several right-hand sides. */
function solveSPD(A: Float64Array[], B: Float64Array[]): Float64Array[] {
  const n = A.length; const M = A.map(r => Float64Array.from(r)); const R = B.map(r => Float64Array.from(r));
  for (let c = 0; c < n; c++) { let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; if (piv !== c) { [M[c], M[piv]] = [M[piv], M[c]]; for (const b of R) { const t = b[c]; b[c] = b[piv]; b[piv] = t; } }
    const d = M[c][c] || 1e-12; for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (!f) continue; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; for (const b of R) b[r] -= f * b[c]; } }
  const X = R.map(() => new Float64Array(n));
  for (let x = 0; x < R.length; x++) for (let r = n - 1; r >= 0; r--) { let sum = R[x][r]; for (let k = r + 1; k < n; k++) sum -= M[r][k] * X[x][k]; X[x][r] = sum / (M[r][r] || 1e-12); }
  return X;
}
/** Fillet between two surfaces (rolling-ball): along their approximate intersection a ball of `radius` tangent to
 *  both surfaces sweeps an arc from its contact point on A to its contact point on B, so the strip is G1 to both.
 *  The arcs are exact rational quadratics (one 3-CV rational Bezier each). */
export function filletSurfaces(a: NurbsSurface, b: NurbsSurface, radius: number, sections = 12, arcs = 5): NurbsSurface | null {
  const samples: { p: V3; q: V3; na: V3; nb: V3 }[] = []; const steps = 24;
  for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) { const u = i / steps, v = j / steps; const p = evalSurf(a, u, v); const c = closestPointOnSurf(b, p, 16); if (dist(p, c.p) < radius * 1.5) samples.push({ p, q: c.p, na: surfNormal(a, u, v), nb: surfNormal(b, c.u, c.v) }); }
  if (samples.length < 2) return null;
  const axis = [0, 1, 2].map(k => { const vals = samples.map(s => s.p[k]); return Math.max(...vals) - Math.min(...vals); }); const ax = axis.indexOf(Math.max(...axis)); samples.sort((x, y) => x.p[ax] - y.p[ax]);
  const picked: typeof samples = []; for (let k = 0; k < sections; k++) picked.push(samples[Math.min(samples.length - 1, Math.round(k * (samples.length - 1) / Math.max(1, sections - 1)))]);
  // per section: ball centre C with dist r to both tangent planes; contacts Ta = C - r·na, Tb = C - r·nb; arc Ta→Tb about C
  const rows: V3[][] = Array.from({ length: 3 }, () => []); const rowW = [1, 0, 1];
  for (const s of picked) {
    let na = s.na, nb = s.nb; const x = mul(add(s.p, s.q), 0.5); // make both normals point to the same side (the side of the other surface's far point)
    if (dot(na, nb) < 0) nb = mul(nb, -1); const half = Math.acos(Math.max(-1, Math.min(1, dot(na, nb)))) / 2; const bis = norm(add(na, nb)); const C = add(x, mul(bis, radius / Math.max(0.2, Math.cos(half))));
    const Ta = sub(C, mul(na, radius)), Tb = sub(C, mul(nb, radius)); const da = norm(sub(Ta, C)), db = norm(sub(Tb, C)); const ang = Math.acos(Math.max(-1, Math.min(1, dot(da, db))));
    const w = Math.cos(ang / 2); const mid = add(C, mul(norm(add(da, db)), radius / Math.max(w, 0.05))); // rational quadratic middle CV (weight cos(θ/2)) → exact arc
    rows[0].push(Ta); rows[1].push(mid); rows[2].push(Tb); rowW[1] = w;
  }
  const nu = picked.length; const cps: V3[] = [], weights: number[] = []; for (let j = 0; j < 3; j++) for (let i = 0; i < nu; i++) { cps.push(rows[j][i]); weights.push(rowW[j]); }
  void arcs; return { nu, nv: 3, degU: 3, degV: 2, closedU: false, closedV: false, cps, weights, knotsU: clampedKnots(nu, Math.min(3, nu - 1)), knotsV: [0, 0, 0, 1, 1, 1] };
}
/** Reverse the surface's U or V direction, or swap them (Modify > Surf. Mesh > Inverse). */
export function inverseSurf(s: NurbsSurface, flipU = true, flipV = false, swap = false): NurbsSurface {
  const o = cloneSurf(s); const get = (i: number, j: number) => s.cps[j * s.nu + i], w = (i: number, j: number) => s.weights?.[j * s.nu + i] ?? 1;
  const cps: V3[] = [], ws: number[] = [];
  if (swap) { o.nu = s.nv; o.nv = s.nu; o.degU = s.degV; o.degV = s.degU; o.closedU = s.closedV; o.closedV = s.closedU; o.knotsU = s.knotsV?.slice(); o.knotsV = s.knotsU?.slice(); for (let j = 0; j < o.nv; j++) for (let i = 0; i < o.nu; i++) { cps.push(get(j, i)); ws.push(w(j, i)); } }
  else for (let j = 0; j < s.nv; j++) for (let i = 0; i < s.nu; i++) { const ii = flipU ? s.nu - 1 - i : i, jj = flipV ? s.nv - 1 - j : j; cps.push(get(ii, jj)); ws.push(w(ii, jj)); }
  o.cps = cps; if (s.weights) o.weights = ws; if (!swap) { if (flipU && o.knotsU) { const K = o.knotsU; const lo = K[0], hi = K[K.length - 1]; o.knotsU = K.slice().reverse().map(k => lo + hi - k); } if (flipV && o.knotsV) { const K = o.knotsV; const lo = K[0], hi = K[K.length - 1]; o.knotsV = K.slice().reverse().map(k => lo + hi - k); } }
  return o;
}
/** Trim by Projection: the tessellated surface is cut along the projected trim curve (so the boundary follows the curve
 *  exactly) and the polygons on the discarded side are removed. */
export function applyTrims(m: NMesh): NMesh {
  if (!m.trims?.length) return m;
  const inside = (x: number, y: number, poly: [number, number][]) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  const uv = (axis: number, p: number[]): [number, number] => axis === 0 ? [p[1], p[2]] : axis === 1 ? [p[0], p[2]] : [p[0], p[1]];
  let cur: MeshData = m;
  for (const t of m.trims) {
    for (let k = 0; k < t.poly.length; k++) { // cut along each segment of the projected curve
      const a = t.poly[k], b = t.poly[(k + 1) % t.poly.length]; const d = [b[0] - a[0], b[1] - a[1]]; const L = Math.hypot(d[0], d[1]); if (L < 1e-9) continue;
      const n2 = [-d[1] / L, d[0] / L]; const nrm: V3 = t.axis === 0 ? [0, n2[0], n2[1]] : t.axis === 1 ? [n2[0], 0, n2[1]] : [n2[0], n2[1], 0]; const dd = n2[0] * a[0] + n2[1] * a[1];
      const lo = [Math.min(a[0], b[0]) - 1e-6, Math.min(a[1], b[1]) - 1e-6], hi = [Math.max(a[0], b[0]) + 1e-6, Math.max(a[1], b[1]) + 1e-6];
      const idx: number[] = []; cur.polygons.forEach((f, pi) => { let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity; for (const v of f) { const [x, y] = uv(t.axis, [cur.positions[v * 3], cur.positions[v * 3 + 1], cur.positions[v * 3 + 2]]); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); } if (bx1 >= lo[0] && bx0 <= hi[0] && by1 >= lo[1] && by0 <= hi[1]) idx.push(pi); });
      if (idx.length) cur = slicePolygonsPlane(cur, { kind: 'polygon', indices: idx }, nrm, dd);
    }
  }
  const keep: number[][] = [];
  for (const f of cur.polygons) { const c = [0, 0, 0]; for (const v of f) for (let k = 0; k < 3; k++) c[k] += cur.positions[v * 3 + k] / f.length; let drop = false; for (const t of m.trims) { const [x, y] = uv(t.axis, c); if (inside(x, y, t.poly) !== t.keepInside) drop = true; } if (!drop) keep.push(f); }
  const verts: V3[] = []; for (let k = 0; k < cur.positions.length; k += 3) verts.push([cur.positions[k], cur.positions[k + 1], cur.positions[k + 2]]);
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
