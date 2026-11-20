// Ledger row CMD-B15b, override commands of propertytasks.dll (note section 3; WIRE_CORRECTIONS_B15 item 23):
//   SIAddShaderEntryToOverride SIAddParameterEntryToOverride SIAddConnectionEntryToOverride SIAddEntryToOverride SIStoreProp
//   SIRemoveEntryFromOverride SIGetOriginalValueOfOverridden SIGetOverriddenParameters
// Original code from the note's prose. Stand-in model: an override is a Property of type "Override"; each entry is a
// parameter of that property (the entry parameter's name is derived from the overridden path, inferred) whose
// definition carries `overrideEntry` (kind, path, shader class, value). The registry `state.entries` maps entry
// parameters back to their override. The effect of an override on evaluation is NOT modelled (the note does not
// describe it), so "the original value" of an overridden parameter is the parameter's own value at that time.
// Not attested (logged as "not yet attested"): what PresetObj / Name / Path of the shader variant change (the note: not
// read by the unpacking), the interactive Type question (hook `app.propertyTasksB15b.hooks.askEntryType`; without it the
// type stays 65535 and the item is skipped), message texts, the installed sub-task layouts.
import { App } from '../core/commands';
import { Node, X3DObject, Property, Group, Partition } from '../core/scene';
import { Parameter } from '../core/params';
import { paramOf } from './viewEditPropertyHelpers';
import type { ParamSet } from '../core/params';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_POINTER, E_FAIL, stateOf, fail, failMsg, setStatus, logNya, logMsgId, trace, unset, listOf, nodeArg, isParameter,
  ownerObject, toNumber, type OverrideEntry,
} from './propertyTasksB15bShared';

const DEFAULT_SHADER_CLASS = '5e373ee5-1085-11d3-b0b7-00a0c982a112';
export const isOverride = (n: any): n is Property => n instanceof Property && /^override$/i.test(n.type);
/** Types of parameter the note calls "simple scalar" (VT mask 0xcf083c): numbers and booleans. */
const isSimpleScalar = (p: Parameter) => p.def.type === 'double' || p.def.type === 'int' || p.def.type === 'bool' || p.def.type === 'enum';
const isConnectable = (p: Parameter) => !!(Number((p.def as any).capability ?? 0) & 1);   // capability attribute bit 0 (the build has no shader-port attribute; stand-in)

/** Path of a parameter / property relative to the 3D object that owns it (or its full name when it has none). */
export function relativePath(n: Node | Parameter): string {
  const full = n.fullName; const o = ownerObject(isParameter(n) ? n.owner : n);
  return o && full.startsWith(o.fullName + '.') ? full.slice(o.fullName.length + 1) : full;
}
/** The 3D objects an override applies to (inferred from its host: object, group or partition). */
export function overrideObjects(app: App, ov: Property): X3DObject[] {
  const h: any = ov.parent;
  if (h instanceof X3DObject) return [h];
  if (h instanceof Group) return [...h.members];
  if (h instanceof Partition) return [...h.members];
  logNya(app, 'override', `the objects an override on ${h?.fullName ?? 'a detached host'} applies to`);
  return [];
}
/** The parameter at a path relative to an object (the inverse of relativePath), by full names first. */
export function resolvePath(o: X3DObject, rel: string): Parameter | undefined {
  const i = rel.lastIndexOf('.');
  if (i < 0) return o.get(rel);
  const mid = o.fullName + '.' + rel.slice(0, i), last = rel.slice(i + 1);
  const sets: ParamSet[] = [o.kinematics, o.kinematics.local, o.kinematics.global, ...(o.primitive ? [o.primitive] : []), ...o.allProperties(), ...(o.material ? [o.material] : [])];
  const hit = sets.find(ps => ps.fullName === mid);
  return hit?.get(last) ?? paramOf(o, rel);
}
const entryOf = (p: any): OverrideEntry | undefined => (isParameter(p) ? (p.def as any).overrideEntry : undefined);

