// Ledger row CMD-B19b: 30 tasks.dll / environments.dll / selectionmgr.dll commands (scene New / Open / Save /
// DeleteAll, clipboard Copy / Cut / Paste / CopyUVW / PasteUVW, layers, loop / outline / island selection, presets,
// environments, InspectLastOperator, RemoveFolder, InstallCustomPreferences, DeselectAllUsingFilter, PlotShape /
// LinkDeform).
// Brief: docs/ghidra/cmd-b19b-tasks-scene-layers-loops.md section 3 ("Wire contract" per command) and section 5, and
// the CMD-B19b section of docs/re/WIRE_CORRECTIONS_B19.md. Original code written from that prose contract only; no
// XSIBATCH golden exists for the row.
//
// Earlier registrations of these names (index.ts NewScene, viewEditProperty.ts DeleteAll, ui.ts OpenScene / SaveScene,
// model.ts / model2.ts Copy / Paste, anim.ts SetCurrentLayer / PlotShape / LinkDeform, selectionGroupLayer.ts loops /
// outline / island / layers / DeselectAllUsingFilter, inferredB10Scene.ts RemoveFolder / InstallCustomPreferences,
// moduleToolbar.ts CopyUVW / PasteUVW / CreateEnvironment, viewEditPropertyMore.ts InspectLastOperator) were removed;
// this module is the only registration of the 30 names. Argument lists are data/command_registry.json's (hidden
// arguments included; the tasks.dll entry where a name has several).
//
// Conventions of the row:
//  * A failing HRESULT is thrown as SiStatusError ("<command>: <what> (status 0x...)"). Success statuses (0, 1 = S_FALSE,
//    0x562E80C7 = cancelled / info) are kept in `app.tasksB19b.status[<command>]`.
//  * Sub-tasks the contract names (SelectObj, AddToSelection, RemoveFromSelection, OpenScene, SICreateLayer,
//    MoveObjectToLayer, DeleteObj, InspectObj, ...) are recorded in `app.tasksB19b.calls` in contract order.
//  * Output arguments are kept in `app.tasksB19b.out[<command>]` and also returned.
//  * Branches the analyst could not read (SPEC-PARTIAL parts, section 4 open questions) log
//    "<command>: not yet attested: <what> (CMD-B19b)" and change nothing for that branch.
//  * Pieces marked `// inferred` are reasoned from the contract, not read from it.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model, Null, Layer, Property, Cluster } from '../core/scene';
import { str } from '../core/params';
import type { CompKind } from '../core/topology';
import { hostFs } from '../core/sdkHelpersHostFs';
import { propertyUVs, resolveUVProperty, isUVProperty } from '../core/textureProjectionScripts';
import { sampleOffsets } from '../core/texturing';
import { SiStatusError } from './alembicSeqCam';
import { ensureSoftimageDefaultScene } from '../core/softimageDefaultScene';
import { runScriptLine } from '../ui/si';
import * as T from './selectionGroupLayerTopology';
import type { CompItem } from './selectionGroupLayerTopology';
import { resolve, objectFilter, filterKind } from './selectionGroupLayer';
import { deleteObjList } from './tasksB16c';
import { FolderNode, foldersOf } from './inferredB10Scene';
import { sdkHelpersState } from './sdkHelpers';
import { pref } from './uixsiKeysSourcesMaterialsShared';
import { stateOf as b11cState, findConverter, frameworkSaveScene, currentSceneName, EV_CUSTOM_EXPORT } from './tasksB11cShared';
import { simEnvironment, type SimContainer } from './duplicateRenderingSimulationScriptsSimulation';

export const ROW = 'CMD-B19b';
export const S_OK = 0, S_FALSE = 1, SI_CANCELLED = 0x562e80c7;
export const E_FAIL = 0x80004005, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002, E_UNEXPECTED = 0x8000ffff;
export const E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005;
/** Custom file-format events (found by extension). */
export const EV_CUSTOM_IMPORT = 0x20510026;
export const DEFAULT_LAYER_PRESET = '{42FC2493-732F-11d2-AC52-00A02485CECB}:Default_New_Layer';

// ------------------------------------------------------------------ state

export interface SceneIOService {
  /** New scene; returns 1 when the confirmation was cancelled, else 0. */
  newScene(app: App, confirm: boolean): number;
  /** Open a native scene file; false = failure. */
  open(app: App, file: string, confirm: boolean): boolean;
  /** Save the scene to its native file; false = failure. */
  save(app: App, file: string): boolean;
  /** Save in the alternative app mode (inferred: export). */
  saveAlt(app: App, file: string): boolean;
  /** Whether a default scene file can be opened (file object slot 14, inferred: it exists). */
  usable(app: App, file: string): boolean;
}
export interface UVClip { kind: 'cluster' | 'subcomponent'; samples: number[]; uvs: number[]; source: string }
export interface B19bState {
  status: Record<string, number>;
  calls: { cmd: string; args: any[] }[];
  out: Record<string, Record<string, any>>;
  /** The scene I/O service (outside tasks.dll). null = no service: NewScene does nothing, Open / Save fail. */
  service: SceneIOService | null;
  hooks: {
    /** Answer of the service's save-changes confirmation (true = go on). null = no dialog in this build. */
    confirmNewScene: (() => boolean) | null;
    /** The modal preset browser: the chosen preset, or null for cancel. null = no browser in this build. */
    presetBrowser: ((root: string, family: string | null) => string | null) | null;
  };
  /** Current scene file ('' = untitled). */
  sceneFile: string;
  /** Alternative app mode (the .EXP branch). */
  altMode: boolean;
  /** Ambient values written by the scene tasks. */
  ambient: Record<string, string>;
  /** Custom import converters by lower-case extension (stand-in for F3DFindCustomConverterEventName, 0x20510026). */
  importers: Map<string, { name: string; handler: (app: App, file: string) => number | void }>;
  registerCustomImporter(ext: string, name: string, handler: (app: App, file: string) => number | void): void;
  /** Events fired: [id, name, file]. */
  events: [number, string, string][];
  /** RECENT_SCENES_MENU entries. */
  recent: string[];
  /** The scene clipboard: the objects copied / cut. */
  clipboard: { items: Node[]; cut: boolean; detached: Set<Node> };
  /** The UV clipboard (CopyUVW / PasteUVW). */
  uvClipboard: UVClip | null;
  /** The environment container (F3DGetEnvironmentContainer). */
  environments: X3DObject[];
  /** Nodes opened in a property page by InspectLastOperator. */
  inspected: Node[];
}
export function b19b(app: App): B19bState {
  const A = app as any;
  if (!A.tasksB19b) {
    const st: B19bState = {
      status: {}, calls: [], out: {}, service: null, hooks: { confirmNewScene: null, presetBrowser: null },
      sceneFile: '', altMode: false, ambient: {}, importers: new Map(), events: [], recent: [],
      registerCustomImporter(ext, name, handler) { st.importers.set(String(ext).replace(/^\./, '').toLowerCase(), { name, handler }); },
      clipboard: { items: [], cut: false, detached: new Set() }, uvClipboard: null, environments: [], inspected: [],
    };
    A.tasksB19b = st;
  }
  return A.tasksB19b;
}
const call = (app: App, cmd: string, ...args: any[]) => { b19b(app).calls.push({ cmd, args }); };
const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
const setStatus = (app: App, cmd: string, s: number) => { b19b(app).status[cmd] = s; return s; };
export const logNya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
/** Severity 2 (warning) message of the XSITASKS dictionary (the log knows info / error only). */
const warn = (app: App, id: number, text: string) => app.logMsg('info', `WARNING : ${text} (XSITASKS 0x${id.toString(16)})`);

const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const bool = (v: any, d = false) => v === undefined || v === null || v === '' ? d : typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;
const nameOf = (n: any) => n?.fullName ?? n?.name ?? String(n);
const uniq = <N>(l: N[]): N[] => [...new Set(l)];
const meshOf = (o: X3DObject | null | undefined) => o?.primitive?.mesh() ?? null;
const ext = (file: string) => { const b = hostFs.baseName(file); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };

