// Ledger row CMD-B17a: the 23 script commands of selection.vbs / layers.vbs.
// Brief: docs/ghidra/cmd-b17a-selection-layers-scripts.md section 3 ("Wire contract") and the cmd-b17a section of
// docs/re/WIRE_CORRECTIONS_B17.md. Original code written from the prose contract; no script text is reproduced.
//
// These names were registered earlier by inferred batches (selectionGroupLayer.ts, viewEditProperty.ts, index.ts,
// anim.ts, renderToolbarOm.ts); those registrations were removed and this module is the only one for them.
// Argument lists are the registry's (data/command_registry.json, hidden arguments included).
//
// Every sub-command the contract names (SelectObj, AddToSelection, SetSelFilter, SetValue, SICreateLayer, ...) is
// recorded in `app.cmdB17a.calls` in contract order, so the check can verify the sequence. Where the bus command of
// that name cannot take the argument the script passes (component strings for SelectObj, wildcard paths for
// SetValue, a filter for InvertSelection), the step is applied here directly with the same effect.
//
// Not attested, logged as "not yet attested" where it matters:
//  - numeric values of siAdjacent / siGrow (Q1): GetNeighborSubcomponents NeighborType 0 is taken as siAdjacent and
//    1 as siGrow (inferred);
//  - the exact neighbour sets of Neighbors0D/1D/2D (inferred: same type siAdjacent = the ring around the items
//    without the items, siGrow = the items plus that ring, rings through shared points; other type = incidence);
//  - siInvisiblePolygonsClusterName (Q2): the value kept by CMD-B5f (app.miscDsScripts.invisiblePolygonsClusterName);
//  - SelectObj with an empty list (Q3): taken as clearing the selection (inferred);
//  - what makes a scene object's viewvis / rendvis read-only: a parameter whose definition is read-only here.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Group, Layer, Partition, Cluster, Property } from '../core/scene';
import { bool } from '../core/params';
import type { Parameter } from '../core/params';
import type { CompKind } from '../core/topology';
import * as T from './selectionGroupLayerTopology';
import type { CompItem } from './selectionGroupLayerTopology';
import { resolve, compString } from './selectionGroupLayer';
import { startPickSession } from './miscDsScriptsPick';
import { siString } from '../ui/si';

const ROW = 'CMD-B17a';

// ------------------------------------------------------------------ state, trace, messages

/** A sub-component item: one object, one component type, its elements. */
export interface Sub { obj: X3DObject; kind: CompKind; items: CompItem[] }
export interface B17aState {
  /** Sub-commands in the order the contract calls them. */
  calls: { cmd: string; args: any[] }[];
  /** Output arguments of the last run per command. */
  out: Record<string, Record<string, any>>;
}
export const b17a = (app: App): B17aState => ((app as any).cmdB17a ??= { calls: [], out: {} });
const call = (app: App, cmd: string, ...args: any[]) => { b17a(app).calls.push({ cmd, args }); };
const nya = (app: App, C: string, what: string) => app.logMsg('info', `${C}: not yet attested: ${what} (${ROW})`);
const warn = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);

const empty = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const isTrue = (v: any) => v === true || v === 1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
const meshOf = (o: X3DObject | null | undefined) => o?.primitive?.mesh() ?? null;
const uniq = <N>(l: N[]): N[] => [...new Set(l)];

/** The text of XSISCRIPTS id 1132, with the note's English text as fallback (the committed table lacks the id). */
const PICK_PROMPT = () => siString('XSISCRIPTS', 1132) ?? 'Select EdgeLoop  (supports Shift/Ctrl)';

/** Keep run() from auto-inspecting a returned node (the layer-from-selection commands do not inspect). */
function noInspect(app: App) { if (!app.autoInspect) return; app.autoInspect = false; queueMicrotask(() => { app.autoInspect = true; }); }

// ------------------------------------------------------------------ input collections

interface Input { nodes: Node[]; subs: Sub[]; clusters: Cluster[] }
const CLUSTER_KIND: Record<string, CompKind | undefined> = { pnt: 'point', edge: 'edge', poly: 'polygon' };
const LABEL: Record<CompKind, string> = { point: 'Point', edge: 'Edge', polygon: 'Polygon' };

function compSet(app: App): Set<CompItem> | null {
  const c = app.compSel; if (!c) return null;
  return new Set<CompItem>(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons);
}
function split(nodes: Node[], subs: Sub[]): Input {
  const clusters = nodes.filter((n): n is Cluster => n instanceof Cluster);
  return { nodes: nodes.filter(n => !(n instanceof Cluster)), subs, clusters };
}
/** The selection as a collection: a component selection is one sub-component item (its object is not listed). */
function selectionInput(app: App): Input {
  let nodes = [...app.selection]; const subs: Sub[] = [];
  const c = app.compSel; const set = compSet(app);
  if (c && set && set.size) { subs.push({ obj: c.obj, kind: c.kind, items: [...set] }); nodes = nodes.filter(n => n !== c.obj); }
  return split(nodes, subs);
}
/** A Collection-handler argument: empty = the selection. */
function inputOf(app: App, arg: any): Input {
  if (empty(arg)) return selectionInput(app);
  const r = resolve(app, arg);
  return split(r.nodes, r.comps.map(c => ({ obj: c.obj, kind: c.kind, items: [...c.items] })));
}
const clusterSub = (c: Cluster): Sub | null => { const k = CLUSTER_KIND[c.compKind]; const o = c.obj; return k && o ? { obj: o, kind: k, items: [...c.elements] } : null; };