function addEntry(app: App, C: string, a: Record<string, any>, defaultType: number) {
  const st = stateOf(app);
  // UnPackArg: InputObjs; the first item exposing the override interface is removed and used, else InputObj
  let items: any[] = listOf(a.InputObjs).map(x => nodeArg(app, x) ?? x);
  let ov: Property | undefined; const k = items.findIndex(isOverride);
  if (k >= 0) { ov = items[k]; items = items.filter((_, i) => i !== k); }
  else { const n = nodeArg(app, unset(a.InputObj) ? null : listOf(a.InputObj)[0]); if (isOverride(n)) ov = n; }
  const type = unset(a.Type) ? defaultType : Math.trunc(toNumber(a.Type, defaultType));
  if (!unset(a.PresetObj) || !unset(a.Name) || !unset(a.Path)) logNya(app, C, 'PresetObj / Name / Path (the note: not read by the unpacking of this task)');
  // Do
  if (!ov) throw failMsg(app, C, E_INVALIDARG, 0x3fc, 'no override');
  const override = ov;
  const added: Parameter[] = [];
  let remembered: 0 | 2 | undefined;
  for (const it of items) {
    // classification (0x180046000)
    let kind: number; let target: Property | Parameter;
    if (it instanceof Property) { kind = 1; target = it; }
    else if (isParameter(it)) {
      target = it;
      if (isConnectable(it)) kind = 0;
      else if (isSimpleScalar(it)) {
        if (type === 0 || type === 2) kind = type;
        else {
          remembered ??= st.hooks.askEntryType?.(it);   // the answer is remembered for the rest of the list
          if (remembered === undefined) { logNya(app, C, `the entry-type question for ${it.fullName} (Type ${type}; no answer hook, item skipped)`); continue; }
          kind = remembered;
        }
      } else { logNya(app, C, `a ${it.def.type} parameter (${it.fullName}) is not a simple scalar; its entry kind is not in the note`); continue; }
    } else { logNya(app, C, `an input item that is neither property nor parameter (${String((it as any)?.fullName ?? it)})`); continue; }
    if (kind === 1 && !(it instanceof Property)) { logMsgId(app, C, 0xc); continue; }   // warning: unsupported item for a property entry
    const path = relativePath(target);
    if (kind === 0 && !path) { logMsgId(app, C, 0xd); continue; }   // empty path: warning, skip
    const entry: OverrideEntry = { kind: kind as 0 | 1 | 2, path, param: undefined as any };
    let def: any;
    if (kind === 2) {
      const p = target as Parameter;
      const value = unset(a.Value) ? p.value : a.Value;
      if (value === undefined || value === null || value === '' && p.def.type !== 'string') throw failMsg(app, C, E_INVALIDARG, 0x3fc, `no value for ${p.fullName}`);
      entry.value = Array.isArray(value) ? [...value] : value;
      def = { name: '', label: p.label, type: p.def.type, value: entry.value, animatable: p.def.animatable, items: p.def.items, min: p.def.min, max: p.def.max };
    } else if (kind === 0) {
      entry.shaderClass = String((target as Parameter).def && (target as any).def.shaderClass || DEFAULT_SHADER_CLASS);
      def = { name: '', label: path, type: 'string', value: path, animatable: false };
    } else {
      def = { name: '', label: path, type: 'string', value: path, animatable: false };   // property entry
    }
    let name = path.replace(/[^A-Za-z0-9_]/g, '_') || 'Entry', i = 1; const base = name; while (override.get(name)) name = `${base}${i++}`;   // inferred naming
    def.name = name; def.overrideEntry = entry;
    let created!: Parameter;
    app.record('Add Entry To Override', () => {
      if (created) override.insertParam(created, override.params.length); else created = override.add(def);
      entry.param = created; st.entries.set(created, { override, entry });
      trace(app, kind === 0 ? 'ConnectShaderToCnxPoint' : kind === 1 ? 'AddProp' : 'SetValue');
    }, () => { override.removeParam(created); st.entries.delete(created); });
    added.push(created);
  }
  app.events.emit('params'); app.events.emit('scene');
  setStatus(app, C, added.length ? S_OK : S_FALSE);
  return added;
}

