// Ledger rows CMD-B17e (animation.vbs: external constraints, marking sets) and CMD-B17f (primitives.vbs preset models
// and deformer control objects, particle.vbs soft body / cloth / particle shader / forces).
// Brief: the "Wire contract" sections of docs/ghidra/cmd-b17e-animation-action-scripts.md (section 2 only; the six
// action.vbs commands of section 3 are LOCK and untouched) and docs/ghidra/cmd-b17f-primitives-particle-scripts.md,
// plus the cmd-b17e / cmd-b17f items of docs/re/WIRE_CORRECTIONS_B17.md. Original code written from that prose only;
// no XSIBATCH golden exists.
//
// These registrations replace the earlier inferred bodies (anim.ts marking sets and external constraints,
// animateSurface.ts external-constraint handlers, presets.ts GetPresetModel, model.ts GetPrimLattice /
// GetPrimVolumeDeform / GetPrimWave / CreateForce, moduleToolbar.ts ApplySoftBody / ApplyCloth / ApplyParticleShader).
// Mapping onto this build:
//  * Every script call the contract makes is traced in `app.cmdB17ef.calls` (command, the callee, its arguments) and
//    runs on the command bus where this build has the callee; otherwise the step is produced here directly.
//  * The "you need to..." errors are logged with siError severity (logMsg 'error'); siErrCancelled is thrown as
//    CommandCancelled.
//  * Parts the contract marks (inferred) are marked `// inferred` here; parts that cannot be settled log
//    "<command>: not yet attested: <what> (CMD-B17e|CMD-B17f)".
import { App } from '../core/commands';
import { Node, X3DObject, Model, Null, Primitive, Property, Constraint, Operator } from '../core/scene';
import { Parameter, num, str } from '../core/params';
import * as S2 from '../core/scene2';
import { siString } from '../ui/si';
import { CommandCancelled } from './duplicateRenderingSimulationScriptsShared';
import { simEnvironment, type SimContainer } from './duplicateRenderingSimulationScriptsSimulation';
import { findNode, paramsOf } from './viewEditPropertyHelpers';
import { siName } from './characterKeySets';
import { getPlayControl, factoryPath } from './uixsiPrefsIceViewsHelpers';
import { pref } from './uixsiKeysSourcesMaterialsShared';
import { makeClothOperator, makeClothProperty } from './clothPpg';
import { loadPreset, bundledPresetFile } from './presets';

const NOTE_E = 'docs/ghidra/cmd-b17e-animation-action-scripts.md';
const NOTE_F = 'docs/ghidra/cmd-b17f-primitives-particle-scripts.md';

