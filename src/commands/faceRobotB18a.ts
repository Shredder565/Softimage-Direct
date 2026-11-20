// Ledger row CMD-B18a (Face Robot `GeneralHelper.js`, a JScript plug-in): 36 script commands.
//   fr_FolderExists fr_GetCentroid fr_GetFile fr_GetResolvedDNAPath fr_GetGlobalPos fr_SetOffsetMap fr_SetOffsetMap2
//   fr_IsCollection fr_ToCollection fr_KeyAllControls fr_KeySelControls fr_ResetPaths fr_SelectAllControls fr_GetControls
//   fr_ObjectView fr_ResetSel fr_ResetAll fr_PoseAll fr_PoseSel fr_SetPickPoints fr_GetPickPoints fr_StoreEnvelope
//   fr_RestoreEnvelope fr_GetPointsAsText fr_StorePP fr_RestorePP fr_ApplyType fr_ResetRetarget fr_IsRetargeted
//   CleanSources EmptyBackups logv loga logc logt suma
// Brief: the "Wire contract" sections of docs/ghidra/cmd-b18a-fr-generalhelper-scripts.md (including the `(inferred)`
// parts and the SPEC-PARTIAL commands) and docs/re/WIRE_CORRECTIONS_B18.md items 1, 5, 6, 7, 11. Original TypeScript
// written from that behavioural prose only; no script text is reproduced and no XSIBATCH golden exists.
//
// Mapping onto this build:
//  * Registration follows data/commands_full.json: category `Custom`, every argument without default. These
//    registrations replace the argument-less `frHostShells` of faceRobotModule.ts (app.register overwrites).
//  * "NoLog" (siNoLogging in `_Init`) is the bus flag `noLog`.
//  * JScript runtime errors (null member access and the like) are thrown as SiStatusError E_FAIL whose message starts
//    with the command name.
//  * `XSI.Collection` / `X3DObjectCollection` / `Selection` are `XSICollection` (an Array with a `className`); a plain JS
//    array is a JScript array (class `JScriptTypeInfo`). Vector3 values are THREE.Vector3 (class `ISIVector3`).
//  * Environment variables (FACEROBOTROOT, FACEROBOTDATAROOT, ...) live in `app.faceRobotB14.rows.B18a.env`; their
//    defaults are inferred from the plug-in location `FaceRobot\Application\Plugins\` (contract Q5: where they are set
//    is not attested). XSIUtils.Slash is `\`.
//  * Retarget operators of the local kinematics are `Operator` nodes in `<object>.kinematics.local.nestedObjects`;
//    the older B14d marker list `<object>.retargetOps` (type names) is honoured as well for the "is retargeted" test.
//  * Envelope weights are this build's EnvelopeOperator weights; the blob stores them as percentages (Softimage
//    convention, inferred), deformer index fastest (contract, inferred).
//  * Branches the contract leaves open log "<command>: not yet attested: <what> (CMD-B18a)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Model, Null, Group, Property, Operator, Cluster, threeOrder } from '../core/scene';
import { Parameter } from '../core/params';
import { envelopeOf, EnvelopeOperator } from '../core/envelope';
import { alembicState } from './alembicSeqCam';
import { storeOf as sourcesOf } from './clipsSourcesB15dShared';
import { frDesktop, userPref, setUserPref } from './faceRobotB14bcShared';
import {
  frStore, rowState, fail, logNya as logNyaRow, isFolder, isFile, hostFs, faceMesh, findByName, propNamed, entryObject,
  E_FAIL,
} from './faceRobotB14Shared';

const ROW = 'CMD-B18a';
const CAT = 'Custom';
const SLASH = '\\';
const nya = (app: App, command: string, what: string) => logNyaRow(app, command, what, ROW);
const jsErr = (command: string, what: string) => fail(E_FAIL, `${command}: ${what} (JScript runtime error)`);

// ------------------------------------------------------------------ row state
export interface B18aState {
  env: Record<string, string>;
  /** User path (XSI user folder) used by CleanSources bit 2 (inferred default). */
  userPath: string;
  /** Camera Display tweaks of fr_ObjectView, by camera name. */
  cameraDisplay: Record<string, Record<string, any>>;
  hooks: {
    /** GetProjects progress bar cancel (true = cancelled). */
    cancelScan?: (path: string, level: number) => boolean;
    /** EmptyBackups confirmation: the ticks per found folder, or null for Cancel. Default: OK with every box ticked. */
    confirmBackups?: (paths: string[]) => boolean[] | null;
  };
  /** Calls into commands of other rows (name, args), newest last. */
  calls: { name: string; args: any }[];
  /** Status texts of the GetProjects progress bar. */
  status: string[];
}
const defaultRoot = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\FaceRobot';   // inferred (contract Q5)
export const b18a = (app: App) => rowState<B18aState>(app, 'B18a', () => ({
  env: { FACEROBOTROOT: defaultRoot, FACEROBOTDATAROOT: defaultRoot + '\\Data\\FaceRobot' },
  userPath: 'C:\\Users\\user\\Autodesk\\Softimage_2015_SP2',
  cameraDisplay: {}, hooks: {}, calls: [], status: [],
}));

