// CMD-B8f: the polygon / edge / slice step commands of simeshtasks and the curve drawing step commands of
// sicurvetasks on the command bus (src/commands/meshCurveStepTasks.ts, meshCurveStepTasksClusters.ts,
// meshCurveStepTasksCurves.ts). Checked against the "Wire contract" sections of
// docs/ghidra/cmd-b8f-mesh-curve-step-tasks-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check. The operators the interactive tools apply
// before they run the step commands come from the seams of `app.meshCurveStepTasks.tool`.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_mesh_curve_step_task_commands.mjs
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

const MESH = ['AddPointToNewPolygon', 'RemovePointFromPolygon', 'AddPointInteriorToPolygon', 'RemoveLastPointInteriorToPolygon', 'TerminateAddEdgeWithInteriorPoints',
  'SnapOffsetToPointForSlicePolygons', 'ConnectNewPolygonToEdge', 'ConnectNewPolygonToPoint', 'CreateMeshPartitionClusters',
  'CreateClustersAlongDepthFromCurvesToMeshOperator', 'CreateClustersFromSlicePolygonsOperator'];
const CURVE = ['SICreateCurve', 'SISetCurvePoints', 'SIAddPointOnCurve', 'SIAddPointOnCurveAtStart', 'SIAddPointOnCurveAtEnd', 'SIDeletePointOnCurve',
  'CreateCurvePartitionClusters', 'CurveDirectManip'];
