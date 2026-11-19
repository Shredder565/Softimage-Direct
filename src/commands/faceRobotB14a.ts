// Ledger row CMD-B14a (Face Robot `FR.dll`): utilities, the `fr_s*` key/value store, file I/O, queries, mesh arrays,
// groups / visibility, mute. 30 commands:
//   fr_sget fr_sset fr_sdelete fr_sindices fr_sstring fr_sdump fr_sfeatures fr_FileDelete fr_FileRead fr_FileWrite
//   fr_GetFilesForBrowser fr_GetCommand fr_GetCurrentObjState fr_IsDesigner fr_Callstack_IsDebugMode fr_Mute
//   fr_MuteSources fr_GetFaceModel GetFaceCluster GetFaceWeightMap fr_NeighborIndex fr_GetPointArray fr_GetNormalArray
//   fr_GetOperatorsInStack fr_GlueMeshGlobal fr_AddToGroup fr_Visible fr_AddObjectInPlace fr_RepairNan fr_PrepareExport
// Brief: docs/ghidra/cmd-b14a-fr-utilities-storage.md ("Wire contract" of each command, including the `(inferred)`
// parts) and docs/re/WIRE_CORRECTIONS_B14.md items 8-10. Original code written from that prose only; no golden exists.
//
// Mapping onto this build (in addition to faceRobotB14Shared.ts):
//  * The store is the shared FRStore. Its localization table is loaded by the first fr_s* call of this row.
//  * siNotInspectable (capability 8) is the node field `siNotInspectable` (fr_AddToGroup sets it; fr_Visible and
//    fr_PrepareExport read it).
//  * A non-failing S_FALSE status is kept in `app.faceRobotB14.rows.B14a.status[<command>]`.
//  * Command objects are the bus definitions (CommandDef); siNoLogging is `noLog`.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B14a)".
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { Cluster, Group, Model, Operator, REGIONS, makeDisplay } from '../core/scene';
import { int, num, bool } from '../core/params';
import { CurveData } from '../core/curves';
import { CFile } from './pluginsB13eShared';
import {
  frState, frStore, rowState, FRStore, fail, failLog, logNya as logNyaRow, isFile, readBytes, unset, listOf, intArg, numArg,
  boolArg, resolve, objArg, nodesArg, Node, X3DObject, Property, hostFs, frGroup, addProperty, cuCompare,
  S_OK, S_FALSE, E_FAIL, E_INVALIDARG, DISP_E_MEMBERNOTFOUND, buildSampleFace,
} from './faceRobotB14Shared';

const ROW = 'CMD-B14a';
const CAT = 'Face Robot';
const logNya = (app: App, command: string, what: string) => logNyaRow(app, command, what, ROW);

interface B14aState {
  /** Non-failing statuses (S_FALSE) by command. */
  status: Record<string, number>;
  /** Localization table load attempted (first fr_s* call). */
  locTried: boolean;
  locPath: string;
  /** Branch flag recorded per group member by fr_AddToGroup (group membership here has no branch mode). */
  branch: WeakMap<Group, Set<X3DObject>>;
}
const b14a = (app: App) => rowState<B14aState>(app, 'B14a', () => ({ status: {}, locTried: false, locPath: '', branch: new WeakMap() }));
const setStatus = (app: App, command: string, s: number) => { b14a(app).status[command] = s; };

// ------------------------------------------------------------------ small helpers
/** Softimage-style full name (without this build's `Scene.Scene_Root.` prefix). */
const siName = (n: Node) => n.fullName.replace(/^Scene\.Scene_Root\./, '');
const text = (v: any) => (unset(v) ? '' : v instanceof Node ? siName(v) : String(v));
/** The ASCII (narrow) form of a wide string: characters above 0x7f become '?' (inferred: default code-page fallback). */
const ascii = (s: string) => { let o = ''; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o += c < 0x80 ? s[i] : '?'; } return o; };
const firstSelected = (app: App): Node | null => app.selection[0] ?? null;
const notInspectable = (n: Node) => !!(n as any).siNotInspectable;
function valueText(v: any): string {
  if (v instanceof Node) return siName(v);
  if (Array.isArray(v)) return v.map(valueText).join(',');
  if (v === undefined || v === null) return '';
  return String(v);
}
/** Owner model of an object (the nearest Model above it; a model's owner is its parent model). */
function ownerModel(o: Node | null): Model | null {
  let p = o instanceof X3DObject ? o.parentObj : null;
  while (p && !(p instanceof Model)) p = p.parentObj;
  return p as Model | null;
}

// ------------------------------------------------------------------ localization (cmd-b14a §2.2)
export function loadLocalization(app: App, force = false) {
  const rs = b14a(app); const st = frState(app);
  if (rs.locTried && !force) return;
  rs.locTried = true;
  if (!st.interactive) return;   // batch: nothing is loaded
  let path = '';
  if (app.commands.has('fr_GetFile')) {
    const r = app.run('fr_GetFile', { inFileName: 'views\\FR.en-us.txt' });
    path = typeof r === 'string' ? r : r instanceof Node ? '' : r ? String(r) : '';
  }
  rs.locPath = path;
  if (!path) { logNya(app, 'fr_sstring', 'the localization path fr_GetFile gives for views\\FR.en-us.txt (its JScript body is not wired here); table left empty'); return; }
  if (!isFile(path)) { app.logMsg('error', `Unable to read localization file '${path}'`); return; }
  // bytes widened one per character (Latin-1)
  const b = readBytes(path); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  st.store.loadLocalization(s);
}
const storeOf = (app: App) => { const s = frStore(app); loadLocalization(app); return s; };

