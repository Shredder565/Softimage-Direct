// CMD-B20c: the analyst's answers to the wire PR #201 questions (B19a rendercore.dll region / pass commands, B19d
// selectionmgr.dll selection / tool commands and the mcp.dll transport, the default key map bindings).
// There is no XSIBATCH golden: this is a contract check against docs/ghidra/cmd-b20c-pr201-answers.md and items 1-16
// of the CMD-B20c section of docs/re/WIRE_CORRECTIONS_B20.md, on every command those items touch:
//   1. registration: argument names / order / defaults of the first registry entry of the scripting name
//      (data/command_registry.json, output-only arguments left out) and the label of that entry;
//   2. every command runs with its default arguments on the ?demo scene (RemoveRenderChannel with Name "" fails with
//      E_INVALIDARG by contract);
//   3. the stated results of items 1-16 and the "not yet attested ... (CMD-B20c)" logs of the parts still open.
// Needs `vite preview` (SI_URL, default :4173). Usage: SI_URL=http://localhost:4183/ node tools/compare_pr201_b20c.mjs
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

// commands whose registration is compared with the registry (first entry of the scripting name)
const REG_NAMES = [
  'RenderRegionToggleVisibility', 'RenderRegionRefresh', 'RenderRegionToggleSelectionTracking',
  'ActivateObjectSelTool', 'NextFrame', 'FirstFrame', 'LastFrame', 'PlayForwards', 'PlayForwardsFromStart', 'PlayRealTime',
];
// every command the items touch (default runs)
const NAMES = [
  ...REG_NAMES, 'RenderRegionToggleAutoRefresh', 'RenderRegionSetRefreshMode', 'RenderRegionSetDisplayType', 'RenderRegionGetRefreshMode',
  'RenderRegionGetDisplayType', 'RenderPassesFrameSet', 'ExportRenderArchiveFrameSet', 'SICreatePass', 'SICreateEmptyPartition', 'RemoveRenderChannel',
  'SetAndToggleSelection', 'ActivateVertexSelTool', 'ActivateEdgeSelTool', 'ActivatePolygonSelTool', 'ActivateRaycastPolySelTool', 'ActivateRaycastEdgeSelTool',
  'ActivateTipSelTool', 'ActivateSelectTool', 'ActivateObjectSelToolWithNoObjStateChange',
];
const DEFAULT_FAILS = { RemoveRenderChannel: 0x80070057 };
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(REG_NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n); if (!c) return [n, null];
  return [n, { label: c.name, args: c.args.filter(a => !(a.flags & 0x200) && !(a.flags === 4 && a.name === 'Value')).map(a => [a.name, a.default ?? null]) }];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.selB19dApi && !!window.Application?.renderB19a && !!window.Application?.scene?.find('cube') && !!window.__vm && !!window.__keyAction, null, { timeout: 60000 });
await page.waitForTimeout(800);

