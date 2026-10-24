// Primitive generators matching Softimage's polygon-mesh converters (prim3dop / primrevolve2dop):
// welded vertices, cap "base subdivisions", partial U/V angles. Point/polygon counts were verified
// against the real application (see data/dump and opdefs.json primStats).
import { MeshData, build } from './geometry';

type V = Record<string, any>;
const d2r = Math.PI / 180;
const N = (v: V, k: string, d: number) => { const x = Number(v[k]); return Number.isFinite(x) ? x : d; };

/** Points around a (possibly partial) circle; returns the ring and whether it wraps. */
function ring(count: number, start: number, end: number) {
  const full = Math.abs((end - start) % 360) < 1e-6 && end !== start;
  const n = full ? count : count + 1, out: number[] = [];
  for (let i = 0; i < n; i++) out.push((start + (end - start) * (i / count)) * d2r);
  return { angles: out, wraps: full };
}

export function siCube(v: V): MeshData {
  const len = N(v, 'length', 8), su = Math.max(1, N(v, 'subdivu', 1) | 0), sv = Math.max(1, N(v, 'subdivv', 1) | 0), sb = Math.max(1, N(v, 'subdivbase', 1) | 0);
  const h = len / 2, idx = new Map<string, number>(), verts: number[][] = [], faces: number[][] = [];
  const P = (i: number, j: number, k: number) => { const key = i + ',' + j + ',' + k; let n = idx.get(key); if (n === undefined) { n = verts.length; idx.set(key, n); verts.push([-h + len * i / su, -h + len * j / sv, -h + len * k / sb]); } return n; };
  // six sides on the (su, sv, sb) lattice; vertex sharing comes from the index map
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { faces.push([P(i, j, sb), P(i + 1, j, sb), P(i + 1, j + 1, sb), P(i, j + 1, sb)]); faces.push([P(i + 1, j, 0), P(i, j, 0), P(i, j + 1, 0), P(i + 1, j + 1, 0)]); }
  for (let j = 0; j < sv; j++) for (let k = 0; k < sb; k++) { faces.push([P(su, j, k + 1), P(su, j, k), P(su, j + 1, k), P(su, j + 1, k + 1)]); faces.push([P(0, j, k), P(0, j, k + 1), P(0, j + 1, k + 1), P(0, j + 1, k)]); }
  for (let i = 0; i < su; i++) for (let k = 0; k < sb; k++) { faces.push([P(i, sv, k + 1), P(i + 1, sv, k + 1), P(i + 1, sv, k), P(i, sv, k)]); faces.push([P(i, 0, k), P(i + 1, 0, k), P(i + 1, 0, k + 1), P(i, 0, k + 1)]); }
  return build(verts, faces);
}

export function siGrid(v: V): MeshData {
  const ul = N(v, 'ulength', 8), vl = N(v, 'vlength', 8), su = Math.max(1, N(v, 'subdivu', 8) | 0), sv = Math.max(1, N(v, 'subdivv', 8) | 0);
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) verts.push([-ul / 2 + ul * i / su, 0, vl / 2 - vl * j / sv]);
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const a = j * (su + 1) + i; faces.push([a, a + 1, a + su + 2, a + su + 1]); }
  return build(verts, faces);
}

/** Revolved profile with optional caps (cylinder, cone) — Softimage's prim3dop with Base Subdivisions on the caps. */
function revolved(profile: (t: number) => [number, number], sv: number, v: V, capBottom: boolean, capTop: boolean, apex: boolean): MeshData {
  const su = Math.max(3, N(v, 'subdivu', 8) | 0), sb = Math.max(1, N(v, 'subdivbase', 2) | 0);
  const { angles, wraps } = ring(su, N(v, 'startuangle', 0), N(v, 'enduangle', 360));
  const n = angles.length, verts: number[][] = [], faces: number[][] = [];
  const rows: number[][] = [];
  const nside = apex ? sv : sv + 1;
  for (let j = 0; j < nside; j++) { const [r, y] = profile(j / sv); const row: number[] = []; for (const a of angles) { row.push(verts.length); verts.push([r * Math.cos(a), y, r * Math.sin(a)]); } rows.push(row); }
  let apexIdx = -1; if (apex) { const [, y] = profile(1); apexIdx = verts.length; verts.push([0, y, 0]); }
  const seg = wraps ? n : n - 1;
  for (let j = 0; j < nside - 1; j++) for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; faces.push([rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]]); }
  if (apex) for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; faces.push([rows[nside - 1][i], rows[nside - 1][i2], apexIdx]); }
  const cap = (row: number[], y: number, r: number, flip: boolean) => {
    const c = verts.length; verts.push([0, y, 0]);
    let outer = row;
    const ringsIn: number[][] = [];
    for (let k = sb - 1; k >= 1; k--) { const rr = r * k / sb; const rw: number[] = []; for (const a of angles) { rw.push(verts.length); verts.push([rr * Math.cos(a), y, rr * Math.sin(a)]); } ringsIn.push(rw); }
    const chain = [outer, ...ringsIn];
    for (let q = 0; q < chain.length - 1; q++) for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; const f = [chain[q][i], chain[q][i2], chain[q + 1][i2], chain[q + 1][i]]; faces.push(flip ? f : f.reverse()); }
    const inner = chain[chain.length - 1];
    for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; const f = [inner[i], inner[i2], c]; faces.push(flip ? f : f.reverse()); }
  };
  if (capBottom) { const [r, y] = profile(0); cap(rows[0], y, r, false); }
  if (capTop && !apex) { const [r, y] = profile(1); cap(rows[nside - 1], y, r, true); }
  return build(verts, faces);
}

