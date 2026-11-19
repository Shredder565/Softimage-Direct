// Ledger row CMD-B14b (Face Robot `FR.dll`): sculpt sessions, sculpt history, mirror sculpt, mouth sculpt, meta / proxy /
// vector mouth, controller DB, stick lips (23 commands).
//   fr_SculptBegin fr_SculptEnd fr_SculptEyelidBegin fr_SculptEyelidEnd fr_SculptPuffingBegin fr_SculptPuffingEnd
//   fr_SculptTendonBegin fr_SculptTendonEnd fr_SculptMouthBegin fr_SculptMouthEnd fr_MirrorMouthSculpt fr_MirrorSculpt
//   fr_ApplySculptPose fr_DeleteSculptSession fr_DeleteAllSculptSessions fr_ToggleMuteSculptSession fr_InspectSculptHistory
//   fr_RefreshSculptHistory fr_AdjustMetaMouth fr_ProxyMouth fr_VectorMouth fr_ResetControllerDB fr_StickLips
// Brief: docs/ghidra/cmd-b14b-fr-sculpt-mouth.md ("Shared facts" and "Contracts"), docs/re/WIRE_CORRECTIONS_B14.md.
// Original code written from that prose only; no XSIBATCH golden exists. Items the note marks (inferred) are wired as
// stated; branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B14b)".
//
// Mapping onto this build:
//  * A live session is held in the scene (note §2.3): `ActiveSculpt` (a mesh copy under the face), `SculptLinkReader`
//    on the face, `SculptLinkConnection` on ActiveSculpt and stand-in `CustomLink` operators reached through the
//    `source` field of each `CustomLinkOut<i>` parameter (End follows that chain back to ActiveSculpt).
//  * Session shape keys are `shapekey` properties local to the pnt clusters that carry the session's operator; their
//    `data` is the per-point offset (relative). `SculptHistoryUDB` is a `UserDataBlob` property whose records are the
//    in-memory form of §2.5 (mute flag, pose text, shape keys); the byte layout is not attested (Q2).
//  * The pose text saved at End is an original JSON form of the local transforms of the face controls.
import { App } from '../core/commands';
import { Cluster, Shader, Material, construction } from '../core/scene';
import { int, bool, num, str } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import {
  frState, frStore, rowState, faceModel, faceMesh, childNamed, msgBox, fail, failLog, logNya, put, progress, objArg, intArg, boolArg,
  addProperty, propNamed, meshOf, X3DObject, Property, unset, resolve, ensureGroup, E_FAIL, E_INVALIDARG,
} from './faceRobotB14Shared';
import {
  ROW_B, E_UNEXPECTED, setStatus, frDesktop, inspectObj, selectObj, userPref, setUserPref, deleteObj, removeProp, addClusterProp,
  duplicateMesh, setMeshPoints, setVal, FROp, addOp, opsOf, clusterOp, pntClusters, materialOf, shaderColor, setShaderColor, rgbToHls,
  hlsToRgb, makePhong, makeLambert, objOrName, buildSampleRegions,
} from './faceRobotB14bcShared';

const NYA = (app: App, c: string, what: string) => logNya(app, c, what, ROW_B);
const REF_PREF = '3D_TRANSFO_REFERENTIAL_CHANGED';

// ------------------------------------------------------------------ session kinds (§2.2)
const KINDS = [
  { begin: 'fr_SculptBegin', end: 'fr_SculptEnd', op: 'fro_RegionOp', label: 'Skin', first: 'Bulge' },
  { begin: 'fr_SculptPuffingBegin', end: 'fr_SculptPuffingEnd', op: 'fro_PufferOp', label: 'Puffer', first: 'Puff' },
  { begin: 'fr_SculptTendonBegin', end: 'fr_SculptTendonEnd', op: 'fro_TendonOp', label: 'Tendon', first: 'Tendon' },
  { begin: 'fr_SculptEyelidBegin', end: 'fr_SculptEyelidEnd', op: 'fro_EyelidOp', label: 'Eyelid', first: 'Bulge' },
] as const;
const ALL_OPS = ['fro_RegionOp', 'fro_PufferOp', 'fro_TendonOp', 'fro_EyelidOp'];

interface HistoryRecord { label: string; mute: boolean; pose: string; keys: { cluster: Cluster; key: Property }[] }
interface B14bState { historyPath: boolean; customLinks: FROp[] }
const bState = (app: App) => rowState<B14bState>(app, 'B14b', () => ({ historyPath: true, customLinks: [] }));
const loc = (app: App, key: string) => frStore(app).loc(key) || key;

/** The mouth-sculpt child: `<model>.SculptMouth` (suffix inferred, Q3). */
function mouthSculptChild(mesh: X3DObject | null): X3DObject | null {
  const m = mesh?.model; if (!m) return null;
  return m.children.find(c => c.name === 'SculptMouth') ?? null;
}
const MOUTH_BLOB = 'CDKMetaMouthSculpt';          // Q3: the likely value of the runtime global
const MIRROR_BLOB = 'CDKMetaMouthMirrorMap';       // Q3: stand-in name (the global was not read)
const mouthBlob = (mesh: X3DObject | null) => (mesh ? propNamed(mesh, MOUTH_BLOB) ?? null : null);

