// Mesh-adjacency helpers for the component-selection commands in selectionGroupLayer.ts.
// Original code. Pure functions over MeshData; components are addressed the way App.compSel stores them:
// points and polygons by index, edges by the "a-b" vertex-pair key (edgeKey from core/topology).
//
// The loop definitions used here are the publicly documented ones for quad meshes:
//  - edge loop: at a vertex with four edges, continue along the one edge that shares no polygon with the
//    edge you arrived on; along a mesh border, continue along the border;
//  - parallel edge loop (edge ring): cross each incident quad to its opposite edge.
import type { MeshData } from '../core/geometry';
import { edgeKey, meshEdges, type CompKind } from '../core/topology';

export type CompItem = number | string;

export interface Adjacency {
  mesh: MeshData;
  nPoints: number;
  /** unique edges in meshEdges order; the position in this list is the edge index used in "obj.edge[i]" strings */
  edges: string[];
  edgeIndex: Map<string, number>;
  edgePolys: Map<string, number[]>;
  vertPolys: number[][];
  vertEdges: string[][];
  polyEdges: string[][];
}

export const edgeVerts = (k: string): [number, number] => { const [a, b] = k.split('-').map(Number); return [a, b]; };

export function adjacencyOf(m: MeshData): Adjacency {
  const nPoints = m.positions.length / 3;
  const edges = meshEdges(m).map(e => edgeKey(e[0], e[1]));
  const edgeIndex = new Map<string, number>(); edges.forEach((k, i) => edgeIndex.set(k, i));
  const edgePolys = new Map<string, number[]>(); for (const k of edges) edgePolys.set(k, []);
  const vertPolys: number[][] = Array.from({ length: nPoints }, () => []);
  const vertEdges: string[][] = Array.from({ length: nPoints }, () => []);
  const polyEdges: string[][] = [];
  m.polygons.forEach((f, pi) => {
    const pe: string[] = [];
    for (let i = 0; i < f.length; i++) {
      const k = edgeKey(f[i], f[(i + 1) % f.length]); pe.push(k);
      const l = edgePolys.get(k)!; if (!l.includes(pi)) l.push(pi);
      if (!vertPolys[f[i]].includes(pi)) vertPolys[f[i]].push(pi);
    }
    polyEdges.push(pe);
  });
  for (const k of edges) { const [a, b] = edgeVerts(k); vertEdges[a].push(k); vertEdges[b].push(k); }
  return { mesh: m, nPoints, edges, edgeIndex, edgePolys, vertPolys, vertEdges, polyEdges };
}

export function allItems(adj: Adjacency, kind: CompKind): CompItem[] {
  if (kind === 'point') return [...Array(adj.nPoints).keys()];
  if (kind === 'polygon') return adj.mesh.polygons.map((_, i) => i);
  return [...adj.edges];
}

/** The points a set of components touches. */
export function pointsOf(adj: Adjacency, kind: CompKind, items: Iterable<CompItem>): Set<number> {
  const out = new Set<number>();
  for (const it of items) {
    if (kind === 'point') out.add(it as number);
    else if (kind === 'edge') for (const v of edgeVerts(it as string)) out.add(v);
    else for (const v of adj.mesh.polygons[it as number] ?? []) out.add(v);
  }
  return out;
}

/** Same-kind neighbours of one component: points across an edge, edges and polygons through a shared point. */
export function neighbours(adj: Adjacency, kind: CompKind, it: CompItem): CompItem[] {
  if (kind === 'point') return adj.vertEdges[it as number].map(k => { const [a, b] = edgeVerts(k); return a === it ? b : a; });
  const out = new Set<CompItem>();
  if (kind === 'edge') { for (const v of edgeVerts(it as string)) for (const k of adj.vertEdges[v]) if (k !== it) out.add(k); }
  else for (const v of adj.mesh.polygons[it as number] ?? []) for (const p of adj.vertPolys[v]) if (p !== it) out.add(p);
  return [...out];
}

