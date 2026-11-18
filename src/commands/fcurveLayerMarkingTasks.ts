// Ledger row CMD-B8b. Brief: docs/ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md, "Wire contract" sections and
// "Shared facts". Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   animation layers  GetCurrentAnimationLayer GetNumberOfAnimationLayers SetCurrentAnimationLayer
//                     AddAnimationLayer DeleteAnimationLayer DuplicateAnimationLayer LockAnimationLayer
//                     UnlockAnimationLayer IsAnimationLayerLocked
//   marking           SetMarking ClearMarking AddToMarking RemoveFromMarking GetMarking
//   (SetExpr, EditExpr, the relative-value commands and ConnectSource: fcurveLayerMarkingTasksExpr.ts)
//
// How the contract is mapped onto this build:
//  * Animation layers are kept per model as an `AnimLayerSet` (`animLayersOf(app, model)`): `layers[0]` is the
//    base layer, `current` the current (keying) layer index. The scene root's set is the long-standing
//    `app.anim.layers` / `app.anim.currentLayer` pair (now with the base layer at index 0); other models have
//    their own set. The mixer's layer tracks and layer clips are not separate scene objects here: a layer
//    record carries its track name, and the native sub-tasks a command runs are listed in
//    `app.fcurveLayerMarkingTasks.subTasks` (last command).
//  * The marked-parameter list is `app.anim.marked` (a set of concrete parameters). A scripting path list is
//    resolved to parameters when the command runs; paths relative to the selection are (inferred, Q2).
//  * Task status codes that are not failures (0, 1) are kept in `app.fcurveLayerMarkingTasks.lastStatus`;
//    failure statuses are thrown as SiStatusError.
//  * Message texts of the XSIFCURVE ids are not resolved (Q1): log lines and errors carry the id.
//  * RePackArg: the output value is the command's return value (it is also put in the argument record, so the
//    command log shows it).
// Earlier registrations of these names (animateSurface.ts, anim.ts) are replaced here.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Model } from '../core/scene';
import { Parameter } from '../core/params';
import { FCurve } from '../core/animation';
import { SiStatusError } from './alembicSeqCam';
import { unset, boolArg, findNode, findObject, paramsOf } from './viewEditPropertyHelpers';
import { siName } from './characterKeySets';
import { registerFcurveLayerMarkingExprCommands, ExprEditorRecord, LinkRecord, Interpolator, ExpressionSource } from './fcurveLayerMarkingTasksExpr';

export const NOTE = 'docs/ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md';
export const S_OK = 0;
export const S_NOTHING = 1;
export const E_POINTER = 0x80004003;
export const E_FAIL = 0x80004005;
export const E_INVALIDARG = 0x80070057;
/** Class id of a layer track, also the Type handed to AddTrack. */
export const LAYER_TRACK_TYPE = '{d9fa2370-650f-43a8-88e9-634e731639ea}';

