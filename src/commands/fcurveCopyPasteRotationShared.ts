// Ledger row CMD-B8c, shared part: state, argument reading and undo helpers of the fcurve.dll task commands
// wired in fcurveCopyPasteRotationTasks.ts (key clipboard, key selection, sequencing),
// fcurveCopyPasteRotationAnim.ts (animation clipboard) and fcurveCopyPasteRotationRot.ts (rotation conversion).
// Brief: docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md. Original code written from that prose only.
//
// State owned by this row (kept here, not in src/core, so the sibling rows of the batch can be merged freely):
//   app.fcurveCopyPasteRotation.keyClipboard   the key clipboard of CopyKeys / CutKeys / PasteKeys
//   app.fcurveCopyPasteRotation.animClipboard  the animation clipboard of CopyAnimation / PasteAnimation
//   app.fcurveCopyPasteRotation.quatSources    the quaternion fcurve objects made by ConvertEulerToQuat
// The key selection itself is the existing `app.anim.selectedKeys` set (`<parameter.fullName>@<time>`).
import { App } from '../core/commands';
import { FCurve, type Key } from '../core/animation';
import { Parameter, ParamSet } from '../core/params';
import { Node, X3DObject, Kinematics, Primitive } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { findParam } from './index';
import { keyMappingTargets } from './anim';

export const NOTE = 'docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md';
export const S_OK = 0;
export const S_NOTHING = 1;
export const E_POINTER = 0x80004003;
export const E_FAIL = 0x80004005;
export const E_ACCESSDENIED = 0x80070005;
export const E_INVALIDARG = 0x80070057;
export const E_UNEXPECTED = 0x8000ffff;

export type Args = Record<string, any>;
export type Quat = [number, number, number, number];   // x, y, z, w

/** One record of the key clipboard: (reference to the source parameter, parameter name, keys, start, end, key type). */
export interface KeyRecord { param: Parameter; path: string; name: string; keys: Key[]; start: number; end: number; keyType: number }
/** A duplicated animation source held by the animation clipboard. */
export type AnimSource =
  | { kind: 'fcurve'; keys: Key[]; extrap: number; interp: number }
  | { kind: 'expression'; text: string };
/** One record of the animation clipboard: (relative path, leaf name, duplicated source, layer index). */
export interface AnimRecord { path: string; leaf: string; source: AnimSource; layer: number }
/** The quaternion fcurve object: one key per time, outputs 0 / 1 / 2 drive the Euler X / Y / Z parameters. */
export interface QuatCurve { keys: { time: number; q: Quat }[]; constant: Quat | null; order: number; params: [Parameter, Parameter, Parameter] }
export interface QuatLink { curve: QuatCurve; output: 0 | 1 | 2 }

export interface FcurveCopyPasteRotationState {
  lastStatus: { command: string; status: number } | null;
  keyClipboard: KeyRecord[];
  animClipboard: AnimRecord[];
  quatSources: Map<Parameter, QuatLink>;
  /** Output arguments of the last call, by command name (PasteKeys: Offset). */
  out: Record<string, Record<string, any>>;
  /** Number of GK_KEYSELECTION_CHANGED broadcasts. */
  keySelectionChanged: number;
}
export const stateOf = (app: App): FcurveCopyPasteRotationState =>
  ((app as any).fcurveCopyPasteRotation ??= { lastStatus: null, keyClipboard: [], animClipboard: [], quatSources: new Map(), out: {}, keySelectionChanged: 0 });

// ------------------------------------------------------------------ small helpers
export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
export const unset = (v: any) => v === undefined || v === null || v === '';
export const boolArg = (v: any): boolean => typeof v === 'string' ? /^(true|1|yes)$/i.test(v.trim()) : !!v;
export const numArg = (v: any, dflt: number): number => { if (unset(v)) return dflt; const n = Number(v); return Number.isFinite(n) ? n : dflt; };
export function fail(status: number, what: string): SiStatusError { return new SiStatusError(status, what); }
export function setStatus(app: App, command: string, status: number): void { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, question = ''): void {
  app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
}
export const cloneKey = (k: Key): Key => ({ ...k });
export const keyId = (p: Parameter, time: number) => `${p.fullName}@${time}`;
const TIME_EPS = 1e-9;
export const sameTime = (a: number, b: number) => Math.abs(a - b) <= TIME_EPS;

/**
 * The numeric value of a `Type` argument. Symbol mapping (inferred, Q6): siInputParams / siMarkedParams = 1,
 * siAnimatedParameters / siAnimParams = 2, the "all" members = 3. NaN when the value is not understood.
 */
export function scopeOf(v: any): number {
  if (unset(v)) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim(); if (/^-?\d+$/.test(s)) return Number(s);
  const tok = (s.match(/:?([A-Za-z0-9_]+)(?::|$)/)?.[1] ?? s).toLowerCase();
  if (tok === 'siinputparams' || tok === 'simarkedparams') return 1;
  if (tok === 'sianimatedparameters' || tok === 'sianimparams') return 2;
  if (/^siall/.test(tok)) return 3;
  return NaN;
}

