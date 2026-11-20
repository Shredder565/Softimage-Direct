// Ledger row CMD-B16e: optasks.dll TransferAllPropertiesAcrossGenOp, actioncore.dll AddShotClip / GetShotClip,
// gap.dll PaintWeights.
// Brief: the "Wire contract" paragraphs of docs/ghidra/cmd-b16e-actioncore-optasks-gap-environments.md and items 38-42
// of docs/re/WIRE_CORRECTIONS_B16.md. Original code written from that prose only; no XSIBATCH golden exists.
//
// These four registrations replace the earlier inferred ones (AddShotClip / GetShotClip in inferredB10CamSeq.ts,
// PaintWeights in inferredB15.ts; TransferAllPropertiesAcrossGenOp was only delegated to by operatorsScripts.ts).
// Mapping onto this build:
//  * Failures are thrown as SiStatusError (message starts with the command name, "(status 0x...)").
//  * Output arguments are kept in `app.cmdB16e.out[<command>]` (only the outputs the RePack step sets); the command
//    result is the contract's return value (Value / Clip / OutputObj; GetShotClip returns its outputs as before).
//  * Sub-tasks the contract runs are recorded in `app.cmdB16e.subtasks` (newest last) with their arguments.
//  * What the contract marks (inferred) or leaves open is marked `// inferred` here; branches that cannot be settled
//    log "<command>: not yet attested: <what> (CMD-B16e)".
import { App } from '../core/commands';
import { Node, X3DObject, Cluster, Property, Material, Camera, mixerOf } from '../core/scene';
import { EnvelopeOperator, envelopeOf } from '../core/envelope';
import { SiStatusError } from './alembicSeqCam';
import { cameraSequencer, TRACK_CAMERA_SHOT, type ClipX, type CamTrack } from '../core/mixerActionScripts';
import { B10_ARGS, B10_DESC } from './inferredB10Args';
import { isLocked } from './inferredB10Scene';
import {
  ERR_GENERATOR, ERR_OBJECT, ERR_PROPERTY, raiseInvalid, nodeArg, nodesArg, boolArg, isGenerator, genInputs, genOwner,
} from './optasksB12eShared';

const ROW = 'CMD-B16e';
export const S_OK = 0, E_INVALIDARG = 0x80070057, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff,
  E_ACCESSDENIED = 0x80070005;
/** XSIACTIONCORE message ids named by the contract (texts are not in the repository). */
export const MSG_NO_SLOT = 0x18, MSG_BAD_PARENT = 0x27, MSG_TRIMMED = 0x69;

export interface B16eState {
  out: Record<string, Record<string, any>>;
  subtasks: { command: string; task: string; args: Record<string, any> }[];
  status: Record<string, number>;
}
export function b16e(app: App): B16eState {
  return ((app as any).cmdB16e ??= { out: {}, subtasks: [], status: {} } as B16eState);
}
const fail = (cmd: string, status: number, what: string) => new SiStatusError(status, `${cmd}: ${what}`);
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
const unset = (v: any) => v === undefined || v === null || v === '';
const num = (v: any, d: number) => { const n = Number(v); return unset(v) || !Number.isFinite(n) ? d : n; };
const list = (v: any): any[] => unset(v) ? [] : Array.isArray(v) ? v : ArrayBuffer.isView(v) ? Array.from(v as any) : [v];
function subtask(app: App, command: string, task: string, args: Record<string, any>) { b16e(app).subtasks.push({ command, task, args }); }
/** A lock of any level on the element (lock records of this build; "any lock but ref-model": no ref-model locks here). */
const locked = (app: App, n: any) => n != null && isLocked(app, n, 0xffff);

// ====================================================================== TransferAllPropertiesAcrossGenOp
/** Material category (F3DGetMaterialCatID) of this build's items. */
const CAT_MATERIAL = 'material';
/** The two categories that are always skipped (806385b5-... and c57a3140-...). inferred: in this build they stand for
 *  the object's own built-in properties (kinematics, visibility), which the generated object already carries. */
