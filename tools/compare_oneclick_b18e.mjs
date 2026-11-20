// CMD-B18e (iceflow.dll OneClick Send To Maya / 3ds Max / Mudbox): the 19 commands of src/commands/oneClickB18e.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b18e-iceflow-oneclick.md
// section 4 and docs/re/WIRE_CORRECTIONS_B18.md items 13-18.
//   1. every name is registered with the catalogue argument list (data/commands_full.json), siNoLogging (no command
//      line in the log) and not undoable;
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error;
//   3. the contract's stated results: OneClickGetState "" when not connected / a status text when connected,
//      OneClickGetRemoteAppName "Maya" / "3ds Max" / "Mudbox" / "", OneClickSendTo routing, OneClickSetup creates
//      ICEFlowState on the scene root, the select-previous commands restore the selection saved by the last send, send
//      flags, empty-selection prompt (OK / Cancel), return values, and the "not yet attested ... CMD-B18e" logs.
// The remote app is a stand-in (app.oneClickB18e.link). Needs `vite preview` (SI_URL, default :4173).
// Usage: node tools/compare_oneclick_b18e.mjs
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
  'OneClickGetRemoteAppName', 'OneClickGetState', 'OneClickGetStatusText', 'OneClickSelectObjects',
  'OneClickSendTo3dsMaxAddToCurrentScene', 'OneClickSendTo3dsMaxSelectPreviousObjects', 'OneClickSendTo3dsMaxSendAsNewScene',
  'OneClickSendTo3dsMaxUpdateCurrentScene', 'OneClickSendToMax', 'OneClickSendToMayaAddToCurrentScene',
  'OneClickSendToMayaSelectPreviousObjects', 'OneClickSendToMayaSendAsNewScene', 'OneClickSendToMayaUpdateCurrentScene',
  'OneClickSendToMudboxAddToCurrentScene', 'OneClickSendToMudboxSelectPreviousObjects', 'OneClickSendToMudboxSendAsNewScene',
  'OneClickSendToMudboxUpdateCurrentScene', 'OneClickSendTo', 'OneClickSetup',
];
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('OneClickSetup') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), cmdLines: L.filter(l => l.kind === 'cmd').length }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), cmdLines: 0 }; } };
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B18e/.test(l));
  const J = JSON.stringify;
  const S = A.oneClickB18e;
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); S.link.app = null; S.link.busy = false; S.promptAnswer = 1; S.sendBackIceTrees = null; S.outbox.length = 0; S.raised.length = 0; S.prompts.length = 0; };
  const sel = () => J(A.selection.map(n => n.name));

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) { const d = A.commands.get(n); ok(`${n}: siNoLogging, not undoable`, d?.noLog === true && !d?.undoable); }
  // 2. default runs, with command logging on
  A.cmdLog = true;
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? 'ERROR: ' + r.err : 'ok';
    ok(`${n}: no command line logged`, r.cmdLines === 0, r.cmdLines);
  }
  reset();

  try {
    // ---- GetState / GetRemoteAppName / GetStatusText
    ok('OneClickGetState: "" when not connected', run('OneClickGetState').v === '');
    ok('OneClickGetRemoteAppName: "" when not connected', run('OneClickGetRemoteAppName').v === '');
    S.link.app = 'Maya';
    const s1 = run('OneClickGetState').v; S.link.busy = true; const s2 = run('OneClickGetState').v;
    ok('OneClickGetState: connected -> text 0x1c6d, busy -> 0x1c6e', s1 === '[XSIPLUGINUI 0x1c6d]' && s2 === '[XSIPLUGINUI 0x1c6e]', [s1, s2]);
    for (const nm of ['Maya', '3ds Max', 'Mudbox']) { S.link.app = nm; ok(`OneClickGetRemoteAppName: "${nm}"`, run('OneClickGetRemoteAppName').v === nm); }
    reset();
    S.status = '';
    ok('OneClickGetStatusText: "" before any send', run('OneClickGetStatusText').v === '');

    // ---- OneClickSetup
    const root = A.scene.root;
    const findP = () => root.properties.filter(p => p.name === 'ICEFlowState');
    for (const p of findP()) root.properties.splice(root.properties.indexOf(p), 1);
    let r = run('OneClickSetup');
    ok('OneClickSetup: creates ICEFlowState on the scene root, returns nothing', !r.err && r.v === undefined && findP().length === 1, r.err);
    const ifs = findP()[0];
    ok('ICEFlowState: CrowdExportType and ExportVisibilityAsShow', ifs?.get('CrowdExportType') !== undefined && ifs?.get('ExportVisibilityAsShow') !== undefined);
    ok('OneClickSetup: inspects the property', S.inspected.at(-1) === ifs);
    r = run('OneClickSetup');
    ok('OneClickSetup: second run reuses the existing property', findP().length === 1 && S.inspected.at(-1) === ifs);
    ok('OneClickSetup: does not set a status string', S.status === '');

    // ---- ICE send (Maya): flags, saved selection, status, return value
    reset(); S.link.app = 'Maya';
    r = run('OneClickSendToMayaSendAsNewScene');
    const m = S.outbox[0];
    ok('Maya SendAsNewScene: returns nothing', !r.err && r.v === undefined, r.err);
    ok('Maya SendAsNewScene: message to "Maya", newScene 1 addToScene 0, ICE*.fbx', m?.to === 'Maya' && m.newScene === true && m.addToScene === false && /\\ICE[0-9A-F]+\.fbx$/.test(m.fbx) && /\\IT[a-z0-9]{6}$/.test(m.cacheFolder), m);
    ok('Maya send: remote window raised', J(S.raised) === J(['Maya']));
    ok('ICE send: selection remembered as text', S.savedSelection === 'cube', S.savedSelection);
    ok('ICE send: status text 0x1c6c at the end, progress bar removed', S.status === '[XSIPLUGINUI 0x1c6c]' && S.progress === null);
    ok('ICE send: cached attribute list', S.workflow.cachedAttributes === 'PointVelocity,Age,AgeLimit,Orientation,AngularVelocity,Position,Id,Color,Size,Mass');
    ok('ICE send: unknown steps log "not yet attested ... CMD-B18e"', nya(r), r.log);
    ok('ICE send: temporary ExportFBXOptions removed', !root.properties.some(p => p.name === 'ExportFBXOptions'));
    run('OneClickSendToMayaUpdateCurrentScene'); run('OneClickSendToMayaAddToCurrentScene');
    ok('Maya Update (0,0) / AddTo (0,1)', J(S.outbox.slice(1).map(x => [x.newScene, x.addToScene])) === J([[false, false], [false, true]]));
    for (const [suffix, f] of [['SendAsNewScene', [true, false]], ['UpdateCurrentScene', [false, false]], ['AddToCurrentScene', [false, true]]]) {
      reset(); S.link.app = '3ds Max'; run(`OneClickSendTo3dsMax${suffix}`);
      ok(`3ds Max ${suffix}: to "3ds Max" flags ${f}`, S.outbox[0]?.to === '3ds Max' && S.outbox[0].kind === 'DCCToICE' && J([S.outbox[0].newScene, S.outbox[0].addToScene]) === J(f), S.outbox[0]);
      reset(); S.link.app = 'Mudbox'; run(`OneClickSendToMudbox${suffix}`);
      ok(`Mudbox ${suffix}: to "Mudbox" flags ${f}, MBX*.fbx`, S.outbox[0]?.to === 'Mudbox' && S.outbox[0].kind === 'DCCToMudbox' && /\\MBX[0-9A-F]+\.fbx$/.test(S.outbox[0].fbx) && J([S.outbox[0].newScene, S.outbox[0].addToScene]) === J(f), S.outbox[0]);
    }
    // not connected: nothing sent
    reset(); r = run('OneClickSendToMayaSendAsNewScene');
    ok('not connected: nothing sent, "Connection is not initiated" logged', S.outbox.length === 0 && r.log.some(l => /Connection is not initiated, and cannot be started\./.test(l)));

    // ---- empty selection prompt
    reset(); A.select([]); S.link.app = 'Maya'; S.promptAnswer = 2;
    r = run('OneClickSendToMayaUpdateCurrentScene');
    ok('ICE empty selection + Cancel: prompt shown, nothing sent, selection unchanged', S.prompts.length === 1 && S.prompts[0].title === '[XSIPLUGINUI 0x1c69]' && S.outbox.length === 0 && A.selection.length === 0 && S.progress === null);
    S.promptAnswer = 1; S.prompts.length = 0;
    r = run('OneClickSendToMayaUpdateCurrentScene');
    ok('ICE empty selection + OK: OneClickSelectAll then send', S.outbox.length === 1 && A.selection.length > 0 && A.selection.includes(cube));
    reset(); A.select([]); S.link.app = 'Mudbox';
    r = run('OneClickSendToMudboxUpdateCurrentScene');
    ok('Mudbox empty selection + OK: whole scene (exportSelection false), selection not changed', S.outbox.length === 1 && S.workflow.exportSelection === false && A.selection.length === 0 && S.prompts.length === 1);

    // ---- select previous
    reset(); S.link.app = 'Maya';
    run('OneClickSendToMayaUpdateCurrentScene');
    for (const n of ['OneClickSelectObjects', 'OneClickSendToMayaSelectPreviousObjects', 'OneClickSendTo3dsMaxSelectPreviousObjects', 'OneClickSendToMudboxSelectPreviousObjects']) {
      A.select([]);
      r = run(n);
      ok(`${n}: restores the selection saved at the last send, returns nothing`, sel() === J(['cube']) && r.v === undefined && S.outbox.length === 1, sel());
    }
    S.savedSelection = '';
    run('OneClickSelectObjects');
    ok('select previous with an empty remembered text clears the selection', A.selection.length === 0);

    // ---- OneClickSendTo routing
    const route = (arg) => { reset(); S.link.app = 'X'; S.sendBackIceTrees = [cube]; const rr = run('OneClickSendTo', { RemoteApp: arg }); return { rr, msg: S.outbox[0] ?? null }; };
    let q = route('Mudbox');
    ok('OneClickSendTo "Mudbox" -> Mudbox UpdateCurrentScene', q.msg?.kind === 'DCCToMudbox' && q.msg.newScene === false && q.msg.addToScene === false && q.rr.v === undefined);
    q = route('3ds Max');
    ok('OneClickSendTo "3ds Max" -> SendBack (ICE->DCC, no raise)', q.msg?.kind === 'ICEToDCC' && q.msg.to === '3ds Max' && S.raised.length === 0);
    q = route('Maya');
    ok('OneClickSendTo "Maya" -> ICE UpdateCurrentScene to "Maya"', q.msg?.kind === 'DCCToICE' && q.msg.to === 'Maya' && !q.msg.newScene && !q.msg.addToScene);
    q = route('maya');
    ok('OneClickSendTo compares exactly: "maya" -> ICE update with that name', q.msg?.kind === 'DCCToICE' && q.msg.to === 'maya');
    q = route(null);
    ok('OneClickSendTo default (empty) -> ICE update with ""', q.msg?.kind === 'DCCToICE' && q.msg.to === '');

    // ---- OneClickSendToMax (SendBack)
    reset(); S.link.app = '3ds Max';
    r = run('OneClickSendToMax');
    ok('OneClickSendToMax: no ICE tree -> message box, abort, nothing sent', S.outbox.length === 0 && S.prompts[0]?.title === '[XSIPLUGINUI 0x1c55]' && r.log.some(l => /no ICE Tree to cache/.test(l)) && r.v === undefined);
    reset(); S.link.app = '3ds Max'; S.sendBackIceTrees = [cube];
    r = run('OneClickSendToMax');
    ok('OneClickSendToMax: ICE->DCC message to "3ds Max", addToScene 0', S.outbox[0]?.kind === 'ICEToDCC' && S.outbox[0].to === '3ds Max' && S.outbox[0].addToScene === false && nya(r));

    // ---- CrowdExportType / visibility
    reset(); S.link.app = 'Maya'; ifs.set('CrowdExportType', 1);
    run('OneClickSendToMayaUpdateCurrentScene');
    ok('ICE send: reads ICEFlowState.CrowdExportType', S.workflow.crowdExportType === 1);
    ifs.set('CrowdExportType', 0);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();
  return out;
}, { NAMES });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_oneclick_b18e: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
