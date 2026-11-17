// Ledger row CMD-B7a, second half. Brief: docs/ghidra/cmd-b7a-uitasks-group-view-binary.md, "Wire contract"
// of siviewtasks.dll, siclustertasks.dll and selectionmgr.dll. Original code written from that prose only.
//
//   siviewtasks     OpenXSIExplorer OpenTransientExplorer OpenAttachments
//   siclustertasks  SITogglePolygonVisibility ClusterNonOverlapEnforcement
//   selectionmgr    SetActiveElements SetAndToggleActiveElements ActivateElements DeactivateElements
//                   ToggleActiveElements ActivateSampledPointSelTool ActivateSampledPointSelToolWithNoObjStateChange
//
// Mapping onto this build (each also marked `// inferred` where it is used):
//  * the explorer view is a floating window with this build's XSI Explorer; the transient explorer is a
//    300 x 300 pop-up tree. OpenTransientExplorer blocks in Softimage; here it returns a Promise that resolves
//    with the picked list when the picking session terminates;
//  * the "active list" of the selection manager is the selection (app.selection, plus the component selection
//    for point / polygon items);
//  * the internal add / remove cluster-element tasks are undoable edits of the cluster's element set;
//  * arguments the handlers read by name without registering them (CategoryID, HierarchyLevel,
//    CheckObjectSelectability, GroupMode) are passed with `app.uiGroupViewTasks.runWith`.
import { App, CommandDef, ComponentSelection } from '../core/commands';
import { Node, X3DObject, Property, Material, Cluster } from '../core/scene';
import { openFloating, type Floating } from '../ui/floating';
import { xsiExplorer } from '../ui/views';
import { SI_VIEWS } from '../ui/si';
import { unset, boolArg, siConst } from './viewEditPropertyHelpers';
import {
  stateOf, interactive, text, fail, setStatus, logNya, quiet, takeExtra, nodeOf, nodeList,
  S_OK, S_NOTHING, S_CANCELLED, E_INVALIDARG, E_UNEXPECTED,
  type ExplorerViewRecord, type TransientSession,
} from './uiGroupViewTasks';

const fullName = (n: any): string => n?.fullName ?? n?.name ?? String(n);
/** An enum argument: ":member:enum" / "member" / number. */
function enumArg(app: App, command: string, v: any, names: Record<string, number>, question: string): number | null {
  const c = siConst(v);
  if (c === null) return null;
  if (typeof c === 'number') return c;
  if (c in names) return names[c];
  logNya(app, command, `the number of the enum member ${c}`, question);
  return null;
}

// ====================================================================== siviewtasks
const EXPLORER_CLSID = '{ba75acc4-5ef1-4052-b1c1-7b4698a3175b}';
/** Scope argument -> the explorer's internal scope; everything not listed is 3. */
const INTERNAL_SCOPE: Record<number, number> = { 1: 1, 2: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 10, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17, 16: 18, 17: 19, 18: 20, 19: 21 };
export const internalScope = (scope: number) => INTERNAL_SCOPE[scope] ?? 3;
// inferred (Q7): the default member is 0, the first value that maps to the default internal scope
const SCOPE_NAMES: Record<string, number> = { siExplorerScopeDefault: 0 };
/** Filter argument -> node filter mask; 9 is an interface test, other values an empty filter. */
const FILTER_MASK: Record<number, number> = { 0: 0xffff, 1: 0xf7ff, 2: 0x44f, 3: 0x443, 4: 0x5d3, 5: 0x47b, 6: 0x5eb, 7: 0x401, 8: 0x443 };
// inferred (Q7): the default member siSEFilterAllNodes is 0, the value whose mask is all ones
const FILTER_NAMES: Record<string, number> = { siSEFilterAllNodes: 0 };

