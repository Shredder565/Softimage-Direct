// Row CMD-B19d: selection manager commands (selectionmgr.dll), the playback transport (mcp.dll), Center / Isolate /
// Frame Contextual (vm.dll), SwitchToolbar (toolbarobj.dll) and ShowFaceRobotActPanel (siuitasks.dll), wired to the
// wire contracts of docs/ghidra/cmd-b19d-selection-playback-isolate.md section 3 and items 1-16 of
// docs/re/WIRE_CORRECTIONS_B19.md (section CMD-B19d). RenderRegionSave of the same row is in renderRegionSaveB19d.ts.
//
// This module replaces the earlier registrations of these names (index.ts, ui.ts, anim.ts, selectionGroupLayer.ts,
// viewEditProperty.ts, viewEditPropertyMore.ts, iceModule.ts, hairModule.ts, simulateModule.ts, faceRobotModule.ts);
// it is registered last, so it also wins over the SwitchToolbar of renderToolbarOm.ts.
//
// Argument names, order and defaults: data/command_registry.json (output-only `Value` arguments left out; a VT_CLSID
// argument without a registry default reads as null). When several registry entries share a scripting name, the first
// one is registered (PrevFrame / PlaybackStop / ... = the main timeline player, Transport 0; SwitchToolbar = Target 1).
//
// Model of the selection manager in this build (inferred where marked):
//  - the selection list is `app.selection` + `app.compSel` (one object and one component kind; the object of
//    `compSel` stands in the list for its components);
//  - the active-elements list (objects whose components are edited) is `app.activeElements`; objects selected while a
//    component filter is current, and the object of the component selection, count as active too (inferred);
//  - the current selection filter is `app.selFilter` (label) + `app.selMode`;
//  - ambient values SI3D_GROUP_SEL_MODE / SI3D_RECTSEL_REGION_MODE live in `app.userPrefs` (SI3D_GROUP_SEL_MODE also
//    drives the viewport's group picking, `app.groupMode`).
// Unknown branches (section 4 of the note) log "not yet attested ... (CMD-B19d)". Original code only.
import * as THREE from 'three';
import { App, type CommandDef, type ComponentSelection } from '../core/commands';
import { Node, X3DObject, Group, Layer, Cluster, Partition } from '../core/scene';
import type { CompKind } from '../core/topology';
import { SiStatusError } from './alembicSeqCam';
import { resolve as resolveList, objectFilter, compString, LayerGroup, type CompRef } from './selectionGroupLayer';
import * as T from './selectionGroupLayerTopology';
import { toolManagerOf } from './toolsB16a';
import { CLS, KEY, KEY_DOWN, REPEAT, type ToolExecContext } from '../core/toolManager';
import { viewports, vm, camChange, b10, type VP } from './inferredB10Shared';
import { viewAt, frameView } from './inferredB10Views';
import { b18a } from './faceRobotB18a';

export const NOTE = 'CMD-B19d';
export const S_OK = 0, S_FALSE = 1, S_NOTHING_CHANGED = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff, E_POINTER = 0x80004003, E_ABORT = 0x80004004, E_FAIL = 0x80004005;
const FILTER_GUID = '{1128E000-DBE2-11d2-8BCF-00AA006130EF}';
const SELECT_TOOL = CLS.select;                                    // 11778840
const COMPONENT_SELECT_TOOL = 'e9cdd760-d183-11d2-8bcf-00aa006130ef'; // inferred: the component / tag variant (Q2)
const FR_ACT_TOOL = '1e0a3aab-05da-4716-9e7c-05ffe14242c9';
const FR_PANEL_VIEW = 'Face Robot Act Floating Panel';

// ------------------------------------------------------------------ row state
type FKind = 'object' | CompKind | 'sample' | 'tip';
interface Tag { obj: X3DObject; kind: CompKind; items: Set<number | string> }
export interface PlayerState { frame: number; dir: number; playing: boolean; mode: { realtime: boolean; speed: number } | null }
export interface B19dState {
  /** Last HRESULT of each command (S_OK, S_FALSE, 0x562e80c7 ...). */
  status: Record<string, number>;
  /** "Previously tagged" components per object and kind (inferred, Q3): the component selection a filter change left. */
  tags: Tag[];
  /** SI3D_GROUP_SEL_MODE before a key-held (supra) Activate...SelTool, restored when the key is released. */
  supraGroupSelMode: boolean | null;
  /** The Face Robot act panel object (05aa1bc9): the resolved path and the offsets. */
  actPanel: { path: string; offsetX: number; offsetY: number } | null;
  /** Calls into sub-tasks, newest last (name, detail) - for the check. */
  subTasks: { task: string; detail?: any }[];
  /** Post-selection script requests of SetAndToggleSelection. */
  postSelection: boolean[];
  /** Activate...SelTool calls that asked the exec context "do not record" (CMD-B20c Q41), newest last. */
  doNotRecord: string[];
}
export function b19d(app: App): B19dState {
  const A = app as any;
  const s = (A.selB19d ??= { status: {}, tags: [], supraGroupSelMode: null, actPanel: null, subTasks: [], postSelection: [], doNotRecord: [] } as B19dState);
  s.doNotRecord ??= [];
  return s;
}
const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
export function nyaB19d(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${NOTE})`); }
/** Parts still open after the CMD-B20c answers (docs/ghidra/cmd-b20c-pr201-answers.md). */
function nya20(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (CMD-B20c)`); }
const setStatus = (app: App, cmd: string, code: number) => { b19d(app).status[cmd] = code; };
const unset = (v: any) => v === undefined || v === null || v === '';
const boolOf = (v: any, d = false) => unset(v) ? d : typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;
const uniq = <N>(l: N[]): N[] => [...new Set(l)];
const subTask = (app: App, task: string, detail?: any) => { b19d(app).subTasks.push({ task, detail }); };

// ------------------------------------------------------------------ ambient values
const prefsBag = (app: App): Record<string, any> => ((app as any).userPrefs ??= {});
export function groupSelMode(app: App): boolean { const v = prefsBag(app).SI3D_GROUP_SEL_MODE; return v === undefined ? !!(app as any).groupMode : !!v; }
function setGroupSelMode(app: App, v: boolean) { prefsBag(app).SI3D_GROUP_SEL_MODE = v; (app as any).groupMode = v; }
export function rectSelRegionMode(app: App): number { return Number(prefsBag(app).SI3D_RECTSEL_REGION_MODE ?? 1); }

// ------------------------------------------------------------------ selection filters
export interface Filter { name: string; kind: FKind; component: boolean; label: string; pred: (o: X3DObject) => boolean }
const LABEL: Record<FKind, string> = { object: 'Object', point: 'Point', edge: 'Edge', polygon: 'Polygon', sample: 'SampledPoint', tip: 'Tip' };
const mkFilter = (name: string, kind: FKind, pred: (o: X3DObject) => boolean = () => true): Filter =>
  ({ name, kind, component: kind !== 'object', label: kind === 'object' && name !== 'object' ? name : LABEL[kind], pred });