/** Keep run() from auto-inspecting a returned node (these tasks do not inspect what they create). */
function noInspect(app: App) { if (!app.autoInspect) return; app.autoInspect = false; queueMicrotask(() => { app.autoInspect = true; }); }

// ------------------------------------------------------------------ argument resolution

/** One sub-component item of a list (kind 7): an object, a component type, its elements. */
export interface Sub { obj: X3DObject; kind: CompKind; items: CompItem[] }
const LABEL: Record<CompKind, string> = { point: 'Point', edge: 'Edge', polygon: 'Polygon' };

function compSetOf(app: App): CompItem[] {
  const c = app.compSel; if (!c) return [];
  return [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)];
}
/** A collection argument: nodes and sub-component items; unset = the selection (the component selection is one item). */
function listArg(app: App, arg: any, selectionFallback = true): { nodes: Node[]; subs: Sub[] } {
  if (unset(arg)) {
    if (!selectionFallback) return { nodes: [], subs: [] };
    const c = app.compSel; const items = compSetOf(app);
    if (c && items.length) return { nodes: app.selection.filter(n => n !== c.obj), subs: [{ obj: c.obj, kind: c.kind, items }] };
    return { nodes: [...app.selection], subs: [] };
  }
  const nodes: Node[] = []; const subs: Sub[] = [];
  const raw = Array.isArray(arg) ? arg : [arg];
  for (const x of raw) {
    if (x && typeof x === 'object' && x.obj instanceof X3DObject && typeof x.kind === 'string' && Array.isArray(x.items)) { subs.push({ obj: x.obj, kind: x.kind, items: [...x.items] }); continue; }
    if (x instanceof Node) { if (!nodes.includes(x)) nodes.push(x); continue; }
    const r = resolve(app, x);
    for (const n of r.nodes) if (!nodes.includes(n)) nodes.push(n);
    for (const c of r.comps) subs.push({ obj: c.obj, kind: c.kind, items: [...c.items] });
    if (typeof x === 'string' && !r.nodes.length && !r.comps.length) for (const t of x.split(',').map(s => s.trim()).filter(Boolean)) {
      const l = layerByName(app, t) ?? app.scene.passes.find(p => p.name === t || `Passes.${p.name}` === t);
      if (l && !nodes.includes(l)) nodes.push(l);
    }
  }
  return { nodes, subs };
}
const layerByName = (app: App, s: string) => app.scene.layers.find(l => l.name === s || l.fullName === s || `Layers.${l.name}` === s);
/** One scene-item argument. */
function itemArg(app: App, v: any): Node | null {
  if (unset(v)) return null;
  if (v instanceof Node) return v;
  if (Array.isArray(v)) return itemArg(app, v[0]);
  if (typeof v === 'string') { const s = v.trim(); return layerByName(app, s) ?? listArg(app, s).nodes[0] ?? null; }
  return null;
}

// ------------------------------------------------------------------ selection sub-tasks (undoable)

interface SelSnap { sel: Node[]; comp: App['compSel']; mode: App['selMode']; filter: any }
function snap(app: App): SelSnap {
  const c = app.compSel;
  return { sel: [...app.selection], comp: c ? { obj: c.obj, kind: c.kind, points: new Set(c.points), edges: new Set(c.edges), polygons: new Set(c.polygons) } : null, mode: app.selMode, filter: (app as any).selFilter };
}
function restore(app: App, s: SelSnap) {
  const c = s.comp;
  app.compSel = c ? { obj: c.obj, kind: c.kind, points: new Set(c.points), edges: new Set(c.edges), polygons: new Set(c.polygons) } : null;
  app.selMode = s.mode; (app as any).selFilter = s.filter; app.selection = [...s.sel]; app.events.emit('selection');
}
/** One selection sub-task (SelectObj 79581ba0 / AddToSelection 38eddd00 / RemoveFromSelection 38eddd02), queued for undo. */
function selTask(app: App, label: string, args: any[], apply: () => void) {
  call(app, label, ...args);
  const before = snap(app); apply(); const after = snap(app);
  app.record(label, () => restore(app, after), () => restore(app, before));
}
const subText = (s: Sub): string => {
  const m = meshOf(s.obj); const tok = s.kind === 'point' ? 'pnt' : s.kind === 'edge' ? 'edge' : 'poly';
  if (!m) return `${s.obj.name}.${tok}[]`;
  const adj = T.adjacencyOf(m);
  const idx = s.items.map(it => s.kind === 'edge' ? adj.edgeIndex.get(it as string) ?? -1 : it as number).filter(i => i >= 0).sort((a, b) => a - b);
  return `${s.obj.name}.${tok}[${idx.join(',')}]`;
};
function selectSubs(app: App, cmd: string, subs: Sub[], mode: 'replace' | 'add' | 'remove') {
  const label = mode === 'replace' ? 'SelectObj' : mode === 'add' ? 'AddToSelection' : 'RemoveFromSelection';
  const list: Sub[] = [];
  for (const s of subs) { const m = list.find(x => x.obj === s.obj && x.kind === s.kind); if (m) m.items = uniq([...m.items, ...s.items]); else list.push({ ...s, items: uniq([...s.items]) }); }
  selTask(app, label, [list.map(subText)], () => {
    if (list.length > 1) app.logMsg('info', `${cmd}: the component selection holds one object and one component type in this build; ${list.slice(1).map(subText).join(', ')} not ${mode === 'remove' ? 'removed' : 'selected'}`);
    const s = list[0]; if (!s) return;
    if (mode === 'remove') {
      const c = app.compSel; if (!c || c.obj !== s.obj || c.kind !== s.kind) return;
      app.selectComponents(s.obj, s.kind, compSetOf(app).filter(x => !s.items.includes(x)), 'replace'); return;
    }
    (app as any).selFilter = LABEL[s.kind]; app.setSelMode(s.kind);
    app.selectComponents(s.obj, s.kind, s.items, mode === 'add' ? 'add' : 'replace');
  });
}

// ------------------------------------------------------------------ loop walking (inferred per-type rules, Q2)

