// Row CMD-B10 (inferred batch) Camera Sequencer commands, split out of inferredB10Scene.ts on 2026-11-19, and AddToTOC.
// GetSceneFrameSetFromCamSeq, PlotCamSeqToActions and PlotCamSeqShape follow the wire contracts of row CMD-B11g
// (docs/ghidra/cmd-b11g-action-camseq-b10-confirmations-binary.md, action.dll); AddToTOC follows row CMD-B11c
// (docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md, tasks.dll). AddShotClip / GetShotClip and the
// sequencer frame mapping (F3DGetGlobalFrameSetFromSequencerRange, not read) stay `// inferred`.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Camera } from '../core/scene';
import type { Parameter } from '../core/params';
import { str, int } from '../core/params';
import { findParam } from './index';
import { siString } from '../ui/si';
import { B10_ARGS } from './inferredB10Args';
import {
  cameraSequencer, mixerX, allModels, clipType, sourceOf, sourceItemsRaw, uniqueClipName, T_ANIM, T_ANIM_CPD, T_SHAPE, T_SHAPE_CPD, type ClipX, type ClipRef,
} from '../core/mixerActionScripts';
import { syncMixer } from '../core/scene';
import { b10, regB10, logNyaB10, unset, num, boolA, listOf, findObj, setStatus, S_WARN } from './inferredB10Shared';

const B11G = 'CMD-B11g';

// ====================================================================== Camera Sequencer stand-in
/** Camera Sequencer: the shot tracks of the existing stand-in (`cameraSequencer(root)`, src/core/mixerActionScripts.ts):
 *  a shot clip `{ name, source: camera, start: sequence frame, duration, type: 'camerashotclip', timectrl.clipin }` covers
 *  the sequence frames [start, start + duration) and maps them to the scene frames from clipin. */
type ShotClip = ClipX;
const seqIn = (c: ShotClip) => Number(c.start);
const seqOut = (c: ShotClip) => Number(c.start) + Number(c.duration);   // exclusive
const sceneFrame = (c: ShotClip, f: number) => Number(c.timectrl?.clipin ?? c.start) + (f - seqIn(c));   // inferred: no time scaling
const shotTracks = (app: App) => cameraSequencer(app.scene.root).tracks;
function clipAt(app: App, f: number): ShotClip | null {
  for (const t of shotTracks(app)) for (const c of t.clips) if ((c.type ?? 'camerashotclip') === 'camerashotclip' && f >= seqIn(c) && f < seqOut(c)) return c;
  return null;
}
/** Stand-in for the imported F3DGetGlobalFrameSetFromSequencerRange (B11g §2: one global frame per kept sequence frame, in
 *  sequence order). inferred: a gap frame keeps the sequence frame itself unless gaps are dropped; ceil(start)..end inclusive. */
function frameSet(app: App, s: number, e: number, withoutGaps: boolean): { seq: number; scene: number; clip: ShotClip | null }[] {
  const out: { seq: number; scene: number; clip: ShotClip | null }[] = [];
  for (let f = Math.ceil(s); f <= e; f++) { const c = clipAt(app, f); if (c) out.push({ seq: f, scene: sceneFrame(c, f), clip: c }); else if (!withoutGaps) out.push({ seq: f, scene: f, clip: null }); }
  return out;
}
/** XSIMSGCAT 463 at error severity, status 0x562e80c7, nothing created (B11g §2, empty frame set of the plot commands). */
function emptyFrameSet(app: App, C: string) {
  app.logMsg('error', `${C}: ${siString('XSIMSGCAT', 463) ?? 'Unable to plot Camera Sequencer unless there are shot clips.'}`);
  setStatus(app, C, S_WARN);
}
/** Sub-tasks run by the Camera Sequencer plot commands (registry names), newest last: `app.inferredB10.subtasks`. */
function subtaskB10(app: App, command: string, task: string, detail: string) { const st: any = b10(app); (st.subtasks ??= []).push({ command, task, detail }); }
const outputs = (pairs: Record<string, any>): any[] & Record<string, any> => Object.assign(Object.values(pairs), pairs);