// ------------------------------------------------------------------ significance / symmetry (§2.4)
function significant(op: FROp): boolean { return !op.muted && Number(op.val('Strength') ?? 1) !== 0; }
function symmetric(kind: number, names: string[]): boolean {
  const set = new Set(names);
  for (const n of names) {
    if (kind === 0 && n === 'ChinForm_Region1') continue;
    if (n[0] === 'L') { if (!set.has('R' + n.slice(1))) return false; }
    else if (n[0] === 'R') { if (!set.has('L' + n.slice(1))) return false; }
    else return false;
  }
  return true;
}

// ------------------------------------------------------------------ shading (§2.3 item 6)
function ambience(app: App): number[] {
  const root: any = app.scene.root;
  const p = root.properties.find((x: Property) => x.type === 'AmbientLighting') ?? root.ambientNode;
  const v = p?.val('ambience');
  return Array.isArray(v) ? v.map(Number) : [0.2, 0.2, 0.2];   // inferred default (scene Ambient Lighting 0.2)
}
function setSurface(app: App, mat: Material, sh: Shader | null) { const old = mat.surface; app.record('SIConnectShader', () => mat.setSurface(sh), () => mat.setSurface(old)); }
function setupShading(app: App, C: string, face: X3DObject, sculpt: X3DObject): Shader | null {
  const mat = materialOf(face);
  if (!mat) { NYA(app, C, 'a face without any material'); return null; }
  if (!mat.surface) setSurface(app, mat, makePhong('DeleteThisShader'));
  let sh = mat.surface!; let saved: Shader | null = null;
  let dif = shaderColor(sh, 'diffuse'), amb = shaderColor(sh, 'ambient');
  if (!dif || !amb) { saved = sh; const ph = makePhong('Phong'); setSurface(app, mat, ph); sh = ph; dif = shaderColor(sh, 'diffuse'); amb = shaderColor(sh, 'ambient'); }
  const lm = new Material('Material'); const lam = makeLambert('Lambert'); lm.setSurface(lam);
  if (dif) lam.set('diffuse', dif.slice()); if (amb) lam.set('ambient', amb.slice());
  const oldMat = sculpt.material; app.record('AddMaterial', () => sculpt.setMaterial(lm), () => sculpt.setMaterial(oldMat));
  if (dif) { const [h, l, s] = rgbToHls(dif[0], dif[1], dif[2]); const d = hlsToRgb(h, l * 0.2, s); setShaderColor(app, sh, 'diffuse', [...d, ...dif.slice(3)]); }
  if (amb) { const A = ambience(app); setShaderColor(app, sh, 'ambient', [0, 1, 2].map(c => 0.3984 / Math.max(A[c] ?? 0.2, 1e-6) + amb![c] * 0.2).concat(amb.slice(3))); }
  return saved;
}
function restoreShading(app: App, face: X3DObject, sculpt: X3DObject | null, saved: Shader | null) {
  const mat = materialOf(face); if (!mat) return;
  if (saved) setSurface(app, mat, saved);
  else if (sculpt?.material?.surface && mat.surface) {
    const lam = sculpt.material.surface;
    for (const n of ['diffuse', 'ambient']) { const c = shaderColor(lam, n); if (c) setShaderColor(app, mat.surface, n, c); }
  }
  if (mat.surface && /DeleteThisShader/.test(mat.surface.name)) setSurface(app, mat, null);
}