const NAMES = [...MESH, ...CURVE];

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const cs = reg.filter(c => c.scripting_name === n && (c.handler_dlls ?? []).length).sort((x, y) => y.args.length - x.args.length);
  return [n, cs[0] ? cs[0].args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CurveDirectManip') && !!window.Application?.meshCurveStepTasks, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.meshCurveStepTasks;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const run = (n, a = {}) => {
    S.lastStatus = null;
    try { const v = app.run(n, a); return { v, st: hex(S.lastStatus?.status) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status) }; }
  };
  const st = (n, a) => { const r = run(n, a); return r.status ?? r.st; };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const nya = (i, re = /not yet attested/) => logFrom(i).filter(l => re.test(l)).length;
  const round = (x) => Math.round(x * 1e6) / 1e6;
  const cube = (name) => app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name });
  const objNames = () => [...app.scene.allObjects()].map(o => o.name);
  const ids = (o) => S.polygonBuilderOf(o).entries().map(e => e.id);
  const kinds = (o) => S.polygonBuilderOf(o).entries().map(e => e.kind);
  const counts = (o) => { const m = o.primitive.mesh(); return [m.positions.length / 3, m.polygons.length]; };
  const cvs = (o) => { const g = o.primitive.geom(); return g ? g.cvs.map(c => c.slice(0, 3).map(round)) : null; };

  out.registered = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  // ---- every command with default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) {
    app.select([]); const before = objNames(); const r = run(n);
    const made = objNames().filter(x => !before.includes(x));
    out.defaults[n] = [r.status ?? r.st, made.map(x => app.scene.find(x).type)];
    for (const x of made) app.run('DeleteObj', { InputObj: x });
  }

  // ================= polygon builder: AddPointToNewPolygon / RemovePointFromPolygon / ConnectNewPolygonToPoint
  {
    const d = {}; const c = cube('pbCube');
    d.noOperator = [st('AddPointToNewPolygon', { InputObj: c }), st('RemovePointFromPolygon', { InputObj: c })];
    let m = mark(); d.connectNoOperator = [run('ConnectNewPolygonToPoint', { InputObj: c, PointID: 1 }).st, run('ConnectNewPolygonToEdge', { InputObj: c, EdgeID: 0 }).st, nya(m, /Q1/)];
    const op = S.tool.applyPolygonBuilder(c); d.base = counts(c);
    const add = (x, y, z, pos = 0) => { const r = run('AddPointToNewPolygon', { InputObj: 'pbCube', X: x, Y: y, Z: z, InsertPosition: pos }); return [r.v, S.out.AddPointToNewPolygon.PolygonID, S.out.AddPointToNewPolygon.Value]; };
    d.adds = [add(10, 0, 0), add(10, 5, 0), add(12, 5, 3)];
    d.afterAdds = [op.count, counts(c), op.entries().map(e => [e.kind, e.x, e.y, e.z, e.id])];
    const last = c.primitive.mesh(); d.newPoint = [...last.positions.slice(10 * 3, 11 * 3)]; d.newPolygon = last.polygons[last.polygons.length - 1];
    d.insertAt1 = [add(11, 2, 0, 1), op.entries().map(e => [e.x, e.id])];
    app.undo(); d.undoInsert = [op.count, op.entries().map(e => e.x)];
    app.redo(); d.redoInsert = op.entries().map(e => e.x); app.undo();
    // remove
    d.removeMissing = st('RemovePointFromPolygon', { InputObj: c, PointID: 77 });
    d.remove = [run('RemovePointFromPolygon', { InputObj: c, PointID: 9 }).st, S.out.RemovePointFromPolygon.PolygonID, op.entries().map(e => e.x)];
    app.undo(); d.removeUndo = op.entries().map(e => [e.x, e.y]);
    run('RemovePointFromPolygon', { InputObj: c, PointID: 10 }); app.undo(); d.removeLastUndo = op.entries().map(e => e.z);   // saved index == count: re-inserted at 0 (append)
    // existing points
    const r1 = run('ConnectNewPolygonToPoint', { InputObj: c, PointID: 2 }); d.connect = [r1.v, r1.st, ids(c), kinds(c)];
    d.connectNeighbour = [run('ConnectNewPolygonToPoint', { InputObj: c, PointID: 2 }).st, run('ConnectNewPolygonToPoint', { InputObj: c, PointID: 8 }).st, op.count];   // last entry / first entry are the neighbours of position 0
    d.connectMinus1 = [run('ConnectNewPolygonToPoint', { InputObj: c, PointID: -1 }).st, op.count];
    run('ConnectNewPolygonToPoint', { InputObj: c, PointID: 5, InsertPosition: 2, InvertPolygon: true });
    d.connectAt2 = [ids(c), op.entries()[2].flag, c.primitive.mesh().polygons.slice(-1)[0]];
    app.undo(); d.connectUndo = ids(c);
    d.removeExisting = [run('RemovePointFromPolygon', { InputObj: c, PointID: 2 }).st, ids(c)];
    app.run('DeleteObj', { InputObj: c.name });
    out.builder = d;
  }

  // ================= ConnectNewPolygonToEdge
  {
    const d = {}; const c = cube('edCube'); const op = S.tool.applyPolygonBuilder(c); const m0 = c.primitive.mesh();
    const f = m0.polygons[0]; d.face = f.slice(0, 3);
    const e0 = S.geometry.edgeInfo(m0, 0), e1 = S.geometry.edgeInfo(m0, 1);
    d.edgeInfo = [[e0.first, e0.second, e0.side88], [e1.first, e1.second, e1.side88], e0.side87 >= 0, S.geometry.edgeInfo(m0, 12), S.geometry.edgeInfo(m0, 11) !== null];
    let m = mark(); d.missingEdge = [run('ConnectNewPolygonToEdge', { InputObj: c, EdgeID: 999 }).st, nya(m, /Q1/), op.count];
    const r = run('ConnectNewPolygonToEdge', { InputObj: c, EdgeID: 0 }); d.first = [r.v, r.st, ids(c), kinds(c)];
    d.second = [run('ConnectNewPolygonToEdge', { InputObj: c, EdgeID: 1 }).st, ids(c), S.out.ConnectNewPolygonToEdge.PolygonID];
    d.mesh = [counts(c), c.primitive.mesh().polygons.slice(-1)[0]];
    app.undo(); d.undo = ids(c); app.redo(); d.redo = ids(c);
    d.repeat = [run('ConnectNewPolygonToEdge', { InputObj: c, EdgeID: 1 }).st, ids(c)];   // A is before position 0 (the last entry) ... both dropped or re-added per the neighbour rule
    app.run('DeleteObj', { InputObj: c.name });
    // insert position other than 0: B then A at the position, so A ends up before B
    const c2 = cube('edCube2'); const op2 = S.tool.applyPolygonBuilder(c2);
    run('AddPointToNewPolygon', { InputObj: c2, X: 20, Y: 7, Z: 3 }); run('AddPointToNewPolygon', { InputObj: c2, X: 21, Y: -5, Z: -9 });   // skew to the edge: no crossing
    run('ConnectNewPolygonToEdge', { InputObj: c2, EdgeID: 0, InsertPosition: 1 }); d.atPosition = op2.entries().map(e => e.kind ? 'new' : e.id);
    app.undo(); app.undo(); app.undo();
    // previous -> A and B -> current meet (all four points in the plane of the cube face containing the edge): A and B are swapped
    const pa = [...m0.positions.slice(f[1] * 3, f[1] * 3 + 3)], pb = [...m0.positions.slice(f[0] * 3, f[0] * 3 + 3)], pc = [...m0.positions.slice(f[2] * 3, f[2] * 3 + 3)];
    const out2 = (p, q, k) => p.map((v, i) => v + (v - q[i]) * k);   // p pushed away from q
    const prev = out2(out2(pb, pc, 0.5), pa, 0.5), cur = out2(out2(pa, pc, 0.5), pb, 0.5);   // previous beyond B, current beyond A: the connections cross
    run('AddPointToNewPolygon', { InputObj: c2, X: prev[0], Y: prev[1], Z: prev[2] }); run('AddPointToNewPolygon', { InputObj: c2, X: cur[0], Y: cur[1], Z: cur[2] });
    run('ConnectNewPolygonToEdge', { InputObj: c2, EdgeID: 0, InsertPosition: 1 }); d.swapped = op2.entries().map(e => e.kind ? 'new' : e.id);
    app.run('DeleteObj', { InputObj: c2.name });
    const X = S.geometry.segmentsCross;
    d.cross = [X([0, 0, 0], [2, 2, 0], [0, 2, 0], [2, 0, 0]), X([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]), X([0, 0, 0], [1, 0, 0], [3, -1, 0], [3, 1, 0]), X([0, 0, 0], [2, 2, 0], [0, 2, 1], [2, 0, 1])];
    out.edge = d;
  }

  // ================= Add Edge interior points
  {
    const d = {}; const c = cube('aeCube'); const f = c.primitive.mesh().polygons[0];
    const op = S.tool.applyAddEdge(c, f[0], f[2]); const slice = S.tool.applySlicePolygons(c);
    d.type = op.type;
    d.wrongOperator = [st('AddPointInteriorToPolygon', { Operator: slice }), st('RemoveLastPointInteriorToPolygon', { Operator: slice }), st('TerminateAddEdgeWithInteriorPoints', { Operator: slice }), st('AddPointInteriorToPolygon', { Operator: 'no.such.operator' })];
    let m = mark();
    d.add = [run('AddPointInteriorToPolygon', { Operator: op, PolygonID: 3, FirstOffset: 0, SecondOffset: 1, ThirdOffset: 2, FirstWeight: 0.2, SecondWeight: 0.3, ThirdWeight: 0.5, Height: 0.1 }).st, S.interiorPoints(op), nya(m)];
    run('AddPointInteriorToPolygon', { Operator: op }); d.addDefault = S.interiorPoints(op)[1];
    app.undo(); d.addUndo = S.interiorPoints(op).length; app.redo();
    d.removeLast = [run('RemoveLastPointInteriorToPolygon', { Operator: op }).st, S.interiorPoints(op).length];
    run('RemoveLastPointInteriorToPolygon', { Operator: op }); d.removeEmpty = [S.interiorPoints(op).length, run('RemoveLastPointInteriorToPolygon', { Operator: op }).st];
    app.undo(); d.removeUndo = S.interiorPoints(op);
    m = mark(); d.terminate = [run('TerminateAddEdgeWithInteriorPoints', { Operator: op, PolygonID: 1, EdgeID: 7, Ratio: 0.25 }).st, S.endEdge(op), op.get('ratioedge').value, nya(m, /Q2/)];
    app.undo(); d.terminateUndo = [S.endEdge(op), op.get('ratioedge').value];
    app.redo(); d.terminateRedo = [S.endEdge(op), op.get('ratioedge').value];
    c.primitive.removeOperator(op); d.detached = st('TerminateAddEdgeWithInteriorPoints', { Operator: op, EdgeID: 1 });
    app.run('DeleteObj', { InputObj: c.name });
    out.addEdge = d;
  }

  // ================= SnapOffsetToPointForSlicePolygons
  {
    const d = {}; const c = cube('slCube'); const t = cube('slTarget');
    t.kinematics.local.get('posy').value = 1.5; t.kinematics.local.get('posx').value = 0.75; t.kinematics.local.get('posz').value = -0.5;
    const op = S.tool.applySlicePolygons(c); const p = op.get('planeoffset') ?? op.get('offset');
    const axis = Math.min(2, Number(op.p('sliceplane', 'axis', 0)));
    const tm = t.primitive.mesh(); const local = [...tm.positions.slice(9, 12)]; const pos = [0.75, 1.5, -0.5];
    d.type = op.type; const before = Number(p.value);
    d.badTarget = [st('SnapOffsetToPointForSlicePolygons', { Operator: op, Target: 'slTarget' }), st('SnapOffsetToPointForSlicePolygons', { Operator: op, Target: 'slTarget.pnt[]' }), st('SnapOffsetToPointForSlicePolygons', { Operator: op, Target: 'slTarget.poly[0]' })];
    d.badOperator = st('SnapOffsetToPointForSlicePolygons', { Operator: c.primitive.operators[0], Target: 'slTarget.pnt[3]' });
    const polysBefore = c.primitive.mesh().polygons.length;
    d.snap = run('SnapOffsetToPointForSlicePolygons', { Operator: op, Target: 'slTarget.pnt[3,5]' }).st;
    const moved = Number(p.value) - before;
    // The cube is centred, bbox percentage 50: the plane sat at `before` on the axis, so the offset must now be the target coordinate.
    d.onTarget = round(Number(p.value)) === round(local[axis] + pos[axis]); d.moved = moved !== 0; void polysBefore;
    const again = Number(p.value); d.idempotent = [run('SnapOffsetToPointForSlicePolygons', { Operator: op, Target: { obj: t, kind: 'point', indices: [3] } }).st, round(Number(p.value) - again)];
    app.undo(); d.undo = round(Number(p.value)) === round(before);
    app.run('DeleteObj', { InputObj: c.name }); app.run('DeleteObj', { InputObj: t.name });
    out.snap = d;
  }

  // ================= cluster commands
  {
    const d = {}; const Operator = Object.getPrototypeOf(cube('tmpProto').primitive.operators[0].constructor); app.run('DeleteObj', { InputObj: 'tmpProto' });
    const clusters = (o) => o.clusters.map(k => [k.name, k.compKind, k.elements.size, S.portConnection(k)?.group ?? null]);
    // Curves To Mesh result without text
    const c = cube('ctmCube'); const conv = new Operator('Curve To Mesh Converter', 'CurveListToMesh', []); c.primitive.addOperator(conv);
    const plain = cube('plainCube');
    let m = mark(); const r = run('CreateMeshPartitionClusters', { InputObjs: 'ctmCube,plainCube' });
    d.partitionFace = [r.st, clusters(c), clusters(plain), nya(m, /partition list/), nya(m, /Q4/), S.out.CreateMeshPartitionClusters.InputObjs.map(o => o.name)];
    app.undo(); d.partitionUndo = c.clusters.length;
    const r2 = run('CreateClustersAlongDepthFromCurvesToMeshOperator', { InputObjs: [c, plain] });
    d.depth = [r2.st, r2.v.map(k => k.name), clusters(c), plain.clusters.length, S.portConnection(c.clusters[0]).operator === conv, S.out.CreateClustersAlongDepthFromCurvesToMeshOperator.CreatedClusters.length];
    c.removeCluster(c.clusters.find(k => k.name === 'Extrusion'));
    const r3 = run('CreateClustersAlongDepthFromCurvesToMeshOperator', { InputObjs: 'plainCube', InspectedObjectsArray: [plain.primitive.operators[0], conv] });   // the array wins; only the converter contributes
    d.depthAgain = [r3.v.map(k => k.name), c.clusters.map(k => k.name), plain.clusters.length];
    d.inspectedNone = st('CreateClustersAlongDepthFromCurvesToMeshOperator', { InputObjs: 'ctmCube', InspectedObjectsArray: [plain.primitive.operators[0]] });
    app.select([c]); d.selection = run('CreateClustersAlongDepthFromCurvesToMeshOperator', {}).v.length; app.select([]);
    // Slice Polygons
    const s = cube('scCube'); const sop = S.tool.applySlicePolygons(s);
    const r4 = run('CreateClustersFromSlicePolygonsOperator', { InputObjs: s });
    d.slice = [r4.st, clusters(s), S.connectedClusters(sop).length];
    d.sliceAgain = [run('CreateClustersFromSlicePolygonsOperator', { InspectedObjectsArray: [sop] }).v.length, s.clusters.length];
    app.undo(); d.sliceUndo = s.clusters.length;
    // text mesh: the generator is text operator and converter in one
    const tm = app.run('CreateMeshText', { Text: 'AB' });
    for (let i = 0; i < 100 && !tm.primitive.mesh(); i++) { await new Promise(res => setTimeout(res, 100)); tm.primitive.dirty = true; }
    d.textMeshReady = !!tm.primitive.mesh();
    const r5 = run('CreateMeshPartitionClusters', { InputObjs: tm });
    d.textMesh = [r5.st, tm.clusters.length >= 1 && tm.clusters.length <= 2, tm.clusters.map(k => [k.name, k.compKind]).slice(0, 1), tm.clusters.every((k, i) => k.name === ['Char_A', 'Char_B'][i]), tm.clusters.reduce((n, k) => n + k.elements.size, 0) === (tm.primitive.mesh()?.polygons.length ?? -1)];
    // text curves
    const tc = app.run('CreatePrim', { PresetObj: 'Text', GeometryType: 'NurbsCurve', Text: 'Softimage' });
    const g = tc.primitive.geom(); const n = g ? 1 + (g.subcurves?.length ?? 0) : 0;
    m = mark(); const r6 = run('CreateCurvePartitionClusters', { InputObjs: tc });
    d.textCurve = [r6.st, n > 1, tc.clusters.length === n, tc.clusters.slice(0, 3).map(k => [k.name, k.compKind, [...k.elements]]), nya(m, /partition list/), nya(m, /Q4/)];
    d.curveOnMesh = [run('CreateCurvePartitionClusters', { InputObjs: plain }).st, plain.clusters.length];
    for (const o of [c, plain, s, tm, tc]) app.run('DeleteObj', { InputObj: o.name });
    out.clusters = d;
  }

  // ================= SICreateCurve / add point
  {
    const d = {};
    const r = run('SICreateCurve', {}); const cv = r.v;
    d.create = [r.st, cv.type, cv.parentObj === app.scene.root, cv.primitive.type, cv.primitive.operators.map(o => o.type), cv.primitive.geom(), S.out.SICreateCurve.Value === cv, cv.primitive.operators[0].degree, cv.primitive.operators[0].typeCodeValue];
    const named = run('SICreateCurve', { Name: 'myCurve', Degree: 1, CurveType: 1 }).v; d.named = [named.name, named.primitive.operators[0].degree, named.primitive.operators[0].typeCodeValue];
    app.undo(); d.createUndo = objNames().includes('myCurve');
    d.badType = [st('SICreateCurve', { CurveType: 2 }), st('SICreateCurve', { CurveType: -1 }), run('SICreateCurve', { CurveType: 3 }).v.primitive.operators[0].typeCodeValue];
    const op = cv.primitive.operators[0];
    const end = (x, y, z, extra = {}) => run('SIAddPointOnCurveAtEnd', { InputObj: cv, X: x, Y: y, Z: z, ...extra });
    d.end = [end(0, 0, 0).v, end(1, 0, 0).v, end(2, 1, 0).v, S.out.SIAddPointOnCurveAtEnd.Value, op.points.length, cvs(cv), cv.primitive.geom().degree, cv.primitive.operators.length];
    run('SIAddPointOnCurveAtStart', { InputObj: cv.name, X: -1 }); d.start = cvs(cv)[0];
    run('SIAddPointOnCurve', { InputObj: cv, InsertPosition: 1, X: 0.5, Y: 9 }); d.middle = [cvs(cv).map(p => p[0]), cv.primitive.geom().degree];
    app.undo(); d.middleUndo = cvs(cv).map(p => p[0]); app.redo(); d.middleRedo = cvs(cv).length;
    let m = mark(); d.tooFar = [run('SIAddPointOnCurve', { InputObj: cv, InsertPosition: 99 }).st, op.points.length, logFrom(m).some(l => /0x91/.test(l))];
    d.negative = [st('SIAddPointOnCurve', { InputObj: cv, InsertPosition: -1 }), st('SIAddPointOnCurve', { InputObj: cv, InsertPosition: 1.5 }), st('SIAddPointOnCurveAtEnd', { InputObj: 'cube' }), st('SIAddPointOnCurveAtStart', { InputObj: 'nope' })];
    // fractional position: the "Add Point Inside Curve" operator
    const nBefore = cvs(cv).length;
    run('SIAddPointOnCurve', { InputObj: cv, InsertPosition: 0.5, X: 7, Y: 7, Z: 7, Local: true, CurveType: 0 });
    const mid = cv.primitive.operators[cv.primitive.operators.length - 1];
    d.fraction = [mid.type, ['posx', 'posy', 'posz', 'percentage', 'keepotherpointsanchored', 'mode'].map(k => mid.get(k).value), cvs(cv).length - nBefore, cvs(cv).some(p => p[0] === 7 && p[1] === 7 && p[2] === 7)];
    app.undo(); d.fractionUndo = cv.primitive.operators.length;
    // PreserveTrace: the creation operator is not used
    end(5, 5, 5, { PreserveTrace: true, Local: true }); const ext = cv.primitive.operators[cv.primitive.operators.length - 1];
    d.preserve = [ext.type, ['bound', 'cont', 'posx', 'posy', 'posz', 'mode'].map(k => ext.get(k).value), op.points.length, cvs(cv).slice(-1)[0], S.out.SIAddPointOnCurveAtEnd.Value];
    app.undo();
    // requested type differs from the operator's, curve has points, degree not 1: rejected
    m = mark(); run('SIAddPointOnCurveAtStart', { InputObj: cv, X: -9, CurveType: 1, Local: true }); const ext2 = cv.primitive.operators[cv.primitive.operators.length - 1];
    d.rejected = [ext2.type, ext2.get('bound').value, ext2.get('mode').value, op.points.length, cvs(cv)[0], nya(m, /Q6/)];
    app.undo();
    run('SIAddPointOnCurveAtStart', { InputObj: cv, X: -9, CurveType: 0, Local: true }); d.sameType = [cv.primitive.operators.length, op.points[0]];   // same type: fast path
    // global -> local
    cv.kinematics.local.get('posx').value = 10;
    end(13, 2, 0); d.global = op.points[op.points.length - 1].map(round); end(13, 2, 0, { Local: true }); d.local = op.points[op.points.length - 1].map(round);
    // a curve without creation operator
    const arc = app.run('CreatePrim', { PresetObj: 'Arc', GeometryType: 'NurbsCurve' }); const an = cvs(arc).length;
    const ra = run('SIAddPointOnCurveAtEnd', { InputObj: arc, X: 3, Y: 3, Z: 3, CurveType: 0 }); const ext3 = arc.primitive.operators[arc.primitive.operators.length - 1];
    d.noCreation = [ra.v, ext3.type, ext3.get('bound').value, ext3.get('mode').value, cvs(arc).length - an, cvs(arc).slice(-1)[0]];
    run('SIAddPointOnCurveAtStart', { InputObj: arc, X: -3 }); const ext4 = arc.primitive.operators[arc.primitive.operators.length - 1];
    d.noCreationStart = [ext4.get('bound').value, ext4.get('mode').value, cvs(arc)[0]];
    for (const o of [cv, arc]) app.run('DeleteObj', { InputObj: o.name });
    for (const o of objNames().filter(x => /^crvlist/.test(x))) app.run('DeleteObj', { InputObj: o });
    out.curve = d;
  }

  // ================= SISetCurvePoints / SIDeletePointOnCurve / CreateCurve wrapper
  {
    const d = {}; const cv = run('SICreateCurve', { Name: 'setCurve' }).v; const op = cv.primitive.operators[0];
    let m = mark(); d.set = [run('SISetCurvePoints', { InputObj: cv, Points: ' ( 0 , 0 , 0 ) , (1,0,0),(2,1e0,-.5),(3,1,0),(4,0,0)', Local: true }).st, cvs(cv), cv.primitive.geom().degree, nya(m, /Q5/)];
    d.append = [run('SISetCurvePoints', { InputObj: 'setCurve', Points: '(5,0,0)' }).st, op.points.length];
    app.undo(); d.appendUndo = op.points.length;
    d.bad = ['', '(1,2)', '(1,2,3) ', '(1,2,3)(4,5,6)', '(1,2,3,4)', '(1,2,x)', '1,2,3', '(1,2,3),'].map(p => st('SISetCurvePoints', { InputObj: cv, Points: p }));
    d.badCount = op.points.length;
    d.badObject = st('SISetCurvePoints', { InputObj: 'cube', Points: '(1,2,3)' });
    // delete
    d.del = [run('SIDeletePointOnCurve', { InputObj: cv }).st, cv.primitive.operators.slice(-1)[0].type, ['crvindex', 'cvindex'].map(k => cv.primitive.operators.slice(-1)[0].get(k).value), cvs(cv).map(p => p[0])];
    d.delBeyond = st('SIDeletePointOnCurve', { InputObj: cv });   // default index 4, four points left
    app.undo(); d.delUndo = cvs(cv).length;
    const lin = run('SICreateCurve', { Degree: 1 }).v; run('SISetCurvePoints', { InputObj: lin, Points: '(0,0,0),(1,0,0)', Local: true });
    run('SIDeletePointOnCurve', { InputObj: lin, InsertPosition: 0 }); d.delLinear = [S.lastStatus?.status ?? null, lin.primitive.operators.length];
    const one = run('SICreateCurve', { Degree: 1 }).v; run('SISetCurvePoints', { InputObj: one, Points: '(0,0,0)', Local: true });
    d.delEmpty = [st('SIDeletePointOnCurve', { InputObj: one, InsertPosition: 0 }), st('SIDeletePointOnCurve', { InputObj: 'cube' })];
    const tc = app.run('CreatePrim', { PresetObj: 'Text', GeometryType: 'NurbsCurve', Text: 'Softimage' }); const g = tc.primitive.geom();
    const n0 = g.cvs.length, n1 = g.subcurves[0].cvs.length;
    run('SIDeletePointOnCurve', { InputObj: tc, InsertPosition: n0 + 1 }); const dop = tc.primitive.operators.slice(-1)[0]; const g2 = tc.primitive.geom();
    d.delList = [dop.get('crvindex').value, dop.get('cvindex').value, g2.cvs.length - n0, g2.subcurves[0].cvs.length - n1, g2.subcurves.length === g.subcurves.length];
    // the script wrapper now runs the two step commands
    const w = app.run('CreateCurve', { Degree: 3, Points: '(0,0,0),(1,0,0),(2,1,0),(3,1,0),(4,0,0)' }); const wc = Array.isArray(w) ? w[0] : w;
    d.wrapper = [wc?.primitive?.operators[0]?.type ?? null, cvs(wc), wc?.primitive?.geom()?.degree ?? null];
    for (const o of [cv, lin, one, tc, wc]) app.run('DeleteObj', { InputObj: o.name });
    out.points = d;
  }

  // ================= CurveDirectManip
  {
    const d = {}; const cv = run('SICreateCurve', { Name: 'manipCurve' }).v; run('SISetCurvePoints', { InputObj: cv, Points: '(0,0,0),(1,0,0),(2,1,0),(3,1,0)', Local: true });
    const before = cvs(cv); const top = () => cv.primitive.operators.slice(-1)[0];
    let m = mark(); const r = run('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,0.5)]', X: 1, Y: 2, Z: 3 });
    d.apply = [r.v, r.st, top().type, ['mode', 'trnsx', 'trnsy', 'trnsz'].map(k => top().get(k).value), cv.clusters.map(k => [k.name, k.compKind, [...k.elements]]), top().cluster === cv.clusters[0], cv.primitive.operators.length, nya(m)];
    d.passThrough = JSON.stringify(cvs(cv)) === JSON.stringify(before);
    run('CurveDirectManip', { SubComp: [cv.clusters[0]], Mode: 2, X: 4 }); d.reuse = [cv.primitive.operators.length, cv.clusters.length, ['mode', 'trnsx', 'trnsy', 'trnsz'].map(k => top().get(k).value)];
    app.undo(); d.reuseUndo = ['mode', 'trnsx'].map(k => top().get(k).value);
    d.bad = [st('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,1.5)]' }), st('CurveDirectManip', { SubComp: 'manipCurve' }), st('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,0.5)]', Mode: 7 }),
      st('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,0.5)]', ImmediateMode: 2 }), st('CurveDirectManip', { SubComp: { obj: cv, curve: 0, u: -0.1 } })];
    d.edge = st('CurveDirectManip', { SubComp: { obj: cv, curve: 0, u: 1 }, ImmediateMode: 0, Mode: 6 });
    S.isLocked = () => true; d.locked = run('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,0.5)]' }).err ?? null; S.isLocked = null;
    const ri = run('CurveDirectManip', { SubComp: 'manipCurve.isopnt[(0,0.25)]', ImmediateMode: 'siImmediateOperation' });
    d.immediate = [ri.st, cv.primitive.operators.map(o => o.type), JSON.stringify(cvs(cv)) === JSON.stringify(before)];
    app.undo(); d.immediateUndo = cv.primitive.operators.length > 1;
    app.run('DeleteObj', { InputObj: cv.name });
    out.manip = d;
  }
  return JSON.parse(JSON.stringify(out, (k, v) => v && typeof v === 'object' && typeof v.fullName === 'string' && v.kind ? `<${v.name}>` : v));
}, { NAMES });
await browser.close();