/** One animation (keying) layer of a model. Index 0 of a set is the base layer. */
export interface AnimLayer {
  name: string;
  locked: boolean;
  /** Name of the mixer track that holds the layer ("<Name>Track" or "LayerTrack1"); the base layer has none. */
  trackName?: string;
  /** Track parameter (0x402, 8), set on the original layer by DuplicateAnimationLayer. */
  trackParam8?: boolean;
  /** The layer track's `mute` parameter: position 8 of the track's parameter list (mapping inferred in the note from the spdl order). */
  mute?: boolean;
}
/** The animation layers of one model. */
export interface AnimLayerSet {
  readonly model: Model;
  /** `layers[0]` is the base layer; it is always present. */
  readonly layers: AnimLayer[];
  /** Index of the current (keying) layer, 0 = base layer. */
  current: number;
}
export interface SubTaskRecord { task: string; args: Record<string, any> }
export interface FcurveLayerMarkingState {
  lastStatus: { command: string; status: number } | null;
  /** Native sub-tasks the last command of this row ran, in order (AddTrack, AddLayerClip, SetValue, ...). */
  subTasks: SubTaskRecord[];
  /** The layer set of a model; no argument or null = the scene root. */
  layersOf(model?: Model | null): AnimLayerSet;
  /** The layer set of the model that owns an object, parameter or path (the scene root when it has none). */
  layersFor(item: unknown): AnimLayerSet;
  /** Seam for `CSILockStatus::CanBeLocked` on a layer clip (no lock system in this build): null = always yes. */
  canBeLocked: ((model: Model, layer: number) => boolean) | null;
  /** Seam: the preference that switches the SetExpr cycle test off (generic object {b54dca74-...} slot 39, Q5). */
  skipCycleCheck: boolean;
  /** The expression editor view as EditExpr left it. */
  exprEditor: ExprEditorRecord | null;
  /** Link data of a parameter whose expression is a link (kind 3 or 4), null otherwise. */
  linkOf(p: Parameter): LinkRecord | null;
  /** The interpolator of a parameter driven by a multi-link expression, null otherwise. */
  interpolatorOf(p: Parameter): Interpolator | null;
  /** The expression source object of a parameter that has an expression, null otherwise. */
  expressionOf(p: Parameter): ExpressionSource | null;
}
export const stateOf = (app: App): FcurveLayerMarkingState => (app as any).fcurveLayerMarkingTasks;

// ------------------------------------------------------------------ small helpers
/** Scripting path of an object, node or parameter ("cube.kine.local.posx"). */
export const pathOf = (x: Parameter | Node): string => siName(x);
export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
/** A message id whose text was not resolved (Q1). */
export const msgId = (id: number) => `message ${hex(id)}; text not yet attested, Q1`;
export function fail(status: number, what: string, id?: number): SiStatusError {
  return new SiStatusError(status, id === undefined ? what : `${what} (${msgId(id)})`);
}
export function setStatus(app: App, command: string, status: number): void { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, question = ''): void {
  app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
}
/** SILogMessage: severity 2 = error, 4 = warning. */
export function logMessage(app: App, command: string, severity: 2 | 4, what: string, id: number): void {
  if (severity === 2) app.logMsg('error', `${command}: ${what} (${msgId(id)})`);
  else app.logMsg('info', `WARNING : ${command}: ${what} (${msgId(id)})`);
}
export function subTask(app: App, task: string, args: Record<string, any>): void { stateOf(app).subTasks.push({ task, args }); }
export function writeBack<T>(a: Record<string, any>, name: string, v: T): T { a[name] = v; return v; }

/** Items of a list argument: an array, a comma separated string, or one value. */
export function listOf(arg: any): any[] {
  if (unset(arg)) return [];
  if (Array.isArray(arg)) return arg.flatMap(listOf);
  if (typeof arg === 'string') return arg.split(',').map(s => s.trim()).filter(Boolean);
  if (typeof arg === 'object' && !(arg instanceof Node) && !(arg instanceof Parameter) && typeof (arg as any)[Symbol.iterator] === 'function') return [...arg as Iterable<any>].flatMap(listOf);
  return [arg];
}
/** The 3D object that owns a node or a parameter. */
export function ownerObject(x: unknown): X3DObject | null {
  let n: any = x instanceof Parameter ? x.owner : x;
  while (n && !(n instanceof X3DObject)) n = n.parent;
  return n instanceof X3DObject ? n : null;
}
/** The 3D object one list item stands for: an object, a node, a parameter, or a path that starts with an object name. */
export function objectOfItem(app: App, x: unknown): X3DObject | null {
  if (x instanceof Parameter || x instanceof Node) return ownerObject(x);
  if (typeof x !== 'string' || !x) return null;
  const n = findNode(app, x); if (n) return ownerObject(n);
  const parts = x.split('.');
  for (let i = parts.length - 1; i >= 1; i--) { const o = findObject(app, parts.slice(0, i).join('.')); if (o) return o; }
  return null;
}
const modelOf = (app: App, o: X3DObject | null): Model | null => o ? (o instanceof Model ? o : o.model ?? app.scene.root) : null;

