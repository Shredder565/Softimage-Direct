// Ledger row CMD-B15b (`propertytasks.dll`): custom parameters, materials, user normals, overrides, cluster-property
// values and retarget mapping. Commands registered here (literal Softimage scripting names):
//   SIAddCustomParam  SICreateMaterialDD  "Add property extended"
//   SIAddShaderEntryToOverride  SIAddParameterEntryToOverride  SIAddConnectionEntryToOverride  SIRemoveEntryFromOverride
//   SIGetOverriddenParameters  SIGetOriginalValueOfOverridden
//   siCreateRetargetMapping  siWriteRetargetMapping  siWriteRetargetComponentData
//   MarkObjectDirty  AddShaderAttachedComment                       (no handler located: shells that log)
//   + propertyTasksB15bClusters.ts: SetClusterPropertyValues CreateUserNormals RemoveUserNormals SetVertexUserNormals
//     SetPolygonUserNormals SetUserNormalValues
// Brief: docs/ghidra/cmd-b15b-propertytasks.md ("Wire contract" of each command, including the `(inferred)` parts) and
// docs/re/WIRE_CORRECTIONS_B15.md items 22-26. Original code written from that prose only; no golden exists.
//
// Mapping onto this build:
//  * Argument handlers follow the registry: "Collection" / "SingleObj" arguments that are not given stand for the
//    selection, "MarkedParameters" for the marked parameters, "Frame" for the current frame.
//  * Non-failing statuses (S_FALSE, 0x562e80d2 "nothing to do", 0x562e80c7 "cancelled") are kept in
//    `app.propertyTasksB15b.status[<command>]`; failures throw SiStatusError with the contract's HRESULT.
//  * Override entries are parameters of the override property, each marked with `def.overrideEntry`
//    ({ kind: 0 connection / shader, 1 property, 2 parameter value; path relative to the overridden object }). This
//    build does not evaluate overrides, so a parameter's own value is its "original" value.
//  * The retarget-mapping and retarget-structure properties (`180064800`, `180064810`) are not identified: their data
//    is kept per object in `app.propertyTasksB15b.retarget` / `.structure` and is not shown in the Explorer.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15b)".
import * as THREE from 'three';
import { App } from '../core/commands';
import { Shader, Model, Constraint, makeSiShader, threeOrder } from '../core/scene';
import type { ParamDef, ParamType } from '../core/params';
import {
  b15b, setStatus, fail, warn, logNya, unset, listOf, boolArg, enumArg, collectionArg, singleObjArg, markedArg, resolveItem,
  ownerObject, relPath, paramAt, setAt, objectsOf, isOverride, removeParam, insertParam,
  X3DObject, Property, Material, Parameter, ParamSet, RetargetMapping, RetargetRecord,
  S_OK, S_FALSE, E_FAIL, E_INVALIDARG, E_POINTER, E_OUTOFMEMORY, SI_CANCELLED, SI_NOTHING,
} from './propertyTasksB15bShared';
import {
  registerPropertyTasksB15bClusters, userNormalCluster, userNormalProperty, sampleTable, vertexNormals, polygonNormal,
  valuesOf, elementOrder, clusterPropDim,
} from './propertyTasksB15bClusters';

// ================================================================== SIAddCustomParam
const VT: Record<string, number> = {
  siEmpty: 0, siInt2: 2, siInt4: 3, siFloat: 4, siDouble: 5, siString: 8, siDispatch: 9, siBool: 11, siUnknown: 13,
  siByte: 16, siUByte: 17, siUInt2: 18, siUInt4: 19, siWStr: 31,
};
/** Variant types the worker accepts (bit set in 0xcf093c, VT < 24). */
const vtSupported = (vt: number) => vt >= 0 && vt < 24 && ((0xcf093c >> vt) & 1) === 1;
const I2 = (v: number) => (Math.trunc(v) << 16) >> 16;
/** ValidateNameSyntax (inferred rule): characters other than letters, digits and '_' become '_'; a leading digit gets
 *  a '_' prefix. */
