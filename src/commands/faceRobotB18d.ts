// Ledger row CMD-B18d: the 30 commands of the small Face Robot / plug-in JScript files (MeshHelper.js, Utilities.js,
// AdjustPanelKeys.js, ParseOpenDNA.js, ModifyFaceLayout.js, PlotToShapes.js, InitNeck.js, InitNose.js,
// FaceRobotShapeGoals.js, AddBlinkKeys.js, PaintGameExportPlugin.js, StabilizeC3D.js, AnimationRigImport.js,
// StereoCamera.js). Brief: the "Wire contract" sections of docs/ghidra/cmd-b18d-fr-small-scripts.md and
// docs/re/WIRE_CORRECTIONS_B18.md items 1, 4, 9, 10, 12. Original code written from that prose only; no XSIBATCH golden.
//
// Registration replaces the argument-less host shells and the fr_ToggleFaceLayout / fr_SetAltLayout stubs of
// faceRobotModule.ts and the plain-camera GetPrimStereoCamera of ui.ts (app.register overwrites).
//
// AddUserKeyword (item 10): the registry dump (data/command_registry.json) lists only the siuitasks command
// (InputObjs, Keywords), i.e. the built-in won when the dump was taken; the Face Robot plug-in registers (Obj, Key).
// One registration keeps the built-in's argument list first (positional calls keep the built-in behaviour) and adds
// `Obj` / `Key`: a call that passes `Obj` or `Key` by name runs the Face Robot body (append with a leading comma, no
// duplicate test, Clear + Set). The Face Robot scripts of this row call the Face Robot body directly.
import { App, CommandDef } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import { num, int, str, bool } from '../core/params';
import { Camera, Constraint, makeMixer } from '../core/scene';
import {
  THREE, X3DObject, Node, Property, Model, Null, Operator, b18d, nya, logErr, logInfo, logWarn, call, inspect, sget, sset, sgetObj,
  frFaceModel, siName, findChild, descendants, objList, selection0, setP, setParamU, wireColor, setViewVis, globalSRT, localPoints,
  setMeshGeometry, freezeObj, addInPlace, addCurveList, addPointCluster, customProperty, scriptedOp, scriptedOpsOf, weightMapNamed,
  createWeightMap, weightOf, addFCurve2, setKeyTangents, keyTangents, keywordTokens, globalPos, setGlobalPos, setLocal, deleteNode,
  reparent, unset, objArg, addObject, addProperty, propNamed, findByName, ROW, CAT,
} from './faceRobotB18dShared';
import { frGetPolymesh, frInitNeck, frInitNose, PolymeshHelper, noseRingPoints } from './faceRobotB18dMesh';
import { filterKeyed, de } from './faceRobotB14deShared';
import { stageCode } from './faceRobotB14Shared';
import { setFaceRobotEnabled } from './faceRobotModule';
import { constrain, mkChain } from './rigScriptsB15eKit';

const text = (v: any) => (unset(v) ? '' : String(v));
const numOr = (v: any, d: number) => { if (unset(v) || v === '') return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
const truthy = (v: any) => !unset(v) && v !== '' && v !== 0 && v !== false && v !== '0' && v !== 'false';

// ================================================================== Utilities.js (§3)
function keyList(v: any): string[] {
  if (unset(v) || v === '' || v === 0) return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v).split(',');
}
/** Face Robot AddUserKeyword body: existing keywords joined with ",", then "," + Key; ClearUserKeyword + SetUserKeyword. */
export function frAddUserKeyword(app: App, obj: Node | null, key: any) {
  if (!obj) return;
  const textKw = keywordTokens(obj).join(',') + ',' + text(key);
  b18d(app).calls.push({ name: 'AddUserKeyword', args: { Obj: siName(obj), Key: text(key) } });
  try { app.run('ClearUserKeyword', { InputObjs: [obj] }); app.run('SetUserKeyword', { InputObjs: [obj], Keywords: textKw }); }
  catch (e: any) { logInfo(app, `AddUserKeyword: ${e?.message ?? e}`); }
}
/** The face model of GetKeyed: fr_GetFaceModel(); when the command fails, the error and the scene-root model `Face`. */
function keyedModel(app: App, C: string, v: any): X3DObject | null {
  if (!unset(v) && v !== '') return objArg(app, v);
  let m: any; let failed = !app.commands.has('fr_GetFaceModel');
  if (!failed) { try { m = app.run('fr_GetFaceModel', {}); } catch { failed = true; } }
  if (failed) {
    logErr(app, 'Face Robot FR.dll Failed to load properly. Command("fr_GetFaceModel") was not recognized!');
    let face = app.scene.root.children.find(c => c instanceof Model && c.name === 'Face') ?? null;
    if (!face) { face = new Model('Face'); addObject(app, face, app.scene.root); }
    return face;
  }
  if (!(m instanceof X3DObject)) { nya(app, C, 'fr_GetFaceModel returned no model (the script then calls FindChildren on it: script error, inferred); empty result'); return null; }
  return m;
}
function getKeyedIn(app: App, C: string, keys: string[], model: any): X3DObject[] {
  const m = keyedModel(app, C, model); if (!m) return [];
  return filterKeyed(descendants(m), keys);
}
const NAME_TAGS: [RegExp, string][] = [
  [/MouthCorner/, 'Control,Mouth,Corner'], [/Lip/, 'Control,Mouth'],
  ...['Bend', 'Upper', 'Lower', 'Jaw', 'Eyelid', 'Ear', 'Eyebrow', 'Orbital', 'Mid', 'End', 'Nose', 'Nostril', 'Bulge', 'Base', 'Chin', 'Neck', 'Head', 'Root', 'Hinge', 'Puffer', 'LookAt', 'Tip'].map(w => [new RegExp(w), w] as [RegExp, string]),
  [/Null/, 'Null,Space'], [/Start/, 'Bone'],
];
function setControlKeys(app: App) {
  const C = 'SetControlKeys';
  const dna = parseDNAFile(app, C, null, null);
  if (!dna) { logErr(app, 'OPENDNA NOT FOUND'); return null; }
  const ctrls: X3DObject[] = dna.ControlObjects ?? [], helpers: X3DObject[] = dna.HelperObjects ?? [];
  if (!ctrls.length) { logErr(app, 'OPENDNA Controls NOT FOUND'); return null; }
  for (const c of ctrls) frAddUserKeyword(app, c, 'Control');
  for (const h of helpers) frAddUserKeyword(app, h, 'Space');
  const coll = [...ctrls, ...helpers];
  const model = ctrls[0].model ?? app.scene.root;
  for (const o of descendants(model)) if (['root', 'bone', 'eff'].includes(o.type)) coll.push(o);   // SIFilter "chainelement"
  call(app, 'fr_ResetAll');
  const head = coll.find(o => o.name === 'Head_Control' && (o.model ?? app.scene.root) === model) ?? null;
  if (!head) nya(app, C, `${model.name}.Head_Control is not in the collection (script error, inferred): sides are taken in world space`);
  const inv = head ? head.globalMatrix().clone().invert() : new THREE.Matrix4();
  for (const o of coll) {
    for (const [re, kw] of NAME_TAGS) if (re.test(o.name)) frAddUserKeyword(app, o, kw);
    const x = globalPos(o).applyMatrix4(inv).x;
    frAddUserKeyword(app, o, Math.abs(x) < 0.001 ? 'Center' : x > 0 ? 'Left' : 'Right');
  }
  return undefined;
}
function mirrorControls(app: App, a: Record<string, any>) {
  const input = unset(a.Controls) || a.Controls === '' ? app.selection.filter((n): n is X3DObject => n instanceof X3DObject) : objList(app, a.Controls);
  const G = truthy(a.Global);
  const L = filterKeyed(input, ['Control', 'Left']), R = filterKeyed(input, ['Control', 'Right']), Cn = filterKeyed(input, ['Control', 'Center']);
  const mir = (o: X3DObject) => { if (G) { const p = globalPos(o); return new THREE.Vector3(-p.x, p.y, p.z); } const l = o.kinematics.local; return new THREE.Vector3(-l.val('posx'), l.val('posy'), l.val('posz')); };
  const targets: X3DObject[] = [], values: THREE.Vector3[] = [];
  for (const c of Cn) { targets.push(c); values.push(mir(c)); }
  for (const c of [...L, ...R]) {
    const keys = String((c as any).userKeywords ?? '').split(',');
    const i = keys.findIndex(k => k === 'Left' || k === 'Right');
    if (i < 0) { logErr(app, `Object <${siName(c)}> is not a symmetrical control !, check keys \n\t[${keys}]`); continue; }
    const sw = [...keys]; sw[i] = keys[i] === 'Left' ? 'Right' : 'Left';
    const m = filterKeyed(descendants(c.model ?? app.scene.root), sw.filter(s => s !== ''));
    if (!m.length) { logErr(app, `No mirror control to <${siName(c)}> was found `); continue; }
    if (m.length > 1) logWarn(app, `More than One Control with keys [${sw}] : \n<${m.map(siName).join(',')}>\n\tto ensure unique identification, add more specific keys \n only one control <${siName(m[0])}>will be mirrored`);
    targets.push(m[0]); values.push(mir(c));
  }
  logInfo(app, targets.map(siName).join(','));
  targets.forEach((t, i) => { if (G) setGlobalPos(app, t, values[i]); else { setLocal(app, t, 'posx', values[i].x); setLocal(app, t, 'posy', values[i].y); setLocal(app, t, 'posz', values[i].z); } });
  app.select(targets);
  return undefined;
}

