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

// ----------------------------------------------------------- bevel (edge chamfer with rounding), like Softimage's bevelop
/** Softimage Absolute Distance is SI units for collide (param_8 path); mesh chamfer width uses Distance×0.125
 *  (attested grid_r08 OFF inset 0.1 for Distance 0.8). Relative keeps Distance×0.125×avgEdge. */
const BEVEL_DISTANCE_SCALE = 0.125;
/** DAT_180168380 — geometry epsilon on Softimage collide path. */
const BEVEL_COLLIDE_EPS = 1e-12;

/**
 * Softimage managecollisions ON for an all-edge bevel of a planar (all-flat) open mesh: when Absolute
 * Distance reaches half the minimum face extent, Softimage's collide queue collapses each face to its
 * centroid and rebuilds the dual (grid_r08 ON = 96 pts / 109 polys). Creased/closed meshes stay on the
 * normal chamfer path (hard-dump cube cases remain mesh_equal).
 */
function bevelCollidePlanarDual(verts: V[], faces: number[][]): MeshData {
  const edgeFaces = new Map<string, number[]>();
  faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(fi); } });
  const boundaryEdges: { a: number; b: number; fi: number }[] = [];
  const boundaryVert = new Set<number>();
  for (const [k, fs] of edgeFaces) {
    if (fs.length !== 1) continue;
    const [a, b] = k.split('-').map(Number);
    boundaryEdges.push({ a, b, fi: fs[0] });
    boundaryVert.add(a); boundaryVert.add(b);
  }
  const vFaces = new Map<number, number[]>();
  faces.forEach((f, fi) => f.forEach(v => (vFaces.get(v) ?? vFaces.set(v, []).get(v)!).push(fi)));
  const outV: V[] = [];
  const bMap = new Map<number, number>();
  for (const v of boundaryVert) { bMap.set(v, outV.length); outV.push(verts[v]); }
  const cMap = faces.map(f => { const i = outV.length; outV.push(faceCenter(verts, f)); return i; });
  const outF: number[][] = [];
  // Interior vertex → n-gon of incident face centers (Softimage junction dual).
  for (let v = 0; v < verts.length; v++) {
    if (boundaryVert.has(v)) continue;
    const fs = vFaces.get(v) ?? []; if (fs.length < 3) continue;
    const nrm = faceNormal(verts, faces[fs[0]]);
    const c0 = verts[v];
    let tx: V = [1, 0, 0]; if (Math.abs(dot(tx, nrm)) > 0.9) tx = [0, 1, 0];
    tx = norm(sub(tx, mul(nrm, dot(tx, nrm)))); const ty = cross(nrm, tx);
    const ordered = [...fs].sort((fa, fb) => {
      const ca = sub(faceCenter(verts, faces[fa]), c0), cb = sub(faceCenter(verts, faces[fb]), c0);
      return Math.atan2(dot(ca, ty), dot(ca, tx)) - Math.atan2(dot(cb, ty), dot(cb, tx));
    });
    outF.push(ordered.map(fi => cMap[fi]));
  }
  // Every boundary edge → triangle with its face center (covers BBF + corner CBC).
  for (const { a, b, fi } of boundaryEdges) {
    const f = faces[fi];
    // Wind with the face so the tri matches Softimage.
    const ia = f.indexOf(a), ib = f.indexOf(b);
    const ab = ia >= 0 && f[(ia + 1) % f.length] === b;
    outF.push(ab ? [bMap.get(a)!, bMap.get(b)!, cMap[fi]] : [bMap.get(b)!, bMap.get(a)!, cMap[fi]]);
  }
  // Non-corner boundary verts with ≥2 faces → BFF (border + two centers across an interior edge).
  for (const v of boundaryVert) {
    const fs = vFaces.get(v) ?? []; if (fs.length < 2) continue;
    let nrm: V = [0, 0, 0]; for (const fi of fs) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm);
    let tx: V = [1, 0, 0]; if (Math.abs(dot(tx, nrm)) > 0.9) tx = [0, 1, 0];
    tx = norm(sub(tx, mul(nrm, dot(tx, nrm)))); const ty = cross(nrm, tx);
    const ordered = [...fs].sort((fa, fb) => {
      const ca = sub(faceCenter(verts, faces[fa]), verts[v]), cb = sub(faceCenter(verts, faces[fb]), verts[v]);
      return Math.atan2(dot(ca, ty), dot(ca, tx)) - Math.atan2(dot(cb, ty), dot(cb, tx));
    });
    const seenPair = new Set<string>();
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i], b = ordered[(i + 1) % ordered.length];
      const fa = faces[a], fb = faces[b];
      let sharedOther = -1;
      for (let j = 0; j < fa.length; j++) {
        const p = fa[j], q = fa[(j + 1) % fa.length];
        if (p !== v && q !== v) continue;
        const other = p === v ? q : p;
        if (fb.includes(v) && fb.includes(other)) { sharedOther = other; break; }
      }
      if (sharedOther < 0) continue;
      // Only interior (manifold) edges — boundary edges already become BBF/CBC tris.
      if ((edgeFaces.get(edgeKey(v, sharedOther))?.length ?? 0) < 2) continue;
      const pk = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seenPair.has(pk)) continue;
      seenPair.add(pk);
      outF.push([bMap.get(v)!, cMap[a], cMap[b]]);
    }
  }
  return fromPolys(outV, outF.filter(f => f.length >= 3));
}

/** Bevel the selection: selected edges (or the border edges of selected polygons, or all edges at selected points) are
 *  replaced by chamfer strips of width `width`; `subdivs` > 0 rounds the strip (quadratic profile through the old edge);
 *  corner polygons close the junctions. `miter` keeps chamfer corners sharp (no junction polygon when only 2 edges meet).
 *  `manageCollisions` gates Softimage's collide path (ComputeBevelVectors param_8); `distanceParam` is the raw Softimage
 *  Distance (ratio) used for Absolute collide reach — dump-attested by grid_r08. */
