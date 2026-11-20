// Ledger row CMD-B15e (Character Rigging script commands): the shared machinery of the rig builders.
// Brief: docs/ghidra/cmd-b15e-character-rigging-scripts.md §2 "Shared facts" and docs/re/WIRE_CORRECTIONS_B15.md items
// 35-37. Original TypeScript written from that prose; no script text is reproduced and no XSIBATCH golden exists.
//
// How the note's vocabulary is mapped onto this build:
//  * Object arguments come through the Collection handler: item 0 of a list is used; the registry GUID default
//    `{F1D7703B-…}` means "nothing". A missing required object logs "<fn>: argument N is invalid" and the command
//    returns nothing (undefined), as the scripts do.
//  * Rig icons are linear NURBS curve objects (`crvlist`) holding frozen curve data; multi-curve icons keep the extra
//    curves in `subcurves` (the viewport draws them).
//  * Display `wirecol` (a palette index in Softimage) is kept as `wirecolIndex` on the object's Display property,
//    because this build's `wirecol` parameter is an on/off flag (same convention as src/commands/particleScripts.ts).
//  * Scripted operators of the Character Rigging plug-in (HipIcon, SpineCurve, DogLeg, ToeGuide, Connector_*, RIG_*,
//    ...) are out of scope (note §2, §4 Q3): each is recorded as an Operator node carrying the parameter values the
//    builder sets, kept on the target (`rigOps`) and in `app.rigB15e.ops`. Its evaluation logs "not yet attested".
//  * Expressions are recorded (`app.rigB15e.expressions`, and `expression` on the parameter); the parameter gets the
//    value the expression has at build time.
//  * Neutral pose: this build's kinematics has no neutral-pose term in the local matrix, so the current local
//    transform is copied into the neutral-pose parameters and kept as is (the visible pose does not change).
//  * Groups belong to a model: a Group whose `parent` is the model (kept in the scene group list).
//  * Up-vector references are kept as `upVectorReference` on the bone (this build's chain solver has no up vector).
//  * Modal dialogs and interactive picks go through `app.rigB15e.hooks`; without a hook the dialog logs "not yet
//    attested: dialog" and its defaults are used (WIRE brief item 35), a pick is cancelled.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Model, Null, Property, Group, Operator, Primitive, Node, threeOrder, makeDisplay } from '../core/scene';
import { ChainRoot, Bone, Effector, makeImplicit } from '../core/scene2';
import { CurveData, V3, makeCurve, circleCurve, curveLength, evalCurve, curveDomain } from '../core/curves';
import { Parameter, ParamDef, num, bool, str } from '../core/params';
import { build } from '../core/geometry';
import { addConstraint } from './constraints';
import { FrozenGeomOperator } from './model';
import { findNode, unset } from './viewEditPropertyHelpers';
import { listOf } from './tasksB11cShared';
import { numArg, intArg, boolArg } from './pluginsB13eShared';

export { numArg, intArg, boolArg, unset, THREE };
export const ROW = 'CMD-B15e';
export const CAT = 'Character Rigging';
export const GUID_NOTHING = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
export type Vec = THREE.Vector3;

// ------------------------------------------------------------------ state
export interface RigOpRecord { name: string; command: string; target: X3DObject; inputs: (X3DObject | null)[]; op: Operator }
export interface RigB15eState {
  ops: RigOpRecord[];
  expressions: { owner: string; param: string; text: string }[];
  dialogs: { command: string; title: string; answer: boolean; values: Record<string, any> }[];
  picks: { command: string; prompt: string; answered: boolean }[];
  progress: string[];
  /** Out values of the last GetSkeleton call (Index, ChainElements). */
  lastGetSkeleton: { Index: number; ChainElements: X3DObject[] } | null;
  hooks: {
    /** Modal dialog: true OK, false Cancel; undefined = no stand-in (logged, defaults used). The values may be edited on `prop`. */
    dialog?: (command: string, prop: Property) => boolean | undefined;
    /** Interactive PickPosition: a world position, null = cancelled; undefined = no stand-in (logged, cancelled). */
    pick?: (command: string, prompt: string) => V3 | null | undefined;
  };
  nyaSeen: Set<string>;
}
export function rigState(app: App): RigB15eState {
  const a: any = app;
  if (!a.rigB15e) a.rigB15e = { ops: [], expressions: [], dialogs: [], picks: [], progress: [], lastGetSkeleton: null, hooks: {}, nyaSeen: new Set() } as RigB15eState;
  return a.rigB15e;
}
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
/** Log a "not yet attested" line once per (command, what). */
export function logNyaOnce(app: App, command: string, what: string) { const s = rigState(app).nyaSeen; const k = command + '|' + what; if (s.has(k)) return; s.add(k); logNya(app, command, what); }
export const logError = (app: App, text: string) => app.logMsg('error', text);
export const logInfo = (app: App, text: string) => app.logMsg('info', text);
export const logWarn = (app: App, text: string) => app.logMsg('info', `WARNING: ${text}`);