// ------------------------------------------------------------------ fr_s* store
function frSget(app: App, a: Record<string, any>) {
  const s = storeOf(app); const [sec, key] = FRStore.where(a.key1, a.key2);
  return s.get(sec, key);
}
function frSset(app: App, a: Record<string, any>) {
  const s = storeOf(app);
  const k1 = text(a.key1), value = a.value;
  if (unset(value) || value === '') s.put('_', k1, a.key2);                     // value empty: key2's value at (_, key1)
  else if (k1 === 'mem') s.put('mem', text(a.key2), valueText(value));          // persisted by put()
  else s.put(k1, text(a.key2), value);
  return undefined;
}
function frSdelete(app: App, a: Record<string, any>) {
  const s = storeOf(app); const [sec, key] = FRStore.where(a.key1, a.key2);
  s.delete(sec, key);
  return undefined;   // return value enabled, nothing put
}
function frSindices(app: App, a: Record<string, any>) {
  const s = storeOf(app); const k = text(a.key);
  return s.keys(k === '' ? '_' : k);
}
function frSstring(app: App, a: Record<string, any>) { return storeOf(app).loc(text(a.key)); }
function frSdump(app: App, a: Record<string, any>) {
  const s = storeOf(app);
  let sev = intArg(a.severity, 0); if (sev === 0) sev = 8;
  const lines = ['', '--------'];
  for (const sec of s.sections()) {
    lines.push(`${sec}: `);
    for (const k of s.keys(sec)) lines.push(`   ${k}: ${valueText(s.raw(sec, k))}`);
  }
  lines.push('--------');
  // siFatal 1 / siError 2 -> error lines; everything else (warning 4, info 8, verbose 16) -> info lines
  const kind = sev === 1 || sev === 2 ? 'error' : 'info';
  for (const l of lines) {
    if (l.length === 0) { app.logMsg(kind, ''); continue; }
    for (let i = 0; i < l.length; i += 100) app.logMsg(kind, l.slice(i, i + 100));
  }
  return undefined;
}
function frSfeatures(app: App) {
  const s = storeOf(app);
  const recs = s.features.get('features');
  if (!recs) { logNya(app, 'fr_sfeatures', 'how the features table is filled (state rebuild 0x18002d110) and the two record formatters; table absent'); return []; }
  const out: string[] = []; for (const [x, y] of recs) out.push(x, y);
  return out;
}

// ------------------------------------------------------------------ file I/O
function frFileDelete(app: App, a: Record<string, any>) {
  const f = ascii(text(a.filename));
  if (!f || !isFile(f)) return false;
  try { hostFs.deleteFile(f); return true; } catch { return false; }
}
function frFileRead(app: App, a: Record<string, any>) {
  const C = 'fr_FileRead'; const f = text(a.filename);
  if (!f) throw failLog(app, C, E_FAIL, 'No filename for reading.');
  const h = CFile.open(f, 'rb');
  if (!h) throw failLog(app, C, E_FAIL, `Unable to open ${f}`);
  const b = h.data; let s = '';
  for (let i = 0; i < b.length && b[i] !== 0; i++) s += String.fromCharCode(b[i]);   // zero-terminated conversion
  return s;
}
function frFileWrite(app: App, a: Record<string, any>) {
  const C = 'fr_FileWrite'; const f = text(a.filename);
  if (!f) throw fail(E_FAIL, `${C}: empty filename`);
  const h = CFile.open(f, 'wb');
  if (!h) throw fail(E_FAIL, `${C}: cannot open ${f}`);
  const t = ascii(text(a.txt)); const b = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 0xff;
  h.write(b); h.close();
  return undefined;
}
const KIND_IMAGES: Record<string, string> = {
  eye: 'img/BrowserDefaultEye.gif', face: 'img/BrowserDefaultFace.gif', dna: 'img/BrowserDefaultDna.gif', faceani: 'img/BrowserDefaultFaceAni.gif',
  facepose: 'img/BrowserDefaultFacePose.gif', teeth: 'img/BrowserDefaultTeeth.gif', tongue: 'img/BrowserDefaultTongue.gif',
};
function frGetFilesForBrowser(app: App, a: Record<string, any>) {
  let path = text(a.path); const ext = text(a.extension);
  const dflt = text(a.defaultimage) || 'img/BrowserDefault.gif';
  const out: any[] = [0];
  if (!path || !ext) return out;
  if (!path.endsWith('\\')) path += '\\';
  let names: string[] = [];
  try { names = hostFs.listFiles(path); } catch { names = []; }
  const lext = '.' + ext.toLowerCase();
  // FindFirstFile order on NTFS: by upper-cased name (inferred for the virtual file system)
  names = names.filter(n => n.toLowerCase().endsWith(lext)).sort((x, y) => cuCompare(x.toUpperCase(), y.toUpperCase()));
  const exists = (p: string) => isFile(ascii(p));
  const keepUnderscores = valueText(frStore(app).raw('mem', 'show_')) !== '';
  for (const n of names) {
    const parts = n.split('.');
    let label: string, image: string;
    if (parts.length === 2) { label = parts[0]; image = exists(`${path}${parts[0]}.gif`) ? `${path}${parts[0]}.gif` : dflt; }
    else if (parts.length === 3) {
      label = parts[0];
      image = exists(`${path}${parts[0]}.gif`) ? `${path}${parts[0]}.gif` : KIND_IMAGES[parts[1].toLowerCase()] ?? dflt;
    } else { label = n; image = exists(`${path}${n}.gif`) ? `${path}${n}.gif` : dflt; }
    if (!keepUnderscores) label = label.replace(/_/g, ' ');
    out[0] += 3;
    out.push(label, image, path + n);
  }
  return out;
}

