// Ledger row CMD-B12d (optasks.dll), part 1: operator inputs, stack order, connection sets, simulation inputs, cycles.
//   AddInputToOperator RemoveInputFromOperator SubstituteOpInput MoveOperator UpdateConnectOnOp GetConnectionSet
//   GetSurfaceFromCurvesConnectionSet DisconnectFromSimulationOp CycleChecking
// Brief: docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md, section 3. Original code from that prose
// only. Conventions: see optasksB12dShared.ts.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Operator, MarkerNode, REGIONS } from '../core/scene';
import { siDef } from '../core/opdefs';
import { boolArg, findNode, siConst } from './viewEditPropertyHelpers';
import { pref } from './uixsiKeysSourcesMaterialsShared';
import {
  S_OK, S_FALSE, SI_PICK, E_INVALIDARG, E_POINTER, E_NOINTERFACE, E_FAIL, E_ACCESSDENIED, E_PENDING, E_NOTIMPL,
  PortRef, stateOf, fail, setStatus, setOut, message, logNya, lockLevel, primOf, ownerOf, groupsOf, addInstance, removeInstance,
  substituteInstance, editGroup, listOf, elementOf, elementKind, ownerObject, sameElement, nameOf, paramConnections, unset,
  type Connectable,
} from './optasksB12dShared';

// ================================================================== AddInputToOperator / RemoveInputFromOperator / SubstituteOpInput
interface Resolved { op: Operator; group: number; instance: number; ports: number }
/** Reference → operator, group, instance, port count. A port first; else an element whose owner's operators are scanned. */
function resolveReference(app: App, ref: any): Resolved | null {
  const el = elementOf(app, ref);
  if (!el) return null;
  if (el instanceof PortRef) {
    const g = groupsOf(el.op)[el.group];
    return g && el.instance < g.instances.length ? { op: el.op, group: el.group, instance: el.instance, ports: g.ports } : null;
  }
  const owner = ownerObject(el);
  for (const op of owner?.primitive?.operators ?? []) {
    const groups = groupsOf(op);
    for (let g = 0; g < groups.length; g++) for (let i = 0; i < groups[g].instances.length; i++)
      if (groups[g].instances[i].some(t => sameElement(t, el))) return { op, group: g, instance: i, ports: groups[g].ports };
  }
  return null;
}
const RESOLVE_MSG: Record<number, number> = { 1: 0x7b, 2: 0x7c, 3: 0x7d };

/** Interactive pick of New (prompt XSIOPTASKS 0x3fa). Returns the element, or SI_PICK when the pick was cancelled. */
function pickNew(app: App, C: string): Connectable | typeof SI_PICK {
  const hook = stateOf(app).hooks.pick;
  if (!hook) {
    logNya(app, C, 'the interactive pick session of New (prompt XSIOPTASKS 0x3fa); no viewport pick is wired for it', 'section 3');
    throw fail(E_POINTER, `${C}: New is missing and nothing was picked`);
  }
  const r = hook('XSIOPTASKS 0x3fa', C);
  if (unset(r)) return SI_PICK;
  const el = elementOf(app, r);
  if (!el || el instanceof PortRef) throw fail(E_POINTER, `${C}: the picked element is not an object`);
  return el;
}

function opInput(app: App, C: string, a: Record<string, any>): any {
  const type = (Number(siConst(a.Type)) | 0) & 0xffff;
  const r = resolveReference(app, a.Reference);
  if (!r) {
    message(app, C, RESOLVE_MSG[type] ?? 0x6f, 2, unset(a.Reference) ? '' : nameOf(a.Reference));
    throw fail(E_FAIL, `${C}: Reference is not an input connection of an operator`);
  }
  if (type === 2) { removeInstance(app, C, r.op, r.group, r.instance); setStatus(app, C, S_OK); return; }
  if (type !== 1 && type !== 3) { message(app, C, 0x6f); throw fail(E_FAIL, `${C}: unknown Type ${type}`); }
  let nw: Connectable | null;
  if (unset(a.New)) {
    const p = pickNew(app, C);
    if (p === SI_PICK) { setStatus(app, C, SI_PICK); return; }
    if (elementKind(p) === 7) { message(app, C, 0x6f, 2, nameOf(p)); throw fail(E_FAIL, `${C}: a sub-component cannot be picked`); }
    nw = p;
  } else {
    const el = elementOf(app, a.New);
    nw = el instanceof PortRef ? null : el;
  }
  if (!nw) throw fail(E_POINTER, `${C}: New is not an element of the scene`);
  const inputs = Array(r.ports).fill(nw);
  if (type === 1) addInstance(app, C, r.op, r.group, r.instance + 1, inputs);
  else substituteInstance(app, C, r.op, r.group, r.instance, inputs);
  setStatus(app, C, S_OK);
}

