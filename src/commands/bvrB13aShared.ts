// Ledger row CMD-B13a (bvrexport.dll, "Behavior Export Command Plugin"): shared state and helpers of the Bvr*
// commands wired in bvrB13aActor.ts and bvrB13aSkills.ts.
// Brief: docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md ("Shared facts" section 2, "Contracts" section 3) and
// docs/re/WIRE_CORRECTIONS_B13.md ("Catalogue mismatches"). Original code written from that prose contract only;
// no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Every command returns nothing and never fails: errors are message boxes titled `Behavior Export`, after which the
//    command stops (BvrAbort is thrown inside the worker and caught by the command wrapper).
//  * Message boxes, modal property pages, PickObject, the Shift key and the file dialogs are answered by hooks on
//    `app.bvrB13a.hooks`. Without a hook: message boxes are logged (and shown when the session is interactive) and
//    answered OK / Yes; modal pages are answered OK; PickObject and file dialogs are answered Cancel.
//  * The tag properties (RTKNode, RTKEnd, RTKHomePose ...) are custom parameter sets found by name (note 2.4).
//  * The wire colour codes (0x200, 0x334 ...) are Softimage colour indices that this build's display property cannot
//    show (its `wirecol` is a bool); the code is kept per object in `app.bvrB13a.wireColours` and on the display
//    property as `wirecolCode`.
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, X3DObject, Model, Null, Light, Camera, Property, makeDisplay, threeOrder } from '../core/scene';
import { Bone, Effector } from '../core/scene2';
import { EnvelopeOperator } from '../core/envelope';
import { num, int, bool, str } from '../core/params';
import type { ParamDef } from '../core/params';
import { siMsgBox } from '../ui/msgBox';
import { isActionSource, sourcesOf } from '../core/mixerActionScripts';

export const NOTE = 'docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md';
export const ROW = 'CMD-B13a';
export const TITLE = 'Behavior Export';
export const FLT_MAX = 3.4028234663852886e38;
/** Win32 message box styles and answers (note 2.3). */
export const MB_OK = 0, MB_OKCANCEL = 1, MB_YESNO = 4;
export const ID_OK = 1, ID_CANCEL = 2, ID_YES = 6, ID_NO = 7;
/** Wire colour codes (note 2.4). */
export const WIRE_DEFAULT = 0x200, WIRE_VISUAL = 0x334, WIRE_COLLISION = 0xf9, WIRE_FOOT = 0x12e, WIRE_SPHERE = 0x1ef;

export interface BvrMessage { command: string; title: string; text: string; style: number; answer: number }
export interface BvrInspect { command: string; target: string; title: string; mode: number; modal: boolean; answer: boolean | null }
export interface BvrB13aState {
  messages: BvrMessage[];
  inspects: BvrInspect[];
  /** Progress bar captions shown (newest last). */
  progress: { command: string; caption: string }[];
  /** Number of times the command log was turned off around a worker. */
  cmdlogOff: { command: string; restored: boolean }[];
  /** Wire colour code set on each object (stand-in for the display property's colour index). */
  wireColours: Map<X3DObject, number>;
  /** Calls of the unread worker bodies (actor generation, BVH readers, render-setup writer ...). */
  workers: { command: string; worker: string; args: any }[];
  /** The ActorFile.InitDir value is on a property; the last chosen paths are here. */
  lastPaths: { command: string; path: string }[];
  /** Shift state tracked from the keyboard (used when hooks.shift is not set). */
  shiftDown: boolean;
  hooks: {
    /** Message box answer (ID_OK / ID_CANCEL / ID_YES / ID_NO). */
    msgBox?: (text: string, style: number, command: string) => number | null | undefined;
    /** Modal InspectObj (mode 4): true = OK, false = Cancel. Non-modal pages call it too (answer ignored). */
    inspect?: (title: string, target: Node, mode: number, command: string) => boolean | null | undefined;
    /** Shift key state at execution. */
    shift?: boolean;
    /** PickObject answer (null = cancelled). */
    pick?: (prompt: string, command: string) => Node | null | undefined;
    /** File dialog answer (null = cancelled). */
    fileDialog?: (title: string, filter: string, initDir: string, command: string) => string | null | undefined;
  };
}

