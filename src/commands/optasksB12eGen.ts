// Ledger row CMD-B12e (optasks.dll), part 1: generator input read positions, inputs for disposal, animation and shape
// animation across a generator.
//   GetGeneratorInputReadPosition GetGeneratorInputReadPosition_UIOnly ChangeGeneratorInputReadPosition
//   GetGeneratorInputsForDisposal CopyAnimationAcrossGenerator TransferShapeAnimationAcrossGenOp
// Brief: docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md, section 3. Original code from that prose only.
import { App } from '../core/commands';
import {
  S_OK, S_FALSE, SI_CANCEL, E_INVALIDARG, E_POINTER, E_FAIL, MSG_UNTRANSFER, MSG_TRANSFER_REMAINING,
  stateOf, fail, setStatus, logNya, unset, nodesArg, nodeArg, modeArg, currentMode, isGenerator, genInputs, genOwner,
  generatorOn, readPositionOf, moveInputConnection, genShapeItems, transferredShapesOf, envelopesOf, animationItems,
  triState, deleteItem, copyProperty, uniqueIn, X3DObject, Operator, Property, Node,
} from './optasksB12eShared';

// ------------------------------------------------------------------ GetGeneratorInputReadPosition(_UIOnly)
function getReadPosition(C: string) {
  return (app: App, a: Record<string, any>) => {
    const op = nodeArg(app, a.Operator);
    if (!op) throw fail(E_INVALIDARG, `${C}: Operator is required`);
    let pos = 3;
    const first = genInputs(op)[0];
    if (first && op instanceof Operator) pos = readPositionOf(app, op, first);
    a.ReadPosition = pos;
    setStatus(app, C, S_OK);
    return pos;
  };
}