let explorerSerial = 0;
function openXsiExplorer(app: App, a: Record<string, any>): any {
  const C = 'OpenXSIExplorer';
  const S = stateOf(app);
  // DSFindViewFromName
  const viewerName = text(a.Viewer);
  const viewer = viewerName === '' ? null : SI_VIEWS.find(v => v.name.toLowerCase() === viewerName.toLowerCase()) ?? null;
  if (viewerName !== '' && !viewer) throw fail(E_INVALIDARG, `${C}: no view named "${viewerName}"`);
  const scope = enumArg(app, C, a.Scope, SCOPE_NAMES, 'Q7') ?? 0;   // a member whose number is unknown counts as "other"
  const content: Node[] = [];
  for (const x of unset(a.InputObjs) ? [] : Array.isArray(a.InputObjs) ? a.InputObjs : String(a.InputObjs).split(',').map(s => s.trim()).filter(Boolean)) {
    const n = nodeOf(app, x);
    if (!n) {
      // An object this build's explorer has no content for (the application's Preferences, for instance). The view
      // is not opened; the result has the shape of a bus placeholder so that callers fall back to their stand-in.
      logNya(app, C, `explorer content for "${fullName(x)}"; no view was opened`);
      return { command: C, args: { ...a } };
    }
    if (!content.includes(n)) content.push(n);
  }
  const reuse = boolArg(a.Reuse); const showToolbar = boolArg(a.ShowToolbar); const title = text(a.Title);
  const key = reuse ? 'ugv-xsi-explorer' : `ugv-xsi-explorer-${++explorerSerial}`;
  const before = S.explorers.find(r => r.reuse && reuse && r.win?.el?.isConnected);
  // DSCreateView of the explorer view class, Reuse as its last argument
  const win: Floating = openFloating('XSI Explorer', (body) => { body.dataset.viewClass = EXPLORER_CLSID; xsiExplorer(app, body); }, { key, w: 420, h: 480, cls: 'ugv-xsi-explorer' });
  const record: ExplorerViewRecord = before && before.win === win ? before : { type: 'XSI Explorer', win, scope, internalScope: 3, showToolbar: true, reuse, reused: false, content: [], viewer: null, title: '' };
  if (record === before) record.reused = true; else S.explorers.push(record);
  record.scope = scope; record.internalScope = internalScope(scope);
  win.body.dataset.internalScope = String(record.internalScope);
  if (record.internalScope !== 3) logNya(app, C, `what the explorer shows for internal scope ${record.internalScope}; the scope is recorded on the view`);
  record.showToolbar = showToolbar;
  win.body.querySelectorAll<HTMLElement>('.explorer-head').forEach(h => { h.style.display = showToolbar ? '' : 'none'; });
  if (content.length) {
    record.content = content;
    logNya(app, C, 'which of its two modes (root or selected content) the view uses for the handed objects; they are recorded on the view');
  }
  if (viewer) record.viewer = { name: viewer.name, clsid: viewer.clsid };
  if (title !== '') { record.title = title; win.setTitle(title); }
  a.Value = record;   // RePackArg: the view object
  setStatus(app, C, S_NOTHING);
  return record;
}