// ================================================================== MoveOperator
// Batch-13 addendum Q19: class {dba00978-85be-4d94-aec5-422ecb4ee4bd} = the Post Simulation / Secondary Shape stack
// markers (C3DStackMarkerPostSimulationOp / C3DStackMarkerSecondaryShapeOp share it) → 0x407;
// class {4ed3b713-1abd-11d4-b83a-009027bc6587} = C3DSCMFixerOp2 → silent stop. Mapped onto this build's nodes:
// the secondary-shape region marker, a PostSimulationMarker operator, the Continuity Manager (SCMFixer2) operator.
const MARKER_CLASS = (n: any) => (n instanceof MarkerNode && n.mode === 'secondaryshape') || (n instanceof Operator && /^postsimulationmarker$/i.test(n.type));
const SCMFIXER_CLASS = (n: any) => n instanceof Operator && n.type === 'scmfixer';
function moveOperator(app: App, a: Record<string, any>) {
  const C = 'MoveOperator';
  const action = Number(siConst(a.MoveAction) ?? 0), direction = Number(siConst(a.MoveDirection) ?? 0);
  if (!(action >= 0 && action <= 2) || !(direction >= 0 && direction <= 2)) throw fail(E_INVALIDARG, `${C}: MoveAction and MoveDirection must be 0..2`);
  const objN = unset(a.Object) ? null : findNode(app, a.Object);
  const obj: X3DObject | null = objN instanceof X3DObject ? objN : objN instanceof Operator ? ownerOf(objN) : (objN as any)?.parent instanceof X3DObject ? (objN as any).parent : null;
  const opN = unset(a.OperatorToMove) ? null : (a.OperatorToMove instanceof Operator ? a.OperatorToMove : (findNode(app, a.OperatorToMove) ?? (obj?.primitive ? obj.primitive.operators.find(o => o.name === a.OperatorToMove || o.type === a.OperatorToMove) : undefined)));
  const op = opN instanceof Operator ? opN : null;
  const prim = obj?.primitive ?? null;
  // OperatorReference is read only when MoveAction != 0
  let ref: Node | null = null;
  if (action !== 0) {
    const r = unset(a.OperatorReference) ? null : (a.OperatorReference instanceof Node ? a.OperatorReference : findNode(app, a.OperatorReference)
      ?? prim?.explorerChildren().find(n => n.name === a.OperatorReference || n.type === a.OperatorReference));
    ref = r ?? null;
  }
  // 1. null Object / OperatorToMove, or a reference missing: nothing happens
  if (!obj || !op || !prim || (action !== 0 && !ref)) { setStatus(app, C, S_OK); return; }
  // 2. the operator (any lock level) is locked: stop silently
  if (prim.operators.some(o => o === op && lockLevel(o))) { setStatus(app, C, S_OK); return; }
  // 3. marker operators (F3DApplyMarkerOperators mode 3): the markers of this build are virtual (Primitive.explorerChildren)
  const ops = prim.operators; const at = ops.indexOf(op);
  const st = stateOf(app);
  if (action === 0) {
    // 4. an output of the operator that an operator above it depends on: 0x407, stop.
    //    inferred: "depends on" = an operator above has this operator connected to one of its ports (stand-in)
    for (const above of ops.slice(at + 1)) if (groupsOf(above).some(g => g.instances.some(i => i.includes(op)))) { message(app, C, 0x407, 2, `${op.name} -> ${above.name}`); setStatus(app, C, S_OK); return; }
    ref = ops[ops.length - 1];   // the current top operator, then handled like MoveAction 2
  }
  // 5. explicit MoveAction 2 only (MoveAction 0 picks the reference itself and skips both class tests):
  //    a marker-class reference logs 0x407 and stops; a C3DSCMFixerOp2 reference stops silently.
  if (action === 2) {
    if (MARKER_CLASS(ref)) { message(app, C, 0x407, 2, ref!.name); setStatus(app, C, S_OK); return; }
    if (SCMFIXER_CLASS(ref)) { setStatus(app, C, S_OK); return; }
  }
  const before = action === 1;
  // 6. F3DMovePortConnections stand-in: re-insert in the stack. inferred: "before" = evaluated right before the reference.
  const errorMsg: Record<number, number> = { [E_ACCESSDENIED]: 0x5c, [E_PENDING]: 0x5d, [E_NOTIMPL]: 0x5e, [E_INVALIDARG]: 0x60 };
  const moveFail = (hr: number, what: string) => { message(app, C, errorMsg[hr], 2, what); setStatus(app, C, hr); };
  if (at < 0) return moveFail(E_INVALIDARG, `${op.name} is not in the stack of ${obj.name}`);
  if (at === 0) return moveFail(E_NOTIMPL, `${op.name} is the generator`);   // inferred: the generator cannot move
  let next: Operator[]; let region = op.region;
  if (ref instanceof MarkerNode) {
    // inferred (MoveAction 1 on a marker): the operator goes to the top of the marker's region
    const r = REGIONS.indexOf(ref.mode as any); region = ref.mode as any;
    next = ops.filter(o => o !== op); let i = next.length; for (let k = 1; k < next.length; k++) if (REGIONS.indexOf(next[k].region ?? 'modeling') > r) { i = k; break; }
    next.splice(i, 0, op);
  } else if (ref === op) {
    next = [...ops];   // the operator is its own reference (the top operator for MoveAction 0): nothing to move
  } else {
    const ri = ref instanceof Operator ? ops.indexOf(ref) : -1;
    if (ri < 0) return moveFail(E_INVALIDARG, `${nameOf(ref)} is not in the stack of ${obj.name}`);
    if (before && ri === 0) return moveFail(E_NOTIMPL, 'nothing can be moved below the generator');
    next = ops.filter(o => o !== op); next.splice(next.indexOf(ref as Operator) + (before ? 0 : 1), 0, op);
    if (ri > 0) region = (ref as Operator).region;
  }
  // 7. nothing to move (result 1): 0x5f at severity 4
  if (next.every((o, i) => o === ops[i]) && region === op.region) { message(app, C, 0x5f, 4, op.name); setStatus(app, C, S_FALSE); return; }
  // 8. graph refresh and the undo record (action, direction, operator, reference, new neighbour)
  const old = [...ops], oldRegion = op.region; const newRegion = region;
  const neighbour = next[next.indexOf(op) + 1] ?? null;
  const rec = { action, direction, op, reference: ref, neighbour };
  app.record(C, () => { prim.operators.splice(0, prim.operators.length, ...next); op.region = newRegion; prim.dirty = true; st.moves.push(rec); },
    () => { prim.operators.splice(0, prim.operators.length, ...old); op.region = oldRegion; prim.dirty = true; const i = st.moves.lastIndexOf(rec); if (i >= 0) st.moves.splice(i, 1); });
  if (direction !== 0) logNya(app, C, `the E3DMoveDirection value ${direction} (names not in the DLL); it is recorded but does not change the placement`, 'Q4');
  setStatus(app, C, S_OK);
}

