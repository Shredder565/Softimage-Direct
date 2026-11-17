// Ledger row CMD-B7c, shared part. Brief: docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract". Original code written from that contract only.
//
// Session state and small object-model stand-ins used by the add-on script commands of this row
// (addonScriptsCacheManager.ts, addonScriptsRender.ts, addonScriptsIce.ts, addonScriptsSdkui.ts,
// addonScriptsGenerator.ts, addonScriptsWizards.ts).
//
// How this build differs from a Softimage session, and why:
//
//  * Grids. The parameter system has no grid type, so a grid parameter is a `GridData` object kept beside
//    the property (`gridOf(prop, name)`), with a string placeholder parameter of the same name.
//  * Property pages. The commands that take a `PPG` / layout item work on any object with the documented
//    members (`PPGLayout.Item(name)`, `UIItems`, `Refresh()`, `Inspected(0)`); `ScriptPPG` / `ScriptLayout`
//    are the build's own minimal implementations of them.
//  * Views. "Views of the active layout" are a small model (`state.views`), as in the earlier sdkui rows.
//  * Delegated commands. A command of another row is run when it is on the bus; every delegated call is
//    recorded in `state.calls`, and a missing one is logged as "not yet attested".
//  * Log severities. Warnings are logged as info with the prefix "WARNING : " (as in sdkHelpers.ts).
import { App } from '../core/commands';
import { Node, Property, X3DObject, Model, Pass } from '../core/scene';
import { str, type ParamDef } from '../core/params';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';
import { hostFs } from '../core/sdkHelpersHostFs';
import { projectExternalFiles, modelExternalFiles, resolveIePath, type IeExternalFile } from '../core/importExportModelScripts';

export const NOTE = 'docs/ghidra/cmd-b7c-addon-scripts.md';

// ------------------------------------------------------------------ grid data

/** Minimal grid data object: columns with labels, rows of cells, row labels and row background colours. */
export class GridData {
  columns: string[] = [];
  rows: any[][] = [];
  rowLabels: string[] = [];
  rowColors: (readonly [number, number, number] | null)[] = [];
  /** Indices of the rows selected in the page (header selection mode). */
  selectedRows: number[] = [];
  constructor(columns: string[] = []) { this.columns = [...columns]; }
  get ColumnCount(): number { return this.columns.length; }
  set ColumnCount(n: number) { while (this.columns.length < n) this.columns.push(''); this.columns.length = n; for (const r of this.rows) r.length = n; }
  get RowCount(): number { return this.rows.length; }
  set RowCount(n: number) {
    while (this.rows.length < n) { this.rows.push(new Array(this.columns.length).fill(undefined)); this.rowLabels.push(''); this.rowColors.push(null); }
    this.rows.length = n; this.rowLabels.length = n; this.rowColors.length = n;
    this.selectedRows = this.selectedRows.filter(i => i < n);
  }
  SetColumnLabel(i: number, text: any) { this.columns[i] = String(text); }
  GetColumnLabel(i: number): string { return this.columns[i]; }
  SetRowLabel(i: number, text: any) { this.rowLabels[i] = String(text); }
  GetRowLabel(i: number): string { return this.rowLabels[i]; }
  GetCell(col: number, row: number): any { return this.rows[row]?.[col]; }
  SetCell(col: number, row: number, value: any) { this.rows[row][col] = value; }
  SetRowBackgroundColor(row: number, rgb: readonly [number, number, number]) { this.rowColors[row] = rgb; }
  /** Column index by label, -1 when there is none. */
  col(label: string): number { return this.columns.indexOf(label); }
  /** Append an empty row and return its index. */
  addRow(label = ''): number { this.RowCount = this.rows.length + 1; this.rowLabels[this.rows.length - 1] = label; return this.rows.length - 1; }
  removeRow(i: number) { this.rows.splice(i, 1); this.rowLabels.splice(i, 1); this.rowColors.splice(i, 1); this.selectedRows = this.selectedRows.filter(x => x !== i).map(x => x > i ? x - 1 : x); }
  clear() { this.RowCount = 0; }
}

