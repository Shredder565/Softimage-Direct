// CMD-B16c (tasks.dll): undo group / Undo / Redo, refresh and drop-message tasks, RunPerformanceTest, the DeleteObj
// handler with DeleteCurrentLayer / DeleteCurrentPass, CopyPaste, Add3DObjectToScene, SetReference2.
// No XSIBATCH golden exists: this checks the "Wire contract" of docs/ghidra/cmd-b16c-tasks-undo-refresh-delete.md and
// items 22-28 of docs/re/WIRE_CORRECTIONS_B16.md against src/commands/tasksB16c.ts and the in-place registrations.
//   1. every name is registered with the argument list of data/command_registry.json (hidden args included);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error, or fails with
//      the contract's error;
//   3. the stated results.
// CMD-B17j changed: CopyPaste Mode 1 (copy + delete source) / Mode 3 (the source itself), Add3DObjectToScene (only
// unparented objects). See tools/compare_views_tasks_b17ij.mjs for the B17j contract checks.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tasks_b16c.mjs
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

const NAMES = ['BeginUndo', 'EndUndo', 'Undo', 'Redo', 'RefreshCustomPreferences', 'ResetDirectX', 'SetDropMessage', 'DelayedRefresh',
  'RunPerformanceTest', 'DeleteObj', 'DeleteCurrentLayer', 'DeleteCurrentPass', 'CopyPaste', 'Add3DObjectToScene', 'SetReference2'];
