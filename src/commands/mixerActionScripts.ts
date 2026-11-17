// Ledger row CMD-10a. Brief: docs/ghidra/cmd-10a-mixer-action-scripts.md, "Wire contract". Original code written from that contract only.
//
// The 20 animation mixer clip / action script commands. Data helpers (time control, effect items, mapping rules,
// weight keys, evaluation, undo) are in src/core/mixerActionScripts.ts.
//
// How this build differs from a Softimage session, and why:
//
//  * Clips are records on the Mixer property, not scene nodes. A selectable stand-in (ClipNode) carries a clip in
//    the selection; every clip argument accepts a ClipNode, a clip record, a clip name or a clip full name.
//  * Overloads. FreezeClips, FreezeAndReplaceClips and ResetEffectAtFrame have a scripted and a key-assignable UI
//    registry entry under the same scripting name. The command bus holds one definition per name, so the scripted
//    overload is registered and the UI overloads are reachable as `app.mixerActionScripts.ui.<name>(args)` (inferred).
//  * Interactive vs batch. `app.Interactive` (default true) stands for Application.Interactive. Wizard dialogs are
//    modal pages; the command bus is synchronous, so an interactive UI overload returns a Promise. In batch mode
//    the dialog is skipped and counts as OK (inferred).
//  * Callee commands outside this row (PlotToAction, AddTrack, CopyClipToTrack, MoveClipToTrack, AddAudioClip,
//    ImportAudio, OffsetValueMap, PickElement) are not modelled closely enough on the bus to carry these scripts, so
//    their effect is produced here directly. The arguments the contract passes to PlotToAction are kept in
//    `app.mixerActionScripts.lastPlot`.
//  * Not attested, raised or logged as "not yet attested": fcurve fitting of the freeze plot, the wizard preset
//    layouts (Q2), a model-prefixed rule target with a long object name (Q3).
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { Property, Model, X3DObject, Node, syncMixer, threeOrder } from '../core/scene';
import { str, bool, num, int, enumP } from '../core/params';
import { SI_KEY_INTERP_CONSTANT, SI_KEY_INTERP_LINEAR } from '../core/animation';
import { mapSetCurveTypeToInterp } from '../core/mixer';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';
import { mixerWizardDialog } from '../ui/mixerActionScriptsDialog';
import {
  SI_CUT, SI_TRIM_BEFORE, SI_TRIM_AFTER, SI_WEIGHT_GAUSSIAN, SI_WEIGHT_GAUSSIAN_REVERSE, SI_ERR_CANCELLED, SI_POSE_OFFSET_CLIP,
  EXTRAP_HOLD, EXTRAP_CYCLE, EXTRAP_BOUNCE, T_ANIM, T_ANIM_CPD, T_AUDIO, T_CAMSHOT, T_LAYER, UNMAPPED,
  type ClipX, type ClipRef, type MixerX, type EffectItem, type EffectKey,
  ClipNode, clipNode, clipType, clipFullName, insideCompound, compoundOf, isCompoundRecord, isAnimClip, isAnimOrShapeClip, isAudioOrCamera,
  isActionSource, isShapeAction, mixerX, allModels, cameraSequencer, sourcesOf, sourceItemsRaw, mappingRules, effectItems, resolveItem, siObjName,
  tc, setTc, toGlobal, toLocal, extrapType, extrapCount, extrapLength, setExtrap,
  saveWeightKey, removeWeightAnimation, snapshotWeight, restoreWeight, applyWeightPreset, evalClips, editMixer,
} from '../core/mixerActionScripts';

const NOTE = 'docs/ghidra/cmd-10a-mixer-action-scripts.md';
const CAT = 'Animation Mixer';

// ------------------------------------------------------------------ errors, messages, session state
/** The "command cancelled" script error (siErrCancelled): aborts the command without an error box. */
export class CommandCancelled extends Error {
  readonly cancelled = true; readonly siErrCancelled = SI_ERR_CANCELLED;
  constructor(message: string) { super(message); this.name = 'CommandCancelled'; }
}
const XSISCRIPTS_TEXT: Record<number, string> = {
  1527: 'No clips selected',
  1033: 'Action: %s Cannot be offloaded.\nOnly Action source with external storage can be offloaded',
  1041: 'Match Clips',
  1042: 'Not found: please tag with Character > Biped Tags',
};
const text = (id: number) => siString('XSISCRIPTS', id) ?? XSISCRIPTS_TEXT[id] ?? '';
const info = (app: App, msg: string) => app.logMsg('info', msg);
function cancel(app: App, msg: string): never { info(app, msg); throw new CommandCancelled(msg); }
const notYetAttested = (app: App, command: string, what: string, q: string) => info(app, `${command}: not yet attested: ${what} (${NOTE} ${q})`);
const interactive = (app: App) => (app as any).Interactive !== false;
const unset = (v: unknown) => v === undefined || v === null || v === '';
const truthy = (v: unknown) => v === true || v === 1 || v === -1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
const frameArg = (app: App, v: unknown) => (unset(v) ? app.anim.frame : Number(v));

export interface MixerActionScriptsState {
  /** Arguments of the last PlotToAction call made by FreezeClips (contract step 6). */
  lastPlot: Record<string, unknown> | null;
  /** 'branch' | 'node': mode of the last selection made by SelectObjectsFromAction. */
  lastSelectMode: string | null;
  /** Optional pick session stand-in for ClipMatch: (prompt) => clip node, or null for right-click / escape. */
  pickClip: ((prompt: string) => unknown) | null;
  /** Selectable node for a clip record / clip name / action name (what a collection argument resolves to). */
  node: (x: unknown) => unknown;
  ui: Record<string, (args?: Record<string, any>) => any>;
  uiArgs: Record<string, { name: string; default?: any }[]>;
}
function state(app: App): MixerActionScriptsState {
  const a = app as any;
  return a.mixerActionScripts ?? (a.mixerActionScripts = { lastPlot: null, lastSelectMode: null, pickClip: null, node: (x: unknown) => resolveElement(app, x), ui: {}, uiArgs: {} });
}