// ------------------------------------------------------------------ collections, classes, small JScript helpers
export class XSICollection extends Array<any> {
  className = 'Object';
  unique = false;
  static get [Symbol.species]() { return Array; }
  get Count() { return this.length; }
  Item(i: number) { return this[i]; }
  Add(x: any) { if (x === undefined || x === null) return; if (this.unique && this.includes(x)) return; this.push(x); }
  AddItems(xs: Iterable<any>) { for (const x of xs) this.Add(x); }
  Remove(x: any) { const i = this.indexOf(x); if (i >= 0) this.splice(i, 1); }
}
export function collection(items: Iterable<any> = [], className = 'Object', unique = false): XSICollection {
  const c = new XSICollection(); c.className = className; c.unique = unique; c.AddItems(items); return c;
}
/** The global `Selection` object. */
const selectionObject = (app: App) => collection(app.selection, 'Selection');
/** JScript truthiness of an argument. */
const truthy = (v: any) => !!v && !(typeof v === 'number' && Number.isNaN(v));
const empty = (v: any) => !truthy(v);
const isVec = (v: any) => v instanceof THREE.Vector3 || (!!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Node) && ('x' in v || 'X' in v) && ('y' in v || 'Y' in v));
const vx = (v: any) => Number(v.x ?? v.X), vy = (v: any) => Number(v.y ?? v.Y), vz = (v: any) => Number(v.z ?? v.Z);
/** Softimage `ClassName` of a value. */
export function className(v: any): string {
  if (v instanceof XSICollection) return v.className;
  if (Array.isArray(v)) return 'JScriptTypeInfo';
  if (v instanceof Model) return 'Model';
  if (v instanceof Null) return 'Null';
  if (v instanceof X3DObject) return 'X3DObject';
  if (v instanceof Group) return 'Group';
  if (v instanceof Cluster) return 'Cluster';
  if (v instanceof Property) return v.type === 'UserDataBlob' ? 'UserDataBlob' : v.type === 'customparamset' ? 'CustomProperty' : 'Property';
  if (v instanceof Operator) return 'Operator';
  if (v instanceof Parameter) return 'Parameter';
  if (isVec(v)) return 'ISIVector3';
  return '';
}
/** Softimage FullName (`Model.Object`, no parent chain, the scene root left out). */
export function siFullName(n: any): string {
  if (n instanceof X3DObject) {
    const m = n.parentObj ? n.parentObj.model : null;
    return m && m.parentObj ? `${siFullName(m)}.${n.name}` : n.name;
  }
  if (n instanceof Parameter) return `${siFullName(n.owner)}.${n.name}`;
  if (n instanceof Node || (n && typeof n === 'object' && 'parent' in n && 'name' in n)) {
    const parts: string[] = []; let x: any = n;
    while (x && !(x instanceof X3DObject)) { parts.unshift(x.name === 'Kinematics' ? 'kine' : x.type === 'kine.local' ? 'local' : x.type === 'kine.global' ? 'global' : x.name); x = x.parent; }
    return x ? [siFullName(x), ...parts].join('.') : parts.join('.');
  }
  return String(n ?? '');
}
/** JScript string conversion of a value (objects give their FullName). */
const jsText = (v: any): string => (v instanceof Node || v instanceof Parameter ? siFullName(v) : v === undefined ? 'undefined' : v === null ? 'null' : String(v));
const resolveObj = (app: App, v: any): X3DObject | null => (v instanceof X3DObject ? v : typeof v === 'string' && v ? findByName(app, v) : null);
const buildPath = (...p: string[]) => p.filter(s => s !== '').reduce((a, b) => (a === '' ? b : a.replace(/[\\/]+$/, '') + SLASH + b.replace(/^[\\/]+/, '')), '');
const resolvePath = (p: string) => p.replace(/\//g, SLASH);
const call = (app: App, name: string, args: Record<string, any> = {}) => {
  b18a(app).calls.push({ name, args });
  if (!app.commands.has(name)) { app.logMsg('info', `${name}: command not available in this build`); return undefined; }
  return app.run(name, args);
};
/** Face model (store): `fr_sget("FaceModel")`. */
const storeFaceModel = (app: App): X3DObject | null => entryObject(app, '_', 'FaceModel');
/** `fr_GetFaceModel(false)` (CMD-B14a). */
const getFaceModel = (app: App): X3DObject | null => { const r = call(app, 'fr_GetFaceModel', { MakeFaceModel: false }); return r instanceof X3DObject ? r : null; };
const controlKeys = (app: App): string[] => frStore(app).keys('controls');
const controlK = (app: App, k: string) => entryObject(app, 'controls', k);
const hasFaceControl = (o: any) => o instanceof X3DObject && !!propNamed(o, 'FaceControl');
/** SIFilter(..., "FaceRobotControl"): objects carrying the FaceControl marker property (inferred filter rule). */
const isFaceRobotControl = hasFaceControl;
const POSROT = ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'];
function zeroPosRot(app: App, o: X3DObject) { for (const p of POSROT) { const q = o.kinematics.local.get(p); if (q) app.setParam(q, 0); } }
function descendantNamed(root: X3DObject, name: string): X3DObject | null { for (const d of root.descendants()) if (d.name === name) return d; return null; }
/** `TaggedParameters(siTag1, false)` of an object. */
function taggedParams(o: X3DObject): Parameter[] {
  const sets: any[] = [o.kinematics.local, o.kinematics.global, o, ...(o.primitive ? [o.primitive, ...o.primitive.operators] : []), ...o.properties];
  const out: Parameter[] = [];
  for (const s of sets) for (const p of s.params as Parameter[]) if ((Number((p as any).tags) & 1) && !out.includes(p)) out.push(p);
  return out;
}
function findParamOn(o: X3DObject, name: string): Parameter | undefined {
  for (const ps of [...(o.primitive?.operators ?? []), o.primitive, o, ...o.properties]) { const p = ps?.get(name); if (p) return p; }
  return undefined;
}
const globalPos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());

// ------------------------------------------------------------------ §2 queries and conversions
function frFolderExists(_app: App, a: Record<string, any>) { return typeof a.inPath === 'string' && isFolder(a.inPath); }
function frGetFile(app: App, a: Record<string, any>) {
  return resolvePath(buildPath(b18a(app).env.FACEROBOTROOT ?? '', 'Application', jsText(a.inFileName)));
}
function frGetResolvedDNAPath(app: App) {
  const m = storeFaceModel(app); const fs = m ? propNamed(m, 'FaceState') : undefined; const p = fs?.get('DNA');
  if (!p) return '';
  const dna = String(p.value ?? '');
  if (!dna.startsWith('$')) return dna;
  const seg = dna.split(SLASH);
  if (seg[0].length > 1) seg[0] = b18a(app).env[seg[0].slice(1)] ?? '';   // unset variable -> "" (inferred)
  return seg.join(SLASH);
}
function frGetGlobalPos(app: App, a: Record<string, any>) {
  const C = 'fr_GetGlobalPos'; let o: any = a.iobj;
  if (typeof o === 'string' || empty(o)) {
    if (empty(o)) return false;
    o = descendantNamed(app.scene.root, o);
    if (!o) return false;
  }
  if (!(o instanceof X3DObject)) throw jsErr(C, 'iobj has no global transform');
  return globalPos(o);
}
function frGetCentroid(app: App, a: Record<string, any>) {
  const C = 'fr_GetCentroid'; const v = a.inObj; const cls = className(v);
  let pts: THREE.Vector3[] | null = null;
  if (cls === 'X3DObject' || cls === 'Model' || cls === 'Null') {
    const g = (v as X3DObject).primitive?.geom(); const P: ArrayLike<number> | undefined = g?.positions ?? (g?.cvs ? (g.cvs as number[][]).flatMap(c => c.slice(0, 3)) : undefined);
    if (P && P.length) { const M = (v as X3DObject).globalMatrix(); pts = []; for (let i = 0; i + 2 < P.length; i += 3) pts.push(new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(M)); }
  } else if (cls === 'JScriptTypeInfo' && (v as any[]).length) pts = (v as any[]).map(x => new THREE.Vector3(vx(x), vy(x), vz(x)));
  if (!pts) throw jsErr(C, 'the point list is undefined (inObj is not an object with geometry nor a non-empty array of vectors)');
  const s = new THREE.Vector3(); for (const p of pts) s.add(p);
  return s.multiplyScalar(1 / pts.length);
}
function isCollection(c: any): any {
  if (empty(c)) return false;
  const cls = className(c);
  if (cls === 'Object') return c;
  if (cls === 'Selection' || cls === 'X3DObjectCollection') return collection(c);
  return false;
}
function frToCollection(app: App, a: Record<string, any>) {
  const C = 'fr_ToCollection'; const v = a.inObj;
  if (truthy(isCollection(v))) return v;
  const out = collection();
  const cls = className(v);
  if (cls === 'X3DObject' || cls === 'Model' || cls === 'Null') out.Add(v);
  else if (cls === 'Group') out.AddItems((v as Group).members);
  else if (typeof v === 'string') {
    const parts = v.split(',');
    nya(app, C, `ArrayToCollection of the string pieces [${parts.join('|')}] (helper not defined in GeneralHelper.js, contract Q1); empty collection returned`);
  }
  return out;
}
function frGetPointsAsText(app: App) {
  const first = () => { const cs = app.compSel; return cs && app.selection[0] === cs.obj ? cs : null; };
  let cs = first();
  if (cs && cs.kind === 'point' && cs.points.size) return `${cs.obj.fullName}.pnt[${[...cs.points].join(',')}]`;
  if (cs && cs.kind === 'polygon' && cs.polygons.size) {
    call(app, 'SelectAdjacent', { InputObjs: null, SelFilter: 'Point', ExtendSelection: false });
    cs = first();
    if (cs && cs.kind === 'point' && cs.points.size) return `${cs.obj.fullName}.pnt[${[...cs.points].join(',')}]`;
    return '';
  }
  return '';
}