export function grow(adj: Adjacency, kind: CompKind, sel: Set<CompItem>): Set<CompItem> {
  const out = new Set<CompItem>(sel);
  for (const it of sel) for (const n of neighbours(adj, kind, it)) out.add(n);
  return out;
}

/** Inverse of grow: a component stays only when every same-kind neighbour is selected too. */
export function shrink(adj: Adjacency, kind: CompKind, sel: Set<CompItem>): Set<CompItem> {
  const out = new Set<CompItem>();
  for (const it of sel) if (neighbours(adj, kind, it).every(n => sel.has(n))) out.add(it);
  return out;
}

/** Components of kind `to` that touch the selection (share a point with it; point to point goes across an edge).
 *  For from === to the selection itself is not part of the result. */
export function adjacent(adj: Adjacency, from: CompKind, sel: Set<CompItem>, to: CompKind): Set<CompItem> {
  const out = new Set<CompItem>();
  if (from === to) { for (const it of sel) for (const n of neighbours(adj, from, it)) if (!sel.has(n)) out.add(n); return out; }
  const pts = pointsOf(adj, from, sel);
  if (to === 'point') return pts as Set<CompItem>;
  for (const v of pts) for (const x of (to === 'edge' ? adj.vertEdges[v] : adj.vertPolys[v])) out.add(x);
  return out;
}

/** Components of kind `to` that the selection fully describes: going down (polygon to edge to point) every
 *  sub-component of the selection; going up, only those whose sub-components are all selected. */
export function convert(adj: Adjacency, from: CompKind, sel: Set<CompItem>, to: CompKind): Set<CompItem> {
  if (from === to) return new Set(sel);
  const rank = { point: 0, edge: 1, polygon: 2 } as const;
  const out = new Set<CompItem>();
  if (rank[to] < rank[from]) {
    if (to === 'point') return pointsOf(adj, from, sel) as Set<CompItem>;
    for (const p of sel) for (const k of adj.polyEdges[p as number] ?? []) out.add(k);   // polygon -> edge
    return out;
  }
  if (from === 'point' && to === 'edge') { for (const k of adj.edges) { const [a, b] = edgeVerts(k); if (sel.has(a) && sel.has(b)) out.add(k); } return out; }
  if (from === 'point') { adj.mesh.polygons.forEach((f, pi) => { if (f.length && f.every(v => sel.has(v))) out.add(pi); }); return out; }
  adj.polyEdges.forEach((pe, pi) => { if (pe.length && pe.every(k => sel.has(k))) out.add(pi); });   // edge -> polygon
  return out;
}

/** Flood fill over same-kind neighbours: the connected island(s) holding the selection. */
export function island(adj: Adjacency, kind: CompKind, sel: Set<CompItem>): Set<CompItem> {
  const out = new Set<CompItem>(sel); const todo = [...sel];
  while (todo.length) { const it = todo.pop()!; for (const n of neighbours(adj, kind, it)) if (!out.has(n)) { out.add(n); todo.push(n); } }
  return out;
}

const isBorder = (adj: Adjacency, k: string) => (adj.edgePolys.get(k)?.length ?? 0) === 1;

/** The edge that continues the loop of `k` through its end point `v`, or null where the loop stops.
 *  `border` = follow the mesh border through any point that has exactly two border edges (boundary loop);
 *  `aroundCorners` = also let an ordinary loop turn at a border corner (a border point with only two edges). */
export function loopNext(adj: Adjacency, k: string, v: number, opts: { aroundCorners?: boolean; border?: boolean } = {}): string | null {
  const ve = adj.vertEdges[v];
  if (isBorder(adj, k)) {
    const b = ve.filter(e => e !== k && isBorder(adj, e));
    if (b.length !== 1) return null;
    if (opts.border || ve.length === 3 || (opts.aroundCorners && ve.length === 2)) return b[0];
    return null;
  }
  if (opts.border) return null;
  if (ve.length !== 4 || ve.some(e => isBorder(adj, e))) return null;
  const mine = adj.edgePolys.get(k) ?? [];
  const across = ve.filter(e => e !== k && !(adj.edgePolys.get(e) ?? []).some(p => mine.includes(p)));
  return across.length === 1 ? across[0] : null;
}

