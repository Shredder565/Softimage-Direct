// Ledger row CMD-B15b (`propertytasks.dll`), cluster-property half: SetClusterPropertyValues and the user-normal
// commands CreateUserNormals, RemoveUserNormals, SetVertexUserNormals, SetPolygonUserNormals, SetUserNormalValues.
// Brief: docs/ghidra/cmd-b15b-propertytasks.md (§3 "SetClusterPropertyValues", "User-normal family",
// "SetUserNormalValues") and docs/re/WIRE_CORRECTIONS_B15.md items 22 and 25. Original code.
//
// Mapping onto this build:
//  * A cluster property keeps its data in `values`, a Map from the cluster element (component index) to a number
//    (dimension 1) or a tuple, as the weight maps and vertex colours of this build already do. An element's *offset* is
//    its position in the cluster's ascending element order.
//  * The "set cluster property values" operator (class eb201e32-…) is kept as a record on the property
//    (`setValuesOp`: merged offsets and tuples); ApplyOperator / SetValue are undo steps of the command.
//  * User normals: a sample cluster `User_Normal_Cluster` carrying the `User Normal Property` (type `normal`, the
//    public SDK value of siClusterPropertyUserNormalType), 3 doubles per sample. Sample i is the i-th polygon node
//    (polygons in order, corners in order). The point-based "User Normals" property of model2.ts is a different
//    (earlier, inferred) model and is left alone.
//  * Lock levels are not modelled in this build (no lock error can occur).
import { App } from '../core/commands';
import type { MeshData } from '../core/geometry';
import {
  b15b, setStatus, fail, warn, logNya, unset, listOf, boolArg, enumArg, collectionArg, singleObjArg, resolveItem, ownerObject,
  X3DObject, Property, Cluster, S_OK, S_FALSE, E_INVALIDARG, E_POINTER,
} from './propertyTasksB15bShared';

type V3 = [number, number, number];
export const DBL_MAX = Number.MAX_VALUE;
export const USER_NORMAL_CLUSTER = 'User_Normal_Cluster';
export const USER_NORMAL_PROPERTY = 'User Normal Property';
export const USER_NORMAL_TYPE = 'normal';

// ------------------------------------------------------------------ cluster property data
const KNOWN_DIM: Record<string, number> = { weightmap: 1, wtmap: 1, normal: 3, vertexcolor: 4, uvspace: 3 };
/** Value dimension of a cluster property (slot 18 of the cluster-property interface). */
export function clusterPropDim(p: Property): number {
  const d = (p as any).valueDim; if (typeof d === 'number' && d > 0) return d;
  if (KNOWN_DIM[p.type] !== undefined) return KNOWN_DIM[p.type];
  const first = ((p as any).values as Map<any, any> | undefined)?.values().next().value;
  return Array.isArray(first) ? first.length : 1;
}
export const valuesOf = (p: Property): Map<number | string, number | number[]> => ((p as any).values ??= new Map());
/** The cluster elements in offset order. */
export function elementOrder(c: Cluster): (number | string)[] {
  return [...c.elements].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
}
const tupleOf = (v: number | number[] | undefined, dim: number): number[] =>
  v === undefined ? new Array(dim).fill(0) : Array.isArray(v) ? [...v] : [v];

interface Packed { offsets: number[]; dim: number; tuples: number[][] }
/** UnPackArg of SetClusterPropertyValues: offsets (empty = every element) and the count × dimension value block. */
function packValues(command: string, p: Property, offsetsArg: any, valuesArg: any): Packed {
  const c = p.parent;
  if (!(c instanceof Cluster)) throw fail(E_INVALIDARG, `${command}: ${p.fullName} is not a cluster property`, 0xf);
  const dim = clusterPropDim(p);
  const offs = listOf(offsetsArg).map(Number);
  const offsets = offs.length ? offs : elementOrder(c).map((_, i) => i);
  const bad = (what: string) => fail(E_INVALIDARG, `${command}: ${p.fullName}: ${what}`, 0xf);
  if (offsets.some(o => !Number.isInteger(o) || o < 0)) throw bad('an offset is not an element index');
  const item = (v: any): number => (v === null || v === undefined || v === '' ? DBL_MAX : Number(v));
  const n = offsets.length; let tuples: number[][];
  if (!Array.isArray(valuesArg)) {
    if (unset(valuesArg)) throw bad('no Values');
    if (dim !== 1) throw bad(`a single value for a property of dimension ${dim}`);
    tuples = offsets.map(() => [item(valuesArg)]);
  } else {
    const flat = (valuesArg as any[]).flat();
    if (flat.length === dim && n !== 1) {
      if (!flat.some(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))))) throw bad('the value tuple holds no number');
      const t = flat.map(item); tuples = offsets.map(() => [...t]);
    } else if (flat.length === n * dim) {
      tuples = offsets.map((_, i) => flat.slice(i * dim, i * dim + dim).map(item));
    } else throw bad(`${flat.length} values for ${n} offset(s) of dimension ${dim}`);
  }
  if (tuples.some(t => t.some(v => Number.isNaN(v)))) throw bad('a value is not a number');
  return { offsets, dim, tuples };
}
/** Worker of SetClusterPropertyValues (also the sub-task of the user-normal commands): merge into the operator record
 *  and write the property data, as undoable steps. */
