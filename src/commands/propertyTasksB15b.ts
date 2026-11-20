// Ledger row CMD-B15b: commands of propertytasks.dll (custom parameters, materials, cluster-property values,
// "Add property extended") plus the registration of the sibling files:
//   SIAddCustomParam SIAddCustomParameter SICreateMaterialDD SICreateMaterial SetClusterPropertyValues
//   "Add property extended"
//   (propertyTasksB15bNormals.ts)   CreateUserNormals RemoveUserNormals SetVertexUserNormals SetPolygonUserNormals SetUserNormalValues
//   (propertyTasksB15bOverride.ts)  SIAddShaderEntryToOverride SIAddParameterEntryToOverride SIAddConnectionEntryToOverride
//                                   SIAddEntryToOverride SIStoreProp SIRemoveEntryFromOverride SIGetOriginalValueOfOverridden
//                                   SIGetOverriddenParameters
//   (propertyTasksB15bRetarget.ts)  siCreateRetargetMapping siWriteRetargetMapping siWriteRetargetComponentData
// Brief: docs/ghidra/cmd-b15b-propertytasks.md ("Wire contract" blocks) and items 22-26 of docs/re/WIRE_CORRECTIONS_B15.md.
// Original code from that prose only. The user tab / keyword commands of item 26 are registered literally in
// uiGroupViewTasks.ts (CMD-B7a, siuitasks.dll); they are not re-implemented here.
//
// Earlier inferred registrations of SIAddCustomParam, SIAddCustomParameter, SICreateMaterial and SIStoreProp
// (animateSurface.ts, anim.ts, viewEditPropertyMore.ts, model.ts) are removed: this file replaces them.
// Stand-in models (original, not attested): cluster property values in `values` maps, the override entries as
// parameters of the override property, the set-cluster-values operator as a record on the property.
import { App } from '../core/commands';
import { X3DObject, Property, Material, makeSiShader } from '../core/scene';
import { Parameter, ParamDef } from '../core/params';
import {
  S_OK, E_OUTOFMEMORY, E_INVALIDARG, E_POINTER, E_FAIL, E_ACCESSDENIED, S_NOTHING_TO_DO, S_CANCELLED, DBL_MAX,
  stateOf, fail, failMsg, setStatus, logNya, logMsgId, trace, unset, listOf, nodeArg, enumArg, toNumber, lockLevel, valueDimension, clusterOf, sortedElements,
} from './propertyTasksB15bShared';
import { registerPropertyTasksB15bNormals } from './propertyTasksB15bNormals';
import { registerPropertyTasksB15bOverride } from './propertyTasksB15bOverride';
import { registerPropertyTasksB15bRetarget } from './propertyTasksB15bRetarget';

const VT_NAMES: Record<string, number> = { siEmpty: 0, siInt2: 2, siInt4: 3, siFloat: 4, siDouble: 5, siString: 8, siBool: 11, siByte: 16, siUByte: 17, siUInt2: 18, siUInt4: 19, siInt: 22, siUInt: 23 };
const VT_INTEGER = new Set([2, 3, 16, 17, 18, 19, 22, 23]);
/** The "bit not in mask 0xcf093c for VT < 24" test of the worker. */
const vtSupported = (vt: number) => vt < 24 && ((0xcf093c >>> vt) & 1) === 1;

/** ValidateNameSyntax stand-in (the rule itself is not in the note): letters, digits and underscores, not starting with a digit. */
export function validateName(s: string): string {
  let v = s.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(v)) v = '_' + v;
  return v;
}

