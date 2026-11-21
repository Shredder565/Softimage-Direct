// Selection / Group / Layer command families on the command bus (INFERRED batch, no analyst note).
// Contract check, not a golden compare: there is no dump of these commands' behaviour in data/dump.
// For every command registered by src/commands/selectionGroupLayer.ts this checks (the ones CMD-B19b replaced are checked by
// tools/compare_tasks_b19b.mjs)
//   (1) registration against data/commands_full.json (display name, category, argument names + defaults),
//   (2) a run with default arguments (no throw, or the documented error text),
//   (3) the resulting scene state (selection list, component selection, group / layer membership, undo).
// Expected component sets are computed here from the mesh (positions / polygons), not with the app's helpers.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_selection_group_layer_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const COMMANDS = [
  // selection list
  'AddToSelection', 'RemoveFromSelection', 'ToggleSelection', 'SetAndToggleSelection', 'SelectBranch', 'SelectTree', 'SelectModel',
  'SelectChain', 'SelectMembers', 'SelectNeighborObj',
  // filters
  'SelectAllUsingFilter', 'SelectFilter', 'SetSelFilter', 'SelectObjectFilter', 'SelectVertexFilter',
  'SelectEdgeFilter', 'SelectPolygonFilter', 'SelectSampledPointFilter', 'SetPointSelectionFilter', 'SetEdgeSelectionFilter',
  'SetPolygonSelectionFilter', 'SetSampleSelectionFilter', 'ToggleObjectComponentSelectionFilter', 'Cycle Selection Mode',
  'ActivateObjectSelToolWithNoObjStateChange', 'ActivateVertexSelToolWithNoObjStateChange', 'ActivateEdgeSelToolWithNoObjStateChange',
  'ActivateRaycastEdgeSelToolWithNoObjStateChange', 'ActivateRaycastPolySelToolWithNoObjStateChange',
  // components
  // (GrowSelection, ShrinkSelection, SelectAdjacent, ConvertSelection*, SelectNSidedPolygons, GetNeighborSubcomponents,
  //  Select*EdgeLoop, SICreateLayerFromSelection*, ToggleGhosting: CMD-B17a, compare_selection_layers_b17a.mjs)
  // (SelectAllConnectedComponents, SelectAllComponentLoops, Grow/ShrinkSelectedLoops, SelectPolygonOutline,
  //  DeselectAllUsingFilter, SICreateLayer[2], MoveObjectToLayer, CreateLayerGroup, CutLayerParent:
  //  CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs))
  'SelectGeometryComponents',
  // info
  'InfoSelection', 'InfoScene',
  // groups
  'AddToGroup', 'SIAddToGroup', 'SIAddToGroupLowLevel', 'RemoveFromGroup', 'SIRemoveFromGroup', 'SICreateGroup',
  'CreateGroupFromObjects', 'AddGroup', 'RemoveGroup', 'SetInstanceGroup', 'RemoveInstanceGroup',
  // layers
  'GetCurrentLayer',
];
// default-argument runs that are specified to fail, with the expected error text
const DEFAULT_ERRORS = {
  AddToGroup: /^not yet attested: the pick session that asks for the Target group/,
  SIAddToGroup: /^not yet attested: the pick session that asks for the Target group/,
  SIAddToGroupLowLevel: /^not yet attested: the pick session that asks for the Target group/,
  AddGroup: /^not yet attested: the pick session that asks for the Target model/,
  // CMD-B7a (docs/ghidra/cmd-b7a-uitasks-group-view-binary.md) replaced the inferred registrations: an empty Object list is 0x8000ffff
  SetInstanceGroup: /^SetInstanceGroup: the Object list is empty \(status 0x8000ffff\)$/,
  RemoveInstanceGroup: /^RemoveInstanceGroup: the Object list is empty \(status 0x8000ffff\)$/,
};

