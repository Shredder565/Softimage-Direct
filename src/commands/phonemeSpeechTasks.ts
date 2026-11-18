// Ledger row CMD-B9d. Brief: docs/ghidra/cmd-b9d-phonemeui-speech-binary.md, "Shared facts" and "Contracts".
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   extraction   ExtractPhonemesToSpeechOp ExtractPhonemesToSpeechOpJapanese SIExtractPhonemes
//   queries      GetPhonemesFromSpeechClip GetPhonemeBlendFromSpeechClip
//   playback     PlaybackTimeRange
//   editing      the 20 SpeechOp* commands (phonemeSpeechTasksEdit.ts)
//   data model   phonemeSpeechTasksModel.ts (stand-in speech object / source / clip, hung on `app.phonemeSpeech`)
//
// How the contract is mapped onto this build:
//  * The speech operator and the speech clip source are outside phonemeui.dll and unread. `app.phonemeSpeech` holds
//    stand-ins that carry the data block of the note (createSpeechOp / createSource / createClip); no command of this
//    row creates one.
//  * The Fonix engine is a seam (`app.phonemeSpeech.recogniser`): the audio analysis is not attested, so without an
//    installed engine the three extraction commands do the attested set-up and audio checks, log "not yet attested"
//    and fail the way a recogniser failure does. What happens to an engine answer (steps 1 to 6) is implemented.
//  * The blend evaluation is a seam on the speech object (`evaluate`); without one GetPhonemeBlendFromSpeechClip logs
//    "not yet attested" and returns no rows.
//  * A command whose only output is its return value returns that value; a null array pointer is `null`.
//  * Failure statuses are thrown as SiStatusError. Severity 2 log lines are 'error', the others 'info'.
//  * Audio files live in the session's virtual host file system (src/core/sdkHelpersHostFs.ts).
// No earlier registration of any of the 26 names existed.
import { App } from '../core/commands';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError } from './alembicSeqCam';
import {
  NOTE, E_FAIL, E_INVALIDARG, E_UNEXPECTED, DISP_E_MEMBERNOTFOUND, AudioInfo, RawPhoneme, RecogniserRequest, SpeechData, SpeechPhoneme, SpeechWord,
  makeState, makeWord, makePhoneme, stateOf, speechObjectLoose, phonemeName, logNya,
} from './phonemeSpeechTasksModel';
import { registerPhonemeSpeechEditCommands } from './phonemeSpeechTasksEdit';

export { NOTE };
const CATEGORY = 'Speech';
const SCAN_ERROR = 'Error Scanning Phonemes -- Check history log for more information';
const TICK = 0.01; // the recogniser returns integer times in units of 10 ms
const isString = (v: any) => typeof v === 'string';
const isDouble = (v: any) => typeof v === 'number' && !Number.isNaN(v);
/** A file name argument that was not given arrives as an empty string. inferred: the file name argument handler is not read. */
const fileArg = (v: any) => (v === undefined || v === null ? '' : v);
/** SIFramesToSeconds. inferred: frames divided by the scene frame rate. */
const framesToSeconds = (app: App, frames: number) => frames / (app.anim.fps || 30);

// ------------------------------------------------------------------ audio (2.6)
/** RIFF/WAVE header of a file of the virtual host file system (public format: "fmt " chunk channel count and sample
 *  rate, "data" chunk size). Null when the file cannot be opened; `sampleRate` 0 when it is not a wave file. */
function readWaveHeader(path: string): AudioInfo | null {
  if (!hostFs.isFile(path)) return null;
  const s = hostFs.readFile(path); const u = (at: number, n: number) => { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + (s.charCodeAt(at + i) & 0xff); return v; };
  if (s.slice(0, 4) !== 'RIFF' || s.slice(8, 12) !== 'WAVE') return { sampleRate: 0, channels: 0, sampleCount: 0 };
  let channels = 0, sampleRate = 0, block = 0, dataBytes = 0;
  for (let at = 12; at + 8 <= s.length;) {
    const id = s.slice(at, at + 4), size = u(at + 4, 4);
    if (id === 'fmt ') { channels = u(at + 10, 2); sampleRate = u(at + 12, 4); block = u(at + 20, 2); }
    else if (id === 'data') dataBytes = size;
    at += 8 + size + (size & 1);
  }
  return { sampleRate, channels, sampleCount: block ? Math.floor(dataBytes / block) : 0 };
}
/** Open the audio file as one mono 16-bit stream at exactly 16000 Hz, or log and fail with 0x80004005. */
function openAudio(app: App, C: string, fileName: string): AudioInfo {
  const info = (stateOf(app).openMediaFile ?? readWaveHeader)(fileName);
  const fail = (line: string) => { app.logMsg('error', line); return new SiStatusError(E_FAIL, `${C}: ${line}`); };
  if (!info) throw fail(`Error opening audio file ${fileName}`);
  if (!info.channels && !info.sampleRate) throw fail(`Obscure error in wave format for ${fileName}`);
  // inferred: one or two channels are accepted (the strings name a stereo split); which other log line belongs to which failure is not read
  if (info.channels !== 1 && info.channels !== 2) throw fail(`bad number of channels ${info.channels} for audio file ${fileName}`);
  if (info.sampleRate !== 16000) throw fail(`Problem with audio file ${fileName}, has ${info.sampleCount} samples, a sample rate of ${info.sampleRate}`);
  return info;
}

