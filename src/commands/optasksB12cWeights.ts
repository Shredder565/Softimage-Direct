// Ledger row CMD-B12c (optasks.dll), part 2: envelope weight editing and weight-map connections.
//   SIModifyFlexEnvWght SISymEnvWeight LockEnvelopeWeights ConnectWeightMap AddMappingNode
// Brief: docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md, section 3. Original code from that prose only.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model, Cluster, Operator, Property } from '../core/scene';
import { num, bool } from '../core/params';
import { buildPointMap } from '../core/symmetry';
import { outConnections } from './operatorsScriptsOps';
import {
  S_OK, S_FALSE, SI_CANCELLED, E_INVALIDARG, E_POINTER, MSG_NO_VALID_INPUT, MSG_CYCLE, CLS, type CsItem,
  fail, setStatus, warn, logNya, boolOf, unset, nodeOf, collectionItems, itemPoints, meshOf, ownerObject, newPointCluster,
  envelopeOf, envelopeProperty, envelopeOfProperty, isEnvelopeProperty, envSnapshot, extraOperators, weightMapPorts, hasCycle,
  LockEnvelopeWeightsOperator, WeightMapsMixerOperator,
} from './optasksB12cShared';

/** An envelope weight property argument; unset = the selected envelope property, or the envelope property of the
 *  selected (or component-selected) enveloped object (inferred: the argument handler's selection default). */
function envPropArg(app: App, v: any): Property | null {
  if (!unset(v)) { const n = nodeOf(app, v); if (isEnvelopeProperty(n)) return n; const o = n instanceof X3DObject ? n : null; const env = o ? envelopeOf(o) : null; return o && env ? envelopeProperty(o, env) : null; }
  const sel = app.selection.find(n => isEnvelopeProperty(n)) as Property | undefined; if (sel) return sel;
  const o = app.compSel?.obj ?? app.selectedObjects.find(x => !!envelopeOf(x)); const env = o ? envelopeOf(o) : null;
  return o && env ? envelopeProperty(o, env) : null;
}
const meshPositions = (o: X3DObject) => (o.primitive?.geomUpTo('modeling') ?? meshOf(o))?.positions ?? new Float32Array(0);

// ------------------------------------------------------------------ SIModifyFlexEnvWght
/** Mode values (worker not read, open question 5). inferred from the SDK: 0 absolute, 1 add, 2 percentage of current. */
function modifyFlexEnvWght(app: App, a: Record<string, any>) {
  const C = 'SIModifyFlexEnvWght';
  // UnPackArg: SubComp must be a sub-component element (type 7)
  const sub = collectionItems(app, a.SubComp)[0];
  if (!sub?.sub || !sub.obj) throw fail(E_INVALIDARG, `${C}: SubComp is not a sub-component`);
  const prop = envPropArg(app, a.PropObj); const env = envelopeOfProperty(prop);
  if (!prop || !env) throw fail(E_POINTER, `${C}: no envelope weight property`);
  const name = unset(a.Name) ? '' : String(a.Name);
  const k = env.deformers.findIndex(d => d.name === name || d.fullName === name);
  if (k < 0) throw fail(E_INVALIDARG, `${C}: the envelope has no deformer named "${name}"`);   // inferred: lookup failure
  const mode = Number(a.Mode) || 0; const value = Number(a.Value ?? 100); const normalize = boolOf(a.Normalize, true);
  if (![0, 1, 2].includes(mode)) throw fail(E_INVALIDARG, `${C}: Mode ${a.Mode}`);   // inferred
  logNya(app, C, `the numeric meaning of Mode ${mode} (taken as ${['absolute', 'add', 'percentage of current'][mode]})`, 'open question 5');
  const pts = itemPoints(sub) ?? []; const obj = ownerObject(prop); const prim = obj?.primitive;
  const restore = envSnapshot(env); let after: (() => void) | null = null;
  app.record(C, () => {
    if (after) { after(); if (prim) prim.dirty = true; return; }
    for (const i of pts) {
      const w = env.weights[i]; if (!w) continue;
      const cur = w[k] * 100;
      const nv = Math.max(0, Math.min(100, mode === 0 ? value : mode === 1 ? cur + value : cur * value / 100));
      w[k] = nv / 100;
      if (normalize) {   // the other deformers' weights of the point share what is left
        let others = 0; for (let j = 0; j < w.length; j++) if (j !== k) others += w[j];
        const left = 1 - w[k];
        if (others > 0) for (let j = 0; j < w.length; j++) { if (j !== k) w[j] *= left / others; }
      }
    }
    after = envSnapshot(env); if (prim) prim.dirty = true;
  }, () => { restore(); if (prim) prim.dirty = true; });
  a.OutputObj = prop; setStatus(app, C, S_OK);
  return prop;
}

