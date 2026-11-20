// Ledger row CMD-B18d (small Face Robot / plug-in JScript commands): helpers shared by faceRobotB18d*.ts.
// Brief: the "Wire contract" sections of docs/ghidra/cmd-b18d-fr-small-scripts.md and docs/re/WIRE_CORRECTIONS_B18.md
// items 1, 4, 9, 10, 12. Original code written from that prose only; no XSIBATCH golden exists.
//
// Mapping onto this build:
//  * Plug-in globals (the cached MeshHelper object, the AdjustPanelKeys lists, ...) live in `rowState(app, 'B18d')` of
//    the shared Face Robot store (faceRobotB14Shared.ts), so they survive between calls like a loaded script engine.
//  * `fr_sget` / `fr_sset` are the shared FR registry (same as cmd-b14a).
//  * Softimage commands a script calls are run through `call()`: a missing or failing command is logged (and traced in
//    `calls`), not thrown, unless the contract says the script stops there.
//  * Environment variables are `state.env` (FACEROBOTDATAROOT: an inferred install-relative default).
//  * siError = log kind 'error'; siWarning = an info line starting "WARNING: "; siInfo = 'info'.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B18d)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Property, Model, Null, Primitive, Cluster, Operator, makeDisplay } from '../core/scene';
import { num, bool, str, int } from '../core/params';
import { build } from '../core/geometry';
import { makeCurve, CurveData } from '../core/curves';
import { FrozenGeomOperator } from './model';
import {
  rowState, frStore, FRStore, logNya, unset, objArg, nodesArg, addObject, addProperty, propNamed, findByName, isInScene, faceModel,
} from './faceRobotB14Shared';
import { globalPos, setGlobalPos, setLocal, deleteNode, reparent } from './faceRobotB14deShared';

export { THREE, globalPos, setGlobalPos, setLocal, deleteNode, reparent, unset, objArg, nodesArg, addObject, addProperty, propNamed, findByName, faceModel };
export const ROW = 'CMD-B18d';
export const CAT = 'Custom';

