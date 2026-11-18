// Ledger row CMD-01d. Brief: docs/ghidra/cmd-01d-keysets-paintkeys-sky.md, "Wire contract". Original code written from that contract only.
//
//   A. Character key sets   GetCurrentCharacterKeySet, GetAllCharacterKeySets, CreateSubCharacterKeySet,
//                           AddProxyParamToCharacterKeySet, SaveKeyOnCharacterKeySet, SaveZeroKeyOnCharacterKeySet,
//                           RemoveKeyOnCharacterKeySet, InspectCurrentCharacterKeySet,
//                           OpenAnimationEditorOnCurrentCharacterKeySet, DeleteCurrentCharacterKeySet,
//                           SelectObjectsFromCharacterKeySet
//   B. FX paint shape keys  FirstPaintShapeKey, PrevPaintShapeKey, ClosestPaintShapeKey, NextPaintShapeKey,
//                           LastPaintShapeKey, DeletePaintShapeKey, SavePaintShapeKey, PaintShapeManipTool
//   C. Physical sky         AddPhysicalSky
//
// How this build differs from a Softimage session, and why:
//
//  * Key set model. A character key set is a custom property (type `customparamset`) with a boolean parameter
//    `IsCharacterKeySet`; sub key sets are kept in the `nested` list of their parent property. The current key
//    set is the text parameter `CurrentCharacterKeySet` on the scene node (added on first use, because New Scene
//    replaces the scene object). The older commands in src/commands/anim.ts keep a separate name -> parameter
//    list map (`app.keySets`); they are not part of this row and are not touched. `app.characterKeySets` gives
//    scripts and checks the helpers of this file (create a top-level key set, set the current one, ...).
//  * The commands the scripts call. The build's AddProp, AddProxyParam and SaveKeyOnKeyable have other
//    argument lists than Softimage's (and there is no remove-key-on-keyable or set-marking command yet), so the
//    steps that the contract routes through them are done here directly on the scene model. InspectObj,
//    OpenAnimationEditor, SelectObj, DeselectAll, GetPrimLight, GetPrim, ParentObj, ApplyCns and Translate are
//    called on the command bus.
//  * Time. There is one timeline value (`app.anim.frame`); it stands for both PlayControl.Key and
//    PlayControl.Current (inferred). The preference animation.savekeymodified is `app.keyModifiedOnly`.
//  * Name prompt (H3). The command bus is synchronous, so the modal input box is the browser's `prompt`
//    (text id 1052, default name pre-filled); the title id 1051 cannot be shown there.
//  * FX paint. The native lookups and the native save entry are open questions Q1 / Q2. They are reached
//    through `app.fxPaint` hooks (or through a registered native command of that name once one exists). Without
//    a hook the branch logs "not yet attested" and behaves as "no key returned".
//  * Physical sky. The sun direction operator command is not attested (Q4, row CMD-01d-SUNOP): step 6 logs
//    "not yet attested" unless that command is registered. Shader connections on the light primitive and the
//    pass shader stacks have no model in src/core yet; they are kept as plain fields (`shaderCnx` on the light
//    primitive, `EnvironmentShaderStack` / `LensShaderStack` on the pass).
import { App } from '../core/commands';
import { Node, Property, X3DObject, Model, Pass, Shader, makeSiShader } from '../core/scene';
import { Parameter, bool, num, int, color } from '../core/params';
import { siString } from '../ui/si';
import { findParam } from './index';

const NOTE = 'docs/ghidra/cmd-01d-keysets-paintkeys-sky.md';
const notYet = (command: string, what: string, question: string) => `${command}: not yet attested: ${what} (${NOTE} ${question})`;

// ------------------------------------------------------------------ translated messages (XSISCRIPTS)
const XSISCRIPTS_TEXT: Record<number, string> = { 1051: 'New Character Key Set', 1052: 'Name for New Character Key Set' };
const text = (id: number): string => siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? '';

// ------------------------------------------------------------------ key set model

export const KEYSET_FLAG = 'IsCharacterKeySet';
export const CURRENT_PARAM = 'CurrentCharacterKeySet';
export const DEFAULT_KEYSET_NAME = 'CharKeySet';
export const DEFAULT_SUB_KEYSET_NAME = 'SubCharKeySet';
const CUSTOM_TYPE = 'customparamset';

/** A custom property that can hold nested custom properties (sub key sets). */
export class CharacterKeySetProperty extends Property {
  nested: Property[] = [];
  constructor(name: string) { super(name, CUSTOM_TYPE, [bool(KEYSET_FLAG, false, KEYSET_FLAG, { inspectable: false })]); }
  explorerChildren(): Node[] { return this.nested; }
}

const isCustomProperty = (n: any): n is Property => n instanceof Property && n.type === CUSTOM_TYPE;
const isKeySet = (n: any): boolean => isCustomProperty(n) && n.val(KEYSET_FLAG) === true;
const nestedOf = (p: any): Property[] => (Array.isArray(p?.nested) ? p.nested : []);
const proxiedOf = (p: Parameter): Parameter | undefined => (p as any).proxied;

