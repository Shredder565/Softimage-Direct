// Ledger rows CMD-B14d / CMD-B14e (Face Robot `FR.dll`): helpers shared by the retarget / mocap / stage commands
// (faceRobotB14d*.ts) and the export / weights / tongue commands (faceRobotB14e*.ts).
// Briefs: docs/ghidra/cmd-b14d-fr-retarget-mocap.md, docs/ghidra/cmd-b14e-fr-export-weights.md and
// docs/re/WIRE_CORRECTIONS_B14.md items 1-7. Original code written from that prose only; no XSIBATCH golden exists.
//
// Row-local state lives in `rowState(app, 'B14d' | 'B14e')` of the shared FR store (faceRobotB14Shared.ts):
//  * `lastStatus[command]`: success statuses (S_OK 0 / S_FALSE 1); failures are thrown as SiStatusError.
//  * `views`: Property Panel views the commands opened (name, targetcontent, position, width).
//  * `calls`: Softimage commands the FR command wrappers ran (name + args), newest last.
//  * `hooks.inspect`: answer of a modal InspectObj (true = OK). Without a hook the dialog is logged and cancelled.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Property, Operator, Cluster, Group } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import { attribute, writeAttribute } from './uiGroupViewTasks';
import {
  rowState, frStore, faceModel, findByName, entryObject, logNya, propNamed, addProperty, isInScene, frState,
} from './faceRobotB14Shared';

export const ROW_D = 'CMD-B14d', ROW_E = 'CMD-B14e';
export const CAT = 'Face Robot';

export interface PanelView { type: string; name: string; targetcontent: string; x: number; y: number; width: number; refresh?: boolean; visible?: boolean | null }
export interface DEState {
  lastStatus: Record<string, number>;
  views: PanelView[];
  calls: { name: string; args: Record<string, any> }[];
  hooks: { inspect?: (command: string, prop: Property, title: string) => boolean | undefined };
  /** Stand-in for the `Face Robot` layout of facerobot.xsily (the Control Panel tray in this build). */
  layoutPresent: boolean;
  activeLayout: string;
  putActiveLayoutCalls: number;
  [k: string]: any;
}
export function de(app: App, row: 'B14d' | 'B14e'): DEState {
  return rowState<DEState>(app, row, () => ({
    lastStatus: {}, views: [], calls: [], hooks: {}, layoutPresent: true, activeLayout: '', putActiveLayoutCalls: 0,
  }));
}
export function setStatus(app: App, row: 'B14d' | 'B14e', command: string, s: number) { de(app, row).lastStatus[command] = s; }
export const nyaD = (app: App, command: string, what: string) => logNya(app, command, `${what}`, ROW_D);
export const nyaE = (app: App, command: string, what: string) => logNya(app, command, `${what}`, ROW_E);

// ------------------------------------------------------------------ command wrappers
/** Run a Softimage command by name the way the FR wrappers do; a failing or missing command is logged, not thrown. */
export function wrap(app: App, row: 'B14d' | 'B14e', name: string, args: Record<string, any> = {}): any {
  de(app, row).calls.push({ name, args });
  if (!app.commands.has(name)) { app.logMsg('info', `${name}: command not available in this build`); return undefined; }
  try { return app.run(name, args); } catch (e: any) { app.logMsg('info', `${name} failed: ${e?.message ?? e}`); return undefined; }
}

// ------------------------------------------------------------------ deletion (DeleteObj on any node)
export function ownerOf(n: Node): X3DObject | Cluster | null {
  const p: any = (n as any).parent;
  return p instanceof X3DObject || p instanceof Cluster ? p : null;
}
export function deleteNode(app: App, n: Node | null | undefined) {
  if (!n) return;
  if (n instanceof X3DObject) {
    const p = n.parentObj; if (!p) return; const idx = p.children.indexOf(n);
    app.record('Delete ' + n.name, () => p.removeChild(n), () => { p.addChild(n); p.children.splice(p.children.indexOf(n), 1); p.children.splice(idx, 0, n); });
    for (const g of app.scene.groupList) { const i = g.members.indexOf(n); if (i >= 0) app.record('RemoveFromGroup', () => g.members.splice(g.members.indexOf(n), 1), () => g.members.splice(i, 0, n)); }
    if (app.selection.includes(n)) app.select(app.selection.filter(x => x !== n));
  } else if (n instanceof Property) {
    const o = ownerOf(n); if (!o) return;
    app.record('Delete ' + n.name, () => o.removeProperty(n), () => o.addProperty(n));
  } else if (n instanceof Operator) {
    const prim: any = (n as any).parent; if (!prim?.operators) return; const i = prim.operators.indexOf(n);
    app.record('Delete ' + n.name, () => prim.removeOperator(n), () => { prim.operators.splice(i, 0, n); n.parent = prim; prim.dirty = true; });
  } else if (n instanceof Cluster) {
    const o = n.obj; if (!o) return;
    app.record('Delete ' + n.name, () => o.removeCluster(n), () => o.addCluster(n));
  } else if (n instanceof Group) {
    const i = app.scene.groupList.indexOf(n); if (i < 0) return;
    app.record('Delete ' + n.name, () => app.scene.groupList.splice(app.scene.groupList.indexOf(n), 1), () => app.scene.groupList.splice(i, 0, n));
  }
}