// ------------------------------------------------------------------ SISymEnvWeight
/** Target of SISymEnvWeight: 6 component, 7 sub-component, 4 cluster, 2 object (inferred: the type an object item gets). */
interface SymTarget { type: 2 | 4 | 6 | 7; obj: X3DObject; points: number[] | null }
function symTarget(app: App, v: any): SymTarget | null {
  const items: CsItem[] = collectionItems(app, v);
  // this build has no single "component" element, so every tagged component is a sub-component (type 7)
  const s = items.find(it => it.sub && it.obj); if (s) return { type: 7, obj: s.obj!, points: itemPoints(s) };
  for (const it of items) {
    if (it.node instanceof Cluster && it.obj) return { type: 4, obj: it.obj, points: it.node.compKind === 'pnt' ? [...it.node.elements].map(Number) : [] };
    if (it.node instanceof X3DObject && it.obj && it.obj.primitive) return { type: 2, obj: it.obj, points: null };
  }
  return null;
}
const ownerModel = (n: Node | null): Model | null => { const o = ownerObject(n); return o?.model ?? null; };
function symEnvWeight(app: App, a: Record<string, any>) {
  const C = 'SISymEnvWeight';
  const target = symTarget(app, a.SubComp);
  // PropObj: given, else the envelope of the target's primitive (or the first envelope weight property among its inputs)
  let prop: Property | null = unset(a.PropObj) ? null : (() => { const n = nodeOf(app, a.PropObj); return isEnvelopeProperty(n) ? n : null; })();
  if (!prop && target) { const env = envelopeOf(target.obj); prop = env ? envelopeProperty(target.obj, env) : null; }
  if (!prop) warn(app, C, MSG_NO_VALID_INPUT, 'no envelope weight property');
  const env = envelopeOfProperty(prop);
  // MappingTemplate: given, else the symmetry template of the model owning the first deformer (or the property's owner)
  let template: Property | null = null;
  if (!unset(a.MappingTemplate)) { const n = nodeOf(app, a.MappingTemplate); template = n instanceof Property ? n : null; }
  else if (env && prop) { const m = env.deformers[0]?.model ?? ownerModel(prop) ?? app.scene.root; template = m.properties.find(p => p.type === 'symmetrytemplate') ?? null; }
  if (prop && !template) warn(app, C, MSG_NO_VALID_INPUT, 'no symmetry mapping template');
  if (!prop || !env || !template) { setStatus(app, C, S_FALSE); return undefined; }
  const obj = ownerObject(prop)!; const pos = meshPositions(obj); const n = pos.length / 3;
  const points = target?.obj === obj && target.points ? target.points : Array.from({ length: n }, (_, i) => i);
  // deformer mapping of the template (pairs of deformer names)
  const partner = env.deformers.map((_, i) => i);
  for (const [l, r] of ((template as any).pairs ?? []) as [string, string][]) {
    const i = env.deformers.findIndex(d => d.name === l), j = env.deformers.findIndex(d => d.name === r);
    if (i >= 0 && j >= 0) { partner[i] = j; partner[j] = i; }
  }
  const plane = (['YZ', 'XZ', 'XY'] as const)[Number(template.val('plane')) || 0] ?? 'YZ';
  logNya(app, C, `how the symmetric point of each point is found; the point at the mirrored rest position across ${plane} is used`, 'section 3 SISymEnvWeight');
  const map = buildPointMap(pos, plane, 1e-3);
  const src = env.weights.map(w => Float32Array.from(w)); const writes = new Map<number, Float32Array>();
  for (const i of points) {
    const j = map.get(i); if (j === undefined || j === i || !src[i]) continue;   // inferred: points on the plane are left alone
    const w = new Float32Array(src[i].length); for (let d = 0; d < w.length; d++) w[partner[d] ?? d] = src[i][d];
    writes.set(j, w);
  }
  const restore = envSnapshot(env); const prim = obj.primitive;
  app.record(C, () => { for (const [j, w] of writes) env.weights[j] = Float32Array.from(w); if (prim) prim.dirty = true; }, () => { restore(); if (prim) prim.dirty = true; });
  a.OutputObj = prop; setStatus(app, C, S_OK);
  return prop;
}