export function validateNameSyntax(s: string): string { let r = s.replace(/[^A-Za-z0-9_]/g, '_'); if (/^[0-9]/.test(r)) r = '_' + r; return r; }
/** Unique-name service on the property (inferred: a numeric suffix, counting from 1). */
function uniqueParamName(ps: ParamSet, base: string): string { if (!ps.get(base)) return base; let i = 1; while (ps.get(base + i)) i++; return base + i; }
function convert(vt: number, v: any): any {
  if (vt === 8) return unset(v) ? '' : String(v);
  if (vt === 11) return boolArg(v);
  const n = unset(v) ? 0 : Number(v); const x = Number.isFinite(n) ? n : 0;
  if (vt === 4) return Math.fround(x);
  if (vt === 5) return x;
  return Math.trunc(x);
}
const paramType = (vt: number): ParamType => vt === 8 ? 'string' : vt === 11 ? 'bool' : vt === 4 || vt === 5 ? 'double' : 'int';
function newGuid(): string {
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `{${h()}${h()}-${h()}-${h()}-${h()}-${h()}${h()}${h()}}`;
}

function siAddCustomParam(app: App, a: Record<string, any>) {
  const C = 'SIAddCustomParam'; const st = b15b(app);
  // UnPackArg
  const raw = unset(a.ScriptName) ? '' : String(a.ScriptName);
  if (!raw) throw fail(E_OUTOFMEMORY, `${C}: empty ScriptName`);
  const script = validateNameSyntax(raw);
  const vtArg = enumArg(a.VarType);
  const vt = I2(vtArg === null ? 5 : typeof vtArg === 'number' ? vtArg : (VT[vtArg] ?? NaN));
  if (Number.isNaN(vt)) throw fail(E_INVALIDARG, `${C}: unknown VarType ${String(a.VarType)}`);
  const num = (v: any, d: number) => (unset(v) ? d : Number(v));
  let minV: any = num(a.MinValue, 0), maxV: any = num(a.MaxValue, 1), sMin: any = num(a.SuggMin, 0), sMax: any = num(a.SuggMax, 0);
  const classification = I2(num(a.Classification, 32768)); let caps = I2(num(a.Capabilities, 5));
  // Do
  const label = unset(a.ParamName) ? script : String(a.ParamName);
  const desc = unset(a.Description) ? script : String(a.Description);
  let dflt: any;
  if (vt === 8) { dflt = unset(a.DefaultValue) ? '' : String(a.DefaultValue); minV = maxV = sMin = sMax = ''; }
  else {
    if (sMin === sMax) { sMin = minV; sMax = maxV; }
    dflt = convert(vt, a.DefaultValue); minV = convert(vt, minV); maxV = convert(vt, maxV); sMin = convert(vt, sMin); sMax = convert(vt, sMax);
  }
  // worker
  const target = collectionArg(app, a.InputObj)[0];
  if (!target) throw fail(E_POINTER, `${C}: no InputObj`);
  if (vt !== 8 && (Number(minV) > Number(maxV) || Number(sMin) > Number(sMax))) throw fail(E_INVALIDARG, `${C}: Min/Max or SuggMin/SuggMax out of order`);
  if (!(target instanceof Property) || target instanceof Constraint || isOverride(target)) {
    throw fail(E_INVALIDARG, `${C}: not yet attested: the parameter container the worker finds or creates on ${target?.fullName ?? String(target)} (0x180013800); give a custom property set (CMD-B15b)`);
  }
  if (!vtSupported(vt)) throw fail(E_FAIL, `${C}: VarType ${vt} is not supported`, 0x2b);
  const name = uniqueParamName(target, validateNameSyntax(script));
  const guid = unset(a.ParamGuid) ? newGuid() : String(a.ParamGuid);
  if (vt === 8) caps &= ~1;
  if (caps & 0x800) caps &= ~0x1000;
  caps |= 4;   // read as the value 4 (siPersistable)
  const def: ParamDef & Record<string, any> = {
    name, label, type: paramType(vt), value: dflt, desc,
    animatable: !!(caps & 1), keyable: !!(caps & 0x800), readOnly: !!(caps & 2), inspectable: !(caps & 8),
    siVarType: vt, siClassification: classification, siCapabilities: caps, guid,
  };
  if (vt !== 8 && vt !== 11) { def.min = Number(minV); def.max = Number(maxV); def.uimin = Number(sMin); def.uimax = Number(sMax); }
  let p: Parameter | null = null;
  app.record('SIAddCustomParam', () => { if (p) insertParam(target, p, target.params.length); else p = target.add(def); }, () => { if (p) removeParam(target, p); });
  if (caps & (0x800 | 0x1000)) st.events.push('SI3D_KEYABLEPARAMETER_CHANGED');
  setStatus(app, C, S_OK);
  app.events.emit('params');
  return p;
}

