// Polygon-mesh topology operations on MeshData, working on a component selection
// (points / edges / polygons by index). Each returns a new MeshData.
// Semantics follow Softimage 2015 (verified against recorded results, see tools/compare_topology.mjs):
// selected polygons are treated as connected islands; only island-boundary vertices are duplicated,
// offsets are "orthogonal" (each face offset exactly by the length; shared vertices sit on the plane intersection).
import { MeshData } from './geometry';

export type CompKind = 'point' | 'edge' | 'polygon';
export interface CompSel { kind: CompKind; indices: number[]; edges?: [number, number][]; }

type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

/** Island boundary edges (edges used by exactly one selected polygon), oriented as in that polygon. */
function boundaryEdges(faces: number[][], polys: Set<number>): Map<string, [number, number]> {
  const count = new Map<string, number>(), dir = new Map<string, [number, number]>();
  for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); count.set(k, (count.get(k) ?? 0) + 1); dir.set(k, [a, b]); } }
  const out = new Map<string, [number, number]>(); for (const [k, c] of count) if (c === 1) out.set(k, dir.get(k)!); return out;
}
/** Vertices of the island that also belong to an unselected polygon (they get duplicated when the island is lifted). */
function boundaryVerts(faces: number[][], polys: Set<number>): Set<number> {
  const inIsland = new Set<number>(); for (const pi of polys) for (const v of faces[pi]) inIsland.add(v);
  const out = new Set<number>(); faces.forEach((f, pi) => { if (polys.has(pi)) return; for (const v of f) if (inIsland.has(v)) out.add(v); }); return out;
}
/** Point at distance d from every plane (n_i, through p): least-squares intersection of the offset planes ("orthogonal" extrusion). */
function miterOffset(p: V, normals: V[], d: number): V {
  if (!normals.length) return p;
  if (normals.length === 1) return add(p, mul(normals[0], d));
  // solve (N^T N) x = N^T (d·1) for the displacement x
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const n of normals) { for (let i = 0; i < 3; i++) { b[i] += n[i] * d; for (let j = 0; j < 3; j++) A[i][j] += n[i] * n[j]; } }
  const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  if (Math.abs(det) < 1e-9) { // coplanar normals: average direction, miter length
    let s: V = [0, 0, 0]; for (const n of normals) s = add(s, n); const nn = norm(s); const cosA = dot(nn, normals[0]) || 1; return add(p, mul(nn, d / cosA));
  }
  const inv = (i: number, j: number) => { const r = [0, 1, 2].filter(k => k !== j), c = [0, 1, 2].filter(k => k !== i); const m = A[r[0]][c[0]] * A[r[1]][c[1]] - A[r[0]][c[1]] * A[r[1]][c[0]]; return ((i + j) % 2 ? -m : m) / det; };
  const x: V = [0, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x[i] += inv(i, j) * b[j];
  return add(p, x);
}
/** In-plane inward offset of the island boundary at each boundary vertex (for inset / offset). */
function boundaryInset(verts: V[], faces: number[][], polys: Set<number>, amount: number): Map<number, V> {
  const out = new Map<number, V>(); if (!amount) return out;
  const bnd = boundaryEdges(faces, polys);
  const faceOf = new Map<string, number>(); for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) faceOf.set(edgeKey(f[i], f[(i + 1) % f.length]), pi); }
  const dirs = new Map<number, V[]>();
  for (const [k, [a, b]] of bnd) {
    const n = faceNormal(verts, faces[faceOf.get(k)!]); const e = norm(sub(verts[b], verts[a])); const inward = norm(cross(n, e)); // left of the edge, inside the polygon
    for (const v of [a, b]) dirs.set(v, [...(dirs.get(v) ?? []), inward]);
  }
  for (const [v, ds] of dirs) { // miter in-plane: offset lines of the two adjacent boundary edges
    const d = miterOffset([0, 0, 0], ds, amount); out.set(v, d);
  }
  return out;
}

// ------------------------------------------------------------------ ops
/** Extrude Component Along Normal (extrudenormalop): lifts each island by `length` (orthogonal offset), insets its boundary by `inset`,
 *  with `subdivs` extra rings on the side walls. Interior island vertices move, boundary vertices are duplicated. */