// ================================================================== AdjustPanelKeys.js (§4)
function adjustProp(app: App, C: string): Property {
  const fm = frFaceModel(app); const p = fm ? propNamed(fm, 'FaceAdjustProperties') : null;
  if (!p) throw new Error(`${C}: fr_sget("FaceModel").FaceAdjustProperties is missing (script error)`);
  return p;
}
function saveAdjustKeys(app: App) {
  const p = adjustProp(app, 'fr_SaveAdjustPanelKeys'); const st = b18d(app);
  const out = { names: [] as string[], keys: [] as number[][], tangents: [] as number[][] };
  for (const q of p.params) {
    const fc = app.anim.fcurve(q); if (!fc || !fc.keys.length) continue;
    out.names.push(q.name); out.keys.push(fc.keys.flatMap(k => [k.time, k.value])); out.tangents.push(fc.keys.flatMap(k => keyTangents(k)));
  }
  st.adjust = out;
}
function needAdjust(app: App, C: string) { const s = b18d(app).adjust; if (!s) throw new Error(`${C}: nothing saved yet (the plug-in lists are undefined: script error, inferred)`); return s; }

// ================================================================== ParseOpenDNA.js (§5)
export function parseDNAText(textIn: string, filename: string): any {
  const out: any = { filename, labels: [] as (string | undefined)[] };
  for (const sec of textIn.split('###')) {
    const lines = sec.split('\n').map(l => l.replace(/[\t\v\n\r\f]/g, '').replace(/,+$/, '')).filter(l => l !== '' && !l.startsWith('//'));
    const name = lines[0]; out.labels.push(name);
    if (name !== undefined) out[name] = lines.slice(1);
  }
  return out;
}
function dnaFolder(app: App) { return `${b18d(app).env.FACEROBOTDATAROOT ?? ''}\\Dna`; }
export function getDNAFile(app: App, type: string): string | null {
  const folder = dnaFolder(app);
  let files: string[] = [];
  try { if (hostFs.isFolder(folder)) files = hostFs.listFiles(folder).filter(f => f.split('.').pop() === 'dna').map(f => hostFs.join(folder, f)); } catch { files = []; }
  if (!files.length) { logInfo(app, `dna files inside Folder <${folder}> not found `); return null; }
  let re: RegExp; try { re = new RegExp(type || 'Human_Face_Symmetric'); } catch { re = /Human_Face_Symmetric/; }
  let hit: string | null = null; for (const f of files) if (re.test(f)) hit = f;
  if (!hit) { logInfo(app, 'dna file <null> not found '); return null; }
  return hit;
}
function dnaDump(app: App, dna: any) {
  for (const key of Object.keys(dna)) {
    logInfo(app, `key=${key}`);
    const v = dna[key]; if (Array.isArray(v)) v.forEach((e, i) => logInfo(app, `${i}=${e}`));
    logInfo(app, '');
  }
}
export function parseDNAFile(app: App, _C: string, filename: any, debug: any): any {
  let file = text(filename);
  const exists = (() => { try { return !!file && hostFs.isFile(file); } catch { return false; } })();
  if (!exists) { const f = getDNAFile(app, file); if (!f) return null; file = f; }
  let body: string; try { body = hostFs.readFile(file); } catch { logErr(app, `File <${file}> Not found `); return null; }
  const dna = parseDNAText(body, file);
  if (truthy(debug)) dnaDump(app, dna);
  const fm = frFaceModel(app);
  if (!fm) { dna.ControlObjects = null; dna.HelperObjects = null; return dna; }
  const ctrls: X3DObject[] = [];
  for (const e of (dna.controls ?? []) as string[]) {
    const f = e.split(','); const names = f[0] === 's' ? [`L${f[1]}`, `R${f[1]}`] : f[0] === 'a' ? [f[1]] : [];
    for (const n of names) { const o = findChild(fm, n); if (o) ctrls.push(o); else logErr(app, `Control <${n}> not found`); }
  }
  const helpers: X3DObject[] = [];
  for (const e of (dna.hpoints ?? []) as string[]) { const o = findChild(fm, e.split(',')[1] ?? ''); if (o) helpers.push(o); }
  dna.ControlObjects = ctrls; dna.HelperObjects = helpers;
  return dna;
}

// ================================================================== ModifyFaceLayout.js (§6)
/** The Layout object stand-in (Desktop.ActiveLayout). */
export class LayoutRef { constructor(readonly Name: string) {} toString() { return this.Name; } }
const activeLayoutName = (app: App) => de(app, 'B14d').activeLayout || 'Default';   // inferred: the Softimage default layout before any switch
function putActiveLayout(app: App, name: string) {
  const st = de(app, 'B14d'); st.activeLayout = name; st.putActiveLayoutCalls++;
  b18d(app).calls.push({ name: 'Desktop.ActiveLayout', args: { Name: name } });
  if (name === 'Face Robot') setFaceRobotEnabled(app, true); else setFaceRobotEnabled(app, false);
}
function toggleFaceLayout(app: App) {
  const id = Number(app.commands.has('fr_GetCurrentStage') ? app.run('fr_GetCurrentStage', {}) : stageCode(app)) / 10;
  if (activeLayoutName(app) === 'Face Robot') {
    const stored = sget(app, 'Layout');
    const name = stored instanceof LayoutRef ? stored.Name : typeof stored === 'string' && stored ? stored : 'Tools Development Environment';
    putActiveLayout(app, name);
  } else {
    putActiveLayout(app, 'Face Robot');
    app.run('fr_SwitchFaceLayout', { inLayoutID: id });
  }
  return undefined;
}