// ------------------------------------------------------------------ arguments
export const isNothing = (v: any) => unset(v) || (typeof v === 'string' && v.trim().toUpperCase() === GUID_NOTHING);
/** Item 0 of an object argument (Collection handler), or null. */
export function objArg(app: App, v: any): X3DObject | null {
  if (isNothing(v)) return null;
  if (v instanceof X3DObject) return v;
  for (const x of listOf(v)) { if (isNothing(x)) continue; const n = x instanceof Node ? x : findNode(app, x); return n instanceof X3DObject ? n : null; }
  return null;
}
/** Every resolvable object of a collection argument, in order. */
export function objsArg(app: App, v: any): X3DObject[] {
  if (isNothing(v)) return [];
  const out: X3DObject[] = [];
  for (const x of listOf(v)) { if (isNothing(x)) continue; const n = x instanceof Node ? x : findNode(app, x); if (n instanceof X3DObject) out.push(n); }
  return out;
}
export const strArg = (v: any, d = '') => (unset(v) ? d : String(v));

// ------------------------------------------------------------------ vectors / transforms
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const wpos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());
export const asV3 = (v: Vec): V3 => [v.x, v.y, v.z];
export const translation = (p: Vec) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
/** A frame at `p` whose X axis is `x` and whose Z axis is `z` made orthogonal to X (Y = Z × X). */
export function frame(p: Vec, x: Vec, zHint: Vec | null): THREE.Matrix4 {
  const X = x.clone().normalize(); if (X.lengthSq() < 1e-12) X.set(1, 0, 0);
  let Z = zHint ? zHint.clone().sub(X.clone().multiplyScalar(zHint.dot(X))) : v3();
  if (Z.lengthSq() < 1e-10) { Z = Math.abs(X.z) < 0.9 ? v3(0, 0, 1) : v3(0, 1, 0); Z.sub(X.clone().multiplyScalar(Z.dot(X))); }
  Z.normalize(); const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
}
/** A frame whose Y axis is `y` and X axis points toward `xHint` (spine orientation). */
export function frameY(p: Vec, y: Vec, xHint: Vec): THREE.Matrix4 {
  const Y = y.clone().normalize(); let X = xHint.clone().sub(Y.clone().multiplyScalar(xHint.dot(Y)));
  if (X.lengthSq() < 1e-10) X = v3(0, 0, 1).sub(Y.clone().multiplyScalar(Y.z));
  X.normalize(); const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
}
/** Set an object's local transform so that its global transform is `M` (the object must already be parented). */
export function setGlobal(o: X3DObject, M: THREE.Matrix4) {
  const parentG = o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
  const L = parentG.invert().multiply(M); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); L.decompose(p, q, s);
  const l = o.kinematics.local; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(l.val('rotorder'))); const d = 180 / Math.PI;
  l.set('posx', p.x); l.set('posy', p.y); l.set('posz', p.z); l.set('rotx', e.x * d); l.set('roty', e.y * d); l.set('rotz', e.z * d); l.set('sclx', s.x); l.set('scly', s.y); l.set('sclz', s.z);
}

// ------------------------------------------------------------------ objects
/** Names are unique inside a model (Softimage's namespace), not across the scene. */
export function nameIn(parent: X3DObject, base: string, self?: X3DObject): string {
  const scope: X3DObject = parent instanceof Model ? parent : parent.model ?? parent;
  const used = new Set<string>();
  const walk = (o: X3DObject) => { for (const c of o.children) { if (c !== self) used.add(c.name); if (!(c instanceof Model)) walk(c); } };
  walk(scope);
  if (!used.has(base)) return base;
  for (let i = 1; ; i++) if (!used.has(base + i)) return base + i;
}
/** Add `o` under `parent` (scene root when null), optionally at global transform `M`. Undoable. */
export function place<T extends X3DObject>(app: App, o: T, parent: X3DObject | null, M?: THREE.Matrix4): T {
  const p = parent ?? app.scene.root; o.name = nameIn(p, o.name || 'object');
  app.record('Add ' + o.name, () => p.addChild(o), () => p.removeChild(o));
  if (M) setGlobal(o, M);
  return o;
}
/** Re-parent keeping the global transform. */
export function reparent(app: App, o: X3DObject, parent: X3DObject | null) {
  const p = parent ?? app.scene.root; const old = o.parentObj; if (old === p) return; const G = o.globalMatrix(); const before = localValues(o);
  app.record('ParentObj', () => { p.addChild(o); o.name = nameIn(p, o.name, o); setGlobal(o, G); }, () => { if (old) old.addChild(o); else p.removeChild(o); restoreLocal(o, before); });
}
const KEYS = ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'];
const localValues = (o: X3DObject) => KEYS.map(k => o.kinematics.local.val(k));
const restoreLocal = (o: X3DObject, v: number[]) => KEYS.forEach((k, i) => o.kinematics.local.set(k, v[i]));
export function deleteObj(app: App, o: X3DObject) { const p = o.parentObj; if (!p) return; app.record('DeleteObj', () => p.removeChild(o), () => p.addChild(o)); }