// ------------------------------------------------------------------ transforms
export function globalPos(o: X3DObject): THREE.Vector3 { return new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); }
export function setLocal(app: App, o: X3DObject, p: string, v: number) { const q = o.kinematics.local.get(p); if (q) app.setParam(q, v); }
/** Move an object so that its global translation is `v` (rotation and scaling are kept). */
export function setGlobalPos(app: App, o: X3DObject, v: THREE.Vector3) {
  const pg = o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
  const l = v.clone().applyMatrix4(pg.clone().invert());
  setLocal(app, o, 'posx', l.x); setLocal(app, o, 'posy', l.y); setLocal(app, o, 'posz', l.z);
}
/** Set an object's global transform (decomposed into its local SRT). */
export function setGlobalMatrix(app: App, o: X3DObject, g: THREE.Matrix4) {
  const pg = o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
  const l = pg.clone().invert().multiply(g); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  l.decompose(p, q, s); const e = new THREE.Euler().setFromQuaternion(q, 'ZYX'); const r = 180 / Math.PI;
  setLocal(app, o, 'posx', p.x); setLocal(app, o, 'posy', p.y); setLocal(app, o, 'posz', p.z);
  setLocal(app, o, 'rotx', e.x * r); setLocal(app, o, 'roty', e.y * r); setLocal(app, o, 'rotz', e.z * r);
  setLocal(app, o, 'sclx', s.x); setLocal(app, o, 'scly', s.y); setLocal(app, o, 'sclz', s.z);
}
export function reparent(app: App, o: X3DObject, parent: X3DObject) {
  const old = o.parentObj; if (old === parent) return; const idx = old ? old.children.indexOf(o) : -1;
  app.record('ParentObj', () => parent.addChild(o), () => { if (old) { old.addChild(o); old.children.splice(old.children.indexOf(o), 1); old.children.splice(idx, 0, o); } else parent.removeChild(o); });
}

// ------------------------------------------------------------------ user keywords
export const keywordsOf = (o: object): string[] => String(attribute(o, 'userKeywords') ?? '').split(',').map(s => s.trim()).filter(Boolean);
export function setKeywords(app: App, o: X3DObject, text: string) {
  if (app.commands.has('SetUserKeyword')) { try { app.run('SetUserKeyword', { InputObjs: [o], Keywords: text }); return; } catch { /* fall through */ } }
  writeAttribute(app, 'SetUserKeyword', 'userKeywords', [o], () => text);
}
/** fr_GetKeyed_safe stand-in (inferred): the objects of the scene whose user keywords contain every word. */
export function getKeyed(app: App, words: string[]): X3DObject[] {
  const want = words.map(w => w.toLowerCase());
  const out: X3DObject[] = [];
  for (const o of app.scene.allObjects()) { const k = keywordsOf(o).map(s => s.toLowerCase()); if (want.every(w => k.includes(w))) out.push(o); }
  return out;
}

// ------------------------------------------------------------------ controls
/** The registry `controls` list resolved to objects; when the registry has none, the face model's `*_Control` objects (inferred). */
export function controlsList(app: App): X3DObject[] {
  const keys = frStore(app).keys('controls'); const out: X3DObject[] = [];
  for (const k of keys) { const o = entryObject(app, 'controls', k); if (o && !out.includes(o)) out.push(o); }
  if (out.length) return out;
  const m = faceModel(app); if (!m) return out;
  for (const o of m.descendants()) if (/_Control$/.test(o.name)) out.push(o);
  return out;
}
export function controlNamed(app: App, name: string): X3DObject | null {
  return entryObject(app, 'controls', name) ?? (() => { const m = faceModel(app); if (!m) return null; for (const o of m.descendants()) if (o.name === name) return o; return null; })();
}
/** Registry single-key object (section "_"). */
export function namedObject(app: App, key: string): X3DObject | null { return entryObject(app, '_', key) ?? null; }

// ------------------------------------------------------------------ Property Panel views
/** The panel-opening pattern of cmd-b14d §2.2: close the other Face Robot panels (inferred), reuse a Property Panel
 *  whose targetcontent is the property, otherwise create one, move it and resize it to width 400. */
