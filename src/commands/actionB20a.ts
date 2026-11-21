// Ledger row CMD-B20a: action.dll / actioncore.dll mixer and action commands. Brief: section 3 ("Wire contracts") of
// docs/ghidra/cmd-b20a-action-actioncore.md and items 1-14 of the CMD-B20a section of docs/re/WIRE_CORRECTIONS_B20.md.
// Original code written from that prose contract only (helpers and the mapping onto this build: actionB20aModel.ts).
//
// These registrations replace the earlier bodies of the same names in anim.ts, animateSurface.ts and model.ts
// (pointer comments are left there). Commands:
//   SPEC / SPEC-PARTIAL with behaviour: EqualizeAction, ExportAction, ImportRefAction, ImportAction, ReplaceShapeKey,
//   SIStoreAction, AddTransition, AddTWTransition, AddMarker, ReconnectMixer, SwapRelationMasterAndSlaveClip,
//   AddClip, CopyClipToTrack, MoveClipToTrack, CreateCompound, ExplodeCompound, AddClipRelation.
//   Confirmations (argument list read; the worker was not re-read, so the earlier behaviour is kept behind the
//   attested argument list and the unread part logs "not yet attested"): PlotToAction, PlotToActions,
//   PlotFrameSetToActions, ApplyAction, GetDrivingActions, CollapseLayers, StoreShapeKey, SelectShapeKey, ApplyShapeKey,
//   ConvertShapeReferenceMode, LinkDeformWithOri.
// AddCustomOp is LOCK (not served by action.dll) and is not touched.
import { App, CommandDef } from '../core/commands';
import { Node, Property, Model, X3DObject, Cluster, Constraint, syncMixer, type MixerTransition } from '../core/scene';
import { Parameter, int, num, str } from '../core/params';
import { SI_KEY_INTERP_LINEAR } from '../core/animation';
import { ensureShapeBase, ensureShapeOperator, evaluateShapes } from '../core/shape';
import {
  isActionSource, isShapeAction, sourceOf, sourceFcurves, sourceValues, extrapType, isAnimOrShapeClip, cameraSequencer,
  EXTRAP_NONE, EXTRAP_CYCLE, type ClipX, type ClipRef, type MixerX,
} from '../core/mixerActionScripts';
import { makeSource, snapSource, writeSource, uniqueIn, itemsOf } from './actionB11eModel';
import { paramByPath } from './actionB11fModel';
import { findParam } from './index';
import { findParamPath } from './model';
import { storeShapeKeyBody } from './anim';
import { collapseLayersBody } from './animateSurface';
import {
  ROW, S_OK, S_FALSE, E_POINTER, E_FAIL, E_INVALIDARG, E_ACCESSDENIED, E_UNEXPECTED, E_RESTRICTED, EV_EXPORT_BEGIN, EV_EXPORT_END,
  MSG_RELATION_REFUSED, MSG_ADDCLIP_NO_ROOM, MSG_MOVE_NO_ROOM, MSG_COPY_NO_ROOM,
  b20a, setStatus, fail, logNya, logMsgId, subtask, unset, truthy, listOf, first, numArg, lockLevel, reg, registered,
  modelArgB20, mixerFor, clipRefArg, clipRefs, nodeOf, containerOf, isShotClip, trackArg, trackRows, roomOnTrack, freeTrack,
  sourceSpan, sourceModel, actionSourceArg, MixerMarker, markersOf, relationsOf, syncMarkers, editMix, uniqueClipName,
  isCompoundRecord, compoundOf, type Relation,
} from './actionB20aModel';

type Args = Record<string, any>;
const transitionsOf = (mix: MixerX): MixerTransition[] => ((mix as any).transitions ??= []);
const end = (c: ClipX) => c.start + c.duration;
const objOf = (app: App, v: any): X3DObject | undefined => {
  const x = first(v);
  if (x instanceof X3DObject) return x;
  if (typeof x === 'string') { const n = app.scene.find(x.trim()) ?? app.scene.find(x.trim().split('.').pop()!); return n instanceof X3DObject ? n : undefined; }
  return undefined;
};
const ownerObj = (x: any): X3DObject | null => { let n: any = x instanceof Parameter ? x.owner : x; while (n && !(n instanceof X3DObject)) n = n.parent ?? null; return n ?? null; };
/** siShapeReferenceMode: an enum string (`:siShapeObjectReferenceMode:siShapeReferenceMode`) or a number. */
const SHAPE_REF_MODES: Record<string, number> = { siShapeLocalReferenceMode: 0, siShapeAbsoluteReferenceMode: 1, siShapeObjectReferenceMode: 2 };
function refModeArg(v: any, d = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  const m = /:?(siShape\w+ReferenceMode):?/.exec(String(v ?? ''));
  if (m && m[1] in SHAPE_REF_MODES) return SHAPE_REF_MODES[m[1]];
  const n = Number(v); return unset(v) || !Number.isFinite(n) ? d : Math.trunc(n);
}

// ===================================================================== AddClip (actioncore, SPEC confirmation)
interface ClipPlace { mix: MixerX; model: Model; compound: (ClipX & { clips?: string[] }) | null }
/** Model / Compound arguments: a compound record or compound clip node gives the container, otherwise the mixer. */
function placeArg(app: App, cmd: string, modelV: any, compoundV: any, fallback: Model): ClipPlace {
  const model = modelArgB20(app, modelV) ?? fallback;
  const cref = unset(compoundV) ? null : clipRefArg(app, compoundV);
  if (cref && isCompoundRecord(cref.clip)) return { mix: cref.mix, model: cref.model, compound: cref.clip };
  const mix = mixerFor(app, cmd, model)!;
  return { mix, model, compound: null };
}
function addClipWorker(app: App, C: string, a: Args, opts: { noRoomMsg?: number } = {}): ClipRef {
  const src = actionSourceArg(app, a.Source)
    ?? (unset(a.Source) ? app.selection.find(n => isActionSource(n)) as Property | undefined : undefined);   // inferred: unset Source = the selected source
  if (!src) throw fail(C, E_POINTER, 'Source is missing or is not an action source');
  const place = placeArg(app, C, a.Model, a.Compound, sourceModel(app, src));
  const { mix } = place;
  const span = sourceSpan(src);
  const len = Math.max(1e-6, span.end - span.start + 1);   // (source end - source start) + 1 frame
  let time = unset(a.Time) ? app.anim.frame : Number(a.Time);   // inferred: unset Time = the current frame
  let track = trackArg(mix, a.Track);
  if (track !== null) {
    if (!roomOnTrack(mix, track, time, len, undefined, place.compound)) {
      logMsgId(app, C, 'XSIACTIONCORE', opts.noRoomMsg ?? MSG_ADDCLIP_NO_ROOM, `no room on track ${track} at ${time}`);
      throw fail(C, E_FAIL, `no room for ${src.name} on track ${track} at frame ${time}`);
    }
  } else track = freeTrack(mix, time, len, place.compound);
  const name = uniqueClipName(mix, String(a.Name || `${src.name}_Clip`));   // default `<source>_Clip` (Desktop golden: ActionA_Clip)
  const clip: ClipX = { name, source: src.name, start: time, duration: len, track, weight: 1, mute: false, additive: false };
  if (!unset(a.ConnectionMappingTemplate)) (clip as any).connectionMap = a.ConnectionMappingTemplate?.name ?? String(a.ConnectionMappingTemplate);
  if (!unset(a.ValueMappingTemplate)) (clip as any).valueMap = a.ValueMappingTemplate?.name ?? String(a.ValueMappingTemplate);
  if (!truthy(a.ShareParent)) logNya(app, C, 'ShareParent false (the clip parent sharing rule)');
  if (truthy(a.IgnoreMissingConnections)) logNya(app, C, 'IgnoreMissingConnections (missing connection handling of the connection map)');
  const ts = transitionsOf(mix);
  editMix(app, mix, C, () => {
    mix.clips.push(clip);
    if (place.compound) (place.compound.clips ??= []).push(clip.name);
    // Auto Transition (mixer flag, docs/ghidra/mixer-clip-transitions.md): a clip after another on the same track gets a standard transition.
    const prev = mix.clips.filter(c => c !== clip && Number(c.track ?? 0) === track && end(c) <= time + 1e-9).sort((p, q) => end(q) - end(p))[0];
    if (mix.val('autotransition') && prev) ts.push({ name: uniqueIn(ts.map(t => t.name), 'Transition'), kind: 'standard', from: prev.name, to: clip.name, length: Math.max(1, time - end(prev)) || 1, weight: 1, type: 0, active: true });
  });
  setStatus(app, C, S_OK);
  return { clip, mix, model: place.model };
}