// ================================================================== UpdateConnectOnOp
function updateConnectOnOp(app: App, a: Record<string, any>) {
  const C = 'UpdateConnectOnOp';
  if (unset(a.InputObjs)) throw fail(E_FAIL, `${C}: InputObjs is required`);
  // one entry per port, in port order; a null / empty array entry = no input given for that port
  const raw: any[] = Array.isArray(a.InputObjs) ? a.InputObjs.flat() : listOf(a.InputObjs);
  const inputs: (Connectable | null)[] = raw.map(x => { const el = unset(x) ? null : elementOf(app, x); return el && !(el instanceof PortRef) ? el : null; });
  const opN = unset(a.Operator) ? null : findNode(app, a.Operator);
  const op = opN instanceof Operator ? opN : null;
  if (!op || !inputs.length) throw fail(E_POINTER, `${C}: no operator or no input`);
  const group = Number(a.GroupIndex) | 0, instance = Number(a.GroupInstanceIndex) | 0;
  const force = boolArg(a.ForceDisconnect);
  const g0 = groupsOf(op)[group];
  if (!g0) throw fail(E_INVALIDARG, `${C}: ${op.name} has no port group ${group}`);
  // Shared connect helper with the bit mask 0x1 (connect) | 0x2 (disconnect existing) = 3, "replace" (batch-13
  // addendum Q16). AlreadyRefined only skips the helper's input refinement; this build uses the list as given.
  // No "add instance" request, so no CycleChecking child task for this command.
  // inferred: the port query "may be left empty" (port slot 0x68) = a port of a dynamic group of this stand-in.
  const optional = g0.dynamic;
  const orphans: X3DObject[] = [];
  editGroup(app, C, op, group, g => {
    while (g.instances.length <= instance) g.instances.push(Array(g.ports).fill(null));   // inferred: as the other port-group tasks
    const row = g.instances[instance];
    for (let p = 0; p < g.ports; p++) {
      const x = p < inputs.length ? inputs[p] : null;
      if (x) {
        // 1. a given input on a connected port: the existing connection is removed first; an object source is collected
        const old = row[p];
        if (old && !sameElement(old, x) && old instanceof X3DObject && !orphans.includes(old)) orphans.push(old);
        row[p] = x;   // 2. then the port is connected to the given input
      } else if (force && optional) row[p] = null;   // 3. no input: the connection is kept unless ForceDisconnect + optional port
    }
  });
  // The collected object sources go to a Delete Objects child task with flag 0x10 (flag meaning not in the note).
  // inferred: a source still connected to the instance (given again on another port) is not deleted.
  const row = g0.instances[instance] ?? [];
  const del = orphans.filter(o => !row.some(t => sameElement(t, o)));
  if (del.length) {
    logNya(app, C, 'the meaning of the Delete Objects flag 0x10; the disconnected object sources are deleted with DeleteObj', 'addendum Q16');
    app.run('DeleteObj', { InputObj: del });
  }
  setStatus(app, C, S_OK);
}

