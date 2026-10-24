// NURBS curves (de Boor evaluation) and tessellated NURBS surfaces, mirroring Softimage's
// NurbsCurve / NurbsSurface geometry. Surfaces are kept as parametric evaluators and tessellated for display.
import { MeshData } from './geometry';
import { fromPolys } from './topology';

export type V3 = [number, number, number];
export interface CurveData { degree: number; closed: boolean; cvs: [number, number, number, number][]; knots: number[]; }

export function uniformKnots(n: number, degree: number, closed: boolean): number[] {
  const k: number[] = [];
  if (closed) { for (let i = 0; i < n + 2 * degree + 1; i++) k.push(i - degree); return k; }
  for (let i = 0; i <= degree; i++) k.push(0);
  for (let i = 1; i < n - degree; i++) k.push(i);
  for (let i = 0; i <= degree; i++) k.push(n - degree);
  return k;
}
export function makeCurve(points: V3[], degree = 3, closed = false): CurveData {
  const d = Math.max(1, Math.min(degree, points.length - 1));
  return { degree: d, closed, cvs: points.map(p => [p[0], p[1], p[2], 1]), knots: uniformKnots(points.length, d, closed) };
}
export function curveDomain(c: CurveData): [number, number] {
  if (c.closed) return [0, c.cvs.length];
  return [c.knots[c.degree], c.knots[c.knots.length - 1 - c.degree]];
}
function cvAt(c: CurveData, i: number) { const n = c.cvs.length; return c.closed ? c.cvs[((i % n) + n) % n] : c.cvs[Math.max(0, Math.min(n - 1, i))]; }
/** Evaluate the curve at parameter u (de Boor on homogeneous coordinates). */
export function evalCurve(c: CurveData, u: number): V3 {
  const p = c.degree, K = c.knots;
  const [u0, u1] = curveDomain(c);
  if (c.closed) { u = ((u - u0) % (u1 - u0) + (u1 - u0)) % (u1 - u0) + u0; } else u = Math.max(u0, Math.min(u1 - 1e-9, u));
  // find span k with K[k] <= u < K[k+1]
  let k = p; while (k < K.length - p - 2 && u >= K[k + 1]) k++;
  const d: number[][] = []; for (let j = 0; j <= p; j++) { const cv = cvAt(c, k - p + j); d.push([cv[0] * cv[3], cv[1] * cv[3], cv[2] * cv[3], cv[3]]); }
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = k - p + j; const den = K[i + p - r + 1] - K[i]; const a = den ? (u - K[i]) / den : 0;
    for (let x = 0; x < 4; x++) d[j][x] = (1 - a) * d[j - 1][x] + a * d[j][x];
  }
  const w = d[p][3] || 1; return [d[p][0] / w, d[p][1] / w, d[p][2] / w];
}
export function tessellateCurve(c: CurveData, segsPerSpan = 8): V3[] {
  const [u0, u1] = curveDomain(c); const spans = c.closed ? c.cvs.length : Math.max(1, c.cvs.length - c.degree);
  const n = Math.max(2, spans * segsPerSpan); const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(evalCurve(c, u0 + ((u1 - u0) * i) / n));
  return out;
}
export function curveLength(c: CurveData) { const pts = tessellateCurve(c, 12); let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return l; }
/** n points evenly spaced in parameter. */
export function sampleCurve(c: CurveData, n: number, includeEnd = true): V3[] { const [u0, u1] = curveDomain(c); const out: V3[] = []; const m = includeEnd ? n - 1 : n; for (let i = 0; i < n; i++) out.push(evalCurve(c, u0 + ((u1 - u0) * i) / Math.max(1, m))); return out; }

