// CMD-B6d: the 19 operator-applying script commands on the command bus (AddEdge, SplitPolygon, InsertCurveKnot,
// DuplicateMeshComponent, MeshSubdivideWithCenter, DuplicateUsingGeomApprox, TrimWith, Convert, the cluster centre
// commands, CreateNonOverlappingCluster, CreateSimulationBracket, ApplyDeformBySpine, ApplySpringOp,
// InspectSpringPropertiesProc, BurnAndDeleteGATOROperator, ChangeVertexColorDatatype, the symmetrize reference-plane pair).
// Checked against the "Wire contract" of docs/ghidra/cmd-b6d-operators-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated results.
// UI entries are `app.operatorsScripts.ui.<name>(args)`; output arguments are read from `app.operatorsScripts.outputs`.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_operators_script_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

// scripting name -> [registry display name, registry procedure] of the entry that is registered (the scripted one)
const ENTRIES = {
  AddEdge: ['Add Edge', 'ApplyAddEdgeFunc'], SplitPolygon: ['Split Polygon', 'ApplySplitPolygonFunc'],
  InsertCurveKnot: ['Insert Curve Knot', 'ApplyInsertCurveKnotOpFunc'], DuplicateMeshComponent: ['Duplicate Mesh Component', 'DuplicateComponentFunc'],
  MeshSubdivideWithCenter: ['PolyMesh Subdivide With Center', 'MeshSubdivideWithCenterProc'],
  DuplicateUsingGeomApprox: ['Duplicate Using Geometry Approximation', 'DuplicateUsingGeomApprox'], TrimWith: ['Trim With', 'TrimWithProc'],
  Convert: ['Convert', 'Convert'], CreateClusterCenter: ['Deform by Cluster Center with Nulls Creation', 'CreateClusterCenterProc'],
  CreateClusterCenterWithNull: ['Deform by Cluster Center with Nulls Creation', 'CreateClusterCenterWithNullFunc'],
  CreateNonOverlappingCluster: ['Create Non-Overlapping Cluster', 'CreateNonOverlappingClusterProc'],
  CreateSimulationBracket: ['Create Simulation Bracket', 'CreateSimulationBracketProc'], ApplyDeformBySpine: ['Deform by Spine', 'ApplyDeformBySpineFunc'],
  ApplySpringOp: ['ApplySpringOp', 'ApplySpringOpProc'], InspectSpringPropertiesProc: ['Inspect Spring Properties', 'InspectSpringPropertiesProc'],
  BurnAndDeleteGATOROperator: ['Burn GATOR Operator', 'BurnAndDeleteGATOROperator'], ChangeVertexColorDatatype: ['Change VertexColor Datatype', 'ChangeVertexColorDatatypeFunc'],
  SetSymmetrizePolygonOpRefPlane: ['Set SymmetrizePolygonOp RefPlane', 'SetSymmetrizePolygonOpRefPlane'],
  SetRefPlaneFromSymmetrizePolygonOp: ['Set RefPlane From SymmetrizePolygonOp', 'SetRefPlaneFromSymmetrizePolygonOp'],
};
const NAMES = Object.keys(ENTRIES);
const UI = ['AddEdge', 'SplitPolygon', 'InsertCurveKnot', 'DuplicateMeshComponentMultiple', 'DuplicateMeshComponentSingle', 'CreateClusterCenterWithNull', 'ApplyDeformBySpine'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = list.find(x => x.scripting_name === n && x.name === ENTRIES[n][0] && x.handler === ENTRIES[n][1]);
  return [n, c ? { args: c.args.map(a => [a.name, a.default ?? null]), label: c.name, category: c.category ?? '' } : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SetRefPlaneFromSymmetrizePolygonOp'), null, { timeout: 120000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, UI }) => {
  const app = window.Application; const S = app.operatorsScripts; const root = app.scene.root;
  const out = {};
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.type}` : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const call = (f) => { try { const v = f(); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const pub = (r) => r.err !== undefined ? { err: r.err } : { v: r.v };
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const find = (n) => app.scene.find(n);
  const names = () => [...app.scene.allObjects()].map(o => o.name);
  const gpos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]].map(r4); };
  const lpos = (o) => ['posx', 'posy', 'posz'].map(n => r4(o.kinematics.local.val(n)));
  const sel = () => app.selection.map(n => n.name);
  let inspected = 0; app.events.on('inspect', () => { inspected++; });
  const inspects = (f) => { const b = inspected; const keep = app.autoInspect; app.autoInspect = true; try { f(); } finally { app.autoInspect = keep; } return inspected - b; };
  const Operator = Object.getPrototypeOf(find('cube').primitive.operators[0].constructor);
  const Property = root.properties[0].constructor;
  const cubeNew = (name) => { const o = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name }); app.select([]); app.compSel = null; return o; };
  const nullNew = (name, p) => { const o = app.run('GetPrim', { PresetObj: 'Null', Name: name }); if (p) { o.kinematics.local.set('posx', p[0]); o.kinematics.local.set('posy', p[1]); o.kinematics.local.set('posz', p[2]); } app.select([]); return o; };
  const mesh = (o) => o.primitive.mesh();
  const counts = (o) => { const m = mesh(o); return [m.positions.length / 3, m.polygons.length]; };
  const vert = (o, i) => { const m = mesh(o); return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]; };
  const edges = (o) => { const seen = new Set(), l = []; for (const f of mesh(o).polygons) for (let i = 0; i < f.length; i++) { const a = Math.min(f[i], f[(i + 1) % f.length]), b = Math.max(f[i], f[(i + 1) % f.length]); if (!seen.has(a + '-' + b)) { seen.add(a + '-' + b); l.push([a, b]); } } return l; };
  const ops = (o) => o.primitive.operators.map(x => x.type);
  const pv = (op, ns) => ns.map(n => op.val(n));
  const outs = (n) => ({ ...S.outputs[n] });
  const sessionOf = () => app.miscDsScripts?.session ?? null;
  const closeBoxes = () => { const n = document.querySelectorAll('.si-msgbox-window').length; document.querySelectorAll('.si-msgbox-ok').forEach(b => b.click()); return n; };
  app.autoInspect = false; app.immediate = false; app.genInputMgt = 0;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? { args: d.args.map(a => [a.name, a.default ?? null]), label: d.label ?? null, category: d.category ?? '' } : null]; }));
  out.ui = UI.map(n => typeof S.ui[n]);

  // ---- every command with default arguments, nothing selected, no user session
  out.defaults = {}; app.Interactive = false;
  for (const n of NAMES) {
    app.select([]); app.compSel = null; const m = mark(); const before = names().length;
    const r = run(n);
    out.defaults[n] = { r: pub(r), log: logFrom(m), made: names().slice(before) };
  }
  app.Interactive = true; app.select([]);
  try { app.run('SetSelFilter', { SelFilter: 'object' }); } catch { /* ignore */ }

  // ================= AddEdge
  {
    const d = {}; const o = cubeNew('ae'); const before = counts(o); const e0 = edges(o)[0]; const a0 = vert(o, e0[0]), b0 = vert(o, e0[1]);
    let r = run('AddEdge', { ConnectionSet: 'ae.edge[0]', Ratio: 25 }); const op = r.raw?.[0];
    d.edge = [r.raw?.length, op?.type, op?.val('ratioedge'), counts(o), before, outs('AddEdge').NewPointID, outs('AddEdge').NewEdgeID >= 0, outs('AddEdge').ImmediateMode];
    d.newPoint = vert(o, before[0]).map(r4); d.expectedPoint = a0.map((x, k) => r4(x + (b0[k] - x) * 0.25));
    app.undo(); d.undo = [ops(o).length, counts(o)];
    // a point and an edge of one polygon: the polygon is split through the new vertex
    const f = mesh(o).polygons[0]; const ei = edges(o).findIndex(e => e[0] === Math.min(f[0], f[1]) && e[1] === Math.max(f[0], f[1]));
    r = run('AddEdge', { ConnectionSet: `ae.pnt[${f[3]}];ae.edge[${ei}]`, Ratio: 50 });
    d.pointEdge = [r.raw?.length, counts(o), outs('AddEdge').NewPointID, outs('AddEdge').NewEdgeID >= 0];
    // two operators: both outputs stay -1
    cubeNew('ae2'); cubeNew('ae3');
    r = run('AddEdge', { ConnectionSet: 'ae2.edge[0];ae3.edge[0]', Ratio: 10 });
    d.two = [r.raw?.length, outs('AddEdge').NewPointID, outs('AddEdge').NewEdgeID];
    // immediate, scripted: frozen, nothing returned
    const o4 = cubeNew('ae4');
    r = run('AddEdge', { ConnectionSet: 'ae4.edge[0]', Ratio: 50, ImmediateMode: 'siImmediateOperation' });
    d.immediate = [r.v, ops(o4).includes('addedgeop'), counts(o4)[0], outs('AddEdge').ImmediateMode];
    // UI entry: mode from the preference, ConnectionSet rewritten, AutoInspect, operators returned in both modes
    const o5 = cubeNew('ae5'); let ui;
    let n = inspects(() => { ui = call(() => S.ui.AddEdge({ ConnectionSet: 'ae5.edge[1]', Ratio: 50, ImmediateMode: 'siImmediateOperation' })); });
    d.ui = [ui.raw?.length, ops(o5).includes('addedgeop'), outs('AddEdge').ImmediateMode, outs('AddEdge').ConnectionSet, n];
    const o6 = cubeNew('ae6'); app.immediate = true;
    n = inspects(() => { ui = call(() => S.ui.AddEdge({ ConnectionSet: 'ae6.edge[1]', Ratio: 50 })); }); app.immediate = false;
    d.uiImmediate = [ui.raw?.length, ops(o6).includes('addedgeop'), counts(o6)[0], outs('AddEdge').ImmediateMode, n];
    // UI entry on tagged components
    const o7 = cubeNew('ae7'); const e2 = edges(o7)[2]; app.selectComponents(o7, 'edge', [`${e2[0]}-${e2[1]}`]);
    ui = call(() => S.ui.AddEdge({ Ratio: 50 })); d.uiTagged = [ui.raw?.length, outs('AddEdge').ConnectionSet];
    app.select([]); app.compSel = null;
    out.addEdge = d;
  }

  // ================= SplitPolygon
  {
    const d = {}; const o = cubeNew('sp'); const before = counts(o);
    let r = run('SplitPolygon', { ConnectionSet: 'sp.poly[0]' }); let op = r.raw?.[0];
    d.vertices = [r.raw?.length, op?.type, pv(op, ['tanx', 'tany', 'tanz', 'splittype']), counts(o), before, outs('SplitPolygon').NewPointID];
    const o2 = cubeNew('sp2');
    r = run('SplitPolygon', { ConnectionSet: 'sp2.poly[0]', TanX: 0.1, TanY: 0.2, TanZ: 1, SplitPolygonType: ':siByTheEdgesMidPoints:siSplitPolygonType' }); op = r.raw?.[0];
    d.midpoints = [pv(op, ['tanx', 'tany', 'tanz', 'splittype']), counts(o2), outs('SplitPolygon').NewPointID];
    const o3 = cubeNew('sp3'); const f = mesh(o3).polygons[0]; const c = [0, 1, 2].map(k => f.reduce((s, v) => s + vert(o3, v)[k], 0) / f.length);
    run('SplitPolygon', { ConnectionSet: 'sp3.poly[0]', TanZ: 1 }); const p = vert(o3, outs('SplitPolygon').NewPointID);
    d.tanz = r4(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    const o4 = cubeNew('sp4'); let ui; const n = inspects(() => { ui = call(() => S.ui.SplitPolygon({ ConnectionSet: 'sp4.poly[1]' })); });
    d.ui = [ui.raw?.length, outs('SplitPolygon').ConnectionSet, outs('SplitPolygon').ImmediateMode, n, counts(o4)];
    out.split = d;
  }

  // ================= InsertCurveKnot
  {
    const d = {}; const c = app.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'ik' }); app.select([]);
    const before = c.primitive.curve().cvs.length; const degree = c.primitive.curve().degree;
    let r = run('InsertCurveKnot', { ConnectionSet: 'ik' }); let op = r.raw?.[0];
    d.scripted = [r.raw?.length, op?.type, op?.val('Multiplicity'), c.primitive.curve().cvs.length - before];
    let ui; const n = inspects(() => { ui = call(() => S.ui.InsertCurveKnot({ ConnectionSet: 'ik' })); });
    d.ui = [ui.raw?.length, ui.raw?.[0]?.val('Multiplicity'), n, outs('InsertCurveKnot').ConnectionSet, outs('InsertCurveKnot').ImmediateMode, degree];
    r = run('InsertCurveKnot', { ConnectionSet: 'ik', ImmediateMode: 'siImmediateOperation' });
    d.immediate = [r.v, ops(c).includes('InsertCrvKnot')];
    out.knot = d;
  }

  // ================= DuplicateMeshComponent
  {
    const d = {}; const P = ['subdivs', 'length', 'merge', 'sx', 'sy', 'sz', 'rx', 'ry', 'rz', 'tx', 'ty', 'tz', 'duplicate'];
    const o = cubeNew('dm'); const before = counts(o);
    let r = run('DuplicateMeshComponent', { ConnectionSet: 'dm.poly[0]', Length: 2, NbSubdivs: 1, Tx: 0.5 }); let op = r.raw?.[0];
    d.scripted = [r.raw?.length, op?.type, pv(op, P), counts(o)[0] > before[0]];
    const o2 = cubeNew('dm2'); let ui; S.prefs.duplicate.sx = 2; S.prefs.duplicate.tz = 3;
    let n = inspects(() => { ui = call(() => S.ui.DuplicateMeshComponentMultiple({ ConnectionSet: 'dm2.poly[0]' })); });
    d.multiple = [ui.raw?.length, pv(ui.raw?.[0], P), n, outs('DuplicateMeshComponent').Sx, outs('DuplicateMeshComponent').DuplicatePolygons, outs('DuplicateMeshComponent').ConnectionSet, ops(o2).includes('extrudecompaxisop')];
    cubeNew('dm3'); S.prefs.duplicate.polygons = 1;
    n = inspects(() => { ui = call(() => S.ui.DuplicateMeshComponentSingle({ ConnectionSet: 'dm3.poly[0]', Sx: 7, DuplicatePolygons: true })); });
    d.singleKept = [pv(ui.raw?.[0], P), n];
    cubeNew('dm4');
    ui = call(() => S.ui.DuplicateMeshComponentSingle({ ConnectionSet: 'dm4.poly[0]', DuplicatePolygons: false })); d.singlePref1 = ui.raw?.[0]?.val('duplicate');
    S.prefs.duplicate.polygons = 0; cubeNew('dm5');
    ui = call(() => S.ui.DuplicateMeshComponentSingle({ ConnectionSet: 'dm5.poly[0]', DuplicatePolygons: false })); d.singlePref0 = ui.raw?.[0]?.val('duplicate');
    S.prefs.duplicate.sx = 1; S.prefs.duplicate.tz = 0;
    out.dup = d;
  }

  // ================= MeshSubdivideWithCenter
  {
    const d = {}; const o = cubeNew('ms'); o.kinematics.local.set('posx', 3); app.select([o]);
    let before = new Set(names()); let m = mark();
    let r = run('MeshSubdivideWithCenter'); let made = find(names().find(n => !before.has(n)));
    d.keep = [r.v, made?.name, ops(made), counts(made)[1], counts(o)[1], lpos(made), sel(), o.visible, !!find('ms'), outs('MeshSubdivideWithCenter').ImmediateMode, outs('MeshSubdivideWithCenter').GenOpInputsDisposal, /ms$/.test(outs('MeshSubdivideWithCenter').ConnectionSet)];
    // auto-inspect on: inputs kept whatever the preference, the operator is inspected (persistent)
    app.genInputMgt = 2; app.select([o]);
    const n = inspects(() => { run('MeshSubdivideWithCenter', { ConnectionSet: 'ms' }); });
    d.inspectOn = [n, !!find('ms'), outs('MeshSubdivideWithCenter').GenOpInputsDisposal];
    // hide
    app.genInputMgt = 1; app.select([o]); run('MeshSubdivideWithCenter');
    d.hide = [o.visible, outs('MeshSubdivideWithCenter').GenOpInputsDisposal];
    // delete with a persistent preference: immediate for this call, preference put back
    app.genInputMgt = 2; const o2 = cubeNew('msd'); app.select([o2]); before = new Set(names()); m = mark();
    run('MeshSubdivideWithCenter'); made = find(names().find(n => !before.has(n)));
    d.del = [!!find('msd'), ops(made), counts(made)[1], app.immediate, outs('MeshSubdivideWithCenter').ImmediateMode, outs('MeshSubdivideWithCenter').GenOpInputsDisposal, sel()[0] === made?.name];
    app.genInputMgt = 0; app.select([]);
    m = mark(); r = run('MeshSubdivideWithCenter', { PresetObj: 'Loft', ConnectionSet: 'ms' }); d.otherPreset = logFrom(m).some(l => /not yet attested: generator preset "Loft"/.test(l));
    out.subdiv = d;
  }

  // ================= DuplicateUsingGeomApprox
  {
    const d = {}; const o = cubeNew('dg'); o.kinematics.local.set('posy', 2);
    let before = new Set(names()); let r = run('DuplicateUsingGeomApprox', { InputObjs: 'dg' }); let made = find(names().find(n => !before.has(n)));
    d.level0 = [r.raw?.length, r.raw?.[0] === made, ops(made).length, counts(made), sel()[0] === made?.name];
    let ga = o.properties.find(p => p.type === 'geomapprox'); const hasParam = !!ga?.get('gapproxmosl');
    if (ga && hasParam) ga.set('gapproxmosl', 2);
    before = new Set(names()); const m = mark(); r = run('DuplicateUsingGeomApprox', { InputObjs: 'dg' }); made = find(names().find(n => !before.has(n)));
    d.level2 = [hasParam, r.raw?.length, ops(made), counts(made)[1], counts(o)[1], lpos(made), sel()[0] === made?.name, ops(o).length];
    d.transferNote = logFrom(m).some(l => /not yet attested: the property transfer/.test(l));
    out.geomApprox = d;
  }

  // ================= TrimWith
  {
    const d = {}; const o = cubeNew('tw'); const trim = new Operator('TrimOp', 'trimop', [{ name: 'trimwithmode', type: 'int', value: 1 }]); o.primitive.addOperator(trim);
    let m = mark(); let r = run('TrimWith', { InputObjs: [trim], TrimWithSrfCrv: 'surf.srfcrv[1,3],other,surf2.srfcrv[5]' });
    d.list = [r.v, S.lastTrimWith?.TrimWithCrvIndexArray, S.lastTrimWith?.TrimWithGlobalToLocalBool, S.lastTrimWith?.applied, trim.val('trimwithmode'), outs('TrimWith').TrimWithSrfCrv, sel(), logFrom(m).some(l => /not yet attested: the low-level trim command/.test(l))];
    trim.set('trimwithmode', 1); S.lastTrimWith = null;
    run('TrimWith', { InputObjs: [trim], TrimWithSrfCrv: 'notacurve' }); d.noIndex = [S.lastTrimWith, trim.val('trimwithmode')];
    // interactive: mode 0 while picking, left adds, middle removes, right ends
    run('TrimWith', { InputObjs: [trim] }); let s = sessionOf();
    d.session = s ? [s.command, s.filter, s.prompt, s.middlePrompt, trim.val('trimwithmode'), app.selFilter ?? null] : null;
    s?.pick('surf.srfcrv[2]', 1); s?.pick('surf.srfcrv[5]', 1); s?.pick('surf.srfcrv[2]', 2); s?.pick(null, 0);
    d.picked = [S.lastTrimWith?.TrimWithCrvIndexArray, trim.val('trimwithmode'), outs('TrimWith').TrimWithSrfCrv, sessionOf() === null];
    // nothing picked: the remembered mode is put back
    trim.set('trimwithmode', 1); S.lastTrimWith = null; run('TrimWith', { InputObjs: [trim] }); sessionOf()?.pick(null, 0);
    d.cancel = [S.lastTrimWith, trim.val('trimwithmode')];
    app.Interactive = false; m = mark(); run('TrimWith', { InputObjs: [trim] }); app.Interactive = true;
    d.batch = [trim.val('trimwithmode'), logFrom(m).some(l => /picking surface curves needs a user session/.test(l))];
    try { app.run('SetSelFilter', { SelFilter: 'object' }); } catch { /* ignore */ }
    out.trim = d;
  }

  // ================= Convert
  {
    const d = {}; const o = cubeNew('cv'); let m = mark(); let r = run('Convert', { Target: 'MeshSurface', Source: 'cv' });
    d.missing = [r.v, logFrom(m).some(l => /not yet attested: the conversion is the C\+\+ command SIConvert/.test(l))];
    const key = ['SI', 'Convert'].join(''); let seen = null;
    app.register({ name: key, args: [{ name: 'Target' }, { name: 'Source' }], execute: (_a, a) => { seen = [a.Target, a.Source]; return { CreatedObj: o.primitive.operators[0], OutputObj: [o] }; } });
    const n = inspects(() => { r = run('Convert', { Target: 'MeshSurface', Source: 'cv' }); });
    app.commands.delete(key);
    d.delegated = [r.v, seen, sel(), n];
    app.select([]);
    out.convert = d;
  }

  // ================= CreateClusterCenter
  {
    const d = {}; const o = cubeNew('cc');
    const cluster = (obj, kind, items, name) => { app.selectComponents(obj, kind, items); const c = app.run('CreateCluster', { Name: name }); app.select([]); app.compSel = null; return c; };
    const c1 = cluster(o, 'point', [0, 1], 'A'); const c2 = cluster(o, 'polygon', [0], 'B');
    const mid = (pts) => [0, 1, 2].map(k => r4(pts.reduce((s, p) => s + p[k], 0) / pts.length));
    const cA = mid([vert(o, 0), vert(o, 1)]); const cB = mid(mesh(o).polygons[0].map(v => vert(o, v)));
    let r = run('CreateClusterCenter', { InputObjs: [c1] }); let nul = find('cc_A_ClsCtr');
    d.one = [r.raw?.length, r.raw?.[0]?.name, nul?.parentObj?.name, nul ? gpos(nul) : null, cA, sel(), ops(o).length];
    // several clusters, SupplyMode true: one null for all, moved to the mean of the centres
    const o2 = cubeNew('cd'); const d1 = cluster(o2, 'point', [0, 1], 'A'), d2 = cluster(o2, 'polygon', [0], 'B');
    const before = mesh(o2).positions.slice();
    r = run('CreateClusterCenter', { InputObjs: [d1, d2] }); nul = find('cd_ClsCtr');
    d.shared = [r.raw?.length, nul?.parentObj?.name, nul ? gpos(nul) : null, mid([cA, cB]), sel(), names().filter(n => /^cd_.*ClsCtr/.test(n)).length, mesh(o2).positions.every((x, i) => Math.abs(x - before[i]) < 1e-6)];
    // moving the null moves the cluster's points
    const only = mesh(o2).polygons[0].find(v => v > 1);   // a point of cluster B only
    nul.kinematics.local.set('posy', nul.kinematics.local.val('posy') + 1); d.deforms = [r4(vert(o2, only)[1] - before[only * 3 + 1]), r4(vert(o2, 0)[1] - before[1]) > 0];
    // supplied null: nothing created
    const o3 = cubeNew('ce'); const e1 = cluster(o3, 'point', [2, 3], 'A'); const mine = nullNew('myNull', [1, 1, 1]); const count = names().length;
    r = run('CreateClusterCenter', { InputObjs: [e1], S3D_CMDARG_NULLLIST: [mine], ConstructionMode: 'siConstructionModeAnimation' });
    d.supplied = [r.raw?.length, names().length - count, sel(), r.raw?.[0]?.region, lpos(mine)];
    // SupplyMode false and no null: a pick
    const o4 = cubeNew('cf'); const f1 = cluster(o4, 'point', [0], 'A'); const pickMe = nullNew('pickMe', [2, 0, 0]);
    r = run('CreateClusterCenter', { InputObjs: [f1], SupplyMode: false }); const s = sessionOf();
    d.pickSession = [s?.command ?? null, r.raw?.length];
    s?.pick(pickMe, 1);
    d.picked = [r.raw?.length, r.raw?.[0]?.region, sel(), (outs('CreateClusterCenter').S3D_CMDARG_NULLLIST ?? []).map(n => n.name), sessionOf() === null];
    app.Interactive = false; const o5 = cubeNew('cg'); const g1 = cluster(o5, 'point', [0], 'A'); let m = mark();
    r = run('CreateClusterCenter', { InputObjs: [g1], SupplyMode: false });
    d.batchPick = [r.raw?.length, logFrom(m)]; app.Interactive = true;
    // tagged components are turned into a cluster first
    const o6 = cubeNew('ch'); app.selectComponents(o6, 'point', [4, 5]);
    r = run('CreateClusterCenter'); d.tagged = [r.raw?.length, o6.clusters.length, o6.clusters[0]?.compKind, app.compSel === null, sel().length];
    // nothing to work on, user session: the message box
    app.select([]); m = mark(); r = run('CreateClusterCenter'); await new Promise(res => setTimeout(res, 30));
    d.box = [r.v, logFrom(m), closeBoxes()];
    out.center = d;

    // ================= CreateClusterCenterWithNull
    const w = {}; const p = cubeNew('wa'); const w1 = cluster(p, 'point', [0, 1], 'A'), w2 = cluster(p, 'polygon', [0], 'B');
    let n = inspects(() => { r = run('CreateClusterCenterWithNull', { InputObjs: [w1] }); }); nul = find('wa_A_ClsCtr');
    w.one = [r.raw?.length, r.raw?.[0]?.name, nul?.parentObj?.name, nul ? gpos(nul) : null, cA, sel(), n];
    const p2 = cubeNew('wb'); const x1 = cluster(p2, 'point', [0, 1], 'A'), x2 = cluster(p2, 'polygon', [0], 'B');
    r = run('CreateClusterCenterWithNull', { InputObjs: [x1, x2], ConstructionMode: 'siConstructionModeAnimation' }); nul = find('wb_ClsCtr');
    w.sameObject = [r.raw?.length, nul?.parentObj?.name, nul ? gpos(nul) : null, mid([cA, cB]), r.raw?.map(o => o.region)];
    const p3 = cubeNew('wc'); const y1 = cluster(p3, 'point', [0, 1], 'A'); const cnt = names().length;
    r = run('CreateClusterCenterWithNull', { InputObjs: [w2, y1] }); nul = app.selection[0];
    w.twoObjects = [r.raw?.length, nul?.name, nul?.parentObj === root, names().length - cnt, r.raw?.[0]?.region];
    const p4 = cubeNew('wd'); const z1 = cluster(p4, 'point', [0], 'A');
    n = inspects(() => { r = call(() => S.ui.CreateClusterCenterWithNull({ InputObjs: [z1] })); });
    w.proc = [r.raw?.length, n];
    app.select([]); m = mark(); r = run('CreateClusterCenterWithNull'); w.funcFail = [r.v, logFrom(m)];
    app.Interactive = false; m = mark(); r = call(() => S.ui.CreateClusterCenterWithNull()); w.procFail = [r.v, logFrom(m)]; app.Interactive = true;
    out.centerWithNull = w;

    // ================= CreateNonOverlappingCluster
    const v = {}; const q = cubeNew('no'); cluster(q, 'point', [0, 1], 'Existing'); cluster(q, 'polygon', [0, 1, 2], 'Polys');
    app.selectComponents(q, 'point', [1, 2, 3]); r = run('CreateNonOverlappingCluster');
    const made = q.clusters.find(c => !['Existing', 'Polys'].includes(c.name));
    v.made = [r.v, q.clusters.map(c => c.name).length, made?.compKind, made ? [...made.elements].sort() : null, app.selection.length === 1 && app.selection[0] === made, q.clusters.some(c => c.name === 'tagged_nonoverlap')];
    app.selectComponents(q, 'point', [0, 1]); const nc = q.clusters.length; r = run('CreateNonOverlappingCluster');
    v.allInCluster = [q.clusters.length - nc, app.selection.length];
    r = run('CreateNonOverlappingCluster', { InputObjs: [w1] }); v.noTagged = r.err ?? null;
    app.select([]); app.compSel = null;
    out.nonOverlap = v;
  }

  // ================= CreateSimulationBracket
  {
    const d = {}; const o = cubeNew('sb'); const base = ops(o).length; const envBefore = [...app.scene.allObjects()].filter(x => x.get('simenv')).length;
    let r = run('CreateSimulationBracket', { ConnectionSet: 'sb' }); const env = [...app.scene.allObjects()].find(x => x.get('simenv'));
    d.object = [r.v, ops(o).slice(base), o.properties.some(p => p.name === 'Simulation Settings'), envBefore, env?.properties.filter(p => p.type === 'environmentcache').map(p => p.name), env?.properties.some(p => p.type === 'simtimectrl')];
    const ev = o.primitive.operators.find(x => x.type === 'Evolve'); d.evolve = [Object.keys(ev?.connections ?? {}), ev?.connections?.settings?.name];
    r = run('CreateSimulationBracket', { ConnectionSet: 'sb' }); d.again = [r.v, ops(o).length - base, o.properties.filter(p => p.name === 'Simulation Settings').length];
    const nul = nullNew('sbn'); let m = mark(); r = run('CreateSimulationBracket', { ConnectionSet: [nul] });
    const target = nul.primitive ?? nul;
    d.nullFirst = [r.v, S.outConnections(target).map(x => [x.name, x.type]), logFrom(m).filter(l => /^info:checking : /.test(l)).length];
    m = mark(); run('CreateSimulationBracket', { ConnectionSet: [nul] });
    d.nullAgain = [S.outConnections(target).length, logFrom(m).filter(l => /^info:checking : .*, type: /.test(l)).length];
    const ice = new Property('ICETree', 'ICEProperty', []); o.addProperty(ice); run('CreateSimulationBracket', { ConnectionSet: [ice] });
    d.ice = S.outConnections(ice).map(x => [x.name, x.type]);
    const o2 = cubeNew('sbm'); o2.primitive.addOperator(new Operator('Mixer', 'MixerOp', [])); const b2 = ops(o2).length; m = mark();
    r = run('CreateSimulationBracket', { ConnectionSet: 'sbm' }); d.mixer = [r.v, ops(o2).length - b2, logFrom(m).filter(l => /^error:The object .*sbm has a mixer connected\. Cannot add a simulated ICE tree\.$/.test(l)).length];
    out.bracket = d;
  }

  // ================= ApplyDeformBySpine
  {
    const d = {}; const o = cubeNew('ds'); app.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'spine' }); app.select([]); const base = ops(o).length;
    let r = run('ApplyDeformBySpine', { ConnectionSet: 'ds;spine', ConstructionMode: 'siConstructionModeAnimation' });
    const added = o.primitive.operators[o.primitive.operators.length - 1];
    d.func = [pub(r).err ?? null, ops(o).length - base, added?.type, added?.region];
    const o2 = cubeNew('ds2'); let ui; app.select([o2, find('spine')]);
    const n = inspects(() => { ui = call(() => S.ui.ApplyDeformBySpine()); });
    d.proc = [ui.err ?? null, ops(o2).length > 1, n, outs('ApplyDeformBySpine').ConnectionSet.split(';').length >= 1 && /ds2/.test(outs('ApplyDeformBySpine').ConnectionSet)];
    app.select([]);
    out.spine = d;
  }

  // ================= ApplySpringOp / InspectSpringPropertiesProc
  {
    const d = {}; const par = nullNew('springParent', [1, 1, 0]); const driven = nullNew('driven', [3, 5, 3]); par.addChild(driven);   // global (4, 6, 3)
    const anchor = nullNew('anchor', [1, 2, 3]); const outArr = [];
    let m = mark(); let r = run('ApplySpringOp', { InputObjs: [driven, anchor], OutputObjs: outArr }); const o = outs('ApplySpringOp'); const op = o.OutputObjs?.[0];
    d.apply = [r.v, op?.type, pv(op, ['Mass', 'LinearStiffness', 'LinearDamping', 'AngularStiffness', 'AngularDamping']), pv(op, ['RestPosX', 'RestPosY', 'RestPosZ']).map(r4), pv(op, ['InitialStatePosX', 'InitialStatePosY', 'InitialStatePosZ']).map(r4), pv(op, ['InitialStateVelX', 'InitialStateVelY', 'InitialStateVelZ'])];
    d.time = pv(op.simtimectrl, ['playmode', 'SynchWithSceneStart', 'SynchWithSceneEnd']);
    d.wiring = [S.outConnections(driven.kinematics.global).map(x => x.type), /SpringCacheSource$/.test(o.SpringCache), root.properties.some(p => p.name === 'SpringCacheSource' && p.type === 'actionsource'), outArr[0] === op, sel(), logFrom(m).some(l => /not yet attested: the spring simulation itself/.test(l))];
    r = run('ApplySpringOp', { InputObjs: [driven, anchor], Mass: 5, LinearStiffness: 7, LinearDamping: 9, SpringCache: 'given.cache' }); const op2 = outs('ApplySpringOp').OutputObjs[0];
    d.given = [pv(op2, ['Mass', 'LinearStiffness', 'LinearDamping', 'AngularStiffness', 'AngularDamping']), outs('ApplySpringOp').SpringCache, root.properties.filter(p => p.type === 'actionsource' && /^SpringCacheSource/.test(p.name)).length];
    r = run('ApplySpringOp', { InputObjs: [driven] }); d.oneInput = r.err ?? null;
    // inspect: the input is the parent node of the spring-driven object
    let n = inspects(() => { r = run('InspectSpringPropertiesProc', { InputObjs: [par] }); });
    d.inspect = [r.v, outs('InspectSpringPropertiesProc').inspected.length, outs('InspectSpringPropertiesProc').inspected.every(x => /driven\.Kinematics\.Global$/.test(x)), n];
    m = mark(); n = inspects(() => { r = run('InspectSpringPropertiesProc', { InputObjs: [anchor] }); });
    d.inspectNone = [outs('InspectSpringPropertiesProc').inspected.length, n, logFrom(m).some(l => /not yet attested: InspectObj with an empty list/.test(l))];
    app.select([par]); run('InspectSpringPropertiesProc'); d.inspectSelection = outs('InspectSpringPropertiesProc').inspected.length; app.select([]);
    out.spring = d;
  }

  // ================= BurnAndDeleteGATOROperator
  {
    const d = {}; const o = cubeNew('gb'); const b1 = nullNew('boneA', [0, 2, 0]), b2 = nullNew('boneB', [0, -2, 0]);
    app.select([o, b1, b2]); app.run('ApplyFlexEnv'); app.select([]); app.compSel = null;
    const env = o.primitive.operators.find(x => x.type === 'envelopop'); const Env = env.constructor; const n = env.weights.length;
    env.weights = Array.from({ length: n }, () => new Float32Array([0.25, 0.75]));
    const gator = new Env([b1, b2], () => o); gator.weights = Array.from({ length: n }, (_, i) => new Float32Array(i % 2 ? [0.6, 0] : [0, 0])); o.primitive.addOperator(gator);
    app.selectComponents(o, 'point', [0, 1, 2, 3]); const cluster = app.run('CreateCluster', { Name: 'GatorCls' }); app.select([]); app.compSel = null;
    const ep = new Property('Envelope_Weights', 'envelope', []); ep.op = gator; cluster.addProperty(ep);
    const op = new Operator('Gator', 'TransferAttributes', []); op.cluster = cluster; o.primitive.addOperator(op);
    const outArr = []; let r = run('BurnAndDeleteGATOROperator', { InputObj: op, OutputObjs: outArr });
    d.burn = [r.v, outArr.length, outArr[0] === cluster, Array.from(env.weights[0]).map(r4), Array.from(env.weights[1]).map(r4), Array.from(gator.weights[1]).map(r4), o.clusters.includes(cluster), o.primitive.operators.includes(op)];
    app.undo(); d.undo = Array.from(env.weights[1]).map(r4);
    const other = new Operator('Other', 'twistop', []); const out2 = []; r = run('BurnAndDeleteGATOROperator', { InputObj: other, OutputObjs: out2 }); d.notGator = [r.v, out2.length];
    const o2 = cubeNew('gb2'); const lone = new Operator('Gator', 'TransferAttributes', []); o2.primitive.addOperator(lone); const out3 = [];
    r = run('BurnAndDeleteGATOROperator', { InputObj: lone, OutputObjs: out3 }); d.oneEnvelope = [r.v, out3.length];
    out.gator = d;
  }

  // ================= ChangeVertexColorDatatype
  {
    const d = {}; const o = cubeNew('vc'); app.run('AddProp', { PresetObj: 'Color At Vertices Map', InputObjs: [o] }); app.select([]);
    const prop = o.allProperties().find(p => p.type === 'vertexcolor'); const base = ops(o).length; const outArr = [];
    let m = mark(); let r = run('ChangeVertexColorDatatype', { InputObj: [prop] }); d.same = [!!prop, r.v, logFrom(m), ops(o).length - base, prop?.val('datatype')];
    r = run('ChangeVertexColorDatatype', { InputObj: [prop], DesiredDatatype: 1, OutputObjs: outArr }); const op = r.raw?.[0];
    o.primitive.geom();
    d.install = [r.raw?.length, op?.type, op?.val('desireddatatype'), ops(o).length - base, outArr[0] === op, outs('ChangeVertexColorDatatype').OutputObjs?.[0] === op, prop?.val('datatype')];
    m = mark(); r = run('ChangeVertexColorDatatype', { InputObj: [prop], DesiredDatatype: 1 }); d.already = [r.v, logFrom(m)];
    m = mark(); r = run('ChangeVertexColorDatatype', { InputObj: [o] }); d.invalid = [r.err ?? null, logFrom(m)[0]];
    const orphan = new Property('Vertex Color', 'vertexcolor', []); m = mark(); r = run('ChangeVertexColorDatatype', { InputObj: [orphan], DesiredDatatype: 1 }); d.noInstall = [r.err ?? null, logFrom(m)[0]];
    out.vertexColor = d;
  }

  // ================= symmetrize reference plane
  {
    const d = {}; const P = ['planeposx', 'planeposy', 'planeposz', 'planerotx', 'planeroty', 'planerotz', 'planenormal'];
    const mk = (name) => { const o = cubeNew(name); app.selectComponents(o, 'polygon', mesh(o).polygons.map((_, i) => i)); const op = app.run('ApplyTopoOp', { PresetObj: 'Symmetrize Polygons' }); app.select([]); app.compSel = null; return op; };
    const a = mk('sy'), b = mk('sy2');
    P.forEach((p, i) => a.set(p, i + 1));
    let m = mark(); let r = run('SetRefPlaneFromSymmetrizePolygonOp', { RefPlane: 'Mine', InputObjs: [a] });
    const plane = S.refPlanes.get('Mine');
    d.fromOp = [a.type, r.v, plane ? ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'normal'].map(n => plane.val(n)) : null, pv(a, ['symmetryreference', 'symmetryplane']), S.currentReferencePlane, logFrom(m)];
    r = run('SetSymmetrizePolygonOpRefPlane', { InputObjs: [b], RefPlane: 'Mine' });
    d.toOp = [r.v, pv(b, P), pv(b, ['symmetryreference', 'symmetryplane'])];
    r = run('SetSymmetrizePolygonOpRefPlane', { InputObjs: [b] }); d.defaultPlane = [S.currentReferencePlane, pv(b, P)];
    m = mark(); run('SetSymmetrizePolygonOpRefPlane', { InputObjs: [b], RefPlane: 'XY' }); run('SetRefPlaneFromSymmetrizePolygonOp', { RefPlane: 'View', InputObjs: [b] }); d.badPlane = logFrom(m);
    m = mark(); run('SetSymmetrizePolygonOpRefPlane', { InputObjs: [find('sy').primitive.operators[0]] }); run('SetRefPlaneFromSymmetrizePolygonOp', { InputObjs: [a, find('sy').primitive.operators[0]] }); d.notSym = logFrom(m);
    out.symmetrize = d;
  }

  out.leftover = [sessionOf() === null, app.activeTool === null, document.querySelectorAll('.si-msgbox-window').length];
  return out;
}, { NAMES, UI });
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = '<none>'; const P = 'siPersistentOperation', I = 'siImmediateOperation';
const T1092 = 'Please tag some points or select a cluster first.';

// ---- registration
for (const n of NAMES) {
  ok(`${n}: registry entry "${ENTRIES[n][0]}" (${ENTRIES[n][1]}) found`, !!registry[n], n);
  eq(`${n}: registered with the registry's arguments, display name and category`, got.reg[n], registry[n]);
}
eq('UI entries exposed as app.operatorsScripts.ui.*', got.ui, UI.map(() => 'function'));