/** The pop-up tree of the transient explorer. */
function transientTree(host: HTMLElement, roots: Node[], expandLevel: number, sort: boolean, onPick: (n: Node, e: MouseEvent) => void, isPicked: (n: Node) => boolean): () => void {
  const open = new Set<Node>();
  const seed = (n: Node, depth: number) => { if (depth < expandLevel) { open.add(n); for (const c of n.explorerChildren()) seed(c, depth + 1); } };
  roots.forEach(r => seed(r, 0));
  const draw = () => {
    host.textContent = '';
    const row = (n: Node, depth: number) => {
      const kids = n.explorerChildren();
      const r = document.createElement('div'); r.className = 'ugv-tx-row' + (isPicked(n) ? ' on' : ''); r.dataset.name = fullName(n);
      r.style.cssText = `padding:1px 4px 1px ${4 + depth * 14}px;cursor:default;white-space:nowrap` + (isPicked(n) ? ';background:rgba(120,160,255,0.35)' : '');
      const arrow = document.createElement('span'); arrow.className = 'ugv-tx-arrow'; arrow.textContent = kids.length ? (open.has(n) ? '▾ ' : '▸ ') : '  ';
      arrow.onclick = (e) => { e.stopPropagation(); if (open.has(n)) open.delete(n); else open.add(n); draw(); };
      const label = document.createElement('span'); label.textContent = n.name;
      r.append(arrow, label); r.onclick = (e) => { onPick(n, e); };
      host.appendChild(r);
      if (open.has(n)) for (const c of sort ? [...kids].sort((x, y) => x.name.localeCompare(y.name)) : kids) row(c, depth + 1);
    };
    for (const r of sort ? [...roots].sort((x, y) => x.name.localeCompare(y.name)) : roots) row(r, 0);
  };
  draw();
  return draw;
}
function transientFilter(app: App, command: string, v: any): { filter: number; mask: number | null } {
  const filter = enumArg(app, command, v, FILTER_NAMES, 'Q7') ?? -1;   // a member whose number is unknown: "other values"
  const mask = filter === 9 ? null : FILTER_MASK[filter] ?? 0;
  if (filter === 9) logNya(app, command, 'filter 9 (only objects exposing {22c3e8f9-ccea-11d2-b35b-00105a1e70de}); every node is listed');
  else if (mask !== null && mask !== 0xffff) logNya(app, command, `which nodes the filter mask 0x${mask.toString(16)} keeps; every node is listed`);
  return { filter, mask };
}
function openTransientExplorer(app: App, a: Record<string, any>): any {
  const C = 'OpenTransientExplorer';
  const S = stateOf(app);
  const { filter, mask } = transientFilter(app, C, a.Filter);
  const init = nodeList(app, a.InitObjects, false);
  const multiSelect = boolArg(a.MultiSelect); const sort = boolArg(a.Sort); const expandLevel = Math.max(0, Math.trunc(Number(a.ExpandLevel) || 0));
  if (!interactive(app)) {
    // inferred: without a user interface there is no pop-up and no picking session; the result list stays empty
    logNya(app, C, 'the transient explorer without a user interface; an empty list is returned');
    a.Value = []; setStatus(app, C, S_NOTHING); return [];
  }
  if (S.transient) S.transient.terminate();
  // inferred: with no initial content the pop-up starts at the scene root
  const roots = init.length ? init : [app.scene.root as Node];
  return quiet(new Promise<Node[]>((resolve) => {
    let redraw = () => {}; let done = false;
    const back = document.createElement('div'); back.className = 'ugv-transient-backdrop'; back.style.cssText = 'position:fixed;inset:0';
    const session: TransientSession = {
      result: [], multiSelect, sort, expandLevel, filter, mask, roots, win: null,
      notify(kind, nodes) {
        if (kind === 'set') session.result = [...nodes];
        else if (kind === 'add') { for (const n of nodes) if (!session.result.includes(n)) session.result.push(n); }
        else if (kind === 'remove') session.result = session.result.filter(n => !nodes.includes(n));
        else for (const n of nodes) { const i = session.result.indexOf(n); if (i >= 0) session.result.splice(i, 1); else session.result.push(n); }
        redraw();
      },
      terminate() {
        if (done) return; done = true;
        back.remove(); close();
        if (S.transient === session) S.transient = null;
        a.Value = [...session.result];   // RePackArg: the result list, empty when nothing was picked
        setStatus(app, C, S_NOTHING);
        resolve(a.Value);
      },
    };
    // style word 0x12b1; single-select unless MultiSelect; sorted if Sort
    const win = openFloating('Explorer', (body) => {
      body.dataset.style = '0x12b1'; body.style.overflow = 'auto';
      redraw = transientTree(body, roots, expandLevel, sort, (n, e) => {
        // inferred: which gesture sends which notification; a plain click sets, Ctrl toggles, Shift adds
        if (!multiSelect) { session.notify('set', [n]); session.terminate(); return; }
        session.notify(e.ctrlKey ? 'toggle' : e.shiftKey ? 'add' : 'set', [n]);
      }, n => session.result.includes(n));
    }, { w: 300, h: 300, cls: 'ugv-transient' });   // inferred: the 300 x 300 size attested for OpenAttachments
    const close = win.close; win.close = () => session.terminate();
    session.win = win;
    back.style.zIndex = win.el.style.zIndex; win.el.parentElement?.insertBefore(back, win.el);
    back.onclick = () => session.terminate();
    win.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') session.terminate(); });
    S.transient = session;
  }));
}