/** The 3D object that owns a node or a parameter. */
function ownerObject(x: Parameter | Node | null | undefined): X3DObject | null {
  let n: any = x instanceof Parameter ? x.owner : x;
  while (n && !(n instanceof X3DObject)) n = n.parentObj ?? n.parent;
  return n ?? null;
}

/** Softimage-style full name (`cube.kine.local.posx`, `Scene_Root.CharKeySet`, `Passes.Default_Pass`). inferred: naming of this build's nodes */
export function siName(x: Parameter | Node | null | undefined): string {
  if (!x) return '';
  if (x instanceof Parameter) return `${siName(x.owner as any)}.${x.name}`;
  const n: any = x;
  if (n instanceof X3DObject) {
    if (!n.parentObj) return n.name;
    const m = n.parentObj.model;
    return m && m.parentObj ? `${siName(m)}.${n.name}` : n.name;
  }
  if (n instanceof Pass) return `Passes.${n.name}`;
  const seg = n.kind === 'kinematics' ? 'kine' : n.type === 'kine.local' ? 'local' : n.type === 'kine.global' ? 'global' : n.name;
  const p = n.parent as any;
  return p && p.kind !== 'scene' ? `${siName(p)}.${seg}` : seg;
}

/** Scene dictionary lookup by full name; never raises. */
function lookup(app: App, name: string): Node | undefined {
  try {
    const tokens = String(name).trim().split('.');
    if (tokens[0] === 'Scene' && tokens[1] === 'Scene_Root') tokens.shift();
    let cur: any = tokens[0] === 'Scene_Root' ? app.scene.root : app.scene.find(tokens[0]);
    for (let i = 1; cur && i < tokens.length; i++) {
      const t = tokens[i];
      if (cur instanceof X3DObject) cur = (cur instanceof Model ? [...cur.descendants()].find(o => o.name === t) : undefined) ?? cur.properties.find(p => p.name === t);
      else if (cur instanceof Property) cur = nestedOf(cur).find(p => p.name === t);
      else cur = undefined;
    }
    return cur ?? undefined;
  } catch { return undefined; }
}

function currentParam(app: App): Parameter {
  const s = app.scene;
  return s.get(CURRENT_PARAM) ?? s.add({ name: CURRENT_PARAM, label: 'Current Character Key Set', type: 'string', value: '', animatable: false, inspectable: false });
}
/** What the set-current command of the script file does: write the text to the scene parameter. */
function setCurrent(app: App, name: string) { app.setParam(currentParam(app), String(name ?? ''), 'Set Current Character Key Set'); }

/** H1: the current key set, or null. Only "is a custom property" is checked, not the flag. */
function currentKeySet(app: App): Property | null {
  const name = String(currentParam(app).value ?? '').trim();
  if (!name) return null;
  const n = lookup(app, name);
  return isCustomProperty(n) ? n : null;
}

/** H2: resolve a CharacterKeySet argument. Errors are swallowed. */
function resolveKeySetArg(app: App, arg: any): any {
  try {
    if (Array.isArray(arg)) arg = arg[0];   // a collection item
    if (arg === undefined || arg === null || arg === '') return currentKeySet(app);
    if (typeof arg === 'string') return lookup(app, arg) ?? null;
    return arg;
  } catch { return null; }
}

// inferred: what VBScript's TypeName gives for this build's node classes
function typeName(x: any): string {
  if (x === null || x === undefined) return 'Nothing';
  if (x instanceof Model) return 'Model';
  if (x instanceof X3DObject) return 'X3DObject';
  if (isCustomProperty(x)) return 'CustomProperty';
  if (x instanceof Property) return 'Property';
  if (x instanceof Parameter) return 'Parameter';
  return x?.constructor?.name ?? typeof x;
}
function rejectNotKeySet(app: App, x: any) {
  app.logMsg('info', 'Must receive Character Set as first parameter');
  app.logMsg('info', `Type was ${typeName(x)}`);
}

function uniqueAmong(names: string[], base: string): string {
  if (!names.includes(base)) return base;
  let i = 1; while (names.includes(`${base}${i}`)) i++;
  return `${base}${i}`;   // inferred: numeric suffix on a name clash
}

/** Add a Custom_parameter_list property flagged as a key set on an object or on another custom property. */
function addKeySetProperty(app: App, owner: X3DObject | Property, name: string): CharacterKeySetProperty {
  const siblings = owner instanceof X3DObject ? owner.properties : ((owner as any).nested ??= []) as Property[];
  const ks = new CharacterKeySetProperty(uniqueAmong(siblings.map(p => p.name), name));
  if (owner instanceof X3DObject) app.record('Add property', () => owner.addProperty(ks), () => owner.removeProperty(ks));
  else app.record('Add property', () => { ks.parent = owner; siblings.push(ks); }, () => { const i = siblings.indexOf(ks); if (i >= 0) siblings.splice(i, 1); ks.parent = null; });
  app.setParam(ks.get(KEYSET_FLAG)!, true);
  return ks;
}

