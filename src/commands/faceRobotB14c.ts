// Ledger row CMD-B14c (Face Robot `FR.dll`), part 1: face controls, face structure, eyeball / eye rig / eyelids, PPG
// commands (eyes, jaw). Part 2 (maps, region paint, stress, normal map, region masks, tongue) is faceRobotB14cMaps.ts.
//   AddFaceControl MakeFaceStructure fr_MakeEyeBall MakeEyeRig MakeEyelids RegenerateEyelids fr_GetEyelashMedian
//   fr_AnimateEyes fr_EyelidsDeformCurves fr_EyelidsInfluenceMaps fr_JawUpperDeflation fr_JawLowerDeflation
//   fr_JawDeflationEaseInCurves fr_JawSlidingEaseInCurves fr_JawSliding fr_JawFattening
// Brief: docs/ghidra/cmd-b14c-fr-eyes-jaw-regions.md ("Shared facts" and "Contracts"). Original code written from that
// prose only; no XSIBATCH golden exists. Items the note marks (inferred) are wired as stated; branches the analyst did
// not read log "<command>: not yet attested: <what> (CMD-B14c)".
//
// Mapping onto this build: null size / display value / wire colour of AddFaceControl are fields of the null
// (`nullSize`, `displayValue`, `wireColor`; nulls have no primitive here); user keywords are the `userKeywords` field
// (the convention of uiGroupViewTasks.ts); FCurve parameters of the custom properties are JSON key lists.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Null, Model, Cluster } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import {
  frStore, faceModel, faceMesh, findByName, childNamed, activeFaceRobotProp, failLog, logNya, progress, numArg, intArg, boolArg, nodesArg,
  addObject, addProperty, propNamed, meshObject, meshOf, ensureGroup, addToGroup, X3DObject, Property, unset, E_FAIL, DISP_E_MEMBERNOTFOUND,
} from './faceRobotB14Shared';
import { ROW_C, showPPG, inspectObj, objOrName, rename, FROp, addOp, makePhong } from './faceRobotB14bcShared';
import { Material } from '../core/scene';
import { registerFaceRobotB14cMapCommands } from './faceRobotB14cMaps';

const NYA = (app: App, c: string, what: string) => logNya(app, c, what, ROW_C);

export function vec3(v: any): [number, number, number] {
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { const x = Array.from(v as any, Number); return [x[0] || 0, x[1] || 0, x[2] || 0]; }
  if (v && typeof v === 'object') return [Number(v.x ?? v.X) || 0, Number(v.y ?? v.Y) || 0, Number(v.z ?? v.Z) || 0];
  if (typeof v === 'string') { const x = v.split(/[\s,;]+/).map(Number).filter(Number.isFinite); if (x.length >= 3) return [x[0], x[1], x[2]]; }
  return [0, 0, 0];
}
/** Set the global translation of a (new) object: local = parent global inverse applied to the position. */
function setGlobalPos(o: X3DObject, p: [number, number, number]) {
  const v = new THREE.Vector3(...p); if (o.parentObj) v.applyMatrix4(o.parentObj.globalMatrix().invert());
  o.kinematics.local.set('posx', v.x); o.kinematics.local.set('posy', v.y); o.kinematics.local.set('posz', v.z);
}
function setGlobalPosUndoable(app: App, o: X3DObject, p: [number, number, number]) {
  const L = o.kinematics.local; const old = ['posx', 'posy', 'posz'].map(k => L.val(k));
  app.record('Translate', () => setGlobalPos(o, p), () => ['posx', 'posy', 'posz'].forEach((k, i) => L.set(k, old[i])));
}
const worldPos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());

