// Ledger row CMD-B9d. Brief: docs/ghidra/cmd-b9d-phonemeui-speech-binary.md, sections 2.2, 2.4, 2.5 and the
// "Contracts" of the 20 SpeechOp* editing commands. Original code written from that prose contract only; no XSIBATCH
// golden exists for the row.
//
//   delete class     SpeechOpDeleteWords SpeechOpDeletePhonemes
//   insert class     SpeechOpInsertWord
//   17-command class SpeechOpMoveWords SpeechOpMovePhoneme SpeechOpScaleWordStart SpeechOpScaleWordEnd
//                    SpeechOpScalePhonStart SpeechOpScalePhonEnd SpeechOpSplitPhonemes SpeechOpSetPhonemesIPAValue
//                    SpeechOpSetPhonemes{Weight,FalloffIn,FalloffOut,ShapeWeight,ShapeFalloffIn,ShapeFalloffOut,
//                    BlendIn,BlendOut,Variation}
//
// Undo model (2.5): the first Do takes a full snapshot; Undo copies it back and notifies; Redo re-runs Do without
// retaking it. The move / scale workers restore the live data from the snapshot before applying the delta.
import { App } from '../core/commands';
import { SiStatusError } from './alembicSeqCam';
import {
  E_FAIL, E_INVALIDARG, MIN_PHONEME, TIME_FLOOR, SpeechData, SpeechPhoneme, makeWord, makePhoneme, snapshot, restore, phonemeSpan,
  speechObjectStrict, indexList, toInt, toDouble, toBool, toText,
} from './phonemeSpeechTasksModel';

type Worker = (d: SpeechData, snap: SpeechData) => void;
/** Resolve the speech object, snapshot, run the worker as an undoable step, notify. */
function edit(app: App, C: string, inputObj: any, prepare: () => Worker) {
  const obj = speechObjectStrict(app, C, inputObj);
  const worker = prepare(); // argument conversion (UnPackArg): its failures come before Do
  if (!obj.data) throw new SiStatusError(E_FAIL, `${C}: the speech object has no data block`);
  const snap = snapshot(obj.data);
  app.record(C,
    () => { if (obj.data) { worker(obj.data, snap); obj.notifyChanged(); } },
    () => { if (obj.data) { restore(obj.data, snap); obj.notifyChanged(); } });
}
const ignored = (delta: number) => Math.abs(delta) <= MIN_PHONEME;
const inRange = (i: number, n: number) => i >= 0 && i < n;

// ------------------------------------------------------------------ shared pieces
/** Delete word `k`: its record, every phoneme it owns; later phonemes get their word index decremented. */
function removeWord(d: SpeechData, k: number) {
  d.words.splice(k, 1);
  for (let i = d.phonemes.length - 1; i >= 0; i--) { const p = d.phonemes[i]; if (p.word === k) d.phonemes.splice(i, 1); else if (p.word > k) p.word--; }
}
/** Shift every word after `k` and every phoneme of those words. */
function shiftAfterWord(d: SpeechData, k: number, delta: number) {
  for (let i = k + 1; i < d.words.length; i++) { d.words[i].start += delta; d.words[i].end += delta; }
  for (const p of d.phonemes) if (p.word > k) { p.start += delta; p.end += delta; }
}
/** Linear rescale of the times of phonemes first..last from [o0, o1] onto [n0, n1]. */
function rescale(ph: SpeechPhoneme[], first: number, last: number, o0: number, o1: number, n0: number, n1: number) {
  const f = Math.max(n1 - n0, MIN_PHONEME) / Math.max(o1 - o0, MIN_PHONEME);
  for (let i = first; i <= last; i++) { ph[i].start = n0 + (ph[i].start - o0) * f; ph[i].end = n0 + (ph[i].end - o0) * f; }
}

