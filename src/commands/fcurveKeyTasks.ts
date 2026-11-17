// Ledger row CMD-B8a. Brief: docs/ghidra/cmd-b8a-fcurve-keys-binary.md, "Wire contract" sections, "Shared facts" and
// the addendum. Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   key iterator   SaveKey SaveKeyOnKeyable SaveKeyOnMarkedKeyable RemoveKey RemoveKeyOnKeyable
//                  RemoveKeyOnMarkedKeyable NextKey PrevKey FirstKey LastKey SaveActionKey      (this file)
//   fcurve / info  IsAnimated GetSource EvalFCurve GetFCurveInfo GetKeyInfo AddFCurve SetCurveType
//                  ActivateFCurve ActivateFCurveOnKeyable ActivateFCurveOnMarkedKeyable RemoveAnimation
//                                                                              (fcurveKeyTasksCurves.ts)
//
// How the contract is mapped onto this build:
//  * Key times of this build are frames, so the task's frames/seconds conversion is the identity; tolerances are
//    frames. `Tolerance` -1 stands for half a frame wherever a tolerance is needed.
//  * Statuses that are not failures (0 done, 1 nothing done) are kept in `app.fcurveKeyTasks.lastStatus`; failure
//    statuses are thrown as SiStatusError. Dictionary messages are logged by id (texts are not in the contract, Q8)
//    and kept in `app.fcurveKeyTasks.messages`.
//  * Native entry and script wrapper (2.1). This row is the native entries. `SaveKey` and `SaveKeyOnKeyable` go on
//    the bus as the native entries (the wrapper-only `Source` argument is accepted and never read). For
//    `SaveKeyOnMarkedKeyable` and `SaveActionKey` the bus entry stays the script wrapper wired by CMD-B6a; this row
//    replaces the "native twin" that wrapper calls. Every native entry is also in `app.fcurveKeyTasks.native`.
//  * Animation layers belong to the sibling row. The helpers the tasks call (current keying layer, number of layers,
//    layer locked) are the seam `app.fcurveKeyTasks.layers`; fcurves of layers above the base are kept in
//    `app.fcurveKeyTasks.layerCurves`. Mixing layer offsets into the parameter value is not part of this row.
//  * An omitted `InputObjs` of a parameter-list command is the marked parameters (inferred). With nothing marked the
//    seam `legacyDefaultList` falls back to this build's Save Key command mapping, which the keyboard, the timeline
//    and the demo scene use; with the seam off the contract's "nothing to key" path runs.
//  * Not modelled, so those branches never fire: reference-model locks, parameter locks, time-mapped parameters,
//    reference-model delta sub-tasks, quaternion curves.
// Replaces the earlier inferred registrations of these names in index.ts, anim.ts and animateSurface.ts.
import { App, CommandDef } from '../core/commands';
import { Parameter } from '../core/params';
import { Property, type MixerClip, type MixerTransition } from '../core/scene';
import { clipWeightsAt } from '../core/mixer';
import type { Key } from '../core/animation';
import { stateOf as uixsiState } from './uixsiKeysSourcesMaterialsShared';
import {
  NOTE, S_OK, S_NOTHING, type Mode, stateOf, setStatus, logNya, message,
  timeArg, toleranceArg, layerArg, valueArg, truthy, workingList, objectOf,
  layerCurve, animatedValue, precheckSkips, keyNear, writeKey, removeKey,
} from './fcurveKeyTasksShared';
import { registerFcurveKeyTasksCurves } from './fcurveKeyTasksCurves';

export { NOTE };

const emit = (app: App) => { app.events.emit('params'); };
const KEY_ARGS = (list: any) => [
  { name: 'InputObjs', default: list }, { name: 'Time', default: null }, { name: 'Value', default: null }, { name: 'Tolerance', default: -1 },
  { name: 'Layer', default: -1 }, { name: 'ModifiedOnly', default: false }, { name: 'AutokeyScope', default: 0 }, { name: 'Source', default: 'FCurve' },
];
const REMOVE_ARGS = [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'Tolerance', default: -1 }, { name: 'Layer', default: -1 }];

// ====================================================================== SaveKey family
const isRotation = (p: Parameter) => /^rot[xyz]$/.test(p.name) && !!objectOf(p);

