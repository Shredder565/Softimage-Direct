// Ledger row CMD-B13d (CDKMotionTransform.64.dll, the "MOTOR Plug-in"): shared state, name constants and the
// model-cleanup helpers of the MOTOR retargeting commands wired in motorB13dTags.ts and motorB13dFiles.ts.
// Brief: docs/ghidra/cmd-b13d-motiontransform-binary.md (sections 2 "Shared facts", 2.6 "File formats", 3 "Contracts")
// and docs/re/WIRE_CORRECTIONS_B13.md. Original code written from that prose contract only; no XSIBATCH golden.
//
// How the contract is mapped onto this build (stand-ins, kept small and visible on `app.motorB13d`):
//  * MOTOR custom properties (TagPPG, RetargetAdjustPPG, CDKGlue, CDKStructure, CDKStructTag, PlotRetargetPPG,
//    RotationOffsetPPG, CDKTag, CDKExtractionTag, c3ddef) are Property nodes of type `customparamset`, found by exact
//    name among the object's properties (note 2.3). User data blobs (CDKMap, CDKRefFrames, CDKRetargetOp, TagData,
//    c3dudb) are Property nodes of type `userdatablob` with a `blob` payload.
//  * This build has no custom operators on kinematic states: the MOTOR operators are kept per kinematic state
//    (Kinematics.Local / Kinematics.Global node) in `kineOps`.
//  * The CDKRetargetOp blob of the binary holds a raw pointer to the in-memory retarget object (note 4: stale after a
//    reload). Here the blob payload is the retarget data itself: { start, length, mapNames, chains }.
//  * Deletion "runs DeleteObj with the object's full name" (note 2.3): an undoable removal; the full names are kept
//    in `deleted` in order. Command-log suppression (note 2.5) toggles the scripting cmdlog preference (`app.cmdLog`).
//  * Commands of the plug-in never throw: argument errors are logged (LogMessage, default severity) and the command
//    returns false or nothing, as the contract says.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Operator, Property } from '../core/scene';
import type { ParamDef } from '../core/params';
import { Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { findNode } from './viewEditPropertyHelpers';

export const NOTE = 'docs/ghidra/cmd-b13d-motiontransform-binary.md';
export const ROW = 'CMD-B13d';

// ------------------------------------------------------------------ name constants (note 2.3)
export const RETARGET_ADJUST_PPG = 'RetargetAdjustPPG', CDK_GLUE = 'CDKGlue', CDK_MAP = 'CDKMap', CDK_STRUCTURE = 'CDKStructure',
  CDK_STRUCT_TAG = 'CDKStructTag', PLOT_RETARGET_PPG = 'PlotRetargetPPG', CDK_REF_FRAMES = 'CDKRefFrames', CDK_RETARGET_OP = 'CDKRetargetOp',
  ROTATION_OFFSET_PPG = 'RotationOffsetPPG', CDK_TAG = 'CDKTag', CDK_EXTRACTION_TAG = 'CDKExtractionTag', TAG_DATA = 'TagData',
  TEMPLATE_FILE = 'TemplateFile', EMPTY_FIELD = '<EmptyFieldxsi>', TAG_PPG = 'TagPPG', BVH_TOKEN = 'BVH', C3D_POSE_VERSION = 'Version3',
  C3D_DEF = 'c3ddef', C3D_UDB = 'c3dudb', C3D_DATA = 'C3DData', C3D_RIG = 'C3DRig';
/** Operator names the removal routine deletes (note 2.4). `RetargetOperator` is deleted on the model although the plug-in
 *  registers the operator as `RetargetOp` (WIRE_CORRECTIONS_B13: reproduced as read). */
export const MODEL_OP = 'RetargetOperator';
export const GLOBAL_OPS = ['RetargetGlobalOp', 'RetargetUpVOp'], LOCAL_OPS = ['RetargetSpineOp', 'RetargetDecompOp'];
/** Operators the plug-in registers (note 2.1). */
export const REGISTERED_OPS = ['RetargetOp', 'RetargetUpVOp', 'RetargetGlobalOp', 'RetargetDecompOp', 'RetargetSpineOp', 'RetargetSymmetrySpecialOp', 'RetargetSymmetryOp'];
/** TagPPG holds its tags from parameter index 4 (note 2.3). */
export const TAG_FIRST = 4;
export const TAGT_VERSION = 8, TAGT_MIN_VERSION = 7;
export const ADJUST_HEADER = 'Ajustment Preset file Saved out from XSI using MOTOR';   // (sic)
export const MOTOR_HEADER = 'MOTOR file Saved out from Softimage using MOTOR';
/** Public SDK siCapabilities / siVariantType values used for the preset attributes (Softimage SDK reference). */
export const SI_READONLY = 1, SI_PERSISTABLE = 4, SI_ANIMATABLE = 8, SI_KEYABLE = 2048;
export const VT = { int: 3, double: 5, string: 8, bool: 11 } as const;

export interface RetargetData { start: number; length: number; mapNames: string[]; chains: string[] }
export interface StructureData { name: string; file: string }
export interface MotorB13dState {
  /** Custom operators on kinematic states (stand-in, see header). */
  kineOps: WeakMap<Node, Operator[]>;
  /** Structure data object behind each model's CDKStructure property (+0x18 name, +0x28 file). */
  structures: WeakMap<X3DObject, StructureData>;
  /** Full names passed to DeleteObj, in order (newest last). */
  deleted: string[];
  /** Progress-bar captions shown (newest last). */
  progress: string[];
  /** Last parsed inputs (for inspection). */
  lastMotor: any; lastBvh: any; lastTagt: any;
  /** Fitted entries the SaveC3DPoseMap writer gets (the fitting stage is not attested; a hook may supply them). */
  hooks: { c3dFit?: (c3dModel: Model, rig: Model) => C3DPoseRecord[] | null | undefined };
  api: Record<string, any>;
}
export interface C3DPoseRecord { idx: [number, number, number]; xf1: number[]; vec: number[]; xf2: number[] }

export function stateOf(app: App): MotorB13dState {
  const a: any = app;
  if (a.motorB13d) return a.motorB13d;
  const st: MotorB13dState = { kineOps: new WeakMap(), structures: new WeakMap(), deleted: [], progress: [], lastMotor: null, lastBvh: null, lastTagt: null, hooks: {}, api: {} };
  a.motorB13d = st;
  st.api = {
    addCustomProp: (o: X3DObject, name: string, defs: ParamDef[] = []) => addCustomProp(app, o, name, defs),
    addBlob: (o: X3DObject, name: string, blob: any) => addBlob(app, o, name, blob),
    addKineOp: (o: X3DObject, which: 'local' | 'global', name: string) => addKineOp(app, o, which, name),
    kineOps: (o: X3DObject, which: 'local' | 'global') => [...(st.kineOps.get(o.kinematics[which]) ?? [])].map(x => x.name),
    prop: (o: X3DObject, name: string) => findProp(o, name),
    ensureTagPPG: (o: Model) => ensureTagPPG(app, o),
    setStructure: (o: X3DObject, s: StructureData) => setStructure(app, o, s),
    attachRetarget: (o: Model, d: RetargetData) => addBlob(app, o, CDK_RETARGET_OP, d),
    fs: hostFs,
  };
  return st;
}

// ------------------------------------------------------------------ messages, logging, progress
/** A fixed message of the plug-in (LogMessage, default severity). */
export function msg(app: App, text: string) { app.logMsg('info', text); }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function progress(app: App, caption: string) { stateOf(app).progress.push(caption); }
/** Command-log suppression (note 2.5): returns the old state; callers restore it with `setCmdLog`. */
export function setCmdLog(app: App, on: boolean): boolean { const a: any = app; const old = a.cmdLog !== false; a.cmdLog = on; return old; }
export function withCmdLogOff<T>(app: App, f: () => T): T { const old = setCmdLog(app, false); try { return f(); } finally { setCmdLog(app, old); } }

// ------------------------------------------------------------------ arguments
export const missing = (v: any) => v === undefined || v === null;
export type ModelArg = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'ok'; model: Model };
/** A Model argument: empty CValue -> missing; anything that does not cast to a valid Model -> invalid (note 2.2). */
export function modelArg(app: App, v: any): ModelArg {
  if (missing(v)) return { kind: 'missing' };
  const x = Array.isArray(v) ? v[0] : v;
  const n = x instanceof Node ? x : typeof x === 'string' && x ? findNode(app, x.trim()) : undefined;
  return n instanceof Model ? { kind: 'ok', model: n } : { kind: 'invalid' };
}
export const textArg = (v: any): string => missing(v) ? '' : String(Array.isArray(v) ? v[0] ?? '' : v);

