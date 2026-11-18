// Ledger row CMD-B8a, shared part. Brief: docs/ghidra/cmd-b8a-fcurve-keys-binary.md ("Shared facts" 2.1 to 2.6 and
// the addendum on the keyable-parameter helper). Original code written from that prose contract only.
//
// What lives here: the row's state (`app.fcurveKeyTasks`), status and message handling, the three ways a command
// chooses its parameter set (2.3), the scalar argument decoding (2.4), the keying-layer seam, and the two shared
// workers "key writer" and "key remover".
import { App, CommandDef } from '../core/commands';
import { FCurve, type Key } from '../core/animation';
import { Parameter, ParamSet } from '../core/params';
import { Node, X3DObject } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';
import { unset, findNode, findObject } from './viewEditPropertyHelpers';
import { findParam } from './index';
import { keyMappingTargets, keyTargets } from './anim';

export const NOTE = 'docs/ghidra/cmd-b8a-fcurve-keys-binary.md';
export const S_OK = 0;
export const S_NOTHING = 1;
export const E_NOTIMPL = 0x80004001;
export const E_NOINTERFACE = 0x80004002;
export const E_POINTER = 0x80004003;
export const E_FAIL = 0x80004005;
export const E_INVALIDARG = 0x80070057;

/** siSourceType values the contract tests: 1 selects fcurve sources (EvalFCurve), 4 is the RemoveAnimation fallback
 *  for siAnySource. The other names are the published SDK enum. */
export const SOURCE = { siFCurveSource: 1, siExpressionSource: 2, siAnySource: 4, siActionSource: 8, siShapeAnimationSource: 16, siConstraintSource: 32, siScriptedOperatorSource: 64 } as const;
/** siBranchFlag: 0 node, 1 branch, 3 unspecified (IsAnimated step 3). */
export const BRANCH = { siNode: 0, siBranch: 1, siInherited: 2, siUnspecified: 3 } as const;
/** siParameterScope: 1 and 2 are named in the batch-8 notes, 3 is the "every fcurve of the scene" value the code tests. */
export const SCOPE = { siInputParams: 1, siAnimatedParameters: 2 } as const;

/** How the parameter set is chosen (2.3). */
export type Mode = 0 | 1 | 2;

/** One logged XSIFCURVE dictionary message; the texts are not in the contract (Q8). */
export interface FcurveMessage { command: string; id: number; severity: number | null; names: string[] }

export interface KeyingLayerSeam {
  /** F3DGetCurrentKeyingLayer. */
  current(): number;
  /** F3DGetNbKeyingLayers. */
  count(): number;
  /** F3DIsKeyingLayerLocked. */
  locked(layer: number): boolean;
  /** The layer track's `mute` parameter (set on the original by DuplicateAnimationLayer): a muted layer adds nothing. */
  muted?(layer: number): boolean;
  /** Path of the layer, as named by RemoveAnimation's warning 0x37. */
  path?(layer: number): string;
}

export interface FcurveKeyTasksState {
  /** Non-failure task status of the last command of this row (0 done, 1 nothing done). */
  lastStatus: { command: string; status: number } | null;
  /** The native entries of the row by scripting name (also for the two names whose bus entry is the script wrapper). */
  native: Record<string, CommandDef>;
  /** Names registered on the bus by this row. */
  registered: string[];
  /** Output arguments of the last call, by command (RePackArg). */
  out: Record<string, Record<string, any>>;
  /** XSIFCURVE messages logged by the row, newest last. */
  messages: FcurveMessage[];
  /**
   * Seam for the default of an omitted `InputObjs` of the parameter-list commands. The contract (inferred) is "the
   * marked parameters". When true and nothing is marked, this build's Save Key command mapping (keyable transform
   * parameters of the selection) is used instead, which is what the keyboard, the timeline and the demo scene rely on.
   * Set false for the bare contract.
   */
  legacyDefaultList: boolean;
  /** Seam: animation layers as the keying helpers see them (owned by the sibling row; mapped onto `app.anim`). */
  layers: KeyingLayerSeam;
  /** Fcurves of animation layers above the base layer: layer index -> parameter -> fcurve. */
  layerCurves: Map<number, Map<Parameter, FCurve>>;
  /** Seam, SaveKey pre-pass c: the attribute e34e4618-... of a parameter is non-empty (identified by GUID only, Q8). */
  layerKeyRefused: ((p: Parameter) => boolean) | null;
  /** Seam, SaveKey pre-pass d: no mixer entry with filter 0x28 on the parameter or its parents (meaning not established). */
  noLayerMixerEntry: ((p: Parameter) => boolean) | null;
  /** Seam, precheck 2.5: the parameter answers the attribute query a7e8a2d0-... or is locked (not modelled). */
  skipParameter: ((p: Parameter) => boolean) | null;
  /** RemoveKey: the task flag at offset 0xe8 (origin not read): re-apply the removed key's value after the removal. */
  reapplyValueOnRemove: boolean;
  /** EvalFCurve: the result field when the parameter has no fcurve (constructor not read, Q5). */
  evalWithoutCurve: number;
}

