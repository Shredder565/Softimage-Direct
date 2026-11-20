// Ledger row CMD-B17g: the script commands of parameters.vbs, tools.vbs, enveloping.vbs and UserDataScripts.vbs
//   RandomizeParameters CreateDisplayInfo SampleParameterValues (SPEC-PARTIAL) ColorizeObject ShadeObject PaintPushTool
//   SelectDeformersFromEnvelope AssociateEnvelopeBoundingVolume CreateUserDataMapAndPickTemplate InspectUserData
// Brief: docs/ghidra/cmd-b17g-parameters-tools-enveloping-userdata-scripts.md sections 2-5 and the cmd-b17g section of
// docs/re/WIRE_CORRECTIONS_B17.md. Original code written from that prose only; no golden exists.
// Replaces the older inferred bodies in anim.ts, viewEditProperty.ts, rigging.ts, model.ts and model2.ts.
//
// How the contract is mapped onto this build:
//  * Pick loops ("until button 0") are pick sessions (miscDsScriptsPick.ts): the command starts the session and
//    returns; every pick arrives through `app.miscDsScripts.session.pick(value, button)` or a viewport click.
//    Single picks that feed a return value use the synchronous PickElement command (app.tasksB11b.pickHook).
//  * Modal dialogs go through `app.cmdB17gh.hooks.inspect(command, property, title)`; without a hook the dialog is
//    taken as OK with the values it shows (stand-in, logged).
//  * The display property of this build stores the wire colour as `wirecolorrgb` (+ the `wirecol` switch): the
//    contract's wirecolorr / wirecolorg / wirecolorb are its three components.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B17g)".
import { App } from '../core/commands';
import { Node, X3DObject, Property, Cluster, Group, Operator } from '../core/scene';
import { Parameter } from '../core/params';
import { num, bool, str } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { findNode, unset, paramsOf, paramOf } from './viewEditPropertyHelpers';
import { listOf } from './tasksB11cShared';
import { startPickSession } from './miscDsScriptsPick';
import { envelopeOfProperty } from './optasksB12cShared';
import { pathOf } from './fcurveLayerMarkingTasks';
import { findParam } from './index';
import { siString } from '../ui/si';

export const ROW_G = 'CMD-B17g';
export const E_ABORT = 0x80004004;   // siErrCancelled

// ------------------------------------------------------------------ shared state (rows CMD-B17g and CMD-B17h)
export interface B17ghState {
  /** Modal dialog hook: return true (OK) / false (Cancel); undefined = no answer (stand-in). */
  hooks: { inspect: ((command: string, prop: Property, title: string) => boolean | undefined) | null };
  /** Dialogs shown: command, property name, title, answer, the values read back. */
  dialogs: { command: string; prop: string; title: string; ok: boolean; values: Record<string, any> }[];
  /** User preferences the scripts save / set / restore that have no store in this build. */
  prefs: Record<string, any>;
  /** Final values of by-reference arguments of the last run of each command. */
  outputs: Record<string, Record<string, any>>;
  /** SampleParameterValues module-level store of the parameter values (RetrieveResult). */
  sampleStore: { param: Parameter; value: any }[];
  /** Progress bars created (caption, max, last value). */
  progress: { caption: string; max: number; value: number }[];
  /** Sample takes (frame, take number, the parameter values of the take). */
  takes: { frame: number; take: number; values: Record<string, any> }[];
  /** VBScript Rnd generator state (24-bit). */
  rnd: number;
  /** Last results by command. */
  last: Record<string, any>;
}
export function b17(app: App): B17ghState {
  const a = app as any;
  return a.cmdB17gh ??= { hooks: { inspect: null }, dialogs: [], prefs: { SI3D_CONSTRAINT_COMPENSATION_MODE: 1 }, outputs: {}, sampleStore: [], progress: [], takes: [], rnd: 0x50000, last: {} } as B17ghState;
}
export const logInfo = (app: App, text: string) => app.logMsg('info', text);
export const logWarning = (app: App, text: string) => app.logMsg('info', 'WARNING: ' + text);
export const logError = (app: App, text: string) => app.logMsg('error', text);
export const logNya = (app: App, command: string, what: string, row = ROW_G) => app.logMsg('info', `${command}: not yet attested: ${what} (${row})`);
/** Dictionary XSISCRIPTS text; `fallback` for ids this build's string table does not hold (inferred wording). */
export const scriptsText = (id: number, fallback = ''): string => siString('XSISCRIPTS', id) ?? fallback;

