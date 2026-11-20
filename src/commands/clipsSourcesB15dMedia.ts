// Ledger row CMD-B15d, second half: model sources / clips, file-cache sources, audio import and audio clips.
//   SIAddModelSource SICreateModelClip SIAddModelClip AddFileCacheSource AddFileCacheSource2 ImportAudio AddAudioClip
// Brief: docs/ghidra/cmd-b15d-clips-sources.md and docs/re/WIRE_CORRECTIONS_B15.md items 30, 31, 34. Original code from that
// prose only. Stand-in model: see clipsSourcesB15dShared.ts (stores, hooks `app.clipsSourcesB15d.*`).
// Mixer side: AddTrack is the command of this build (animateSurface.ts, track rows on the model mixer); clips are ClipX
// records of the model mixer (core/mixerActionScripts.ts) with the clip types below; audio / file-cache sources are model
// properties. Audio length and sample rate are properties of the source (`Length` frames, `SampleRate`) because no
// audio decoding exists in this build (inferred stand-in).
import { App, CommandDef } from '../core/commands';
import { Property, Model, Null, X3DObject } from '../core/scene';
import { str, int } from '../core/params';
import { mixerX, editMixer, clipNode, uniqueClipName, T_AUDIO, type ClipX } from '../core/mixerActionScripts';
import {
  b15d, storeOf, unset, nameOf, fail, logNya, lockCheck, resolveAny, listArg, uniqueIn, baseName, fileOnly, dirOnly, resolvePath, modelOfObject,
  isModelSourceNode, isAudioSourceNode, E_FAIL, E_POINTER, E_ABORT, E_INVALIDARG, E_ACCESSDENIED,
} from './clipsSourcesB15dShared';

type ArgList = [string, any][];
const ARGS = (l: ArgList) => l.map(([name, d]) => ({ name, default: d }));
const FILE_CACHE_TRACK = '91ab66bc-cc1a-4be1-a039-8e1b9f846a00';
const AUDIO_TRACK = 'd39d004a-ed33-11d2-b353-00105a1e6ce9';
const T_FILECACHE = 'mixerfilecacheclip';   // inferred clip type string of this build
const REGISTRY_AUDIO_DIR = 'Nle\\animmix\\audio';
const boolOf = (v: any) => typeof v === 'string' ? /^(true|1|yes)$/i.test(v.trim()) : !!v;

const addTo = (app: App, label: string, list: Property[], p: Property) =>
  app.record(label, () => { if (!list.includes(p)) list.push(p); }, () => { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); });
const addToModel = (app: App, label: string, model: Model, p: Property) =>
  app.record(label, () => { if (!model.properties.includes(p)) model.addProperty(p); }, () => model.removeProperty(p));