export interface B17efCall { command: string; call: string; args: any[] }
export interface B17efState {
  calls: B17efCall[];
  /** Yes/No question hook (CreateMarkingSet overwrite question); returns true for Yes. */
  ask: ((text: string, title: string) => boolean) | null;
  out: Record<string, Record<string, any>>;
  /** The "expand marking" helper, for checks. */
  expand?: (list: string[]) => string[];
}
export function b17ef(app: App): B17efState {
  return ((app as any).cmdB17ef ??= { calls: [], ask: null, out: {} } as B17efState);
}
const show = (x: any): any => Array.isArray(x) ? x.map(show) : x instanceof Parameter || x instanceof Node ? siName(x as any) : x;
function trace(app: App, command: string, call: string, ...args: any[]) {
  const st = b17ef(app); st.calls.push({ command, call, args: args.map(show) });
  if (st.calls.length > 1000) st.calls.shift();
}
const nya = (app: App, command: string, what: string, note: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${note})`);
const siError = (app: App, text: string) => app.logMsg('error', text);
const unset = (v: any) => v === undefined || v === null || v === '';
const truthy = (v: any) => v === true || v === 1 || v === -1 || /^(true|1|-1)$/i.test(String(v ?? ''));

/** A collection argument: unset = the selection (the registry's Collection handler), else the named nodes. */
function collection(app: App, arg: any, selectionDefault = true): Node[] | null {
  if (unset(arg)) return selectionDefault ? [...app.selection] : null;
  const out: Node[] = [];
  const add = (x: any) => {
    if (Array.isArray(x)) { x.forEach(add); return; }
    if (x instanceof Node) { if (!out.includes(x)) out.push(x); return; }
    if (typeof x === 'string') for (const s of x.split(',').map(t => t.trim()).filter(Boolean)) { const n = findNode(app, s); if (n && !out.includes(n)) out.push(n); }
  };
  add(arg);
  return out;
}
const sceneObjects = (list: Node[]) => list.filter((n): n is X3DObject => n instanceof X3DObject);
const GEOMETRY = new Set(['polymsh', 'surfmsh', 'crvlist', 'cloud', 'hair', 'pointcloud']);
const isGeometry = (n: Node): n is X3DObject => n instanceof X3DObject && !!n.primitive && GEOMETRY.has(String(n.type));

/** AutoInspect <obj>, , , <keywords>: shows the page when the auto-inspect preference is on. */
function autoInspect(app: App, command: string, target: Node | Node[] | null | undefined, keywords?: string) {
  if (!target || (Array.isArray(target) && !target.length)) return;
  trace(app, command, 'AutoInspect', target, keywords ?? '');
  const first = Array.isArray(target) ? target[0] : target;
  if (app.autoInspect) app.events.emit('inspect', first);
}
/** SelectFilter siConditionalObjectFilter; SelectObj <obj>. */
function selectAsObject(app: App, command: string, obj: Node) {
  trace(app, command, 'SelectFilter', 'siConditionalObjectFilter');
  if (app.commands.has('SelectFilter')) app.run('SelectFilter', { SelFilter: 'siConditionalObjectFilter' });
  trace(app, command, 'SelectObj', obj);
  app.select([obj]);
}

// ======================================================================= CMD-B17e: marking sets
const MARKING_SET = 'MarkingSet';
const OP = { Select: 0, Mute: 1, UnMute: 2, Toggle: 3, Delete: 4 } as const;

/** The relative marking (GetMarking): each marked parameter's path below its owning object. */
function currentMarking(app: App): string[] {
  const out: string[] = [];
  for (const p of app.anim.marked) {
    let o: any = p.owner; while (o && !(o instanceof X3DObject)) o = o.parentObj ?? o.parent;
    const full = siName(p); const head = o ? siName(o) + '.' : '';
    const rel = head && full.startsWith(head) ? full.slice(head.length) : full;
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}
/** The "expand marking" helper: compound kinematic paths become their scalar channels. */
export function expandMarking(list: string[]): string[] {
  const out: string[] = [];
  const xyz = (stem: string, ch: string) => ['x', 'y', 'z'].map(a => `${stem}.${ch}${a}`);
  for (const entry of list.flatMap(s => String(s).split(',')).map(s => s.trim()).filter(Boolean)) {
    const m = /^(kine\.(?:local|global))(?:\.(pos|ori|ori\.euler|scl))?$/i.exec(entry);
    if (!m) { out.push(entry); continue; }
    const stem = m[1]; const part = (m[2] ?? '').toLowerCase();
    if (part === 'pos') out.push(...xyz(stem, 'pos'));
    else if (part === 'ori' || part === 'ori.euler') out.push(...xyz(stem, 'rot'));
    else if (part === 'scl') out.push(...xyz(stem, 'scl'));
    else out.push(...xyz(stem, 'pos'), ...xyz(stem, 'rot'), ...xyz(stem, 'scl'));
  }
  return out;
}
const markingSetOf = (o: X3DObject) => o.properties.find(p => p.name === MARKING_SET) ?? null;

/** The "get marking-set property" helper (object, createNew, resetFirst). */
function getMarkingSetProp(app: App, command: string, o: X3DObject, createNew: boolean, resetFirst: boolean): Property | null {
  const found = markingSetOf(o);
  const create = () => {
    trace(app, command, 'SIAddProp', 'Custom_parameter_list', o, 'siNodePropagation', MARKING_SET);
    const r = app.run('SIAddProp', { PresetObj: 'Custom_parameter_list', InputObjs: [o], PropagationType: 'siNodePropagation', PropertyName: MARKING_SET });
    const p = Array.isArray(r) ? r[0] : r;
    const set = p instanceof Property ? p : markingSetOf(o);
    // inferred: a custom parameter list starts empty (this build's generic property stand-in carries an "enabled" flag)
    const extra = set ? [...set.params] : [];
    if (set && extra.length) app.record('Custom_parameter_list', () => { for (const q of extra) set.removeParam(q); }, () => { extra.forEach((q, i) => set.insertParam(q, i)); });
    return set;
  };
  if (found && resetFirst) { trace(app, command, 'DeleteObj', found); app.record('Delete ' + MARKING_SET, () => o.removeProperty(found), () => o.addProperty(found)); return create(); }
  if (found) return found;
  return createNew ? create() : null;
}

function createMarkingSet(app: App, a: Record<string, any>) {
  const C = 'CreateMarkingSet'; const reset = a.Reset === undefined ? true : truthy(a.Reset);
  trace(app, C, 'GetMarking');
  const list = expandMarking(currentMarking(app));
  if (!list.length) { siError(app, 'You need to mark some parameters first'); return undefined; }
  const input = collection(app, a.InputObjs);
  if (!input || !input.length) { siError(app, 'You need to select an object first'); return undefined; }
  const objs = sceneObjects(input);
  trace(app, C, 'SIFilter', input, 'sceneobject');
  if (reset && objs.some(o => markingSetOf(o))) {
    const text = siString('XSISCRIPTS', 1043) ?? '[XSISCRIPTS 1043: text not yet attested]';
    const title = siString('XSISCRIPTS', 1044) ?? '[XSISCRIPTS 1044: text not yet attested]';
    trace(app, C, 'MsgBox', text, 'vbYesNo + vbQuestion', title);
    const st = b17ef(app);
    // inferred: without a dialog hook a batch session answers Yes; an interactive one asks with the browser dialog
    const yes = st.ask ? st.ask(text, title) : (app as any).Interactive === false || typeof window === 'undefined' ? true : window.confirm(`${title}\n\n${text}`);
    if (!yes) throw new CommandCancelled(C);
  }
  const made: Property[] = [];
  for (const o of objs) {
    const set = getMarkingSetProp(app, C, o, true, reset);
    if (!set) continue;
    const prefix = siName(o);
    const paths = list.map(p => `${prefix}.${p}`);
    trace(app, C, 'AddProxyParam', set, paths.join(','));
    app.run('AddProxyParam', { InputObjs: set, Proxied: paths.join(',') });
    made.push(set);
  }
  b17ef(app).out[C] = { sets: made };
  return undefined;   // no return value
}

function activateMarkingSet(app: App) {
  // correction: the input is ignored; the marking is relative to the selection
  trace(app, 'ActivateMarkingSet', 'SetMarking', MARKING_SET);
  app.run('SetMarking', { PathList: MARKING_SET });
  return undefined;
}

/** FindObjectsByMarkingAndCapabilities(marking, siKeyable) over a work set. */
function findByMarkingKeyable(app: App, objs: X3DObject[], marking: string[] | null): Parameter[] {
  const rel = marking ?? currentMarking(app);
  const out: Parameter[] = [];
  for (const o of objs) for (const p of paramsOf(app, [o], rel).found) if (p.keyable && !out.includes(p)) out.push(p);
  return out;
}
/** The parameters keyed through a proxy: the proxied source (inferred: a key on a proxy parameter keys its source). */
const keyed = (ps: Parameter[]) => ps.map(p => ((p as any).proxied instanceof Parameter ? (p as any).proxied : p) as Parameter);

function setKeyUsingMarkingSet(app: App, a: Record<string, any>) {
  const C = 'SetKeyUsingMarkingSet';
  const input = collection(app, a.InputObjs);
  if (!input || !input.length) { siError(app, 'You need to select an object first'); return undefined; }
  let work: X3DObject[];
  if (truthy(a.Branch)) {
    work = [];
    for (const o of sceneObjects(input)) { trace(app, C, 'FindChildren', o, '', 'si3DObjectFamily'); for (const d of o.descendants()) if (!work.includes(d)) work.push(d); }
  } else work = sceneObjects(input);
  const mode = Number(pref(app, 'preferences.animation.save_key_command', 0));
  const time = getPlayControl(app, 'Key');
  trace(app, C, 'Preferences.animation.save_key_command', mode); trace(app, C, 'PlayControl.Key', time);
  const saveKey = (target: string, params: Parameter[]) => {
    trace(app, C, 'SaveKey', target, time);
    if (params.length) app.run('SaveKey', { InputObjs: keyed(params), Time: time });
  };
  if (mode === 0) {
    for (const o of work) {
      const set = markingSetOf(o);
      if (!set || !set.params.length) continue;   // skipped silently
      saveKey(`${siName(o)}/.${MARKING_SET}`, [...set.params]);
    }
  } else if (mode === 1) {
    saveKey('FindObjectsByMarkingAndCapabilities(, siKeyable)', findByMarkingKeyable(app, work, null));
  } else if (mode === 2) {
    const marking = currentMarking(app);
    if (!marking.length) return undefined;   // nothing marked: no-op
    saveKey(`FindObjectsByMarkingAndCapabilities(${marking.join(',')}, siKeyable)`, findByMarkingKeyable(app, work, marking));
  } else throw new CommandCancelled(C);
  return undefined;
}

// ======================================================================= CMD-B17e: external constraints
type OpCode = typeof OP[keyof typeof OP];
const opOf = (s: any): OpCode => {
  const t = String(s ?? '');
  return t === 'Activate' ? OP.UnMute : t === 'Deactivate' ? OP.Mute : t === 'Toggle' ? OP.Toggle : t === 'Remove' ? OP.Delete : OP.Select;
};
function manageExternalConstraints(app: App, command: string, a: Record<string, any>) {
  const input = collection(app, a.InputObj);
  if (!input || !input.length) { app.logMsg('info', 'No valid object selection'); throw new CommandCancelled(command); }
  trace(app, command, 'SIFilter', input, 'sceneobject');
  const objs = sceneObjects(input);
  if (!objs.length) { app.logMsg('info', 'No valid object selection'); throw new CommandCancelled(command); }
  const op = opOf(a.Operation);
  const obj = objs[0];   // correction: the first scene object only
  const model: Model = obj instanceof Model ? obj : (obj.model ?? app.scene.root);
  const scan: X3DObject[] = obj instanceof Model ? [] : [obj];
  trace(app, command, 'FindChildren', model);
  for (const d of model.descendants()) if (!scan.includes(d)) scan.push(d);
  const listText = scan.map(o => siName(o)).join(',');   // the scan list's text form (substring search kept, open question)
  const external = (t: X3DObject) => (t.model?.name ?? app.scene.root.name) !== model.name || !listText.includes(t.parentObj?.name ?? '');
  const found: Constraint[] = []; let upv = 0;
  for (const item of scan) {
    for (const c of item.properties) if (c instanceof Constraint) for (const t of c.targets) if (external(t)) { found.push(c); }
    if (item.type === 'bone') {
      const joint: any = (item as any).joint ?? item;
      const ref = joint.UpVectorReference as X3DObject | null | undefined;
      if (ref instanceof X3DObject && external(ref)) {
        upv++;
        const opPath = `${siName(item)}.SkeletonUpVectorOp`;
        const resplane = (v: number) => {
          // inferred: the joint parameters are kept on the bone in this build (rigScriptsB15eKit convention)
          let p = (joint as Node).get('resplane');
          if (!p) { const def = num('resplane', 0, 'resplane'); app.record('resplane', () => { p = (joint as Node).add(def); }, () => { const i = (joint as Node).params.findIndex(x => x.name === 'resplane'); if (i >= 0) (joint as Node).params.splice(i, 1); }); p = (joint as Node).get('resplane'); }
          trace(app, command, 'SetValue', `${siName(item)}.resplane`, v); if (p) app.setParam(p, v);
        };
        const upOp = item.primitive?.operators.find(o => /SkeletonUpVectorOp/i.test(o.type) || /SkeletonUpVectorOp/i.test(o.name)) ?? null;
        if (op === OP.Mute || op === OP.UnMute) {
          const mute = op === OP.Mute;
          trace(app, command, 'DeactivateAbove', opPath, mute);
          if (upOp) app.run('DeactivateAbove', { Operator: upOp, Mute: mute });
          else nya(app, command, `${opPath} (the skeleton up-vector operator is not modelled in this build)`, NOTE_E);
          if (mute) { const rx = item.kinematics.local.get('rotx'); const keep = rx?.value; resplane(0); if (rx) { trace(app, command, 'SetValue', `${siName(item)}.kine.local.rotx`, keep); app.setParam(rx, keep); } }
          else resplane(2);
        } else if (op === OP.Delete) {
          resplane(0);
          trace(app, command, 'DeleteObj', opPath);
          if (upOp) { const prim = item.primitive!; app.record('Delete ' + opPath, () => prim.removeOperator(upOp), () => prim.addOperator(upOp)); }
          else nya(app, command, `${opPath} (the skeleton up-vector operator is not modelled in this build)`, NOTE_E);
        }
      }
    }
  }
  const list = [...new Set(found)];
  app.logMsg('info', `Found ${list.length} constraints and ${upv} upvectors external to ${model.name}`);
  if (op === OP.Select) { trace(app, command, 'SelectObj', list); app.select(list); }
  else if (op === OP.Delete) {
    trace(app, command, 'DeleteObj', list);
    for (const c of list) { const owner = c.parent as unknown as X3DObject; if (owner && typeof (owner as any).removeProperty === 'function') app.record('Delete ' + c.name, () => owner.removeProperty(c), () => owner.addProperty(c)); }
  } else for (const c of list) {
    const p = c.get('active');
    if (op === OP.Toggle) { trace(app, command, 'ToggleValue', 'active', c); if (p) app.setParam(p, !p.value); }
    else { const v = op === OP.UnMute; trace(app, command, 'SetValue', `${siName(c)}.active`, v); if (p) app.setParam(p, v); }
  }
  b17ef(app).out[command] = { model, constraints: list, upvectors: upv, operation: op };
  app.events.emit('scene');
  return undefined;   // no return value
}

// ======================================================================= CMD-B17f: primitives.vbs
/** GetPresetModel. */
function getPresetModel(app: App, a: Record<string, any>) {
  const C = 'GetPresetModel';
  const modelName = String(a.ModelName ?? ''); const name = String(a.Name ?? ''); const psetName = String(a.PsetName ?? '');
  let root = factoryPath(app).replace(/\\/g, '/'); if (!root.endsWith('/')) root += '/';
  const path = `${root}Data/XSI_SAMPLES/Models/${modelName}.emdl`;
  const saved = app.autoInspect;
  trace(app, C, 'SetUserPref', 'siAutoInspect', false); app.autoInspect = false;
  const finish = (model: X3DObject | null) => {
    trace(app, C, 'SetUserPref', 'siAutoInspect', saved); app.autoInspect = saved;
    if (!model) return null;
    trace(app, C, 'SetValue', `${siName(model)}.Name`, name);
    if (name && model.name !== name) { const old = model.name; const nn = name; app.record('SetValue Name', () => { model.name = nn; }, () => { model.name = old; }); }
    if (psetName) {
      const preset = psetName.includes('.') ? psetName.slice(psetName.lastIndexOf('.') + 1) : psetName;
      trace(app, C, 'GetPrim', 'Null');
      const tmp = new Null(app.scene.uniqueName('null'));
      app.record('GetPrim Null', () => app.scene.root.addChild(tmp), () => app.scene.root.removeChild(tmp));
      trace(app, C, 'AddProp', preset, tmp); app.run('AddProp', { PresetObj: preset, InputObjs: [tmp] });
      trace(app, C, 'DeleteObj', tmp); app.record('DeleteObj null', () => app.scene.root.removeChild(tmp), () => app.scene.root.addChild(tmp));
      const target = `${siName(model)}.${psetName}`;
      trace(app, C, 'InspectObj', target, 'General,CustomPSet');
      const n = findNode(app, target);
      if (n) app.run('InspectObj', { InputObjs: n, Keywords: 'General,CustomPSet' });
      else nya(app, C, `${target}: the exported preset data of this build does not carry the ${psetName} property`, NOTE_F);
    }
    app.events.emit('scene');
    b17ef(app).out[C] = { Value: model, path };
    return model;
  };
  trace(app, C, 'ImportModel', path, a.Parent ?? '');
  // The factory sample models are not shipped; the hierarchies exported from them (public/si/models) stand in.
  const file = bundledPresetFile(modelName);
  if (!file) {
    nya(app, C, `${path} (this sample model is not bundled in this build); nothing imported`, NOTE_F);
    return finish(null);
  }
  const parent = unset(a.Parent) ? null : (a.Parent instanceof X3DObject ? a.Parent : app.scene.find(String(a.Parent)) ?? null);
  return loadPreset(file).then(data => {
    let m: X3DObject | null = null;
    try {
      m = app.run('ImportModel', { FileName: path, Parent: a.Parent ?? '', Data: data }) as X3DObject;
      if (m && parent && m.parentObj !== parent) { const mm = m; const from = mm.parentObj; app.record('Parent', () => { from?.removeChild(mm); parent.addChild(mm); }, () => { parent.removeChild(mm); from?.addChild(mm); }); }
    } catch (e: any) { app.logMsg('error', `${C}: ${e?.message ?? e}`); }
    return finish(m instanceof X3DObject ? m : null);
  }).catch(e => { app.logMsg('error', `${C}: ${e?.message ?? e}`); return finish(null); });
}

/** GetPrimLattice. */
function getPrimLattice(app: App, a: Record<string, any>) {
  const C = 'GetPrimLattice';
  let parent: any = a.Parent ?? '';
  const input = collection(app, a.InputObjs);
  if (input) {
    const geo = input.filter(isGeometry); trace(app, C, 'SIFilter', input, 'geometry');
    if (geo.length === 1) parent = geo[0];
  }
  trace(app, C, 'SIGetPrimLattice', a.PresetObj ?? 'Lattice', input ?? null, a.Name ?? '', parent);
  const r: any = app.run('SIGetPrimLattice', { PresetObj: a.PresetObj || 'Lattice', InputObjs: input ?? null, Name: a.Name ?? '', Parent: parent });
  const lat: X3DObject | null = r?.Value ?? null; const prim = r?.PrimObj ?? null;
  if (!lat) return null;
  selectAsObject(app, C, lat);
  if (prim) autoInspect(app, C, lat, 'General');
  a.PrimObj = prim; b17ef(app).out[C] = { PrimObj: prim, Value: lat };
  return lat;
}

/** GetConnectedPropVolume (helper not read; inferred: the VolumeDeform operators driven by the new object). */
function connectedVolumeOps(app: App, vol: X3DObject): Operator[] {
  const out: Operator[] = [];
  const refers = (op: any) => Object.values(op).some(v => v === vol || (Array.isArray(v) && v.includes(vol)));
  for (const o of app.scene.allObjects()) for (const op of o.primitive?.operators ?? []) if (op !== vol.primitive?.operators[0] && refers(op) && !out.includes(op)) out.push(op);
  return out;
}
function getPrimVolumeDeform(app: App, a: Record<string, any>) {
  const C = 'GetPrimVolumeDeform';
  const input = collection(app, a.InputObjs);
  trace(app, C, 'SIGetPrimVolumeDeform', a.PresetObj ?? 'SphereVolume', input ?? null, a.Name ?? '', a.Parent ?? '');
  const r: any = app.run('SIGetPrimVolumeDeform', { PresetObj: a.PresetObj || 'SphereVolume', InputObjs: input ?? null, Name: a.Name ?? '', Parent: a.Parent ?? '' });
  const obj: X3DObject | null = r?.Value ?? null; const prim = r?.PrimObj ?? null;
  if (!obj) return null;
  selectAsObject(app, C, obj);
  trace(app, C, 'GetConnectedPropVolume', obj);
  const ops = connectedVolumeOps(app, obj);   // inferred
  if (ops.length) autoInspect(app, C, ops); else autoInspect(app, C, obj, 'General');
  a.PrimObj = prim; b17ef(app).out[C] = { PrimObj: prim, Value: obj, operators: ops };
  return obj;
}

const WAVE_CLSID = '{42FC2493-732F-11d2-AC52-00A02485CECB}';
const FORCES = ['Gravity', 'Wind', 'Attractor', 'Vortex', 'Fan', 'Eddy', 'Drag', 'Turbulence', 'ToricForce'];
/** SIGetPrim for the control objects this file needs (wave, forces): a null carrying a primitive of that type. */
function siGetPrim(app: App, command: string, preset: string, name: string, parent: X3DObject | null): X3DObject | null {
  trace(app, command, 'SIGetPrim', preset, name, parent ?? '', 1);
  const isWave = preset === WAVE_CLSID || /^wave$/i.test(preset);
  const force = FORCES.find(f => f.toLowerCase() === preset.toLowerCase());
  if (!isWave && !force) {
    // other presets go through the bus GetPrim
    const r = app.run('GetPrim', { PresetObj: preset, Name: name, Parent: parent ?? '' });
    return r instanceof X3DObject ? r : null;
  }
  const base = isWave ? 'wave' : force!.toLowerCase();
  const o = new Null(app.scene.uniqueName(name || base));
  // inferred: the control parameters of this build's wave / force objects (as before this row)
  if (isWave) { o.add(num('amplitude', 1, 'Amplitude', { keyable: true })); o.add(num('wavelength', 4, 'Wavelength')); o.add(num('phase', 0, 'Phase', { keyable: true })); }
  else { o.add(str('forcetype', force!, 'Force Type', { readOnly: true })); o.add(num('amplitude', 1, 'Amplitude', { keyable: true })); }
  o.setPrimitive(new Primitive(isWave ? 'Wave' : force!, base));
  const p = parent ?? app.scene.root;
  app.record('Add ' + o.name, () => p.addChild(o), () => p.removeChild(o));
  return o;
}

function getPrimWave(app: App, a: Record<string, any>) {
  const C = 'GetPrimWave';
  let parent: X3DObject | null = unset(a.Parent) ? null : (a.Parent instanceof X3DObject ? a.Parent : app.scene.find(String(a.Parent)) ?? null);
  const input = collection(app, a.InputObjs);
  let geo: X3DObject[] | null = null; let single = false;
  if (input) {
    trace(app, C, 'SIFilter', input, 'geometry'); geo = input.filter(isGeometry);
    if (geo.length === 1) { parent = geo[0]; single = true; }
  }
  const wave = siGetPrim(app, C, String(a.PresetObj || 'Wave'), String(a.Name ?? ''), parent);
  const prim = wave?.primitive ?? null;
  if (wave && geo && geo.length) {
    for (const o of geo) {
      trace(app, C, 'ApplyOp', 'Wave', `${siName(o)};${siName(wave)}`);
      const op = o.primitive?.mesh() ? S2.makeMeshDeformOperator2('Wave') : null;
      if (op) { (op as any).inputs = [o, wave]; const pr = o.primitive!; app.record('Apply Wave', () => pr.addOperator(op), () => pr.removeOperator(op)); }
      else nya(app, C, `the Wave deformer on ${siName(o)} (this build deforms polygon meshes only)`, NOTE_F);
    }
    const L = wave.kinematics.local;
    const put = (n: string, v: number) => { const p = L.get(n); if (p) app.setParam(p, v); };
    if (single) {
      trace(app, C, 'Translate', wave, 0, 0, 0, 'siAbsolute', 'siLocal', 'siObj', 'siXYZ');
      trace(app, C, 'Rotate', wave, 0, 0, 0, 'siAbsolute', 'siLocal', 'siObj', 'siXYZ');
      trace(app, C, 'Scale', wave, 1, 1, 1, 'siAbsolute', 'siLocal', 'siObj', 'siXYZ');
      for (const c of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz']) put(c, 0);
      for (const c of ['sclx', 'scly', 'sclz']) put(c, 1);
    } else {
      const avg = [0, 0, 0];
      for (const o of geo) { const e = o.globalMatrix().elements; avg[0] += e[12]; avg[1] += e[13]; avg[2] += e[14]; }   // <obj>.kine.pos (global)
      for (let i = 0; i < 3; i++) avg[i] /= geo.length;
      trace(app, C, 'Translate', wave, avg[0], avg[1], avg[2], 'siAbsolute', 'siLocal', 'siObj', 'siXYZ');
      put('posx', avg[0]); put('posy', avg[1]); put('posz', avg[2]);
    }
  }
  if (wave) {
    selectAsObject(app, C, wave);
    if (prim && prim.type !== 'null') autoInspect(app, C, wave, 'General');
  }
  a.Primitive = prim; b17ef(app).out[C] = { Primitive: prim, Value: wave };
  return wave;
}

// ======================================================================= CMD-B17f: particle.vbs
const simOps = (o: X3DObject) => (o.primitive?.operators ?? []).filter(op => /^(softbodyop|clothop|hairdynamicsop)$/i.test(String(op.type)) || /^(SoftBodyOp|ClothOp|hairDynamicsOp)$/i.test(op.name));

/** The shared part of ApplySoftBody / ApplyCloth (expand, DeformSimulation filter, polymsh / surfmsh only). */
function simulationTargets(app: App, command: string, a: Record<string, any>): X3DObject[] | null {
  const input = collection(app, a.InputObjs);
  // .Expand: groups flattened to their members
  const expanded: Node[] = [];
  for (const n of input ?? []) { const members = (n as any).members; if (Array.isArray(members)) { for (const m of members) if (!expanded.includes(m)) expanded.push(m); } else if (!expanded.includes(n)) expanded.push(n); }
  trace(app, command, 'Expand', input ?? []);
  if (!expanded.length) return null;
  trace(app, command, 'SIFilter', expanded, 'DeformSimulation');
  const filtered = expanded.filter(n => n instanceof X3DObject || (n as any).obj instanceof X3DObject || ((n as any).kind === 'cluster' && (n as any).parent));
  if (!filtered.length) return null;
  const list: X3DObject[] = [];
  for (const it of filtered) {
    let o: any = it;
    if (!(it instanceof X3DObject)) {   // a component item: its sub-component's Parent3DObject
      o = (it as any).obj ?? (it as any).parent?.parentObj ?? (it as any).parent?.parent ?? null;
      if (!(o instanceof X3DObject)) return null;   // no sub-component: return immediately
    }
    if (o.type === 'polymsh' || o.type === 'surfmsh') { if (!list.includes(o)) list.push(o); }
  }
  return list.length ? list : null;
}
function applySimOp(app: App, command: string, opName: 'SoftBodyOp' | 'ClothOp', list: X3DObject[]) {
  trace(app, command, 'ApplyOp', opName, list, 'siNode', 'siPersistentOperation');
  const ops: Operator[] = [];
  for (const o of list) {
    const prim = o.primitive; if (!prim) continue;
    let op: Operator;
    if (opName === 'ClothOp') op = makeClothOperator();
    else { op = new Operator('SoftBodyOp', 'softbodyop', []); }   // inferred: the soft-body operator node (no solver here)
    app.record('ApplyOp ' + opName, () => prim.addOperator(op), () => prim.removeOperator(op));
    ops.push(op);
  }
  if (opName === 'SoftBodyOp' && ops.length) nya(app, command, 'the SoftBodyOp simulation (the operator is placed on the stack; it does not deform here)', NOTE_F);
  if (ops.length) autoInspect(app, command, ops);
  return ops.length ? ops : null;
}
function applySoftBody(app: App, a: Record<string, any>) {
  const list = simulationTargets(app, 'ApplySoftBody', a);
  return list ? applySimOp(app, 'ApplySoftBody', 'SoftBodyOp', list) : null;
}
function applyCloth(app: App, a: Record<string, any>) {
  const C = 'ApplyCloth';
  const list = simulationTargets(app, C, a);
  if (!list) return null;
  for (const o of list) {
    let prop = o.properties.find(p => p.name === 'ClothProp' || p.type === 'cloth') ?? null;
    if (!prop) {
      trace(app, C, 'SIAddProp', 'Cloth', o);
      const made = makeClothProperty('ClothProp'); prop = made;
      app.record('SIAddProp Cloth', () => o.addProperty(made), () => o.removeProperty(made));
    }
    trace(app, C, 'SetValue', `${siName(prop)}.Master`, true);
    const m = prop.get('Master') ?? prop.get('master');
    if (m) app.setParam(m, true);
    else nya(app, C, `${siName(prop)}.Master (no such parameter in this build's cloth property)`, NOTE_F);
  }
  return applySimOp(app, C, 'ClothOp', list);
}