let checks = 0; const diffs = [];
const show = (x) => JSON.stringify(x);
const eq = (what, a, b) => { checks++; if (show(a) !== show(b)) diffs.push(`${what}\n      got      ${show(a)}\n      expected ${show(b)}`); };
const ok = (what, cond, detail) => { checks++; if (!cond) diffs.push(`${what}${detail === undefined ? '' : `\n      got ${show(detail)}`}`); };
const NOTHING = '1', OKS = '0', NOINTERFACE = '80004002', POINTER = '80004003', INVALID = '80070057', UNEXPECTED = '8000ffff';

// 1. registration
for (const n of NAMES) {
  ok(`${n}: registry entry handled by a task DLL`, !!registry[n]);
  eq(`${n}: registered with the registry argument list`, got.registered[n], registry[n]);
}

// 2. defaults
const D = got.defaults;
for (const n of ['AddPointToNewPolygon', 'RemovePointFromPolygon', 'AddPointInteriorToPolygon', 'RemoveLastPointInteriorToPolygon', 'TerminateAddEdgeWithInteriorPoints', 'SnapOffsetToPointForSlicePolygons'])
  eq(`${n} defaults: null object / operator 0x80004003`, D[n], [POINTER, []]);
for (const n of ['ConnectNewPolygonToEdge', 'ConnectNewPolygonToPoint']) eq(`${n} defaults: stops (no geometry), nothing thrown`, D[n], [NOTHING, []]);
for (const n of ['CreateMeshPartitionClusters', 'CreateClustersAlongDepthFromCurvesToMeshOperator', 'CreateClustersFromSlicePolygonsOperator', 'CreateCurvePartitionClusters'])
  eq(`${n} defaults: empty list 0x80070057`, D[n], [INVALID, []]);