function saveKey(app: App, command: string, mode: Mode, a: Record<string, any>): void {
  const st = stateOf(app); const L = st.layers;
  // argument decoding (2.3, 2.4)
  let list = workingList(app, command, mode, a.InputObjs);
  const time = timeArg(app, a.Time);
  const tol = toleranceArg(app, command, a.Tolerance);
  const value = valueArg(a.Value);
  const modifiedOnly = truthy(a.ModifiedOnly);
  const scope = Math.trunc(Number(a.AutokeyScope) || 0);
  const layerOf = (_p: Parameter) => layerArg(app, a.Layer);

  // 2. list pre-pass
  const locked: Parameter[] = [], refused: Parameter[] = [], noEntry: Parameter[] = [], noLayer: Parameter[] = [];
  const accepted: Parameter[] = [];
  const current = new Map<Parameter, number>(), animated = new Map<Parameter, number>();
  for (const p of list) {
    const layer = layerOf(p);
    if (layer !== 0 && L.locked(layer)) { locked.push(p); continue; }                    // b
    if (layer > 0 && st.layerKeyRefused?.(p)) { refused.push(p); continue; }             // c
    if (layer !== 0 && st.noLayerMixerEntry?.(p)) { noEntry.push(p); continue; }         // d
    if (layer >= L.count()) { noLayer.push(p); continue; }                               // e
    if (accepted.includes(p)) continue;                                                  // f
    if (value === null || modifiedOnly) { current.set(p, Number(p.value)); animated.set(p, animatedValue(app, p, time)); }   // g
    accepted.push(p);
  }
  list = accepted;
  // 3. warnings, once per category
  if (locked.length) message(app, command, 0x30, 4, locked);
  if (refused.length) message(app, command, 0x28, 4, refused);
  if (noEntry.length) message(app, command, 0x25, 4, noEntry);
  if (noLayer.length) message(app, command, 0x27, 4, noLayer);
  // 4. nothing left
  if (!list.length) {
    if (!locked.length && !noEntry.length && !noLayer.length) message(app, command, 0x26, null);
    setStatus(app, command, S_NOTHING); return;
  }
  // 6. per parameter
  let keyed = 0, eulerNoted = false, layerNoted = false;
  for (const p of list) {
    if (precheckSkips(app, p)) continue;
    const layer = layerOf(p);
    const fc = layerCurve(app, p, layer);
    if (scope !== 0) {
      if (!fc) continue;                                         // autokey scopes need an existing fcurve
      if (scope === 1 && !keyNear(fc, time, 0.5)) continue;      // scope 1: and an existing key at Time
    }
    const cur = current.get(p) ?? Number(p.value);
    if (modifiedOnly && fc && Math.abs(cur - (animated.get(p) ?? animatedValue(app, p, time))) <= 1e-9) continue;
    let v = value;
    if (layer > 0) {
      // a layer key stores the offset: current value minus animated value plus the layer curve's value at Time
      const base = value === null ? cur : value;
      const anim = animated.get(p) ?? animatedValue(app, p, time);
      let off = base - anim + (fc && fc.keys.length ? fc.eval(time) : 0);
      if (p.def.type === 'bool') off = Math.max(-1, Math.min(1, Math.round(off)));
      v = off;
      if (isRotation(p) && !eulerNoted) { eulerNoted = true; logNya(app, command, 'the rotation composition of an Euler triple keyed on a layer; the plain per-axis offset is stored', 'Q9'); }
      if (!layerNoted) { layerNoted = true; logNya(app, command, `mixing the fcurves of layer ${layer} into the parameter value (the offset keys are stored only)`, 'CMD-B8b'); }
    }
    writeKey(app, 'Save key', p, layer, time, v, tol);
    keyed++;
  }
  setStatus(app, command, keyed ? S_OK : S_NOTHING);
  emit(app);
}

// ====================================================================== RemoveKey family
function removeKeys(app: App, command: string, mode: Mode, a: Record<string, any>): void {
  const st = stateOf(app); const L = st.layers;
  const all = workingList(app, command, mode, a.InputObjs);
  const time = timeArg(app, a.Time);
  const tol = toleranceArg(app, command, a.Tolerance);
  // 1. pre-pass: parameters on a locked keying layer are dropped with one warning
  const locked: Parameter[] = [], list: Parameter[] = [];
  for (const p of all) { const layer = layerArg(app, a.Layer); if (layer !== 0 && L.locked(layer)) locked.push(p); else if (!list.includes(p)) list.push(p); }
  if (locked.length) message(app, command, 0x31, 4, locked);
  if (!list.length) { setStatus(app, command, S_NOTHING); return; }   // silent
  // 2. per parameter
  let removed = 0;
  for (const p of list) {
    if (precheckSkips(app, p)) continue;
    const r = removeKey(app, 'Remove key', p, layerArg(app, a.Layer), time, tol);
    if (r.removed) removed++;
  }
  setStatus(app, command, removed ? S_OK : S_NOTHING);
  emit(app);
}

