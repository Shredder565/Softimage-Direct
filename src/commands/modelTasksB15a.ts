// Ledger row CMD-B15a (`modeltasks.dll`): model creation, scene merge, model / IGES / mixer / material-library import and
// export, model-clip light lists, referenced-model resolutions and deltas. Commands wired here (the ones that were not
// on the bus yet):
//   SICreateModel SIGetModel SIImportModel SIMergeScene SIImportIges SIExportIges MergeMixer SIImportMatLib
//   SIImportReferencedMatLib ExportMaterialLibrary GetLightListOnModelClip SetLightListOnModelClip
//   SISetResolutionOfRefModels RemoveRefModelResolution SICreateRefModel ApplyDelta ImportReferencedDelta
//   Add3DObjectToScene (not in modeltasks.dll, WIRE_CORRECTIONS_B15 item 17: inferred from the sub-task use only)
// Brief: docs/ghidra/cmd-b15a-modeltasks.md ("Wire contract" / section 3, including the `(inferred)` parts) and
// docs/re/WIRE_CORRECTIONS_B15.md items 16-21. Original code written from that prose only; no golden exists.
//
// Mapping onto this build:
//  * The restricted application mode (SIGetAppMode slot 0x50) is the CMD-B11c alternate mode
//    (`app.tasksB11c.altMode`); the licence feature bit 0x40 is `app.modelTasksB15a.licence.refModels` (on).
//  * File events are recorded in `app.modelTasksB15a.events`; a handler in `hooks.fileEvent` answering 0x562e80c7
//    cancels the command (that value is returned as the status).
//  * Custom import converters are the CMD-B11c converter table (by extension).
//  * XSIMODELTASKS message texts are not in the repo: a raise logs "<command>: [XSIMODELTASKS 0x..] <detail>".
//  * Files are the session's virtual host file system (`app.hostFs`).
//  * A referenced model is a Model carrying `ref = { file, resolution, resolutions[], resNames[] }` (model2.ts shape;
//    resolution i >= 1 is resolutions[i-1], 0 is offloaded). A delta is a Property of type `delta` on the model.
//  * A model clip is a Property of type `modelclip`; its light list is the `lightList` field.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15a)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { Group, Model, Node, Property, X3DObject, mixerOf } from '../core/scene';
import { str, int, bool } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { hostFs } from '../core/sdkHelpersHostFs';
import { stateOf as b11cState } from './tasksB11cShared';

const ROW = 'CMD-B15a';
const CAT = 'Model';
export const S_OK = 0, S_FALSE = 1, SI_ABORT = 0x562e80c7;
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_RESTRICTED = 0x80004021;
const EV_BEGIN_IMPORT = 0x20510015, EV_END_IMPORT = 0x20510016, EV_BEGIN_EXPORT = 0x20510013, EV_END_EXPORT = 0x20510014;
const KIND_MODEL = 2, KIND_MATLIB = 0x16, KIND_MIXER = 0x18, KIND_IGES = 0x19;

export interface FileEvent { id: number; kind: number; fileName: string; command: string }
export interface ModelTasksB15aState {
  licence: { refModels: boolean };
  events: FileEvent[];
  /** Non-failing statuses by command (S_FALSE, or a licence-gate return). */
  status: Record<string, number | string>;
  recentModels: string[];
  hooks: {
    fileEvent?: (ev: FileEvent) => number | void;
    /** Yes/No/Cancel answer of the ImportDelta replace prompt (6 Yes, 7 No, 2 Cancel). */
    msgBox?: (text: string, flags: number, command: string) => number | undefined;
    /** Usability check of a resolution file (SISetResolutionOfRefModels); default: the file exists. */
    resolutionUsable?: (file: string) => boolean;
  };
  /** Calls handed to translators this build does not have (IGES, mixer stream, crosswalk). */
  translatorCalls: { command: string; what: string; args: any }[];
}
export function mtState(app: App): ModelTasksB15aState {
  const a: any = app;
  return (a.modelTasksB15a ??= { licence: { refModels: true }, events: [], status: {}, recentModels: [], hooks: {}, translatorCalls: [] });
}

// ------------------------------------------------------------------ status, errors, log
const fail = (status: number, what: string) => new SiStatusError(status, what);
/** CSIErrorHandling::Raise(hr, 2, msgId[, text]) with a XSIMODELTASKS id: an error line carrying the id, then the status. */
function raise(app: App, C: string, hr: number, id: number, detail = ''): SiStatusError {
  app.logMsg('error', `${C}: [XSIMODELTASKS 0x${id.toString(16)}]${detail ? ' ' + detail : ''}`);
  return fail(hr, `${C}: XSIMODELTASKS 0x${id.toString(16)}${detail ? ' ' + detail : ''}`);
}
const warn = (app: App, C: string, id: number, detail = '') => app.logMsg('info', `WARNING : ${C}: [XSIMODELTASKS 0x${id.toString(16)}]${detail ? ' ' + detail : ''}`);
const nya = (app: App, C: string, what: string) => app.logMsg('info', `${C}: not yet attested: ${what} (${ROW})`);
const restricted = (app: App) => !!b11cState(app).altMode;
/** Licence gate (b): without feature 0x40 the command prints XSIMODELTASKS 0x17 to stderr and does nothing. */
function licenceMissing(app: App, C: string): boolean {
  if (mtState(app).licence.refModels) return false;
  const line = `${C}: [XSIMODELTASKS 0x17] (licence feature 0x40 missing)`;
  try { console.error(line); } catch { /* no console */ }
  app.logMsg('info', line);
  nya(app, C, 'the return value when the licence feature is missing (nothing is done, undefined returned)');
  mtState(app).status[C] = 'licence';
  return true;
}
/** F3DFireFileEvent: recorded; a handler answering SI_ABORT cancels. Returns the handler's answer or S_OK. */
function fireFileEvent(app: App, C: string, id: number, kind: number, fileName: string): number {
  const ev: FileEvent = { id, kind, fileName, command: C };
  const st = mtState(app); st.events.push(ev);
  const r = st.hooks.fileEvent?.(ev);
  return typeof r === 'number' ? r : S_OK;
}
function checkAbort(app: App, C: string, r: number) { if (r === SI_ABORT) { mtState(app).status[C] = SI_ABORT; throw fail(SI_ABORT, `${C}: cancelled by a file event handler`); } }