function applyParticleShader(app: App, a: Record<string, any>) {
  const C = 'ApplyParticleShader';   // correction: Inspect is not used
  const input = collection(app, a.InputObjs);
  if (!input) return null;
  trace(app, C, 'SIFilter', input, 'Particle', '', 'siSearchFamilies');
  const clouds = input.filter((n): n is X3DObject => n instanceof X3DObject && n.type === 'cloud');
  if (!clouds.length) return null;
  const out: any[] = [];
  for (const c of clouds) {
    const cn = siName(c);
    trace(app, C, 'SIApplyShader', '$XSI_DSPRESETS\\Shaders\\Material\\Phong.Preset', c);
    app.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [c] });
    trace(app, C, 'SIApplyShaderToCnxPoint', a.Material ?? null, `${cn}.material.Surface,${cn}.material.Shadow`);
    const r = app.run('SIApplyShaderToCnxPoint', { PresetObj: a.Material ?? null, InputObjs: `${cn}.material.Surface,${cn}.material.Shadow` });
    trace(app, C, 'SIApplyShaderToCnxPoint', a.Volume ?? null, `${cn}.material.Volume`);
    app.run('SIApplyShaderToCnxPoint', { PresetObj: a.Volume ?? null, InputObjs: `${cn}.material.Volume` });
    trace(app, C, 'RemoveAllShadersFromCnxPoint', `${cn}.material.Photon`);
    app.run('RemoveAllShadersFromCnxPoint', { InputObjs: `${cn}.material.Photon` });
    const surf = Array.isArray(r) ? r[0] : r;
    out.push(surf ?? null);
  }
  b17ef(app).out[C] = { Value: out };
  return out;
}

