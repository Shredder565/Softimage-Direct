// Ledger row CMD-B5f. Brief: docs/ghidra/cmd-b5f-misc-dsscripts.md, "Wire contract". Original code written from that contract only.
//
// 18 commands Softimage ships as VBScript procedures: the pick-position tools (DuplicateTool, DrawPrimitiveTool,
// DrawImplicitPrimitiveTool, DrawNullTool), UnhideAllPolygons, UnhideAllPolygonClusters, AppendBone, SymEnvWeight,
// SelectUVRow, SetKeyableAttributes, RetargetRigToRig, RetargetTagRig, TogglePinObjectInPosition, CreateShotCamera,
// CreateShotCameraAndSwitch, GetPrimCameraWithoutInterest, CreateUserDataMap, SIInspectUserData.
//
// How this build differs from a Softimage session, and why:
//
//  * Picking. The command bus is synchronous, so the interactive commands cannot block in a pick call. They start a
//    pick session (src/commands/miscDsScriptsPick.ts): a viewport tool that feeds every click to the command's loop.
//    The command returns at once; each pick then runs its steps as ordinary logged / undoable commands. With
//    `app.Interactive === false` a pick counts as cancelled and a "not yet attested" line is logged (Q4).
//  * Dialogs. Modal pages return a Promise (same convention as the SDK helper commands).
//  * Delegated commands that are not on the bus (C++ commands outside this row). Each is called when another row
//    has registered it; otherwise a documented, inferred stand-in runs or the step logs "not yet attested".
//  * Log severities. Warnings are logged as info with the prefix "WARNING : " (the log knows info / error).
//  * The registry has three DrawPrimitiveTool entries and two SymEnvWeight entries under one scripting name. One
//    command per name is registered (the scripted entry, generic defaults). The key-assignable SymEnvWeight UI entry
//    is `app.miscDsScripts.symEnvWeightUI(args)`.
import * as THREE from 'three';
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property, Cluster, Model, Null, Camera, Constraint } from '../core/scene';
import { num, bool, int, type Parameter, type ParamSet } from '../core/params';
import { ChainRoot, Bone, Effector, CAMERA_PRESETS } from '../core/scene2';
import { envelopeOf } from '../core/envelope';
import { buildPointMap } from '../core/symmetry';
import { surfOf } from '../core/nurbs';
import { threeOrder } from '../core/scene';
import { siString } from '../ui/si';
import { sdkModal, renderSdkLayout } from '../ui/sdkHelpersModal';
import { addConstraint } from './constraints';
import { objs, paramsOf, setLocalMatrix, siConst, unset, boolArg } from './viewEditPropertyHelpers';
import { startPickSession, interactive, type PickSession } from './miscDsScriptsPick';
import desktopPrefs from '../data/si/render_desktop_prefs.json';

const NOTE = 'docs/ghidra/cmd-b5f-misc-dsscripts.md';
type V3 = [number, number, number];

// ------------------------------------------------------------------ translated texts (dictionary XSISCRIPTS)
// The committed strings table lacks some of these ids, so the attested English text from the note is the fallback.
const XSISCRIPTS_TEXT: Record<number, string> = {
  1071: 'A symmetry mapping template was not found. Do you want to create one?',
  1072: 'Symmetry Mapping Template Not Found',
  1073: 'Create Symmmetry Mapping Template',
  1130: 'Select U Row (supports Shift/Ctrl)',
  1131: 'Select V Row (supports Shift/Ctrl)',
  1154: 'Pick Copy Position',
  1155: 'Pick Draw Position',
  1163: 'User Data Values for Selected Components',
  1530: 'You cannot create a new camera from the current active view.',
  1531: 'Created camera has a different aspect/pixel ratio from the scene render options',
};
export const miscDsText = (id: number): string => siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? '';

// ------------------------------------------------------------------ session state
export interface MiscDsScriptsState {
  /** Name of the internal cluster the interactive Hide Polygons command maintains (open question Q1). */
  invisiblePolygonsClusterName: string;
  /** The running pick session of one of this row's interactive commands, if any. */
  session: PickSession | null;
  /** The operator call RetargetRigToRig built last (its application is open question Q5). */
  lastRetarget: { preset: string; connectionSet: string; applied: boolean } | null;
  /** Steps 3 / 4 of SelectUVRow as a function (pick text, button) -> row strings. */
  uvRowStrings(text: string, button: number): string[];
  /** The key-assignable UI entry of SymEnvWeight. */
  symEnvWeightUI(args?: Record<string, any>): Promise<void>;
}
// inferred (Q1): the constant's value as given by the public SDK type library documentation; override here once attested.
const INVISIBLE_POLYGONS_CLUSTER = 'InvisiblePolygons';

const stateOf = (app: App): MiscDsScriptsState => (app as any).miscDsScripts;

// ------------------------------------------------------------------ small helpers
/** Commands of other rows that this row delegates to and that may not be on the bus yet (names kept out of quoted literals). */
const [SI_APPEND_BONE, SI_SYM_ENV_WEIGHT, TAGGING_TOOL, SET_VIEW_CAMERA] = 'SIAppendBone SISymEnvWeight TaggingTool SetViewCamera'.split(' ');

/** Run a delegated command of another row. `done` is false when it is not on the bus, or when the bus only has the
 *  Animate-surface placeholder for it (a stub that returns { command, args } and has no behaviour). */
function delegate(app: App, name: string, args: Record<string, any>): { done: boolean; result?: any } {
  if (!app.commands.has(name)) return { done: false };
  const result = app.run(name, args);
  if (result && typeof result === 'object' && (result as any).command === name && 'args' in result) return { done: false };
  return { done: true, result };
}
const logNya = (app: App, command: string, what: string, question = '') => app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
const logWarning = (app: App, text: string) => app.logMsg('info', `WARNING : ${text}`);
class Cancelled extends Error {
  readonly siErrCancelled = true;
  constructor(command: string) { super(`${command} cancelled (siErrCancelled)`); this.name = 'siErrCancelled'; }
}
const ownerObject = (n: any): X3DObject | null => { let x = n; while (x && !(x instanceof X3DObject)) x = x.parent ?? null; return x ?? null; };
const worldPos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());
const parentGlobal = (o: X3DObject) => o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
const setIf = (app: App, set: ParamSet | null | undefined, name: string, v: any) => { const p = set?.get(name); if (p && v !== undefined && v !== null) app.setParam(p, v); };
function keepSelection<T>(app: App, f: () => T): T {
  const sel = [...app.selection]; const comp = app.compSel; const mode = app.selMode;
  try { return f(); } finally { app.selection = sel; app.compSel = comp; app.selMode = mode; app.events.emit('selection'); }
}
function addNode(app: App, o: X3DObject, parent: X3DObject) { app.record('Add ' + o.name, () => parent.addChild(o), () => parent.removeChild(o)); }
/** Three SetValue calls on the kine posX / posY / posZ shorthand of an object. */
function setPosition(app: App, o: X3DObject, p: V3) {
  ['x', 'y', 'z'].forEach((ax, i) => {
    if (app.scene.find(o.name) === o) app.run('SetValue', { Target: `${o.name}.kine.local.pos${ax}`, Value: p[i] });
    else app.setParam(o.kinematics.local.get('pos' + ax)!, p[i]);
  });
}
const firstObject = (r: any): X3DObject | null => { const x = Array.isArray(r) ? r[0] : r; return x instanceof X3DObject ? x : null; };