// ------------------------------------------------------------------ §3 controls, reset, keys, poses
function getControls(app: App, toggle: any): XSICollection {
  const C = 'fr_GetControls';
  const M = getFaceModel(app);
  if (!M) throw jsErr(C, 'no face model (fr_GetFaceModel(false) returned nothing)');
  const out = collection([...M.descendants()].filter(isFaceRobotControl), 'X3DObjectCollection');
  if (truthy(toggle) && app.selection.length) for (const s of app.selection) out.Remove(s);
  return out;
}
function frResetAll(app: App) {
  const C = 'fr_ResetAll';
  const M = getFaceModel(app);
  if (!M) throw jsErr(C, 'no face model (fr_GetFaceModel(false) returned nothing)');
  for (const k of controlKeys(app)) { const o = descendantNamed(M, k); if (o) zeroPosRot(app, o); }
}
function frResetSel(app: App, a: Record<string, any>) {
  const work = truthy(a.toggle) ? [...getControls(app, a.toggle)] : [...app.selection];
  for (const o of work) if (hasFaceControl(o)) zeroPosRot(app, o);
}
function saveKeys(app: App, C: string, params: Parameter[]) {
  if (!params.length) { nya(app, C, 'SaveKey with an empty parameter collection (nothing keyed here)'); return; }
  // Dictionary.GetObject("PlayControl") is always found in this build: the key goes on round(PlayControl.Key)
  const t = Math.round(app.anim.frame);
  for (const p of params) {
    const fc = app.anim.fcurve(p as any, true)!; const had = fc.keys.find((k: any) => k.time === t); const v = p.value;
    app.record('SaveKey', () => fc.addKey(t, v), () => { if (had) fc.addKey(t, had.value); else fc.removeKey(t); });
  }
  app.events.emit('params');
}
function keyControls(app: App, C: string, controls: X3DObject[]) {
  const keyables = collection([], 'Object', true); const exclusions = new Set<string>();
  for (const o of controls) for (const p of taggedParams(o)) {
    keyables.Add(p);
    const seg = siFullName(p).split('.');
    if (seg.length > 1 && seg[1].length > 14 && seg[1].endsWith('_ControlOffset')) { seg[1] = seg[1].slice(0, -6); exclusions.add(seg.join('.')); }
  }
  const keep = keyables.length ? [...keyables].filter((p: Parameter) => !exclusions.has(siFullName(p))) : [];
  saveKeys(app, C, keep);
  return keep;
}
function frKeyAllControls(app: App) {
  const C = 'fr_KeyAllControls';
  const keys = controlKeys(app);
  const ctl: X3DObject[] = []; for (const k of keys) { const o = controlK(app, k); if (o) ctl.push(o); }
  b18a(app).calls.push({ name: C, args: { keyed: keyControls(app, C, ctl).map(siFullName) } });
}
function frKeySelControls(app: App) {
  const C = 'fr_KeySelControls';
  const ctl = app.selection.filter(hasFaceControl) as X3DObject[];
  b18a(app).calls.push({ name: C, args: { keyed: keyControls(app, C, ctl).map(siFullName) } });
}
const useMixerPoses = (app: App) => truthy(userPref(app, 'Face Robot.Use_Mixer_Poses', false));
function storeAction(app: App, C: string, model: X3DObject | null, names: string[]) {
  nya(app, C, 'GetInputAndStoreAction (CMD-B17e, LOCK): the FacePose action is not stored here');
  b18a(app).calls.push({ name: 'GetInputAndStoreAction', args: [model ? siFullName(model) : null, names.join(','), 1, 'FacePose'] });
}
function frPoseAll(app: App) {
  const C = 'fr_PoseAll';
  const M = getFaceModel(app); const mixer = useMixerPoses(app);
  const names: string[] = [];
  for (const k of controlKeys(app)) { const o = controlK(app, k); if (o) for (const p of taggedParams(o)) names.push(siFullName(p)); }
  if (!names.length) return;
  if (!mixer) call(app, 'fr_SaveFacePose', {});
  else storeAction(app, C, M, names);
}
function frPoseSel(app: App, a: Record<string, any>) {
  const C = 'fr_PoseSel';
  const M = getFaceModel(app); const mixer = useMixerPoses(app);
  const ctl = app.selection.filter(isFaceRobotControl) as X3DObject[];
  if (!app.selection.length || !ctl.length) { app.logMsg('error', 'no controls found to save pose'); return; }
  if (!mixer) { call(app, 'fr_SaveFacePose', { selectiononly: true, filename: a.filename }); return; }
  const names = ctl.flatMap(o => taggedParams(o).map(siFullName));
  if (names.length) storeAction(app, C, M, names);
}