export function stateOf(app: App): BvrB13aState {
  const a: any = app;
  if (a.bvrB13a) return a.bvrB13a;
  const st: BvrB13aState = { messages: [], inspects: [], progress: [], cmdlogOff: [], wireColours: new Map(), workers: [], lastPaths: [], shiftDown: false, hooks: {} };
  a.bvrB13a = st;
  if (typeof window !== 'undefined' && window.addEventListener) {
    const track = (e: KeyboardEvent) => { st.shiftDown = !!e.shiftKey; };
    window.addEventListener('keydown', track, true); window.addEventListener('keyup', track, true);
  }
  return st;
}

/** Thrown to stop a worker after its message box; the command still succeeds (note 2.3). */
export class BvrAbort extends Error { constructor() { super('Behavior Export: aborted'); } }
export const abort = (): never => { throw new BvrAbort(); };

export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }

/** A Behavior Export message box. Returns the button pressed. */
export function msgBox(app: App, command: string, text: string, style = MB_OK): number {
  const st = stateOf(app);
  const dflt = style === MB_YESNO ? ID_YES : ID_OK;
  let ans = st.hooks.msgBox?.(text, style, command);
  if (ans === null || ans === undefined) {
    ans = dflt;
    app.logMsg('info', `${TITLE}: ${text}`);
    if ((app as any).Interactive !== false && typeof document !== 'undefined' && style === MB_OK) { try { siMsgBox(text, TITLE); } catch { /* headless */ } }
  }
  st.messages.push({ command, title: TITLE, text, style, answer: ans });
  return ans;
}
/** Message box that stops the command. */
export function fatal(app: App, command: string, text: string): never { msgBox(app, command, text); return abort(); }

export function shiftHeld(app: App): boolean { const st = stateOf(app); return st.hooks.shift ?? st.shiftDown; }
export function progress(app: App, command: string, caption: string) { stateOf(app).progress.push({ command, caption }); }

/** Command-log suppression around a worker (note 2.3: preferences.scripting.cmdlog off, then restored). */
export function withCmdLogOff<T>(app: App, command: string, f: () => T): T {
  const a: any = app; const prev = a.cmdLog; const rec = { command, restored: false };
  stateOf(app).cmdlogOff.push(rec); a.cmdLog = false;
  try { return f(); } finally { a.cmdLog = prev; rec.restored = true; }
}

/** InspectObj wrapper (note 2.4): returns false only when a modal page was cancelled. */
export function inspect(app: App, command: string, target: Node, title: string, mode: number, modal: boolean, targetName?: string): boolean {
  const st = stateOf(app);
  let ans = st.hooks.inspect?.(title, target, mode, command);
  if (ans === null || ans === undefined) ans = true;
  st.inspects.push({ command, target: targetName ?? target.fullName, title, mode, modal, answer: modal ? ans : null });
  if (app.autoInspect) app.events.emit('inspect', target);
  return modal ? ans : true;
}

// ------------------------------------------------------------------ classes
export const isLightOrCamera = (o: X3DObject) => o instanceof Light || o instanceof Camera || /^(CameraRoot|SpotRoot|CameraInterest|SpotInterest)$/.test(o.type);
/** Class 0x4d of the note (inferred: a chain bone) and 0x4e (inferred: a chain effector). */
export const isChainBone = (o: X3DObject) => o instanceof Bone || o.type === 'bone';
export const isChainEffector = (o: X3DObject) => o instanceof Effector || o.type === 'eff';

// ------------------------------------------------------------------ tag properties
export const findProp = (o: X3DObject | null | undefined, name: string): Property | undefined => o?.properties.find(p => p.name === name);
export function makeTag(name: string, defs: ParamDef[] = []): Property {
  const p = new Property(name, 'customparamset', defs); (p as any).preset = 'Custom_parameter_list'; p.shared = false; return p;
}
export function addProp(app: App, o: X3DObject, p: Property): Property {
  app.record('AddProp', () => { o.addProperty(p); }, () => { o.removeProperty(p); });
  return p;
}
/** DeleteObj on a property (undoable). */
export function deleteProp(app: App, p: Property) {
  const o: any = p.parent; if (!o?.properties) return;
  const i = o.properties.indexOf(p);
  app.record('DeleteObj', () => o.removeProperty(p), () => { o.properties.splice(Math.min(i, o.properties.length), 0, p); p.parent = o; });
}
/** DeleteObj on scene objects; the selection keeps the items that survive. */
export function deleteObjs(app: App, objs: X3DObject[]) {
  if (!objs.length) return;
  const sel = [...app.selection];
  app.run('DeleteObj', { InputObj: objs });
  const gone = new Set<Node>(); for (const o of objs) { gone.add(o); for (const d of o.descendants()) gone.add(d); }
  app.select(sel.filter(n => !gone.has(n)));
}
export function setVal(app: App, p: Property, name: string, v: any) { const x = p.get(name); if (x) app.setParam(x, v, 'SetValue'); }