// ------------------------------------------------------------------ element resolution
function* allRefs(app: App): Generator<ClipRef> {
  for (const model of allModels(app.scene)) {
    if (!model.property('mixer')) continue;
    const mix = mixerX(model);
    for (const clip of mix.clips) yield { clip, mix, model };
    for (const clip of mix.compounds) yield { clip, mix, model };
  }
  const seq = (app.scene.root as any).cameraSequencer as { tracks: { clips: ClipX[] }[] } | undefined;
  if (seq) { const mix = mixerX(app.scene.root); for (const t of seq.tracks) for (const clip of t.clips) yield { clip, mix, model: app.scene.root }; }
}
function refOfRecord(app: App, rec: unknown): ClipRef | null { for (const r of allRefs(app)) if (r.clip === rec) return r; return null; }
function refByName(app: App, name: string): ClipRef | null {
  let byShort: ClipRef | null = null;
  for (const r of allRefs(app)) { if (clipFullName(r) === name) return r; if (!byShort && r.clip.name === name) byShort = r; }
  return byShort;
}
function containerOf(app: App, ref: ClipRef): ClipX[] {
  if (ref.mix.clips.includes(ref.clip)) return ref.mix.clips;
  if ((ref.mix.compounds as ClipX[]).includes(ref.clip)) return ref.mix.compounds as ClipX[];
  for (const t of cameraSequencer(app.scene.root).tracks) if (t.clips.includes(ref.clip)) return t.clips;
  return ref.mix.clips;
}
function findObject(app: App, name: string): X3DObject | undefined {
  for (const o of app.scene.allObjects()) if (siObjName(o) === name) return o;
  return app.scene.find(name) ?? app.scene.find(name.split('.').pop()!);
}
/** One collection element: a clip node, an action source, a scene object, or null when nothing matches. */
function resolveElement(app: App, x: unknown): Node | null {
  if (x instanceof ClipNode) { const r = refOfRecord(app, x.clip); return r ? clipNode(r) : null; }
  if (x instanceof Node) return x;
  if (x && typeof x === 'object' && 'start' in (x as object) && 'name' in (x as object)) { const r = refOfRecord(app, x); return r ? clipNode(r) : null; }
  if (typeof x !== 'string') return null;
  const s = x.trim(); if (!s) return null;
  const r = refByName(app, s); if (r) return clipNode(r);
  for (const model of allModels(app.scene)) {
    const src = model.properties.find(p => (isActionSource(p) || p.type === 'audiosource') && (p.name === s || `${model.name}.${p.name}` === s || p.fullName === s || s.endsWith(`.${p.name}`)));
    if (src) return src;
  }
  return findObject(app, s) ?? null;
}
/** A collection argument; unset = the selection. */
function elements(app: App, arg: unknown): Node[] {
  if (unset(arg)) return [...app.selection];
  const list = Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(',') : [arg];
  return list.map(x => resolveElement(app, x)).filter((n): n is Node => !!n);
}
const asClip = (n: unknown): ClipNode | null => (n instanceof ClipNode ? n : null);
const root = (app: App) => app.scene.root;
const isRoot = (app: App, m: Model) => m === app.scene.root;

// ------------------------------------------------------------------ SelectObjectsFromAction
function objectsFromAction(app: App, a: Record<string, any>): string[] {
  const onlyPose = truthy(a.OnlyPoseOffset);
  const out: string[] = [];
  for (const el of elements(app, a.InputObj)) {
    const node = asClip(el);
    if (node && /clip$/i.test(clipType(node.clip)) && !isAudioOrCamera(node.clip)) {
      const model = node.ref.model; const prefix = isRoot(app, model) ? '' : `${model.name}.`;
      for (const rule of mappingRules(node.ref)) {
        if (rule.target === UNMAPPED) continue;
        if (onlyPose && !rule.poseOffset) continue;
        const dot = rule.target.indexOf('.');
        if (prefix && rule.target.startsWith(prefix)) {
          // The script truncates by a character count here; in practice that is `<model>.<object>`.
          const object = rule.target.slice(prefix.length).split('.')[0];
          if (object.length > model.name.length + 1) notYetAttested(app, 'SelectObjectsFromAction', `result for the model-prefixed target "${rule.target}" (object name longer than the model name plus one)`, 'Q3');
          out.push(prefix + object);
        } else out.push(prefix + (dot < 0 ? rule.target : rule.target.slice(0, dot)));
      }
    } else if (el instanceof Property && isActionSource(el)) {
      const model = (el.parent instanceof Model ? el.parent : null) ?? root(app);
      const back = isShapeAction(el) ? 5 : 4;
      for (const raw of sourceItemsRaw(el)) {
        const parts = resolveItem(app.scene, raw, model).target.split('.');
        const object = parts[parts.length - back]; if (!object) continue;
        out.push(`${model.name}.${object}`);
        const selected = findObject(app, isRoot(app, model) ? object : `${model.name}.${object}`);
        if (selected && app.selection.includes(selected)) app.select(app.selection.filter(n => n !== selected));
      }
    }
  }
  if (out.length) {
    const nodes: Node[] = [];
    for (const name of out) { const o = findObject(app, name.startsWith(`${root(app).name}.`) ? name.slice(root(app).name.length + 1) : name); if (o && !nodes.includes(o)) nodes.push(o); }
    app.select(nodes);
    state(app).lastSelectMode = onlyPose ? 'branch' : 'node';   // inferred: this build's selection has no branch flag, the mode is kept here
  }
  return out;
}

// ------------------------------------------------------------------ FreezeClips
const FCURVE_KINDS = [10, 15, 20, 30];
function validateFreeze(app: App, input: Node[], a: Record<string, any>) {
  if (!input.length) cancel(app, text(1527));
  const step = Number(a.StepFrame), kind = Number(a['FCurve Kind']), seg = Number(a.DefaultSegKind);
  if (!(step > 0)) cancel(app, 'Time step must be strictly positive');
  if (!FCURVE_KINDS.includes(kind)) cancel(app, 'The FCurve Kind value must be one of 10 (boolean), 15 (integer), 20 (standard) or 30 (Raw)');
  if (kind === 20 && ![1, 2, 3].includes(seg)) cancel(app, 'The interpolation value must be one of 1 (constant), 2 (linear) or 3 (spline)');
  if (truthy(a['Fit FCurve']) && Number(a['Fit Tolerance']) === 0) cancel(app, 'The fit tolerance must be strictly greater than 0');
}
const trackKey = (ref: ClipRef) => `${compoundOf(ref)?.name ?? ''}:${Number(ref.clip.track ?? 0)}`;

