// More polygon-mesh operations: Catmull-Clark subdivision, bevel, bridge, cap hole, quadrangulate,
// dissolve, disconnect, spin/turn edges, slice, dice, polygon reduction, merge, lattice deformation, bend/fold/wave.
import { MeshData } from './geometry';
import { CompSel, toPolys, fromPolys, faceNormal, faceCenter, edgeKey, selPolygons, selPoints } from './topology';

type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ------------------------------------------------------- subdivision
export function catmullClark(m: MeshData, levels: number, creases = new Map<string, number>(), linear = false): MeshData {
  let cur = m;
  for (let l = 0; l < levels; l++) cur = ccOnce(cur, creases, linear);
  return cur;
}
function ccOnce(m: MeshData, creases: Map<string, number>, linear: boolean): MeshData {
  const { verts, faces } = toPolys(m); const n = verts.length;
  const facePts: V[] = faces.map(f => faceCenter(verts, f));
  const edgeFaces = new Map<string, number[]>(); const edgeVerts = new Map<string, [number, number]>();
  faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(fi); edgeVerts.set(k, [a, b]); } });
  const out: V[] = [];
  const vIndex = new Map<number, number>(), eIndex = new Map<string, number>(), fIndex = new Map<number, number>();
  // vertex adjacency
  const vEdges = new Map<number, string[]>(); for (const [k, [a, b]] of edgeVerts) { (vEdges.get(a) ?? vEdges.set(a, []).get(a)!).push(k); (vEdges.get(b) ?? vEdges.set(b, []).get(b)!).push(k); }
  const vFaces = new Map<number, number[]>(); faces.forEach((f, fi) => f.forEach(v => (vFaces.get(v) ?? vFaces.set(v, []).get(v)!).push(fi)));
  // new vertex positions
  for (let v = 0; v < n; v++) {
    const es = vEdges.get(v) ?? [], fs = vFaces.get(v) ?? [];
    const boundary = es.filter(k => (edgeFaces.get(k)?.length ?? 0) < 2); const creased = es.filter(k => (creases.get(k) ?? 0) >= 1);
    let p: V = verts[v];
    if (!linear && fs.length) {
      if (boundary.length >= 2 || creased.length >= 2) { // crease/boundary rule
        const bs = boundary.length >= 2 ? boundary : creased; let s: V = [0, 0, 0]; for (const k of bs.slice(0, 2)) { const [a, b] = edgeVerts.get(k)!; s = add(s, verts[a === v ? b : a]); }
        p = add(mul(verts[v], 0.75), mul(s, 0.125));
      } else if (boundary.length === 0 && creased.length < 2) {
        const k = es.length; let F: V = [0, 0, 0]; for (const fi of fs) F = add(F, facePts[fi]); F = mul(F, 1 / fs.length);
        let R: V = [0, 0, 0]; for (const ek of es) { const [a, b] = edgeVerts.get(ek)!; R = add(R, mul(add(verts[a], verts[b]), 0.5)); } R = mul(R, 1 / k);
        p = mul(add(add(F, mul(R, 2)), mul(verts[v], k - 3)), 1 / k);
      }
    }
    vIndex.set(v, out.length); out.push(p);
  }
  for (const [k, [a, b]] of edgeVerts) {
    const fs = edgeFaces.get(k)!; const mid = mul(add(verts[a], verts[b]), 0.5); let p = mid;
    if (!linear && fs.length === 2 && (creases.get(k) ?? 0) < 1) { let F: V = [0, 0, 0]; for (const fi of fs) F = add(F, facePts[fi]); p = mul(add(add(verts[a], verts[b]), F), 0.25); }
    eIndex.set(k, out.length); out.push(p);
  }
  faces.forEach((_, fi) => { fIndex.set(fi, out.length); out.push(facePts[fi]); });
  const nf: number[][] = [];
  faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], p = f[(i - 1 + f.length) % f.length]; nf.push([vIndex.get(a)!, eIndex.get(edgeKey(a, b))!, fIndex.get(fi)!, eIndex.get(edgeKey(p, a))!]); } });
  return fromPolys(out, nf);
}