const ALWAYS_SKIPPED = new Set(['kinematics', 'visibility']);
/** inferred: the name -> category map of the operator's transfer helper (names are not literals in the binary). */
const CATEGORY_NAMES: Record<string, string> = {
  material: CAT_MATERIAL, materials: CAT_MATERIAL, uv: 'uvspace', uvs: 'uvspace', 'texture projection': 'uvspace', textureprojection: 'uvspace',
  'vertex color': 'vertexcolor', vertexcolor: 'vertexcolor', cav: 'vertexcolor', 'weight map': 'weightmap', weightmap: 'weightmap',
  cluster: 'cluster', clusters: 'cluster', 'user data': 'userdatamap', userdata: 'userdatamap', 'user normal': 'usernormal',
};
/** One transferable item of the generator's inputs: kind 0 bare cluster, 1 cluster property, 2 object property / material. */
interface XferItem { node: Node; kind: number; category: string; name: string }
/** inferred stand-in for the operator's transfer helper: every item the inputs carry, grouped by category. */
function transferableItems(op: Node, target: X3DObject, includeAllClusters: boolean): XferItem[] {
  const out: XferItem[] = []; const seenMat = new Set<Material>();
  for (const o of genInputs(op)) {
    const m = o.material;
    if (m && !seenMat.has(m)) { seenMat.add(m); out.push({ node: m, kind: 2, category: CAT_MATERIAL, name: m.name }); }
    for (const p of o.properties) {
      if (p instanceof Material) continue;
      // inferred: a property kind the generated object already has is its own (geometry approximation, display ...)
      if (target.properties.some(q => q.type === p.type)) continue;
      out.push({ node: p, kind: 2, category: p.type, name: p.name });
    }
    for (const c of o.clusters) {
      if (c.properties.length) for (const p of c.properties) out.push({ node: p, kind: 1, category: p.type, name: p.name });
      else if (includeAllClusters) out.push({ node: c, kind: 0, category: 'cluster', name: c.name });
    }
  }
  return out;
}
function transferAll(app: App, a: Record<string, any>) {
  const C = 'TransferAllPropertiesAcrossGenOp';
  // UnPackArg: PropertyTransferType
  const typeName = String(a.PropertyTransferType ?? '').trim();
  let only: string | null = null;
  if (typeName) {
    const key = typeName.toLowerCase();
    only = CATEGORY_NAMES[key] ?? null;
    if (!only) throw fail(C, E_INVALIDARG, `unknown PropertyTransferType "${typeName}"`);
    nya(app, C, `the transfer helper's name -> category table; "${typeName}" read as category ${only}`);
  }
  // Do: null checks, then validation 0x111 / 0x112 / 0x115
  const op = nodeArg(app, a.Operator, false), obj = nodeArg(app, a.Object, false);
  if (!op || !obj) throw fail(C, E_POINTER, 'Operator and Object are required');
  if (!isGenerator(op) || genOwner(op) !== obj) throw raiseInvalid(app, C, ERR_GENERATOR, `${op.name} is not a generator operator of ${obj.name}`);
  if (!(obj instanceof X3DObject) || !obj.primitive) throw raiseInvalid(app, C, ERR_OBJECT, `${obj.name} has no geometry`);
  if (only === 'kinematics' || only === 'visibility') throw raiseInvalid(app, C, ERR_PROPERTY, `category ${only} cannot be transferred`);   // inferred (0x115)
  const share = boolArg(a.ShareProperty, true), includeAll = boolArg(a.IncludeAllClusters, false);
  const allMode = only === null || only === CAT_MATERIAL;
  const value: Node[] = [];
  const items = transferableItems(op, obj, includeAll);
  nya(app, C, 'the per-item classification helper; bare clusters are kind 0, cluster properties kind 1, object properties and materials kind 2');
  const groups = new Map<string, XferItem[]>();
  for (const it of items) { const g = groups.get(it.category) ?? []; g.push(it); groups.set(it.category, g); }
  const srcClusterProps: Node[] = [], dstClusterProps: Node[] = [];
  for (const [cat, group] of groups) {
    if (ALWAYS_SKIPPED.has(cat)) continue;
    if (!allMode && cat !== only) continue;
    if (only === CAT_MATERIAL && cat !== CAT_MATERIAL) continue;   // inferred: "material" names one category like the others
    for (const it of group) {
      let r: any;
      if (it.kind === 0) {
        subtask(app, C, 'SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: obj, ClustersToTransfer: it.node, ClusterName: it.name });
        r = app.run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: obj, ClustersToTransfer: it.node, ClusterName: it.name });
      } else if (it.kind === 1) {
        subtask(app, C, 'TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: obj, ClusterPropsToTransfer: it.node, ClusterPropertyName: it.name, RebindClusterProperties: false });
        try { r = app.run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: obj, ClusterPropsToTransfer: it.node, ClusterPropertyName: it.name, RebindClusterProperties: false }); }
        catch (e: any) { if (e instanceof SiStatusError && e.status === E_INVALIDARG) continue; throw e; }   // 0x80070057 tolerated: item skipped
        const got = list(r); srcClusterProps.push(it.node); dstClusterProps.push(...got);
      } else if (it.kind === 2) {
        subtask(app, C, 'TransferPropertiesAcrossGenOp', { Operator: op, Object: obj, PropertiesToTransfer: it.node, PropertyName: it.name, ShareProperty: share, TransferClusterProperties: false });
        r = app.run('TransferPropertiesAcrossGenOp', { Operator: op, Object: obj, PropertiesToTransfer: it.node, PropertyName: it.name, ShareProperty: share, TransferClusterProperties: false });
      } else throw fail(C, E_UNEXPECTED, `unknown transfer kind ${it.kind}`);
      for (const x of list(r)) if (x) value.push(x);
    }
  }
  // "all" mode: one SIRebindByNameUserData per material entry of the material category
  if (allMode) for (const it of groups.get(CAT_MATERIAL) ?? []) {
    // inferred: the source / target user-data lists are the cluster properties transferred above and their new copies
    if (!srcClusterProps.length || !dstClusterProps.length) { nya(app, C, `the user-data lists of material ${it.name} (no cluster property was transferred; no rebind run)`); continue; }
    const args = { Material: it.node, 'Source User Data Collection': srcClusterProps, 'Target User Data Collection': dstClusterProps };
    subtask(app, C, 'SIRebindByNameUserData', args);
    if (app.commands.has('SIRebindByNameUserData')) app.run('SIRebindByNameUserData', args);
  }
  a.Value = value; b16e(app).out[C] = { Value: value }; b16e(app).status[C] = S_OK;
  return value;
}

