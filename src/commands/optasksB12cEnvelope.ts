// Ledger row CMD-B12c (optasks.dll), part 1: flexible envelope and cage deform apply, local reassignment.
//   SIApplyFlexEnv SIApplyFlexEnvWithWeight SIApplyDeformByCage SILocalAssignFlexEnv ResetFlexEnvPtsAssignment
// Brief: docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md, sections 2 and 3. Original code from that prose only.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, Operator, construction } from '../core/scene';
import * as S2 from '../core/scene2';
import { EnvelopeOperator, makeEnvelopeProperty } from '../core/envelope';
import { constructionModeOf } from './operatorsScripts';
import {
  S_OK, S_FALSE, MSG_NO_VALID_INPUT, MSG_LOCKED_POINTS, ENV_CREATED, ENV_REMOVED, CLS, type CsItem,
  setStatus, warn, logNya, notify, boolOf, step, unset, connectionGroups, collectionItems, objectsOf, deformersOf, itemPoints,
  meshOf, newPointCluster, envelopeOf, envelopeProperty, envSnapshot, LockEnvelopeWeightsOperator,
} from './optasksB12cShared';
import { outConnections } from './operatorsScriptsOps';

// ------------------------------------------------------------------ the shared envelope-apply driver
interface ApplyOpts {
  command: string;
  kind: 'envelope' | 'cage';
  interactive: boolean;
  assignNewDeformers: boolean;
  constructionMode: any;
  /** SIApplyFlexEnvWithWeight: the initial weights of each new envelope. */
  weights: number[] | null;
  /** The "refresh after apply" flag: set for both flexible envelope commands, not for cage. */
  refresh: boolean;
}
/** Group 0 = objects to deform, group 1 = deformers / cages. A single group (the selection) is split: inferred,
 *  for the envelope the objects with a polygon mesh are deformed and the rest are deformers; for the cage the last
 *  item is the cage. */
function splitConnectionSet(app: App, arg: any, kind: ApplyOpts['kind']): { targets: CsItem[]; refs: X3DObject[] } {
  const groups = connectionGroups(app, arg);
  if (groups.length >= 2) return { targets: groups[0], refs: objectsOf(groups[1]) };
  const g = groups[0] ?? [];
  if (kind === 'cage') return g.length > 1 ? { targets: g.slice(0, -1), refs: objectsOf(g.slice(-1)) } : { targets: g, refs: [] };   // inferred
  const isTarget = (it: CsItem) => !!it.sub || (!!it.obj && !!meshOf(it.obj) && it.node === it.obj && !['bone', 'null', 'eff', 'root'].includes(it.obj.type));
  return { targets: g.filter(isTarget), refs: objectsOf(g.filter(it => !isTarget(it))) };   // inferred
}
/** Per-object filter of the task: an object with polygon-mesh geometry, not one of the deformers. */
const deformable = (it: CsItem, refs: X3DObject[]) => !!it.obj && !!meshOf(it.obj) && !refs.includes(it.obj);

/** Component classes of the wrong-type message (0x428 then one of 0x429..0x42c). inferred: the order edge, polygon,
 *  sample, other. */
const WRONG_KIND: Record<string, number> = { edge: 0x429, poly: 0x42a, polygon: 0x42a, sample: 0x42b };