// ------------------------------------------------------------------ queries
function frGetCommand(app: App, a: Record<string, any>) {
  const def: CommandDef | undefined = app.commands.get(text(a.cmd));
  if (!def) return null;
  def.noLog = true;   // siNoLogging (0x800000) set true: a lasting change to that command
  return def;
}
function frMute(app: App, a: Record<string, any>) {
  const st = frState(app);
  if (!unset(a.state) && a.state !== '') {
    const n = typeof a.state === 'boolean' ? Number(a.state) : Number(a.state);
    if (Number.isFinite(n)) {
      const s = Math.trunc(n);
      if (s === 0) st.mute = false; else if (s === 1) st.mute = true; else if (s === 2) st.mute = !st.mute;
    }
  }
  return st.mute;
}
function frMuteSources(app: App, a: Record<string, any>) {
  const C = 'fr_MuteSources';
  const objs = nodesArg(app, a.Objects);
  if (!objs.length) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: empty Objects collection`);
  const fm = frStore(app).raw('_', 'FaceModel');
  const model = fm instanceof X3DObject ? fm : typeof fm === 'string' && fm ? app.scene.find(fm) ?? null : null;
  const jaw = model ? [...model.descendants()].find(o => o.name === 'JawEnd_ControlOffset') ?? null : null;
  const retarget = !!jaw && boolArg(a.b_IncludeRetargeting, false);
  const mute = boolArg(a.b_Mute, false);
  const resetRetarget = (v: boolean) => {
    if (app.commands.has('fr_ResetRetarget')) app.run('fr_ResetRetarget', { inValue: v });
    else logNya(app, C, `fr_ResetRetarget(${v}) (not on the bus)`);
  };
  if (!mute && retarget) resetRetarget(false);
  if (mute) {
    logNya(app, C, 'whether b_ResetTransforms gates the ResetTransform (run regardless)');
    // ResetTransform(<Objects as text>, 0, 0x40, 7): object reference mode, SRT, XYZ (inferred)
    app.run('ResetTransform', { InputObj: objs.map(o => o.fullName).join(',') });
    if (retarget) resetRetarget(true);
  }
  return undefined;
}

// ------------------------------------------------------------------ face model / clusters
function isFaceModel(app: App, m: Node | null, headUnread: { logged: boolean }, C: string): boolean {
  if (!(m instanceof Model)) return false;
  if (frStore(app).raw('_', 'FaceModel') === m) return true;
  const has = (n: string) => m.properties.some(p => p.name === n);
  if (has('FaceState') && has('FaceConnections') && has('FaceScale')) return true;
  if (!headUnread.logged) { headUnread.logged = true; logNya(app, C, 'the "Head" face-model test (0x180009bb0); not applied'); }
  return false;
}
function frGetFaceModel(app: App, a: Record<string, any>) {
  const C = 'fr_GetFaceModel'; const h = { logged: false };
  const sel = firstSelected(app);
  const own = ownerModel(sel);
  if (own && isFaceModel(app, own, h, C)) return own;
  for (const o of app.scene.allObjects()) if (o instanceof Model && isFaceModel(app, o, h, C)) return o;
  if (boolArg(a.MakeFaceModel, false)) {
    logNya(app, C, 'the face-structure builder (0x18000ce80): the 6 `_`/meshnames entries, the face connection property and the structure');
    return own;   // as read: the model of the first selected item (null when nothing is selected)
  }
  return null;
}
function faceClusterOf(app: App, obj: X3DObject, C: string): Cluster {
  const found = obj.clusters.filter(c => c.name === 'FaceCluster');
  if (!found.length) {
    const c = new Cluster('FaceCluster', 'pnt', new Set());
    app.record('AddCluster', () => obj.addCluster(c), () => obj.removeCluster(c));
    return c;
  }
  if (found.length > 1) app.logMsg('info', ` MORE THAN ONE FACE CLUSTER FOUND! using <<${siName(found[0])}>>`);
  return found[0];
}
function getFaceCluster(app: App, a: Record<string, any>) {
  const C = 'GetFaceCluster';
  let obj = objArg(app, a.Object);
  if (!obj) {   // only the selection fallback is type-checked
    const s = firstSelected(app);
    if (!(s instanceof X3DObject) || s.type !== 'polymsh') throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no Object and the first selected item is not a polymsh`);
    obj = s;
  }
  return faceClusterOf(app, obj, C);
}
function getFaceWeightMap(app: App, a: Record<string, any>) {
  const C = 'GetFaceWeightMap';
  let obj: X3DObject | null = null;
  const given = unset(a.Object) ? null : resolve(app, a.Object);
  if (given instanceof X3DObject && given.type === 'polymsh') obj = given;
  else {
    if (given) app.logMsg('info', `Specified Object<<${siName(given)}>> is of type ${given.type}`);
    const s = firstSelected(app);
    if (!(s instanceof X3DObject) || s.type !== 'polymsh') throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no polymsh Object and the first selected item is not a polymsh`);
    obj = s;
  }
  const cl = faceClusterOf(app, obj, C);
  const name = text(a.MapName);
  // the name is split on "_" for the match (inferred: the property's first "_" part equals MapName)
  const hits = cl.properties.filter(p => p.name === name || p.name.split('_')[0] === name);
  if (hits.length > 1) app.logMsg('info', ` MORE THAN ONE WeightMap FOUND! using <<${siName(hits[0])}>>`);
  if (hits.length) return hits[0];
  const p = new Property(name || 'Weight_Map', 'weightmap', [
    num('weight', 1, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable'),
    int('red', 255, 'Red', { min: 0, max: 255 }), int('green', 255, 'Green', { min: 0, max: 255 }), int('blue', 255, 'Blue', { min: 0, max: 255 }),
  ]);
  (p as any).values = new Map<number, number>();
  app.record('AddProp Weight Map Property', () => cl.addProperty(p), () => cl.removeProperty(p));
  app.setParam(p.get('red')!, intArg(a.R, 255)); app.setParam(p.get('green')!, intArg(a.G, 255)); app.setParam(p.get('blue')!, intArg(a.B, 255));
  return p;
}

// ------------------------------------------------------------------ mesh arrays
/** Object argument with the Selection-object fallback (cmd-b14a Q3: the fallback is the Selection itself, which fails
 *  the class test) or the item-0 fallback. */
function meshArg(app: App, C: string, v: any, itemZero: boolean): X3DObject {
  const o = objArg(app, v);
  if (o) { if (!o.primitive) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: ${o.fullName} has no geometry`); return o; }
  if (!itemZero) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: invalid inObj (the selection fallback passes the Selection object, which fails the class test)`);
  const s = firstSelected(app);
  if (!(s instanceof X3DObject) || !s.primitive) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: invalid inObj and the first selected item has no geometry`);
  return s;
}
/** Runs fn with the scene evaluated at `time` (DBL_MAX or unset = the current frame). */
function atTime<T>(app: App, time: any, fn: () => T): T {
  const t = numArg(time, Number.MAX_VALUE);
  if (!(Math.abs(t) < 1e300) || t === app.anim.frame) return fn();
  const saved = app.anim.frame; app.anim.frame = t;
  try { return fn(); } finally { app.anim.frame = saved; }
}
function positionsAt(o: X3DObject, mode: number): Float64Array | null {
  const prim = o.primitive!;
  const g = mode === 3 ? prim.geom() : prim.geomUpTo(REGIONS[mode]);
  if (!g) return new Float64Array(0);
  if (g.positions) return Float64Array.from(g.positions as Float32Array);
  if (g.cvs) { const cs = [g as CurveData, ...((g as any).subcurves ?? [])]; const out: number[] = []; for (const c of cs) for (const p of c.cvs) out.push(p[0], p[1], p[2]); return Float64Array.from(out); }
  return new Float64Array(0);
}
function pointNormals(o: X3DObject, mode: number): Float64Array {
  const prim = o.primitive!;
  const g = mode === 3 ? prim.geom() : prim.geomUpTo(REGIONS[mode]);
  if (!g?.positions || !g.polygons) return new Float64Array(0);
  const P = g.positions as Float32Array, n = P.length / 3, N = new Float64Array(n * 3);
  for (const f of g.polygons as number[][]) {   // Newell normal of each polygon, summed on its vertices
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) { const a = f[i] * 3, b = f[(i + 1) % f.length] * 3;
      nx += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]); ny += (P[a + 2] - P[b + 2]) * (P[a] + P[b]); nz += (P[a] - P[b]) * (P[a + 1] + P[b + 1]); }
    for (const v of f) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; }
  }
  for (let v = 0; v < n; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; }
  return N;
}
function toWorld(o: X3DObject, a: Float64Array): number[] {
  const m = o.globalMatrix(), v = new THREE.Vector3(), out: number[] = [];
  for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(m); out.push(v.x, v.y, v.z); }
  return out;
}
function frGetPointArray(app: App, a: Record<string, any>) {
  const C = 'fr_GetPointArray';
  const o = meshArg(app, C, a.inObj, true);
  const mode = intArg(a.inMode, 3); if (mode < 0 || mode > 3) return [];
  return atTime(app, a.inTime, () => { const p = positionsAt(o, mode)!; return boolArg(a.Global, false) ? toWorld(o, p) : Array.from(p); });
}
function frGetNormalArray(app: App, a: Record<string, any>) {
  const C = 'fr_GetNormalArray';
  const o = meshArg(app, C, a.inObj, false);
  const mode = intArg(a.inMode, 3); if (mode < 0 || mode > 3) return [];
  // Global applies the position mapping, translation included (as read)
  return atTime(app, a.inTime, () => { const n = pointNormals(o, mode); return boolArg(a.Global, false) ? toWorld(o, n) : Array.from(n); });
}
/** Neighbour vertices of v in polygon traversal order (each once). */
function neighbours(polys: number[][], v: number): number[] {
  const out: number[] = [];
  for (const f of polys) { const i = f.indexOf(v); if (i < 0) continue;
    for (const w of [f[(i + 1) % f.length], f[(i - 1 + f.length) % f.length]]) if (w !== v && !out.includes(w)) out.push(w); }
  return out;
}
function frNeighborIndex(app: App, a: Record<string, any>) {
  const C = 'fr_NeighborIndex';
  const o = meshArg(app, C, a.inObj, false);
  if (o.type !== 'polymsh') throw fail(DISP_E_MEMBERNOTFOUND, `${C}: ${o.fullName} is not a polygon mesh`);
  const vi = intArg(a.inVertex, 0);
  if (vi === 0) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: inVertex 0 is rejected`);
  const m = o.primitive!.mesh(); const P = m?.positions;
  if (!m || !P || vi < 0 || vi * 3 >= P.length) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no vertex ${vi}`);
  const nb = neighbours(m.polygons, vi);
  if (!nb.length) return -1;   // inferred: no neighbour
  if (intArg(a.inMode, 0) === 0) return nb[0];   // inferred: the first neighbour
  logNya(app, C, 'which neighbour index is returned in a non-zero inMode (the most upward neighbour is returned)');
  let best = nb[0], by = -Infinity;
  for (const w of nb) {
    const d = new THREE.Vector3(P[w * 3] - P[vi * 3], P[w * 3 + 1] - P[vi * 3 + 1], P[w * 3 + 2] - P[vi * 3 + 2]).normalize();
    if (d.y > by) { by = d.y; best = w; }
  }
  return best;
}