/** Add a grid parameter to a property: a string placeholder parameter plus the grid object. */
export function addGrid(prop: Node, name: string, columns: string[]): GridData {
  const grids: Record<string, GridData> = ((prop as any).grids ??= {});
  if (!prop.get(name)) prop.add(str(name, '', name, { readOnly: true, inspectable: false }));
  return (grids[name] = new GridData(columns));
}
export const gridOf = (prop: any, name: string): GridData | undefined => prop?.grids?.[name];

// ------------------------------------------------------------------ layout / page stand-ins

export interface LayoutEntry {
  kind: 'tab' | 'group' | 'endgroup' | 'row' | 'endrow' | 'item' | 'button' | 'text' | 'spacer' | 'enum' | 'color';
  name: string; label: string;
  attrs: Record<string, any>;
  UIItems: any[];
  SetAttribute(name: any, value: any): void;
  GetAttribute(name: any): any;
}
function entry(kind: LayoutEntry['kind'], name = '', label = ''): LayoutEntry {
  const e: LayoutEntry = {
    kind, name, label, attrs: {}, UIItems: [],
    SetAttribute(n, v) { e.attrs[String(n)] = v; },
    GetAttribute(n) { return e.attrs[String(n)]; },
  };
  return e;
}
/** Property page layout as a flat list of entries, in the order the page-building calls were made. */
export class ScriptLayout {
  items: LayoutEntry[] = [];
  attrs: Record<string, any> = {};
  Clear() { this.items = []; }
  private push(e: LayoutEntry): LayoutEntry { this.items.push(e); return e; }
  AddTab(label: any) { return this.push(entry('tab', String(label), String(label))); }
  AddGroup(label: any = '') { return this.push(entry('group', String(label ?? ''), String(label ?? ''))); }
  EndGroup() { this.push(entry('endgroup')); }
  AddRow() { return this.push(entry('row')); }
  EndRow() { this.push(entry('endrow')); }
  AddItem(name: any, label?: any, control?: any) { const e = this.push(entry('item', String(name), label == null ? String(name) : String(label))); if (control != null) e.attrs.control = control; return e; }
  AddButton(name: any, label?: any) { return this.push(entry('button', String(name), label == null ? String(name) : String(label))); }
  AddStaticText(text: any) { return this.push(entry('text', '', String(text))); }
  AddSpacer(w?: any, h?: any) { const e = this.push(entry('spacer')); e.attrs.width = w; e.attrs.height = h; return e; }
  AddEnumControl(name: any, items: any[], label?: any, control?: any) { const e = this.push(entry('enum', String(name), label == null ? String(name) : String(label))); e.UIItems = [...(items ?? [])]; if (control != null) e.attrs.control = control; return e; }
  AddColor(name: any, label?: any, alpha?: any) { const e = this.push(entry('color', String(name), label == null ? String(name) : String(label))); e.attrs.alpha = !!alpha; return e; }
  SetAttribute(name: any, value: any) { this.attrs[String(name)] = value; }
  /** The first entry of that script name (parameter item, button or enum control). */
  Item(name: any): LayoutEntry | undefined { return this.items.find(e => e.name === String(name) && (e.kind === 'item' || e.kind === 'enum' || e.kind === 'button' || e.kind === 'color')); }
  /** Compact text form, one string per entry (for checks and logs). */
  describe(): string[] { return this.items.map(e => e.kind + (e.name ? `:${e.name}` : '') + (e.label && e.label !== e.name ? `=${e.label}` : '')); }
}
/** A property page over one property: layout, the inspected object and a refresh counter. */
export class ScriptPPG {
  PPGLayout: ScriptLayout;
  refreshCount = 0;
  constructor(readonly prop: Node, layout?: ScriptLayout) { this.PPGLayout = layout ?? ((prop as any).scriptLayout ??= new ScriptLayout()); }
  Inspected(i: number): any { return i === 0 ? this.prop : undefined; }
  Refresh() { this.refreshCount++; }
}
/** The property behind a page object, a property, or anything carrying one. */
export function propOf(x: any): Node {
  if (x instanceof Node) return x;
  if (x?.prop instanceof Node) return x.prop;
  const i = typeof x?.Inspected === 'function' ? x.Inspected(0) : undefined;
  if (i instanceof Node) return i;
  throw new Error('script error: the argument is not a property or a property page');   // inferred text
}
export const layoutOf = (prop: any): ScriptLayout => (prop.scriptLayout ??= new ScriptLayout());
/** Enabled state of parameters (the parameter system has no such flag). */
export function enableParam(prop: any, name: string, on: boolean) { const d: Set<string> = (prop.disabledParams ??= new Set<string>()); if (on) d.delete(name); else d.add(name); }
export const paramEnabled = (prop: any, name: string): boolean => !prop.disabledParams?.has(name);
/** Add a parameter unless the property already has one of that name. */
export function ensureParam(prop: Node, def: ParamDef) { return prop.get(def.name) ?? prop.add(def); }
/** A parameter created without a value (the scripts add several string / number parameters with no default). */
export const NO_VALUE = null;

