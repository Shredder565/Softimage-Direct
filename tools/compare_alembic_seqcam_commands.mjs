// CMD-01e + CMD-19a: the Alembic import / export commands and the Camera Sequencer plot commands on the
// command bus. Checked against the "Wire contract" of docs/ghidra/cmd-01e-alembic.md and
// docs/ghidra/cmd-19a-seqcam.md and the registry dump data/commands_full.json. No XSIBATCH golden exists for
// either row, so this is a contract check. The parts the notes leave open (the Alembic framework, the
// sequencer plot, the cache commands) are driven through the seams `app.alembic` / `app.seqCam` and through
// stand-in commands registered for the duration of a check.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_alembic_seqcam_commands.mjs
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

const ABC = ['AbcVer', 'AbcImport', 'AbcExport', 'OnAbcImportMenu', 'OnAbcExportMenu'];
const SEQ = ['PlotSequencerCamera', 'PlotCamSeqForCachedObjects', 'ApplyCamSeqFileCacheSources'];
const NAMES = [...ABC, ...SEQ];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => (x.scripting_name || x.name) === n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('AbcVer') && !!window.Application?.commands?.get('GetGlobal'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const A = app.alembic; const S = app.seqCam;
  const out = {};
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: v === undefined ? '<none>' : v }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status === undefined ? null : e.status.toString(16) }; } };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const tick = () => new Promise(r => setTimeout(r, 40));
  const settle = (p) => Promise.resolve(p).then(() => 'ok', e => `rejected:${e?.status === undefined ? String(e?.message ?? e) : e.status.toString(16)}`);
  const rootProp = (n) => app.scene.root.properties.find(p => p.name === n);
  const names = (l) => l.map(o => o?.fullName ?? o?.name ?? o);
  const C_CACHE = 'CacheObjectsIntoFile' + '_Private', C_ADDSRC = 'AddFileCache' + 'Source';
  /** Register a stand-in command for the duration of `f`. */
  const withCommand = async (def, f) => { const old = app.commands.get(def.name); app.commands.set(def.name, def); try { return await f(); } finally { if (old) app.commands.set(def.name, old); else app.commands.delete(def.name); } };

  // ---- modal helpers
  const win = () => [...document.querySelectorAll('.sdkh-modal-window')].pop() ?? null;
  const winCount = () => document.querySelectorAll('.sdkh-modal-window').length;
  const title = () => win()?.querySelector('.ppg-float-title')?.textContent ?? null;
  const click = async (sel) => { win().querySelector(sel).click(); await tick(); };
  const okBtn = () => click('.sdkh-modal-ok'), cancelBtn = () => click('.sdkh-modal-cancel');
  const describe = (host) => [...host.querySelectorAll(':scope > *')].flatMap(el => {
    if (el.classList.contains('abc-group')) return [`group:${el.dataset.group}=${describe(el).join(',')}`];
    if (el.classList.contains('abc-row')) return [`${el.dataset.param}/${el.dataset.control}/${el.querySelector('label').textContent}`];
    if (el.classList.contains('abc-button')) return [`button:${el.dataset.button}/${el.textContent}`];
    if (el.classList.contains('abc-static')) return [`text:${el.textContent}`];
    return [];
  });
  const content = () => win().querySelector('.sdkh-modal-content');
  const browserState = () => { const c = content(); return { title: title(), mode: c.dataset.mode, filter: c.dataset.filter, dir: c.querySelector('.abc-browse-dir input').value, name: c.querySelector('.abc-browse-name input').value }; };
  const typeName = (v) => { content().querySelector('.abc-browse-name input').value = v; };

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.seams = [A.framework, S.plot, S.cacheClipsAndObjects, S.frameList];

  app.run('NewScene', {});
  const objCount = () => [...app.scene.allObjects()].length;

  // ================= default arguments, batch mode, no framework / sequencer
  app.Interactive = false;
  out.defaults = {};
  for (const n of NAMES) { const m = mark(); const c = objCount(); const r = run(n); out.defaults[n] = { r, log: logFrom(m).filter(l => !l.startsWith('error:' + n + ':')), objects: objCount() - c }; }
  out.defaultsOptionProps = [!!rootProp('ImportAbcOptions'), !!rootProp('ExportAbcOptions')];

  // ================= Alembic with a stand-in framework
  const calls = [];
  let failAt = null; let exportResult = { ok: true };
  A.framework = {
    version: '1.2.3', description: 'Alembic 9.9 (stand-in)',
    createImporter: () => {
      const step = (name) => (...args) => { calls.push([name, ...args.map(x => x?.name ?? x)]); return failAt !== name; };
      return { open: step('open'), setAnimationOptions: step('anim'), setAnimationImportMode: step('mode'), setPadShapeClips: step('pad'), setCreateModel: step('model'), setParent: step('parent'), setCreateICETreeMode: step('ice'), run: step('run') };
    },
    createExporter: (file, hier, type) => { calls.push(['create', file, hier, type]); return {
      setAttributes: (...a) => { calls.push(['attrs', ...a]); },
      export: (objs, s, e) => { calls.push(['export', objs.map(o => o.name), s, e]); return exportResult; },
    }; },
  };
  const taken = () => calls.splice(0);
  {
    const m = mark(); out.ver = [run('AbcVer'), logFrom(m)];
  }
  {
    const I = {};
    app.select([]);
    let m = mark();
    I.def = [run('AbcImport', { FilePathName: 'C:\\abc\\in.abc' }), taken(), logFrom(m)];
    const cube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'abcCube' });
    const nul = app.run('GetPrim', { PresetObj: 'Null', Name: 'abcNull' });
    app.select([cube]);
    run('AbcImport', { FilePathName: 'f.abc' }); I.parentSelected = taken().find(c => c[0] === 'parent');
    run('AbcImport', { FilePathName: 'f.abc', Parent: nul }); I.parentObject = taken().find(c => c[0] === 'parent');
    run('AbcImport', { FilePathName: 'f.abc', Parent: 'abcNull' }); I.parentName = taken().find(c => c[0] === 'parent');
    I.allArgs = [run('AbcImport', { FilePathName: 'g.abc', ImportAnimation: false, StartTime: 3, EndTime: 9, PadShapeClips: false, FitTimeRange: 2, AnimationImportMode: 1, Parent: nul, CreateModel: true, CreateICETreeMode: 1 }), taken()];
    I.failures = {};
    for (const s of ['open', 'anim', 'mode', 'pad', 'model', 'parent', 'ice', 'run']) { failAt = s; const r = run('AbcImport', { FilePathName: 'f.abc' }); I.failures[s] = [r, taken().map(c => c[0]).join('>')]; }
    failAt = null;
    m = mark(); I.badFit = [run('AbcImport', { FitTimeRange: 3 }), run('AbcImport', { FitTimeRange: -1 }), logFrom(m), taken().length];
    m = mark(); I.badMode = [run('AbcImport', { AnimationImportMode: 2 }), run('AbcImport', { AnimationImportMode: -1 }), logFrom(m), taken().length];
    out.imp = I;

    const E = {};
    m = mark();
    E.def = [run('AbcExport', { FilePathName: 'C:\\abc\\out.abc' }), taken(), logFrom(m)];
    E.full = [run('AbcExport', { FilePathName: 'o.abc', StartFrame: 2, EndFrame: 7, InputObjs: [cube, nul], IncludeParentHier: true, Storage: 'hdf5', AttributesPointcloud: 'Color', AttributesPolymesh: 'Materials', AttributesOtherPrim: 'X' }), taken()];
    E.byName = [run('AbcExport', { FilePathName: 'o.abc', InputObjs: 'abcCube,abcNull', Storage: 'OGAWA' }), taken()];
    E.badStorage = [run('AbcExport', { Storage: 'Zip' }), taken()];
    E.range = [run('AbcExport', { StartFrame: 0 }), run('AbcExport', { EndFrame: 101 }), run('AbcExport', { StartFrame: 8, EndFrame: 7 }), run('AbcExport', { StartFrame: 1, EndFrame: 1 }), run('AbcExport', { StartFrame: 100, EndFrame: 100 }), taken().filter(c => c[0] === 'export').length];
    exportResult = { ok: true, notExported: ['Foo', 'Bar'] };
    m = mark(); E.notExported = [run('AbcExport', {}), logFrom(m)]; taken();
    exportResult = { ok: false, notExported: ['Baz'] };
    m = mark(); E.failed = [run('AbcExport', {}), logFrom(m).filter(l => l.startsWith('info:'))]; taken();
    exportResult = { ok: true };
    out.exp = E;
  }

  // ================= menu commands, interactive
  app.Interactive = true;
  {
    const M = {};
    for (const n of ['ImportAbcOptions', 'ExportAbcOptions']) { const p = rootProp(n); if (p) app.scene.root.removeProperty(p); }
    A.lastImportDir = ''; A.lastExportDir = '';
    const w0 = winCount();
    // --- import: options page first
    let m = mark();
    let p = app.run('OnAbcImportMenu', {}); await tick();
    const prop = rootProp('ImportAbcOptions');
    M.promise = typeof p?.then === 'function';
    M.prop = prop ? { type: prop.type, parent: prop.parent === app.scene.root, params: prop.params.map(x => [x.name, x.def.type, x.value, x.label]), items: prop.get('CreateICETreeMode').def.items } : null;
    M.optionsPage = [title(), describe(content()), [...content().querySelectorAll('select option')].map(o => o.textContent)];
    await cancelBtn();
    M.cancel = [await settle(p), winCount() - w0, logFrom(m).filter(l => l.startsWith('error:'))];
    // --- options OK, then the browser; empty result
    p = app.run('OnAbcImportMenu', {}); await tick();
    M.propReused = rootProp('ImportAbcOptions') === prop;
    content().querySelector('[data-param="CreateModel"] input').click();
    { const s = content().querySelector('[data-param="CreateICETreeMode"] select'); s.value = '1'; s.dispatchEvent(new Event('change')); }
    await okBtn();
    M.browser = browserState(); M.projectPath = A.projectPath;
    m = mark();
    await okBtn();
    M.emptyResult = [await settle(p), logFrom(m), A.lastImportDir, calls.length];
    // --- pick a file: AbcImport runs with the options, directory remembered
    p = app.run('OnAbcImportMenu', {}); await tick(); await okBtn();
    typeName('shot.abc'); m = mark(); await okBtn();
    M.picked = [await settle(p), logFrom(m).filter(l => l.startsWith('cmd:')), taken(), A.lastImportDir];
    // --- next time: remembered directory; an absolute file name is taken as is; browser cancel
    p = app.run('OnAbcImportMenu', {}); await tick(); await okBtn();
    M.remembered = browserState().dir;
    typeName('D:\\other\\b.abc'); await okBtn();
    M.absolute = [await settle(p), taken().find(c => c[0] === 'open'), A.lastImportDir];
    p = app.run('OnAbcImportMenu', {}); await tick(); await okBtn(); await cancelBtn();
    M.browserCancel = [await settle(p), taken().length];
    // --- file name given: options page still first, no browser, directory not touched
    p = app.run('OnAbcImportMenu', { FilePathName: 'E:\\given\\g.abc' }); await tick();
    M.givenFirst = title();
    await okBtn();
    M.given = [await settle(p), winCount() - w0, taken().find(c => c[0] === 'open'), A.lastImportDir];
    p = app.run('OnAbcImportMenu', { FilePathName: 'E:\\given\\g.abc' }); await tick(); await cancelBtn();
    M.givenCancel = [await settle(p), taken().length];
    // --- AbcImport false -> failure
    failAt = 'run'; m = mark();
    p = app.run('OnAbcImportMenu', { FilePathName: 'E:\\given\\g.abc' }); await tick(); await okBtn();
    M.importFails = [await settle(p), (await tick(), logFrom(m).filter(l => l.startsWith('error:')).length)]; failAt = null; taken();
    out.importMenu = M;

    // --- export
    const X = {};
    app.anim.startFrame = 5; app.anim.endFrame = 50;
    const cube = app.scene.find('abcCube'), nul = app.scene.find('abcNull');
    app.select([cube, nul]);
    p = app.run('OnAbcExportMenu', {}); await tick();
    const xp = rootProp('ExportAbcOptions');
    X.prop = xp ? { type: xp.type, parent: xp.parent === app.scene.root, params: xp.params.map(x => [x.name, x.def.type, x.value, x.label]) } : null;
    X.viewSize = [A.exportViewSize, xp.viewSize, content().dataset.viewHeight ?? null];
    X.page = [title(), describe(content()), [...content().querySelectorAll('select option')].map(o => o.textContent)];
    await click('[data-button="ClearAttributesPointcloud"]'); await click('[data-button="ClearAttributesPolymesh"]');
    xp.set('IncludeAttributesOtherPrim', 'Something');
    await click('[data-button="ClearAttributesOtherPrim"]');
    X.cleared = [xp.val('IncludeAttributesPointcloud'), xp.val('IncludeAttributesPolymesh'), xp.val('IncludeAttributesOtherPrim'), content().querySelector('[data-param="IncludeAttributesPointcloud"] input').value];
    await click('[data-button="AddDefaultAttributesPointcloud"]'); await click('[data-button="AddDefaultAttributesPolymesh"]');
    X.restored = [xp.val('IncludeAttributesPointcloud'), xp.val('IncludeAttributesPolymesh')];
    await cancelBtn();
    X.cancel = [await settle(p), calls.length];
    p = app.run('OnAbcExportMenu', {}); await tick();
    xp.set('IncludeParentHier', true); xp.set('ArchiveFormat', 'HDF5'); xp.set('StartFrame', 6); xp.set('EndFrame', 40); xp.set('IncludeAttributesOtherPrim', 'Foo');
    await okBtn();
    X.browser = browserState();
    await okBtn();
    X.emptyResult = [await settle(p), calls.length, A.lastExportDir];
    p = app.run('OnAbcExportMenu', {}); await tick(); await okBtn();
    typeName('cache.abc'); m = mark(); await okBtn();
    X.selFull = names([cube, nul]).join(',');
    X.picked = [await settle(p), logFrom(m).filter(l => l.startsWith('cmd:')), taken(), A.lastExportDir, A.lastImportDir];
    p = app.run('OnAbcExportMenu', {}); await tick(); await okBtn();
    X.remembered = browserState().dir; await cancelBtn(); await settle(p);
    // --- a stale range fails after the file was chosen
    app.anim.startFrame = 10;
    p = app.run('OnAbcExportMenu', {}); await tick(); await okBtn(); typeName('late.abc'); await okBtn();
    X.stale = [await settle(p), taken().length, xp.val('StartFrame')];
    app.anim.startFrame = 1; app.anim.endFrame = 100;
    // --- export failure
    exportResult = { ok: false };
    xp.set('StartFrame', 1); xp.set('EndFrame', 100);
    p = app.run('OnAbcExportMenu', {}); await tick(); await okBtn(); typeName('bad.abc'); await okBtn();
    X.exportFails = await settle(p); exportResult = { ok: true }; taken();
    X.windowsLeft = winCount() - w0;
    out.exportMenu = X;
  }
  A.framework = null;

  // ================= Camera Sequencer
  app.Interactive = false;
  {
    const Q = {};
    Q.invalid = [run('PlotSequencerCamera', { SequenceIn: 10, SequenceOut: 10 }), run('PlotSequencerCamera', { SequenceIn: 10, SequenceOut: 5 }), run('PlotSequencerCamera', { ActionName: '' }), run('PlotSequencerCamera', { CameraName: '' })].map(r => r.status);
    const seen = [];
    S.plot = (req) => { seen.push(req); return { curves: { 'kine.local.posx': [{ time: req.sequenceIn, value: 1 }, { time: req.sequenceOut, value: 4 }], 'kine.local.roty': [{ time: req.sequenceIn, value: 0 }, { time: req.sequenceOut, value: 90 }], 'camera.fov': [{ time: req.sequenceIn, value: 30 }, { time: req.sequenceOut, value: 60 }] }, constants: { 'camera.near': 0.5, 'camera.far': 2000 } }; };
    const keys = (p) => (app.anim.fcurve(p)?.keys ?? []).map(k => [k.time, k.value]);
    const sources = () => app.scene.root.properties.filter(p => p.type === 'actionsource').map(p => p.name);
    const clipsOf = () => (app.scene.root.properties.find(p => p.type === 'mixer')?.clips ?? []);
    let c0 = objCount(); let m = mark();
    let r = app.run('PlotSequencerCamera', { SequenceIn: 3, SequenceOut: 20, PlotWithoutGaps: true });
    let cam = r?.[0];
    Q.apply = {
      list: Array.isArray(r) ? r.length : null, name: cam?.name, type: cam?.type, parent: cam?.parentObj === app.scene.root, children: cam?.children.length, added: objCount() - c0,
      req: seen.splice(0), posx: keys(cam.kinematics.local.get('posx')), roty: keys(cam.kinematics.local.get('roty')), fov: keys(cam.primitive.get('fov')),
      near: cam.primitive.val('near'), far: cam.primitive.val('far'), sources: sources(), clips: clipsOf().length, selected: names(app.selection),
      cmd: logFrom(m).filter(l => l.startsWith('cmd:')),
    };
    app.undo();
    Q.applyUndo = [objCount() - c0, sources()];
    c0 = objCount();
    r = app.run('PlotSequencerCamera', { SequenceIn: 7, SequenceOut: 30, ActionName: 'MyPlot', CameraName: 'MyCam', ApplyToCamera: false });
    cam = r?.[0]; const clip = r?.[1];
    Q.clip = {
      list: Array.isArray(r) ? r.length : null, name: cam?.name, added: objCount() - c0, req: seen.splice(0), sources: sources(),
      clip: clip ? { name: clip.name, source: clip.source, start: clip.start } : null, inMixer: clipsOf().includes(clip), near: cam.primitive.val('near'),
      posxKeys: keys(cam.kinematics.local.get('posx')).length,
    };
    // empty plot from the sequencer: notice, abort, nothing left behind
    S.plot = () => ({ curves: {}, constants: {} });
    c0 = objCount(); m = mark();
    Q.empty = [run('PlotSequencerCamera', { CameraName: 'Nothing' }).status, objCount() - c0, !!app.scene.find('Nothing'), logFrom(m).some(l => /^info:not yet attested: .*notice/.test(l)), typeof S.lastNotice];
    S.plot = null;
    out.plot = Q;

    // ---- PlotCamSeqForCachedObjects
    const K = {};
    K.invalid = [run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache', SequenceIn: 5, SequenceOut: 5 }), run('PlotCamSeqForCachedObjects', { Path: '' }), run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache.icecache' })].map(x => x.status);
    K.noObjects = run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache' });
    const cube = app.scene.find('abcCube'), nul = app.scene.find('abcNull');
    const fileClips = [{ name: 'cacheClipA' }, { name: 'cacheClipB' }];
    S.cacheClipsAndObjects = () => ({ clips: fileClips, objects: [cube, nul] });
    m = mark();
    K.noFrames = [run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache' }).status, logFrom(m).filter(l => !l.startsWith('error:PlotCamSeq')).length];
    const frameReq = [];
    S.frameList = (a, b, g) => { frameReq.push([a, b, g]); return [11, 12, 13, 21, 22]; };
    const hadCache = app.commands.has(C_CACHE);
    if (!hadCache) K.noCommand = run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache' });
    frameReq.splice(0);
    let cacheArgs = null;
    const cacheDef = { name: C_CACHE, undoable: false, args: ['ObjectsToCache', 'PathID', 'FirstFrame', 'LastFrame', 'FramesPerStep', 'Overwrite', 'ShowProgressbar', 'Attributes', 'Version', 'AlternativePath', 'KineAnimation', 'Type', 'FrameSet', 'TargetCacheObjects', 'ResolvedPath'].map(name => ({ name })),
      execute: (_a, a) => { cacheArgs = Object.values(a).map(v => Array.isArray(v) ? v.map(x => x?.name ?? x) : v === undefined ? '<unset>' : v); return String(a.AlternativePath).replace('_#', '_' + a.FirstFrame); } };
    await withCommand(cacheDef, async () => {
      const res = run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache', SequenceIn: 4, SequenceOut: 9, PlotWithoutGaps: true, Attributes: 'Color,Size', UseGlobalKine: false });
      K.ok = [res.v?.[0], res.v?.[1], res.v?.[2] === fileClips, res.err ?? null]; K.args = cacheArgs; K.frameReq = frameReq.splice(0);
      K.resultToApply = res.v ? [typeof res.v[0], res.v.length] : null;
    });
    await withCommand({ ...cacheDef, execute: () => { throw new Error('cache failed'); } }, async () => { K.cacheFails = run('PlotCamSeqForCachedObjects', { Path: 'C:\\c\\cache_#.icecache' }).err; });
    S.cacheClipsAndObjects = null; S.frameList = null;
    out.cache = K;

    // ---- ApplyCamSeqFileCacheSources
    const P = {};
    P.invalid = [run('ApplyCamSeqFileCacheSources', { ObjectsToApply: '', CacheFilePaths: 'a' }), run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'a', CacheFilePaths: '' }), run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'a,b', CacheFilePaths: 'p' })].map(x => x.status);
    const mix = app.scene.root.properties.find(p => p.type === 'mixer');
    const addClip = (n) => { const c = { name: n, source: n, start: 1, duration: 10, track: 0 }; mix.clips.push(c); return c; };
    const hadSrc = app.commands.has(C_ADDSRC);
    if (!hadSrc) { const c = addClip('fc0'); const r0 = run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'abcCube', CacheFilePaths: 'C:\\c\\a_[1..5].icecache', ClipsToDelete: [c] }); P.noCommand = [r0.err ?? null, r0.status, mix.clips.includes(c)]; if (mix.clips.includes(c)) mix.clips.splice(mix.clips.indexOf(c), 1); }
    const applied = []; let failOn = null;
    const srcDef = { name: C_ADDSRC, undoable: false, args: ['InputObj', 'FileName', 'DeployInMixer', 'Source'].map(name => ({ name })), execute: (_a, a) => { if (a.InputObj === failOn) throw new Error('no such object'); applied.push([a.InputObj, a.FileName, a.DeployInMixer === undefined, a.Source === undefined]); } };
    await withCommand(srcDef, async () => {
      const c1 = addClip('fc1'), c2 = addClip('fc2'), keep = addClip('keepMe');
      const before = mix.clips.length;
      P.ok = [run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'abcCube,abcNull', CacheFilePaths: 'C:\\c\\a_[1..5].icecache,C:\\c\\b_[1..5].icecache', ClipsToDelete: [c1, 'fc2'] }), applied.splice(0), before - mix.clips.length, mix.clips.includes(c1) || mix.clips.includes(c2), mix.clips.includes(keep)];
      P.noClips = [run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'abcCube', CacheFilePaths: 'p1' }), applied.splice(0)];
      failOn = 'second';
      P.stopAtFailure = [run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'first,second,third', CacheFilePaths: 'p1,p2,p3' }).err, applied.splice(0).map(x => x[0])];
      failOn = null;
      P.clipFailure = [run('ApplyCamSeqFileCacheSources', { ObjectsToApply: 'abcCube', CacheFilePaths: 'p1', ClipsToDelete: ['no_such_clip'] }).status, applied.splice(0).length];
      mix.clips.splice(mix.clips.indexOf(keep), 1);
    });
    out.applyCache = P;
  }
  app.Interactive = true;
  return out;
}, { NAMES });

