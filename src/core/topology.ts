// Polygon-mesh topology operations on MeshData, working on a component selection
// (points / edges / polygons by index). Each returns a new MeshData.
import { MeshData } from './geometry';

export type CompKind = 'point' | 'edge' | 'polygon';
export interface CompSel { kind: CompKind; indices: number[]; edges?: [number, number][]; }

type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function toPolys(m: MeshData): { verts: V[]; faces: number[][] } {
  const verts: V[] = [];
  for (let i = 0; i < m.positions.length; i += 3) verts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
  return { verts, faces: m.polygons.map(f => [...f]) };
}
export function fromPolys(verts: V[], faces: number[][]): MeshData {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { positions[i * 3] = v[0]; positions[i * 3 + 1] = v[1]; positions[i * 3 + 2] = v[2]; });
  const tris: number[] = [], triPoly: number[] = [];
  faces.forEach((f, pi) => { for (let i = 1; i + 1 < f.length; i++) { tris.push(f[0], f[i], f[i + 1]); triPoly.push(pi); } });
  return { positions, indices: new Uint32Array(tris), polygons: faces, triPoly: new Uint32Array(triPoly) };
}
export function faceNormal(verts: V[], f: number[]): V {
  let n: V = [0, 0, 0];
  for (let i = 0; i < f.length; i++) { const a = verts[f[i]], b = verts[f[(i + 1) % f.length]]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
  return norm(n);
}
export function faceCenter(verts: V[], f: number[]): V { let c: V = [0, 0, 0]; for (const i of f) c = add(c, verts[i]); return mul(c, 1 / f.length); }
export const edgeKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;

/** Polygons touching the selection, as polygon indices, for any component kind. */
export function selPolygons(m: MeshData, sel: CompSel): Set<number> {
  const out = new Set<number>();
  if (sel.kind === 'polygon') { for (const i of sel.indices) out.add(i); return out; }
  if (sel.kind === 'point') { const pts = new Set(sel.indices); m.polygons.forEach((f, pi) => { if (f.every(v => pts.has(v))) out.add(pi); }); return out; }
  const ek = new Set((sel.edges ?? []).map(e => edgeKey(e[0], e[1])));
  m.polygons.forEach((f, pi) => { for (let i = 0; i < f.length; i++) if (ek.has(edgeKey(f[i], f[(i + 1) % f.length]))) { out.add(pi); break; } });
  return out;
}
export function selPoints(m: MeshData, sel: CompSel): Set<number> {
  const out = new Set<number>();
  if (sel.kind === 'point') { for (const i of sel.indices) out.add(i); }
  else if (sel.kind === 'edge') { for (const e of sel.edges ?? []) { out.add(e[0]); out.add(e[1]); } }
  else for (const pi of sel.indices) for (const v of m.polygons[pi] ?? []) out.add(v);
  return out;
}

function boundaryEdges(faces: number[][], polys: Set<number>): Map<string, [number, number]> {
  const count = new Map<string, number>(), dir = new Map<string, [number, number]>();
  for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); count.set(k, (count.get(k) ?? 0) + 1); dir.set(k, [a, b]); } }
  const out = new Map<string, [number, number]>(); for (const [k, c] of count) if (c === 1) out.set(k, dir.get(k)!); return out;
}