// ------------------------------------------------------------------ SIAddCustomParam / SIAddCustomParameter
function addCustomParam(app: App, C: string, a: Record<string, any>): Parameter | null {
  let target: any = unset(a.InputObj) ? app.selection[0] : listOf(a.InputObj).map(x => nodeArg(app, x))[0];
  if (!(target instanceof Property)) throw fail(E_INVALIDARG, `${C}: InputObj must be a custom property set (got ${target?.fullName ?? 'nothing'})`);
  const prop: Property = target;
  // UnPackArg
  let script = unset(a.ScriptName) ? '' : String(a.ScriptName);
  if (script === '') { setStatus(app, C, E_OUTOFMEMORY); throw fail(E_OUTOFMEMORY, `${C}: ScriptName is empty`); }
  const fixed = validateName(script); if (fixed !== script) script = fixed;
  const vt = enumArg(a.VarType, VT_NAMES, 5);
  const min = toNumber(a.MinValue, 0), max = toNumber(a.MaxValue, 1);
  let sMin = toNumber(a.SuggMin, 0), sMax = toNumber(a.SuggMax, 0);
  const classification = toNumber(a.Classification, 32768) & 0xffff;
  let caps = toNumber(a.Capabilities, 5) & 0xffff;
  // Do
  const label = unset(a.ParamName) ? script : String(a.ParamName);
  const description = unset(a.Description) ? script : String(a.Description);
  const isString = vt === 8;
  if (!isString && sMin === sMax) { sMin = min; sMax = max; }
  // worker
  if (!vtSupported(vt)) throw failMsg(app, C, E_FAIL, 0x2b, `VarType ${vt}`);
  if (!isString) {
    // inferred: the range validation (0x180014f30) fails with E_INVALIDARG
    if (min > max) throw fail(E_INVALIDARG, `${C}: MinValue ${min} is greater than MaxValue ${max}`);
    if (sMin > sMax) throw fail(E_INVALIDARG, `${C}: SuggMin ${sMin} is greater than SuggMax ${sMax}`);
  }
  let name = script, i = 1; while (prop.get(name)) name = `${script}${i++}`;   // unique-name service
  if (name !== script) logMsgId(app, C, 0x2c);
  if (isString) caps &= ~1;
  if (caps & 0x800) caps &= ~0x1000;
  caps |= 4;   // "bit 4 is always added" (the note's bit numbering: the value 4)
  const conv = (v: any): any => isString ? (unset(v) ? '' : String(v)) : vt === 11 ? !!toNumber(v) : VT_INTEGER.has(vt) ? Math.trunc(toNumber(v)) : toNumber(v);
  const def: ParamDef = {
    name, label, type: isString ? 'string' : vt === 11 ? 'bool' : VT_INTEGER.has(vt) ? 'int' : 'double',
    value: conv(a.DefaultValue), desc: description,
    animatable: !!(caps & 1), readOnly: !!(caps & 2), keyable: !!(caps & 0x800), inspectable: !(caps & 8),
  };
  if (!isString && def.type !== 'bool') { def.min = conv(min); def.max = conv(max); def.uimin = conv(sMin); def.uimax = conv(sMax); }
  (def as any).varType = vt; (def as any).classification = classification; (def as any).capabilities = caps;
  (def as any).guid = unset(a.ParamGuid) ? newGuid() : String(a.ParamGuid);
  let created!: Parameter;
  app.record('Add Custom Parameter', () => {
    if (created) prop.insertParam(created, prop.params.length); else created = prop.add(def);
  }, () => { prop.removeParam(created); });
  if (caps & (0x800 | 0x1000)) stateOf(app).events.push('SI3D_KEYABLEPARAMETER_CHANGED');
  app.events.emit('params'); app.events.emit('scene');
  setStatus(app, C, S_OK);
  return created;
}
function newGuid(): string {
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
}

