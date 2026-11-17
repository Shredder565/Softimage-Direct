// Ledger row CMD-B8c, animation clipboard part: CopyAnimContainer, CopyAllAnimation, CopyAnimation,
// PasteAllAnimation, PasteAnimation. Brief: docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md.
// Original code written from that prose contract only (see fcurveCopyPasteRotationTasks.ts for the mapping notes).
//
//  * A clipboard record is (path relative to the copied item, leaf name, duplicated source, layer index). The
//    duplicated source is a copy of the fcurve (keys, extrapolation, interpolation) or the expression text.
//  * Q3 (inferred): the unidentified object kind that decides "relative path or leaf name" is taken to be the 3D
//    object, so the leaf name is the parameter's own name and a paste target that has a 3D object above it is
//    matched by relative path.
//  * Animation layers hold no sources in this build: only layer-0 records are produced; pasting a record of a
//    higher layer logs "not yet attested".
//  * A parameter driven by a quaternion source (ConvertEulerToQuat) is not copied: duplicating the shared
//    quaternion object was not described.
//  * CopyAnimContainer is SPEC-PARTIAL: the argument handling and the "multiple" flag are as read; the collection
//    and the application to the targets are inferred (matched by relative path) and say so in the log.
import { App, CommandDef } from '../core/commands';
import { Parameter, ParamSet } from '../core/params';
import { findParam } from './index';
import {
  Args, AnimRecord, AnimSource, S_OK, S_NOTHING, E_INVALIDARG,
  stateOf, boolArg, unset, fail, setStatus, logNya, cloneKey, scriptPath, hasObjectAncestor, paramsBeneath, animatableBeneath,
  inputItems, markedDefault, transact, refresh,
} from './fcurveCopyPasteRotationShared';

type Item = Parameter | ParamSet;

/** A copy of the animation source of a parameter: the fcurve first, else the expression (second source kind, inferred Q2). */
function duplicateSource(app: App, p: Parameter, useFCurves: boolean, useExpressions: boolean): AnimSource | null {
  const A = app.anim;
  const fc = A.fcurves.get(p);
  if (fc && useFCurves) return { kind: 'fcurve', keys: fc.keys.map(cloneKey), extrap: fc.extrap, interp: fc.interp };
  const text = A.expression(p);
  if (text !== undefined && useExpressions) return { kind: 'expression', text };
  return null;
}
const cloneSource = (s: AnimSource): AnimSource => s.kind === 'fcurve' ? { ...s, keys: s.keys.map(cloneKey) } : { ...s };
/** The records of the animation found beneath one item (layer 0 only in this build). */
function collect(app: App, command: string, input: Item, useFCurves: boolean, useExpressions: boolean): { found: Parameter[]; records: AnimRecord[] } {
  const A = app.anim; const Q = stateOf(app).quatSources;
  const prefix = scriptPath(input);
  const found = paramsBeneath(input).filter(p => (useFCurves && (A.fcurves.has(p) || Q.has(p))) || (useExpressions && A.expression(p) !== undefined));
  const records: AnimRecord[] = [];
  for (const p of found) {
    if (Q.has(p) && !A.fcurves.has(p)) { logNya(app, command, `duplication of the quaternion source of ${scriptPath(p)}: not copied`); continue; }
    const source = duplicateSource(app, p, useFCurves, useExpressions); if (!source) continue;
    const full = scriptPath(p);
    const path = p === input ? '' : full.startsWith(prefix + '.') ? full.slice(prefix.length + 1) : full;
    records.push({ path, leaf: p.def.name, source, layer: 0 });
  }
  return { found, records };
}
/** Connect a fresh duplicate of a clipboard source to a parameter (the nested ConnectSource). Runs inside a transact. */
function connect(app: App, p: Parameter, source: AnimSource): void {
  const A = app.anim; const s = cloneSource(source);
  A.removeAnimation(p); stateOf(app).quatSources.delete(p);
  if (s.kind === 'expression') { A.setExpression(p, s.text, name => findParam(app, name)); return; }
  const fc = A.fcurve(p, true)!; fc.keys = s.keys; fc.extrap = s.extrap; fc.interp = s.interp;
}

