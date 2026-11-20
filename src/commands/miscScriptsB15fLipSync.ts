// CMD-B15f part 2: GenerateLipSync (EvolverLipSync.js, note section 3.11).
// This build has no Evolver face-model mixer, audio sources or speech actions, so a small ORIGINAL stand-in model
// lives in `app.miscScriptsB15f.lipsync`: mixer tracks per model, audio sources / clips, speech actions / clips,
// clip relations and the play range (the real play range, `app.anim.startFrame/endFrame`, is updated too).
//  * Base shape clips are read from `model.evolverMixerTracks` / `lipsync.mixers[<model name>]`: tracks of clips, a
//    clip being `{ name, container?: { tracks: [{ clips: [{ name }] }] } }` (stand-in; the mixer of this build has no
//    clip containers).
//  * Workers the script calls that are other rows are called through `lipsync.workers[<name>]` when supplied, else
//    (ExtractPhonemesToSpeechOp[Japanese]) the registered command, else a stand-in: SetupEvolverVisemes maps each
//    base clip to its viseme letter (the mapping-profile XML is not parsed: "not yet attested"), CreateEvolverSpeechAction
//    records the action, ImportAudio needs the file in the host file system and takes its length from
//    `lipsync.audioFrames[path]` (default 100 frames).
//  * Interactive branches that need a dialog (the model pick session, the audio file browser) use the hooks
//    `lipsync.pickModel()` / `lipsync.browseAudio()`; without a hook they take the cancel path (warning 1520).
import { App } from '../core/commands';
import { Model, Node, X3DObject } from '../core/scene';
import { siString } from '../ui/si';
import { hostFs, miscState, regB15f, interactive, join, nya, warn } from './miscScriptsB15fShared';

const FACTORY = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2';
const BASE_TOKENS = ['SH_CH', 'UW_U', '_S_', 'RRR', 'UH_OO', 'MPB', 'AO_a', 'LLL', 'KG', 'TD_I', 'H_EST', 'FV', 'AE_AA'];
const MESHES: [string, string][] = [['h', 'H_DDS_HighRes'], ['m', 'H_DDS_MidRes'], ['l', 'H_DDS_LowRes'], ['c', 'H_DDS_CrowdRes']];

const FALLBACK: Record<string, Record<number, string>> = {
  XSIMSGCAT: { 23: 'File not found: %s', 28: 'The selected object is not a model', 1020: 'Invalid argument' },
  XSISCRIPTS: { 1520: 'Command cancelled' },
  XSIACTION2: { 1088: 'Failed to import the audio file', 1089: 'Failed to create the speech action', 1090: 'Phoneme recognition failed', 1091: 'Face mesh resolution not found: %s' },
};
const msg = (dict: string, id: number, arg = ''): string => {
  const t = (siString(dict, id) ?? FALLBACK[dict][id]).replace(/^\d+\$/, '');
  if (id === 1020) return arg === '' ? t : `${t} "${arg}"`;   // invalid argument, followed by the value in quotes
  return t.includes('%s') ? t.replace('%s', () => arg) : arg === '' ? t : `${t} ${arg}`;
};
const raise = (dict: string, id: number, arg = ''): never => { throw new Error(msg(dict, id, arg)); };

export interface LipTrack { model: string; name: string; type: number; keywords: string; clips: any[] }
export interface LipState {
  mixers: Record<string, { name: string; clips: any[] }[]>;
  tracks: LipTrack[]; audioSources: { name: string; path: string; frames: number }[]; audioClips: any[]; actions: any[]; speechClips: any[]; relations: any[][];
  audioFrames: Record<string, number>; workers: Record<string, (...a: any[]) => any>; calls: { worker: string; args: any[] }[];
  pickModel: (() => any) | null; browseAudio: (() => string) | null; playRange: { in: number; out: number } | null; last: any;
}
export const freshLipState = (): LipState => ({ mixers: {}, tracks: [], audioSources: [], audioClips: [], actions: [], speechClips: [], relations: [], audioFrames: {}, workers: {}, calls: [], pickModel: null, browseAudio: null, playRange: null, last: null });

