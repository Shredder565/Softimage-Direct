// Texture projections the Softimage way: a Texture_Projection property on the object's sample cluster, driven by a
// Texture_Support control object (planar / cylindrical / spherical / cubic / spatial / camera / UV) whose transform
// positions the projection; UVs are per sample (polygon node) so wrap-around seams and cube faces stay crisp.
import * as THREE from 'three';
import { X3DObject, Property } from './scene';
import { MeshData } from './geometry';
import { toPolys } from './topology';

/** Corner (sample) index of vertex `k` of polygon `pi`, plus the total number of samples. */
export function sampleOffsets(m: MeshData): { start: Int32Array; total: number } { const start = new Int32Array(m.polygons.length + 1); let t = 0; m.polygons.forEach((f, i) => { start[i] = t; t += f.length; }); start[m.polygons.length] = t; return { start, total: t }; }

/** Per-sample UVs for a projection kind, computed in `space` (the support's local frame; identity = object space). */
export function projectSamples(m: MeshData, kind: string, space: THREE.Matrix4 | null): Float32Array {
  const { verts } = toPolys(m); const P = verts.map(v => { const q = new THREE.Vector3(v[0], v[1], v[2]); if (space) q.applyMatrix4(space); return [q.x, q.y, q.z]; });
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const v of P) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
  const sz = [0, 1, 2].map(k => (mx[k] - mn[k]) || 1); const nrm = (v: number[]) => [0, 1, 2].map(k => space ? v[k] / 2 + 0.5 : (v[k] - mn[k]) / sz[k]); // a support spans -1..1 in its local frame
  const ctr = space ? [0, 0, 0] : [0, 1, 2].map(k => (mn[k] + mx[k]) / 2);
  const { start, total } = sampleOffsets(m); const uv = new Float32Array(total * 2);
  const perVertex = (v: number[]): [number, number] => {
    const n = nrm(v); const c = [0, 1, 2].map(k => v[k] - ctr[k]);
    switch (kind) {
      case 'Planar XY': return [n[0], n[1]]; case 'Planar YZ': return [n[2], n[1]]; case 'Planar XZ': return [n[0], n[2]];
      case 'Cylindrical': return [(Math.atan2(c[2], c[0]) / (2 * Math.PI)) + 0.5, n[1]];
      case 'Spherical': { const r = Math.hypot(...c) || 1; return [(Math.atan2(c[2], c[0]) / (2 * Math.PI)) + 0.5, 1 - Math.acos(Math.max(-1, Math.min(1, c[1] / r))) / Math.PI]; }
      case 'Camera Projection': return [n[0], n[1]];
      default: return [n[0], n[2]];
    }
  };
  m.polygons.forEach((f, pi) => {
    const s = start[pi];
    if (kind === 'Cubic' || kind === 'Spatial') { // per polygon: project along the dominant axis of its normal
      let nx = 0, ny = 0, nz = 0; for (let i = 0; i < f.length; i++) { const a = P[f[i]], b = P[f[(i + 1) % f.length]]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      const ax = [Math.abs(nx), Math.abs(ny), Math.abs(nz)]; const k = ax.indexOf(Math.max(...ax)); const o = [0, 1, 2].filter(x => x !== k);
      f.forEach((v, i) => { const n = nrm(P[v]); uv[(s + i) * 2] = n[o[0]]; uv[(s + i) * 2 + 1] = n[o[1]]; }); return;
    }
    if (kind === 'Unique UVs') { // each polygon its own square in a grid
      const cols = Math.ceil(Math.sqrt(m.polygons.length)); const cx = pi % cols, cy = Math.floor(pi / cols); const cell = 1 / cols;
      f.forEach((_, i) => { const a = i / f.length * Math.PI * 2; uv[(s + i) * 2] = (cx + 0.5 + 0.45 * Math.cos(a)) * cell; uv[(s + i) * 2 + 1] = (cy + 0.5 + 0.45 * Math.sin(a)) * cell; }); return;
    }
    const us = f.map(v => perVertex(P[v]));
    if (kind === 'Cylindrical' || kind === 'Spherical') { const umin = Math.min(...us.map(u => u[0])), umax = Math.max(...us.map(u => u[0])); if (umax - umin > 0.5) for (const u of us) if (u[0] < 0.5) u[0] += 1; } // unwrap the seam polygons
    us.forEach((u, i) => { uv[(s + i) * 2] = u[0]; uv[(s + i) * 2 + 1] = u[1]; });
  });
  return uv;
}
/** The projection property of an object (on its sample cluster or, legacy, on the object). */
export function projectionOf(o: X3DObject): Property | undefined { return o.property('uvprojection'); }
/** Texture support object of a projection, if any. */
export function supportOf(o: X3DObject, p: Property): X3DObject | null { const name = String(p.val('support') ?? ''); if (!name) return null; let root: X3DObject = o; while (root.parentObj) root = root.parentObj; const walk = (x: X3DObject): X3DObject | null => { if (x.name === name) return x; for (const c of x.children) { const r = walk(c); if (r) return r; } return null; }; return walk(root); }
/** Final per-sample UVs of an object: edited UVs when the Texture Editor changed them, else the projection (through its support) with repeats/offsets. Cached per mesh + support transform. */
export function sampleUVs(o: X3DObject): Float32Array | null {
  const m = o.primitive?.mesh(); const p = projectionOf(o); if (!m || !p) return null; const { total } = sampleOffsets(m);
  const edited = (p as any).uvs as Float32Array | undefined; if (edited && edited.length === total * 2) return edited;
  const sup = supportOf(o, p); const space = sup ? sup.globalMatrix().invert().multiply(o.globalMatrix()) : null; const key = `${m.positions.length}|${m.polygons.length}|${p.val('kind')}|${space ? space.elements.map(x => x.toFixed(4)).join(',') : ''}|${p.val('urepeat')},${p.val('vrepeat')},${p.val('uoffset')},${p.val('voffset')}`;
  const cache = (p as any)._uvcache; if (cache && cache.key === key && cache.mesh === m) return cache.uv;
  const uv = projectSamples(m, String(p.val('kind')), space); const ur = Number(p.val('urepeat') ?? 1), vr = Number(p.val('vrepeat') ?? 1), uo = Number(p.val('uoffset') ?? 0), vo = Number(p.val('voffset') ?? 0);
  for (let i = 0; i < uv.length; i += 2) { uv[i] = uv[i] * ur + uo; uv[i + 1] = uv[i + 1] * vr + vo; }
  (p as any)._uvcache = { key, mesh: m, uv }; return uv;
}
/** Laplacian relaxation of per-sample UVs (Texture Editor "Relax"), keeping the island boundary fixed: a light-weight unfold. */
export function relaxUVs(m: MeshData, uv: Float32Array, iterations = 10, pinned?: Set<number>): Float32Array {
  const { start, total } = sampleOffsets(m); const out = Float32Array.from(uv);
  // samples sharing a vertex AND nearly the same uv are the same chart vertex; neighbours through polygon edges
  const groups = new Map<string, number[]>(); const gid = new Int32Array(total); m.polygons.forEach((f, pi) => f.forEach((v, i) => { const s = start[pi] + i; const k = `${v}|${Math.round(uv[s * 2] * 200)},${Math.round(uv[s * 2 + 1] * 200)}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(s); }));
  const ids = [...groups.values()]; ids.forEach((g, i) => g.forEach(s => { gid[s] = i; })); const nbr: Set<number>[] = ids.map(() => new Set()); const edgeCount = new Map<string, number>();
  m.polygons.forEach((f, pi) => { for (let i = 0; i < f.length; i++) { const a = gid[start[pi] + i], b = gid[start[pi] + (i + 1) % f.length]; nbr[a].add(b); nbr[b].add(a); const k = a < b ? `${a}-${b}` : `${b}-${a}`; edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1); } });
  const boundary = new Set<number>(); for (const [k, c] of edgeCount) if (c < 2) k.split('-').map(Number).forEach(x => boundary.add(x));
  const pos = ids.map(g => [out[g[0] * 2], out[g[0] * 2 + 1]]);
  for (let it = 0; it < iterations; it++) { const next = pos.map((p, i) => { if (boundary.has(i) || ids[i].some(s => pinned?.has(s))) return p; const ns = [...nbr[i]]; if (!ns.length) return p; let x = 0, y = 0; for (const n of ns) { x += pos[n][0]; y += pos[n][1]; } return [p[0] * 0.5 + x / ns.length * 0.5, p[1] * 0.5 + y / ns.length * 0.5]; }); for (let i = 0; i < pos.length; i++) pos[i] = next[i]; }
  ids.forEach((g, i) => g.forEach(s => { out[s * 2] = pos[i][0]; out[s * 2 + 1] = pos[i][1]; }));
  return out;
}
