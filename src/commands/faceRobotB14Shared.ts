// Ledger rows CMD-B14a–e (Face Robot plug-in `FR.dll`): the state every FR command shares, as an original stand-in.
// Brief: the "Shared facts" sections of docs/ghidra/cmd-b14a-fr-utilities-storage.md (§2.2 the `fr_s*` key/value
// store), cmd-b14b (§2.1 asset store), cmd-b14c (§2.1 session dictionary), cmd-b14d (§2.2 face-robot lookup, §2.3 stage
// codes), cmd-b14e (§2 registry) and docs/re/WIRE_CORRECTIONS_B14.md. The five notes describe ONE process-wide
// registry (sections -> keys -> values); it lives here so that every FR command reads and writes the same store.
// Original code written from that prose only; no XSIBATCH golden exists.
//
// Mapping onto this build:
//  * `app.faceRobotB14` holds the state (created on first use). `store` is the registry; `prefs` stands in for the
//    user preference category `Face Robot` (parameter `Default_Type`), `mute` is the fr_Mute global byte.
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name).
//  * Values a command puts while its return value is not enabled are kept in `lastPut`.
//  * Message boxes / file dialogs go through `hooks`; without a hook a box answers its default (logged).
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (<row>)".
import { App } from '../core/commands';
import { Node, X3DObject, Property, Null, Model, Group } from '../core/scene';
import { str, bool } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import {
  unset, listOf, hostFs, numArg, intArg, boolArg, arrayArg, resolve, objArg, nodesArg, isFile, isFolder, parentPath,
  readBytes, writeBytes, deleteFile, addObject, meshObject, meshOf, addProperty, propNamed,
} from './pluginsB13eShared';

export {
  unset, listOf, hostFs, numArg, intArg, boolArg, arrayArg, resolve, objArg, nodesArg, isFile, isFolder, parentPath,
  readBytes, writeBytes, deleteFile, addObject, meshObject, meshOf, addProperty, propNamed, Node, X3DObject, Property,
};

export const S_OK = 0, S_FALSE = 1;
export const E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, DISP_E_MEMBERNOTFOUND = 0x80020003, E_ABORT = 0x80004004;
export const FR_CAPTION = 'SOFTIMAGE|Face Robot';

/** Wide-string code-unit order (the store's map order: case-sensitive, by UTF-16 unit). */
export const cuCompare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ------------------------------------------------------------------ the registry / `fr_s*` store
export class FRStore {
  /** Main store: section -> key -> value. */
  readonly main = new Map<string, Map<string, any>>();
  /** Second map of the same shape that fr_sdelete also clears (inferred: a cache). */
  readonly secondary = new Map<string, Map<string, any>>();
  /** "features" table: name -> list of records (two strings each; formatters unread, cmd-b14a fr_sfeatures). */
  readonly features = new Map<string, [string, string][]>();
  /** Localization map (key -> text), loaded from views\FR.en-us.txt when interactive. */
  readonly localization = new Map<string, string>();
  constructor(private readonly app: App) {}

  /** Section / key of a (key1, key2) pair: the last argument empty -> section "_" and key = key1. */
  static where(key1: any, key2: any): [string, string] {
    const k1 = unset(key1) ? '' : String(key1), k2 = unset(key2) ? '' : String(key2);
    return k2 === '' ? ['_', k1] : [k1, k2];
  }
  static ignored(value: any) { return unset(value) || value === '' || value === ' '; }

  /** Raw put (category, key, value): empty value or " " is ignored; a missing section is created. */
  put(section: string, key: string, value: any) {
    if (FRStore.ignored(value)) return false;
    let m = this.main.get(section); if (!m) this.main.set(section, (m = new Map()));
    m.set(key, value);
    if (section === 'mem') this.persistMem();
    return true;
  }
  /** Raw get: missing -> undefined (no evaluation). */
  raw(section: string, key: string): any { return this.main.get(section)?.get(key); }
  /** Get with the object-evaluation rule: a stored reference to a named object comes back as that object. */
  get(section: string, key: string): any {
    const v = this.raw(section, key);
    if (v === undefined) return '';
    if (v instanceof Node) return v.name ? v : v;          // EvaluateAt(current frame) of an object is the object itself here
    return v;
  }
  /** One-key lookup (section "_"). */
  named(key: string): any { return this.get('_', key); }
  delete(section: string, key: string) {
    this.main.get(section)?.delete(key);
    this.secondary.get(section)?.delete(key);
    if (section === 'mem') this.persistMem();
  }
  keys(section: string): string[] { return [...(this.main.get(section)?.keys() ?? [])].sort(cuCompare); }
  sections(): string[] { return [...this.main.keys()].sort(cuCompare); }