/** Set (adding when missing) a numeric display/element parameter on the object node (size, primary_icon, radius, ...). */
export function setP(o: Node, name: string, v: number | boolean | string) {
  let p = o.get(name);
  if (!p) p = o.add(typeof v === 'boolean' ? bool(name, v, name) : typeof v === 'string' ? str(name, v, name) : num(name, v, name));
  p.value = v;
}
export function displayOf(o: X3DObject): Property { let d = o.property('display'); if (!d) { d = makeDisplay(); o.addProperty(d); } return d; }
export function setColor(o: X3DObject, index: number) { (displayOf(o) as any).wirecolIndex = index; }
export const wireColor = (o: X3DObject): number | undefined => (o.property('display') as any)?.wirecolIndex;
/** Set a parameter value as one undo step without per-parameter UI events (the command's final 'scene' event redraws). */
export function quietSet(app: App, p: Parameter | undefined, v: any) { if (!p) return; const old = p.value; if (old === v) return; app.record('SetValue', () => { p.value = v; }, () => { p.value = old; }); }
export function hideObj(app: App, o: X3DObject) { quietSet(app, o.property('visibility')?.get('viewvis'), false); }

export function mkNull(app: App, name: string, parent: X3DObject | null, at: THREE.Matrix4 | Vec | null, opts: { color?: number; size?: number; icon?: number } = {}): Null {
  const n = place(app, new Null(name), parent, at instanceof THREE.Vector3 ? translation(at) : at ?? undefined);
  if (opts.size !== undefined) setP(n, 'size', opts.size);
  if (opts.icon !== undefined) setP(n, 'primary_icon', opts.icon);
  if (opts.color !== undefined) setColor(n, opts.color);
  return n;
}
/** A curve-list object holding fixed curves (first = primary, the rest = sub-curves). */
export function curveObj(app: App, name: string, parent: X3DObject | null, curves: CurveData[], M?: THREE.Matrix4): X3DObject {
  const o = new X3DObject(name, 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
  const data: any = { ...curves[0], subcurves: curves.slice(1) };
  prim.addOperator(new FrozenGeomOperator(data, 'NURBS Curve List')); o.setPrimitive(prim); o.addProperty(makeDisplay());
  return place(app, o, parent, M);
}
/** A polygon-mesh cube (edge 1, centred) — the box-shadow and vertebra geometry. */
export function cubeMesh(app: App, name: string, parent: X3DObject | null, M?: THREE.Matrix4, size = 1): X3DObject {
  const h = size / 2; const v = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]];
  const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]];
  const o = new X3DObject(name, 'polymsh'); const prim = new Primitive('Polygon Mesh', 'polymsh');
  prim.addOperator(new FrozenGeomOperator(build(v, f), 'Geometry')); o.setPrimitive(prim); o.addProperty(makeDisplay());
  return place(app, o, parent, M);
}
export function implicitObj(app: App, name: string, shape: 'Cube' | 'Sphere', parent: X3DObject | null, M?: THREE.Matrix4, size = 1): X3DObject {
  const o = makeImplicit(name, shape); o.primitive?.set('size', size); return place(app, o, parent, M);
}
export function customProp(app: App, owner: X3DObject, name: string, defs: ParamDef[] = []): Property {
  const p = new Property(name, 'customparamset', defs);
  const siblings = owner.properties.map(x => x.name); let n = name; for (let i = 1; siblings.includes(n); i++) n = name + i; p.name = n;
  app.record('AddProp ' + n, () => owner.addProperty(p), () => owner.removeProperty(p));
  return p;
}
/** A proxy parameter on `owner` that aliases `master` (same convention as src/commands/characterKeySets.ts). */
export function addProxy(owner: Property, master: Parameter, name?: string): Parameter {
  const m = (master as any).proxied ?? master;
  let n = name ?? m.name; for (let i = 1; owner.get(n); i++) n = (name ?? m.name) + i;
  const px = owner.add({ ...m.def, name: n, label: n, value: m.value, keyable: true, group: undefined });
  (px as any).proxied = m;
  Object.defineProperty(px, 'value', { configurable: true, get: () => m.value, set: (v: any) => { m.value = v; } });
  return px;
}
export function setKeyable(app: App, p: Parameter | undefined, on: boolean) {
  if (!p || !!p.def.keyable === on) return; const old = p.def.keyable;
  app.record('SetKeyable', () => { p.def.keyable = on; }, () => { p.def.keyable = old; });
}
export function neutralPose(app: App, o: X3DObject) {
  const l = o.kinematics.local; const vals = ['x', 'y', 'z'].map(a => [`npos${a}`, l.val(`pos${a}`)] as const);
  for (const [k, v] of vals) quietSet(app, l.get(k), v);
  (o as any).neutralPose = { pos: vals.map(x => x[1]), rot: ['x', 'y', 'z'].map(a => l.val('rot' + a)) };
}
export function expression(app: App, owner: X3DObject | Node, param: string, text: string, value?: number) {
  const p = owner instanceof X3DObject ? owner.kinematics.local.get(param) ?? owner.get(param) : owner.get(param);
  if (p && value !== undefined && Number.isFinite(value)) quietSet(app, p, value);
  if (p) (p as any).expression = text;
  rigState(app).expressions.push({ owner: owner.fullName, param, text });
}
export function upVector(app: App, bone: X3DObject, ref: X3DObject | null) {
  if (!ref) return; const old = (bone as any).upVectorReference;
  app.record('UpVectorReference', () => { (bone as any).upVectorReference = ref; }, () => { (bone as any).upVectorReference = old; });
}

