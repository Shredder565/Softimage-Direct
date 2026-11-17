// Ledger row CMD-B6d support (docs/ghidra/cmd-b6d-operators-scripts.md): connection-set reading and the operators the
// script commands apply. Original code.
//
// The script commands of this row hand their work to C++ commands that are not on the bus (GetConnectionSet,
// ApplyOperator, ApplyOp for presets this build has no operator for). This file holds the stand-ins:
//   * connection-set text -> items (objects, clusters, operators, properties, tagged components);
//   * operators whose parameter lists come from data/spdl/spdl.json (C3DAddEdgeOp, C3DSplitPolygonOp,
//     insertnurbscrvknotsop, C3DMeshSubdivideWithCenterOp, C3DVertexColorChangeDatatypeOp) and whose geometry is
//     inferred from the SPDL descriptions. The contract gives the parameters the scripts write, not the evaluation.
import * as THREE from 'three';
import type { App } from '../core/commands';
import { X3DObject, Node, Operator, Cluster, Property } from '../core/scene';
import { num, int, bool, enumP } from '../core/params';
import type { MeshData } from '../core/geometry';
import { toPolys, fromPolys, meshEdges, edgeKey, faceNormal, faceCenter, type CompSel, type CompKind } from '../core/topology';
import { catmullClark, dooSabin } from '../core/topology2';
import { insertKnot, curveDomain, type CurveData } from '../core/curves';
import { findNode, findObject, unset } from './viewEditPropertyHelpers';

type V3 = [number, number, number];
export type SubKind = 'pnt' | 'edge' | 'poly';
const COMP: Record<SubKind, CompKind> = { pnt: 'point', edge: 'edge', poly: 'polygon' };
const SUB: Record<CompKind, SubKind> = { point: 'pnt', edge: 'edge', polygon: 'poly' };

/** One item of a collection / connection set: a scene node, or tagged components of an object. */
export interface CsItem {
  raw: any; text: string; node: Node | null; obj: X3DObject | null;
  /** Tagged components: point / polygon indices, or edges as vertex pairs. */
  sub: { kind: SubKind; indices: number[]; edges: [number, number][] } | null;
}

export const ownerObject = (n: any): X3DObject | null => {
  if (n instanceof Cluster) return n.obj;
  let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null;
};
export const meshOf = (o: X3DObject | null | undefined): MeshData | null => o?.primitive?.mesh() ?? null;

