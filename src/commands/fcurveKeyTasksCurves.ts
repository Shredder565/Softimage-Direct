// Ledger row CMD-B8a, fcurve / information part. Brief: docs/ghidra/cmd-b8a-fcurve-keys-binary.md, "Wire contract"
// sections. Original code written from that prose contract only (see fcurveKeyTasks.ts for the mapping notes).
//
//   IsAnimated GetSource EvalFCurve GetFCurveInfo GetKeyInfo AddFCurve SetCurveType
//   ActivateFCurve ActivateFCurveOnKeyable ActivateFCurveOnMarkedKeyable RemoveAnimation
//
// Public documentation used: the Softimage SDK command reference for the meaning of IsAnimated's `Local` flag
// (animation from propagated properties and intermediate nodes is ignored) and the siSourceType / siFCurveType /
// siBranchFlag enum values.
import { App, CommandDef } from '../core/commands';
import { FCurve, SI_KEY_INTERP_CONSTANT, SI_KEY_INTERP_LINEAR, type Key } from '../core/animation';
import { Parameter } from '../core/params';
import { Node, X3DObject } from '../core/scene';
import { mapSetCurveTypeToInterp } from '../core/mixer';
import { unset } from './viewEditPropertyHelpers';
import {
  S_OK, S_NOTHING, E_INVALIDARG, SOURCE, BRANCH, SCOPE, type Mode, stateOf, setStatus, logNya, message, fail,
  enumLong, truthy, timeArg, layerCurve, layersOf, animatedValue, precheckSkips,
  resolveItems, parameterList, objectList, keyableParams, paramSetsOf, isParam,
} from './fcurveKeyTasksShared';

const emit = (app: App) => { app.events.emit('params'); };
/** This build's key interpolation code as the fcurve segment kind SetCurveType takes (1 constant, 2 linear, 3 cubic). */
const segKind = (interp: number | undefined) => interp === SI_KEY_INTERP_CONSTANT ? 1 : interp === SI_KEY_INTERP_LINEAR ? 2 : 3;
/** Key constraint bits GetKeyInfo rebuilds; 0x100 is tested only when 0x800 is set. */
const CONSTRAINT_BITS = [0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x800];

// ------------------------------------------------------------------ sources
const wantsFCurve = (mask: number) => (mask & (SOURCE.siFCurveSource | SOURCE.siAnySource)) !== 0;
const wantsExpression = (mask: number) => (mask & (SOURCE.siExpressionSource | SOURCE.siAnySource)) !== 0;
/** The animation sources of a parameter that match a siSourceType mask (inferred from the helper's name). */
function sourcesOf(app: App, p: Parameter, mask: number): any[] {
  const out: any[] = [];
  const fc = app.anim.fcurves.get(p); if (fc && wantsFCurve(mask)) out.push(fc);
  const ex = app.anim.expressions.get(p); if (ex && wantsExpression(mask)) out.push(ex);
  return out;
}
/** Parameters below an item: the parameter itself, or the parameter sets of a node (and of its children in branch). */
function paramsUnder(item: Node | Parameter, branch: boolean, local: boolean): Parameter[] {
  if (isParam(item)) return [item];
  const out: Parameter[] = [];
  const nodes: Node[] = [item]; if (branch && item instanceof X3DObject) nodes.push(...item.descendants());
  for (const n of nodes) for (const set of paramSetsOf(n, local)) for (const p of set.params) if (!out.includes(p)) out.push(p);
  return out;
}
/** Items of an object-list argument in the order given; an omitted argument is the selection (inferred). */
function itemsOf(app: App, arg: any): (Node | Parameter)[] {
  if (unset(arg)) return [...app.selection];
  const out: (Node | Parameter)[] = [];
  for (const raw of Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',').map(s => s.trim()).filter(Boolean) : [arg]) {
    const r = resolveItems(app, raw);
    // one item that names a compound ("kine.local.pos") stays one item per leaf
    for (const x of [...r.nodes, ...r.params]) if (!out.includes(x)) out.push(x);
  }
  return out;
}
/** The fcurve an `InputObj` of GetFCurveInfo / GetKeyInfo converts to: the fcurve itself, or the one on a parameter. */
function curveArg(app: App, command: string, arg: any): FCurve | null {
  if (arg instanceof FCurve) return arg;
  const p = isParam(arg) ? arg : unset(arg) ? parameterList(app, command, null)[0] : resolveItems(app, arg).params[0];
  return (p && app.anim.fcurves.get(p)) ?? null;
}
const noCurve = (app: App, command: string) => {
  logNya(app, command, 'the status when InputObj cannot be converted to an fcurve; nothing is returned');
  setStatus(app, command, S_NOTHING); return null;
};