/** The pick-position loop shared by DuplicateTool and the draw tools. */
function positionLoop(app: App, command: string, promptId: number, act: (p: V3) => void) {
  startPickSession(app, {
    command, kind: 'position', prompt: miscDsText(promptId),
    fromClick: (p) => p,
    onPick: (p: V3) => { try { act(p); } catch { /* the failing command has logged its error; the loop asks again */ } return true; },
  });
}

// ------------------------------------------------------------------ clusters / user data
function findCluster(app: App, x: any): Cluster | null {
  if (x instanceof Cluster) return x;
  if (typeof x !== 'string' || !x) return null;
  for (const o of app.scene.allObjects()) for (const c of o.clusters) {
    if (c.fullName === x || x === `${o.name}.${c.name}` || x === `${o.name}.cls.${c.name}` || (x.startsWith(o.name + '.') && x.endsWith('.cls.' + c.name))) return c;
  }
  return null;
}
const isUserDataMap = (n: any): n is Property => n instanceof Property && n.type === 'userdatamap';
const isCustomProperty = (n: any): n is Property => n instanceof Property && /custom/i.test(n.type);
function findProperty(app: App, x: any): Property | null {
  if (x instanceof Property) return x;
  if (typeof x !== 'string' || !x) return null;
  const hit = (p: Property) => p.fullName === x || p.name === x || x.endsWith('.' + p.name);
  for (const o of [app.scene.root, ...app.scene.allObjects()]) for (const p of o.allProperties()) if (hit(p)) return p;
  return null;
}
/** inferred: the binary data of a custom property, modelled as the JSON text of its parameter values (layout not specified by the note). */
const binaryDataOf = (p: Property): string => JSON.stringify(Object.fromEntries(p.params.map(q => [q.name, q.value])));
function loadBinaryData(p: Property, blob: string): boolean {
  let data: any; try { data = JSON.parse(blob); } catch { return false; }
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data); if (keys.length !== p.params.length || !p.params.every(q => q.name in data)) return false;
  for (const q of p.params) q.value = data[q.name];
  return true;
}
const userDataItems = (map: Property): Map<number, string> => ((map as any).userData ??= new Map<number, string>());

// ------------------------------------------------------------------ chains
const chainRootOf = (o: X3DObject | null): ChainRoot | null => { let n = o; while (n && !(n instanceof ChainRoot)) n = n.parentObj; return n as ChainRoot | null; };
const isChainElement = (o: X3DObject) => o instanceof ChainRoot || o instanceof Bone || o instanceof Effector;

/** inferred stand-in for the C++ bone-append command: one new bone from the chain end to the new effector position. */
export function appendBoneStandIn(app: App, eff: Effector, target: THREE.Vector3): X3DObject[] {
  const root = chainRootOf(eff); const last = root?.bones[root.bones.length - 1]; if (!root || !last) return [];
  const start = root.chainEnd(); const len = start.distanceTo(target); if (len < 1e-9) return [];
  const bone = new Bone(app.scene.uniqueName('bone'), len);
  const dir = target.clone().sub(start).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  const pq = new THREE.Quaternion().setFromRotationMatrix(last.globalMatrix()); const l = bone.kinematics.local;
  const e = new THREE.Euler().setFromQuaternion(pq.invert().multiply(q), threeOrder(l.val('rotorder'))); const r = 180 / Math.PI;
  l.set('posx', Number(last.val('length'))); l.set('rotx', e.x * r); l.set('roty', e.y * r); l.set('rotz', e.z * r);
  const el = eff.kinematics.local; const oldParent = eff.parentObj!; const old = ['posx', 'posy', 'posz'].map(n => Number(el.val(n)));
  app.record('Append bone', () => {
    last.addChild(bone); root.bones.push(bone); bone.addChild(eff); el.set('posx', len); el.set('posy', 0); el.set('posz', 0);
  }, () => {
    root.bones.pop(); oldParent.addChild(eff); last.removeChild(bone); ['posx', 'posy', 'posz'].forEach((n, i) => el.set(n, old[i]));
  });
  return [bone];
}

