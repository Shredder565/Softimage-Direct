// Ledger row CMD-B15a (modeltasks.dll): shared state and helpers of the model / scene-merge / import-export / referenced
// model / delta commands. Brief: docs/ghidra/cmd-b15a-modeltasks.md ("Shared facts" and "Contracts") and items 16-21 of
// docs/re/WIRE_CORRECTIONS_B15.md. Original code written from that prose only; no XSIBATCH golden exists.
//
// How the contract is mapped onto this build:
//  * Stand-in model: `app.modelTasksB15a` holds the licence word / restricted-mode switch (the real gates are unread, open
//    question 3: both default to "everything allowed"), the file-event log, hooks for the file readers the note did not
//    read (.scn, .emdl, .xsimixer, IGES, dotXSI material library) and the sub-task trace (SICreateModel runs
//    Add3DObjectToScene / ParentObj / AddGroup, ... : every sub-task call is recorded in `subtasks`).
//  * File content: "exists / valid" is asked of the virtual host file system (src/core/sdkHelpersHostFs.ts). What the
//    readers and writers put into the scene is NOT attested: the commands run every attested step (checks, events,
//    models, libraries, sub-tasks) and log "<command>: not yet attested: <what> (CMD-B15a)" for the content step.
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name).
//  * XSIMODELTASKS message texts are not in the repo: messages are logged as "XSIMODELTASKS 0x<id>" plus a plain hint.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Group } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { hostFs, unset, listOf, resolve, nodesArg, boolArg, numArg, intArg, isFile, isFolder, parentPath } from './pluginsB13eShared';

export { hostFs, unset, listOf, resolve, nodesArg, boolArg, numArg, intArg, isFile, isFolder, parentPath, Node, X3DObject, Model, Group };

export const NOTE = 'docs/ghidra/cmd-b15a-modeltasks.md';
export const ROW = 'CMD-B15a';
export const E_POINTER = 0x80004003, E_INVALIDARG = 0x80070057, E_FAIL = 0x80004005, E_NOTSUPPORTED = 0x80004021;
export const USER_ABORT = 0x562e80c7;
/** Licence feature bit the referenced-model commands test (generic licence object). */
export const LICENCE_REFMODEL = 0x40;
/** File events (F3DFireFileEvent ids) and kinds. */
export const EV_BEFORE_IMPORT = 0x20510015, EV_AFTER_IMPORT = 0x20510016, EV_BEFORE_EXPORT = 0x20510013, EV_AFTER_EXPORT = 0x20510014;
export const KIND_MODEL = 2, KIND_MATLIB = 0x16, KIND_MIXER = 0x18, KIND_IGES = 0x19;

export interface ModelTasksHooks {
  /** A file event handler: return USER_ABORT (0x562e80c7) to cancel the command. */
  fileEvent?: (id: number, kind: number, file: string) => number | void;
  /** Readers for the file formats the note did not read, keyed by extension without dot (scn, emdl, xsimixer, iges, xsiml). */
  readers: Record<string, (file: string, target: any) => void>;
  /** Writers (IGES export). */
  writers: Record<string, (file: string, inputs: Node[]) => void>;
  /** Custom converters registered per extension (F3DFindCustomConverterEventName 0x20510026 / the import-model one). */
  converters: Record<string, (file: string, model: Model | null) => Model | void>;
  /** The replace-delta question (XSIMODELTASKS 0x10 / 0x11): 'yes' | 'no' | 'cancel'. */
  yesNoCancel?: (question: string) => 'yes' | 'no' | 'cancel' | undefined;
}
export interface ModelTasksState {
  /** Licence feature word (bit 0x40 = referenced models). Open question 3: default allows. */
  licence: number;
  /** The app-mode object's "restricted" answer (SIGetAppMode slot 0x50, inferred). Default false. */
  restricted: boolean;
  /** File events fired, oldest first. */
  events: { id: number; kind: number; file: string }[];
  /** Sub-task runs, oldest first. */
  subtasks: { task: string; args: string }[];
  /** Value of the xsiprivate.SI3D_NODETRANSFORM_CHILD_COMPENSATE preference while SICreateModel moves the model. */
  compensate: number;
  /** Ambient flag `referencing.importingdelta`. */
  importingDelta: boolean;
  /** Legacy (pre-B15a) handlers of names replaced here, kept for the interactive menu path. */
  legacy: Record<string, ((app: App, a: Record<string, any>) => any) | undefined>;
  hooks: ModelTasksHooks;
}

export function stateOf(app: App): ModelTasksState {
  const a: any = app;
  if (a.modelTasksB15a) return a.modelTasksB15a;
  const st: ModelTasksState = {
    licence: 0xffff, restricted: false, events: [], subtasks: [], compensate: 0, importingDelta: false, legacy: {},
    hooks: { readers: {}, writers: {}, converters: {} },
  };
  a.modelTasksB15a = st;
  return st;
}

