// Ledger row CMD-B16b: shader creation (task bbbbee29 of shadertasks.dll: CreateShaderFromPreset, CreateShaderFromCLSID,
// CreateShaderFromProgID, AddShaderAttachedComment, CreateShadersFromMaterialPreset), shader array elements
// (SIAddArrayElement, SIRemoveArrayElement, SISwapArrayElements, shadertasks.dll) and SIAppendBone (viewinteraction.dll).
// Brief: the "Wire contract" paragraphs of docs/ghidra/cmd-b16b-shader-array-bone-commands.md and items 13-21 of
// docs/re/WIRE_CORRECTIONS_B16.md. Original code written from that prose only; no XSIBATCH golden exists for the row.
// Replaces the earlier inferred registrations (particlesB15cShaders.ts, shellsB15Else.ts AddShaderAttachedComment,
// inferredB15.ts SISwapArrayElements / SIAppendBone, render.ts CreateShaderFromPreset).
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError ("... (status 0x...)"); S_OK / S_FALSE are kept in
//    `app.shadertasksB16b.lastStatus`. XSISHADERTASKS message ids are logged as error lines carrying the id (the texts
//    are not in the repo).
//  * The SPDL registry is src/data/si/shader_spdl_index.json (tools/build_shader_spdl_index.mjs, from data/si/shaders):
//    the SPDL `Reference` GUID is the class id, the first MetaShader `Name` is the default name. // inferred: which SPDL
//    field the custom SPDL indexer's default name (entry +0x28) is.
//  * Shader array ports are the SPDL input parameters declared `type = array` (the materials' `lights` list,
//    sib_incidence_v3's `lights` / `customlights`); their elements live in a side table (ShaderArrayParameter below).
//  * The "shader created" event 0x20510032 is recorded in `app.shadertasksB16b.events` and the scene is refreshed.
//  * Lock checks use the shared lock records (inferredB10Scene.ts isLocked, level mask 0xffff).
import * as THREE from 'three';
import { App } from '../core/commands';
import { Node, Shader, Material, X3DObject, Model, threeOrder } from '../core/scene';
import { ChainRoot, Bone, Effector } from '../core/scene2';
import { Parameter } from '../core/params';
import { MATERIAL_PRESETS } from '../core/shaders';
import { ShaderCompound } from '../core/shaderCompound';
import {
  type PortRef, getSource, makeProgIdShader, makePresetShader, canonicalPreset, uniqueNameIn, nestedShaders, containerShaders,
} from '../core/textureLayers';
import spdlIndex from '../data/si/shader_spdl_index.json';
import { setLocalMatrix } from './viewEditPropertyHelpers';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_POINTER, E_FAIL, E_ACCESSDENIED,
  fail, raise, unset, boolOf, listOf, nodeOf, nestRec, renameRec, containerOf, lockedAny, lockError,
} from './shadertasksB12Shared';
import { refOf } from './modelTasksB15aShared';

const NOTE = 'docs/ghidra/cmd-b16b-shader-array-bone-commands.md';
type SpdlEntry = { clsid: string | null; name: string | null; arrays: Record<string, { item: string; itemType: string | null; title: string }> };
const SPDL = spdlIndex as unknown as Record<string, SpdlEntry>;
const EVENT_SHADER_CREATED = 0x20510032;
/** XSISHADERTASKS ids named by the note (texts not in the repo). */
const ID_REFUSED = 0xd2, ID_LOCKED = 0xd7, ID_NO_PORT_REMOVE = 0xd8, ID_NO_PORT_SWAP = 0xd9;