// ====================================================================== Camera Sequencer
/** A shot clip occupies the sequence frames [start, start + (clipout - clipin)] (duration = that length + 1 frames). */
const clipLen = (c: ClipX) => { const t = c.timectrl as any; return t && Number.isFinite(Number(t.clipout)) && Number.isFinite(Number(t.clipin)) ? Number(t.clipout) - Number(t.clipin) : Number(c.duration) - 1; };
const seqIn = (c: ClipX) => Number(c.start);
const seqEnd = (c: ClipX) => seqIn(c) + clipLen(c);
const isShot = (c: ClipX) => (c.type ?? 'camerashotclip') === 'camerashotclip';
const shotTracks = (app: App) => cameraSequencer(app.scene.root).tracks;
/** The shot track Track names or contains: a track record, a track name / path, or a container (first track under it). */
function shotTrackOf(app: App, v: any): CamTrack | null {
  const tracks = shotTracks(app);
  for (const x of list(v)) {
    if (x && typeof x === 'object' && Array.isArray((x as any).clips) && tracks.includes(x as CamTrack)) return x as CamTrack;
    const s = String((x as any)?.fullName ?? (x as any)?.name ?? x);
    const last = s.split('.').pop()!;
    const t = tracks.find(k => k.name === s || k.name === last);
    if (t) return t;
    if (/^(Scene_Root\.)?(Camera_Sequencer|Mixer)(\.Tracks)?(\.CameraShotTracks)?$/.test(s) && tracks.length) return tracks[0];   // inferred: a container -> its shot track
  }
  return null;
}
/** inferred stand-in for GetInsertedClipBounds(track, start, length): the first frame >= start that no clip of the track
 *  covers, and the start of the next clip after it (Infinity when none). */
