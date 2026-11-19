// Ledger row CMD-B11f: shared model and helpers of the action.dll commands wired in actionB11f*.ts.
// Brief: docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md, sections 2 and 3 (Wire contracts).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract maps onto this build:
//  * Action sources are `actionsource` properties on their model (as StoreAction makes them); the mixer is the
//    model's `mixer` property, clips are its records (core/mixerActionScripts.ts: ClipX, mapping rules = items,
//    effect items = `.valuemap` expression + `.param` key list). Viseme / speech sources are action sources with a
//    class tag (`sourceclass`), FrameStart / FrameEnd, and per-item metadata (group, flag, kind) kept on the record.
//  * Locks are a stand-in: a numeric `lockLevel` field on a mixer / clip / operator record; referenced models are
//    models with a `ref` field (the convention of addonScriptsSdkui.ts).
//  * Sub-tasks (SICreateCluster, AddFCurve, DeleteObj, RemoveAnimation, SaveKey, copy source, add clip, store shape,
//    add property) are performed in place and recorded in `app.actionB11f.subtasks` by registry name.
//  * Failure statuses are thrown as SiStatusError; S_OK / S_FALSE and info codes go to `app.actionB11f.lastStatus`.
import { App } from '../core/commands';
import { Parameter } from '../core/params';
import { Cluster, Model, Node, Property, X3DObject, mixerOf } from '../core/scene';
import { str, num } from '../core/params';
import { SiStatusError } from './alembicSeqCam';
import { findParam } from './index';
import {
  allModels, clipFullName, clipNode, ClipNode, mixerX, siObjName, type ClipRef, type ClipX, type MixerX,
} from '../core/mixerActionScripts';

export const NOTE = 'docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md';
export const ROW = 'CMD-B11f';
export const S_OK = 0, S_FALSE = 1;
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005;
/** Effect-wide success-with-info code of the clip effect workers and Open SE (note section 2). */
export const INFO_EFFECT = 0x562e80c7;
export const CLASS_VISEME = 'a11c232b-4be5-4679-b666-5a1cbaee108b';
export const CLASS_SPEECH = '12a3efc5-e543-11d2-b352-00105a1e6ce9';
/** Internal item kind of the speech-driven channels (FreezeLipSync freezes these). inferred meaning (open question 2). */
export const KIND_SPEECH_CHANNEL = 0x1a;
/** The six local transform channels keyed per Face Robot control, in contract order. */
export const CONTROL_CHANNELS = ['rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'];

export interface ItemInfo { group?: string; flag?: number; kind?: number }
export interface B11fState {
  lastStatus: { command: string; status: number } | null;
  /** Sub-tasks run by the commands, by registry name (`DeleteObj`, `SaveKey`, ...), newest last. */
  subtasks: { command: string; task: string; detail?: string }[];
  /** Transient views opened by `Open SE for Link With Deform`. */
  transientViews: { cluster: string; filter: 'all' | number; attributes: [number, number]; mode: number; flags: number }[];
  /** Seam: the Evolver mapping file parser (parser 0x1800f7b80 is unread). Nothing in this build installs one. */
  evolverParser: ((text: string, fileName: string) => EvolverMapping | null) | null;
  /** DSIsAppRunningWithoutUI analogue (batch runs). */
  noUI: boolean;
}
/** What the Evolver parser seam answers: visemes with their phoneme index and parameter values. */
export interface EvolverMapping { prefix?: string; visemes: { name: string; phoneme: number; values: Record<string, number> }[] }

export function stateOf(app: App): B11fState {
  const a = app as any;
  return a.actionB11f ?? (a.actionB11f = { lastStatus: null, subtasks: [], transientViews: [], evolverParser: null, noUI: false } as B11fState);
}
export function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; return status; }
export function subtask(app: App, command: string, task: string, detail?: string) { stateOf(app).subtasks.push({ command, task, detail }); }
export function fail(status: number, what: string): SiStatusError { return new SiStatusError(status, what); }
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
export const truthy = (v: any) => v === true || v === 1 || v === -1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
export const listOf = (v: any): any[] => (unset(v) ? [] : Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v]);
export const lockLevel = (x: any): number => Number(x?.lockLevel ?? 0) | 0;
export const isRefModel = (m: Model | null | undefined) => !!m && m instanceof Model && !!(m as any).ref;