// ===================================================================== CopyClipToTrack / MoveClipToTrack (SPEC confirmation)
function clipToTrack(app: App, C: 'CopyClipToTrack' | 'MoveClipToTrack', a: Args) {
  const ref = clipRefArg(app, a.Clip) ?? (unset(a.Clip) ? (() => { const n = app.selection.find(x => x instanceof Node && clipRefArg(app, x)); return n ? clipRefArg(app, n) : null; })() : null);
  if (!ref) {
    if (!unset(a.Clip) && shotClipArg(app, a.Clip)) { logNya(app, C, 'shot clips of the camera sequencer (the scene model is used and Compound is ignored; the camera track move is not modelled)'); setStatus(app, C, S_FALSE); return null; }
    throw fail(C, E_POINTER, 'Clip is missing or is not a clip');
  }
  const shot = isShotClip(ref.clip);
  const place = shot ? { mix: ref.mix, model: app.scene.root, compound: null } : placeArg(app, C, unset(a.Model) ? ref.model : a.Model, a.Compound, ref.model);
  const { mix } = place;
  const track = trackArg(mix, a.Track);
  if (track === null) throw fail(C, E_POINTER, 'Track is required');
  const time = unset(a.Time) ? ref.clip.start : Number(a.Time);   // inferred: unset Time keeps the clip's time
  const len = ref.clip.duration;
  if (!roomOnTrack(mix, track, time, len, C === 'MoveClipToTrack' ? ref.clip : undefined, place.compound)) {
    logMsgId(app, C, 'XSIACTIONCORE', C === 'MoveClipToTrack' ? MSG_MOVE_NO_ROOM : MSG_COPY_NO_ROOM, `no room on track ${track} at ${time}`);
    throw fail(C, E_FAIL, `no room for ${ref.clip.name} on track ${track} at frame ${time}`);
  }
  if (C === 'MoveClipToTrack') {
    if (lockLevel(ref.clip)) throw fail(C, E_ACCESSDENIED, `${ref.clip.name} is locked`);   // inferred: the common lock rule of section 2.2
    editMix(app, mix, C, () => {
      if (mix !== ref.mix) { const i = ref.mix.clips.indexOf(ref.clip); if (i >= 0) ref.mix.clips.splice(i, 1); mix.clips.push(ref.clip); }
      const old = compoundOf(ref); if (old && old !== place.compound) old.clips = (old.clips ?? []).filter(n => n !== ref.clip.name);
      if (place.compound && !(place.compound.clips ?? []).includes(ref.clip.name)) (place.compound.clips ??= []).push(ref.clip.name);
      ref.clip.track = track; ref.clip.start = time;
    });
    setStatus(app, C, S_OK);
    return undefined;
  }
  const copy: ClipX = JSON.parse(JSON.stringify(ref.clip));
  copy.name = uniqueClipName(mix, ref.clip.name); copy.track = track; copy.start = time;
  if (isCompoundRecord(copy)) logNya(app, C, 'copying a compound clip (its member clips are not duplicated)');
  editMix(app, mix, C, () => { mix.clips.push(copy); if (place.compound) (place.compound.clips ??= []).push(copy.name); });
  setStatus(app, C, S_OK);
  return nodeOf({ clip: copy, mix, model: place.model });
}
function shotClipArg(app: App, v: any): ClipX | null {
  const s = typeof first(v) === 'string' ? String(first(v)).split('.').pop() : (first(v) as any)?.name;
  for (const t of cameraSequencer(app.scene.root).tracks) for (const c of t.clips) if (c.name === s || c === first(v)) return c;
  return null;
}

// ===================================================================== CreateCompound / ExplodeCompound (SPEC confirmation)
function createCompoundWorker(app: App, C: string, a: Args): ClipRef {
  const members = listOf(unset(a.InputObj) ? null : a.InputObj).map(x => clipRefArg(app, x)).filter((r): r is ClipRef => !!r);
  const fallback = members[0]?.model ?? modelArgB20(app, a.Model) ?? app.selectedObjects[0]?.model ?? app.scene.root;
  const place = placeArg(app, C, unset(a.Model) ? fallback : a.Model, a.Compound, fallback);
  if (place.compound) logNya(app, C, 'a compound inside a compound (nested compounds are not modelled in this build); the compound is created in the mixer');
  const { mix } = place;
  const own = members.filter(r => r.mix === mix);
  if (own.length !== members.length) logNya(app, C, 'clips of another mixer in InputObj (they are left out)');
  const start = unset(a.Time) ? (own.length ? Math.min(...own.map(r => r.clip.start)) : app.anim.frame) : Number(a.Time);   // inferred
  const stop = own.length ? Math.max(...own.map(r => end(r.clip))) : start + 1;   // inferred: an empty compound spans one frame
  const duration = Math.max(1, stop - start);
  let track = trackArg(mix, a.Track);
  if (track === null) track = freeTrack(mix, start, duration);
  const name = uniqueClipName(mix, String(a.Name || 'Compound'));   // inferred: the default compound name
  const cpd = { name, source: '', clips: own.map(r => r.clip.name), start, duration, track, weight: 1, mute: false } as any;
  editMix(app, mix, C, () => {
    for (const r of own) { const old = compoundOf(r); if (old) old.clips = (old.clips ?? []).filter(n => n !== r.clip.name); }
    mix.compounds.push(cpd);
  });
  setStatus(app, C, S_OK);
  return { clip: cpd, mix, model: place.model };
}
function explodeCompound(app: App, a: Args) {
  const C = 'ExplodeCompound';
  const ref = clipRefArg(app, a.Compound);
  if (!ref || !isCompoundRecord(ref.clip)) throw fail(C, E_POINTER, 'Compound is missing or is not a compound');
  const cpd = ref.clip;
  editMix(app, ref.mix, C, () => {
    const i = ref.mix.compounds.indexOf(cpd as any); if (i >= 0) ref.mix.compounds.splice(i, 1);
    for (const n of cpd.clips ?? []) { const m = ref.mix.clips.find(c => c.name === n); if (m && m.start < cpd.start) logNya(app, C, 'the placement of the member clips after the compound is removed (they keep their mixer time)'); }
  });
  setStatus(app, C, S_OK);
  return undefined;
}