const KIND_OF: Record<string, FKind> = {
  object: 'object', objects: 'object', vertex: 'point', point: 'point', points: 'point', pnt: 'point', edge: 'edge', edges: 'edge',
  polygon: 'polygon', polygons: 'polygon', poly: 'polygon', sampledpoint: 'sample', sample: 'sample', samples: 'sample', tip: 'tip', hairtip: 'tip',
};
/** The current selection filter. */
export function currentFilter(app: App): Filter {
  if (app.selMode !== 'object') return mkFilter(app.selMode, app.selMode);
  const label = String((app as any).selFilter ?? 'Object');
  const k = KIND_OF[label.toLowerCase().replace(/[\s_]/g, '')];
  if (k && k !== 'point' && k !== 'edge' && k !== 'polygon') return mkFilter(k === 'object' ? 'object' : label, k);
  const pred = objectFilter(app, label);
  return pred ? mkFilter(label, 'object', pred) : mkFilter('object', 'object');
}
/** A SelFilter argument ("{1128E000-...}:polygon", a filter name, an object-type filter name). null = not resolved. */
export function parseFilter(app: App, v: any): Filter | null {
  if (unset(v)) return null;
  const name = String(v).replace(/^\{[0-9a-f-]+\}:/i, '').trim();
  if (name.toLowerCase() === 'object_only_if_current_is_subcomponent_one') {
    // inferred: the object filter when the current filter is a component one, else the current filter is kept
    const cur = currentFilter(app); return cur.component ? mkFilter('object', 'object') : cur;
  }
  const k = KIND_OF[name.toLowerCase().replace(/[\s_]/g, '')];
  if (k) return mkFilter(k === 'object' ? 'object' : name, k);
  const pred = objectFilter(app, name);
  return pred ? mkFilter(name, 'object', pred) : null;
}
function makeCurrent(app: App, f: Filter) {
  (app as any).selFilter = f.label;
  app.selMode = f.kind === 'point' || f.kind === 'edge' || f.kind === 'polygon' ? f.kind : 'object';
}

// ------------------------------------------------------------------ selection list helpers
const compSet = (c: ComponentSelection): Set<number | string> => c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons;
const hasItems = (c: ComponentSelection | null) => !!c && compSet(c).size > 0;
const copyComp = (c: ComponentSelection | null): ComponentSelection | null => c ? { obj: c.obj, kind: c.kind, points: new Set(c.points), edges: new Set(c.edges), polygons: new Set(c.polygons) } : null;
const newComp = (obj: X3DObject, kind: CompKind, items: Iterable<number | string>): ComponentSelection => {
  const c: ComponentSelection = { obj, kind, points: new Set(), edges: new Set(), polygons: new Set() };
  for (const it of items) compSet(c).add(it);
  return c;
};
function inScene(app: App, o: X3DObject): boolean { let n: X3DObject | null = o; while (n) { if (n === app.scene.root) return true; n = n.parentObj; } return false; }
const selectable = (o: Node) => !(o instanceof X3DObject) || o.property('visibility')?.val('selectability') !== false;
const meshOf = (o: X3DObject | null | undefined) => o?.primitive?.mesh?.() ?? null;
function compText(c: ComponentSelection): string {
  const m = meshOf(c.obj); if (!m) return `${c.obj.name}.${c.kind}[]`;
  return compString(c.obj, T.adjacencyOf(m), c.kind, compSet(c));
}

/** Working copy of the selection manager's lists: object-level items, the component selection, the active elements.
 *  In `app.selection` the object of the component selection stands for its components. */
interface W { items: Node[]; comp: ComponentSelection | null; active: X3DObject[] }
const readW = (app: App): W => ({ items: app.selection.filter(n => n !== app.compSel?.obj), comp: copyComp(app.compSel), active: app.activeElements.filter(o => inScene(app, o)) });
function writeW(app: App, w: W) {
  app.selection = uniq([...w.items, ...(w.comp ? [w.comp.obj] : [])]); app.compSel = w.comp; app.activeElements = uniq(w.active);
}
const wObjects = (w: W): X3DObject[] => w.items.filter((n): n is X3DObject => n instanceof X3DObject);
/** The active-elements list (see the header). */
function activeOf(app: App, w: W): X3DObject[] {
  return uniq([...w.active, ...(w.comp ? [w.comp.obj] : []), ...(app.selMode !== 'object' ? wObjects(w) : [])]);
}
export function activeList(app: App): X3DObject[] { return activeOf(app, readW(app)); }

interface Snap { sel: Node[]; comp: ComponentSelection | null; active: X3DObject[]; selFilter: any; selMode: App['selMode'] }
const snap = (app: App): Snap => ({ sel: [...app.selection], comp: copyComp(app.compSel), active: [...app.activeElements], selFilter: (app as any).selFilter, selMode: app.selMode });
function put(app: App, s: Snap) {
  app.selection = [...s.sel]; app.compSel = copyComp(s.comp); app.activeElements = [...s.active];
  (app as any).selFilter = s.selFilter; app.selMode = s.selMode; app.events.emit('selection');
}
const snapKey = (s: Snap) => JSON.stringify([s.sel.map(n => n.fullName), s.comp ? [s.comp.obj.fullName, s.comp.kind, [...compSet(s.comp)].map(String).sort()] : null, s.active.map(o => o.fullName), s.selFilter ?? null, s.selMode]);
/** Run a selection change on a working copy and make it one undoable step (the base task undo of the sub-tasks).
 *  Returns false when nothing changed. `undoable` false: the change is made without an undo record. */
function selectionStep(app: App, label: string, body: (w: W) => void, undoable = true): boolean {
  const before = snap(app);
  const w = readW(app); body(w); writeW(app, w);
  const after = snap(app);
  if (snapKey(before) === snapKey(after)) { put(app, before); return false; }
  if (!undoable) { app.events.emit('selection'); return true; }
  put(app, before);
  app.record(label, () => put(app, after), () => put(app, before));
  return true;
}
function mergeComps(comps: CompRef[]): ComponentSelection[] {
  const out: ComponentSelection[] = [];
  for (const r of comps) {
    let c = out.find(x => x.obj === r.obj && x.kind === r.kind);
    if (!c) { c = newComp(r.obj, r.kind, []); out.push(c); }
    for (const it of r.items) compSet(c).add(it);
  }
  return out;
}
/** SelectObj sub-task (79581ba0, replace); CheckObjectSelectability drops unselectable objects. */
function selectObj(app: App, w: W, nodes: Node[], comps: CompRef[], checkSelectability: boolean) {
  subTask(app, 'SelectObj', { nodes: nodes.length, comps: comps.length });
  const merged = mergeComps(comps).filter(c => !checkSelectability || selectable(c.obj));
  if (merged.length > 1) app.logMsg('info', `SelectObj: this build holds the components of one object and one type; ${merged.slice(1).map(c => compText(c)).join(', ')} not selected`);
  w.items = uniq(checkSelectability ? nodes.filter(selectable) : nodes); w.comp = merged[0] ?? null;
}
/** AddToSelection sub-task (38eddd00). */
function addToSelection(app: App, w: W, nodes: Node[], comp: ComponentSelection | null = null) {
  subTask(app, 'AddToSelection', { nodes: nodes.map(n => n.name), comp: comp ? compText(comp) : null });
  w.items = uniq([...w.items, ...nodes]);
  if (comp) {
    if (w.comp && w.comp.obj === comp.obj && w.comp.kind === comp.kind) for (const it of compSet(comp)) compSet(w.comp).add(it);
    else w.comp = copyComp(comp);
  }
}
/** RemoveFromSelection sub-task (38eddd02); `comp` true also removes the component selection. */
function removeFromSelection(app: App, w: W, nodes: Node[], comp = false) {
  subTask(app, 'RemoveFromSelection', { nodes: nodes.map(n => n.name), comp });
  w.items = w.items.filter(n => !nodes.includes(n));
  if (comp) w.comp = null;
}
/** "Previously tagged" components (inferred, Q3): what a filter change leaves behind is selected again on return. */
function rememberTag(app: App, c: ComponentSelection | null) {
  if (!hasItems(c)) return;
  const S = b19d(app); S.tags = S.tags.filter(t => !(t.obj === c!.obj && t.kind === c!.kind));
  S.tags.push({ obj: c!.obj, kind: c!.kind, items: new Set(compSet(c!)) });
}