/** A modal inspect of a temporary property. Returns true = OK. */
export function modal(app: App, command: string, prop: Property, title: string, row = ROW_G): boolean {
  const st = b17(app);
  let ok = st.hooks.inspect?.(command, prop, title);
  if (ok === undefined) { ok = true; logInfo(app, `${command}: modal dialog "${title}" not available in this session; taken as OK with the values shown (stand-in, ${row})`); }
  st.dialogs.push({ command, prop: prop.name, title, ok, values: Object.fromEntries(prop.params.map(p => [p.name, p.value])) });
  return ok;
}

// ------------------------------------------------------------------ small helpers
export const objList = (app: App, v: any): X3DObject[] => {
  const raw = unset(v) ? [...app.selection] : listOf(v);
  const out: X3DObject[] = [];
  for (const x of raw) { const n = findNode(app, x); if (n instanceof X3DObject && !out.includes(n)) out.push(n); }
  return out;
};
/** Adds the parameter when missing (number / bool / string by JS type) and sets it, undoably. */
export function setRec(app: App, n: Node, name: string, value: any, label = 'SetValue') {
  if (!n.get(name)) n.add(typeof value === 'boolean' ? bool(name, value, name) : typeof value === 'string' ? str(name, value, name) : num(name, Number(value), name));
  app.setParam(n.get(name)!, value, label);
}
/** `Custom_parameter_list` property (an unattached one when `owner` is null). */
export function customParamSet(app: App, owner: X3DObject | Cluster | null, name: string, defs: any[] = []): Property {
  const p = new Property(name, 'customparamset', defs); (p as any).preset = 'Custom_parameter_list'; p.shared = false;
  if (owner) app.record('AddProp ' + name, () => { owner.addProperty(p); }, () => { owner.removeProperty(p); });
  return p;
}
/** Deletes a property from its owner (undoable). */
export function deleteProp(app: App, p: Property) {
  const owner = p.parent as any; if (!owner?.removeProperty) return;
  const at = owner.properties.indexOf(p);
  app.record('DeleteObj ' + p.name, () => owner.removeProperty(p), () => { owner.properties.splice(Math.max(0, at), 0, p); p.parent = owner; });
}
const isParam = (x: any): x is Parameter => !!x && typeof x === 'object' && 'def' in x && 'owner' in x;
/** The X3DObject owning a parameter (through its parameter set chain). */
function ownerObject(p: Parameter): X3DObject | null { let n: any = p.owner; while (n && !(n instanceof X3DObject)) n = n.parent; return n ?? null; }
/** Marking-style path of a parameter relative to its object ("kine.local.posx"). */
function relPath(p: Parameter): string { const o = ownerObject(p); const full = pathOf(p); return o && full.startsWith(o.name + '.') ? full.slice(o.name.length + 1) : full; }