// ===================================================================== AddTransition (actioncore, SPEC-PARTIAL)
const TRANSITION_KIND: Record<number, MixerTransition['kind']> = { 0: 'standard', 1: 'cardinal' as any, 2: 'bridge' };
function addTransitionWorker(app: App, C: string, a: Args): MixerTransition | null {
  const from = clipRefArg(app, a.From), to = clipRefArg(app, a.To);
  if (!from || !to) throw fail(C, E_POINTER, 'From and To must be clips');
  if (from.clip === to.clip) throw fail(C, E_FAIL, 'From and To are the same clip');
  for (const r of [from, to]) if (lockLevel(r.clip)) throw fail(C, E_ACCESSDENIED, `${r.clip.name} is locked`);
  let type = Math.trunc(numArg(a.Type, 0)); if (type > 2 || type < 0) type = 0;   // VT_UI4: values > 2 become 0
  const mix = from.mix; const ts = transitionsOf(mix);
  // (1) existing transitions on From's start side / To's end side are deleted (DeleteObj sub-tasks)
  const doomed = ts.filter(t => t.from === from.clip.name || t.to === to.clip.name);
  // (3) family test: inferred: only animation / shape clips take transitions
  const familyOk = isAnimOrShapeClip(from.clip) && isAnimOrShapeClip(to.clip);
  // (4) both clips must be in the same container
  const same = from.mix === to.mix && containerOf(from) === containerOf(to);
  let created: MixerTransition | null = null;
  editMix(app, mix, C, () => {
    for (const t of doomed) { const i = ts.indexOf(t); if (i >= 0) ts.splice(i, 1); subtask(app, C, 'DeleteObj', { InputObj: t.name }); }
    if (!familyOk || !same) return;
    const fe = end(from.clip), overlap = fe - to.clip.start;
    // inferred: the transition spans the overlap of the two clips, else the gap between them (at least one frame)
    const length = overlap > 0 ? overlap : Math.max(1, to.clip.start - fe);
    const nameGiven = !unset(a.Name) && String(a.Name).toLowerCase() !== 'transition';
    const tr: MixerTransition & Record<string, any> = {
      name: nameGiven ? String(a.Name) : uniqueIn(ts.map(t => t.name), 'Transition'),   // inferred: default naming = unique "Transition"
      kind: TRANSITION_KIND[type], from: from.clip.name, to: to.clip.name, length, weight: 1, type, active: true,
      fromTrack: Number(from.clip.track ?? 0), toTrack: Number(to.clip.track ?? 0),   // params 6 / 7
    };
    if (type === 1) tr.cardinalFlag = 2;   // the extra flag (2) on a sub-object for Type 1 (meaning not attested)
    const a1 = new Set(itemPaths(from)), common = itemPaths(to).filter(p => a1.has(p));
    tr.items = common;   // F3DFindCommonTransitionItems
    ts.push(tr); created = tr;
  });
  if (!familyOk) logNya(app, C, 'the family test of the clip pair (GUIDs 2320123a / 2320123b / 08e2e5c8); this build accepts animation and shape clips only');
  if (!created) { if (!same) app.logMsg('info', `${C}: ${from.clip.name} and ${to.clip.name} are not in the same container; no transition`); setStatus(app, C, S_FALSE); return null; }
  setStatus(app, C, S_OK);
  return created;
}
function itemPaths(r: ClipRef): string[] {
  if (isCompoundRecord(r.clip)) return (r.clip.clips ?? []).flatMap(n => { const m = r.mix.clips.find(c => c.name === n); return m ? itemPaths({ ...r, clip: m }) : []; });
  const s = sourceOf(r); return s ? itemsOf(s) : [];
}

// ===================================================================== AddTWTransition (action.dll, SPEC-PARTIAL)
function addTWTransition(app: App, a: Args) {
  const C = 'AddTWTransition';
  const from = clipRefArg(app, a.From), to = clipRefArg(app, a.To);
  if (!from || !to) throw fail(C, E_POINTER, 'From and To must be clips');
  const fp = numArg(a['From Period'], 0), tp = numArg(a['To Period'], 0);
  const bad = (what: string) => { app.logMsg('error', `${C}: message 0x3eb: ${what}`); return fail(C, E_INVALIDARG, what); };
  if (fp > from.clip.duration + 0.001 || tp > to.clip.duration + 0.001) throw bad('The period exceeds the clip.');
  // inferred: "overlap properly" = the two clip spans intersect
  if (!(to.clip.start < end(from.clip) && from.clip.start < end(to.clip))) throw bad('Clips must overlap properly.');
  for (const r of [from, to]) for (const s of [0, 1] as const) { const e = extrapType(r, s); if (e !== EXTRAP_NONE && e !== EXTRAP_CYCLE) throw bad('Extrapolations have to be either nothing or cycles.'); }
  logNya(app, C, 'the keys of the "Time Warp Transition Curve" fcurve (an empty curve is attached)');
  // Name: null -> BridgeTransition (worker); the registry default "Bridge Transition" gives Mixer.TW<n> (Desktop pass3 golden)
  const tsBefore = transitionsOf(from.mix);
  let tw = 1; while (tsBefore.some(t => t.name === `TW${tw}`)) tw++;   // inferred: the first free TW<n>
  const twName = unset(a.Name) ? 'BridgeTransition' : String(a.Name) === 'Bridge Transition' ? `TW${tw}` : String(a.Name);
  subtask(app, C, 'AddTransition', { From: from.clip.name, To: to.clip.name, Type: 2, Name: twName });
  const tr = addTransitionWorker(app, C, { From: nodeOf(from), To: nodeOf(to), Type: 2, Name: twName });
  if (!tr) { setStatus(app, C, S_FALSE); return null; }
  const t = tr as any; t.kind = 'timewarp'; t.fromPeriod = fp; t.toPeriod = tp; t.warpCurve = { name: 'Time Warp Transition Curve', keys: [] };
  if (t.name !== twName) t.name = twName;
  syncMixer(from.mix);
  setStatus(app, C, S_OK);
  return tr;
}

// ===================================================================== AddMarker (actioncore, SPEC)
function addMarker(app: App, a: Args) {
  const C = 'AddMarker';
  const model = modelArgB20(app, a.Model);
  if (!model) { setStatus(app, C, S_FALSE); return null; }   // nothing is done when Model is missing
  let container: object | null = null; let mix: MixerX | null = null;
  if (!unset(a.Container)) {
    const ref = clipRefArg(app, a.Container);
    if (ref && isCompoundRecord(ref.clip)) { container = ref.clip; mix = ref.mix; }
    else { const m = modelArgB20(app, a.Container); if (m) { mix = mixerFor(app, C, m); container = mix; } else { const t = first(a.Container); if (t instanceof Property && t.type === 'mixer') { mix = t as MixerX; container = t; } } }
    if (!container) throw fail(C, E_INVALIDARG, 'Container is not a track, compound or mixer');
  }
  if (!container) { mix = mixerFor(app, C, model)!; container = mix; }
  if (lockLevel(container) & 1) throw fail(C, E_ACCESSDENIED, 'the container is locked');
  const time = unset(a.Time) ? app.anim.frame : Number(a.Time);   // inferred: unset Time = the current frame
  const dur = numArg(a.Duration, 0);
  const name = unset(a.Name) ? 'Marker' : String(a.Name);
  const marker = new MixerMarker(name, time, dur);
  marker.parent = (container instanceof Node ? container : mix) as any;
  const list = markersOf(container);
  app.record(C, () => { if (!list.includes(marker)) list.push(marker); syncMarkers(mix!); }, () => { const i = list.indexOf(marker); if (i >= 0) list.splice(i, 1); syncMarkers(mix!); });
  setStatus(app, C, S_OK);
  return marker;
}

// ===================================================================== ReconnectMixer (actioncore, SPEC-PARTIAL)
function reconnectMixer(app: App, a: Args) {
  const C = 'ReconnectMixer';
  const x = first(a.Model);
  let mix: MixerX | null = null;
  if (x instanceof Property && x.type === 'mixer') mix = x as MixerX;
  else { const model = unset(x) ? app.scene.root : modelArgB20(app, x); if (model) mix = mixerFor(app, C, model, false); }   // inferred: unset Model = the scene root
  if (!mix) throw fail(C, E_POINTER, 'no mixer');
  logNya(app, C, 'the mixer reconnect call (slot 8, constant 0x180091700); the mixer is re-synchronised and re-evaluated');
  syncMixer(mix);
  if (app.commands.has('EvaluateMixer')) { try { app.run('EvaluateMixer', { Frame: app.anim.frame, Apply: true }); } catch { /* evaluation is a convenience */ } }
  app.events.emit('scene');
  setStatus(app, C, S_OK);
  return undefined;
}

