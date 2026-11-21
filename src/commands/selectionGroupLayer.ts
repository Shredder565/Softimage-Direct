// Selection / Group / Layer command families (registry categories "Selection", "Group", "Layer").
//
// INFERRED BATCH: there is no analyst note for these commands. Everything here is reasoned from
//  - data/commands_full.json (scripting names, argument names / order / defaults, descriptions, return_value),
//  - the publicly documented scripting semantics of these long-standing Softimage commands,
//  - how the related commands already on the bus behave (SelectObj, DeselectAll, SelectAll, SelectChildNodes,
//    CreateGroup, CreateLayer, MoveToLayer, SetCurrentLayer, the Activate...SelTool family, the MCP filter box).
// Every register call below therefore carries an `// inferred` comment. Original code only.
// CMD-B17a replaced the inferred GrowSelection, ShrinkSelection, SelectAdjacent, ConvertSelection*, SelectNSidedPolygons,
// GetNeighborSubcomponents, Select*EdgeLoop, SICreateLayerFromSelection* and ToggleGhosting (selectionLayersB17a.ts).
// CMD-B19b replaced the inferred SelectAllConnectedComponents, SelectAllComponentLoops, Grow/ShrinkSelectedLoops,
// SelectPolygonOutline, DeselectAllUsingFilter, SICreateLayer[2], MoveObjectToLayer, CreateLayerGroup and CutLayerParent
// (tasksB19b.ts). LayerGroup below is no longer created by any command (a layer group is a layer holding layers).
//
// Conventions taken from the existing code:
//  - branch selection is represented as the node plus all of its descendants in app.selection (keymap `hier`,
//    SelectChildNodes); there is no separate branch flag;
//  - pure selection changes are not undoable (SelectObj / DeselectAll / SelectAll are `undoable: false`);
//  - group and layer membership changes go through app.record;
//  - component selection is one object + one kind (app.compSel); edges are "a-b" vertex-pair keys and the edge
//    index used in "obj.edge[i]" strings is the position in core/topology meshEdges().
// Where the registry has several entries with one scripting name (menu overloads: SelectNeighborObj,
// SelectAdjacent, SelectNSidedPolygons, SelectAllComponentLoops, SelectAllUsingFilter) the command is registered
// once with the first / generic entry's argument list.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model, Group, Layer, Cluster } from '../core/scene';
import { ChainRoot, Bone, Effector } from '../core/scene2';
import type { CompKind } from '../core/topology';
import { NotYetAttested } from './fbx';
import * as T from './selectionGroupLayerTopology';
import type { CompItem } from './selectionGroupLayerTopology';

const SOURCE = 'inferred batch: Selection / Group / Layer, no analyst note';

/** NotYetAttested for this batch (the base class cites the FBX note; this one cites the inferred batch). */
class Unattested extends NotYetAttested {
  constructor(command: string, what: string) {
    super(command, what, '');
    this.message = `not yet attested: ${what} (${command}; ${SOURCE})`;
  }
}

// ------------------------------------------------------------------ layer groups (helper model)

/** A layer group: a named container of layers (and of other layer groups). Kept in `scene.layerGroups`. */
export class LayerGroup extends Node {
  readonly layers: Layer[] = [];
  parentGroup: LayerGroup | null = null;
  constructor(name: string) { super(name, 'layergroup', 'folder', []); }
  explorerChildren(): Node[] { return [...this.layers]; }
}
const layerGroups = (app: App): LayerGroup[] => ((app.scene as any).layerGroups ??= []);

// ------------------------------------------------------------------ argument resolution

export interface CompRef { obj: X3DObject; kind: CompKind; items: CompItem[]; }
export interface Resolved { nodes: Node[]; comps: CompRef[]; }

const KIND_TOKEN: Record<string, CompKind> = { pnt: 'point', edge: 'edge', poly: 'polygon' };
const TOKEN_OF: Record<CompKind, string> = { point: 'pnt', edge: 'edge', polygon: 'poly' };
const FILTER_LABEL: Record<CompKind | 'object', string> = { object: 'Object', point: 'Point', edge: 'Edge', polygon: 'Polygon' };

const empty = (v: any) => v === undefined || v === null || v === '';
const isTrue = (v: any) => v === true || v === 1 || (typeof v === 'string' && /^(true|1)$/i.test(v));
const meshOf = (o: X3DObject | null | undefined) => o?.primitive?.mesh() ?? null;