// ------------------------------------------------------------------ stack walker
const MARKERS = ['Zero', 'Modeling', 'Shape Modeling', 'Animation', 'Secondary Shape Modeling'];
/** The construction-history walk of fr_GetOperatorsInStack (top first), collecting from marker[end] to marker[start]. */
export function operatorsInStack(o: X3DObject, start: number, end: number): Operator[] {
  if (end === 0 || end === start) { start = 0; end = 4; }
  const items = o.primitive ? o.primitive.explorerChildren() : [];
  const out: Operator[] = [];
  let on = end > 3;
  for (const it of items) {
    if (it.name === MARKERS[start] && it.kind !== 'operator') break;
    const marker = it.kind !== 'operator';
    if (marker) { if (it.name === MARKERS[end]) on = true; continue; }
    if (!on || !it.name) continue;
    out.push(it as Operator);
  }
  return out;
}
function frGetOperatorsInStack(app: App, a: Record<string, any>) {
  const C = 'fr_GetOperatorsInStack';
  const o = meshArg(app, C, a.inObj, false);
  const ops = operatorsInStack(o, intArg(a.inStackStart, 0), intArg(a.inStackEnd, 4));
  if (Array.isArray(a.ioAdditiveArray)) a.ioAdditiveArray.push(...ops);   // in place
  return ops;
}

