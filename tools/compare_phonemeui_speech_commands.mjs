// CMD-B9d: the 26 speech / lip-sync commands of phonemeui.dll on the command bus (src/commands/phonemeSpeechTasks.ts,
// phonemeSpeechTasksEdit.ts, phonemeSpeechTasksModel.ts). Checked against the "Shared facts" and "Contracts" sections
// of docs/ghidra/cmd-b9d-phonemeui-speech-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check: registration with the registry argument list,
// a run with default arguments, and the stated results on a stand-in speech object (app.phonemeSpeech). The Fonix
// engine, the media file opener and the blend evaluation are seams: the check installs test doubles to exercise the
// attested handling of their answers, and checks the "not yet attested" log line when none is installed.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_phonemeui_speech_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const EXTRACT = ['ExtractPhonemesToSpeechOp', 'ExtractPhonemesToSpeechOpJapanese', 'SIExtractPhonemes'];
const QUERY = ['GetPhonemesFromSpeechClip', 'GetPhonemeBlendFromSpeechClip'];
const EDIT = ['SpeechOpDeleteWords', 'SpeechOpDeletePhonemes', 'SpeechOpInsertWord', 'SpeechOpMoveWords', 'SpeechOpMovePhoneme', 'SpeechOpScaleWordStart', 'SpeechOpScaleWordEnd',
  'SpeechOpScalePhonStart', 'SpeechOpScalePhonEnd', 'SpeechOpSplitPhonemes', 'SpeechOpSetPhonemesIPAValue', 'SpeechOpSetPhonemesWeight', 'SpeechOpSetPhonemesFalloffIn', 'SpeechOpSetPhonemesFalloffOut',
  'SpeechOpSetPhonemesShapeWeight', 'SpeechOpSetPhonemesShapeFalloffIn', 'SpeechOpSetPhonemesShapeFalloffOut', 'SpeechOpSetPhonemesBlendIn', 'SpeechOpSetPhonemesBlendOut', 'SpeechOpSetPhonemesVariation'];
