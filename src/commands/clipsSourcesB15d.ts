// Ledger row CMD-B15d: image / model / file-cache sources and clips (imageclip.dll) and audio import / clips
// (moaudio.dll). 16 commands:
//   SIAddImageSource SIAddImageClip SIAddImageSourceOp SIAddImageOp SIAddWritableImageSource SICreateImageClip
//   SICreateImageClip2 SICreateDefaultImageClip SetImageSource SIAddModelSource SICreateModelClip SIAddModelClip
//   AddFileCacheSource AddFileCacheSource2 ImportAudio AddAudioClip
// Brief: docs/ghidra/cmd-b15d-clips-sources.md ("Wire contract" of each command, including the `(inferred)` parts) and
// docs/re/WIRE_CORRECTIONS_B15.md items 17 and 30-34. Original code written from that prose only; no golden exists.
//
// Mapping onto this build:
//  * Image sources and image clips are scene-root properties of type `imagesource` / `imageclip` (the shape the
//    texturing and source-cleanup commands of this build already read). A clip's source is `clip.source`; its
//    image-source / image-effect operators are `clip.imageOps`. Writable image sources are `writableimagesource`,
//    model sources / clips `modelsource` / `modelclip`, all on the scene root. File-cache sources (`filecachesource`)
//    are properties of their model; audio sources (`audiosource`) too. Parameter names come from the SPDL files of
//    those classes (data/spdl/spdl.json); `filename` / `FileName` / `Resolution` are this build's own fields.
//  * The parameter ids the note gives match the SPDL parameter order (model clip 0x10 = resolution, image clip 0x2f =
//    SourceTrack, file-cache 2 = ObjectName / 7 = FrameStart). The writable-source ids (4, 8, 9) do not; those are
//    written by meaning (ChannelType, XRes, YRes) (Q-B15d-1).
//  * No file is read: there is no file parser, so the "registered parser" branches never run; the sub-image count of
//    a source is its `NumberOfTracks` parameter (1 unless set).
//  * Out-arguments are returned as an output list keyed by argument name (`outputs` of primTasksTexture.ts).
//  * Failure HRESULTs are thrown as SiStatusError; container locks are `state.locked`.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15d)".
import { App } from '../core/commands';
import { Node, X3DObject, Model, Property, Operator } from '../core/scene';
import { str, int, bool, num } from '../core/params';
import { siString } from '../ui/si';
import { preferenceSets } from '../ui/prefs';
import { SiStatusError } from './alembicSeqCam';
import { outputs } from './primTasksTexture';
import { startPickSession, interactive } from './miscDsScriptsPick';
import { mixerX, editMixer, uniqueClipName, T_AUDIO, type ClipX } from '../core/mixerActionScripts';

const ROW = 'CMD-B15d';
export const S_OK = 0;
export const E_FAIL = 0x80004005, E_POINTER = 0x80004003, E_INVALIDARG = 0x80070057, E_ABORT = 0x80004004, E_ACCESSDENIED = 0x80070005;
/** Public SDK enum siRenderChannelType (Softimage SDK reference): Color 1 ... Label 6. */
const RENDER_CHANNEL: Record<string, number> = {
  siRenderChannelColorType: 1, siRenderChannelGrayscaleType: 2, siRenderChannelDepthType: 3,
  siRenderChannelNormalVectorType: 4, siRenderChannelVectorType: 5, siRenderChannelLabelType: 6,
};
/** inferred: the user-preference default image (only its clip name `noIcon_pic` is attested, by the scene dump). */
const DEFAULT_IMAGE = 'noIcon.pic';
const FILE_CACHE_TRACK = 'mixercachetrack', FILE_CACHE_CLIP = 'mixercacheclip';   // inferred type strings (tail of step 6, Q3)

export interface ClipsSourcesB15dState {
  locked: { sources: boolean; clips: boolean };
  /** Application mode reports the restricted edition (SIAddModelSource refuses). */
  restrictedEdition: boolean;
  /** SIGetUserPrefDefaultImage. */
  defaultImage: string;
  /** Registry key Nle\animmix\audio (last audio folder). */
  lastAudioFolder: string;
  /** Content property "Project Audio Sample Rate" and the scene's fixed-rate flag. */
  projectAudioSampleRate: number; audioRateFixed: boolean;
  /** Mixer tracks reported as locked: `<model name>:<track index>`. */
  lockedTracks: Set<string>;
  /** Command definition GUID -> image-clip handler mode (SICreateImageClip 0, 2, unregistered 3, 4). */
  modes: Record<string, number>;
  /** The image-clip handler with any mode (mode 3 has no registered command). */
  createImageClips(fileName: string, name: string, mode: number): Property[];
  /** The model-clip core with the optional `Source` the shared UnPackArg reads (not in the registry entry). */
  createModelClip(fileName: string, name: string, source: Property | null): Property | null;
  /** Last status of a command that returned without throwing. */
  status: Record<string, number>;
}
const stateOf = (app: App): ClipsSourcesB15dState => (app as any).clipsSourcesB15d;

