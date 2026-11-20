// Ledger row CMD-B18d: MeshHelper.js (the cached polymesh helper object, hole detection and capping, §2) and the fit-stage
// builders InitNeck.js / InitNose.js (§8) of docs/ghidra/cmd-b18d-fr-small-scripts.md. Original code written from that
// prose only; no XSIBATCH golden exists.
//
// Stand-ins: the helper's `Edges` / `Points` are plain records ({Index, Vertices, NeighborPolygons, NeighborEdges} /
// {Index, Position}); the edge index order is the order edges first appear walking the polygons (inferred: the
// Softimage edge numbering is not in the note). Geometry.Set / FreezeObj replace the construction history by a frozen
// mesh. The ShrinkWrap projection of SternumTop is computed directly (ray along local z, both directions).
import { App } from '../core/commands';
import {
  THREE, X3DObject, Property, b18d, nya, logErr, logInfo, call, sget, sgetObj, selection0, objArg, objList, unset, setMeshGeometry,
  freezeObj, addInPlace, addCurveList, addPointCluster, customProperty, setGlobalPos, globalPos, setParamU, wireColor, setViewVis,
  findChild, siName, ROW, Null, addObject,
} from './faceRobotB18dShared';
import { num, int, str } from '../core/params';
import { constrain } from './rigScriptsB15eKit';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ================================================================== MeshHelper.js
interface EdgeRec { Index: number; Vertices: [number, number]; NeighborPolygons: number[]; NeighborEdges: number[] }
interface PointRec { Index: number; Position: THREE.Vector3 }

/** Push with the file-level override: arguments are appended only up to the first null / undefined one. */
function push(arr: any[], ...items: any[]) { for (const x of items) { if (x === null || x === undefined) break; arr.push(x); } return arr; }

export class PolymeshHelper {
  ActivePrimitive: any; Object: X3DObject | null = null; Transform: THREE.Matrix4 | null = null;
  Vertices: number[] | undefined; PolygonData: number[] | undefined; Edges: EdgeRec[] = []; Points: PointRec[] = [];
  Holes: any = undefined; xScale: number | undefined; yScale: number | undefined;
  private polys: number[][] = [];
  constructor(private readonly app: App, prim: any) {
    this.ActivePrimitive = prim; this.Object = prim?.parent instanceof X3DObject ? prim.parent : null;
    this.Transform = this.Object ? this.Object.globalMatrix() : null;
    this.GetPolydata();
  }
  // aliases of the hole record
  get HolesEdges() { return this.Holes?.Edges; } get HolesPoints() { return this.Holes?.Points; }
  get HolesPointIndices() { return this.Holes?.PointIndices; } get HolesEdgeIndices() { return this.Holes?.EdgeIndices; }
  get HolesCentroids() { return this.Holes?.Centroids; } get HolesMidPoints() { return this.Holes?.MidPoints; }
  get HolesDepthVectors() { return this.Holes?.DepthVectors; } get HolesFurthestPoints() { return this.Holes?.FurthestPoints; }