function freezeClips(app: App, a: Record<string, any>): { action: Property; clips: ClipNode[] } {
  const input = elements(app, a.InputObj);
  validateFreeze(app, input, a);
  // 1. inactive clips leave the input collection (the caller's collection too)
  const inactive = (n: unknown) => { const c = asClip(n); return !!(c && c.clip.mute); };
  const active = input.filter(n => !inactive(n));
  if (Array.isArray(a.InputObj)) { const kept = a.InputObj.filter((x: unknown) => !inactive(resolveElement(app, x))); a.InputObj.splice(0, a.InputObj.length, ...kept); }
  // 2. usable clips, range, model, parameter list
  const clips = active.map(asClip).filter((n): n is ClipNode => !!n && isAnimClip(n.clip));
  const ignoreInactive = truthy(a.IgnoreInactiveChannels);
  let from = Infinity, to = -Infinity; const models: Model[] = []; const params: string[] = []; const raws: string[] = [];
  for (const n of clips) {
    const r = n.ref;
    from = Math.min(from, tc(r, 'startoffset') - extrapLength(r, 0));
    to = Math.max(to, tc(r, 'endtime') + extrapLength(r, 1) - 1);
    if (!models.includes(r.model)) models.push(r.model);
    for (const rule of mappingRules(r)) {
      if (rule.target === UNMAPPED || (ignoreInactive && !rule.active)) continue;
      const full = rule.target.split('.')[0] === r.model.name ? rule.target : `${r.model.name}.${rule.target}`;
      if (!params.includes(full)) { params.push(full); raws.push(rule.raw ?? rule.target); }
    }
  }
  // 3. further checks
  if (!clips.length) cancel(app, text(1527));
  if (!params.length) cancel(app, 'No parameters to freeze');
  if (models.length > 1) cancel(app, "Can't Freeze Clips owned by different models");
  const inside = clips.map(n => insideCompound(n.ref));
  if (inside.some(x => x) && inside.some(x => !x)) cancel(app, "Can't simultaneously Freeze Clips inside and outside compounds");
  const model = models[0]; const mix = clips[0].ref.mix;
  const cpd = inside[0] ? compoundOf(clips[0].ref) : undefined;
  // 4. compound local time -> parent time
  if (cpd) { from = toGlobal(clips[0].ref, from); to = toGlobal(clips[0].ref, to); }
  // 5. isolation: solo the tracks of the input clips, deactivate their neighbours
  const refs = [...allRefs(app)].filter(r => r.mix === mix && isAnimClip(r.clip));
  const inputSet = new Set(clips.map(n => n.clip));
  const solo = mix.trackSolo ?? (mix.trackSolo = {});
  const soloBefore = JSON.stringify(solo);
  const soloed = new Set(clips.map(n => trackKey(n.ref)));
  if (cpd) soloed.add(`:${Number(cpd.track ?? 0)}`);
  const onSoloed = refs.filter(r => soloed.has(trackKey(r)));
  const activeBefore = onSoloed.map(r => [r.clip, r.clip.mute] as const);
  let src: Property;
  try {
    for (const r of refs) solo[trackKey(r)] = soloed.has(trackKey(r));
    for (const r of onSoloed) r.clip.mute = !(inputSet.has(r.clip) || isCompoundRecord(r.clip));
    // 6. the plot
    const start = Math.round(from * 1000) / 1000, end = Math.round(to * 1000) / 1000;
    const first = [...model.descendants()][0];
    const call = {
      Model: first ? siObjName(first) : model.name, InputObj: params.join(','), Name: a.Name, StartFrame: start, EndFrame: end, StepFrame: Number(a.StepFrame),
      'FCurve Kind': Number(a['FCurve Kind']), DefaultSegKind: Number(a.DefaultSegKind), 'Fit FCurve': truthy(a['Fit FCurve']), 'Fit Tolerance': Number(a['Fit Tolerance']), ProcessContRots: truthy(a.ProcessContRots),
    };
    state(app).lastPlot = call;
    const leaves = onSoloed.filter(r => !isCompoundRecord(r.clip) && (cpd ? compoundOf(r) === cpd : true)).map(r => r.clip);
    src = plot(app, model, mix, leaves, raws, call);
  } finally {
    // 7. solo and active states go back
    for (const k of Object.keys(solo)) delete solo[k];
    Object.assign(solo, JSON.parse(soloBefore));
    for (const [c, m] of activeBefore) c.mute = m;
  }
  return { action: src, clips };
}

/** The plot behind FreezeClips: samples the isolated mixer over the range and stores the curves as a new action source. */
function plot(app: App, model: Model, mix: MixerX, leaves: ClipX[], raws: string[], call: Record<string, any>): Property {
  const kind = call['FCurve Kind'] as number; const step = call.StepFrame as number;
  if (call['Fit FCurve']) notYetAttested(app, 'FreezeClips', 'fitting the plotted values with an fcurve; the raw samples are kept', 'callee PlotToAction');
  const interp = kind === 20 ? mapSetCurveTypeToInterp(call.DefaultSegKind) : kind === 30 ? SI_KEY_INTERP_LINEAR : SI_KEY_INTERP_CONSTANT;   // inferred: key interpolation of raw / boolean / integer curves
  const curves: Record<string, { time: number; value: number; interp: number }[]> = {}; const values: Record<string, number> = {};
  for (let i = 0, f = call.StartFrame as number; f <= (call.EndFrame as number) + 1e-9; i++, f = (call.StartFrame as number) + i * step) {
    const vals = evalClips(mix, model, leaves, f);
    for (const raw of raws) {
      let v = vals[raw]; if (v === undefined) continue;
      if (kind === 10) v = v ? 1 : 0; else if (kind === 15) v = Math.round(v);
      const keys = curves[raw] ?? (curves[raw] = []);
      if (call.ProcessContRots && /rot[xyz]$/i.test(raw) && keys.length) { const prev = keys[keys.length - 1].value; while (v - prev > 180) v -= 360; while (v - prev < -180) v += 360; }
      keys.push({ time: Math.round(f * 1000) / 1000, value: v, interp });
      if (!(raw in values)) values[raw] = v;
    }
  }
  const src = new Property(app.scene.uniqueName(String(call.Name || 'FrozenAction')), 'actionsource', [
    str('data', JSON.stringify(values), 'Values', { readOnly: true }), str('fcurves', JSON.stringify(curves), 'FCurves', { readOnly: true }),
    str('expressions', '{}', 'Expressions', { readOnly: true }), int('items', Object.keys(values).length, 'Items', { readOnly: true }), int('mode', 1, 'Mode', { readOnly: true }),
  ]);
  (src as any).frameStart = call.StartFrame; (src as any).frameEnd = call.EndFrame;
  app.record('Freeze clips', () => model.addProperty(src), () => model.removeProperty(src));
  return src;
}