function showAttachmentsExplorer(app: App, target: Node | null): void {
  const S = stateOf(app);
  const mode: 3 | 9 = target ? 9 : 3;
  const roots = target ? [target] : [app.scene.root as Node];   // inferred: what the two modes list
  const win = openFloating('Explorer', (body) => {
    body.dataset.mode = String(mode); body.style.overflow = 'auto';
    transientTree(body, roots, 1, true, (n) => { app.select([n]); }, n => app.selection.includes(n));
  }, { w: 300, h: 300, cls: 'ugv-attachments-explorer' });
  const close = win.close;
  win.close = () => { close(); if (S.attachmentsExplorer?.win === win) S.attachmentsExplorer = null; };
  S.attachmentsExplorer = { win, mode, target, width: 300, height: 300 };
}
function openAttachments(app: App, a: Record<string, any>): any {
  const C = 'OpenAttachments';
  const S = stateOf(app);
  const list = nodeList(app, a.Target, false);   // a single object is wrapped into a list; an empty list is "no target"
  const target = list[0] ?? null;
  const force = a.ForceExplorer === undefined || a.ForceExplorer === null ? false : boolArg(a.ForceExplorer);
  setStatus(app, C, S_NOTHING);
  // 1. toggle
  if (S.attachmentsExplorer) { S.attachmentsExplorer.win.close(); S.attachmentsExplorer = null; return; }
  // 2.
  if (force || !target) { showAttachmentsExplorer(app, target); return; }
  // 3. attachment entries of the single target
  const entries = S.attachmentEntries ? S.attachmentEntries(target) : null;
  if (!S.attachmentEntries) logNya(app, C, 'the attachment entries of the target (what the three strings hold and their order); taken as none');
  if (entries) {
    const name = fullName(target);
    const old = S.attachmentViewers.find(v => v.name === name);
    if (old) { old.strings = entries; old.reused = true; } else S.attachmentViewers.push({ name, strings: entries, reused: false });
    logNya(app, C, `the NetView-style attachment viewer {f2d93252-ecd7-11d4-beae-00a0c982ddd4}; the entries of ${name} are recorded`);
    return;
  }
  // 4. SIGetAnnotations
  const owner: any = target;
  const annotations: Property[] = (owner.properties as Property[] | undefined ?? []).filter(p => p.type === 'annotation');
  if (target instanceof Property && target.type === 'annotation') annotations.unshift(target);
  if (annotations.length) { app.run('InspectObj', { InputObjs: [annotations[0]] }); return; }
  // which of the two messages is logged when is not in the contract
  app.logMsg('info', `${C}: ${target.name} has no attachment (message 0x79 or 0x7a; text not yet attested, Q1)`);
  showAttachmentsExplorer(app, target);
}

// ====================================================================== siclustertasks
/** One list item as a polygon set on an object. */
interface PolyItem { obj: X3DObject; polygons: number[] }
function indexList(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(',').map(p => p.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); } else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}
const polyCount = (o: X3DObject) => o.primitive?.mesh()?.polygons.length ?? 0;
/** Split a list argument on commas that are not inside [...]. */
function splitItems(arg: any): any[] {
  if (Array.isArray(arg)) return arg;
  if (typeof arg !== 'string') return [arg];
  return arg.split(/,(?![^\[]*\])/).map(s => s.trim()).filter(Boolean);
}
function polygonItems(app: App, command: string, arg: any): PolyItem[] {
  const out: PolyItem[] = [];
  if (unset(arg)) {
    // argument handler: the selection; a polygon component selection is a polygon sub-component item
    const cs = app.compSel;
    if (cs && cs.kind === 'polygon' && cs.polygons.size) return [{ obj: cs.obj, polygons: [...cs.polygons] }];
    arg = [...app.selection];
  }
  for (const x of splitItems(arg)) {
    const m = typeof x === 'string' ? /^(.+)\.poly\[(.*)\]$/.exec(x) : null;
    const owner = m ? nodeOf(app, m[1]) : null;
    if (m && owner instanceof X3DObject) { out.push({ obj: owner, polygons: m[2].trim() === '*' ? Array.from({ length: polyCount(owner) }, (_, i) => i) : indexList(m[2]) }); continue; }
    const n = nodeOf(app, x);
    // inferred: kind 6 with the polygon component type covers polygon sub-components and polygon clusters
    if (n instanceof Cluster && n.compKind === 'poly' && n.obj) { out.push({ obj: n.obj, polygons: [...n.elements].map(Number) }); continue; }
    // inferred: kind 7 is a whole geometric object, standing for all of its polygons
    if (n instanceof X3DObject && polyCount(n) > 0) { out.push({ obj: n, polygons: Array.from({ length: polyCount(n) }, (_, i) => i) }); continue; }
    throw fail(E_INVALIDARG, `${command}: ${fullName(x)} is not a polygon item`);
  }
  return out;
}
/** The internal add / remove cluster-element tasks, as one undoable edit. */
function editCluster(app: App, label: string, c: Cluster, add: (number | string)[], remove: (number | string)[]): void {
  const before = new Set(c.elements); const after = new Set(c.elements);
  for (const e of add) after.add(e); for (const e of remove) after.delete(e);
  app.record(label, () => { c.elements = new Set(after); }, () => { c.elements = new Set(before); });
}
function togglePolygonVisibility(app: App, a: Record<string, any>): void {
  const C = 'SITogglePolygonVisibility';
  const items = polygonItems(app, C, a.InputObjs);
  const perObject = new Map<X3DObject, Set<number>>();   // items on the same object are merged
  for (const it of items) { const s = perObject.get(it.obj) ?? new Set<number>(); it.polygons.forEach(p => s.add(p)); perObject.set(it.obj, s); }
  const name: string = (app as any).miscDsScripts?.invisiblePolygonsClusterName ?? 'InvisiblePolygons';   // siInvisiblePolygonsClusterName
  let did = false;
  for (const [o, set] of perObject) {
    const c = o.clusters.find(k => k.name === name && k.compKind === 'poly');
    if (!c) { logNya(app, C, `${o.name} has no ${name} cluster; whether one is created was not read, nothing is done for it`, 'Q5'); continue; }
    const selected = [...set]; const outside = selected.filter(p => !c.elements.has(p));
    if (!selected.length) continue;
    if (outside.length) editCluster(app, C, c, outside, []);   // non-members are added, members stay
    else editCluster(app, C, c, [], selected);   // every selected polygon was a member: all removed
    did = true;
  }
  setStatus(app, C, did ? S_OK : S_NOTHING);
}

