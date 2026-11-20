// CMD-B17a: the 23 script commands of selection.vbs / layers.vbs. No XSIBATCH golden exists: this is a contract check
// against section 3 ("Wire contract") of docs/ghidra/cmd-b17a-selection-layers-scripts.md and the cmd-b17a section of
// docs/re/WIRE_CORRECTIONS_B17.md:
//   1. every command is registered once, with the registry argument list (data/command_registry.json, script entry,
//      hidden arguments included; data/commands_full.json omits the hidden PropertyName / ThreeState / Value ones);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an error;
//   3. the contract's stated results: selection / filter / parameter effects and the sub-command sequence
//      (app.cmdB17a.calls).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_selection_layers_b17a.mjs
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

const NAMES = ['ConvertSelection', 'ConvertSelectionToEdges', 'ConvertSelectionToPoints', 'ConvertSelectionToPolygons', 'GetNeighborSubcomponents',
  'GrowSelection', 'ShrinkSelection', 'SelectAdjacent', 'SelectNSidedPolygons', 'SelectEdgeLoop', 'SelectBoundaryEdgeLoop', 'SelectParallelEdgeLoop',
  'MakeAllUnselectable', 'HideUnselected', 'MoveToLayer', 'SICreateLayerFromSelection', 'SICreateLayerFromSelection2', 'SIHideObjects', 'SIUnhideObjects',
  'ToggleCurrentLayerProperty', 'ToggleGhosting', 'UnghostAll', 'UnhideAll'];