eq('SICreateCurve defaults: an empty curve object', D.SICreateCurve, [OKS, ['crvlist']]);
for (const n of ['SISetCurvePoints', 'SIAddPointOnCurve', 'SIAddPointOnCurveAtStart', 'SIAddPointOnCurveAtEnd', 'SIDeletePointOnCurve', 'CurveDirectManip'])
  eq(`${n} defaults: 0x80070057`, D[n], [INVALID, []]);

// 3. polygon builder
const B = got.builder;
eq('Add / Remove without a polygon-builder operator: 0x8000ffff', B.noOperator, [UNEXPECTED, UNEXPECTED]);
eq('Connect commands without the operator simply stop (status not attested, Q1)', B.connectNoOperator, [NOTHING, NOTHING, 2]);
eq('cube: 8 points, 6 polygons', B.base, [8, 6]);
eq('AddPointToNewPolygon: Value = id of the appended entry, PolygonID = operator slot 6 (-1 until a polygon exists)', B.adds, [[8, -1, 8], [9, -1, 9], [10, 6, 10]]);
eq('three new points: entries (kind, xyz, id) and the mesh gains them and one polygon', B.afterAdds, [3, [11, 7], [[1, 10, 0, 0, 8], [1, 10, 5, 0, 9], [1, 12, 5, 3, 10]]]);
eq('coordinates pass through unchanged; the polygon uses the entry order', [B.newPoint, B.newPolygon], [[12, 5, 3], [8, 9, 10]]);
eq('InsertPosition 1 inserts before list position 1; Value = id of the entry at that index', B.insertAt1, [[9, 6, 9], [[10, 8], [11, 9], [10, 10], [12, 11]]]);
eq('undo removes the entry at InsertPosition; redo inserts it again', [B.undoInsert, B.redoInsert], [[3, [10, 10, 12]], [10, 11, 10, 12]]);
eq('RemovePointFromPolygon: unknown id 0x80070057', B.removeMissing, INVALID);
eq('RemovePointFromPolygon: first entry with that id removed; PolygonID published', B.remove, [OKS, -1, [10, 12]]);
eq('undo re-inserts the saved new point at its index', B.removeUndo, [[10, 0], [10, 5], [12, 5]]);
eq('undo of removing the last entry appends (saved index == count -> position 0)', B.removeLastUndo, [0, 0, 3]);
eq('ConnectNewPolygonToPoint: existing point appended as kind 0; returns PolygonID', B.connect, [6, OKS, [8, 9, 10, 2], [1, 1, 1, 0]]);
eq('a point that already is the neighbour at the position is not inserted', B.connectNeighbour, [NOTHING, NOTHING, 4]);
eq('PointID -1 inserts nothing', B.connectMinus1, [NOTHING, 4]);
eq('InsertPosition 2 with InvertPolygon: inserted before position 2, flag kept, winding reversed (inferred)', B.connectAt2, [[8, 9, 5, 10, 2], 1, [2, 10, 5, 9, 8]]);
eq('undo removes the kind-0 entry with that id', B.connectUndo, [8, 9, 10, 2]);
eq('RemovePointFromPolygon also finds existing-point entries (kind not checked)', B.removeExisting, [OKS, [8, 9, 10]]);