const isCategoryProperty = (n: any): n is Property | Material => n instanceof Material || n instanceof Property;
// inferred: F3DTranslateMaterialCATID folds the material kinds into one category; other properties keep their type
const categoryOf = (n: Property | Material): string => n instanceof Material || /material/i.test(n.type) ? 'material' : n.type;
const clusterHasCategory = (c: Cluster, cat: string) => c.properties.some(p => categoryOf(p) === cat) || (cat === 'material' && !!(c as any).material);
function clusterNonOverlap(app: App, a: Record<string, any>): Cluster[] {
  const C = 'ClusterNonOverlapEnforcement';
  const extra = takeExtra(app);
  const inputs: Cluster[] = [];
  for (const x of unset(a.InputObjs) ? [] : splitItems(a.InputObjs)) {
    const n = nodeOf(app, x);
    if (!(n instanceof Cluster)) throw fail(E_INVALIDARG, `${C}: ${fullName(x)} is not a cluster`);   // inferred: kind 6 items are the clusters
    if (!inputs.includes(n)) inputs.push(n);
  }
  let category: string | null = unset(extra.CategoryID) ? null : String(extra.CategoryID);
  if (category === null && !unset(a.Property)) {
    for (const x of splitItems(a.Property)) {
      const n: any = nodeOf(app, x);
      if (isCategoryProperty(n)) { category = categoryOf(n); break; }
      // an object / list: its nested property of that kind
      const nested: any = n instanceof X3DObject ? n.material ?? n.allProperties().find(p => /material/i.test(p.type)) : n instanceof Cluster ? n.properties[0] ?? (n as any).material : null;
      if (isCategoryProperty(nested)) { category = categoryOf(nested); break; }
    }
  }
  if (category === null) throw fail(E_INVALIDARG, `${C}: no property category (CategoryID / Property)`);
  if (category.toLowerCase().includes('material')) category = 'material';
  // 1 is the registered default member; the names of 2 and 4 were not read (Q7)
  const action = enumArg(app, C, a.ActionWhenLocalMaterialsOverlap, { siRemoveFromSelectedClusters: 1 }, 'Q7');
  if (action !== 1 && action !== 2 && action !== 4) throw fail(E_INVALIDARG, `${C}: ActionWhenLocalMaterialsOverlap ${text(a.ActionWhenLocalMaterialsOverlap)} is not 1, 2 or 4`);
  logNya(app, C, 'the exact overlap test and the precise content of OutputObj; clusters of the same object and component type that hold a property of the category and share elements are taken as overlapping');
  const overlapped: Cluster[] = [];
  for (const c of inputs) {
    const o = c.obj; if (!o) continue;
    for (const other of o.clusters) {
      if (other === c || inputs.includes(other) || other.compKind !== c.compKind || !clusterHasCategory(other, category)) continue;
      const shared = [...c.elements].filter(e => other.elements.has(e));
      if (!shared.length) continue;
      if (!overlapped.includes(other)) overlapped.push(other);   // inferred: the overlapped clusters are what OutputObj lists
      if (action === 1) editCluster(app, C, c, [], shared);          // from the input clusters
      else if (action === 2) editCluster(app, C, other, [], shared);  // from the other existing clusters
    }
  }
  a.OutputObj = overlapped;
  setStatus(app, C, S_OK);
  return overlapped;
}

