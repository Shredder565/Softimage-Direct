// CMD-B13c (dotXSIConverter.64.dll): the 11 commands of src/commands/crosswalkB13c*.ts. There is no XSIBATCH golden
// for the row: this is a contract check against docs/ghidra/cmd-b13c-dotxsiconverter-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      the plug-in commands are not in the registry dump, so data/commands_full.json gives the list and defaults);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (option properties and values, extension rules, ExportCustomFile /
//      ImportCustomFile dispatch through the converter events, phase order, logged texts, statuses, undo).
// The Crosswalk writers / readers are not attested (SPEC-PARTIAL): only their "not yet attested" log is checked.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_crosswalk_b13c_commands.mjs
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

const NAMES = ['CreateExportCrosswalkOptions', 'CreateExportFTKOptions', 'CreateImportCrosswalkOptions', 'CreateImportFTKOptions', 'CrosswalkExportMatLib',
  'CrosswalkImportMatLib', 'CrosswalkVersion', 'ExportCrosswalk', 'ExportFTK', 'ImportCrosswalk', 'ImportFTK'];
const DEFAULT_FAILS = new Set(['CrosswalkExportMatLib', 'ExportCrosswalk', 'ExportFTK', 'ImportCrosswalk', 'ImportFTK']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  const args = c ? c.args.filter(a => !(a.flags & 0x200)) : f ? f.args.filter(a => !((a.flags ?? 0) & 0x200)) : null;
  return [n, args ? args.map(a => [a.name, a.default ?? fd[a.name] ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ExportCrosswalk') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.crosswalkB13c; const H = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube'); const root = A.scene.root;
  const reset = () => { A.select([cube]); };
  const undoTo = (n) => { while (A.undoStack.length > n) A.undo(); };

  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const p0 = root.properties.length;
    const r = run(n);
    undoTo(u0); while (root.properties.length > p0) root.removeProperty(root.properties.at(-1));
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ================= CrosswalkVersion
  { const u0 = A.undoStack.length; const r = run('CrosswalkVersion'); ok('CrosswalkVersion: returns "2015.0", no side effects', r.v === '2015.0' && A.undoStack.length === u0, r); }
  // ================= Create*Options
  {
    const u0 = A.undoStack.length;
    const r = run('CreateExportCrosswalkOptions'); const p = r.v;
    ok('CreateExportCrosswalkOptions: default -> ExportCrosswalkOptions property on the scene root', !r.err && p?.type === 'ExportCrosswalkOptions' && p.name === 'ExportCrosswalkOptions' && root.properties.includes(p), r.err);
    const V = (n) => p.val(n);
    ok('CreateExportCrosswalkOptions: values at creation (2.3)', V('Format') === 0 && V('Verbose') === true && V('ExportXSIExtra') === true && V('ExportSelectionOnly') === false && V('ExportMaterials') === true
      && V('ExportImageClips') === true && V('ExportUsedMaterialsAndImagesOnly') === true && V('ExportGeometries') === true && V('ApplySubdivisionToGeometry') === false && V('Triangulate') === false
      && V('ExportTangentsAsVtxColor') === false && V('ShapeAnim') === 1 && V('PlotAnimation') === false && V('PlotNonFCurveActionSources') === false && V('PlotStartFrame') === Math.trunc(A.anim.startFrame)
      && V('PlotEndFrame') === Math.trunc(A.anim.endFrame) && V('PlotStepFrame') === 1 && V('PlotInterpolation') === 0 && V('PlotFit') === true && V('PlotFitTolerance') === 1 && V('PlotProcessRotation') === true
      && V('ExportXSINormals') === false && V('PreserveIK') === false && V('Target') === 0 && V('PathRelative') === true && V('ExportAllActionSources') === true && V('Models') === ''
      && V('MatLib_ExportUsedImageClipsOnly') === false && !!p.get('InfoGrid') && !!p.get('ActionSourceExportTable'), p.params.map(x => [x.def.name, x.value]));
    ok('CreateExportCrosswalkOptions: Filename = <active project>\\dotXSI\\ when no file was used yet', /\\dotXSI\\$/.test(V('Filename')), V('Filename'));
    ok('CreateExportCrosswalkOptions: Format enum values (0 / 2 / 1 / 3 / 4)', p.get('Format').def.items.map(i => `${i.label}=${i.value}`).join('|') === '.XSI 5.0 (text)=0|.XSI 5.0 (binary)=2|COLLADA 1.4.1=1|.XSI 6.0 (text)=3|.XSI 6.0 (binary)=4');
    ok('CreateExportCrosswalkOptions: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('CreateExportCrosswalkOptions: undo', !root.properties.includes(p));
    const r2 = run('CreateExportCrosswalkOptions', { arg0: 'cube', arg1: 'B13cOpts' });
    ok('CreateExportCrosswalkOptions: object path + name -> on the object, renamed', !r2.err && r2.v?.name === 'B13cOpts' && cube.properties.includes(r2.v), r2.err);
    const u1 = A.undoStack.length; const r3 = run('CreateExportCrosswalkOptions', { arg0: 'NoSuchB13c' });
    ok('CreateExportCrosswalkOptions: unresolvable path -> nothing created, success', !r3.err && (r3.v === null || r3.v === undefined) && A.undoStack.length === u1, r3);
    const r4 = run('CreateExportCrosswalkOptions', { arg1: '' }); ok('CreateExportCrosswalkOptions: empty name -> ExportCrosswalkOptions', r4.v?.name === 'ExportCrosswalkOptions');
    const f = run('CreateExportFTKOptions').v; ok('CreateExportFTKOptions: ExportFTKOptions, same parameter set', f?.type === 'ExportFTKOptions' && f.name === 'ExportFTKOptions' && f.params.length === r4.v.params.length);
    const i = run('CreateImportCrosswalkOptions').v;
    ok('CreateImportCrosswalkOptions: ImportCrosswalkOptions with Filename, Verbose, OptimizeForXSI, ImportTimelineSettings, Target, InfoGrid (2.4)', i?.type === 'ImportCrosswalkOptions' && i.params.map(x => x.def.name).join() === 'Filename,Verbose,OptimizeForXSI,ImportTimelineSettings,Target,InfoGrid'
      && i.val('Verbose') === true && i.val('OptimizeForXSI') === true && i.val('ImportTimelineSettings') === true && i.val('Target') === 0);
    const fi = run('CreateImportFTKOptions').v; ok('CreateImportFTKOptions: ImportFTKOptions', fi?.type === 'ImportFTKOptions' && fi.name === 'ImportFTKOptions');
    undoTo(u0);
  }
  // ================= ExportCrosswalk / ExportFTK
  {
    const u0 = A.undoStack.length; const T = A.tasksB11c;
    H.ensureFolder('C:\\B13c\\out');
    const p = A.run('CreateExportCrosswalkOptions', { arg1: 'B13cExport' }); p.set('Filename', 'C:\\B13c\\out\\scene');
    const ne = T.events.length; const nr = S.runs.length;
    const r = run('ExportCrosswalk', { arg0: p.fullName });
    const ev = T.events.slice(ne);
    ok('ExportCrosswalk: format 0 appends .xsi, runs ExportCustomFile (begin / converter event 0x20510027 / end)', !r.err && ev.map(e => e.id.toString(16)).join() === '20510013,20510027,20510014' && ev[1].name === 'CrosswalkExportCustomFileXSI' && ev[1].fileName === 'C:\\B13c\\out\\scene.xsi', [r.err, ev]);
    const run1 = S.runs[nr];
    ok('ExportCrosswalk: the internal exporter runs its phases in order (2.5)', S.runs.length === nr + 1 && run1.kind === 'export' && run1.property === p && run1.phases[0] === 'Set version' && run1.phases.at(-1) === 'Export completed' && run1.phases.indexOf('Converting materials') < run1.phases.indexOf('Filtering pass'), run1);
    ok('ExportCrosswalk: the writer is logged as not yet attested; Verbose logs the phases', has(r, /not yet attested: the dotXSI \/ COLLADA scene converters and writer/) && has(r, /CrosswalkExportCustomFile: Writing file/), r.log);
    ok('ExportCrosswalk: ExportCustomFile receives the original argument array as UserData', S.customFileCalls.at(-1).command === 'ExportCustomFile' && S.customFileCalls.at(-1).args[0] === 'C:\\B13c\\out\\scene.xsi');
    p.set('Filename', 'C:\\B13c\\out\\scene.XSI'); run('ExportCrosswalk', { arg0: p });
    ok('ExportCrosswalk: a name already ending in .xsi (any case) is kept', T.events.at(-2).fileName === 'C:\\B13c\\out\\scene.XSI');
    p.set('Format', 1); p.set('Filename', 'C:\\B13c\\out\\scene'); run('ExportCrosswalk', { arg0: p });
    ok('ExportCrosswalk: COLLADA appends .dae', T.events.at(-2).fileName === 'C:\\B13c\\out\\scene.dae' && T.events.at(-2).name === 'CrosswalkExportCustomFileDAE');
    p.set('Filename', 'C:\\B13c\\out\\scene.xml'); run('ExportCrosswalk', { arg0: p });
    ok('ExportCrosswalk: COLLADA keeps .xml', T.events.at(-2).fileName === 'C:\\B13c\\out\\scene.xml' && T.events.at(-2).name === 'CrosswalkExportCustomFileXML');
    p.set('Format', 4); p.set('Filename', 'C:\\B13c\\out\\bin'); const rf = run('ExportFTK', { arg0: p });
    ok('ExportFTK: same as ExportCrosswalk (format 4 -> .xsi)', !rf.err && T.events.at(-2).fileName === 'C:\\B13c\\out\\bin.xsi', rf.err);
    const rb = run('ExportCrosswalk', { arg0: 'NoSuchB13c' });
    ok('ExportCrosswalk: invalid property -> "Invalid export properties: <NoSuchB13c>", 0x80070057', status(rb, '80070057') && has(rb, /^Invalid export properties: <NoSuchB13c>$/), rb);
    p.set('Format', 0); p.set('Filename', 'C:\\B13cMissing\\x'); const rm = run('ExportCrosswalk', { arg0: p });
    ok('ExportCrosswalk: the ExportCustomFile failure status is returned', status(rm, '80070057') && has(rm, /\[0x51\]/), rm);
    // ExportSelectionOnly: the event target (scene root) is selected for the export, then the selection restored
    p.set('Filename', 'C:\\B13c\\out\\sel'); p.set('ExportSelectionOnly', true);
    let during = null; const orig = A.select.bind(A); A.select = (n, m) => { if (during === null && n?.[0] === root) during = [...n]; return orig(n, m); };
    run('ExportCrosswalk', { arg0: p }); A.select = orig;
    ok('ExportCrosswalk ExportSelectionOnly: target selected during the export, selection restored', during?.[0] === root && A.selection.length === 1 && A.selection[0] === cube, [during?.map(x => x.name), A.selection.map(x => x.name)]);
    undoTo(u0); reset();
  }
  // ================= ImportCrosswalk / ImportFTK
  {
    const u0 = A.undoStack.length; const B = A.tasksB11b;
    H.ensureFolder('C:\\B13c\\in'); H.writeFile('C:\\B13c\\in\\a.dae', '<?xml version="1.0"?>\n'); H.writeFile('C:\\B13c\\in\\b.xsi', 'xsi 0600txt 0032\n');
    const p = A.run('CreateImportCrosswalkOptions', { arg1: 'B13cImport' }); p.set('Filename', 'C:\\B13c\\in\\a.dae');
    const ne = B.events.length; const nr = S.runs.length; const fps = A.anim.fps;
    const r = run('ImportCrosswalk', { ppg: p, parent: 'cube' });
    const ev = B.events.slice(ne);
    ok('ImportCrosswalk: runs ImportCustomFile (converter event 0x20510026 for .dae, Target = parent)', !r.err && ev.some(e => e.id === 0x20510026 && e.args[0] === 'dae'), [r.err, ev]);
    const run1 = S.runs[nr];
    ok('ImportCrosswalk: COLLADA by extension, phases in order, file name remembered', run1?.kind === 'import' && run1.collada === true && run1.phases[0] === 'Reading file' && run1.phases.at(-1) === 'Import completed' && S.lastFileName === 'C:\\B13c\\in\\a.dae', run1);
    ok('ImportCrosswalk: the reader is logged as not yet attested; the timeline kept', has(r, /not yet attested: the COLLADA reader/) && A.anim.fps === fps);
    const q = A.run('CreateImportCrosswalkOptions', { arg1: 'B13cImport2' });
    ok('ImportCrosswalk: the next options property starts from the last file name', q.val('Filename') === 'C:\\B13c\\in\\a.dae');
    p.set('Filename', 'C:\\B13c\\in\\b.xsi'); const rf = run('ImportFTK', { ppg: p, parent: 'cube' });
    ok('ImportFTK: same as ImportCrosswalk (dotXSI by extension)', !rf.err && S.runs.at(-1).collada === false, rf.err);
    const rb = run('ImportCrosswalk', { ppg: 'NoSuchB13c' });
    ok('ImportCrosswalk: invalid property -> "Invalid import properties: <NoSuchB13c>", 0x80070057', status(rb, '80070057') && has(rb, /^Invalid import properties: <NoSuchB13c>$/), rb);
    p.set('Filename', 'C:\\B13c\\in\\missing.xsi'); const rm = run('ImportCrosswalk', { ppg: p });
    ok('ImportCrosswalk: the ImportCustomFile failure is returned (missing file)', status(rm, '80070057'), rm);
    undoTo(u0); reset();
  }
  // ================= CrosswalkExportMatLib / CrosswalkImportMatLib
  {
    const u0 = A.undoStack.length; const p0 = root.properties.length; const nr = S.runs.length;
    const r = run('CrosswalkExportMatLib', { Filename: 'C:\\B13c\\out\\lib', MatLib: 'DefaultLib', Binary: true, ExportUsedImageClipsOnly: false });
    const x = S.runs[nr];
    ok('CrosswalkExportMatLib: temporary options with Format 4 (binary), no extension forced, MatLib_ExportUsedImageClipsOnly set', !r.err && x?.kind === 'matlib-export' && x.format === 4 && x.file === 'C:\\B13c\\out\\lib' && x.property.val('MatLib_ExportUsedImageClipsOnly') === false && x.library === 'DefaultLib', [r.err, x]);
    ok('CrosswalkExportMatLib: library phases only, then the temporary property is deleted', x.phases.join('|') === 'Set version|Converting scene info|Converting environment|Converting image clips|Converting image clip animations|Converting materials|Converting material animations|Writing file|Export completed' && root.properties.length === p0, x.phases);
    run('CrosswalkExportMatLib', { Filename: 'C:\\B13c\\out\\lib2', MatLib: 'DefaultLib' }); ok('CrosswalkExportMatLib: Binary false -> Format 3', S.runs.at(-1).format === 3);
    const rb = run('CrosswalkExportMatLib', { Filename: 'C:\\x', MatLib: 'NoLibB13c' });
    ok('CrosswalkExportMatLib: unknown library -> "Invalid material library: <NoLibB13c>", 0x80070057, temporary property deleted', status(rb, '80070057') && has(rb, /^Invalid material library: <NoLibB13c>$/) && root.properties.length === p0, rb);
    const fps = A.anim.fps;
    const ri = run('CrosswalkImportMatLib', { Filename: 'C:\\B13c\\in\\b.xsi', MatLib: 'DefaultLib' }); const y = S.runs.at(-1);
    ok('CrosswalkImportMatLib: temporary ImportCrosswalkOptions (ImportTimelineSettings off), library phases, timeline kept, property deleted', !ri.err && y.kind === 'matlib-import' && y.property.val('ImportTimelineSettings') === false
      && y.phases[0] === 'Reading file' && y.phases.includes('Material library pass') && y.phases.at(-1) === 'Import completed' && A.anim.fps === fps && root.properties.length === p0, [ri.err, y]);
    ok('CrosswalkImportMatLib: verbose off (no phase lines logged)', !has(ri, /CrosswalkImportMatLib: Reading file/));
    undoTo(u0);
  }
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
console.log(`compare_crosswalk_b13c_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