export function applyClusterValues(app: App, command: string, p: Property, k: Packed, mode: any, clamp: any) {
  const c = p.parent as Cluster;
  const order = elementOrder(c);
  for (const o of k.offsets) if (o >= order.length) throw fail(E_INVALIDARG, `${command}: ${p.fullName}: offset ${o} is past the ${order.length} element(s)`, 0xf);
  const m = enumArg(mode);
  if (m !== null && m !== 'siSetValueModeAbsolute' && m !== 0) logNya(app, command, `Mode ${String(mode)} (only the absolute mode is attested; values written as absolute)`);
  if (boolArg(clamp)) logNya(app, command, 'ClampValues=true (the clamp range of 0x18001c240); values written unclamped');
  // the operator (applied once per property)
  let op = (p as any).setValuesOp as { offsets: number[]; values: number[][] } | undefined;
  if (!op) { const made = { offsets: [] as number[], values: [] as number[][] }; app.record('ApplyOperator', () => { (p as any).setValuesOp = made; }, () => { delete (p as any).setValuesOp; }); op = made; }
  const vals = valuesOf(p);
  const beforeOp = { offsets: [...op.offsets], values: op.values.map(t => [...t]) };
  const beforeVals = new Map(vals);
  const nextOp = { offsets: [...op.offsets], values: op.values.map(t => [...t]) };
  const nextVals = new Map(vals);
  k.offsets.forEach((o, i) => {
    const id = order[o];
    const cur = tupleOf(nextVals.get(id), k.dim);
    const t = k.tuples[i].map((v, j) => (v === DBL_MAX ? cur[j] ?? 0 : v));
    nextVals.set(id, k.dim === 1 ? t[0] : t);
    const at = nextOp.offsets.indexOf(o);
    if (at >= 0) nextOp.values[at] = t; else { nextOp.offsets.push(o); nextOp.values.push(t); }
  });
  const target = op;
  const put = (s: { offsets: number[]; values: number[][] }, v: Map<any, any>) => { target.offsets = s.offsets; target.values = s.values; vals.clear(); for (const [a, b] of v) vals.set(a, b); };
  app.record('SetValue', () => put(nextOp, nextVals), () => put(beforeOp, beforeVals));
}

function setClusterPropertyValues(app: App, a: Record<string, any>) {
  const C = 'SetClusterPropertyValues';
  const p = singleObjArg(app, a.ClusterProp);
  if (!p) throw fail(E_POINTER, `${C}: no ClusterProp`);
  if (!(p instanceof Property)) throw fail(E_INVALIDARG, `${C}: ${p?.fullName ?? String(p)} is not a cluster property`, 0xf);
  applyClusterValues(app, C, p, packValues(C, p, a.Offsets, a.Values), a.Mode, a.ClampValues);
  setStatus(app, C, S_OK);
  app.events.emit('scene');
}