// 4. ConnectNewPolygonToEdge
const E = got.edge;
eq('edge ids follow first appearance in the polygons; a cube has 12 edges', E.edgeInfo, [[E.face[0], E.face[1], 0], [E.face[1], E.face[2], 0], true, null, true]);
eq('missing edge: stops, nothing inserted', E.missingEdge, [NOTHING, 1, 0]);
eq('edge 0 on an empty list: A = second end, B = first end (opposite to the neighbour polygon), appended A then B', E.first, [-1, OKS, [E.face[1], E.face[0]], [0, 0]]);
eq('edge 1: B equals the entry at the position and is dropped; A appended; a polygon exists', E.second, [OKS, [E.face[1], E.face[0], E.face[2]], 6]);
eq('the builder adds one polygon over existing points', E.mesh, [[8, 7], [E.face[1], E.face[0], E.face[2]]]);
eq('undo removes the inserted point; redo re-inserts the saved one', [E.undo, E.redo], [[E.face[1], E.face[0]], [E.face[1], E.face[0], E.face[2]]]);
eq('edge 1 again: A is the entry before the position, B the entry at it: nothing inserted', E.repeat, [NOTHING, [E.face[1], E.face[0], E.face[2]]]);
eq('InsertPosition 1: B then A at the position, so A ends up before B', E.atPosition, ['new', E.face[1], E.face[0], 'new']);
eq('previous -> A crosses B -> current: A and B swapped', E.swapped, ['new', E.face[0], E.face[1], 'new']);
eq('crossing test: crossing, parallel, beyond the first segment, skew', E.cross, [true, false, false, false]);