// ------------------------------------------------------------------ ChangeGeneratorInputReadPosition
function changeReadPosition(app: App, a: Record<string, any>) {
  const C = 'ChangeGeneratorInputReadPosition';
  // inferred: an omitted ReadPosition is read by the ConstructionMode handler as the current construction mode (4)
  let pos = unset(a.ReadPosition) ? 4 : modeArg(a.ReadPosition);
  if (!Number.isInteger(pos) || pos < 0 || pos > 4) throw fail(E_INVALIDARG, `${C}: ReadPosition must be 0..4`);
  const op = nodeArg(app, a.Operator);
  if (pos === 4) pos = currentMode();
  if (!op || !(op instanceof Operator) || pos > 3) { setStatus(app, C, S_OK); return; }
  if (isGenerator(op)) {
    const items: Node[] = [];
    if (pos >= 1) items.push(...transferredShapesOf(app, op));
    if (pos >= 2) items.push(...envelopesOf(op));
    if (items.length) {
      const r = triState(app, C, a, 'UnTransferShapesAndEnvelopes', MSG_UNTRANSFER);
      if (r === 'cancel') { setStatus(app, C, SI_CANCEL); return; }
      if (r === 'do') for (const n of items) deleteItem(app, n);
    }
  }
  for (const input of genInputs(op)) {
    if (!input.primitive) continue;   // the needed marker cannot be found: input skipped
    // construction markers always exist on a primitive of this build (Explorer marker nodes), nothing to apply
    moveInputConnection(app, op, input, pos);
  }
  const p = op.get('inputreadregion');
  if (p && genInputs(op).length) app.setParam(p, pos, 'MoveOperator');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ GetGeneratorInputsForDisposal
// siGenOpInputsDisposalMode names as this build spells them (operatorsScripts.ts): keep 0, hide 1, delete 2.
// The note reads the numbers as 1 = delete, 2 = hide (question for the analyst); the numbers decide below.
const DISPOSAL: Record<string, number> = { siKeepGenOpInputs: 0, siHideGenOpInputs: 1, siDeleteGenOpInputs: 2 };
function inputsForDisposal(app: App, a: Record<string, any>) {
  const C = 'GetGeneratorInputsForDisposal';
  const items = nodesArg(app, a.InputObjs);
  if (!items.length) throw fail(E_INVALIDARG, `${C}: InputObjs is empty`);
  const ops: Operator[] = [];
  for (const it of items) {
    const op = isGenerator(it) ? it : generatorOn(it);
    if (!op) throw fail(E_INVALIDARG, `${C}: ${it.name} is not a generator operator and its geometry is not generated`);
    if (!ops.includes(op)) ops.push(op);
  }
  const raw = a.GenOpInputsDisposal; let mode = NaN;
  if (typeof raw === 'number') mode = raw;
  else if (!unset(raw)) { const s = String(raw).replace(/^:([^:]+):.*$/, '$1').trim(); mode = s in DISPOSAL ? DISPOSAL[s] : /^\d+$/.test(s) ? Number(s) : NaN; }
  if (mode !== 1 && mode !== 2) throw fail(E_INVALIDARG, `${C}: GenOpInputsDisposal must be 1 (delete) or 2 (hide)`);
  const out: X3DObject[] = [];
  for (const op of ops) {
    const owner = genOwner(op);
    for (const input of genInputs(op)) {
      if (input === owner || out.includes(input)) continue;
      // inferred: in delete mode an input still read by another generator outside the list is not disposable
      if (mode === 1 && [...app.scene.allObjects()].some(o => o.primitive?.operators.some(x => x !== op && !ops.includes(x) && isGenerator(x) && genInputs(x).includes(input)))) continue;
      out.push(input);
    }
  }
  a.OutputObjs = out;
  setStatus(app, C, S_OK);
  return out;
}

// ------------------------------------------------------------------ TransferShapeAnimationAcrossGenOp
/** SITransferShapeAnimation sub-task stand-in: copy the keys onto the generated object (undoable). The bus version
 *  (animateSurface.ts) records no undo step, so it is not called from here. */
function transferShapeKeys(app: App, op: Operator, target: X3DObject, keys: Property[]): Property[] {
  const st = stateOf(app); const made: Property[] = [];
  for (const k of keys) {
    const c = copyProperty(k, uniqueIn(target.properties, k.name));
    app.record('SITransferShapeAnimation', () => { target.addProperty(c); st.transferredShapes.set(c, { source: k, op }); st.createdBy.set(c, 'SITransferShapeAnimation'); },
      () => { target.removeProperty(c); st.transferredShapes.delete(c); st.createdBy.delete(c); });
    made.push(c);
  }
  return made;
}
function transferShapeAnimation(app: App, a: Record<string, any>) {
  const C = 'TransferShapeAnimationAcrossGenOp';
  const op = nodeArg(app, a.Operator), obj = nodeArg(app, a.Object);
  if (!op || !obj) throw fail(E_POINTER, `${C}: Operator and Object are required`);
  const items = genShapeItems(op);
  if (!items.length || !(op instanceof Operator) || !(obj instanceof X3DObject)) { setStatus(app, C, S_FALSE); return; }
  const st = stateOf(app);
  const done = new Set([...st.transferredShapes].filter(([k, v]) => v.op === op && obj.properties.includes(k)).map(([, v]) => v.source));
  const byInput = new Map<X3DObject, Property[]>();
  for (const it of items) {
    if (it.sources.length !== 1) throw fail(E_FAIL, `${C}: shape item ${it.item.name} must reference exactly one source`);
    const key = it.sources[0];
    if (!genInputs(op).includes(it.input) || done.has(key)) continue;   // inferred: a key already transferred is not copied again
    const list = byInput.get(it.input) ?? []; list.push(key); byInput.set(it.input, list);
  }
  // one SITransferShapeAnimation sub-task per (generated primitive, input primitive) pair
  for (const [, keys] of byInput) transferShapeKeys(app, op, obj, keys);
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ CopyAnimationAcrossGenerator
function copyAnimation(app: App, a: Record<string, any>) {
  const C = 'CopyAnimationAcrossGenerator';
  const op = nodeArg(app, a.Operator);
  if (!op) throw fail(E_POINTER, `${C}: Operator is required`);
  const owner = genOwner(op);
  // "something to move": the inputs hold animation items   // inferred: the query on the generator was not described
  if (!isGenerator(op) || !owner || !genInputs(op).some(i => animationItems(i).length)) { setStatus(app, C, S_OK); return; }
  const r = triState(app, C, a, 'TransferRemainingShapesAndEnvelopes', MSG_TRANSFER_REMAINING);
  if (r === 'cancel') { setStatus(app, C, SI_CANCEL); return; }
  if (r === 'do') {   // inferred: "No" leaves the remaining shapes and envelopes on the inputs (steps 2 and 3 skipped)
    const props = genInputs(op).flatMap(i => i.clusters.flatMap(c => c.properties));
    if (props.length) {
      logNya(app, C, 'the cluster-property list filter of the animation region; every cluster property of the inputs is transferred');
      app.run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: owner, ClusterPropsToTransfer: props });
    }
    for (const input of genInputs(op)) { void input; app.run('TransferShapeAnimationAcrossGenOp', { Operator: op, Object: owner }); }
  }
  // inferred: the read position step 4 passes (open question 1): the ReadPosition argument when given, else 0 (modeling),
  // with UnTransferShapesAndEnvelopes 1 so that what was just transferred is kept
  logNya(app, C, 'the ReadPosition passed to ChangeGeneratorInputReadPosition');
  const pos = unset(a.ReadPosition) ? 0 : a.ReadPosition;
  app.run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: pos, UnTransferShapesAndEnvelopes: 1 });
  setStatus(app, C, S_OK);
}