// ------------------------------------------------------------------ constraints / operators
/** ApplyCns. `compensate` keeps the current global pose (Pose: relative matrix; Position: offsets). */
export function cns(app: App, o: X3DObject, preset: 'Pose' | 'Position' | 'Orientation' | '2 Points' | 'Bounding Volume' | 'Curve (Path)', targets: X3DObject[], compensate = false) {
  const before = o.globalMatrix();
  const c = addConstraint(app, o, preset, targets, preset === 'Position' && compensate);
  if (preset === 'Pose' && compensate && targets[0]) (c as any)._poseOffset = targets[0].globalMatrix().invert().multiply(before);
  if (preset === '2 Points') (c as any).TwoPoints = true;
  return c;
}
/** A scripted operator of the Character Rigging plug-in, recorded with its parameter values (math out of scope). */
export function scriptOp(app: App, command: string, opName: string, target: X3DObject, inputs: (X3DObject | null)[], params: Record<string, number | boolean | string> = {}): Operator {
  const op = new Operator(opName, opName, []);
  for (const [k, v] of Object.entries(params)) setP(op, k, v);
  (op as any).inputs = inputs; (op as any).target = target; op.parent = target;
  const rec: RigOpRecord = { name: opName, command, target, inputs, op }; const st = rigState(app);
  app.record('ApplyOp ' + opName, () => { ((target as any).rigOps ??= []).push(op); st.ops.push(rec); }, () => { const l = (target as any).rigOps as Operator[]; l.splice(l.indexOf(op), 1); st.ops.splice(st.ops.indexOf(rec), 1); });
  logNyaOnce(app, command, `${opName} operator evaluation (scripted operator of the Character Rigging plug-in, outside this row; parameters stored)`);
  return op;
}
export const opsOn = (o: X3DObject, name?: string): Operator[] => ((o as any).rigOps ?? []).filter((op: Operator) => !name || op.name === name);

// ------------------------------------------------------------------ groups / hide setup
export function modelGroup(app: App, model: X3DObject, name: string, hidden = false): Group {
  const g = new Group(name); g.parent = model; g.add(bool('viewvis', !hidden, 'View Visibility'));
  app.record('AddGroup ' + name, () => app.scene.groupList.push(g), () => { const i = app.scene.groupList.indexOf(g); if (i >= 0) app.scene.groupList.splice(i, 1); });
  return g;
}
export const groupsOf = (app: App, model: X3DObject | null) => app.scene.groupList.filter(g => g.parent === model);
export function findGroup(app: App, model: X3DObject | null, name: string, contains = false): Group | null {
  const n = name.toLowerCase();
  return groupsOf(app, model).find(g => (contains ? g.fullName.toLowerCase().includes(n) : g.name.toLowerCase() === n)) ?? null;
}
export function addToGroup(app: App, g: Group, objs: X3DObject[]) {
  for (const o of objs) { if (!o || g.members.includes(o)) continue; app.record('AddToGroup', () => g.members.push(o), () => { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); }); }
}
export const modelOf = (o: X3DObject | null): Model | null => (o ? o.model : null);
/** Standard hide setup (note §2): `Hidden` / `Envelope_group` of the model, or `Shadow_hidden` / `Shadow_envelope_group`
 *  (FullName contains) for shadow components. Objects not grouped as hidden get viewvis false. */
export function hideSetup(app: App, model: X3DObject | null, hidden: X3DObject[], envelope: X3DObject[], shadow = false): { HiddenGroup: Group | null; envGroup: Group | null } {
  const hg = shadow ? findGroup(app, model, 'Shadow_hidden', true) : findGroup(app, model, 'Hidden');
  const eg = shadow ? findGroup(app, model, 'Shadow_envelope_group', true) : findGroup(app, model, 'Envelope_group');
  if (hg) addToGroup(app, hg, hidden); else for (const o of hidden) if (o) hideObj(app, o);
  if (eg) addToGroup(app, eg, envelope);
  return { HiddenGroup: hg, envGroup: eg };
}

// ------------------------------------------------------------------ marking sets
/** Standard marking set (note §2 addMarkingSet). `shadowSpine` is MakeShadowSpine's variant (keyable untouched, a
 *  non-empty single proxied three times). */
export function markingSet(app: App, o: X3DObject, pos: boolean, rot: boolean, single: string, keySet: string, variant: 'standard' | 'shadowSpine' = 'standard'): Property {
  const ms = customProp(app, o, 'MarkingSet'); const l = o.kinematics.local; const std = variant === 'standard';
  for (const [on, names] of [[pos, ['posx', 'posy', 'posz']], [rot, ['rotx', 'roty', 'rotz']]] as const) {
    for (const n of names) { const p = l.get(n); if (!p) continue; if (on) { if (std) setKeyable(app, p, true); addProxy(ms, p); } else if (std) setKeyable(app, p, false); }
  }
  if (single) { const p = l.get(single) ?? o.get(single); if (p) for (let i = 0; i < (std ? 1 : 3); i++) addProxy(ms, p); }
  if (std) for (const n of ['sclx', 'scly', 'sclz']) setKeyable(app, l.get(n), false);
  ms.add(str('CharacterKeySet', keySet, 'CharacterKeySet'));
  return ms;
}
export const markingSetsOf = (o: X3DObject) => o.properties.filter(p => p.type === 'customparamset' && p.name.includes('MarkingSet'));

