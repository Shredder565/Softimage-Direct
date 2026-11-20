// CMD-B16a: the 72 tool-activation commands of toolmanager.dll (docs/ghidra/cmd-b16a-tool-activation-commands.md,
// docs/re/WIRE_CORRECTIONS_B16.md items 1–12). No XSIBATCH golden exists: this checks the wire contract's stated results.
//   1. every command is registered with the catalogue argument list (data/commands_full.json; VT_CLSID defaults);
//   2. every command runs with its default arguments on the ?demo scene without an error, returns nothing, records no
//      undo and logs no command line; none is disabled (correction 12);
//   3. the contract: tool class = Clsid argument (explicit override, GUID_NULL = last auxiliary tool), already-current
//      rules (Interaction.stickytoggle, restart bit), last-auxiliary exclusions, SRT memory, key-down / key-up paths,
//      Pick Session exemption, DoNothing ending the current tool, MoveComponent class, uncreatable class = no effect,
//      the 0461b2bd session dispatcher and the `XYZ Transform ` relay (E_INVALIDARG).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tools_b16a.mjs
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

// the 72 registry entries of the three handlers, with their catalogue argument lists
const HANDLERS = { '0461b2c6-0ae3-11d2-8065-00a0c955b335': 'A', '0461b2bd-0ae3-11d2-8065-00a0c955b335': 'S', '0461b2c7-0ae3-11d2-8065-00a0c955b335': 'N' };
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const leGuid = (raw) => { const b = Buffer.from(raw, 'hex'); const h = (i, n, rev) => { const s = b.subarray(i, i + n); return Buffer.from(rev ? [...s].reverse() : s).toString('hex'); }; return `${h(0, 4, 1)}-${h(4, 2, 1)}-${h(6, 2, 1)}-${h(8, 2)}-${h(10, 6)}`; };
const ROWS = registry.filter(c => HANDLERS[c.handler_clsid]).map(c => {
  const regArgs = c.args.map(a => [a.name, a.vt === 72 ? a.handler_clsid : a.vt === 96 ? leGuid(a.default_raw) : a.default]);
  const f = full.find(x => x.name === c.name && x.scripting_name === c.scripting_name && x.args.length === regArgs.length
    && x.args.every((y, i) => y.name === regArgs[i][0] && String(y.default).replace(/[{}]/g, '').toLowerCase() === String(regArgs[i][1]).toLowerCase()));
  const bus = c.guid === 'cf80cbc2-984e-11d1-96e7-00a024191bac' ? '{CF80CBC2-984E-11D1-96E7-00A024191BAC}' : (c.scripting_name || c.name);
  return { bus, name: c.name, guid: c.guid, h: HANDLERS[c.handler_clsid], args: f ? f.args.map(a => [a.name, a.default ?? null]) : null };
});
if (ROWS.length !== 72) { console.error(`expected 72 registry entries, got ${ROWS.length}`); process.exit(2); }

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.toolManager && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ ROWS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const tm = A.toolManager; const T = window.__tool; const nav = window.__navTool;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}, ctx) => { const m = A.log.length; if (ctx) A.toolExecContext = ctx; try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), cmd: L.filter(l => l.kind === 'cmd').length }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status, log: A.log.slice(m).map(l => l.text) }; } };
  const nya = r => (r.log ?? []).some(l => /not yet attested/.test(l));
  const G = { translate: '3a711ff0-8798-11d1-84b1-00aa00135f7b', rotate: 'ecbad3a0-974b-11d1-84bf-00aa00135f7b', scale: 'f500bd80-974b-11d1-84bf-00aa00135f7b', select: '11778840-8c5c-11d1-84b5-00aa00135f7b',
    orbit: '1ceb5700-7881-11d1-84b0-00aa00135f7b', mayaZoom: '462d51a8-dc72-46e9-ad70-afbf3cf87835', vslider: 'b3e7200c-2273-4d19-8428-c206ec058d0d', tweak: '9eebc290-e6b8-437a-b3e4-84e9a4fff3a3',
    moveComp: 'da55a810-5f86-11d2-b11c-00a0c906811e', pick: 'cf80cbc3-984e-11d1-96e7-00a024191bac', doNothing: '2b2ffb2e-5987-11d2-8411-00a0c961747d', cvCurve: '7cfe3e5b-d182-11d2-91ed-00a0c9612e3a',
    manip: '36ad0600-98dc-11d1-84bf-00aa00135f7b', nav: '988e8c81-0a1f-11d3-bfe4-00a0248f9397', nav3ds: 'a31f01db-e282-4d0a-8a62-3d36a544da7a', surfPt: 'dccb8091-b82c-11d1-a900-00a024190119', delTool: 'dac73700-99c8-11d1-84bf-00aa00135f7b' };
  const NULLG = '00000000-0000-0000-0000-000000000000';
  const cur = () => tm.current();
  const setPref = (k, v) => { A.prefValues ??= {}; if (v === undefined) delete A.prefValues[`preferences.Interaction.${k}`]; else A.prefValues[`preferences.Interaction.${k}`] = v; };
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool(null); nav?.set(null); T.setMode('select'); A.selMode = 'object'; A.compSel = null; A.select([cube]); tm.stateOverride.clear(); tm.eligibleOverride.clear(); tm.prevSrt = '00000000-0000-0000-0000-000000000000'; setPref('stickytoggle'); setPref('stickykeys'); A.toolExecContext = undefined; };
  const objCount = () => [...A.scene.allObjects()].length;

  // 0. LastTool on a fresh session: nothing recorded -> class stays GUID_NULL, nothing happens
  reset();
  { const c0 = cur(); const r = run('LastTool'); ok('LastTool with no recorded auxiliary tool: no-op (Do returns on GUID_NULL)', !r.err && cur() === c0 && tm.trace.at(-1)?.op === 'noop-null', [r.err, tm.trace.at(-1)]); }

  // 1. registration
  for (const R of ROWS) { const d = A.commands.get(R.bus); out.reg[R.bus] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const R of ROWS) {
    reset(); const u0 = A.undoStack.length; const c0 = objCount();
    const r = run(R.bus);
    const enabled = window.__commandEnabled ? window.__commandEnabled(R.bus) : true;
    out.defaults[R.bus] = r.err ? 'ERROR: ' + r.err : r.v !== undefined ? 'returned a value' : A.undoStack.length !== u0 ? 'recorded undo' : r.cmd ? 'logged a command line' : objCount() !== c0 ? 'changed the scene' : enabled === false ? 'disabled' : 'ok';
    while (A.undoStack.length > u0) A.undo();
  }
  reset();

  try {
    // ---- class from the Clsid argument; plain activation
    reset(); run('TranslateTool');
    ok('TranslateTool: class 3a711ff0 current, MCP translate, tool mode 1', cur() === G.translate && T.mode === 'translate' && tm.mode === 1, [cur(), T.mode, tm.mode]);
    run('TranslateTool', { Clsid: '{ECBAD3A0-974B-11D1-84BF-00AA00135F7B}' });
    ok('explicit Clsid overrides the command (TranslateTool with the Rotate class -> rotate)', cur() === G.rotate && T.mode === 'rotate', [cur(), T.mode]);
    { const c0 = cur(); const r = run('ScalingTool', { Clsid: '{12345678-1234-1234-1234-123456789ABC}' });
      ok('uncreatable class: no error, no effect', !r.err && cur() === c0 && tm.trace.at(-1)?.op === 'activate-uncreatable', [r.err, cur(), tm.trace.at(-1)]); }
    // ---- already current: stickytoggle (default true) toggles off; off -> nothing; restart bit
    reset(); run('RotationTool'); run('RotationTool');
    ok('already current + Interaction.stickytoggle on (SPDL default): toggled off', cur() !== G.rotate && T.mode !== 'rotate', [cur(), T.mode]);
    reset(); setPref('stickytoggle', false); run('RotationTool'); const n0 = tm.trace.length; run('RotationTool');
    ok('already current + stickytoggle off: nothing happens', cur() === G.rotate && tm.trace.slice(n0).map(t => t.op).join() === 'noop-current', tm.trace.slice(n0));
    { const n1 = tm.trace.length; run('RotationTool', {}, { A: 0, B: 0x10 });
      ok('already current + restart bit 0x10: deactivated then activated again, mode 1', cur() === G.rotate && tm.trace.slice(n1).some(t => t.op === 'deactivate') && tm.trace.slice(n1).some(t => t.op === 'activate' && t.clsid === G.rotate) && tm.mode === 1, tm.trace.slice(n1)); }
    // ---- last auxiliary tool
    reset(); run('VirtualSliderTool'); run('TranslateTool'); run('LastTool');
    ok('LastTool re-activates the last auxiliary tool (Virtual Slider; Translate excluded)', cur() === G.vslider && A.activeTool?.name === 'Virtual Slider Tool', [cur(), A.activeTool?.name]);
    reset(); run('VirtualSliderTool');
    for (const n of ['ManipulateTool', 'TranslateTool', 'RotationTool', 'ScalingTool', 'Activate Current Select Tool using Filter', 'CamNavigTool', 'Cam3dsMaxNavigTool']) { reset(); run(n); }
    ok('excluded from the last auxiliary tool: Manipulate, SRT, selection, both Navigation tools', tm.getLastAux() === G.vslider, tm.getLastAux());
    reset(); run('CamOrbitTool');
    ok('a camera tool other than Navigation is recorded (default category, inferred)', tm.getLastAux() === G.orbit, tm.getLastAux());
    reset(); run('VirtualSliderTool'); reset(); run('TweakTool', { Clsid: NULLG });
    ok('any tool command with Clsid GUID_NULL activates the last auxiliary tool', cur() === G.vslider, cur());
    // ---- SRT memory and deactivation fallback
    reset(); run('TranslateTool'); run('CamOrbitTool');
    ok('SRT memory: activating a tool while Translate is current stores it as previous SRT tool', tm.prevSrt === G.translate && nav.get() === 'Orbit Tool', [tm.prevSrt, nav.get()]);
    run('CamOrbitTool');
    ok('toggling the camera tool off returns to the stored SRT tool (inferred fallback)', cur() === G.translate && T.mode === 'translate' && nav.get() === null, [cur(), T.mode, nav.get()]);
    reset(); run('Activate Current Select Tool using Filter'); run('CamDollyTool');
    ok('SRT memory: GUID_NULL when the current tool is not Translate / Rotate / Scale', tm.prevSrt === NULLG, tm.prevSrt);
    // ---- tool-state refusal and the Pick Session exemption
    reset(); tm.stateOverride.set(G.tweak, 0); { const c0 = cur(); run('TweakTool'); ok('tool state 0: the activation helper refuses (S_FALSE), nothing activated', cur() === c0 && tm.trace.at(-1)?.op === 'refused', [cur(), tm.trace.at(-1)]); }
    reset(); tm.eligibleOverride.set(G.tweak, false); { const c0 = cur(); run('TweakTool'); ok('eligibility query fails: refused', cur() === c0, cur()); }
    reset(); tm.stateOverride.set(G.pick, 0); tm.eligibleOverride.set(G.pick, false); { const r = run('Pick Session Tool'); ok('Pick Session Tool: exempt from the refusal, current outside a pick session (logged)', cur() === G.pick && nya(r), [cur(), r.log]); }
    // ---- key-down (supra) / key-up
    reset(); run('TranslateTool'); tm.mode = 1; run('CamOrbitTool', {}, { A: 6, B: 0 });
    ok('key-down, stickykeys on: activated, supra filter stops (mode not set)', cur() === G.orbit && tm.mode === 1, [cur(), tm.mode]);
    reset(); run('Activate Current Select Tool using Filter'); run('CamMayaZoomTool', {}, { A: 6, B: 0 });
    ok('key-down, stickykeys on: Maya Zoom is the exception (mode 2 = supra)', cur() === G.mayaZoom && tm.mode === 2, [cur(), tm.mode]);
    { const a0 = tm.getLastAux(); run('CamMayaZoomTool', {}, { A: 4, B: 0 });
      ok('key-up after a tap (state 0, eligible): tool made sticky, recorded, mode 1', cur() === G.mayaZoom && tm.mode === 1 && tm.getLastAux() === G.mayaZoom, [cur(), tm.mode, a0, tm.getLastAux()]); }
    reset(); setPref('stickykeys', false); run('Activate Current Select Tool using Filter'); tm.mode = 1; run('TranslateTool', {}, { A: 6, B: 0 });
    ok('key-down, stickykeys off: Translate activated, mode not set', cur() === G.translate && tm.mode === 1, [cur(), tm.mode]);
    reset(); setPref('stickykeys', false); run('Activate Current Select Tool using Filter'); run('CamOrbitTool', {}, { A: 6, B: 0 });
    ok('key-down, stickykeys off: other tools enter supra mode 2', cur() === G.orbit && tm.mode === 2, [cur(), tm.mode]);
    tm.stateOverride.set(G.orbit, 2); run('CamOrbitTool', {}, { A: 4, B: 0 });
    ok('key-up after use (state != 0, != 1): previous SRT cleared, tool deactivated', cur() !== G.orbit && tm.prevSrt === NULLG && nav.get() === null, [cur(), tm.prevSrt, nav.get()]);
    reset(); setPref('stickykeys', false); run('CamOrbitTool', {}, { A: 6, B: 0 }); tm.stateOverride.set(G.orbit, 5); run('CamOrbitTool', {}, { A: 4, B: 0 });
    ok('key-up with state 5: mode 6, tool stays', cur() === G.orbit && tm.mode === 6, [cur(), tm.mode]);
    reset(); setPref('stickytoggle', false); run('CamOrbitTool'); tm.stateOverride.set(G.orbit, 1); run('CamOrbitTool', {}, { A: 4, B: 0 });
    ok('key-up with state 1 and stickytoggle off: tool stays', cur() === G.orbit, cur());
    reset(); { const c0 = cur(); run('CamPivotTool', {}, { A: 4, B: 0 }); ok('key-up for a tool that is not current: nothing', cur() === c0, cur()); }
    // ---- DoNothing ends the current tool
    reset(); run('CVNURBSCurveTool'); const armed = A.activeTool;
    ok('CVNURBSCurveTool arms the CV curve drawing tool', armed?.name === 'Draw Cubic by CVs' && cur() === G.cvCurve, [armed?.name, cur()]);
    { const r = run('DoNothing'); ok('DoNothing: activates the inert class 2b2ffb2e, the current tool ends', !r.err && A.activeTool === null && cur() === G.doNothing, [A.activeTool?.name, cur()]); }
    reset(); run('CamOrbitTool'); run('DoNothing'); ok('DoNothing ends a navigation tool', nav.get() === null && cur() === G.doNothing, [nav.get(), cur()]);
    // ---- MoveComponent Tool: own class, Tweak body stand-in
    reset(); { const r = run('MoveComponent Tool'); ok('MoveComponent Tool: class da55a810 current (not the Tweak class); stand-in logged', cur() === G.moveComp && cur() !== G.tweak && nya(r), [cur(), r.log]); }
    // ---- tools with no viewport tool in this build: current + logged
    reset(); { const r = run('Delete Objects Tool'); ok('Delete Objects Tool: class dac73700 current, tool not in this build (logged)', cur() === G.delTool && nya(r), [cur(), r.log]); }
    // ---- interactive tool left outside the manager (Esc) is no longer current
    reset(); run('VirtualSliderTool'); A.setTool(null); setPref('stickytoggle', false); run('VirtualSliderTool');
    ok('a viewport tool left with Esc is no longer current: the command re-arms it', A.activeTool?.name === 'Virtual Slider Tool', A.activeTool?.name);
    // ---- PropTransformTool on / off with the current tool
    reset(); A.proportional.on = false; run('PropTransformTool'); const pOn = A.proportional.on; run('TranslateTool');
    ok('PropTransformTool: proportional on while current, off when replaced (inferred)', pOn === true && A.proportional.on === false, [pOn, A.proportional.on]);
    // ---- no log line, no undo, nothing returned
    reset(); { const u0 = A.undoStack.length; const r = run('TweakTool'); ok('tool command: no command log line, no undo, returns nothing', r.cmd === 0 && A.undoStack.length === u0 && r.v === undefined, [r.cmd, r.v]); }

    // ---- 0461b2bd session dispatcher
    reset(); { const r = run('Add Surface Point Tool'); ok('Add Surface Point Tool, plain call (A = 0): ends the session; none running -> logged, nothing', !r.err && tm.session === null && nya(r), [r.err, tm.session, r.log]); }
    reset(); { run('Add Surface Point Tool', { CmdID: '{11111111-1111-1111-1111-111111111111}' }, { A: 2, B: 0 });
      ok('Add Surface Point Tool, key-down: session for the command GUID (CmdID argument ignored), class dccb8091 current', tm.session?.cmdId === 'dccb8090-b82c-11d1-a900-00a024190119' && tm.session?.clsid === G.surfPt && cur() === G.surfPt, [tm.session, cur()]);
      run('Delete Components', {}, { A: 2, B: 0 });
      ok('starting another session ends the running one', tm.session?.cmdId === '56aa96f5-7ae3-11d1-8036-00a0243e2717' && tm.trace.some(t => t.op === 'session-end' && t.detail === 'dccb8090-b82c-11d1-a900-00a024190119'), tm.session);
      run('Delete Components');
      ok('plain call ends the running session of that command', tm.session === null && cur() !== G.delTool, [tm.session, cur()]);
      const n0 = tm.trace.length; run('{CF80CBC2-984E-11D1-96E7-00A024191BAC}', {}, { A: 1, B: 0 });
      ok('Paint Tool {CF80CBC2}: A bit 0x1 only -> S_OK, nothing', tm.session === null && tm.trace.length === n0, tm.trace.slice(n0));
      run('{CF80CBC2-984E-11D1-96E7-00A024191BAC}', {}, { A: 2, B: 0 });
      ok('Paint Tool {CF80CBC2}: key-down starts the pick-session tool cf80cbc3', tm.session?.clsid === G.pick && cur() === G.pick, [tm.session, cur()]);
      run('{CF80CBC2-984E-11D1-96E7-00A024191BAC}'); }

    // ---- XYZ Transform relay
    reset();
    { let seen = null; const off = A.events.on('commandstate', d => { seen = d; }); const c0 = objCount(); const u0 = A.undoStack.length;
      const r = run('XYZ Transform ');
      ok('XYZ Transform : default fires SI3D_COMMAND_EXECUTED with the command GUID; no scene change, no undo', !r.err && seen?.event === 'SI3D_COMMAND_EXECUTED' && JSON.stringify(seen?.args) === JSON.stringify(['{B4238EB0-1D86-11D1-806D-00A024C78EE3}']) && objCount() === c0 && A.undoStack.length === u0 && r.v === undefined, [r.err, seen]);
      const all = ['SI3D_SUPRA_COMMAND_ACTIVATED', 'SI3D_SUPRA_COMMAND_DEACTIVATED', 'SI3D_STICKY_COMMAND_ACTIVATED', 'SI3D_STICKY_COMMAND_DEACTIVATED', 'SI3D_COMMAND_EXECUTED'];
      const got5 = all.map(p => { seen = null; const q = run('XYZ Transform ', { Property: p }); return !q.err && seen?.event === p; });
      ok('XYZ Transform : the five SI3D_* names are accepted and relayed', got5.every(Boolean), got5);
      for (const bad of ['BOGUS', 'si3d_command_executed', '']) { seen = null; const q = run('XYZ Transform ', { Property: bad });
        ok(`XYZ Transform : Property ${JSON.stringify(bad)} -> E_INVALIDARG 0x80070057, no notification`, q.err && q.status === 0x80070057 && seen === null, [q.err, q.status]); }
      off(); }
    // ---- Transform Set New : inert, no log
    { const r = run('Transform Set New '); ok('Transform Set New : inert, no log', !r.err && r.v === undefined && r.log.length === 0, r.log); }
  } catch (e) { ok('contract block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset();
  return out;
}, { ROWS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const R of ROWS) {
  report(`${R.bus}: registered`, got.reg[R.bus] !== null);
  report(`${R.bus}: catalogue argument list`, R.args !== null && JSON.stringify(got.reg[R.bus]) === JSON.stringify(R.args), `${JSON.stringify(got.reg[R.bus])} vs ${JSON.stringify(R.args)}`);
  report(`${R.bus}: default run (no error, no value, no undo, no log line, enabled)`, got.defaults[R.bus] === 'ok', got.defaults[R.bus]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
const byH = ROWS.reduce((m, r) => (m[r.h] = (m[r.h] ?? 0) + 1, m), {});
console.log(`compare_tools_b16a: ${pass}/${pass + fail} ok (${ROWS.length} commands: ${byH.A} activate-tool, ${byH.S} session dispatcher, ${byH.N} relay; ${got.checks.length} contract checks)`);
await browser.close();
process.exit(fail ? 1 : 0);