// ------------------------------------------------------------------ model sources and clips
function newModelSource(app: App, file: string, name: string, resolution: number): Property {
  const store = storeOf(app, 'modelSources');
  const src = new Property(uniqueIn(store.map(s => s.name), name), 'modelsource', [str('FileName', file, 'File Name'), int('Resolution', resolution, 'Resolution')]);
  (src as any).files = { [resolution]: file }; (src as any).clips = {};
  addTo(app, 'Add model source', store, src);
  return src;
}
function addModelSource(app: App, a: Record<string, any>) {
  const C = 'SIAddModelSource';
  if (b15d(app).restricted) {
    const msg = 'Error: Creation of model source only available in Essentials and Advanced';
    console.log(msg); app.logMsg('error', `${C}: ${msg}`);
    return undefined;
  }
  const file = unset(a.FileName) ? '' : String(a.FileName);
  const res = unset(a.Resolution) ? 2 : Number(a.Resolution);
  const name = !unset(a.Name) ? String(a.Name) : file ? `ModelSource_${baseName(file)}` : 'ModelSource';   // default name ModelSource_<base>
  return newModelSource(app, file, name, res);
}
function createModelClip(app: App, a: Record<string, any>) {
  const C = 'SICreateModelClip';
  const RES = 2;                                                         // no Resolution argument: constructor default
  const file = unset(a.FileName) ? '' : String(a.FileName);
  let source: Property | null = null;
  if (!unset(a.Source)) { const s = resolveAny(app, a.Source); if (isModelSourceNode(s)) source = s; }
  if (!file && !source) throw fail(E_INVALIDARG, `${C}: FileName is empty and no Source was given`);
  const name = unset(a.Name) ? '' : String(a.Name);
  const clips = storeOf(app, 'modelClips');
  let clipName: string;
  if (!source) {
    const base = file ? baseName(file) : '';
    source = newModelSource(app, file, name || `ModelSource_${base}`, RES);       // a new source for FileName at resolution 2
    clipName = name || `ModelClip_${base}`;                                       // Name given: clip and source both named Name
  } else {
    const have = (source as any).files?.[RES] ?? (RES === Number(source.val('Resolution')) ? String(source.val('FileName') ?? '') : '');
    if (!have) { app.logMsg('error', `${C}: The Model Source has an invalid file path for this resolution.`); throw fail(E_INVALIDARG, `${C}: The Model Source has an invalid file path for this resolution.`); }
    if ((source as any).clips?.[RES]) { app.logMsg('error', `${C}: The model source is already having a clip for this resolution.`); throw fail(E_INVALIDARG, `${C}: The model source is already having a clip for this resolution.`); }
    if (name) logNya(app, C, 'Name together with an existing Source (the clip is named ModelClip_<source name>)');
    if (file) { (source as any).files[RES] = file; source.set('FileName', file); }  // FileName becomes the source's path
    clipName = `ModelClip_${source.name}`;
  }
  const clip = new Property(uniqueIn(clips.map(c => c.name), clipName), 'modelclip', [str('Source', source.name, 'Source'), int('Resolution', RES, 'Resolution')]);   // parameter id 0x10 = resolution
  (clip as any).source = source; const src = source;
  app.record('Add model clip', () => { if (!clips.includes(clip)) clips.push(clip); (src as any).clips[RES] = clip; }, () => { const i = clips.indexOf(clip); if (i >= 0) clips.splice(i, 1); delete (src as any).clips[RES]; });
  return clip;
}
function addModelClip(): never {
  throw fail(E_FAIL, 'SIAddModelClip: Obsolete command, to create a clip you have to change the model source resolution.');
}

// ------------------------------------------------------------------ mixer helpers
type TrackRow = { name: string; type: string; insertPosition: number; locked?: boolean };
const trackRows = (mix: object): TrackRow[] => (mix as any).trackRows ?? ((mix as any).trackRows = []);
/** AddTrack sub-task on the model; returns the new track's index (the row is added by hand if the bus command missed the model). */
function addTrack(app: App, model: Model, compound: any, type: string): number {
  const mix = mixerX(model); const before = trackRows(mix).length;
  if (app.commands.has('AddTrack')) app.run('AddTrack', { Model: model === app.scene.root ? null : model.name, Compound: compound ?? null, Type: type });
  if (trackRows(mix).length === before) app.record('Add track', () => { trackRows(mix).push({ name: '', type, insertPosition: -1 }); }, () => { trackRows(mix).pop(); });
  return trackRows(mix).length - 1;
}