// 5. Add Edge interior points
const A = got.addEdge;
eq('the Add Edge operator of this build', A.type, 'addedgeop');
eq('another operator class: 0x80004002; unresolvable operator: 0x80004003', A.wrongOperator, [NOINTERFACE, NOINTERFACE, NOINTERFACE, POINTER]);
eq('AddPointInteriorToPolygon appends (offsets, weights, height); PolygonID not forwarded', A.add, [OKS, [{ offsets: [0, 1, 2], weights: [0.2, 0.3, 0.5], height: 0.1 }], 1]);
eq('default values are zeros', A.addDefault, { offsets: [0, 0, 0], weights: [0, 0, 0], height: 0 });
eq('undo removes the last interior point', A.addUndo, 1);
eq('RemoveLastPointInteriorToPolygon drops the last point', A.removeLast, [OKS, 1]);
eq('nothing left: nothing removed', A.removeEmpty, [0, NOTHING]);
eq('undo appends the saved point', A.removeUndo, [{ offsets: [0, 1, 2], weights: [0.2, 0.3, 0.5], height: 0.1 }]);
eq('TerminateAddEdgeWithInteriorPoints: end edge and Ratio stored; identity of the edge receiver logged (Q2)', A.terminate, [OKS, 7, 0.25, 1]);
eq('undo: edge id -1, the ratio write undone; redo: saved edge and ratio', [A.terminateUndo, A.terminateRedo], [[-1, 0], [7, 0.25]]);
eq('operator not in a stack (port not connected): 0x8000ffff', A.detached, UNEXPECTED);