// ------------------------------------------------------------------ the set-filter task (91d68770, section 3.5)
/** Make `f` the current filter with the active-element transitions, on the working copy `w`. */
function setFilterWorker(app: App, cmd: string, w: W, f: Filter, deselect: boolean) {
  subTask(app, 'SetFilter', { filter: f.name, deselect });
  const cur = currentFilter(app);
  const activeBefore = activeOf(app, w);
  rememberTag(app, w.comp);
  // the two lists the selection manager answers with (inferred, Q3): "remove" = selected items the new filter does not
  // accept (components of another type; objects an object-type filter rejects), "add" = previously tagged components
  const removeComp = !!w.comp && (!f.component || f.kind !== w.comp.kind);
  const removeObjs = !f.component && f.name !== 'object' ? wObjects(w).filter(o => !f.pred(o)) : [];
  if (cur.name !== f.name || cur.kind !== f.kind) app.logMsg('info', `Selection filter: ${f.label}`);
  makeCurrent(app, f);
  if (f.kind === 'sample' || f.kind === 'tip') nyaB19d(app, cmd, `picking ${f.kind === 'sample' ? 'sampled points' : 'hair tips'} in the viewport (this build has no such component type); the filter is current, objects stay pickable`);
  if (f.component) {
    // component filter (kind 4): every selected 3D object becomes an active element; selected non-object items add
    // their owner; component items stay. With DeselectOnNewFilter the selected objects are removed.
    const objs = wObjects(w);
    const owners = w.items.filter(n => !(n instanceof X3DObject)).map(n => (n as any).obj).filter((o: any): o is X3DObject => o instanceof X3DObject);
    if (w.comp) owners.push(w.comp.obj);
    const add = uniq([...objs, ...owners]).filter(o => !w.active.includes(o));
    if (add.length) { subTask(app, 'ActivateElements', add.map(o => o.name)); w.active = [...w.active, ...add]; }
    if (deselect && objs.length) removeFromSelection(app, w, objs);
  } else if (activeBefore.length) {
    // object filter: the active objects are added to the selection (only the unselected, selectable ones when the
    // selection is kept and not empty), then the active-elements list is cleared
    const sel = wObjects(w);
    const add = !deselect && sel.length ? activeBefore.filter(o => !sel.includes(o) && selectable(o)) : activeBefore;
    if (add.length) addToSelection(app, w, add);
    subTask(app, 'SetActiveElements', []);
    w.active = [];
  }
  if (removeComp) {
    if (deselect) removeFromSelection(app, w, [], true);
    else w.comp = null; // inferred: this build cannot keep components of another type under the new filter; they stay tagged
  }
  if (deselect && removeObjs.length) removeFromSelection(app, w, removeObjs);
  if (f.kind === 'point' || f.kind === 'edge' || f.kind === 'polygon') {
    const act = activeOf(app, w);
    const tag = b19d(app).tags.find(t => t.kind === f.kind && act.includes(t.obj) && (!w.comp || w.comp.obj === t.obj));
    if (tag) {
      const m = meshOf(tag.obj); const all = m ? new Set(T.allItems(T.adjacencyOf(m), tag.kind)) : new Set<number | string>();
      const items = [...tag.items].filter(i => all.has(i));
      if (items.length) addToSelection(app, w, [], newComp(tag.obj, tag.kind, items));
    }
  }
}
/** The set-filter task as one (undoable) step: true when it changed something. Undo restores the previous filter. */
function setFilterTask(app: App, cmd: string, f: Filter, deselect: boolean, undoable = true): boolean {
  return selectionStep(app, cmd, (w) => setFilterWorker(app, cmd, w, f, deselect), undoable);
}
// ------------------------------------------------------------------ SelectAll / SelectAllUsingFilter (section 3.2)
const INVISIBLE_POLYGONS = 'InvisiblePolygons';
function componentVisibility(v: any): boolean {
  if (unset(v)) return false;
  if (typeof v === 'string') { if (/Ignore/i.test(v)) return false; if (/Check/i.test(v)) return true; }
  return boolOf(v);
}
function selectAll(app: App, cmd: string, a: Record<string, any>): any[] {
  const f = unset(a.SelFilter) ? currentFilter(app) : parseFilter(app, a.SelFilter); // inferred: no SelFilter = the current filter
  if (!f) throw fail(cmd, E_FAIL, `SelFilter ${JSON.stringify(a.SelFilter)} is not a selection filter`);
  const checkSel = boolOf(a.CheckObjectSelectability);
  const checkVis = componentVisibility(a.CheckComponentVisibility);
  const affect = unset(a.AffectSelectionList) ? true : boolOf(a.AffectSelectionList, true);
  const nodes: Node[] = []; const comps: CompRef[] = [];
  if (!f.component) {
    const cand = unset(a.SelectionList) ? [...app.scene.allObjects()].filter(o => o !== app.scene.root) : resolveList(app, a.SelectionList).nodes.filter((n): n is X3DObject => n instanceof X3DObject);
    nodes.push(...cand.filter(o => f.pred(o)));
  } else if (f.kind === 'sample' || f.kind === 'tip') {
    nyaB19d(app, cmd, `${f.kind === 'sample' ? 'sampled point' : 'hair tip'} components (no such component type in this build); nothing is collected`);
  } else {
    const kind = f.kind as CompKind;
    for (const o of activeList(app)) {
      if (!o.visible) continue; // F3DFaceRobotIsObjectHidden (inferred: the object's view visibility)
      const m = meshOf(o); if (!m) continue;
      let items = T.allItems(T.adjacencyOf(m), kind);
      if (checkVis && kind === 'polygon') { const inv = o.clusters.find(c => c.name === INVISIBLE_POLYGONS && c.compKind === 'poly'); if (inv) items = items.filter(i => !inv.elements.has(i)); }
      comps.push({ obj: o, kind, items });
    }
  }
  const value = [...nodes, ...comps.map(c => { const m = meshOf(c.obj)!; return compString(c.obj, T.adjacencyOf(m), c.kind, c.items); })];
  if (affect) selectionStep(app, cmd, (w) => selectObj(app, w, nodes, comps, checkSel));
  setStatus(app, cmd, S_OK);
  return value;
}