// ---- defaults (nothing selected, no user session)
const D = got.defaults;
const unresolved = (n, preset) => ok(`${n} defaults: empty connection set fails (contract: no guard in the script)`, new RegExp(`connection set for the ${preset} operator could not be resolved`).test(D[n].r.err ?? ''), D[n]);
unresolved('AddEdge', 'AddEdge'); unresolved('SplitPolygon', 'SplitPolygon'); unresolved('InsertCurveKnot', 'InsertNurbsCrvKnot'); unresolved('DuplicateMeshComponent', 'ExtrudeComponentAxis');
ok('MeshSubdivideWithCenter defaults: nothing generated, no message from the helper, pick flagged', D.MeshSubdivideWithCenter.r.v === NONE && D.MeshSubdivideWithCenter.made.length === 0 && D.MeshSubdivideWithCenter.log.length === 1 && /not yet attested: picking the generator inputs/.test(D.MeshSubdivideWithCenter.log[0]), D.MeshSubdivideWithCenter);
eq('DuplicateUsingGeomApprox defaults', [D.DuplicateUsingGeomApprox.r, D.DuplicateUsingGeomApprox.log], [{ v: NONE }, ['info:You need to select one or more polygon meshes first.']]);
ok('TrimWith defaults: no session without a user, flagged, nothing returned', D.TrimWith.r.v === NONE && D.TrimWith.log.some(l => /picking surface curves needs a user session/.test(l)), D.TrimWith);
ok('Convert defaults: SIConvert flagged not yet attested', D.Convert.r.v === NONE && /not yet attested: the conversion is the C\+\+ command SIConvert/.test(D.Convert.log[0] ?? ''), D.Convert);
eq('CreateClusterCenter defaults: text 1092 logged, box degraded to "Warning: ..."', [D.CreateClusterCenter.r, D.CreateClusterCenter.log], [{ v: NONE }, [`info:${T1092}`, `info:Warning: ${T1092}`]]);
eq('CreateClusterCenterWithNull defaults (Func entry): error log, no box', [D.CreateClusterCenterWithNull.r, D.CreateClusterCenterWithNull.log], [{ v: NONE }, [`error:CreateClusterCenter: ${T1092}`]]);
eq('CreateNonOverlappingCluster defaults', [D.CreateNonOverlappingCluster.r, D.CreateNonOverlappingCluster.log], [{ v: NONE }, ['info:Tag some components first']]);
ok('CreateSimulationBracket defaults: returns 0, creates the environment, container flagged', D.CreateSimulationBracket.r.v === 0 && D.CreateSimulationBracket.made.length === 1 && /^Environment/.test(D.CreateSimulationBracket.made[0]) && D.CreateSimulationBracket.log.some(l => /not yet attested: the environment container command/.test(l)), D.CreateSimulationBracket);
ok('ApplyDeformBySpine defaults: nothing applied, pick flagged', D.ApplyDeformBySpine.r.v === NONE && /not yet attested: picking the inputs/.test(D.ApplyDeformBySpine.log[0] ?? ''), D.ApplyDeformBySpine);
ok('ApplySpringOp defaults: missing inputs fail (no validation in the script)', /needs the driven object and its anchor/.test(D.ApplySpringOp.r.err ?? ''), D.ApplySpringOp);
ok('InspectSpringPropertiesProc defaults: empty list flagged (Q11)', D.InspectSpringPropertiesProc.r.v === NONE && /InspectObj with an empty list/.test(D.InspectSpringPropertiesProc.log[0] ?? ''), D.InspectSpringPropertiesProc);
eq('BurnAndDeleteGATOROperator defaults: not a GATOR operator, nothing', [D.BurnAndDeleteGATOROperator.r, D.BurnAndDeleteGATOROperator.log], [{ v: NONE }, []]);
ok('ChangeVertexColorDatatype defaults: "Invalid VertexColor property" + siErrCancelled', /siErrCancelled/.test(D.ChangeVertexColorDatatype.r.err ?? '') && D.ChangeVertexColorDatatype.log[0] === 'error:Invalid VertexColor property', D.ChangeVertexColorDatatype);
for (const n of ['SetSymmetrizePolygonOpRefPlane', 'SetRefPlaneFromSymmetrizePolygonOp']) eq(`${n} defaults`, [D[n].r, D[n].log], [{ v: NONE }, ['info:This command must be applied on a SymmetrizePolygon operator.']]);