// ===================================================================== SwapRelationMasterAndSlaveClip (SPEC)
function relationArg(app: App, v: any): { rel: Relation; mix: MixerX } | null {
  const x = first(v); if (unset(x)) return null;
  const mixes = new Set<MixerX>(clipRefs(app).map(r => r.mix));
  for (const m of [app.scene.root, ...[...app.scene.allObjects()].filter(o => o instanceof Model)] as Model[]) { const mx = m.property('mixer'); if (mx) mixes.add(mx as MixerX); }
  for (const mix of mixes) for (const rel of relationsOf(mix)) {
    if (rel === x) return { rel, mix };
    if (typeof x === 'string') { const s = x.trim(); if (s === rel.name || s === `Mixer.${rel.name}` || s.endsWith(`.${rel.name}`)) return { rel, mix }; }
  }
  return null;
}
function swapRelation(app: App, a: Args) {
  const C = 'SwapRelationMasterAndSlaveClip';
  const found = relationArg(app, a.Relation);
  if (!found) throw fail(C, E_POINTER, 'Relation is missing or is not a clip relation');
  const { rel, mix } = found;
  const swap = () => { const t = rel.master; rel.master = rel.slave; rel.slave = t; syncMixer(mix); };
  app.record(C, swap, swap);   // undo and redo both swap again
  setStatus(app, C, S_OK);
  return undefined;
}

// ===================================================================== AddClipRelation (SPEC confirmation)
function addClipRelation(app: App, a: Args) {
  const C = 'AddClipRelation';
  const fromList = listOf(a.From);
  if (!fromList.length) throw fail(C, E_INVALIDARG, 'From is empty');
  const master = clipRefArg(app, fromList[0]);
  const slave = fromList.length >= 2 ? clipRefArg(app, fromList[1]) : clipRefArg(app, a.To);
  if (!master || !slave) throw fail(C, E_INVALIDARG, 'From and To must be clips');
  const mix = master.mix; const rels = relationsOf(mix);
  // relation check on the pair (slot 0x1c8). inferred: a conflict = the same clip twice, or a relation already on the pair
  const conflict = master.clip === slave.clip || master.mix !== slave.mix || rels.some(r => (r.master === master.clip.name && r.slave === slave.clip.name) || (r.master === slave.clip.name && r.slave === master.clip.name));
  if (conflict) { logMsgId(app, C, 'XSIACTIONCORE', MSG_RELATION_REFUSED, `${master.clip.name} / ${slave.clip.name}`); throw fail(C, E_FAIL, 'the relation was refused'); }
  const rel: Relation = { name: uniqueIn(rels.map(r => r.name), String(a.Name || 'Relation')), master: master.clip.name, slave: slave.clip.name, active: true };
  editMix(app, mix, C, () => { rels.push(rel); });
  setStatus(app, C, S_OK);
  return rel;
}

// ===================================================================== EqualizeAction (action.dll, SPEC-PARTIAL)
const KERNEL = [1 / 16, 1 / 4, 3 / 8, 1 / 4, 1 / 16];
/** One low-pass pass with tap spacing `step`; taps outside the range fold their weight onto the edge sample (inferred). */
export function bandLowPass(x: number[], step: number): number[] {
  const n = x.length; const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) for (let k = -2; k <= 2; k++) out[i] += KERNEL[k + 2] * x[Math.min(n - 1, Math.max(0, i + k * step))];
  return out;
}
/** Band decomposition: B = floor(log2 N) bands, detail = input - smoothed at spacing 2^level; the band of the level where
 *  N <= 4 * 2^level (or the last band) receives the remaining low-pass signal; later bands are zero (inferred). Bands are
 *  returned finest first; the bands sum to the input. */
export function equalizerBands(x: number[]): number[][] {
  const n = x.length; const B = Math.floor(Math.log2(n)); const bands: number[][] = [];
  let s = [...x]; let done = false;
  for (let level = 0; level < B; level++) {
    if (done) { bands.push(new Array(n).fill(0)); continue; }
    if (level === B - 1 || n <= 4 * 2 ** level) { bands.push(s); done = true; continue; }
    const smooth = bandLowPass(s, 2 ** level);
    bands.push(s.map((v, i) => v - smooth[i])); s = smooth;
  }
  return bands;
}
function equalizeAction(app: App, a: Args) {
  const C = 'EqualizeAction';
  const x = first(a.Source);
  let src: Property | undefined;
  const cref = unset(x) ? null : clipRefArg(app, x);
  if (cref) { src = sourceOf(cref); if (!src || isCompoundRecord(cref.clip)) throw fail(C, E_UNEXPECTED, `${cref.clip.name} has no source`); }
  else src = actionSourceArg(app, x) ?? (unset(x) ? app.selection.find(n => isActionSource(n)) as Property | undefined : undefined);   // inferred: unset = the selected source
  if (!src) throw fail(C, E_POINTER, 'Source is missing or is not an action source');
  // 1. validation
  const curves = sourceFcurves(src); const items = itemsOf(src);
  const bad = (what: string) => { app.logMsg('error', `${C}: message 0x3eb: ${what}`); return fail(C, E_INVALIDARG, what); };
  if (!items.length || items.some(p => !curves[p]?.length)) throw bad('All items must be fcurves (use plot).');
  const N = curves[items[0]].length;
  if (!N || items.some(p => curves[p].length !== N)) throw bad('All fcurve items must be equally sampled (use plot).');
  if (N < 2) throw bad('All fcurve items must be equally sampled (use plot).');   // inferred: B = floor(log2 N) must be at least 1
  // 2. bands per item
  const perItem = items.map(p => equalizerBands(curves[p].map(k => k.value)));
  const B = perItem[0].length;
  // 3. sources <Name>_Band_<k>, k counting from the coarsest band (inferred), starting at 0 (inferred)
  const base = String(a.Name || src.name);
  const model = sourceModel(app, src);
  const span = sourceSpan(src);
  const bandSources: Property[] = [];
  for (let k = 0; k < B; k++) {
    const level = B - 1 - k;
    const bc: Record<string, { time: number; value: number; interp: number }[]> = {};
    items.forEach((p, i) => { bc[p] = curves[p].map((key, j) => ({ time: key.time, value: perItem[i][level][j], interp: SI_KEY_INTERP_LINEAR })); });   // raw fcurve over the original key times
    const s = makeSource(uniqueIn(model.properties.map(q => q.name).concat(bandSources.map(q => q.name)), `${base}_Band_${k}`), {}, bc);
    (s as any).frameStart = span.start; (s as any).frameEnd = span.end; (s as any).itemKind = 0x1e;   // "Raw Data" items
    bandSources.push(s);
  }
  logNya(app, C, 'the 0.001 tolerance of the raw fcurve rebuild and the exact boundary rule of the band filter (edge folding is used)');
  for (const s of bandSources) app.record(C, () => model.addProperty(s), () => model.removeProperty(s));
  // 4. mixer: AddTrack, CreateCompound at Time, one AddClip per band at local time 1 frame, weight 1
  const mix = mixerFor(app, C, model)!;
  const time = numArg(a.Time, 0);
  const trackName = `${base}_Equalizer_Track`;
  const track = freeTrack(mix, time, span.end - span.start + 1);
  editMix(app, mix, C, () => { trackRows(mix).push({ name: trackName, type: '0', insertPosition: -1, index: track }); });
  subtask(app, C, 'AddTrack', { Name: trackName });
  const cpdRef = createCompoundWorker(app, C, { Model: model, InputObj: null, Track: track, Time: time, Name: `${base}_Equalizer_Clip` });
  subtask(app, C, 'CreateCompound', { Name: cpdRef.clip.name, Time: time });
  const cpdNode = nodeOf(cpdRef);
  bandSources.forEach((s, k) => {
    // inferred: the band clips sit on inner tracks of their own (one per band) at local time 1, i.e. at the compound's
    // start (the compound's local time equals mixer time until its time control is changed)
    const r = addClipWorker(app, C, { Model: model, Source: s, Compound: cpdNode, Track: k, Time: cpdRef.clip.start, Name: '' });
    r.clip.weight = 1;
    subtask(app, C, 'AddClip', { Source: s.name, Time: 1 });
  });
  editMix(app, mix, C, () => {
    const c = cpdRef.clip; c.duration = Math.max(1, span.end - span.start + 1);
    const dur = numArg(a.Duration, 0);
    if (dur > 0) { (c.timectrl ??= {}).scale = c.duration / dur; c.duration = dur; }   // 5. inferred: scale to fit Duration
  });
  logNya(app, C, 'the final VT_BOOL write on the returned clip (inferred "mute original"; not applied)');
  setStatus(app, C, S_OK);
  return nodeOf(cpdRef);
}