// ----------------------------------------------------------- bevel
export function bevel(m: MeshData, sel: CompSel, amount: number): MeshData {
  const { verts, faces } = toPolys(m);
  if (sel.kind === 'polygon') { // inset + keep flat: chamfer polygon border
    const polys = selPolygons(m, sel); const out = [...faces]; for (const pi of polys) { const f = faces[pi], c = faceCenter(verts, f); const inner = f.map(v => { verts.push(add(verts[v], mul(sub(c, verts[v]), amount))); return verts.length - 1; }); for (let i = 0; i < f.length; i++) out.push([f[i], f[(i + 1) % f.length], inner[(i + 1) % f.length], inner[i]]); out[pi] = inner; }
    return fromPolys(verts, out);
  }
  // vertex / edge bevel: chamfer each selected vertex (edge bevel chamfers both end vertices)
  const pts = selPoints(m, sel); const newFaces: number[][] = []; const corner = new Map<string, number>(); // key v|f -> new vertex
  const vFaces = new Map<number, number[]>(); faces.forEach((f, fi) => f.forEach(v => (vFaces.get(v) ?? vFaces.set(v, []).get(v)!).push(fi)));
  const out = faces.map((f, fi) => f.map(v => {
    if (!pts.has(v)) return v;
    const k = v + '|' + fi; if (corner.has(k)) return corner.get(k)!;
    const c = faceCenter(verts, f); const i = f.indexOf(v); const prev = verts[f[(i - 1 + f.length) % f.length]], next = verts[f[(i + 1) % f.length]];
    const dir = norm(add(sub(prev, verts[v]), sub(next, verts[v]))); const p = add(verts[v], mul(dir, amount * Math.min(Math.hypot(...sub(prev, verts[v])), Math.hypot(...sub(next, verts[v]))) * 0.5));
    void c; verts.push(p); corner.set(k, verts.length - 1); return verts.length - 1;
  }));
  for (const v of pts) { // cap the chamfer with a polygon ordered around the vertex normal
    const ring = [...corner].filter(([k]) => k.startsWith(v + '|')).map(([, idx]) => idx); if (ring.length < 3) continue;
    let nrm: V = [0, 0, 0]; for (const fi of vFaces.get(v) ?? []) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm);
    const c = verts[v]; const x = norm(sub(verts[ring[0]], c)), y = cross(nrm, x);
    ring.sort((a, b) => Math.atan2(dot(sub(verts[a], c), y), dot(sub(verts[a], c), x)) - Math.atan2(dot(sub(verts[b], c), y), dot(sub(verts[b], c), x)));
    newFaces.push(ring.reverse());
  }
  return fromPolys(verts, [...out, ...newFaces]);
}