// ------------------------------------------------------------------ properties and blobs
export function findProp(o: X3DObject, name: string): Property | null { return o.properties.find(p => p.name === name) ?? null; }
export function addCustomProp(app: App, o: X3DObject, name: string, defs: ParamDef[] = []): Property {
  const p = new Property(name, 'customparamset', defs);
  app.record('AddProp', () => o.addProperty(p), () => o.removeProperty(p));
  return p;
}
export function addBlob(app: App, o: X3DObject, name: string, blob: any): Property {
  const p = new Property(name, 'userdatablob', []); (p as any).blob = blob;
  app.record('AddProp', () => o.addProperty(p), () => o.removeProperty(p));
  return p;
}
export const blobOf = (o: X3DObject, name: string): any => { const p = findProp(o, name); return p && p.type === 'userdatablob' ? (p as any).blob ?? null : null; };
/** The retarget data of a model (the `0x18004fbe0` lookup, stand-in: the CDKRetargetOp blob payload). */
export function retargetData(o: X3DObject): RetargetData | null {
  const b = blobOf(o, CDK_RETARGET_OP);
  return b && typeof b === 'object' && Number.isFinite(Number(b.start)) ? b as RetargetData : null;
}
/** Mapped node names: the even entries of the map name list (note 3, SaveMOTORAdjustmentPresetFile). */
export const mappedNodes = (d: RetargetData | null): string[] => (d?.mapNames ?? []).filter((_, i) => i % 2 === 0);

