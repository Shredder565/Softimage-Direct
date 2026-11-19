// Ledger rows CMD-B14b / CMD-B14c (Face Robot `FR.dll`): helpers shared by the sculpt / mouth commands
// (faceRobotB14b.ts) and the eyes / jaw / region commands (faceRobotB14c*.ts). Briefs:
// docs/ghidra/cmd-b14b-fr-sculpt-mouth.md and docs/ghidra/cmd-b14c-fr-eyes-jaw-regions.md (prose contracts).
// Original code written from that prose only; no XSIBATCH golden exists. The process-wide FR registry lives in
// faceRobotB14Shared.ts (FRStore); this file only adds row-local stand-ins.
//
// Stand-ins (no desktop object model for these views in this build):
//  * `desktop`: the active layout name, its views (name -> { type, attrs }), camera-visibility values written through
//    `Views.ViewB.<camera>.camvis.<attr>`, the InspectObj calls made, the active tool name.
//  * Stand-in FR operators (`FROp`) are Operator nodes on the mesh primitive that pass the geometry through; the
//    cluster they act on and their input-port targets (by index) are fields.
//  * The status of commands that end with a non-failure status (S_FALSE) is kept in `frState(app).rows.lastStatusB14bc`.
import { App } from '../core/commands';
import { Operator, Cluster, Material, Shader, Model, makePhong, makeLambert } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import { build } from '../core/geometry';
import { FrozenGeomOperator } from './model';
import {
  frState, frStore, rowState, findByName, faceModel, buildSampleFace, addObject, addProperty, propNamed, meshObject, meshOf,
  ensureGroup, addToGroup, X3DObject, Node, Property, unset, resolve,
} from './faceRobotB14Shared';

export const ROW_B = 'CMD-B14b', ROW_C = 'CMD-B14c';
export const E_UNEXPECTED = 0x8000ffff;

// ------------------------------------------------------------------ status
export function setStatus(app: App, command: string, status: number) { frState(app).rows.lastStatusB14bc = { command, status }; }

// ------------------------------------------------------------------ desktop stand-in
export interface FRDesktop {
  layout: string;
  views: Map<string, { type: string; attrs: Record<string, any> }>;
  camvis: Map<string, boolean>;
  inspected: { command: string; target: string; mode: number }[];
  tool: string;
  selToolValue: number | null;
  hooks: { cancelProgress?: (caption: string, step: number) => boolean };
}
export function frDesktop(app: App): FRDesktop {
  return rowState<FRDesktop>(app, 'desktopB14bc', () => ({
    layout: 'Default',
    // inferred: the main view manager of the default layout, view B on the User camera
    views: new Map([['frmviewmanager', { type: 'View Manager', attrs: { 'activecamera:b': 'User' } as Record<string, any> }]]),
    camvis: new Map(), inspected: [], tool: '', selToolValue: null, hooks: {},
  }));
}
export const targetText = (t: string | Node) => (typeof t === 'string' ? t : t.fullName);
/** `InspectObj(target, "", "", mode, False)`. */
export function inspectObj(app: App, command: string, target: string | Node, mode: number) {
  const d = frDesktop(app); const t = targetText(target);
  d.inspected.push({ command, target: t, mode });
  app.logMsg('info', `InspectObj("${t}", "", "", ${mode}, False)`);
  if (mode === 1 && target instanceof Node && app.autoInspect) app.events.emit('inspect', target);
}
/** The `stage6ppg` view of the active layout when that layout is `Face Robot` (cmd-b14c §2.2). */
export function stage6ppg(app: App) { const d = frDesktop(app); return d.layout === 'Face Robot' ? d.views.get('stage6ppg') ?? null : null; }
/** PPG routing (cmd-b14c §2.2): `stage6ppg.targetcontent` = target, or InspectObj mode 1. */
export function showPPG(app: App, command: string, target: string | Node) {
  const v = stage6ppg(app);
  if (v) { v.attrs.targetcontent = targetText(target); app.logMsg('info', `${command}: stage6ppg.targetcontent = ${targetText(target)}`); }
  else inspectObj(app, command, target, 1);
}
export function selectObj(app: App, nodes: Node[]) { app.select(nodes.filter(Boolean)); }