export function extrudeAlongNormal(m: MeshData, sel: CompSel, length: number, inset = 0, subdivs = 0, duplicate = false): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const normalsAt = new Map<number, V[]>();
  for (const pi of polys) { const n = faceNormal(verts, faces[pi]); for (const v of faces[pi]) normalsAt.set(v, [...(normalsAt.get(v) ?? []), n]); }
  const bverts = boundaryVerts(faces, polys), bnd = boundaryEdges(faces, polys), ins = boundaryInset(verts, faces, polys, inset);
  const remap = new Map<number, number>();
  for (const [v, ns] of normalsAt) {
    const target = add(miterOffset(verts[v], ns, length), ins.get(v) ?? [0, 0, 0]);
    if (bverts.has(v) || duplicate) { remap.set(v, verts.length); verts.push(target); } else { verts[v] = target; remap.set(v, v); }
  }
  const outFaces = duplicate ? [...faces] : faces;
  if (duplicate) for (const pi of polys) outFaces.push(faces[pi].map(v => remap.get(v)!)); else for (const pi of polys) faces[pi] = faces[pi].map(v => remap.get(v)!);
  const rings = Math.max(0, subdivs | 0) + 1; const ringPt = new Map<string, number>();
  const at = (v: number, r: number) => { if (r === rings) return remap.get(v)!; if (r === 0) return v; const k = v + '@' + r; if (!ringPt.has(k)) { ringPt.set(k, verts.length); verts.push(add(verts[v], mul(sub(verts[remap.get(v)!], verts[v]), r / rings))); } return ringPt.get(k)!; };
  for (const [, [a, b]] of bnd) {
    if (remap.get(a) === a && remap.get(b) === b) continue;
    for (let r = 1; r <= rings; r++) outFaces.push([at(a, r - 1), at(b, r - 1), at(b, r), at(a, r)]);
  }
  return fromPolys(verts, outFaces);
}
/** Inset Polygons (extrudecompaxisop with inset, length 0): shrinks each island's boundary inward by `amount`, bridging with new quads. */
export function insetPolygons(m: MeshData, sel: CompSel, amount: number): MeshData { return extrudeAlongNormal(m, sel, 0, amount); }
/** Offset Polygons Contour (offsetpolygonsop): moves island boundary vertices outward in-plane by `offset`; no new polygons. */
export function offsetPolygons(m: MeshData, sel: CompSel, offset: number): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const ins = boundaryInset(verts, faces, polys, -offset); for (const [v, d] of ins) verts[v] = add(verts[v], d);
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
/** Duplicate Polygons: extrusion with the Duplicate option — the island copy is lifted, the original stays. */
export function duplicatePolygons(m: MeshData, sel: CompSel, offset: number): MeshData { return extrudeAlongNormal(m, sel, offset, 0, 0, true); }
/** Subdivide Polygon (subdividepolygonop): 0 Plus (centre + edge midpoints), 1 Diamond (edge midpoints), 2 X (centre fan), 3 Triangles. */
export function subdividePolygons(m: MeshData, sel: CompSel, mode = 0, levels = 1): MeshData {
  let cur = m;
  for (let l = 0; l < Math.max(1, levels | 0); l++) cur = subdivideOnce(cur, sel, mode, l > 0);
  return cur;
}
function subdivideOnce(m: MeshData, sel: CompSel, mode: number, all: boolean): MeshData {
  const { verts, faces } = toPolys(m); const polys = all ? new Set(faces.map((_, i) => i)) : selPolygons(m, sel); if (!polys.size) return m;
  if (mode === 3) return triangulate(m, sel);
  const mid = new Map<string, number>();
  const midpoint = (a: number, b: number) => { const k = edgeKey(a, b); if (!mid.has(k)) { mid.set(k, verts.length); verts.push(mul(add(verts[a], verts[b]), 0.5)); } return mid.get(k)!; };
  const out: number[][] = [];
  faces.forEach((f, pi) => {
    if (!polys.has(pi)) { out.push(f); return; }
    if (mode === 2) { const ci = verts.length; verts.push(faceCenter(verts, f)); for (let i = 0; i < f.length; i++) out.push([f[i], f[(i + 1) % f.length], ci]); return; }
    if (mode === 1) { const ms = f.map((v, i) => midpoint(v, f[(i + 1) % f.length])); for (let i = 0; i < f.length; i++) out.push([f[i], ms[i], ms[(i - 1 + f.length) % f.length]]); out.push(ms); return; }
    const c = faceCenter(verts, f); const ci = verts.length; verts.push(c);
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], p = f[(i - 1 + f.length) % f.length]; out.push([a, midpoint(a, b), ci, midpoint(p, a)]); }
  });
  // neighbours of subdivided faces must include new midpoints to stay watertight
  if (mid.size) for (let i = 0; i < out.length; i++) { const f = out[i]; const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (mid.has(k) && !f.includes(mid.get(k)!)) nf.push(mid.get(k)!); } out[i] = nf; }
  return fromPolys(verts, out);
}
/** Local Subdivision Refinement (meshlocalsubdivisionop): Catmull-Clark refinement of the selected polygons only;
 *  island boundary edges are split linearly and boundary vertices stay put. */