// ------------------------------------------------------------------ AddFaceControl
function newNullAt(app: App, name: string, parent: X3DObject, pos: [number, number, number]) {
  const n = new Null(name); parent.addChild(n); setGlobalPos(n, pos); parent.removeChild(n);
  addObject(app, n, parent); return n;
}
function addFaceControl(app: App, a: Record<string, any>) {
  const C = 'AddFaceControl';
  const pos = vec3(a.Position), scale = numArg(a.Scale, 1), color = intArg(a.Color, 126), nom = unset(a.Nom) ? 'Control' : String(a.Nom);
  const m = objOrName(app, a.Model);
  let model: X3DObject | null = m ? (m.type === '#model' ? m : m.model) : null;
  if (!m) {
    model = faceModel(app);
    if (!model) { NYA(app, C, 'the face-model getter 0x18000f3f0(1); a model `Face` is created (inferred get-or-create)'); model = new Model(app.scene.uniqueName('Face')); addObject(app, model); }
  }
  if (!model) model = app.scene.root;
  let parent: X3DObject = model;
  if (boolArg(a.bHasOffsetParent, false)) {
    const g = ensureGroup(app, 'ControlParents');
    // offset parent `<Nom>_Parent`, size Scale x 0.2, wireframe colour 0x232 (WIRE_CORRECTIONS_B15 item 11)
    const off = newNullAt(app, nom + '_Parent', model, pos);
    Object.assign(off as any, { nullSize: scale * 0.2, wireColor: 0x232 });
    addToGroup(app, g, off); parent = off;
  }
  const g2 = ensureGroup(app, 'Controls');
  const ctl = newNullAt(app, nom, parent, pos);
  Object.assign(ctl as any, { nullSize: scale, wireColor: color });
  // 0x180007380(null, "Control", "FaceControl"): inferred FaceControl marker property with ID "Control" (Q2)
  addProperty(app, ctl, new Property('FaceControl', 'customparamset', [str('ID', 'Control', 'ID')]));
  const kw = 'Control,' + (unset(a.Keywords) ? '' : String(a.Keywords)); const old = (ctl as any).userKeywords;
  app.record('SetUserKeyword', () => { (ctl as any).userKeywords = kw; }, () => { (ctl as any).userKeywords = old; });
  addToGroup(app, g2, ctl);
  return ctl;
}

// ------------------------------------------------------------------ MakeFaceStructure
export const MESH_NAMES = ['Mesh', 'LEye', 'REye', 'UpperTeeth', 'LowerTeeth', 'Tongue'] as const;
export function activeFaceRobot(app: App): Property {
  const st = frStore(app);
  let p = activeFaceRobotProp(app);
  if (!p) p = addProperty(app, app.scene.root, new Property('ActiveFaceRobot', 'customparamset', [str('FaceModel', 'Face', 'FaceModel')]));
  const old = st.raw('psets', 'ActiveFaceRobot'); const pp = p;
  app.record('fr_sput psets', () => st.put('psets', 'ActiveFaceRobot', pp), () => { if (old === undefined) st.delete('psets', 'ActiveFaceRobot'); else st.put('psets', 'ActiveFaceRobot', old); });
  return p;
}
function makeFaceStructure(app: App) {
  const C = 'MakeFaceStructure'; const st = frStore(app);
  // the six meshnames (global 0x1802d0040, WIRE_CORRECTIONS_B15 item 1)
  const oldNames = st.raw('_', 'meshnames'); const names = [...MESH_NAMES];
  app.record('fr_sput meshnames', () => { let m = st.main.get('_'); if (!m) st.main.set('_', (m = new Map())); m.set('meshnames', names); }, () => { if (oldNames === undefined) st.delete('_', 'meshnames'); else st.main.get('_')!.set('meshnames', oldNames); });
  const afr = activeFaceRobot(app);
  const nm = String(afr.val('FaceModel') ?? '');
  let model = nm ? app.scene.root.children.find(c => c.name === nm || c.fullName === nm) ?? findByName(app, nm) : null;
  if (!model) {
    NYA(app, C, 'the model lookup 0x180009dc0 and the model initialiser 0x180008410(model, "Face")');
    model = new Model(app.scene.uniqueName('Face')); addObject(app, model);
  }
  const p = afr.get('FaceModel'); if (p) app.setParam(p, model.fullName);
  const old = st.raw('_', 'FaceModel'); const mm = model;
  app.record('fr_sput FaceModel', () => st.put('_', 'FaceModel', mm), () => { if (old === undefined) st.delete('_', 'FaceModel'); else st.put('_', 'FaceModel', old); });
  NYA(app, C, 'the four structure builders 0x18000a800 / 0x18000a6f0 / 0x18000a990 / 0x18000b3f0');
  return null;   // a default-constructed Model ref (Q1)
}