// ------------------------------------------------------------------ Begin (§3 fr_SculptBegin)
function sculptBegin(app: App, kind: number, a: Record<string, any>): boolean {
  const K = KINDS[kind]; const C = K.begin; const st = frStore(app);
  let face = objArg(app, a.Face);
  if (!face && kind === 3) face = faceMesh(app);
  if (!face || !meshOf(face)) { app.logMsg('error', `${C}: Face is not a polygon mesh`); return false; }   // inferred failure text
  if (propNamed(face, 'SculptLinkReader')) { app.logMsg('error', `${face.name} has already a sculpt activated!`); return false; }
  if (mouthSculptChild(face)) { app.logMsg('error', `${face.name} has already a mouth sculpt activated!`); return false; }
  const pairs = pntClusters(face).map(c => [c, clusterOp(face!, c, [K.op])] as const).filter(([, op]) => !!op) as [Cluster, FROp][];
  NYA(app, C, 'the significant-deformation tests (an unmuted operator with non-zero Strength counts here)');
  const sig = pairs.filter(([, op]) => significant(op));
  if (!sig.length) { app.logMsg('error', `${face.name} has no significant deformations to start sculpting!`); return false; }
  const sym = symmetric(kind, sig.map(([c]) => c.name));
  progress(app, loc(app, 'pbar_init_sculpt'));
  const sculpt = duplicateMesh(app, face, 'ActiveSculpt', face);
  if (!sculpt) return false;
  const oldSt = st.raw('_', 'ActiveSculpt');
  app.record('fr_sput ActiveSculpt', () => st.put('_', 'ActiveSculpt', sculpt), () => { if (oldSt === undefined) st.delete('_', 'ActiveSculpt'); else st.put('_', 'ActiveSculpt', oldSt); });
  const oldPref = intArg(userPref(app, REF_PREF, 0), 0);
  if (sym) {
    const n = meshOf(sculpt)!.positions.length / 3;
    const cls = new Cluster('SymmetryMapCls', 'pnt', new Set([...Array(n).keys()]));
    app.record('CreateCluster', () => sculpt.addCluster(cls), () => sculpt.removeCluster(cls));
    const map = addClusterProp(app, cls, new Property('Symmetry Map', 'symmetrymap', []));
    const op = new FROp('SymmetryMap', 'SymmetryMap', [int('axis', 0, 'axis'), num('tolerance', 0.2, 'tolerance')]); op.cluster = cls; op.inputs[0] = map;
    addOp(app, sculpt, op);
    const fs = propNamed(faceModel(app) ?? face, 'FaceState');
    if (/Symmetric/.test(String(fs?.val('DNA') ?? '')) && !(oldPref & 0x800)) setUserPref(app, REF_PREF, oldPref | 0x800);
  }
  if (construction.mode !== 'secondaryshape') { const old = construction.mode; app.record('ConstructionMode', () => { construction.mode = 'secondaryshape'; }, () => { construction.mode = old; }); }
  const saved = setupShading(app, C, face, sculpt);
  NYA(app, C, 'the post-shading step 0x1801003f0 (inferred refresh)');
  // links (§2.3 items 2-4)
  const outs = 1 + (saved ? 1 : 0);
  const defs = [int('Mode', kind, 'Mode'), int('SymButtonOldState', oldPref, 'SymButtonOldState')];
  for (let i = 1; i <= outs; i++) defs.push(bool(`CustomLinkOut${i}`, false, `${i}CustomLinkOut`));
  const reader = addProperty(app, face, new Property('SculptLinkReader', 'customparamset', defs));
  const conn = addProperty(app, sculpt, new Property('SculptLinkConnection', 'customparamset', [bool('CustomLinkIn', false, 'CustomLinkIn')]));
  const link = (i: number, inLink: any) => {
    const op = new FROp('CustomLink', 'CustomLink'); (op as any).language = 'JScript'; (op as any).code = '';
    const out = reader.get(`CustomLinkOut${i}`)!; op.ports = { MainGroup: { outLink: out, inLink } }; (out as any).source = op;
    const L = bState(app).customLinks; app.record('CustomLink', () => L.push(op), () => { const k = L.indexOf(op); if (k >= 0) L.splice(k, 1); });
  };
  link(1, conn.get('CustomLinkIn'));
  if (saved) link(2, saved);
  return true;
}

// ------------------------------------------------------------------ End (§3 fr_SculptEnd)
function poseText(app: App): string {
  const fm = faceModel(app); const out: Record<string, number[]> = {};
  const ctrls = new Set<X3DObject>();
  for (const k of frStore(app).keys('controls')) { const v = frStore(app).raw('controls', k); if (v instanceof X3DObject) ctrls.add(v); }
  if (fm) for (const d of fm.descendants()) if (/_Control$/.test(d.name)) ctrls.add(d);
  for (const c of ctrls) out[c.fullName] = ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].map(p => Number(c.kinematics.local.val(p)));
  return Object.keys(out).length ? JSON.stringify(out) : '';
}
function applyPoseText(app: App, text: string): boolean {
  let data: Record<string, number[]>; try { data = JSON.parse(text); } catch { return false; }
  for (const [name, v] of Object.entries(data)) {
    const o = objOrName(app, name); if (!o) continue;
    ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].forEach((p, i) => setVal(app, o.kinematics.local, p, v[i]));
  }
  return true;
}
const TEMP = 'C:\\Temp';
function tempFile(): string | null { try { hostFs.ensureFolder(TEMP); for (let i = 0; ; i++) { const p = `${TEMP}\\TempSculptPose${i}.xsipose`; if (!hostFs.isFile(p)) return p; } } catch { return null; } }
function udbOf(face: X3DObject | null) { return face ? propNamed(face, 'SculptHistoryUDB') ?? null : null; }
const records = (udb: Property): HistoryRecord[] => ((udb as any).records ??= []);
function setRecords(app: App, udb: Property, next: HistoryRecord[]) { const old = records(udb).slice(); app.record('SetUserDataBlob', () => { (udb as any).records = next; }, () => { (udb as any).records = old; }); }
function ppgRebuild(app: App, prop: Property, init: boolean) {
  const face = prop.parent as any; const udb = udbOf(face instanceof X3DObject ? face : null);
  const rows = udb ? records(udb).map((r, i) => ({ index: i, label: r.label, mute: r.mute, keys: r.keys.map(k => k.key.name), hasPose: !!r.pose })) : [];
  const old = (prop as any).sessions; app.record('SculptHistory', () => { (prop as any).sessions = rows; (prop as any).init = init; }, () => { (prop as any).sessions = old; });
}
function rewriteUpdate(app: App, prop: Property) { const p = prop.get('Update'); if (p) app.setParam(p, !p.value); }
const historyProp = (face: X3DObject | null) => (face ? propNamed(face, 'SculptHistory') ?? null : null);