// ------------------------------------------------------------------ arguments
const unset = (v: any) => v === undefined || v === null || v === '';
const text = (v: any): string => (v === undefined || v === null ? '' : v instanceof Node ? v.fullName : String(v));
function listOf(v: any): any[] {
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  if (typeof v === 'object' && typeof v[Symbol.iterator] === 'function' && !(v instanceof Node)) return [...v];
  return [v];
}
function findNode(app: App, x: any): Node | null {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  if (s === 'Scene_Root' || s === app.scene.root.fullName) return app.scene.root;
  const o = app.scene.find(s) ?? app.scene.find(s.split('.').pop()!);
  if (o) return o;
  const g = app.scene.groupList.find(g => g.name === s || g.fullName === s || g.name === s.split('.').pop());
  if (g) return g;
  const clips: Property[] = (app as any).uixsiClipsDisplayAddons?.modelClips ?? [];
  const c = clips.find(c => c.name === s || c.name === s.split('.').pop()); if (c) return c;
  for (const o2 of app.scene.allObjects()) for (const p of o2.properties) if (p.fullName === s) return p;
  return null;
}
/** Collection argument: the given items, else the selection (argument handler). */
function collectionArg(app: App, v: any): Node[] {
  if (unset(v)) return [...app.selection];
  const out: Node[] = [];
  for (const x of listOf(v)) { const n = findNode(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}
const boolArg = (v: any, d: boolean) => (unset(v) ? d : typeof v === 'string' ? !/^(false|0|no)$/i.test(v.trim()) : !!v);
const numArg = (v: any, d: number) => { if (unset(v)) return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
const extOf = (f: string) => { const b = hostFs.baseName(f); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
const baseNoExt = (f: string) => { const b = hostFs.baseName(f); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; };
const isFile = (f: string) => { try { return !!f && hostFs.isFile(f); } catch { return false; } };
const isFolder = (f: string) => { try { return !!f && hostFs.isFolder(f); } catch { return false; } };
const readText = (f: string) => { try { return hostFs.readFile(f); } catch { return null; } };
const isUrl = (f: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

// ------------------------------------------------------------------ scene helpers
/** Owner model of an item: the nearest Model strictly above an X3DObject; for other items the nearest Model at or above
 *  the object owning them (inferred: X3DObject.Model). The scene root owns itself. */
function ownerModel(app: App, n: Node | null): Model | null {
  if (!n) return null;
  if (n === app.scene.root) return app.scene.root;
  if (n instanceof X3DObject) { let p = n.parentObj; while (p && !(p instanceof Model)) p = p.parentObj; return (p as Model | null) ?? app.scene.root; }
  if (n instanceof Group) return n.parent instanceof Model ? n.parent : app.scene.root;
  let p: any = n.parent; while (p && !(p instanceof X3DObject)) p = p.parent;
  if (!p) return null;
  while (p && !(p instanceof Model)) p = p.parentObj;
  return (p as Model | null) ?? app.scene.root;
}
const isDescendant = (o: X3DObject, of: X3DObject) => { let p = o.parentObj; while (p) { if (p === of) return true; p = p.parentObj; } return false; };
const inScene = (app: App, o: X3DObject) => { let p: X3DObject | null = o; while (p) { if (p === app.scene.root) return true; p = p.parentObj; } return false; };
const isAnimated = (app: App, o: X3DObject) => o.kinematics.local.params.some(p => app.anim.fcurves.has(p));
/** Sets an object's local transform so that its global matrix becomes `g` (undoable). */
function setGlobal(app: App, o: X3DObject, g: THREE.Matrix4) {
  const parent = o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
  const local = parent.invert().multiply(g);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(p, q, s);
  const order = (['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'] as const)[Number(o.kinematics.local.val('rotorder')) || 0];
  const e = new THREE.Euler().setFromQuaternion(q, order); const r = 180 / Math.PI;
  const L = o.kinematics.local; const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const set = (n: string, v: number) => { const prm = L.get(n)!; if (!near(Number(prm.value), v)) app.setParam(prm, v); };
  set('posx', p.x); set('posy', p.y); set('posz', p.z);
  set('rotx', e.x * r); set('roty', e.y * r); set('rotz', e.z * r);
  set('sclx', s.x); set('scly', s.y); set('sclz', s.z);
}
function reparent(app: App, o: X3DObject, to: X3DObject, label: string) {
  const old = o.parentObj; if (old === to) return;
  app.record(label, () => to.addChild(o), () => { if (old) old.addChild(o); else to.removeChild(o); });
}

// ------------------------------------------------------------------ Add3DObjectToScene (inferred)
/** Add3DObjectToScene: handler not in modeltasks.dll (WIRE_CORRECTIONS_B15 item 17). Inferred from the sub-task calls
 *  (one-item list {model} under the parent): objects not yet in the scene are added under Parent (scene root when none). */
function add3DObjectToScene(app: App, a: Record<string, any>) {
  const C = 'Add3DObjectToScene';
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  const parent = parentNode instanceof X3DObject ? parentNode : app.scene.root;   // inferred
  const items = listOf(a.InputObjs).length ? listOf(a.InputObjs).map(x => x instanceof Node ? x : findNode(app, x)) : [...app.selection];
  let added = 0;
  for (const o of items) {
    if (!(o instanceof X3DObject)) continue;
    if (o === app.scene.root) continue;
    if (inScene(app, o)) { nya(app, C, `an object already in the scene (${o.fullName}); left where it is`); continue; }
    reparent(app, o, parent, 'Add ' + o.name); added++;
  }
  mtState(app).status[C] = added ? S_OK : S_FALSE;
  return undefined;
}

// ------------------------------------------------------------------ SICreateModel
interface Filtered { objects: X3DObject[]; groups: Group[]; dropped: boolean }
/** Input filter 0x18000a9c0 (section 3, step 2). */
function filterInputs(items: Node[]): Filtered {
  const out: Filtered = { objects: [], groups: [], dropped: false };
  for (const n of items) {
    if (n instanceof Group) { out.groups.push(n); continue; }
    if (n instanceof X3DObject) {
      if (n.type === 'eff' || n.type === 'root') { out.dropped = true; continue; }   // skeleton kinds 2 / 3 (inferred: effectors / chain roots)
      if (out.objects.length && n.parentObj !== out.objects[0].parentObj) { out.dropped = true; continue; }
      out.objects.push(n); continue;
    }
    out.dropped = true;
  }
  return out;
}
export function siCreateModel(app: App, a: Record<string, any>, addToScene = true) {
  const C = 'SICreateModel';
  const given = !unset(a.InputObj);
  const items = given ? listOf(a.InputObj).map(x => findNode(app, x)).filter((n): n is Node => !!n) : [...app.selection];
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  let parent: X3DObject | null = parentNode instanceof X3DObject ? parentNode : null;
  // 1. graph update: the scene evaluates on demand here
  // 2. input filter
  let f: Filtered = { objects: [], groups: [], dropped: false };
  if (items.length) {
    f = filterInputs(items);
    if (f.dropped) warn(app, C, 0x13, 'some input objects cannot be put in the model and were skipped');
    if (parent && f.objects.some(o => o === parent || isDescendant(parent!, o))) throw fail(E_INVALIDARG, `${C}: Parent is one of the input objects or below one`);
    if (!f.objects.length && !f.groups.length) throw fail(E_INVALIDARG, `${C}: nothing in InputObj can be put in a model`);
  }
  // 3. the model
  const model = new Model(app.scene.uniqueName(text(a.Name) || 'Model'));
  // 4. default parent
  if (!parent) {
    if (f.objects.length === 1) parent = f.objects[0].parentObj;
    else if (f.groups.length === 1) parent = ownerModel(app, f.groups[0]);
  }
  // 5. Add3DObjectToScene {model} under the parent
  if (addToScene) app.run('Add3DObjectToScene', { InputObjs: [model], Parent: parent ?? app.scene.root });
  // 6. ParentObj, then the model goes to the average global position of the objects (children compensated)
  if (f.objects.length) {
    const globals = new Map(f.objects.map(o => [o, o.globalMatrix().clone()] as const));
    if (app.commands.has('ParentObj')) app.run('ParentObj', { Parent: model.fullName, Children: f.objects });
    else for (const o of f.objects) reparent(app, o, model, 'ParentObj');
    // ParentObj keeps the global pose (Softimage default); this build's ParentObj keeps the local values
    for (const o of f.objects) setGlobal(app, o, globals.get(o)!);
    // inferred polarity: the averaging is skipped as soon as an object is animated
    if (!f.objects.some(o => isAnimated(app, o))) {
      const avg = new THREE.Vector3();
      for (const o of f.objects) avg.add(new THREE.Vector3().setFromMatrixPosition(globals.get(o)!));
      avg.divideScalar(f.objects.length);
      // xsiprivate.SI3D_NODETRANSFORM_CHILD_COMPENSATE = 1 while the model moves: children keep their global pose
      setGlobal(app, model, new THREE.Matrix4().makeTranslation(avg.x, avg.y, avg.z));
      for (const o of f.objects) setGlobal(app, o, globals.get(o)!);
    }
  }
  // 7. AddGroup (model, group) with exactly one group: the group moves into the model
  if (f.groups.length === 1) {
    const g = f.groups[0]; const old = g.parent;
    app.record('AddGroup', () => { g.parent = model; }, () => { g.parent = old; });
  }
  mtState(app).status[C] = S_OK;
  return model;
}

// ------------------------------------------------------------------ SIGetModel
function siGetModel(app: App, a: Record<string, any>) {
  const C = 'SIGetModel';
  const items = collectionArg(app, a.InputObjs);
  if (!items.length) return app.scene.root;
  let set: Model[] = [];
  for (const n of items) { const m = n instanceof Model && n === app.scene.root ? n : ownerModel(app, n); if (m && !set.includes(m)) set.push(m); }
  for (let guard = 0; guard < 1000; guard++) {
    set = set.filter(m => !set.some(o => o !== m && isDescendant(m, o)));
    if (set.length <= 1) break;
    const next: Model[] = [];
    for (const m of set) { const o = ownerModel(app, m) ?? app.scene.root; if (!next.includes(o)) next.push(o); }
    set = next;
  }
  if (set.length !== 1) throw raise(app, C, E_FAIL, 0x38);
  return set[0];
}

// ------------------------------------------------------------------ SIImportModel
const EMDL_JSON = (t: string) => { try { const d = JSON.parse(t); return d && Array.isArray(d.nodes) ? d : null; } catch { return null; } };
function siImportModel(app: App, a: Record<string, any>) {
  const C = 'SIImportModel';
  const file = text(a.FileName);
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  const parent = parentNode instanceof X3DObject ? parentNode : app.scene.root;
  const name = text(a.Name);
  const share = numArg(a.ShareOptions, 0);
  const ext = extOf(file);
  if (ext !== 'emdl') {
    if (!isFile(file)) throw raise(app, C, E_INVALIDARG, 0x17, file);
    if (ext === 'xsi') throw raise(app, C, E_INVALIDARG, 0x33, file);   // dotXSI goes through SIImportDotXSIFile (inferred)
    const conv = b11cState(app).converters.get(ext);
    if (!conv) { app.logMsg('error', `${C}: [XSIMODELTASKS 0x15] .${ext}`); throw raise(app, C, E_INVALIDARG, 0x33, file); }
    const model = siCreateModel(app, { InputObj: [], Name: conv.name || baseNoExt(file), Parent: parent });
    checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, KIND_MODEL, file));
    try { conv.handler?.({ fileName: file, target: [model], frame: app.anim.frame, userData: null, command: C }); } catch (e: any) { app.logMsg('error', `${C}: ${e?.message ?? e}`); }
    fireFileEvent(app, C, EV_END_IMPORT, KIND_MODEL, file);
    return model;
  }
  if (!isFile(file)) throw raise(app, C, E_INVALIDARG, 0x17, file);
  const body = readText(file) ?? '';
  if (restricted(app)) nya(app, C, 'the restricted-mode compatibility test of the .emdl storage (the file is taken as compatible)');
  checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, KIND_MODEL, file));
  const data = EMDL_JSON(body);
  let model: Model;
  if (data) {
    const top = app.run('ImportPresetModelData', { Data: data, Name: name || data.model || baseNoExt(file) }) as X3DObject;
    if (top instanceof Model) model = top;
    else { model = new Model(app.scene.uniqueName(name || data.model || baseNoExt(file))); app.run('Add3DObjectToScene', { InputObjs: [model], Parent: app.scene.root }); reparent(app, top, model, 'Load model'); }
    if (parent !== app.scene.root) reparent(app, model, parent, 'Parent model');
  } else {
    model = new Model(app.scene.uniqueName(name || baseNoExt(file)));
    app.run('Add3DObjectToScene', { InputObjs: [model], Parent: parent });
    nya(app, C, 'the binary .emdl model storage reader (this build reads the JSON .emdl form); an empty model was created');
  }
  (model as any).shareOptions = share;
  const st = mtState(app); st.recentModels = [file, ...st.recentModels.filter(f => f.toLowerCase() !== file.toLowerCase())];
  fireFileEvent(app, C, EV_END_IMPORT, KIND_MODEL, file);
  return model;
}

// ------------------------------------------------------------------ SIMergeScene (SPEC-PARTIAL)
const SHARE_ALL = 0xffff;
function siMergeScene(app: App, a: Record<string, any>) {
  const C = 'SIMergeScene';
  const file = text(a.FileName);
  if (!file) throw fail(E_INVALIDARG, `${C}: FileName is required`);
  const alt = restricted(app); const ext = extOf(file);
  if (!isFile(file)) throw raise(app, C, E_INVALIDARG, 0x33, file);
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  const parent = parentNode instanceof X3DObject ? parentNode : app.scene.root;
  const share = typeof a.ShareOptions === 'number' ? a.ShareOptions : SHARE_ALL;   // ":siImportShareOptionsAll:..." -> 0xffff
  if (ext !== 'scn' && !(alt && ext === 'exp')) {
    const conv = b11cState(app).converters.get(ext);
    if (!conv) throw raise(app, C, E_INVALIDARG, 0x33, file);   // inferred: no converter for the extension
    checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, 1, file));
    try { conv.handler?.({ fileName: file, target: [parent], frame: app.anim.frame, userData: null, command: C }); } catch (e: any) { app.logMsg('error', `${C}: ${e?.message ?? e}`); }
    fireFileEvent(app, C, EV_END_IMPORT, 1, file);
    return null;
  }
  const body = readText(file) ?? '';
  if (/Invalid_Scene/.test(body)) { app.logMsg('error', `${C}: [simsgcat 0x68] ${file}`); throw fail(E_FAIL, `${C}: invalid scene ${file}`); }
  const name = text(a.Name) || baseNoExt(file);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) nya(app, C, `SIValidateUniqueNameSyntax on "${name}" (used as given)`);
  const model = new Model(app.scene.uniqueName(name));
  (model as any).shareOptions = share;
  app.run('Add3DObjectToScene', { InputObjs: [model], Parent: parent });
  nya(app, C, 'the per-section merge rules (Objects, Groups, Layers, Passes, Environments, Sources, Clips, ParTypes, Shader Definitions, shots) and how ShareOptions applies; this build\'s .scn holds a command script, nothing is merged');
  mtState(app).translatorCalls.push({ command: C, what: 'scene merge', args: { file, model: model.fullName, share } });
  return model;
}

