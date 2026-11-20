// Ledger row CMD-B15b, user-normal commands of propertytasks.dll (note section 3 "User-normal family" and
// "SetUserNormalValues"; WIRE_CORRECTIONS_B15 item 25):
//   CreateUserNormals RemoveUserNormals SetVertexUserNormals SetPolygonUserNormals SetUserNormalValues
// Original code from the note's prose. Stand-in model: the normals live in a sample cluster `User_Normal_Cluster`
// carrying a `User Normal Property` (type UserNormalProperty, 3 values per element) whose values are kept in
// `values: Map<sampleIndex, [x, y, z]>` (sample = polygon corner, numbered like Cluster 'sample' elements). Values are
// written through the SetClusterPropertyValues command (sub-task). The build's older per-point "User Normals"
// property (model2.ts, drawn by the viewport) is not touched: how the two relate is not in the note.
// Not attested (the note's "Missing" list, logged as "not yet attested"): the gather / bleed expansion rules, the scene
// setting that decides the final FreezeObj (here `app.propertyTasksB15b.freezeAfterUserNormals`, default off), the exact
// vertex / polygon normal formulas of the geometry object (here: area-weighted vertex normal, Newell polygon normal).
import { App } from '../core/commands';
import { Node, X3DObject, Property, Cluster } from '../core/scene';
import { sampleOffsets } from '../core/texturing';
import type { MeshData } from '../core/geometry';
import { itemsArg, type EdgeSub } from './unfoldB13bShared';
import {
  S_OK, S_FALSE, E_INVALIDARG, stateOf, fail, setStatus, logNya, logMsgId, trace, unset, listOf, nodeArg, toNumber, sortedElements,
} from './propertyTasksB15bShared';

export const CLUSTER_NAME = 'User_Normal_Cluster';
export const PROPERTY_NAME = 'User Normal Property';
type V3 = [number, number, number];

