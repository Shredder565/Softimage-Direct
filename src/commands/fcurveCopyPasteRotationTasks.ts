// Ledger row CMD-B8c. Brief: docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md, "Wire contract" sections and
// "Shared facts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   this file                         CopyKeys CutKeys DeleteKeys PasteKeys SelectKeysInTimespan DeselectAllKeys
//                                     Sequence SISequence ScaleAndOffset
//   fcurveCopyPasteRotationAnim.ts    CopyAnimContainer CopyAllAnimation CopyAnimation PasteAllAnimation PasteAnimation
//   fcurveCopyPasteRotationRot.ts     ConvertEulerToQuat ConvertQuatToEuler MakeRotationsContinuous
//
// How the contract is mapped onto this build:
//  * Argument lists and defaults are those of data/command_registry.json (the fcurve.dll entries); for `Sequence`
//    it is the entry handled by fcurve.dll, the three tasks.dll entries of that name are not this row.
//  * Task status codes that are not failures (0, 1) are kept in `app.fcurveCopyPasteRotation.lastStatus`; failure
//    statuses are thrown as SiStatusError. The commands return nothing, as the contract states.
//  * Frames are the time unit of this build's fcurves, so the frame / second conversions of the contract drop out.
//  * Key clipboard, animation clipboard and quaternion sources live in fcurveCopyPasteRotationShared.ts; the key
//    selection is the existing `app.anim.selectedKeys`. GK_KEYSELECTION_CHANGED is the 'params' event plus a counter.
//  * Not in this build, so not acted on: parameter locks (the lock check never fires), clips with a time control
//    (`CompensateForClip` true logs "not yet attested" and uses the range as given), animation layers that hold
//    sources (only the base layer, index 0, carries fcurves).
//  * RePackArg (PasteKeys `Offset`): written back into the argument record and kept in `state.out.PasteKeys`.
// Earlier inferred registrations of these names (animateSurface.ts) are replaced here; the menu commands of anim.ts
// (CopyAnimation<Group>, PasteAnimationMarked, MakeRotationKeysContinuous, ...) are other names and are untouched.
import { App, CommandDef } from '../core/commands';
import { type Key } from '../core/animation';
import { Parameter } from '../core/params';
import {
  Args, KeyRecord, S_OK, S_NOTHING, E_FAIL, E_INVALIDARG,
  stateOf, boolArg, numArg, unset, fail, setStatus, logNya, cloneKey, keyId, sameTime, scopeOf, scriptPath, scopeParams,
  alive, transact, refresh, putKeys, moveSelection, evalKeys,
} from './fcurveCopyPasteRotationShared';
import { registerFcurveCopyPasteAnimCommands } from './fcurveCopyPasteRotationAnim';
import { registerFcurveRotationCommands } from './fcurveCopyPasteRotationRot';

/** `Type` of a key command: UnPackArg pre-loads 1, so anything not understood is "the inputs as given". */
const keyScope = (v: any): number => { const n = scopeOf(v); return Number.isFinite(n) ? n : 1; };
function compensate(app: App, command: string, a: Args): void {
  if (boolArg(a.CompensateForClip)) logNya(app, command, 'CompensateForClip: mapping of the range through the owning clip (no clip time control in this build; the range is used as given)');
}
const inRange = (t: number, lo: number, hi: number) => t >= lo && t <= hi;
/** The keys of a parameter's fcurve inside [start, end] (only selected ones when asked). */
function gather(app: App, p: Parameter, start: number, end: number, selectedOnly: boolean): Key[] {
  const fc = app.anim.fcurves.get(p); if (!fc) return [];
  return fc.keys.filter(k => inRange(k.time, start, end) && (!selectedOnly || app.anim.selectedKeys.has(keyId(p, k.time)))).map(cloneKey);
}
function record(app: App, p: Parameter, keys: Key[], start: number, end: number): KeyRecord {
  return { param: p, path: scriptPath(p), name: p.def.name, keys, start, end, keyType: app.anim.fcurves.get(p)?.interp ?? 0 };
}

// ------------------------------------------------------------------ CopyKeys
function copyKeys(app: App, a: Args): void {
  const st = stateOf(app);
  const start = numArg(a.StartFrame, 1), end = numArg(a.EndFrame, 100);
  compensate(app, 'CopyKeys', a);
  if (boolArg(a.Reset)) st.keyClipboard.length = 0;
  const selectedOnly = boolArg(a.SelectedKeysOnly);
  // The per-task "already visited curve" set of the contract: a parameter is recorded once.
  for (const p of scopeParams(app, a.InputObjs, keyScope(a.Type), false)) {
    const keys = gather(app, p, start, end, selectedOnly);
    if (keys.length) st.keyClipboard.push(record(app, p, keys, start, end));   // an empty gather is skipped (inferred from CutKeys)
  }
  setStatus(app, 'CopyKeys', S_OK);
}