// ------------------------------------------------------------------ small helpers
const fail = (status: number, what: string) => new SiStatusError(status, what);
const logNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`);
const unset = (v: any) => v === undefined || v === null || v === '';
const truthy = (v: any) => typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;
const first = (v: any) => Array.isArray(v) ? v[0] : v;
const listOf = (v: any): any[] => unset(v) ? [] : Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v];
export const isImageSource = (n: any): n is Property => n instanceof Property && n.type === 'imagesource';
export const isImageClip = (n: any): n is Property => n instanceof Property && n.type === 'imageclip';
export const isWritableSource = (n: any): n is Property => n instanceof Property && n.type === 'writableimagesource';
export const isModelSource = (n: any): n is Property => n instanceof Property && n.type === 'modelsource';
export const isAudioSource = (n: any): n is Property => n instanceof Property && n.type === 'audiosource';
const fileBase = (file: string) => file.replace(/^.*[\\/]/, '');
const stem = (file: string) => fileBase(file).replace(/\.[^.]*$/, '');
/** inferred: object names cannot carry '.', so `noIcon.pic` -> `noIcon_pic` (as the attested default clip name). */
const nameFromFile = (file: string) => fileBase(file).replace(/[^A-Za-z0-9_]/g, '_') || 'noname';
/** The resolved (full) path. inferred: this build has no project folder to resolve against; separators and `.` / `..`
 *  segments are normalised. Comparisons are case-insensitive (contract). */
function resolvedPath(file: string): string {
  const parts: string[] = [];
  for (const seg of file.trim().replace(/\\/g, '/').split('/')) {
    if (seg === '.' || (seg === '' && parts.length)) continue;
    if (seg === '..' && parts.length && parts[parts.length - 1] !== '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}
const samePath = (a: string, b: string) => resolvedPath(a).toLowerCase() === resolvedPath(b).toLowerCase();
const rootProps = (app: App) => app.scene.root.properties;
/** A name not used by another root property of the same type (the same Sources / Clips container). */
function uniqueRootName(app: App, base: string, type: string): string {
  const taken = (n: string) => rootProps(app).some(p => p.type === type && p.name === n);
  if (!taken(base)) return base;
  let i = 1; while (taken(`${base}${i}`)) i++;
  return `${base}${i}`;
}
function addRootProp(app: App, p: Property, label: string) { const root = app.scene.root; app.record(label, () => root.addProperty(p), () => root.removeProperty(p)); }
/** A root property (source / clip) from a node, a name, or `Clips.<name>` / `Sources.[Images.]<name>`. */
function rootProp(app: App, x: any): Property | null {
  x = first(x);
  if (x instanceof Property) return x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim(); const last = s.replace(/^(Clips|Sources(\.Images)?)\./, '');
  return rootProps(app).find(p => p.name === s || p.fullName === s || p.name === last) ?? null;
}
function objectArg(app: App, x: any): X3DObject | null {
  x = first(x);
  if (x instanceof X3DObject) return x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  return s === app.scene.root.name ? app.scene.root : app.scene.find(s) ?? null;
}
const modelOf = (o: X3DObject): Model => o instanceof Model ? o : o.model ?? null as any;
function lockCheck(app: App, command: string, which: 'sources' | 'clips', node?: any) {
  if (stateOf(app).locked[which] || node?.locked) throw fail(E_ACCESSDENIED, `${command}: the ${which === 'sources' ? 'Sources' : 'Clips'} container${node?.locked ? ` (${node.name})` : ''} is locked`);   // inferred: lock error code
}
/** Run a sub-task of this row on the bus. */
const sub = (app: App, name: string, args: Record<string, any>) => app.run(name, args);
/** The FileName argument handler (file browser) is not modelled: an empty FileName stays empty. */
function noBrowser(app: App, command: string) { logNya(app, command, 'the FileName argument handler (file browser) with an empty FileName; nothing was created'); }

// ------------------------------------------------------------------ objects
function newImageSource(app: App, file: string, name: string): Property {
  const p = new Property(uniqueRootName(app, name || nameFromFile(file), 'imagesource'), 'imagesource', [
    str('FileName', file, 'File Name'), str('Path', resolvedPath(file), 'Path', { readOnly: true }),
    int('NumberOfTracks', 1, 'Number of Tracks'),   // inferred: the sub-image count read by SICreateImageClip2 (Q-B15d-2)
  ]);
  return p;
}
function newImageClip(app: App, name: string): Property {
  const clip = new Property(uniqueRootName(app, name || 'ImageClip', 'imageclip'), 'imageclip', [
    str('SourceName', '', 'Source Name', { readOnly: true }), str('SourceFileName', '', 'Source File Name', { readOnly: true }),
    int('SourceTrack', 0, 'Source Track'),
    // this build's fields read by the texturing commands
    str('filename', '', 'File Name'), bool('enabled', true, 'Enabled'),
  ]);
  (clip as any).source = null; (clip as any).imageOps = [] as Operator[];
  return clip;
}
/** Point a clip at a source (clip-source interface): `source` and the read-only mirrors. */
function setClipSource(clip: Property, source: Property | null) {
  (clip as any).source = source;
  clip.set('SourceName', source?.name ?? ''); clip.set('SourceFileName', String(source?.val('FileName') ?? ''));
  clip.set('filename', String(source?.val('FileName') ?? ''));
}
const clipState = (clip: Property) => ({ source: (clip as any).source ?? null, SourceName: clip.val('SourceName'), SourceFileName: clip.val('SourceFileName'), filename: clip.val('filename') });
function restoreClip(clip: Property, s: ReturnType<typeof clipState>) { (clip as any).source = s.source; clip.set('SourceName', s.SourceName); clip.set('SourceFileName', s.SourceFileName); clip.set('filename', s.filename); }
function addImageOp(app: App, clip: Property, op: Operator, label: string) {
  const ops: Operator[] = ((clip as any).imageOps ??= []);
  app.record(label, () => { ops.push(op); op.parent = clip; }, () => { const i = ops.indexOf(op); if (i >= 0) ops.splice(i, 1); op.parent = null; });
}

// ------------------------------------------------------------------ image sources and clips
function addImageSource(app: App, command: string, file: string, name: string): Property | null {
  // 1. empty FileName: nothing happens
  if (!file) return null;
  // 2. lock check
  lockCheck(app, command, 'sources');
  // 3./4. reuse a source with the same resolved path (case-insensitive): nothing new, nothing undoable
  const old = rootProps(app).find(p => isImageSource(p) && samePath(String(p.val('FileName') ?? ''), file));
  if (old) return old;
  // 5. no file parser in this build: a new image source, file name as given
  const p = newImageSource(app, file, name);   // 6. Name or the file-based default
  addRootProp(app, p, 'Add Image Source');      // 7. registered
  return p;
}
function addImageClip(app: App, command: string, source: Property | null, name: string): Property | null {
  if (source && !isImageSource(source)) return null;   // a given source must be an image source, else nothing
  if (source) lockCheck(app, command, 'sources', source);
  const clip = newImageClip(app, name || source?.name || '');
  addRootProp(app, clip, 'Add Image Clip');
  if (source) sub(app, 'SIAddImageSourceOp', { Clip: clip, Source: source });
  return clip;
}
function addImageSourceOp(app: App, command: string, clipArg: any, sourceArg: any): Operator | undefined {
  const clip = rootProp(app, clipArg);
  if (!isImageClip(clip)) return undefined;   // Clip must be an image clip, else nothing
  let source: Property | null;
  if (!unset(sourceArg)) { source = rootProp(app, sourceArg); if (!isImageSource(source)) return undefined; }
  else source = (clip as any).source ?? null;
  if (!source) { logNya(app, command, `${clip.name} has no source and none was given; the operator ports cannot be built`); return undefined; }
  // ApplyOperator (image-source operator 756a0bc4, mode 3, flag 4): ports = the source, the clip output, the clip image data
  const op = new Operator('ImageSourceOp', 'imagesourceop', []);
  (op as any).ports = { source, clip, imageData: 'ImageData' };
  addImageOp(app, clip, op, 'Add Image Source Op');
  sub(app, 'SetImageSource', { Source: source, InputObjs: [clip] });
  return op;
}
function setImageSource(app: App, command: string, sourceArg: any, inputs: any) {
  if (unset(inputs)) throw fail(E_INVALIDARG, `${command}: InputObjs is required`);   // inferred: the failure code of the missing collection
  let source: Property | null = null;
  if (!unset(sourceArg)) { source = rootProp(app, sourceArg); if (!isImageSource(source)) return; }   // given: must be an image source, else nothing
  for (const x of listOf(inputs)) {
    const clip = rootProp(app, x);
    if (!isImageClip(clip)) continue;   // non-clips are skipped silently
    const before = clipState(clip);
    app.record('Set Image Source', () => setClipSource(clip, source), () => restoreClip(clip, before));
  }
}
const IMAGE_SOURCE_OP_PRESET = /imagesourceop|756a0bc4/i;
function addImageOpCmd(app: App, command: string, presetArg: any, clipArg: any): Operator | undefined {
  if (unset(presetArg)) throw fail(E_FAIL, `${command}: no preset (the alternative preset id is never filled from scripting)`);
  const clip = rootProp(app, clipArg);
  if (!isImageClip(clip)) return undefined;   // Clip must be an image clip
  const preset = presetArg instanceof Node ? presetArg : first(presetArg);
  const presetName = preset instanceof Node ? (preset.type || preset.name) : String(preset);
  if (IMAGE_SOURCE_OP_PRESET.test(presetName)) return sub(app, 'SIAddImageSourceOp', { Clip: clip, Source: (clip as any).source ?? null });
  // ApplyOperator with the preset: one group, the clip connected twice (in and out), mode 3, flag 4
  const base = stem(presetName.replace(/\.preset$/i, '')) || 'ImageOp';
  const op = new Operator(base, base.toLowerCase(), []);
  (op as any).ports = { input: clip, output: clip }; (op as any).preset = presetName;
  addImageOp(app, clip, op, 'Add Image Op');
  return op;
}

/** The SICreateImageClip / SICreateImageClip2 / SICreateDefaultImageClip handler. */
function createImageClips(app: App, command: string, file: string, name: string, mode: number): Property[] {
  // 1. lock check on the clips container
  lockCheck(app, command, 'clips');
  // 2. plain image file (no file parser in this build)
  const srcOut = sub(app, 'SIAddImageSource', { FileName: file, Name: '' });
  const source: Property | null = srcOut?.Source ?? null;
  if (!source) return [];
  const count = mode === 2 || mode === 3 ? Math.max(1, Number(source.val('NumberOfTracks')) || 1) : 1;
  if (count > 1 && name) logNya(app, command, `the first clip's name when Name is given and the file has several sub-images (open question 1); "${name}" was used`);
  const fileName = nameFromFile(file);
  const clips: Property[] = [];
  for (let i = 0; i < count; i++) {
    const clipName = count === 1 ? name : i === 0 ? (name || fileName) : `V${i}_${name || fileName}`;
    const out = sub(app, 'SIAddImageClip', { Source: source, Name: clipName });
    const clip: Property | null = out?.Clip ?? null;
    if (!clip) continue;
    if (count > 1) { const p = clip.get('SourceTrack'); if (p) app.setParam(p, i); }   // SetValue <clip>.SourceTrack = i at the current time
    clips.push(clip);
  }
  return clips;
}

