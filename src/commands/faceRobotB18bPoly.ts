// Ledger row CMD-B18b: the MeshHelper.js polymesh helper object the preparation commands work with (hole detection,
// ReorderHole, GetClosestHole). Brief: docs/ghidra/cmd-b18d-fr-small-scripts.md §2.1-2.5 (read for CMD-B18b, which
// promoted the six hole commands to SPEC). Original code written from that prose only.
//
// Mapping onto this build: mesh `Point` / `Edge` objects are point indices / [a, b] vertex pairs. The edge collection is
// the mesh's undirected edges in order of first appearance around the polygons (inferred: Softimage's edge indexing is
// not attested); an edge's neighbour edges are the edges sharing one of its vertices, in collection order.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject } from '../core/scene';
import { b18, siError } from './faceRobotB18bcShared';

export interface HoleRecord {
  Edges: [number, number][][]; EdgeIndices: number[][]; Points: number[][]; PointIndices: (number[] | undefined)[];
  Centroids: THREE.Vector3[]; MidPoints: THREE.Vector3[]; DepthVectors: THREE.Vector3[]; MajorAxisVectors: THREE.Vector3[];
  MajorAxisLength: number[]; FurthestPoints: number[]; OppositePoints: number[];
  MajorAxisIndices: ([number, number] | undefined)[]; MinorAxisIndices: (number | undefined)[][];
  QuadrantPoints?: (number[] | undefined)[]; QuadrantIndices?: (number[] | undefined)[];
}