// ================================================================== GetConnectionSet / GetSurfaceFromCurvesConnectionSet
const GROUP_TYPE: Record<string, number> = { siGroupLevel: 0, siPortLevel: 1 };   // inferred numbering of siCnxSetType
const BRANCH: Record<string, number> = { siUnspecified: 0, siNode: 1, siBranch: 2 };   // inferred numbering of siBranchFlag
function presetResolver(app: App, x: any): string | null {
  if (unset(x)) return null;
  if (x instanceof Operator) return x.type;
  const s = String(x).trim(); const k = s.toLowerCase().replace(/\s+/g, '');
  if (siDef(k)) return k; if (siDef(k + 'op')) return k + 'op';
  const n = findNode(app, s); return n instanceof Operator ? n.type : null;
}
function getConnectionSet(app: App, C: string, a: Record<string, any>, surface: boolean) {
  const groupType = (Number(siConst(a.CnxGroupType) !== null && typeof siConst(a.CnxGroupType) === 'number' ? siConst(a.CnxGroupType) : GROUP_TYPE[String(siConst(a.CnxGroupType))] ?? 0) | 0) & 0xffff;
  const connectType = typeof siConst(a.ConnectType) === 'number' ? Number(siConst(a.ConnectType)) : BRANCH[String(siConst(a.ConnectType))] ?? 0;
  const interactive = boolArg(a.Interactive), create = boolArg(a.CreateOutputObjs);
  // UnPackArg: ConnectionSet parsed for the group type. Grammar not read (Q2); inferred from the SDK documentation of
  // ApplyOp's ConnectionSet: ";" separates port groups, "," the objects of one group.
  const text = unset(a.ConnectionSet) ? '' : Array.isArray(a.ConnectionSet) ? a.ConnectionSet.map(nameOf).join(',') : String(a.ConnectionSet);
  const groups = text.split(';').map(g => listOf(g)).filter(g => g.length);
  if (create && surface) {
    if (!unset(a.Target)) logNya(app, C, `the preferred output geometry type selected by Target "${nameOf(a.Target)}" (F3DSetPreferredGeometry)`, 'Q2');
    else logNya(app, C, 'the built-in default preferred output geometry type', 'Q2');
  }
  // Do: a connection resolver for the preset
  const preset = presetResolver(app, a.PresetObj);
  if (!preset) throw fail(E_FAIL, `${C}: no connection resolver for the preset "${nameOf(a.PresetObj)}"`);
  if (interactive) logNya(app, C, 'the interactive pick of the connection set inputs', 'Q2');
  const resolved: Connectable[][] = groups.map(g => g.map(x => elementOf(app, x)).filter((x): x is Connectable => !!x && !(x instanceof PortRef)));
  if (create) logNya(app, C, 'the creation of output objects by the resolver; OutputObjs stays empty', 'Q2');
  logNya(app, C, `the resolver / connect routines (group type ${groupType}, connect type ${connectType}); Value holds the parsed groups`, 'Q2');
  setOut(app, C, a, { OutputObjs: [], Value: resolved });
  setStatus(app, C, S_OK);
  return resolved;
}

