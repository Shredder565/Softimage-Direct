// Ledger row CMD-B6e. Brief: docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md, "Wire contract".
// Original code written from that contract only.
//
// 24 scripting names Softimage ships as VBScript procedures. This file: registration, the duplicate.vbs commands
// (CopyAllAnimation2, RemoveAllAnimation, DuplicateFromAnim, SaveKeyAtMultipleFrames) and the action.vbs command
// (FindPeriods, UI entry). Rendering.vbs: duplicateRenderingSimulationScriptsRendering.ts. simulation.vbs:
// duplicateRenderingSimulationScriptsSimulation.ts. Shared helpers: duplicateRenderingSimulationScriptsShared.ts.
//
// How this build differs from a Softimage session, and why:
//
//  * The scripts are orchestration over other commands. Every delegated call is recorded, in order and with the
//    contract's values, in `app.duplicateRenderingSimulationScripts.calls` ({ name, args, via }). `via` says whether
//    the call ran on the bus, was produced by a documented stand-in here (the callee is a C++ command of another row
//    that is not on the bus, or is modelled too loosely there), or is not attested and only logged.
//  * Dialogs. The bus is synchronous: a command that opens a modal page returns a Promise in an interactive
//    session. `app.duplicateRenderingSimulationScripts.dialog` can answer instead of a user (then the command is
//    synchronous). With `app.Interactive === false` the page cannot open, which counts as Cancel (note, inferred).
//  * In/out and output arguments. The bus copies the argument record, so the values written back are kept in
//    `app.duplicateRenderingSimulationScripts.out[<command>]`; an output argument `Value` is also the result.
//  * Overloads. One command per scripting name is registered: for CopyAllAnimation2 / RemoveAllAnimation the
//    "all animation" entry (the other entries differ in defaults only and are listed in `.entries`), for
//    DuplicateFromAnim the scripted entry (the key-assignable entry is `.ui.DuplicateFromAnim(args)`). FindPeriods
//    is registered as the UI entry "Find Cycle Input", the only FindPeriods entry this note specifies; the C++
//    worker it calls is the stand-in `.findPeriods(...)` (inferred).
import { App, type CommandDef } from '../core/commands';
import { X3DObject, Node, Property } from '../core/scene';
import { num, int, bool, str, type Parameter } from '../core/params';
import { ClipNode, T_ANIM, T_ANIM_CPD, clipType, tc, setTc, editMixer } from '../core/mixerActionScripts';
import {
  stateOf, text, unset, truthy, info, nya, cancel, enumName, trace, busCall, siName, collection, ownerObject, paramOf, keepSelection,
  after, modalPage, layoutBuilder, inputBox, msgBox, withRootProperty, CommandCancelled,
} from './duplicateRenderingSimulationScriptsShared';
import { registerRenderingScriptCommands } from './duplicateRenderingSimulationScriptsRendering';
import { registerSimulationScriptCommands } from './duplicateRenderingSimulationScriptsSimulation';

// ------------------------------------------------------------------ animation helpers
/** Parameter filter numbers the scripts compare with: 5 scaling, 6 rotation, 7 translation, 8 transform; anything else = all. */
function parameterFilter(v: unknown): number {
  const n = enumName(v);
  if (typeof n === 'number') return n;
  return ({ siScalingParam: 5, siRotationParam: 6, siTranslationParam: 7, siTransformParam: 8 } as Record<string, number>)[n] ?? 0;
}
const SOURCE_NAMES: Record<string, string> = { sianysource: 'any', sifcurvesource: 'fcurve', siexpressionsource: 'expression', siconstraintsource: 'constraint', siscriptedoperatorsource: 'scriptedop' };
/** 'any' | 'fcurve' | 'expression' | 'constraint' | 'scriptedop' | 'other'. Numeric siSourceType values are not attested. */
function sourceKind(v: unknown): string { const n = enumName(v); return typeof n === 'string' ? SOURCE_NAMES[n.toLowerCase()] ?? 'other' : 'other'; }