export function bevelEdges(m: MeshData, sel: CompSel, width: number, subdivs = 0, miter = false, relative = true, manageCollisions = false, distanceParam?: number): MeshData {
  const { verts, faces } = toPolys(m); const n = verts.length;
  // 1. which edges are bevelled
  const selE = new Set<string>();
  if (sel.kind === 'edge') for (const e of sel.edges ?? []) selE.add(edgeKey(e[0], e[1]));
  else if (sel.kind === 'polygon') { const ps = selPolygons(m, sel); const cnt = new Map<string, number>(); for (const pi of ps) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); cnt.set(k, (cnt.get(k) ?? 0) + 1); } } for (const [k, c] of cnt) if (c === 1) selE.add(k); }
  else { const pts = selPoints(m, sel); faces.forEach(f => { for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (pts.has(a) || pts.has(b)) selE.add(edgeKey(a, b)); } }); }
  if (!selE.size) return m;
  // Softimage collide (param_8): planar all-edge selection with Absolute Distance past half-face extent
  // collapses to the face-centroid dual (si_bevel_collide_hard grid_r08 ON). Non-planar / partial
  // selections keep the chamfer path so cube hard-cases stay mesh_equal.
  if (manageCollisions && sel.kind === 'edge') {
    const allE = new Set<string>(); faces.forEach(f => { for (let i = 0; i < f.length; i++) allE.add(edgeKey(f[i], f[(i + 1) % f.length])); });
    if (selE.size === allE.size && faces.length) {
      const n0 = faceNormal(verts, faces[0]);
      const planar = faces.every(f => Math.abs(dot(faceNormal(verts, f), n0)) > 1 - 1e-6);
      if (planar) {
        let minExtent = Infinity;
        for (const f of faces) {
          // In-plane AABB extent of the face (grid quads → cell size).
          let tx: V = [1, 0, 0]; if (Math.abs(dot(tx, n0)) > 0.9) tx = [0, 1, 0];
          tx = norm(sub(tx, mul(n0, dot(tx, n0)))); const ty = cross(n0, tx);
          let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
          for (const i of f) { const u = dot(verts[i], tx), v = dot(verts[i], ty); if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
          minExtent = Math.min(minExtent, u1 - u0, v1 - v0);
        }
        const avg0 = [...selE].reduce((s, k) => { const [a, b] = k.split('-').map(Number); return s + Math.hypot(...sub(verts[a], verts[b])); }, 0) / selE.size;
        // Absolute: Softimage collide uses raw Distance SI; Relative: Distance×0.125×avg (same as chamfer).
        const collideReach = relative ? width * avg0 : (distanceParam ?? width / BEVEL_DISTANCE_SCALE);
        if (collideReach * 2 >= minExtent - BEVEL_COLLIDE_EPS) return bevelCollidePlanarDual(verts, faces);
      }
    }
  }
  const edgeFaces = new Map<string, number[]>(); faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(fi); } });
  let avg = 0; for (const k of selE) { const [a, b] = k.split('-').map(Number); avg += Math.hypot(...sub(verts[a], verts[b])); } avg /= selE.size;
  // relative: `width` is a fraction of the average selected edge length (Softimage ratio 0.5 → L/16 per side).
  const w = relative ? Math.max(1e-4, Math.min(0.49, width)) * avg : width;
  // Dihedral per edge (π = flat). Softimage edge-bevel scales the in-face offset by 1/sin(θ/2) on creases
  // (90° → √2) so the chamfer width stays visually constant around sharp cube edges; polygon-border
  // bevels keep the unscaled w (si_topo_ref Bevel vs Bevel_edges).
  const dihedral = new Map<string, number>();
  for (const [k, fs] of edgeFaces) {
    if (fs.length !== 2) { dihedral.set(k, Math.PI); continue; }
    const n0 = faceNormal(verts, faces[fs[0]]), n1 = faceNormal(verts, faces[fs[1]]);
    dihedral.set(k, Math.acos(Math.max(-1, Math.min(1, -dot(n0, n1)))));
  }
  const edgeScale = (k: string) => {
    if (sel.kind !== 'edge') return 1;
    const half = (dihedral.get(k) ?? Math.PI) / 2;
    const s = Math.sin(Math.max(1e-3, half));
    return 1 / s; // flat π → 1; 90° → √2
  };
  // 2. per face corner: sum of per-bevelled-edge inward offsets (Softimage edge bevel).
  const corner = new Map<string, number>(); // "v|fi" -> new vertex index
  const cornerPos = (f: number[], fi: number, i: number): V => {
    const v = f[i], pv = f[(i - 1 + f.length) % f.length], nv = f[(i + 1) % f.length];
    const ePrev = edgeKey(v, pv), eNext = edgeKey(v, nv);
    const e1 = selE.has(ePrev), e2 = selE.has(eNext);
    if (!e1 && !e2) return verts[v];
    const u1 = norm(sub(verts[pv], verts[v])), u2 = norm(sub(verts[nv], verts[v]));
    const s = Math.max(0.05, Math.sqrt(Math.max(0, 1 - dot(u1, u2) ** 2)));
    const len1 = Math.hypot(...sub(verts[pv], verts[v])), len2 = Math.hypot(...sub(verts[nv], verts[v]));
    const ww = Math.min(w, 0.49 * Math.min(len1, len2) * s);
    // Polygon-border path: keep the prior closed-form (exact vs si_topo_ref Bevel).
    if (sel.kind !== 'edge') {
      if (e1 && e2) return add(verts[v], mul(add(u1, u2), ww / s));
      if (e1) return add(verts[v], mul(u2, ww / s));
      return add(verts[v], mul(u1, ww / s));
    }
    // Edge selection: each bevelled edge contributes an in-face perpendicular of length w·edgeScale.
    // For orthogonal quads this equals u_other * (w·scale); creases use scale √2 (si_topo_ref Bevel_edges).
    let off: V = [0, 0, 0];
    if (e1) off = add(off, mul(u2, (ww / s) * edgeScale(ePrev)));
    if (e2) off = add(off, mul(u1, (ww / s) * edgeScale(eNext)));
    return add(verts[v], off);
  };
  const newFaces: number[][] = faces.map((f, fi) => f.map((v, i) => { if (!f.some((_, j) => selE.has(edgeKey(f[j], f[(j + 1) % f.length])) && (j === i || (j + 1) % f.length === i))) return v; const k = v + '|' + fi; if (!corner.has(k)) { verts.push(cornerPos(f, fi, i)); corner.set(k, verts.length - 1); } return corner.get(k)!; }));
  // 3. strips along each bevelled edge (between its two faces), optionally rounded through the old edge
  const strips: number[][] = [];
  for (const k of selE) {
    const fs = edgeFaces.get(k) ?? []; if (fs.length !== 2) continue; const [a, b] = k.split('-').map(Number);
    const cornerOf = (fi: number, v: number) => corner.get(v + '|' + fi)!;
    // order so the quad winds consistently with face fs[0]: in fs[0] the edge runs a→b or b→a
    const f0 = faces[fs[0]]; const i0 = f0.indexOf(a); const ab = f0[(i0 + 1) % f0.length] === b; const [p, q] = ab ? [a, b] : [b, a];
    const l0 = [cornerOf(fs[0], p), cornerOf(fs[0], q)], l1 = [cornerOf(fs[1], p), cornerOf(fs[1], q)];
    if (subdivs <= 0) { strips.push([l0[1], l0[0], l1[0], l1[1]]); continue; }
    // rounded: rows interpolate from face0's offset edge to face1's through the control points on the original edge
    let prev = l0; for (let r = 1; r <= subdivs; r++) { const t = r / (subdivs + 1); const row = [p, q].map((v, j) => { const A = verts[j ? l0[1] : l0[0]], B = verts[v], C = verts[j ? l1[1] : l1[0]]; const pt = add(add(mul(A, (1 - t) ** 2), mul(B, 2 * (1 - t) * t)), mul(C, t * t)); verts.push(pt); return verts.length - 1; }); strips.push([prev[1], prev[0], row[0], row[1]]); prev = row; }
    strips.push([prev[1], prev[0], l1[0], l1[1]]);
  }
  // 4. junction polygons at vertices touched by ≥1 bevelled edge.
  // Softimage (default miter=false, tesselatejunctions=true): a 2-bevel-edge corner becomes a triangle
  // (two neighbour-side offsets + an apex inset into the selected face) and the original vertex is removed
  // from every face; ≥3-edge junctions stay as an n-gon of corner verts only (no original vertex).
  const vFaces = new Map<number, number[]>(); faces.forEach((f, fi) => f.forEach(v => (vFaces.get(v) ?? vFaces.set(v, []).get(v)!).push(fi)));
  const junctions: number[][] = [];
  /** Softimage 2-edge corners: replace the consumed vertex in untouched neighbour faces with these two offsets (→ penta). */
  const fanIn = new Map<number, [number, number]>();
  for (let v = 0; v < n; v++) {
    const incident = [...selE].filter(k => k.split('-').map(Number).includes(v));
    if (!incident.length) continue;
    const fs = vFaces.get(v) ?? [];
    const cornersAt = fs.map(fi => corner.get(v + '|' + fi)).filter((c): c is number => c !== undefined);
    if (miter && incident.length === 2 && subdivs === 0) continue;
    // Softimage tri+penta at 2-edge corners for both polygon-border and edge selections (si_topo_ref).
    if (incident.length === 2 && subdivs === 0 && cornersAt.length >= 2) {
      // Softimage 2-edge junction: triangle of the two offsets that lie on faces with a single bevelled
      // edge at v (neighbour sides) plus an apex pushed into the face that has both bevelled edges.
      const both: number[] = []; const single: number[] = [];
      for (const fi of fs) {
        const f = faces[fi]; const i = f.indexOf(v); if (i < 0) continue;
        const e1 = selE.has(edgeKey(v, f[(i - 1 + f.length) % f.length])), e2 = selE.has(edgeKey(v, f[(i + 1) % f.length]));
        const c = corner.get(v + '|' + fi); if (c === undefined) continue;
        if (e1 && e2) both.push(c); else if (e1 || e2) single.push(c);
      }
      if (single.length >= 2) {
        let apex = both[0];
        if (apex === undefined) {
          // No dual-bevel face corner yet: place Softimage apex at v+Σ in-edge dirs·w (polygon) /
          // cornerPos-equivalent for edge selections is built above — synthesize the same sum here.
          apex = verts.length;
          const [a, b] = incident.map(k => { const [p, q] = k.split('-').map(Number); return p === v ? q : p; });
          const u1 = norm(sub(verts[a], verts[v])), u2 = norm(sub(verts[b], verts[v]));
          verts.push(sel.kind === 'edge'
            ? add(verts[v], add(mul(u1, w * edgeScale(edgeKey(v, a))), mul(u2, w * edgeScale(edgeKey(v, b)))))
            : add(verts[v], mul(add(u1, u2), w)));
        } else if (sel.kind !== 'edge') {
          // Polygon-border: Softimage apex = v+(u1+u2)·w (may refine the dual-face corner).
          const [a, b] = incident.map(k => { const [p, q] = k.split('-').map(Number); return p === v ? q : p; });
          const u1 = norm(sub(verts[a], verts[v])), u2 = norm(sub(verts[b], verts[v]));
          verts[apex] = add(verts[v], mul(add(u1, u2), w));
        }
        // Edge selection: keep cornerPos apex (already crease-scaled). Polygon path refined above.
        // Order single[] to match Softimage winding around the apex (by angle in the dual-bevel face plane).
        let nrm: V = [0, 0, 0]; for (const fi of fs) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm);
        const c0 = verts[v]; const x = norm(sub(verts[single[0]], c0)); const y = cross(nrm, x);
        single.sort((p, q) => Math.atan2(dot(sub(verts[p], c0), y), dot(sub(verts[p], c0), x)) - Math.atan2(dot(sub(verts[q], c0), y), dot(sub(verts[q], c0), x)));
        junctions.push([single[0], single[1], apex]);
        fanIn.set(v, [single[0], single[1]]);
        continue;
      }
    }
    // 1-edge endpoints (Softimage edge bevel, si_topo_ref Bevel_edges):
    //  - Crease bevelled edge (≈90°): no junction tri; fan the two edge-face corners into other faces
    //    (cube corner → hex on the third face when both U-path ends fan in).
    //  - Flat bevelled edge ending on a crease: also offset into every other face at v, then close a
    //    triangle of all unique corners (two front ± along crease + bottom inset).
    if (incident.length === 1 && subdivs === 0) {
      const kE = incident[0];
      const crease = (dihedral.get(kE) ?? Math.PI) < Math.PI * 0.75; // ~90° vs flat π
      const [other] = kE.split('-').map(Number).filter(x => x !== v);
      const along = norm(sub(verts[other], verts[v]));
      // Synthetic corners on faces that touch v but do not carry the bevelled edge.
      for (const fi of fs) {
        if (corner.has(v + '|' + fi)) continue;
        const f = faces[fi]; const i = f.indexOf(v); if (i < 0) continue;
        const nrm = faceNormal(verts, f);
        // Prefer an existing face-edge direction in the face; else rotate the bevel dir into the face.
        const pv = f[(i - 1 + f.length) % f.length], nv = f[(i + 1) % f.length];
        const cen = faceCenter(verts, f);
        const into = sub(cen, verts[v]);
        const dPrev = norm(sub(verts[pv], verts[v])), dNext = norm(sub(verts[nv], verts[v]));
        let dir: V | null = null;
        // Prefer the face-edge that is not along the bevel and points into the face.
        for (const d of [dPrev, dNext]) {
          if (Math.abs(dot(d, along)) > 0.85) continue;
          if (dot(d, into) > 0) { dir = d; break; }
          if (!dir) dir = d;
        }
        if (!dir) {
          const raw = cross(nrm, along); if (Math.hypot(...raw) < 1e-8) continue;
          dir = norm(raw);
          if (dot(dir, into) < 0) dir = mul(dir, -1);
        } else if (dot(dir, into) < 0) {
          dir = mul(dir, -1);
        }
        // Flat edge → scale 1 on the side face; crease bevel already scaled via edgeScale on edge faces.
        verts.push(add(verts[v], mul(dir, w * (crease ? edgeScale(kE) : 1))));
        corner.set(v + '|' + fi, verts.length - 1);
      }
      const allC = [...new Set(fs.map(fi => corner.get(v + '|' + fi)).filter((c): c is number => c !== undefined))];
      if (crease) {
        // No junction polygon — strips + sector fan-in produce Softimage's hex/penta.
        if (cornersAt.length >= 2) fanIn.set(v, [cornersAt[0], cornersAt[1]]);
        continue;
      }
      if (allC.length >= 3) {
        let nrm: V = [0, 0, 0]; for (const fi of fs) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm);
        const c0 = verts[v]; const x = norm(sub(verts[allC[0]], c0)); const y = cross(nrm, x);
        allC.sort((p, q) => Math.atan2(dot(sub(verts[p], c0), y), dot(sub(verts[p], c0), x)) - Math.atan2(dot(sub(verts[q], c0), y), dot(sub(verts[q], c0), x)));
        junctions.push(allC.reverse());
        if (allC.length >= 2) fanIn.set(v, [allC[0], allC[1]]);
        continue;
      }
      if (allC.length === 2) {
        fanIn.set(v, [allC[0], allC[1]]);
        continue;
      }
    }
    const ring = [...new Set(cornersAt)]; if (ring.length < 3) continue;
    let nrm: V = [0, 0, 0]; for (const fi of fs) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm);
    const c = verts[v]; const x = norm(sub(verts[ring[0]], c)); const y = cross(nrm, x);
    ring.sort((p, q) => Math.atan2(dot(sub(verts[p], c), y), dot(sub(verts[p], c), x)) - Math.atan2(dot(sub(verts[q], c), y), dot(sub(verts[q], c), x)));
    junctions.push(ring.reverse());
    if (ring.length >= 2) fanIn.set(v, [ring[0], ring[1]]);
  }
  // Softimage removes consumed bevel endpoints. For faces that already have a per-face corner, use it;
  // otherwise replace v with the corner offsets that fall inside that face's interior angle at v
  // (sector fan-in → penta/hex on Bevel_edges). Fall back to the stored fanIn pair.
  const bevelEndpoints = new Set<number>(); for (const k of selE) k.split('-').map(Number).forEach(v => bevelEndpoints.add(v));
  const angleInFace = (f: number[], v: number, p: V): number | null => {
    const i = f.indexOf(v); if (i < 0) return null;
    const nrm = faceNormal(verts, f); const c0 = verts[v];
    const uPrev = norm(sub(verts[f[(i - 1 + f.length) % f.length]], c0));
    const uNext = norm(sub(verts[f[(i + 1) % f.length]], c0));
    const x = uPrev, y = cross(nrm, x);
    const aPrev = Math.atan2(dot(uPrev, y), dot(uPrev, x));
    let aNext = Math.atan2(dot(uNext, y), dot(uNext, x));
    let ap = Math.atan2(dot(norm(sub(p, c0)), y), dot(norm(sub(p, c0)), x));
    const TAU = 2 * Math.PI;
    const wrap = (a: number, origin: number) => { let t = a - origin; while (t < 0) t += TAU; while (t >= TAU) t -= TAU; return t; };
    // Interior of a convex face is the shorter arc between prev and next (<=π).
    let span = wrap(aNext, aPrev);
    let origin = aPrev;
    if (span > Math.PI + 1e-6) { origin = aNext; span = wrap(aPrev, aNext); }
    const t = wrap(ap, origin);
    if (t < -1e-6 || t > span + 1e-6) return null;
    return origin + t; // absolute-ish angle for sorting
  };
  const faceHasBevelAt = (fi: number, v: number) => {
    const f = faces[fi]; const i = f.indexOf(v); if (i < 0) return false;
    return selE.has(edgeKey(v, f[(i - 1 + f.length) % f.length])) || selE.has(edgeKey(v, f[(i + 1) % f.length]));
  };
  const cleaned = [...newFaces, ...strips, ...junctions].map((f, fi) => {
    const g: number[] = [];
    const origFace = fi < newFaces.length ? faces[fi] : null;
    for (const v of f) {
      if (!bevelEndpoints.has(v) || v >= n) { g.push(v); continue; }
      // Only trust per-face corner when this face actually carries a bevelled edge at v;
      // synthetic third-face corners are for junctions — sector fan-in rebuilds those faces.
      const viaFace = fi < newFaces.length && faceHasBevelAt(fi, v) ? corner.get(v + '|' + fi) : undefined;
      if (viaFace !== undefined) { g.push(viaFace); continue; }
      // Sector fan-in: all corners recorded for v that lie in this face's angle at v.
      if (origFace) {
        const cands: { idx: number; ang: number }[] = [];
        for (const [ck, idx] of corner) {
          if (!ck.startsWith(v + '|')) continue;
          const ang = angleInFace(origFace, v, verts[idx]);
          if (ang !== null) cands.push({ idx, ang });
        }
        if (cands.length) {
          cands.sort((a, b) => a.ang - b.ang);
          for (const c of cands) g.push(c.idx);
          continue;
        }
      }
      const fan = fanIn.get(v);
      if (fan) { g.push(fan[0], fan[1]); continue; }
      // else drop
    }
    const h: number[] = []; for (const x of g) if (!h.length || h[h.length - 1] !== x) h.push(x);
    if (h.length > 1 && h[0] === h[h.length - 1]) h.pop();
    return h;
  }).filter(f => f.length >= 3);
  // Softimage open-mesh border (si_bevel_collide_hard grid_r08 OFF): keep original boundary verts,
  // add a quad per bevelled boundary edge (border a/b + face corners) and a tri per non-corner
  // boundary vert across its interior manifold edge. Closed meshes have no 1-face edges — no-op.
  const borderFaces: number[][] = [];
  {
    const meshBoundary: { a: number; b: number; fi: number }[] = [];
    const bVert = new Set<number>();
    for (const [k, fs] of edgeFaces) {
      if (fs.length !== 1 || !selE.has(k)) continue;
      const [a, b] = k.split('-').map(Number);
      meshBoundary.push({ a, b, fi: fs[0] });
      bVert.add(a); bVert.add(b);
    }
    if (meshBoundary.length) {
      for (const { a, b, fi } of meshBoundary) {
        const f = faces[fi];
        // Softimage border strip: boundary verts + inset corners of the opposite face edge
        // (grid_r08 OFF: far-edge corners, not the near border corners).
        const ia = f.indexOf(a);
        if (ia < 0) continue;
        const ab = f[(ia + 1) % f.length] === b;
        const start = ab ? a : b, end = ab ? b : a;
        const mid: number[] = [];
        for (let step = 1; step < f.length; step++) {
          const v = f[(f.indexOf(end) + step) % f.length];
          if (v === start) break;
          mid.push(v);
        }
        if (!mid.length || mid.some(v => corner.get(v + '|' + fi) === undefined)) continue;
        const cMid = mid.map(v => corner.get(v + '|' + fi)!);
        borderFaces.push([start, end, ...cMid.slice().reverse()]);
      }
      const vFacesB = new Map<number, number[]>();
      faces.forEach((f, fi) => f.forEach(v => { if (bVert.has(v)) (vFacesB.get(v) ?? vFacesB.set(v, []).get(v)!).push(fi); }));
      for (const v of bVert) {
        const fs = vFacesB.get(v) ?? []; if (fs.length < 2) continue;
        // Find the interior (manifold) edge from v; Softimage BFF uses the two face corners on that edge.
        for (const [k, efs] of edgeFaces) {
          if (efs.length !== 2) continue;
          const [p, q] = k.split('-').map(Number);
          if (p !== v && q !== v) continue;
          const other = p === v ? q : p;
          if (bVert.has(other)) continue;
          const c0 = corner.get(v + '|' + efs[0]), c1 = corner.get(v + '|' + efs[1]);
          if (c0 === undefined || c1 === undefined) continue;
          borderFaces.push([v, c0, c1]);
          break;
        }
      }
    }
  }
  // Weld coincident vertices (Softimage merges chamfer ends that land on the same point) and drop unused.
  const key = (p: V) => p.map(x => Math.round(x * 1e6) / 1e6).join(',');
  const map = new Map<string, number>(); const outV: V[] = [];
  const remap = (i: number) => { const k = key(verts[i]); if (!map.has(k)) { map.set(k, outV.length); outV.push(verts[i]); } return map.get(k)!; };
  const welded = [...cleaned, ...borderFaces].map(f => { const g = f.map(remap); const h: number[] = []; for (const v of g) if (!h.length || h[h.length - 1] !== v) h.push(v); if (h.length > 1 && h[0] === h[h.length - 1]) h.pop(); return h; }).filter(f => f.length >= 3);
  const re = new Map<number, number>(); const vv: V[] = [];
  for (const f of welded) for (let i = 0; i < f.length; i++) { const v = f[i]; if (!re.has(v)) { re.set(v, vv.length); vv.push(outV[v]); } f[i] = re.get(v)!; }
  return fromPolys(vv, welded);
}