// ------------------------------------------------------------------ IsAnimated, GetSource, EvalFCurve
function isAnimated(app: App, a: Record<string, any>): boolean {
  const command = 'IsAnimated';
  const items = itemsOf(app, a.InputObj);
  if (!items.length) throw fail(app, command, E_INVALIDARG, 'InputObj is empty', 0x3eb);
  const first = items[0];
  if (items.length > 1) message(app, command, 0x3d, 4, [first.fullName], '');
  const mask = enumLong(a.SourceMask, SOURCE, SOURCE.siAnySource);
  let branch = enumLong(a.BranchFlag, BRANCH, BRANCH.siUnspecified);
  if (branch === BRANCH.siUnspecified) branch = BRANCH.siNode;   // the item's own branch flag: this build selects nodes, not branches
  const local = truthy(a.Local);
  const list = paramsUnder(first, branch !== BRANCH.siNode, local).filter(p => sourcesOf(app, p, mask).length > 0);
  const st = stateOf(app);
  st.out[command] = list.length ? { AnimComponents: list } : {};
  if (list.length && Array.isArray(a.AnimComponents)) a.AnimComponents.splice(0, a.AnimComponents.length, ...list);
  setStatus(app, command, list.length ? S_OK : S_NOTHING);
  return list.length > 0;
}

function getSource(app: App, a: Record<string, any>): any[] | null {
  const command = 'GetSource';
  const mask = enumLong(a.SourceMask, SOURCE, SOURCE.siAnySource);
  const out: any[] = [];
  for (const p of parameterList(app, command, a.InputObjs)) for (const s of sourcesOf(app, p, mask)) if (!out.includes(s)) out.push(s);
  if (!out.length) { setStatus(app, command, S_NOTHING); return null; }   // Value is left untouched
  setStatus(app, command, S_OK);
  return out;
}

function evalFCurve(app: App, a: Record<string, any>): number {
  const command = 'EvalFCurve';
  const p = parameterList(app, command, a.InputObj)[0];
  const fc = p && (sourcesOf(app, p, SOURCE.siFCurveSource)[0] as FCurve | undefined);   // mask 1: the first fcurve source
  const time = timeArg(app, a.Time);
  if (!fc) {
    logNya(app, command, 'the value returned when the parameter has no fcurve (result field as initialised)', 'Q5');
    setStatus(app, command, S_NOTHING); return stateOf(app).evalWithoutCurve;
  }
  setStatus(app, command, S_OK);
  return fc.eval(time);
}

// ------------------------------------------------------------------ GetFCurveInfo, GetKeyInfo
function getFCurveInfo(app: App, a: Record<string, any>) {
  const command = 'GetFCurveInfo';
  const fc = curveArg(app, command, a.InputObj); if (!fc) return noCurve(app, command);
  const x = fc as any; const t = fc.param?.def?.type;
  const out = {
    // inferred: the kind is the published siFCurveType of the curve (10 boolean, 15 integer, 20 standard)
    CurveKind: Number(x.kind ?? (t === 'bool' ? 10 : t === 'int' ? 15 : 20)),
    ValueWhenNoKey: Number(x.valueWhenNoKey ?? fc.param?.value ?? 0),
    NbKeys: fc.keys.length,
    ExtrapolationKind: fc.extrap,
    DefaultSegKind: segKind(fc.interp),
    LowClamp: Number(x.lowClamp ?? 0),
    HighClamp: Number(x.highClamp ?? 0),
  };
  Object.assign(a, out); stateOf(app).out[command] = out; setStatus(app, command, S_OK);
  return out;
}

function getKeyInfo(app: App, a: Record<string, any>) {
  const command = 'GetKeyInfo';
  const fc = curveArg(app, command, a.InputObj); if (!fc) return noCurve(app, command);
  const index = Math.trunc(Number(a.Index) || 0);
  if (!fc.keys.length || index >= fc.keys.length || index < 0) throw fail(app, command, E_INVALIDARG, `no key ${index} (the curve has ${fc.keys.length})`);
  const k = fc.keys[index] as Key & Record<string, any>;
  let constraints = 0; const stored = Number(k.constr ?? 0) || 0;
  for (const bit of CONSTRAINT_BITS) if (stored & bit) constraints |= bit;
  if ((constraints & 0x800) && (stored & 0x100)) constraints |= 0x100;
  const out = {
    // the key record is copied as stored: key times of this build are stored in frames (the task itself converts nothing)
    Parameter: k.time,
    LeftValue: k.left ?? k.value, RightValue: k.right ?? k.value,
    LeftTanParam: Number(k.leftTanX ?? 0), LeftTanValue: Number(k.leftTanY ?? 0),
    RightTanParam: Number(k.rightTanX ?? 0), RightTanValue: Number(k.rightTanY ?? 0),
    RightSegKind: segKind(k.interp ?? fc.interp),
    Constraints: constraints,
  };
  Object.assign(a, out); stateOf(app).out[command] = out; setStatus(app, command, S_OK);
  return out;
}