// ----------------------------------------------------------- bridge / cap
export function bridgePolygons(m: MeshData, sel: CompSel, subdiv = 1): MeshData {
  const { verts, faces } = toPolys(m); const polys = [...selPolygons(m, sel)]; if (polys.length !== 2) throw new Error('Bridge needs exactly two polygons');
  const [a, b] = polys.map(p => faces[p]); if (a.length !== b.length) throw new Error('Bridge: polygons must have the same number of edges');
  const ca = faceCenter(verts, a), cb = faceCenter(verts, b);
  // align: pick the rotation of b (reversed) minimizing total distance
  const rb = [...b].reverse(); let best = 0, bd = Infinity;
  for (let s = 0; s < rb.length; s++) { let d = 0; for (let i = 0; i < a.length; i++) d += Math.hypot(...sub(verts[a[i]], verts[rb[(i + s) % rb.length]])); if (d < bd) { bd = d; best = s; } }
  const bb = rb.map((_, i) => rb[(i + best) % rb.length]);
  const rings: number[][] = [a]; for (let s = 1; s < subdiv; s++) rings.push(a.map((v, i) => { const t = s / subdiv; verts.push(add(mul(verts[v], 1 - t), mul(verts[bb[i]], t))); return verts.length - 1; })); rings.push(bb);
  const out = faces.filter((_, i) => !polys.includes(i));
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < a.length; i++) out.push([rings[r][i], rings[r + 1][i], rings[r + 1][(i + 1) % a.length], rings[r][(i + 1) % a.length]]);
  void ca; void cb; return fromPolys(verts, out);
}
export function capHoles(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m);
  const count = new Map<string, number>(), dir = new Map<string, [number, number]>();
  for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); count.set(k, (count.get(k) ?? 0) + 1); dir.set(k, [a, b]); }
  const bnd = [...count].filter(([, c]) => c === 1).map(([k]) => dir.get(k)!);
  const next = new Map<number, number>(); for (const [a, b] of bnd) next.set(b, a); // reversed winding closes the hole
  const want = sel.indices.length ? selPoints(m, sel) : null; const used = new Set<number>(); const out = [...faces];
  for (const [a] of bnd) { if (used.has(a)) continue; const loop: number[] = []; let v = a; while (v !== undefined && !used.has(v)) { used.add(v); loop.push(v); v = next.get(v)!; if (v === a) break; } if (loop.length >= 3 && (!want || loop.some(x => want.has(x)))) out.push(loop); }
  return fromPolys(verts, out);
}
export function quadrangulate(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i));
  const tris = new Map<string, number[]>(); const out: number[][] = []; const done = new Set<number>();
  faces.forEach((f, fi) => { if (polys.has(fi) && f.length === 3) for (let i = 0; i < 3; i++) { const k = edgeKey(f[i], f[(i + 1) % 3]); if (tris.has(k)) { const g = tris.get(k)!; const gi = faces.indexOf(g); if (done.has(gi) || done.has(fi)) continue; const [a, b] = [f[i], f[(i + 1) % 3]]; const c = f[(i + 2) % 3], d = g.find(v => v !== a && v !== b)!; out.push([a, c, b, d].reverse().length ? [c, a, d, b] : []); done.add(fi); done.add(gi); tris.delete(k); return; } tris.set(k, f); } });
  faces.forEach((f, fi) => { if (!done.has(fi)) out.push(f); });
  return fromPolys(verts, out);
}
export function dissolve(m: MeshData, sel: CompSel): MeshData {
  // remove selected edges and merge their faces; removing points dissolves all their edges
  const { verts, faces } = toPolys(m);
  const edges = new Set<string>(); if (sel.kind === 'edge') for (const e of sel.edges ?? []) edges.add(edgeKey(e[0], e[1]));
  else if (sel.kind === 'point') { const pts = new Set(sel.indices); for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (pts.has(a) || pts.has(b)) edges.add(edgeKey(a, b)); } }
  else { const polys = selPolygons(m, sel); for (const pi of polys) { const f = faces[pi]; for (let i = 0; i < f.length; i++) edges.add(edgeKey(f[i], f[(i + 1) % f.length])); } }
  if (!edges.size) return m;
  // union-find faces across dissolved edges, then rebuild each group's outer boundary
  const parent = faces.map((_, i) => i); const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
  const edgeFaces = new Map<string, number[]>(); faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(fi); } });
  for (const k of edges) { const fs = edgeFaces.get(k) ?? []; if (fs.length === 2) parent[find(fs[0])] = find(fs[1]); }
  const groups = new Map<number, number[]>(); faces.forEach((_, i) => (groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))!).push(i));
  const out: number[][] = [];
  for (const [, fs] of groups) {
    if (fs.length === 1) { out.push(faces[fs[0]]); continue; }
    const cnt = new Map<string, number>(), dir = new Map<string, [number, number]>();
    for (const fi of fs) { const f = faces[fi]; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = edgeKey(a, b); cnt.set(k, (cnt.get(k) ?? 0) + 1); dir.set(k, [a, b]); } }
    const next = new Map<number, number>(); for (const [k, c] of cnt) if (c === 1) { const [a, b] = dir.get(k)!; next.set(a, b); }
    const start = next.keys().next().value as number | undefined; if (start === undefined) continue;
    const loop: number[] = []; let v = start; const seen = new Set<number>(); while (v !== undefined && !seen.has(v)) { seen.add(v); loop.push(v); v = next.get(v)!; }
    if (loop.length >= 3) out.push(loop);
  }
  // drop vertices no longer used
  const used = new Set(out.flat()); const map = new Map<number, number>(); const nv: V[] = []; for (const v of [...used].sort((a, b) => a - b)) { map.set(v, nv.length); nv.push(verts[v]); }
  return fromPolys(nv, out.map(f => f.map(v => map.get(v)!)));
}
export function disconnect(m: MeshData, sel: CompSel): MeshData {
  const { verts, faces } = toPolys(m); const polys = selPolygons(m, sel); if (!polys.size) return m;
  const remap = new Map<number, number>();
  const out = faces.map((f, fi) => !polys.has(fi) ? f : f.map(v => { if (!remap.has(v)) { verts.push([...verts[v]] as V); remap.set(v, verts.length - 1); } return remap.get(v)!; }));
  return fromPolys(verts, out);
}
export function spinEdges(m: MeshData, sel: CompSel, forward = true): MeshData {
  const { verts, faces } = toPolys(m); if (sel.kind !== 'edge') return m;
  const out = faces.map(f => [...f]);
  for (const [a, b] of sel.edges ?? []) {
    const fs = out.map((f, i) => [f, i] as const).filter(([f]) => f.includes(a) && f.includes(b) && Math.abs(f.indexOf(a) - f.indexOf(b)) % (f.length - 1) <= 1 || (f.includes(a) && f.includes(b) && (f.indexOf(a) + 1) % f.length === f.indexOf(b)) || (f.includes(a) && f.includes(b) && (f.indexOf(b) + 1) % f.length === f.indexOf(a)));
    if (fs.length !== 2) continue;
    const [[f1, i1], [f2, i2]] = fs;
    const merged = mergeTwo(f1, f2, a, b); if (!merged) continue; // polygon around both faces
    // choose new diagonal: shift one step around the merged loop
    const ia = merged.indexOf(a), ib = merged.indexOf(b); const shift = forward ? 1 : -1;
    const na = merged[(ia + shift + merged.length) % merged.length], nb = merged[(ib + shift + merged.length) % merged.length];
    const sp = splitLoop(merged, na, nb); if (!sp) continue;
    out[i1] = sp[0]; out[i2] = sp[1];
  }
  return fromPolys(verts, out);
}
function mergeTwo(f1: number[], f2: number[], a: number, b: number): number[] | null {
  const i1 = f1.indexOf(a), j1 = f1.indexOf(b); if (i1 < 0 || j1 < 0) return null;
  // walk f1 from b around to a (excluding edge a-b), then f2 from a around to b
  const walk = (f: number[], from: number, to: number) => { const out: number[] = []; let i = f.indexOf(from); for (let k = 0; k < f.length; k++) { out.push(f[i]); if (f[i] === to) break; i = (i + 1) % f.length; } return out; };
  const fwd1 = (f1[(i1 + 1) % f1.length] === b); const p1 = fwd1 ? walk(f1, b, a) : walk(f1, a, b).reverse();
  const fwd2 = (f2[(f2.indexOf(b) + 1) % f2.length] === a); const p2 = fwd2 ? walk(f2, a, b) : walk(f2, b, a).reverse();
  const loop = [...p1.slice(0, -1), ...p2.slice(0, -1)]; return new Set(loop).size === loop.length ? loop : null;
}
function splitLoop(loop: number[], a: number, b: number): [number[], number[]] | null {
  const ia = loop.indexOf(a), ib = loop.indexOf(b); if (ia < 0 || ib < 0 || ia === ib) return null;
  const one: number[] = []; let i = ia; while (true) { one.push(loop[i]); if (i === ib) break; i = (i + 1) % loop.length; }
  const two: number[] = []; i = ib; while (true) { two.push(loop[i]); if (i === ia) break; i = (i + 1) % loop.length; }
  return one.length >= 3 && two.length >= 3 ? [one, two] : null;
}
export function slice(m: MeshData, sel: CompSel, axis: number, offset: number): MeshData { const n: V = [0, 0, 0]; n[axis] = 1; return slicePlane(m, sel, n, offset); }
export function slicePlane(m: MeshData, sel: CompSel, normal: V, d: number): MeshData {
  // cut selected polygons (or all) by the plane normal·p = d, inserting edge points
  const { verts, faces } = toPolys(m); const polys = sel.indices.length ? selPolygons(m, sel) : new Set(faces.map((_, i) => i));
  const side = (v: V) => dot(v, normal) - d;
  const mid = new Map<string, number>(); const out: number[][] = [];
  faces.forEach((f, fi) => {
    if (!polys.has(fi)) { out.push(f); return; }
    const ring: number[] = []; const cutIdx: number[] = [];
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; ring.push(a); const da = side(verts[a]), db = side(verts[b]); if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const k = edgeKey(a, b); if (!mid.has(k)) { const t = da / (da - db); verts.push(add(verts[a], mul(sub(verts[b], verts[a]), t))); mid.set(k, verts.length - 1); } cutIdx.push(ring.length); ring.push(mid.get(k)!); } }
    if (cutIdx.length === 2) { const sp = splitLoop(ring, ring[cutIdx[0]], ring[cutIdx[1]]); if (sp) { out.push(sp[0], sp[1]); return; } }
    out.push(ring);
  });
  // neighbours sharing a cut edge must include the new point
  const fixed = out.map(f => { const nf: number[] = []; for (let j = 0; j < f.length; j++) { nf.push(f[j]); const k = edgeKey(f[j], f[(j + 1) % f.length]); if (mid.has(k) && !f.includes(mid.get(k)!)) nf.push(mid.get(k)!); } return nf; });
  return fromPolys(verts, fixed);
}
export function dice(m: MeshData, sel: CompSel, size: number): MeshData {
  let cur = m; const { verts } = toPolys(m); const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
  for (let axis = 0; axis < 3; axis++) for (let o = Math.ceil(mn[axis] / size) * size; o < mx[axis]; o += size) { if (Math.abs(o - mn[axis]) < 1e-6) continue; cur = slice(cur, { kind: 'polygon', indices: [] }, axis, o); }
  void sel; return cur;
}
export function polygonReduction(m: MeshData, ratio: number): MeshData {
  // iterative shortest-edge collapse until the polygon count reaches ratio * original
  let { verts, faces } = toPolys(m); const target = Math.max(4, Math.floor(faces.length * ratio));
  let guard = 0;
  while (faces.length > target && guard++ < 5000) {
    let best: [number, number] | null = null, bl = Infinity;
    for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; const l = Math.hypot(...sub(verts[a], verts[b])); if (l < bl) { bl = l; best = [a, b]; } }
    if (!best) break; const [a, b] = best; verts[a] = mul(add(verts[a], verts[b]), 0.5);
    faces = faces.map(f => f.map(v => v === b ? a : v).filter((v, i, arr) => v !== arr[(i + 1) % arr.length])).filter(f => new Set(f).size >= 3);
  }
  return fromPolys(verts, faces);
}
export function mergeMeshes(parts: { mesh: MeshData; matrix: number[] }[]): MeshData {
  const verts: V[] = [], faces: number[][] = [];
  for (const { mesh, matrix } of parts) { const base = verts.length; const { verts: vs, faces: fs } = toPolys(mesh); for (const v of vs) verts.push(xform(v, matrix)); for (const f of fs) faces.push(f.map(i => i + base)); }
  return fromPolys(verts, faces);
}
export function xform(v: V, m: number[]): V { // column-major 4x4
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
}