/** Sorted, de-duplicated items (points / polygons by index, edges by their edge index). */
function sortItems(adj: T.Adjacency, kind: CompKind, items: Iterable<CompItem>): CompItem[] {
  const l = uniq([...items]);
  return kind === 'edge' ? l.sort((a, b) => (adj.edgeIndex.get(a as string) ?? 0) - (adj.edgeIndex.get(b as string) ?? 0)) : l.sort((a, b) => (a as number) - (b as number));
}
function subString(s: Sub): string { const m = meshOf(s.obj); return m ? compString(s.obj, T.adjacencyOf(m), s.kind, s.items) : `${s.obj.name}.${s.kind === 'point' ? 'pnt' : s.kind === 'edge' ? 'edge' : 'poly'}[]`; }
/** Items of the same object and type merged into one item. */
function merge(subs: Sub[]): Sub[] {
  const out: Sub[] = [];
  for (const s of subs) { const m = out.find(x => x.obj === s.obj && x.kind === s.kind); if (m) m.items = uniq([...m.items, ...s.items]); else out.push({ ...s, items: uniq([...s.items]) }); }
  return out;
}

/** 2.1: clusters in the input switch the cluster selection button off and contribute their members. */
function expandClusters(app: App, inp: Input): Input {
  if (!inp.clusters.length) return inp;
  const prefs: Record<string, any> = ((app as any).userPrefs ??= {});
  prefs.SI3D_GROUP_SEL_MODE = 0; call(app, 'SetUserPref', 'SI3D_GROUP_SEL_MODE', 0);
  call(app, 'SelectMembers', inp.clusters.map(c => c.fullName), false);
  const members = inp.clusters.map(clusterSub).filter((s): s is Sub => !!s);
  return { ...inp, subs: [...inp.subs, ...members] };
}

// ------------------------------------------------------------------ neighbour query (2.2)

type NType = 'adjacent' | 'grow' | null;
/** The geometry type string of GetNeighborsFunc: exactly Point, Edge or Polygon (case-insensitive here). */
function wantKind(f: any): CompKind | null {
  const s = typeof f === 'string' ? f.trim().toLowerCase() : '';
  return s === 'point' ? 'point' : s === 'edge' ? 'edge' : s === 'polygon' ? 'polygon' : null;
}
/** inferred: a cross-dimension neighbour query returns the incident components of the wanted type. */
function incident(adj: T.Adjacency, from: CompKind, items: CompItem[], to: CompKind): Set<CompItem> {
  const out = new Set<CompItem>();
  for (const it of items) {
    if (from === 'point') for (const x of (to === 'edge' ? adj.vertEdges[it as number] : adj.vertPolys[it as number]) ?? []) out.add(x);
    else if (from === 'edge') { if (to === 'point') T.edgeVerts(it as string).forEach(v => out.add(v)); else (adj.edgePolys.get(it as string) ?? []).forEach(p => out.add(p)); }
    else for (const x of (to === 'point' ? adj.mesh.polygons[it as number] : adj.polyEdges[it as number]) ?? []) out.add(x);
  }
  return out;
}
/** GetNeighborsFunc: one new item per input item with neighbours; null when nothing was found. */
function neighbours(list: Sub[], type: NType, geometryType: any): Sub[] | null {
  const to = wantKind(geometryType); if (!to) return null;
  const out: Sub[] = [];
  for (const s of list) {
    if (!s.items.length) continue;
    const m = meshOf(s.obj); if (!m) continue;
    const adj = T.adjacencyOf(m); let found: Set<CompItem>;
    if (s.kind === to) {
      const set = new Set<CompItem>(s.items);
      if (type === 'grow') found = T.grow(adj, to, set);
      else if (type === 'adjacent') found = T.adjacent(adj, to, set, to);
      else continue;
    } else found = incident(adj, s.kind, s.items, to);
    if (found.size) out.push({ obj: s.obj, kind: to, items: sortItems(adj, to, found) });
  }
  return out.length ? out : null;
}

// ------------------------------------------------------------------ selection steps

/** SelectObj / AddToSelection / ToggleSelection / RemoveFromSelection with sub-component items. The component
 *  selection of this build holds one object and one type; extra items of other objects are reported. */
function selectSubs(app: App, C: string, subs: Sub[], mode: 'replace' | 'add' | 'toggle' | 'remove') {
  const list = merge(subs);
  call(app, mode === 'replace' ? 'SelectObj' : mode === 'add' ? 'AddToSelection' : mode === 'toggle' ? 'ToggleSelection' : 'RemoveFromSelection', list.map(subString));
  if (mode === 'replace' && !list.length) { app.compSel = null; app.select([]); return; }   // Q3 (inferred)
  if (list.length > 1) app.logMsg('info', `${C}: the component selection holds one object and one component type in this build; ${list.slice(1).map(subString).join(', ')} not ${mode === 'remove' ? 'removed' : 'selected'}`);
  const s = list[0]; if (!s) return;
  if (mode === 'remove') {
    const c = app.compSel; const set = compSet(app);
    if (c && set && c.obj === s.obj && c.kind === s.kind) app.selectComponents(s.obj, s.kind, [...set].filter(x => !s.items.includes(x)), 'replace');
    return;
  }
  app.selectComponents(s.obj, s.kind, s.items, mode);
}
function setSelFilter(app: App, f: any) { call(app, 'SetSelFilter', f ?? null); app.run('SetSelFilter', { SelFilter: f ?? null }); }
/** InvertSelection with the current component filter: every other component of that object and type. */
function invertComponents(app: App, kind?: CompKind) {
  call(app, 'InvertSelection', kind ? LABEL[kind] : null);
  const c = app.compSel; const set = compSet(app); if (!c || !set) return false;
  if (kind && c.kind !== kind) return false;
  const m = meshOf(c.obj); if (!m) return false;
  app.selectComponents(c.obj, c.kind, T.allItems(T.adjacencyOf(m), c.kind).filter(x => !set.has(x)), 'replace');
  return true;
}
/** InvertSelection "object": every scene object that is not selected. */
function invertObjects(app: App) {
  call(app, 'InvertSelection', 'object');
  const sel = new Set(app.selection);
  app.compSel = null; app.select([...app.scene.allObjects()].filter(o => !sel.has(o)));
}