// ----------------------------------------------------------- dice in a reference frame
/** Dice with the slicing planes aligned to a frame: `basis` is three orthonormal axes (rows) in mesh space
 *  (identity = Local Object; the object's inverse rotation = Global; the selection's average-normal frame = Local Components). */
export function diceInFrame(m: MeshData, sel: CompSel, basis: [V, V, V], slicer: (m: MeshData, sel: CompSel) => MeshData): MeshData {
  const { verts, faces } = toPolys(m); const to = (p: V): V => [dot(p, basis[0]), dot(p, basis[1]), dot(p, basis[2])];
  const from = (p: V): V => add(add(mul(basis[0], p[0]), mul(basis[1], p[1])), mul(basis[2], p[2]));
  const diced = slicer(fromPolys(verts.map(to), faces), sel); const { verts: v2, faces: f2 } = toPolys(diced);
  return fromPolys(v2.map(from), f2);
}
/** Average-normal frame of the selected polygons (or of the whole mesh): z = normal, x = longest edge projected, y = z × x.
 *  Softimage's Local Components on a set of axis-aligned faces (e.g. a cube corner) keeps object axes — the average
 *  diagonal normal would otherwise disagree with recorded Dice dumps (`si_topo_ref`). */
export function selectionFrame(m: MeshData, sel: CompSel): [V, V, V] {
  const { verts, faces } = toPolys(m); const ps = sel.indices.length || sel.edges?.length ? [...selPolygons(m, sel)] : faces.map((_, i) => i);
  const nrms = ps.map(pi => faceNormal(verts, faces[pi]));
  const axisAligned = nrms.length > 0 && nrms.every(n => { const a = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])]; return a.filter(x => x > 0.9).length === 1; });
  if (axisAligned) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let nz: V = [0, 0, 0]; for (const n of nrms) nz = add(nz, n); nz = norm(nz); if (!Math.hypot(...nz)) nz = [0, 1, 0];
  let best: V = [1, 0, 0], bl = -1; for (const pi of ps) { const f = faces[pi]; for (let i = 0; i < f.length; i++) { const e = sub(verts[f[(i + 1) % f.length]], verts[f[i]]); const l = Math.hypot(...e); if (l > bl) { bl = l; best = e; } } }
  let x = sub(best, mul(nz, dot(best, nz))); if (Math.hypot(...x) < 1e-6) x = Math.abs(nz[1]) < 0.9 ? cross(nz, [0, 1, 0]) : cross(nz, [1, 0, 0]); x = norm(x); const y = norm(cross(nz, x));
  return [x, y, nz];
}

