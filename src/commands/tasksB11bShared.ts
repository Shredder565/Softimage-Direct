// Ledger row CMD-B11b: shared state and helpers of the tasks.dll commands wired in tasksB11b*.ts.
// Brief: docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md (the per-command "Wire contract" sections).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// Conventions (same as the CMD-B9 fxcore work):
//  * A failure HRESULT is thrown as SiStatusError (the bus logs "<Command>: <message> (status 0x...)").
//  * Non-failure statuses (0 = S_OK, 1 = S_FALSE "nothing to do") are kept in `app.tasksB11b.lastStatus`.
//  * Output arguments that are not the return value are returned together as an object (the ISIVTCollection of the
//    scripting layer) and also kept in `app.tasksB11b.outputs[<command>]`.
//  * Where the contract talks to a part of Softimage this build does not have (plug-in manager, custom import
//    converters, file events, command processor, install paths, pick UI), a small stand-in or hook lives on the state
//    object, documented on its field. Branches beyond what the contract or the stand-in can carry log
//    "not yet attested".
import type { App, ArgDef } from '../core/commands';
import { X3DObject, Node } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { siString, siMessage } from '../ui/si';

export const ROW = 'CMD-B11b';
export const NOTE = 'docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md';
export const S_OK = 0, S_FALSE = 1;
export const E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002, E_UNEXPECTED = 0x8000ffff, E_FAIL = 0x80004005;
export const DISP_E_MEMBERNOTFOUND = 0x80020003;
/** The Softimage "success with information" code a file pre-event answer can carry (aborts the import). */
export const SI_SUCCESS_INFO = 0x562e80c7;
export const EVT_FILE_PRE = 0x20510015, EVT_FILE_POST = 0x20510016, EVT_CUSTOM_CONVERTER = 0x20510026;
export const FILE_TYPE_CUSTOM = 0x1f;

/** Registry argument lists (data/command_registry.json; return-value arguments left out; data/commands_full.json
 *  defaults where the registry has none). */
export const B11B_ARGS: Record<string, ArgDef[]> = {
  PickElement: [{ name: 'SelFilter', default: null }, { name: 'LeftMessage', default: '' }, { name: 'MiddleMessage', default: '' }, { name: 'PickedElement', default: null }, { name: 'ButtonPressed', default: 0 }, { name: 'SelRegionMode', default: 0 }, { name: 'ModifierPressed', default: 0 }],
  PickObject: [{ name: 'SelFilter', default: '{1128E000-DBE2-11d2-8BCF-00AA006130EF}:object' }, { name: 'LeftMessage', default: '' }, { name: 'MiddleMessage', default: '' }, { name: 'PickedElement', default: '' }, { name: 'ButtonPressed', default: 0 }, { name: 'ModifierPressed', default: 0 }],
  GetNumberOfKnots: [{ name: 'InputObj', default: null }, { name: 'NbItems', default: 0 }],
  GetCurvePercentageAtKnotIndex: [{ name: 'InputObj', default: null }, { name: 'Index', default: 0 }, { name: 'Percentage', default: 0 }],
  EnumElements: [{ name: 'InputObj', default: null }, { name: 'EnumChildren', default: true }, { name: 'Capabilities', default: 524288 }],
  'Obstalce Pop-up Menu': [{ name: 'InputObjs', default: null }, { name: 'EmbeddedCommand', default: null }],
  GetExternalReferences: [],
  UpdateExternalReference: [{ name: 'Target', default: null }, { name: 'InputObjs', default: '' }],
  ImportCustomFile: [{ name: 'FileName', default: '' }, { name: 'Target', default: null }, { name: 'Reference', default: false }, { name: 'Name', default: '' }, { name: 'Frame', default: null }, { name: 'UserData', default: null }],
  System: [{ name: 'Pathname', default: '' }],
  SetReferencePlane: [{ name: 'Target', default: null }, { name: 'InputObj', default: null }],
  CrashXSI: [],
  DumpMemoryStats: [],
  GetUnevaluatedPrimitiveForConstructionHistory: [{ name: 'X3DObject', default: null }],
  IsSoftimageDevDrop: [],
  SIGetHelpPath: [],
  ICEOfflineRefresh: [],
  UnloadAddonLib: [{ name: 'FileName', default: null }],
  ReloadAddonLib: [{ name: 'FileName', default: null }],
  UnloadAllAddonLibs: [],
  ReloadAllAddonLibs: [],
  UnloadAllCOMLibs: [],
  TestPluginHost: [{ name: 'Destroy', default: true }],
};
/** Registry display names / descriptions (labels of the command definitions). */
export const B11B_LABEL: Record<string, string> = {
  PickElement: 'Pick Element', PickObject: 'Pick Object', UpdateExternalReference: 'Update External Reference', ImportCustomFile: 'Custom File Import',
  SetReferencePlane: 'Set Reference Plane', SIGetHelpPath: 'Get help path', UnloadAddonLib: 'Unload Addon library', ReloadAddonLib: 'Reload Addon library',
  UnloadAllAddonLibs: 'Unload Addon libs', ReloadAllAddonLibs: 'Reload Addon libs', UnloadAllCOMLibs: 'Unload COM libraries', TestPluginHost: 'Test plugin host',
};