// ------------------------------------------------------------------ resolution
export function findObject(app: App, v: any): X3DObject | undefined {
  if (v instanceof X3DObject) return v;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const s = v.trim();
  if (s === app.scene.root.name) return app.scene.root;
  for (const o of app.scene.allObjects()) if (siObjName(o) === s) return o;
  return app.scene.find(s);
}
/** The model of an argument: a model itself, else the model of an object / parameter / property / cluster. */
export function modelOf(app: App, v: any): Model | null {
  if (Array.isArray(v)) v = v[0];
  if (unset(v)) return null;
  if (v instanceof Model) return v;
  if (v instanceof Parameter) return ownerObject(v)?.model ?? null;
  if (v instanceof X3DObject) return v.model;
  if (v instanceof Node) return ownerObject(v)?.model ?? null;
  if (typeof v === 'string') {
    const o = findObject(app, v); if (o) return o instanceof Model ? o : o.model;
    const p = paramByPath(app, v); return p ? ownerObject(p)?.model ?? null : null;
  }
  return null;
}
export function ownerObject(x: any): X3DObject | null {
  let n: any = x instanceof Parameter ? x.owner : x;
  while (n && !(n instanceof X3DObject)) n = n.parent ?? null;
  return n instanceof X3DObject ? n : null;
}
export function paramByPath(app: App, s: string): Parameter | undefined {
  const p = findParam(app, s); if (p) return p;
  const parts = s.split('.'); if (parts.length > 2) { const q = findParam(app, parts.slice(1).join('.')); if (q) return q; }
  return undefined;
}
/** A parameter list argument (AnimatableParameters handler): parameters, paths, or objects (their animatable, writable local transform). */
export function paramsOf(app: App, v: any): Parameter[] {
  const out: Parameter[] = [];
  for (const x of listOf(v)) {
    if (x instanceof Parameter) { out.push(x); continue; }
    const o = x instanceof X3DObject ? x : typeof x === 'string' ? (x.includes('.') ? undefined : findObject(app, x)) : undefined;
    if (o) { out.push(...o.kinematics.local.params.filter(p => p.animatable && !p.def.readOnly)); continue; }
    if (typeof x === 'string') { const p = paramByPath(app, x); if (p) out.push(p); }
  }
  return [...new Set(out)];
}
/** Model-relative ("stripped") parameter name: `<object>.<path inside the object>`. */
export function strippedName(p: Parameter): string {
  const o = ownerObject(p); if (!o) return p.fullName;
  const full = p.fullName; const of = o.fullName;
  const tail = full.startsWith(of + '.') ? full.slice(of.length + 1) : p.name;
  // scripting form of the kinematics path (`Kinematics.Local.posx` -> `kine.local.posx`)
  return `${o.name}.${tail.replace(/^Kinematics\.Local\./, 'kine.local.').replace(/^Kinematics\.Global\./, 'kine.global.')}`;
}
/** The item path as stored in a source of `model`: the stripped name, prefixed with the model name below the scene root. */
export function itemPath(app: App, model: Model, stripped: string): string {
  return model === app.scene.root ? stripped : `${model.name}.${stripped}`;
}