// ---- AddEdge
const ae = got.addEdge;
eq('AddEdge on an edge: one addedgeop, ratioedge written, new point id / edge id read back, persistent', ae.edge, [1, 'addedgeop', 25, [ae.edge[4][0] + 1, ae.edge[4][1]], ae.edge[4], ae.edge[4][0], true, P]);
eq('AddEdge: the new vertex sits at the ratio on the edge (inferred geometry)', ae.newPoint, ae.expectedPoint);
eq('AddEdge: undoable', ae.undo, [1, ae.edge[4]]);
eq('AddEdge point + edge: polygon split through the new vertex', ae.pointEdge, [1, [ae.edge[4][0] + 1, ae.edge[4][1] + 1], ae.edge[4][0], true]);
eq('AddEdge with two operators: both outputs stay -1', ae.two, [2, -1, -1]);
eq('AddEdge scripted, immediate: frozen, nothing returned', ae.immediate, [NONE, false, ae.edge[4][0] + 1, I]);
eq('AddEdge UI entry: argument mode ignored (preference), ConnectionSet rewritten, inspected, operators returned', ae.ui, [1, true, P, 'ae5.edge[1]', 1]);
eq('AddEdge UI entry, immediate preference: inspected, frozen, operators still returned', ae.uiImmediate, [1, false, ae.edge[4][0] + 1, I, 1]);
eq('AddEdge UI entry on tagged components: resolved text handed back', ae.uiTagged, [1, 'ae7.edge[2]']);