const CAP_RO = { readOnly: true };   // capability 6 = persistable | read-only (inferred SDK names)
export const rtkNodeDefs = () => [bool('VisualizationOnly', false, 'VisualizationOnly'), bool('CollisionOnly', false, 'CollisionOnly')];
export const rtkHomePoseDefs = () => ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'].map((n, i) => num(n, 0, n, { min: -FLT_MAX, max: FLT_MAX, uimin: i < 3 ? -100 : -200, uimax: i < 3 ? 100 : 200, ...CAP_RO }));
export const rtkActorDefs = () => [num('Radius', 1, 'Radius', { min: 0, max: FLT_MAX, uimin: 0, uimax: 100, ...CAP_RO }), num('Height', 1, 'Height', { min: 0, max: FLT_MAX, uimin: 0, uimax: 100, ...CAP_RO }), num('MeanDistance', 0, 'MeanDistance', { min: 0, max: FLT_MAX, uimin: 0, uimax: 100, ...CAP_RO })];
export const rtkSphereDefs = (r: number) => [num('Radius', r, 'Radius', { min: 0, max: FLT_MAX, uimin: 0, uimax: 100, ...CAP_RO })];
export const rtkFloorDefs = (top: number) => [num('Top', top, 'Top', { min: 0, max: FLT_MAX, uimin: 0, uimax: 100, ...CAP_RO })];
export const rtkEffectorDefs = () => [int('Contact', 0, 'Contact', { min: 0, max: 1, animatable: true }), bool('Anchor', false, 'Anchor', CAP_RO)];

// ------------------------------------------------------------------ registered custom properties (note 2.5)
export function makeBehaviorJL() { return makeTag('BehaviorJL', [...['MinX', 'MaxX', 'MinY', 'MaxY', 'MinZ', 'MaxZ'].map(n => num(n, 0, n, { min: -360, max: 360, uimin: -360, uimax: 360 })), bool('IK', false, 'IK')]); }
export function makeSkill() {
  return makeTag('Skill', [int('Source', 0, 'Source', { min: 0, max: 200, uimin: 0, uimax: 200 }), int('Skill', 0, 'Skill', { min: 0, max: 3, uimin: 0, uimax: 3 }),
    num('Threshold', 0.2, 'Threshold', { min: 0, max: 1, uimin: 0, uimax: 1 }), bool('Transfer', false, 'Transfer')]);
}
export function makeBehaviorGen() {
  return makeTag('BehaviorGen', [bool('Envelope', false, 'Envelope'), bool('Box', true, 'Box'), bool('RemoveExtra', true, 'RemoveExtra'), bool('RemovePoly', false, 'RemovePoly'),
    bool('Skill', true, 'Skill'), num('Factor', 0.2, 'Factor', { min: 0, max: 1 }), bool('Cog', false, 'Cog')]);
}
export function makeBVHActor() {
  return makeTag('BVHActor', [str('BVHFile', '', 'BVHFile'), int('Mode', 0, 'Mode'), bool('Box', true, 'Box'), num('Scale', 0.125, 'Scale', { min: 0.0001, max: 1 }),
    str('ActorName', 'Actor', 'ActorName'), str('Filter', '', 'Filter'), str('Remove', '', 'Remove'), bool('Root', true, 'Root'), str('ActionName', 'Mocap', 'ActionName'), bool('Optimize', true, 'Optimize')]);
}
export function makeLoopSkill() {
  const I = 2147483647;
  return makeTag('LoopSkill', [int('Source', 0, 'Source', { min: -I, max: I, uimin: 0, uimax: I }), int('Start', 0, 'Start', { min: -I, max: I }), int('End', 0, 'End', { min: -I, max: I }),
    int('Smooth', 10, 'Smooth', { min: 0, max: I }), bool('Loco', true, 'Loco'), int('PrevSource', 0, 'PrevSource'), int('PrevStart', 0, 'PrevStart'), int('PrevEnd', 0, 'PrevEnd')]);
}
export function makeRenderSetup() {
  const I = 2147483647;
  return makeTag('RenderSetup', [str('RenderFile', '', 'RenderFile'), int('Start', 1, 'Start', { min: -I, max: I, uimin: 1, uimax: 200 }), int('End', 1, 'End', { min: -I, max: I, uimin: 1, uimax: 200 }),
    int('Target', 0, 'Target', { min: 0, max: I }), bool('Enable', false, 'Enable'), str('Actor', '', 'Actor')]);
}
/** Find-or-add a property by name. */
export function ensureProp(app: App, o: X3DObject, name: string, make: () => Property): Property { return findProp(o, name) ?? addProp(app, o, make()); }