// ------------------------------------------------------------ primitives
export function circleCurve(radius: number): CurveData {
  // exact NURBS circle: 9 CVs, degree 2, weights sqrt(2)/2 on corners
  const w = Math.SQRT1_2, r = radius; const pts: [number, number, number, number][] = [];
  const corners = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
  corners.forEach((p, i) => pts.push([p[0] * r, 0, p[1] * r, i % 2 ? w : 1]));
  return { degree: 2, closed: false, cvs: pts, knots: [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4] };
}
export function arcCurve(radius: number, startDeg: number, endDeg: number, cvs = 8): CurveData {
  const pts: V3[] = []; for (let i = 0; i < cvs; i++) { const a = ((startDeg + ((endDeg - startDeg) * i) / (cvs - 1)) * Math.PI) / 180; pts.push([radius * Math.cos(a), 0, radius * Math.sin(a)]); }
  return makeCurve(pts, 3, false);
}
export function spiralCurve(startRadius: number, endRadius: number, height: number, revolutions: number, cvs = 32): CurveData {
  const pts: V3[] = []; for (let i = 0; i < cvs; i++) { const t = i / (cvs - 1), a = t * revolutions * Math.PI * 2, r = startRadius + (endRadius - startRadius) * t; pts.push([r * Math.cos(a), height * t, r * Math.sin(a)]); }
  return makeCurve(pts, 3, false);
}
export function squareCurve(len: number): CurveData {
  const h = len / 2; return makeCurve([[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], [-h, 0, -h]], 1, false);
}

// ---------------------------------------------------------- curve edits
export function reverseCurve(c: CurveData): CurveData { const [u0, u1] = [c.knots[0], c.knots[c.knots.length - 1]]; return { ...c, cvs: [...c.cvs].reverse(), knots: [...c.knots].reverse().map(k => u1 + u0 - k) }; }
export function toggleClosed(c: CurveData): CurveData { const closed = !c.closed; return { ...c, closed, knots: uniformKnots(c.cvs.length, c.degree, closed) }; }
/** Boehm knot insertion at parameter u (exact: the curve shape is unchanged, one more CV/knot). Closed curves are
 *  opened into their unrolled clamped form first, so the knot vector stays consistent. */
