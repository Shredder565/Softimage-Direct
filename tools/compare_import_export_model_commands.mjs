// CMD-04b: the 13 script-implemented import / export and model commands on the command bus (command layer).
// Checked against the "Wire contract" of docs/ghidra/cmd-04b-import-export-model-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check. The lower-level workers
// (translators, Crosswalk, file-backed referenced-model creator) are other rows: the check installs recording workers in
// app.importExportModelScripts.workers and verifies which worker is called with which values.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_import_export_model_commands.mjs
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

const NAMES = ['ObjExport', 'SI_InspectWavefrontImportOptions', 'SetupDisplacement', 'BiovisionImport', 'AcclaimImport', 'ImportDotXSI', 'ExportDotXSI',
  'ImportIges', 'CreateRefModel', 'CreateModelAndConvertToRef', 'ToggleReferencedModel', 'RemoveUnusedDeltas', 'SearchAndReplacePath'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
// three names have a second (C++ worker or twin) entry: the script entry is the one this row wires
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => x.scripting_name === n && x.language === 'VBScript'); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SearchAndReplacePath'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.importExportModelScripts; const fsx = app.hostFs;
  const out = {};
  const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const plain = (v) => v === undefined ? '<none>' : v && typeof v === 'object' && 'name' in v && 'kind' in v ? `node:${v.name}` : Array.isArray(v) ? v.map(plain) : v;
  const run = (n, a = {}) => { try { return { v: app.run(n, a) }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const q = (s) => document.querySelector(s);
  const rootProps = () => app.scene.root.properties.map(p => p.name);
  const obj = (n) => [...app.scene.allObjects()].find(o => o.name === n);
  const calls = []; const callArg = (v) => Array.isArray(v) ? v.map(callArg) : v && typeof v === 'object' && 'name' in v ? v.name : v;
  const WORKERS = ['SIObjExport', 'SIImportDotXSIFile', 'SIExportDotXSIFile', 'ImportCrosswalk', 'Biovision Import function', 'Acclaim Import function'];
  const install = () => { for (const w of WORKERS) S.workers[w] = (...args) => { calls.push([w, ...args.map(callArg)]); }; };
  const take = () => calls.splice(0);
  const field = (W, n) => q(`${W} .iems-row[data-param="${n}"] input:not([type=radio]), ${W} .iems-row[data-param="${n}"] select`);
  const setField = (W, n, v) => { const f = field(W, n); if (f.type === 'checkbox') f.checked = v; else f.value = String(v); f.dispatchEvent(new Event('change')); };
  const okBtn = (W) => q(`${W} .sdkh-modal-ok`); const cancelBtn = (W) => q(`${W} .sdkh-modal-cancel`);
  const title = (W) => q(`${W} .ppg-float-title`)?.textContent;
  const enabled = (W, names) => names.map(n => q(`${W} .iems-row[data-param="${n}"]`)?.dataset.enabled);
  const lastCmd = (name) => [...app.log].reverse().find(l => l.kind === 'cmd' && l.text.startsWith(name))?.text;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.cat = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.category]));
  out.sceneObjects = [...app.scene.allObjects()].filter(o => o.type === 'polymsh').map(o => o.name);
  install();

  // ================= ObjExport: worker form
  {
    const r = {}; S.objExportForm = 'proc';
    app.select([obj('cube')]); let m = mark();
    r.one = run('ObjExport', { FileName: 'C:\\out\\a.obj' }); r.oneCalls = take(); r.oneLog = logFrom(m); r.selKept = app.selection.map(n => n.name);
    app.select([]);
    run('ObjExport', { FileName: 'C:\\out\\a.obj.obj', FilePerObject: 1 }); r.perObject = take().map(c => [c[1], c[2]]);
    const f0 = app.anim.frame;
    run('ObjExport', { FileName: 'C:\\out\\a', FilePerFrame: true, StartFrame: 3, EndFrame: 7, StepFrame: 2, CoordinateSystem: 1, Tesselation: 1, Material: false, UV: false, UserNormal: false });
    r.perFrame = take().map(c => [c[2], c.slice(3)]); r.frameAfter = app.anim.frame; r.frameBefore = f0 !== 7;
    app.select([obj('cube')]);
    run('ObjExport', { FileName: 'a.obj', FilePerObject: 1, FilePerFrame: true, StartFrame: 1, EndFrame: 2, StepFrame: 1 }); r.both = take().map(c => c[2]);
    m = mark(); r.nothing = run('ObjExport', { FileName: 'a.obj', Polymsh: false }); r.nothingLog = logFrom(m).filter(l => !l.startsWith('cmd:')); r.nothingCalls = take().length;
    app.select([]);
    out.proc = r;
  }

  // ================= ObjExport: dialog form
  {
    const r = {}; S.objExportForm = 'auto'; const W = '.iems-Wavefront_Export';
    app.select([obj('cube')]);
    let pr = run('ObjExport', { FileName: 'C:\\out\\dlg.obj', FilePerObject: 1, Polymsh: false }).v; await tick();
    const p = app.scene.root.properties.find(x => x.name === 'Wavefront_Export');
    r.prop = !!p; r.title = title(W);
    r.params = p?.params.map(x => [x.name, x.value]);
    r.playRange = [app.anim.startFrame, app.anim.endFrame];
    r.tabs = [...document.querySelectorAll(`${W} .iems-tab`)].map(b => b.textContent);
    r.groups = [...document.querySelectorAll(`${W} .iems-group`)].map(g => `${g.dataset.group}=${[...g.querySelectorAll('.iems-row')].map(x => x.dataset.param).join(',')}`);
    r.disabled0 = enabled(W, ['Filename', 'StartFrame', 'EndFrame', 'StepFrame', 'Polymsh', 'Surfmsh', 'Crvlist', 'Tesselation', 'UserNormal']);
    r.hrcInert = q(`${W} .iems-row[data-param="hrc"]`)?.dataset.inert;
    r.cloudShown = !!q(`${W} .iems-row[data-param="Cloud"]`);
    r.fileCtl = (() => { const d = q(`${W} .iems-row[data-param="Filename"]`)?.dataset; return d ? [d.control, d.mode, d.mustExist, d.initialDir, d.filter] : null; })();
    r.labels = ['FilePerFrame', 'Polymsh', 'Surfmsh', 'Crvlist', 'UserNormal', 'Tesselation', 'Material', 'uv', 'StartFrame', 'EndFrame', 'StepFrame'].map(n => q(`${W} .iems-row[data-param="${n}"] label`)?.textContent);
    r.choices = ['FilePerObject', 'hrc'].map(n => [...document.querySelectorAll(`${W} .iems-row[data-param="${n}"] .iems-choice`)].map(c => `${c.textContent.trim()}=${c.dataset.value}`)).concat([[...field(W, 'CoordinateSystem').options].map(o => `${o.textContent}=${o.value}`)]);
    setField(W, 'FilePerFrame', true); r.framesOn = enabled(W, ['StartFrame', 'EndFrame', 'StepFrame']);
    setField(W, 'FilePerFrame', false); r.framesOff = enabled(W, ['StartFrame', 'EndFrame', 'StepFrame']);
    take(); okBtn(W).click(); r.okArgs = await pr; r.okCalls = take(); r.propAfterOk = rootProps().includes('Wavefront_Export'); r.okLine = lastCmd('ObjExport'); r.okLast = S.last.ObjExport.ok;
    // cancel
    const m = mark(); pr = run('ObjExport', { FileName: 'keep.obj', FilePerObject: 1 }).v; await tick(); cancelBtn(W).click(); const ca = await pr;
    r.cancel = [ca.FileName, ca.FilePerObject, ca.CoordinateSystem, take().length, rootProps().includes('Wavefront_Export'), S.last.ObjExport.ok, logFrom(m).filter(l => l.startsWith('cmd:'))];
    // empty file name: the save browser; cancelled, then answered
    pr = run('ObjExport').v; await tick(); okBtn(W).click(); await tick();
    r.browser = [title('.iems-browser'), q('.iems-browser .sdkh-modal-content')?.dataset.mode, q('.iems-browser .sdkh-modal-content')?.dataset.filter];
    cancelBtn('.iems-browser').click(); const b1 = await pr; r.browserCancel = [b1.FileName, take().length, rootProps().includes('Wavefront_Export')];
    pr = run('ObjExport').v; await tick(); okBtn(W).click(); await tick();
    { const i = q('.iems-browser .sdkh-row input'); i.value = 'C:\\out\\picked.obj'; i.dispatchEvent(new Event('change')); }
    okBtn('.iems-browser').click(); const b2 = await pr; r.browserOk = [b2.FileName, take().map(c => c[2])];
    app.select([]);
    out.dialog = r;
  }

  // ================= SI_InspectWavefrontImportOptions
  {
    const r = {}; const W = '.iems-Wavefront_Import'; const N = 'SI_InspectWavefrontImportOptions';
    let pr = run(N, { FileName: 'C:\\m\\in.obj', Group: 0, Material: false, DisplDepth: 9 }).v; await tick();
    const p = app.scene.root.properties.find(x => x.name === 'Wavefront_Import');
    r.title = title(W); r.params = p?.params.map(x => [x.name, x.value]);
    r.tabs = [...document.querySelectorAll(`${W} .iems-tab`)].map(b => b.textContent);
    r.labels = ['UserNormal', 'Material', 'uv', 'uvWrapping', 'DisplImage', 'DisplDepth', 'DisplFlipVert', 'DisplViewDep', 'DisplSubDLevel'].map(n => q(`${W} .iems-row[data-param="${n}"] label`)?.textContent);
    r.choices = ['Group', 'hrc'].map(n => [...document.querySelectorAll(`${W} .iems-row[data-param="${n}"] .iems-choice`)].map(c => `${c.textContent.trim()}=${c.dataset.value}`));
    setField(W, 'Filename', 'D:\\models\\ship.obj'); r.displDir = p.displImageDir;
    const n0 = S.calls.length; okBtn(W).click(); r.ok = await pr; r.workerCalls = S.calls.length - n0; r.propAfter = rootProps().includes('Wavefront_Import'); r.line = lastCmd(N);
    pr = run(N, { FileName: 'x.obj' }).v; await tick(); cancelBtn(W).click(); r.cancel = await pr;
    pr = run(N).v; await tick(); okBtn(W).click(); await tick(); r.browserTitle = title('.iems-browser'); r.browserMode = q('.iems-browser .sdkh-modal-content')?.dataset.mode;
    cancelBtn('.iems-browser').click(); r.browserCancel = [(await pr).FileName, rootProps().includes('Wavefront_Import')];
    out.inspect = r;
  }

  // ================= SetupDisplacement
  {
    const r = {}; const sel0 = [obj('sphere')]; app.select(sel0);
    const cube = obj('cube'), sph = obj('sphere1'); const u0 = app.undoStack.length;
    r.run = plain(run('SetupDisplacement', { InputObjs: [cube, sph], FileName: 'C:\\pics\\bump.pic', DisplDepth: 2, FlipVert: true, DisplViewDep: false, DisplSubDLevel: 2 }).v);
    r.undoEntries = app.undoStack.length - u0;
    r.per = [cube, sph].map(o => {
      const m = o.material; if (!m) return null;
      const lin = S.sourceOf(m, 'displacement'); const img = lin && S.sourceOf(lin, 'input'); const clip = img && S.sourceOf(img, 'tex');
      const ga = o.properties.find(x => x.type === 'geomapprox');
      return { local: m.parent === o, lin: String(lin?.spdl?.file ?? lin?.type).replace(/\.spdl$/, ''), min: lin?.val('newrange_min'), max: lin?.val('newrange_max'), img: String(img?.spdl?.file ?? img?.type).replace(/\.spdl$/, ''),
        clip: clip?.name, clipType: clip?.type, idt: clip?.val('ImageDefinitionType'), flipY: clip?.val('FlipY'), file: clip?.val('filename'),
        ga: ga && [ga.shared, ga.val('gapproxmaxdisp'), ga.val('gapproxrdangdep'), ga.val('gapproxrdfinevwdep'), ga.val('gapproxmosl'), ga.val('gapproxmordrsl')] };
    });
    r.sources = app.scene.root.properties.filter(x => x.type === 'imagesource').map(x => x.name);
    r.clips = app.scene.root.properties.filter(x => x.type === 'imageclip').map(x => x.name);
    r.sel = app.selection.map(n => n.name);
    // view dependent on, no flip
    const s0 = obj('sphere');
    run('SetupDisplacement', { InputObjs: 'sphere', FileName: 'D:\\x\\rock.tga', DisplDepth: 0.5, FlipVert: false, DisplViewDep: true, DisplSubDLevel: 1 });
    { const lin = S.sourceOf(s0.material, 'displacement'); const clip = S.sourceOf(S.sourceOf(lin, 'input'), 'tex'); const ga = s0.properties.find(x => x.type === 'geomapprox');
      r.second = [lin.val('newrange_min'), lin.val('newrange_max'), clip.name, clip.val('FlipY'), clip.val('ImageDefinitionType'), ga.val('gapproxmaxdisp'), ga.val('gapproxrdfinevwdep')]; }
    // empty file name: the failure comes at the image source step, and the command is rolled back
    const lin1 = S.sourceOf(cube.material, 'displacement'); const nClips = app.scene.root.properties.length;
    r.empty = run('SetupDisplacement', { InputObjs: [cube] }).err ?? null; r.emptyRolledBack = [S.sourceOf(cube.material, 'displacement') === lin1, app.scene.root.properties.length === nClips];
    r.noObjects = plain(run('SetupDisplacement', { FileName: 'C:\\pics\\bump.pic' }).v);
    app.select([]);
    out.displ = r;
  }

  // ================= BiovisionImport / AcclaimImport
  {
    const r = {}; let W = '.iems-Biovision_Import';
    let pr = run('BiovisionImport', { FileName: 'ignored.bvh', InserMotion: false, GaplessSkeleton: false, SI3DChains: true }).v; await tick();
    let p = app.scene.root.properties.find(x => x.name === 'Biovision_Import');
    r.bvh = { title: title(W), type: p?.type, params: p?.params.map(x => [x.name, x.value]), labels: ['FileName', 'InsertMotion', 'GroupAnimObjs', 'GaplessSkeleton', 'SI3DChains'].map(n => q(`${W} .iems-row[data-param="${n}"] label`)?.textContent),
      groups: [...document.querySelectorAll(`${W} .iems-group`)].map(g => g.dataset.group) };
    setField(W, 'FileName', 'C:\\mocap\\walk.bvh'); take(); okBtn(W).click(); r.bvh.ok = await pr; r.bvh.calls = take(); r.bvh.propAfter = rootProps().includes('Biovision_Import'); r.bvh.line = lastCmd('BiovisionImport');
    pr = run('BiovisionImport').v; await tick(); setField(W, 'FileName', 'C:\\mocap\\run.bvh'); setField(W, 'GaplessSkeleton', 1); setField(W, 'SI3DChains', 0); setField(W, 'NullsHierarchy', 1); setField(W, 'InsertMotion', false);
    okBtn(W).click(); await pr; r.bvh.inverted = take();
    pr = run('BiovisionImport').v; await tick(); okBtn(W).click(); await tick(); r.bvh.browser = [title('.iems-browser'), q('.iems-browser .sdkh-modal-content')?.dataset.filter];
    cancelBtn('.iems-browser').click(); const c1 = await pr; r.bvh.browserCancel = [c1.FileName, c1.SI3DChains, take().length, rootProps().includes('Biovision_Import')];
    pr = run('BiovisionImport', { FileName: 'in.bvh' }).v; await tick(); cancelBtn(W).click(); r.bvh.cancel = [(await pr).FileName, take().length];

    W = '.iems-Acclaim_Import';
    pr = run('AcclaimImport', { SkeletonFileName: 'ignored.asf', BoneLengthMultiplier: 5 }).v; await tick();
    p = app.scene.root.properties.find(x => x.name === 'Acclaim_Import');
    r.asf = { title: title(W), type: p?.type, params: p?.params.map(x => [x.name, x.value]), doc: q(`${W} .iems-row[data-param="FileDoc"] .iems-static`)?.textContent,
      labels: ['ASFFile', 'AMCFile', 'ApplyLimits', 'OverrideLength', 'LengthMultiplier'].map(n => q(`${W} .iems-row[data-param="${n}"] label`)?.textContent), groups: [...document.querySelectorAll(`${W} .iems-group`)].map(g => g.dataset.group) };
    setField(W, 'ASFFile', 'C:\\mocap\\man.asf'); take(); okBtn(W).click(); r.asf.ok = await pr; r.asf.calls = take(); r.asf.propAfter = rootProps().includes('Acclaim_Import');
    pr = run('AcclaimImport').v; await tick(); setField(W, 'LengthMultiplier', 0.001); r.asf.minMultiplier = p && app.scene.root.properties.find(x => x.name === 'Acclaim_Import').val('LengthMultiplier');
    okBtn(W).click(); await tick(); r.asf.browser = [title('.iems-browser'), q('.iems-browser .sdkh-modal-content')?.dataset.filter];
    cancelBtn('.iems-browser').click(); await pr; r.asf.browserCancel = [take().length, rootProps().includes('Acclaim_Import')];
    out.mocap = r;
  }

  // ================= ImportDotXSI / ExportDotXSI
  {
    const r = {}; const WI = '.iems-dotXSIImportOptions', WE = '.iems-dotXSIExportOptions';
    fsx.ensureFolder('C:\\xsi');
    fsx.writeFile('C:\\xsi\\old.xsi', 'xsi 0300txt 0032\nSI_FileInfo {\n}\n'); fsx.writeFile('C:\\xsi\\new.xsi', 'xsi 0600txt 0032\n');
    fsx.writeFile('C:\\xsi\\scene.dae', '<?xml version="1.0"?>\n'); fsx.writeFile('C:\\xsi\\odd.xsi', 'hello world\n');
    // missing file -> legacy path with the import options dialog
    let pr = run('ImportDotXSI', { FileName: 'C:\\xsi\\missing.xsi', Parent: 'cube' }).v; await tick();
    r.importTitle = title(WI); r.importTab = [...document.querySelectorAll(`${WI} .iems-tab`)].map(b => b.textContent);
    r.importRows = [...document.querySelectorAll(`${WI} .iems-row`)].map(x => `${x.dataset.param}=${x.querySelector('input')?.checked}`);
    take(); okBtn(WI).click(); r.missingOk = [await pr, take()];
    pr = run('ImportDotXSI', { FileName: 'C:\\xsi\\old.xsi' }).v; await tick(); r.oldDialog = title(WI); cancelBtn(WI).click(); r.oldCancel = [await pr, take().length];
    // version >= 500 -> Crosswalk, no dialog, options property made once and kept
    const n0 = S.calls.length;
    r.newRun = plain(run('ImportDotXSI', { FileName: 'C:\\xsi\\new.xsi', Parent: 'cube' }).v); r.newDialog = !!q(WI);
    r.newWorkers = S.calls.slice(n0).map(c => c.worker); r.newCalls = take();
    const opt = app.scene.root.properties.find(x => x.name === 'ImportCrosswalkOptions'); r.crossOpt = [!!opt, opt?.val('Filename')];
    const n1 = S.calls.length; run('ImportDotXSI', { FileName: 'C:\\XSI\\Scene.DAE' }); r.daeWorkers = S.calls.slice(n1).map(c => c.worker); r.daeCalls = take();
    r.crossOptReused = [app.scene.root.properties.filter(x => x.name === 'ImportCrosswalkOptions').length, opt?.val('Filename')];
    r.odd = run('ImportDotXSI', { FileName: 'C:\\xsi\\odd.xsi' }).err ?? null; take();
    S.licence = 'Avid 3D'; r.avid = [plain(run('ImportDotXSI', { FileName: 'C:\\xsi\\new.xsi', Parent: 'p' }).v), !!q(WI), take()]; S.licence = 'Softimage';
    // export
    pr = run('ExportDotXSI', { FileName: 'C:\\xsi\\out.xsi' }).v; await tick();
    r.exportTitle = title(WE); r.exportGroups = [...document.querySelectorAll(`${WE} .iems-group`)].map(g => g.dataset.group);
    r.exportFormat = [field(WE, 'output_file_format').value, [...field(WE, 'output_file_format').options].map(o => `${o.textContent}=${o.value}`), field(WE, 'output_file_format_version').value, [...field(WE, 'output_file_format_version').options].map(o => `${o.textContent}=${o.value}`)];
    okBtn(WE).click(); r.exportRoot = [await pr, take()];
    pr = run('ExportDotXSI', { Model: 'cube,sphere', FileName: 'C:\\xsi\\two.xsi' }).v; await tick(); okBtn(WE).click(); r.exportTwo = [await pr, take()];
    pr = run('ExportDotXSI', { Model: 'cube', FileName: 'x' }).v; await tick(); cancelBtn(WE).click(); r.exportCancel = [await pr, take().length];
    out.xsi = r;
  }

  // ================= ImportIges
  {
    const r = {}; let m = mark();
    r.noWorker = plain(run('ImportIges', { FileName: 'C:\\cad\\part.igs', Parent: 'cube' }).v); r.noWorkerLog = logFrom(m).filter(l => l.includes('not yet attested')).length;
    const inspected = []; const off = app.events.on('inspect', n => inspected.push(n?.name));
    S.workers.SIImportIges = (f) => { calls.push(['SIImportIges', f]); return obj('sphere1'); };
    app.autoInspect = true; app.select([]);
    r.withWorker = plain(run('ImportIges', { FileName: 'C:\\cad\\part.igs', Parent: 'cube' }).v); r.calls = take(); r.sel = app.selection.map(n => n.name); r.inspected = inspected.slice();
    app.autoInspect = false; inspected.length = 0; run('ImportIges', { FileName: 'b.igs' }); r.noAutoInspect = inspected.length; app.autoInspect = true; take();
    S.workers.SIImportIges = () => undefined; app.select([]); r.nothingBack = [plain(run('ImportIges', { FileName: 'c.igs' }).v), app.selection.length];
    delete S.workers.SIImportIges; off();
    out.iges = r;
  }

  // ================= CreateRefModel
  {
    const r = {};
    const a = run('CreateRefModel').v; r.empty = [a?.kind, !!a?.ref, a?.ref?.file, app.selection[0] === a];
    const b = run('CreateRefModel', { FileName: 'C:\\models\\nofile.emdl', ModelName: 'Hero', ResolutionName: 'hi', Parent: 'root_null', Activate: false, ShareOptions: 3 }).v;
    r.missing = [b?.name, b?.ref?.file, b?.ref?.resolutions, b?.ref?.resolutionNames, b?.parentObj?.name, b?.ref?.shareOptions, app.selection[0] === b];
    fsx.ensureFolder('C:\\models'); fsx.writeFile('C:\\models\\rig.emdl', 'binary');
    S.workers.SICreateRefModel = (...args) => { calls.push(['SICreateRefModel', ...args]); return a; };
    app.select([]);
    const c = run('CreateRefModel', { FileName: 'C:\\models\\rig.emdl', ModelName: 'Rig', ResolutionName: 'res1', Parent: 'cube', CreateFile: true, ExternalCnxMappingTemplate: 'map' }).v;
    r.existing = [c === a, take(), app.selection[0] === a];
    S.workers.SICreateRefModel = () => undefined; app.select([]); r.failed = [plain(run('CreateRefModel', { FileName: 'C:\\models\\rig.emdl' }).v), app.selection.length];
    delete S.workers.SICreateRefModel;
    const m = mark(); r.noWorker = [plain(run('CreateRefModel', { FileName: 'C:\\models\\rig.emdl' }).v), logFrom(m).filter(l => l.includes('not yet attested')).length];
    out.createRef = r;
  }

  // ================= CreateModelAndConvertToRef / ToggleReferencedModel / RemoveUnusedDeltas
  {
    const r = {}; const cube = obj('cube');
    app.select([obj('sphere')]);
    const res = run('CreateModelAndConvertToRef', { Objects: [cube], FileName: 'cubeRef' });
    const model = cube.parentObj;
    r.wrap = [plain(res.v), res.err ?? null, model?.kind, model?.ref?.file, app.selection[0] === model];
    app.select([obj('sphere1')]);
    const res2 = run('CreateModelAndConvertToRef', { FileName: 'sphRef' }); const model2 = obj('sphere1').parentObj;
    r.wrapSelection = [plain(res2.v), model2?.kind, model2?.ref?.file, model2 !== model];

    // toggle: referenced -> local -> referenced, no warnings
    app.select([obj('sphere')]); let m = mark();
    r.t1 = [plain(run('ToggleReferencedModel', { Model: [model], ShowWarnings: false }).v), !!model.ref, model.refLocal?.file, app.selection.map(n => n.name)];
    r.t2 = [plain(run('ToggleReferencedModel', { Model: [cube], ShowWarnings: false }).v), model.ref?.file, model.refLocal === undefined];   // an object inside stands for its model
    // with warnings: Yes / No box
    run('ToggleReferencedModel', { Model: [model], ShowWarnings: false });   // local again
    let pr = run('ToggleReferencedModel', { Model: model.name }).v; await tick();
    r.box = [title('.iems-yesno'), q('.iems-yesno .iems-msg-text')?.textContent, okBtn('.iems-yesno')?.textContent, cancelBtn('.iems-yesno')?.textContent];
    cancelBtn('.iems-yesno').click(); await pr; r.no = !!model.ref;
    pr = run('ToggleReferencedModel', { Model: [model] }).v; await tick(); okBtn('.iems-yesno').click(); await pr; r.yes = model.ref?.file;
    // scene root, never-referenced model, not a 3D object (stops the loop)
    m = mark(); run('ToggleReferencedModel', { Model: [app.scene.root], ShowWarnings: false }); r.rootLog = logFrom(m).filter(l => !l.startsWith('cmd:'));
    const plainModel = run('CreateModel', { InputObj: [obj('sphere')], Name: 'Plain' }).v;
    m = mark(); run('ToggleReferencedModel', { Model: [plainModel], ShowWarnings: false }); r.neverLog = logFrom(m).filter(l => !l.startsWith('cmd:')); r.neverRef = !!plainModel.ref;
    m = mark(); run('ToggleReferencedModel', { Model: 'no_such_thing,' + model.name, ShowWarnings: false }); r.stopLog = logFrom(m).filter(l => !l.startsWith('cmd:')); r.stopLeft = model.ref?.file;
    // batch + warnings: nothing converted
    run('ToggleReferencedModel', { Model: [model], ShowWarnings: false }); app.Interactive = false;
    r.batch = [plain(run('ToggleReferencedModel', { Model: [model] }).v), !!model.ref]; app.Interactive = true;
    run('ToggleReferencedModel', { Model: [model], ShowWarnings: false });   // referenced again

    // deltas
    app.select([model]); const d1 = app.run('AddDelta'); app.select([model2]); const d2 = app.run('AddDelta');
    app.select([obj('cube')]); m = mark();
    r.deltaLive = [plain(run('RemoveUnusedDeltas').v), model.properties.includes(d1), model2.properties.includes(d2)];
    d2.set('target', 'Ghost_Model');
    r.deltaDead = [plain(run('RemoveUnusedDeltas').v), model.properties.includes(d1), model2.properties.includes(d2), logFrom(m).filter(l => !l.startsWith('cmd:')), app.selection.map(n => n.name)];
    app.run('Undo'); r.deltaUndo = model2.properties.includes(d2); app.run('Redo');
    out.models = r;
  }

  // ================= SearchAndReplacePath
  {
    const r = {}; const W = '.iems-Search_And_Replace';
    let audio = 'C:\\pics\\snd\\Voice.wav'; S.extraFiles.push(new S.ExternalFile('Audio', () => audio, (v) => { audio = v; }));
    const paths = () => S.externalFiles().map(f => `${f.fileType}:${f.path}`);
    r.before = paths();
    let m = mark(); r.direct = plain(run('SearchAndReplacePath', { OldString: 'c:\\PICS', NewString: 'D:\\tex' }).v); r.directLog = logFrom(m); r.afterAll = paths();
    m = mark(); run('SearchAndReplacePath', { Category: 'Audio', OldString: 'D:\\tex', NewString: 'E:' }); r.audioOnly = [paths().filter(x => x.includes('E:')), logFrom(m).filter(l => l.startsWith('info:'))];
    m = mark(); run('SearchAndReplacePath', { Category: 'audio', OldString: 'E:', NewString: 'F:' }); r.categoryExact = logFrom(m).filter(l => l.startsWith('info:')).length;
    m = mark(); run('SearchAndReplacePath', { Category: 'ALL', OldString: 'voice', NewString: 'v', CaseSensitive: true }); r.caseSensitive = [logFrom(m).filter(l => l.startsWith('info:')).length, audio];
    run('SearchAndReplacePath', { Category: 'all', OldString: 'Voice', NewString: '', CaseSensitive: true }); r.emptyNew = audio;
    const mine = new S.ExternalFile('Pictures', () => r._p ?? 'aXbXc', (v) => { r._p = v; });
    m = mark(); run('SearchAndReplacePath', { OldString: 'X', NewString: '--', Files: [mine] }); r.filesArg = [mine.path, logFrom(m).filter(l => l.startsWith('info:')), audio]; delete r._p;
    const u = app.undoStack.length; run('SearchAndReplacePath', { OldString: 'rock', NewString: 'stone' }); const afterRun = paths().filter(x => x.includes('stone')).length; app.run('Undo'); r.undo = [app.undoStack.length === u, afterRun, paths().filter(x => x.includes('stone')).length];
    // dialog form
    let pr = run('SearchAndReplacePath', { Category: 'Audio', NewString: 'ignored' }).v; await tick();
    const p = app.scene.root.properties.find(x => x.name === 'Search_And_Replace');
    r.dlg = [title(W), p?.params.map(x => [x.name, x.label, x.value])];
    setField(W, 'New_String', ''); m = mark(); okBtn(W).click(); await pr; r.dlgEmptyNew = [logFrom(m), rootProps().includes('Search_And_Replace')];
    pr = run('SearchAndReplacePath').v; await tick(); setField(W, 'Old_String', ''); setField(W, 'File_Category', ''); m = mark(); okBtn(W).click(); await pr; r.dlgEmptyCat = logFrom(m);
    pr = run('SearchAndReplacePath').v; await tick(); setField(W, 'Old_String', ''); m = mark(); okBtn(W).click(); await pr; r.dlgEmptyOld = logFrom(m);
    pr = run('SearchAndReplacePath').v; await tick(); setField(W, 'File_Category', 'Pictures'); setField(W, 'Old_String', 'BUMP'); setField(W, 'New_String', 'dent'); m = mark(); okBtn(W).click(); await pr;
    r.dlgOk = [logFrom(m).filter(l => l.startsWith('cmd:')).map(l => l.startsWith('cmd:SearchAndReplacePath "Pictures", "BUMP", "dent", false, "')), logFrom(m).filter(l => l.startsWith('info:')).length, paths().filter(x => x.includes('dent')).length, rootProps().includes('Search_And_Replace')];
    pr = run('SearchAndReplacePath').v; await tick(); m = mark(); cancelBtn(W).click(); await pr; r.dlgCancel = [logFrom(m).length, rootProps().includes('Search_And_Replace')];
    out.search = r;
  }

  // ================= every command with default arguments, batch mode (no dialogs)
  {
    app.Interactive = false; app.select([obj('cube')]); out.defaults = {};
    for (const n of NAMES) { const m = mark(); const res = run(n); if (res.v && typeof res.v.then === 'function') res.v = await res.v; out.defaults[n] = { v: plain(res.v), err: res.err ?? null, log: logFrom(m) }; }
    out.defaultsLeft = rootProps().filter(n => /Wavefront|Biovision|Acclaim|Search_And/.test(n));
    app.Interactive = true;
  }
  out.modalsLeft = document.querySelectorAll('.sdkh-modal-window').length;
  return out;
}, { NAMES });