export function localSubdivision(m: MeshData, sel: CompSel, level = 1): MeshData {
  let cur = m, curSel = sel;
  for (let l = 0; l < Math.max(1, level | 0); l++) {
    const { verts, faces } = toPolys(cur); const polys = selPolygons(cur, curSel); if (!polys.size) return cur;
    const bverts = boundaryVerts(faces, polys), bnd = boundaryEdges(faces, polys);
    const facePt = new Map<number, number>(); for (const pi of polys) { facePt.set(pi, verts.length); verts.push(faceCenter(verts, faces[pi])); }
    const edgeFaces = new Map<string, number[]>(); for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); edgeFaces.set(k, [...(edgeFaces.get(k) ?? []), pi]); } }
    const edgePt = new Map<string, number>();
    for (const [k, fs] of edgeFaces) { const [a, b] = k.split('-').map(Number); let p = mul(add(verts[a], verts[b]), 0.5); if (!bnd.has(k) && fs.length === 2) { p = mul(add(add(verts[a], verts[b]), add(verts[facePt.get(fs[0])!], verts[facePt.get(fs[1])!])), 0.25); } edgePt.set(k, verts.length); verts.push(p); }
    // interior vertices: Catmull-Clark vertex rule
    const vFaces = new Map<number, number[]>(); for (const pi of polys) for (const v of faces[pi]) vFaces.set(v, [...(vFaces.get(v) ?? []), pi]);
    const moved = new Map<number, V>();
    for (const [v, fs] of vFaces) {
      if (bverts.has(v)) continue; const n = fs.length;
      let F: V = [0, 0, 0]; for (const pi of fs) F = add(F, verts[facePt.get(pi)!]); F = mul(F, 1 / n);
      const nb = new Set<number>(); for (const pi of fs) { const f = faces[pi]; const i = f.indexOf(v); nb.add(f[(i + 1) % f.length]); nb.add(f[(i - 1 + f.length) % f.length]); }
      let R: V = [0, 0, 0]; for (const q of nb) R = add(R, mul(add(verts[v], verts[q]), 0.5)); R = mul(R, 1 / nb.size);
      moved.set(v, mul(add(add(F, mul(R, 2)), mul(verts[v], n - 3)), 1 / n));
    }
    for (const [v, p] of moved) verts[v] = p;
    const out: number[][] = []; const newSel: number[] = [];
    faces.forEach((f, pi) => {
      if (!polys.has(pi)) { const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (edgePt.has(k)) nf.push(edgePt.get(k)!); } out.push(nf); return; }
      const ci = facePt.get(pi)!;
      for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], p = f[(i - 1 + f.length) % f.length]; newSel.push(out.length); out.push([a, edgePt.get(edgeKey(a, b))!, ci, edgePt.get(edgeKey(p, a))!]); }
    });
    cur = fromPolys(verts, out); curSel = { kind: 'polygon', indices: newSel };
  }
  return cur;
}
/** Split Edge (splitedgeop): inserts a point at `ratio` on each edge; with `connect` the new points of a polygon are joined (a chord
 *  for two points, an inner polygon plus corner pieces for three or more). */
