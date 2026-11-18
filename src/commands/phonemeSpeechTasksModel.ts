// Ledger row CMD-B9d. Brief: docs/ghidra/cmd-b9d-phonemeui-speech-binary.md, "Shared facts" (2.1 to 2.4).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// The speech data model the phonemeui.dll commands edit, as a stand-in: the real data block belongs to the speech
// operator / speech clip source, which is outside the DLL and unread. This file carries exactly what the contract
// states: the data block (words, phonemes, language flag, scale, time offset), the three ways an `InputObj` reaches
// it (speech object, source, clip), the phoneme name tables and the `Index` argument conversion.
import { App } from '../core/commands';
import { SiStatusError } from './alembicSeqCam';

export const NOTE = 'docs/ghidra/cmd-b9d-phonemeui-speech-binary.md';
export const E_NOTIMPL = 0x80004001, E_NOINTERFACE = 0x80004002, E_FAIL = 0x80004005, E_UNEXPECTED = 0x8000ffff;
export const E_INVALIDARG = 0x80070057, DISP_E_MEMBERNOTFOUND = 0x80020003, DISP_E_TYPEMISMATCH = 0x80020005;
/** Minimum phoneme length in seconds: the constant behind every clamp. */
export const MIN_PHONEME = 0.02;
/** Lower time bound of the first word / phoneme: the smallest positive normal double, effectively time 0. */
export const TIME_FLOOR = 2.2250738585072014e-308;

// ------------------------------------------------------------------ records
export interface SpeechWord {
  start: number; end: number; name: string;
  /** Recogniser per-word int (meaning not read); 0 for inserted words. */
  value: number;
  /** Used only by SpeechOpMoveWords. */
  selected: boolean;
}
export interface SpeechPhoneme {
  start: number; end: number;
  /** Recogniser per-phoneme int (meaning not read). */
  value: number;
  ipa: number;
  /** Index of the owning word. */
  word: number;
  weight: number; falloffIn: number; falloffOut: number;
  shapeWeight: number; shapeFalloffIn: number; shapeFalloffOut: number;
  blendIn: number; blendOut: number;
  variation: string;
  selected: boolean;
  /** Byte flag (meaning not read). */
  flag: number;
}
export interface SpeechData {
  words: SpeechWord[]; phonemes: SpeechPhoneme[];
  /** 0 = US English phoneme names, 1 = Japanese. */
  language: number;
  /** Set to 1.0 by the extraction task (use not read). */
  scale: number;
  /** Seconds added to every recognised time (from FrameOffset). */
  timeOffset: number;
}
export function makeWord(start: number, end: number, name: string, value = 0): SpeechWord { return { start, end, name, value, selected: false }; }
/** A phoneme record with the creation defaults of the contract table. */
export function makePhoneme(start: number, end: number, ipa: number, word: number, value = 0): SpeechPhoneme {
  return { start, end, value, ipa, word, weight: 1, falloffIn: 0, falloffOut: 0, shapeWeight: 1, shapeFalloffIn: 0, shapeFalloffOut: 0, blendIn: 1, blendOut: 1, variation: '', selected: false, flag: 0 };
}
export function makeData(): SpeechData { return { words: [], phonemes: [], language: 0, scale: 1, timeOffset: 0 }; }
/** The full snapshot of the editing classes: all word records, all phoneme records, the language flag. */
export function snapshot(d: SpeechData): SpeechData { return { words: d.words.map(w => ({ ...w })), phonemes: d.phonemes.map(p => ({ ...p })), language: d.language, scale: d.scale, timeOffset: d.timeOffset }; }
/** Copy a snapshot back over the live data (both arrays resized, language flag restored). */
export function restore(d: SpeechData, snap: SpeechData) {
  d.words.splice(0, d.words.length, ...snap.words.map(w => ({ ...w })));
  d.phonemes.splice(0, d.phonemes.length, ...snap.phonemes.map(p => ({ ...p })));
  d.language = snap.language;
}
/** First and last array index of the phonemes of word `k` (contiguous by invariant), or null when it has none. */
export function phonemeSpan(d: SpeechData, k: number): [number, number] | null {
  let first = -1, last = -1;
  for (let i = 0; i < d.phonemes.length; i++) if (d.phonemes[i].word === k) { if (first < 0) first = i; last = i; }
  return first < 0 ? null : [first, last];
}

