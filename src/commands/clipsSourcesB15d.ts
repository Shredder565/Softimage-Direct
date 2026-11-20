// Ledger row CMD-B15d (`imageclip.dll`, `moaudio.dll`): image / model / file-cache sources and clips, audio import / clips.
//   SIAddImageSource SIAddImageClip SIAddImageSourceOp SIAddImageOp SIAddWritableImageSource SICreateImageClip2
//   SICreateDefaultImageClip SICreateImageClip SetImageSource            (this file, image side)
//   SIAddModelSource SICreateModelClip SIAddModelClip AddFileCacheSource AddFileCacheSource2 ImportAudio AddAudioClip
//                                                                         (clipsSourcesB15dMedia.ts)
// Brief: docs/ghidra/cmd-b15d-clips-sources.md ("Wire contract" and the section of each command, including `(inferred)`
// parts) and docs/re/WIRE_CORRECTIONS_B15.md items 30-34. Original code written from that prose only.
// SICreateImageClip is the same handler as SICreateImageClip2 (mode 0) and is wired with it.
//
// This replaces the stand-ins of the UIXSI clips row (uixsiClipsDisplayAddons.ts): that row calls these commands first
// and only falls back to its own stand-in when they are not on the bus. Stand-in model: see clipsSourcesB15dShared.ts.
// Not modelled (logged "not yet attested" when it would matter): registered file parsers (flag 0x10 branches of
// SIAddImageSource / SICreateImageClip2), the file browser of an empty FileName, the slot-10 path of SIAddImageOp.
import { App, CommandDef } from '../core/commands';
import { Property } from '../core/scene';
import { str, bool, int } from '../core/params';
import { siConst } from './viewEditPropertyHelpers';
import {
  b15d, storeOf, unset, nameOf, fail, logNya, lockCheck, resolveAny, listArg, uniqueIn, baseName, fileOnly, samePath, E_FAIL, E_INVALIDARG,
  isImageSourceNode, isImageClipNode, ClipImageOperator, clipOps,
} from './clipsSourcesB15dShared';
import { registerClipsSourcesB15dMediaCommands } from './clipsSourcesB15dMedia';

const CAT = 'File|Texturing';
/** Image-source operator class (preset class of the image-source operator, clip operator). */
const IMAGE_SOURCE_OP_CLASS = '756a0bc4-7905-48b3-8793-fa760aac3219';
type ArgList = [string, any][];
const ARGS = (l: ArgList) => l.map(([name, d]) => ({ name, default: d }));
/** siRenderChannelType values accepted by SIAddWritableImageSource (1..6; the names are the scripting constants). */
const CHANNEL_TYPES: Record<string, number> = {
  siRenderChannelGrayscaleType: 1, siRenderChannelColorType: 2, siRenderChannelVectorType: 3, siRenderChannelBooleanType: 4,   // inferred values
  siRenderChannelDepthType: 5, siRenderChannelLabelType: 6,
};

// ------------------------------------------------------------------ SIAddImageSource
/** The worker of SIAddImageSource: reuse by resolved path, else a new source. */
export function addImageSource(app: App, C: string, file: string, name: string): Property | undefined {
  if (unset(file)) return undefined;                      // 1. empty FileName: nothing happens
  lockCheck(app, C, 'sources');                           // 2.
  const store = storeOf(app, 'imageSources');
  const old = store.find(s => samePath(String(s.val('FileName') ?? ''), file));   // 3-4. reuse: same resolved path, case-insensitive
  if (old) return old;
  // 5. no file parser in this build: a new image source whose file name is FileName as given
  logNya(app, C, 'registered file parsers (a file with a parser is created through it); a plain image source was made');
  const src = new Property(name ? name : uniqueIn(store.map(s => s.name), baseName(file) || 'ImageSource'), 'imagesource', [str('FileName', file, 'File Name')]);   // 6. default name inferred: file based
  app.record('Add image source', () => { if (!store.includes(src)) store.push(src); }, () => { const i = store.indexOf(src); if (i >= 0) store.splice(i, 1); });
  return src;
}