// ------------------------------------------------------------------ fr_MakeEyeBall
const fc = (keys: [number, number][], tangents?: number[]) => JSON.stringify(tangents ? { keys, tangents } : { keys });
export function eyeballPropertyDefs() {
  const A = { animatable: true }, P = { animatable: false };
  return [
    str('SynopticPath', 'TitlebarSynoptic', 'SynopticPath'),
    num('Scale', 0.2, 'Scale', { ...A, min: 0.01, max: 1000, uimin: 0.01, uimax: 1 }),
    num('Center', 0, 'Center', { ...A, min: -2, max: 2, uimin: -1, uimax: 1 }),
    num('Bulge', -0.15, 'Bulge', { ...A, min: -1, max: 1, uimin: -1, uimax: 1 }),
    num('Size', 0.25, 'Size', { ...A, min: 0.01, max: 1, uimin: 0.01, uimax: 1 }),
    num('Aperture', 0.2, 'Aperture', { ...A, min: 0, max: 1, uimin: 0, uimax: 1 }),
    int('Sections', 48, 'Sections', { ...A, min: 8, max: 200, uimin: 8, uimax: 200 }),
    num('Anisotropy', 0, 'Anisotropy', { ...A, min: -1, max: 1, uimin: -1, uimax: 1 }),
    num('Ripples', 0, 'Ripples', { ...A, min: -2, max: 2, uimin: -1, uimax: 1 }),
    bool('innerIris', true, 'innerIris', P),
    bool('Lens', true, 'Lens', P),
    int('Sclera', 24, 'Sclera', { ...A, min: 0, max: 100, uimin: 0, uimax: 100 }),
    str('IrisFC', fc([[0, 0], [0.02, 0.044], [0.4, 0], [0.43, 0.044], [0.68, 0], [0.77, 0.044]]), 'IrisFC', { desc: 'FCurve' }),
    str('CornealBulgeFC', fc([[0, 0], [1, 0.5]], [0, 0, 0.25, 0.4, -0.5, 0, 0.1, 0]), 'CornealBulgeFC', { desc: 'FCurve' }),
    num('CornealBulge', 1, 'CornealBulge', { ...A, min: 0, max: 10, uimin: 0, uimax: 10 }),
    int('CorneaDetail', 10, 'CorneaDetail', { ...A, min: 2, max: 80, uimin: 2, uimax: 80 }),
  ];
}
function sphere(r: number, seg: number, rings: number) {
  const v: number[][] = [[0, r, 0]]; const f: number[][] = [];
  for (let j = 1; j < rings; j++) { const t = Math.PI * j / rings; for (let i = 0; i < seg; i++) { const p = 2 * Math.PI * i / seg; v.push([r * Math.sin(t) * Math.cos(p), r * Math.cos(t), r * Math.sin(t) * Math.sin(p)]); } }
  v.push([0, -r, 0]); const last = v.length - 1;
  for (let i = 0; i < seg; i++) f.push([0, 1 + (i + 1) % seg, 1 + i]);
  for (let j = 0; j < rings - 2; j++) for (let i = 0; i < seg; i++) { const a = 1 + j * seg + i, b = 1 + j * seg + (i + 1) % seg; f.push([a, b, b + seg, a + seg]); }
  const base = 1 + (rings - 2) * seg; for (let i = 0; i < seg; i++) f.push([base + i, base + (i + 1) % seg, last]);
  return { v, f };
}
function makeEyeBall(app: App, a: Record<string, any>) {
  const C = 'fr_MakeEyeBall';
  const parent = objOrName(app, a.inParent) ?? app.scene.root;
  const given = a.inProp instanceof Property && a.inProp.name.startsWith('EyeballProperties') ? a.inProp as Property : null;
  const tmpProp = given ?? new Property('EyeballProperties', 'EyeballProperties', eyeballPropertyDefs());
  void faceModel(app);
  const r = Number(tmpProp.val('Scale') ?? 0.2);
  const s = sphere(r, 16, 8);
  const cornea = meshObject(app, 'Cornea', s.v, s.f);
  addObject(app, cornea, parent);
  const prop = given ?? addProperty(app, cornea, tmpProp);   // a set is added when none is passed (inferred)
  const cop = new FROp('fro_CorneaOp', 'fro_CorneaOp'); cop.ports = { Main: { PrimOut: cornea, PrimIn: cornea, PropIn: prop } }; addOp(app, cornea, cop);
  const mat = new Material('CorneaPhong'); mat.setSurface(makePhong('CorneaPhong'));
  app.record('AddMaterial', () => cornea.setMaterial(mat), () => cornea.setMaterial(null));
  const ir = sphere(r * Number(tmpProp.val('Size') ?? 0.25), 12, 4);
  const iris = meshObject(app, 'Iris', ir.v, ir.f); addObject(app, iris, cornea);
  const iop = new FROp('fro_IrisOp', 'fro_IrisOp'); iop.ports = { Main: { PrimOut: iris, PrimIn: iris, PropIn: prop } }; addOp(app, iris, iop);
  NYA(app, C, 'the eyeball / cornea / iris geometry and operator numerics (0x18004b8c0 / 0x18004c650), the CorneaPhong reflectivity / transparency / colour values and the use of inScale');
  setGlobalPosUndoable(app, cornea, vec3(a.inVector));
  return cornea;
}