// ------------------------------------------------------------------ state
export interface ShadertasksB16bState {
  lastStatus: { command: string; status: number } | null;
  /** PrivateInvokeMethod of the last bbbbee29 call: 0 preset, 1 CLSID, 2 ProgID, 3 comment, 4 material preset. */
  lastMethod: number | null;
  /** "Shader created" notifications (event 0x20510032): the new object and its ProgID. */
  events: { id: number; shader: Node; progId: string }[];
  /** Attached comments: holder -> comment. */
  comments: WeakMap<Node, ShaderComment>;
  /** Helpers for scripts / checks. */
  arrayOf(sh: Shader, port: string): ShaderArrayParameter | null;
  commentOf(n: Node): ShaderComment | null;
  spdlByClsid(clsid: string): { key: string; name: string | null } | null;
  /** The render tree container a shader is nested in. */
  containerOf(sh: Shader): Node | null;
}
export function stateB16b(app: App): ShadertasksB16bState {
  const a = app as any; if (a.shadertasksB16b) return a.shadertasksB16b;
  const st: ShadertasksB16bState = {
    lastStatus: null, lastMethod: null, events: [], comments: new WeakMap(),
    arrayOf: (sh, port) => arrayPortOfShader(sh, port),
    commentOf: n => st.comments.get(n) ?? null,
    spdlByClsid: c => { const k = clsidKey(c); return k ? { key: k, name: SPDL[k].name } : null; },
    containerOf: sh => containerOf(app, sh),
  };
  a.shadertasksB16b = st; return st;
}
const setStatus = (app: App, command: string, status: number) => { stateB16b(app).lastStatus = { command, status }; };
const logNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${NOTE})`);
const text = (v: any) => (unset(v) ? '' : String(v));
const spdlKeyOf = (sh: Shader): string | null => { const f = sh.spdl?.file; return f ? f.replace(/\.spdl$/i, '') : null; };
function clsidKey(clsid: string): string | null {
  const c = clsid.toLowerCase().replace(/[{}]/g, '');
  return Object.keys(SPDL).find(k => SPDL[k].clsid === c) ?? null;
}

// ------------------------------------------------------------------ shader array ports
/** One element of a shader array port. `source` is what is connected to it (a shader, a light, ...). */
export class ShaderArrayElement {
  source: Node | null = null;
  constructor(readonly array: ShaderArrayParameter) {}
  get index(): number { return this.array.elements.indexOf(this); }
  get name(): string { return `${this.array.name}[${this.index}]`; }
  get fullName(): string { return `${this.array.fullName}[${this.index}]`; }
}
/** An array input parameter of a shader (SPDL `type = array`). */
export class ShaderArrayParameter {
  readonly elements: ShaderArrayElement[] = [];
  constructor(readonly owner: Shader, readonly name: string, readonly item: { item: string; itemType: string | null; title: string }) {}
  get fullName(): string { return `${this.owner.fullName}.${this.name}`; }
  get count(): number { return this.elements.length; }
}
const ARRAYS = new WeakMap<Shader, Map<string, ShaderArrayParameter>>();
function arrayPortOfShader(sh: Shader, port: string): ShaderArrayParameter | null {
  const key = spdlKeyOf(sh); const def = key ? SPDL[key]?.arrays[port] : undefined; if (!def) return null;
  let m = ARRAYS.get(sh); if (!m) ARRAYS.set(sh, m = new Map());
  let a = m.get(port); if (!a) m.set(port, a = new ShaderArrayParameter(sh, port, def));
  return a;
}
/** Resolve an `Object` item: an array port, an element, a non-array port, or nothing. */
type PortItem = { kind: 'array'; array: ShaderArrayParameter } | { kind: 'element'; element: ShaderArrayElement } | { kind: 'port' } | null;
function portItemOf(app: App, x: any): PortItem {
  if (x instanceof ShaderArrayParameter) return { kind: 'array', array: x };
  if (x instanceof ShaderArrayElement) return x.index >= 0 ? { kind: 'element', element: x } : null;
  if (x instanceof Parameter) return { kind: 'port' };
  if (x && typeof x === 'object' && x.owner instanceof Shader && typeof x.name === 'string') {
    const a = arrayPortOfShader(x.owner, x.name); if (!a) return { kind: 'port' };
    if (typeof x.index === 'number') { const el = a.elements[x.index]; return el ? { kind: 'element', element: el } : null; }
    return { kind: 'array', array: a };
  }
  if (typeof x !== 'string') return null;
  const s = x.trim();
  const em = /^(.+)\.([^.[\]]+)\[(\d+)\]$/.exec(s);   // <shader>.<port>[i]  // inferred: element path syntax
  if (em) { const sh = nodeOf(app, em[1]); const a = sh instanceof Shader ? arrayPortOfShader(sh, em[2]) : null; const el = a?.elements[Number(em[3])]; return el ? { kind: 'element', element: el } : null; }
  const pm = /^(.+)\.([^.]+)$/.exec(s);
  if (pm) { const sh = nodeOf(app, pm[1]); if (sh instanceof Shader) { const a = arrayPortOfShader(sh, pm[2]); if (a) return { kind: 'array', array: a }; if (sh.get(pm[2]) || sh.inputs.has(pm[2])) return { kind: 'port' }; } }
  return null;
}
const arrayLocked = (app: App, a: ShaderArrayParameter) => lockedAny(app, a.owner, a);
function notify(app: App) { app.events.emit('scene'); }

/** SIAddArrayElement(Object = array port) -> the new element, appended at the end. */
function siAddArrayElement(app: App, a: Record<string, any>) {
  const C = 'SIAddArrayElement';
  const it = portItemOf(app, listOf(a.Object)[0]);
  if (!it) throw fail(E_INVALIDARG, `${C}: Object is not a shader port`);
  if (it.kind !== 'array') throw fail(E_INVALIDARG, `${C}: Object is not an array parameter`);
  const arr = it.array;
  if (arrayLocked(app, arr)) { raise(app, C, ID_LOCKED, `${arr.fullName} is locked`); throw fail(E_FAIL, `${C}: ${arr.fullName} is locked`); }
  const el = new ShaderArrayElement(arr);
  app.record(C, () => { arr.elements.push(el); }, () => { const i = arr.elements.indexOf(el); if (i >= 0) arr.elements.splice(i, 1); });
  notify(app); setStatus(app, C, S_OK);
  a.OutputObj = el;
  return el;
}

/** SIRemoveArrayElement(Object = element): its connections are cut, then it is removed. `Index` is not read. */
function siRemoveArrayElement(app: App, a: Record<string, any>) {
  const C = 'SIRemoveArrayElement';
  const it = portItemOf(app, listOf(a.Object)[0]);
  if (!it || it.kind !== 'element') throw fail(E_INVALIDARG, `${C}: Object is not an element of an array parameter`);
  const el = it.element; const arr = el.array;
  // the port object is always there once resolved here (id 0xd8 kept for the contract's "missing port object")
  if (!arr) { raise(app, C, ID_NO_PORT_REMOVE); throw fail(E_FAIL, `${C}: no array port`); }
  if (arrayLocked(app, arr)) { raise(app, C, ID_LOCKED, `${arr.fullName} is locked`); throw fail(E_FAIL, `${C}: ${arr.fullName} is locked`); }
  const src = el.source;
  if (src) app.record('Disconnect', () => { el.source = null; }, () => { el.source = src; });
  const model = (arr.owner as any).model ?? owningModel(app, arr.owner);
  if (model && refOf(model)) logNya(app, C, `the reference delta sub-task for a locked referenced model (${model.name})`);
  const idx = el.index;
  app.record(C, () => { const i = arr.elements.indexOf(el); if (i >= 0) arr.elements.splice(i, 1); }, () => { arr.elements.splice(Math.min(idx, arr.elements.length), 0, el); });
  notify(app); setStatus(app, C, S_OK);
  return undefined;
}
function owningModel(app: App, sh: Shader): Model | null {
  const c = containerOf(app, sh);
  for (const o of app.scene.allObjects()) if (o.material === c) return o.model;
  return null;
}

/** SISwapArrayElements(Object = array port, IndexA, IndexB): the two elements (and their connections) swap places. */
function siSwapArrayElements(app: App, a: Record<string, any>) {
  const C = 'SISwapArrayElements';
  const ia = Math.trunc(Number(a.IndexA) || 0), ib = Math.trunc(Number(a.IndexB) || 0);
  if (ia < 0 || ib < 0) throw fail(E_INVALIDARG, `${C}: a negative index`);
  const it = portItemOf(app, listOf(a.Object)[0]);
  if (!it || it.kind !== 'array') throw fail(E_INVALIDARG, `${C}: Object is not an array parameter`);
  const arr = it.array;
  if (!arr) { raise(app, C, ID_NO_PORT_SWAP); throw fail(E_FAIL, `${C}: no array port`); }
  if (arrayLocked(app, arr)) { raise(app, C, ID_LOCKED, `${arr.fullName} is locked`); throw fail(E_FAIL, `${C}: ${arr.fullName} is locked`); }
  if (ia === ib) { setStatus(app, C, S_OK); return undefined; }
  if (ia >= arr.count || ib >= arr.count) throw fail(E_INVALIDARG, `${C}: index out of range (${arr.count} elements)`);
  const swap = () => { const t = arr.elements[ia]; arr.elements[ia] = arr.elements[ib]; arr.elements[ib] = t; };
  app.record(C, swap, swap);   // each element keeps its own connections, so they move with it
  notify(app); setStatus(app, C, S_OK);
  return undefined;
}

// ------------------------------------------------------------------ shader creation (task bbbbee29)
const isContainer = (n: any): boolean => n instanceof Material || n instanceof ShaderCompound;
/** Container resolution (UnPackArg): the first item; a shader container, else its owner. */
function containerArg(app: App, C: string, v: any): Node {
  const items = listOf(v);
  if (!items.length) throw fail(E_INVALIDARG, `${C}: Container is empty`);   // inferred status
  const n = nodeOf(app, items[0]);
  if (n && isContainer(n)) return n;
  // inferred: the owner of a shader is the render tree container it is nested in
  if (n instanceof Shader) { const c = containerOf(app, n); if (c && isContainer(c)) return c; }
  throw fail(E_INVALIDARG, `${C}: Container is not a render tree container`);   // inferred status
}
/** (a) container lock check. */
function lockCheck(app: App, C: string, container: Node) {
  if (lockedAny(app, container)) { lockError(app, C, container.name); throw fail(E_ACCESSDENIED, `${C}: ${container.name} is locked`); }
}
/** (b) add to the container: the shader and the shaders plugged into it, names kept unique there. */
function addToContainer(app: App, C: string, container: Node, root: Shader) {
  // the compound interface that only takes some shader kinds // inferred: no container of this build refuses a shader
  // unless it carries an `acceptsShader` predicate
  const accepts = (container as any).acceptsShader;
  if (typeof accepts === 'function' && accepts.call(container, root) === false) {
    raise(app, C, ID_REFUSED, `${container.name} does not accept ${root.name}`);
    throw fail(E_FAIL, `${C}: ${container.name} does not accept ${root.name}`);
  }
  const seen: Shader[] = [];
  const visit = (s: Shader) => { if (seen.includes(s)) return; seen.push(s); for (const x of s.inputs.values()) visit(x); };
  visit(root);
  const names: string[] = [];
  for (const s of seen) { const nm = uniqueNameIn(container, s.name, names); names.push(nm); renameRec(app, s, nm); }   // inferred: unique names
  for (const s of seen) nestRec(app, container, s);
}
/** (d) the "shader created" event. */
function created(app: App, sh: Node, progId: string) {
  const ev = stateB16b(app).events; ev.push({ id: EVENT_SHADER_CREATED, shader: sh, progId }); if (ev.length > 256) ev.shift();
  app.events.emit('scene');
}
const progIdOf = (sh: Shader) => (sh as any).progId ?? (spdlKeyOf(sh) ? `Softimage.${spdlKeyOf(sh)}.1` : sh.type);

function begin(app: App, method: number) { stateB16b(app).lastMethod = method; }
function finish(app: App, C: string, a: Record<string, any>, sh: Node) { setStatus(app, C, S_OK); a.Shader = sh; return sh; }

/** Method 1: CreateShaderFromCLSID(Clsid, Container, Name) -> Shader. */
function fromClsid(app: App, a: Record<string, any>) {
  const C = 'CreateShaderFromCLSID'; begin(app, 1);
  const m = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i.exec(text(a.Clsid).trim());
  if (!m) throw fail(E_INVALIDARG, `${C}: Clsid is not a GUID`);   // inferred: the string-to-GUID parse failure status
  const container = containerArg(app, C, a.Container);
  if (/^[0-]+$/.test(m[1])) throw fail(E_INVALIDARG, `${C}: null Clsid`);
  lockCheck(app, C, container);
  const key = clsidKey(m[1]);
  const sh = key ? makeProgIdShader(`Softimage.${key}.1`) : null;
  if (!sh) {
    logNya(app, C, `the status of a failed shader instantiation (class {${m[1]}} has no shader definition in this build's SPDL data)`);
    throw fail(E_FAIL, `${C}: shader class {${m[1]}} could not be created`);
  }
  (sh as any).clsid = m[1].toLowerCase(); (sh as any).progId = `Softimage.${key}.1`;
  addToContainer(app, C, container, sh);   // added before naming
  const name = text(a.Name) || SPDL[key!].name || '';
  if (name && name !== sh.name) renameRec(app, sh, containerHas(container, sh, name) ? uniqueNameIn(container, name) : name);   // inferred: unique
  // F3DUpgradeSPDLShader: the shaders of this build are already at their SPDL version
  created(app, sh, (sh as any).progId);
  return finish(app, C, a, sh);
}
/** Another shader of the container already has `name`. */
function containerHas(container: Node, except: Shader, name: string): boolean {
  const all = [...nestedShaders(container), ...containerShaders(container), ...(container instanceof ShaderCompound ? container.shaders() : [])];
  return all.some(s => s !== except && s.name === name);
}