// ------------------------------------------------------------------ AddFCurve, SetCurveType
function addFCurve(app: App, a: Record<string, any>): void {
  const command = 'AddFCurve'; let n = 0;
  for (const p of parameterList(app, command, a.InputObjs)) {
    if (precheckSkips(app, p)) continue;
    if (app.anim.fcurves.has(p)) continue;   // already has an fcurve: left alone
    const fc = new FCurve(p);
    app.record('Add fcurve', () => { app.anim.fcurves.set(p, fc); }, () => { app.anim.fcurves.delete(p); });
    n++;
  }
  setStatus(app, command, n ? S_OK : S_NOTHING);
  emit(app);
}

function setCurveType(app: App, a: Record<string, any>): void {
  const command = 'SetCurveType';
  const kind = Math.trunc(Number(a.Interpolation) || 0) >>> 0;
  if (kind < 1 || kind > 3) logNya(app, command, `interpolation value ${kind} (documented values are 1 constant, 2 linear, 3 cubic); applied as cubic`);
  const interp = mapSetCurveTypeToInterp(kind);
  let n = 0;
  for (const p of parameterList(app, command, a.InputObjs)) {
    const fc = app.anim.fcurves.get(p); if (!fc) continue;   // no fcurve: skipped
    const oldCurve = fc.interp; const oldKeys = fc.keys.map(k => k.interp);
    app.record('Set curve type', () => { fc.interp = interp; for (const k of fc.keys) k.interp = interp; },
      () => { fc.interp = oldCurve; fc.keys.forEach((k, i) => { k.interp = oldKeys[i]; }); });
    n++;
  }
  setStatus(app, command, n ? S_OK : S_NOTHING);
  emit(app);
}

// ------------------------------------------------------------------ ActivateFCurve family
type Range = [number, number];
/** Deactivate a frame range of a curve: the union with the ranges already inactive. */
function deactivate(fc: FCurve, [a, b]: Range) {
  const all = [...fc.inactiveRanges.map(r => [...r] as Range), [a, b] as Range].sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const r of all) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push(r); }
  fc.inactiveRanges = out;
}
/** Reactivate a frame range: cut it out of the inactive ranges. */
function reactivate(fc: FCurve, [a, b]: Range) {
  const out: Range[] = [];
  for (const [s, e] of fc.inactiveRanges) {
    if (e < a || s > b) { out.push([s, e]); continue; }
    if (s < a) out.push([s, a]);
    if (e > b) out.push([b, e]);
  }
  fc.inactiveRanges = out;
}

function activateFCurve(app: App, command: string, mode: Mode, a: Record<string, any>): void {
  const activate = unset(a.Activate) ? true : truthy(a.Activate);
  // parameter set
  let list: Parameter[];
  if (mode === 0) {
    const type = enumLong(a.Type, SCOPE, SCOPE.siInputParams);
    if (type === 3) list = [...app.anim.fcurves.keys()];   // every fcurve of the scene; InputObjs is not read
    else if (type === SCOPE.siAnimatedParameters) {
      // for every input object, all its fcurve-animated parameters (node or branch according to the item)
      list = [];
      const r = unset(a.InputObjs) ? { nodes: [...app.selection], params: [] as Parameter[] } : resolveItems(app, a.InputObjs);
      for (const n of r.nodes) for (const p of paramsUnder(n, false, false)) if (app.anim.fcurves.has(p) && !list.includes(p)) list.push(p);
      for (const p of r.params) if (app.anim.fcurves.has(p) && !list.includes(p)) list.push(p);
    } else list = parameterList(app, command, a.InputObjs);
  } else list = keyableParams(app, objectList(app, a.InputObjs), mode === 2);
  // range decoding
  let range: Range | null = null;
  if (!unset(a.StartFrame)) {
    const s = Number(a.StartFrame);
    if (Number.isNaN(s)) throw fail(app, command, E_INVALIDARG, 'StartFrame is not numeric');
    if (!unset(a.EndFrame)) {
      const e = Number(a.EndFrame);
      if (Number.isNaN(e)) throw fail(app, command, E_INVALIDARG, 'EndFrame is not numeric');
      range = s <= e ? [s, e] : [e, s];   // a reversed range is swapped
    }
  }
  const done: FCurve[] = [];
  for (const p of list) { const fc = app.anim.fcurves.get(p); if (fc && !done.includes(fc)) done.push(fc); }
  if (!done.length) { setStatus(app, command, S_NOTHING); return; }
  if (range) logNya(app, command, 'the boundary keys the range branch inserts and the value it re-applies at the current time; the range is only deactivated / reactivated', 'Q4');
  const apply = (on: boolean) => {
    for (const fc of done) {
      if (!range) fc.muted = !on; else if (on) reactivate(fc, range); else deactivate(fc, range);
      if (fc.keys.length && fc.activeAt(app.anim.frame)) fc.param.value = fc.eval(app.anim.frame);   // the curve drives again
    }
  };
  // undo is the same operation with Activate inverted, as read
  app.record(activate ? 'Activate fcurve' : 'Deactivate fcurve', () => apply(activate), () => apply(!activate));
  setStatus(app, command, S_OK);
  emit(app);
}