await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = '<none>';

// ---- registration
for (const n of NAMES) eq(`${n}: registered with the registry's arguments and defaults`, got.reg[n], registry[n]);
eq('category: File for all but the uncategorised OBJ import options inspector', NAMES.filter(n => got.cat[n] !== 'File'), ['SI_InspectWavefrontImportOptions']);
eq('sample scene: three polygon meshes', got.sceneObjects, ['sphere', 'cube', 'sphere1']);

// ---- ObjExport worker form
const P = got.proc; const TAIL = [true, 0, true, true, true];
eq('ObjExport proc: selection, one file, ".obj" stripped, pass-through values in order', P.oneCalls, [['SIObjExport', ['cube'], 'C:\\out\\a', ...TAIL]]);
eq('ObjExport proc: kept objects logged as an information line; no return value; selection unchanged', [P.oneLog.filter(l => l.startsWith('info:')), P.one.v ?? NONE, P.selKept], [['info:cube'], NONE, ['cube']]);
eq('ObjExport proc: empty selection = every object; one file per object <base>_<object>; cut at the LAST .obj', P.perObject, [[['sphere'], 'C:\\out\\a.obj_sphere'], [['cube'], 'C:\\out\\a.obj_cube'], [['sphere1'], 'C:\\out\\a.obj_sphere1']]);
eq('ObjExport proc: one file per frame <base>.<frame>, all objects, values passed through', P.perFrame, [3, 5, 7].map(f => [`C:\\out\\a.${f}`, [1, 1, false, false, false]]));
eq('ObjExport proc: the current frame stays on the last exported frame', [P.frameAfter, P.frameBefore], [7, true]);
eq('ObjExport proc: per frame and per object <base>_<object>.<frame>', P.both, ['a_cube.1', 'a_cube.2']);
eq('ObjExport proc: nothing kept -> error "Nothing to export...", no worker call', [P.nothingLog, P.nothingCalls, P.nothing.err ?? null], [['error:Nothing to export...'], 0, null]);