  /** Re-reads Vertices, PolygonData, Edges and Points from the primitive (Get2). */
  GetPolydata() {
    const m = this.ActivePrimitive?.mesh?.();
    if (!this.ActivePrimitive) { logInfo(this.app, 'No existing object. ActivePrimitive has been passed.'); return this; }
    if (!m) return this;
    this.Vertices = Array.from(m.positions as Float32Array);
    this.polys = m.polygons.map((f: number[]) => [...f]);
    this.PolygonData = []; for (const f of this.polys) this.PolygonData.push(f.length, ...f);
    // edges in first-appearance order, with neighbour polygons
    const idx = new Map<string, number>(); const edges: EdgeRec[] = [];
    this.polys.forEach((f, pi) => { for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]; const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      let e = idx.get(k); if (e === undefined) { e = edges.length; idx.set(k, e); edges.push({ Index: e, Vertices: [a, b], NeighborPolygons: [], NeighborEdges: [] }); }
      if (!edges[e].NeighborPolygons.includes(pi)) edges[e].NeighborPolygons.push(pi);
    } });
    const v2e = new Map<number, number[]>();
    for (const e of edges) for (const v of e.Vertices) { const l = v2e.get(v) ?? []; l.push(e.Index); v2e.set(v, l); }
    for (const e of edges) e.NeighborEdges = [...new Set([...(v2e.get(e.Vertices[0]) ?? []), ...(v2e.get(e.Vertices[1]) ?? [])])].filter(x => x !== e.Index).sort((x, y) => x - y);
    this.Edges = edges;
    this.Points = []; for (let i = 0; i < m.positions.length / 3; i++) this.Points.push({ Index: i, Position: V(m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]) });
    return this;
  }
  Local() { return this.GetPolydata(); }
  /** Converts Vertices in place to world space with the build-time transform. */
  Global() {
    if (!this.Vertices || !this.Transform) return this;
    for (let i = 0; i + 2 < this.Vertices.length; i += 3) { const p = V(this.Vertices[i], this.Vertices[i + 1], this.Vertices[i + 2]).applyMatrix4(this.Transform); this.Vertices[i] = p.x; this.Vertices[i + 1] = p.y; this.Vertices[i + 2] = p.z; }
    return this;
  }
  GetLoops() { return this.GetPolydata(); }
  capeyehole() { return undefined; }
  Help() { logInfo(this.app, 'fr_GetPolymesh helper: GetHoles(override), GetClosestHole(vector), ReorderHole(index), CapHole(index), CapHoles(), ExtractHoles(index, degree), Global(), Local(), Set(polygonData, vertices)'); }

  /** Hole detection (§2.3). */
  GetHoles(inOverride?: any) {
    if (!this.Vertices) this.GetPolydata();
    const cached = b18d(this.app).cached;
    if (cached?.Holes?.Edges && cached?.Holes?.Points && !inOverride) { this.Holes = cached.Holes; return this.Holes; }
    const H: any = { Edges: [], EdgeIndices: [], Points: [], PointIndices: [], Centroids: [], MidPoints: [], DepthVectors: [], MajorAxisVectors: [],
      MajorAxisLength: [], FurthestPoints: [], OppositePoints: [], MajorAxisIndices: [], MinorAxisIndices: [] };
    H.MajorAxisIndicesVectors = H.MajorAxisVectors; H.MajorAxisIndicesDepth = H.MajorAxisLength;
    this.Holes = H;
    const open = this.Edges.filter(e => e.NeighborPolygons.length < 2).map(e => e.Index);
    const left = new Set(open);
    while (left.size) {
      if (H.Edges.length > 99) { logErr(this.app, 'Too many Holes.'); return H; }
      const first = open.find(e => left.has(e))!; let cur = first; left.delete(cur);
      const walk = [this.Edges[cur]];
      for (;;) {
        const next = this.Edges[cur].NeighborEdges.find(n => left.has(n));
        if (next === undefined) break;
        left.delete(next); cur = next; walk.push(this.Edges[next]);
      }
      H.Edges.push(walk); H.EdgeIndices.push([]);
    }
    let lastPlane: number | undefined;
    H.Edges.forEach((edges: EdgeRec[], h: number) => {
      const seen = new Set<number>(); const pts: PointRec[] = [];
      for (const e of edges) { const v = e.Vertices.find(x => !seen.has(x)); if (v !== undefined) { seen.add(v); pts.push(this.Points[v]); } }
      H.Points[h] = pts; H.PointIndices[h] = pts.map(p => p.Index);
      const c = V(); for (const p of pts) c.add(p.Position); if (pts.length) c.multiplyScalar(1 / pts.length);
      H.Centroids[h] = c;
      let fi: number | undefined, best = 0;
      pts.forEach((p, i) => { const d = p.Position.distanceTo(c); if (d > best) { best = d; fi = i; } });
      let oi: number | undefined; best = 0;
      if (fi !== undefined) pts.forEach((p, i) => { const d = p.Position.distanceTo(pts[fi!].Position); if (d > best) { best = d; oi = i; } });
      H.MajorAxisIndices[h] = push([], fi, oi);
      H.FurthestPoints[h] = fi !== undefined ? pts[fi] : undefined; H.OppositePoints[h] = oi !== undefined ? pts[oi] : undefined;
      if (fi === undefined || oi === undefined) return;
      const F = pts[fi].Position, O = pts[oi].Position;
      const mid = F.clone().add(O).multiplyScalar(0.5); H.MidPoints[h] = mid;
      const X = F.x > O.x ? O.clone().sub(F) : F.clone().sub(O);
      H.MajorAxisLength[h] = X.length(); X.normalize(); H.MajorAxisVectors[h] = X;
      H.DepthVectors[h] = X.clone().cross(V(0, 1, 0)).normalize();
      this.xScale = H.MajorAxisLength[h];
      const n = pts.length;
      if (n === 4) H.MinorAxisIndices[h] = push([], (fi + 1) % n, (fi - 1 + n) % n);
      else {
        const search = (start: number, end: number, prev: number | undefined) => {
          const count = ((end - start) % n + n) % n; let r = prev, bestD = Infinity; let found = false;
          for (let k = 1; k <= count - 2; k++) {
            const pos = (start + k) % n; const d = Math.abs(pts[pos].Position.clone().sub(mid).dot(X));
            if (!found || d < bestD) { bestD = d; r = pos; found = true; lastPlane = d; }
          }
          return r;
        };
        const r1 = search(oi, fi, undefined); const r2 = search(fi, oi, r1);
        H.MinorAxisIndices[h] = push([], r1, r2);
      }
    });
    this.yScale = lastPlane;
    return H;
  }

  /** Index of the hole whose local centroid is nearest to a vector (§2.5). */
  GetClosestHole(inVector: any) {
    if (!this.Holes) this.GetHoles();
    const isVec = inVector instanceof THREE.Vector3 || (inVector && typeof inVector === 'object' && !Array.isArray(inVector) && 'x' in inVector && 'y' in inVector && 'z' in inVector);
    if (isVec) {
      const v = V(Number(inVector.x), Number(inVector.y), Number(inVector.z)); let best = Infinity, idx: number | undefined;
      (this.Holes.Centroids as THREE.Vector3[]).forEach((c, i) => { const d = c.distanceTo(v); if (d < best) { best = d; idx = i; } });
      b18d(this.app).leak = idx; return idx;
    }
    if (Array.isArray(inVector)) throw new Error('GetClosestHole: an array input calls GetCentroid, which the file does not define (script error, inferred)');
    logErr(this.app, 'GetClosestHole requires an input vector of array of vectors.');
    return b18d(this.app).leak;
  }

  /** ReorderHole (§2.4); Direction is ignored. */
  ReorderHole(Index: number, _Direction?: any) {
    const H = this.Holes ?? this.GetHoles(); const nh = H.Edges.length;
    H.QuadrantPoints = new Array(nh); H.QuadrantIndices = new Array(nh); const oldPI = H.PointIndices; H.PointIndices = new Array(nh);
    const pts: PointRec[] = H.Points[Index]; if (!pts) return;
    const n = pts.length; const maj: number[] = H.MajorAxisIndices[Index] ?? []; const min: number[] = H.MinorAxisIndices[Index] ?? [];
    if (maj.length < 2) { H.PointIndices[Index] = oldPI?.[Index]; return; }
    const [a, b] = maj; const s = pts[a].Position.x <= pts[b].Position.x ? a : b; const o2 = s === a ? b : a;
    const q: any[] = [pts[s], undefined, pts[o2], undefined];
    if (n > 3 && min.length >= 2) { const [c, d] = min; const lo = pts[c].Position.y <= pts[d].Position.y ? c : d; q[1] = pts[lo]; q[3] = pts[lo === c ? d : c]; }
    H.QuadrantPoints[Index] = push([], q[0], q[1], q[2], q[3]);
    const rot = <T>(l: T[]) => l.slice(s).concat(l.slice(0, s));
    let rp = rot(pts), re = rot(H.Edges[Index] as EdgeRec[]), ri = rp.map(p => p.Index);
    let qi = [...new Set([...maj, ...min].map(p => ((p - s) % n + n) % n))].sort((x, y) => x - y);
    // direction check on the original first point
    const p0 = pts[0].Index; const poly = this.polys.findIndex(f => f.includes(p0));
    if (poly < 0) logErr(this.app, 'Error reordering hole hole ');
    else {
      const f = this.polys[poly]; const k = f.indexOf(p0); const prev = f[(k - 1 + f.length) % f.length], next = f[(k + 1) % f.length];
      if ((n > 1 && next === pts[1].Index) || prev === pts[n - 1].Index) { rp = rp.reverse(); re = re.reverse(); ri = ri.reverse(); qi = qi.reverse(); }
    }
    H.Points[Index] = rp; H.Edges[Index] = re; H.PointIndices[Index] = ri; H.QuadrantIndices[Index] = qi;
  }
  ReorderHoles(all?: any, _dir?: any) { const H = this.Holes; if (all && H && typeof H.length === 'number') for (let i = 0; i < H.length; i++) this.ReorderHole(i); }

  /** Appends the polygons that zip hole `Index` closed from both ends. */
  CapHoleData(Index: number) {
    if (!this.PolygonData) this.GetPolydata();
    const h: number[] = (this.Holes?.Points?.[Index] ?? []).map((p: PointRec) => p.Index); const n = h.length; if (n < 3) return;
    let a = h[0], b = h[n - 1];
    for (let j = 1; j < n / 2; j++) {
      const k = n - 1 - j;
      if (j === k) { this.PolygonData!.push(3, a, h[j], b); break; }
      this.PolygonData!.push(4, a, h[j], h[k], b); a = h[j]; b = h[k];
    }
  }
  CapHole(Index: number) { if (this.Object) freezeObj(this.app, this.Object); this.CapHoleData(Index); this.Set(); call(this.app, 'SceneRefresh'); }
  CapHoles() {
    if (!this.Holes) this.GetHoles();
    if (this.Object) freezeObj(this.app, this.Object);
    for (let i = 0; i < this.Holes.Edges.length; i++) { this.ReorderHole(i); this.CapHoleData(i); }
    this.Set(); call(this.app, 'SceneRefresh');
  }
  /** Geometry.Set(vertices, polygon data) on the object; then re-reads the helper arrays. */
  Set(pData?: number[], vertices?: number[]) {
    const pd = pData ?? this.PolygonData ?? [], vs = vertices ?? this.Vertices ?? [];
    if (!this.Object) return;
    const verts: number[][] = []; for (let i = 0; i + 2 < vs.length; i += 3) verts.push([vs[i], vs[i + 1], vs[i + 2]]);
    const faces: number[][] = []; for (let i = 0; i < pd.length;) { const c = pd[i]; faces.push(pd.slice(i + 1, i + 1 + c)); i += c + 1; }
    setMeshGeometry(this.app, this.Object, verts, faces);
    this.ActivePrimitive = this.Object.primitive; this.GetPolydata();
  }
  /** A closed NURBS curve per hole (or hole n) on the scene root named `<object>_<i>`. */
  ExtractHoles(n?: any, degree = 1) {
    if (!this.Holes) this.GetHoles();
    const out: X3DObject[] = [];
    this.Holes.Points.forEach((pts: PointRec[], i: number) => {
      if (typeof n === 'number' && n !== i) return;
      out.push(addCurveList(this.app, `${this.Object?.name ?? 'hole'}_${i}`, null, [{ pts: pts.map(p => p.Position.clone()), degree, closed: true }]));
    });
    return out;
  }
}