// ------------------------------------------------------------------ SICreateMaterial / SICreateMaterialDD
function createMaterial(app: App, C: string, a: Record<string, any>): Material {
  const preset = unset(a.PresetObj) ? null : a.PresetObj;
  const name = unset(a.Name) ? '' : String(a.Name);
  // UnPackArg: Objects (empty list when the variant is empty), AssignToList false clears it
  let objects: X3DObject[] = [];
  for (const x of listOf(a.Objects)) { const n = nodeArg(app, x); if (n instanceof X3DObject) objects.push(n); }
  const assignToList = unset(a.AssignToList) ? true : !!toNumber(a.AssignToList, 1);
  if (!assignToList) objects = [];
  const initialize = unset(a.Initialize) ? true : toNumber(a.Initialize, 1) === 1;
  // worker: library = Library, else the current library (the build has one list)
  if (!unset(a.Library)) logNya(app, C, 'the Library argument (the scene has one material library)');
  const lib = app.scene.materials;
  if (lockLevel(app.scene) === 1) throw fail(E_ACCESSDENIED, `${C}: the material library is locked`);
  let material: Material;
  let shader: ReturnType<typeof makeSiShader> = null;
  if (preset instanceof Material) material = preset;   // the preset object itself becomes the new material
  else {
    if (preset !== null) {
      const key = String(preset?.name ?? preset).replace(/\.Preset$/i, '').split(/[\\/]/).pop()!;
      shader = makeSiShader(key);
      if (!shader) throw fail(E_FAIL, `${C}: shader preset ${String(preset?.name ?? preset)} is not available`);
    }
    material = new Material(app.scene.uniqueName(name || 'Material'));
  }
  if (!initialize && shader) logNya(app, C, 'Initialize=False on the shader preset path (stored, use not read)');
  const oldName = material.name;
  app.record('Create material', () => {
    if (shader && material.surface !== shader) material.setSurface(shader);   // SIApplyShader on the new material
    if (name) { material.name = name; material.set('Name', name); }
    if (!lib.includes(material)) lib.push(material);   // F3DAddToLibrary
  }, () => {
    const k = lib.indexOf(material); if (k >= 0 && material !== preset) lib.splice(k, 1);
    if (name) { material.name = oldName; material.set('Name', oldName); }
    if (shader && material === preset) material.setSurface(null);
  });
  if (objects.length) {
    if (app.commands.has('SIAssignMaterial')) app.run('SIAssignMaterial', { Objects: objects, Material: material });
    else for (const o of objects) { const old = o.material; app.record('Assign', () => o.setMaterial(material), () => o.setMaterial(old)); }
  }
  a.OutputObjs = [material];
  setStatus(app, C, S_OK);
  return material;
}

// ------------------------------------------------------------------ SetClusterPropertyValues
export interface SetValuesRecord { offsets: number[]; values: number[]; dimension: number }