// ---- ObjExport dialog form
const D = got.dialog; const [IN, OUT] = D.playRange;
eq('ObjExport dialog: Wavefront_Export under the scene root, title 1078', [D.prop, D.title], [true, 'Wavefront OBJ Export']);
eq('ObjExport dialog: parameters; frames from the play range; only FileName carried in', D.params, [['Filename', 'C:\\out\\dlg.obj'], ['FilePerObject', 0], ['FilePerFrame', false], ['StartFrame', IN], ['EndFrame', OUT], ['StepFrame', 1],
  ['Polymsh', true], ['Surfmsh', false], ['Crvlist', false], ['UserNormal', false], ['Cloud', false], ['Tesselation', false], ['Material', true], ['uv', true], ['CoordinateSystem', 0]]);
eq('ObjExport dialog: tabs and groups', [D.tabs, D.groups], [['File Output', 'Geometry Options'], ['File=Filename,FilePerObject', 'Sequence=FilePerFrame,StartFrame,EndFrame,StepFrame', 'Hierarchy=hrc', 'Geometry=Polymsh,Surfmsh,UserNormal,Crvlist', 'Triangulation=Tesselation,CoordinateSystem', 'Material=Material,uv']]);
eq('ObjExport dialog: initially disabled: the three frame fields, Surfmsh, Crvlist, Tesselation', D.disabled0, ['1', '0', '0', '0', '1', '0', '0', '0', '1']);
eq('ObjExport dialog: hrc radio is inert (no such parameter); Cloud is not in the layout', [D.hrcInert, D.cloudShown], ['1', false]);
eq('ObjExport dialog: file-path control (save, need not exist, project, filter)', D.fileCtl, ['file', 'save', '0', 'project', 'Wavefront OBJ Files (*.obj)|*.obj|All Files (*.*)|*.*||']);
eq('ObjExport dialog: labels', D.labels, ['Separate Files Per Frame', 'Polygon Meshes', 'Nurbs Meshes', 'Curve Lists', 'User Normals', 'Export Render Tesselation', 'Export Material', 'Export Current UV Set', 'Start', 'End', 'Step']);
eq('ObjExport dialog: radio / combo items', D.choices, [['Merge all objects into one file=0', 'Separate files per object=1'], ['No Hierarchy=0', 'Null as Parent=1', 'Model as Parent=2'], ['Global Coordinates=0', 'Local Coordinates=1']]);
eq('ObjExport dialog: frame fields enabled exactly when FilePerFrame is true', [D.framesOn, D.framesOff], [['1', '1', '1'], ['0', '0', '0']]);
const OKARGS = { FileName: 'C:\\out\\dlg.obj', FilePerObject: 0, FilePerFrame: false, StartFrame: IN, EndFrame: OUT, StepFrame: 1, Polymsh: true, Surfmsh: false, Crvlist: false, Cloud: false, CoordinateSystem: 0, Tesselation: false, Material: true, UV: true, UserNormal: false };
eq('ObjExport dialog OK: all 15 arguments written back from the property', D.okArgs, OKARGS);
eq('ObjExport dialog OK: worker run with the property values; property deleted', [D.okCalls, D.propAfterOk, D.okLast], [[['SIObjExport', ['cube'], 'C:\\out\\dlg', 0, false, true, true, false]], false, true]);
eq('ObjExport dialog OK: the logged command line shows the values used', D.okLine, `ObjExport "C:\\out\\dlg.obj", 0, false, ${IN}, ${OUT}, 1, true, false, false, false, 0, false, true, true, false`);
eq('ObjExport dialog Cancel: arguments as they came in, no export, property deleted', D.cancel, ['keep.obj', 1, true, 0, false, false, ['cmd:ObjExport "keep.obj", 1, false, 1, 100, 1, true, false, false, false, true, 0, true, true, true']]);
eq('ObjExport dialog: empty Filename opens the save browser', D.browser, ['Select a .OBJ file', 'save', 'Wavefront (*.obj)|*.obj|All Files (*.*)|*.*||']);
eq('ObjExport dialog: empty browser result ends like a cancel', D.browserCancel, ['', 0, false]);
eq('ObjExport dialog: browser result is exported', D.browserOk, ['C:\\out\\picked.obj', ['C:\\out\\picked']]);