function applyDriver(app: App, a: Record<string, any>, o: ApplyOpts): Operator[] | undefined {
  const C = o.command;
  const saved = construction.mode;
  const mode = constructionModeOf(o.constructionMode) ?? construction.mode;
  construction.mode = mode;   // 1. context.constructionmode = ConstructionMode for the duration of the apply
  try {
    const { targets, refs: rawRefs } = splitConnectionSet(app, a.ConnectionSet, o.kind);
    const refs = o.kind === 'envelope' ? deformersOf(rawRefs) : rawRefs.filter(r => !!meshOf(r));
    // 2. count the valid objects; none -> message 0x29 (severity 4), S_FALSE, nothing changed
    const valid: CsItem[] = []; for (const it of targets) if (deformable(it, refs) && !valid.some(v => v.obj === it.obj)) valid.push(it);
    // inferred: an apply without any deformer / cage has no valid input either
    if (!valid.length || !refs.length) { warn(app, C, MSG_NO_VALID_INPUT, !valid.length ? 'no deformable object' : o.kind === 'cage' ? 'no cage object' : 'no deformer'); setStatus(app, C, S_FALSE); return undefined; }
    const rec = o.interactive;
    const created: Operator[] = [];   // 3. the CreatedObj output
    const touched: X3DObject[] = [];
    // 4. per object, in connection-set order
    for (const it of valid) {
      const obj = it.obj!; touched.push(obj);
      if (o.kind === 'cage') { created.push(applyCage(app, C, obj, refs, rec, mode)); continue; }
      const env = envelopeOf(obj);
      if (!env) { created.push(newEnvelope(app, C, obj, refs, rec, mode, o.weights)); continue; }
      addToExistingEnvelope(app, C, it, env, refs, rec, o.assignNewDeformers);
    }
    // 5. property-change notification; Undo fires the REMOVED notification first, then undoes the sub-tasks
    notify(app, C, ENV_CREATED, touched);
    step(app, rec, `${C} notification`, () => { /* fired above */ }, () => notify(app, C, ENV_REMOVED, touched));
    // 6. refresh after apply: a parameter-set task with true on each selected object; the parameter is not resolved
    if (o.refresh && app.selection.length) logNya(app, C, `the parameter set to true on each of the ${app.selection.length} selected item(s) after the apply (GUID at 0x1800d9088)`, 'open question 3');
    setStatus(app, C, S_FALSE);   // a non-interactive run that completed returns 1
    return created;
  } finally { construction.mode = saved; }   // inferred: the ambient mode is restored at the end
}

/** New envelope: point cluster EnvelopWeightCls, envelope operator with the auto-assign operator, initial weights. */
function newEnvelope(app: App, C: string, obj: X3DObject, deformers: X3DObject[], rec: boolean, mode: Operator['region'], init: number[] | null): Operator {
  const prim = obj.primitive!; const base = meshOf(obj)!;
  const op = new EnvelopeOperator(deformers, () => obj);
  op.region = mode;   // inferred: the operator goes into the ambient construction region set in step 1
  (op as any).siClass = CLS.envelope; (op as any).autoAssign = { siClass: CLS.envelopeAutoAssign };   // the auto-assign operator is always used
  op.setReferencePoses(); op.computeWeights(base, obj.globalMatrix());
  if (init) applyInitialWeights(app, C, obj, op, base.positions.length / 3, init);
  const cl = newPointCluster(obj, 'EnvelopWeightCls'); const prop = makeEnvelopeProperty(op);
  step(app, rec, 'Apply Flexible Envelope', () => { obj.addCluster(cl); cl.addProperty(prop); prim.addOperator(op); }, () => { prim.removeOperator(op); cl.removeProperty(prop); obj.removeCluster(cl); });
  return op;
}
/** EnvelopeWeights of SIApplyFlexEnvWithWeight. inferred layout (open question 1): point-major, one value per
 *  deformer, in the 0..100 scale of the envelope weight property; each point is normalised to sum 1 here. */