const otherEnd = (k: string, v: number) => { const [a, b] = T.edgeVerts(k); return a === v ? b : a; };
const edgeKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
/** inferred: the polygon across `via` from `p` continues through the opposite edge of `p` (quads only). */
function polyAcross(adj: T.Adjacency, p: number, via: string): { next: number; edge: string } | null {
  const pe = adj.polyEdges[p] ?? []; if (pe.length !== 4) return null;
  const i = pe.indexOf(via); if (i < 0) return null;
  const opp = pe[(i + 2) % 4];
  const next = (adj.edgePolys.get(opp) ?? []).find(q => q !== p);
  return next === undefined ? null : { next, edge: opp };
}
/** The loop path between two components (mode 2), or null. aroundCorners = false cuts the path at corner points. */
function loopPath(adj: T.Adjacency, kind: CompKind, a: CompItem, b: CompItem, aroundCorners: boolean): CompItem[] | null {
  const limit = adj.edges.length + adj.mesh.polygons.length + 4;
  let best: CompItem[] | null = null;
  const keep = (p: CompItem[]) => { if (!best || p.length < best.length) best = p; };
  if (kind === 'point') {
    for (const e0 of adj.vertEdges[a as number] ?? []) {
      let cur = e0, at = otherEnd(e0, a as number); const path: CompItem[] = [a, at];
      for (let n = 0; n < limit && at !== b; n++) {
        const nx = T.loopNext(adj, cur, at, { aroundCorners }); if (!nx) break;
        at = otherEnd(nx, at); if (path.includes(at)) break; path.push(at); cur = nx;
      }
      if (at === b) keep(path);
    }
  } else if (kind === 'edge') {
    for (const v0 of T.edgeVerts(a as string)) {
      let cur = a as string, at = v0; const path: CompItem[] = [cur];
      for (let n = 0; n < limit && cur !== b; n++) {
        const nx = T.loopNext(adj, cur, at, { aroundCorners }); if (!nx || path.includes(nx)) break;
        path.push(nx); at = otherEnd(nx, at); cur = nx;
      }
      if (cur === b) keep(path);
    }
  } else {
    for (const s0 of adj.polyEdges[a as number] ?? []) {
      let cur = a as number; let via = s0; const path: CompItem[] = [cur];
      const first = (adj.edgePolys.get(s0) ?? []).find(q => q !== cur); if (first === undefined) continue;
      cur = first; path.push(cur);
      for (let n = 0; n < limit && cur !== b; n++) {
        const st = polyAcross(adj, cur, via); if (!st || path.includes(st.next)) break;
        via = st.edge; cur = st.next; path.push(cur);
      }
      if (cur === b) keep(path);
    }
  }
  return best;
}
/** The selected loop neighbours of an item (edges: through each end point; points: along edges; polygons: across edges). */
function loopNeighbours(adj: T.Adjacency, kind: CompKind, it: CompItem, sel: Set<CompItem>, aroundCorners: boolean): CompItem[] {
  if (kind === 'point') return (adj.vertEdges[it as number] ?? []).map(e => otherEnd(e, it as number)).filter(w => sel.has(w));
  if (kind === 'polygon') return (adj.polyEdges[it as number] ?? []).flatMap(e => (adj.edgePolys.get(e) ?? []).filter(q => q !== it && sel.has(q)));
  return T.edgeVerts(it as string).map(v => T.loopNext(adj, it as string, v, { aroundCorners })).filter((x): x is string => !!x && sel.has(x));
}
/** inferred: one component further along the loop at each end of every selected run. */
function loopEnds(adj: T.Adjacency, kind: CompKind, sel: Set<CompItem>, aroundCorners: boolean): { added: CompItem[]; ends: CompItem[] } {
  const added = new Set<CompItem>(); const ends = new Set<CompItem>();
  for (const it of sel) {
    if (kind === 'edge') {
      let end = false;
      for (const v of T.edgeVerts(it as string)) { const nx = T.loopNext(adj, it as string, v, { aroundCorners }); if (!nx || !sel.has(nx)) { end = true; if (nx) added.add(nx); } }
      if (end) ends.add(it);
      continue;
    }
    const nb = loopNeighbours(adj, kind, it, sel, aroundCorners);
    if (nb.length > 1) continue;
    ends.add(it);
    if (nb.length !== 1) continue;   // an isolated component has no loop direction
    const w = nb[0];
    if (kind === 'point') { const e = edgeKey(w as number, it as number); const nx = T.loopNext(adj, e, it as number, { aroundCorners }); if (nx) { const c = otherEnd(nx, it as number); if (!sel.has(c)) added.add(c); } }
    else { const via = (adj.polyEdges[it as number] ?? []).find(e => (adj.edgePolys.get(e) ?? []).includes(w as number)); const st = via ? polyAcross(adj, it as number, via) : null; if (st && !sel.has(st.next)) added.add(st.next); }
  }
  return { added: [...added], ends: [...ends] };
}
/** Sub-component items of the input whose type is point / edge / polygon (other types skipped silently). */
const loopInputs = (app: App, arg: any) => listArg(app, arg).subs.filter(s => s.items.length && meshOf(s.obj) && (s.kind === 'point' || s.kind === 'edge' || s.kind === 'polygon'));

// ------------------------------------------------------------------ scene I/O

/** The scene reset of the default service: empty scene with the Softimage default camera / light. */
export function resetScene(app: App) {
  app.scene = new (app.scene.constructor as any)();
  app.anim.stop(); app.anim.fcurves.clear(); app.anim.expressions.clear(); app.anim.marked.clear(); app.anim.markingSets.clear();
  app.anim.frame = app.anim.startFrame = 1; app.anim.endFrame = 100;
  delete (app as any).currentKeySet; delete (app as any).currentKeySetName; delete (app as any).keySets; delete (app as any).currentLayer;
  app.undoStack = []; app.redoStack = []; app.select([]); app.compSel = null; app.setTool?.(null);
  app.events.emit('newscene');
  ensureSoftimageDefaultScene(app);
}
const sceneKey = (file: string) => 'si.scene.' + hostFs.baseName(file).replace(/\.(scn|exp)(\.txt)?$/i, '');
/** The default scene I/O service of this build: scenes are command scripts (what main.ts saves). */
export function defaultSceneService(): SceneIOService {
  const load = (app: App, text: string) => {
    resetScene(app);
    const ai = app.autoInspect; app.autoInspect = false;
    try { for (const line of text.split(/\r?\n/)) if (line.trim()) { try { runScriptLine(app, line); } catch { /* logged */ } } } finally { app.autoInspect = ai; }
    app.select([]);
  };
  const read = (file: string): string | null => {
    try { if (hostFs.isFile(file)) return hostFs.readFile(file); } catch { /* not there */ }
    try { const t = localStorage.getItem(sceneKey(file)); if (t !== null) return t; } catch { /* no storage */ }
    return null;
  };
  const write = (app: App, file: string) => {
    if (frameworkSaveScene(app, 'SaveScene', file) !== S_OK) return false;
    try { localStorage.setItem(sceneKey(file), hostFs.readFile(file)); } catch { /* no storage */ }
    return true;
  };
  return {
    newScene(app, confirm) {
      const st = b19b(app);
      if (confirm && app.undoStack.length) {   // inferred: the service asks only when the scene has changes
        if (st.hooks.confirmNewScene) { if (!st.hooks.confirmNewScene()) return 1; }
        else logNya(app, 'NewScene', 'the save-changes confirmation of the scene I/O service (outside tasks.dll); the scene is replaced without asking');
      }
      resetScene(app); st.sceneFile = '';
      return 0;
    },
    open(app, file, confirm) {
      const text = read(file); if (text === null) return false;
      if (this.newScene(app, confirm) === 1) return false;
      load(app, text); b19b(app).sceneFile = file; return true;
    },
    save: (app, file) => write(app, file),
    saveAlt(app, file) { logNya(app, 'SaveScene', 'service slot 6 (save in the alternative app mode, inferred: export); saved as a native scene'); return write(app, file); },
    usable: (_app, file) => read(file) !== null,   // inferred: "usable" = the file can be read
  };
}
const serviceOf = (app: App): SceneIOService | null => b19b(app).service;