function insertedClipBounds(track: CamTrack, start: number): { start: number; nextStart: number } {
  const clips = track.clips.filter(isShot).sort((x, y) => seqIn(x) - seqIn(y));
  let p = start; let moved = true;
  while (moved) { moved = false; for (const c of clips) if (p >= seqIn(c) && p <= seqEnd(c)) { p = seqEnd(c) + 1; moved = true; } }
  const next = clips.filter(c => seqIn(c) > p - 1).map(seqIn);
  return { start: p, nextStart: next.length ? Math.min(...next) : Infinity };
}
function addShotClip(app: App, a: Record<string, any>) {
  const C = 'AddShotClip';
  // UnPackArg
  let track = unset(a.Track) ? null : shotTrackOf(app, a.Track);
  if (!unset(a.Track) && !track) nya(app, C, `no shot track under ${String((a.Track as any)?.name ?? a.Track)}; the scene's shot track is used`);
  const frameSet = !unset(a.Frame);
  let frame = num(a.Frame, NaN);
  const startGiven = !unset(a.StartFrame), endGiven = !unset(a.EndFrame);
  const start = num(a.StartFrame, app.anim.startFrame);   // inferred: no StartFrame -> the scene start frame
  const end = num(a.EndFrame, 100);
  const len = end - start;
  // Worker (1)
  if (!frameSet || !Number.isFinite(frame)) throw fail(C, E_FAIL, 'Frame is required');   // inferred status (the contract says "fails")
  if (endGiven && end < start) throw fail(C, E_FAIL, 'EndFrame is before StartFrame');
  if (!startGiven) nya(app, C, `no StartFrame: clip-in left at the scene start frame ${start}`);
  // the free slot (UnPackArg, when a track was found)
  let nextStart = Infinity;
  if (track) {
    const b = insertedClipBounds(track, frame + 1);   // GetInsertedClipBounds(track, Frame + 1 frame, (End - Start) - 1 frame)
    if (!Number.isFinite(b.start)) { app.logMsg('error', `${C}: [XSIACTIONCORE ${hex(MSG_NO_SLOT)}] no free position on ${track.name}`); throw fail(C, E_FAIL, 'no free position on the track'); }
    frame = b.start - 1; nextStart = b.nextStart;
  }
  // (2) lock on the given track
  if (track && locked(app, track)) throw fail(C, E_ACCESSDENIED, `${track.name} is locked`);
  // (3) Parent -> camera name. inferred (helper 0x1800407c0 not read): an object of the scene by name; empty = none
  let parentName = '';
  if (!unset(a.Parent)) {
    const p = a.Parent instanceof X3DObject ? a.Parent : app.scene.find(String(a.Parent)) ?? app.scene.find(String(a.Parent).replace(/^Scene_Root\./, ''));
    if (!p) { app.logMsg('error', `${C}: [XSIACTIONCORE ${hex(MSG_BAD_PARENT)}] ${String(a.Parent)}`); throw fail(C, E_FAIL, `Parent ${String(a.Parent)} cannot be resolved`); }
    if (!(p instanceof Camera) && p.type !== 'camera') nya(app, C, `a Parent that is not a camera (${p.name}); its name is stored as the clip's camera`);
    parentName = p.name;
  } else nya(app, C, 'what an empty Parent resolves to; the clip has no camera');
  // (4) the track: given, or the scene's existing shot track, or a new one (AddTrack)
  const tracks = shotTracks(app); let made: CamTrack | null = null;
  const container = cameraSequencer(app.scene.root);
  if (!track) {
    track = tracks[0] ?? null;
    if (!track) {
      const args = { Model: app.scene.root.name, Compound: null, Type: TRACK_CAMERA_SHOT, Name: '', InsertPosition: -1 };
      subtask(app, C, 'AddTrack', args);
      const mix: any = mixerOf(app.scene.root); const rows0 = [...(mix.trackRows ?? [])];
      if (app.commands.has('AddTrack')) app.run('AddTrack', args);
      const rows1 = [...(mix.trackRows ?? [])];
      app.record('AddTrack', () => { mix.trackRows = [...rows1]; }, () => { mix.trackRows = [...rows0]; });
      made = { name: 'Shot_Track', clips: [] };   // inferred: name of the new shot track
      const t = made; app.record('AddTrack', () => { if (!tracks.includes(t)) tracks.push(t); }, () => { const i = tracks.indexOf(t); if (i >= 0) tracks.splice(i, 1); });
      track = made;
    }
    const b = insertedClipBounds(track, frame + 1); frame = b.start - 1; nextStart = b.nextStart;   // inferred: the free slot on the found track
  }
  if (locked(app, container) || locked(app, mixerOf(app.scene.root))) throw fail(C, E_ACCESSDENIED, 'the Camera Sequencer is locked');
  // (5) the clip; (6) time control
  const clip: ClipX = { name: String(a.Name || 'Shot'), source: parentName, start: frame, duration: len + 1, type: 'camerashotclip',
    timectrl: { clipin: start, clipout: end, scale: 1 } };
  (clip as any).camera = parentName;   // parameter id 9: the clip's camera reference (inferred)
  const t = track;
  // (7) overlap with the next clip -> add, then CutClip siTrimAfter at the free end
  const trimmed = t.clips.length > 0 && frame + len > nextStart;
  app.record(C, () => { if (!t.clips.includes(clip)) t.clips.push(clip); }, () => { const i = t.clips.indexOf(clip); if (i >= 0) t.clips.splice(i, 1); });
  if (trimmed) {
    const time = nextStart, oldEnd = frame + len;
    subtask(app, C, 'CutClip', { Clip: clip, Mode: 3, Time: time });
    // inferred: CutClip of this build cuts mixer clip records; its siTrimAfter result on a shot clip (out point at Time)
    // is applied to the sequencer record directly
    const before = { duration: clip.duration, clipout: (clip.timectrl as any).clipout };
    const newLen = time - frame;
    app.record('CutClip', () => { clip.duration = newLen + 1; (clip.timectrl as any).clipout = start + newLen; }, () => { clip.duration = before.duration; (clip.timectrl as any).clipout = before.clipout; });
    app.logMsg('info', `${C}: [XSIACTIONCORE ${hex(MSG_TRIMMED)}] ${clip.name} trimmed: new end ${time}, old end ${oldEnd}`);   // severity 8 (verbose); inferred reading of the values
  }
  b16e(app).out[C] = { Clip: clip, Track: t, Container: container, Name: clip.name, Parent: parentName };
  b16e(app).status[C] = S_OK;
  return clip;
}
const hex = (n: number) => '0x' + n.toString(16);