// ---- SplitPolygon
const sp = got.split; const [nv, np] = sp.vertices[4];
eq('SplitPolygon by the vertices: tanx, tany, tanz, splittype written; new point id returned', sp.vertices, [1, 'splitpolygonop', [0, 0, 0, 0], [nv + 1, np - 1 + 4], [nv, np], nv]);
eq('SplitPolygon by the edge midpoints: values written, geometry (inferred)', sp.midpoints, [[0.1, 0.2, 1, 1], [nv + 5, np - 1 + 4], nv]);
eq('SplitPolygon: tanz moves the point along the polygon normal (inferred)', sp.tanz, 1);
eq('SplitPolygon UI entry: ConnectionSet rewritten, preference mode, inspected', sp.ui, [1, 'sp4.poly[1]', P, 1, [nv + 1, np + 3]]);

// ---- InsertCurveKnot
const ik = got.knot;
eq('InsertCurveKnot scripted: InsertCrvKnot operator, Multiplicity 1', ik.scripted, [1, 'InsertCrvKnot', 1, 1]);
eq('InsertCurveKnot UI entry: Multiplicity 3 by default, not inspected, ConnectionSet rewritten', [ik.ui[0], ik.ui[1], ik.ui[2], /ik$/.test(ik.ui[3]), ik.ui[4]], [1, 3, 0, true, P]);
eq('InsertCurveKnot scripted, immediate: frozen, nothing returned', ik.immediate, [NONE, false]);