function parseIndices(text: string, count: number): number[] {
  const out: number[] = [];
  for (const part of text.split(',').map(s => s.trim()).filter(Boolean)) {
    const rg = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (part === '*') for (let i = 0; i < count; i++) out.push(i);
    else if (rg) for (let i = Number(rg[1]); i <= Number(rg[2]); i++) out.push(i);
    else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return [...new Set(out)];
}
/** Text of tagged components. inferred: an edge index is the edge's position in this build's edge enumeration. */
export function subText(obj: X3DObject, kind: SubKind, indices: number[], edges: [number, number][]): string {
  let idx = indices;
  if (kind === 'edge') { const all = meshEdges(meshOf(obj) ?? ({ polygons: [] } as any)).map(e => edgeKey(e[0], e[1])); idx = edges.map(e => all.indexOf(edgeKey(e[0], e[1]))).filter(i => i >= 0); }
  return `${obj.name}.${kind}[${idx.join(',')}]`;
}
function subItem(obj: X3DObject, kind: SubKind, indices: number[], edges: [number, number][], raw: any): CsItem {
  return { raw, text: subText(obj, kind, indices, edges), node: null, obj, sub: { kind, indices, edges } };
}
function nodeItem(node: Node, raw: any): CsItem { return { raw, text: node.fullName, node, obj: ownerObject(node), sub: null }; }

function itemOf(app: App, raw: any): CsItem | null {
  if (raw instanceof Node) return nodeItem(raw, raw);
  if (raw && typeof raw === 'object' && raw.sub && raw.obj) return raw as CsItem;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim(); const m = /^(.+?)\.(pnt|edge|poly)\[(.*)\]$/.exec(s);
  if (m) {
    const obj = findObject(app, m[1].replace(/\.(polymsh|crvlist|surfmsh)$/, '')); const mesh = meshOf(obj); if (!obj) return null;
    const kind = m[2] as SubKind;
    if (kind === 'edge') { const all = mesh ? meshEdges(mesh) : []; const idx = parseIndices(m[3], all.length).filter(i => i < all.length); return subItem(obj, kind, idx, idx.map(i => all[i]), s); }
    const count = kind === 'pnt' ? (mesh ? mesh.positions.length / 3 : obj.primitive?.curve()?.cvs.length ?? 0) : mesh?.polygons.length ?? 0;
    return subItem(obj, kind, parseIndices(m[3], count), [], s);
  }
  // "obj.cls.Name" / "obj.polymsh.cls.Name" / "obj.Name"
  const cm = /^(.+?)(?:\.(?:polymsh|crvlist|surfmsh))?(?:\.cls)?\.([^.]+)$/.exec(s);
  if (cm) { const o = findObject(app, cm[1]); const c = o?.cluster(cm[2]); if (c) return nodeItem(c, s); }
  const n = findNode(app, s);
  return n ? nodeItem(n, s) : null;
}
function splitTop(text: string, sep: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of text) { if (ch === '[' || ch === '(') depth++; else if (ch === ']' || ch === ')') depth--; if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(s => s.trim()).filter(Boolean);
}
/** The selection as collection items: the tagged components when there are any, the selected nodes otherwise. */
export function selectionItems(app: App): CsItem[] {
  const c = app.compSel;
  if (c) {
    const kind = SUB[c.kind];
    if (c.kind === 'edge' && c.edges.size) return [subItem(c.obj, kind, [], [...c.edges].map(k => k.split('-').map(Number) as [number, number]), null)];
    if (c.kind === 'point' && c.points.size) return [subItem(c.obj, kind, [...c.points], [], null)];
    if (c.kind === 'polygon' && c.polygons.size) return [subItem(c.obj, kind, [...c.polygons], [], null)];
  }
  return app.selection.map(n => nodeItem(n, n));
}
/** A Collection argument as items; unset = the selection when `selectionWhenEmpty`. */
export function collectionItems(app: App, arg: any, selectionWhenEmpty = true): CsItem[] {
  if (unset(arg) || (Array.isArray(arg) && !arg.length)) return selectionWhenEmpty ? selectionItems(app) : [];
  const raws: any[] = Array.isArray(arg) ? arg : typeof arg === 'string' ? splitTop(arg, ';').flatMap(g => splitTop(g, ',')) : [arg];
  return raws.map(r => itemOf(app, r)).filter((x): x is CsItem => !!x);
}
/** A ConnectionSet argument as groups (";" separates groups, "," items). */
export function connectionGroups(app: App, arg: any, selectionWhenEmpty = true): CsItem[][] {
  if (unset(arg) || (Array.isArray(arg) && !arg.length)) { const s = selectionWhenEmpty ? selectionItems(app) : []; return s.length ? [s] : []; }
  if (typeof arg === 'string') return splitTop(arg, ';').map(g => splitTop(g, ',').map(r => itemOf(app, r)).filter((x): x is CsItem => !!x)).filter(g => g.length);
  const items = collectionItems(app, arg, false); return items.length ? [items] : [];
}
export const groupsText = (groups: CsItem[][]) => groups.map(g => g.map(i => i.text).join(',')).join(';');
export function compSelOf(sub: NonNullable<CsItem['sub']>): CompSel {
  if (sub.kind === 'edge') return { kind: 'edge', indices: sub.edges.map(e => e[0]), edges: sub.edges };
  return { kind: COMP[sub.kind], indices: sub.indices };
}
/** Point indices a cluster / tagged-component item covers. */
export function pointsOf(obj: X3DObject, kind: string, elements: Iterable<number | string>): number[] {
  const mesh = meshOf(obj); const out = new Set<number>(); const all = mesh ? meshEdges(mesh) : [];
  for (const e of elements) {
    if (kind === 'pnt') out.add(Number(e));
    else if (kind === 'poly') for (const v of mesh?.polygons[Number(e)] ?? []) out.add(v);
    else if (kind === 'edge') { const pair = typeof e === 'string' && e.includes('-') ? e.split('-').map(Number) : all[Number(e)]; for (const v of pair ?? []) out.add(v); }
  }
  return [...out];
}
/** Component positions of a cluster in object space: one entry per component (a polygon / edge gives its mean point). */
export function componentCentres(c: Cluster): V3[] {
  const o = c.obj; const mesh = meshOf(o); if (!o) return [];
  const P = (i: number): V3 | null => {
    if (mesh) return i * 3 + 2 < mesh.positions.length ? [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]] : null;
    const cv = o.primitive?.curve()?.cvs[i]; return cv ? [cv[0], cv[1], cv[2]] : null;
  };
  const mean = (idx: number[]): V3 | null => { const ps = idx.map(P).filter((p): p is V3 => !!p); if (!ps.length) return null; return [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length) as V3; };
  const out: V3[] = [];
  for (const e of c.elements) {
    const p = c.compKind === 'pnt' ? P(Number(e)) : c.compKind === 'poly' || c.compKind === 'edge' ? mean(pointsOf(o, c.compKind, [e])) : null;
    if (p) out.push(p);
  }
  return out;
}
export const toWorld = (o: X3DObject, p: V3): V3 => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(o.globalMatrix()); return [v.x, v.y, v.z]; };