/** siFCurveInterpolation (1 constant, 2 linear, 3 cubic) -> key interpolation of this build. */
const SEG_KIND: Record<string, number> = { siConstantInterpolation: 0, siLinearInterpolation: 1, siCubicInterpolation: 3, '1': 0, '2': 1, '3': 3 };
const constOf = (v: any) => { const s = String(v ?? '').trim(); return /^:([^:]+):/.exec(s)?.[1] ?? s; };

/** Parameters of an InputObjs argument: parameter paths as given, objects = their animated parameters (inferred). */
function paramsOf(app: App, arg: any): Parameter[] {
  const out: Parameter[] = []; const add = (p: Parameter | undefined) => { if (p && !out.includes(p)) out.push(p); };
  for (const x of listOf(arg)) {
    if (x && typeof x === 'object' && 'def' in x && 'owner' in x) { add(x as Parameter); continue; }
    const s = String(x?.fullName ?? x); const o = findObj(app, s);
    if (o && (o.name === s || o.fullName === s)) { for (const [p] of app.anim.fcurves) if (app.anim.isAnimated(p) && ownerObject(p) === o) add(p); }
    else add(findParam(app, s));
  }
  return out;
}
function ownerObject(p: Parameter): X3DObject | undefined { let n: any = (p as any).owner; while (n && !(n instanceof X3DObject)) n = n.parent; return n; }
/** Animated parameters under the current scene root model (B11g: animated test with source-type flag 4; inferred: fcurves). */
function animatedUnderRoot(app: App): Parameter[] {
  const out: Parameter[] = [];
  for (const [p] of app.anim.fcurves) { const o = ownerObject(p); if (app.anim.isAnimated(p) && (!o || o === app.scene.root || [...app.scene.allObjects()].includes(o))) out.push(p); }
  return out;
}