// ------------------------------------------------------------------ SelectMembers (section 3.3)
const isGroupLike = (n: Node) => n instanceof Group || n instanceof Layer || n instanceof LayerGroup || n instanceof Partition;
function membersOf(n: Node): Node[] {
  if (n instanceof Group) return [...n.members];
  if (n instanceof Layer || n instanceof Partition) return [...n.members];
  if (n instanceof LayerGroup) return n.layers.flatMap(l => [...l.members]);
  return [];
}
const CLUSTER_KIND: Record<string, FKind> = { pnt: 'point', edge: 'edge', poly: 'polygon', sample: 'sample' };
function clusterRef(c: Cluster): CompRef | null {
  const o = c.obj; const m = meshOf(o); const k = CLUSTER_KIND[c.compKind];
  if (!o || !m || (k !== 'point' && k !== 'edge' && k !== 'polygon')) return null;
  const adj = T.adjacencyOf(m); const all = T.allItems(adj, k);
  const items = [...c.elements].map(e => k === 'edge' && typeof e === 'number' ? all[e] : e).filter(e => e !== undefined) as (number | string)[];
  return { obj: o, kind: k, items };
}
function selectMembers(app: App, cmd: string, a: Record<string, any>): any[] {
  // the SelectionList argument handler gives the current selection when the argument is missing (inferred)
  const items: Node[] = unset(a.SelectionList) ? [...app.selection] : resolveList(app, a.SelectionList).nodes;
  if (!unset(a.SelectionList) && !items.length) throw fail(cmd, E_INVALIDARG, `SelectionList ${JSON.stringify(a.SelectionList)} gives no item`);
  const affect = unset(a.AffectSelectionList) ? true : boolOf(a.AffectSelectionList, true);
  const checkSel = boolOf(a.CheckObjectSelectability);
  const nodes: Node[] = []; const comps: CompRef[] = []; const kinds: FKind[] = []; let allClusters = items.length > 0;
  for (const n of items) {
    if (isGroupLike(n)) { nodes.push(...membersOf(n)); allClusters = false; }
    else if (n instanceof Cluster) {
      kinds.push(CLUSTER_KIND[n.compKind]);
      const r = clusterRef(n);
      if (r) comps.push(r); else nyaB19d(app, cmd, `the component reference of the ${n.compKind} cluster ${n.name} (no such component type in this build)`);
    } else { nodes.push(n); allClusters = false; }
  }
  const common = allClusters && kinds.length && kinds.every(k => k === kinds[0]) ? kinds[0] : null;
  const value = [...uniq(nodes), ...comps.map(c => compString(c.obj, T.adjacencyOf(meshOf(c.obj)!), c.kind, c.items))];
  if (affect) {
    selectionStep(app, cmd, (w) => {
      selectObj(app, w, uniq(nodes), comps, checkSel);
      if (common) setFilterWorker(app, cmd, w, mkFilter(common, common), false); // the filter found in the registry (mode 3)
    });
    setGroupSelMode(app, false); // not restored by undo (no record)
  }
  setStatus(app, cmd, S_OK);
  return value;
}

// ------------------------------------------------------------------ SetAndToggleSelection (section 3.1)
// The {0907F360-...} hierarchy-level names the registry uses (CMD-B20c Q40); only ASITIS = 0 has a known number (the
// name -> number conversion is done before the handler). NODE is kept for the callers of this build that pass it.
const LEVEL_NAMES: Record<string, number | null> = { ASITIS: 0, 'NODE OR BRANCH': null, BRANCH: null, TREE: null, CHAIN: null, MODEL: null, NODE: null };
function hierarchyLevel(cmd: string, v: any): { code: number | null; name: string | null } {
  if (unset(v)) return { code: 0, name: 'ASITIS' };
  const s = String(v).replace(/^\{[0-9a-f-]+\}:/i, '').trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 7 || n === 4) throw fail(cmd, E_INVALIDARG, `HierarchyLevel ${s} is not accepted (0..7, not 4)`);
    return { code: n, name: null };
  }
  const up = s.toUpperCase().replace(/\s+/g, ' ');
  if (!(up in LEVEL_NAMES)) throw fail(cmd, E_INVALIDARG, `HierarchyLevel "${s}" is not a hierarchy level`);
  return { code: LEVEL_NAMES[up], name: up };
}
function expandLevel(app: App, cmd: string, nodes: Node[], lv: { code: number | null; name: string | null }): Node[] {
  if (lv.code === 0) return nodes;
  const branch = (o: X3DObject): X3DObject[] => [o, ...o.descendants()];
  const top = (o: X3DObject): X3DObject => { let t = o; while (t.parentObj && t.parentObj !== app.scene.root) t = t.parentObj; return t; };
  const ex = (f: (o: X3DObject) => X3DObject[]) => uniq(nodes.flatMap(n => n instanceof X3DObject ? f(n) : [n]));
  if (lv.name === 'NODE') return nodes;
  if (lv.name === 'BRANCH') return ex(branch);
  if (lv.name === 'TREE') return ex(o => branch(top(o)));
  if (lv.name === 'MODEL') return ex(o => { const m = o.model; return m && m !== app.scene.root ? branch(m) : [o]; });
  if (lv.name === 'NODE OR BRANCH' || lv.name === 'CHAIN') { nya20(app, cmd, `the number of hierarchy level ${lv.name} and how the selection service expands the list for it; the list is used as given`); return nodes; }
  nyaB19d(app, cmd, `how the selection service expands the list for hierarchy level ${lv.code}; the list is used as given`);
  return nodes;
}
function setAndToggleSelection(app: App, cmd: string, a: Record<string, any>): void {
  const lv = hierarchyLevel(cmd, a.HierarchyLevel);
  const post = boolOf(a.SupportPostSelectionScript);
  // CheckObjectSelectability is registered but not read by this class
  const S = b19d(app);
  if (unset(a.SelectionList) || (Array.isArray(a.SelectionList) && !a.SelectionList.length)) {
    // CMD-B20c Q35: an empty SelectionList is not expanded and the split gets no list at all (undefined in the binary)
    nya20(app, cmd, 'an empty SelectionList (the split is called with no list); the selection is not touched');
    S.postSelection.push(post);
    setStatus(app, cmd, S_NOTHING_CHANGED);
    return;
  }
  const r = resolveList(app, a.SelectionList);
  const nodes = expandLevel(app, cmd, r.nodes, lv);
  // pre-check (task slot 10, CMD-B20c Q35): the expanded list filtered into the working list; nothing usable ->
  // "nothing changed" and the selection is not touched
  if (!nodes.length && !r.comps.some(c => c.items.length)) {
    S.postSelection.push(post);
    setStatus(app, cmd, S_NOTHING_CHANGED);
    return;
  }
  // split (mode 1): A = the items / component indices not currently selected
  const curObjs = new Set<Node>(readW(app).items);
  const keepNodes = nodes.filter(n => !curObjs.has(n));
  const keepComps: CompRef[] = r.comps.map(c => {
    const cur = app.compSel && app.compSel.obj === c.obj && app.compSel.kind === c.kind ? compSet(app.compSel) : new Set<number | string>();
    return { ...c, items: c.items.filter(i => !cur.has(i)) };
  }).filter(c => c.items.length);
  const changed = selectionStep(app, cmd, (w) => {
    const before = [...w.items];
    selectObj(app, w, keepNodes, keepComps, false); // the set-selection helper, with SupportPostSelectionScript
    const removed = before.filter(n => !w.items.includes(n));
    if (removed.length) subTask(app, 'RemoveFromSelection', removed.map(n => n.name));
    // DeactivateElements for the second list (inferred: active elements among the removed objects, Q1)
    const gone = w.active.filter(o => removed.includes(o));
    if (gone.length) { subTask(app, 'DeactivateElements', gone.map(o => o.name)); w.active = w.active.filter(o => !gone.includes(o)); }
  });
  S.postSelection.push(post);
  if (post) nyaB19d(app, cmd, 'what the post-selection script run by the set-selection helper does (SupportPostSelectionScript)');
  setStatus(app, cmd, changed ? S_OK : S_NOTHING_CHANGED);
}