// ------------------------------------------------------------------ envelope weight symmetry
const TEMPLATE_TYPE = 'symmetrytemplate';   // the mapping-template property the template command of this build creates
const PLANES = ['YZ', 'XZ', 'XY'] as const;
interface SubItem { raw: any; obj: X3DObject | null; points: number[] | null }
function subItems(app: App, arg: any): SubItem[] {
  const out: SubItem[] = [];
  const push = (raw: any) => {
    if (raw instanceof Cluster) { out.push({ raw, obj: raw.obj, points: raw.compKind === 'pnt' ? [...raw.elements].map(Number) : null }); return; }
    if (raw instanceof X3DObject) { out.push({ raw, obj: raw, points: null }); return; }
    if (raw instanceof Node) { out.push({ raw, obj: ownerObject(raw), points: null }); return; }
    const s = String(raw); const m = /^(.+?)\.pnt\[(.*)\]$/.exec(s);
    if (m) {
      const obj = app.scene.find(m[1]) ?? null; const n = (obj?.primitive?.mesh()?.positions.length ?? 0) / 3; const pts = new Set<number>();
      for (const part of m[2].split(',').map(t => t.trim()).filter(Boolean)) {
        const rg = /^(\d+)\s*-\s*(\d+)$/.exec(part);
        if (part === '*') for (let i = 0; i < n; i++) pts.add(i); else if (rg) for (let i = Number(rg[1]); i <= Number(rg[2]); i++) pts.add(i); else if (/^\d+$/.test(part)) pts.add(Number(part));
      }
      out.push({ raw: s, obj, points: [...pts] }); return;
    }
    const cl = findCluster(app, s); if (cl) { push(cl); return; }
    const o = app.scene.find(s); out.push({ raw: s, obj: o ?? null, points: null });
  };
  if (unset(arg)) {
    const c = app.compSel;
    if (c && c.kind === 'point' && c.points.size) out.push({ raw: `${c.obj.name}.pnt[${[...c.points].sort((a, b) => a - b).join(',')}]`, obj: c.obj, points: [...c.points] });
    else for (const n of app.selection) push(n);
  } else if (Array.isArray(arg)) arg.forEach(push);
  else if (typeof arg === 'string') { let depth = 0, cur = ''; for (const ch of arg + ',') { if (ch === '[') depth++; else if (ch === ']') depth--; if (ch === ',' && depth === 0) { if (cur.trim()) push(cur.trim()); cur = ''; } else cur += ch; } }
  else push(arg);
  return out;
}
/** The "deformer model" of an item: object, first envelope, first deformer, that deformer's model; the scene root otherwise. */
function deformerModel(app: App, it: SubItem): { model: Model; anchor: X3DObject | null } {
  const d = it.obj ? envelopeOf(it.obj)?.deformers[0] : undefined;
  return { model: d?.model ?? app.scene.root, anchor: d ?? null };
}
const templateOf = (m: Model) => m.properties.find(p => p.type === TEMPLATE_TYPE) ?? null;
function createTemplate(app: App, it: SubItem, anchor: X3DObject | null, fill: boolean, axis: number, createMap: boolean): Property | null {
  // The template command of this build reads the model from the selection, so the deformer (or the object) is
  // selected for the call and the selection is put back afterwards.   // inferred
  return keepSelection(app, () => {
    const pick = anchor ?? it.obj; if (pick) app.select([pick]);
    const r = app.run('CreateSymmetryMappingTemplate', { InputObj: it.raw, FillTemplate: fill, 'Symmetry Plane': axis, CreateSymmetryMap: createMap });
    return r instanceof Property ? r : null;
  });
}
/** inferred stand-in for the C++ weight-mirroring command (Q2): each listed point takes the weights of its mirror point, deformers swapped by the template pairs. */
function mirrorWeightsStandIn(app: App, it: SubItem, template: Property | null, axis: number) {
  const o = it.obj; const env = o ? envelopeOf(o) : null; const mesh = o?.primitive?.mesh();
  if (!o || !env || !mesh) { logNya(app, 'SymEnvWeight', `${String((it.raw as any)?.fullName ?? it.raw)} has no envelope; nothing mirrored`, 'Q2'); return; }
  const plane = PLANES[Number(template?.val('plane') ?? axis)] ?? PLANES[axis] ?? 'YZ';
  const map = buildPointMap(mesh.positions as any, plane as any, 1e-3);
  const partner = env.deformers.map((_, i) => i); const pairs: [string, string][] = (template as any)?.pairs ?? [];
  for (const [a, b] of pairs) { const i = env.deformers.findIndex(d => d.name === a), j = env.deformers.findIndex(d => d.name === b); if (i >= 0 && j >= 0) { partner[i] = j; partner[j] = i; } }
  const pts = it.points ?? env.weights.map((_, i) => i); const before = new Map<number, Float32Array>(), after = new Map<number, Float32Array>();
  for (const i of pts) {
    const j = map.get(i); const src = j === undefined ? undefined : env.weights[j]; if (!src || !env.weights[i]) continue;
    const w = new Float32Array(src.length); for (let d = 0; d < src.length; d++) w[partner[d] ?? d] = src[d];
    before.set(i, env.weights[i]); after.set(i, w);
  }
  const prim = o.primitive!;
  app.record('Symmetrize envelope weights', () => { for (const [i, w] of after) env.weights[i] = w; prim.dirty = true; }, () => { for (const [i, w] of before) env.weights[i] = w; prim.dirty = true; });
  logNya(app, 'SymEnvWeight', `weight mirroring is the C++ command's; ${after.size} point(s) mirrored by position across ${plane} with the template's deformer pairs`, 'Q2');
}
function symEnvWeightApply(app: App, a: Record<string, any>, items: SubItem[]) {
  for (const it of items) {
    if (delegate(app, SI_SYM_ENV_WEIGHT, { PropObj: a.PropObj, SubComp: it.raw, MappingTemplate: a.MappingTemplate }).done) continue;
    const tpl = unset(a.MappingTemplate) ? templateOf(deformerModel(app, it).model) : findProperty(app, a.MappingTemplate);
    mirrorWeightsStandIn(app, it, tpl, Number(a.SymmetryAxis) || 0);
  }
}
async function yesNo(text: string, title: string): Promise<boolean> {
  return sdkModal(title, (body) => {
    const msg = document.createElement('div'); msg.textContent = text; msg.style.cssText = 'white-space:pre-wrap;padding:6px'; body.appendChild(msg);
    setTimeout(() => {   // the modal chrome has OK / Cancel; this box is Yes / No with Yes as default
      const w = body.parentElement; const ok = w?.querySelector('.sdkh-modal-ok'); const no = w?.querySelector('.sdkh-modal-cancel');
      if (ok) ok.textContent = 'Yes'; if (no) no.textContent = 'No';
    });
  }, { w: 380, cls: 'miscds-yesno' });
}
/** Interactive template creation of the SymEnvWeight UI entry. */
async function interactiveTemplate(app: App) {
  if (app.selection.length !== 1) { app.logMsg('error', 'Please Select an item first'); return; }
  const item = app.selection[0];
  // inferred: the dialog property's defaults (the note names the parameters only)
  const prop = new Property('CreateSymmetryMappingTemplate', 'customparamset', [int('Axis', 0, 'Axis', { min: 0, max: 2 }), bool('FillTemplate', true, 'FillTemplate'), bool('CreateSymmetryMap', true, 'CreateSymmetryMap')]);
  app.scene.root.addProperty(prop);
  let ok = false;
  try { ok = await sdkModal(miscDsText(1073), (body) => renderSdkLayout(body, prop, [{ param: 'Axis' }, { param: 'FillTemplate' }, { param: 'CreateSymmetryMap' }]), { cls: 'miscds-symtemplate' }); }
  finally { app.scene.root.removeProperty(prop); app.events.emit('scene'); }
  if (!ok) return;
  const t = app.run('CreateSymmetryMappingTemplate', { InputObj: item, FillTemplate: !!prop.val('FillTemplate'), 'Symmetry Plane': Number(prop.val('Axis')) || 0, CreateSymmetryMap: !!prop.val('CreateSymmetryMap') });
  if (t instanceof Node) app.events.emit('inspect', t);   // "auto-inspects the new template locked": this editor has no lock mode
}

// ------------------------------------------------------------------ UV rows
/** Step 3 / 4 of SelectUVRow: the row string of every parenthesised point tuple in a pick text. button 1 = left, 2 = middle. */
export function uvRowStrings(text: string, button: number): string[] {
  const out: string[] = [];
  const re = /([^,\[\]]+?)\.pnt\[([^\]]*)\]/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tuples = m[2].match(/\(([^)]*)\)/g) ?? [];
    for (const t of tuples) {
      const parts = t.slice(1, -1).split(',').map(s => s.trim()); if (parts.length < 2) continue;
      if (button === 2) parts[parts.length - 2] = '*'; else parts[parts.length - 1] = '*';
      out.push(`${m[1].trim()}.pnt[(${parts.join(',')})]`);
    }
  }
  return out;
}
/** Point indices of a row string on a surface of this build (control points stored row by row: index = v * nu + u). */
function uvRowPoints(app: App, row: string): { obj: X3DObject; points: number[] } | null {
  const m = /^(.+?)\.pnt\[\(([^)]*)\)\]$/.exec(row); if (!m) return null;
  const obj = app.scene.find(m[1]); const mesh = obj?.primitive?.mesh() as any; const s = mesh ? surfOf(mesh) : null;
  const parts = m[2].split(','); if (!obj || !s || parts.length !== 2 || mesh.positions.length / 3 !== s.nu * s.nv) return null;
  const pts: number[] = [];
  if (parts[1] === '*') { const u = Number(parts[0]); if (!(u >= 0 && u < s.nu)) return null; for (let v = 0; v < s.nv; v++) pts.push(v * s.nu + u); }
  else { const v = Number(parts[1]); if (!(v >= 0 && v < s.nv)) return null; for (let u = 0; u < s.nu; u++) pts.push(v * s.nu + u); }
  return { obj, points: pts };
}