// ====================================================================== selectionmgr
type ElementsCommand = 'SetActiveElements' | 'SetAndToggleActiveElements' | 'ActivateElements' | 'DeactivateElements' | 'ToggleActiveElements';
interface CompItem { obj: X3DObject; kind: 'point' | 'polygon'; indices: number[] }
function elementItems(app: App, command: string, arg: any): { nodes: Node[]; comps: CompItem[] } {
  const nodes: Node[] = []; const comps: CompItem[] = [];
  for (const x of unset(arg) ? [] : splitItems(arg)) {
    const m = typeof x === 'string' ? /^(.+)\.(pnt|poly|edge|sample)\[(.*)\]$/.exec(x) : null;
    if (m) {
      const o = nodeOf(app, m[1]);
      if (!(o instanceof X3DObject)) continue;   // an item the active list cannot hold is dropped
      if (m[2] === 'edge' || m[2] === 'sample') { logNya(app, command, `${m[2]} items in the active list of this build; ${x} is dropped`); continue; }
      comps.push({ obj: o, kind: m[2] === 'pnt' ? 'point' : 'polygon', indices: indexList(m[3]) });
      continue;
    }
    const n = nodeOf(app, x);
    if (n && !nodes.includes(n)) nodes.push(n);
  }
  return { nodes, comps };
}
const copySel = (c: ComponentSelection | null): ComponentSelection | null => c ? { obj: c.obj, kind: c.kind, points: new Set(c.points), edges: new Set(c.edges), polygons: new Set(c.polygons) } : null;
const sameList = (x: Node[], y: Node[]) => x.length === y.length && x.every((n, i) => n === y[i]);
const compSet = (c: ComponentSelection, kind: 'point' | 'polygon') => kind === 'point' ? c.points : c.polygons;
const compKey = (c: ComponentSelection | null) => c ? `${c.obj.fullName}:${c.kind}:${[...c.points].sort()}:${[...c.polygons].sort()}:${[...c.edges].sort()}` : '';
function activeElements(app: App, command: ElementsCommand, a: Record<string, any>): void {
  const extra = takeExtra(app);
  const level = unset(extra.HierarchyLevel) ? 0 : Number(extra.HierarchyLevel);
  if (!Number.isInteger(level) || level < 0 || level > 7) throw fail(E_INVALIDARG, `${command}: HierarchyLevel ${text(extra.HierarchyLevel)} is not 0..7`);
  if (level === 4 && (command === 'ActivateElements' || command === 'ToggleActiveElements' || command === 'SetAndToggleActiveElements')) throw fail(E_INVALIDARG, `${command}: HierarchyLevel 4 is rejected`);
  if (level !== 0) logNya(app, command, `how the selection service expands the list for hierarchy level ${level}; the list is used as given`);
  const checkSelectability = (command === 'ActivateElements' || command === 'ToggleActiveElements') && !unset(extra.CheckObjectSelectability) && boolArg(extra.CheckObjectSelectability);
  const expanded = elementItems(app, command, a.SelectionList);
  // the filter step (DeactivateElements has none)
  // inferred: CheckObjectSelectability drops objects whose visibility property says they are not selectable
  const selectable = (n: Node) => !checkSelectability || !(n instanceof X3DObject) || n.property('visibility')?.val('selectability') !== false;
  const filtered = command === 'DeactivateElements' ? expanded.nodes : expanded.nodes.filter(selectable);

  // inferred: the active list is the selection of this build
  const savedNodes = [...app.selection]; const savedComp = copySel(app.compSel);
  let nextNodes = savedNodes; let nextComp = copySel(app.compSel);
  const withComps = (mode: 'set' | 'add' | 'remove' | 'toggle') => {
    for (const it of expanded.comps) {
      if (mode === 'set' || !nextComp || nextComp.obj !== it.obj || nextComp.kind !== it.kind) {
        if (mode === 'remove') continue;
        nextComp = { obj: it.obj, kind: it.kind, points: new Set(), edges: new Set(), polygons: new Set() };
      }
      const set = compSet(nextComp, it.kind);
      for (const i of it.indices) { if (mode === 'remove' || (mode === 'toggle' && set.has(i))) set.delete(i); else set.add(i); }
      if (mode !== 'remove' && !nextNodes.includes(it.obj)) nextNodes = [...nextNodes, it.obj];
    }
  };
  if (command === 'SetActiveElements') {
    nextNodes = [...filtered]; if (!expanded.comps.length) nextComp = null;
    withComps('set');
  } else if (command === 'ActivateElements') {
    nextNodes = [...savedNodes, ...filtered.filter(n => !savedNodes.includes(n))];
    withComps('add');
  } else if (command === 'DeactivateElements') {
    nextNodes = savedNodes.filter(n => !filtered.includes(n));
    if (nextComp && !nextNodes.includes(nextComp.obj)) nextComp = null;
    withComps('remove');
  } else if (command === 'ToggleActiveElements') {
    const active = filtered.filter(n => savedNodes.includes(n)); const inactive = filtered.filter(n => !savedNodes.includes(n));
    nextNodes = [...savedNodes.filter(n => !active.includes(n)), ...inactive];   // the first part is removed, the second added
    if (nextComp && !nextNodes.includes(nextComp.obj)) nextComp = null;
    withComps('toggle');
  } else {
    // SetAndToggleActiveElements: the split rule of the helper's other mode was not read (Q6).
    // inferred stand-in: the whole filtered list is the first part and the second part is empty
    logNya(app, command, 'the rule that splits the list against the active list; the whole list is taken as the first part', 'Q6');
    const first = filtered; const second: Node[] = [];
    if (second.length) throw fail(E_UNEXPECTED, `${command}: the second part of the split is not empty`);
    nextNodes = [...first]; if (!expanded.comps.length) nextComp = null;
    withComps('set');
  }
  const unchanged = sameList(savedNodes, nextNodes) && compKey(savedComp) === compKey(nextComp);
  if (unchanged) { setStatus(app, command, command === 'SetActiveElements' ? S_CANCELLED : S_NOTHING); return; }
  const put = (nodes: Node[], comp: ComponentSelection | null) => {
    app.selection = [...nodes]; app.compSel = copySel(comp);
    if (comp && app.selMode !== comp.kind) app.selMode = comp.kind;
    app.events.emit('selection');
  };
  // first execution saves the current active list; undo sets it back
  app.record(command, () => put(nextNodes, nextComp), () => put(savedNodes, savedComp));
  setStatus(app, command, S_OK);
}