// ------------------------------------------------------------------ speech object, source, clip (stand-ins)
/** One entry of the blend evaluation: {IPA value, weight, string}. */
export interface BlendEntry { ipa: number; weight: number; text: string }
/** The object that carries the speech data (the speech operator; speech data interface {bffe85f4-...}). */
export class SpeechObject {
  /** The data block; null stands for "no data block". */
  data: SpeechData | null = makeData();
  /** Count of "data changed" notifications (sent after every edit and after undo). */
  changes = 0;
  private listeners = new Set<() => void>();
  /** Evaluation interface {915d0a04-...}: (time in seconds, channel) -> entries. Seam: the evaluation is outside
   *  phonemeui.dll and unread, so nothing in this build installs one. */
  evaluate: ((seconds: number, channel: number) => BlendEntry[]) | null = null;
  constructor(public name: string) {}
  get fullName() { return this.name; }
  notifyChanged() { this.changes++; for (const l of this.listeners) l(); }
  onChanged(l: () => void) { this.listeners.add(l); return () => this.listeners.delete(l); }
}
/** A speech clip source: its item 0 is asked for the speech data interface. */
export class SpeechSource {
  constructor(public name: string, public items: any[] = []) {}
  get fullName() { return this.name; }
}
/** A speech clip in the mixer: gives its source. */
export class SpeechClip {
  constructor(public name: string, public source: SpeechSource | null) {}
  get fullName() { return this.name; }
}

// ------------------------------------------------------------------ recogniser and audio seams
export interface RawPhoneme { ipa: number; /** recogniser ticks of 10 ms */ start: number; end: number; value?: number }
export interface RawWord { name: string; start: number; end: number; value?: number; phonemes: RawPhoneme[] }
export interface RecogniserRequest {
  guided: boolean;
  /** `$grammar=` followed by the guide text tokens joined with single spaces; null when unguided. */
  grammar: string | null;
  fileName: string; dataPath: string; neuralNet: string; asrDict: string;
  sampleCount: number;
  /** Guided node settings. */
  maxRecordSeconds: number; leadingSilence: number; trailingSilence: number; rejection: boolean;
}
/** Engine answer: guided runs give words with their phonemes, unguided runs a flat phoneme list. */
export interface RecogniserResult { status: number; words?: RawWord[]; phonemes?: RawPhoneme[] }
export interface AudioInfo { sampleRate: number; channels: number; sampleCount: number }

export interface PhonemeSpeechState {
  /** Stand-in registry so that `InputObj` can be given by name. */
  objects: (SpeechObject | SpeechSource | SpeechClip)[];
  /** Install root used for `<factory path>\Application\Fonix\fre\fd01\...`. */
  factoryPath: string;
  /** The Fonix engine. Seam: the audio analysis is not attested, nothing in this build installs one. */
  recogniser: ((req: RecogniserRequest) => RecogniserResult) | null;
  /** Media file opener override (default: a RIFF/WAVE header read from the session's virtual host file system). */
  openMediaFile: ((path: string) => AudioInfo | null) | null;
  /** The running PlaybackTimeRange, if any; `done` resolves when the range has played and the settings are restored. */
  playback: { start: number; end: number; done: Promise<void> } | null;
  createSpeechOp(name: string, words?: { name?: string; start: number; end: number; phonemes?: { ipa: number; start: number; end: number }[] }[], language?: number): SpeechObject;
  createSource(name: string, items?: any[]): SpeechSource;
  createClip(name: string, source: SpeechSource | null): SpeechClip;
  find(name: string): SpeechObject | SpeechSource | SpeechClip | null;
}
export const stateOf = (app: App): PhonemeSpeechState => (app as any).phonemeSpeech;