function addWritableImageSource(app: App, command: string, a: Record<string, any>): Property | null {
  const file = String(a.FileName ?? ''), name = String(a.Name ?? '');
  const width = Number(a.Width), height = Number(a.Height);
  const typeArg = a.Type; const tm = typeof typeArg === 'string' ? /^:([^:]+):/.exec(typeArg.trim()) : null;
  const type = tm ? RENDER_CHANNEL[tm[1]] : typeof typeArg === 'string' ? (RENDER_CHANNEL[typeArg.trim()] ?? Number(typeArg)) : Number(typeArg);
  if (!(width >= 1) || !(height >= 1) || !(Number.isInteger(type) && type >= 1 && type <= 6)) {
    logNya(app, command, `the status returned for Width ${a.Width}, Height ${a.Height}, Type ${typeArg} (must be >= 1, >= 1, 1..6); the command stops, nothing was created`);
    return null;
  }
  if (!file) { noBrowser(app, command); return null; }
  lockCheck(app, command, 'sources');
  if (truthy(a.UseExisting)) {
    logNya(app, command, 'the UseExisting lookup rule (open question 2); a writable source with the same resolved path is handed back');   // inferred
    const old = rootProps(app).find(p => isWritableSource(p) && samePath(String(p.val('FileName') ?? ''), file));
    if (old) return old;
  }
  const p = new Property(uniqueRootName(app, name || nameFromFile(file), 'writableimagesource'), 'writableimagesource', [
    str('FileName', file, 'File Name'), str('Path', resolvedPath(file), 'Path', { readOnly: true }),
    int('XRes', width, 'X Resolution'), int('YRes', height, 'Y Resolution'), int('ChannelType', type, 'Channel Type'),
  ]);
  addRootProp(app, p, 'Add Writable Image Source');
  return p;
}