// ------------------------------------------------------------------ visibility helpers (2.3, 2.5)

const isGroupLike = (n: any): n is Group | Partition | Layer => n instanceof Group || n instanceof Partition || n instanceof Layer;
const paramList = (name: any): string[] => String(name ?? '').split(',').map(s => s.trim()).filter(Boolean);
/** ToggleCurrentLayerProperty's 2-state cycle (ghosting 0>1, 1>2, 2>1; others 0>2, 1>0, 2>0; other values kept). */
function cycle2(p: string, v: number): number {
  if (p === 'ghosting') return v === 0 ? 1 : v === 1 ? 2 : v === 2 ? 1 : v;
  return v === 0 ? 2 : v === 1 ? 0 : v === 2 ? 0 : v;
}
const cycle3 = (v: number): number => v === 0 ? 1 : v === 1 ? 2 : v === 2 ? 0 : v;
const gval = (n: Node, p: string): number | undefined => { const q = n.get(p); return q ? Number(q.value) : undefined; };
function setGroupParam(app: App, n: Node, p: string, v: number, label: string) { const q = n.get(p); if (q) app.setParam(q, v, label); }
const visParam = (o: X3DObject, p: string): Parameter | undefined => o.properties.find(x => x.type === 'visibility')?.get(p);
const readOnly = (q: Parameter) => q.def.readOnly === true;
/** Write <obj>.visibility.<p>; a read-only parameter cannot be set (SetValue skips it). */
function setObjVis(app: App, o: X3DObject, p: string, v: boolean, label: string): boolean {
  const q = visParam(o, p); if (!q || readOnly(q)) return false;
  app.setParam(q, v, label); return true;
}
/** The owners of an object that carry visibility parameters: its groups, its layer, the partitions holding it. */
function owners(app: App, o: X3DObject): Node[] {
  const out: Node[] = app.scene.groupList.filter(g => g.members.includes(o));
  if (o.layer) out.push(o.layer);
  for (const pass of app.scene.passes) for (const pt of pass.partitions) if (pt.members.has(o)) out.push(pt);
  return out;
}
/** 2.5: one warning naming the owning groups whose same parameter is not 2. */
function interferenceWarning(app: App, skipped: { o: X3DObject; p: string }[]) {
  if (!skipped.length) return;
  const names: string[] = [];
  for (const { o, p } of skipped) for (const g of owners(app, o)) { const v = gval(g, p); if (v !== undefined && v !== 2 && !names.includes(g.name)) names.push(g.name); }
  warn(app, `Unable to set visibility on some parameters. The following groups are interfering:${names.map(n => ` ${n},`).join('')}`);
}
/** inferred: "selected in branch" = the object and all of its descendants are in the selection (the branch
 *  representation of this build, see selectionGroupLayer.ts). */
function inBranch(app: App, o: X3DObject): boolean {
  if (!o.children.length || !app.selection.includes(o)) return false;
  for (const d of o.descendants()) if (!app.selection.includes(d)) return false;
  return true;
}
const sceneObjects = (inp: Input) => inp.nodes.filter((n): n is X3DObject => n instanceof X3DObject);
const groupLikes = (inp: Input) => inp.nodes.filter(isGroupLike);

/** 2.4: hide the polygons of the input, in "add" mode (SIHideObjects) or "toggle" mode (the visibility toggle). */
function hidePolygons(app: App, C: string, inp: Input, mode: 'add' | 'toggle') {
  const polys = merge([...inp.subs.filter(s => s.kind === 'polygon'), ...inp.clusters.filter(c => c.compKind === 'poly').map(clusterSub).filter((s): s is Sub => !!s)]);
  if (!polys.length) return;
  const name: string = (app as any).miscDsScripts?.invisiblePolygonsClusterName ?? 'InvisiblePolygons';   // Q2
  const created: Cluster[] = [];
  for (const s of polys) {
    const o = s.obj; let c = o.clusters.find(k => k.name === name && k.compKind === 'poly');
    if (c && !created.includes(c)) {
      const vis = c.properties.find(p => p.name === 'clsvisibility' || p.type === 'clsvisibility');
      if (!vis || vis.val('viewvis')) {
        const dead = c; const idx = o.clusters.indexOf(dead); call(app, 'DeleteObj', dead.fullName);
        app.record('DeleteObj', () => o.removeCluster(dead), () => { o.clusters.splice(idx, 0, dead); });
        c = undefined;
      }
    }
    if (!c) {
      call(app, 'CreateClusterFromSubComponent', subString(s), name);
      const nc = new Cluster(name, 'poly', new Set<number | string>(s.items));
      app.record('CreateClusterFromSubComponent', () => o.addCluster(nc), () => o.removeCluster(nc));
      created.push(nc);
    } else if (created.includes(c)) {
      const cl = c; const add = s.items.filter(i => !cl.elements.has(i));
      app.record('SIAddToCluster', () => add.forEach(i => cl.elements.add(i)), () => add.forEach(i => cl.elements.delete(i)));
    } else if (mode === 'add') {
      const cl = c; const add = s.items.filter(i => !cl.elements.has(i)); call(app, 'SIAddToCluster', cl.fullName, subString(s));
      app.record('SIAddToCluster', () => add.forEach(i => cl.elements.add(i)), () => add.forEach(i => cl.elements.delete(i)));
    } else { call(app, 'SITogglePolygonVisibility', subString(s)); app.run('SITogglePolygonVisibility', { InputObjs: subString(s) }); }
  }
  const skipped: { o: X3DObject; p: string }[] = [];
  for (const c of created) {
    call(app, 'SIAddProp', 'Component Visibility', c.fullName);
    const p = new Property('clsvisibility', 'clsvisibility', [bool('viewvis', true, 'View Visibility'), bool('rendvis', true, 'Render Visibility')]);
    app.record('SIAddProp', () => { c.addProperty(p); }, () => { c.removeProperty(p); });
    for (const k of ['viewvis', 'rendvis']) { const q = p.get(k)!; if (readOnly(q)) { if (c.obj) skipped.push({ o: c.obj, p: k }); continue; } call(app, 'SetValue', `${p.fullName}.${k}`, false); app.setParam(q, false, C); }
    if (c.name !== name) { call(app, 'InspectObj', p.fullName); app.events.emit('inspect', p); }
  }
  interferenceWarning(app, skipped);
}

