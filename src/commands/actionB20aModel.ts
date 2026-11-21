// Ledger row CMD-B20a: shared model and helpers of the action.dll / actioncore.dll mixer and action commands wired in
// actionB20a.ts. Brief: docs/ghidra/cmd-b20a-action-actioncore.md (section 3 "Wire contracts") and items 1-14 of the
// CMD-B20a section of docs/re/WIRE_CORRECTIONS_B20.md. Original code written from that prose only; no XSIBATCH golden
// exists for the row (the Desktop pass3 golden data/dump/si_mixer_transitions.json is used where it applies).
//
// How the contract is mapped onto this build:
//  * Failures are thrown as SiStatusError (status + message, message starts with the command name); S_FALSE and
//    other non-failure results are kept in `app.actionB20a.status[<command>]`.
//  * Time arguments are converted to seconds by Softimage when unpacked; this build keeps mixer and key times in
//    frames, so the frame values are used as they are.
//  * The mixer of this build keeps clips as records (`mix.clips`, `mix.compounds`, core/mixerActionScripts.ts) with a
//    numeric track index; there are no track objects. A Track argument is a track index, a track name
//    (`Mixer_Anim_Track<N>`), an AddTrack result (`{ name }`) or an object with an `index` field.
//  * A clip's "container" is the compound that holds it, or the mixer itself.
//  * Markers are MixerMarker nodes kept per container (a WeakMap, see markersOf); relations are records in `mix.relations`.
//  * Locks are the stand-in numeric `lockLevel` field (convention of actionB11fModel.ts).
//  * Sub-tasks the contract runs (AddTrack, CreateCompound, AddClip, AddTransition, DeleteObj, StripDeformOperators,
//    the mixer helper 6d89e10a) are performed in place and recorded in `app.actionB20a.subtasks`.
//  * What the contract marks (inferred) or leaves open is marked `// inferred` here; branches that cannot be settled
//    log "<command>: not yet attested: <what> (CMD-B20a)".
import { App, CommandDef } from '../core/commands';
import { Node, Property, Model, X3DObject, syncMixer } from '../core/scene';
import { num, str } from '../core/params';
import {
  mixerX, allModels, isActionSource, clipNode, ClipNode, compoundOf, clipType, editMixer, sourceFcurves, sourceFrameStart, uniqueClipName,
  T_CAMSHOT, isCompoundRecord, type ClipRef, type ClipX, type MixerX,
} from '../core/mixerActionScripts';
import { SiStatusError } from './alembicSeqCam';
import { allClipRefs, sourceArg, findNode } from './actionB11eModel';

export const ROW = 'CMD-B20a';
export const NOTE = 'docs/ghidra/cmd-b20a-action-actioncore.md';
export const S_OK = 0, S_FALSE = 1;
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005,
  E_UNEXPECTED = 0x8000ffff, E_RESTRICTED = 0x80004021;
/** File events fired by ExportAction (source + path, type 10). */
export const EV_EXPORT_BEGIN = 0x20510013, EV_EXPORT_END = 0x20510014;
/** XSIACTIONCORE message ids (texts not in the repository). */
export const MSG_RELATION_REFUSED = 0x16, MSG_ADDCLIP_NO_ROOM = 0x18, MSG_MOVE_NO_ROOM = 0x19, MSG_COPY_NO_ROOM = 0x1a;

export interface B20aState {
  status: Record<string, number>;
  subtasks: { command: string; task: string; args: Record<string, any> }[];
  fileEvents: { id: number; type: number; source: string; file: string }[];
  /** Handlers of the export file events: a returned failure, 1 or 0x562e80c7 skips the export (contract). */
  fileEventHandlers: ((e: { id: number; type: number; source: Property; file: string }) => number | void)[];
  /** Files written by ExportAction (path -> content in this build's own JSON form). */
  files: Record<string, string>;
  /** Stand-in for SIGetAppMode: true = restricted application mode (ExportAction raises simsgcat 0x143). */
  restrictedMode: boolean;
  out: Record<string, Record<string, any>>;
}
export function b20a(app: App): B20aState {
  return ((app as any).actionB20a ??= { status: {}, subtasks: [], fileEvents: [], fileEventHandlers: [], files: {}, restrictedMode: false, out: {} } as B20aState);
}
export const setStatus = (app: App, cmd: string, s: number) => { b20a(app).status[cmd] = s; };
export const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
export const logNya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
/** A numbered message of a dictionary whose texts are not in the repository (severity 2 = warning). */
export const logMsgId = (app: App, cmd: string, dict: string, id: number, detail = '') =>
  app.logMsg('info', `WARNING : ${cmd}: ${dict} message 0x${id.toString(16)}${detail ? `: ${detail}` : ''}`);