function setClusterPropertyValues(app: App, C: string, a: Record<string, any>) {
  const prop = nodeArg(app, unset(a.ClusterProp) ? null : listOf(a.ClusterProp)[0]);
  if (!(prop instanceof Property)) throw fail(E_POINTER, `${C}: ClusterProp is required (a cluster property)`);
  const cluster = clusterOf(prop);
  if (!cluster) throw failMsg(app, C, E_INVALIDARG, 0xf, `${prop.name} is not a cluster property`);
  const dim = valueDimension(prop);
  const elements = sortedElements(cluster);
  // UnPackArg: Offsets (empty = every element of the cluster)
  let offsets: number[] = listOf(a.Offsets).map(x => Math.trunc(toNumber(x, NaN)));
  if (offsets.some(n => !Number.isFinite(n) || n < 0)) throw failMsg(app, C, E_INVALIDARG, 0xf, prop.name);
  if (!offsets.length) offsets = elements.map((_, i) => i);
  const count = offsets.length;
  // Values: count, dimension, then count x dimension doubles
  const v = a.Values;
  const item = (x: any): number => (x === null || x === undefined || x === '') ? DBL_MAX : toNumber(x, NaN);
  let flat: number[];
  if (!Array.isArray(v)) {
    if (dim !== 1 || unset(v)) throw failMsg(app, C, E_INVALIDARG, 0xf, prop.name);
    flat = Array(count).fill(item(v));
  } else if (v.length === dim) {
    if (!v.some(x => typeof x === 'number' || (typeof x === 'string' && x !== '' && Number.isFinite(Number(x))))) throw failMsg(app, C, E_INVALIDARG, 0xf, prop.name);
    flat = []; for (let i = 0; i < count; i++) for (const x of v) flat.push(item(x));
  } else if (v.length === count * dim) flat = v.map(item);
  else throw failMsg(app, C, E_INVALIDARG, 0xf, prop.name);
  if (flat.some(Number.isNaN)) throw failMsg(app, C, E_INVALIDARG, 0xf, prop.name);
  const mode = enumArg(a.Mode, { siSetValueModeAbsolute: 0 }, 0);
  const clamp = !!toNumber(a.ClampValues, 0);
  // Do / worker
  if (lockLevel(prop) >= 4) throw fail(E_ACCESSDENIED, `${C}: the property is locked`);
  if (offsets.some(o => o >= elements.length)) throw failMsg(app, C, E_INVALIDARG, 0xf, `${prop.name}: offset out of range`);
  if (mode !== 0) { logNya(app, C, `Mode ${mode}: only the absolute mode is written (the merge rule of 0x18001c240 is not in the note)`); setStatus(app, C, S_OK); return; }
  if (clamp) logNya(app, C, 'ClampValues=True (the clamp range is not in the note; values stored unclamped)');
  const store: Map<number, number | number[]> = ((prop as any).values ??= new Map());
  const rec: SetValuesRecord = ((prop as any).setValuesOperator ??= { offsets: [], values: [], dimension: dim } as SetValuesRecord);
  const beforeStore = new Map(store), beforeRec: SetValuesRecord = { offsets: [...rec.offsets], values: [...rec.values], dimension: rec.dimension };
  app.record('Set Cluster Property Values', () => {
    // the operator keeps the merged offset / value arrays; the property shows the result
    const pos = new Map(rec.offsets.map((o, i) => [o, i]));
    offsets.forEach((o, k) => {
      const cur = pos.get(o);
      for (let d = 0; d < dim; d++) {
        const nv = flat[k * dim + d];
        if (nv === DBL_MAX) continue;   // leave unchanged
        if (cur === undefined) { /* appended below */ } else rec.values[cur * dim + d] = nv;
      }
      if (cur === undefined) {
        const base = store.get(elements[o]); const row: number[] = [];
        for (let d = 0; d < dim; d++) { const nv = flat[k * dim + d]; row.push(nv === DBL_MAX ? (Array.isArray(base) ? base[d] : (typeof base === 'number' && d === 0 ? base : 0)) : nv); }
        pos.set(o, rec.offsets.length); rec.offsets.push(o); rec.values.push(...row);
      }
      const at = pos.get(o)!; const out = rec.values.slice(at * dim, at * dim + dim);
      store.set(elements[o], dim === 1 ? out[0] : out);
    });
    rec.dimension = dim;
  }, () => { store.clear(); for (const [k, x] of beforeStore) store.set(k, x); rec.offsets = beforeRec.offsets; rec.values = beforeRec.values; rec.dimension = beforeRec.dimension; });
  trace(app, 'SetClusterPropertyValues');
  app.events.emit('scene');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ Add property extended
function addPropertyExtended(app: App, C: string, a: Record<string, any>): Property[] {
  const inputs: X3DObject[] = [];
  for (const x of listOf(a.InputObjs)) { const n = nodeArg(app, x); if (n instanceof X3DObject && !inputs.includes(n)) inputs.push(n); }
  if (!inputs.length) {
    logMsgId(app, C, 0x2b); setStatus(app, C, S_NOTHING_TO_DO); a.Value = []; return [];   // "nothing to do": logged, not an error
  }
  const prop = nodeArg(app, unset(a.Property) ? null : listOf(a.Property)[0]);
  if (!(prop instanceof Property)) throw fail(E_POINTER, `${C}: Property is required (an existing property object)`);
  const propagation = enumArg(a.PropagationType, { siDefaultPropagation: 0, siBranchPropagation: 1, siNodePropagation: 2, siInheritedPropagation: 3 }, 0);
  // autoinspect + animated-object question (message 0x3c)
  if (/inspect/i.test(prop.name) && (app as any).autoInspect !== false) {
    const animated = inputs.filter(o => !o.properties.some(p => p.name === prop.name) && [o.kinematics.local, ...o.properties].some(ps => ps.params.some(pp => app.anim.isAnimated(pp))));
    if (animated.length) {
      const ok = stateOf(app).hooks.confirmAnimated?.(animated.map(o => o.fullName)) ?? true;   // inferred: Yes without a UI
      if (!ok) { setStatus(app, C, S_CANCELLED); throw fail(S_CANCELLED, `${C}: cancelled by user`); }
    }
  }
  if (propagation > 1) logNya(app, C, `PropagationType ${propagation}: the branch / inherited propagation of the added property is not modelled; it is added to the listed objects only`);
  const out: Property[] = [];
  for (const o of inputs) {   // SIAddProp sub-task, add-existing variant (stand-in: an equivalent property instance on each object)
    trace(app, 'SIAddProp');
    let existing = o.properties.find(p => p.name === prop.name && p.type === prop.type);
    if (!existing) {
      const parentIsOwner = prop.parent === o;
      const copy = parentIsOwner ? prop : cloneProperty(prop);
      existing = copy;
      app.record('Add Property', () => { o.addProperty(copy); }, () => { o.removeProperty(copy); if (parentIsOwner) copy.parent = o; });
    }
    out.push(existing);
  }
  a.Value = out; a.CreatedObj = out[out.length - 1];
  setStatus(app, C, S_OK);
  return out;
}
export function cloneProperty(p: Property): Property {
  const c = new Property(p.name, p.type, p.params.map(q => ({ ...q.def, value: q.value })));
  for (const k of ['values', 'normals', 'uvs']) if ((p as any)[k] instanceof Map) (c as any)[k] = new Map((p as any)[k]);
  return c;
}

// ------------------------------------------------------------------ registration
export function registerPropertyTasksB15bCommands(app: App) {
  stateOf(app);
  const customArgs = () => [
    { name: 'InputObj', default: null }, { name: 'ScriptName', default: 'ParamName' }, { name: 'VarType', default: ':siDouble:siVariantType' },
    { name: 'DefaultValue', default: null }, { name: 'MinValue', default: 0 }, { name: 'MaxValue', default: 1 }, { name: 'Classification', default: 32768 },
    { name: 'Capabilities', default: 5 }, { name: 'SuggMin', default: 0 }, { name: 'SuggMax', default: 0 }, { name: 'ParamName', default: '' }, { name: 'Description', default: '' },
  ];
  app.register({
    name: 'SIAddCustomParam', label: 'Add Custom Parameter', category: 'Property', description: 'Add Custom Parameter',
    args: customArgs(), execute: (app, a) => addCustomParam(app, 'SIAddCustomParam', a),
  });
  app.register({
    name: 'SIAddCustomParameter', label: 'Low Level Add Custom Parameter', category: 'Property', description: 'Low Level Add Custom Parameter',
    args: customArgs(), execute: (app, a) => addCustomParam(app, 'SIAddCustomParameter', a),
  });
  const matArgs = (nameDefault: string) => [
    { name: 'PresetObj', default: null }, { name: 'Name', default: nameDefault }, { name: 'Library', default: null }, { name: 'Objects', default: null },
    { name: 'AssignToList', default: true }, { name: 'Initialize', default: true }, { name: 'OutputObjs', default: null },
  ];
  app.register({
    name: 'SICreateMaterialDD', label: 'CreateMaterial', category: 'Property', description: 'Creates a material and optionnally assigns to a list of objects',
    args: matArgs(''), execute: (app, a) => createMaterial(app, 'SICreateMaterialDD', a),
  });
  app.register({
    name: 'SICreateMaterial', label: 'CreateMaterial', category: 'Property', description: 'Creates a material and optionnally assigns to a list of objects',
    args: matArgs('Material'), execute: (app, a) => createMaterial(app, 'SICreateMaterial', a),
  });
  app.register({
    name: 'SetClusterPropertyValues', label: 'Set Cluster Property Values', category: 'Property', description: 'Set the values of a cluster property',
    args: [{ name: 'ClusterProp', default: null }, { name: 'Offsets', default: null }, { name: 'Values', default: null },
      { name: 'Mode', default: ':siSetValueModeAbsolute:siSetValueMode' }, { name: 'ClampValues', default: false }],
    execute: (app, a) => setClusterPropertyValues(app, 'SetClusterPropertyValues', a),
  });
  app.register({
    name: 'Add property extended', label: 'Add property extended', category: 'Property', description: 'Add property extended (handle singleton properties)',
    args: [{ name: 'Property', default: null }, { name: 'InputObjs', default: null }, { name: 'PropagationType', default: ':siDefaultPropagation:siPropagationType' }, { name: 'Value', default: null }],
    execute: (app, a) => addPropertyExtended(app, 'Add property extended', a),
  });
  registerPropertyTasksB15bNormals(app);
  registerPropertyTasksB15bOverride(app);
  registerPropertyTasksB15bRetarget(app);
}