/** Operators that hang on something that is not a geometry stack in this build (a null, a property, a kinematic state):
 *  the stand-in for the "outgoing connections" the script reads from the connection stack description.   // inferred */
const OUT = new WeakMap<object, Operator[]>();
export const outConnections = (target: object): Operator[] => { let l = OUT.get(target); if (!l) OUT.set(target, l = []); return l; };

const silent = (op: Operator, name: string, v: number) => { const p: any = op.get(name); if (p) p._value = v; };   // result parameters: written during evaluation, no notification
const pos = (verts: V3[], i: number) => verts[i];

/** C3DAddEdgeOp.spdl: "Add an edge between an existing point and an existing edge"; ratioedge 0..100 is where the edge
 *  is split. inferred geometry: an edge alone gets a vertex at the ratio; a point and an edge are connected through
 *  that vertex; two points of one polygon are connected. */
export class AddEdgeOp extends Operator {
  readonly siType = 'addedgeop';
  constructor(readonly points: number[], readonly edges: [number, number][]) {
    super('AddEdge Op', 'addedgeop', [
      num('ratioedge', 0, 'Ratio Edge', { min: 0, max: 100, desc: 'Ratio on edge where to split to end the new edge' }),
      int('newedgeid', -1, 'New Edge ID', { readOnly: true, inspectable: false }), int('newptid', -1, 'New Point ID', { readOnly: true, inspectable: false }),
      bool('mute', false, 'Mute'),
    ]);
  }
  apply(m: MeshData | null): MeshData | null {
    silent(this, 'newedgeid', -1); silent(this, 'newptid', -1);
    if (!m || !m.positions || this.val('mute')) return m;
    const { verts, faces } = toPolys(m); let a = this.points[0], b = this.points[1]; let newEdge: [number, number] | null = null;
    const e = this.edges[0];
    if (e && e[0] < verts.length && e[1] < verts.length) {
      const t = Math.max(0, Math.min(1, Number(this.val('ratioedge')) / 100)); const pa = pos(verts, e[0]), pb = pos(verts, e[1]);
      const n = verts.length; verts.push([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t] as any);
      let hit = false;
      for (const f of faces) for (let i = 0; i < f.length; i++) { const x = f[i], y = f[(i + 1) % f.length]; if ((x === e[0] && y === e[1]) || (x === e[1] && y === e[0])) { f.splice(i + 1, 0, n); hit = true; break; } }
      if (!hit) return m;
      silent(this, 'newptid', n); newEdge = [n, e[1]];
      if (a !== undefined) b = n; else { a = -1; }
    }
    if (a !== undefined && a >= 0 && b !== undefined) {
      const fi = faces.findIndex(f => { const ia = f.indexOf(a), ib = f.indexOf(b); if (ia < 0 || ib < 0) return false; const d = Math.abs(ia - ib); return d > 1 && d !== f.length - 1; });
      if (fi >= 0) {
        const f = faces[fi]; const ia = f.indexOf(a), ib = f.indexOf(b); const one: number[] = [], two: number[] = [];
        for (let i = ia; ; i = (i + 1) % f.length) { one.push(f[i]); if (i === ib) break; }
        for (let i = ib; ; i = (i + 1) % f.length) { two.push(f[i]); if (i === ia) break; }
        faces[fi] = one; faces.push(two); newEdge = [a, b];
      }
    }
    const out = fromPolys(verts, faces);
    if (newEdge) { const k = edgeKey(newEdge[0], newEdge[1]); silent(this, 'newedgeid', meshEdges(out).findIndex(x => edgeKey(x[0], x[1]) === k)); }
    return out;
  }
}