// ------------------------------------------------------------------ delete class
function deleteWords(d: SpeechData, list: number[]) {
  list.forEach((idx, i) => { const k = idx - i; if (inRange(k, d.words.length)) removeWord(d, k); });
}
function deletePhonemes(d: SpeechData, list: number[]) {
  list.forEach((idx, i) => {
    const p = idx - i; if (!inRange(p, d.phonemes.length)) return;
    const k = d.phonemes[p].word; const w = d.words[k]; const span = phonemeSpan(d, k);
    if (!w || !span) { d.phonemes.splice(p, 1); return; } // inferred: a phoneme without a word record is just removed
    const [first, last] = span;
    if (first === last) { removeWord(d, k); return; }
    if (p === first) { const t = d.phonemes[p + 1].start; if (t !== w.end) w.start = t; }
    else if (p === last) { const t = d.phonemes[p - 1].end; if (t !== w.start) w.end = t; }
    else d.phonemes[p + 1].start = d.phonemes[p - 1].end;
    d.phonemes.splice(p, 1);
  });
}

// ------------------------------------------------------------------ insert class
function insertWord(d: SpeechData, name: string, t0: number, t1: number, ipa: number, ripple: boolean) {
  let start = t0, end = t1; if (start > end) [start, end] = [end, start];
  let k = 0; while (k < d.words.length && d.words[k].start < start) k++;
  // As read: the preceding word is trimmed only when its index is greater than 0 (open question 6).
  if (k - 1 > 0 && d.words[k - 1].end > start) {
    d.words[k - 1].end = start;
    const span = phonemeSpan(d, k - 1);
    if (span) for (let i = span[0]; i <= span[1]; i++) {
      const p = d.phonemes[i];
      if (p.start > start) { d.phonemes.splice(i, span[1] - i + 1); break; }
      if (p.end > start) p.end = start;
    }
  }
  if (!ripple) {
    // inferred: "within 0.02 s" is taken as a distance below the minimum phoneme length
    if (k < d.words.length && Math.abs(d.words[k].start - start) < MIN_PHONEME) removeWord(d, k);
    if (k < d.words.length && d.words[k].start < end) end = d.words[k].start;
  }
  for (const p of d.phonemes) if (p.word >= k) p.word++;
  d.words.splice(k, 0, makeWord(start, end, name));
  let at = d.phonemes.findIndex(p => p.word > k); if (at < 0) at = d.phonemes.length;
  d.phonemes.splice(at, 0, makePhoneme(start, end, ipa, k));
  if (ripple) shiftAfterWord(d, k, end - start);
}

// ------------------------------------------------------------------ move workers
function moveWords(d: SpeechData, snap: SpeechData, list: number[], delta0: number, ripple: boolean) {
  // As read (open question 1): Do clears every selected flag and flags word *position i* for each in-range Index[i];
  // the worker then restores the snapshot, which brings back the flags as they were before the command. The words
  // that move are therefore the ones already flagged in the speech data.
  for (const w of d.words) w.selected = false; for (const p of d.phonemes) p.selected = false;
  list.forEach((idx, i) => { if (inRange(idx, d.words.length) && i < d.words.length) d.words[i].selected = true; });
  restore(d, snap);
  if (ignored(delta0)) return;
  const W = d.words; let delta = delta0;
  for (let i = 0; i < W.length; i++) {
    if (!W[i].selected) continue;
    let j = i; while (j + 1 < W.length && W[j + 1].selected) j++; // the run i..j
    if (delta < 0) delta = Math.max(delta, (i > 0 ? W[i - 1].end : TIME_FLOOR) - W[i].start);
    else if (!ripple && j + 1 < W.length) delta = Math.min(delta, W[j + 1].start - W[j].end);
    i = j;
  }
  for (let k = 0; k < W.length; k++) {
    if (!W[k].selected) continue;
    W[k].start = snap.words[k].start + delta; W[k].end = snap.words[k].end + delta;
    for (const p of d.phonemes) if (p.word === k) { p.start += delta; p.end += delta; }
    if (ripple) { shiftAfterWord(d, k, delta); return; }
  }
}
function movePhoneme(d: SpeechData, snap: SpeechData, index: number, delta0: number, ripple: boolean) {
  restore(d, snap);
  const P = d.phonemes; if (ignored(delta0) || !inRange(index, P.length)) return;
  const ph = P[index]; const k = ph.word; const span = phonemeSpan(d, k)!; const [first, last] = span; let delta = delta0;
  if (delta > 0) {
    if (index === last) { if (!ripple && index + 1 < P.length) delta = Math.min(delta, P[index + 1].start - ph.end); }
    else delta = Math.min(delta, P[index + 1].end - MIN_PHONEME - ph.end);
  } else {
    if (index === first) delta = Math.max(delta, (index > 0 ? P[index - 1].end : TIME_FLOOR) - ph.start);
    else delta = Math.max(delta, P[index - 1].start + MIN_PHONEME - ph.start);
  }
  ph.start += delta; ph.end += delta;
  if (index > first) P[index - 1].end += delta;
  if (index < last) P[index + 1].start += delta;
  const w = d.words[k]; if (!w) return;
  if (index === first) w.start = ph.start;
  if (index === last) { w.end = ph.end; if (ripple) shiftAfterWord(d, k, delta); }
}