// ------------------------------------------------------------------ retargeting
const TAG = 'RetargetingTag';
const hasTag = (o: X3DObject) => o.properties.some(p => p.name === TAG);
const tagged = (m: Model): X3DObject[] => [m as X3DObject, ...m.descendants()].filter(hasTag);
const modelOf = (n: any): Model | null => n instanceof Model ? n : ownerObject(n)?.model ?? null;
const resetFilter = (app: App) => app.run('SetSelFilter', { SelFilter: 'object' });
function modelsOf(app: App, arg: any): Node[] { return unset(arg) ? [...app.selection] : Array.isArray(arg) ? arg.map(x => x instanceof Node ? x : app.scene.find(String(x)) ?? (String(x) === app.scene.root.name ? app.scene.root : null)).filter((n): n is Node => !!n) : objs(app, arg).concat(String(arg) === app.scene.root.name ? [app.scene.root] : []); }
/** One model pick: resolves with the model picked, or null on cancel. Left adds the pick to the selection, middle removes it. */
function pickModel(app: App, command: string, prompt: string, middlePrompt: string, done: (m: Model | null) => void) {
  let got: Model | null = null;
  const s = startPickSession(app, {
    command, kind: 'element', filter: 'Model', prompt, middlePrompt, followSelection: true,
    fromClick: () => null,   // the viewport tool reports positions only; models are picked in the explorer or through session.pick
    onPick: (v: any, button: number) => {
      const m = modelOf(typeof v === 'string' ? app.scene.find(v) ?? (v === app.scene.root.name ? app.scene.root : null) : v);
      if (!m) return true;   // not a model: the session keeps asking
      if (button === 2) { app.selection = app.selection.filter(n => n !== m); app.events.emit('selection'); }
      else { got = m; if (!app.selection.includes(m)) app.select([...app.selection, m]); }
      return false;
    },
    onEnd: () => done(got),
  });
  if (!s) done(null);
}

// ------------------------------------------------------------------ shot cameras
interface CamSource { name: string; builtin: boolean; matrix: THREE.Matrix4; obj: X3DObject | null; prim(name: string): any }
const BUILTIN_CAMERA = /^Views\.View([A-D])\.(Top|Front|Right|User|Spot)Camera$/i;
const vmOf = (): any => (globalThis as any).__vm;
const isCamera = (o: any): o is X3DObject => o instanceof X3DObject && (o instanceof Camera || o.type === 'camera');
function cameraSource(app: App, name: any): CamSource | null {
  const o = name instanceof X3DObject ? name : app.scene.find(String(name ?? ''));
  if (isCamera(o)) return { name: o.fullName, builtin: false, matrix: o.globalMatrix(), obj: o, prim: (n) => o.primitive?.get(n)?.value };
  const m = BUILTIN_CAMERA.exec(String(name ?? '')); if (!m) return null;
  // inferred: view letters A..D are the four viewports of the view manager in order; each has one camera of its own.
  const vp = vmOf()?.viewports?.()[m[1].toUpperCase().charCodeAt(0) - 65]; const cam = vp?.camera as any; if (!cam) return null;
  cam.updateMatrixWorld?.();
  const persp = vp.kind === 'persp'; const fresh = new Camera('probe').primitive!;
  let dist = cam.position.length();
  if (persp) { const t = vmOf()?.viewportPolish?.().cameraInterest; if (t) dist = cam.position.distanceTo(new THREE.Vector3(t[0], t[1], t[2])); }
  const perspValue = fresh.val('proj');   // a new camera is a perspective camera
  const vals: Record<string, any> = {
    fov: persp ? cam.fov : undefined, interestdist: dist, near: persp ? cam.near : undefined, far: persp ? cam.far : undefined,
    proj: persp ? perspValue : (Number(perspValue) === 1 ? 0 : 1), orthoheight: persp ? undefined : (cam._zoom ?? 20) * 2,
  };
  return { name: String(name), builtin: true, matrix: (cam.matrixWorld as THREE.Matrix4).clone(), obj: null, prim: (n) => vals[n] };
}
function matchGlobal(app: App, o: X3DObject, g: THREE.Matrix4) { setLocalMatrix(app, o, parentGlobal(o).invert().multiply(g)); }
/** A camera object on its own (the bus GetPrim builds the root / camera / interest rig for the Camera preset).   // inferred */
function newCamera(app: App, name: string, parent: X3DObject): Camera {
  const cam = new Camera(app.scene.uniqueName(name || 'Camera')); addNode(app, cam, parent); app.select([cam]); return cam;
}
const COPIED_TYPES = new Set(['string', 'bool', 'double', 'int']);
function createShotCamera(app: App, command: string, sourceName: any, destName: any, withoutInterest: boolean): Camera {
  const src = cameraSource(app, sourceName);
  // inferred: the script fails at its first transform match when the source is not a camera; the text is this build's
  if (!src) throw new Error(`${command}: source camera "${String(sourceName?.fullName ?? sourceName ?? '')}" not found`);
  const dest = String(destName ?? ''); const root = app.scene.root;
  const srcPos = new THREE.Vector3().setFromMatrixPosition(src.matrix);
  let rootNull: Null | null = null;
  if (!withoutInterest) {
    rootNull = new Null(app.scene.uniqueName(`${dest}_Root`)); addNode(app, rootNull, root);
    setIf(app, rootNull.kinematics.local, 'posx', srcPos.x); setIf(app, rootNull.kinematics.local, 'posy', srcPos.y); setIf(app, rootNull.kinematics.local, 'posz', srcPos.z);
  }
  const cam = newCamera(app, dest, rootNull ?? root);
  matchGlobal(app, cam, src.matrix);
  const dist = Number(src.prim('interestdist'));
  if (rootNull) {
    const want = `${cam.name}_Root`; const rn = rootNull;
    if (rn.name !== want) { const old = rn.name; const nn = app.scene.uniqueName(want); app.record('Rename', () => { rn.name = nn; }, () => { rn.name = old; }); }
    const interest = new Null(app.scene.uniqueName(`${cam.name}_Interest`)); addNode(app, interest, rn);
    const at = src.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -(Number.isFinite(dist) ? dist : 0)));
    matchGlobal(app, interest, at);
    const cns = addConstraint(app, cam, 'Direction', [interest], true);
    if (cns.get('dirz')) app.setParam(cns.get('dirz')!, -1); else cns.add(num('dirz', -1, 'Direction Z'));
    setIf(app, cns, 'upvct_active', true);
  }
  setIf(app, cam.kinematics.local, 'rotorder', 4);
  matchGlobal(app, cam, src.matrix);   // inferred: changing the rotation order keeps the pose (angles are re-expressed)
  const prim = cam.primitive!;
  let std: any, aspect: any, pixelratio: any;
  if (!src.builtin) {
    std = src.prim('std'); aspect = src.prim('aspect'); pixelratio = src.prim('pixelratio');
    const ro = app.scene.renderOptions; const ra = Number(ro.val('ImageAspectRatio')), rp = Number(ro.val('ImagePixelRatio'));
    const differs = (a: any, b: number) => Number.isFinite(Number(a)) && Number.isFinite(b) && Math.abs(Number(a) - b) > 0.001;
    if (differs(aspect, ra) || differs(pixelratio, rp)) logWarning(app, miscDsText(1531));
  } else {
    // The output_format preferences are read from the project's desktop preference dump (no live store for that category here).
    const of = (desktopPrefs as any).categories?.['preferences.output_format'] ?? {};
    std = of.picture_standard; aspect = of.picture_ratio; pixelratio = of.ir_pixel_ratio;
  }
  setIf(app, prim, 'std', std);
  if (Number(std) === 0) { setIf(app, prim, 'aspect', aspect); setIf(app, prim, 'pixelratio', pixelratio); }
  for (const n of ['fov', 'fovtype', 'interestdist', 'near', 'far', 'proj', 'orthoheight']) setIf(app, prim, n, src.prim(n));
  setIf(app, prim, 'autokey', true);
  for (const pname of ['Camera Display', 'Camera Visibility']) {
    const from = src.obj?.properties.find(p => p.name === pname), to = cam.properties.find(p => p.name === pname); if (!from || !to) continue;
    for (const q of from.params) if (COPIED_TYPES.has(q.def.type)) setIf(app, to, q.name, q.value);
  }
  setIf(app, cam.properties.find(p => p.name === 'Camera Visibility'), 'objcameras', false);
  if (withoutInterest) setIf(app, prim, 'autoupdatecoidist', false);
  return cam;
}
function viewLetter(viewport: any): string {
  const v = String(siConst(viewport) ?? '');
  const m = /^siViewport([A-D])$/.exec(v); if (m) return m[1];
  // inferred: the view manager attributes "viewportundermouse" and "focusedviewport" both map to the active viewport of this build
  const vm = vmOf(); const i = vm?.viewports?.().indexOf(vm.active?.()) ?? -1;
  return i >= 0 ? String.fromCharCode(65 + i) : 'B';
}