export function registerInferredB10CamSeq(app: App) {
  regB10(app, 'AddShotClip', { // inferred: Parent names the shot camera; Frame is the sequence position, StartFrame..EndFrame the scene frames (Q10 open)
    execute(app, a) {
      const tracks = shotTracks(app); const tname = unset(a.Track) ? 'Shot_Track' : String(listOf(a.Track)[0]).split('.').pop()!;
      let track = tracks.find(t => t.name === tname); const made = !track;
      if (!track) track = { name: tname, clips: [] };
      const cam = unset(a.Parent) ? [...app.scene.allObjects()].find(o => o instanceof Camera || o.type === 'camera') : findObj(app, String(a.Parent));
      const start = unset(a.StartFrame) ? app.anim.startFrame : num(a.StartFrame); const end = num(a.EndFrame, 100);
      if (end < start) throw new Error('AddShotClip: EndFrame is before StartFrame');
      const at = unset(a.Frame) ? (track.clips.length ? Math.max(...track.clips.map(seqOut)) : start) : num(a.Frame);
      const base = String(a.Name || 'Shot'); let name = base, i = 1; while (track.clips.some(c => c.name === name)) name = `${base}${i++}`;
      const clip: ShotClip = { name, source: cam?.name ?? '', start: at, duration: end - start + 1, type: 'camerashotclip', timectrl: { clipin: start, clipout: end } };
      const t = track;
      app.record('AddShotClip', () => { if (made && !tracks.includes(t)) tracks.push(t); t.clips.push(clip); }, () => { t.clips.splice(t.clips.indexOf(clip), 1); if (made) tracks.splice(tracks.indexOf(t), 1); });
      return clip;
    },
  });
  regB10(app, 'GetShotClip', { // inferred: GlobalFrame >= 0 is used instead of Frame; between clips the previous clip, not directly over (open, actioncore.dll)
    undoable: false,
    execute(app, a) {
      const f = num(a.GlobalFrame, -1) >= 0 ? num(a.GlobalFrame) : num(a.Frame);
      let clip = clipAt(app, f); const over = !!clip;
      if (!clip) { let best: ShotClip | null = null; for (const t of shotTracks(app)) for (const c of t.clips) if ((c.type ?? 'camerashotclip') === 'camerashotclip' && seqOut(c) <= f && (!best || seqOut(c) > seqOut(best))) best = c; clip = best; }
      const cam = clip ? findObj(app, String(clip.source)) ?? null : null;
      return outputs({ Clip: clip, DirectlyOver: over, ActiveCamera: cam });
    },
  });
  regB10(app, 'GetSceneFrameSetFromCamSeq', { // B11g §GetSceneFrameSetFromCamSeq: the import's frame list as a 1-D array (empty = [], no message); not undoable
    undoable: false,
    execute(app, a) { return frameSet(app, num(a.StartFrame, 1), num(a.EndFrame, 100), boolA(a.PlotWithoutGaps)).map(x => x.scene); },
  });

  regB10(app, 'PlotCamSeqToActions', { // B11g §PlotCamSeqToActions: plot into a real action source, apply it, delete the old driving clips
    execute(app, a) {
      const C = 'PlotCamSeqToActions';
      const explicit = !unset(a.InputObjs) && listOf(a.InputObjs).length > 0;
      // step 1: parameters
      const params = explicit ? paramsOf(app, a.InputObjs) : animatedUnderRoot(app);
      // step 2: frames
      const start = num(a.StartFrame, 1); const set = frameSet(app, start, num(a.EndFrame, 100), boolA(a.PlotWithoutGaps));
      if (!set.length) { emptyFrameSet(app, C); return; }
      // step 3: PlotFrameSetToActions (start = StartFrame, end = DBL_MAX, step 1, the frame array)
      if (!params.length) { logNyaB10(app, C, 'what PlotFrameSetToActions makes of an empty parameter list (no source is made here)', B11G); return []; }
      if (boolA(a['Fit FCurve'])) logNyaB10(app, C, `Fit FCurve (tolerance ${num(a['Fit Tolerance'], 0.01)}); the keys are kept one per frame`, B11G);
      const kind = constOf(a['FCurve Kind']); if (kind && kind !== 'siStandardFCurve' && kind !== '20') logNyaB10(app, C, `FCurve Kind ${kind}; standard fcurves are made`, B11G);
      const interp = SEG_KIND[constOf(a.DefaultSegKind) || 'siCubicInterpolation'] ?? 3;
      const A = app.anim; const saved = A.frame; const fcurves: Record<string, { time: number; value: number; interp: number }[]> = {}; const values: Record<string, number> = {};
      for (const p of params) { fcurves[p.fullName] = []; values[p.fullName] = Number(p.value); }
      try { set.forEach((x, k) => { A.frame = x.scene; for (const p of params) fcurves[p.fullName].push({ time: start + k, value: Number(p.value), interp }); }); } // inferred: keys from StartFrame, step 1, one per frame-set entry
      finally { A.frame = saved; }
      if (boolA(a.ProcessContRots ?? true)) for (const p of params) if (/^rot[xyz]$/.test(p.name)) { // inferred: continuous rotations (no jump > 180 degrees between keys)
        const ks = fcurves[p.fullName]; for (let k = 1; k < ks.length; k++) { let v = ks[k].value; while (v - ks[k - 1].value > 180) v -= 360; while (v - ks[k - 1].value < -180) v += 360; ks[k].value = v; }
      }
      const root = app.scene.root;
      const src = new Property(app.scene.uniqueName(String(a.ActionName || 'CamSeq_PlotAction')), 'actionsource', [
        str('data', JSON.stringify(values), 'Values', { readOnly: true }), str('fcurves', JSON.stringify(fcurves), 'FCurves', { readOnly: true }),
        str('expressions', '{}', 'Expressions', { readOnly: true }), int('items', params.length, 'Items', { readOnly: true }), int('mode', 1, 'Mode', { readOnly: true }),
      ]);
      app.record(C, () => root.addProperty(src), () => root.removeProperty(src));
      const sources = [src];
      // step 4: apply (exactly one source), then delete the old driving clips
      if (boolA(a.Apply ?? true) && sources.length === 1) {
        // ApplyAction installs keys without its own undo entry in this build: the parameters' keys are kept for undo here
        const keysOf = () => new Map(params.map(p => [p, app.anim.fcurve(p)?.keys.map(k => ({ ...k })) ?? null] as const));
        const prior = keysOf(); app.run('ApplyAction', { Source: src.name }); const applied = keysOf();
        const put = (m: typeof prior) => { for (const [p, ks] of m) { if (ks) app.anim.fcurve(p, true)!.keys = ks.map(k => ({ ...k })); else if (app.anim.fcurve(p)) app.anim.removeAnimation(p); } app.events.emit('params'); };
        app.record('ApplyAction', () => put(applied), () => put(prior));
        deleteDrivingClips(app, explicit ? params : null);
        // step 5: Delete only inside the Apply branch
        if (boolA(a.Delete)) app.record('DeleteObj', () => root.removeProperty(src), () => root.addProperty(src));
      }
      return sources;
    },
  });
  /** GetDrivingActions (explicit inputs: animation clips whose source drives one of the parameters) or every clip of the
   *  scene's clip container (no inputs, the compound owner when the clip is inside one); deleted together, undoably. */
  function deleteDrivingClips(app: App, params: Parameter[] | null) {
    const names = params ? new Set(params.map(p => p.fullName)) : null;
    const doomed: { mix: ReturnType<typeof mixerX>; clips: ClipX[]; compounds: ClipX[] }[] = [];
    for (const model of allModels(app.scene)) {
      if (!model.property('mixer')) continue;
      if (!params && model !== app.scene.root) continue;
      const mix = mixerX(model);
      const drives = (c: ClipX) => { const t = clipType(c); if (t !== T_ANIM && t !== T_ANIM_CPD) return false; const src = sourceOf({ clip: c, mix, model } as ClipRef); return !!src && sourceItemsRaw(src).some(it => names!.has(it) || names!.has(it.replace(/^[^.]+\./, ''))); };
      const pick = (c: ClipX) => names ? drives(c) : true;
      const clips = mix.clips.filter(pick); const inCpd = new Set((mix.compounds as ClipX[]).flatMap(cp => cp.clips ?? []));
      const compounds = (mix.compounds as ClipX[]).filter(cp => pick(cp) || clips.some(c => inCpd.has(c.name) && (cp.clips ?? []).includes(c.name)));
      if (clips.length || compounds.length) doomed.push({ mix, clips, compounds });
    }
    if (!doomed.length) return;
    const before = doomed.map(d => ({ clips: [...d.mix.clips], compounds: [...d.mix.compounds] }));
    app.record('DeleteObj', () => {
      for (const d of doomed) { d.mix.clips.splice(0, d.mix.clips.length, ...d.mix.clips.filter(c => !d.clips.includes(c))); d.mix.compounds.splice(0, d.mix.compounds.length, ...d.mix.compounds.filter(c => !d.compounds.includes(c as ClipX))); syncMixer(d.mix); }
    }, () => { doomed.forEach((d, i) => { d.mix.clips.splice(0, d.mix.clips.length, ...before[i].clips); d.mix.compounds.splice(0, d.mix.compounds.length, ...before[i].compounds); syncMixer(d.mix); }); });
  }

  /** Shape clips of every mixer (records of type mixershapeclip), with the object owning the driven shape key: the text
   *  of the clip source before the first "." (this build's shape clips name their key `<object>.<key>`). */
  function shapeClips(app: App): { clip: ClipX; mix: ReturnType<typeof mixerX>; owner: X3DObject | null; holder: ClipX }[] {
    const out: { clip: ClipX; mix: ReturnType<typeof mixerX>; owner: X3DObject | null; holder: ClipX }[] = [];
    for (const model of allModels(app.scene)) {
      if (!model.property('mixer')) continue; const mix = mixerX(model);
      for (const c of mix.clips) {
        if (clipType(c) !== T_SHAPE) continue;
        const cpd = (mix.compounds as ClipX[]).find(k => (k.clips ?? []).includes(c.name)); // the compound owner when nested
        out.push({ clip: c, mix, owner: findObj(app, String(c.source ?? '').split('.')[0]) ?? null, holder: cpd ?? c });
      }
    }
    return out;
  }
  regB10(app, 'PlotCamSeqShape', { // B11g §PlotCamSeqShape + batch 12: default list, old-clip collection, track / compound, keys and clips
    execute(app, a) {
      const C = 'PlotCamSeqShape';
      const explicit = !unset(a.InputObjs) && listOf(a.InputObjs).length > 0;
      let objs: X3DObject[] = []; const doomed = new Map<ReturnType<typeof mixerX>, Set<ClipX>>();
      const doom = (mix: ReturnType<typeof mixerX>, c: ClipX) => { let s = doomed.get(mix); if (!s) doomed.set(mix, s = new Set()); s.add(c); };
      if (explicit) objs = listOf(a.InputObjs).map(x => x instanceof X3DObject ? x : findObj(app, String(x))).filter((o): o is X3DObject => !!o);
      else for (const r of shapeClips(app)) { if (r.owner && !objs.includes(r.owner)) objs.push(r.owner); doom(r.mix, r.holder); } // 0x18004ab60: objects already driven by shape clips
      const start = num(a.StartFrame, 1), end = num(a.EndFrame, 100);
      const set = frameSet(app, start, end, boolA(a.PlotWithoutGaps));
      if (!set.length) { emptyFrameSet(app, C); return; }
      if (!objs.length) { app.logMsg('info', `${C}: Warning: XSIACTION2 message 0x446 (no object to plot)`); return outputs({ KeyList: null, ClipList: null }); }
      const mode = Number(constOf(a.Mode) || 4) || 4, content = constOf(a.Content), ref = constOf(a.RefMode);
      const apply = boolA(a.ApplyKeys ?? true);
      const name = String(a.Name || 'SQ_PlotShape');
      logNyaB10(app, C, 'the scripting name of the shape clip parameter set to Mode (78ae1830-...) and the one-key shape clip helper (0x18004a8e0); `mode` on the compound record and one clip per key are used', B11G);
      const keys: Property[] = [], clips: ClipX[] = []; const A = app.anim; const saved = A.frame;
      for (const o of objs) {
        if (!o.primitive?.mesh()) continue;
        const model: Model = (o.model as Model | undefined) ?? app.scene.root; const mix = mixerX(model);
        // 0x18004b150 (explicit inputs): the clips driving the object's shape keys (compound owner when nested)
        if (explicit) for (const r of shapeClips(app)) if (r.owner === o && r.mix === mix) doom(mix, r.holder);
        // 0x18004a530: AddTrack (root compound, C3DShapeActionTrack, no name, at the end), then CreateCompound at frame 1
        const track = Math.max(-1, ...mix.clips.filter(c => clipType(c) === T_SHAPE).map(c => Number(c.track ?? 0)), ...(mix.compounds as ClipX[]).filter(c => c.type === T_SHAPE_CPD).map(c => Number(c.track ?? 0))) + 1;
        subtaskB10(app, C, 'AddTrack', `${model.name}: C3DShapeActionTrack ${track} at the end`);
        const cpdName = uniqueClipName(mix, name);
        const compound = { name: cpdName, clips: [] as string[], start: 1, duration: 1, track, type: T_SHAPE_CPD, mode } as unknown as ClipX & { clips: string[] };
        subtaskB10(app, C, 'CreateCompound', `${cpdName} on track ${track} @ frame 1 (Mode ${mode})`);
        // 0x18004cd70: one Store Shape Key per frame-set entry (scene frame, Duration 0, Sampling 0, Content, RefMode)
        const made: Property[] = [];
        try {
          for (const x of set) {
            A.frame = x.scene; const m = o.primitive!.mesh()!;
            made.push(new Property(app.scene.uniqueName(name), 'shapekey', [str('data', JSON.stringify(Array.from(m.positions)), 'Positions', { readOnly: true }), int('points', m.positions.length / 3, 'Points', { readOnly: true }), int('frame', x.scene, 'Frame', { readOnly: true }), int('refmode', Number(ref) || 0, 'RefMode', { readOnly: true }), int('content', Number(content) || 0, 'Content', { readOnly: true })]));
            subtaskB10(app, C, 'StoreShapeKey', `${o.name} @ ${x.scene}`);
          }
        } finally { A.frame = saved; }
        // ApplyKeys: one shape clip per key at StartFrame + i (sequence frames), duration -1 (default: 1 frame, inferred)
        const made2: ClipX[] = apply ? made.map((k, i) => ({ name: `${k.name}_Clip`, source: `${o.name}.${k.name}`, start: start + i, duration: 1, track, type: T_SHAPE, mode, timectrl: { clipin: start + i, clipout: start + i } } as unknown as ClipX)) : [];
        compound.clips.push(...made2.map(c => c.name));
        if (made2.length) { compound.start = Math.min(compound.start, made2[0].start); compound.duration = Math.max(1, made2[made2.length - 1].start + 1 - compound.start); }
        app.record(C, () => { for (const k of made) o.addProperty(k); mix.compounds.push(compound as any); mix.clips.push(...made2); syncMixer(mix); },
          () => { for (const k of made) o.removeProperty(k); const i = mix.compounds.indexOf(compound as any); if (i >= 0) mix.compounds.splice(i, 1); mix.clips.splice(0, mix.clips.length, ...mix.clips.filter(c => !made2.includes(c))); syncMixer(mix); });
        if (apply && made.length) subtaskB10(app, C, 'StripDeformOperators', o.name); // on the last key's owner
        keys.push(...made); clips.push(...made2);
      }
      // ApplyKeys: DeleteObj (flag 0x10) on the collected old clips
      if (apply) for (const [mix, cs] of doomed) {
        // a doomed compound takes its member clips with it (they are not among this run's new clips)
        const gone = new Set([...cs].flatMap(c => c.clips ?? []));
        const before = { clips: [...mix.clips], compounds: [...mix.compounds] };
        const after = { clips: mix.clips.filter(c => !cs.has(c) && !(gone.has(c.name) && !clips.includes(c))), compounds: mix.compounds.filter(c => !cs.has(c as ClipX)) };
        const put = (x: typeof before) => { mix.clips.splice(0, mix.clips.length, ...x.clips); mix.compounds.splice(0, mix.compounds.length, ...x.compounds); syncMixer(mix); };
        app.record('DeleteObj', () => put(after), () => put(before));
        subtaskB10(app, C, 'DeleteObj', `${cs.size} old shape clip(s) (flag 0x10)`);
      }
      return outputs({ KeyList: keys.length ? keys : null, ClipList: clips.length ? clips : null });
    },
  });

  // ---------------------------------------------------------------- AddToTOC (B11c, tasks.dll)
  B10_ARGS.AddToTOC ??= [{ name: 'Source', default: null }];
  const toc = (): Node[] => ((app.scene as any).transientObjectContainer ??= []);
  regB10(app, 'AddToTOC', { // B11c §AddToTOC: detach the object from its owner (when removable) and put it in the TransientObjectContainer
    label: 'AddToTOC', category: 'General',
    execute(app, a) {
      const n: Node | undefined = a.Source instanceof Node ? a.Source : unset(a.Source) ? undefined : (findObj(app, String(a.Source)) as Node | undefined);
      if (!n) return; // null source: nothing
      const T = toc(); if (T.includes(n)) return;
      let detach: (() => void) | null = null, attach: (() => void) | null = null;
      if (n instanceof X3DObject && n !== app.scene.root && n.parentObj) { // inferred: the owner hierarchy of an object is its parent; the scene root is not removable
        const p = n.parentObj; const i = p.children.indexOf(n);
        detach = () => p.removeChild(n); attach = () => { p.addChild(n); p.children.splice(p.children.indexOf(n), 1); p.children.splice(i, 0, n); };
      } else if (n instanceof Property && n.parent instanceof X3DObject) {
        const o = n.parent; detach = () => o.removeProperty(n); attach = () => o.addProperty(n);
      }
      app.record(C_TOC, () => { detach?.(); T.push(n); }, () => { const k = T.indexOf(n); if (k >= 0) T.splice(k, 1); attach?.(); });
      if (app.selection.includes(n)) app.select([]);
    },
  });
}
const C_TOC = 'AddToTOC';