// ------------------------------------------------------------------ chains
export interface Chain { root: ChainRoot; bones: Bone[]; eff: Effector; skel: X3DObject[] }
/** Add2DChain / Add3DChain + AddBone through world points; bones' Z axis follows `normal` (plane normal; null/zero →
 *  the plane of the points). Then the AlignFirstBone check. */
export function drawChain(app: App, parent: X3DObject | null, pts: Vec[], normal: Vec | null, type: number, names: { root?: string; bones?: string[]; eff?: string } = {}): Chain {
  let n = normal && normal.lengthSq() > 1e-12 ? normal.clone().normalize() : null;
  if (!n && pts.length >= 3) { const c = new THREE.Vector3().crossVectors(pts[1].clone().sub(pts[0]), pts[2].clone().sub(pts[1])); if (c.lengthSq() > 1e-12) n = c.normalize(); }
  const frames = pts.slice(0, -1).map((p, i) => frame(p, pts[i + 1].clone().sub(p), n));
  const root = new ChainRoot(names.root ?? 'root'); place(app, root, parent, frames[0]); (root as any).chainType = type;
  const bones: Bone[] = []; let prev: X3DObject = root;
  for (let i = 0; i < frames.length; i++) {
    const b = new Bone(names.bones?.[i] ?? names.bones?.[names.bones.length - 1] ?? 'bone', pts[i].distanceTo(pts[i + 1]));
    place(app, b, prev, frames[i]); bones.push(b); prev = b;
  }
  const eff = new Effector(names.eff ?? 'eff'); place(app, eff, prev, frames[frames.length - 1].clone().setPosition(pts[pts.length - 1]));
  app.record('Chain', () => { root.bones = bones; root.effector = eff; }, () => { root.bones = []; root.effector = null; });
  // AlignFirstBone: flip the first bone 180° about its local X when its Y axis points away from the root's Y axis.
  const yOf = (o: X3DObject) => new THREE.Vector3().setFromMatrixColumn(o.globalMatrix(), 1).normalize();
  if (bones[0] && yOf(bones[0]).dot(yOf(root)) < -1e-6) setGlobal(bones[0], bones[0].globalMatrix().multiply(new THREE.Matrix4().makeRotationX(Math.PI)));
  return { root, bones, eff, skel: [root, ...bones, eff] };
}
/** setChainScale: every element shadow_icon 1 / primary_icon 0; root and effector shadow_scaleX / radius /
 *  shadow_scaleZ = s × kEnd; bones radius / shadow_scaleZ = s × kBone. */
export function setChainScale(c: Chain, s: number, kEnd = 0.5, kBone = 1.0) {
  for (const e of c.skel) { setP(e, 'shadow_icon', 1); setP(e, 'primary_icon', 0); }
  for (const e of [c.root, c.eff]) { setP(e, 'shadow_scaleX', s * kEnd); setP(e, 'radius', s * kEnd); setP(e, 'shadow_scaleZ', s * kEnd); }
  for (const b of c.bones) { setP(b, 'radius', s * kBone); setP(b, 'shadow_scaleZ', s * kBone); }
}
export const colorChain = (c: Chain, col: number) => c.skel.forEach(e => setColor(e, col));
/** The skeleton collection of a chain element: root, bones, effector (GetSkeleton). */
export function skeletonOf(o: X3DObject | null): X3DObject[] | null {
  let r: X3DObject | null = o;
  while (r && !(r instanceof ChainRoot)) r = r.parentObj;
  if (!r) return null; const root = r as ChainRoot;
  return [root, ...root.bones, ...(root.effector ? [root.effector] : [])];
}
export const boneLength = (b: X3DObject) => Number(b.get('length')?.value ?? 0);

// ------------------------------------------------------------------ rig icons (MakeRigIcon shapes)
const lin = (pts: V3[]) => makeCurve(pts, 1, false);
function boxPath(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): V3[] {
  const b: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], t: V3[] = b.map(p => [p[0], y1, p[2]] as V3);
  return [b[0], b[1], b[2], b[3], b[0], t[0], t[1], b[1], t[1], t[2], b[2], t[2], t[3], b[3], t[3], t[0]];
}
function pyramidPath(hx: number, hz: number, y0: number, apex: number): V3[] {
  const b: V3[] = [[-hx, y0, -hz], [hx, y0, -hz], [hx, y0, hz], [-hx, y0, hz]]; const a: V3 = [0, apex, 0];
  return [b[0], b[1], b[2], b[3], b[0], a, b[1], a, b[2], a, b[3]];
}
function octaPath(hx: number, hz: number, y0: number, y1: number): V3[] {
  const ym = (y0 + y1) / 2; const e: V3[] = [[hx, ym, 0], [0, ym, hz], [-hx, ym, 0], [0, ym, -hz]]; const T: V3 = [0, y1, 0], B: V3 = [0, y0, 0];
  return [e[0], e[1], e[2], e[3], e[0], T, e[1], B, e[2], T, e[3], B, e[0]];
}
export const MULTI_SHAPE_NAMES: Record<number, string> = { 9: 'Sphere', 10: 'EyeArrow', 11: 'LookAt', 12: 'Pin', 13: 'AngleSurvey', 14: 'Eyeball', 16: 'RightTriangle', 17: 'RAKHead' };
/** The curves of a MakeRigIcon type (local space, before the offset), or null for an unknown type. `attested` is false
 *  for the fixed shapes the note does not describe (types 10-15, 16, 17). */
