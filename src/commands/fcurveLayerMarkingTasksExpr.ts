// Ledger row CMD-B8b, expression half: SetExpr EditExpr SetRelativeValues GetNumRelativeValues GetRelativeValue
// RemoveRelativeValue ConnectSource. Brief: docs/ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md.
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * A parameter's expression is the entry of `app.anim.expressions`; the "expression object" handed out in
//    `ExprObj` is an `ExpressionSource` handle on that entry. Its definition string is
//    "<full parameter path> = <expression text>".
//  * Expression kinds: the contract only tells kind 3 (link with one driver, a link fcurve) from kind 4 (link
//    with several drivers, an interpolator). Here the kind is read from the text: `l_fcv( driver )` is kind 3,
//    `l_interp( d1, d2, ... )` / `l_interpOri( ... )` kind 4 (the link functions of the published Softimage
//    expression reference; inferred mapping). Kind 3 is evaluated through its link fcurve (x = driver value,
//    y = driven value). The interpolation of kind 4 is not attested: the sets are stored, the value is left alone.
//  * Lock levels, referenced models and the model-delta task {d8b3c0e0-...} have no counterpart in this build.
import { App, CommandDef } from '../core/commands';
import { Node } from '../core/scene';
import { Parameter } from '../core/params';
import { FCurve, Key } from '../core/animation';
import { sdkMsgBox } from '../ui/sdkHelpersModal';
import { findParam } from './index';
import { unset } from './viewEditPropertyHelpers';
import { stateOf, setStatus, logNya, logMessage, fail, subTask, writeBack, listOf, pathOf, paramsOfList, msgId, S_OK, S_NOTHING, E_INVALIDARG } from './fcurveLayerMarkingTasks';