// ---- DuplicateMeshComponent
const du = got.dup;
eq('DuplicateMeshComponent scripted: ExtrudeComponentAxis operator, the 13 values written', du.scripted, [1, 'extrudecompaxisop', [1, 2, true, 1, 1, 1, 0, 0, 0, 0.5, 0, 0, false], true]);
eq('DuplicateMeshComponent "Multiple": transform from the Duplicate preferences, duplicate = (polygons pref = 0), inspected, written back', du.multiple, [1, [5, 1, true, 2, 1, 1, 0, 0, 0, 0, 0, 3, true], 1, 2, true, 'dm2.poly[0]', true]);
eq('DuplicateMeshComponent "Single": NbSubdivs 0 resets the transform, a true DuplicatePolygons is kept, not inspected', du.singleKept, [[0, 0, true, 1, 1, 1, 0, 0, 0, 0, 0, 0, true], 0]);
eq('DuplicateMeshComponent "Single": a false DuplicatePolygons is replaced by the preference test', [du.singlePref1, du.singlePref0], [false, true]);

// ---- MeshSubdivideWithCenter
const ms = got.subdiv;
eq('MeshSubdivideWithCenter: generated mesh at the input position, selected, input kept, in/out arguments', ms.keep, [NONE, 'polymsh', ['MeshSubdivideWithCenter'], ms.keep[4] * 4, ms.keep[4], [3, 0, 0], ['polymsh'], true, true, P, 'siKeepGenOpInputs', true]);
eq('MeshSubdivideWithCenter with auto-inspect on: inputs kept, operator inspected', ms.inspectOn, [1, true, 'siKeepGenOpInputs']);
eq('MeshSubdivideWithCenter, geninputmgt 1: input hidden', ms.hide, [false, 'siHideGenOpInputs']);
eq('MeshSubdivideWithCenter, geninputmgt 2: immediate for the call, frozen, input deleted, preference restored', ms.del, [false, ['geom'], ms.keep[4] * 4, false, I, 'siDeleteGenOpInputs', true]);
ok('MeshSubdivideWithCenter: another preset is flagged', ms.otherPreset, ms);