function splitList(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const byName = <N extends Node>(list: N[], name: string): N | undefined => list.find(n => n.name === name || n.fullName === name || n.fullName.endsWith('.' + name));

function findObject(app: App, name: string): X3DObject | undefined {
  if (name === app.scene.root.name || name === app.scene.root.fullName) return app.scene.root;
  return app.scene.find(name);
}

function parseIndices(text: string, count: number): number[] {
  const out = new Set<number>();
  for (const part of text.split(',').map(s => s.trim()).filter(Boolean)) {
    if (part === '*') { for (let i = 0; i < count; i++) out.add(i); continue; }
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) if (i < count) out.add(i); }
    else if (/^\d+$/.test(part) && Number(part) < count) out.add(Number(part));
  }
  return [...out];
}

/** Resolve a SelectionList / InputObjs argument: nodes, node names, wildcards and "obj.pnt[..]" component strings. */
export function resolve(app: App, arg: any): Resolved {
  const res: Resolved = { nodes: [], comps: [] };
  if (empty(arg)) return res;
  const tokens: any[] = Array.isArray(arg) ? arg.flatMap(x => typeof x === 'string' ? splitList(x) : [x]) : typeof arg === 'string' ? splitList(arg) : [arg];
  for (const tk of tokens) {
    if (tk instanceof Node) { if (!res.nodes.includes(tk)) res.nodes.push(tk); continue; }
    const s = String(tk);
    const cm = /^(.+?)\.(pnt|edge|poly)\[(.*)\]$/.exec(s);
    if (cm) {
      const obj = findObject(app, cm[1]); const m = meshOf(obj); if (!obj || !m) continue;
      const kind = KIND_TOKEN[cm[2]]; const adj = T.adjacencyOf(m);
      const all = T.allItems(adj, kind);
      res.comps.push({ obj, kind, items: parseIndices(cm[3], all.length).map(i => all[i]) });
      continue;
    }
    const found: Node | undefined = findObject(app, s) ?? byName(app.scene.groupList, s) ?? byName(app.scene.layers, s) ?? byName(layerGroups(app), s) ?? findCluster(app, s);
    if (found) { if (!res.nodes.includes(found)) res.nodes.push(found); continue; }
    if (s.includes('*')) {
      const re = new RegExp('^' + s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      for (const o of app.scene.allObjects()) if (re.test(o.name) && !res.nodes.includes(o)) res.nodes.push(o);
    }
  }
  return res;
}
function findCluster(app: App, s: string): Cluster | undefined {
  for (const o of app.scene.allObjects()) for (const c of o.clusters) if (c.name === s || c.fullName === s || s === `${o.name}.${c.name}` || (s.startsWith(o.name + '.') && s.endsWith('.cls.' + c.name))) return c;
  return undefined;
}
const objectsOf = (r: Resolved) => r.nodes.filter((n): n is X3DObject => n instanceof X3DObject);

const selectable = (n: Node) => !(n instanceof X3DObject) || n.property('visibility')?.val('selectability') !== false;
const checkSelectable = (nodes: Node[], check: any) => isTrue(check) ? nodes.filter(selectable) : nodes;

const branch = (o: X3DObject): X3DObject[] => [o, ...o.descendants()];
const uniq = <N>(list: N[]): N[] => [...new Set(list)];

/** Apply a HierarchyLevel to a list of nodes (non-objects pass through unchanged). */
function atLevel(app: App, nodes: Node[], level: any, command: string): Node[] {
  const lv = String(level ?? 'ASITIS').toUpperCase();
  if (lv === 'ASITIS' || lv === 'NODE' || lv === 'NODE OR BRANCH' || lv === '') return nodes;
  const expand = (f: (o: X3DObject) => X3DObject[]) => uniq(nodes.flatMap(n => n instanceof X3DObject ? f(n) : [n]));
  if (lv === 'BRANCH') return expand(branch);
  if (lv === 'TREE') return expand(o => branch(treeTop(app, o)));
  if (lv === 'MODEL') return expand(o => { const m = o.model; return m && m !== app.scene.root ? branch(m) : [o]; });
  throw new Unattested(command, `HierarchyLevel "${level}"`);
}
function treeTop(app: App, o: X3DObject): X3DObject { let t = o; while (t.parentObj && t.parentObj !== app.scene.root) t = t.parentObj; return t; }

// ------------------------------------------------------------------ component selection helpers


const currentSet = (app: App): Set<CompItem> => { const c = app.compSel!; return new Set<CompItem>(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons); };

function setComponents(app: App, obj: X3DObject, kind: CompKind, items: Iterable<CompItem>) {
  (app as any).selFilter = FILTER_LABEL[kind];
  app.setSelMode(kind);
  app.selectComponents(obj, kind, [...items], 'replace');
}
/** "obj.poly[0,2,5]" - the string form of a component set (edges by meshEdges index). */
export function compString(obj: X3DObject, adj: T.Adjacency, kind: CompKind, items: Iterable<CompItem>): string {
  const idx = [...items].map(it => kind === 'edge' ? adj.edgeIndex.get(it as string) ?? -1 : it as number).filter(i => i >= 0).sort((a, b) => a - b);
  return `${obj.name}.${TOKEN_OF[kind]}[${idx.join(',')}]`;
}

/** Normalise a selection-filter name to a component kind, 'object', 'sample', or null for other filters. */
export function filterKind(f: any): CompKind | 'object' | 'sample' | null {
  const s = String(f ?? '').trim().toLowerCase().replace(/[\s_]/g, '');
  if (s === 'object' || s === 'objects') return 'object';
  if (['point', 'points', 'vertex', 'vertices', 'pnt'].includes(s)) return 'point';
  if (['edge', 'edges'].includes(s)) return 'edge';
  if (['polygon', 'polygons', 'poly'].includes(s)) return 'polygon';
  if (['sampledpoint', 'sampledpoints', 'sample', 'samples', 'samplepoint'].includes(s)) return 'sample';
  return null;
}
const TYPE_ALIAS: Record<string, string> = { polygonmesh: 'polymsh', curve: 'crvlist', surfacemesh: 'surfmsh', effector: 'eff', chainroot: 'root', chainbone: 'bone', model: '#model' };
/** Object predicate for a non-component filter name, or null when the filter is not known here. */
export function objectFilter(app: App, f: any): ((o: X3DObject) => boolean) | null {
  const k = filterKind(f); if (k === 'object') return () => true; if (k) return null;
  const s = String(f).trim().toLowerCase().replace(/[\s_]/g, ''); const type = TYPE_ALIAS[s] ?? s;
  const known = ['polymsh', 'null', 'light', 'camera', 'crvlist', 'surfmsh', 'eff', 'root', 'bone', '#model', 'pointcloud'];
  if (!known.includes(type) && ![...app.scene.allObjects()].some(o => o.type.toLowerCase() === type)) return null;
  return o => o.type.toLowerCase() === type;
}
function setFilter(app: App, f: any, command: string): string {
  const A = app as any; const k = filterKind(f);
  if (k === 'object' || k === 'point' || k === 'edge' || k === 'polygon') { A.selFilter = FILTER_LABEL[k]; app.setSelMode(k); return A.selFilter; }
  if (k === 'sample') {
    // The MCP keeps non-mesh-component filters as a filter name with object picking (ui/mcp.ts filter box).
    A.selFilter = 'SampledPoint'; app.setSelMode('object');
    app.logMsg('info', `${command}: filter set to SampledPoint; not yet attested: sampled-point component picking (no sample component kind in the viewport)`);
    return A.selFilter;
  }
  A.selFilter = String(f); app.setSelMode('object'); app.logMsg('info', `Selection filter: ${f}`);
  return A.selFilter;
}

/** Add / toggle nodes in the selection list. Done here on a copy of the list and committed with a 'replace' select:
 *  App.select's own 'add' mode toggles when a node is already selected and its 'toggle' mode is a no-op
 *  (dangling else in core/commands.ts), and this batch does not edit core. */
function selectNodes(app: App, nodes: Node[], mode: 'replace' | 'add' | 'toggle') {
  if (mode === 'replace') { app.select(uniq(nodes)); return; }
  const list = [...app.selection];
  for (const n of uniq(nodes)) { const i = list.indexOf(n); if (i < 0) list.push(n); else if (mode === 'toggle') list.splice(i, 1); }
  app.select(list);
}

/** Keep run() from auto-inspecting the returned node (SI low-level variants and Get... queries do not inspect). */
function noInspect(app: App) { if (!app.autoInspect) return; app.autoInspect = false; queueMicrotask(() => { app.autoInspect = true; }); }

// ------------------------------------------------------------------ group / layer helpers

const asGroup = (app: App, v: any): Group | null => v instanceof Group ? v : typeof v === 'string' && v ? byName(app.scene.groupList, v) ?? null : null;
const currentLayer = (app: App): Layer => (app as any).currentLayer ?? app.scene.layers[0];

function uniqueName(app: App, base: string): string {
  const taken = new Set<string>([...app.scene.groupList.map(g => g.name), ...layerGroups(app).map(g => g.name)]);
  let name = app.scene.uniqueName(base); if (!taken.has(name)) return name;
  for (let i = 1; ; i++) { name = `${base}${i}`; if (!taken.has(name) && app.scene.uniqueName(name) === name) return name; }
}

function createGroup(app: App, name: string, parent: X3DObject, members: X3DObject[]): Group {
  const g = new Group(uniqueName(app, name || 'Group')); g.members.push(...uniq(members)); g.parent = parent;
  app.record('Create Group', () => { app.scene.groupList.push(g); }, () => { const i = app.scene.groupList.indexOf(g); if (i >= 0) app.scene.groupList.splice(i, 1); app.selection = app.selection.filter(n => n !== g); });
  return g;
}
function addMembers(app: App, g: Group, objs: X3DObject[]): X3DObject[] {
  const added = uniq(objs).filter(o => !g.members.includes(o)); if (!added.length) return added;
  app.record('Add to Group', () => { g.members.push(...added); }, () => { for (const o of added) { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); } });
  return added;
}
function removeMembers(app: App, g: Group, objs: X3DObject[]): X3DObject[] {
  const before = [...g.members]; const gone = before.filter(o => objs.includes(o)); if (!gone.length) return gone;
  app.record('Remove from Group', () => { g.members.splice(0, g.members.length, ...before.filter(o => !gone.includes(o))); }, () => { g.members.splice(0, g.members.length, ...before); });
  return gone;
}