const SELECT_TOOL = '{0461b2c6-0ae3-11d2-8065-00a0c955b335}';
function activateSelTool(app: App, command: string, a: Record<string, any>): void {
  const S = stateOf(app);
  const extra = takeExtra(app);
  const region = unset(a.SelRegionMode) ? null : Number(a.SelRegionMode);
  if (region !== null && (!Number.isInteger(region) || region < 1 || region > 6)) throw fail(E_INVALIDARG, `${command}: SelRegionMode ${text(a.SelRegionMode)} is not 1..6`);
  // inferred: the selection tool is current when no other interactive tool is active
  const selToolCurrent = app.activeTool === null;
  const deselect = selToolCurrent && !unset(a.DeselectOnNewFilter) && boolArg(a.DeselectOnNewFilter);   // forced to false when the tool is not current
  // (a) the internal set-filter task
  if (!unset(a.SelFilter)) {
    const filterName = String(a.SelFilter).split(':').pop()!;
    const changedFilter = S.selFilter !== filterName;
    S.selFilter = filterName;
    // inferred: "deselect on new filter" clears the selection when the filter changes
    if (deselect && changedFilter && (app.selection.length || app.compSel)) {
      const nodes = [...app.selection]; const comp = copySel(app.compSel);
      app.record(command, () => { app.selection = []; app.compSel = null; app.events.emit('selection'); }, () => { app.selection = [...nodes]; app.compSel = copySel(comp); app.events.emit('selection'); });
    }
    logNya(app, command, `the set-filter task {91d68770-dbe9-11d2-8bcf-00aa006130ef} for the ${filterName} filter (this build has no such component filter, and selecting the previously tagged components is not in the visible code); the filter name is recorded`);
  }
  // (b) / (c) ambient values, set only when different
  if (!unset(extra.GroupMode)) {
    const g = boolArg(extra.GroupMode);
    if (S.ambient.SI3D_GROUP_SEL_MODE !== g) { S.ambient.SI3D_GROUP_SEL_MODE_previous = S.ambient.SI3D_GROUP_SEL_MODE; S.ambient.SI3D_GROUP_SEL_MODE = g; }
  }
  if (region !== null && S.ambient.SI3D_RECTSEL_REGION_MODE !== region) S.ambient.SI3D_RECTSEL_REGION_MODE = region;
  // (d) the selection tool, unless it is already current
  if (!selToolCurrent) { app.setTool(null); S.selectionToolActivations++; }
  (S as any).selectionTool = SELECT_TOOL;
  logNya(app, command, 'the sticky / supra key-mode branches (exec context flag bits 2 and 4) and the restore of SI3D_GROUP_SEL_MODE when a temporary activation ends');
  setStatus(app, command, S_OK);
}