// ---- DuplicateUsingGeomApprox
const ga = got.geomApprox;
eq('DuplicateUsingGeomApprox level 0: frozen duplicate, selected, returned', ga.level0, [1, true, 1, ga.level0[3], true]);
eq('DuplicateUsingGeomApprox level 2: frozen subdivided copy at the input position, original untouched', ga.level2, [true, 1, ['geom'], ga.level2[4] * 16, ga.level2[4], [0, 2, 0], true, 1]);
ok('DuplicateUsingGeomApprox: property transfer flagged (C++ command)', ga.transferNote, ga);

// ---- TrimWith
const tw = got.trim;
eq('TrimWith with a curve list: indices of the srfcrv items in order, low-level call built, mode 2, selection cleared', tw.list, [NONE, [1, 3, 5], true, false, 2, 'surf.srfcrv[1,3],other,surf2.srfcrv[5]', [], true]);
eq('TrimWith: no surface-curve item = no call, mode untouched', tw.noIndex, [null, 1]);
ok('TrimWith interactive: mode 0, SurfaceCurve pick session with prompt 1095 on the middle button', tw.session && tw.session[0] === 'TrimWith' && tw.session[1] === 'SurfaceCurve' && tw.session[3] === 'Deselect Curve To Trim With' && tw.session[4] === 0, tw.session);
eq('TrimWith interactive: left adds, middle removes, right ends; then the call and mode 2', tw.picked, [[5], 2, 'surf.srfcrv[5]', true]);
eq('TrimWith interactive, nothing picked: remembered mode put back', tw.cancel, [null, 1]);
eq('TrimWith without a user session: mode put back, flagged', tw.batch, [1, true]);