// ================================================================== PlotToShapes.js (§7)
const SRT = ['sclx', 'scly', 'sclz', 'posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'];
function ensureMixer(app: App, m: X3DObject) { if (!m.properties.some(p => p.type === 'mixer')) addProperty(app, m, makeMixer()); }
function plotGlobal(app: App, a: Record<string, any>) {
  let input: any = a.inObj;
  if (unset(input) || input === '') { input = app.selection.slice(); if (!input.length) return null; }
  const start = a.start ? Number(a.start) : app.anim.startFrame, end = a.end ? Number(a.end) : app.anim.endFrame;
  const sources: X3DObject[] = Array.isArray(input) ? input.map((x: any) => (x instanceof X3DObject ? x : objArg(app, x))).filter((x: any): x is X3DObject => !!x) : input instanceof X3DObject ? [input] : objList(app, input);
  if (!sources.length) return undefined;
  let mod: any = a.mod; if (typeof mod === 'string' && mod) mod = findChild(app.scene.root, mod);
  let targets: (X3DObject | null)[];
  if (mod instanceof X3DObject && mod.type === '#model') targets = sources.map(s => findChild(mod, s.name));
  else { mod = sources[0].model ?? app.scene.root; targets = sources; }
  ensureMixer(app, mod);
  const rec = sources.map(() => SRT.map(() => [] as number[]));
  for (let f = start; f <= end; f++) {
    app.anim.frame = f;
    sources.forEach((s, i) => { const g = globalSRT(s); SRT.forEach((p, k) => rec[i][k].push(f, g[p])); });
  }
  targets.forEach((t, i) => { if (!t) return; SRT.forEach((p, k) => { const q = t.kinematics.global.get(p); if (q) addFCurve2(app, q, rec[i][k]); }); });
  return undefined;
}
const isPolyMesh = (o: X3DObject) => o.type === 'polymsh';
function duplicateMesh(app: App, src: X3DObject, parent: X3DObject): X3DObject {
  const m = src.primitive?.mesh(); const verts: number[][] = []; if (m) for (let i = 0; i < m.positions.length; i += 3) verts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
  const o = new X3DObject(app.scene.uniqueName(src.name), 'polymsh');
  const prim = new (src.primitive!.constructor as any)('Polygon Mesh', 'polymsh'); o.setPrimitive(prim);
  addObject(app, o, parent); setMeshGeometry(app, o, verts, (m?.polygons ?? []).map(f => [...f]));
  const g = src.globalMatrix(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); g.decompose(p, q, s);
  setGlobalPos(app, o, p);
  b18d(app).calls.push({ name: 'Duplicate', args: { InputObjs: siName(src), values: [1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1] } });
  return o;
}
function shapePlot(app: App, C: string, S: X3DObject[], T: X3DObject[], start: number, end: number, M: X3DObject | null) {
  const st = b18d(app);
  const glue: any[] = T.map((t, i) => call(app, 'fr_GlueMeshGlobal', { inDrivenMesh: t, inDriverMesh: S[i], inStack: 0 }));
  st.constructionMode = 1;
  if (T.length) st.progress.captions.push('Plotting XSI Shapes');
  const tracks: any[] = []; const clips: any[] = [];
  let cancelled = false;
  for (let i = start; i <= end && !cancelled; i++) {
    for (let k = 0; k < T.length; k++) {
      const t = T[k]; app.anim.frame = i;
      if (i === start) tracks[k] = call(app, 'AddTrack', { Parent: M, Source: null, Type: 1, Name: `${siName(t)}Shape`, Track: null });
      const keyName = `${t.name}_${i}_Frame`;
      const store = () => { try { return app.ExecuteCommand('StoreShapeKey', [t, keyName, 2, null, 1, 0, 3, 0]); } catch (e: any) { logInfo(app, `StoreShapeKey failed: ${e?.message ?? e}`); return undefined; } };
      st.calls.push({ name: 'StoreShapeKey', args: { InputObj: siName(t), Name: keyName, values: [2, null, 1, 0, 3, 0] } });
      let key: any = store();
      if (!key) { logInfo(app, `Shape key replotted ${i}:A`); key = store(); }
      else if (!(key instanceof Node) || key.type !== 'clskey' || key.name !== keyName || !((key as any).elements?.length ?? (key as any).values?.size ?? 1)) { logInfo(app, `Shape key replotted ${i}:B`); deleteNode(app, key); key = store(); }
      const addClip = () => { try { return app.ExecuteCommand('AddClip', [t.model ?? app.scene.root, key, null, tracks[k], i, null, null, null, false]); } catch { return undefined; } };
      st.calls.push({ name: 'AddClip', args: { Source: keyName, Time: i } });
      let clip = addClip();
      if (!clip) { logInfo(app, `Second Try : adding Clip on mesh: ${t.name}, at frame: ${i}`); clip = addClip(); if (!clip) logErr(app, `Failed to add Clip on mesh ${t.name} at frame ${i}`); }
      if (clip) { clips.push(clip); const tc = (clip as any).get?.('clipout'); if (tc) app.setParam(tc, 0); }
    }
    if (start !== end) {
      st.progress.captions.push(`Frame... ${i}`);
      if (st.progress.cancelAt === i) { logInfo(app, 'Canceled by user.'); cancelled = true; }
    }
  }
  if (cancelled) return;
  st.constructionMode = 0;
  if (clips.length) {
    nya(app, C, 'what CreateCompound does with the undefined track argument (one past the last track)');
    const comp: any = call(app, 'CreateCompound', { Model: M, Clips: clips, Name: null, Track: undefined, Time: start, Desc: siName(T[0]) });
    if (comp instanceof Node) { setP(comp, 'cliptoparentend', true); setP(comp, 'cliptoparentstart', true); }
  }
  for (const g of glue) if (g instanceof Operator) deleteNode(app, g);
  if (start !== end && T.length) st.progress.captions.push('Plot Complete... ');
}
function plotFaceRobot(app: App, a: Record<string, any>) {
  const C = 'PlotFaceRobot';
  let face: X3DObject | null; let sources: X3DObject[];
  const given = objList(app, a.inMeshes);
  if (given.length) { sources = given; face = given[0].model; }
  else { face = frFaceModel(app); sources = face ? descendants(face).filter(o => o.type === 'polymsh' || o.type === 'surfmsh') : []; }
  let model: X3DObject | null = null;
  if (truthy(a.NewModelName)) { model = new Model(app.scene.uniqueName(typeof a.NewModelName === 'string' ? a.NewModelName : 'PlotFaceRobot')); addObject(app, model, app.scene.root); }
  const set: X3DObject[] = []; for (const s of sources) for (const o of [s, ...descendants(s)]) if (!set.includes(o) && isPolyMesh(o)) set.push(o);
  logInfo(app, `Plotting: ${set.map(siName).join(',')}`);
  const res: any = { Duplicates: [], Meshes: [] as X3DObject[], Head: null, Model: null };
  let targets: X3DObject[];
  if (model) {
    targets = set.map(s => { const d = duplicateMesh(app, s, model!); freezeObj(app, d); res.Meshes.push(s); return d; });
    nya(app, C, 'animation sources of the duplicates are not copied in this build (the script deletes all but those under the face model)');
    const mx = model.properties.find(p => p.type === 'mixer'); if (mx) deleteNode(app, mx);
    res.Head = set[0] ?? null;
  } else { targets = set; model = face; }
  res.Model = model;
  const start = typeof a.inStart === 'number' ? a.inStart : app.anim.startFrame, end = typeof a.inEnd === 'number' ? a.inEnd : app.anim.endFrame;
  shapePlot(app, C, set, targets, start, end, model);
  if (model) app.select([model]);
  else for (const g of ['Controls', 'Envelope', 'Hidden']) { const grp: any = sget(app, 'groups', g); for (const m of [...(grp?.members ?? [])]) deleteNode(app, m); }
  return res;
}

// ================================================================== FaceRobotShapeGoals.js (§9)
function storeShapeGoal(app: App, a: Record<string, any>) {
  const C = 'StoreShapeGoal';
  let src = objArg(app, a.SourceMesh); if (!src) { const s = selection0(app); if (s?.type === 'polymsh') src = s; }
  const tgt = objArg(app, a.FaceRobotMesh) ?? sgetObj(app, 'meshes', 'Mesh');
  const head = objArg(app, a.HeadSpace) ?? sgetObj(app, 'hpoints', 'HeadNull');
  if (!src || !tgt) throw new Error(`${C}: no SourceMesh / FaceRobotMesh (script error)`);
  const goal = text(a.GoalName) || src.name;
  if (!head || !propNamed(head, 'Static KineState')) { logInfo(app, 'HeadSpace requires a static Kinematic State Property, Head Null not enveloped.'); return false; }
  let cl = tgt.clusters.find(c => c.name === 'FaceCluster' && c.isComplete) ?? null;
  let fresh = false;
  if (!cl) { cl = addPointCluster(app, tgt, 'FaceCluster', []); setP(cl, 'alwayscomplete', true); fresh = true; }
  let shape = cl.properties.find(p => p.name === `${goal}_Shape` && p.type === 'clskey') ?? null;
  if (!shape) { const p = new Property(`${goal}_Shape`, 'clskey', []); const c = cl; app.record('AddProp SimpleDeformShape', () => c.addProperty(p), () => c.removeProperty(p)); shape = p; fresh = true; }
  (shape as any).elements = localPoints(src).map(v => [v.x, v.y, v.z]);
  let wm = cl.properties.find(p => p.name === `${goal}_Weight` && (p.type === 'weightmap' || p.type === 'wtmap')) ?? null;
  if (!wm) {
    const p = new Property(`${goal}_Weight`, 'weightmap', [num('weight', 1, 'Default Weight', { min: 0, max: 1 })]); (p as any).values = new Map(); const c = cl;
    app.record('AddProp Weight Map Property', () => c.addProperty(p), () => c.removeProperty(p));
    nya(app, C, 'the weight-map colour setter is called without a colour (script error inferred): the command stops here; weights are not set and no blend parameter / operator is built');
    return undefined;
  }
  const ops = scriptedOpsOf(tgt).filter(o => o.name === 'ShapeGoalOp');
  if (!fresh && ops.some(o => (o as any).inputs?.[0] === shape && (o as any).inputs?.[1] === wm)) { logInfo(app, 'Operator using already exists'); return false; }
  const goals = propNamed(tgt, 'ShapeGoals') ?? customProperty(app, tgt, 'ShapeGoals', []);
  if (!goals.get(goal)) goals.add(num(goal, 1, goal, { min: 0, max: 1, uimin: 0, uimax: 1, keyable: true }));
  inspect(app, goals);
  if (app.commands.has('Add ICE Node')) { logErr(app, 'DEVTBD ICEPORT IN PROGRESS!, '); return undefined; }
  nya(app, C, 'the run-time "Add ICE Node" test (this build has no such command, so the scripted operator is built)');
  const op = scriptedOp(app, tgt, 'ShapeGoalOp', [shape, wm, head, propNamed(head, 'Static KineState'), goals.get(goal)], [], { constructionMode: 2 });
  (op as any).evaluate = (current: number[][]) => {
    const b = Number(goals.val(goal)); if (b <= 0) return current;
    const pose = head.globalMatrix(); const stat = (propNamed(head, 'Static KineState') as any)?.matrix ?? new THREE.Matrix4();
    const rel = pose.clone().multiply(stat.clone().invert());
    return current.map((p, i) => { const w = weightOf(wm, i) * b; const s = (shape as any).elements[i]; if (!s) return p; const g = new THREE.Vector3(s[0], s[1], s[2]).applyMatrix4(rel); return [p[0] * (1 - w) + g.x * w, p[1] * (1 - w) + g.y * w, p[2] * (1 - w) + g.z * w]; });
  };
  return undefined;
}