export function siCylinder(v: V): MeshData {
  const r = N(v, 'radius', 1), h = N(v, 'height', 4), sv = Math.max(1, N(v, 'subdivv', 2) | 0);
  return revolved(t => [r, -h / 2 + h * t], sv, v, v.closevmin !== false, v.closevmax !== false, false);
}
export function siCone(v: V): MeshData {
  const r = N(v, 'radius', 1), h = N(v, 'height', 4), sv = Math.max(1, N(v, 'subdivv', 2) | 0);
  // Softimage cone local origin sits 1/3 height above the base (base y=-h/3, apex y=2h/3) — PC si_model_prims golden.
  return revolved(t => [r * (1 - t), -h / 3 + h * t], sv, v, v.closebottom !== false, false, true);
}

export function siSphere(v: V): MeshData {
  const r = N(v, 'radius', 4), su = Math.max(3, N(v, 'subdivu', 8) | 0), sv = Math.max(2, N(v, 'subdivv', 8) | 0);
  const { angles, wraps } = ring(su, N(v, 'startuangle', 0), N(v, 'enduangle', 360));
  const v0 = N(v, 'startvangle', 0) * d2r, v1 = N(v, 'endvangle', 180) * d2r, fullV = Math.abs(v0) < 1e-9 && Math.abs(v1 - Math.PI) < 1e-9;
  const n = angles.length, seg = wraps ? n : n - 1, verts: number[][] = [], faces: number[][] = [], rows: number[][] = [];
  const top = verts.length; if (fullV) verts.push([0, r, 0]);
  const j0 = fullV ? 1 : 0, j1 = fullV ? sv - 1 : sv;
  for (let j = j0; j <= j1; j++) { const phi = v0 + (v1 - v0) * j / sv; const row: number[] = []; for (const a of angles) { row.push(verts.length); verts.push([r * Math.sin(phi) * Math.cos(a), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(a)]); } rows.push(row); }
  const bot = verts.length; if (fullV) verts.push([0, -r, 0]);
  if (fullV) for (let i = 0; i < seg; i++) faces.push([top, rows[0][(i + 1) % n], rows[0][i]]);
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; faces.push([rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]]); }
  if (fullV) for (let i = 0; i < seg; i++) faces.push([rows[rows.length - 1][i], rows[rows.length - 1][(i + 1) % n], bot]);
  return build(verts, faces);
}

export function siTorus(v: V): MeshData {
  const R = N(v, 'radius', 3), r = N(v, 'sectionradius', 1), su = Math.max(3, N(v, 'subdivu', 8) | 0), sv = Math.max(3, N(v, 'subdivv', 8) | 0);
  const U = ring(su, N(v, 'startuangle', 0), N(v, 'enduangle', 360)), W = ring(sv, N(v, 'startvangle', 0), N(v, 'endvangle', 360));
  const nu = U.angles.length, nv = W.angles.length, verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = U.angles[i], b = W.angles[j], rr = R + r * Math.cos(b); verts.push([rr * Math.cos(a), r * Math.sin(b), rr * Math.sin(a)]); }
  const segU = U.wraps ? nu : nu - 1, segV = W.wraps ? nv : nv - 1;
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const i2 = (i + 1) % nu, j2 = (j + 1) % nv; faces.push([j * nu + i, j * nu + i2, j2 * nu + i2, j2 * nu + i]); }
  return build(verts, faces);
}

export function siDisc(v: V): MeshData {
  const ri = Math.max(0, N(v, 'innerradius', 2)), ro = N(v, 'outerradius', 4), su = Math.max(3, N(v, 'subdivu', 8) | 0), sv = Math.max(1, N(v, 'subdivv', 8) | 0);
  const { angles, wraps } = ring(su, N(v, 'startuangle', 0), N(v, 'enduangle', 360));
  const n = angles.length, seg = wraps ? n : n - 1, verts: number[][] = [], faces: number[][] = [], rows: number[][] = [];
  const hole = ri > 1e-9;
  const j0 = hole ? 0 : 1;
  const c = verts.length; if (!hole) verts.push([0, 0, 0]);
  for (let j = j0; j <= sv; j++) { const r = ri + (ro - ri) * j / sv; const row: number[] = []; for (const a of angles) { row.push(verts.length); verts.push([r * Math.cos(a), 0, r * Math.sin(a)]); } rows.push(row); }
  if (!hole) for (let i = 0; i < seg; i++) faces.push([c, rows[0][i], rows[0][(i + 1) % n]]);
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < seg; i++) { const i2 = (i + 1) % n; faces.push([rows[j][i], rows[j + 1][i], rows[j + 1][i2], rows[j][i2]]); }
  return build(verts, faces);
}