function newSceneTask(app: App, C: string, a: Record<string, any>) {
  const st = b19b(app);
  if (!unset(a.ProjectPathName)) logNya(app, C, `ProjectPathName "${a.ProjectPathName}" (not read by tasks.dll)`);
  const svc = serviceOf(app); if (!svc) { setStatus(app, C, S_FALSE); return undefined; }   // no service: nothing happens
  const confirm = bool(a.Confirm, true);
  const path = String(pref(app, 'data_management.default_scene_path', '') ?? '').trim();
  const plain = () => { (app as any).progressBar = null; if (svc.newScene(app, confirm) === 1) return setStatus(app, C, SI_CANCELLED); return setStatus(app, C, S_FALSE); };
  if (!path) { plain(); return undefined; }
  if (!svc.usable(app, path)) { warn(app, 0x422, `${C}: the default scene "${path}" cannot be used; an empty scene is created`); plain(); return undefined; }
  st.ambient.DS_SZ_SEGMENT_PATHNAME = path;
  try { call(app, 'OpenScene', path, confirm); openSceneTask(app, 'OpenScene', { SceneFileName: path, Confirm: confirm, ApplyAuxiliaryData: false }, false); }
  finally { st.ambient.DS_SZ_SEGMENT_PATHNAME = ''; }
  setStatus(app, C, S_FALSE);
  return undefined;
}
function openSceneTask(app: App, C: string, a: Record<string, any>, ownCommand: boolean) {
  const st = b19b(app);
  const svc = serviceOf(app); if (!svc) throw fail(C, E_FAIL, 'no scene I/O service');
  const file = unset(a.SceneFileName) ? '' : String(a.SceneFileName);
  const confirm = bool(a.Confirm, true);
  const applyAux = ownCommand ? bool(a.ApplyAuxiliaryData, false) : false;   // read only when the command is OpenScene itself
  if (!file) {
    // inferred: the file argument handler asks for a file (the UI's open dialog)
    logNya(app, C, 'browsing for a scene file when SceneFileName is empty (file argument handler 6f97fb91); the File > Open dialog is used');
    try { window.dispatchEvent(new CustomEvent('openscene')); } catch { /* no DOM */ }
    setStatus(app, C, SI_CANCELLED); return undefined;
  }
  st.ambient['c3dsceneiotask.scenename'] = hostFs.baseName(file);
  const e = ext(file);
  if (e === 'scn' || (st.altMode && e === 'exp')) {
    if (!svc.open(app, file, confirm)) { setStatus(app, C, SI_CANCELLED); return undefined; }
  } else {
    if (svc.newScene(app, confirm) === 1) { setStatus(app, C, SI_CANCELLED); return undefined; }
    const imp = st.importers.get(e);
    if (!imp) throw fail(C, E_INVALIDARG, `no custom importer is registered for ".${e}" files`);
    st.events.push([EV_CUSTOM_IMPORT, imp.name, file]);
    const r = imp.handler(app, file);
    if (typeof r === 'number' && r !== S_OK && r !== S_FALSE) { setStatus(app, C, SI_CANCELLED); return undefined; }
    st.ambient.DS_SZ_SEGMENT_PATHNAME = file;
    const prefs = ((app as any).prefValues ??= {});
    prefs['data_management.last_sequence_name'] = hostFs.baseName(file);
    prefs['data_management.last_sequence_dir'] = hostFs.parentPath(file);
    if ((app as any).Interactive !== false) { st.recent = [file, ...st.recent.filter(x => x !== file)].slice(0, 10); }
    st.sceneFile = file;
  }
  if (applyAux) logNya(app, C, 'applying the auxiliary data of the opened scene (outside tasks.dll)');
  app.events.emit('scene');   // the post-open refresh
  setStatus(app, C, S_FALSE);
  return undefined;
}
function saveSceneTask(app: App, C: string) {
  const st = b19b(app);
  (app as any).progressBar = null;
  const svc = serviceOf(app); if (!svc) throw fail(C, E_FAIL, 'no scene I/O service');
  let file = st.sceneFile;
  if (!file) { const n = currentSceneName(); if (n && n !== 'Untitled') file = n + '.scn'; }
  if (!file) {
    // inferred: an untitled scene has no file to save to; the UI's Save As asks for one
    logNya(app, C, 'saving an untitled scene (no current scene file); the File > Save As dialog is used');
    try { window.dispatchEvent(new CustomEvent('savescene', { detail: { as: true } })); } catch { /* no DOM */ }
    setStatus(app, C, SI_CANCELLED); return undefined;
  }
  const e = ext(file); let ok: boolean;
  if (st.altMode && e === 'scn') ok = svc.saveAlt(app, file);
  else if (e === 'scn' || e === '' || (st.altMode && e === 'exp')) ok = svc.save(app, file);
  else {
    const conv = findConverter(app, e);
    if (!conv) throw fail(C, E_INVALIDARG, `no custom exporter is registered for ".${e}" files`);
    st.events.push([EV_CUSTOM_EXPORT, conv.name, file]); b11cState(app).events.push({ id: EV_CUSTOM_EXPORT, name: conv.name, fileName: file });
    let r: any; try { r = conv.handler?.({ command: C, fileName: file, target: [app.scene.root], frame: app.anim.frame, userData: null }); } catch (err: any) { app.logMsg('error', `${C}: ${err?.message ?? err}`); r = E_FAIL; }
    ok = typeof r !== 'number' || r === S_OK || r === S_FALSE;
  }
  if (!ok) { warn(app, 0x439, `${C}: save failed ${file}`); throw fail(C, E_FAIL, `save failed ${file}`); }
  st.sceneFile = file;
  setStatus(app, C, S_FALSE);
  return undefined;
}

// ------------------------------------------------------------------ clipboard

const objectsIn = (nodes: Node[]) => nodes.filter((n): n is X3DObject => n instanceof X3DObject);
function inScene(app: App, o: X3DObject) { let x: X3DObject | null = o; while (x) { if (x === app.scene.root) return true; x = x.parentObj; } return false; }

// ------------------------------------------------------------------ layers

const parentLayerOf = (l: Layer): Layer | null => (l as any).parentLayer ?? null;
const isLayerUnder = (l: Layer, ancestor: Layer) => { let p = parentLayerOf(l); while (p) { if (p === ancestor) return true; p = parentLayerOf(p); } return false; };
/** inferred: a preset is a layer preset when its name names a layer (the created object's hierarchy type is 4). */
const presetName = (p: any) => String(p ?? '').split(':').pop()!.split(/[\\/]/).pop()!.replace(/\.preset$/i, '');
const isLayerPreset = (p: any) => /layer/i.test(presetName(p));

function createLayerTask(app: App, C: string, a: Record<string, any>): Layer | null {
  if (a.PresetObj === null) throw fail(C, E_INVALIDARG, 'PresetObj is missing');
  const preset = unset(a.PresetObj) ? DEFAULT_LAYER_PRESET : a.PresetObj;   // inferred: an empty preset takes the registry default
  if (C === 'SICreateLayer2' && !unset(a.LayerGroupName) && typeof a.LayerGroupName === 'string') call(app, 'LayerGroupName (read, not used)', a.LayerGroupName);
  if (!isLayerPreset(preset)) { warn(app, 0x419, `${C}: ${presetName(preset)} is not a layer preset`); setStatus(app, C, S_OK); return null; }
  const name = typeof a.Name === 'string' && a.Name ? a.Name : null;
  // inferred: the object made from the preset is called "Layer" (made unique by the preset creation); Name is set as given
  const l = new Layer(name ?? app.scene.uniqueName('Layer'));
  const ls = app.scene.layers; const A = app as any;
  app.record(C, () => { l.parent = app.scene; if (!ls.includes(l)) ls.push(l); },   // inferred: "position 0" = appended
    () => { const i = ls.indexOf(l); if (i >= 0) ls.splice(i, 1); if (A.currentLayer === l) A.currentLayer = ls[0]; });
  b19b(app).out[C] = { Value: l };
  setStatus(app, C, S_OK);
  return l;
}
function moveObjectToLayerTask(app: App, C: string, target: any, inputs: any) {
  const layer = listArg(app, target, false).nodes.find((n): n is Layer => n instanceof Layer);
  if (!layer) throw fail(C, E_INVALIDARG, 'Target holds no layer');
  const items = listArg(app, inputs).nodes;
  for (const n of items) {
    if (n instanceof Layer) {
      // a layer is nested under the target layer
      if (n === layer || isLayerUnder(layer, n)) { warn(app, 0x41a, `${C}: ${n.name} cannot be moved into ${layer.name}`); continue; }
      const prev = parentLayerOf(n); if (prev === layer) continue;
      app.record(C, () => { (n as any).parentLayer = layer; }, () => { (n as any).parentLayer = prev; });
      continue;
    }
    if (!(n instanceof X3DObject)) { logNya(app, C, `moving ${nameOf(n)} (not a component hierarchy: fallback sub-task 0x18009cdb8)`); continue; }
    if (n === app.scene.root || n instanceof Model && !n.parentObj) throw fail(C, E_INVALIDARG, `${n.name} cannot go to layer ${layer.name} (XSITASKS 0x435)`);   // inferred: the scene root has no layer
    if ((n as any).refModelLocked) logNya(app, C, `the local-modification flag of the referenced model of ${n.name} (F3DRemoveLocalModifOnRefModel)`);
    const prev = n.layer; if (prev === layer) continue;
    app.record(C, () => { prev?.members.delete(n); n.layer = layer; layer.members.add(n); }, () => { layer.members.delete(n); n.layer = prev; prev?.members.add(n); });
  }
  app.events.emit('scene');   // render visibility re-evaluated (F3DCanBeRendered)
  setStatus(app, C, S_FALSE);
}

// ------------------------------------------------------------------ registration