// ------------------------------------------------------------------ edge loops

interface LoopTables { obj: X3DObject; adj: T.Adjacency }
/** Loop walk from the picked edges (both ends); returns the flagged edges in index order. method 0 / 1 / 2. */
export function edgeLoopOf(adj: T.Adjacency, start: string[], method: 0 | 1 | 2): string[] {
  const flagged = new Set<string>(start);
  const polysOf = (k: string) => adj.edgePolys.get(k) ?? [];
  const sharesPoly = (a: string, b: string) => polysOf(a).some(p => polysOf(b).includes(p));
  const other = (k: string, v: number) => { const [a, b] = T.edgeVerts(k); return a === v ? b : a; };
  for (const e0 of start) {
    if (method === 2) {
      for (const p0 of polysOf(e0)) {
        let cur = e0, poly: number | undefined = p0;
        while (poly !== undefined) {
          const [ca, cb] = T.edgeVerts(cur);
          const next: string | undefined = (adj.polyEdges[poly] ?? []).find(k => { const [a, b] = T.edgeVerts(k); return a !== ca && a !== cb && b !== ca && b !== cb; });
          if (!next || flagged.has(next)) break;
          flagged.add(next);
          const prev: number = poly; poly = polysOf(next).find(p => p !== prev); cur = next;
        }
      }
      continue;
    }
    for (const end of T.edgeVerts(e0)) {
      let cur = e0, at = end;
      for (;;) {
        const here = adj.vertEdges[at] ?? [];
        if (here.length > 4) break;
        let next: string | undefined;
        if (method === 1 && here.length === 2) next = here.find(k => k !== cur);
        else {
          const matching = here.filter(k => k !== cur && !sharesPoly(k, cur));
          if (method === 0) {
            if (matching.some(k => polysOf(k).length !== polysOf(cur).length)) break;   // border / inner mix: stop
            for (const k of matching) if (!flagged.has(k)) next = k;                       // the (last) unflagged one
          } else next = matching.find(k => polysOf(k).length === polysOf(cur).length);
        }
        if (!next || flagged.has(next)) break;
        flagged.add(next); at = other(next, at); cur = next;
      }
    }
  }
  return [...flagged].sort((a, b) => (adj.edgeIndex.get(a) ?? 0) - (adj.edgeIndex.get(b) ?? 0));
}
/** A picked edge: "obj.edge[i,…]" text, or the viewport pick { obj, item: "a-b" }. */
function pickedEdges(app: App, v: any): { obj: X3DObject; edges: string[] } | null {
  if (v && typeof v === 'object' && v.obj instanceof X3DObject && typeof v.item === 'string') return { obj: v.obj, edges: [v.item] };
  const r = resolve(app, v); const c = r.comps.find(x => x.kind === 'edge');
  return c ? { obj: c.obj, edges: c.items.map(String) } : null;
}
function edgeLoopCommand(C: string, method: 0 | 1 | 2) {
  return (app: App, a: Record<string, any>) => {
    // The input is filtered for edges but not used (the extend-the-selection code is disabled in the script).
    call(app, 'SIFilter', a.InputObjs ?? null, 'edge');
    let cache: LoopTables | null = null;
    call(app, 'PickElement', 'siEdgeFilter', PICK_PROMPT(), PICK_PROMPT());
    const session = startPickSession(app, {
      command: C, kind: 'element', filter: 'Edge', pickKind: 'edge', prompt: PICK_PROMPT(), middlePrompt: PICK_PROMPT(),
      fromClick: (_p, pick) => pick && pick.kind === 'edge' && typeof pick.item === 'string' ? { obj: pick.obj, item: pick.item } : null,
      onPick: (value: any, _button: number, modifier: number) => {
        const pk = pickedEdges(app, value); if (!pk) return true;
        const m = meshOf(pk.obj); if (!m) return true;
        if (!cache || cache.obj !== pk.obj) cache = { obj: pk.obj, adj: T.adjacencyOf(m) };   // tables kept while the same object is picked
        const loop = edgeLoopOf(cache.adj, pk.edges.filter(k => cache!.adj.edgeIndex.has(k)), method);
        const sub: Sub = { obj: pk.obj, kind: 'edge', items: loop };
        setSelFilter(app, 'Edge');
        const mode = modifier === 1 ? 'add' : modifier === 2 ? 'toggle' : modifier === 3 ? 'remove' : 'replace';
        selectSubs(app, C, [sub], mode);
        b17a(app).out[C] = { loop: subString(sub), modifier };
        return true;   // repeat until right click / Esc
      },
    });
    b17a(app).out[C] = { session: !!session };
    return undefined;
  };
}

// ------------------------------------------------------------------ hide / unhide