// ------------------------------------------------------------------ CopyAllAnimation / CopyAnimation
function copyAnimation(app: App, command: 'CopyAllAnimation' | 'CopyAnimation', a: Args): void {
  const st = stateOf(app);
  // Registry: CopyAllAnimation takes objects (null = the selection), CopyAnimation animatable parameters (null = marked).
  const items: Item[] = unset(a.InputObjs) ? (command === 'CopyAllAnimation' ? [...app.selection] : markedDefault(app)) : inputItems(app, a.InputObjs).map(x => x.item);
  if (!items.length) { setStatus(app, command, S_NOTHING); return; }
  const input = items[0];   // only the first item of the list is used
  const base = boolArg(a.BaseAnimation), layers = boolArg(a.LayerAnimation);
  const { found, records } = collect(app, command, input, boolArg(a.UseFCurves), boolArg(a.UseExpressions));
  if (found.length) {
    st.animClipboard.length = 0;   // cleared once, before the first found parameter: a copy that finds nothing keeps the clipboard
    if (base) st.animClipboard.push(...records);
    if (layers && app.anim.layers.length) app.logMsg('info', `${command}: the animation layers of this build hold no sources; only base animation is copied`);
  }
  // RemoveAnimation is read and never used by the worker: the source animation stays.
  setStatus(app, command, S_NOTHING);   // status 1 after a normal walk
}

// ------------------------------------------------------------------ PasteAllAnimation / PasteAnimation
function pasteAnimation(app: App, command: 'PasteAllAnimation' | 'PasteAnimation', a: Args): void {
  const st = stateOf(app);
  const targets: Item[] = unset(a.InputObjs) ? (command === 'PasteAllAnimation' ? [...app.selection] : markedDefault(app)) : inputItems(app, a.InputObjs).map(x => x.item);
  const usePosition = boolArg(a.UsePosition);
  const clip = st.animClipboard;
  const touched = new Set<Parameter>();
  for (const t of targets) animatableBeneath(t).forEach(p => touched.add(p));
  let pastedAll = 0;
  transact(app, command, touched, () => {
    const paste = (p: Parameter, rec: AnimRecord) => {
      if (rec.layer > 0) { logNya(app, command, `paste on animation layer ${rec.layer} of ${scriptPath(p)}: layers hold no sources in this build`); return; }
      connect(app, p, rec.source); pastedAll++;
    };
    for (const target of targets) {
      const full = scriptPath(target);
      const byPath = hasObjectAncestor(target);
      if (!byPath && clip.length) logNya(app, command, `leaf-name matching for ${full} (the object kind that selects it is not identified)`, 'Q3');
      const beneath = animatableBeneath(target);
      let pasted = 0;
      for (const rec of clip) {
        const s = byPath ? rec.path : rec.leaf;
        const p = s === '' ? (target instanceof Parameter && target.animatable && !target.def.readOnly ? target : undefined)
          : beneath.find(q => scriptPath(q) === `${full}.${s}`);
        if (p) { paste(p, rec); pasted++; }
      }
      if (pasted || !usePosition) continue;
      // Positional paste: the records are dealt onto the target's parameters in order; consecutive records of
      // the same path and leaf with a strictly increasing layer index stay on the same parameter.
      let i = -1; let prev: AnimRecord | null = null;
      for (const rec of clip) {
        if (!(prev && rec.path === prev.path && rec.leaf === prev.leaf && rec.layer > prev.layer)) i++;
        if (i >= beneath.length) break;
        paste(beneath[i], rec); prev = rec;
      }
    }
  });
  refresh(app);
  setStatus(app, command, pastedAll ? S_OK : S_NOTHING);
}