/** The locally animatable parameters of an object ("all parameters" of the scripts). */
function localParams(n: Node): Parameter[] {
  const out: Parameter[] = [];
  const add = (set: { params: Parameter[] } | null | undefined) => { if (set) for (const p of set.params) if (!out.includes(p)) out.push(p); };
  if (n instanceof X3DObject) {
    add(n.kinematics.local); add(n);
    for (const p of n.properties) add(p);
    if (n.primitive) { add(n.primitive); for (const op of (n.primitive as any).operators ?? []) add(op); }
  } else add(n);
  return out;
}
function familyParams(o: Node, filter: number): Parameter[] {
  if (!(o instanceof X3DObject)) return [];
  const L = o.kinematics.local;
  const pick = (stem: string) => ['x', 'y', 'z'].map(ax => L.get(stem + ax)).filter((p): p is Parameter => !!p);
  if (filter === 5) return pick('scl');
  if (filter === 6) return pick('rot');
  if (filter === 7) return pick('pos');
  return [...L.params];
}
const isStatic = (keys: { value: number }[]) => keys.length > 0 && keys.every(k => k.value === keys[0].value);

/** Remove the fcurve and / or expression of one parameter (undoable). `time`: the value the parameter keeps. */
function removeFrom(app: App, p: Parameter, fcurves: boolean, expressions: boolean, time: number | null) {
  const A = app.anim; const fc = A.fcurves.get(p); const ex = A.expressions.get(p);
  const dropFc = fcurves && !!fc, dropEx = expressions && !!ex;
  if (!dropFc && !dropEx) return false;
  const old = p.value;
  // inferred: the parameter keeps the curve's value at `Time` (the callee's use of Time is not in this note)
  const keep = dropFc && time !== null && time !== A.frame && fc!.keys.length ? fc!.eval(time) : old;
  app.record('Remove animation', () => { if (dropFc) A.fcurves.delete(p); if (dropEx) A.expressions.delete(p); if (keep !== old) p.value = keep; },
    () => { if (dropFc) A.fcurves.set(p, fc!); if (dropEx) A.expressions.set(p, ex!); if (keep !== old) p.value = old; });
  return true;
}
/** Stand-in for `RemoveAnimation <list>, Time, StaticFCurves, BaseAnimation, LayerAnimation, SourceMask` (the bus has a one-argument form). */
function removeAnimationStandIn(app: App, target: string, params: Parameter[], a: Record<string, any>, kind: string) {
  const time = unset(a.Time) ? app.anim.frame : Number(a.Time);
  trace(app, 'RemoveAnimation', [target, time, truthy(a.StaticFCurves), truthy(a.BaseAnimation), truthy(a.LayerAnimation), a.SourceMask], 'stand-in');
  if (!truthy(a.BaseAnimation)) { nya(app, 'RemoveAllAnimation', 'layer-only removal: animation layers carry no curves in this build, nothing removed'); return; }
  if (kind === 'scriptedop') { nya(app, 'RemoveAllAnimation', 'scripted operator sources are not modelled in this build, nothing removed'); return; }
  const wantFc = kind === 'any' || kind === 'fcurve', wantEx = kind === 'any' || kind === 'expression';
  const staticOnly = truthy(a.StaticFCurves);   // inferred from the public command reference: True removes only constant fcurves
  for (const p of params) {
    const fc = app.anim.fcurves.get(p);
    removeFrom(app, p, wantFc && !!fc && (!staticOnly || isStatic(fc.keys)), wantEx && !staticOnly, time);
  }
  app.events.emit('params');
}
/** Stand-in for `IsAnimated <object>, SourceMask, BranchFlag, <out list>, True` (local animation only). */
function isAnimatedStandIn(app: App, o: Node, a: Record<string, any>, kind: string): Parameter[] {
  const branch = String(enumName(a.BranchFlag)) === 'siBranch';
  const objs: Node[] = [o];
  if (branch && o instanceof X3DObject) objs.push(...o.descendants());   // inferred: branch = the object and its descendants
  const A = app.anim; const wantFc = kind === 'any' || kind === 'fcurve', wantEx = kind === 'any' || kind === 'expression';
  const list = objs.flatMap(localParams).filter(p => (wantFc && (A.fcurves.get(p)?.keys.length ?? 0) > 0) || (wantEx && A.expressions.has(p)));
  trace(app, 'IsAnimated', [o, a.SourceMask, a.BranchFlag, list.map(p => p.fullName), true], 'stand-in');
  return list;
}

