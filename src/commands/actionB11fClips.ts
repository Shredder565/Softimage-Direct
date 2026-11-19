// Ledger row CMD-B11f, clip effect part: CreateOffsetEffect, RemoveEffect, ResetOffset, CutClipInSpace.
// Brief: docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md, section 3. Original code written from that prose
// contract only. Clip items are the clip's mapping rules and its effect items (`.valuemap` expression and `.param` keys)
// of core/mixerActionScripts.ts; every clip edit is one undoable mixer edit (editMixer).
import { App } from '../core/commands';
import { FCurve } from '../core/animation';
import { Parameter } from '../core/params';
import { Property } from '../core/scene';
import {
  ClipNode, clipNode, editMixer, effectItems, mappingRules, resolveItem, sourceOf, uniqueClipName,
  type ClipRef, type ClipX, type EffectItem, type MappingRule,
} from '../core/mixerActionScripts';
import {
  E_POINTER, E_FAIL, E_INVALIDARG, E_ACCESSDENIED, S_OK, S_FALSE,
  allClipRefs, clipRef, setStatus, subtask, fail, logNya, unset, listOf, lockLevel, findObject, modelOf, ownerObject, paramsOf, uniqueSourceName,
} from './actionB11fModel';

/** A Clip argument; unset = the first selected clip (registry flag 0x80: the argument defaults to the selection). */
function clipArg(app: App, v: any): ClipRef | null {
  if (unset(v)) { const n = app.selection.find(x => x instanceof ClipNode) as ClipNode | undefined; return n ? clipRef(app, n.clip) : null; }
  return clipRef(app, v);
}
/** Value of an effect parameter at a time: its key curve, or 0 without keys. */
function paramAt(item: EffectItem, t: number): number {
  if (!item.param.length) return 0;
  const fc = new FCurve({ value: 0, def: { name: 'param' } } as any);
  fc.keys = item.param.map(k => ({ time: k.time, value: k.value, left: k.value, right: k.value, interp: 1 }));
  return fc.eval(t);
}
function keyParam(item: EffectItem, time: number, value: number) {
  const k = item.param.find(x => x.time === time);
  if (k) k.value = value; else { item.param.push({ time, value }); item.param.sort((x, y) => x.time - y.time); }
}

// ------------------------------------------------------------------ CreateOffsetEffect
function createOffsetEffect(app: App, a: Record<string, any>) {
  const C = 'CreateOffsetEffect';
  const ref = clipArg(app, a.Clip);
  if (!ref) throw fail(E_POINTER, `${C}: Clip is required`);
  if (lockLevel(ref.clip) & 2) { app.logMsg('error', `${C}: ${ref.clip.name} is locked`); throw fail(E_ACCESSDENIED, `${C}: ${ref.clip.name} is locked`); }
  const start = ref.clip.start, end = ref.clip.start + ref.clip.duration;
  const n = editMixer(app, ref.mix, app.scene.root, 'Create offset effect', () => {
    const items = effectItems(ref);
    // two SaveKey sub-tasks: every effect parameter keyed at the clip start and at start + duration
    const atStart = items.map(it => paramAt(it, start)), atEnd = items.map(it => paramAt(it, end));
    items.forEach((it, i) => keyParam(it, start, atStart[i])); subtask(app, C, 'SaveKey', `${ref.clip.name} @ ${start}`);
    items.forEach((it, i) => keyParam(it, end, atEnd[i])); subtask(app, C, 'SaveKey', `${ref.clip.name} @ ${end}`);
    for (const it of items) it.valuemap = it.valuemap ? `(${it.valuemap}) + param` : '(this) + param';
    ref.clip.offsetEffect = true;   // this build's flag for "the clip has an offset effect"
    return items.length;
  });
  setStatus(app, C, S_OK);
  return n;
}

// ------------------------------------------------------------------ RemoveEffect
function removeEffect(app: App, a: Record<string, any>) {
  const C = 'RemoveEffect';
  const ref = clipArg(app, a.Clip);
  if (!ref) throw fail(E_POINTER, `${C}: Clip is required`);
  const n = editMixer(app, ref.mix, app.scene.root, 'Remove effect', () => {
    const items = effectItems(ref);
    for (const it of items) it.param = [];   // RemoveAnimation sub-task (mode 4) on every effect parameter
    subtask(app, C, 'RemoveAnimation', `${ref.clip.name} (mode 4)`);
    for (const it of items) it.valuemap = '';   // the old strings are kept by the mixer snapshot for undo
    ref.clip.offsetEffect = false; ref.clip.scaleEffect = false;   // no expression is left
    return items.length;
  });
  setStatus(app, C, S_OK);
  return n;
}