// ------------------------------------------------------------------ LockEnvelopeWeights
/** One index or an array of indices, each converted to unsigned 32-bit; null when not given. */
function u32List(v: any): number[] | null {
  if (v === undefined || v === null) return null;
  const raw: any[] = Array.isArray(v) ? v.flat(Infinity) : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v];
  return raw.map(x => Number(x) >>> 0);
}
function lockEnvelopeWeights(app: App, a: Record<string, any>) {
  const C = 'LockEnvelopeWeights';
  const prop = envPropArg(app, a.PropObj); const env = envelopeOfProperty(prop);
  if (!prop || !env) { setStatus(app, C, S_FALSE); return undefined; }   // 1. no PropObj
  const points = u32List(a.Points), deformers = u32List(a.Deformers);
  if (!points) throw fail(E_POINTER, `${C}: no point array`);
  if (!points.length) { setStatus(app, C, S_FALSE); return undefined; }   // 2. no points
  if (!deformers) throw fail(E_POINTER, `${C}: no deformer array`);
  const locked = boolOf(a.Locked, true);
  // 4. the lock operator connected to the property, else a new one (connect mode 3), recorded
  let op = outConnections(prop).find((x): x is LockEnvelopeWeightsOperator => x instanceof LockEnvelopeWeightsOperator) ?? null;
  if (!op) {
    const nop = new LockEnvelopeWeightsOperator(prop); nop.parent = prop; op = nop;
    app.record('Apply Lock Envelope Weights Op', () => { outConnections(prop).push(nop); extraOperators.add(nop); }, () => { const l = outConnections(prop); const i = l.indexOf(nop); if (i >= 0) l.splice(i, 1); extraOperators.delete(nop); });
  }
  // 3. previous state of these pairs, for undo
  const lop = op; const before = new Map<string, boolean>(); for (const p of points) for (const d of deformers) before.set(`${p}:${d}`, lop.isLocked(p, d));
  const envLocked = new Set(env.locked);
  app.record(C, () => {
    // 5. every (point, deformer) pair gets Locked
    for (const p of points) for (const d of deformers) lop.setLock(p, d, locked);
    // inferred: a point whose every deformer is locked is a locked point of the envelope (skipped by the weight tools);
    // unlocking frees the point
    for (const p of points) { if (!locked) env.locked.delete(p); else if (env.deformers.every((_, k) => lop.isLocked(p, k))) env.locked.add(p); }
    prop.set('locked', env.locked.size);
  }, () => { for (const [k, v] of before) { const [p, d] = k.split(':').map(Number); lop.setLock(p, d, v); } env.locked = new Set(envLocked); prop.set('locked', env.locked.size); });
  a.OutputObj = op; setStatus(app, C, S_OK);
  return op;   // 6. OutputObj = the lock operator
}