// ---- SI_InspectWavefrontImportOptions
const I = got.inspect;
eq('InspectWavefrontImportOptions: title 1079; property defaults, only FileName carried in', [I.title, I.params], ['Wavefront OBJ Import', [['Filename', 'C:\\m\\in.obj'], ['Group', 1], ['hrc', 0], ['UserNormal', false], ['Material', true], ['uv', true], ['uvWrapping', true],
  ['DisplImage', ''], ['DisplDepth', 0.5], ['DisplFlipVert', false], ['DisplViewDep', false], ['DisplSubDLevel', 1]]]);
eq('InspectWavefrontImportOptions: labels and items', [I.labels, I.choices, I.tabs[1]], [['Import Normals as User Normals', 'Import Material', 'Import UV', 'UV wrapping', 'Image', 'Alpha Depth Factor', 'Flip Image Vertically', 'View Dependent Refinement', 'Subdivision level'],
  [['Import as Clusters=0', 'Import as Objects=1'], ['No Hierarchy=0', 'Null as Parent=1', 'Model as Parent=2']], 'Displacement Options']);
eq('InspectWavefrontImportOptions: Filename change moves the DisplImage browser to that folder', I.displDir, 'D:\\models');
eq('InspectWavefrontImportOptions OK: the 12 arguments from the property', I.ok, { FileName: 'D:\\models\\ship.obj', Group: 1, hrc: 0, Material: true, UV: true, UVwrapping: true, UserNormal: false, DisplImage: '', DisplDepth: 0.5, DisplFlipVert: false, DisplViewDep: false, DisplSubDLevel: 1 });
eq('InspectWavefrontImportOptions: imports nothing, property deleted, logged line shows the choices', [I.workerCalls, I.propAfter, I.line], [0, false, 'SI_InspectWavefrontImportOptions "D:\\models\\ship.obj", 1, 0, true, true, true, false, "", 0.5, false, false, 1']);
eq('InspectWavefrontImportOptions Cancel: arguments keep the values they came in with', I.cancel, { FileName: 'x.obj', Group: 0, hrc: 0, Material: false, UV: false, UVwrapping: false, UserNormal: false, DisplImage: '', DisplDepth: 0.5, DisplFlipVert: true, DisplViewDep: false, DisplSubDLevel: 1 });
eq('InspectWavefrontImportOptions: empty Filename -> open browser; empty result = cancel', [I.browserTitle, I.browserMode, I.browserCancel], ['Select a .OBJ file', 'open', ['', false]]);

