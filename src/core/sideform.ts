// Spatial deformers with Softimage's parameter sets (C3DSpatialDeform.spdl + twistop/bendop/taperop/
// bulgeop/shearop/pushop/randomizeop/smoothop/foldop). All read the real script names.
import { MeshData, cloneMesh, bbox } from './geometry';

type V = Record<string, any>;
const AX = (v: V) => Math.min(2, Math.max(0, Number(v.axis ?? 1)));
const d2r = Math.PI / 180;

/** Deformation centre: object origin (+offset) or bbox centre (+offset), as in the "Deformation Center" group. */
function centre(m: MeshData, v: V): [number, number, number] {
  const off: [number, number, number] = [Number(v.centreoffsetx || 0), Number(v.centreoffsety || 0), Number(v.centreoffsetz || 0)];
  if (v.usebboxcentre) { const bb = bbox(m); for (let k = 0; k < 3; k++) off[k] += (bb.min[k] + bb.max[k]) / 2; }
  return off;
}
/** Extent of the mesh along an axis (bbox size), never zero. */
function extent(m: MeshData, a: number) { const bb = bbox(m); return (bb.max[a] - bb.min[a]) || 1; }
function rotAbout(p: number[], a: number, ang: number): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), u = (a + 1) % 3, w = (a + 2) % 3, out = p.slice();
  out[u] = p[u] * c - p[w] * s; out[w] = p[u] * s + p[w] * c; return out;
}
function mapPoints(m: MeshData, fn: (p: number[]) => number[]): MeshData {
  const out = cloneMesh(m);
  for (let i = 0; i < out.positions.length; i += 3) { const q = fn([out.positions[i], out.positions[i + 1], out.positions[i + 2]]); out.positions[i] = q[0]; out.positions[i + 1] = q[1]; out.positions[i + 2] = q[2]; }
  return out;
}
function vertexNormals(m: MeshData): Float32Array {
  const n = new Float32Array(m.positions.length);
  for (const f of m.polygons) {
    if (f.length < 3) continue;
    const P = (i: number) => [m.positions[f[i] * 3], m.positions[f[i] * 3 + 1], m.positions[f[i] * 3 + 2]];
    const a = P(0), b = P(1), c = P(2);
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (const vi of f) { n[vi * 3] += nx; n[vi * 3 + 1] += ny; n[vi * 3 + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

export const siDeformers: Record<string, (m: MeshData, v: V) => MeshData> = {
  /** Twist Op: rotation about `axis` growing linearly along the axis; `angle` is reached at the top of the extent. */
  twistop: (m, v) => {
    const a = AX(v), c = centre(m, v), ext = extent(m, a), bb = bbox(m), ang = Number(v.angle) * d2r;
    if (!v.dotwist && !v.dovortex) return m;
    return mapPoints(m, p => {
      const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const t = (p[a] - bb.min[a]) / ext;
      let r = rotAbout(q, a, v.dotwist ? ang * t : 0);
      if (v.dovortex) { const rad = Math.hypot(q[(a + 1) % 3], q[(a + 2) % 3]), rmax = Math.max(ext, 1e-6); r = rotAbout(r, a, ang * rad / rmax); }
      return [r[0] + c[0], r[1] + c[1], r[2] + c[2]];
    });
  },
  /** Bend Op: bends the object around a circular arc perpendicular to `axis`; `dir` rotates the bend plane, `bottom` keeps the base fixed. */
  bendop: (m, v) => {
    const a = AX(v), c = centre(m, v), bb = bbox(m), ang = Number(v.angle) * d2r, dir = Number(v.dir || 0) * d2r;
    const u = (a + 1) % 3;
    if (Math.abs(ang) < 1e-6) return m;
    const R = Math.max(1e-3, Number(v.radius));          // bend radius
    const L = Math.abs(R * ang);                          // length of the bent region along the axis
    const base = v.bottom ? bb.min[a] : c[a] - L / 2;     // region start
    const sgn = ang < 0 ? -1 : 1;
    return mapPoints(m, p => {
      const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      let r = rotAbout(q, a, -dir);
      const y = p[a] - base, x = r[u];
      const yc = Math.min(Math.max(y, 0), L), over = y - yc;   // part inside the region, and the straight overshoot
      const phi = sgn * yc / R;
      const bx = sgn * (R - (R - sgn * x) * Math.cos(phi)) ;   // lateral
      const by = (R - sgn * x) * Math.sin(phi);               // along axis
      r[u] = bx + over * Math.sin(phi); r[a] = by + over * Math.cos(phi) + (base - c[a]);
      r = rotAbout(r, a, dir);
      return [r[0] + c[0], r[1] + c[1], r[2] + c[2]];
    });
  },
  /** Taper Op: scales the flagged axes by (1 + ampl·t) where t runs along `axis` from the centre. */
  taperop: (m, v) => {
    const a = AX(v), c = centre(m, v), ext = extent(m, a), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    return mapPoints(m, p => {
      const t = (p[a] - c[a]) / ext, s = 1 + ampl * t, q = p.slice();
      for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = c[k] + (p[k] - c[k]) * s;
      return q;
    });
  },
  /** Bulge Op: scales the flagged axes by (1 + ampl·sin(π·t)) over the extent. */
  bulgeop: (m, v) => {
    const a = AX(v), c = centre(m, v), bb = bbox(m), ext = extent(m, a), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    return mapPoints(m, p => {
      const t = (p[a] - bb.min[a]) / ext, s = 1 + ampl * Math.sin(Math.PI * t), q = p.slice();
      for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = c[k] + (p[k] - c[k]) * s;
      return q;
    });
  },
  /** Shear Op: offsets the flagged axes proportionally to the position along `axis`. */
  shearop: (m, v) => {
    const a = AX(v), c = centre(m, v), ext = extent(m, a), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    return mapPoints(m, p => { const t = (p[a] - c[a]) / ext, q = p.slice(); for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = p[k] + ampl * t * ext; return q; });
  },
  /** Push Op: moves points along their normals by `ampl`. */
  pushop: (m, v) => {
    const n = vertexNormals(m), out = cloneMesh(m), amp = Number(v.ampl);
    for (let i = 0; i < out.positions.length; i++) out.positions[i] += n[i] * amp;
    return out;
  },
  /** Randomize Op: random displacement with per-axis amplitudes, repeated `nbofrepeat` times from `seed`. */
  randomizeop: (m, v) => {
    const out = cloneMesh(m); let seed = (Number(v.seed) | 0) + 1;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    const amp = [Number(v.amplx), Number(v.amply), Number(v.amplz)], rep = Math.max(1, Number(v.nbofrepeat) | 0);
    for (let r = 0; r < rep; r++) for (let i = 0; i < out.positions.length; i++) out.positions[i] += rnd() * 2 * amp[i % 3];
    return out;
  },
  /** Smooth / Relax: Laplacian relaxation; `strength` is the number of passes (Softimage uses 0..20). */
  smoothop: (m, v) => {
    const n = m.positions.length / 3, adj: Set<number>[] = Array.from({ length: n }, () => new Set());
    const border = new Set<number>(); const edgeCount = new Map<string, number>();
    for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; adj[a].add(b); adj[b].add(a); const k = a < b ? a + '_' + b : b + '_' + a; edgeCount.set(k, (edgeCount.get(k) || 0) + 1); }
    for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('_').map(Number); border.add(a); border.add(b); }
    let cur = cloneMesh(m); const passes = Math.round(Number(v.strength)); const w = 0.5;
    for (let it = 0; it < passes; it++) {
      const next = cloneMesh(cur);
      for (let i = 0; i < n; i++) {
        if (!adj[i].size || (v.preservebordervertices && border.has(i))) continue;
        const avg = [0, 0, 0]; for (const j of adj[i]) for (let k = 0; k < 3; k++) avg[k] += cur.positions[j * 3 + k];
        for (let k = 0; k < 3; k++) next.positions[i * 3 + k] += (avg[k] / adj[i].size - cur.positions[i * 3 + k]) * w;
      }
      cur = next;
    }
    return cur;
  },
  /** Fold Op: folds the object around the plane normal `normal` by `angle` (linear or spherical falloff). */
  foldop: (m, v) => {
    const a = Math.min(2, Math.max(0, Number(v.normal ?? 1))), c = centre(m, v), ext = extent(m, a), ang = Number(v.angle) * d2r, dir = Number(v.dir || 0) * d2r;
    const u = (a + 1) % 3, w = (a + 2) % 3, dist = Number(v.distortion || 0) / 100;
    return mapPoints(m, p => {
      let q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; q = rotAbout(q, a, -dir);
      const d = q[u], side = d >= 0 ? 1 : -1, t = Math.min(1, Math.abs(d) / ext);
      const f = v.type === 1 || v.type === '1' ? Math.sin(t * Math.PI / 2) : t;
      const r = rotAbout(q, w, side * ang * 0.5 * f * (1 - dist) + side * ang * 0.5 * dist);
      r[u] = q[u] * Math.cos(ang * 0.5 * f) ; r[a] = q[a] + Math.abs(q[u]) * Math.sin(ang * 0.5 * f);
      const o = rotAbout(r, a, dir); return [o[0] + c[0], o[1] + c[1], o[2] + c[2]];
    });
  },
};