/**
 * Parameters named by a path list: parameter objects, full paths, paths relative to the selected objects
 * (inferred, Q2), the kinematics compounds "kine.local.pos" / "rot" / "scl" (inferred), and, as the earlier
 * registration did, an object, which stands for its animatable local transform parameters (inferred).
 */
export function paramsOfList(app: App, arg: any): { found: Parameter[]; missing: string[] } {
  const found: Parameter[] = [], missing: string[] = [];
  const add = (ps: Parameter[]) => { for (const p of ps) if (!found.includes(p)) found.push(p); return ps.length > 0; };
  const localOf = (o: X3DObject) => o.kinematics.local.params.filter(p => p.animatable && !p.def.readOnly);
  for (const x of listOf(arg)) {
    if (x instanceof Parameter) { add([x]); continue; }
    if (x instanceof X3DObject) { add(localOf(x)); continue; }
    if (typeof x !== 'string') { missing.push(String(x)); continue; }
    if (add(paramsOf(app, app.selectedObjects, [x]).found)) continue;
    const parts = x.split('.'); const named = parts.length > 1 ? findObject(app, parts[0]) : undefined;
    const rel = named ? parts.slice(1) : parts; const owners = named ? [named] : app.selectedObjects;
    const stem = rel[rel.length - 1]; const mid = rel.slice(0, -1).join('.').toLowerCase();
    if (mid === 'kine.local' || mid === 'kine.global') {
      const hit = owners.flatMap(o => (mid === 'kine.local' ? o.kinematics.local : o.kinematics.global).params.filter(p => p.def.name.length === stem.length + 1 && p.def.name.startsWith(stem)));
      if (add(hit)) continue;
    }
    const o = findObject(app, x);
    if (o && add(localOf(o))) continue;
    missing.push(x);
  }
  return { found, missing };
}

// ------------------------------------------------------------------ animation layer state
const layerSets = new WeakMap<Model, AnimLayerSet>();
const baseLayer = (): AnimLayer => ({ name: '', locked: false });
/** The layer set of a model (default: the scene root). The base layer is created on first use. */
export function animLayersOf(app: App, model?: Model | null): AnimLayerSet {
  const m = model ?? app.scene.root;
  if (m === app.scene.root) {
    const layers = app.anim.layers as AnimLayer[];
    if (!layers.length) layers.push(baseLayer());
    if (!(app.anim.currentLayer >= 0 && app.anim.currentLayer < layers.length)) app.anim.currentLayer = 0;
  }
  let set = layerSets.get(m);
  if (!set) {
    set = m === app.scene.root
      ? { model: m, layers: app.anim.layers as AnimLayer[], get current() { return app.anim.currentLayer; }, set current(i: number) { app.anim.currentLayer = i; } }
      : { model: m, layers: [baseLayer()], current: 0 };
    layerSets.set(m, set);
  }
  return set;
}
/** The current (keying) layer index and lock state seen from any object, parameter or path. */
export function animLayersFor(app: App, item: unknown): AnimLayerSet {
  return animLayersOf(app, modelOf(app, objectOfItem(app, item)));
}