function freezeAndReplace(app: App, a: Record<string, any>): Property | undefined {
  const { action, clips } = freezeClips(app, a);
  if (!action) return undefined;
  const firstRef = clips[0].ref; const mix = firstRef.mix; const model = firstRef.model;
  // 2. target track container: the compound of the first input clip, else the mixer's animation tracks
  const cpd = insideCompound(firstRef) ? compoundOf(firstRef) : undefined;
  const clip = editMixer(app, mix, root(app), 'Freeze and replace clips', () => {
    // 3. delete the input clips, keep the earliest start (minus extrapolation before)
    let at = Infinity;
    for (const n of clips) {
      at = Math.min(at, tc(n.ref, 'startoffset') - extrapLength(n.ref, 0));
      deleteClip(app, n.ref);
    }
    // 4. active templates off (remembered)
    const templates = [...(mix.cnxTemplates ?? []), ...(mix.valueTemplates ?? [])].filter(t => t.active);
    for (const t of templates) t.active = false;
    // 5. a new animation track with a clip of the frozen action at the insertion frame
    const siblings = cpd ? mix.clips.filter(c => cpd.clips?.includes(c.name)) : [...mix.clips, ...(mix.compounds as ClipX[])];
    const track = siblings.reduce((m, c) => Math.max(m, Number(c.track ?? 0)), -1) + 1;
    const s = Number((action as any).frameStart), e = Number((action as any).frameEnd);
    const made: ClipX = { name: uniqueName(mix.clips, mix, `${action.name}_Clip`), source: action.name, start: at, duration: e - s + 1, track, weight: 1, mute: false, additive: false, timectrl: { clipin: s, clipout: e, scale: 1 } };
    mix.clips.push(made);
    if (cpd) cpd.clips!.push(made.name);
    // 6. templates back on
    for (const t of templates) t.active = true;
    return made;
  });
  app.select([clipNode({ clip, mix, model })], 'add');
  return action;
}
function deleteClip(app: App, ref: ClipRef) {
  const list = containerOf(app, ref); const i = list.indexOf(ref.clip); if (i >= 0) list.splice(i, 1);
  if (isCompoundRecord(ref.clip)) for (const n of ref.clip.clips ?? []) { const j = ref.mix.clips.findIndex(c => c.name === n); if (j >= 0) ref.mix.clips.splice(j, 1); }
  for (const c of ref.mix.compounds) { const j = c.clips?.indexOf(ref.clip.name) ?? -1; if (j >= 0) c.clips!.splice(j, 1); }
  app.select(app.selection.filter(n => !(n instanceof ClipNode && n.clip === ref.clip)));
}
function uniqueName(list: ClipX[], mix: MixerX, base: string): string {
  const taken = new Set<string>([...list.map(c => c.name), ...mix.clips.map(c => c.name), ...mix.compounds.map(c => c.name)]);
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

// ------------------------------------------------------------------ freeze wizard (UI overloads)
const KIND_BY_INDEX = [10, 15, 20, 30]; const SEG_BY_INDEX = [1, 2, 3];
function freezeWizard(app: App): Property {
  const r = root(app);
  let p = r.properties.find(x => x.name === 'FreezeClips');
  if (!p) {
    // Combo item labels are open question Q2; these describe the attested index mapping.
    p = new Property('FreezeClips', 'FreezeActionWizard', [
      bool('IgnoreInactive', true, 'Ignore inactive channels'), str('ActionName', 'Frozen', 'Action Name'),
      num('Step', 1, 'Step value', { min: -1000000, max: 1000000 }),
      enumP('FCurveKind', 3, [{ label: 'Boolean', value: 0 }, { label: 'Integer', value: 1 }, { label: 'Standard', value: 2 }, { label: 'Raw', value: 3 }], 'Kind of fcurve'),   // inferred labels
      enumP('Interpolation', 2, [{ label: 'Constant', value: 0 }, { label: 'Linear', value: 1 }, { label: 'Spline', value: 2 }], 'Interpolation'),   // inferred labels
      bool('FitFCurve', false, 'Fit plotted values with an fcurve'), num('FitTolerance', 0.01, 'Fit Tolerance', { min: 0.0001, max: 10, uimin: 0.0001, uimax: 1 }),
      bool('ProcessContRots', true, 'Process rotations to ensure continuity'),
    ]);
    const made = p;
    app.record('Add property', () => r.addProperty(made), () => r.removeProperty(made));
  }
  return p;
}
const WIZARD_PARAMS = ['IgnoreInactive', 'ActionName', 'Step', 'FCurveKind', 'Interpolation', 'FitFCurve', 'FitTolerance', 'ProcessContRots'];
/** UI overload shared by FreezeClips and FreezeAndReplaceClips: wizard, read back into the in/out arguments, scripted command. */
function freezeUi(app: App, command: 'FreezeClips' | 'FreezeAndReplaceClips', args: Record<string, any> = {}): any {
  const title = unset(args.Title) ? (command === 'FreezeClips' ? 'Freeze Clips' : 'Freeze And Replace Clips') : String(args.Title);
  const p = freezeWizard(app);
  const go = (ok: boolean) => {
    if (!ok) throw new CommandCancelled(`${command}: cancelled`);
    args.IgnoreInactiveChannels = !!p.val('IgnoreInactive'); args.Name = String(p.val('ActionName')); args.StepFrame = Number(p.val('Step'));
    args['FCurve Kind'] = KIND_BY_INDEX[Number(p.val('FCurveKind'))]; args.DefaultSegKind = SEG_BY_INDEX[Number(p.val('Interpolation'))];
    args['Fit FCurve'] = !!p.val('FitFCurve'); args['Fit Tolerance'] = Number(p.val('FitTolerance')); args.ProcessContRots = !!p.val('ProcessContRots');
    app.run(command, args);
    return undefined;   // the procedure does not hand the action back (Q4)
  };
  if (!interactive(app)) return go(true);   // inferred: no dialog in batch mode, counts as OK
  return mixerWizardDialog(title, p, WIZARD_PARAMS).then(go);
}

// ------------------------------------------------------------------ CutClip
function cutMode(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  const m = s.match(/si(Cut|TrimBefore|TrimAfter)\b/);
  if (m) return m[1] === 'Cut' ? SI_CUT : m[1] === 'TrimBefore' ? SI_TRIM_BEFORE : SI_TRIM_AFTER;
  return s !== '' && Number.isFinite(Number(s)) ? Number(s) : NaN;
}
function copyClip(app: App, ref: ClipRef): ClipX {
  const list = containerOf(app, ref); const mix = ref.mix;
  const copy: ClipX = JSON.parse(JSON.stringify(ref.clip));
  copy.name = uniqueName(list, mix, ref.clip.name);
  if (isCompoundRecord(ref.clip)) {
    copy.clips = [];
    for (const n of ref.clip.clips ?? []) {
      const m = mix.clips.find(c => c.name === n); if (!m) continue;
      const mc: ClipX = JSON.parse(JSON.stringify(m)); mc.name = uniqueName(mix.clips, mix, m.name);
      mix.clips.push(mc); copy.clips.push(mc.name);
    }
  }
  list.push(copy);
  const cpd = compoundOf(ref); if (cpd) cpd.clips!.push(copy.name);
  return copy;
}
function cutClip(app: App, a: Record<string, any>): ClipX | undefined {
  const mode = cutMode(a.Mode);
  if (![SI_CUT, SI_TRIM_BEFORE, SI_TRIM_AFTER].includes(mode)) cancel(app, 'Invalid cut mode');
  const node = asClip(unset(a.Clip) ? app.selection[0] : resolveElement(app, Array.isArray(a.Clip) ? a.Clip[0] : a.Clip));
  if (!node) cancel(app, text(1527));   // inferred: the contract does not name the message for a missing clip
  const ref = node.ref; const c = ref.clip; const type = clipType(c);
  if (type === T_LAYER) cancel(app, 'Cannot cut layer clips');
  const cam = type === T_CAMSHOT; const noWeight = isAudioOrCamera(c);
  const bt = extrapType(ref, 0), at = extrapType(ref, 1);
  if (bt === EXTRAP_HOLD || bt === EXTRAP_BOUNCE || at === EXTRAP_HOLD || at === EXTRAP_BOUNCE) cancel(app, 'Only extrapolation cycles are supported');
  // 1. inside a compound the cut frame is in the compound's local time
  let t = frameArg(app, a.Time);
  if (insideCompound(ref) && compoundOf(ref)) t = Math.floor(toLocal(ref, t) + 0.5);
  // 3. extended range
  let start = tc(ref, 'startoffset'), end = tc(ref, 'endtime'); const len = end - start;
  let cb = bt === EXTRAP_CYCLE ? extrapCount(ref, 0) : 0, ca = at === EXTRAP_CYCLE ? extrapCount(ref, 1) : 0;
  const extStart = start - cb * len, extEnd = end + ca * len;
  if (!(len > 0) || t < extStart + 1 - 1e-9 || t > extEnd - 1 + 1e-9) { info(app, 'Invalid split point. (The current frame is not inside the Clip)'); return c; }
  if (!Number.isInteger(cb) || !Number.isInteger(ca)) cancel(app, 'Fractional cycles not supported');
  return editMixer(app, ref.mix, root(app), 'Cut clip', () => {
    // 2. clip-to-parent off, start / in / out rewritten, empty cycle extrapolation reset
    if (!cam) {
      setTc(ref, 'cliptoparentstart', false); setTc(ref, 'cliptoparentend', false);
      setTc(ref, 'startoffset', start); setTc(ref, 'clipin', tc(ref, 'clipin')); setTc(ref, 'clipout', tc(ref, 'clipout'));
      if (bt === EXTRAP_CYCLE && cb === 0) setExtrap(ref, 0, 0, 0);
      if (at === EXTRAP_CYCLE && ca === 0) setExtrap(ref, 1, 0, 0);
    }
    const scale = tc(ref, 'scale'), cin = tc(ref, 'clipin');
    // 4. keep the weight curve when cycles would otherwise lose it
    const needSnap = !noWeight && ((mode === SI_CUT && (cb > 0 || ca > 0)) || (mode === SI_TRIM_AFTER && cb > 0) || (mode === SI_TRIM_BEFORE && ca > 0));
    const snap: EffectKey[] | null = needSnap ? snapshotWeight(c, [t - 1, t, t + 1, extStart]) : null;
    // 5. frame in a cycle: shift the body by whole lengths, rebalance the cycle counts
    const k = Math.ceil((t - start) / len - 1e-9) - 1;   // inferred: a frame on a cycle boundary belongs to the body that ends there (Q1)
    if (k !== 0) { start += k * len; end += k * len; cb += k; ca -= k; setTc(ref, 'startoffset', start); setExtrap(ref, 0, EXTRAP_CYCLE, cb); setExtrap(ref, 1, EXTRAP_CYCLE, ca); }
    // 6. new out point of the head
    const newOut = (t - start) * scale + cin - 1;
    const head = (r: ClipRef) => {
      if (cam && mode === SI_TRIM_AFTER) { setTc(r, 'sceneout', newOut + 1); setTc(r, 'scale', scale); return; }
      if (cb === 0) { setExtrap(r, 1, 0, 0); setTc(r, 'clipout', newOut); }
      else { setTc(r, 'startoffset', extStart); setExtrap(r, 0, 0, 0); setExtrap(r, 1, EXTRAP_CYCLE, 1 - (end - t) / len + cb - 1); }
    };
    const tail = (r: ClipRef) => {
      if (cam && mode === SI_TRIM_BEFORE) { setTc(r, 'sequencein', t); setTc(r, 'scenein', newOut + 1); setTc(r, 'scale', scale); return; }
      if (ca === 0) { setExtrap(r, 0, 0, 0); setTc(r, 'startoffset', t); setTc(r, 'clipin', newOut + 1); }
      else { setTc(r, 'startoffset', end + (ca - 1) * len); setExtrap(r, 1, 0, 0); setExtrap(r, 0, EXTRAP_CYCLE, (end - t) / len + ca - 1); }
    };
    if (mode === SI_CUT) {
      // 7. The contract copies the clip onto a temporary track and moves the copy back onto the original's track;
      //    the net result (a copy on the same track carrying timing, scale, fill, active flag) is produced directly.
      const copy = copyClip(app, ref); const cref: ClipRef = { ...ref, clip: copy };
      head(ref); tail(cref);
      if (snap) {   // 9.
        removeWeightAnimation(c); restoreWeight(c, snap, extStart - 1, t);
        removeWeightAnimation(copy); restoreWeight(copy, snap, t - 1, extEnd + 1);
      }
      return copy;
    }
    // 8. trims
    if (mode === SI_TRIM_BEFORE) tail(ref); else head(ref);
    if (snap) { removeWeightAnimation(c); restoreWeight(c, snap, extStart - 1, extEnd + 1); }
    return c;
  });
  // 10. the current frame is never moved by this implementation.
}

// ------------------------------------------------------------------ clip effects
function animClips(app: App, arg: unknown): ClipNode[] { return elements(app, arg).map(asClip).filter((n): n is ClipNode => !!n && isAnimClip(n.clip)); }
function keyParam(item: EffectItem, time: number, value: number) {
  const k = item.param.find(x => x.time === time);
  if (k) k.value = value; else { item.param.push({ time, value }); item.param.sort((x, y) => x.time - y.time); }
}
/** Effect kind from the first item's expression: offset (neutral 0), scale (neutral 1) or neither. */
function effectNeutral(items: EffectItem[]): number | null {
  const e = items[0]?.valuemap ?? '';
  if (e.includes('+ param') || e.includes('+param')) return 0;
  if (e.includes('* param') || e.includes('*param')) return 1;
  return null;
}
function rekey(ref: ClipRef, item: EffectItem, neutral: number) { item.param = []; keyParam(item, tc(ref, 'resin'), neutral); keyParam(item, tc(ref, 'resout'), neutral); }
/** Run an edit over the clips grouped by mixer, one undo step per mixer. */
function editClips(app: App, clips: ClipNode[], label: string, fn: (n: ClipNode) => void) {
  const mixes = [...new Set(clips.map(n => n.ref.mix))];
  for (const mix of mixes) editMixer(app, mix, root(app), label, () => { for (const n of clips) if (n.ref.mix === mix) fn(n); });
}

// ------------------------------------------------------------------ ClipMatch
function sampleGlobal(app: App, ref: ClipRef, obj: X3DObject, frame: number): THREE.Matrix4 {
  const was = ref.clip.mute; ref.clip.mute = false;
  const vals = evalClips(ref.mix, ref.model, [ref.clip], frame);
  ref.clip.mute = was;
  const saved: [any, any][] = [];
  for (const [raw, v] of Object.entries(vals)) { const p = resolveItem(app.scene, raw, ref.model).param; if (p) { saved.push([p, p.value]); p.value = v; } }
  const m = obj.globalMatrix().clone();
  for (const [p, v] of saved.reverse()) p.value = v;
  return m;
}
function setGlobal(app: App, obj: X3DObject, g: THREE.Matrix4) {
  const parent = obj.parentObj ? obj.parentObj.globalMatrix() : new THREE.Matrix4();
  const local = parent.clone().invert().multiply(g);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(p, q, s);
  const L = obj.kinematics.local; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(L.val('rotorder'))); const r = 180 / Math.PI;
  const set = (n: string, v: number) => { const prm = L.get(n); if (prm) app.setParam(prm, v, 'ClipMatch'); };
  set('posx', p.x); set('posy', p.y); set('posz', p.z); set('rotx', e.x * r); set('roty', e.y * r); set('rotz', e.z * r);
}
const TAGS = ['RightFoot', 'LeftFoot', 'CenterOfGravity'];
function matchClips(app: App, firstIn: ClipNode, secondIn: ClipNode, target: X3DObject) {
  let first = firstIn, second = secondIn;
  // 3. order
  if (tc(second.ref, 'resin') < tc(first.ref, 'resin')) { info(app, 'Clips picked backwards. Swapping!'); [first, second] = [second, first]; }
  const c2 = second.clip;
  editMixer(app, second.ref.mix, root(app), 'Clip Match', () => {
    // 4. pose offset on and reset
    c2.poseactive = true;
    c2.staticKineState = { sclx: 1, scly: 1, sclz: 1, orix: 0, oriy: 0, oriz: 0, posx: 0, posy: 0, posz: 0 };
    // 5. frames
    let end = tc(first.ref, 'resout') - 1; const start = tc(second.ref, 'resin');
    if (tc(first.ref, 'resin') < start && tc(first.ref, 'resout') > start) end = start;
    info(app, `Matching from frame: ${end} (${first.fullName})`);
    info(app, `To frame: ${start} (${second.fullName})`);
    // 6. the matched object at `end` under the first clip only, at `start` under the second only; both stay active
    const A = sampleGlobal(app, first.ref, target, end);
    const B = sampleGlobal(app, second.ref, target, start);
    first.clip.mute = false; c2.mute = false;
    // 7. The contract builds three temporary nulls (transferNull, A, B) and deletes them again; the same
    //    transform is computed here without scene objects: B moved to A's position and turned about global Y by
    //    the heading difference. Matrices are written in the scripting API's row-vector order, so the offset
    //    inverse(B) x transfer is `transfer * inverse(B)` in three.js column order (inferred).
    const xa = new THREE.Vector3().setFromMatrixColumn(A, 0).setY(0), xb = new THREE.Vector3().setFromMatrixColumn(B, 0).setY(0);
    let angle = 0;
    if (xa.lengthSq() > 1e-12 && xb.lengthSq() > 1e-12) { angle = xb.angleTo(xa); if (new THREE.Vector3().crossVectors(xb, xa).y < 0) angle = -angle; }   // inferred: sign convention (turns B's heading onto A's)
    const pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sb = new THREE.Vector3(); B.decompose(pb, qb, sb);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const transfer = new THREE.Matrix4().compose(new THREE.Vector3().setFromMatrixPosition(A), qy.clone().multiply(qb), sb);
    const offset = transfer.clone().multiply(B.clone().invert());
    // 8. the first pose-offset object of the second clip takes the offset
    const names = app.run('SelectObjectsFromAction', { InputObj: [second], OnlyPoseOffset: true }) as string[] | undefined;
    const poseObj = names?.length ? findObject(app, names[0]) : undefined;
    if (!poseObj) { info(app, `Failed to Match Clips. No objects set for pose offset in ${second.fullName}`); return; }
    const G = sampleGlobal(app, second.ref, poseObj, start);
    setGlobal(app, poseObj, offset.clone().multiply(G));
    // OffsetValueMap <clip>, siPoseOffsetClip, start: the change becomes the clip's pose offset (stored as the offset transform, inferred).
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); offset.decompose(p, q, s);
    const e = new THREE.Euler().setFromQuaternion(q, 'ZYX'); const r = 180 / Math.PI;
    c2.staticKineState = { sclx: 1, scly: 1, sclz: 1, orix: e.x * r, oriy: e.y * r, oriz: e.z * r, posx: p.x, posy: p.y, posz: p.z };
    (c2 as any).poseOffsetType = SI_POSE_OFFSET_CLIP; (c2 as any).poseOffsetFrame = start;
  });
}
function clipMatch(app: App, a: Record<string, any>): any {
  const input = unset(a.InputObj) ? [...app.selection] : elements(app, a.InputObj);
  const isAnim = (n: unknown): n is ClipNode => n instanceof ClipNode && clipType(n.clip) === T_ANIM;
  let first = isAnim(input[0]) ? input[0] : null, second = isAnim(input[1]) ? input[1] : null;
  let target = input[2] instanceof X3DObject ? input[2] : undefined;
  // 1. two clips, picked when not supplied
  if (!first || !second) {
    const pick = state(app).pickClip;
    const picked: ClipNode[] = [];
    for (const prompt of ['Pick Reference Clip', 'Pick Clip to Offset']) {
      info(app, prompt);
      const raw = pick ? pick(prompt) : null;   // no pick session in this build: counts as right-click / escape
      const got = raw === null || raw === undefined ? null : resolveElement(app, raw) ?? raw;
      if (got === null || got === undefined) return undefined;
      if (!isAnim(got)) { info(app, 'Match Clip Aborted: A clip was not picked'); return undefined; }
      picked.push(got);
    }
    [first, second] = picked;
  }
  if (target) { matchClips(app, first!, second!, target); return undefined; }
  // 2. object to match: tagged objects of the model, chosen in the MatchClips page
  const el0 = input[0];
  const model: Model = (el0 instanceof ClipNode ? el0.ref.model : el0 instanceof X3DObject ? el0.model : el0 instanceof Property && el0.parent instanceof Model ? el0.parent : null) ?? root(app);
  const found: (X3DObject | undefined)[] = TAGS.map(tag => [...model.descendants()].find(o => o.properties.some(p => p.name === tag)));
  let match = 0; found.forEach((o, i) => { if (o) match = i; });
  const prop = new Property('MatchClips', 'MatchClips', [
    str('rightfoot', found[0] ? siObjName(found[0]) : text(1042), 'Right Foot', { readOnly: true }), str('leftfoot', found[1] ? siObjName(found[1]) : text(1042), 'Left Foot', { readOnly: true }),
    str('body_Center', found[2] ? siObjName(found[2]) : text(1042), 'Center Of Gravity', { readOnly: true }),   // inferred labels (Q2)
    enumP('Match', match, [{ label: 'Right Foot', value: 0 }, { label: 'Left Foot', value: 1 }, { label: 'Center Of Gravity', value: 2 }], 'Match'),
  ]);
  const r = root(app); r.addProperty(prop);
  const done = (ok: boolean) => {
    r.removeProperty(prop);
    if (!ok) return undefined;
    target = found[Number(prop.val('Match'))];
    if (!target) { info(app, text(1042)); return undefined; }   // inferred: a missing tagged object ends the command with message 1042
    matchClips(app, first!, second!, target);
    return undefined;
  };
  if (!interactive(app)) return done(true);   // inferred: no dialog in batch mode, counts as OK
  return mixerWizardDialog(text(1041), prop, ['rightfoot', 'leftfoot', 'body_Center', 'Match']).then(ok => { const out = done(ok); syncMixer(second!.ref.mix); app.events.emit('scene'); return out; });
}