// ------------------------------------------------------------------ stand-in state
/** A plug-in known to the stand-in plug-in manager. `factory` = the manager's state 3 (factory plug-in: the note's
 *  "cannot unload" state; the catalogue messages 0x118 / 0x11d name it "Factory plug-ins"). */
export interface B11bPlugin { name: string; file: string; factory: boolean; loaded: boolean; loads: number }
/** A plug-in library (SIGetPluginLibraryInfo) the plug-in manager does not know. */
export interface B11bLibrary { file: string; loaded: boolean; loads: number }
export interface PickHookResult { picked: any[]; flags: number; kind?: number; itemButton?: number }
export interface B11bEvent { id: number; args: any[] }

export interface TasksB11bState {
  registered: string[];
  replaced: string[];
  lastStatus: { command: string; status: number } | null;
  outputs: Record<string, any>;
  /** Environment variables visible to the commands (the browser has none). CrashXSI reads XSI_SUPPORT_CRASH_XSI_COMMAND. */
  env: Record<string, string>;
  /** Ambient values (SI3D_RECTSEL_REGION_MODE). */
  ambient: Record<string, number>;
  /** Pick UI hook: called by PickElement / PickObject with the session parameters; returns the picked list and the raw
   *  pick flags (0x1 left, 0x2 cancelled, 0x4 Shift, 0x8 Ctrl, 0x10 middle, 0x80 Alt) or null for nothing picked. */
  pickHook: ((filter: string, left: string, middle: string, right: string, regionMode: number) => PickHookResult | null) | null;
  /** Popup menu hook of "Obstalce Pop-up Menu": returns the chosen entry index or -1. */
  menuHook: ((labels: string[], anchor: { x: number; y: number }) => number) | null;
  /** Last cursor position and element under it (recorded for the popup anchor). */
  cursor: { x: number; y: number; target: Element | null };
  /** Plug-in manager stand-in. */
  plugins: B11bPlugin[];
  libraries: B11bLibrary[];
  /** Custom import converters by lower-case extension (the event 0x20510026 handlers). */
  converters: Map<string, (file: string, fileType: number, frame: number, userData: any, ctx: { target: Node; reference: boolean; name: string }) => any>;
  /** File event handlers (pre 0x20510015 / post 0x20510016); a pre handler returning SI_SUCCESS_INFO aborts. */
  fileEvents: ((e: B11bEvent) => any)[];
  /** Events fired, newest last. */
  events: B11bEvent[];
  /** Command processor of System (`system()`); null = none available (the browser). Returns the exit code. */
  commandProcessor: ((cmd: string) => number) | null;
  /** Installation paths by id (3 = the factory path, 1 = the user path). */
  installPaths: Record<number, string>;
  /** Help files path (DsGetHelpFilesPath). */
  helpPath: string;
  /** Names of the referenced-model / external-reference objects whose resolution is being switched. */
  switching: Set<any>;
  /** Count of F3DFlushDirtyServiceModeObjects / CoFreeUnusedLibraries calls. */
  flushes: number;
  comFrees: number;
  /** Log lines DumpMemoryStats wrote. */
  memoryDumps: number;
}