// ------------------------------------------------------------------ IGES
function siImportIges(app: App, a: Record<string, any>) {
  const C = 'SIImportIges';
  if (typeof a.FileName !== 'string') throw fail(E_INVALIDARG, `${C}: FileName must be a string`);
  const file = a.FileName;
  if (!/\.(iges|igs)$/i.test(file) || !isFile(file)) throw raise(app, C, E_INVALIDARG, 0x33, file);
  checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, KIND_IGES, file));
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  const model = siCreateModel(app, { InputObj: [], Name: 'Model', Parent: parentNode instanceof X3DObject ? parentNode : null });
  mtState(app).translatorCalls.push({ command: C, what: 'IGES translator 8daff220 read', args: { file, model: model.fullName } });
  nya(app, C, 'the IGES translator (8daff220-8e4c-11d3-a9a5-009027bc65d7) reading the file into the model; the model stays empty');
  fireFileEvent(app, C, EV_END_IMPORT, KIND_IGES, file);
  return model;
}
function siExportIges(app: App, a: Record<string, any>) {
  const C = 'SIExportIges';
  if (restricted(app)) { app.logMsg('error', `${C}: [simsgcat 0x143]`); throw fail(E_RESTRICTED, `${C}: not available in the restricted application mode`); }
  if (typeof a.FileName !== 'string') throw fail(E_INVALIDARG, `${C}: FileName must be a string`);
  const file = a.FileName;
  try {
    checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_EXPORT, KIND_IGES, file));
    const folder = hostFs.parentPath(file);
    if (!isFolder(folder)) throw raise(app, C, E_INVALIDARG, 0x51, folder);
    if (isFolder(file)) throw raise(app, C, E_INVALIDARG, 0xa0, file);
    const items = unset(a.InputObjs) ? [] : collectionArg(app, a.InputObjs);
    const what = items.length ? items.map(n => n.fullName) : ['(whole scene)'];
    mtState(app).translatorCalls.push({ command: C, what: 'IGES translator 8daff220 write', args: { file, items: what, frame: app.anim.frame } });
    nya(app, C, 'the IGES writer of translator 8daff220 (nothing is written)');
    fireFileEvent(app, C, EV_END_EXPORT, KIND_IGES, file);
  } catch (e: any) {
    if (e instanceof SiStatusError && e.status === SI_ABORT) throw e;
    throw raise(app, C, E_INVALIDARG, 0x1c, file);
  }
  return undefined;
}