// ------------------------------------------------------------------ CutKeys / DeleteKeys
/** Remove the keys of [start, end] from the listed parameters; returns the number of fcurves changed. Runs inside a transact. */
function removeKeys(app: App, params: Parameter[], start: number, end: number, o: { ripple: boolean; selectedOnly: boolean; buffer: boolean }): number {
  const st = stateOf(app); let n = 0;
  for (const p of params) {
    const fc = app.anim.fcurves.get(p); if (!fc) continue;
    const gone = gather(app, p, start, end, o.selectedOnly);
    if (!gone.length) continue;   // "nothing in range" is tolerated
    const dropped = new Set(gone.map(k => k.time)); const moves = new Map<number, number | null>();
    const shift = o.ripple ? start - end - 1 : 0;   // keys after the range move earlier by the removed span
    const next: Key[] = [];
    for (const k of fc.keys) {
      if (dropped.has(k.time)) { moves.set(k.time, null); continue; }
      if (shift && k.time > end) { moves.set(k.time, k.time + shift); next.push({ ...k, time: k.time + shift }); } else next.push(cloneKey(k));
    }
    putKeys(app, p, next); moveSelection(app, p, moves);
    if (o.buffer) st.keyClipboard.push(record(app, p, gone, start, end));
    n++;
  }
  return n;
}
function cutKeys(app: App, command: 'CutKeys' | 'DeleteKeys', a: Args): void {
  const st = stateOf(app);
  const start = numArg(a.StartFrame, 1), end = numArg(a.EndFrame, 100);
  compensate(app, command, a);
  if (boolArg(a.Reset)) st.keyClipboard.length = 0;
  const params = scopeParams(app, a.InputObjs, keyScope(a.Type), true);
  transact(app, command, params, () => {
    removeKeys(app, params, start, end, { ripple: boolArg(a.Ripple), selectedOnly: boolArg(a.SelectedKeysOnly), buffer: boolArg(a.PutKeysInBuffer) });
  });
  refresh(app);
  setStatus(app, command, S_OK);
}

