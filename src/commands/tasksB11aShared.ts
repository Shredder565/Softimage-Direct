// Row CMD-B11a: shared state and helpers of the tasks.dll commands of tasksB11aMenus.ts, tasksB11aCache.ts and
// tasksB11aMisc.ts. Brief: docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md ("Wire contract" per command).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// Conventions of the row:
//  * A failing HRESULT is thrown as SiStatusError (status in the message); success statuses (0 = S_OK, 1 = S_FALSE)
//    are kept in `app.tasksB11a.status[<command>]`.
//  * Parts the contract names but this build does not model log "<command>: not yet attested: <what> (CMD-B11a)".
//  * Everything the commands do that a script or a check may want to look at is kept under `app.tasksB11a`.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model, Property, Pass, Layer } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { B11A_SPECS } from './tasksB11aArgs';
import { nodeOf } from './duplicateRenderingSimulationScriptsShared';
import { particleScripts } from './particleScripts';

export const ROW = 'CMD-B11a';
export const S_OK = 0, S_FALSE = 1;
export const E_NOTIMPL = 0x80004001, E_NOINTERFACE = 0x80004002, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff;
export const E_INVALIDARG = 0x80070057, DISP_E_PARAMNOTFOUND = 0x80020004, DISP_E_EXCEPTION = 0x80020009;
export { SiStatusError };

export interface MenuRecord { command: string; items: Node[]; labels: string[]; anchor: { x: number; y: number }; embedded: any; chosen: number | null }
export interface InspectRecord { via: string; command: string; nodes: Node[]; keywords: string | null }
export interface B11aState {
  registered: string[];
  replaced: string[];
  status: Record<string, number>;
  /** Hooks a script or a check can set to answer the interactive parts synchronously. */
  hooks: {
    /** Pop-up menus: index of the chosen entry, or null / -1 for cancel. */
    popupChoice: ((rec: MenuRecord) => number | null) | null;
    /** PickPosition: the picked position and button, or null when the picker start reports S_FALSE. */
    pickPosition: ((statusText: string) => { pos: [number, number, number]; button: number } | null) | null;
    /** OBJ bridge: plug-in exports by file name (`XSIOnCommand(name, args)` returns the command's return value). */
    plugins: Record<string, { XSIOnCommand(name: string, args: any[]): any }>;
  };
  menus: MenuRecord[];
  inspected: InspectRecord[];
  /** Current particle type of the particle type container (F3DGetParTypeContainer). */
  currentParType: Property | null;
  /** Current item of the 3D content container's sub-container (SetCurrentParType Type 2). */
  currentContentItem: Node | null;
  /** Events fired by SetCurrentParType for passes: [id, oldName, newName]. */
  events: [number, string, string][];
  /** Objects of the transient object container (CreateObjectFromPreset). */
  transient: Node[];
  /** Soft references recorded on the first run of CreateObjectFromPreset: preset file path and object. */
  presetRecords: { file: string; object: Node }[];
  /** Ambient values (Datamanagement_CachingToFiles). */
  ambient: Record<string, number>;
  /** Progress bars opened by the cache commands. */
  progress: { title: string; items: string[] }[];
  /** Token values for the cache path templates that the build cannot resolve itself ("project path", "project", "env XSI_USERHOME"). */
  tokens: Record<string, string>;
  /** Cache writes planned by CacheObjectsIntoFile_Private (the writer is not modelled). */
  cachePlans: { object: string; file: string; frames: number[]; attributes: string[] }[];
  /** Files produced by DumpCacheHeader and Net View requests. */
  dumps: { source: string; xml: string; netView: boolean }[];
  netViews: any[];
  /** ImportPrefs requests posted to the deferred-execution service, and loaded files. */
  prefRequests: { id: number; file: string; done: boolean }[];
  /** OBJ bridge calls: plug-in, command name, the VARIANT array of visible arguments. */
  bridgeCalls: { plugin: string; name: string; args: any[]; ret: any }[];
  /** Last PickPosition outputs (filled when the pick ends). */
  lastPick: { PosX: number; PosY: number; PosZ: number; ButtonPressed: number; statusText: string } | null;
}

