// CMD-B15d (imageclip.dll / moaudio.dll): the 16 commands of src/commands/clipsSourcesB15d.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15d-clips-sources.md and
// docs/re/WIRE_CORRECTIONS_B15.md items 17 and 30-34.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; the return-value slot,
//      flags -1, is not a caller argument);
//   2. every command runs with its default arguments on the ?demo scene (cube selected, no user session) and either
//      succeeds or fails with the status the contract states for a missing required argument;
//   3. the contract's stated results (source reuse by resolved path, clip naming, source operator, sub-image clips,
//      default clip, model source / clip names and errors, the obsolete command, file-cache target guess and mixer
//      deploy, audio import, audio clip track / fit / lock / sample rate rules, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_clips_b15d_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = [
  'SIAddImageSource', 'SIAddImageClip', 'SIAddImageSourceOp', 'SIAddImageOp', 'SIAddWritableImageSource', 'SetImageSource',
  'SICreateImageClip', 'SICreateImageClip2', 'SICreateDefaultImageClip', 'SIAddModelSource', 'SICreateModelClip', 'SIAddModelClip',
  'AddFileCacheSource', 'AddFileCacheSource2', 'ImportAudio', 'AddAudioClip',
];
// default run: the status the contract gives for the missing required argument (absent = must succeed)
const DEFAULT_STATUS = {
  SIAddImageClip: '80070057', SIAddImageOp: '80004005', SetImageSource: '80070057', SICreateModelClip: '80070057', SIAddModelClip: '80004005',
  AddFileCacheSource: '80004003', AddFileCacheSource2: '80004003', ImportAudio: '80004003', AddAudioClip: '80004003',
};
const STATUS = {
  full: ['SIAddImageSource', 'SIAddImageClip', 'SIAddImageSourceOp', 'SetImageSource', 'SIAddModelSource', 'SICreateModelClip', 'SIAddModelClip', 'ImportAudio', 'AddAudioClip'],
  partly: ['SIAddImageOp (slot-10 preset id path)', 'SIAddWritableImageSource (UseExisting rule, invalid-argument status, parameter ids)',
    'SICreateImageClip / SICreateImageClip2 / SICreateDefaultImageClip (sub-image count, naming guard, default image path)',
    'AddFileCacheSource / AddFileCacheSource2 (deploy tail, SourceObject, pointcloud arguments, frame range)'],
};

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => x.scripting_name === n);
  return [n, f ? f.args.filter(a => a.flags !== -1).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('AddAudioClip') && !!window.Application?.scene?.find('cube'), null, { timeout: 90000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_STATUS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const ST = A.clipsSourcesB15d; const root = A.scene.root;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B15d/.test(l));
  const props = (type) => root.properties.filter(p => p.type === type);
  const J = JSON.stringify;
  const cube = A.scene.find('cube');
  const undoAll = (u0) => { while (A.undoStack.length > u0) A.undo(); };
  A.Interactive = false;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected), undone afterwards
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    undoAll(u0);
    const want = DEFAULT_STATUS[n];
    out.defaults[n] = r.err ? (want && status(r, want) ? 'expected-failure' : 'ERROR: ' + r.err) : (want ? 'UNEXPECTED-OK' : 'ok');
  }
  A.select([cube]);
  { const u0 = A.undoStack.length; const r = run('SIAddImageSource'); ok('SIAddImageSource default: no source, FileName handler logged', r.v?.Source === null && nya(r), r); undoAll(u0); }
  { const u0 = A.undoStack.length; const r = run('SICreateDefaultImageClip'); const c = r.v?.Clip;
    ok('SICreateDefaultImageClip default: clip noIcon_pic on the default image', c?.type === 'imageclip' && /^noIcon_pic\d*$/.test(c.name) && c.source?.val('FileName') === 'noIcon.pic', [c?.name, c?.source?.val('FileName')]); undoAll(u0); }
  { const u0 = A.undoStack.length; const r = run('SIAddModelSource'); ok('SIAddModelSource default: a source, default name logged', r.v?.Source?.type === 'modelsource' && nya(r), r.v?.Source?.name); undoAll(u0); }
  { const r = run('SIAddModelClip'); ok('SIAddModelClip default: obsolete message logged', r.log.includes('Obsolete command, to create a clip you have to change the model source resolution.'), r.log); }

  // ================= image sources (SIAddImageSource)
  try {
    const u0 = A.undoStack.length; const sel0 = J(A.selection.map(n => n.name)); const props0 = root.properties.length;
    const s1 = run('SIAddImageSource', { FileName: 'Pictures/wood.pic' }).v?.Source;
    ok('SIAddImageSource: new image source on the scene root, file-based name, FileName as given', s1?.type === 'imagesource' && s1.name === 'wood_pic' && s1.val('FileName') === 'Pictures/wood.pic' && root.properties.includes(s1), [s1?.type, s1?.name]);
    ok('SIAddImageSource: selection untouched', J(A.selection.map(n => n.name)) === sel0);
    const u1 = A.undoStack.length;
    const s2 = run('SIAddImageSource', { FileName: 'pictures\\.\\WOOD.PIC', Name: 'other' }).v?.Source;
    ok('SIAddImageSource: same resolved path (case-insensitive) hands back the existing source, nothing undoable', s2 === s1 && A.undoStack.length === u1 && props('imagesource').filter(p => p === s1).length === 1);
    const s3 = run('SIAddImageSource', { FileName: 'Pictures/stone.pic', Name: 'stoneSrc' }).v?.Source;
    ok('SIAddImageSource: Name names the source', s3?.name === 'stoneSrc');
    ST.locked.sources = true; const n0 = props('imagesource').length;
    const rl = run('SIAddImageSource', { FileName: 'Pictures/locked.pic' });
    ok('SIAddImageSource: locked sources container -> lock error, no source', !!rl.err && props('imagesource').length === n0, rl);
    ST.locked.sources = false;

    // ================= SIAddImageClip / SIAddImageSourceOp / SetImageSource
    const c1 = run('SIAddImageClip', { Source: s1 }).v?.Clip;
    ok('SIAddImageClip: empty Name -> the source name', c1?.type === 'imageclip' && c1.name === 'wood_pic' && root.properties.includes(c1), c1?.name);
    ok('SIAddImageClip: clip wired through SIAddImageSourceOp (one image-source operator, clip source set)', c1?.imageOps?.length === 1 && c1.imageOps[0].type === 'imagesourceop' && c1.source === s1 && c1.val('filename') === 'Pictures/wood.pic', c1?.imageOps?.map(o => o.type));
    const c2 = run('SIAddImageClip', { Source: 'stoneSrc', Name: 'myClip' }).v?.Clip;
    ok('SIAddImageClip: Name names the clip; source by name', c2?.name === 'myClip' && c2.source === s3);
    const rn = run('SIAddImageClip', { Source: c2 });
    ok('SIAddImageClip: a source that is not an image source -> nothing', !rn.err && rn.v?.Clip === null, rn);
    const op = run('SIAddImageSourceOp', { Clip: c1, Source: s3 }).v;
    ok('SIAddImageSourceOp: one more image-source operator, clip source set to Source', op?.type === 'imagesourceop' && c1.imageOps.length === 2 && c1.source === s3 && c1.val('SourceName') === 'stoneSrc');
    const op2 = run('SIAddImageSourceOp', { Clip: c1 }).v;
    ok('SIAddImageSourceOp: no Source -> the clip\'s current source', op2?.ports?.source === s3 && c1.imageOps.length === 3);
    ok('SIAddImageSourceOp: Clip not an image clip -> nothing', run('SIAddImageSourceOp', { Clip: 'cube', Source: s1 }).v === undefined);
    const rs = run('SetImageSource', { Source: s1, InputObjs: [c1, 'cube', c2] });
    ok('SetImageSource: every image clip in InputObjs gets the source, non-clips ignored', !rs.err && c1.source === s1 && c2.source === s1 && c2.val('filename') === 'Pictures/wood.pic', rs);
    run('SetImageSource', { Source: c2, InputObjs: [c1] });
    ok('SetImageSource: Source not an image source -> nothing', c1.source === s1);
    A.undo(); ok('SetImageSource: undo restores the previous sources', c1.source === s3 && c2.source === s3, [c1.source?.name, c2.source?.name]);

    // ================= SIAddImageOp
    ok('SIAddImageOp: no preset -> E_FAIL', status(run('SIAddImageOp', { Clip: c1 }), '80004005'));
    const nOps = c1.imageOps.length;
    const io = run('SIAddImageOp', { PresetObj: 'ImageSourceOp', Clip: c1 }).v;
    ok('SIAddImageOp: image-source-op preset routed to SIAddImageSourceOp (clip\'s current source)', io?.type === 'imagesourceop' && io.ports?.source === c1.source && c1.imageOps.length === nOps + 1);
    const fx = run('SIAddImageOp', { PresetObj: 'Presets/Blur.Preset', Clip: c1 }).v;
    ok('SIAddImageOp: other preset -> in-place operator on the clip (in and out)', fx && fx.type === 'blur' && fx.ports?.input === c1 && fx.ports?.output === c1 && c1.imageOps.length === nOps + 2, fx?.type);
    ok('SIAddImageOp: Clip not an image clip -> nothing', run('SIAddImageOp', { PresetObj: 'Presets/Blur.Preset', Clip: 'cube' }).v === undefined);

    // ================= SICreateImageClip / 2 / Default (one handler, modes 0 / 2 / 4)
    const lay = run('SIAddImageSource', { FileName: 'Pictures/layers.psd' }).v.Source; lay.set('NumberOfTracks', 3);
    const nl = props('imageclip').length;
    const r2 = run('SICreateImageClip2', { FileName: 'Pictures/layers.psd' });
    const cl = r2.v ?? [];
    ok('SICreateImageClip2: one clip per sub-image, first <file><ext>, then V<i>_<file>', J(cl.map(c => c.name)) === J(['layers_psd', 'V1_layers_psd', 'V2_layers_psd']), cl.map(c => c.name));
    ok('SICreateImageClip2: SourceTrack = i, all on the reused source', J(cl.map(c => c.val('SourceTrack'))) === J([0, 1, 2]) && cl.every(c => c.source === lay) && props('imageclip').length === nl + 3);
    const r2n = run('SICreateImageClip2', { FileName: 'Pictures/layers.psd', Name: 'L' });
    ok('SICreateImageClip2: with Name: V<i>_<Name> after the first (naming guard logged)', J((r2n.v ?? []).map(c => c.name)) === J(['L', 'V1_L', 'V2_L']) && nya(r2n), (r2n.v ?? []).map(c => c.name));
    const r0 = run('SICreateImageClip', { FileName: 'Pictures/layers.psd', Name: 'single' });
    ok('SICreateImageClip (mode 0): one clip, Clip out-argument', r0.v?.Clip?.name === 'single' && r0.v.Clip.val('SourceTrack') === 0);
    const r1 = run('SICreateImageClip2', { FileName: 'Pictures/flat.pic', Name: 'flat' });
    ok('SICreateImageClip2: single-image file -> one clip named Name', J((r1.v ?? []).map(c => c.name)) === J(['flat']));
    ok('SICreateImageClip2: shares the handler with SICreateImageClip / SICreateDefaultImageClip (modes 0 / 2 / 4)', J(Object.values(ST.modes).sort()) === J([0, 2, 3, 4]));
    ST.locked.clips = true; ok('SICreateImageClip2: locked clips container -> lock error', !!run('SICreateImageClip2', { FileName: 'Pictures/x.pic' }).err); ST.locked.clips = false;
    const u2 = A.undoStack.length; run('SICreateImageClip2', { FileName: 'Pictures/undo.pic' }); const nu = root.properties.length; A.undo();
    ok('SICreateImageClip2: undo removes clip and source', A.undoStack.length === u2 && root.properties.length === nu - 2, [nu, root.properties.length]);

    // ================= SIAddWritableImageSource
    const w = run('SIAddWritableImageSource', { FileName: 'Pictures/bake.pic', Name: 'bake' }).v?.Source;
    ok('SIAddWritableImageSource: writable source, Width / Height / Type stored', w?.type === 'writableimagesource' && w.name === 'bake' && w.val('XRes') === 256 && w.val('YRes') === 256 && w.val('ChannelType') === 1 && w.val('FileName') === 'Pictures/bake.pic');
    ok('SIAddWritableImageSource: UseExisting hands back the source of the same file (logged)', (() => { const r = run('SIAddWritableImageSource', { FileName: 'Pictures/BAKE.pic', UseExisting: true }); return r.v?.Source === w && nya(r); })());
    const w2 = run('SIAddWritableImageSource', { FileName: 'Pictures/bake.pic', Width: 512, Type: 3 }).v?.Source;
    ok('SIAddWritableImageSource: without UseExisting a new source', w2 && w2 !== w && w2.val('XRes') === 512 && w2.val('ChannelType') === 3);
    for (const [k, v] of [['Width', 0], ['Height', -1], ['Type', 7]]) {
      const n1 = props('writableimagesource').length; const r = run('SIAddWritableImageSource', { FileName: 'Pictures/bad.pic', [k]: v });
      ok(`SIAddWritableImageSource: ${k} ${v} -> stops, nothing created`, !r.err && r.v?.Source === null && props('writableimagesource').length === n1 && nya(r));
    }
    const nw = props('writableimagesource').length; A.undo(); ok('SIAddWritableImageSource: undo', props('writableimagesource').length === nw - 1);
    undoAll(u0);
    ok('image section: undo back to the start removes every source and clip', root.properties.length === props0 && !root.properties.includes(s1), root.properties.map(p => p.name));
  } catch (e) { ok('image section ran', false, String(e?.stack ?? e)); }

  // ================= model sources / clips
  try {
    const u0 = A.undoStack.length;
    const ms = run('SIAddModelSource', { FileName: 'Models/rig.emdl' }).v?.Source;
    ok('SIAddModelSource: default name ModelSource_<basename>, file for resolution 2, parameter 5 (active_resolution) 0', ms?.type === 'modelsource' && ms.name === 'ModelSource_rig' && ms.val('highres_path') === 'Models/rig.emdl' && ms.val('active_resolution') === 0 && ms.val('Resolution') === 2, ms?.name);
    const ms1 = run('SIAddModelSource', { FileName: 'Models/low.emdl', Name: 'lowSrc', Resolution: 1 }).v?.Source;
    ok('SIAddModelSource: Name and Resolution', ms1?.name === 'lowSrc' && ms1.val('Resolution') === 1 && ms1.val('mediumres_path') === 'Models/low.emdl' && ms1.val('highres_path') === '');
    ST.restrictedEdition = true; const rr = run('SIAddModelSource', { FileName: 'Models/x.emdl' }); ST.restrictedEdition = false;
    ok('SIAddModelSource: restricted edition -> message, no source', rr.v?.Source === null && rr.log.includes('Error: Creation of model source only available in Essentials and Advanced'));
    const mc = run('SICreateModelClip', { FileName: 'Models/hero.emdl' }).v?.Clip;
    ok('SICreateModelClip: clip ModelClip_<base> + new source ModelSource_<base>, resolution 2', mc?.type === 'modelclip' && mc.name === 'ModelClip_hero' && mc.source?.name === 'ModelSource_hero' && mc.val('resolution') === 2 && props('modelsource').includes(mc.source));
    const mn = run('SICreateModelClip', { FileName: 'Models/hero2.emdl', Name: 'H' }).v?.Clip;
    ok('SICreateModelClip: Name given, no source -> clip and new source both named Name', mn?.name === 'H' && mn.source?.name === 'H');
    ok('SICreateModelClip: empty FileName and no Source -> 0x80070057', status(run('SICreateModelClip', {}), '80070057'));
    const viaSrc = ST.createModelClip('', '', ms);
    ok('SICreateModelClip (optional Source): clip ModelClip_<source name>, no new source', viaSrc?.name === 'ModelClip_ModelSource_rig' && viaSrc.source === ms);
    let e1 = ''; try { ST.createModelClip('', '', ms); } catch (e) { e1 = String(e.message); }
    ok('SICreateModelClip: source already has a clip for resolution 2 -> message + 0x80070057', /already having a clip for this resolution/.test(e1) && /0x80070057/.test(e1), e1);
    let e2 = ''; try { ST.createModelClip('', '', ms1); } catch (e) { e2 = String(e.message); }
    ok('SICreateModelClip: source without a resolution-2 file -> message + 0x80070057', /invalid file path for this resolution/.test(e2) && /0x80070057/.test(e2), e2);
    const nr = root.properties.length; const ob = run('SIAddModelClip', { Source: ms, Name: 'x' });
    ok('SIAddModelClip: obsolete -> 0x80004005 + message, nothing created', status(ob, '80004005') && ob.log.includes('Obsolete command, to create a clip you have to change the model source resolution.') && root.properties.length === nr);
    undoAll(u0);
    ok('model section: undo', props('modelsource').length === 0 && props('modelclip').length === 0);
  } catch (e) { ok('model section ran', false, String(e?.stack ?? e)); }

  // ================= file-cache sources
  try {
    const u0 = A.undoStack.length; const mix = root.properties.find(p => p.type === 'mixer');
    const nClips = () => (root.properties.find(p => p.type === 'mixer')?.clips ?? []).length;
    const c0 = nClips();
    const f1 = run('AddFileCacheSource', { InputObj: [cube], FileName: 'Cache/cube_take1_1.icecache', DeployInMixer: false }).v?.Source;
    ok('AddFileCacheSource: source on the target\'s model, ObjectName = target, nothing in the mixer', f1?.type === 'filecachesource' && root.properties.includes(f1) && f1.val('ObjectName') === 'cube' && f1.val('FileName') === 'Cache/cube_take1_1.icecache' && nClips() === c0, f1?.name);
    const f2 = run('AddFileCacheSource', { InputObj: 'cube', FileName: 'Cache/cube_take1_1.icecache', DeployInMixer: true }).v?.Source;
    const mx = root.properties.find(p => p.type === 'mixer'); const last = mx?.clips?.at(-1);
    ok('AddFileCacheSource: DeployInMixer -> a clip on a new track at the source start frame', nClips() === c0 + 1 && last?.source === f2?.name && last.start === f2.val('FrameStart'), last);
    const sphere = A.scene.find('sphere');
    ok('demo scene has a sphere', !!sphere);
    if (sphere) {
      const g = run('AddFileCacheSource', { FileName: 'Cache/sphere_take1_5.icecache', DeployInMixer: false }).v?.Source;
      ok('AddFileCacheSource: no target -> guessed from the file name with the cache template ([object])', g?.val('ObjectName') === 'sphere', g?.val('ObjectName'));
    }
    const n0 = [...A.scene.allObjects()].length;
    const pc = run('AddFileCacheSource', { FileName: 'Cache/ghost_take1_1.icecache', DeployInMixer: false });
    const ghost = A.scene.find('ghost');
    ok('AddFileCacheSource: guessed object missing -> a point cloud is created as the target', ghost?.type === 'pointcloud' && [...A.scene.allObjects()].length === n0 + 1 && pc.v?.Source?.val('ObjectName') === 'ghost', [ghost?.type, pc.err]);
    ok('AddFileCacheSource: no target, no guess, no user session -> 0x80070057', status(run('AddFileCacheSource', { FileName: 'Cache/x.icecache' }), '80070057'));
    ok('AddFileCacheSource2: same handler, SourceObject use logged', (() => { const r = run('AddFileCacheSource2', { InputObj: [cube], FileName: 'Cache/cube_b.icecache', DeployInMixer: false, SourceObject: 'sphere' }); return r.v?.Source?.type === 'filecachesource' && nya(r); })());
    ok('AddFileCacheSource: no FileName -> 0x80004003', status(run('AddFileCacheSource', { InputObj: [cube] }), '80004003'));
    undoAll(u0);
    ok('file-cache section: undo', !root.properties.some(p => p.type === 'filecachesource') && !A.scene.find('ghost') && nClips() === c0);
    void mix;
  } catch (e) { ok('file-cache section ran', false, String(e?.stack ?? e)); }

  // ================= audio
  try {
    const u0 = A.undoStack.length;
    const au = run('ImportAudio', { Model: 'Scene_Root', FileName: 'C:\\audio\\voice.wav' }).v;
    ok('ImportAudio: audio source under the model, path <dir>\\<file>, empty Name -> file name', au?.type === 'audiosource' && root.properties.includes(au) && au.val('filename') === 'C:\\audio\\voice.wav' && au.name === 'voice_wav', au?.name);
    ok('ImportAudio: folder stored (Nle\\animmix\\audio)', ST.lastAudioFolder === 'C:\\audio');
    const au2 = run('ImportAudio', { Model: cube, FileName: 'C:\\audio\\music.wav', Name: 'music' }).v;
    ok('ImportAudio: Name names the source; an object -> its model', au2?.name === 'music' && root.properties.includes(au2));
    ok('ImportAudio: no Model -> 0x80004003', status(run('ImportAudio', { FileName: 'a.wav' }), '80004003'));
    ok('ImportAudio: no FileName -> 0x80004003', status(run('ImportAudio', { Model: 'Scene_Root' }), '80004003'));
    const clipsOf = () => root.properties.find(p => p.type === 'mixer')?.clips ?? [];
    const n0 = clipsOf().length;
    const ac = run('AddAudioClip', { Model: 'Scene_Root', Source: au, Time: 10 }).v;
    const tr = ac?.track;
    ok('AddAudioClip: no Track -> a new audio track; clip named after the source, start = Time', ac?.type === 'mixeraudioclip' && ac.name === 'voice_wav' && ac.start === 10 && clipsOf().length === n0 + 1 && clipsOf().filter(c => c !== ac).every(c => (c.track ?? 0) !== tr), ac);
    const hit = run('AddAudioClip', { Model: 'Scene_Root', Source: au, Track: tr, Time: 12 });
    ok('AddAudioClip: does not fit on the given track -> message + E_FAIL', status(hit, '80004005') && hit.log.some(l => /XSIMOAUDIO 0x6f|fit/i.test(l)) && clipsOf().length === n0 + 1, hit);
    const len = au.val('duration');
    const fit = run('AddAudioClip', { Model: 'Scene_Root', Source: 'voice_wav', Track: tr, Time: 10 + len, Name: 'second' }).v;
    ok('AddAudioClip: fits right after -> clip on the given track, Name', fit?.track === tr && fit.start === 10 + len && fit.name === 'second', fit);
    ST.lockedTracks.add(`${root.name}:${tr}`);
    ok('AddAudioClip: locked track -> 0x80070005', status(run('AddAudioClip', { Model: 'Scene_Root', Source: au, Track: tr, Time: 5000 }), '80070005'));
    ST.lockedTracks.clear();
    au2.set('SampleRate', 48000); ST.audioRateFixed = true; const nf = clipsOf().length;
    const fixed = run('AddAudioClip', { Model: 'Scene_Root', Source: au2, Time: 1 });
    ok('AddAudioClip: other rate while the scene rate is fixed -> message, no clip', !fixed.err && fixed.v === undefined && clipsOf().length === nf && fixed.log.some(l => /XSIMOAUDIO 0x70|fixed/i.test(l)), fixed);
    ST.audioRateFixed = false;
    const r48 = run('AddAudioClip', { Model: 'Scene_Root', Source: au2, Time: 1 }).v;
    ok('AddAudioClip: Project Audio Sample Rate set to the source rate', r48?.type === 'mixeraudioclip' && ST.projectAudioSampleRate === 48000);
    A.undo(); ok('AddAudioClip: undo restores the rate and removes the clip', ST.projectAudioSampleRate === 44100 && clipsOf().length === nf);
    const nn = clipsOf().length; const na = run('AddAudioClip', { Model: 'Scene_Root', Source: 'Mixer', Time: 1 });
    ok('AddAudioClip: Source not an audio source -> no clip', !na.err && na.v === undefined && clipsOf().length === nn, na);
    ok('AddAudioClip: no Source -> 0x80004003', status(run('AddAudioClip', { Model: 'Scene_Root', Time: 1 }), '80004003'));
    undoAll(u0);
    ok('audio section: undo', !root.properties.some(p => p.type === 'audiosource') && ST.lastAudioFolder === '');
  } catch (e) { ok('audio section ran', false, String(e?.stack ?? e)); }

  // ================= the CMD-B6b script wrappers now reach these low-level commands
  try {
    const S = A.uixsiClipsDisplayAddons; const u0 = A.undoStack.length;
    const r = A.run('CreateImageClip2', { FileName: 'Pictures/wrap.pic', Name: 'wrapClip' });
    ok('CreateImageClip2 (script) -> SICreateImageClip2 on the bus', Array.isArray(r) && r[0]?.name === 'wrapClip' && S.calls.at(-1)?.command === 'SICreateImageClip2' && S.calls.at(-1)?.ran === true);
    const s = A.run('AddImageSource', { FileName: 'Pictures/wrap2.pic', Name: 'wrapSrc' });
    ok('AddImageSource (script) -> SIAddImageSource, source selected', s?.name === 'wrapSrc' && A.selection[0] === s);
    undoAll(u0);
  } catch (e) { ok('wrapper section ran', false, String(e?.stack ?? e)); }
  A.Interactive = true;
  return out;
}, { NAMES, DEFAULT_STATUS });
await browser.close();