// ------------------------------------------------------------------ PasteKeys
function pasteKeys(app: App, a: Args): void {
  const st = stateOf(app); const A = app.anim;
  const start = numArg(a.StartFrame, 1); let end = numArg(a.EndFrame, 100);
  let noRange = false;
  if (end < start || end === Number.MIN_VALUE) { end = start; noRange = true; }
  compensate(app, 'PasteKeys', a);
  const ripple = boolArg(a.Ripple), merge = boolArg(a.Merge), relative = boolArg(a.Relative);
  const leftC = Number(a.LeftContinuity) || 0, rightC = Number(a.RightContinuity) || 0;
  const out = (offset: number) => { a.Offset = offset; st.out.PasteKeys = { Offset: offset }; };   // RePackArg
  const clip = st.keyClipboard;
  if (!clip.length) { out(0); setStatus(app, 'PasteKeys', S_OK); return; }
  const targets = scopeParams(app, a.InputObjs, keyScope(a.Type), false);
  // One record: pasted on every target. Several: only (record, target) pairs with the same parameter name, for
  // records whose source parameter still resolves. The kind-compatibility test of the contract was not read (Q5):
  // every animatable target is taken as compatible.
  const pairs: [KeyRecord, Parameter][] = [];
  if (clip.length === 1) for (const t of targets) pairs.push([clip[0], t]);
  else for (const rec of clip) { if (!alive(app, rec.param)) continue; for (const t of targets) if (rec.name === t.def.name) pairs.push([rec, t]); }
  const cleared = new Set<Parameter>(); const offsets: number[] = []; let status = S_OK;
  transact(app, 'PasteKeys', pairs.map(x => x[1]), () => {
    for (const [rec, t] of pairs) {
      if (!rec.keys.length) continue;
      const had = A.fcurves.get(t);
      if (!had && !(t.animatable && !t.def.readOnly)) { status = S_NOTHING; continue; }
      const first = rec.keys[0], last = rec.keys[rec.keys.length - 1];
      // Replace mode: the existing keys of the range are removed once per target (ripple off, not put in the buffer).
      if (!merge && !cleared.has(t)) {
        cleared.add(t);
        let lo = start, hi = end;
        if (noRange && !ripple) { lo = start + (first.time - rec.start); hi = start + (last.time - rec.start); }
        if (hi > lo) removeKeys(app, [t], lo, hi, { ripple: false, selectedOnly: false, buffer: false });
      }
      let keys = (A.fcurves.get(t)?.keys ?? []).map(cloneKey);
      const span = end !== start ? end - start + 1 : rec.end - rec.start + 1;
      if (ripple) {
        const moves = new Map<number, number | null>();
        keys = keys.map(k => { if (k.time < start) return k; moves.set(k.time, k.time + span); return { ...k, time: k.time + span }; });
        moveSelection(app, t, moves);
      }
      // Unscaled (time shift) with no explicit range, a zero-length request or a zero-length copied range;
      // otherwise scaled to fit the range about the centres of the two ranges.
      const copiedSpan = rec.end - rec.start;
      const unscaled = noRange || end === start || copiedSpan === 0;
      const factor = unscaled ? 1 : (end - start) / copiedSpan;
      const cc = (rec.start + rec.end) / 2, rc = (start + end) / 2;
      const offset = unscaled ? start - rec.start : rc - cc;
      const at = (time: number) => unscaled ? time + offset : (time - cc) * factor + rc;
      const pasted = rec.keys.map(k => ({ ...k, time: at(k.time) }));
      const existing = (time: number) => evalKeys(t, had, keys, time);
      const bump = (k: Key, v: number) => { const d = v - k.value; k.value = v; if (k.left !== undefined) k.left += d; if (k.right !== undefined) k.right += d; };
      if (relative) { const d = existing(pasted[0].time) - first.value; for (const k of pasted) bump(k, k.value + d); }
      const continuity = (k: Key, mode: number) => { if (!mode) return; const e = existing(k.time); bump(k, mode === 1 ? e : (k.value + e) / 2); };
      continuity(pasted[0], leftC); continuity(pasted[pasted.length - 1], rightC);
      for (const k of pasted) { const i = keys.findIndex(x => sameTime(x.time, k.time)); if (i >= 0) keys[i] = k; else keys.push(k); }
      putKeys(app, t, keys);
      for (const k of pasted) A.selectedKeys.add(keyId(t, k.time));   // pasted keys are marked selected
      offsets.push(offset);
    }
  });
  out(offsets.length && offsets.every(o => Math.abs(o - offsets[0]) <= 1e-6) ? offsets[0] : 0);
  if (offsets.length) keySelectionChanged(app);
  refresh(app);
  setStatus(app, 'PasteKeys', status);
}

// ------------------------------------------------------------------ SelectKeysInTimespan / DeselectAllKeys
function keySelectionChanged(app: App): void { stateOf(app).keySelectionChanged++; app.events.emit('params'); }
/** siFCurveKeySelectionMode: 1 set, 2 add, 3 remove, 4 toggle (names of 2..4 inferred, Q6). */
function selectionMode(v: any): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim(); if (/^-?\d+$/.test(s)) return Number(s);
  const tok = (s.match(/:?([A-Za-z0-9_]+)(?::|$)/)?.[1] ?? s).toLowerCase();
  if (/^sisetkeyselection$/.test(tok)) return 1;
  if (/^si(addto|add)keyselection$/.test(tok)) return 2;
  if (/^si(removefrom|remove)keyselection$/.test(tok)) return 3;
  if (/^sitogglekeyselection$/.test(tok)) return 4;
  return NaN;
}
function frameArg(name: string, v: any): number | null {
  if (unset(v)) return null;   // an empty variant: the whole curve
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw fail(E_INVALIDARG, `SelectKeysInTimespan: invalid argument ${name} (message 0x3eb)`);
  return n;
}
function selectKeysInTimespan(app: App, a: Args): void {
  const A = app.anim;
  const mode = selectionMode(a.Mode);
  if (!(mode >= 1 && mode <= 4) || !Number.isInteger(mode)) throw fail(E_INVALIDARG, 'SelectKeysInTimespan: invalid argument Mode (message 0x3eb)');
  const s = frameArg('StartFrame', a.StartFrame), e = frameArg('EndFrame', a.EndFrame);
  const whole = s === null || e === null;
  compensate(app, 'SelectKeysInTimespan', a);
  const params = scopeParams(app, a.InputObjs, keyScope(a.Type), true);
  transact(app, 'SelectKeysInTimespan', [], () => {
    if (mode === 1) A.selectedKeys.clear();   // the nested "deselect all"
    for (const p of params) {
      const fc = A.fcurves.get(p); if (!fc) continue;
      for (const k of fc.keys) {
        if (!whole && !inRange(k.time, s!, e!)) continue;
        const id = keyId(p, k.time);
        if (mode === 3) A.selectedKeys.delete(id);
        else if (mode === 4) { if (!A.selectedKeys.delete(id)) A.selectedKeys.add(id); }
        else A.selectedKeys.add(id);
      }
    }
  });
  keySelectionChanged(app);
  setStatus(app, 'SelectKeysInTimespan', S_OK);
}
function deselectAllKeys(app: App): void {
  transact(app, 'DeselectAllKeys', [], () => app.anim.selectedKeys.clear());
  keySelectionChanged(app);
  setStatus(app, 'DeselectAllKeys', S_OK);
}

