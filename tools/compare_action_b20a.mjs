// CMD-B20a (action.dll / actioncore.dll mixer and action commands): the 28 commands of src/commands/actionB20a.ts.
// There is no XSIBATCH golden for the row: this is a contract check against section 3 of
// docs/ghidra/cmd-b20a-action-actioncore.md and items 1-14 of the CMD-B20a section of docs/re/WIRE_CORRECTIONS_B20.md,
// plus the Desktop pass3 mixer golden data/dump/si_mixer_transitions.json where it applies (AddTransition -> Mixer.Transition,
// a second AddTransition on the same pair replaces the first, AddTWTransition -> Mixer.TW1 type 2 weight 1 active, one
// transition left; AddClip names `<source>_Clip`, a second clip at the same time goes on Mixer_Anim_Track1).
//   1. every name is registered with the registry argument list (data/command_registry.json, first entry of the
//      scripting name, output-only arguments left out; defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error, except the
//      ones whose contract requires an argument (DEFAULT_FAILS, with the status the contract gives);
//   3. the contract's stated results (argument resolution, error statuses, names, mixer records, sub-tasks, undo,
//      file events, band decomposition, "not yet attested ... CMD-B20a" logs for the unread parts).
// Needs `vite preview` (SI_URL, default :4173). Usage: SI_URL=http://localhost:4181 node tools/compare_action_b20a.mjs
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
  'EqualizeAction', 'ExportAction', 'ImportRefAction', 'ImportAction', 'ReplaceShapeKey', 'SIStoreAction', 'AddTransition', 'AddMarker',
  'ReconnectMixer', 'SwapRelationMasterAndSlaveClip', 'PlotToAction', 'ApplyAction', 'GetDrivingActions', 'AddTWTransition', 'CollapseLayers',
  'PlotToActions', 'PlotFrameSetToActions', 'StoreShapeKey', 'SelectShapeKey', 'ApplyShapeKey', 'ConvertShapeReferenceMode', 'LinkDeformWithOri',
  'AddClip', 'CopyClipToTrack', 'CreateCompound', 'MoveClipToTrack', 'ExplodeCompound', 'AddClipRelation',
];
if (NAMES.length !== 28) { console.error(`expected 28 names, got ${NAMES.length}`); process.exit(2); }
// Default-argument runs that must fail, with the status (contract statement or, marked inferred, the build's rule):
const DEFAULT_FAILS = {
  EqualizeAction: 0x80004003,          // no Source (inferred: E_POINTER)
  ExportAction: 0x8000ffff,            // Action does not resolve -> 0x8000FFFF
  ImportRefAction: 0x80070057,         // no FileName: extension test fails -> 0x80070057
  ImportAction: 0x80070057,
  AddTransition: 0x80004003,           // missing From / To -> 0x80004003
  SwapRelationMasterAndSlaveClip: 0x80004003,   // null relation -> 0x80004003
  AddTWTransition: 0x80004003,         // missing clips (inferred: E_POINTER, as AddTransition)
  PlotFrameSetToActions: 0x80070057,   // FrameSet must be a SAFEARRAY -> 0x80070057
  AddClip: 0x80004003,                 // no Source (inferred: E_POINTER)
  CopyClipToTrack: 0x80004003,         // no Clip (inferred: E_POINTER)
  MoveClipToTrack: 0x80004003,
  ExplodeCompound: 0x80004003,         // Compound required -> 0x80004003
  AddClipRelation: 0x80070057,         // empty From -> 0x80070057
};
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
await page.goto(URL0.includes('?') ? URL0 : URL0.replace(/\/?$/, '/') + '?demo');
await page.waitForFunction(() => !!window.Application?.actionB20a && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.Interactive = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.kind ? `<${v.name}>` : v))?.slice(0, 600)]);
  const st = () => A.actionB20a;
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text), status: st().status[n] }; } catch (e) { return { err: String(e?.message ?? e), code: e?.status, log: A.log.slice(m).map(l => l.text), status: st().status[n] }; } };
  const nya = (r) => (r.log ?? []).some(l => /not yet attested/.test(l) && /CMD-B20a/.test(l));
  const cube = A.scene.find('cube'), sph = A.scene.find('sphere'), sph1 = A.scene.find('sphere1');
  const root = A.scene.root; const mix = () => root.property('mixer');
  const srcs = () => root.properties.filter(p => p.type === 'actionsource');
  const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected). The demo curves are kept aside: the earlier CollapseLayers body (kept behind the
  // registry argument list) stores every animated parameter through StoreAction and removes its animation.
  const undo0 = A.undoStack.length;
  const keep = [...A.anim.fcurves].map(([p, fc]) => [p, fc, fc.keys.map(k => ({ ...k }))]);
  for (const n of NAMES) {
    A.select([cube]);
    const r = run(n);
    const want = DEFAULT_FAILS[n];
    out.defaults[n] = want ? (r.code === want ? 'ok' : `expected 0x${want.toString(16)}, got ${r.err ?? 'no error'} ${r.code?.toString(16) ?? ''}`) : (r.err ? r.err : 'ok');
  }
  while (A.undoStack.length > undo0) A.undo();
  for (const [p, fc, keys] of keep) { fc.keys = keys; A.anim.fcurves.set(p, fc); }
  for (const p of [...root.properties]) if (p.type === 'actionsource') root.removeProperty(p);
  A.select([]);

  try {
    // ================= SIStoreAction (item 5): Mode -> class mask, Type, default Name
    let r = run('SIStoreAction', { InputObj: [sph], Mode: 2, RemoveAnim: false });
    const s2 = r.v;
    const fc2 = s2 ? JSON.parse(s2.val('fcurves')) : {}, v2 = s2 ? JSON.parse(s2.val('data')) : {};
    ok('SIStoreAction Mode 2 -> mask 2: fcurves only, kind 1 (on the model), Name StoredAction', s2 && s2.name === 'StoredAction' && Object.keys(fc2).length === 9 && !Object.keys(v2).length && root.properties.includes(s2) && s2.storageKind === 1, [r, Object.keys(fc2), v2]);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 1, RemoveAnim: false });
    const v1 = r.v ? JSON.parse(r.v.val('data')) : {};
    ok('SIStoreAction Mode 1 -> mask 1: static values only, unique default name', r.v && r.v.name === 'StoredAction1' && Object.keys(v1).length >= 9 && r.v.val('fcurves') === '{}', [r, v1]);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 0, RemoveAnim: false });
    ok('SIStoreAction Mode 0 -> mask 0: nothing stored (S_FALSE)', !r.err && r.v === null && r.status === 1, r);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 2, Type: 'ReturnOnly' });
    ok('SIStoreAction Type ReturnOnly: query mode (GetStoreActionDefaults), no source', !r.err && r.v && typeof r.v.Size === 'number' && r.v.Size === 9 && srcs().length === 2, [r, srcs().length]);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 2, Type: 'UnownedAction', RemoveAnim: false, Name: 'Unowned' });
    ok('SIStoreAction Type UnownedAction: storage kind 0, not added to the model', r.v && r.v.storageKind === 0 && !root.properties.includes(r.v) && nya(r), r);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 2, Type: 'TransientAction', RemoveAnim: false, Name: 'Trans' });
    ok('SIStoreAction Type TransientAction: storage kind 2', r.v && r.v.storageKind === 2 && r.v.transient === true, r);
    r = run('SIStoreAction', { InputObj: [sph], Mode: 6, Name: 'Removed' });
    ok('SIStoreAction RemoveAnim (default true): the stored fcurves leave the parameters; undo restores them', r.v && !A.anim.fcurve(sph.kinematics.local.get('posx'))?.keys.length && nya(r), r);
    A.undo();
    ok('SIStoreAction undo: fcurves back, source gone', A.anim.fcurve(sph.kinematics.local.get('posx'))?.keys.length > 0 && !root.properties.some(p => p.name === 'Removed'));
    r = run('SIStoreAction', { InputObj: [sph], Mode: 2, RemoveAnim: false, 'Consider Time': true, StartFrame: 1, EndFrame: 1, Name: 'Ranged' });
    ok('SIStoreAction Consider Time: only keys inside StartFrame..EndFrame', r.v && Object.values(JSON.parse(r.v.val('fcurves'))).every(k => k.every(x => x.time >= 1 && x.time <= 1)), r.v && r.v.val('fcurves'));

    // ================= PlotToAction / PlotToActions / PlotFrameSetToActions
    r = run('PlotToAction', { InputObj: [sph], Name: 'Plotted', StartFrame: 1, EndFrame: 32 });
    const plotted = r.v; const pf = plotted ? JSON.parse(plotted.val('fcurves')) : {};
    ok('PlotToAction: one source, 32 samples per item, start / end set', plotted && Object.values(pf).length >= 9 && Object.values(pf).every(k => k.length === 32) && plotted.frameStart === 1 && plotted.frameEnd === 32 && nya(r), [r, Object.values(pf).map(k => k.length)]);
    r = run('PlotFrameSetToActions', { InputObj: [sph], Name: 'FS', FrameSet: [1, 5, 9] });
    ok('PlotFrameSetToActions Type 1: FrameSet array -> keys at those frames, list result', Array.isArray(r.v) && r.v.length === 1 && Object.values(JSON.parse(r.v[0].val('fcurves'))).every(k => k.map(x => x.time).join() === '1,5,9'), r);
    r = run('PlotFrameSetToActions', { InputObj: [sph], FrameSet: 7 });
    ok('PlotFrameSetToActions: FrameSet not an array -> E_INVALIDARG', r.code === 0x80070057, r);
    r = run('PlotToActions', { InputObj: [sph, cube], StartFrame: 1, EndFrame: 3 });
    ok('PlotToActions: list of sources (one per model)', Array.isArray(r.v) && r.v.length === 1, r);

    // ================= EqualizeAction (item 1)
    r = run('EqualizeAction', { Source: plotted, Time: 10, Name: 'EQ' });
    const cpd = r.v;
    const bands = root.properties.filter(p => /^EQ_Band_\d+$/.test(p.name));
    ok('EqualizeAction: B = floor(log2 32) = 5 sources EQ_Band_0..4', bands.length === 5 && bands.map(b => b.name).join() === 'EQ_Band_0,EQ_Band_1,EQ_Band_2,EQ_Band_3,EQ_Band_4', bands.map(b => b.name));
    ok('EqualizeAction: returns the compound clip EQ_Equalizer_Clip at Time with one clip per band', cpd && cpd.clip && cpd.clip.name === 'EQ_Equalizer_Clip' && cpd.clip.start === 10 && (cpd.clip.clips ?? []).length === 5, cpd && cpd.clip);
    ok('EqualizeAction: track EQ_Equalizer_Track; sub-tasks AddTrack, CreateCompound, 5 x AddClip', (mix().trackRows ?? []).some(t => t.name === 'EQ_Equalizer_Track') && ['AddTrack', 'CreateCompound', 'AddClip'].every(t => st().subtasks.some(s => s.command === 'EqualizeAction' && s.task === t)) && st().subtasks.filter(s => s.command === 'EqualizeAction' && s.task === 'AddClip').length === 5, [mix().trackRows, st().subtasks.filter(s => s.command === 'EqualizeAction')]);
    {
      const item = Object.keys(pf).find(k => /posx$/.test(k));
      const sum = pf[item].map((_, j) => bands.reduce((s, b) => s + JSON.parse(b.val('fcurves'))[item][j].value, 0));
      ok('EqualizeAction: the bands add up to the original samples (1e-9)', sum.every((v, j) => near(v, pf[item][j].value, 1e-9)), [sum.slice(0, 4), pf[item].slice(0, 4).map(k => k.value)]);
      ok('EqualizeAction: band keys keep the original key times', bands.every(b => JSON.parse(b.val('fcurves'))[item].map(k => k.time).join() === pf[item].map(k => k.time).join()));
    }
    const api = A.actionB20aApi;
    {
      const x = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
      const lp = api.bandLowPass(x, 1), lp2 = api.bandLowPass(x, 2);
      ok('band filter: kernel [1/16, 1/4, 3/8, 1/4, 1/16] at tap spacing 1', [lp[3], lp[4], lp[5], lp[6], lp[7]].map(v => v * 16).join() === '1,4,6,4,1', lp);
      ok('band filter: tap spacing 2^level (level 1 -> spacing 2)', near(lp2[5], 3 / 8) && near(lp2[3], 1 / 4) && near(lp2[1], 1 / 16) && lp2[4] === 0, lp2);
      const edge = api.bandLowPass([1, 0, 0, 0, 0], 1);
      ok('band filter: taps outside the range fold onto the edge sample (inferred)', near(edge[0], 1 / 16 + 1 / 4 + 3 / 8), edge);
      const b16 = api.equalizerBands(Array.from({ length: 16 }, (_, i) => Math.sin(i)));
      ok('band decomposition: N = 16 -> 4 bands, the band at N <= 4 * 2^level takes the low-pass rest, later bands zero', b16.length === 4 && b16[3].every(v => v === 0) && b16[2].some(v => v !== 0), b16.map(b => b.slice(0, 2)));
    }
    r = run('EqualizeAction', { Source: srcs().find(p => p.name === 'StoredAction1') });
    ok('EqualizeAction: static items -> E_INVALIDARG "All items must be fcurves (use plot)."', r.code === 0x80070057 && r.log.some(l => /All items must be fcurves \(use plot\)\./.test(l) && /0x3eb/.test(l)), r);
    r = run('EqualizeAction', { Source: srcs().find(p => p.name === 'Ranged') });
    const rangedN = Object.values(JSON.parse(srcs().find(p => p.name === 'Ranged').val('fcurves'))).map(k => k.length);
    ok('EqualizeAction: one key per item -> "All fcurve items must be equally sampled (use plot)." (inferred: B >= 1)', r.code === 0x80070057 && r.log.some(l => /equally sampled/.test(l)), [r, rangedN]);
    r = run('EqualizeAction', { Source: plotted, Time: 1, Duration: 16, Name: 'EQD' });
    ok('EqualizeAction Duration > 0: the compound clip is fitted to Duration (inferred scale)', r.v && r.v.clip.duration === 16 && near(r.v.clip.timectrl?.scale, 32 / 16), r.v && r.v.clip);
    { const u = A.undoStack.length; A.undo(); ok('EqualizeAction undo: bands, compound and clips removed', !root.properties.some(p => /^EQD_Band/.test(p.name)) && !mix().compounds.some(c => c.name === 'EQD_Equalizer_Clip') && A.undoStack.length === u - 1); }
    r = run('EqualizeAction', { Source: cpd });
    ok('EqualizeAction: a clip without source (compound) -> 0x8000FFFF', r.code === 0x8000ffff, r);

    // ================= AddClip (golden naming, room test)
    const sA = srcs().find(p => p.name === 'StoredAction'); sA.frameStart = 1; sA.frameEnd = 30;
    r = run('AddClip', { Source: sA, Time: 100 });
    const cA = r.v;
    ok('AddClip: default name <source>_Clip, span (end - start) + 1, returns the clip (Mixer.Mixer_Anim_Track.StoredAction_Clip)', cA && cA.clip.name === 'StoredAction_Clip' && cA.clip.duration === 30 && cA.fullName === 'Mixer.Mixer_Anim_Track.StoredAction_Clip', [cA && cA.fullName, cA && cA.clip]);
    r = run('AddClip', { Source: sA.name, Time: 100 });
    const cB = r.v;
    ok('AddClip: a second clip at the same time goes on Mixer_Anim_Track1 (Desktop golden)', cB && cB.fullName === 'Mixer.Mixer_Anim_Track1.StoredAction_Clip1', cB && cB.fullName);
    r = run('AddClip', { Source: sA, Time: 110, Track: 0 });
    ok('AddClip: no room on the given track -> XSIACTIONCORE 0x18 logged, E_FAIL', r.code === 0x80004005 && r.log.some(l => /XSIACTIONCORE message 0x18/.test(l)), r);
    r = run('AddClip', { Source: sA, Time: 130, Track: 'Mixer_Anim_Track' });
    ok('AddClip: track by name, room after the first clip', r.v && r.v.clip.track === 0 && r.v.clip.start === 130, r);
    const cC = r.v;

    // ================= AddTransition (item 6)
    r = run('AddTransition', { From: cA, To: null });
    ok('AddTransition: missing To -> 0x80004003', r.code === 0x80004003, r);
    r = run('AddTransition', { From: cA, To: cA });
    ok('AddTransition: From == To -> 0x80004005', r.code === 0x80004005, r);
    cB.clip.lockLevel = 1; r = run('AddTransition', { From: cA, To: cB }); cB.clip.lockLevel = 0;
    ok('AddTransition: locked clip -> 0x80070005', r.code === 0x80070005, r);
    r = run('AddTransition', { From: cA, To: cB });
    const t1 = r.v;
    ok('AddTransition: Mixer.Transition (default name), type 0 standard, track indices, common items', t1 && t1.name === 'Transition' && t1.type === 0 && t1.kind === 'standard' && t1.fromTrack === 0 && t1.toTrack === 1 && t1.items.length === 9 && mix().transitions.length === 1, t1);
    r = run('AddTransition', { From: cA.fullName, To: cB.fullName, Type: 5 });
    ok('AddTransition again on the pair: the earlier one is deleted (DeleteObj), one transition left (golden); Type > 2 -> 0', r.v && r.v.type === 0 && mix().transitions.length === 1 && mix().transitions[0] === r.v && st().subtasks.some(s => s.command === 'AddTransition' && s.task === 'DeleteObj'), mix().transitions);
    r = run('AddTransition', { From: [cB], To: [cC], Type: 1, Name: 'Card' });
    ok('AddTransition Type 1: cardinal, flag 2, Name set', r.v && r.v.type === 1 && r.v.cardinalFlag === 2 && r.v.name === 'Card' && mix().transitions.length === 2, r.v);
    r = run('AddTransition', { From: cB, To: cC, Type: 2, Name: 'TRANSITION' });
    ok('AddTransition: Name equal to "Transition" (case-insensitive) keeps the default naming; Type 2', r.v && r.v.type === 2 && /^Transition\d*$/.test(r.v.name), r.v);
    const inCpd = run('CreateCompound', { InputObj: [cC], Name: 'Box' });
    r = run('AddTransition', { From: cA, To: cC });
    ok('AddTransition: clips in different containers -> nothing created (S_FALSE)', !r.err && r.v === null && r.status === 1, r);
    A.undo(); A.undo();   // the refused transition's deletions, the compound

    // ================= AddTWTransition (item 7)
    r = run('AddTWTransition', { From: cA, To: cB, 'From Period': 99 });
    ok('AddTWTransition: a period longer than the clip -> E_INVALIDARG (0x3eb)', r.code === 0x80070057 && r.log.some(l => /0x3eb/.test(l)), r);
    r = run('AddTWTransition', { From: cA, To: cC });
    ok('AddTWTransition: clips that do not overlap -> "Clips must overlap properly."', r.code === 0x80070057 && r.log.some(l => /Clips must overlap properly\./.test(l)), r);
    cB.clip.timectrl = { ...(cB.clip.timectrl ?? {}), extrapaft_type: 1 };
    r = run('AddTWTransition', { From: cA, To: cB });
    ok('AddTWTransition: hold extrapolation -> "Extrapolations have to be either nothing or cycles."', r.code === 0x80070057 && r.log.some(l => /Extrapolations have to be either nothing or cycles\./.test(l)), r);
    cB.clip.timectrl.extrapaft_type = 0;
    const nBefore = mix().transitions.length;
    r = run('AddTWTransition', { From: cA, To: cB });
    ok('AddTWTransition: Mixer.TW1, type 2, weight 1, active, replaces the pair\'s transition (golden), AddTransition sub-task type 2', r.v && r.v.name === 'TW1' && r.v.type === 2 && r.v.weight === 1 && r.v.active === true && mix().transitions.filter(t => t.from === cA.clip.name).length === 1 && st().subtasks.some(s => s.command === 'AddTWTransition' && s.task === 'AddTransition' && s.args.Type === 2) && r.v.warpCurve?.name === 'Time Warp Transition Curve' && nya(r), [r.v, nBefore, mix().transitions.map(t => t.name)]);
    r = run('AddTWTransition', { From: cA, To: cB, Name: null });
    ok('AddTWTransition: null Name -> BridgeTransition', r.v && r.v.name === 'BridgeTransition', r.v);
    r = run('AddTWTransition', { From: cA, To: cB, Name: 'MyTW' });
    ok('AddTWTransition: a given Name is used', r.v && r.v.name === 'MyTW', r.v);

    // ================= AddMarker (item 8)
    r = run('AddMarker', { Time: 5 });
    ok('AddMarker: no Model -> nothing done', !r.err && r.v === null && !(api.markersOf(mix())).length, r);
    r = run('AddMarker', { Model: root, Time: 12, Duration: 4 });
    const mk = r.v;
    ok('AddMarker: marker in the model mixer, name "Marker", time / duration parameters', mk && mk.name === 'Marker' && mk.val('Name') === 'Marker' && mk.val('time') === 12 && mk.val('duration') === 4 && api.markersOf(mix()).includes(mk) && /Marker/.test(mix().val('markers')), mk && [mk.name, mk.val('time')]);
    const box = run('CreateCompound', { InputObj: [cC], Name: 'Box2' }).v;
    r = run('AddMarker', { Model: root, Container: box, Time: 3, Name: 'Beat' });
    ok('AddMarker: Container (compound) receives the marker', r.v && r.v.name === 'Beat' && api.markersOf(box.clip).includes(r.v), r);
    box.clip.lockLevel = 1; r = run('AddMarker', { Model: root, Container: box, Time: 3 }); box.clip.lockLevel = 0;
    ok('AddMarker: locked container -> 0x80070005', r.code === 0x80070005, r);
    A.undo();
    ok('AddMarker undo removes the marker', !api.markersOf(box.clip).length);
    A.undo();

    // ================= AddClipRelation / SwapRelationMasterAndSlaveClip (items 10, 11)
    r = run('AddClipRelation', { From: [cA, cB] });
    const rel = r.v;
    ok('AddClipRelation: two-item From -> master, slave; Name Relation', rel && rel.master === cA.clip.name && rel.slave === cB.clip.name && rel.name === 'Relation', rel);
    r = run('AddClipRelation', { From: [cB], To: [cA] });
    ok('AddClipRelation: a relation already on the pair -> XSIACTIONCORE 0x16 logged, E_FAIL', r.code === 0x80004005 && r.log.some(l => /XSIACTIONCORE message 0x16/.test(l)), r);
    r = run('AddClipRelation', { From: [cB], To: cC, Name: 'R2' });
    const rel2 = r.v;
    ok('AddClipRelation: one-item From + To', rel2 && rel2.master === cB.clip.name && rel2.slave === cC.clip.name && rel2.name === 'R2', rel2);
    r = run('AddClipRelation', { From: [cB, sA] });
    ok('AddClipRelation: a non-clip -> E_INVALIDARG', r.code === 0x80070057, r);
    r = run('SwapRelationMasterAndSlaveClip', { Relation: rel });
    ok('SwapRelationMasterAndSlaveClip: only the given relation is swapped', rel.master === cB.clip.name && rel.slave === cA.clip.name && rel2.master === cB.clip.name && rel2.slave === cC.clip.name, [rel, rel2]);
    A.undo();
    ok('SwapRelationMasterAndSlaveClip undo swaps again', rel.master === cA.clip.name);
    A.redo();
    ok('SwapRelationMasterAndSlaveClip redo swaps again', rel.master === cB.clip.name);
    r = run('SwapRelationMasterAndSlaveClip', { Relation: 'Mixer.R2' });
    ok('SwapRelationMasterAndSlaveClip: relation by name', rel2.master === cC.clip.name, rel2);

    // ================= MoveClipToTrack / CopyClipToTrack (item 12)
    r = run('MoveClipToTrack', { Clip: cC });
    ok('MoveClipToTrack: Track required (inferred E_POINTER)', r.code === 0x80004003, r);
    r = run('MoveClipToTrack', { Clip: cC, Track: 1, Time: 105 });
    ok('MoveClipToTrack: no room -> XSIACTIONCORE 0x19 logged, E_FAIL', r.code === 0x80004005 && r.log.some(l => /XSIACTIONCORE message 0x19/.test(l)), r);
    r = run('MoveClipToTrack', { Clip: cC, Track: 'Mixer_Anim_Track2', Time: 200 });
    ok('MoveClipToTrack: moved to track 2 at frame 200', !r.err && cC.clip.track === 2 && cC.clip.start === 200, [r, cC.clip]);
    r = run('CopyClipToTrack', { Clip: cA, Track: 1, Time: 101 });
    ok('CopyClipToTrack: no room -> XSIACTIONCORE 0x1a logged, E_FAIL', r.code === 0x80004005 && r.log.some(l => /XSIACTIONCORE message 0x1a/.test(l)), r);
    r = run('CopyClipToTrack', { Clip: cA, Track: 2, Time: 300 });
    ok('CopyClipToTrack: returns the copy on the track, the original stays', r.v && r.v.clip !== cA.clip && r.v.clip.track === 2 && r.v.clip.start === 300 && cA.clip.track === 0 && r.v.clip.source === cA.clip.source, r.v && r.v.clip);

    // ================= CreateCompound / ExplodeCompound (item 13)
    r = run('CreateCompound', { InputObj: [cA, cB], Name: 'Pair' });
    const pair = r.v;
    ok('CreateCompound: Model / InputObj / Name -> compound clip with the clips, at their earliest time', pair && pair.clip.name === 'Pair' && pair.clip.clips.join() === [cA.clip.name, cB.clip.name].join() && pair.clip.start === 100, pair && pair.clip);
    r = run('ExplodeCompound', { Compound: pair });
    ok('ExplodeCompound: Model / Compound -> the compound is removed, the clips stay', !r.err && !mix().compounds.includes(pair.clip) && mix().clips.includes(cA.clip), r);
    A.undo();
    ok('ExplodeCompound undo brings the compound back', mix().compounds.includes(pair.clip));

    // ================= ReconnectMixer (item 9)
    const u0 = A.undoStack.length;
    r = run('ReconnectMixer', { Model: root });
    ok('ReconnectMixer: model mixer reconnected, not undoable', !r.err && A.undoStack.length === u0 && nya(r), [r, A.undoStack.length, u0]);
    r = run('ReconnectMixer', { Model: mix() });
    ok('ReconnectMixer: a mixer given directly', !r.err, r);
    A.select([]); const mdl = A.run('CreateModel', {}) ?? null;
    const bare = mdl && mdl.kind ? mdl : [...A.scene.allObjects()].find(o => o.constructor === root.constructor && o !== root && !o.property('mixer'));
    if (bare) { const mx = bare.property('mixer'); if (mx) bare.removeProperty(mx); r = run('ReconnectMixer', { Model: bare }); ok('ReconnectMixer: model without mixer -> 0x80004003 (no mixer created)', r.code === 0x80004003 && !bare.property('mixer'), r); }
    else ok('ReconnectMixer: model without mixer (a model could be created)', false, mdl);

    // ================= GetDrivingActions
    const sSph = srcs().find(p => p.name === 'StoredAction');
    r = run('GetDrivingActions', { InputObjs: [sph] });
    ok('GetDrivingActions: the sources of the clips of the model that hold the object\'s items', Array.isArray(r.v) && r.v.includes(sSph), r.v && r.v.map(s => s.name));
    r = run('GetDrivingActions', { InputObjs: [sph], 'Consider Time': true, Time: 50 });
    ok('GetDrivingActions Consider Time: no clip at frame 50', Array.isArray(r.v) && r.v.length === 0, r.v);
    for (const c of mix().clips) c.mute = true;
    r = run('GetDrivingActions', { InputObjs: [sph] }); const r2 = run('GetDrivingActions', { InputObjs: [sph], 'Keep Inactive Actions': true });
    ok('GetDrivingActions: inactive clips only with Keep Inactive Actions', r.v.length === 0 && r2.v.includes(sSph), [r.v, r2.v]);
    for (const c of mix().clips) c.mute = false;

    // ================= ApplyAction
    const px = sph.kinematics.local.get('posx'); const before = A.anim.fcurve(px).keys.map(k => k.value).join();
    A.anim.removeAnimation(px);
    r = run('ApplyAction', { Source: sSph, Target: sph, 'Consider Time': true });
    ok('ApplyAction: registry arguments; the source curves are put back; Target / Consider Time logged as not yet attested', !r.err && A.anim.fcurve(px)?.keys.map(k => k.value).join() === before && nya(r), r);

    // ================= ExportAction (item 2)
    const ev0 = st().fileEvents.length;
    r = run('ExportAction', { Action: sSph, FileName: 'C:\\temp\\walk.txt' });
    ok('ExportAction: other extension -> E_FAIL, nothing written', r.code === 0x80004005 && !st().files['C:\\temp\\walk.txt'] && st().fileEvents.length === ev0, r);
    r = run('ExportAction', { Action: sSph, FileName: 'C:\\temp\\walk.EANI' });
    ok('ExportAction: the extension test is case-sensitive (.EANI -> E_FAIL)', r.code === 0x80004005, r);
    const u1 = A.undoStack.length;
    r = run('ExportAction', { Action: cA, FileName: 'C:\\temp\\walk.eani' });
    const evs = st().fileEvents.slice(ev0);
    ok('ExportAction: a clip resolves to its source; events 0x20510013 then 0x20510014 (type 10); S_FALSE; file written; not undoable', !r.err && r.v === 1 && r.status === 1 && evs.map(e => e.id).join() === [0x20510013, 0x20510014].join() && evs.every(e => e.type === 10 && e.source === sSph.name && e.file === 'C:\\temp\\walk.eani') && !!st().files['C:\\temp\\walk.eani'] && A.undoStack.length === u1, [r, evs]);
    st().fileEventHandlers.push(() => 1);
    r = run('ExportAction', { Action: sSph, FileName: 'C:\\temp\\skip.xsi' });
    st().fileEventHandlers.length = 0;
    ok('ExportAction: a handler returning 1 skips the export, 1 returned', r.v === 1 && !st().files['C:\\temp\\skip.xsi'], r);
    st().restrictedMode = true; r = run('ExportAction', { Action: sSph, FileName: 'C:\\temp\\x.xsi' }); st().restrictedMode = false;
    ok('ExportAction: restricted application mode -> 0x80004021 (simsgcat 0x143)', r.code === 0x80004021 && r.log.some(l => /0x143/.test(l)), r);
    r = run('ExportAction', { Action: cube, FileName: 'C:\\temp\\x.xsi' });
    ok('ExportAction: an object without a source -> 0x8000FFFF', r.code === 0x8000ffff, r);

    // ================= ImportAction / ImportRefAction (item 3)
    r = run('ImportAction', { Model: root, FileName: 'C:\\temp\\walk.txt' });
    ok('ImportAction: extension other than .Preset / .xsi / .eani -> 0x80070057', r.code === 0x80070057, r);
    const ev11 = A.actionB11e.fileEvents.length;
    r = run('ImportAction', { Model: root, FileName: 'C:\\temp\\walk.eani' });
    const imp = r.v;
    ok('ImportAction: ActionStorage 0 -> storage 0, file path cleared; name = file base name; .eani events 0x20510015 / 0x20510016', imp && imp.name === 'walk' && imp.val('storage') === 0 && imp.val('filename') === '' && A.actionB11e.fileEvents.slice(ev11).map(e => e.id).join() === [0x20510015, 0x20510016].join(), [imp && imp.name, imp && imp.val('storage'), A.actionB11e.fileEvents.slice(ev11)]);
    ok('ImportAction: a file written by ExportAction in this session is read back (this build\'s JSON form)', imp && imp.val('fcurves') === sSph.val('fcurves'), imp && imp.val('fcurves')?.slice(0, 80));
    r = run('ImportRefAction', { Model: root, FileName: 'C:\\temp\\walk.eani', Name: 'RefWalk' });
    ok('ImportRefAction: ActionStorage -1 -> storage and file path kept (a reference to the file)', r.v && r.v.name === 'RefWalk' && r.v.val('storage') === 1 && r.v.val('filename') === 'C:\\temp\\walk.eani', r.v && [r.v.val('storage'), r.v.val('filename')]);
    r = run('ImportAction', { Model: root, FileName: 'D:\\x\\pose.PRESET' });
    ok('ImportAction: the extension test is case-insensitive (.PRESET accepted)', !r.err && r.v, r);

    // ================= StoreShapeKey / ReplaceShapeKey / ConvertShapeReferenceMode / ApplyShapeKey / SelectShapeKey (item 4)
    r = run('StoreShapeKey', { InputObj: [cube], Name: 'K1' });
    const k1 = r.v;
    ok('StoreShapeKey: registry arguments, RefMode default siShapeObjectReferenceMode -> refmode 2', k1 && k1.name === 'K1' && k1.val('refmode') === 2 && nya(r), r);
    const k0 = A.ExecuteCommand('StoreShapeKey', [cube, 'K0', ':siShapeLocalReferenceMode:siShapeReferenceMode']);
    ok('StoreShapeKey positional: InputObj, Name, RefMode (local -> 0)', k0 && k0.name === 'K0' && k0.val('refmode') === 0, k0 && k0.val('refmode'));
    const prim = cube.primitive; const lenP = prim.operators[0].get('length') ?? prim.get?.('length');
    const oldData = k1.val('data');
    if (lenP) lenP.value = Number(lenP.value) * 2; prim.dirty = true;
    const want = JSON.stringify(Array.from(prim.mesh().positions));
    r = run('ReplaceShapeKey', { InputObj: k1 });
    ok('ReplaceShapeKey: the key takes the current point positions', !r.err && k1.val('data') === want && want !== oldData, [r, !!lenP]);
    A.undo();
    ok('ReplaceShapeKey undo: the old key values are back', k1.val('data') === oldData);
    if (lenP) lenP.value = Number(lenP.value) / 2; prim.dirty = true;
    r = run('ReplaceShapeKey', { InputObj: k1, ForceDeformStripping: true });
    ok('ReplaceShapeKey ForceDeformStripping: a StripDeformOperators sub-task runs on the primitive', !r.err && st().subtasks.some(s => s.command === 'ReplaceShapeKey' && s.task === 'StripDeformOperators'), r);
    k1.lockLevel = 1; r = run('ReplaceShapeKey', { InputObj: k1 }); k1.lockLevel = 0;
    ok('ReplaceShapeKey: locked key -> 0x80070005', r.code === 0x80070005, r);
    const pts = k1.get('points'); const pv = pts.value; pts.value = pv + 1; r = run('ReplaceShapeKey', { InputObj: k1 }); pts.value = pv;
    ok('ReplaceShapeKey: element count differs -> 0x80004005, message 0x65', r.code === 0x80004005 && r.log.some(l => /0x65/.test(l)), r);
    k1.set('refmode', 3); r = run('ReplaceShapeKey', { InputObj: k1 }); k1.set('refmode', 2);
    ok('ReplaceShapeKey: reference mode must be < 3', r.code === 0x80070057, r);
    r = run('ReplaceShapeKey', { InputObj: sph });
    ok('ReplaceShapeKey: no shape key found -> S_FALSE, no change', !r.err && r.status === 1 && r.v === undefined, r);
    r = run('ReplaceShapeKey', { InputObj: cube });
    ok('ReplaceShapeKey: a 3D object gives its combiner\'s first key', !r.err && r.v === cube.properties.find(p => p.type === 'shapekey'), r);
    r = run('ConvertShapeReferenceMode', { InputObj: [k1], RefMode: ':siShapeAbsoluteReferenceMode:siShapeReferenceMode' });
    ok('ConvertShapeReferenceMode: RefMode only (absolute -> 1)', !r.err && k1.val('refmode') === 1 && nya(r), r);
    A.undo(); ok('ConvertShapeReferenceMode undo', k1.val('refmode') === 2);
    k1.set('weight', 0);
    r = run('ApplyShapeKey', { InputObj: k1 });
    ok('ApplyShapeKey: registry arguments; the key weight is 1; the clip part is not yet attested', !r.err && k1.val('weight') === 1 && nya(r), r);
    r = run('SelectShapeKey', { InputObj: [sph], SourceObj: sph1, ApplyKeys: true });
    const sk = r.v;
    ok('SelectShapeKey: the source object\'s shape stored as a key of the target', sk && sk.type === 'shapekey' && sph.properties.includes(sk) && sk.val('data') === JSON.stringify(Array.from(sph1.primitive.mesh().positions)) && sk.val('refmode') === 0, r);

    // ================= CollapseLayers / LinkDeformWithOri
    r = run('CollapseLayers', { Model: root, PlottingType: 0 });
    ok('CollapseLayers: PlottingType is not read (1 used)', !r.err && r.log.some(l => /PlottingType 0 is not read/.test(l)), r);
    r = run('LinkDeformWithOri', { Cluster: null, LinkWithOri: true });
    ok('LinkDeformWithOri: registry arguments, LinkDeform run with them', !r.err && A.tasksB19b?.out?.LinkDeform?.LinkWithOri === true || (!r.err && nya(r)), [r, A.tasksB19b?.out?.LinkDeform]);
  } catch (e) { ok('contract block threw', false, String(e?.stack ?? e).slice(0, 600)); }
  return out;
}, { NAMES, DEFAULT_FAILS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_action_b20a: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