const all = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/commands_full.json'), 'utf8'));
// first registry entry per name (menu overloads share one scripting name); the display-name-only entry has no scripting name
const registry = COMMANDS.map(n => {
  const c = all.find(x => x.scripting_name === n) ?? all.find(x => !x.scripting_name && x.name === n);
  return c ? { key: n, name: c.name, category: c.category, args: c.args.map(a => ({ name: a.name, default: a.default })) } : { key: n, missing: true };
});
// CMD-B19c: SelectBranch / SelectTree / SelectModel / SelectChain also take the registry's hidden SelectObj arguments
// (data/command_registry.json: SelectionList, HierarchyLevel with the level default) after the catalogue argument.
{
  const regCmds = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/command_registry.json'), 'utf8')).commands;
  for (const r of registry) {
    if (!['SelectBranch', 'SelectTree', 'SelectModel', 'SelectChain'].includes(r.key) || r.missing) continue;
    const e = regCmds.find(x => x.scripting_name === r.key);
    for (const a of e?.args ?? []) if ((a.flags & 1) && !(a.flags & 512)) r.args.push({ name: a.name, default: a.default ?? null });
  }
}

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const got = await page.evaluate(({ COMMANDS }) => {
  const A = window.Application;
  const C = [];                                    // [label, got, want]
  const eq = (label, g, want) => C.push([label, g === undefined ? '<none>' : g, want]);
  const run = (name, args) => { try { const v = A.run(name, args ?? {}); return { v }; } catch (e) { return { err: String(e?.message ?? e), nya: e?.notYetAttested === true }; } };
  const names = l => (l ?? []).map(n => n.name);
  const sorted = l => [...l].sort((x, y) => (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))));
  const selNames = () => names(A.selection);
  const comp = () => { const c = A.compSel; if (!c) return null; return { obj: c.obj.name, kind: c.kind, items: sorted(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons) }; };
  const items = () => comp()?.items ?? null;
  const reset = () => { A.compSel = null; A.setSelMode('object'); A.select([]); };
  const logFrom = n => A.log.slice(n).map(l => l.text);
  const find = n => A.scene.find(n);
  const ek = (a, b2) => a < b2 ? `${a}-${b2}` : `${b2}-${a}`;
  const out = { registration: null, defaults: {} };

  out.registration = COMMANDS.map(n => { const d = A.commands.get(n); return { key: n, found: !!d, label: d?.label, category: d?.category, undoable: d?.undoable, args: d?.args.map(a => ({ name: a.name, default: a.default === undefined ? null : a.default })) }; });

  // ---------------------------------------------------------------- scene setup
  // demo scene: cube, sphere, root_null. Add a small hierarchy, a model, a chain and a grid.
  const mk = n => { reset(); return A.run('GetPrim', { PresetObj: 'Null', Name: n }); };
  const pA = mk('pA'), c1 = mk('c1'), c2 = mk('c2'), c3 = mk('c3'), gc = mk('gc');
  pA.addChild(c1); pA.addChild(c2); pA.addChild(c3); c2.addChild(gc);
  const Model = A.scene.root.constructor;
  const mdl = new Model('Mdl'); A.scene.root.addChild(mdl);
  const m1 = mk('m1'), m2 = mk('m2'); mdl.addChild(m1); m1.addChild(m2);
  reset(); const chain = A.run('Create3DSkeleton', { Points: [[0, 0, 0], [2, 0, 0], [4, 1, 0]] });
  const chainNames = sorted([chain.name, ...chain.bones.map(x => x.name), chain.effector.name]);
  reset(); A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface' });
  const grid = A.selectedObjects[0]; const gm = grid.primitive.mesh();
  const cube = find('cube'), sphere = find('sphere'), rootNull = find('root_null'); const cm = cube.primitive.mesh();
  reset();
  eq('setup: cube is 8 points / 6 quads', [cm.positions.length / 3, cm.polygons.length, cm.polygons.every(f => f.length === 4)], [8, 6, true]);

  // mesh facts computed here, independently of the implementation
  const facts = m => {
    const edges = []; const seen = new Set(); const edgePolys = new Map();
    m.polygons.forEach((f, pi) => f.forEach((a, i) => { const k = ek(a, f[(i + 1) % f.length]); if (!seen.has(k)) { seen.add(k); edges.push(k); edgePolys.set(k, []); } edgePolys.get(k).push(pi); }));
    const pos = v => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]];
    return { edges, edgePolys, pos, n: m.positions.length / 3 };
  };
  const CF = facts(cm), GF = facts(gm);
  const polysTouching = (m, verts) => m.polygons.map((f, i) => f.some(v => verts.has(v)) ? i : -1).filter(i => i >= 0);
  const edgesTouching = (F, verts) => F.edges.filter(k => k.split('-').some(v => verts.has(Number(v))));

  // ---------------------------------------------------------------- default-argument runs (empty selection, object mode)
  for (const n of COMMANDS) { reset(); const r = run(n); out.defaults[n] = r.err === undefined ? { ok: true } : { err: r.err, nya: r.nya }; }
  // undo whatever the default runs created (layers, groups) so the state checks start clean
  while (A.undoStack.length && /^(SICreate|CreateLayerGroup|CreateGroupFromObjects)/.test(A.undoStack[A.undoStack.length - 1].label)) A.undo();
  reset();

  // ================================================================ selection list
  A.run('SelectObj', { InputObjs: 'cube' });
  run('AddToSelection', { SelectionList: 'sphere,root_null' });
  eq('AddToSelection: adds to the list', selNames(), ['cube', 'sphere', 'root_null']);
  run('AddToSelection', { SelectionList: 'sphere' });
  eq('AddToSelection: no duplicates', selNames(), ['cube', 'sphere', 'root_null']);
  run('AddToSelection', { SelectionList: 'pA', HierarchyLevel: 'BRANCH' });
  eq('AddToSelection: HierarchyLevel BRANCH adds node + descendants', selNames(), ['cube', 'sphere', 'root_null', 'pA', 'c1', 'c2', 'gc', 'c3']);
  reset(); run('AddToSelection', { SelectionList: [cube, sphere] });
  eq('AddToSelection: object collection', selNames(), ['cube', 'sphere']);
  sphere.property('visibility').set('selectability', false);
  reset(); run('AddToSelection', { SelectionList: 'cube,sphere', CheckObjectSelectability: true });
  eq('AddToSelection: CheckObjectSelectability skips unselectable objects', selNames(), ['cube']);
  reset(); run('AddToSelection', { SelectionList: 'cube,sphere' });
  eq('AddToSelection: without the check unselectable objects are selected', selNames(), ['cube', 'sphere']);
  sphere.property('visibility').set('selectability', true);
  reset(); run('AddToSelection', { SelectionList: 'gc', HierarchyLevel: 'TREE' });
  eq('AddToSelection: HierarchyLevel TREE', selNames(), ['pA', 'c1', 'c2', 'gc', 'c3']);
  reset(); run('AddToSelection', { SelectionList: 'm2', HierarchyLevel: 'MODEL' });
  eq('AddToSelection: HierarchyLevel MODEL', selNames(), ['Mdl', 'm1', 'm2']);
  reset(); run('AddToSelection', { SelectionList: 'cube.poly[0,2]' });
  eq('AddToSelection: component string', [comp(), A.selMode], [{ obj: 'cube', kind: 'polygon', items: [0, 2] }, 'polygon']);
  run('AddToSelection', { SelectionList: 'cube.poly[3]' });
  eq('AddToSelection: component string extends', items(), [0, 2, 3]);
  eq('AddToSelection: not undoable', A.commands.get('AddToSelection').undoable, false);

  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere,root_null' });
  const rr = run('RemoveFromSelection', { SelectionList: 'sphere' });
  eq('RemoveFromSelection: removes from the list, returns true', [selNames(), rr.v], [['cube', 'root_null'], true]);
  reset(); A.run('SelectObj', { InputObjs: 'pA,c1,c2,gc,c3,cube' });
  run('RemoveFromSelection', { SelectionList: 'c2' });
  eq('RemoveFromSelection: default level removes the node only', selNames(), ['pA', 'c1', 'gc', 'c3', 'cube']);
  run('RemoveFromSelection', { SelectionList: 'pA', HierarchyLevel: 'BRANCH' });
  eq('RemoveFromSelection: BRANCH removes node + descendants', selNames(), ['cube']);
  reset(); run('AddToSelection', { SelectionList: 'cube.pnt[0-3]' }); run('RemoveFromSelection', { SelectionList: 'cube.pnt[1,2]' });
  eq('RemoveFromSelection: component string', items(), [0, 3]);

  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' });
  run('ToggleSelection', { SelectionList: 'sphere,root_null' });
  eq('ToggleSelection: selected go out, others come in', selNames(), ['cube', 'root_null']);
  reset(); run('AddToSelection', { SelectionList: 'cube.poly[0,1]' }); run('ToggleSelection', { SelectionList: 'cube.poly[1,2]' });
  eq('ToggleSelection: component string', items(), [0, 2]);

  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' });
  run('SetAndToggleSelection', { SelectionList: 'sphere,root_null' });
  eq('SetAndToggleSelection: replaces; listed elements that were selected end deselected', selNames(), ['root_null']);
  reset(); A.run('SelectObj', { InputObjs: 'cube' }); run('SetAndToggleSelection', { SelectionList: 'sphere' });
  eq('SetAndToggleSelection: plain replace when nothing listed was selected', selNames(), ['sphere']);

  reset(); A.run('SelectObj', { InputObjs: 'pA' }); run('SelectBranch');
  eq('SelectBranch: node + descendants (existing branch representation)', selNames(), ['pA', 'c1', 'c2', 'gc', 'c3']);
  reset(); A.run('SelectObj', { InputObjs: 'cube,c2' }); run('SelectBranch');
  eq('SelectBranch: every selected object', selNames(), ['cube', 'c2', 'gc']);
  reset(); A.run('SelectObj', { InputObjs: 'gc' }); run('SelectTree');
  eq('SelectTree: whole tree of the selected object', selNames(), ['pA', 'c1', 'c2', 'gc', 'c3']);
  reset(); A.run('SelectObj', { InputObjs: 'm2' }); run('SelectTree');
  eq('SelectTree: stops below the scene root', selNames(), ['Mdl', 'm1', 'm2']);
  reset(); A.run('SelectObj', { InputObjs: 'm2' }); run('SelectModel');
  eq('SelectModel: the model as branch', selNames(), ['Mdl', 'm1', 'm2']);
  { reset(); A.run('SelectObj', { InputObjs: 'cube' }); const n = A.log.length; run('SelectModel');
    eq('SelectModel: object outside any model keeps its selection and logs not yet attested', [selNames(), logFrom(n).some(t => /^SelectModel: not yet attested: cube is not inside a model/.test(t))], [['cube'], true]); }
  reset(); A.select([chain.bones[1]]); run('SelectChain');
  eq('SelectChain: root, bones and effector of the chain', sorted(selNames()), chainNames);
  reset(); A.select([chain.effector]); run('SelectChain');
  eq('SelectChain: from the effector', sorted(selNames()), chainNames);
  reset(); A.run('SelectObj', { InputObjs: 'cube' }); run('SelectChain');
  eq('SelectChain: non-chain object keeps its selection', selNames(), ['cube']);

  // navigation
  const nav = (from, dir, level, add) => { reset(); A.run('SelectObj', { InputObjs: from }); run('SelectNeighborObj', { NavigDirection: dir, HierarchyLevel: level ?? 'NODE', AddToSelection: !!add }); return selNames(); };
  eq('SelectNeighborObj: 0 parent', nav('gc', 0), ['c2']);
  eq('SelectNeighborObj: 0 parent of a top object keeps the selection', nav('pA', 0), ['pA']);
  eq('SelectNeighborObj: 1 first child', nav('pA', 1), ['c1']);
  eq('SelectNeighborObj: 2 previous sibling', nav('c2', 2), ['c1']);
  eq('SelectNeighborObj: 3 next sibling', nav('c2', 3), ['c3']);
  eq('SelectNeighborObj: 4 first', nav('c3', 4), ['c1']);
  eq('SelectNeighborObj: 5 last', nav('c1', 5), ['c3']);
  eq('SelectNeighborObj: BRANCH level', nav('c1', 3, 'BRANCH'), ['c2', 'gc']);
  eq('SelectNeighborObj: AddToSelection', nav('c1', 3, 'NODE', true), ['c1', 'c2']);
  reset(); run('SelectNeighborObj', { InputObjs: 'gc', NavigDirection: 0 });
  eq('SelectNeighborObj: InputObjs argument', selNames(), ['c2']);
  eq('SelectNeighborObj: unknown direction is not attested', /^not yet attested: NavigDirection 9/.test(run('SelectNeighborObj', { InputObjs: 'gc', NavigDirection: 9 }).err ?? ''), true);

  // ================================================================ filters
  reset(); let r = run('SelectAllUsingFilter', { SelFilter: 'object' });
  eq('SelectAllUsingFilter: object = every visible object', [sorted(selNames()), sorted(names(r.v))], [sorted(names([...A.scene.allObjects()].filter(o => o.visible))), sorted(names([...A.scene.allObjects()].filter(o => o.visible)))]);
  reset(); r = run('SelectAllUsingFilter', { SelFilter: 'null' });
  eq('SelectAllUsingFilter: null filter', sorted(selNames()), sorted(names([...A.scene.allObjects()].filter(o => o.type === 'null' && o.visible))));
  eq('SelectAllUsingFilter: null filter selects only nulls', A.selection.length > 5 && A.selection.every(o => o.type === 'null'), true);
  reset(); r = run('SelectAllUsingFilter', { SelFilter: 'polymsh', AffectSelectionList: false });
  eq('SelectAllUsingFilter: AffectSelectionList false only returns', [selNames(), sorted(names(r.v))], [[], sorted(names([...A.scene.allObjects()].filter(o => o.type === 'polymsh' && o.visible)))]);
  reset(); A.run('SelectObj', { InputObjs: 'cube' }); r = run('SelectAllUsingFilter', { SelFilter: 'Polygon' });
  eq('SelectAllUsingFilter: Polygon = all polygons of the selected mesh', [comp(), r.v, A.selMode], [{ obj: 'cube', kind: 'polygon', items: [0, 1, 2, 3, 4, 5] }, ['cube.poly[0,1,2,3,4,5]'], 'polygon']);
  r = run('SelectAllUsingFilter', { SelFilter: 'Edge' });
  eq('SelectAllUsingFilter: Edge', [comp()?.kind, items()], ['edge', sorted(CF.edges)]);
  A.setSelMode('point'); r = run('SelectAllUsingFilter');
  eq('SelectAllUsingFilter: no SelFilter = current filter', [comp()?.kind, items()], ['point', [0, 1, 2, 3, 4, 5, 6, 7]]);
  eq('SelectAllUsingFilter: unknown filter is not attested', /^not yet attested: filter "bogus_filter"/.test(run('SelectAllUsingFilter', { SelFilter: 'bogus_filter' }).err ?? ''), true);
  // DeselectAllUsingFilter: CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs)

  const filt = (name, args) => { reset(); const x = run(name, args); return [x.v ?? x.err, A.selFilter, A.selMode]; };
  eq('SelectFilter: Edge', filt('SelectFilter', { SelFilter: 'Edge' }), ['Edge', 'Edge', 'edge']);
  eq('SelectFilter: Vertex alias', filt('SelectFilter', { SelFilter: 'Vertex' }), ['Point', 'Point', 'point']);
  eq('SelectFilter: object', filt('SelectFilter', { SelFilter: 'object' }), ['Object', 'Object', 'object']);
  eq('SelectFilter: other filter name is kept with object picking (as the MCP filter box)', filt('SelectFilter', { SelFilter: 'Light' }), ['Light', 'Light', 'object']);
  run('SelectFilter', { SelFilter: 'Polygon' });
  eq('SelectFilter: no argument returns the current filter and changes nothing', [run('SelectFilter').v, A.selMode], ['Polygon', 'polygon']);
  eq('SetSelFilter: sets the filter', filt('SetSelFilter', { SelFilter: 'Polygon' }), ['Polygon', 'Polygon', 'polygon']);
  for (const [n, f, m] of [['SelectObjectFilter', 'Object', 'object'], ['SelectVertexFilter', 'Point', 'point'], ['SelectEdgeFilter', 'Edge', 'edge'], ['SelectPolygonFilter', 'Polygon', 'polygon'],
    ['SetPointSelectionFilter', 'Point', 'point'], ['SetEdgeSelectionFilter', 'Edge', 'edge'], ['SetPolygonSelectionFilter', 'Polygon', 'polygon']]) {
    reset(); if (m === 'object') A.setSelMode('point');
    run(n); eq(`${n}: filter ${f}`, [A.selFilter, A.selMode], [f, m]);
  }
  for (const n of ['SelectSampledPointFilter', 'SetSampleSelectionFilter']) {
    reset(); A.setSelMode('edge'); const l = A.log.length; run(n);
    eq(`${n}: records the SampledPoint filter, logs the unattested part`, [A.selFilter, A.selMode, logFrom(l).some(t => t.startsWith(`${n}: filter set to SampledPoint; not yet attested: sampled-point component picking`))], ['SampledPoint', 'object', true]);
  }
  reset(); run('ToggleObjectComponentSelectionFilter'); const t1 = A.selMode; run('ToggleObjectComponentSelectionFilter');
  eq('ToggleObjectComponentSelectionFilter: Object <-> Point', [t1, A.selMode, A.selFilter], ['point', 'object', 'Object']);
  A.setSelMode('polygon'); run('ToggleObjectComponentSelectionFilter');
  eq('ToggleObjectComponentSelectionFilter: from another component filter goes to Object', A.selMode, 'object');
  reset(); const cyc = []; for (let i = 0; i < 5; i++) { run('Cycle Selection Mode'); cyc.push(A.selMode); }
  eq('Cycle Selection Mode: object > point > edge > polygon > object', cyc, ['point', 'edge', 'polygon', 'object', 'point']);
  for (const [n, m] of [['ActivateObjectSelToolWithNoObjStateChange', 'object'], ['ActivateVertexSelToolWithNoObjStateChange', 'point'], ['ActivateEdgeSelToolWithNoObjStateChange', 'edge'],
    ['ActivateRaycastEdgeSelToolWithNoObjStateChange', 'edge'], ['ActivateRaycastPolySelToolWithNoObjStateChange', 'polygon']]) {
    reset(); if (m === 'object') A.setSelMode('point'); A.select([cube, sphere]);
    run(n); eq(`${n}: sets the ${m} filter, object selection unchanged`, [A.selMode, selNames()], [m, ['cube', 'sphere']]);
  }

  // ================================================================ members
  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' }); const G = A.run('CreateGroup', { Name: 'GrpM' });
  r = run('SelectMembers');
  eq('SelectMembers: members of the selected group', [selNames(), names(r.v)], [['cube', 'sphere'], ['cube', 'sphere']]);
  reset(); r = run('SelectMembers', { SelectionList: 'GrpM', AffectSelectionList: false });
  eq('SelectMembers: AffectSelectionList false only returns', [selNames(), names(r.v)], [[], ['cube', 'sphere']]);
  reset(); r = run('SelectMembers', { SelectionList: A.scene.layers[0] });
  eq('SelectMembers: members of a layer', sorted(names(r.v)), sorted(names([...A.scene.layers[0].members])));

  // ================================================================ components (cube)
  const P0 = new Set(cm.polygons[0]);
  const setPoly = l => { reset(); run('SelectGeometryComponents', { SelectionList: `cube.poly[${l.join(',')}]` }); };
  setPoly([0, 2]);
  eq('SelectGeometryComponents: polygons + polygon filter', [comp(), A.selMode, selNames()], [{ obj: 'cube', kind: 'polygon', items: [0, 2] }, 'polygon', ['cube']]);
  reset(); run('SelectGeometryComponents', { SelectionList: 'cube.pnt[1-3]' });
  eq('SelectGeometryComponents: point range', [comp()?.kind, items()], ['point', [1, 2, 3]]);
  reset(); run('SelectGeometryComponents', { SelectionList: 'cube.edge[0,5]' });
  eq('SelectGeometryComponents: edges by index', [comp()?.kind, items()], ['edge', sorted([CF.edges[0], CF.edges[5]])]);
  { reset(); const l = A.log.length; run('SelectGeometryComponents', { SelectionList: 'cube' });
    eq('SelectGeometryComponents: bare object is not attested, nothing selected', [comp(), logFrom(l).some(t => /^SelectGeometryComponents: not yet attested/.test(t))], [null, true]); }

  const grow0 = sorted(polysTouching(cm, P0));
  const p0edges = sorted(cm.polygons[0].map((a, i) => ek(a, cm.polygons[0][(i + 1) % 4])));
  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)
  // SelectAllConnectedComponents: CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs)

  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)

  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)

  // SelectPolygonOutline: CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs)

  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)

  // ================================================================ loops on the grid
  const gx = v => Math.round(GF.pos(v)[0] * 1e4), gz = v => Math.round(GF.pos(v)[2] * 1e4);
  const xs = [...new Set([...Array(GF.n).keys()].map(gx))].sort((a, b2) => a - b2), zs = [...new Set([...Array(GF.n).keys()].map(gz))].sort((a, b2) => a - b2);
  eq('setup: grid is at least 4 x 4 quads', xs.length >= 5 && zs.length >= 5 && gm.polygons.every(f => f.length === 4), true);
  const ends = k => k.split('-').map(Number);
  const gIdx = k => GF.edges.indexOf(k);
  const rowEdges = z => GF.edges.filter(k => ends(k).every(v => gz(v) === z));            // edges lying on the line z
  const border = GF.edges.filter(k => GF.edgePolys.get(k).length === 1);
  const zMid = zs[2], xA = xs[2], xB = xs[3];
  const eBorder = GF.edges.find(k => { const [a, b2] = ends(k); return gz(a) === zs[0] && gz(b2) === zs[0] && Math.min(gx(a), gx(b2)) === xs[2]; });
  const eMid = GF.edges.find(k => { const [a, b2] = ends(k); return gz(a) === zMid && gz(b2) === zMid && Math.min(gx(a), gx(b2)) === xA && Math.max(gx(a), gx(b2)) === xB; });
  const gsel = (kind, list) => { reset(); run('SelectGeometryComponents', { SelectionList: `grid.${kind}[${list.join(',')}]` }); };
  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)
  // SelectAllComponentLoops / GrowSelectedLoops / ShrinkSelectedLoops: CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs)
  // CMD-B17a moved these to compare_selection_layers_b17a.mjs (wire contract replaced the inferred behaviour)

  // ================================================================ info
  { reset(); A.run('SelectObj', { InputObjs: 'cube' }); const l = A.log.length; r = run('InfoSelection');
    eq('InfoSelection: derivable counts of the selection', r.v, [{ name: 'cube', type: cube.type, children: 0, points: 8, edges: 12, polygons: 6, triangles: 12 }]);
    eq('InfoSelection: logs the counts and the unattested report layout', [logFrom(l).some(t => /^InfoSelection: cube .*8 points, 12 edges, 6 polygons, 12 triangles/.test(t)), logFrom(l).some(t => /^InfoSelection: 1 object\(s\); not yet attested: layout/.test(t))], [true, true]);
    reset(); r = run('InfoSelection', { InputObjs: 'cube,grid' }); eq('InfoSelection: InputObjs', r.v.map(x => x.name), ['cube', 'grid']); }
  { reset(); const l = A.log.length; r = run('InfoScene'); const objs = [...A.scene.allObjects()];
    eq('InfoScene: general counts', [r.v.general.objects, r.v.general.groups, r.v.general.layers, r.v.general.models], [objs.length, A.scene.groupList.length, A.scene.layers.length, 1]);
    eq('InfoScene: rendering + animation blocks', [r.v.rendering.passes, r.v.rendering.materials, r.v.animation.fcurves > 0], [A.scene.passes.length, A.scene.materials.length, true]);
    eq('InfoScene: logs the unattested report layout', logFrom(l).some(t => t === 'InfoScene: not yet attested: layout of the Info Scene report window'), true);
    r = run('InfoScene', { DoGeneral: false, DoAnimation: false }); eq('InfoScene: Do... flags pick the blocks', Object.keys(r.v), ['rendering']); }

  // ================================================================ groups
  const members = g => names(g.members);
  const undoRedo = (label, read, before, after) => { A.undo(); const u = read(); A.redo(); const rd = read(); eq(`${label}: undo / redo`, [u, rd], [before, after]); };
  reset(); let n0 = A.scene.groupList.length;
  r = run('SICreateGroup', { Name: 'GA' }); const GA = r.v;
  eq('SICreateGroup: empty group under the scene root, returned, nothing selected', [GA?.name, members(GA), GA?.parent === A.scene.root, A.scene.groupList.length - n0, selNames()], ['GA', [], true, 1, []]);
  undoRedo('SICreateGroup', () => A.scene.groupList.includes(GA), false, true);
  r = run('SICreateGroup', { Name: 'GA' });
  eq('SICreateGroup: unique name', r.v?.name, 'GA1'); A.undo();
  r = run('SICreateGroup', { Name: 'GInMdl', Parent: 'Mdl' });
  eq('SICreateGroup: Parent model', r.v?.parent === mdl, true); A.undo();
  eq('SICreateGroup: Parent must be a model', run('SICreateGroup', { Parent: 'cube' }).err, 'Parent "cube" is not a model');

  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' }); r = run('AddToGroup', { Target: 'GA' });
  eq('AddToGroup: adds the selection, selection unchanged, no return value', [members(GA), selNames(), r.v === undefined], [['cube', 'sphere'], ['cube', 'sphere'], true]);
  undoRedo('AddToGroup', () => members(GA), [], ['cube', 'sphere']);
  run('AddToGroup', { Target: GA, InputObjs: 'sphere,root_null' });
  eq('AddToGroup: InputObjs, no duplicate members', members(GA), ['cube', 'sphere', 'root_null']);
  eq('AddToGroup: unknown group', run('AddToGroup', { Target: 'NoSuchGroup', InputObjs: 'cube' }).err, 'group "NoSuchGroup" not found');
  r = run('SIAddToGroup', { Target: 'GA', InputObjs: 'pA,cube' });
  eq('SIAddToGroup: adds and returns the objects added (OutputObj)', [members(GA), names(r.v)], [['cube', 'sphere', 'root_null', 'pA'], ['pA']]);
  undoRedo('SIAddToGroup', () => members(GA).length, 3, 4);
  r = run('SIAddToGroupLowLevel', { Target: 'GA', InputObjs: 'c1' });
  eq('SIAddToGroupLowLevel: adds and returns the object added', [members(GA), names(r.v)], [['cube', 'sphere', 'root_null', 'pA', 'c1'], ['c1']]);
  undoRedo('SIAddToGroupLowLevel', () => members(GA).length, 4, 5);

  r = run('RemoveFromGroup', { Target: 'GA', InputObjs: 'sphere,c1' });
  eq('RemoveFromGroup: removes the members', members(GA), ['cube', 'root_null', 'pA']);
  undoRedo('RemoveFromGroup', () => members(GA), ['cube', 'sphere', 'root_null', 'pA', 'c1'], ['cube', 'root_null', 'pA']);
  reset(); A.run('SelectObj', { InputObjs: 'pA' }); run('RemoveFromGroup', { Target: 'GA' });
  eq('RemoveFromGroup: default InputObjs = the selection', members(GA), ['cube', 'root_null']);
  run('RemoveFromGroup', { InputObjs: 'cube' });
  eq('RemoveFromGroup: no Target = every group holding the object', [members(GA), members(G)], [['root_null'], ['sphere']]);
  undoRedo('RemoveFromGroup (no Target)', () => [members(GA), members(G)], [['cube', 'root_null'], ['cube', 'sphere']], [['root_null'], ['sphere']]);
  run('SIRemoveFromGroup', { Target: 'GA', InputObjs: 'root_null' });
  eq('SIRemoveFromGroup: removes the member', members(GA), []);
  undoRedo('SIRemoveFromGroup', () => members(GA), ['root_null'], []);

  reset(); A.run('SelectObj', { InputObjs: 'm1,m2' }); n0 = A.scene.groupList.length; r = run('CreateGroupFromObjects', { Name: 'GM' });
  eq('CreateGroupFromObjects: group under the common model with the objects, selected', [r.v?.name, members(r.v), r.v?.parent === mdl, selNames(), A.scene.groupList.length - n0], ['GM', ['m1', 'm2'], true, ['GM'], 1]);
  undoRedo('CreateGroupFromObjects', () => A.scene.groupList.length - n0, 0, 1);
  const GM = r.v;
  reset(); r = run('CreateGroupFromObjects', { InputObjs: 'cube,m1' });
  eq('CreateGroupFromObjects: no common model -> scene root; default name Group', [/^Group\d*$/.test(r.v?.name ?? ''), members(r.v), r.v?.parent === A.scene.root], [true, ['cube', 'm1'], true]);
  A.undo();

  reset(); run('AddGroup', { Target: 'Mdl', InputObjs: 'GA' });
  eq('AddGroup: the group becomes owned by the model', GA.parent === mdl, true);
  undoRedo('AddGroup', () => GA.parent === mdl, false, true);
  eq('AddGroup: Target must be a model', run('AddGroup', { Target: 'cube', InputObjs: 'GA' }).err, 'Target "cube" is not a model');

  reset(); n0 = A.scene.groupList.length; A.select([GM]); run('RemoveGroup');
  eq('RemoveGroup: removes the selected group, members stay in the scene', [A.scene.groupList.includes(GM), A.scene.groupList.length - n0, !!find('m1'), selNames()], [false, -1, true, []]);
  undoRedo('RemoveGroup', () => A.scene.groupList.includes(GM), true, false);
  run('RemoveGroup', { InputObjs: 'GA' });
  eq('RemoveGroup: InputObjs', A.scene.groupList.includes(GA), false);
  A.undo();

  reset(); const hair = mk('hair_emitter'); reset();
  eq('SetInstanceGroup: object must be a hair object', run('SetInstanceGroup', { Object: 'cube', Group: 'GA' }).err, 'SetInstanceGroup: cube is not a group container (status 0x80070057)');
  eq('SetInstanceGroup: needs a group', run('SetInstanceGroup', { Object: 'hair_emitter' }).err, 'SetInstanceGroup: the Group list is empty (status 0x80070057)');
  { const l = A.log.length; run('SetInstanceGroup', { Object: 'hair_emitter', Group: 'GA' });
    eq('SetInstanceGroup: stores the instance group, logs the unattested instancing', [hair.instanceGroup === GA, logFrom(l).some(t => /^SetInstanceGroup: hair_emitter instance group = GA; not yet attested: instantiation/.test(t))], [true, true]);
    undoRedo('SetInstanceGroup', () => hair.instanceGroup?.name ?? null, null, 'GA'); }
  run('RemoveInstanceGroup', { Object: 'hair_emitter' });
  eq('RemoveInstanceGroup: clears the instance group', hair.instanceGroup, null);
  undoRedo('RemoveInstanceGroup', () => hair.instanceGroup?.name ?? null, 'GA', null);

  // ================================================================ layers
  const L = A.scene.layers; const lnames = () => L.map(l => l.name); const lmem = l => sorted(names([...l.members]));
  A.currentLayer = L[0];
  reset(); let l0 = L.length;
  r = run('GetCurrentLayer');
  eq('GetCurrentLayer: returns the current layer', r.v === L[0], true);
  // SICreateLayer[2], CreateLayerGroup, CutLayerParent, MoveObjectToLayer, SetCurrentLayer: CMD-B19b (src/commands/tasksB19b.ts, tasks.dll / selectionmgr.dll contract; checked by tools/compare_tasks_b19b.mjs)
  const LA = A.run('SICreateLayer', { Name: 'LA' });
  A.run('SetCurrentLayer', { Value: 'LA' });
  eq('GetCurrentLayer: follows SetCurrentLayer', run('GetCurrentLayer').v === LA, true);
  A.currentLayer = L[0];

  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' }); const cubePrev = cube.layer;
  r = run('SICreateLayerFromSelection', { Name: 'LS' }); const LS = r.v;
  eq('SICreateLayerFromSelection: new layer holding the selection', [LS?.name, lmem(LS), cube.layer === LS, sphere.layer === LS, selNames()], ['LS', ['cube', 'sphere'], true, true, ['cube', 'sphere']]);
  undoRedo('SICreateLayerFromSelection', () => [L.includes(LS), cube.layer === cubePrev || cube.layer === LS && false, cube.layer === LS], [false, true, false], [true, false, true]);
  reset(); r = run('SICreateLayerFromSelection2', { Name: 'LT', InputObjs: 'root_null,cube', LayerGroupName: 'LayerGroup' }); const LT = r.v;
  eq('SICreateLayerFromSelection2: InputObjs moved into the new layer (LayerGroupName not used, CMD-B19b)', [LT?.name, lmem(LT), lmem(LS), LT?.parentLayer ?? null, cube.layer === LT], ['LT', ['cube', 'root_null'], ['sphere'], null, true]);
  undoRedo('SICreateLayerFromSelection2', () => [L.includes(LT), lmem(LS), cube.layer === LS], [false, ['cube', 'sphere'], true], [true, ['sphere'], false]);


  const ghost = o => o.property('visibility').val('ghosting');
  reset(); A.run('SelectObj', { InputObjs: 'cube,sphere' }); const g0 = [ghost(cube), ghost(sphere)];
  run('ToggleGhosting');
  eq('ToggleGhosting: toggles Ghosting on the selection', [g0, [ghost(cube), ghost(sphere)]], [[false, false], [true, true]]);
  undoRedo('ToggleGhosting', () => [ghost(cube), ghost(sphere)], [false, false], [true, true]);
  reset(); run('ToggleGhosting', { Target: 'cube' });
  eq('ToggleGhosting: Target argument', [ghost(cube), ghost(sphere)], [false, true]);

  // selection commands never touch the undo stack
  { reset(); const u = A.undoStack.length; run('AddToSelection', { SelectionList: 'cube' }); run('SelectBranch'); run('GrowSelection', { InputObjs: 'cube.poly[0]' }); run('SelectFilter', { SelFilter: 'Edge' }); run('SelectNeighborObj', { InputObjs: 'gc' }); run('InfoScene');
    eq('selection commands add nothing to the undo stack', A.undoStack.length - u, 0); }
  // positional call through ExecuteCommand
  reset(); A.ExecuteCommand('AddToSelection', ['cube,sphere']); A.ExecuteCommand('SelectNeighborObj', ['gc', 0, 'NODE', true]);
  eq('ExecuteCommand: positional arguments', selNames(), ['cube', 'sphere', 'c2']);
  out.checks = C;
  return out;
}, { COMMANDS });
await b.close();