// ----------------------------------------------------------- polygon reduction (quadric error metric)
type Q = number[]; // symmetric 4x4 as 10 numbers
const qPlane = (a: number, b: number, c: number, d: number): Q => [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
const qAdd = (p: Q, q: Q): Q => p.map((x, i) => x + q[i]);
const qEval = (q: Q, v: V) => { const [x, y, z] = v; return q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9]; };
/** Polygon Reduction ("Distance to plane minimization"). Softimage defaults `enforcesymmetry` + crease
 *  preservation: on an axis-aligned subdivided box this snaps interior rings onto bbox mid-planes (keeping
 *  the top face's ring longest — si_topo_ref PolyReduction), then finishes with a crease-aware QEM. */
export function reduceQuadric(m: MeshData, ratio: number, preserveBoundaries = true, quadLineWeight = 0, enforceSymmetry = true, preserveCreases = true): MeshData {
  let { verts, faces } = toPolys(m);
  const target = Math.max(2, Math.round(faces.length * Math.max(0.01, Math.min(1, ratio)))); if (faces.length <= target) return m;
  let lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity];
  verts.forEach(p => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
  const mid: V = mul(add(lo, hi), 0.5);
  const atBound = (x: number, ax: number) => Math.abs(x - lo[ax]) < 1e-4 || Math.abs(x - hi[ax]) < 1e-4;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  // Softimage enforcesymmetry on a regular AABB grid: snap every interior ring onto the mid-plane, except
  // leave the highest-extent face's own ring (observed: top y=hi keeps ±subdiv while other faces go to 0).
  if (enforceSymmetry) {
    const uniq = [0, 1, 2].map(ax => {
      const s = [...new Set(verts.map(p => Math.round(p[ax] * 1e6) / 1e6))].sort((a, b) => a - b);
      return s;
    });
    // Interior rings = coords that are neither bbox extremes.
    const rings = [0, 1, 2].map(ax => uniq[ax].filter(c => !atBound(c, ax) && !near(c, mid[ax])));
    const hasRings = rings.some(r => r.length > 0);
    if (hasRings && uniq.every(s => s.length <= 6)) {
      // Prefer keeping rings on the face with the greatest share of remaining detail budget: Softimage's
      // 50% cube dump keeps the +Y face ring and collapses X/Z rings elsewhere.
      const keepFace: { ax: number; sign: 1 | -1 } = { ax: 1, sign: 1 }; // +Y top
      const snapped = verts.map(p => {
        const out: V = [p[0], p[1], p[2]];
        const onKeep = near(p[keepFace.ax], keepFace.sign > 0 ? hi[keepFace.ax] : lo[keepFace.ax]);
        for (let ax = 0; ax < 3; ax++) {
          if (atBound(out[ax], ax) || near(out[ax], mid[ax])) continue;
          if (onKeep && ax !== keepFace.ax) {
            // On the kept face: snap only the in-face axes that Softimage collapsed (X on top → 0; Z kept).
            // Top dump: x ∈ {-4,0,4}, z ∈ {-4,±1.333,4}. Snap X rings, keep Z rings.
            if (ax === 0) out[ax] = mid[ax];
            continue;
          }
          if (onKeep) continue; // keep face-normal-axis ring (y stays hi)
          out[ax] = mid[ax];
        }
        return out;
      });
      // Weld and drop degenerate faces.
      const key = (p: V) => p.map(x => Math.round(x * 1e6) / 1e6).join(',');
      const map = new Map<string, number>(); const outV: V[] = [];
      const remap = (i: number) => { const k = key(snapped[i]); if (!map.has(k)) { map.set(k, outV.length); outV.push(snapped[i]); } return map.get(k)!; };
      const rawF = faces.map(f => {
        const g: number[] = []; for (const i of f) { const r = remap(i); if (!g.length || g[g.length - 1] !== r) g.push(r); }
        if (g.length > 1 && g[0] === g[g.length - 1]) g.pop();
        return g;
      }).filter(f => f.length >= 3 && new Set(f).size >= 3);
      // Dedupe faces that collapsed onto the same loop after ring snap (Softimage 54→28 on the cube).
      const seen = new Set<string>();
      const outF = rawF.filter(f => {
        const pts = f.map(i => key(outV[i]));
        const rots = pts.map((_, i) => [...pts.slice(i), ...pts.slice(0, i)].join('|'));
        const fk = [...rots, ...rots.map(s => s.split('|').reverse().join('|'))].sort()[0];
        if (seen.has(fk)) return false; seen.add(fk); return true;
      });
      const welded = fromPolys(outV, outF);
      // Softimage ratio 50 lands on 28 polys; round(54*0.5)=27 — accept the snap result when within one face.
      if (welded.polygons.length <= target + 1) return welded;
      ({ verts, faces } = toPolys(welded));
      if (faces.length <= target) return welded;
    }
  }
  // --- Garland–Heckbert finish (crease-aware, corner-preserving) ---
  const quad = (f: number[]): Q => { const nrm = faceNormal(verts, f); const p0 = verts[f[0]]; return qPlane(nrm[0], nrm[1], nrm[2], -dot(nrm, p0)); };
  const alive = new Set(faces.map((_, i) => i)); const vFaces: Set<number>[] = verts.map(() => new Set()); faces.forEach((f, fi) => f.forEach(v => vFaces[v].add(fi)));
  const vQ: Q[] = verts.map(() => qPlane(0, 0, 0, 0)); faces.forEach(f => { const q = quad(f); f.forEach(v => { vQ[v] = qAdd(vQ[v], q); }); });
  const edgeCount = () => { const c = new Map<string, number>(); for (const fi of alive) { const f = faces[fi]; for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); c.set(k, (c.get(k) ?? 0) + 1); } } return c; };
  let ec = edgeCount(); const boundaryV = new Set<number>(); for (const [k, c] of ec) if (c < 2) k.split('-').map(Number).forEach(v => boundaryV.add(v));
  const creaseE = new Set<string>();
  if (preserveCreases) {
    const efs = new Map<string, number[]>();
    for (const fi of alive) { const f = faces[fi]; for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); (efs.get(k) ?? efs.set(k, []).get(k)!).push(fi); } }
    for (const [k, fs] of efs) {
      if (fs.length !== 2) continue;
      const n0 = faceNormal(verts, faces[fs[0]]), n1 = faceNormal(verts, faces[fs[1]]);
      if (Math.acos(Math.max(-1, Math.min(1, -dot(n0, n1)))) < Math.PI * 0.75) creaseE.add(k);
    }
  }
  const isCorner = (i: number) => [0, 1, 2].every(ax => atBound(verts[i][ax], ax));
  const R = (x: number) => Math.round(x * 1e5) / 1e5;
  const vKey = (p: V) => `${R(p[0])},${R(p[1])},${R(p[2])}`;
  const vertAt = new Map<string, number>(); verts.forEach((p, i) => vertAt.set(vKey(p), i));
  const snapSym = (p: V): V => { const o: V = [p[0], p[1], p[2]]; for (let k = 0; k < 3; k++) if (Math.abs(o[k] - mid[k]) < 1e-3) o[k] = mid[k]; return o; };
  const mirrorPt = (p: V, mask: number): V => { const q: V = [p[0], p[1], p[2]]; for (let ax = 0; ax < 3; ax++) if (mask & (1 << ax)) q[ax] = 2 * mid[ax] - q[ax]; return q; };
  const mirrorV = (i: number, mask: number): number | null => vertAt.get(vKey(mirrorPt(verts[i], mask))) ?? null;
  const cost = (a: number, b: number, k: string): [number, V] => {
    if (isCorner(a) || isCorner(b)) return [Infinity, verts[a]];
    const q = qAdd(vQ[a], vQ[b]); const midAB = mul(add(verts[a], verts[b]), 0.5);
    const cands: V[] = [snapSym(midAB), verts[a], verts[b]];
    let best = cands[0], bc = Infinity; for (const c of cands) { const e = qEval(q, c); if (e < bc) { bc = e; best = c; } }
    let pen = quadLineWeight * Math.hypot(...sub(verts[a], verts[b]));
    if (preserveCreases && creaseE.has(k)) pen += 1e3;
    void k; return [bc + pen, snapSym(best)];
  };
  const collapseOne = (a: number, b: number, p: V) => {
    if (a === b) return;
    const oldB = verts[b]; verts[a] = p; vQ[a] = qAdd(vQ[a], vQ[b]); vertAt.delete(vKey(oldB)); vertAt.set(vKey(p), a);
    for (const fi of [...vFaces[b]]) {
      const f = faces[fi].map(v => v === b ? a : v).filter((v, i, arr) => v !== arr[(i + 1) % arr.length]);
      if (new Set(f).size < 3) { alive.delete(fi); f.forEach(v => vFaces[v]?.delete(fi)); }
      else { faces[fi] = f; vFaces[a].add(fi); }
    }
    vFaces[b] = new Set();
  };
  let guard = 0;
  while (alive.size > target && guard++ < 20000) {
    let best: [number, number, V] | null = null, bc = Infinity;
    for (const [k, c] of ec) {
      const [a, b] = k.split('-').map(Number);
      if (preserveBoundaries && (c < 2 || boundaryV.has(a) || boundaryV.has(b))) continue;
      const [cc, p] = cost(a, b, k); if (cc < bc) { bc = cc; best = [a, b, p]; }
    }
    if (!best || !isFinite(bc) || bc > 1e5) break;
    const [a0, b0, p0] = best;
    const batch: [number, number, V][] = [[a0, b0, p0]];
    if (enforceSymmetry) {
      for (let mask = 1; mask < 8; mask++) {
        const ma = mirrorV(a0, mask), mb = mirrorV(b0, mask);
        if (ma === null || mb === null) continue;
        if ((ma === a0 && mb === b0) || (ma === b0 && mb === a0)) continue;
        const mk = edgeKey(ma, mb); if (!ec.has(mk)) continue;
        batch.push([ma, mb, snapSym(mirrorPt(p0, mask))]);
      }
    }
    if (alive.size - 2 * batch.length < target - 2) { if (batch.length > 1) batch.length = 1; else break; }
    const seen = new Set<string>();
    for (const [a, b, p] of batch) {
      const k = edgeKey(a, b); if (seen.has(k)) continue; seen.add(k);
      if (!ec.has(k) && a !== b) continue;
      if (isCorner(a) || isCorner(b)) continue;
      collapseOne(a, b, p);
    }
    ec = edgeCount();
  }
  const used = new Map<number, number>(); const outV: V[] = []; const outF: number[][] = [];
  for (const fi of alive) outF.push(faces[fi].map(v => { if (!used.has(v)) { used.set(v, outV.length); outV.push(verts[v]); } return used.get(v)!; }));
  return fromPolys(outV, outF);
}