/** Marked parameters argument (handler 0x10042): a list / string of parameters, the marking when not given. */
function markedParams(app: App, v: any): Parameter[] {
  if (unset(v) || (Array.isArray(v) && !v.length)) return [...app.anim.marked];
  const out: Parameter[] = [];
  for (const x of listOf(v)) {
    if (isParam(x)) { out.push(x); continue; }
    for (const s of String(x).split(',').map(t => t.trim()).filter(Boolean)) {
      const p = findParam(app, s) ?? paramsOf(app, app.selectedObjects, s).found[0];
      if (p && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

// ------------------------------------------------------------------ VBScript Rnd / Randomize (published LCG)
// The generator is the documented Visual Basic Rnd linear congruential generator (Microsoft KB 231847:
// x = (x * 1140671485 + 12820163) mod 2^24, Rnd = x / 2^24). The seeding of Rnd(negative) and Randomize n follows the
// commonly published description (float bits of the argument folded into the 24-bit state); bit-exact agreement with
// VBScript is not verified (no golden).
function rnd(app: App): number { const st = b17(app); st.rnd = (Math.imul(st.rnd, 1140671485) + 12820163) & 0xffffff; return st.rnd / 0x1000000; }
function rndSeedNegative(app: App, v: number) {
  const f = new DataView(new ArrayBuffer(4)); f.setFloat32(0, v); const b = f.getUint32(0);
  b17(app).rnd = ((b & 0xffffff) + (b >>> 24)) & 0xffffff;
}
function randomize(app: App, v: number) {
  const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, v); const h = d.getUint32(0);
  const st = b17(app); st.rnd = (st.rnd & 0xff00ff) | ((((h ^ (h >>> 16)) & 0xffff) << 8) & 0xffff00);
  st.rnd &= 0xffffff;
}

/** GetParamRange (helper not read; inferred: suggested min / max, falling back to the hard min / max). */
function paramRange(p: Parameter): [number, number] | null {
  const d = p.def;
  if (d.uimin !== undefined && d.uimax !== undefined) return [d.uimin, d.uimax];
  if (d.min !== undefined && d.max !== undefined) return [d.min, d.max];
  if (d.type === 'bool') return [0, 1];
  return null;
}

// ------------------------------------------------------------------ RandomizeParameters
function randomizeParameters(app: App, a: Record<string, any>) {
  const C = 'RandomizeParameters';
  const params = markedParams(app, a.params);
  if (!params.length) { logInfo(app, 'No valid parameter marking selection'); throw new SiStatusError(E_ABORT, `${C}: No valid parameter marking selection`); }
  const pct = Number(a.percentage ?? 0.5); const relative = a.relative === true || a.relative === 1 || /^true$/i.test(String(a.relative));
  const seed = Math.trunc(Number(a.seed ?? 0)) || 0;
  if (seed === 0) randomize(app, Date.now() / 1000);              // fully random
  else if (seed < 0) { rndSeedNegative(app, seed); randomize(app, -seed); }   // repeatable sequence
  for (const p of params) {
    const range = paramRange(p);
    if (!range) { logNya(app, C, `the UI range of ${pathOf(p)} (GetParamRange not read; the parameter has no range in this build); left unchanged`); continue; }
    const [min, max] = range; const half = pct * (max - min) * 0.5;
    if (p.def.type === 'bool') { app.setParam(p, rnd(app) > 0.5, C); continue; }
    if (typeof p.value !== 'number') { logNya(app, C, `randomizing the non-numeric parameter ${pathOf(p)}`); continue; }
    const r = rnd(app) * 2 - 1;
    const base = relative ? Number(p.value) : (min + max) / 2;
    let v = r * half + base;
    if (!(v > min && v < max)) v = v < min ? min : max;
    app.setParam(p, v, C);
  }
  return undefined;
}

// ------------------------------------------------------------------ CreateDisplayInfo
/** Proxy parameter of `src` on the property set (AddProxyParam <set>, "<obj>.<param>"). */
function addProxy(app: App, set: Property, src: Parameter): Parameter {
  const name = set.get(src.def.name) ? `${src.def.name}${set.params.length}` : src.def.name;
  const def = { ...src.def, name, value: src.value };
  const proxy = set.add(def); (proxy as any).proxied = src;
  const text = pathOf(src);
  app.record('AddProxyParam', () => { app.anim.setExpression(proxy, text, s => (s === text ? src : findParam(app, s))); }, () => { app.anim.expressions.delete(proxy); const i = set.params.indexOf(proxy); if (i >= 0) set.params.splice(i, 1); });
  return proxy;
}
function createDisplayInfo(app: App, a: Record<string, any>): Property[] {
  const C = 'CreateDisplayInfo';
  const out: Property[] = [];
  const marking = [...app.anim.marked].map(relPath);   // GetMarking
  if (!marking.length) return out;
  const name = unset(a.PsetName) ? 'DisplayInfoMarkedParams' : String(a.PsetName);
  const inputs = unset(a.InputObj) ? [...app.selection] : listOf(a.InputObj).map(x => findNode(app, x)).filter((n): n is Node => !!n);
  for (const n of inputs) {
    try {
      // SIAddProp "Custom_parameter_list", <obj>, siNodePropagation, PsetName; not a 3D object or cluster -> Scene_Root
      const host: X3DObject | Cluster = n instanceof X3DObject || n instanceof Cluster ? n : app.scene.root;
      const set = customParamSet(app, host, name); out.push(set);
      const obj = n instanceof X3DObject ? n : n instanceof Cluster ? n.obj : null;
      for (const rel of marking) {
        const src = obj ? paramOf(obj, rel) : undefined;   // "<obj>.<marked param>"
        if (src) addProxy(app, set, src);
      }
    } catch { /* errors ignored */ }
  }
  const show = a.ShowDisplayInfo === undefined ? true : !!a.ShowDisplayInfo && a.ShowDisplayInfo !== 'false';
  const ci = findParam(app, 'Camera.camvis.custominfo');
  if (ci) app.setParam(ci, show, C);
  else { b17(app).last.custominfo = show; logNya(app, C, `SetValue "Camera.camvis.custominfo", ${show}: the camera visibility property of this build has no custominfo parameter on the scene camera; kept as app.cmdB17gh.last.custominfo`); }
  b17(app).last[C] = out;
  return out;
}

// ------------------------------------------------------------------ SampleParameterValues (SPEC-PARTIAL)
function sampleParameterValues(app: App, a: Record<string, any>): number {
  const C = 'SampleParameterValues'; const st = b17(app);
  let taken = 0;
  const method = Math.trunc(Number(a.SamplingMethod ?? 0));
  const nb = Math.max(1, Math.trunc(Number(a.NbSamples ?? 3)));
  const relative = a.Relative === true || /^true$/i.test(String(a.Relative));
  let pct = Number(a.Percentage ?? 0.25);
  const seed = Math.trunc(Number(a.Seed ?? 8457));
  // 1. display-params flag: CaptureMethod equals the "capture" constant (constant values not read)
  const flag = false;
  logNya(app, C, `which CaptureMethod value ("${a.CaptureMethod}") is the capture / capture plain / render method; the display-params flag is taken as False`);
  if (!relative) pct = 1.0;
  // 2. temporary display-info set holding the proxies of the marked parameters
  const sets = app.run('CreateDisplayInfo', { InputObj: a.InputObj, PsetName: 'DisplayInfoBracketParams', ShowDisplayInfo: flag }) as Property[];
  const proxySet = sets?.[0];
  const params: Parameter[] = proxySet ? proxySet.params.map(p => (p as any).proxied as Parameter).filter(Boolean) : [...app.anim.marked];
  // 3. frame and capture options
  const frame = app.anim.frame;
  logNya(app, C, `PrepareSampleParamSnapshot(${a.CaptureMethod}, ${a.CaptureSize}, ${frame}): the capture options it sets up`);
  // 4. restore / store, predicted takes, progress bar
  const retrieve = a.RetrieveResult === true || /^true$/i.test(String(a.RetrieveResult));
  if (retrieve) { for (const s of st.sampleStore) app.setParam(s.param, s.value, C); }
  else st.sampleStore = params.map(p => ({ param: p, value: p.value }));
  const predicted = params.reduce((n, p) => n * (p.def.type === 'bool' ? 2 : nb), 1);
  const take = () => { taken++; st.takes.push({ frame, take: taken, values: Object.fromEntries(params.map(p => [pathOf(p), p.value])) }); };
  let capturedNya = false;
  const capture = () => { take(); if (!capturedNya) { capturedNya = true; logNya(app, C, `the capture of each take (${a.CaptureName}, size ${a.CaptureSize}); takes are counted and their values kept in app.cmdB17gh.takes`); } };
  // inferred: SamplingMethod 0 = bracket, 1 = randomize (the constant values were not read)
  if (method === 0) {
    const bar = { caption: 'Generating Bracket Samples', max: predicted, value: 0 }; st.progress.push(bar);
    const steps = params.map(p => {
      const range = paramRange(p);
      if (p.def.type === 'bool') return [false, true];
      if (!range || typeof p.value !== 'number') return [p.value];
      let [lo, hi] = range;
      if (relative) { const span = (hi - lo) * pct * 0.5; lo = Math.max(range[0], Number(p.value) - span); hi = Math.min(range[1], Number(p.value) + span); }
      // inferred: NbSamples evenly spaced values from min to max (ends included)
      return Array.from({ length: nb }, (_, i) => nb === 1 ? (lo + hi) / 2 : lo + (hi - lo) * i / (nb - 1));
    });
    const combine = (k: number) => {
      if (k === params.length) { capture(); bar.value++; return; }
      for (const v of steps[k]) { app.setParam(params[k], v, C); combine(k + 1); }
    };
    if (params.length) combine(0);
  } else if (method === 1) {
    const bar = { caption: 'Generating Random Samples', max: nb, value: 0 }; st.progress.push(bar);
    for (let i = 0; i < nb; i++) {
      if (params.length) app.run('RandomizeParameters', { params: params, percentage: a.Percentage ?? 0.25, relative, seed: i === 0 ? -seed : 1 });
      capture(); bar.value++;
    }
  } else logNya(app, C, `SamplingMethod ${method}`);
  logNya(app, C, 'the restore of the parameter values and of the capture options after the takes, and the deletion of the temporary DisplayInfoBracketParams set');
  st.last[C] = taken;
  return taken;
}

// ------------------------------------------------------------------ tools.vbs: wire colour / shade pick loops
const DISPLAY_MODES = ['staticsel', 'intsel', 'playbacksel', 'staticunselnear', 'intunselnear', 'playbackunselnear', 'staticunselfar', 'intunselfar', 'playbackunselfar'];
/** MakeLocal "<obj>.display", <propagation>; the existing display property when MakeLocal returns nothing. */
function localDisplay(app: App, o: X3DObject, propagation: 'siNodePropagation' | 'siBranchPropagation'): Property | null {
  let made: any = null;
  try { made = app.run('MakeLocal', { InputObjs: `${o.name}.display`, PropagationType: propagation }); } catch { made = null; }
  const list = listOf(made);
  const d = list.find((n: any) => n instanceof Property && n.type === 'display') as Property | undefined;
  return d ?? o.properties.find(p => p.type === 'display') ?? null;
}
/** inferred: branch propagation is represented by also writing the children's display properties. */
function displayTargets(app: App, o: X3DObject, button: number): Property[] {
  const prop = button === 2 ? 'siBranchPropagation' : 'siNodePropagation';
  const objs = button === 2 ? [o, ...o.descendants()] : [o];
  return objs.map(x => localDisplay(app, x, prop)).filter((d): d is Property => !!d);
}
function pickLoopTool(app: App, C: string, apply: (d: Property) => void) {
  const pickedObj = (v: any): X3DObject | null => { const n = findNode(app, v); return n instanceof X3DObject && n !== app.scene.root ? n : null; };   // SIFilter "SceneObject"
  const session = startPickSession(app, {
    command: C, kind: 'element', filter: 'SceneObject',
    prompt: scriptsText(1152, 'Pick an item to color (Node)'), middlePrompt: scriptsText(1153, 'Pick an item to color (Branch)'),
    fromClick: (_p, pick) => pick?.obj ?? null,
    onPick: (v, button) => {
      const o = pickedObj(v);
      if (!o) { logInfo(app, 'Please select an object'); return true; }
      // button 1 = node propagation, 2 = branch propagation (each write is its own undo step: the pick runs outside a command)
      for (const d of displayTargets(app, o, button)) apply(d);
      logInfo(app, `${C}: ${o.name}`);
      return true;
    },
  });
  b17(app).last[C] = session;
  return undefined;
}
function colorizeObject(app: App, a: Record<string, any>) {
  const rgb = [Number(a.Red) || 0, Number(a.Green) || 0, Number(a.Blue) || 0];
  return pickLoopTool(app, 'ColorizeObject', (d) => {
    // SetValue <obj>.display.wirecolorr / g / b (this build: the wirecolorrgb components)
    const p = d.get('wirecolorrgb'); if (p) app.setParam(p, [rgb[0], rgb[1], rgb[2]], 'ColorizeObject');
    else { setRec(app, d, 'wirecolorr', rgb[0]); setRec(app, d, 'wirecolorg', rgb[1]); setRec(app, d, 'wirecolorb', rgb[2]); }
    // inferred: this build only draws the colour with the wirecol switch on; 0,0,0 is the "Default" entry (switch off)
    const sw = d.get('wirecol'); if (sw) app.setParam(sw, rgb.some(x => x !== 0), 'ColorizeObject');
  });
}
function shadeObject(app: App, a: Record<string, any>) {
  const id = Math.trunc(Number(a.ShadeModeId ?? 8));
  return pickLoopTool(app, 'ShadeObject', (d) => { for (const n of DISPLAY_MODES) setRec(app, d, n, id, 'ShadeObject'); });
}

// ------------------------------------------------------------------ PaintPushTool
function paintPushTool(app: App) {
  const C = 'PaintPushTool';
  const objs = app.selectedObjects;
  const before = new Map(objs.map(o => [o, new Set(o.allProperties())] as const));
  // CreateWeightMap(, , "PushMap") on the selection (this build's CreateWeightMap takes no PropertyName: renamed below)
  app.run('CreateWeightMap', { PropertyName: 'PushMap' });
  const maps: Property[] = [];
  for (const o of objs) for (const p of o.allProperties()) if (p.type === 'weightmap' && !before.get(o)!.has(p)) maps.push(p);
  for (const m of maps) {
    if (m.name !== 'PushMap') { const old = m.name; app.record('Rename', () => { m.name = 'PushMap'; }, () => { m.name = old; }); }
    // weightmapop.weight / wmin / wmax (this build has no separate weight map operator: kept on the map)
    setRec(app, m, 'weight', 0.0, C); setRec(app, m, 'wmin', -1.0, C); setRec(app, m, 'wmax', 1.0, C);
    setRec(app, m, 'red', 70, C); setRec(app, m, 'green', 70, C); setRec(app, m, 'blue', 177, C);
    let owner: any = m.parent; while (owner && !(owner instanceof X3DObject)) owner = owner.parent;
    const ops = owner ? app.run('ApplyOp', { PresetObj: 'Push', ConnectionSet: [owner] }) as Operator[] : [];
    const op = listOf(ops)[0] as Operator | undefined;
    if (op) { setRec(app, op, 'ampl', 2.0, C); (op as any).weightMap = m; }
    if (op) logNya(app, C, `the Push operator modulated by ${m.name}: this build's Push operator ignores the weight map`);
  }
  app.run('PaintTool');
  const brush = (app as any).brushProps?.() as Property | undefined;
  const r = brush?.get('radius');
  if (r) app.setParam(r, 1.0, C); else logNya(app, C, 'SetValue "BrushProperties.Radius", 1.0: no brush properties in this session');
  b17(app).last[C] = maps;
  return undefined;
}

// ------------------------------------------------------------------ enveloping.vbs
function selectDeformersFromEnvelope(app: App, a: Record<string, any>) {
  const defs: X3DObject[] = [];
  for (const o of objList(app, a.InputObjs)) {
    if (!o.primitive) continue;   // active primitive geometry
    for (const c of o.clusters.filter(k => k.compKind === 'pnt'))
      for (const p of c.properties) { const env = envelopeOfProperty(p); if (env) defs.push(...env.deformers); }   // duplicates possible
  }
  if (defs.length) app.run('SelectObj', { InputObjs: defs });   // this build's SelectObj names its list argument InputObjs
  else logInfo(app, 'No envelope deformers found');
  return undefined;
}
const isChainElement = (o: X3DObject) => o.type === 'root' || o.type === 'bone' || o.type === 'eff';
const isImplicit = (o: X3DObject) => o.type === 'implicit';
/** `<deformer>.BoundVol.<type>` group (this build has none on chain elements: created on first use; inferred). */
export function boundVolGroup(def: X3DObject, type: string): Group {
  const bv = ((def as any).boundVol ??= {}) as Record<string, Group>;
  if (!bv[type]) { const g = new Group(type); g.parent = def as any; (g as any).boundVolOf = def; bv[type] = g; }
  return bv[type];
}
function associateEnvelopeBoundingVolume(app: App, a: Record<string, any>) {
  const C = 'AssociateEnvelopeBoundingVolume';
  const type = unset(a.BndVolType) ? 'Inclusive' : String(a.BndVolType);
  const inputs = objList(app, a.InputObjs);
  const expanded: X3DObject[] = []; for (const o of inputs) for (const x of [o, ...o.descendants()]) if (!expanded.includes(x)) expanded.push(x);   // SelectChildNodes(InputObjs, False)
  const deformers = expanded.filter(isChainElement);   // SIFilter "chain_element"
  if (deformers.length) {
    startPickSession(app, {
      command: C, kind: 'element', filter: 'implicit',
      prompt: scriptsText(1074, 'Pick Bounding Object(s) to Associate'), middlePrompt: scriptsText(1075, 'Pick Bounding Object(s) to Disassociate'),   // 1075 wording inferred
      fromClick: (_p, pick) => pick?.obj ?? null,
      onPick: (v, button) => {
        const picked = findNode(app, v); if (!(picked instanceof X3DObject)) return true;
        for (const d of deformers) {
          const g = boundVolGroup(d, type);
          if (button === 1) app.run('SIAddToGroup', { Target: g, InputObjs: [picked] });
          else if (button === 2) app.run('RemoveFromGroup', { Target: g, InputObjs: picked.name });
        }
        return true;
      },
    });
    b17(app).last[C] = { mode: 'bounding', deformers };
    return undefined;
  }
  const implicits = expanded.filter(isImplicit);   // SIFilter "implicit"
  if (implicits.length) {
    startPickSession(app, {
      command: C, kind: 'element', filter: 'chain_element',
      prompt: scriptsText(1076, 'Pick Deformer(s) to Associate'), middlePrompt: scriptsText(1077, 'Pick Deformer(s) to Disassociate'),
      fromClick: (_p, pick) => pick?.obj ?? null,
      onPick: (v, button) => {
        const picked = findNode(app, v); if (!(picked instanceof X3DObject)) return true;
        const g = boundVolGroup(picked, type);
        if (button === 1) app.run('SIAddToGroup', { Target: g, InputObjs: implicits });
        else if (button === 2) app.run('RemoveFromGroup', { Target: g, InputObjs: implicits });
        return true;
      },
    });
    b17(app).last[C] = { mode: 'deformers', implicits };
    return undefined;
  }
  b17(app).last[C] = { mode: 'none' };
  return undefined;
}

// ------------------------------------------------------------------ UserDataScripts.vbs
function createUserDataMapAndPickTemplate(app: App, a: Record<string, any>): Property[] {
  const text = scriptsText(1162, 'Pick Template');
  const r = app.run('PickElement', { SelFilter: 'property', LeftMessage: text, MiddleMessage: text }) as { PickedElement: any; ButtonPressed: number } | undefined;
  const picked = r?.PickedElement ? findNode(app, r.PickedElement) ?? r.PickedElement : null;
  if (!picked || !r?.ButtonPressed) { logInfo(app, "You haven't picked a template (make sure to pick the name not the icon)"); return []; }
  if (!(picked instanceof Property) || picked.type !== 'customparamset') { logInfo(app, 'Wrong type of property for a template'); return []; }
  return app.run('CreateUserDataMap', { InputObj: a.InputObj, PropertyName: unset(a.PropertyName) ? 'UserData' : a.PropertyName, Template: picked }) ?? [];
}
const SUB_KIND: Record<string, 'pnt' | 'edge' | 'poly'> = { point: 'pnt', edge: 'edge', polygon: 'poly' };
/** The selected sub-component as "<obj>.<kind>[i,j]" (this build keeps components in app.compSel). */
function selectedSubComponent(app: App): { text: string; obj: X3DObject; kind: string; items: string[] } | null {
  for (let i = app.selection.length - 1; i >= 0; i--) {
    const x: any = app.selection[i];
    if (typeof x === 'string') { const m = /^(.+?)\.(pnt|poly|edge|sample)\[(.*)\]$/.exec(x); const o = m ? findNode(app, m[1]) : null; if (m && o instanceof X3DObject) return { text: x, obj: o, kind: m[2], items: m[3].split(',').map(s => s.trim()) }; }
  }
  const cs = app.compSel; if (!cs) return null;
  const kind = SUB_KIND[cs.kind]; if (!kind) return null;
  const items = [...(kind === 'pnt' ? cs.points : kind === 'edge' ? cs.edges : cs.polygons)].map(String);
  if (!items.length) return null;
  return { text: `${cs.obj.name}.${kind}[${items.join(',')}]`, obj: cs.obj, kind, items };
}
function inspectUserData(app: App, _a: Record<string, any>) {
  // reads the global Selection, not InputObjs (WIRE_CORRECTIONS_B17)
  const sub = selectedSubComponent(app);
  let map: Property | null = null;
  for (let i = app.selection.length - 1; i >= 0 && !map; i--) { const n = app.selection[i]; if (n instanceof Property && n.type === 'userdatamap') map = n; }
  if (!sub) { logError(app, 'No components have been selected'); return undefined; }
  if (!map) {
    // FindUDM (helper not read; inferred): a user data map on a cluster of the same kind holding the components
    for (const c of sub.obj.clusters) {
      if (c.compKind !== sub.kind) continue;
      const els = new Set([...c.elements].map(String));
      const udm = c.properties.find(p => p.type === 'userdatamap');
      if (udm && sub.items.every(i => els.has(i))) { map = udm; break; }
    }
    if (!map) { logError(app, 'No suitable User Data Map could be found'); return undefined; }
  }
  return app.run('SIInspectUserData', { UserDataMap: map, SubComp: sub.text });
}

// ------------------------------------------------------------------ registration
type Arg = { name: string; default: any };
const A = (...l: [string, any][]): Arg[] => l.map(([name, d]) => ({ name, default: d }));
export function registerParamsToolsB17gCommands(app: App) {
  b17(app);
  app.register({ name: 'RandomizeParameters', label: 'Randomize Marked Parameters', category: 'Property', description: 'Randomize the marked parameters', args: A(['params', null], ['percentage', 0.5], ['relative', false], ['seed', 0]), execute: randomizeParameters });
  app.register({ name: 'CreateDisplayInfo', label: 'Create DisplayInfo from Marked Parameters', category: 'Property', description: 'Create a display info property set from the marked parameters', args: A(['InputObj', null], ['PsetName', 'DisplayInfoMarkedParams'], ['ShowDisplayInfo', true]), execute: createDisplayInfo });
  app.register({ name: 'SampleParameterValues', label: 'Sample Parameter Values ', category: 'Property', description: 'Sample the values of the marked parameters', args: A(['InputObj', null], ['SamplingMethod', 0], ['NbSamples', 3], ['Percentage', 0.25], ['Relative', false], ['Seed', 8457], ['CaptureMethod', '0'], ['CaptureName', 'C:\\Temp\\sample'], ['CaptureSize', 100], ['RetrieveResult', false], ['ResultId', 1]), execute: sampleParameterValues });
  app.register({ name: 'ColorizeObject', label: 'Wire Color Tool', category: 'Viewing', description: 'Pick objects to set their wireframe colour', undoable: false, args: A(['Red', 0], ['Green', 0], ['Blue', 0]), execute: colorizeObject });
  app.register({ name: 'ShadeObject', label: 'Shade Object Tool', category: 'Viewing', description: 'Pick objects to set their display mode', undoable: false, args: A(['ShadeModeId', 8]), execute: shadeObject });
  app.register({ name: 'PaintPushTool', label: 'Paint Push Tool', category: 'Modeling|Paint', description: 'Push map, Push operator and the paint tool', args: [], execute: paintPushTool });
  app.register({ name: 'SelectDeformersFromEnvelope', label: 'Select Deformers from Envelope', category: 'Deformation|Envelope', description: 'Select the deformers of the envelopes of the input objects', args: A(['InputObjs', null]), undoable: false, execute: selectDeformersFromEnvelope });
  app.register({ name: 'AssociateEnvelopeBoundingVolume', label: 'Associate Envelope Inclusive Bounding Volume', category: 'Deformation|Envelope', description: 'Associate bounding volumes with envelope deformers', undoable: false, args: A(['InputObjs', null], ['BndVolType', 'Inclusive']), execute: associateEnvelopeBoundingVolume });
  app.register({ name: 'CreateUserDataMapAndPickTemplate', label: 'Create Templated User Data Property', category: 'Property', description: 'Create a user data map with a picked template', args: A(['InputObj', null], ['PropertyName', 'UserData']), execute: createUserDataMapAndPickTemplate });
  app.register({ name: 'InspectUserData', label: 'Inspect User Data Command', category: 'Property', description: 'Inspect the user data of the selected components', undoable: false, args: A(['InputObjs', null]), execute: inspectUserData });
}