// ------------------------------------------------------------------ model sources and clips
const RES_PATHS = ['lowres_path', 'mediumres_path', 'highres_path'];   // inferred: resolution n -> the n-th path parameter of C3DModelSource
function newModelSource(app: App, file: string, name: string, resolution: number): Property {
  const p = new Property(uniqueRootName(app, name, 'modelsource'), 'modelsource', [
    str('lowres_path', '', 'Low Resolution Path'), str('mediumres_path', '', 'Medium Resolution Path'), str('highres_path', '', 'High Resolution Path'),
    int('active_resolution', 0, 'Active Resolution'),
    // this build's fields (the referenced-model stand-in of CMD-B6b reads them)
    str('FileName', file, 'File Name'), int('Resolution', resolution, 'Resolution'),
  ]);
  if (RES_PATHS[resolution]) p.set(RES_PATHS[resolution], file);
  (p as any).files = { [resolution]: file } as Record<number, string>;
  (p as any).clips = {} as Record<number, Property>;
  return p;
}
function addModelSource(app: App, command: string, file: string, name: string, resolution: number): Property | null {
  const st = stateOf(app);
  if (st.restrictedEdition) { console.log('Error: Creation of model source only available in Essentials and Advanced'); app.logMsg('info', 'Error: Creation of model source only available in Essentials and Advanced'); return null; }
  let n = name || (file ? `ModelSource_${stem(file)}` : '');
  if (!n) { logNya(app, command, 'the default name with an empty FileName and Name'); n = 'ModelSource'; }
  const p = newModelSource(app, file, n, resolution);
  addRootProp(app, p, 'Add Model Source');
  return p;
}
function createModelClip(app: App, command: string, file: string, name: string, source: Property | null): Property | null {
  if (!file && !source) throw fail(E_INVALIDARG, `${command}: FileName is empty and no Source was given`);
  const RES = 2;
  let clipName: string; let src = source;
  if (src) {
    const path = String((src as any).files?.[RES] ?? src.val(RES_PATHS[RES]) ?? '');
    if (!path) { app.logMsg('error', 'The Model Source has an invalid file path for this resolution.'); throw fail(E_INVALIDARG, `${command}: The Model Source has an invalid file path for this resolution.`); }
    if ((src as any).clips?.[RES]) { app.logMsg('error', 'The model source is already having a clip for this resolution.'); throw fail(E_INVALIDARG, `${command}: The model source is already having a clip for this resolution.`); }
    file = path; clipName = `ModelClip_${src.name}`;
  } else {
    clipName = name || `ModelClip_${stem(file)}`;
    src = newModelSource(app, file, name || `ModelSource_${stem(file)}`, RES);
    addRootProp(app, src, 'Add Model Source');
  }
  const clip = new Property(uniqueRootName(app, clipName, 'modelclip'), 'modelclip', [
    str('source', src.name, 'Source', { readOnly: true }), int('resolution', RES, 'Resolution'),
    str('Source', src.name, 'Source', { readOnly: true }),   // this build's field (read by the CMD-B6b wrappers)
  ]);
  (clip as any).source = src;
  const clips: Record<number, Property> = ((src as any).clips ??= {});
  app.record('Create Model Clip', () => { app.scene.root.addProperty(clip); clips[RES] = clip; }, () => { app.scene.root.removeProperty(clip); if (clips[RES] === clip) delete clips[RES]; });
  return clip;
}