const SCRIPT = '5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9';
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const r = reg.find(x => x.scripting_name === n && x.handler_clsid === SCRIPT);   // first script entry (menu overloads share one name)
  return [n, r ? { args: r.args.map(a => [a.name, a.default ?? null]), label: r.name, category: r.category } : null];
}));
// commands_full.json is the registry without the flag-0x1 (hidden) arguments: its list must be a sub-sequence
const catalogue = Object.fromEntries(NAMES.map(n => { const f = full.find(x => (x.scripting_name || x.name) === n && x.name === registry[n]?.label); return [n, f ? f.args.map(a => a.name) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('UnhideAll') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const J = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && x.constructor?.name !== 'Object' && !Array.isArray(x) ? (x.name ?? String(x)) : x));
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : J(detail).slice(0, 500)]);
  const run = (n, a = {}) => { const m = A.log.length; const c0 = A.cmdB17a?.calls.length ?? 0; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text), calls: (A.cmdB17a?.calls ?? []).slice(c0) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), calls: (A.cmdB17a?.calls ?? []).slice(c0) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const cmds = r => (r.calls ?? []).map(c => c.cmd);
  const cube = A.scene.find('cube'), sphere = A.scene.find('sphere'), rnull = A.scene.find('root_null');
  const undoTo = u => { while (A.undoStack.length > u) A.undo(); };
  const reset = () => { A.session?.cancel?.(); A.miscDsScripts?.session?.cancel(); A.setSelMode('object'); A.compSel = null; A.select([cube]); };
  const items = () => { const c = A.compSel; if (!c) return null; const l = [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)]; return l.sort((x, y) => typeof x === 'number' ? x - y : String(x).localeCompare(String(y))); };
  const comp = () => A.compSel ? { obj: A.compSel.obj.name, kind: A.compSel.kind, items: items() } : null;
  const selComp = (str) => { reset(); A.run('SelectGeometryComponents', { SelectionList: str }); };
  const sorted = l => [...l].sort((x, y) => typeof x === 'number' ? x - y : String(x).localeCompare(String(y)));
  const ek = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const vis = (o, p = 'viewvis') => o.property('visibility').val(p);
  const setV = (o, p, v) => { o.property('visibility').get(p).value = v; };
  // mesh tables of the cube
  const cm = cube.primitive.mesh();
  const cEdges = []; { const seen = new Set(); for (const f of cm.polygons) for (let i = 0; i < f.length; i++) { const k = ek(f[i], f[(i + 1) % f.length]); if (!seen.has(k)) { seen.add(k); cEdges.push(k); } } }
  const polysAt = (m, v) => m.polygons.map((f, i) => f.includes(v) ? i : -1).filter(i => i >= 0);
  const P0 = cm.polygons[0];
  const ring0 = sorted([...new Set(P0.flatMap(v => polysAt(cm, v)))].filter(i => i !== 0));

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? { args: d.args.map(a => [a.name, a.default ?? null]), label: d.label, category: d.category } : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n); A.miscDsScripts?.session?.cancel(); undoTo(u0);
    out.defaults[n] = r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();

  // ================= ConvertSelection*
  try {
    selComp('cube.poly[0]'); let r = run('ConvertSelectionToPoints');
    ok('ConvertSelectionToPoints: polygon -> its points (incidence), filter Point; SelectObj then SetSelFilter', J(comp()) === J({ obj: 'cube', kind: 'point', items: sorted(P0) }) && A.selFilter === 'Point' && J(cmds(r)) === J(['SelectObj', 'SetSelFilter']), [comp(), cmds(r)]);
    selComp('cube.pnt[0]'); run('ConvertSelectionToPolygons');
    ok('ConvertSelectionToPolygons: point -> the polygons holding it (siAdjacent across dimensions, inferred incidence)', J(items()) === J(polysAt(cm, 0)) && A.compSel.kind === 'polygon', comp());
    selComp('cube.edge[0]'); run('ConvertSelectionToPolygons');
    const e0 = cEdges[0]; const e0p = cm.polygons.map((f, i) => f.some((v, j) => ek(v, f[(j + 1) % f.length]) === e0) ? i : -1).filter(i => i >= 0);
    ok('ConvertSelectionToPolygons: edge -> its 2 polygons', J(items()) === J(e0p), [items(), e0p]);
    selComp('cube.edge[0,3]'); run('ConvertSelectionToEdges');
    ok('ConvertSelectionToEdges: items already of the wanted type are kept as is', J(items()) === J(sorted([cEdges[0], cEdges[3]])), items());
    selComp('cube.poly[0]'); r = run('ConvertSelection', { SelFilter: 'Object' });
    ok('ConvertSelection: a filter other than Point / Edge / Polygon converts nothing: empty SelectObj clears the selection, SetSelFilter still called (Q3 inferred)', !r.err && A.compSel === null && A.selection.length === 0 && J(cmds(r)) === J(['SelectObj', 'SetSelFilter']) && A.selMode === 'object', [comp(), cmds(r)]);
    reset(); r = run('ConvertSelectionToEdges');
    ok('ConvertSelectionToEdges on an object selection: empty result clears the selection', !r.err && A.selection.length === 0 && A.selFilter === 'Edge', [A.selection.length, A.selFilter]);
    // cluster expansion (2.1)
    reset(); A.selectComponents(cube, 'polygon', [1, 2]); A.setSelMode('polygon'); const cl = A.run('CreateCluster', { Name: 'b17cls' }); reset();
    A.userPrefs = { ...(A.userPrefs ?? {}), SI3D_GROUP_SEL_MODE: 1 };
    r = run('ConvertSelectionToPoints', { InputObjs: [cl] });
    ok('ConvertSelectionToPoints on a cluster: SI3D_GROUP_SEL_MODE set to 0, SelectMembers, then the members converted', A.userPrefs.SI3D_GROUP_SEL_MODE === 0 && cmds(r)[0] === 'SetUserPref' && cmds(r)[1] === 'SelectMembers' && J(items()) === J(sorted([...new Set([...cm.polygons[1], ...cm.polygons[2]])])), [cmds(r), items()]);
    const ci = cube.clusters.indexOf(cl); if (ci >= 0) cube.clusters.splice(ci, 1);
  } catch (e) { ok('ConvertSelection block threw', false, String(e?.stack ?? e)); }

  // ================= GetNeighborSubcomponents
  try {
    selComp('cube.poly[0]'); let r = run('GetNeighborSubcomponents');
    ok('GetNeighborSubcomponents defaults: empty SelFilter -> nothing queried, Nothing; selection unchanged', r.v === null && J(items()) === J([0]) && A.cmdB17a.out.GetNeighborSubcomponents.Value === null, r);
    r = run('GetNeighborSubcomponents', { SelFilter: 'Polygon' });
    ok('GetNeighborSubcomponents same type, NeighborType 0 (taken as siAdjacent, logged Q1): the ring without the item', J(r.v) === J([`cube.poly[${ring0.join(',')}]`]) && nya(r) && J(items()) === J([0]), r);
    r = run('GetNeighborSubcomponents', { InputObjs: 'cube.poly[0]', NeighborType: 'siGrow', SelFilter: 'Polygon' });
    ok('GetNeighborSubcomponents siGrow: the item plus its ring, no nya', J(r.v) === J([`cube.poly[${sorted([0, ...ring0]).join(',')}]`]) && !nya(r), r);
    r = run('GetNeighborSubcomponents', { InputObjs: 'cube.poly[0]', NeighborType: 7, SelFilter: 'Point' });
    ok('GetNeighborSubcomponents other type: the neighbour type is not passed (cross-dimension query)', J(r.v) === J([`cube.pnt[${sorted(P0).join(',')}]`]) && !nya(r), r);
    r = run('GetNeighborSubcomponents', { InputObjs: 'cube.poly[0]', NeighborType: 7, SelFilter: 'Polygon' });
    ok('GetNeighborSubcomponents unknown numeric type, same dimension: logged, not queried -> Nothing', r.v === null && nya(r), r);
    r = run('GetNeighborSubcomponents', { InputObjs: 'cube.poly[0]', SelFilter: 'Sample' });
    ok('GetNeighborSubcomponents: a geometry type other than Point / Edge / Polygon -> Nothing', r.v === null && !r.err, r);
    r = run('GetNeighborSubcomponents', { InputObjs: 'cube.poly[0],sphere.pnt[0]', SelFilter: 'Edge' });
    ok('GetNeighborSubcomponents: one new item per input item, on each object', Array.isArray(r.v) && r.v.length === 2 && r.v[0].startsWith('cube.edge[') && r.v[1].startsWith('sphere.edge['), r.v);
  } catch (e) { ok('GetNeighborSubcomponents block threw', false, String(e?.stack ?? e)); }

  // ================= SelectAdjacent
  try {
    selComp('cube.poly[0]'); let r = run('SelectAdjacent');
    ok('SelectAdjacent defaults: no SelFilter -> nothing found, no change at all', J(comp()) === J({ obj: 'cube', kind: 'polygon', items: [0] }) && cmds(r).length === 0, [comp(), cmds(r)]);
    r = run('SelectAdjacent', { SelFilter: 'Polygon' });
    ok('SelectAdjacent Polygon: SelectObj the ring, then SetSelFilter', J(items()) === J(ring0) && J(cmds(r)) === J(['SelectObj', 'SetSelFilter']), [items(), cmds(r)]);
    selComp('cube.poly[0]'); r = run('SelectAdjacent', { SelFilter: 'Polygon', ExtendSelection: true });
    ok('SelectAdjacent ExtendSelection: AddToSelection keeps the original', J(items()) === J(sorted([0, ...ring0])) && cmds(r)[0] === 'AddToSelection', [items(), cmds(r)]);
    reset(); r = run('SelectAdjacent', { InputObjs: 'cube.pnt[0]', SelFilter: 'Edge' });
    ok('SelectAdjacent Edge from a point: its 3 edges, edge filter', J(items()) === J(sorted(cEdges.filter(k => k.split('-').includes('0')))) && A.selMode === 'edge', comp());
  } catch (e) { ok('SelectAdjacent block threw', false, String(e?.stack ?? e)); }

  // ================= GrowSelection / ShrinkSelection
  try {
    selComp('cube.poly[0]'); let r = run('GrowSelection');
    ok('GrowSelection: polygon grows by its ring (siGrow), filter unchanged', J(items()) === J(sorted([0, ...ring0])) && !cmds(r).includes('SetSelFilter'), [items(), cmds(r)]);
    reset(); A.setSelMode('point'); r = run('GrowSelection', { InputObjs: 'cube.pnt[0]' });
    ok('GrowSelection point: the point and its 3 neighbours', items().length === 4 && items().includes(0), items());
    reset(); r = run('GrowSelection', { InputObjs: 'cube.pnt[0],cube.poly[0]' });
    ok('GrowSelection mixed types: points then polygons, each SelectObj replaces -> only the polygon set stays (correction)', cmds(r).filter(c => c === 'SelectObj').length === 2 && A.compSel?.kind === 'polygon' && J(items()) === J(sorted([0, ...ring0])), [cmds(r), comp()]);
    selComp(`cube.poly[${sorted([0, ...ring0]).join(',')}]`); r = run('ShrinkSelection');
    ok('ShrinkSelection: Invert, Grow, Invert -> the 5 grown polygons shrink back to one', J(items()) === J([0]) && J(cmds(r).slice(0, 4)) === J(['InvertSelection', 'GrowSelection', 'SelectObj', 'InvertSelection']), [items(), cmds(r)]);
    selComp('cube.poly[0]'); run('ShrinkSelection');
    ok('ShrinkSelection: a single polygon of a cube shrinks to nothing', J(items()) === J([]), items());
    selComp('cube.poly[0,1,2,3,4,5]'); r = run('ShrinkSelection');
    ok('ShrinkSelection: closed full selection stays (no boundary edges, nothing removed)', J(items()) === J([0, 1, 2, 3, 4, 5]) && !cmds(r).includes('RemoveFromSelection'), [items(), cmds(r)]);
    // grid: boundary components are always dropped
    A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'b17grid' }); const grid = A.scene.find('b17grid'); const gm = grid.primitive.mesh();
    const gE = []; { const seen = new Map(); gm.polygons.forEach((f, pi) => f.forEach((v, j) => { const k = ek(v, f[(j + 1) % f.length]); if (!seen.has(k)) { seen.set(k, []); gE.push(k); } seen.get(k).push(pi); })); out.gEP = Object.fromEntries(seen); }
    const borderE = gE.filter(k => out.gEP[k].length === 1); const borderP = [...new Set(borderE.flatMap(k => k.split('-').map(Number)))];
    const allP = gm.polygons.map((_, i) => i);
    selComp(`b17grid.poly[${allP.join(',')}]`); r = run('ShrinkSelection');
    const borderPolys = [...new Set(borderE.flatMap(k => out.gEP[k]))];
    ok('ShrinkSelection grid, all polygons: every polygon on a boundary edge removed (RemoveFromSelection)', J(items()) === J(sorted(allP.filter(i => !borderPolys.includes(i)))) && cmds(r).includes('RemoveFromSelection'), [items()?.length, cmds(r)]);
    selComp(`b17grid.pnt[${[...Array(gm.positions.length / 3).keys()].join(',')}]`); run('ShrinkSelection');
    ok('ShrinkSelection grid, all points: boundary points removed', items().length === gm.positions.length / 3 - borderP.length && !items().some(v => borderP.includes(v)), items()?.length);
    out.grid = { gE, borderE };
    // ================= edge loops (pick sessions)
    const S = () => A.miscDsScripts.session;
    const gx = v => Math.round(gm.positions[v * 3] * 1e4), gz = v => Math.round(gm.positions[v * 3 + 2] * 1e4);
    const xs = [...new Set([...Array(gm.positions.length / 3).keys()].map(gx))].sort((a, b) => a - b), zs = [...new Set([...Array(gm.positions.length / 3).keys()].map(gz))].sort((a, b) => a - b);
    const ends = k => k.split('-').map(Number);
    const zMid = zs[4];
    const rowZ = z => gE.filter(k => ends(k).every(v => gz(v) === z));
    const eMid = rowZ(zMid).find(k => Math.min(...ends(k).map(gx)) === xs[3]);
    const idx = k => gE.indexOf(k);
    reset(); r = run('SelectEdgeLoop', { InputObjs: 'cube.edge[0]' });
    ok('SelectEdgeLoop: input ignored, a pick session starts with the id 1132 prompt (two spaces)', !r.err && S()?.active && S().filter === 'Edge' && S().prompt === 'Select EdgeLoop  (supports Shift/Ctrl)' && S().middlePrompt === S().prompt && A.compSel === null && cmds(r).includes('PickElement'), [r.err, S()?.prompt]);
    S().pick(`b17grid.edge[${idx(eMid)}]`, 1, 0);
    ok('SelectEdgeLoop pick, no modifier: SelectObj of the whole row loop, Edge filter', A.compSel?.obj === grid && J(items()) === J(sorted(rowZ(zMid))) && A.selMode === 'edge', [items()?.length, rowZ(zMid).length]);
    const zOther = zs[2]; const e2 = rowZ(zOther)[0];
    S().pick(`b17grid.edge[${idx(e2)}]`, 1, 1);
    ok('SelectEdgeLoop Shift: AddToSelection', J(items()) === J(sorted([...rowZ(zMid), ...rowZ(zOther)])), items()?.length);
    S().pick(`b17grid.edge[${idx(e2)}]`, 1, 2);
    ok('SelectEdgeLoop Ctrl: ToggleSelection', J(items()) === J(sorted(rowZ(zMid))), items()?.length);
    S().pick({ obj: grid, item: eMid }, 2, 3);
    ok('SelectEdgeLoop Shift+Ctrl (middle button too): RemoveFromSelection', J(items()) === J([]), items());
    const borderRow = rowZ(zs[0]);
    S().pick(`b17grid.edge[${idx(borderRow[2])}]`, 1, 0);
    ok('SelectEdgeLoop on a border edge: follows the border row, stops at the corner', J(items()) === J(sorted(borderRow)), [items()?.length, borderRow.length]);
    S().pick(`cube.edge[0]`, 1, 0);
    ok('SelectEdgeLoop on a cube: 3-edge points have no matching edge -> only the picked edge', J(comp()) === J({ obj: 'cube', kind: 'edge', items: [cEdges[0]] }), comp());
    S().pick(null, 0, 0);
    ok('SelectEdgeLoop: button 0 (right click / Esc) ends the command', !S(), !!S());
    reset(); run('SelectBoundaryEdgeLoop'); S().pick(`b17grid.edge[${idx(borderRow[2])}]`, 1, 0);
    ok('SelectBoundaryEdgeLoop: the whole border, turning the 2-edge corners', J(items()) === J(sorted(borderE)), [items()?.length, borderE.length]);
    S().pick(`b17grid.edge[${idx(eMid)}]`, 1, 0);
    ok('SelectBoundaryEdgeLoop on an inner edge: the inner row loop', J(items()) === J(sorted(rowZ(zMid))), items()?.length);
    S().cancel();
    reset(); run('SelectParallelEdgeLoop'); S().pick(`cube.edge[0]`, 1, 0);
    ok('SelectParallelEdgeLoop on a cube: ring of 4', items()?.length === 4 && items().includes(cEdges[0]), items());
    S().pick(`b17grid.edge[${idx(eMid)}]`, 1, 0);
    const xA = Math.min(...ends(eMid).map(gx)), xB = Math.max(...ends(eMid).map(gx));
    const col = gE.filter(k => { const [a, b] = ends(k); return gz(a) === gz(b) && Math.min(gx(a), gx(b)) === xA && Math.max(gx(a), gx(b)) === xB; });
    ok('SelectParallelEdgeLoop on the grid: the ring across the polygons (all parallel edges of that column)', J(items()) === J(sorted(col)), [items()?.length, col.length]);
    S().cancel();
    A.run('DeleteObj', { InputObjs: 'b17grid' });
  } catch (e) { ok('Grow / Shrink / loops block threw', false, String(e?.stack ?? e)); }

  // ================= SelectNSidedPolygons
  try {
    A.setSelMode('object'); A.compSel = null; A.select([]); let r = run('SelectNSidedPolygons');
    ok('SelectNSidedPolygons, empty input: info message, stop', has(r, /^Invalid Selection\. Please select one or more polygon meshes first$/) && cmds(r).length === 0, r.log);
    reset(); r = run('SelectNSidedPolygons');
    ok('SelectNSidedPolygons defaults on a cube: "No such polygon found.", selection untouched', has(r, /^No such polygon found\.$/) && A.selection[0] === cube && A.compSel === null, r.log);
    reset(); r = run('SelectNSidedPolygons', { Value: 4, ExactEdgecount: true });
    ok('SelectNSidedPolygons 4 exact: DeselectAll, AddToSelection, SetSelFilter Polygon', J(items()) === J([0, 1, 2, 3, 4, 5]) && J(cmds(r)) === J(['DeselectAll', 'AddToSelection', 'SetSelFilter']) && A.selMode === 'polygon', [items(), cmds(r)]);
    selComp('cube.pnt[0]'); r = run('SelectNSidedPolygons', { Value: 3 });
    ok('SelectNSidedPolygons: a sub-component item resolves to its object; >= 3 = all quads', A.compSel?.obj === cube && items().length === 6, comp());
    reset(); A.select([rnull]); r = run('SelectNSidedPolygons', { Value: 3 });
    ok('SelectNSidedPolygons: non-polymsh objects are skipped', has(r, /^No such polygon found\.$/), r.log);
  } catch (e) { ok('SelectNSidedPolygons block threw', false, String(e?.stack ?? e)); }

  // ================= MakeAllUnselectable
  try {
    reset(); const u0 = A.undoStack.length; const L0 = A.scene.layers[0]; const pt = A.scene.passes[0].partitions[0];
    setV(cube, 'selectability', false); setV(sphere, 'selectability', false); L0.get('selectability').value = 0; pt.get('selectability').value = 1;
    const r = run('MakeAllUnselectable');
    ok('MakeAllUnselectable: groups / layers / partitions selectability 2, then every object selectable (correction: makes selectable)', !r.err && vis(cube, 'selectability') === true && vis(sphere, 'selectability') === true && L0.val('selectability') === 2 && pt.val('selectability') === 2 && J(r.calls.map(c => c.args[0])) === J(['#Group*.selectability,Layers.List.*.selectability,Passes.List.*.*.selectability', '*.visibility.selectability']), [r.err, L0.val('selectability'), pt.val('selectability')]);
    undoTo(u0); ok('MakeAllUnselectable undo', vis(cube, 'selectability') === false && L0.val('selectability') === 0 && pt.val('selectability') === 1);
    setV(cube, 'selectability', true); setV(sphere, 'selectability', true); L0.get('selectability').value = 1; pt.get('selectability').value = 2;
  } catch (e) { ok('MakeAllUnselectable block threw', false, String(e?.stack ?? e)); }

  // ================= layers: SICreateLayerFromSelection(2), MoveToLayer, ToggleCurrentLayerProperty
  try {
    reset(); A.select([cube, sphere]); const u0 = A.undoStack.length; const cur0 = A.currentLayer; const L = A.scene.layers;
    let inspected = 0; const off = A.events.on('inspect', () => inspected++); A.autoInspect = true;
    let r = run('SICreateLayerFromSelection', { Name: 'b17L' }); const nl = r.v;
    ok('SICreateLayerFromSelection: SICreateLayer, then MoveToLayer <new layer>, selection; Value = the layer; no current-layer change, no inspect', nl?.name === 'b17L' && L.includes(nl) && cube.layer === nl && sphere.layer === nl && A.cmdB17a.out.SICreateLayerFromSelection.Value === nl && A.currentLayer === cur0 && J(cmds(r).slice(0, 2)) === J(['SICreateLayer', 'MoveToLayer']) && A.selection.length === 2, [nl?.name, cmds(r)]);
    A.autoInspect = false; off();
    ok('SICreateLayerFromSelection: no inspect event', inspected === 0, inspected);
    A.select([]); r = run('SICreateLayerFromSelection', { Name: 'b17E' });
    ok('SICreateLayerFromSelection with nothing to move: layer created, no MoveToLayer', r.v?.name === 'b17E' && !cmds(r).includes('MoveToLayer'), cmds(r));
    const lg = A.run('CreateLayerGroup', { Name: 'b17LG' });
    r = run('SICreateLayerFromSelection2', { Name: 'b17L2', InputObjs: 'root_null', LayerGroupName: 'b17LG' });
    ok('SICreateLayerFromSelection2: SICreateLayer2 (layer group), MoveToLayer InputObjs, returns the layer', r.v?.name === 'b17L2' && rnull.layer === r.v && lg.layers.includes(r.v) && cmds(r)[0] === 'SICreateLayer2' && A.cmdB17a.out.SICreateLayerFromSelection2.Value === r.v, [r.err, cmds(r)]);
    // MoveToLayer (script entry: current layer)
    A.currentLayer = nl; A.select([rnull]);
    r = run('MoveToLayer');
    ok('MoveToLayer script entry: GetCurrentLayer, the C++ MoveToLayer, the current layer written to Target', !r.err && rnull.layer === nl && A.cmdB17a.out.MoveToLayer.Target === nl && J(cmds(r)) === J(['GetCurrentLayer', 'MoveToLayer(C++)']), [r.err, cmds(r)]);
    r = run('MoveToLayer', { Target: 'b17E', InputObjs: 'cube' });
    ok('MoveToLayer with a Target (C++ entry "Move Objects To Layer"): no current-layer lookup', cube.layer?.name === 'b17E' && !cmds(r).includes('GetCurrentLayer'), cmds(r));
    ok('MoveToLayer: Target not a layer -> error', !!run('MoveToLayer', { Target: 'cube', InputObjs: 'sphere' }).err);
    // ToggleCurrentLayerProperty
    const seq = (p, n) => { const s = []; for (let i = 0; i < n; i++) { run('ToggleCurrentLayerProperty', { PropName: p }); s.push(nl.val(p)); } return s; };
    ok('ToggleCurrentLayerProperty viewvis: 1 -> 0 -> 2 -> 0', J([nl.val('viewvis'), ...seq('viewvis', 3)]) === J([1, 0, 2, 0]), nl.val('viewvis'));
    ok('ToggleCurrentLayerProperty ghosting: 0 -> 1 -> 2 -> 1', J([0, ...seq('ghosting', 3)]) === J([0, 1, 2, 1]));
    nl.get('rendvis').value = 2; ok('ToggleCurrentLayerProperty rendvis: 2 -> 0', J(seq('rendvis', 1)) === J([0]));
    nl.get('selectability').value = 5; ok('ToggleCurrentLayerProperty: another value is left unchanged', J(seq('selectability', 1)) === J([5]));
    const saved = A.currentLayer; A.currentLayer = cube; r = run('ToggleCurrentLayerProperty', { PropName: 'viewvis' });
    ok('ToggleCurrentLayerProperty: a non-group current layer -> nothing', !r.err && !r.calls.some(c => c.cmd === 'SetValue'), r); A.currentLayer = saved;
    undoTo(u0); A.currentLayer = cur0;
    ok('layer block undo: layers removed, objects back in their layer', !L.includes(nl) && cube.layer !== nl && rnull.layer !== nl, [cube.layer?.name]);
  } catch (e) { ok('layer block threw', false, String(e?.stack ?? e)); }

  // ================= SIHideObjects / SIUnhideObjects / polygons
  try {
    reset(); const u0 = A.undoStack.length; const L0 = A.scene.layers[0];
    let r = run('SIHideObjects');
    ok('SIHideObjects defaults: visibility = viewvis,rendvis on the selection, set to False; selection kept', !vis(cube) && !vis(cube, 'rendvis') && vis(sphere) && A.selection[0] === cube && r.calls[0].cmd === 'SIHideObjects' && r.calls[0].args[1] === 'viewvis,rendvis', [vis(cube), r.calls[0]]);
    r = run('SIUnhideObjects');
    ok('SIUnhideObjects defaults: True again', vis(cube) && vis(cube, 'rendvis'));
    r = run('SIHideObjects', { Target: [L0], PropertyName: 'viewvis' });
    ok('SIHideObjects on a layer: parameter set to 0 (hide members)', L0.val('viewvis') === 0 && L0.val('rendvis') === 1, [L0.val('viewvis')]);
    r = run('SIUnhideObjects', { Target: [L0] });
    ok('SIUnhideObjects on a layer: parameters set to 2 (no effect)', L0.val('viewvis') === 2 && L0.val('rendvis') === 2);
    // branch
    A.run('GetPrim', { PresetObj: 'Null', Name: 'b17P' }); const par = A.scene.find('b17P'); A.run('GetPrim', { PresetObj: 'Null', Name: 'b17C' }); const ch = A.scene.find('b17C'); par.addChild(ch);
    A.select([par, ch]); run('SIHideObjects', { Target: [par], PropertyName: 'ghosting' });
    ok('SIHideObjects: an object selected in branch -> also every child', vis(par, 'ghosting') === false && vis(ch, 'ghosting') === false);
    setV(par, 'ghosting', true); setV(ch, 'ghosting', true); A.select([par]); run('SIHideObjects', { Target: [par], PropertyName: 'ghosting' });
    ok('SIHideObjects: node selection -> the child is untouched', vis(par, 'ghosting') === false && vis(ch, 'ghosting') === true);
    // polygons, add mode
    const HN = A.miscDsScripts.invisiblePolygonsClusterName;
    reset(); r = run('SIHideObjects', { Target: 'cube.poly[1,2]' });
    let hc = cube.clusters.find(c => c.name === HN); const cv = hc?.properties.find(p => p.type === 'clsvisibility');
    ok('SIHideObjects polygons: hidden cluster created (CreateClusterFromSubComponent), Component Visibility added, viewvis / rendvis False', !!hc && J(sorted([...hc.elements])) === J([1, 2]) && cv?.val('viewvis') === false && cv?.val('rendvis') === false && J(cmds(r).filter(c => /Cluster|SIAddProp/.test(c))) === J(['CreateClusterFromSubComponent', 'SIAddProp']) && vis(cube), [cmds(r), hc && [...hc.elements]]);
    r = run('SIHideObjects', { Target: 'cube.poly[3]' });
    ok('SIHideObjects polygons on a valid hidden cluster: SIAddToCluster', J(sorted([...hc.elements])) === J([1, 2, 3]) && cmds(r).includes('SIAddToCluster') && !cmds(r).includes('CreateClusterFromSubComponent'), cmds(r));
    cv.get('viewvis').value = true; r = run('SIHideObjects', { Target: 'cube.poly[4]' });
    const hc2 = cube.clusters.find(c => c.name === HN);
    ok('SIHideObjects: a hidden cluster with clsvisibility.viewvis True is deleted and replaced', hc2 !== hc && !cube.clusters.includes(hc) && J([...hc2.elements]) === J([4]) && cmds(r).includes('DeleteObj'), cmds(r));
    r = run('SIUnhideObjects', { Target: 'cube.poly[4]' });
    ok('SIUnhideObjects: polygons are not handled', J([...cube.clusters.find(c => c.name === HN).elements]) === J([4]) && !cmds(r).some(c => /Cluster|Polygon/.test(c)), cmds(r));
    // ToggleGhosting fast path with polygons: toggle mode on a valid cluster
    reset(); r = run('ToggleGhosting', { Target: 'cube.poly[4,5]', PropertyName: 'visibility' });
    ok('ToggleGhosting visibility with polygons: toggle mode -> SITogglePolygonVisibility on the hidden cluster', cmds(r).includes('SITogglePolygonVisibility') && J(sorted([...cube.clusters.find(c => c.name === HN).elements])) === J([4, 5]), [cmds(r), [...cube.clusters.find(c => c.name === HN).elements]]);
    undoTo(u0);
    ok('SIHideObjects block undo: clusters and visibility restored', !cube.clusters.some(c => c.name === HN) && vis(cube) && L0.val('viewvis') === 1 && !A.scene.find('b17P'), cube.clusters.map(c => c.name));
  } catch (e) { ok('SIHideObjects block threw', false, String(e?.stack ?? e)); }

  // ================= ToggleGhosting
  try {
    reset(); const u0 = A.undoStack.length; const L0 = A.scene.layers[0];
    let r = run('ToggleGhosting');
    ok('ToggleGhosting defaults: <obj>.visibility.ghosting = not (current = True)', vis(cube, 'ghosting') === true && vis(sphere, 'ghosting') === false, r);
    run('ToggleGhosting'); ok('ToggleGhosting again: back to False', vis(cube, 'ghosting') === false);
    const lseq = (args, n) => { const s = []; for (let i = 0; i < n; i++) { run('ToggleGhosting', { Target: [L0], ...args }); s.push(L0.val(args.PropertyName ?? 'ghosting')); } return s; };
    ok('ToggleGhosting on a layer, 2-state: ghosting 0 -> 1 -> 2 -> 1', J(lseq({}, 3)) === J([1, 2, 1]));
    L0.get('ghosting').value = 0; ok('ToggleGhosting ThreeState: 0 -> 1 -> 2 -> 0', J(lseq({ ThreeState: true }, 3)) === J([1, 2, 0]));
    ok('ToggleGhosting on a layer, viewvis 2-state: 1 -> 0 -> 2 -> 0', J(lseq({ PropertyName: 'viewvis' }, 3)) === J([0, 2, 0]));
    L0.get('viewvis').value = 1;
    r = run('ToggleGhosting', { Target: 'cube,sphere', PropertyName: 'selectability,rendvis' });
    ok('ToggleGhosting: comma-separated parameters, each toggled per object', vis(cube, 'selectability') === false && vis(cube, 'rendvis') === false && vis(sphere, 'rendvis') === false, r);
    // fast path
    reset(); r = run('ToggleGhosting', { PropertyName: 'visibility' });
    ok('ToggleGhosting visibility fast path: object -> not viewvis into viewvis and rendvis (set / unset lists)', vis(cube) === false && vis(cube, 'rendvis') === false && r.calls.filter(c => c.cmd === 'SetValue').length === 1 && r.calls.find(c => c.cmd === 'SetValue').args[1] === false, r.calls);
    run('ToggleGhosting', { PropertyName: 'visibility' });
    ok('ToggleGhosting visibility again: shown (viewvis and rendvis True)', vis(cube) === true && vis(cube, 'rendvis') === true);
    r = run('ToggleGhosting', { Target: [L0], PropertyName: 'visibility' });
    ok('ToggleGhosting visibility on a layer: viewvis cycle written to viewvis and rendvis together', L0.val('viewvis') === 0 && L0.val('rendvis') === 0, [L0.val('viewvis'), L0.val('rendvis')]);
    // read-only warning (2.5)
    L0.get('viewvis').value = 1; L0.get('rendvis').value = 2;
    const q = sphere.property('visibility').get('viewvis'); q.def.readOnly = true; sphere.layer = L0;
    r = run('ToggleGhosting', { Target: 'sphere', PropertyName: 'visibility' });
    ok('ToggleGhosting visibility: read-only viewvis skipped, one warning naming the interfering group(s) (parameter not 2)', vis(sphere) === true && vis(sphere, 'rendvis') === false && has(r, new RegExp(`^WARNING : Unable to set visibility on some parameters\\. The following groups are interfering: ${L0.name},$`)), r.log);
    q.def.readOnly = false;
    // branch
    A.run('GetPrim', { PresetObj: 'Null', Name: 'b17P' }); const par = A.scene.find('b17P'); A.run('GetPrim', { PresetObj: 'Null', Name: 'b17C' }); const ch = A.scene.find('b17C'); par.addChild(ch);
    A.select([par, ch]); run('ToggleGhosting', { Target: [par] });
    ok('ToggleGhosting: in branch -> every child gets the same new value', vis(par, 'ghosting') === true && vis(ch, 'ghosting') === true);
    undoTo(u0);
    ok('ToggleGhosting undo', vis(cube, 'ghosting') === false && vis(sphere) && L0.val('viewvis') === 1 && L0.val('ghosting') === 0, [L0.val('viewvis'), L0.val('ghosting')]);
  } catch (e) { ok('ToggleGhosting block threw', false, String(e?.stack ?? e)); }

  // ================= HideUnselected
  try {
    reset(); const u0 = A.undoStack.length; const others = [...A.scene.allObjects()].filter(o => o !== cube);
    let r = run('HideUnselected');
    ok('HideUnselected objects: InvertSelection "object", SIHideObjects, InvertSelection -> only the selection stays visible, selection restored', vis(cube) && others.every(o => !vis(o)) && A.selection.length === 1 && A.selection[0] === cube && J(cmds(r).filter(c => c === 'InvertSelection' || c === 'SIHideObjects').slice(0, 3)) === J(['InvertSelection', 'SIHideObjects', 'SIHideObjects']) && cmds(r).filter(c => c === 'InvertSelection').length === 2, [cmds(r)]);
    undoTo(u0); ok('HideUnselected undo', [...A.scene.allObjects()].every(o => vis(o)));
    A.select([]); r = run('HideUnselected', { Target: [sphere] });
    ok('HideUnselected: the Target is only examined for polygons; the current (empty) selection is inverted -> everything hidden', [...A.scene.allObjects()].every(o => !vis(o)) && A.selection.length === 0, [A.selection.length]);
    undoTo(u0);
    // polygons
    const HN = A.miscDsScripts.invisiblePolygonsClusterName;
    selComp('cube.poly[0]'); r = run('HideUnselected');
    const hc = cube.clusters.find(c => c.name === HN);
    ok('HideUnselected polygons: InvertSelection "polygon", SIHideObjects (add mode), SelectGeometryComponents Target', !!hc && J(sorted([...hc.elements])) === J([1, 2, 3, 4, 5]) && vis(cube) && others.every(o => vis(o)) && J(comp()) === J({ obj: 'cube', kind: 'polygon', items: [0] }) && cmds(r).includes('SelectGeometryComponents'), [cmds(r), comp(), hc && [...hc.elements]]);
    undoTo(u0); cube.clusters.filter(c => c.name === HN).forEach(c => cube.removeCluster(c));
  } catch (e) { ok('HideUnselected block threw', false, String(e?.stack ?? e)); }

  // ================= UnhideAll / UnghostAll
  try {
    reset(); const u0 = A.undoStack.length; const L0 = A.scene.layers[0]; const pt = A.scene.passes[0].partitions[0];
    for (const o of A.scene.allObjects()) { setV(o, 'viewvis', false); setV(o, 'rendvis', false); setV(o, 'ghosting', true); }
    L0.get('viewvis').value = 0; pt.get('rendvis').value = 1; L0.get('ghosting').value = 1;
    const Prop = cube.properties[0].constructor; const ov = new Prop('Override', 'override', []); cube.addProperty(ov);
    A.run('SIAddParameterEntryToOverride', { InputObj: ov, InputObjs: [cube.property('visibility').get('viewvis')], Value: false });
    const nEntries = ov.params.length;
    let r = run('UnhideAll');
    ok('UnhideAll: visibility -> viewvis,rendvis; partitions and layers set to 2', L0.val('viewvis') === 2 && L0.val('rendvis') === 2 && pt.val('rendvis') === 2 && pt.val('viewvis') === 2 && L0.val('ghosting') === 1, [L0.val('viewvis'), pt.val('rendvis')]);
    ok('UnhideAll: every object shown (viewvis and rendvis True), ghosting untouched', [...A.scene.allObjects()].every(o => vis(o) && vis(o, 'rendvis') && vis(o, 'ghosting') === true));
    ok('UnhideAll: local override entry removed (SIRemoveEntryFromOverride), the empty override deleted', nEntries === 1 && !cube.properties.includes(ov) && cmds(r).includes('SIRemoveEntryFromOverride') && cmds(r).includes('DeleteObj'), [nEntries, cmds(r)]);
    r = run('UnghostAll');
    ok('UnghostAll: layers / partitions ghosting 2; step 4 writes ghosting False on every object', L0.val('ghosting') === 2 && pt.val('ghosting') === 2 && [...A.scene.allObjects()].every(o => vis(o, 'ghosting') === false) && r.calls.filter(c => c.cmd === 'SetValue' && c.args[0] === '*.visibility.ghosting').map(c => c.args[1]).pop() === false, r.calls.slice(-2));
    r = run('UnhideAll', { PropertyName: 'selectability' });
    ok('UnhideAll PropertyName selectability: only that parameter', !r.err && L0.val('selectability') === 2 && !r.calls.some(c => c.cmd === 'UnhideAll'), r.err);
    undoTo(u0);
    ok('UnhideAll / UnghostAll undo', !vis(cube) && L0.val('viewvis') === 0 && cube.properties.includes(ov), [vis(cube), L0.val('viewvis')]);
    for (const o of A.scene.allObjects()) { setV(o, 'viewvis', true); setV(o, 'rendvis', true); setV(o, 'ghosting', false); }
    L0.get('viewvis').value = 1; pt.get('rendvis').value = 2; L0.get('ghosting').value = 0; cube.removeProperty(ov);
  } catch (e) { ok('UnhideAll block threw', false, String(e?.stack ?? e)); }
  return out;
}, { NAMES });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const isSubseq = (sub, sup) => { let i = 0; for (const x of sup) if (x === sub[i]) i++; return i === sub.length; };
for (const n of NAMES) {
  const g = got.reg[n], r = registry[n];
  report(`${n}: registered`, !!g);
  report(`${n}: registry argument list (hidden arguments included)`, JSON.stringify(g?.args) === JSON.stringify(r?.args), `${JSON.stringify(g?.args)} vs ${JSON.stringify(r?.args)}`);
  report(`${n}: commands_full.json argument names are a sub-sequence`, catalogue[n] && isSubseq(catalogue[n], (g?.args ?? []).map(a => a[0])), JSON.stringify(catalogue[n]));
  report(`${n}: label / category`, g?.label === r?.label && g?.category === r?.category, `${g?.label}/${g?.category} vs ${r?.label}/${r?.category}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_selection_layers_b17a: ${pass}/${pass + fail} ok`);
await browser.close();
process.exit(fail ? 1 : 0);