// ------------------------------------------------------------------ session state

export interface DelegatedCall { name: string; args: unknown[]; via: 'bus' | 'stand-in' | 'missing' }
/** One view of the active layout, with its named sub-views (model only). */
export interface AddonView { type: string; name: string; attrs: Record<string, any>; subViews: Record<string, { attrs: Record<string, any> }> }
/** An external file as the Cache Manager and the External Files viewer read it. */
export interface ExtFile { Path: string; ResolvedPath: string; FileType: string; GUID: string; Owners: any[]; /** Files of a sequence; more than one makes it a sequence. */ Files?: string[] }
export interface ShaderDefRec { ProgID: string; Category: string; DisplayName: string; attributes: Record<string, any> }

export interface AddonScriptsState {
  /** Every delegated call, newest last (kept to 500). */
  calls: DelegatedCall[];
  /** Environment variables the scripts read. */
  env: Record<string, string>;
  views: AddonView[];
  /** Objects the scripts look up by name that this build has no node for (name -> object with a FullName). */
  namedObjects: Map<string, any>;
  /** Source of the active scene's external files; null = the build's own list. */
  externalFiles: ((app: App) => ExtFile[]) | null;
  /** External files of a model; null = the build's own list. */
  modelExternalFiles: ((app: App, model: any) => ExtFile[]) | null;
  /** Path of the active project. */
  projectPath: string;
  /** Cache Manager: the two property instances and the lookup tables of GetObjectsFromSource. */
  cachesPathProp: Property | null;
  cacheOnFileListProp: Property | null;
  scannedMixers: Record<string, boolean> | null;
  sourceObjects: Record<string, { clips: string[]; objects: string[] }> | null;
  /** Shader definitions by ProgID (GetShaderDef stand-in). */
  shaderDefs: Map<string, ShaderDefRec>;
  /** External Files Manager instance. */
  externalFilesViewer: Property | null;
  /** Whether the Alienbrain helper object can be created. */
  alienbrain: boolean;
  /** ConnectToWorkgroupUI: last path entered in this session. */
  lastWorkgroupPath: string;
  /** SDKGetScriptGenerator: the one text buffer shared by every writer. */
  generatorBuffer: string;
  /** Message boxes shown, newest last. */
  messages: string[];
  /** Property pages opened (InspectObj stand-in), newest last. */
  inspected: string[];
  /** ICE trees this build has no operator for (objects with the documented node members), searched after the scene's own. */
  extraIceTrees: any[];
}