function bake(app: App, C: string, kind: number, face: X3DObject, sculpt: X3DObject | null, history: boolean) {
  const K = KINDS[kind];
  const fp = meshOf(face)?.positions, sp = sculpt ? meshOf(sculpt)?.positions : undefined;
  if (!fp || !sp || fp.length !== sp.length) { NYA(app, C, 'a sculpt whose point count differs from the face'); return; }
  // MyShape: ActiveSculpt geometry compared with the face's (non-enveloped) positions
  const udb0 = udbOf(face); const n = udb0 ? records(udb0).length : 0;
  const keys: { cluster: Cluster; key: Property }[] = [];
  for (const c of pntClusters(face)) {
    if (!clusterOp(face, c, [K.op])) continue;
    const delta: number[] = []; let any = false;
    for (const i of c.elements) { const k = Number(i) * 3; const d = [sp[k] - fp[k], sp[k + 1] - fp[k + 1], sp[k + 2] - fp[k + 2]]; if (d.some(x => Math.abs(x) > 1e-9)) any = true; delta.push(Number(i), ...d); }
    if (!any) continue;
    const key = new Property(`SculptP${n}_${c.name}`, 'shapekey', [str('data', JSON.stringify(delta), 'Offsets', { readOnly: true }), num('weight', 1, 'Weight', { min: 0, max: 1, keyable: true })]);
    addClusterProp(app, c, key); keys.push({ cluster: c, key });
  }
  NYA(app, C, 'the exact shape-key names of the bake and the face-deformer evaluation of the keys (Q1); keys are named SculptP<session>_<cluster>');
  if (!history) return;
  NYA(app, C, 'the owner of the MuteSculpting parameter written by the history bake');
  let pose = '';
  const tmp = tempFile();
  if (!tmp) msgBox(app, 'Couldnt create a temporary file.\nCurrent poses wont be saved along with the sculpt session', 0x10);
  else { try { hostFs.writeFile(tmp, poseText(app)); pose = hostFs.readFile(tmp); hostFs.deleteFile(tmp); } catch { msgBox(app, 'Error reading from the temporary file.\nCurrent poses wont be saved along with the sculpt session', 0x10); } }
  const udb = udb0 ?? addProperty(app, face, new Property('SculptHistoryUDB', 'UserDataBlob', []));
  setRecords(app, udb, [...records(udb), { label: K.label, mute: false, pose, keys }]);
  const hp = historyProp(face); if (hp) { ppgRebuild(app, hp, false); rewriteUpdate(app, hp); }
}

function sculptEnd(app: App, kind: number, a: Record<string, any>) {
  const K = KINDS[kind]; const C = K.end;
  let face = objOrName(app, a.Face);
  if (!face && kind === 3) face = faceMesh(app);
  const reader = face ? propNamed(face, 'SculptLinkReader') : undefined;
  if (!face || !reader) throw failLog(app, C, E_FAIL, `${face?.name ?? (unset(a.Face) ? '' : String(a.Face))} is not in sculpt mode.`);
  if (intArg(reader.val('Mode'), -1) !== kind) throw fail(E_UNEXPECTED, `${C}: the active sculpt session is not a ${K.label} session`);
  const old = intArg(reader.val('SymButtonOldState'), 0), cur = intArg(userPref(app, REF_PREF, 0), 0);
  if (!(old & 0x800) && (cur & 0x800)) setUserPref(app, REF_PREF, cur & ~0x800);
  // follow CustomLinkOut -> CustomLink -> inLink -> owner object
  const outs = reader.params.filter(p => /^CustomLinkOut\d+$/.test(p.name));
  const inOf = (p: any) => (p?.source as FROp | undefined)?.ports?.MainGroup?.inLink;
  const in0 = inOf(outs[0]); const sculpt = in0?.owner?.parent instanceof X3DObject ? in0.owner.parent as X3DObject : null;
  const savedIn = outs.slice(1).map(inOf).find(x => x instanceof Shader) as Shader | undefined;
  progress(app, loc(app, 'pbar_term_sculpt'));
  if (boolArg(a.Apply, false)) {
    NYA(app, C, 'the operator-fitting solver (0x180105130 / 0x180104d60 / 0x180106d90); operator parameters are not refitted');
    if (!bState(app).historyPath) bake(app, C, kind, face, sculpt, false);
    else { NYA(app, C, 'where the history-path flag comes from (Q7); the history path is taken'); bake(app, C, kind, face, sculpt, true); }
  }
  restoreShading(app, face, sculpt, savedIn ?? null);
  removeProp(app, face, reader);
  if (sculpt) deleteObj(app, sculpt);
  const L = bState(app).customLinks; const mine = L.filter(op => outs.includes(op.ports.MainGroup?.outLink));
  app.record('DeleteCustomLink', () => { for (const op of mine) { const k = L.indexOf(op); if (k >= 0) L.splice(k, 1); } }, () => L.push(...mine));
  const st = frStore(app); const was = st.raw('_', 'ActiveSculpt');
  if (was !== undefined) app.record('fr_sdelete ActiveSculpt', () => st.delete('_', 'ActiveSculpt'), () => st.put('_', 'ActiveSculpt', was));
  selectObj(app, [face]);
  return true;
}