// ------------------------------------------------------------------ AddFileCacheSource / AddFileCacheSource2
const relName = (o: X3DObject) => o.fullName.replace(/^Scene\./, '').replace(/^Scene_Root\./, '');
/** Target guess from the file name with the preference template ([model] / [object] tokens against `_` parts). */
function guessTarget(app: App, file: string): X3DObject | null {
  const parts = baseName(file).split('_'); const tmpl = b15d(app).cacheTemplate.split('_');
  let model: string | null = null, object: string | null = null;
  tmpl.forEach((t, i) => { if (parts[i] === undefined) return; if (/\[model\]/i.test(t)) model = parts[i]; else if (/\[object\]/i.test(t)) object = parts[i]; });
  if (!object) return null;
  const m = model ? app.scene.find(model) : null;                         // default model Scene_Root
  const scope = m instanceof Model ? m : app.scene.root;
  for (const o of app.scene.allObjects()) if (o.name === object && (o.model === scope || scope === app.scene.root)) return o;
  return null;
}
function addFileCacheSource(C: 'AddFileCacheSource' | 'AddFileCacheSource2') {
  return (app: App, a: Record<string, any>) => {
    if (unset(a.FileName)) throw fail(E_POINTER, `${C}: FileName is required`);
    const file = String(a.FileName);
    if (C === 'AddFileCacheSource2' && !unset(a.SourceObject)) logNya(app, C, 'how SourceObject changes the target resolution (passed to the worker, use not traced)');
    // target: the first InputObj that is a 3D object
    let target: X3DObject | null = (unset(a.InputObj) ? [] : listArg(app, a.InputObj)).find(x => x instanceof X3DObject) ?? null;
    if (!target) {
      target = guessTarget(app, file);
      if (!target) {
        const pick = b15d(app).pick;
        if (!pick) throw fail(E_INVALIDARG, `${C}: no target object and no interactive pick session is available (prompt XSIIMAGECLIP 0x24)`);
        const r = pick(app);
        if (r === 'cancel') throw fail(E_ABORT, `${C}: the pick was cancelled`);
        target = r;
      }
    }
    lockCheck(app, C, 'sources');
    const model: Model = (target ? modelOfObject(target) : null) ?? app.scene.root;
    if (!target) {                                                        // step 3: a point cloud under the current scene model
      logNya(app, C, 'the exact SIGetPrim arguments of the point cloud prim (preset 2194ffe3-...)');
      const r = app.commands.has('SIGetPrim') ? app.run('SIGetPrim', { PresetObj: 'PointCloud', Name: 'pointcloud' }) : null;
      let pc: any = r instanceof X3DObject ? r : r?.Value instanceof X3DObject ? r.Value : null;
      if (!pc) { pc = new Null(app.scene.uniqueName('pointcloud')); (pc as any).pointcloud = true; const m = model; app.record('Add pointcloud', () => m.addChild(pc), () => m.removeChild(pc)); }
      target = pc;
    }
    const full = resolvePath(file);
    const store = model.properties;
    const name = !unset(a.Name) ? String(a.Name) : uniqueIn(store.map(p => p.name), baseName(file) || 'FileCache');
    logNya(app, C, 'the sub-step count load (F3DLoadSubStepsCount); SubSteps is 1');
    const src = new Property(name, 'filecachesource', [str('FileName', full, 'File Name'), str('TargetObject', relName(target as X3DObject), 'Target Object'), int('SubSteps', 1, 'Sub Steps'), int('StartFrame', 1, 'Start Frame')]);
    addToModel(app, 'Add file cache source', model, src);
    (b15d(app).last as any)[C] = { source: src, model };
    if (!boolOf(a.DeployInMixer ?? true)) return src;
    const mix = mixerX(model);
    const track = addTrack(app, model, null, FILE_CACHE_TRACK);
    editMixer(app, mix, app.scene.root, 'Add file cache clip', () => {
      const clip: ClipX = { name: uniqueClipName(mix, src.name), source: src.name, start: Number(src.val('StartFrame')) || 1, duration: Math.max(1, Number(src.val('SubSteps')) || 1), track, weight: 1, mute: false, type: T_FILECACHE };
      mix.clips.push(clip); return clip;
    });
    logNya(app, C, 'the tail of the deploy-in-mixer branch (clip options, whether Source or the clip is returned); Source is returned');
    return src;
  };
}