// ================================================================== AddBlinkKeys.js (§10)
interface BKey { time: number; value: number; tan: number[]; orig: boolean }
function resolveParamArg(app: App, v: any): any {
  if (typeof v === 'string') {
    const name = v.split('.kine.local')[0]; const o = findByName(app, name);
    if (!o) { logErr(app, `${name} not recognized as valid object`); return null; }
    return o.kinematics.local.get('posy');
  }
  return v;
}
export function addBlinkKeys(app: App, a: Record<string, any>) {
  const C = 'fr_AddBlinkKeys';
  const pivot = numOr(a.iPivot, 0), offset = numOr(a.iOffset, 0), scaling = numOr(a.scaling, 1);
  const dbg = (() => { try { return !!app.run('fr_Callstack_IsDebugMode', {}); } catch { return false; } })();
  const param = resolveParamArg(app, a.iParam); if (param === null) return null;
  if (!param || !param.def) { nya(app, C, 'a call without iParam (the parameter is taken from iParam only)'); return null; }
  const bsrc = resolveParamArg(app, a.iBlinkFC); if (bsrc === null) return null;
  const blink: any = bsrc?.keys ? bsrc : bsrc?.def ? app.anim.fcurve(bsrc) : null;
  if (!blink || !blink.keys.length) return null;
  const shift = pivot || offset ? pivot + offset : 0;
  const nk: BKey[] = blink.keys.map((k: any) => { const t = keyTangents(k); return { time: k.time + shift, value: k.value * scaling, tan: [t[0], t[1] * scaling, t[2], t[3] * scaling], orig: false }; });
  const flatK = (l: BKey[]) => l.flatMap(k => [k.time, k.value]), flatT = (l: BKey[]) => l.flatMap(k => k.tan);
  const existing: any = app.anim.fcurve(param);
  if (!existing || !existing.keys.length) { const fc = addFCurve2(app, param, flatK(nk)); setKeyTangents(app, fc, flatT(nk)); return undefined; }
  const tol = 0.001; const first = nk[0].time, last = nk[nk.length - 1].time;
  const newAt = (t: number) => blink.eval(t - pivot - offset) * scaling;   // inferred: the scaled blink value is compared
  const exAt = (t: number) => existing.eval(t);
  const search = (method: any, dir: 1 | -1): number | null => {
    if (dbg) logInfo(app, `Checking KeyRange with method ${method}`);
    const m = unset(method) || method === '' ? 0 : Number(method);
    if (m === 2) return dir > 0 ? first : last;
    if (m === 1) {   // from the pivot outward toward the first (start) / last (end) new key
      const p0 = pivot + offset;
      for (let t = p0; dir > 0 ? t >= first : t <= last; t += dir > 0 ? -0.5 : 0.5) if (newAt(t) + tol < exAt(t)) return t;
      return null;
    }
    for (let t = dir > 0 ? first : last; dir > 0 ? t <= last : t >= first; t += dir > 0 ? 0.5 : -0.5) if (newAt(t) + tol >= exAt(t)) return t;
    return null;
  };
  if (dbg) logInfo(app, ` insertMode ${a.InsertMode}`);
  const s = search(a.InsertMode, 1), e = search(unset(a.leadingInsertMode) ? a.InsertMode : a.leadingInsertMode, -1);
  if (s === null || e === null) { logInfo(app, 'no keys set, existing curve has lids closed at current blinkTimes'); return null; }
  const ex: BKey[] = existing.keys.map((k: any) => ({ time: k.time, value: k.value, tan: keyTangents(k), orig: true }));
  const out: BKey[] = ex.filter(k => k.time < s);
  const hadBefore = out.length > 0;
  let lock = false;
  if (!ex.some(k => k.time === s - 1)) { out.push({ time: s - 1, value: exAt(s - 1), tan: [-0.5, 0, 0.5, 0], orig: false }); lock = true; }
  if (!hadBefore && exAt(s) < nk[0].value) { out[out.length - 1].tan[0] = -0.5; out.push({ time: s + 1, value: exAt(s + 1), tan: [-1, 0, 1, 0], orig: false }); }
  let adjusted = false;
  for (const k of nk) if (k.time >= s && k.time <= e) { if (!adjusted && !lock && out.length) out[out.length - 1].tan[2] = 0.5; adjusted = true; out.push(k); }
  out.push({ time: e + 1, value: exAt(e + 1), tan: [-0.5, 0, 0.5, 0], orig: false });
  out.push(...ex.filter(k => k.time > e));
  out.sort((x, y) => x.time - y.time);
  const kept: BKey[] = [];
  out.forEach((k, i) => { if (i > 0 && k.time - out[i - 1].time <= tol && out[i - 1].orig) return; kept.push(k); });
  for (const k of kept) { k.tan[2] = Math.max(0, k.tan[2]); k.tan[0] = Math.min(0, k.tan[0]); }
  for (let i = 1; i < kept.length; i++) {
    const p = kept[i - 1], q = kept[i], gap = q.time - p.time; const mags = Math.abs(p.tan[2]) + Math.abs(q.tan[0]);
    p.tan[2] = Math.min(p.tan[2], 1.25 * gap); q.tan[0] = Math.max(q.tan[0], -1.25 * gap);
    if (mags > 2 * gap && mags > 0) { const f = (2 * gap) / mags; p.tan[2] *= f; q.tan[0] /= f; }   // as shipped: the left dx grows
  }
  const fc = addFCurve2(app, param, flatK(kept));
  try { setKeyTangents(app, fc, flatT(kept)); } catch (err: any) { if (dbg) logInfo(app, `SetKeyTangents failed: ${err?.message ?? err}`); }
  return undefined;
}

// ================================================================== PaintGameExportPlugin.js (§11)
const PAINT_MAPS: [string, [number, number, number]][] = [['Locators', [255, 137, 0]], ['Spin', [114, 182, 0]], ['JawParent', [146, 112, 61]], ['HeadParent', [120, 50, 50]], ['NeckParent', [120, 120, 120]]];
function paintGameExport(app: App, a: Record<string, any>) {
  const C = 'PaintGameExport';
  const mode = unset(a.inPaintModel) || a.inPaintModel === '' ? null : Number(a.inPaintModel);
  const tongue = mode === 7;
  const skin = sgetObj(app, 'meshes', tongue ? 'Tongue' : 'Mesh'); if (!skin) return undefined;
  const fm = frFaceModel(app); const fsp = fm ? propNamed(fm, 'FaceScale') : null;
  if (!fsp) throw new Error(`${C}: FaceModel.FaceScale is missing (script error)`);
  const size = Number(fsp.val('Scale'));
  const maps: Record<string, Property> = {};
  PAINT_MAPS.forEach(([name, rgb], i) => {
    if (tongue && i >= 2) return;
    let m = weightMapNamed(skin, name);
    if (!m) { m = createWeightMap(app, skin, 'WeightMap', name); setParamU(app, m, 'red', rgb[0]); setParamU(app, m, 'green', rgb[1]); setParamU(app, m, 'blue', rgb[2]); }
    maps[name] = m;
  });
  const curveName = tongue ? 'TongueExportLocators' : 'FaceExportLocators';
  let crv = skin.children.find(c => c.name === curveName) ?? null;
  if (!crv) crv = addCurveList(app, curveName, skin, [{ pts: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)], degree: 1, closed: false, knots: [0, 1] }]);
  const disp = new Property('Display Property', 'display', [int('wirecol', 890, 'Wireframe Color')]); addProperty(app, crv, disp);
  const qualifies = () => { const n = (skin.primitive?.mesh()?.positions.length ?? 0) / 3; const out: number[] = []; for (let i = 0; i < n; i++) if (weightOf(maps.Locators, i) >= 0.9999) out.push(i); return out; };
  let draw = scriptedOpsOf(crv).find(o => o.name === 'DrawLocators') ?? null;
  if (!draw) {
    draw = scriptedOp(app, crv, 'DrawLocators', [crv, crv.kinematics.global, skin, maps.Locators, maps.Spin, skin.kinematics.global],
      [num('size', size, 'size', { min: 0.001, max: 1e10, uimin: 0.1, uimax: Math.ceil(2 * size) })], { portGroup: 'MainGroup', ports: ['OutCurve', 'inCurve', 'inCurveGlobal', 'inSkin', 'inLocatorMap', 'inSpinMap', 'inSkinGlobal'] });
    (draw as any).evaluate = () => drawLocators(skin, maps, Number(draw!.val('size')), qualifies());
    inspect(app, draw);
  }
  const root = app.scene.root;
  let info = root.properties.find(p => p.name === 'DisplayInfo_GameExport') ?? null;
  if (!info) info = addProperty(app, root, new Property('DisplayInfo_GameExport', 'Custom_parameter_list', [int('nbBones', 0, 'Bone Number', { min: 0, max: 100000, uimin: 0, uimax: 1000, desc: 'Bone Number' })]));
  if (!scriptedOpsOf(root).some(o => o.name === 'BoneCounter' && (o as any).inputs?.[0] === maps.Locators)) {
    const bc = scriptedOp(app, root, 'BoneCounter', [maps.Locators], [], { portGroup: 'MainGroup', ports: ['OutSlider', 'inLocatorMap'], output: info.get('nbBones') });
    (bc as any).evaluate = () => qualifies().length;
    b18d(app).customInfo = true;   // Views.ViewB.UserCamera.camvis.custominfo
  }
  app.setParam(info.get('nbBones')!, qualifies().length);
  const icon = skin.children[0] ?? null; if (!icon) return undefined;
  logInfo(app, icon.name);
  const b = 0.6 * size; const st = b18d(app);
  const paint = (map: string, wmode: number, opacity: number, radius: number) => {
    call(app, 'ActivateObjectSelTool'); app.select(maps[map] ? [maps[map]] : []);
    const r = Math.max(0.01, radius); logInfo(app, String(r));
    Object.assign(st.brush, { WeightPaintMode: wmode, Opacity: opacity, Radius: r, paintMap: map });
    st.brush.paintToolCalls++; st.calls.push({ name: 'PaintTool', args: {} });
    setViewVis(app, icon, true);
  };
  switch (mode) {
    case 0: case 7: paint('Locators', 1, 100, 0.2 * b); break;
    case 1: paint('Spin', 0, 5, 2 * b); break;
    case 2: paint('JawParent', 0, 100, 10 * b); break;
    case 3: paint('HeadParent', 0, 100, 10 * b); st.brush.paintToolCalls++; st.calls.push({ name: 'PaintTool', args: {} }); break;
    case 4: paint('NeckParent', 0, 100, 10 * b); break;
    case 5: setViewVis(app, icon, true); inspect(app, draw); break;
    case 6: setViewVis(app, icon, false); break;
    default: break;
  }
  return undefined;
}
/** DrawLocators update: per qualifying skin point a frame (Y = normal, X toward the first neighbour rotated by spin × 2π)
 *  drawn as three axis lines and a square; returns the curve list (point lists, local to the frame's world position). */