/** Model list normalisation of the layer tasks: empty = scene root; each item gives its model once; unknown items are skipped. */
function normalisedModels(app: App, arg: any): Model[] {
  const items = listOf(arg);
  if (!items.length) return [app.scene.root];
  const out: Model[] = [];
  for (const x of items) { const m = modelOf(app, objectOfItem(app, x)); if (m && !out.includes(m)) out.push(m); }
  return out;
}
/** Undoable edit of the layer sets of some models: the sets are put back as they were on undo. A command that changes nothing records nothing. */
function editLayers(app: App, label: string, models: Model[], mutate: () => void): void {
  const sets = [...new Set(models)].map(m => animLayersOf(app, m));
  const take = () => sets.map(s => ({ layers: s.layers.map(l => ({ ...l })), current: s.current }));
  const put = (snap: ReturnType<typeof take>) => sets.forEach((s, i) => { s.layers.splice(0, s.layers.length, ...snap[i].layers.map(l => ({ ...l }))); s.current = snap[i].current; });
  const olds = take();
  try { mutate(); } catch (e) { put(olds); throw e; }   // a failing step leaves nothing behind
  const news = take();
  if (JSON.stringify(news) === JSON.stringify(olds)) return;
  app.record(label, () => put(news), () => put(olds));
  app.events.emit('params');
}
const resolveLayer = (set: AnimLayerSet, layer: number) => layer < 0 ? set.current : layer;
const layerPath = (set: AnimLayerSet, i: number) => `${pathOf(set.model)}.Mixer.${set.layers[i].trackName ?? `Layer${i}`}`;
/** The closing "invalid layer index" message of the editing tasks: a warning when something was done, an error otherwise. */
function invalidIndex(app: App, command: string, flagged: Model[], done: number): void {
  if (flagged.length) logMessage(app, command, done ? 4 : 2, `invalid layer index for ${flagged.map(m => pathOf(m)).join(', ')}`, 0x27);
}
const intArg = (v: any, dflt: number) => { const n = Number(v); return unset(v) || !Number.isFinite(n) ? dflt : Math.trunc(n); };

/** The worker of SetCurrentAnimationLayer on one model (also run as a sub-task by Add / Delete / Duplicate). */
function setCurrentOn(app: App, set: AnimLayerSet, layer: number, create: boolean): 'done' | 'invalid' {
  if (create) while (layer >= set.layers.length) { set.layers.push({ name: '', locked: false }); subTask(app, 'AddLayerClip', { Model: pathOf(set.model), Track: null, Name: null }); }
  if (layer >= set.layers.length) return 'invalid';
  if (set.current !== layer) { set.current = layer; subTask(app, 'SetValue', { Target: `${pathOf(set.model)}.Mixer current layer (0x402, 10)`, Value: layer }); }
  return 'done';
}

function getLayerNumber(app: App, command: string, a: Record<string, any>, pick: (s: AnimLayerSet) => number): number {
  const items = listOf(a.InputObjs);
  // inferred (Q6): the corehelper helper takes the scene root for an empty list and the first item's model otherwise
  if (items.length > 1) logNya(app, command, 'which model the helper uses for a list of several items; the first is used', 'Q6');
  const set = items.length ? animLayersFor(app, items[0]) : animLayersOf(app);
  setStatus(app, command, S_OK);
  return writeBack(a, 'Value', pick(set));
}

function setCurrentAnimationLayer(app: App, a: Record<string, any>): void {
  const C = 'SetCurrentAnimationLayer';
  const layer = intArg(a.Layer, 0); const create = boolArg(a.CreateLayer);
  if (layer < 0) throw fail(E_INVALIDARG, `${C}: Layer is negative`);
  const items = listOf(a.InputObjs);
  // every item is used directly as the model (no de-duplication); an item that is not a model stands for its model (inferred)
  const models = items.length ? items.map(x => modelOf(app, objectOfItem(app, x))).filter((m): m is Model => !!m) : [app.scene.root];
  const flagged: Model[] = []; let done = 0;
  editLayers(app, C, models, () => {
    for (const m of models) { if (setCurrentOn(app, animLayersOf(app, m), layer, create) === 'done') done++; else flagged.push(m); }
  });
  invalidIndex(app, C, flagged, done);
  setStatus(app, C, done ? S_OK : S_NOTHING);
}

function addAnimationLayer(app: App, a: Record<string, any>): void {
  const C = 'AddAnimationLayer';
  const name = unset(a.Name) ? '' : String(a.Name); const makeCurrent = unset(a.MakeCurrent) ? true : boolArg(a.MakeCurrent);
  const models = normalisedModels(app, a.InputObjs);
  editLayers(app, C, models, () => {
    for (const m of models) {
      const set = animLayersOf(app, m);
      const p = Math.min(set.current + 1, set.layers.length);   // directly above the current layer
      const trackName = name ? `${name}Track` : 'LayerTrack1';
      // the insert position among the mixer tracks (step 2) has no counterpart: tracks are not separate objects here
      subTask(app, 'AddTrack', { Model: pathOf(m), Type: LAYER_TRACK_TYPE, Name: trackName });
      subTask(app, 'AddLayerClip', { Model: pathOf(m), Track: trackName, Name: name });
      set.layers.splice(p, 0, { name, locked: false, trackName });
      if (makeCurrent) {
        // F3DEnableMixerOnDelta for a referenced model (inferred): this build has no referenced models
        subTask(app, 'SetCurrentAnimationLayer', { InputObjs: pathOf(m), Layer: p, CreateLayer: false });
        setCurrentOn(app, set, p, false);
      }
    }
  });
  setStatus(app, C, S_OK);
}

