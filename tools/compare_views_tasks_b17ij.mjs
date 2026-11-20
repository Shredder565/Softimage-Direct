// CMD-B17i / CMD-B17j: toolmanager.dll / vm.dll / manipmgr.dll tool and view commands, and the tasks.dll answers.
// No XSIBATCH golden exists: this is a contract check against the "Wire contracts" of
// docs/ghidra/cmd-b17i-toolmanager-view-commands.md, §3 "Wire contract deltas" of
// docs/ghidra/cmd-b17j-tasks-pr195-answers.md and the cmd-b17i / cmd-b17j sections of docs/re/WIRE_CORRECTIONS_B17.md.
//   1. every command is registered with the catalogue argument list (data/commands_full.json); commands without a
//      scripting name are on the bus under their registry name (the second `Escape Pick Session` under its GUID) and the
//      key-assignable ones are reachable through the key map action of the same name;
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error;
//   3. the contracts' stated results (tool manager Q2 / Q4 / Q5, Escape ×2, framing brackets, camera reset, grid,
//      manipulator cycling / mode; CopyPaste modes, Add3DObjectToScene, SetReference2 filter, DeleteObj validation,
//      RunPerformanceTest report, Undo / Redo Repetitions).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_views_tasks_b17ij.mjs
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

const ESC2 = '{41EE76F1-99CD-11D1-8049-00A0243E2717}';
/** [bus name, catalogue lookup, row, key map action or null] */
const ROWS = [
  ['Escape Pick Session', { name: 'Escape Pick Session', description: 'Terminates the current pick session' }, 'B17i', 'Escape Pick Session'],
  [ESC2, { name: 'Escape Pick Session', description: 'Todo: Escape pick session status' }, 'B17i', null],
  ['CameraReset', { scripting_name: 'CameraReset' }, 'B17i', 'Reset Camera'],
  ['ResetAllViews', { scripting_name: 'ResetAllViews' }, 'B17i', null],
  ['Frame Selection', { name: 'Frame Selection', scripting_name: '' }, 'B17i', 'Frame Selection'],
  ['FrameSelection', { scripting_name: 'FrameSelection' }, 'B17i', 'Frame Selection (All 3D Views)'],
  ['Frame All', { name: 'Frame All', scripting_name: '' }, 'B17i', 'Frame All'],
  ['FrameAll', { scripting_name: 'FrameAll' }, 'B17i', 'Frame All (All 3D Views)'],
  ['Hide Back Facing Polygons', { name: 'Hide Back Facing Polygons' }, 'B17i', null],
  ['Show/Hide Grid', { name: 'Show/Hide Grid' }, 'B17i', 'Show/Hide Grid'],
  ['Show Next Manipulator', { name: 'Show Next Manipulator' }, 'B17i', 'Show Next Manipulator'],
  ['Show Previous Manipulator', { name: 'Show Previous Manipulator' }, 'B17i', 'Show Previous Manipulator'],
  ['Toggle Manipulator mode', { name: 'Toggle Manipulator mode' }, 'B17i', null],
  ['CopyPaste', { scripting_name: 'CopyPaste' }, 'B17j', null],
  ['Add3DObjectToScene', { scripting_name: 'Add3DObjectToScene' }, 'B17j', null],
  ['SetReference2', { scripting_name: 'SetReference2' }, 'B17j', null],
  ['DeleteObj', { scripting_name: 'DeleteObj', name: 'Delete Objects' }, 'B17j', null],
  ['RunPerformanceTest', { scripting_name: 'RunPerformanceTest' }, 'B17j', null],
  ['Undo', { scripting_name: 'Undo' }, 'B17j', null],
  ['Redo', { scripting_name: 'Redo' }, 'B17j', null],
];
/** Default run: expected failure status (hex), or null = must succeed. */
const DEFAULT_FAILS = { CopyPaste: '80070057', SetReference2: '80070057' };
/** CMD-B16c hidden arguments kept after the catalogue list. */
const EXTRA_ARGS = { CopyPaste: [['_Source', null], ['_Target', null]] };
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const catalogue = Object.fromEntries(ROWS.map(([bus, q]) => {
  const f = full.find(x => Object.entries(q).every(([k, v]) => x[k] === v));
  return [bus, f ? [...f.args.map(a => [a.name, a.default ?? null]), ...(EXTRA_ARGS[bus] ?? [])] : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.toolManager && !!window.__vm && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ ROWS, DEFAULT_FAILS, ESC2 }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const tm = A.toolManager; const T = window.__tool; const nav = window.__navTool; const V = window.__vm;
  const out = { reg: {}, defaults: {}, keys: {}, checks: [] };
  const safe = d => { try { return JSON.stringify(d, (k, v) => v && typeof v === 'object' && 'fullName' in v ? v.fullName : v); } catch { return String(d); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : safe(detail).slice(0, 400)]);
  const run = (n, a = {}, ctx) => { const m = A.log.length; if (ctx) A.toolExecContext = ctx; try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), cmd: L.filter(l => l.kind === 'cmd').length }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status, log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const trace = (names, f) => {
    const saved = names.map(n => [n, A.commands.get(n), A.commands.get(n).execute]); const calls = [];
    for (const [n, d, orig] of saved) d.execute = (app, a) => { calls.push({ n, a: { ...a } }); return orig.call(d, app, a); };
    try { f(); } finally { for (const [, d, orig] of saved) d.execute = orig; }
    return calls;
  };
  const G = { translate: '3a711ff0-8798-11d1-84b1-00aa00135f7b', rotate: 'ecbad3a0-974b-11d1-84bf-00aa00135f7b', scale: 'f500bd80-974b-11d1-84bf-00aa00135f7b', select: '11778840-8c5c-11d1-84b5-00aa00135f7b',
    orbit: '1ceb5700-7881-11d1-84b0-00aa00135f7b', dolly: 'bf330860-9693-11d1-84bf-00aa00135f7b', nav: '988e8c81-0a1f-11d3-bfe4-00a0248f9397', vslider: 'b3e7200c-2273-4d19-8428-c206ec058d0d',
    nil: 'd97e3888-012c-11d6-a2e3-08003658d403', surfPt: 'dccb8091-b82c-11d1-a900-00a024190119', tweak: '9eebc290-e6b8-437a-b3e4-84e9a4fff3a3' };
  const NULLG = '00000000-0000-0000-0000-000000000000';
  const ASP = 'dccb8090-b82c-11d1-a900-00a024190119';
  const cur = () => tm.current();
  const setPref = (k, v) => { A.prefValues ??= {}; if (v === undefined) delete A.prefValues[`preferences.Interaction.${k}`]; else A.prefValues[`preferences.Interaction.${k}`] = v; };
  const cube = A.scene.find('cube');
  const ch = () => tm.channelOf(NULLG);
  const reset = () => {
    A.setTool(null); nav?.set(null); T.setMode('select'); A.selMode = 'object'; A.compSel = null; A.select([cube]);
    tm.stateOverride.clear(); tm.eligibleOverride.clear(); tm.supra = null; tm.sticky = null; tm.queue.length = 0;
    ch().cur = null; ch().history.length = 0; ch().locked = false; cur(); ch().recordOnDeactivate = false; tm.setFallback(NULLG, NULLG);
    for (const k of ['stickytoggle', 'stickykeys', 'stickytime', 'niltool']) setPref(k);
    A.toolExecContext = undefined; tm.notifications.length = 0;
  };
  const events = () => tm.notifications.map(n => `${n.event} ${n.args[0]}`);
  const vps = V.viewports(); const act = () => vps.indexOf(V.active());
  const P = vp => vp.camera.position.toArray().map(x => +x.toFixed(4)).join(',');

  const U0 = A.undoStack.length;
  // 1. registration and key map reachability
  for (const [bus, , , key] of ROWS) {
    const d = A.commands.get(bus); out.reg[bus] = d ? d.args.map(a => [a.name, a.default ?? null]) : null;
    if (key) {
      const target = d ? bus : null; let calls = [];
      try { calls = trace([bus], () => window.__keyAction(key)); } catch (e) { calls = [{ n: 'ERROR ' + e }]; }
      out.keys[bus] = target && calls.some(c => c.n === bus) ? 'ok' : `key action ${key} did not run ${bus}: ${JSON.stringify(calls).slice(0, 120)}`;
      reset(); while (A.undoStack.length > U0) A.undo();
    }
  }
  // 2. default runs
  for (const [n] of ROWS) {
    reset(); const u0 = A.undoStack.length, r0 = A.redoStack.length;
    const r = run(n);
    if (n === 'Undo') { if (A.redoStack.length > r0) A.redo(); }
    else if (n === 'Redo') { if (A.undoStack.length > u0) A.undo(); }
    else while (A.undoStack.length > u0) A.undo();
    const want = DEFAULT_FAILS[n];
    out.defaults[n] = r.err ? (want && status(r, want) ? 'expected-failure' : 'ERROR: ' + r.err) : (want ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ======================================================================== B17i tool manager (Q2 / Q4 / Q5)
  try {
    reset(); run('TranslateTool');
    ok('Q2: the state query reports the mode of the channel\'s current tool for any class (1 after a plain activation)', tm.toolState(G.rotate).S === 1 && tm.toolState(G.translate).hr === 0, tm.toolState(G.rotate));
    ch().locked = true; ok('Q2: channel lock flag -> S_OK, S 5', tm.toolState(G.rotate).S === 5 && tm.toolState(G.rotate).hr === 0, tm.toolState(G.rotate)); ch().locked = false;
    ok('Q2: eligibility S_FALSE for a class that is not current', tm.eligible(G.rotate) === 1);
    setPref('stickytime', 1000); ok('Q2: eligibility S_FALSE for the current sticky tool activated less than Interaction.stickytime ago', tm.eligible(G.translate) === 1);
    setPref('stickytime', 0); ok('Q2: eligibility S_OK once Interaction.stickytime elapsed', tm.eligible(G.translate) === 0);
    tm.mode = 0; tm.eligible(G.translate); ok('Q2: eligibility promotes a mode 0 tool to 2 (held)', tm.mode === 2, tm.mode);
    setPref('stickytime');
    reset(); run('TranslateTool'); tm.mode = 0; { const n0 = tm.trace.length; run('RotationTool');
      ok('correction 3: activation refused while the current tool has mode 0', cur() === G.translate && tm.trace.slice(n0).some(t => t.op === 'refused'), tm.trace.slice(n0)); }
    reset(); run('TranslateTool'); run('RotationTool');
    ok('correction 3: a non-current class over a sticky (mode 1) tool is activated normally', cur() === G.rotate && tm.mode === 1, [cur(), tm.mode]);
    ok('correction 1: SRT memory stores the current SRT tool as fallback', tm.fallback() === G.translate, tm.fallback());
    reset(); run('CamOrbitTool'); ok('correction 1: SRT memory stores the selection tool when the current tool is not SRT', tm.fallback() === G.select, tm.fallback());
    // Q4 deactivate chain
    reset(); run('TranslateTool'); run('CamOrbitTool'); run('CamOrbitTool');
    ok('Q4 c: deactivating returns to the previous tool of the history (Translate)', cur() === G.translate && T.mode === 'translate' && nav.get() === null, [cur(), T.mode, nav.get()]);
    reset(); ch().history.length = 0; tm.setFallback(NULLG, G.scale); { const c = cur(); tm.deactivate(c);
      ok('Q4 d: empty history -> the stored fallback class is activated (mode 1)', cur() === G.scale && T.mode === 'scale' && tm.mode === 1, [c, cur(), T.mode, tm.mode]); }
    reset(); ch().history.length = 0; tm.setFallback(NULLG, G.scale); setPref('niltool', true); tm.deactivate(cur());
    ok('Q4 d: Interaction.niltool on -> the nil tool d97e3888 instead of the fallback', ch().cur?.clsid === G.nil, ch().cur);
    reset(); ch().history.length = 0; tm.deactivate(cur());
    ok('Q4 d: no fallback stored -> the nil tool', ch().cur?.clsid === G.nil, ch().cur);
    reset(); { const c0 = ch().cur; ch().cur = null; tm.setFallback(NULLG, G.rotate);
      ok('storing a fallback while the channel is empty activates it at once', ch().cur?.clsid === G.rotate && T.mode === 'rotate', [c0?.clsid, ch().cur]); }
    reset(); ch().recordOnDeactivate = true; run('VirtualSliderTool'); tm.recordLastAux(NULLG, NULLG); tm.deactivate(G.vslider);
    ok('Q4 b: channel flag +0x210 set -> the deactivated tool is recorded as last auxiliary tool', tm.getLastAux() === G.vslider, tm.getLastAux());
    reset(); ch().recordOnDeactivate = true; run('TranslateTool'); tm.recordLastAux(NULLG, NULLG); tm.deactivate(G.translate);
    ok('Q4 b: an excluded class (Translate) is not recorded', tm.getLastAux() === NULLG, tm.getLastAux());
    // correction 12 / Q1: Dolly is a default-category tool
    reset(); tm.recordLastAux(NULLG, NULLG); run('CamDollyTool');
    ok('correction 12: the Dolly tool is a default-category tool and becomes the last auxiliary tool', tm.categoryOf(G.dolly) === NULLG && tm.getLastAux() === G.dolly, tm.getLastAux());
    reset(); run('CamNavigTool'); ok('correction 12: the Navigation tool stays excluded', tm.getLastAux() === G.dolly, tm.getLastAux());
    // Q5 / correction 5
    reset(); run('Add Surface Point Tool');
    ok('correction 5: a script call (A = 0) with no held supra session starts a sticky session, SI3D_STICKY_COMMAND_ACTIVATED', tm.sticky?.cmdId === ASP && cur() === G.surfPt && events().join() === `SI3D_STICKY_COMMAND_ACTIVATED {${ASP.toUpperCase()}}`, [tm.sticky, events()]);
  } catch (e) { ok('tool manager block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== Escape Pick Session ×2
  try {
    reset(); run('TranslateTool'); { const u0 = A.undoStack.length; const r = run('Escape Pick Session');
      ok('Escape {45AF19B0} after Translate: selection tool stored as fallback, Translate deactivated, selection tool current', !r.err && cur() === G.select && tm.fallback() === G.select && T.mode === 'select', [r.err, cur(), tm.fallback(), T.mode]);
      ok('Escape {45AF19B0}: no undo, no command log line, no return value', A.undoStack.length === u0 && r.cmd === 0 && r.v === undefined, [r.cmd, r.v]); }
    reset(); run('TranslateTool'); run('CamOrbitTool'); run('Escape Pick Session');
    ok('Escape {45AF19B0} after a non-SRT tool: deactivated, the previous tool (Translate) comes back', cur() === G.translate && nav.get() === null, [cur(), nav.get(), tm.fallback()]);
    reset(); run('Add Surface Point Tool'); tm.notifications.length = 0; { const calls = trace(['ActivateObjectSelTool'], () => run('Escape Pick Session'));
      ok('Escape {45AF19B0} with a dispatcher session: deactivate escapes the session (Q4 a), default sticky class ba315211 (ActivateObjectSelTool) restarted', tm.sticky === null && calls.length === 1 && events()[0] === `SI3D_STICKY_COMMAND_DEACTIVATED {${ASP.toUpperCase()}}` && cur() !== G.surfPt, [tm.sticky, calls.length, events(), cur()]); }
    // {41EE76F1}
    reset(); run('Add Surface Point Tool', {}, { A: 6, B: 0 }); tm.notifications.length = 0; { const r = run(ESC2);
      ok('Escape {41EE76F1} with a held supra session: supra ended, SI3D_COMMAND_EXECUTED {41EE76F1} (no sticky session left)', !r.err && tm.supra === null && events().join('|') === `SI3D_SUPRA_COMMAND_DEACTIVATED {${ASP.toUpperCase()}}|SI3D_COMMAND_EXECUTED ${ESC2}` && cur() !== G.surfPt, [r.err, events(), cur()]); }
    reset(); run('Add Surface Point Tool'); tm.notifications.length = 0; { const calls = trace(['ActivateObjectSelTool'], () => run(ESC2));
      ok('Escape {41EE76F1} with a sticky session: ended, default sticky class restarted, SI3D_COMMAND_EXECUTED', tm.sticky === null && calls.length === 1 && events().join('|') === `SI3D_STICKY_COMMAND_DEACTIVATED {${ASP.toUpperCase()}}|SI3D_COMMAND_EXECUTED ${ESC2}`, [events(), calls.length]); }
    reset(); run('Delete Components'); run('Add Surface Point Tool', {}, { A: 6, B: 0 }); tm.notifications.length = 0; run(ESC2);
    ok('Escape {41EE76F1} with supra over sticky: supra ended, sticky re-announced and its tool current again, no SI3D_COMMAND_EXECUTED', tm.supra === null && tm.sticky?.cmdId === '56aa96f5-7ae3-11d1-8036-00a0243e2717' && events().join('|') === `SI3D_SUPRA_COMMAND_DEACTIVATED {${ASP.toUpperCase()}}|SI3D_STICKY_COMMAND_ACTIVATED {56AA96F5-7AE3-11D1-8036-00A0243E2717}` && cur() === 'dac73700-99c8-11d1-84bf-00aa00135f7b' && tm.mode === 4, [events(), cur(), tm.mode]);
    reset(); { const r = run(ESC2); ok('Escape {41EE76F1} with no session: no notification, host restore logged as not yet attested, no error', !r.err && events().length === 0 && nya(r) && r.cmd === 0 && r.v === undefined, [r.err, events(), r.log]); }
  } catch (e) { ok('escape block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== manipulators
  try {
    reset(); run('TranslateTool'); { const calls = trace(['RotationTool', 'ScalingTool', 'TranslateTool'], () => run('Show Next Manipulator')); const r = run('Show Next Manipulator');
      ok('Show Next Manipulator, manager cannot step (not read: logged): Translate -> RotationTool command', calls.map(c => c.n).join() === 'RotationTool' && nya(r), [calls.map(c => c.n), r.log]);
      ok('Show Next Manipulator: Rotate -> Scale', cur() === G.scale && T.mode === 'scale', [cur(), T.mode]); }
    run('Show Next Manipulator'); ok('Show Next Manipulator: Scale -> Translate', cur() === G.translate);
    run('Show Previous Manipulator'); ok('Show Previous Manipulator: Translate -> Scale', cur() === G.scale);
    run('Show Previous Manipulator'); ok('Show Previous Manipulator: Scale -> Rotate', cur() === G.rotate);
    run('Show Next Manipulator', { Next: false }); ok('Next argument False on Show Next Manipulator: previous (Rotate -> Translate)', cur() === G.translate);
    reset(); { const c0 = cur(); const calls = trace(['RotationTool', 'ScalingTool', 'TranslateTool'], () => run('Show Next Manipulator')); ok('Show Next Manipulator with no SRT tool current: nothing', calls.length === 0 && cur() === c0, calls); }
    reset(); run('TranslateTool'); A.manipulatorManager.step = () => 0; run('Show Next Manipulator'); A.manipulatorManager.step = undefined;
    ok('Show Next Manipulator: the manager stepped (S_OK) -> the SRT tool is not switched', cur() === G.translate);
    reset(); { const u0 = A.undoStack.length; const h0 = !!A.hideManip; const s0 = A.manipulatorManager.getSetting(); A.manipulatorManager.first = 7; const r = run('Toggle Manipulator mode'); const s1 = A.manipulatorManager.getSetting();
      ok('Toggle Manipulator mode: second field of the manager setting inverted (manipulators shown <-> hidden), first field kept', s1[1] === (s0[1] ? 0 : 1) && s1[0] === 7 && !!A.hideManip === !h0, [s0, s1]);
      ok('Toggle Manipulator mode: not undoable, no log line, no return value', A.undoStack.length === u0 && r.cmd === 0 && r.v === undefined, [r.cmd, r.v]);
      run('Toggle Manipulator mode'); ok('Toggle Manipulator mode twice: back', !!A.hideManip === h0); }
  } catch (e) { ok('manipulator block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== vm.dll: framing, reset, grid, back faces
  try {
    reset(); run('ResetAllViews'); A.undoStack.length = 0; A.redoStack.length = 0;
    const L = () => A.inferredB10.camLabels;
    const i = act(); const before = vps.map(P); let n0 = L().length;
    let r = run('Frame Selection');
    const moved = vps.map((v, k) => P(v) !== before[k]);
    ok('Frame Selection: the active view only is framed on the selection, label "Frame"', !r.err && moved[i] && moved.filter(Boolean).length === 1 && L().length === n0 + 1 && L().at(-1).label === 'Frame' && L().at(-1).view === i, [moved, L().slice(n0)]);
    ok('Frame Selection: no command undo, no log line, no return value', A.undoStack.length === 0 && r.cmd === 0 && r.v === undefined, [A.undoStack.length, r.cmd]);
    const p1 = P(vps[i]);
    n0 = L().length; r = run('FrameAll');
    ok('FrameAll (AllViews true): every view labelled "Frame"', !r.err && L().length === n0 + vps.length && L().slice(n0).every((x, k) => x.label === 'Frame' && x.view === k), L().slice(n0));
    ok('FrameAll frames everything (the active view moved again)', P(vps[i]) !== p1);
    run('CameraUndo');
    ok('single-view framing is bracketed (camera history), all-views framing is not: CameraUndo goes back to before Frame Selection', P(vps[i]) === before[i] && P(vps[i]) !== p1, [P(vps[i]), before[i], p1]);
    run('ResetAllViews'); A.undoStack.length = 0;
    const b2 = vps.map(P); const other = (i + 1) % vps.length;
    run('Frame All', { View: other }); const m2 = vps.map((v, k) => P(v) !== b2[k]);
    ok('Frame All View <index>: that view only', m2[other] && m2.filter(Boolean).length === 1, m2);
    r = run('Frame All', { View: 9 }); ok('Frame All with a missing view: nothing, no error', !r.err && vps.every((v, k) => k === other || P(v) === b2[k]));
    run('ResetAllViews'); A.undoStack.length = 0;
    const b3 = vps.map(P); A.select([]); A.compSel = null; r = run('FrameSelection');
    ok('FrameSelection with nothing selected: nothing framed, no error', !r.err && vps.every((v, k) => P(v) === b3[k]));
    reset();
    // CameraReset
    vps[i].camera.position.set(5, 6, 7); vps[i].camera.updateMatrixWorld(); const ok2 = vps[other].camera.position.toArray().join(); vps[other].camera.position.set(1, 2, 3);
    { const u0 = A.undoStack.length; const n1 = L().length; r = run('CameraReset');
      ok('CameraReset (AllViews false): the active view goes to its home camera, others untouched, label "Reset"', !r.err && P(vps[i]) !== '5,6,7' && P(vps[other]) === '1,2,3' && L().at(-1).label === 'Reset' && L().length === n1 + 1, [P(vps[i]), P(vps[other])]);
      ok('CameraReset is undoable', A.undoStack.length === u0 + 1); A.undo(); ok('CameraReset undo restores the camera', P(vps[i]) === '5,6,7', P(vps[i])); }
    run('CameraReset', { AllViews: true }); ok('CameraReset AllViews true: every view (same handler as ResetAllViews)', P(vps[other]) !== '1,2,3'); A.undo();
    vps[other].camera.position.fromArray(ok2.split(',').map(Number)); run('ResetAllViews'); A.undoStack.length = 0;
    // grid
    { const g0 = !!V.active().flags['Grid']; const others = vps.filter(v => v !== V.active()).map(v => !!v.flags['Grid']); const u0 = A.undoStack.length; r = run('Show/Hide Grid');
      ok('Show/Hide Grid: the active view grid toggled, not undoable', !r.err && !!V.active().flags['Grid'] === !g0 && A.undoStack.length === u0, [g0, V.active().flags['Grid']]);
      ok('Show/Hide Grid: other views untouched', JSON.stringify(vps.filter(v => v !== V.active()).map(v => !!v.flags['Grid'])) === JSON.stringify(others));
      run('Show/Hide Grid'); ok('Show/Hide Grid twice: back', !!V.active().flags['Grid'] === g0); }
    { const f0 = !!V.active().flags['Hide Back Facing Polygons']; const u0 = A.undoStack.length; run('Hide Back Facing Polygons');
      ok('Hide Back Facing Polygons (B11h): toggles the active view flag, not undoable', !!V.active().flags['Hide Back Facing Polygons'] === !f0 && A.undoStack.length === u0); run('Hide Back Facing Polygons'); }
  } catch (e) { ok('view block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j CopyPaste
  try {
    reset(); const S = A.tasksB16c;
    const tgt = A.run('GetPrim', { PresetObj: 'Null', Name: 'tgtB17j' }); const src = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'srcB17j' });
    reset(); const u0 = A.undoStack.length; const opsBefore = src.primitive.operators.length;
    let calls = trace(['Duplicate', 'FreezeObj'], () => { globalThis.__r = run('CopyPaste', { Source: src, Target: tgt, Mode: 2 }); }); let r = globalThis.__r;
    const c2 = r.v;
    ok('CopyPaste Mode 2 (copy): Duplicate then FreezeObj on the copy; the copy under Target; one undo entry', !r.err && calls.map(c => c.n).join() === 'Duplicate,FreezeObj' && c2 && c2 !== src && c2.parentObj === tgt && src.parentObj === A.scene.root && A.undoStack.length === u0 + 1, [r.err, calls.map(c => c.n)]);
    ok('CopyPaste Mode 2: FreezeObj runs on the copy (not the source), the source keeps its operator stack', calls.find(c => c.n === 'FreezeObj')?.a.InputObjs?.[0] === c2 && src.primitive.operators.length === opsBefore, calls.map(c => c.a.InputObjs?.[0]?.name));
    A.undo(); ok('CopyPaste copy undo', tgt.children.length === 0);
    const k0 = S.notifications.length;
    calls = trace(['Duplicate', 'FreezeObj'], () => { globalThis.__r = run('CopyPaste', { Source: src, Target: tgt, Mode: 1 }); }); r = globalThis.__r;
    ok('CopyPaste Mode 1 (move): copy pasted under Target, then the DeleteObj sub-task deletes the source', !r.err && r.v && r.v !== src && r.v.parentObj === tgt && !src.parentObj && calls.map(c => c.n).join() === 'Duplicate,FreezeObj' && S.notifications.slice(k0).join() === 'SI3D_SCENE_INVALID_BEGIN,SI3D_SCENE_INVALID_END', [r.err, calls.map(c => c.n), S.notifications.slice(k0)]);
    A.undo(); ok('CopyPaste move undo: the source is back, the copy gone', src.parentObj === A.scene.root && tgt.children.length === 0);
    r = run('CopyPaste', { Source: src, Target: tgt, Mode: 3 });
    ok('CopyPaste Mode 3: the source itself is pasted under Target (no duplicate)', !r.err && r.v === src && src.parentObj === tgt && S.lastPaste.operation === 2, r.err);
    A.undo(); ok('CopyPaste Mode 3 undo', src.parentObj === A.scene.root);
    ok('CopyPaste Mode 3 onto itself -> E_INVALIDARG (inferred)', status(run('CopyPaste', { Source: src, Target: src, Mode: 3 }), '80070057'));
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(tgt); A.scene.root.removeChild(src);
  } catch (e) { ok('CopyPaste block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j Add3DObjectToScene
  try {
    reset();
    const par = A.run('GetPrim', { PresetObj: 'Null', Name: 'parB17j' }); const kid = A.run('GetPrim', { PresetObj: 'Null', Name: 'kidB17j' }); const loose = A.run('GetPrim', { PresetObj: 'Null', Name: 'looseB17j' });
    A.scene.root.removeChild(loose); const vis = loose.properties.find(p => p.type === 'visibility'); loose.removeProperty(vis);
    reset(); const u0 = A.undoStack.length;
    const r = run('Add3DObjectToScene', { InputObjs: [kid, loose], Parent: par });
    ok('Add3DObjectToScene: the object that already has a parent is skipped (not moved); the unparented one is added under Parent', !r.err && kid.parentObj === A.scene.root && loose.parentObj === par, r.err);
    ok('Add3DObjectToScene: the object missing a Visibility property gets one (SIAddProp)', loose.properties.some(p => p.type === 'visibility'));
    ok('Add3DObjectToScene: the final kinematics sub-task logged as not yet attested; one undo entry', nya(r) && A.undoStack.length === u0 + 1, r.log);
    A.undo(); ok('Add3DObjectToScene undo: removed from the scene again, property removed', !loose.parentObj && !loose.properties.some(p => p.type === 'visibility'));
    A.redo(); ok('Add3DObjectToScene redo', loose.parentObj === par); A.undo();
    A.scene.root.removeChild(kid); A.scene.root.removeChild(par);
  } catch (e) { ok('Add3DObjectToScene block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j SetReference2
  try {
    reset();
    A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [cube] });
    const ph = cube.material.surface; const chk = A.run('CreateShaderFromPreset', { PresetObj: 'Checkerboard', Container: [cube.material] });
    const TL = A.textureLayers; const port = { owner: ph, name: 'diffuse' }; const prm = ph.get('diffuse');
    const u0 = A.undoStack.length;
    run('SetReference2', { Target: port, Value: chk }); ok('fixture: an unfiltered port connects the shader', TL.getSource(port) === chk);
    prm.referenceFilter = 'siObjectReferenceFilter'; run('SetReference2', { Target: port, Value: null }); run('SetReference2', { Target: port, Value: chk });
    ok('SetReference2: Value of the wrong class for the port filter (Object filter, shader Value) -> disconnected, no error', TL.getSource(port) === null);
    prm.referenceFilter = 5; run('SetReference2', { Target: port, Value: chk });
    ok('SetReference2: Shader filter (5) accepts a shader', TL.getSource(port) === chk);
    let r = run('SetReference2', { Target: port, Value: ph });
    ok('SetReference2: a Value equal to the port owner is dropped (disconnect, no self reference)', !r.err && TL.getSource(port) === null, r.err);
    prm.referenceFilter = 1; A.setSelMode('point'); A.selectComponents(cube, 'point', [0, 1]); const nc = cube.clusters.length; try { A.run('CreateCluster'); } catch { /* */ } const clu = cube.clusters.length > nc ? cube.clusters.at(-1) : null; A.setSelMode('object'); A.select([cube]);
    r = run('SetReference2', { Target: port, Value: clu ?? cube });
    ok('SetReference2: a sub-object Value (cluster) is replaced by its owning 3D object (Object filter accepts it)', !!clu && !r.err && TL.getSource(port) === cube, [r.err, TL.getSource(port)?.name, clu?.name]);
    prm.referenceFilter = 2; r = run('SetReference2', { Target: port, Value: cube }); ok('SetReference2: Camera filter (2) refuses a mesh object -> disconnected', TL.getSource(port) === null);
    const cam = [...A.scene.allObjects()].find(o => o.type === 'camera');
    run('SetReference2', { Target: port, Value: cam }); ok('SetReference2: Camera filter accepts a camera', !!cam && TL.getSource(port) === cam, cam?.name);
    prm.referenceFilter = 6; run('SetReference2', { Target: port, Value: cube }); ok('SetReference2: Geometry filter (6) accepts a mesh object', TL.getSource(port) === cube);
    delete prm.referenceFilter;
    while (A.undoStack.length > u0) A.undo();
  } catch (e) { ok('SetReference2 block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j DeleteObj
  try {
    reset(); const S = A.tasksB16c; const u0 = A.undoStack.length;
    const cams = [...A.scene.allObjects()].filter(o => o.type === 'camera'); const names0 = [...A.scene.allObjects()].map(o => o.name);
    let r = run('DeleteObj', { InputObj: cams }); const k0 = S.notifications.length;
    ok('DeleteObj: deleting every scene camera is refused (warning XSITASKS 0x436), nothing deleted, status 0x562E80D2', !r.err && cams.length > 0 && cams.every(c => !!c.parentObj) && has(r, /^WARNING : .*0x436/) && S.status.DeleteObj === 0x562e80d2 && A.undoStack.length === u0, [r.err, r.log, cams.length, names0]);
    const a1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'delA17j' }); const b1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'delB17j' }); reset();
    A.lockRecordsB11 ??= new Map(); A.lockRecordsB11.set(a1, [{ type: 0, lockLevel: 0xffff, tagLevel: 0, id: 0 }]);
    r = run('DeleteObj', { InputObj: [a1, b1] });
    ok('DeleteObj: a locked item raises the lock error and is dropped; warning 0x13a lists it; the rest is deleted', !r.err && a1.parentObj && !b1.parentObj && has(r, /delA17j is locked/) && has(r, /^WARNING : .*delA17j.*0x13a/), r.log);
    A.undo();
    r = run('DeleteObj', { InputObj: [a1] });
    ok('DeleteObj: nothing left after the drops -> E_INVALIDARG with message 0x13a', status(r, '80070057') && /0x13a/.test(r.err) && a1.parentObj, r.err);
    A.lockRecordsB11.delete(a1);
    const prm = cube.kinematics.local.get('posx');
    r = run('DeleteObj', { InputObj: [prm, b1] });
    ok('DeleteObj: a parameter (not a scene object) is dropped, the object deleted', !r.err && !b1.parentObj && has(r, /0x13a/), r.log); A.undo();
    A.select([b1, cube]); const n1 = S.notifications.length; r = run('DeleteObj', { InputObj: [b1] });
    ok('DeleteObj: the deleted object is removed from the selection first (Remove From Selection), the rest stays selected', !r.err && A.selection.length === 1 && A.selection[0] === cube && S.notifications.slice(n1).join() === 'SI3D_SCENE_INVALID_BEGIN,SI3D_SCENE_INVALID_END', [A.selection.map(x => x.name), S.notifications.slice(n1)]);
    const n2 = S.notifications.length; A.undo();
    ok('DeleteObj undo: object back, selection restored (undoable), inside SI3D_SCENE_INVALID_BEGIN / END', b1.parentObj === A.scene.root && A.selection.includes(b1) && S.notifications.slice(n2).join() === 'SI3D_SCENE_INVALID_BEGIN,SI3D_SCENE_INVALID_END', [A.selection.map(x => x.name), S.notifications.slice(n2)]);
    A.setSelMode('point'); A.selectComponents(b1.primitive ? b1 : cube, 'point', [0]); const csObj = A.compSel?.obj;
    if (csObj === cube) { const tmp = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'csB17j' }); A.setSelMode('point'); A.selectComponents(tmp, 'point', [0, 1]);
      r = run('DeleteObj', { InputObj: [tmp] }); ok('DeleteObj: active components of a deleted object are deactivated (Deactivate Elements)', !r.err && !tmp.parentObj && A.compSel === null, A.compSel?.obj?.name);
      A.undo(); ok('DeleteObj undo: active components back', A.compSel?.obj === tmp); A.undo(); }
    A.setSelMode('object');
    r = run('DeleteObj', { InputObj: [] }); ok('DeleteObj with an empty list: no-op, status 0x562E80D2', !r.err && S.status.DeleteObj === 0x562e80d2);
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(a1); A.scene.root.removeChild(b1);
  } catch (e) { ok('DeleteObj block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j RunPerformanceTest
  try {
    reset(); const FS = A.tasksB16c.fs; FS.ensureFolder('C:\\PerfB17j'); const file = 'C:\\PerfB17j\\perf.txt';
    if (FS.isFile(file)) FS.deleteFile(file);
    A.scenePath = 'C:\\Scenes\\b17j.scn';
    let r = run('RunPerformanceTest', { Type: 2, FileName: file, Duration: 0.15 }); let t = FS.readFile(file);
    ok('RunPerformanceTest: header, then scene block "XSI SCENE INFO:" with Scene / Path', t.startsWith('\n\n==========\nTEST 2: [PLAYBACK (incl. UPDATE) performance -- NO INSTRUMENTATION]\n') && t.includes(`\nXSI SCENE INFO:\n   Scene: '${A.scene.name}'\n   Path : C:\\Scenes\\b17j.scn\n`), t.slice(0, 400));
    ok('RunPerformanceTest: GL version / vendor / renderer lines and "<n> Active OGL view(s)"', /\nGL version: .*\nGL vendor: .*\nGL renderer: .*\n {3}\d+ Active OGL view\(s\)\n/.test(t), t.slice(0, 600));
    ok('RunPerformanceTest: per view "Active view: <letter> [<index>] (<w>x<h>)", the camera line and the FrustumCull line', /\n {6}Active view: A \[0\] \(\d+x\d+\)  {0,9}(VIEWPOINT|SCENE|MONITOR|SPOTLIGHT|Unknown): '[^']*' \([A-Z_ ]+ (FULL|COARSE|MEDIUM)\)\n {9}FrustumCull: \d, XRayShade: \d, TranspShade: \d\n/.test(t), t.slice(0, 800));
    ok('RunPerformanceTest: results block "RESULTS:", "Time elapsed to draw <n> frames", "Average of ... frames/second or ...ms per refresh."', /\nRESULTS:\n {3}Time elapsed to draw [1-9]\d* frames: \d+\.\d\d seconds\.\n {3}Average of [\d.]+ frames\/second or [\d.]+ms per refresh\.\n/.test(t), t.slice(-400));
    ok('RunPerformanceTest: not instrumented -> "Instrumentation data was not requested."', t.includes('   Instrumentation data was not requested.\n\n'));
    ok('RunPerformanceTest: no per-frame lines (no "frame" line before RESULTS other than the header)', !/\n {3}Frame \d/.test(t));
    ok('RunPerformanceTest: the system information block logged as not yet attested; ran at least Duration', nya(r) && A.inferredB10.perf?.seconds >= 0.15, [r.log, A.inferredB10.perf]);
    r = run('RunPerformanceTest', { Type: 3, FileName: file, Duration: 0 }); t = FS.readFile(file);
    ok('RunPerformanceTest Duration 0: zero frames, results still written (no clamp)', A.inferredB10.perf?.frames === 0 && /Time elapsed to draw 0 frames/.test(t.slice(t.lastIndexOf('RESULTS'))), A.inferredB10.perf);
    r = run('RunPerformanceTest', { Type: 1, FileName: file, Duration: -2 }); t = FS.readFile(file);
    ok('RunPerformanceTest negative Duration: header says ">= -2.0 sec", zero frames', t.includes('   Duration: >= -2.0 sec\n') && A.inferredB10.perf?.frames === 0);
    ok('RunPerformanceTest instrumented (Type 1): per-view statistics logged as not yet attested', nya(r));
    ok('RunPerformanceTest: no return value', r.v === undefined);
    delete A.scenePath; r = run('RunPerformanceTest', { Type: 3, FileName: file, Duration: 0 }); t = FS.readFile(file);
    ok('RunPerformanceTest: no scene path -> no scene block', !t.slice(t.lastIndexOf('==========')).includes('XSI SCENE INFO'));
    FS.deleteFile(file);
  } catch (e) { ok('RunPerformanceTest block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ======================================================================== B17j Undo / Redo Repetitions
  try {
    reset(); const S = A.tasksB16c; const saved = A.undoStack.splice(0), savedR = A.redoStack.splice(0);
    const x0 = cube.kinematics.local.val('posx');
    A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 });
    let r = run('Undo', { Repetitions: 0 });
    ok('Undo Repetitions 0: nothing undone, Repetitions left at 0', !r.err && r.v === 0 && S.out.Undo.Repetitions === 0 && A.undoStack.length === 1, [r, S.out.Undo]);
    r = run('Undo', { Repetitions: -1 });
    ok('Undo Repetitions -1: VT_UI4 conversion fails (0x8002000A, inferred), nothing undone', status(r, '8002000a') && A.undoStack.length === 1, r.err);
    A.undo(); r = run('Redo', { Repetitions: 0 });
    ok('Redo Repetitions 0: nothing redone, Repetitions 0', !r.err && r.v === 0 && S.out.Redo.Repetitions === 0 && A.redoStack.length === 1, [r, S.out.Redo]);
    ok('fixture: cube back where it was', Math.abs(cube.kinematics.local.val('posx') - x0) < 1e-9);
    A.undoStack.splice(0, A.undoStack.length, ...saved); A.redoStack.splice(0, A.redoStack.length, ...savedR);
  } catch (e) { ok('Undo block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  reset();
  return out;
}, { ROWS, DEFAULT_FAILS, ESC2 });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const [bus, , , key] of ROWS) {
  report(`${bus}: registered`, got.reg[bus] !== null);
  report(`${bus}: catalogue argument list`, catalogue[bus] !== null && JSON.stringify(got.reg[bus]) === JSON.stringify(catalogue[bus]), `${JSON.stringify(got.reg[bus])} vs ${JSON.stringify(catalogue[bus])}`);
  report(`${bus}: default run`, got.defaults[bus] === 'ok' || got.defaults[bus] === 'expected-failure', got.defaults[bus]);
  if (key) report(`${bus}: key map action "${key}" runs it`, got.keys[bus] === 'ok', got.keys[bus]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
const n = r => ROWS.filter(x => x[2] === r).length;
console.log(`compare_views_tasks_b17ij: ${pass}/${pass + fail} ok (${n('B17i')} CMD-B17i + ${n('B17j')} CMD-B17j commands; ${got.checks.length} contract checks)`);
await browser.close();
process.exit(fail ? 1 : 0);