// ------------------------------------------------------------------ wire colour (note 2.4)
export function setWire(app: App, o: X3DObject, code: number) {
  const st = stateOf(app);
  let d = o.properties.find(p => p.type === 'display');
  if (!d) { d = makeDisplay(false); d.name = 'Display Property'; addProp(app, o, d); }
  else if (d.shared) { const p = d; app.record('AddProp', () => { p.shared = false; }, () => { p.shared = true; }); }
  const disp = d; const had = st.wireColours.has(o), old = st.wireColours.get(o), oldCode = (disp as any).wirecolCode;
  app.record('SetValue', () => { st.wireColours.set(o, code); (disp as any).wirecolCode = code; }, () => { if (had) st.wireColours.set(o, old!); else st.wireColours.delete(o); (disp as any).wirecolCode = oldCode; });
}
/** Ensure RTKNode (note 2.4): added with wire colour 0x200 when absent. */
export function ensureRtkNode(app: App, o: X3DObject): Property {
  const p = findProp(o, 'RTKNode'); if (p) return p;
  const n = addProp(app, o, makeTag('RTKNode', rtkNodeDefs())); setWire(app, o, WIRE_DEFAULT); return n;
}

// ------------------------------------------------------------------ actor structure (note 2.4)
export const MSG_GATE = (action: string) => `The ${action} action requires selecting a single node in the actor description.`;
export const MSG_NO_MODEL = 'Failed to find the actor model.';
export const MSG_SCENE_ROOT = 'Actor descriptions must be contained by a single model (scene root not supported).';
export const MSG_NESTED = 'Actor descriptions must be contained by a single model (embedded models not supported).';

/** Selection gate (note 2.3): exactly one X3DObject (or, when allowed, one action source). */
export function gate(app: App, command: string, gateText: string, allowSource = false): X3DObject | Property {
  const sel = app.selection;
  if (sel.length === 1 && sel[0] instanceof X3DObject && sel[0] !== app.scene.root) return sel[0];
  if (allowSource && sel.length === 1 && isActionSource(sel[0])) return sel[0] as Property;
  return fatal(app, command, gateText);
}
export function actorModel(app: App, command: string, node: X3DObject, sceneRootText = MSG_SCENE_ROOT): Model {
  let n: X3DObject | null = node instanceof Model ? node : node.parentObj;
  while (n && !(n instanceof Model)) n = n.parentObj;
  if (!n) fatal(app, command, MSG_NO_MODEL);
  if (n === app.scene.root) fatal(app, command, sceneRootText);
  return n!;
}
const notLC = (o: X3DObject) => !isLightOrCamera(o);
const hasTriangles = (o: X3DObject) => (o.primitive?.mesh()?.polygons.length ?? 0) > 0;
/** Actor root (note 2.4). May insert a `GlobalSRT` null above a single mesh child. */
export function actorRoot(app: App, command: string, model: Model, report = true): X3DObject {
  const kids = model.children.filter(notLC);
  if (kids.length !== 1) {
    if (report) msgBox(app, command, ['For a model to convert to an actor, the model must have a single child node (lights and cameras don\'t count). One of the following nodes needs to be lower in the tree:', ...kids.map(k => `node - ${k.name}`)].join('\n'));
    return abort();
  }
  const child = kids[0];
  if (!hasTriangles(child)) return child;
  const srt = new Null('GlobalSRT');
  app.record('Add GlobalSRT', () => model.addChild(srt), () => model.removeChild(srt));
  const idx = model.children.indexOf(child);
  app.record('Parent', () => srt.addChild(child), () => { model.addChild(child); model.children.splice(model.children.indexOf(child), 1); model.children.splice(Math.min(idx, model.children.length), 0, child); });
  return srt;
}
export function nestedCheck(app: App, command: string, root: X3DObject, text = MSG_NESTED) {
  for (const d of [root, ...root.descendants()]) if (d instanceof Model) fatal(app, command, text);
}
export function resolveCog(app: App, command: string, root: X3DObject): X3DObject {
  const tagged = root.children.find(c => findProp(c, 'RTKCogNode')); if (tagged) return tagged;
  const kids = root.children.filter(notLC);
  if (kids.length === 1) return kids[0];
  if (!kids.length) fatal(app, command, 'For a model to convert to an actor, the actor root node must have one child node (e.g. a COG node).');
  return fatal(app, command, [`For a model to convert to an actor, the actor root node ${root.name} must have a single child node. One of the following nodes needs to be lower in the tree:`, ...kids.map(k => `node - ${k.name}`), 'The other option is to mark one of the nodes as the COG node.'].join('\n'));
}