// ================================================================== DisconnectFromSimulationOp
// The five simulation operator classes are not named in the DLL (Q6). inferred: the legacy simulation operators of
// this build (particles, fluid, explosion, blaster) and cloth / soft-body operators.
export const isSimulationOp = (op: Operator) => /^(ParticlesOp|FluidOp|ExplosionOp|BlasterOp)$/.test(op.type) || /cloth|softbody/i.test(op.type);
/** One operator disconnects one object: its ports and the legacy `connections` record of the simulation operators. */
function opDisconnect(app: App, C: string, op: Operator, x: Connectable): boolean {
  let hit = false;
  const groups = groupsOf(op);
  groups.forEach((g, gi) => { if (g.instances.some(r => r.some(t => sameElement(t, x)))) { hit = true; editGroup(app, C, op, gi, gg => { for (const r of gg.instances) for (let p = 0; p < r.length; p++) if (sameElement(r[p], x)) r[p] = null; }); } });
  const conn = (op as any).connections;
  if (conn && typeof conn === 'object') for (const k of Object.keys(conn)) {
    const v = conn[k]; if (!Array.isArray(v) || !v.includes(x)) continue;
    hit = true; const before = [...v], after = v.filter((t: any) => t !== x);
    app.record(C, () => { conn[k] = [...after]; }, () => { conn[k] = [...before]; });
  }
  if (hit) { const p = primOf(op); if (p) p.dirty = true; }
  return hit;
}
function disconnectFromSimulationOp(app: App, a: Record<string, any>) {
  const C = 'DisconnectFromSimulationOp';
  const inputs = listOf(a.InputObj).map(x => elementOf(app, x));
  const obj = inputs.find((x): x is X3DObject => x instanceof X3DObject) ?? null;
  const portIn = obj ? null : inputs.find(x => x instanceof PortRef) ?? null;
  const portLike = obj || portIn ? null : listOf(a.InputObj).find(x => x && typeof x === 'object' && !(x instanceof Node));
  if ((!obj && !portIn && !portLike) || unset(a.ObjectsToDisconnect)) { message(app, C, 0x6f); throw fail(E_FAIL, `${C}: no simulated object or port, or no ObjectsToDisconnect`); }
  if (portLike) throw fail(E_NOINTERFACE, `${C}: the input is not a port`);
  const list = listOf(a.ObjectsToDisconnect).map(x => elementOf(app, x)).filter((x): x is Connectable => !!x && !(x instanceof PortRef));
  let any = false;
  if (obj) {
    for (const op of obj.primitive?.operators ?? []) if (isSimulationOp(op)) for (const x of list) any = opDisconnect(app, C, op, x) || any;
  } else {
    const op = (portIn as PortRef).op; if (!op) throw fail(E_POINTER, `${C}: the port has no operator`);
    for (const x of list) any = opDisconnect(app, C, op, x) || any;
  }
  setStatus(app, C, any ? S_OK : S_FALSE);
  return any ? S_OK : S_FALSE;
}