// ------------------------------------------------------------------ file-cache sources
function cacheTemplate(app: App): string {
  let t: any;
  try { t = preferenceSets(app).get('C3DPrefsSimulation')?.get('cachetemplatefilename')?.value; } catch { t = undefined; }
  return String(t ?? (app as any).simulationPrefs?.cachetemplatefilename ?? '[object]_[version]_[frame]');
}
/** Guess model / object from the file name with the cache template: `[model]` / `[object]` tokens matched against the
 *  `_`-separated parts of the file name. null = the guess fails. */
function guessTarget(app: App, file: string): { model: Model; object: X3DObject | null; objectName: string } | null {
  const tokens = cacheTemplate(app).replace(/\.[^.\]]*$/, '').split('_');
  const parts = stem(file).split('_');
  const mi = tokens.findIndex(t => /^\[model\]$/i.test(t)), oi = tokens.findIndex(t => /^\[object\]$/i.test(t));
  if ((mi < 0 && oi < 0) || parts.length < tokens.length) return null;   // inferred: the match needs every template part
  const modelName = mi >= 0 ? parts[mi] : 'Scene_Root';
  const m = objectArg(app, modelName); const model = m instanceof Model ? m : app.scene.root;
  const objectName = oi >= 0 ? parts[oi] : '';
  const object = objectName ? [...model.descendants()].find(o => o.name === objectName) ?? null : null;
  return { model, object, objectName };
}
function addFileCacheSource(app: App, command: string, a: Record<string, any>): any {
  const file = String(a.FileName ?? '');
  if (!file) throw fail(E_POINTER, `${command}: no FileName`);
  // the first InputObj item that is a 3D object is the target
  let object: X3DObject | null = null; let model: Model | null = null; let objectName = '';
  for (const x of listOf(a.InputObj)) { const o = objectArg(app, x); if (o) { if (o instanceof Model) model = o; else { object = o; model = modelOf(o); } break; } }
  if (!unset(a.SourceObject)) logNya(app, command, `how SourceObject "${a.SourceObject?.name ?? a.SourceObject}" changes the target (open question 3); it was not used`);
  if (!model) {
    const g = guessTarget(app, file);
    if (g) { model = g.model; object = g.object; objectName = g.objectName; }
    else {
      if (!interactive(app)) throw fail(E_INVALIDARG, `${command}: no target object and no user session to pick one`);
      const prompt = siString('XSIIMAGECLIP', 0x24) ?? '[XSIIMAGECLIP 0x24: pick prompt text not yet attested]';
      let picked = false;
      startPickSession(app, {
        command, kind: 'element', prompt, followSelection: true,
        fromClick: (_p, pick) => (pick as any)?.obj ?? null,
        onPick: (v: any) => { const o = objectArg(app, v); if (!o) return true; picked = true; try { app.run(command, { ...a, InputObj: [o] }); } catch { /* logged by the bus */ } return false; },
        onEnd: () => { if (!picked) app.logMsg('info', `${command}: pick cancelled (status 0x${E_ABORT.toString(16)})`); },
      });
      return outputs({ Source: null });
    }
  }
  // 3. no target object: SIGetPrim pointcloud under the current scene model
  if (!object) {
    const sel = [...app.selection];
    try { object = app.run('GetPrim', { PresetObj: 'EmptyPointCloud', Name: objectName || 'pointcloud' }) ?? null; } catch { object = null; }
    app.selection = sel;
    logNya(app, command, 'the pointcloud prim arguments (open question 3); an empty point cloud was created under the scene root');
    if (!object) throw fail(E_FAIL, `${command}: the point cloud could not be created`);
    if (!model) model = app.scene.root;
  }
  // 4. lock check, path, the model's mixer container
  lockCheck(app, command, 'sources');
  const path = resolvedPath(file); const mix = mixerX(model);
  // 5. the file-cache source
  const rel = object === model ? '' : object.name;
  const start = app.anim.startFrame, len = Math.max(1, app.anim.endFrame - app.anim.startFrame + 1);
  const base = String(a.Name ?? '') || nameFromFile(stem(file)); const takenNames = new Set(model.properties.map(p => p.name));
  let srcName = base; for (let i = 1; takenNames.has(srcName); i++) srcName = `${base}${i}`;
  const src = new Property(srcName, 'filecachesource', [
    str('ObjectName', rel, 'Object Name'), str('FileName', file, 'File Name'), str('Path', path, 'Path', { readOnly: true }),
    int('NumberOfFrames', len, 'Number of Frames'), int('FrameStart', start, 'Frame Start'), int('FrameEnd', start + len - 1, 'Frame End'),
  ]);
  logNya(app, command, 'the frame range and sub-step count of the cache file (the file is not read); the scene frame range was used');
  const m = model;
  app.record('Add File Cache Source', () => m.addProperty(src), () => m.removeProperty(src));
  // 6. deploy in the mixer: AddTrack (cache track) + AddClip at the source start
  if (truthy(a.DeployInMixer)) {
    editMixer(app, mix, app.scene.root, 'Add Cache Clip', () => {
      const track = mix.clips.reduce((t, c) => Math.max(t, (c.track ?? 0) + 1), 0);
      const clip: ClipX = { name: uniqueClipName(mix, `${src.name}_Clip`), source: src.name, start, duration: len, track, weight: 1, mute: false, type: FILE_CACHE_CLIP };
      (clip as any).trackType = FILE_CACHE_TRACK;
      mix.clips.push(clip); return clip;
    });
    logNya(app, command, 'the clip options of the deploy-in-mixer step and whether Source or the clip is returned (open question 3); the source is returned');
  }
  return outputs({ Source: src });
}