// ------------------------------------------------------------------ Select*Filter (section 3.5)
function selectFilterCmd(app: App, cmd: string, a: Record<string, any>): void {
  const f = parseFilter(app, a.SelFilter);
  if (!f) { setStatus(app, cmd, S_FALSE); return; }
  const deselect = unset(a.DeselectOnNewFilter) ? false : boolOf(a.DeselectOnNewFilter);
  setFilterTask(app, cmd, f, deselect);
  setStatus(app, cmd, S_OK);
}

// ------------------------------------------------------------------ Activate...SelTool (section 3.6)
const takeCtx = (app: App, args: Record<string, any>): ToolExecContext => {
  const A = app as any; const c = A.toolExecContext; A.toolExecContext = undefined;
  return { A: Number(c?.A) || 0, B: Number(c?.B) || 0, args };
};
/** Tool class e9cdd760: registered once; its body is the selection tool's (inferred, Q2). */
function ensureComponentSelectClass(app: App) {
  const tm = toolManagerOf(app) as any;
  if (tm.classes?.has?.(COMPONENT_SELECT_TOOL)) return;
  const vt = () => (window as any).__tool as { mode: string; setMode(m: string): void } | undefined;
  tm.addClass({ clsid: COMPONENT_SELECT_TOOL, label: 'Component Select Tool', on() { if (app.activeTool) app.setTool(null); (window as any).__navTool?.set(null); vt()?.setMode('select'); }, off() { /* the select mode stays */ }, live: () => !vt() || vt()!.mode === 'select' });
}
function activateSelTool(app: App, cmd: string, a: Record<string, any>): void {
  const tm = toolManagerOf(app);
  const ctx = takeCtx(app, a);
  const S = b19d(app);
  // UnPackArg
  const f = unset(a.SelFilter) ? null : parseFilter(app, a.SelFilter);
  const pickSessionCurrent = tm.isCurrent(CLS.pickSession) === 0;
  const deselect = !pickSessionCurrent && !unset(a.DeselectOnNewFilter) && boolOf(a.DeselectOnNewFilter); // forced false during a pick session
  const hasGroup = !unset(a.GroupMode);
  let region: number | null = null;
  if (!unset(a.SelRegionMode)) {
    region = Number(a.SelRegionMode);
    if (!Number.isInteger(region) || region < 1 || region > 6) throw fail(cmd, E_INVALIDARG, `SelRegionMode ${JSON.stringify(a.SelRegionMode)} is not 1..6`);
    if (region > 2) nyaB19d(app, cmd, `the meaning of SelRegionMode ${region} (1 rectangle, 2 raycast are named); the ambient value is written`);
  }
  const held = !!(ctx.A & KEY);
  const keyDown = !!(ctx.A & KEY_DOWN);
  const repeat = !!(ctx.A & REPEAT);
  if (held && !keyDown) {
    // key released: the temporary activation ends, SI3D_GROUP_SEL_MODE comes back (module globals)
    if (S.supraGroupSelMode !== null) { setGroupSelMode(app, S.supraGroupSelMode); S.supraGroupSelMode = null; }
    tm.activateTool(chooseTool(app, cmd, f), ctx);
    setStatus(app, cmd, S_FALSE);
    return;
  }
  let filterChanged = false;
  if (!(held && repeat)) {
    if (held) S.supraGroupSelMode = groupSelMode(app);
    // 1. the set-filter task as an undoable sub-task (kept only when it changed something); a key-held call records nothing
    if (f) filterChanged = setFilterTask(app, cmd, f, deselect, !held);
    // 2. / 3. ambient values, written when different
    if (hasGroup && groupSelMode(app) !== boolOf(a.GroupMode)) setGroupSelMode(app, boolOf(a.GroupMode));
    if (region !== null && rectSelRegionMode(app) !== region) prefsBag(app).SI3D_RECTSEL_REGION_MODE = region;
  }
  // 4. / 5. choose the tool and activate it through the activate-tool task unless it is current
  const tool = chooseTool(app, cmd, f);
  if (tm.isCurrent(tool) !== 0) { subTask(app, 'ActivateTool', tool); tm.activateTool(tool, ctx); }
  app.events.emit('selection');
  // CMD-B20c Q41: S_OK only when the filter step reported a change; otherwise the exec context is asked "do not
  // record" (value 2) and the command returns S_FALSE, for normal calls too
  if (filterChanged) { setStatus(app, cmd, S_OK); return; }
  S.doNotRecord.push(cmd);
  nya20(app, cmd, 'whether the exec context\'s "do not record" also suppresses the script log line; the line is logged');
  setStatus(app, cmd, S_FALSE);
}
/**
 * Tool chooser 0x18000e0a0 (CMD-B20c Q36): the effective filter is SelFilter or the current filter; a component filter
 * whose families derive from the component family root {0F47FE72-D0E9-11D2-B7F9-00A0243E3694} activates
 * {E9CDD760-D183-11D2-8BCF-00AA006130EF}, anything else the selection tool {11778840-8C5C-11D1-84B5-00AA00135F7B}.
 * inferred: every sub-component filter of this build (point, edge, polygon, sampled point, hair tip) derives from it.
 */
function chooseTool(app: App, _cmd: string, f: Filter | null): string {
  const eff = f ?? currentFilter(app);
  ensureComponentSelectClass(app);
  return eff.component ? COMPONENT_SELECT_TOOL : SELECT_TOOL;
}