function hideOrUnhide(app: App, C: string, a: Record<string, any>, hide: boolean) {
  const prop = empty(a.PropertyName) ? 'visibility' : String(a.PropertyName);
  if (prop === 'visibility') { call(app, C, a.Target ?? null, 'viewvis,rendvis'); return hideOrUnhide(app, C, { ...a, PropertyName: 'viewvis,rendvis' }, hide); }
  const inp = inputOf(app, a.Target); const ps = paramList(prop);
  for (const g of groupLikes(inp)) for (const p of ps) { call(app, 'SetValue', `${g.fullName}.${p}`, hide ? 0 : 2); setGroupParam(app, g, p, hide ? 0 : 2, C); }
  for (const o of sceneObjects(inp)) {
    const branch = inBranch(app, o);
    for (const p of ps) {
      call(app, 'SetValue', `${o.fullName}.visibility.${p}`, !hide); setObjVis(app, o, p, !hide, C);
      if (branch) for (const d of o.descendants()) { call(app, 'SetValue', `${d.fullName}.visibility.${p}`, !hide); setObjVis(app, d, p, !hide, C); }
    }
  }
  if (hide) hidePolygons(app, C, inp, 'add');
}

/** SetValue "*.visibility.<p>", v (every scene object; read-only parameters are left alone). */
function setAllObjects(app: App, C: string, p: string, v: boolean) {
  call(app, 'SetValue', `*.visibility.${p}`, v);
  for (const o of app.scene.allObjects()) setObjVis(app, o, p, v, C);
}
/** The override properties of the scene (objects, groups, partitions, layers that hold properties). */
function overrides(app: App): { host: any; ov: Property }[] {
  const out: { host: any; ov: Property }[] = [];
  const isOv = (p: any) => p instanceof Property && /^override$/i.test(p.type);
  for (const o of app.scene.allObjects()) for (const p of o.properties) if (isOv(p)) out.push({ host: o, ov: p });
  const others: any[] = [...app.scene.groupList, ...app.scene.layers, ...app.scene.passes.flatMap(x => x.partitions)];
  for (const h of others) for (const p of (h.properties ?? []) as any[]) if (isOv(p)) out.push({ host: h, ov: p });
  return out;
}
const entryParams = (ov: Property) => ov.params.filter(q => !!(q.def as any).overrideEntry);
/** The entry of an override for the visibility parameter p (by name, or by its overridden path). */
const entryFor = (ov: Property, p: string) => ov.get(p) ?? entryParams(ov).find(q => { const path = String((q.def as any).overrideEntry?.path ?? ''); return path === p || path.endsWith('.' + p); });

function unhideAll(C: string, dflt: string) {
  return (app: App, a: Record<string, any>) => {
    let prop = empty(a.PropertyName) ? dflt : String(a.PropertyName);
    if (prop === 'visibility') { call(app, C, 'viewvis,rendvis'); prop = 'viewvis,rendvis'; }
    const ps = paramList(prop);
    const guard = (f: () => void) => { try { f(); } catch (e: any) { app.logMsg('info', `${C}: ${e?.message ?? e} (ignored)`); } };   // errors ignored from here
    guard(() => {
      for (const pass of app.scene.passes) for (const pt of pass.partitions) for (const p of ps) { call(app, 'SetValue', `${pt.fullName}.${p}`, 2); setGroupParam(app, pt, p, 2, C); }
      for (const l of app.scene.layers) for (const p of ps) { call(app, 'SetValue', `${l.fullName}.${p}`, 2); setGroupParam(app, l, p, 2, C); }
    });
    guard(() => {
      const list = overrides(app).filter(x => !x.ov.shared);   // FilterPSet siLocalPset: local overrides only
      if (!list.length) return;
      for (const { host, ov } of list) {
        for (const p of ps) {
          const e = entryFor(ov, p);
          if (e) { call(app, 'SIRemoveEntryFromOverride', e.fullName); if (app.commands.has('SIRemoveEntryFromOverride')) app.run('SIRemoveEntryFromOverride', { InputObjs: [e] }); else { const i = ov.removeParam(e); app.record(C, () => {}, () => ov.insertParam(e, i)); } }
          setAllObjects(app, C, p, true);
        }
        if (!entryParams(ov).length) {
          call(app, 'DeleteObj', ov.fullName);
          const props: Property[] = host.properties; const idx = props.indexOf(ov);
          app.record('DeleteObj', () => { const i = props.indexOf(ov); if (i >= 0) props.splice(i, 1); }, () => { props.splice(idx, 0, ov); });
        }
      }
    });
    guard(() => { for (const p of ps) setAllObjects(app, C, p, p !== 'ghosting'); });
  };
}

// ------------------------------------------------------------------ registration

