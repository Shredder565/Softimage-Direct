// CMD-B12d (optasks.dll): the 16 commands of src/commands/optasksB12d*.ts. There is no XSIBATCH golden for the row:
// this is a contract check against docs/ghidra/cmd-b12d-optasks-operator-inputs-connections-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (port-group instances, stack order, logged ids, statuses, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_optasks_b12d_commands.mjs
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
  'SubstituteOpInput', 'AddInputToOperator', 'RemoveInputFromOperator', 'MoveOperator', 'UpdateConnectOnOp', 'GetConnectionSet',
  'GetSurfaceFromCurvesConnectionSet', 'ConnectOperatorParameter', 'DisconnectOperatorParameter', 'ConnectBevelProfileCurve',
  'DisconnectBevelProfileCurve', 'ConnectPlaneReferenceToSlicePolygonsOp', 'DisconnectPlaneReferenceFromSlicePolygonsOp',
  'CreateGridAndConnectToSlicePolygonsOp', 'DisconnectFromSimulationOp', 'CycleChecking',
];
// Required input without a usable default: the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['SubstituteOpInput', 'AddInputToOperator', 'RemoveInputFromOperator', 'UpdateConnectOnOp', 'GetConnectionSet',
  'GetSurfaceFromCurvesConnectionSet', 'ConnectOperatorParameter', 'DisconnectOperatorParameter', 'ConnectBevelProfileCurve', 'DisconnectBevelProfileCurve',
  'ConnectPlaneReferenceToSlicePolygonsOp', 'DisconnectPlaneReferenceFromSlicePolygonsOp', 'CreateGridAndConnectToSlicePolygonsOp', 'DisconnectFromSimulationOp']);

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
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CycleChecking') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.optasksB12d; const MS = A.meshCurveStepTasks;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };
  const mk = (preset, name) => A.run('CreatePrim', { PresetObj: preset, Name: name });
  const inst = (op, g) => S.groupsOf(op)[g].instances.map(r => r.map(x => x ? (x.name ?? (x.obj ? `${x.obj.name}.${x.kind}` : '?')) : null));
  const J = (x) => JSON.stringify(x);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }

  // scene for the checks
  const c1 = mk('Cube', 'b12dCube'); const s1 = mk('Sphere', 'b12dS1'); const s2 = mk('Sphere', 'b12dS2'); const s3 = mk('Sphere', 'b12dS3');
  const grid0 = mk('Grid', 'b12dPlane');
  const slice = MS.tool.applySlicePolygons(c1);
  const bevel = new slice.constructor('Bevel', { kind: 'edge', indices: [] }); c1.primitive.addOperator(bevel);
  A.undoStack.length = 0; A.redoStack.length = 0;
  ok('setup: slice and bevel operators of this build', slice.type === 'slicepolygonsop' && bevel.type === 'bevelop', [slice.type, bevel.type]);
  ok('port group 0 of a stack operator holds its primitive', S.groupsOf(slice)[0].instances[0][0] === c1.primitive);

  // ================= ConnectPlaneReferenceToSlicePolygonsOp
  {
    let r = run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: [grid0] });
    ok('ConnectPlaneReference: grid object -> plane reference (group 1, instance 0)', !r.err && J(inst(slice, 1)) === J([['b12dPlane']]), [r.err, inst(slice, 1)]);
    ok('ConnectPlaneReference: the connect variant is logged as not yet attested', nya(r) === 1);
    r = run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: ['b12dPlane.poly[0,1]'] });
    ok('ConnectPlaneReference: a sub-component of the grid replaces the reference', !r.err && J(inst(slice, 1)) === J([['b12dPlane.poly']]), [r.err, inst(slice, 1)]);
    r = run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: [s1] });
    ok('ConnectPlaneReference: an object without plane interface is connected', !r.err && J(inst(slice, 1)) === J([['b12dS1']]), [r.err, inst(slice, 1)]);
    ok('ConnectPlaneReference: a sub-component of a non-plane object -> 0x80070057', status(run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: ['b12dS2.poly[0]'] }), '80070057'));
    ok('ConnectPlaneReference: a property -> 0x80070057', status(run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: [s2.properties[0]] }), '80070057'));
    ok('ConnectPlaneReference: another operator class -> 0x80070057', status(run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [bevel], Source: [s1] }), '80070057'));
    ok('ConnectPlaneReference: empty Target -> 0x80070057', status(run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [], Source: [s1] }), '80070057'));
    ok('ConnectPlaneReference: empty Source -> 0x80070057', status(run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [slice], Source: [] }), '80070057'));
    A.undo(); ok('ConnectPlaneReference: undo restores the previous reference', J(inst(slice, 1)) === J([['b12dPlane.poly']]), inst(slice, 1));
    A.redo(); ok('ConnectPlaneReference: redo', J(inst(slice, 1)) === J([['b12dS1']]));
  }
  // ================= AddInputToOperator / RemoveInputFromOperator / SubstituteOpInput
  {
    let r = run('AddInputToOperator', { Reference: S.port(slice, 1, 0, 0), New: s2 });
    ok('AddInputToOperator: new instance inserted after the referenced one, connected to New', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]), [r.err, inst(slice, 1)]);
    A.undo(); ok('AddInputToOperator: undo', J(inst(slice, 1)) === J([['b12dS1']]));
    A.redo(); ok('AddInputToOperator: redo', J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]));
    r = run('AddInputToOperator', { Reference: 'b12dCube.polymsh.slicepolygonsop.port[1,0,0]', New: 'b12dS3' });
    ok('AddInputToOperator: port path string, insert at instance + 1', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS3'], ['b12dS2']]), [r.err, inst(slice, 1)]);
    r = run('SubstituteOpInput', { Reference: S.port(slice, 1, 1, 0), New: s1 });
    ok('SubstituteOpInput: replaces the inputs of the same instance', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS1'], ['b12dS2']]), [r.err, inst(slice, 1)]);
    r = run('RemoveInputFromOperator', { Reference: S.port(slice, 1, 2, 0) });
    ok('RemoveInputFromOperator: removes the referenced instance', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS1']]), [r.err, inst(slice, 1)]);
    A.undo(); A.undo(); A.undo();
    ok('three undos restore [S1, S2]', J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]), inst(slice, 1));
    // element form: the primitive is connected to group 0 of the first operator of its object's stack
    r = run('RemoveInputFromOperator', { Reference: c1.primitive });
    ok('RemoveInputFromOperator: an element is resolved by scanning its owner\'s operators', !r.err && S.groupsOf(slice)[0].instances.length === 0, r.err);
    A.undo(); ok('RemoveInputFromOperator: undo', S.groupsOf(slice)[0].instances[0][0] === c1.primitive);
    r = run('AddInputToOperator', { Reference: s3, New: s1 });
    ok('AddInputToOperator: unresolved Reference -> XSIOPTASKS 0x7b, 0x80004005', status(r, '80004005') && has(r, /XSIOPTASKS 0x7b/), r);
    ok('RemoveInputFromOperator: unresolved -> 0x7c', has(run('RemoveInputFromOperator', { Reference: s3 }), /XSIOPTASKS 0x7c/));
    ok('SubstituteOpInput: unresolved -> 0x7d', has(run('SubstituteOpInput', { Reference: s3, New: s1 }), /XSIOPTASKS 0x7d/));
    r = run('AddInputToOperator', { Reference: S.port(slice, 1, 0, 0), New: s1, Type: 7 });
    ok('unknown Type -> 0x6f, 0x80004005', status(r, '80004005') && has(r, /XSIOPTASKS 0x6f/), r);
    ok('unresolved Reference with an unknown Type -> 0x6f', has(run('AddInputToOperator', { Reference: s3, New: s1, Type: 9 }), /XSIOPTASKS 0x6f/));
    r = run('AddInputToOperator', { Reference: S.port(slice, 1, 0, 0) });
    ok('AddInputToOperator: New missing, no pick session -> 0x80004003 (pick logged)', status(r, '80004003') && nya(r) === 1, r);
    S.hooks.pick = () => null; r = run('AddInputToOperator', { Reference: S.port(slice, 1, 0, 0) });
    ok('AddInputToOperator: cancelled pick passes 0x562e80c7 through, nothing changes', !r.err && S.lastStatus.status === 0x562e80c7 && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]), [r.err, S.lastStatus]);
    let prompt = null; S.hooks.pick = (p) => { prompt = p; return 'b12dS3.poly[0]'; }; r = run('SubstituteOpInput', { Reference: S.port(slice, 1, 0, 0) });
    ok('SubstituteOpInput: a picked sub-component is refused with 0x6f (prompt 0x3fa)', !!r.err && has(r, /XSIOPTASKS 0x6f/) && prompt === 'XSIOPTASKS 0x3fa', [r, prompt]);
    S.hooks.pick = () => s3; r = run('AddInputToOperator', { Reference: S.port(slice, 1, 1, 0) });
    ok('AddInputToOperator: the picked object is connected', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2'], ['b12dS3']]), [r.err, inst(slice, 1)]);
    delete S.hooks.pick; A.undo();
  }
  // ================= DisconnectPlaneReferenceFromSlicePolygonsOp
  {
    let r = run('DisconnectPlaneReferenceFromSlicePolygonsOp', { Target: [slice] });
    ok('DisconnectPlaneReference: removes instance 0 of group 1', !r.err && J(inst(slice, 1)) === J([['b12dS2']]), [r.err, inst(slice, 1)]);
    A.undo(); ok('DisconnectPlaneReference: undo', J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]));
    ok('DisconnectPlaneReference: not a Slice Polygons operator -> 0x80070057', status(run('DisconnectPlaneReferenceFromSlicePolygonsOp', { Target: [bevel] }), '80070057'));
  }
  // ================= bevel profile curve
  {
    const crv = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'b12dProfile' });
    let r = run('ConnectBevelProfileCurve', { Target: [bevel], Source: [s1] });
    ok('ConnectBevelProfileCurve: adds group 1 instance 0', !r.err && J(inst(bevel, 1)) === J([['b12dS1']]), [r.err, inst(bevel, 1)]);
    r = run('ConnectBevelProfileCurve', { Target: 'b12dCube.polymsh.bevelop', Source: 'b12dProfile' });
    ok('ConnectBevelProfileCurve: an existing profile is removed first (one instance left)', !r.err && J(inst(bevel, 1)) === J([['b12dProfile']]), [r.err, inst(bevel, 1)]);
    A.undo(); ok('ConnectBevelProfileCurve: undo restores the previous profile', J(inst(bevel, 1)) === J([['b12dS1']]), inst(bevel, 1));
    ok('ConnectBevelProfileCurve: empty Target -> 0x80070057', status(run('ConnectBevelProfileCurve', { Target: [], Source: [s1] }), '80070057'));
    ok('ConnectBevelProfileCurve: empty Source -> 0x80070057', status(run('ConnectBevelProfileCurve', { Target: [bevel], Source: [] }), '80070057'));
    r = run('DisconnectBevelProfileCurve', { Target: [bevel] });
    ok('DisconnectBevelProfileCurve: removes instance 0 of group 1', !r.err && inst(bevel, 1).length === 0, [r.err, inst(bevel, 1)]);
    ok('DisconnectBevelProfileCurve: no operator -> 0x80004003', status(run('DisconnectBevelProfileCurve', { Target: [s1] }), '80004003'));
    void crv;
  }
  // ================= ConnectOperatorParameter / DisconnectOperatorParameter
  {
    const p = slice.get('planeoffset');
    let r = run('ConnectOperatorParameter', { Parameter: p, ProjObj: s2 });
    const g = S.groupsOf(slice); const gi = g.length - 1;
    ok('ConnectOperatorParameter: ProjObj connected to the ports driving the parameter', !r.err && g[gi].instances[0][0] === s2 && S.paramConnection(p) === s2, r.err);
    A.undo(); ok('ConnectOperatorParameter: undo', S.groupsOf(slice)[gi].instances.length === 0 && S.paramConnection(p) === null);
    A.redo();
    r = run('DisconnectOperatorParameter', { Parameter: 'b12dCube.polymsh.slicepolygonsop.planeoffset' });
    ok('DisconnectOperatorParameter: dynamic group -> the instance is removed', !r.err && S.groupsOf(slice)[gi].instances.length === 0, r.err);
    A.undo();
    S.setParamDriver(slice, 'tolerance', { group: 0, instance: 0, ports: [0] });
    r = run('DisconnectOperatorParameter', { Parameter: slice.get('tolerance') });
    ok('DisconnectOperatorParameter: static group -> connected ports disconnected', !r.err && S.groupsOf(slice)[0].instances[0][0] === null, r.err);
    A.undo(); ok('DisconnectOperatorParameter: undo reconnects', S.groupsOf(slice)[0].instances[0][0] === c1.primitive);
    ok('ConnectOperatorParameter: parameter of a non-operator -> 0x80004002', status(run('ConnectOperatorParameter', { Parameter: s1.kinematics.local.get('posx'), ProjObj: s2 }), '80004002'));
    ok('ConnectOperatorParameter: null ProjObj -> 0x80004003', status(run('ConnectOperatorParameter', { Parameter: p }), '80004003'));
    const t = slice.get('nbslices'); t.lockLevel = 1;
    r = run('DisconnectOperatorParameter', { Parameter: t }); delete t.lockLevel;
    ok('DisconnectOperatorParameter: locked parameter -> 0x80070005 with the lock error', status(r, '80070005') && has(r, /is locked/), r);
    ok('DisconnectOperatorParameter: not an operator -> 0x80004002', status(run('DisconnectOperatorParameter', { Parameter: s1.kinematics.local.get('posx') }), '80004002'));
  }
  // ================= UpdateConnectOnOp
  {
    let r = run('UpdateConnectOnOp', { Operator: slice, GroupIndex: 1, GroupInstanceIndex: 1, InputObjs: [s3] });
    ok('UpdateConnectOnOp: updates the inputs of the instance (mode 3 logged)', !r.err && J(inst(slice, 1)) === J([['b12dS1'], ['b12dS3']]) && nya(r) === 1, [r.err, inst(slice, 1)]);
    A.undo(); ok('UpdateConnectOnOp: undo', J(inst(slice, 1)) === J([['b12dS1'], ['b12dS2']]));
    ok('UpdateConnectOnOp: no operator -> 0x80004003', status(run('UpdateConnectOnOp', { InputObjs: 'b12dS1' }), '80004003'));
  }
  // ================= GetConnectionSet / GetSurfaceFromCurvesConnectionSet
  {
    const a = { PresetObj: 'Twist', ConnectionSet: 'b12dS1,b12dS2;b12dS3' };
    let r = run('GetConnectionSet', a);
    const names = (r.v ?? []).map(g => g.map(x => x.name));
    ok('GetConnectionSet: ";" separates the groups, "," the inputs (Value)', !r.err && J(names) === J([['b12dS1', 'b12dS2'], ['b12dS3']]) && J(S.out.GetConnectionSet.OutputObjs) === '[]', [r.err, names]);
    ok('GetConnectionSet: the resolver routines are logged as not yet attested', nya(r) >= 1);
    ok('GetConnectionSet: unknown preset -> 0x80004005', status(run('GetConnectionSet', { PresetObj: 'NoSuchPresetB12d', ConnectionSet: 'b12dS1' }), '80004005'));
    r = run('GetSurfaceFromCurvesConnectionSet', { PresetObj: 'Twist', ConnectionSet: 'b12dS1' });
    ok('GetSurfaceFromCurvesConnectionSet: CreateOutputObjs defaults to true; the default output type is logged', !r.err && has(r, /built-in default preferred output geometry/) && has(r, /creation of output objects/), r);
    r = run('GetSurfaceFromCurvesConnectionSet', { PresetObj: 'Twist', ConnectionSet: 'b12dS1', Target: 'b12dS2' });
    ok('GetSurfaceFromCurvesConnectionSet: Target selects the preferred geometry (logged)', has(r, /selected by Target/), r);
  }
  // ================= MoveOperator
  {
    const o = mk('Cylinder', 'b12dMove');
    A.select([o]); const twist = A.run('ApplyOp', { PresetObj: 'Twist' })[0]; A.select([o]); const bend = A.run('ApplyOp', { PresetObj: 'Bend' })[0]; A.select([o]); const taper = A.run('ApplyOp', { PresetObj: 'Taper' })[0];
    const prim = o.primitive; const gen = prim.operators[0];
    const stack = () => prim.operators.map(x => x === gen ? 'gen' : x === twist ? 'twist' : x === bend ? 'bend' : x === taper ? 'taper' : '?').join();
    ok('MoveOperator setup', stack() === 'gen,twist,bend,taper', stack());
    let r = run('MoveOperator', { Object: o, OperatorToMove: twist });
    ok('MoveOperator: MoveAction 0 moves to the top of the stack', !r.err && stack() === 'gen,bend,taper,twist', [r.err, stack()]);
    ok('MoveOperator: undo record keeps action / direction / reference / neighbour', S.moves.at(-1)?.action === 0 && S.moves.at(-1)?.direction === 0 && S.moves.at(-1)?.reference === taper);
    A.undo(); ok('MoveOperator: undo', stack() === 'gen,twist,bend,taper');
    r = run('MoveOperator', { Object: o, OperatorToMove: taper, MoveAction: 1, OperatorReference: twist });
    ok('MoveOperator: MoveAction 1 = before the reference', !r.err && stack() === 'gen,taper,twist,bend', [r.err, stack()]);
    A.undo();
    r = run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: bend, MoveDirection: 1 });
    ok('MoveOperator: MoveAction 2 = after the reference; MoveDirection is recorded (logged)', !r.err && stack() === 'gen,bend,twist,taper' && S.moves.at(-1).direction === 1 && nya(r) === 1, [r.err, stack()]);
    A.undo();
    r = run('MoveOperator', { Object: o, OperatorToMove: taper });
    ok('MoveOperator: nothing to move -> XSIOPTASKS 0x5f warning, status 1', !r.err && has(r, /WARNING.*0x5f/) && S.lastStatus.status === 1 && stack() === 'gen,twist,bend,taper', r);
    ok('MoveOperator: MoveAction 3 -> 0x80070057', status(run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 3 }), '80070057'));
    ok('MoveOperator: MoveDirection 3 -> 0x80070057', status(run('MoveOperator', { Object: o, OperatorToMove: twist, MoveDirection: 3 }), '80070057'));
    r = run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 1 });
    ok('MoveOperator: a reference missing does nothing', !r.err && stack() === 'gen,twist,bend,taper', r);
    twist.lockLevel = 1; r = run('MoveOperator', { Object: o, OperatorToMove: twist }); delete twist.lockLevel;
    ok('MoveOperator: a locked operator stops silently', !r.err && stack() === 'gen,twist,bend,taper' && !has(r, /XSIOPTASKS/), r);
    const marker = prim.explorerChildren().find(n => n.type === 'animationmarker');
    r = run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: marker });
    ok('MoveOperator: MoveAction 2 on a construction-mode marker logs 0x407 and stops', !r.err && has(r, /XSIOPTASKS 0x407/) && stack() === 'gen,twist,bend,taper', r);
    r = run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 1, OperatorReference: marker });
    ok('MoveOperator: MoveAction 1 on a marker moves into that region (inferred)', !r.err && twist.region === 'animation' && stack() === 'gen,bend,taper,twist', [r.err, twist.region, stack()]);
    A.undo(); ok('MoveOperator: undo restores the region', twist.region === 'modeling' && stack() === 'gen,twist,bend,taper');
    S.groupsOf(taper).push({ name: 'probe', ports: 1, dynamic: true, instances: [[twist]] });
    r = run('MoveOperator', { Object: o, OperatorToMove: twist });
    ok('MoveOperator: MoveAction 0 with an operator above reading it -> 0x407', has(r, /XSIOPTASKS 0x407/) && stack() === 'gen,twist,bend,taper', r);
    S.groupsOf(taper).pop();
    r = run('MoveOperator', { Object: o, OperatorToMove: gen, MoveAction: 2, OperatorReference: bend });
    ok('MoveOperator: the generator -> 0x80004001 mapped to 0x5e', has(r, /XSIOPTASKS 0x5e/) && S.lastStatus.status === 0x80004001, r);
    r = run('MoveOperator', { Object: o, OperatorToMove: twist, MoveAction: 2, OperatorReference: bevel });
    ok('MoveOperator: a reference outside the stack -> 0x80070057 mapped to 0x60', has(r, /XSIOPTASKS 0x60/), r);
  }
  // ================= DisconnectFromSimulationOp
  {
    const clouds = A.run('CreateParticleCloud', { InputObjs: 'b12dS2' }); const cloud = clouds[0];
    const op = cloud.primitive.operators.find(o => o.type === 'ParticlesOp');
    op.connections.forces = [s3];
    const conn = () => J(Object.values(op.connections).flat().filter(x => x && x.name).map(x => x.name));
    const before = conn();
    let r = run('DisconnectFromSimulationOp', { InputObj: cloud, ObjectsToDisconnect: [s3] });
    ok('DisconnectFromSimulationOp: object form disconnects from the simulation operators, returns 0', !r.err && r.v === 0 && !op.connections.forces.includes(s3), [r.err, r.v, conn()]);
    A.undo(); ok('DisconnectFromSimulationOp: undo', conn() === before);
    r = run('DisconnectFromSimulationOp', { InputObj: cloud, ObjectsToDisconnect: [s1] });
    ok('DisconnectFromSimulationOp: nothing disconnected returns 1', !r.err && r.v === 1, r);
    r = run('DisconnectFromSimulationOp', { InputObj: S.port(slice, 1, 0, 0), ObjectsToDisconnect: 'b12dS1' });
    ok('DisconnectFromSimulationOp: port form disconnects through the port\'s operator', !r.err && r.v === 0 && J(inst(slice, 1)) === J([[null], ['b12dS2']]), [r.err, inst(slice, 1)]);
    A.undo();
    r = run('DisconnectFromSimulationOp', { InputObj: cloud });
    ok('DisconnectFromSimulationOp: no ObjectsToDisconnect -> 0x6f, 0x80004005', status(r, '80004005') && has(r, /XSIOPTASKS 0x6f/), r);
    ok('DisconnectFromSimulationOp: a port-like input without port interface -> 0x80004002', status(run('DisconnectFromSimulationOp', { InputObj: [{ notAPort: true }], ObjectsToDisconnect: 'b12dS1' }), '80004002'));
    while (A.undoStack.length && A.scene.find(cloud.name)) A.undo();
  }
  // ================= CycleChecking
  {
    let r = run('CycleChecking', {});
    ok('CycleChecking: no cycle -> IsCycle false', !r.err && r.v === false, r);
    // b12dS1's slice reads b12dCube (plane reference = cube) and cube's slice reads b12dS1: a cycle
    const sl2 = MS.tool.applySlicePolygons(s1);
    A.run('ConnectPlaneReferenceToSlicePolygonsOp', { Target: [sl2], Source: [c1] });
    r = run('CycleChecking', { StartingGraphPt: c1 }); const a = S.out.CycleChecking;
    ok('CycleChecking: a cycle sets IsCycle and lists the operators taking part', !r.err && r.v === true && a.IsCycle === true && a.OutputObjs.includes(slice) && a.OutputObjs.includes(sl2), [r.err, a.IsCycle, (a.OutputObjs ?? []).map(x => x.name)]);
    ok('CycleChecking: the cycle message is logged at severity 4', has(r, /WARNING.*PROBLEMATIC EVALUATION CYCLES ARE IN THE SPECIFIED GRAPH/), r.log);
    ok('CycleChecking: operators outside the cycle (the generators) are not listed', !a.OutputObjs.includes(c1.primitive.operators[0]) && !a.OutputObjs.includes(s1.primitive.operators[0]), (a.OutputObjs ?? []).map(x => x.name));
    A.prefValues = { ...(A.prefValues ?? {}), 'data_management.disable_cycle_checking': true };
    r = run('CycleChecking', { StartingGraphPt: c1, DisableCycleCheck: true });
    ok('CycleChecking: DisableCycleCheck honours the preference (nothing checked)', !r.err && r.v === false, r);
    r = run('CycleChecking', { StartingGraphPt: c1 });
    ok('CycleChecking: without DisableCycleCheck the preference is ignored', r.v === true, r);
    delete A.prefValues['data_management.disable_cycle_checking'];
    r = run('CycleChecking', { StartingGraphPt: s3 });
    ok('CycleChecking: a graph without the cycle -> false', r.v === false, r);
    A.undo(); A.undo();
  }
  // ================= CreateGridAndConnectToSlicePolygonsOp
  {
    const o = mk('Cube', 'b12dGridSrc'); o.kinematics.local.get('posx').value = 3;
    const sl = MS.tool.applySlicePolygons(o); sl.get('sliceplane').value = 1;   // Y axis
    A.undoStack.length = 0;
    const n0 = [...A.scene.allObjects()].length;
    const a = { Target: [sl] };
    const r = run('CreateGridAndConnectToSlicePolygonsOp', a);
    const g = r.v; const L = g?.kinematics?.local;
    const val = (k) => Math.round(L.get(k).value * 1e4) / 1e4;
    ok('CreateGrid: a grid is created and returned as Value', !r.err && g && g.primitive.operators[0].preset === 'Grid' && S.out.CreateGridAndConnectToSlicePolygonsOp.Value === g && [...A.scene.allObjects()].length === n0 + 1, r.err);
    ok('CreateGrid: placed at the plane origin (world)', g && val('posx') === 3 && val('posy') === 0 && val('posz') === 0, g && [val('posx'), val('posy'), val('posz')]);
    ok('CreateGrid: +Y onto the Y normal = no rotation', g && Math.abs(val('rotx')) + Math.abs(val('roty')) + Math.abs(val('rotz')) < 1e-6, g && [val('rotx'), val('roty'), val('rotz')]);
    const gop = g?.primitive.operators[0];
    ok('CreateGrid: both grid sizes = largest bbox extent in the plane frame (cube length 8)', gop && gop.get('ulength').value === 8 && gop.get('vlength').value === 8, gop && [gop.get('ulength')?.value, gop.get('vlength')?.value]);
    ok('CreateGrid: the grid is the plane reference', S.groupsOf(sl)[1].instances[0]?.[0] === g);
    ok('CreateGrid: parameter id 4 (usebbox) set to false', sl.get('usebbox').value === false);
    ok('CreateGrid: the final child task is logged', nya(r) === 1);
    A.undo();
    ok('CreateGrid: one undo removes the grid and restores the operator', [...A.scene.allObjects()].length === n0 && sl.get('usebbox').value === true && S.groupsOf(sl)[1].instances.length === 0);
    sl.get('sliceplane').value = 0;   // X axis: rotation taking +Y onto +X is -90 about Z
    const r2 = run('CreateGridAndConnectToSlicePolygonsOp', { Target: [sl] }); const L2 = r2.v?.kinematics.local;
    ok('CreateGrid: X normal -> rotz -90', !r2.err && Math.abs(L2.get('rotz').value + 90) < 1e-6 && Math.abs(L2.get('rotx').value) < 1e-6, r2.err ?? [L2.get('rotx').value, L2.get('roty').value, L2.get('rotz').value]);
    A.undo();
    ok('CreateGrid: not a Slice Polygons operator -> 0x80070057', status(run('CreateGridAndConnectToSlicePolygonsOp', { Target: [bevel] }), '80070057'));
  }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_optasks_b12d_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