export const subtask = (app: App, command: string, task: string, args: Record<string, any> = {}) => { b20a(app).subtasks.push({ command, task, args }); };
export const unset = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
export const truthy = (v: any) => v === true || v === 1 || v === -1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
export const listOf = (v: any): any[] => (unset(v) ? [] : Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v]);
export const first = (v: any) => listOf(v)[0];
export const numArg = (v: any, d: number) => { const n = Number(v); return unset(v) || typeof v === 'boolean' || !Number.isFinite(n) ? d : n; };
export const lockLevel = (x: any): number => Number(x?.lockLevel ?? 0) | 0;

// ------------------------------------------------------------------ registry argument lists
/** data/command_registry.json (first entry of each scripting name; output-only arguments, flag 0x200, left out). */
export const ARGS: Record<string, { name: string; default: any }[]> = {
  EqualizeAction: [{ name: 'Source', default: null }, { name: 'Time', default: 0 }, { name: 'Duration', default: 0 }, { name: 'Name', default: '' }],
  ExportAction: [{ name: 'Action', default: null }, { name: 'FileName', default: null }],
  ImportRefAction: [{ name: 'Model', default: null }, { name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'ActionStorage', default: -1 }],
  ImportAction: [{ name: 'Model', default: null }, { name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'ActionStorage', default: 0 }],
  ReplaceShapeKey: [{ name: 'InputObj', default: null }, { name: 'OutputObj', default: null }, { name: 'ForceDeformStripping', default: false }],
  SIStoreAction: [{ name: 'Model', default: null }, { name: 'InputObj', default: null }, { name: 'Mode', default: 1 }, { name: 'Name', default: 'StoredAction' }, { name: 'RemoveAnim', default: true }, { name: 'Consider Time', default: false }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'Ripple', default: false }, { name: 'IncludeAnimLayers', default: false }, { name: 'Type', default: '' }],
  AddTransition: [{ name: 'From', default: null }, { name: 'To', default: null }, { name: 'Type', default: 0 }, { name: 'Name', default: 'Transition' }],
  AddMarker: [{ name: 'Model', default: null }, { name: 'Container', default: null }, { name: 'Time', default: null }, { name: 'Duration', default: 0 }, { name: 'Name', default: '' }],
  ReconnectMixer: [{ name: 'Model', default: null }],
  SwapRelationMasterAndSlaveClip: [{ name: 'Relation', default: null }],
  PlotToAction: [{ name: 'Model', default: null }, { name: 'InputObj', default: null }, { name: 'Name', default: '' }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'StepFrame', default: 1 }, { name: 'FCurve Kind', default: 20 }, { name: 'DefaultSegKind', default: 3 }, { name: 'Fit FCurve', default: false }, { name: 'Fit Tolerance', default: 0.01 }, { name: 'ProcessContRots', default: true }],
  ApplyAction: [{ name: 'Source', default: null }, { name: 'Target', default: null }, { name: 'Consider Time', default: false }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'Ripple', default: false }, { name: 'RemoveLayerAnimation', default: false }],
  GetDrivingActions: [{ name: 'InputObjs', default: null }, { name: 'Consider Time', default: false }, { name: 'Time', default: null }, { name: 'Keep Compound Actions', default: true }, { name: 'Keep Inactive Actions', default: false }],
  AddTWTransition: [{ name: 'From', default: null }, { name: 'To', default: null }, { name: 'From Period', default: 0 }, { name: 'To Period', default: 0 }, { name: 'Name', default: 'Bridge Transition' }],
  CollapseLayers: [{ name: 'Model', default: null }, { name: 'PlottingType', default: 1 }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'StepFrame', default: 1 }, { name: 'Fit FCurve', default: true }, { name: 'Fit Tolerance', default: 0.01 }],
  PlotToActions: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }, { name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }, { name: 'StepFrame', default: 1 }, { name: 'FCurve Kind', default: 20 }, { name: 'DefaultSegKind', default: 3 }, { name: 'Fit FCurve', default: false }, { name: 'Fit Tolerance', default: 0.01 }, { name: 'ProcessContRots', default: true }],
  PlotFrameSetToActions: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }, { name: 'Type', default: 1 }, { name: 'StartFrame', default: 0 }, { name: 'FrameSet', default: 0 }, { name: 'FCurve Kind', default: 20 }, { name: 'DefaultSegKind', default: 3 }, { name: 'Fit FCurve', default: false }, { name: 'Fit Tolerance', default: 0.01 }, { name: 'ProcessContRots', default: true }],
  StoreShapeKey: [{ name: 'InputObj', default: null }, { name: 'Name', default: '' }, { name: 'RefMode', default: ':siShapeObjectReferenceMode:siShapeReferenceMode' }, { name: 'Frame', default: null }, { name: 'Duration', default: 0 }, { name: 'Sampling', default: 0 }, { name: 'Content', default: ':siShapeContentSecondaryShape:siShapeContent' }, { name: 'Force deform stripping', default: false }],
  SelectShapeKey: [{ name: 'InputObj', default: null }, { name: 'SourceObj', default: null }, { name: 'RefMode', default: ':siShapeLocalReferenceMode:siShapeReferenceMode' }, { name: 'Relational', default: true }, { name: 'ApplyKeys', default: false }],
  ApplyShapeKey: [{ name: 'InputObj', default: null }, { name: 'Compound', default: '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:' }, { name: 'Track', default: '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:' }, { name: 'Time', default: null }, { name: 'Duration', default: -1 }, { name: 'Mode', default: 4 }, { name: 'Name', default: '' }, { name: 'Overwrite', default: 0 }],
  ConvertShapeReferenceMode: [{ name: 'InputObj', default: null }, { name: 'RefMode', default: ':siShapeLocalReferenceMode:siShapeReferenceMode' }],
  LinkDeformWithOri: [{ name: 'Cluster', default: null }, { name: 'Parameter list', default: null }, { name: 'LinkWithOri', default: true }],
  AddClip: [{ name: 'Model', default: null }, { name: 'Source', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }, { name: 'Name', default: '' }, { name: 'ConnectionMappingTemplate', default: null }, { name: 'ValueMappingTemplate', default: null }, { name: 'ShareParent', default: true }, { name: 'IgnoreMissingConnections', default: false }],
  CopyClipToTrack: [{ name: 'Model', default: null }, { name: 'Clip', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }],
  CreateCompound: [{ name: 'Model', default: null }, { name: 'InputObj', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }, { name: 'Name', default: '' }],
  MoveClipToTrack: [{ name: 'Model', default: null }, { name: 'Clip', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }],
  ExplodeCompound: [{ name: 'Model', default: null }, { name: 'Compound', default: null }],
  AddClipRelation: [{ name: 'From', default: null }, { name: 'To', default: null }, { name: 'Name', default: 'Relation' }],
};
const LABEL: Record<string, string> = {
  ExportAction: 'Export Action', ImportRefAction: 'Import Referenced Action', ImportAction: 'Import Action', ReplaceShapeKey: 'Replace Shape Key',
  ApplyAction: 'Apply Action', GetDrivingActions: 'Get Driving Actions', AddTWTransition: 'Add Time Warp Transition', CollapseLayers: 'Collapse Animation Layers',
  StoreShapeKey: 'Store Shape Key', SelectShapeKey: 'Select Shape Key', ApplyShapeKey: 'Apply Shape Key', ConvertShapeReferenceMode: 'Convert Shape Reference Mode',
};
export const registered: string[] = [];
/** Register with the registry argument list; replaces every earlier registration of the name. */
export function reg(app: App, name: string, def: Pick<CommandDef, 'execute'> & Partial<CommandDef>) {
  const args = ARGS[name]; if (!args) throw new Error(`${ROW}: no registry argument list for ${name}`);
  const category = /Shape|Deform/.test(name) ? 'Animation|Deformation' : 'Animation Mixer';
  app.register({ name, label: LABEL[name] ?? name, category, description: '', ...def, args: args.map(a => ({ ...a })) } as CommandDef);
  if (!registered.includes(name)) registered.push(name);
}

