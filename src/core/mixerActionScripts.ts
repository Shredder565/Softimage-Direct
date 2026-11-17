// Clip / action-source data helpers for ledger row CMD-10a (docs/ghidra/cmd-10a-mixer-action-scripts.md).
// Original code written from the note's "Shared facts" and "Wire contract" only.
//
// The mixer of this build keeps clips as plain records on the Mixer property (`mix.clips`, `mix.compounds`,
// see core/scene.ts). The script commands of this row need more of a clip than those records carry: a time
// control (clip in / out / scale / extrapolation), clip effect items, mapping rules, a pose offset and a
// type string. They are kept as OPTIONAL extra fields on the same records, so every older command and the
// mixer evaluation keep working on clips that never met one of these commands.
import { Node, Property, Model, X3DObject, mixerOf, syncMixer, type MixerClip, type MixerCompound, type MixerWeightKey } from './scene';
import { FCurve, SI_KEY_INTERP_SPLINE } from './animation';
import type { Parameter } from './params';

// ------------------------------------------------------------------ attested constants
export const SI_CUT = 1, SI_TRIM_BEFORE = 2, SI_TRIM_AFTER = 3;          // siCutClipOptions
export const SI_WEIGHT_GAUSSIAN = 7, SI_WEIGHT_GAUSSIAN_REVERSE = 8;      // siWeightPresets (subset)
export const SI_ERR_CANCELLED = 0x4C7;
export const SI_POSE_OFFSET_CLIP = 3;
export const TRACK_ANIMATION = 0, TRACK_SHAPE = 1, TRACK_CAMERA_SHOT = 8;
export const EXTRAP_NONE = 0, EXTRAP_HOLD = 1, EXTRAP_CYCLE = 2, EXTRAP_BOUNCE = 3;
export const T_ANIM = 'mixeranimclip', T_ANIM_CPD = 'AnimActionCompoundClip', T_SHAPE = 'mixershapeclip',
  T_SHAPE_CPD = 'ShapeActionCompoundClip', T_AUDIO = 'mixeraudioclip', T_CAMSHOT = 'camerashotclip', T_LAYER = 'mixerlayerclip';
export const UNMAPPED = '<unmapped>';

// ------------------------------------------------------------------ extended records
export type EffectKey = { time: number; value: number };
/** One clip effect item: `.param` (animatable effect variable, here its key list) and `.valuemap` (expression text). */
export type EffectItem = { valuemap: string; param: EffectKey[] };
/** `target` is the scripting path `<object>.<...>.<parameter>` (relative to the clip's model, or carrying the model name); `raw` is the item path as the source stores it. */
export type MappingRule = { target: string; active: boolean; poseOffset: boolean; raw?: string };
export type ClipX = MixerClip & {
  /** Clip type string; absent = `mixeranimclip` (a compound record = `AnimActionCompoundClip`). */
  type?: string;
  /** Time control values other than start offset (`start`) and the derived end time. */
  timectrl?: Record<string, number | boolean>;
  fillaction?: boolean; fillpriority?: number;
  effectItems?: EffectItem[];
  rules?: MappingRule[];
  poseactive?: boolean;
  staticKineState?: Record<string, number>;
  /** Compound records only: member clip names. */
  clips?: string[];
};
export type CamTrack = { name: string; clips: ClipX[] };
export type MixerX = Property & {
  clips: ClipX[]; compounds: (MixerCompound & ClipX)[];
  trackSolo?: Record<string, boolean>;
  cnxTemplates?: { name: string; active: boolean }[];
  valueTemplates?: { name: string; active: boolean }[];
};
export type ClipRef = { clip: ClipX; mix: MixerX; model: Model };

export function mixerX(model: Model): MixerX {
  const m = mixerOf(model) as MixerX;
  if (!m.clips) m.clips = [];
  if (!m.compounds) m.compounds = [];
  return m;
}
export function allModels(scene: { root: Model; allObjects(): Iterable<X3DObject> }): Model[] {
  const out: Model[] = [scene.root];
  for (const o of scene.allObjects()) if (o instanceof Model && o !== scene.root) out.push(o);
  return out;
}
/** The camera sequencer of the scene root (`Camera_Sequencer.Tracks.CameraShotTracks`). Created empty on first use. */
export function cameraSequencer(root: Model): { tracks: CamTrack[] } {
  const r = root as any;
  return r.cameraSequencer ?? (r.cameraSequencer = { tracks: [] });   // inferred: storage location in this build
}