function removeEntries(app: App, C: string, a: Record<string, any>) {
  if (unset(a.InputObjs)) throw fail(E_POINTER, `${C}: InputObjs is required (override entry parameters)`);
  const st = stateOf(app);
  const by = new Map<Property, Parameter[]>();
  for (const x of listOf(a.InputObjs)) {
    const p = nodeArg(app, x); const rec = isParameter(p) ? st.entries.get(p) : undefined;
    if (!rec) { logNya(app, C, `${(p as any)?.fullName ?? String(x)} is not an override entry`); continue; }
    (by.get(rec.override) ?? by.set(rec.override, []).get(rec.override)!).push(p as Parameter);
  }
  for (const [ov, ps] of by) {
    const order = ps.map(p => ({ p, i: ov.params.indexOf(p) })).filter(x => x.i >= 0).sort((x, y) => y.i - x.i);   // sorted indices, removed highest first
    const rec = st.entries;
    app.record('Remove Entry From Override', () => { for (const { p } of order) { ov.removeParam(p); rec.delete(p); } },
      () => { for (const { p, i } of [...order].reverse()) { ov.insertParam(p, i); rec.set(p, { override: ov, entry: entryOf(p)! }); } });
  }
  trace(app, 'SIRemoveEntryFromOverride');
  app.events.emit('params'); app.events.emit('scene');
  setStatus(app, C, S_OK);
}

/** The override entries (live ones) whose path resolves to `target` on the objects their override applies to. */
function entriesDriving(app: App, target: Parameter): { override: Property; entry: OverrideEntry }[] {
  const out: { override: Property; entry: OverrideEntry }[] = [];
  for (const rec of stateOf(app).entries.values()) {
    if (!rec.override.params.includes(rec.entry.param)) continue;
    for (const o of overrideObjects(app, rec.override)) {
      const hit = rec.entry.kind === 1 ? o.allProperties().some(p => p === target.owner && relativePath(p) === rec.entry.path) : resolvePath(o, rec.entry.path) === target;
      if (hit) { out.push(rec); break; }
    }
  }
  return out;
}

function getOriginalValue(app: App, C: string, a: Record<string, any>) {
  const t = nodeArg(app, unset(a.Target) ? null : listOf(a.Target)[0]);
  if (!isParameter(t)) throw fail(E_POINTER, `${C}: Target is required (an overridden parameter)`);
  if (unset(a.Time)) throw fail(E_INVALIDARG, `${C}: Time is required`);
  const frames = Number(a.Time); if (!Number.isFinite(frames)) throw fail(E_INVALIDARG, `${C}: Time must be a number of frames`);
  if (!entriesDriving(app, t).length) { logMsgId(app, C, 7, 'error'); throw fail(E_FAIL, `${C}: ${t.fullName} is not overridden`); }
  logNya(app, C, 'the override effect is not modelled: the value without the override is the parameter value');
  const fc = app.anim.fcurve(t);
  const v = fc && fc.keys.length ? fc.eval(frames) : t.value;
  const value = Array.isArray(v) ? [...v] : v;
  a.Value = value; setStatus(app, C, S_OK);
  return value;
}
function getOverriddenParameters(app: App, C: string, a: Record<string, any>) {
  const t = nodeArg(app, unset(a.Target) ? null : listOf(a.Target)[0]);
  if (!isParameter(t)) throw fail(E_POINTER, `${C}: Target is required (an override entry parameter)`);
  const out: Parameter[] = [];
  const rec = stateOf(app).entries.get(t);
  if (!rec) { logMsgId(app, C, 7); a.OutputObjs = out; setStatus(app, C, S_OK); return out; }   // not an override entry: warning only
  for (const o of overrideObjects(app, rec.override)) {
    if (rec.entry.kind === 1) { const pr = o.allProperties().find(p => relativePath(p) === rec.entry.path); if (pr) for (const q of pr.params) if (!out.includes(q)) out.push(q); }
    else { const p = resolvePath(o, rec.entry.path); if (p && !out.includes(p)) out.push(p); }
  }
  a.OutputObjs = out; setStatus(app, C, S_OK);
  return out;
}