/** Method 2: CreateShaderFromProgID(ProgID, Container, Name) -> Shader. */
function fromProgId(app: App, a: Record<string, any>) {
  const C = 'CreateShaderFromProgID'; begin(app, 2);
  const progId = text(a.ProgID).trim();
  const container = containerArg(app, C, a.Container);
  lockCheck(app, C, container);
  const sh = progId ? makeProgIdShader(progId) : null;
  if (!sh) throw fail(E_FAIL, `${C}: no shader definition for ProgID "${progId}"`);
  (sh as any).progId = progId;
  const key = spdlKeyOf(sh);
  const name = text(a.Name) || (key && SPDL[key]?.name) || sh.name;   // the definition's name
  sh.name = name;   // named before it is added
  addToContainer(app, C, container, sh);
  created(app, sh, progId);
  return finish(app, C, a, sh);
}

/** Method 0: CreateShaderFromPreset(PresetObj, Container, Name) -> Shader. */
function fromPreset(app: App, a: Record<string, any>) {
  const C = 'CreateShaderFromPreset'; begin(app, 0);
  if (unset(a.PresetObj) || !text(a.PresetObj).trim()) throw fail(E_POINTER, `${C}: no preset`);
  const container = containerArg(app, C, a.Container);
  lockCheck(app, C, container);
  const sh = makePresetShader(a.PresetObj);
  if (!sh) throw fail(E_FAIL, `${C}: preset "${text(a.PresetObj)}" is not bundled`);   // inferred status
  if (text(a.Name)) sh.name = text(a.Name);   // inferred: an empty Name keeps the preset's name
  addToContainer(app, C, container, sh);
  // the instance stored in the container is the created shader itself here (the hash lookup finds it)
  created(app, sh, progIdOf(sh));
  return finish(app, C, a, sh);
}