// ------------------------------------------------------------------ §4 retargeting
export const RETARGET_TYPES = ['fro_FaceRetargetLocalOp', 'fro_FaceRetargetLocalOp', 'fro_FaceRetargetOp2', 'fro_FaceRetargetCompensateOp', 'fro_FaceRetargetHeadNullOp'];
const nestedOps = (o: X3DObject): Operator[] => ((o.kinematics.local as any).nestedObjects ?? []) as Operator[];
function gather(app: App, control: any): X3DObject[] | null {
  const M = storeFaceModel(app); const jaw = M ? descendantNamed(M, 'JawEnd_ControlProxy') : null;
  if (truthy(control)) {
    const c = resolveObj(app, control); if (!c) return null;
    const out = [c]; if (c.parentObj) out.push(c.parentObj);
    if (c.name.includes('Jaw') && jaw) out.push(jaw);
    return out;
  }
  let keys: string[];
  try { keys = call(app, 'fr_sindices', { key: 'controls' }) ?? controlKeys(app); }
  catch { try { call(app, 'FaceRobot', {}); keys = call(app, 'fr_sindices', { key: 'controls' }) ?? []; } catch { return null; } }
  const out: X3DObject[] = [];
  for (const k of keys) { const o = controlK(app, k); if (!o) return null; out.push(o); if (o.parentObj) out.push(o.parentObj); }
  if (jaw) out.push(jaw);
  return out;
}
function gatherOrFaceRobot(app: App, control: any): X3DObject[] | null {
  let g = gather(app, control);
  if (!g) { call(app, 'FaceRobot', {}); g = gather(app, null); }
  if (!g) app.logMsg('info', 'Retargeting Controls Not Found');
  return g;
}
function frIsRetargeted(app: App, a: Record<string, any>) {
  const g = gatherOrFaceRobot(app, a.control); if (!g) return null;
  for (const o of g) {
    const ops = nestedOps(o);
    for (let i = ops.length - 1; i >= 0; i--) if (RETARGET_TYPES.includes(ops[i].type)) return true;
    if (((o as any).retargetOps as string[] | undefined)?.some(t => RETARGET_TYPES.includes(t))) return true;
  }
  return false;
}
function frResetRetarget(app: App, a: Record<string, any>) {
  const mute = a.mute;
  const g = gatherOrFaceRobot(app, null); if (!g) return;
  for (const o of g) {
    const ops = nestedOps(o); let op: Operator | null = null;
    for (let i = ops.length - 1; i >= 0 && !op; i--) if (RETARGET_TYPES.includes(ops[i].type)) op = ops[i];
    if (!op) continue;
    const p = op.get('mute'); if (p) app.setParam(p, truthy(mute)); else nya(app, 'fr_ResetRetarget', `the mute parameter of ${op.name} (absent on this build's operator)`);
    if (truthy(mute)) zeroPosRot(app, o);
  }
  if (truthy(mute)) call(app, 'fr_ResetAll', {});
}

// ------------------------------------------------------------------ §5 pick points
const pickParent = (app: App) => entryObject(app, '_', 'PickPoints');
function frSetPickPoints(app: App, a: Record<string, any>) {
  const picks = Array.isArray(a.picks) ? a.picks : []; const vec = Array.isArray(a.vectors) ? a.vectors.map(Number) : [];
  const parent = pickParent(app); const out: any[] = [];
  for (let i = 0; i < picks.length; i++) {
    out.push(call(app, 'fr_AddObjectInPlace', { inPreset: 'Sphere', inType: 0, inParent: parent ?? '', inScale: a.rad, inVector: [vec[3 * i], vec[3 * i + 1], vec[3 * i + 2]], inName: picks[i], inColor: 891, inParamTags: false }));
  }
  b18a(app).calls.push({ name: 'fr_SetPickPoints', args: out.map(o => o?.name) });
}
function frGetPickPoints(app: App) {
  const C = 'fr_GetPickPoints';
  const par = pickParent(app);
  if (!par) throw jsErr(C, 'fr_sget("PickPoints") is not an object');
  const pts = [...par.descendants()];
  if (!pts.length) throw jsErr(C, 'no pick points (the first one has no radius)');
  const rp = findParamOn(pts[0], 'radius');
  if (!rp) nya(app, C, `the radius parameter of ${pts[0].name} (absent on this build's primitive)`);
  const v: number[] = []; for (const p of pts) { const g = globalPos(p); v.push(g.x, g.y, g.z); }
  const text = ['', `var rad = ${rp ? rp.value : 'undefined'}`, `var picks = [${pts.map(p => `"${p.name}"`).join(',')}];`, `var vectors = [${v.map(String).join(',')}]`, 'fr_SetPickPoints(picks,vectors,rad);'].join('\n');
  app.logMsg('info', text);
}
function blobOf(owner: X3DObject, name: string): Property | undefined { return owner.properties.find(p => p.type === 'UserDataBlob' && p.name === name); }
function addBlob(app: App, owner: X3DObject, name: string, value: any): Property {
  let n = name, i = 0; while (owner.properties.some(p => p.name === n)) n = name + ++i;   // the new one gets a numbered name (inferred)
  const p = new Property(n, 'UserDataBlob', []); (p as any).value = value;
  app.record('AddProp UserDataBlob', () => owner.addProperty(p), () => owner.removeProperty(p));
  return p;
}
/** Placeholder for the embedded `pickpoints` helper source: its bytes are deliberately not reproduced (clean room). */
const PP_HELPER = '// pickpoints helper: embedded source not reproduced (not yet attested, CMD-B18a)';
function frStorePP(app: App, a: Record<string, any>) {
  const C = 'fr_StorePP';
  const model = resolveObj(app, a.model) ?? (empty(a.model) ? storeFaceModel(app) : null);
  let mesh = resolveObj(app, a.mesh);
  if (empty(a.mesh)) mesh = faceMesh(app) ?? model;
  if (!model || !mesh) throw jsErr(C, 'no model or mesh');
  const par = descendantNamed(model, 'PickPoints') ?? model;
  const pts = [...par.descendants()]; if (!pts.length) return;
  const rp = findParamOn(pts[0], 'radius'); const r = rp ? rp.value : '1.0';
  const disp = pts[0].properties.find(p => p.type === 'display');
  const col = disp?.val('wirecol');
  const pos: number[] = []; for (const p of pts) { const l = p.kinematics.local; pos.push(l.val('posx'), l.val('posy'), l.val('posz')); }
  nya(app, C, 'the embedded pickpoints helper text (a placeholder line is stored; fr_RestorePP parses the data lines)');
  const text = [`radius =${r};`, `color = ${col};`, `var names = [${pts.map(p => `'${p.name}'`).join(',')}];`, `var positions = [${pos.join(',')}];`, PP_HELPER, 'pickpoints(null,names,positions,radius,color);'].join('\n');
  addBlob(app, mesh, 'pickedpoints', text);
  return undefined;   // Ret on, nothing returned
}
/** The data lines of a pick-point blob (an evaluator-free reading of what fr_StorePP writes). */
export function parsePPBlob(text: string): { radius: number; color: any; names: string[]; positions: number[] } | null {
  const get = (re: RegExp) => re.exec(text)?.[1];
  const names = get(/var names = \[(.*)\];/); const posT = get(/var positions = \[(.*)\];/);
  if (names === undefined || posT === undefined) return null;
  const radT = get(/radius\s*=\s*([^;]*);/); const colT = get(/color = ([^;]*);/);
  const col = colT === undefined ? undefined : colT === 'true' ? true : colT === 'false' ? false : Number.isFinite(Number(colT)) ? Number(colT) : colT;
  return { radius: radT === undefined || radT === '' ? 1 : Number(radT), color: col, names: names === '' ? [] : names.split(',').map(s => s.replace(/^'|'$/g, '')), positions: posT === '' ? [] : posT.split(',').map(Number) };
}
function frRestorePP(app: App, a: Record<string, any>) {
  const C = 'fr_RestorePP';
  let blob: any = a.ppblob;
  if (empty(blob)) {
    const s0 = app.selection[0];
    const mesh = faceMesh(app) ?? (s0 instanceof X3DObject && s0.type === 'polymsh' ? s0 : null);
    blob = mesh ? blobOf(mesh, 'pickedpoints') : undefined;
    if (empty(blob) && s0 instanceof Property && s0.type === 'UserDataBlob') blob = s0;
    if (empty(blob)) return false;
  }
  if (!(blob instanceof Property)) return undefined;   // no `.value`: evaluating undefined is a no-op (inferred)
  const text = String((blob as any).value ?? '');
  const d = parsePPBlob(text);
  if (!d) { nya(app, C, 'evaluating a blob that is not in the fr_StorePP layout (arbitrary JScript is not run)'); return undefined; }
  nya(app, C, 'the embedded helper is not evaluated; its described behaviour is run on the parsed data lines');
  const model = storeFaceModel(app);
  const parent = (model ? descendantNamed(model, 'PickPoints') : null) ?? model;
  if (!d.names.length) return undefined;
  for (let i = 0; i < d.names.length; i++) {
    call(app, 'fr_AddObjectInPlace', { inPreset: 'Sphere', inType: null, inParent: parent ?? '', inScale: d.radius, inVector: [d.positions[3 * i], d.positions[3 * i + 1], d.positions[3 * i + 2]], inName: d.names[i], inColor: d.color });
  }
  call(app, 'FaceRobot', {});
  return undefined;
}