// ------------------------------------------------------------------ ops
export function extrudeAlongNormal(m: MeshData, sel: CompSel, length: number, inset = 0): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  // average normal per selected vertex (over selected faces)
  const vn = new Map<number, V>();
  for (const pi of polys) { const n = faceNormal(verts, faces[pi]); for (const v of faces[pi]) vn.set(v, add(vn.get(v) ?? [0, 0, 0], n)); }
  const bnd = boundaryEdges(faces, polys);
  const remap = new Map<number, number>();
  for (const [v, n] of vn) { const nn = norm(n); remap.set(v, verts.length); verts.push(add(verts[v], mul(nn, length))); }
  if (inset) for (const pi of polys) { const c = faceCenter(verts, faces[pi]); for (const v of faces[pi]) { const nv = remap.get(v)!; verts[nv] = add(verts[nv], mul(sub(c, verts[v]), inset)); } }
  for (const pi of polys) faces[pi] = faces[pi].map(v => remap.get(v)!);
  for (const [, [a, b]] of bnd) faces.push([a, b, remap.get(b)!, remap.get(a)!]);
  return fromPolys(verts, faces);
}
export function insetPolygons(m: MeshData, sel: CompSel, amount: number): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  for (const pi of [...polys]) {
    const f = faces[pi], c = faceCenter(verts, f); const inner = f.map(v => { verts.push(add(verts[v], mul(sub(c, verts[v]), amount))); return verts.length - 1; });
    for (let i = 0; i < f.length; i++) faces.push([f[i], f[(i + 1) % f.length], inner[(i + 1) % f.length], inner[i]]);
    faces[pi] = inner;
  }
  return fromPolys(verts, faces);
}
export function deleteComponents(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m);
  let keep: number[][];
  if (sel.kind === 'polygon') { const del = new Set(sel.indices); keep = faces.filter((_, i) => !del.has(i)); }
  else if (sel.kind === 'point') { const del = new Set(sel.indices); keep = faces.filter(f => !f.some(v => del.has(v))); }
  else { const ek = new Set((sel.edges ?? []).map(e => edgeKey(e[0], e[1]))); keep = faces.filter(f => { for (let i = 0; i < f.length; i++) if (ek.has(edgeKey(f[i], f[(i + 1) % f.length]))) return false; return true; }); }
  return compact(verts, keep);
}
export function extractPolygons(m: MeshData, sel: CompSel, keep: boolean): { rest: MeshData; part: MeshData } {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel);
  const part = compact(verts, faces.filter((_, i) => polys.has(i)));
  const rest = keep ? m : compact(verts, faces.filter((_, i) => !polys.has(i)));
  return { rest, part };
}
export function duplicatePolygons(m: MeshData, sel: CompSel, offset: number): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); const remap = new Map<number, number>();
  for (const pi of [...polys]) { const n = faceNormal(verts, faces[pi]); faces.push(faces[pi].map(v => { if (!remap.has(v)) { remap.set(v, verts.length); verts.push(add(verts[v], mul(n, offset))); } return remap.get(v)!; })); }
  return fromPolys(verts, faces);
}
export function subdividePolygons(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const mid = new Map<string, number>();
  const midpoint = (a: number, b: number) => { const k = edgeKey(a, b); if (!mid.has(k)) { mid.set(k, verts.length); verts.push(mul(add(verts[a], verts[b]), 0.5)); } return mid.get(k)!; };
  const out: number[][] = [];
  faces.forEach((f, pi) => {
    if (!polys.has(pi)) { out.push(f); return; }
    const c = faceCenter(verts, f); const ci = verts.length; verts.push(c);
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], p = f[(i - 1 + f.length) % f.length]; out.push([a, midpoint(a, b), ci, midpoint(p, a)]); }
  });
  // neighbours of subdivided faces must include new midpoints to stay watertight
  for (let i = 0; i < out.length; i++) { const f = out[i]; const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (mid.has(k) && !f.includes(mid.get(k)!)) nf.push(mid.get(k)!); } out[i] = nf; }
  return fromPolys(verts, out);
}
export function splitEdges(m: MeshData, sel: CompSel, ratio = 0.5): MeshData {
  const { verts, faces } = toPolys(m); const edges = sel.kind === 'edge' ? (sel.edges ?? []) : [];
  if (!edges.length) return m;
  const mid = new Map<string, number>();
  for (const [a, b] of edges) { const k = edgeKey(a, b); if (!mid.has(k)) { mid.set(k, verts.length); verts.push(add(verts[a], mul(sub(verts[b], verts[a]), ratio))); } }
  const out = faces.map(f => { const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (mid.has(k)) nf.push(mid.get(k)!); } return nf; });
  return fromPolys(verts, out);
}
export function weldPoints(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const pts = [...selPoints(m, sel)]; if (pts.length < 2) return m;
  let c: V = [0, 0, 0]; for (const p of pts) c = add(c, verts[p]); c = mul(c, 1 / pts.length);
  const target = pts[0]; verts[target] = c; const set = new Set(pts);
  const out: number[][] = [];
  for (const f of faces) { const nf: number[] = []; for (const v of f) { const nv = set.has(v) ? target : v; if (nf[nf.length - 1] !== nv && !(nf.length && nf[0] === nv && nf.length === f.length - 1)) nf.push(nv); } const dedup = nf.filter((v, i) => v !== nf[(i + 1) % nf.length] || nf.length <= 1); if (dedup.length >= 3) out.push(dedup); }
  return compact(verts, out);
}
export function collapseComponents(m: MeshData, sel: CompSel): MeshData {
  if (sel.kind === 'polygon') { // collapse each polygon to its centre
    const { verts, faces } = toPolys(m); const out: number[][] = []; const remap = new Map<number, number>();
    for (const pi of sel.indices) { const f = faces[pi]; const c = faceCenter(verts, f); const ci = verts.length; verts.push(c); for (const v of f) remap.set(v, ci); }
    faces.forEach((f, pi) => { if (sel.indices.includes(pi)) return; const nf = f.map(v => remap.get(v) ?? v).filter((v, i, arr) => v !== arr[(i + 1) % arr.length]); if (new Set(nf).size >= 3) out.push(nf); });
    return compact(verts, out);
  }
  return weldPoints(m, sel);
}
export function invertPolygons(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i));
  for (const pi of polys) faces[pi] = [...faces[pi]].reverse();
  return fromPolys(verts, faces);
}
export function triangulate(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i)); const out: number[][] = [];
  faces.forEach((f, pi) => { if (!polys.has(pi) || f.length <= 3) { out.push(f); return; } for (let i = 1; i + 1 < f.length; i++) out.push([f[0], f[i], f[i + 1]]); });
  return fromPolys(verts, out);
}
export function applyThickness(m: MeshData, amount: number): MeshData {
  const { verts, faces } = toPolys(m); const n = verts.length;
  const vn: V[] = verts.map(() => [0, 0, 0]); for (const f of faces) { const fn = faceNormal(verts, f); for (const v of f) vn[v] = add(vn[v], fn); }
  for (let i = 0; i < n; i++) verts.push(sub(verts[i], mul(norm(vn[i]), amount)));
  const out = [...faces, ...faces.map(f => [...f].reverse().map(v => v + n))];
  const bnd = boundaryEdges(faces, new Set(faces.map((_, i) => i)));
  for (const [, [a, b]] of bnd) out.push([b, a, a + n, b + n]);
  return fromPolys(verts, out);
}
export function filterPoints(m: MeshData, sel: CompSel, strength: number): MeshData {
  const { verts, faces } = toPolys(m); const pts = sel.indices.length ? selPoints(m, sel) : new Set(verts.map((_, i) => i));
  const adj = new Map<number, Set<number>>(); for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b); (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a); }
  const nv = verts.map(v => [...v] as V);
  for (const p of pts) { const ns = adj.get(p); if (!ns?.size) continue; let c: V = [0, 0, 0]; for (const q of ns) c = add(c, verts[q]); c = mul(c, 1 / ns.size); nv[p] = add(verts[p], mul(sub(c, verts[p]), strength)); }
  return fromPolys(nv, faces);
}
export function movePoints(m: MeshData, deltas: Map<number, V>): MeshData {
  const { verts, faces } = toPolys(m);
  for (const [i, d] of deltas) if (verts[i]) verts[i] = add(verts[i], d);
  return fromPolys(verts, faces);
}
export function symmetrize(m: MeshData, sel: CompSel, axis: 0 | 1 | 2): MeshData {
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i)); const remap = new Map<number, number>();
  for (const pi of [...polys]) faces.push([...faces[pi]].reverse().map(v => { if (!remap.has(v)) { const p = [...verts[v]] as V; p[axis] = -p[axis]; remap.set(v, verts.length); verts.push(p); } return remap.get(v)!; }));
  return fromPolys(verts, faces);
}

function compact(verts: V[], faces: number[][]): MeshData {
  const used = new Map<number, number>(); const nv: V[] = [];
  const nf = faces.map(f => f.map(v => { if (!used.has(v)) { used.set(v, nv.length); nv.push(verts[v]); } return used.get(v)!; }));
  return fromPolys(nv, nf);
}

/** Edges of a mesh as unique vertex pairs. */
export function meshEdges(m: MeshData): [number, number][] {
  const seen = new Set<string>(), out: [number, number][] = [];
  for (const f of m.polygons) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); if (!seen.has(k)) { seen.add(k); out.push([Math.min(a, b), Math.max(a, b)]); } }
  return out;
}