// ------------------------------------------------------------------ mouth sculpt
function sculptMouthBegin(app: App, a: Record<string, any>) {
  const C = 'fr_SculptMouthBegin';
  const mesh = objOrName(app, a.mesh);
  if (mesh && propNamed(mesh, 'SculptLinkReader')) { app.logMsg('error', `${mesh.name} has already a sculpt activated!`); setStatus(app, C, 1); return undefined; }
  NYA(app, C, 'the view state set by 0x1800cf880 (view name from a runtime global)');
  const blob = mouthBlob(mesh);
  if (!mesh || !blob) { setStatus(app, C, 0); return undefined; }
  const child = mouthSculptChild(mesh);
  if (child) { selectObj(app, [child]); return undefined; }
  NYA(app, C, 'the mouth-blob validator 0x1800afa90 (an existing blob is taken as valid)');
  const clone = duplicateMesh(app, mesh, 'SculptMouth', mesh.model ?? null);
  if (!clone) return undefined;
  (clone as any).cloneOf = mesh;
  const b: any = blob; const was = !!b.sculpting; app.record('MouthSculpting', () => { b.sculpting = true; }, () => { b.sculpting = was; });
  if (mesh.material || materialOf(mesh)) { const m = new Material('Material'); const sh = makePhong('Phong'); m.setSurface(sh); const src = materialOf(mesh)?.surface ?? null; for (const n of ['diffuse', 'ambient']) { const c = shaderColor(src, n); if (c) sh.set(n, c); } clone.setMaterial(m); }
  NYA(app, C, 'the two mouth-sculpt set-up helpers 0x1800c2830 / 0x1800c34f0');
  setStatus(app, C, 0);
  return undefined;
}
function sculptMouthEnd(app: App, a: Record<string, any>) {
  const C = 'fr_SculptMouthEnd';
  const mesh = objOrName(app, a.mesh); const child = mouthSculptChild(mesh);
  if (!mesh || !child) return undefined;
  if (boolArg(a.cancel, false)) NYA(app, C, 'the mouth bake helper 0x1800aded0 run when the second argument is true (Q4)');
  const from = child.material?.surface ?? null, to = materialOf(mesh)?.surface ?? null;
  if (from && to) for (const n of ['diffuse', 'ambient']) { const c = shaderColor(from, n); if (c) setShaderColor(app, to, n, c); }
  deleteObj(app, child);
  const blob: any = mouthBlob(mesh); if (blob?.sculpting) app.record('MouthSculpting', () => { blob.sculpting = false; }, () => { blob.sculpting = true; });
  selectObj(app, [mesh]);
  const hp = historyProp(mesh); if (hp) rewriteUpdate(app, hp);
  return undefined;
}
function mirrorMouthSculpt(app: App, a: Record<string, any>) {
  const C = 'fr_MirrorMouthSculpt';
  const mesh = objOrName(app, a.mesh); const child = mouthSculptChild(mesh);
  if (!mesh || !child) { app.logMsg('info', 'Mirror mouth sculpt requires an active mouth sculpt.'); return undefined; }
  const blob: any = mouthBlob(mesh), mir: any = propNamed(mesh, MIRROR_BLOB);
  NYA(app, C, `the byte layouts of the mouth data blob and the mirror-map blob (Q3); stand-in fields ${MOUTH_BLOB}.mouth / ${MIRROR_BLOB}.pairs`);
  const rest = meshOf(mesh)?.positions, cur = meshOf(child)?.positions;
  if (!blob?.mouth || !mir?.pairs || !rest || !cur) { app.select([]); return undefined; }
  const verts: number[] = blob.mouth.vertices ?? [], scale = Number(blob.mouth.scale ?? 1);
  const pairs: [number, number][] = intArg(a.mode, 0) === 0 ? mir.pairs : mir.pairs.map(([s, d]: [number, number]) => [d, s]);
  const partner = new Map(pairs);
  const next = Float32Array.from(cur); let moved = false; const tol = (scale * 0.001) ** 2;
  for (const s of verts) {
    const d = partner.get(s); if (d === undefined) continue;
    const o = [cur[s * 3] - rest[s * 3], cur[s * 3 + 1] - rest[s * 3 + 1], cur[s * 3 + 2] - rest[s * 3 + 2]];
    const t = [rest[d * 3] - o[0], rest[d * 3 + 1] + o[1], rest[d * 3 + 2] + o[2]];
    const dv = [t[0] - next[d * 3], t[1] - next[d * 3 + 1], t[2] - next[d * 3 + 2]];
    if (dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2 > tol) {
      app.logMsg('info', `SelectGeometryComponents("${child.fullName}.pnt[${d}]")`);
      app.logMsg('info', `Translate(, ${dv[0]}, ${dv[1]}, ${dv[2]}, siRelative, siView, siObj, siXYZ, , , , , , , , , , 4)`);
      next[d * 3] = t[0]; next[d * 3 + 1] = t[1]; next[d * 3 + 2] = t[2]; moved = true;
    }
  }
  if (moved) setMeshPoints(app, child, next);
  app.select([]);   // DeselectAll
  return undefined;
}

