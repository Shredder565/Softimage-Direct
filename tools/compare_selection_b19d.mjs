// CMD-B19d (selectionmgr.dll selection commands, mcp.dll transport, vm.dll Center / Isolate / FrameContextual,
// toolbarobj.dll SwitchToolbar, rendercore.dll RenderRegionSave, siuitasks.dll ShowFaceRobotActPanel): the 39 commands of
// src/commands/selectionB19d.ts and src/commands/renderRegionSaveB19d.ts.
// There is no XSIBATCH golden for the row: this is a contract check against section 3 of
// docs/ghidra/cmd-b19d-selection-playback-isolate.md and items 1-16 of docs/re/WIRE_CORRECTIONS_B19.md (CMD-B19d).
//   1. every name is registered with the registry argument list (data/command_registry.json, first entry of the
//      scripting name, output-only `Value` arguments left out; defaults from data/commands_full.json where the registry
//      has none - the commands_full argument lists of these entries are shifted / filtered, so the registry is used);
//   2. every command runs with its default arguments on the ?demo scene without an error, except RenderRegionSave,
//      which must fail with E_ABORT when no render region is shown (contract 3.11);
//   3. the contract's stated results (selection lists, filters, active elements, ambient values, tool activation,
//      transport behaviour and undo, view centring / framing labels, isolation lists and undo, module switching, region
//      file names / preference / logs, Face Robot act panel path checks, "not yet attested ... CMD-B19d" logs).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_selection_b19d.mjs
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
  'SelectAll', 'SelectAllUsingFilter', 'SelectMembers', 'SetAndToggleSelection',
  'SelectObjectFilter', 'SelectVertexFilter', 'SelectPolygonFilter', 'SelectEdgeFilter', 'SelectSampledPointFilter',
  'ActivatePolygonSelTool', 'ActivatePolygonSelToolWithNoObjStateChange', 'ActivateRaycastPolySelTool', 'ActivateRaycastPolySelToolWithNoObjStateChange',
  'ActivateVertexSelTool', 'ActivateVertexSelToolWithNoObjStateChange', 'ActivateEdgeSelTool', 'ActivateEdgeSelToolWithNoObjStateChange',
  'ActivateRaycastEdgeSelTool', 'ActivateRaycastEdgeSelToolWithNoObjStateChange', 'ActivateTipSelTool', 'ActivateObjectSelToolWithNoObjStateChange', 'ActivateSelectTool',
  'PrevFrame', 'PlayFrame', 'PlayRealTime', 'PlaybackStop', 'PlayBackwards', 'PlayRealTimeFromStart', 'PlayBackwardsFromEnd',
  'FrameContextual', 'CenterSelection', 'IsolateSelected', 'IsolateAddSelected', 'IsolateRemoveSelected', 'IsolateToggleSelected', 'IsolateAll',
  'SwitchToolbar', 'RenderRegionSave', 'ShowFaceRobotActPanel',
];
if (NAMES.length !== 39) { console.error(`expected 39 names, got ${NAMES.length}`); process.exit(2); }
const DEFAULT_FAILS = { RenderRegionSave: 0x80004004 };
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n); if (!c) return [n, null];
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? (a.vt === 72 ? fd[a.name] ?? null : fd[a.name] ?? null)])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.selB19dApi && !!window.Application?.scene?.find('cube') && !!window.__vm, null, { timeout: 60000 });
await page.waitForTimeout(800);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false; A.renderRegionSaveDownload = false; A.userPrefs ??= {};
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m); return { v, log: L.filter(l => l.kind !== 'cmd').map(l => l.text), status: A.selB19d?.status?.[n] }; } catch (e) { return { err: String(e?.message ?? e), code: e?.status, log: A.log.slice(m).map(l => l.text), status: A.selB19d?.status?.[n] }; } };
  const nya = (r) => (r.log ?? []).some(l => /not yet attested/.test(l) && /CMD-B19d/.test(l));
  const J = JSON.stringify;
  const S = () => A.selB19d;
  const VM = window.__vm; const vps = () => VM.viewports(); const act = () => VM.active();
  const cube = A.scene.find('cube'), sph = A.scene.find('sphere');
  const names = (l) => l.map(n => n.name);
  const selNames = () => J(names(A.selection));
  const tm = A.toolManager; const SELECT = '11778840-8c5c-11d1-84b5-00aa00135f7b';
  const reset = () => {
    A.anim.stop(); A.select([cube]); A.compSel = null; A.activeElements = []; A.selFilter = 'Object'; A.selMode = 'object';
    if (A.selB19d) { A.selB19d.tags = []; A.selB19d.subTasks = []; }
    for (const vp of vps()) if (vp.x) { vp.x.isolate = null; vp.x.region = null; vp.x.regionImg = null; vp.x.hidden = false; }
    A.module = 'Model';
  };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = DEFAULT_FAILS[n] !== undefined ? (r.err && r.code === DEFAULT_FAILS[n] ? 'ok' : `expected failure 0x${DEFAULT_FAILS[n].toString(16)}, got ${r.err ?? 'success'}`) : r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();

  try {
    const API = A.selB19dApi;
    // ================= SelectAll / SelectAllUsingFilter (3.2, corrections 1-2)
    const allObjs = [...A.scene.allObjects()].filter(o => o !== A.scene.root);
    const vis = cube.property('visibility')?.get('viewvis'); const vis0 = vis?.value;
    if (vis) vis.value = false;
    let r = run('SelectAll');
    ok('SelectAll: every scene object (no visibility test), Value = the list', !r.err && J(names(A.selection).sort()) === J(names(allObjs).sort()) && Array.isArray(r.v) && r.v.length === allObjs.length, [r.err, names(A.selection)]);
    if (vis) vis.value = vis0;
    A.undo(); ok('SelectAll: undo = the SelectObj sub-task', selNames() === J(['cube']));
    r = run('SelectAll', { AffectSelectionList: false });
    ok('SelectAll AffectSelectionList=False: only returns the list', selNames() === J(['cube']) && r.v.length === allObjs.length);
    const sv = sph.property('visibility')?.get('selectability');
    if (sv) { sv.value = false; r = run('SelectAll', { CheckObjectSelectability: true }); ok('SelectAll CheckObjectSelectability: unselectable objects are dropped', !A.selection.includes(sph) && A.selection.includes(cube)); sv.value = true; }
    r = run('SelectAll', { SelFilter: 'nonsense_filter' });
    ok('SelectAll: an unresolved SelFilter fails the command', !!r.err);
    r = run('SelectAllUsingFilter', { SelFilter: 'camera' });
    ok('SelectAllUsingFilter object-type filter: only the accepted objects', !r.err && A.selection.length > 0 && A.selection.every(o => o.type === 'camera'), names(A.selection));
    reset(); A.activeElements = [cube]; A.selection = []; A.selMode = 'polygon'; A.selFilter = 'Polygon';
    const npoly = cube.primitive.mesh().polygons.length;
    r = run('SelectAllUsingFilter', { SelFilter: 'polygon' });
    ok('SelectAllUsingFilter component filter: all polygons of the active objects', !r.err && A.compSel?.obj === cube && A.compSel.kind === 'polygon' && A.compSel.polygons.size === npoly && /^cube\.poly\[/.test(r.v[0]), [r.err, A.compSel?.polygons?.size, r.v]);
    ok('SelectAllUsingFilter: default CheckComponentVisibility is siIgnoreComponentVisibility', A.commands.get('SelectAllUsingFilter').args.find(x => x.name === 'CheckComponentVisibility').default === ':siIgnoreComponentVisibility:siComponentVisibilityMode');
    // hidden polygons
    A.select([]); A.selectComponents(cube, 'polygon', [0, 1]); A.run('CreateCluster', {}); const inv = cube.clusters[cube.clusters.length - 1]; const invName = inv?.name; if (inv) inv.name = 'InvisiblePolygons';
    A.compSel = null; A.selection = []; A.activeElements = [cube];
    r = run('SelectAllUsingFilter', { SelFilter: 'polygon', CheckComponentVisibility: ':siCheckComponentVisibility:siComponentVisibilityMode' });
    ok('SelectAllUsingFilter siCheckComponentVisibility: hidden polygons left out', A.compSel?.polygons.size === npoly - 2 && !A.compSel.polygons.has(0), A.compSel?.polygons?.size);
    r = run('SelectAllUsingFilter', { SelFilter: 'polygon' });
    ok('SelectAllUsingFilter siIgnoreComponentVisibility: hidden polygons included', A.compSel?.polygons.size === npoly);
    if (inv) { inv.name = invName; }
    reset(); A.activeElements = []; A.selection = []; A.selMode = 'point';
    r = run('SelectAllUsingFilter', { SelFilter: 'vertex' });
    ok('SelectAllUsingFilter component filter with no active object: nothing', !r.err && Array.isArray(r.v) && r.v.length === 0 && !A.compSel);
    reset(); r = run('SelectAllUsingFilter', { SelFilter: 'SampledPoint' });
    ok('SelectAllUsingFilter SampledPoint: not yet attested log', !r.err && nya(r));

    // ================= SelectMembers (3.3, correction 3)
    reset(); A.select([cube, sph]); const grp = A.run('CreateGroup', {});
    A.select([grp]); A.userPrefs.SI3D_GROUP_SEL_MODE = true;
    r = run('SelectMembers');
    ok('SelectMembers: groups replaced by their members (current selection when no list), Value', !r.err && J(names(A.selection).sort()) === J(['cube', 'sphere']) && r.v.length === 2, [r.err, names(A.selection)]);
    ok('SelectMembers: SI3D_GROUP_SEL_MODE := false', A.userPrefs.SI3D_GROUP_SEL_MODE === false);
    reset(); A.select([]); A.selectComponents(cube, 'point', [0, 1, 2]); A.run('CreateCluster', {}); const pc = cube.clusters[cube.clusters.length - 1];
    reset(); A.select([pc]);
    r = run('SelectMembers', { SelectionList: [pc] });
    ok('SelectMembers: only point clusters -> filter Point, the cluster elements selected', !r.err && A.selMode === 'point' && A.compSel?.obj === cube && A.compSel.points.size === 3 && /^cube\.pnt\[0,1,2\]$/.test(r.v[0]), [r.err, A.selMode, r.v]);
    reset(); r = run('SelectMembers', { SelectionList: [pc, sph] });
    ok('SelectMembers: a mix keeps the filter', !r.err && A.selMode === 'object' && A.selection.includes(sph));
    reset(); r = run('SelectMembers', { SelectionList: [grp], AffectSelectionList: false });
    ok('SelectMembers AffectSelectionList=False: only returns the members', selNames() === J(['cube']) && r.v.length === 2);
    r = run('SelectMembers', { SelectionList: 'no_such_thing' });
    ok('SelectMembers: an unresolved SelectionList fails', !!r.err);

    // ================= SetAndToggleSelection (3.1, correction 6)
    reset();
    r = run('SetAndToggleSelection', { SelectionList: 'cube', HierarchyLevel: 4 });
    ok('SetAndToggleSelection: HierarchyLevel 4 -> E_INVALIDARG', r.code === 0x80070057, r);
    r = run('SetAndToggleSelection', { SelectionList: 'cube', HierarchyLevel: 9 });
    ok('SetAndToggleSelection: HierarchyLevel outside 0..7 -> E_INVALIDARG', r.code === 0x80070057, r);
    r = run('SetAndToggleSelection', { SelectionList: 'cube', HierarchyLevel: 'bogus' });
    ok('SetAndToggleSelection: a non-level HierarchyLevel -> E_INVALIDARG', r.code === 0x80070057, r);
    ok('SetAndToggleSelection: SupportPostSelectionScript registered', A.commands.get('SetAndToggleSelection').args.some(x => x.name === 'SupportPostSelectionScript'));
    reset(); A.select([cube]);
    r = run('SetAndToggleSelection', { SelectionList: 'cube,sphere' });
    ok('SetAndToggleSelection: listed + selected dropped, the rest deselected, unlisted selected', !r.err && selNames() === J(['sphere']) && r.status === 0, [r.err, selNames()]);
    A.undo(); ok('SetAndToggleSelection: undoable', selNames() === J(['cube']));
    reset(); A.select([]);
    r = run('SetAndToggleSelection', { SelectionList: '' });
    ok('SetAndToggleSelection: nothing changed -> 0x562e80c7', !r.err && r.status === 0x562e80c7, r);
    reset(); A.select([]); A.selectComponents(cube, 'point', [0, 1]);
    r = run('SetAndToggleSelection', { SelectionList: 'cube.pnt[1,2]' });
    ok('SetAndToggleSelection: component indices compared index by index', A.compSel?.obj === cube && J([...A.compSel.points].sort()) === J([2]), A.compSel && [...A.compSel.points]);
    r = run('SetAndToggleSelection', { SelectionList: 'cube', HierarchyLevel: 'BRANCH' });
    ok('SetAndToggleSelection: named hierarchy levels expand (BRANCH)', !r.err && A.selection.includes(cube));

    // ================= Select*Filter (3.5, correction 4)
    reset(); A.select([cube]);
    r = run('SelectVertexFilter');
    ok('SelectVertexFilter: filter Point, selected object becomes an active element', !r.err && A.selMode === 'point' && A.selFilter === 'Point' && J(names(A.activeElements)) === J(['cube']), [r.err, A.selMode, names(A.activeElements)]);
    ok('SelectVertexFilter (DeselectOnNewFilter): the object is removed from the selection', A.selection.length === 0 && !A.compSel, selNames());
    ok('SelectVertexFilter: ActivateElements + RemoveFromSelection sub-tasks', S().subTasks.some(t => t.task === 'ActivateElements') && S().subTasks.some(t => t.task === 'RemoveFromSelection'));
    A.selectComponents(cube, 'point', [3, 4]);
    r = run('SelectObjectFilter');
    ok('SelectObjectFilter: active objects added to the selection, active list cleared, components removed', !r.err && A.selMode === 'object' && selNames() === J(['cube']) && !A.compSel && A.activeElements.length === 0, [selNames(), A.compSel, names(A.activeElements)]);
    r = run('SelectVertexFilter');
    ok('SelectVertexFilter again: previously tagged points selected', A.compSel?.obj === cube && J([...A.compSel.points].sort()) === J([3, 4]), A.compSel && [...A.compSel.points]);
    A.undo();
    ok('Select*Filter undo: the previous filter and selection come back', A.selMode === 'object' && selNames() === J(['cube']) && A.activeElements.length === 0, [A.selMode, selNames()]);
    reset(); A.select([cube]);
    r = run('SelectPolygonFilter', { DeselectOnNewFilter: false });
    ok('Select*Filter DeselectOnNewFilter=False: selection kept, object active', A.selMode === 'polygon' && A.selection.includes(cube) && A.activeElements.includes(cube));
    reset(); r = run('SelectEdgeFilter', { SelFilter: '' });
    ok('Select*Filter without a filter: S_FALSE, nothing done', !r.err && r.status === 1 && A.selMode === 'object');
    reset(); r = run('SelectSampledPointFilter');
    ok('SelectSampledPointFilter: filter SampledPoint, not yet attested picking log', !r.err && A.selFilter === 'SampledPoint' && nya(r));
    reset(); A.select([cube, sph]);
    r = run('SelectObjectFilter', { SelFilter: 'camera' });
    ok('object-type filter with DeselectOnNewFilter: objects it rejects are removed', !r.err && !A.selection.includes(cube));

    // ================= Activate...SelTool (3.6, correction 5)
    reset(); A.select([cube]); delete A.userPrefs.SI3D_RECTSEL_REGION_MODE;
    r = run('ActivateRaycastPolySelTool');
    ok('ActivateRaycastPolySelTool: filter Polygon, SI3D_RECTSEL_REGION_MODE 2, selection tool current', !r.err && A.selMode === 'polygon' && A.userPrefs.SI3D_RECTSEL_REGION_MODE === 2 && tm.current() === SELECT && window.__tool?.mode === 'select', [r.err, A.selMode, A.userPrefs.SI3D_RECTSEL_REGION_MODE, tm.current()]);
    ok('ActivateRaycastPolySelTool: DeselectOnNewFilter removes the object', A.selection.length === 0 && A.activeElements.includes(cube));
    ok('Activate...SelTool: the component-family test logs not yet attested', nya(r));
    r = run('ActivatePolygonSelTool');
    ok('ActivatePolygonSelTool: SI3D_RECTSEL_REGION_MODE 1', A.userPrefs.SI3D_RECTSEL_REGION_MODE === 1);
    reset(); A.select([cube]);
    r = run('ActivateVertexSelToolWithNoObjStateChange');
    ok('...WithNoObjStateChange: the object selection is kept', A.selMode === 'point' && A.selection.includes(cube));
    r = run('ActivateEdgeSelTool', { SelRegionMode: 7 });
    ok('Activate...SelTool SelRegionMode outside 1..6 -> E_INVALIDARG', r.code === 0x80070057, r);
    reset(); A.select([cube]); A.run('SelectVertexFilter'); A.userPrefs.SI3D_GROUP_SEL_MODE = true;
    r = run('ActivateObjectSelToolWithNoObjStateChange');
    ok('ActivateObjectSelToolWithNoObjStateChange from a component filter: object filter, GroupMode false', !r.err && A.selMode === 'object' && A.userPrefs.SI3D_GROUP_SEL_MODE === false && A.selection.includes(cube), [r.err, A.selMode]);
    reset(); A.selFilter = 'camera';
    r = run('ActivateObjectSelToolWithNoObjStateChange');
    ok('ActivateObjectSelToolWithNoObjStateChange from an object filter: the filter is kept', A.selFilter === 'camera');
    reset(); r = run('ActivateTipSelTool');
    ok('ActivateTipSelTool: filter Tip, not yet attested picking', !r.err && A.selFilter === 'Tip' && nya(r));
    reset(); A.run('TranslateTool'); r = run('ActivateSelectTool');
    ok('ActivateSelectTool: the selection tool 11778840 through the activate-tool task', !r.err && tm.current() === SELECT && S().subTasks.some(t => t.task === 'ActivateTool' && t.detail === SELECT), tm.current());
    const u1 = A.undoStack.length; r = run('ActivateSelectTool');
    ok('ActivateSelectTool when the tool is current: no new activation', !r.err && A.undoStack.length === u1 && tm.current() === SELECT);
    // key-held (supra) call
    reset(); A.select([cube]); A.userPrefs.SI3D_GROUP_SEL_MODE = true; const u2 = A.undoStack.length;
    A.toolExecContext = { A: 0x4 | 0x2, B: 0 }; r = run('ActivateObjectSelToolWithNoObjStateChange');
    ok('key-held call: S_FALSE, no undo record, GroupMode applied', !r.err && r.status === 1 && A.undoStack.length === u2 && A.userPrefs.SI3D_GROUP_SEL_MODE === false, [r, A.undoStack.length - u2]);
    A.toolExecContext = { A: 0x4, B: 0 }; r = run('ActivateObjectSelToolWithNoObjStateChange');
    ok('key released: SI3D_GROUP_SEL_MODE restored', !r.err && A.userPrefs.SI3D_GROUP_SEL_MODE === true);
    A.userPrefs.SI3D_GROUP_SEL_MODE = false; A.groupMode = false;

    // ================= transport (3.7, corrections 7-9)
    const an = A.anim; const st = an.startFrame, en = an.endFrame; const loop0 = an.loopMode;
    const rs = () => { an.stop(); an.loopMode = 'loop'; an.dir = 1; an.frame = 10; };
    rs(); an.frame = st; r = run('PrevFrame');
    ok('PrevFrame: at the start with the range flag -> end', !r.err && an.frame === en, an.frame);
    rs(); an.loopMode = 'once'; an.frame = st; r = run('PrevFrame');
    ok('PrevFrame: no clamping at the start without the range flag', an.frame === st - 1, an.frame);
    rs(); const u3 = A.undoStack.length; r = run('PrevFrame');
    ok('PrevFrame: back by one, undoable (player state restored)', an.frame === 9 && A.undoStack.length === u3 + 1);
    A.undo(); ok('PrevFrame undo: the frame comes back', an.frame === 10);
    ok('PrevFrame: Type / Transport registered', J(A.commands.get('PrevFrame').args.map(x => x.name)) === J(['Type', 'Transport']));
    rs(); r = run('PrevFrame', { Transport: 1 });
    ok('Transport 1 (sequence player): nothing, not yet attested', an.frame === 10 && nya(r));
    rs(); an.frame = en; r = run('PlayFrame');
    ok('PlayFrame stopped at the end while stepping forwards: direction reversed, plays every frame', an.playing && an.dir === -1 && an.playMode?.realtime === false, [an.playing, an.dir, an.playMode]);
    r = run('PlayFrame');
    ok('PlayFrame while playing: stop, reverse, play again', an.playing && an.dir === 1);
    rs(); an.dir = -1; an.frame = 20; r = run('PlayFrame');
    ok('PlayFrame stopped in the middle: plays in the current direction', an.playing && an.dir === -1);
    rs(); r = run('PlaybackStop'); ok('PlaybackStop: stopped', !an.playing);
    A.prefValues = A.prefValues ?? {}; A.prefValues['Interaction.realtimeplaybackrate'] = 50;
    rs(); an.frame = en; r = run('PlayRealTime');
    ok('PlayRealTime: at the end -> start, rate preference 50% -> real time at 0.5', an.playing && an.playMode?.realtime === true && Math.abs(an.playMode.speed - 0.5) < 1e-9 && an.frame <= st + 2, [an.frame, an.playMode]);
    r = run('PlayRealTime'); ok('PlayRealTime while playing: stops', !an.playing);
    A.prefValues['Interaction.realtimeplaybackrate'] = 100;
    rs(); r = run('PlayRealTime'); ok('PlayRealTime rate 100: real time at speed 1', an.playing && an.playMode?.speed === 1); an.stop();
    rs(); an.frame = st; r = run('PlayBackwards');
    ok('PlayBackwards stopped at the start: jumps to the end, direction negative', an.playing && an.dir === -1 && an.frame >= en - 2, [an.frame, an.dir]);
    r = run('PlayBackwards'); ok('PlayBackwards while playing: stops', !an.playing);
    rs(); an.frame = 30; r = run('PlayRealTimeFromStart');
    ok('PlayRealTimeFromStart: from the start, real time', an.playing && an.playMode?.realtime === true && an.frame <= st + 2, an.frame);
    r = run('PlayRealTimeFromStart'); ok('PlayRealTimeFromStart while playing: stops', !an.playing);
    rs(); r = run('PlayBackwardsFromEnd');
    ok('PlayBackwardsFromEnd: from the end, backwards, every frame', an.playing && an.dir === -1 && an.frame >= en - 2 && an.playMode?.realtime === false, an.frame);
    r = run('PlayBackwardsFromEnd'); ok('PlayBackwardsFromEnd while playing: stops (an undo entry)', !an.playing && A.undoStack[A.undoStack.length - 1]?.label === 'PlayBackwardsFromEnd');
    A.undo(); ok('transport undo: the saved player state is written back (playing again)', an.playing && an.dir === -1); an.stop();
    API.transportType(0); // keep the API reachable
    an.loopMode = loop0; an.stop(); an.dir = 1; an.frame = 1;

    // ================= FrameContextual / CenterSelection (3.4, 3.8, correction 13)
    reset(); A.inferredB10 ??= { camLabels: [] }; const labels0 = A.inferredB10.camLabels.length;
    VM.setActive(1);
    r = run('FrameContextual', { AllViews: false, View: 0 });
    ok('FrameContextual AllViews=False: one view, camera bracket "Frame"', !r.err && A.inferredB10.camLabels.slice(labels0).some(l => l.view === 0 && l.label === 'Frame'), A.inferredB10?.camLabels?.slice(labels0));
    const l1 = A.inferredB10.camLabels.length; r = run('FrameContextual');
    ok('FrameContextual default: every 3D view', !r.err && A.inferredB10.camLabels.length - l1 === vps().length);
    const tgt = () => VM.orbitTarget().toArray();
    const l2 = A.inferredB10.camLabels.length; const vp1 = vps()[1]; const d0 = vp1.camera.position.distanceTo(VM.orbitTarget());
    r = run('CenterSelection', { AllViews: false, View: 1 });
    ok('CenterSelection AllViews=False: label "Center" in the view camera history', !r.err && A.inferredB10.camLabels.slice(l2).some(l => l.view === 1 && l.label === 'Center'));
    ok('CenterSelection: no zoom (camera distance to the target kept)', Math.abs(vp1.camera.position.distanceTo(VM.orbitTarget()) - d0) < 1e-6);
    r = run('CenterSelection', { AllObjects: true, AllViews: false, View: 1 });
    ok('CenterSelection AllObjects=True: centres on all objects, no not-yet-attested log', !r.err && !nya(r) && Array.isArray(tgt()));
  } catch (e) { ok('block 1 threw', false, String(e?.stack ?? e).slice(0, 400)); }

  try {
    // ================= Isolate (3.9, corrections 10-12)
    reset(); VM.setActive(1); const v = () => vps()[1].x.isolate; const v0 = () => vps()[0].x.isolate;
    const viewvis = cube.property('visibility')?.get('viewvis')?.value;
    A.select([cube]); let r = run('IsolateSelected');
    ok('IsolateSelected: the active view isolation list := the selection', !r.err && v() && v().size === 1 && v().has(cube), r.err);
    ok('IsolateSelected: no viewvis parameter written, no Force argument', cube.property('visibility')?.get('viewvis')?.value === viewvis && sph.property('visibility')?.get('viewvis')?.value !== false && !A.commands.get('IsolateSelected').args.some(x => x.name === 'Force'));
    A.select([sph]); r = run('IsolateAddSelected'); ok('IsolateAddSelected: adds', v()?.size === 2);
    A.select([cube]); r = run('IsolateRemoveSelected'); ok('IsolateRemoveSelected: removes', v()?.size === 1 && v().has(sph));
    A.select([cube, sph]); r = run('IsolateToggleSelected'); ok('IsolateToggleSelected: toggles', v()?.size === 1 && v().has(cube));
    A.undo(); ok('Isolate undo: the previous list comes back', v()?.size === 1 && v().has(sph));
    vps()[0].x.isolate = new Set([sph]);
    r = run('IsolateAll'); ok('IsolateAll: clears the isolation of that one view only', !r.err && v() === null && v0()?.has(sph));
    vps()[0].x.isolate = null;
    A.select([cube]); r = run('IsolateAddSelected'); ok('IsolateAddSelected without isolation: starts it with the selection', v()?.size === 1 && v().has(cube));
    vps()[1].x.isolate = null; r = run('IsolateRemoveSelected'); ok('IsolateRemoveSelected without isolation: cleared', v() === null && !r.err);
    A.select([]); A.selectComponents(sph, 'point', [0]); r = run('IsolateToggleSelected'); ok('Isolate: components count as their object', v()?.has(sph) && v().size === 1);
    reset(); A.select([cube, sph]); const grp = A.run('CreateGroup', {}); A.select([grp]); r = run('IsolateSelected'); ok('Isolate: groups count as their members', v()?.size === 2);
    reset(); A.select([]); A.activeElements = [cube]; r = run('IsolateSelected'); ok('Isolate: empty selection falls back to the active elements', v()?.has(cube));
    reset(); A.select([]); vps()[1].x.isolate = new Set([cube]); r = run('IsolateSelected'); ok('Isolate: an empty result clears isolation', v() === null);
    r = run('IsolateSelected', { View: 7 }); ok('Isolate: view index > 3 -> E_INVALIDARG', r.code === 0x80070057, r);
    r = run('IsolateAll', { View: 0 }); ok('IsolateAll View=0: that view', !r.err);

    // ================= SwitchToolbar (3.10, correction 14)
    reset(); r = run('SwitchToolbar', { Target: 2 }); ok('SwitchToolbar 2: Animate, no return value', A.module === 'Animate' && r.v === undefined);
    r = run('SwitchToolbar', { Target: 6 }); ok('SwitchToolbar 6: Hair', A.module === 'Hair');
    r = run('SwitchToolbar', { Target: 7 }); ok('SwitchToolbar 7: not a module, unchanged', A.module === 'Hair' && !r.err);
    r = run('SwitchToolbar', { Target: 0 }); ok('SwitchToolbar 0: unchanged', A.module === 'Hair');
    r = run('SwitchToolbar', { Target: 4 }); ok('SwitchToolbar 4: ICE', A.module === 'ICE');
    A.module = 'Model';

    // ================= RenderRegionSave (3.11, correction 15)
    reset(); const fs = A.renderRegionSaveB19d.hostFs; fs.ensureFolder('C:\\b19d');
    r = run('RenderRegionSave', { FileName: 'C:\\b19d\\none.png' });
    ok('RenderRegionSave: no region shown -> E_ABORT with XSIRENDERCORE 4 warning', r.code === 0x80004004 && r.log.some(l => /WARNING/.test(l) && /XSIRENDERCORE message 4/.test(l)), r);
    const mk = (vp) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8); vp.x.region = { x: 1, y: 1, w: 8, h: 8 }; vp.x.regionImg = c; };
    VM.setActive(1); mk(vps()[1]);
    r = run('RenderRegionSave', { FileName: 'C:\\b19d\\shot.jpg' });
    ok('RenderRegionSave: one region -> FileName as is, log 5', !r.err && fs.isFile('C:\\b19d\\shot.jpg') && r.log.some(l => /XSIRENDERCORE message 5 \(B, C:\\b19d\\shot\.jpg\)/.test(l)), r);
    ok('RenderRegionSave: extension written to rendering.default_savepicture_filetype', A.prefValues['rendering.default_savepicture_filetype'] === '.jpg');
    ok('RenderRegionSave: Viewport / WaitUntilComplete registered', J(A.commands.get('RenderRegionSave').args.map(x => x.name)) === J(['Viewport', 'FileName', 'WaitUntilComplete']));
    mk(vps()[0]); mk(vps()[1]);
    r = run('RenderRegionSave', { Viewport: ':siViewportAll:siViewport', FileName: 'C:\\b19d\\all.png' });
    ok('RenderRegionSave all: several regions -> <name>_A.png, <name>_B.png', !r.err && fs.isFile('C:\\b19d\\all_A.png') && fs.isFile('C:\\b19d\\all_B.png'), fs.listFiles('C:\\b19d'));
    vps()[0].x.hidden = true; mk(vps()[0]); mk(vps()[1]);
    r = run('RenderRegionSave', { Viewport: ':siViewportAll:siViewport', FileName: 'C:\\b19d\\vis' });
    ok('RenderRegionSave: hidden regions dropped; one region, no extension', !r.err && fs.isFile('C:\\b19d\\vis') && !fs.isFile('C:\\b19d\\vis_A'));
    mk(vps()[1]); r = run('RenderRegionSave', { FileName: 'C:\\missing_folder\\x.png' });
    ok('RenderRegionSave: a write failure logs XSIRENDERCORE 6 and the command succeeds', !r.err && r.log.some(l => /XSIRENDERCORE message 6/.test(l)));
    r = run('RenderRegionSave', { Viewport: 0, FileName: 'C:\\b19d\\v0.png' });
    ok('RenderRegionSave Viewport 0 with a hidden region: E_ABORT', r.code === 0x80004004);
    reset();

    // ================= ShowFaceRobotActPanel (3.12, correction 16)
    r = run('ShowFaceRobotActPanel', { Path: '' });
    ok('ShowFaceRobotActPanel: empty Path -> E_UNEXPECTED', r.code === 0x8000ffff, r);
    r = run('ShowFaceRobotActPanel', { Path: '$NO_SUCH_VARIABLE\\x.htm' });
    ok('ShowFaceRobotActPanel: unresolvable Path -> E_UNEXPECTED', r.code === 0x8000ffff, r);
    r = run('ShowFaceRobotActPanel');
    ok('ShowFaceRobotActPanel default: path resolved ($FACEROBOTROOT), offsets kept, S_FALSE, tool activated', !r.err && r.status === 1 && /FaceRobotContext\.htm$/.test(S().actPanel?.path ?? '') && !/\$/.test(S().actPanel.path) && S().actPanel.offsetX === 3 && S().actPanel.offsetY === 335 && nya(r), [r, S().actPanel]);
    ok('ShowFaceRobotActPanel: the panel arguments reach the view', A.__faceRobotActArgs?.OffsetY === 335);
  } catch (e) { ok('block 2 threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS });

// playback over time: backward playback wraps inside the play range (core player, src/core/animation.ts)
const timed = await page.evaluate(async () => {
  const A = window.Application; const an = A.anim; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const res = [];
  an.stop(); an.loopMode = 'loop'; A.run('SetPlayRange', { Start: 1, End: 4 }); an.fps = 120;
  A.run('PlayBackwardsFromEnd'); const seen = []; for (let i = 0; i < 12; i++) { await sleep(60); seen.push(an.frame); }
  res.push(['PlayBackwardsFromEnd: backward playback loops inside the play range', an.playing && seen.every(f => f >= 1 && f <= 4) && new Set(seen).size > 1, JSON.stringify(seen)]);
  A.run('PlaybackStop'); an.loopMode = 'once'; an.frame = 4; A.run('PlayBackwards'); await sleep(400);
  res.push(['PlayBackwards in "once" loop mode: stops at the first frame', !an.playing && an.frame === 1, JSON.stringify([an.playing, an.frame])]);
  an.stop(); an.loopMode = 'loop'; an.fps = 30; A.run('SetPlayRange', { Start: 1, End: 100 }); an.dir = 1; an.frame = 30;
  A.run('PlayRealTime'); await sleep(400); res.push(['PlayRealTime: the frame advances', an.frame > 30, String(an.frame)]); A.run('PlaybackStop'); an.frame = 1;
  return res;
});
got.checks.push(...timed);

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_selection_b19d: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