// ====================================================================== NextKey / PrevKey / FirstKey / LastKey
type Nav = 'NextKey' | 'PrevKey' | 'FirstKey' | 'LastKey';
/** The per-parameter search (virtual slot 29) of each of the four classes. */
const SEARCH: Record<Nav, (keys: Key[], time: number, tol: number) => number | undefined> = {
  NextKey: (keys, t, tol) => keys.find(k => k.time > t + tol)?.time,
  PrevKey: (keys, t, tol) => [...keys].reverse().find(k => k.time < t - tol)?.time,
  FirstKey: (keys) => keys[0]?.time,
  LastKey: (keys) => keys[keys.length - 1]?.time,
};
const SMALLEST: Record<Nav, boolean> = { NextKey: true, PrevKey: false, FirstKey: true, LastKey: false };

function navigate(app: App, command: Nav, a: Record<string, any>): number {
  const list = workingList(app, command, 0, a.InputObjs, true);
  const time = timeArg(app, a.Time);
  const tol = command === 'NextKey' || command === 'PrevKey' ? toleranceArg(app, command, a.Tolerance) : 0;   // so that a key at Time itself is not returned
  const layer = layerArg(app, a.Layer);
  let found: number | undefined;
  for (const p of list) {
    if (precheckSkips(app, p)) continue;
    const fc = layerCurve(app, p, layer);
    if (!fc || !fc.keys.length) continue;
    const t = SEARCH[command](fc.keys, time, tol);
    if (t === undefined) continue;
    if (found === undefined || (SMALLEST[command] ? t < found : t > found)) found = t;
  }
  if (found === undefined) {
    // the internal sentinel (plus or minus the largest double) leaves the frame conversion as a non-finite number
    setStatus(app, command, S_NOTHING);
    return SMALLEST[command] ? Infinity : -Infinity;
  }
  app.anim.frame = found;   // the playback object's current time
  setStatus(app, command, S_OK);
  return found;
}

// ====================================================================== SaveActionKey
interface ActionDriver { src: Property; path: string; localTime: number }
/**
 * Source lookup: the animation-mixer drivers of the parameter at a time. Exactly one active driver that is not
 * blended gives its fcurve and the time local to that clip; anything else gives no fcurve.
 */
function actionDriver(app: App, p: Parameter, time: number): ActionDriver | null {
  const o = objectOf(p); if (!o) return null;
  const hosts = [o.model as any, app.scene.root as any].filter((h, i, l) => h && l.indexOf(h) === i);
  const drivers: (ActionDriver & { weight: number })[] = [];
  for (const host of hosts) {
    const mix: Property | undefined = host.property?.('mixer');
    if (!mix || mix.val('Active') === false) continue;
    const clips: MixerClip[] = (mix as any).clips ?? []; const transitions: MixerTransition[] = (mix as any).transitions ?? [];
    const sources = new Map<string, Property>();
    for (const s of [...(host.properties ?? []), ...app.scene.root.properties]) if (s.type === 'actionsource') sources.set(s.name, s);
    for (const cw of clipWeightsAt(time, clips, transitions)) {
      const src = sources.get(cw.clip.source); if (!src) continue;
      let fcurves: Record<string, Key[]> = {};
      try { fcurves = JSON.parse(src.val('fcurves') || '{}'); } catch { /* not an fcurve action */ }
      const path = Object.keys(fcurves).find(k => k === p.fullName || k.endsWith('.' + p.fullName) || p.fullName.endsWith('.' + k));
      if (!path || !fcurves[path]?.length) continue;
      const clipIn = (cw.clip as any).timectrl?.clipin;
      drivers.push({ src, path, localTime: (typeof clipIn === 'number' ? clipIn : fcurves[path][0].time) + cw.localTime, weight: cw.weight });
    }
  }
  if (drivers.length !== 1 || Math.abs(drivers[0].weight - 1) > 1e-9) return null;
  return drivers[0];
}