// ------------------------------------------------------------------ CopyAllAnimation2
const COPY_SUFFIX: Record<number, string> = { 8: '.kine', 5: '.kine.local.scl', 6: '.kine.local.ori.euler', 7: '.kine.local.pos' };
function copyAllAnimation(app: App, a: Record<string, any>) {
  const input = collection(app, a.InputObjs);
  if (!input) { info(app, 'not the right selection....'); return undefined; }
  if (!input.length) return undefined;
  const kind = sourceKind(a.SourceMask);
  if (kind !== 'any' && kind !== 'fcurve' && kind !== 'expression') { info(app, 'Sorry this command is not implemented to copy constraints yet'); return undefined; }
  const fcurves = kind !== 'expression', expressions = kind !== 'fcurve';
  const filter = parameterFilter(a.ParameterMask); const suffix = COPY_SUFFIX[filter];
  const remove = truthy(a.RemoveAnimation), base = truthy(a.BaseAnimation), layer = truthy(a.LayerAnimation);
  const A = app.anim;
  for (const o of input) {
    const target = suffix ? siName(app, o) + suffix : siName(app, o);
    const params = suffix ? familyParams(o, filter) : localParams(o);
    // CopyAnimation is not on the bus: the copy-to-buffer is produced here. Each call replaces the buffer (inferred, Q3).
    trace(app, 'CopyAnimation', [target, fcurves, expressions, remove, base, layer], 'stand-in');
    const items: { param: string; keys: { time: number; value: number }[]; expr?: string }[] = [];
    if (!base) nya(app, 'CopyAllAnimation2', 'layer-only copy: animation layers carry no curves in this build, the buffer is left empty');
    else for (const p of params) {
      const keys = fcurves ? (A.fcurves.get(p)?.keys ?? []).map(k => ({ ...k })) : [];
      const expr = expressions ? A.expression(p) : undefined;
      if (keys.length || expr) items.push({ param: p.fullName, keys, expr });
      if (remove && (keys.length || expr)) removeFrom(app, p, fcurves, expressions, null);   // inferred: the callee's RemoveAnimation flag removes what was copied
    }
    stateOf(app).animClipboard = { target, items };
  }
  if (remove) app.events.emit('params');
  return undefined;
}