// ------------------------------------------------------------------ SIAddImageSourceOp / SIAddImageOp / SetImageSource
function setClipSource(app: App, clip: Property, source: Property | null) {
  const old = (clip as any).source ?? null; const oldFile = clip.val('filename');
  const file = source ? String(source.val('FileName') ?? source.val('filename') ?? '') : '';
  app.record('Set image source', () => { (clip as any).source = source; clip.set('filename', file); }, () => { (clip as any).source = old; clip.set('filename', oldFile); });
}
function addImageSourceOp(app: App, a: Record<string, any>) {
  const C = 'SIAddImageSourceOp';
  const clip = resolveAny(app, a.Clip);
  if (!isImageClipNode(clip)) return undefined;           // Clip must be an image clip, else nothing
  let source: Property | null;
  if (unset(a.Source)) source = (clip as any).source ?? null;   // omitted: the clip's current source
  else { const s = resolveAny(app, a.Source); if (!isImageSourceNode(s)) return undefined; source = s; }
  if (!source) { logNya(app, C, `${clip.name} has no source and none was given; no operator was made`); return undefined; }
  const op = new ClipImageOperator(uniqueIn(clipOps(clip).map(o => o.name), 'ImageSourceOp'), 'imagesourceop', clip, source, IMAGE_SOURCE_OP_CLASS);
  // the three ports (source, clip child 1, clip child 0x27) are the op's source / clip pair; ApplyOperator mode 3, flag 4
  app.record('Add image source operator', () => { const l = clipOps(clip); if (!l.includes(op)) l.push(op); }, () => { const l = clipOps(clip); const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); });
  app.run('SetImageSource', { Source: source, InputObjs: clip });
  return op;
}
function addImageOp(app: App, a: Record<string, any>) {
  const C = 'SIAddImageOp';
  if (unset(a.PresetObj)) throw fail(E_FAIL, `${C}: no preset (the alternative preset id of the slot-10 path is never filled from scripting)`);   // zero id => E_FAIL
  const clip = resolveAny(app, a.Clip);
  if (!isImageClipNode(clip)) return undefined;
  const preset = nameOf(a.PresetObj);
  if (preset.toLowerCase().includes(IMAGE_SOURCE_OP_CLASS) || /^image ?source( ?op(erator)?)?$/i.test(preset.replace(/^.*[.\\/]/, '')))
    return app.run('SIAddImageSourceOp', { Clip: clip, Source: (clip as any).source ?? null });   // routed to SIAddImageSourceOp
  const op = new ClipImageOperator(uniqueIn(clipOps(clip).map(o => o.name), preset.replace(/^.*[.\\/]/, '') || 'ImageOp'), 'imageop', clip, null, preset);
  app.record('Add image operator', () => { const l = clipOps(clip); if (!l.includes(op)) l.push(op); }, () => { const l = clipOps(clip); const i = l.indexOf(op); if (i >= 0) l.splice(i, 1); });   // in place: clip connected as input and output
  return op;
}
function setImageSource(app: App, a: Record<string, any>) {
  const C = 'SetImageSource';
  if (unset(a.InputObjs)) throw fail(E_INVALIDARG, `${C}: InputObjs is required`);
  let source: Property | null = null;
  if (!unset(a.Source)) { const s = resolveAny(app, a.Source); if (!isImageSourceNode(s)) return undefined; source = s; }   // null clears (inferred)
  for (const c of listArg(app, a.InputObjs)) if (isImageClipNode(c)) setClipSource(app, c, source);   // non-clips skipped silently
  return undefined;
}

// ------------------------------------------------------------------ SIAddImageClip
function addImageClip(app: App, a: Record<string, any>) {
  const C = 'SIAddImageClip';
  let source: Property | null = null;
  if (!unset(a.Source)) { const s = resolveAny(app, a.Source); if (!isImageSourceNode(s)) return undefined; source = s; }
  if (source && (source as any).locked) throw fail(E_FAIL, `${C}: ${source.name} is locked`);
  const name = unset(a.Name) ? (source ? source.name : 'Clip') : String(a.Name);   // empty Name takes the source's name
  const clip = new Property(app.scene.uniqueName(name), 'imageclip', [str('filename', '', 'File Name'), bool('enabled', true, 'Enabled')]);
  app.record('Image clip', () => app.scene.root.addProperty(clip), () => app.scene.root.removeProperty(clip));
  if (source) app.run('SIAddImageSourceOp', { Clip: clip, Source: source });   // the clip gets its source operator
  return clip;
}

// ------------------------------------------------------------------ SIAddWritableImageSource
function addWritableImageSource(app: App, a: Record<string, any>) {
  const C = 'SIAddWritableImageSource';
  const file = unset(a.FileName) ? '' : String(a.FileName);
  const w = Number(a.Width ?? 256), h = Number(a.Height ?? 256);
  const t = siConst(a.Type ?? ':siRenderChannelColorType:siRenderChannelType');
  const type = typeof t === 'number' ? t : (CHANNEL_TYPES[String(t)] ?? NaN);
  if (!(w >= 1) || !(h >= 1) || !(type >= 1 && type <= 6)) {
    logNya(app, C, 'the HRESULT for an invalid Width / Height / Type (E_INVALIDARG is used)');
    throw fail(E_INVALIDARG, `${C}: Width and Height must be at least 1 and Type must be 1 to 6`);
  }
  if (!file) logNya(app, C, 'the file browser an empty FileName opens; no file name was chosen');
  lockCheck(app, C, 'sources');
  const store = storeOf(app, 'imageSources');
  if (a.UseExisting === true || /^(true|1)$/i.test(String(a.UseExisting))) {
    logNya(app, C, 'the UseExisting lookup rule (0x180014660 not decoded); the writable source of the same resolved path is used');
    const old = file ? store.find(s => s.val('Writable') === true && samePath(String(s.val('FileName') ?? ''), file)) : undefined;
    if (old) return old;
  }
  const name = unset(a.Name) ? uniqueIn(store.map(s => s.name), baseName(file) || 'ImageSource') : String(a.Name);
  const src = new Property(name, 'imagesource', [str('FileName', file, 'File Name'), int('Width', w, 'Width'), int('Height', h, 'Height'), int('Type', type, 'Type'), bool('Writable', true, 'Writable')]);
  app.record('Add writable image source', () => { if (!store.includes(src)) store.push(src); }, () => { const i = store.indexOf(src); if (i >= 0) store.splice(i, 1); });
  return src;
}