// ------------------------------------------------------------------ ImportAudio / AddAudioClip
function importAudio(app: App, a: Record<string, any>) {
  const C = 'ImportAudio';
  if (unset(a.Model) || unset(a.FileName)) throw fail(E_POINTER, `${C}: Model and FileName are required`);
  const model = modelOfObject(resolveAny(app, a.Model));
  if (!model) throw fail(E_POINTER, `${C}: Model does not resolve to a model`);
  const full = String(a.FileName); const dir = dirOnly(full), file = fileOnly(full);
  const st = b15d(app); const prev = st.registry[REGISTRY_AUDIO_DIR];
  app.record(C, () => { st.registry[REGISTRY_AUDIO_DIR] = dir; }, () => { if (prev === undefined) delete st.registry[REGISTRY_AUDIO_DIR]; else st.registry[REGISTRY_AUDIO_DIR] = prev; });   // last audio folder
  mixerX(model);                                                         // the model's audio container (get / create)
  const len = Math.max(1, app.anim.endFrame - app.anim.startFrame);      // inferred: no decoding in this build
  const src = new Property(unset(a.Name) ? file : String(a.Name), 'audiosource', [
    str('filename', dir ? `${dir}\\${file}` : file, 'File Name', { readOnly: true }), int('Length', len, 'Length'), int('SampleRate', st.audioSampleRate, 'Sample Rate')]);
  addToModel(app, 'Import audio', model, src);
  return src;
}
function addAudioClip(app: App, a: Record<string, any>) {
  const C = 'AddAudioClip';
  if (unset(a.Model) || unset(a.Source) || unset(a.Time)) throw fail(E_POINTER, `${C}: Model, Source and Time are required`);
  const model = modelOfObject(resolveAny(app, a.Model));
  if (!model) throw fail(E_POINTER, `${C}: Model does not resolve to a model`);
  const src = resolveAny(app, a.Source);
  if (!isAudioSourceNode(src)) return undefined;                          // not an audio source: no clip is made
  const mix = mixerX(model); const st = b15d(app); const time = Number(a.Time);
  const len = Math.max(1, Number(src.val('Length')) || 1);
  // optional Track: an index, a row name or an object naming one
  let track = -1;
  if (!unset(a.Track)) {
    const rows = trackRows(mix); const t = a.Track;
    track = typeof t === 'number' ? t : /^\d+$/.test(String(t)) ? Number(t) : rows.findIndex(r => r.name === nameOf(t).replace(/^.*\./, ''));
    if (!(track >= 0)) throw fail(E_POINTER, `${C}: Track does not name a track of ${model.name}`);
    if (rows[track]?.locked) throw fail(E_ACCESSDENIED, `${C}: the track is locked`);
    const end = time + len - 1;                                           // GetInsertedClipBounds: start .. start + length - 1 frame
    if (mix.clips.some(c => Number(c.track ?? 0) === track && c.start <= end && time <= c.start + c.duration - 1)) {
      app.logMsg('error', `${C}: XSIMOAUDIO 0x6f: the clip does not fit on the track`);
      throw fail(E_FAIL, `${C}: the clip does not fit on the track (XSIMOAUDIO 0x6f)`);
    }
  }
  // sample rate: Project Audio Sample Rate takes the source rate; refused when the scene rate is fixed
  const rate = Number(src.val('SampleRate')) || st.audioSampleRate;
  if (rate !== st.audioSampleRate && st.audioRateFixed) {
    app.logMsg('error', `${C}: XSIMOAUDIO 0x70: the scene audio sample rate is fixed`);
    throw fail(E_FAIL, `${C}: the source sample rate differs from the fixed Project Audio Sample Rate (XSIMOAUDIO 0x70)`);
  }
  const was = st.audioSampleRate;
  app.record(C, () => { st.audioSampleRate = rate; }, () => { st.audioSampleRate = was; });
  if (track < 0) track = addTrack(app, model, unset(a.Compound) ? null : a.Compound, AUDIO_TRACK);   // no Track: a new audio track
  const made = editMixer(app, mix, app.scene.root, 'Add audio clip', () => {
    const clip: ClipX = { name: uniqueClipName(mix, unset(a.Name) ? src.name : String(a.Name)), source: src.name, start: time, duration: len, track, weight: 1, mute: false, type: T_AUDIO };
    mix.clips.push(clip); return clip;
  });
  return clipNode({ clip: made, mix, model });
}

// ------------------------------------------------------------------ registration
export function registerClipsSourcesB15dMediaCommands(app: App) {
  // the optional `Source` argument of SICreateModelClip is not in the registry list, so the bus drops it; it is reachable here
  b15d(app).createModelClip = (a) => createModelClip(app, a);
  const reg = (name: string, args: ArgList, execute: (app: App, a: Record<string, any>) => any, category: string, extra: Partial<CommandDef> = {}) =>
    app.register({ name, label: name, category, description: '', args: ARGS(args), undoable: true, execute, ...extra });
  reg('SIAddModelSource', [['FileName', ''], ['Name', ''], ['Source', null], ['Resolution', 2]], addModelSource, 'File');
  reg('SICreateModelClip', [['FileName', null], ['Name', ''], ['Clip', null]], createModelClip, 'File');
  reg('SIAddModelClip', [['Source', null], ['Name', ''], ['Clip', null]], addModelClip, 'File');
  reg('AddFileCacheSource', [['InputObj', null], ['FileName', null], ['DeployInMixer', true], ['Source', null]], addFileCacheSource('AddFileCacheSource'), 'Edit');
  reg('AddFileCacheSource2', [['InputObj', null], ['FileName', null], ['DeployInMixer', true], ['SourceObject', ''], ['Source', null]], addFileCacheSource('AddFileCacheSource2'), 'Edit');
  reg('ImportAudio', [['Model', null], ['FileName', null], ['Name', ''], ['AudioSource', null]], importAudio, 'File');
  reg('AddAudioClip', [['Model', null], ['Source', null], ['Compound', null], ['Track', null], ['Time', null], ['Name', ''], ['Clip', null]], addAudioClip, 'File');
}