// ---- Convert
eq('Convert without SIConvert: flagged, nothing done', got.convert.missing, [NONE, true]);
eq('Convert with SIConvert on the bus: OutputObj selected, CreatedObj inspected, no return value', got.convert.delegated, [NONE, ['MeshSurface', 'cv'], ['cv'], 1]);

// ---- CreateClusterCenter
const cc = got.center;
eq('CreateClusterCenter, one cluster: null <owner>_<cluster>_ClsCtr under the owner at the cluster centre, selected', cc.one, [1, 'Cluster Center', 'cc', cc.one[4], cc.one[4], ['cc_A_ClsCtr'], cc.one[6]]);
eq('CreateClusterCenter, several clusters: one shared null <object>_ClsCtr at the mean centre, no deformation at apply time', cc.shared, [2, 'cd', cc.shared[3], cc.shared[3], ['cd_ClsCtr'], 1, true]);
eq('CreateClusterCenter: the null drives the clusters', cc.deforms, [1, true]);
eq('CreateClusterCenter with a supplied null: nothing created or moved, ConstructionMode used for the application', cc.supplied, [1, 0, ['myNull'], 'animation', [1, 1, 1]]);
eq('CreateClusterCenter SupplyMode false: pick session, null list handed back, picked null selected, mode restored', [cc.pickSession, cc.picked], [['CreateClusterCenter', 0], [1, 'modeling', ['pickMe'], ['pickMe'], true]]);
ok('CreateClusterCenter SupplyMode false without a user session: flagged, then the "nothing applied" message', cc.batchPick[0] === 0 && /not yet attested: picking the null/.test(cc.batchPick[1][0]) && cc.batchPick[1].includes(`info:${T1092}`), cc.batchPick);
eq('CreateClusterCenter on tagged components: cluster made first, tags out of the selection, null selected', cc.tagged, [1, 1, 'pnt', true, 1]);
eq('CreateClusterCenter with nothing: text 1092 logged and shown in a message box', cc.box, [NONE, [`info:${T1092}`], 1]);

// ---- CreateClusterCenterWithNull
const cw = got.centerWithNull;
eq('CreateClusterCenterWithNull, one cluster: <object>_<cluster>_ClsCtr at the centre, selected, Func entry does not inspect', cw.one, [1, 'Cluster Center', 'wa', cw.one[4], cw.one[4], ['wa_A_ClsCtr'], 0]);
eq('CreateClusterCenterWithNull, clusters of one object: <object>_ClsCtr at the mean, one operator per cluster in ConstructionMode', cw.sameObject, [2, 'wb', cw.sameObject[3], cw.sameObject[3], ['animation', 'animation']]);
eq('CreateClusterCenterWithNull, clusters of two objects: ClsCtr under the scene root; construction mode restored', cw.twoObjects, [2, 'ClsCtr', true, 1, 'modeling']);
eq('CreateClusterCenterWithNull Proc entry: inspects the operators', cw.proc, [1, 1]);
eq('CreateClusterCenterWithNull Func entry, no cluster: error log', cw.funcFail, [NONE, [`error:CreateClusterCenter: ${T1092}`]]);
eq('CreateClusterCenterWithNull Proc entry, no cluster: info log + box', cw.procFail, [NONE, [`info:CreateClusterCenter: ${T1092}`, `info:Warning: ${T1092}`]]);

