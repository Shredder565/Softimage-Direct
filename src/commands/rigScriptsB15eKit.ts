// Ledger row CMD-B15e (Character Rigging scripts): shared kit of the 24 builders in rigScriptsB15e*.ts.
// Brief: docs/ghidra/cmd-b15e-character-rigging-scripts.md ("Shared facts", section 2) and docs/re/WIRE_CORRECTIONS_B15.md
// items 35-37. Original code written from that prose only; no golden exists.
//
// Stand-in model (this build has no character rigging plug-in):
//  * Rig objects are ordinary scene objects: Null / curve list / chain (ChainRoot, Bone, Effector) with the names, hierarchy,
//    colors (Display `wirecol_index`), and parameter values the note lists. Every object keeps the global POSITION the note
//    derives; orientations are not computed (inferred: objects keep world orientation), so chain normals, roll angles and
//    mirror planes are recorded as parameters only.
//  * Scripted operators (HipIcon, SpineCurve, DogLeg, ToeGuide, Connector_*, RIG_*, ...) are attached as parameter-carrying
//    stand-in operators (name + the parameter values the note gives); their maths is out of scope (note section 2).
//  * Pose / Position constraints are real constraints; TwoPoints / BoundingVolume / Path constraints are stored as
//    inert constraint properties (no evaluation).
//  * Groups (hidden, envelope_group, Shadow_hidden, ...) are scene groups tagged with their owning model.
//  * A missing guide is "not attested" territory: the guides of a model are looked up by the names the note lists.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Model, Null, Group, Property, Primitive, Constraint, Operator, makeDisplay } from '../core/scene';
import { ChainRoot, makeChain } from '../core/scene2';
import { num, str, bool, int } from '../core/params';
import { makeCurve } from '../core/curves';
import { FrozenGeomOperator } from './model';
import { unset, listOf, numArg, intArg, boolArg, objArg, nodesArg, addObject, addProperty, resolve } from './pluginsB13eShared';