// ------------------------------------------------------------------ samples and normals
interface Samples { poly: number[]; pnt: number[] }
const samplesCache = new WeakMap<MeshData, Samples>();
export function sampleTable(m: MeshData): Samples {
  let s = samplesCache.get(m); if (s) return s;
  s = { poly: [], pnt: [] };
  m.polygons.forEach((f, pi) => f.forEach(v => { s!.poly.push(pi); s!.pnt.push(v); }));
  samplesCache.set(m, s); return s;
}
const P = (m: MeshData, i: number): V3 => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
/** Newell normal of a polygon (length = twice the area). */
function polyNormalRaw(m: MeshData, f: number[]): V3 {
  const n: V3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = P(m, f[i]), b = P(m, f[(i + 1) % f.length]);
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}
const LEN_EPS = 1e-12;
function normalize(v: V3): V3 | null { const l = Math.hypot(v[0], v[1], v[2]); return l <= LEN_EPS ? null : [v[0] / l, v[1] / l, v[2] / l]; }
export function polygonNormal(m: MeshData, pi: number): V3 { return normalize(polyNormalRaw(m, m.polygons[pi])) ?? [0, 1, 0]; }
/** Vertex normal (inferred: the area-weighted sum of the adjacent polygon normals; the geometry's own formula is not
 *  attested). */
export function vertexNormals(m: MeshData): V3[] {
  const acc: V3[] = Array.from({ length: m.positions.length / 3 }, () => [0, 0, 0] as V3);
  for (const f of m.polygons) { const n = polyNormalRaw(m, f); for (const v of f) { acc[v][0] += n[0]; acc[v][1] += n[1]; acc[v][2] += n[2]; } }
  return acc.map(v => normalize(v) ?? [0, 1, 0]);
}

/** The user-normal cluster of an object: a sample cluster that carries the user-normal property. */
export function userNormalCluster(o: X3DObject): Cluster | null {
  return o.clusters.find(c => c.compKind === 'sample' && c.properties.some(p => p.type === USER_NORMAL_TYPE)) ?? null;
}
export const userNormalProperty = (c: Cluster) => c.properties.find(p => p.type === USER_NORMAL_TYPE)!;

/** Gather: the samples of every input item, per object. A whole object stands for all its samples. */
function gather(app: App, command: string, arg: any): Map<X3DObject, Set<number>> {
  const out = new Map<X3DObject, Set<number>>();
  const add = (o: X3DObject | null, list: number[] | 'all') => {
    const m = o?.primitive?.mesh(); if (!o || !m) return;
    const s = out.get(o) ?? new Set<number>(); out.set(o, s);
    const t = sampleTable(m);
    if (list === 'all') { for (let i = 0; i < t.pnt.length; i++) s.add(i); return; }
    for (const i of list) if (i >= 0 && i < t.pnt.length) s.add(i);
  };
  const byKind = (o: X3DObject, kind: string, items: (number | string)[]) => {
    const m = o.primitive?.mesh(); if (!m) return;
    const t = sampleTable(m); const list: number[] = [];
    if (kind === 'sample') for (const i of items) list.push(Number(i));
    else if (kind === 'pnt' || kind === 'point') { const want = new Set(items.map(Number)); t.pnt.forEach((v, i) => { if (want.has(v)) list.push(i); }); }
    else if (kind === 'poly' || kind === 'polygon') { const want = new Set(items.map(Number)); t.poly.forEach((p, i) => { if (want.has(p)) list.push(i); }); }
    else if (kind === 'edge') {
      // inferred: an edge stands for the samples at its two points in the polygons that contain the edge
      for (const e of items) {
        const [a, b] = String(e).split('-').map(Number);
        m.polygons.forEach((f, pi) => {
          for (let k = 0; k < f.length; k++) {
            const x = f[k], y = f[(k + 1) % f.length];
            if ((x === a && y === b) || (x === b && y === a)) t.poly.forEach((pp, si) => { if (pp === pi && (t.pnt[si] === a || t.pnt[si] === b)) list.push(si); });
          }
        });
      }
    }
    add(o, list);
  };
  if (unset(arg) && app.compSel) {
    const c = app.compSel; byKind(c.obj, c.kind, [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)]);
    return out;
  }
  for (const it of collectionArg(app, arg)) {
    if (it instanceof X3DObject) add(it, 'all');
    else if (it instanceof Cluster) { const o = it.obj; if (o) byKind(o, it.compKind, [...it.elements]); }
    else if (typeof it === 'string') {
      const r = /^(.+?)\.(pnt|poly|edge|sample)\[(.*)\]$/.exec(it);
      const o = r ? resolveItem(app, r[1]) : null;
      if (!r || !(o instanceof X3DObject)) continue;
      const items: (number | string)[] = [];
      for (const tok of r[3].split(',').map(s => s.trim()).filter(Boolean)) {
        if (r[2] === 'edge') { items.push(tok); continue; }
        const range = /^(\d+)-(\d+)$/.exec(tok);
        if (range) for (let i = Number(range[1]); i <= Number(range[2]); i++) items.push(i); else items.push(Number(tok));
      }
      byKind(o, r[2], items);
    } else if (it && typeof it === 'object' && it.obj instanceof X3DObject && Array.isArray(it.indices)) byKind(it.obj, String(it.kind ?? 'sample'), it.indices);
  }
  for (const [o, s] of [...out]) if (!s.size) out.delete(o);
  void command;
  return out;
}