// ------------------------------------------------------------------ MakeEyeRig
function makeEyeRig(app: App, a: Record<string, any>) {
  const C = 'MakeEyeRig'; const st = frStore(app);
  const eyes = nodesArg(app, a.inEyes).filter((n): n is X3DObject => n instanceof X3DObject);
  if (!eyes.length) { app.logMsg('info', 'No Eye Ball inputs, Eyelook not created;'); return []; }
  const head = objOrName(app, a.inHeadNull);
  NYA(app, C, 'the rig sub-builders (0x180076d50, 0x180078b40, 0x180077ed0, 0x180077be0, 0x180077100, 0x180077a30, 0x180077420); only the root and the controls are built');
  const owner = faceModel(app) ?? app.scene.root;
  const root = new Null(app.scene.uniqueName('EyeRig_Root')); addObject(app, root, owner);
  if (head) (root as any).headReference = head;
  const centre = eyes.reduce((s, e) => s.add(worldPos(e)), new THREE.Vector3()).multiplyScalar(1 / eyes.length);
  const look = new Null('LookAt_Control'); root.addChild(look); setGlobalPos(look, [centre.x, centre.y, centre.z + 5]); root.removeChild(look); addObject(app, look, root);
  const reg = (k: string, o: X3DObject) => { const old = st.raw('controls', k); app.record('fr_sput controls', () => st.put('controls', k, o), () => { if (old === undefined) st.delete('controls', k); else st.put('controls', k, old); }); };
  reg('LookAt_Control', look);
  const out: X3DObject[] = [root, look];
  for (const eye of eyes) {
    const p = worldPos(eye);
    const ctl = new Null('Eye_Control'); root.addChild(ctl); setGlobalPos(ctl, [p.x, p.y, p.z]); root.removeChild(ctl); addObject(app, ctl, root);
    let name = p.x > 0 ? 'LEye_Control' : 'REye_Control';
    for (let t = 0; t < 2 * eyes.length && root.children.some(c => c !== ctl && c.name === name); t++) name += '0';
    rename(app, ctl, name); reg(name, ctl); out.push(ctl);
  }
  return out;
}