function deleteAnimationLayer(app: App, a: Record<string, any>): void {
  const C = 'DeleteAnimationLayer';
  const models = normalisedModels(app, a.InputObjs); const flagged: Model[] = []; let done = 0;
  editLayers(app, C, models, () => {
    for (const m of models) {
      const set = animLayersOf(app, m); const i = resolveLayer(set, intArg(a.Layer, -1));
      if (i < 1 || i >= set.layers.length) { flagged.push(m); continue; }
      if (i === set.layers.length - 1) {   // topmost layer: the current layer moves down first, whichever layer was current
        subTask(app, 'SetCurrentAnimationLayer', { InputObjs: pathOf(m), Layer: i - 1, CreateLayer: false });
        setCurrentOn(app, set, i - 1, false);
      }
      subTask(app, 'DeleteObj', { InputObj: layerPath(set, i) });
      set.layers.splice(i, 1); done++;
      if (i < set.layers.length && set.current > i) {
        // inferred: the current layer index goes down with its layer when a layer below it is deleted
        set.current--; logNya(app, C, `how the current layer index of ${pathOf(m)} follows the deletion of a layer below it; it is moved down with its layer`);
      }
    }
  });
  invalidIndex(app, C, flagged, done);
  setStatus(app, C, done ? S_OK : S_NOTHING);   // read: 0 when at least one layer was deleted, 1 otherwise
}

/** `_copy` is appended only when the name does not already contain it. An unnamed (default-named) item stays unnamed. */
const withCopy = (name: string | undefined): string | undefined => !name ? name : name.includes('_copy') ? name : `${name}_copy`;   // inferred: unnamed stays unnamed
type LayerCurves = Map<number, Map<Parameter, FCurve>>;
/** The fcurves of the layers above the base layer (kept by the CMD-B8a row): layer index -> parameter -> fcurve. */
const layerCurvesOf = (app: App): LayerCurves | null => (app as any).fcurveKeyTasks?.layerCurves ?? null;
function cloneCurve(fc: FCurve): FCurve {
  const c = new FCurve(fc.param);
  c.keys = fc.keys.map(k => ({ ...k })); c.extrap = fc.extrap; c.interp = fc.interp; c.muted = fc.muted;
  c.activeStart = fc.activeStart; c.activeEnd = fc.activeEnd; c.inactiveRanges = fc.inactiveRanges.map(r => [...r] as [number, number]);
  return c;
}
/**
 * Layer Clip Helper, commit with the duplicate flag, on the layer content: the items of layer `i` of a model (one
 * fcurve per layered parameter) are duplicated under the same parameters into layer `i + 1`; the layers above move
 * up by one. Returns the number of duplicated items.
 */
function duplicateLayerContent(app: App, m: Model, i: number): number {
  const lc = layerCurvesOf(app); if (!lc) return 0;
  const mine = (p: Parameter) => modelOf(app, ownerObject(p)) === m;
  const top = Math.max(0, ...lc.keys());
  for (let l = top; l > i; l--) {
    const from = lc.get(l); if (!from) continue;
    let to = lc.get(l + 1);
    for (const [p, fc] of [...from]) if (mine(p)) { if (!to) { to = new Map(); lc.set(l + 1, to); } to.set(p, fc); from.delete(p); }
  }
  let n = 0; const src = lc.get(i);
  if (src) for (const [p, fc] of [...src]) if (mine(p)) { let to = lc.get(i + 1); if (!to) { to = new Map(); lc.set(i + 1, to); } to.set(p, cloneCurve(fc)); n++; }
  return n;
}