export function makeState(): PhonemeSpeechState {
  const s: PhonemeSpeechState = {
    objects: [], factoryPath: 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2', recogniser: null, openMediaFile: null, playback: null,
    createSpeechOp(name, words = [], language = 0) {
      const o = new SpeechObject(name); const d = o.data!; d.language = language;
      words.forEach((w, k) => { d.words.push(makeWord(w.start, w.end, w.name ?? '')); for (const p of w.phonemes ?? []) d.phonemes.push(makePhoneme(p.start, p.end, p.ipa, k)); });
      s.objects.push(o); return o;
    },
    createSource(name, items = []) { const o = new SpeechSource(name, items); s.objects.push(o); return o; },
    createClip(name, source) { const o = new SpeechClip(name, source); s.objects.push(o); return o; },
    find(name) { return s.objects.find(o => o.name === name) ?? null; },
  };
  return s;
}

// ------------------------------------------------------------------ InputObj resolution (2.1)
const byName = (app: App, v: any) => (typeof v === 'string' && v.trim() ? stateOf(app).find(v.trim()) ?? v : v);
/** Editing commands: the object itself is asked for the speech data interface. */
export function speechObjectStrict(app: App, C: string, v: any): SpeechObject {
  const o = byName(app, v);
  // inferred: the status of an argument that does not resolve to an object (the note says only "the resolver's HRESULT")
  if (o === undefined || o === null || o === '' || typeof o !== 'object') throw new SiStatusError(E_INVALIDARG, `${C}: InputObj does not resolve to an object`);
  // inferred: E_NOINTERFACE is what a COM object answers for an interface it lacks; the note says only "returned as the command's error"
  if (!(o instanceof SpeechObject)) throw new SiStatusError(E_NOINTERFACE, `${C}: InputObj has no speech data interface`);
  return o;
}
/** Extract-to-SpeechOp and the two Get commands: a clip (-> its source) or a source; item 0 of a non-empty source is
 *  asked for the speech data interface. Null when the chain gives none. */
export function speechObjectLoose(app: App, v: any): SpeechObject | null {
  const o = byName(app, v);
  const source = o instanceof SpeechClip ? o.source : o instanceof SpeechSource ? o : null;
  if (source) { const item = source.items.length ? source.items[0] : null; return item instanceof SpeechObject ? item : null; }
  // inferred: the note's argument lists say "clip, source or speech object" while its interface walk covers only clip and
  // source; the speech object is taken directly here (as if it answered the source walk itself).
  return o instanceof SpeechObject ? o : null;
}