// ------------------------------------------------------------------ paths and input lists
/** Scripting path of a parameter set: "cube", "cube.kine", "cube.kine.local", "cube.visibility", "cube.polymsh.<operator>". */
export function scriptPathOf(n: ParamSet): string {
  const parent = n.parent;
  if (!parent || n instanceof X3DObject) return n.name;
  if (n instanceof Kinematics) return `${scriptPathOf(parent)}.kine`;
  if (parent instanceof Kinematics) return `${scriptPathOf(parent)}.${n.type.replace(/^kine\./, '')}`;
  if (n instanceof Primitive) return `${scriptPathOf(parent)}.${n.type}`;
  return `${scriptPathOf(parent)}.${n.name}`;
}
export const scriptPath = (x: Parameter | ParamSet): string => x instanceof Parameter ? `${scriptPathOf(x.owner)}.${x.def.name}` : scriptPathOf(x);
export function objectOf(x: Parameter | ParamSet): X3DObject | null {
  let n: any = x instanceof Parameter ? x.owner : x;
  while (n && !(n instanceof X3DObject)) n = n.parent;
  return n instanceof X3DObject ? n : null;
}
/** True when the item has a 3D object strictly above it (the stand-in for the unidentified object kind of Q3). */
export function hasObjectAncestor(x: Parameter | ParamSet): boolean {
  let n: any = x instanceof Parameter ? x.owner : x.parent;
  for (; n; n = n.parent) if (n instanceof X3DObject) return true;
  return false;
}
/** The parameters beneath an item (the item itself when it is a parameter); child objects are not entered. */
export function paramsBeneath(x: Parameter | ParamSet): Parameter[] {
  if (x instanceof Parameter) return [x];
  if (x instanceof X3DObject) {
    const out = [...x.params, ...x.kinematics.local.params];
    for (const pr of x.properties) out.push(...pr.params);
    if (x.primitive) { out.push(...x.primitive.params); for (const op of x.primitive.operators) out.push(...op.params); }
    return out;
  }
  if (x instanceof Kinematics) return [...x.local.params];
  if (x instanceof Primitive) { const out = [...x.params]; for (const op of x.operators) out.push(...op.params); return out; }
  return [...x.params];
}
export const animatableBeneath = (x: Parameter | ParamSet) => paramsBeneath(x).filter(p => p.animatable && !p.def.readOnly);

export interface InputItem { item: Parameter | ParamSet; branch: boolean }
function resolveOne(app: App, raw: any): InputItem | null {
  if (raw instanceof Parameter || raw instanceof ParamSet) return { item: raw, branch: false };
  if (raw && typeof raw === 'object' && 'def' in raw && 'owner' in raw) return { item: raw as Parameter, branch: false };
  if (typeof raw !== 'string') return null;
  let s = raw.trim(); if (!s) return null;
  const branch = /^B:/i.test(s); if (branch) s = s.slice(2);
  const p = findParam(app, s); if (p) return { item: p, branch };
  const parts = s.split('.');
  for (let i = parts.length; i >= 1; i--) {
    const o = app.scene.find(parts.slice(0, i).join('.')); if (!o) continue;
    const rest = parts.slice(i).join('.');
    if (!rest) return { item: o, branch };
    if (rest === 'kine') return { item: o.kinematics, branch };
    if (rest === 'kine.local') return { item: o.kinematics.local, branch };
    if (rest === 'kine.global') return { item: o.kinematics.global, branch };
    const pr = o.properties.find(q => q.name === rest || q.type === rest); if (pr) return { item: pr, branch };
    if (o.primitive && (o.primitive.type === rest || o.primitive.name === rest)) return { item: o.primitive, branch };
    const hit = paramsBeneath(o).find(q => scriptPath(q) === s); if (hit) return { item: hit, branch };
  }
  return null;
}
/** Items named by an object-list argument (instances, arrays, comma / semicolon separated paths, "B:" = branch). */
export function inputItems(app: App, spec: any): InputItem[] {
  if (unset(spec)) return [];
  const list = Array.isArray(spec) ? spec : typeof spec === 'string' ? spec.split(/[;,]/) : [spec];
  const out: InputItem[] = [];
  for (const raw of list) { const r = resolveOne(app, raw); if (r && !out.some(x => x.item === r.item)) out.push(r); }
  return out;
}
/** Default of an animatable-parameter list argument: the marked parameters, else the Save Key mapping (as before). */
export function markedDefault(app: App): Parameter[] {
  const marked = [...app.anim.marked];
  return marked.length ? marked : keyMappingTargets(app);
}
/**
 * The parameter list of a key command. `type` 3 = every fcurve of the scene (InputObjs ignored); 2 with `expand` =
 * each input replaced by its animated parameters; otherwise the inputs as given. An object or parameter set given
 * where a parameter is expected stands for its animatable parameters (kept from the earlier registration).
 */