// ------------------------------------------------------------------ §6 envelope storage
function envOp(o: X3DObject): EnvelopeOperator | null { return envelopeOf(o) ?? (o.primitive?.operators.find(x => x.type === 'envelopop') as EnvelopeOperator | undefined) ?? null; }
function frStoreEnvelope(app: App, a: Record<string, any>) {
  const C = 'fr_StoreEnvelope';
  let mesh = resolveObj(app, a.Mesh);
  if (empty(a.Mesh)) mesh = faceMesh(app) ?? (app.selection[0] instanceof X3DObject ? app.selection[0] as X3DObject : null);
  if (!mesh) { app.logMsg('info', 'No mesh found '); return undefined; }
  const name = empty(a.EnvName) ? 'StoredEnvelope' : String(a.EnvName);
  const op = envOp(mesh);
  if (!op) { app.logMsg('info', `${siFullName(mesh)} has no envelope`); return undefined; }
  nya(app, C, 'the array-to-string conversion of the blob value and the 2-D flattening order (deformer index fastest, percentages: inferred)');
  const flat: number[] = []; for (const w of op.weights) for (let k = 0; k < op.deformers.length; k++) flat.push(Math.round((w?.[k] ?? 0) * 100 * 1e6) / 1e6);
  return addBlob(app, mesh, name, flat.join(','));
}
const ENV_NAMES = ['SoftEnvelope', 'RigidEnvelope', 'StoredEnvelope'];
function frRestoreEnvelope(app: App, a: Record<string, any>) {
  const C = 'fr_RestoreEnvelope';
  let stored: any = a.StoredEnvelope; let mesh: any = resolveObj(app, a.Mesh) ?? (empty(a.Mesh) ? null : a.Mesh);
  const s0 = app.selection[0];
  if (empty(stored) && s0 instanceof Property && s0.type === 'UserDataBlob') { stored = s0; mesh = s0.parent instanceof X3DObject ? s0.parent : mesh; }
  if (empty(mesh) && s0 instanceof X3DObject && s0.type === 'polymsh') { mesh = s0; app.logMsg('info', s0.name); }
  if (empty(mesh)) mesh = faceMesh(app);
  if (mesh instanceof X3DObject && !(stored instanceof Property)) {
    let p: Property | undefined;
    if (typeof stored === 'number' && stored < 3) p = propNamed(mesh, ENV_NAMES[stored] ?? '');
    else if (typeof stored === 'string' && stored) p = propNamed(mesh, stored);
    if (!p) for (const n of ENV_NAMES) { p = propNamed(mesh, n); if (p) break; }
    stored = p;
  }
  if (!(mesh instanceof X3DObject) || mesh.type !== 'polymsh') { app.logMsg('info', 'no valid mesh found '); return; }
  if (!(stored instanceof Property) || stored.type !== 'UserDataBlob') { app.logMsg('info', 'no valid envelope storage property found'); return; }
  const op = envOp(mesh);
  if (!op) { app.logMsg('info', `${siFullName(mesh)} has no envelope`); return; }
  nya(app, C, 'whether the flat string list is accepted for the 2-D weight array (inferred yes; read back deformer index fastest, percentages)');
  const vals = String((stored as any).value ?? '').split(','); const D = op.deformers.length;
  const old = op.weights.map(w => Float32Array.from(w ?? []));
  const next = op.weights.map((w, i) => { const o = new Float32Array(D); for (let k = 0; k < D; k++) { const s = vals[i * D + k]; o[k] = s === undefined || s === '' ? (w?.[k] ?? 0) : Number(s) / 100; } return o; });
  const prim = mesh.primitive!;
  app.record('SetEnvelopeWeights', () => { op.weights = next; prim.dirty = true; }, () => { op.weights = old; prim.dirty = true; });
}