const asText = (v: any): string => v instanceof Node ? v.name : typeof v === 'string' ? v : Array.isArray(v) ? v.map(asText).join(',') : String(v);
function firstModel(app: App, arg: any): Model | null {
  const list = Array.isArray(arg) ? arg : arg === null || arg === undefined || arg === '' ? [] : [arg];
  for (const x of list) {
    const n: any = x instanceof Node ? x : typeof x === 'string' ? app.scene.find(x.replace(/^[^.]*\./, '').split('.').pop()!) ?? app.scene.find(x) : x?.Value instanceof Node ? x.Value : null;
    if (n instanceof Model) return n;
  }
  return null;
}
const hasMesh = (model: Model, name: string): boolean => [...(model as X3DObject).descendants()].some(o => o.name === name);

function baseShapeClips(model: Model, compact: string): string[] {
  const st = (model as any).evolverMixerTracks ?? [];
  const out: string[] = [];
  for (const track of st) for (const clip of track.clips ?? []) {
    if (!clip.container) continue;
    for (const inner of clip.container.tracks ?? []) {
      const first = inner.clips?.[0]; if (!first) continue;
      const name = String(first.name);
      const tok = name.split('_')[0];
      if (BASE_TOKENS.some(t => name.includes(t)) && tok.length === 1 && compact.includes(tok.toLowerCase())) out.push(name);   // inferred: letters compare without regard to case
    }
  }
  return out;
}

function worker(app: App, L: LipState, name: string, args: any[], standIn: () => any): any {
  L.calls.push({ worker: name, args });
  if (L.workers[name]) return L.workers[name](...args);
  return standIn();
}