// ------------------------------------------------------------------ models and mixers
export function modelArgB20(app: App, v: any): Model | undefined {
  const x = first(v);
  if (x instanceof Model) return x;
  if (x instanceof ClipNode) return x.ref.model;
  if (x instanceof Property && x.type === 'mixer' && x.parent instanceof Model) return x.parent;
  const n = findNode(app, x);
  if (n instanceof Model) return n;
  if (n instanceof X3DObject) return n.model ?? app.scene.root;
  return undefined;
}
/** Helper task 6d89e10a: the model's mixer container, created (undoably, kept as a sub-task) when `create` is set. */
export function mixerFor(app: App, cmd: string, model: Model, create = true): MixerX | null {
  const had = model.property('mixer') as MixerX | undefined;
  if (had) return mixerX(model);
  if (!create) return null;
  const mix = mixerX(model);
  app.record('Create mixer', () => { if (!model.properties.includes(mix)) model.addProperty(mix); }, () => model.removeProperty(mix));
  subtask(app, cmd, '6d89e10a', { Model: model.name });
  return mix;
}
/** Every clip ref of every mixer. */
export function clipRefs(app: App): ClipRef[] { return [...allClipRefs(app)]; }
/** A clip argument: a ClipNode, a clip record, or a clip (full) name. */
export function clipRefArg(app: App, v: any): ClipRef | null {
  const x = first(v);
  if (unset(x)) return null;
  const all = clipRefs(app);
  if (x instanceof ClipNode) return all.find(r => r.clip === x.clip) ?? null;
  if (typeof x === 'object') return all.find(r => r.clip === x) ?? null;
  const s = String(x).trim();
  return all.find(r => clipNode(r).fullName === s) ?? all.find(r => r.clip.name === s) ?? null;
}
export const nodeOf = (r: ClipRef) => clipNode(r);
/** The container of a clip: its compound record, else the mixer. */
export const containerOf = (r: ClipRef): object => compoundOf(r) ?? r.mix;
export const isShotClip = (c: ClipX) => clipType(c) === T_CAMSHOT;