/** Create the user-normal storage of an object: SICreateCluster (sample, User_Normal_Cluster) + SIAddProp
 *  (User Normal Property) on it, both undoable. */
function createStorage(app: App, o: X3DObject): Cluster {
  const c = new Cluster(USER_NORMAL_CLUSTER, 'sample', new Set());
  app.record('SICreateCluster', () => { o.addCluster(c); }, () => { o.removeCluster(c); });
  const p = new Property(USER_NORMAL_PROPERTY, USER_NORMAL_TYPE, []);
  (p as any).valueDim = 3; (p as any).values = new Map();
  app.record('SIAddProp', () => { c.addProperty(p); }, () => { c.removeProperty(p); });
  return c;
}
function addSamples(app: App, c: Cluster, samples: number[]) {
  const add = samples.filter(s => !c.elements.has(s)); if (!add.length) return;
  app.record('SIAddToCluster', () => { for (const s of add) c.elements.add(s); }, () => { for (const s of add) c.elements.delete(s); });
}
/** Write one normal per sample through the SetClusterPropertyValues worker (mode 0, no clamp, undo on). */
function writeNormals(app: App, command: string, c: Cluster, normals: Map<number, V3>) {
  const p = userNormalProperty(c); const order = elementOrder(c);
  const offsets: number[] = [], tuples: number[][] = [];
  for (const [s, n] of normals) { const o = order.indexOf(s); if (o >= 0) { offsets.push(o); tuples.push([...n]); } }
  if (offsets.length) applyClusterValues(app, command, p, { offsets, dim: 3, tuples }, 0, false);
}
const currentNormal = (c: Cluster | null, s: number): V3 | null => {
  if (!c?.elements.has(s)) return null;
  const v = valuesOf(userNormalProperty(c)).get(s); return Array.isArray(v) && v.length === 3 ? [v[0], v[1], v[2]] : null;
};

type Mode = 'create' | 'remove' | 'vertex' | 'polygon';
function userNormals(app: App, command: string, a: Record<string, any>, mode: Mode, given?: Map<X3DObject, Map<number, V3>>) {
  const st = b15b(app);
  // bleed flag: preference TweakNormals.bleedselection, overridden by the argument; written back (RePackArg)
  const bleed = unset(a.BleedSelection) ? st.bleedSelectionPref : boolArg(a.BleedSelection);
  st.bleedOut[command] = bleed;
  const work: Map<X3DObject, Set<number>> = given ? new Map([...given].map(([o, m]) => [o, new Set(m.keys())])) : gather(app, command, a.InputObjs);
  if (!work.size) { warn(app, command, 'no sample to process', 8); setStatus(app, command, S_FALSE); return; }
  if (!given && bleed) logNya(app, command, 'the bleed expansion through an active tweak-component tool (no such tool is active in this build)');
  if (!given && mode === 'polygon') logNya(app, command, 'how normals are accumulated per sample during the gather (no accumulated data: the polygon normal is used)');
  if (!given && (mode === 'vertex' || mode === 'create')) logNya(app, command, 'the geometry\'s vertex-normal formula (area-weighted adjacent polygon normals used)');
  const freeze: X3DObject[] = [];
  for (const [o, set] of work) {
    const m = o.primitive!.mesh()!; const t = sampleTable(m); const samples = [...set].sort((x, y) => x - y);
    let c = userNormalCluster(o);
    if (mode === 'remove') {
      if (!c) continue;
      const cl = c; const gone = samples.filter(s => cl.elements.has(s)); if (!gone.length) continue;
      const vals = valuesOf(userNormalProperty(cl)); const old = new Map(gone.map(s => [s, vals.get(s)] as const));
      app.record('SIRemoveFromCluster', () => { for (const s of gone) { cl.elements.delete(s); vals.delete(s); } }, () => { for (const s of gone) { cl.elements.add(s); const v = old.get(s); if (v !== undefined) vals.set(s, v); } });
      if (cl.elements.size === 0) app.record('DeleteObj', () => { o.removeCluster(cl); }, () => { o.addCluster(cl); });
      continue;
    }
    const targets = mode === 'create' ? samples.filter(s => !c?.elements.has(s)) : samples;
    if (!targets.length) continue;
    const vn = mode === 'polygon' ? null : vertexNormals(m);
    const normals = new Map<number, V3>();
    for (const s of targets) {
      if (given) normals.set(s, given.get(o)!.get(s)!);
      else if (mode === 'polygon') normals.set(s, polygonNormal(m, t.poly[s]));
      else normals.set(s, (mode === 'create' ? currentNormal(c, s) : null) ?? vn![t.pnt[s]]);
    }
    if (!c) c = createStorage(app, o);
    addSamples(app, c, targets);
    writeNormals(app, command, c, normals);
    if (st.freezeAfterWrite && !freeze.includes(o)) freeze.push(o);
  }
  if (freeze.length && app.commands.has('FreezeObj')) app.run('FreezeObj', { InputObjs: freeze });
  setStatus(app, command, S_OK);
  app.events.emit('scene');
}