export const addonScriptsState: AddonScriptsState = {
  calls: [], env: {}, views: [], namedObjects: new Map(),
  externalFiles: null, modelExternalFiles: null,
  projectPath: 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2\\Data\\XSI_SAMPLES',   // inferred: the default project of a fresh install (as in alembicSeqCam.ts)
  cachesPathProp: null, cacheOnFileListProp: null, scannedMixers: null, sourceObjects: null,
  shaderDefs: new Map(),
  externalFilesViewer: null, alienbrain: false,
  lastWorkgroupPath: '',
  generatorBuffer: '',
  messages: [], inspected: [], extraIceTrees: [],
};
const state = addonScriptsState;

// ------------------------------------------------------------------ small helpers

export const interactive = (app: App) => (app as any).Interactive !== false;
export const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
export const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
export const errDesc = (e: any): string => String(e?.description ?? e?.message ?? e);
export const truthy = (v: unknown): boolean => typeof v === 'string' ? !/^(false|0|)$/i.test(v.trim()) : !!v;
/** Softimage-style full name of a build node: without the scene and scene-root prefix, passes under `Passes.`. */
export function siFullName(n: Node): string {
  const parts: any[] = []; let x: any = n;
  while (x) { parts.unshift(x); x = x.parent ?? null; }
  while (parts.length > 1 && (parts[0].kind === 'scene' || (parts[0] instanceof Model && parts[0].name === 'Scene_Root'))) parts.shift();
  return (parts[0] instanceof Pass ? 'Passes.' : '') + parts.map(p => p.name).join('.');
}
export const fullNameOf = (x: any): string => x == null ? '' : typeof x === 'string' ? x : x instanceof Node ? siFullName(x) : String(x.FullName ?? x.fullName ?? x.Name ?? x.name ?? x);
export const nameOf = (x: any): string => x == null ? '' : typeof x === 'string' ? x : String(x.Name ?? x.name ?? x);
export const typeOf = (x: any): string => x == null ? '' : String(x.Type ?? x.type ?? '');
/** Elements of an array, a collection-like object (`Count` + `Item(i)` / `length`) or a single value. */
export function listOf(x: any): any[] {
  if (x == null) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'object' && typeof x.Count === 'number' && typeof x.Item === 'function') return Array.from({ length: x.Count }, (_, i) => x.Item(i));
  if (typeof x === 'object' && typeof x[Symbol.iterator] === 'function') return Array.from(x as Iterable<any>);
  return [x];
}

/** Text of a dictionary entry; an entry that is not in the strings table is marked as such. */
export function dictText(dict: 'XSIPLUGINUI' | 'XSISCRIPTS' | 'EXTPOLYGONIZER', id: number | string, fallback?: string): string {
  return siString(dict, id) ?? fallback ?? `[${dict} ${id}: text not yet attested (${NOTE} Q6)]`;
}

function show(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(show);
  if (x instanceof Node) return siFullName(x);
  if (x && typeof x === 'object') { const n = (x as any).FullName ?? (x as any).fullName; return n !== undefined ? n : '[object]'; }
  return x;
}
export function trace(name: string, args: unknown[], via: DelegatedCall['via']) {
  state.calls.push({ name, args: args.map(show), via });
  if (state.calls.length > 500) state.calls.shift();
}
/**
 * Call a command of another row. `named` are the bus arguments, `shown` the argument list as the script
 * writes it (for the journal). Missing from the bus: journal entry + "not yet attested" log, `done` false.
 */