function generateLipSync(app: App, a: Record<string, any>): any {
  const L = miscState(app).lipsync as LipState; const batch = !interactive(app);
  // 1. the model
  let found = firstModel(app, a.InputObjs);
  if (!found) {
    if (batch) raise('XSIMSGCAT', 1020, asText(a.InputObjs));
    const picked = L.pickModel ? L.pickModel() : undefined;
    if (picked === undefined || picked === null) { if (!L.pickModel) nya(app, 'GenerateLipSync', 'the "Select Model" pick session (no pick hook in this build); taking the cancel path'); warn(app, msg('XSISCRIPTS', 1520)); return undefined; }
    found = firstModel(app, [picked]); if (!found) raise('XSIMSGCAT', 28);
  }
  const model = found as Model;
  // 2. audio
  let audio = String(a.AudioFileName ?? '');
  if (audio === '') {
    if (batch) raise('XSIMSGCAT', 1020, audio);
    const got = L.browseAudio ? L.browseAudio() : '';
    if (!got) { if (!L.browseAudio) nya(app, 'GenerateLipSync', `the audio file browser (initial folder ${join(join(join(FACTORY, 'FaceRobot'), 'Data'), 'FaceRobot')}\\Audio); taking the cancel path`); warn(app, msg('XSISCRIPTS', 1520)); return undefined; }
    audio = got;
  }
  if (!hostFs.isFile(audio)) { if (batch) raise('XSIMSGCAT', 1020, audio); raise('XSIMSGCAT', 23, audio); }
  // 3. text and mapping profile
  const textFile = String(a.TextFileName ?? '');
  if (textFile !== '' && !hostFs.isFile(textFile)) raise('XSIMSGCAT', 23, textFile);
  let profile = String(a.MappingProfilePath ?? '');
  if (profile === '') { profile = join(join(join(FACTORY, 'Application'), 'rsrc'), 'DefaultPhonVisMapping.xml'); if (!hostFs.isFile(profile)) raise('XSIMSGCAT', 23, profile); }
  else if (!hostFs.isFile(profile)) raise('XSIMSGCAT', 23, profile);
  // 4. language
  const langArg = a.Language === undefined || a.Language === null ? 'en' : a.Language;
  if (typeof langArg !== 'string') raise('XSIMSGCAT', 1020, asText(langArg));
  const lang = String(langArg).toLowerCase(); if (lang !== 'en' && lang !== 'jp') raise('XSIMSGCAT', 1020, String(langArg));
  // 5. resolutions
  const resArg = a.Resolutions === undefined || a.Resolutions === null ? 'hmlc' : a.Resolutions;
  if (typeof resArg !== 'string') raise('XSIMSGCAT', 1020, asText(resArg));
  const res = String(resArg).toLowerCase(); if (!/[hmlc]/.test(res)) raise('XSIMSGCAT', 1020, String(resArg));
  // 6. face meshes
  let compact = '';
  for (const [letter, mesh] of MESHES) { if (!res.includes(letter)) continue; if (hasMesh(model, mesh)) compact += letter; else warn(app, msg('XSIACTION2', 1091, `${model.name}.${mesh}`)); }
  // 7-8. base shape clips and keys
  const clips = baseShapeClips(model, compact);
  nya(app, 'GenerateLipSync', 'the mapping-profile XML is not parsed by this build; SetupEvolverVisemes keys are one per base clip');
  const keys: any[] = worker(app, L, 'SetupEvolverVisemes', [model, clips, profile], () => clips.map(c => ({ clip: c, viseme: c.split('_')[0].toLowerCase() })));
  if (!keys || !keys.length) raise('XSIACTION2', 1091, String(resArg));
  // 9. speech action and clip
  const actionName = `EvolverSpeechAction_${compact}`;
  const audioSrc = worker(app, L, 'ImportAudio', [model, audio], () => { if (!hostFs.isFile(audio)) return null; const s = { name: hostFs.baseName(audio).replace(/\.[^.]*$/, ''), path: audio, frames: L.audioFrames[audio] ?? 100 }; L.audioSources.push(s); return s; });
  if (!audioSrc) raise('XSIACTION2', 1088);
  const speechTrack: LipTrack = { model: model.name, name: 'Phoneme_Speech', type: 0, keywords: 'Phoneme,Speech', clips: [] };
  const audioTrack: LipTrack = { model: model.name, name: 'Phoneme_Audio', type: 2, keywords: 'Phoneme,Audio', clips: [] };
  L.tracks.push(speechTrack, audioTrack);
  const audioClip = { name: audioSrc.name, track: audioTrack.name, offset: 0, startOffset: 0, clipIn: 1, clipOut: audioSrc.frames, source: audioSrc };
  audioTrack.clips.push(audioClip); L.audioClips.push(audioClip);
  const rollback = () => {
    for (const t of [speechTrack, audioTrack]) { const i = L.tracks.indexOf(t); if (i >= 0) L.tracks.splice(i, 1); }
    const s = L.audioSources.indexOf(audioSrc); if (s >= 0) L.audioSources.splice(s, 1);
    const c = L.audioClips.indexOf(audioClip); if (c >= 0) L.audioClips.splice(c, 1);
  };
  const clipIn = audioClip.clipIn + audioClip.startOffset, clipOut = audioClip.clipOut + audioClip.startOffset;
  L.playRange = { in: clipIn - 1, out: clipOut };
  (app.anim as any).startFrame = clipIn - 1; (app.anim as any).endFrame = clipOut;
  const action = worker(app, L, 'CreateEvolverSpeechAction', [model, actionName, keys], () => ({ name: actionName, model: model!.name, keys }));
  if (!action) { rollback(); raise('XSIACTION2', 1089); }
  L.actions.push(action);
  const speechClip: any = { name: actionName, track: speechTrack.name, offset: 0, action, clipIn, clipOut };
  speechTrack.clips.push(speechClip);
  const text = textFile !== '' ? hostFs.readFile(textFile).replace(/;/g, ' ') : '';
  try {
    const extract = lang === 'jp' ? 'ExtractPhonemesToSpeechOpJapanese' : 'ExtractPhonemesToSpeechOp';
    worker(app, L, extract, [speechClip, audio, text, 0, 10], () => app.run(extract, { InputObj: speechClip, FileName: audio, GuideText: text, FrameOffset: 0, SilenceDuration: 10 }));
    L.relations.push([speechClip, audioClip]);
  } catch (e: any) {
    const i = L.actions.indexOf(action); if (i >= 0) L.actions.splice(i, 1);
    rollback(); raise('XSIACTION2', 1090);
  }
  L.speechClips.push(speechClip); L.last = { model: model.name, compact, keys, speechClip };
  return speechClip;
}

export function registerMiscB15fLipSyncCommand(app: App) {
  miscState(app).lipsync = freshLipState();
  regB15f(app, {
    name: 'GenerateLipSync', label: 'GenerateLipSync', category: 'Animation', description: 'Generate Evolver lip-sync animation on a face model from an audio file',
    args: [{ name: 'InputObjs', default: null }, { name: 'AudioFileName', default: '' }, { name: 'TextFileName', default: '' }, { name: 'Language', default: 'en' }, { name: 'Resolutions', default: 'hmlc' }, { name: 'MappingProfilePath', default: '' }, { name: 'Value', default: null }],
    undoable: false,
    execute: (app2, a) => generateLipSync(app2, a),
  });
}