const REG: Record<string, { label: string; category: string; description?: string; args: { name: string; default?: any }[] }> = {
  ConvertSelection: { label: 'Convert Selection', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: null }] },
  ConvertSelectionToEdges: { label: 'Convert Selection To Edges', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: 'Edge' }] },
  ConvertSelectionToPoints: { label: 'Convert Selection To Points', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: 'Point' }] },
  ConvertSelectionToPolygons: { label: 'Convert Selection To Polygons', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: 'Polygon' }] },
  GetNeighborSubcomponents: { label: 'GetNeighborSubcomponents', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'NeighborType', default: 0 }, { name: 'SelFilter', default: '' }, { name: 'Value', default: null }] },
  GrowSelection: { label: 'Grow Selection', category: 'Selection', args: [{ name: 'InputObjs', default: null }] },
  ShrinkSelection: { label: 'Shrink Selection', category: 'Selection', args: [] },
  SelectAdjacent: { label: 'Select Adjacent', category: 'Selection', args: [{ name: 'InputObjs', default: null }, { name: 'SelFilter', default: null }, { name: 'ExtendSelection', default: false }] },
  SelectNSidedPolygons: { label: 'Select N-Sided Polygons', category: 'Selection', description: 'Selects polygons that have the given numbers of edges', args: [{ name: 'InputObjs', default: null }, { name: 'Value', default: 5 }, { name: 'ExactEdgecount', default: false }] },
  SelectEdgeLoop: { label: 'Select Edge Loop', category: 'Selection', description: 'Select edge loops on polygon meshes', args: [{ name: 'InputObjs', default: null }] },
  SelectBoundaryEdgeLoop: { label: 'Select Boundary Edge Loop', category: 'Selection', description: 'Select boundary edge loops on polygon meshes', args: [{ name: 'InputObjs', default: null }] },
  SelectParallelEdgeLoop: { label: 'Select Parallel Edge Loop', category: 'Selection', description: 'Select Parallel edge loops on polygon meshes', args: [{ name: 'InputObjs', default: null }] },
  MakeAllUnselectable: { label: 'Make All Objects Selectable', category: 'Edit|Property', description: 'Sets the selectability of all objects to ON', args: [] },
  HideUnselected: { label: 'Hide Unselected Objects/Polygons', category: 'Viewing', description: 'Hides all unselected objects', args: [{ name: 'Target', default: null }, { name: 'PropertyName', default: 'visibility' }] },
  MoveToLayer: { label: 'Move Selection to Current Layer', category: 'Layer', args: [{ name: 'Target', default: '' }, { name: 'InputObjs', default: '' }] },
  SICreateLayerFromSelection: { label: 'New Layer From Selection', category: 'Layer', args: [{ name: 'PresetObj', default: '' }, { name: 'Name', default: '' }, { name: 'InputObjs', default: null }, { name: 'Value', default: null }] },
  SICreateLayerFromSelection2: { label: 'New Layer From Selection 2', category: 'Layer', args: [{ name: 'PresetObj', default: '' }, { name: 'Name', default: '' }, { name: 'InputObjs', default: null }, { name: 'LayerGroupName', default: '' }, { name: 'Value', default: null }] },
  SIHideObjects: { label: 'Hide Objects', category: 'Viewing', description: 'Make all objects invisible', args: [{ name: 'Target', default: null }, { name: 'PropertyName', default: 'visibility' }] },
  SIUnhideObjects: { label: 'Unhide Objects', category: 'Viewing', description: 'Make all objects invisible', args: [{ name: 'Target', default: null }, { name: 'PropertyName', default: 'visibility' }] },
  ToggleCurrentLayerProperty: { label: 'Viewport Visibility of Current Layer', category: 'Layer', args: [{ name: 'PropName', default: 'viewvis' }] },
  ToggleGhosting: { label: 'Ghost/Unghost Selection', category: 'Layer', args: [{ name: 'Target', default: null }, { name: 'PropertyName', default: 'ghosting' }, { name: 'ThreeState', default: false }] },
  UnghostAll: { label: 'Unghost All Objects', category: 'Viewing', description: 'Unghost all objects', args: [{ name: 'PropertyName', default: 'ghosting' }] },
  UnhideAll: { label: 'Unhide All Objects', category: 'Viewing', args: [{ name: 'PropertyName', default: 'visibility' }] },
};
export const B17A_NAMES = Object.keys(REG);