// ------------------------------------------------------------------ errors and log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
const hex = (n: number) => '0x' + n.toString(16);
/** CSIErrorHandling::Raise(hr, 2, msgId, text): logged as an error, then thrown. */
export function raise(app: App, cmd: string, hr: number, msgId: number, hint: string): SiStatusError {
  const text = `${cmd}: ${hint} (XSIMODELTASKS ${hex(msgId)})`;
  app.logMsg('error', text);
  return fail(hr, text);
}
export function warn(app: App, cmd: string, msgId: number, hint: string) { app.logMsg('info', `WARNING : ${cmd}: ${hint} (XSIMODELTASKS ${hex(msgId)})`); }
export function logNya(app: App, cmd: string, what: string) { app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`); }
export function subtask(app: App, task: string, args: string) { stateOf(app).subtasks.push({ task, args }); }

// ------------------------------------------------------------------ gates
/** Restricted application mode: IGES export, model-delta import and matlib export fail with 0x80004021 (simsgcat 0x143). */
export function restrictedGate(app: App, cmd: string) {
  if (stateOf(app).restricted) { const t = `${cmd}: not available in this application mode (simsgcat 0x143)`; app.logMsg('error', t); throw fail(E_NOTSUPPORTED, t); }
}
/** Licence gate (b): without bit 0x40 print XSIMODELTASKS 0x17 to stderr and do nothing. Returns true when the command may run. */
export function licenceGate(app: App, cmd: string): boolean {
  if (stateOf(app).licence & LICENCE_REFMODEL) return true;
  app.logMsg('error', `${cmd}: XSIMODELTASKS 0x17 (referenced models are not licensed); nothing was done`);
  return false;
}
/** F3DFireFileEvent: a handler answering USER_ABORT cancels the command. */
export function fireFileEvent(app: App, cmd: string, id: number, kind: number, file: string) {
  const st = stateOf(app); st.events.push({ id, kind, file });
  const r = st.hooks.fileEvent?.(id, kind, file);
  if (r === USER_ABORT) throw fail(USER_ABORT, `${cmd}: cancelled by a file event handler (status ${hex(USER_ABORT)})`);
}

// ------------------------------------------------------------------ files
export const extOf = (f: string) => { const b = hostFs.baseName(f); const i = b.lastIndexOf('.'); return i < 0 ? '' : b.slice(i).toLowerCase(); };
export const baseNoExt = (f: string) => { const b = hostFs.baseName(f); const i = b.lastIndexOf('.'); return i <= 0 ? b : b.slice(0, i); };
/** SIValidateFile stand-in: the extension is on the list and the file exists. */
export const validFile = (f: string, exts: string[]) => exts.includes(extOf(f)) && isFile(f);
export const fileExists = (f: string) => isFile(f);

// ------------------------------------------------------------------ objects
export function parentArg(app: App, v: any): X3DObject | null {
  if (unset(v)) return null;
  const n = resolve(app, v); return n instanceof X3DObject ? n : null;
}
export function modelOfNode(app: App, n: any): Model | null {
  let x: any = n;
  while (x && !(x instanceof X3DObject)) x = x.parentObj ?? x.parent;
  return x instanceof X3DObject ? (x.model ?? app.scene.root) : null;
}
/** Model owning a model (the next one up); the scene root has none. */
export function ownerModel(m: Model): Model | null { return m.parentObj ? (m.parentObj.model ?? null) : null; }
export function isDescendant(o: X3DObject, anc: X3DObject): boolean { for (let x = o.parentObj; x; x = x.parentObj) if (x === anc) return true; return false; }
/** Undoable addition of an object under a parent (Add3DObjectToScene stand-in: the task is not in this DLL). */
export function add3DObjectToScene(app: App, obj: X3DObject, parent: X3DObject | null) {
  const p = parent ?? app.scene.root;
  subtask(app, 'Add3DObjectToScene', `${obj.name} under ${p.name}`);
  app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj));
}
export function newModel(app: App, name: string): Model { return new Model(app.scene.uniqueName(name || 'Model')); }

/** Referenced-model stand-in record shared with the legacy src/commands/model2.ts commands. */
export interface RefRecord { file: string; resolution: number; resolutions: string[]; resolutionNames?: string[]; shareOptions?: number; applying?: number; activate?: boolean; data?: any }
export const refOf = (m: any): RefRecord | null => (m && (m as any).ref) ? (m as any).ref as RefRecord : null;
export function ensureRef(m: Model): RefRecord {
  const r: any = (m as any).ref ?? ((m as any).ref = { file: '', resolution: 0, resolutions: [] });
  r.resolutionNames ??= r.resolutions.map(() => '');
  (m as any).referencedModel = true;
  return r;
}