// ---- CreateNonOverlappingCluster
const no = got.nonOverlap;
eq('CreateNonOverlappingCluster: cluster of the tagged components in no same-type cluster, selected, temporary cluster removed', no.made, [NONE, 3, 'pnt', [2, 3], true, false]);
eq('CreateNonOverlappingCluster: every tagged component already clustered = nothing created, selection empty', no.allInCluster, [0, 0]);
ok('CreateNonOverlappingCluster: clusters without tagged components fail (inferred)', /holds no tagged components/.test(no.noTagged ?? ''), no.noTagged);

// ---- CreateSimulationBracket
const sb = got.bracket;
eq('CreateSimulationBracket on a mesh: markers, Simulation Settings, evolve, cache named <model>_<environment>_Cache, returns 0', sb.object, [0, ['SimulationMarker', 'PostSimulationMarker', 'Evolve'], true, 1, [`Scene_Root_${got.defaults.CreateSimulationBracket.made[0]}_Cache`], true]);
eq('CreateSimulationBracket: evolve connections (target, time control, cache, settings)', sb.evolve, [['target', 'timeControl', 'cache', 'settings'], 'Simulation Settings']);
eq('CreateSimulationBracket twice: nothing added', sb.again, [0, 3, 1]);
eq('CreateSimulationBracket on a null: primitive markers (with pre-simulation) and evolve', sb.nullFirst, [0, [['PrimitiveSimulationMarker', 'simulationmarker'], ['PrimitivePostSimulationMarker', 'postsimulationmarker'], ['PrimitivePreSimulationMarker', 'presimulationmarker'], ['Evolve', 'Evolve']], 0]);
eq('CreateSimulationBracket on a null again: one "checking :" line per connection, nothing added', sb.nullAgain, [4, 4]);
eq('CreateSimulationBracket on an ICE property', sb.ice, [['ICEPropertySimulationMarker', 'simulationmarker'], ['ICEPropertyPostSimulationMarker', 'postsimulationmarker'], ['ICEPropertyPreSimulationMarker', 'presimulationmarker'], ['Evolve', 'Evolve']]);
eq('CreateSimulationBracket: an object with a mixer operator is skipped with the error, still 0', sb.mixer, [0, 0, 1]);

// ---- ApplyDeformBySpine
const sn = got.spine;
eq('ApplyDeformBySpine Func entry: SIApplyDeformBySpine applied in the given construction mode', sn.func, [null, 1, 'deformbyspineop2', 'animation']);
eq('ApplyDeformBySpine Proc entry: selection as connection set, result inspected, ConnectionSet handed back', sn.proc, [null, true, 1, true]);

// ---- ApplySpringOp / InspectSpringPropertiesProc
const sg = got.spring;
eq('ApplySpringOp: parameters in contract order (angular = linear, rest offset in the anchor space, zero velocity)', sg.apply, [NONE, 'SpringOp', [20, 100, 100, 100, 100], [3, 4, 0], [3, 4, 0], [0, 0, 0]]);
eq('ApplySpringOp: time control playmode 2, synched with scene start / end', sg.time, [2, true, true]);
eq('ApplySpringOp: spring + evolve on the driven global kinematics, SpringCacheSource added to the model, OutputObjs, no selection change, solver flagged', sg.wiring, [['SpringOp', 'Evolve'], true, true, true, [], true]);
eq('ApplySpringOp: a given SpringCache is used, no new source', sg.given, [[5, 7, 9, 7, 9], 'given.cache', 1]);
ok('ApplySpringOp with one input fails (inferred)', /needs the driven object and its anchor/.test(sg.oneInput ?? ''), sg.oneInput);
eq('InspectSpringPropertiesProc: global kinematics of the spring-driven children of the input, one entry per spring / evolve operator', sg.inspect, [NONE, 4, true, 1]);
eq('InspectSpringPropertiesProc: input that is not the parent = empty list, flagged', sg.inspectNone, [0, 0, true]);
eq('InspectSpringPropertiesProc: selection when InputObjs is empty', sg.inspectSelection, 4);

// ---- BurnAndDeleteGATOROperator
const gt = got.gator;
eq('BurnAndDeleteGATOROperator: non-zero GATOR weights overwrite (no normalisation), zero ones keep; cluster appended, nothing deleted', gt.burn, [NONE, 1, true, [0.25, 0.75], [0.6, 0.75], [0.6, 0], true, true]);
eq('BurnAndDeleteGATOROperator: undoable', gt.undo, [0.25, 0.75]);
eq('BurnAndDeleteGATOROperator: not a TransferAttributes operator / fewer than two envelopes = nothing', [gt.notGator, gt.oneEnvelope], [[NONE, 0], [NONE, 0]]);

// ---- ChangeVertexColorDatatype
const vc = got.vertexColor;
eq('ChangeVertexColorDatatype: same datatype = message, no operator', vc.same, [true, NONE, ['info:The CAV is already using the specified datatype. There is no need to install an operator'], 0, 0]);
eq('ChangeVertexColorDatatype: operator installed, desireddatatype written, returned and in OutputObjs', vc.install, [1, 'vertexcolorchangedatatype', 1, 1, true, true, 1]);
eq('ChangeVertexColorDatatype: already converted', vc.already, [NONE, ['info:The CAV is already using the specified datatype. There is no need to install an operator']]);
ok('ChangeVertexColorDatatype: not a vertex colour property = error + siErrCancelled', /siErrCancelled/.test(vc.invalid[0] ?? '') && vc.invalid[1] === 'error:Invalid VertexColor property', vc.invalid);
ok('ChangeVertexColorDatatype: operator cannot be installed = error + siErrCancelled', /siErrCancelled/.test(vc.noInstall[0] ?? '') && vc.noInstall[1] === 'error:Could not install the Vertex Color conversion operator', vc.noInstall);

// ---- symmetrize reference plane
const sy = got.symmetrize;
eq('SetRefPlaneFromSymmetrizePolygonOp: operator plane copied to RefPlanes.<name>, symmetryreference 0 / symmetryplane 3, plane made current', sy.fromOp, ['symmetrizepolygonop', NONE, [1, 2, 3, 4, 5, 6, 7], [0, 3], 'RefPlanes.Mine', []]);
eq('SetSymmetrizePolygonOpRefPlane: reference plane copied to the operator', sy.toOp, [NONE, [1, 2, 3, 4, 5, 6, 7], [0, 3]]);
eq('SetSymmetrizePolygonOpRefPlane: default plane "Transform"', sy.defaultPlane, ['RefPlanes.Transform', [0, 0, 0, 0, 0, 0, 0]]);
eq('symmetrize pair: View / XY / XZ / YZ refused', sy.badPlane, ['info:The input reference plane cannot be View, XY, XZ or YZ.', 'info:The input reference plane cannot be View, XY, XZ or YZ.']);
eq('symmetrize pair: any other operator refused', sy.notSym, ['info:This command must be applied on a SymmetrizePolygon operator.', 'info:This command must be applied on a SymmetrizePolygon operator.']);

eq('no pick session, tool or message box left open', got.leftover, [true, true, 0]);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B6d operator script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B6d operator script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired (script level): CreateClusterCenterWithNull, CreateNonOverlappingCluster, ChangeVertexColorDatatype, SetSymmetrizePolygonOpRefPlane, SetRefPlaneFromSymmetrizePolygonOp, BurnAndDeleteGATOROperator, InspectSpringPropertiesProc');
console.log('   partly wired: AddEdge, SplitPolygon, InsertCurveKnot, DuplicateMeshComponent (connection set + operator geometry inferred, no input picking), MeshSubdivideWithCenter, DuplicateUsingGeomApprox (generator stand-in, property transfer), TrimWith (low-level trim call Q7), CreateClusterCenter (pick prompt, Q3-Q5), CreateSimulationBracket (environment container, marker operators are pass-through), ApplyDeformBySpine (no picking), ApplySpringOp (no solver)');
console.log('   stand-in: Convert (SIConvert not on the bus: logs "not yet attested"; delegates when it is)');