// ---------------------------------------------------------------- compare
const fails = [];
let checks = 0;
const check = (label, g, want) => {
  checks++;
  const ok = JSON.stringify(g) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) fails.push(`${label}: want ${JSON.stringify(want)} got ${JSON.stringify(g)}`);
};

// 1. registration
for (const c of registry) {
  const g = got.registration.find(x => x.key === c.key);
  check(`${c.key}: in registry dump`, !c.missing, true);
  check(`${c.key}: registered`, g.found, true);
  if (!g.found || c.missing) continue;
  check(`${c.key}: display name`, g.label, c.name);
  check(`${c.key}: category`, g.category, c.category);
  check(`${c.key}: arguments`, g.args, c.args);
}
// 2. default-argument runs
for (const n of COMMANDS) {
  const d = got.defaults[n];
  if (DEFAULT_ERRORS[n]) check(`${n}: default arguments raise the documented error`, DEFAULT_ERRORS[n].test(d?.err ?? ''), true);
  else check(`${n}: runs with default arguments`, d, { ok: true });
}
// 3. state checks
for (const [label, g, want] of got.checks) check(label, g, want);
// every command has at least one state check
for (const n of COMMANDS) check(`${n}: has a state check`, got.checks.some(([label]) => label.startsWith(n + ':') || label.startsWith(n + ' (')), true);
check('no page errors', pageErrors, []);

console.log(`\ncommands: ${COMMANDS.length}  checks: ${checks}  failed: ${fails.length}`);
if (fails.length) { console.log('FAIL'); for (const f of fails) console.log('  ' + f); process.exit(1); }
console.log('OK');