// ------------------------------------------------------------------ scale workers
function scaleWord(d: SpeechData, k: number, delta: number, ripple: boolean, edge: 'start' | 'end') {
  if (ignored(delta) || !inRange(k, d.words.length)) return;
  const w = d.words[k]; const span = phonemeSpan(d, k); const n = span ? span[1] - span[0] + 1 : 0;
  const oldEnd = w.end;
  if (edge === 'start') {
    let t = w.start + delta;
    if (delta > 0) t = Math.min(t, w.end - MIN_PHONEME * n); else t = Math.max(t, k > 0 ? d.words[k - 1].end : TIME_FLOOR);
    w.start = t;
  } else {
    let t = w.end + delta;
    if (delta < 0) t = Math.max(t, w.start + MIN_PHONEME * n); else if (!ripple && k + 1 < d.words.length) t = Math.min(t, d.words[k + 1].start);
    w.end = t;
  }
  if (span) rescale(d.phonemes, span[0], span[1], d.phonemes[span[0]].start, d.phonemes[span[1]].end, w.start, w.end);
  if (edge === 'end' && ripple) shiftAfterWord(d, k, w.end - oldEnd);
}
function scalePhoneme(d: SpeechData, snap: SpeechData, index: number, delta: number, ripple: boolean, edge: 'start' | 'end') {
  restore(d, snap);
  const P = d.phonemes; if (ignored(delta) || !inRange(index, P.length)) return;
  const ph = P[index]; const k = ph.word; const [first, last] = phonemeSpan(d, k)!; const w = d.words[k];
  if (index === (edge === 'start' ? first : last)) { scaleWord(d, k, delta, ripple, edge); return; }
  if (!w) return;
  const lastEnd = P[last].end;
  if (edge === 'start') {
    const old = ph.start;
    // inferred: when the two limits cross, the lower one is applied last
    const t = Math.max(Math.min(old + delta, w.end - MIN_PHONEME * (last - index + 1)), P[index - 1].start + MIN_PHONEME);
    if (Math.abs(P[index - 1].end - old) <= MIN_PHONEME) P[index - 1].end += t - old; // inferred: "within 0.02" includes 0.02
    rescale(P, index, last, old, lastEnd, t, lastEnd);
  } else {
    const old = ph.end;
    const t = Math.max(Math.min(old + delta, w.end - MIN_PHONEME * (last - index)), ph.start + MIN_PHONEME);
    const next = P[index + 1].start;
    rescale(P, index + 1, last, next, lastEnd, next + (t - old), lastEnd);
    ph.end = t;
  }
}

// ------------------------------------------------------------------ split and field setters
function splitPhonemes(d: SpeechData, list: number[]) {
  let done = 0;
  for (const idx of list) {
    const i = idx + done; if (!inRange(i, d.phonemes.length)) continue;
    const p = d.phonemes[i];
    if (!(p.start + p.end > 0.08)) continue; // as read: the sum, not the duration
    const mid = (p.start + p.end) / 2;
    d.phonemes.splice(i + 1, 0, { ...p, start: mid }); p.end = mid; done++;
  }
}
function setField(d: SpeechData, list: number[], set: (p: SpeechPhoneme) => void) { for (const i of list) if (inRange(i, d.phonemes.length)) set(d.phonemes[i]); }