// ------------------------------------------------------------------ §7 offset maps
function clusterArg(app: App, v: any): Cluster | null {
  if (v instanceof Cluster) return v;
  if (typeof v !== 'string' || !v) return null;
  for (const o of app.scene.allObjects()) for (const c of o.clusters) if (c.fullName === v || siFullName(c) === v || c.name === v) return c;
  return null;
}
function createWeightMap(app: App, cls: Cluster, name: string): Property {
  let n = name || 'WeightMap', i = 0; while (cls.properties.some(p => p.name === n)) n = (name || 'WeightMap') + ++i;
  const p = new Property(n, 'weightmap', [
    { name: 'weight', type: 'double', value: 1, label: 'Default Weight', min: 0, max: 1 } as any, { name: 'paintable', type: 'bool', value: true, label: 'Paintable' } as any,
    { name: 'red', type: 'int', value: 255, label: 'Red', min: 0, max: 255 } as any, { name: 'green', type: 'int', value: 255, label: 'Green', min: 0, max: 255 } as any,
    { name: 'blue', type: 'int', value: 255, label: 'Blue', min: 0, max: 255 } as any,
  ]);
  (p as any).values = new Map<number, number>();
  app.record('CreateWeightMap', () => cls.addProperty(p), () => cls.removeProperty(p));
  return p;
}
/** Element array of a weight map (cluster element order; unset entries 0, inferred). */
export function weightArray(cls: Cluster, p: Property): number[] {
  const v: Map<number, number> = (p as any).values ?? new Map();
  return [...cls.elements].map(e => v.get(Number(e)) ?? 0);
}
function setWeightArray(app: App, cls: Cluster, p: Property, arr: number[]) {
  const v: Map<number, number> = (p as any).values ?? ((p as any).values = new Map());
  const old = new Map(v); const els = [...cls.elements].map(Number);
  app.record('WeightMap', () => { els.forEach((e, i) => { if (i < arr.length) v.set(e, Number(arr[i])); }); }, () => { v.clear(); for (const [k, x] of old) v.set(k, x); });
}
function setOffsetMap(app: App, C: string, a: Record<string, any>, arr: any) {
  if (arr === null || arr === undefined) throw jsErr(C, 'the value array is null');
  const first = (arr as any[])[0];
  const cls = clusterArg(app, a.inCls);
  if (className(first) === 'ISIVector3') {
    if (!cls) throw jsErr(C, 'inCls is not a cluster');
    const out: Record<string, Property> = {};
    for (const [ax, get] of [['x', vx], ['y', vy], ['z', vz]] as const) {
      const m = createWeightMap(app, cls, `${a.inBaseName ?? ''}${ax.toUpperCase()}`);
      const cur = weightArray(cls, m); const vs = arr as any[];
      for (let i = 0; i < vs.length && i < cur.length; i++) cur[i] = get(vs[i]);
      setWeightArray(app, cls, m, cur); out[ax] = m;
    }
    return out;
  }
  if (typeof first === 'number') {
    if (!cls) throw jsErr(C, 'inCls is not a cluster');
    const r = a.inR ?? 0, g = a.inG ?? 255, b = a.inB ?? 255;
    const m = createWeightMap(app, cls, String(a.inBaseName ?? ''));
    app.setParam(m.get('red')!, Number(r)); app.setParam(m.get('green')!, Number(g)); app.setParam(m.get('blue')!, Number(b));
    setWeightArray(app, cls, m, (arr as any[]).map(Number));
    return m;
  }
  if (a.inCls === null || a.inCls === undefined) throw jsErr(C, 'inCls is null (its FullName is read for the message)');
  const clsName = cls ? siFullName(cls) : typeof a.inCls === 'object' ? jsText(a.inCls) : 'undefined';
  app.logMsg('error', `\nAttempt to save offset map failed\n\tCluster: ${clsName}\n\tMapNames: ${a.inBaseName}`);
  return null;
}
const frSetOffsetMap = (app: App, a: Record<string, any>) => setOffsetMap(app, 'fr_SetOffsetMap', a, a.inVArray);
function frSetOffsetMap2(app: App, a: Record<string, any>) {
  const v = a.inVarray;
  const arr = v === null || v === undefined ? v : Array.isArray(v) ? [...v] : ArrayBuffer.isView(v) ? Array.from(v as any) : typeof v?.toArray === 'function' ? v.toArray() : [v];
  return setOffsetMap(app, 'fr_SetOffsetMap2', { ...a, inVArray: arr }, arr);
}

// ------------------------------------------------------------------ §8 layout, DNA type, preference paths
function frObjectView(app: App, a: Record<string, any>) {
  const C = 'fr_ObjectView';
  const name = empty(a.vname) ? 'Sculpt' : String(a.vname);
  const views = frDesktop(app).views;
  const v = views.get(name);
  if (v) {
    v.attrs.state = 'siNormal';
    const cam = String(call(app, 'GetViewCamera', { View: 4 }) ?? '');
    nya(app, C, `which viewport GetViewCamera(4) designates (inferred viewport D; this build answers ${cam})`);
    const cd = (b18a(app).cameraDisplay[cam] ??= {});
    Object.assign(cd, { headlight: true, wireontopunsel: true, wireframeopacity: 0.2 });
  } else {
    views.set(name, { type: 'Object View', attrs: { x: 5, y: 5, displaymode: 'shaded', lockstatus: 'true' } });
    app.logMsg('info', `CreateView("Object View", "${name}")`);
  }
  return undefined;
}
const DNA_FILES = ['Human_Face_Symmetric.dna', 'Human_Face_Asymmetric.dna'];
function frApplyType(app: App, a: Record<string, any>) {
  const m = storeFaceModel(app); const fs = m ? propNamed(m, 'FaceState') : undefined; const p = fs?.get('DNA');
  if (!p) return undefined;
  let i: any = a.dnaindex;
  if (empty(i)) i = 0; else if (Number(i) > 2) i = 1;
  const file = (DNA_FILES as any)[i];
  app.setParam(p, buildPath('$FACEROBOTROOT', 'Data', 'FaceRobot', 'Dna', String(file)));
  call(app, 'fr_Diagnose', {});
  return undefined;
}
export const PATH_PREFS: [string, string][] = [['Head_Path', 'Face'], ['Parts_Path', 'Parts'], ['Actor_Path', 'Actors'], ['Dna_Path', 'Dna'], ['Ani_Path', 'FaceAni'], ['Pose_Path', 'FacePose']];
function frResetPaths(app: App) {
  const C = 'fr_ResetPaths';
  const m = storeFaceModel(app);
  if (!m) throw jsErr(C, 'no face model in the store');
  const q = propNamed(m, 'FaceState')?.get('Stage1Tab1');
  if (q) { const old = q.value; app.setParam(q, 1); app.setParam(q, old); }
  else nya(app, C, 'FaceState.Stage1Tab1 is missing on this face model (the UI refresh toggle is skipped)');
  call(app, 'fr_SwitchFaceLayout', {});
  for (const [pref, dir] of PATH_PREFS) setUserPref(app, `Face Robot.${pref}`, `$FACEROBOTDATAROOT${SLASH}${dir}${SLASH}`);
  return true;
}

