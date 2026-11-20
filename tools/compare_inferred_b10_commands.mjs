// CMD-B10 (inferred batch): the 91 registry commands of src/commands/inferredB10Views.ts and inferredB10Scene.ts, plus
// `Tag` (Untag's counterpart, also missing from the bus). There is no analyst note and no XSIBATCH golden for these:
// this is a contract check against the inferred behaviour written in those files.
// 2026-11-19 (CMD-B11d/g/h/i): 41 of these commands now follow the analyst's binary-read contracts; the expectations
// changed by those contracts are adjusted here (marked `B11`) and checked in detail by tools/compare_b11_b10_corrections.mjs.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a clear message instead);
//   3. the stated result of each command (return values, scene / view state, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_inferred_b10_commands.mjs
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
  'Cam3dsMaxNavigTool', 'CamDollyTool', 'CamDriveTool', 'CamFlyTool', 'CamMayaZoomTool', 'CamNavigTool', 'CamOrbitTool', 'CamPanZoomTool',
  'CamPivotTool', 'CamRectZoomTool', 'CamRollTool', 'CamTrackTool', 'CamWalkTool', 'CamZoomTool',
  'CreateFolder', 'MoveToFolder', 'NavigateNode', 'RemoveFolder', 'RemoveFromFolder', 'SetCurrentEnvironment',
  'AlignViewCamera', 'Back View', 'CameraRedo', 'CameraUndo', 'DelayedRefresh', 'Frame Contextual', 'Front View', 'GetViewIndex',
  'Hide Back Facing Polygons', 'LoadFastPlaybackCache', 'ResetAllViews', 'ResetDirectX', 'Right View', 'RunPerformanceTest',
  'SaveFastPlaybackCache', 'SetDropMessage', 'SetViewCamera', 'Show3DContextMenu', 'StartTimedPlayback', 'ToggleMuteSolo',
  'ViewNudgeDown', 'ViewNudgeLeft', 'ViewNudgeRight', 'ViewNudgeUp', 'ViewTranslate',
  'DirectManipTool', 'LastTool', 'ManipulateTool', 'RotateUVW', 'ScaleUVW', 'TimeSliderTool', 'Toggle Manipulator mode', 'Toggle Snapping',
  'TranslatePivot', 'TranslateUVW', 'VirtualSliderTool',
  'ConnectMap', 'InspectAllUVW', 'InspectUVW', 'PinAllUVComponents', 'PinUVComponents', 'UnPinAllUVComponents', 'UnPinUVComponents',
  'AddShotClip', 'GetSceneFrameSetFromCamSeq', 'GetShotClip', 'PlotCamSeqShape', 'PlotCamSeqToActions',
  'AddCustomOp', 'AddScriptedOp', 'AddScriptedOpFromFile', 'ConvertScriptedOp',
  '2D Chain Tool', '3D Chain Tool', 'AddParticleTool',
  'GenerateInfoReport', 'GetSize', 'PickDeformerByVertexTool',
  'CreateLibrary', 'MoveToLibrary', 'SetCurrentMaterialLibrary',
  'CreateAndEditCommand', 'EditCommand', 'ReconnectModel', 'Untag', 'PaintSelectTool', 'PaintTextureTool',
  'DeleteMotionDerivator', 'MoveComponent', 'InstallCustomPreferences', 'RefreshCustomPreferences',
  'Tag',
];
// Required input without a default: the default run must fail with a message naming the command.
// B11: CreateFolder / NavigateNode / GetSize / Tag / Untag require their object argument; Save / LoadFastPlaybackCache
// with an empty FileName open a file browser (treated as cancelled here) instead of failing.
const DEFAULT_FAILS = new Set(['RemoveFromFolder', 'RemoveFolder', 'SetCurrentEnvironment', 'SetViewCamera',
  'CreateFolder', 'NavigateNode', 'GetSize', 'Tag', 'Untag', 'PinUVComponents', 'UnPinUVComponents', 'PinAllUVComponents', 'UnPinAllUVComponents', 'ConnectMap', 'AddCustomOp',
  'AddScriptedOpFromFile', 'ConvertScriptedOp', 'MoveToLibrary', 'SetCurrentMaterialLibrary', 'ReconnectModel', 'InstallCustomPreferences',
  'AddShotClip']);   // CMD-B16e: Frame is required