export function registerPropertyTasksB15bOverride(app: App) {
  const cat = 'Property';
  app.register({
    name: 'SIAddShaderEntryToOverride', label: 'Add Shader Entry To Override', category: cat, description: 'Add Shader Entry To Override',
    args: [{ name: 'PresetObj', default: null }, { name: 'InputObj', default: null }, { name: 'Path', default: '' }, { name: 'Name', default: '' }, { name: 'Type', default: 0 }],
    execute: (app, a) => addEntry(app, 'SIAddShaderEntryToOverride', a, 0),
  });
  app.register({
    name: 'SIAddParameterEntryToOverride', label: 'Add Parameter Entry To Override', category: cat, description: 'Add Parameter Entry To Override',
    args: [{ name: 'InputObj', default: null }, { name: 'InputObjs', default: null }, { name: 'Value', default: null }, { name: 'Path', default: '' }, { name: 'Type', default: 2 }],
    execute: (app, a) => addEntry(app, 'SIAddParameterEntryToOverride', a, 2),
  });
  app.register({
    name: 'SIAddConnectionEntryToOverride', label: 'Add Connection Entry To Override', category: cat, description: 'Add Connection Entry To Override',
    args: [{ name: 'InputObj', default: null }, { name: 'InputObjs', default: null }, { name: 'Value', default: null }, { name: 'Path', default: '' }, { name: 'Type', default: 0 }],
    execute: (app, a) => addEntry(app, 'SIAddConnectionEntryToOverride', a, 0),
  });
  app.register({
    name: 'SIAddEntryToOverride', label: 'Add Entry To Override', category: cat, description: 'Add Entry To Override',
    args: [{ name: 'InputObj', default: null }, { name: 'InputObjs', default: null }, { name: 'Type', default: 65535 }],
    execute: (app, a) => addEntry(app, 'SIAddEntryToOverride', a, 65535),
  });
  app.register({
    name: 'SIStoreProp', label: 'Store Selected Properties', category: cat, description: 'Store Selected Properties',
    args: [{ name: 'InputObjs', default: null }, { name: 'InputObj', default: null }, { name: 'Type', default: 1 }],
    execute: (app, a) => addEntry(app, 'SIStoreProp', a, 1),
  });
  app.register({
    name: 'SIRemoveEntryFromOverride', label: 'Remove Entries from Override', category: cat, description: 'Remove Entries from Override',
    args: [{ name: 'InputObjs', default: null }], execute: (app, a) => removeEntries(app, 'SIRemoveEntryFromOverride', a),
  });
  app.register({
    name: 'SIGetOriginalValueOfOverridden', label: 'Get original value of overridden parameter', category: cat, undoable: false,
    description: 'Get original value of overridden parameter',
    args: [{ name: 'Target', default: null }, { name: 'Time', default: null }, { name: 'Value', default: null }],
    execute: (app, a) => getOriginalValue(app, 'SIGetOriginalValueOfOverridden', a),
  });
  app.register({
    name: 'SIGetOverriddenParameters', label: 'Get a list of overridden parameters affected by an override entry', category: cat, undoable: false,
    description: 'Get a list of overridden parameters affected by an override entry',
    args: [{ name: 'Target', default: null }, { name: 'OutputObjs', default: null }],
    execute: (app, a) => getOverriddenParameters(app, 'SIGetOverriddenParameters', a),
  });
}