// ------------------------------------------------------------------ §9 image-source healing and backup cleaning
function subfolders(p: string): string[] { try { return hostFs.listFolders(p); } catch { return []; } }
function filesIn(p: string): string[] { try { return hostFs.listFiles(p); } catch { return []; } }
const drives = (): string[] => [...((hostFs as any).roots?.values?.() ?? [])].map((e: any) => String(e.name ?? '')).filter(n => /^[A-Za-z]:$/.test(n)).map(n => n + SLASH);
/** GetProjects: breadth-first scan of every drive for folders named `target` (contract §9). */
export function getProjects(app: App, target: string, maxDepth = 8): string[] {
  const st = b18a(app); const found: string[] = [];
  let level: string[] = drives(); let depth = 0;
  app.logMsg('info', 'Scaning Folders');
  for (;;) {
    const next: string[] = [];
    for (const f of level) {
      st.status.push(`Folder ${f}`);
      if (st.hooks.cancelScan?.(f, depth)) return found;
      for (const s of subfolders(f)) {
        const p = buildPath(f, s);
        if (s === target) { app.logMsg('info', p); found.push(p); continue; }
        if (s === 'WINDOWS') continue;
        next.push(p);
      }
    }
    depth++;
    app.logMsg('info', `\n Folder depth: ${depth}`);
    app.logMsg('info', `${depth} ${next.join(',')}`);
    if (depth > maxDepth) {
      app.logMsg('error', `Scan Stopped at ${maxDepth} folders depth, to enable deeper scan, edit 'EmptyBackups' plugin, change 'pb.Maximum =' to higher number`);
      break;
    }
    if (!next.length) break;
    level = next;
  }
  return found;
}
function addRecursive(app: App, list: string[], folder: string, counter: { n: number }) {
  if (++counter.n > 99) { app.logMsg('info', 'amok'); return; }
  if (!isFolder(folder)) return;
  list.push(folder);
  for (const s of subfolders(folder)) { const p = buildPath(folder, s); list.push(p); addRecursive(app, list, p, counter); }
}
function buildSearchList(app: App, bits: number, P: string): string[] {
  const list: string[] = [];
  let b = bits;
  if (b >= 8) b -= 8;   // user paths: no-op
  if (b >= 4) { b -= 4; for (const f of getProjects(app, 'Pictures', 8)) list.push(f); }
  if (b >= 2) {
    b -= 2;
    const f = buildPath(b18a(app).userPath, 'Data', 'default.xsiprojects');
    let text = ''; try { text = isFile(f) ? hostFs.readFile(f) : ''; } catch { text = ''; }
    for (const line of text.split(/\r?\n/)) { if (!line || line.startsWith('/')) continue; const fl = line.split(','); if (fl.length >= 2) addRecursive(app, list, buildPath(fl[0], 'Pictures'), { n: 0 }); }
  }
  if (b >= 1) addRecursive(app, list, buildPath(P, 'Pictures'), { n: 0 });
  return list;
}
function copyFile(from: string, to: string) { const t = hostFs.readFile(from); try { hostFs.ensureFolder(hostFs.parentPath(to)); } catch { /* exists */ } hostFs.writeFile(to, t); }
function cleanSources(app: App, a: Record<string, any>) {
  const store = sourcesOf(app, 'imageSources'); const P = String(alembicState.projectPath ?? '');
  const action = empty(a.Action) ? 51 : Number(a.Action);
  let search: string[] = [];
  const del = (src: Property) => { const i = store.indexOf(src); if (i >= 0) app.record('DeleteObj ' + src.name, () => store.splice(store.indexOf(src), 1), () => store.splice(i, 0, src)); };
  for (const src of [...store]) {
    const fnP = src.get('FileName') ?? src.get('filename'); const fileName = String(fnP?.value ?? '');
    const path = P + SLASH + fileName;   // always prefixed, absolute paths too (source behaviour, kept)
    if (isFile(path)) { app.logMsg('info', `File Path Found :${src.name}`); continue; }
    app.logMsg('error', `File Path Not Found :${path}`);
    if (action < 0) { app.logMsg('error', '   Deleting '); del(src); continue; }
    let bits = action; let delMissing = false, localize = false;
    if (bits >= 32) { bits -= 32; delMissing = true; }
    if (bits >= 16) { bits -= 16; localize = true; }
    if (!search.length) search = buildSearchList(app, bits, P);
    const base = fileName.split(SLASH).pop() ?? fileName;
    let healed = false;
    for (let i = search.length - 1; i >= 0; i--) {
      const cand = buildPath(search[i], base);
      if (!isFile(cand)) continue;
      if (localize) { copyFile(cand, buildPath(P, 'Pictures', base)); if (fnP) app.setParam(fnP, `Pictures${SLASH}${base}`); }
      else if (fnP) app.setParam(fnP, cand);
      app.logMsg('info', `File ${base} successfully healed`); healed = true; break;
    }
    if (!healed) {
      app.logMsg('error', `File ${base} NOT FOUND IN SEARCH:`);
      if (delMissing) { app.logMsg('error', '       DELETING'); del(src); }
    }
  }
  return undefined;
}
function folderSize(p: string): number {
  let n = 0;
  for (const f of filesIn(p)) { try { n += hostFs.readFile(buildPath(p, f)).length; } catch { /* unreadable */ } }
  for (const s of subfolders(p)) n += folderSize(buildPath(p, s));
  return n;
}
function emptyBackups(app: App, a: Record<string, any>) {
  const st = b18a(app);
  const maxdepth = empty(a.maxdepth) ? 8 : Number(a.maxdepth);
  const folder = empty(a.foldername) ? 'Backup' : String(a.foldername);
  const listOnly = empty(a.list) ? false : truthy(a.list);
  const found = getProjects(app, folder, maxdepth);
  // confirmation: a CustomProperty `EmptyBackups` on the scene root, one boolean per folder, inspected modally
  const prop = new Property('EmptyBackups', 'customparamset', found.map(f => ({ name: f, type: 'bool', value: true, label: f, animatable: false } as any)));
  app.record('AddProp EmptyBackups', () => app.scene.root.addProperty(prop), () => app.scene.root.removeProperty(prop));
  app.logMsg('info', `InspectObj("${siFullName(prop)}", "", "", siModal)`);
  const ticks = st.hooks.confirmBackups ? st.hooks.confirmBackups(found) : found.map(() => true);
  let chosen: string[];
  if (ticks === null) { app.logMsg('error', 'Cancelled Command: No Backups were deleted !'); chosen = []; }
  else chosen = found.filter((_, i) => ticks[i] !== false);
  app.record('DeleteObj EmptyBackups', () => app.scene.root.removeProperty(prop), () => app.scene.root.addProperty(prop));
  app.logMsg('info', `Resolved ${chosen.length} ${chosen.join(',')}`);
  app.logMsg('info', listOnly ? 'Found Files: ' : 'Deleting: ');
  let files = 0, folders = 0, bytes = 0;
  for (const f of chosen) {
    for (const n of filesIn(f)) { const p = buildPath(f, n); app.logMsg('info', `\t${n}`); try { bytes += hostFs.readFile(p).length; } catch { /* unreadable */ } if (!listOnly) { try { hostFs.deleteFile(p); } catch { /* forced */ } } files++; }
    for (const n of subfolders(f)) { const p = buildPath(f, n); app.logMsg('info', `\t${n}`); bytes += folderSize(p); if (!listOnly) { try { hostFs.deleteFolder(p); } catch { /* forced */ } } folders++; }
  }
  if (!listOnly) {
    app.logMsg('info', `${folders}  folders deleted`);
    app.logMsg('info', `${files}  files deleted`);
    app.logMsg('info', `${bytes}  bites deleted`);
  }
  st.calls.push({ name: 'EmptyBackups', args: { found, chosen, files, folders, bytes, listOnly } });
}