// ------------------------------------------------------------------ SICreateImageClip / 2 / SICreateDefaultImageClip
/** mode 0 = SICreateImageClip, 2 = SICreateImageClip2, 4 = SICreateDefaultImageClip. Returns the created clips. */
function createImageClips(app: App, C: string, mode: 0 | 2 | 4, a: Record<string, any>): Property[] {
  lockCheck(app, C, 'clips');
  let file = mode === 4 ? b15d(app).defaultImage : (unset(a.FileName) ? '' : String(a.FileName));   // mode 4: the preference default image
  const name = mode === 4 || unset(a.Name) ? '' : String(a.Name);
  if (mode === 4 && !file) logNya(app, C, 'the preference default image is empty in this build (set app.clipsSourcesB15d.defaultImage)');
  if (!file) return [];                                                                          // SIAddImageSource does nothing for an empty file name
  const source = app.run('SIAddImageSource', { FileName: file, Name: '' }) as Property | undefined;
  if (!source) return [];
  const n = mode === 2 ? Math.max(1, Math.floor(b15d(app).subImageCount(file))) : 1;              // sub-image count in modes 2 and 3
  const clips: Property[] = [];
  for (let i = 0; i < n; i++) {
    let cname = name;
    if (n > 1) {
      cname = i === 0 ? (name || fileOnly(file)) : `V${i}_${name || fileOnly(file)}`;           // later clips V%d_%s
      if (i === 0 && name) logNya(app, C, 'the first-clip naming guard of the multi-clip case (open question 1); Name is used when given');
    }
    const clip = app.run('SIAddImageClip', { Source: source, Name: cname }) as Property | undefined;
    if (!clip) continue;
    if (n > 1) {                                                                                  // SetValue on the clip parameter 0x2f = i (inferred: view index)
      if (!clip.get('SubImageIndex')) clip.add(int('SubImageIndex', i, 'Sub Image Index'));
      else clip.set('SubImageIndex', i);
    }
    clips.push(clip);
  }
  return clips;
}

// ------------------------------------------------------------------ registration
export function registerClipsSourcesB15dCommands(app: App) {
  b15d(app);
  const reg = (name: string, args: ArgList, execute: (app: App, a: Record<string, any>) => any, extra: Partial<CommandDef> = {}) =>
    app.register({ name, label: name, category: CAT, description: '', args: ARGS(args), undoable: true, execute, ...extra });
  reg('SIAddImageSource', [['FileName', null], ['Name', ''], ['Source', null]], (app, a) => addImageSource(app, 'SIAddImageSource', unset(a.FileName) ? '' : String(a.FileName), unset(a.Name) ? '' : String(a.Name)));
  reg('SIAddImageClip', [['Source', null], ['Name', ''], ['Clip', null]], addImageClip);
  reg('SIAddImageSourceOp', [['Clip', null], ['Source', null], ['Operator', null]], addImageSourceOp);
  reg('SIAddImageOp', [['PresetObj', null], ['Clip', null], ['Operator', null]], addImageOp);
  reg('SIAddWritableImageSource', [['FileName', ''], ['Name', ''], ['Width', 256], ['Height', 256], ['Type', ':siRenderChannelColorType:siRenderChannelType'], ['UseExisting', false], ['Source', null]], addWritableImageSource);
  reg('SetImageSource', [['Source', null], ['InputObjs', null]], setImageSource);
  reg('SICreateImageClip2', [['FileName', null], ['Name', ''], ['Clip', null]], (app, a) => createImageClips(app, 'SICreateImageClip2', 2, a));   // the collection of clips
  reg('SICreateImageClip', [['FileName', null], ['Name', ''], ['Clip', null]], (app, a) => createImageClips(app, 'SICreateImageClip', 0, a)[0]);
  reg('SICreateDefaultImageClip', [['Clip', null]], (app, a) => {
    const l = createImageClips(app, 'SICreateDefaultImageClip', 4, a);
    return l[0];                                                                                   // the single Clip is the first clip (inferred)
  });
  registerClipsSourcesB15dMediaCommands(app);
}