// ------------------------------------------------------------------ MergeMixer
function mergeMixer(app: App, a: Record<string, any>, mergeDefault: boolean) {
  const C = 'MergeMixer';
  if (typeof a.FileName !== 'string') throw fail(E_INVALIDARG, `${C}: FileName must be a string`);
  const file = a.FileName;
  const parentNode = unset(a.Parent) ? app.selection[0] ?? null : findNode(app, a.Parent);   // inferred: the selection
  const model = parentNode instanceof Model ? parentNode : ownerModel(app, parentNode) ?? (unset(a.Parent) ? app.scene.root : null);
  if (!model) throw raise(app, C, E_INVALIDARG, 0x1c);
  // the catalogue lists the merge flag as argument 3 ("Value", default True)
  const merge = boolArg(a.Merge ?? (typeof a.Value === 'boolean' ? a.Value : undefined), mergeDefault);
  if (extOf(file) !== 'xsimixer' || !isFile(file)) throw raise(app, C, E_INVALIDARG, 0x33, file);
  checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, KIND_MIXER, file));
  let mix = model.property('mixer');
  if (!merge && mix) { const old = mix; app.record('DeleteObj Mixer', () => model.removeProperty(old), () => model.addProperty(old)); mix = undefined; }
  if (!mix) {
    const made = mixerOf(model); model.removeProperty(made);
    app.record('Create mixer', () => { if (!model.properties.includes(made)) model.addProperty(made); }, () => model.removeProperty(made));
    mix = made;
  }
  progress(app, 'Importing Mixer...');
  mtState(app).translatorCalls.push({ command: C, what: 'mixer stream Contents', args: { file, model: model.fullName, merge } });
  nya(app, C, 'the mixer stream reader (content dependencies and the Contents stream of the .xsimixer storage); nothing is read into the mixer');
  fireFileEvent(app, C, EV_END_IMPORT, KIND_MIXER, file);
  return mix;
}
const progress = (app: App, caption: string) => app.logMsg('info', caption);