/** A material preset path: `Materials\Phong.Preset`, or a bare material preset name. // inferred: folder test */
function materialPresetKey(raw: string): { key: string | null; material: boolean } {
  const key = canonicalPreset(raw);
  const parts = raw.split(/[\\/]/).filter(Boolean); const folder = parts.length > 1 ? parts[parts.length - 2].toLowerCase() : '';
  const material = !!key && key in MATERIAL_PRESETS && (folder === '' || folder === 'materials');
  return { key, material };
}
/** Method 4: CreateShadersFromMaterialPreset(PresetObj, Container) -> Shader. */
function fromMaterialPreset(app: App, a: Record<string, any>) {
  const C = 'CreateShadersFromMaterialPreset'; begin(app, 4);
  const raw = text(a.PresetObj).trim();
  if (!raw) throw fail(E_POINTER, `${C}: no preset`);
  if (!listOf(a.Container).length) throw fail(E_POINTER, `${C}: no container`);
  const container = containerArg(app, C, a.Container);
  lockCheck(app, C, container);
  const { key, material } = materialPresetKey(raw);
  if (!key) throw fail(E_FAIL, `${C}: preset "${raw}" is not bundled`);   // inferred: F3DCmdGetPreset failure status
  if (!material) throw fail(E_FAIL, `${C}: "${raw}" is not a material preset`);
  // the preset's material, a carrier only: its surface shader on the surface / shadow / photon ports
  const carrier = new Material(key); const top = makePresetShader(key);
  if (!top) throw fail(E_FAIL, `${C}: preset "${raw}" is not bundled`);
  carrier.setSurface(top);
  // walk the material's ports in parameter order; record each connected shader with its port, cut the connection
  const recorded: { shader: Shader; port: string }[] = [];
  for (const p of carrier.params) {
    const src = getSource({ owner: carrier, name: p.name } as PortRef);
    if (src instanceof Shader && !recorded.some(r => r.shader === src)) recorded.push({ shader: src, port: p.name });
  }
  carrier.setSurface(null); top.parent = null;   // connections removed; the material is dropped
  if (recorded.length) logNya(app, C, 'the name each shader gets from its material port (naming helper not decoded); the shaders keep their own names');
  for (const r of recorded) addToContainer(app, C, container, r.shader);
  const main = recorded[0]?.shader ?? null;   // inferred: the first port in parameter order
  if (main) created(app, main, progIdOf(main));
  setStatus(app, C, S_OK); a.Shader = main;
  return main;
}