function applyInitialWeights(app: App, C: string, obj: X3DObject, op: EnvelopeOperator, nPoints: number, init: number[]) {
  const nd = op.deformers.length; let done = 0;
  for (let i = 0; i < nPoints; i++) {
    if ((i + 1) * nd > init.length) break;
    const w = new Float32Array(nd); let s = 0; for (let k = 0; k < nd; k++) { const v = Math.max(0, Number(init[i * nd + k]) || 0); w[k] = v; s += v; }
    if (s > 0) for (let k = 0; k < nd; k++) w[k] /= s;
    op.weights[i] = w; done++;
  }
  if (done < nPoints) logNya(app, C, `EnvelopeWeights covers ${done} of the ${nPoints} point(s) of ${obj.name} (${nd} deformer(s) per point assumed); the other points keep the auto-assigned weights`, 'open question 1');
}
/** Existing envelope: selected points join the envelope cluster (SIAddToCluster), then the "add envelope deformers" task. */
function addToExistingEnvelope(app: App, C: string, it: CsItem, env: EnvelopeOperator, deformers: X3DObject[], rec: boolean, assignNew: boolean) {
  const obj = it.obj!; const prop = envelopeProperty(obj, env); const cl = obj.clusters.find(c => prop && c.properties.includes(prop)) ?? null;
  // the selected sub-components of that object: the item's own components, else the component selection
  let kind: string | null = null; let pts: number[] = [];
  if (it.sub) { kind = it.sub.kind; pts = it.sub.indices; }
  else if (app.compSel && app.compSel.obj === obj) { const c = app.compSel; kind = c.kind === 'point' ? 'pnt' : c.kind; pts = c.kind === 'point' ? [...c.points] : []; if (c.kind !== 'point' && !c.edges.size && !c.polygons.size) kind = null; if (c.kind === 'point' && !c.points.size) kind = null; }
  if (kind && cl) {
    if (kind === cl.compKind) {
      const add = pts.filter(i => !cl.elements.has(i));
      if (add.length) step(app, rec, 'SIAddToCluster', () => add.forEach(i => cl.elements.add(i)), () => add.forEach(i => cl.elements.delete(i)));
    } else { warn(app, C, 0x428, obj.name); warn(app, C, WRONG_KIND[kind] ?? 0x42c, `${kind} components of ${obj.name} skipped`); }
  }
  // "add envelope deformers" sub-task (a3293410-...): the group-1 deformers join the existing envelope
  const add = deformers.filter(d => !env.deformers.includes(d)); if (!add.length) return;
  const restore = envSnapshot(env); const prim = obj.primitive!;
  let after: (() => void) | null = null;
  step(app, rec, 'Add Flexible Envelope Deformer', () => {
    if (after) { after(); prim.dirty = true; (prop as any)?.refreshDeformers?.(); return; }
    env.addDeformers(add);
    // AssignNewDeformers: the new deformers get points assigned. inferred: the auto-assignment is re-run on the
    // unlocked points with the enlarged deformer list; otherwise the new deformers start with weight 0.
    if (assignNew) env.computeWeights(prim.geomUpTo('modeling') ?? meshOf(obj)!, obj.globalMatrix());
    after = envSnapshot(env); prim.dirty = true; (prop as any)?.refreshDeformers?.();
  }, () => { restore(); prim.dirty = true; (prop as any)?.refreshDeformers?.(); });
}

/** Cage per-object step: point cluster CageWeightCls, cage deform operator with the cage auto-assign operator. */
function applyCage(app: App, C: string, obj: X3DObject, cages: X3DObject[], rec: boolean, mode: Operator['region']): Operator {
  const prim = obj.primitive!;
  const op = S2.makeRefDeformOperator('by Cage', cages, () => obj, null)!;
  op.region = mode; (op as any).siClass = CLS.cageDeform; (op as any).autoAssign = { siClass: CLS.cageAutoAssign };
  const cl = newPointCluster(obj, 'CageWeightCls');
  step(app, rec, 'Set Deform By Cage', () => { obj.addCluster(cl); prim.addOperator(op); }, () => { prim.removeOperator(op); obj.removeCluster(cl); });
  // 2.-4. for every cage, at the current time: the helper property (class 0x1800d8d38) and its nine parameters, and
  // parameter 0x1800d8b88 of a second property set to false. Neither class nor the parameters are named (open
  // question 2); the cage's rest state is taken by the operator itself on its first evaluation, done here.
  prim.mesh();
  logNya(app, C, `the cage helper property (class 0x1800d8d38), its nine rest-state parameters and the second cage property (0x1800d8cf8) of ${cages.map(c => c.name).join(', ')}`, 'open question 2');
  return op;
}