// ------------------------------------------------------------------ mirror sculpt
function mirrorSculpt(app: App, a: Record<string, any>) {
  const C = 'fr_MirrorSculpt';
  const face = objOrName(app, a.face);
  if (face && propNamed(face, 'SculptLinkReader')) { app.logMsg('info', `Please finish the current sculpt on ${face.fullName}`); setStatus(app, C, 1); return undefined; }
  const type = intArg(a.type, 0); const fam = ['fro_RegionOp', 'fro_PufferOp', 'fro_TendonOp'][type] ?? null;   // type -> family inferred
  const deformer = face ? opsOf(face).find(op => /facialsofttissue/i.test(op.type)) ?? null : null;   // face deformer (0x180127400), inferred type
  if (!face || !deformer) throw fail(E_UNEXPECTED, `${C}: no face deformer operator on ${face?.name ?? 'the face'}`);
  const dm: any = deformer; const wasMuted = !!dm.muted;
  app.record('MuteOp', () => { dm.muted = true; }, () => { dm.muted = wasMuted; });
  if (!fam) NYA(app, C, `the symmetry-map mirror 0x1800f28f0 (type ${type})`);
  else {
    NYA(app, C, 'the mirror solver 0x1800f3b00 numerics; parameters are copied L/R as they are');
    const dirLR = intArg(a.direction, 0) === 0;
    for (const c of pntClusters(face)) {
      if (c.name === 'ChinForm_Region1') continue;
      const from = dirLR ? 'L' : 'R', to = dirLR ? 'R' : 'L';
      if (c.name[0] !== from) continue;
      const tc = face.clusters.find(x => x.compKind === 'pnt' && x.name === to + c.name.slice(1)); if (!tc) continue;
      const so = clusterOp(face, c, [fam]), to2 = clusterOp(face, tc, [fam]); if (!so || !to2) continue;
      for (const p of so.params) if (typeof p.value === 'number') setVal(app, to2, p.name, p.value);
    }
  }
  app.record('UnmuteOp', () => { dm.muted = wasMuted; }, () => { dm.muted = true; });
  setStatus(app, C, 0);
  return undefined;
}