/** C3DSplitPolygonOp.spdl: tanx / tany / tanz place the split point "w/r to the local frame of the polygon";
 *  splittype 0 By The Vertices, 1 By The Edges MidPoints, 2 Cross. inferred geometry: the point starts at the polygon
 *  centre; 0 joins it to every vertex, 1 and 2 join it to every edge midpoint. */
export class SplitPolygonOp extends Operator {
  readonly siType = 'splitpolygonop';
  constructor(readonly polygons: number[]) {
    super('SplitPolygon Op', 'splitpolygonop', [
      num('tanx', 0, 'X Tangent', { uimin: -5, uimax: 5 }), num('tany', 0, 'Y Tangent', { uimin: -5, uimax: 5 }), num('tanz', 0, 'Z Tangent', { uimin: -5, uimax: 5 }),
      enumP('splittype', 0, [{ label: 'By The Vertices', value: 0 }, { label: 'By The Edges MidPoints', value: 1 }, { label: 'Cross', value: 2 }], 'Type'),
      int('newptid', -1, 'New Point ID', { readOnly: true, inspectable: false }), bool('mute', false, 'Mute'),
    ]);
  }
  apply(m: MeshData | null): MeshData | null {
    silent(this, 'newptid', -1);
    if (!m || !m.positions || this.val('mute')) return m;
    const { verts, faces } = toPolys(m); const todo = this.polygons.filter(i => i >= 0 && i < faces.length); if (!todo.length) return m;
    const byMid = Number(this.val('splittype')) !== 0; const t = [Number(this.val('tanx')), Number(this.val('tany')), Number(this.val('tanz'))];
    const mids = new Map<string, number>(); const extra: number[][] = []; const done = new Set<number>(); let first = -1;
    for (const fi of todo) {
      if (done.has(fi)) continue; done.add(fi);
      const f = faces[fi]; const c = faceCenter(verts as any, f) as V3; const n = faceNormal(verts as any, f) as V3;
      const p0 = pos(verts, f[0]), p1 = pos(verts, f[1]); let x: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const xl = Math.hypot(...x) || 1; x = [x[0] / xl, x[1] / xl, x[2] / xl];
      const y: V3 = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
      const ci = verts.length; verts.push([0, 1, 2].map(k => c[k] + t[0] * x[k] + t[1] * y[k] + t[2] * n[k]) as any); if (first < 0) first = ci;
      const parts: number[][] = [];
      if (!byMid) for (let i = 0; i < f.length; i++) parts.push([f[i], f[(i + 1) % f.length], ci]);
      else {
        const mid = (a: number, b: number) => { const k = edgeKey(a, b); let i = mids.get(k); if (i === undefined) { const pa = pos(verts, a), pb = pos(verts, b); i = verts.length; verts.push([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2] as any); mids.set(k, i); } return i; };
        for (let i = 0; i < f.length; i++) { const prev = f[(i + f.length - 1) % f.length], cur = f[i], next = f[(i + 1) % f.length]; parts.push([mid(prev, cur), cur, mid(cur, next), ci]); }
      }
      faces[fi] = parts[0]; extra.push(...parts.slice(1));
    }
    if (mids.size) faces.forEach((f, fi) => {   // neighbours take the new edge midpoints too
      if (done.has(fi)) return; const nf: number[] = [];
      for (let i = 0; i < f.length; i++) { nf.push(f[i]); const k = mids.get(edgeKey(f[i], f[(i + 1) % f.length])); if (k !== undefined) nf.push(k); }
      faces[fi] = nf;
    });
    silent(this, 'newptid', first);
    return fromPolys(verts, [...faces, ...extra]);
  }
}

/** insertnurbscrvknotsop.spdl: Multiplicity 1..3. inferred: the knot goes at `position` (0..1 of the curve domain),
 *  the connection set's knot value is not read. */
export class InsertCrvKnotOp extends Operator {
  readonly siType = 'InsertCrvKnot';
  constructor() { super('Insert crv knot op', 'InsertCrvKnot', [int('Multiplicity', 1, 'Multiplicity', { min: 1, max: 3 }), num('position', 0.5, 'Position', { min: 0, max: 1 }), bool('mute', false, 'Mute')]); }
  apply(c: CurveData | null): CurveData | null {
    if (!c || !(c as any).cvs || this.val('mute')) return c;
    const [u0, u1] = curveDomain(c); const u = u0 + (u1 - u0) * Number(this.val('position')); let cur = c;
    for (let i = 0; i < Math.min(Number(this.val('Multiplicity')) || 1, c.degree); i++) cur = insertKnot(cur, u);
    return cur;
  }
}