// ================================================================== CycleChecking
/** Operators an operator reads from: the one below it in its stack, and the top operator of every object connected
 *  to one of its ports or to one of its parameters (stand-in of the connection graph). */
export function upstream(op: Operator): Operator[] {
  const out: Operator[] = []; const prim = primOf(op); const own = ownerOf(op);
  if (prim) { const i = prim.operators.indexOf(op); if (i > 0) out.push(prim.operators[i - 1]); }
  const from = (x: any) => {
    if (x instanceof Operator) { if (!out.includes(x)) out.push(x); return; }
    const o = ownerObject(x); if (!o || o === own) return;
    const top = o.primitive?.operators[o.primitive.operators.length - 1]; if (top && !out.includes(top)) out.push(top);
  };
  for (const g of groupsOf(op)) for (const r of g.instances) for (const t of r) if (t) from(t);
  for (const p of op.params) { const c = paramConnections.get(p); if (c) from(c); }
  return out;
}
function cycleChecking(app: App, a: Record<string, any>) {
  const C = 'CycleChecking';
  const out: Record<string, any> = { IsCycle: false, OutputObjs: [] };
  setOut(app, C, a, out);
  if (boolArg(a.DisableCycleCheck) && boolArg(pref(app, 'data_management.disable_cycle_checking', false))) { setStatus(app, C, S_OK); return false; }
  // the graph from StartingGraphPt (inferred: no starting point = the whole scene)
  const start = unset(a.StartingGraphPt) ? null : findNode(app, a.StartingGraphPt) ?? null;
  if (!unset(a.StartingGraphPt) && !start) throw fail(E_INVALIDARG, `${C}: StartingGraphPt "${nameOf(a.StartingGraphPt)}" is not in the scene`);
  const nested = boolArg(a.CheckFullNestedHier);
  const objs: X3DObject[] = [];
  if (!start) objs.push(...app.scene.allObjects());
  else {
    const o = start instanceof X3DObject ? start : ownerObject(start);
    if (o) { objs.push(o); if (nested) objs.push(...o.descendants()); }
  }
  const seeds: Operator[] = start instanceof Operator ? [start] : objs.flatMap(o => o.primitive?.operators ?? []);
  // traversal (connection-server traverser, mode 6 stand-in): every operator reachable upstream of the seeds
  const nodes: Operator[] = []; const todo = [...seeds];
  while (todo.length) { const op = todo.pop()!; if (nodes.includes(op)) continue; nodes.push(op); todo.push(...upstream(op)); }
  // `Check Current Frame`: the graph of this build does not change with time; the check is the same at every frame
  // Tarjan's strongly connected components (published algorithm, R. Tarjan 1972)
  const index = new Map<Operator, number>(), low = new Map<Operator, number>(), on = new Set<Operator>(), stack: Operator[] = [];
  const cyc: Operator[] = []; let n = 0;
  const visit = (v: Operator) => {
    index.set(v, n); low.set(v, n); n++; stack.push(v); on.add(v);
    for (const w of upstream(v)) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const comp: Operator[] = []; let w: Operator;
      do { w = stack.pop()!; on.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1 || upstream(v).includes(v)) cyc.push(...comp.reverse());
    }
  };
  for (const v of nodes) if (!index.has(v)) visit(v);
  if (cyc.length) {
    out.IsCycle = true; out.OutputObjs = cyc; setOut(app, C, a, out);
    app.logMsg('info', `WARNING : ${C}: PROBLEMATIC EVALUATION CYCLES ARE IN THE SPECIFIED GRAPH`);
  }
  setStatus(app, C, S_OK);
  return out.IsCycle;   // inferred: the return value is IsCycle
}