/** Default runs that must fail, with the contract's status. */
const DEFAULT_FAILS = { CopyPaste: '80070057', SetReference2: '80070057' };
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  // DeleteObj has three rows; the dd531990 rows share the argument list of the 5c0cf8b6 one
  const r = reg.find(x => x.scripting_name === n && (n !== 'DeleteObj' || x.handler_clsid === 'dd531990-ccc2-11d2-ac73-00a02485cecb'));
  return [n, r ? r.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SetReference2') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const S = A.tasksB16c;
  const out = { reg: {}, defaults: {}, checks: [] };
  const safe = d => { try { return JSON.stringify(d, (k, v) => v && typeof v === 'object' && 'fullName' in v ? v.fullName : v); } catch { return String(d); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : safe(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.select([cube]); };
  const posx = o => o.kinematics.local.val('posx');
  const trace = (name, f) => { const d = A.commands.get(name); const orig = d.execute; const calls = []; d.execute = (app, a) => { calls.push({ ...a }); return orig.call(d, app, a); }; try { f(); } finally { d.execute = orig; } return calls; };
  /** Run f with an empty undo / redo stack, then put the scene's stacks back. */
  const isolated = f => { const u = A.undoStack.splice(0), r = A.redoStack.splice(0); try { f(); } finally { while (A.undoStack.length) A.undo(); A.undoStack.splice(0, A.undoStack.length, ...u); A.redoStack.splice(0, A.redoStack.length, ...r); } };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length, r0 = A.redoStack.length;
    const r = run(n);
    if (n === 'Undo') { if (A.redoStack.length > r0) A.redo(); }
    else if (n === 'Redo') { if (A.undoStack.length > u0) A.undo(); }
    else while (A.undoStack.length > u0) A.undo();
    const want = DEFAULT_FAILS[n];
    out.defaults[n] = r.err ? (want && status(r, want) ? 'expected-failure' : 'ERROR: ' + r.err) : (want ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ================= Undo / Redo
  try {
    isolated(() => {
      const x0 = posx(cube);
      for (const X of [1, 2, 4]) A.run('Translate', { InputObj: [cube], X, Y: 0, Z: 0 });
      let r = run('Undo', { Repetitions: 2 });
      ok('Undo Repetitions 2: two steps undone, returns 2', r.v === 2 && posx(cube) === x0 + 1 && A.undoStack.length === 1, [r, posx(cube) - x0]);
      ok('Undo Repetitions 2: Repetitions output 2', S.out.Undo?.Repetitions === 2, S.out.Undo);
      ok('Undo Repetitions 2: no single-step label logged', !has(r, /^Undo Translate$/), r.log);
      r = run('Redo', { Repetitions: 1 });
      ok('Redo Repetitions 1: one step, label "Redo Translate"', r.v === 1 && posx(cube) === x0 + 3 && has(r, /^Redo Translate$/), r);
      r = run('Undo', { Repetitions: 5 });
      ok('Undo Repetitions 5 with 2 steps left: 2 done, Repetitions written back as 2', r.v === 2 && S.out.Undo.Repetitions === 2 && posx(cube) === x0 && A.undoStack.length === 0, [r, S.out.Undo]);
      r = run('Undo');
      ok('Undo with nothing left: no error, Repetitions output 0', !r.err && r.v === 0 && S.out.Undo.Repetitions === 0, [r, S.out.Undo]);
      r = run('Redo', { Repetitions: 3 });
      ok('Redo Repetitions 3: all three redone', r.v === 3 && posx(cube) === x0 + 7 && S.out.Redo.Repetitions === 3 && A.redoStack.length === 0, [r, posx(cube) - x0]);
      r = run('Undo');
      ok('Undo default (Repetitions 1): one step, label "Undo Translate"', r.v === 1 && posx(cube) === x0 + 3 && has(r, /^Undo Translate$/), r);
      ok('Undo / Redo are not themselves undoable', A.undoStack.length === 2 && A.redoStack.length === 1);
      r = run('Undo', { Repetitions: 0 });
      ok('Undo Repetitions 0: nothing done', r.v === 0 && A.undoStack.length === 2);
      // app.run('Undo') with no arguments (as the menus / other compares call it)
      A.undoStack.length && A.run('Undo'); ok('A.run("Undo") without arguments undoes one step', A.undoStack.length === 1);
    });
  } catch (e) { ok('undo block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= BeginUndo / EndUndo
  try {
    isolated(() => {
      let r = run('EndUndo');
      ok('EndUndo without an open group: silent no-op', !r.err && r.v === undefined && A.undoStack.length === 0, r);
      const x0 = posx(cube);
      r = run('BeginUndo');
      A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 }); A.run('Translate', { InputObj: [cube], X: 2, Y: 0, Z: 0 });
      const r2 = run('EndUndo');
      ok('BeginUndo with empty Name: the group is labelled "No-name operation"', !r.err && !r2.err && A.undoStack.length === 1 && A.undoStack[0].label === 'No-name operation', A.undoStack.map(e => e.label));
      ok('BeginUndo / EndUndo: no return value', r.v === undefined && r2.v === undefined);
      run('Undo'); ok('one Undo reverts the whole group', posx(cube) === x0);
      run('Redo'); ok('one Redo replays it', posx(cube) === x0 + 3);
      run('BeginUndo', { Name: 'B16c group' }); A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 }); run('EndUndo');
      ok('BeginUndo Name: the group carries the name', A.undoStack[A.undoStack.length - 1].label === 'B16c group');
      const u = A.undoStack.length; run('BeginUndo', { Name: 'empty' }); run('EndUndo');
      ok('an empty group adds nothing (inferred)', A.undoStack.length === u);
      ok('BeginUndo / EndUndo are not undoable themselves', A.undoStack.length === u);
    });
  } catch (e) { ok('undo group block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= refresh / drop message
  try {
    let r = run('RefreshCustomPreferences'); ok('RefreshCustomPreferences: no args, no return value', !r.err && r.v === undefined, r);
    r = run('ResetDirectX'); ok('ResetDirectX: views redrawn, no return value', !r.err && r.v === undefined && has(r, /WebGL/), r);
    r = run('SetDropMessage', { Message: 'drop here' }); ok('SetDropMessage stores the string', !r.err && r.v === undefined && S.dropMessage === 'drop here' && A.inferredB10.dropMessage === 'drop here', r);
    r = run('SetDropMessage', { Message: 42 }); ok('SetDropMessage: a non-string Message stores an empty message', !r.err && S.dropMessage === '', S.dropMessage);
    const f0 = A.anim.frame; const n0 = A.inferredB10.delayedRefresh.length;
    r = run('DelayedRefresh', { Time: f0 + 5 });
    ok('DelayedRefresh: queued, no return value', !r.err && r.v === undefined && A.inferredB10.delayedRefresh[n0] === f0 + 5, r);
    await new Promise(res => setTimeout(res, 30));
    ok('DelayedRefresh: the viewer is moved to Time when the refresh runs', A.anim.frame === f0 + 5, A.anim.frame);
    A.anim.frame = f0;
  } catch (e) { ok('refresh block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= RunPerformanceTest
  try {
    const FS = S.fs; FS.ensureFolder('C:\\PerfB16c'); const file = 'C:\\PerfB16c\\perf.txt';
    if (FS.isFile(file)) FS.deleteFile(file);
    A.inferredB10.perf = null;
    let r = run('RunPerformanceTest');
    ok('RunPerformanceTest without FileName: no test', !r.err && r.v === undefined && A.inferredB10.perf === null, r);
    r = run('RunPerformanceTest', { Type: 0, FileName: 'Q:\\nowhere\\perf.txt', Duration: 0.1 });
    ok('RunPerformanceTest: a file that cannot be opened -> no test, no error', !r.err && A.inferredB10.perf === null && has(r, /cannot be opened/), r);
    r = run('RunPerformanceTest', { Type: 0, FileName: file, Duration: 0.2 });
    let t = FS.readFile(file);
    ok('RunPerformanceTest Type 0: header "\\n\\n==========\\nTEST 0: [PLAYBACK (incl. UPDATE) performance]"', t.startsWith('\n\n==========\nTEST 0: [PLAYBACK (incl. UPDATE) performance]\n'), t.slice(0, 120));
    ok('RunPerformanceTest: "   Date    : <asctime>" line', /\n {3}Date {4}: (Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d\d:\d\d:\d\d \d{4}\n/.test(t), t);
    ok('RunPerformanceTest: "   Duration: >= 0.2 sec" line', t.includes('\n   Duration: >= 0.2 sec\n'), t);
    ok('RunPerformanceTest Type 0: the playback test ran for at least Duration', A.inferredB10.perf?.type === 0 && A.inferredB10.perf.seconds >= 0.2 && A.inferredB10.perf.frames > 0, A.inferredB10.perf);
    ok('RunPerformanceTest: progress caption "TEST 0 [...] running for 0.2 seconds..."', has(r, /^TEST 0 \[PLAYBACK \(incl\. UPDATE\) performance\] running for 0\.2 seconds\.\.\.$/), r.log);
    ok('RunPerformanceTest: system / scene blocks and per-frame lines logged as not yet attested', nya(r), r.log);
    ok('RunPerformanceTest: no return value', r.v === undefined);
    r = run('RunPerformanceTest', { Type: 3, FileName: file, Duration: 0.05 });
    t = FS.readFile(file);
    ok('RunPerformanceTest Type 3: appended, "DRAWING performance -- NO INSTRUMENTATION"', t.startsWith('\n\n==========\nTEST 0:') && t.includes('\n\n==========\nTEST 3: [DRAWING performance -- NO INSTRUMENTATION]\n') && A.inferredB10.perf?.type === 3, t.slice(-200));
    run('RunPerformanceTest', { Type: 1, FileName: file, Duration: 0 }); t = FS.readFile(file);
    ok('RunPerformanceTest Type 1: "DRAWING performance"', t.includes('TEST 1: [DRAWING performance]\n'));
    run('RunPerformanceTest', { Type: 2, FileName: file, Duration: 0 }); t = FS.readFile(file);
    ok('RunPerformanceTest Type 2: "PLAYBACK (incl. UPDATE) performance -- NO INSTRUMENTATION"', t.includes('TEST 2: [PLAYBACK (incl. UPDATE) performance -- NO INSTRUMENTATION]\n') && A.inferredB10.perf?.type === 2);
    A.inferredB10.perf = null;
    r = run('RunPerformanceTest', { Type: 7, FileName: file, Duration: 1 }); t = FS.readFile(file);
    ok('RunPerformanceTest Type 7: header with "unknown" only, at the end of the file', t.includes('\n\n==========\nTEST 7: [unknown]\n') && /Duration: >= 1\.0 sec\n$/.test(t), t.slice(-120));
    ok('RunPerformanceTest Type 7: nothing measured', A.inferredB10.perf === null && !has(r, /running for/), r.log);
    ok('RunPerformanceTest: five reports in the file', (t.match(/==========/g) ?? []).length === 5);
  } catch (e) { ok('perf block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= DeleteObj / DeleteCurrentLayer / DeleteCurrentPass
  try {
    reset();
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'delB16c' }); const u0 = A.undoStack.length; const k0 = S.notifications.length;
    let r = run('DeleteObj', { InputObj: [nul] });
    ok('DeleteObj: the object is removed', !r.err && !A.scene.find('delB16c'), r);
    ok('DeleteObj: SI3D_SCENE_INVALID_BEGIN / END around the deletion', JSON.stringify(S.notifications.slice(k0)) === '["SI3D_SCENE_INVALID_BEGIN","SI3D_SCENE_INVALID_END"]', S.notifications.slice(k0));
    ok('DeleteObj: one undo entry', A.undoStack.length === u0 + 1 && A.undoStack[A.undoStack.length - 1].label === 'DeleteObj');
    A.undo(); ok('DeleteObj undo restores it', A.scene.find('delB16c') === nul);
    const k1 = S.notifications.length;
    r = run('DeleteObj', { InputObj: 'no_such_object' });
    ok('DeleteObj: nothing to delete -> no change, no notification, status 0x562E80D2', !r.err && S.notifications.length === k1 && S.status.DeleteObj === 0x562e80d2 && A.undoStack.length === u0, r);
    A.select([nul]); r = run('DeleteObj');
    ok('DeleteObj without InputObj: the selection', !A.scene.find('delB16c'));
    A.undo(); A.scene.root.removeChild(nul);

    // layers
    const lay = A.run('CreateLayer', { Name: 'layB16c' }); A.run('SetCurrentLayer', { Name: lay.name });
    const u1 = A.undoStack.length; const k2 = S.notifications.length;
    const dl = trace('DeleteLayer', () => { r = run('DeleteCurrentLayer'); });
    ok('DeleteCurrentLayer: the current layer is deleted through the DeleteObj path (not DeleteLayer)', !r.err && !A.scene.layers.includes(lay) && dl.length === 0 && S.notifications.slice(k2).join() === 'SI3D_SCENE_INVALID_BEGIN,SI3D_SCENE_INVALID_END', [r, dl.length]);
    ok('DeleteCurrentLayer: undoable', A.undoStack.length === u1 + 1); A.undo(); ok('DeleteCurrentLayer undo restores the layer', A.scene.layers.includes(lay) && A.currentLayer === lay);
    r = run('DeleteCurrentLayer', { InputObj: 'Layers.layB16c' });
    ok('DeleteCurrentLayer InputObj "Layers.<name>": that layer', !A.scene.layers.includes(lay)); A.undo();
    r = run('DeleteObj', { InputObj: '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:Layers.Current' });
    ok('DeleteObj on the registry default string of DeleteCurrentLayer deletes the current layer', !A.scene.layers.includes(lay)); A.undo();
    while (A.undoStack.length > u1) A.undo();
    // passes
    const pA = A.run('CreatePass', { Name: 'PassB16cA' }); const pB = A.run('CreatePass', { Name: 'PassB16cB' });
    A.scene.currentPass = pA; const u2 = A.undoStack.length;
    r = run('DeleteCurrentPass');
    ok('DeleteCurrentPass: the current pass is deleted (not the last one)', !r.err && !A.scene.passes.includes(pA) && A.scene.passes.includes(pB), [r, A.scene.passes.map(p => p.name)]);
    ok('DeleteCurrentPass: the current pass moves to a remaining pass', A.scene.passes.includes(A.scene.currentPass));
    A.undo(); ok('DeleteCurrentPass undo restores the pass and the current pass', A.scene.passes.includes(pA) && A.scene.currentPass === pA && A.undoStack.length === u2);
    r = run('DeleteCurrentPass', { InputObj: 'Passes.PassB16cB' });
    ok('DeleteCurrentPass InputObj "Passes.<name>": that pass', !A.scene.passes.includes(pB) && A.scene.passes.includes(pA)); A.undo();
    A.scene.passes.splice(A.scene.passes.indexOf(pA), 1); A.scene.passes.splice(A.scene.passes.indexOf(pB), 1); delete A.scene.currentPass;
  } catch (e) { ok('delete block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CopyPaste
  try {
    reset();
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'tgtB16c' }); const src = A.run('GetPrim', { PresetObj: 'Null', Name: 'srcB16c' }); reset();
    const clip = A.clipboard; const u0 = A.undoStack.length;
    ok('CopyPaste: neither Source nor FileName -> E_INVALIDARG', status(run('CopyPaste', { Target: nul }), '80070057'));
    ok('CopyPaste: both Source and FileName -> E_UNEXPECTED', status(run('CopyPaste', { Source: src, FileName: 'C:\\a.emdl', Target: nul }), '8000ffff'));
    ok('CopyPaste: Mode 4 -> E_INVALIDARG', status(run('CopyPaste', { Source: src, Target: nul, Mode: 4 }), '80070057'));
    ok('CopyPaste: Mode -1 -> E_INVALIDARG', status(run('CopyPaste', { Source: src, Target: nul, Mode: -1 }), '80070057'));
    let r = run('CopyPaste', { Source: src });
    ok('CopyPaste: no Target -> nothing pasted, no error', !r.err && r.v === undefined && A.undoStack.length === u0, r);
    r = run('CopyPaste', { Source: src, Target: nul, Mode: 2 });
    ok('CopyPaste Mode 2 (operation 4, copy): a copy of Source under Target, clipboard untouched', !r.err && r.v && r.v !== src && r.v.parentObj === nul && src.parentObj === A.scene.root && A.clipboard === clip && S.lastPaste.operation === 4, r.err);
    A.undo(); ok('CopyPaste copy is undoable', nul.children.length === 0);
    r = run('CopyPaste', { Source: src, Target: nul });
    ok('CopyPaste Mode 0: the service default (copy, inferred)', !r.err && S.lastPaste.operation === 4 && nul.children.length === 1); A.undo();
    r = run('CopyPaste', { Source: src, Target: nul, Mode: 1 });
    ok('CopyPaste Mode 1 (operation 8, move; CMD-B17j): a copy under Target, the source deleted', !r.err && r.v && r.v !== src && r.v.parentObj === nul && !src.parentObj && S.lastPaste.operation === 8, r.err);
    A.undo(); ok('CopyPaste move undo', src.parentObj === A.scene.root && nul.children.length === 0);
    r = run('CopyPaste', { Source: src, Target: nul, Mode: 3 });
    ok('CopyPaste Mode 3 (operation 2; CMD-B17j): the source itself goes under Target', !r.err && r.v === src && src.parentObj === nul && S.lastPaste.operation === 2, r); A.undo();
    r = run('CopyPaste', { FileName: 'C:\\a.emdl', Target: nul });
    ok('CopyPaste FileName: loading from a file logged not yet attested', !r.err && nya(r), r);
    r = run('CopyPaste', { _Source: src, Source: 'cube', Target: nul, Mode: 2 });
    ok('CopyPaste: _Source wins over Source', !r.err && r.v?.name !== 'cube' && r.v?.parentObj === nul, r.err); A.undo();
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(nul); A.scene.root.removeChild(src);
  } catch (e) { ok('copy paste block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= Add3DObjectToScene
  try {
    reset();
    const par = A.run('GetPrim', { PresetObj: 'Null', Name: 'parB16c' }); const kid = A.run('GetPrim', { PresetObj: 'Null', Name: 'kidB16c' }); reset();
    const u0 = A.undoStack.length;
    let r = run('Add3DObjectToScene', { InputObjs: [kid], Parent: par });
    ok('Add3DObjectToScene: an object that already has a parent is skipped, not moved (CMD-B17j)', !r.err && kid.parentObj === A.scene.root && A.undoStack.length === u0, r);
    A.scene.root.removeChild(kid);
    r = run('Add3DObjectToScene', { InputObjs: [kid], Parent: par });
    ok('Add3DObjectToScene: an unparented object is parented under Parent', !r.err && kid.parentObj === par && A.undoStack.length === u0 + 1, r);
    ok('Add3DObjectToScene: the final kinematics sub-task logged as not yet attested', nya(r));
    A.undo(); ok('Add3DObjectToScene undo removes it again', !kid.parentObj);
    r = run('Add3DObjectToScene', { InputObjs: [kid] });
    ok('Add3DObjectToScene without Parent: the scene model (root)', !r.err && kid.parentObj === A.scene.root);
    A.undo();
    A.lockRecordsB11 ??= new Map(); A.lockRecordsB11.set(par, [{ type: 0, lockLevel: 0xffff }]);
    r = run('Add3DObjectToScene', { InputObjs: [kid], Parent: par });
    ok('Add3DObjectToScene: locked Parent -> 0x80070005, message 0x57, nothing done', status(r, '80070005') && has(r, /0x57/) && kid.parentObj !== par, r);
    A.lockRecordsB11.delete(par);
    while (A.undoStack.length > u0) A.undo();
    if (kid.parentObj) kid.parentObj.removeChild(kid); A.scene.root.removeChild(par);
  } catch (e) { ok('Add3DObjectToScene block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= SetReference2
  try {
    reset();
    A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [cube] });
    const ph = cube.material.surface; const chk = A.run('CreateShaderFromPreset', { PresetObj: 'Checkerboard', Container: [cube.material] });
    const T = A.textureLayers; const port = { owner: ph, name: 'diffuse' }; const before = T.getSource(port);
    const u0 = A.undoStack.length;
    let r = run('SetReference2', { Target: port, Value: chk, Time: 12 });
    ok('SetReference2: Value connected as the reference of the Target port', !r.err && T.getSource(port) === chk && A.undoStack.length === u0 + 1, r);
    ok('SetReference2: Time read in frames, converted to seconds', Math.abs(S.lastReference.seconds - 12 / A.anim.fps) < 1e-9, S.lastReference.seconds);
    const u1 = A.undoStack.length; r = run('SetReference2', { Target: port, Value: chk });
    ok('SetReference2: the same value again is a no-op', !r.err && A.undoStack.length === u1);
    r = run('SetReference2', { Target: port, Value: null });
    ok('SetReference2: null Value disconnects', !r.err && T.getSource(port) === null, r);
    A.undo(); A.undo(); ok('SetReference2 undo restores the previous connection', T.getSource(port) === before);
    ok('SetReference2: Target that is not a port -> E_INVALIDARG', status(run('SetReference2', { Target: 'nothing.here', Value: chk }), '80070057'));
    while (A.undoStack.length > u0) A.undo();
  } catch (e) { ok('SetReference2 block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_tasks_b16c: ${pass}/${pass + fail} ok (${NAMES.length} tasks.dll commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
