// Ledger row CMD-B19c: optasks.dll constraints, envelope locks, operator order, map / motion derivator commands;
// ophost.dll AddScriptedOpFromFile; scriptedopeditor.dll ConvertScriptedOp; shadertasks.dll DisconnectAndDeleteShaders;
// propertytasks.dll RemoveProxyParam. The static ICE attribute and ICE compound commands are in optasksB19cIce.ts;
// SelectBranch / SelectTree / SelectChain / SelectModel (selectionmgr.dll SelectObj class) are corrected in place in
// selectionGroupLayer.ts.
// Brief: docs/ghidra/cmd-b19c-optasks-ice-cns-envelope.md (section 3 "Wire contracts", section 5) and the CMD-B19c
// section of docs/re/WIRE_CORRECTIONS_B19.md. Original code written from that prose only; no XSIBATCH golden exists.
// Conventions: optasksB19cShared.ts.
//
// These registrations replace: RemoveCns (constraints.ts), RemoveCnsType / GetConstrainedObjects
// (viewEditPropertyMore.ts), RemoveFlexEnv / LockEnvelopePointWeights / ClearEnvelopeWeightLocks (rigging.ts),
// SwapOperators (viewEditProperty.ts), ConnectMap / DeleteMotionDerivator / AddScriptedOpFromFile / ConvertScriptedOp
// (inferredB10Scene.ts), RemoveProxyParam (anim.ts), DisconnectAndDeleteShaders (renderToolbarOm.ts).
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Cluster, Operator, Property, Constraint, Primitive, Shader } from '../core/scene';
import { Parameter, bool } from '../core/params';
import { EnvelopeOperator, envelopeOf } from '../core/envelope';
import { hostFs } from '../core/sdkHelpersHostFs';
import { CNS_PRESETS } from './constraints';
import { objs, findOperator, findNode } from './viewEditPropertyHelpers';
import { outConnections, collectionItems, type CsItem } from './operatorsScriptsOps';
import { LockEnvelopeWeightsOperator, extraOperators, envelopeProperty, isEnvelopeProperty, envelopeOfProperty, nodeOf as nodeB12c } from './optasksB12cShared';
import { isLocked, ScriptedOperatorB10 } from './inferredB10Scene';
import { nodesOf as shaderNodesOf, usersOf, connectRec, deleteShaderRec, containerOf, lockedAny } from './shadertasksB12Shared';
import { nestedShaders } from '../core/textureLayers';
import { IceNodeB12 } from './optasksB12iceModel';
import { startPickSession } from './miscDsScriptsPick';
import { findParam } from './index';
import { optasksB19cIceDefs, attributeTable, compoundProps, normalizeAttrName } from './optasksB19cIce';
import {
  S_OK, S_FALSE, SI_NOTHING, E_INVALIDARG, E_POINTER, E_FAIL, E_NOTIMPL, E_ACCESSDENIED, stateOf, fail, setStatus, setOut,
  subtask, errorMsg, warn, nya, str, boolOf, unset, interactive, deleteObjSubtask,
} from './optasksB19cShared';

const listOf = (v: any): any[] => unset(v) ? [] : Array.isArray(v) ? v.flatMap(listOf) : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v];

// ====================================================================== constraints
const cnsOf = (o: X3DObject) => o.properties.filter((p): p is Constraint => p instanceof Constraint);
/** inferred: the tagE3DKINECNSID table of this build. SIGetKineCnsIDFromName's table is not in the repository; each
 *  constraint preset of this build gets an id (its rank, from 1), and a name is a preset name, a constraint name
 *  ("Position Cns") or a constraint type ("poscns", the first preset of that type). */
const CNS_IDS: [string, number][] = Object.keys(CNS_PRESETS).map((k, i) => [k, i + 1]);
export function kineCnsIdFromName(name: string): number | null {
  const n = name.trim().replace(/\.Preset$/i, '').toLowerCase(); if (!n) return null;
  const hit = CNS_IDS.find(([k]) => k.toLowerCase() === n || CNS_PRESETS[k].label.toLowerCase() === n) ?? CNS_IDS.find(([k]) => CNS_PRESETS[k].type === n);
  return hit ? hit[1] : null;
}
/** The type id of a constraint (its slot-3 value). */
export function kineCnsIdOf(c: Constraint): number {
  const hit = CNS_IDS.find(([k]) => CNS_PRESETS[k].label === c.name) ?? CNS_IDS.find(([k]) => CNS_PRESETS[k].type === c.type);
  return hit ? hit[1] : 0;
}
const REJECTED_CNS_IDS = new Set([0, 17, 29]);