// ================================================================== registration
export function registerOptasksB12dInputCommands(app: App) {
  const reg = (def: Omit<CommandDef, 'category'>) => app.register({ category: 'Operator', ...def } as CommandDef);
  const ref = { name: 'Reference', default: null }, nw = { name: 'New', default: null };
  reg({ name: 'AddInputToOperator', label: 'Add Input to Operator', description: 'Adds a port-group instance after the referenced input, connected to New.',
    args: [ref, nw, { name: 'Type', default: 1 }], execute: (app, a) => opInput(app, 'AddInputToOperator', a) });
  reg({ name: 'RemoveInputFromOperator', label: 'Remove Input from Operator', description: 'Removes the port-group instance of the referenced input.',
    args: [ref, { name: 'Type', default: 2 }], execute: (app, a) => opInput(app, 'RemoveInputFromOperator', a) });
  reg({ name: 'SubstituteOpInput', label: 'Substitute Operator Input', description: 'Replaces the inputs of the referenced port-group instance with New.',
    args: [ref, nw, { name: 'Type', default: 3 }], execute: (app, a) => opInput(app, 'SubstituteOpInput', a) });
  reg({ name: 'MoveOperator', label: 'Move Operator', description: 'Moves an operator in the construction history of an object.',
    args: [{ name: 'Object', default: null }, { name: 'OperatorToMove', default: null }, { name: 'MoveAction', default: 0 }, { name: 'OperatorReference', default: null }, { name: 'MoveDirection', default: 0 }],
    execute: (app, a) => moveOperator(app, a) });
  reg({ name: 'UpdateConnectOnOp', label: 'Update Connection on Operator', description: 'Updates the inputs of a port-group instance of an operator.',
    args: [{ name: 'Operator', default: null }, { name: 'GroupIndex', default: 0 }, { name: 'GroupInstanceIndex', default: 0 }, { name: 'InputObjs', default: null }, { name: 'AlreadyRefined', default: false }, { name: 'ForceDisconnect', default: false }],
    execute: (app, a) => updateConnectOnOp(app, a) });
  const cs = [{ name: 'ConnectionSet', default: null }, { name: 'CnxGroupType', default: ':siGroupLevel:siCnxSetType' }, { name: 'ConnectType', default: ':siUnspecified:siBranchFlag' }, { name: 'Interactive', default: false }];
  reg({ name: 'GetConnectionSet', label: 'Get Connection Set', description: 'Resolves the connection set of an operator preset.',
    args: [{ name: 'PresetObj', default: null }, ...cs, { name: 'CreateOutputObjs', default: false }, { name: 'OutputObjs', default: null }],
    execute: (app, a) => getConnectionSet(app, 'GetConnectionSet', a, false) });
  reg({ name: 'GetSurfaceFromCurvesConnectionSet', label: 'Get Surface from Curves Connection Set', description: 'Resolves the connection set of a surface-from-curves operator preset.',
    args: [{ name: 'PresetObj', default: null }, { name: 'Target', default: null }, ...cs, { name: 'OutputObjs', default: null }, { name: 'CreateOutputObjs', default: true }],
    execute: (app, a) => getConnectionSet(app, 'GetSurfaceFromCurvesConnectionSet', a, true) });
  reg({ name: 'DisconnectFromSimulationOp', label: 'Disconnect from Simulation Operator', description: 'Disconnects objects from the simulation operators of an object or from a port.',
    args: [{ name: 'InputObj', default: null }, { name: 'ObjectsToDisconnect', default: null }], execute: (app, a) => disconnectFromSimulationOp(app, a) });
  reg({ name: 'CycleChecking', label: 'Cycle Checking', description: 'Checks a connection graph for evaluation cycles.', undoable: false,
    args: [{ name: 'StartingGraphPt', default: null }, { name: 'Check Current Frame', default: false }, { name: 'IsCycle', default: false }, { name: 'DisableCycleCheck', default: false }, { name: 'CheckFullNestedHier', default: true }, { name: 'OutputObjs', default: null }],
    execute: (app, a) => cycleChecking(app, a) });
}