function duplicateAnimationLayer(app: App, a: Record<string, any>): void {
  const C = 'DuplicateAnimationLayer';
  const models = normalisedModels(app, a.InputObjs); const flagged: Model[] = []; let done = 0;
  // the layer content is put back as it was on undo
  const lc = layerCurvesOf(app);
  const takeCurves = () => lc ? new Map([...lc].map(([l, mp]) => [l, new Map(mp)] as [number, Map<Parameter, FCurve>])) : null;
  const putCurves = (snap: ReturnType<typeof takeCurves>) => { if (!lc || !snap) return; lc.clear(); for (const [l, mp] of snap) lc.set(l, new Map(mp)); };
  const oldCurves = takeCurves();
  let items = 0;
  try {
    editLayers(app, C, models, () => {
      for (const m of models) {
        const set = animLayersOf(app, m); const i = resolveLayer(set, intArg(a.Layer, -1));
        if (i < 1 || i >= set.layers.length) { flagged.push(m); continue; }   // the base layer cannot be duplicated
        const src = set.layers[i]; const clip = layerPath(set, i);
        // 3. Layer Clip Helper: register the clip, commit with the duplicate flag 1. The copy is unlocked and sits
        //    directly above the original, so it is layer i + 1 and the layers above move up by one.
        const copy: AnimLayer = { name: withCopy(src.name) ?? '', locked: false, trackName: withCopy(src.trackName) };
        const n = duplicateLayerContent(app, m, i); items += n;
        set.layers.splice(i + 1, 0, copy);
        subTask(app, '{42eb14da-bcab-4e24-bee6-b8a0bb496c3a}', { Clip: clip, Flag: 1, Items: n, NewTrack: copy.trackName ?? null, NewClip: copy.name, Layer: i + 1 });
        // 4. track parameter (0x402, 8) of the original track = mute (by spdl position, inferred in the note)
        subTask(app, 'SetValue', { Target: `${clip} (0x402, 8)`, Value: true });
        src.trackParam8 = true; src.mute = true;
        // 5. the copy becomes the current layer
        subTask(app, 'SetCurrentAnimationLayer', { InputObjs: pathOf(m), Layer: i + 1, CreateLayer: false });
        setCurrentOn(app, set, i + 1, false);
        done++;
      }
    });
  } catch (e) { putCurves(oldCurves); throw e; }
  if (items || (done && lc && lc.size)) {
    const newCurves = takeCurves();
    app.record(C, () => putCurves(newCurves), () => putCurves(oldCurves));
  }
  invalidIndex(app, C, flagged, done);
  setStatus(app, C, done ? S_OK : S_NOTHING);   // read: 0 when at least one layer was duplicated, 1 when none was
}

function lockAnimationLayer(app: App, C: string, a: Record<string, any>, dfltLock: boolean): void {
  const layer = intArg(a.Layer, -1); const doLock = unset(a.DoLock) ? dfltLock : boolArg(a.DoLock);
  if (layer === 0) { logMessage(app, C, 2, 'the base layer cannot be locked or unlocked', 0x27); setStatus(app, C, S_NOTHING); return; }
  const models = normalisedModels(app, a.InputObjs); const flagged: Model[] = []; let done = 0;
  const can = stateOf(app).canBeLocked;
  editLayers(app, C, models, () => {
    for (const m of models) {
      const set = animLayersOf(app, m); const i = resolveLayer(set, layer);
      if (!(i > 0 && i < set.layers.length)) { flagged.push(m); continue; }
      const l = set.layers[i];
      if (l.locked === doLock) { logMessage(app, C, 4, `${layerPath(set, i)} is already ${doLock ? 'locked' : 'unlocked'}`, doLock ? 0x32 : 0x33); continue; }
      // inferred: the failure status of the per-clip step ends the command
      if (can && !can(m, i)) { logMessage(app, C, 2, `${layerPath(set, i)} cannot be ${doLock ? 'locked' : 'unlocked'}`, doLock ? 0x34 : 0x35); throw fail(E_FAIL, `${C}: ${layerPath(set, i)}`, doLock ? 0x34 : 0x35); }
      subTask(app, doLock ? 'Lock' : 'Unlock', { InputObjs: `${layerPath(set, i)} time control, ${layerPath(set, i)} child 2`, Level: 0xffff, SubType: 2 });
      l.locked = doLock; done++;
    }
  });
  invalidIndex(app, C, flagged, done);
  setStatus(app, C, done ? S_OK : S_NOTHING);
}