// ------------------------------------------------------------------ playback transport (mcp.dll, section 3.7)
function readPref(app: App, path: string, d: any): any {
  const bag = (app as any).prefValues ?? {}; const want = path.toLowerCase();
  const key = Object.keys(bag).find(k => k.toLowerCase() === want || k.toLowerCase() === 'preferences.' + want);
  if (key !== undefined) return bag[key];
  const [cat, name] = path.split('.');
  const v = (window as any).__prefSets?.get?.(cat === 'Interaction' ? 'C3DPrefsInteraction' : cat)?.val?.(name);
  return v === undefined || v === null ? d : v;
}
export function writePref(app: App, path: string, v: any) {
  const bag: Record<string, any> = ((app as any).prefValues ??= {});
  const key = Object.keys(bag).find(k => k.toLowerCase() === path.toLowerCase()) ?? path;
  bag[key] = v;
}
const playerState = (app: App): PlayerState => { const P = app.anim; return { frame: P.frame, dir: P.dir, playing: P.playing, mode: P.playMode ? { ...P.playMode } : null }; };
function restorePlayer(app: App, s: PlayerState) {
  const P = app.anim; P.stop(); P.dir = s.dir; P.frame = s.frame;
  if (s.playing) P.play(s.mode ?? undefined);
  app.events.emit('frame');
}
/** One transport type on the main timeline player. */
export function transportType(app: App, type: number) {
  const P = app.anim;
  const start = P.startFrame, end = P.endFrame; // the player's current range
  const ranged = P.loopMode === 'loop';          // inferred: the range flag = looping over the range (Q4)
  const step = Math.abs(P.frameStep || 1);
  const stopped = !P.playing;
  const every = { realtime: false, speed: 1 };   // play mode 2: every frame
  const realTime = () => {
    if (P.frame >= end) P.frame = start;
    const rate = Number(readPref(app, 'Interaction.realtimeplaybackrate', 100));
    P.play(rate !== 100 && Number.isFinite(rate) ? { realtime: true, speed: rate * 0.01 } : { realtime: true, speed: 1 });
  };
  switch (type) {
    case 0: if (ranged && P.frame >= end) P.frame = start; else P.frame = P.frame + step; break;
    case 1: if (ranged && P.frame <= start) P.frame = end; else P.frame = P.frame - step; break;
    case 2: if (Number.isFinite(start)) P.frame = start; break;
    case 3: if (Number.isFinite(end)) P.frame = end; break;
    case 4:
      if (stopped) { if ((P.frame <= start && P.dir < 0) || (P.frame >= end && P.dir > 0)) P.dir = -P.dir; P.play(every); }
      else { P.stop(); P.dir = -P.dir; P.play(every); }
      break;
    case 5: if (stopped) realTime(); else P.stop(); break;
    case 6: P.stop(); break;
    case 7: if (stopped) { P.dir = 1; if (P.frame >= end) P.frame = start; P.play(every); } else P.stop(); break;
    case 8: if (stopped) { P.dir = -1; if (P.frame <= start) P.frame = end; P.play(every); } else P.stop(); break;
    case 9: if (stopped) { P.frame = start; realTime(); } else P.stop(); break;
    case 10: if (stopped) { P.dir = 1; P.frame = start; P.play(every); } else P.stop(); break;
    case 11: if (stopped) { P.dir = -1; P.frame = end; P.play(every); } else P.stop(); break;
    default: break;
  }
  app.events.emit('frame');
}
function transportCmd(app: App, cmd: string, a: Record<string, any>): void {
  // UnPackArg: Type / Transport only taken as unsigned integers
  const uint = (v: any) => typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  const type = uint(a.Type); const transport = uint(a.Transport) ?? 0;
  if (transport !== 0) {
    nyaB19d(app, cmd, `the sequence player (Transport ${transport}): this build has no sequencer, so the player is missing and nothing is done`);
    setStatus(app, cmd, S_OK); return;
  }
  if (type === null) { setStatus(app, cmd, S_OK); return; }
  const saved = playerState(app); // first execution: the full player state, for Undo
  app.record(cmd, () => transportType(app, type), () => restorePlayer(app, saved));
  setStatus(app, cmd, S_OK);
}

// ------------------------------------------------------------------ vm.dll view commands (sections 3.4, 3.8, 3.9)
function centreView(vp: VP, c: THREE.Vector3) {
  const cam = vp.camera as any;
  if (vp.kind === 'ortho') { const dir = cam.getWorldDirection(new THREE.Vector3()); const v = c.clone().sub(cam.position); cam.position.add(v.sub(dir.multiplyScalar(v.dot(dir)))); }
  else { const t: THREE.Vector3 | undefined = vm()?.orbitTarget?.(); const d = cam.position.clone().sub(t ?? c); t?.copy(c); cam.position.copy(c).add(d); cam.lookAt(c); }
  cam.updateMatrixWorld();
}
function centreOf(objs: X3DObject[]): THREE.Vector3 | null {
  if (!objs.length) return null;
  const box = new THREE.Box3();
  for (const o of objs) {
    const M = o.globalMatrix(); const pos: ArrayLike<number> | undefined = meshOf(o)?.positions;
    if (pos && pos.length) for (let k = 0; k < pos.length; k += 3) box.expandByPoint(new THREE.Vector3(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(M));
    else box.expandByPoint(new THREE.Vector3().setFromMatrixPosition(M));
  }
  return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
}
const frameTargets = (app: App): X3DObject[] => uniq([...app.selectedObjects, ...activeList(app)]);
function centerSelection(app: App, a: Record<string, any>) {
  const all = viewports();
  const objs = boolOf(a.AllObjects) ? [...app.scene.allObjects()].filter(o => o !== app.scene.root && o.visible) : frameTargets(app);
  const c = centreOf(objs);
  if (boolOf(a.AllViews, true)) {
    all.forEach((vp, k) => { b10(app).camLabels.push({ view: k, label: 'Center' }); if (c) centreView(vp, c); });
  } else {
    const i = viewAt(a.View); if (i < 0) return;
    camChange(app, i, 'Center'); // the per-view camera history
    if (c) centreView(all[i], c);
  }
  vm()?.redraw?.();
}
function frameContextual(app: App, a: Record<string, any>) {
  const all = viewports();
  const some = app.selection.length > 0 || activeList(app).length > 0;
  const objs = some ? frameTargets(app) : [...app.scene.allObjects()].filter(o => o !== app.scene.root && o.visible); // inferred: hidden objects are not framed
  if (boolOf(a.AllViews, true)) all.forEach((vp, k) => { b10(app).camLabels.push({ view: k, label: 'Frame' }); frameView(vp, objs); });
  else { const i = viewAt(a.View); if (i < 0) return; camChange(app, i, 'Frame'); frameView(all[i], objs); }
  vm()?.redraw?.();
}
/** Isolation candidates: groups by their members (recursively), anything else by its 3D object. */
function isolationCandidates(app: App, items: Node[]): X3DObject[] {
  const out: X3DObject[] = []; const seen = new Set<Node>();
  const walk = (n: Node) => {
    if (seen.has(n)) return; seen.add(n);
    if (isGroupLike(n)) { for (const m of membersOf(n)) walk(m); return; }
    const o = n instanceof X3DObject ? n : (n as any).obj instanceof X3DObject ? (n as any).obj : null;
    if (o && !out.includes(o)) out.push(o);
  };
  for (const n of items) walk(n);
  return out;
}
function isolateCmd(app: App, cmd: string, a: Record<string, any>) {
  const all = typeof a.All === 'boolean' ? a.All : false;
  const view = typeof a.View === 'number' && Number.isInteger(a.View) ? a.View : -1;
  const mode = typeof a.Mode === 'number' && Number.isInteger(a.Mode) ? a.Mode : 0;
  const V = vm(); const vps = viewports();
  const i = view === -1 ? (V ? vps.indexOf(V.active()) : -1) : view;
  if (i < 0 || i > 3 || !vps[i]) throw fail(cmd, E_INVALIDARG, `View ${view} is not a 3D view`);
  const vp = vps[i]; const x = vp.x;
  if (!x) throw fail(cmd, E_POINTER, `view ${i} has no display object`);
  const prev: Set<X3DObject> | null = x.isolate && x.isolate.size ? new Set(x.isolate) : null; // kept for undo
  let next: Set<X3DObject> | null;
  if (all) next = null;
  else {
    let cand = isolationCandidates(app, app.selection);
    if (!cand.length) cand = isolationCandidates(app, app.activeElements);
    if (mode === 0) next = new Set(cand);
    else if (prev) {
      next = new Set(prev);
      for (const o of cand) { if (mode === 1) next.add(o); else if (mode === 2) next.delete(o); else if (mode === 3) { if (next.has(o)) next.delete(o); else next.add(o); } }
      if (mode > 3) nyaB19d(app, cmd, `isolation Mode ${mode}; the list is kept`);
    } else next = mode === 2 ? null : mode === 1 || mode === 3 ? new Set(cand) : (nyaB19d(app, cmd, `isolation Mode ${mode} without an isolation list; isolation is cleared`), null);
    if (next && !next.size) next = null; // an empty result clears isolation
  }
  const setIso = (s: Set<X3DObject> | null) => { x.isolate = s ? new Set(s) : null; vm()?.redraw?.(); };
  app.record(cmd, () => setIso(next), () => setIso(prev));
  setStatus(app, cmd, S_OK);
}

// ------------------------------------------------------------------ SwitchToolbar (section 3.10)
const MODULES: App['module'][] = ['Model', 'Animate', 'Render', 'ICE', 'Simulate', 'Hair']; // SIAppModules 0..5 (inferred order from the registry Targets)
function switchToolbar(app: App, a: Record<string, any>): void {
  const t = Number(a.Target);
  const idx = Number.isInteger(t) ? t - 1 : -1;
  if (idx < 0 || idx >= MODULES.length) return; // not a valid module: nothing
  app.module = MODULES[idx]; app.events.emit('module');
}

// ------------------------------------------------------------------ ShowFaceRobotActPanel (section 3.12)
function resolveFrPath(app: App, p: string): string | null {
  let ok = true;
  const env: Record<string, string> = (b18a(app).env as any) ?? {};
  const look = (n: string) => { const k = Object.keys(env).find(x => x.toLowerCase() === n.toLowerCase()); const v = k ? env[k] : undefined; if (!v) ok = false; return v ?? ''; };
  const out = p.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, n) => look(n)).replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_m, n) => look(n));
  return ok && out.trim() ? out : null;
}
function ensureActPanelTool(app: App) {
  const tm = toolManagerOf(app) as any;
  if (tm.classes?.has?.(FR_ACT_TOOL)) return;
  tm.addClass({
    clsid: FR_ACT_TOOL, label: 'Face Robot Act Panel Tool',
    on() {
      const P = b19d(app).actPanel;
      nyaB19d(app, 'ShowFaceRobotActPanel', `what tool {1E0A3AAB-05DA-4716-9E7C-05FFE14242C9} shows; the floating synoptic panel "${FR_PANEL_VIEW}" is opened at offset ${P?.offsetX},${P?.offsetY}`);
      (app as any).__faceRobotActArgs = { Path: P?.path, OffsetX: P?.offsetX, OffsetY: P?.offsetY };
      window.dispatchEvent(new CustomEvent('openview', { detail: { name: FR_PANEL_VIEW } }));
    },
    off() { /* the panel stays open */ },
    live: () => false, // inferred: a one-shot tool, the channel goes back to the selection / SRT tool
  });
}
function showFaceRobotActPanel(app: App, cmd: string, a: Record<string, any>): void {
  const ctx = takeCtx(app, a);
  const raw = unset(a.Path) ? '' : String(a.Path);
  if (!raw) throw fail(cmd, E_UNEXPECTED, 'Path is empty');
  const path = resolveFrPath(app, raw);
  if (!path) throw fail(cmd, E_UNEXPECTED, `Path ${JSON.stringify(raw)} cannot be resolved`);
  const num = (v: any, d: number) => { const n = Number(v); return unset(v) || !Number.isFinite(n) ? d : Math.trunc(n); };
  b19d(app).actPanel = { path, offsetX: num(a.OffsetX, 0), offsetY: num(a.OffsetY, 0) };
  ensureActPanelTool(app);
  toolManagerOf(app).activateTool(FR_ACT_TOOL, ctx);
  setStatus(app, cmd, S_FALSE);
}