// ------------------------------------------------------------------ RemoveAllAnimation
function removeAllAnimation(app: App, a: Record<string, any>) {
  const input = collection(app, a.InputObjs);
  if (!input || !input.length) return undefined;
  const kind = sourceKind(a.SourceMask);
  if (kind === 'constraint') { busCall(app, 'RemoveAllCns', { ConstrainedObj: input }, [input]); return undefined; }
  if (kind === 'other') nya(app, 'RemoveAllAnimation', `source mask ${String(a.SourceMask)} (numeric siSourceType values are not attested); nothing removed`);
  const filter = parameterFilter(a.ParameterMask);
  for (const o of input) {
    if (filter === 5 || filter === 6 || filter === 7) {
      const suffix = filter === 5 ? '.kine.local.scl.scl*' : filter === 6 ? '.kine.local.ori.euler.rot*' : '.kine.local.pos.pos*';
      removeAnimationStandIn(app, siName(app, o) + suffix, familyParams(o, filter), a, kind);
    } else if (filter === 8) {
      // The shipped path is `<object>/.kine.local` (leading slash). Whether the resolver accepts it is open (Q1).
      // inferred: it is read as `<object>.kine.local`, i.e. every local transform parameter (the registry description).
      nya(app, 'RemoveAllAnimation', `the path "${siName(app, o)}/.kine.local" is read as the object's local kinematics`, 'Q1');
      removeAnimationStandIn(app, `${siName(app, o)}/.kine.local`, familyParams(o, 8), a, kind);
    } else {
      const list = isAnimatedStandIn(app, o, a, kind);
      if (list.length) removeAnimationStandIn(app, list.map(p => p.fullName).join(','), list, a, kind);
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ DuplicateFromAnim
const MAX_SAMPLES = 100000;
function duplicateFromAnim(app: App, a: Record<string, any>): unknown[] {
  const objs = collection(app, a.InputObjs) ?? [];
  const out: unknown[] = [];
  if (!objs.length) return out;
  const start = Number(a.StartFrame), end = Number(a.EndFrame), step = Number(a.StepFrame);
  if (![start, end, step].every(Number.isFinite)) throw new Error('DuplicateFromAnim: StartFrame, EndFrame and StepFrame must be numbers');
  // A step of 0 never terminates in the script (inferred from the loop form); refused here.
  if (step === 0) throw new Error('DuplicateFromAnim: StepFrame is 0, the frame loop would never end');
  if (Math.floor((end - start) / step) + 1 > MAX_SAMPLES) throw new Error(`DuplicateFromAnim: more than ${MAX_SAMPLES} sampled frames`);
  const instance = truthy(a.DoInstance);
  for (let i = 0, f = start; step > 0 ? f <= end : f >= end; i++, f = start + i * step) {
    trace(app, 'SetValue', ['Project.Data.PlayControl.Current', f], 'stand-in');   // the play control is not a parameter path in this build
    app.anim.frame = f;
    trace(app, 'Refresh', [], 'stand-in'); app.events.emit('frame');
    let r: unknown;
    if (instance) {
      // Instantiate <objs>, NbItems default, Hierarchy / Grouping / Selection / Xfrom = 1: the low-level command of this build takes the list and a count.
      trace(app, 'Instantiate', [objs, undefined, 1, 1, 1, 1], 'bus');
      r = app.run('SIInstantiate', { InputObjs: objs });
    } else {
      // Duplicate <objs>, 1, ..., siNoAnimation, siNoConstraints, siNoSelection, siGlobalXForm: the bus command copies
      // without animation; it selects its copies, so the selection is put back (siNoSelection).
      r = keepSelection(app, () => busCall(app, 'Duplicate', { InputObjs: objs, NbCopies: 1 }, [objs, 1, undefined, undefined, undefined, undefined, 'siNoAnimation', 'siNoConstraints', 'siNoSelection', 'siGlobalXForm']));
    }
    if (Array.isArray(r)) out.push(...r); else if (r !== undefined && r !== null) out.push(r);
  }
  return out;   // the play cursor stays on the last sampled frame
}
/** Key-assignable UI entry: asks for the range in a modal page, then runs the scripted entry. */
function duplicateFromAnimUi(app: App, args: Record<string, any> = {}) {
  const A = app.anim; const tin = A.startFrame, tout = A.endFrame;
  const hard = { min: -1000000, max: 1000000 };
  const prop = new Property('Duplicate From Animation', 'customparamset', [
    num('Start', tin, 'Start Frame', { ...hard, uimin: tin, uimax: tout }), num('End', tout, 'End Frame', { ...hard, uimin: tin, uimax: tout }),
    num('Step', 10, 'Step value', { ...hard, uimin: 0, uimax: tout - tin }), bool('Instance', truthy(args.DoInstance), 'Instance (Model Only)'),
  ]);
  const remove = withRootProperty(app, prop);
  trace(app, 'InspectObj', [prop.name, '', text(1068), 'siModal'], 'stand-in');
  let ok: boolean | Promise<boolean>;
  try { ok = modalPage(app, 'DuplicateFromAnim', text(1068), prop, layoutBuilder(prop, ['Start', 'End', 'Step', 'Instance'].map(param => ({ param })))); } catch (e) { remove(); throw e; }
  return after(ok, (okay) => {
    if (!okay) { trace(app, 'DeleteObj', [prop.name], 'stand-in'); remove(); cancel('DuplicateFromAnim'); }
    args.StartFrame = Number(prop.val('Start')); args.EndFrame = Number(prop.val('End')); args.StepFrame = Number(prop.val('Step')); args.DoInstance = !!prop.val('Instance');
    stateOf(app).out.DuplicateFromAnim = { StartFrame: args.StartFrame, EndFrame: args.EndFrame, StepFrame: args.StepFrame, DoInstance: args.DoInstance };
    try { app.run('DuplicateFromAnim', { InputObjs: args.InputObjs, StartFrame: args.StartFrame, EndFrame: args.EndFrame, StepFrame: args.StepFrame, DoInstance: args.DoInstance }); }
    finally { trace(app, 'DeleteObj', [prop.name], 'stand-in'); remove(); }
    return undefined;
  });
}

// ------------------------------------------------------------------ SaveKeyAtMultipleFrames
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/** VBScript integer conversion: round half to even. */
function vbRound(x: number): number { const f = Math.floor(x); const d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1; }
function keyParams(app: App, a: Record<string, any>): Parameter[] {
  if (unset(a.InputObjs)) {
    const sel = new Set<unknown>(app.selection);
    const owned = (p: Parameter) => { for (let x: any = p.owner; x; x = x.parent ?? null) if (sel.has(x)) return true; return false; };
    return [...app.anim.marked].filter(owned);   // the marked parameters of the selection
  }
  const list = Array.isArray(a.InputObjs) ? a.InputObjs : String(a.InputObjs).split(',');
  return list.map((x: unknown) => paramOf(app, x)).filter((p: Parameter | undefined): p is Parameter => !!p);
}
function saveKeyAtMultipleFrames(app: App, a: Record<string, any>) {
  const params = keyParams(app, a);
  if (params.length < 1) { info(app, 'You need to select items and mark parameters to key'); return undefined; }
  return after(inputBox(app, 'SaveKeyAtMultipleFrames', text(1069), text(1070)), (answer) => {
    const frames: number[] = [];
    for (const piece of (answer ?? '').split(',')) {
      const s = piece.replace(/ /g, '');
      if (!NUMERIC.test(s)) continue;
      const n = vbRound(Number(s));
      if (n < app.anim.startFrame || n > app.anim.endFrame) { info(app, `Input Key ignored key at frame: ${n} - outside the boundries of start and end frame`); continue; }
      frames.push(n);
    }
    if (!answer || !frames.length) { info(app, 'Invalid frame string'); return undefined; }
    const target = params.map(p => p.fullName).join(',');
    for (const t of frames) {
      // SaveKey <InputObjs>, <frame>: the bus command resolves one parameter path per call, so the keys are set here.
      trace(app, 'SaveKey', [target, t], 'stand-in');
      for (const p of params) {
        const fc = app.anim.fcurve(p, true)!; const had = fc.keys.find(k => k.time === t); const v = Number(p.value);
        app.record('Key', () => fc.addKey(t, v), () => { if (had) fc.addKey(t, had.value); else fc.removeKey(t); });
      }
    }
    app.events.emit('params');
    return undefined;
  });
}

// ------------------------------------------------------------------ FindPeriods
/** inferred stand-in for the C++ worker (its algorithm is not in the note): the smallest whole lag, not below the
 *  minimum, at which the sampled signal repeats over the range. Algorithm 0 looks at the rotations of the objects
 *  together and gives one period; algorithm 1 gives one period per input parameter (0 = none found). */
function findPeriodsStandIn(app: App, inputs: unknown, algorithm: number, start: number, end: number, minPeriod: number): number[] {
  const list: unknown[] = Array.isArray(inputs) ? inputs : unset(inputs) ? [] : String(inputs).split(',');
  const A = app.anim;
  const sample = (p: Parameter) => { const fc = A.fcurves.get(p); const out: number[] = []; for (let f = Math.ceil(start); f <= end; f++) out.push(fc && fc.keys.length ? fc.eval(f) : Number(p.value)); return out; };
  const period = (signals: number[][]): number => {
    const n = signals[0]?.length ?? 0; if (n < 3) return 0;
    const ranges = signals.map(s => Math.max(...s) - Math.min(...s));
    if (!ranges.some(r => r > 1e-9)) return 0;
    for (let lag = Math.max(1, Math.ceil(minPeriod)); lag <= Math.floor((n - 1) / 2); lag++) {
      let ok = true;
      for (let k = 0; ok && k < signals.length; k++) { const s = signals[k]; const tol = 1e-3 * ranges[k] + 1e-9; for (let i = 0; i + lag < n; i++) if (Math.abs(s[i + lag] - s[i]) > tol) { ok = false; break; } }
      if (ok) return lag;
    }
    return 0;
  };
  if (algorithm === 0) {
    const rot: Parameter[] = [];
    for (const x of list) { const o = x instanceof X3DObject ? x : typeof x === 'string' ? app.scene.find(x.trim()) : undefined; if (o) rot.push(...familyParams(o, 6)); }
    return rot.length ? [period(rot.map(sample))] : [];
  }
  return findInputs(app, list).map(p => period([sample(p)]));
}
function findInputs(app: App, list: unknown[]): Parameter[] {
  const out: Parameter[] = [];
  for (const x of list) {
    const p = paramOf(app, x);
    if (p) { out.push(p); continue; }
    const o = x instanceof X3DObject ? x : typeof x === 'string' ? app.scene.find(x.trim()) : undefined;
    if (o) out.push(...o.kinematics.local.params.filter(q => (app.anim.fcurves.get(q)?.keys.length ?? 0) > 0));   // inferred: an object stands for its animated local transform parameters
  }
  return out;
}
function findPeriodsUi(app: App, a: Record<string, any>) {
  const CMD = 'FindPeriods';
  const fail = (msg: string): never => { info(app, msg); msgBox(app, CMD, msg, 'Warning'); return cancel(CMD); };
  // 1. selection checks
  const objects = app.selection.filter((n): n is X3DObject => n instanceof X3DObject);
  const others = app.selection.filter(n => !(n instanceof X3DObject));
  if (!others.length) fail(text(1021));
  let clip: ClipNode | null = null;
  for (const n of others) {
    if (!(n instanceof ClipNode)) continue;
    const t = clipType(n.clip); if (t !== T_ANIM && t !== T_ANIM_CPD) continue;
    if (clip) fail(text(1020));
    clip = n;
  }
  if (!objects.length) fail(text(1021));
  if (!clip) { nya(app, CMD, 'non-object items are selected but none is an animation clip (the script leaves the clip undefined)', 'Q9'); return cancel(CMD); }
  const node: ClipNode = clip; const ref = node.ref;
  // 2. clip checks
  const startoffset = tc(ref, 'startoffset'), scale = tc(ref, 'scale'), clipin = tc(ref, 'clipin'), clipout = tc(ref, 'clipout'), dowarp = tc(ref, 'dowarp');
  const cycleStart = app.anim.frame, cycleEnd = startoffset + (clipout - clipin);
  if (cycleStart < startoffset || cycleStart > cycleEnd) fail(text(1022));
  if (scale !== 1) fail(text(1023));
  if (dowarp) fail(text(1024));
  // 3. the wizard property. Its preset file is open (Q10); the parameters are inferred from the note.
  const supplied = !unset(a.InputObjs);
  const prop = new Property('FindCycles', 'FindCycleWizard', [
    int('Algorithm', supplied ? 1 : 0, 'Algorithm', { min: 0, max: 1 }), num('Estimate', 2, 'Duration', { uimin: 2, uimax: cycleEnd - 1 }),
    str('MarkerName', '', 'Marker Name'), int('AddMarkers', 1, 'AddMarkers', { min: 0, max: 1 }),
  ]);
  const inputs: unknown = supplied ? a.InputObjs : objects;
  const remove = withRootProperty(app, prop);
  // 4. modal page, literal title
  let ok: boolean | Promise<boolean>;
  try { ok = modalPage(app, CMD, 'FindCycles', prop, layoutBuilder(prop, ['Algorithm', 'Estimate', 'MarkerName', 'AddMarkers'].map(param => ({ param })))); } catch (e) { remove(); throw e; }
  return after(ok, (okay) => {
    if (!okay) { remove(); cancel(CMD); }
    // 5. read back, call the worker
    const minPeriod = Number(prop.val('Estimate')), markerName = String(prop.val('MarkerName') ?? ''), addMarkers = Number(prop.val('AddMarkers')) === 1, algorithm = Number(prop.val('Algorithm'));
    remove();
    trace(app, 'FindPeriods', [inputs, algorithm, cycleStart, cycleEnd, minPeriod], 'stand-in');
    const periods = stateOf(app).findPeriods(inputs, algorithm, cycleStart, cycleEnd, minPeriod);
    stateOf(app).out.FindPeriods = { StartFrame: cycleStart, EndFrame: cycleEnd, 'Minimum Period Length': minPeriod, Mode: addMarkers ? 1 : 0, Name: markerName };
    // 6. report
    const cyclesOf = (p: number) => Math.floor((cycleEnd - cycleStart) / p);
    const next = addMarkers ? text(1026) : text(1027);
    let found: number | null = null;
    if (algorithm === 0) {
      const p = Number(periods[0]);
      if (!(p > 0)) { nya(app, CMD, 'algorithm 0 returned no period; the report and the action for that case are not specified'); return undefined; }
      const msg = text(1025, p, cycleStart + cyclesOf(p) * p);
      info(app, '\n' + msg); msgBox(app, CMD, `${msg}\n\n${next}`, 'Find Cycle Information');
      found = p;
    } else {
      if (!periods.length) return undefined;
      const names = findInputs(app, Array.isArray(inputs) ? inputs : String(inputs).split(','));
      if (periods.length !== names.length) fail(text(1029));
      const nonZero = periods.map((p, i) => ({ p: Number(p), name: siName(app, names[i]) })).filter(x => x.p !== 0);
      const blocks = nonZero.map(x => `- ${x.name} :\n   Period: ${x.p} frames ==> Cycle frame: ${cycleStart + cyclesOf(x.p) * x.p}\n\n`).join('');
      if (nonZero.length > 1) { const msg = `${addMarkers ? text(1030) : text(1031)}\n\n${blocks}`; info(app, msg); msgBox(app, CMD, msg, 'Find Cycle Information'); return undefined; }
      if (nonZero.length === 1) { info(app, blocks); msgBox(app, CMD, blocks + next, 'Find Cycle Information'); found = nonZero[0].p; }
      else { info(app, ''); msgBox(app, CMD, text(1032, minPeriod), 'Find Cycle Information'); return undefined; }
    }
    // 7. action
    const p = found!; const N = cyclesOf(p);
    if (addMarkers) {
      for (let i = 0; i <= N; i++) busCall(app, 'AddMarker', { Model: ref.model, Container: node, Time: cycleStart + i * p - startoffset, Duration: 0, Name: markerName });
    } else {
      const sets: [string, number][] = [['startoffset', cycleStart], ['clipout', clipin + cycleStart + N * p - startoffset - 1], ['clipin', clipin + cycleStart - startoffset]];
      editMixer(app, ref.mix, app.scene.root, 'Find Cycle: trim clip', () => { for (const [n, v] of sets) { trace(app, 'SetValue', [`${node.fullName}.actionclip.timectrl.${n}`, v], 'stand-in'); setTc(ref, n, v); } });
    }
    return undefined;
  });
}

// ------------------------------------------------------------------ registration
const SRC = (n: string) => `:${n}:siSourceType`, PF = (n: string) => `:${n}:siParameterFilter`;
const COPY_ENTRIES: [string, string, string, boolean][] = [
  ['Copy All Animation', 'siAnySource', 'siAllParam', true], ['Copy All Fcurve Animation', 'siFcurveSource', 'siAllParam', true],
  ['Copy All Layer Animation', 'siFcurveSource', 'siAllParam', false], ['Copy All Expression Animation', 'siExpressionSource', 'siAllParam', true],
  ['Copy Transform Animation', 'siAnySource', 'siTransformParam', true], ['Copy Scaling Animation', 'siAnySource', 'siScalingParam', true],
  ['Copy Rotation Animation', 'siAnySource', 'siRotationParam', true], ['Copy Translation Animation', 'siAnySource', 'siTranslationParam', true],
];
const REMOVE_ENTRIES: [string, string, string, boolean, boolean][] = [
  ['Remove All Animation', 'siAnySource', 'siAllParam', false, true], ['Remove All Fcurve Animation', 'siFcurveSource', 'siAllParam', false, true],
  ['Remove All Static Fcurve Animation', 'siFcurveSource', 'siAllParam', true, true], ['Remove All Layer Animation', 'siFcurveSource', 'siAllParam', false, false],
  ['Remove All Expression Animation', 'siExpressionSource', 'siAllParam', false, true], ['Remove All Constraint Animation', 'siConstraintSource', 'siAllParam', false, true],
  ['Remove All Scripted Operator Animation', 'siScriptedOperatorSource', 'siAllParam', false, true], ['Remove All Transform Animation', 'siAnySource', 'siTransformParam', false, true],
  ['Remove All Scaling Animation', 'siAnySource', 'siScalingParam', false, true], ['Remove All Rotation Animation', 'siAnySource', 'siRotationParam', false, true],
  ['Remove All Translation Animation', 'siAnySource', 'siTranslationParam', false, true],
];

export const DUPLICATE_RENDERING_SIMULATION_COMMANDS = [
  'CopyAllAnimation2', 'RemoveAllAnimation', 'DuplicateFromAnim', 'SaveKeyAtMultipleFrames', 'CreateEmptyPartition', 'SICreatePartition', 'CreatePassWithPartition',
  'GetPass', 'ConnectImageTo3DO', 'ShowNextOGLProjection', 'ShowPreviousOGLProjection', 'CreateCGFX', 'CreateFX', 'LaunchFlipbookForPass', 'ExportMI2File',
  'ExportAllPassesToMI2', 'EditShaderCompoundPPGLogic', 'StoreEnvironmentCacheToMixer', 'StoreEnvironmentCachesToMixer', 'MergeSimulationEnvironments',
  'ChangeEnvironmentDynamicsOperator', 'CacheObjectsIntoFileDialog', 'EditICECompoundPPGLogic', 'FindPeriods',
] as const;

export function registerDuplicateRenderingSimulationScriptsCommands(app: App) {
  if ((app as any).Interactive === undefined) (app as any).Interactive = true;
  const st = stateOf(app);
  const reg = (def: CommandDef) => app.register(def);
  st.findPeriods = (inputs, algorithm, start, end, minPeriod) => findPeriodsStandIn(app, inputs, algorithm, start, end, minPeriod);

  st.entries.CopyAllAnimation2 = COPY_ENTRIES.map(([label, s, p, base]) => ({ label, defaults: { SourceMask: SRC(s), ParameterMask: PF(p), RemoveAnimation: false, BaseAnimation: base, LayerAnimation: true } }));
  reg({
    name: 'CopyAllAnimation2', label: 'Copy All Animation', description: 'Copy All the animation of the specified type into the clipboard buffer',
    args: [{ name: 'InputObjs', default: null }, { name: 'SourceMask', default: SRC('siAnySource') }, { name: 'ParameterMask', default: PF('siAllParam') },
      { name: 'RemoveAnimation', default: false }, { name: 'BaseAnimation', default: true }, { name: 'LayerAnimation', default: true }],
    execute: (app, a) => copyAllAnimation(app, a),
  });
  st.entries.RemoveAllAnimation = REMOVE_ENTRIES.map(([label, s, p, stat, base]) => ({ label, defaults: { SourceMask: SRC(s), ParameterMask: PF(p), StaticFCurves: stat, BaseAnimation: base, LayerAnimation: true } }));
  reg({
    name: 'RemoveAllAnimation', label: 'Remove All Animation', category: 'Animation', description: 'Remove all animation from object',
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'BranchFlag', default: ':siUnspecified:siBranchFlag' }, { name: 'SourceMask', default: SRC('siAnySource') },
      { name: 'ParameterMask', default: PF('siAllParam') }, { name: 'StaticFCurves', default: false }, { name: 'BaseAnimation', default: true }, { name: 'LayerAnimation', default: true }],
    execute: (app, a) => removeAllAnimation(app, a),
  });
  reg({
    name: 'DuplicateFromAnim', label: 'Duplicate from Animation', category: 'Edit',
    args: [{ name: 'InputObjs', default: null }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 100 }, { name: 'StepFrame', default: 10 }, { name: 'DoInstance', default: false }],
    execute: (app, a) => duplicateFromAnim(app, a),
  });
  st.uiArgs.DuplicateFromAnim = ['InputObjs', 'StartFrame', 'EndFrame', 'StepFrame', 'DoInstance'].map(name => ({ name, default: null }));
  st.ui.DuplicateFromAnim = (args = {}) => duplicateFromAnimUi(app, args);
  reg({
    name: 'SaveKeyAtMultipleFrames', label: 'Save Key At Multiple Frames', category: 'Animation', description: 'Save key on marked parameters',
    args: [{ name: 'InputObjs', default: null }], execute: (app, a) => saveKeyAtMultipleFrames(app, a),
  });
  reg({
    name: 'FindPeriods', label: 'Find Cycle Input', category: 'Animation Mixer',
    args: [{ name: 'InputObjs', default: null }, { name: 'Algorithm', default: null }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null },
      { name: 'Minimum Period Length', default: null }, { name: 'Mode', default: null }, { name: 'Name', default: null }, { name: 'Title', default: 'Find Periods' }],
    execute: (app, a) => findPeriodsUi(app, a),
  });

  registerRenderingScriptCommands(app, reg);
  registerSimulationScriptCommands(app, reg);

  // What the check script prints: fully wired from the contract / partly (an open question or an unmodelled callee) / stand-in only.
  Object.assign(st.status, {
    CopyAllAnimation2: 'partial', RemoveAllAnimation: 'partial', DuplicateFromAnim: 'full', SaveKeyAtMultipleFrames: 'full', FindPeriods: 'partial',
    CreateEmptyPartition: 'partial', SICreatePartition: 'partial', CreatePassWithPartition: 'partial', GetPass: 'partial', ConnectImageTo3DO: 'full',
    ShowNextOGLProjection: 'full', ShowPreviousOGLProjection: 'full', CreateCGFX: 'partial', CreateFX: 'partial', LaunchFlipbookForPass: 'partial',
    ExportMI2File: 'partial', ExportAllPassesToMI2: 'stand-in', EditShaderCompoundPPGLogic: 'partial', EditICECompoundPPGLogic: 'partial',
    StoreEnvironmentCacheToMixer: 'stand-in', StoreEnvironmentCachesToMixer: 'stand-in', MergeSimulationEnvironments: 'partial',
    ChangeEnvironmentDynamicsOperator: 'partial', CacheObjectsIntoFileDialog: 'partial',
  });
}

export { CommandCancelled };
