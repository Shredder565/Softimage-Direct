// Ledger row CMD-B11c: shared state and helpers of the tasks.dll commands wired in tasksB11cScene.ts,
// tasksB11cPresets.ts and tasksB11cCurves.ts. Brief: docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md
// ("Wire contract" per command). Original code written from that prose contract only; no XSIBATCH golden exists.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). Statuses that are not
//    failures (0, 1, the "cancelled" 0x562e80c7) are kept in `app.tasksB11c.lastStatus`.
//  * Errors raised with a catalogue id (XSITASKS / simsgcat / plain ids) are logged as error lines that carry the id;
//    the catalogue texts were not read (note, open question 6).
//  * Objects this build has no class for get a small stand-in kept under `app.tasksB11c`: custom export converters
//    and the file events, the inspection history, the keyboard state, preset files (JSON in the virtual host file
//    system), the "reference" store of SetReference, pop-up menu records. Everything the note leaves open is marked
//    `// inferred` or logs "not yet attested".
import { App } from '../core/commands';
import { Node, X3DObject, Model, Shader, Material, Operator, Primitive, Property } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError, alembicState } from './alembicSeqCam';
import { sdkHelpersState } from './sdkHelpers';
import { findNode, siConst, unset } from './viewEditPropertyHelpers';

export { unset };
/** Items of a list argument: an array, a comma-separated string (commas inside [...] do not split), or one item. */
export function listOf(v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(listOf);
  if (typeof v !== 'string') return [v];
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of v) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(s => s.trim()).filter(Boolean);
}

export const NOTE = 'docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md';
export const ROW = 'CMD-B11c';
export const S_OK = 0, S_FALSE = 1, SI_ABORT = 0x562e80c7;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002, E_FAIL = 0x80004005,
  E_UNEXPECTED = 0x8000ffff, E_ACCESSDENIED = 0x80070005, STG_E_FILENOTFOUND = 0x80030002;
/** File event ids (note 2.2). */
export const EV_BEGIN_EXPORT = 0x20510013, EV_END_EXPORT = 0x20510014, EV_CUSTOM_EXPORT = 0x20510027;

export interface ConverterCtx { fileName: string; target: Node[]; frame: number; userData: any; command: string }
export interface CustomConverter { name: string; handler?: (ctx: ConverterCtx) => number | void }
export interface PopupRecord { command: string; anchor: { x: number; y: number }; items: string[]; picked: number | null }

export interface TasksB11cState {
  lastStatus: { command: string; status: number } | null;
  /** The application's alternate ("exp") mode. Off in this build. */
  altMode: boolean;
  /** Custom export converters by lower-case extension (no dot). Stand-in for F3DFindCustomConverterEventName. */
  converters: Map<string, CustomConverter>;
  registerCustomConverter(ext: string, name: string, handler?: (ctx: ConverterCtx) => number | void): void;
  /** Handlers of the begin-export event; a handler returning SI_ABORT aborts the export. */
  beginExportHandlers: ((ctx: ConverterCtx) => number | void)[];
  /** Fired file events, oldest first. */
  events: { id: number; name: string; fileName: string }[];
  /** Files written by the scene save entry of this build. */
  savedScenes: string[];
  /** Workgroup path (install path type 2). Empty: no workgroup. */
  workgroupPath: string;
  keyboard: { shift: boolean; ctrl: boolean; alt: boolean };
  pointer: { x: number; y: number };
  inspect: { history: Node[]; index: number; browsing: boolean };
  hooks: {
    /** TrackPopupMenu stand-in: return the 0-based picked item, or null / -1 for none. */
    popupMenu?: (items: string[], anchor: { x: number; y: number }, command: string) => number | null | undefined;
    /** The preset file picker of SILoadPreset: return a path or null (cancelled). */
    pickPresetFile?: (name: string) => string | null | undefined;
  };
  popups: PopupRecord[];
  progress: string[];
  /** The reference store of SetReference: owner -> descriptor -> value array. */
  references: Map<Node, Map<string, any[]>>;
  /** Fallback container of reference planes when the CMD-B7 plane store is absent. */
  refPlanes: Property[];
  /** Fallback Preferences.Duplicate transform block when the operators-scripts store is absent. */
  duplicatePrefs: Record<string, number>;
  /** The one project the project manager of this build knows (shared with the Alembic row). */
  readonly projectPath: string;
}