// ================================================================== SICreateMaterialDD
function siCreateMaterialDD(app: App, a: Record<string, any>) {
  const C = 'SICreateMaterialDD';
  if (!unset(a.Library)) {
    const lib = resolveItem(app, Array.isArray(a.Library) ? a.Library[0] : a.Library);
    if (lib && (lib as any).locked) throw fail(0x80070005, `${C}: the material library is locked`);
    logNya(app, C, 'material libraries other than the scene\'s one material list (the Library argument is not used)');
  }
  if (!boolArg(a.Initialize, true)) logNya(app, C, 'Initialize=False (its use on the preset path, +0x120)');
  const objects = unset(a.Objects) ? [] : listOf(a.Objects).map(x => resolveItem(app, x)).filter((x): x is X3DObject => x instanceof X3DObject);
  const assignList = boolArg(a.AssignToList, true) ? objects : [];
  const preset = unset(a.PresetObj) ? null : Array.isArray(a.PresetObj) ? a.PresetObj[0] : a.PresetObj;
  const mats = app.scene.materials;
  let m: Material;
  const asMaterial = preset instanceof Material ? preset : typeof preset === 'string' ? (mats.find(x => x.name === preset) ?? null) : null;
  if (asMaterial) m = asMaterial;   // the preset is itself a material: it becomes the new material
  else {
    m = new Material(app.scene.uniqueName('Material'));
    if (preset !== null) {
      // SIApplyShader with the shader preset on the new material
      const key = preset instanceof Shader ? preset.type : String(preset).replace(/\.Preset$/i, '').split(/[\\/]/).pop()!;
      const sh = makeSiShader(key);
      if (!sh) throw fail(E_FAIL, `${C}: SIApplyShader failed: shader preset ${String(preset)} is not available`);
      const mm = m; app.record('SIApplyShader', () => { mm.setSurface(sh); }, () => { mm.setSurface(null as any); });
    }
  }
  if (!unset(a.Name) && m.name !== String(a.Name)) { const mm = m, old = m.name, nn = app.scene.uniqueName(String(a.Name)); app.record('Rename', () => { mm.name = nn; }, () => { mm.name = old; }); }
  if (!mats.includes(m)) { const mm = m; app.record('F3DAddToLibrary', () => { mats.push(mm); }, () => { const i = mats.indexOf(mm); if (i >= 0) mats.splice(i, 1); }); }
  for (const o of assignList) { const old = o.material, mm = m; if (old !== m) app.record('SIAssignMaterial', () => { o.setMaterial(mm); }, () => { o.setMaterial(old); }); }
  setStatus(app, C, S_OK);
  return [m];
}