// ---- SetupDisplacement
const S = got.displ;
const per = (clip) => ({ local: true, lin: 'sib_interp_linear', min: -1, max: 1, img: 'txt2d-image-explicit', clip, clipType: 'imageclip', idt: 0, flipY: true, file: 'C:\\pics\\bump.pic', ga: [false, 1, 3, false, 2, 2] });
eq('SetupDisplacement: per object local material, displacement <- linear interp (-D/2, +D/2) <- image <- clip, geometry approximation', S.per, [per('bump'), per('bump1')]);
eq('SetupDisplacement: a new source and clip for every object, named after the file base name', [S.sources, S.clips], [['bump', 'bump1'], ['bump', 'bump1']]);
eq('SetupDisplacement: no return value, nothing selected, one undo entry', [S.run, S.sel, S.undoEntries], [NONE, ['sphere'], 1]);
eq('SetupDisplacement: FlipVert false leaves FlipY off, ImageDefinitionType 0; DisplViewDep sets fine view dependence', S.second, [-0.25, 0.25, 'rock', false, 0, 0.25, true]);
ok('SetupDisplacement: empty FileName fails at the image source step', typeof S.empty === 'string' && /image source/.test(S.empty), S.empty);
eq('SetupDisplacement: failed run is rolled back; no objects = nothing to do', [S.emptyRolledBack, S.noObjects], [[true, true], NONE]);