// ------------------------------------------------------------------ registration
const CATEGORY = 'Speech';
const INDEX_ARRAY = { name: 'Index' }, INDEX_ONE = { name: 'Index', default: 0 };
const MOVE_ARGS = [{ name: 'Delta', default: 0 }, { name: 'Ripple', default: false }];
/** The 17-command class rejects an empty index list. */
function nonEmpty(C: string, v: any): number[] { const list = indexList(C, v); if (!list.length) throw new SiStatusError(E_INVALIDARG, `${C}: empty Index list`); return list; }

export function registerPhonemeSpeechEditCommands(app: App) {
  app.register({
    name: 'SpeechOpDeleteWords', label: 'Speech Operator - Delete Words', category: CATEGORY, args: [{ name: 'InputObj' }, INDEX_ARRAY],
    execute(app, a) { const C = 'SpeechOpDeleteWords'; edit(app, C, a.InputObj, () => { const list = indexList(C, a.Index); return d => deleteWords(d, list); }); },
  });
  app.register({
    name: 'SpeechOpDeletePhonemes', label: 'Speech Operator - Delete Phonemes', category: CATEGORY, args: [{ name: 'InputObj' }, INDEX_ARRAY],
    execute(app, a) { const C = 'SpeechOpDeletePhonemes'; edit(app, C, a.InputObj, () => { const list = indexList(C, a.Index); return d => deletePhonemes(d, list); }); },
  });
  app.register({
    name: 'SpeechOpInsertWord', label: 'Speech Operator - Insert Word', category: CATEGORY,
    args: [{ name: 'InputObj' }, { name: 'Name', default: '' }, { name: 'StartTime', default: 0 }, { name: 'EndTime', default: 0 }, { name: 'IPA', default: 0 }, { name: 'Ripple', default: false }],
    execute(app, a) {
      const C = 'SpeechOpInsertWord';
      edit(app, C, a.InputObj, () => {
        const name = toText(a.Name), t0 = toDouble(C, a.StartTime, 'StartTime'), t1 = toDouble(C, a.EndTime, 'EndTime'), ipa = toInt(C, a.IPA, 'IPA'), ripple = toBool(a.Ripple);
        return d => insertWord(d, name, t0, t1, ipa, ripple);
      });
    },
  });

  // ---- the 17-command class
  const moveLike = (name: string, label: string, index: { name: string; default?: any }, make: (list: number[], delta: number, ripple: boolean) => (d: SpeechData, snap: SpeechData) => void) => app.register({
    name, label, category: CATEGORY, args: [{ name: 'InputObj' }, index, ...MOVE_ARGS],
    execute(app, a) { edit(app, name, a.InputObj, () => make(nonEmpty(name, a.Index), toDouble(name, a.Delta, 'Delta'), toBool(a.Ripple))); },
  });
  moveLike('SpeechOpMoveWords', 'Speech Operator - Move Words', INDEX_ARRAY, (list, delta, ripple) => (d, snap) => moveWords(d, snap, list, delta, ripple));
  moveLike('SpeechOpMovePhoneme', 'Speech Operator - Move Phoneme', INDEX_ONE, (list, delta, ripple) => (d, snap) => movePhoneme(d, snap, list[0], delta, ripple));
  moveLike('SpeechOpScaleWordStart', 'Speech Operator - Scale Word Start', INDEX_ONE, (list, delta, ripple) => (d, snap) => { restore(d, snap); scaleWord(d, list[0], delta, ripple, 'start'); });
  moveLike('SpeechOpScaleWordEnd', 'Speech Operator - Scale Word End', INDEX_ONE, (list, delta, ripple) => (d, snap) => { restore(d, snap); scaleWord(d, list[0], delta, ripple, 'end'); });
  moveLike('SpeechOpScalePhonStart', 'Speech Operator - Scale Phoneme Start', INDEX_ONE, (list, delta, ripple) => (d, snap) => scalePhoneme(d, snap, list[0], delta, ripple, 'start'));
  moveLike('SpeechOpScalePhonEnd', 'Speech Operator - Scale Phoneme End', INDEX_ONE, (list, delta, ripple) => (d, snap) => scalePhoneme(d, snap, list[0], delta, ripple, 'end'));

  app.register({
    name: 'SpeechOpSplitPhonemes', label: 'Speech Operator - Split Phonemes', category: CATEGORY, args: [{ name: 'InputObj' }, INDEX_ARRAY],
    execute(app, a) { const C = 'SpeechOpSplitPhonemes'; edit(app, C, a.InputObj, () => { const list = nonEmpty(C, a.Index); return d => splitPhonemes(d, list); }); },
  });
  const setter = (name: string, label: string, arg: string, def: any, make: (C: string, v: any) => (p: SpeechPhoneme) => void) => app.register({
    name, label, category: CATEGORY, args: [{ name: 'InputObj' }, INDEX_ARRAY, { name: arg, default: def }],
    execute(app, a) { edit(app, name, a.InputObj, () => { const list = nonEmpty(name, a.Index); const set = make(name, a[arg]); return d => setField(d, list, set); }); },
  });
  type NumField = 'weight' | 'falloffIn' | 'falloffOut' | 'shapeWeight' | 'shapeFalloffIn' | 'shapeFalloffOut' | 'blendIn' | 'blendOut';
  /** Weights and blends: clamped below at 0, no upper limit. */
  const floor0 = (field: NumField, arg: string) => (C: string, v: any) => { const x = Math.max(0, toDouble(C, v, arg)); return (p: SpeechPhoneme) => { p[field] = x; }; };
  /** Falloffs: clamped to [-1, 1]. */
  const unit = (field: NumField) => (C: string, v: any) => { const x = Math.min(1, Math.max(-1, toDouble(C, v, 'Falloff'))); return (p: SpeechPhoneme) => { p[field] = x; }; };
  setter('SpeechOpSetPhonemesIPAValue', 'Speech Operator - Set Phonemes', 'IPA', 0, (C, v) => { const x = toInt(C, v, 'IPA'); return p => { p.ipa = x; }; });
  setter('SpeechOpSetPhonemesWeight', 'Speech Operator - Set Phonemes Weight', 'Weight', 0, floor0('weight', 'Weight'));
  setter('SpeechOpSetPhonemesFalloffIn', 'Speech Operator - Set Phonemes Falloff In', 'Falloff', 0, unit('falloffIn'));
  setter('SpeechOpSetPhonemesFalloffOut', 'Speech Operator - Set Phonemes Out Falloff', 'Falloff', 0, unit('falloffOut'));
  setter('SpeechOpSetPhonemesShapeWeight', 'Speech Operator - Set Phonemes Shape Weight', 'Weight', 0, floor0('shapeWeight', 'Weight'));
  setter('SpeechOpSetPhonemesShapeFalloffIn', 'Speech Operator - Set Phonemes Shape Falloff In', 'Falloff', 0, unit('shapeFalloffIn'));
  setter('SpeechOpSetPhonemesShapeFalloffOut', 'Speech Operator - Set Phonemes Shape Falloff Out', 'Falloff', 0, unit('shapeFalloffOut'));
  setter('SpeechOpSetPhonemesBlendIn', 'Speech Operator - Set Phonemes Blend In', 'Scale', 0, floor0('blendIn', 'Scale'));
  setter('SpeechOpSetPhonemesBlendOut', 'Speech Operator - Set Phonemes Blend Out', 'Scale', 0, floor0('blendOut', 'Scale'));
  setter('SpeechOpSetPhonemesVariation', 'Speech Operator - Set Phonemes Variation', 'Variation', '0', (_C, v) => { const s = toText(v); return p => { p.variation = s; }; });
}