// ------------------------------------------------------------------ tracks
type TrackRow = { name: string; type: string; insertPosition: number; index?: number };
export const trackRows = (mix: MixerX): TrackRow[] => ((mix as any).trackRows ??= []);
/** A Track argument as a track index (see the header); null when unset or unknown. */
export function trackArg(mix: MixerX, v: any): number | null {
  const x = first(v);
  if (unset(x)) return null;
  if (typeof x === 'number' && Number.isFinite(x)) return Math.max(0, Math.trunc(x));
  if (typeof x === 'object') {
    if (typeof (x as any).index === 'number') return (x as any).index;
    const row = trackRows(mix).find(r => r === x || (r.name && r.name === (x as any).name));
    if (row) return rowTrack(mix, row);
    if (typeof (x as any).name === 'string') return trackArg(mix, (x as any).name);
    return null;
  }
  const s = String(x).trim().split('.').pop()!;
  if (/^-?\d+$/.test(s)) return Math.max(0, Number(s));
  const m = /^(?:Mixer_(?:Anim|Shape|Audio)_Track|Shot_Track)(\d*)$/.exec(s);
  if (m) return m[1] ? Number(m[1]) : 0;
  const row = trackRows(mix).find(r => r.name === s);
  return row ? rowTrack(mix, row) : null;
}
/** inferred: a track made by AddTrack is a new, empty track: its index is given on first use, after every track in use. */
function rowTrack(mix: MixerX, row: TrackRow & { index?: number }): number {
  if (typeof row.index === 'number') return row.index;
  const used = [...mix.clips, ...mix.compounds].map(c => Number((c as any).track ?? 0)).concat(trackRows(mix).map(r => (r as any).index ?? -1));
  row.index = (used.length ? Math.max(...used) : -1) + 1;
  return row.index;
}
type Cpd = (ClipX & { clips?: string[] }) | null;
/** The clips of one container on one track: the members of `compound`, or the top-level clips and compounds of the mixer. */
export function clipsOnTrack(mix: MixerX, track: number, except?: ClipX, compound: Cpd = null): ClipX[] {
  const members = new Set(mix.compounds.flatMap(c => c.clips ?? []));
  const pool: ClipX[] = compound ? mix.clips.filter(c => (compound.clips ?? []).includes(c.name)) : [...mix.clips.filter(c => !members.has(c.name)), ...mix.compounds];
  return pool.filter(c => c !== except && Number(c.track ?? 0) === track);
}
/** GetInsertedClipBounds stand-in: the clip span [time, time + len) must not overlap a clip already on the track. */
export function roomOnTrack(mix: MixerX, track: number, time: number, len: number, except?: ClipX, compound: Cpd = null): boolean {
  return !clipsOnTrack(mix, track, except, compound).some(c => c.start < time + len - 1e-9 && time < c.start + c.duration - 1e-9);
}
/** inferred: without a Track argument the first track with room is used, else a new track (the Desktop golden puts two
 *  clips added at the same time on Mixer_Anim_Track and Mixer_Anim_Track1). */