/** Expression kinds named by the contract; 0 stands for every other kind. */
export type ExprKind = 0 | 3 | 4;
export function exprKind(text: string | undefined): ExprKind {
  if (text === undefined) return 0;
  if (/^\s*l_fcv\s*\(/.test(text)) return 3;
  if (/^\s*l_interp(Ori)?\s*\(/.test(text)) return 4;
  return 0;
}
const driverPaths = (text: string): string[] => { const m = text.match(/^\s*\w+\s*\(([\s\S]*)\)\s*$/); return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []; };

/** The interpolator of a multi-link expression: sets of relative values, each [driven value, driver 1, ..., driver n]. */
export class Interpolator {
  readonly kind = 'interpolator';
  sets: number[][] = [];
  get Count(): number { return this.sets.length; }
}
export interface LinkRecord {
  kind: 3 | 4; text: string; driverPaths: string[];
  /** Kind 3: the link fcurve, keyed at x = driver value, y = driven value. */
  fcurve: FCurve | null;
  /** Kind 4: the interpolator. */
  interpolator: Interpolator | null;
}
export interface ExprEditorRecord { paths: string[]; opened: number }

/** The expression object of a parameter (the items of SetExpr's ExprObj, a source ConnectSource accepts). */
export class ExpressionSource {
  readonly kind = 'expression';
  /** Text kept while the source is not connected to a parameter. */
  held = '';
  constructor(private readonly app: App, public parameter: Parameter | null) {}
  get text(): string { return (this.parameter ? this.app.anim.expression(this.parameter) : undefined) ?? this.held; }
  get definition(): string { return `${this.parameter ? pathOf(this.parameter) : ''} = ${this.text}`; }
  get exprKind(): ExprKind { return exprKind(this.text); }
  toJSON() { return { kind: this.kind, parameter: this.parameter ? pathOf(this.parameter) : null, text: this.text }; }
}
/** The ExprObj collection. */
export class ExprCollection {
  readonly items: ExpressionSource[] = [];
  get Count(): number { return this.items.length; }
  Item(i: number): ExpressionSource | undefined { return this.items[i]; }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  toJSON() { return this.items.map(x => x.toJSON()); }
}

const links = new WeakMap<Parameter, Map<string, LinkRecord>>();
const sources = new WeakMap<Parameter, ExpressionSource>();

export function linkOf(app: App, p: Parameter): LinkRecord | null {
  const text = app.anim.expression(p); const kind = exprKind(text);
  if (text === undefined || kind === 0) return null;
  let byText = links.get(p); if (!byText) links.set(p, byText = new Map());
  let rec = byText.get(text);
  if (!rec) byText.set(text, rec = { kind, text, driverPaths: driverPaths(text), fcurve: kind === 3 ? new FCurve(p) : null, interpolator: kind === 4 ? new Interpolator() : null });
  return rec;
}
export function expressionOf(app: App, p: Parameter): ExpressionSource | null {
  if (!app.anim.expressions.has(p)) return null;
  let s = sources.get(p);
  if (!s || s.parameter !== p) sources.set(p, s = new ExpressionSource(app, p));
  return s;
}

/** Hand an expression text to a parameter. False = the definition was rejected (0x80070057), which is tolerated. */
function install(app: App, p: Parameter, text: string): boolean {
  const A = app.anim; const kind = exprKind(text);
  if (kind === 0) {
    try { A.setExpression(p, text, s => findParam(app, s)); return true; }
    catch { A.expressions.set(p, { text, fn: () => NaN }); return false; }
  }
  const fn = kind === 3
    ? () => { const rec = linkOf(app, p); const d = rec ? findParam(app, rec.driverPaths[0] ?? '') : undefined; return rec?.fcurve?.keys.length && d ? rec.fcurve.eval(Number(d.value)) : NaN; }
    : () => NaN;   // kind 4: the interpolation is not attested
  A.expressions.set(p, { text, fn }); A.fcurves.delete(p);
  const v = fn(); if (Number.isFinite(v)) p.value = v;
  return true;
}

// ------------------------------------------------------------------ undo support
interface AnimSnap { p: Parameter; fc: FCurve | undefined; ex: { text: string; fn: (fc: number, t: number) => number } | undefined; value: any; src: ExpressionSource | undefined; srcParam: Parameter | null; srcHeld: string }
function snap(app: App, ps: Parameter[]): AnimSnap[] {
  return ps.map(p => { const src = sources.get(p); return { p, fc: app.anim.fcurves.get(p), ex: app.anim.expressions.get(p), value: p.value, src, srcParam: src?.parameter ?? null, srcHeld: src?.held ?? '' }; });
}
function restore(app: App, snaps: AnimSnap[]): void {
  const A = app.anim;
  for (const s of snaps) {
    if (s.fc) A.fcurves.set(s.p, s.fc); else A.fcurves.delete(s.p);
    if (s.ex) A.expressions.set(s.p, s.ex); else A.expressions.delete(s.p);
    if (s.src) { sources.set(s.p, s.src); s.src.parameter = s.srcParam; s.src.held = s.srcHeld; } else sources.delete(s.p);
    if (!s.ex) s.p.value = s.value;   // no expression before: the saved value is written back
  }
}
/** One undoable step over the animation sources of some parameters. */
function recordSources(app: App, label: string, ps: () => Parameter[], mutate: () => void): void {
  let before: AnimSnap[] = []; let after: AnimSnap[] | null = null;
  app.record(label, () => {
    if (after) { restore(app, after); return; }
    before = snap(app, ps());
    try { mutate(); } catch (e) { restore(app, before); throw e; }
    after = snap(app, before.map(s => s.p));
  }, () => restore(app, before));
  app.events.emit('params');
}

// ------------------------------------------------------------------ SetExpr
const refsOf = (app: App, p: Parameter): Parameter[] => {
  const text = app.anim.expression(p); if (!text) return [];
  const out: Parameter[] = [];
  for (const m of text.matchAll(/\b([A-Za-z_][\w.]*\.[\w.]+)\b/g)) { const q = findParam(app, m[1]); if (q && !out.includes(q)) out.push(q); }
  return out;
};
/** The CycleChecking task on one parameter: does its expression chain lead back to it. */
function inCycle(app: App, p: Parameter): boolean {
  const seen = new Set<Parameter>(); const todo = refsOf(app, p);
  while (todo.length) { const q = todo.pop()!; if (q === p) return true; if (seen.has(q)) continue; seen.add(q); todo.push(...refsOf(app, q)); }
  return false;
}
function valueText(p: Parameter): string {
  // "%f" for R4 / R8, "%d" (truncated) for the other numeric types
  return p.def.type === 'double' ? Number(p.value).toFixed(6) : String(Math.trunc(Number(p.value)));
}
function inputParams(app: App, C: string, arg: any): Parameter[] {
  if (unset(arg) || (Array.isArray(arg) && !arg.length)) {
    // the argument handler falls back to the marking, then to the selection
    if (app.anim.marked.size) return [...app.anim.marked];
    if (app.selection.length) logNya(app, C, 'which parameters of the selection the argument handler supplies when nothing is marked');
    return [];
  }
  const { found, missing } = paramsOfList(app, arg);
  if (missing.length) app.logMsg('info', `WARNING : ${C}: no parameter "${missing.join(',')}"`);
  return found;
}

function setExpr(app: App, a: Record<string, any>): ExprCollection {
  const C = 'SetExpr'; const A = app.anim;
  const exprStr = unset(a.ExprStr) ? '' : String(a.ExprStr);
  const list = inputParams(app, C, a.InputObj);
  const out = new ExprCollection(); const done: Parameter[] = [];
  let newCycle = false;
  recordSources(app, C, () => list, () => {
    for (const p of list) {
      const path = pathOf(p);
      // 1. lock test (message 0x2e): this build has no parameter locks
      // 2. capability bit 0, animatable
      if (p.def.animatable === false) { logMessage(app, C, 4, `${path} is not animatable`, 0x2f); continue; }
      // 3. numeric value types only; the others are skipped silently
      if (!(p.def.type === 'double' || p.def.type === 'int' || p.def.type === 'bool')) continue;
      // 4. a source of interface {c1afbd50-...} on the parameter (inferred: an fcurve)
      if (A.fcurves.has(p)) { logMessage(app, C, 4, `${path} is driven by an fcurve`, 0x2c); continue; }
      // 5. message 0x2d: the source class {386b0f00-...} is not identified (Q5); never raised here
      // 6. cycle test before and after the change
      const check = !stateOf(app).skipCycleCheck && !newCycle;
      const before = check && inCycle(app, p);
      // 7. expression text
      const had = A.expressions.has(p);
      const text = had ? exprStr : exprStr || valueText(p);
      if (text && !(had && A.expression(p) === text)) {
        if (!install(app, p, text)) app.logMsg('info', `WARNING : ${C}: the definition "${path} = ${text}" was rejected (0x80070057); the command goes on`);
        else if (exprKind(text) === 4) logNya(app, C, `the interpolation of the multi-link expression on ${path} (its relative values are stored, the value is not driven)`);
      }
      if (check && !before && inCycle(app, p)) newCycle = true;
      // 8. the expression object goes to the output collection
      out.items.push(expressionOf(app, p)!); done.push(p);
      // 9. task {d8b3c0e0-...} (inferred: connection stored in the model delta) only concerns referenced models
    }
  });
  if (newCycle) {
    app.logMsg('info', `${C}: the expression creates a cycle (message box: title ${msgId(0x2a)}, text ${msgId(0x2b)})`);
    if ((app as any).Interactive !== false) sdkMsgBox(`This expression creates a dependency cycle. (XSIFCURVE ${msgId(0x2b)})`, 'Expression').catch(() => undefined);
  }
  setStatus(app, C, S_OK);
  return writeBack(a, 'ExprObj', out);
}

// ------------------------------------------------------------------ EditExpr
function editExpr(app: App, a: Record<string, any>): void {
  const C = 'EditExpr'; const st = stateOf(app);
  const rec: ExprEditorRecord = { paths: [], opened: (st.exprEditor?.opened ?? 0) + 1 };   // the view is created and reset
  for (const x of listOf(a.InputObj)) {
    if (x instanceof Parameter || x instanceof Node) { rec.paths.push(pathOf(x)); continue; }
    const p = typeof x === 'string' ? paramsOfList(app, [x]).found : [];
    if (p.length) rec.paths.push(...p.map(q => pathOf(q))); else rec.paths.push(String(x));
  }
  st.exprEditor = rec;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Expression Editor', paths: rec.paths } }));
  logNya(app, C, 'the expression editor view itself (class {ae04e220-...}); this build opens its stand-in editor and records the parameter paths');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ relative values
function setRelativeValues(app: App, a: Record<string, any>): void {
  const C = 'SetRelativeValues';
  // inferred: an empty list is filled from the marking by the argument handler, as for SetExpr
  const list = inputParams(app, C, a.InputObj);
  const recs = list.map(p => linkOf(app, p));
  const olds = recs.map(r => r ? { keys: r.fcurve ? r.fcurve.keys.map(k => ({ ...k })) : null, sets: r.interpolator ? r.interpolator.sets.map(s => [...s]) : null } : null);
  let news: typeof olds | null = null;
  const put = (snaps: typeof olds) => recs.forEach((r, i) => { const s = snaps[i]; if (!r || !s) return; if (r.fcurve && s.keys) r.fcurve.keys = s.keys.map((k: Key) => ({ ...k })); if (r.interpolator && s.sets) r.interpolator.sets = s.sets.map(x => [...x]); });
  const reeval = () => { app.anim.frame = app.anim.frame; app.events.emit('params'); };
  app.record(C, () => {
    if (news) { put(news); reeval(); return; }
    list.forEach((p, i) => {
      if (!app.anim.expressions.has(p)) return;          // no expression source: skipped
      const rec = recs[i]; if (!rec) return;              // other kinds: nothing
      const driven = Number(p.value);
      const drivers = rec.driverPaths.map(s => findParam(app, s));
      const bad = rec.driverPaths.filter((_, k) => !drivers[k]);
      if (bad.length || !drivers.length) { logNya(app, C, `a driver path of ${pathOf(p)} that does not resolve ("${bad.join(',')}"); the parameter is left alone`); return; }
      const values = drivers.map(d => Number(d!.value));
      if (rec.kind === 3) {
        subTask(app, 'SaveKey', { InputObjs: `${pathOf(p)} link fcurve (0x402, <id from the expression>)`, Time: values[0], Value: driven });
        rec.fcurve!.addKey(values[0], driven);
      } else if (rec.interpolator) {
        // task {ecebf698-...} (inferred: appends one set of relative values), Q7
        subTask(app, '{ecebf698-1af5-4c04-aa46-46119a508f10}', { Interpolator: pathOf(p), Drivers: values, Driven: driven });
        rec.interpolator.sets.push([driven, ...values]);
      }
    });
    news = recs.map(r => r ? { keys: r.fcurve ? r.fcurve.keys.map(k => ({ ...k })) : null, sets: r.interpolator ? r.interpolator.sets.map(s => [...s]) : null } : null);
    reeval();   // the interaction node of the parameter is invalidated
  }, () => { put(olds); reeval(); });
  setStatus(app, C, S_OK);
}

/** The first input item as an interpolator: the object itself, or the one of a parameter with a multi-link expression. */
function interpolatorOfInput(app: App, C: string, a: Record<string, any>, checkCount: boolean): Interpolator {
  const items = listOf(a.InputObj);
  if (!items.length) throw fail(E_INVALIDARG, `${C}: no input`, 0x3eb);   // attested for Get / Remove; inferred for GetNumRelativeValues (Q8)
  const first = items[0];
  if (checkCount && items.length > 1) app.logMsg('info', `WARNING : ${C}: more than one input; only ${first instanceof Parameter ? pathOf(first) : first instanceof Interpolator ? 'the first interpolator' : String(first)} is used (${msgId(0x3d)})`);
  if (first instanceof Interpolator) return first;
  const p = first instanceof Parameter ? first : paramsOfList(app, [first]).found[0];
  if (!p || !app.anim.expressions.has(p)) throw fail(E_INVALIDARG, `${C}: ${p ? pathOf(p) : String(first)} has no expression`, 0x8e);
  const rec = linkOf(app, p);
  if (!rec || rec.kind !== 4) throw fail(E_INVALIDARG, `${C}: the expression of ${pathOf(p)} is not a multi-link`, 0x8f);
  return rec.interpolator ?? new Interpolator();
}
function getNumRelativeValues(app: App, a: Record<string, any>): number {
  const n = interpolatorOfInput(app, 'GetNumRelativeValues', a, false).Count;
  setStatus(app, 'GetNumRelativeValues', S_OK);
  return writeBack(a, 'Value', n);
}
const indexArg = (v: any) => { const n = Number(v); return unset(v) || !Number.isFinite(n) ? 0 : Math.trunc(n); };
function getRelativeValue(app: App, a: Record<string, any>): number[] | null {
  const C = 'GetRelativeValue';
  const it = interpolatorOfInput(app, C, a, true); const i = indexArg(a.Index);
  if (!(i >= 0 && i < it.Count)) { app.logMsg('error', `${C}: index ${i} is out of range (${msgId(0x90)}, 0x80070057)`); setStatus(app, C, S_NOTHING); return null; }
  setStatus(app, C, S_OK);
  return writeBack(a, 'Value', [...it.sets[i]]);   // [driven value, driver values in driver order]
}
function removeRelativeValue(app: App, a: Record<string, any>): void {
  const C = 'RemoveRelativeValue';
  const it = interpolatorOfInput(app, C, a, true); const i = indexArg(a.Index);
  if (!(i >= 0 && i < it.Count)) { app.logMsg('error', `${C}: no set of relative values at index ${i} (${msgId(0x90)}, 0x80070057)`); setStatus(app, C, S_NOTHING); return; }
  it.sets.splice(i, 1);   // not undoable
  app.events.emit('params');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ ConnectSource
function connectSource(app: App, a: Record<string, any>): void {
  const C = 'ConnectSource'; const A = app.anim;
  const targets = unset(a.Target) ? [] : paramsOfList(app, a.Target).found;
  const raw = Array.isArray(a.InputObj) ? a.InputObj[0] : a.InputObj;
  const src: FCurve | ExpressionSource | null = raw instanceof FCurve || raw instanceof ExpressionSource ? raw : null;
  const former = src instanceof ExpressionSource && src.parameter ? [src.parameter] : [];
  recordSources(app, C, () => [...new Set([...targets, ...former])], () => {
    for (const p of targets) {
      // 1. any existing source is removed first
      subTask(app, 'RemoveAnimation', { InputObjs: pathOf(p), Time: A.frame, Type: 4 });
      const keep = src instanceof ExpressionSource && src.parameter === p ? src.text : null;
      A.removeAnimation(p);
      // 2. the per-target task connects the source
      if (src instanceof FCurve) {
        A.fcurves.set(p, src);                              // source kind 1, delta type 2 (inferred: fcurve)
        if (src.keys.length) p.value = src.eval(A.frame);
      } else if (src instanceof ExpressionSource) {
        const text = keep ?? src.text;
        const old = src.parameter;
        if (old && old !== p) { A.expressions.delete(old); sources.delete(old); }   // inferred: the previous connection is released first
        src.held = text; src.parameter = p; sources.set(p, src);
        if (text) install(app, p, text);                    // source kind 2, delta type 4
      }
      // neither interface: nothing is attached and the step still succeeds
    }
  });
  if (!src && !unset(raw)) logNya(app, C, 'a source that is neither an fcurve nor an expression object: nothing is attached');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ registration
export function registerFcurveLayerMarkingExprCommands(app: App, reg: (def: CommandDef) => void) {
  const st = stateOf(app);
  st.linkOf = (p) => linkOf(app, p);
  st.interpolatorOf = (p) => linkOf(app, p)?.interpolator ?? null;
  st.expressionOf = (p) => expressionOf(app, p);
  const IN = { name: 'InputObj', default: null };

  reg({ name: 'SetExpr', label: 'Basic Add Expression', category: 'Animation', description: 'Add an expression on a parameter',
    args: [IN, { name: 'ExprStr', default: '' }, { name: 'ExprObj', default: null }], execute: setExpr });
  reg({ name: 'EditExpr', label: 'Edit Expression...', category: 'Animation', description: 'Inspects the expressions on parameters', undoable: false,
    args: [IN], execute: editExpr });
  reg({ name: 'SetRelativeValues', label: 'Set Relative Values', category: 'Animation', description: 'Sets a key on the expression fcv',
    args: [IN], execute: setRelativeValues });
  reg({ name: 'GetNumRelativeValues', label: 'GetNumRelativeValues', category: '', description: 'Gets the number of sets of relative values in the Interpolator object', undoable: false,
    args: [IN, { name: 'Value', default: null }], execute: getNumRelativeValues });
  reg({ name: 'GetRelativeValue', label: 'GetRelativeValue', category: '', description: 'Get the set of relative values at index from the interpolator-driven parameter or the interpolator object itself', undoable: false,
    args: [IN, { name: 'Index', default: 0 }, { name: 'Value', default: null }], execute: getRelativeValue });
  reg({ name: 'RemoveRelativeValue', label: 'RemoveRelativeValue', category: '', description: 'Remove the set of relative values at index from the interpolator-driven parameter or the interpolator object itself', undoable: false,
    args: [IN, { name: 'Index', default: 0 }], execute: removeRelativeValue });
  reg({ name: 'ConnectSource', label: 'Connect Animation Source', category: 'Animation',
    args: [{ name: 'Target', default: null }, { name: 'InputObj', default: null }], execute: connectSource });
}