// ------------------------------------------------------------------ ResetOffset
function ruleParam(app: App, ref: ClipRef, rule: MappingRule): Parameter | undefined {
  return resolveItem(app.scene as any, rule.raw ?? rule.target, ref.model).param ?? resolveItem(app.scene as any, rule.target, ref.model).param;
}
function resetOffset(app: App, a: Record<string, any>) {
  const C = 'ResetOffset';
  const params = unset(a.InputObjs) ? [...app.anim.marked] : paramsOf(app, a.InputObjs);   // unset = the marked parameters
  const t = unset(a.Time) ? app.anim.frame : Number(a.Time);
  let notDriven = 0; let keyed = 0; let logged = false;
  for (const p of params) {
    const model = ownerObject(p)?.model;
    const driving: { ref: ClipRef; index: number }[] = [];
    for (const ref of allClipRefs(app)) {
      if (model && ref.model !== model && ref.model !== app.scene.root) continue;
      mappingRules(ref).forEach((r, i) => { if (ruleParam(app, ref, r) === p) driving.push({ ref, index: i }); });
    }
    if (!driving.length) { notDriven++; continue; }   // F3DCheckForMixerConnection: not driven
    const contributing = driving.filter(d => !d.ref.clip.mute && mappingRules(d.ref)[d.index]?.active !== false && t >= d.ref.clip.start && t < d.ref.clip.start + d.ref.clip.duration);
    if (contributing.length > 1) throw fail(E_INVALIDARG, `${C}: more than one action contributes to ${p.fullName} (XSIACTION2 0x3fb)`);
    if (!contributing.length) throw fail(E_INVALIDARG, `${C}: no action contributes to ${p.fullName} (XSIACTION2 0x3fc)`);
    const { ref, index } = contributing[0];
    if (!logged) { logNya(app, C, 'the value keyed by the SaveKey sub-task (open question 4); 0 (no offset) is keyed'); logged = true; }
    editMixer(app, ref.mix, app.scene.root, 'Reset offset', () => { keyParam(effectItems(ref)[index], t, 0); });
    subtask(app, C, 'SaveKey', `${ref.clip.name} item ${index} @ ${t}`);
    keyed++;
  }
  if (notDriven) throw fail(E_INVALIDARG, `${C}: ${notDriven} parameter(s) are not driven by the mixer (XSIACTION2 0x3f6)`);
  setStatus(app, C, keyed ? S_OK : S_FALSE);
  return keyed;
}

// ------------------------------------------------------------------ CutClipInSpace
function cutClipInSpace(app: App, a: Record<string, any>) {
  const C = 'CutClipInSpace';
  if (unset(a.Model) || unset(a.InputObjs) || unset(a.Clip)) throw fail(E_POINTER, `${C}: Model, InputObjs and Clip are required`);
  const model = modelOf(app, a.Model); const ref = clipRef(app, a.Clip);
  if (!model || !ref) throw fail(E_POINTER, `${C}: Model, InputObjs and Clip are required`);
  const names = new Set<string>();
  for (const x of listOf(a.InputObjs)) { const o = findObject(app, x); names.add(o ? o.name : String((x as any)?.name ?? x)); }
  const src = sourceOf(ref);
  if (!src) throw fail(E_FAIL, `${C}: ${ref.clip.name} has no action source`);
  logNya(app, C, 'the identity of the copy-source and add-clip sub-tasks (classes at 0x180136cc8 / 0x180136d18, open question 5); the source is duplicated and a clip of the copy is added on a new track');
  // copy-source sub-task
  const copy = new Property(uniqueSourceName(ref.model, src.name), src.type, src.params.map(x => ({ ...x.def, value: x.value })));
  for (const k of ['sourceClass', 'itemInfo', 'frameStart', 'frameEnd', 'published']) if ((src as any)[k] !== undefined) (copy as any)[k] = JSON.parse(JSON.stringify((src as any)[k]));
  app.record('Copy source', () => { if (!ref.model.properties.includes(copy)) ref.model.addProperty(copy); }, () => ref.model.removeProperty(copy));
  subtask(app, C, 'CopySource', `${src.name} -> ${copy.name}`);
  const made = editMixer(app, ref.mix, app.scene.root, 'Cut clip in space', () => {
    const orig = mappingRules(ref).map(r => ({ ...r }));
    // add-clip sub-task: a clip of the copy at the original clip's start (frames -> seconds -> frames), same model
    const track = Math.max(0, ...ref.mix.clips.map(c => Number(c.track ?? 0))) + 1;   // inferred: a free track
    const clip: ClipX = { name: uniqueClipName(ref.mix, ref.clip.name), source: copy.name, start: ref.clip.start, duration: ref.clip.duration, track, weight: ref.clip.weight };
    ref.mix.clips.push(clip);
    subtask(app, C, 'AddClip', `${clip.name} @ ${clip.start}`);
    const fresh = orig.map(r => ({ ...r }));
    orig.forEach((r, i) => {
      const obj = r.target.split('.')[0];
      if (names.has(obj)) { fresh[i].active = r.active; orig[i].active = false; }
      else fresh[i].active = false;
    });
    ref.clip.rules = orig; clip.rules = fresh;
    return clip;
  });
  setStatus(app, C, S_OK);
  return clipNode({ clip: made, mix: ref.mix, model: ref.model });
}

export const CLIP_HANDLERS: Record<string, (app: App, a: Record<string, any>) => any> = {
  CreateOffsetEffect: createOffsetEffect,
  RemoveEffect: removeEffect,
  ResetOffset: resetOffset,
  CutClipInSpace: cutClipInSpace,
};