// ---- mocap
const B = got.mocap.bvh, A = got.mocap.asf;
eq('BiovisionImport: Biovision_Import (type BiovisionImport), title 1080, defaults (incoming arguments ignored)', [B.title, B.type, B.params], ['Biovision Import', 'BiovisionImport', [['FileName', ''], ['NullsHierarchy', 0], ['GaplessSkeleton', 0], ['SI3DChains', 1], ['InsertMotion', true], ['GroupAnimObjs', true]]]);
eq('BiovisionImport: labels and groups', [B.labels, B.groups], [['File Name', 'Add motion action to Mixer', 'Group Animated Objects', 'Hierarchy', 'Chains'], ['Skeleton Description Mode', 'Bones Skeleton Options']]);
eq('BiovisionImport OK: worker gets file, InsertMotion, nulls, gapless (inverted), SI|3D chains (inverted), group', B.calls, [['Biovision Import function', 'C:\\mocap\\walk.bvh', true, false, true, false, true]]);
eq('BiovisionImport OK: six arguments written back; property deleted; logged line', [B.ok, B.propAfter, B.line], [{ FileName: 'C:\\mocap\\walk.bvh', InserMotion: true, NullsHierarchy: false, GaplessSkeleton: true, SI3DChains: false, GroupAnimObjs: true }, false, 'BiovisionImport "C:\\mocap\\walk.bvh", true, false, true, false, true']);
eq('BiovisionImport: inversions with GaplessSkeleton 1, SI3DChains 0, NullsHierarchy 1', B.inverted, [['Biovision Import function', 'C:\\mocap\\run.bvh', false, true, false, true, true]]);
eq('BiovisionImport: empty FileName -> browser; empty result = cancel (arguments untouched)', [B.browser, B.browserCancel, B.cancel], [['Select a .BVH file', 'Biovision (*.bvh)|*.bvh|All Files (*.*)|*.*||'], ['', false, 0, false], ['in.bvh', 0]]);
eq('AcclaimImport: Acclaim_Import (type AcclaimImport), title 1081, defaults', [A.title, A.type, A.params], ['Acclaim Import', 'AcclaimImport', [['FileDoc', 'Make sure that both the ASF and AMC files are compatible...'], ['ASFFile', ''], ['AMCFile', ''], ['NullsHierarchy', 0], ['GaplessSkeleton', 0], ['SI3DChains', 1],
  ['ApplyLimits', false], ['OverrideLength', false], ['LengthMultiplier', 1], ['InsertMotion', true], ['GroupAnimObjs', true]]]);