  /** `mem` persistence: `<key>--=--<value>**=**` per entry whose key and value start above space. */
  serializeMem(): string {
    let s = '';
    for (const k of this.keys('mem')) {
      const v = this.main.get('mem')!.get(k); const vs = v instanceof Node ? v.fullName : String(v ?? '');
      if (k && vs && k.charCodeAt(0) > 32 && vs.charCodeAt(0) > 32) s += `${k}--=--${vs}**=**`;
    }
    return s;
  }
  persistMem() { const st = frState(this.app); if (st.prefs.hasCategory) st.prefs.Default_Type = this.serializeMem(); }
  /** The reload part of the state rebuild: reads Face Robot.Default_Type back into `mem`. */
  reloadMem(): boolean {
    const st = frState(this.app); const text = st.prefs.Default_Type ?? '';
    if (text.length > 0x800) { this.app.logMsg('info', 'Default_Type exceeds maximum length.  State memory inactive.'); return false; }
    for (const piece of text.split('**=**')) {
      const kv = piece.split('--=--'); if (kv.length !== 2) continue;
      const [k, v] = kv; if (!k || !v || k.charCodeAt(0) <= 32 || v.charCodeAt(0) <= 32) continue;
      let m = this.main.get('mem'); if (!m) this.main.set('mem', (m = new Map())); m.set(k, v);
    }
    return true;
  }
  /** Localization table text: first whitespace token = key, the rest (trimmed) = value; LF-separated. */
  loadLocalization(text: string) {
    this.localization.clear();
    for (const line of text.split('\n')) {
      const m = /^\s*(\S+)\s*(.*?)\s*$/.exec(line); if (!m) continue;
      this.localization.set(m[1], m[2]);
    }
  }
  loc(key: string): string { return this.localization.get(key) ?? ''; }
}

export interface FaceRobotB14State {
  store: FRStore;
  /** fr_Mute global byte (0 = not muted). */
  mute: boolean;
  /** User preference category `Face Robot` stand-in. */
  prefs: { hasCategory: boolean; Default_Type: string };
  /** Value a command put while its return value is not enabled. */
  lastPut: { command: string; value: any } | null;
  /** Message boxes shown (newest last). */
  boxes: { text: string; caption: string; flags: number; answer: number }[];
  /** Progress bar captions shown. */
  progress: string[];
  /** Interactive application flag (batch: false). */
  interactive: boolean;
  hooks: {
    /** Message box answer (siMsgOk 1, Cancel 2, Abort 3, Retry 4, Ignore 5, Yes 6, No 7). */
    msgBox?: (text: string, flags: number, caption: string) => number | undefined;
    fileDialog?: (command: string, title: string, filter: string) => string | null | undefined;
  };
  /** Free slots for the per-row stand-ins (sculpt sessions, C3D data, ...). */
  rows: Record<string, any>;
}

export function frState(app: App): FaceRobotB14State {
  const a: any = app;
  if (a.faceRobotB14) return a.faceRobotB14;
  const st: FaceRobotB14State = {
    store: null as any, mute: false, prefs: { hasCategory: true, Default_Type: '' }, lastPut: null, boxes: [], progress: [],
    interactive: true, hooks: {}, rows: {},
  };
  a.faceRobotB14 = st;
  st.store = new FRStore(app);
  return st;
}
export const frStore = (app: App) => frState(app).store;
export function rowState<T>(app: App, row: string, init: () => T): T { const r = frState(app).rows; return (r[row] ??= init()); }