function isAnimationLayerLocked(app: App, a: Record<string, any>): boolean {
  const C = 'IsAnimationLayerLocked'; const layer = intArg(a.Layer, -1);
  setStatus(app, C, S_OK);   // Q3
  if (layer === 0) { logMessage(app, C, 2, 'the base layer has no lock state', 0x27); return writeBack(a, 'Value', false); }
  const models = normalisedModels(app, a.InputObjs);
  if (!models.length) return writeBack(a, 'Value', false);
  if (models.length > 1) logMessage(app, C, 4, `more than one model; only ${pathOf(models[0])} is examined`, 0x36);
  const set = animLayersOf(app, models[0]); const i = resolveLayer(set, layer);
  if (!(i > 0 && i < set.layers.length)) { logMessage(app, C, 2, `invalid layer index for ${pathOf(models[0])}`, 0x27); return writeBack(a, 'Value', false); }
  return writeBack(a, 'Value', !!set.layers[i].locked);
}

// ------------------------------------------------------------------ marking
type MarkMode = 'set' | 'add' | 'remove';
function marking(app: App, C: string, mode: MarkMode, a: Record<string, any>): void {
  const raw = a.PathList;
  // no string at all: nothing is stored and Do answers 1. An empty string is a marking string (clear), Q2.
  if (raw === undefined || raw === null) { setStatus(app, C, S_NOTHING); return; }
  const { found, missing } = paramsOfList(app, raw);
  const empty = listOf(raw).length === 0;
  // inferred: the path list conversion answers 0x80070057 when the list names no parameter at all
  if (!empty && !found.length) throw fail(E_INVALIDARG, `${C}: bad PathList "${missing.join(',')}"`, 0x9f);
  if (missing.length) logNya(app, C, `marking of "${missing.join(',')}" (no such parameter here; relative marking is kept by the path conversion helpers)`, 'Q2');
  const M = app.anim.marked; const prev = [...M];
  const put = (list: Parameter[]) => { M.clear(); for (const p of list) M.add(p); };
  app.record(C, () => {
    if (mode === 'set') put(found);                                  // empty = DSResetMarkedParameters, else DSSetMarkedParameters
    else if (mode === 'add') for (const p of found) M.add(p);       // DSAddMarkedParameters
    else for (const p of found) M.delete(p);                         // DSRemoveMarkedParameters
  }, () => put(prev));
  app.events.emit('params');
  setStatus(app, C, S_OK);
}
function getMarking(app: App, a: Record<string, any>): string[] | null {
  setStatus(app, 'GetMarking', S_NOTHING);   // Do returns 1
  if (!app.anim.marked.size) return null;    // no marking string: the argument keeps its empty value
  return writeBack(a, 'PathList', [...app.anim.marked].map(p => pathOf(p)));
}