/** C3DMeshSubdivideWithCenterOp.spdl (generator): SubdivisionDepth 1..10, SubdivisionRule, useloop. inferred geometry:
 *  the input mesh subdivided with this build's subdivision rules (useloop is stored, triangles follow the rule). */
export class MeshSubdivideWithCenterOp extends Operator {
  readonly siType = 'MeshSubdivideWithCenter';
  constructor(readonly input: X3DObject) {
    super('Mesh Subdivide With Center', 'MeshSubdivideWithCenter', [
      int('SubdivisionDepth', 1, 'Level', { min: 1, max: 10, uimin: 1, uimax: 4 }),
      enumP('SubdivisionRule', 0, [{ label: 'Catmull-Clark', value: 0 }, { label: 'XSI-Doo-Sabin', value: 2 }, { label: 'Linear', value: 3 }, { label: 'Doo-Sabin (obsolete)', value: 1 }], 'Rule'),
      bool('useloop', true, 'Use Loop Subdivision for Triangles'),
    ]);
    this.region = 'modeling';
  }
  depStamp() { const p = this.input.primitive; if (!p) return ''; p.geom(); return String(p.version); }
  apply(): MeshData | null {
    const m = meshOf(this.input); if (!m) return null;
    const depth = Math.max(1, Number(this.val('SubdivisionDepth')) || 1); const rule = Number(this.val('SubdivisionRule'));
    return rule === 1 || rule === 2 ? dooSabin(m, depth) : catmullClark(m, depth, new Map(), rule === 3);
  }
}

export const VERTEX_COLOR_DATATYPES = [{ label: 'Short (2 bytes)', value: 0 }, { label: 'Float (4 bytes)', value: 1 }];
/** C3DVertexColorChangeDatatypeOp.spdl: desireddatatype 0 / 1. The operator sits in the owner's construction history
 *  and writes the property's datatype when it evaluates.   // inferred */
export class VertexColorChangeDatatypeOp extends Operator {
  readonly siType = 'vertexcolorchangedatatype';
  constructor(readonly property: Property) { super('Vertex Color Change Datatype', 'vertexcolorchangedatatype', [enumP('desireddatatype', 0, VERTEX_COLOR_DATATYPES, 'DesiredDatatype')]); }
  depStamp() { return String(this.val('desireddatatype')); }
  apply(g: any): any { const p: any = this.property.get('datatype'); if (p) p._value = Number(this.val('desireddatatype')); return g; }
}

/** A pass-through operator of a given Softimage type (simulation region markers, evolve). */
export function markerOperator(name: string, type: string, defs: any[] = []): Operator { return new Operator(name, type, defs); }

/** The spring operator's parameters as the script writes them (C3DSpringOp.spdl lists them in its layout only). */
export function makeSpringOperator(): Operator {
  const op = new Operator('SpringOp', 'SpringOp', [
    num('Mass', 1, 'Mass'), num('LinearStiffness', 0, 'Linear Stiffness'), num('LinearDamping', 0, 'Linear Damping'),
    num('AngularStiffness', 0, 'Angular Stiffness'), num('AngularDamping', 0, 'Angular Damping'),
    num('RestPosX', 0, 'Rest Position X'), num('RestPosY', 0, 'Rest Position Y'), num('RestPosZ', 0, 'Rest Position Z'),
    num('InitialStatePosX', 0, 'Initial Position X'), num('InitialStatePosY', 0, 'Initial Position Y'), num('InitialStatePosZ', 0, 'Initial Position Z'),
    num('InitialStateVelX', 0, 'Initial Velocity X'), num('InitialStateVelY', 0, 'Initial Velocity Y'), num('InitialStateVelZ', 0, 'Initial Velocity Z'),
  ]);
  const tc = new Property('simtimectrl', 'simtimectrl', [int('playmode', 0, 'Play Mode'), bool('SynchWithSceneStart', false, 'Synch With Scene Start'), bool('SynchWithSceneEnd', false, 'Synch With Scene End')]);
  tc.parent = op; (op as any).simtimectrl = tc;
  return op;
}