/** A render tree comment (preset Comment.Preset, class 77db4b2d-9e05-462c-a7c9-ed91d7783133). // inferred: no
 *  parameters (the preset's parameter list is not in the repo). */
export class ShaderComment extends Node {
  readonly classId = '77db4b2d-9e05-462c-a7c9-ed91d7783133';
  readonly preset = 'Comment.Preset';
  constructor(readonly holder: Node) { super('Comment', 'Comment', 'shader', []); }
}
/** Method 3: AddShaderAttachedComment(Container) -> the comment. */
function addAttachedComment(app: App, a: Record<string, any>) {
  const C = 'AddShaderAttachedComment'; begin(app, 3);
  const items = listOf(a.Container);
  const holder = items.length ? nodeOf(app, items[0]) : null;
  if (!holder) throw fail(E_POINTER, `${C}: no container`);
  lockCheck(app, C, holder);
  // the comment-holder interface // inferred: render tree shaders (compounds included) hold an attached comment
  if (!(holder instanceof Shader)) throw fail(E_FAIL, `${C}: ${holder.name} cannot hold an attached comment`);
  const st = stateB16b(app);
  if (st.comments.get(holder)) throw fail(E_FAIL, `${C}: ${holder.name} already has an attached comment`);
  const cm = new ShaderComment(holder);
  app.record(C, () => { st.comments.set(holder, cm); cm.parent = holder; }, () => { st.comments.delete(holder); cm.parent = null; });
  created(app, cm, 'Comment.Preset');
  return finish(app, C, a, cm);
}