// ------------------------------------------------------------------ material libraries
interface LibState { libraries: Node[]; current: Node | null }
const libState = (app: App): LibState | null => (app.scene as any).libraryState ?? null;
function currentLibrary(app: App): Node | null {
  const st = libState(app); if (st) return st.current ?? st.libraries[0] ?? null;
  return null;
}
/** The MatLib argument of the crosswalk commands: in this build a library's full name is its name (CMD-B13c findMatLib). */
const libFullName = (lib: Node) => lib.name;
function siImportMatLib(app: App, a: Record<string, any>, C: string, share: number) {
  const file = text(a.FileName);
  if (!file) throw fail(E_INVALIDARG, `${C}: empty FileName`);
  if (!isFile(file)) { warn(app, C, 0x16, file); throw fail(E_INVALIDARG, `${C}: file not found ${file}`); }
  const ext = extOf(file);
  if (ext !== 'xsi' && ext !== 'xsiml') throw raise(app, C, E_INVALIDARG, 0x11c, file);
  checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_IMPORT, KIND_MATLIB, file));
  const body = readText(file) ?? '';
  if (ext === 'xsi' && !/^xsi \d{4}txt \d{4}/.test(body)) throw raise(app, C, E_INVALIDARG, 0x11c, `${file} (dotXSI header)`);   // inferred: a bad header is refused like an invalid file
  let lib: Node | null = null;
  if (app.commands.has('CreateLibrary')) lib = app.run('CreateLibrary', { Name: '___Default___', Type: 1 }) ?? null;
  if (!lib) { nya(app, C, 'CreateLibrary is not on the bus'); return null; }
  if (app.commands.has('SetCurrentMaterialLibrary')) app.run('SetCurrentMaterialLibrary', { InputObj: lib });
  if (app.commands.has('CrosswalkImportMatLib')) app.run('CrosswalkImportMatLib', { Filename: file, MatLib: libFullName(lib) });
  else { mtState(app).translatorCalls.push({ command: C, what: 'CrosswalkImportMatLib', args: { Filename: file, MatLib: libFullName(lib) } }); nya(app, C, 'CrosswalkImportMatLib (not on the bus): the library content is not loaded and keeps its temporary name'); }
  if (share !== 0) { const l: any = lib; const was = l.referencedFile; app.record('Reference library', () => { l.referencedFile = file; }, () => { l.referencedFile = was; }); }
  fireFileEvent(app, C, EV_END_IMPORT, KIND_MATLIB, file);
  return lib;
}
function exportMaterialLibrary(app: App, a: Record<string, any>) {
  const C = 'ExportMaterialLibrary';
  if (restricted(app)) { app.logMsg('error', `${C}: [simsgcat 0x143] (message box)`); throw fail(E_RESTRICTED, `${C}: not available in the restricted application mode`); }
  const file = text(a.FileName);
  checkAbort(app, C, fireFileEvent(app, C, EV_BEGIN_EXPORT, KIND_MATLIB, file));
  const ext = extOf(file);
  if (ext !== 'xsi' && ext !== 'xsiml') throw raise(app, C, E_INVALIDARG, 0x33, file);
  if (!isFolder(hostFs.parentPath(file)) || isFolder(file)) throw raise(app, C, E_INVALIDARG, 0x11c, file);
  const given = unset(a.InputObjs) ? null : findNode(app, a.InputObjs) ?? libState(app)?.libraries.find(l => l.name === text(a.InputObjs) || libFullName(l) === text(a.InputObjs)) ?? null;
  const lib = given ?? currentLibrary(app);
  if (!lib) throw fail(E_INVALIDARG, `${C}: no material library`);
  const args = { Filename: file, MatLib: libFullName(lib), Binary: false, ExportUsedImageClipsOnly: boolArg(a.ExportUsedImageClipsOnly, true) };
  if (app.commands.has('CrosswalkExportMatLib')) app.run('CrosswalkExportMatLib', args);
  else { mtState(app).translatorCalls.push({ command: C, what: 'CrosswalkExportMatLib', args }); nya(app, C, 'CrosswalkExportMatLib (not on the bus): nothing is written'); }
  fireFileEvent(app, C, EV_END_EXPORT, KIND_MATLIB, file);
  return undefined;
}