// 6. Slice Polygons snap
const SN = got.snap;
eq('the Slice Polygons operator of this build', SN.type, 'slicepolygonsop');
eq('Target must be a point sub-component with at least one index: 0x80070057', SN.badTarget, [INVALID, INVALID, INVALID]);
eq('another operator class: 0x80004002', SN.badOperator, NOINTERFACE);
eq('snap: offset moved by the signed distance so the plane passes through the first target point (global -> local)', [SN.snap, SN.moved, SN.onTarget], [OKS, true, true]);
eq('snapping again moves nothing', SN.idempotent, [OKS, 0]);
eq('undoable', SN.undo, true);

// 7. clusters
const C = got.clusters;
eq('CreateMeshPartitionClusters without text: prefix Face, polygon clusters; objects without the operator skipped; input list written back',
  C.partitionFace, [OKS, [['Face', 'poly', 6, null]], [], 1, 1, ['ctmCube', 'plainCube']]);
eq('undoable', C.partitionUndo, 0);
eq('CreateClustersAlongDepth...: five empty polygon clusters on port groups 3..7, returned as CreatedClusters',
  C.depth, [OKS, ['Front', 'FrontBevel', 'Extrusion', 'BackBevel', 'Back'], [['Front', 'poly', 0, 3], ['FrontBevel', 'poly', 0, 4], ['Extrusion', 'poly', 0, 5], ['BackBevel', 'poly', 0, 6], ['Back', 'poly', 0, 7]], 0, true, 5]);
eq('existing names are skipped; InspectedObjectsArray wins over InputObjs and only the accepted class contributes',
  C.depthAgain, [['Extrusion'], ['Front', 'FrontBevel', 'BackBevel', 'Back', 'Extrusion'], 0]);
eq('InspectedObjectsArray without an accepted operator: empty list 0x80070057', C.inspectedNone, INVALID);
eq('no InputObjs: the selection (inferred); nothing to create', C.selection, 0);
eq('CreateClustersFromSlicePolygonsOperator: PolysAbove / PolysBelow (polygon), EdgesAlong (edge) on port groups 2, 3, 4',
  C.slice, [OKS, [['PolysAbove', 'poly', 0, 2], ['PolysBelow', 'poly', 0, 3], ['EdgesAlong', 'edge', 0, 4]], 3]);
eq('no "already exists" check: three more', C.sliceAgain, [3, 6]);
eq('undoable', C.sliceUndo, 3);
ok('text mesh evaluated (font loaded)', C.textMeshReady);
eq('text mesh: prefix Char and one "_<character>" suffix per partition; the partitions cover every polygon', C.textMesh, [OKS, true, [['Char_A', 'poly']], true, true]);
eq('CreateCurvePartitionClusters: one Char cluster per partition of the text curve list', C.textCurve.slice(0, 3).concat([C.textCurve[3][0], C.textCurve[4], C.textCurve[5]]), [OKS, true, true, ['Char_S', 'subcrv', [0]], 1, 1]);
eq('object without a text operator: skipped', C.curveOnMesh, [OKS, 0]);

// 8. curves
const K = got.curve;
eq('SICreateCurve: crvlist object under the scene root with the curve-creation operator, no geometry yet; Value; degree 3, CurveType 0 -> code 1',
  K.create, [OKS, 'crvlist', true, 'crvlist', ['CurveCreationOp'], null, true, 3, 1]);