// ------------------------------------------------------------------ Sequence / SISequence / ScaleAndOffset
function sequence(app: App, command: string, a: Args): void {
  const A = app.anim;
  const scale = numArg(a.Scale, 1), offset = numArg(a.Offset, 0);
  if (Math.abs(scale - 1) < 1e-6 && Math.abs(offset) < 1e-6) { setStatus(app, command, S_NOTHING); return; }
  if (Math.abs(scale) < 1e-6) throw fail(E_FAIL, `${command}: Scale is zero`);
  const type = scopeOf(a.Type);
  if (type !== 1 && type !== 2 && type !== 3) throw fail(E_FAIL, `${command}: Type ${String(a.Type)} is not 1, 2 or 3`);
  const start = numArg(a.StartFrame, 1), end = numArg(a.EndFrame, 100), pivot = numArg(a.Pivot, 1);
  const ripple = boolArg(a.Ripple), selectedOnly = boolArg(a.SelectedKeysOnly);
  const layer = numArg(a.Layer, -1);
  if (type === 3) logNya(app, command, 'Type 3 scene walk and the meaning of Mode there: the plain parameter fcurves of the scene are transformed, fcurves held by action sources / clips are not', 'Missing (a)');
  if (boolArg(a['Discrete Time'])) logNya(app, command, 'effect of Discrete Time: key times are not rounded', 'Missing (b)');
  if (ripple && (offset < 0 || pivot >= end)) logNya(app, command, 'the split into a scale pass and an offset pass with Ripple (negative offset / end-anchored scale): done as one pass', 'Missing (b)');
  // Only the base layer (index 0) carries fcurves in this build: Layer < 0 = all layers, 0 = base, other = nothing here.
  const params = layer > 0 ? [] : scopeParams(app, a.InputObjs, type, true);
  const map = (t: number) => (t - pivot) * scale + pivot + offset;
  let done = 0;
  transact(app, command, params, () => {
    for (const p of params) {
      const fc = A.fcurves.get(p); if (!fc || !fc.keys.length) continue;
      const take = (k: Key) => inRange(k.time, start, end) && (!selectedOnly || A.selectedKeys.has(keyId(p, k.time)));
      if (!fc.keys.some(take)) continue;
      // Ripple: the keys after the range follow the end of the range (inferred from the earlier registration; Missing (b)).
      const edge = ripple ? map(end) - end : 0;
      const moves = new Map<number, number | null>(); const moved: Key[] = []; const kept: Key[] = [];
      for (const k of fc.keys) {
        if (take(k)) { const t = map(k.time); moves.set(k.time, t); moved.push({ ...k, time: t }); }
        else if (edge && k.time > end) { moves.set(k.time, k.time + edge); moved.push({ ...k, time: k.time + edge }); }
        else kept.push(cloneKey(k));
      }
      // A key that is not moved and now shares its time with a moved key gives way to it.
      const next = [...kept.filter(k => !moved.some(m => sameTime(m.time, k.time))), ...moved];
      for (const k of kept) if (moved.some(m => sameTime(m.time, k.time)) && !moves.has(k.time)) A.selectedKeys.delete(keyId(p, k.time));
      putKeys(app, p, next); moveSelection(app, p, moves);
      done++;
    }
  });
  refresh(app);
  setStatus(app, command, done ? S_OK : S_NOTHING);
}