export function drawLocators(skin: X3DObject, maps: Record<string, Property>, s: number, pts: number[]) {
  const m = skin.primitive?.mesh(); if (!m || !pts.length) return null;
  const W = skin.globalMatrix(); const R = new THREE.Matrix4().extractRotation(W);
  const P = (i: number) => new THREE.Vector3(m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]);
  const normal = (i: number) => { const n = new THREE.Vector3(); for (const f of m.polygons) { const k = f.indexOf(i); if (k < 0) continue; const a = P(f[(k + f.length - 1) % f.length]).sub(P(i)), c = P(f[(k + 1) % f.length]).sub(P(i)); n.add(c.cross(a)); } return n.normalize().applyMatrix4(R).normalize(); };
  const nbr = (i: number) => { for (const f of m.polygons) { const k = f.indexOf(i); if (k >= 0) return f[(k + 1) % f.length]; } return i; };
  return pts.map(i => {
    const o = P(i).applyMatrix4(W); const y = normal(i); let x = P(nbr(i)).applyMatrix4(W).sub(o); x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
    x = x.applyAxisAngle(y, weightOf(maps.Spin ?? null, i) * 2 * Math.PI); const z = x.clone().cross(y);
    const at = (u: number, v: number, w: number) => o.clone().add(x.clone().multiplyScalar(u)).add(y.clone().multiplyScalar(v)).add(z.clone().multiplyScalar(w));
    return { origin: o, curves: [[at(0, 0, 0), at(0.6 * s, 0, 0)], [at(0, 0, 0), at(0, s, 0)], [at(0, 0, 0), at(0, 0, 0.6 * s)],
      [at(0.6 * s, 0.1 * s, 0.1 * s), at(0.6 * s, -0.1 * s, 0.1 * s), at(0.6 * s, -0.1 * s, -0.1 * s), at(0.6 * s, 0.1 * s, -0.1 * s), at(0.6 * s, 0.1 * s, 0.1 * s)]] };
  });
}

// ================================================================== StabilizeC3D.js (§12)
export function parseStabNameMap(body: string): { stab: string[]; pairs: [string, string][] } {
  const strip = (s: string) => { let a = 0, b = s.length; while (a < b && s.charCodeAt(a) <= 32) a++; while (b > a && s.charCodeAt(b - 1) <= 32) b--; return s.slice(a, b); };
  const blocks: string[][] = []; let cur: string[] | null = null;
  for (const line of body.split('\n')) {
    if (cur === null) { if (line.startsWith('{')) cur = []; continue; }
    if (line.startsWith('}')) { blocks.push(cur); cur = null; if (blocks.length === 2) break; continue; }
    cur.push(line);
  }
  const stab = (blocks[0] ?? []).map(strip).filter(Boolean);
  const pairs = (blocks[1] ?? []).map(l => { const [m, c] = l.split('\t'); return [strip(m ?? ''), strip(c ?? '')] as [string, string]; }).filter(p => p[0]);
  return { stab, pairs };
}
function stabilizeC3D(app: App, a: Record<string, any>) {
  const face = sgetObj(app, 'FaceModel'); if (!face) { logErr(app, 'Face model not found.'); return; }
  const actor = sgetObj(app, 'Actor'); if (!actor) { logErr(app, 'Actor not found.'); return; }
  call(app, 'fr_FlushRetargetedFace');
  for (const n of ['NoseBridge', 'LForehead', 'RForehead', 'Head_Control', 'HeadNull', 'JawEnd_Control']) { const o = findChild(actor, n); if (o) deleteNode(app, o); }
  const nmap = text(a.nmapfilename); const infile = text(a.infilename), outfile = text(a.outfilename);
  let body = ''; try { body = String(app.run('fr_FileRead', { filename: nmap }) ?? ''); } catch { body = ''; }
  if (!body) { logErr(app, `'${nmap}' not found.`); return; }
  const { stab, pairs } = parseStabNameMap(body);
  try { app.ExecuteCommand('fr_LoadC3D', [nmap, infile]); } catch (e: any) { logInfo(app, `fr_LoadC3D failed: ${e?.message ?? e}`); }
  app.anim.frame = 1;
  call(app, 'fr_CreateFaceMap', { namefile: nmap, initdir: '_temporary_.fmap' }); call(app, 'fr_FileDelete', { filename: '_temporary_.fmap' });
  const c3d = app.scene.root.children.find(c => c.name === 'C3DFaceData') ?? null;
  const marker = (n: string) => (c3d ? findChild(c3d, n) : null);
  const abort = (n: string) => { logErr(app, `Couldn't find '${n}'.  Aborting.`); };
  const m0 = marker(stab[0] ?? ''); if (!m0) { abort(stab[0] ?? ''); return; }
  const size = Number(m0.primitive?.val('length') ?? m0.primitive?.val('size') ?? (m0 as any).val?.('length') ?? 1) || 1;
  const created: X3DObject[] = [];
  const setup = (o: X3DObject, name: string, parent?: X3DObject | null) => {
    customProperty(app, o, 'FaceControl', [str('ID', name, 'ID')]); sset(app, 'controls', name, o);
    if (parent) reparent(app, o, parent);
    call(app, 'SetNeutralPose', { InputObjs: o }); created.push(o);
  };
  const cubes: X3DObject[] = [];
  for (const [k, n] of ['NoseBridge', 'LForehead', 'RForehead'].entries()) {
    const m = marker(stab[k] ?? ''); if (!m) { abort(stab[k] ?? ''); return; }
    cubes.push(addInPlace(app, 'Cube', 1, actor, size, globalPos(m), n, 0));
  }
  const hc = addInPlace(app, 'Torus', 0, actor, size, globalPos(cubes[0]), 'Head_Control', 0); setup(hc, 'Head_Control');
  const hn = new Null('HeadNull'); addObject(app, hn, hc); setGlobalPos(app, hn, globalPos(cubes[0]));
  app.run('fr_sset', { key1: 'hpoints', key2: 'HeadNull', value: null });
  for (const c of cubes) reparent(app, c, hc);
  for (const [m, ctl] of pairs) {
    const mk = marker(m); if (!mk) { abort(m); return; }
    const cube = addInPlace(app, 'Cube', 1, actor, size, globalPos(mk), ctl, 0);
    if (ctl.indexOf('_Control') > 0) setup(cube, ctl, hn);
  }
  const lj = findChild(actor, 'LJawEnd'), rj = findChild(actor, 'RJawEnd');
  if (!lj || !rj) { logInfo(app, "Couldn't find 'LJawEnd' and/or 'RJawEnd'.  Aborting."); return; }
  const je = addInPlace(app, 'Cube', 1, hn, size, globalPos(lj).add(globalPos(rj)).multiplyScalar(0.5), 'JawEnd_Control', 0);
  reparent(app, lj, je); reparent(app, rj, je); setup(je, 'JawEnd_Control');
  if (c3d) deleteNode(app, c3d);
  const g = globalPos(actor); g.y = 1; setGlobalPos(app, actor, g);
  call(app, 'fr_C3DToFaceRobot', { c3dfile: infile });
  if (truthy(a.doFilterNoise)) { const fap = propNamed(face, 'FaceAdjustProperties'); if (fap) setParamU(app, fap, 'FilterNoise', true); }
  call(app, 'fr_WriteC3D', { inputfile: infile, outputfile: outfile });
  for (const n of ['FaceCalibrateProperties', 'ZeroPose', 'ZeroPoseO']) { const p = propNamed(face, n); if (p) deleteNode(app, p); }
  call(app, 'fr_FlushRetargetedFace');
  for (const o of created) deleteNode(app, o);
}