function removeCnsType(app: App, a: Record<string, any>) {
  const C = 'RemoveCnsType';
  // UnPack: Type must be a string; name -> id
  if (!unset(a.Type) && typeof a.Type !== 'string') throw fail(C, E_INVALIDARG, 'Type is not a string');
  const id = kineCnsIdFromName(str(a.Type));
  // inferred: the failure SIGetKineCnsIDFromName returns (its value is not in the contract)
  if (id === null) throw fail(C, E_FAIL, `"${str(a.Type)}" is not a constraint type name (SIGetKineCnsIDFromName)`);
  // Worker
  if (REJECTED_CNS_IDS.has(id)) { nya(app, C, 'which constraint names carry the rejected ids 17 and 29'); throw fail(C, E_INVALIDARG, `constraint type id ${id} cannot be removed by type`); }
  const items: any[] = unset(a.ConstrainedObj) ? [...app.selection] : listOf(a.ConstrainedObj).map(x => x instanceof Node ? x : findNode(app, String(x)) ?? x);
  if (!items.length) throw fail(C, E_INVALIDARG, 'no constrained object');
  if (items.some(x => !(x instanceof X3DObject))) throw fail(C, E_INVALIDARG, 'every item must be a 3D object');
  const found = (items as X3DObject[]).flatMap(o => cnsOf(o).filter(c => kineCnsIdOf(c) === id));
  if (!found.length) { setStatus(app, C, S_FALSE); return 0; }
  const n = deleteObjSubtask(app, C, found);
  setStatus(app, C, S_OK);
  return n;
}

function removeCns(app: App, a: Record<string, any>) {
  const C = 'RemoveCns';
  const constrained = objs(app, a.ConstrainedObj);
  const constraining = unset(a.ConstrainingObj) || /^\{7834CB8C[^}]*\}:$/i.test(String(a.ConstrainingObj)) ? [] : objs(app, a.ConstrainingObj);
  const force = boolOf(a.ForceDeletion);
  let found: Constraint[] = [];
  if (constrained.length && constraining.length) {
    // the constraints whose constraining input is one of ConstrainingObj (0x180039e30)
    const set = new Set(constraining);
    found = constrained.flatMap(o => cnsOf(o).filter(c => c.targets.some(t => set.has(t)) || set.has((c as any).upVector)));
  } else if (constrained.length > 1) {
    found = constrained.flatMap(cnsOf);
  } else if (constrained.length === 1) {
    const o = constrained[0]; found = cnsOf(o);
    // inferred: the collector flags the ambiguous case when the object has several constraints
    if (!force && found.length > 1) {
      nya(app, C, 'the collector rules for kind 2 / kind 5 constraints and the exact pick trigger (here: more than one constraint)', 'Q3');
      if (interactive(app)) {
        // pick session: pick the constraining object; the picked one is stored back in ConstrainingObj (RePack)
        const session = startPickSession(app, {
          command: C, kind: 'element', filter: 'Object', prompt: `${C}: [XSIOPTASKS 0x3ef] pick the constraining object`, followSelection: true,
          fromClick: (_p, pick) => pick?.obj ?? null,
          onPick: (v) => {
            const picked = v instanceof X3DObject ? v : typeof v === 'string' ? app.scene.find(v) : null;
            if (picked) { app.run(C, { ConstrainedObj: [o], ConstrainingObj: [picked], ForceDeletion: true }); setOut(app, C, { ConstrainingObj: picked }); }
            return false;
          },
        });
        if (session) { app.logMsg('info', `${C}: [XSIOPTASKS 0x3ef] pick the constraining object`); setOut(app, C, { pickSession: session }); setStatus(app, C, S_OK); return 0; }
      }
      // skipped when running without UI: all the object's constraints
    }
  }
  if (!found.length) { setStatus(app, C, S_FALSE); return 0; }
  const n = deleteObjSubtask(app, C, found);
  setOut(app, C, { ConstrainingObj: constraining });
  setStatus(app, C, S_OK);
  return n;
}

function getConstrainedObjects(app: App, a: Record<string, any>) {
  const C = 'GetConstrainedObjects';
  const o = objs(app, a.InputObj)[0];
  if (!o) throw fail(C, E_POINTER, 'no input object');
  // inferred: the kinematics' list of objects constrained by the input, in scene order
  const out: X3DObject[] = [...app.scene.allObjects()].filter(x => cnsOf(x).some(c => c.targets.includes(o) || (c as any).upVector === o));
  setOut(app, C, { OutputObjs: out }); setStatus(app, C, S_OK);
  return out;
}