// ------------------------------------------------------------------ registration
const SCOPE_INPUT = ':siInputParams:siParameterScope';
const SEQ_MODE = ':siFCurvesAnimationSources:siSequenceMode';
const SEQ_DESC = 'Offsets and scales fcurves with respect to a pivot and start and end frames';
const arg = (name: string, dflt: any = null) => ({ name, default: dflt });

export function registerFcurveCopyPasteRotationTaskCommands(app: App): void {
  stateOf(app);
  const reg = (def: CommandDef) => app.register({ category: 'Animation', ...def });
  reg({
    name: 'CopyKeys', label: 'Copy FCurve Keys', description: 'Copy keys', undoable: false,
    args: [arg('InputObjs'), arg('StartFrame', 1), arg('EndFrame', 100), arg('Reset', true), arg('SelectedKeysOnly', false), arg('Type', SCOPE_INPUT), arg('CompensateForClip', false)],
    execute: (host, a) => copyKeys(host, a),
  });
  reg({
    name: 'CutKeys', label: 'Cut FCurve Keys', description: 'Cut keys',
    args: [arg('InputObjs'), arg('StartFrame', 1), arg('EndFrame', 100), arg('Reset', true), arg('Ripple', true), arg('SelectedKeysOnly', false), arg('Type', SCOPE_INPUT), arg('PutKeysInBuffer', true), arg('CompensateForClip', false)],
    execute: (host, a) => cutKeys(host, 'CutKeys', a),
  });
  reg({
    name: 'DeleteKeys', label: 'Delete FCurve Keys', description: 'Delete keys',
    args: [arg('InputObjs'), arg('StartFrame', 1), arg('EndFrame', 100), arg('Ripple', false), arg('SelectedKeysOnly', false), arg('Type', SCOPE_INPUT), arg('Reset', false), arg('PutKeysInBuffer', false), arg('CompensateForClip', false)],
    execute: (host, a) => cutKeys(host, 'DeleteKeys', a),
  });
  reg({
    name: 'PasteKeys', label: 'Paste FCurve Keys', description: 'Paste keys',
    args: [arg('InputObjs'), arg('StartFrame', 1), arg('EndFrame', 100), arg('Ripple', true), arg('Merge', true), arg('Type', SCOPE_INPUT), arg('CompensateForClip', false),
      arg('Offset', 0), arg('Relative', false), arg('LeftContinuity', 0), arg('RightContinuity', 0)],
    execute: (host, a) => pasteKeys(host, a),
  });
  reg({
    name: 'SelectKeysInTimespan', label: 'Select Keys In Timespan',
    args: [arg('InputObjs'), arg('Mode', ':siSetKeySelection:siFCurveKeySelectionMode'), arg('StartFrame'), arg('EndFrame'), arg('Type', SCOPE_INPUT), arg('CompensateForClip', false)],
    execute: (host, a) => selectKeysInTimespan(host, a),
  });
  reg({ name: 'DeselectAllKeys', label: 'Deselect All Keys', description: 'Deselects all the keys on all the fcurves', args: [], execute: (host) => deselectAllKeys(host) });
  const seqHead = (type: string) => [arg('InputObjs'), arg('Type', type), arg('Offset', 0), arg('Scale', 1), arg('StartFrame', 1), arg('EndFrame', 100), arg('Pivot', 1)];
  reg({
    name: 'Sequence', label: 'Sequence', description: SEQ_DESC,
    args: [...seqHead(':siAllAnimParams:siSequenceType'), arg('Mode', SEQ_MODE), arg('Ripple', true), arg('Discrete Time', false), arg('AllLayers', true)],   // AllLayers is never read
    execute: (host, a) => sequence(host, 'Sequence', a),
  });
  reg({
    name: 'SISequence', label: 'SISequence', description: SEQ_DESC,
    args: [...seqHead(':siAllAnimParams:siSequenceType'), arg('Mode', SEQ_MODE), arg('Ripple', true), arg('Discrete Time', false)],
    execute: (host, a) => sequence(host, 'SISequence', a),
  });
  reg({
    name: 'ScaleAndOffset', label: 'Scale and Offset fcurves', description: SEQ_DESC,
    args: [...seqHead(':siAnimatedParameters:siParameterScope'), arg('Ripple', true), arg('Mode', SEQ_MODE), arg('Discrete Time', false), arg('SelectedKeysOnly', false), arg('Layer', -1)],
    execute: (host, a) => sequence(host, 'ScaleAndOffset', a),
  });
  registerFcurveCopyPasteAnimCommands(app);
  registerFcurveRotationCommands(app);
}