// ------------------------------------------------------------------ CopyAnimContainer (SPEC-PARTIAL)
function copyAnimContainer(app: App, a: Args): void {
  // UnPackArg: InputObj is an object list, or one element reference / hierarchy wrapped in a one-item list.
  const sources = unset(a.InputObj) ? [] : inputItems(app, a.InputObj).map(x => x.item);
  if (!sources.length) throw fail(E_INVALIDARG, 'CopyAnimContainer: InputObj is not an object list, an element reference or a hierarchy');
  const targets = unset(a.Target) ? [] : inputItems(app, a.Target).map(x => x.item);
  const multiple = sources.length >= 2 || targets.length >= 2;
  logNya(app, 'CopyAnimContainer', 'what is collected from the source container and how its parameters are matched on the targets: animated parameters are matched by their path relative to the container', 'Q1');
  if (multiple && sources.length >= 2) logNya(app, 'CopyAnimContainer', 'pairing of several source containers with the targets: every source is applied to every target', 'Q1');
  // Working data: the animation beneath the source container(s).
  const work: AnimRecord[] = [];
  for (const s of sources) work.push(...collect(app, 'CopyAnimContainer', s, true, true).records);
  if (!work.length) { setStatus(app, 'CopyAnimContainer', S_NOTHING); return; }
  const touched = new Set<Parameter>();
  for (const t of targets) animatableBeneath(t).forEach(p => touched.add(p));
  let n = 0;
  transact(app, 'CopyAnimContainer', touched, () => {
    for (const t of targets) {
      const full = scriptPath(t); const beneath = animatableBeneath(t);
      for (const rec of work) {
        const p = rec.path === '' ? (t instanceof Parameter ? t : undefined) : beneath.find(q => scriptPath(q) === `${full}.${rec.path}`);
        if (p && !sources.includes(p)) { connect(app, p, rec.source); n++; }
      }
    }
  });
  refresh(app);
  setStatus(app, 'CopyAnimContainer', n ? S_OK : S_NOTHING);
}

const arg = (name: string, dflt: any = null) => ({ name, default: dflt });
export function registerFcurveCopyPasteAnimCommands(app: App): void {
  const reg = (def: CommandDef) => app.register({ category: 'Animation', ...def });
  const copyArgs = [arg('InputObjs'), arg('UseFCurves', true), arg('UseExpressions', true), arg('RemoveAnimation', false), arg('BaseAnimation', true), arg('LayerAnimation', true)];
  reg({
    name: 'CopyAnimContainer', label: 'Copy Animation Container', description: 'Copy the animation from a container to an other container',
    args: [arg('InputObj'), arg('Target')], execute: (host, a) => copyAnimContainer(host, a),
  });
  reg({
    name: 'CopyAllAnimation', label: 'Copy All Animation', description: 'Copy All the animation of the specified type into the clipboard buffer', undoable: false,
    args: copyArgs.map(x => ({ ...x })), execute: (host, a) => copyAnimation(host, 'CopyAllAnimation', a),
  });
  reg({
    name: 'CopyAnimation', label: 'Copy Animation', description: 'Copy the animations of the specified type into the clipboard buffer', undoable: false,
    args: copyArgs.map(x => ({ ...x })), execute: (host, a) => copyAnimation(host, 'CopyAnimation', a),
  });
  reg({
    name: 'PasteAllAnimation', label: 'Paste All Animation', description: 'Paste All the animation in the buffer on the selected items',
    args: [arg('InputObjs'), arg('UsePosition', false)], execute: (host, a) => pasteAnimation(host, 'PasteAllAnimation', a),
  });
  reg({
    name: 'PasteAnimation', label: 'Paste Animation', description: 'Paste the animations in the buffer on the marked items',
    args: [arg('InputObjs'), arg('UsePosition', true)], execute: (host, a) => pasteAnimation(host, 'PasteAnimation', a),
  });
}