export { THREE, unset, listOf, numArg, intArg, boolArg, objArg, nodesArg, X3DObject, Node, Model, Null, Group, Property, Operator };
export const ROW = 'CMD-B15e';
export const NOTE = 'docs/ghidra/cmd-b15e-character-rigging-scripts.md';
export type V3 = THREE.Vector3;
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ state
export interface RigState {
  /** Stand-in for the modal dialogs (SelectUsingUI = false): the dialog name and the defaults that were applied. */
  dialogs: { name: string; values: Record<string, any> }[];
  /** Operators attached to nodes without a primitive. */
  ops: Operator[];
  /** Last return objects by command. */
  last: Record<string, any>;
}
export const rigState = (app: App): RigState => {
  const a = app as any; return a.rigScriptsB15e ??= { dialogs: [], ops: [], last: {} } as RigState;
};
export const logError = (app: App, text: string) => app.logMsg('error', text);
export const logInfo = (app: App, text: string) => app.logMsg('info', text);
export const logWarn = (app: App, text: string) => app.logMsg('info', 'WARNING: ' + text);
export const logNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`);

/** Dialog stand-in: applies the defaults, logs it (no UI; inferred). */
export function dialogStandIn(app: App, name: string, values: Record<string, any>) {
  rigState(app).dialogs.push({ name, values });
  logInfo(app, `${name}: modal dialog not available (stand-in); applying the default option values (inferred, ${ROW})`);
}

// ------------------------------------------------------------------ small helpers
const keep = (o: any) => (o instanceof X3DObject ? o : null);
export const gpos = (o: X3DObject): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());
export const dist = (a: X3DObject | THREE.Vector3, b: X3DObject | THREE.Vector3) => (a instanceof X3DObject ? gpos(a) : a).distanceTo(b instanceof X3DObject ? gpos(b) : b);
export const siFull = (n: Node | null | undefined) => (n ? n.fullName.replace(/^Scene\.Scene_Root\./, '') : '');

/** Adds the parameter when missing (double / bool / string by JS type) and sets it. */
export function setP(n: Node, name: string, value: any) {
  if (!n.get(name)) n.add(typeof value === 'boolean' ? bool(name, value, name) : typeof value === 'string' ? str(name, value, name) : num(name, Number(value), name));
  n.set(name, value);
}
export const setPs = (n: Node, values: Record<string, any>) => { for (const [k, v] of Object.entries(values)) setP(n, k, v); };
/** Display property of an object (added when missing); `wirecol` = color index (inferred: stored in `wirecol_index`). */
export function setColor(o: X3DObject, color: number) {
  let d = o.properties.find(p => p.type === 'display');
  if (!d) { d = makeDisplay(false); o.addProperty(d); }
  setP(d, 'wirecol_index', color); d.set('wirecol', true);
}
export const colorOf = (o: X3DObject): number => Number(o.properties.find(p => p.type === 'display')?.val('wirecol_index') ?? 0);
export const setVisible = (o: X3DObject, v: boolean) => { const p = o.property('visibility')?.get('viewvis'); if (p) p.value = v; };

/** Sets the global position (parents are un-rotated, unit scale in this stand-in: inferred). */
export function setGlobalPos(o: X3DObject, at: THREE.Vector3) {
  const pg = o.parentObj ? gpos(o.parentObj) : v3();
  const l = o.kinematics.local;
  l.set('posx', at.x - pg.x); l.set('posy', at.y - pg.y); l.set('posz', at.z - pg.z);
}
/** The transform of `src` (position only in this build) applied to `o`. */
export function copyXform(o: X3DObject, src: X3DObject) { setGlobalPos(o, gpos(src)); }
export function reparent(o: X3DObject, parent: X3DObject) {
  const g = gpos(o); parent.addChild(o); setGlobalPos(o, g);
}
/** Neutral pose = the current local position. */
export function neutralPose(o: X3DObject) {
  const l = o.kinematics.local; for (const a of ['x', 'y', 'z']) l.set('npos' + a, l.val('pos' + a));
  setP(o, 'neutralpose', true);
}

// ------------------------------------------------------------------ objects
export function mkNull(app: App, name: string, parent: X3DObject | null, at?: THREE.Vector3 | X3DObject | null, size = 1, color?: number): Null {
  const n = new Null(name); addObject(app, n, parent ?? app.scene.root);
  if (at) setGlobalPos(n, at instanceof X3DObject ? gpos(at) : at);
  setP(n, 'size', size); if (color) setColor(n, color);
  return n;
}
export function mkModel(app: App, name: string, parent?: X3DObject | null): Model {
  const m = new Model(app.scene.uniqueName(name)); addObject(app, m, parent ?? app.scene.root); return m;
}
/** A curve-list object (linear or closed) through the given local points. */
export function mkCurve(app: App, name: string, parent: X3DObject | null, pts: THREE.Vector3[], opts: { degree?: number; closed?: boolean; color?: number; at?: THREE.Vector3 } = {}): X3DObject {
  const o = new X3DObject(name, 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
  const cd = pts.length >= 2 ? makeCurve(pts.map(p => [p.x, p.y, p.z] as [number, number, number]), opts.degree ?? 1, !!opts.closed) : null;
  prim.addOperator(new FrozenGeomOperator(cd, 'Curve')); o.setPrimitive(prim); o.addProperty(makeDisplay(false));
  addObject(app, o, parent ?? app.scene.root); if (opts.at) setGlobalPos(o, opts.at); if (opts.color) setColor(o, opts.color);
  return o;
}
/** Circle (closed polyline) curve with the given radius, in the XZ plane. */
export function circlePts(r: number, n = 16): THREE.Vector3[] { return Array.from({ length: n }, (_, i) => v3(Math.cos((i / n) * 6.2832) * r, 0, Math.sin((i / n) * 6.2832) * r)); }
export function boxPts(x: number, y: number, z: number): THREE.Vector3[] {
  const h = (a: number) => a / 2;
  return [v3(-h(x), -h(y), -h(z)), v3(h(x), -h(y), -h(z)), v3(h(x), -h(y), h(z)), v3(-h(x), -h(y), h(z)), v3(-h(x), -h(y), -h(z)), v3(-h(x), h(y), -h(z)), v3(h(x), h(y), -h(z)), v3(h(x), h(y), h(z)), v3(-h(x), h(y), h(z)), v3(-h(x), h(y), -h(z))];
}
/** Implicit sphere / cube object (radius or size). */
export function mkImplicit(app: App, name: string, parent: X3DObject | null, shape: 'Sphere' | 'Cube', at: THREE.Vector3, size: number, color?: number): X3DObject {
  const o = new X3DObject(name, 'implicit'); const p = new Primitive(shape, 'implicit');
  p.add(str('shape', shape, 'Shape', { readOnly: true })); p.add(num('size', size, 'Size', { min: 0.0001 })); if (shape === 'Sphere') p.add(num('radius', size, 'Radius'));
  o.setPrimitive(p); o.addProperty(makeDisplay(false));
  addObject(app, o, parent ?? app.scene.root); setGlobalPos(o, at); if (color) setColor(o, color);
  return o;
}
/** Box (Cube MeshSurface) shadow: represented as an implicit cube named after the part (stand-in). */
export function mkBox(app: App, name: string, parent: X3DObject | null, at: THREE.Vector3, size: number): X3DObject {
  const o = mkImplicit(app, name, parent, 'Cube', at, size, 479);
  return o;
}

export interface Skel { root: ChainRoot; bones: X3DObject[]; eff: X3DObject; /** root, bones..., effector (as GetSkeleton lists it) */ all: X3DObject[] }
/** 2D / 3D chain through global points; `names` = [root, bone1.., effector]. Chain scale values go in `shadow_icon`/`radius`. */
export function mkChain(app: App, names: string[], pts: THREE.Vector3[], parent: X3DObject | null, o: { type?: number; normal?: THREE.Vector3; color?: number } = {}): Skel {
  const par = parent ?? app.scene.root;
  const root = makeChain(names[0], pts.map(p => [p.x, p.y, p.z] as [number, number, number]), true);
  // makeChain builds in world space; re-express the root in the parent
  const rp = gpos(par); root.kinematics.local.set('posx', pts[0].x - rp.x); root.kinematics.local.set('posy', pts[0].y - rp.y); root.kinematics.local.set('posz', pts[0].z - rp.z);
  addObject(app, root, par);
  const bones = root.bones as X3DObject[]; const eff = root.effector as X3DObject;
  bones.forEach((b, i) => { b.name = names[1 + i] ?? b.name; });
  if (eff) eff.name = names[names.length - 1] ?? eff.name;
  const all = [root, ...bones, ...(eff ? [eff] : [])];
  for (const x of all) { setP(x, 'chntype', o.type ?? 3); if (o.color) setColor(x, o.color); }
  if (o.normal) setPs(root, { normalx: o.normal.x, normaly: o.normal.y, normalz: o.normal.z });
  return { root, bones, eff, all };
}
/** setChainScale: every element shadow_icon 1, primary_icon 0; root and effector get the end scale, bones the bone scale. */
export function setChainScale(sk: Skel, s: number, kEnd = 0.5, kBone = 1.0) {
  for (const x of sk.all) { setPs(x, { shadow_icon: 1, primary_icon: 0 }); const end = x === sk.root || x === sk.eff;
    const k = end ? kEnd : kBone; if (end) setPs(x, { shadow_scaleX: s * k, radius: s * k, shadow_scaleZ: s * k }); else setPs(x, { radius: s * k, shadow_scaleZ: s * k }); }
}

// ------------------------------------------------------------------ operators / constraints / properties
export function applyOp(app: App, obj: X3DObject, name: string, params: Record<string, any> = {}, inputs: (X3DObject | null | undefined)[] = []): Operator {
  const op = new Operator(name, 'rigop', []);
  for (const [k, v] of Object.entries(params)) op.add(typeof v === 'boolean' ? bool(k, v, k) : typeof v === 'string' ? str(k, v, k) : num(k, Number(v), k));
  (op as any).inputs = inputs.filter(Boolean); (op as any).standIn = true;
  const prim = obj.primitive;
  if (prim) { op.parent = prim; app.record('ApplyOp ' + name, () => { prim.addOperator(op); }, () => { prim.removeOperator(op); }); }
  else { op.parent = obj; const st = rigState(app); app.record('ApplyOp ' + name, () => { st.ops.push(op); ((obj as any).rigOps ??= []).push(op); }, () => { const i = st.ops.indexOf(op); if (i >= 0) st.ops.splice(i, 1); const l = (obj as any).rigOps; const k = l?.indexOf(op); if (k >= 0) l.splice(k, 1); }); }
  return op;
}
export const opsOf = (obj: X3DObject): Operator[] => [...((obj.primitive?.operators as Operator[]) ?? []), ...(((obj as any).rigOps as Operator[]) ?? [])].filter(o => (o as any).standIn);

const CNS: Record<string, [string, string]> = { Pose: ['Pose Cns', 'posecns'], Position: ['Position Cns', 'poscns'], TwoPoints: ['Two Points Cns', 'twopointscns'], BoundingVolume: ['Bounding Volume Cns', 'bndvolumecns'], Path: ['Path Cns', 'pathcns'], Orientation: ['Orientation Cns', 'oricns'], Direction: ['Direction Cns', 'dircns'] };
export function constrain(app: App, obj: X3DObject, kind: string, targets: (X3DObject | null | undefined)[], p: Record<string, any> = {}): Constraint | null {
  const t = targets.filter((x): x is X3DObject => !!x); if (!t.length) return null;
  const [label, type] = CNS[kind] ?? [kind + ' Cns', kind.toLowerCase() + 'cns'];
  const c = new Constraint(label, type, [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight')], t);
  setPs(c, p); addProperty(app, obj, c); return c;
}
export function customProp(app: App, owner: X3DObject, name: string, values: Record<string, any> = {}): Property {
  const p = new Property(name, 'customparamset', []); setPs(p, values); addProperty(app, owner, p); return p;
}
/** UpVectorReference / roll style references are stored as plain object links (inferred). */
export const link = (o: X3DObject, what: string, target: X3DObject | null | undefined) => { (o as any)[what] = target ?? null; };

// ------------------------------------------------------------------ groups ("Hidden" / "Envelope")
export function mkGroup(app: App, model: X3DObject, name: string, viewvis?: boolean): Group {
  const g = new Group(name); (g as any).rigModel = model; g.parent = app.scene as any;
  app.record('AddGroup ' + name, () => app.scene.groupList.push(g), () => { const i = app.scene.groupList.indexOf(g); if (i >= 0) app.scene.groupList.splice(i, 1); });
  if (viewvis !== undefined) setPs(g, { viewvis });
  return g;
}
/** Case-insensitive group lookup scoped to a model (`Groups.Item`). `contains` = FullName contains instead of equals. */
export function groupOf(app: App, model: X3DObject | null, name: string, contains = false): Group | null {
  const l = name.toLowerCase();
  return app.scene.groupList.find(g => (g as any).rigModel === model && (contains ? g.name.toLowerCase().includes(l) : g.name.toLowerCase() === l)) ?? null;
}
const addMembers = (g: Group, objs: X3DObject[]) => { for (const o of objs) if (!g.members.includes(o)) g.members.push(o); };
export interface HideOut { HiddenGroup: Group | null; envGroup: Group | null }
/** Standard hide setup: group `Hidden` gets the hidden objects, else viewvis false; group `Envelope_group` gets the envelope objects. */
export function hideSetup(app: App, model: X3DObject | null, hidden: X3DObject[], env: X3DObject[], shadow = false): HideOut {
  const hg = shadow ? groupOf(app, model, 'Shadow_hidden', true) ?? groupOf(app, model, 'Hidden') : groupOf(app, model, 'Hidden');
  const eg = shadow ? groupOf(app, model, 'Shadow_envelope_group', true) ?? groupOf(app, model, 'Envelope_group') : groupOf(app, model, 'Envelope_group');
  if (hg) addMembers(hg, hidden); else for (const o of hidden) setVisible(o, false);
  if (eg) addMembers(eg, env);
  return { HiddenGroup: hg, envGroup: eg };
}

// ------------------------------------------------------------------ marking sets
/** addMarkingSet: `MarkingSet` custom property, proxy params for pos/rot (keyable), optional single, `CharacterKeySet` string. */
export function markingSet(app: App, obj: X3DObject, pos: boolean, rot: boolean, single: string, keySetName: string, shadowStyle = false): Property {
  const ms = new Property('MarkingSet', 'customparamset', []); const loc = obj.kinematics.local;
  const proxy = (name: string, m: any) => { const p = ms.add(num(name, m.value, name, { keyable: true })); (p as any).proxied = m; return p; };
  const group = (axes: string[], tag: string, on: boolean) => { for (const a of axes) { const m = loc.get(tag + a); if (!m) continue; if (on) { if (!shadowStyle) m.def.keyable = true; proxy(tag + a, m); } else if (!shadowStyle) m.def.keyable = false; } };
  group(['x', 'y', 'z'], 'pos', pos); group(['x', 'y', 'z'], 'rot', rot);
  if (single) { const m = loc.get(single); if (m) { proxy(single, m); if (shadowStyle) { proxy(single, m); proxy(single, m); } } }
  if (!shadowStyle) for (const a of ['x', 'y', 'z']) { const m = loc.get('scl' + a); if (m) m.def.keyable = false; }
  ms.add(str('CharacterKeySet', keySetName, 'CharacterKeySet'));
  addProperty(app, obj, ms); return ms;
}
export const marksOf = (m: X3DObject | null): { owner: X3DObject; set: Property }[] => {
  const out: { owner: X3DObject; set: Property }[] = []; if (!m) return out;
  for (const o of [m, ...m.descendants()]) for (const p of o.properties) if (p.type === 'customparamset' && p.name.includes('MarkingSet')) out.push({ owner: o, set: p });
  return out;
};

// ------------------------------------------------------------------ guides
export interface GuideLookup { model: X3DObject | null; get(name: string): X3DObject | null; has(name: string): boolean; dups(name: string, max?: number): X3DObject[] }
export function guideLookup(model: X3DObject | null): GuideLookup {
  const find = (n: string): X3DObject | null => (model ? [...model.descendants()].find(o => o.name === n) ?? null : null);
  return { model, get: find, has: n => !!find(n),
    dups(name, max = 40) { const out: X3DObject[] = []; for (let i = 1; i <= max; i++) { const g = find(name + i); if (!g) break; out.push(g); } return out; } };
}
export function guideModels(app: App, name: string): Model | null {
  return (app.scene.root.children.find(c => c.name === name && c instanceof Model) as Model | undefined) ?? null;
}

// ------------------------------------------------------------------ arguments
export const objOf = (app: App, v: any): X3DObject | null => { const l = listOf(v); const x = l.length ? l[0] : v; return unset(x) ? null : objArg(app, x); };
export const collOf = (app: App, v: any): X3DObject[] => nodesArg(app, v).filter((n): n is X3DObject => n instanceof X3DObject);
/** Any node (e.g. a slider property page) from an argument. */
export const nodeOf = (app: App, v: any): Node | null => { const l = listOf(v); const x = l.length ? l[0] : v; return unset(x) || isEmptyGuid(x) ? null : resolve(app, x); };
export const isEmptyGuid = (v: any) => unset(v) || (typeof v === 'string' && /^\{F1D7703B/i.test(v));
export const keepObj = keep;
export const bad = (app: App, fn: string, n: number, sev: 'error' | 'info' = 'info') => app.logMsg(sev, `${fn}: argument ${n} is invalid`);
export { addObject, addProperty, int, str, bool, num };