export function rigIconCurves(type: number, xl: number, yl: number, zl: number): { curves: CurveData[]; multi: boolean; attested: boolean } | null {
  const hx = xl / 2, hy = yl / 2, hz = zl / 2;
  switch (type) {
    case 0: return { curves: [lin([[0, -hy, -hz], [0, hy, -hz], [0, hy, hz], [0, -hy, hz], [0, -hy, -hz]])], multi: false, attested: true };
    case 1: return { curves: [lin([[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, 0, -hz]])], multi: false, attested: true };
    case 2: return { curves: [lin(boxPath(-hx, hx, 0, yl, -hz, hz))], multi: false, attested: true };
    case 3: return { curves: [lin(boxPath(-hx, hx, -hy, hy, -hz, hz))], multi: false, attested: true };
    case 4: return { curves: [lin(pyramidPath(hx, hz, 0, yl))], multi: false, attested: true };
    case 5: return { curves: [lin(pyramidPath(hx, hz, -hy, hy))], multi: false, attested: true };
    case 6: return { curves: [lin(octaPath(hx, hz, 0, yl))], multi: false, attested: true };
    case 7: { const p = boxPath(-hx, hx, 0, yl / 2, -hz, hz); const a: V3 = [0, yl, 0]; const t = (x: number, z: number): V3 => [x, yl / 2, z]; return { curves: [lin([...p, a, t(hx, -hz), a, t(hx, hz), a, t(-hx, hz)])], multi: false, attested: true }; }
    case 8: return { curves: [lin(octaPath(hx, hz, -hy, hy))], multi: false, attested: true };
    case 9: {
      const c = circleCurve(0.75); const sc = (m: (p: number[]) => number[]): CurveData => ({ ...c, cvs: c.cvs.map(p => { const q = m(p); return [q[0] * xl, q[1] * yl, q[2] * zl, p[3]] as [number, number, number, number]; }) });
      return { curves: [sc(p => [p[0], 0, p[2]]), sc(p => [p[0], p[2], 0]), sc(p => [0, p[0], p[2]])], multi: true, attested: true };
    }
    case 10: case 11: case 12: case 13: case 14: case 16: case 17:
      return { curves: [lin([[-hx, 0, 0], [hx, 0, 0]]), lin([[0, -hy, 0], [0, hy, 0]]), lin([[0, 0, -hz], [0, 0, hz]])], multi: true, attested: false };
    case 15: return { curves: [lin(boxPath(-hx, hx, -hy, hy, -hz, hz))], multi: false, attested: false };
    default: return null;
  }
}
/** MakeRigIcon core (also used by the builders for their controls). */
export function rigIcon(app: App, command: string, parent: X3DObject | null, type: number, at: Vec, len: [number, number, number], color: number, name: string, off: [number, number, number] = [0, 0, 0]): X3DObject | undefined {
  const multi = [9, 10, 11, 12, 13, 14, 16, 17].includes(type);
  let [xl, yl, zl] = len; let nm = name;
  if (multi) { if (!xl) xl = 1; if (!yl) yl = 1; if (!zl) zl = 1; if (!nm) nm = MULTI_SHAPE_NAMES[type]; }
  const shape = rigIconCurves(type, xl, yl, zl); if (!shape) return undefined;
  if (!shape.attested) logNyaOnce(app, command, `the fixed unit shape of icon type ${type} (axis cross used)`);
  const curves = off.every(v => v !== 0) ? shape.curves.map(c => ({ ...c, cvs: c.cvs.map(p => [p[0] + off[0], p[1] + off[1], p[2] + off[2], p[3]] as [number, number, number, number]) })) : shape.curves;
  const o = curveObj(app, nm || 'crvlist', parent, curves, translation(at));
  if (!multi || color !== 0) setColor(o, color);
  (o as any).rigIconType = type;
  return o;
}
/** Square (IconType 0 → top square) or cube (IconType 1) control of the given sizes. */
export function control(app: App, command: string, name: string, parent: X3DObject | null, M: THREE.Matrix4, cube: boolean, sq: number, cb: number, color: number): X3DObject {
  const s = cube ? cb : sq; const o = rigIcon(app, command, parent, cube ? 3 : 1, v3(), [s, s, s], color, name)!;
  setGlobal(o, M); return o;
}

// ------------------------------------------------------------------ box shadows
export const BOX_DIFFUSE: V3 = [0.741, 0.653, 0.603], BOX_AMBIENT: V3 = [0.845, 0.496, 0.300];
/** Box shadow (note §2): cube mesh at the start object's global transform, Pose (no compensation) to it, a Connector_*
 *  operator, Phong colours, wirecol 479, rot-only marking set. */
export function boxShadow(app: App, command: string, name: string, parent: X3DObject | null, start: X3DObject, inputs: X3DObject[], opName: string, params: Record<string, number | boolean>, keySet: string): X3DObject {
  const box = cubeMesh(app, name, parent, start.globalMatrix());
  cns(app, box, 'Pose', [start], false);
  scriptOp(app, command, opName, box, [start, ...inputs], params);
  (box as any).phong = { diffuse: BOX_DIFFUSE, ambient: BOX_AMBIENT };
  setColor(box, 479); markingSet(app, box, false, true, '', keySet);
  return box;
}