// ===================================================================== ExportAction (action.dll, SPEC)
function exportAction(app: App, a: Args) {
  const C = 'ExportAction';
  const st = b20a(app);
  if (st.restrictedMode) { app.logMsg('error', `${C}: simsgcat message 0x143`); throw fail(C, E_RESTRICTED, 'not available in this application mode'); }
  const x = first(a.Action);
  let src: Property | undefined = x instanceof Property && isActionSource(x) ? x : undefined;
  if (!src && x instanceof Node) src = (x as any).properties?.find?.((p: Property) => isActionSource(p));   // an object holding a source (child of class 12a3ef95)
  if (!src) { const r = clipRefArg(app, x); if (r && !isCompoundRecord(r.clip)) src = sourceOf(r); }   // a clip of type 1 -> its first source
  if (!src && !unset(x)) src = actionSourceArg(app, x);
  if (!src) throw fail(C, E_UNEXPECTED, 'Action is not an action source or a clip with a source');
  const file = unset(a.FileName) ? '' : String(a.FileName);
  const folder = file.replace(/[\\/][^\\/]*$/, ''), base = file.split(/[\\/]/).pop() ?? '';
  const ext = /\.[^.]+$/.exec(base)?.[0] ?? '';
  if (ext !== '.eani' && ext !== '.xsi') { setStatus(app, C, E_FAIL); throw fail(C, E_FAIL, `"${file}" is not a .eani or .xsi file (case-sensitive)`); }
  const fire = (id: number) => {
    st.fileEvents.push({ id, type: 10, source: src!.name, file });
    for (const h of st.fileEventHandlers) { const r = h({ id, type: 10, source: src!, file }); if (typeof r === 'number' && r !== 0) return r; }
    return 0;
  };
  const r = fire(EV_EXPORT_BEGIN);
  if (r === 1 || r === 0x562e80c7 || (r & 0x80000000)) { setStatus(app, C, r); if (r & 0x80000000) throw fail(C, r >>> 0, 'the export was refused by a file event handler'); return r; }
  logNya(app, C, `the ${ext} writer of the action source; the source is saved in this build's JSON form`);
  st.files[file] = JSON.stringify({ name: src.name, type: src.type, folder, ...snapSource(src), span: sourceSpan(src) });
  fire(EV_EXPORT_END);
  setStatus(app, C, S_FALSE);   // S_FALSE on success
  return S_FALSE;
}

// ===================================================================== ImportAction / ImportRefAction (action.dll, SPEC-PARTIAL)
function importAction(name: 'ImportAction' | 'ImportRefAction') {
  return (app: App, a: Args) => {
    const load = app.commands.get('LoadActionPreset');
    if (!load) throw fail(name, E_UNEXPECTED, 'the shared import task (LoadActionPreset, CMD-B11e) is not registered');
    // one task for ImportAction / ImportRefAction / LoadActionPreset; only the default of ActionStorage differs (0 / -1 / 0)
    const storage = Math.trunc(numArg(a.ActionStorage, name === 'ImportRefAction' ? -1 : 0));
    const src = load.execute(app, { Model: a.Model, FileName: a.FileName, Name: a.Name, ActionStorage: storage }) as Property;
    const file = String(src?.val('filename') || a.FileName || '');
    const saved = b20a(app).files[file] ?? b20a(app).files[String(a.FileName ?? '')];
    if (src && saved) {   // a file written by ExportAction in this session: its content is this build's own JSON form
      try { const d = JSON.parse(saved); const before = snapSource(src); const j = (x: any) => typeof x === 'string' ? x : JSON.stringify(x ?? {}); const after = { data: j(d.data), fcurves: j(d.fcurves), expressions: j(d.expressions), items: Number(d.items ?? new Set([...Object.keys(JSON.parse(j(d.data))), ...Object.keys(JSON.parse(j(d.fcurves)))]).size) }; app.record(name, () => writeSource(src, after), () => writeSource(src, before)); if (d.span) { (src as any).frameStart = d.span.start; (src as any).frameEnd = d.span.end; } } catch { /* not a file of this build */ }
    }
    setStatus(app, name, S_OK);
    return src;
  };
}

// ===================================================================== ReplaceShapeKey (action.dll, SPEC-PARTIAL)
const isShapeKey = (x: any): x is Property => x instanceof Property && x.type === 'shapekey';
function shapeKeyOf(app: App, x: any): { key: Property; obj: X3DObject } | null {
  if (isShapeKey(x)) { const o = ownerObj(x); return o ? { key: x, obj: o } : null; }
  if (x instanceof Property && isActionSource(x)) return null;   // first item of kind 3 of a shape action: not modelled (logged by the caller)
  const o = x instanceof X3DObject ? x : objOf(app, x);
  if (o) {
    if (!o.primitive?.operators.some(op => op.type === 'shapblend')) return null;   // inferred: the cluster shape combiner
    const k = o.properties.find(isShapeKey) ?? o.clusters.flatMap(c => c.properties).find(isShapeKey);
    return k ? { key: k, obj: o } : null;
  }
  if (typeof x === 'string') { for (const ob of app.scene.allObjects()) for (const k of [...ob.properties, ...ob.clusters.flatMap(c => c.properties)]) if (isShapeKey(k) && (k.fullName === x || k.name === x || `${ob.name}.${k.name}` === x)) return { key: k, obj: ob }; }
  return null;
}
/** Point positions at the current frame with the animation-region deformers inverted. inferred: each animation
 *  deformer other than the shape combiner is inverted as the per-point offset it adds. */
function positionsWithoutAnimDeformers(app: App, C: string, o: X3DObject): Float32Array | null {
  const prim = o.primitive; const mesh = prim?.mesh(); if (!prim || !mesh) return null;
  const out = Float32Array.from(mesh.positions);
  try {
    let m: any = null; const delta = new Float32Array(out.length);
    prim.operators.forEach((op, i) => {
      const before = m?.positions ? Float32Array.from(m.positions) : null;
      m = op.apply(m);
      if (i > 0 && (op.region ?? 'modeling') === 'animation' && op.type !== 'shapblend' && before && m?.positions?.length === before.length) for (let j = 0; j < before.length; j++) delta[j] += m.positions[j] - before[j];
    });
    for (let j = 0; j < out.length; j++) out[j] -= delta[j];
  } catch { app.logMsg('info', `WARNING : ${C}: message 0x129 (the animation deformers could not be inverted)`); }
  return out;
}
function replaceShapeKey(app: App, a: Args) {
  const C = 'ReplaceShapeKey';
  const x = unset(a.InputObj) ? (app.selection.find(isShapeKey) ?? app.selectedObjects[0]) : first(a.InputObj);   // inferred: unset = the selection
  if (x instanceof Property && isShapeAction(x)) logNya(app, C, 'the first item of kind 3 of a shape action source');
  const found = unset(x) ? null : shapeKeyOf(app, x);
  if (!found) { setStatus(app, C, S_FALSE); return undefined; }
  const { key, obj } = found;
  if (lockLevel(key)) throw fail(C, E_ACCESSDENIED, `${key.name} is locked`);
  const mode = Number(key.val('refmode') ?? 0);
  if (!(mode < 3)) throw fail(C, E_INVALIDARG, `${key.name}: reference mode ${mode} is not < 3`);
  const pos = positionsWithoutAnimDeformers(app, C, obj);
  if (!pos) throw fail(C, E_INVALIDARG, 'ShapeKey');
  const count = Number(key.val('points') ?? 0);
  if (count !== pos.length / 3) { app.logMsg('error', `${C}: message 0x65: ${key.name} has ${count} elements, the cluster ${pos.length / 3}`); throw fail(C, E_FAIL, 'the element count of the key and its cluster differ'); }
  // This build stores every key as absolute positions and blends key - ShapeBase (core/shape.ts); the delta-in-reference-
  // frame storage of modes 0 / 2 maps back onto that form, so the absolute positions are written for every mode.
  if (mode !== 1) logNya(app, C, 'the per-point 3x3 reference frames of the non-absolute reference modes (identity frames in this build)');
  ensureShapeBase(obj, pos);
  const old = String(key.val('data')); const now = JSON.stringify(Array.from(pos));
  app.record(C, () => { key.set('data', now); (key as any).updated = 1; }, () => { key.set('data', old); });
  const force = truthy(a.ForceDeformStripping);
  if (obj.primitive?.operators.some(op => op.type === 'shapblend')) {
    logNya(app, C, 'the shape combiner\'s "stack needs stripping" query (only ForceDeformStripping is honoured)');
    if (force && app.commands.has('StripDeformOperators')) { subtask(app, C, 'StripDeformOperators', { InputObj: obj.name }); app.run('StripDeformOperators', { InputObj: obj }); }
  }
  evaluateShapes(obj, true);
  setStatus(app, C, S_OK);
  return key;
}