// ================================================================== AnimationRigImport.js (§13)
function importAnimationRigProp(app: App): Property {
  const root = app.scene.root;
  let p = root.properties.find(x => x.name === 'ImportAnimationRig') ?? null;
  if (p) return p;
  const np = new Property('ImportAnimationRig', 'customparamset', [str('dotXSI', '', 'dotXSI'), bool('Log', false, 'Log'), int('Method', 0, 'Method', { min: 0, max: 3, uimin: 0, uimax: 3 })]);
  (np as any).helpPage = 'import_export_ImportingaFaceRobotShapeAnimationRig.htm';
  (np as any).fileFilter = 'dotXSI (*.xsi)|*.xsi|All Files (*.*)|*.*||';
  np.onChange((q: any) => {
    if (q.name !== 'dotXSI') return;
    const file = String(q.value ?? ''); const log = np.val('Log');
    queueMicrotask(() => {
      deleteNode(app, np); logInfo(app, `Importing file <<${file}>`);
      try { app.run('fr_ImportAnimationRig', { file, log }); } catch (e: any) { logInfo(app, `fr_ImportAnimationRig failed: ${e?.message ?? e}`); }
    });
  });
  return addProperty(app, root, np);
}
function frImportAnimationRig(app: App, a: Record<string, any>) {
  const C = 'fr_ImportAnimationRig';
  const file = text(a.file);
  const ok = (() => { try { return !!file && hostFs.isFile(file); } catch { return false; } })();
  if (!file || !ok || !file.includes('.xsi')) { logErr(app, 'path not valid'); return undefined; }
  const presetFolder = file.replace('.xsi', '');
  const root = app.scene.root;
  let opts = root.properties.find(p => p.name === 'ImportCrosswalkOptions') ?? null;
  if (!opts) opts = customProperty(app, root, 'ImportCrosswalkOptions', [str('Filename', '', 'Filename'), int('Target', 2, 'Target'), bool('Verbose', false, 'Verbose')]);
  setParamU(app, opts, 'Filename', file); setParamU(app, opts, 'Target', 2); setParamU(app, opts, 'Verbose', truthy(a.log));
  b18d(app).calls.push({ name: 'XSIFileService.ImportDotXSI', args: { file } });
  if (app.commands.has('ImportDotXSI')) { try { app.ExecuteCommand('ImportDotXSI', [file, root]); } catch (e: any) { logInfo(app, `ImportDotXSI failed: ${e?.message ?? e}`); } }
  const models = descendants(root).filter(o => o.type === '#model');
  const model = models[models.length - 1] ?? null; if (!model) { nya(app, C, 'the dotXSI import produced no model in this build'); return undefined; }
  const meshes = descendants(model).filter(o => o.type === 'polymsh');
  let tongue: X3DObject | null = null, faceMesh: X3DObject | null = null, best = -1;
  for (const m of meshes) {
    if (m.name.includes('Tongue')) { tongue = m; continue; }
    const pts = localPoints(m); const bb = new THREE.Box3().setFromPoints(pts.length ? pts : [new THREE.Vector3()]); const s = bb.getSize(new THREE.Vector3()); const vol = s.x * s.y * s.z;
    if (vol >= best) { best = vol; faceMesh = m; }
  }
  for (const o of descendants(model)) { if (/Control$/.test(o.name)) setP(o, 'primary_icon', 4); if (/NeutralPose$/.test(o.name)) setP(o, 'primary_icon', 0); }
  nya(app, C, 'the meaning of the cluster filter path "Shape" (a cluster holding a shape key, or named like it, is taken)');
  const shapeCl = faceMesh?.clusters.find(c => c.name.includes('Shape') || c.properties.some(p => p.type === 'clskey')) ?? null;
  if (!shapeCl) { logErr(app, 'No Shape Targets Found...'); return undefined; }
  // jaw chain
  const olds = ['JawRoot', 'JawHinge', 'JawStart', 'JawEnd_Control'].map(n => findChild(model, n));
  const headNull = findChild(model, 'HeadNull');
  let effector: X3DObject | null = null;
  if (olds.every(Boolean) && headNull) {
    nya(app, C, 'the element order GetSkeleton returns (assumed root, bone, bone, effector)');
    const p = olds.map(o => globalPos(o!));
    const sk = mkChain(app, [`${olds[0]!.name}_new`, `${olds[1]!.name}_new`, `${olds[2]!.name}_new`, `${olds[3]!.name}_new`], [p[0], p[2], p[3]], headNull, { type: 2, normal: new THREE.Vector3(0, 0, 1) });
    const news = sk.all; effector = sk.eff;
    const ed = effector.properties.find(q => q.type === 'display'); if (ed) { setP(ed, 'wirecolorr', 1); setP(ed, 'wirecolorg', 0); setP(ed, 'wirecolorb', 0); }
    setP(effector, 'primary_icon', 4);
    if (news[1]) setP(news[1], 'chntype', 2);
    let folderOk = false; try { folderOk = hostFs.isFolder(presetFolder); } catch { folderOk = false; }
    if (!folderOk) logWarn(app, `${presetFolder} not found`);
    let missing = !folderOk;
    news.forEach((n, i) => {
      const old = olds[i]!; const ptype = n.type;
      for (const f of [`${old.name}_${ptype}.Preset`, `${old.name}_Kinematic_Joint.Preset`, `${old.name}_Kinematic_Chain.Preset`]) {
        const path = hostFs.join(presetFolder, f); let exists = false; try { exists = folderOk && hostFs.isFile(path); } catch { exists = false; }
        if (exists) call(app, 'LoadPreset', { PresetObj: path, InputObjs: n }); else missing = true;
      }
    });
    if (missing) logWarn(app, 'USER CHECK: Chain Preset file Not found, validate jaw bone roll and chain behaviour ');
    for (const k of [2, 3]) for (const c of [...olds[k]!.children]) if (news[k]) reparent(app, c, news[k]);
    const np = findChild(model, 'JawEnd_Control_NeutralPose'); if (np) { reparent(app, np, news[0]); reparent(app, effector, np); }
    olds.forEach((o, i) => { const name = o!.name; o!.name = `${name}_Old`; setViewVis(app, o!, false); news[i].name = name; });
    const oldEnd = olds[3]!;
    for (const pn of ['posx', 'posy', 'posz']) { const fc = app.anim.fcurve(oldEnd.kinematics.local.get(pn)!); if (fc?.keys.length) addFCurve2(app, effector.kinematics.local.get(pn), fc.keys.flatMap(k => [k.time, k.value])); }
    for (const pn of ['nsclx', 'nscly', 'nsclz', 'nrotx', 'nroty', 'nrotz', 'nposx', 'nposy', 'nposz']) { const v = oldEnd.kinematics.local.get(pn); if (v) setP(effector.kinematics.local, pn, v.value); }
    constrain(app, oldEnd, 'Position', [effector]);
  } else nya(app, C, 'the jaw chain needs JawRoot, JawHinge, JawStart, JawEnd_Control and HeadNull in the model');
  ensureMixer(app, model);
  const iceNode = app.commands.has('Add ICE Node');
  const samplers = descendants(model).filter(o => propNamed(o, 'SamplerCache'));
  if (samplers.length) {
    b18d(app).progress.captions.push('Making Operators');
    const tmp = new Null('tmpsampler'); addObject(app, tmp, root);
    for (const ctrl of samplers) {
      const cache = propNamed(ctrl, 'SamplerCache')!; const v = (n: string) => Number(cache.val(n) ?? 0);
      const compName = `${ctrl.name.split('Control')[0]}Compound`;
      const comp: any = (app as any).mixerCompounds?.[compName];
      if (!comp) { logErr(app, `Comopound <${compName}> for Control <${ctrl.name}> Not Found : Control Operators will not be applied...`); continue; }
      if (!comp.clips?.length) { logErr(app, `Compound <${compName}> is empty: Control Operators will not be applied...`); continue; }
      wireColor(app, ctrl, 0);
      const g = new THREE.Matrix4().compose(new THREE.Vector3(v('PosX'), v('PosY'), v('PosZ')), new THREE.Quaternion().setFromEuler(new THREE.Euler(v('RotX') * Math.PI / 180, v('RotY') * Math.PI / 180, v('RotZ') * Math.PI / 180, 'ZYX')), new THREE.Vector3(v('SclX') || 1, v('SclY') || 1, v('SclZ') || 1));
      const par = ctrl.parentObj; if (par) g.premultiply(par.globalMatrix());
      const p0 = new THREE.Vector3().setFromMatrixPosition(g); setGlobalPos(app, tmp, p0);
      if (!iceNode) call(app, 'fr_ApplyShapeWeightOp', { clips: comp.clips, sampler: tmp, DX: v('DenX'), DY: v('DenY'), DZ: v('DenZ'), control: ctrl, parent: par, neutral: !!par?.name.includes('NeutralPose'), mode: 0 });
    }
    deleteNode(app, tmp);
  }
  const fsc = Number(propNamed(model, 'FaceScale')?.val('Scale') ?? 1) || 1;
  for (const n of descendants(model)) if (n.type === 'null') setP(n, 'size', fsc / (Number(n.parentObj?.kinematics.local.val('scly')) || 1));
  call(app, 'DeleteUnusedMixerTracks', { Mixer: model });
  buildEyesConstraint(app, model);
  if (effector) setP(effector, 'size', 2 * fsc);
  if (iceNode) {
    nya(app, C, 'the ICE branch (FR_Import_Animation_Rig_To_ICE, cmd-b13e SPEC-PARTIAL)');
    call(app, 'FR_Import_Animation_Rig_To_ICE', { Model: model.name, A: true, B: false });
    if (tongue) call(app, 'FR_Import_Animation_Rig_To_ICE', { Model: model.name, A: true, B: true });
  }
  return model;
}
function buildEyesConstraint(app: App, model: X3DObject | null) {
  if (!model) return undefined;
  const look = findChild(model, 'LookAt_Control'), le = findChild(model, 'LEye_Control'), re = findChild(model, 'REye_Control');
  if (!look || !le || !re) return undefined;
  const cs = [le, re].map(e => constrain(app, e, 'Direction', [look], { cnscomp: true, upvct_active: 1, dirx: 1, diry: 0, dirz: 0 }));
  if (le.parentObj?.name.includes('NeutralPose')) for (const c of cs) if (c) { const ox = Number(c.val('dirx')), oz = Number(c.val('dirz')); c.set('dirx', -oz); c.set('diry', 0); c.set('dirz', ox); }
  return undefined;
}