// ------------------------------------------------------------------ registration
export function registerFcurveLayerMarkingCommands(app: App) {
  const state: FcurveLayerMarkingState = {
    lastStatus: null, subTasks: [],
    layersOf: (model) => animLayersOf(app, model),
    layersFor: (item) => animLayersFor(app, item),
    canBeLocked: null, skipCycleCheck: false, exprEditor: null,
    linkOf: () => null, interpolatorOf: () => null, expressionOf: () => null,   // filled in by the expression half
  };
  (app as any).fcurveLayerMarkingTasks = state;
  animLayersOf(app);   // the scene root always has its base layer
  // a new scene has a new root model: its layers start again from the base layer
  app.events.on('newscene', () => { app.anim.layers.splice(0, app.anim.layers.length); app.anim.currentLayer = 0; animLayersOf(app); });
  /** Every command of the row starts with an empty sub-task trace. */
  const reg = (def: CommandDef) => { const run = def.execute; app.register({ ...def, execute: (app, a) => { state.subTasks = []; return run(app, a); } }); };
  const IN = { name: 'InputObjs', default: null };
  const A = 'Animation';

  reg({ name: 'GetCurrentAnimationLayer', label: 'Get Current Animation Layer', category: A, description: 'Get current animation layer', undoable: false,
    args: [IN, { name: 'Value', default: null }], execute: (app, a) => getLayerNumber(app, 'GetCurrentAnimationLayer', a, s => s.current) });
  reg({ name: 'GetNumberOfAnimationLayers', label: 'Get Number Of Animation Layers', category: A, description: 'Get number of animation layers present', undoable: false,
    args: [IN, { name: 'Value', default: null }], execute: (app, a) => getLayerNumber(app, 'GetNumberOfAnimationLayers', a, s => s.layers.length) });
  reg({ name: 'SetCurrentAnimationLayer', label: 'Set Current Animation Layer', category: A,
    args: [IN, { name: 'Layer', default: 0 }, { name: 'CreateLayer', default: false }], execute: setCurrentAnimationLayer });
  reg({ name: 'AddAnimationLayer', label: 'Add Animation Layer', category: A,
    args: [IN, { name: 'Name', default: '' }, { name: 'MakeCurrent', default: true }], execute: addAnimationLayer });
  reg({ name: 'DeleteAnimationLayer', label: 'Delete Animation Layer', category: A,
    args: [IN, { name: 'Layer', default: -1 }], execute: deleteAnimationLayer });
  reg({ name: 'DuplicateAnimationLayer', label: 'Duplicate Animation Layer', category: A,
    args: [IN, { name: 'Layer', default: -1 }], execute: duplicateAnimationLayer });
  reg({ name: 'LockAnimationLayer', label: 'Lock Animation Layer', category: A,
    args: [IN, { name: 'Layer', default: -1 }, { name: 'DoLock', default: true }], execute: (app, a) => lockAnimationLayer(app, 'LockAnimationLayer', a, true) });
  reg({ name: 'UnlockAnimationLayer', label: 'Unlock Animation Layer', category: A,
    args: [IN, { name: 'Layer', default: -1 }, { name: 'DoLock', default: false }], execute: (app, a) => lockAnimationLayer(app, 'UnlockAnimationLayer', a, false) });
  reg({ name: 'IsAnimationLayerLocked', label: 'Is Animation Layer Locked', category: A, undoable: false,
    args: [IN, { name: 'Layer', default: -1 }, { name: 'Value', default: false }], execute: isAnimationLayerLocked });

  reg({ name: 'SetMarking', label: 'Set Marking', category: A, args: [{ name: 'PathList', default: null }], execute: (app, a) => marking(app, 'SetMarking', 'set', a) });
  // the same task as SetMarking; only the registry default of PathList ("") differs
  reg({ name: 'ClearMarking', label: 'Clear Marking', category: A, args: [{ name: 'PathList', default: '' }], execute: (app, a) => marking(app, 'ClearMarking', 'set', a) });
  reg({ name: 'AddToMarking', label: 'Add To Marking', category: A, args: [{ name: 'PathList', default: null }], execute: (app, a) => marking(app, 'AddToMarking', 'add', a) });
  reg({ name: 'RemoveFromMarking', label: 'Remove From Marking', category: A, args: [{ name: 'PathList', default: null }], execute: (app, a) => marking(app, 'RemoveFromMarking', 'remove', a) });
  reg({ name: 'GetMarking', label: 'Get Marked Parameters', category: A, undoable: false, args: [{ name: 'PathList', default: null }], execute: getMarking });

  registerFcurveLayerMarkingExprCommands(app, reg);
}