export class PolyHelper {
  ActivePrimitive: any; Object: X3DObject; Transform: THREE.Matrix4;
  Vertices: number[] = []; PolygonData: number[][] = []; EdgeList: [number, number][] = [];
  Holes: HoleRecord | undefined;
  /** fields the preparation commands store on the helper */
  Diagnose?: string; EyeHoles?: number[]; MouthHoles?: number[]; EyeSockets?: any[];
  xScale?: number; yScale?: number;
  constructor(private app: App, obj: X3DObject) {
    this.ActivePrimitive = obj.primitive; this.Object = obj; this.Transform = obj.globalMatrix().clone();
    this.GetPolydata();
  }
  GetPolydata() {
    const m = this.Object.primitive?.mesh();
    if (!m) { this.app.logMsg('info', 'No existing object. ActivePrimitive has been passed.'); return; }
    this.Vertices = Array.from(m.positions); this.PolygonData = m.polygons.map(f => f.slice());
    const seen = new Map<string, number>(); this.EdgeList = [];
    for (const f of this.PolygonData) for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!seen.has(k)) { seen.set(k, this.EdgeList.length); this.EdgeList.push(a < b ? [a, b] : [b, a]); }
    }
  }
  pos(i: number) { return new THREE.Vector3(this.Vertices[i * 3], this.Vertices[i * 3 + 1], this.Vertices[i * 3 + 2]); }
  holeCount(): number { return this.Holes?.Edges.length ?? 0; }

  /** GetHoles(inOverride), cmd-b18d §2.3. */
  GetHoles(override?: any): HoleRecord | undefined {
    if (!this.Vertices.length) this.GetPolydata();
    const cached: PolyHelper | any = b18(this.app).helper;
    if (!override && cached?.Holes?.Edges && cached.Holes.Points) { this.Holes = cached.Holes; return this.Holes; }
    // open edges: fewer than 2 neighbour polygons
    const cnt = new Map<string, number>();
    for (const f of this.PolygonData) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = a < b ? `${a}-${b}` : `${b}-${a}`; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    const open: number[] = []; this.EdgeList.forEach(([a, b], i) => { if ((cnt.get(`${a}-${b}`) ?? 0) < 2) open.push(i); });
    const byVert = new Map<number, number[]>(); this.EdgeList.forEach(([a, b], i) => { for (const v of [a, b]) { const l = byVert.get(v) ?? []; l.push(i); byVert.set(v, l); } });
    const nbrEdges = (e: number) => { const [a, b] = this.EdgeList[e]; return [...new Set([...(byVert.get(a) ?? []), ...(byVert.get(b) ?? [])])].filter(x => x !== e).sort((x, y) => x - y); };
    const rec: HoleRecord = { Edges: [], EdgeIndices: [], Points: [], PointIndices: [], Centroids: [], MidPoints: [], DepthVectors: [], MajorAxisVectors: [], MajorAxisLength: [], FurthestPoints: [], OppositePoints: [], MajorAxisIndices: [], MinorAxisIndices: [] };
    this.Holes = rec;
    const remaining = new Set(open);
    while (remaining.size) {
      let cur = [...remaining][0]; remaining.delete(cur); const walk = [cur];
      for (;;) { const nx = nbrEdges(cur).find(x => remaining.has(x)); if (nx === undefined) break; remaining.delete(nx); walk.push(nx); cur = nx; }
      // Edge vertex order: Softimage's own order is not attested; this build orients each edge along the walk (the
      // vertex shared with the previous edge first), so the one-point-per-edge rule of step 5 visits every hole vertex.
      const oriented: [number, number][] = [];
      walk.forEach((e, i) => {
        const [a, b] = this.EdgeList[e];
        if (i === 0) { const nx = walk[1] !== undefined ? this.EdgeList[walk[1]] : null; oriented.push(nx && nx.includes(a) && !nx.includes(b) ? [b, a] : [a, b]); }
        else { const prevEnd = oriented[i - 1][1]; oriented.push(b === prevEnd ? [b, a] : [a, b]); }
      });
      rec.Edges.push(oriented); rec.EdgeIndices.push([]);
      if (rec.Edges.length > 99) { siError(this.app, 'Too many Holes.'); for (let h = 0; h < rec.Edges.length; h++) { rec.Points[h] = []; rec.PointIndices[h] = []; } return rec; }
    }
    let lastPlane: number | undefined;
    rec.Edges.forEach((edges, h) => {
      const pts: number[] = []; const seen = new Set<number>();
      for (const [a, b] of edges) { const v = !seen.has(a) ? a : !seen.has(b) ? b : -1; if (v >= 0) { seen.add(v); pts.push(v); } }
      rec.Points[h] = pts; rec.PointIndices[h] = pts.slice();
      const c = new THREE.Vector3(); for (const p of pts) c.add(this.pos(p)); if (pts.length) c.multiplyScalar(1 / pts.length);
      rec.Centroids[h] = c;
      let fi: number | undefined, best = 0;
      pts.forEach((p, i) => { const d = this.pos(p).distanceTo(c); if (d > best) { best = d; fi = i; } });
      if (fi === undefined) { rec.MinorAxisIndices[h] = []; return; }
      let oi: number | undefined, bo = 0; const F = this.pos(pts[fi]);
      pts.forEach((p, i) => { const d = this.pos(p).distanceTo(F); if (d > bo) { bo = d; oi = i; } });
      if (oi === undefined) { rec.MinorAxisIndices[h] = []; return; }
      const O = this.pos(pts[oi]);
      rec.MajorAxisIndices[h] = [fi, oi]; rec.FurthestPoints[h] = pts[fi]; rec.OppositePoints[h] = pts[oi];
      const mid = F.clone().add(O).multiplyScalar(0.5); rec.MidPoints[h] = mid;
      const [hi, lo] = F.x >= O.x ? [F, O] : [O, F];
      const X = lo.clone().sub(hi); rec.MajorAxisLength[h] = X.length(); X.normalize(); rec.MajorAxisVectors[h] = X;
      rec.DepthVectors[h] = X.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      this.xScale = rec.MajorAxisLength[h];
      const n = pts.length; const minor: (number | undefined)[] = [];
      if (n === 4) { minor.push((fi + 1) % n, (fi - 1 + n) % n); }
      else {
        let prev: number | undefined;
        for (const [s, e] of [[oi, fi], [fi, oi]] as [number, number][]) {
          const L = (e - s + n) % n; let pick: number | undefined, bd = Infinity;
          for (let k = 1; k <= L - 2; k++) { const at = (s + k) % n; const d = Math.abs(this.pos(pts[at]).sub(mid).dot(X)); if (d < bd) { bd = d; pick = at; lastPlane = d; } }
          if (pick === undefined) pick = prev;
          minor.push(pick); prev = pick;
        }
      }
      rec.MinorAxisIndices[h] = minor;
    });
    this.yScale = lastPlane;
    return rec;
  }

  /** ReorderHole(Index), cmd-b18d §2.4. */
  ReorderHole(index: number) {
    const H = this.Holes; if (!H || !H.Points[index]) return;
    const nh = H.Edges.length;
    H.QuadrantPoints = new Array(nh); H.QuadrantIndices = new Array(nh); H.PointIndices = new Array(nh);
    const pts = H.Points[index], edges = H.Edges[index], n = pts.length;
    const maj = H.MajorAxisIndices[index]; if (!maj) { H.PointIndices[index] = pts.slice(); return; }
    const [m0, m1] = this.pos(pts[maj[0]]).x <= this.pos(pts[maj[1]]).x ? [maj[0], maj[1]] : [maj[1], maj[0]];
    const quadPos: number[] = [m0];
    const minor = H.MinorAxisIndices[index] ?? [];
    const both = n > 3 && minor[0] !== undefined && minor[1] !== undefined;
    let q1: number | undefined, q3: number | undefined;
    if (both) { const a = minor[0]!, b = minor[1]!; [q1, q3] = this.pos(pts[a]).y <= this.pos(pts[b]).y ? [a, b] : [b, a]; }
    const qp = [m0, q1, m1, q3]; H.QuadrantPoints[index] = qp.filter(x => x !== undefined).map(x => pts[x!]);
    if (both) quadPos.push(q1!, m1, q3!); else quadPos.push(m1);
    const s = m0;
    const origFirst = pts[0], origSecond = pts[1 % n], origLast = pts[n - 1];
    let rp = pts.map((_, i) => pts[(i + s) % n]), re = edges.map((_, i) => edges[(i + s) % n]);
    let qi = [...new Set(quadPos.map(p => (p - s + n) % n))].sort((a, b) => a - b);
    const poly = this.PolygonData.find(f => f.includes(origFirst));
    if (!poly) siError(this.app, 'Error reordering hole hole ');
    else {
      const k = poly.indexOf(origFirst); const next = poly[(k + 1) % poly.length], prev = poly[(k - 1 + poly.length) % poly.length];
      if (next === origSecond || prev === origLast) { rp = rp.reverse(); re = re.reverse(); qi = qi.reverse(); }
    }
    H.Points[index] = rp; H.Edges[index] = re; H.PointIndices[index] = rp.slice(); H.QuadrantIndices[index] = qi;
  }

  /** GetClosestHole(inVector): index of the hole whose local centroid is nearest (first minimum wins). */
  GetClosestHole(v: any): number | undefined {
    if (!this.Holes) this.GetHoles();
    if (v instanceof THREE.Vector3 || (Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number'))) {
      const p = v instanceof THREE.Vector3 ? v : new THREE.Vector3(v[0], v[1], v[2]);
      let best = Infinity, idx: number | undefined;
      this.Holes!.Centroids.forEach((c, i) => { const d = c.distanceTo(p); if (d < best) { best = d; idx = i; } });
      return idx;
    }
    siError(this.app, 'GetClosestHole requires an input vector of array of vectors.');
    return undefined;
  }
}

/** fr_GetPolymesh(obj, override): a new helper when the cache is empty or `override`, else the cached one (no mesh check). */
export function getPolymesh(app: App, obj: X3DObject, override?: any): PolyHelper {
  const st = b18(app);
  if (!st.helper?.ActivePrimitive || override) st.helper = new PolyHelper(app, obj);
  return st.helper as PolyHelper;
}