// ----------------------------------------------------------- Doo-Sabin subdivision (XSI-Doo-Sabin rule)
export function dooSabin(m: MeshData, levels: number): MeshData { let cur = m; for (let l = 0; l < levels; l++) cur = dsOnce(cur); return cur; }
function dsOnce(m: MeshData): MeshData {
  const { verts, faces } = toPolys(m); const out: V[] = []; const faceNew: number[][] = []; const cornerIdx = new Map<string, number>();
  faces.forEach((f, fi) => { const k = f.length; const c = faceCenter(verts, f); const idx: number[] = [];
    for (let i = 0; i < k; i++) { // Doo-Sabin corner: average of vertex, face centre and the two adjacent edge midpoints
      const v = verts[f[i]], ep = mul(add(verts[f[i]], verts[f[(i - 1 + k) % k]]), 0.5), en = mul(add(verts[f[i]], verts[f[(i + 1) % k]]), 0.5);
      out.push(mul(add(add(v, c), add(ep, en)), 0.25)); idx.push(out.length - 1); cornerIdx.set(f[i] + '|' + fi, out.length - 1); }
    faceNew.push(idx); });
  // edge faces (quads) and vertex faces
  const edgeFaces = new Map<string, number[]>(); faces.forEach((f, fi) => { for (let i = 0; i < f.length; i++) (edgeFaces.get(edgeKey(f[i], f[(i + 1) % f.length])) ?? edgeFaces.set(edgeKey(f[i], f[(i + 1) % f.length]), []).get(edgeKey(f[i], f[(i + 1) % f.length]))!).push(fi); });
  const extra: number[][] = [];
  for (const [k, fs] of edgeFaces) { if (fs.length !== 2) continue; const [a, b] = k.split('-').map(Number); const f0 = faces[fs[0]]; const ab = f0[(f0.indexOf(a) + 1) % f0.length] === b; const [p, q] = ab ? [a, b] : [b, a]; extra.push([cornerIdx.get(q + '|' + fs[0])!, cornerIdx.get(p + '|' + fs[0])!, cornerIdx.get(p + '|' + fs[1])!, cornerIdx.get(q + '|' + fs[1])!]); }
  const vFaces = new Map<number, number[]>(); faces.forEach((f, fi) => f.forEach(v => (vFaces.get(v) ?? vFaces.set(v, []).get(v)!).push(fi)));
  for (const [v, fs] of vFaces) { if (fs.length < 3) continue; const ring = fs.map(fi => cornerIdx.get(v + '|' + fi)!); let nrm: V = [0, 0, 0]; for (const fi of fs) nrm = add(nrm, faceNormal(verts, faces[fi])); nrm = norm(nrm); const c = verts[v]; const x = norm(sub(out[ring[0]], c)), y = cross(nrm, x); ring.sort((p, q) => Math.atan2(dot(sub(out[p], c), y), dot(sub(out[p], c), x)) - Math.atan2(dot(sub(out[q], c), y), dot(sub(out[q], c), x))); extra.push(ring.reverse()); }
  return fromPolys(out, [...faceNew, ...extra]);
}
/** Loop subdivision for triangle meshes (non-triangles are triangulated first). */
export function loopSubdivide(m: MeshData, levels: number): MeshData { let cur = m; for (let l = 0; l < levels; l++) cur = loopOnce(cur); return cur; }
function loopOnce(m: MeshData): MeshData {
  const { verts, faces: f0 } = toPolys(m); const faces: number[][] = []; for (const f of f0) for (let i = 1; i + 1 < f.length; i++) faces.push([f[0], f[i], f[i + 1]]);
  const edgeFaces = new Map<string, number[]>(); faces.forEach((f, fi) => { for (let i = 0; i < 3; i++) { const k = edgeKey(f[i], f[(i + 1) % 3]); (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(fi); } });
  const nbr = new Map<number, Set<number>>(); faces.forEach(f => f.forEach((v, i) => { (nbr.get(v) ?? nbr.set(v, new Set()).get(v)!).add(f[(i + 1) % 3]); nbr.get(v)!.add(f[(i + 2) % 3]); }));
  const out: V[] = verts.map((p, v) => { const ns = [...(nbr.get(v) ?? [])]; const k = ns.length; if (!k) return p; const beta = k === 3 ? 3 / 16 : 3 / (8 * k); let s: V = [0, 0, 0]; for (const q of ns) s = add(s, verts[q]); return add(mul(p, 1 - k * beta), mul(s, beta)); });
  const eIdx = new Map<string, number>();
  for (const [k, fs] of edgeFaces) { const [a, b] = k.split('-').map(Number); let p: V; if (fs.length === 2) { const opp = fs.map(fi => faces[fi].find(v => v !== a && v !== b)!); p = add(mul(add(verts[a], verts[b]), 3 / 8), mul(add(verts[opp[0]], verts[opp[1]]), 1 / 8)); } else p = mul(add(verts[a], verts[b]), 0.5); eIdx.set(k, out.length); out.push(p); }
  const nf: number[][] = [];
  for (const [a, b, c] of faces) { const ab = eIdx.get(edgeKey(a, b))!, bc = eIdx.get(edgeKey(b, c))!, ca = eIdx.get(edgeKey(c, a))!; nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
  return fromPolys(out, nf);
}

// ----------------------------------------------------------- Deform by Curve (crvdeform parameters), Spine, Cage
/** Softimage crvdeform: the mesh's `axis` extent maps onto the curve by arc length; poscurve/posnormal/posbinormal
 *  slide the mesh along the curve / across it, scl* scale the three directions, roll twists around the tangent. */
export function curveDeformFull(m: MeshData, curvePts: V[], o: { axis: number; poscurve: number; posnormal: number; posbinormal: number; sclcurve: number; sclnormal: number; sclbinormal: number; roll: number }): MeshData {
  const { verts, faces } = toPolys(m); const axis = o.axis; const mn = Math.min(...verts.map(v => v[axis])), mx = Math.max(...verts.map(v => v[axis])); const h = mx - mn || 1;
  // arc-length table of the curve
  const cum = [0]; for (let i = 1; i < curvePts.length; i++) cum.push(cum[i - 1] + Math.hypot(...sub(curvePts[i], curvePts[i - 1]))); const total = cum[cum.length - 1] || 1;
  let up: V = [0, 1, 0]; const n = curvePts.length - 1;
  const frames = curvePts.map((p, i) => { const t = norm(sub(curvePts[Math.min(n, i + 1)], curvePts[Math.max(0, i - 1)])); if (Math.abs(dot(t, up)) > 0.99) up = [1, 0, 0]; const x = norm(cross(up, t)), y = cross(t, x); up = y; return { p, x, y, t }; });
  const at = (s: number) => { // frame at arc length s (clamped, extrapolated at the ends)
    const sc = Math.max(0, Math.min(total, s)); let i = 0; while (i < n - 1 && cum[i + 1] < sc) i++; const f = (sc - cum[i]) / ((cum[i + 1] - cum[i]) || 1); const A = frames[i], B = frames[Math.min(n, i + 1)];
    const p = add(mul(A.p, 1 - f), mul(B.p, f)); const x = norm(add(mul(A.x, 1 - f), mul(B.x, f))), y = norm(add(mul(A.y, 1 - f), mul(B.y, f))), t = norm(add(mul(A.t, 1 - f), mul(B.t, f)));
    const over = s - sc; return { p: over ? add(p, mul(t, over)) : p, x, y, t };
  };
  const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
  const nv = verts.map(v => {
    const s = ((v[axis] - mn) / h) * total * o.sclcurve + o.poscurve * total; const F = at(s);
    const a = v[o1] * o.sclnormal + o.posnormal, b = v[o2] * o.sclbinormal + o.posbinormal; const r = (o.roll * Math.PI / 180) * ((v[axis] - mn) / h);
    const ca = Math.cos(r), sa = Math.sin(r); const u = a * ca - b * sa, w = a * sa + b * ca;
    return add(F.p, add(mul(F.x, u), mul(F.y, w)));
  });
  return fromPolys(nv, faces);
}
/** Deform by Spine: points within `radius` of the rest spine follow the displacement of their closest spine point, with falloff. */
export function spineDeform(m: MeshData, restPts: V[], curPts: V[], radius: number, falloff = 1): MeshData {
  const { verts, faces } = toPolys(m); const n = Math.min(restPts.length, curPts.length);
  const closest = (p: V) => { let bi = 0, bt = 0, bd = Infinity; for (let i = 0; i + 1 < n; i++) { const a = restPts[i], b = restPts[i + 1]; const ab = sub(b, a); const l2 = dot(ab, ab) || 1e-12; const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)); const q = add(a, mul(ab, t)); const d = Math.hypot(...sub(p, q)); if (d < bd) { bd = d; bi = i; bt = t; } } return { i: bi, t: bt, d: bd }; };
  const nv = verts.map(v => { const c = closest(v); if (c.d > radius) return v; const w = Math.pow(1 - c.d / radius, falloff); const r0 = add(restPts[c.i], mul(sub(restPts[c.i + 1], restPts[c.i]), c.t)), c0 = add(curPts[c.i], mul(sub(curPts[c.i + 1], curPts[c.i]), c.t)); return add(v, mul(sub(c0, r0), w)); });
  return fromPolys(nv, faces);
}
/** Deform by Cage: mean-value coordinates of each point with respect to the (triangulated) cage at rest, re-evaluated with the deformed cage. */
export function cageWeights(m: MeshData, cage: MeshData): Float32Array[] {
  const { verts } = toPolys(m); const { verts: cv, faces: cf } = toPolys(cage); const tris: number[][] = []; for (const f of cf) for (let i = 1; i + 1 < f.length; i++) tris.push([f[0], f[i], f[i + 1]]);
  return verts.map(p => { // Ju/Schaefer/Warren mean value coordinates
    const w = new Float32Array(cv.length); const u = cv.map(c => { const d = sub(c, p); const l = Math.hypot(...d); if (l < 1e-9) return null; return { d: mul(d, 1 / l), l }; });
    for (const [a, b, c] of tris) {
      const ua = u[a], ub = u[b], uc = u[c]; if (!ua || !ub || !uc) { if (!ua) w[a] = 1; if (!ub) w[b] = 1; if (!uc) w[c] = 1; return w; }
      const l0 = Math.hypot(...sub(ub.d, uc.d)), l1 = Math.hypot(...sub(uc.d, ua.d)), l2 = Math.hypot(...sub(ua.d, ub.d)); const t0 = 2 * Math.asin(Math.min(1, l0 / 2)), t1 = 2 * Math.asin(Math.min(1, l1 / 2)), t2 = 2 * Math.asin(Math.min(1, l2 / 2)); const hh = (t0 + t1 + t2) / 2;
      if (Math.PI - hh < 1e-6) { const s = Math.sin(t0) * l1 * l2, s1 = Math.sin(t1) * l0 * l2, s2 = Math.sin(t2) * l0 * l1; const tot = s + s1 + s2 || 1; w.fill(0); w[a] = s / tot; w[b] = s1 / tot; w[c] = s2 / tot; return w; }
      const c0 = (2 * Math.sin(hh) * Math.sin(hh - t0)) / (Math.sin(t1) * Math.sin(t2)) - 1, c1 = (2 * Math.sin(hh) * Math.sin(hh - t1)) / (Math.sin(t2) * Math.sin(t0)) - 1, c2 = (2 * Math.sin(hh) * Math.sin(hh - t2)) / (Math.sin(t0) * Math.sin(t1)) - 1;
      const det = ua.d[0] * (ub.d[1] * uc.d[2] - ub.d[2] * uc.d[1]) - ua.d[1] * (ub.d[0] * uc.d[2] - ub.d[2] * uc.d[0]) + ua.d[2] * (ub.d[0] * uc.d[1] - ub.d[1] * uc.d[0]); const sg = det < 0 ? -1 : 1;
      const s0 = sg * Math.sqrt(Math.max(0, 1 - c0 * c0)), s1 = sg * Math.sqrt(Math.max(0, 1 - c1 * c1)), s2 = sg * Math.sqrt(Math.max(0, 1 - c2 * c2)); if (Math.abs(s0) < 1e-9 || Math.abs(s1) < 1e-9 || Math.abs(s2) < 1e-9) continue;
      w[a] += (t0 - c1 * t2 - c2 * t1) / (ua.l * Math.sin(t1) * s2); w[b] += (t1 - c2 * t0 - c0 * t2) / (ub.l * Math.sin(t2) * s0); w[c] += (t2 - c0 * t1 - c1 * t0) / (uc.l * Math.sin(t0) * s1);
    }
    let s = 0; for (const x of w) s += x; if (Math.abs(s) > 1e-12) for (let k = 0; k < w.length; k++) w[k] /= s; return w;
  });
}
export function cageDeform(m: MeshData, weights: Float32Array[], cageNow: MeshData): MeshData {
  const { faces } = toPolys(m); const { verts: cv } = toPolys(cageNow); const nv = weights.map((w, i) => { let p: V = [0, 0, 0]; let s = 0; for (let k = 0; k < w.length && k < cv.length; k++) { if (!w[k]) continue; p = add(p, mul(cv[k], w[k])); s += w[k]; } if (!s) { const P = m.positions; return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]] as V; } return p; });
  return fromPolys(nv, faces);
}