function saveActionKey(app: App, a: Record<string, any>): void {
  const command = 'SaveActionKey';
  const list = workingList(app, command, 0, a.InputObjs);
  const time = timeArg(app, a.Time);
  const tol = toleranceArg(app, command, a.Tolerance);
  const value = valueArg(a.Value);
  let keyed = 0;
  for (const p of list) {
    const d = actionDriver(app, p, time);
    if (!d) continue;   // no single unblended driver: skipped without error
    const before = String(d.src.val('fcurves') ?? '{}');
    const all: Record<string, Key[]> = JSON.parse(before);
    const keys = all[d.path]; const t = d.localTime; const v = value === null ? Number(p.value) : value;
    const old = keyNear({ keys } as any, t, tol);
    const next = keys.filter(k => Math.abs(k.time - t) > tol);
    next.push(old ? { ...old, time: t, value: v, left: v + ((old.left ?? old.value) - old.value), right: v + ((old.right ?? old.value) - old.value) } : { time: t, value: v, left: v, right: v, interp: keys[0]?.interp });
    next.sort((x, y) => x.time - y.time);
    const after = JSON.stringify({ ...all, [d.path]: next });
    const put = (text: string) => { d.src.set('fcurves', text); };
    app.record('Save action key', () => put(after), () => put(before));
    keyed++;
  }
  setStatus(app, command, keyed ? S_OK : S_NOTHING);
  emit(app);
}

// ====================================================================== registration
export function registerFcurveKeyTasksCommands(app: App) {
  const st = stateOf(app);
  /** Put a native entry on the bus, or behind the script wrapper of the same name when CMD-B6a wired one. */
  const reg = (def: CommandDef) => {
    st.native[def.name] = def;
    const twins = uixsiState(app);
    if (twins.registered.includes(def.name) && def.name in twins.native) { twins.native[def.name] = def; return; }
    app.register(def); if (!st.registered.includes(def.name)) st.registered.push(def.name);
  };

  const save = (name: string, label: string, description: string, mode: Mode) => reg({
    name, label, category: 'Animation', description,
    args: KEY_ARGS(null),
    execute(app, a) { saveKey(app, name, mode, a); },
  });
  save('SaveKey', 'Save Key', 'Sets a key on marked parameters', 0);
  save('SaveKeyOnKeyable', 'Save Key On Keyable', 'Sets a key on the keyable parameters of the input objects', 1);
  save('SaveKeyOnMarkedKeyable', 'Save Key On Marked Keyable', 'Sets a key on the marked keyable parameters of the input objects', 2);

  const remove = (name: string, label: string, description: string, mode: Mode) => reg({
    name, label, category: 'Animation', description,
    args: REMOVE_ARGS.map(x => ({ ...x })),
    execute(app, a) { removeKeys(app, name, mode, a); },
  });
  remove('RemoveKey', 'Remove Key', 'Removes the key at a time on marked parameters', 0);
  remove('RemoveKeyOnKeyable', 'Remove Key On Keyable', 'Removes the key at a time on the keyable parameters of the input objects', 1);
  remove('RemoveKeyOnMarkedKeyable', 'Remove Key On Marked Keyable', 'Removes the key at a time on the marked keyable parameters of the input objects', 2);

  const nav = (name: Nav, label: string, tolerance: boolean) => reg({
    name, label, category: 'Animation', description: `Moves the current time to the ${label.toLowerCase()} of the marked parameters`,
    // undo / redo of the four go-to-key tasks were not read (Q6): the time change is not put on the undo stack
    undoable: false,
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, ...(tolerance ? [{ name: 'Tolerance', default: -1 }] : []), { name: 'Layer', default: -1 }],
    execute: (app, a) => navigate(app, name, a),
  });
  nav('NextKey', 'Next Key', true);
  nav('PrevKey', 'Previous Key', true);
  nav('FirstKey', 'First Key', false);
  nav('LastKey', 'Last Key', false);

  reg({
    name: 'SaveActionKey', label: 'Save Action Key', category: 'Animation', description: 'Sets a key in the fcurve of the action that drives the parameter',
    args: [{ name: 'InputObjs', default: null }, { name: 'Time', default: null }, { name: 'Value', default: null }, { name: 'Tolerance', default: -1 }],
    execute(app, a) { saveActionKey(app, a); },
  });

  registerFcurveKeyTasksCurves(app, reg);
}
