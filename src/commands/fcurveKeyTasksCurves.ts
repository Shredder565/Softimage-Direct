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
  enumLong, truthy, timeArg, layerCurve, layersOf, animatedValue, precheckSkips, writeKey, removeKey,
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

/** Curve kind of a parameter's (real or temporary) fcurve: 10 boolean, 15 integer, 20 standard (as GetFCurveInfo). */
const kindOf = (fc: FCurve | undefined, p: Parameter): number => Number((fc as any)?.kind ?? (p.def.type === 'bool' ? 10 : p.def.type === 'int' ? 15 : 20));
const bit = (x: unknown): 0 | 1 => (typeof x === 'boolean' ? x : Number(x) !== 0) ? 1 : 0;

/**
 * ActivateFCurve step 4: a frame range on a boolean fcurve (kind 10) is written as keys, with the RemoveKey / SaveKey
 * workers, so that the curve reads `v` over [start, end] and keeps what it had outside. `fc` undefined = the
 * temporary case (animatable parameter without an fcurve). Returns the number of sub-tasks that did something.
 */
function booleanRange(app: App, p: Parameter, fc: FCurve | undefined, [start, end]: Range, v: 0 | 1): number {
  const keys = fc ? fc.keys : [];
  // inferred: the two constant getters of the curve (offsets 0x170 / 0x188) are what this build's curve reads before
  // its first and after its last key (constant extrapolation); without keys both are the value when no key.
  const noKey = bit((fc as any)?.valueWhenNoKey ?? p.value);
  const leading = keys.length ? bit(keys[0].value) : noKey;
  const trailing = keys.length ? bit(keys[keys.length - 1].value) : noKey;
  // inferred: a boolean fcurve is a step curve, so the left side of key i holds the value of key i - 1
  const leftOf = (i: number) => i > 0 ? bit(keys[i - 1].value) : leading;
  const at = (t: number) => { let x = leading; for (const k of keys) { if (k.time - t > 1e-12) break; x = bit(k.value); } return x; };
  // 1. early out
  if (at(start) === v && at(end) !== v) return 0;
  // 2. the values before and after the range, the keys inside it
  const iStart = keys.findIndex(k => k.time > start);
  const iEnd = keys.findIndex(k => k.time > end);
  const temp = !fc;
  const before = temp ? leading : iStart >= 0 ? leftOf(iStart) : trailing;
  const after = temp ? trailing : iEnd >= 0 ? leftOf(iEnd) : trailing;
  const inside = keys.filter(k => k.time > start && k.time <= end).map(k => k.time);
  const firstIsFirst = temp || iStart === 0;
  const other = v ? 0 : 1;
  let n = 0;
  // 3. RemoveKey sub-tasks
  for (const t of inside) if (removeKey(app, 'Remove key', p, 0, t, 0).removed) n++;
  // 4. SaveKey sub-tasks at the start (and one time unit before it: one frame, inferred in the note)
  if (before !== v) {
    if (firstIsFirst) { writeKey(app, 'Save key', p, 0, start - 1, other, 0); n++; }
    writeKey(app, 'Save key', p, 0, start, v, 0); n++;
  }
  // 5. SaveKey sub-task at the end
  if (after !== v) { writeKey(app, 'Save key', p, 0, end, other, 0); n++; }
  return n;
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
  const v: 0 | 1 = activate ? 1 : 0;
  const done: FCurve[] = [];   // the command's own undo list: curves muted / range-switched
  let subTasks = 0;
  const seen = new Set<Parameter>();
  for (const p of list) {
    if (seen.has(p)) continue; seen.add(p);
    // step 1: the real fcurve, else a temporary one for an animatable parameter, else the parameter is left alone
    const fc = app.anim.fcurves.get(p);
    if (!fc && !p.animatable) continue;
    const boolean = kindOf(fc, p) === 10;
    if (!range) {
      // step 2, whole curve
      if (fc) { if (!done.includes(fc)) done.push(fc); continue; }
      if (!boolean) continue;                       // temporary case, other kinds: nothing
      // temporary case, boolean parameter: the value at the current time is toggled (Activate is not looked at)
      const old = p.value; const flipped = p.def.type === 'bool' ? !bit(old) : (bit(old) ? 0 : 1);
      app.record('Set value', () => { p.value = flipped; }, () => { p.value = old; });
      subTasks++;
      continue;
    }
    if (!boolean) {
      // step 3, range on a non-boolean fcurve; in the temporary case only the throw-away curve is touched
      if (fc && !done.includes(fc)) done.push(fc);
      continue;
    }
    // step 4, range on a boolean fcurve: nested key commands carry the undo, the parameter is not on the own undo list
    const n = booleanRange(app, p, fc, range, v);
    if (n) {
      subTasks += n;
      const now = app.anim.fcurves.get(p); const old = p.value;
      if (now && now.keys.length && now.activeAt(app.anim.frame)) {
        // the edited curve drives the parameter again (end-of-edit notification)
        let x = bit(now.keys[0].value); for (const k of now.keys) { if (k.time > app.anim.frame) break; x = bit(k.value); }
        const shown = p.def.type === 'bool' ? x === 1 : x;
        if (shown !== old) app.record('Activate fcurve', () => { p.value = shown; }, () => { p.value = old; });
      }
    }
  }
  if (!done.length && !subTasks) { setStatus(app, command, S_NOTHING); return; }
  if (done.length) {
    const apply = (on: boolean) => {
      for (const fc of done) {
        if (!range) fc.muted = !on; else if (on) reactivate(fc, range); else deactivate(fc, range);
        if (fc.keys.length && fc.activeAt(app.anim.frame)) fc.param.value = fc.eval(app.anim.frame);   // the curve drives again
      }
    };
    // undo is the same operation with Activate inverted, as read
    app.record(activate ? 'Activate fcurve' : 'Deactivate fcurve', () => apply(activate), () => apply(!activate));
  }
  setStatus(app, command, S_OK);
  emit(app);
}