// ------------------------------------------------------------------ SIAppendBone
const chainRootOf = (o: X3DObject | null): ChainRoot | null => {
  let n: X3DObject | null = o; while (n && !(n instanceof ChainRoot)) n = n.parentObj;
  if (n instanceof ChainRoot) return n;
  if (o instanceof Effector) for (const r of (o as any).scene?.allObjects?.() ?? []) if (r instanceof ChainRoot && r.effector === o) return r;
  return null;
};
function objOf(app: App, x: any): X3DObject | null {
  if (x instanceof X3DObject) return x;
  const n = typeof x === 'string' ? (app.scene.find(x.trim()) as any) : null;
  return n instanceof X3DObject ? n : null;
}
const isReferenced = (o: X3DObject) => { for (let m: X3DObject | null = o.model; m; m = m.parentObj ? m.parentObj.model : null) if (refOf(m) || (m as any).referencedModel) return true; return false; };
/** inferred: this build does not record 2D vs 3D chains; a root counts as a 3D chain unless it carries chainKind 2. */
const is3DChain = (r: ChainRoot) => (r as any).chainKind !== 2;

/** Align the root to its first bone, keeping every bone's global pose. */
function alignRootInside(app: App, root: ChainRoot) {
  const b = root.bones[0]; if (!b) return;
  const bg = b.globalMatrix(); const rg = root.globalMatrix();
  const rp = new THREE.Vector3(), rq = new THREE.Quaternion(), rs = new THREE.Vector3(); rg.decompose(rp, rq, rs);
  const bq = new THREE.Quaternion().setFromRotationMatrix(bg);
  const newRootG = new THREE.Matrix4().compose(rp, bq, rs);
  const parentG = root.parentObj ? root.parentObj.globalMatrix() : new THREE.Matrix4();
  setLocalMatrix(app, root, parentG.clone().invert().multiply(newRootG), 'Align root');
  setLocalMatrix(app, b, newRootG.clone().invert().multiply(bg), 'Align root');
}