// ===================================================================== SIStoreAction (action.dll, SPEC-PARTIAL)
const STORE_MASK: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 8, 5: 0xe, 6: 0xf };
function storeParams(app: App, input: any[]): { params: Parameter[]; objs: X3DObject[] } {
  const objs: X3DObject[] = []; const params: Parameter[] = [];
  const add = (p: Parameter) => { if (!params.includes(p)) params.push(p); };
  for (const x of input) {
    if (x instanceof Parameter) { add(x); continue; }
    const o = x instanceof X3DObject ? x : typeof x === 'string' && !x.includes('.') ? objOf(app, x) : undefined;
    if (o) { if (!objs.includes(o)) objs.push(o); continue; }
    if (typeof x === 'string') { const p = findParamPath(app, x) ?? findParam(app, x) ?? paramByPath(app, x); if (p) add(p); }
  }
  for (const o of objs) o.kinematics.local.params.filter(p => p.keyable).forEach(add);
  for (const [p] of app.anim.fcurves) if (objs.includes(ownerObj(p) as X3DObject)) add(p);
  for (const [p] of app.anim.expressions) if (objs.includes(ownerObj(p) as X3DObject)) add(p);
  return { params, objs };
}
function siStoreAction(app: App, a: Args) {
  const C = 'SIStoreAction';
  const type = String(a.Type ?? '');
  const modeN = Math.trunc(numArg(a.Mode, 1));
  if (type === 'ReturnOnly') {   // query mode: behaves as GetStoreActionDefaults
    subtask(app, C, 'GetStoreActionDefaults', { Mode: modeN });
    const r = app.run('GetStoreActionDefaults', { Model: a.Model, InputObj: a.InputObj, Mode: modeN, Type: 'ReturnOnly' });
    setStatus(app, C, S_OK); return r;
  }
  const kind = type === 'TransientAction' ? 2 : type === 'UnownedAction' ? 0 : 1;
  const mask = STORE_MASK[modeN] ?? 0;
  const input = unset(a.InputObj) ? app.selectedObjects : listOf(a.InputObj);   // inferred: unset InputObj = the selection
  const { params, objs } = storeParams(app, input);
  const mref = first(a.Model);
  const model = (mref instanceof Node && clipRefArg(app, mref)?.model) || modelArgB20(app, mref) || objs[0]?.model || ownerObj(params[0])?.model || app.scene.root;
  const consider = truthy(a['Consider Time']); const s0 = numArg(a.StartFrame, 0), e0 = numArg(a.EndFrame, 0);
  const inRange = (t: number) => !consider || (t >= s0 - 1e-9 && t <= e0 + 1e-9);
  const values: Record<string, number> = {}; const curves: Record<string, { time: number; value: number; interp?: number }[]> = {}; const exprs: Record<string, string> = {};
  const stored: Parameter[] = [];
  for (const p of params) {
    let here = false;
    const fc = app.anim.fcurves.get(p);
    if ((mask & 2) && fc?.keys.length) { const keys = fc.keys.filter(k => inRange(k.time)); if (keys.length) { curves[p.fullName] = keys.map(k => ({ time: k.time, value: k.value, interp: k.interp })); here = true; stored.push(p); } }
    const ex = app.anim.expression(p);
    if ((mask & 4) && ex) { exprs[p.fullName] = ex; here = true; if (!stored.includes(p)) stored.push(p); }
    if ((mask & 1) && !here) values[p.fullName] = Number(p.value);
  }
  if (mask & 8) { const n = objs.reduce((s, o) => s + o.properties.filter(c => c instanceof Constraint).length, 0); if (n) logNya(app, C, `storing ${n} constraint(s) (class mask 8); they are not stored`); }
  if (truthy(a.Ripple) || truthy(a.IncludeAnimLayers)) logNya(app, C, 'the effect of Ripple / IncludeAnimLayers inside the store worker');
  if (!Object.keys(values).length && !Object.keys(curves).length && !Object.keys(exprs).length) { app.logMsg('info', `${C}: nothing to store`); setStatus(app, C, S_FALSE); return null; }
  const src = makeSource(uniqueIn(model.properties.map(p => p.name), String(a.Name || 'StoredAction')), values, curves);
  src.set('expressions', JSON.stringify(exprs)); src.set('items', new Set([...Object.keys(values), ...Object.keys(curves), ...Object.keys(exprs)]).size); src.set('mode', modeN);
  if (consider) { (src as any).frameStart = s0; (src as any).frameEnd = e0; }
  (src as any).storageKind = kind;
  if (kind === 1) { mixerFor(app, C, model); app.record(C, () => model.addProperty(src), () => model.removeProperty(src)); }
  else { (src as any).transient = kind === 2; logNya(app, C, `the ${kind === 2 ? 'transient' : 'unowned'} storage kind (${kind}); the source is returned without an owner`); }
  if (truthy(a.RemoveAnim)) {
    logNya(app, C, 'the exact effect of RemoveAnim inside the store worker; the stored fcurves / expressions are removed from the parameters');
    for (const p of stored) {
      const fc = app.anim.fcurves.get(p); const ex = app.anim.expressions.get(p);
      app.record(C, () => app.anim.removeAnimation(p), () => { if (fc) app.anim.fcurves.set(p, fc); if (ex) app.anim.expressions.set(p, ex); });
    }
    app.events.emit('params');
  }
  setStatus(app, C, S_OK);
  return src;
}