eq('Name renames the object; CurveType 1 -> code 0', K.named, ['myCurve', 1, 0]);
eq('undoable', K.createUndo, false);
eq('CurveType other than 0, 1, 3: 0x80070057; 3 -> code 3', K.badType, [INVALID, INVALID, 3]);
eq('SIAddPointOnCurveAtEnd: fast path appends to the creation operator, returns true', K.end, [true, true, true, true, 3, [[0, 0, 0], [1, 0, 0], [2, 1, 0]], 2, 1]);
eq('SIAddPointOnCurveAtStart: inserted at index 0', K.start, [-1, 0, 0]);
eq('SIAddPointOnCurve integer position: inserted at index InsertPosition + 1', K.middle, [[-1, 0, 0.5, 1, 2], 3]);
eq('undo removes the point at the saved index; redo repeats the insert', [K.middleUndo, K.middleRedo], [[-1, 0, 1, 2], 5]);
eq('operator returned 1: message 0x91 logged, nothing recorded', K.tooFar, [NOTHING, 5, true]);
eq('negative position, non-normalised fraction, wrong InputObj: 0x80070057', K.negative, [INVALID, INVALID, INVALID, INVALID]);
eq('fractional position: Add Point Inside Curve operator with x, y, z, position, parameter 5 false, type parameter (CurveType 0 -> 0)', K.fraction, ['addpt_middlecrv', [7, 7, 7, 0.5, false, 0], 1, true]);
eq('operator path undone through the sub-task', K.fractionUndo, 1);
eq('PreserveTrace: Extend Curve To Point operator, end selector 1, parameter 2 = 0, type value 2; creation operator untouched; Value true',
  K.preserve, ['extendcrv2pt', [1, 0, 5, 5, 5, 2], 5, [5, 5, 5], true]);
eq('creation operator rejected (type requested, has points, degree not 1, type differs): operator path, start selector 0, type 1', K.rejected.slice(0, 5), ['extendcrv2pt', 0, 1, 5, [-9, 0, 0]]);
ok('editing mode other than control points flagged not yet attested (Q6)', K.rejected[5] >= 1, K.rejected);
eq('same type: fast path', K.sameType, [1, [-9, 0, 0]]);
eq('Local false converts global -> local; Local true keeps the point', [K.global, K.local], [[3, 2, 0], [13, 2, 0]]);
eq('curve without creation operator: operator path at the end (CurveType 0 -> 0)', K.noCreation, [true, 'extendcrv2pt', 1, 0, 1, [3, 3, 3]]);
eq('... at the start, type not specified -> 2', K.noCreationStart, [0, 2, [-3, 0, 0]]);

const P = got.points;
eq('SISetCurvePoints: blanks allowed, three numbers per point, appended in order', P.set, [OKS, [[0, 0, 0], [1, 0, 0], [2, 1, -0.5], [3, 1, 0], [4, 0, 0]], 3, 1]);
eq('points are appended to what the curve has; undoable', [P.append, P.appendUndo], [[OKS, 6], 5]);
eq('empty string or any deviation from the grammar: 0x80070057, nothing added', [P.bad, P.badCount], [Array(8).fill(INVALID), 5]);
eq('wrong InputObj: 0x80070057', P.badObject, INVALID);
eq('SIDeletePointOnCurve default index 4: Delete Point From Curve operator with curve 0, point 4', P.del, [OKS, 'delpt_crv', [0, 4], [0, 1, 2, 3]]);
eq('index beyond the last curve: 0x80070057; undo restores', [P.delBeyond, P.delUndo], [INVALID, 5]);
eq('degree 1 curve with two points: degree < count, operator applied', P.delLinear, [0, 2]);
eq('no geometry / not a curve: 0x80070057', P.delEmpty, [INVALID, INVALID]);
eq('running index over the curves of a list: second curve, point 1', P.delList, [1, 1, 0, -1, true]);
eq('CreateCurve (script wrapper) now runs SICreateCurve + SISetCurvePoints', P.wrapper, ['CurveCreationOp', [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 1, 0], [4, 0, 0]], 3]);

const M = got.manip;
eq('CurveDirectManip: isopoint cluster created, operator added and connected, Mode / X / Y / Z written; Value empty (Q7)',
  M.apply.slice(0, 7), [null, OKS, 'constraincurveisopointop', [0, 1, 2, 3], [['Isopoint', 'isopnt', ['0,0.5']]], true, 2]);
ok('the deformation is flagged not yet attested', M.apply[7] >= 1 && M.passThrough, M.apply);
eq('operator on top of the stack and an existing cluster are reused', M.reuse, [2, 1, [2, 4, 0, 0]]);
eq('parameter writes undoable', M.reuseUndo, [0, 1]);
eq('position outside [0, 1], not an isopoint, Mode 7, ImmediateMode 2: 0x80070057', M.bad, [INVALID, INVALID, INVALID, INVALID, INVALID]);
eq('position 1 and Mode 6 accepted', M.edge, OKS);
ok('locked owner: lock error, nothing done', /locked/.test(M.locked ?? ''), M.locked);
eq('ImmediateMode 1: the stack is frozen afterwards (inferred)', M.immediate, [OKS, ['geom'], true]);
eq('undoable', M.immediateUndo, true);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B8f mesh / curve step task commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8f mesh / curve step task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): AddPointToNewPolygon, RemovePointFromPolygon, RemoveLastPointInteriorToPolygon, SICreateCurve (type code stored), SISetCurvePoints, SIAddPointOnCurveAtStart / AtEnd, SIDeletePointOnCurve');
console.log('   partly wired: ConnectNewPolygonToPoint / ToEdge (stop status Q1), AddPointInteriorToPolygon (effect on the result), TerminateAddEdgeWithInteriorPoints (Q2), SnapOffsetToPointForSlicePolygons (offset branch only, Q3), the four cluster commands (partition list stand-ins, cluster filling, Q4), SIAddPointOnCurve (inside-curve insertion), CurveDirectManip (deformation)');