// ================================================================== Add property extended
function animated(app: App, o: X3DObject): boolean {
  for (const s of [o.kinematics.local, ...o.properties]) for (const p of s.params) if (app.anim.isAnimated(p)) return true;
  return false;
}
function addPropertyExtended(app: App, a: Record<string, any>) {
  const C = 'Add property extended'; const st = b15b(app);
  const list = collectionArg(app, a.InputObjs).filter((x): x is X3DObject => x instanceof X3DObject);
  if (!list.length) { warn(app, C, 'no input object', 0x2b); setStatus(app, C, SI_NOTHING); return []; }
  const prop = singleObjArg(app, a.Property);
  if (!(prop instanceof Property)) throw fail(E_INVALIDARG, `${C}: Property is not a property`);
  const pt = enumArg(a.PropagationType);
  const pnum = typeof pt === 'number' ? pt : pt === 'siBranchPropagation' ? 1 : pt === 'siNodePropagation' ? 2 : 0;
  (st as any).lastBranchFlag = pnum === 1 ? 1 : pnum === 2 ? 0 : 3;
  if (/inspect/i.test(prop.name) && app.autoInspect) {
    const without = list.filter(o => !o.properties.some(p => p.name === prop.name));
    if (without.some(o => animated(app, o))) {
      const text = `${prop.name}: an input object is animated; add the property anyway? (simsgcat message 0x3c; text not in the repo)`;
      const yes = st.ask ? st.ask(C, text) : ((app as any).Interactive === false || typeof window === 'undefined' || typeof window.confirm !== 'function' ? true : window.confirm(text));
      if (!yes) { setStatus(app, C, SI_CANCELLED); return []; }
    }
  }
  const out: Property[] = [];
  for (const o of list) {
    let made: any;
    try { made = app.run('SIAddPropEx', { InputObj: [o], Property: prop, PropagationType: a.PropagationType }); }
    catch (e: any) { throw fail(E_FAIL, `${C}: SIAddProp failed on ${o.name}: ${e?.message ?? e}`, 0x2b); }
    for (const p of (Array.isArray(made) ? made : made ? [made] : [])) if (p instanceof Property) out.push(p);
  }
  setStatus(app, C, S_OK);
  return out;
}

// ================================================================== overrides
export interface OverrideEntry { kind: 0 | 1 | 2; path: string; shaderClass?: string }
export const entryOf = (p: Parameter): OverrideEntry | undefined => (p.def as any).overrideEntry;
const SCALAR: ParamType[] = ['double', 'int', 'bool', 'enum'];
function entryParamName(ov: Property, path: string): string { return uniqueParamName(ov, validateNameSyntax(path)); }
function addEntry(app: App, ov: Property, kind: 0 | 1 | 2, path: string, base: Partial<ParamDef>, extra: Partial<OverrideEntry> = {}): Parameter {
  const def: any = { ...base, name: entryParamName(ov, path), label: path, overrideEntry: { kind, path, ...extra } };
  let p: Parameter | null = null;
  app.record('AddEntryToOverride', () => { if (p) insertParam(ov, p, ov.params.length); else p = ov.add(def); }, () => { if (p) removeParam(ov, p); });
  return p!;
}
const SAME_DEF = (src: Parameter): Partial<ParamDef> => ({ type: src.def.type, items: src.def.items, min: src.def.min, max: src.def.max, animatable: src.def.animatable, keyable: src.def.keyable });
const copyValue = (v: any) => (Array.isArray(v) ? [...v] : v);