/** SIAppendBone(InputObjs = [one chain element], Ex, Ey, Ez, Pin, AlignRootToFirstBone) -> the new bone. */
function siAppendBone(app: App, a: Record<string, any>) {
  const C = 'SIAppendBone';
  // a Collection argument left empty takes the selection (SDK siArgHandlerCollection)
  const items = unset(a.InputObjs) ? [...app.selection] : listOf(a.InputObjs);
  if (items.length !== 1) { setStatus(app, C, S_FALSE); return undefined; }
  const el = objOf(app, items[0]);
  const root = el && (el instanceof ChainRoot || el instanceof Bone || el instanceof Effector) ? chainRootOf(el) : null;
  const last = root?.bones[root.bones.length - 1]; const eff = root?.effector ?? null;
  if (!root || !last || !eff) { setStatus(app, C, S_FALSE); return undefined; }
  if (isReferenced(root)) throw fail(E_ACCESSDENIED, `${C}: ${root.name} belongs to a referenced model`);
  const pin = boolOf(a.Pin, true), align = boolOf(a.AlignRootToFirstBone, false);
  if (align && pin && is3DChain(root)) alignRootInside(app, root);
  // the new bone after the last bone, from the chain end to (Ex, Ey, Ez) (inferred: a global position)
  const target = new THREE.Vector3(Number(a.Ex) || 0, Number(a.Ey) || 0, Number(a.Ez) || 0);
  const start = root.chainEnd(); const len = start.distanceTo(target);
  logNya(app, C, 'the bone placement helper (0x180183f00); here the new bone runs from the chain end to (Ex, Ey, Ez) taken as a global position');
  // inferred: a zero-length bone is not created (no object comes back, so Value is not written)
  if (len < 1e-9) { setStatus(app, C, S_FALSE); return undefined; }
  const bone = new Bone(app.scene.uniqueName('bone'), len);   // inferred: name
  const dir = target.clone().sub(start).normalize();
  const gq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  const lq = new THREE.Quaternion().setFromRotationMatrix(last.globalMatrix()).invert().multiply(gq);
  const bl = bone.kinematics.local; const e = new THREE.Euler().setFromQuaternion(lq, threeOrder(bl.val('rotorder'))); const r = 180 / Math.PI;
  bl.set('posx', Number(last.val('length'))); bl.set('rotx', e.x * r); bl.set('roty', e.y * r); bl.set('rotz', e.z * r);
  const effG = eff.globalMatrix(); const oldParent = eff.parentObj;
  app.record('Append bone', () => { last.addChild(bone); root.bones.push(bone); }, () => { const i = root.bones.indexOf(bone); if (i >= 0) root.bones.splice(i, 1); last.removeChild(bone); });
  // the effector moves to (Ex, Ey, Ez) under the new bone; with Pin its global orientation / scale are kept
  app.record('Parent effector', () => bone.addChild(eff), () => { if (oldParent) oldParent.addChild(eff); else bone.removeChild(eff); });
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); effG.decompose(p, q, s);
  const wanted = pin ? new THREE.Matrix4().compose(target, q, s) : new THREE.Matrix4().compose(target, gq, new THREE.Vector3(1, 1, 1));   // inferred: Pin off -> along the new bone
  setLocalMatrix(app, eff, bone.globalMatrix().invert().multiply(wanted), 'Append bone');
  // the chain operator object and the preferred-pose refresh have no counterpart in this build's chains
  setStatus(app, C, S_OK);
  a.Value = bone;
  return bone;
}