// ------------------------------------------------------------------ preferences
export function userPref(app: App, name: string, dflt: any): any {
  const bag: Record<string, any> = (app as any).userPrefs ?? {}; const k = Object.keys(bag).find(x => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? dflt : bag[k];
}
export function setUserPref(app: App, name: string, value: any) {
  const a: any = app; a.userPrefs ??= {}; const bag = a.userPrefs; const old = bag[name], had = name in bag;
  app.record('SetUserPref ' + name, () => { bag[name] = value; }, () => { if (had) bag[name] = old; else delete bag[name]; });
}

// ------------------------------------------------------------------ objects
export function deleteObj(app: App, o: X3DObject) {
  const p = o.parentObj; if (!p) return;
  const groups = app.scene.groupList.filter(g => g.members.includes(o));
  app.record('DeleteObj ' + o.name, () => { p.removeChild(o); for (const g of groups) { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); } },
    () => { p.addChild(o); for (const g of groups) if (!g.members.includes(o)) g.members.push(o); });
}
export function reparent(app: App, o: X3DObject, np: X3DObject) {
  const op = o.parentObj; if (op === np) return;
  app.record('ParentObj', () => np.addChild(o), () => { if (op) op.addChild(o); else np.removeChild(o); });
}
export function rename(app: App, n: Node, name: string) { const old = n.name; app.record('Rename', () => { n.name = name; }, () => { n.name = old; }); }
export function removeProp(app: App, owner: X3DObject | Cluster, p: Property) {
  app.record('DeleteObj ' + p.name, () => owner.removeProperty(p), () => owner.addProperty(p));
}
export function addClusterProp(app: App, c: Cluster, p: Property) { app.record('AddProp', () => c.addProperty(p), () => c.removeProperty(p)); return p; }
/** A polygon-mesh copy of `src`'s current geometry (the native Duplicate / Clone are not modelled here). */
export function duplicateMesh(app: App, src: X3DObject, name: string, parent: X3DObject | null): X3DObject | null {
  const m = meshOf(src); if (!m) return null;
  const verts: number[][] = []; for (let i = 0; i < m.positions.length; i += 3) verts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
  const o = meshObject(app, name, verts, m.polygons.map(f => [...f])); o.name = name;
  addObject(app, o, parent); return o;
}
/** Replace the points of a frozen mesh (undoable). */
export function setMeshPoints(app: App, o: X3DObject, positions: Float32Array) {
  const prim = o.primitive; const m = meshOf(o); if (!prim || !m) return;
  const verts: number[][] = []; for (let i = 0; i < positions.length; i += 3) verts.push([positions[i], positions[i + 1], positions[i + 2]]);
  const nop = new FrozenGeomOperator(build(verts, m.polygons.map(f => [...f])), 'Geometry');
  const old = [...prim.operators];
  app.record('Translate', () => { prim.operators.splice(0, prim.operators.length, nop, ...old.slice(1)); nop.parent = prim; prim.dirty = true; },
    () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
}
export function setVal(app: App, ps: Node | Property, name: string, v: any) { const p = ps.get(name); if (p) app.setParam(p, v); }
export function objOrName(app: App, v: any): X3DObject | null {
  if (unset(v)) return null; if (v instanceof X3DObject) return v;
  const n = resolve(app, v); return n instanceof X3DObject ? n : findByName(app, String(v));
}

// ------------------------------------------------------------------ stand-in FR operators
export class FROp extends Operator {
  /** The cluster the operator acts on. */
  cluster: Cluster | null = null;
  /** Input-port targets by index (cmd-b14c §3 fr_MapRegion step 3). */
  inputs: any[] = [];
  /** Named port connections (scripted / generated operators). */
  ports: Record<string, Record<string, any>> = {};
  muted = false;
  constructor(name: string, type: string, defs: any[] = []) { super(name, type, defs); }
}
export function addOp(app: App, o: X3DObject, op: Operator) {
  const prim = o.primitive; if (!prim) return op;
  app.record('ApplyOp ' + op.type, () => prim.addOperator(op), () => prim.removeOperator(op));
  return op;
}
export const opsOf = (o: X3DObject | null): Operator[] => (o?.primitive?.operators ?? []);
/** The first operator of `types` (in that order) acting on cluster `c`. */
export function clusterOp(o: X3DObject, c: Cluster, types: string[]): FROp | null {
  for (const t of types) { const op = opsOf(o).find(x => x instanceof FROp && x.cluster === c && x.type === t); if (op) return op as FROp; }
  return null;
}
export const pntClusters = (o: X3DObject) => o.clusters.filter(c => c.compKind === 'pnt');

// ------------------------------------------------------------------ shaders / materials
/** The material in effect (local, else inherited up to the scene root). */
export function materialOf(o: X3DObject): Material | null { let n: X3DObject | null = o; while (n) { if (n.material) return n.material; n = n.parentObj; } return null; }
export function rgbOf(v: any): number[] | null {
  if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(x => Number.isFinite(Number(x)))) return v.map(Number);
  return null;
}
export function shaderColor(s: Shader | null, name: string): number[] | null { return s ? rgbOf(s.val(name)) : null; }
export function setShaderColor(app: App, s: Shader, name: string, c: number[]) { const p = s.get(name); if (p) app.setParam(p, c.slice()); }
/** RGB -> hue / lightness / saturation (the standard HLS model). */
export function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, l, 0];
  const d = mx - mn; const s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
  let h = mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d; h *= 60; if (h < 0) h += 360;
  return [h, l, s];
}
export function hlsToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2;
  const v = (hh: number) => { hh = ((hh % 360) + 360) % 360; if (hh < 60) return m1 + (m2 - m1) * hh / 60; if (hh < 180) return m2; if (hh < 240) return m1 + (m2 - m1) * (240 - hh) / 60; return m1; };
  return [v(h + 120), v(h), v(h - 120)];
}
export { makePhong, makeLambert };