function createForce(app: App, a: Record<string, any>) {
  const C = 'CreateForce';
  const force = siGetPrim(app, C, String(a.Name || 'Gravity'), '', null);
  for (const n of collection(app, a.InputObjs, false) ?? []) {
    try {
      if (!(n instanceof X3DObject)) continue;
      if (n.type === 'cloud' || simOps(n).length) {
        trace(app, C, 'AddParticleForce', n, force);
        app.run('AddParticleForce', { Target: [n], InputObj: [force] });
      }
    } catch { /* errors ignored */ }
  }
  const env: Node | null = (app.scene as any).activeSimulationEnvironment ?? null;
  if (env && force) {
    const data = simEnvironment(env); const en = siName(env as any);
    const addContainer = (type: string, name: string) => {
      trace(app, C, 'AddContainerToEnvironment', env, type, 1, name);
      if (app.commands.has('AddContainerToEnvironment')) { app.run('AddContainerToEnvironment', { Environment: env, Type: type, Support3DObject: true, Name: name }); return; }
      const c: SimContainer = { name, type, members: [] };   // inferred: the environment record of CMD-B6e
      app.record('AddContainer ' + name, () => data.containers.push(c), () => { const i = data.containers.indexOf(c); if (i >= 0) data.containers.splice(i, 1); });
    };
    if (!data.containers.length) { addContainer('RigidBody', 'RigidBodies'); addContainer('Constraint', 'Constraints'); addContainer('Force', 'Forces'); }
    else if (!data.containers.some(c => c.name === 'Forces')) addContainer('Force', 'Forces');
    trace(app, C, 'AddToContainer', `${en}.Forces`, force);
    const forces = data.containers.find(c => c.name === 'Forces');
    if (forces && !forces.members.includes(force)) app.record('AddToContainer', () => forces.members.push(force), () => { const i = forces.members.indexOf(force); if (i >= 0) forces.members.splice(i, 1); });
    if (!data.operators.length) {
      const engine = Number(pref(app, 'preferences.simulation.rbdengine', 0));
      const opName = engine === 0 ? 'NXDynamicsOp' : engine === 1 ? 'DynamicsOp' : null;
      if (opName) {
        trace(app, C, 'ApplyOp', opName, env);
        const rec = { name: `${en}.${opName}` };   // inferred: the dynamics operator record of the environment
        app.record('ApplyOp ' + opName, () => data.operators.push(rec), () => { const i = data.operators.indexOf(rec); if (i >= 0) data.operators.splice(i, 1); });
      } else nya(app, C, `simulation.rbdengine = ${engine} (only 0 PhysX and 1 ODE are attested)`, NOTE_F);
    }
  }
  if (force) {
    trace(app, C, 'SelectObj', force); app.select([force]);
    autoInspect(app, C, force, 'Simulation');
  }
  b17ef(app).out[C] = { Value: force };
  return force;
}