// ------------------------------------------------------------------ model clip light lists
function clipArg(app: App, v: any): Property | null {
  const n = unset(v) ? app.selection[0] ?? null : findNode(app, v);
  return n instanceof Property && n.type === 'modelclip' ? n : null;
}
function getLightList(app: App, a: Record<string, any>) {
  const C = 'GetLightListOnModelClip';
  const clip = clipArg(app, a.ModelClip);
  if (!clip) throw fail(E_POINTER, `${C}: ModelClip is not a model clip`);
  return String((clip as any).lightList ?? '');
}
function setLightList(app: App, a: Record<string, any>) {
  const C = 'SetLightListOnModelClip';
  const clip: any = clipArg(app, a.ModelClip);
  if (!clip) throw fail(E_POINTER, `${C}: ModelClip is not a model clip`);
  const old = clip.lightList; const v = text(a.LightList);
  app.record(C, () => { clip.lightList = v; }, () => { clip.lightList = old; });
  return undefined;
}

// ------------------------------------------------------------------ referenced models
interface RefInfo { file: string; resolution: number; resolutions: string[]; resNames?: string[]; data?: any; locked?: boolean; applying?: number }
const refOf = (m: Node | null): RefInfo | null => (m instanceof Model && (m as any).ref ? (m as any).ref as RefInfo : null);
const resName = (r: RefInfo, i: number) => r.resNames?.[i] ?? (r.resolutions[i] ? baseNoExt(r.resolutions[i]) : '');
/** Loads a resolution file into the model when this build can read it synchronously (JSON .emdl on the host file
 *  system or the model2 local store); otherwise logs that the reader is missing. */
function loadResolution(app: App, C: string, m: Model, file: string | null) {
  if (file === null) { if (app.commands.has('ReloadRefModelData')) app.run('ReloadRefModelData', { Model: m.fullName, Data: null }); return; }
  let data: any = null;
  const t = readText(file); if (t) data = EMDL_JSON(t);
  if (!data) { try { const ls = localStorage.getItem('si.refmodel.' + file); if (ls) data = JSON.parse(ls); } catch { /* no storage */ } }
  if (data && app.commands.has('ReloadRefModelData')) { app.run('ReloadRefModelData', { Model: m.fullName, Data: data }); return; }
  nya(app, C, `loading "${file}" into ${m.name} (no reader for that file in this build)`);
}
function siSetResolution(app: App, a: Record<string, any>) {
  const C = 'SISetResolutionOfRefModels';
  if (licenceMissing(app, C)) return undefined;
  if (a.Target === null && !app.selection.length) throw fail(E_POINTER, `${C}: no Target`);
  const res = Math.trunc(numArg(a.Resolution, 0));
  const usable = mtState(app).hooks.resolutionUsable ?? ((f: string) => isFile(f) || (() => { try { return !!localStorage.getItem('si.refmodel.' + f); } catch { return false; } })());
  const changed: [Model, RefInfo, number][] = [];
  for (const n of collectionArg(app, a.Target)) {
    const r = refOf(n); if (!r) continue;
    const m = n as Model;
    if (res !== 0) {
      const f = r.resolutions[res - 1];
      if (res < 0 || f === undefined || !usable(f)) continue;   // missing / unusable: skipped, its undo record dropped
    }
    const old = r.resolution;
    app.record(C, () => { r.resolution = res; }, () => { r.resolution = old; });
    changed.push([m, r, res]);
  }
  for (const [m, r, res] of changed) {
    (m as any).overridesActive = false;   // overrides deactivated during the reload
    loadResolution(app, C, m, res === 0 ? null : r.resolutions[res - 1]);
  }
  mtState(app).status[C] = S_OK;
  return undefined;
}
function removeRefModelResolution(app: App, a: Record<string, any>) {
  const C = 'RemoveRefModelResolution';
  const name = text(a.ResolutionName);
  if (!name) throw fail(E_INVALIDARG, `${C}: ResolutionName is required when removing`);
  if (licenceMissing(app, C)) return undefined;
  const n = unset(a.Model) ? app.selection[0] ?? null : findNode(app, a.Model);
  const r = refOf(n); if (!r) { mtState(app).status[C] = S_FALSE; return undefined; }
  void boolArg(a.Confirm, true);   // passed to the worker; no use seen (inferred: UI prompt only)
  const i = r.resolutions.findIndex((_, k) => resName(r, k) === name);
  // resolution index i + 1; nothing when not found, offloaded (0) or active
  if (i < 0 || i + 1 === r.resolution) { mtState(app).status[C] = S_FALSE; return undefined; }
  const files = r.resolutions.slice(), names = r.resNames?.slice(), active = r.resolution;
  app.record(C, () => { r.resolutions.splice(i, 1); r.resNames?.splice(i, 1); if (r.resolution > i + 1) r.resolution--; },
    () => { r.resolutions.splice(0, r.resolutions.length, ...files); if (names && r.resNames) r.resNames.splice(0, r.resNames.length, ...names); r.resolution = active; });
  mtState(app).status[C] = S_OK;
  return undefined;
}
function siCreateRefModel(app: App, a: Record<string, any>) {
  const C = 'SICreateRefModel';
  if (licenceMissing(app, C)) return undefined;
  let file = text(a.FileName);
  if (isUrl(file)) { nya(app, C, `downloading ${file} (no download in this build; the URL is kept as the file name)`); }
  else if (file) {
    try { file = hostFs.normalize(file); } catch { /* kept as given */ }
    if (!isFile(file)) warn(app, C, 0x16, file);
  }
  const name = text(a.ModelName) || (file ? baseNoExt(file) : '') || 'RefModel';
  const parentNode = unset(a.Parent) ? null : findNode(app, a.Parent);
  const model = siCreateModel(app, { InputObj: [], Name: name, Parent: parentNode instanceof X3DObject ? parentNode : null });
  if (boolArg(a.CreateFile, false) && file && !isUrl(file) && !isFile(file)) {
    try {
      hostFs.ensureFolder(hostFs.parentPath(file));
      const data = app.commands.has('ExportModel') ? app.run('ExportModel', { InputObj: model.fullName, FileName: name, Data: true }) : null;
      hostFs.writeFile(file, JSON.stringify(data ?? { format: 'softimage-direct-emdl', model: model.name, nodes: [] }));
    } catch (e: any) { app.logMsg('error', `${C}: ${e?.description ?? e?.message ?? e}`); }
  }
  void text(a.ExternalCnxMappingTemplate);   // passed to the worker; no use seen
  (model as any).shareOptions = numArg(a.ShareOptions, 0xffff);
  const r: RefInfo = { file, resolution: 0, resolutions: [], resNames: [] };
  app.record('Reference model', () => { (model as any).ref = r; }, () => { delete (model as any).ref; });
  r.resolutions.push(file); r.resNames!.push(text(a.ResolutionName));
  if (boolArg(a.Activate, true) && file && isFile(file)) {
    app.record(C, () => { r.resolution = 1; }, () => { r.resolution = 0; });
    loadResolution(app, C, model, file);
  }
  return model;
}