/** The clip directly over a sequence frame. */
function clipAt(app: App, f: number): ClipX | null {
  for (const t of shotTracks(app)) for (const c of t.clips) if (isShot(c) && f >= seqIn(c) && f <= seqEnd(c)) return c;
  return null;
}
function getShotClip(app: App, a: Record<string, any>) {
  const C = 'GetShotClip';
  const f = num(a.Frame, 0); const wantGlobal = num(a.GlobalFrame, -1) !== -1;
  let clip = clipAt(app, f); const over = !!clip;
  if (!clip) {
    // inferred (open: decided in the sequencer service's DLL): the last clip that ends before the frame
    let best: ClipX | null = null;
    for (const t of shotTracks(app)) for (const c of t.clips) if (isShot(c) && seqEnd(c) < f && (!best || seqEnd(c) > seqEnd(best))) best = c;
    clip = best;
    nya(app, C, `which clip the sequencer returns at frame ${f}, outside every clip (${clip ? `the previous clip ${clip.name}` : 'none'} returned, not directly over)`);
  }
  const out: Record<string, any> = { DirectlyOver: over };
  if (clip) out.Clip = clip;
  if (wantGlobal) {
    // scene frame of the sequence frame: clip-in + offset in the clip (scale 1); outside a clip the frame itself (inferred)
    const sc = over && clip ? Number((clip.timectrl as any)?.clipin ?? clip.start) + (f - seqIn(clip)) * Number((clip.timectrl as any)?.scale ?? 1) : f;
    out.GlobalFrame = sc; a.GlobalFrame = sc;
  }
  const camName = clip ? String((clip as any).camera ?? clip.source ?? '') : '';
  const cam = camName ? app.scene.find(camName) ?? null : null;
  if (cam) out.ActiveCamera = cam;
  b16e(app).out[C] = out;
  const r: any = [clip ?? null, over, cam];
  return Object.assign(r, { Clip: clip ?? null, DirectlyOver: over, ActiveCamera: cam, GlobalFrame: wantGlobal ? out.GlobalFrame : -1 });
}