// ------------------------------------------------------------------ ConnectWeightMap / AddMappingNode
const operatorArg = (app: App, v: any): Operator | null => { const n = nodeOf(app, v); return n instanceof Operator ? n : null; };
/** The ConnectWeightMap worker; returns S_OK or SI_CANCELLED (the connection would close a cycle). */
function connectWeightMapCore(app: App, C: string, op: Operator, map: Node): number {
  const ports = weightMapPorts(op);
  const before = hasCycle(app, map);   // 2. CycleChecking before
  const old = { a: ports.a, b: ports.b };
  const connect = () => { ports.a = map; if (ports.hasB && !old.b) ports.b = map; };   // 3. port A, and port B when free
  connect();
  const after = hasCycle(app, map);    // 4. CycleChecking after
  if (!before && after) {
    ports.a = old.a; ports.b = old.b;
    warn(app, C, MSG_CYCLE, `connecting ${map.fullName} to ${op.fullName} would create a cycle`);
    return SI_CANCELLED;
  }
  // 5. recorded for undo (operator, property, its primitive / object / owner by reference)
  app.record(C, connect, () => { ports.a = old.a; ports.b = old.b; });
  return S_OK;
}
function connectWeightMap(app: App, a: Record<string, any>) {
  const C = 'ConnectWeightMap';
  const op = operatorArg(app, a.Operator); if (!op) throw fail(E_POINTER, `${C}: no operator`);
  const map = nodeOf(app, a.PropObj); if (!(map instanceof Property)) throw fail(E_POINTER, `${C}: no weight map`);
  setStatus(app, C, connectWeightMapCore(app, C, op, map));
  return undefined;
}
function addMappingNode(app: App, a: Record<string, any>) {
  const C = 'AddMappingNode';
  const prop = nodeOf(app, unset(a.PropObj) ? app.selection[0] : a.PropObj);
  if (!(prop instanceof Property)) throw fail(E_POINTER, `${C}: no weight map property`);
  const owner = ownerObject(prop); if (!owner || !meshOf(owner)) throw fail(E_INVALIDARG, `${C}: ${prop.fullName} is not on a geometry`);   // inferred
  const op = unset(a.Operator) ? null : operatorArg(app, a.Operator);
  if (!unset(a.Operator) && !op) throw fail(E_POINTER, `${C}: ${a.Operator} is not an operator`);   // inferred
  // 1. a point cluster on all points (at the current frame); inferred name: this build's default point cluster name
  const cl = newPointCluster(owner, 'Point');
  // 2. a weight map on it, renamed MappingNode
  const map = new Property('MappingNode', 'weightmap', [num('weight', 1, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable')]);
  (map as any).values = new Map<number, number>(); (map as any).siClass = CLS.weightMap;
  app.record('Apply Weight Map', () => { owner.addCluster(cl); cl.addProperty(map); }, () => { cl.removeProperty(map); owner.removeCluster(cl); });
  // 3. the weight maps mixer with inputs [new map, PropObj]
  const mixer = new WeightMapsMixerOperator([map, prop]); mixer.parent = owner.primitive;
  app.record('Apply Weight Maps Mixer', () => { extraOperators.add(mixer); }, () => { extraOperators.delete(mixer); });
  // 4. the mixer output goes to the operator
  if (op) {
    const r = connectWeightMapCore(app, C, op, mixer);
    setStatus(app, C, r);
  } else {
    logNya(app, C, 'which argument selects the element-reference connect path (flag at task +0x30); with no Operator the mixer is referenced from the property owner', 'section 3 AddMappingNode');
    const l = outConnections(owner); app.record('Connect Mixer', () => l.push(mixer), () => { const i = l.indexOf(mixer); if (i >= 0) l.splice(i, 1); });
    setStatus(app, C, S_OK);
  }
  a.MappingNodeProp = map; a.MapMixerOp = mixer;
  return { MappingNodeProp: map, MapMixerOp: mixer };
}

// ------------------------------------------------------------------ registration
export function registerOptasksB12cWeightCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  reg({
    name: 'SIModifyFlexEnvWght', label: 'Modify Flexible Envelope Weighting', category: 'Deformation', description: 'Set Modify Weight Prop Values Task',
    args: [{ name: 'PropObj', default: null }, { name: 'Name', default: '' }, { name: 'SubComp', default: null }, { name: 'Mode', default: 0 }, { name: 'Value', default: 100 }, { name: 'Normalize', default: true }],
    execute: (app, a) => modifyFlexEnvWght(app, a),
  });
  reg({
    name: 'SISymEnvWeight', label: 'Apply Symmetry on Envelope Weight', category: 'Deformation', description: 'Apply EnvelopeWeight mapping to Symmetry points',
    args: [{ name: 'PropObj', default: null }, { name: 'SubComp', default: null }, { name: 'MappingTemplate', default: null }],
    execute: (app, a) => symEnvWeight(app, a),
  });
  reg({
    name: 'LockEnvelopeWeights', label: 'Lock Envelope Weights', category: 'Deformation', description: 'Lock Envelope Weights Task',
    args: [{ name: 'PropObj', default: null }, { name: 'Points', default: null }, { name: 'Deformers', default: null }, { name: 'Locked', default: true }],
    execute: (app, a) => lockEnvelopeWeights(app, a),
  });
  reg({
    name: 'ConnectWeightMap', label: 'Connect Weight Map', category: 'Deformation|Paint', description: 'Connect a Weight Map Task',
    args: [{ name: 'Operator', default: null }, { name: 'PropObj', default: null }],
    execute: (app, a) => connectWeightMap(app, a),
  });
  reg({
    name: 'AddMappingNode', label: 'Add Mapping Node', category: 'Deformation|Paint', description: 'Add a Mapping Node Task',
    args: [{ name: 'Operator', default: null }, { name: 'PropObj', default: null }, { name: 'MappingNodeProp', default: null }, { name: 'MapMixerOp', default: null }],
    execute: (app, a) => addMappingNode(app, a),
  });
}