export function stateOf(app: App): TasksB11cState {
  const app2 = app as any;
  if (app2.tasksB11c) return app2.tasksB11c;
  const st: TasksB11cState = {
    lastStatus: null, altMode: false, converters: new Map(),
    registerCustomConverter(ext, name, handler) { st.converters.set(String(ext).replace(/^\./, '').toLowerCase(), { name, handler }); },
    beginExportHandlers: [], events: [], savedScenes: [], workgroupPath: '',
    keyboard: { shift: false, ctrl: false, alt: false }, pointer: { x: 0, y: 0 },
    inspect: { history: [], index: -1, browsing: false }, hooks: {}, popups: [], progress: [],
    references: new Map(), refPlanes: [], duplicatePrefs: { sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0 },
    get projectPath() { return alembicState.projectPath; },
  };
  app2.tasksB11c = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
/** CSIErrorHandling::Raise with a message id: an error line carrying the id (texts not read, open question 6). */
export function raise(app: App, command: string, id: string, detail = '') { app.logMsg('error', `${command}: [${id}]${detail ? ' ' + detail : ''}`); }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export const text = (v: any): string => unset(v) ? '' : v instanceof Node ? v.fullName : String(v);
export const interactive = (app: App) => (app as any).Interactive !== false;

// ------------------------------------------------------------------ arguments
/** A SingleObj / Collection argument: the given items, or the selection when omitted (argument handler, inferred). */
export function nodesArg(app: App, v: any, selectionDefault = true): Node[] {
  if (unset(v)) return selectionDefault ? [...app.selection] : [];
  const out: Node[] = [];
  for (const x of listOf(v)) { const n = findNode(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
export function nodeArg(app: App, v: any, selectionDefault = true): Node | null { return nodesArg(app, v, selectionDefault)[0] ?? null; }
/** An enum argument: number, or a name looked up in `names`; null when neither. */
export function enumArg(v: any, names: Record<string, number>): number | null {
  const c = siConst(v); if (c === null) return null;
  if (typeof c === 'number') return c;
  const k = Object.keys(names).find(n => n.toLowerCase() === c.toLowerCase());
  return k === undefined ? (Number.isFinite(Number(c)) ? Number(c) : null) : names[k];
}

// ------------------------------------------------------------------ files, paths, projects
export const extOf = (file: string) => { const b = hostFs.baseName(file); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1) : ''; };
export const isAbsolute = (p: string) => /^([A-Za-z]:([\\/]|$)|\\\\)/.test(p);
/** Install path by the binary's type number (note SavePreset): 0 project, 1 user, 2 workgroup, 3 factory (inferred order). */
export function installPath(app: App, type: number): string {
  switch (type) {
    case 0: return alembicState.projectPath;
    case 1: return sdkHelpersState.paths[1];
    case 2: return stateOf(app).workgroupPath;
    case 3: return 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2';   // inferred: factory path of a default install
    default: return '';
  }
}
/** Name of the current scene (the window caption kept by main.ts). */
export function currentSceneName(): string {
  try { const m = /Scene: (.*)$/.exec(document.title); if (m && m[1].trim()) return m[1].trim(); } catch { /* no DOM */ }
  return 'Untitled';
}
/** The scene as this build stores it: the command script since the last NewScene (what main.ts saves). */
export function sceneScript(app: App): string {
  const cmds = app.log.filter(l => l.kind === 'cmd').map(l => l.text);
  let start = 0; cmds.forEach((t, i) => { if (/^(Application\.)?NewScene\b/.test(t)) start = i + 1; });
  return cmds.slice(start).join('\n');
}
/** The framework's save-scene entry of this build: writes the scene script to the virtual host file system. */
export function frameworkSaveScene(app: App, command: string, file: string): number {
  try {
    hostFs.ensureFolder(hostFs.parentPath(file));
    hostFs.writeFile(file, sceneScript(app));
  } catch (e: any) { app.logMsg('error', `${command}: ${e?.description ?? e?.message ?? e}`); return E_FAIL; }
  stateOf(app).savedScenes.push(file);
  logNya(app, command, `the .scn binary format; "${file}" holds the scene's command script`);
  return S_OK;
}
/** Custom export converter for an extension; fires the converter event on the targets. */
export function findConverter(app: App, ext: string): CustomConverter | undefined { return stateOf(app).converters.get(ext.toLowerCase()); }
export function fireEvent(app: App, id: number, name: string, ctx: ConverterCtx, handlers: ((c: ConverterCtx) => number | void)[] = []): number {
  stateOf(app).events.push({ id, name, fileName: ctx.fileName });
  for (const h of handlers) { const r = h(ctx); if (typeof r === 'number' && r !== S_OK) return r; }
  return S_OK;
}
export function runConverter(app: App, conv: CustomConverter, ctx: ConverterCtx): number {
  stateOf(app).events.push({ id: EV_CUSTOM_EXPORT, name: conv.name, fileName: ctx.fileName });
  try { const r = conv.handler?.(ctx); return typeof r === 'number' ? r : S_OK; } catch (e: any) { app.logMsg('error', `${ctx.command}: ${e?.message ?? e}`); return E_FAIL; }
}

// ------------------------------------------------------------------ presets
/** Preset families of this build (inferred: the DSPresets folders the dumps name). */
export const FAMILIES = ['Shaders', 'Operators', 'Primitives', 'Properties', 'Materials'];
/** The object's preset family; null = the generic family (no favourite folder). */
export function familyOf(n: Node): string | null {
  if (n instanceof Shader) return 'Shaders';
  if (n instanceof Material) return 'Materials';
  if (n instanceof Operator) return 'Operators';
  if (n instanceof Primitive) return 'Primitives';
  if (n instanceof Property) return 'Properties';
  return null;   // inferred: objects belong to the generic family
}
export const findFamily = (name: string) => FAMILIES.find(f => f.toLowerCase() === name.toLowerCase()) ?? null;
/** Class id of an object as a preset records it (stand-in: the node type). */
export const classIdOf = (n: Node) => n.type;
export interface PresetData { preset: 1; classId: string; family: string | null; name: string; params: Record<string, any>; description: string; thumbnail: boolean }
export function readPreset(file: string): PresetData | null {
  try { const d = JSON.parse(hostFs.readFile(file)); return d && typeof d === 'object' ? d : null; } catch { return null; }
}
/** The parameter values a preset stores (writable plain values). */
export function presetParams(n: Node): Record<string, any> {
  const out: Record<string, any> = {};
  for (const p of n.params) { const v = p.value; if (p.def.readOnly) continue; if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) out[p.name] = v; }
  return out;
}
/** Candidate files of a preset name (0x1800723d0 was not opened; inferred: the name, then <root>\Data\DSPresets\<family>\<name>.Preset). */
export function resolvePresetFile(app: App, name: string, family: string | null): string | null {
  const withExt = (f: string) => extOf(f) ? f : f + '.Preset';
  if (isAbsolute(name)) { for (const f of [name, withExt(name)]) if (hostFs.isFile(f)) return f; return null; }
  for (const t of [1, 2, 3, 0]) {
    const root = installPath(app, t); if (!root) continue;
    const dir = family ? hostFs.join(hostFs.join(root, 'Data\\DSPresets'), family) : hostFs.join(root, 'Data\\DSPresets');
    for (const f of [hostFs.join(dir, name), hostFs.join(dir, withExt(name))]) if (hostFs.isFile(f)) return f;
  }
  return null;
}
/** The preset object handed back by CreatePreset / SavePreset. */
export class PresetObject extends Property {
  constructor(name: string, readonly file: string, readonly family: string | null, readonly data: PresetData | null) { super(name, 'Preset', []); }
}

// ------------------------------------------------------------------ misc
export const ownerModel = (o: X3DObject): string => { for (let p = o.parentObj; p; p = p.parentObj) if (p instanceof Model) return p.name; return 'Scene_Root'; };
export const uniqueIn = (list: { name: string }[], base: string) => { if (!list.some(x => x.name === base)) return base; let i = 1; while (list.some(x => x.name === `${base}${i}`)) i++; return `${base}${i}`; };