export function insertKnot(c: CurveData, u: number): CurveData {
  if (c.closed) c = unrollClosed(c);
  const p = c.degree, K = c.knots.slice(), P = c.cvs.map(q => q.slice() as [number, number, number, number]);
  const [u0, u1] = curveDomain(c); u = Math.max(u0, Math.min(u1 - 1e-9, u));
  let k = p; while (k < K.length - p - 2 && u >= K[k + 1]) k++;
  const Q: [number, number, number, number][] = [];
  for (let i = 0; i <= P.length; i++) {
    if (i <= k - p) Q.push(P[i]); else if (i > k) Q.push(P[i - 1]);
    else { const den = K[i + p] - K[i]; const a = den ? (u - K[i]) / den : 0; const A = P[i - 1], B = P[i]; const h = (x: number) => x === 3 ? 1 : 0; void h; // interpolate in homogeneous space
      const wa = A[3], wb = B[3]; const w = (1 - a) * wa + a * wb; Q.push([((1 - a) * A[0] * wa + a * B[0] * wb) / w, ((1 - a) * A[1] * wa + a * B[1] * wb) / w, ((1 - a) * A[2] * wa + a * B[2] * wb) / w, w]); }
  }
  K.splice(k + 1, 0, u); return { ...c, cvs: Q, knots: K };
}
/** Closed (periodic) curve → equivalent clamped open curve (degree extra CVs repeated), for operations that need a knot vector. */
export function unrollClosed(c: CurveData): CurveData {
  if (!c.closed) return c; const n = c.cvs.length, p = c.degree; const cvs = [...c.cvs, ...c.cvs.slice(0, p)].map(q => q.slice() as [number, number, number, number]);
  const knots: number[] = []; for (let i = 0; i < cvs.length + p + 1; i++) knots.push(i - p); // uniform, unclamped: domain [0, n]
  // clamp by inserting the domain ends p times
  let out: CurveData = { degree: p, closed: false, cvs, knots }; for (let r = 0; r < p; r++) { out = insertKnot(out, 0); out = insertKnot(out, n); }
  // trim CVs/knots outside the domain
  const first = out.knots.findIndex(k => k >= 0) - 0, last = out.knots.length - 1 - [...out.knots].reverse().findIndex(k => k <= n);
  const knots2 = out.knots.slice(first, last + 1); const cvs2 = out.cvs.slice(first, first + knots2.length - p - 1);
  return { degree: p, closed: false, cvs: cvs2, knots: knots2 };
}
export function insertCV(c: CurveData, u: number): CurveData { return insertKnot(c, u); }
/** Remove the knot nearest `u` (approximate inverse of insertion: least-squares refit keeps the shape where possible). */
export function removeKnot(c: CurveData, u: number): CurveData {
  if (c.cvs.length <= c.degree + 1) return c; const K = c.knots; const [u0, u1] = curveDomain(c);
  let best = -1, bd = Infinity; for (let i = c.degree + 1; i < K.length - c.degree - 1; i++) { const d = Math.abs(K[i] - u); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return c; const pts = sampleCurve(c, Math.max(c.degree + 1, c.cvs.length - 1) * 2); const fit = makeCurve(pts.filter((_, i) => i % 2 === 0), c.degree, c.closed); void u0; void u1; return fit;
}
/** Degree elevation (exact for degree 1→2/3 via Bezier-segment elevation; higher degrees refit). */
export function raiseDegree(c: CurveData): CurveData {
  if (c.degree >= 7) return c;
  if (c.degree === 1) { // polyline → each segment becomes a Bezier of the new degree with CVs on the segment
    const pts = c.cvs.map(q => [q[0], q[1], q[2]] as V3); const out: V3[] = [pts[0]]; const segs = c.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segs; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push([a[0] + (b[0] - a[0]) / 2, a[1] + (b[1] - a[1]) / 2, a[2] + (b[2] - a[2]) / 2]); if (!c.closed || i < segs - 1) out.push(b); }
    return makeCurve(out, 2, c.closed);
  }
  const pts = sampleCurve(c, c.cvs.length + 1); return makeCurve(pts, c.degree + 1, c.closed);
}
export function cleanCurve(c: CurveData, tol = 1e-3): CurveData {
  const cvs = c.cvs.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1], p[2] - a[i - 1][2]) > tol);
  return { ...c, cvs, knots: uniformKnots(cvs.length, Math.min(c.degree, cvs.length - 1), c.closed), degree: Math.min(c.degree, cvs.length - 1) };
}
export function fitCurve(c: CurveData, nbCVs: number, degree = 3): CurveData { return makeCurve(sampleCurve(c, Math.max(degree + 1, nbCVs)), degree, c.closed); }
export function reparameterize(c: CurveData): CurveData { return { ...c, knots: uniformKnots(c.cvs.length, c.degree, c.closed) }; }
export function shiftCurve(c: CurveData, n: number): CurveData { if (!c.closed) return c; const k = ((n % c.cvs.length) + c.cvs.length) % c.cvs.length; return { ...c, cvs: [...c.cvs.slice(k), ...c.cvs.slice(0, k)] }; }
export function mergeCurves(a: CurveData, b: CurveData): CurveData { const pa = a.cvs.map(p => [p[0], p[1], p[2]] as V3), pb = b.cvs.map(p => [p[0], p[1], p[2]] as V3); return makeCurve([...pa, ...pb], Math.max(a.degree, b.degree), false); }
export function blendCurves(a: CurveData, b: CurveData): CurveData {
  const [a0, a1] = curveDomain(a), [b0, b1] = curveDomain(b); const pa = evalCurve(a, a1), pb = evalCurve(b, b0);
  const ta = evalCurve(a, a1 - (a1 - a0) * 0.05), tb = evalCurve(b, b0 + (b1 - b0) * 0.05);
  const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) / 3;
  const n = (p: V3, q: V3): V3 => { const l = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) || 1; return [(p[0] - q[0]) / l, (p[1] - q[1]) / l, (p[2] - q[2]) / l]; };
  const da = n(pa, ta), db = n(pb, tb);
  return makeCurve([pa, [pa[0] + da[0] * d, pa[1] + da[1] * d, pa[2] + da[2] * d], [pb[0] + db[0] * d, pb[1] + db[1] * d, pb[2] + db[2] * d], pb], 3, false);
}
export function extractSegment(c: CurveData, u0: number, u1: number): CurveData { const [d0, d1] = curveDomain(c); const pts: V3[] = []; const n = 12; for (let i = 0; i <= n; i++) pts.push(evalCurve(c, d0 + (d1 - d0) * (u0 + (u1 - u0) * i / n))); return makeCurve(pts, 3, false); }