// ------------------------------------------------------------------ mixer and sources
/** Mixer resolution of section 2: referenced-model delta, fetch / create (undoable), lock check. */
export function resolveMixer(app: App, C: string, model: Model): MixerX {
  if (isRefModel(model)) logNya(app, C, 'F3DEnableMixerOnDelta (enabling the mixer on the delta of a referenced model); the mixer of the model is used as is');
  let mix = model.property('mixer') as MixerX | undefined;
  if (!mix) {
    mix = mixerX(model);   // created now; its removal is the undo of the creation sub-task
    const made = mix;
    app.record('Create mixer', () => { if (!model.properties.includes(made)) model.addProperty(made); }, () => model.removeProperty(made));
  }
  if ((lockLevel(mix) & 0xffff) && !isRefModel(model)) throw fail(E_ACCESSDENIED, `${C}: the mixer of ${model.name} is locked`);
  return mix;
}
export interface SourceX extends Property { sourceClass: 'viseme' | 'speech'; frameStart?: number; frameEnd?: number; itemInfo: Record<string, ItemInfo>; published?: boolean }
export function newSource(cls: 'viseme' | 'speech', name: string): SourceX {
  const src = new Property(name, 'actionsource', [
    str('data', '{}', 'Values', { readOnly: true }), str('fcurves', '{}', 'FCurves', { readOnly: true }), str('expressions', '{}', 'Expressions', { readOnly: true }),
    num('items', 0, 'Items', { readOnly: true, animatable: false }),
    str('sourceclass', cls === 'viseme' ? CLASS_VISEME : CLASS_SPEECH, 'Source Class', { readOnly: true }),
    num('FrameStart', 1, 'Frame Start', { animatable: false }), num('FrameEnd', 1, 'Frame End', { animatable: false }),
  ]) as SourceX;
  src.sourceClass = cls; src.itemInfo = {};
  return src;
}
export const isSpeechSource = (p: any): p is SourceX => p instanceof Property && p.type === 'actionsource' && (p as any).sourceClass === 'speech';
export function sourceData(src: Property): Record<string, number> { try { return JSON.parse(src.val('data') || '{}'); } catch { return {}; } }
/** Add (or overwrite) a static item. */
export function addItem(src: SourceX, path: string, value: number, info?: ItemInfo) {
  const d = sourceData(src); d[path] = value; src.set('data', JSON.stringify(d)); src.set('items', Object.keys(d).length);
  if (info) src.itemInfo[path] = { ...info };
}
export function itemCount(src: Property) { return Object.keys(sourceData(src)).length; }
/** Name, FrameStart 1 / FrameEnd 5 (viseme sources), then add to the model's source list (undoable). */
export function addSource(app: App, model: Model, src: SourceX, name: string | null) {
  if (name !== null) src.name = uniqueSourceName(model, name);
  if (src.sourceClass === 'viseme') { src.frameStart = 1; src.frameEnd = 5; src.set('FrameStart', 1); src.set('FrameEnd', 5); }
  app.record('Add source', () => { if (!model.properties.includes(src)) model.addProperty(src); }, () => model.removeProperty(src));
  return src;
}
/** inferred: names inside one container are unique; a taken name gets the first free numeric suffix. */
export function uniqueSourceName(model: Model, base: string): string {
  const taken = new Set(model.properties.map(p => p.name));
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

// ------------------------------------------------------------------ Face Robot control finder
/** The tag string of an object. Stand-in: the property read through constant 0x180134e18 is not identified
 *  (open question 6); this build reads an `frTag` field, or the `tag` parameter of an `frtag` property. */
export function tagOf(o: X3DObject): string {
  const f = (o as any).frTag; if (typeof f === 'string') return f;
  const p = o.properties.find(x => x.type === 'frtag'); return p ? String(p.val('tag') ?? '') : '';
}
/** Children of the model, recursively, not into nested models; tag contains `Control` and one of Mouth / Tongue / Jaw. */
export function findMouthControls(model: Model): X3DObject[] {
  const out: X3DObject[] = [];
  const walk = (o: X3DObject) => {
    for (const c of o.children) {
      const t = tagOf(c);
      if (t.includes('Control') && (t.includes('Mouth') || t.includes('Tongue') || t.includes('Jaw'))) out.push(c);
      if (!(c instanceof Model)) walk(c);
    }
  };
  walk(model);
  return out;
}
export function controlChannelParams(o: X3DObject): Parameter[] {
  return CONTROL_CHANNELS.map(n => o.kinematics.local.get(n)).filter((p): p is Parameter => !!p);
}

// ------------------------------------------------------------------ clips
export function* allClipRefs(app: App): Generator<ClipRef> {
  for (const model of allModels(app.scene)) {
    if (!model.property('mixer')) continue;
    const mix = mixerX(model);
    for (const clip of mix.clips) yield { clip, mix, model };
  }
}
/** A clip argument: a ClipNode, a clip record, or a clip name (full or short); the first element of a list. */
export function clipRef(app: App, v: any): ClipRef | null {
  if (Array.isArray(v)) v = v[0];
  if (unset(v)) return null;
  if (v instanceof ClipNode) v = v.clip;
  let short: ClipRef | null = null;
  for (const r of allClipRefs(app)) {
    if (r.clip === v) return r;
    if (typeof v === 'string') { if (clipFullName(r) === v.trim()) return r; if (!short && r.clip.name === v.trim()) short = r; }
  }
  return short;
}
export { clipNode, mixerX, mixerOf, type ClipRef, type ClipX, type MixerX, Cluster };