/** DeleteObj on a property / blob (an undoable removal; the full name is recorded). */
export function deleteProp(app: App, p: Property) {
  const owner = p.parent as X3DObject | null; if (!owner || !(owner as any).properties) return;
  const i = owner.properties.indexOf(p); if (i < 0) return;
  stateOf(app).deleted.push(p.fullName);
  app.record('DeleteObj', () => owner.removeProperty(p), () => { owner.properties.splice(Math.min(i, owner.properties.length), 0, p); p.parent = owner; });
}
export function deleteNamed(app: App, o: X3DObject, name: string): boolean { const p = findProp(o, name); if (!p) return false; deleteProp(app, p); return true; }

// ------------------------------------------------------------------ custom operators on kinematic states
export function addKineOp(app: App, o: X3DObject, which: 'local' | 'global', name: string): Operator {
  const st = stateOf(app); const state = o.kinematics[which];
  const op = new Operator(name, 'customoperator', []); op.parent = state;
  app.record('ApplyOp', () => { const l = st.kineOps.get(state) ?? []; l.push(op); st.kineOps.set(state, l); },
    () => { const l = st.kineOps.get(state) ?? []; const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); });
  return op;
}
function deleteKineOp(app: App, o: X3DObject, which: 'local' | 'global', name: string) {
  const st = stateOf(app); const state = o.kinematics[which];
  const l = st.kineOps.get(state); const op = l?.find(x => x.name === name); if (!l || !op) return;
  const i = l.indexOf(op);
  st.deleted.push(`${o.fullName}.kine.${which}.${name}`);
  app.record('DeleteObj', () => { const k = l.indexOf(op); if (k >= 0) l.splice(k, 1); }, () => l.splice(Math.min(i, l.length), 0, op));
}

// ------------------------------------------------------------------ parameters
export function removeParam(ps: Property, p: Parameter) {
  const i = ps.params.indexOf(p); if (i < 0) return;
  ps.params.splice(i, 1); (ps as any).byName?.delete(p.name);
}
export function insertParam(ps: Property, p: Parameter, i: number) {
  ps.params.splice(Math.min(i, ps.params.length), 0, p); (ps as any).byName?.set(p.name, p);
}
export function setParamU(app: App, p: Parameter, v: any) { const old = p.value; if (old === v) return; app.record('SetValue', () => { p.value = v; }, () => { p.value = old; }); }
export function addParamU(app: App, ps: Property, def: ParamDef): Parameter {
  const p = new Parameter(ps, def); const i = ps.params.length;
  app.record('AddParameter', () => insertParam(ps, p, i), () => removeParam(ps, p));
  return p;
}