// ===================================================================== Plot commands (confirmations)
function plotSamples(app: App, params: Parameter[], frames: number[]): Record<string, { time: number; value: number; interp: number }[]> {
  const prev = app.anim.frame; const out: Record<string, { time: number; value: number; interp: number }[]> = {};
  for (const p of params) out[p.fullName] = [];
  for (const f of frames) { app.anim.frame = f; for (const p of params) out[p.fullName].push({ time: f, value: Number(p.value), interp: 3 }); }
  app.anim.frame = prev;
  return out;
}
function rangeFrames(app: App, s: number, e: number, step: number): number[] {
  if (s === 0 && e === 0) { s = app.anim.startFrame; e = app.anim.endFrame; }   // inferred: 0 / 0 = the play range
  const st = step > 0 ? step : 1; const out: number[] = []; for (let f = s; f <= e + 1e-9; f += st) out.push(f); return out;
}
function plotTask(app: App, C: string, a: Args, perModel: boolean) {
  let frames: number[];
  const type = C === 'PlotToAction' ? 0 : C === 'PlotToActions' ? 0 : Math.trunc(numArg(a.Type, 0));
  if (type === 0) frames = rangeFrames(app, numArg(a.StartFrame, 0), numArg(a.EndFrame, 0), numArg(a.StepFrame, 1));
  else if (type === 1) {
    if (!Array.isArray(a.FrameSet)) throw fail(C, E_INVALIDARG, 'FrameSet must be an array of frames');
    frames = a.FrameSet.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
  } else { logNya(app, C, `plot Type ${type} (no frame arguments are read)`); frames = []; }
  logNya(app, C, 'the plot worker (FCurve Kind, DefaultSegKind, Fit FCurve, Fit Tolerance, ProcessContRots); the values are sampled at the plot frames into spline keys');
  const input = unset(a.InputObj) ? app.selectedObjects : listOf(a.InputObj);   // inferred: unset InputObj = the selection
  const { params } = storeParams(app, input);
  const keyable = params.filter(p => p.animatable !== false);
  if (!keyable.length || !frames.length) { setStatus(app, C, S_FALSE); return perModel ? [] : null; }
  const groups = new Map<Model, Parameter[]>();
  const fixed = C === 'PlotToAction' ? modelArgB20(app, a.Model) : undefined;
  for (const p of keyable) { const m = fixed ?? ownerObj(p)?.model ?? app.scene.root; if (!groups.has(m)) groups.set(m, []); groups.get(m)!.push(p); }
  const made: Property[] = [];
  for (const [model, ps] of groups) {
    const src = makeSource(uniqueIn(model.properties.map(p => p.name), String(a.Name || 'Action')), {}, plotSamples(app, ps, frames));   // inferred: default name
    (src as any).frameStart = frames[0]; (src as any).frameEnd = frames[frames.length - 1];
    mixerFor(app, C, model); app.record(C, () => model.addProperty(src), () => model.removeProperty(src));
    made.push(src);
  }
  setStatus(app, C, S_OK);
  return perModel ? made : made[0];
}

// ===================================================================== ApplyAction / GetDrivingActions (confirmations)
function applyAction(app: App, a: Args) {
  const C = 'ApplyAction';
  const x = first(a.Source);
  let src = actionSourceArg(app, x);
  if (!src && x instanceof Model) { src = x.properties.filter(p => isActionSource(p)).pop(); logNya(app, C, 'a model as Source (its last action source is applied)'); }
  if (!src && unset(x)) src = (app.selection.find(n => isActionSource(n)) as Property | undefined) ?? (app.selectedObjects[0]?.model ?? app.scene.root).properties.filter(p => isActionSource(p)).pop();   // inferred: unset = the selected source
  if (!src) throw fail(C, E_POINTER, 'Source is missing or is not an action source');
  if (!unset(a.Target)) logNya(app, C, 'Target (retargeting the items onto another model); the items are applied by their paths');
  if (truthy(a['Consider Time']) || truthy(a.Ripple) || truthy(a.RemoveLayerAnimation)) logNya(app, C, 'Consider Time / StartFrame / EndFrame / Ripple / RemoveLayerAnimation inside the apply worker');
  const values = sourceValues(src); const curves = sourceFcurves(src);
  const look = (path: string) => findParamPath(app, path) ?? findParam(app, path) ?? paramByPath(app, path);
  let n = 0;
  for (const [path, v] of Object.entries(values)) { const p = look(path); if (p && !curves[path]?.length) { app.setParam(p, v); n++; } }
  for (const [path, keys] of Object.entries(curves)) {
    const p = look(path); if (!p || !keys?.length) continue;
    const old = app.anim.fcurve(p)?.keys.map(k => ({ ...k }));
    const nk = keys.map(k => ({ time: k.time, value: k.value, left: k.left ?? k.value, right: k.right ?? k.value, interp: k.interp ?? 3 }));
    app.record(C, () => { const fc = app.anim.fcurve(p, true)!; fc.keys = nk.map(k => ({ ...k })); }, () => { if (old) app.anim.fcurve(p, true)!.keys = old; else app.anim.fcurves.delete(p); });
    n++;
  }
  app.events.emit('params'); app.events.emit('frame');
  setStatus(app, C, n ? S_OK : S_FALSE);
  return undefined;
}
function getDrivingActions(app: App, a: Args) {
  const C = 'GetDrivingActions';
  const input = unset(a.InputObjs) ? app.selectedObjects : listOf(a.InputObjs);   // inferred: unset = the selection
  const objs = input.map(x => x instanceof X3DObject ? x : objOf(app, x) ?? ownerObj(x)).filter((o): o is X3DObject => !!o);
  const models = [...new Set(objs.map(o => (o instanceof Model ? o : o.model) ?? app.scene.root))];
  const consider = truthy(a['Consider Time']); const time = unset(a.Time) ? app.anim.frame : Number(a.Time);
  const keepCpd = truthy(a['Keep Compound Actions']); const keepInactive = truthy(a['Keep Inactive Actions']);
  const names = new Set(objs.map(o => o.name));
  const out: Property[] = [];
  for (const r of clipRefs(app)) {
    if (!models.includes(r.model)) continue;
    if (!keepInactive && r.clip.mute) continue;
    if (consider && !(time >= r.clip.start && time < end(r.clip))) continue;
    if (isCompoundRecord(r.clip)) { if (keepCpd) logNya(app, C, 'the action of a compound clip (compounds carry no source in this build)'); continue; }
    const src = sourceOf(r); if (!src || out.includes(src)) continue;
    // a source drives the input when one of its items belongs to an input object
    if (itemsOf(src).some(p => names.has(p.split('.')[0]) || [...names].some(n => p.includes(`.${n}.`)))) out.push(src);
  }
  setStatus(app, C, S_OK);
  return out;
}