export function registerOptasksB12eGenCommands(app: App) {
  app.register({
    name: 'GetGeneratorInputReadPosition', label: 'GetGeneratorInputReadPosition', category: 'Modeling|Generator',
    description: 'Returns the construction level (0..3) at which a generator reads its first input.',
    args: [{ name: 'Operator' }], undoable: false, execute: getReadPosition('GetGeneratorInputReadPosition'),
  });
  app.register({
    name: 'GetGeneratorInputReadPosition_UIOnly', label: 'GetGeneratorInputReadPosition_UIOnly', category: 'Modeling|Generator',
    description: 'UI variant of GetGeneratorInputReadPosition (same task).',
    args: [{ name: 'Operator' }], undoable: false,
    noLog: true,   // inferred: the registry flag 0x800000 of the UI-only variant (not journalled)
    execute: getReadPosition('GetGeneratorInputReadPosition_UIOnly'),
  });
  app.register({
    name: 'ChangeGeneratorInputReadPosition', label: 'ChangeGeneratorInputReadPosition', category: 'Modeling|Generator',
    description: 'Moves the generator\'s input connections to a construction level of their inputs.',
    args: [{ name: 'Operator' }, { name: 'ReadPosition' }, { name: 'UnTransferShapesAndEnvelopes', default: 2 }], execute: changeReadPosition,
  });
  app.register({
    name: 'GetGeneratorInputsForDisposal', label: 'Return Generator Inputs to Delete or Hide', category: 'Modeling|Generator',
    description: 'Lists the inputs of generator operators that may be deleted or hidden.',
    args: [{ name: 'InputObjs' }, { name: 'GenOpInputsDisposal', default: '' }, { name: 'OutputObjs' }], undoable: false, execute: inputsForDisposal,
  });
  app.register({
    name: 'CopyAnimationAcrossGenerator', label: 'CopyAnimationAcrossGenerator', category: 'Modeling|Generator',
    description: 'Copies the animation of a generator\'s inputs onto the generated object.',
    args: [{ name: 'Operator' }, { name: 'ReadPosition' }, { name: 'TransferRemainingShapesAndEnvelopes', default: 2 }, { name: 'Selection' }], execute: copyAnimation,
  });
  app.register({
    name: 'TransferShapeAnimationAcrossGenOp', label: 'Transfer Shape Animation Across Generator Operator', category: 'Modeling|Generator',
    description: 'Transfers the shape keys of a generator\'s inputs onto the generated object.',
    args: [{ name: 'Operator' }, { name: 'Object' }], execute: transferShapeAnimation,
  });
}
