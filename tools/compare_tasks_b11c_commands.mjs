// CMD-B11c (tasks.dll): the 21 commands of src/commands/tasksB11c*.ts (the row's `AddToTOC` is owned by the CMD-B10
// corrections and is not checked here). There is no XSIBATCH golden for the row: this is a contract check against
// docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (return values, scene / file state, logged ids, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tasks_b11c_commands.mjs
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
  'CopyCacheFiles2', 'CreatePreset', 'Emission Pop-up Menu', 'EvaluateCurveAt', 'Event Pop-up Menu', 'ExportCustomFile', 'Force Pop-up Menu',
  'GetCurveLength', 'GetKeyboardState', 'GetUserPref', 'InspectBrowse', 'InspectExternalReference', 'Open SE on Override parent', 'SICreateRefPlane',
  'SILoadPreset', 'SISaveDuplicateXformForUndo', 'SaveBackupScene', 'SavePreset', 'SaveSceneAs', 'SetReference', 'TagForDelete',
];
// Required input without a usable default (cube selected): the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['CopyCacheFiles2', 'CreatePreset', 'EvaluateCurveAt', 'ExportCustomFile', 'GetCurveLength', 'GetUserPref',
  'InspectExternalReference', 'SILoadPreset', 'SaveBackupScene', 'SavePreset', 'SaveSceneAs', 'SetReference']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n); if (!c) return [n, null];
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? fd[a.name] ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');   // the sample scene (cube) is the demo scene
await page.waitForFunction(() => !!window.Application?.commands?.get('SaveSceneAs') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.tasksB11c; const fs = A.hostFs ?? null;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };
  out.hasFs = !!fs;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  out.addToTOC = A.commands.has('AddToTOC');

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    if (n === 'TagForDelete') { A.undo(); A.redo(); A.undoStack.length = u0; A.redoStack.length = 0; }   // undo deletes the tagged cube; redo brings it back
    else while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  ok('TagForDelete default run leaves the cube in the scene', !!A.scene.find('cube'));
  reset();
  const H = (() => { try { return window.Application.hostFs; } catch { return null; } })();
  // host file system: the CMD-01b virtual tree (exposed on the app by the SDK helper row, else through the module)
  const hfs = H ?? window.__hostFs;
  ok('virtual host file system reachable', !!hfs);
  const proj = S.projectPath;

  // ================= SaveSceneAs
  {
    const f = 'C:\\B11c\\scenes\\one.scn';
    const r = run('SaveSceneAs', { SceneFileName: f });
    ok('SaveSceneAs writes the scene file', !r.err && hfs.isFile(f) && S.savedScenes.includes(f), r.err);
    ok('SaveSceneAs returns S_FALSE', S.lastStatus?.status === 1, S.lastStatus);
    ok('SaveSceneAs does not enter the undo stack', !A.undoStack.some(u => u.label === 'SaveSceneAs'));
    const r2 = run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\two' });
    ok('SaveSceneAs: a name without an extension gets .scn (inferred, logged)', r2.v === 'C:\\B11c\\scenes\\two.scn' && hfs.isFile('C:\\B11c\\scenes\\two.scn') && has(r2, /not yet attested: the target file-name builder/), r2);
    ok('SaveSceneAs: CopyExtFiles above 2 -> 0x80070057', status(run('SaveSceneAs', { SceneFileName: f, CopyExtFiles: 3 }), '80070057'));
    const r3 = run('SaveSceneAs', { SceneFileName: f, CopyExtFiles: 1 }); ok('SaveSceneAs: CopyExtFiles 1 logs the unread copy helper', !r3.err && nya(r3) >= 2, r3);
    ok('SaveSceneAs: other extension without converter -> 0x80070057', status(run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\x.b11x' }), '80070057'));
    let got = null; S.registerCustomConverter('b11x', 'B11xExport', (ctx) => { got = ctx; hfs.ensureFolder(hfs.parentPath(ctx.fileName)); hfs.writeFile(ctx.fileName, 'custom'); });
    const r4 = run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\x.b11x' });
    ok('SaveSceneAs: custom converter fired on the scene root with the file name', !r4.err && got?.target?.[0] === A.scene.root && got?.fileName === 'C:\\B11c\\scenes\\x.b11x', r4.err);
    S.registerCustomConverter('b11y', 'Failing', () => 0x80004005);
    const r5 = run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\x.b11y' });
    ok('SaveSceneAs: a failing save raises XSITASKS 0x43a and 0x80004005', status(r5, '80004005') && has(r5, /XSITASKS 0x43a/), r5);
    ok('SaveSceneAs: .exp is not a scene extension outside the alternate mode', status(run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\x.exp' }), '80070057'));
    S.altMode = true; const r6 = run('SaveSceneAs', { SceneFileName: 'C:\\B11c\\scenes\\x.exp' }); S.altMode = false;
    ok('SaveSceneAs: .exp saves in the alternate mode', !r6.err && hfs.isFile('C:\\B11c\\scenes\\x.exp'), r6.err);
  }
  // ================= SaveBackupScene
  {
    const r = run('SaveBackupScene', { SceneFileName: proj });
    ok('SaveBackupScene: <project>\\Backup_Manual\\<scene>_Backup01.scn', /\\Backup_Manual\\.+_Backup01\.scn$/.test(r.v ?? '') && hfs.isFile(r.v), r);
    const r2 = run('SaveBackupScene', { SceneFileName: proj });
    ok('SaveBackupScene: next free number', /_Backup02\.scn$/.test(r2.v ?? ''), r2.v);
    const r3 = run('SaveBackupScene', { SceneFileName: 'D:\\elsewhere\\x.scn' });
    ok('SaveBackupScene: outside a project raises 0x24, 0x80004005', status(r3, '80004005') && has(r3, /\[0x24\]/), r3);
    A.prefValues = { ...(A.prefValues ?? {}), 'data_management.manual_backup_project_path': proj };
    const r4 = run('SaveBackupScene');
    ok('SaveBackupScene: empty name uses data_management.manual_backup_project_path', /_Backup03\.scn$/.test(r4.v ?? ''), r4);
    delete A.prefValues['data_management.manual_backup_project_path'];
    S.altMode = true; const r5 = run('SaveBackupScene', { SceneFileName: proj + '\\Scenes\\alt.SCN' }); S.altMode = false;
    ok('SaveBackupScene: .SCN becomes .exp in the alternate mode', /alt\.exp$/.test(r5.v ?? '') && hfs.isFile(r5.v), r5);
    ok('SaveBackupScene: other extension uses a converter', !run('SaveBackupScene', { SceneFileName: proj + '\\Scenes\\b.b11x' }).err && hfs.isFile(proj + '\\Scenes\\b.b11x'));
  }
  // ================= ExportCustomFile
  {
    hfs.ensureFolder('C:\\B11c\\export');
    let ctx = null; S.registerCustomConverter('b11e', 'B11eExport', (c) => { ctx = c; });
    const e0 = S.events.length;
    const r = run('ExportCustomFile', { FileName: 'C:\\B11c\\export\\a.b11e', Frame: 7, UserData: 'u' });
    const ev = S.events.slice(e0).map(e => e.id.toString(16));
    ok('ExportCustomFile: begin, converter, end events', !r.err && ev.join() === '20510013,20510027,20510014', [r.err, ev]);
    ok('ExportCustomFile: empty Target = scene root; Frame and UserData passed', ctx?.target?.[0] === A.scene.root && ctx.frame === 7 && ctx.userData === 'u', ctx && [ctx.frame, ctx.userData]);
    run('ExportCustomFile', { FileName: 'C:\\B11c\\export\\b.b11e', Target: 'cube' }); ok('ExportCustomFile: explicit Target', ctx?.target?.[0] === cube);
    const r2 = run('ExportCustomFile', { FileName: 'C:\\B11c\\export\\a.none' });
    ok('ExportCustomFile: no converter logs XSITASKS 0x427 with the extension, 0x80070057', status(r2, '80070057') && has(r2, /XSITASKS 0x427\] none/), r2);
    const r3 = run('ExportCustomFile', { FileName: 'C:\\B11c\\missing\\a.b11e' });
    ok('ExportCustomFile: not writable logs 0x51, 0x80070057', status(r3, '80070057') && has(r3, /\[0x51\]/), r3);
    ok('ExportCustomFile: refused destination logs 0xa0', has(run('ExportCustomFile', { FileName: 'relative.b11e' }), /\[0xa0\]/));
    S.beginExportHandlers.push(() => 0x562e80c7); ctx = null;
    const r4 = run('ExportCustomFile', { FileName: 'C:\\B11c\\export\\c.b11e' }); S.beginExportHandlers.length = 0;
    ok('ExportCustomFile: an aborted begin export stops (no converter, no error)', !r4.err && ctx === null && S.lastStatus.status === 0x562e80c7, r4);
  }
  // ================= CopyCacheFiles2
  {
    const s0 = A.anim.startFrame, e0 = A.anim.endFrame; A.anim.startFrame = 1; A.anim.endFrame = 3;
    hfs.ensureFolder('C:\\B11c\\src');
    for (let f = 1; f <= 3; f++) hfs.writeFile(`C:\\B11c\\src\\cube_A.${f}.icecache`, 'frame' + f);
    const src = 'C:\\B11c\\src\\[object]_[version].[frame].icecache', dst = 'C:\\B11c\\dst\\[model]\\[object]_[version].[frame].icecache';
    const r = run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src, TargetPath: dst });
    ok('CopyCacheFiles2 copies every frame file', r.v?.Copied === 3 && hfs.readFile('C:\\B11c\\dst\\Scene_Root\\cube_A.2.icecache') === 'frame2', r);
    ok('CopyCacheFiles2 progress caption', S.progress.includes('Copying cache files for Scene_Root.cube'));
    ok('CopyCacheFiles2 returns S_FALSE, no failure messages', S.lastStatus.status === 1 && !has(r, /0x41c/), r.log);
    const r2 = run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src, TargetPath: dst });
    ok('CopyCacheFiles2: Overwrite false keeps existing files and logs 0x41c / 0x41d', r2.v?.Copied === 0 && has(r2, /0x41c/) && has(r2, /0x41d/), r2);
    hfs.writeFile('C:\\B11c\\src\\cube_A.2.icecache', 'new2');
    run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src, TargetPath: dst, Overwrite: true });
    ok('CopyCacheFiles2: Overwrite true replaces', hfs.readFile('C:\\B11c\\dst\\Scene_Root\\cube_A.2.icecache') === 'new2');
    const r3 = run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src, TargetPath: dst, Version: 'B', Overwrite: true });
    ok('CopyCacheFiles2: a missing source logs 0x420', has(r3, /XSITASKS 0x420\]/) && has(r3, /0x41c/), r3.log);
    hfs.writeFile('C:\\B11c\\src\\cube.pc2', 'pc2');
    const r4 = run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: 'C:\\B11c\\src\\[object].pc2', TargetPath: 'C:\\B11c\\pc2\\[object].pc2' });
    ok('CopyCacheFiles2: a .pc2 source is copied once', r4.v?.Copied === 1, r4.v);
    ok('CopyCacheFiles2: unresolved token -> 0x8000ffff', status(run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src, TargetPath: 'C:\\B11c\\[shot]\\x' }), '8000ffff'));
    ok('CopyCacheFiles2: empty TargetPath -> 0x80070057', status(run('CopyCacheFiles2', { ObjectsToCache: 'cube', SourcePath: src }), '80070057'));
    A.anim.startFrame = s0; A.anim.endFrame = e0;
  }
  // ================= GetUserPref
  {
    ok('GetUserPref AutoInspect', run('GetUserPref', { Target: 'AutoInspect' }).v === A.autoInspect && S.lastStatus.status === 1);
    A.userPrefs = { ...(A.userPrefs ?? {}), B11cPref: 42 }; ok('GetUserPref: preferences manager value', run('GetUserPref', { Target: 'b11cpref' }).v === 42);
    A.prefValues = { ...(A.prefValues ?? {}), 'scripting.b11c': 'amb' }; ok('GetUserPref: ambient value', run('GetUserPref', { Target: 'scripting.b11c' }).v === 'amb');
    ok('GetUserPref: OperationMode through the CPM helper', run('GetUserPref', { Target: 'OperationMode' }).v === (A.immediate ? 1 : 0));
    const r = run('GetUserPref', { Target: 'NoSuchPrefB11c' }); ok('GetUserPref: unknown name fails (logged)', !!r.err && nya(r) === 1, r);
    ok('GetUserPref: non-string Target -> 0x80070057', status(run('GetUserPref', { Target: 5 }), '80070057'));
    ok('GetUserPref: empty Target -> 0x80004003', status(run('GetUserPref', { Target: '' }), '80004003'));
  }
  // ================= GetKeyboardState
  {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, altKey: true }));
    const r = run('GetKeyboardState');
    ok('GetKeyboardState: Shift = 1 (Shift) | 4 (Alt), KeyCode stays 0', r.v?.Shift === 5 && r.v?.KeyCode === 0 && S.lastStatus.status === 1, r.v);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', ctrlKey: true }));
    ok('GetKeyboardState: Ctrl = 2', run('GetKeyboardState').v?.Shift === 2);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    ok('GetKeyboardState: no modifier', run('GetKeyboardState').v?.Shift === 0);
  }
  // ================= SISaveDuplicateXformForUndo
  {
    const P = A.operatorsScripts?.prefs?.duplicate; ok('Preferences.Duplicate store present', !!P);
    P.tx = 0; P.sy = 1; run('SISaveDuplicateXformForUndo'); P.tx = 5; P.sy = 3;
    A.undo(); ok('SISaveDuplicateXformForUndo: undo writes the saved block back', P.tx === 0 && P.sy === 1, P);
    A.redo(); ok('SISaveDuplicateXformForUndo: redo re-applies the later block', P.tx === 5 && P.sy === 3, P);
    P.tx = 0; P.sy = 1;
  }
  // ================= TagForDelete
  {
    const o = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'b11cTagged' });
    const name = o?.name; const u0 = A.undoStack.length;
    run('TagForDelete', { InputObjs: name });
    ok('TagForDelete: Do keeps the object', !!A.scene.find(name) && A.undoStack.length === u0 + 1);
    A.undo(); ok('TagForDelete: undo deletes the tagged object', !A.scene.find(name));
    A.redo(); ok('TagForDelete: redo restores it', !!A.scene.find(name));
    A.undo(); A.undo(); ok('TagForDelete: object gone after undoing its creation too', !A.scene.find(name));
    A.redoStack.length = 0; reset();
  }
  // ================= presets
  {
    hfs.ensureFolder('C:\\B11c');
    const disp = cube.properties.find(p => p.params.some(x => typeof x.value === 'number' && !x.def.readOnly));
    const prm = disp.params.find(x => typeof x.value === 'number' && !x.def.readOnly);
    const v0 = prm.value;
    const r = run('SavePreset', { InputObj: disp, PresetName: 'B11cDisp', PresetPath: 'C:\\B11c\\presets', Description: 'd' });
    const file = 'C:\\B11c\\presets\\B11cDisp.Preset';
    ok('SavePreset writes PresetPath\\<name>.Preset and returns the preset', !r.err && hfs.isFile(file) && r.v?.file === file && r.v?.data?.classId === disp.type, r.err ?? r.v?.file);
    ok('SavePreset records the description', JSON.parse(hfs.readFile(file)).description === 'd');
    ok('SavePreset: Overwrite false on an existing file raises 0x3b, 0x80070005', (() => { const x = run('SavePreset', { InputObj: disp, PresetName: 'B11cDisp', PresetPath: 'C:\\B11c\\presets', Overwrite: false }); return status(x, '80070005') && has(x, /\[0x3b\]/); })());
    ok('SavePreset: relative PresetPath raises 0x25, 0x80070057', (() => { const x = run('SavePreset', { InputObj: disp, PresetName: 'B11cDisp', PresetPath: 'rel\\dir' }); return status(x, '80070057') && has(x, /\[0x25\]/); })());
    const ru = run('SavePreset', { InputObj: disp, PresetName: 'B11cUser', PresetLocation: 'siUserLocation' });
    ok('SavePreset: user location -> <user>\\Data\\DSPresets\\Properties\\<name>.Preset', /\\Data\\DSPresets\\Properties\\B11cUser\.Preset$/.test(ru.v?.file ?? ''), ru.v?.file ?? ru.err);
    A.undo(); ok('SavePreset: undo deletes the written file', !hfs.isFile(ru.v.file));
    const rw = run('SavePreset', { InputObj: disp, PresetName: 'B11cWg', PresetLocation: 3 });
    ok('SavePreset: workgroup location with no workgroup stops', !rw.err && rw.v === null && nya(rw) === 1, rw);
    ok('SavePreset: generic family (an object) has no family folder', /\\Data\\DSPresets\\B11cObj\.Preset$/.test(run('SavePreset', { InputObj: 'cube', PresetName: 'B11cObj', PresetLocation: 2 }).v?.file ?? ''));
    // SILoadPreset
    prm.value = typeof v0 === 'number' ? v0 + 1 : 1; const changed = prm.value;
    const l = run('SILoadPreset', { FileName: file, InputObj: disp });
    ok('SILoadPreset loads the saved values', !l.err && prm.value === v0, [l.err, prm.value, v0]);
    A.undo(); ok('SILoadPreset undo restores OldPresetStream', prm.value === changed, prm.value); prm.value = v0;
    const other = cube.properties.find(p => p.type !== disp.type);
    const lm = run('SILoadPreset', { FileName: file, InputObj: other });
    ok('SILoadPreset: class mismatch raises 0x52, 0x80070057', status(lm, '80070057') && has(lm, /\[0x52\]/), lm);
    const ln = run('SILoadPreset', { FileName: 'B11cNoSuch', InputObj: disp });
    ok('SILoadPreset: not found with UI shows simsgcat 0x95 and the picker (cancelled)', !ln.err && has(ln, /simsgcat 0x95\] B11cNoSuch/) && S.lastStatus.status === 0x562e80c7, ln);
    S.hooks.pickPresetFile = () => file; prm.value = changed;
    const lp = run('SILoadPreset', { FileName: 'B11cNoSuch', InputObj: disp }); delete S.hooks.pickPresetFile;
    ok('SILoadPreset: the picked file is loaded', !lp.err && prm.value === v0, lp.err); A.undo(); prm.value = v0;
    A.Interactive = false; const lb = run('SILoadPreset', { FileName: 'B11cNoSuch', InputObj: disp }); delete A.Interactive;
    ok('SILoadPreset: not found in batch -> 0x80030002', status(lb, '80030002'), lb);
    ok('SILoadPreset: by family folder name', !run('SILoadPreset', { FileName: 'B11cObj', InputObj: 'cube' }).err);
    A.undo();
    // CreatePreset
    const c = run('CreatePreset', { Name: 'B11cDisp', Path: 'C:\\B11c\\presets' });
    ok('CreatePreset: Path\\Name gives the preset object', c.v?.file === file && c.v?.data?.classId === disp.type && S.lastStatus.status === 1, c);
    const cf = run('CreatePreset', { Name: 'B11cDisp', Family: 'NoFamily' });
    ok('CreatePreset: unknown family raises 0x3eb, 0x80070057', status(cf, '80070057') && has(cf, /\[0x3eb\] NoFamily/), cf);
    const cn = run('CreatePreset', { Name: 'B11cMissing', Family: 'Properties' });
    ok('CreatePreset: missing preset raises 0x1b with the name and returns 1', !cn.err && cn.v === null && has(cn, /\[0x1b\] B11cMissing/) && S.lastStatus.status === 1, cn);
    ok('CreatePreset: is not undoable (no undo entry)', !A.undoStack.some(u => u.label === 'CreatePreset'));
  }
  // ================= references
  {
    const n0 = run('InspectExternalReference', { Target: 'cube' }); ok('InspectExternalReference: no holder -> 0x80070057', status(n0, '80070057'));
    cube.externalReferences = ['a.pic', 'b.pic']; ok('InspectExternalReference joins names with ","', run('InspectExternalReference', { Target: 'cube' }).v === 'a.pic,b.pic'); delete cube.externalReferences;
    A.select([]); ok('InspectExternalReference: no target -> 0x80004003', status(run('InspectExternalReference'), '80004003')); reset();
    const s = run('SetReference', { Target: 'cube.MyRef', Value: ['x', 'y'], Time: 30 });
    ok('SetReference writes the value (descriptor logged as unread)', !s.err && nya(s) === 1 && A.tasksB11c.references.get(cube)?.get('MyRef')?.join() === 'x,y', s);
    ok('SetReference: Time in frames -> seconds', cube.referenceTime === 30 / A.anim.fps, cube.referenceTime);
    ok('InspectExternalReference reads SetReference values', run('InspectExternalReference', { Target: 'cube' }).v === 'x,y');
    A.undo(); ok('SetReference undo', !A.tasksB11c.references.has(cube));
    ok('SetReference: non-array Value -> 0x80070057', status(run('SetReference', { Target: 'cube.MyRef', Value: 'x' }), '80070057'));
    cube.locked = true; ok('SetReference: locked owner -> 0x80070005', status(run('SetReference', { Target: 'cube.MyRef', Value: ['x'] }), '80070005')); delete cube.locked;
  }
  // ================= curves
  {
    const crv = A.run('CreateCurve', { Degree: 1, Points: '(0,0,0),(3,0,0),(3,4,0)' }); const o = Array.isArray(crv) ? crv[0] : crv;
    const L = run('GetCurveLength', { InputObj: o });
    // tolerance 1e-6: the core curve evaluator stops 1e-9 short of the domain end
    ok('GetCurveLength of a linear curve (0,0,0)-(3,0,0)-(3,4,0) = 7 (1e-6)', Math.abs((L.v?.Length ?? 0) - 7) < 1e-6, L);
    const e1 = run('EvaluateCurveAt', { InputObj: o, Value: 0.5 }).v;
    ok('EvaluateCurveAt Local=true: normalised 0.5 -> (3, 0.5, 0)', e1 && Math.abs(e1.PosX - 3) < 1e-6 && Math.abs(e1.PosY - 0.5) < 1e-6, e1);
    ok('EvaluateCurveAt tangent (0,1,0), straight segment normal 0', e1 && Math.abs(e1.TanY - 1) < 1e-6 && Math.abs(e1.TanX) < 1e-6 && Math.hypot(e1.NorX, e1.NorY, e1.NorZ) < 1e-9, e1);
    const e2 = run('EvaluateCurveAt', { InputObj: o, Value: 1.5, Local: false }).v;
    ok('EvaluateCurveAt Local=false: length 1.5 -> (1.5, 0, 0), tangent (1,0,0)', e2 && Math.abs(e2.PosX - 1.5) < 1e-6 && Math.abs(e2.PosY) < 1e-6 && Math.abs(e2.TanX - 1) < 1e-6, e2);
    const l = o.kinematics.local; l.set('posx', 10); l.set('sclx', 2);
    const e3 = run('EvaluateCurveAt', { InputObj: o, Value: 1.5, Local: false }).v;
    ok('EvaluateCurveAt: position by the transform, tangent by the inverse-transpose (no renormalisation)', e3 && Math.abs(e3.PosX - 13) < 1e-6 && Math.abs(e3.TanX - 0.5) < 1e-6, e3);
    ok('GetCurveLength is measured on the geometry (transform ignored)', Math.abs(run('GetCurveLength', { InputObj: o }).v.Length - 7) < 1e-6);
    l.set('posx', 0); l.set('sclx', 1);
    const circ = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' });
    const lc = run('GetCurveLength', { InputObj: circ }).v?.Length; const p0 = run('EvaluateCurveAt', { InputObj: circ, Value: 0 }).v; const r = Math.hypot(p0.PosX, p0.PosY, p0.PosZ);
    ok('GetCurveLength of the NURBS circle ~ 2*pi*r (1%)', Math.abs(lc - 2 * Math.PI * r) / (2 * Math.PI * r) < 0.01, [lc, r]);
    const ec = run('EvaluateCurveAt', { InputObj: circ, Value: 0.25 }).v;
    ok('EvaluateCurveAt on a circle: unit tangent, unit normal towards the centre', ec && Math.abs(Math.hypot(ec.TanX, ec.TanY, ec.TanZ) - 1) < 1e-3 && Math.abs(Math.hypot(ec.NorX, ec.NorY, ec.NorZ) - 1) < 1e-3 && (ec.NorX * ec.PosX + ec.NorY * ec.PosY + ec.NorZ * ec.PosZ) < 0, ec);
    ok('GetCurveLength: not a curve -> 0x80004002', status(run('GetCurveLength', { InputObj: 'cube' }), '80004002'));
    ok('EvaluateCurveAt: not a curve -> 0x80004002', status(run('EvaluateCurveAt', { InputObj: 'cube' }), '80004002'));
    A.undo(); A.undo(); reset();
  }
  // ================= SICreateRefPlane
  {
    const store = A.uixsiClipsDisplayAddons?.refPlanes ?? S.refPlanes; const n0 = store.length;
    const r = run('SICreateRefPlane', { InputObjs: 'cube' });
    ok('SICreateRefPlane: one plane per input, in the plane container', r.v?.length === 1 && r.v[0].type === 'refplane' && r.v[0].val('inputs') === 'cube' && store.length === n0 + 1, r);
    const r2 = run('SICreateRefPlane', { InputObjs: ['cube', 'cube.pnt[0,1]'] });
    ok('SICreateRefPlane: two inputs, two planes with unique names', r2.v?.length === 2 && r2.v[0].name !== r2.v[1].name && r2.v[1].val('inputs') === 'cube.pnt[0,1]', r2.v?.map(p => p.name));
    A.undo(); A.undo(); ok('SICreateRefPlane: undo removes the planes', store.length === n0);
    A.select([]); ok('SICreateRefPlane: empty input creates nothing', run('SICreateRefPlane').v?.length === 0); reset();
  }
  // ================= InspectBrowse
  {
    const sph = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'b11cInspect' });
    const nodes = [cube, sph, cube.properties[0]];
    for (const n of nodes) A.events.emit('inspect', n);
    const h = S.inspect; const last = h.history.length - 1;
    ok('inspection history records inspected nodes', h.history.slice(-3).every((n, i) => n === nodes[i]) && h.index === last);
    let seen = null; const off = A.events.on('inspect', n => { seen = n; });
    const p = run('InspectBrowse', { Mode: ':siPrevious:siInspectBrowseMode' });
    ok('InspectBrowse siPrevious goes back one and re-inspects', p.v === sph && seen === sph && h.index === last - 1, h.index);
    S.previousInspectedNode(); ok('InspectBrowse "Previous Inspected Node" entry (Mode siPrevious)', h.index === last - 2, h.index);
    run('InspectBrowse'); ok('InspectBrowse siNext (default) forward by Length 1', h.index === last - 1, h.index);
    run('InspectBrowse', { Mode: 3 }); ok('InspectBrowse mode 3 jumps to the first', h.index === 0);
    run('InspectBrowse', { Mode: 4 }); ok('InspectBrowse mode 4 jumps to the last', h.index === last);
    run('InspectBrowse', { Mode: 2, Length: 2 }); ok('InspectBrowse Length 2', h.index === last - 2);
    ok('InspectBrowse: history length unchanged while browsing', h.history.length === last + 1);
    ok('InspectBrowse: Mode 5 -> 0x80070057', status(run('InspectBrowse', { Mode: 5 }), '80070057'));
    ok('InspectBrowse: Length -1 -> 0x80070057', status(run('InspectBrowse', { Length: -1 }), '80070057'));
    off(); A.undo(); reset();
  }
  // ================= Open SE on Override parent
  {
    const prop = cube.properties[0];
    const r = run('Open SE on Override parent', { InspectedObjectsArray: [prop] });
    ok('Open SE on Override parent: opens on the parent (explorer task logged as unread)', r.v === cube && nya(r) >= 1, r.err);
    ok('Open SE on Override parent: empty array returns 1', run('Open SE on Override parent').v === undefined && S.lastStatus.status === 1);
    ok('Open SE on Override parent: not an object -> 0x80004002', status(run('Open SE on Override parent', { InspectedObjectsArray: ['NoSuchNodeB11c'] }), '80004002'));
    document.querySelectorAll('.ugv-xsi-explorer .ppg-float-close, .ugv-xsi-explorer [title=Close]').forEach(b => b.click());
  }
  // ================= pop-up menus
  {
    const clouds = A.run('CreateParticleCloud', { InputObjs: 'cube' }); const cloud = clouds[0];
    const op = cloud.primitive.operators.find(o => o.type === 'ParticlesOp');
    const forceObj = A.scene.find('cube');   // any node stands for a connected force here
    op.connections.forces = [forceObj];
    const ptype = { name: 'PT', particleElements: [] };
    const ev = cube.properties[0].constructor ? new (cube.properties[0].constructor)('ParticleEvent', 'ParticleEvent', []) : null;
    ptype.particleElements.push(ev); op.connections.particleTypes = [ptype];
    let picked = null; A.register({ name: 'B11cProbe', args: [{ name: 'InputObjs' }, { name: 'Keywords' }], execute(_a, a) { picked = a; } });
    let menu = null; S.hooks.popupMenu = (items, anchor, cmd) => { menu = { items, anchor, cmd }; return 0; };
    run('Emission Pop-up Menu', { InputObjs: cloud.name, EmbeddedCommand: 'B11cProbe' });
    ok('Emission Pop-up Menu lists the emitters (group 1) then events (group 6) of the particle operator', menu?.items?.length === 2 && menu.items[0] === cube.fullName, menu);
    ok('picking item n runs EmbeddedCommand with InputObjs = item n and Keywords = General', picked?.InputObjs?.[0] === cube && picked?.Keywords === 'General', picked && Object.keys(picked));
    menu = null; picked = null; run('Force Pop-up Menu', { InputObjs: cloud.name, EmbeddedCommand: 'B11cProbe' });
    ok('Force Pop-up Menu lists the forces (group 3)', menu?.items?.join() === forceObj.fullName && picked?.InputObjs?.[0] === forceObj, menu);
    menu = null; picked = null; run('Event Pop-up Menu', { InputObjs: cloud.name, EmbeddedCommand: 'B11cProbe' });
    ok('Event Pop-up Menu lists the events (group 6)', menu?.items?.length === 1 && picked?.InputObjs?.[0] === ev, menu);
    menu = null; const e = run('Event Pop-up Menu', { InputObjs: 'cube', EmbeddedCommand: 'B11cProbe' });
    ok('pop-up on an object without simulation operators shows nothing and returns 1', menu === null && !e.err && S.lastStatus.status === 1);
    S.hooks.popupMenu = () => -1; picked = null; run('Force Pop-up Menu', { InputObjs: cloud.name, EmbeddedCommand: 'B11cProbe' });
    ok('no item picked: EmbeddedCommand not run', picked === null);
    delete S.hooks.popupMenu; const nh = run('Force Pop-up Menu', { InputObjs: cloud.name, EmbeddedCommand: 'B11cProbe' });
    ok('without a menu hook the blocking menu is logged as not yet attested', nya(nh) === 1);
    A.commands.delete('B11cProbe');
    while (A.undoStack.length && A.scene.find(cloud.name)) A.undo();
    reset();
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
console.log(`AddToTOC (owned by the CMD-B10 corrections) on the bus: ${got.addToTOC}`);
console.log(`compare_tasks_b11c_commands: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