// ------------------------------------------------------------------ audio
function modelArg(app: App, command: string, x: any): Model {
  const o = objectArg(app, x);
  if (!o) throw fail(E_POINTER, `${command}: Model is required`);
  return modelOf(o) ?? app.scene.root;
}
function importAudio(app: App, command: string, a: Record<string, any>): Property {
  const model = modelArg(app, command, a.Model);
  const full = String(a.FileName ?? '').trim();
  const m = /^(.*)[\\/]([^\\/]*)$/.exec(full); const dir = m ? m[1] : '', file = m ? m[2] : full;
  if (!file) throw fail(E_POINTER, `${command}: FileName is required`);
  const st = stateOf(app);
  mixerX(model);   // the model's audio container (inferred: its mixer)
  const oldDir = st.lastAudioFolder;
  app.record('Audio folder', () => { st.lastAudioFolder = dir; }, () => { st.lastAudioFolder = oldDir; });
  const path = dir ? `${dir}\\${file}` : file;
  const name = String(a.Name ?? '') || nameFromFile(file);
  const taken = new Set(model.properties.map(p => p.name)); let n = name, i = 1; while (taken.has(n)) n = `${name}${i++}`;
  const src = new Property(n, 'audiosource', [
    str('filename', path, 'File Name', { readOnly: true }),
    num('SampleRate', 44100, 'Sample Rate'),                                                        // inferred: the file is not decoded
    num('duration', Math.max(1, app.anim.endFrame - app.anim.startFrame), 'Duration (frames)'),    // inferred: as ImportAudioAndAddClip
  ]);
  app.record('Import Audio', () => model.addProperty(src), () => model.removeProperty(src));
  return src;
}
function trackIndex(x: any): number | null { x = first(x); if (unset(x)) return null; const m = /(\d+)\s*$/.exec(String(x)); return m ? Number(m[1]) : null; }
function addAudioClip(app: App, command: string, a: Record<string, any>): ClipX | undefined {
  const st = stateOf(app);
  const model = modelArg(app, command, a.Model);
  const srcArg = first(a.Source);
  if (unset(srcArg)) throw fail(E_POINTER, `${command}: Source is required`);
  const source = srcArg instanceof Property ? srcArg : model.properties.find(p => p.name === String(srcArg) || p.fullName === String(srcArg)) ?? rootProp(app, srcArg);
  if (!source) throw fail(E_INVALIDARG, `${command}: Source "${srcArg}" not found`);
  if (unset(a.Time)) throw fail(E_INVALIDARG, `${command}: Time is required`);   // inferred: the failure code of the missing time
  const time = Number(a.Time);
  if (!unset(a.Compound)) logNya(app, command, 'adding the track to a compound clip; the track is added to the model\'s mixer');
  const mix = mixerX(model);
  let track = trackIndex(a.Track);
  const len = Math.max(1, Number(source.val('duration')) || 1);
  if (track !== null && isAudioSource(source)) {
    const end = time + len - 1;
    const hit = mix.clips.some(c => (c.track ?? 0) === track && c.start <= end && c.start + c.duration - 1 >= time);
    if (hit) { app.logMsg('error', siString('XSIMOAUDIO', 0x6f) ?? '[XSIMOAUDIO 0x6f: the clip does not fit on the track; text not yet attested]'); throw fail(E_FAIL, `${command}: the clip does not fit on track ${track}`); }
  }
  if (track !== null && st.lockedTracks.has(`${model.name}:${track}`)) throw fail(E_ACCESSDENIED, `${command}: track ${track} is locked`);
  if (!isAudioSource(source)) return undefined;   // not an audio source: no clip
  const rate = Number(source.val('SampleRate')) || 0;
  if (rate !== st.projectAudioSampleRate) {
    if (st.audioRateFixed) { app.logMsg('error', siString('XSIMOAUDIO', 0x70) ?? '[XSIMOAUDIO 0x70: the scene audio sample rate is fixed; text not yet attested]'); return undefined; }
    const old = st.projectAudioSampleRate;
    app.record('Project Audio Sample Rate', () => { st.projectAudioSampleRate = rate; }, () => { st.projectAudioSampleRate = old; });
  }
  return editMixer(app, mix, app.scene.root, 'Add Audio Clip', () => {
    if (track === null) track = mix.clips.reduce((t, c) => Math.max(t, (c.track ?? 0) + 1), 0);   // AddTrack: a new audio track at the end (inferred index)
    const clip: ClipX = { name: uniqueClipName(mix, String(a.Name ?? '') || source.name), source: source.name, start: time, duration: len, track, weight: 1, mute: false, type: T_AUDIO };
    mix.clips.push(clip); return clip;
  });
}

