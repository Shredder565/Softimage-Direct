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

/** Default "profile" fcurve of the Bulge operator, sampled from Softimage (t = distance from centre / half extent). */
const BULGE_PROFILE = [1, 0.9697, 0.8794, 0.7345, 0.5497, 0.3504, 0.1708, 0.0454, 0];
const sampleProfile = (tab: number[], t: number) => { t = Math.min(1, Math.max(0, t)) * (tab.length - 1); const i = Math.floor(t), f = t - i; return i >= tab.length - 1 ? tab[tab.length - 1] : tab[i] * (1 - f) + tab[i + 1] * f; };
const smoothstep = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const unit = (a: number): number[] => [a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// All formulas below were fitted to vertex positions recorded from Softimage 2015 SP2 (data/dump/si_deform_ref*.json).
export const siDeformers: Record<string, (m: MeshData, v: V) => MeshData> = {
  /** Twist Op: rotation about `axis` following a smoothstep profile from 0 at the bottom of the extent to -angle at the top; the vortex option
   *  rotates by -angle·(1 - r/(2·rmax)) depending only on the distance from the axis. */
  twistop: (m, v) => {
    const a = AX(v), c = centre(m, v), ext = extent(m, a), bb = bbox(m), ang = Number(v.angle) * d2r;
    if (!v.dotwist && !v.dovortex) return m;
    let rmax = 1e-6; if (v.dovortex) for (let i = 0; i < m.positions.length; i += 3) { const q = [m.positions[i] - c[0], m.positions[i + 1] - c[1], m.positions[i + 2] - c[2]]; rmax = Math.max(rmax, Math.hypot(q[(a + 1) % 3], q[(a + 2) % 3])); }
    return mapPoints(m, p => {
      const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const t = (p[a] - bb.min[a]) / ext;
      let r = v.dotwist ? rotAbout(q, a, -ang * smoothstep(t)) : q;
      if (v.dovortex) { const rad = Math.hypot(q[(a + 1) % 3], q[(a + 2) % 3]); r = rotAbout(r, a, -ang * (1 - rad / (2 * rmax))); }
      return [r[0] + c[0], r[1] + c[1], r[2] + c[2]];
    });
  },
  /** Bend Op: the bend circle centre sits `radius` units from the centre along the bend direction (+X for axis Y, rotated
   *  by `dir` about the axis). Points above the centre rotate around it by (height / radius) up to `angle`, then continue
   *  straight along the tangent; "Bend Bottom" bends the lower half instead. */
  bendop: (m, v) => {
    const a = AX(v), c = centre(m, v), ang = Math.abs(Number(v.angle)) * d2r, dir = Number(v.dir || 0) * d2r, R = Number(v.radius);
    if (ang < 1e-9 || Math.abs(R) < 1e-9) return m;
    const axisVec = unit(a), dirVec = rotAbout(unit((a + 2) % 3), a, dir);
    const sgnA = Number(v.angle) < 0 ? -1 : 1;
    return mapPoints(m, p => {
      const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      let y = q[a]; if (v.bottom) y = -y; if (y <= 0) return p;
      const l = dot(q, dirVec) * sgnA, rest = [0, 1, 2].map(k => q[k] - l * sgnA * dirVec[k] - q[a] * axisVec[k]);
      const rr = R - l, phi = Math.min(y / R, ang), over = Math.max(0, y - R * ang);
      let nl = R - rr * Math.cos(phi) + over * Math.sin(phi), ny = rr * Math.sin(phi) + over * Math.cos(phi);
      if (v.bottom) ny = -ny; nl *= sgnA;
      return [0, 1, 2].map(k => c[k] + rest[k] + nl * dirVec[k] + ny * axisVec[k]);
    });
  },
  /** Taper Op: scales the flagged axes by 1 - ampl·f(d) on the positive side of the centre, where f is the default
   *  profile (a smoothstep that saturates at 30% of the half extent). */
  taperop: (m, v) => {
    const a = AX(v), c = centre(m, v), bb = bbox(m), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    const half = (bb.max[a] - c[a]) || 1;
    return mapPoints(m, p => {
      const dd = p[a] - c[a]; if (dd <= 0) return p;
      const s = 1 - ampl * smoothstep(dd / (0.3 * half)), q = p.slice();
      for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = c[k] + (p[k] - c[k]) * s;
      return q;
    });
  },
  /** Bulge Op: scales the flagged axes by 1 + ampl·profile(|d| / half extent). */
  bulgeop: (m, v) => {
    const a = AX(v), c = centre(m, v), bb = bbox(m), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    const half = Math.max(bb.max[a] - c[a], c[a] - bb.min[a]) || 1;
    return mapPoints(m, p => {
      const s = 1 + ampl * sampleProfile(BULGE_PROFILE, Math.abs(p[a] - c[a]) / half), q = p.slice();
      for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = c[k] + (p[k] - c[k]) * s;
      return q;
    });
  },
  /** Shear Op: offsets the flagged axes by ampl·(position along axis from the bottom of the extent, normalised). */
  shearop: (m, v) => {
    const a = AX(v), bb = bbox(m), ext = extent(m, a), flags = [!!v.defx, !!v.defy, !!v.defz], ampl = Number(v.ampl);
    return mapPoints(m, p => { const t = (p[a] - bb.min[a]) / ext, q = p.slice(); for (let k = 0; k < 3; k++) if (k !== a && flags[k]) q[k] = p[k] + ampl * t; return q; });
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
  /** Smooth / Relax: `strength` passes of half-weight Laplacian smoothing (verified: strength 1 moves a cube corner by
   *  half the way to its neighbours' average). "Reproject" (Relax) slides each point back along its original normal
   *  onto the original surface, so flat regions and sharp corners are kept. */
  smoothop: (m, v) => {
    const n = m.positions.length / 3, adj: Set<number>[] = Array.from({ length: n }, () => new Set());
    const border = new Set<number>(); const edgeCount = new Map<string, number>();
    for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; adj[a].add(b); adj[b].add(a); const k = a < b ? a + '_' + b : b + '_' + a; edgeCount.set(k, (edgeCount.get(k) || 0) + 1); }
    for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('_').map(Number); border.add(a); border.add(b); }
    let cur = cloneMesh(m); const passes = Math.max(0, Math.round(Number(v.strength))); const w = 0.5;
    const nrm = v.reproject ? vertexNormals(m) : null; const vf: number[][] = Array.from({ length: n }, () => []); if (nrm) m.polygons.forEach((f, fi) => f.forEach(vi => vf[vi].push(fi)));
    const P = (i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    const reproject = (mesh: MeshData) => { // slide each point back along its original normal onto the original adjacent face planes
      for (let i = 0; i < n; i++) {
        const q = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]], d = [nrm![i * 3], nrm![i * 3 + 1], nrm![i * 3 + 2]];
        let best = 0, bestAbs = Infinity;
        for (const fi of vf[i]) {
          const f = m.polygons[fi]; if (f.length < 3) continue; const a = P(f[0]), b = P(f[1]), cc = P(f[2]);
          const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
          const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const den = dot(fn, d); if (Math.abs(den) < 1e-9) continue;
          const t = dot(fn, [a[0] - q[0], a[1] - q[1], a[2] - q[2]]) / den; if (Math.abs(t) < bestAbs) { bestAbs = Math.abs(t); best = t; }
        }
        if (bestAbs < Infinity) for (let k = 0; k < 3; k++) mesh.positions[i * 3 + k] = q[k] + d[k] * best;
      }
    };
    for (let it = 0; it < passes; it++) {
      const next = cloneMesh(cur);
      for (let i = 0; i < n; i++) {
        if (!adj[i].size || (v.preservebordervertices && border.has(i))) continue;
        const avg = [0, 0, 0]; for (const j of adj[i]) for (let k = 0; k < 3; k++) avg[k] += cur.positions[j * 3 + k];
        for (let k = 0; k < 3; k++) next.positions[i * 3 + k] += (avg[k] / adj[i].size - cur.positions[i * 3 + k]) * w;
      }
      if (nrm) reproject(next);
      cur = next;
    }
    return cur;
  },
  /** Fold Op: folds the object around the line through the centre; `normal` is the fold-plane normal (the displacement
   *  axis), `dir` turns the fold line in that plane. Spherical: each side wraps onto a circle reaching angle/2 at the
   *  extent; Linear: each side is rotated by angle/4 (both measured from Softimage). */
  foldop: (m, v) => {
    const a = Math.min(2, Math.max(0, Number(v.normal ?? 1))), c = centre(m, v), bb = bbox(m), ang = Number(v.angle) * d2r, dir = Number(v.dir || 0) * d2r;
    const u0 = (a + 2) % 3, latVec = rotAbout(unit(u0), a, dir), nVec = unit(a);
    const half = Math.max(bb.max[u0] - c[u0], c[u0] - bb.min[u0]) || 1;
    const spherical = Number(v.type) === 1; const dist = Math.min(1, Math.max(0, Number(v.distortion || 0) / 100));
    const wVec = rotAbout(unit((a + 1) % 3), a, dir);
    return mapPoints(m, p => {
      const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const l = dot(q, latVec), w = dot(q, wVec), h = q[a];
      let nl: number, nh: number;
      const rho = half / Math.max(1e-6, Math.abs(ang) / 2);
      let foldH: number;
      if (spherical) { const th = l / rho; nl = rho * Math.sin(th); foldH = rho * (1 - Math.cos(th)); }
      else { const th = Math.abs(ang) / 4; nl = l * Math.cos(th); foldH = Math.abs(l) * Math.sin(th); }
      let nw = w;
      if (dist > 0) { // distortion: wrap the other in-plane axis too (double curvature), scaled by the distortion amount
        const thw = w * dist / rho; nl *= Math.cos(thw); foldH += (rho - foldH) * (1 - Math.cos(thw)); nw = w * (1 - dist) + rho * Math.sin(thw);
      }
      nh = h + foldH;
      return [0, 1, 2].map(k => c[k] + nl * latVec[k] + nw * wVec[k] + nh * nVec[k]);
    });
  },
};