// ------------------------------------------------------------------ dialogs / picks / progress
/** Modal dialog stand-in: a temporary custom property on the scene root. Returns the values, or null on Cancel. */
export function runDialog(app: App, command: string, title: string, defs: ParamDef[]): Record<string, any> | null {
  const st = rigState(app); const prop = new Property(title, 'customparamset', defs); app.scene.root.addProperty(prop);
  let answer: boolean | undefined;
  try { answer = st.hooks.dialog?.(command, prop); } finally { /* removed below */ }
  if (answer === undefined) { logNya(app, command, `dialog "${title}" (modal PPG; no dialog stand-in in this build, its default values are used)`); answer = true; }
  const values: Record<string, any> = {}; for (const p of prop.params) values[p.name] = p.value;
  app.scene.root.removeProperty(prop);
  st.dialogs.push({ command, title, answer, values });
  return answer ? values : null;
}
export function pickPosition(app: App, command: string, prompt: string): Vec | null {
  const st = rigState(app); const r = st.hooks.pick?.(command, prompt);
  if (r === undefined) { logNya(app, command, `interactive PickPosition "${prompt}" (no pick session; treated as cancelled)`); st.picks.push({ command, prompt, answered: false }); return null; }
  st.picks.push({ command, prompt, answered: !!r }); return r ? v3(...r) : null;
}
export function progress(app: App, caption: string) { rigState(app).progress.push(caption); }

// ------------------------------------------------------------------ guides
export const childNamed = (root: X3DObject | null, name: string): X3DObject | null => {
  if (!root) return null; for (const c of root.descendants()) if (c.name === name) return c; return null;
};
/** A guide and its numbered duplicates `<name>1`, `<name>2`, ... (up to `max`). */
export function duplicates(model: X3DObject | null, base: string, max = 40): X3DObject[] {
  const out: X3DObject[] = []; for (let i = 1; i <= max; i++) { const g = childNamed(model, base + i); if (!g) break; out.push(g); } return out;
}
/** Curve sample in world space at fraction t (0..1) of the parameter range. */
export function curvePoint(o: X3DObject, t: number): Vec {
  const c = o.primitive?.curve(); if (!c) return wpos(o); const [u0, u1] = curveDomain(c); const p = evalCurve(c, u0 + (u1 - u0) * t);
  return v3(...p).applyMatrix4(o.globalMatrix());
}
export function curveLen(o: X3DObject): number { const c = o.primitive?.curve(); if (!c) return 0; const s = new THREE.Vector3().setFromMatrixScale(o.globalMatrix()); return curveLength(c) * Math.max(s.x, s.y, s.z); }