/** fr_GetPolymesh (§2.1). */
export function frGetPolymesh(app: App, a: Record<string, any>) {
  const st = b18d(app);
  let obj: X3DObject | null;
  const empty = (v: any) => unset(v) || v === '';
  if (empty(a.iprimitive) && empty(a.ivertices) && empty(a.iPolygonData)) obj = selection0(app);
  else { const v = a.iprimitive; obj = v?.kind === 'primitive' ? v.parent : objArg(app, v); }
  if (!obj || obj.type !== 'polymsh') { logErr(app, 'no polymesh found, try again '); return false; }
  if (!st.cached?.ActivePrimitive || (a.inOverride && !empty(a.inOverride))) st.cached = new PolymeshHelper(app, obj.primitive);
  return st.cached;
}

// ================================================================== InitNeck.js
function headScale(app: App, C: string): number {
  const fs = sget(app, 'psets', 'FaceScale');
  const s = fs instanceof Property ? Number(fs.val('Scale')) : fs && typeof fs === 'object' ? Number(fs.Scale) : NaN;
  if (!Number.isFinite(s)) throw new Error(`${C}: fr_sget("psets", "FaceScale") has no Scale (script error)`);
  return s;
}
const fitOf = (app: App) => sgetObj(app, 'Fit');
function neckGroup(app: App, o: X3DObject) {
  const g = sget(app, 'groups', 'Neck');
  if (!g) { nya(app, 'fr_InitNeck', 'fr_sget("groups", "Neck") is empty: the object is not grouped'); return; }
  call(app, 'fr_AddToGroup', { inGroup: g, inObjs: o, notInspectable: 0, Branch: false });
}
/** Ray along local ±z of the mesh from `p` (world): the nearest hit (ShrinkWrap Proj 2, alongz, bidir stand-in). */
function projectZ(mesh: X3DObject, p: THREE.Vector3): THREE.Vector3 | null {
  const m = mesh.primitive?.mesh(); if (!m) return null;
  const W = mesh.globalMatrix(); const inv = W.clone().invert(); const lp = p.clone().applyMatrix4(inv);
  let best: THREE.Vector3 | null = null, bd = Infinity;
  const P = (i: number) => V(m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]);
  for (const dir of [V(0, 0, 1), V(0, 0, -1)]) {
    const ray = new THREE.Ray(lp, dir);
    for (let t = 0; t < m.indices.length; t += 3) {
      const hit = ray.intersectTriangle(P(m.indices[t]), P(m.indices[t + 1]), P(m.indices[t + 2]), false, V());
      if (hit) { const d = hit.distanceTo(lp); if (d < bd) { bd = d; best = hit.clone(); } }
    }
  }
  return best ? best.applyMatrix4(W) : null;
}
export function frInitNeck(app: App, a: Record<string, any>) {
  const C = 'fr_InitNeck';
  const head = objArg(app, a.inHeadMesh); if (unset(a.inHeadMesh) || a.inHeadMesh === '' || !head) return null;
  const markers = objList(app, a.inNeckMarkers);
  if (markers.length < 7) throw new Error(`${C}: inNeckMarkers needs 7 markers (got ${markers.length}; script error)`);
  const fit = fitOf(app); const s = headScale(app, C) * 2;
  const Mk = markers.slice(0, 7).map(globalPos);
  const boxV = sget(app, 'meshbox'); const box: number[] = Array.isArray(boxV) ? boxV.map(Number) : String(boxV ?? '').split(',').map(Number);
  if (!(box.length > 4)) throw new Error(`${C}: fr_sget("meshbox") is not a box array (script error)`);
  const P1 = Mk[1].clone(); P1.z = (Mk[0].z + box[4]) / 2;
  const headSize = box[3] - P1.y;
  const P0 = P1.clone(); P0.y -= 0.7 * headSize;
  const T = [Mk[3], Mk[4], Mk[5], Mk[6]].map(v => v.clone());
  T.push(Mk[4].clone().add(Mk[4].clone().sub(Mk[5]).multiplyScalar(1.3)));
  const neckBase = addInPlace(app, 'Cube', 0, fit, s, P0, 'NeckBase', 239); neckGroup(app, neckBase);
  const headBase = addInPlace(app, 'Cube', 0, fit, s, P1, 'HeadBase', 239); neckGroup(app, headBase);
  const r: [number, number] = [headSize / 10, headSize * 10];
  customProperty(app, headBase, 'Dimensions', ['X', 'Y', 'Z'].map(n => num(n, headSize, n, { min: Math.min(...r), max: Math.max(...r), uimin: Math.min(...r), uimax: Math.max(...r) })));
  const depth: X3DObject[] = [];
  for (const [name, t, perc] of [['LowerNeckDepth', 2 / 5, 40], ['UpperNeckDepth', 3 / 5, 60]] as const) {
    const P = P0.clone().lerp(P1, t);
    const nl = addInPlace(app, 'Null', 0, fit, 0.01, P, name, 0);
    constrain(app, nl, 'TwoPoints', [neckBase, headBase], { perc });
    neckGroup(app, nl);
    const cube = addInPlace(app, 'Cube', 0, nl, Math.max(0.01, s), P, name, 188); neckGroup(app, cube);
    depth.push(cube);
  }
  // NeckFC through NeckBase, the two depth cubes and HeadBase
  const drivers = [neckBase, depth[0], depth[1], headBase];
  const inv = (fit ?? app.scene.root).globalMatrix().clone().invert();
  const neckFC = addCurveList(app, 'NeckFC', fit, [{ pts: drivers.map(o => globalPos(o).applyMatrix4(inv)), degree: 3, closed: false, knots: [0, 0, 0, 1, 1, 1] }]);
  drivers.forEach((o, k) => addPointCluster(app, neckFC, `point${k}`, [k], o));
  wireColor(app, neckFC, 239); neckGroup(app, neckFC);
  // SternumTop, projected onto the head mesh
  const sternum = addInPlace(app, 'Cube', 0, fit, s / 2, T[4], 'SternumTop', 188);
  const hit = projectZ(head, T[4]); if (hit) { setGlobalPos(app, sternum, hit); T[4] = hit; }
  b18d(app).calls.push({ name: 'ApplyOp', args: { preset: 'ShrinkWrap', Proj: 2, alongz: true, bidir: true, target: siName(head) } });
  const adams = addInPlace(app, 'Cube', 1, fit, 1, T[1].clone().lerp(T[2], 0.4), 'AdamsApple_Cluster', 256);
  for (const [p, v] of [['sclx', 2 * Mk[2].x], ['sclz', 2 * Mk[2].x], ['scly', 3 * Mk[2].x]] as const) setParamU(app, adams.kinematics.local, p, v);
  setViewVis(app, adams, false);
  const trach = addInPlace(app, 'Cube', 1, fit, 1, T[4].clone().lerp(T[2], 0.5), 'TrachealInfluence_Cluster', 256);
  for (const [p, v] of [['scly', Math.abs(T[2].y - T[4].y)], ['sclx', 4 * Mk[2].x], ['sclz', 3 * Mk[2].x]] as const) setParamU(app, trach.kinematics.local, p, v);
  setViewVis(app, trach, false);
  return [neckBase, headBase, neckBase, depth[0], depth[1], headBase, neckFC, adams, trach];
}