// ------------------------------------------------------------------ operators, groups, visibility
class GlueMeshGlobalOp extends Operator {
  constructor() { super('fro_GlueMeshGlobalOp', 'fro_GlueMeshGlobalOp', []); }
}
function frGlueMeshGlobal(app: App, a: Record<string, any>) {
  const C = 'fr_GlueMeshGlobal';
  const driven = unset(a.inDrivenMesh) || a.inDrivenMesh === '' ? app.selection[0] ?? null : resolve(app, a.inDrivenMesh);
  const driver = unset(a.inDriverMesh) || a.inDriverMesh === '' ? app.selection[1] ?? null : resolve(app, a.inDriverMesh);
  if (!(driven instanceof X3DObject) || !driven.primitive || !(driver instanceof X3DObject) || !driver.primitive) throw fail(E_INVALIDARG, `${C}: needs a driven and a driver mesh`);
  const op = new GlueMeshGlobalOp();
  const stack = intArg(a.inStack, 0);
  op.region = REGIONS[stack] ?? 'modeling';   // inferred: connected with construction mode inStack
  (op as any).ports = {
    inout: driven.primitive, inputs: { drivenGlobal: driven.kinematics.global, driverPrimitive: driver.primitive, driverGlobal: driver.kinematics.global },
  };
  const prim = driven.primitive;
  app.record('ApplyOp fro_GlueMeshGlobalOp', () => prim.addOperator(op), () => prim.removeOperator(op));
  logNya(app, C, 'the fro_GlueMeshGlobalOp update (operator callbacks are outside this row); the operator is connected, not evaluated');
  return op;
}
function frAddToGroup(app: App, a: Record<string, any>) {
  const g0 = unset(a.inGroup) ? null : resolve(app, a.inGroup) ?? frGroup(app, text(a.inGroup));
  const g = g0 instanceof Group ? g0 : null;
  if (!g) return undefined;   // status always OK
  const objs = nodesArg(app, a.inObjs).filter((n): n is X3DObject => n instanceof X3DObject);
  const branch = boolArg(a.Branch, false);   // inferred: Branch is the AddMembers branch flag
  const bset = b14a(app).branch;
  for (const o of objs) {
    if (!g.members.includes(o)) app.record('AddMembers', () => g.members.push(o), () => { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); });
    if (branch) { let s = bset.get(g); if (!s) bset.set(g, (s = new Set())); s.add(o); }
  }
  if (intArg(a.notInspectable, 0) !== 0 || a.notInspectable === true) {
    for (const o of g.members) if (objs.includes(o) && !notInspectable(o)) app.record('SetCapabilityFlag', () => { (o as any).siNotInspectable = true; }, () => { delete (o as any).siNotInspectable; });
  }
  return undefined;
}
/** inObjs: a reference, an array / ref array or a comma-separated string (unresolved entries stay as null); else the
 *  selection, branch-selected items adding all their descendants. */