// ------------------------------------------------------------------ TagPPG
/** TagPPG on the model; added when missing. The four fixed parameters before the tags: `TemplateFile` and `dirty` are
 *  named by the note; the other two names are not legible (stand-in names `_unread2`, `_unread3`). */
export function ensureTagPPG(app: App, m: X3DObject): Property {
  return findProp(m, TAG_PPG) ?? addCustomProp(app, m, TAG_PPG, [
    { name: TEMPLATE_FILE, type: 'string', value: '', label: 'Template File' },
    { name: 'dirty', type: 'bool', value: false, label: 'dirty' },
    { name: '_unread2', type: 'string', value: '' }, { name: '_unread3', type: 'string', value: '' },
  ]);
}
export const tagParams = (ppg: Property): Parameter[] => ppg.params.slice(TAG_FIRST);
export function setTemplateFile(app: App, ppg: Property, path: string) {
  const p = ppg.get(TEMPLATE_FILE) ?? addParamU(app, ppg, { name: TEMPLATE_FILE, type: 'string', value: '' });
  setParamU(app, p, path);
}
export function setDirty(app: App, ppg: Property) { const p = ppg.get('dirty') ?? addParamU(app, ppg, { name: 'dirty', type: 'bool', value: false }); setParamU(app, p, true); }

// ------------------------------------------------------------------ structure
export function setStructure(app: App, o: X3DObject, s: StructureData) {
  const st = stateOf(app); const old = st.structures.get(o);
  if (!findProp(o, CDK_STRUCTURE)) addCustomProp(app, o, CDK_STRUCTURE);
  app.record('SetStructure', () => st.structures.set(o, s), () => { if (old) st.structures.set(o, old); else st.structures.delete(o); });
}
export const structureOf = (app: App, o: X3DObject): StructureData | null => findProp(o, CDK_STRUCTURE) ? stateOf(app).structures.get(o) ?? null : null;

// ------------------------------------------------------------------ cleanup routines (note 2.4, 2.5)
/** Operator removal routine `0x180054160`. Returns false when the model has no RetargetAdjustPPG. */
export function removeMotorOperators(app: App, m: Model): boolean {
  const adj = findProp(m, RETARGET_ADJUST_PPG); if (!adj) return false;
  deleteProp(app, adj);
  deleteNamed(app, m, CDK_RETARGET_OP); deleteNamed(app, m, CDK_REF_FRAMES);
  deleteKineOp(app, m, 'local', MODEL_OP);
  for (const o of m.descendants()) {   // FindChildren(si3DObjectFamily), recursive (inferred)
    for (const n of GLOBAL_OPS) deleteKineOp(app, o, 'global', n);
    for (const n of LOCAL_OPS) deleteKineOp(app, o, 'local', n);
    deleteNamed(app, o, ROTATION_OFFSET_PPG);
  }
  return true;
}
/** `0x18005e450`: CDKTag / CDKExtractionTag on every descendant. */
export function removeNodeTags(app: App, m: Model) { for (const o of m.descendants()) { deleteNamed(app, o, CDK_TAG); deleteNamed(app, o, CDK_EXTRACTION_TAG); } }
/** `0x180066050`: TagData blob, TagPPG parameters above index 3; then one parameter (name not legible) set to true. */
export function removeTagData(app: App, m: Model, command: string) {
  deleteNamed(app, m, TAG_DATA);
  const ppg = findProp(m, TAG_PPG); if (!ppg) return;
  for (let i = ppg.params.length - 1; i >= TAG_FIRST; i--) {
    const p = ppg.params[i];
    app.record('RemoveParameter', () => removeParam(ppg, p), () => insertParam(ppg, p, i));
  }
  logNya(app, command, 'the TagPPG parameter set to true after the tags are stripped (name not legible)');
}
export function deleteStructure(app: App, m: Model) { deleteNamed(app, m, CDK_STRUCTURE); deleteNamed(app, m, CDK_STRUCT_TAG); }

// ------------------------------------------------------------------ files (the project's host file system)
export function readText(path: string): string | null { try { return hostFs.isFile(path) ? hostFs.readFile(path) : null; } catch { return null; } }
/** `_wfopen(.., "wt")`: fails when the folder does not exist. */
export function writeText(path: string, text: string): boolean { try { hostFs.writeFile(path, text); return true; } catch { return false; } }
export const isXml = (text: string) => text.slice(0, 5) === '<?xml';
export { X3DObject, Model, Property, Node };