// ------------------------------------------------------------------ history commands
function sessionArg(app: App, C: string, udb: Property, v: any): number {
  const i = intArg(v, -1);
  if (unset(v) || i < 0 || i >= records(udb).length) throw fail(E_INVALIDARG, `${C}: SessionID ${unset(v) ? '' : v} is out of range`);
  return i;
}
function applySculptPose(app: App, a: Record<string, any>) {
  const C = 'fr_ApplySculptPose';
  const udb = udbOf(faceMesh(app)); if (!udb) return undefined;
  NYA(app, C, 'the SculptHistoryUDB byte layout (Q2); records are kept in memory');
  const r = records(udb)[sessionArg(app, C, udb, a.SessionID)];
  if (!r.pose) { msgBox(app, 'This sculpt session has no pose data available... sorry.', 0x30); setStatus(app, C, 1); return undefined; }
  const tmp = tempFile();
  if (!tmp) { msgBox(app, 'Couldnt create a temporary file', 0x10); setStatus(app, C, 1); return undefined; }
  hostFs.writeFile(tmp, r.pose);
  if (!applyPoseText(app, hostFs.readFile(tmp))) msgBox(app, 'Apply sculpt pose failed', 0x10);
  hostFs.deleteFile(tmp);
  return undefined;
}
function historyPropArg(app: App, v: any): Property | null {
  if (v instanceof Property) return v;
  if (unset(v)) return null;
  const n = resolve(app, v); if (n instanceof Property) return n;
  const hp = historyProp(faceMesh(app)); return hp && hp.fullName === String(v) ? hp : null;
}
function deleteSculptSession(app: App, a: Record<string, any>) {
  const C = 'fr_DeleteSculptSession';
  const udb = udbOf(faceMesh(app)); if (!udb) return undefined;
  const i = sessionArg(app, C, udb, a.SessionID);
  const r = records(udb)[i];
  for (const { cluster, key } of r.keys) if (cluster.properties.includes(key)) app.record('DeleteObj ' + key.name, () => cluster.removeProperty(key), () => cluster.addProperty(key));
  setRecords(app, udb, records(udb).filter((_, k) => k !== i));
  const prop = historyPropArg(app, a.Prop); if (prop) { ppgRebuild(app, prop, false); rewriteUpdate(app, prop); }
  return undefined;
}
function deleteAllSculptSessions(app: App, a: Record<string, any>) {
  const face = faceMesh(app); if (!face) return undefined;
  const doomed: [Cluster, Property][] = [];
  for (const c of pntClusters(face)) {
    if (!clusterOp(face, c, ALL_OPS)) continue;
    for (const p of c.properties) if (p.type === 'shapekey' && /^sculpt/i.test(p.name.slice(0, 6))) doomed.push([c, p]);
  }
  if (doomed.length) app.record('DeleteObj', () => { for (const [c, p] of doomed) c.removeProperty(p); }, () => { for (const [c, p] of doomed) c.addProperty(p); });
  const udb = udbOf(face); if (udb) removeProp(app, face, udb);
  const prop = historyPropArg(app, a.Prop); if (prop) { ppgRebuild(app, prop, false); rewriteUpdate(app, prop); }
  return undefined;
}
function toggleMuteSculptSession(app: App, a: Record<string, any>) {
  const C = 'fr_ToggleMuteSculptSession';
  const udb = udbOf(faceMesh(app)); if (!udb) return undefined;
  const i = sessionArg(app, C, udb, a.SessionID); const mute = boolArg(a.MuteFlag, false);
  const r = records(udb)[i];
  for (const { key } of r.keys) {
    const ch = key.name[6]; const nc = /[Pp]/.test(ch ?? '') ? (mute ? 'p' : 'P') : (mute ? 'n' : 'N');
    const nn = key.name.slice(0, 6) + nc + key.name.slice(7); const old = key.name;
    if (nn !== old) app.record('Rename', () => { key.name = nn; }, () => { key.name = old; });
  }
  setRecords(app, udb, records(udb).map((x, k) => (k === i ? { ...x, mute } : x)));
  const prop = historyPropArg(app, a.Prop); if (prop) { ppgRebuild(app, prop, false); rewriteUpdate(app, prop); }
  return undefined;
}
function inspectSculptHistory(app: App) {
  const C = 'fr_InspectSculptHistory';
  const face = faceMesh(app); if (!face || !udbOf(face)) return undefined;
  const hp = historyProp(face) ?? addProperty(app, face, new Property('SculptHistory', 'SculptHistory', [bool('Update', false, 'Update')]));
  ppgRebuild(app, hp, true);
  NYA(app, C, 'the SculptHistory layout and PPG events (SculptHistory_DefineLayout / _PPGEvent)');
  const d = frDesktop(app); const v = [...d.views.entries()].find(([n]) => n === 'SculptHistory')?.[1];
  if (v) v.attrs.targetcontent = hp.fullName;
  else d.views.set('SculptHistory', { type: 'Property Panel', attrs: { targetcontent: hp.fullName, height: 400 } });
  return undefined;
}
function refreshSculptHistory(app: App, a: Record<string, any>) {
  const hp = historyProp(faceMesh(app)); if (hp) { ppgRebuild(app, hp, boolArg(a.init, false)); rewriteUpdate(app, hp); }
  return undefined;
}

// ------------------------------------------------------------------ meta / proxy / vector mouth, controller DB, stick lips
function adjustMetaMouth(app: App) {
  const C = 'fr_AdjustMetaMouth';
  const face = faceMesh(app);
  if (!face || !mouthBlob(face)) { app.logMsg('info', 'Select a model with a solved mouth.'); return undefined; }
  NYA(app, C, 'the mouth-adjust property set-up in 0x1800e5bc0 (target MouthAdjustProperties inferred)');
  frDesktop(app).views.set('MouthAdjust', { type: 'Property Panel', attrs: { targetcontent: `${face.fullName}.MouthAdjustProperties` } });
  return undefined;
}
function proxyMouth(app: App, a: Record<string, any>) {
  const C = 'fr_ProxyMouth';
  progress(app, loc(app, 'pbar_init_mouth_proxy'));
  const face = faceMesh(app); if (!face) return false;
  const proxy = duplicateMesh(app, face, 'ExtractedMouth', face.model ?? null);
  if (!proxy) return false;
  NYA(app, C, `the meaning of mode ${intArg(a.mode, 0)} and the rest of 0x1800e8610 (hide the non-mouth part, RemoveFlexEnvDeformer, UpdateInnerMouth, MouthAdjustProperties / fro_MouthAdjustPropLink, eyelid curves)`);
  return true;
}
function vectorMouth(app: App, a: Record<string, any>) {
  const C = 'fr_VectorMouth';
  const face = faceMesh(app);
  NYA(app, C, `the mouth-state check 0x1800a7cd0 and the worker 0x1800aba80 (mode ${intArg(a.mode, 0)}${face ? '' : ', no face mesh'})`);
  return undefined;
}
const CONTROLLERS = ['Head_Control', 'LMouthCorner_Control', 'RMouthCorner_Control', 'LLipUpperBend_Control', 'LipUpper_Control', 'RLipUpperBend_Control',
  'LLipLowerBend_Control', 'LipLower_Control', 'RLipLowerBend_Control', 'JawEnd_Control', 'LPuffer_Control', 'RPuffer_Control', 'mpChin_Control',
  'LNostrilBase_Control', 'LNostrilBulge_Control', 'NoseTip_Control', 'RNostrilBase_Control', 'RNostrilBulge_Control', 'ROrbitalUpper_Control',
  'ROrbitalLower_Control', 'REyelidUpper_Control', 'REyelidLower_Control', 'LOrbitalUpper_Control', 'LOrbitalLower_Control', 'LEyelidUpper_Control',
  'LEyelidLower_Control'];