// ------------------------------------------------------------------ RemoveAnimation
function removeAnimation(app: App, a: Record<string, any>): void {
  const command = 'RemoveAnimation';
  const st = stateOf(app);
  const list = parameterList(app, command, a.InputObjs);
  const time = timeArg(app, a.Time);
  const staticOnly = truthy(a.StaticFCurves);
  const base = unset(a.BaseAnimation) ? true : truthy(a.BaseAnimation);
  const layerAnim = unset(a.LayerAnimation) ? true : truthy(a.LayerAnimation);
  const mask = enumLong(a.SourceMask, SOURCE, SOURCE.siAnySource);
  if (staticOnly) logNya(app, command, 'StaticFCurves; taken as "remove only fcurves whose keys all hold one value"', 'Q3');
  if (!base) logNya(app, command, 'BaseAnimation; taken as "leave the base-layer sources in place"', 'Q3');
  if (mask !== SOURCE.siAnySource) logNya(app, command, 'the per-source-type filtering by SourceMask; fcurve and expression sources are matched by their bits', 'Q3');

  interface Work { p: Parameter; saved: number | null; fc?: FCurve; ex?: any; layers: [number, FCurve][] }
  const work: Work[] = []; const lockedOwners: string[] = [];
  for (const p of list) {
    // 1. the value at Time is read and saved
    const raw = time === app.anim.frame ? p.value : animatedValue(app, p, time);
    const saved = typeof raw === 'number' ? raw : typeof raw === 'boolean' ? (raw ? 1 : 0) : null;
    const w: Work = { p, saved, layers: [] };
    // 2. collector
    if (base) {
      const fc = app.anim.fcurves.get(p);
      const isStatic = !!fc && fc.keys.every(k => k.value === fc.keys[0].value);
      if (fc && wantsFCurve(mask) && (!staticOnly || isStatic)) w.fc = fc;
      const ex = app.anim.expressions.get(p);
      if (ex && wantsExpression(mask) && !staticOnly) w.ex = ex;
    }
    // 6. layer animation
    if (layerAnim) for (const l of layersOf(app, p)) {
      if (st.layers.locked(l)) { const owner = p.owner.fullName; if (!lockedOwners.includes(owner)) lockedOwners.push(owner); continue; }
      w.layers.push([l, layerCurve(app, p, l)!]);
    }
    if (w.fc || w.ex || w.layers.length) work.push(w);
  }
  if (lockedOwners.length) message(app, command, 0x37, 4, lockedOwners);
  // 3. nothing collected and no layer work
  if (!work.length) { setStatus(app, command, S_NOTHING); return; }
  // 4. removal, 5. the saved value is written back so that the parameter keeps the value it showed
  const olds = work.map(w => w.p.value);
  app.record('Remove animation', () => {
    for (const w of work) {
      if (w.fc) app.anim.fcurves.delete(w.p);
      if (w.ex) app.anim.expressions.delete(w.p);
      for (const [l] of w.layers) st.layerCurves.get(l)?.delete(w.p);
      const left = app.anim.fcurves.has(w.p) || app.anim.expressions.has(w.p);
      if (w.saved !== null && !left) w.p.value = w.p.def.type === 'bool' ? w.saved !== 0 : w.saved;
    }
  }, () => {
    work.forEach((w, i) => {
      if (w.fc) app.anim.fcurves.set(w.p, w.fc);
      if (w.ex) app.anim.expressions.set(w.p, w.ex);
      for (const [l, fc] of w.layers) { let m = st.layerCurves.get(l); if (!m) { m = new Map(); st.layerCurves.set(l, m); } m.set(w.p, fc); }
      w.p.value = olds[i];
    });
  });
  setStatus(app, command, S_OK);
  emit(app);
}