// ------------------------------------------------------------------ RemoveAnimation
/** SourceMask bits as the RemoveAnimation code tests them: 1 fcurve, 2 expression, 4 any, 0x10 constraints. */
const RM = { fcurve: 1, expression: 2, any: 4, constraint: 0x10 } as const;
/**
 * The "static" test of RemoveAnimation: a curve without keys is static; otherwise every key holds the value of the
 * first key (1e-12) and both tangent slopes of every key are at most 1e-6. A layer curve must also be zero.
 */
function isStatic(fc: FCurve, layerForm: boolean): boolean {
  const ks = fc.keys; if (!ks.length) return true;
  const v0 = ks[0].value;
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    if (Math.abs(k.value - v0) > 1e-12) return false;
    // inferred mapping onto this build's keys: a tangent is the handle value (Left / Right) against the key value,
    // over the distance to the neighbouring key (the slope the evaluator uses); no neighbour = one frame
    const dl = i > 0 ? k.time - ks[i - 1].time : 1, dr = i + 1 < ks.length ? ks[i + 1].time - k.time : 1;
    const sl = dl ? 2 * (k.value - (k.left ?? k.value)) / dl : 0, sr = dr ? 2 * ((k.right ?? k.value) - k.value) / dr : 0;
    if (Math.abs(sl) > 1e-6 || Math.abs(sr) > 1e-6) return false;
  }
  return !layerForm || Math.abs(v0) <= 1e-12;
}

function removeAnimation(app: App, a: Record<string, any>): void {
  const command = 'RemoveAnimation';
  const st = stateOf(app);
  const list = parameterList(app, command, a.InputObjs);
  const time = timeArg(app, a.Time);
  const staticOnly = truthy(a.StaticFCurves);
  const base = unset(a.BaseAnimation) ? true : truthy(a.BaseAnimation);
  const layerAnim = unset(a.LayerAnimation) ? true : truthy(a.LayerAnimation);
  const mask = enumLong(a.SourceMask, SOURCE, SOURCE.siAnySource);
  const any = (mask & RM.any) !== 0;
  const layerPass = layerAnim && (mask & (RM.fcurve | RM.any)) !== 0;
  if ((mask & RM.constraint) !== 0) logNya(app, command, 'the constraint pass (mask bit 0x10): it depends on state-flag bit 17 of F3DGetCompleteAnimationState, whose name was not read; constraints are left in place', 'Q11');

  interface Work { p: Parameter; saved: number | null; fc?: FCurve; ex?: any; layers: [number, FCurve][] }
  const work: Work[] = []; const lockedLayers: string[] = [];
  for (const p of list) {
    // 1. the value at Time is read and saved
    const raw = time === app.anim.frame ? p.value : animatedValue(app, p, time);
    const saved = typeof raw === 'number' ? raw : typeof raw === 'boolean' ? (raw ? 1 : 0) : null;
    const w: Work = { p, saved, layers: [] };
    const layers = layersOf(app, p);
    // 2e / 2f. the base source is queued when BaseAnimation is true, the type filter accepts it and, with
    //          StaticFCurves, it is a static fcurve on a parameter without animation-layer entries
    if (base) {
      const fc = app.anim.fcurves.get(p);
      if (fc && (any || (mask & RM.fcurve) !== 0) && (!staticOnly || (isStatic(fc, false) && !layers.length))) w.fc = fc;
      const ex = app.anim.expressions.get(p);
      if (ex && (any || (mask & RM.expression) !== 0) && !staticOnly) w.ex = ex;   // a non-fcurve source is never static
    }
    // 6. layer pass: masks containing 1 or 4 only
    if (layerPass) for (const l of layers) {
      const lfc = layerCurve(app, p, l)!;
      if (staticOnly && !isStatic(lfc, true)) continue;   // a non-static layer curve is left in place
      // a locked keying layer logs warning 0x37 with the layer's path; the removal request is still issued
      if (st.layers.locked(l)) { const path = st.layers.path?.(l) ?? `Layer${l}`; if (!lockedLayers.includes(path)) lockedLayers.push(path); }
      w.layers.push([l, lfc]);
    }
    if (w.fc || w.ex || w.layers.length) work.push(w);
  }
  if (lockedLayers.length) message(app, command, 0x37, 4, lockedLayers);
  // 3. nothing queued and no layer work
  if (!work.length) { setStatus(app, command, S_NOTHING); return; }
  // 4. removal, 5. the saved value is written back so that the parameter keeps the value it showed
  const olds = work.map(w => w.p.value);
  app.record('Remove animation', () => {
    for (const w of work) {
      if (w.fc) app.anim.fcurves.delete(w.p);
      if (w.ex) app.anim.expressions.delete(w.p);
      for (const [l] of w.layers) st.layerCurves.get(l)?.delete(w.p);
      // "no remaining mixer entry": layer entries are the mixer entries of this build; a remaining base source keeps driving
      const left = app.anim.fcurves.has(w.p) || app.anim.expressions.has(w.p) || layersOf(app, w.p).length > 0;
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