// ----------------------------------------------------------- lattice & deformers
export interface LatticeData { sub: [number, number, number]; points: V[]; min: V; max: V; }
export function makeLattice(sub: [number, number, number], min: V, max: V): LatticeData {
  const pts: V[] = []; for (let k = 0; k <= sub[2]; k++) for (let j = 0; j <= sub[1]; j++) for (let i = 0; i <= sub[0]; i++) pts.push([min[0] + (max[0] - min[0]) * i / sub[0], min[1] + (max[1] - min[1]) * j / sub[1], min[2] + (max[2] - min[2]) * k / sub[2]]);
  return { sub, points: pts, min, max };
}
export function latticeDeform(m: MeshData, lat: LatticeData, toLattice: number[], fromLattice: number[]): MeshData {
  const { verts, faces } = toPolys(m); const [sx, sy, sz] = lat.sub; const idx = (i: number, j: number, k: number) => lat.points[k * (sy + 1) * (sx + 1) + j * (sx + 1) + i];
  const nv = verts.map(v => {
    const p = xform(v, toLattice); const t = [0, 1, 2].map(a => Math.max(0, Math.min(1, (p[a] - lat.min[a]) / ((lat.max[a] - lat.min[a]) || 1))));
    const inside = [0, 1, 2].every(a => p[a] >= lat.min[a] - 1e-6 && p[a] <= lat.max[a] + 1e-6); if (!inside) return v;
    // trilinear in the cell
    const gi = t[0] * sx, gj = t[1] * sy, gk = t[2] * sz; const i0 = Math.min(sx - 1, Math.floor(gi)), j0 = Math.min(sy - 1, Math.floor(gj)), k0 = Math.min(sz - 1, Math.floor(gk)); const fx = gi - i0, fy = gj - j0, fz = gk - k0;
    let r: V = [0, 0, 0];
    for (let dk = 0; dk <= 1; dk++) for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) { const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz); r = add(r, mul(idx(i0 + di, j0 + dj, k0 + dk), w)); }
    return xform(r, fromLattice);
  });
  return fromPolys(nv, faces);
}
export function bendDeform(m: MeshData, angleDeg: number, axis: number, bendAxis: number): MeshData {
  // bend along `axis` (height) about `bendAxis` with a true circular arc
  const { verts, faces } = toPolys(m); const mn = Math.min(...verts.map(v => v[axis])), mx = Math.max(...verts.map(v => v[axis])); const h = mx - mn || 1; const ang = angleDeg * Math.PI / 180; if (Math.abs(ang) < 1e-6) return m;
  const r = h / ang; const other = [0, 1, 2].find(a => a !== axis && a !== bendAxis)!;
  const nv = verts.map(v => { const t = (v[axis] - mn) / h, th = ang * t; const d = v[other] + r; const out = [...v] as V; out[axis] = mn + Math.sin(th) * d; out[other] = Math.cos(th) * d - r; return out; });
  return fromPolys(nv, faces);
}
export function foldDeform(m: MeshData, angleDeg: number, axis: number, pos: number): MeshData {
  const { verts, faces } = toPolys(m); const ang = angleDeg * Math.PI / 180; const other = (axis + 1) % 3;
  const nv = verts.map(v => { if (v[axis] <= pos) return v; const d = v[axis] - pos; const out = [...v] as V; out[axis] = pos + d * Math.cos(ang); out[other] = v[other] + d * Math.sin(ang); return out; });
  return fromPolys(nv, faces);
}
export function waveDeform(m: MeshData, amplitude: number, wavelength: number, phase: number, axis: number): MeshData {
  const { verts, faces } = toPolys(m);
  const nv = verts.map(v => { const d = Math.hypot(...[0, 1, 2].filter(a => a !== axis).map(a => v[a])); const out = [...v] as V; out[axis] += amplitude * Math.sin((d / (wavelength || 1)) * Math.PI * 2 + phase); return out; });
  return fromPolys(nv, faces);
}
export function shrinkWrap(m: MeshData, target: MeshData, toTarget: number[], fromTarget: number[], amount: number): MeshData {
  // project each point onto the nearest target triangle along the vertex normal direction (closest point approximation)
  const { verts, faces } = toPolys(m); const { verts: tv, faces: tf } = toPolys(target); const tris: [V, V, V][] = [];
  for (const f of tf) for (let i = 1; i + 1 < f.length; i++) tris.push([tv[f[0]], tv[f[i]], tv[f[i + 1]]]);
  const nv = verts.map(v => { const p = xform(v, toTarget); let best: V = p, bd = Infinity; for (const t of tris) { const q = closestOnTri(p, t); const d = Math.hypot(...sub(q, p)); if (d < bd) { bd = d; best = q; } } const r = xform(best, fromTarget); return add(v, mul(sub(r, v), amount)); });
  return fromPolys(nv, faces);
}
function closestOnTri(p: V, [a, b, c]: [V, V, V]): V {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b); const d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(p, c); const d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const den = 1 / (va + vb + vc); return add(a, add(mul(ab, vb * den), mul(ac, vc * den)));
}
export function clusterCenter(m: MeshData, sel: CompSel, centerLocal: V, restCenter: V): MeshData {
  const { verts, faces } = toPolys(m); const pts = selPoints(m, sel); const d = sub(centerLocal, restCenter);
  return fromPolys(verts.map((v, i) => pts.has(i) ? add(v, d) : v), faces);
}
export function quickStretch(m: MeshData, velocity: V, amount: number): MeshData { const { verts, faces } = toPolys(m); return fromPolys(verts.map(v => add(v, mul(velocity, amount * (dot(norm(v), norm(velocity)) > 0 ? 1 : 0.2)))), faces); }
export function curveDeform(m: MeshData, curvePts: V[], axis: number): MeshData {
  // map the mesh's `axis` extent onto the curve, keeping the other two coordinates as offsets in a moving frame
  const { verts, faces } = toPolys(m); const mn = Math.min(...verts.map(v => v[axis])), mx = Math.max(...verts.map(v => v[axis])); const h = mx - mn || 1;
  const n = curvePts.length - 1; let up: V = [0, 1, 0];
  const frames = curvePts.map((p, i) => { const t = norm(sub(curvePts[Math.min(n, i + 1)], curvePts[Math.max(0, i - 1)])); if (Math.abs(dot(t, up)) > 0.99) up = [1, 0, 0]; const x = norm(cross(up, t)), y = cross(t, x); up = y; return { p, x, y, t }; });
  const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
  const nv = verts.map(v => { const t = (v[axis] - mn) / h; const fi = Math.min(n, Math.max(0, t * n)); const i = Math.floor(fi), f = fi - i; const A = frames[i], B = frames[Math.min(n, i + 1)]; const p = add(mul(A.p, 1 - f), mul(B.p, f)); return add(p, add(mul(A.x, v[o1]), mul(A.y, v[o2]))); });
  return fromPolys(nv, faces);
}
export function meshUVProjection(m: MeshData, kind: string): Float32Array {
  // per-vertex UVs for Texture Projection presets
  const { verts } = toPolys(m); const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
  const sz = [0, 1, 2].map(k => (mx[k] - mn[k]) || 1); const uv = new Float32Array(verts.length * 2);
  verts.forEach((v, i) => {
    let u = 0, w = 0; const n = [0, 1, 2].map(k => (v[k] - mn[k]) / sz[k]);
    switch (kind) {
      case 'Planar XY': u = n[0]; w = n[1]; break; case 'Planar YZ': u = n[2]; w = n[1]; break; case 'Planar XZ': u = n[0]; w = n[2]; break;
      case 'Cylindrical': u = (Math.atan2(v[2] - (mn[2] + mx[2]) / 2, v[0] - (mn[0] + mx[0]) / 2) / (2 * Math.PI)) + 0.5; w = n[1]; break;
      case 'Spherical': { const c = [0, 1, 2].map(k => v[k] - (mn[k] + mx[k]) / 2); const r = Math.hypot(...c) || 1; u = (Math.atan2(c[2], c[0]) / (2 * Math.PI)) + 0.5; w = Math.acos(Math.max(-1, Math.min(1, c[1] / r))) / Math.PI; break; }
      default: { const c = [0, 1, 2].map(k => v[k] - (mn[k] + mx[k]) / 2); const a = c.map(Math.abs); const k = a.indexOf(Math.max(...a)); const o = [0, 1, 2].filter(x => x !== k); u = n[o[0]]; w = n[o[1]]; }
    }
    uv[i * 2] = u; uv[i * 2 + 1] = w;
  });
  return uv;
}