// ------------------------------------------------------------------ registration
export function registerFcurveKeyTasksCurves(app: App, reg: (def: CommandDef) => void) {
  reg({
    name: 'IsAnimated', label: 'Is Animated', category: 'Animation', description: 'Tests whether an object or parameter is animated by a specific animation source type', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'SourceMask', default: ':siAnySource:siSourceType' }, { name: 'BranchFlag', default: ':siUnspecified:siBranchFlag' },
      { name: 'AnimComponents', default: null }, { name: 'Local', default: false }],
    execute: (app, a) => isAnimated(app, a),
  });
  reg({
    name: 'GetSource', label: 'Get Source', category: 'Animation', description: 'Returns the animation sources of the input parameters', undoable: false,
    args: [{ name: 'InputObjs', default: null }, { name: 'SourceMask', default: ':siAnySource:siSourceType' }],
    execute: (app, a) => getSource(app, a),
  });
  reg({
    name: 'EvalFCurve', label: 'Eval FCurve', category: 'Animation', description: 'Evaluates the fcurve of a parameter at a frame', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'Time', default: null }],
    execute: (app, a) => evalFCurve(app, a),
  });
  reg({
    name: 'GetFCurveInfo', label: 'Get FCurve Info', category: 'Animation', description: 'Returns the header information of an fcurve', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'CurveKind', default: 0 }, { name: 'ValueWhenNoKey', default: 0 }, { name: 'NbKeys', default: 0 },
      { name: 'ExtrapolationKind', default: 0 }, { name: 'DefaultSegKind', default: 0 }, { name: 'LowClamp', default: 0 }, { name: 'HighClamp', default: 0 }],
    execute: (app, a) => getFCurveInfo(app, a),
  });
  reg({
    name: 'GetKeyInfo', label: 'Get Key Info', category: 'Animation', description: 'Returns the data of one fcurve key', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'Index', default: 0 }, { name: 'Parameter', default: 0 }, { name: 'LeftValue', default: 0 }, { name: 'RightValue', default: 0 },
      { name: 'LeftTanParam', default: 0 }, { name: 'LeftTanValue', default: 0 }, { name: 'RightTanParam', default: 0 }, { name: 'RightTanValue', default: 0 },
      { name: 'RightSegKind', default: 0 }, { name: 'Constraints', default: 0 }],
    execute: (app, a) => getKeyInfo(app, a),
  });
  reg({
    name: 'AddFCurve', label: 'Add FCurve', category: 'Animation', description: 'Gives every input parameter an fcurve source',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { addFCurve(app, a); },
  });
  reg({
    name: 'SetCurveType', label: 'Set Curve Type', category: 'Animation', description: 'Sets the interpolation type of the fcurves of the input parameters',
    args: [{ name: 'InputObjs', default: null }, { name: 'Interpolation', default: 0 }],
    execute(app, a) { setCurveType(app, a); },
  });
  const activate = (name: string, label: string, mode: Mode) => reg({
    name, label, category: 'Animation', description: 'Mutes / unmutes fcurves, or deactivates / reactivates a frame range of them',
    args: [{ name: 'InputObjs', default: null }, { name: 'Activate', default: true }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null },
      ...(mode === 0 ? [{ name: 'Type', default: ':siInputParams:siParameterScope' }] : [])],
    execute(app, a) { activateFCurve(app, name, mode, a); },
  });
  activate('ActivateFCurve', 'Activate FCurve', 0);
  activate('ActivateFCurveOnKeyable', 'Activate FCurve On Keyable', 1);
  activate('ActivateFCurveOnMarkedKeyable', 'Activate FCurve On Marked Keyable', 2);
  reg({
    name: 'RemoveAnimation', label: 'Remove Animation', category: 'Animation', description: 'Removes animation from parameters, keeping their value at a time',
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'StaticFCurves', default: false }, { name: 'BaseAnimation', default: true },
      { name: 'LayerAnimation', default: true }, { name: 'SourceMask', default: ':siAnySource:siSourceType' }],
    execute(app, a) { removeAnimation(app, a); },
  });
}