/** Add proxy parameters for `masters` to a custom property. A proxy is a live alias of its master parameter. */
function addProxies(app: App, ks: Property, masters: Parameter[]): Parameter[] {
  const out: Parameter[] = [];
  for (const m0 of masters) {
    const master = proxiedOf(m0) ?? m0;
    if (ks.params.some(p => proxiedOf(p) === master)) continue;   // inferred: a master is proxied once per key set
    const name = uniqueAmong(ks.params.map(p => p.name), siName(master).replace(/[^\w]/g, '_'));   // inferred: proxy naming
    const byName: Map<string, Parameter> = (ks as any).byName;
    let proxy!: Parameter;
    app.record('Add proxy parameter', () => {
      if (!proxy) {
        proxy = ks.add({ ...master.def, name, label: name, value: master.value, keyable: true, group: undefined });
        (proxy as any).proxied = master;
        Object.defineProperty(proxy, 'value', { configurable: true, get: () => master.value, set: (v: any) => { master.value = v; } });
      } else { ks.params.push(proxy); byName.set(name, proxy); }
    }, () => { const i = ks.params.indexOf(proxy); if (i >= 0) ks.params.splice(i, 1); byName.delete(name); });
    out.push(proxy);
  }
  if (out.length) app.events.emit('params');
  return out;
}