interface Spec { label: string; category: string; args: { name: string; default?: any }[]; undoable: boolean }
const PRESET_ARG = { name: 'PresetObj', default: DEFAULT_LAYER_PRESET };
export const B19B_SPECS: Record<string, Spec> = {
  InspectLastOperator: { label: 'Last Operator in Stack', category: 'Property|Edit', undoable: false, args: [{ name: 'InputObjs', default: null }] },
  DeleteAll: { label: 'Delete All', category: 'Edit', undoable: false, args: [{ name: 'Confirm', default: true }, { name: 'CmdMapClient', default: null }, { name: 'CmdID', default: null }] },
  NewScene: { label: 'New Scene', category: 'File', undoable: false, args: [{ name: 'ProjectPathName', default: '' }, { name: 'Confirm', default: true }, { name: 'CmdMapClient', default: null }, { name: 'CmdID', default: null }] },
  SaveScene: { label: 'Save Scene', category: 'File', undoable: false, args: [{ name: 'CmdMapClient', default: null }, { name: 'CmdID', default: null }] },
  OpenScene: { label: 'Open Scene', category: 'File', undoable: false, args: [{ name: 'SceneFileName', default: null }, { name: 'Confirm', default: true }, { name: 'ApplyAuxiliaryData', default: false }, { name: 'CmdMapClient', default: null }, { name: 'CmdID', default: null }] },
  SIGetPreset: { label: 'Browse presets', category: 'File|Property', undoable: false, args: [{ name: 'Path', default: '' }, { name: 'Family', default: '' }, { name: 'PresetObj', default: null }] },
  RemoveFolder: { label: 'RemoveFolder', category: 'Navigation', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  SelectAllComponentLoops: { label: 'Loops From Selection (around corners)', category: 'Selection', undoable: true, args: [{ name: 'InputObjs', default: null }, { name: 'AroundCorners', default: true }] },
  GrowSelectedLoops: { label: 'Grow Loops', category: 'Selection', undoable: true, args: [{ name: 'InputObjs', default: null }, { name: 'AroundCorners', default: true }] },
  ShrinkSelectedLoops: { label: 'Shrink Loops', category: 'Selection', undoable: true, args: [{ name: 'InputObjs', default: null }, { name: 'AroundCorners', default: true }] },
  SelectPolygonOutline: { label: 'Select Polygon Outline', category: 'Selection', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  SelectAllConnectedComponents: { label: 'Island From Selection', category: 'Selection', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  SICreateLayer: { label: 'Create New Layer', category: 'Layer', undoable: true, args: [PRESET_ARG, { name: 'Name', default: '' }, { name: 'Value', default: null }] },
  SICreateLayer2: { label: 'Create New Layer 2', category: 'Layer', undoable: true, args: [PRESET_ARG, { name: 'Name', default: '' }, { name: 'LayerGroupName', default: '' }, { name: 'Value', default: null }] },
  CreateLayerGroup: { label: 'Create Layer Group', category: 'Layer', undoable: true, args: [PRESET_ARG, { name: 'InputObj', default: null }, { name: 'Name', default: 'LayerGroup' }, { name: 'Value', default: null }] },
  MoveObjectToLayer: { label: 'Move Object To Layer', category: 'Layer', undoable: true, args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }] },
  CutLayerParent: { label: 'Cut Layer Parent Task', category: 'Layer', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  SetCurrentLayer: { label: 'Set current layer', category: 'Layer', undoable: true, args: [{ name: 'Value', default: null }, { name: 'Type', default: 1 }] },
  SetCurrentPass: { label: 'Set current pass', category: 'Rendering', undoable: true, args: [{ name: 'Value', default: null }, { name: 'Type', default: 0 }] },
  PlotShape: { label: 'Plot Shape', category: 'Animation Mixer|Deformation', undoable: true, args: [{ name: 'InputObj', default: null }, { name: 'Name', default: null }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: null }, { name: 'ApplyKeys', default: null }, { name: 'Mode', default: null }, { name: 'Content', default: null }, { name: 'RefMode', default: null }, { name: 'SingleSource', default: null }, { name: 'KeyList', default: null }, { name: 'ClipList', default: null }] },
  LinkDeform: { label: 'LinkDeform', category: 'Animation|Deformation', undoable: true, args: [{ name: 'Cluster', default: null }, { name: 'Parameter list', default: null }, { name: 'LinkWithOri', default: false }, { name: 'Value', default: null }] },
  Cut: { label: 'Cut', category: 'Edit', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  Copy: { label: 'Copy', category: 'Edit', undoable: false, args: [{ name: 'InputObjs', default: null }] },
  Paste: { label: 'Paste', category: 'Edit', undoable: true, args: [{ name: 'InputObjs', default: null }] },
  CopyUVW: { label: 'CopyUVW', category: 'Texturing', undoable: false, args: [{ name: 'TextureProjection', default: null }, { name: 'SubComp', default: null }] },
  PasteUVW: { label: 'PasteUVW', category: 'Texturing', undoable: true, args: [{ name: 'TextureProjection', default: null }, { name: 'SubComp', default: null }, { name: 'PasteUVsMode', default: ':siDefaultPasteUVsMode:siPasteUVsMode' }] },
  InstallCustomPreferences: { label: 'Install Custom Preferences', category: 'file', undoable: true, args: [{ name: 'InputObjs', default: null }, { name: 'Name', default: '' }] },
  CreateEnvironment: { label: 'CreateEnvironment', category: 'Navigation', undoable: true, args: [{ name: 'Name', default: 'Environment' }, { name: 'Environment', default: null }] },
  AddContainerToEnvironment: { label: 'AddContainerToEnvironment', category: 'Navigation', undoable: true, args: [{ name: 'Environment', default: null }, { name: 'Type', default: 'Default' }, { name: 'Support3DObject', default: true }, { name: 'Name', default: 'MyGroup' }, { name: 'Container', default: null }] },
  DeselectAllUsingFilter: { label: 'Deselect All Using Filter', category: 'Selection', undoable: true, args: [{ name: 'SelFilter', default: null }] },
};
export const B19B_NAMES = Object.keys(B19B_SPECS);

/** Family names SIFindFamily knows in this build (inferred: the preset families plus the siXxxFamily constants). */
function findFamily(name: string): string | null {
  const s = name.trim();
  if (/^si[A-Z]\w*Family$/.test(s)) return s;
  const known = ['Shaders', 'Operators', 'Primitives', 'Properties', 'Materials', 'Passes', 'Layers', 'Partitions'];
  return known.find(f => f.toLowerCase() === s.toLowerCase()) ?? null;
}

export function registerTasksB19bCommands(app: App) {
  const st = b19b(app);
  st.service ??= defaultSceneService();
  const reg = (name: string, execute: CommandDef['execute']) => { const s = B19B_SPECS[name]; app.register({ name, label: s.label, category: s.category, args: s.args, undoable: s.undoable, execute }); };

  // ================================================================ scene I/O (handler 6e4d3de5 / fcad9bc1 / 973f7447)
  reg('NewScene', (app, a) => newSceneTask(app, 'NewScene', a));
  // inferred: "Delete All" = new scene (same handler, same default CmdID)
  reg('DeleteAll', (app, a) => newSceneTask(app, 'DeleteAll', { ProjectPathName: '', Confirm: a.Confirm }));
  reg('OpenScene', (app, a) => openSceneTask(app, 'OpenScene', a, true));
  reg('SaveScene', (app) => saveSceneTask(app, 'SaveScene'));

  // ================================================================ SIGetPreset
  reg('SIGetPreset', (app, a) => {
    const C = 'SIGetPreset';
    const path = typeof a.Path === 'string' ? a.Path : '';
    if (a.Family !== null && a.Family !== undefined && typeof a.Family !== 'string') throw fail(C, E_INVALIDARG, 'Family must be a string');
    const famName = String(a.Family ?? '').trim();
    const family = famName ? findFamily(famName) : null;
    if (famName && !family) throw fail(C, E_INVALIDARG, `unknown family "${famName}"`);
    const common = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2';   // inferred: DSIOGetCommonRoot of a default install
    const root = path ? hostFs.join(common, path) : common;
    call(app, 'DSDoModalPresetBrowser', root, family);
    const browse = st.hooks.presetBrowser;
    if (!browse) logNya(app, C, 'the modal preset browser (DSDoModalPresetBrowser) is not available in this build (set app.tasksB19b.hooks.presetBrowser); nothing is chosen');
    const chosen = browse ? browse(root, family) : null;
    if (unset(chosen)) { st.out[C] = { PresetObj: null }; setStatus(app, C, S_FALSE); return null; }
    st.out[C] = { PresetObj: chosen }; setStatus(app, C, S_OK);
    return chosen;
  });

  // ================================================================ InspectLastOperator
  reg('InspectLastOperator', (app, a) => {
    const C = 'InspectLastOperator';
    const list: Node[] = [];
    for (const n of listArg(app, a.InputObjs).nodes) {
      if (n instanceof X3DObject) {   // kind 2 / 4: the last operator of the primitive
        const ops = n.primitive?.operators ?? []; const op = ops[ops.length - 1];
        if (op && !list.includes(op)) list.push(op);
      } else if (n instanceof Cluster || n instanceof Property) logNya(app, C, `the last operator of ${nameOf(n)} (per-kind collectors 0x1800629f0 / 0x180062870)`);
      else logNya(app, C, `the last operator of ${nameOf(n)} (collector 0x180062870)`);
    }
    if (!list.length) throw fail(C, E_FAIL, 'no operator found');
    call(app, 'InspectObj', list.map(nameOf));
    st.inspected = [...list];
    app.events.emit('inspect', list[0]);   // inferred: the property page opens on the first operator
    setStatus(app, C, S_FALSE);
    return undefined;
  });

  // ================================================================ RemoveFolder
  reg('RemoveFolder', (app, a) => {
    const C = 'RemoveFolder';
    const f = itemArg(app, a.InputObjs) ?? null;
    if (!(f instanceof FolderNode) || !f.owner) { setStatus(app, C, S_FALSE); return undefined; }   // not a folder: nothing done
    const list = foldersOf(f.owner); const i = list.indexOf(f);
    if (i < 0) { setStatus(app, C, S_FALSE); return undefined; }
    // inferred: the folder leaves its parent; its members are not deleted
    app.record(C, () => { const j = list.indexOf(f); if (j >= 0) list.splice(j, 1); }, () => { if (!list.includes(f)) list.splice(i, 0, f); });
    app.events.emit('scene');
    setStatus(app, C, S_FALSE);
    return undefined;
  });

  // ================================================================ loops / outline / island
  reg('SelectAllComponentLoops', (app, a) => {
    const C = 'SelectAllComponentLoops'; const around = bool(a.AroundCorners, true);
    const inputs = loopInputs(app, a.InputObjs);
    const res: Sub[] = [];
    for (const s of inputs) {
      const adj = T.adjacencyOf(meshOf(s.obj)!); const items = new Set<CompItem>();
      for (let i = 0; i < s.items.length; i++) for (let j = i + 1; j < s.items.length; j++) {
        const p = loopPath(adj, s.kind, s.items[i], s.items[j], around);
        if (p && p.length >= 2) p.forEach(x => items.add(x));   // shorter paths are dropped
      }
      if (items.size) res.push({ obj: s.obj, kind: s.kind, items: [...items] });
    }
    if (!res.length) { if (inputs.length) logNya(app, C, 'SelectObj with an empty loop list (no loop joins two selected components); the selection is left as it is'); setStatus(app, C, S_OK); return undefined; }
    selectSubs(app, C, res, 'replace');
    setStatus(app, C, S_OK); return undefined;
  });
  const growShrink = (C: string, grow: boolean) => (app: App, a: Record<string, any>) => {
    const around = bool(a.AroundCorners, true);
    const inputs = loopInputs(app, a.InputObjs);
    if (!inputs.length) { setStatus(app, C, S_OK); return undefined; }
    selectSubs(app, C, inputs, 'replace');   // SelectObj with the input list
    const delta: Sub[] = [];
    for (const s of inputs) {
      const adj = T.adjacencyOf(meshOf(s.obj)!);
      const r = loopEnds(adj, s.kind, new Set(s.items), around);
      const items = grow ? r.added : r.ends;
      if (items.length) delta.push({ obj: s.obj, kind: s.kind, items });
    }
    if (delta.length) selectSubs(app, C, delta, grow ? 'add' : 'remove');
    setStatus(app, C, S_OK); return undefined;
  };
  reg('GrowSelectedLoops', growShrink('GrowSelectedLoops', true));
  reg('ShrinkSelectedLoops', growShrink('ShrinkSelectedLoops', false));
  reg('SelectPolygonOutline', (app, a) => {
    const C = 'SelectPolygonOutline';
    const res: Sub[] = [];
    for (const s of loopInputs(app, a.InputObjs).filter(x => x.kind === 'polygon')) {
      const adj = T.adjacencyOf(meshOf(s.obj)!);
      const out = T.polygonOutline(adj, new Set(s.items)); if (out.size) res.push({ obj: s.obj, kind: 'edge', items: [...out] });
    }
    if (res.length) selectSubs(app, C, res, 'replace');   // other selections do nothing
    setStatus(app, C, S_OK); return undefined;
  });
  reg('SelectAllConnectedComponents', (app, a) => {
    const C = 'SelectAllConnectedComponents';
    const res: Sub[] = [];
    for (const s of loopInputs(app, a.InputObjs)) {
      const adj = T.adjacencyOf(meshOf(s.obj)!);
      res.push({ obj: s.obj, kind: s.kind, items: [...T.island(adj, s.kind, new Set(s.items))] });   // inferred: flood fill over same-type neighbours
    }
    if (res.length) selectSubs(app, C, res, 'replace');
    setStatus(app, C, S_OK); return undefined;
  });

  // ================================================================ DeselectAllUsingFilter (selectionmgr.dll)
  reg('DeselectAllUsingFilter', (app, a) => {
    const C = 'DeselectAllUsingFilter';
    const f = unset(a.SelFilter) ? ((app as any).selFilter ?? LABEL[app.selMode as CompKind] ?? 'Object') : a.SelFilter;   // inferred: no filter = the current filter
    const k = filterKind(f); const list: any[] = [];
    if (k === 'sample') { logNya(app, C, 'the SampledPoint filter (no sample component kind in this build)'); return null; }
    if (k === 'point' || k === 'edge' || k === 'polygon') {
      // component filter: per selected geometry object, the selected components of the types the filter supports
      const c = app.compSel; const items = compSetOf(app);
      if (c && c.kind === k && items.length) list.push({ obj: c.obj, kind: k, items });
      if (!list.length) { setStatus(app, C, S_OK); return null; }
      selectSubs(app, C, list, 'remove');
      return list.map(subText);
    }
    const pred = objectFilter(app, f);
    if (!pred) { logNya(app, C, `filter "${f}" (no filter definition of that name in this build)`); return null; }
    const hit = app.selection.filter(n => n instanceof X3DObject && pred(n));
    if (!hit.length) { setStatus(app, C, S_OK); return null; }
    selTask(app, 'RemoveFromSelection', [hit.map(nameOf)], () => {
      app.selection = app.selection.filter(n => !hit.includes(n));
      if (app.compSel && !app.selection.includes(app.compSel.obj)) app.compSel = null;
      app.events.emit('selection');
    });
    setStatus(app, C, S_OK);
    return hit;
  });

  // ================================================================ layers
  reg('SICreateLayer', (app, a) => { noInspect(app); return createLayerTask(app, 'SICreateLayer', a); });
  // LayerGroupName is read but not used: the layer is created at the top level like SICreateLayer
  reg('SICreateLayer2', (app, a) => { noInspect(app); return createLayerTask(app, 'SICreateLayer2', a); });
  reg('CreateLayerGroup', (app, a) => {
    const C = 'CreateLayerGroup'; noInspect(app);
    const preset = a.PresetObj;
    if (preset === null) throw fail(C, E_INVALIDARG, 'PresetObj is missing');
    const input = unset(a.InputObj) ? null : itemArg(app, a.InputObj);
    if (!unset(a.InputObj) && !input) throw fail(C, E_NOINTERFACE, `${String(a.InputObj)} is not a scene element`);
    const name = typeof a.Name === 'string' && a.Name ? a.Name : 'LayerGroup';
    call(app, 'SICreateLayer', preset, name, '');
    const l = createLayerTask(app, 'SICreateLayer', { PresetObj: preset, Name: name, LayerGroupName: '' });
    if (l && input) { call(app, 'MoveObjectToLayer', l.name, nameOf(input)); moveObjectToLayerTask(app, 'MoveObjectToLayer', [l], [input]); }
    st.out[C] = { Value: l }; setStatus(app, C, S_OK);
    return l;
  });
  reg('MoveObjectToLayer', (app, a) => { moveObjectToLayerTask(app, 'MoveObjectToLayer', a.Target, a.InputObjs); return undefined; });
  reg('CutLayerParent', (app, a) => {
    const C = 'CutLayerParent';
    const l = listArg(app, a.InputObjs).nodes.find((n): n is Layer => n instanceof Layer);   // only the first layer is used
    if (!l) throw fail(C, E_INVALIDARG, 'InputObjs holds no layer');
    const p = parentLayerOf(l);
    if (!p) { setStatus(app, C, S_FALSE); return undefined; }   // inferred: a top-level layer stays where it is
    if ((l as any).locked) { app.logMsg('info', `${C}: ${l.name} cannot be detached`); setStatus(app, C, S_FALSE); return undefined; }
    // back to the top of the layer container under the same name; connection deltas renamed (no deltas in this build)
    app.record(C, () => { (l as any).parentLayer = null; }, () => { (l as any).parentLayer = p; });
    app.events.emit('scene');
    setStatus(app, C, S_FALSE);
    return undefined;
  });
  // SetCurrentLayer / SetCurrentPass: the SetCurrentParType handler (CMD-B11a) with Type 1 / 0
  const parType = (name: string) => (app: App, a: Record<string, any>) => {
    const def = app.commands.get('SetCurrentParType');
    if (!def) throw fail(name, E_UNEXPECTED, 'the SetCurrentParType handler is not registered');
    return def.execute(app, { Value: a.Value, Type: a.Type });
  };
  reg('SetCurrentLayer', parType('SetCurrentLayer'));
  reg('SetCurrentPass', parType('SetCurrentPass'));

  // ================================================================ PlotShape / LinkDeform (script-backed, 5c0cf8b6)
  reg('PlotShape', (app, a) => {
    const C = 'PlotShape';
    logNya(app, C, 'the command script of the script-backed handler 5c0cf8b6 (not read in this row); the shape keys of the input are sampled over the frame range');
    const objs = listArg(app, a.InputObj).nodes.filter((n): n is X3DObject => n instanceof X3DObject);
    const s = Number(a.StartFrame ?? app.anim.startFrame) || app.anim.startFrame; const e = Number(a.EndFrame ?? app.anim.endFrame) || app.anim.endFrame;
    const step = Math.max(1, Number(a.StepFrame ?? 1) || 1);
    const A: any = app.anim; const keys: any[] = [];
    for (const o of objs) for (const pr of o.properties) if (pr.type === 'shapekey' || pr.type === 'shapecombo') for (const p of pr.params) if (p.animatable) keys.push(p);   // inferred
    if (!keys.length) return { KeyList: [], ClipList: [] };
    const prev = A.frame; const samples: [any, number, any][] = [];
    for (let f = s; f <= e; f += step) { A.frame = f; for (const p of keys) samples.push([p, f, p.value]); }
    A.frame = prev;
    const before = keys.map(p => app.anim.fcurve(p)?.keys.map((k: any) => ({ ...k })) ?? null);
    app.record(C, () => { for (const [p, f, v] of samples) app.anim.setKey(p, f, v); },
      () => keys.forEach((p, i) => { const b = before[i]; if (b) app.anim.fcurve(p)!.keys = b.map((k: any) => ({ ...k })); else app.anim.fcurves.delete(p); }));
    return { KeyList: keys, ClipList: [] };
  });
  reg('LinkDeform', (app, a) => {
    const C = 'LinkDeform';
    logNya(app, C, 'the command script of the script-backed handler 5c0cf8b6 (not read in this row); nothing is linked');
    st.out[C] = { Value: null, Cluster: a.Cluster ?? null, 'Parameter list': a['Parameter list'] ?? null, LinkWithOri: bool(a.LinkWithOri) };
    return null;
  });

  // ================================================================ clipboard (Copy / Cut / Paste, ec7663e4..6)
  reg('Copy', (app, a) => {
    const C = 'Copy'; const inp = listArg(app, a.InputObjs);
    if (inp.subs.length && !inp.nodes.length && app.commands.has('CopyUserNormals')) {
      logNya(app, C, 'copying sub-components (clipboard service, outside tasks.dll); the user-normal clipboard is used');
      return app.run('CopyUserNormals', {});
    }
    call(app, 'clipboard.copy', inp.nodes.map(nameOf)); call(app, 'clipboard.commit');
    st.clipboard = { items: [...inp.nodes], cut: false, detached: new Set() };
    (app as any).clipboard = objectsIn(inp.nodes);
    setStatus(app, C, S_FALSE);
    return inp.nodes.length;
  });
  reg('Cut', (app, a) => {
    const C = 'Cut'; const inp = listArg(app, a.InputObjs);
    if (!inp.nodes.length) throw fail(C, E_INVALIDARG, 'nothing to cut (XSITASKS 0x78)');
    call(app, 'clipboard.cut', inp.nodes.map(nameOf));
    const before = st.clipboard; const objs = objectsIn(inp.nodes);
    const clip = { items: [...inp.nodes], cut: true, detached: new Set<Node>(objs) };
    app.record('Cut clipboard', () => { st.clipboard = clip; (app as any).clipboard = objs; }, () => { st.clipboard = before; });
    const sel = snap(app);
    call(app, 'DeleteObj', inp.nodes.map(nameOf));
    deleteObjList(app, C, inp.nodes);
    app.record('Selection snapshot', () => {}, () => restore(app, sel));
    call(app, 'clipboard.commit');
    setStatus(app, C, S_FALSE);
    return undefined;
  });
  reg('Paste', (app, a) => {
    const C = 'Paste'; const inp = listArg(app, a.InputObjs, false);
    if (inp.subs.length && !inp.nodes.length && app.commands.has('PasteUserNormals')) {
      logNya(app, C, 'pasting onto sub-components (clipboard service); the user-normal clipboard is used');
      return app.run('PasteUserNormals', {});
    }
    const targets = inp.nodes.length ? inp.nodes : [app.scene.root];   // empty: the current scene model
    const clip = st.clipboard; const made: Node[] = [];
    call(app, 'GraphUpdate.begin');
    for (const t of targets) for (const item of clip.items) {
      if (!(t instanceof X3DObject)) { logNya(app, C, `pasting onto ${nameOf(t)} (paste flags of the clipboard service)`); continue; }
      if (!(item instanceof X3DObject)) { logNya(app, C, `pasting ${nameOf(item)} (what the clipboard stores for non-objects)`); continue; }
      call(app, 'clipboard.paste', nameOf(item), nameOf(t));
      if (clip.detached.has(item) && !inScene(app, item)) {
        // inferred: the first paste of a cut object puts the object itself back, under the target
        const o = item; app.record(C, () => { t.addChild(o); clip.detached.delete(o); }, () => { t.removeChild(o); clip.detached.add(o); });
        made.push(o); continue;
      }
      if (!inScene(app, item)) { logNya(app, C, `pasting ${item.name} a second time after Cut (the clipboard's stored data)`); continue; }
      const keep = (app as any).clipboard;
      const copies: X3DObject[] = app.run('Duplicate', { InputObjs: [item] }) ?? [];
      (app as any).clipboard = keep;
      for (const c of copies) { const old = c.parentObj; if (old && old !== t) app.record(C, () => t.addChild(c), () => old.addChild(c)); made.push(c); }
    }
    call(app, 'GraphUpdate.end');
    st.out[C] = { pasted: made };
    setStatus(app, C, S_FALSE);
    return made;
  });

  // ================================================================ CopyUVW / PasteUVW
  const uvTarget = (C: string, a: Record<string, any>): { o: X3DObject; p: Property; samples: number[]; kind: 'cluster' | 'subcomponent' } | null => {
    const p = isUVProperty(a.TextureProjection) ? a.TextureProjection : resolveUVProperty(app, a.TextureProjection);
    if (!p) throw fail(C, E_NOINTERFACE, `${nameOf(a.TextureProjection)} is not a texture projection`);
    let o: any = p.parent; while (o && !(o instanceof X3DObject)) o = o.parent; if (!(o instanceof X3DObject)) return null;
    const m = meshOf(o); if (!m) return null;
    const { start, total } = sampleOffsets(m);
    if (unset(a.SubComp)) return { o, p, kind: 'cluster', samples: Array.from({ length: total }, (_, i) => i) };   // the projection's own cluster (kind 6)
    const sub = listArg(app, a.SubComp, false).subs[0];
    if (!sub || sub.obj !== o) { return null; }   // other kinds: nothing
    const polys = sub.kind === 'polygon' ? sub.items as number[] : sub.kind === 'point' ? m.polygons.map((f, i) => f.some(v => (sub.items as number[]).includes(v)) ? i : -1).filter(i => i >= 0) : [];
    if (sub.kind === 'edge') { logNya(app, C, 'edge sub-components (the samples an edge selection covers)'); return null; }
    const samples: number[] = []; for (const pi of polys) for (let s = start[pi]; s < start[pi + 1]; s++) samples.push(s);
    return { o, p, kind: 'subcomponent', samples };
  };
  reg('CopyUVW', (app, a) => {
    const C = 'CopyUVW'; const t = uvTarget(C, a);
    if (!t) { setStatus(app, C, S_FALSE); return undefined; }
    const uv = propertyUVs(t.o, t.p); if (!uv) { setStatus(app, C, S_FALSE); return undefined; }
    st.uvClipboard = { kind: t.kind, samples: t.samples, uvs: t.samples.flatMap(s => [uv[s * 2], uv[s * 2 + 1]]), source: nameOf(t.p) };
    logNya(app, C, 'the UV clipboard storage (outside tasks.dll); the UVs are kept per sample in this build');
    setStatus(app, C, S_FALSE); return undefined;
  });
  reg('PasteUVW', (app, a) => {
    const C = 'PasteUVW'; const t = uvTarget(C, a);
    const mode = a.PasteUVsMode;
    if (!unset(mode) && !/siDefaultPasteUVsMode/.test(String(mode)) && Number(mode) !== 0) logNya(app, C, `PasteUVsMode ${mode} (the paste modes); the default mode is used`);
    const clip = st.uvClipboard;
    if (!t || !clip) { setStatus(app, C, S_FALSE); return undefined; }
    const uv = propertyUVs(t.o, t.p); if (!uv) { setStatus(app, C, S_FALSE); return undefined; }
    if (clip.samples.length !== t.samples.length) logNya(app, C, `pasting ${clip.samples.length} UVs onto ${t.samples.length} samples (the paste rule for different counts); the common part is written`);
    const old = Float32Array.from(uv); const next = Float32Array.from(uv);
    const n = Math.min(clip.samples.length, t.samples.length);
    for (let i = 0; i < n; i++) { next[t.samples[i] * 2] = clip.uvs[i * 2]; next[t.samples[i] * 2 + 1] = clip.uvs[i * 2 + 1]; }
    const P: any = t.p; const had = P.uvs;
    app.record(C, () => { P.uvs = next; P._uvcache = null; }, () => { P.uvs = had ?? old; P._uvcache = null; });
    app.events.emit('scene');
    setStatus(app, C, S_FALSE); return undefined;
  });

  // ================================================================ InstallCustomPreferences
  reg('InstallCustomPreferences', (app, a) => {
    const C = 'InstallCustomPreferences';
    const inputs = listArg(app, a.InputObjs).nodes;
    const M: Map<string, Property> = ((app as any).customPreferencesB10 ??= new Map());
    let n = 0;
    for (const p of inputs) {
      if (!(p instanceof Property) || !/^custom(paramset|pset|parameterlist)$/i.test(p.type)) continue;   // only custom property sets (inferred: this build's custom property types)
      const name = typeof a.Name === 'string' && a.Name ? a.Name : p.name;
      const dir = hostFs.join(hostFs.join(sdkHelpersState.paths[1], 'Data'), 'Preferences');
      const file = hostFs.join(dir, `${name}.Preset`);
      const data = JSON.stringify({ preset: 1, description: 'Custom Preferences Set', name, params: Object.fromEntries(p.params.map(q => [q.def.name, q.value])) });
      const had = hostFs.isFile(file) ? hostFs.readFile(file) : null;
      call(app, 'SavePreset', nameOf(p), file);
      app.record('SavePreset', () => { hostFs.ensureFolder(dir); hostFs.writeFile(file, data); }, () => { if (had !== null) hostFs.writeFile(file, had); else if (hostFs.isFile(file)) hostFs.deleteFile(file); });
      // registration with the custom-preferences manager; inferred failure: a set of that name is installed already
      if (M.has(name)) { app.logMsg('error', `${C}: ${name} is already installed`); if (had === null && hostFs.isFile(file)) hostFs.deleteFile(file); break; }
      app.record(C, () => { M.set(name, p); }, () => { M.delete(name); });
      const owner: any = p.parent; const idx = owner?.properties?.indexOf(p) ?? -1;
      call(app, 'DeleteObj', nameOf(p));
      if (owner && idx >= 0) app.record('DeleteObj', () => owner.removeProperty(p), () => { owner.properties.splice(idx, 0, p); p.parent = owner; });
      n++;
    }
    if (!n) { warn(app, 0x429, `${C}: no custom preferences were installed`); setStatus(app, C, S_FALSE); return 0; }
    const sel = snap(app); app.record('Selection snapshot', () => {}, () => restore(app, sel));
    setStatus(app, C, S_FALSE);
    return n;
  });

  // ================================================================ environments (environments.dll)
  reg('CreateEnvironment', (app, a) => {
    const C = 'CreateEnvironment';
    const name = typeof a.Name === 'string' && a.Name ? a.Name : 'Environment';
    // inferred: the environment object is a scene node of this build (Null + simenv), kept in the environment container
    const env = new Null(app.scene.uniqueName(name));
    env.add(str('simenv', '1', 'Simulation Environment', { readOnly: true }));
    simEnvironment(env);
    const root = app.scene.root; const list = st.environments;
    app.record(C, () => { root.addChild(env); if (!list.includes(env)) list.push(env); }, () => { root.removeChild(env); const i = list.indexOf(env); if (i >= 0) list.splice(i, 1); });
    st.out[C] = { Environment: env }; noInspect(app);
    return env;
  });
  reg('AddContainerToEnvironment', (app, a) => {
    const C = 'AddContainerToEnvironment';
    const env = itemArg(app, a.Environment);
    if (!(env instanceof X3DObject) || !(env.get('simenv') || (env as any).simulationEnvironment)) throw fail(C, E_INVALIDARG, 'Environment is not an environment object');
    const support = bool(a.Support3DObject, true);
    const c: SimContainer & { support3DObject: boolean; environmentContainer: X3DObject[] } = { name: typeof a.Name === 'string' ? a.Name : 'MyGroup', type: typeof a.Type === 'string' ? a.Type : 'Default', members: [], support3DObject: support, environmentContainer: st.environments };
    const data = simEnvironment(env);
    app.record(C, () => { if (!data.containers.includes(c)) data.containers.push(c); }, () => { const i = data.containers.indexOf(c); if (i >= 0) data.containers.splice(i, 1); });
    st.out[C] = { Container: c };
    return c;
  });
}