export function splitEdges(m: MeshData, sel: CompSel, ratio = 0.5, connect = true): MeshData {
  const { verts, faces } = toPolys(m); const edges = sel.kind === 'edge' ? (sel.edges ?? []) : [];
  if (!edges.length) return m;
  const mid = new Map<string, number>();
  for (const [a, b] of edges) { const k = edgeKey(a, b); if (!mid.has(k)) { mid.set(k, verts.length); verts.push(add(verts[a], mul(sub(verts[b], verts[a]), ratio))); } }
  const out: number[][] = [];
  for (const f of faces) {
    const nf: number[] = [], isMid: boolean[] = [];
    for (let j = 0; j < f.length; j++) { nf.push(f[j]); isMid.push(false); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (mid.has(k)) { nf.push(mid.get(k)!); isMid.push(true); } }
    const mids = nf.map((v, i) => isMid[i] ? i : -1).filter(i => i >= 0);
    if (!connect || mids.length < 2) { out.push(nf); continue; }
    if (mids.length === 2) { const [i0, i1] = mids; const a: number[] = [], b: number[] = []; for (let i = i0; ; i = (i + 1) % nf.length) { a.push(nf[i]); if (i === i1) break; } for (let i = i1; ; i = (i + 1) % nf.length) { b.push(nf[i]); if (i === i0) break; } out.push(a, b); continue; }
    // three or more: inner polygon of the new points + one piece per gap
    out.push(mids.map(i => nf[i]));
    for (let q = 0; q < mids.length; q++) { const i0 = mids[q], i1 = mids[(q + 1) % mids.length]; const piece: number[] = []; for (let i = i0; ; i = (i + 1) % nf.length) { piece.push(nf[i]); if (i === i1) break; } if (piece.length >= 3) out.push(piece); }
  }
  return fromPolys(verts, out);
}
export function weldPoints(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const pts = [...selPoints(m, sel)]; if (pts.length < 2) return m;
  let c: V = [0, 0, 0]; for (const p of pts) c = add(c, verts[p]); c = mul(c, 1 / pts.length);
  const target = pts[0]; verts[target] = c; const set = new Set(pts);
  return compact(verts, remapFaces(faces, v => set.has(v) ? target : v));
}
/** Collapse: selected components shrink to one point at the centre of their bounding box (as Softimage does for polygon islands). */
export function collapseComponents(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m);
  const polys = sel.kind === 'polygon' ? selPolygons(m, sel) : new Set<number>();
  const groups: number[][] = sel.kind === 'polygon' ? islands(faces, polys).map(g => [...new Set(g.flatMap(pi => faces[pi]))]) : sel.kind === 'edge' ? (sel.edges ?? []).map(e => [e[0], e[1]]) : [[...selPoints(m, sel)]];
  const remap = new Map<number, number>();
  for (const g of groups) { if (g.length < 2) continue; const min: V = [Infinity, Infinity, Infinity], max: V = [-Infinity, -Infinity, -Infinity]; for (const v of g) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], verts[v][k]); max[k] = Math.max(max[k], verts[v][k]); } const ci = verts.length; verts.push(mul(add(min, max), 0.5)); for (const v of g) remap.set(v, ci); }
  const kept = faces.filter((_, pi) => !polys.has(pi));
  return compact(verts, remapFaces(kept, v => remap.get(v) ?? v));
}
/** Connected groups of selected polygons (sharing an edge). */
function islands(faces: number[][], polys: Set<number>): number[][] {
  const byEdge = new Map<string, number[]>(); for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); byEdge.set(k, [...(byEdge.get(k) ?? []), pi]); } }
  const seen = new Set<number>(), out: number[][] = [];
  for (const start of polys) { if (seen.has(start)) continue; const g: number[] = [], st = [start]; seen.add(start); while (st.length) { const pi = st.pop()!; g.push(pi); const f = faces[pi]; for (let i = 0; i < f.length; i++) for (const q of byEdge.get(edgeKey(f[i], f[(i + 1) % f.length])) ?? []) if (!seen.has(q)) { seen.add(q); st.push(q); } } out.push(g); }
  return out;
}
/** Dissolve Component: each polygon island becomes one polygon (its boundary loop); interior vertices disappear. */
export function dissolvePolygons(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const out = faces.filter((_, pi) => !polys.has(pi));
  for (const g of islands(faces, polys)) {
    const bnd = boundaryEdges(faces, new Set(g)); if (!bnd.size) continue;
    const next = new Map<number, number>(); for (const [, [a, b]] of bnd) next.set(a, b);
    const start = next.keys().next().value as number; const loop: number[] = []; let v = start; const guard = new Set<number>();
    while (!guard.has(v)) { guard.add(v); loop.push(v); const n = next.get(v); if (n === undefined) break; v = n; if (v === start) break; }
    if (loop.length >= 3) out.push(loop);
  }
  return compact(verts, out);
}
/** Disconnect Component: separates the island from the rest of the mesh by duplicating its boundary vertices. */
export function disconnectPolygons(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const bverts = boundaryVerts(faces, polys); const remap = new Map<number, number>();
  for (const v of bverts) { remap.set(v, verts.length); verts.push([...verts[v]] as V); }
  for (const pi of polys) faces[pi] = faces[pi].map(v => remap.get(v) ?? v);
  return fromPolys(verts, faces);
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
/** Apply Thickness: adds an outward shell offset by `amount` (orthogonal to each face, as Softimage's default 0.5). */
export function applyThickness(m: MeshData, amount: number): MeshData {
  const { verts, faces } = toPolys(m); const n = verts.length;
  const normalsAt: V[][] = verts.map(() => []); for (const f of faces) { const fn = faceNormal(verts, f); for (const v of f) normalsAt[v].push(fn); }
  for (let i = 0; i < n; i++) verts.push(miterOffset(verts[i], dedupeNormals(normalsAt[i]), amount));
  const out = [...faces.map(f => [...f].reverse()), ...faces.map(f => f.map(v => v + n))];
  const bnd = boundaryEdges(faces, new Set(faces.map((_, i) => i)));
  for (const [, [a, b]] of bnd) out.push([a, b, b + n, a + n]);
  return fromPolys(verts, out);
}
function dedupeNormals(ns: V[]): V[] { const out: V[] = []; for (const n of ns) if (!out.some(o => dot(o, n) > 0.9999)) out.push(n); return out; }
/** Slice Polygons (slicepolygonsop): cuts the selected polygons with a plane; neighbours receive the new points. */
export function slicePolygonsPlane(m: MeshData, sel: CompSel, normal: V, d: number): MeshData {
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i));
  const side = (v: number) => dot(verts[v], normal) - d;
  const cut = new Map<string, number>();
  const cutPoint = (a: number, b: number) => { const k = edgeKey(a, b); if (!cut.has(k)) { const sa = side(a), sb = side(b); const t = sa / (sa - sb); cut.set(k, verts.length); verts.push(add(verts[a], mul(sub(verts[b], verts[a]), t))); } return cut.get(k)!; };
  const out: number[][] = [];
  faces.forEach((f, pi) => {
    if (!polys.has(pi)) { out.push(f); return; }
    const s = f.map(side); if (!s.some(x => x > 1e-9) || !s.some(x => x < -1e-9)) { out.push(f); return; }
    const pos: number[] = [], neg: number[] = [];
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (Math.abs(s[i]) <= 1e-9) { pos.push(a); neg.push(a); } else (s[i] > 0 ? pos : neg).push(a); if ((s[i] > 1e-9 && s[(i + 1) % f.length] < -1e-9) || (s[i] < -1e-9 && s[(i + 1) % f.length] > 1e-9)) { const c = cutPoint(a, b); pos.push(c); neg.push(c); } }
    if (pos.length >= 3) out.push(pos); if (neg.length >= 3) out.push(neg);
  });
  if (cut.size) for (let i = 0; i < out.length; i++) { const f = out[i]; const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (cut.has(k) && !f.includes(cut.get(k)!)) nf.push(cut.get(k)!); } out[i] = nf; }
  return fromPolys(verts, out);
}
/** Slice along a bounding-box axis: the plane goes through the selection's bounding box at `percent` (+ offset). */
export function sliceAxis(m: MeshData, sel: CompSel, axis: 0 | 1 | 2, offset: number, usebbox: boolean, percent = 50): MeshData {
  const { verts } = toPolys(m); const pts = sel.indices.length ? [...selPoints(m, sel)] : verts.map((_, i) => i);
  let lo = Infinity, hi = -Infinity; for (const v of pts) { lo = Math.min(lo, verts[v][axis]); hi = Math.max(hi, verts[v][axis]); }
  const d = (usebbox ? lo + (hi - lo) * percent / 100 : 0) + offset; const n: V = [0, 0, 0]; n[axis] = 1;
  return slicePolygonsPlane(m, sel, n, d);
}
/** Dice Polygons (dicepolygonsop): cuts the selected polygons with evenly spaced planes across their bounding box
 *  (style 0 XY, 1 YZ, 2 XZ, 3 XYZ; `nbslices` per axis, or a grid of `gridsize` cells). */