function addEntriesToOverride(app: App, command: string, a: Record<string, any>, type: number, hasInputObjs: boolean) {
  if (!hasInputObjs) {
    for (const k of ['PresetObj', 'Name']) if (!unset(a[k])) logNya(app, command, `what ${k} changes for the shader variant (not read by this task's UnPackArg)`);
  }
  if (!unset(a.Path)) logNya(app, command, 'what the Path argument changes (read by UnPackArg; its use is not attested; the item\'s own path is used)');
  const items = hasInputObjs ? collectionArg(app, a.InputObjs) : [];
  let ov: Property | null = null;
  const at = items.findIndex(isOverride);
  if (at >= 0) { ov = items[at]; items.splice(at, 1); }
  else { const x = hasInputObjs ? singleObjArg(app, a.InputObj) : collectionArg(app, a.InputObj)[0]; if (isOverride(x)) ov = x; }
  if (!ov) throw fail(E_INVALIDARG, `${command}: no override property given`, 0x3fc);
  const made: Parameter[] = [];
  for (const it of items) {
    let kind: number;
    if (it instanceof Property) kind = 1;
    else if (it instanceof Parameter && it.owner instanceof Shader) kind = 0;   // inferred: shader ports stand for the connection-capable attribute
    else if (it instanceof Parameter && SCALAR.includes(it.def.type)) kind = type;   // Type 0 or 2 is the kind; any other Type would ask the user (not these names): 1 is unsupported for a parameter
    else kind = -1;
    if (kind === 1 && !(it instanceof Property)) kind = -1;
    if (kind !== 0 && kind !== 1 && kind !== 2) { warn(app, command, `${(it as any)?.fullName ?? String(it)} cannot be added to an override`, 0xc); continue; }
    const o = ownerObject(it); const path = o ? relPath(it, o) : '';
    if (!o || !path) { warn(app, command, `${(it as any)?.fullName ?? String(it)} has no path`, 0xd); continue; }
    if (ov.params.some(p => entryOf(p)?.path.toLowerCase() === path.toLowerCase() && entryOf(p)?.kind === kind)) { logNya(app, command, `adding an entry for ${path} a second time (skipped)`); continue; }
    if (kind === 1) {
      made.push(addEntry(app, ov, 1, path, { type: 'string', value: path, animatable: false }));
    } else if (kind === 0) {
      const src = it as Parameter;
      made.push(addEntry(app, ov, 0, path, { ...SAME_DEF(src), value: copyValue(src.value) }, { shaderClass: (src.owner as any)?.type ?? '5e373ee5-1085-11d3-b0b7-00a0c982a112' }));
    } else {
      const src = it as Parameter;
      const v = unset(a.Value) ? src.value : a.Value;
      if (v === undefined || v === null || v === '') throw fail(E_INVALIDARG, `${command}: ${src.fullName} has no value`);
      made.push(addEntry(app, ov, 2, path, { ...SAME_DEF(src), value: copyValue(v) }));
    }
  }
  setStatus(app, command, made.length ? S_OK : S_FALSE);
  if (made.length) app.events.emit('params');
  return made;
}
function siRemoveEntryFromOverride(app: App, a: Record<string, any>) {
  const C = 'SIRemoveEntryFromOverride';
  if (a.InputObjs === null && !app.anim.marked.size) { setStatus(app, C, S_FALSE); return 0; }
  const list = markedArg(app, a.InputObjs).filter((p): p is Parameter => p instanceof Parameter && !!entryOf(p) && isOverride(p.owner));
  const byOv = new Map<Property, Parameter[]>();
  for (const p of list) { const ov = p.owner as Property; const l = byOv.get(ov) ?? []; if (!l.includes(p)) l.push(p); byOv.set(ov, l); }
  let n = 0;
  for (const [ov, ps] of byOv) {
    const sorted = ps.map(p => [ov.params.indexOf(p), p] as const).sort((x, y) => y[0] - x[0]);
    for (const [i, p] of sorted) { app.record('RemoveEntryFromOverride', () => { removeParam(ov, p); }, () => { insertParam(ov, p, i); }); n++; }
  }
  setStatus(app, C, n ? S_OK : S_FALSE);
  if (n) app.events.emit('params');
  return n;
}
function siGetOverriddenParameters(app: App, a: Record<string, any>) {
  const C = 'SIGetOverriddenParameters';
  const t = singleObjArg(app, a.Target);
  const out: Parameter[] = [];
  if (!(t instanceof Parameter) || !isOverride(t.owner) || !entryOf(t)) { warn(app, C, `${(t as any)?.fullName ?? String(t ?? '')} is not an override entry`, 7); setStatus(app, C, S_FALSE); return out; }
  const e = entryOf(t)!; const ov = t.owner as Property;
  // inferred: the objects an override applies to are its owner (or the members of the group / layer / partition owning it)
  for (const o of objectsOf(ov.parent)) {
    if (e.kind === 1) { const s = setAt(o, e.path); if (s) out.push(...s.params); }
    else { const p = paramAt(o, e.path); if (p) out.push(p); }
  }
  setStatus(app, C, S_OK);
  return out;
}
/** The override entries that drive a parameter (overrides on the object, its ancestors, and groups / layers holding it). */
export function overridesDriving(app: App, p: Parameter): { override: Property; entry: Parameter }[] {
  const o = ownerObject(p); if (!o) return [];
  const rel = relPath(p, o).toLowerCase();
  const hosts: any[] = [];
  for (let n: X3DObject | null = o; n; n = n.parentObj) hosts.push(n);
  for (const g of app.scene.groupList) if (g.members.includes(o)) hosts.push(g);
  for (const l of app.scene.layers) if (l.members.has(o)) hosts.push(l);
  const out: { override: Property; entry: Parameter }[] = [];
  for (const h of hosts) for (const ov of ((h.properties ?? []) as Property[]).filter(isOverride)) for (const q of ov.params) {
    const e = entryOf(q); if (!e) continue; const ep = e.path.toLowerCase();
    if ((e.kind !== 1 && ep === rel) || (e.kind === 1 && rel.startsWith(ep + '.'))) out.push({ override: ov, entry: q });
  }
  return out;
}
function siGetOriginalValueOfOverridden(app: App, a: Record<string, any>) {
  const C = 'SIGetOriginalValueOfOverridden'; const st = b15b(app);
  const t = singleObjArg(app, a.Target);
  if (!t) throw fail(E_POINTER, `${C}: no Target`);
  if (!(t instanceof Parameter)) throw fail(E_INVALIDARG, `${C}: ${(t as any)?.fullName ?? String(t)} is not a parameter`);
  const frame = unset(a.Time) ? app.anim.frame : Number(a.Time);
  st.lastTimeSeconds = frame / (app.anim.fps || 30);
  if (!overridesDriving(app, t).length) {
    app.logMsg('info', `${C}: ${t.fullName} is not overridden (message id not attested)`);
    throw fail(E_FAIL, `${C}: ${t.fullName} is not overridden (status not attested)`);
  }
  const fc = app.anim.isAnimated(t) ? app.anim.fcurve(t) : undefined;
  const v = fc ? fc.eval(frame) : t.value;
  setStatus(app, C, S_FALSE);   // RePackArg returns 1 ("no undo record", inferred)
  return copyValue(v);
}