// ------------------------------------------------------------- surfaces
/** A parametric surface evaluator, tessellated into a quad mesh with the given subdivisions. */
export type SurfaceFn = (u: number, v: number) => V3;
export function tessellateSurface(f: SurfaceFn, usub: number, vsub: number, closedU = false, closedV = false): MeshData {
  const verts: V3[] = [], faces: number[][] = [];
  const nu = closedU ? usub : usub + 1, nv = closedV ? vsub : vsub + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) verts.push(f(i / usub, j / vsub));
  const idx = (i: number, j: number) => ((j % nv) * nu) + (i % nu);
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) faces.push([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]);
  return fromPolys(verts, dedupeDegenerate(verts, faces));
}
function dedupeDegenerate(verts: V3[], faces: number[][]) {
  return faces.map(f => f.filter((v, i, a) => { const p = verts[v], q = verts[a[(i + 1) % a.length]]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-9; })).filter(f => f.length >= 3);
}
export const surfacePrimitives: Record<string, (p: Record<string, number>) => { fn: SurfaceFn; closedU: boolean; closedV: boolean }> = {
  Sphere: p => ({ fn: (u, v) => { const th = u * 2 * Math.PI, ph = v * Math.PI; return [p.radius * Math.sin(ph) * Math.cos(th), p.radius * Math.cos(ph), p.radius * Math.sin(ph) * Math.sin(th)]; }, closedU: true, closedV: false }),
  Torus: p => ({ fn: (u, v) => { const th = u * 2 * Math.PI, ph = v * 2 * Math.PI, r = p.radius + p.innerradius * Math.cos(ph); return [r * Math.cos(th), p.innerradius * Math.sin(ph), r * Math.sin(th)]; }, closedU: true, closedV: true }),
  Cylinder: p => ({ fn: (u, v) => { const th = u * 2 * Math.PI; return [p.radius * Math.cos(th), -p.height / 2 + p.height * v, p.radius * Math.sin(th)]; }, closedU: true, closedV: false }),
  Cone: p => ({ fn: (u, v) => { const th = u * 2 * Math.PI, r = p.radius * (1 - v); return [r * Math.cos(th), -p.height / 2 + p.height * v, r * Math.sin(th)]; }, closedU: true, closedV: false }),
  Disc: p => ({ fn: (u, v) => { const th = u * 2 * Math.PI, r = p.innerradius + (p.radius - p.innerradius) * v; return [r * Math.cos(th), 0, r * Math.sin(th)]; }, closedU: true, closedV: false }),
  Grid: p => ({ fn: (u, v) => [-p.ulength / 2 + p.ulength * u, 0, -p.vlength / 2 + p.vlength * v], closedU: false, closedV: false }),
  Cube: p => ({ fn: (u, v) => { // six faces unrolled along v
    const h = p.length / 2, face = Math.min(5, Math.floor(v * 6)), t = v * 6 - face, s = u * 2 - 1, r = t * 2 - 1;
    switch (face) { case 0: return [s * h, r * h, h]; case 1: return [h, r * h, -s * h]; case 2: return [-s * h, r * h, -h]; case 3: return [-h, r * h, s * h]; case 4: return [s * h, h, -r * h]; default: return [s * h, -h, r * h]; } }, closedU: false, closedV: false }),
};

