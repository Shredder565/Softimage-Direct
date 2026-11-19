// CMD-B11b: the 23 tasks.dll commands of src/commands/tasksB11b*.ts (picking, curve knot queries, external references,
// custom file import, System, reference plane, obstacle pop-up menu and the shared GUID-table handler b5097d5a).
// No XSIBATCH golden exists for the row: this is a contract check against the Wire contracts of
// docs/ghidra/cmd-b11b-tasks-pick-curve-extref-misc-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default, or whose contract fails in this build, must fail with a clear
//      message naming the command instead);
//   3. the contract's stated result of each command (return values, outputs, scene state, logged messages, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tasks_b11b_commands.mjs
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

const NAMES = ['CrashXSI', 'DumpMemoryStats', 'EnumElements', 'GetCurvePercentageAtKnotIndex', 'GetExternalReferences', 'GetNumberOfKnots',
  'GetUnevaluatedPrimitiveForConstructionHistory', 'ICEOfflineRefresh', 'ImportCustomFile', 'IsSoftimageDevDrop', 'Obstalce Pop-up Menu',
  'PickElement', 'PickObject', 'ReloadAddonLib', 'ReloadAllAddonLibs', 'SIGetHelpPath', 'SetReferencePlane', 'System', 'TestPluginHost',
  'UnloadAddonLib', 'UnloadAllAddonLibs', 'UnloadAllCOMLibs', 'UpdateExternalReference'];