export function dicePolygons(m: MeshData, sel: CompSel, style: number, nb: [number, number, number], gridlike: boolean, gridsize: number): MeshData {
  const axes: (0 | 1 | 2)[] = style === 0 ? [0, 1] : style === 1 ? [1, 2] : style === 2 ? [0, 2] : [0, 1, 2];
  let cur = m; let curSel = sel;
  const { verts } = toPolys(m); const pts = sel.indices.length ? [...selPoints(m, sel)] : verts.map((_, i) => i);
  const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]; for (const v of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], verts[v][k]); hi[k] = Math.max(hi[k], verts[v][k]); }
  for (const a of axes) {
    const cuts: number[] = [];
    if (gridlike) { const g = Math.max(1e-3, gridsize); for (let x = Math.ceil(lo[a] / g) * g; x < hi[a] - 1e-6; x += g) if (x > lo[a] + 1e-6) cuts.push(x); }
    else { const n = Math.max(0, nb[a] | 0); for (let i = 1; i <= n; i++) cuts.push(lo[a] + (hi[a] - lo[a]) * i / (n + 1)); }
    for (const d of cuts) {
      const nrm: V = [0, 0, 0]; nrm[a] = 1;
      cur = slicePolygonsPlane(cur, curSel, nrm, d);
      if (!sel.indices.length) continue;
      // polygons produced from the selection are the ones whose centre lies inside the original selection's bounding box
      const { verts: v2 } = toPolys(cur); const inside: number[] = [];
      cur.polygons.forEach((f, i) => { const c = faceCenter(v2, f); if ([0, 1, 2].every(k => c[k] >= lo[k] - 1e-4 && c[k] <= hi[k] + 1e-4)) inside.push(i); });
      curSel = { kind: 'polygon', indices: inside };
    }
  }
  return cur;
}
/** Polygon Reduction: collapses the shortest edges until the polygon count reaches `ratio` of the original. */
export function reducePolygons(m: MeshData, ratio: number): MeshData {
  let { verts, faces } = toPolys(m); const target = Math.max(4, Math.round(faces.length * Math.min(1, Math.max(0.01, ratio))));
  let guard = 0;
  while (faces.length > target && guard++ < 10000) {
    let best: [number, number] | null = null, bestLen = Infinity; const seen = new Set<string>();
    for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); if (seen.has(k)) continue; seen.add(k); const l = Math.hypot(...sub(verts[a], verts[b])); if (l < bestLen) { bestLen = l; best = [a, b]; } }
    if (!best) break; const [a, b] = best; verts[a] = mul(add(verts[a], verts[b]), 0.5);
    faces = remapFaces(faces, v => v === b ? a : v);
  }
  return compact(verts, faces);
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

function remapFaces(faces: number[][], map: (v: number) => number): number[][] {
  const out: number[][] = [];
  for (const f of faces) { const nf: number[] = []; for (const v of f) { const nv = map(v); if (nf[nf.length - 1] !== nv) nf.push(nv); } while (nf.length > 1 && nf[0] === nf[nf.length - 1]) nf.pop(); if (new Set(nf).size >= 3) out.push(nf); }
  return out;
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