function setUserNormalValues(app: App, a: Record<string, any>) {
  const C = 'SetUserNormalValues';
  const first = collectionArg(app, a.InputObj)[0];
  const o = first instanceof X3DObject ? first : typeof first === 'string' ? ownerObject(resolveItem(app, first.replace(/\.(pnt|poly|edge|sample)\[.*$/, ''))) : null;
  if (!(o instanceof X3DObject) || !o.primitive?.mesh()) throw fail(E_INVALIDARG, `${C}: InputObj is not a 3D object`);
  if (unset(a.Indices) && a.Indices !== 0) throw fail(E_INVALIDARG, `${C}: no Indices`);
  const idx = (Array.isArray(a.Indices) ? a.Indices : [a.Indices]).map((v: any) => Number(v) >>> 0);
  if (!Array.isArray(a.Values)) throw fail(E_INVALIDARG, `${C}: Values is not an array`);
  const vals = (a.Values as any[]).flat().map(Number);
  if (vals.some(v => Number.isNaN(v))) throw fail(E_INVALIDARG, `${C}: a value is not a number`);
  if (vals.length !== 3 && vals.length !== 3 * idx.length) throw fail(E_INVALIDARG, `${C}: ${vals.length} values for ${idx.length} index(es) (3 or 3 x Indices expected)`);
  const n = sampleTable(o.primitive.mesh()!).pnt.length;
  const map = new Map<number, V3>();
  idx.forEach((s: number, i: number) => { if (s >= n) return; const b = vals.length === 3 ? 0 : i * 3; map.set(s, [vals[b], vals[b + 1], vals[b + 2]]); });
  if (!map.size) { warn(app, C, 'no sample to process', 8); setStatus(app, C, S_FALSE); return; }
  userNormals(app, C, {}, 'vertex', new Map([[o, map]]));
}

// ------------------------------------------------------------------ registration
export function registerPropertyTasksB15bClusters(app: App, reg: (name: string, label: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any) => void) {
  reg('SetClusterPropertyValues', 'SetClusterPropertyValues',
    [['ClusterProp', null], ['Offsets', null], ['Values', null], ['Mode', ':siSetValueModeAbsolute:siSetValueMode'], ['ClampValues', false]], setClusterPropertyValues);
  const UN: [string, any][] = [['InputObjs', null], ['BleedSelection', null]];
  reg('CreateUserNormals', 'Create User Normals', UN, (app, a) => userNormals(app, 'CreateUserNormals', a, 'create'));
  reg('RemoveUserNormals', 'Remove User Normals', UN, (app, a) => userNormals(app, 'RemoveUserNormals', a, 'remove'));
  reg('SetVertexUserNormals', 'Set Vertex User Normals', UN, (app, a) => userNormals(app, 'SetVertexUserNormals', a, 'vertex'));
  reg('SetPolygonUserNormals', 'Set Polygon User Normals', UN, (app, a) => userNormals(app, 'SetPolygonUserNormals', a, 'polygon'));
  reg('SetUserNormalValues', 'Set User Normal Values', [['InputObj', null], ['Indices', null], ['Values', null]], setUserNormalValues);
}