// ------------------------------------------------------------------ registration

export function registerSelectionGroupLayerCommands(app: App) {
  const reg = (def: CommandDef) => { if (!app.commands.has(def.name)) app.register(def); };
  const sel = (name: string, label: string, args: CommandDef['args'], execute: CommandDef['execute'], description?: string) =>
    reg({ name, label, category: 'Selection', description, args, undoable: false, execute });

  // ================================================================ selection list

  /** Shared body of AddToSelection / RemoveFromSelection / ToggleSelection / SetAndToggleSelection. */
  const listOp = (command: string, mode: 'add' | 'remove' | 'toggle' | 'settoggle') => (app: App, a: Record<string, any>) => {
    const r = resolve(app, a.SelectionList);
    const before = [...app.selection];
    const hadComp = app.compSel ? { obj: app.compSel.obj, kind: app.compSel.kind, set: currentSet(app) } : null;
    const nodes = checkSelectable(atLevel(app, r.nodes, a.HierarchyLevel, command), a.CheckObjectSelectability);
    if (mode === 'add' || mode === 'toggle') selectNodes(app, nodes, mode);
    else if (mode === 'remove') { app.selection = app.selection.filter(n => !nodes.includes(n)); app.events.emit('selection'); }
    else app.select(nodes.filter(n => !before.includes(n)), 'replace');
    if (mode === 'settoggle' && !r.comps.length && app.compSel && !app.selection.includes(app.compSel.obj)) app.compSel = null;
    for (const c of r.comps) {
      const same = hadComp && hadComp.obj === c.obj && hadComp.kind === c.kind;
      if (mode === 'remove') { if (!same || !app.compSel) continue; const keep = [...currentSet(app)].filter(it => !c.items.includes(it)); app.selectComponents(c.obj, c.kind, keep, 'replace'); continue; }
      (app as any).selFilter = FILTER_LABEL[c.kind]; app.setSelMode(c.kind);
      if (mode === 'settoggle') app.selectComponents(c.obj, c.kind, c.items.filter(it => !(same && hadComp!.set.has(it))), 'replace');
      else app.selectComponents(c.obj, c.kind, c.items, mode);
    }
    if (mode === 'remove') return true;
  };
  const LIST_ARGS = [{ name: 'SelectionList', default: null }, { name: 'HierarchyLevel', default: 'ASITIS' }, { name: 'CheckObjectSelectability', default: false }];
  // inferred: adds the listed elements (at the given hierarchy level) to the selection list
  sel('AddToSelection', 'Add To Selection', LIST_ARGS, listOp('AddToSelection', 'add'));
  // inferred: removes the listed elements from the selection list; "NODE OR BRANCH" removes the node whichever way it is selected
  sel('RemoveFromSelection', 'Remove From Selection', [{ name: 'SelectionList', default: null }, { name: 'HierarchyLevel', default: 'NODE OR BRANCH' }], listOp('RemoveFromSelection', 'remove'));
  // inferred: toggles the listed elements in the selection list (registry display name "Extend And Toggle Selection")
  sel('ToggleSelection', 'Extend And Toggle Selection', LIST_ARGS, listOp('ToggleSelection', 'toggle'));
  // SetAndToggleSelection: CMD-B19d (selectionB19d.ts)

  // CMD-B19c (docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md, SelectBranch / SelectTree / SelectChain / SelectModel):
  // selectionmgr.dll serves the four names as the SelectObj class (79581ba0) with HierarchyLevel = BRANCH / TREE / CHAIN /
  // MODEL carried by the registry default, plus CheckObjectSelectability. The registry's hidden arguments SelectionList
  // (default: the selection) and HierarchyLevel follow the catalogue argument. The SelectObj UnPack of HierarchyLevel
  // was not read (Q5): the level is applied with this file's hierarchy rules and other levels log "not yet attested".
  const LEVEL_GUID = '{0907F360-B147-11d2-8BC8-00AA006130EF}:';
  const levelOf = (v: any, dflt: string) => { const s = String(empty(v) ? dflt : v).replace(/^\{[0-9a-f-]{36}\}:/i, '').trim().toUpperCase(); return s || dflt; };
  const reselect = (command: string, level: string, f: (o: X3DObject) => X3DObject[] | null) => (app: App, a: Record<string, any>) => {
    const given = !empty(a.SelectionList);
    const list = given ? resolve(app, a.SelectionList).nodes : [...app.selection];
    const lv = levelOf(a.HierarchyLevel, level);
    if (lv !== level) { app.logMsg('info', `${command}: not yet attested: HierarchyLevel "${lv}" on ${command} (SelectObj UnPack, CMD-B19c Q5); level ${level} used`); }
    const objs = list.filter((n): n is X3DObject => n instanceof X3DObject); if (!objs.length) return;
    const out: Node[] = [];
    for (const o of objs) { const r = f(o); if (r) out.push(...r); }
    if (!out.length) return;
    app.compSel = null; app.select(checkSelectable(uniq(out), a.CheckObjectSelectability));
  };
  const selArgs = (level: string) => [{ name: 'CheckObjectSelectability', default: null }, { name: 'SelectionList', default: null }, { name: 'HierarchyLevel', default: LEVEL_GUID + level }];
  // inferred: turns the selected objects into branch selections (node + descendants, the existing branch representation)
  sel('SelectBranch', 'Select Branch', selArgs('BRANCH'), reselect('SelectBranch', 'BRANCH', branch));
  // inferred: selects the whole hierarchy tree each selected object belongs to (top ancestor below the scene root, as branch)
  sel('SelectTree', 'Select Tree', selArgs('TREE'), reselect('SelectTree', 'TREE', o => branch(treeTop(app, o))));
  // inferred: selects the model each selected object belongs to, as branch. Objects directly under the scene root have
  // no model other than Scene_Root; what the command does for them is not attested, they keep their selection.
  sel('SelectModel', 'Select Model', selArgs('MODEL'), reselect('SelectModel', 'MODEL', o => {
    const m = o.model; if (m && m !== app.scene.root) return branch(m);
    app.logMsg('info', `SelectModel: not yet attested: ${o.name} is not inside a model below the scene root; selection kept (CMD-B19c)`); return [o];
  }));
  // inferred: selects the complete chain (root, bones, effector) each selected chain element belongs to
  sel('SelectChain', 'Select Chain', selArgs('CHAIN'), reselect('SelectChain', 'CHAIN', o => {
    let n: X3DObject | null = o; while (n && !(n instanceof ChainRoot)) n = n.parentObj;
    if (!(o instanceof ChainRoot || o instanceof Bone || o instanceof Effector) || !(n instanceof ChainRoot)) return [o];
    return uniq([n as X3DObject, ...n.bones, ...(n.effector ? [n.effector] : [])]);
  }));

  // SelectMembers: CMD-B19d (selectionB19d.ts)

  // inferred: hierarchy navigation. NavigDirection from the registry's menu entries: 0 parent, 1 first child,
  // 2 previous sibling, 3 next sibling, 4 first, 5 last (first / last taken as first / last sibling).
  // B11d §3.2: tasks.dll's SelectNeighborObj only runs the command's script (no native direction table), so this 0-based
  // encoding stays inferred; it is NOT NavigateNode's (1-based: 1 parent, 2 child, 3 next, 4 previous, 5 first, 6 last).
  // HierarchyLevel NODE selects the node, BRANCH the node with its descendants; AddToSelection extends.
  sel('SelectNeighborObj', 'Select Neighbor', [{ name: 'InputObjs', default: null }, { name: 'NavigDirection', default: 0 }, { name: 'HierarchyLevel', default: 'NODE' }, { name: 'AddToSelection', default: false }], (app, a) => {
    const dir = Number(a.NavigDirection);
    if (!(dir >= 0 && dir <= 5) || !Number.isInteger(dir)) throw new Unattested('SelectNeighborObj', `NavigDirection ${a.NavigDirection}`);
    const objs = empty(a.InputObjs) ? app.selectedObjects : objectsOf(resolve(app, a.InputObjs));
    const out: X3DObject[] = [];
    for (const o of objs) {
      const sib = o.parentObj?.children ?? []; const i = sib.indexOf(o);
      const t = dir === 0 ? (o.parentObj && o.parentObj !== app.scene.root ? o.parentObj : null)
        : dir === 1 ? o.children[0] ?? null : dir === 2 ? sib[i - 1] ?? null : dir === 3 ? sib[i + 1] ?? null
          : dir === 4 ? sib[0] ?? null : sib[sib.length - 1] ?? null;
      if (t) out.push(...(String(a.HierarchyLevel).toUpperCase() === 'BRANCH' ? branch(t) : [t]));
    }
    if (!out.length) return;
    app.compSel = null; selectNodes(app, out, isTrue(a.AddToSelection) ? 'add' : 'replace');
  });

  // ================================================================ filters

  // SelectAllUsingFilter: CMD-B19d (selectionB19d.ts)
  // DeselectAllUsingFilter: selectionmgr.dll 16532fa0, CMD-B19b (src/commands/tasksB19b.ts)

  // inferred: makes SelFilter the current selection filter (same state the MCP filter box writes: app.selFilter + app.selMode)
  sel('SelectFilter', 'Select Filter', [{ name: 'SelFilter', default: null }], (app, a) => { if (empty(a.SelFilter)) return (app as any).selFilter ?? FILTER_LABEL[app.selMode]; return setFilter(app, a.SelFilter, 'SelectFilter'); }, 'Select a filter as the current selection filter');
  // inferred: registry display name "Select Filter Tool": sets the filter and activates the select tool
  sel('SetSelFilter', 'Select Filter Tool', [{ name: 'SelFilter', default: null }], (app, a) => {
    const r = empty(a.SelFilter) ? ((app as any).selFilter ?? FILTER_LABEL[app.selMode]) : setFilter(app, a.SelFilter, 'SetSelFilter');
    if (app.commands.has('ActivateSelectTool')) app.run('ActivateSelectTool');
    return r;
  });
  // Select{Object,Vertex,Edge,Polygon,SampledPoint}Filter: CMD-B19d (selectionB19d.ts, set-filter task 91d68770)
  for (const [name, label, filter, description] of [
    ['SetPointSelectionFilter', 'Set Point Selection Filter', 'Point', 'Set selection filter to point'],
    ['SetEdgeSelectionFilter', 'Set Edge Selection Filter', 'Edge', 'Set selection filter to edge'],
    ['SetPolygonSelectionFilter', 'Set Polygon Selection Filter', 'Polygon', 'Set selection filter to polygons'],
    ['SetSampleSelectionFilter', 'Set Sample Selection Filter', 'SampledPoint', 'Set selection filter to samples'],
  ] as const) {
    // inferred: fixed-filter form of SelectFilter (behaviour from the registry description). The two sample filters
    // only record the filter name: sampled-point picking is not representable yet (logged as not yet attested).
    sel(name, label, [], (app) => setFilter(app, filter, name), description);
  }
  // inferred: registry description "Toggle between the Object and Point selection filter"
  sel('ToggleObjectComponentSelectionFilter', 'Toggle Object/Component Selection Filter', [], (app) => setFilter(app, app.selMode === 'object' ? 'Point' : 'Object', 'ToggleObjectComponentSelectionFilter'), 'Toggle between the Object and Point selection filter');
  // inferred: display-name-only registry entry (no scripting name). Cycles the selection modes the app has, in the
  // MCP button order: Object, Point, Edge, Polygon, back to Object.
  sel('Cycle Selection Mode', 'Cycle Selection Mode', [], (app) => {
    const order = ['object', 'point', 'edge', 'polygon'] as const;
    return setFilter(app, FILTER_LABEL[order[(order.indexOf(app.selMode) + 1) % order.length]], 'Cycle Selection Mode');
  }, 'Cycle through available selection modes');

  // Activate...SelToolWithNoObjStateChange: CMD-B19d (selectionB19d.ts)

  // ================================================================ component selection


  // SelectAllConnectedComponents (Island From Selection): tasks.dll, CMD-B19b (src/commands/tasksB19b.ts)
  // inferred: selects the listed geometry components ("obj.pnt[..]", "obj.edge[..]", "obj.poly[..]") and sets the
  // matching filter. What it does for a bare object name is not attested.
  sel('SelectGeometryComponents', 'Select Geometry Components', [{ name: 'SelectionList', default: null }], (app, a) => {
    if (empty(a.SelectionList)) return;
    const r = resolve(app, a.SelectionList);
    if (!r.comps.length) { app.logMsg('info', 'SelectGeometryComponents: not yet attested: a selection list without component strings; nothing selected'); return; }
    const first = r.comps[0]; const items = new Set<CompItem>();
    for (const c of r.comps) if (c.obj === first.obj && c.kind === first.kind) for (const it of c.items) items.add(it);
    setComponents(app, first.obj, first.kind, items);
  });

  // SelectAllComponentLoops / GrowSelectedLoops / ShrinkSelectedLoops / SelectPolygonOutline: tasks.dll, CMD-B19b
  // (src/commands/tasksB19b.ts)

  // ================================================================ info

  // inferred: reports the derivable figures (component counts) of the given objects in the log and returns them.
  // The real command opens a report window whose layout is not attested.
  sel('InfoSelection', 'Info Selection', [{ name: 'InputObjs', default: null }], (app, a) => {
    const objs = empty(a.InputObjs) ? app.selectedObjects : objectsOf(resolve(app, a.InputObjs));
    const rows = objs.map(o => {
      const m = meshOf(o);
      const adj = m ? T.adjacencyOf(m) : null;
      return { name: o.name, type: o.type, children: o.children.length, points: adj ? adj.nPoints : 0, edges: adj ? adj.edges.length : 0, polygons: m ? m.polygons.length : 0, triangles: m ? m.indices.length / 3 : 0 };
    });
    for (const r of rows) app.logMsg('info', `InfoSelection: ${r.name} (${r.type}): ${r.points} points, ${r.edges} edges, ${r.polygons} polygons, ${r.triangles} triangles, ${r.children} children`);
    app.logMsg('info', `InfoSelection: ${rows.length} object(s); not yet attested: layout of the Info Selection report window`);
    return rows;
  });
  // inferred: reports the derivable scene counts in the log and returns them, one block per Do... flag.
  // The real command opens a report window whose layout is not attested.
  sel('InfoScene', 'Info Scene', [{ name: 'DoGeneral', default: true }, { name: 'DoAnimation', default: true }, { name: 'DoRendering', default: true }], (app, a) => {
    const objs = [...app.scene.allObjects()]; const out: Record<string, Record<string, number>> = {};
    if (isTrue(a.DoGeneral)) {
      let points = 0, polygons = 0, triangles = 0;
      for (const o of objs) { const m = meshOf(o); if (m) { points += m.positions.length / 3; polygons += m.polygons.length; triangles += m.indices.length / 3; } }
      out.general = { objects: objs.length, models: objs.filter(o => o instanceof Model).length, groups: app.scene.groupList.length, layers: app.scene.layers.length, points, polygons, triangles };
    }
    if (isTrue(a.DoAnimation)) out.animation = { fcurves: (app.anim as any).fcurves?.size ?? 0, expressions: app.anim.expressions.size };
    if (isTrue(a.DoRendering)) out.rendering = { passes: app.scene.passes.length, materials: app.scene.materials.length, lights: objs.filter(o => o.type === 'light').length, cameras: objs.filter(o => o.type === 'camera').length };
    for (const [k, v] of Object.entries(out)) app.logMsg('info', `InfoScene: ${k}: ${Object.entries(v).map(([n, x]) => `${x} ${n}`).join(', ')}`);
    app.logMsg('info', 'InfoScene: not yet attested: layout of the Info Scene report window');
    return out;
  });

  // ================================================================ groups

  const grp = (name: string, label: string, args: CommandDef['args'], execute: CommandDef['execute'], description?: string) =>
    reg({ name, label, category: 'Group', description, args, execute });
  const targetGroup = (app: App, command: string, target: any): Group => {
    if (empty(target)) throw new Unattested(command, 'the pick session that asks for the Target group when none is given');
    const g = asGroup(app, target); if (!g) throw new Error(`group "${target?.name ?? target}" not found`);
    return g;
  };
  const memberArg = (app: App, v: any): X3DObject[] => (empty(v) ? app.selectedObjects : objectsOf(resolve(app, v))).filter(o => o !== app.scene.root);

  const addTo = (command: string) => (app: App, a: Record<string, any>) => { const g = targetGroup(app, command, a.Target); const added = addMembers(app, g, memberArg(app, a.InputObjs)); return added; };
  // inferred: adds the objects (default: the selection) to the Target group; the selection is not changed
  grp('AddToGroup', 'Add to Group', [{ name: 'Target', default: '' }, { name: 'InputObjs', default: '' }], (app, a) => { addTo('AddToGroup')(app, a); });
  // inferred: low-level AddToGroup; the objects actually added are returned as the OutputObj output argument
  grp('SIAddToGroup', 'Group Add To', [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }, { name: 'OutputObj', default: null }], addTo('SIAddToGroup'), 'Add a member to a group');
  // SIAddToGroupLowLevel: grouptask.dll 0b9f8320, CMD-B20b (src/commands/groupsB20b.ts)

  const removeFrom = (command: string) => (app: App, a: Record<string, any>) => {
    const objs = memberArg(app, a.InputObjs);
    // Without a Target the members are removed from every group that holds them (the registry description speaks of
    // "the selected members" and gives no default group).
    const groups = empty(a.Target) ? app.scene.groupList.filter(g => g.members.some(o => objs.includes(o))) : [targetGroup(app, command, a.Target)];
    let n = 0; for (const g of groups) n += removeMembers(app, g, objs).length;
    return n;
  };
  // inferred: removes the objects (default: the selection) from the Target group
  grp('RemoveFromGroup', 'Remove from Group', [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }], (app, a) => { removeFrom('RemoveFromGroup')(app, a); }, 'Remove the selected members from the group');
  // SIRemoveFromGroup: grouptask.dll 0b9f8322, CMD-B20b (src/commands/groupsB20b.ts)

  // SICreateGroup: grouptask.dll 03f2fdf0, CMD-B20b (src/commands/groupsB20b.ts)
  // inferred: registry description "Create a group under the common model of the selected objects and add the objects
  // into the group". The group is selected afterwards, as CreateGroup does.
  grp('CreateGroupFromObjects', 'Create Group from Objects', [{ name: 'Name', default: '' }, { name: 'InputObjs', default: null }], (app, a) => {
    const objs = memberArg(app, a.InputObjs);
    const models = uniq(objs.map(o => (o instanceof Model ? o.parentObj?.model : o.model) ?? app.scene.root));
    const g = createGroup(app, String(a.Name || ''), models.length === 1 ? models[0] : app.scene.root, objs);
    noInspect(app); app.select([g]); return g;
  }, 'Create a group under the common model of the selected objects and add the objects into the group');
  // AddGroup: grouptask.dll 06af33ae, CMD-B20b (src/commands/groupsB20b.ts)
  // inferred: removes the groups (default: the selected groups) from the scene; their members are untouched
  grp('RemoveGroup', 'Remove Group', [{ name: 'InputObjs', default: null }], (app, a) => {
    const nodes = empty(a.InputObjs) ? [...app.selection] : resolve(app, a.InputObjs).nodes;
    const groups = nodes.filter((n): n is Group => n instanceof Group && app.scene.groupList.includes(n)); if (!groups.length) return;
    const before = [...app.scene.groupList]; const list = app.scene.groupList;
    app.record('Remove Group', () => { list.splice(0, list.length, ...before.filter(g => !groups.includes(g))); }, () => { list.splice(0, list.length, ...before); });
    app.selection = app.selection.filter(n => !groups.includes(n as Group)); app.events.emit('selection');
  });
  // SetInstanceGroup / RemoveInstanceGroup: grouptask.dll e0717f47 / d534de9f, CMD-B7a (src/commands/uiGroupViewTasks.ts, the only
  // registration; CMD-B20b confirmed the contracts)

  // ================================================================ layers

  const lay = (name: string, label: string, args: CommandDef['args'], execute: CommandDef['execute'], description?: string, undoable = true) =>
    reg({ name, label, category: 'Layer', description, args, undoable, execute });

  // SICreateLayer / SICreateLayer2 / MoveObjectToLayer / CreateLayerGroup / CutLayerParent: tasks.dll, CMD-B19b
  // (src/commands/tasksB19b.ts)
  // inferred: returns the current layer (Value is the output argument); counterpart of SetCurrentLayer
  lay('GetCurrentLayer', 'Get current layer', [{ name: 'Value', default: null }], (app) => { noInspect(app); return currentLayer(app); }, 'Get the current layer', false);
}