// ================================================================== retarget
const IDENT = () => new THREE.Matrix4().elements.slice();
const ownerModelOf = (o: X3DObject): X3DObject | null => { let p = o.parentObj; while (p && !(p instanceof Model)) p = p.parentObj; return p; };
function retargetSet(app: App, label: string, o: X3DObject, next: RetargetMapping) {
  const map = b15b(app).retarget; const old = map.get(o);
  app.record(label, () => { map.set(o, { mapping: [...next.mapping], p2m: [...next.p2m] }); }, () => { if (old) map.set(o, old); else map.delete(o); });
}
function siCreateRetargetMapping(app: App, a: Record<string, any>) {
  const C = 'siCreateRetargetMapping';
  const list = collectionArg(app, a.InputObjs).map(x => (x instanceof X3DObject ? x : ownerObject(x))).filter((x): x is X3DObject => !!x);
  if (!list.length) throw fail(E_POINTER, `${C}: no InputObjs`);
  logNya(app, C, 'the rotation-order details of the kinematic state read (rotation zeroed through the three.js decomposition)');
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  list[0].globalMatrix().decompose(pos, q, s);
  const root = new THREE.Matrix4().compose(pos, new THREE.Quaternion(), s);
  const rootInv = root.clone().invert();
  for (const o of list) {
    const g = o.globalMatrix(); const owner = ownerModelOf(o);
    const og = owner ? owner.globalMatrix() : new THREE.Matrix4();
    const p2m = rootInv.clone().multiply(og);
    const mapping = og.clone().invert().multiply(g);
    retargetSet(app, C, o, { mapping: mapping.elements.slice(), p2m: p2m.elements.slice() });
  }
  setStatus(app, C, S_OK);
}
function srt(a: Record<string, any>, prefix: string, command: string): number[] {
  const k = ['Sx', 'Sy', 'Sz', 'Rx', 'Ry', 'Rz', 'Tx', 'Ty', 'Tz'].map(n => prefix + n);
  for (const n of k) if (unset(a[n])) throw fail(E_INVALIDARG, `${command}: argument ${n} is missing`);
  const v = k.map(n => Number(a[n]));
  if (v.some(x => Number.isNaN(x))) throw fail(E_INVALIDARG, `${command}: an S/R/T argument is not a number`);
  const sc = v.slice(0, 3).map(x => (Math.abs(x) < 1e-12 ? (x < 0 || Object.is(x, -0) ? -1e-12 : 1e-12) : x));
  const d = Math.PI / 180;
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(v[3] * d, v[4] * d, v[5] * d, threeOrder(0)));
  return new THREE.Matrix4().compose(new THREE.Vector3(v[6], v[7], v[8]), quat, new THREE.Vector3(sc[0], sc[1], sc[2])).elements.slice();
}
function firstObject(app: App, command: string, arg: any): X3DObject {
  const first = collectionArg(app, arg)[0];
  const o = first instanceof X3DObject ? first : first ? ownerObject(first) : null;
  if (!o) throw fail(E_POINTER, `${command}: no InputObjs`);
  return o;
}
function siWriteRetargetMapping(app: App, a: Record<string, any>) {
  const C = 'siWriteRetargetMapping';
  const mapping = srt(a, '', C), p2m = srt(a, 'P2M_', C);
  const o = firstObject(app, C, a.InputObjs);
  retargetSet(app, C, o, { mapping, p2m });
  setStatus(app, C, S_OK);
}
const CHAIN: Record<string, number> = { ik: 2, ik_contact: 3, fk: 6 };
const ROLE: Record<string, number> = { root: 1, fk: 2, ik_effector: 3, ik_contact: 4, upvector: 5 };
export function parseRetargetRecord(s: string): RetargetRecord {
  const t = s.split(',');
  const count = Math.max(0, parseInt(t[3] ?? '', 10) || 0);
  const members: { name: string; role: number }[] = [];
  for (let i = 0; i < count; i++) { const name = t[4 + i * 2] ?? ''; const role = t[5 + i * 2] ?? ''; members.push({ name, role: ROLE[role] ?? 2 }); }
  return { name0: t[0] ?? '', name1: t[1] ?? '', chainType: CHAIN[t[2] ?? ''] ?? 1, members };
}
function siWriteRetargetComponentData(app: App, a: Record<string, any>) {
  const C = 'siWriteRetargetComponentData';
  const raw = a['Parameter list'];
  if (typeof raw !== 'string') throw fail(E_INVALIDARG, `${C}: Parameter list is not a string`);
  const o = firstObject(app, C, a.InputObjs);
  logNya(app, C, 'which character is stripped from the string before it is read (nothing is stripped)');
  const map = b15b(app).structure; const old = map.get(o);
  const next = raw.toLowerCase() === 'clear' ? [] : [...(old ?? []), parseRetargetRecord(raw)];
  app.record(C, () => { map.set(o, next); }, () => { if (old) map.set(o, old); else map.delete(o); });
  setStatus(app, C, S_OK);
}