// ------------------------------------------------------------------ status, log, boxes
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export function failLog(app: App, command: string, status: number, text: string): SiStatusError {
  app.logMsg('error', text);
  return fail(status, `${command}: ${text}`);
}
export function logNya(app: App, command: string, what: string, row: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${row})`); }
export function put(app: App, command: string, value: any) { frState(app).lastPut = { command, value }; }
export function progress(app: App, caption: string) { frState(app).progress.push(caption); app.logMsg('info', caption); }
/** siMsgOkOnly 0, OkCancel 1, AbortRetryIgnore 2, YesNoCancel 3, YesNo 4; siMsgExclamation 0x30. Answer codes: Ok 1, Cancel 2,
 *  Yes 6, No 7. Without a hook the default button answers (Ok, or Cancel for Yes/No/Cancel, No for Yes/No). */
export function msgBox(app: App, text: string, flags = 0, caption = FR_CAPTION): number {
  const st = frState(app);
  const btn = flags & 0xf;
  const dflt = btn === 3 ? 2 : btn === 4 ? 7 : btn === 1 ? 2 : 1;
  const answer = st.hooks.msgBox?.(text, flags, caption) ?? dflt;
  st.boxes.push({ text, caption, flags, answer });
  app.logMsg('info', `${caption}: ${text}`);
  return answer;
}
/** The FR message-box helper (cmd-b14d §2.2): log the text, then an exclamation box. */
export function frWarn(app: App, text: string) { app.logMsg('info', text); return msgBox(app, text, 0x30, FR_CAPTION); }

// ------------------------------------------------------------------ face-robot lookups (cmd-b14d §2.2 / §2.3)
export function allObjects(app: App): X3DObject[] { return [...app.scene.allObjects()]; }
export function findByName(app: App, name: string): X3DObject | null {
  if (!name) return null;
  for (const o of app.scene.allObjects()) if (o.name === name || o.fullName === name) return o;
  return null;
}
export function childNamed(o: X3DObject, name: string): X3DObject | null {
  for (const c of o.descendants()) if (c.name === name) return c;
  return null;
}
/** `ActiveFaceRobot` custom property on the scene root. */
export const activeFaceRobotProp = (app: App) => propNamed(app.scene.root, 'ActiveFaceRobot') ?? null;
/** The face model: registry `_`/`FaceModel` when it is an object, else the model named by ActiveFaceRobot.FaceModel. */
export function faceModel(app: App): X3DObject | null {
  const v = frStore(app).raw('_', 'FaceModel');
  if (v instanceof X3DObject && isInScene(app, v)) return v;
  const p = activeFaceRobotProp(app); const n = p ? String(p.val('FaceModel') ?? '') : '';
  return n ? findByName(app, n) : null;
}
export function isInScene(app: App, o: Node): boolean { for (const x of app.scene.allObjects()) if (x === o) return true; return false; }
export const faceConnections = (model: X3DObject | null) => (model ? propNamed(model, 'FaceConnections') ?? null : null);
/** The face mesh: registry `meshes`/`Mesh`, else FaceConnections.Mesh of the face model. */
export function faceMesh(app: App): X3DObject | null {
  const v = frStore(app).raw('meshes', 'Mesh');
  if (v instanceof X3DObject && isInScene(app, v)) return v;
  if (typeof v === 'string' && v) { const o = findByName(app, v); if (o) return o; }
  const fc = faceConnections(faceModel(app)); const n = fc ? String(fc.val('Mesh') ?? '') : '';
  return n ? findByName(app, n) : null;
}
/** Registry entry resolved to an object (value may be an object or a name). */
export function entryObject(app: App, section: string, key: string): X3DObject | null {
  const v = frStore(app).raw(section, key);
  if (v instanceof X3DObject) return isInScene(app, v) ? v : null;
  if (typeof v === 'string' && v) return findByName(app, v);
  return null;
}

/** Stage code (cmd-b14d §2.3): 0, 10, 15, 30, 40, 50, 60; first match wins. */
export function stageCode(app: App): number {
  const p = activeFaceRobotProp(app); if (!p) return 0;
  const name = String(p.val('FaceModel') ?? ''); if (!name) return 0;
  const model = findByName(app, name); if (!model) return 0;
  const fc = faceConnections(model); if (!fc) return 0;
  const meshName = String(fc.val('Mesh') ?? ''); const mesh = meshName ? findByName(app, meshName) : null;
  if (mesh && propNamed(mesh, 'SculptLinkReader')) return 60;
  if (mesh && mesh.primitive?.operators.some(op => /facialsofttissue/i.test(op.name) || /facialsofttissue/i.test(op.type))) return 50;
  const head = childNamed(model, 'HeadNull');
  if (head && head.parentObj?.name === 'Head_Control') return 50;
  if (head) return 40;
  const pick = childNamed(model, 'PickPoints');
  if (pick && pick.children.length > 0) return 30;
  const required = fc.params.filter(q => !/optional/i.test(q.def.desc ?? ''));
  const allThere = required.every(q => { const v = String(q.value ?? ''); return !!v && !!findByName(app, v); });
  if (allThere && propNamed(model, 'FaceState')) return 15;
  return 10;
}

// ------------------------------------------------------------------ groups
export function groupNamed(app: App, name: string): Group | null { return app.scene.groupList.find(g => g.name === name) ?? null; }
/** Group lookup (cmd-b14e §2): registry `groups` (or `privategroups` for names starting `__`), then the scene's groups. */
export function frGroup(app: App, name: string): Group | null {
  const sec = name.startsWith('__') ? 'privategroups' : 'groups';
  const v = frStore(app).raw(sec, name);
  if (v instanceof Group) return v;
  return groupNamed(app, name);
}
export function ensureGroup(app: App, name: string): Group {
  let g = groupNamed(app, name);
  if (!g) { const ng = new Group(name); ng.parent = app.scene as any; app.record('AddGroup ' + name, () => app.scene.groupList.push(ng), () => { const i = app.scene.groupList.indexOf(ng); if (i >= 0) app.scene.groupList.splice(i, 1); }); g = ng; }
  return g;
}
export function addToGroup(app: App, g: Group, o: X3DObject) {
  if (g.members.includes(o)) return;
  app.record('AddToGroup', () => g.members.push(o), () => { const i = g.members.indexOf(o); if (i >= 0) g.members.splice(i, 1); });
}

// ------------------------------------------------------------------ sample Face Robot scene (for the check scripts)
/** Build a small original face-robot setup: model `Face` with `FaceConnections` (Mesh = `FaceMesh`), `FaceState`,
 *  scene-root `ActiveFaceRobot` (FaceModel = `Face`), registry `_`/`FaceModel` and `meshes`/`Mesh`. Stage code 15. */
export function buildSampleFace(app: App): { model: X3DObject; mesh: X3DObject } {
  const st = frStore(app);
  let model = findByName(app, 'Face');
  if (!model) {
    model = new Model('Face'); addObject(app, model);
    const verts: number[][] = []; const faces: number[][] = []; const N = 4;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) verts.push([i - N / 2, j - N / 2, 0.5 * Math.cos((i - N / 2) / 2)]);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; faces.push([a, a + 1, a + N + 2, a + N + 1]); }
    const mesh = meshObject(app, 'FaceMesh', verts, faces); addObject(app, mesh, model);
    addProperty(app, model, new Property('FaceConnections', 'customparamset', [
      str('Mesh', mesh.name, 'Mesh', { desc: 'face mesh' }),
      str('Tongue', '', 'Tongue', { desc: 'optional tongue mesh' }),
      str('UpperTeeth', '', 'Upper Teeth', { desc: 'optional' }),
      str('LowerTeeth', '', 'Lower Teeth', { desc: 'optional' }),
    ]));
    addProperty(app, model, new Property('FaceState', 'customparamset', [bool('Initialized', true, 'Initialized')]));
  }
  if (!activeFaceRobotProp(app)) addProperty(app, app.scene.root, new Property('ActiveFaceRobot', 'customparamset', [str('FaceModel', model.name, 'Face Model')]));
  const mesh = findByName(app, 'FaceMesh')!;
  st.put('_', 'FaceModel', model); st.put('meshes', 'Mesh', mesh);
  return { model, mesh };
}
export function newNull(app: App, name: string, parent?: X3DObject | null): X3DObject {
  const n = new Null(app.scene.uniqueName(name)); addObject(app, n, parent ?? null); return n;
}