/** Temp-object purge (note 2.4). */
export function purgeTemp(app: App, model: X3DObject) {
  const doomed: X3DObject[] = [];
  const walk = (o: X3DObject) => { for (const c of o.children) { if (findProp(c, 'RTKHandle') || findProp(c, 'TmpRTKBndCylinder') || findProp(c, 'TmpRTKPose')) doomed.push(c); else walk(c); } };
  walk(model); deleteObjs(app, doomed);
}

// ------------------------------------------------------------------ transforms
export const globalPos = (o: X3DObject) => new THREE.Vector3().setFromMatrixPosition(o.globalMatrix());
/** Put a global transform on an object (local = parent global inverse x G). */
export function putGlobal(app: App, o: X3DObject, G: THREE.Matrix4) {
  const P = o.parentObj ? o.parentObj.globalMatrix() : new THREE.Matrix4();
  const L = P.clone().invert().multiply(G);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); L.decompose(p, q, s);
  const l = o.kinematics.local; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(l.val('rotorder'))); const d = 180 / Math.PI;
  const vals: [string, number][] = [['posx', p.x], ['posy', p.y], ['posz', p.z], ['rotx', e.x * d], ['roty', e.y * d], ['rotz', e.z * d], ['sclx', s.x], ['scly', s.y], ['sclz', s.z]];
  for (const [n, v] of vals) { const x = l.get(n)!; if (Math.abs(Number(x.value) - v) > 1e-9) app.setParam(x, v, 'SetValue'); }
}
export function putGlobalPos(app: App, o: X3DObject, pos: THREE.Vector3) {
  const G = o.globalMatrix(); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); G.decompose(p, q, s);
  putGlobal(app, o, new THREE.Matrix4().compose(pos, q, s));
}
/** Global Y range of an object's geometry (stand-in for the unread bound helper 0x180024d10; inferred: global space). */
export function geomYRange(o: X3DObject): { min: number; max: number } | null {
  const m = o.primitive?.mesh(); if (!m || !m.positions.length) return null;
  const G = o.globalMatrix(); const v = new THREE.Vector3(); let min = Infinity, max = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) { v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(G); min = Math.min(min, v.y); max = Math.max(max, v.y); }
  return { min, max };
}
/** Subtree bounding box (stand-in for the unread helper 0x180038b60; inferred: geometry points, else node centres). */
export function subtreeBox(root: X3DObject): THREE.Box3 {
  const box = new THREE.Box3(); const v = new THREE.Vector3();
  for (const o of [root, ...root.descendants()]) {
    const m = o.primitive?.mesh(); const G = o.globalMatrix();
    if (m && m.positions.length) for (let i = 0; i < m.positions.length; i += 3) box.expandByPoint(v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(G));
    else box.expandByPoint(globalPos(o));
  }
  return box;
}
/** RTKActor fit (note 2.4). */
export function fitActor(app: App, root: X3DObject) {
  const p = ensureProp(app, root, 'RTKActor', () => makeTag('RTKActor', rtkActorDefs()));
  const b = subtreeBox(root); const c = globalPos(root);
  let r = 0; for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) r = Math.max(r, Math.hypot(x - c.x, z - c.z));
  setVal(app, p, 'Height', b.max.y - b.min.y); setVal(app, p, 'Radius', r);
}