// ------------------------------------------------------------------ IPA value -> phoneme name (2.3)
const ENGLISH: [number, string, string][] = [
  [0xe6, 'a', 'pat'], [0x251, 'ah', 'ah'], [0x65, 'ay', 'say'], [0x62, 'b', 'boy'], [0x6b, 'c', 'call'], [0x2a7, 'ch', 'child'],
  [0x64, 'd', 'dig'], [0x25b, 'e', 'egg'], [0x69, 'ee', 'see'], [0x25d, 'er', 'her'], [0x66, 'f', 'flower'], [0x261, 'g', 'give'],
  [0x68, 'h', 'house'], [0x26a, 'i', 'it'], [0x26a0061, 'I', 'I am'], [0x2a4, 'j', 'join'], [0x6c, 'l', 'let'],
  [0x6d, 'm', 'main'], [0x6e, 'n', 'name'], [0x14b, 'ng', 'sing'], [0x6f, 'oh', 'oh'], [0x28a, 'oo', 'book'], [0x75, 'ou', 'you'],
  [0x28a0061, 'ow', 'how'], [0x26a0254, 'oy', 'boy'], [0x70, 'p', 'pen'], [0x72, 'r', 'rise'], [0x73, 's', 'small'],
  [0x283, 'sh', 'shall'], [0x74, 't', 'team'], [0xf0, 'th', 'the'], [0x3b8, 'tH', 'think'], [0x27e, 'tt', 'butter'],
  [0x28c, 'u', 'but'], [0x76, 'v', 'very'], [0x77, 'w', 'win'], [0x6a, 'y', 'yes'], [0x7a, 'z', 'zoo'],
];
const JAPANESE: [number, string, string][] = [
  [0x251, 'a', 'aka'], [0x62, 'b', 'bin'], [0x2a7, 'ch', 'chich'], [0x64, 'd', 'daidaiiro'], [0x7a, 'ts', 'tsuzuki'],
  [0x2a4, 'j', 'jikan'], [0x25b, 'e', 'eki'], [0x278, 'f', 'fuji'], [0x261, 'g', 'gakko'], [0x68, 'h', 'haha'],
  [0x69, 'i', 'ika'], [0x6b, 'k', 'kami'], [0x6d, 'm', 'mae'], [0x6e, 'n', 'natsu'], [0x6f, 'o', 'oto'], [0x70, 'p', 'pan'],
  [0x27e, 'r', 'raka'], [0x73, 's', 'saka'], [0x283, 'sh', 'shiai'], [0x74, 't', 'tabi'], [0x75, 'u', 'ushi'],
  [0x77, 'w', 'wata'], [0x6a, 'y', 'yuka'],
];
export const PHONEME_TABLES = { english: ENGLISH, japanese: JAPANESE };
/** Value 0 is silence (`~`); the table of the language is searched, the Japanese one falls back to the English one;
 *  an unknown value is formatted as 0x%x. */
export function phonemeName(ipa: number, language: number): string {
  if (ipa === 0) return '~';
  const hit = (language === 1 ? JAPANESE.find(r => r[0] === ipa) : undefined) ?? ENGLISH.find(r => r[0] === ipa);
  return hit ? hit[1] : '0x' + (ipa >>> 0).toString(16);
}

// ------------------------------------------------------------------ argument conversions
/** Conversion to a 32-bit integer. inferred: the note says only "converted to integer" and "conversion failure returns
 *  the conversion HRESULT"; this follows the documented OLE variant coercion (empty -> 0, round half to even,
 *  VARIANT_TRUE -> -1, DISP_E_TYPEMISMATCH for what cannot be read as a number). */
export function toInt(C: string, v: any, what = 'value'): number { const n = toDouble(C, v, what); const f = Math.floor(n); const r = n - f; return (r > 0.5 || (r === 0.5 && f % 2 !== 0) ? f + 1 : f) | 0; }
export function toDouble(C: string, v: any, what = 'value'): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? -1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  throw new SiStatusError(DISP_E_TYPEMISMATCH, `${C}: ${what} cannot be converted to a number`);
}
export function toBool(v: any): boolean { return typeof v === 'string' ? !/^(false|0|)$/i.test(v.trim()) : !!v; }
export function toText(v: any): string { return v === undefined || v === null ? '' : typeof v === 'string' ? v : typeof v === 'object' && 'name' in v ? String(v.name) : String(v); }
/** The `Index` argument (2.4): a non-array value becomes a one-element list; an array is converted element by
 *  element, sorted and has adjacent duplicates removed in a single pass. */
export function indexList(C: string, v: any): number[] {
  if (!Array.isArray(v)) return [toInt(C, v, 'Index')];
  const list = v.map(x => toInt(C, x, 'Index')).sort((a, b) => a - b); // inferred: ascending (open question 7)
  // inferred: the shape of the single pass. The note states only its effect (a value repeated three or more times can
  // leave one duplicate behind): here the element after a kept one is dropped when equal, and the scan steps past it.
  for (let i = 0; i + 1 < list.length; i++) if (list[i + 1] === list[i]) list.splice(i + 1, 1);
  return list;
}
export function logNya(app: App, command: string, what: string, question = '') { app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`); }