// ================================================================== shells
function markObjectDirty(app: App, a: Record<string, any>) {
  const C = 'MarkObjectDirty';
  const o = singleObjArg(app, a.Object);
  logNya(app, C, `what marking ${(o as any)?.fullName ?? 'the object'} dirty does (registry CLSID is all zeros and names no handler DLL)`);
  setStatus(app, C, S_FALSE);
}
function addShaderAttachedComment(app: App, a: Record<string, any>) {
  const C = 'AddShaderAttachedComment';
  const c = collectionArg(app, a.Container)[0];
  logNya(app, C, `the shader-creation task bbbbee29 (PrivateInvokeMethod 3, attached comment) on ${(c as any)?.fullName ?? 'the container'}: its handler DLL is not located; nothing is created`);
  setStatus(app, C, S_FALSE);
  return null;
}

// ================================================================== registration
type ArgList = [string, any][];
export function registerPropertyTasksB15bCommands(app: App) {
  b15b(app);
  (app as any).propertyTasksB15bApi = {
    userNormalCluster, userNormalProperty, sampleTable, vertexNormals, polygonNormal, valuesOf, elementOrder, clusterPropDim,
    entryOf, overridesDriving, parseRetargetRecord, validateNameSyntax,
    retargetOf: (o: X3DObject) => b15b(app).retarget.get(o) ?? null, structureOf: (o: X3DObject) => b15b(app).structure.get(o) ?? null,
    IDENT,
  };
  const def = (name: string, label: string, category: string | undefined, args: ArgList, execute: (app: App, a: Record<string, any>) => any, undoable = true) =>
    app.register({ name, label, category, description: '', args: args.map(([n, d]) => ({ name: n, default: d })), undoable, execute });
  const P = 'Property';
  def('SIAddCustomParam', 'Add Custom Parameter', 'Property|Animation',
    [['InputObj', null], ['ScriptName', 'ParamName'], ['VarType', ':siDouble:siVariantType'], ['DefaultValue', null], ['MinValue', 0.0], ['MaxValue', 1.0],
      ['Classification', -32768], ['Capabilities', 5], ['SuggMin', 0.0], ['SuggMax', 0.0], ['ParamName', ''], ['Description', '']], siAddCustomParam);
  def('SICreateMaterialDD', 'CreateMaterial', P,
    [['PresetObj', null], ['Name', ''], ['Library', null], ['Objects', null], ['AssignToList', true], ['Initialize', true]], siCreateMaterialDD);
  def('Add property extended', 'Add property extended', undefined,
    [['Property', null], ['InputObjs', null], ['PropagationType', ':siDefaultPropagation:siPropagationType'], ['Value', null]], addPropertyExtended);
  def('SIAddConnectionEntryToOverride', 'Add Connection Entry To Override', P, [['InputObj', null], ['InputObjs', null], ['Value', null], ['Path', '']],
    (app, a) => addEntriesToOverride(app, 'SIAddConnectionEntryToOverride', a, 0, true));
  def('SIAddParameterEntryToOverride', 'Add Parameter Entry To Override', P, [['InputObj', null], ['InputObjs', null], ['Value', null], ['Path', '']],
    (app, a) => addEntriesToOverride(app, 'SIAddParameterEntryToOverride', a, 2, true));
  def('SIAddShaderEntryToOverride', 'Add Shader Entry To Override', P, [['PresetObj', null], ['InputObj', null], ['Path', ''], ['Name', '']],
    (app, a) => addEntriesToOverride(app, 'SIAddShaderEntryToOverride', a, 0, false));
  def('SIRemoveEntryFromOverride', 'Remove Entries from Override', P, [['InputObjs', null]], siRemoveEntryFromOverride);
  def('SIGetOverriddenParameters', 'Get a list of overridden parameters affected by an override entry', P, [['Target', null]], siGetOverriddenParameters, false);
  def('SIGetOriginalValueOfOverridden', 'Get original value of overridden parameter', P, [['Target', null], ['Time', null]], siGetOriginalValueOfOverridden, false);
  def('siCreateRetargetMapping', 'Set Retarget Mapping Properties', 'Property|Animation', [['InputObjs', null]], siCreateRetargetMapping);
  def('siWriteRetargetMapping', 'Set Retarget Mapping Properties', 'Property|Animation', [['InputObjs', null],
    ['Sx', 1.0], ['Sy', 1.0], ['Sz', 1.0], ['Rx', 0.0], ['Ry', 0.0], ['Rz', 0.0], ['Tx', 0.0], ['Ty', 0.0], ['Tz', 0.0],
    ['P2M_Sx', 1.0], ['P2M_Sy', 1.0], ['P2M_Sz', 1.0], ['P2M_Rx', 0.0], ['P2M_Ry', 0.0], ['P2M_Rz', 0.0], ['P2M_Tx', 0.0], ['P2M_Ty', 0.0], ['P2M_Tz', 0.0]], siWriteRetargetMapping);
  def('siWriteRetargetComponentData', 'Set Retarget Component Information', 'Property|Animation', [['InputObjs', null], ['Parameter list', '']], siWriteRetargetComponentData);
  def('MarkObjectDirty', 'MarkObjectDirty', undefined, [['Object', null]], markObjectDirty, false);
  def('AddShaderAttachedComment', 'Add Shader Attached Comment', 'Rendering', [['Container', null]], addShaderAttachedComment, false);
  registerPropertyTasksB15bClusters(app, (name, label, args, execute) => def(name, label, P, args, execute));
}