function visObjects(app: App, v: any): (Node | null)[] {
  if (!unset(v) && v !== '') return listOf(v).map(x => resolve(app, x) ?? null);
  const out: Node[] = [];
  for (const n of app.selection) { if (!out.includes(n)) out.push(n); if ((n as any).branchSelected && n instanceof X3DObject) for (const d of n.descendants()) if (!out.includes(d)) out.push(d); }
  return out;
}
function frVisible(app: App, a: Record<string, any>) {
  const C = 'fr_Visible';
  const objs = visObjects(app, a.inObjs);
  if (!objs.length) { setStatus(app, C, S_FALSE); return undefined; }
  setStatus(app, C, S_OK);
  const first = objs[0];
  if (!(first instanceof X3DObject)) { app.run('ToggleVisibility', { InputObjs: app.selectedObjects }); return undefined; }
  const value = intArg(a.Value, 0);
  const on: any[] = [], off: any[] = [], groupParams: any[] = [];
  let groupsSeen = false;
  for (const o of objs) {
    if (!(o instanceof X3DObject) || notInspectable(o)) continue;
    const vis = o.properties.find(p => p.type === 'visibility');
    for (const pn of ['viewvis', 'rendvis']) {
      const p = vis?.get(pn) ?? o.get(pn); if (!p) continue;
      const src = (p as any).drivenBy?.inputs?.[0] ?? p;   // a parameter driven by an operator: its input port 0
      (src.value ? on : off).push(src);
    }
    for (const g of app.scene.groupList) if (g.members.includes(o)) {
      groupsSeen = true;
      for (const pn of ['viewvis', 'rendvis']) { const p = g.get(pn); if (p && !groupParams.includes(p)) groupParams.push(p); }
    }
  }
  if (groupsSeen) logNya(app, C, 'the frf_visgroup filter (FaceRobot filter callback unread); owner groups carrying viewvis / rendvis are used');
  const setAll = (ps: any[], v: any) => { for (const p of ps) app.setParam(p, v, 'SetValue'); };
  if (value === 0) { setAll(on, false); setAll(off, true); }
  else if (value > 0) setAll(off, true);
  else setAll(on, false);
  setAll(groupParams, 2);
  return undefined;
}

// ------------------------------------------------------------------ fr_AddObjectInPlace
const SIZE_PARAM: Record<string, string[]> = {
  Cube: ['length'], Square: ['length'], Null: ['size'], Grid: ['ulength', 'vlength'], Spiral: ['endradius'], Disc: ['outerradius'],
  Text: ['fitsize'], Wave: ['vac'], Camera: ['projplanedist'],
};
function vec3(v: any): [number, number, number] {
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { const x = Array.from(v as any, Number); return [x[0] || 0, x[1] || 0, x[2] || 0]; }
  if (v && typeof v === 'object') return [Number(v.x ?? v.X) || 0, Number(v.y ?? v.Y) || 0, Number(v.z ?? v.Z) || 0];
  return [0, 0, 0];   // a Python ISIVector3 repr (the catalogue default) or anything else: (0, 0, 0)
}
function findParamOn(o: X3DObject, name: string) {
  const prim = o.primitive;
  for (const ps of [...(prim?.operators ?? []), prim, o, ...o.properties]) { const p = ps?.get(name); if (p) return p; }
  return undefined;
}
function frAddObjectInPlace(app: App, a: Record<string, any>) {
  const C = 'fr_AddObjectInPlace';
  const preset = text(a.inPreset) || 'Cube', name = text(a.inName), type = intArg(a.inType, 0);
  const parentArg = unset(a.inParent) || a.inParent === '' ? null : objArg(app, a.inParent);
  const parent = parentArg ?? app.scene.root;
  const sel = app.selection.slice();
  let obj: X3DObject;
  if (type === 0) obj = app.run('GetPrim', { PresetObj: preset, Name: name });
  else {
    const geo = type === 1 ? 'MeshSurface' : type === 2 ? 'NurbsSurface' : type === 3 ? 'NurbsCurve' : null;
    if (!geo) throw fail(E_INVALIDARG, `${C}: inType ${type}`);   // inferred: other types are not handled
    obj = app.run('CreatePrim', { PresetObj: preset, GeometryType: geo, Name: name });
  }
  if (!(obj instanceof X3DObject)) throw fail(E_FAIL, `${C}: ${preset} was not created`);
  app.select(sel);   // AddPrimitive / AddGeometry do not select
  if (parent !== app.scene.root && obj.parentObj !== parent) { const old = obj.parentObj!; app.record('Reparent', () => parent.addChild(obj), () => old.addChild(obj)); }
  // local Display Property, wirecol = inColor
  const disp = makeDisplay(false); const oldDisp = obj.properties.filter(p => p.type === 'display');
  app.record('AddProp Display Property', () => { for (const d of oldDisp) obj.removeProperty(d); obj.addProperty(disp); }, () => { obj.removeProperty(disp); for (const d of oldDisp) obj.addProperty(d); });
  app.setParam(disp.get('wirecol')!, intArg(a.inColor, 0));
  // size
  const size = Math.max(0.01, numArg(a.inScale, 1));
  for (const pn of SIZE_PARAM[preset] ?? ['radius']) {
    const p = findParamOn(obj, pn);
    if (p) app.setParam(p, size); else logNya(app, C, `the ${pn} size parameter of preset ${preset} (not present on this build's ${preset})`);
  }
  logNya(app, C, 'the capability flag set true on the new object (constant not recovered)');
  // global translation = inVector, rotation and scale kept
  const [x, y, z] = vec3(a.inVector);
  const local = new THREE.Vector3(x, y, z).applyMatrix4(parent.globalMatrix().invert());
  const L = obj.kinematics.local;
  app.setParam(L.get('posx')!, local.x); app.setParam(L.get('posy')!, local.y); app.setParam(L.get('posz')!, local.z);
  for (const pn of listOf(text(a.inParamTags))) {
    if (findParamOn(obj, pn)) logNya(app, C, `the tag value put on parameter ${pn}`);
    else logNya(app, C, `parameter ${pn} for tags (not found)`);
  }
  return obj;
}

