// CMD-B19b (tasks.dll scene / clipboard / layers / loops / presets, environments.dll, selectionmgr.dll): the 30 commands
// of src/commands/tasksB19b.ts. There is no XSIBATCH golden for the row: this is a contract check against
// docs/ghidra/cmd-b19b-tasks-scene-layers-loops.md section 3 / 5 and the CMD-B19b section of docs/re/WIRE_CORRECTIONS_B19.md.
//   1. every name is registered once, with the argument list of data/command_registry.json (hidden arguments
//      included; the entry of this row's handler where a name has several) and the contract's undo flag;
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error, or fails with
//      the contract's status; the scene-destroying ones (NewScene, DeleteAll, OpenScene) run last;
//   3. the contract's stated results, and the "not yet attested ... CMD-B19b" logs of the unread branches.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tasks_b19b.mjs
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

// handler CLSID of this row per name (the registry has several entries for some names)
const HANDLER = {
  InspectLastOperator: 'ee0d5df0-58e0-11d4-bc9c-00d0b719022b', DeleteAll: '6e4d3de5-5ad1-48fa-9811-49f8be59a576', NewScene: '6e4d3de5-5ad1-48fa-9811-49f8be59a576',
  SaveScene: '973f7447-bd33-4349-9d59-d1c9cad1b3a3', OpenScene: 'fcad9bc1-645a-11d5-ad18-0090275802bf', SIGetPreset: '393c6ad2-e6b4-11d2-a02c-0000f875df68',
  RemoveFolder: 'de5fd1e2-2dc3-11d4-b6a4-006094eb029c', SelectAllComponentLoops: '14ba7973-1452-4f83-bedb-d87c9c045c29', GrowSelectedLoops: '79a24a0c-d64f-4ead-acda-d6d98178596c',
  ShrinkSelectedLoops: '2ab971bf-a7db-495d-9a3d-8973a2fb51fe', SelectPolygonOutline: '9b13ed79-f264-46ef-9982-4b025b238d02', SelectAllConnectedComponents: '35ced1f5-b9da-43d5-af12-17de288ca1db',
  SICreateLayer: '42570b11-1267-4a95-8ce0-d781ce23a79f', SICreateLayer2: '42570b11-1267-4a95-8ce0-d781ce23a79f', CreateLayerGroup: '38e33817-0836-4a54-97ee-07d0759e713c',
  MoveObjectToLayer: '8416ea77-4b04-46f3-a153-f7277562ae49', CutLayerParent: '7d1b0d6f-0815-4f0b-aa7a-cc7498015863', SetCurrentLayer: '2f76bc8f-f028-11d2-ac7c-00a02485cecb',
  SetCurrentPass: '2f76bc8f-f028-11d2-ac7c-00a02485cecb', PlotShape: '5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9', LinkDeform: '5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9',
  Cut: 'ec7663e5-2f0b-11d3-bffd-00a0248f9397', Copy: 'ec7663e4-2f0b-11d3-bffd-00a0248f9397', Paste: 'ec7663e6-2f0b-11d3-bffd-00a0248f9397',
  CopyUVW: 'a1c9cbeb-2a8e-40d5-93e1-12e142a01c94', PasteUVW: '594ea9c2-b64c-499f-9ae3-ba03147ab375', InstallCustomPreferences: '3d2d0215-acbc-4b8b-8acf-ad835041f392',
  CreateEnvironment: '98531be5-b33d-46fa-80d4-41d795584ad5', AddContainerToEnvironment: '6eed640c-73b9-4b7b-86c3-ae582eebf9cb', DeselectAllUsingFilter: '16532fa0-0c74-11d3-b8a0-080036f3cc02',
};
const NAMES = Object.keys(HANDLER);
/** Contract undo flag per command (Not undoable: scene I/O, presets, InspectLastOperator, Copy, CopyUVW). */
const NOT_UNDOABLE = ['InspectLastOperator', 'DeleteAll', 'NewScene', 'SaveScene', 'OpenScene', 'SIGetPreset', 'Copy', 'CopyUVW'];
/** Default runs that must fail, with the contract's status. */
const DEFAULT_FAILS = {
  MoveObjectToLayer: '80070057', CutLayerParent: '80070057', SetCurrentLayer: '80070057', SetCurrentPass: '80070057',
  AddContainerToEnvironment: '80070057', CopyUVW: '80004002', PasteUVW: '80004002',
};
/** Scene-destroying commands: run last. */
const LAST = ['NewScene', 'DeleteAll', 'OpenScene'];

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const r = reg.find(x => x.scripting_name === n && x.handler_clsid === HANDLER[n]);
  return [n, r ? r.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
page.on('dialog', d => d.dismiss().catch(() => {}));
page.on('filechooser', () => {});
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('DeselectAllUsingFilter') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, NOT_UNDOABLE, DEFAULT_FAILS, LAST }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
  const S = A.tasksB19b;
  const out = { reg: {}, defaults: {}, checks: [] };
  const J = v => { try { return JSON.stringify(v, (k, x) => (x && typeof x === 'object' && x.constructor?.name !== 'Object' && !Array.isArray(x) ? (x.fullName ?? x.name ?? String(x)) : x)); } catch { return String(v); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : J(detail).slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; const c0 = S.calls.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text), calls: S.calls.slice(c0) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), calls: S.calls.slice(c0) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested.*CMD-B19b/);
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cmds = r => (r.calls ?? []).map(c => c.cmd);
  const sc = () => A.scene;
  const find = n => A.scene.find(n);
  const undoTo = u => { while (A.undoStack.length > u) A.undo(); };
  const reset = () => { A.setTool?.(null); A.setSelMode('object'); A.compSel = null; const c = find('cube'); A.select(c ? [c] : []); };
  const items = () => { const c = A.compSel; if (!c) return []; return [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)]; };
  const sortN = l => [...l].sort((a, b) => a - b);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) { const d = A.commands.get(n); const want = !NOT_UNDOABLE.includes(n); ok(`${n}: ${want ? 'undoable' : 'not undoable'}`, d && (d.undoable !== false) === want, d?.undoable); }

  // 2. default runs (scene-destroying ones last)
  const order = [...NAMES.filter(n => !LAST.includes(n)), ...LAST];
  for (const n of order) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    if (!LAST.includes(n)) undoTo(u0);
    const want = DEFAULT_FAILS[n];
    out.defaults[n] = r.err ? (want && status(r, want) ? 'ok' : 'ERROR: ' + r.err) : (want ? 'UNEXPECTED-OK' : 'ok');
  }
  // fresh demo-like scene for the contract checks
  A.run('NewScene', { Confirm: false });
  const cube = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'cube' });
  const sphere = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'sphere' });
  const grid = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'grid' });
  A.undoStack.length = 0; A.redoStack.length = 0;
  reset();

  try {
    // ================= scene I/O
    {
      const n0 = [...sc().allObjects()].length;
      A.run('Translate', { InputObj: 'cube', X: 1 });   // a change: the service asks for confirmation
      S.hooks.confirmNewScene = () => false;
      let r = run('NewScene');
      ok('NewScene: Confirm default true, cancelled confirmation -> status 0x562E80C7, scene kept', S.status.NewScene === 0x562e80c7 && !!find('cube'), [S.status.NewScene, r.err]);
      S.hooks.confirmNewScene = null;
      r = run('NewScene');
      ok('NewScene: no confirmation dialog in this build -> "not yet attested ... CMD-B19b", scene emptied', nya(r) && !find('cube') && !find('grid'), r.log);
      ok('NewScene: not undoable (undo stack empty)', A.undoStack.length === 0);
      ok('NewScene: the new scene has the default camera', [...sc().allObjects()].some(o => o.type === 'camera') && [...sc().allObjects()].length < n0, [...sc().allObjects()].map(o => o.name));
      r = run('NewScene', { ProjectPathName: 'C:\\Projects\\X' });
      ok('NewScene: ProjectPathName is not read by tasks.dll (logged)', nya(r) && !r.err);
      // SaveScene to a native file, then the default scene path preference
      A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'fromDefault' });
      S.sceneFile = 'C:\\Scenes\\default_b19b.scn';
      r = run('SaveScene');
      const fsys = A.tasksB16c.fs;
      ok('SaveScene: writes the current scene file (.scn: service save)', !r.err && fsys.isFile('C:\\Scenes\\default_b19b.scn') && /fromDefault/.test(fsys.readFile('C:\\Scenes\\default_b19b.scn')) && S.status.SaveScene === 1, [r.err, r.log]);
      A.prefValues = { ...(A.prefValues ?? {}), 'data_management.default_scene_path': 'C:\\Scenes\\default_b19b.scn' };
      r = run('NewScene', { Confirm: false });
      ok('NewScene: a usable default scene path -> OpenScene sub-task opens it', !!find('fromDefault') && cmds(r).includes('OpenScene') && S.ambient.DS_SZ_SEGMENT_PATHNAME === '', [cmds(r), r.err]);
      r = run('DeleteAll', { Confirm: false });
      ok('DeleteAll: same handler as NewScene (opens the default scene too)', !!find('fromDefault') && cmds(r).includes('OpenScene'));
      A.prefValues['data_management.default_scene_path'] = 'C:\\Scenes\\missing.scn';
      r = run('NewScene', { Confirm: false });
      ok('NewScene: unusable default scene -> warning 0x422, empty scene', has(r, /WARNING.*0x422/) && !find('fromDefault'), r.log);
      r = run('DeleteAll', { Confirm: false });
      ok('DeleteAll: warning 0x422 and empty scene as well', has(r, /0x422/) && !r.err);
      A.prefValues['data_management.default_scene_path'] = '';
      // OpenScene
      r = run('OpenScene', { SceneFileName: 'C:\\Scenes\\default_b19b.scn', Confirm: false });
      ok('OpenScene: .scn -> service open, scene loaded, ambient scene name', !r.err && !!find('fromDefault') && S.ambient['c3dsceneiotask.scenename'] === 'default_b19b.scn' && S.status.OpenScene === 1, [r.err]);
      r = run('OpenScene', { SceneFileName: 'C:\\Scenes\\nope.scn', Confirm: false });
      ok('OpenScene: open failure -> status 0x562E80C7 (no error)', !r.err && S.status.OpenScene === 0x562e80c7);
      r = run('OpenScene', { SceneFileName: 'C:\\Scenes\\thing.abc', Confirm: false });
      ok('OpenScene: other extension without a custom importer -> E_INVALIDARG', status(r, '80070057'), r.err);
      const seen = [];
      S.registerCustomImporter('xyz', 'XYZ importer', (app, f) => { seen.push(f); app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'imported' }); });
      r = run('OpenScene', { SceneFileName: 'C:\\Data\\thing.xyz', Confirm: false });
      ok('OpenScene: custom importer (event 0x20510026) into a new scene; last_sequence prefs written', !r.err && seen[0] === 'C:\\Data\\thing.xyz' && !!find('imported') && !find('fromDefault') && S.events.some(e => e[0] === 0x20510026) && A.prefValues['data_management.last_sequence_name'] === 'thing.xyz' && A.prefValues['data_management.last_sequence_dir'] === 'C:\\Data', [r.err, A.prefValues]);
      A.run('Translate', { InputObj: 'imported', X: 1 }); S.hooks.confirmNewScene = () => false;
      r = run('OpenScene', { SceneFileName: 'C:\\Data\\thing.xyz' });
      ok('OpenScene: cancelled confirmation -> 0x562E80C7, no change', !r.err && S.status.OpenScene === 0x562e80c7 && !!find('imported') && seen.length === 1);
      S.hooks.confirmNewScene = null;
      // SaveScene: custom exporters
      S.sceneFile = 'C:\\Data\\out.foo';
      r = run('SaveScene');
      ok('SaveScene: other extension without a custom exporter -> E_INVALIDARG', status(r, '80070057'), r.err);
      const b11c = A.tasksB11c; let exported = null;
      b11c.registerCustomConverter('foo', 'Foo exporter', ctx => { exported = ctx.fileName; });
      r = run('SaveScene');
      ok('SaveScene: custom exporter (event 0x20510027) fired with the path', !r.err && exported === 'C:\\Data\\out.foo' && S.events.some(e => e[0] === 0x20510027));
      b11c.registerCustomConverter('bar', 'Bad exporter', () => 0x80004005); S.sceneFile = 'C:\\Data\\out.bar';
      r = run('SaveScene');
      ok('SaveScene: failure -> E_FAIL with "save failed <file>" (warning 0x439)', status(r, '80004005') && /save failed C:\\Data\\out\.bar/.test(r.err) && has(r, /0x439/), [r.err, r.log]);
      S.sceneFile = '';
    }
    A.run('NewScene', { Confirm: false });
    A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'cube' });
    A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'sphere' });
    A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'grid' });
    A.undoStack.length = 0; reset();

    // ================= SIGetPreset
    {
      let r = run('SIGetPreset');
      ok('SIGetPreset: no preset browser -> "not yet attested ... CMD-B19b", nothing chosen (S_FALSE)', nya(r) && r.v === null && S.status.SIGetPreset === 1, r.log);
      r = run('SIGetPreset', { Family: 'NoSuchFamily' });
      ok('SIGetPreset: unknown family -> E_INVALIDARG', status(r, '80070057'), r.err);
      r = run('SIGetPreset', { Family: 3 });
      ok('SIGetPreset: non-string family -> E_INVALIDARG', status(r, '80070057'), r.err);
      const asked = [];
      S.hooks.presetBrowser = (root, fam) => { asked.push([root, fam]); return 'Passes\\Mine.Preset'; };
      r = run('SIGetPreset', { Path: 'Data\\DSPresets', Family: 'siPassFamily' });
      ok('SIGetPreset: browser rooted at common root + Path, filtered on the family; chosen preset returned (PresetObj)', r.v === 'Passes\\Mine.Preset' && S.out.SIGetPreset.PresetObj === r.v && /\\Data\\DSPresets$/.test(asked[0][0]) && asked[0][1] === 'siPassFamily' && S.status.SIGetPreset === 0, asked);
      S.hooks.presetBrowser = () => null;
      r = run('SIGetPreset');
      ok('SIGetPreset: cancel -> nothing (S_FALSE)', r.v === null && S.status.SIGetPreset === 1);
      S.hooks.presetBrowser = null;
    }

    // ================= InspectLastOperator
    {
      const c = find('cube'); const ops = c.primitive.operators;
      let r = run('InspectLastOperator', { InputObjs: 'cube' });
      ok('InspectLastOperator: the last operator of the input\'s stack, InspectObj sub-task', !r.err && S.inspected[0] === ops[ops.length - 1] && cmds(r).includes('InspectObj'), [r.err, S.inspected]);
      const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'nul' }) ?? find('nul'); A.undoStack.length = 0;
      r = run('InspectLastOperator', { InputObjs: nul ? nul.name : 'nothing' });
      ok('InspectLastOperator: nothing found -> E_FAIL', status(r, '80004005'), r.err);
    }

    // ================= RemoveFolder
    {
      const c = find('cube'); A.run('CreateFolder', { Target: 'cube', Name: 'FolderX' });
      const f = (c.folders ?? []).find(x => x.name === 'FolderX');
      const u = A.undoStack.length;
      let r = run('RemoveFolder', { InputObjs: f });
      ok('RemoveFolder: the folder leaves its parent', !r.err && f && !(c.folders ?? []).includes(f), r.err);
      A.undo();
      ok('RemoveFolder: undoable', (c.folders ?? []).includes(f));
      undoTo(u);
      const u2 = A.undoStack.length;
      r = run('RemoveFolder', { InputObjs: 'sphere' });
      ok('RemoveFolder: a non-folder is ignored silently (S_FALSE, no undo entry)', !r.err && S.status.RemoveFolder === 1 && A.undoStack.length === u2);
    }

    // ================= loops, outline, island (on the grid)
    {
      const g = find('grid'); const m = g.primitive.mesh(); const P = m.positions; const nP = P.length / 3;
      const pos = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      // rows: points with the same z, ordered by x
      const zs = [...new Set(Array.from({ length: nP }, (_, i) => pos(i)[2].toFixed(4)))].sort((a, b) => a - b);
      const rowOf = z => Array.from({ length: nP }, (_, i) => i).filter(i => pos(i)[2].toFixed(4) === z).sort((a, b) => pos(a)[0] - pos(b)[0]);
      const row = rowOf(zs[Math.floor(zs.length / 2)]);
      const n = row.length;
      ok('grid: at least 5 points per row', n >= 5, n);
      const selPts = l => { A.setSelMode('point'); A.selectComponents(g, 'point', l, 'replace'); };
      // SelectAllComponentLoops: points
      selPts([row[1], row[n - 2]]);
      let u = A.undoStack.length;
      let r = run('SelectAllComponentLoops');
      ok('SelectAllComponentLoops: points -> the loop path between the selected pair', A.compSel?.kind === 'point' && J(sortN(items())) === J(sortN(row.slice(1, n - 1))) && cmds(r).includes('SelectObj'), [sortN(items()), row]);
      A.undo();
      ok('SelectAllComponentLoops: undoable through SelectObj', J(sortN(items())) === J(sortN([row[1], row[n - 2]])));
      undoTo(u);
      // edges along the row
      const ek = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
      const rowEdges = row.slice(0, -1).map((p, i) => ek(p, row[i + 1]));
      A.setSelMode('edge'); A.selectComponents(g, 'edge', [rowEdges[1], rowEdges[n - 3]], 'replace');
      r = run('SelectAllComponentLoops');
      ok('SelectAllComponentLoops: edges -> the loop edges between the pair', A.compSel?.kind === 'edge' && J(items().sort()) === J(rowEdges.slice(1, n - 2).sort()), [items(), rowEdges]);
      // polygons: the polygons of the row strip (each has two points in row and two in the next row)
      const next = rowOf(zs[Math.floor(zs.length / 2) + 1]);
      const inRow = new Set(row), inNext = new Set(next);
      const strip = m.polygons.map((f, i) => [f, i]).filter(([f]) => f.length === 4 && f.filter(v => inRow.has(v)).length === 2 && f.filter(v => inNext.has(v)).length === 2)
        .map(([f, i]) => [i, Math.min(...f.map(v => pos(v)[0]))]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
      A.setSelMode('polygon'); A.selectComponents(g, 'polygon', [strip[0], strip[strip.length - 1]], 'replace');
      r = run('SelectAllComponentLoops');
      ok('SelectAllComponentLoops: polygons -> the polygon strip between the pair', A.compSel?.kind === 'polygon' && J(sortN(items())) === J(sortN(strip)), [sortN(items()), strip]);
      selPts([row[2]]);
      r = run('SelectAllComponentLoops');
      ok('SelectAllComponentLoops: a single component (no pair) -> selection kept, logged', J(items()) === J([row[2]]) && nya(r), r.log);
      // Grow / Shrink: points
      selPts([row[1], row[2], row[3]]); u = A.undoStack.length;
      r = run('GrowSelectedLoops');
      ok('GrowSelectedLoops: points -> one more point at each end; SelectObj(input) then AddToSelection', J(sortN(items())) === J(sortN(row.slice(0, 5))) && J(cmds(r)) === J(['SelectObj', 'AddToSelection']), [sortN(items()), cmds(r)]);
      A.undo(); ok('GrowSelectedLoops: undoable', J(sortN(items())) === J(sortN(row.slice(1, 4))));
      undoTo(u);
      selPts(row.slice(0, 5));
      r = run('ShrinkSelectedLoops');
      ok('ShrinkSelectedLoops: points -> the end points removed; SelectObj(input) then RemoveFromSelection', J(sortN(items())) === J(sortN(row.slice(1, 4))) && J(cmds(r)) === J(['SelectObj', 'RemoveFromSelection']), [sortN(items()), cmds(r)]);
      // edges
      A.setSelMode('edge'); A.selectComponents(g, 'edge', [rowEdges[1], rowEdges[2]], 'replace');
      r = run('GrowSelectedLoops');
      ok('GrowSelectedLoops: edges -> one more edge at each end', J(items().sort()) === J(rowEdges.slice(0, 4).sort()), [items(), rowEdges]);
      r = run('ShrinkSelectedLoops');
      ok('ShrinkSelectedLoops: edges -> the end edges removed', J(items().sort()) === J(rowEdges.slice(1, 3).sort()), items());
      // polygons
      A.setSelMode('polygon'); A.selectComponents(g, 'polygon', [strip[1], strip[2]], 'replace');
      r = run('GrowSelectedLoops');
      ok('GrowSelectedLoops: polygons -> one more polygon at each end of the strip', J(sortN(items())) === J(sortN(strip.slice(0, 4))), [sortN(items()), strip]);
      r = run('ShrinkSelectedLoops');
      ok('ShrinkSelectedLoops: polygons -> the end polygons removed', J(sortN(items())) === J(sortN(strip.slice(1, 3))), sortN(items()));
      // SelectPolygonOutline
      A.selectComponents(g, 'polygon', [strip[1]], 'replace');
      r = run('SelectPolygonOutline');
      ok('SelectPolygonOutline: one quad -> its four edges (edge selection, SelectObj)', A.compSel?.kind === 'edge' && items().length === 4 && cmds(r).includes('SelectObj'), items());
      selPts([row[1]]);
      r = run('SelectPolygonOutline');
      ok('SelectPolygonOutline: other selections do nothing', A.compSel?.kind === 'point' && J(items()) === J([row[1]]) && !cmds(r).length);
      // island on the cube
      const c = find('cube'); A.setSelMode('polygon'); A.selectComponents(c, 'polygon', [0], 'replace'); u = A.undoStack.length;
      r = run('SelectAllConnectedComponents');
      ok('SelectAllConnectedComponents: the island of the selection (all 6 cube faces)', items().length === c.primitive.mesh().polygons.length && cmds(r).includes('SelectObj'), items());
      A.undo(); ok('SelectAllConnectedComponents: undoable', J(items()) === J([0]));
      undoTo(u);
      reset();
      r = run('SelectAllConnectedComponents');
      ok('loop commands: an object selection (no sub-components) is skipped silently', !r.err && !A.compSel && !cmds(r).length);
    }

    // ================= DeselectAllUsingFilter
    {
      const c = find('cube'), s = find('sphere');
      const cam = [...sc().allObjects()].find(o => o.type === 'camera');
      A.select([c, s, cam]); const u = A.undoStack.length;
      let r = run('DeselectAllUsingFilter', { SelFilter: 'camera' });
      ok('DeselectAllUsingFilter: object filter removes the matching items only (RemoveFromSelection)', J(A.selection.map(x => x.name)) === J(['cube', 'sphere']) && cmds(r).includes('RemoveFromSelection'), A.selection.map(x => x.name));
      A.undo(); ok('DeselectAllUsingFilter: undoable', A.selection.length === 3);
      undoTo(u);
      A.setSelMode('point'); A.selectComponents(c, 'point', [0, 1, 2], 'replace');
      r = run('DeselectAllUsingFilter', { SelFilter: 'Edge' });
      ok('DeselectAllUsingFilter: a component filter of another type keeps the point selection', items().length === 3 && !cmds(r).length);
      r = run('DeselectAllUsingFilter', { SelFilter: 'Point' });
      ok('DeselectAllUsingFilter: the point filter removes the selected points', items().length === 0 && cmds(r).includes('RemoveFromSelection'));
      r = run('DeselectAllUsingFilter', { SelFilter: 'SampledPoint' });
      ok('DeselectAllUsingFilter: SampledPoint filter -> "not yet attested ... CMD-B19b"', nya(r) && !r.err);
      reset();
    }

    // ================= layers
    {
      const L = sc().layers; const l0 = L.length; const cur0 = A.currentLayer ?? L[0];
      let r = run('SICreateLayer', { Name: 'LA' }); const LA = r.v;
      ok('SICreateLayer: creates and returns one layer in the layer container, named Name; current layer and selection unchanged', LA?.name === 'LA' && L.includes(LA) && L.length === l0 + 1 && (A.currentLayer ?? L[0]) === cur0 && J(A.selection.map(x => x.name)) === J(['cube']), [LA?.name, L.length]);
      r = run('SICreateLayer', { Name: 'LA' });
      ok('SICreateLayer: no name uniquifying in the task', r.v?.name === 'LA' && r.v !== LA, r.v?.name);
      A.undo(); ok('SICreateLayer: undoable', !L.includes(r.v) && L.includes(LA));
      r = run('SICreateLayer', { PresetObj: 'Shaders\\Material\\Phong.Preset', Name: 'LP' });
      ok('SICreateLayer: a non-layer preset -> warning 0x419, nothing created', has(r, /0x419/) && !r.err && L.length === l0 + 1 && r.v === null, r.log);
      r = run('SICreateLayer', { PresetObj: null });
      ok('SICreateLayer: missing PresetObj -> E_INVALIDARG', status(r, '80070057'), r.err);
      r = run('SICreateLayer2', { Name: 'LB', LayerGroupName: 'Nope' }); const LB = r.v;
      ok('SICreateLayer2: LayerGroupName is read but not used (top level, no error)', !r.err && LB?.name === 'LB' && L.includes(LB) && !LB.parentLayer, r.err);
      // CreateLayerGroup
      r = run('CreateLayerGroup'); const LG = r.v;
      ok('CreateLayerGroup: a layer named "LayerGroup" made by an SICreateLayer sub-task', LG?.type === 'layer' && LG.name === 'LayerGroup' && L.includes(LG) && J(cmds(r)) === J(['SICreateLayer']), [LG?.name, cmds(r)]);
      r = run('CreateLayerGroup', { InputObj: LA, Name: 'GroupA' }); const GA = r.v;
      ok('CreateLayerGroup: InputObj is moved into the new layer (MoveObjectToLayer sub-task)', GA?.name === 'GroupA' && LA.parentLayer === GA && J(cmds(r)) === J(['SICreateLayer', 'MoveObjectToLayer']), [cmds(r), LA.parentLayer?.name]);
      A.undo(); ok('CreateLayerGroup: undoable (layer and move undone together)', !L.includes(GA) && !LA.parentLayer);
      r = run('CreateLayerGroup', { InputObj: 'cube', Name: 'GroupC' });
      ok('CreateLayerGroup: an object InputObj goes to the new layer', find('cube').layer === r.v, find('cube').layer?.name);
      A.undo();
      // MoveObjectToLayer
      r = run('MoveObjectToLayer', { Target: 'cube', InputObjs: 'sphere' });
      ok('MoveObjectToLayer: no layer in Target -> E_INVALIDARG', status(r, '80070057'), r.err);
      r = run('MoveObjectToLayer', { Target: [find('cube'), LB, LA], InputObjs: 'sphere' });
      ok('MoveObjectToLayer: the first layer of Target receives the input', find('sphere').layer === LB && LB.members.has(find('sphere')) && !r.err, find('sphere').layer?.name);
      A.undo(); ok('MoveObjectToLayer: undoable', find('sphere').layer !== LB);
      r = run('MoveObjectToLayer', { Target: [LB], InputObjs: [LA] });
      ok('MoveObjectToLayer: a layer input is nested under the target layer', LA.parentLayer === LB);
      r = run('MoveObjectToLayer', { Target: [LA], InputObjs: [LB] });
      ok('MoveObjectToLayer: a refused (cyclic) layer move logs warning 0x41a', has(r, /0x41a/) && !LB.parentLayer, r.log);
      // CutLayerParent
      r = run('CutLayerParent', { InputObjs: 'cube' });
      ok('CutLayerParent: no layer in InputObjs -> E_INVALIDARG', status(r, '80070057'), r.err);
      A.run('MoveObjectToLayer', { Target: [LB], InputObjs: [LG] });
      r = run('CutLayerParent', { InputObjs: [find('cube'), LA, LG] });
      ok('CutLayerParent: only the first layer of the list is taken out of its parent layer', !LA.parentLayer && LG.parentLayer === LB && !r.err, [LA.parentLayer?.name, LG.parentLayer?.name]);
      A.undo(); ok('CutLayerParent: undoable', LA.parentLayer === LB);
      // SetCurrentLayer / SetCurrentPass
      const u = A.undoStack.length;
      r = run('SetCurrentLayer', { Value: 'LA' });
      ok('SetCurrentLayer: Value becomes the current layer', !r.err && A.currentLayer === LA, r.err);
      A.undo(); ok('SetCurrentLayer: undoable (previous current layer back)', A.currentLayer !== LA);
      r = run('SetCurrentLayer', { Value: 'cube' });
      ok('SetCurrentLayer: wrong object kind -> E_FAIL', status(r, '80004005'), r.err);
      r = run('SetCurrentLayer', { Value: sc().passes[0] });
      ok('SetCurrentLayer: a pass is the wrong kind for Type 1 -> E_FAIL', status(r, '80004005'), r.err);
      const pass = A.run('CreatePass', { Name: 'PB' }); const ev0 = A.tasksB11a.events.length;
      r = run('SetCurrentPass', { Value: pass });
      const evs = A.tasksB11a.events.slice(ev0).map(e => e[0]);
      ok('SetCurrentPass: Value becomes the current pass, events 0x20510029 / 0x2051002a', !r.err && sc().currentPass === pass && J(evs) === J([0x20510029, 0x2051002a]), [r.err, evs]);
      r = run('SetCurrentPass', { Value: LA });
      ok('SetCurrentPass: a layer is the wrong kind -> E_FAIL', status(r, '80004005'), r.err);
      undoTo(u);
    }

    // ================= PlotShape / LinkDeform (script-backed)
    {
      let r = run('PlotShape', { InputObj: 'cube' });
      ok('PlotShape: script not read -> "not yet attested ... CMD-B19b"', nya(r) && !r.err);
      r = run('LinkDeform');
      ok('LinkDeform: script not read -> "not yet attested ... CMD-B19b", nothing linked', nya(r) && !r.err && r.v === null);
    }

    // ================= Copy / Cut / Paste
    {
      reset(); const u = A.undoStack.length;
      let r = run('Copy');
      ok('Copy: the selection goes on the clipboard (copy + commit), not undoable', J(S.clipboard.items.map(x => x.name)) === J(['cube']) && J(cmds(r)) === J(['clipboard.copy', 'clipboard.commit']) && A.undoStack.length === u, cmds(r));
      r = run('Paste');
      const copy = (S.out.Paste?.pasted ?? [])[0];
      ok('Paste: empty InputObjs -> pasted under the scene root model', copy && copy !== find('cube') && copy.parentObj === sc().root && !r.err, [r.err, copy?.name]);
      A.undo(); ok('Paste: undoable', copy && !sc().root.children.includes(copy));
      r = run('Paste', { InputObjs: 'sphere' });
      const c2 = (S.out.Paste?.pasted ?? [])[0];
      ok('Paste: under each target', c2 && c2.parentObj === find('sphere'), c2?.parentObj?.name);
      undoTo(u);
      A.select([]);
      r = run('Cut');
      ok('Cut: empty list -> E_INVALIDARG (message 0x78)', status(r, '80070057') && /0x78/.test(r.err), r.err);
      reset(); const cube = find('cube');
      r = run('Cut');
      ok('Cut: copy + undoable delete', !find('cube') && S.clipboard.cut && S.clipboard.items[0] === cube && cmds(r).includes('DeleteObj'));
      r = run('Paste');
      ok('Paste after Cut: the cut object comes back under the root', find('cube') === cube && cube.parentObj === sc().root, find('cube')?.name);
      A.undo(); A.undo();
      ok('Cut / Paste: undo restores the scene', find('cube') === cube);
      undoTo(u);
    }

    // ================= CopyUVW / PasteUVW
    {
      reset(); const c = find('cube');
      A.run('CreateProjection', { InputObjs: [c], Type: 'Planar XY' });
      const p = c.allProperties().find(x => x.type === 'uvprojection');
      ok('CreateProjection made a uvprojection property (test setup)', !!p);
      if (p) {
        let r = run('CopyUVW', { TextureProjection: p });
        ok('CopyUVW: no SubComp -> the UVs of the projection\'s whole cluster are stored (not undoable)', !r.err && S.uvClipboard?.kind === 'cluster' && S.uvClipboard.samples.length === c.primitive.mesh().polygons.reduce((n, f) => n + f.length, 0), r.err);
        r = run('CopyUVW', { TextureProjection: p, SubComp: 'cube.poly[0]' });
        ok('CopyUVW: SubComp -> the sub-component variant (samples of the polygon)', S.uvClipboard?.kind === 'subcomponent' && S.uvClipboard.samples.length === c.primitive.mesh().polygons[0].length, S.uvClipboard);
        const clip = S.uvClipboard;
        const u = A.undoStack.length;
        r = run('PasteUVW', { TextureProjection: p, SubComp: 'cube.poly[1]' });
        const uvs = p.uvs; const s1 = clip.samples.length;
        ok('PasteUVW: writes the stored UVs onto the target samples', !r.err && uvs && Math.abs(uvs[(clip.samples[0] + s1) * 2] - clip.uvs[0]) < 1e-6, r.err);
        A.undo(); ok('PasteUVW: undoable', A.undoStack.length === u);
        r = run('PasteUVW', { TextureProjection: p, PasteUVsMode: 2 });
        ok('PasteUVW: a non-default PasteUVsMode -> "not yet attested ... CMD-B19b"', nya(r));
        undoTo(u);
      }
      const r = run('CopyUVW', { TextureProjection: 'cube' });
      ok('CopyUVW: TextureProjection that is not a projection -> E_NOINTERFACE', status(r, '80004002'), r.err);
    }

    // ================= InstallCustomPreferences
    {
      reset(); const c = find('cube');
      A.run('SIAddProp', { PresetObj: 'CustomProperty', InputObjs: 'cube', PropertyName: 'MyPrefs' });
      const custom = c.properties.find(x => x.type === 'customparamset');
      const u = A.undoStack.length; const fsys = A.tasksB16c.fs;
      let r = run('InstallCustomPreferences', { InputObjs: custom, Name: 'B19bPrefs' });
      const saved = (r.calls ?? []).find(x => x.cmd === 'SavePreset')?.args?.[1] ?? '';
      const files = /\\Data\\Preferences\\B19bPrefs\.Preset$/.test(saved) && fsys.isFile(saved) ? [saved] : [];
      ok('InstallCustomPreferences: preset file <UserPath>\\Data\\Preferences\\<Name>.Preset, registered, original deleted', !r.err && r.v === 1 && files.length === 1 && A.customPreferencesB10?.get('B19bPrefs') === custom && !c.properties.includes(custom), [r.err, r.v, files, custom?.name]);
      ok('InstallCustomPreferences: preset description "Custom Preferences Set"', files.length && /Custom Preferences Set/.test(fsys.readFile(files[0])));
      undoTo(u);
      ok('InstallCustomPreferences: undoable (property back, file removed, not registered)', c.properties.includes(custom) && !(files.length && fsys.isFile(files[0])) && !A.customPreferencesB10?.has('B19bPrefs'));
      r = run('InstallCustomPreferences', { InputObjs: 'sphere' });
      ok('InstallCustomPreferences: nothing to install -> warning 0x429', has(r, /0x429/) && !r.err && r.v === 0, r.log);
      undoTo(u);
    }

    // ================= environments
    {
      const u = A.undoStack.length;
      let r = run('CreateEnvironment');
      const env = r.v;
      ok('CreateEnvironment: a new environment named "Environment" in the environment container, returned', env && /^Environment/.test(env.name) && S.environments.includes(env) && S.out.CreateEnvironment.Environment === env, env?.name);
      r = run('AddContainerToEnvironment', { Environment: env });
      const ct = r.v;
      ok('AddContainerToEnvironment: container "MyGroup" of type "Default" (3D-object support) added to the environment and returned', ct?.name === 'MyGroup' && ct.type === 'Default' && ct.support3DObject === true && env.simulationEnvironment.containers.includes(ct), ct);
      r = run('AddContainerToEnvironment', { Environment: env, Type: 'Force', Support3DObject: false, Name: 'Forces' });
      ok('AddContainerToEnvironment: Type / Support3DObject / Name', r.v?.type === 'Force' && r.v.support3DObject === false && r.v.name === 'Forces');
      A.undo(); ok('AddContainerToEnvironment: undoable', env.simulationEnvironment.containers.length === 1);
      r = run('AddContainerToEnvironment', { Environment: 'cube' });
      ok('AddContainerToEnvironment: Environment that is not an environment -> E_INVALIDARG', status(r, '80070057'), r.err);
      undoTo(u);
      ok('CreateEnvironment: undoable', !S.environments.includes(env) && !sc().root.children.includes(env));
    }

    // ================= UI wiring
    ok('keymap / Edit menu Cut goes through the Cut command', !!A.commands.get('Cut'));
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 400)); }
  reset();
  return out;
}, { NAMES, NOT_UNDOABLE, DEFAULT_FAILS, LAST });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_tasks_b19b: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