/** Names now registered by row CMD-B16e (src/commands/b16eActioncoreOptasksGap.ts), not by this batch. */
const MOVED_B16E = ['AddShotClip', 'GetShotClip'];
/** Names now registered by row CMD-B17h (src/commands/rigsCharacB17h.ts, command.js contract), not by this batch. */
const MOVED_B17H = ['EditCommand', 'CreateAndEditCommand'];

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
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('MoveComponent') && !!window.Application?.scene?.find('cube') && !!window.__vm, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const cube = A.scene.find('cube');
  try { A.hostFs.ensureFolder('C:\\Users\\Public'); } catch (e) { out.fsErr = String(e); }
  const reset = () => { A.setTool(null); window.__navTool?.set(null); A.select([cube]); A.compSel = null; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  out.batch = { registered: [...(A.inferredB10?.registered ?? [])], skipped: [...(A.inferredB10?.skipped ?? [])] };

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const f0 = A.anim.frame; const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();   // each default run is undone so the result checks start clean
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
    A.anim.frame = f0;
  }
  reset();

  // 3. stated results
  const nt = window.__navTool; const vm = window.__vm; const vps = vm.viewports();
  // navigation tools: activate (twice stays on), the matching view-manager tool
  for (const [n, label] of [['CamOrbitTool', 'Orbit Tool'], ['CamDollyTool', 'Dolly Tool'], ['CamPanZoomTool', 'Pan & Zoom Tool'], ['CamRectZoomTool', 'Rectangular Zoom Tool'], ['CamWalkTool', 'Walk Tool'], ['CamMayaZoomTool', 'Zoom Tool']]) {
    run(n); const first = nt.get(); run(n); // CMD-B16a: re-invoking the current tool toggles it off (Interaction.stickytoggle, SPDL default on)
    ok(`${n} activates ${label}; a second call toggles it off (CMD-B16a stickytoggle)`, first === label && nt.get() === null, [first, nt.get()]);
  }
  ok('Cam3dsMaxNavigTool logs its unattested mouse mapping', nya(run('Cam3dsMaxNavigTool')) === 1);
  // auxiliary tools + LastTool
  reset(); run('VirtualSliderTool'); ok('VirtualSliderTool arms a tool', A.activeTool?.name === 'Virtual Slider Tool'); ok('auxiliary tool clears the navigation tool', nt.get() === null);
  run('CamOrbitTool'); ok('navigation tool leaves the modal tool', A.activeTool === null);
  run('TranslateTool'); run('LastTool'); ok('LastTool re-activates the last auxiliary tool (CMD-B16a: the camera tool was recorded last)', nt.get() === 'Orbit Tool', nt.get());
  reset(); run('VirtualSliderTool'); run('TranslateTool'); run('LastTool'); ok('LastTool re-activates the last auxiliary tool (Translate excluded)', A.activeTool?.name === 'Virtual Slider Tool', A.activeTool?.name); reset();
  {
    const p = cube.kinematics.local.get('posx'); A.anim.marked.clear(); A.anim.marked.add(p); const v0 = p.value;
    run('VirtualSliderTool'); const t = A.activeTool; t.onClick([0, 0, 0], null, { shift: false, ctrl: false }); t.onMove([10, 0, 0]); t.onFinish();
    ok('VirtualSliderTool slides the marked parameter by 0.1 per unit', Math.abs(p.value - (v0 + 1)) < 1e-9, p.value);
    A.undo(); ok('VirtualSliderTool undo', Math.abs(p.value - v0) < 1e-9, p.value); A.anim.marked.clear();
  }
  { const f0 = A.anim.frame; run('TimeSliderTool'); const t = A.activeTool; t.onClick([0, 0, 0], null, {}); t.onMove([5, 0, 0]); ok('TimeSliderTool scrubs the frame', A.anim.frame === Math.min(A.anim.endFrame, f0 + 5), A.anim.frame); A.anim.frame = f0; reset(); }
  { run('2D Chain Tool'); const t = A.activeTool; const before = [...A.scene.allObjects()].length; t.onClick([0, 0, 0], null, {}); t.onClick([2, 0, 0], null, {}); t.onClick([4, 1, 0], null, {}); t.onFinish();
    ok('2D Chain Tool builds a chain through Create2DSkeleton', [...A.scene.allObjects()].length > before, [...A.scene.allObjects()].length - before); A.undo(); ok('2D Chain Tool undo', [...A.scene.allObjects()].length === before); reset(); }
  { run('PaintSelectTool'); const t = A.activeTool; t.onClick([0, 0, 0], { obj: cube, kind: 'point', item: 2, worldPoint: [0, 0, 0] }, { shift: false }); t.onClick([0, 0, 0], { obj: cube, kind: 'point', item: 5, worldPoint: [0, 0, 0] }, { shift: false });
    ok('PaintSelectTool adds components', A.compSel && [...A.compSel.points].join() === '2,5', A.compSel && [...A.compSel.points]); reset(); }
  { run('ManipulateTool'); ok('ManipulateTool shows the manipulators', !A.hideManip); const a = run('Toggle Manipulator mode'); ok('Toggle Manipulator mode hides them', a.v === false && A.hideManip === true); run('Toggle Manipulator mode'); }
  { const s0 = !!window.__tool.snap?.on; const a = run('Toggle Snapping'); ok('Toggle Snapping flips snap', a.v === !s0 && !!window.__tool.snap.on === !s0); run('Toggle Snapping'); }
  { const prim = cube.primitive; const n0 = prim.operators.length; run('DirectManipTool'); const t = A.activeTool; t.onClick([0, 0, 0], { obj: cube, kind: 'point', item: 0, worldPoint: [1, 1, 1] }, {}); t.onClick([2, 1, 1], null, {});
    const op = prim.operators.find(o => o.type === 'movecomponent'); const d = op?.deltas.get(0);
    ok('DirectManipTool moves the picked point through a Move Component operator', d && Math.abs(d[0] - 1) < 1e-6, d);
    A.undo(); ok('DirectManipTool undo', !op.deltas.get(0)); A.undo(); ok('Move Component operator removed by undo', prim.operators.length === n0, prim.operators.length - n0); reset(); }

  // views
  const act = () => vps.indexOf(vm.active());
  ok('GetViewIndex = active view', run('GetViewIndex').v === act(), [run('GetViewIndex').v, act()]);
  { const vp = vm.active(); run('Back View'); ok('Back View looks from -Z', vp.camera.position.z < -50 && Math.abs(vp.camera.position.x) < 1e-6, vp.camera.position); run('Right View'); ok('Right View looks from +X', vp.camera.position.x > 50); run('Front View'); ok('Front View looks from +Z', vp.camera.position.z > 50);
    run('CameraUndo'); ok('CameraUndo returns to the previous camera', vp.camera.position.x > 50, vp.camera.position); run('CameraRedo'); ok('CameraRedo', vp.camera.position.z > 50, vp.camera.position); }
  { const i = act(); const vp = vps[i]; const r = run('AlignViewCamera', { Axis: 2, NegativeAxis: false, View: i }); const d = vp.camera.getWorldDirection(new vp.camera.position.constructor());
    ok('AlignViewCamera Axis 2 (B11: 1-based, Y) looks down -Y', !r.err && d.y < -0.99, [r.err, d]); run('AlignViewCamera', { Axis: 0, View: i }); }
  { run('ResetAllViews'); const cam = vps.find(v => v.name === 'Front'); ok('ResetAllViews resets the Front view', !cam || Math.abs(cam.camera.position.z - 100) < 1e-6, cam?.camera.position); }
  { const camObj = [...A.scene.allObjects()].find(o => o.type === 'camera'); const i = act(); const r = run('SetViewCamera', { CameraName: camObj?.name ?? '', View: i });
    const p = camObj?.globalMatrix(); ok('SetViewCamera puts the view at the camera (B11: attached, no return value)', camObj && vps[i].viewCamera === camObj.name && Math.abs(vps[i].camera.position.x - p.elements[12]) < 1e-6, [vps[i].viewCamera, r.err]); run('ResetAllViews'); }
  { const r = run('ToggleMuteSolo', { Target: 0, Mode: 0 }); ok('ToggleMuteSolo mutes view A', !r.err && vps[0].x.muted === true); run('ToggleMuteSolo', { Target: 0, Mode: 0 });
    run('ToggleMuteSolo', { Target: 1, Mode: 1 }); ok('ToggleMuteSolo solo view B', vps[1].x.solo === true); run('ToggleMuteSolo', { Target: 1, Mode: 1 }); ok('solo off', vps[1].x.solo === false); }
  { const v0 = !!vm.active().flags['Hide Back Facing Polygons']; const r = run('Hide Back Facing Polygons'); ok('Hide Back Facing Polygons toggles the view flag', !!vm.active().flags['Hide Back Facing Polygons'] === !v0 && nya(r) === 1, r); run('Hide Back Facing Polygons'); }
  { reset(); const p = cube.kinematics.local; const x0 = [p.val('posx'), p.val('posy'), p.val('posz')]; const r = run('ViewNudgeRight');
    const moved = Math.hypot(p.val('posx') - x0[0], p.val('posy') - x0[1], p.val('posz') - x0[2]);
    ok('ViewNudgeRight moves the selection a fraction of a unit (B11: one pixel, through Translate)', !r.err && moved > 0 && moved < 1, [r.err, moved]); A.undo(); ok('ViewNudgeRight undo', Math.abs(p.val('posx') - x0[0]) + Math.abs(p.val('posy') - x0[1]) + Math.abs(p.val('posz') - x0[2]) < 1e-9); }
  { A.tasksB16c.fs.ensureFolder('C:\\PerfB10'); const r = run('RunPerformanceTest', { FileName: 'C:\\PerfB10\\perf.txt', Duration: 0.05 }); ok('RunPerformanceTest measures frames (CMD-B16c: report appended to FileName, no return value)', r.v === undefined && A.inferredB10.perf.frames > 0, r); }
  { const r = run('StartTimedPlayback'); ok('StartTimedPlayback logs the elapsed milliseconds (B11: no return value)', r.v === undefined && r.log.some(l => /^StartTimedPlayback: \d+ ms$/.test(l)), r.log); }
  { const f = 'C:\\Users\\Public\\b10_cache.json'; let r = run('SaveFastPlaybackCache', { FileName: f }); const n = A.anim.endFrame - A.anim.startFrame + 1;
    ok('SaveFastPlaybackCache saves the frame list (B11: S_FALSE, no return value)', !r.err && A.inferredB10.status.SaveFastPlaybackCache === 1 && A.inferredB10.playbackCaches.get(act())?.frames.length === n, r); A.inferredB10.playbackCaches.clear();
    r = run('LoadFastPlaybackCache', { FileName: f }); ok('LoadFastPlaybackCache reads it back', !r.err && A.inferredB10.playbackCaches.get(act())?.frames.length === n, r); }
  { run('SetDropMessage', { Message: 'drop here' }); ok('SetDropMessage stores the message', A.inferredB10.dropMessage === 'drop here'); }
  { const n0 = A.inferredB10.camLabels.length; const r = run('Frame Contextual'); ok('Frame Contextual frames the selection in one view (B11)', !r.err && A.inferredB10.camLabels.length === n0 + 1 && A.inferredB10.camLabels[n0].label === 'Frame', r.err); }

  // navigation / folders / environments
  { const r = run('CreateFolder', { Target: 'cube', Name: 'Things' }); const f = r.v; ok('CreateFolder under Target (B11: Target required)', f?.name === 'Things' && cube.folders.includes(f));
    run('MoveToFolder', { Target: f, InputObjs: 'cube' }); ok('MoveToFolder', f.members.includes(cube)); A.undo(); ok('MoveToFolder undo', !f.members.includes(cube)); A.redo();
    run('RemoveFromFolder', { Target: f, InputObjs: 'cube' }); ok('RemoveFromFolder', !f.members.length); run('RemoveFolder', { InputObjs: f }); ok('RemoveFolder', !cube.folders.includes(f)); A.undo(); ok('RemoveFolder undo', cube.folders.includes(f)); }
  { const root = A.scene.root; const kids = root.children; const i = kids.indexOf(cube);   // B11: 1-based, filter = same type, not found = Source
    ok('NavigateNode 1 = parent', run('NavigateNode', { Source: 'cube', NavDirection: 1 }).v === root);
    ok('NavigateNode 0 is invalid (B11)', /status 0x80070057/.test(run('NavigateNode', { Source: 'cube', NavDirection: 0 }).err ?? ''));
    const nextAny = kids[i + 1] ?? cube;
    ok('NavigateNode 3 + NavFilter 10 = next sibling', run('NavigateNode', { Source: 'cube', NavDirection: 3, NavFilter: 10 }).v === nextAny);
    ok('NavigateNode 3 + loop + NavFilter 10 on the last sibling = first', run('NavigateNode', { Source: kids[kids.length - 1], NavDirection: 3, NavLoop: true, NavFilter: 10 }).v === kids[0]); }
  { const env = A.run('CreateEnvironment', { Name: 'EnvB10' }); run('SetCurrentEnvironment', { InputObj: env }); ok('SetCurrentEnvironment', A.scene.currentEnvironment === env); A.undo(); ok('SetCurrentEnvironment undo', A.scene.currentEnvironment !== env); }
  { reset(); const p = cube.kinematics.local; run('TranslatePivot', { X: 1, Y: 2, Z: 3 }); ok('TranslatePivot adds to the pivot', p.val('pposx') === 1 && p.val('pposz') === 3); A.undo(); ok('TranslatePivot undo', p.val('pposx') === 0); }

  // UVs
  {
    reset(); try { A.run('CreateTextureProj', { InputObjs: [cube], ProjectionName: 'B10Proj' }); } catch {}
    const proj = cube.property('uvprojection'); out.uvProj = !!proj;
    if (proj) {
      const base = Float32Array.from(proj.uvs ?? (() => { A.run('TranslateUVW', { InputObjs: 'cube', X: 0 }); const u = Float32Array.from(proj.uvs); A.undo(); return u; })());
      const before = proj.uvs; const r = run('TranslateUVW', { InputObjs: 'cube.sample[0,1]', X: 0.5, Y: 0.25 }); const after = proj.uvs;
      ok('TranslateUVW moves two samples', r.v === 2 && Math.abs(after[0] - base[0] - 0.5) < 1e-6 && Math.abs(after[3] - base[3] - 0.25) < 1e-6 && Math.abs(after[4] - base[4]) < 1e-9, r);
      A.undo(); ok('TranslateUVW undo restores', proj.uvs === before);
      const r2 = run('ScaleUVW', { InputObjs: 'cube', X: 2, Y: 2, Pivot: true, PivotU: 0, PivotV: 0 }); const s = proj.uvs; A.undo();
      ok('ScaleUVW about (0,0) doubles every UV', r2.v === base.length / 2 && s.every((x, k) => Math.abs(x - 2 * base[k]) < 1e-5), r2);
      const r3 = run('TranslateUVW', { InputObjs: 'cube.sample[0]', X: 0.3, AxesFilter: 'siU' }); ok('AxesFilter siU leaves V', Math.abs(proj.uvs[1] - base[1]) < 1e-9 && Math.abs(proj.uvs[0] - base[0] - 0.3) < 1e-6, r3); A.undo();
      const r4 = run('RotateUVW', { InputObjs: 'cube.sample[0,1]', Z: 180 }); const q = proj.uvs; A.undo();
      ok('RotateUVW 180 swaps two samples about their centre', r4.v === 2 && Math.abs(q[0] - base[2]) < 1e-5 && Math.abs(q[1] - base[3]) < 1e-5, [r4.v, q[0], base[2]]);
      const total = base.length / 2;
      run('PinUVComponents', { UVProp: 'cube', UVComponents: '0,2-3' }); ok('PinUVComponents pins samples', [...proj.pinnedSamples].sort().join() === '0,2,3', [...proj.pinnedSamples]);
      run('UnPinUVComponents', { UVProp: 'cube', UVComponents: [2] }); ok('UnPinUVComponents', [...proj.pinnedSamples].sort().join() === '0,3');
      run('PinAllUVComponents', { UVProp: 'cube' }); ok('PinAllUVComponents', proj.pinnedSamples.size === total, [proj.pinnedSamples.size, total]);
      run('UnPinAllUVComponents', { UVProp: 'cube' }); ok('UnPinAllUVComponents', proj.pinnedSamples.size === 0); A.undo(); ok('UnPinAll undo', proj.pinnedSamples.size === total);
      let inspected = 0; const off = A.events.on('inspect', () => inspected++); const ri = run('InspectUVW', { InputObjs: 'cube' }); off(); ok('InspectUVW opens one projection', ri.v === 1 && inspected === 1);
    } else ok('a texture projection could be made on the cube for the UV checks', false, 'no projection');
  }
  { const map = cube.properties[0]; const r = run('ConnectMap', { PropObj: map, Target: cube }); ok('ConnectMap stores the connection', cube.connectedMap === map && nya(r) === 1, r.err); A.undo(); ok('ConnectMap undo', !cube.connectedMap); }

  // Camera Sequencer
  {
    const cam = [...A.scene.allObjects()].find(o => o.type === 'camera');
    const c1 = run('AddShotClip', { Name: 'S1', Parent: cam?.name ?? '', Frame: 1, StartFrame: 10, EndFrame: 14 }).v;
    const c2 = run('AddShotClip', { Name: 'S2', Frame: 8, StartFrame: 50, EndFrame: 51 }).v;
    ok('AddShotClip on the scene camera sequencer', c1 && c2 && c1.start === 1 && c1.duration === 5 && c2.start === 8 && c2.duration === 2 && c1.source === (cam?.name ?? '') && A.scene.root.cameraSequencer.tracks[0].clips.length === 2, [c1, c2]);
    ok('GetSceneFrameSetFromCamSeq without gaps', JSON.stringify(run('GetSceneFrameSetFromCamSeq', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true }).v) === '[10,11,12,13,14,50,51]', run('GetSceneFrameSetFromCamSeq', { StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true }).v);
    ok('GetSceneFrameSetFromCamSeq with gaps', JSON.stringify(run('GetSceneFrameSetFromCamSeq', { StartFrame: 1, EndFrame: 9 }).v) === '[10,11,12,13,14,6,7,50,51]');
    const g = run('GetShotClip', { Frame: 3 }).v; ok('GetShotClip over S1', g.Clip === c1 && g.DirectlyOver === true && g.ActiveCamera === (cam ?? null));
    const g2 = run('GetShotClip', { Frame: 7 }).v; ok('GetShotClip in a gap = previous clip, not directly over', g2.Clip === c1 && g2.DirectlyOver === false);
    const p = run('PlotCamSeqToActions', { InputObjs: 'cube.kine.local.posx', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true });
    const src = p.v?.[0]; const fc = src ? Object.values(JSON.parse(src.val('fcurves')))[0] : null;
    ok('PlotCamSeqToActions (B11) plots one key per covered frame into an action source and returns it', Array.isArray(p.v) && p.v.length === 1 && src.type === 'actionsource' && fc?.length === 7 && nya(p) === 0, [p.err, fc?.length, p.log]);
    ok('PlotCamSeqShape (B11) returns KeyList / ClipList', run('PlotCamSeqShape', { InputObjs: 'cube', StartFrame: 1, EndFrame: 9, PlotWithoutGaps: true }).v?.KeyList?.length === 7);
    A.undo(); A.undo(); A.undo(); A.undo(); ok('AddShotClip undo', !A.scene.root.cameraSequencer.tracks.length, A.scene.root.cameraSequencer.tracks.length);
  }
  // scripted / custom ops
  {
    const prim = cube.primitive; const n0 = prim.operators.length; const geomBefore = JSON.stringify(Array.from(prim.mesh().positions.slice(0, 6)));
    const r = run('AddScriptedOp', { OutputObjs: 'cube', Code: 'function Update(ctx, out) {}', Name: 'MySop' });
    ok('AddScriptedOp connects an operator on the output', r.v?.name === 'MySop' && prim.operators.length === n0 + 1 && nya(r) >= 1, r.err);
    ok('scripted op passes geometry through', JSON.stringify(Array.from(prim.mesh().positions.slice(0, 6))) === geomBefore);
    ok('ConvertScriptedOp finds it', run('ConvertScriptedOp', { Source: 'cube' }).v === 'MySop');
    A.undo(); ok('AddScriptedOp undo', prim.operators.length === n0);
    A.hostFs.writeFile('C:\\Users\\Public\\op.py', 'def Update(ctx, out): pass');
    const f = run('AddScriptedOpFromFile', { OutputObjs: 'cube', FileName: 'C:\\Users\\Public\\op.py' }); ok('AddScriptedOpFromFile reads the file (Python by extension)', f.v?.val('Language') === 'Python' && /def Update/.test(f.v?.val('Code')), f.err); A.undo();
    const c = run('AddCustomOp', { Type: 'MyDeform', OutputObjs: 'cube' }); ok('AddCustomOp makes an operator of the type', c.v?.type === 'MyDeform'); A.undo();
  }
  // sizes
  { const r = run('GetSize', { InputObjs: 'cube' }).v; ok('GetSize static + dynamic', r.StaticSize > 0 && r.DynamicSize > 0 && r.Value === r.StaticSize + r.DynamicSize, r);
    const t = run('GenerateInfoReport', { InputObjs: 'cube', FileName: 'C:\\Users\\Public\\b10_report.txt' }).v; ok('GenerateInfoReport writes the report', /cube\t\d+\t\d+/.test(t) && A.hostFs.readFile('C:\\Users\\Public\\b10_report.txt') === t); }
  // libraries
  { const lib = run('CreateLibrary', { Name: 'MyLib' }).v; const m = A.scene.materials[0];
    run('MoveToLibrary', { InputObjs: m.name, Target: lib }); ok('MoveToLibrary', lib.items.includes(m)); A.undo(); ok('MoveToLibrary undo', !lib.items.includes(m));
    run('SetCurrentMaterialLibrary', { InputObj: lib }); ok('SetCurrentMaterialLibrary', A.scene.libraryState.current === lib); A.undo(); ok('SetCurrentMaterialLibrary undo', A.scene.libraryState.current !== lib); }
  // customization / general
  ok('EditCommand on a known command', run('EditCommand', { CommandName: 'CreatePrim' }).v === true);
  ok('EditCommand on an unknown command returns false', run('EditCommand', { CommandName: 'NoSuchCmd' }).v === false);
  { const p = cube.kinematics.local.get('posy'); run('Tag', { InputObjs: 'cube.kine.local.posy', Level: 'siTag1' }); const T = A.lockRecordsB11; const tag = () => T.get(p)?.find(r => r.type === 2)?.tagLevel ?? 0;   // B11 / batch 12: tag = lock record type 2, tag level bitmask
    ok('Tag', tag() === 1);
    run('Untag', { InputObjs: 'cube.kine.local.posy' }); ok('Untag siTagAll clears every level', !T.has(p)); A.undo(); ok('Untag undo', tag() === 1); }
  { const r = run('ReconnectModel', { Model: 'Scene_Root' }); ok('ReconnectModel logs the unattested mapping', r.v === 0 && nya(r) === 1, r.err); }
  // transform
  { reset(); const prim = cube.primitive; const n0 = prim.operators.length; const r = run('MoveComponent', { InputObjs: 'cube.pnt[0]' }); ok('MoveComponent adds a Move Component operator', r.v.CreatedObjs.length === 1 && prim.operators.length === n0 + 1);
    const r2 = run('MoveComponent', { InputObjs: 'cube.pnt[1]' }); ok('MoveComponent reuses the top one', r2.v.CreatedObjs[0] === r.v.CreatedObjs[0] && prim.operators.length === n0 + 1); A.undo(); A.undo(); ok('MoveComponent undo', prim.operators.length === n0); }
  ok('DeleteMotionDerivator without a derivator removes nothing', run('DeleteMotionDerivator', { InputObj: 'cube' }).v === 0);
  // custom preferences
  { const p = cube.properties[0]; ok('InstallCustomPreferences', run('InstallCustomPreferences', { InputObjs: p, Name: 'MyPrefs' }).v === 'MyPrefs' && A.customPreferencesB10.get('MyPrefs') === p);
    { const r = run('RefreshCustomPreferences'); ok('RefreshCustomPreferences re-reads them (CMD-B16c: no return value)', !r.err && r.v === undefined); } }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n] ?? (n === 'Tag' ? [['InputObjs', null], ['Level', ':siTagAll:siTags'], ['SubType', 3]] : null)), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
const B16A = new Set(['LastTool']); // CMD-B16a (toolsB16a.ts) owns it now
report('batch registered every name itself', got.batch.skipped.length === 0 && NAMES.filter(n => !B16A.has(n) && !MOVED_B16E.includes(n) && !MOVED_B17H.includes(n)).every(n => got.batch.registered.includes(n)), JSON.stringify(got.batch.skipped));
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_inferred_b10_commands: ${pass} ok, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
