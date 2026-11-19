// Ledger row CMD-B13b (Unfold3D.64.dll add-on): shared state and helpers of the Unfold3D commands wired in
// unfoldB13b.ts. Brief: docs/ghidra/cmd-b13b-unfold3d-binary.md ("Shared facts" 2.x and "Contracts" section 3).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name); the attested log text is
//    logged first. The last status of each command is kept in `app.unfoldB13b.lastStatus`.
//  * UnfoldProperty / UnfoldCutTagProperty are plain Property nodes marked as custom properties. The UnfoldOperator and
//    UnfoldOptimizeOperator are Operator stand-ins recorded on the state (they are not put in the primitive's operator
//    stack: the UV write is done by the solver driver, note 2.9).
//  * SIAddToCluster / SIRemoveFromCluster / InspectObj sub-tasks are undoable steps or trace records under those names
//    (the bus versions act on the component selection only).
//  * The Unfold3D solver itself is not described by the note (2.6 is inputs / flags / outputs). The solver below is an
//    original stand-in, marked `// inferred`.
import { App } from '../core/commands';
import { Node, X3DObject, Cluster, Property, Operator, Group } from '../core/scene';
import { int, num, bool, str } from '../core/params';
import { sampleOffsets, sampleUVs, projectionOf, relaxUVs } from '../core/texturing';
import { meshEdges, edgeKey } from '../core/topology';
import type { MeshData } from '../core/geometry';
import { SiStatusError } from './alembicSeqCam';
import { findNode, unset } from './viewEditPropertyHelpers';
import { listOf } from './tasksB11cShared';

export { unset, listOf };
export const ROW = 'CMD-B13b';
export const S_OK = 0, E_INVALIDARG = 0x80070057, E_FAIL = 0x80004005;
export const LICENCE_MSG = 'Unfold3D license is unvailable.';   // (sic) note 2.1
export const F_UNFOLD = 0x01, F_ADJUST = 0x02, F_PACK = 0x04, F_ISLANDSEL = 0x08, F_RELAX = 0x10, F_REFRESH = 0x20;

export interface UnfoldRecord { object: X3DObject; projection: Property; sampleCluster: Cluster; cutCluster: Cluster }
export interface SolverCall { property: Property; flags: number; params: Record<string, any> }
export interface PageButton { label: string; enabled: boolean }

export interface UnfoldB13bState {
  lastStatus: { command: string; status: number } | null;
  /** Licence check (IsUnfold3DEnabled). True in this build; set false to exercise the failure path. */
  licensed: boolean;
  /** UnfoldOperator stand-ins by output texture projection. */
  unfoldOps: Map<Property, { op: Operator; property: Property }>;
  /** UnfoldOptimizeOperator stand-ins created by UnfoldRelax / UnfoldRegularize. */
  optimizeOps: Operator[];
  /** Record list of each UnfoldProperty (rebuilt by every command, note 2.4). */
  records: Map<Property, UnfoldRecord[]>;
  /** Solver driver runs (flag word and the parameters read, note 2.6). */
  solverCalls: SolverCall[];
  /** InspectObj sub-tasks (node, keywords, title, mode, throw). */
  inspected: { node: Node; keywords: string; title: string; mode: number; throw: boolean }[];
  /** Modal message boxes shown (title, text). */
  messageBoxes: { title: string; text: string }[];
  /** Property-page buttons per UnfoldProperty (note 2.8). */
  pages: Map<Property, Record<'Unfold' | 'UnfoldAndPack', PageButton>>;
  hooks: { failCluster?: (o: X3DObject, kind: 'edge' | 'sample') => boolean };
}