// ------------------------------------------------------------------ MakeEyelids / RegenerateEyelids
const helpText = (code: number) => `\nMakeEyelids HELP: [${code}]\n Not enough arguments were passed into Make Eyelids or arguments are of wrong kinds\n There are 2 ways of running MakeEyelids, either inputing proper arguments or from selection \n\t1.> MakeEyelids(Eye/*polymesh x3d object*/, Face/*polymesh x3d object*/, Curves/*collection of 2 crvlists*/,[EyeRigRoot /*null or model, optional*/]);\n\t2.> Select the 2 meshes in order: Eye and Face, and the 2 Curves: upper and lower and run > MakeEyelids();`;
function makeEyelids(app: App, a: Record<string, any>) {
  const C = 'MakeEyelids';
  const sel = app.selectedObjects;
  const meshes = sel.filter(o => o.type === 'polymsh'), curves = sel.filter(o => o.type === 'crvlist'), parents = sel.filter(o => o.type === '#model' || o.type === 'null');
  const isMesh = (o: X3DObject | null) => !!o && o.type === 'polymsh';
  let eye = objOrName(app, a.inEyeGeo); if (!isMesh(eye)) eye = null;
  let face = objOrName(app, a.inFaceMesh); if (!isMesh(face)) face = null;
  const pool = meshes.filter(m => m !== eye && m !== face);
  if (!eye) eye = pool.shift() ?? null;
  if (!face) face = pool.shift() ?? null;
  let crv = nodesArg(app, a.inEyelidCurves).filter((n): n is X3DObject => n instanceof X3DObject && n.type === 'crvlist');
  if (crv.length < 2) crv = curves.slice(0, 2);
  let par = objOrName(app, a.inEyesParent);
  if (!par) par = parents[0] ?? face?.model ?? null;
  const code = !eye ? 0 : !face ? 1 : crv.length < 2 ? 2 : -1;
  if (code >= 0) throw failLog(app, C, DISP_E_MEMBERNOTFOUND, helpText(code));
  NYA(app, C, 'the six eyelid rig stages of the driver 0x180070b30 (0x180069bf0, 0x18006c450, 0x18006a3e0, 0x18006ba50, 0x18006c820, 0x18006d100); nothing is built');
  void par;
  return [];
}
function regenerateEyelids(app: App) {
  const C = 'RegenerateEyelids';
  progress(app, 'Regenerating Eyelids ');
  const out: X3DObject[] = [];
  for (const side of ['L', 'R']) {
    const fm = faceModel(app);
    if (!fm) { app.logMsg('error', 'Face Model Not Found; \nif FaceModel Exists check that:\n\t1.ActiveFaceRobot Property contains the Face Model Name\n\t2.Exit and restart the FaceRobot Application '); continue; }
    const mesh = faceMesh(app); if (!mesh) { app.logMsg('error', 'Face Mesh Not Found'); continue; }
    // the eye lookup is not attested: `<side>Eye` under the face model, or registry meshes/<side>Eye (inferred)
    const eyeV = frStore(app).raw('meshes', side + 'Eye');
    const eye = eyeV instanceof X3DObject ? eyeV : childNamed(fm, side + 'Eye');
    if (!eye) { app.logMsg('error', 'Eye not found'); continue; }
    const up = childNamed(fm, side + 'EyelidUpper_Curve'), lo = childNamed(fm, side + 'EyelidLower_Curve');
    if (!up || !lo) { app.logMsg('error', 'Guide Curves not found:\n\t1.Draw curves bordering eyelids, select them and run,\n\tfr_MakeEyelids()'); continue; }
    void childNamed(fm, 'EyeRig_Root');
    NYA(app, C, `the per-side worker 0x18006f830 rebuild for side ${side} (delete of the old rig and MakeEyelids driver)`);
  }
  return out;
}

// ------------------------------------------------------------------ fr_GetEyelashMedian
function clusterPoints(c: Cluster, polys: number[][]): Set<number> {
  if (c.compKind === 'pnt') return new Set([...c.elements].map(Number));
  if (c.compKind === 'poly') { const s = new Set<number>(); for (const i of c.elements) for (const v of polys[Number(i)] ?? []) s.add(v); return s; }
  return new Set();
}
function getEyelashMedian(app: App, a: Record<string, any>) {
  const C = 'fr_GetEyelashMedian';
  const o = objOrName(app, a.Mesh); const m = o ? meshOf(o) : null;
  if (!o || !m) throw failLog(app, C, E_FAIL, 'the mesh has no geometry');
  const n = m.positions.length / 3; const P = m.positions;
  const first = o.clusters[0] ?? null;
  if (first && first.compKind !== 'pnt' && first.compKind !== 'poly') NYA(app, C, `the point set of a ${first.compKind} cluster`);
  const inCl = first ? clusterPoints(first, m.polygons) : new Set<number>();
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i * 3 + k]); mx[k] = Math.max(mx[k], P[i * 3 + k]); }
  const ref = (mn[0] + mx[0]) / 2;   // Q7: the box centre X (inferred)
  const front = boolArg(a.b_ChooseFront, false);
  let best = -1, bd = Infinity;
  for (let i = 0; i < n; i++) { if (inCl.has(i) === front) continue; const d = Math.abs(P[i * 3] - ref); if (d < bd) { bd = d; best = i; } }
  const local = best >= 0 ? new THREE.Vector3(P[best * 3], P[best * 3 + 1], P[best * 3 + 2]) : new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);   // fallback: box centre (inferred)
  const w = local.applyMatrix4(o.globalMatrix());
  return [w.x, w.y, w.z];
}