// ------------------------------------------------------------------ recognition (contract steps 1 to 5)
interface Recognised { words: SpeechWord[]; phonemes: SpeechPhoneme[] }
const SPLIT = /[:;,.\t\n\r\\/+\-{}[\]<>!@#$%^&*() ]+/;
const FALLOFF_PLUS = new Set([0x62, 0x66, 0x6d, 0x70, 0x76]);
const FALLOFF_MINUS = new Set([0x6f, 0x72, 0x75, 0x77, 0x25d, 0x283, 0x28a, 0x2a4, 0x2a7, 0x26a0254, 0x28a0061]);

function recognise(app: App, C: string, o: { fileName: string; guideText: string; offset: number; silence: number; neuralNet: string; asrDict: string }): Recognised {
  try {
    // Set-up: the shared data path, then the neural net and dictionary files; a missing file is logged and processing continues.
    const japanese = /^j/i.test(o.asrDict);
    const dataPath = `${stateOf(app).factoryPath}\\Application\\Fonix\\fre\\fd01\\${japanese ? 'japanese' : 'USEnglish'}\\asr\\`;
    // inferred: the two files are looked up by their bare names inside the shared data path
    for (const f of [o.neuralNet, o.asrDict]) if (!hostFs.isFile(dataPath + f)) app.logMsg('error', `Could not find file ${dataPath + f}`);
    const audio = openAudio(app, C, o.fileName);
    const guided = o.guideText !== '';
    const grammar = guided ? '$grammar=' + o.guideText.split(SPLIT).filter(Boolean).join(' ') : null;
    if (grammar !== null) app.logMsg('info', grammar);
    const req: RecogniserRequest = {
      guided, grammar, fileName: o.fileName, dataPath, neuralNet: o.neuralNet, asrDict: o.asrDict, sampleCount: audio.sampleCount,
      maxRecordSeconds: Math.trunc(audio.sampleCount / 16000 + 0.9), leadingSilence: 10000, trailingSilence: o.silence * 1000, rejection: false,
    };
    const engine = stateOf(app).recogniser;
    if (!engine) {
      logNya(app, C, 'the Fonix recogniser (FonixCore42.dll) and its audio analysis; no engine is installed in this build, so the recognition fails', 'section 2.6');
      throw new SiStatusError(E_FAIL, `${C}: no recogniser`);
    }
    const res = engine(req);
    const at = (tick: number) => tick * TICK + o.offset;
    const words: SpeechWord[] = [], phonemes: SpeechPhoneme[] = [];
    /** Step 3 (on ticks): an end one tick before the next start is closed up; not for the last phoneme of a word. */
    const addPhonemes = (raw: RawPhoneme[], word: number) => raw.forEach((r, i) => {
      const end = i + 1 < raw.length && raw[i + 1].start - r.end === 1 ? raw[i + 1].start : r.end;
      const p = makePhoneme(at(r.start), at(end), r.ipa, word, r.value ?? 0);
      if (FALLOFF_PLUS.has(r.ipa)) p.shapeFalloffIn = p.shapeFalloffOut = 0.5; else if (FALLOFF_MINUS.has(r.ipa)) p.shapeFalloffIn = p.shapeFalloffOut = -0.5;
      phonemes.push(p);
    });
    if (guided) {
      if (res.status === -1036) {
        app.logMsg('error', 'Error scanning phonemes -- this error is often to due to having longer text than the sound file has. Truncate input text as necessary');
        throw new SiStatusError(E_FAIL, `${C}: engine status -1036`);
      }
      // inferred: any other non-zero engine status is a recogniser failure too
      if (res.status !== 0 || !res.words?.length) throw new SiStatusError(E_FAIL, `${C}: no words recognised`);
      res.words.forEach((w, k) => { words.push(makeWord(at(w.start), at(w.end), w.name, w.value ?? 0)); addPhonemes(w.phonemes, k); });
    } else {
      if (res.status !== 0 || !res.phonemes?.length) throw new SiStatusError(E_FAIL, `${C}: no phonemes recognised`);
      addPhonemes(res.phonemes, 0);
      // As read (open question 4): the single unnamed word takes start and end from the last phoneme's entries.
      const last = res.phonemes[res.phonemes.length - 1];
      words.push(makeWord(at(last.start), at(last.end), ''));
    }
    return { words, phonemes };
  } catch (e) {
    // Any recogniser failure raises this error; the data is left unchanged.
    throw new SiStatusError(e instanceof SiStatusError ? e.status : E_FAIL, SCAN_ERROR);
  }
}

function extractToSpeechOp(app: App, C: string, a: Record<string, any>) {
  const fileName = fileArg(a.FileName);
  if (!isString(fileName) || !isString(a.GuideText) || !isString(a.NeuralNet) || !isString(a.ASRDict) || !isDouble(a.FrameOffset) || !Number.isInteger(a.SilenceDuration))
    throw new SiStatusError(E_INVALIDARG, `${C}: an argument has the wrong type`);
  const obj = speechObjectLoose(app, a.InputObj);
  if (!obj) throw new SiStatusError(DISP_E_MEMBERNOTFOUND, `${C}: InputObj has no speech data interface`);
  const offset = framesToSeconds(app, a.FrameOffset);
  const r = recognise(app, C, { fileName, guideText: a.GuideText, offset, silence: a.SilenceDuration, neuralNet: a.NeuralNet, asrDict: a.ASRDict });
  const d: SpeechData | null = obj.data;
  if (!d) throw new SiStatusError(E_FAIL, `${C}: the speech object has no data block`); // inferred: as for the query commands
  // Step 6. Not undoable, and the data-changed notification is not sent by this command.
  d.phonemes.splice(0, d.phonemes.length, ...r.phonemes); d.words.splice(0, d.words.length, ...r.words);
  d.language = /^j/i.test(a.ASRDict) ? 1 : 0; d.scale = 1; d.timeOffset = offset;
}

// ------------------------------------------------------------------ registration
const EXTRACT_ARGS = (neuralNet: string, asrDict: string) => [
  { name: 'InputObj' }, { name: 'FileName' }, { name: 'GuideText', default: '' }, { name: 'FrameOffset', default: 0 }, { name: 'SilenceDuration', default: 10 },
  { name: 'NeuralNet', default: neuralNet }, { name: 'ASRDict', default: asrDict },
];

export function registerPhonemeSpeechTaskCommands(app: App) {
  (app as any).phonemeSpeech = makeState();

  app.register({
    name: 'ExtractPhonemesToSpeechOp', label: 'ExtractPhonemesToSpeechOp', category: CATEGORY, undoable: false, args: EXTRACT_ARGS('usgp16FN3108', 'USEnglish.pdc'),
    execute(app, a) { extractToSpeechOp(app, 'ExtractPhonemesToSpeechOp', a); },
  });
  app.register({
    name: 'ExtractPhonemesToSpeechOpJapanese', label: 'ExtractPhonemesToSpeechOpJapanese', category: CATEGORY, undoable: false, args: EXTRACT_ARGS('jagp16FN5031', 'Japanese.pdc'),
    execute(app, a) { extractToSpeechOp(app, 'ExtractPhonemesToSpeechOpJapanese', a); },
  });

  app.register({
    name: 'SIExtractPhonemes', label: 'SIExtractPhonemes', category: CATEGORY, undoable: false,
    args: [{ name: 'Language', default: '' }, { name: 'FileName' }, { name: 'GuideText', default: '' }],
    execute(app, a) {
      const C = 'SIExtractPhonemes'; const fileName = fileArg(a.FileName);
      if (!isString(a.Language) || !isString(fileName) || !isString(a.GuideText)) throw new SiStatusError(E_INVALIDARG, `${C}: an argument has the wrong type`);
      const jp = a.Language.toLowerCase() === 'jp';
      const r = recognise(app, C, { fileName, guideText: a.GuideText, offset: 0, silence: 10, neuralNet: jp ? 'jagp16FN5031' : 'usgp16FN3108', asrDict: jp ? 'Japanese.pdc' : 'USEnglish.pdc' });
      // [phoneme count][4]: IPA value, start seconds, end seconds, name (language table). Zero phonemes: null.
      return r.phonemes.length ? r.phonemes.map(p => [p.ipa, p.start, p.end, phonemeName(p.ipa, jp ? 1 : 0)]) : null;
    },
  });

  app.register({
    name: 'GetPhonemesFromSpeechClip', label: 'GetPhonemesFromSpeechClip', category: CATEGORY, undoable: false, args: [{ name: 'InputObj' }],
    execute(app, a) {
      const C = 'GetPhonemesFromSpeechClip'; const d = speechObjectLoose(app, a.InputObj)?.data;
      if (!d) throw new SiStatusError(E_FAIL, `${C}: no speech data block`);
      return d.phonemes.length ? d.phonemes.map(p => [p.ipa, p.start, p.end, phonemeName(p.ipa, d.language), p.weight, p.falloffIn, p.falloffOut, p.shapeWeight, p.shapeFalloffIn, p.shapeFalloffOut, p.blendIn, p.blendOut, p.variation]) : null;
    },
  });

  app.register({
    name: 'GetPhonemeBlendFromSpeechClip', label: 'GetPhonemeBlendFromSpeechClip', category: CATEGORY, undoable: false,
    args: [{ name: 'InputObj' }, { name: 'Channel', default: 0 }, { name: 'Time' }],
    execute(app, a) {
      const C = 'GetPhonemeBlendFromSpeechClip'; const obj = speechObjectLoose(app, a.InputObj);
      if (!obj?.data) throw new SiStatusError(E_FAIL, `${C}: no speech data block`); // inferred: as GetPhonemesFromSpeechClip (shared Do)
      const channel = Number.isInteger(a.Channel) && a.Channel === (a.Channel | 0) ? a.Channel : 0; // used only when it arrives as a 32-bit integer
      let seconds: number;
      if (isDouble(a.Time)) seconds = framesToSeconds(app, a.Time);
      else {
        logNya(app, C, 'the time used when Time does not arrive as a double; the current time is taken', 'GetPhonemeBlendFromSpeechClip: Missing');
        seconds = framesToSeconds(app, app.anim.frame); // inferred
      }
      if (!obj.evaluate) {
        logNya(app, C, 'the blend evaluation of the speech operator (active phonemes, how weight, falloff and blend combine, the channel, the fourth column); no rows are returned', 'open question 2');
        return null;
      }
      const entries = obj.evaluate(seconds, channel);
      // [entry count][4]: IPA value, name (English-first lookup, language flag 0), weight, the entry's string.
      return entries.length ? entries.map(e => [e.ipa, phonemeName(e.ipa, 0), e.weight, e.text]) : null; // inferred: null for zero entries, as the other tables
    },
  });

  app.register({
    name: 'PlaybackTimeRange', label: 'Playback Time Range', category: CATEGORY, undoable: false, args: [{ name: 'StartFrame', default: 0 }, { name: 'EndFrame', default: 0 }],
    execute(app, a) {
      const C = 'PlaybackTimeRange';
      if (!isDouble(a.StartFrame) || !isDouble(a.EndFrame)) throw new SiStatusError(E_INVALIDARG, `${C}: StartFrame and EndFrame must be numbers`);
      const anim = app.anim; const S = stateOf(app);
      if (!anim) throw new SiStatusError(E_UNEXPECTED, `${C}: no playback controller`);
      if (S.playback) { logNya(app, C, 'a call while an earlier range is still playing (the original blocks until playback ends); ignored'); return; }
      // inferred: the integer setting forced to 0 is the loop mode, and the two spans are the play range and the loop
      // range. This build has one play range, so both spans map onto it.
      logNya(app, C, 'which spans and which integer setting of the playback controller are saved and forced; taken as the play range and the loop mode', 'open question 5');
      const saved = { frame: anim.frame, loopMode: anim.loopMode, start: anim.startFrame, end: anim.endFrame };
      if (anim.playing) anim.stop(); // inferred
      anim.loopMode = 'once';
      // The span runs from StartFrame to EndFrame + 1. inferred: half-open, so EndFrame is the last frame played.
      anim.startFrame = a.StartFrame; anim.endFrame = a.EndFrame;
      anim.frame = a.StartFrame; // inferred: playback starts at the start of the span
      const restoreAll = () => { anim.startFrame = saved.start; anim.endFrame = saved.end; anim.loopMode = saved.loopMode; anim.frame = saved.frame; S.playback = null; };
      anim.play();
      // The original runs a nested message loop until its playback listener is told playback stopped. A browser command
      // cannot block, so the wait is a poll and the restore happens when playback has stopped.
      const done = new Promise<void>(resolve => {
        const poll = () => { if (anim.playing) { setTimeout(poll, 15); return; } restoreAll(); resolve(); };
        setTimeout(poll, 15);
      });
      S.playback = { start: a.StartFrame, end: a.EndFrame, done };
    },
  });

  registerPhonemeSpeechEditCommands(app);
}