export const FR_PANEL_PROPS = ['FaceAdjustProperties', 'FaceCalibrateProperties', 'FacePlotProperties', 'FacialMocapTools'];
export function openPanel(app: App, row: 'B14d' | 'B14e', command: string, prop: Property, viewName: string, ox: number, oy: number): PanelView {
  const st = de(app, row);
  st.views = st.views.filter(v => v.targetcontent === prop.fullName || !FR_PANEL_PROPS.some(n => v.targetcontent.endsWith('.' + n)));
  let v = st.views.find(x => x.type === 'Property Panel' && x.targetcontent === prop.fullName);
  if (!v) {
    v = { type: 'Property Panel', name: viewName, targetcontent: prop.fullName, x: ox, y: oy, width: 400 };
    st.views.push(v);
    nyaD(app, command, 'Property Panel height passed to Resize');
  }
  app.events.emit('inspect', prop);
  return v;
}

// ------------------------------------------------------------------ custom properties (cmd-b14d §2.6)
const P4 = {};   // capability 4 = siPersistable (the default of this build's parameters)
export function facePlotDefs() {
  return [
    int('Start', 0, 'Start', P4), int('End', 100, 'End', P4), int('IntervalStep', 4, 'IntervalStep', { min: 1, max: 100, uimin: 1, uimax: 10 }),
    bool('PlotToActionClip', false, 'PlotToActionClip', { desc: 'Stores the plotted mocap as a clip in the mixer and deletes animation from controls' }),
    bool('SplitTracks', false, 'SplitTracks', { desc: 'After applying the clip, performs a Split in Space operation to create individual tracks for lips, jaw, tongue, and face that are then compounded into one clip in the mixer' }),
  ];
}
export const CALIB_AREAS = ['DownLLip', 'DownULip', 'DownJaw', 'DownNose', 'DownEyes', 'UpLLip', 'UpULip', 'UpJaw', 'UpNose', 'UpEyes'];
export function faceCalibrateDefs() {
  const d: any[] = [];
  for (const a of CALIB_AREAS) {
    d.push(num(`${a}Scale`, 1.0, '', { min: 0, max: Number.MAX_VALUE, uimin: 0, uimax: 1.5, desc: '' }));
    d.push(num(`${a}Pitch`, 0.0, '', { min: -180, max: 180, uimin: -30, uimax: 30, desc: '' }));
  }
  d.push(bool('OldFormat', true, ''));
  return d;
}
export function findOrAddProp(app: App, owner: X3DObject, name: string, defs: () => any[]): Property {
  return propNamed(owner, name) ?? addProperty(app, owner, new Property(name, 'customparamset', defs()));
}
export function userDataBlob(app: App, owner: X3DObject, name: string, data: any): Property {
  const p = new Property(name, 'UserDataBlob', []); (p as any).data = data; return addProperty(app, owner, p);
}

// ------------------------------------------------------------------ retarget blob (cmd-b14d fr_WriteC3D, cmd-b14e §2 retarget mute)
/** The face-model UserDataBlob named by global 0x1802d2600 holds the retarget data: `CDKFaceRetargetOp`
 *  (WIRE_CORRECTIONS_B15 item 1). Its byte layout is not attested; this build keeps a `retarget` record as its payload. */
export const RETARGET_BLOB = 'CDKFaceRetargetOp';
export interface RetargetData { start: number; count: number; muted: boolean; c3dfile: string; fmap: string }
export function retargetBlob(app: App, model: X3DObject | null = faceModel(app)): Property | null {
  if (!model) return null;
  return model.properties.find(p => p.type === 'UserDataBlob' && p.name === RETARGET_BLOB) ?? model.properties.find(p => p.type === 'UserDataBlob' && (p as any).data?.retarget) ?? null;
}
export const retargetData = (p: Property | null): RetargetData | null => (p ? (p as any).data?.retarget ?? null : null);

/** Retarget mute (cmd-b14e §2, `0x1801602d0`): false when the blob is missing; otherwise switches the state and reports
 *  the previous one; when muting, zeroes local SRT translation/rotation of retargeted objects and `*_ControlOffset`. */
export function retargetMute(app: App, mute: boolean): { ok: boolean; previous: boolean } {
  const b = retargetBlob(app); const d = retargetData(b);
  if (!d) return { ok: false, previous: false };
  const previous = d.muted; d.muted = mute;
  if (mute) {
    const m = faceModel(app);
    for (const o of m ? [m, ...m.descendants()] : []) {
      const retargeted = (o as any).retargetOps?.some((t: string) => t === 'fro_FaceRetargetOp2' || t === 'fro_FaceRetargetLocalOp');
      if (retargeted || o.name.includes('_ControlOffset')) for (const p of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz']) setLocal(app, o, p, 0);
    }
  }
  return { ok: true, previous };
}

// ------------------------------------------------------------------ misc
export function fitNull(app: App): X3DObject | null { return namedObject(app, 'Fit') ?? (() => { const m = faceModel(app); if (!m) return null; for (const o of m.descendants()) if (o.name === 'Fit') return o; return null; })(); }
export const isValidObj = (app: App, o: any): o is X3DObject => o instanceof X3DObject && isInScene(app, o);
export { frState, findByName };
/** Localized text of a key (views\FR.en-us.txt); the key itself when the table does not have it. */
export const locText = (app: App, key: string) => frStore(app).loc(key) || key;