// Default run must fail with a message naming the command:
//  required input without a default (PickElement SelFilter, SetReferencePlane Target, X3DObject, *AddonLib FileName),
//  the cube has no curve geometry (knot queries: 0x80004002), no file "" (ImportCustomFile: 0x11c),
//  no command processor in the browser (System), no handler row (TestPluginHost: 0x80020003).
// batch 12: UpdateExternalReference with a NULL Target fails with 0x80004003 before the list is read
const DEFAULT_FAILS = new Set(['PickElement', 'SetReferencePlane', 'GetUnevaluatedPrimitiveForConstructionHistory', 'UnloadAddonLib', 'ReloadAddonLib',
  'GetNumberOfKnots', 'GetCurvePercentageAtKnotIndex', 'ImportCustomFile', 'System', 'TestPluginHost', 'UpdateExternalReference']);

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
const url = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(url.includes('?') ? url : url + '?demo'); // the demo sample scene (cube, sphere, ...)
await page.waitForFunction(() => !!window.Application?.commands?.get('PickObject') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.tasksB11b;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const status = () => S.lastStatus?.status;
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool(null); A.select([cube]); A.compSel = null; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  out.batch = { registered: [...S.registered], replaced: [...S.replaced] };

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // 3. stated results
  // ---- PickElement / PickObject
  {
    const r0 = run('PickObject'); ok('PickObject without a pick UI: nothing picked, logged', r0.v && r0.v.ButtonPressed === 0 && r0.v.ModifierPressed === 0 && r0.v.PickedElement === undefined && nya(r0) === 1, r0);
    let seen = null;
    S.pickHook = (filter, left, middle, right, region) => { seen = { filter, left, middle, right, region, ambient: S.ambient.SI3D_RECTSEL_REGION_MODE }; return { picked: [cube], flags: 0x1 | 0x4 | 0x80 }; };
    const r1 = run('PickObject', { LeftMessage: 'Pick', MiddleMessage: 'Mid' });
    ok('PickObject: filter from the string, right prompt XSITASKS 0x40f', seen && seen.filter === 'object' && seen.left === 'Pick' && seen.middle === 'Mid' && seen.right === 'End', seen);
    ok('PickObject: PickedElement, ButtonPressed 1, ModifierPressed Shift|Alt', r1.v?.PickedElement === cube && r1.v.ButtonPressed === 1 && r1.v.ModifierPressed === 5, r1.v && [r1.v.ButtonPressed, r1.v.ModifierPressed]);
    ok('PickObject leaves the region ambient untouched', seen?.ambient === 0);
    S.pickHook = () => ({ picked: [cube], flags: 0x10 | 0x8 });
    let r = run('PickElement', { SelFilter: 'point' }); ok('PickElement middle + Ctrl', r.v?.ButtonPressed === 2 && r.v.ModifierPressed === 2, r.v);
    S.pickHook = () => ({ picked: [cube], flags: 0x2 }); r = run('PickElement', { SelFilter: 'point' }); ok('PickElement cancelled flag -> 0', r.v?.ButtonPressed === 0, r.v);
    S.pickHook = () => ({ picked: [cube], flags: 0, kind: 2, itemButton: 1 }); r = run('PickElement', { SelFilter: 'point' }); ok('PickElement kind-2 item button 1 -> 2', r.v?.ButtonPressed === 2, r.v);
    S.pickHook = () => ({ picked: [cube], flags: 0, kind: 2, itemButton: 0 }); r = run('PickElement', { SelFilter: 'point' }); ok('PickElement kind-2 item button 0 -> 1', r.v?.ButtonPressed === 1, r.v);
    S.pickHook = () => null; r = run('PickElement', { SelFilter: 'point' }); ok('PickElement nothing picked: outputs 0, no element', r.v && r.v.ButtonPressed === 0 && r.v.ModifierPressed === 0 && r.v.PickedElement === undefined, r.v);
    S.pickHook = (f, l, m, rt, region) => { seen = { region, ambient: S.ambient.SI3D_RECTSEL_REGION_MODE }; return null; };
    run('PickElement', { SelFilter: 'point', SelRegionMode: 3 }); ok('PickElement SelRegionMode 3 set for the session and restored', seen.ambient === 3 && S.ambient.SI3D_RECTSEL_REGION_MODE === 0, seen);
    run('PickElement', { SelFilter: 'point', SelRegionMode: 9 }); ok('PickElement SelRegionMode out of 1..6 -> 0 (ambient untouched)', seen.ambient === 0, seen);
    r = run('PickElement', { SelFilter: 'point', SelRegionMode: 'x' }); ok('PickElement non-integer SelRegionMode -> 0x80070057', /80070057/.test(r.err ?? ''), r.err);
    r = run('PickElement', { SelFilter: 'point', LeftMessage: 3 }); ok('PickElement LeftMessage not a string -> 0x80070057', /80070057/.test(r.err ?? ''), r.err);
    A.Interactive = false; S.pickHook = () => { throw new Error('called'); };
    r = run('PickObject'); ok('PickObject without interaction: returns without picking', r.v && r.v.ButtonPressed === 0 && !r.err, r);
    A.Interactive = undefined; S.pickHook = null;
    ok('Pick commands are not undoable', A.commands.get('PickElement').undoable === false && A.commands.get('PickObject').undoable === false);
  }
  // ---- curve knots
  {
    const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' }); reset();
    const c = crv.primitive.curve();
    const n = run('GetNumberOfKnots', { InputObj: crv }).v?.NbItems;
    ok('GetNumberOfKnots = Softimage knot vector size (nbCVs + degree - 1 for an open curve)', n === (c.closed ? c.cvs.length + 1 : c.cvs.length + c.degree - 1), [n, c.cvs.length, c.degree, c.closed]);
    ok('GetNumberOfKnots by name', run('GetNumberOfKnots', { InputObj: crv.name }).v?.NbItems === n);
    const p0 = run('GetCurvePercentageAtKnotIndex', { InputObj: crv, Index: 0 }).v?.Percentage;
    const pl = run('GetCurvePercentageAtKnotIndex', { InputObj: crv, Index: n - 1 }).v?.Percentage;
    const pm = [...Array(n).keys()].map(i => run('GetCurvePercentageAtKnotIndex', { InputObj: crv, Index: i }).v?.Percentage);
    ok('GetCurvePercentageAtKnotIndex: 0 at the first knot, 100 at the last', Math.abs(p0) < 1e-9 && Math.abs(pl - 100) < 1e-6, [p0, pl]);
    ok('GetCurvePercentageAtKnotIndex: non-decreasing along the knots', pm.every((v, i) => i === 0 || v >= pm[i - 1] - 1e-9), pm);
    // the circle preset's interior knots are evenly spaced quarter arcs: 25 / 50 / 75 %
    const quarter = pm.filter(v => Math.abs(v - 25) < 0.5 || Math.abs(v - 50) < 0.5 || Math.abs(v - 75) < 0.5).length;
    ok('GetCurvePercentageAtKnotIndex: circle quarter knots at 25 / 50 / 75 %', quarter >= 3, pm);
    const oor = run('GetCurvePercentageAtKnotIndex', { InputObj: crv, Index: n + 5 }); ok('GetCurvePercentageAtKnotIndex: index out of range -> 0, no error', oor.v?.Percentage === 0 && !oor.err, oor);
    const mesh = run('GetNumberOfKnots', { InputObj: cube }); ok('GetNumberOfKnots on a mesh -> 0x80004002', /80004002/.test(mesh.err ?? ''), mesh.err);
    A.undo(); reset();
  }
  // ---- EnumElements
  {
    const kids = run('EnumElements', { InputObj: cube }).v;
    ok('EnumElements children = the element children of the input', Array.isArray(kids) && kids.includes(cube.kinematics) && kids.includes(cube.primitive), kids?.length);
    const par = run('EnumElements', { InputObj: cube.kinematics, EnumChildren: false }).v; ok('EnumElements EnumChildren false -> parents', Array.isArray(par) && par.length === 1 && par[0] === cube, par?.map(x => x.name));
    A.select([]); const e = run('EnumElements'); ok('EnumElements with no input -> 0x80004003', /80004003/.test(e.err ?? ''), e.err); reset();
    const cap = run('EnumElements', { InputObj: cube, Capabilities: 1 }); ok('EnumElements: other Capabilities logged as not yet attested', nya(cap) === 1);
  }
  // ---- Obstacle menu
  {
    const C = 'Obstalce Pop-up Menu';
    A.select([]); run(C); ok(`${C}: empty input -> status 1`, status() === 1); reset();
    const obstacle = A.scene.find('sphere') ?? A.scene.find('sphere1');
    const op = { name: 'ParticlesOp', type: 'ParticlesOp', kind: 'operator', connections: { main: [], emitters: [], obstacles: [obstacle], forces: [], initialState: [], particleTypes: [] }, apply: g => g };
    cube.primitive.operators.push(op);
    let labels = null; S.menuHook = (l) => { labels = l; return 0; };
    let inspected = null; const def = A.commands.get('InspectObj'); const orig = def.execute; def.execute = (app, a) => { inspected = [a.InputObjs?.name ?? a.InputObjs, a.Keywords]; };
    let notified = 0;
    run(C, { InputObjs: cube, EmbeddedCommand: { notify: () => notified++ } });
    def.execute = orig; cube.primitive.operators.pop(); S.menuHook = null;
    ok(`${C}: menu lists the connected obstacles`, JSON.stringify(labels) === JSON.stringify([obstacle.name]), labels);
    ok(`${C}: chosen entry -> InspectObj with Keywords "General"`, inspected && inspected[0] === obstacle.name && inspected[1] === 'General', inspected);
    ok(`${C}: embedded command notified, status 0`, notified === 1 && status() === 0, [notified, status()]);
  }
  // ---- external references
  {
    const M = A.scene.root.constructor;
    const m = new M('refRig'); m.ref = { file: 'Models/rig_lo.emdl', resolution: 1, resolutions: ['Models/rig_lo.emdl', 'Models/rig_hi.emdl'] };
    A.scene.root.addChild(m);
    const m2 = new M('refOff'); m2.ref = { file: '', resolution: 0, resolutions: [] }; A.scene.root.addChild(m2);
    let list = run('GetExternalReferences').v; ok('GetExternalReferences lists models with resolutions', Array.isArray(list) && list.includes(m) && !list.includes(m2) && !list.includes(cube), list?.map(x => x.name));
    m.ref.switching = true; list = run('GetExternalReferences').v; ok('GetExternalReferences skips a model being switched', !list.includes(m)); delete m.ref.switching;
    ok('GetExternalReferences is not undoable (no undo entry)', (() => { const u = A.undoStack.length; run('GetExternalReferences'); return A.undoStack.length === u; })());
    // batch 12 (note Q3): each path must resolve to an existing scene element; count mismatch -> S_FALSE, no change
    let r = run('UpdateExternalReference', { Target: m }); ok('UpdateExternalReference empty list -> status 1, no change', status() === 1 && !r.err && m.ref.resolutions[0] === 'Models/rig_lo.emdl');
    r = run('UpdateExternalReference', { Target: m, InputObjs: 'sphere,cube' });
    ok('UpdateExternalReference sets path i on resolution i', !r.err && m.ref.resolutions.join() === 'sphere,cube' && m.ref.file === 'sphere', [r.err, m.ref]);
    A.undo(); ok('UpdateExternalReference undo restores the old paths', m.ref.resolutions.join() === 'Models/rig_lo.emdl,Models/rig_hi.emdl' && m.ref.file === 'Models/rig_lo.emdl', m.ref);
    A.redo(); ok('UpdateExternalReference redo re-applies the new paths', m.ref.resolutions.join() === 'sphere,cube'); A.undo();
    r = run('UpdateExternalReference', { Target: m, InputObjs: 'sphere' }); ok('UpdateExternalReference count mismatch -> status 1, no change', !r.err && status() === 1 && m.ref.resolutions[0] === 'Models/rig_lo.emdl', r);
    r = run('UpdateExternalReference', { Target: m, InputObjs: 'sphere,nosuch_b11b' }); ok('UpdateExternalReference unresolved path logs "Invalid reference [<path>]"', r.err && r.log.includes('Invalid reference [nosuch_b11b]'), r.log);
    r = run('UpdateExternalReference', { Target: cube, InputObjs: 'sphere' }); ok('UpdateExternalReference on a target without a resolution object -> 0x80070057', /80070057/.test(r.err ?? ''), r);
    r = run('UpdateExternalReference', { Target: m2, InputObjs: 'sphere' }); ok('UpdateExternalReference with 0 resolutions -> success, no change', !r.err && status() === 0 && m2.ref.resolutions.length === 0, r);
    m.externalRefSubObject = {}; r = run('UpdateExternalReference', { Target: m, InputObjs: 'sphere,cube' }); delete m.externalRefSubObject;
    ok('UpdateExternalReference: sub-object found -> XSITASKS 0x42f warning, success, no change', !r.err && status() === 0 && r.log.some(l => /^WARNING : /.test(l)) && m.ref.resolutions[0] === 'Models/rig_lo.emdl', r);
    A.scene.root.removeChild(m); A.scene.root.removeChild(m2); reset();
  }
  // ---- ImportCustomFile
  {
    const C = 'ImportCustomFile'; const file = 'C:\\Users\\Public\\b11b\\thing.xyz';
    A.hostFs.ensureFolder('C:\\Users\\Public\\b11b'); A.hostFs.writeFile(file, 'data');
    let r = run(C, { FileName: 'C:\\Users\\Public\\b11b\\missing.xyz' }); ok(`${C}: missing file -> catalogue 0x11c, 0x80070057`, /80070057/.test(r.err ?? '') && r.log.some(l => l.includes('missing.xyz') && /cannot be found/.test(l)), r.log);
    r = run(C, { FileName: file }); ok(`${C}: no converter -> XSITASKS 0x426 + extension`, /80070057/.test(r.err ?? '') && r.log.some(l => l.startsWith("Couldn't load target - no custom import event available for this extension: xyz")), r.log);
    let call = null; S.converters.set('xyz', (f, type, frame, ud, ctx) => { call = [f, type, frame, ud, ctx.target.name, ctx.reference, ctx.name]; return 'imported'; });
    const ev0 = S.events.length;
    r = run(C, { FileName: file, Reference: true, Name: 'N', Frame: 12.7, UserData: 'u' });
    ok(`${C}: converter called with (file, 0x1f, Frame as long, UserData), target = scene root`, call && call[0] === file && call[1] === 0x1f && call[2] === 12 && call[3] === 'u' && call[4] === A.scene.root.name && call[5] === true && call[6] === 'N', call);
    ok(`${C}: pre, converter and post events in order`, S.events.slice(ev0).map(e => e.id.toString(16)).join() === '20510015,20510026,20510016', S.events.slice(ev0).map(e => e.id.toString(16)));
    S.fileEvents.push(e => e.id === 0x20510015 ? 0x562e80c7 : undefined); call = null;
    r = run(C, { FileName: file }); ok(`${C}: pre-event answer 0x562E80C7 aborts`, call === null && status() === 0x562e80c7 && !r.err, [call, status()]);
    S.fileEvents.length = 0; S.converters.delete('xyz');
    ok(`${C}: not undoable`, A.commands.get(C).undoable === false);
  }
  // ---- SetReferencePlane
  {
    const C = 'SetReferencePlane'; const U = A.uixsiClipsDisplayAddons;
    cube.kinematics.local.get('posx').value = 3;
    let r = run(C, { Target: 'RefPlanes.Transform', InputObj: cube });
    const tp = U.transientPlane; const g = cube.globalMatrix().toArray();
    ok(`${C}: object -> plane on its global transform`, !r.err && tp && tp.matrix.every((v, i) => Math.abs(v - g[i]) < 1e-9), [r.err, tp]);
    ok(`${C}: half sizes at least 2.0, active`, tp && tp.sizeU >= 2 && tp.sizeV >= 2 && tp.active === true, tp);
    A.undo(); ok(`${C}: undo restores the previous plane`, U.transientPlane !== tp);
    cube.kinematics.local.get('posx').value = 0;
    r = run(C, { Target: 'RefPlanes.Transform', InputObj: 'cube.pnt[0,1,2]' }); ok(`${C}: component (kind 6) -> plane from the component frame (batch 12)`, !r.err && U.transientPlane?.inputs[0] === 'cube.pnt[0,1,2]' && nya(r) === 0, r); A.undo();
    r = run(C, { Target: cube, InputObj: cube }); ok(`${C}: target without a reference plane -> 0x80070057 (batch 12)`, /80070057/.test(r.err ?? ''), r.err);
    A.select([]); r = run(C, { Target: 'RefPlanes.Transform' }); ok(`${C}: no element -> status 1`, !r.err && status() === 1, r); reset();
  }
  // ---- GetUnevaluatedPrimitiveForConstructionHistory
  {
    const C = 'GetUnevaluatedPrimitiveForConstructionHistory';
    const r = run(C, { X3DObject: cube }); ok(`${C}: returns the base primitive`, r.v && r.v.source === cube.primitive && r.v.geom() && status() === 0, r.err);
    const nul = A.scene.allObjects ? [...A.scene.allObjects()].find(o => !o.primitive) : null;
    if (nul) ok(`${C}: no primitive -> empty`, run(C, { X3DObject: nul }).v === null);
  }
  // ---- System
  {
    let r = run('System', { Pathname: 'dir' }); ok('System without a command processor fails (raised 0x80070057, returns 0x80004005)', /80004005/.test(r.err ?? '') && r.log.some(l => /80070057/.test(l)), r);
    let got = null; S.commandProcessor = c => { got = c; return 3; };
    r = run('System', { Pathname: 'echo hi' }); ok('System: exit code as a double, status 1', r.v === 3 && got === 'echo hi' && status() === 1, r);
    S.commandProcessor = () => -1; r = run('System', { Pathname: 'x' }); ok('System: negative result -> 0x80004005', /80004005/.test(r.err ?? ''), r.err);
    S.commandProcessor = null;
  }
  // ---- shared handler rows
  {
    let r = run('CrashXSI'); ok('CrashXSI without the variable does nothing, status 1', !r.err && status() === 1 && r.log.length <= 1, r);
    S.env.XSI_SUPPORT_CRASH_XSI_COMMAND = '1'; r = run('CrashXSI'); delete S.env.XSI_SUPPORT_CRASH_XSI_COMMAND;
    ok('CrashXSI with XSI_SUPPORT_CRASH_XSI_COMMAND set: logs the access violation, does not crash', !r.err && r.log.some(l => /0xC0000005/.test(l)), r.log);
    const d0 = S.memoryDumps; r = run('DumpMemoryStats'); ok('DumpMemoryStats writes to the script log', S.memoryDumps === d0 + 1 && r.log.some(l => l.startsWith('DumpMemoryStats:')), r.log);
    ok('IsSoftimageDevDrop: no factory path -> 0', run('IsSoftimageDevDrop').v === 0);
    S.installPaths[3] = 'C:\\Softimage'; A.hostFs.ensureFolder('C:\\Softimage\\Application\\test');
    ok('IsSoftimageDevDrop: folder without cscmd.dll -> 0', run('IsSoftimageDevDrop').v === 0);
    A.hostFs.writeFile('C:\\Softimage\\Application\\test\\cscmd.dll', 'x'); ok('IsSoftimageDevDrop: cscmd.dll present -> 1', run('IsSoftimageDevDrop').v === 1);
    delete S.installPaths[3];
    const hp = run('SIGetHelpPath').v; ok('SIGetHelpPath returns the help path (<= 260 chars)', typeof hp === 'string' && hp.length > 0 && hp.length <= 260, hp);
    const f0 = S.flushes; run('ICEOfflineRefresh'); ok('ICEOfflineRefresh flushes, status 0', S.flushes === f0 + 1 && status() === 0);
    const c0 = S.comFrees; run('UnloadAllCOMLibs'); ok('UnloadAllCOMLibs frees unused libraries, status 0', S.comFrees === c0 + 1 && status() === 0);
    r = run('TestPluginHost'); ok('TestPluginHost -> DISP_E_MEMBERNOTFOUND 0x80020003', /80020003/.test(r.err ?? ''), r.err);
    // add-on libraries on the stand-in plug-in manager
    S.plugins.push({ name: 'MyTool', file: 'C:\\Addons\\MyTool.dll', factory: false, loaded: true, loads: 1 }, { name: 'Factory', file: 'C:\\Softimage\\Factory.dll', factory: true, loaded: true, loads: 1 });
    S.libraries.push({ file: 'C:\\Addons\\Loose.dll', loaded: true, loads: 1 });
    r = run('UnloadAddonLib', { FileName: 'C:\\Addons\\MyTool.dll' }); ok('UnloadAddonLib unloads the plug-in', !r.err && S.plugins[0].loaded === false && status() === 1, r);
    r = run('ReloadAddonLib', { FileName: 'C:\\Addons\\MyTool.dll' }); ok('ReloadAddonLib reloads it', !r.err && S.plugins[0].loaded === true && S.plugins[0].loads === 2, r);
    r = run('UnloadAddonLib', { FileName: 'C:\\Softimage\\Factory.dll' }); ok('UnloadAddonLib factory plug-in: catalogue 0x118 (info), status 1', !r.err && status() === 1 && r.log.some(l => /Factory plug-ins cannot be unloaded/.test(l)) && S.plugins[1].loaded, r.log);
    r = run('ReloadAddonLib', { FileName: 'C:\\Softimage\\Factory.dll' }); ok('ReloadAddonLib factory plug-in: catalogue 0x11d', !r.err && r.log.some(l => /Factory plug-ins cannot be reloaded/.test(l)), r.log);
    r = run('UnloadAddonLib', { FileName: 'C:\\nothing.dll' }); ok('UnloadAddonLib unknown file: catalogue 0x127 error', r.err && r.log.some(l => /This plug-in cannot be unloaded/.test(l)), r.log);
    r = run('UnloadAllAddonLibs'); ok('UnloadAllAddonLibs: loose library and user plug-in unloaded, factory kept (0x118), status 0', S.libraries[0].loaded === false && S.plugins[0].loaded === false && S.plugins[1].loaded && r.log.some(l => /cannot be unloaded/.test(l)) && status() === 0, r.log);
    r = run('ReloadAllAddonLibs'); ok('ReloadAllAddonLibs: reloads them, factory message 0x11d', S.libraries[0].loaded && S.plugins[0].loaded && r.log.some(l => /cannot be reloaded/.test(l)) && status() === 0, r.log);
    S.plugins.length = 0; S.libraries.length = 0;
  }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
report('row registered every name itself (no earlier registration replaced)', got.batch.replaced.length === 0 && NAMES.every(n => got.batch.registered.includes(n)), JSON.stringify(got.batch));
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_tasks_b11b_commands: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
