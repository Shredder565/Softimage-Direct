// CMD-B15d (imageclip.dll / moaudio.dll): the 16 commands of src/commands/clipsSourcesB15d*.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15d-clips-sources.md and
// docs/re/WIRE_CORRECTIONS_B15.md items 30-34.
//   1. every name is registered with the registry argument list (data/command_registry.json; absent default -> null);
//   2. every command runs with its default arguments on the ?demo scene without an unexpected error (commands whose
//      required input has no default must fail with a message naming the command);
//   3. the contract's stated results (reuse by path, clip naming, operators, V%d_%s names, model-clip names and
//      messages, file-cache source + mixer clip, audio import / clip rules, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_clips_b15d_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
  .filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['SIAddImageSourceOp', 'SIAddImageOp', 'SIAddWritableImageSource', 'SICreateImageClip2', 'SICreateDefaultImageClip', 'SetImageSource', 'SIAddModelSource',
  'SICreateModelClip', 'SIAddModelClip', 'AddFileCacheSource', 'AddFileCacheSource2', 'SIAddImageSource', 'SIAddImageClip', 'AddAudioClip', 'ImportAudio'];
const DEFAULT_FAILS = new Set(['SIAddImageOp', 'SetImageSource', 'SICreateModelClip', 'SIAddModelClip', 'AddFileCacheSource', 'AddFileCacheSource2', 'AddAudioClip', 'ImportAudio']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const f = reg.find(x => x.scripting_name === n);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SIAddImageSource') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.name && v.type) ? `<${v.type}:${v.name}>` : v)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const v = (n, a) => run(n, a).v;
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const has = (r, re) => r.log.some(l => re.test(l)) || (!!r.err && re.test(r.err));
  const cube = A.scene.find('cube');
  const store = A.uixsiClipsDisplayAddons.imageSources;
  const mixOf = m => m.property('mixer');
  const S = () => A.clipsSourcesB15d;

  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }

  try {
    // ---- SIAddImageSource (WIRE_CORRECTIONS 33)
    const n0 = store.length;
    ok('SIAddImageSource: empty FileName -> nothing', v('SIAddImageSource', { FileName: '' }) === undefined && store.length === n0);
    const s1 = v('SIAddImageSource', { FileName: 'C:\\img\\Wood.PNG', Name: '' });
    ok('SIAddImageSource: new imagesource in the store, FileName kept as given, default name from file', s1?.type === 'imagesource' && s1.val('FileName') === 'C:\\img\\Wood.PNG' && s1.name === 'Wood' && store.includes(s1), s1);
    const s2 = v('SIAddImageSource', { FileName: 'c:/IMG/wood.png' });
    ok('SIAddImageSource: same resolved path (case-insensitive) -> the existing source, nothing created', s2 === s1 && store.length === n0 + 1);
    const s3 = v('SIAddImageSource', { FileName: 'C:\\img\\b.png', Name: 'Named' });
    ok('SIAddImageSource: Name sets the source name', s3?.name === 'Named');
    A.undo(); ok('SIAddImageSource: undo removes it', !store.includes(s3));
    S().locks.sources = true; const r = run('SIAddImageSource', { FileName: 'C:\\img\\c.png' }); S().locks.sources = false;
    ok('SIAddImageSource: locked sources container -> lock error, nothing created', !!r.err && !store.some(s => /c\.png/.test(s.val('FileName'))), r);

    // ---- SIAddImageClip + SIAddImageSourceOp
    const c1 = v('SIAddImageClip', { Source: s1 });
    ok('SIAddImageClip: clip named after the source, source set', c1?.type === 'imageclip' && c1.name === 'Wood' && c1.source === s1 && c1.val('filename') === s1.val('FileName'), c1);
    ok('SIAddImageClip: SIAddImageSourceOp ran (one image-source operator reading the source)', c1.imageOps?.length === 1 && c1.imageOps[0].type === 'imagesourceop' && c1.imageOps[0].source === s1);
    ok('SIAddImageClip: root property', A.scene.root.properties.includes(c1));
    const c2 = v('SIAddImageClip', { Source: s1, Name: 'Mine' });
    ok('SIAddImageClip: Name wins', c2?.name === 'Mine');
    ok('SIAddImageClip: Source that is not an image source -> nothing', v('SIAddImageClip', { Source: cube }) === undefined);
    A.undo(); ok('SIAddImageClip: undo removes the clip', !A.scene.root.properties.includes(c2));
    ok('SIAddImageSourceOp: Clip not an image clip -> nothing', v('SIAddImageSourceOp', { Clip: cube, Source: s1 }) === undefined);
    ok('SIAddImageSourceOp: Source not an image source -> nothing', v('SIAddImageSourceOp', { Clip: c1, Source: cube }) === undefined);
    const op = v('SIAddImageSourceOp', { Clip: c1 });
    ok('SIAddImageSourceOp: omitted Source uses the clip source; returns the operator', op?.type === 'imagesourceop' && op.source === s1 && c1.imageOps.length === 2, op);

    // ---- SetImageSource
    const sB = v('SIAddImageSource', { FileName: 'C:\\img\\other.png' });
    v('SetImageSource', { Source: sB, InputObjs: [c1, cube] });
    ok('SetImageSource: image clips get the source, non-clips ignored', c1.source === sB && c1.val('filename') === 'C:\\img\\other.png');
    ok('SetImageSource: Source that is not an image source -> nothing', (v('SetImageSource', { Source: cube, InputObjs: [c1] }), c1.source === sB));
    ok('SetImageSource: InputObjs required', !!run('SetImageSource', { Source: sB }).err);

    // ---- SIAddImageOp
    const r1 = run('SIAddImageOp', { Clip: c1 });
    ok('SIAddImageOp: no preset -> E_FAIL naming the command', status(r1, '80004005') && /SIAddImageOp/.test(r1.err), r1);
    const n1 = c1.imageOps.length;
    const io = v('SIAddImageOp', { PresetObj: 'Blur', Clip: c1 });
    ok('SIAddImageOp: preset applied as an in-place operator on the clip', io?.type === 'imageop' && c1.imageOps.length === n1 + 1 && io.preset === 'Blur', io);
    const io2 = v('SIAddImageOp', { PresetObj: 'ImageSourceOp', Clip: c1 });
    ok('SIAddImageOp: the image-source-op preset is routed to SIAddImageSourceOp', io2?.type === 'imagesourceop', io2);
    ok('SIAddImageOp: Clip not an image clip -> nothing', v('SIAddImageOp', { PresetObj: 'Blur', Clip: cube }) === undefined);

    // ---- SIAddWritableImageSource
    const w = v('SIAddWritableImageSource', { FileName: 'C:\\img\\paint.png', Name: 'Paint', Width: 64, Height: 32, Type: ':siRenderChannelColorType:siRenderChannelType' });
    ok('SIAddWritableImageSource: writable source with size and type', w?.name === 'Paint' && w.val('Width') === 64 && w.val('Height') === 32 && w.val('Writable') === true && w.val('Type') === 2, w);
    ok('SIAddWritableImageSource: UseExisting returns the existing source', v('SIAddWritableImageSource', { FileName: 'c:\\IMG\\paint.png', UseExisting: true }) === w);
    ok('SIAddWritableImageSource: Width < 1 -> error', !!run('SIAddWritableImageSource', { Width: 0 }).err);
    ok('SIAddWritableImageSource: Type outside 1..6 -> error', !!run('SIAddWritableImageSource', { Type: 9 }).err);

    // ---- SICreateImageClip2 / SICreateDefaultImageClip (WIRE_CORRECTIONS 32)
    const l1 = v('SICreateImageClip2', { FileName: 'C:\\img\\one.png' });
    ok('SICreateImageClip2: collection with one clip for a plain file', Array.isArray(l1) && l1.length === 1 && l1[0].type === 'imageclip' && l1[0].name === 'one', l1);
    ok('SICreateImageClip2: the clip is wired to the (reused) source', l1[0].source === v('SIAddImageSource', { FileName: 'C:\\img\\one.png' }));
    S().subImageCount = f => 3;
    const l3 = v('SICreateImageClip2', { FileName: 'C:\\img\\multi.exr' });
    ok('SICreateImageClip2: one clip per sub-image, later ones V%d_%s', l3.length === 3 && l3[0].name === 'multi.exr' && l3[1].name === 'V1_multi.exr' && l3[2].name === 'V2_multi.exr', l3.map(c => c.name));
    ok('SICreateImageClip2: sub-image index set on the clips', l3.map(c => c.val('SubImageIndex')).join() === '0,1,2');
    S().subImageCount = () => 1;
    const lc = v('SICreateImageClip', { FileName: 'C:\\img\\mode0.png', Name: 'M0' });
    ok('SICreateImageClip: mode 0, a single clip', lc?.name === 'M0');
    ok('SICreateDefaultImageClip: empty preference default image -> no clip', v('SICreateDefaultImageClip') === undefined);
    S().defaultImage = 'C:\\img\\default.png';
    const dc = v('SICreateDefaultImageClip');
    ok('SICreateDefaultImageClip: clip from the user-preference default image', dc?.type === 'imageclip' && dc.name === 'default' && dc.source.val('FileName') === 'C:\\img\\default.png', dc);
    S().defaultImage = '';
    S().locks.clips = true; const rl = run('SICreateImageClip2', { FileName: 'C:\\img\\lk.png' }); S().locks.clips = false;
    ok('SICreateImageClip2: locked clips container -> error', !!rl.err);

    // ---- model sources and clips (WIRE_CORRECTIONS 30, 31)
    const ms = v('SIAddModelSource', { FileName: 'D:\\models\\Robot.emdl' });
    ok('SIAddModelSource: default name ModelSource_<base>, resolution 2', ms?.type === 'modelsource' && ms.name === 'ModelSource_Robot' && ms.val('Resolution') === 2 && ms.val('FileName') === 'D:\\models\\Robot.emdl', ms);
    ok('SIAddModelSource: Name given', v('SIAddModelSource', { FileName: 'D:\\m\\x.emdl', Name: 'Mine' })?.name === 'Mine');
    S().restricted = true; const rr = run('SIAddModelSource', { FileName: 'D:\\m\\y.emdl' }); S().restricted = false;
    ok('SIAddModelSource: restricted edition -> message, no source', rr.v === undefined && has(rr, /Creation of model source only available in Essentials and Advanced/), rr);
    const mc = v('SICreateModelClip', { FileName: 'D:\\models\\Hero.emdl' });
    ok('SICreateModelClip: clip ModelClip_<base>, new source ModelSource_<base>, resolution 2', mc?.name === 'ModelClip_Hero' && mc.source.name === 'ModelSource_Hero' && mc.val('Resolution') === 2, mc);
    const mc2 = v('SICreateModelClip', { FileName: 'D:\\models\\Hero2.emdl', Name: 'Nm' });
    ok('SICreateModelClip: Name given and no source -> clip and source both named Name', mc2?.name === 'Nm' && mc2.source.name === 'Nm', mc2);
    const r2 = run('SICreateModelClip', {});
    ok('SICreateModelClip: empty FileName and no Source -> 0x80070057', status(r2, '80070057'), r2);
    const via = a => { const m = A.log.length; try { return { v: S().createModelClip(a), log: [] }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };   // Source is not a registry argument: reached through the hook
    const mc3 = via({ Source: ms }).v;
    ok('SICreateModelClip: existing source -> clip ModelClip_<source name>', mc3?.name === 'ModelClip_ModelSource_Robot' && mc3.source === ms, mc3);
    const r3 = via({ Source: ms });
    ok('SICreateModelClip: source already has a clip -> message + 0x80070057', status(r3, '80070057') && has(r3, /already having a clip for this resolution/), r3);
    const r4 = via({ Source: v('SIAddModelSource', { FileName: '', Name: 'NoFile' }) });
    ok('SICreateModelClip: source without a file for the resolution -> message + 0x80070057', status(r4, '80070057') && has(r4, /invalid file path for this resolution/), r4);
    const r5 = run('SIAddModelClip', { Source: ms });
    ok('SIAddModelClip: obsolete message, E_FAIL, nothing created', status(r5, '80004005') && has(r5, /Obsolete command, to create a clip you have to change the model source resolution\./), r5);

    // ---- file cache sources
    const m = A.scene.root; const mix = mixOf(m)?.clips?.length ?? 0;
    const fcs = v('AddFileCacheSource', { InputObj: cube, FileName: 'C:\\cache\\cube.xsi', DeployInMixer: false });
    ok('AddFileCacheSource: source (file path, target object path), no clip when DeployInMixer is false', fcs?.type === 'filecachesource' && fcs.val('FileName') === 'C:/cache/cube.xsi' && /cube$/.test(fcs.val('TargetObject')) && (mixOf(m)?.clips?.length ?? 0) === mix, fcs);
    const fcs2 = v('AddFileCacheSource2', { InputObj: cube, FileName: 'C:\\cache\\cube2.xsi', SourceObject: '' });
    const mx = mixOf(m);
    ok('AddFileCacheSource2: DeployInMixer (default true) adds a track and a clip at the start frame', fcs2?.type === 'filecachesource' && mx.clips.some(c => c.source === fcs2.name && c.start === 1) && mx.trackRows?.some(t => /91ab66bc/.test(t.type)), { clips: mx.clips.map(c => c.source), rows: mx.trackRows });
    ok('AddFileCacheSource: no FileName -> 0x80004003', status(run('AddFileCacheSource', { InputObj: cube }), '80004003'));
    ok('AddFileCacheSource: no target and no pick session -> error naming the command', /AddFileCacheSource/.test(run('AddFileCacheSource', { FileName: 'C:\\cache\\nothing.xsi' }).err ?? ''));
    const g = v('AddFileCacheSource', { FileName: 'C:\\cache\\Scene_cube.xsi', DeployInMixer: false });
    ok('AddFileCacheSource: no InputObj -> target guessed from the file name with the template ([model]_[object])', g?.type === 'filecachesource' && /cube$/.test(g.val('TargetObject')), g);
    S().pick = () => 'cancel';
    ok('AddFileCacheSource: cancelled pick -> 0x80004004', status(run('AddFileCacheSource', { FileName: 'C:\\cache\\zzz.xsi' }), '80004004')); S().pick = null;
    S().locks.sources = true;
    ok('AddFileCacheSource: locked sources container -> error', !!run('AddFileCacheSource', { InputObj: cube, FileName: 'C:\\cache\\l.xsi' }).err); S().locks.sources = false;

    // ---- audio (WIRE_CORRECTIONS 34)
    ok('ImportAudio: Model and FileName required -> 0x80004003', status(run('ImportAudio', { FileName: 'C:\\a.wav' }), '80004003') && status(run('ImportAudio', { Model: m }), '80004003'));
    const au = v('ImportAudio', { Model: m, FileName: 'C:\\sound\\boom.wav' });
    ok('ImportAudio: audio source named after the file when Name is empty', au?.type === 'audiosource' && au.name === 'boom.wav' && m.properties.includes(au), au);
    ok('ImportAudio: folder stored under Nle\\animmix\\audio', S().registry['Nle\\animmix\\audio'] === 'C:\\sound', S().registry);
    ok('ImportAudio: Name given', v('ImportAudio', { Model: m, FileName: 'C:\\sound\\x.wav', Name: 'Nm' })?.name === 'Nm');
    const clip = v('AddAudioClip', { Model: m, Source: au, Time: 10 });
    const mx2 = mixOf(m);
    ok('AddAudioClip: no Track -> a new audio track (d39d004a) and a clip named after the source at Time', clip?.clip?.name === 'boom.wav' && clip.clip.start === 10 && clip.clip.type === 'mixeraudioclip' && mx2.trackRows.some(t => /d39d004a/.test(t.type)), { clip: clip?.clip, rows: mx2.trackRows });
    const tr = clip.clip.track;
    const rc = run('AddAudioClip', { Model: m, Source: au, Track: tr, Time: 12 });
    ok('AddAudioClip: clip does not fit on the given track -> E_FAIL + message', status(rc, '80004005') && has(rc, /XSIMOAUDIO 0x6f/), rc);
    const c2b = v('AddAudioClip', { Model: m, Source: au, Track: tr, Time: 10 + au.val('Length') + 5, Name: 'Second' });
    ok('AddAudioClip: fits after the first clip on the same track', c2b?.clip?.name === 'Second' && c2b.clip.track === tr, c2b?.clip);
    mx2.trackRows[tr].locked = true; const rk = run('AddAudioClip', { Model: m, Source: au, Track: tr, Time: 900 }); mx2.trackRows[tr].locked = false;
    ok('AddAudioClip: locked track -> 0x80070005', status(rk, '80070005'), rk);
    ok('AddAudioClip: not an audio source -> no clip', v('AddAudioClip', { Model: m, Source: cube, Time: 1 }) === undefined);
    const hi = v('ImportAudio', { Model: m, FileName: 'C:\\sound\\hi.wav' }); hi.set('SampleRate', 48000);
    ok('AddAudioClip: Project Audio Sample Rate takes the source rate', (v('AddAudioClip', { Model: m, Source: hi, Time: 2000 }), S().audioSampleRate === 48000), S().audioSampleRate);
    S().audioRateFixed = true; au.set('SampleRate', 22050);
    const rf = run('AddAudioClip', { Model: m, Source: au, Time: 3000 }); S().audioRateFixed = false;
    ok('AddAudioClip: rate differs and the scene rate is fixed -> E_FAIL + message, no clip', status(rf, '80004005') && has(rf, /XSIMOAUDIO 0x70/) && !mx2.clips.some(c => c.start === 3000), rf);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_clips_b15d_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