// ------------------------------------------------------------------ registration
export function registerShadertasksB16bCommands(app: App) {
  stateB16b(app);
  const reg = (d: Parameters<App['register']>[0]) => app.register(d);
  reg({ name: 'CreateShaderFromPreset', label: 'Create Shader From Preset', category: 'Rendering', description: 'Add shader to a render tree from a preset',
    args: [{ name: 'PresetObj', default: null }, { name: 'Container', default: null }, { name: 'Name', default: '' }], execute: fromPreset });
  reg({ name: 'CreateShaderFromCLSID', label: 'Create Shader From CLSID', category: 'Rendering', description: 'Add shader to a render tree from a CLSID',
    args: [{ name: 'Clsid', default: '{00000000-0000-0000-0000-000000000000}' }, { name: 'Container', default: null }, { name: 'Name', default: '' }], execute: fromClsid });
  reg({ name: 'CreateShaderFromProgID', label: 'Create Shader From ProgID', category: 'Rendering', description: 'Add shader to a render tree from a ProgID',
    args: [{ name: 'ProgID', default: '' }, { name: 'Container', default: null }, { name: 'Name', default: '' }], execute: fromProgId });
  reg({ name: 'AddShaderAttachedComment', label: 'Add Shader Attached Comment', category: 'Rendering', description: 'Add an attached comment to a shader',
    args: [{ name: 'Container', default: null }], execute: addAttachedComment });
  reg({ name: 'CreateShadersFromMaterialPreset', label: 'Create Shaders From Material Preset', category: 'Rendering', description: 'Add a shader tree to a render tree from a material preset',
    args: [{ name: 'PresetObj', default: null }, { name: 'Container', default: null }], execute: fromMaterialPreset });
  reg({ name: 'SIAddArrayElement', label: 'Add Array Element', category: 'Rendering', description: 'Add a new element to an array.',
    args: [{ name: 'Object', default: null }], execute: siAddArrayElement });
  reg({ name: 'SIRemoveArrayElement', label: 'Remove Array Element', category: 'Rendering', description: 'Add a new element to an array.',
    args: [{ name: 'Object', default: null }, { name: 'Index', default: 0 }], execute: siRemoveArrayElement });
  reg({ name: 'SISwapArrayElements', label: 'SwapArrayElements', category: 'Rendering', description: 'Swaps two elements of an array.',
    args: [{ name: 'Object', default: null }, { name: 'IndexA', default: 0 }, { name: 'IndexB', default: 0 }], execute: siSwapArrayElements });
  reg({ name: 'SIAppendBone', label: 'Append Bone', category: 'Animation',
    args: [{ name: 'InputObjs', default: null }, { name: 'Ex', default: 0 }, { name: 'Ey', default: 0 }, { name: 'Ez', default: 0 }, { name: 'Pin', default: true }, { name: 'AlignRootToFirstBone', default: false }],
    execute: siAppendBone });
}