export function b11a(app: App): B11aState {
  const a = app as any;
  return a.tasksB11a ??= {
    registered: [], replaced: [], status: {}, hooks: { popupChoice: null, pickPosition: null, plugins: {} }, menus: [], inspected: [],
    currentParType: null, currentContentItem: null, events: [], transient: [], presetRecords: [], ambient: {}, progress: [], tokens: {},
    cachePlans: [], dumps: [], netViews: [], prefRequests: [], bridgeCalls: [], lastPick: null,
  } as B11aState;
}

/** Register with the registry argument list. An earlier registration of the name is replaced (and noted). */
export function reg(app: App, name: string, def: Omit<CommandDef, 'name' | 'args' | 'label' | 'category' | 'description'> & Partial<Pick<CommandDef, 'label' | 'category' | 'description'>>) {
  const st = b11a(app); const spec = B11A_SPECS[name];
  if (!spec) throw new Error(`${ROW}: no registry argument list for ${name}`);
  if (app.commands.has(name)) st.replaced.push(name);
  app.register({ name, label: def.label ?? spec.label, category: def.category ?? spec.category, description: def.description ?? spec.description, ...def, args: spec.args.map(x => ({ ...x })) } as CommandDef);
  st.registered.push(name);
}

export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function setStatus(app: App, command: string, status: number) { b11a(app).status[command] = status; return status; }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export const warn = (app: App, text: string) => app.logMsg('info', 'WARNING : ' + text);
export const interactive = (app: App) => (app as any).Interactive !== false;

export const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
export const text = (v: any): string => v === undefined || v === null ? '' : v instanceof Node ? v.name : String(v);
export const boolA = (v: any) => typeof v === 'string' ? /^(true|1|yes|-1)$/i.test(v.trim()) : !!v;
export const num = (v: any, d = 0) => { const n = Number(v); return v === undefined || v === null || v === '' || !Number.isFinite(n) ? d : n; };

/** One element argument: a node, or a name (`obj`, `obj.property`, `Passes.X`, a layer or particle type name). */
export function nodeArg(app: App, x: any): Node | undefined {
  if (x instanceof Node) return x;
  if (Array.isArray(x)) return nodeArg(app, x[0]);
  if (typeof x !== 'string') return undefined;
  const s = x.trim(); if (!s) return undefined;
  if (s === app.scene.root.name) return app.scene.root;
  const o = app.scene.find(s); if (o) return o;
  const layer = app.scene.layers.find(l => l.name === s || `Layers.${l.name}` === s); if (layer) return layer;
  const pt = particleScripts(app).particleTypes.find(p => p.name === s); if (pt) return pt;
  const n = nodeOf(app, s); if (n) return n;
  const i = s.lastIndexOf('.');
  if (i > 0) {
    const owner = app.scene.find(s.slice(0, i)); const leaf = s.slice(i + 1).toLowerCase();
    const p = owner?.allProperties().find(q => q.name.toLowerCase() === leaf || q.type.toLowerCase() === leaf); if (p) return p;
  }
  return undefined;
}
/** A list argument as raw items (comma-separated names or an array). */
export function rawItems(arg: any): any[] {
  if (unset(arg)) return [];
  if (Array.isArray(arg)) return arg;
  if (typeof arg === 'string') { const out: string[] = []; let depth = 0, cur = ''; for (const ch of arg) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(t => t.trim()).filter(Boolean); }
  return [arg];
}
/** A collection argument as nodes; unset = the selection (the collection argument handler). */
export function nodesArg(app: App, arg: any, selectionFallback = true): Node[] {
  if (unset(arg)) return selectionFallback ? [...app.selection] : [];
  const out: Node[] = [];
  for (const x of rawItems(arg)) { const n = nodeArg(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
export const isPass = (n: any): n is Pass => n instanceof Pass;
export const isLayer = (n: any): n is Layer => n instanceof Layer;
export const isParType = (n: any): n is Property => n instanceof Property && n.type === 'ParType';
/** The model that owns a node (scene root for top-level objects). */
export function ownerModel(n: Node): Model | null { let p: any = n; while (p) { if (p instanceof X3DObject) return p instanceof Model ? p : p.model; p = p.parent; } return null; }
export const objOf = (n: Node): X3DObject | null => { let p: any = n; while (p && !(p instanceof X3DObject)) p = p.parent; return p ?? null; };