// ------------------------------------------------------------------ local (re)assignment
/** Distance of a world point to a deformer at its reference pose (bones are segments, other deformers points). */
function distanceTo(env: EnvelopeOperator, d: X3DObject, p: THREE.Vector3): number {
  const M = env.refPoses.get(d) ?? d.globalMatrix(); const a = new THREE.Vector3().setFromMatrixPosition(M);
  const L = Number(d.get('length')?.value ?? 0);
  if (d.type !== 'bone' || !(L > 0)) return p.distanceTo(a);
  const b = new THREE.Vector3(L, 0, 0).applyMatrix4(M); const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.add(ab.multiplyScalar(t)));
}
function localAssign(app: App, a: Record<string, any>, C: string, reset: boolean) {
  const subItems = collectionItems(app, a.SubComp).filter(it => !!it.sub && !!it.obj);
  if (!subItems.length) { setStatus(app, C, S_FALSE); return undefined; }   // no SubComp: nothing to do
  const withEnv = subItems.filter(it => !!envelopeOf(it.obj!));
  if (!withEnv.length) { warn(app, C, MSG_NO_VALID_INPUT, 'no envelope under SubComp'); setStatus(app, C, S_FALSE); return undefined; }
  const nb = Math.max(1, Math.floor(Number(reset ? 2 : a.NbDeformersPerPoint) || 2));
  const rec = boolOf(a.Interactive);
  // deformers: the connection set; an empty one = the envelope's own deformers (inferred, the registry default of Reset)
  const subObjs = new Set(withEnv.map(it => it.obj));
  const csObjs = unset(a.ConnectionSet) && reset ? [] : objectsOf(connectionGroups(app, a.ConnectionSet, !reset).flat()).filter(o => !subObjs.has(o));
  const csDeformers = deformersOf(csObjs);
  const lockedNames: string[] = [];
  logNya(app, C, `the deformer choice and weight falloff of the worker; each point takes the ${nb} nearest deformer(s) at the reference pose with inverse-distance weights`, 'open question 4');
  for (const it of withEnv) {
    const obj = it.obj!; const env = envelopeOf(obj)!; const prim = obj.primitive!; const prop = envelopeProperty(obj, env);
    const mesh = prim.geomUpTo('modeling') ?? meshOf(obj)!; const G = obj.globalMatrix();
    const lockOp = prop ? outConnections(prop).find((x): x is LockEnvelopeWeightsOperator => x instanceof LockEnvelopeWeightsOperator) : undefined;
    const pts = itemPoints(it) ?? [];
    const restore = envSnapshot(env); let after: (() => void) | null = null;
    step(app, rec, C, () => {
      if (after) { after(); prim.dirty = true; return; }
      const add = csDeformers.filter(d => !env.deformers.includes(d)); if (add.length) env.addDeformers(add);   // inferred: deformers new to the envelope join it
      const pool = (csDeformers.length ? csDeformers : env.deformers).map(d => env.deformers.indexOf(d)).filter(k => k >= 0);
      const lockedPts = lockOp?.lockedPoints();
      for (const i of pts) {
        if (env.locked.has(i) || lockedPts?.has(i)) { lockedNames.push(`${obj.name}.pnt[${i}]`); continue; }
        const p = new THREE.Vector3(mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]).applyMatrix4(G);
        const ds = pool.map(k => ({ k, d: distanceTo(env, env.deformers[k], p) })).sort((x, y) => x.d - y.d).slice(0, nb);
        const w = new Float32Array(env.deformers.length); const dmin = Math.max(1e-6, ds[0]?.d ?? 1); let s = 0;
        for (const { k, d } of ds) { const v = 1 / Math.pow(Math.max(1e-6, d) / dmin, Number(env.val('falloff')) || 2); w[k] = v; s += v; }
        if (s > 0) for (const { k } of ds) w[k] /= s;
        env.weights[i] = w;
      }
      after = envSnapshot(env); prim.dirty = true; (prop as any)?.refreshDeformers?.();
    }, () => { restore(); prim.dirty = true; (prop as any)?.refreshDeformers?.(); });
  }
  if (lockedNames.length) warn(app, C, MSG_LOCKED_POINTS, [...new Set(lockedNames)].join(', '));
  setStatus(app, C, S_OK);
  if (reset) logNya(app, C, 'how OutputObjs is filled (no write to it was found in the task class); nothing is returned', 'open question 4');
  return undefined;
}