export function scopeParams(app: App, spec: any, type: number, expand: boolean): Parameter[] {
  const A = app.anim;
  if (type === 3) return [...A.fcurves.keys()];
  const items: (Parameter | ParamSet)[] = unset(spec) ? markedDefault(app) : inputItems(app, spec).map(x => x.item);
  const out: Parameter[] = [];
  const push = (p: Parameter) => { if (!out.includes(p)) out.push(p); };
  for (const it of items) {
    if (type === 2 && expand) { for (const p of paramsBeneath(it)) if (A.fcurves.has(p)) push(p); continue; }
    if (it instanceof Parameter) push(it);
    else if (it instanceof X3DObject) it.kinematics.local.params.filter(p => p.animatable && !p.def.readOnly).forEach(push);
    else animatableBeneath(it).forEach(push);
  }
  return out;
}
/** 3D objects of an object-list argument (null = the selection); a branch item brings its children, recursively. */
export function objectList(app: App, spec: any): X3DObject[] {
  const items: { o: X3DObject; branch: boolean }[] = [];
  if (unset(spec)) for (const o of app.selectedObjects) items.push({ o, branch: false });
  else for (const x of inputItems(app, spec)) if (x.item instanceof X3DObject) items.push({ o: x.item, branch: x.branch });
  const out: X3DObject[] = [];
  const walk = (o: X3DObject, branch: boolean) => { if (!out.includes(o)) out.push(o); if (branch) for (const c of o.children) walk(c, true); };
  for (const x of items) walk(x.o, x.branch);
  return out;
}
/** True while the parameter still hangs under the scene root (a soft reference that still resolves). */
export function alive(app: App, p: Parameter): boolean {
  for (let n: any = p.owner; n; n = n.parent) if (n === app.scene.root) return true;
  return false;
}

// ------------------------------------------------------------------ undo
interface Snap { fc: FCurve | undefined; keys: Key[]; extrap: number; interp: number; expr: any; quat: QuatLink | undefined; value: any }
function snap(app: App, p: Parameter): Snap {
  const fc = app.anim.fcurves.get(p);
  return { fc, keys: fc ? fc.keys.map(cloneKey) : [], extrap: fc?.extrap ?? 0, interp: fc?.interp ?? 0, expr: app.anim.expressions.get(p), quat: stateOf(app).quatSources.get(p), value: p.value };
}
function restore(app: App, p: Parameter, s: Snap, withValue: boolean) {
  const A = app.anim; const Q = stateOf(app).quatSources;
  if (s.fc) { s.fc.keys = s.keys.map(cloneKey); s.fc.extrap = s.extrap; s.fc.interp = s.interp; A.fcurves.set(p, s.fc); } else A.fcurves.delete(p);
  if (s.expr) A.expressions.set(p, s.expr); else A.expressions.delete(p);
  if (s.quat) Q.set(p, s.quat); else Q.delete(p);
  if (withValue) p.value = s.value;
}
/**
 * Run `fn`, which may change the animation of `params` and the key selection, as one undoable step: the state
 * before and after is recorded and undo / redo put it back.
 */
export function transact(app: App, label: string, params: Iterable<Parameter>, fn: () => void, opts: { values?: boolean } = {}): void {
  const list = [...new Set(params)];
  const before = list.map(p => snap(app, p)); const selBefore = [...app.anim.selectedKeys];
  fn();
  const after = list.map(p => snap(app, p)); const selAfter = [...app.anim.selectedKeys];
  const put = (snaps: Snap[], sel: string[]) => {
    list.forEach((p, i) => restore(app, p, snaps[i], !!opts.values));
    app.anim.selectedKeys.clear(); sel.forEach(s => app.anim.selectedKeys.add(s));
    refresh(app);
  };
  app.record(label, () => put(after, selAfter), () => put(before, selBefore));
}
/** Re-evaluate the animation at the current frame and tell the views. */
export function refresh(app: App): void { app.anim.frame = app.anim.frame; app.events.emit('params'); }

/** The fcurve of a parameter with a new key list (created when missing). */
export function putKeys(app: App, p: Parameter, keys: Key[]): FCurve {
  const fc = app.anim.fcurve(p, true)!;
  fc.keys = keys.map(cloneKey).sort((a, b) => a.time - b.time);
  return fc;
}
/** Move the selection marks of a parameter's keys: `map` gives the new time of an old key time, null = key removed. */
export function moveSelection(app: App, p: Parameter, map: Map<number, number | null>): void {
  const sel = app.anim.selectedKeys; const add: string[] = [];
  for (const [from, to] of map) { if (!sel.delete(keyId(p, from))) continue; if (to !== null) add.push(keyId(p, to)); }
  add.forEach(id => sel.add(id));
}
/** Value of a key list at a time, evaluated like the parameter's fcurve (the parameter value when there is no key). */
export function evalKeys(p: Parameter, like: FCurve | undefined, keys: Key[], time: number): number {
  if (!keys.length) return Number(p.value);
  const tmp = new FCurve(p); tmp.keys = keys; if (like) { tmp.extrap = like.extrap; tmp.interp = like.interp; }
  return tmp.eval(time);
}
export { Node };