// ====================================================================== envelope locks
const lockOpOf = (prop: Property) => outConnections(prop).find((x): x is LockEnvelopeWeightsOperator => x instanceof LockEnvelopeWeightsOperator) ?? null;
/** Find the lock operator on the envelope property, applying c3dlockenvelopeweightsop (55f8fa6e) when absent. */
function ensureLockOp(app: App, C: string, prop: Property): LockEnvelopeWeightsOperator {
  const found = lockOpOf(prop); if (found) return found;
  const op = new LockEnvelopeWeightsOperator(prop); op.parent = prop; (op as any).__b19cOwners = [prop];
  subtask(app, C, 'ApplyOperator', { Preset: 'c3dlockenvelopeweightsop', ConnectionSet: [prop.fullName], ConnectMode: 3 });
  app.record('Apply Lock Envelope Weights Op', () => { outConnections(prop).push(op); extraOperators.add(op); }, () => { const l = outConnections(prop); const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); extraOperators.delete(op); });
  return op;
}
/** Envelope weight property of an argument item: the property itself, or the envelope property of an object. */
function envPropOf(app: App, x: any): Property | null {
  const n = x instanceof Node ? x : nodeB12c(app, x);
  if (isEnvelopeProperty(n)) return n;
  const o = n instanceof X3DObject ? n : n instanceof Cluster ? n.obj : null; const env = o ? envelopeOf(o) : null;
  return o && env ? envelopeProperty(o, env) : null;
}
/** The envelope's point table: the elements of the cluster holding the property (all points when not on a cluster). */
function envelopePoints(prop: Property, env: EnvelopeOperator): number[] {
  const cl = prop.parent instanceof Cluster ? prop.parent : null;
  if (cl && !cl.isComplete) return [...cl.elements].map(Number).sort((x, y) => x - y);
  return Array.from({ length: env.weights.length }, (_, i) => i);
}
const lockSnapshot = (op: LockEnvelopeWeightsOperator, env: EnvelopeOperator | null) => {
  const locks = new Set(op.locks); const pts = env ? new Set(env.locked) : null;
  return () => { op.locks.clear(); for (const k of locks) op.locks.add(k); if (env && pts) env.locked = new Set(pts); };
};

function lockEnvelopePointWeights(app: App, a: Record<string, any>) {
  const C = 'LockEnvelopePointWeights';
  const locked = boolOf(a.Locked, true);
  const items: CsItem[] = collectionItems(app, a.SubComp);
  if (!items.length) { warn(app, C, 0x6f); setStatus(app, C, S_FALSE); return undefined; }
  let points: number[] | null = null; let owner: X3DObject | null = null;
  for (const it of items) {
    if (it.node instanceof Cluster && it.node.compKind === 'pnt') { points = [...it.node.elements].map(Number); owner = it.node.obj; break; }
    if (it.sub && it.sub.kind === 'pnt') { points = [...it.sub.indices]; owner = it.obj; break; }
  }
  if (!points) { warn(app, C, 0x80); setStatus(app, C, S_FALSE); return undefined; }   // other component types
  // missing PropObj: the envelope weight property of the points' geometry (inferred: the first one)
  const prop = unset(a.PropObj) ? (owner ? envPropOf(app, owner) : null) : envPropOf(app, Array.isArray(a.PropObj) ? a.PropObj[0] : a.PropObj);
  const env = envelopeOfProperty(prop);
  if (!prop || !env) throw fail(C, E_POINTER, 'no envelope weight property');
  if (!points.length) { setStatus(app, C, S_FALSE); return undefined; }
  const op = ensureLockOp(app, C, prop);
  const table = envelopePoints(prop, env);
  const undo = lockSnapshot(op, env);   // previous lock state first
  app.record(C, () => {
    for (const p of points!) {
      const k = table.indexOf(p); if (k < 0) continue;   // points not in the envelope are skipped
      for (let d = 0; d < env.deformers.length; d++) op.setLock(k, d, locked);
      if (locked) env.locked.add(p); else env.locked.delete(p);
    }
    prop.set('locked', env.locked.size);
  }, () => { undo(); prop.set('locked', env.locked.size); });
  setOut(app, C, { OutputObj: op }); setStatus(app, C, S_OK);
  return op;
}