interface Sample { index: number; vertex: number; polygon: number; acc: V3 | null; count: number }
const meshOf = (o: X3DObject): MeshData | null => o.primitive?.mesh() ?? null;
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const pt = (m: MeshData, i: number): V3 => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
/** Newell polygon normal (unit) and its un-normalised area weight. */
function polygonNormalRaw(m: MeshData, poly: number[]): V3 {
  const n: V3 = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) { const a = pt(m, poly[i]), b = pt(m, poly[(i + 1) % poly.length]); n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
const polygonNormal = (m: MeshData, p: number): V3 => norm(polygonNormalRaw(m, m.polygons[p]));
function vertexNormals(m: MeshData): V3[] {
  const acc: V3[] = Array.from({ length: m.positions.length / 3 }, () => [0, 0, 0] as V3);
  for (const f of m.polygons) { const r = polygonNormalRaw(m, f); for (const v of f) { acc[v][0] += r[0]; acc[v][1] += r[1]; acc[v][2] += r[2]; } }
  return acc.map(norm);
}

// ------------------------------------------------------------------ gather (0x180018210)
interface Gathered { obj: X3DObject; samples: Map<number, Sample> }
function samplesOfPolygons(m: MeshData, polys: Iterable<number>): Sample[] {
  const { start } = sampleOffsets(m); const out: Sample[] = [];
  for (const p of polys) if (p >= 0 && p < m.polygons.length) m.polygons[p].forEach((v, k) => out.push({ index: start[p] + k, vertex: v, polygon: p, acc: null, count: 0 }));
  return out;
}
function allSamples(m: MeshData): Sample[] { return samplesOfPolygons(m, m.polygons.keys()); }
function gather(app: App, C: string, v: any, bleed: boolean): Gathered[] {
  const by = new Map<X3DObject, Map<number, Sample>>();
  const add = (o: X3DObject, ss: Sample[], accumulate: boolean) => {
    const m = meshOf(o); if (!m) return;
    const map = by.get(o) ?? new Map<number, Sample>(); by.set(o, map);
    for (const s of ss) {
      const cur = map.get(s.index) ?? s; map.set(s.index, cur);
      if (accumulate) { const n = polygonNormal(m, s.polygon); cur.acc = cur.acc ? [cur.acc[0] + n[0], cur.acc[1] + n[1], cur.acc[2] + n[2]] : n; cur.count++; }
    }
  };
  const items = itemsArg(app, v);
  for (const it of items as (Node | EdgeSub)[]) {
    if (it instanceof X3DObject) { const m = meshOf(it); if (m) add(it, allSamples(m), false); continue; }
    if (it instanceof Node) continue;
    const m = meshOf(it.obj); if (!m) continue;
    const { start } = sampleOffsets(m);
    if (it.kind === 'poly') add(it.obj, samplesOfPolygons(m, it.items.map(Number)), true);
    else if (it.kind === 'pnt') { const set = new Set(it.items.map(Number)); add(it.obj, allSamples(m).filter(s => set.has(s.vertex)), false); }
    else if (it.kind === 'sample') {
      const set = new Set(it.items.map(Number)); const out: Sample[] = [];
      m.polygons.forEach((f, p) => f.forEach((vv, k) => { if (set.has(start[p] + k)) out.push({ index: start[p] + k, vertex: vv, polygon: p, acc: null, count: 0 }); }));
      add(it.obj, out, false);
    } else if (it.kind === 'edge') {
      const verts = new Set<number>(); for (const e of it.items) for (const x of String(e).split('-')) verts.add(Number(x));
      add(it.obj, allSamples(m).filter(s => verts.has(s.vertex)), false);   // inferred: an edge selects the samples of both end vertices
    }
  }
  if (bleed) logNya(app, C, 'BleedSelection=True: the tweak-component bleed expansion rule is not in the note (selection used as given)');
  return [...by].map(([obj, samples]) => ({ obj, samples }));
}

// ------------------------------------------------------------------ storage (0x180016780 + 0x180016470)
const unCluster = (o: X3DObject): Cluster | null => o.clusters.find(c => c.name === CLUSTER_NAME || c.name.startsWith(CLUSTER_NAME)) ?? null;
const unProperty = (c: Cluster): Property | null => c.properties.find(p => p.type === 'UserNormalProperty') ?? null;
function ensureStorage(app: App, o: X3DObject): { cluster: Cluster; prop: Property } {
  let cluster = unCluster(o);
  if (!cluster) {
    trace(app, 'SICreateCluster');
    let name = CLUSTER_NAME, i = 1; while (o.clusters.some(c => c.name === name)) name = `${CLUSTER_NAME}${i++}`;
    const c = new Cluster(name, 'sample', new Set());
    app.record('SICreateCluster', () => { o.addCluster(c); }, () => { o.removeCluster(c); });
    cluster = c;
  }
  let prop = unProperty(cluster);
  if (!prop) {
    trace(app, 'SIAddProp');
    const p = new Property(PROPERTY_NAME, 'UserNormalProperty', []);
    (p as any).dimension = 3; (p as any).values = new Map<number, V3>(); (p as any).preset = 'User Normal Property';
    const c = cluster; app.record('SIAddProp', () => { c.addProperty(p); }, () => { c.removeProperty(p); });
    prop = p;
  }
  return { cluster, prop };
}
function addToCluster(app: App, cluster: Cluster, idx: number[]) {
  const fresh = idx.filter(i => !cluster.elements.has(i)); if (!fresh.length) return;
  trace(app, 'SIAddToCluster');
  app.record('SIAddToCluster', () => { for (const i of fresh) cluster.elements.add(i); }, () => { for (const i of fresh) cluster.elements.delete(i); });
}
/** Values through a SetClusterPropertyValues sub-task: Offsets = positions in the cluster, Values = n x 3 doubles, mode 0, clamp off. */
function writeValues(app: App, cluster: Cluster, prop: Property, writes: Map<number, V3>) {
  if (!writes.size) return;
  const el = sortedElements(cluster); const pos = new Map(el.map((e, i) => [e, i]));
  const offsets: number[] = [], values: number[] = [];
  for (const [s, n] of writes) { const o = pos.get(s); if (o === undefined) continue; offsets.push(o); values.push(n[0], n[1], n[2]); }
  if (offsets.length) app.run('SetClusterPropertyValues', { ClusterProp: prop, Offsets: offsets, Values: values, Mode: 0, ClampValues: false });
}
/** End of command (0x180018fe0): FreezeObj on the queued objects when the scene setting is on. */
function finish(app: App, C: string, objs: X3DObject[]) {
  if (!stateOf(app).freezeAfterUserNormals || !objs.length) return;
  if (app.commands.has('FreezeObj')) app.run('FreezeObj', { InputObjs: objs });
  else logNya(app, C, 'FreezeObj is not on the bus');
}

// ------------------------------------------------------------------ the commands
type Compute = (m: MeshData, s: Sample, vn: V3[]) => V3 | null;
function writeFamily(app: App, C: string, a: Record<string, any>, compute: Compute, onlyNew: boolean) {
  const bleed = unset(a.BleedSelection) ? false : !!toNumber(a.BleedSelection, 0);
  const gathered = gather(app, C, a.InputObjs, bleed);
  if (!gathered.length || gathered.every(g => !g.samples.size)) { logMsgId(app, C, 8); setStatus(app, C, S_FALSE); return; }
  const frozen: X3DObject[] = [];
  for (const g of gathered) {
    const m = meshOf(g.obj)!; const vn = vertexNormals(m);
    const { cluster, prop } = ensureStorage(app, g.obj);
    const writes = new Map<number, V3>();
    for (const s of g.samples.values()) {
      const n = compute(m, s, vn); if (!n) continue;
      if (onlyNew && cluster.elements.has(s.index)) continue;   // CreateUserNormals keeps the samples already in the cluster
      writes.set(s.index, n);
    }
    addToCluster(app, cluster, [...writes.keys()]);
    writeValues(app, cluster, prop, writes);
    frozen.push(g.obj);
  }
  finish(app, C, frozen);
  app.events.emit('scene'); setStatus(app, C, S_OK);
}
function removeUserNormals(app: App, C: string, a: Record<string, any>) {
  const bleed = unset(a.BleedSelection) ? false : !!toNumber(a.BleedSelection, 0);
  const gathered = gather(app, C, a.InputObjs, bleed);
  if (!gathered.length || gathered.every(g => !g.samples.size)) { logMsgId(app, C, 8); setStatus(app, C, S_FALSE); return; }
  const frozen: X3DObject[] = [];
  for (const g of gathered) {
    const cluster = unCluster(g.obj); if (!cluster) continue;
    const gone = [...g.samples.keys()].filter(i => cluster.elements.has(i)); if (!gone.length) continue;
    const prop = unProperty(cluster); const store: Map<number, V3> | undefined = (prop as any)?.values;
    const saved = new Map<number, V3 | undefined>(gone.map(i => [i, store?.get(i)]));
    trace(app, 'SIRemoveFromCluster');
    app.record('SIRemoveFromCluster', () => { for (const i of gone) { cluster.elements.delete(i); store?.delete(i); } }, () => { for (const i of gone) { cluster.elements.add(i); const v = saved.get(i); if (v && store) store.set(i, v); } });
    if (cluster.elements.size === 0) {
      trace(app, 'DeleteObj');
      app.record('DeleteObj', () => g.obj.removeCluster(cluster), () => { g.obj.clusters.push(cluster); });
    }
    frozen.push(g.obj);
  }
  finish(app, C, frozen);
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

function setUserNormalValues(app: App, C: string, a: Record<string, any>) {
  // UnPackArg
  const o0 = unset(a.InputObj) ? app.selection[0] : nodeArg(app, listOf(a.InputObj)[0]);
  const obj = o0 instanceof X3DObject ? o0 : (o0 as any)?.parent instanceof X3DObject ? (o0 as any).parent : null;
  if (!(obj instanceof X3DObject)) throw fail(E_INVALIDARG, `${C}: InputObj must resolve to a 3D object`);
  if (unset(a.Indices) && a.Indices !== 0) throw fail(E_INVALIDARG, `${C}: Indices is required`);
  const indices = listOf(Array.isArray(a.Indices) ? a.Indices : [a.Indices]).map(x => Math.trunc(Number(x)));
  if (!Array.isArray(a.Values)) throw fail(E_INVALIDARG, `${C}: Values must be an array of doubles`);
  const vals = a.Values.map((x: any) => Number(x));
  if (!(vals.length === 3 || vals.length === 3 * indices.length)) throw fail(E_INVALIDARG, `${C}: Values must hold 3 numbers or 3 x the number of Indices (${vals.length} given for ${indices.length} indices)`);
  // Do: the sample map from the given indices and values
  const m = meshOf(obj);
  if (!m || !indices.length) { logMsgId(app, C, 8); setStatus(app, C, S_FALSE); return; }
  const total = sampleOffsets(m).total;
  const writes = new Map<number, V3>();
  indices.forEach((ix, k) => { if (ix >= 0 && ix < total) { const o = vals.length === 3 ? 0 : k * 3; writes.set(ix, [vals[o], vals[o + 1], vals[o + 2]]); } });
  if (!writes.size) { logMsgId(app, C, 8); setStatus(app, C, S_FALSE); return; }
  const { cluster, prop } = ensureStorage(app, obj);
  addToCluster(app, cluster, [...writes.keys()]);
  writeValues(app, cluster, prop, writes);
  finish(app, C, [obj]);
  app.events.emit('scene'); setStatus(app, C, S_OK);
}

export function registerPropertyTasksB15bNormals(app: App) {
  const args = () => [{ name: 'InputObjs', default: null }, { name: 'BleedSelection', default: null }];
  app.register({
    name: 'CreateUserNormals', label: 'Create User Normals', category: 'Property', description: 'Create User Normals',
    args: args(),
    // samples not yet in the cluster are added; their current geometric normals are written (existing user normals stay)
    execute: (app, a) => writeFamily(app, 'CreateUserNormals', a, (m, s, vn) => vn[s.vertex], true),
  });
  app.register({
    name: 'RemoveUserNormals', label: 'Remove User Normals', category: 'Property', description: 'Remove User Normals',
    args: args(), execute: (app, a) => removeUserNormals(app, 'RemoveUserNormals', a),
  });
  app.register({
    name: 'SetVertexUserNormals', label: 'Set Vertex User Normals', category: 'Property', description: 'Set Vertex User Normals',
    args: args(),
    execute: (app, a) => writeFamily(app, 'SetVertexUserNormals', a, (m, s, vn) => vn[s.vertex], false),
  });
  app.register({
    name: 'SetPolygonUserNormals', label: 'Set Polygon User Normals', category: 'Property', description: 'Set Polygon User Normals',
    args: args(),
    execute: (app, a) => writeFamily(app, 'SetPolygonUserNormals', a, (m, s) => {
      if (s.acc && s.count > 0) {
        const avg: V3 = s.count > 1 ? [s.acc[0] / s.count, s.acc[1] / s.count, s.acc[2] / s.count] : s.acc;
        if (len(avg) > 1e-12) return norm(avg);   // a zero-length result counts as no data
      }
      return polygonNormal(m, s.polygon);
    }, false),
  });
  app.register({
    name: 'SetUserNormalValues', label: 'Set User Normal Values', category: 'Property', description: 'Set User Normal Values',
    args: [{ name: 'InputObj', default: null }, { name: 'Indices', default: null }, { name: 'Values', default: null }],
    execute: (app, a) => setUserNormalValues(app, 'SetUserNormalValues', a),
  });
}