/** Sample guide models for the rig builders (original positions; Y up, character facing +Z, left = +X). */
export function buildSampleGuide(app: App, kind: 'biped' | 'dogleg' | 'quadruped'): Model {
  const name = kind === 'biped' ? 'Biped_Guide' : kind === 'dogleg' ? 'Biped_DogLeg_Guide' : 'Quadruped_Guide';
  const old = app.scene.root.children.find(c => c.name === name); if (old) app.scene.root.removeChild(old);
  const model = new Model(name); app.scene.root.addChild(model); (model as any).rigB15eGuide = kind;
  const put = (n: string, x: number, y: number, z: number) => { const o = new Null(n); model.addChild(o); o.kinematics.local.set('posx', x); o.kinematics.local.set('posy', y); o.kinematics.local.set('posz', z); return o; };
  const blade = (n: string, p: V3) => { const o = new X3DObject(n, 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist'); prim.addOperator(new FrozenGeomOperator(lin([p, [p[0], p[1], p[2] - 0.3]]), 'Blade')); o.setPrimitive(prim); model.addChild(o); };
  const both = (f: (s: string, x: number) => void) => { f('L', 1); f('R', -1); };
  if (kind !== 'quadruped') {
    put('SpineBase', 0, 10, 0); put('SpineHipDepth', 0, 10.8, -0.3); put('SpineChestDepth', 0, 12.6, -0.3); put('RibCageEnd', 0, 14.2, 0); put('RibCageStart', 0, 13.2, 0.3);
    put('Neck', 0, 15.1, 0.1); put('Head', 0, 16.2, 0.2); put('Head1', 0, 17.6, 0.2);
    put('LowerStomach', 0, 10.6, 1.0); put('UpperStomach', 0, 12.4, 1.1);
    both((s, x) => {
      put(`${s}ShoulderStart`, 0.4 * x, 13.9, 0); put(`${s}Shoulder`, 1.6 * x, 14, 0); put(`${s}Elbow`, 4.4 * x, 14, -0.3); put(`${s}Hand`, 7 * x, 14, 0); put(`${s}HandEnd`, 8 * x, 14, 0);
      for (const [f, z, len] of [['Index', 0.4, 0.55], ['Middle', 0.1, 0.6], ['Ring', -0.2, 0.55], ['Pinky', -0.45, 0.45]] as const) {
        for (let j = 1; j <= 3; j++) put(`${s}${f}${j}`, (8.1 + (j - 1) * len) * x, 14, z); blade(`${s}${f}_fingerBlade`, [8.1 * x, 14, z]);
      }
      put(`${s}Thumb1`, 7.6 * x, 13.8, 0.6); put(`${s}Thumb2`, 8.0 * x, 13.7, 0.9); put(`${s}Thumb3`, 8.3 * x, 13.6, 1.1); blade(`${s}Thumb_fingerBlade`, [7.6 * x, 13.8, 0.6]);
      put(`${s}ArmPitTop`, 1.5 * x, 13.5, 0); put(`${s}ArmPitBase`, 1.8 * x, 13.0, 0);
      put(`${s}HipTop`, 1.2 * x, 10.2, 0); put(`${s}HipBottom`, 1.3 * x, 9.2, 0); put(`${s}LowerThigh`, 0.9 * x, 8.4, -0.7);
      put(`${s}ElbowJoint2`, 4.0 * x, 14.2, 0.1); put(`${s}ElbowJoint1`, 4.8 * x, 14.2, 0.1); put(`${s}ForeArmSquash`, 4.4 * x, 14.0, 0.4); put(`${s}ForeArmCenter`, 4.4 * x, 14, 0);
      put(`${s}Belly1`, 0.6 * x, 11, 1); put(`${s}Belly2`, 0.7 * x, 11.6, 0.9);
      put(`${s}Pivot`, 1 * x, 0, 0.6); put(`${s}PivotRight`, x - 0.5, 0, 1.2); put(`${s}PivotLeft`, x + 0.5, 0, 1.2);
      if (kind === 'biped') {
        put(`${s}Leg`, 1 * x, 9.8, 0); put(`${s}Knee`, 1 * x, 5.4, 0.4); put(`${s}Rear1`, 0.8 * x, 9.6, -0.8);
        put(`${s}Foot1`, 1 * x, 1, 0); put(`${s}Foot2`, 1 * x, 0.3, 1.2); put(`${s}Foot3`, 1 * x, 0.1, 2.0); put(`${s}Foot4`, 1 * x, 0.05, 2.6);
        put(`${s}ThighBack1`, 1 * x, 5.8, -0.3); put(`${s}ThighBack2`, 1 * x, 5.0, -0.3); put(`${s}CalfBack`, 1 * x, 5.4, -0.6); put(`${s}CalfCenter`, 1 * x, 5.4, 0);
      } else {
        put(`${s}Femur`, 1 * x, 9.8, 0); put(`${s}Tibia`, 1 * x, 6.2, 1.0); put(`${s}Metarsal`, 1 * x, 3.2, -0.8); put(`${s}Rear`, 0.8 * x, 9.6, -0.8);
        put(`${s}Foot1`, 1 * x, 0.8, 0); put(`${s}Foot2`, 1 * x, 0.3, 0.9); put(`${s}Foot3`, 1 * x, 0.1, 1.6); put(`${s}Foot4`, 1 * x, 0.05, 2.2);
      }
    });
  } else {
    put('SpineBase', 0, 8, -5); put('SpineHipDepth', 0, 8.6, -2.5); put('SpineChestDepth', 0, 8.6, 2); put('RibCageEnd', 0, 8.2, 4.5);
    put('Neck', 0, 10, 6); put('Head', 0, 11, 7.5); put('LowerStomach', 0, 6.5, -2); put('UpperStomach', 0, 6.5, 2);
    both((s, x) => {
      put(`${s}Femur`, 1.2 * x, 8, -5.2); put(`${s}ShoulderStart`, 0.4 * x, 8.2, 4.2); put(`${s}Shoulder`, 1.2 * x, 7.4, 4.4);
      put(`B${s}Tibia`, 1.2 * x, 5, -4.2); put(`B${s}Metarsal`, 1.2 * x, 2, -5.4);
      put(`B${s}Pivot`, 1.2 * x, 0, -4.8); put(`B${s}PivotRight`, 0.9 * x, 0, -4.2); put(`B${s}PivotLeft`, 1.5 * x, 0, -4.2);
      put(`B${s}HindClaw1`, 1.2 * x, 0.6, -4.9); put(`B${s}HindClaw2`, 1.2 * x, 0.15, -4.3); put(`B${s}HindClaw3`, 1.2 * x, 0.05, -3.8); put(`B${s}HindClaw4`, 1.2 * x, 0.02, -3.4);
      put(`${s}Ulna`, 1.2 * x, 4, 4.6);
      put(`F${s}Pivot`, 1.2 * x, 0, 4.6); put(`F${s}PivotRight`, 0.9 * x, 0, 5.2); put(`F${s}PivotLeft`, 1.5 * x, 0, 5.2);
      put(`F${s}Claw1`, 1.2 * x, 0.7, 4.4); put(`F${s}Claw2`, 1.2 * x, 0.15, 5.0); put(`F${s}Claw3`, 1.2 * x, 0.05, 5.5); put(`F${s}Claw4`, 1.2 * x, 0.02, 5.9);
      put(`${s}Belly1`, 0.6 * x, 6.6, -0.5); put(`${s}Belly2`, 0.6 * x, 6.6, 0.5);
    });
  }
  app.events.emit('scene');
  return model;
}