function clearEnvelopeWeightLocks(app: App, a: Record<string, any>) {
  const C = 'ClearEnvelopeWeightLocks';
  const items = unset(a.PropObj) ? [...(app.compSel ? [app.compSel.obj] : []), ...app.selection] : listOf(a.PropObj);
  let prop: Property | null = null; for (const x of items) { prop = envPropOf(app, x); if (prop) break; }
  // inferred: the worker's missing-property rule is the Lock task's (shared base class)
  if (!prop) throw fail(C, E_POINTER, 'no envelope weight property');
  const env = envelopeOfProperty(prop);
  const op = ensureLockOp(app, C, prop);
  const undo = lockSnapshot(op, env);
  app.record(C, () => { op.locks.clear(); if (env) env.locked.clear(); prop!.set('locked', 0); }, () => { undo(); prop!.set('locked', env?.locked.size ?? 0); });
  setOut(app, C, { OutputObj: op }); setStatus(app, C, S_OK);
  return op;
}

function removeFlexEnv(app: App, a: Record<string, any>) {
  const C = 'RemoveFlexEnv';
  const items = collectionItems(app, a.InputObjs);
  const del: Node[] = [];
  for (const it of items) {
    const o = it.node instanceof X3DObject ? it.node : it.node instanceof Cluster ? it.node.obj : null;   // objects (kind 2) and clusters (kind 6)
    const prim = o?.primitive; if (!o || !prim) continue;
    const env = prim.operators.find((x): x is EnvelopeOperator => x instanceof EnvelopeOperator); if (!env) continue;
    const prop = envelopeProperty(o, env);
    if (prop) del.push(prop);
    // its envelope operators too
    for (const x of prim.operators) if (x instanceof EnvelopeOperator && (!prop || envelopeProperty(o, x) === prop)) del.push(x);
  }
  if (!del.length) { setStatus(app, C, S_FALSE); return undefined; }
  nya(app, C, 'what interface c76e55b0 slot 7 returns (here: the envelope weight property) and the exact delete-list membership', 'Q4');
  deleteObjSubtask(app, C, del);
  setStatus(app, C, S_OK);
  return undefined;
}

// ====================================================================== SwapOperators
function swapOperators(app: App, a: Record<string, any>) {
  const C = 'SwapOperators';
  const opOf = (v: any, prim: Primitive | null): Operator | null => {
    if (v instanceof Operator) return v;
    if (unset(v)) return null;
    const s = Array.isArray(v) ? v[0] : v;
    if (s instanceof Operator) return s;
    return (prim ? findOperator(prim, s) : undefined) ?? (() => { const n = findNode(app, String(s)); return n instanceof Operator ? n : null; })();
  };
  const n = unset(a.Object) ? null : findNode(app, Array.isArray(a.Object) ? a.Object[0] : a.Object);
  let prim: Primitive | null = n instanceof Primitive ? n : n instanceof X3DObject ? n.primitive : n instanceof Operator && n.parent instanceof Primitive ? n.parent : null;
  const op1 = opOf(a.Operator1, prim), op2 = opOf(a.Operator2, prim);
  if (!prim) prim = [op1, op2].map(x => x?.parent).find((x): x is Primitive => x instanceof Primitive) ?? null;
  // UnPack failures are returned as they are
  if (!prim) throw fail(C, E_INVALIDARG, 'no object with an operator stack given');
  if (!op1 || !op2) throw fail(C, E_INVALIDARG, 'Operator1 and Operator2 must be operators');
  // F3DSwapPortConnections(Object, Op1, Op2, reverse = false); its failures map to messages
  const raise = (id: number, status: number, what: string): never => { errorMsg(app, C, id, what); throw fail(C, status, `${what} [XSIOPTASKS 0x${id.toString(16)}]`); };
  if (isLocked(app, op1, 0xffff) || isLocked(app, op2, 0xffff)) raise(0x5c, E_FAIL, 'an operator is locked');   // 0x80070005
  if (!prim.operators.includes(op1) || !prim.operators.includes(op2)) raise(0x60, E_INVALIDARG, `an operator is not in the stack of ${prim.fullName}`);   // 0x80070057
  if (op1 === op2) { warn(app, C, 0x5f, 'nothing to swap'); setStatus(app, C, S_FALSE); return undefined; }   // result 1
  // inferred: the generator cannot take part in a swap (0x80004001)
  if (prim.operators[0] === op1 || prim.operators[0] === op2) raise(0x5e, E_NOTIMPL, 'the generator operator cannot be moved');
  // the 0x8000000a branch (message 0x5d) has no condition in the contract; this build has no case that produces it
  const p = prim; const old = [...p.operators]; const regions = new Map(old.map(x => [x, x.region] as const));
  const next = [...old]; const i = next.indexOf(op1), j = next.indexOf(op2); next[i] = op2; next[j] = op1;
  // Undo = the same call with reverse = true
  app.record(C, () => { p.operators.splice(0, p.operators.length, ...next); op1.region = regions.get(op2)!; op2.region = regions.get(op1)!; p.dirty = true; },
    () => { p.operators.splice(0, p.operators.length, ...old); for (const [x, r] of regions) x.region = r; p.dirty = true; });
  setStatus(app, C, S_OK);
  return undefined;
}