// ------------------------------------------------------------------ offload / reload
function actionsOf(app: App, arg: unknown): Property[] { return elements(app, arg).filter((n): n is Property => n instanceof Property && (n.type === 'actionsource' || /^action$/i.test(n.type))); }
function storageCheck(app: App, src: Property) {
  if (Number((src as any).storage ?? 0) !== 0) return;
  const msg = text(1033).replace('%s', src.name);
  if (interactive(app)) siMsgBox(msg, 'Warning'); else info(app, `Warning: ${msg}`);
  throw new CommandCancelled(msg);
}
/** Offload state of a source. Set directly: actions processed before a failing one stay offloaded (inferred: not undoable). */
function setOffload(src: Property, value: unknown) { (src as any).offloaded = value; }

// ------------------------------------------------------------------ registration
export function registerMixerActionScriptCommands(app: App) {
  if ((app as any).Interactive === undefined) (app as any).Interactive = true;
  const st = state(app);
  const reg = (def: CommandDef) => app.register(def);

  reg({
    name: 'SelectActionsFromObjects', label: 'Select actions from objects', description: 'Selects the actions driving the selected objects',
    args: [{ name: 'InputObjs', default: null }, { name: 'Consider Time', default: false }, { name: 'Time', default: null }, { name: 'Keep Compound Actions', default: true }, { name: 'Keep Inactive Actions', default: false }],
    execute(app, a) {
      const got = app.run('GetDrivingActions', { InputObjs: a.InputObjs, 'Consider Time': a['Consider Time'], Time: a.Time, 'Keep Compound Actions': a['Keep Compound Actions'], 'Keep Inactive Actions': a['Keep Inactive Actions'] });
      const list: unknown[] = Array.isArray(got) ? got : unset(got) ? [] : [got];
      const nodes = list.map(x => resolveElement(app, x)).filter((n): n is Node => !!n);
      app.select(nodes);
      return nodes;
    },
  });
  reg({
    name: 'SelectObjectsFromAction', label: 'Select objects from action', description: 'Selects the objects driving the selected actions',
    args: [{ name: 'InputObj', default: null }, { name: 'OnlyPoseOffset', default: false }],
    execute: (app, a) => objectsFromAction(app, a),
  });

  const FREEZE_ARGS = [{ name: 'InputObj', default: null }, { name: 'Name', default: 'FrozenAction' }, { name: 'IgnoreInactiveChannels', default: true }, { name: 'StepFrame', default: 1.0 },
    { name: 'FCurve Kind', default: 30 }, { name: 'DefaultSegKind', default: 3 }, { name: 'Fit FCurve', default: false }, { name: 'Fit Tolerance', default: 0.01 }, { name: 'ProcessContRots', default: true }];
  const FREEZE_UI_ARGS = (title: string) => [{ name: 'InputObj', default: null }, { name: 'Name', default: 'FrozenAction' }, ...FREEZE_ARGS.slice(2).map(x => ({ name: x.name, default: null })), { name: 'Title', default: title }];
  reg({ name: 'FreezeClips', label: 'Freeze clips', description: 'Freezes the selected clips into a new action', args: FREEZE_ARGS, execute: (app, a) => freezeClips(app, a).action });
  reg({ name: 'FreezeAndReplaceClips', label: 'Freeze and replace clips', description: 'Freezes the selected clips into a new action', args: FREEZE_ARGS, execute: (app, a) => freezeAndReplace(app, a) });
  st.uiArgs.FreezeClips = FREEZE_UI_ARGS('Freeze Clips'); st.ui.FreezeClips = (args = {}) => freezeUi(app, 'FreezeClips', args);
  st.uiArgs.FreezeAndReplaceClips = FREEZE_UI_ARGS('Freeze And Replace Clips'); st.ui.FreezeAndReplaceClips = (args = {}) => freezeUi(app, 'FreezeAndReplaceClips', args);

  reg({
    name: 'CrossfadeClipWeights', label: 'Crossfade clips weights', description: 'Crossfades two clips',
    args: [{ name: 'FirstClip', default: null }, { name: 'SecondClip', default: null }],
    execute(app, a) {
      const pair = [a.FirstClip, a.SecondClip].map(x => {
        const n = asClip(resolveElement(app, x));
        if (!n || isAudioOrCamera(n.clip)) cancel(app, `${n ? n.fullName : (x as any)?.fullName ?? String(x ?? '')} is not a valid clip.`);
        return n;
      });
      // the clip that starts earlier is A
      const [A, B] = tc(pair[1].ref, 'resin') < tc(pair[0].ref, 'resin') ? [pair[1], pair[0]] : pair;
      const aIn = tc(A.ref, 'resin'), aOut = tc(A.ref, 'resout'), bIn = tc(B.ref, 'resin'), bOut = tc(B.ref, 'resout');
      const partial = aIn < bIn && bIn < aOut && aOut < bOut, inside = aIn < bIn && bIn < bOut && bOut < aOut;
      if (!partial && !inside) return undefined;
      editClips(app, [A, B], 'Crossfade clips weights', (n) => {
        if (partial) {
          removeWeightAnimation(n.clip);
          saveWeightKey(n.clip, bIn, n === B ? 0 : 1); saveWeightKey(n.clip, aOut - 1, n === B ? 1 : 0);
        } else applyWeightPreset(n.clip, n === B ? SI_WEIGHT_GAUSSIAN : SI_WEIGHT_GAUSSIAN_REVERSE, bIn, bOut);
      });
      return undefined;
    },
  });

  reg({
    name: 'CutClip', label: 'Cut clip', description: 'Cuts the input clips',
    args: [{ name: 'Clip', default: null }, { name: 'Mode', default: ':siCut:siCutClipOptions' }, { name: 'Time', default: null }],
    execute: (app, a) => cutClip(app, a),
  });
  for (const [name, label, token, description] of [['TrimBefore', 'Trim Before', 'siTrimBefore', 'Trims the head of the selected clips'], ['TrimAfter', 'Trim After', 'siTrimAfter', 'Trims the tail of the selected clips']] as const) {
    reg({
      name, label, category: CAT, description,
      args: [{ name: 'Clip', default: null }, { name: 'Mode', default: `:${token}:siCutClipOptions` }, { name: 'Time', default: null }],
      execute(app, a) {
        for (const el of elements(app, a.Clip)) {
          const n = asClip(el); if (!n || !isAnimOrShapeClip(n.clip)) continue;
          app.run('CutClip', { Clip: n, Mode: a.Mode, Time: a.Time });   // an error in one clip aborts the loop
        }
        return undefined;
      },
    });
  }

  reg({
    name: 'CreateScaleEffect', label: 'CreateScaleEffect', category: 'Animation mixer', description: 'Create a scale effect on the selected clips',
    args: [{ name: 'Clip', default: null }],
    execute(app, a) {
      if (!elements(app, a.Clip).length) { info(app, 'Please select a clip first'); return undefined; }
      editClips(app, animClips(app, a.Clip), 'CreateScaleEffect', (n) => {
        for (const item of effectItems(n.ref)) {
          keyParam(item, tc(n.ref, 'resin'), 1.0); keyParam(item, tc(n.ref, 'resout'), 1.0);
          item.valuemap = `(${item.valuemap || 'this'}) * param`;
        }
        n.clip.scaleEffect = true;
      });
      return undefined;
    },
  });
  reg({
    name: 'ResetAllEffectCurves', label: 'ResetAllEffectCurves', category: 'Animation mixer', description: 'Reset the effect curves for all the parameters in the selected clips',
    args: [{ name: 'Clip', default: null }],
    execute(app, a) {
      if (!elements(app, a.Clip).length) { info(app, 'Please select a clip first'); return undefined; }
      editClips(app, animClips(app, a.Clip), 'ResetAllEffectCurves', (n) => {
        const items = effectItems(n.ref); const neutral = effectNeutral(items);
        for (const item of items) { if (neutral === null) item.param = []; else rekey(n.ref, item, neutral); }
      });
      return undefined;
    },
  });
  reg({
    name: 'ResetSelectedEffectCurves', label: 'ResetSelectedEffectCurves', category: 'Animation mixer', description: 'Reset the effect curves for all the parameters in the selected clips',
    args: [{ name: 'Clip', default: null }],
    execute(app, a) {
      // The procedure treats the argument as ONE clip path.
      const n = unset(a.Clip) ? null : asClip(resolveElement(app, Array.isArray(a.Clip) ? a.Clip[0] : a.Clip));
      if (!n) { info(app, 'Please select a clip first'); return undefined; }
      if (!app.selection.length) cancel(app, 'Nothing selected!');
      const items = effectItems(n.ref); const neutral = effectNeutral(items) ?? 0;
      const prefix = n.fullName.startsWith('Mixer') ? '' : `${n.ref.model.name}.`;
      const selected = app.selection.map(s => (s instanceof X3DObject ? siObjName(s) : s.fullName));
      editClips(app, [n], 'ResetSelectedEffectCurves', () => {
        for (const sel of selected) mappingRules(n.ref).forEach((rule, i) => {
          if (rule.target === UNMAPPED) return;
          if (sel !== prefix + rule.target.split('.')[0]) return;
          info(app, `Resetting effect curves for ${rule.target}`);
          if (items[i]) rekey(n.ref, items[i], neutral);
        });
      });
      return undefined;
    },
  });
  const resetAtFrame = (app: App, clip: unknown, time: number) => {
    if (!elements(app, clip).length) { info(app, 'Please select a clip first'); return; }
    editClips(app, animClips(app, clip), 'ResetEffectAtFrame', (n) => { for (const item of effectItems(n.ref)) item.param = item.param.filter(k => k.time !== time); });
  };
  reg({
    name: 'ResetEffectAtFrame', label: 'ResetEffectAtFrame', category: 'Animation mixer', description: 'Remove the effect keys at the given time in the selected clips',
    args: [{ name: 'Clip', default: null }, { name: 'Time', default: null }],
    execute(app, a) { resetAtFrame(app, a.Clip, frameArg(app, a.Time)); return undefined; },
  });
  // UI overload: works at the key-marker frame (PlayControl.Key) and moves the in/out Time and the current frame there.
  st.uiArgs.ResetEffectAtFrame = [{ name: 'Clip', default: null }, { name: 'Time', default: null }];
  st.ui.ResetEffectAtFrame = (args = {}) => {
    const anim = app.anim as any;
    const key = Number(anim.keyMarker ?? anim.key ?? app.anim.frame);   // inferred: this build's play control has no separate key marker; the current frame stands in
    app.run('ResetEffectAtFrame', { Clip: args.Clip, Time: key });
    if (Number(args.Time) !== key) { args.Time = key; app.anim.frame = key; }
    return undefined;
  };

  reg({ name: 'ClipMatch', label: 'Clip Match', category: CAT, description: 'Matches up two clips at the start of the the second.', args: [{ name: 'InputObj', default: null }], execute: (app, a) => clipMatch(app, a) });

  // ---- import and add / apply
  const MODEL_FILE = [{ name: 'Model', default: null }, { name: 'FileName', default: null }];
  reg({
    name: 'ImportActionAndAddClip', label: 'ImportActionAndAddClip', category: CAT, description: 'Create and add clip to the given compound and track', args: MODEL_FILE,
    execute(app, a) {
      const action = app.run('ImportAction', { Model: a.Model, FileName: a.FileName });
      app.run('AddClip', { Model: a.Model, Source: action?.name ?? action });
      return undefined;   // the registry flags a return value, the procedure hands nothing back (Q4)
    },
  });
  reg({
    name: 'ImportActionAndApply', label: 'ImportActionAndApply', category: CAT, description: 'Create and apply action to the given compound and track', args: MODEL_FILE,
    execute(app, a) {
      const action = app.run('ImportAction', { Model: a.Model, FileName: a.FileName });
      app.run('ApplyAction', { Source: action?.name ?? action, Target: a.Model });
      return undefined;   // as above (Q4)
    },
  });
  reg({
    name: 'ImportAudioAndAddClip', label: 'ImportAudioAndAddClip', category: CAT, description: 'Import an audio file and create a clip for it', args: MODEL_FILE,
    execute(app, a) {
      // ImportAudio / AddAudioClip are not modelled on the bus of this build; the audio source and its clip are made here.
      if (unset(a.FileName)) cancel(app, 'ImportAudioAndAddClip: no file name (the file browser of the import command is not available in this build)');   // inferred
      const el = unset(a.Model) ? null : resolveElement(app, a.Model);
      const model: Model = (el instanceof Model ? el : el instanceof X3DObject ? el.model : null) ?? app.selectedObjects[0]?.model ?? root(app);
      const file = String(a.FileName); const base = (file.split(/[\\/]/).pop() ?? file).replace(/\.[^.]*$/, '') || 'Audio';
      const src = new Property(app.scene.uniqueName(base), 'audiosource', [str('filename', file, 'File Name', { readOnly: true })]);
      app.record('Import audio', () => model.addProperty(src), () => model.removeProperty(src));
      const mix = mixerX(model);
      const clip = editMixer(app, mix, root(app), 'Add audio clip', () => {
        const made: ClipX = { name: uniqueName(mix.clips, mix, `${src.name}_Clip`), source: src.name, start: app.anim.frame, duration: Math.max(1, app.anim.endFrame - app.anim.startFrame), track: 0, weight: 1, mute: false, type: T_AUDIO };   // inferred: clip length (no audio decoding in this build)
        mix.clips.push(made); return made;
      });
      return clip;
    },
  });

  // ---- offload / reload
  reg({
    name: 'OffloadAction', label: 'OffloadAction', category: CAT, description: 'OffloadAction', args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { for (const src of actionsOf(app, a.InputObjs)) { storageCheck(app, src); setOffload(src, true); } return undefined; },
  });
  reg({
    name: 'PartialOffloadAction', label: 'PartialOffloadAction', category: CAT, description: 'PartialOffloadAction',
    args: [{ name: 'InputObjs', default: null }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'Remember', default: false }],
    execute(app, a) {
      for (const src of actionsOf(app, a.InputObjs)) { storageCheck(app, src); setOffload(src, { start: Number(a.StartFrame), end: Number(a.EndFrame), remember: truthy(a.Remember) }); }
      return undefined;
    },
  });
  reg({
    name: 'ReloadAction', label: 'ReloadAction', category: CAT, description: 'ReloadAction', args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { for (const src of actionsOf(app, a.InputObjs)) setOffload(src, false); return undefined; },
  });

  reg({
    name: 'DeleteUnusedCamSeqTracks', label: 'Delete Unused Camera Sequencer Tracks', category: 'Camera Sequencer', description: 'Deletes any unused tracks.', args: [],
    execute(app) {
      const seq = (root(app) as any).cameraSequencer as { tracks: { name: string; clips: ClipX[] }[] } | undefined;
      const empty = seq ? seq.tracks.filter(t => !t.clips.length) : [];
      if (!empty.length) return undefined;
      editMixer(app, mixerX(root(app)), root(app), 'Delete Unused Camera Sequencer Tracks', () => { seq!.tracks.splice(0, seq!.tracks.length, ...seq!.tracks.filter(t => t.clips.length)); });
      return undefined;
    },
  });
}

// Re-exported for tools and for other command files that need to address clips.
export { ClipNode, clipNode, clipFullName, sourcesOf, T_ANIM_CPD };