await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const V = (v) => ({ v });
const NONE = V('<none>');
const ABORT = '80004004', FAIL = '80004005', INVALID = '80070057', UNEXPECTED = '8000ffff';

// 1. registration against the registry dump
for (const n of NAMES) {
  ok(`${n}: in the registry dump`, !!registry[n], registry[n]);
  eq(`${n}: registered with the registry's arguments and defaults`, got.reg[n], registry[n]);
}
eq('seams are empty in this build (no Alembic framework, no Camera Sequencer)', got.seams, [null, null, null, null]);

// 2. default arguments
const D = got.defaults;
eq('AbcVer defaults: no return value, status OK', D.AbcVer.r, NONE);
ok('AbcVer without a framework: the loader message, version texts not yet attested (Q1)', D.AbcVer.log.length === 2 && /^info:Unable to load the Alembic Framwork library \(not yet attested: /.test(D.AbcVer.log[0]), D.AbcVer.log);
eq('AbcImport defaults: returns false, does not raise', D.AbcImport.r, V(false));
ok('AbcImport defaults: logs "AbcImport_Execute called", then archive reading not yet attested (SYS-03)', D.AbcImport.log[0] === 'info:AbcImport_Execute called' && /^info:not yet attested: reading an Alembic archive/.test(D.AbcImport.log[1] ?? ''), D.AbcImport.log);
ok('AbcExport defaults: passes validation, then fails at the exporter (not yet attested, SYS-03)', D.AbcExport.r.status === FAIL && /not yet attested: writing an Alembic archive/.test(D.AbcExport.r.err ?? ''), D.AbcExport.r);
eq('AbcExport defaults: logs "AbcExport_Execute called" first', D.AbcExport.log[0], 'info:AbcExport_Execute called');
ok('OnAbcImportMenu in batch: refused (needs an interactive session)', /interactive session/.test(D.OnAbcImportMenu.r.err ?? ''), D.OnAbcImportMenu.r);
ok('OnAbcExportMenu in batch: refused (needs an interactive session)', /interactive session/.test(D.OnAbcExportMenu.r.err ?? ''), D.OnAbcExportMenu.r);
eq('batch refusals create no option property', got.defaultsOptionProps, [false, false]);
eq('PlotSequencerCamera defaults, no sequencer: empty plot, aborted (0x80004004), no camera left', [D.PlotSequencerCamera.r.status, D.PlotSequencerCamera.objects], [ABORT, 0]);
ok('PlotSequencerCamera defaults: the notice is logged as not yet attested (Q1, Q2)', D.PlotSequencerCamera.log.some(l => /^info:not yet attested: sequencer camera plot/.test(l)), D.PlotSequencerCamera.log);
eq('PlotCamSeqForCachedObjects defaults (no Path): invalid argument', D.PlotCamSeqForCachedObjects.r.status, INVALID);
eq('ApplyCamSeqFileCacheSources defaults (empty lists): invalid argument', D.ApplyCamSeqFileCacheSources.r.status, INVALID);

// 3. AbcVer / AbcImport / AbcExport with a framework
eq('AbcVer: "Using Alembic Framework <version> with <description>"', got.ver, [NONE, ['info:Using Alembic Framework 1.2.3 with Alembic 9.9 (stand-in)', 'cmd:AbcVer ']]);
const I = got.imp;
eq('AbcImport: true when every step succeeds; steps in contract order with the registered defaults; parent = scene root without a selection', [I.def[0], I.def[1]],
  [V(true), [['open', 'C:\\abc\\in.abc'], ['anim', true, -1, -1, 0], ['mode', 0], ['pad', true], ['model', false], ['parent', 'Scene_Root'], ['ice', 0], ['run']]]);
eq('AbcImport: logs "AbcImport_Execute called"', I.def[2][0], 'info:AbcImport_Execute called');
eq('AbcImport parent: first selected object / object argument / object name', [I.parentSelected, I.parentObject, I.parentName], [['parent', 'abcCube'], ['parent', 'abcNull'], ['parent', 'abcNull']]);
eq('AbcImport: every argument is handed on', I.allArgs, [V(true), [['open', 'g.abc'], ['anim', false, 3, 9, 2], ['mode', 1], ['pad', false], ['model', true], ['parent', 'abcNull'], ['ice', 1], ['run']]]);
eq('AbcImport: stops at the first failing step, returns false, does not raise', I.failures, {
  open: [V(false), 'open'], anim: [V(false), 'open>anim'], mode: [V(false), 'open>anim>mode'], pad: [V(false), 'open>anim>mode>pad'], model: [V(false), 'open>anim>mode>pad>model'],
  parent: [V(false), 'open>anim>mode>pad>model>parent'], ice: [V(false), 'open>anim>mode>pad>model>parent>ice'], run: [V(false), 'open>anim>mode>pad>model>parent>ice>run'],
});
ok('AbcImport FitTimeRange outside 0..2: "Invalid FitTimeRange argument", 0x80004005, importer untouched', I.badFit[0].status === FAIL && I.badFit[1].status === FAIL && I.badFit[2].filter(l => l === 'error:Invalid FitTimeRange argument').length === 2 && !I.badFit[2].includes('info:AbcImport_Execute called') && I.badFit[3] === 0, I.badFit);
ok('AbcImport AnimationImportMode outside 0..1: "Invalid AnimationImportMode argument", 0x80004005', I.badMode[0].status === FAIL && I.badMode[1].status === FAIL && I.badMode[2].filter(l => l === 'error:Invalid AnimationImportMode argument').length === 2 && I.badMode[3] === 0, I.badMode);
const E = got.exp;
eq('AbcExport defaults: true; Ogawa = archive type 1; empty attribute lists; no objects; frames 1..100', [E.def[0], E.def[1]], [V(true), [['create', 'C:\\abc\\out.abc', false, 1], ['attrs', '', '', ''], ['export', [], 1, 100]]]);
eq('AbcExport: logs "AbcExport_Execute called"', E.def[2][0], 'info:AbcExport_Execute called');
eq('AbcExport: "hdf5" (any case) = archive type 0; every argument handed on', E.full, [V(true), [['create', 'o.abc', true, 0], ['attrs', 'Color', 'Materials', 'X'], ['export', ['abcCube', 'abcNull'], 2, 7]]]);
eq('AbcExport: "OGAWA" accepted; InputObjs as a name list', E.byName, [V(true), [['create', 'o.abc', false, 1], ['attrs', '', '', ''], ['export', ['abcCube', 'abcNull'], 1, 100]]]);
eq('AbcExport: unknown Storage is an invalid argument, nothing created', [E.badStorage[0].status, E.badStorage[1]], [INVALID, []]);
eq('AbcExport: In <= StartFrame <= EndFrame <= Out, otherwise invalid argument (not clamped)', [E.range[0].status, E.range[1].status, E.range[2].status, E.range[3], E.range[4], E.range[5]], [INVALID, INVALID, INVALID, V(true), V(true), 2]);
eq('AbcExport: one "Attribute not exported" line per attribute', [E.notExported[0], E.notExported[1].filter(l => /Attribute not exported/.test(l))], [V(true), ['info:Attribute not exported: Foo', 'info:Attribute not exported: Bar']]);
eq('AbcExport: a failed export raises (0x80004005), after its attribute lines', [E.failed[0].status, E.failed[1]], [FAIL, ['info:AbcExport_Execute called', 'info:Attribute not exported: Baz']]);

// 4. OnAbcImportMenu
const M = got.importMenu;
eq('OnAbcImportMenu returns a Promise (modal pages)', M.promise, true);
eq('ImportAbcOptions: created under the scene root with the contract parameters', M.prop, { type: 'ImportAbcOptions', parent: true,
  params: [['CreateModel', 'bool', false, 'Import under newly created Model'], ['CreateICETreeMode', 'enum', 0, 'Create ICETree per Object or single one to drive all Objects']],
  items: [{ label: 'Multiple - One per Object', value: 0 }, { label: 'Single - One driving all Objects', value: 1 }] });
eq('options page: title "Alembic Import", group Options, check box and combo', M.optionsPage, ['Alembic Import', ['group:Options=CreateModel/bool/Import under newly created Model,CreateICETreeMode/enum/ICE Trees for Importing'], ['Multiple - One per Object', 'Single - One driving all Objects']]);
eq('options Cancel: aborted (0x80004004), no browser, no error line', M.cancel, [`rejected:${ABORT}`, 0, []]);
eq('the option property is found by name the second time', M.propReused, true);
eq('file browser: Open, title, filter, empty base name, initial directory = project path', M.browser, { title: 'Alembic Import', mode: 'open', filter: 'Alembic Files(*.abc)|*.abc||', dir: M.projectPath, name: '' });
eq('empty browser result: status OK, nothing imported, no directory remembered', M.emptyResult, ['ok', [], '', 0]);
eq('picked file: AbcImport with the file and CreateModel / CreateICETreeMode from the property, other arguments at their defaults; directory remembered', M.picked, ['ok',
  [`cmd:AbcImport "${M.projectPath}\\shot.abc", true, -1, -1, true, 0, 0, "SingleObj", true, 1`],
  [['open', `${M.projectPath}\\shot.abc`], ['anim', true, -1, -1, 0], ['mode', 0], ['pad', true], ['model', true], ['parent', 'abcCube'], ['ice', 1], ['run']], M.projectPath]);
eq('next browser starts in the remembered directory', M.remembered, M.projectPath);
eq('picked directory replaces the remembered one', M.absolute, ['ok', ['open', 'D:\\other\\b.abc'], 'D:\\other']);
eq('browser Cancel: status OK, nothing imported', M.browserCancel, ['ok', 0]);
eq('FilePathName given: the options page still comes first', M.givenFirst, 'Alembic Import');
eq('FilePathName given: no browser, file imported, remembered directory untouched', M.given, ['ok', 0, ['open', 'E:\\given\\g.abc'], 'D:\\other']);
eq('FilePathName given, options Cancel: aborted, nothing imported', M.givenCancel, [`rejected:${ABORT}`, 0]);
eq('AbcImport returned false: 0x80004005, logged', M.importFails, [`rejected:${FAIL}`, 1]);

// 5. OnAbcExportMenu
const X = got.exportMenu;
const PC = 'Color, Scale, Size, PointVelocity, Orientation, AngularVelocity, Shape, StrandPosition, StrandVelocity, StrandDeform, StrandOrientation, StrandUpVector, StrandColor, StrandSize, ColorAlongStrands';
const PM = 'Materials, MaterialID, PointUserMotions';
eq('ExportAbcOptions: created under the scene root; StartFrame / EndFrame from the timeline (5..50)', X.prop, { type: 'ExportAbcOptions', parent: true, params: [
  ['StartFrame', 'double', 5, 'Start Frame'], ['EndFrame', 'double', 50, 'End Frame'], ['IncludeParentHier', 'bool', false, 'Include hierarchy up to Scene Root'],
  ['ArchiveFormat', 'enum', 'Ogawa', 'Archive Format'], ['IncludeAttributesPointcloud', 'string', PC, 'Included ICE Attributes for Pointclouds'],
  ['IncludeAttributesPolymesh', 'string', PM, 'Included ICE Attributes for Polymeshes'], ['IncludeAttributesOtherPrim', 'string', '', 'Included ICE Attributes for other primitives']] });
eq('view size: height 559 (width not recovered, Q5)', X.viewSize, [{ width: null, height: 559 }, { width: null, height: 559 }, '559']);
eq('export page: title "Alembic Export", groups, combo, buttons', X.page, ['Alembic Export', [
  'group:Time Range=StartFrame/double/Start Frame,EndFrame/double/End Frame',
  'IncludeParentHier/bool/Include hierarchy up to Scene Root',
  'ArchiveFormat/enum/Archive Format',
  'group:ICE Attributes for Pointclouds=text:PointPosition and ID will always be exported,IncludeAttributesPointcloud/string/Included ICE Attributes for Pointclouds,button:ClearAttributesPointcloud/Delete All,button:AddDefaultAttributesPointcloud/Add Default Attributes',
  'group:ICE Attributes for Polygon Meshes=IncludeAttributesPolymesh/string/Included ICE Attributes for Polymeshes,button:ClearAttributesPolymesh/Delete All,button:AddDefaultAttributesPolymesh/Add Default Attributes',
  'group:ICE Attributes for other primitives=IncludeAttributesOtherPrim/string/Included ICE Attributes for other primitives,button:ClearAttributesOtherPrim/Delete All',
], ['Ogawa', 'HDF5']]);
eq('"Delete All" clears the three lists (page refreshed)', X.cleared, ['', '', '', '']);
eq('"Add Default Attributes" puts the default lists back', X.restored, [PC, PM]);
eq('options Cancel: aborted (0x80004004), nothing exported', X.cancel, [`rejected:${ABORT}`, 0]);
eq('file browser: Save, title, filter, own initial directory (project path, not the import directory)', X.browser, { title: 'Alembic Export', mode: 'save', filter: 'Alembic Files(*.abc)|*.abc||', dir: M.projectPath, name: '' });
eq('empty browser result: status OK, nothing exported', X.emptyResult, ['ok', 0, '']);
eq('picked file: AbcExport with the property values and the current selection; export directory remembered separately', X.picked, ['ok',
  [`cmd:AbcExport "${M.projectPath}\\cache.abc", 6, 40, "${X.selFull}", true, "HDF5", "${PC}", "${PM}", "Foo"`],
  [['create', `${M.projectPath}\\cache.abc`, true, 0], ['attrs', PC, PM, 'Foo'], ['export', ['abcCube', 'abcNull'], 6, 40]], M.projectPath, 'D:\\other']);
eq('next export browser starts in the remembered export directory', X.remembered, M.projectPath);
eq('stale range (property 6..40, timeline 10..50): fails with invalid argument after the file was chosen; an existing property keeps its range', X.stale, [`rejected:${INVALID}`, 0, 6]);
eq('AbcExport failed: the menu command fails', X.exportFails, `rejected:${FAIL}`);
eq('no modal window left open', X.windowsLeft, 0);

// 6. PlotSequencerCamera
const Q = got.plot;
eq('PlotSequencerCamera: SequenceOut <= SequenceIn or an empty name is an invalid argument', Q.invalid, [INVALID, INVALID, INVALID, INVALID]);
eq('ApplyToCamera true: returns the new camera only; named CameraName, under the scene root, no interest', [Q.apply.list, Q.apply.name, Q.apply.type, Q.apply.parent, Q.apply.children, Q.apply.added], [1, 'SequencerCamera_Plot', 'camera', true, 0, 1]);
eq('the plot gets the sequencer range and the gaps switch', Q.apply.req, [{ sequenceIn: 3, sequenceOut: 20, withoutGaps: true }]);
eq('the camera is left with plain function curves', [Q.apply.posx, Q.apply.roty, Q.apply.fov], [[[3, 1], [20, 4]], [[3, 0], [20, 90]], [[3, 30], [20, 60]]]);
eq('constant parameter values are written onto the camera', [Q.apply.near, Q.apply.far], [0.5, 2000]);
eq('the temporary action source is gone, no clip was added', [Q.apply.sources, Q.apply.clips], [[], 0]);
eq('logged as one command', Q.apply.cmd, ['cmd:PlotSequencerCamera 3, 20, "SequencerCamera_Plot_Action", "SequencerCamera_Plot", true, true']);
eq('one undo removes the camera', Q.applyUndo, [0, []]);
eq('ApplyToCamera false: returns the camera and the clip; clip named ActionName starts at SequenceIn; the source stays', [Q.clip.list, Q.clip.name, Q.clip.added, Q.clip.sources, Q.clip.clip, Q.clip.inMixer],
  [2, 'MyCam', 1, ['MyPlot'], { name: 'MyPlot', source: 'MyPlot', start: 7 }, true]);
eq('ApplyToCamera false: constants written, no curves put on the camera', [Q.clip.near, Q.clip.posxKeys, Q.clip.req], [0.5, 0, [{ sequenceIn: 7, sequenceOut: 30, withoutGaps: false }]]);
eq('empty plot: notice, aborted (0x80004004), nothing left behind', Q.empty, [ABORT, 0, false, true, 'string']);

// 7. PlotCamSeqForCachedObjects
const K = got.cache;
eq('PlotCamSeqForCachedObjects: range, empty Path, Path without "_#" are invalid arguments', K.invalid, [INVALID, INVALID, INVALID]);
eq('no objects with file cache clips: nothing to do, no return value', K.noObjects, NONE);
eq('empty frame list: message logged, aborted (0x80004004)', K.noFrames, [ABORT, 1]);
if (K.noCommand) ok('cache command missing in the build: fails, "not yet attested"', K.noCommand.status === FAIL && /not yet attested/.test(K.noCommand.err), K.noCommand);
eq('the cache command gets the 13 contract arguments', K.args, [['abcCube', 'abcNull'], 5, 4, -1, 1, true, true, 'Color,Size', 'CamSeq_Plot', 'C:\\c\\cache_#.icecache', false, 1, [11, 12, 13, 21, 22], '<unset>', '<unset>']);
eq('the frame list is built for the sequencer range and the gaps switch', K.frameReq, [[4, 9, true]]);
eq('returns objects (text list), path with the range suffix, the clips', K.ok, ['abcCube,abcNull', 'C:\\c\\cache_[4..8].icecache', true, null]);
eq('the result has three values, the first a string', K.resultToApply, ['string', 3]);
ok('a failing cache command fails the command', /cache failed/.test(K.cacheFails ?? ''), K.cacheFails);

// 8. ApplyCamSeqFileCacheSources
const P = got.applyCache;
eq('ApplyCamSeqFileCacheSources: an empty list is invalid (0x80070057), differing lengths unexpected (0x8000ffff)', P.invalid, [INVALID, INVALID, UNEXPECTED]);
if (P.noCommand) ok('file cache source command missing in the build: fails "not yet attested", clip deletion rolled back', /not yet attested/.test(P.noCommand[0] ?? '') && P.noCommand[1] === FAIL && P.noCommand[2] === true, P.noCommand);
eq('deletes the clips, then one file cache source per object / path pair in order (two arguments each); no return value', P.ok,
  [NONE, [['abcCube', 'C:\\c\\a_[1..5].icecache', true, true], ['abcNull', 'C:\\c\\b_[1..5].icecache', true, true]], 2, false, true]);
eq('no clips to delete is fine', P.noClips, [NONE, [['abcCube', 'p1', true, true]]]);
ok('stops at the first failing pair', /no such object/.test(P.stopAtFailure[0] ?? '') && JSON.stringify(P.stopAtFailure[1]) === '["first"]', P.stopAtFailure);
eq('a clip that cannot be deleted fails the command before any source is applied', P.clipFailure, [FAIL, 0]);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-01e / CMD-19a Alembic + Camera Sequencer commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-01e / CMD-19a Alembic + Camera Sequencer commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired (command layer): OnAbcImportMenu, OnAbcExportMenu, ApplyCamSeqFileCacheSources (needs the file cache source command), AbcImport / AbcExport argument handling and validation');
console.log('   partly wired: AbcVer (version texts Q1), AbcImport / AbcExport (archive content SYS-03: no Alembic framework), PlotSequencerCamera (plot Q1, notice Q2), PlotCamSeqForCachedObjects (frame list Q1, message 463 Q2, cache command Q3)');