function resetControllerDB(app: App) {
  const C = 'fr_ResetControllerDB'; const st = frStore(app); const fm = faceModel(app);
  const visited: string[] = [];
  for (const name of CONTROLLERS) {
    const ctrl = fm ? childNamed(fm, name) : null; if (!ctrl) continue;
    const old = st.raw('controls', name);
    app.record('fr_sput controls', () => st.put('controls', name, ctrl), () => { if (old === undefined) st.delete('controls', name); else st.put('controls', name, old); });
    visited.push(name);
  }
  (frState(app).rows as any).resetControllerDB = visited;
  NYA(app, C, 'what 0x1800ca2f0 resets on each controller\'s FaceControl property (ID) and the names of the two FaceModel blobs deleted afterwards (Q5)');
  return undefined;
}
function stickLips(app: App) {
  const C = 'fr_StickLips';
  const face = faceMesh(app);
  if (face) { face.cluster('MouthRegion'); face.cluster('MouthLipRegion'); }
  const ls = face ? propNamed(face, 'LipStiction') : undefined;
  if (ls) inspectObj(app, C, ls.fullName, 3);
  else app.logMsg('info', 'To enable Stiction in this Scene, the Mouth has to be Regenerated');
  return undefined;
}

export function registerFaceRobotB14bCommands(app: App) {
  const reg = (name: string, description: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label: name, category: 'Face Robot', description, args: args.map(([n, d]) => ({ name: n, default: d })), execute });
  KINDS.forEach((K, kind) => {
    reg(K.begin, 'Command that starts a sculpting session', [['Face', null]], (app, a) => sculptBegin(app, kind, a));
    reg(K.end, 'Command that ends and applies a sculpting session', [['Face', null], ['Apply', null]], (app, a) => sculptEnd(app, kind, a));
  });
  reg('fr_SculptMouthBegin', 'Sculpt the mouth', [['mesh', null]], sculptMouthBegin);
  reg('fr_SculptMouthEnd', 'Sculpt the mouth', [['mesh', null], ['cancel', null]], sculptMouthEnd);
  reg('fr_MirrorMouthSculpt', 'Mirror the mouth sculpt', [['mode', null], ['mesh', null]], mirrorMouthSculpt);
  reg('fr_MirrorSculpt', '', [['direction', null], ['face', null], ['type', null]], mirrorSculpt);
  reg('fr_ApplySculptPose', 'Command that applies the pose of a given sculpting session', [['SessionID', null]], applySculptPose);
  reg('fr_DeleteSculptSession', 'Command that deletes a given sculpting session', [['SessionID', null], ['Prop', null]], deleteSculptSession);
  reg('fr_DeleteAllSculptSessions', 'Command that deletes all sculpting sessions', [['Prop', null]], deleteAllSculptSessions);
  reg('fr_ToggleMuteSculptSession', 'Command that mutes/unmutes a given sculpting session', [['SessionID', null], ['Prop', null], ['MuteFlag', null]], toggleMuteSculptSession);
  reg('fr_InspectSculptHistory', '', [], inspectSculptHistory);
  reg('fr_RefreshSculptHistory', '', [['init', null]], refreshSculptHistory);
  reg('fr_AdjustMetaMouth', '', [], adjustMetaMouth);
  reg('fr_ProxyMouth', '', [['mode', null]], proxyMouth);
  reg('fr_VectorMouth', '', [['mode', null]], vectorMouth);
  reg('fr_ResetControllerDB', '', [], resetControllerDB);
  reg('fr_StickLips', '', [], stickLips);
  void put;
  // check-script access to the stand-ins (tools/compare_fr_b14bc_commands.mjs)
  (app as any).frB14bc = { buildSampleRegions: () => buildSampleRegions(app), desktop: () => frDesktop(app), state: () => frState(app), b: () => bState(app), MOUTH_BLOB, MIRROR_BLOB, construction, ensureGroup: (n: string) => ensureGroup(app, n), Property, Cluster };
}
export { MOUTH_BLOB, MIRROR_BLOB, bState };