// ------------------------------------------------------------------ §10 log and math helpers
function logv(app: App, a: Record<string, any>, label?: string) {
  const v = a.v; if (v === null || v === undefined) throw jsErr('logv', 'v is null');
  const s = label ?? (a.s === undefined || a.s === null ? '' : jsText(a.s));
  app.logMsg('info', `${s}\t [${v.x ?? v.X},${v.y ?? v.Y},${v.z ?? v.Z}]`);
}
function loga(app: App, a: Record<string, any>) {
  const arr = a.a; if (arr === null || arr === undefined) throw jsErr('loga', 'a is null');
  const s = a.s === undefined || a.s === null ? '' : jsText(a.s);
  app.logMsg('info', `${s} [`);
  for (let i = 0; i < Number(arr.length ?? 0); i++) app.logMsg('info', `\t${jsText(arr[i])}`);
  app.logMsg('info', ' ]');
}
function logc(app: App, a: Record<string, any>) {
  let c: any = a.c, s: any = a.s;
  if (empty(c)) { c = selectionObject(app); s = 'Current Selection:'; }
  if (truthy(s)) app.logMsg('info', jsText(s));
  const mode = typeof a.a === 'string' ? a.a.charAt(0).toLowerCase() : '';
  app.logMsg('info', '(');
  const items: any[] = Array.isArray(c) ? c : [c];
  for (const it of items) {
    if (mode === 't') app.logMsg('info', `\ta${jsText(it)}\t\t${it?.type}`);
    else if (mode === 'c') app.logMsg('info', `\t${jsText(it)}\t\t${className(it)}`);
    else if (mode === 'n') app.logMsg('info', `\t${it?.name}`);
    else app.logMsg('info', `\t${jsText(it)}`);
  }
  app.logMsg('info', ' )');
}
function logt(app: App, a: Record<string, any>) {
  const t = a.t;
  const M: THREE.Matrix4 | null = t instanceof THREE.Matrix4 ? t : Array.isArray(t) && t.length === 16 ? new THREE.Matrix4().fromArray(t.map(Number)) : null;
  if (!M) throw jsErr('logt', 't is not a transformation');
  if (truthy(a.s)) app.logMsg('info', `Transformation ${jsText(a.s)}`);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); M.decompose(p, q, sc);
  const e = new THREE.Euler().setFromQuaternion(q, threeOrder(0)); const d = 180 / Math.PI;
  logv(app, { v: p }, 'Translation: ');
  logv(app, { v: { x: e.x * d, y: e.y * d, z: e.z * d } }, 'Rotation: ');
  logv(app, { v: sc }, 'Scaling: ');
}
function suma(app: App, a: Record<string, any>) {
  const arr = a.a; if (arr === null || arr === undefined) throw jsErr('suma', 'a is null');
  let s: any = 0; for (let i = 0; i < Number(arr.length ?? 0); i++) s = s + arr[i];
  if (truthy(a.log)) app.logMsg('info', String(s));
  return s;
}

// ------------------------------------------------------------------ registration
export const B18A_COMMANDS: [string, string[], (app: App, a: Record<string, any>) => any, boolean][] = [
  // name, catalogue args, execute, NoLog
  ['fr_FolderExists', ['inPath'], frFolderExists, true],
  ['fr_GetCentroid', ['inObj'], frGetCentroid, true],
  ['fr_GetFile', ['inFileName'], frGetFile, true],
  ['fr_GetResolvedDNAPath', [], frGetResolvedDNAPath, true],
  ['fr_GetGlobalPos', ['iobj'], frGetGlobalPos, true],
  ['fr_SetOffsetMap', ['inCls', 'inVArray', 'inBaseName', 'inR', 'inG', 'inB'], frSetOffsetMap, true],
  ['fr_SetOffsetMap2', ['inCls', 'inVarray', 'inBaseName', 'inR', 'inG', 'inB'], frSetOffsetMap2, true],
  ['fr_IsCollection', ['c', 'log'], (_app, a) => isCollection(a.c), true],
  ['fr_ToCollection', ['inObj'], frToCollection, true],
  ['fr_KeyAllControls', [], frKeyAllControls, false],
  ['fr_KeySelControls', [], frKeySelControls, false],
  ['fr_ResetPaths', ['token'], frResetPaths, true],
  ['fr_SelectAllControls', ['toggle'], (app, a) => { app.select([...getControls(app, a.toggle)]); }, false],
  ['fr_GetControls', ['toggle'], (app, a) => getControls(app, a.toggle), true],
  ['fr_ObjectView', ['vname'], frObjectView, false],
  ['fr_ResetSel', ['toggle'], frResetSel, false],
  ['fr_ResetAll', ['token'], frResetAll, false],
  ['fr_PoseAll', [], frPoseAll, false],
  ['fr_PoseSel', ['filename'], frPoseSel, false],
  ['fr_SetPickPoints', ['picks', 'vectors', 'rad'], frSetPickPoints, false],
  ['fr_GetPickPoints', [], frGetPickPoints, false],
  ['fr_StoreEnvelope', ['Mesh', 'EnvName'], frStoreEnvelope, false],
  ['fr_RestoreEnvelope', ['StoredEnvelope', 'Mesh'], frRestoreEnvelope, false],
  ['fr_GetPointsAsText', ['Points'], frGetPointsAsText, false],
  ['fr_StorePP', ['model', 'mesh'], frStorePP, false],
  ['fr_RestorePP', ['ppblob'], frRestorePP, false],
  ['fr_ApplyType', ['dnaindex'], frApplyType, false],
  ['fr_ResetRetarget', ['mute'], frResetRetarget, false],
  ['fr_IsRetargeted', ['control'], frIsRetargeted, true],
  ['CleanSources', ['Action'], cleanSources, false],
  ['EmptyBackups', ['maxdepth', 'foldername', 'list'], emptyBackups, false],
  ['logv', ['v', 's'], (app, a) => { logv(app, a); }, true],
  ['loga', ['a', 's'], (app, a) => { loga(app, a); }, true],
  ['logc', ['c', 's', 'a'], (app, a) => { logc(app, a); }, true],
  ['logt', ['t', 's'], (app, a) => { logt(app, a); }, true],
  ['suma', ['a', 'log'], suma, true],
];

export function registerFaceRobotB18aCommands(app: App) {
  b18a(app);
  (app as any).faceRobotB18a = {
    state: () => b18a(app), XSICollection, collection, className, siFullName, parsePPBlob, weightArray, getProjects, RETARGET_TYPES, PATH_PREFS,
    userPref: (n: string) => userPref(app, n, undefined), alembicState,
    setProjectPath: (p: string) => { (alembicState as any).projectPath = p; },
    imageSources: () => sourcesOf(app, 'imageSources'),
    newImageSource: (name: string, file: string) => new Property(name, 'imagesource', [{ name: 'FileName', type: 'string', value: file, label: 'File Name' } as any]),
  };
  for (const [name, args, execute, noLog] of B18A_COMMANDS) {
    app.register({ name, label: name, category: CAT, description: '', args: args.map(n => ({ name: n, default: null })), undoable: true, noLog, execute });
  }
}
