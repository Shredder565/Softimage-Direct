// CMD-B19a (rendercore.dll): render region (12), RemoveRenderChannel, SICreatePass, SICreateEmptyPartition,
// MoveToPartition, SIRenderPass / RenderPassesFrameSet / RenderSelectedPasses, ExportRenderArchiveFrameSet /
// ExportRenderArchiveAllPasses, RenderPassToggleShowRenderedImage: the 22 commands of src/commands/renderB19a.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b19a-rendercore-region-passes.md
// sections 2-3 and the CMD-B19a items of docs/re/WIRE_CORRECTIONS_B19.md.
//   1. every name is registered with the catalogue argument list (data/commands_full.json, first entry of the name);
//   2. every command runs with its default arguments on the ?demo scene without an error;
//   3. the contract's stated results (per-viewport regions, "any on -> all off", preferences with siViewportAll,
//      integer display / refresh values, channel validation, framebuffer deletion, pass / partition creation, frame
//      arguments and job frame counts, restricted-mode refusal, SetValue on the show-rendered-image preference) and the
//      "not yet attested ... CMD-B19a" logs of the parts the analyst could not read.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_render_b19a.mjs
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
  'RenderRegionCreate', 'RenderRegionClose', 'RenderRegionToggleVisibility', 'RenderRegionRefresh', 'RenderRegionToggleAutoRefresh',
  'RenderRegionToggleSelectionTracking', 'RenderRegionSetDisplayType', 'RenderRegionGetDisplayType', 'RenderRegionSetRefreshMode',
  'RenderRegionGetRefreshMode', 'RenderRegionSetRenderChannel', 'RenderRegionGetRenderChannel', 'RemoveRenderChannel', 'SICreatePass',
  'SICreateEmptyPartition', 'MoveToPartition', 'SIRenderPass', 'RenderPassesFrameSet', 'RenderSelectedPasses',
  'ExportRenderArchiveFrameSet', 'ExportRenderArchiveAllPasses', 'RenderPassToggleShowRenderedImage',
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
await page.waitForFunction(() => !!window.Application?.commands?.get('RenderRegionCreate') && !!window.Application?.scene?.find('cube') && !!window.__vm, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B19a/.test(l));
  const J = JSON.stringify;
  const S = A.renderB19a;
  const prefs = window.__prefSets.get('C3DPrefsRendering');
  const pref = (n) => prefs.val(n);
  const cube = A.scene.find('cube');
  const ro = A.scene.renderOptions;
  // keep default renders short: the default pass range source 3 reads the scene render options
  ro.set('FrameRangeSource', 0); ro.set('FrameStart', 1); ro.set('FrameEnd', 2); ro.set('FrameStep', 1);
  const vm = window.__vm; vm.setActive(1);
  const reset = () => { S.regions.clear(); S.underMouse = null; S.abortNext = false; A.select([cube]); vm.setActive(1); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  const passes0 = A.scene.passes.map(p => p.name);
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    if (n !== 'RenderRegionCreate') run('RenderRegionCreate');
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    // RemoveRenderChannel (Name "") and MoveToPartition (no partition in the selection) fail with E_INVALIDARG by contract
    const expectInvalid = n === 'RemoveRenderChannel' || n === 'MoveToPartition';
    out.defaults[n] = expectInvalid ? (/0x80070057/.test(r.err ?? '') ? 'ok' : 'expected E_INVALIDARG, got ' + (r.err ?? 'success')) : r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();
  ok('default runs: pass list restored by undo', J(A.scene.passes.map(p => p.name)) === J(passes0), A.scene.passes.map(p => p.name));

  try {
    // ---------------- region create / per viewport
    let r = run('RenderRegionCreate');
    ok('RenderRegionCreate: returns nothing', !r.err && r.v === undefined, r);
    ok('RenderRegionCreate: region on the current viewport only (B), visible, bounds 0.1/0.9', S.regions.size === 1 && S.regions.get(1)?.visible === true && Math.abs(S.regions.get(1).left - 0.1) < 1e-6 && Math.abs(S.regions.get(1).bottom - 0.9) < 1e-6, [...S.regions.values()]);
    ok('RenderRegionCreate: raises RENCORE_FLUSH_DELAYED_RENDERREGION_INIT', S.notifications.at(-1) === 'RENCORE_FLUSH_DELAYED_RENDERREGION_INIT');
    reset(); run('RenderRegionCreate', { Viewport: ':siViewportAll:siViewport', Left: 0.2, Right: 0.6, Top: 0.3, Bottom: 0.7 });
    ok('RenderRegionCreate All: one region per viewport (4) with the bounds', S.regions.size === 4 && [...S.regions.values()].every(g => g.left === 0.2 && g.right === 0.6 && g.top === 0.3 && g.bottom === 0.7 && g.visible));
    reset(); run('RenderRegionCreate', { Viewport: 0, Left: 0.2, Right: '0.6', Top: 0.3, Bottom: 0.7 });
    ok('RenderRegionCreate: bounds used only if all four are floats (else zero bounds)', S.regions.get(0)?.left === 0 && S.regions.get(0)?.right === 0 && S.regions.get(0)?.visible === true, S.regions.get(0));
    reset(); r = run('RenderRegionCreate', { Viewport: -4 });
    ok('Viewport below -3: warning XSIRENDERCORE 2, nothing resolved (S_FALSE)', S.regions.size === 0 && S.status.RenderRegionCreate === 1 && r.log.some(l => /XSIRENDERCORE 0x2\]/.test(l)), r.log);
    reset(); run('RenderRegionCreate', { Viewport: '2' });
    ok('Viewport as a string: _wtol ("2" -> viewport C)', S.regions.has(2) && S.regions.size === 1);
    reset(); S.underMouse = 3; run('RenderRegionCreate', { Viewport: ':siViewportUnderMouse:siViewport' });
    ok('Viewport -3: the designated viewport (stand-in underMouse)', S.regions.has(3) && S.regions.size === 1);
    reset(); r = run('RenderRegionCreate', { Viewport: -3 });
    ok('Viewport -3 without a designated viewport: current viewport, "not yet attested ... CMD-B19a"', S.regions.has(1) && nya(r), r.log);

    // ---------------- non-create commands need a region
    reset();
    for (const n of ['RenderRegionClose', 'RenderRegionToggleVisibility', 'RenderRegionRefresh', 'RenderRegionToggleAutoRefresh', 'RenderRegionToggleSelectionTracking', 'RenderRegionSetDisplayType', 'RenderRegionSetRefreshMode', 'RenderRegionSetRenderChannel']) {
      r = run(n, { Viewport: ':siViewportCurrent:siViewport' });
      ok(`${n}: no region -> nothing (S_FALSE), no region made`, !r.err && S.regions.size === 0 && S.status[n] === 1, r);
    }
    r = run('RenderRegionGetDisplayType', { Viewport: 0 });
    ok('Get on a viewport without a region: nothing, "not yet attested ... CMD-B19a"', r.v === undefined && nya(r));

    // ---------------- close
    reset(); run('RenderRegionCreate', { Viewport: -1 }); run('RenderRegionClose');
    ok('RenderRegionClose: closes the current viewport region only', S.regions.size === 3 && !S.regions.has(1));
    run('RenderRegionClose', { Viewport: -1 });
    ok('RenderRegionClose All: closes all', S.regions.size === 0);

    // ---------------- toggle visibility
    reset(); run('RenderRegionCreate', { Viewport: -1 }); S.regions.get(0).visible = false; S.regions.get(2).visible = false; S.regions.get(3).visible = false;
    run('RenderRegionToggleVisibility', { Viewport: -1 });
    ok('ToggleVisibility: any visible -> all hidden', [...S.regions.values()].every(g => !g.visible));
    run('RenderRegionToggleVisibility', { Viewport: -1 });
    ok('ToggleVisibility: none visible -> all shown', [...S.regions.values()].every(g => g.visible));

    // ---------------- refresh
    reset(); run('RenderRegionCreate', { Viewport: -1 }); S.regions.get(0).visible = false; const g0 = S.globalRefreshes;
    run('RenderRegionRefresh', { Viewport: -1 });
    ok('RenderRegionRefresh: visible regions re-rendered, hidden skipped, one global refresh', S.regions.get(0).renders === 0 && S.regions.get(1).renders === 1 && S.regions.get(3).renders === 1 && S.globalRefreshes === g0 + 1);

    // ---------------- auto refresh (refresh mode 0 <-> 1) and the preference
    reset(); prefs.set('region_refresh_mode', 0); run('RenderRegionCreate', { Viewport: -1 }); S.regions.get(2).refreshMode = 1;
    run('RenderRegionToggleAutoRefresh');
    ok('ToggleAutoRefresh (default All): any mode 0 -> all mode 1, preference region_refresh_mode = 1', [...S.regions.values()].every(g => g.refreshMode === 1) && pref('region_refresh_mode') === 1, [[...S.regions.values()].map(g => g.refreshMode), pref('region_refresh_mode')]);
    run('RenderRegionToggleAutoRefresh');
    ok('ToggleAutoRefresh: none in mode 0 -> all mode 0, preference 0', [...S.regions.values()].every(g => g.refreshMode === 0) && pref('region_refresh_mode') === 0);
    prefs.set('region_refresh_mode', 2); run('RenderRegionToggleAutoRefresh', { Viewport: 1 });
    ok('ToggleAutoRefresh on one viewport: no preference write', S.regions.get(1).refreshMode === 1 && S.regions.get(0).refreshMode === 0 && pref('region_refresh_mode') === 2);
    prefs.set('region_refresh_mode', 0);

    // ---------------- selection tracking
    reset(); prefs.set('region_track_selection', false); run('RenderRegionCreate', { Viewport: -1 }); S.regions.get(3).trackSelection = true;
    run('RenderRegionToggleSelectionTracking', { Viewport: -1 });
    ok('ToggleSelectionTracking All: any on -> all off, preference = false', [...S.regions.values()].every(g => !g.trackSelection) && pref('region_track_selection') === false);
    run('RenderRegionToggleSelectionTracking', { Viewport: -1 });
    ok('ToggleSelectionTracking All: all on, preference = true', [...S.regions.values()].every(g => g.trackSelection) && pref('region_track_selection') === true);
    prefs.set('region_track_selection', false);

    // ---------------- display type / refresh mode set + get
    reset(); prefs.set('region_display_mode', 1); run('RenderRegionCreate', { Viewport: -1 });
    run('RenderRegionSetDisplayType', { Viewport: 1, Type: ':siRenderRegionDisplayRed:siRenderRegionDisplayType' });
    ok('SetDisplayType: integer passed to the region (Red = 3), no preference write without All', S.regions.get(1).displayType === 3 && S.regions.get(0).displayType !== 3 && pref('region_display_mode') === 1);
    r = run('RenderRegionGetDisplayType', { Viewport: 1 });
    ok('GetDisplayType: integer Value of the first resolved region (3)', r.v === 3 && S.out.RenderRegionGetDisplayType.Value === 3, r);
    run('RenderRegionSetDisplayType', { Viewport: -1, Type: '2' });
    ok('SetDisplayType All: all regions 2 (string -> _wtol), preference region_display_mode = 2', [...S.regions.values()].every(g => g.displayType === 2) && pref('region_display_mode') === 2);
    run('RenderRegionSetDisplayType', { Viewport: -1, Type: 42 });
    ok('SetDisplayType: no range check (42 stored)', S.regions.get(0).displayType === 42);
    prefs.set('region_display_mode', 5); S.regions.get(1).displayType = 0;
    ok('GetDisplayType All: reads the preference', run('RenderRegionGetDisplayType', { Viewport: -1 }).v === 5);
    prefs.set('region_display_mode', 1);
    run('RenderRegionSetRefreshMode', { RefreshMode: ':siRenderRegionRefreshModeManual:siRenderRegionRefreshMode' });
    ok('SetRefreshMode (default All): Manual = 2 on all regions, preference region_refresh_mode = 2', [...S.regions.values()].every(g => g.refreshMode === 2) && pref('region_refresh_mode') === 2);
    S.regions.get(1).refreshMode = 1;
    ok('GetRefreshMode (default current): the region value 1', run('RenderRegionGetRefreshMode').v === 1);
    ok('GetRefreshMode All: the preference 2', run('RenderRegionGetRefreshMode', { Viewport: -1 }).v === 2);
    prefs.set('region_refresh_mode', 0);

    // ---------------- render channel set / get
    const chans = window.__siRenderChannels;
    reset(); run('RenderRegionCreate', { Viewport: -1 });
    run('CreateRenderChannel', { Name: 'Depth_Ch', Type: 'Depth' });
    r = run('RenderRegionSetRenderChannel', { Viewport: -1, RenderChannel: 'depth_ch' });
    ok('SetRenderChannel: case-insensitive match, set on all, returns nothing', !r.err && r.v === undefined && [...S.regions.values()].every(g => g.channel === 'Depth_Ch'), r);
    r = run('RenderRegionSetRenderChannel', { Viewport: -1, RenderChannel: 'Nope' });
    ok('SetRenderChannel: unknown channel -> E_INVALIDARG, nothing changed', /0x80070057/.test(r.err ?? '') && [...S.regions.values()].every(g => g.channel === 'Depth_Ch'), r);
    run('RenderRegionSetRenderChannel', { Viewport: 1, RenderChannel: '' });
    ok('SetRenderChannel: empty -> Main', S.regions.get(1).channel === 'Main');
    r = run('RenderRegionGetRenderChannel', { Viewport: 0 });
    ok('GetRenderChannel: first resolved region channel, Value string', r.v === 'Depth_Ch' && S.out.RenderRegionGetRenderChannel.Value === 'Depth_Ch', r);
    r = run('RenderRegionGetRenderChannel', { Viewport: -1 });
    ok('GetRenderChannel All -> E_INVALIDARG', /0x80070057/.test(r.err ?? ''), r);
    S.regions.get(0).channel = '';
    ok('GetRenderChannel: no current channel -> E_POINTER', /0x80004003/.test(run('RenderRegionGetRenderChannel', { Viewport: 0 }).err ?? ''));

    // ---------------- RemoveRenderChannel
    ok('RemoveRenderChannel: empty Name -> E_INVALIDARG', /0x80070057/.test(run('RemoveRenderChannel').err ?? ''));
    ok('RemoveRenderChannel: unknown channel -> E_INVALIDARG', /0x80070057/.test(run('RemoveRenderChannel', { Name: 'Missing' }).err ?? ''));
    const p0 = A.scene.passes[0];
    const fb = p0.addFramebuffer('DepthFB'); fb.set('RenderChannel', 'Depth_Ch');
    const fbMain = p0.framebuffers.find(f => f.name === 'Main');
    r = run('RemoveRenderChannel', { Name: 'Depth_Ch' });
    ok('RemoveRenderChannel: framebuffers on the channel deleted in all passes, channel removed, returns nothing', !r.err && r.v === undefined && !p0.framebuffers.includes(fb) && p0.framebuffers.includes(fbMain) && !chans.some(c => c.name === 'Depth_Ch'), r);
    A.undo();
    ok('RemoveRenderChannel: undo restores the channel and the framebuffer', chans.some(c => c.name === 'Depth_Ch') && p0.framebuffers.includes(fb));
    p0.framebuffers.splice(p0.framebuffers.indexOf(fb), 1); chans.splice(chans.findIndex(c => c.name === 'Depth_Ch'), 1);

    // ---------------- SICreatePass
    reset(); const cur0 = A.scene.passes[A.scene.passes.length - 1]; A.anim.startFrame = 5; A.anim.endFrame = 40;
    r = run('SICreatePass', { PresetObj: 'Pass', Name: 'Beauty' });
    const bp = r.v;
    ok('SICreatePass: Value = the new pass named Name, added to the passes', bp?.name === 'Beauty' && A.scene.passes.includes(bp) && S.out.SICreatePass.Value === bp, r);
    ok('SICreatePass: not made current (the current pass is unchanged)', A.scene.passes[A.scene.passes.length - 1] === cur0);
    ok('SICreatePass: FrameStart / FrameEnd / FrameStep / FrameSet from the timeline (5, 40, 1, "5-40")', bp?.val('FrameStart') === 5 && bp?.val('FrameEnd') === 40 && bp?.val('FrameStep') === 1 && bp?.val('FrameSet') === '5-40', [bp?.val('FrameStart'), bp?.val('FrameEnd'), bp?.val('FrameSet')]);
    const bgo = bp?.partitions.find(p => p.name === 'Background_Objects_Partition'), bgl = bp?.partitions.find(p => p.name === 'Background_Lights_Partition');
    const light = [...A.scene.allObjects()].find(o => o.type === 'light' || o.constructor.name === 'Light');
    ok('SICreatePass: default partitions filled (lights -> lights partition, objects -> objects partition, no camera)', bgo?.members.has(cube) && (!light || bgl?.members.has(light)) && ![...bgo.members].some(o => o.type === 'camera'), [[...(bgo?.members ?? [])].map(o => o.name), [...(bgl?.members ?? [])].map(o => o.name)]);
    A.undo();
    ok('SICreatePass: undoable', !A.scene.passes.includes(bp));
    A.anim.startFrame = 1; A.anim.endFrame = 100;
    r = run('SICreatePass', { PresetObj: 'Cube' });
    ok('SICreatePass: a preset that is not a pass logs XSIRENDERCORE 0x17 and stops', r.v === undefined && r.log.some(l => /XSIRENDERCORE 0x17\] Cube/.test(l)), r.log);
    ok('SICreatePass: missing PresetObj -> E_INVALIDARG', /0x80070057/.test(run('SICreatePass', { PresetObj: null }).err ?? ''));

    // ---------------- SICreateEmptyPartition
    reset(); const cp = A.scene.passes[A.scene.passes.length - 1]; const n0 = cp.partitions.length;
    r = run('SICreateEmptyPartition');
    ok('SICreateEmptyPartition default: one object partition "Partition" in Passes.Current, Value = collection', Array.isArray(r.v) && r.v.length === 1 && r.v[0].name === 'Partition' && r.v[0].partitionType === 'siObjectPartition' && cp.partitions.length === n0 + 1, r);
    A.undo();
    r = run('SICreateEmptyPartition', { Type: 2, Name: 'Keys' });
    ok('SICreateEmptyPartition Type 2: light partition', r.v?.[0]?.partitionType === 'siLightPartition');
    A.undo();
    ok('SICreateEmptyPartition Type 3 -> E_INVALIDARG', /0x80070057/.test(run('SICreateEmptyPartition', { Type: 3 }).err ?? ''));
    ok('SICreateEmptyPartition empty Name -> E_INVALIDARG', /0x80070057/.test(run('SICreateEmptyPartition', { Name: '' }).err ?? ''));
    const extra = A.scene.addPass('Extra'); A.scene.passes.splice(A.scene.passes.indexOf(extra), 1); A.scene.passes.unshift(extra);
    r = run('SICreateEmptyPartition', { Target: [A.scene.passes[0], cp], Name: 'Both' });
    ok('SICreateEmptyPartition: one partition per target pass', r.v?.length === 2 && extra.partitions.some(p => p.name === 'Both') && cp.partitions.some(p => p.name === 'Both'));
    A.undo(); A.scene.passes.splice(A.scene.passes.indexOf(extra), 1);

    // ---------------- MoveToPartition
    reset();
    const [fg] = run('SICreateEmptyPartition', { Name: 'Fg' }).v;
    const bg = cp.partitions.find(p => p.name === 'Background_Objects_Partition'); bg.members.add(cube);
    r = run('MoveToPartition', { Target: [fg], InputObjs: 'cube', Source: [cp] });
    ok('MoveToPartition: objects moved to the partition, leaving the other partitions of the pass', !r.err && fg.members.has(cube) && !bg.members.has(cube), r);
    A.undo();
    ok('MoveToPartition: undoable', !fg.members.has(cube) && bg.members.has(cube));
    const other = A.scene.addPass('OtherPass');
    r = run('MoveToPartition', { Target: [fg], InputObjs: 'cube', Source: [other] });
    ok('MoveToPartition: Target not in the Source pass -> E_INVALIDARG', /0x80070057/.test(r.err ?? ''), r);
    A.scene.passes.splice(A.scene.passes.indexOf(other), 1);
    ok('MoveToPartition: Target without a partition -> E_INVALIDARG', /0x80070057/.test(run('MoveToPartition', { Target: 'cube', InputObjs: 'cube' }).err ?? ''));
    cp.partitions.splice(cp.partitions.indexOf(fg), 1);

    // ---------------- render handlers
    reset();
    r = run('SIRenderPass', { StartFrame: 3, EndFrame: 7, StepFrame: 2 });
    let jobs = S.lastJobs?.jobs ?? [];
    ok('SIRenderPass Start/End/Step: one job, range frames 3,5,7, frame_offset 0, frame_total 3', jobs.length === 1 && J(jobs[0].frames) === J([3, 5, 7]) && jobs[0].choice === 'range' && jobs[0].frame_offset === 0 && jobs[0].frame_total === 3, jobs.map(j => [j.frames, j.choice]));
    ok('SIRenderPass: returns nothing, logs "not yet attested ... CMD-B19a" for the render loop', !r.err && r.v === undefined && nya(r), r);
    run('SIRenderPass', { StartFrame: 3 });
    ok('SIRenderPass: Start without End -> the pass\'s own range', S.lastJobs.jobs[0].choice === 'own' && J(S.lastJobs.jobs[0].frames) === J([1, 2]), S.lastJobs.jobs[0]);
    run('SIRenderPass', { StartFrame: 2, EndFrame: 4 });
    ok('SIRenderPass: Step defaults to 1 when Start and End are given', J(S.lastJobs.jobs[0].frames) === J([2, 3, 4]));
    S.abortNext = true; r = run('SIRenderPass', { StartFrame: 1, EndFrame: 1 });
    ok('SIRenderPass: user abort -> cancel status 0x562e80c7', /0x562e80c7/.test(r.err ?? ''), r);
    const passA = A.scene.passes[A.scene.passes.length - 1]; const fsBefore = passA.val('FrameSet');
    const extra2 = A.scene.addPass('Second'); A.scene.passes.splice(A.scene.passes.indexOf(extra2), 1); A.scene.passes.unshift(extra2);
    r = run('RenderPassesFrameSet', { Passes: [extra2, passA], FrameSet: '1,4-5' });
    jobs = S.lastJobs.jobs;
    ok('RenderPassesFrameSet: frame set applied to every job (1,4,5); frame_offset 0 / 3, frame_total 6', jobs.length === 2 && jobs.every(j => J(j.frames) === J([1, 4, 5]) && j.choice === 'set' && j.frame_total === 6) && jobs[0].frame_offset === 0 && jobs[1].frame_offset === 3, jobs.map(j => [j.frames, j.frame_offset, j.frame_total]));
    ok('RenderPassesFrameSet: the pass FrameSet parameter is not written', passA.val('FrameSet') === fsBefore && extra2.val('FrameSet') === '1-100');
    run('RenderPassesFrameSet', { Passes: passA, FrameSet: '' });
    ok('RenderPassesFrameSet: empty frame set -> the pass\'s own range', S.lastJobs.jobs[0].choice === 'own');
    run('RenderPassesFrameSet', { Passes: passA, FrameSet: '1-2', Verbose: 1 });
    ok('RenderPassesFrameSet: Verbose 0/1 kept, else -1', S.lastJobs.jobs[0].verbose === 1);
    run('RenderPassesFrameSet', { Passes: passA, FrameSet: '1-2', Verbose: 7 });
    ok('RenderPassesFrameSet: Verbose 7 -> -1', S.lastJobs.jobs[0].verbose === -1);
    A.scene.passes.splice(A.scene.passes.indexOf(extra2), 1);
    A.select([cube]);
    r = run('RenderSelectedPasses');
    ok('RenderSelectedPasses: non-pass selection logged (XSIRENDERCORE 0x19), no pass -> error 0x1a, nothing rendered (no current-pass fallback)', S.lastJobs.jobs.length === 0 && r.log.some(l => /XSIRENDERCORE 0x19\] cube/.test(l)) && r.log.some(l => /XSIRENDERCORE 0x1a\]/.test(l)), r.log);
    A.select([passA, cube]); run('RenderSelectedPasses');
    ok('RenderSelectedPasses: the selected pass is rendered over its own range', S.lastJobs.jobs.length === 1 && S.lastJobs.jobs[0].pass === passA);
    A.select([cube]);

    // ---------------- export handlers
    reset(); const nArch = S.archives.length;
    r = run('ExportRenderArchiveFrameSet', { FrameSet: '10-12' });
    ok('ExportRenderArchiveFrameSet: export job with frames 10..12, no frame_offset / frame_total, archive record, nya log', S.lastJobs.jobs[0]?.mode === 'export' && J(S.lastJobs.jobs[0].frames) === J([10, 11, 12]) && S.lastJobs.jobs[0].frame_total === undefined && S.archives.length === nArch + 1 && nya(r), r);
    run('ExportRenderArchiveAllPasses');
    ok('ExportRenderArchiveAllPasses: every pass, own range', S.lastJobs.jobs.length === A.scene.passes.length && S.lastJobs.jobs.every(j => j.choice === 'own'));
    const fr = passA.val('FrameRangeSource');
    passA.set('FrameRangeSource', 0); passA.set('FrameStart', 2); passA.set('FrameEnd', 6); passA.set('FrameStep', 0);
    run('ExportRenderArchiveFrameSet', { Passes: passA });
    ok('Export own range source 0: start / end / step (step < 1 -> 1)', J(S.lastJobs.jobs[0].frames) === J([2, 3, 4, 5, 6]));
    passA.set('FrameRangeSource', 1); passA.set('FrameSet', '7,9');
    run('ExportRenderArchiveFrameSet', { Passes: passA });
    ok('Export own range source 1: the pass frame set', J(S.lastJobs.jobs[0].frames) === J([7, 9]));
    passA.set('FrameSet', 'bad!');
    r = run('ExportRenderArchiveFrameSet', { Passes: passA });
    ok('Export own range source 1 invalid: XSIRENDERCORE 0x37 + E_INVALIDARG', /0x80070057/.test(r.err ?? '') && r.log.some(l => /XSIRENDERCORE 0x37\]/.test(l)), r);
    passA.set('FrameRangeSource', 2); A.anim.startFrame = 3; A.anim.endFrame = 5;
    run('ExportRenderArchiveFrameSet', { Passes: passA });
    ok('Export own range source 2: timeline In / Out', J(S.lastJobs.jobs[0].frames) === J([3, 4, 5]));
    A.anim.startFrame = 1; A.anim.endFrame = 100;
    passA.set('FrameRangeSource', 9);
    ok('Export own range source 9 -> E_UNEXPECTED', /0x8000ffff/.test(run('ExportRenderArchiveFrameSet', { Passes: passA }).err ?? ''));
    passA.set('FrameRangeSource', 3);
    run('ExportRenderArchiveFrameSet', { Passes: passA });
    ok('Export own range source 3: scene render options (FrameStart 1..FrameEnd 2)', J(S.lastJobs.jobs[0].frames) === J([1, 2]));
    passA.set('FrameRangeSource', fr); passA.set('FrameSet', fsBefore); passA.set('FrameStart', 1); passA.set('FrameEnd', 100); passA.set('FrameStep', 1);
    const mt = A.modelTasksB15a;   // created by the export gate above (SIGetAppMode stand-in shared with CMD-B15a)
    if (mt) {
      mt.restricted = true;
      r = run('ExportRenderArchiveAllPasses');
      ok('Export in the restricted mode: simsgcat 0x143, status 0x80004021', /0x80004021/.test(r.err ?? '') && r.log.some(l => /simsgcat 0x143/.test(l)), r);
      mt.restricted = false;
    } else ok('restricted-mode state available', false, 'app.modelTasksB15a missing');

    // ---------------- show rendered image
    const sh0 = pref('render_pass_show_rendered_images'); const u0 = A.undoStack.length;
    r = run('RenderPassToggleShowRenderedImage');
    ok('RenderPassToggleShowRenderedImage: preference negated through SetValue, returns nothing, undoable', pref('render_pass_show_rendered_images') === !sh0 && r.v === undefined && A.undoStack.length === u0 + 1 && r.log.some(l => /SetValue "Preferences\.rendering\.render_pass_show_rendered_images"/.test(l)), r);
    A.undo();
    ok('RenderPassToggleShowRenderedImage: undo restores the preference', pref('render_pass_show_rendered_images') === sh0);

    // ---------------- overlay sync
    reset(); run('RenderRegionCreate', { Viewport: 0, Left: 0.25, Right: 0.75, Top: 0.25, Bottom: 0.75 });
    const legacy = window.__siRenderRegion;
    ok('legacy mirror (__siRenderRegion) follows the current viewport (B has none -> open false)', legacy.open === false);
    run('RenderRegionCreate'); ok('legacy mirror: current viewport region open', legacy.open === true && Math.abs(legacy.left - 0.1) < 1e-6);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset(); ro.set('FrameRangeSource', 0); ro.set('FrameEnd', 100);
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
console.log(`compare_render_b19a: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