// ================================================================== registration
export function registerMiscDsScriptCommands(app: App) {
  const state: MiscDsScriptsState = {
    invisiblePolygonsClusterName: INVISIBLE_POLYGONS_CLUSTER, session: null, lastRetarget: null, uvRowStrings,
    symEnvWeightUI: (args = {}) => symEnvWeight(app, { PropObj: null, SubComp: null, MappingTemplate: null, SymmetryAxis: 0, ...args }, true) as Promise<void>,
  };
  (app as any).miscDsScripts = state;
  const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- pick-position tools
  reg({
    name: 'DuplicateTool', label: 'Duplicate Tool', category: 'Edit', description: 'Places copies of objects at picked positions',
    args: [{ name: 'SelectionList', default: null }],
    execute(app, a) {
      const list = objs(app, a.SelectionList).filter(o => o !== app.scene.root);
      if (!list.length) { app.logMsg('info', 'Nothing to Duplicate. Select an object first.'); return; }
      positionLoop(app, 'DuplicateTool', 1154, (p) => {
        for (const item of list) {
          const copy = firstObject(app.run('SIDuplicate', { InputObjs: item, NbItems: 1, Hierarchy: 'siNoParent' })); if (!copy) continue;
          app.run('CutObj', { Children: [copy] });
          setPosition(app, copy, p);
          const dyn = copy.properties.find(pr => pr.name === 'DynamicsInitState');
          if (dyn) ['posx', 'posy', 'posz'].forEach((n, i) => setIf(app, dyn, n, p[i]));
        }
      });
    },
  });
  reg({
    name: 'DrawPrimitiveTool', label: 'Draw Primitive Tool', category: 'Modeling', description: 'Creates a primitive at each picked position',
    args: [{ name: 'PresetObj', default: '' }, { name: 'GeometryType', default: '' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }],
    execute(app, a) {
      positionLoop(app, 'DrawPrimitiveTool', 1155, (p) => {
        const o = firstObject(app.run('CreatePrim', { PresetObj: a.PresetObj, GeometryType: a.GeometryType, Name: a.Name, Parent: a.Parent }));
        if (o) setPosition(app, o, p);
      });
    },
  });
  const implicitTool = (name: string, label: string, preset: string) => reg({
    name, label, category: 'Modeling', description: 'Creates an implicit primitive at each picked position',
    args: [{ name: 'PresetObj', default: preset }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }],
    execute(app, a) {
      // Name and Parent are accepted and ignored: the object is made from the preset alone.
      positionLoop(app, name, 1155, (p) => { const o = firstObject(app.run('GetPrim', { PresetObj: a.PresetObj })); if (o) setPosition(app, o, p); });
    },
  });
  implicitTool('DrawImplicitPrimitiveTool', 'Draw Implicit Primitive Tool', '');
  implicitTool('DrawNullTool', 'Null Tool', 'Null');

  // ---------------------------------------------------------------- polygon visibility
  reg({
    name: 'UnhideAllPolygons', label: 'Unhide All Polygons', category: 'Viewing', description: 'Deletes the internal hidden-polygon cluster of the selected objects',
    args: [],
    execute(app) {
      const done = new Set<X3DObject>();
      const targets: (X3DObject | null)[] = app.compSel ? [app.compSel.obj] : app.selection.map(n => n instanceof X3DObject ? n : ownerObject(n));
      for (const o of targets) {
        if (!o || done.has(o)) continue; done.add(o);
        const c = o.cluster(stateOf(app).invisiblePolygonsClusterName); if (!c) continue;
        // inferred: the bus DeleteObj addresses objects and clears the selection; the cluster is removed here with the selection kept.
        const idx = o.clusters.indexOf(c);
        app.record('Delete ' + c.name, () => o.removeCluster(c), () => { o.clusters.splice(idx, 0, c); });
      }
    },
  });
  reg({
    name: 'UnhideAllPolygonClusters', label: 'Unhide All Polygon Clusters', category: 'Viewing', description: 'Shows every polygon cluster of the selected objects (view and render visibility)',
    args: [],
    execute(app) {
      // SetValue ".[obj].polymsh.cls.*.clsvisibility.viewvis" then ".rendvis", errors suppressed.
      const isVis = (p: Property) => p.type === 'clustervis' || p.type === 'clsvisibility' || p.name === 'clsvisibility';
      for (const pname of ['viewvis', 'rendvis']) for (const o of app.selectedObjects) for (const c of o.clusters) for (const p of c.properties) if (isVis(p)) setIf(app, p, pname, true);
    },
  });

  // ---------------------------------------------------------------- AppendBone
  reg({
    name: 'AppendBone', label: 'Append Bone', category: 'Animation', description: 'Appends a bone to the chain of the given effector',
    args: [{ name: 'InputObjs', default: null }, { name: 'Ex', default: 0 }, { name: 'Ey', default: 0 }, { name: 'Ez', default: 0 }, { name: 'Pin', default: true }],
    execute(app, a) {
      const elems = objs(app, a.InputObjs).filter(isChainElement);
      const eff = elems.find(o => o instanceof Effector && chainRootOf(o)?.effector === o) as Effector | undefined;
      if (!eff) { app.logMsg('error', 'AppendBone: parameter 0 must contain a skeleton effector'); return undefined; }
      const d = delegate(app, SI_APPEND_BONE, { InputObjs: elems, Ex: a.Ex, Ey: a.Ey, Ez: a.Ez, Pin: a.Pin });
      let result: any = d.result;
      if (!d.done) {
        result = appendBoneStandIn(app, eff, new THREE.Vector3(Number(a.Ex) || 0, Number(a.Ey) || 0, Number(a.Ez) || 0));
        logNya(app, 'AppendBone', 'the new bone is the C++ append command\'s; one bone from the chain end to (Ex, Ey, Ez) was added, Pin and the align-root-to-first-bone preference were not applied');
      }
      const list = Array.isArray(result) ? result : result ? [result] : [];
      if (!list.length) { app.logMsg('error', 'AppendBone: an error occured while adding the bone'); return result; }
      app.run('AddToSelection', { SelectionList: list, HierarchyLevel: 'NODE', CheckObjectSelectability: true });
      return result;
    },
  });

  // ---------------------------------------------------------------- SymEnvWeight
  function symEnvWeight(app: App, a: Record<string, any>, ui: boolean): void | Promise<void> {
    const items = subItems(app, a.SubComp);
    const axisGiven = !unset(a.SymmetryAxis); const axis = Number(a.SymmetryAxis) || 0;
    const missing = unset(a.MappingTemplate) ? items.map(it => ({ it, ...deformerModel(app, it) })).filter(x => !templateOf(x.model)) : [];
    if (!ui) {
      for (const x of missing) if (axisGiven && !templateOf(x.model)) createTemplate(app, x.it, x.anchor, true, axis, unset(a.PropObj));
      symEnvWeightApply(app, a, items);
      return;   // inferred: neither procedure produces a value
    }
    return (async () => {
      if (missing.length) {
        if (!interactive(app)) logNya(app, 'SymEnvWeight', 'the template question needs a user session; answered No', 'Q4');
        else if (await yesNo(miscDsText(1071), miscDsText(1072))) await interactiveTemplate(app);
      }
      symEnvWeightApply(app, a, items);
    })();
  }
  reg({
    name: 'SymEnvWeight', label: 'Apply Symmetry on Envelope Weight', category: 'Deformation', description: 'Mirrors envelope weights using a symmetry mapping template',
    args: [{ name: 'PropObj', default: null }, { name: 'SubComp', default: null }, { name: 'MappingTemplate', default: null }, { name: 'SymmetryAxis', default: 0 }],
    execute(app, a) { return symEnvWeight(app, a, false); },
  });

  // ---------------------------------------------------------------- SelectUVRow
  reg({
    name: 'SelectUVRow', label: 'Select UV Row', category: 'Selection', description: 'Selects a U or V row of points on a surface', args: [], undoable: false,
    execute(app) {
      app.run('SetSelFilter', { SelFilter: 'Point' });
      startPickSession(app, {
        command: 'SelectUVRow', kind: 'element', filter: 'Point', pickKind: 'point', prompt: miscDsText(1130), middlePrompt: miscDsText(1131),
        fromClick: (_p, pick) => {
          if (!pick || typeof pick.item !== 'number') return null;
          const mesh = pick.obj.primitive?.mesh() as any; const s = mesh ? surfOf(mesh) : null;
          if (s && mesh.positions.length / 3 === s.nu * s.nv) return `${pick.obj.name}.pnt[(${pick.item % s.nu},${Math.floor(pick.item / s.nu)})]`;
          return `${pick.obj.name}.pnt[${pick.item}]`;
        },
        onPick: (text: any, button: number, modifier: number) => {
          if (text === null || text === undefined) return true;   // inferred: an empty pick asks again
          const rows = uvRowStrings(String(text), button);
          if (!rows.length) { app.logMsg('info', 'Please pick one or more point(s) on a surface or surface mesh.'); return true; }
          rows.forEach((row, i) => {
            const r = uvRowPoints(app, row);
            if (!r) { logNya(app, 'SelectUVRow', `row ${row} cannot be resolved here (surface meshes and surfaces whose points are not the control grid)`); return; }
            // none = SelectObj, Shift = AddToSelection, Ctrl = ToggleSelection, Shift+Ctrl = RemoveFromSelection, other = SelectObj.
            // inferred: applied to the component selection directly, the bus selection commands do not read "(u,*)" tuples.
            const mode = modifier === 1 || (i > 0 && modifier !== 2 && modifier !== 3) ? 'add' : modifier === 2 ? 'toggle' : modifier === 3 ? 'remove' : 'replace';
            if (mode === 'remove') { const c = app.compSel; if (c && c.obj === r.obj && c.kind === 'point') app.selectComponents(r.obj, 'point', [...c.points].filter(x => !r.points.includes(x)), 'replace'); }
            else app.selectComponents(r.obj, 'point', r.points, mode);
          });
          return true;
        },
      });
    },
  });

  // ---------------------------------------------------------------- SetKeyableAttributes
  const KEYABLE: Record<string, number> = { siKeyableAttributeClear: 0, siKeyableAttributeKeyable: 1, siKeyableAttributeNonKeyableVisible: 2 };   // inferred numeric values: public siKeyableAttributeType enum
  /** The parameter of `o` that corresponds to a marked parameter (the marking is applied to every input object). */
  const equivalent = (o: X3DObject, q: Parameter): Parameter | undefined => {
    const owner: any = q.owner; const x = ownerObject(owner); if (!x || x === o) return x === o ? q : undefined;
    if (owner === x.kinematics.local) return o.kinematics.local.get(q.name);
    if (owner === x.kinematics.global) return o.kinematics.global.get(q.name);
    if (owner === x.primitive) return o.primitive?.get(q.name);
    if (owner instanceof Property) return o.properties.find(p => p.type === owner.type && p.name === owner.name)?.get(q.name);
    return undefined;
  };
  reg({
    name: 'SetKeyableAttributes', label: 'Set Keyable Attributes', category: 'Property|Animation', description: 'Sets the keyable / non-keyable-visible capability of parameters',
    args: [{ name: 'InputObjs', default: null }, { name: 'Params', default: '' }, { name: 'Attribute', default: ':siKeyableAttributeKeyable:siKeyableAttributeType' }],
    execute(app, a) {
      const list = objs(app, a.InputObjs);
      if (!list.length) { app.logMsg('info', 'No valid objects on input list'); throw new Cancelled('SetKeyableAttributes'); }
      let params: Parameter[];
      if (unset(a.Params)) {
        const marked = [...app.anim.marked]; params = [];
        for (const o of list) for (const q of marked) { const p = equivalent(o, q); if (p && !params.includes(p)) params.push(p); }
      } else params = paramsOf(app, list, a.Params).found;
      const c = siConst(a.Attribute); const attr = typeof c === 'number' ? c : KEYABLE[String(c)] ?? -1;
      const flag = (p: Parameter, name: 'keyable' | 'nonKeyableVisible', v: boolean) => {
        const d: any = p.def; const old = d[name]; if (!!old === v) return;
        app.record('Set ' + name, () => { d[name] = v; }, () => { d[name] = old; });
      };
      for (const p of params) {
        if (attr === 0) { flag(p, 'keyable', false); flag(p, 'nonKeyableVisible', false); }
        else if (attr === 1) { flag(p, 'nonKeyableVisible', false); flag(p, 'keyable', true); }
        else if (attr === 2) { flag(p, 'keyable', false); flag(p, 'nonKeyableVisible', true); }
        else { app.logMsg('info', 'Invalid input attribute'); throw new Cancelled('SetKeyableAttributes'); }
      }
      if (params.length) app.events.emit('params');
    },
  });

  // ---------------------------------------------------------------- TogglePinObjectInPosition
  reg({
    name: 'TogglePinObjectInPosition', label: 'Toggle Pin Object in Position', category: 'Constraint', description: 'Pins objects with a position constraint to a temporary sphere, or removes the pin',
    args: [{ name: 'ConstrainedObj', default: null }],
    execute(app, a) {
      const pins: X3DObject[] = [];
      for (const o of objs(app, a.ConstrainedObj)) {
        if (o.name.includes('TEMP_PIN')) continue;
        const pinCns = o.properties.find(p => p instanceof Constraint && p.type === 'poscns' && p.targets.some(t => t.name.includes('TEMP_PIN'))) as Constraint | undefined;
        if (pinCns) { for (const t of pinCns.targets) if (t.name.includes('TEMP_PIN') && !pins.includes(t)) pins.push(t); continue; }
        const at = worldPos(o);
        const sphere = keepSelection(app, () => firstObject(app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'TEMP_PIN' })));
        if (!sphere) continue;
        setIf(app, sphere.primitive?.operators[0], 'radius', 0.2);
        const l = sphere.kinematics.local; setIf(app, l, 'posx', at.x); setIf(app, l, 'posy', at.y); setIf(app, l, 'posz', at.z);
        addConstraint(app, o, 'Position', [sphere], false);
      }
      if (pins.length) {
        // one delete for all remembered pins; their constraints go with them
        const cut: { o: X3DObject; c: Property }[] = [];
        for (const o of app.scene.allObjects()) for (const p of o.properties) if (p instanceof Constraint && p.targets.some(t => pins.includes(t))) cut.push({ o, c: p });
        const where = pins.map(p => ({ p, parent: p.parentObj!, idx: p.parentObj!.children.indexOf(p) }));
        app.record('Delete pins', () => { for (const x of cut) x.o.removeProperty(x.c); for (const w of where) w.parent.removeChild(w.p); },
          () => { for (const w of where) { w.parent.addChild(w.p); w.parent.children.splice(w.parent.children.indexOf(w.p), 1); w.parent.children.splice(w.idx, 0, w.p); } for (const x of cut) x.o.addProperty(x.c); });
        app.selection = app.selection.filter(n => !pins.includes(n as any));
      }
      app.events.emit('scene');
    },
  });

  // ---------------------------------------------------------------- retargeting
  const tagModels = (app: App, models: Model[]) => {
    for (const m of models) {
      const tool = m.properties.find(p => p.name === TAGGING_TOOL);
      if (tool) { app.run('InspectObj', { InputObjs: [m] }); app.events.emit('inspect', tool); }
      else if (!delegate(app, TAGGING_TOOL, { InputObjs: [m] }).done) logNya(app, 'RetargetTagRig', `the tagging tool command is not available; no tagging property was created on ${m.name}`, 'Q6');
    }
    app.run('DeselectAll'); resetFilter(app);
  };
  reg({
    name: 'RetargetTagRig', label: 'RetargetTagRig', category: 'Animation', description: 'Tag a rig for motion retargeting',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const models = modelsOf(app, a.InputObjs).filter((n): n is Model => n instanceof Model);
      if (models.length) { tagModels(app, models); return; }
      app.run('SetSelFilter', { SelFilter: 'Model' }); app.run('DeselectAll');
      pickModel(app, 'RetargetTagRig', 'Select model to tag', '', () => {
        if (!app.selection.length) {
          app.run('DeselectAll'); resetFilter(app);
          app.logMsg('error', 'You must select at least one rig (model) to tag.'); return;
        }
        tagModels(app, app.selection.filter((n): n is Model => n instanceof Model));
      });
    },
  });
  reg({
    name: 'RetargetRigToRig', label: 'RetargetRigToRig', category: 'Animation', description: 'Retarget motion from one rig to another',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const given = (m: Model | null): m is Model => !!m && m !== app.scene.root && m.name !== 'Scene_Root';
      let source: Model | null = null, target: Model | null = null;
      for (const n of modelsOf(app, a.InputObjs)) {
        const m = modelOf(n); if (!given(m)) continue;
        if (!source) source = m; else if (!target && m !== source) target = m;
      }
      app.run('DeselectAll');
      const fail = (text: string) => { app.logMsg('error', text); resetFilter(app); };
      const finish = () => {
        if (source === target) { fail('Source and target models must be different'); return; }
        resetFilter(app);
        const src = source!, tgt = target!; const st = tagged(src), tt = tagged(tgt);
        if (!st.length || !tt.length) {
          if (!st.length) logWarning(app, 'Source rig has not been tagged. Launching tagging tool');
          if (!tt.length) logWarning(app, 'Target rig has not been tagged. Launching tagging tool');
          for (const m of [...(st.length ? [] : [src]), ...(tt.length ? [] : [tgt])]) app.run('RetargetTagRig', { InputObjs: [m] });
          return;
        }
        const names = (l: X3DObject[]) => l.map(o => o.fullName).join(',');
        const out = tt.filter(o => { const t = Number(o.properties.find(p => p.name === TAG)?.val('Type')); return t >= 1 && t <= 7; });
        const connectionSet = `${names(st)} ; ${names(tt)} ; ${names([src, tgt])} ; ${names(out)}`;
        const preset = 'SimpleIKRetargetOp'; const applyOp = app.commands.get('ApplyOp');
        const can = !!applyOp && (!applyOp.canRun || applyOp.canRun({ PresetObj: preset, ConnectionSet: connectionSet }));
        state.lastRetarget = { preset, connectionSet, applied: can };
        if (can) app.run('ApplyOp', { PresetObj: preset, ConnectionSet: connectionSet });
        else logNya(app, 'RetargetRigToRig', `the ${preset} operator is not available; ApplyOp "${preset}", "${connectionSet}" was not applied`, 'Q5');
        app.run('DeselectAll');
      };
      const pickTarget = () => {
        if (given(target)) { finish(); return; }
        pickModel(app, 'RetargetRigToRig', 'Select Target Model', 'Deselect', (m) => { if (!given(m)) { fail('You must select a model, or part of a model.'); return; } target = m; finish(); });
      };
      if (given(source)) pickTarget();
      else pickModel(app, 'RetargetRigToRig', 'Select Source Model', 'Deselect', (m) => { if (!given(m)) { fail('You must select a model, or part of a model.'); return; } source = m; pickTarget(); });
    },
  });

  // ---------------------------------------------------------------- shot cameras
  reg({
    name: 'CreateShotCamera', label: 'Create Camera Without interest', category: 'Primitive', description: 'Creates a scene camera that matches an existing camera',
    args: [{ name: 'SourceCamera', default: '' }, { name: 'DestCamera', default: '' }, { name: 'WithoutInterest', default: true }],
    execute(app, a) { return createShotCamera(app, 'CreateShotCamera', a.SourceCamera, a.DestCamera, boolArg(a.WithoutInterest)); },
  });
  reg({
    name: 'CreateShotCameraAndSwitch', label: 'Create Camera without Interest and Switch', category: 'Primitive', description: 'Creates a camera from a viewport camera and looks through it',
    args: [{ name: 'Viewport', default: ':siViewportFocussed:siViewport' }, { name: 'CameraName', default: '' }, { name: 'DestViewport', default: ':siViewportCurrent:siViewport' }, { name: 'WithoutInterest', default: true }],
    execute(app, a) {
      const letter = viewLetter(a.Viewport);
      const vp = vmOf()?.viewports?.()[letter.charCodeAt(0) - 65];
      // The view manager attribute "activecamera:<letter>". inferred: a perspective viewport that shows no scene camera reports "User".
      const active: string = vp ? (isCamera(app.scene.find(vp.name)) || vp.kind !== 'persp' ? vp.name : 'User') : '';
      let source: any = isCamera(app.scene.find(active)) ? app.scene.find(active) : null;
      if (!source) { const full = `Views.View${letter}.${active}Camera`; if (cameraSource(app, full)) source = full; }
      if (!source) { app.logMsg('error', miscDsText(1530)); return undefined; }
      const cam = createShotCamera(app, 'CreateShotCameraAndSwitch', source, a.CameraName, boolArg(a.WithoutInterest));
      // contract step 4: SetViewCamera <full name>, DestViewport – positional, so the registry names CameraName / View
      if (!delegate(app, SET_VIEW_CAMERA, { CameraName: cam.fullName, View: a.DestViewport }).done) logNya(app, 'CreateShotCameraAndSwitch', `the view-camera switch command is not available; viewport ${String(siConst(a.DestViewport))} keeps its camera`);
      return cam;
    },
  });
  reg({
    name: 'GetPrimCameraWithoutInterest', label: 'Camera Perspective Without Interest', category: 'Primitive', description: 'Creates a camera with no root and no interest',
    args: [{ name: 'PresetObj', default: 'Camera' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'Primitive', default: null }, { name: '3DObjCamera', default: null }],
    execute(app, a) {
      const preset = String(a.PresetObj ?? 'Camera').replace(/^.*[\\/]/, '').replace(/\.preset$/i, '');
      const parent = unset(a.Parent) ? app.scene.root : (a.Parent instanceof X3DObject ? a.Parent : app.scene.find(String(a.Parent)) ?? app.scene.root);
      const cam = newCamera(app, String(a.Name || 'Camera'), parent);
      if (preset !== 'Camera') {
        const fov = CAMERA_PRESETS[preset];
        if (fov) setIf(app, cam.primitive, 'fov', fov); else logNya(app, 'GetPrimCameraWithoutInterest', `camera preset "${preset}"; the default camera was created`);
      }
      setIf(app, cam.primitive, 'autoupdatecoidist', false);
      app.run('SelectFilter', { SelFilter: 'object' });
      app.select([cam, ...cam.descendants()]);   // SelectObj <camera>, "BRANCH"
      if (app.autoInspect) queueMicrotask(() => app.events.emit('inspect', cam));   // AutoInspect <camera>, "General"
      // inferred: the two output arguments are handed back as a named record (the command itself has no return value)
      return { Primitive: cam.primitive, '3DObjCamera': cam };
    },
  });

  // ---------------------------------------------------------------- user data
  reg({
    name: 'CreateUserDataMap', label: 'Create User Data Property', category: 'Property', description: 'Adds a user data map to the given clusters',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: 'UserData' }, { name: 'Template', default: null }],
    execute(app, a) {
      const raw: any[] = unset(a.InputObj) ? [...app.selection] : Array.isArray(a.InputObj) ? a.InputObj : [a.InputObj];
      const clusters = raw.map(x => findCluster(app, x)).filter((c): c is Cluster => !!c);
      const out: Property[] = [];
      if (!clusters.length) { app.logMsg('info', 'CreateUserDataMap requires clusters as the input'); return out; }
      let template: Property | null = null;
      if (!unset(a.Template)) {
        const t = findProperty(app, a.Template);
        if (isCustomProperty(t)) template = t; else app.logMsg('info', 'Ignoring template argument because it is not a custom property');
      }
      for (const c of clusters) {
        const map = new Property(String(a.PropertyName || 'UserData'), 'userdatamap', []);
        (map as any).template = template; (map as any).userData = new Map<number, string>();
        app.record('Add ' + map.name, () => c.addProperty(map), () => c.removeProperty(map));
        out.push(map);
      }
      return out;
    },
  });
  reg({
    name: 'SIInspectUserData', label: 'Low Level Inspect User Data Command', category: 'Property', description: 'Edits the user data stored on the given components',
    args: [{ name: 'UserDataMap', default: null }, { name: 'SubComp', default: null }],
    execute(app, a) {
      const map = findProperty(app, a.UserDataMap);
      if (!isUserDataMap(map)) { app.logMsg('error', 'Invalid argument - a User Data Map should be specified'); return; }
      const sub = Array.isArray(a.SubComp) ? a.SubComp[0] : a.SubComp;   // a collection item is unwrapped
      const m = typeof sub === 'string' ? /^(.+?)\.(pnt|poly|edge|sample)\[(.*)\]$/.exec(sub) : null;
      if (!m) { app.logMsg('error', 'Invalid argument - a SubComponent should be specified'); return; }
      const template: Property | null = (map as any).template ?? null;
      if (!template) { app.logMsg('error', 'User Data Map does not have an associated Custom Property'); return; }
      const cluster = map.parent as any as Cluster; const elements = cluster instanceof Cluster ? [...cluster.elements].map(String) : [];
      const indices: string[] = [];
      for (const part of m[3].split(',').map(s => s.trim()).filter(Boolean)) {
        const rg = /^(\d+)\s*-\s*(\d+)$/.exec(part);
        if (part === '*') indices.push(...elements); else if (rg) for (let i = Number(rg[1]); i <= Number(rg[2]); i++) indices.push(String(i)); else indices.push(part);
      }
      const mapped = indices.map(i => elements.indexOf(i)).filter(i => i >= 0);
      if (!mapped.length) { app.logMsg('error', 'Selected components are not part of the cluster'); return; }
      const items = userDataItems(map); const first = items.get(mapped[0]);
      if (first !== undefined && first !== '') {
        if (!loadBinaryData(template, first)) { app.logMsg('error', 'Failed to initialize Custom Property from User Data contents.  Data does not match Custom Property parameters.'); return; }
      } else for (const q of template.params) q.value = q.def.value;
      if (!interactive(app)) { logNya(app, 'SIInspectUserData', 'the modal property page needs a user session; treated as Cancel', 'Q4'); return; }
      return sdkModal(miscDsText(1163), (body) => renderSdkLayout(body, template, template.params.map(q => ({ param: q.name }))), { cls: 'miscds-userdata' }).then((ok) => {
        if (!ok) return;
        const blob = binaryDataOf(template); const old = new Map(items);
        const write = mapped.filter(i => i < elements.length);   // indices beyond the map's item count are skipped
        app.record('Set user data', () => { for (const i of write) items.set(i, blob); }, () => { items.clear(); for (const [k, v] of old) items.set(k, v); });
      });
    },
  });
}