eq('AcclaimImport: static warning, labels, groups', [A.doc, A.labels, A.groups], ['Make sure that both the ASF and AMC files are compatible...', ['Skeleton File', 'Motion File', 'Crop Motion Values to Limits', 'Override Bone Length Multiplier', 'Length Multiplier'], ['File Input', 'Skeleton Description Mode', 'Bones Skeleton Options', 'Import Options']]);
eq('AcclaimImport OK: worker gets the ten values in registry order (empty AMC passed on)', A.calls, [['Acclaim Import function', 'C:\\mocap\\man.asf', '', false, false, 1, true, false, true, false, true]]);
eq('AcclaimImport OK: ten arguments written back; property deleted', [A.ok, A.propAfter], [{ SkeletonFileName: 'C:\\mocap\\man.asf', MotionFileName: '', CropMotionValuesToLimit: false, OverrideBoneLengthMultiplier: false, BoneLengthMultiplier: 1, InserMotion: true, NullsHierarchy: false, GaplessSkeleton: true, SI3DChains: false, GroupAnimObjs: true }, false]);
eq('AcclaimImport: LengthMultiplier minimum 0.005; empty ASFFile -> browser; empty result = cancel', [A.minMultiplier, A.browser, A.browserCancel], [0.005, ['Select a .ASF file', 'ASF (*.asf)|*.asf|All Files (*.*)|*.*||'], [0, false]]);

// ---- dotXSI
const X = got.xsi;
eq('ImportDotXSI: missing file -> legacy path, ".xsi Import Options" dialog with the SPDL defaults', [X.importTitle, X.importTab, X.importRows], ['.xsi Import Options', ['Import'], ['anim_import=true', 'classical_scaling=true', 'mat_import=true', 'txt_import=true', 'norm_import=false', 'raw_fcurves=false']]);
eq('ImportDotXSI legacy OK: SIImportDotXSIFile FileName, Parent', X.missingOk, [true, [['SIImportDotXSIFile', 'C:\\xsi\\missing.xsi', 'cube']]]);
eq('ImportDotXSI: version 0300 -> legacy dialog; Cancel does nothing', [X.oldDialog, X.oldCancel], ['.xsi Import Options', [false, 0]]);
eq('ImportDotXSI: version 0600 -> Crosswalk, no dialog: options created, Filename set, ImportCrosswalk <property>, Parent', [X.newRun, X.newDialog, X.newWorkers, X.newCalls, X.crossOpt], [NONE, false, ['CreateImportCrosswalkOptions', 'ImportCrosswalk'], [['ImportCrosswalk', 'ImportCrosswalkOptions', 'cube']], [true, 'C:\\xsi\\new.xsi']]);
eq('ImportDotXSI: ".dae" anywhere in the lower-cased name -> Crosswalk; the existing options property is reused', [X.daeWorkers, X.daeCalls, X.crossOptReused], [['ImportCrosswalk'], [['ImportCrosswalk', 'ImportCrosswalkOptions', '']], [1, 'C:\\XSI\\Scene.DAE']]);
ok('ImportDotXSI: a first line without a numeric version is reported as not yet attested', typeof X.odd === 'string' && /not yet attested/.test(X.odd), X.odd);
eq('ImportDotXSI: licence "Avid 3D" -> legacy importer directly, no dialog', X.avid, [NONE, false, [['SIImportDotXSIFile', 'C:\\xsi\\new.xsi', 'p']]]);
eq('ExportDotXSI: ".xsi Export Options" dialog, groups, format defaults', [X.exportTitle, X.exportGroups, X.exportFormat], ['.xsi Export Options', ['dotXSI File', 'Geometry', 'Animation', 'Animation Filtering', 'Relations', '', '', 'Textures'], ['1', ['Ascii=1', 'Binary=0'], '300', ['3.0=300', '3.5=350', '3.6=360']]]);
eq('ExportDotXSI OK: empty Model = the scene root; SIExportDotXSIFile <models>, FileName', X.exportRoot, [true, [['SIExportDotXSIFile', ['Scene_Root'], 'C:\\xsi\\out.xsi']]]);
eq('ExportDotXSI OK with models; Cancel does nothing', [X.exportTwo, X.exportCancel], [[true, [['SIExportDotXSIFile', ['cube', 'sphere'], 'C:\\xsi\\two.xsi']]], [false, 0]]);

// ---- ImportIges
const G = got.iges;
eq('ImportIges: worker not wired -> nothing back, "not yet attested" logged', [G.noWorker, G.noWorkerLog], [NONE, 1]);
eq('ImportIges: SIImportIges(FileName) only (Parent unused); the object is selected, auto-inspected and handed back', [G.calls, G.withWorker, G.sel, G.inspected], [[['SIImportIges', 'C:\\cad\\part.igs']], 'node:sphere1', ['sphere1'], ['sphere1']]);
eq('ImportIges: no inspection with auto-inspect off; nothing back -> nothing selected', [G.noAutoInspect, G.nothingBack], [0, [NONE, 0]]);

// ---- CreateRefModel
const R = got.createRef;
eq('CreateRefModel: empty FileName -> empty referenced model, selected, returned', R.empty, ['model', true, '', true]);
eq('CreateRefModel: missing file -> empty creator; file name recorded on the resolution; name, parent, options kept', R.missing, ['Hero', 'C:\\models\\nofile.emdl', ['C:\\models\\nofile.emdl'], ['hi'], 'root_null', 3, true]);
eq('CreateRefModel: existing file -> SICreateRefModel with all eight arguments in order; result selected', R.existing, [true, [['SICreateRefModel', 'C:\\models\\rig.emdl', 'Rig', 'res1', 'cube', true, true, 'map', 65535]], true]);
eq('CreateRefModel: creation failed -> nothing returned, nothing selected; unwired worker is logged', [R.failed, R.noWorker], [[NONE, 0], [NONE, 1]]);