// ================================================================== StereoCamera.js (§14)
const CAM_INPUTS = ['format.std', 'format.aspect', 'fov', 'pixelratio', 'interestdist', 'near', 'far', 'projplanedist', 'projplanewidth', 'projplaneheight',
  'projplaneoffx', 'projplaneoffy', 'subpixelzoom', 'subfrustumleft', 'subfrustumright', 'subfrustumbottom', 'subfrustumtop'];
const CAM_DEFAULTS: Record<string, number> = { 'format.std': 0, 'format.aspect': 1.333, pixelratio: 1, interestdist: 1, projplanedist: 1, projplanewidth: 1, projplaneheight: 1, projplaneoffx: 0, projplaneoffy: 0, subpixelzoom: 1, subfrustumleft: 0, subfrustumright: 1, subfrustumbottom: 0, subfrustumtop: 1 };
function camParam(c: X3DObject, n: string) { const p = c.primitive!; if (!p.get(n)) setP(p, n, CAM_DEFAULTS[n] ?? 0); return p.get(n)!; }
export function stereoOffset(sep: number, ppd: number, zp: number) { return (sep * 0.5 * ppd * 0.1 / zp) / 2.54; }
function stereoUpdate(center: X3DObject, side: X3DObject, prop: Property, left: boolean) {
  for (const n of CAM_INPUTS) if (n !== 'projplaneoffx') camParam(side, n).value = camParam(center, n).value;
  const type = Number(prop.val('StereoType')); const film = Number(prop.val(left ? 'FilmOffsetLeft' : 'FilmOffsetRight'));
  let off = Number(camParam(center, 'projplaneoffx').value);
  if (type === 2) off += film + (left ? 1 : -1) * stereoOffset(Number(prop.val('Separation')), Number(camParam(center, 'projplanedist').value), Number(prop.val('ZeroParallax')));
  else if (type === 1) off += film;
  camParam(side, 'projplaneoffx').value = off;
}
function stereoProperty(): Property {
  const P = (n: string, d: number, o: any) => num(n, d, n, { keyable: true, ...o });
  const p = new Property('Stereo', 'Stereo', [
    int('StereoType', 2, 'Stereo Type', { min: 0, max: 4, uimin: 0, uimax: 4, keyable: true }),
    P('Separation', 0.635, { min: 0, uimin: 0, uimax: 20, label: 'Interaxial Separation' }), P('ZeroParallax', 25.4, { min: 0.0001, uimin: 0.001, uimax: 1000 }),
    P('ToeIn', 0, { uimin: 0, uimax: 30 }), P('FilmOffsetLeft', 0, { uimin: -1, uimax: 1 }), P('FilmOffsetRight', 0, { uimin: -1, uimax: 1 }),
  ]);
  (p as any).helpPage = 'Stereo_Property_Editor.htm';
  (p as any).stereoTypeItems = [['Off', 0], ['Converged', 1], ['Off-axis', 2], ['Parallel', 3]];
  return p;
}
function getPrimStereoCamera(app: App, a: Record<string, any>) {
  const C = 'GetPrimStereoCamera'; const n = text(a.ObjName) || 'StereoCamera';
  const mkRoot = (name: string, parent: X3DObject) => { const r = new Null(app.scene.uniqueName(name)); (r as any).siPrimType = 'CameraRoot'; addObject(app, r, parent); return r; };
  const mkCam = (name: string, parent: X3DObject) => { const c = new Camera(app.scene.uniqueName(name)); addObject(app, c, parent); return c; };
  const root = mkRoot(`${n}_Root`, app.scene.root);
  const center = mkCam(n, root); const interest = new Null(app.scene.uniqueName(`${n}_Interest`)); addObject(app, interest, root);
  setGlobalPos(app, interest, new THREE.Vector3(0, 0, -1)); (center as any).interest = interest;
  const lroot = mkRoot(`${n}_LeftRoot`, root), rroot = mkRoot(`${n}_RightRoot`, root);
  const left = mkCam(`${n}_Left`, lroot), right = mkCam(`${n}_Right`, rroot);
  for (const c of [center, left, right]) setP(c.primitive!, 'projplane', true);
  for (const o of [root, lroot, rroot, interest]) setViewVis(app, o, !o.visible);
  for (const [c, rgb] of [[left, [0.6, 0, 0]], [right, [0, 0.7, 0.7]]] as const) { let d = c.properties.find(p => p.type === 'display'); if (!d) { d = new Property('Display', 'display', []); addProperty(app, c, d); } setP(d, 'wirecolorr', rgb[0]); setP(d, 'wirecolorg', rgb[1]); setP(d, 'wirecolorb', rgb[2]); }
  const prop = addProperty(app, root, stereoProperty());
  const kw = (o: Node, k: string) => { try { app.run('SetUserKeyword', { InputObjs: [o], Keywords: k }); } catch { (o as any).userKeywords = k; } };
  kw(center, 'Stereo,Center'); kw(left, 'Stereo,Left'); kw(right, 'Stereo,Right'); kw(prop, 'Stereo,Property'); kw(root, 'Stereo,Root');
  nya(app, C, 'the StereoCameraRig / StereoCameraSecondaryRig ICE compounds (side-camera placement, ToeIn): the ICE trees are recorded, not evaluated');
  scriptedOp(app, root, 'ICETree', [], [], { compound: 'StereoCameraRig', ports: { Camera: center.name }, executePort: 'port1' });
  scriptedOp(app, lroot, 'ICETree', [], [bool('Left', true, 'Left')], { compound: 'StereoCameraSecondaryRig', ports: { Master: root.name, Slave: left.name }, executePort: 'port1' });
  scriptedOp(app, rroot, 'ICETree', [], [bool('Left', false, 'Left')], { compound: 'StereoCameraSecondaryRig', ports: { Master: root.name, Slave: right.name }, executePort: 'port1' });
  for (const [side, isLeft] of [[left, true], [right, false]] as const) {
    const inputs = [side.primitive, ...CAM_INPUTS.map(k => camParam(center, k)), ...['StereoType', 'Separation', 'ZeroParallax', isLeft ? 'FilmOffsetLeft' : 'FilmOffsetRight'].map(k => prop.get(k))];
    const op = new Operator(isLeft ? 'StereoLeftConstraint' : 'StereoRightConstraint', isLeft ? 'StereoLeftConstraint' : 'StereoRightConstraint', []);
    Object.assign(op as any, { custom: true, inputs, output: side.primitive, AlwaysEvaluate: false, update: () => stereoUpdate(center, side, prop, isLeft) });
    const l = ((side as any).customOps ??= []); app.record('AddCustomOp', () => { l.push(op); op.parent = side; }, () => { const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); });
    stereoUpdate(center, side, prop, isLeft);
    const off = prop.onChange(() => stereoUpdate(center, side, prop, isLeft)); void off;
  }
  app.select([root]); inspect(app, prop);
  return [root];
}