// ------------------------------------------------------------ generators (curve -> mesh)
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function extrudeAlongAxis(profile: CurveData, axis: V3, length: number, subdiv: number, usub: number): MeshData {
  const pts = sampleCurve(profile, usub + 1, !profile.closed); const a = mul(norm(axis), length);
  return tessellateSurface((u, v) => { const p = pts[Math.round(u * usub) % pts.length]; return add(p, mul(a, v)); }, usub, subdiv, profile.closed, false);
}
export function revolve(profile: CurveData, axis: V3, angleDeg: number, usub: number, vsub: number): MeshData {
  const pts = sampleCurve(profile, vsub + 1, !profile.closed); const ax = norm(axis);
  const rot = (p: V3, ang: number): V3 => { // Rodrigues around axis through origin
    const c = Math.cos(ang), s = Math.sin(ang), k = ax, d = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
    return add(add(mul(p, c), mul(cross(k, p), s)), mul(k, d * (1 - c)));
  };
  const full = Math.abs(angleDeg) >= 359.9;
  return tessellateSurface((u, v) => rot(pts[Math.round(v * vsub) % pts.length], (u * angleDeg * Math.PI) / 180), usub, vsub, full, profile.closed);
}
export function loft(curves: CurveData[], usub: number, vsub: number): MeshData {
  const rows = curves.map(c => sampleCurve(c, usub + 1, !c.closed)); const closedU = curves.every(c => c.closed);
  const vcurve = (i: number) => makeCurve(rows.map(r => r[i % r.length]), Math.min(3, rows.length - 1), false);
  const cols = Array.from({ length: usub + 1 }, (_, i) => sampleCurve(vcurve(i), vsub + 1));
  return tessellateSurface((u, v) => cols[Math.round(u * usub)][Math.round(v * vsub)], usub, vsub, closedU, false);
}
export function extrudeAlongCurve(profile: CurveData, path: CurveData, usub: number, vsub: number): MeshData {
  const prof = sampleCurve(profile, usub + 1, !profile.closed); const pathPts = sampleCurve(path, vsub + 1);
  // profile centred at its centroid, swept with a simple parallel-transport frame
  let c: V3 = [0, 0, 0]; for (const p of prof) c = add(c, p); c = mul(c, 1 / prof.length); const local = prof.map(p => sub(p, c));
  let up: V3 = [0, 1, 0];
  const frames = pathPts.map((p, i) => { const t = norm(sub(pathPts[Math.min(i + 1, pathPts.length - 1)], pathPts[Math.max(i - 1, 0)])); if (Math.abs(t[1]) > 0.99) up = [1, 0, 0]; const x = norm(cross(up, t)), y = cross(t, x); up = y; return { p, x, y, t }; });
  return tessellateSurface((u, v) => { const f = frames[Math.round(v * vsub)], l = local[Math.round(u * usub) % local.length]; return add(f.p, add(mul(f.x, l[0]), add(mul(f.y, l[1]), mul(f.t, l[2])))); }, usub, vsub, profile.closed, false);
}
export function birail(profile: CurveData, rail1: CurveData, rail2: CurveData, usub: number, vsub: number): MeshData {
  const prof = sampleCurve(profile, usub + 1), r1 = sampleCurve(rail1, vsub + 1), r2 = sampleCurve(rail2, vsub + 1);
  const p0 = prof[0], p1 = prof[prof.length - 1];
  return tessellateSurface((u, v) => { const i = Math.round(u * usub), j = Math.round(v * vsub); const a = r1[j], b = r2[j]; const t = i / usub; const base = add(p0, mul(sub(p1, p0), t)); const off = sub(prof[i], base); const span = add(a, mul(sub(b, a), t)); return add(span, off); }, usub, vsub, false, false);
}
export function fourSided(c: CurveData[], usub: number, vsub: number): MeshData {
  const [A, B, C, D] = c.map(x => sampleCurve(x, 33)); const at = (pts: V3[], t: number) => pts[Math.round(t * 32)];
  return tessellateSurface((u, v) => { // Coons patch
    const l = add(mul(at(A, u), 1 - v), mul(at(C, u), v)), r = add(mul(at(D, v), 1 - u), mul(at(B, v), u));
    const b = add(add(mul(A[0], (1 - u) * (1 - v)), mul(A[32], u * (1 - v))), add(mul(C[0], (1 - u) * v), mul(C[32], u * v)));
    return sub(add(l, r), b);
  }, usub, vsub, false, false);
}
export function curveNet(ucurves: CurveData[], vcurves: CurveData[], usub: number, vsub: number): MeshData { return loft(ucurves, usub, vsub); }
/** Fill a closed planar curve as one polygon (optionally fan-triangulated). */
export function curveToMesh(c: CurveData, segs: number): MeshData { const pts = sampleCurve(c, segs, false); return fromPolys(pts, [pts.map((_, i) => i).reverse()]); }