// ------------------------------------------------------------------ registration
export function registerOptasksB12cEnvelopeCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  reg({
    name: 'SIApplyFlexEnv', label: 'Apply Flexible Envelope', category: 'Deformation', description: 'Set Flexible Envelope Task',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'Interactive', default: false }, { name: 'AssignNewDeformers', default: false }, { name: 'ConstructionMode', default: null }],
    execute: (app, a) => applyDriver(app, a, { command: 'SIApplyFlexEnv', kind: 'envelope', interactive: boolOf(a.Interactive), assignNewDeformers: boolOf(a.AssignNewDeformers), constructionMode: a.ConstructionMode, weights: null, refresh: true }),
  });
  reg({
    name: 'SIApplyFlexEnvWithWeight', label: 'Apply Flexible Envelope', category: 'Deformation', description: 'Apply Envelope With Weight Task',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'Interactive', default: false }, { name: 'EnvelopeWeights', default: null }, { name: 'ConstructionMode', default: null }],
    execute(app, a) {
      // AssignNewDeformers fixed false, auto-assign on; the constant mode 2 handed to the worker is not resolved
      // (open question 1) and ConstructionMode stays the ambient value.
      const w = unset(a.EnvelopeWeights) ? null : (Array.isArray(a.EnvelopeWeights) ? a.EnvelopeWeights.flat(Infinity) : String(a.EnvelopeWeights).split(',')).map(Number);
      applyDriver(app, a, { command: 'SIApplyFlexEnvWithWeight', kind: 'envelope', interactive: boolOf(a.Interactive), assignNewDeformers: false, constructionMode: a.ConstructionMode, weights: w && w.length ? w : null, refresh: true });
      return undefined;   // no CreatedObj output
    },
  });
  reg({
    name: 'SIApplyDeformByCage', label: 'Apply Deform by Cage', category: 'Deformation', description: 'Set Deform By Cage',
    args: [{ name: 'ConnectionSet', default: null }, { name: 'Interactive', default: false }, { name: 'ConstructionMode', default: null }],
    execute: (app, a) => applyDriver(app, a, { command: 'SIApplyDeformByCage', kind: 'cage', interactive: boolOf(a.Interactive), assignNewDeformers: false, constructionMode: a.ConstructionMode, weights: null, refresh: false }),
  });
  reg({
    name: 'SILocalAssignFlexEnv', label: 'Reassign Flexible Envelope Locally', category: 'Deformation', description: 'Assign Flexible Envelope Locally Task',
    args: [{ name: 'SubComp', default: null }, { name: 'ConnectionSet', default: null }, { name: 'Interactive', default: false }, { name: 'NbDeformersPerPoint', default: 2 }],
    execute: (app, a) => localAssign(app, a, 'SILocalAssignFlexEnv', false),
  });
  reg({
    name: 'ResetFlexEnvPtsAssignment', label: 'Reset Assignment for Flexible Envelope Points', category: 'Deformation', description: 'Assign Flexible Envelope Locally Task',
    args: [{ name: 'SubComp', default: null }, { name: 'ConnectionSet', default: null }, { name: 'Interactive', default: false }],
    execute: (app, a) => localAssign(app, a, 'ResetFlexEnvPtsAssignment', true),
  });
}