// ================================================================== registration
export function registerClipsSourcesB15dCommands(app: App) {
  const st: ClipsSourcesB15dState = {
    locked: { sources: false, clips: false }, restrictedEdition: false, defaultImage: DEFAULT_IMAGE, lastAudioFolder: '',
    projectAudioSampleRate: 44100, audioRateFixed: false, lockedTracks: new Set(),
    modes: { 'e2be2c7e-364b-11d3-b37b-00105a1e70de': 0, '4d2a9d9f-7f80-4ed3-9a47-0d0141b48ac4': 2, '381d22f4-0961-46de-b9fa-e239189ccb51': 3, '3060d96a-7eea-4d82-a63c-9297c3a4d881': 4 },
    createImageClips: (f, n, mode) => createImageClips(app, 'SICreateImageClip2', f, n, mode),
    createModelClip: (f, n, s) => createModelClip(app, 'SICreateModelClip', f, n, s),
    status: {},
  };
  (app as any).clipsSourcesB15d = st;
  const IMG = 'File|Texturing';

  app.register({
    name: 'SIAddImageSource', label: 'Low level Add Image Source', category: IMG, description: 'Low level Add Image Source',
    args: [{ name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'Source', default: null }],
    execute(app, a) {
      const file = String(a.FileName ?? '');
      if (!file) noBrowser(app, 'SIAddImageSource');
      return outputs({ FileName: file, Source: addImageSource(app, 'SIAddImageSource', file, String(a.Name ?? '')) });
    },
  });
  app.register({
    name: 'SIAddImageClip', label: 'Low level Add Image Clip', category: IMG, description: 'Low level Add Image Clip',
    args: [{ name: 'Source', default: null }, { name: 'Name', default: '' }, { name: 'Clip', default: null }],
    execute(app, a) {
      if (unset(first(a.Source))) throw fail(E_INVALIDARG, 'SIAddImageClip: Source is required');   // inferred: the failure code of the missing object
      const source = rootProp(app, a.Source);
      if (!source) throw fail(E_INVALIDARG, `SIAddImageClip: Source "${first(a.Source)}" not found`);
      return outputs({ Clip: addImageClip(app, 'SIAddImageClip', source, String(a.Name ?? '')) });
    },
  });
  app.register({
    name: 'SIAddImageSourceOp', label: 'Low level Add Image Source Op', category: IMG, description: 'Low level Add Image Source Op',
    args: [{ name: 'Clip', default: null }, { name: 'Source', default: null }],
    execute(app, a) { return addImageSourceOp(app, 'SIAddImageSourceOp', a.Clip, a.Source); },
  });
  app.register({
    name: 'SIAddImageOp', label: 'Low level Add Image Op', category: IMG, description: 'Low level Add Image Op',
    args: [{ name: 'PresetObj', default: null }, { name: 'Clip', default: null }],
    execute(app, a) { return addImageOpCmd(app, 'SIAddImageOp', a.PresetObj, a.Clip); },
  });
  app.register({
    name: 'SIAddWritableImageSource', label: 'Low level Add Writable Image Source', category: IMG, description: 'Low level Add Writable Image Source',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Width', default: 256 }, { name: 'Height', default: 256 },
      { name: 'Type', default: ':siRenderChannelColorType:siRenderChannelType' }, { name: 'UseExisting', default: false }, { name: 'Source', default: null }],
    execute(app, a) { return outputs({ FileName: String(a.FileName ?? ''), Source: addWritableImageSource(app, 'SIAddWritableImageSource', a) }); },
  });
  app.register({
    name: 'SetImageSource', label: 'Set Image Source', category: IMG, description: 'Set Image Source',
    args: [{ name: 'Source', default: null }, { name: 'InputObjs', default: null }],
    execute(app, a) { setImageSource(app, 'SetImageSource', a.Source, a.InputObjs); return undefined; },
  });
  // one handler, three registrations: the command definition selects the mode (WIRE_CORRECTIONS_B15 item 32)
  app.register({
    name: 'SICreateImageClip', label: 'Low level Create Image Clip', category: IMG, description: 'Low level Create Image Clip',
    args: [{ name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'Clip', default: null }],
    execute(app, a) {
      const file = String(a.FileName ?? ''); if (!file) noBrowser(app, 'SICreateImageClip');
      const clips = createImageClips(app, 'SICreateImageClip', file, String(a.Name ?? ''), st.modes['e2be2c7e-364b-11d3-b37b-00105a1e70de']);
      return outputs({ FileName: file, Clip: clips[0] ?? null });
    },
  });
  app.register({
    name: 'SICreateImageClip2', label: 'Low level Create Image Clip', category: IMG, description: 'Low level Create Image Clip',
    args: [{ name: 'FileName', default: null }, { name: 'Name', default: '' }],
    execute(app, a) {
      const file = String(a.FileName ?? ''); if (!file) noBrowser(app, 'SICreateImageClip2');
      return createImageClips(app, 'SICreateImageClip2', file, String(a.Name ?? ''), st.modes['4d2a9d9f-7f80-4ed3-9a47-0d0141b48ac4']);
    },
  });
  app.register({
    name: 'SICreateDefaultImageClip', label: 'Low level Create Default Image Clip', category: IMG, description: 'Low level Create Default Image Clip',
    args: [{ name: 'Clip', default: null }],
    execute(app) {
      const clips = createImageClips(app, 'SICreateDefaultImageClip', st.defaultImage, '', st.modes['3060d96a-7eea-4d82-a63c-9297c3a4d881']);
      return outputs({ Clip: clips[0] ?? null });   // inferred: the single out-argument is the first clip
    },
  });

  // ---------------------------------------------------------------- model sources and clips
  app.register({
    name: 'SIAddModelSource', label: 'SIAddModelSource', category: 'File', description: 'Low level Create Model Source',
    args: [{ name: 'FileName', default: '' }, { name: 'Name', default: '' }, { name: 'Source', default: null }, { name: 'Resolution', default: 2 }],
    execute(app, a) {
      const res = unset(a.Resolution) ? 2 : Number(a.Resolution);
      return outputs({ Source: addModelSource(app, 'SIAddModelSource', String(a.FileName ?? ''), String(a.Name ?? ''), res) });
    },
  });
  app.register({
    name: 'SICreateModelClip', label: 'SICreateModelClip', category: 'File', description: 'Low level Create Model Clip',
    args: [{ name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'Clip', default: null }],
    execute(app, a) {
      const file = String(a.FileName ?? '');
      return outputs({ FileName: file, Clip: createModelClip(app, 'SICreateModelClip', file, String(a.Name ?? ''), null) });
    },
  });
  app.register({
    name: 'SIAddModelClip', label: 'SIAddModelClip', category: 'File', description: 'Low level Add Model Clip',
    args: [{ name: 'Source', default: null }, { name: 'Name', default: '' }, { name: 'Clip', default: null }],
    execute(app) {
      const text = 'Obsolete command, to create a clip you have to change the model source resolution.';
      app.logMsg('error', text);
      throw fail(E_FAIL, `SIAddModelClip: ${text}`);
    },
  });

  // ---------------------------------------------------------------- file-cache sources
  app.register({
    name: 'AddFileCacheSource', label: 'Create a new FileCache Source', category: 'Edit', description: 'Create a new FileCache Source',
    args: [{ name: 'InputObj', default: null }, { name: 'FileName', default: null }, { name: 'DeployInMixer', default: true }, { name: 'Source', default: null }],
    execute(app, a) { return addFileCacheSource(app, 'AddFileCacheSource', a); },
  });
  app.register({
    name: 'AddFileCacheSource2', label: 'Create a new FileCache Source with a specified source cached object', category: 'Edit', description: 'Create a new FileCache Source with a specified source cached object',
    args: [{ name: 'InputObj', default: null }, { name: 'FileName', default: null }, { name: 'DeployInMixer', default: true }, { name: 'SourceObject', default: '' }, { name: 'Source', default: null }],
    execute(app, a) { return addFileCacheSource(app, 'AddFileCacheSource2', a); },
  });

  // ---------------------------------------------------------------- audio
  app.register({
    name: 'ImportAudio', label: 'ImportAudio', category: 'File', description: 'Import an audio file as an audio source of the model',
    args: [{ name: 'Model', default: null }, { name: 'FileName', default: null }, { name: 'Name', default: '' }],
    execute(app, a) { return importAudio(app, 'ImportAudio', a); },
  });
  app.register({
    name: 'AddAudioClip', label: 'AddAudioClip', category: 'File', description: 'Add an audio clip of an audio source to the mixer',
    args: [{ name: 'Model', default: null }, { name: 'Source', default: null }, { name: 'Compound', default: null }, { name: 'Track', default: null }, { name: 'Time', default: null }, { name: 'Name', default: '' }],
    execute(app, a) { return addAudioClip(app, 'AddAudioClip', a); },
  });
}