// ---- model commands
const M = got.models;
eq('CreateModelAndConvertToRef: CreateModel Objects, then ConvertToRefModel <model>, FileName; yields no value (Q5)', M.wrap, [NONE, null, 'model', 'cubeRef', true]);
eq('CreateModelAndConvertToRef: Objects defaults to the selection', M.wrapSelection, [NONE, 'model', 'sphRef', true]);
eq('ToggleReferencedModel: referenced -> local (MakeModelLocal); selection unchanged; no value', M.t1, [NONE, false, 'cubeRef', ['sphere']]);
eq('ToggleReferencedModel: local -> ConvertToRefModel with the active resolution file; an object stands for its model', M.t2, [NONE, 'cubeRef', true]);
eq('ToggleReferencedModel: Yes / No box, text 10010, caption "Toggling <model>"', M.box, ['Toggling Model', 'This operation is destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to proceed?', 'Yes', 'No']);
eq('ToggleReferencedModel: No does nothing, Yes converts', [M.no, M.yes], [false, 'cubeRef']);
eq('ToggleReferencedModel: the scene root is refused with a warning', M.rootLog, ['info:WARNING : Cannot toggle the active SceneRoot!']);
eq('ToggleReferencedModel: a model that was never referenced', [M.neverLog, M.neverRef], [['error:You cannot toggle this model. It has not been a referenced model before.'], false]);
eq('ToggleReferencedModel: an item with no owning model logs the error and stops the whole loop', [M.stopLog, M.stopLeft], [['error:Object no_such_thing is not a 3D object'], 'cubeRef']);
eq('ToggleReferencedModel: batch with ShowWarnings converts nothing (confirmation not attested, Q4)', M.batch, [NONE, false]);
eq('RemoveUnusedDeltas: deltas with a live target are left alone', M.deltaLive, [NONE, true, true]);
eq('RemoveUnusedDeltas: a delta whose target is gone is deleted; nothing logged; selection unchanged', M.deltaDead, [NONE, true, false, [], ['cube']]);
eq('RemoveUnusedDeltas: undoable', M.deltaUndo, true);

// ---- SearchAndReplacePath
const Q = got.search;
eq('SearchAndReplacePath: project list (image sources and clips, referenced-model files, extra entries)', Q.before, ['Pictures:C:\\pics\\bump.pic', 'Pictures:C:\\pics\\bump.pic', 'Pictures:C:\\pics\\bump.pic', 'Pictures:C:\\pics\\bump.pic', 'Pictures:D:\\x\\rock.tga', 'Pictures:D:\\x\\rock.tga', 'Models:C:\\models\\nofile.emdl', 'Models:cubeRef', 'Models:sphRef', 'Audio:C:\\pics\\snd\\Voice.wav']);
ok('SearchAndReplacePath direct: text compare by default; every changed path logged "Changing <old> To <new>"; no return value',
  Q.direct === NONE && Q.directLog.filter(l => l === 'info:Changing C:\\pics\\bump.pic To D:\\tex\\bump.pic').length === 4 && Q.directLog.includes('info:Changing C:\\pics\\snd\\Voice.wav To D:\\tex\\snd\\Voice.wav') && Q.directLog.filter(l => l.startsWith('info:')).length === 5, Q.directLog);
eq('SearchAndReplacePath direct: Category = file type touches only that type', Q.audioOnly, [['Audio:E:\\snd\\Voice.wav'], ['info:Changing D:\\tex\\snd\\Voice.wav To E:\\snd\\Voice.wav']]);
eq('SearchAndReplacePath direct: category comparison is exact ("audio" is not "Audio")', Q.categoryExact, 0);
eq('SearchAndReplacePath direct: CaseSensitive = binary compare; empty NewString removes the text', [Q.caseSensitive, Q.emptyNew], [[0, 'E:\\snd\\Voice.wav'], 'E:\\snd\\.wav']);
eq('SearchAndReplacePath direct: Files argument replaces the project list; every occurrence replaced', Q.filesArg, ['a--b--c', ['info:Changing aXbXc To a--b--c'], 'E:\\snd\\.wav']);
eq('SearchAndReplacePath direct: undoable', Q.undo, [true, 2, 0]);
eq('SearchAndReplacePath dialog: Search_And_Replace, title 1129, labels and initial values', Q.dlg, ['Search and Replace', [['File_Category', 'File Category', 'All'], ['Old_String', 'Old String', 'old string'], ['New_String', 'New String', 'new string'], ['Case_Sensitive', 'Case Sensitive', false]]]);
eq('SearchAndReplacePath dialog: empty New String', Q.dlgEmptyNew, [['error:Parameter New String is empty. script command not completed'], false]);
eq('SearchAndReplacePath dialog: checks run in order (category first, then old string)', [Q.dlgEmptyCat, Q.dlgEmptyOld], [['error:Parameter Type Parameter is empty. script command not completed'], ['error:Parameter Old String is empty. script command not completed']]);
eq('SearchAndReplacePath dialog OK: calls itself in direct form (second logged line), property deleted', Q.dlgOk, [[true], 4, 4, false]);
eq('SearchAndReplacePath dialog Cancel: nothing happens, property deleted', Q.dlgCancel, [0, false]);

// ---- defaults in batch mode
for (const n of NAMES) eq(`${n}: runs with default arguments (batch) without throwing`, got.defaults[n].err, null);
const DF = got.defaults;
ok('defaults: ObjExport batch = worker form on the whole selection', DF.ObjExport.log.includes('info:Model.cube'), DF.ObjExport.log);
ok('defaults: the five dialog forms end like a cancel in batch (Q4, logged as not yet attested)', ['SI_InspectWavefrontImportOptions', 'BiovisionImport', 'AcclaimImport', 'SearchAndReplacePath'].every(n => DF[n].log.some(l => /not yet attested: batch mode/.test(l))) && got.defaultsLeft.length === 0, [DF.BiovisionImport.log, got.defaultsLeft]);
ok('defaults: ImportDotXSI / ExportDotXSI option pages are skipped in batch', [DF.ImportDotXSI, DF.ExportDotXSI].every(d => d.v === NONE && d.log.some(l => /not yet attested: batch mode/.test(l))), [DF.ImportDotXSI, DF.ExportDotXSI]);
ok('defaults: CreateRefModel returns the new model; RemoveUnusedDeltas / ToggleReferencedModel / CreateModelAndConvertToRef yield none', /^node:/.test(String(DF.CreateRefModel.v)) && DF.RemoveUnusedDeltas.v === NONE && DF.ToggleReferencedModel.v === NONE && DF.CreateModelAndConvertToRef.v === NONE, [DF.CreateRefModel.v, DF.ToggleReferencedModel.v]);
eq('no modal window left open', got.modalsLeft, 0);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-04b import / export and model script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-04b import / export and model script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired (command layer): SI_InspectWavefrontImportOptions, SetupDisplacement, CreateModelAndConvertToRef, ToggleReferencedModel, RemoveUnusedDeltas, SearchAndReplacePath');
console.log('   partly wired (script layer complete; the worker behind it is another row, logged "not yet attested" until wired): ObjExport, BiovisionImport, AcclaimImport, ImportDotXSI, ExportDotXSI, ImportIges, CreateRefModel (file-backed branch)');