const got = await page.evaluate(({ NAMES, REG_NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false; A.userPrefs ??= {};
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const J = JSON.stringify;
  const run = (n, a = {}) => {
    const m = A.log.length;
    try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), cmds: L.filter(l => l.kind === 'cmd').map(l => l.text), status: A.selB19d?.status?.[n] ?? A.renderB19a?.status?.[n] }; }
    catch (e) { return { err: String(e?.message ?? e), code: e?.status, log: A.log.slice(m).map(l => l.text), status: A.selB19d?.status?.[n] }; }
  };
  const key = (name) => { const m = A.log.length; window.__keyAction(name); const L = A.log.slice(m); return { cmds: L.filter(l => l.kind === 'cmd').map(l => l.text), log: L.filter(l => l.kind !== 'cmd').map(l => l.text) }; };
  const nya20 = (r) => (r.log ?? []).some(l => /not yet attested/.test(l) && /CMD-B20c/.test(l));
  const nyaAny = (r) => (r.log ?? []).some(l => /not yet attested/.test(l));
  const S = A.renderB19a; const SD = () => A.selB19d;
  const prefs = window.__prefSets.get('C3DPrefsRendering');
  const pref = (n) => prefs.val(n); const setPref = (n, v) => { prefs.get(n).value = v; };
  const cube = A.scene.find('cube'), sph = A.scene.find('sphere');
  const ro = A.scene.renderOptions;
  ro.set('FrameRangeSource', 0); ro.set('FrameStart', 1); ro.set('FrameEnd', 2); ro.set('FrameStep', 1);
  const vm = window.__vm; const tm = A.toolManager;
  const SELECT = '11778840-8c5c-11d1-84b5-00aa00135f7b', COMP = 'e9cdd760-d183-11d2-8bcf-00aa006130ef';
  const an = A.anim;
  const reset = () => {
    an.stop(); S.regions.clear(); S.underMouse = null; S.abortNext = false; vm.setActive(1);
    A.select([cube]); A.compSel = null; A.activeElements = []; A.selFilter = 'Object'; A.selMode = 'object';
    if (A.selB19d) { A.selB19d.tags = []; A.selB19d.subTasks = []; A.selB19d.doNotRecord = []; }
  };

  // 1. registration
  for (const n of REG_NAMES) { const d = A.commands.get(n); out.reg[n] = d ? { label: d.label, args: d.args.map(a => [a.name, a.default ?? null]) } : null; }
  // 2. default runs
  const passes0 = A.scene.passes.map(p => p.name);
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const f0 = an.frame;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    an.stop(); an.frame = f0;
    out.defaults[n] = DEFAULT_FAILS[n] !== undefined ? (r.code === DEFAULT_FAILS[n] || new RegExp(DEFAULT_FAILS[n].toString(16)).test(r.err ?? '') ? 'ok' : `expected failure 0x${DEFAULT_FAILS[n].toString(16)}, got ${r.err ?? 'success'}`) : r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();
  ok('default runs: pass list restored by undo', J(A.scene.passes.map(p => p.name)) === J(passes0), A.scene.passes.map(p => p.name));

  try {
    // ================= item 1: Current entry by scripting name, All passed explicitly
    reset(); run('RenderRegionCreate', { Viewport: -1 });
    let r = run('RenderRegionToggleVisibility');
    ok('1 ToggleVisibility by scripting name: the current viewport only', !r.err && S.regions.get(1).visible === false && S.regions.get(0).visible === true && S.regions.get(3).visible === true, [...S.regions.values()].map(g => g.visible));
    r = run('RenderRegionToggleVisibility', { Viewport: ':siViewportAll:siViewport' });
    ok('1 ToggleVisibility siViewportAll: every region (any visible -> all hidden)', [...S.regions.values()].every(g => !g.visible));
    for (const g of S.regions.values()) g.visible = true;
    r = run('RenderRegionRefresh');
    ok('1 Refresh by scripting name: the current region only', S.regions.get(1).renders === 1 && S.regions.get(0).renders === 0);
    r = key('Refresh All Render Regions');
    ok('1 key "Refresh All Render Regions": RenderRegionRefresh with siViewportAll', r.cmds.some(c => /^RenderRegionRefresh .*siViewportAll/.test(c)) && S.regions.get(0).renders === 1, r.cmds);
    r = key('Show/Hide Render Region');
    ok('1 key "Show/Hide Render Region": RenderRegionToggleVisibility on the current viewport', r.cmds.some(c => /^RenderRegionToggleVisibility .*siViewportCurrent/.test(c)) && S.regions.get(1).visible === false && S.regions.get(0).visible === true, r.cmds);
    r = run('RenderRegionToggleSelectionTracking');
    ok('1 ToggleSelectionTracking by scripting name: the current region only', S.regions.get(1).trackSelection === true && S.regions.get(0).trackSelection === false);

    // ================= items 2-3: Viewport All with no region
    reset(); setPref('region_refresh_mode', 1);
    r = run('RenderRegionToggleAutoRefresh', { Viewport: -1 });
    ok('2 ToggleAutoRefresh All, no region: preference := 0 (from 1)', !r.err && pref('region_refresh_mode') === 0 && S.regions.size === 0, pref('region_refresh_mode'));
    run('RenderRegionToggleAutoRefresh', { Viewport: -1 });
    ok('2 ToggleAutoRefresh All, no region, again: still 0 (not a toggle of the preference)', pref('region_refresh_mode') === 0);
    setPref('region_track_selection', false);
    run('RenderRegionToggleSelectionTracking', { Viewport: -1 }); const t1 = pref('region_track_selection');
    run('RenderRegionToggleSelectionTracking', { Viewport: -1 });
    ok('2 ToggleSelectionTracking All, no region: preference := true, twice', t1 === true && pref('region_track_selection') === true, [t1, pref('region_track_selection')]);
    run('RenderRegionSetRefreshMode', { Viewport: -1, RefreshMode: ':siRenderRegionRefreshModeManual:siRenderRegionRefreshMode' });
    ok('2 SetRefreshMode All, no region: preference := 2', pref('region_refresh_mode') === 2);
    run('RenderRegionSetDisplayType', { Viewport: -1, Type: 3 });
    ok('2 SetDisplayType All, no region: preference := 3', pref('region_display_mode') === 3);
    r = run('RenderRegionSetDisplayType', { Viewport: ':siViewportCurrent:siViewport', Type: 4 });
    ok('2 SetDisplayType Current, no region: nothing (S_FALSE)', pref('region_display_mode') === 3 && S.status.RenderRegionSetDisplayType === 1);
    r = run('RenderRegionGetRefreshMode', { Viewport: -1 });
    ok('3 GetRefreshMode All, no region: the preference (2)', r.v === 2 && S.out.RenderRegionGetRefreshMode.Value === 2, r);
    r = run('RenderRegionGetDisplayType', { Viewport: ':siViewportAll:siViewport' });
    ok('3 GetDisplayType All, no region: the preference (3)', r.v === 3, r);
    r = run('RenderRegionGetDisplayType');
    ok('3 GetDisplayType Current, no region: undefined in the binary, nothing returned, not yet attested', r.v === undefined && nyaAny(r), r);
    setPref('region_refresh_mode', 0); setPref('region_display_mode', 1); setPref('region_track_selection', false);

    // ================= item 4: Interactive <-> CTRS, region_auto_refresh untouched
    reset(); run('RenderRegionCreate', { Viewport: -1 }); for (const g of S.regions.values()) g.refreshMode = 2;
    const ar0 = pref('region_auto_refresh');
    run('RenderRegionToggleAutoRefresh', { Viewport: -1 });
    ok('4 ToggleAutoRefresh: no region in Interactive (all Manual) -> Interactive 0', [...S.regions.values()].every(g => g.refreshMode === 0) && pref('region_refresh_mode') === 0);
    run('RenderRegionToggleAutoRefresh', { Viewport: -1 });
    ok('4 ToggleAutoRefresh: a region in Interactive -> CTRS 1, preference 1', [...S.regions.values()].every(g => g.refreshMode === 1) && pref('region_refresh_mode') === 1);
    ok('4 rendering.region_auto_refresh is not written', pref('region_auto_refresh') === ar0);
    const rr = window.__siRenderRegion ?? null;
    ok('4 legacy region object: autoRefresh mirrors rendering.region_auto_refresh, not the refresh mode', !rr || rr.autoRefresh === !!ar0, rr && rr.autoRefresh);
    setPref('region_refresh_mode', 0);

    // ================= item 5: frame-set parser
    const frames = (text) => { run('ExportRenderArchiveFrameSet', { Passes: 'Passes.Current', FrameSet: text }); const j = S.lastJobs.jobs[0]; return j.choice === 'set' ? j.frames : null; };
    const cases = [
      ['5,1,3,1', [1, 3, 5]], ['1-3,2', [1, 2, 3]], [' 4 , 2 ', [2, 4]], ['1,,3', null], ['1,', null], [',', null],
      ['1-10x2', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['1-4:2', [1, 2, 3, 4]], ['1.5-3', [1.5, 2.5]], ['-5', [-5]], ['-5-3', [-5]],
      ['1-2-3', [1, 2]], ['5abc', [5]], ['abc', [0]], ['1 0', [1]], ['2.5', [2.5]], ['3-1', null], ['1..2', null], ['+7', [7]], ['3 - 4', [3, 4]],
    ];
    for (const [t, want] of cases) { const f = frames(t); ok(`5 frame set ${J(t)} -> ${J(want)}`, J(f) === J(want), f); }
    r = run('ExportRenderArchiveFrameSet', { Passes: 'Passes.Current', FrameSet: '1-3x2' });
    ok('5 frame set: no step syntax and no not-yet-attested step log', !nyaAny({ log: r.log.filter(l => /frame/i.test(l) && /step/i.test(l)) }));

    // ================= item 6: SICreatePass
    reset(); const st0 = an.startFrame, en0 = an.endFrame, step0 = an.frameStep;
    an.startFrame = 1.6; an.endFrame = 40.5;
    r = run('SICreatePass', { PresetObj: 'Pass', Name: 'B20c' });
    const p1 = r.v;
    ok('6 SICreatePass: FrameStart / FrameEnd rounded half away from zero (2, 41), FrameSet truncated "1-40"', p1?.val('FrameStart') === 2 && p1?.val('FrameEnd') === 41 && p1?.val('FrameSet') === '1-40' && p1?.val('FrameStep') === 1, p1 && [p1.val('FrameStart'), p1.val('FrameEnd'), p1.val('FrameSet')]);
    A.undo();
    an.startFrame = -2.5; an.endFrame = 3;
    r = run('SICreatePass', { PresetObj: '{42FC2493-732F-11d2-AC52-00A02485CECB}:Pass', Name: '' });
    ok('6 SICreatePass: negative In (-2.5 -> FrameStart -3, FrameSet "-2-3"); empty Name keeps the preset name', r.v?.val('FrameStart') === -3 && r.v?.val('FrameSet') === '-2-3' && /^Pass/.test(r.v?.name ?? ''), r.v && [r.v.name, r.v.val('FrameStart'), r.v.val('FrameSet')]);
    A.undo(); an.startFrame = st0; an.endFrame = en0;
    r = run('SICreatePass', { PresetObj: 'Passes\\Toon\\Toon_Pass.Preset', Name: 'Toony' });
    ok('6 SICreatePass: a preset of the Passes folder creates a pass (pass test on the created object)', r.v?.name === 'Toony', r);
    A.undo();
    r = run('SICreatePass', { PresetObj: 'Cube' });
    ok('6 SICreatePass: a preset whose object is not a pass -> XSIRENDERCORE 0x17 with the preset name, nothing made', r.v === undefined && r.log.some(l => /XSIRENDERCORE 0x17\] Cube/.test(l)));
    r = run('SICreatePass', { PresetObj: 'Some_Passive_Thing' });
    ok('6 SICreatePass: the test is not /pass/ on the preset name', r.v === undefined && r.log.some(l => /XSIRENDERCORE 0x17\]/.test(l)), r.log);
    r = run('SICreatePass', { PresetObj: 'Pass', Name: 'Parts' }); const pp = r.v;
    const bgo = pp?.partitions.find(p => p.name === 'Background_Objects_Partition'), bgl = pp?.partitions.find(p => p.name === 'Background_Lights_Partition');
    const objs = [...A.scene.allObjects()].filter(o => o !== A.scene.root);
    ok('6 SICreatePass partitions: lights -> first list, cameras skipped, everything else -> second list, root skipped', !!bgo && !!bgl && objs.every(o => o.type === 'light' ? bgl.members.has(o) && !bgo.members.has(o) : o.type === 'camera' ? !bgo.members.has(o) && !bgl.members.has(o) : bgo.members.has(o)) && !bgo.members.has(A.scene.root), [...(bgo?.members ?? [])].map(o => o.name));
    A.undo();
    const u0 = A.undoStack.length; const n0 = A.scene.passes.length; an.frameStep = 1.5;
    r = run('SICreatePass', { PresetObj: 'Pass', Name: 'BadTiming' });
    const bad = A.scene.passes.find(p => p.name === 'BadTiming');
    ok('6 SICreatePass: a wrong timing type skips the rest (pass in the container, no FrameSet, no Value, no undo record)', !!bad && r.v === undefined && A.undoStack.length === u0 && A.scene.passes.length === n0 + 1 && bad.val('FrameSet') !== '1-100x', [r.v, A.undoStack.length - u0]);
    an.frameStep = step0; if (bad) { A.scene.passes.splice(A.scene.passes.indexOf(bad), 1); bad.parent = null; }

    // ================= item 7: SICreateEmptyPartition
    reset(); const cur = A.scene.passes[A.scene.passes.length - 1]; const parts0 = cur.partitions.length;
    A.lockRecordsB11 ??= new Map(); A.lockRecordsB11.set(cur, [{ id: 0, lockLevel: 1, tagLevel: 0, type: 0 }]);
    r = run('SICreateEmptyPartition', { Name: 'Locked1' });
    ok('7 SICreateEmptyPartition: pass locked at level 1 -> skipped with an error', !r.err && cur.partitions.length === parts0 && r.log.some(l => /is locked/.test(l)), r);
    A.lockRecordsB11.set(cur, [{ id: 0, lockLevel: 4, tagLevel: 0, type: 0 }]);
    r = run('SICreateEmptyPartition', { Name: 'Lock4' });
    ok('7 SICreateEmptyPartition: a lock at another level only -> created', cur.partitions.length === parts0 + 1);
    A.undo(); A.lockRecordsB11.delete(cur); cur.locked = true;
    r = run('SICreateEmptyPartition', { Name: 'AdHoc' });
    ok('7 SICreateEmptyPartition: an ad-hoc `locked` flag is not the lock status', cur.partitions.length === parts0 + 1);
    A.undo(); delete cur.locked;
    r = run('SICreateEmptyPartition', { Name: 'L2', Type: 2 });
    ok('7 Type 2 (VT_I4): light partition', r.v?.[0]?.partitionType === 'siLightPartition'); A.undo();
    r = run('SICreateEmptyPartition', { Name: 'L3', Type: ':siLightPartition:siPartitionType' });
    ok('7 Type enum string: converted (light partition)', r.v?.[0]?.partitionType === 'siLightPartition'); A.undo();
    r = run('SICreateEmptyPartition', { Name: 'L4', Type: 'nonsense' });
    ok('7 Type not an integer: the default is kept (object partition), no error, not yet attested', !r.err && r.v?.[0]?.partitionType === 'siObjectPartition' && nya20(r), r); A.undo();
    r = run('SICreateEmptyPartition', { Name: 'L5', Type: 2.5 });
    ok('7 Type 2.5 (not VT_I4): the default is kept', !r.err && r.v?.[0]?.partitionType === 'siObjectPartition'); A.undo();
    r = run('SICreateEmptyPartition', { Name: 'L6', Type: 3 });
    ok('7 Type 3: E_INVALIDARG before any pass is touched', /0x80070057/.test(r.err ?? '') && cur.partitions.length === parts0);
    r = run('SICreateEmptyPartition', { Name: '' });
    ok('7 empty Name: E_INVALIDARG', /0x80070057/.test(r.err ?? ''));

    // ================= item 8: RemoveRenderChannel
    reset(); const chans = window.__siRenderChannels; const nCh = chans.length;
    r = run('RemoveRenderChannel', { Name: 'main' });
    ok('8 RemoveRenderChannel "main": not found by this build\'s manager, E_INVALIDARG, case rule not yet attested', /0x80070057/.test(r.err ?? '') && nya20(r) && chans.length === nCh, r);
    r = run('RemoveRenderChannel', { Name: 'Main' });
    ok('8 RemoveRenderChannel Main: no Main guard, no Main log, removed', !r.err && !chans.some(c => c.name === 'Main') && !nyaAny(r), r);
    A.undo(); ok('8 RemoveRenderChannel: undo restores the channel', chans.some(c => c.name === 'Main'));
  } catch (e) { ok('render block threw', false, String(e?.stack ?? e).slice(0, 400)); }

  try {
    // ================= item 9: SetAndToggleSelection
    reset(); A.select([cube]);
    let r = run('SetAndToggleSelection', { SelectionList: 'no_such_thing' });
    ok('9 SetAndToggleSelection: no usable item -> 0x562e80c7, selection not touched', !r.err && r.status === 0x562e80c7 && A.selection.length === 1 && A.selection[0] === cube, [r, A.selection.map(n => n.name)]);
    ok('9 SetAndToggleSelection: no "owner pre-check" log', !r.log.some(l => /owner pre-check/.test(l)));
    r = run('SetAndToggleSelection', { SelectionList: '' });
    ok('9 SetAndToggleSelection: empty list -> not touched, not yet attested (CMD-B20c)', !r.err && A.selection[0] === cube && nya20(r) && r.status === 0x562e80c7, r);
    r = run('SetAndToggleSelection', { SelectionList: 'cube' });
    ok('9 SetAndToggleSelection: everything listed was selected -> the selection becomes empty (toggle off), S_OK', !r.err && A.selection.length === 0 && r.status === 0, [r, A.selection.map(n => n.name)]);
    A.undo(); ok('9 SetAndToggleSelection: undo', A.selection[0] === cube);

    // ================= item 10: hierarchy level names
    for (const lv of ['CHAIN', 'NODE OR BRANCH', '{0907F360-B147-11d2-8BC8-00AA006130EF}:CHAIN', '{0907F360-B147-11d2-8BC8-00AA006130EF}:NODE OR BRANCH', 'ASITIS', 'BRANCH', 'TREE', 'MODEL']) {
      reset(); r = run('SetAndToggleSelection', { SelectionList: 'sphere', HierarchyLevel: lv });
      ok(`10 HierarchyLevel ${lv}: accepted`, !r.err && A.selection.includes(sph), r);
    }
    reset(); r = run('SetAndToggleSelection', { SelectionList: 'sphere', HierarchyLevel: 'CHAIN' });
    ok('10 HierarchyLevel CHAIN: number / expansion not yet attested (CMD-B20c)', nya20(r));
    r = run('SetAndToggleSelection', { SelectionList: 'sphere', HierarchyLevel: 'bogus' });
    ok('10 HierarchyLevel bogus: E_INVALIDARG', r.code === 0x80070057);

    // ================= items 11-12: Activate...SelTool status and tool
    reset(); A.select([cube]);
    r = run('ActivateVertexSelTool');
    ok('11 ActivateVertexSelTool, filter changed: S_OK, no do-not-record', !r.err && r.status === 0 && !SD().doNotRecord.includes('ActivateVertexSelTool'), r);
    ok('12 ActivateVertexSelTool: point filter -> component select tool e9cdd760', tm.current() === COMP && A.selMode === 'point', tm.current());
    const u1 = A.undoStack.length;
    r = run('ActivateVertexSelTool');
    ok('11 ActivateVertexSelTool again (filter unchanged): S_FALSE, "do not record", no undo entry, log line not yet attested', !r.err && r.status === 1 && SD().doNotRecord.includes('ActivateVertexSelTool') && A.undoStack.length === u1 && nya20(r), [r, A.undoStack.length - u1]);
    r = run('ActivateSelectTool');
    ok('11 ActivateSelectTool (no SelFilter): S_FALSE', !r.err && r.status === 1);
    ok('12 ActivateSelectTool from the point filter: the current filter is a component one -> e9cdd760', tm.current() === COMP);
    for (const [n, kind] of [['ActivateEdgeSelTool', 'edge'], ['ActivatePolygonSelTool', 'polygon'], ['ActivateRaycastPolySelTool', 'polygon'], ['ActivateRaycastEdgeSelTool', 'edge']]) {
      reset(); r = run(n);
      ok(`12 ${n}: filter ${kind}, component select tool, S_OK, no family not-yet-attested log`, !r.err && A.selMode === kind && tm.current() === COMP && r.status === 0 && !r.log.some(l => /component-family/.test(l)), [r, tm.current()]);
    }
    reset(); r = run('ActivateTipSelTool');
    ok('12 ActivateTipSelTool: hair tip filter -> e9cdd760 (inferred family)', !r.err && tm.current() === COMP);

    // ================= item 14: ActivateObjectSelTool
    reset(); A.select([cube]); A.run('SelectVertexFilter'); A.selectComponents(cube, 'point', [0]); A.userPrefs.SI3D_GROUP_SEL_MODE = true; A.userPrefs.SI3D_RECTSEL_REGION_MODE = 2;
    r = run('ActivateObjectSelTool');
    ok('14 ActivateObjectSelTool from a component filter: object filter, selection tool 11778840, S_OK', !r.err && A.selMode === 'object' && tm.current() === SELECT && r.status === 0, [r, A.selMode, tm.current()]);
    ok('14 ActivateObjectSelTool: GroupMode false and SelRegionMode 1 written', A.userPrefs.SI3D_GROUP_SEL_MODE === false && A.userPrefs.SI3D_RECTSEL_REGION_MODE === 1);
    ok('14 ActivateObjectSelTool: DeselectOnNewFilter true (the components are removed)', !A.compSel);
    reset(); A.select([]); A.selFilter = 'camera';
    r = run('ActivateObjectSelTool');
    ok('14 ActivateObjectSelTool from an object filter: filter kept, S_FALSE', A.selFilter === 'camera' && r.status === 1);
    reset(); A.run('SelectVertexFilter');
    r = run('ActivateObjectSelToolWithNoObjStateChange');
    ok('14 ActivateObjectSelToolWithNoObjStateChange from the point filter: S_OK, selection tool', !r.err && r.status === 0 && tm.current() === SELECT);

    // ================= item 13: key map runs the Activate commands
    const keys = [
      ['Point Select Tool', 'ActivateVertexSelTool', 'point'], ['Point Select Tool (Extended Selection)', 'ActivateVertexSelToolWithNoObjStateChange', 'point'],
      ['Edge Select Tool', 'ActivateEdgeSelTool', 'edge'], ['Edge Select Tool (Extended Selection)', 'ActivateEdgeSelToolWithNoObjStateChange', 'edge'],
      ['Polygon Select Tool', 'ActivatePolygonSelTool', 'polygon'], ['Polygon Select Tool (Extended Selection)', 'ActivatePolygonSelToolWithNoObjStateChange', 'polygon'],
      ['Raycast Polygon Select Tool', 'ActivateRaycastPolySelTool', 'polygon'], ['Raycast Polygon Select Tool (Extended Selection)', 'ActivateRaycastPolySelToolWithNoObjStateChange', 'polygon'],
      ['Raycast Edge Select Tool', 'ActivateRaycastEdgeSelTool', 'edge'], ['Raycast Edge Select Tool (Extended Selection)', 'ActivateRaycastEdgeSelToolWithNoObjStateChange', 'edge'],
      ['Object Select Tool', 'ActivateObjectSelTool', 'object'], ['Object Select Tool (Extended Selection)', 'ActivateObjectSelToolWithNoObjStateChange', 'object'],
      ['Hair Tip Select Tool', 'ActivateTipSelTool', 'object'],
    ];
    for (const [k, cmd, mode] of keys) {
      reset(); if (mode === 'object') A.run('SelectVertexFilter');
      const kr = key(k);
      ok(`13 key "${k}": runs ${cmd}`, kr.cmds.some(c => c.startsWith(cmd + ' ') || c === cmd) && (k === 'Hair Tip Select Tool' ? A.selFilter === 'Tip' : A.selMode === mode), [kr.cmds, A.selMode, A.selFilter]);
    }
    reset(); A.select([cube]); key('Point Select Tool');
    ok('13 key "Point Select Tool": the filter change happens (object becomes an active element), tool e9cdd760', A.activeElements.includes(cube) && tm.current() === COMP);

    // ================= item 15: transport rows
    const rs = () => { reset(); an.loopMode = 'loop'; an.dir = 1; an.frame = 10; };
    const st = an.startFrame, en = an.endFrame;
    rs(); an.frame = en; r = run('NextFrame');
    ok('15 NextFrame at the end with the range flag: back to the start', !r.err && an.frame === st, an.frame);
    rs(); an.loopMode = 'once'; an.frame = en; r = run('NextFrame');
    ok('15 NextFrame at the end without the range flag: no clamping', an.frame === en + 1, an.frame);
    rs(); A.undoStack.push({ label: 'b20c-marker', undo() {}, redo() {} }); r = run('NextFrame');
    ok('15 NextFrame: forward by one, undoable', an.frame === 11 && A.undoStack[A.undoStack.length - 1]?.label === 'NextFrame' && A.undoStack[A.undoStack.length - 2]?.label === 'b20c-marker'); A.undo(); A.undoStack.pop();
    ok('15 NextFrame undo: frame restored', an.frame === 10);
    rs(); r = run('FirstFrame'); ok('15 FirstFrame: Type 2 -> start', an.frame === st);
    rs(); r = run('LastFrame'); ok('15 LastFrame: Type 3 -> end', an.frame === en);
    rs(); an.frame = en; r = run('PlayForwards');
    ok('15 PlayForwards stopped at the end: jumps to the start, plays forwards every frame', an.playing && an.dir === 1 && an.frame <= st + 2 && an.playMode?.realtime === false, [an.frame, an.playing, an.playMode]);
    r = run('PlayForwards'); ok('15 PlayForwards while playing: stops', !an.playing);
    rs(); an.frame = 30; r = run('PlayForwardsFromStart');
    ok('15 PlayForwardsFromStart: from the start, forwards', an.playing && an.dir === 1 && an.frame <= st + 2);
    r = run('PlayForwardsFromStart'); ok('15 PlayForwardsFromStart while playing: stops', !an.playing);
    rs(); r = run('NextFrame', { Transport: 1 });
    ok('15 NextFrame Transport 1 (sequence player): nothing, not yet attested', an.frame === 10 && nyaAny(r));
    ok('15 the five are undoable commands with Type / Transport', ['NextFrame', 'FirstFrame', 'LastFrame', 'PlayForwards', 'PlayForwardsFromStart'].every(n => A.commands.get(n).undoable === true && J(A.commands.get(n).args.map(x => x.name)) === J(['Type', 'Transport'])));

    // ================= item 16: Play in Real Time
    rs(); const kr = key('Play in Real Time');
    ok('16 key "Play in Real Time": runs PlayRealTime (Type 5), real-time playback', kr.cmds.some(c => /^PlayRealTime /.test(c)) && an.playing && an.playMode?.realtime === true, [kr.cmds, an.playMode]);
    an.stop(); an.frame = 1;
  } catch (e) { ok('selection block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset(); an.stop();
  return out;
}, { NAMES, REG_NAMES, DEFAULT_FAILS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of REG_NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]?.args) === JSON.stringify(registry[n]?.args), `${JSON.stringify(got.reg[n]?.args)} vs ${JSON.stringify(registry[n]?.args)}`);
  report(`${n}: registry label`, got.reg[n]?.label === registry[n]?.label, `${got.reg[n]?.label} vs ${registry[n]?.label}`);
}
for (const n of NAMES) report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_pr201_b20c: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