// ====================================================================== ConnectMap
export const MAP_COMP_CLASS = 'c70b63f1-2d25-11d5-bdeb-00a0c9615daf';
/** Stand-in for the Map Component operator (C3DMapCompOp.spdl, MapComponentOp). */
export class MapComponentOperatorB19c extends Operator {
  readonly siClass = MAP_COMP_CLASS;
  constructor(readonly inputs: Node[]) { super('Map Component Op', 'mapcompop', []); }
}
function connectMap(app: App, a: Record<string, any>) {
  const C = 'ConnectMap';
  const map = unset(a.PropObj) ? null : nodeB12c(app, a.PropObj);
  const target = unset(a.Target) ? null : nodeB12c(app, a.Target);
  if (!map || !target) { setStatus(app, C, S_FALSE); return undefined; }   // null either: nothing
  // inferred: "Target already exposes interface 6466031e" = a Map Component operator is already connected to it
  if (outConnections(target).some(x => x instanceof MapComponentOperatorB19c)) { setStatus(app, C, S_FALSE); return undefined; }
  const op = new MapComponentOperatorB19c([map, target]); op.parent = target; (op as any).__b19cOwners = [target];
  subtask(app, C, 'ApplyOperator', { Preset: 'MapComponentOp', ConnectionSet: [map.fullName, target.fullName], ConnectMode: 2 });
  app.record(C, () => { outConnections(target).push(op); }, () => { const l = outConnections(target); const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); });
  setOut(app, C, { Operator: op }); setStatus(app, C, S_OK);
  return undefined;
}

// ====================================================================== DeleteMotionDerivator
export const MOTION_DERIVATOR_CLASS = '2b107ce1-93d0-11d0-be4e-00a024ee478d';
/** Stand-in for the operator of class 2b107ce1 on the global kinematic state (inferred: the Motion Derivator). */
export class MotionDerivatorOperatorB19c extends Operator {
  readonly siClass = MOTION_DERIVATOR_CLASS;
  constructor() { super('Motion Derivator', 'motionderivatorop', []); }
}
/** Operators of an object's global kinematic state (C3DKineState f75293a0): this build keeps them as connections. */
const kineStateOperators = (o: X3DObject): Operator[] => outConnections(o.kinematics.global);
/** C3DKineState parameter index 0x1b (inferred velaccactive, the 28th SPDL entry, 0-based 27); added on demand because
 *  this build's global kinematic state does not carry it. */
function velAccActive(o: X3DObject): Parameter {
  const g = o.kinematics.global;
  return g.get('velaccactive') ?? g.add(bool('velaccactive', false, 'Active'));
}
function deleteMotionDerivator(app: App, a: Record<string, any>) {
  const C = 'DeleteMotionDerivator';
  const list = objs(app, a.InputObj);
  if (!list.length && unset(a.InputObj)) throw fail(C, E_POINTER, 'no input list');
  const ops: Operator[] = []; const params: Parameter[] = [];
  for (const o of list) {
    const op = kineStateOperators(o).find(x => (x as any).siClass === MOTION_DERIVATOR_CLASS);   // the first one only
    if (!op) continue;
    ops.push(op); params.push(velAccActive(o));
  }
  // inferred: empty lists run no sub-task
  if (ops.length) deleteObjSubtask(app, C, ops);
  for (const p of params) {
    subtask(app, C, 'SetValue', { Target: p.fullName, Value: 0 });
    const old = p.value; app.record(C, () => { p.value = false; }, () => { p.value = old; });
  }
  setStatus(app, C, ops.length ? S_OK : S_FALSE);
  return undefined;
}