// ------------------------------------------------------------------ PPG commands
function modelProp(app: App, C: string, name: string): Property | null {
  const fm = faceModel(app); const p = fm ? propNamed(fm, name) ?? null : null;
  if (!p) NYA(app, C, `the branch without a face model ${name} property`);
  return p;
}
const JAW: [string, string][] = [
  ['fr_JawDeflationEaseInCurves', '.JawEnd_Control.Deflation_Ease_In'], ['fr_JawSlidingEaseInCurves', '.JawEnd_Control.Sliding_Ease_In'],
  ['fr_JawFattening', '.BelowJawCurve_Trace.Fattening'], ['fr_JawSliding', '.JawSurface.Sliding'],
  ['fr_JawUpperDeflation', '.UpperJawCurve_TissueCurve.Upper_Jaw_Deflation'], ['fr_JawLowerDeflation', '.LowerJawCurve_TissueCurve.Lower_Jaw_Deflation'],
];
/** The five property sets whose `_Define` adds no parameter (cmd-b14c §2.3): the parameters their layouts name. */
export function jawPropertyDefs(kind: 'FaceDeformProperties' | 'JawDeflationProperty' | 'JawEaseInProperty' | 'JawFatteningProperty' | 'JawSlidingProperty') {
  const F = (n: string) => str(n, '[]', n, { desc: 'FCurve' });
  switch (kind) {
    case 'FaceDeformProperties': return [num('Multiplier', 1, 'Multiplier'), F('EaseIn')];
    case 'JawDeflationProperty': return [F('Offset')];
    case 'JawEaseInProperty': return [num('Amount', 1, 'Amount'), F('EaseIn')];
    case 'JawFatteningProperty': return [num('Inflate', 1, 'Inflate'), F('InflateCurve')];
    case 'JawSlidingProperty': return [F('SlideProfile')];
  }
}

export function registerFaceRobotB14cCommands(app: App) {
  const reg = (name: string, description: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label: name, category: 'Face Robot', description, args: args.map(([n, d]) => ({ name: n, default: d })), execute });
  reg('AddFaceControl', '', [['Position', [0, 0, 0]], ['Scale', 1], ['Color', 126], ['Nom', 'Control'], ['Model', null], ['bHasOffsetParent', null], ['Keywords', null]], addFaceControl);
  reg('MakeFaceStructure', '', [['FaceMame', 'Head']], (app) => makeFaceStructure(app));
  reg('fr_MakeEyeBall', '', [['inParent', null], ['inScale', null], ['inVector', null], ['inProp', null]], makeEyeBall);
  reg('MakeEyeRig', '', [['inEyes', null], ['inHeadNull', null]], makeEyeRig);
  reg('MakeEyelids', '', [['inEyeGeo', null], ['inFaceMesh', null], ['inEyelidCurves', null], ['inEyesParent', null]], makeEyelids);
  reg('RegenerateEyelids', '', [], (app) => regenerateEyelids(app));
  reg('fr_GetEyelashMedian', '', [['Mesh', null], ['b_ChooseFront', null]], getEyelashMedian);
  reg('fr_AnimateEyes', '', [], (app) => { const p = modelProp(app, 'fr_AnimateEyes', 'BlinkProperties'); if (p) inspectObj(app, 'fr_AnimateEyes', p, 1); return undefined; });
  reg('fr_EyelidsDeformCurves', '', [], (app) => { const p = modelProp(app, 'fr_EyelidsDeformCurves', 'EyeProperties'); if (p) showPPG(app, 'fr_EyelidsDeformCurves', p); return undefined; });
  reg('fr_EyelidsInfluenceMaps', '', [], (app) => { const p = modelProp(app, 'fr_EyelidsInfluenceMaps', 'BlinkProperties'); if (p) showPPG(app, 'fr_EyelidsInfluenceMaps', p); return undefined; });
  for (const [name, suffix] of ['fr_JawUpperDeflation', 'fr_JawLowerDeflation', 'fr_JawDeflationEaseInCurves', 'fr_JawSlidingEaseInCurves', 'fr_JawSliding', 'fr_JawFattening'].map(n => JAW.find(j => j[0] === n)!)) {
    reg(name, '', [['face', null]], (app, a) => { showPPG(app, name, (unset(a.face) ? '' : String(a.face)) + suffix); return undefined; });
  }
  registerFaceRobotB14cMapCommands(app);
}