// ======================================================================= registration
/** Names this file owns (other registrars skip them). */
export const B17EF_NAMES = [
  'SelectExternalConstraints', 'ActivateExternalConstraints', 'DeactivateExternalConstraints', 'RemoveExternalConstraints',
  'CreateMarkingSet', 'ActivateMarkingSet', 'SetKeyUsingMarkingSet',
  'GetPresetModel', 'GetPrimLattice', 'GetPrimVolumeDeform', 'GetPrimWave', 'ApplySoftBody', 'ApplyCloth', 'ApplyParticleShader', 'CreateForce',
];

export function registerAnimPrimsB17efCommands(app: App) {
  b17ef(app).expand = expandMarking;
  const ANIM = 'Animation';
  for (const [name, label, op] of [
    ['SelectExternalConstraints', 'Character - Select Constraints Outside Model Boundaries', 'Select'],
    ['ActivateExternalConstraints', 'Character - Activate Constraints Outside Model Boundaries', 'Activate'],
    ['DeactivateExternalConstraints', 'Character - Deactivate Constraints Outside Model Boundaries', 'Deactivate'],
    ['RemoveExternalConstraints', 'Character - Remove Constraints Outside Model Boundaries', 'Remove'],
  ] as const) app.register({ name, label, category: ANIM, args: [{ name: 'InputObj', default: null }, { name: 'Operation', default: op }], execute: (app2, a) => manageExternalConstraints(app2, name, a) });
  app.register({ name: 'CreateMarkingSet', label: 'Create Marking Set', category: ANIM, args: [{ name: 'InputObjs', default: null }, { name: 'Reset', default: true }], execute: createMarkingSet });
  app.register({ name: 'ActivateMarkingSet', label: 'Activate Marking Set', category: ANIM, args: [{ name: 'InputObjs', default: null }], execute: (app2) => activateMarkingSet(app2) });
  app.register({ name: 'SetKeyUsingMarkingSet', label: 'Set Key Using Marking Set', category: ANIM, args: [{ name: 'InputObjs', default: null }, { name: 'Branch', default: false }], execute: setKeyUsingMarkingSet });

  const PRIM = 'Primitive';
  app.register({
    name: 'GetPresetModel', label: 'Get Preset Model', category: PRIM, undoable: false,
    args: [{ name: 'ModelName', default: 'WomanSkeleton_Rig' }, { name: 'Name', default: 'WomanSkeleton_Rig' }, { name: 'Parent', default: '' }, { name: 'PsetName', default: '' }],
    supported: (a) => !!bundledPresetFile(String(a.ModelName ?? '')),
    execute: getPresetModel,
  });
  const out = { name: 'PrimObj', default: null };
  app.register({ name: 'GetPrimLattice', label: 'Lattice', category: 'Primitive|Deformation', args: [{ name: 'PresetObj', default: 'Lattice' }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, out], execute: getPrimLattice });
  app.register({ name: 'GetPrimVolumeDeform', label: 'VolumeDeform', category: 'Primitive|Deformation', args: [{ name: 'PresetObj', default: 'SphereVolume' }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { ...out }], execute: getPrimVolumeDeform });
  app.register({ name: 'GetPrimWave', label: 'Wave Object', category: 'Primitive|Deformation', args: [{ name: 'PresetObj', default: 'Wave' }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'Primitive', default: null }], execute: getPrimWave });

  const SIM = 'Simulation';
  app.register({ name: 'ApplySoftBody', label: 'Apply SoftBody', category: SIM, args: [{ name: 'InputObjs', default: null }], execute: applySoftBody });
  app.register({ name: 'ApplyCloth', label: 'Apply Cloth', category: SIM, args: [{ name: 'InputObjs', default: null }], execute: applyCloth });
  app.register({ name: 'ApplyParticleShader', label: 'Apply Particle Shader', category: SIM, args: [{ name: 'InputObjs', default: null }, { name: 'Material', default: null }, { name: 'Volume', default: null }, { name: 'Inspect', default: true }], execute: applyParticleShader });
  app.register({ name: 'CreateForce', label: 'Create Force', category: PRIM, args: [{ name: 'Name', default: 'Wind' }, { name: 'InputObjs', default: '' }], execute: createForce });
}