// ------------------------------------------------------------------ fr_RepairNan
class SetCurveDataOperator extends Operator {
  constructor(readonly data: CurveData) { super('NURBS Curve List Data', 'crvop', []); }
  apply() { return this.data; }
}
const bad = (p: number[]) => p.slice(0, 4).some(Number.isNaN);
/** Replace NaN control points (cmd-b14a fr_RepairNan). Returns null when nothing changed. */
export function repairCvs(cvs: [number, number, number, number][]): [number, number, number, number][] | null {
  if (!cvs.some(bad)) return null;
  return cvs.map((p, i) => {
    if (!bad(p)) return [...p] as [number, number, number, number];
    let pi = -1, ni = -1;
    for (let k = i - 1; k >= 0; k--) if (!bad(cvs[k])) { pi = k; break; }
    for (let k = i + 1; k < cvs.length; k++) if (!bad(cvs[k])) { ni = k; break; }
    if (pi < 0 && ni < 0) return [0, 0, 0, 1];
    if (pi < 0) return [...cvs[ni]] as any;
    if (ni < 0) return [...cvs[pi]] as any;
    // the intended distance weights use integer division and come out as 1: the sum (as read)
    return [0, 1, 2, 3].map(j => cvs[pi][j] + cvs[ni][j]) as any;
  });
}
function frRepairNan(app: App, a: Record<string, any>) {
  const C = 'fr_RepairNan';
  let objs = nodesArg(app, a.BrokenCurves);
  if (!objs.length) objs = nodesArg(app, app.selection.map(n => n.fullName).join(','));
  if (!objs.length) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no BrokenCurves and nothing selected`);
  let logged = false;
  for (const o of objs) {
    if (!(o instanceof X3DObject) || o.primitive?.type !== 'crvlist') continue;
    const g = o.primitive.geom() as (CurveData & { subcurves?: CurveData[] }) | null; if (!g?.cvs) continue;
    if (!logged) { logged = true; logNya(app, C, 'the NURBS data format constant passed to Get/Set (control points are taken as x, y, z, w)'); }
    const curves = [g, ...(g.subcurves ?? [])];
    let changed = false;
    const fixed = curves.map(c => { const r = repairCvs(c.cvs); if (r) changed = true; return { ...c, cvs: r ?? c.cvs.map(p => [...p]) } as CurveData; });
    if (!changed) continue;
    const data = fixed.length > 1 ? { ...fixed[0], subcurves: fixed.slice(1) } as CurveData : { ...fixed[0] };
    delete (data as any).subcurves; if (fixed.length > 1) (data as any).subcurves = fixed.slice(1);
    const op = new SetCurveDataOperator(data); const prim = o.primitive;
    app.record('SetNurbsCurveList', () => prim.addOperator(op), () => prim.removeOperator(op));
  }
  return undefined;
}

// ------------------------------------------------------------------ fr_PrepareExport
function frPrepareExport(app: App, a: Record<string, any>) {
  const C = 'fr_PrepareExport';
  const o = objArg(app, a.Object);
  if (!o || !o.primitive) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: invalid Object`);
  const delCluster = (c: Cluster) => { if (o.clusters.includes(c)) app.record('DeleteObj ' + c.name, () => o.removeCluster(c), () => o.addCluster(c)); };
  // (1) clusters carrying siNotInspectable
  for (const c of o.clusters.filter(notInspectable)) delCluster(c);
  // (2) every "Envelope Operator" in the whole stack (walker 0..4)
  const prim = o.primitive;
  for (const op of operatorsInStack(o, 0, 4).filter(op => op.name === 'Envelope Operator')) app.record('DeleteObj ' + op.name, () => prim.removeOperator(op), () => prim.addOperator(op));
  // (3) clusters named *_Region*, *_Tendon*, *_CurveCls*, *_Puffer*
  for (const c of o.clusters.filter(c => /_Region|_Tendon|_CurveCls|_Puffer/.test(c.name))) delCluster(c);
  return undefined;
}