const NAMES = [...EXTRACT, ...QUERY, 'PlaybackTimeRange', ...EDIT];
// Registry argument list of a name, without the return value (flag 0x200): [name, default].
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SpeechOpSetPhonemesVariation') && !!window.Application?.phonemeSpeech && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, EDIT }) => {
  const A = window.Application; const S = A.phonemeSpeech; const fsx = A.hostFs; A.autoInspect = false;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const mark = () => A.log.length;
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`);
  const run = (n, a = {}) => {
    const m = mark();
    try { const v = A.run(n, a); return { v, log: logFrom(m) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status), log: logFrom(m) }; }
  };
  const st = (r) => r.err ? r.status : 'ok';
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const r6 = (x) => typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x;
  let serial = 0;
  // hello (h e oh) | my (m I) | boy (b oy) | zoo (z ou)
  const fresh = () => S.createSpeechOp('speech' + (++serial), [
    { name: 'hello', start: 0.1, end: 0.5, phonemes: [{ ipa: 0x68, start: 0.1, end: 0.2 }, { ipa: 0x25b, start: 0.2, end: 0.35 }, { ipa: 0x6f, start: 0.35, end: 0.5 }] },
    { name: 'my', start: 0.6, end: 0.8, phonemes: [{ ipa: 0x6d, start: 0.6, end: 0.7 }, { ipa: 0x26a0061, start: 0.7, end: 0.8 }] },
    { name: 'boy', start: 1.0, end: 1.4, phonemes: [{ ipa: 0x62, start: 1.0, end: 1.1 }, { ipa: 0x26a0254, start: 1.1, end: 1.4 }] },
    { name: 'zoo', start: 1.5, end: 1.9, phonemes: [{ ipa: 0x7a, start: 1.5, end: 1.7 }, { ipa: 0x75, start: 1.7, end: 1.9 }] },
  ]);
  const W = (o) => o.data.words.map(w => [w.name, r6(w.start), r6(w.end)]);
  const P = (o) => o.data.phonemes.map(p => [p.ipa, r6(p.start), r6(p.end), p.word]);
  const T = (o) => o.data.phonemes.map(p => [r6(p.start), r6(p.end)]);
  const sel = (o, ...ks) => { for (const k of ks) o.data.words[k].selected = true; return o; };
  /** One command on a fresh sample: [status, words, phonemes]. */
  const on = (n, a, prep) => { const o = fresh(); prep?.(o); const r = run(n, { InputObj: o, ...a }); return [st(r), W(o), P(o)]; };

  // ---- registration
  out.registered = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  // ---- default arguments
  out.defaults = {};
  {
    const before = { frame: A.anim.frame, loop: A.anim.loopMode, s: A.anim.startFrame, e: A.anim.endFrame };
    for (const n of NAMES) { const r = run(n); out.defaults[n] = { status: st(r), v: r.v === undefined ? '<unset>' : r.v, scan: /Error Scanning Phonemes -- Check history log for more information/.test(r.err ?? ''), open: has(r, /^error:Error opening audio file /), nya: nya(r) }; }
    const pb = S.playback; out.playbackDefault = { started: !!pb, range: pb ? [pb.start, pb.end] : null, during: [A.anim.loopMode, A.anim.startFrame, A.anim.endFrame] };
    await pb?.done;
    out.playbackDefault.after = [A.anim.frame === before.frame, A.anim.loopMode === before.loop, A.anim.startFrame === before.s, A.anim.endFrame === before.e, S.playback === null, A.anim.playing];
  }

  // ---- PlaybackTimeRange
  {
    const r = {}; const before = [A.anim.frame, A.anim.loopMode, A.anim.startFrame, A.anim.endFrame];
    r.badType = st(run('PlaybackTimeRange', { StartFrame: '3', EndFrame: 5 }));
    const seen = new Set(); const off = A.anim.onFrame(f => seen.add(f));
    const u0 = A.undoStack.length; const a = run('PlaybackTimeRange', { StartFrame: 3, EndFrame: 6 });
    r.started = [st(a), a.v === undefined, A.anim.playing, A.anim.loopMode, A.anim.startFrame, A.anim.endFrame, nya(a)];
    const again = run('PlaybackTimeRange', { StartFrame: 1, EndFrame: 2 }); r.reentry = [st(again), nya(again), S.playback?.start];
    await S.playback?.done; off();
    r.played = [seen.has(3), seen.has(6), [...seen].filter(f => f !== before[0]).every(f => f >= 3 && f <= 6)];
    r.restored = [A.anim.frame === before[0], A.anim.loopMode === before[1], A.anim.startFrame === before[2], A.anim.endFrame === before[3], A.anim.playing, A.undoStack.length - u0];
    out.playback = r;
  }

  // ---- GetPhonemesFromSpeechClip
  {
    const r = {}; const o = fresh(); const src = S.createSource('speechSrc', [o]); const clip = S.createClip('speechClip', src);
    A.run('SpeechOpSetPhonemesVariation', { InputObj: o, Index: [1], Variation: 'B' });
    const rows = run('GetPhonemesFromSpeechClip', { InputObj: clip });
    r.shape = [st(rows), rows.v?.length, rows.v?.every(x => x.length === 13)];
    r.row0 = rows.v?.[0]; r.row1 = rows.v?.[1].map(r6); r.names = rows.v?.map(x => x[3]);
    r.same = [JSON.stringify(run('GetPhonemesFromSpeechClip', { InputObj: src }).v) === JSON.stringify(rows.v), JSON.stringify(run('GetPhonemesFromSpeechClip', { InputObj: 'speechClip' }).v) === JSON.stringify(rows.v), JSON.stringify(run('GetPhonemesFromSpeechClip', { InputObj: o }).v) === JSON.stringify(rows.v)];
    const j = S.createSpeechOp('jp', [{ name: 'a', start: 0, end: 1, phonemes: [0x7a, 0x27e, 0xe6, 0x999, 0, 0x6b].map((ipa, i) => ({ ipa, start: i / 10, end: (i + 1) / 10 })) }], 1);
    r.japanese = run('GetPhonemesFromSpeechClip', { InputObj: j }).v?.map(x => x[3]); j.data.language = 0; r.english = run('GetPhonemesFromSpeechClip', { InputObj: j }).v?.map(x => x[3]);
    r.empty = run('GetPhonemesFromSpeechClip', { InputObj: S.createSpeechOp('emptySpeech') }).v;
    r.noItem = st(run('GetPhonemesFromSpeechClip', { InputObj: S.createSource('emptySrc') }));
    r.noSource = st(run('GetPhonemesFromSpeechClip', { InputObj: S.createClip('emptyClip', null) }));
    const nd = S.createSpeechOp('noData'); nd.data = null; r.noData = st(run('GetPhonemesFromSpeechClip', { InputObj: nd }));
    out.get = r;
  }

  // ---- GetPhonemeBlendFromSpeechClip
  {
    const r = {}; const o = fresh(); const clip = S.createClip('blendClip', S.createSource('blendSrc', [o])); const fps = A.anim.fps;
    const a = run('GetPhonemeBlendFromSpeechClip', { InputObj: clip, Time: 15 }); r.noEvaluator = [st(a), a.v, nya(a)];
    const calls = []; o.evaluate = (t, c) => { calls.push([r6(t * fps), c]); return [{ ipa: 0x7a, weight: 0.25, text: 'x' }, { ipa: 0, weight: 0.75, text: '' }, { ipa: 0x999, weight: 1, text: 'y' }]; };
    o.data.language = 1;
    const b = run('GetPhonemeBlendFromSpeechClip', { InputObj: clip, Channel: 2, Time: 15 }); r.rows = [st(b), b.v, nya(b)];
    run('GetPhonemeBlendFromSpeechClip', { InputObj: o, Channel: 1.5, Time: 30 }); run('GetPhonemeBlendFromSpeechClip', { InputObj: o, Channel: '3', Time: 30 });
    const c = run('GetPhonemeBlendFromSpeechClip', { InputObj: o }); r.noTime = [st(c), nya(c), calls[calls.length - 1][0] === r6(A.anim.frame)];
    r.calls = calls.slice(0, 3);
    o.evaluate = () => []; r.noEntries = run('GetPhonemeBlendFromSpeechClip', { InputObj: o, Time: 1 }).v;
    out.blend = r;
  }

  // ---- extraction
  {
    const r = {}; const fps = A.anim.fps; const sec = (ticks, frames = 0) => r6(ticks * 0.01 + frames / fps);
    const o = fresh(); const clip = S.createClip('xClip', S.createSource('xSrc', [o])); const before = JSON.stringify([W(o), P(o)]);
    // no audio file
    const a = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\none.wav' });
    r.noFile = [a.status, /Error Scanning Phonemes -- Check history log/.test(a.err ?? ''), has(a, /^error:Error opening audio file C:\\audio\\none\.wav$/), a.log.filter(l => /^error:Could not find file .*\\Application\\Fonix\\fre\\fd01\\USEnglish\\asr\\(usgp16FN3108|USEnglish\.pdc)$/.test(l)).length, JSON.stringify([W(o), P(o)]) === before];
    // a wave header read from the virtual host file system
    const le = (v, n) => String.fromCharCode(...Array.from({ length: n }, (_, i) => (v >>> (8 * i)) & 0xff));
    const wav = (rate, ch, samples) => 'RIFF' + le(36 + samples * ch * 2, 4) + 'WAVE' + 'fmt ' + le(16, 4) + le(1, 2) + le(ch, 2) + le(rate, 4) + le(rate * ch * 2, 4) + le(ch * 2, 2) + le(16, 2) + 'data' + le(samples * ch * 2, 4);
    fsx.ensureFolder('C:\\audio'); fsx.writeFile('C:\\audio\\ok.wav', wav(16000, 1, 32000)); fsx.writeFile('C:\\audio\\slow.wav', wav(8000, 1, 500)); fsx.writeFile('C:\\audio\\six.wav', wav(16000, 6, 100)); fsx.writeFile('C:\\audio\\text.wav', 'not a wave');
    const noEngine = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\ok.wav' }); r.noEngine = [noEngine.status, nya(noEngine), JSON.stringify([W(o), P(o)]) === before];
    const reqs = []; let answer = null; S.recogniser = (q) => { reqs.push(q); return answer; };
    const slow = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\slow.wav' }); r.rate = [slow.status, has(slow, /^error:Problem with audio file C:\\audio\\slow\.wav, has 500 samples, a sample rate of 8000$/), reqs.length];
    const six = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\six.wav' }); r.channels = [six.status, has(six, /^error:bad number of channels 6 for audio file C:\\audio\\six\.wav$/)];
    const txt = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\text.wav' }); r.format = [txt.status, has(txt, /^error:Obscure error in wave format for C:\\audio\\text\.wav$/)];
    // guided
    answer = { status: 0, words: [
      { name: 'hi', start: 10, end: 40, value: 7, phonemes: [{ ipa: 0x68, start: 10, end: 19 }, { ipa: 0x26a0061, start: 20, end: 38, value: 3 }] },
      { name: 'bob', start: 50, end: 90, phonemes: [{ ipa: 0x62, start: 50, end: 58 }, { ipa: 0x6f, start: 60, end: 79 }, { ipa: 0x62, start: 80, end: 89 }] },
    ] };
    o.data.language = 1; const ch0 = o.changes, u0 = A.undoStack.length;
    const g = run('ExtractPhonemesToSpeechOp', { InputObj: clip, FileName: 'C:\\audio\\ok.wav', GuideText: 'hi, bob-and!  (more)\tx', FrameOffset: 30, SilenceDuration: 4 });
    const q = reqs[reqs.length - 1];
    r.guided = [st(g), g.v === undefined, has(g, /^info:\$grammar=hi bob and more x$/)];
    r.request = [q.guided, q.grammar, q.fileName, q.neuralNet, q.asrDict, /\\Application\\Fonix\\fre\\fd01\\USEnglish\\asr\\$/.test(q.dataPath), q.sampleCount, q.maxRecordSeconds, q.leadingSilence, q.trailingSilence, q.rejection];
    r.words = [W(o), o.data.words.map(w => w.value), JSON.stringify(W(o)) === JSON.stringify([['hi', sec(10, 30), sec(40, 30)], ['bob', sec(50, 30), sec(90, 30)]])];
    r.phonemeTimes = JSON.stringify(P(o)) === JSON.stringify([[0x68, sec(10, 30), sec(20, 30), 0], [0x26a0061, sec(20, 30), sec(38, 30), 0], [0x62, sec(50, 30), sec(58, 30), 1], [0x6f, sec(60, 30), sec(80, 30), 1], [0x62, sec(80, 30), sec(89, 30), 1]]);
    r.phonemeFields = o.data.phonemes.map(p => [p.value, p.weight, p.falloffIn, p.falloffOut, p.shapeWeight, p.shapeFalloffIn, p.shapeFalloffOut, p.blendIn, p.blendOut, p.variation, p.selected, p.flag]);
    r.block = [o.data.language, o.data.scale, r6(o.data.timeOffset * fps), o.changes - ch0, A.undoStack.length - u0];
    // unguided, Japanese defaults
    answer = { status: 0, phonemes: [{ ipa: 0x251, start: 5, end: 14 }, { ipa: 0x283, start: 15, end: 30 }, { ipa: 0x69, start: 40, end: 55 }] };
    const j = run('ExtractPhonemesToSpeechOpJapanese', { InputObj: o, FileName: 'C:\\audio\\ok.wav' }); const qj = reqs[reqs.length - 1];
    r.unguided = [st(j), qj.guided, qj.grammar, qj.neuralNet, qj.asrDict, /\\japanese\\asr\\$/.test(qj.dataPath), qj.trailingSilence, W(o), P(o), o.data.phonemes.map(p => p.shapeFalloffIn), o.data.language, o.data.timeOffset];
    // failures leave the data unchanged
    const kept = JSON.stringify([W(o), P(o)]);
    answer = { status: -1036, words: [] }; const f1 = run('ExtractPhonemesToSpeechOp', { InputObj: o, FileName: 'C:\\audio\\ok.wav', GuideText: 'too long' });
    r.status1036 = [f1.status, has(f1, /^error:Error scanning phonemes -- this error is often to due to having longer text than the sound file has\. Truncate input text as necessary$/), /Error Scanning Phonemes -- Check history log for more information/.test(f1.err), JSON.stringify([W(o), P(o)]) === kept];
    answer = { status: 0, words: [] }; r.zeroWords = [run('ExtractPhonemesToSpeechOp', { InputObj: o, FileName: 'C:\\audio\\ok.wav', GuideText: 'x' }).status, JSON.stringify([W(o), P(o)]) === kept];
    answer = { status: 0, phonemes: [] }; r.zeroPhonemes = [run('ExtractPhonemesToSpeechOp', { InputObj: o, FileName: 'C:\\audio\\ok.wav' }).status, JSON.stringify([W(o), P(o)]) === kept];
    // argument checks
    const n0 = reqs.length;
    r.types = [['SilenceDuration', 1.5], ['FrameOffset', '2'], ['GuideText', 5], ['NeuralNet', 1], ['ASRDict', 0], ['FileName', 3]].map(([k, v]) => st(run('ExtractPhonemesToSpeechOp', { InputObj: o, FileName: 'C:\\audio\\ok.wav', [k]: v })));
    r.noInterface = [st(run('ExtractPhonemesToSpeechOp', { InputObj: S.createSource('xEmpty'), FileName: 'C:\\audio\\ok.wav' })), st(run('ExtractPhonemesToSpeechOp', { InputObj: A.scene.find('cube'), FileName: 'C:\\audio\\ok.wav' })), reqs.length - n0];
    // SIExtractPhonemes
    answer = { status: 0, words: [{ name: 'zu', start: 0, end: 30, phonemes: [{ ipa: 0x7a, start: 0, end: 9 }, { ipa: 0x75, start: 10, end: 30 }] }] };
    const e1 = run('SIExtractPhonemes', { Language: 'JP', FileName: 'C:\\audio\\ok.wav', GuideText: 'zu' }); const q1 = reqs[reqs.length - 1];
    r.siJp = [st(e1), e1.v?.map(x => x.map(r6)), q1.neuralNet, q1.asrDict, q1.grammar, q1.trailingSilence];
    answer = { status: 0, phonemes: [{ ipa: 0x7a, start: 0, end: 9 }, { ipa: 0x999, start: 10, end: 30 }] };
    const e2 = run('SIExtractPhonemes', { Language: 'english', FileName: 'C:\\audio\\ok.wav' }); const q2 = reqs[reqs.length - 1];
    r.siEn = [st(e2), e2.v?.map(x => x.map(r6)), q2.neuralNet, q2.asrDict, q2.guided];
    r.siTypes = [st(run('SIExtractPhonemes', { Language: 1, FileName: 'C:\\audio\\ok.wav' })), st(run('SIExtractPhonemes', { FileName: 'C:\\audio\\ok.wav', GuideText: 2 }))];
    S.recogniser = null; const e3 = run('SIExtractPhonemes', { FileName: 'C:\\audio\\ok.wav' }); r.siNoEngine = [e3.status, nya(e3)];
    out.extract = r;
  }

  // ---- Index argument, InputObj, undo model
  {
    const r = {}; const o = fresh(); const src = S.createSource('editSrc', [o]);
    r.empty17 = EDIT.slice(3).map(n => st(run(n, { InputObj: o, Index: [] })));
    r.emptyDelete = [st(run('SpeechOpDeleteWords', { InputObj: o, Index: [] })), st(run('SpeechOpDeletePhonemes', { InputObj: o, Index: [] })), o.data.words.length, o.data.phonemes.length];
    r.notSpeech = [st(run('SpeechOpSetPhonemesWeight', { InputObj: src, Index: 0 })), st(run('SpeechOpDeleteWords', { InputObj: A.scene.find('cube'), Index: 0 })), st(run('SpeechOpInsertWord', { InputObj: 'noSuchSpeechObject' }))];
    r.badIndex = [st(run('SpeechOpSetPhonemesWeight', { InputObj: o, Index: 'abc' })), st(run('SpeechOpDeleteWords', { InputObj: o, Index: [0, {}] })), o.data.words.length];
    const nd = S.createSpeechOp('editNoData'); nd.data = null; r.noData = [st(run('SpeechOpSetPhonemesWeight', { InputObj: nd, Index: 0 })), st(run('SpeechOpDeleteWords', { InputObj: nd, Index: 0 })), st(run('SpeechOpInsertWord', { InputObj: nd }))];
    r.byName = [st(run('SpeechOpSetPhonemesWeight', { InputObj: o.name, Index: '2', Weight: 3 })), o.data.phonemes[2].weight];
    r.outOfRange = [st(run('SpeechOpSetPhonemesWeight', { InputObj: o, Index: [-1, 99, 1], Weight: 4 })), o.data.phonemes.map(p => p.weight)];
    // undo / redo / notification
    const u = fresh(); const w0 = JSON.stringify([W(u), P(u)]); const c0 = u.changes, s0 = A.undoStack.length;
    run('SpeechOpDeleteWords', { InputObj: u, Index: [2, 0] }); const w1 = JSON.stringify([W(u), P(u)]);
    r.undo = [A.undoStack.length - s0, u.changes - c0];
    A.undo(); r.undo.push(JSON.stringify([W(u), P(u)]) === w0, u.changes - c0); A.redo(); r.undo.push(JSON.stringify([W(u), P(u)]) === w1, u.changes - c0, w0 !== w1);
    // a move is not cumulative on redo
    const m = sel(fresh(), 1); run('SpeechOpMoveWords', { InputObj: m, Index: 0, Delta: 0.1 }); const m1 = JSON.stringify(W(m)); A.undo(); A.redo(); A.undo(); A.redo();
    r.redoMove = [JSON.stringify(W(m)) === m1, W(m)[1]];
    out.common = r;
  }

  // ---- SpeechOpDeleteWords / SpeechOpDeletePhonemes
  {
    const r = {};
    r.words = on('SpeechOpDeleteWords', { Index: [2, 0] });
    r.wordsDup = on('SpeechOpDeleteWords', { Index: [1, 1, 1] })[1].map(w => w[0]);
    r.wordsRange = on('SpeechOpDeleteWords', { Index: [9, -1] })[1].length;
    r.wordsDefault = on('SpeechOpDeleteWords', {})[1].map(w => w[0]);
    r.middle = on('SpeechOpDeletePhonemes', { Index: 1 }).map((x, i) => i ? x.slice(0, i === 1 ? 1 : 2) : x);
    r.first = on('SpeechOpDeletePhonemes', { Index: [0] }).map((x, i) => i ? x.slice(0, i === 1 ? 1 : 2) : x);
    r.last = on('SpeechOpDeletePhonemes', { Index: [2] }).map((x, i) => i ? x.slice(0, i === 1 ? 1 : 2) : x);
    r.wholeWord = on('SpeechOpDeletePhonemes', { Index: [4, 3] });
    out.del = r;
  }

  // ---- SpeechOpInsertWord
  {
    const r = {}; const ins = (a, prep) => on('SpeechOpInsertWord', { Name: 'x', IPA: 0x74, ...a }, prep);
    r.between = ins({ StartTime: 0.85, EndTime: 0.95 });
    const o = fresh(); run('SpeechOpInsertWord', { InputObj: o, Name: 'x', StartTime: 0.85, EndTime: 0.95, IPA: 0x74 }); const p = o.data.phonemes[5];
    r.record = [o.data.words[2].value, o.data.words[2].selected, p.value, p.weight, p.falloffIn, p.falloffOut, p.shapeWeight, p.shapeFalloffIn, p.shapeFalloffOut, p.blendIn, p.blendOut, p.variation, p.selected, p.flag];
    A.undo(); r.undo = [o.data.words.length, o.data.phonemes.length];
    r.swapTrim = ins({ StartTime: 0.95, EndTime: 0.75 }).map((x, i) => i === 2 ? x.slice(3, 6) : x);
    r.trimDelete = ins({ StartTime: 0.65, EndTime: 0.9 }).map((x, i) => i === 2 ? x.slice(3, 6) : x);
    r.word0NotTrimmed = ins({ StartTime: 0.3, EndTime: 0.55 }).map((x, i) => i === 2 ? x.slice(0, 5) : x);
    r.endCut = ins({ StartTime: 0.85, EndTime: 1.2 })[1];
    r.nearDeleted = ins({ StartTime: 0.99, EndTime: 1.2 });
    r.ripple = ins({ StartTime: 0.85, EndTime: 1.2, Ripple: true });
    r.atEnd = ins({ StartTime: 3, EndTime: 3.5 }).map((x, i) => i ? x.slice(-1) : x);
    const d = on('SpeechOpInsertWord', {}); r.defaults = [d[0], d[1].slice(0, 2), d[2].slice(0, 2), d[1].length, d[2].length];
    out.ins = r;
  }

  // ---- SpeechOpMoveWords / SpeechOpMovePhoneme
  {
    const r = {}; const mw = (a, ...ks) => on('SpeechOpMoveWords', { Index: [3], ...a }, o => sel(o, ...ks));
    r.indexIgnored = mw({ Delta: 0.1 }, 1);
    const o = sel(fresh(), 1); run('SpeechOpMoveWords', { InputObj: o, Index: [3], Delta: 0.1 }); r.flags = o.data.words.map(w => w.selected);
    r.noSelection = mw({ Delta: 0.1 })[1];
    r.clampNext = mw({ Delta: 0.5 }, 1)[1];
    r.clampPrev = mw({ Delta: -0.5 }, 1)[1];
    r.ripple = mw({ Delta: 0.5, Ripple: true }, 1);
    r.tiny = mw({ Delta: 0.02 }, 1)[1];
    r.run = mw({ Delta: 0.5 }, 1, 2)[1];
    r.rippleRun = mw({ Delta: 0.5, Ripple: true }, 1, 3)[1];
    r.floor = mw({ Delta: -1 }, 0)[1];
    r.lastFree = mw({ Delta: 5 }, 3)[1];
    const mp = (a) => on('SpeechOpMovePhoneme', a);
    r.pMiddle = mp({ Index: 1, Delta: 0.05 });
    r.pMiddleMax = mp({ Index: 1, Delta: 0.5 })[2].slice(0, 3);
    r.pMiddleMin = mp({ Index: 1, Delta: -0.5 })[2].slice(0, 3);
    r.pLast = mp({ Index: 2, Delta: 0.5 }).map((x, i) => i === 2 ? x.slice(0, 4) : x);
    r.pLastRipple = mp({ Index: 2, Delta: 0.5, Ripple: true });
    r.pFirst = mp({ Index: 3, Delta: -0.5 }).map((x, i) => i === 2 ? x.slice(2, 5) : x);
    r.pFirstOfAll = mp({ Index: 0, Delta: -1 }).map((x, i) => i ? x.slice(0, 2) : x);
    r.pListFirstOnly = mp({ Index: [1, 5], Delta: 0.05 })[2].slice(5, 7);
    const u = mp({ Index: 99, Delta: 0.5 }), t = mp({ Index: 1, Delta: -0.02 }), z = mp({}); const base = JSON.stringify(on('SpeechOpSetPhonemesWeight', { Index: 99 }).slice(1));
    r.pNothing = [u[0], JSON.stringify(u.slice(1)) === base, JSON.stringify(t.slice(1)) === base, z[0], JSON.stringify(z.slice(1)) === base];
    out.move = r;
  }

  // ---- scale commands
  {
    const r = {}; const sc = (n, a) => { const x = on(n, a); return [x[0], x[1], x[2].map(p => [p[1], p[2]])]; };
    const my = (x) => [x[1][1], x[2].slice(3, 5)];
    r.wsUp = my(sc('SpeechOpScaleWordStart', { Index: 1, Delta: 0.5 }));
    r.wsUpRipple = JSON.stringify(sc('SpeechOpScaleWordStart', { Index: 1, Delta: 0.5, Ripple: true })) === JSON.stringify(sc('SpeechOpScaleWordStart', { Index: 1, Delta: 0.5 }));
    r.wsDown = my(sc('SpeechOpScaleWordStart', { Index: 1, Delta: -0.5 }));
    r.wsSmall = my(sc('SpeechOpScaleWordStart', { Index: 1, Delta: 0.05 }));
    r.ws0 = (x => [x[1][0], x[2].slice(0, 3)])(sc('SpeechOpScaleWordStart', { Index: 0, Delta: -1 }));
    r.weUp = (x => [x[1], x[2].slice(3)])(sc('SpeechOpScaleWordEnd', { Index: 1, Delta: 0.5 }));
    r.weUpRipple = (x => [x[1], x[2].slice(3)])(sc('SpeechOpScaleWordEnd', { Index: 1, Delta: 0.5, Ripple: true }));
    r.weDown = my(sc('SpeechOpScaleWordEnd', { Index: 1, Delta: -0.5 }));
    r.weLast = (x => [x[1][3], x[2].slice(7)])(sc('SpeechOpScaleWordEnd', { Index: 3, Delta: 0.4 }));
    r.psFirst = JSON.stringify(sc('SpeechOpScalePhonStart', { Index: 3, Delta: -0.5 }).slice(1)) === JSON.stringify(sc('SpeechOpScaleWordStart', { Index: 1, Delta: -0.5 }).slice(1));
    r.peLast = JSON.stringify(sc('SpeechOpScalePhonEnd', { Index: 4, Delta: 0.5, Ripple: true }).slice(1)) === JSON.stringify(sc('SpeechOpScaleWordEnd', { Index: 1, Delta: 0.5, Ripple: true }).slice(1));
    r.psInner = (x => [x[1][0], x[2].slice(0, 4)])(sc('SpeechOpScalePhonStart', { Index: 1, Delta: 0.05 }));
    r.psInnerMax = (x => x[2].slice(0, 3))(sc('SpeechOpScalePhonStart', { Index: 1, Delta: 0.5 }));
    r.psInnerMin = (x => x[2].slice(0, 3))(sc('SpeechOpScalePhonStart', { Index: 1, Delta: -0.5 }));
    r.peInner = (x => [x[1][0], x[2].slice(0, 4)])(sc('SpeechOpScalePhonEnd', { Index: 0, Delta: 0.05 }));
    r.peInnerMax = (x => x[2].slice(0, 3))(sc('SpeechOpScalePhonEnd', { Index: 0, Delta: 0.5 }));
    r.peInnerMin = (x => x[2].slice(0, 3))(sc('SpeechOpScalePhonEnd', { Index: 1, Delta: -0.5 }));
    const base = JSON.stringify(sc('SpeechOpSetPhonemesWeight', { Index: 99 }).slice(1));
    r.nothing = ['SpeechOpScaleWordStart', 'SpeechOpScaleWordEnd', 'SpeechOpScalePhonStart', 'SpeechOpScalePhonEnd'].map(n => [sc(n, { Index: 1, Delta: 0.02 }), sc(n, { Index: 99, Delta: 0.5 }), sc(n, {})].map(x => x[0] === 'ok' && JSON.stringify(x.slice(1)) === base));
    out.scale = r;
  }

  // ---- split and setters
  {
    const r = {};
    const s = on('SpeechOpSplitPhonemes', { Index: [6, 1] }); r.split = [s[0], s[2].length, s[2].slice(1, 3), s[2].slice(7, 9), s[1].length];
    const c = S.createSpeechOp('splitSum', [{ name: 'a', start: 0.01, end: 0.06, phonemes: [{ ipa: 0x61, start: 0.01, end: 0.03 }, { ipa: 0x62, start: 0.03, end: 0.06 }] }]);
    c.data.phonemes[1].variation = 'v'; c.data.phonemes[1].weight = 0.5;
    run('SpeechOpSplitPhonemes', { InputObj: c, Index: [0, 1] }); r.splitSum = [T(c), c.data.phonemes.map(p => [p.ipa, p.word, p.variation, p.weight])];
    r.splitDefault = on('SpeechOpSplitPhonemes', {})[2].slice(0, 2);
    const o = fresh(); const f = (k) => o.data.phonemes.map(p => p[k]);
    const set = (n, a) => st(run(n, { InputObj: o, ...a }));
    r.ipa = [set('SpeechOpSetPhonemesIPAValue', { Index: [0, 1, 99], IPA: 0x74 }), f('ipa').slice(0, 3), set('SpeechOpSetPhonemesIPAValue', { Index: 2, IPA: 0x12345 }), f('ipa')[2]];
    r.floor0 = ['SpeechOpSetPhonemesWeight:weight:Weight', 'SpeechOpSetPhonemesShapeWeight:shapeWeight:Weight', 'SpeechOpSetPhonemesBlendIn:blendIn:Scale', 'SpeechOpSetPhonemesBlendOut:blendOut:Scale'].map(x => {
      const [n, k, arg] = x.split(':'); return [set(n, { Index: [0], [arg]: -3 }), set(n, { Index: [1], [arg]: 2.5 }), set(n, { Index: [2] }), f(k).slice(0, 4)];
    });
    r.unit = ['SpeechOpSetPhonemesFalloffIn:falloffIn', 'SpeechOpSetPhonemesFalloffOut:falloffOut', 'SpeechOpSetPhonemesShapeFalloffIn:shapeFalloffIn', 'SpeechOpSetPhonemesShapeFalloffOut:shapeFalloffOut'].map(x => {
      const [n, k] = x.split(':'); return [set(n, { Index: [0], Falloff: -3 }), set(n, { Index: [1], Falloff: 3 }), set(n, { Index: [2], Falloff: 0.25 }), set(n, { Index: [3] }), f(k).slice(0, 5)];
    });
    r.variation = [set('SpeechOpSetPhonemesVariation', { Index: [0] }), set('SpeechOpSetPhonemesVariation', { Index: [1, 2], Variation: 'B' }), set('SpeechOpSetPhonemesVariation', { Index: [3], Variation: 7 }), f('variation').slice(0, 5)];
    const c0 = o.changes; run('SpeechOpSetPhonemesWeight', { InputObj: o, Index: [5], Weight: 9 }); A.undo(); r.setUndo = [o.data.phonemes[5].weight, o.changes - c0];
    out.set = r;
  }

  A.events.emit('scene'); await new Promise(r => setTimeout(r, 80));
  return out;
}, { NAMES, EDIT });
await browser.close();

let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const E_NOINTERFACE = '80004002', E_FAIL = '80004005', E_INVALIDARG = '80070057', NO_MEMBER = '80020003', TYPE_MISMATCH = '80020005';
const H = 0x68, EH = 0x25b, OH = 0x6f, M = 0x6d, I = 0x26a0061, B = 0x62, OY = 0x26a0254, Z = 0x7a, OU = 0x75, TT = 0x74;
const WORDS = [['hello', 0.1, 0.5], ['my', 0.6, 0.8], ['boy', 1, 1.4], ['zoo', 1.5, 1.9]];
const PHON = [[H, 0.1, 0.2, 0], [EH, 0.2, 0.35, 0], [OH, 0.35, 0.5, 0], [M, 0.6, 0.7, 1], [I, 0.7, 0.8, 1], [B, 1, 1.1, 2], [OY, 1.1, 1.4, 2], [Z, 1.5, 1.7, 3], [OU, 1.7, 1.9, 3]];
const TIMES = PHON.map(p => [p[1], p[2]]);

// 1. registration
for (const n of NAMES) eq(`${n}: registered with the registry argument list (names, defaults; return value left out)`, got.registered[n], registry[n]);

// 2. default arguments
const D = got.defaults;
eq('ExtractPhonemesToSpeechOp / ...Japanese defaults: no speech data interface on InputObj, 0x80020003', [D.ExtractPhonemesToSpeechOp.status, D.ExtractPhonemesToSpeechOpJapanese.status], [NO_MEMBER, NO_MEMBER]);
eq('SIExtractPhonemes defaults: the audio file cannot be opened - logged, "Error Scanning Phonemes" raised with 0x80004005', [D.SIExtractPhonemes.status, D.SIExtractPhonemes.scan, D.SIExtractPhonemes.open], [E_FAIL, true, true]);
eq('GetPhonemesFromSpeechClip / GetPhonemeBlendFromSpeechClip defaults: no data block, 0x80004005', [D.GetPhonemesFromSpeechClip.status, D.GetPhonemeBlendFromSpeechClip.status], [E_FAIL, E_FAIL]);
eq('PlaybackTimeRange defaults (0, 0): runs, returns nothing, the open points are logged', [D.PlaybackTimeRange.status, D.PlaybackTimeRange.v, D.PlaybackTimeRange.nya], ['ok', '<unset>', 1]);
eq('PlaybackTimeRange defaults: range 0..0 played once, then current time, loop setting and range restored', got.playbackDefault, { started: true, range: [0, 0], during: ['once', 0, 0], after: [true, true, true, true, true, false] });
eq('the 20 SpeechOp* editing commands, defaults: InputObj does not resolve, the command fails (status 0x80070057 is inferred)', EDIT.map(n => D[n].status), Array(20).fill(E_INVALIDARG));

// 3. PlaybackTimeRange
const PB = got.playback;
eq('PlaybackTimeRange: arguments that are not doubles - 0x80070057', PB.badType, E_INVALIDARG);
eq('PlaybackTimeRange: loop setting forced off, range StartFrame..EndFrame set, playback started, returns nothing; open points logged', PB.started, ['ok', true, true, 'once', 3, 6, 1]);
eq('PlaybackTimeRange: a call during playback is ignored and logged (the original blocks)', PB.reentry, ['ok', 1, 3]);
eq('PlaybackTimeRange: the range is played from its first to its last frame', PB.played, [true, true, true]);
eq('PlaybackTimeRange: after playback the current time, loop setting and range are restored; no undo entry', PB.restored, [true, true, true, true, false, 0]);

// 4. GetPhonemesFromSpeechClip
const G = got.get;
eq('GetPhonemesFromSpeechClip: [phoneme count][13]', G.shape, ['ok', 9, true]);
eq('GetPhonemesFromSpeechClip: columns IPA, start, end, name, weight, falloff in / out, shape weight, shape falloff in / out, blend in / out, variation', [G.row0, G.row1], [[H, 0.1, 0.2, 'h', 1, 0, 0, 1, 0, 0, 1, 1, ''], [EH, 0.2, 0.35, 'e', 1, 0, 0, 1, 0, 0, 1, 1, 'B']]);
eq('GetPhonemesFromSpeechClip: English names, diphthongs as packed code points', G.names, ['h', 'e', 'oh', 'm', 'I', 'b', 'oy', 'z', 'ou']);
eq('GetPhonemesFromSpeechClip: a clip, its source, a name, and the speech object (inferred) give the same table', G.same, [true, true, true]);
eq('GetPhonemesFromSpeechClip: Japanese table with English fallback, 0x%x for unknown values, ~ for silence', [G.japanese, G.english], [['ts', 'r', 'a', '0x999', '~', 'k'], ['z', 'tt', 'a', '0x999', '~', 'c']]);
eq('GetPhonemesFromSpeechClip: zero phonemes - null array', G.empty, null);
eq('GetPhonemesFromSpeechClip: empty source / clip without source / no data block - 0x80004005', [G.noItem, G.noSource, G.noData], [E_FAIL, E_FAIL, E_FAIL]);

// 5. GetPhonemeBlendFromSpeechClip
const BL = got.blend;
eq('GetPhonemeBlendFromSpeechClip: no evaluation interface in this build - logged as not attested, no rows', BL.noEvaluator, ['ok', null, 1]);
eq('GetPhonemeBlendFromSpeechClip: [entry count][4] = IPA, name (always the English-first lookup), weight, string', BL.rows, ['ok', [[Z, 'z', 0.25, 'x'], [0, '~', 0.75, ''], [0x999, '0x999', 1, 'y']], 0]);
eq('GetPhonemeBlendFromSpeechClip: the evaluation gets (time in seconds, channel); Channel counts only as a 32-bit integer', BL.calls, [[15, 2], [30, 0], [30, 0]]);
eq('GetPhonemeBlendFromSpeechClip: Time not a double - logged as not attested, current time taken (inferred)', BL.noTime, ['ok', 1, true]);
eq('GetPhonemeBlendFromSpeechClip: zero entries - null (inferred)', BL.noEntries, null);

// 6. extraction
const X = got.extract;
eq('ExtractPhonemesToSpeechOp: missing audio file - "Error opening audio file", missing engine files logged and processing continued, error raised, data unchanged', X.noFile, [E_FAIL, true, true, 2, true]);
eq('ExtractPhonemesToSpeechOp: no recogniser in this build - logged as not attested, 0x80004005, data unchanged', X.noEngine, [E_FAIL, 1, true]);
eq('ExtractPhonemesToSpeechOp: sample rate other than 16000 - logged, 0x80004005, engine not run', X.rate, [E_FAIL, true, 0]);
eq('ExtractPhonemesToSpeechOp: bad channel count / not a wave file - logged, 0x80004005', [X.channels, X.format], [[E_FAIL, true], [E_FAIL, true]]);
eq('ExtractPhonemesToSpeechOp guided: returns nothing; grammar = $grammar= + tokens joined with single spaces, logged', X.guided, ['ok', true, true]);
eq('ExtractPhonemesToSpeechOp guided: node settings (max record trunc(samples / 16000 + 0.9), leading silence 10000, trailing SilenceDuration * 1000, rejection off)', X.request,
  [true, '$grammar=hi bob and more x', 'C:\\audio\\ok.wav', 'usgp16FN3108', 'USEnglish.pdc', true, 32000, 2, 10000, 4000, false]);
eq('ExtractPhonemesToSpeechOp guided: one word record per recognised word (name, per-word int), times = tick * 0.01 + FrameOffset in seconds', [X.words[0].map(w => w[0]), X.words[1], X.words[2]], [['hi', 'bob'], [7, 0], true]);
eq('ExtractPhonemesToSpeechOp guided: a one-tick gap is closed to the next start, except for the last phoneme of a word', X.phonemeTimes, true);
eq('ExtractPhonemesToSpeechOp: record defaults and shape falloff presets (b: +0.5, oh: -0.5, others 0)', X.phonemeFields,
  [[0, 1, 0, 0, 1, 0, 0, 1, 1, '', false, 0], [3, 1, 0, 0, 1, 0, 0, 1, 1, '', false, 0], [0, 1, 0, 0, 1, 0.5, 0.5, 1, 1, '', false, 0], [0, 1, 0, 0, 1, -0.5, -0.5, 1, 1, '', false, 0], [0, 1, 0, 0, 1, 0.5, 0.5, 1, 1, '', false, 0]]);
eq('ExtractPhonemesToSpeechOp: language flag 0, scale 1.0, time offset = FrameOffset; no notification, not undoable', X.block, [0, 1, 30, 0, 0]);
eq('ExtractPhonemesToSpeechOpJapanese unguided: Japanese defaults and data path, one unnamed word from the last phoneme, all phonemes in word 0, language flag 1', X.unguided,
  ['ok', false, null, 'jagp16FN5031', 'Japanese.pdc', true, 10000, [['', 0.4, 0.55]], [[0x251, 0.05, 0.15, 0], [0x283, 0.15, 0.3, 0], [0x69, 0.4, 0.55, 0]], [0, -0.5, 0], 1, 0]);
eq('ExtractPhonemesToSpeechOp: engine status -1036 - its message logged, error raised with 0x80004005, data unchanged', X.status1036, [E_FAIL, true, true, true]);
eq('ExtractPhonemesToSpeechOp: zero words (guided) / no phonemes (unguided) - 0x80004005, data unchanged', [X.zeroWords, X.zeroPhonemes], [[E_FAIL, true], [E_FAIL, true]]);
eq('ExtractPhonemesToSpeechOp: wrongly typed SilenceDuration / FrameOffset / GuideText / NeuralNet / ASRDict / FileName - 0x80070057', X.types, Array(6).fill(E_INVALIDARG));
eq('ExtractPhonemesToSpeechOp: empty source or an object without the speech data interface - 0x80020003, engine not run', X.noInterface, [NO_MEMBER, NO_MEMBER, 0]);
eq('SIExtractPhonemes "JP" (any case): Japanese engine files, silence 10, [n][4] = IPA, start, end, Japanese name; guided', X.siJp, ['ok', [[Z, 0, 0.1, 'ts'], [OU, 0.1, 0.3, 'u']], 'jagp16FN5031', 'Japanese.pdc', '$grammar=zu', 10000]);
eq('SIExtractPhonemes other language: US English files and names, unguided when GuideText is empty', X.siEn, ['ok', [[Z, 0, 0.1, 'z'], [0x999, 0.1, 0.3, '0x999']], 'usgp16FN3108', 'USEnglish.pdc', false]);
eq('SIExtractPhonemes: an input that is not a string - 0x80070057', X.siTypes, [E_INVALIDARG, E_INVALIDARG]);
eq('SIExtractPhonemes: no recogniser in this build - logged as not attested, 0x80004005', X.siNoEngine, [E_FAIL, 1]);

// 7. Index, InputObj, undo
const C = got.common;
eq('17-command class: an empty Index list - 0x80070057', C.empty17, Array(17).fill(E_INVALIDARG));
eq('Delete class: an empty Index list is accepted, nothing removed', C.emptyDelete, ['ok', 'ok', 4, 9]);
eq('editing commands take the speech object only: a source / another object - no interface (0x80004002 inferred); an unknown name does not resolve (0x80070057 inferred)', C.notSpeech, [E_NOINTERFACE, E_NOINTERFACE, E_INVALIDARG]);
eq('Index conversion failure returns the conversion status (0x80020005 inferred), nothing changed', C.badIndex, [TYPE_MISMATCH, TYPE_MISMATCH, 4]);
eq('editing commands: null data block - 0x80004005', C.noData, [E_FAIL, E_FAIL, E_FAIL]);
eq('editing commands: InputObj by name, a scalar Index converted to integer', C.byName, ['ok', 3]);
eq('Index values outside 0..count-1 are skipped silently', C.outOfRange, ['ok', [1, 4, 3, 1, 1, 1, 1, 1, 1]]);
eq('undo model: one undo entry; Undo restores the snapshot, Redo re-runs Do; a notification after each', C.undo, [1, 1, true, 2, true, 3, true]);
eq('SpeechOpMoveWords: redo is not cumulative (the worker starts from the snapshot)', C.redoMove, [true, ['my', 0.7, 0.9]]);

// 8. delete class
const DL = got.del;
eq('SpeechOpDeleteWords [2, 0]: indices refer to the numbering before the command; phonemes of the words removed, later word indices renumbered, times kept', DL.words,
  ['ok', [WORDS[1], WORDS[3]], [[M, 0.6, 0.7, 0], [I, 0.7, 0.8, 0], [Z, 1.5, 1.7, 1], [OU, 1.7, 1.9, 1]]]);
eq('SpeechOpDeleteWords [1, 1, 1]: the single dedup pass leaves one duplicate, so words 1 and 0 go', DL.wordsDup, ['boy', 'zoo']);
eq('SpeechOpDeleteWords: out-of-range indices skipped; an unset Index converts to 0 (inferred)', [DL.wordsRange, DL.wordsDefault], [4, ['my', 'boy', 'zoo']]);
eq('SpeechOpDeletePhonemes, middle phoneme: the next start is pulled back to the previous end', DL.middle, ['ok', [WORDS[0]], [[H, 0.1, 0.2, 0], [OH, 0.2, 0.5, 0]]]);
eq('SpeechOpDeletePhonemes, first of its word: the word starts at the next phoneme', DL.first, ['ok', [['hello', 0.2, 0.5]], [[EH, 0.2, 0.35, 0], [OH, 0.35, 0.5, 0]]]);
eq('SpeechOpDeletePhonemes, last of its word: the word ends at the previous phoneme', DL.last, ['ok', [['hello', 0.1, 0.35]], [[H, 0.1, 0.2, 0], [EH, 0.2, 0.35, 0]]]);
eq('SpeechOpDeletePhonemes [4, 3]: the second removal hits the only phoneme left, so the whole word goes', DL.wholeWord,
  ['ok', [WORDS[0], WORDS[2], WORDS[3]], [...PHON.slice(0, 3), [B, 1, 1.1, 1], [OY, 1.1, 1.4, 1], [Z, 1.5, 1.7, 2], [OU, 1.7, 1.9, 2]]]);

// 9. insert
const IN = got.ins;
eq('SpeechOpInsertWord: word inserted in time order with one phoneme before the phonemes of the following words; later word indices incremented', IN.between,
  ['ok', [WORDS[0], WORDS[1], ['x', 0.85, 0.95], WORDS[2], WORDS[3]], [...PHON.slice(0, 5), [TT, 0.85, 0.95, 2], [B, 1, 1.1, 3], [OY, 1.1, 1.4, 3], [Z, 1.5, 1.7, 4], [OU, 1.7, 1.9, 4]]]);
eq('SpeechOpInsertWord: word int 0, phoneme creation defaults', IN.record, [0, false, 0, 1, 0, 0, 1, 0, 0, 1, 1, '', false, 0]);
eq('SpeechOpInsertWord: undo restores the snapshot', IN.undo, [4, 9]);
eq('SpeechOpInsertWord: start / end swapped when reversed; the preceding word and its straddling phoneme are cut to the new start', IN.swapTrim,
  ['ok', [WORDS[0], ['my', 0.6, 0.75], ['x', 0.75, 0.95], WORDS[2], WORDS[3]], [[M, 0.6, 0.7, 1], [I, 0.7, 0.75, 1], [TT, 0.75, 0.95, 2]]]);
eq('SpeechOpInsertWord: phonemes of the preceding word that start after the new start are deleted', IN.trimDelete,
  ['ok', [WORDS[0], ['my', 0.6, 0.65], ['x', 0.65, 0.9], WORDS[2], WORDS[3]], [[M, 0.6, 0.65, 1], [TT, 0.65, 0.9, 2], [B, 1, 1.1, 3]]]);
eq('SpeechOpInsertWord: as read, no trimming when the preceding word is word 0', IN.word0NotTrimmed,
  ['ok', [WORDS[0], ['x', 0.3, 0.55], WORDS[1], WORDS[2], WORDS[3]], [...PHON.slice(0, 3), [TT, 0.3, 0.55, 1], [M, 0.6, 0.7, 2]]]);
eq('SpeechOpInsertWord without Ripple: the new end is cut to the start of the following word', IN.endCut, [WORDS[0], WORDS[1], ['x', 0.85, 1], WORDS[2], WORDS[3]]);
eq('SpeechOpInsertWord without Ripple: a following word starting within 0.02 s is deleted with its phonemes', IN.nearDeleted,
  ['ok', [WORDS[0], WORDS[1], ['x', 0.99, 1.2], WORDS[3]], [...PHON.slice(0, 5), [TT, 0.99, 1.2, 2], [Z, 1.5, 1.7, 3], [OU, 1.7, 1.9, 3]]]);
eq('SpeechOpInsertWord with Ripple: later words and phonemes shift by end - start', IN.ripple,
  ['ok', [WORDS[0], WORDS[1], ['x', 0.85, 1.2], ['boy', 1.35, 1.75], ['zoo', 1.85, 2.25]], [...PHON.slice(0, 5), [TT, 0.85, 1.2, 2], [B, 1.35, 1.45, 3], [OY, 1.45, 1.75, 3], [Z, 1.85, 2.05, 4], [OU, 2.05, 2.25, 4]]]);
eq('SpeechOpInsertWord after the last word: appended', IN.atEnd, ['ok', [['x', 3, 3.5]], [[TT, 3, 3.5, 4]]]);
eq('SpeechOpInsertWord defaults on a speech object: an unnamed zero-length word with a silence phoneme at time 0', IN.defaults, ['ok', [['', 0, 0], WORDS[0]], [[0, 0, 0, 0], [H, 0.1, 0.2, 1]], 5, 10]);

// 10. move
const MV = got.move;
eq('SpeechOpMoveWords: as read, the flagged words move and the Index values are ignored (Index [3], word 1 flagged)', MV.indexIgnored,
  ['ok', [WORDS[0], ['my', 0.7, 0.9], WORDS[2], WORDS[3]], [...PHON.slice(0, 3), [M, 0.7, 0.8, 1], [I, 0.8, 0.9, 1], ...PHON.slice(5)]]);
eq('SpeechOpMoveWords: the selection flags are as before the command', MV.flags, [false, true, false, false]);
eq('SpeechOpMoveWords: no flagged word - nothing moves', MV.noSelection, WORDS);
eq('SpeechOpMoveWords +0.5 without Ripple: clamped at the start of the following word', MV.clampNext, [WORDS[0], ['my', 0.8, 1], WORDS[2], WORDS[3]]);
eq('SpeechOpMoveWords -0.5: clamped at the end of the preceding word', MV.clampPrev, [WORDS[0], ['my', 0.5, 0.7], WORDS[2], WORDS[3]]);
eq('SpeechOpMoveWords +0.5 with Ripple: no clamp, every later word and phoneme shifts too', MV.ripple,
  ['ok', [WORDS[0], ['my', 1.1, 1.3], ['boy', 1.5, 1.9], ['zoo', 2, 2.4]], [...PHON.slice(0, 3), [M, 1.1, 1.2, 1], [I, 1.2, 1.3, 1], [B, 1.5, 1.6, 2], [OY, 1.6, 1.9, 2], [Z, 2, 2.2, 3], [OU, 2.2, 2.4, 3]]]);
eq('SpeechOpMoveWords |Delta| <= 0.02: ignored', MV.tiny, WORDS);
eq('SpeechOpMoveWords: a run of flagged words is clamped at the word after the run', MV.run, [WORDS[0], ['my', 0.7, 0.9], ['boy', 1.1, 1.5], WORDS[3]]);
eq('SpeechOpMoveWords with Ripple: the shift is applied once, from the first flagged word', MV.rippleRun, [WORDS[0], ['my', 1.1, 1.3], ['boy', 1.5, 1.9], ['zoo', 2, 2.4]]);
eq('SpeechOpMoveWords: word 0 stops at time 0; the last word has no upper limit', [MV.floor, MV.lastFree[3]], [[['hello', 0, 0.4], ...WORDS.slice(1)], ['zoo', 6.5, 6.9]]);
eq('SpeechOpMovePhoneme, inner phoneme: it shifts, the neighbours stay attached', MV.pMiddle, ['ok', WORDS, [[H, 0.1, 0.25, 0], [EH, 0.25, 0.4, 0], [OH, 0.4, 0.5, 0], ...PHON.slice(3)]]);
eq('SpeechOpMovePhoneme, inner: end limited to the next end - 0.02, start to the previous start + 0.02', [MV.pMiddleMax, MV.pMiddleMin],
  [[[H, 0.1, 0.33, 0], [EH, 0.33, 0.48, 0], [OH, 0.48, 0.5, 0]], [[H, 0.1, 0.12, 0], [EH, 0.12, 0.27, 0], [OH, 0.27, 0.5, 0]]]);
eq('SpeechOpMovePhoneme, last of its word without Ripple: limited by the next phoneme start; the word end follows', MV.pLast,
  ['ok', [['hello', 0.1, 0.6], ...WORDS.slice(1)], [[H, 0.1, 0.2, 0], [EH, 0.2, 0.45, 0], [OH, 0.45, 0.6, 0], [M, 0.6, 0.7, 1]]]);
eq('SpeechOpMovePhoneme, last of its word with Ripple: no limit, later words and phonemes shift', MV.pLastRipple,
  ['ok', [['hello', 0.1, 1], ['my', 1.1, 1.3], ['boy', 1.5, 1.9], ['zoo', 2, 2.4]], [[H, 0.1, 0.2, 0], [EH, 0.2, 0.85, 0], [OH, 0.85, 1, 0], [M, 1.1, 1.2, 1], [I, 1.2, 1.3, 1], [B, 1.5, 1.6, 2], [OY, 1.6, 1.9, 2], [Z, 2, 2.2, 3], [OU, 2.2, 2.4, 3]]]);
eq('SpeechOpMovePhoneme, first of its word: limited by the previous phoneme end; the word start follows', MV.pFirst,
  ['ok', [WORDS[0], ['my', 0.5, 0.8], WORDS[2], WORDS[3]], [[OH, 0.35, 0.5, 0], [M, 0.5, 0.6, 1], [I, 0.6, 0.8, 1]]]);
eq('SpeechOpMovePhoneme, phoneme 0: stops at time 0', MV.pFirstOfAll, ['ok', [['hello', 0, 0.5], WORDS[1]], [[H, 0, 0.1, 0], [EH, 0.1, 0.35, 0]]]);
eq('SpeechOpMovePhoneme: only the first list entry is used', MV.pListFirstOnly, PHON.slice(5, 7));
eq('SpeechOpMovePhoneme: out-of-range index, |Delta| <= 0.02 and the defaults succeed and change nothing', MV.pNothing, ['ok', true, true, 'ok', true]);

// 11. scale
const SC = got.scale;
eq('SpeechOpScaleWordStart +0.5: start limited to end - 0.02 n; phonemes rescaled onto the new span; Ripple has no effect', [SC.wsUp, SC.wsUpRipple], [[['my', 0.76, 0.8], [[0.76, 0.78], [0.78, 0.8]]], true]);
eq('SpeechOpScaleWordStart -0.5: start limited to the previous word end', SC.wsDown, [['my', 0.5, 0.8], [[0.5, 0.65], [0.65, 0.8]]]);
eq('SpeechOpScaleWordStart +0.05: linear rescale', SC.wsSmall, [['my', 0.65, 0.8], [[0.65, 0.725], [0.725, 0.8]]]);
eq('SpeechOpScaleWordStart, word 0: limited to time 0', SC.ws0, [['hello', 0, 0.5], [[0, 0.125], [0.125, 0.3125], [0.3125, 0.5]]]);
eq('SpeechOpScaleWordEnd +0.5 without Ripple: end limited to the next word start', SC.weUp, [[WORDS[0], ['my', 0.6, 1], WORDS[2], WORDS[3]], [[0.6, 0.8], [0.8, 1], ...TIMES.slice(5)]]);
eq('SpeechOpScaleWordEnd +0.5 with Ripple: unlimited, later words and phonemes shift by the applied delta', SC.weUpRipple,
  [[WORDS[0], ['my', 0.6, 1.3], ['boy', 1.5, 1.9], ['zoo', 2, 2.4]], [[0.6, 0.95], [0.95, 1.3], [1.5, 1.6], [1.6, 1.9], [2, 2.2], [2.2, 2.4]]]);
eq('SpeechOpScaleWordEnd -0.5: end limited to start + 0.02 n', SC.weDown, [['my', 0.6, 0.64], [[0.6, 0.62], [0.62, 0.64]]]);
eq('SpeechOpScaleWordEnd, last word: no upper limit', SC.weLast, [['zoo', 1.5, 2.3], [[1.5, 1.9], [1.9, 2.3]]]);
eq('SpeechOpScalePhonStart on the first / SpeechOpScalePhonEnd on the last phoneme of a word = the word command (Ripple included)', [SC.psFirst, SC.peLast], [true, true]);
eq('SpeechOpScalePhonStart, inner: the attached previous end follows; this phoneme to the last of the word rescaled onto [new start, old last end]', SC.psInner,
  [WORDS[0], [[0.1, 0.25], [0.25, 0.375], [0.375, 0.5], [0.6, 0.7]]]);
eq('SpeechOpScalePhonStart, inner: limited above by word end - 0.02 (last - index + 1), below by previous start + 0.02', [SC.psInnerMax, SC.psInnerMin],
  [[[0.1, 0.46], [0.46, 0.48], [0.48, 0.5]], [[0.1, 0.12], [0.12, 0.31], [0.31, 0.5]]]);
eq('SpeechOpScalePhonEnd, inner: the following phonemes of the word rescaled onto [next start + change, old last end]', SC.peInner,
  [WORDS[0], [[0.1, 0.25], [0.25, 0.375], [0.375, 0.5], [0.6, 0.7]]]);
eq('SpeechOpScalePhonEnd, inner: limited above by word end - 0.02 (last - index), below by own start + 0.02', [SC.peInnerMax, SC.peInnerMin],
  [[[0.1, 0.46], [0.46, 0.48], [0.48, 0.5]], [[0.1, 0.2], [0.2, 0.22], [0.22, 0.5]]]);
eq('scale commands: |Delta| <= 0.02, an out-of-range index and the defaults succeed and change nothing', SC.nothing, Array(4).fill([true, true, true]));

// 12. split and setters
const SP = got.set;
eq('SpeechOpSplitPhonemes [6, 1]: indices before the command; the copy starts at the midpoint, same word', SP.split, ['ok', 11, [[EH, 0.2, 0.275, 0], [EH, 0.275, 0.35, 0]], [[OY, 1.1, 1.25, 2], [OY, 1.25, 1.4, 2]], 4]);
eq('SpeechOpSplitPhonemes: as read, the test is start + end > 0.08 (not the duration); the copy keeps all fields', SP.splitSum, [[[0.01, 0.03], [0.03, 0.045], [0.045, 0.06]], [[0x61, 0, '', 1], [0x62, 0, 'v', 0.5], [0x62, 0, 'v', 0.5]]]);
eq('SpeechOpSplitPhonemes: an unset Index converts to 0 (inferred)', SP.splitDefault, [[H, 0.1, 0.15, 0], [H, 0.15, 0.2, 0]]);
eq('SpeechOpSetPhonemesIPAValue: sets every listed in-range phoneme, no validation against the tables', SP.ipa, ['ok', [TT, TT, OH], 'ok', 0x12345]);
eq('SpeechOpSetPhonemesWeight / ShapeWeight / BlendIn / BlendOut: clamped below at 0, no upper limit; default value 0', SP.floor0, Array(4).fill(['ok', 'ok', 'ok', [0, 2.5, 0, 1]]));
eq('SpeechOpSetPhonemesFalloffIn / FalloffOut / ShapeFalloffIn / ShapeFalloffOut: clamped to [-1, 1]; default value 0', SP.unit, Array(4).fill(['ok', 'ok', 'ok', 'ok', [-1, 1, 0.25, 0, 0]]));
eq('SpeechOpSetPhonemesVariation: the value as a string; registry default "0"', SP.variation, ['ok', 'ok', 'ok', ['0', 'B', 'B', '7', '']]);
eq('setters: undo restores the snapshot and notifies', SP.setUndo, [1, 2]);

eq('page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-B9d phonemeui speech commands: ${fails.length} of ${checks} checks`);
  for (const x of fails) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B9d phonemeui speech commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer, on the stand-in speech object): GetPhonemesFromSpeechClip and the 20 SpeechOp* editing commands');
console.log('   partly wired (log "not yet attested"): ExtractPhonemesToSpeechOp, ExtractPhonemesToSpeechOpJapanese, SIExtractPhonemes (the Fonix recogniser is a seam; set-up, audio checks and the handling of its answer are wired), GetPhonemeBlendFromSpeechClip (the blend evaluation is a seam), PlaybackTimeRange (span / setting identity; returns before playback ends)');
console.log('   stand-in only: the speech operator / source / clip objects (app.phonemeSpeech), not created by any command of this row');