export function stateOf(app: App): FcurveKeyTasksState {
  return ((app as any).fcurveKeyTasks ??= {
    lastStatus: null, native: {}, registered: [], out: {}, messages: [],
    legacyDefaultList: true,
    layers: {
      // inferred mapping onto the layer list of this build: layer i is `app.anim.layers[i]`, 0 is the base layer
      current: () => Math.max(0, app.anim.currentLayer),
      count: () => Math.max(1, app.anim.layers.length),
      locked: (i: number) => !!app.anim.layers[i]?.locked,
      muted: (i: number) => !!(app.anim.layers[i] as any)?.mute,
      path: (i: number) => `${app.scene.root.name}.Mixer.${(app.anim.layers[i] as any)?.trackName ?? `Layer${i}`}`,
    },
    layerCurves: new Map(), layerKeyRefused: null, noLayerMixerEntry: null, skipParameter: null,
    reapplyValueOnRemove: false, evalWithoutCurve: 0,
  } as FcurveKeyTasksState);
}

export const hex = (n: number) => '0x' + (n >>> 0).toString(16);
export function setStatus(app: App, command: string, status: number): void { stateOf(app).lastStatus = { command, status }; }
export function logNya(app: App, command: string, what: string, question = ''): void {
  app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`);
}
/** Log a dictionary message by id. Severity 2 error, 4 warning, 8 information; null = decided by an application mode the note does not name. */
export function message(app: App, command: string, id: number, severity: number | null, names: Parameter[] | string[] = [], dict = 'XSIFCURVE'): void {
  const list = (names as any[]).map(n => typeof n === 'string' ? n : n.fullName);
  stateOf(app).messages.push({ command, id, severity, names: list });
  const sev = severity === 2 ? 'error' : severity === 4 ? 'warning' : severity === 8 ? 'information' : 'severity 8 or 2';
  app.logMsg('info', `${command}: ${sev}, ${dict ? dict + ' ' : ''}message ${hex(id)} (text not yet attested, Q8)${list.length ? ': ' + list.join(', ') : ''}`);
}
export function fail(app: App, command: string, status: number, what: string, id?: number): SiStatusError {
  if (id !== undefined) stateOf(app).messages.push({ command, id, severity: 2, names: [] });
  return new SiStatusError(status, id === undefined ? `${command}: ${what}` : `${command}: ${what} (message ${hex(id)}; text not yet attested)`);
}

// ------------------------------------------------------------------ enums and scalars
/** A string enum argument (":siAnySource:siSourceType", "siAnySource", 4) read as a long. */
export function enumLong(v: any, table: Record<string, number>, fallback: number): number {
  if (typeof v === 'number') return v;
  if (unset(v)) return fallback;
  const s = String(v); let acc = 0, hit = false;
  for (const tok of s.split(/[:|+,\s]+/).filter(Boolean)) {
    if (tok in table) { acc |= table[tok]; hit = true; } else if (/^-?\d+$/.test(tok)) { acc |= Number(tok); hit = true; }
  }
  return hit ? acc : fallback;
}
export const truthy = (v: any): boolean => typeof v === 'string' ? /^(true|1|yes)$/i.test(v.trim()) : !!v;
/** `Time` in frames; an omitted time is the current frame (inferred from the time argument handler). */
export function timeArg(app: App, v: any): number { if (unset(v)) return app.anim.frame; const n = Number(v); return Number.isFinite(n) ? n : app.anim.frame; }
/**
 * `Tolerance` in frames (2.4): -1 or >= 0. Returns the tolerance to use: -1 stands for half a frame.
 * Key times of this build are frames, so the frames-to-seconds conversion of the task is the identity here.
 */
export function toleranceArg(app: App, command: string, v: any): number {
  const n = unset(v) ? -1 : Number(v);
  if (Number.isNaN(n) || (n < 0 && n !== -1)) throw fail(app, command, E_INVALIDARG, 'Tolerance must be -1 or >= 0', 0xb9);
  return n === -1 ? 0.5 : n;
}
/** `Layer`: negative = the current keying layer. */
export function layerArg(app: App, v: any): number { const n = unset(v) ? -1 : Math.trunc(Number(v)); return n < 0 || Number.isNaN(n) ? stateOf(app).layers.current() : n; }
/** `Value` of the key commands: empty = the parameter's current value (null here); numeric variants become a double; other types are left alone. */
export function valueArg(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

// ------------------------------------------------------------------ parameter sets (2.3)
export const isParam = (x: any): x is Parameter => x instanceof Parameter;
export function objectOf(p: Parameter): X3DObject | null {
  let n: any = p.owner;
  while (n && !(n instanceof X3DObject)) n = n.parent;
  return n instanceof X3DObject ? n : null;
}
const listOf = (arg: any): any[] => Array.isArray(arg) ? arg : typeof arg === 'string' ? arg.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [arg];
const COMPOUND = new Set(['pos', 'rot', 'scl']);

/** The parameter sets below a node: the node itself and, for an object, kinematics, properties, primitive and its operators. */
export function paramSetsOf(n: Node, local = false): ParamSet[] {
  if (!(n instanceof X3DObject)) return [n];
  const out: ParamSet[] = [n, n.kinematics.local];
  if (!local) out.push(n.kinematics.global);
  out.push(...n.properties);
  if (!local) for (const p of n.allProperties()) if (!out.includes(p)) out.push(p);
  if (n.primitive) { out.push(n.primitive); if (!local) out.push(...n.primitive.operators); }
  return out;
}
/** Leaves named by the last path segment inside one parameter set: exact, wildcard, or a pos / rot / scl compound. */
function leaves(set: ParamSet, leaf: string): Parameter[] {
  const exact = set.get(leaf); if (exact) return [exact];
  if (COMPOUND.has(leaf)) return ['x', 'y', 'z'].map(ax => set.get(leaf + ax)).filter(isParam);
  if (leaf.includes('*')) { const re = new RegExp('^' + leaf.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); return set.params.filter(p => re.test(p.name)); }
  return [];
}
function setOf(o: X3DObject, mid: string): ParamSet | undefined {
  const m = mid.toLowerCase();
  if (m === 'kine.local' || m === 'kinematics.local') return o.kinematics.local;
  if (m === 'kine.global' || m === 'kinematics.global') return o.kinematics.global;
  if (!mid) return o;
  const pr = o.allProperties().find(p => p.type === mid || p.name === mid || p.name.toLowerCase() === m); if (pr) return pr;
  if (o.primitive) {
    if (o.primitive.type === mid || o.primitive.name === mid) return o.primitive;
    const op = o.primitive.operators.find(x => mid.endsWith(x.type) || mid.endsWith(x.name)); if (op) return op;
  }
  return undefined;
}
/** Parameters named by one path relative to an object ("kine.local.posx", "kine.local.pos", "kine.local.scl.scl*"). */
export function relParams(o: X3DObject, rel: string): Parameter[] {
  const parts = rel.split('.').filter(Boolean); if (!parts.length) return [];
  const leaf = parts[parts.length - 1]; let mid = parts.slice(0, -1);
  let set = setOf(o, mid.join('.'));
  if (!set && mid.length && COMPOUND.has(mid[mid.length - 1])) { mid = mid.slice(0, -1); set = setOf(o, mid.join('.')); }   // "...local.scl.sclx": the compound is a path segment
  return set ? leaves(set, leaf) : [];
}
function owningObject(app: App, path: string): { o: X3DObject; rel: string } | null {
  const parts = path.split('.');
  for (let i = parts.length - 1; i >= 1; i--) { const o = findObject(app, parts.slice(0, i).join('.')); if (o) return { o, rel: parts.slice(i).join('.') }; }
  return null;
}

export interface ResolvedList { params: Parameter[]; nodes: Node[] }
/** Resolve the items of a parameter-list argument. Items that name an object rather than a parameter come back in `nodes`. */
export function resolveItems(app: App, arg: any): ResolvedList {
  const params: Parameter[] = [], nodes: Node[] = [];
  const add = (p: Parameter | undefined) => { if (p && !params.includes(p)) params.push(p); };
  for (const x of listOf(arg)) {
    if (isParam(x)) { add(x); continue; }
    if (x instanceof FCurve) { add(x.param); continue; }
    if (x instanceof Node) { if (!nodes.includes(x)) nodes.push(x); continue; }
    if (typeof x !== 'string' || !x) continue;
    if (x.startsWith('.')) { for (const o of app.selectedObjects) relParams(o, x).forEach(add); continue; }   // ".kine.local.posx": relative to the selection
    const direct = findParam(app, x); if (direct) { add(direct); continue; }
    const own = owningObject(app, x); const hit = own ? relParams(own.o, own.rel) : [];
    if (hit.length) { hit.forEach(add); continue; }
    const n = findNode(app, x); if (n && !nodes.includes(n)) nodes.push(n);
  }
  return { params, nodes };
}
/** Object list argument (handler 7834cb8c-...); an omitted argument is the selection (inferred). */
export function objectList(app: App, arg: any): Node[] {
  if (unset(arg)) return [...app.selection];
  const r = resolveItems(app, arg); const out = [...r.nodes];
  for (const p of r.params) { const o = objectOf(p) ?? (p.owner instanceof Node ? p.owner : null); if (o && !out.includes(o)) out.push(o); }
  return out;
}
/** Marked parameters that sit under the given nodes. */
export function markedUnder(app: App, nodes: Node[]): Parameter[] {
  return [...app.anim.marked].filter(p => nodes.some(n => n === p.owner || n === objectOf(p)));
}
/**
 * The addendum's keyable-parameter helper: the keyable parameters under the input objects, or with `markedOnly`
 * under the marked components of the input objects. Nothing marked gives an empty list (no fallback).
 */
export function keyableParams(app: App, nodes: Node[], markedOnly: boolean): Parameter[] {
  if (markedOnly) return markedUnder(app, nodes).filter(p => p.keyable);
  const out: Parameter[] = [];
  for (const n of nodes) for (const set of paramSetsOf(n)) for (const p of set.params) if (p.keyable && !out.includes(p)) out.push(p);
  return out;
}
/** Parameter list argument of the plain commands (handler fa0b5d32-...). */
export function parameterList(app: App, command: string, arg: any, navigation = false): Parameter[] {
  const st = stateOf(app);
  if (unset(arg) || (Array.isArray(arg) && !arg.length)) {
    // inferred: an omitted list is the marked parameters of the selection
    const marked = keyTargets(app, 'Marked');
    if (marked.length || !st.legacyDefaultList) return marked;
    const mapped = keyMappingTargets(app);
    if (mapped.length || !navigation) return mapped;
    return app.selection.length ? [] : [...app.anim.fcurves.keys()];   // legacy go-to-key: nothing selected walks every curve
  }
  const r = resolveItems(app, arg); const out = [...r.params];
  for (const n of r.nodes) {
    // an object in a parameter list: its marked parameters; legacy fallback its keyable local transform
    let ps = markedUnder(app, [n]);
    if (!ps.length && st.legacyDefaultList) ps = n instanceof X3DObject ? n.kinematics.local.params.filter(p => p.keyable) : n.params.filter(p => p.animatable && !p.def.readOnly);
    for (const p of ps) if (!out.includes(p)) out.push(p);
  }
  return out;
}
/** The working list of a command for its mode (2.3 steps 3 and 4). */
export function workingList(app: App, command: string, mode: Mode, arg: any, navigation = false): Parameter[] {
  return mode === 0 ? parameterList(app, command, arg, navigation) : keyableParams(app, objectList(app, arg), mode === 2);
}

// ------------------------------------------------------------------ fcurves, layers
/** The fcurve of a parameter in a keying layer (slot 25); layer 0 is the parameter's own fcurve source. */
export function layerCurve(app: App, p: Parameter, layer: number, create = false): FCurve | undefined {
  if (layer <= 0) return app.anim.fcurve(p, create);
  const st = stateOf(app); let m = st.layerCurves.get(layer);
  if (!m) { if (!create) return undefined; m = new Map(); st.layerCurves.set(layer, m); }
  let fc = m.get(p);
  if (!fc && create) { fc = new FCurve(p); m.set(p, fc); }
  return fc;
}
export function dropLayerCurve(app: App, p: Parameter, layer: number): void {
  if (layer <= 0) app.anim.fcurves.delete(p); else stateOf(app).layerCurves.get(layer)?.delete(p);
}
export function putLayerCurve(app: App, p: Parameter, layer: number, fc: FCurve): void {
  if (layer <= 0) { app.anim.fcurves.set(p, fc); return; }
  const st = stateOf(app); let m = st.layerCurves.get(layer); if (!m) { m = new Map(); st.layerCurves.set(layer, m); }
  m.set(p, fc);
}
/** Layers above the base that hold a curve for the parameter. */
export function layersOf(app: App, p: Parameter): number[] {
  return [...stateOf(app).layerCurves.entries()].filter(([, m]) => m.has(p)).map(([i]) => i).sort((a, b) => a - b);
}
/** The parameter's animated value at a time: base curve plus the layer offsets (inferred: layers add). */
export function animatedValue(app: App, p: Parameter, time: number): number {
  const base = app.anim.fcurve(p);
  let v = base && base.keys.length ? base.eval(time) : Number(p.value);
  const muted = stateOf(app).layers.muted;
  for (const l of layersOf(app, p)) { if (muted?.(l)) continue; const fc = layerCurve(app, p, l)!; if (fc.keys.length) v += fc.eval(time); }
  return v;
}
/** Precheck 2.5: true = skip this parameter (status 1, not an error). */
export function precheckSkips(app: App, p: Parameter): boolean { return !!stateOf(app).skipParameter?.(p); }

export const cloneKeys = (keys: Key[]): Key[] => keys.map(k => ({ ...k }));
/** The key nearest to `time` within `tol` frames. */
export function keyNear(fc: FCurve, time: number, tol: number): Key | undefined {
  let best: Key | undefined;
  for (const k of fc.keys) if (Math.abs(k.time - time) <= tol && (!best || Math.abs(k.time - time) < Math.abs(best.time - time))) best = k;
  return best;
}

/**
 * The shared key writer: ensure the fcurve, remember an existing key within the tolerance, keep its handles and
 * constraint flags around the write, set the key. One undoable step that restores the curve as it was.
 * `value` null = the parameter's current value.
 */
export function writeKey(app: App, label: string, p: Parameter, layer: number, time: number, value: number | null, tol: number): { existed: boolean; oldValue: number | null; created: boolean } {
  const had = layerCurve(app, p, layer);
  const fc = had ?? new FCurve(p);
  const before = cloneKeys(fc.keys);
  const v = value === null ? Number(p.value) : value;
  const near = keyNear(fc, time, tol);
  const res = { existed: !!near, oldValue: near ? near.value : null, created: !had };
  const oldParam = p.value;
  // the key's current value shows on the parameter when the key is at the current time (interaction node invalidated)
  const show = layer <= 0 && value !== null && time === app.anim.frame && !fc.muted;
  app.record(label, () => {
    if (!had) putLayerCurve(app, p, layer, fc);
    const keys = cloneKeys(before);
    const old = keyNear({ keys } as FCurve, time, tol);
    const kept = keys.filter(k => Math.abs(k.time - time) > tol);   // keys inside the tolerance merge into the one written
    const extra: Partial<Key> = old ? { left: v + ((old.left ?? old.value) - old.value), right: v + ((old.right ?? old.value) - old.value), interp: old.interp } : {};
    if (old && (old as any).constr !== undefined) (extra as any).constr = (old as any).constr;
    fc.keys = kept; fc.addKey(time, v, extra);
    if (show) p.value = p.def.type === 'bool' ? v !== 0 : v;
  }, () => {
    fc.keys = cloneKeys(before);
    if (!had) dropLayerCurve(app, p, layer);
    if (show) p.value = oldParam;
  });
  return res;
}

/**
 * The shared key remover. Returns what happened; nothing is recorded when there is no curve or no key in range.
 * The last key of a base-layer curve disconnects the curve from the parameter ("source removed").
 */
export function removeKey(app: App, label: string, p: Parameter, layer: number, time: number, tol: number): { removed: boolean; sourceRemoved: boolean; value: number | null } {
  const fc = layerCurve(app, p, layer);
  const near = fc ? keyNear(fc, time, tol) : undefined;
  if (!fc || !near) return { removed: false, sourceRemoved: false, value: null };
  const before = cloneKeys(fc.keys); const value = near.value; const at = near.time;
  const last = before.length === 1;
  const disconnect = last && layer <= 0;       // base-layer standard curve: the parameter becomes unanimated
  const dropLayerItem = last && layer > 0;     // a layer curve left without keys leaves the layer's action source (inferred)
  const reapply = stateOf(app).reapplyValueOnRemove; const oldParam = p.value;
  const shown = layersOf(app, p).length ? p.value : (p.def.type === 'bool' ? value !== 0 : value);
  app.record(label, () => {
    fc.keys = cloneKeys(before).filter(k => k.time !== at);
    if (disconnect || dropLayerItem) dropLayerCurve(app, p, layer);
    if (reapply) p.value = shown;
  }, () => {
    fc.keys = cloneKeys(before);
    if (disconnect || dropLayerItem) putLayerCurve(app, p, layer, fc);
    if (reapply) p.value = oldParam;
  });
  return { removed: true, sourceRemoved: disconnect, value };
}