// ================================================================== registration
export function registerFaceRobotB18dCommands(app: App) {
  b18d(app);
  // helpers for tools/compare_fr_b18d_commands.mjs
  (app as any).frB18d = { PolymeshHelper, parseDNAText, parseStabNameMap, noseRingPoints, stereoOffset, LayoutRef, Property, Null, Model, Camera, Constraint, setMeshGeometry, THREE };
  const reg = (name: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any, extra: Partial<CommandDef> = {}) =>
    app.register({ name, label: name, category: CAT, description: '', args: args.map(([n, d]) => ({ name: n, default: d })), execute, ...extra } as CommandDef);
  const N = null;

  // MeshHelper.js
  reg('fr_GetPolymesh', [['iprimitive', N], ['inOverride', N], ['ivertices', N], ['iPolygonData', N]], frGetPolymesh);
  reg('fr_GetFRPolymesh', [], (app) => b18d(app).cached);
  reg('fr_CapAllHoles', [['inMesh', N], ['Freeze', N]], (app, a) => { const h = frGetPolymesh(app, { iprimitive: a.inMesh, inOverride: 1 }); if (h === false) return undefined; h.CapHoles(); return undefined; });

  // Utilities.js
  reg('fr_GetKeyed_safe', [['KeyArray', N], ['Model', N]], (app, a) => [...getKeyedIn(app, 'fr_GetKeyed_safe', keyList(a.KeyArray), a.Model)]);
  const builtin = app.commands.get('AddUserKeyword');
  const builtinArgs = builtin && builtin.args.some(x => x.name === 'InputObjs') ? builtin.args : [{ name: 'InputObjs', default: null }, { name: 'Keywords', default: '' }];
  app.register({
    ...(builtin ?? {}), name: 'AddUserKeyword', label: builtin?.label ?? 'Add User Keyword', category: builtin?.category ?? 'Viewing|Property', description: builtin?.description ?? '',
    args: [...builtinArgs, { name: 'Obj', default: null }, { name: 'Key', default: null }],
    execute(app, a) {
      if (!unset(a.Obj) || !unset(a.Key)) { frAddUserKeyword(app, objArg(app, a.Obj) ?? (a.Obj instanceof Node ? a.Obj : null), a.Key); return undefined; }
      if (builtin) return builtin.execute(app, a);
      return undefined;
    },
  } as CommandDef);
  reg('GetKeyed', [['KeyArray', N], ['Model', N]], (app, a) => getKeyedIn(app, 'GetKeyed', keyList(a.KeyArray), a.Model));
  reg('GetKeyed2', [['KeyStringList', N], ['Model', N]], (app, a) => getKeyedIn(app, 'GetKeyed2', keyList(text(a.KeyStringList)), a.Model));
  reg('FilterKeyed', [['ObjectCollection', N], ['KeyStringList', N], ['RemoveKeys', N]], (app, a) => {
    const objs: Node[] = (Array.isArray(a.ObjectCollection) ? a.ObjectCollection.map((x: any) => (x instanceof Node ? x : objArg(app, x))) : objList(app, a.ObjectCollection)).filter((x: any): x is Node => !!x);
    const m = filterKeyed(objs, keyList(a.KeyStringList));
    return truthy(a.RemoveKeys) ? objs.filter(o => !m.includes(o)) : m;
  });
  reg('SetControlKeys', [], (app) => setControlKeys(app));
  reg('MirrorControls', [['Controls', N], ['Global', N]], mirrorControls);

  // AdjustPanelKeys.js
  reg('fr_SaveAdjustPanelKeys', [], (app) => { saveAdjustKeys(app); return undefined; });
  reg('fr_PrintAdjustPanelKeys', [], (app) => { const s = needAdjust(app, 'fr_PrintAdjustPanelKeys'); s.names.forEach((n, i) => { logInfo(app, n); logInfo(app, `  keyArr=${s.keys[i].join(',')}`); logInfo(app, `  tanArr=${s.tangents[i].join(',')}`); }); return undefined; });
  reg('fr_RestoreAdjustPanelKeys', [], (app) => {
    const s = needAdjust(app, 'fr_RestoreAdjustPanelKeys'); const p = adjustProp(app, 'fr_RestoreAdjustPanelKeys');
    s.names.forEach((n, i) => { const q = p.get(n); if (!q) return; const fc = addFCurve2(app, q, s.keys[i]); setKeyTangents(app, fc, s.tangents[i]); });
    return undefined;
  });

  // ParseOpenDNA.js
  reg('ParseDNAFile', [['filename', N], ['debug', N]], (app, a) => parseDNAFile(app, 'ParseDNAFile', a.filename, a.debug));
  reg('GetDNAFile', [], (app) => getDNAFile(app, ''));
  reg('LogDNA', [['DNA', N], ['key', N]], (app, a) => {
    const dna = !unset(a.DNA) && a.DNA !== '' && a.DNA !== 0 && typeof a.DNA === 'object' ? a.DNA : parseDNAFile(app, 'LogDNA', null, null);
    if (!dna) return undefined;
    if (!unset(a.key) && a.key !== '') { const l = dna[text(a.key)]; if (Array.isArray(l)) l.forEach((e: any, i: number) => logInfo(app, `${i}=${e}`)); return undefined; }
    dnaDump(app, dna); return undefined;
  });

  // ModifyFaceLayout.js (WIRE_CORRECTIONS_B18 item 4)
  reg('fr_ToggleFaceLayout', [], (app) => toggleFaceLayout(app), { undoable: false });
  reg('fr_SetAltLayout', [], (app) => { const l = new LayoutRef(activeLayoutName(app)); sset(app, 'Layout', null, l); return l; }, { undoable: false });

  // PlotToShapes.js
  reg('PlotGlobal', [['inObj', N], ['start', N], ['end', N], ['inName', N], ['mod', N]], plotGlobal);
  reg('PlotFaceRobot', [['NewModelName', N], ['inMeshes', N], ['inStart', N], ['inEnd', N], ['inFaceModel', N]], plotFaceRobot);

  // InitNeck.js / InitNose.js
  reg('fr_InitNeck', [['inHeadMesh', N], ['inNeckMarkers', N]], frInitNeck);
  reg('fr_InitNose', [['inScale', N], ['inGroups', N], ['inSymmetry', N]], frInitNose);

  // FaceRobotShapeGoals.js, AddBlinkKeys.js, PaintGameExportPlugin.js, StabilizeC3D.js
  reg('StoreShapeGoal', [['GoalName', N], ['SourceMesh', N], ['FaceRobotMesh', N], ['HeadSpace', N], ['ClusterName', N]], storeShapeGoal);
  reg('fr_AddBlinkKeys', [['iObj', N], ['iParam', N], ['iBlinkFC', N], ['iPivot', N], ['iOffset', N], ['InsertMode', N], ['leadingInsertMode', N], ['scaling', N]], addBlinkKeys);
  reg('PaintGameExport', [['inPaintModel', N]], paintGameExport);
  reg('fr_StabilizeC3D', [['infilename', N], ['outfilename', N], ['nmapfilename', N], ['doFilterNoise', N]], (app, a) => { stabilizeC3D(app, a); return undefined; }, { noLog: true });

  // AnimationRigImport.js
  reg('ImportAnimationRig', [], (app) => { logInfo(app, 'ImportAnimationRig_Execute called'); inspect(app, importAnimationRigProp(app)); return true; }, { category: '' });
  reg('fr_ImportAnimationRig', [['file', N], ['log', N]], frImportAnimationRig, { category: '', description: 'Export to dot XSI with specific Options' });
  reg('fr_BuildEyesConstraint', [['model', N]], (app, a) => buildEyesConstraint(app, objArg(app, a.model)), { category: '' });

  // StereoCamera.js (WIRE_CORRECTIONS_B18 item 12)
  reg('GetPrimStereoCamera', [['ObjName', 'StereoCamera']], getPrimStereoCamera);
}
export { ROW };