// ====================================================================== RemoveProxyParam
function removeProxyParam(app: App, a: Record<string, any>) {
  const C = 'RemoveProxyParam';
  const raw = unset(a.InputObjs) ? [...app.anim.marked] : listOf(a.InputObjs);
  const list = raw.map(x => x instanceof Parameter ? x : typeof x === 'string' ? findParam(app, x) : null);
  if (!raw.length) { warn(app, C, 0x2b, '', 'XSIPROPERTYTASKS'); setStatus(app, C, SI_NOTHING); return undefined; }
  // filter (slot 15): only proxy parameters
  const proxies = list.filter((p): p is Parameter => p instanceof Parameter && !!(p as any).proxied);
  let status = proxies.length === list.length ? S_OK : SI_NOTHING;
  for (const p of proxies) {
    const owner: any = (p as any).owner; const src: Parameter = (p as any).proxied;
    if (!owner?.params?.includes(p)) { errorMsg(app, C, 0x2b, p.fullName, 'XSIPROPERTYTASKS'); throw fail(C, E_FAIL, `cannot remove ${p.fullName} [XSIPROPERTYTASKS 0x2b]`); }
    const idx = owner.params.indexOf(p); const name = p.def.name;
    // the proxy definition (target, name, owning custom property) is saved; Undo recreates the proxy
    app.record(C, () => { owner.removeParam(p); app.anim.removeAnimation(p); app.anim.marked.delete(p); },
      () => { owner.insertParam(p, idx); (p as any).proxied = src; app.anim.setExpression(p, src.fullName, s => findParam(app, s) as any); void name; });
  }
  if (proxies.length) nya(app, C, 'the removal step 0x18002fcf0 (here: the proxy parameter leaves its custom property, its expression goes with it)', 'Q6');
  setStatus(app, C, status);
  app.events.emit('scene');
  return undefined;
}

// ====================================================================== DisconnectAndDeleteShaders
function disconnectAndDeleteShaders(app: App, a: Record<string, any>) {
  const C = 'DisconnectAndDeleteShaders';
  // both lists converted to shader references (inferred: unset Shaders = the selection; unset Containers = the
  // containers of the shaders, the hidden argument the render tree fills in)
  const items: any[] = unset(a.Shaders) ? [...app.selection] : listOf(a.Shaders).map(x => x instanceof Node ? x : shaderNodesOf(app, x)[0] ?? null);
  const iceNodes = items.filter(x => x instanceof IceNodeB12);
  const shaders = items.filter((x): x is Shader => x instanceof Shader);
  if (iceNodes.length) nya(app, C, 'deleting ICE / compound nodes through this command (0x18004cd50 handles them separately)', 'Q6');
  const containers: Node[] = unset(a.Containers) ? [...new Set(shaders.map(s => containerOf(app, s)).filter((c): c is Node => !!c))] : shaderNodesOf(app, a.Containers);
  if (!shaders.length || !containers.length) throw fail(C, E_INVALIDARG, 'no shader or no container');
  if (!unset(a.Shaders) && listOf(a.Shaders).length !== shaders.length + iceNodes.length) throw fail(C, E_FAIL, 'an entry is not a valid shader');
  for (const x of [...shaders, ...containers]) if (lockedAny(app, x)) { app.logMsg('error', `${C}: ${x.fullName} is locked`); throw fail(C, E_FAIL, `${x.fullName} is locked`); }
  // 1. disconnect each shader from the other shaders inside the containers
  const inside = new Set<Node>(); const visit = (n: Node) => { for (const s of nestedShaders(n)) if (!inside.has(s)) { inside.add(s); visit(s); for (const i of s.inputs.values()) inside.add(i); } };
  for (const c of containers) visit(c);
  for (const s of shaders) for (const r of usersOf(app, s)) if (r.owner instanceof Shader && inside.has(r.owner) && !shaders.includes(r.owner)) connectRec(app, r, null);
  // 2. the internal update sub-task (inferred: "Override Update Task", CMD-B15b)
  subtask(app, C, '1ffd73c3', { Containers: containers.map(c => c.fullName) });
  // 3. delete the shaders
  for (const s of shaders) deleteShaderRec(app, s);
  nya(app, C, 'the disconnect rule details (0x18004d510): here every connection from the shader into another shader of the containers is cut', 'Q6');
  setStatus(app, C, S_OK);
  app.events.emit('scene');
  return undefined;
}