export interface B18dState {
  /** MeshHelper.js plug-in global: the cached helper (starts as an empty object). */
  cached: any;
  /** AdjustPanelKeys.js plug-in globals (undefined until the first save). */
  adjust: { names: string[]; keys: number[][]; tangents: number[][] } | null;
  /** Softimage commands the scripts called (name + args), newest last. */
  calls: { name: string; args: any }[];
  env: Record<string, string>;
  /** BrushProperties stand-in (PaintGameExport). */
  brush: { WeightPaintMode?: number; Opacity?: number; Radius?: number; paintMap?: string | null; paintToolCalls: number };
  /** Inspected nodes (InspectObj / AutoInspect stand-ins). */
  inspected: Node[];
  /** Progress bar stand-in: captions, value, cancel hook. */
  progress: { captions: string[]; cancelAt?: number | null };
  /** The leaked global GetClosestHole returns on bad input. */
  leak: any;
  [k: string]: any;
}
export function b18d(app: App): B18dState {
  return rowState<B18dState>(app, 'B18d', () => ({
    cached: {}, adjust: null, calls: [], env: { FACEROBOTDATAROOT: 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\FaceRobot\\Data' },
    brush: { paintToolCalls: 0 }, inspected: [], progress: { captions: [] }, leak: undefined,
  }));
}
export const nya = (app: App, command: string, what: string) => logNya(app, command, what, ROW);
export const logErr = (app: App, text: string) => app.logMsg('error', text);
export const logInfo = (app: App, text: string) => app.logMsg('info', text);
export const logWarn = (app: App, text: string) => app.logMsg('info', 'WARNING: ' + text);

/** Run a Softimage command the way a script does; missing / failing commands are logged and traced, not thrown. */
export function call(app: App, name: string, args: Record<string, any> = {}): any {
  b18d(app).calls.push({ name, args });
  if (!app.commands.has(name)) { app.logMsg('info', `${name}: command not available in this build`); return undefined; }
  try { return app.run(name, args); } catch (e: any) { app.logMsg('info', `${name} failed: ${e?.message ?? e}`); return undefined; }
}
export function inspect(app: App, n: Node | null | undefined) {
  if (!n) return; b18d(app).inspected.push(n);
  if (app.autoInspect !== false) app.events.emit('inspect', n);
}

// ------------------------------------------------------------------ fr_sget / fr_sset (cmd-b14a)
export function sget(app: App, k1: string, k2?: string): any {
  const [sec, key] = FRStore.where(k1, k2 ?? null); return frStore(app).get(sec, key);
}
export function sset(app: App, k1: string, k2: string | null, value: any) {
  if (k2 === null) frStore(app).put('_', k1, value); else frStore(app).put(k1, k2, value);
}
/** Registry value resolved to an object in the scene (stored object or name). */
export function sgetObj(app: App, k1: string, k2?: string): X3DObject | null {
  const v = sget(app, k1, k2);
  if (v instanceof X3DObject) return isInScene(app, v) ? v : null;
  if (typeof v === 'string' && v) return findByName(app, v);
  return null;
}
/** The face model of the scripts: `fr_sget("FaceModel")`, else this build's face-model lookup. */
export const frFaceModel = (app: App): X3DObject | null => sgetObj(app, 'FaceModel') ?? faceModel(app);

// ------------------------------------------------------------------ scene helpers
export const siName = (n: Node | null | undefined) => (n ? n.fullName.replace(/^Scene\./, '').replace(/^Scene_Root\./, '') : '');
export function findChild(root: X3DObject | null | undefined, name: string): X3DObject | null {
  if (!root || !name) return null;
  for (const c of root.descendants()) if (c.name === name) return c;
  return null;
}
export const descendants = (o: X3DObject | null | undefined): X3DObject[] => (o ? [...o.descendants()] : []);
export function isCollectionLike(v: any) { return Array.isArray(v); }
/** Argument → list of nodes (array, comma string, single node); X3DObjects only. */
export function objList(app: App, v: any): X3DObject[] {
  if (unset(v) || v === '') return [];
  return nodesArg(app, v).filter((n): n is X3DObject => n instanceof X3DObject);
}
export function selection0(app: App): X3DObject | null {
  const s = app.selection[0];
  if (s instanceof X3DObject) return s;
  const cs: any = (app as any).compSel; if (cs?.obj instanceof X3DObject) return cs.obj;   // a sub-component selection → its object
  return null;
}
export function setP(n: Node, name: string, value: any, extra: Record<string, any> = {}) {
  if (!n.get(name)) n.add(typeof value === 'boolean' ? bool(name, value, name, extra) : typeof value === 'string' ? str(name, value, name, extra) : num(name, Number(value), name, extra));
  n.set(name, value);
}
export function setParamU(app: App, n: Node, name: string, value: any) {
  const p = n.get(name); if (p) app.setParam(p, value); else setP(n, name, value);
}
/** Local Display Property with a wire colour (MakeLocal + wirecol). */
export function wireColor(app: App, o: X3DObject, color: number) {
  let d = o.properties.find(p => p.type === 'display');
  if (!d) { d = makeDisplay(false); addProperty(app, o, d); }
  if (!d.get('wirecol')) d.add(int('wirecol', color, 'Wireframe Color'));
  app.setParam(d.get('wirecol')!, color);
}
export function setViewVis(app: App, o: X3DObject, v: boolean) { const p = o.property('visibility')?.get('viewvis'); if (p) app.setParam(p, v); }
export const kine = (o: X3DObject, p: string) => Number(o.kinematics.local.val(p));
export function globalSRT(o: X3DObject): Record<string, number> {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); o.globalMatrix().decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q, 'ZYX'); const r = 180 / Math.PI;
  return { sclx: s.x, scly: s.y, sclz: s.z, posx: p.x, posy: p.y, posz: p.z, rotx: e.x * r, roty: e.y * r, rotz: e.z * r };
}
/** Undoable replacement of an object's geometry by a frozen mesh. */
export function setMeshGeometry(app: App, o: X3DObject, verts: number[][], faces: number[][]) {
  const prim = o.primitive; if (!prim) return;
  const old = [...prim.operators]; const op = new FrozenGeomOperator(build(verts, faces), 'Geometry');
  app.record('Geometry.Set', () => { prim.operators.splice(0, prim.operators.length); prim.addOperator(op); prim.dirty = true; },
    () => { prim.operators.splice(0, prim.operators.length, ...old); for (const x of old) x.parent = prim; prim.dirty = true; });
}
/** FreezeObj stand-in: the construction history is collapsed into its current result. */
export function freezeObj(app: App, o: X3DObject) {
  b18d(app).calls.push({ name: 'FreezeObj', args: { InputObjs: o } });
  const m = o.primitive?.mesh(); if (!m) return;
  const verts: number[][] = []; for (let i = 0; i < m.positions.length; i += 3) verts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
  setMeshGeometry(app, o, verts, m.polygons.map(f => [...f]));
}
export function localPoints(o: X3DObject): THREE.Vector3[] {
  const m = o.primitive?.mesh(); const out: THREE.Vector3[] = []; if (!m) return out;
  for (let i = 0; i < m.positions.length; i += 3) out.push(new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
  return out;
}

/** A cube made like `fr_AddObjectInPlace("Cube", 0, parent, length, at, name, color)` (cmd-b14a). */
export function addInPlace(app: App, preset: string, type: number, parent: X3DObject | null, scale: number, at: THREE.Vector3, name: string, color: number): X3DObject {
  b18d(app).calls.push({ name: 'fr_AddObjectInPlace', args: { preset, type, name } });
  let o: any;
  try { o = app.run('fr_AddObjectInPlace', { inPreset: preset, inType: type, inParent: parent ?? undefined, inScale: scale, inVector: [at.x, at.y, at.z], inName: name, inColor: color }); } catch { o = null; }
  if (!(o instanceof X3DObject)) {   // fallback: a plain null stand-in at the position
    o = preset === 'Null' ? new Null(app.scene.uniqueName(name)) : new X3DObject(app.scene.uniqueName(name), 'polymsh');
    addObject(app, o, parent ?? app.scene.root); setGlobalPos(app, o, at); wireColor(app, o, color);
  }
  if (o.name !== name && !findByName(app, name)) o.name = name;
  return o;
}

/** A curve-list object: `curves` sub-curves (local points), each with its knots/closed flag (SI NURBS format 0). */
export function addCurveList(app: App, name: string, parent: X3DObject | null, curves: { pts: THREE.Vector3[]; degree: number; closed: boolean; knots?: number[] }[]): X3DObject {
  const o = new X3DObject(app.scene.uniqueName(name), 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
  const list: CurveData[] = curves.map(c => { const d = makeCurve(c.pts.map(p => [p.x, p.y, p.z] as [number, number, number]), c.degree, c.closed); if (c.knots) (d as any).siKnots = c.knots; return d; });
  prim.addOperator(new FrozenGeomOperator(list[0] ?? null, 'Curve')); (prim as any).curveList = list;
  o.setPrimitive(prim); o.addProperty(makeDisplay(false));
  addObject(app, o, parent ?? app.scene.root);
  return o;
}
/** Control points (local) of every sub-curve of a curve-list object, in order. */
export function curvePoints(o: X3DObject): THREE.Vector3[] {
  const list: CurveData[] = (o.primitive as any)?.curveList ?? (o.primitive?.curve() ? [o.primitive.curve()!] : []);
  return list.flatMap(c => c.cvs.map(v => new THREE.Vector3(v[0], v[1], v[2])));
}
/** A vertex cluster `name` with the given elements; `center` = the centre reference object (stand-in field). */
export function addPointCluster(app: App, o: X3DObject, name: string, elements: number[], center?: X3DObject | null): Cluster {
  const c = new Cluster(name, 'pnt', new Set(elements)); if (center) (c as any).centerReference = center;
  app.record('AddCluster', () => o.addCluster(c), () => o.removeCluster(c)); return c;
}
export function customProperty(app: App, owner: X3DObject, name: string, defs: any[]): Property {
  return addProperty(app, owner, new Property(name, 'customparamset', defs));
}
/** A scripted-operator stand-in (name, type, inputs, parameters) on an object's primitive (or on the object). */
export function scriptedOp(app: App, owner: X3DObject, name: string, inputs: any[], params: any[] = [], extra: Record<string, any> = {}): Operator {
  const op = new Operator(name, name, params); Object.assign(op as any, { scripted: true, inputs, ...extra });
  const prim: any = owner.primitive;
  if (prim) app.record('AddScriptedOp ' + name, () => { prim.operators.push(op); op.parent = prim; }, () => { const i = prim.operators.indexOf(op); if (i >= 0) prim.operators.splice(i, 1); op.parent = null; });
  else { const l = ((owner as any).scriptedOps ??= []); app.record('AddScriptedOp ' + name, () => { l.push(op); op.parent = owner; }, () => { const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); }); }
  return op;
}
export const scriptedOpsOf = (o: X3DObject): Operator[] => [...((o.primitive?.operators ?? []) as Operator[]).filter(x => (x as any).scripted), ...(((o as any).scriptedOps ?? []) as Operator[])];

/** Weight map named `name` on any point cluster of `o` (types weightmap / wtmap). */
export function weightMapNamed(o: X3DObject, name: string): Property | null {
  for (const c of o.clusters) for (const p of c.properties) if (p.name === name && (p.type === 'weightmap' || p.type === 'wtmap')) return p;
  return null;
}
/** CreateWeightMap stand-in: a complete point cluster `cluster` (reused) holding a new weight map `name`. */
export function createWeightMap(app: App, o: X3DObject, clusterName: string, name: string): Property {
  b18d(app).calls.push({ name: 'CreateWeightMap', args: { cluster: clusterName, name } });
  const n = (o.primitive?.mesh()?.positions.length ?? 0) / 3;
  let cl = o.clusters.find(c => c.name === clusterName && c.compKind === 'pnt') ?? null;
  if (!cl) cl = addPointCluster(app, o, clusterName, Array.from({ length: n }, (_, i) => i));
  const p = new Property(name, 'weightmap', [num('weight', 0, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable'),
    int('red', 255, 'Red', { min: 0, max: 255 }), int('green', 255, 'Green', { min: 0, max: 255 }), int('blue', 255, 'Blue', { min: 0, max: 255 })]);
  (p as any).values = new Map<number, number>(); const c = cl;
  app.record('CreateWeightMap', () => c.addProperty(p), () => c.removeProperty(p));
  return p;
}
export const weightOf = (map: Property | null, i: number): number => (map ? Number((map as any).values?.get(i) ?? map.val('weight') ?? 0) : 0);

// ------------------------------------------------------------------ fcurves (AddFCurve2 / SetKeyTangents stand-ins)
/** Replaces the parameter's curve by keys given as a flat (time, value) list; returns the curve. */
export function addFCurve2(app: App, p: any, flat: number[]) {
  const fc = app.anim.fcurve(p, true)!; const old = fc.keys.map(k => ({ ...k }));
  const keys: any[] = []; for (let i = 0; i + 1 < flat.length; i += 2) keys.push({ time: flat[i], value: flat[i + 1], left: flat[i + 1], right: flat[i + 1], interp: fc.interp });
  keys.sort((a, b) => a.time - b.time);
  app.record('AddFCurve', () => { fc.keys = keys.map(k => ({ ...k })); }, () => { fc.keys = old.map(k => ({ ...k })); });
  return fc;
}
/** Key tangents as a flat (left dx, left dy, right dx, right dy) list, one quadruple per key. */
export function setKeyTangents(app: App, fc: any, flat: number[]) {
  const old = fc.keys.map((k: any) => ({ ...k }));
  app.record('SetKeyTangents', () => { fc.keys.forEach((k: any, i: number) => { if (4 * i + 3 < flat.length) Object.assign(k, { leftTanX: flat[4 * i], leftTanY: flat[4 * i + 1], rightTanX: flat[4 * i + 2], rightTanY: flat[4 * i + 3] }); }); },
    () => { fc.keys = old.map((k: any) => ({ ...k })); });
}
export const keyTangents = (k: any): number[] => [Number(k.leftTanX ?? -1 / 3), Number(k.leftTanY ?? 0), Number(k.rightTanX ?? 1 / 3), Number(k.rightTanY ?? 0)];

// ------------------------------------------------------------------ user keywords (Utilities.js §3)
/** The keyword tokens of a node (GetUserKeyword): the stored comma text, empty tokens dropped. */
export const keywordTokens = (o: object): string[] => String((o as any).userKeywords ?? '').split(',').filter(s => s !== '');
export { Model, X3DObject, Node, Property, Primitive, Cluster, Operator, Null };