export function b11b(app: App): TasksB11bState {
  return ((app as any).tasksB11b ??= {
    registered: [], replaced: [], lastStatus: null, outputs: {}, env: {}, ambient: { SI3D_RECTSEL_REGION_MODE: 0 },
    pickHook: null, menuHook: null, cursor: { x: 0, y: 0, target: null }, plugins: [], libraries: [], converters: new Map(), fileEvents: [], events: [],
    commandProcessor: null,
    installPaths: {},
    helpPath: 'https://help.autodesk.com/view/SI/2015/ENU/', // inferred: this build's help files are the online Softimage 2015 help used by the Help menu
    switching: new Set(), flushes: 0, comFrees: 0, memoryDumps: 0,
  } as TasksB11bState);
}

export function fail(status: number, what: string): SiStatusError { return new SiStatusError(status, what); }
export function setStatus(app: App, command: string, status: number) { b11b(app).lastStatus = { command, status }; return status; }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function outputs(app: App, command: string, values: Record<string, any>) { b11b(app).outputs[command] = values; return values; }

/** Dictionary text; a stated placeholder when the id is missing from data/si/dict.json. */
export function tasksText(id: number): string { return siString('XSITASKS', id) ?? `[XSITASKS ${id}: text not in the dictionary]`; }
export function msgText(id: number, ...args: (string | number)[]): string {
  const t = siMessage(id, ...args); return t ? t.trim() : `[simsgcat ${id}: text not in the catalogue] ${args.join(' ')}`.trim();
}

export const unset = (v: any) => v === undefined || v === null || v === '';
/** Comma-separated list; commas inside [...] do not split. */
export function splitList(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '[') depth++; else if (ch === ']') depth = Math.max(0, depth - 1); if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(t => t.trim()).filter(Boolean);
}
export function findObj(app: App, x: any): X3DObject | undefined {
  if (x instanceof X3DObject) return x;
  if (typeof x !== 'string' || !x) return undefined;
  const s = x.trim();
  if (s === app.scene.root.name || s === app.scene.root.fullName) return app.scene.root;
  return app.scene.find(s) ?? app.scene.find(s.replace(/^Scene_Root\./, ''));
}
/** An object argument (handler 55f36231): a node, a name, or unset = the first selected node (inferred: the argument
 *  handler's selection default, as for the other InputObj arguments of the bus). */
export function objectArg(app: App, v: any): Node | undefined {
  if (v instanceof Node) return v;
  if (Array.isArray(v)) return objectArg(app, v[0]);
  if (unset(v)) return app.selection[0];
  return findObj(app, String(v));
}
/** A list argument (handler 7834cb8c): nodes, component strings, names; unset = the selection (inferred, as above). */
export function listArg(app: App, v: any): any[] {
  if (unset(v)) {
    const c = app.compSel;
    if (c) { const items = c.kind === 'point' ? [...c.points] : c.kind === 'polygon' ? [...c.polygons] : [...c.edges]; if (items.length) return [`${c.obj.name}.${c.kind === 'point' ? 'pnt' : c.kind === 'polygon' ? 'poly' : 'edge'}[${items.join(',')}]`]; }
    return [...app.selection];
  }
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? splitList(v) : [v];
  return raw.map(x => typeof x === 'string' && !/\[/.test(x) ? (findObj(app, x) ?? x) : x);
}
export const nameOf = (x: any): string => String(x?.fullName ?? x?.name ?? x ?? '');