// ====================================================================== scripted operators
/** siConstructionMode (public SDK reference). */
const CONSTRUCTION: Record<string, number> = { siConstructionModeDefault: -1, siConstructionModeModeling: 0, siConstructionModePrimaryShape: 1, siConstructionModeAnimation: 2, siConstructionModeSecondaryShape: 3 };
function addScriptedOpFromFile(app: App, a: Record<string, any>) {
  const C = 'AddScriptedOpFromFile';
  // ophost UnPack base 0x18000c870
  if (!unset(a.Name) && typeof a.Name !== 'string') throw fail(C, E_INVALIDARG, 'Name must be a string');
  if (!unset(a.Language) && typeof a.Language !== 'string') throw fail(C, E_INVALIDARG, 'Language must be a string');
  const outs = unset(a.OutputObjs) ? [...app.selection] : listOf(a.OutputObjs).map(x => x instanceof Node ? x : findNode(app, String(x))).filter((n): n is Node => !!n);
  const ins = unset(a.InputObjs) || /^\{7834CB8C[^}]*\}:$/i.test(String(a.InputObjs)) ? [] : listOf(a.InputObjs).map(x => x instanceof Node ? x : findNode(app, String(x))).filter((n): n is Node => !!n);
  let mode = 0;   // ConstructionMode coerced to I4 (VT_EMPTY -> 0)
  if (!unset(a.ConstructionMode)) {
    const s = String(a.ConstructionMode).replace(/^:([^:]+):.*$/, '$1');
    const v = CONSTRUCTION[s] ?? Number(s);
    if (!Number.isInteger(v)) throw fail(C, E_INVALIDARG, `ConstructionMode ${String(a.ConstructionMode)} is not an integer`);
    mode = v;
  }
  // the FileName read and the Do were not reached (Q5)
  nya(app, C, 'the FileName read and the Do (ophost.dll); the operator is built like AddScriptedOp from the file text', 'Q5');
  const file = str(a.FileName);
  if (!file) throw fail(C, E_INVALIDARG, 'FileName is required (inferred)');
  let code = '';
  try { code = hostFs.readFile(file); } catch { throw fail(C, E_FAIL, `cannot read ${file} (inferred)`); }
  if (!outs.length) throw fail(C, E_INVALIDARG, 'no output (inferred)');
  const lang = str(a.Language) || (/\.py$/i.test(file) ? 'Python' : /\.vbs$/i.test(file) ? 'VBScript' : 'JScript');   // inferred: by extension
  const op = new ScriptedOperatorB10(str(a.Name) || 'ScriptedOp', 'ScriptedOp', code, lang, outs, ins);
  (op as any).constructionMode = mode;
  const host = outs.find((n): n is X3DObject => n instanceof X3DObject && !!n.primitive);
  if (host?.primitive) { const prim = host.primitive; app.record(C, () => prim.addOperator(op), () => prim.removeOperator(op)); }
  else { const l: Operator[] = ((app as any).scriptedOpsB10 ??= []); app.record(C, () => l.push(op), () => l.splice(l.indexOf(op), 1)); }
  setOut(app, C, { Value: op }); setStatus(app, C, S_OK);
  return op;
}
function convertScriptedOp(app: App, a: Record<string, any>) {
  const C = 'ConvertScriptedOp';
  // inferred (scriptedopeditor.dll was not opened; registry: Source = SingleObj, hidden output Value): Source is a
  // runtime scripted operator, or an object whose stack holds one
  const n = unset(a.Source) ? app.selection[0] : (a.Source instanceof Node ? a.Source : findNode(app, String(Array.isArray(a.Source) ? a.Source[0] : a.Source)));
  const op = n instanceof ScriptedOperatorB10 ? n : n instanceof X3DObject ? n.primitive?.operators.find(o => o instanceof ScriptedOperatorB10) : undefined;
  if (!op) throw fail(C, E_INVALIDARG, 'Source is not a scripted operator (inferred)');
  nya(app, C, `converting ${op.fullName} (scriptedopeditor.dll handler 532b8303 not opened; LOCK); nothing is converted and Value is empty`, 'Q5');
  setOut(app, C, { Value: null }); setStatus(app, C, S_FALSE);
  return undefined;
}