export function registerSelectionLayersB17aCommands(app: App) {
  const reg = (name: string, execute: CommandDef['execute'], undoable = true) => { const r = REG[name]; app.register({ name, label: r.label, category: r.category, description: r.description, args: r.args, undoable, execute }); };

  // ================================================================ selection.vbs

  const convert = (C: string) => (app: App, a: Record<string, any>) => {
    const inp = expandClusters(app, inputOf(app, a.InputObjs));
    const to = wantKind(a.SelFilter); const res: Sub[] = [];
    for (const s of inp.subs) {
      if (!s.items.length || !to) continue;   // a filter other than Point / Edge / Polygon converts nothing
      if (s.kind === to) res.push(s); else { const n = neighbours([s], 'adjacent', a.SelFilter); if (n) res.push(...n); }
    }
    selectSubs(app, C, res, 'replace');
    setSelFilter(app, a.SelFilter);
  };
  for (const n of ['ConvertSelection', 'ConvertSelectionToEdges', 'ConvertSelectionToPoints', 'ConvertSelectionToPolygons']) reg(n, convert(n), false);

  reg('GetNeighborSubcomponents', (app, a) => {
    const C = 'GetNeighborSubcomponents'; const inp = inputOf(app, a.InputObjs);
    const raw = a.NeighborType; let type: NType = null;
    if (typeof raw === 'string' && /^siAdjacent$/i.test(raw.trim())) type = 'adjacent';
    else if (typeof raw === 'string' && /^siGrow$/i.test(raw.trim())) type = 'grow';
    else {
      const n = Number(raw ?? 0); type = n === 0 ? 'adjacent' : n === 1 ? 'grow' : null;
      const to = wantKind(a.SelFilter);
      if (to && inp.subs.some(s => s.kind === to)) nya(app, C, `numeric NeighborType ${raw ?? 0} (Q1: values of siAdjacent / siGrow)${type ? `; taken as ${type === 'adjacent' ? 'siAdjacent' : 'siGrow'}` : '; same-type items are not queried'}`);
    }
    const r = neighbours(inp.subs, type, a.SelFilter);
    const v = r ? r.map(subString) : null;
    b17a(app).out[C] = { Value: v };
    return v;
  }, false);

  reg('SelectAdjacent', (app, a) => {
    const C = 'SelectAdjacent';
    const inp = expandClusters(app, inputOf(app, a.InputObjs));
    const found = neighbours(inp.subs, 'adjacent', a.SelFilter); if (!found) return;   // nothing found: no change at all
    selectSubs(app, C, found, isTrue(a.ExtendSelection) ? 'add' : 'replace');
    setSelFilter(app, a.SelFilter);
  }, false);

  const grow = (app: App, C: string, arg: any) => {
    const inp = expandClusters(app, inputOf(app, arg));
    for (const k of ['point', 'edge', 'polygon'] as const) {
      const list = inp.subs.filter(s => s.kind === k && s.items.length); if (!list.length) continue;
      const found = neighbours(list, 'grow', LABEL[k]);
      if (found) selectSubs(app, C, found, 'replace');   // each SelectObj replaces: with mixed types the last one stays
    }
  };
  reg('GrowSelection', (app, a) => { call(app, 'GrowSelection', a.InputObjs ?? null); grow(app, 'GrowSelection', a.InputObjs); }, false);

  reg('ShrinkSelection', (app) => {
    const C = 'ShrinkSelection';
    invertComponents(app);
    call(app, 'GrowSelection', null); grow(app, C, null);
    invertComponents(app);
    const gathered: Sub[] = [];
    for (const s of selectionInput(app).subs) {
      const m = meshOf(s.obj); if (!m) continue; const adj = T.adjacencyOf(m);
      const border = adj.edges.filter(k => (adj.edgePolys.get(k) ?? []).length === 1);   // Edge.IsBoundary, every edge of the mesh
      if (!border.length) continue;
      const items = s.kind === 'edge' ? border : [...incident(adj, 'edge', border, s.kind)];
      gathered.push({ obj: s.obj, kind: s.kind, items: sortItems(adj, s.kind, items) });
    }
    if (gathered.length) selectSubs(app, C, gathered, 'remove');
  }, false);

  reg('SelectNSidedPolygons', (app, a) => {
    const C = 'SelectNSidedPolygons';
    const inp = inputOf(app, a.InputObjs);
    const items: Node[] = [...inp.subs.map(s => s.obj), ...inp.clusters.map(c => c.obj).filter((o): o is X3DObject => !!o), ...inp.nodes];
    if (!items.length) { app.logMsg('info', 'Invalid Selection. Please select one or more polygon meshes first'); return; }
    const n = Number(a.Value); const exact = isTrue(a.ExactEdgecount);
    let any = false;
    for (const o of uniq(items)) {
      if (!(o instanceof X3DObject) || o.type !== 'polymsh') continue;
      const m = meshOf(o); if (!m) continue;
      const polys: number[] = []; m.polygons.forEach((f, i) => { if (exact ? f.length === n : f.length >= n) polys.push(i); });
      if (!polys.length) continue;
      if (!any) { call(app, 'DeselectAll'); app.compSel = null; app.select([]); any = true; }
      selectSubs(app, C, [{ obj: o, kind: 'polygon', items: polys }], 'add');
    }
    if (any) setSelFilter(app, 'Polygon'); else app.logMsg('info', 'No such polygon found.');
  }, false);

  reg('SelectEdgeLoop', edgeLoopCommand('SelectEdgeLoop', 0), false);
  reg('SelectBoundaryEdgeLoop', edgeLoopCommand('SelectBoundaryEdgeLoop', 1), false);
  reg('SelectParallelEdgeLoop', edgeLoopCommand('SelectParallelEdgeLoop', 2), false);

  reg('MakeAllUnselectable', (app) => {
    const C = 'MakeAllUnselectable';
    call(app, 'SetValue', '#Group*.selectability,Layers.List.*.selectability,Passes.List.*.*.selectability', 2);
    for (const g of [...app.scene.groupList, ...app.scene.layers, ...app.scene.passes.flatMap(p => p.partitions)]) setGroupParam(app, g, 'selectability', 2, C);
    setAllObjects(app, C, 'selectability', true);
  });

  // ================================================================ layers.vbs

  reg('SICreateLayerFromSelection', (app, a) => {
    call(app, 'SICreateLayer', a.PresetObj, a.Name);
    const l = app.run('SICreateLayer', { PresetObj: a.PresetObj, Name: a.Name });
    const objs = sceneObjects(inputOf(app, a.InputObjs));
    if (objs.length) { call(app, 'MoveToLayer', l?.name, objs.map(o => o.name)); app.run('MoveToLayer', { Target: l, InputObjs: objs }); }
    b17a(app).out.SICreateLayerFromSelection = { Value: l };
    noInspect(app); return l;
  });
  reg('SICreateLayerFromSelection2', (app, a) => {
    call(app, 'SICreateLayer2', a.PresetObj, a.Name, a.LayerGroupName);
    const l = app.run('SICreateLayer2', { PresetObj: a.PresetObj, Name: a.Name, LayerGroupName: a.LayerGroupName });
    const objs = sceneObjects(inputOf(app, a.InputObjs));
    if (objs.length) { call(app, 'MoveToLayer', l?.name, objs.map(o => o.name)); app.run('MoveToLayer', { Target: l, InputObjs: objs }); }
    b17a(app).out.SICreateLayerFromSelection2 = { Value: l };
    noInspect(app); return l;
  });

  reg('MoveToLayer', (app, a) => {
    const C = 'MoveToLayer';
    let layer: any = a.Target;
    if (empty(layer)) {
      // script entry "Move Selection to Current Layer": the current layer, then the C++ entry, then Target written back
      call(app, 'GetCurrentLayer'); layer = app.run('GetCurrentLayer');
      if (!(layer instanceof Layer)) throw new Error(`${C}: there is no current layer`);
      b17a(app).out.MoveToLayer = { Target: layer };
    }
    // C++ entry "Move Objects To Layer" (Target, InputObjs collections). Its own behaviour is outside this row (inferred).
    const l = layer instanceof Layer ? layer : app.scene.layers.find(x => x.name === String(layer) || x.fullName === String(layer));
    if (!l) throw new Error(`${C}: ${String(layer?.name ?? layer)} is not a layer`);
    const objs = uniq(sceneObjects(inputOf(app, a.InputObjs)).filter(o => o !== app.scene.root));
    call(app, 'MoveToLayer(C++)', l.name, objs.map(o => o.name));
    const prev = objs.map(o => o.layer);
    if (objs.length) app.record('Move to Layer', () => { for (const o of objs) { o.layer?.members.delete(o); o.layer = l; l.members.add(o); } },
      () => { objs.forEach((o, i) => { l.members.delete(o); o.layer = prev[i]; prev[i]?.members.add(o); }); });
    return l;
  });

  reg('ToggleCurrentLayerProperty', (app, a) => {
    const p = String(a.PropName ?? '');
    let layer: any = null; call(app, 'GetCurrentLayer');
    try { layer = app.run('GetCurrentLayer'); } catch { return; }   // errors ignored
    if (!isGroupLike(layer)) return;
    const q = layer.get(p); if (!q) return;
    const v = Number(q.value); const nv = cycle2(p, v); if (nv === v) return;
    call(app, 'SetValue', `${layer.fullName}.${p}`, nv); app.setParam(q, nv, 'ToggleCurrentLayerProperty');
  });

  reg('ToggleGhosting', (app, a) => {
    const C = 'ToggleGhosting';
    const prop = empty(a.PropertyName) ? 'ghosting' : String(a.PropertyName);
    const three = isTrue(a.ThreeState);
    const inp = inputOf(app, a.Target);
    const next = (p: string, v: number) => three ? cycle3(v) : cycle2(p, v);
    if (prop === 'visibility') {
      // fast path
      for (const g of groupLikes(inp)) {
        const v = gval(g, 'viewvis'); if (v === undefined) continue; const nv = next('viewvis', v);
        call(app, 'SetValue', `${g.fullName}.viewvis,${g.fullName}.rendvis`, nv); setGroupParam(app, g, 'viewvis', nv, C); setGroupParam(app, g, 'rendvis', nv, C);
      }
      const setList: Parameter[] = [], unsetList: Parameter[] = []; const skipped: { o: X3DObject; p: string }[] = [];
      for (const o of sceneObjects(inp)) {
        const nv = !(visParam(o, 'viewvis')?.value === true);
        const targets = inBranch(app, o) ? [o, ...o.descendants()] : [o];
        for (const t of targets) for (const p of ['viewvis', 'rendvis']) {
          const q = visParam(t, p); if (!q) continue;
          if (readOnly(q)) { skipped.push({ o: t, p }); continue; }
          (nv ? setList : unsetList).push(q);
        }
      }
      interferenceWarning(app, skipped);
      if (setList.length) { call(app, 'SetValue', setList.map(q => q.fullName).join(','), true); for (const q of setList) app.setParam(q, true, C); }
      if (unsetList.length) { call(app, 'SetValue', unsetList.map(q => q.fullName).join(','), false); for (const q of unsetList) app.setParam(q, false, C); }
      hidePolygons(app, C, inp, 'toggle');
      return;
    }
    const ps = paramList(prop);
    for (const g of groupLikes(inp)) for (const p of ps) {
      const v = gval(g, p); if (v === undefined) continue; const nv = next(p, v);
      call(app, 'SetValue', `${g.fullName}.${p}`, nv); setGroupParam(app, g, p, nv, C);
    }
    for (const o of sceneObjects(inp)) {
      const branch = inBranch(app, o);
      for (const p of ps) {
        const nv = !(visParam(o, p)?.value === true);
        call(app, 'SetValue', `${o.fullName}.visibility.${p}`, nv); setObjVis(app, o, p, nv, C);
        if (branch) for (const d of o.descendants()) { call(app, 'SetValue', `${d.fullName}.visibility.${p}`, nv); setObjVis(app, d, p, nv, C); }   // FindChildren, errors ignored
      }
    }
  });

  reg('SIHideObjects', (app, a) => hideOrUnhide(app, 'SIHideObjects', a, true));
  reg('SIUnhideObjects', (app, a) => hideOrUnhide(app, 'SIUnhideObjects', a, false));

  reg('HideUnselected', (app, a) => {
    const C = 'HideUnselected';
    const prop = empty(a.PropertyName) ? 'visibility' : a.PropertyName;
    const inp = inputOf(app, a.Target);
    const polySubs = inp.subs.filter(s => s.kind === 'polygon');
    const polyClusters = inp.clusters.filter(c => c.compKind === 'poly');
    if (!polySubs.length && !polyClusters.length) {
      invertObjects(app);
      call(app, 'SIHideObjects', null, prop); hideOrUnhide(app, 'SIHideObjects', { Target: null, PropertyName: prop }, true);
      invertObjects(app);
      return;
    }
    const restore = [...polySubs, ...polyClusters.map(clusterSub).filter((s): s is Sub => !!s)];
    for (const c of polyClusters) { const s = clusterSub(c); if (s) selectSubs(app, C, [s], 'add'); }
    if (polyClusters.length) { call(app, 'RemoveFromSelection', polyClusters.map(c => c.fullName)); app.selection = app.selection.filter(n => !polyClusters.includes(n as Cluster)); app.events.emit('selection'); }
    invertComponents(app, 'polygon');
    call(app, 'SIHideObjects', null, prop); hideOrUnhide(app, 'SIHideObjects', { Target: null, PropertyName: prop }, true);
    call(app, 'SelectGeometryComponents', restore.map(subString));
    const m = merge(restore)[0]; if (m) { app.setSelMode('polygon'); app.selectComponents(m.obj, 'polygon', m.items, 'replace'); }
  });

  reg('UnhideAll', unhideAll('UnhideAll', 'visibility'));
  reg('UnghostAll', unhideAll('UnghostAll', 'ghosting'));
}