// ------------------------------------------------------------------ registration
type Arg = [string, any];
interface Row { name: string; label: string; category: string; description: string; args: Arg[]; undoable: boolean; run: (app: App, a: Record<string, any>) => any }
const SELF = (n: string) => `${FILTER_GUID}:${n}`;
const TOOL_ROWS: [name: string, label: string, filter: string | null, deselect: boolean, third: Arg | Arg[] | null, description: string][] = [
  ['ActivatePolygonSelTool', 'Polygon Select Tool', 'polygon', true, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Polygon, and selects previously tagged polygons'],
  ['ActivatePolygonSelToolWithNoObjStateChange', 'Polygon Select Tool (Extended Selection)', 'polygon', false, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Polygon, and adds previously tagged polygons to selection'],
  ['ActivateRaycastPolySelTool', 'Raycast Polygon Select Tool', 'polygon', true, ['SelRegionMode', 2], 'Activates the Raycast Select tool, sets the filter to Polygon, and selects previously tagged polygons'],
  ['ActivateRaycastPolySelToolWithNoObjStateChange', 'Raycast Polygon Select Tool (Extended Selection)', 'polygon', false, ['SelRegionMode', 2], 'Activates the Raycast Select tool, sets the filter to Polygon, and adds previously tagged polygons to selection'],
  ['ActivateVertexSelTool', 'Point Select Tool', 'vertex', true, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Point, and selects previously tagged points'],
  ['ActivateVertexSelToolWithNoObjStateChange', 'Point Select Tool (Extended Selection)', 'vertex', false, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Point, and adds previously tagged points to selection'],
  ['ActivateEdgeSelTool', 'Edge Select Tool', 'edge', true, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Edge, and selects previously tagged edges'],
  ['ActivateEdgeSelToolWithNoObjStateChange', 'Edge Select Tool (Extended Selection)', 'edge', false, ['SelRegionMode', 1], 'Activates the Rectangle Select tool, sets the filter to Edge, and adds previously tagged edges to selection'],
  ['ActivateRaycastEdgeSelTool', 'Raycast Edge Select Tool', 'edge', true, ['SelRegionMode', 2], 'Activates the Raycast Select tool, sets the filter to Edge, and selects previously tagged edges'],
  ['ActivateRaycastEdgeSelToolWithNoObjStateChange', 'Raycast Edge Select Tool (Extended Selection)', 'edge', false, ['SelRegionMode', 2], 'Activates the Raycast Select tool, sets the filter to Edge, and adds previously tagged edges to selection'],
  ['ActivateTipSelTool', 'Hair Tip Select Tool', 'tip', true, ['SelRegionMode', 1], 'Activates the Rectangle Select tool and sets the filter to Hair Tip'],
  ['ActivateObjectSelToolWithNoObjStateChange', 'Object Select Tool (Extended Selection)', 'object_only_if_current_is_subcomponent_one', false, ['GroupMode', false], 'Activates the Select tool and sets the filter to Object without changing the object selection'],
  // CMD-B20c item 14: same class d9eb4110; registry 1214 (SelFilter, DeselectOnNewFilter true, GroupMode false, SelRegionMode 1)
  ['ActivateObjectSelTool', 'Object Select Tool', 'object_only_if_current_is_subcomponent_one', true, [['GroupMode', false], ['SelRegionMode', 1]], 'Activates the Rectangle Select tool and sets the filter to Object'],
];
const TRANSPORT_ROWS: [name: string, label: string, type: number, description: string][] = [
  // CMD-B20c Q46: the five below share handler 9ff65990 and transport worker 0x18003d7f0 with the rest
  ['NextFrame', 'Next Frame', 0, 'Go to next frame'],
  ['FirstFrame', 'First Frame', 2, 'Go to first frame'],
  ['LastFrame', 'Last Frame', 3, 'Go to last frame'],
  ['PlayForwards', 'Play Forwards', 7, 'Play forwards frame by frame'],
  ['PlayForwardsFromStart', 'Play Forwards From Start', 10, 'Play forwards frame by frame from the start'],
  ['PrevFrame', 'Previous Frame', 1, 'Go to previous frame'],
  ['PlayFrame', 'Play/Reverse Play', 4, 'Start playing animation or reverse direction of playing '],
  ['PlayRealTime', 'Play in Real Time', 5, 'Start playing in real time'],
  ['PlaybackStop', 'Stop', 6, 'Stop playback'],
  ['PlayBackwards', 'Play Backwards', 8, 'Play backwards frame by frame'],
  ['PlayRealTimeFromStart', 'Play in Real Time From Start', 9, 'Start playing in real time from the start'],
  ['PlayBackwardsFromEnd', 'Play Backwards From End', 11, 'Play backwards frame by frame from end'],
];
const FILTER_ROWS: [name: string, label: string, filter: string][] = [
  ['SelectObjectFilter', 'Set Filter to Object', 'object'], ['SelectVertexFilter', 'Set Filter to Point', 'vertex'],
  ['SelectPolygonFilter', 'Set Filter to Polygon', 'polygon'], ['SelectEdgeFilter', 'Set Filter to Edge', 'edge'],
  ['SelectSampledPointFilter', 'Set Filter to SampledPoint', 'SampledPoint'],
];
const ISOLATE_ROWS: [name: string, label: string, args: Arg[], description: string][] = [
  ['IsolateSelected', 'Isolate Selected', [['All', false], ['View', -1]], 'Isolate selected objects'],
  ['IsolateAddSelected', 'Isolate Add Selected', [['All', false], ['View', -1], ['Mode', 1]], 'Isolate add selected objects'],
  ['IsolateRemoveSelected', 'Isolate Remove Selected', [['All', false], ['View', -1], ['Mode', 2]], 'Isolate remove selected objects'],
  ['IsolateToggleSelected', 'Isolate Toggle Selected', [['All', false], ['View', -1], ['Mode', 3]], 'Isolate toggle selected objects'],
  ['IsolateAll', 'Isolate All', [['All', true], ['View', -1]], 'Isolate all objects'],
];

export const B19D_ROWS: Row[] = [
  { name: 'SelectAll', label: 'Select All Objects', category: 'Selection', description: '', undoable: true,
    args: [['SelFilter', SELF('object')], ['AffectSelectionList', true], ['CheckObjectSelectability', false]], run: (app, a) => selectAll(app, 'SelectAll', a) },
  { name: 'SelectAllUsingFilter', label: 'Select All Using Filter', category: 'Selection', description: '', undoable: true,
    args: [['SelFilter', null], ['CheckComponentVisibility', ':siIgnoreComponentVisibility:siComponentVisibilityMode'], ['AffectSelectionList', true], ['CheckObjectSelectability', false]],
    run: (app, a) => selectAll(app, 'SelectAllUsingFilter', a) },
  { name: 'SelectMembers', label: 'Select Members/Components', category: 'Selection', description: '', undoable: true,
    args: [['SelectionList', null], ['AffectSelectionList', true], ['CheckObjectSelectability', false]], run: (app, a) => selectMembers(app, 'SelectMembers', a) },
  { name: 'SetAndToggleSelection', label: 'Set And Toggle Selection', category: 'Selection', description: '', undoable: true,
    args: [['SelectionList', null], ['HierarchyLevel', '{0907F360-B147-11d2-8BC8-00AA006130EF}:ASITIS'], ['SupportPostSelectionScript', false], ['CheckObjectSelectability', false]],
    run: (app, a) => setAndToggleSelection(app, 'SetAndToggleSelection', a) },
  ...FILTER_ROWS.map(([name, label, filter]): Row => ({ name, label, category: 'Selection', description: `Select ${filter === 'vertex' ? 'Point' : filter === 'object' ? 'Object' : filter === 'polygon' ? 'Polygon' : filter === 'edge' ? 'Edge' : filter} as the current filter`, undoable: true,
    args: [['SelFilter', SELF(filter)], ['DeselectOnNewFilter', true]], run: (app, a) => selectFilterCmd(app, name, a) })),
  ...TOOL_ROWS.map(([name, label, filter, deselect, third, description]): Row => ({ name, label, category: 'Selection', description, undoable: true,
    args: [['SelFilter', SELF(filter!)], ['DeselectOnNewFilter', deselect], ...(!third ? [] : Array.isArray(third[0]) ? third as Arg[] : [third as Arg])], run: (app, a) => activateSelTool(app, name, a) })),
  { name: 'ActivateSelectTool', label: 'Select Tool', category: 'Selection', description: 'Activate the Select tool', undoable: true, args: [], run: (app, a) => activateSelTool(app, 'ActivateSelectTool', a) },
  ...TRANSPORT_ROWS.map(([name, label, type, description]): Row => ({ name, label, category: 'Transport Control', description, undoable: true,
    args: [['Type', type], ['Transport', 0]], run: (app, a) => transportCmd(app, name, a) })),
  { name: 'FrameContextual', label: 'Frame Contextual (All 3D Views)', category: 'Viewing', description: 'Frame selection or all objects (if nothing is selected) in all views', undoable: false,
    args: [['AllViews', true], ['View', -1]], run: (app, a) => frameContextual(app, a) },
  { name: 'CenterSelection', label: 'Center Selection (All 3D Views)', category: 'Viewing', description: 'Center selection in all views', undoable: false,
    args: [['AllObjects', false], ['AllViews', true], ['View', -1]], run: (app, a) => centerSelection(app, a) },
  ...ISOLATE_ROWS.map(([name, label, args, description]): Row => ({ name, label, category: 'Viewing', description, undoable: true, args, run: (app, a) => isolateCmd(app, name, a) })),
  { name: 'SwitchToolbar', label: 'Switch to Model Toolbar', category: 'Toolbar', description: '', undoable: false, args: [['Target', 1]], run: (app, a) => switchToolbar(app, a) },
  { name: 'ShowFaceRobotActPanel', label: 'Face Robot Act Floating Panel', category: '', description: 'Opens the face robot contextual synoptic view', undoable: false,
    args: [['Path', '$FACEROBOTROOT\\Application\\views\\synoptic\\FaceRobotContext.htm'], ['OffsetX', 3], ['OffsetY', 335]], run: (app, a) => showFaceRobotActPanel(app, 'ShowFaceRobotActPanel', a) },
];

export function registerSelectionB19dCommands(app: App) {
  for (const r of B19D_ROWS) {
    const def: CommandDef = {
      name: r.name, label: r.label, category: r.category, description: r.description, undoable: r.undoable,
      args: r.args.map(([name, d]) => ({ name, default: d })),
      execute: (app2, a) => { const v = r.run(app2, a); return v === undefined ? undefined : v; },
    };
    app.register(def);
  }
  // the selection manager drops active elements that leave the scene (inferred)
  app.events.on('scene', () => { if (app.activeElements.length) { const keep = app.activeElements.filter(o => inScene(app, o)); if (keep.length !== app.activeElements.length) app.activeElements = keep; } });
  (app as any).selB19dApi = { transportType: (t: number) => transportType(app, t), currentFilter: () => currentFilter(app), activeList: () => activeList(app), groupSelMode: () => groupSelMode(app), rectSelRegionMode: () => rectSelRegionMode(app) };
}