// ------------------------------------------------------------------ progress
export function progressCancelled(app: App, caption: string, step: number) { return !!frDesktop(app).hooks.cancelProgress?.(caption, step); }

// ------------------------------------------------------------------ sample scene (check scripts)
const REGION_DEFS = () => [num('Strength', 1, 'Strength'), num('Bulge', 0.5, 'Bulge'), num('EaseIn', 1, 'EaseIn'), num('BaseLength', 1, 'BaseLength'),
  num('BaseMultiplier', 1, 'BaseMultiplier'), num('BaseDistance', 1, 'BaseDistance'), num('BaseXOffset', 0, 'BaseXOffset'), num('Multiplier', 1, 'Multiplier'),
  num('Puff', 0.5, 'Puff'), num('Tendon', 0.5, 'Tendon')];
/** buildSampleFace plus, on `FaceMesh`: a local Phong material, pnt clusters `LBrow_Region1` / `RBrow_Region1` /
 *  `ChinForm_Region1` with `fro_RegionOp`, `LCheek_Puffer` / `RCheek_Puffer` with `fro_PufferOp`, `LNeck_Tendon` /
 *  `RNeck_Tendon` with `fro_TendonOp`, `LEyelid_Region` / `REyelid_Region` with `fro_EyelidOp`, a `FaceRegionProperties`
 *  set per region cluster, a `fro_FacialSoftTissueOp` face deformer, and model properties `FaceScale`, `BlinkProperties`,
 *  `EyeProperties`. Original sample; values are arbitrary. */
export function buildSampleRegions(app: App) {
  const { model, mesh } = buildSampleFace(app);
  if (mesh.clusters.some(c => c.name === 'LBrow_Region1')) return { model, mesh };
  if (!mesh.material) { const m = new Material('FaceMaterial'); m.setSurface(makePhong('Phong')); mesh.setMaterial(m); }
  const n = (meshOf(mesh)?.positions.length ?? 0) / 3; const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(meshOf(mesh)!.positions[i * 3]);
  const L = [...Array(n).keys()].filter(i => xs[i] > 0), R = [...Array(n).keys()].filter(i => xs[i] < 0), C = [...Array(n).keys()].filter(i => xs[i] === 0);
  const mk = (name: string, idx: number[], type: string) => {
    const c = new Cluster(name, 'pnt', new Set(idx)); mesh.addCluster(c);
    const op = new FROp(type, type, REGION_DEFS()); op.cluster = c; mesh.primitive!.addOperator(op);
    if (type === 'fro_RegionOp') {
      const fr = new Property('FaceRegionProperties', 'customparamset', faceRegionDefs()); c.addProperty(fr); op.inputs[9] = 'WrinkleMap'; void fr;
      const perc = new Property('Perc', 'weightmap', [num('min', 0, 'Minimum'), num('max', 1, 'Maximum')]); (perc as any).values = new Map(idx.map(i => [i, 1])); c.addProperty(perc);
      op.inputs[8] = perc; op.inputs[2] = name + '_Curve'; op.inputs[3] = name + '_Slider';
    }
    if (type === 'fro_TendonOp') { op.inputs[2] = name + '_Control'; op.inputs[4] = name + '_Slider'; op.inputs[3] = 'BaseState'; }
    return op;
  };
  mk('LBrow_Region1', L, 'fro_RegionOp'); mk('RBrow_Region1', R, 'fro_RegionOp'); mk('ChinForm_Region1', C, 'fro_RegionOp');
  mk('LCheek_Puffer', L, 'fro_PufferOp'); mk('RCheek_Puffer', R, 'fro_PufferOp');
  mk('LNeck_Tendon', L, 'fro_TendonOp'); mk('RNeck_Tendon', R, 'fro_TendonOp');
  mk('LEyelid_Region', L, 'fro_EyelidOp'); mk('REyelid_Region', R, 'fro_EyelidOp');
  mesh.primitive!.addOperator(new FROp('FacialSoftTissue', 'fro_FacialSoftTissueOp'));
  model.addProperty(new Property('FaceScale', 'customparamset', [num('Scale', 1, 'Scale')]));
  model.addProperty(new Property('BlinkProperties', 'customparamset', [num('Blink', 0, 'Blink')]));
  model.addProperty(new Property('EyeProperties', 'customparamset', [num('Squint', 0, 'Squint')]));
  return { model, mesh };
}
/** FaceRegionProperties (cmd-b14c §2.3). The Bulge / EaseIn default curves are not attested (Q5): FCurve parameters are
 *  kept as JSON key lists. */
export function faceRegionDefs() {
  return [num('Strength', 0.5, 'Strength', { min: 0, max: 200, uimin: 0, uimax: 2 }), str('Bulge', '[]', 'Bulge', { desc: 'FCurve' }),
    str('EaseIn', '[]', 'EaseIn', { desc: 'FCurve' }), bool('RecalculatePaint', true, 'Recalculate Paint')];
}
export { frStore, findByName, faceModel, addObject, addProperty, propNamed, ensureGroup, addToGroup, Model, int, bool, str, num };