export function stateOf(app: App): UnfoldB13bState {
  const a: any = app;
  if (a.unfoldB13b) return a.unfoldB13b;
  const st: UnfoldB13bState = {
    lastStatus: null, licensed: true, unfoldOps: new Map(), optimizeOps: [], records: new Map(), solverCalls: [],
    inspected: [], messageBoxes: [], pages: new Map(), hooks: {},
  };
  a.unfoldB13b = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
/** Log the attested message, then fail with `status`. */
export function failLog(app: App, command: string, status: number, msg: string): SiStatusError {
  app.logMsg('error', msg);
  return fail(status, `${command}: ${msg}`);
}
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function licenceCheck(app: App, command: string) {
  if (!stateOf(app).licensed) throw failLog(app, command, E_FAIL, LICENCE_MSG);
}
export const text = (v: any) => unset(v) ? '' : Array.isArray(v) ? v.map(x => x?.fullName ?? String(x)).join(',') : (v as any)?.fullName ?? String(v);

// ------------------------------------------------------------------ classes
export const isCustomProperty = (n: any): n is Property => n instanceof Property && (!!(n as any).customProperty || n.type === 'CustomProperty' || n.type === 'customparamset');
export const isUnfoldProperty = (n: any): n is Property => isCustomProperty(n) && n.type === 'UnfoldProperty';
export const isProjection = (n: any): n is Property => n instanceof Property && n.type === 'uvprojection';
export const isPolymsh = (n: any): n is X3DObject => n instanceof X3DObject && n.primitive?.type === 'polymsh' && !!n.primitive.mesh();
export const meshOf = (o: X3DObject): MeshData => o.primitive!.mesh()!;

// ------------------------------------------------------------------ arguments
/** Edge subcomponent of one object (edge keys "a-b"). */
export interface EdgeSub { kind: 'edge' | 'poly' | 'pnt' | 'sample'; obj: X3DObject; items: (number | string)[] }
const SUB_RE = /^(.*)\.(edge|poly|pnt|sample)\[([^\]]*)\]$/;
function rangeList(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(',').map(x => x.trim()).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); } else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}
/** Resolve one argument item: nodes, "obj.edge[..]" style subcomponent strings, cluster / cluster-property paths. */
export function resolveItem(app: App, x: any): Node | EdgeSub | null {
  if (x && typeof x === 'object' && !(x instanceof Node) && x.obj instanceof X3DObject && Array.isArray(x.items)) return x as EdgeSub;
  if (x instanceof Node) return x;
  if (typeof x !== 'string') return null;
  const m = SUB_RE.exec(x.trim());
  if (m) {
    const o = app.scene.find(m[1]); if (!o) return null;
    const kind = m[2] as EdgeSub['kind']; let items: (number | string)[] = rangeList(m[3]);
    if (kind === 'edge' && o.primitive?.mesh()) { const es = meshEdges(meshOf(o)); items = items.filter(i => (i as number) < es.length).map(i => edgeKey(...es[i as number])); }
    return { kind, obj: o, items };
  }
  const n = findNode(app, x); if (n) return n;
  for (const o of app.scene.allObjects()) for (const c of o.clusters) {
    if (c.fullName === x || `${o.name}.${c.name}` === x) return c;
    for (const p of c.properties) if (p.fullName === x || `${o.name}.${c.name}.${p.name}` === x || `${o.name}.cls.${c.name}.${p.name}` === x) return p;
  }
  for (const g of app.scene.groupList) for (const p of ((g as any).properties ?? []) as Property[]) if (`${g.name}.${p.name}` === x) return p;
  return null;
}
/** The current component selection as a subcomponent item. */
function compSelItem(app: App): EdgeSub | null {
  const c = app.compSel; if (!c) return null;
  const kind = c.kind === 'point' ? 'pnt' : c.kind === 'edge' ? 'edge' : 'poly';
  const items = [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)] as (number | string)[];
  return items.length ? { kind, obj: c.obj, items } : null;
}
/** A list argument; when omitted, the selection (Collection / SingleObj handlers, inferred like CMD-B12e). */
export function itemsArg(app: App, v: any): (Node | EdgeSub)[] {
  if (unset(v)) { const cs = compSelItem(app); return cs ? [cs] : [...app.selection]; }
  const out: (Node | EdgeSub)[] = [];
  for (const x of listOf(v)) { const n = resolveItem(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}

// ------------------------------------------------------------------ owners and expansion (note 2.3)
export function ownerObject(n: any): X3DObject | null {
  let p: any = n;
  while (p && !(p instanceof X3DObject)) p = p.parent ?? null;
  return p ?? null;
}
export function expand(x: Node | EdgeSub | null, out: X3DObject[] = []): X3DObject[] {
  const add = (o: X3DObject | null) => { if (o && isPolymsh(o) && !out.includes(o)) out.push(o); };
  if (!x) return out;
  if (x instanceof Group) { for (const m of x.members) expand(m, out); return out; }
  if (!(x instanceof Node)) { add(x.obj); return out; }
  if (x instanceof X3DObject) { add(x); return out; }
  if (isProjection(x)) { add(ownerObject(x)); return out; }
  return out;
}
/** The node an UnfoldProperty is hosted on (object or group). */
export const hostOf = (p: Property): Node | null => (p.parent as Node | null) ?? null;
export function hostProperties(n: Node): Property[] {
  const a: any = n; if (!Array.isArray(a.properties)) a.properties = [];
  return a.properties;
}

// ------------------------------------------------------------------ definitions (note 2.7 / 2.9)
let seeded = false, seed = 1;
/** rand() after srand(time seed)  // inferred: time-based seed; values 0..32767 like the C runtime rand(). */
function crand(): number {
  if (!seeded) { seed = (Date.now() & 0x7fffffff) >>> 0; seeded = true; }
  seed = (Math.imul(seed, 214013) + 2531011) >>> 0; return (seed >>> 16) & 0x7fff;
}
export function makeUnfoldProperty(name = 'Unfold'): Property {
  // capability 4 (persistable) on every parameter except Pack_live (0x80 only)
  const I = (n: string, v: number, l: string, min?: number, max?: number, uimin?: number, uimax?: number) => ({ ...int(n, v, l, { min, max, uimin: uimin ?? min, uimax: uimax ?? max }), animatable: false });
  const D = (n: string, v: number, l: string, min?: number, max?: number) => ({ ...num(n, v, l, { min, max, uimin: min, uimax: max }), animatable: false });
  const p = new Property(name, 'UnfoldProperty', [
    { ...int('UnfoldPropertyID', crand(), 'UnfoldPropertyID', { desc: 'Unfold texture support identifier' }), animatable: false },
    I('Adjust_iterations', 1, 'Adjust_iterations', 1, 50, 1, 15),
    D('Adjust_power', 1.0, 'Adjust_power', 0.01, 1),
    I('Relax_iterations', 1, 'Relax_iterations', 1, 50, 1, 15),
    D('Relax_power', 1.0, 'Relax_power', 0.01, 1),
    D('Pack_spacing', 0.01, 'Spacing', 0, 1),
    D('Pack_islandrotation', 0, 'Rotation offset', 0, 360),
    D('Pack_globalrotation', 0, 'Global rotation', 0, 360),
    I('Pack_packrandomseed', 0, 'Random seed', 0, 32767),
    I('Pack_sortordertype', 1, 'Pieces', 0, 3),
    D('Pack_angleincrement', 90, 'Rotation accuracy', 0, 360),
    I('Pack_uvlayoutscalingmode', 0, 'Global scaling', 0, 3),
    I('Pack_scalingmode', 1, 'Scale reference', 0, 1),
    bool('Pack_useboxpacking', false, 'Box packing'),
    D('Pack_squareresol', 0.5, 'Positioning', 0, 4),
    str('UnfoldSignature', '', 'UnfoldSignature'),
    bool('Pack_live', false, 'Live packing'),
    str('Connected_operators', '', 'Connected_operators'),
  ]);
  (p as any).customProperty = true; (p as any).notPersistable = ['Pack_live'];
  (p as any).helpFile = '<FactoryPath>/Doc/<DocLangPref>/XSI/xsidocs.chm::/texmaps_props_Unfold.htm';
  (p as any).ppgLayout = UNFOLD_LAYOUT; (p as any).ppgRefresh = true;
  return p;
}
/** Layout of the UnfoldProperty page (note 2.7), as data. */
export const UNFOLD_LAYOUT = [
  { tab: 'Unfold', items: [
    { group: 'Unfold Cut Line', items: [{ button: 'AddToCutLineBtn', label: 'Add to Cut Line' }, { button: 'RemoveFromCutLineBtn', label: 'Remove from Cut Line' }, { button: 'UseEdgeSelectionBtn', label: 'Set from Current Edges' }, { button: 'SelectCutLineBtn', label: 'Select Cut Line' }] },
    { group: 'Update UV', items: [{ button: 'UnfoldAndPack', label: 'Unfold and Pack' }, { button: 'Unfold', label: 'Unfold No Pack' }] },
  ] },
  { tab: 'Pack', items: [
    { group: 'Packing options', items: [{ param: 'Pack_live', label: 'Live packing' }, { button: 'Pack', label: 'Pack' }] },
    { group: 'Island Order', items: [{ param: 'Pack_sortordertype', label: 'Pieces', combo: [['Increasing in size', 0], ['Decreasing in size', 1], ['Random order', 2]] }, { param: 'Pack_packrandomseed', label: 'Random seed' }] },
    { group: 'Island Positioning', items: [{ param: 'Pack_spacing', label: 'Spacing' }, { param: 'Pack_squareresol', label: 'Positioning', combo: [['Coarse', 4.0], ['Standard', 0.5], ['Precise', 0.1], ['Very precise', 0.02]] }] },
    { group: 'Island Orientation', items: [{ param: 'Pack_islandrotation', label: 'Rotation offset' }, { param: 'Pack_angleincrement', label: 'Rotation accuracy', combo: [['Disabled', 0], ['Half turn (180)', 180], ['Perpendicular (90)', 90], ['Average (5)', 5], ['Precise (1)', 1]] }] },
    { group: 'Island Scaling', items: [{ param: 'Pack_scalingmode', label: 'Scale reference', combo: [['Use boundary length', 0], ['Use surface area', 1]] }] },
    { group: 'Post Operations', items: [{ param: 'Pack_globalrotation', label: 'Global rotation' }, { param: 'Pack_uvlayoutscalingmode', label: 'Global scaling', combo: [['Best fit', 0], ['Squarify', 1], ['Metric conservation', 2]] }, { param: 'Pack_useboxpacking', label: 'Box packing' }] },
  ] },
];
export function makeCutTag(id: number): Property {
  const p = new Property('UnfoldCutTag', 'UnfoldCutTagProperty', [{ ...int('UnfoldPropertyID', id, 'UnfoldPropertyID', { desc: 'Unfold texture support identifier' }), animatable: false }]);
  (p as any).customProperty = true; (p as any).branchFlag = true;
  return p;
}
export function makeUnfoldOperator(id: number): Operator {
  const op = new Operator('UnfoldOperator', 'UnfoldOperator', [{ ...int('UnfoldPropertyID', id, 'UnfoldPropertyID'), animatable: false }]);
  (op as any).alwaysEvaluate = true;
  return op;
}

// ------------------------------------------------------------------ records (note 2.4)
const uniqueCluster = (o: X3DObject, base: string) => { let n = base, i = 1; while (o.clusters.some(c => c.name === n)) n = `${base}${i++}`; return n; };
const idOf = (p: Property) => Number(p.val('UnfoldPropertyID'));
/** The object's cut cluster tagged with the property's ID (lookup only). */
export function findCutCluster(o: X3DObject, id: number): Cluster | null {
  // inferred: the tag test (helper 0x18001f140 unread) compares the tag's UnfoldPropertyID with the property's
  return o.clusters.find(c => c.compKind === 'edge' && c.properties.some(t => t.type === 'UnfoldCutTagProperty' && Number(t.val('UnfoldPropertyID')) === id)) ?? null;
}
function messageBox(app: App, textMsg: string) {
  const title = 'Unfold3D Mesh Topo Error';
  stateOf(app).messageBoxes.push({ title, text: textMsg });
  app.logMsg('error', `${title}: ${textMsg}`);
}
/** Find or create the cut cluster (record step 1). Null when creation fails (message box shown). */
export function cutClusterFor(app: App, o: X3DObject, prop: Property): Cluster | null {
  const id = idOf(prop);
  const found = findCutCluster(o, id); if (found) return found;
  if (stateOf(app).hooks.failCluster?.(o, 'edge')) {
    messageBox(app, `Unfold3D Plugin Error : Softimage internal couln't create an edge cluster on that mesh : ${o.fullName}`);
    return null;
  }
  const c = new Cluster(uniqueCluster(o, 'Unfold_CutLine'), 'edge', new Set());
  const tag = makeCutTag(id);
  app.record('Unfold_CutLine', () => { o.addCluster(c); c.addProperty(tag); }, () => { c.removeProperty(tag); o.removeCluster(c); });
  return c;
}
function connectOperator(app: App, proj: Property, prop: Property) {
  const st = stateOf(app);
  const op = makeUnfoldOperator(idOf(prop)); (op as any).outputs = [proj]; (op as any).inputs = [proj, prop];
  const old = st.unfoldOps.get(proj);
  app.record('UnfoldOperator', () => { st.unfoldOps.set(proj, { op, property: prop }); (proj as any).unfoldOperator = op; },
    () => { if (old) st.unfoldOps.set(proj, old); else st.unfoldOps.delete(proj); (proj as any).unfoldOperator = old?.op; });
}
/** Rebuild the records of an UnfoldProperty (note 2.4). Returns [] when a cluster cannot be created. */
export function buildRecords(app: App, prop: Property, projections: Property[] = []): UnfoldRecord[] {
  const st = stateOf(app);
  const host = hostOf(prop);
  const targets = host ? expand(host) : [];
  const out: UnfoldRecord[] = [];
  for (const o of targets) {
    const cut = cutClusterFor(app, o, prop);
    if (!cut) { st.records.set(prop, []); return []; }
    let proj: Property | null = null, sc: Cluster | null = null;
    const given = projections.find(p => ownerObject(p) === o);
    if (given) { proj = given; sc = given.parent as Cluster; connectOperator(app, proj, prop); }
    if (!proj) for (const c of o.clusters) if (c.compKind === 'sample') {
      const p = c.properties.find(q => isProjection(q) && st.unfoldOps.get(q)?.property === prop);
      if (p) { proj = p; sc = c; break; }
    }
    if (!proj) {
      if (st.hooks.failCluster?.(o, 'sample')) { messageBox(app, `Unfold3D Plugin Error : Softimage internal couln't create an sample point cluster on that mesh : ${o.fullName}`); st.records.set(prop, []); return []; }
      const m = meshOf(o); const total = sampleOffsets(m).total;
      const c = new Cluster(uniqueCluster(o, 'Texture_Coordinates_AUTO'), 'sample', new Set(Array.from({ length: total }, (_, i) => i)));
      c.set('alwayscomplete', true);
      const p = new Property('Unfold', 'uvprojection', [{ name: 'kind', label: 'Projection', type: 'enum', value: 'UV', items: [{ label: 'UV', value: 'UV' }], animatable: false }]);
      (p as any).uvs = new Float32Array(total * 2);   // every UV element set to 0
      app.record('Texture Projection', () => { o.addCluster(c); c.addProperty(p); }, () => { c.removeProperty(p); o.removeCluster(c); });
      connectOperator(app, p, prop);
      proj = p; sc = c;
    }
    out.push({ object: o, projection: proj, sampleCluster: sc!, cutCluster: cut });
  }
  st.records.set(prop, out);
  return out;
}

// ------------------------------------------------------------------ UVs
/** Current per-sample UVs of a projection. */
export function uvsOf(o: X3DObject, p: Property): Float32Array | null {
  const m = o.primitive?.mesh(); if (!m) return null;
  const total = sampleOffsets(m).total; const own = (p as any).uvs as Float32Array | undefined;
  if (own && own.length === total * 2) return own;
  if (projectionOf(o) === p) return sampleUVs(o);
  return null;
}
/** "Has UVs" test (note 2.4): any record's projection with at least one non-zero component. */
export function hasUVs(app: App, prop: Property): boolean {
  return (stateOf(app).records.get(prop) ?? []).some(r => { const uv = uvsOf(r.object, r.projection); return !!uv && uv.some(v => v !== 0); });
}
/** Write UVs back to a projection (undoable). */
export function writeUVs(app: App, p: Property, uv: Float32Array) {
  const old = (p as any).uvs;
  app.record('Unfold UVs', () => { (p as any).uvs = uv; (p as any)._uvcache = null; }, () => { (p as any).uvs = old; (p as any)._uvcache = null; });
}
/** UV-island borders of a projection: interior edges whose two sides do not share UVs at an end point.  // inferred
 *  (border computation 0x18000dc90 not read). */
export function islandBorders(o: X3DObject, p: Property): string[] {
  const m = meshOf(o); const uv = uvsOf(o, p); if (!uv) return [];
  const { start } = sampleOffsets(m);
  const sides = new Map<string, { a: number; b: number; sa: number; sb: number }[]>();
  m.polygons.forEach((f, pi) => f.forEach((v, i) => {
    const w = f[(i + 1) % f.length]; const k = edgeKey(v, w);
    const s = { a: v, b: w, sa: start[pi] + i, sb: start[pi] + (i + 1) % f.length };
    (sides.get(k) ?? sides.set(k, []).get(k)!).push(s);
  }));
  const same = (s1: number, s2: number) => Math.abs(uv[s1 * 2] - uv[s2 * 2]) < 1e-6 && Math.abs(uv[s1 * 2 + 1] - uv[s2 * 2 + 1]) < 1e-6;
  const out: string[] = [];
  for (const [k, list] of sides) {
    if (list.length !== 2) continue;
    const [x, y] = list; const ya = y.a === x.a ? y.sa : y.sb, yb = y.a === x.a ? y.sb : y.sa;
    if (!same(x.sa, ya) || !same(x.sb, yb)) out.push(k);
  }
  return out;
}
/** SIAddToCluster / SIRemoveFromCluster sub-tasks on an edge cluster (undoable). */
export function addToCluster(app: App, c: Cluster, items: (number | string)[]) {
  const add = items.filter(i => !c.elements.has(i));
  app.record('SIAddToCluster', () => add.forEach(i => c.elements.add(i)), () => add.forEach(i => c.elements.delete(i)));
}
export function removeFromCluster(app: App, c: Cluster, items: (number | string)[]) {
  const rm = items.filter(i => c.elements.has(i));
  app.record('SIRemoveFromCluster', () => rm.forEach(i => c.elements.delete(i)), () => rm.forEach(i => c.elements.add(i)));
}
/** Island frontiers pass (note 2.5, mode 4): add each record's current UV-island borders to its cut cluster. */
export function addIslandFrontiers(app: App, prop: Property) {
  for (const r of buildRecords(app, prop)) addToCluster(app, r.cutCluster, islandBorders(r.object, r.projection));
}

// ------------------------------------------------------------------ page relabel (note 2.8)
export function relabel(app: App, prop: Property) {
  const st = stateOf(app); const has = hasUVs(app, prop);
  const next = has
    ? { Unfold: { label: 'Update No Pack', enabled: true }, UnfoldAndPack: { label: 'Update and Pack', enabled: true } }
    : { Unfold: { label: 'Unfold No Pack', enabled: false }, UnfoldAndPack: { label: 'Unfold and Pack', enabled: true } };
  st.pages.set(prop, next); (prop as any).ppgButtons = next;
}

// ------------------------------------------------------------------ inspect
export function inspect(app: App, node: Node, keywords: string, title: string, mode: number, thr: boolean) {
  stateOf(app).inspected.push({ node, keywords, title, mode, throw: thr });
  app.events.emit('inspect', node);
}

export { X3DObject, Cluster, Property, Operator, Group, Node, relaxUVs, sampleOffsets, meshEdges, edgeKey };