export function delegate(app: App, by: string, name: string, named: Record<string, any>, shown: unknown[] = Object.values(named)): { done: boolean; result?: any } {
  const missing = () => {
    trace(name, shown, 'missing');
    logNya(app, by, `the command ${name} is not in this build; the call ${name}(${shown.map(a => JSON.stringify(show(a)) ?? 'null').join(', ')}) was not made`, 'Dependencies');
    return { done: false };
  };
  if (!app.commands.has(name)) return missing();
  const result = app.run(name, named);
  if (result && typeof result === 'object' && (result as any).command === name && 'args' in result) return missing();   // a placeholder registration of another row
  trace(name, shown, 'bus');
  return { done: true, result };
}
/** Open a property page (InspectObj stand-in: the bus command resolves 3D objects only). */
export function inspect(app: App, target: any, title?: string) {
  const names = listOf(target).map(fullNameOf);
  trace('InspectObj', title === undefined ? [names.join(',')] : [names.join(','), '', title], 'stand-in');
  state.inspected.push(names.join(','));
  if (state.inspected.length > 100) state.inspected.shift();
  const node = listOf(target).find(x => x instanceof Node);
  if (node && interactive(app)) app.events.emit('inspect', node);
}
/** XSIUIToolkit.MsgBox stand-in: a message box in a user session; always recorded and logged. */
export function msgBox(app: App, text: string, title = 'AfterImage') {
  state.messages.push(text);
  if (state.messages.length > 100) state.messages.shift();
  if (interactive(app)) { try { siMsgBox(text, title); return; } catch { /* no window: fall through to the log */ } }
  app.logMsg('info', `${title}: ${text}`);
}

/** The object owning a node (walks up to the 3D object). */
export const ownerObject = (n: any): X3DObject | null => { let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null; };
/** Every node a script can address by full name in this build: 3D objects and their properties, passes. */
export function findByName(app: App, name: string): any {
  const n = String(name ?? '').trim(); if (n === '') return undefined;
  const extra = state.namedObjects.get(n); if (extra !== undefined) return extra;
  const root = app.scene.root;
  for (const o of [root, ...app.scene.allObjects()]) {
    if (o.name === n || o.fullName === n || siFullName(o) === n) return o;
    for (const p of o.properties) if (p.fullName === n || siFullName(p) === n || `${o.name}.${p.name}` === n || (o === root && p.name === n)) return p;
  }
  for (const p of app.scene.passes) if (p.name === n || p.fullName === n || `Passes.${p.name}` === n) return p;
  return undefined;
}
export const fileExists = (path: string): boolean => { try { return hostFs.isFile(path); } catch { return false; } };
export const folderExists = (path: string): boolean => { try { return hostFs.isFolder(path); } catch { return false; } };

// ------------------------------------------------------------------ external files

const guids = new WeakMap<object, string>(); let guidSeq = 1;
/** An external file of the build's own list behind the members the scripts read. */
function wrapExtFile(f: IeExternalFile): ExtFile {
  const key: object = f.owner ?? f;
  // inferred: this build keeps no GUID for an external file; a session-stable one is made up per owner.
  if (!guids.has(key)) guids.set(key, `{AF1E0000-0000-4000-8000-${String(guidSeq++).padStart(12, '0')}}`);
  return {
    get Path() { return f.path; }, set Path(v: string) { f.path = v; },
    get ResolvedPath() { return resolveIePath(f.path); },
    FileType: f.fileType, GUID: guids.get(key)!, Owners: f.owner ? [f.owner] : [],
  } as ExtFile;
}
/** The active scene's ExternalFiles. */
export function sceneExternalFiles(app: App): ExtFile[] {
  return state.externalFiles ? state.externalFiles(app) : projectExternalFiles(app.scene).map(wrapExtFile);
}
/** The ExternalFiles of one model. */
export function modelExtFiles(app: App, model: any): ExtFile[] {
  return state.modelExternalFiles ? state.modelExternalFiles(app, model) : modelExternalFiles(model).map(wrapExtFile);
}
/** Resolved path of an entry: the first file of the sequence when it is a sequence of more than one file. */
export const resolvedOf = (f: ExtFile): string => (f.Files && f.Files.length > 1 ? f.Files[0] : f.ResolvedPath);
export const ROW_COLOR_VALID = [166, 168, 171] as const;
export const ROW_COLOR_INVALID = [184, 137, 137] as const;