// ====================================================================== registration
export function registerUiGroupViewTasksViews(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  reg({
    name: 'OpenXSIExplorer', label: 'Open XSI Explorer', category: 'Viewing', description: '', undoable: false,
    args: [{ name: 'Scope', default: ':siExplorerScopeDefault:siExplorerScope' }, { name: 'Viewer', default: '' }, { name: 'InputObjs', default: null },
      { name: 'ShowToolbar', default: true }, { name: 'Title', default: '' }, { name: 'Reuse', default: true }, { name: 'Value', default: null }],
    execute: (app, a) => openXsiExplorer(app, a),
  });
  reg({
    name: 'OpenTransientExplorer', label: 'Open Transient Explorer For Picking', category: 'Viewing', description: 'Open a transient explorer and returns the picked items', undoable: false,
    args: [{ name: 'InitObjects', default: null }, { name: 'Filter', default: ':siSEFilterAllNodes:siTransientExplorerFilter' }, { name: 'ExpandLevel', default: 0 },
      { name: 'Sort', default: true }, { name: 'MultiSelect', default: false }, { name: 'Value', default: null }],
    execute: (app, a) => openTransientExplorer(app, a),
  });
  // Two registry entries share the name: (Target) and (Target, ForceExplorer = true). The superset is registered.
  reg({
    name: 'OpenAttachments', label: 'Open Attachments', category: '', description: '', undoable: false,
    args: [{ name: 'Target', default: null }, { name: 'ForceExplorer', default: true }],
    execute: (app, a) => openAttachments(app, a),
  });
  reg({
    name: 'SITogglePolygonVisibility', label: 'Low Level Toggle Polygon Visibility command', category: 'Cluster', description: '',
    args: [{ name: 'InputObjs', default: null }],
    execute: (app, a) => togglePolygonVisibility(app, a),
  });
  reg({
    name: 'ClusterNonOverlapEnforcement', label: 'Cluster Non-overlap Enforcement Command', category: 'Cluster', description: 'Make sure the indices found in the given clusters dont overlap with existing clusters',
    args: [{ name: 'InputObjs', default: null }, { name: 'Property', default: null }, { name: 'ActionWhenLocalMaterialsOverlap', default: ':siRemoveFromSelectedClusters:siActionWhenLocalMaterialsOverlap' }, { name: 'OutputObj', default: null }],
    execute: (app, a) => clusterNonOverlap(app, a),
  });
  const elements: [ElementsCommand, string][] = [
    ['SetActiveElements', 'Set Active Elements'], ['SetAndToggleActiveElements', 'Set And Toggle Active Elements'], ['ActivateElements', 'Activate Elements'],
    ['DeactivateElements', 'Deactivate Elements'], ['ToggleActiveElements', 'Extend And Toggle ActiveElements'],
  ];
  for (const [name, label] of elements) reg({
    name, label, category: 'Selection', description: '', args: [{ name: 'SelectionList', default: null }],
    execute: (app, a) => activeElements(app, name, a),
  });
  const SAMPLED = '{1128E000-DBE2-11d2-8BCF-00AA006130EF}:SampledPoint';
  reg({
    name: 'ActivateSampledPointSelTool', label: 'Sampled Point Select Tool', category: 'Selection',
    description: 'Activates the Rectangle Select tool, sets the filter to Sampled Point, and selects previously tagged sampled points',
    args: [{ name: 'SelFilter', default: SAMPLED }, { name: 'DeselectOnNewFilter', default: true }, { name: 'SelRegionMode', default: 1 }],
    execute: (app, a) => activateSelTool(app, 'ActivateSampledPointSelTool', a),
  });
  reg({
    name: 'ActivateSampledPointSelToolWithNoObjStateChange', label: 'Sampled Point Select Tool (Extended Selection)', category: 'Selection',
    description: 'Activates the Rectangle Select tool, sets the filter to Sampled Point, and adds previously tagged sampled points to selection',
    args: [{ name: 'SelFilter', default: SAMPLED }, { name: 'DeselectOnNewFilter', default: false }, { name: 'SelRegionMode', default: 1 }],
    execute: (app, a) => activateSelTool(app, 'ActivateSampledPointSelToolWithNoObjStateChange', a),
  });
}