// ====================================================================== PaintWeights
/** The envelope and weight-paint data of InputObj's primitive (classes a3fe3cf0-... / 052f8861-..., inferred). */
function envelopeTarget(app: App, v: any): { obj: X3DObject; env: EnvelopeOperator } | null {
  let n: any = nodeArg(app, v, true);
  if (n instanceof Property && n.type === 'envelope' && (n as any).op instanceof EnvelopeOperator) { const op = (n as any).op as EnvelopeOperator; const o = op.owner(); return o ? { obj: o, env: op } : null; }   // inferred
  if (n instanceof Cluster) n = n.obj;
  if (!(n instanceof X3DObject)) return null;
  const env = envelopeOf(n);
  return env ? { obj: n, env } : null;
}
function paintWeights(app: App, a: Record<string, any>) {
  const C = 'PaintWeights';
  // UnPackArg
  const tgt = envelopeTarget(app, a.InputObj);
  if (!tgt) throw fail(C, E_INVALIDARG, 'InputObj has no envelope / weight-paint data on its primitive');
  if (unset(a.Indices) || unset(a.Weights)) throw fail(C, E_INVALIDARG, 'Indices and Weights are required');
  const idx = list(a.Indices).map(x => Math.trunc(Number(x)));
  const weightsArray = Array.isArray(a.Weights) || ArrayBuffer.isView(a.Weights);
  const w: number[] = weightsArray ? list(a.Weights).map(Number) : [];   // a scalar Weights stores no values
  const deformer = unset(a.Deformer) ? -1 : Math.trunc(Number(a.Deformer));
  if (!Number.isFinite(deformer) || deformer < -1) throw fail(C, E_INVALIDARG, `Deformer ${a.Deformer} is not valid`);   // inferred
  if (weightsArray && idx.length) {
    if (deformer >= 0 && w.length !== idx.length) throw fail(C, E_INVALIDARG, `${w.length} weights for ${idx.length} points`);
    if (deformer === -1 && w.length % idx.length !== 0) throw fail(C, E_INVALIDARG, `${w.length} weights is not a multiple of ${idx.length} points`);
  }
  const flags = Math.trunc(num(a.Flags, 0)); const normalize = boolArg(a.Normalize, true);
  const { obj, env } = tgt;
  // Worker: lock on the envelope
  if (locked(app, env) || locked(app, obj.allProperties().find(p => p.type === 'envelope' && (p as any).op === env))) throw fail(C, E_ACCESSDENIED, `the envelope of ${obj.name} is locked`);
  const nPts = (obj.primitive?.mesh()?.positions.length ?? 0) / 3;
  const nDef = env.deformers.length;
  // weight-paint data: created on the envelope when missing (helper 0x18001d0a0, inferred: one row per point)
  if (env.weights.length < nPts) {
    const old = env.weights;
    const rows = Array.from({ length: nPts }, (_, i) => old[i] ?? new Float32Array(nDef));
    app.record(C, () => { env.weights = rows; }, () => { env.weights = old; });
  }
  if (!idx.length || !w.length) throw fail(C, E_UNEXPECTED, 'Indices or Weights is empty');
  if (idx.some(i => i < 0 || i >= nPts)) throw fail(C, E_INVALIDARG, 'a point index is out of range');   // inferred
  if (deformer >= nDef) throw fail(C, E_INVALIDARG, `deformer ${deformer} of ${nDef}`);   // inferred
  if (flags) nya(app, C, `Flags ${flags}; the weights replace the old values`);
  const perPoint = deformer === -1 ? w.length / idx.length : 1;
  if (deformer === -1 && perPoint !== nDef) nya(app, C, `${perPoint} weights per point for ${nDef} deformers; the first ${Math.min(perPoint, nDef)} deformers are written`);
  // undo: the old weights of those points
  const before = new Map(idx.map(i => [i, Float32Array.from(env.weights[i] ?? new Float32Array(nDef))]));
  const after = new Map<number, Float32Array>();
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]; const row = Float32Array.from(after.get(i) ?? before.get(i)!);
    if (deformer >= 0) row[deformer] = w[k];
    else for (let d = 0; d < Math.min(perPoint, nDef); d++) row[d] = w[k * perPoint + d];
    if (normalize) normaliseRow(row, deformer);   // inferred normalisation rule
    after.set(i, row);
  }
  const prim = obj.primitive;
  app.record(C, () => { for (const [i, r] of after) env.weights[i] = Float32Array.from(r); if (prim) prim.dirty = true; },
    () => { for (const [i, r] of before) env.weights[i] = Float32Array.from(r); if (prim) prim.dirty = true; });
  if (normalize) nya(app, C, 'the Normalize rule (the other deformers are scaled so that each point sums to 1)');
  // OutputObj: not read (inside the weight-paint object). inferred: the envelope weight property
  const outObj = obj.allProperties().find(p => p.type === 'envelope' && (p as any).op === env) ?? env;
  b16e(app).out[C] = { OutputObj: outObj }; b16e(app).status[C] = S_OK;
  app.events.emit('scene');
  return outObj;
}
/** inferred: a painted deformer keeps its weight and the others share the rest; all deformers (-1) are rescaled together. */
function normaliseRow(row: Float32Array, d: number) {
  if (d < 0) { let s = 0; for (const x of row) s += x; if (s > 0) for (let j = 0; j < row.length; j++) row[j] /= s; return; }
  row[d] = Math.min(1, Math.max(0, row[d]));
  let rest = 0; for (let j = 0; j < row.length; j++) if (j !== d) rest += row[j];
  const left = 1 - row[d];
  if (rest > 0) for (let j = 0; j < row.length; j++) { if (j !== d) row[j] = row[j] / rest * left; }
  else if (row.length > 1 && left > 0) for (let j = 0; j < row.length; j++) { if (j !== d) row[j] = left / (row.length - 1); }
}