// ------------------------------------------------------------------ registration
type ArgList = [string, any][];
const ARGS = (l: ArgList) => l.map(([name, d]) => ({ name, default: d }));
export function registerFaceRobotB14aCommands(app: App) {
  b14a(app);
  if (!(app as any).hostFs) (app as any).hostFs = hostFs;
  (app as any).faceRobotB14a = { loadLocalization: (force = true) => loadLocalization(app, force), operatorsInStack, repairCvs, buildSampleFace: () => buildSampleFace(app), Cluster, Group, Operator, Property };
  const reg = (name: string, args: ArgList, execute: (app: App, a: Record<string, any>) => any, extra: Partial<CommandDef> = {}) =>
    app.register({ name, label: name, category: CAT, description: '', args: ARGS(args), undoable: true, execute, ...extra });
  reg('fr_sget', [['key1', null], ['key2', null]], frSget);
  reg('fr_sset', [['key1', null], ['key2', null], ['value', null]], frSset);
  reg('fr_sdelete', [['key1', null], ['key2', null]], frSdelete);
  reg('fr_sindices', [['key', null]], frSindices);
  reg('fr_sstring', [['key', null]], frSstring);
  reg('fr_sdump', [['severity', null]], frSdump);
  reg('fr_sfeatures', [], frSfeatures);
  reg('fr_FileDelete', [['filename', null]], frFileDelete);
  reg('fr_FileRead', [['filename', null]], frFileRead);
  reg('fr_FileWrite', [['filename', null], ['txt', null]], frFileWrite);
  reg('fr_GetFilesForBrowser', [['path', null], ['extension', null], ['defaultimage', null]], frGetFilesForBrowser);
  reg('fr_GetCommand', [['cmd', null]], frGetCommand);
  // fr_GetCurrentObjState and fr_IsDesigner share one Init (tooltip "undefined") and one Execute: always true
  reg('fr_GetCurrentObjState', [], () => true, { tooltip: 'undefined' } as any);
  reg('fr_IsDesigner', [], () => true, { tooltip: 'undefined' } as any);
  reg('fr_Callstack_IsDebugMode', [], () => false, { description: 'Check if FaceRobot is running in debug mode' });
  reg('fr_Mute', [['state', null]], frMute);
  reg('fr_MuteSources', [['Objects', null], ['b_Mute', false], ['b_IncludeRetargeting', false], ['b_ResetTransforms', false]], frMuteSources);
  reg('fr_GetFaceModel', [['MakeFaceModel', false]], frGetFaceModel);
  reg('GetFaceCluster', [['Object', null]], getFaceCluster);
  reg('GetFaceWeightMap', [['MapName', null], ['Object', null], ['R', 255], ['G', 255], ['B', 255]], getFaceWeightMap);
  reg('fr_NeighborIndex', [['inObj', null], ['inVertex', null], ['inMode', 0]], frNeighborIndex);
  reg('fr_GetPointArray', [['inObj', null], ['inTime', 1.7976931348623157e+308], ['Global', false], ['inMode', 3]], frGetPointArray);
  reg('fr_GetNormalArray', [['inObj', null], ['inTime', 1.7976931348623157e+308], ['Global', false], ['inMode', 3]], frGetNormalArray);
  reg('fr_GetOperatorsInStack', [['inObj', null], ['inStackStart', 0], ['inStackEnd', 4], ['ioAdditiveArray', '']], frGetOperatorsInStack);
  reg('fr_GlueMeshGlobal', [['inDrivenMesh', null], ['inDriverMesh', null], ['inStack', 0]], frGlueMeshGlobal,
    { description: 'GIVEN two meshes with the same number of points, this glues one to the other.' });
  reg('fr_AddToGroup', [['inGroup', null], ['inObjs', null], ['notInspectable', null], ['Branch', null]], frAddToGroup);
  reg('fr_Visible', [['inObjs', null], ['Value', '0']], frVisible,
    { description: 'Visible Function that toggles (or sets value) visibility including visibility of group owners' });
  // the catalogue default of inVector is a Python ISIVector3 repr: vector (0, 0, 0)
  reg('fr_AddObjectInPlace', [['inPreset', 'Cube'], ['inType', 0], ['inParent', null], ['inScale', 1], ['inVector', [0, 0, 0]], ['inName', 'Cube'],
    ['inColor', 0], ['inParamTags', '']], frAddObjectInPlace, { description: 'Adds Element' });
  reg('fr_RepairNan', [['BrokenCurves', null]], frRepairNan);
  reg('fr_PrepareExport', [['Object', null]], frPrepareExport);
}