// ------------------------------------------------------------------ deltas
/** A delta's change list (model2.ts keeps parameter changes as relative path -> value). */
const changesOf = (d: any): Map<string, any> => (d.changes ??= new Map<string, any>());
function resolvePath(m: X3DObject, path: string): any {
  const parts = path.split('.'); let node: any = m;
  for (const part of parts.slice(0, -1)) {
    node = node?.children?.find((c: any) => c.name === part) ?? node?.properties?.find((c: any) => c.name === part)
      ?? (node?.primitive?.name === part ? node.primitive : null) ?? node?.primitive?.operators?.find((c: any) => c.name === part)
      ?? (/^(kine|Kinematics)$/.test(part) ? node.kinematics : /^(local|Local|Local Transform)$/.test(part) ? (node.local ?? node.kinematics?.local) : /^(global|Global)$/.test(part) ? (node.global ?? node.kinematics?.global) : null);
    if (!node) return undefined;
  }
  return node?.get?.(parts[parts.length - 1]);
}
/** Applies every item of a delta to its model (all items, all types): parameter changes and stored transforms. */
function applyDeltaTo(app: App, m: Model, d: any): number {
  let n = 0;
  for (const [path, v] of changesOf(d)) { const p = resolvePath(m, path); if (p) { app.setParam(p, v); n++; } }
  for (const e of (d.xf ?? []) as any[]) {
    const o = [...m.descendants()].find(x => x.name === e.name); if (!o || !e.xf) continue;
    const L = o.kinematics.local; const { pos, rot, scl } = e.xf;
    ['posx', 'posy', 'posz'].forEach((k, i) => app.setParam(L.get(k)!, pos[i]));
    ['rotx', 'roty', 'rotz'].forEach((k, i) => app.setParam(L.get(k)!, rot[i]));
    ['sclx', 'scly', 'sclz'].forEach((k, i) => app.setParam(L.get(k)!, scl[i])); n++;
  }
  return n;
}
function applyDelta(app: App, a: Record<string, any>) {
  const C = 'ApplyDelta';
  if (licenceMissing(app, C)) return undefined;
  let n = 0;
  for (const d of collectionArg(app, a.Deltas)) {
    if (!(d instanceof Property) || d.type !== 'delta') continue;
    const m = d.parent; if (!(m instanceof Model)) continue;
    const r: any = refOf(m) ?? (m as any);
    r.applying = (r.applying ?? 0) | 2;
    try { n += applyDeltaTo(app, m, d); } finally { r.applying &= ~2; }
  }
  mtState(app).status[C] = S_OK;
  return n;
}
function makeDelta(app: App, m: Model, name: string): Property {
  const d = new Property(app.scene.uniqueName(name), 'delta', [str('target', m.name, 'Model', { readOnly: true }), int('changes', 0, 'Changes', { readOnly: true }),
    bool('active', true, 'Active'), str('file', '', 'File'), int('mode', 0, 'Mode')]);
  (d as any).changes = new Map<string, any>();
  app.record('Add Delta', () => m.addProperty(d), () => m.removeProperty(d));
  return d;
}
function importReferencedDelta(app: App, a: Record<string, any>, referenceDefault: boolean) {
  const C = 'ImportReferencedDelta';
  if (restricted(app)) throw fail(E_RESTRICTED, `${C}: not available in the restricted application mode`);
  const file = text(a.FileName);
  if (!file || unset(a.Model)) throw fail(E_INVALIDARG, `${C}: FileName and Model are required`);
  if (licenceMissing(app, C)) return undefined;
  const mn = findNode(app, a.Model);
  if (!(mn instanceof Model)) return undefined;   // null model: returns
  const noFile = file === 'non$existent.delta';
  const exists = !noFile && isFile(file);
  if (!noFile && !exists) warn(app, C, 0x16, file);
  const r = refOf(mn);
  // only a locked referenced model with a ref-model head; this build has no lock state: every referenced model counts (inferred)
  if (!r) { mtState(app).status[C] = S_FALSE; return undefined; }
  const old = mn.properties.find(p => p.type === 'delta') ?? null;
  if (old && boolArg(a.Interactive, true) && (app as any).Interactive !== false) {
    const ans = mtState(app).hooks.msgBox?.(`[XSIMODELTASKS 0x10] ${old.name}`, 3, C) ?? 7;   // no hook: No (batch behaviour)
    if (ans === 2) { mtState(app).status[C] = S_FALSE; return undefined; }
    if (ans === 6) { const was = old.name, nn = app.scene.uniqueName(old.name + '_BACKUP'); app.record('Rename delta', () => { old.name = nn; }, () => { old.name = was; }); }
    else nya(app, C, 'what "No" does with the existing delta (inferred: a new one is created, the old one is kept)');
  }
  const d = makeDelta(app, mn, 'Delta');
  app.setParam(d.get('file')!, file); app.setParam(d.get('mode')!, 3); app.setParam(d.get('target')!, mn.name);
  if (exists) {
    const st = (app as any).referencing ??= {}; st.importingdelta = true;
    try {
      const t = readText(file) ?? ''; let j: any = null; try { j = JSON.parse(t); } catch { j = null; }
      if (j) { for (const [k, v] of Object.entries(j.params ?? {})) changesOf(d).set(k, v); (d as any).xf = j.delta ?? []; d.set('changes', changesOf(d).size); }
      else nya(app, C, 'the binary delta file reader (this build reads the JSON delta form)');
    } finally { st.importingdelta = false; }
  }
  if (!boolArg(a.Reference, referenceDefault)) app.setParam(d.get('mode')!, 0);   // copied, not referenced
  applyDeltaTo(app, mn, d);
  mtState(app).status[C] = S_OK;
  return d;
}