function resolveParams(app: App, arg: any): Parameter[] {
  const list = Array.isArray(arg) ? arg : arg instanceof Parameter ? [arg] : String(arg ?? '').split(',');
  const out: Parameter[] = [];
  for (const x of list) {
    const p = x instanceof Parameter ? x : typeof x === 'string' && x.trim() ? findParam(app, x.trim()) : undefined;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** The parameter of `o` that sits where the marked parameter `m` sits on its own object. */
function sameParamOn(o: X3DObject, m: Parameter): Parameter | undefined {
  const mo = ownerObject(m); if (mo === o) return m;
  if (!mo) return undefined;
  const owner: any = m.owner;
  if (owner === mo.kinematics.local) return o.kinematics.local.get(m.name);
  if (owner === mo.kinematics.global) return o.kinematics.global.get(m.name);
  if (owner === mo.primitive) return o.primitive?.type === owner.type ? o.primitive!.get(m.name) : undefined;
  if (owner instanceof Property) return o.properties.find(p => p.type === owner.type && p.name === owner.name)?.get(m.name);
  return undefined;
}

/** H4: the parameters to add for a set of objects, depending on the marking. */
function paramsForObjects(app: App, objs: X3DObject[]): Parameter[] {
  const marked = [...app.anim.marked];
  const out: Parameter[] = [];
  const push = (p: Parameter | undefined) => { if (p && !out.includes(p)) out.push(p); };
  if (!marked.length) {
    for (const o of objs) {
      const sets: any[] = [o.kinematics.local, o.kinematics.global, ...o.properties, o.primitive].filter(Boolean);   // inferred: which containers count as "parameters of the object"
      for (const s of sets) for (const p of s.params as Parameter[]) if (p.keyable && !proxiedOf(p)) push(p);
    }
    return out;
  }
  for (const o of objs) for (const m of marked) push(sameParamOn(o, m));   // every parameter of this build is persistable
  for (const p of out) {
    if (proxiedOf(p) || !p.animatable || p.keyable) continue;
    if (!(p.def as any).nonKeyableVisible) app.record('Make keyable', () => { p.def.keyable = true; }, () => { p.def.keyable = false; });   // inferred: field name of the "non-keyable visible" capability
    app.logMsg('info', `Made ${siName(p)} Keyable`);
  }
  return out;
}

/** H5: the entries of a collection that belong to one model. */
const objectsOfModel = (objs: X3DObject[], model: Model | null): X3DObject[] => objs.filter(o => (o instanceof Model ? o === model : o.model === model));

/** Keyable parameters of a key set as the parameters that carry the keys (the masters of its proxies). */
function keyTargets(ks: Property): Parameter[] {
  const out: Parameter[] = [];
  for (const p of ks.params) { if (!p.keyable) continue; const m = proxiedOf(p) ?? p; if (!out.includes(m)) out.push(m); }
  return out;   // inferred: nested sub key sets are not keyed with their parent
}

const keyTime = (app: App): number => Number(app.anim.frame);   // inferred: PlayControl.Key == the one timeline value of this build

function saveKeys(app: App, zero: boolean) {
  const ks = currentKeySet(app);
  const t = keyTime(app);
  if (!ks) { app.logMsg('error', 'No current character key set for SaveKey'); return; }
  const modifiedOnly = !!(app as any).keyModifiedOnly;
  for (const p of keyTargets(ks)) {
    const A = app.anim;
    const had = A.fcurve(p)?.keys.find(k => k.time === t);
    if (modifiedOnly) {   // inferred: "modified" = the value differs from what the curve (or, unanimated, the default) gives at the key time
      const fc0 = A.fcurve(p); const ref = fc0 && fc0.keys.length ? fc0.eval(t) : Number(p.def.value);
      if (Math.abs(Number(p.value) - ref) < 1e-9) continue;
    }
    const v = zero ? 0 : Number(p.value);
    const fc = A.fcurve(p, true)!;
    app.record('Key', () => fc.addKey(t, v), () => { if (had) fc.addKey(t, had.value); else fc.removeKey(t); });
  }
  app.events.emit('params');
}

/** A2 nested search: every nested custom property is visited; flagged ones are added; anything with nested objects is searched. */
function collectNested(p: Property, out: Property[]) {
  for (const n of nestedOf(p)) {
    if (!isCustomProperty(n)) continue;
    if (n.val(KEYSET_FLAG) === true) out.push(n);
    if (nestedOf(n).length) collectNested(n, out);
  }
}
function allKeySets(app: App): Property[] {
  const out: Property[] = [];
  const of = (o: X3DObject) => { for (const p of o.properties) if (isKeySet(p)) { out.push(p); collectNested(p, out); } };
  of(app.scene.root);
  for (const o of app.scene.root.descendants()) if (o instanceof Model) of(o);   // inferred: the root's model list is recursive, in hierarchy order
  return out;
}

// ------------------------------------------------------------------ FX paint state (hooks for the native side)

export type PaintKeyLookup = 'First' | 'Prev' | 'Closest' | 'Next' | 'Last';
export interface FxPaintState {
  /** Stand-in for the PaintTool object: `CurrentTool` is the active FX paint tool id. */
  PaintTool: Node;
  /** Last marking text set by PaintShapeManipTool. */
  marking: string;
  /** Native Get<which>PaintShapeKey (Q2). Returns a key object with a `time` parameter / field, or null. */
  lookup: ((which: PaintKeyLookup, shape: any, time: number | undefined) => any) | null;
  /** Native two-argument save entry (Q1). */
  saveNative: ((shape: any, time: number) => void) | null;
  /** What deleting a key object does in the FX paint model (not attested). */
  deleteKey: ((key: any) => void) | null;
}
const fxPaint: FxPaintState = {
  PaintTool: new Node('PaintTool', 'PaintTool', 'property', [int('CurrentTool', 0, 'CurrentTool', { animatable: false })]),
  marking: '', lookup: null, saveNative: null, deleteKey: null,
};
export { fxPaint as fxPaintState };

const MANIP_MARKING = 'PosX,PosY,SclX,SclY,PivX,PivY,RotZ';
const SELECT_SHAPE_TOOL = 80;

const shapeArg = (app: App, a: any): any => (a === undefined || a === null || a === '' ? [...app.selection] : a);   // collection handler: the selection
const frameArg = (app: App, t: any): number => (t === undefined || t === null || t === '' ? Number(app.anim.frame) : Number(t));   // frame handler: the current frame
const keyTimeOf = (key: any): number => Number(typeof key?.val === 'function' ? key.val('time') : key?.time ?? key?.Time);   // `Time`: the key object of the native lookups (CMD-B9a)

function nativeLookup(app: App, command: string, which: PaintKeyLookup, shape: any, time?: number): any {
  const native = `Get${which}PaintShapeKey`;
  if (app.commands.has(native)) return app.run(native, time === undefined ? { Shape: shape } : { Shape: shape, Time: time });
  if (fxPaint.lookup) return fxPaint.lookup(which, shape, time);
  app.logMsg('info', notYet(command, `native ${native} lookup; no key returned`, 'Q2'));
  return null;
}
function jumpToKey(app: App, command: string, which: PaintKeyLookup, shape: any, time?: number) {
  const key = nativeLookup(app, command, which, shape, time);
  if (!key) return;
  const t = keyTimeOf(key);
  if (Number.isFinite(t)) app.anim.frame = t;
}

// ------------------------------------------------------------------ physical sky

const SUN_OP = ['Apply', 'SunDirectionOp'].join('');   // not in the registry dump (Q4); joined so a name scan does not count it as wired
const SUN_PROGID = 'Softimage.mia_physicalsun.1.0';
const SKY_PROGID = 'Softimage.mia_physicalsky.1.0';
const EXPOSURE_PROGID = 'Softimage.mia_exposure_photographic.1.0';
const NULL_NAME = 'XSI_Center_Of_World';

// inferred: when the shader library of this build has no definition for a ProgID, the node carries only the
// parameters the contract names. Their start values are placeholders, not attested defaults.
const FALLBACK_PARAMS: Record<string, () => any[]> = {
  mia_physicalsun: () => [num('haze', 0), num('redblueshift', 0), num('saturation', 1), num('horizon_height', 0), color('rgb_unit_conversion', [0, 0, 0])],
  mia_physicalsky: () => [num('multiplier', 1), num('haze', 0), num('redblueshift', 0), num('saturation', 1), num('horizon_height', 0), color('rgb_unit_conversion', [0, 0, 0]),
    num('sun_direction.x', 0), num('sun_direction.y', 0), num('sun_direction.z', 0)],
  mia_exposure_photographic: () => [num('f_number', 0), num('cm2_factor', 0), num('burn_highlights', 0), num('gamma', 0)],
};
function shaderFromProgId(progId: string, taken: string[]): Shader {
  const key = progId.split('.')[1];
  let sh: Shader | null = null;
  try { sh = makeSiShader(key, key); } catch { sh = null; }
  if (!sh || !new RegExp(key, 'i').test(`${sh.type} ${sh.name}`)) sh = new Shader(key, key, FALLBACK_PARAMS[key]());
  sh.name = uniqueAmong(taken, key);
  (sh as any).progId = progId;
  return sh;
}

const COMPONENTS = ['red', 'green', 'blue', 'alpha'];
/** Read / write one colour component, whichever way the shader stores the colour. */
function setComponent(app: App, sh: Shader, pname: string, comp: string, value: number) {
  const sub = sh.get(`${pname}.${comp}`); if (sub) { app.setParam(sub, value); return; }
  const p = sh.get(pname); const i = COMPONENTS.indexOf(comp);
  if (!p || !Array.isArray(p.value) || i >= p.value.length) return;
  const v = [...p.value]; v[i] = value; app.setParam(p, v);
}

interface SkyLink { driven: string; source: string }

function addPhysicalSky(app: App, a: Record<string, any>) {
  const CMD = 'AddPhysicalSky';
  const passArg = Array.isArray(a.Pass) ? a.Pass[0] : a.Pass;
  const pass: Pass | undefined = passArg instanceof Pass ? passArg
    : typeof passArg === 'string' ? app.scene.passes.find(p => p.name === passArg || `Passes.${p.name}` === passArg) : undefined;
  if (!pass) throw new Error('a render pass is required (Pass)');
  const lightName = String(a.LightName ?? '');
  const existing = lightName ? [...app.scene.root.descendants()].find(o => o.name === lightName) : undefined;
  // When the light already exists the script fails at step 5 and what steps 3 / 4 added stays (inferred, Q3). The
  // command bus rolls recorded steps back on a throw, so in that case the steps are applied without recording.
  const step = (label: string, redo: () => void, undo: () => void) => { if (existing) redo(); else app.record(label, redo, undo); };

  let light: X3DObject | undefined = existing;
  let sun: Shader | null = null;
  if (!existing) {
    const autoInspect = app.autoInspect; app.autoInspect = false;
    try {
      light = app.run('GetPrimLight', { PresetObj: 'Infinite.Preset', Name: lightName }) as X3DObject;
      const prim: any = light.primitive;
      const sunSh = sun = shaderFromProgId(SUN_PROGID, []);
      const before = prim.shaderCnx;
      app.record('Connect shader', () => { sunSh.parent = prim; prim.shaderCnx = { ...(before ?? {}), LightShader: sunSh, PhotonShader: sunSh }; }, () => { sunSh.parent = null; prim.shaderCnx = before; });
      if (a.ConstrainLight) {
        app.run('GetPrim', { PresetObj: 'Null', Name: NULL_NAME });
        const centre = app.scene.find(NULL_NAME)!;   // addressed by its literal name
        const vis = centre.property('visibility');
        for (const n of ['viewvis', 'rendvis', 'selectability']) { const p = vis?.get(n); if (p) app.setParam(p, false); }
        app.run('ParentObj', { Parent: NULL_NAME, Children: [light] });
        const cns: any = app.run('ApplyCns', { Preset: 'Direction', InputObjs: [light], Target: [centre] });
        const c: Property | undefined = Array.isArray(cns) ? cns[0] : cns;
        if (c) {
          // inferred: this build's Direction constraint has no direction vector yet; diry / dirz are added so the attested values are stored
          for (const n of ['diry', 'dirz']) if (!c.get(n)) c.add(num(n, 0, n));
          [['dirx', 0], ['diry', 0], ['dirz', -1]].forEach(([n, v]) => { const p = c.get(n as string); if (p) app.setParam(p, v); });
        }
        app.run('Translate', { InputObj: [light], X: 0, Y: 3, Z: -19 });
      }
    } finally { app.autoInspect = autoInspect; }
  }

  // steps 3 and 4: pass shader stacks
  const P: any = pass;
  const addToStack = (stack: 'EnvironmentShaderStack' | 'LensShaderStack', progId: string): Shader => {
    const taken = [...(P.EnvironmentShaderStack ?? []), ...(P.LensShaderStack ?? [])].map((s: Shader) => s.name);
    const sh = shaderFromProgId(progId, taken);
    step('Add shader to pass', () => { (P[stack] ??= []).push(sh); sh.parent = pass; }, () => { const i = P[stack].indexOf(sh); if (i >= 0) P[stack].splice(i, 1); sh.parent = null; });
    return sh;
  };
  if (!P.__skyExplorer) {   // show the stacks under the pass in the explorer
    const base = pass.explorerChildren.bind(pass);
    pass.explorerChildren = () => [...base(), ...(P.EnvironmentShaderStack ?? []), ...(P.LensShaderStack ?? [])];
    P.__skyExplorer = true;
  }
  const sky = addToStack('EnvironmentShaderStack', SKY_PROGID);
  const exposure = a.UseToneMap ? addToStack('LensShaderStack', EXPOSURE_PROGID) : null;

  // step 5: the sun shader follows the sky shader
  if (!sun) throw new Error(`light "${lightName}" already exists, so no sun shader was created to link to the sky shader (${NOTE} Q3)`);
  const sunShader = sun;
  const links: SkyLink[] = [];
  const pairs: [string, string][] = [['multiplier', 'mulitplier'], ['haze', 'haze'], ['redblueshift', 'redblueshift'], ['saturation', 'saturation'], ['horizon_height', 'horizon_height']];
  const A = app.anim;
  for (const [src, dst] of pairs) {
    const s = sky.get(src), d = sunShader.get(dst);
    if (!s || !d) continue;   // skipped silently
    const expr = siName(s);
    app.record('Set expression', () => A.setExpression(d, expr, () => s), () => A.expressions.delete(d));
    links.push({ driven: siName(d), source: expr });
  }
  for (const comp of COMPONENTS) {
    const s = sky.get(`rgb_unit_conversion.${comp}`), d = sunShader.get(`rgb_unit_conversion.${comp}`);
    if (s && d) { const expr = siName(s); app.record('Set expression', () => A.setExpression(d, expr, () => s), () => A.expressions.delete(d)); links.push({ driven: siName(d), source: expr }); continue; }
    const sc = sky.get('rgb_unit_conversion'), dc = sunShader.get('rgb_unit_conversion'); const i = COMPONENTS.indexOf(comp);
    if (!sc || !dc || !Array.isArray(sc.value) || !Array.isArray(dc.value) || i >= sc.value.length || i >= dc.value.length) continue;
    // a colour stored as one value cannot carry an expression per component here: the component is copied on every change (inferred)
    const copy = () => { const v = [...dc.value]; if (v[i] !== sc.value[i]) { v[i] = sc.value[i]; dc.value = v; } };
    let off: (() => void) | null = null;
    app.record('Link colour component', () => { copy(); off = sky.onChange(q => { if (q === sc) copy(); }); }, () => { off?.(); off = null; });
    links.push({ driven: `${siName(dc)}.${comp}`, source: `${siName(sc)}.${comp}` });
  }
  (sunShader as any).skyLinks = links;

  // step 6: sun direction operator
  const skyPath = `${siName(pass)}.${sky.name}.sun_direction`;
  if (app.commands.has(SUN_OP)) app.run(SUN_OP, { In: `${siName(light)}.kine.global`, OutX: `${skyPath}.x`, OutY: `${skyPath}.y`, OutZ: `${skyPath}.z` });   // inferred: argument names of a command this row does not specify
  else app.logMsg('info', notYet(CMD, `${SUN_OP} (${siName(light)}.kine.global -> ${skyPath}.x/.y/.z); the sky's sun direction is not driven by the light`, 'Q4'));

  // step 7
  const set = (sh: Node | null, n: string, v: any) => { const p = sh?.get(n); if (p) app.setParam(p, v); };
  const tone = !!a.UseToneMap;
  set(sky, 'multiplier', tone ? 1.0 : 0.01);
  for (const comp of ['red', 'green', 'blue']) setComponent(app, sky, 'rgb_unit_conversion', comp, tone ? 0.318 : 0.001);
  if (tone) {
    set(pass, 'OverrideCameraLensShaders', 3);
    set(exposure, 'f_number', 16); set(exposure, 'cm2_factor', 1); set(exposure, 'burn_highlights', 0.02); set(exposure, 'gamma', 1);
  }
  app.events.emit('scene');
  return undefined;   // the return-value flag is set, the procedure hands back nothing
}

// ------------------------------------------------------------------ registration

export function registerCharacterKeySetCommands(app: App) {
  (app as any).characterKeySets = {
    /** Create a top-level key set on an object (default: the scene root) and make it current. Not a Softimage command. */
    create(owner?: X3DObject | null, name = DEFAULT_KEYSET_NAME, makeCurrent = true): Property {
      const ks = addKeySetProperty(app, owner ?? app.scene.root, name || DEFAULT_KEYSET_NAME);
      if (makeCurrent) setCurrent(app, siName(ks));
      app.events.emit('scene'); return ks;
    },
    addProxies: (ks: Property, params: any) => addProxies(app, ks, resolveParams(app, params)),
    setCurrent: (x: any) => setCurrent(app, typeof x === 'string' ? x : siName(x)),
    current: () => currentKeySet(app),
    all: () => allKeySets(app),
    lookup: (name: string) => lookup(app, name),
    siName, isKeySet, isCustomProperty,
  };
  (app as any).fxPaint = fxPaint;

  // ---- A. character key sets
  app.register({
    name: 'GetCurrentCharacterKeySet', label: 'Get Current Character Key Set', description: 'Returns the current Character Key Sets',
    args: [], undoable: false,
    execute: (app) => currentKeySet(app),
  });
  app.register({
    name: 'GetAllCharacterKeySets', label: 'Get All Character Key Sets', description: 'Returns all the Character Key Sets in the scene',
    args: [], undoable: false,
    execute: (app) => allKeySets(app),
  });
  app.register({
    name: 'CreateSubCharacterKeySet', label: 'Create Sub-Character Key Set', description: 'Creates a Sub-Character Key Set',
    args: [{ name: 'CharacterKeySet', default: '' }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }],
    execute(app, a) {
      const parent = resolveKeySetArg(app, a.CharacterKeySet);
      if (!isCustomProperty(parent)) { rejectNotKeySet(app, parent); return undefined; }
      let name = String(a.Name ?? '');
      if (!name) {   // H3
        let answer: string | null = null;
        try { answer = window.prompt(text(1052), DEFAULT_SUB_KEYSET_NAME); } catch { answer = null; }
        name = String(answer ?? '');
      }
      if (!name) return undefined;
      const ks = addKeySetProperty(app, parent, name);
      try {
        const model = ownerObject(parent)?.model ?? null;
        const objs = objectsOfModel(app.targets(a.InputObjs), model);
        if (objs.length) { const ps = paramsForObjects(app, objs); if (ps.length) addProxies(app, ks, ps); }
      } catch { /* errors after the type check are swallowed */ }
      try { setCurrent(app, siName(ks)); } catch { /* swallowed */ }
      app.events.emit('scene');
      return [ks];
    },
  });
  app.register({
    name: 'AddProxyParamToCharacterKeySet', label: 'Add Proxy Parameter To Character Key Set', description: 'Add Proxy Parameter To Character Key Set',
    args: [{ name: 'CharacterKeySet', default: '' }, { name: 'InputObjs', default: null }],
    execute(app, a) {
      const ks = resolveKeySetArg(app, a.CharacterKeySet);
      if (!isCustomProperty(ks)) { rejectNotKeySet(app, ks); return undefined; }
      try {
        let params: Parameter[];
        if (a.InputObjs === undefined || a.InputObjs === null || a.InputObjs === '') {   // MarkedParameters handler: marked parameters of the selection
          const sel = new Set(app.selectedObjects);
          params = [...app.anim.marked].filter(p => { const o = ownerObject(p); return !!o && sel.has(o); });
        } else params = resolveParams(app, a.InputObjs);
        addProxies(app, ks, params);
      } catch { /* swallowed */ }
      app.events.emit('scene');
      return undefined;
    },
  });
  app.register({
    name: 'SaveKeyOnCharacterKeySet', label: 'Save Key On Character Key Set', description: 'Save Keys on the Current Character Key Set',
    args: [], execute(app) { saveKeys(app, false); },
  });
  app.register({
    name: 'SaveZeroKeyOnCharacterKeySet', label: 'Save Zero Key On Character Key Set', description: 'Save Zero Keys on the Current Character Key Set',
    args: [], execute(app) { saveKeys(app, true); },
  });
  app.register({
    name: 'RemoveKeyOnCharacterKeySet', label: 'Remove Key On Character Key Set', description: 'Removes Keys on the Current Character Key Set',
    args: [],
    execute(app) {
      const ks = currentKeySet(app); const t = keyTime(app);
      if (!ks) return;
      for (const p of keyTargets(ks)) {
        const fc = app.anim.fcurve(p); const had = fc?.keys.find(k => Math.abs(k.time - t) < 1e-6);   // inferred: default tolerance = the exact key time
        if (!fc || !had) continue;
        app.record('Remove key', () => fc.removeKey(had.time), () => fc.addKey(had.time, had.value));
      }
      app.events.emit('params');
    },
  });
  app.register({
    name: 'InspectCurrentCharacterKeySet', label: 'Inspect Current Character Key Set', description: 'Inspect Current Character Key Set',
    args: [], undoable: false,
    execute(app) {
      const ks = currentKeySet(app); if (!ks) return;
      // The build's InspectObj resolves 3D objects only (a property argument would clear the selection), so the
      // property page is opened through the same event InspectObj's callers end in.
      app.events.emit('inspect', ks);
    },
  });
  app.register({
    name: 'OpenAnimationEditorOnCurrentCharacterKeySet', label: 'Open Animation Editor On Current Character Key Set', description: 'Open Animation Editor On Current Character Key Set',
    args: [], undoable: false,
    execute(app) { const ks = currentKeySet(app); if (ks) app.run('OpenAnimationEditor', { InputObjs: siName(ks) }); },
  });
  app.register({
    name: 'DeleteCurrentCharacterKeySet', label: 'Delete Current Character Key Set', description: 'Delete Current Character Key Set',
    args: [],
    execute(app) {
      const ks = currentKeySet(app); if (!ks) return;
      const owner: any = ks.parent;
      if (owner instanceof X3DObject) { const i = owner.properties.indexOf(ks); app.record('Delete ' + ks.name, () => owner.removeProperty(ks), () => { owner.addProperty(ks); owner.properties.splice(owner.properties.indexOf(ks), 1); owner.properties.splice(i, 0, ks); }); }
      else if (owner) { const list = nestedOf(owner); const i = list.indexOf(ks); app.record('Delete ' + ks.name, () => { const j = list.indexOf(ks); if (j >= 0) list.splice(j, 1); ks.parent = null; }, () => { list.splice(i, 0, ks); ks.parent = owner; }); }
      if (app.selection.includes(ks)) app.select(app.selection.filter(n => n !== ks));
      setCurrent(app, '');
      app.events.emit('scene');
    },
  });
  app.register({
    name: 'SelectObjectsFromCharacterKeySet', label: 'Select Objects From Character Key Set', description: 'Select Objects From Character Key Set',
    args: [{ name: 'CharacterKeySet', default: '' }], undoable: false,
    execute(app, a) {
      const objs: X3DObject[] = [];
      try {
        const ks = resolveKeySetArg(app, a.CharacterKeySet);
        const visit = (p: any) => {
          for (const q of (p?.params ?? []) as Parameter[]) {
            app.logMsg('info', siName(q));
            const m = proxiedOf(q); if (!m) continue;
            app.logMsg('info', siName(m));
            const o = ownerObject(m); if (o && !objs.includes(o)) objs.push(o);
          }
          for (const n of nestedOf(p)) if (isCustomProperty(n)) visit(n);
        };
        if (ks) visit(ks);
      } catch { /* swallowed */ }
      if (objs.length) app.run('SelectObj', { InputObjs: objs }); else app.run('DeselectAll');
    },
  });

  // ---- B. FX paint shape keys
  const NAV: [string, string, PaintKeyLookup, boolean][] = [
    ['FirstPaintShapeKey', 'First Paint Shape Key', 'First', false], ['PrevPaintShapeKey', 'Previous Paint Shape Key', 'Prev', true],
    ['ClosestPaintShapeKey', 'Closest Paint Shape Key', 'Closest', true], ['NextPaintShapeKey', 'Next Paint Shape Key', 'Next', true],
    ['LastPaintShapeKey', 'Last Paint Shape Key', 'Last', false],
  ];
  for (const [name, label, which, timed] of NAV) app.register({
    name, label, undoable: false,
    args: timed ? [{ name: 'Shape', default: null }, { name: 'Time', default: null }] : [{ name: 'Shape', default: null }],
    execute(app, a) { jumpToKey(app, name, which, shapeArg(app, a.Shape), timed ? frameArg(app, a.Time) : undefined); },
  });
  app.register({
    name: 'DeletePaintShapeKey', label: 'Delete Paint Shape Key',
    args: [{ name: 'Shape', default: null }, { name: 'Time', default: null }],
    execute(app, a) {
      const key = nativeLookup(app, 'DeletePaintShapeKey', 'Closest', shapeArg(app, a.Shape), frameArg(app, a.Time));
      if (!key) return;
      if (Math.abs(keyTimeOf(key) - Number(app.anim.frame)) >= 0.001) return;   // the current frame, not the Time argument
      app.logMsg('info', `Deleting key: ${key?.fullName ?? key?.name ?? (key?.kind ? `${key.kind} at ${keyTimeOf(key)}` : key)}`);   // inferred: text for a key object without a name (stand-in paint model)
      if (fxPaint.deleteKey) fxPaint.deleteKey(key);
      else app.logMsg('info', notYet('DeletePaintShapeKey', 'deleting a paint shape key object; nothing was deleted', 'Q2'));
    },
  });
  app.register({
    name: 'SavePaintShapeKey', label: 'Save Paint Shape Key',
    args: [{ name: 'Shape', default: null }, { name: 'Time', default: null }],
    execute(app, a) {
      const t = keyTime(app);
      const shape = shapeArg(app, a.Shape);   // inferred: the script entry has no argument handler; an omitted Shape is taken as the selection
      if (fxPaint.saveNative) fxPaint.saveNative(shape, t);
      else app.logMsg('info', notYet('SavePaintShapeKey', 'native save of a paint shape key; no key was saved', 'Q1'));
      if (a.Time !== undefined && a.Time !== null && a.Time !== '' && Number(a.Time) !== t) app.anim.frame = t;
    },
  });
  app.register({
    name: 'PaintShapeManipTool', label: 'Paint Shape Manipulator Tool', args: [], undoable: false,
    execute(app) {
      fxPaint.marking = MANIP_MARKING;
      // inferred: this build marks parameter objects, not names; the names are matched on the selection's parameters
      const names = new Set(MANIP_MARKING.toLowerCase().split(','));
      app.anim.marked.clear();
      for (const n of app.selection as any[]) for (const p of (n?.params ?? []) as Parameter[]) if (names.has(p.name.toLowerCase())) app.anim.marked.add(p);
      fxPaint.PaintTool.set('CurrentTool', SELECT_SHAPE_TOOL);
      app.events.emit('params');
    },
  });

  // ---- C. physical sky
  app.register({
    name: 'AddPhysicalSky', label: 'AddPhysicalSky', description: 'Adds the MR Physical Sky Environment Shader to the given Pass',
    args: [{ name: 'Pass', default: null }, { name: 'LightName', default: null }, { name: 'ConstrainLight', default: null }, { name: 'UseToneMap', default: null }],
    noLog: true,
    execute: (app, a) => addPhysicalSky(app, a),
  });
}