// ===================================================================== shape key confirmations
function storeShapeKey() {
  return (app: App, a: Args) => {
    const C = 'StoreShapeKey';
    const items = unset(a.InputObj) ? app.selectedObjects : listOf(a.InputObj);
    // UnPack: the first cluster (kinds 6 / 7), else the first object with geometry
    const cl = items.find(x => x instanceof Cluster) as Cluster | undefined;
    if (cl) logNya(app, C, 'a cluster as InputObj (the key is stored on the cluster\'s object)');
    const o = cl?.obj ?? items.map(x => x instanceof X3DObject ? x : objOf(app, x)).find(x => x?.primitive?.mesh());
    const key = storeShapeKeyBody(app, { InputObj: o ? [o] : a.InputObj, Name: a.Name, Frame: a.Frame }) as Property;
    if (key instanceof Property) {
      const mode = refModeArg(a.RefMode, 2);
      if (key.get('refmode')) key.set('refmode', mode); else key.add(int('refmode', mode, 'Reference Mode', { readOnly: true }));
    }
    if (!unset(a.Frame) || numArg(a.Duration, 0) || numArg(a.Sampling, 0) || truthy(a['Force deform stripping'])) logNya(app, C, 'Frame / Duration / Sampling (the shape clip) and Force deform stripping inside the store worker');
    logNya(app, C, `Content ${String(a.Content ?? '')} (the shape content selection of the store worker)`);
    setStatus(app, C, S_OK);
    return key;
  };
}
function selectShapeKey(app: App, a: Args) {
  const C = 'SelectShapeKey';
  const items = unset(a.InputObj) ? app.selectedObjects : listOf(a.InputObj);
  // UnPack: the first cluster of the input, else the first model's primitive
  const cl = items.find(x => x instanceof Cluster) as Cluster | undefined;
  const target = cl?.obj ?? items.map(x => x instanceof X3DObject ? x : objOf(app, x)).find(x => !!x?.primitive?.mesh());
  if (!target) { setStatus(app, C, S_FALSE); return null; }
  const srcObj = objOf(app, a.SourceObj);
  logNya(app, C, 'the select-shape worker (RefMode / ApplyKeys / Relational); inferred from the public SDK description: the source object\'s shape is stored as a key of the target');
  if (!srcObj?.primitive?.mesh()) { const keys = target.properties.filter(isShapeKey); if (keys.length) app.select(keys); setStatus(app, C, S_FALSE); return keys; }
  const pos = srcObj.primitive.mesh()!.positions; const tmesh = target.primitive!.mesh()!;
  if (pos.length !== tmesh.positions.length) throw fail(C, E_FAIL, `${srcObj.name} and ${target.name} have different point counts`);
  ensureShapeBase(target, tmesh.positions); ensureShapeOperator(target);
  const sk = new Property(app.scene.uniqueName(srcObj.name), 'shapekey', [str('data', JSON.stringify(Array.from(pos)), 'Positions', { readOnly: true }), int('points', pos.length / 3, 'Points', { readOnly: true }), num('weight', truthy(a.ApplyKeys) ? 1 : 0, 'Weight', { min: 0, max: 1, keyable: true }), int('refmode', refModeArg(a.RefMode, 0), 'Reference Mode', { readOnly: true })]);
  app.record(C, () => target.addProperty(sk), () => target.removeProperty(sk));
  evaluateShapes(target, true);
  setStatus(app, C, S_OK);
  return sk;
}
function applyShapeKey(app: App, a: Args) {
  const C = 'ApplyShapeKey';
  const x = unset(a.InputObj) ? (app.selection.find(isShapeKey) ?? app.selectedObjects[0]) : first(a.InputObj);
  const found = unset(x) ? null : shapeKeyOf(app, x) ?? (() => { const o = x instanceof X3DObject ? x : objOf(app, x); const k = o?.properties.find(isShapeKey); return o && k ? { key: k, obj: o } : null; })();
  if (!found) { setStatus(app, C, S_FALSE); return null; }
  logNya(app, C, 'the shape clip of the apply worker (Compound / Track / Time / Duration / Mode / Name / Overwrite); the key weight is set to 1');
  const w = found.key.get('weight'); if (w) app.setParam(w, 1);
  evaluateShapes(found.obj, true);
  app.events.emit('params');
  setStatus(app, C, S_OK);
  return found.key;
}
function convertShapeReferenceMode(app: App, a: Args) {
  const C = 'ConvertShapeReferenceMode';
  const mode = refModeArg(a.RefMode, 0);
  const items = unset(a.InputObj) ? [...app.selection] : listOf(a.InputObj);
  const keys: Property[] = [];
  for (const x of items) {
    if (isShapeKey(x)) { keys.push(x); continue; }
    const o = x instanceof X3DObject ? x : objOf(app, x); if (o) keys.push(...o.properties.filter(isShapeKey));
  }
  logNya(app, C, 'the value conversion of the convert worker (keys of this build are stored as absolute positions, so only the mode changes)');
  for (const k of keys) {
    const old = Number(k.val('refmode') ?? 0);
    app.record(C, () => { if (k.get('refmode')) k.set('refmode', mode); else k.add(int('refmode', mode, 'Reference Mode', { readOnly: true })); }, () => k.set('refmode', old));
  }
  setStatus(app, C, keys.length ? S_OK : S_FALSE);
  return undefined;
}

// ===================================================================== registration
export function registerActionB20aCommands(app: App) {
  b20a(app);
  reg(app, 'EqualizeAction', { description: 'Equalizes an action into frequency bands (Action Equalizer).', execute: equalizeAction });
  reg(app, 'ExportAction', { description: 'Exports an action source to a .eani or .xsi file.', undoable: false, execute: exportAction });
  reg(app, 'ImportAction', { description: 'Imports an action source from a file (internal copy).', execute: importAction('ImportAction') });
  reg(app, 'ImportRefAction', { description: 'Imports an action source as a reference to its file.', execute: importAction('ImportRefAction') });
  reg(app, 'ReplaceShapeKey', { description: 'Replaces a shape key with the current shape.', execute: replaceShapeKey });
  reg(app, 'SIStoreAction', { description: 'Stores parameters as an action source (low level).', execute: siStoreAction });
  reg(app, 'AddTransition', { description: 'Adds a transition between two clips.', execute: (app, a) => addTransitionWorker(app, 'AddTransition', a) });
  reg(app, 'AddTWTransition', { description: 'Adds a time warp (bridge) transition between two overlapping clips.', execute: addTWTransition });
  reg(app, 'AddMarker', { description: 'Adds a marker to a mixer container.', execute: addMarker });
  reg(app, 'ReconnectMixer', { description: 'Reconnects the animation mixer.', undoable: false, execute: reconnectMixer });
  reg(app, 'SwapRelationMasterAndSlaveClip', { description: 'Swaps the master and slave clips of a clip relation.', execute: swapRelation });
  reg(app, 'AddClipRelation', { description: 'Adds a relation between two clips.', execute: addClipRelation });
  reg(app, 'AddClip', { description: 'Adds a clip of a source to the mixer.', execute: (app, a) => nodeOf(addClipWorker(app, 'AddClip', a)) });
  reg(app, 'CopyClipToTrack', { description: 'Copies a clip to a track.', execute: (app, a) => clipToTrack(app, 'CopyClipToTrack', a) });
  reg(app, 'MoveClipToTrack', { description: 'Moves a clip to a track.', execute: (app, a) => clipToTrack(app, 'MoveClipToTrack', a) });
  reg(app, 'CreateCompound', { description: 'Creates a compound clip from clips.', execute: (app, a) => nodeOf(createCompoundWorker(app, 'CreateCompound', a)) });
  reg(app, 'ExplodeCompound', { description: 'Explodes a compound clip.', execute: explodeCompound });
  reg(app, 'PlotToAction', { description: 'Plots parameters into an action source.', execute: (app, a) => plotTask(app, 'PlotToAction', a, false) });
  reg(app, 'PlotToActions', { description: 'Plots parameters into action sources (one per model).', execute: (app, a) => plotTask(app, 'PlotToActions', a, true) });
  reg(app, 'PlotFrameSetToActions', { description: 'Plots parameters at a frame set into action sources.', execute: (app, a) => plotTask(app, 'PlotFrameSetToActions', a, true) });
  reg(app, 'ApplyAction', { description: 'Applies an action source.', execute: applyAction });
  reg(app, 'GetDrivingActions', { description: 'Returns the action sources driving the objects.', undoable: false, execute: getDrivingActions });
  reg(app, 'CollapseLayers', {
    description: 'Collapses the animation layers.',
    execute(app, a) {
      // PlottingType is not read by UnPack: the constructor value 1 is always used
      if (Number(a.PlottingType ?? 1) !== 1) app.logMsg('info', `CollapseLayers: PlottingType ${a.PlottingType} is not read; 1 is used`);
      logNya(app, 'CollapseLayers', 'the collapse worker (StartFrame / EndFrame / StepFrame / Fit FCurve / Fit Tolerance); the earlier layer collapse is used');
      return collapseLayersBody(app, { ...a, PlottingType: 1 });
    },
  });
  reg(app, 'StoreShapeKey', { description: 'Stores the current shape as a shape key.', execute: storeShapeKey() });
  reg(app, 'SelectShapeKey', { description: 'Stores the shape of a source object as a shape key of the target.', execute: selectShapeKey });
  reg(app, 'ApplyShapeKey', { description: 'Applies a shape key.', execute: applyShapeKey });
  reg(app, 'ConvertShapeReferenceMode', { description: 'Converts the reference mode of shape keys.', execute: convertShapeReferenceMode });
  reg(app, 'LinkDeformWithOri', {
    description: 'Links a deformation with the orientation of a parameter.',
    execute(app, a) {
      logNya(app, 'LinkDeformWithOri', 'the link worker (UnPack reads Cluster, LinkWithOri, Parameter list); LinkDeform is run');
      return app.commands.has('LinkDeform') ? app.run('LinkDeform', { Cluster: a.Cluster, 'Parameter list': a['Parameter list'], LinkWithOri: a.LinkWithOri }) : undefined;
    },
  });
  (app as any).actionB20a.registered = [...registered];
  (app as any).actionB20aApi = { equalizerBands, bandLowPass, ROW, trackArg, roomOnTrack, markersOf };
}
export { ROW as B20A_ROW };