// ====================================================================== registration
export const B19C_NAMES = [
  'AddStaticICEAttribute', 'RemoveStaticICEAttribute', 'RenameStaticICEAttribute', 'SetStaticICEAttributeType', 'ToggleICEAttributeAlwaysEvaluated',
  'CreateICECompoundNode', 'ExplodeICECompoundNode', 'ExportICECompoundNode', 'EditICECompoundProperties',
  'RemoveCnsType', 'RemoveCns', 'GetConstrainedObjects', 'LockEnvelopePointWeights', 'ClearEnvelopeWeightLocks', 'RemoveFlexEnv',
  'SwapOperators', 'ConnectMap', 'DeleteMotionDerivator', 'RemoveProxyParam', 'DisconnectAndDeleteShaders', 'AddScriptedOpFromFile', 'ConvertScriptedOp',
  'SelectBranch', 'SelectTree', 'SelectChain', 'SelectModel',
];
export function registerOptasksB19cCommands(app: App) {
  const st = stateOf(app);
  st.api = {
    attributeTable, compoundProps, normalizeAttrName, kineCnsIdFromName, kineCnsIdOf, kineStateOperators, MapComponentOperatorB19c, MotionDerivatorOperatorB19c,
    /** Put a Motion Derivator stand-in on an object's global kinematic state (velocity / acceleration output on). */
    addMotionDerivator(o: X3DObject) { const op = new MotionDerivatorOperatorB19c(); op.parent = o.kinematics.global; (op as any).__b19cOwners = [o.kinematics.global]; kineStateOperators(o).push(op); velAccActive(o).value = true; return op; },
    lockOpOf,
  };
  const defs: CommandDef[] = [
    ...optasksB19cIceDefs(),
    { name: 'RemoveCnsType', label: 'Remove Constraints By Type', category: 'Constraint', args: [{ name: 'Type', default: '' }, { name: 'ConstrainedObj', default: null }], execute: (app, a) => removeCnsType(app, a) },
    { name: 'RemoveCns', label: 'Remove Constraints', category: 'Constraint',
      args: [{ name: 'ConstrainedObj', default: null }, { name: 'ConstrainingObj', default: null }, { name: 'ForceDeletion', default: false }], execute: (app, a) => removeCns(app, a) },
    { name: 'GetConstrainedObjects', label: 'Get Constrained Objects from Constraining', category: 'Constraint', undoable: false,
      args: [{ name: 'InputObj', default: null }, { name: 'OutputObjs', default: null }], execute: (app, a) => getConstrainedObjects(app, a) },
    { name: 'LockEnvelopePointWeights', label: 'Lock Envelope Point Weights', category: 'Deformation',
      args: [{ name: 'PropObj', default: null }, { name: 'SubComp', default: null }, { name: 'Locked', default: true }], execute: (app, a) => lockEnvelopePointWeights(app, a) },
    { name: 'ClearEnvelopeWeightLocks', label: 'Clear Envelope Weight Locks', category: 'Deformation', args: [{ name: 'PropObj', default: null }], execute: (app, a) => clearEnvelopeWeightLocks(app, a) },
    { name: 'RemoveFlexEnv', label: 'Remove Flexible Envelope', category: 'Deformation', description: 'Remove both the Assignment and Envelope enforcer operators on selected objects',
      args: [{ name: 'InputObjs', default: null }], execute: (app, a) => removeFlexEnv(app, a) },
    { name: 'SwapOperators', label: 'SwapOperators', category: 'Edit', description: 'exchange order of operators',
      args: [{ name: 'Object', default: null }, { name: 'Operator1', default: null }, { name: 'Operator2', default: null }], execute: (app, a) => swapOperators(app, a) },
    { name: 'ConnectMap', label: 'Connect Map', category: 'Texturing|Modeling', args: [{ name: 'PropObj', default: null }, { name: 'Target', default: null }], execute: (app, a) => connectMap(app, a) },
    { name: 'DeleteMotionDerivator', label: 'Delete Motion Derivator', category: 'Transform', args: [{ name: 'InputObj', default: null }], execute: (app, a) => deleteMotionDerivator(app, a) },
    { name: 'RemoveProxyParam', label: 'Remove Proxy Param', category: 'Property', description: 'Removes a proxy parameter', args: [{ name: 'InputObjs', default: null }], execute: (app, a) => removeProxyParam(app, a) },
    { name: 'DisconnectAndDeleteShaders', label: 'RendertreeDeleteShaders', category: 'Rendering', description: 'Take a list of shaders, disconnect them from other shaders, and delete them.',
      // Containers: the registry's hidden argument (flags 65539), after the catalogue list
      args: [{ name: 'Shaders', default: null }, { name: 'Containers', default: null }], execute: (app, a) => disconnectAndDeleteShaders(app, a) },
    { name: 'AddScriptedOpFromFile', label: 'Create and connect file-based scripted operator', category: 'Scripting',
      args: [{ name: 'OutputObjs', default: null }, { name: 'FileName', default: '' }, { name: 'InputObjs', default: null }, { name: 'Name', default: '' }, { name: 'Language', default: '' }, { name: 'ConstructionMode', default: null }],
      execute: (app, a) => addScriptedOpFromFile(app, a) },
    { name: 'ConvertScriptedOp', label: 'ConvertScriptedOp', category: 'Scripting', args: [{ name: 'Source', default: null }], execute: (app, a) => convertScriptedOp(app, a) },
  ];
  for (const d of defs) app.register(d);
}
export { E_ACCESSDENIED };