// ------------------------------------------------------------------ type tests
export function isCompoundRecord(c: ClipX): boolean { return Array.isArray(c.clips); }
export function clipType(c: ClipX): string { return c.type ?? (isCompoundRecord(c) ? T_ANIM_CPD : T_ANIM); }
export const isAnimClip = (c: ClipX) => { const t = clipType(c); return t === T_ANIM || t === T_ANIM_CPD; };
export const isAnimOrShapeClip = (c: ClipX) => { const t = clipType(c); return t === T_ANIM || t === T_ANIM_CPD || t === T_SHAPE || t === T_SHAPE_CPD; };
export const isAudioOrCamera = (c: ClipX) => { const t = clipType(c); return t === T_AUDIO || t === T_CAMSHOT; };
/** "Any type ending in `action`" counts as an action source; this build's stored actions have type `actionsource`. */
export function isActionSource(n: unknown): boolean {
  return n instanceof Property && (/action$/i.test(n.type) || n.type === 'actionsource');
}
export const isShapeAction = (p: Property) => /^shapeaction$/i.test(p.type);

// ------------------------------------------------------------------ names
export function compoundOf(ref: ClipRef): (MixerCompound & ClipX) | undefined {
  if (isCompoundRecord(ref.clip)) return undefined;   // nested compounds are not modelled in this build
  return ref.mix.compounds.find(c => c.clips?.includes(ref.clip.name));
}
function trackName(c: ClipX): string {   // inferred: track names (the mixer of this build numbers tracks only)
  const t = clipType(c); const i = Number(c.track ?? 0);
  const base = t === T_AUDIO ? 'Mixer_Audio_Track' : t === T_SHAPE || t === T_SHAPE_CPD ? 'Mixer_Shape_Track' : t === T_CAMSHOT ? 'Shot_Track' : 'Mixer_Anim_Track';
  return i ? `${base}${i}` : base;
}
/** `[<model>.]Mixer.<track>.<clip>`; a clip inside a compound gets the compound's track, name and inner track too. */
export function clipFullName(ref: ClipRef): string {
  const parts: string[] = [];
  if (ref.model.parent && (ref.model.parent as any).kind !== 'scene') parts.push(ref.model.name);
  if (clipType(ref.clip) === T_CAMSHOT) parts.push('Camera_Sequencer'); else parts.push('Mixer');
  const cpd = compoundOf(ref);
  if (cpd) parts.push(trackName(cpd), cpd.name);
  parts.push(trackName(ref.clip), ref.clip.name);
  return parts.join('.');
}
/** Contract: a clip counts as inside a compound when its full name has more than four dot-separated parts. */
export function insideCompound(ref: ClipRef): boolean { return clipFullName(ref).split('.').length > 4; }