// ------------------------------------------------------------------ home pose (note 2.4)
/** Home pose store: global SRT (XYZ Euler in radians, inferred from the Rotate factor k) on every non-sphere node. */
export function storeHome(app: App, o: X3DObject) {
  if (findProp(o, 'RTKSphere')) return;
  const p = ensureProp(app, o, 'RTKHomePose', () => makeTag('RTKHomePose', rtkHomePoseDefs()));
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); o.globalMatrix().decompose(pos, q, s);
  const e = new THREE.Euler().setFromQuaternion(q, threeOrder(0));
  const vals: [string, number][] = [['px', pos.x], ['py', pos.y], ['pz', pos.z], ['rx', e.x], ['ry', e.y], ['rz', e.z], ['sx', s.x], ['sy', s.y], ['sz', s.z]];
  for (const [n, v] of vals) setVal(app, p, n, v);
  for (const c of o.children) storeHome(app, c);
}
export function homeMatrix(p: Property): THREE.Matrix4 {
  const v = (n: string) => Number(p.val(n)) || 0;
  return new THREE.Matrix4().compose(new THREE.Vector3(v('px'), v('py'), v('pz')), new THREE.Quaternion().setFromEuler(new THREE.Euler(v('rx'), v('ry'), v('rz'), threeOrder(0))), new THREE.Vector3(v('sx'), v('sy'), v('sz')));
}
/** Home pose apply, one pass. `rotatePass` false: skips chain bones. true: skips effectors, applies bones' rotation
 *  only (the note's Rotate call; inferred: absolute global rotation in degrees). */
export function applyHome(app: App, o: X3DObject, rotatePass: boolean) {
  const p = findProp(o, 'RTKHomePose');
  if (p) {
    if (!rotatePass && !isChainBone(o)) putGlobal(app, o, homeMatrix(p));
    else if (rotatePass && !isChainEffector(o)) {
      if (isChainBone(o)) {
        const H = homeMatrix(p); const hq = new THREE.Quaternion(); H.decompose(new THREE.Vector3(), hq, new THREE.Vector3());
        const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); o.globalMatrix().decompose(pos, q, s);
        putGlobal(app, o, new THREE.Matrix4().compose(pos, hq, s));
      } else putGlobal(app, o, homeMatrix(p));
    }
  }
  for (const c of o.children) applyHome(app, c, rotatePass);
}

/** Scale check (note 2.4). Returns false after its message. */
export function scaleCheck(app: App, command: string, root: X3DObject, action: string, includeEnd: boolean): boolean {
  for (const o of [root, ...root.descendants()]) {
    if (!includeEnd && findProp(o, 'RTKEnd')) continue;
    const l = o.kinematics.local; const off = ['sclx', 'scly', 'sclz'].some(n => Math.abs(Number(l.val(n)) - 1) > 1e-7);
    const env = !!o.primitive?.operators.some(op => op instanceof EnvelopeOperator);
    if (off && !env) { msgBox(app, command, `The scaling on the actor node ${o.name} must be (1,1,1) for a valid ${action}.\nGenerate the actor to freeze all the scaling in the description.`); return false; }
  }
  return true;
}

// ------------------------------------------------------------------ animation (IsAnimated / FCurve removal)
function animParams(app: App, o: X3DObject) { return [...o.kinematics.local.params, ...o.params].filter(p => app.anim.isAnimated(p)); }
export const isAnimated = (app: App, o: X3DObject) => animParams(app, o).length > 0;
/** Remove the embedded FCurves of a node (stand-in for helper 0x1800388b0, inferred). */
export function removeAnimation(app: App, o: X3DObject) {
  for (const p of animParams(app, o)) {
    const fc = app.anim.fcurves.get(p)!;
    app.record('RemoveAnimation', () => { app.anim.fcurves.delete(p); }, () => { app.anim.fcurves.set(p, fc); });
  }
}

// ------------------------------------------------------------------ action sources
export const sourcesOfModel = (m: Model) => sourcesOf(m);

/** Run a command body: BvrAbort ends it quietly; nothing is ever returned (note 2.3, corrections). */
export function body(f: (app: App, a: Record<string, any>) => void) {
  return (app: App, a: Record<string, any>) => { stateOf(app); try { f(app, a); } catch (e) { if (!(e instanceof BvrAbort)) throw e; } return undefined; };
}
export { X3DObject, Model, Null, Property, Node };