/** The whole loop through edge `k`, walked from both end points. */
export function edgeLoop(adj: Adjacency, k: string, opts: { aroundCorners?: boolean; border?: boolean } = {}): Set<string> {
  const out = new Set<string>([k]);
  if (opts.border && !isBorder(adj, k)) return new Set();
  for (const start of edgeVerts(k)) {
    let cur = k, v = start;
    for (let n = 0; n < 100000; n++) {
      const nx = loopNext(adj, cur, v, opts); if (!nx || out.has(nx)) break;
      out.add(nx); const [a, b] = edgeVerts(nx); v = a === v ? b : a; cur = nx;
    }
  }
  return out;
}

/** The edge ring through `k`: across every incident quad to the opposite edge. */
export function parallelLoop(adj: Adjacency, k: string): Set<string> {
  const out = new Set<string>([k]); const todo = [k];
  while (todo.length) {
    const cur = todo.pop()!;
    for (const pi of adj.edgePolys.get(cur) ?? []) {
      const pe = adj.polyEdges[pi]; if (pe.length !== 4) continue;
      const opp = pe[(pe.indexOf(cur) + 2) % 4];
      if (!out.has(opp)) { out.add(opp); todo.push(opp); }
    }
  }
  return out;
}

/** Border of a polygon region: the edges that belong to exactly one selected polygon. */
export function polygonOutline(adj: Adjacency, polys: Set<CompItem>): Set<string> {
  const count = new Map<string, number>();
  for (const p of polys) for (const k of adj.polyEdges[p as number] ?? []) count.set(k, (count.get(k) ?? 0) + 1);
  const out = new Set<string>(); for (const [k, n] of count) if (n === 1) out.add(k);
  return out;
}

/** Loops implied by a selection. Edges: the loop of every selected edge. Points: the loop of every edge whose two
 *  end points are selected. Polygons: for every pair of selected polygons sharing an edge, the strip of quads that
 *  crosses that edge's ring. */
export function componentLoops(adj: Adjacency, kind: CompKind, sel: Set<CompItem>, aroundCorners: boolean): Set<CompItem> {
  const out = new Set<CompItem>(sel);
  if (kind === 'edge') { for (const k of sel) for (const e of edgeLoop(adj, k as string, { aroundCorners })) out.add(e); return out; }
  if (kind === 'point') {
    for (const k of adj.edges) { const [a, b] = edgeVerts(k); if (sel.has(a) && sel.has(b)) for (const e of edgeLoop(adj, k, { aroundCorners })) for (const v of edgeVerts(e)) out.add(v); }
    return out;
  }
  for (const k of adj.edges) {
    const ps = adj.edgePolys.get(k) ?? [];
    if (ps.length !== 2 || !ps.every(p => sel.has(p))) continue;
    for (const e of parallelLoop(adj, k)) for (const p of adj.edgePolys.get(e) ?? []) if (adj.polyEdges[p].length === 4) out.add(p);
  }
  return out;
}

/** One step longer at both ends of every selected run of loop edges. */
export function growLoops(adj: Adjacency, sel: Set<CompItem>, aroundCorners: boolean): Set<CompItem> {
  const out = new Set<CompItem>(sel);
  for (const k of sel) for (const v of edgeVerts(k as string)) { const nx = loopNext(adj, k as string, v, { aroundCorners }); if (nx) out.add(nx); }
  return out;
}

/** One step shorter at both ends: an edge stays only when the loop continues into a selected edge at both end points. */
export function shrinkLoops(adj: Adjacency, sel: Set<CompItem>, aroundCorners: boolean): Set<CompItem> {
  const out = new Set<CompItem>();
  for (const k of sel) if (edgeVerts(k as string).every(v => { const nx = loopNext(adj, k as string, v, { aroundCorners }); return !!nx && sel.has(nx); })) out.add(k);
  return out;
}