const nodes = new WeakMap<object, ClipNode>();
/** Selectable stand-in for a clip record (the selection holds nodes; clips are records). */
export class ClipNode extends Node {
  constructor(readonly ref: ClipRef) { super(ref.clip.name, clipType(ref.clip), 'property'); }
  get clip(): ClipX { return this.ref.clip; }
  get fullName(): string { return clipFullName(this.ref); }
}
export function clipNode(ref: ClipRef): ClipNode {
  let n = nodes.get(ref.clip);
  if (!n) { n = new ClipNode(ref); nodes.set(ref.clip, n); }
  n.name = ref.clip.name; (n.ref as any).mix = ref.mix; (n.ref as any).model = ref.model;
  return n;
}
export function uniqueClipName(mix: MixerX, base: string): string {
  const taken = new Set<string>([...mix.clips.map(c => c.name), ...mix.compounds.map(c => c.name)]);
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

// ------------------------------------------------------------------ sources
export function sourcesOf(model: Model): Property[] { return model.properties.filter(p => isActionSource(p)); }
export function sourceOf(ref: ClipRef): Property | undefined {
  return ref.model.properties.find(p => p.name === ref.clip.source && (isActionSource(p) || p.type === 'audiosource'));
}
type SrcKeys = Record<string, { time: number; value: number; interp?: number; left?: number; right?: number }[]>;
export function sourceFcurves(src: Property | undefined): SrcKeys { try { return JSON.parse(src?.val('fcurves') || '{}'); } catch { return {}; } }
export function sourceValues(src: Property | undefined): Record<string, number> { try { return JSON.parse(src?.val('data') || '{}'); } catch { return {}; } }
/** `<source>.Items`: one item path per stored parameter. */
export function sourceItemsRaw(src: Property): string[] { return [...new Set([...Object.keys(sourceValues(src)), ...Object.keys(sourceFcurves(src))])]; }
/** Source `FrameStart`: explicit value, else the first key time of its curves, else 1. */
export function sourceFrameStart(src: Property | undefined): number {
  const s = src as any;
  if (s && typeof s.frameStart === 'number') return s.frameStart;
  let t = Infinity; for (const keys of Object.values(sourceFcurves(src))) if (keys?.length) t = Math.min(t, keys[0].time);
  return Number.isFinite(t) ? t : 1;   // inferred: 1 for a source without curves
}

// ------------------------------------------------------------------ mapping rules and effect items
/** Mapping rules of a clip's `.actionclip`: explicit `rules`, else one active rule per item of its source. */
export function mappingRules(ref: ClipRef): MappingRule[] {
  if (ref.clip.rules) return ref.clip.rules;
  if (isCompoundRecord(ref.clip)) {
    const out: MappingRule[] = [];
    for (const name of ref.clip.clips ?? []) { const m = ref.mix.clips.find(c => c.name === name); if (m) out.push(...mappingRules({ ...ref, clip: m })); }
    return out;
  }
  const src = sourceOf(ref);
  const scene = sceneOf(ref.model);
  return src && isActionSource(src) ? sourceItemsRaw(src).map(raw => ({ target: resolveItem(scene, raw).target, active: true, poseOffset: false, raw })) : [];
}

// ------------------------------------------------------------------ item paths
type SceneLike = { root: Model; allObjects(): Iterable<X3DObject> };
export function sceneOf(model: Model): SceneLike { let n: any = model; while (n && n.kind !== 'scene') n = n.parent; return n as SceneLike; }
/** Scripting name of an object: `<model>.<object>`, or just `<object>` under the scene root. */
export function siObjName(o: X3DObject): string {
  const m = o.parentObj?.model;
  return m && m.parentObj ? `${m.name}.${o.name}` : o.name;
}
/** Resolve an item path (stored form or scripting form) to its object, parameter and model-relative scripting path. */
export function resolveItem(scene: SceneLike, path: string, model?: Model): { obj?: X3DObject; param?: Parameter; target: string } {
  let best: X3DObject | undefined; let rest: string[] = [];
  for (const o of scene.allObjects()) { const fn = o.fullName; if (path.startsWith(fn + '.') && (!best || fn.length > best.fullName.length)) best = o; }
  if (best) rest = path.slice(best.fullName.length + 1).split('.');
  else {
    const parts = path.split('.');
    for (const n of [2, 1]) {
      const name = parts.slice(0, n).join('.');
      for (const o of scene.allObjects()) if (siObjName(o) === name) { best = o; break; }
      if (best) { rest = parts.slice(n); break; }
    }
    if (!best) {   // model-relative form: <object>.<...>, looked up in `model` first
      const named = [...scene.allObjects()].filter(o => o.name === parts[0]);
      best = named.find(o => o.parentObj?.model === model) ?? named[0];
      if (best) rest = parts.slice(1);
    }
  }
  if (!best) return { target: path };
  const pname = rest[rest.length - 1]; const lower = rest.join('.').toLowerCase();
  let param: Parameter | undefined;
  if (/^(kinematics|kine)\.global\./.test(lower)) param = best.kinematics.global.get(pname);
  else if (/^(kinematics|kine)\.local\./.test(lower)) param = best.kinematics.local.get(pname);
  else param = best.properties.find(p => p.name === rest[0] || p.type === rest[0])?.get(pname) ?? best.kinematics.local.get(pname);
  const tail = rest.join('.').replace(/^Kinematics\.Local\./, 'kine.local.').replace(/^Kinematics\.Global\./, 'kine.global.');
  return { obj: best, param, target: `${best.name}.${tail}` };   // rule targets are relative to the clip's model
}
/** Clip effect items, one per mapping rule (same index). Created empty on first use. */
export function effectItems(ref: ClipRef): EffectItem[] {
  const n = mappingRules(ref).length;
  const items = ref.clip.effectItems ?? (ref.clip.effectItems = []);
  while (items.length < n) items.push({ valuemap: '', param: [] });
  return items;
}

// ------------------------------------------------------------------ time control
const CAM_ALIAS: Record<string, string> = { sequencein: 'startoffset', sequenceout: 'endtime', scenein: 'clipin', sceneout: 'clipout' };
function defaultClipIn(ref: ClipRef): number {
  if (isCompoundRecord(ref.clip)) return ref.clip.start;   // inferred: members of a compound keep mixer time in this build
  return sourceFrameStart(sourceOf(ref));
}
/** Read a time control parameter. The end time is derived: start + (out - in + 1) / scale. */
export function tc(ref: ClipRef, name: string): number {
  const c = ref.clip; const key = CAM_ALIAS[name] ?? name; const t = c.timectrl ?? {};
  const scale = typeof t.scale === 'number' && t.scale !== 0 ? t.scale : 1;
  switch (key) {
    case 'startoffset': return c.start;
    case 'endtime': return c.start + c.duration;
    case 'scale': return scale;
    case 'clipin': return typeof t.clipin === 'number' ? t.clipin : defaultClipIn(ref);
    case 'clipout': return typeof t.clipout === 'number' ? t.clipout : tc(ref, 'clipin') + c.duration * scale - 1;
    case 'resin': return toGlobal(ref, c.start);
    case 'resout': return toGlobal(ref, c.start + c.duration);
    default: { const v = t[key]; return typeof v === 'boolean' ? Number(v) : Number(v ?? 0); }
  }
}
/** Write a time control parameter and keep the record's `duration` equal to the derived length. */
export function setTc(ref: ClipRef, name: string, value: number | boolean) {
  const c = ref.clip; const key = CAM_ALIAS[name] ?? name;
  if (key === 'startoffset') { c.start = Number(value); return; }
  const cur = { clipin: tc(ref, 'clipin'), clipout: tc(ref, 'clipout'), scale: tc(ref, 'scale') };
  const t = c.timectrl ?? (c.timectrl = {});
  t.clipin = cur.clipin; t.clipout = cur.clipout; t.scale = cur.scale;
  if (key === 'endtime') t.clipout = cur.clipin + (Number(value) - c.start) * cur.scale - 1;
  else t[key] = value;
  c.duration = (Number(t.clipout) - Number(t.clipin) + 1) / (Number(t.scale) || 1);
}
/** Compound local time -> its parent's time: (t - compound.clipin) / compound.scale + compound.startoffset. */
export function toGlobal(ref: ClipRef, t: number): number {
  const cpd = compoundOf(ref); if (!cpd) return t;
  const cr: ClipRef = { ...ref, clip: cpd };
  return (t - tc(cr, 'clipin')) / tc(cr, 'scale') + tc(cr, 'startoffset');
}
/** Parent time -> compound local time (unrounded). */
export function toLocal(ref: ClipRef, t: number): number {
  const cpd = compoundOf(ref); if (!cpd) return t;
  const cr: ClipRef = { ...ref, clip: cpd };
  return tc(cr, 'clipin') + (t - tc(cr, 'startoffset')) * tc(cr, 'scale');
}
const side = (s: 0 | 1) => (s === 0 ? 'extrapbef' : 'extrapaft');
export function extrapType(ref: ClipRef, s: 0 | 1): number { return isAudioOrCamera(ref.clip) ? 0 : tc(ref, `${side(s)}_type`); }
export function extrapCount(ref: ClipRef, s: 0 | 1): number {
  const ty = extrapType(ref, s);
  return ty === EXTRAP_HOLD ? tc(ref, `${side(s)}_timehold`) : ty === EXTRAP_CYCLE ? tc(ref, `${side(s)}_nbcycles`) : ty === EXTRAP_BOUNCE ? tc(ref, `${side(s)}_nbbounces`) : 0;
}
/** Extrapolation length in frames before (0) or after (1) the clip. */
export function extrapLength(ref: ClipRef, s: 0 | 1): number {
  if (clipType(ref.clip) === T_CAMSHOT) return 0;
  const ty = extrapType(ref, s);
  if (ty === EXTRAP_NONE) return 0;
  if (ty === EXTRAP_HOLD) return tc(ref, `${side(s)}_timehold`);
  return extrapCount(ref, s) * (tc(ref, 'endtime') - tc(ref, 'startoffset'));
}
/** Set extrapolation on one side. No-op for audio and camera shot clips; a value of 0 forces type 0. */
export function setExtrap(ref: ClipRef, s: 0 | 1, type: number, value: number) {
  if (isAudioOrCamera(ref.clip)) return;
  const ty = value === 0 ? EXTRAP_NONE : type;
  setTc(ref, `${side(s)}_type`, ty);
  if (ty === EXTRAP_HOLD) setTc(ref, `${side(s)}_timehold`, value);
  else if (ty === EXTRAP_CYCLE) setTc(ref, `${side(s)}_nbcycles`, value);
  // Type 3: the contract records that the bounce count is written to a misspelt parameter and so never set.
}

// ------------------------------------------------------------------ weight curve
function weightCurve(keys: MixerWeightKey[]): FCurve {
  const fc = new FCurve({ value: keys[0]?.value ?? 1, def: { name: 'actionclip.weight' } } as any);
  fc.keys = keys.map(x => ({ time: x.time, value: x.value, left: x.left ?? x.value, right: x.right ?? x.value, interp: x.interp ?? SI_KEY_INTERP_SPLINE }));
  return fc;
}
export function weightAt(c: ClipX, frame: number): number {
  return c.weightKeys?.length ? weightCurve(c.weightKeys).eval(frame) : Number(c.weight ?? 1);
}
export function saveWeightKey(c: ClipX, time: number, value: number, interp = SI_KEY_INTERP_SPLINE) {
  const keys = c.weightKeys ?? (c.weightKeys = []);
  const k = keys.find(x => x.time === time);
  if (k) { k.value = value; k.left = value; k.right = value; } else { keys.push({ time, value, left: value, right: value, interp }); keys.sort((a, b) => a.time - b.time); }
}
export function removeWeightAnimation(c: ClipX) { c.weightKeys = undefined; }
/** (frame, value) pairs of the weight curve at every key plus `extra` frames, without duplicates. */
export function snapshotWeight(c: ClipX, extra: number[]): EffectKey[] {
  const frames: number[] = [];
  for (const f of [...(c.weightKeys ?? []).map(k => k.time), ...extra]) if (!frames.includes(f)) frames.push(f);
  return frames.map(time => ({ time, value: weightAt(c, time) }));
}
/** Re-save the snapshot keys whose frame lies inside the closed range. */
export function restoreWeight(c: ClipX, snap: EffectKey[], from: number, to: number) {
  for (const k of snap) if (k.time >= from && k.time <= to) saveWeightKey(c, k.time, k.value);
}
/** Weight presets used by this row: Gaussian (7) 0,1,0 and reverse (8) 1,0,1 at lower, (upper+lower)/2, upper-1; spline. */
export function applyWeightPreset(c: ClipX, preset: number, lower: number, upper: number) {
  removeWeightAnimation(c);
  const [edge, mid] = preset === SI_WEIGHT_GAUSSIAN ? [0, 1] : [1, 0];
  saveWeightKey(c, lower, edge); saveWeightKey(c, upper - 1, edge); saveWeightKey(c, (upper + lower) / 2, mid);
}

// ------------------------------------------------------------------ evaluation (used by the freeze plot and by ClipMatch)
function sampleKeys(keys: SrcKeys[string], t: number): number {
  const fc = new FCurve({ value: keys[0].value, def: { name: 'item' } } as any);
  fc.keys = keys.map(k => ({ time: k.time, value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, interp: k.interp ?? SI_KEY_INTERP_SPLINE }));
  return fc.eval(t);
}
/**
 * Blend the given clips at mixer time `frame`: values by item path. Inactive (`mute`) clips are skipped, cycle
 * extrapolation repeats the clip body, and a member of a compound is evaluated in the compound's local time.
 * Transitions are not part of this evaluation (inferred simplification; the note does not describe them here).
 */
export function evalClips(mix: MixerX, model: Model, clips: ClipX[], frame: number): Record<string, number> {
  const out: Record<string, number> = {};
  const flat: ClipX[] = [];
  for (const c of clips) {
    if (isCompoundRecord(c)) { if (!c.mute) for (const n of c.clips ?? []) { const m = mix.clips.find(x => x.name === n); if (m) flat.push(m); } }
    else flat.push(c);
  }
  flat.sort((a, b) => Number(a.track ?? 0) - Number(b.track ?? 0));
  for (const c of flat) {
    if (c.mute || !isAnimClip(c)) continue;
    const ref: ClipRef = { clip: c, mix, model };
    const cpd = compoundOf(ref);
    if (cpd?.mute) continue;
    const t = toLocal(ref, frame);
    const start = c.start, len = c.duration; if (!(len > 0)) continue;
    const lo = start - (extrapType(ref, 0) === EXTRAP_CYCLE ? extrapCount(ref, 0) * len : 0);
    const hi = start + len + (extrapType(ref, 1) === EXTRAP_CYCLE ? extrapCount(ref, 1) * len : 0);
    if (t < lo - 1e-9 || t >= hi - 1e-9) continue;
    let rel = (t - start) % len; if (rel < 0) rel += len;
    const srcTime = tc(ref, 'clipin') + rel * tc(ref, 'scale');
    const w = Math.max(0, Math.min(1, weightAt(c, frame)));
    const src = sourceOf(ref); if (!src) continue;
    const vals: Record<string, number> = { ...sourceValues(src) };
    for (const [p, keys] of Object.entries(sourceFcurves(src))) if (keys?.length) vals[p] = sampleKeys(keys, srcTime);
    for (const [p, v] of Object.entries(vals)) {
      if (!Number.isFinite(v)) continue;
      out[p] = out[p] === undefined ? v : out[p] * (1 - w) + v * w;
    }
  }
  return out;
}

// ------------------------------------------------------------------ undo support
type Snap = { clips: ClipX[]; compounds: ClipX[]; cam: CamTrack[] | null; camClips: ClipX[][]; fields: [ClipX, string][]; solo: string; cnx: string; val: string };
function snapMixer(mix: MixerX, root: Model): Snap {
  const cam: CamTrack[] | null = (root as any).cameraSequencer?.tracks ?? null;
  const all = [...mix.clips, ...mix.compounds, ...(cam ?? []).flatMap(t => t.clips)];
  return {
    clips: [...mix.clips], compounds: [...mix.compounds], cam: cam ? [...cam] : null, camClips: (cam ?? []).map(t => [...t.clips]),
    fields: all.map(c => [c, JSON.stringify(c)] as [ClipX, string]),
    solo: JSON.stringify(mix.trackSolo ?? {}), cnx: JSON.stringify(mix.cnxTemplates ?? []), val: JSON.stringify(mix.valueTemplates ?? []),
  };
}
function restoreMixer(mix: MixerX, root: Model, s: Snap) {
  mix.clips.splice(0, mix.clips.length, ...s.clips);
  mix.compounds.splice(0, mix.compounds.length, ...(s.compounds as any[]));
  if (s.cam) { const seq = cameraSequencer(root); seq.tracks.splice(0, seq.tracks.length, ...s.cam); s.cam.forEach((t, i) => t.clips.splice(0, t.clips.length, ...s.camClips[i])); }
  for (const [c, json] of s.fields) { for (const k of Object.keys(c)) delete (c as any)[k]; Object.assign(c, JSON.parse(json)); }
  mix.trackSolo = JSON.parse(s.solo);
  if (mix.cnxTemplates) { const v = JSON.parse(s.cnx); mix.cnxTemplates.splice(0, mix.cnxTemplates.length, ...v); }
  if (mix.valueTemplates) { const v = JSON.parse(s.val); mix.valueTemplates.splice(0, mix.valueTemplates.length, ...v); }
  syncMixer(mix);
}
/** Run `fn` as one undoable edit of a mixer (records keep their identity across undo / redo). */
export function editMixer<T>(app: { record(label: string, redo: () => void, undo: () => void): void }, mix: MixerX, root: Model, label: string, fn: () => T): T {
  const before = snapMixer(mix, root);
  let after: Snap | null = null; let result!: T; let error: unknown = null;
  app.record(label, () => {
    if (after) { restoreMixer(mix, root, after); return; }
    try { result = fn(); } catch (e) { error = e; }
    syncMixer(mix); after = snapMixer(mix, root);
  }, () => restoreMixer(mix, root, before));
  if (error) throw error;
  return result;
}