// ------------------------------------------------------------------ report
let checks = 0; const fails = [];
const eq = (what, a, b) => { checks++; const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) fails.push(`${what}: got ${x}, want ${y}`); };
for (const n of NAMES) {
  checks++; if (!registry[n]) fails.push(`${n}: no catalogue entry`);
  eq(`${n}: arguments`, got.reg[n], registry[n]);
  checks++; if (!['ok', 'expected-failure'].includes(got.defaults[n])) fails.push(`${n}: default run: ${got.defaults[n]}`);
}
for (const [name, pass, detail] of got.checks) { checks++; if (!pass) fails.push(`${name}${detail ? ` (${detail})` : ''}`); }
checks++; if (pageErrors.length) fails.push(`page errors: ${pageErrors.join(' | ')}`);

console.log(`default runs     : ${NAMES.map(n => `${n}=${got.defaults[n]}`).join(', ')}`);
console.log(`fully wired      : ${STATUS.full.join(', ')}`);
console.log(`partly wired     : ${STATUS.partly.join('; ')}  (the open parts log "not yet attested")`);
if (fails.length) { console.log(`FAIL clips/sources B15d commands: ${fails.length} of ${checks} checks`); for (const f of fails) console.log('  ' + f); process.exit(1); }
console.log(`PASS clips/sources B15d commands: ${checks} checks`);