// ================================================================== InitNose.js
export function noseRingPoints(B: THREE.Vector3, G: THREE.Vector3, Tp: THREE.Vector3) {
  const BT = Tp.clone().sub(B), BG = G.clone().sub(B);
  const BT0 = BT.clone(); BT0.x = 0; const BG0 = BG.clone(); BG0.x = 0;
  const d = BT0.lengthSq() > 0 ? BT0.dot(BG0) / BT0.lengthSq() : 0;
  let P = B.clone().add(BT.clone().multiplyScalar(d)); P.x = G.x;
  const M = P.clone().lerp(Tp, 0.5);
  let Q2 = G.clone().sub(P); let Q3 = G.clone();
  if (G.y < P.y) { P = P.clone().add(Q2.clone().multiplyScalar(2)); Q2 = Q2.clone().negate(); }
  if (Q2.length() > 0) {
    Q3 = Q2.clone().normalize().multiplyScalar(0.75 * Math.abs(G.x)).add(G); Q3.x = G.x / 2;
    const q2x = (Q2.x + M.x) / 2; Q2 = Q2.clone().add(G); Q2.x = q2x;
  } else { Q2 = G.clone(); Q2.y += Math.abs(G.x / 2); Q3 = Q2.clone(); Q3.y += Math.abs(G.x / 2); }
  const S = P.clone(); S.x = P.x / 10;
  const U = P.clone().lerp(S, 0.5);
  const off = BT.length() > 0 ? BT.clone().multiplyScalar((S.clone().sub(P).length() / 2) / BT.length()) : V(); off.x = 0;
  const RB = U.clone().sub(off), RT = U.clone().add(off);
  return { P, G: G.clone(), Q2, Q3, S, U, RB, RT };
}
export function frInitNose(app: App, a: Record<string, any>) {
  const C = 'fr_InitNose';
  const scale = unset(a.inScale) || a.inScale === '' ? 1 : Number(a.inScale);
  const sym = !!a.inSymmetry && !unset(a.inSymmetry);
  const fit = fitOf(app);
  if (!fit) throw new Error(`${C}: fr_sget("Fit") is empty (script error)`);
  const out: X3DObject[] = []; const handlesBySide: Record<string, X3DObject[]> = {};
  for (const side of ['L', 'R']) {
    const base = findChild(fit, `${side}NostrilBase`), bulge = sgetObj(app, 'features', `${side}NostrilBulge`), tip = sgetObj(app, 'features', 'NoseTip');
    if (!base || !bulge || !tip) throw new Error(`${C}: ${side}NostrilBase / features ${side}NostrilBulge / NoseTip missing (script error)`);
    const R = noseRingPoints(globalPos(base), globalPos(bulge), globalPos(tip));
    const inv = fit.globalMatrix().clone().invert(); const L = (v: THREE.Vector3) => v.clone().applyMatrix4(inv);
    const ring = addCurveList(app, `${side}NoseRing`, fit, [
      { pts: [R.P, R.G, R.Q2, R.Q3].map(L), degree: 3, closed: false, knots: [0, 0, 0, 1, 1, 1] },
      { pts: [R.RB, R.P, R.RT, R.S].map(L), degree: 3, closed: true, knots: [-2, -1, 0, 1, 2] },
    ]);
    app.select([base, bulge, tip, ring]);
    wireColor(app, ring, 239);
    const up = addInPlace(app, 'Null', 0, ring, scale / 10, R.U, `${ring.name}_UpVector`, 0);
    customProperty(app, ring, 'CurveData', [int('Divisions', 3, 'Divisions', { min: 1, max: 15, uimin: 1, uimax: 15 }), str('Controller', bulge.name, 'Controller')]);
    const pts = [R.P, R.G, R.Q2, R.Q3, R.RB, R.P, R.RT, R.S].map(L);
    const handles: X3DObject[] = [];
    pts.forEach((p, j) => {
      let reuse: X3DObject | null = null;
      for (let k = 0; k < j; k++) if (pts[k].distanceTo(p) === 0) reuse = handles[k];
      let hdl = reuse;
      if (!hdl) {
        hdl = addInPlace(app, 'Cube', 0, ring, scale * 0.05, V(), `${ring.name}${ring.name}`, 188);
        setGlobalPos(app, hdl, p);   // global translation = the point's local position (as shipped)
        call(app, 'SetNeutralPose', { InputObjs: hdl, Mode: 'siSRT', Key: false });
      }
      handles.push(hdl);
      addPointCluster(app, ring, `${ring.name}_pnt${j}`, [j], hdl);
    });
    handles.push(up); handlesBySide[side] = handles;
    if (side === 'R' && sym) handles.forEach((h, j) => { const l = handlesBySide.L[j]; if (l && h !== l) constrain(app, h, 'Symmetry', [l]); });
    constrain(app, up, 'NPoints', [handles[4], handles[5], handles[6], handles[7]]);
    out.push(ring, ...ring.descendants());
  }
  return out;
}
export { ROW, Null, addObject };