// ====================================================================== registration
export const B16E_COMMANDS = ['TransferAllPropertiesAcrossGenOp', 'AddShotClip', 'GetShotClip', 'PaintWeights'];
export function registerB16eCommands(app: App) {
  app.register({
    name: 'TransferAllPropertiesAcrossGenOp', label: 'Transfer All Properties Across Generator Operator', category: 'Modeling|Generator',
    description: 'Transfers every property (or one category) of a generator\'s inputs onto the generated object.',
    args: [{ name: 'Operator', default: null }, { name: 'Object', default: null }, { name: 'PropertyTransferType', default: '' }, { name: 'ShareProperty', default: true }, { name: 'IncludeAllClusters', default: false }],
    execute: transferAll,
  });
  app.register({
    name: 'AddShotClip', label: 'AddShotClip', category: 'Camera Sequencer', description: B10_DESC.AddShotClip ?? 'Create and add clip to the given track',
    args: B10_ARGS.AddShotClip.map(x => ({ ...x })), execute: addShotClip,
  });
  app.register({
    name: 'GetShotClip', label: 'GetShotClip', category: 'Camera Sequencer', description: B10_DESC.GetShotClip ?? 'Get current ShotClip given a sequence frame',
    undoable: false, args: B10_ARGS.GetShotClip.map(x => ({ ...x })), execute: getShotClip,
  });
  app.register({
    name: 'PaintWeights', label: 'Paint Weights', category: 'Property|Paint', description: 'Paint Weights',
    args: [{ name: 'InputObj', default: null }, { name: 'Indices', default: null }, { name: 'Weights', default: null }, { name: 'Flags', default: 0 }, { name: 'Deformer', default: 0 },
      { name: 'Normalize', default: true }, { name: 'OutputObj', default: null }],
    execute: paintWeights,
  });
}