// ------------------------------------------------------------------ registration
type ArgList = [string, any][];
const ARGS = (l: ArgList) => l.map(([name, d]) => ({ name, default: d }));
export function registerModelTasksB15aCommands(app: App) {
  mtState(app);
  (app as any).modelTasksB15aApi = { siCreateModel: (a: any) => siCreateModel(app, a), applyDeltaTo: (m: Model, d: any) => applyDeltaTo(app, m, d) };
  // Add3DObjectToScene: handler outside modeltasks.dll (correction 17); inferred from its sub-task use   // inferred
  app.register({ name: 'Add3DObjectToScene', label: 'Add3DObjectToScene', category: CAT, description: '', args: ARGS([['InputObjs', null], ['Parent', null]]), execute: add3DObjectToScene });
  app.register({ name: 'SICreateModel', label: 'SICreateModel', category: CAT, description: '', args: ARGS([['InputObj', null], ['Name', 'Model'], ['Parent', null], ['Value', null]]), execute: (app, a) => siCreateModel(app, a) });
  app.register({ name: 'SIGetModel', label: 'SIGetModel', category: CAT, description: '', undoable: false, args: ARGS([['InputObjs', null]]), execute: siGetModel });
  app.register({ name: 'SIImportModel', label: 'SIImportModel', category: CAT, description: '', args: ARGS([['FileName', null], ['Parent', null], ['Value', null], ['Name', ''], ['ShareOptions', 0]]), execute: siImportModel });
  app.register({ name: 'SIMergeScene', label: 'SIMergeScene', category: CAT, description: '', args: ARGS([['FileName', null], ['Name', ''], ['Parent', null], ['ShareOptions', ':siImportShareOptionsAll:siImportShareOptions'], ['CreatedObj', null]]), execute: siMergeScene });
  app.register({ name: 'SIImportIges', label: 'SIImportIges', category: CAT, description: '', args: ARGS([['FileName', null], ['Parent', null], ['Value', null]]), execute: siImportIges });
  app.register({ name: 'SIExportIges', label: 'SIExportIges', category: CAT, description: '', undoable: false, args: ARGS([['InputObjs', null], ['FileName', null]]), execute: siExportIges });
  app.register({ name: 'MergeMixer', label: 'MergeMixer', category: CAT, description: '', args: ARGS([['FileName', null], ['Parent', null], ['Value', true]]), execute: (app, a) => mergeMixer(app, a, true) });
  app.register({ name: 'SIImportMatLib', label: 'SIImportMatLib', category: CAT, description: '', args: ARGS([['FileName', null], ['ShareOptions', 0], ['Value', null]]),
    execute: (app, a) => siImportMatLib(app, a, 'SIImportMatLib', Math.trunc(numArg(a.ShareOptions, 0))) });
  app.register({ name: 'SIImportReferencedMatLib', label: 'SIImportReferencedMatLib', category: CAT, description: '', args: ARGS([['FileName', null], ['Value', 1]]),
    execute: (app, a) => siImportMatLib(app, a, 'SIImportReferencedMatLib', 1) });
  app.register({ name: 'ExportMaterialLibrary', label: 'ExportMaterialLibrary', category: CAT, description: '', undoable: false, args: ARGS([['FileName', null], ['InputObjs', null], ['ExportUsedImageClipsOnly', true]]), execute: exportMaterialLibrary });
  app.register({ name: 'GetLightListOnModelClip', label: 'GetLightListOnModelClip', category: CAT, description: '', undoable: false, args: ARGS([['ModelClip', null]]), execute: getLightList });
  app.register({ name: 'SetLightListOnModelClip', label: 'SetLightListOnModelClip', category: CAT, description: '', args: ARGS([['ModelClip', null], ['LightList', '']]), execute: setLightList });
  app.register({ name: 'SISetResolutionOfRefModels', label: 'SISetResolutionOfRefModels', category: CAT, description: '', args: ARGS([['Target', null], ['Resolution', 0]]), execute: siSetResolution });
  app.register({ name: 'RemoveRefModelResolution', label: 'RemoveRefModelResolution', category: CAT, description: '', args: ARGS([['Model', null], ['ResolutionName', ''], ['Confirm', true]]), execute: removeRefModelResolution });
  app.register({ name: 'SICreateRefModel', label: 'SICreateRefModel', category: CAT, description: '', args: ARGS([['FileName', null], ['ModelName', ''], ['ResolutionName', ''], ['Parent', null], ['Activate', true], ['CreateFile', false], ['ExternalCnxMappingTemplate', ''], ['ShareOptions', 65535]]), execute: siCreateRefModel });
  app.register({ name: 'ApplyDelta', label: 'ApplyDelta', category: CAT, description: '', args: ARGS([['Deltas', null]]), execute: applyDelta });
  app.register({ name: 'ImportReferencedDelta', label: 'ImportReferencedDelta', category: CAT, description: '', args: ARGS([['FileName', null], ['Model', null], ['Reference', true], ['Interactive', true]]), execute: (app, a) => importReferencedDelta(app, a, true) });
}