export function freeTrack(mix: MixerX, time: number, len: number, compound: Cpd = null): number {
  const members = new Set(mix.compounds.flatMap(c => c.clips ?? []));
  const pool: ClipX[] = compound ? mix.clips.filter(c => (compound.clips ?? []).includes(c.name)) : [...mix.clips.filter(c => !members.has(c.name)), ...mix.compounds];
  const used = pool.map(c => Number(c.track ?? 0));
  const max = used.length ? Math.max(...used) : -1;
  for (let t = 0; t <= max; t++) if (roomOnTrack(mix, t, time, len, undefined, compound)) return t;
  return max + 1;
}

// ------------------------------------------------------------------ sources
/** Source start / end in frames: explicit frameStart / frameEnd, else the key range of its curves. inferred: a source
 *  without curves spans 5 frames from its start (the 1..5 range GetStoreActionDefaults reports for static values). */
export function sourceSpan(src: Property): { start: number; end: number } {
  const s = src as any; const start = sourceFrameStart(src);
  if (typeof s.frameEnd === 'number') return { start, end: s.frameEnd };
  let end = -Infinity; for (const keys of Object.values(sourceFcurves(src))) if (keys?.length) end = Math.max(end, keys[keys.length - 1].time);
  return { start, end: Number.isFinite(end) ? end : start + 4 };
}
export function sourceModel(app: App, src: Property): Model { const p = src.parent as any; return p instanceof Model ? p : app.scene.root; }
/** An action source argument: the source itself, its name / full name, or a clip (its source). */
export function actionSourceArg(app: App, v: any): Property | undefined {
  const x = first(v);
  if (unset(x)) return undefined;
  if (x instanceof Property && isActionSource(x)) return x;
  const s = sourceArg(app, x); if (s) return s;
  const r = clipRefArg(app, x); if (r) return r.model.properties.find(p => p.name === r.clip.source && isActionSource(p));
  return undefined;
}

// ------------------------------------------------------------------ markers and relations
export class MixerMarker extends Node {
  lockLevel = 0;
  constructor(name: string, time: number, duration: number) {
    super(name, 'mixermarker', 'property', [str('Name', name, 'Name'), num('time', time, 'Time'), num('duration', duration, 'Duration')]);
  }
}
const MARKERS = new WeakMap<object, MixerMarker[]>();
/** The markers of a container (mixer or compound record). Kept outside the record: clip records are JSON-copied for undo. */
export const markersOf = (container: object): MixerMarker[] => { let l = MARKERS.get(container); if (!l) { l = []; MARKERS.set(container, l); } return l; };
export type Relation = { name: string; master: string; slave: string; active?: boolean };
export const relationsOf = (mix: MixerX): Relation[] => ((mix as any).relations ??= []);
/** Keep the mixer's Softimage-visible `markers` parameter in step with the marker objects of the mixer. */
export function syncMarkers(mix: MixerX) {
  const own = markersOf(mix).map(m => ({ name: m.name, time: m.val('time'), duration: m.val('duration') }));
  if (mix.get('markers')) mix.set('markers', own.length ? JSON.stringify(own) : '');
}

// ------------------------------------------------------------------ undo
/** One undoable mixer edit: clips / compounds through editMixer, plus the transition, relation, track-row and marker lists. */
export function editMix<T>(app: App, mix: MixerX, label: string, fn: () => T): T {
  const lists = () => { const s = mix as any; return [s.transitions ??= [], relationsOf(mix), trackRows(mix), markersOf(mix)] as any[][]; };
  const before = lists().map(l => [...l]);
  const result = editMixer(app, mix, app.scene.root, label, fn);
  const after = lists().map(l => [...l]);
  const restore = (s: any[][]) => { lists().forEach((l, i) => l.splice(0, l.length, ...s[i])); syncMixer(mix); syncMarkers(mix); };
  app.record(label, () => restore(after), () => restore(before));
  return result;
}
export { uniqueClipName, isCompoundRecord, compoundOf, allModels };
