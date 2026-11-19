// CMD-B12c (optasks.dll): the 14 commands of src/commands/optasksB12c*.ts. There is no XSIBATCH golden for the row:
// this is a contract check against docs/ghidra/cmd-b12c-optasks-envelope-weights-volumes-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (return values, scene state, logged ids, notifications, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_optasks_b12c_commands.mjs
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
  'SIApplyFlexEnv', 'SIApplyFlexEnvWithWeight', 'SILocalAssignFlexEnv', 'ResetFlexEnvPtsAssignment', 'SIModifyFlexEnvWght', 'SISymEnvWeight',
  'LockEnvelopeWeights', 'ConnectWeightMap', 'AddMappingNode', 'SIApplyDeformByCage', 'InspectPropVolume', 'GetConnectedPropVolume',
  'TogglePropVolume', 'GenerateAutomaticUVs',
];
// Required input without a usable default (cube selected): the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['SIModifyFlexEnvWght', 'ConnectWeightMap', 'AddMappingNode', 'GenerateAutomaticUVs']);

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
await page.waitForFunction(() => !!window.Application?.commands?.get('SIApplyFlexEnv') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.optasksB12c; const API = S.api;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const st = () => S.lastStatus?.status;
  const cube = A.scene.find('cube');
  const reset = () => { A.setSelMode('object'); A.select([cube]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  ok('default runs leave no proportional volume on the cube', !(cube.primitive.operators.some(o => o.preset === 'by Volume')));

  // scene: grids (meshes symmetric in X), nulls left / right / middle, a cage cube
  const grid = (name) => { A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: name }); return A.scene.find(name); };
  const nul = (name, x, y = 0) => { A.run('GetPrim', { PresetObj: 'Null', Name: name }); const o = A.scene.find(name); o.kinematics.local.set('posx', x); o.kinematics.local.set('posy', y); return o; };
  const g = grid('b12Grid'), g2 = grid('b12Grid2'), g3 = grid('b12Grid3'), g4 = grid('b12Grid4'), g5 = grid('b12Grid5');
  const L = nul('b12L', -2), R = nul('b12R', 2), M = nul('b12M', 0, 3);
  A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'b12Cage' }); const cage = A.scene.find('b12Cage');
  const envOf = (o) => o.primitive.operators.find(op => op.weights && op.deformers);
  const envProp = (o) => o.allProperties().find(p => p.type === 'envelope');
  const nPts = (o) => o.primitive.mesh().positions.length / 3;
  reset();

  // ================= SIApplyFlexEnv
  {
    const r0 = run('SIApplyFlexEnv', { ConnectionSet: 'cube' });
    ok('SIApplyFlexEnv: no deformer -> message 0x29 (severity 4), S_FALSE, nothing changed', !r0.err && has(r0, /WARNING : SIApplyFlexEnv: \[XSIOPTASKS 0x29\]/) && st() === 1 && !envOf(cube), r0);
    const n0 = S.notifications.length, u0 = A.undoStack.length;
    const r = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid;b12L,b12R' });
    const env = envOf(g); const cl = g.cluster('EnvelopWeightCls');
    ok('SIApplyFlexEnv: new envelope on group 0 with the group-1 deformers, returned in CreatedObj', !r.err && Array.isArray(r.v) && r.v[0] === env && env.deformers.length === 2 && env.deformers[0] === L, r.err);
    ok('SIApplyFlexEnv: point cluster EnvelopWeightCls holds the envelope weight property', !!cl && cl.compKind === 'pnt' && cl.properties.some(p => p.type === 'envelope' && p.op === env));
    ok('SIApplyFlexEnv: auto-assign operator c3denvelopeautoassignop2, weights normalised', env.siClass === 'c3denvelopop' && env.autoAssign?.siClass === 'c3denvelopeautoassignop2' && env.weights.length === nPts(g) && env.weights.every(w => Math.abs(w[0] + w[1] - 1) < 1e-5));
    ok('SIApplyFlexEnv: SI3D_ENVELOPEWEIGHTPROP_CREATED fired', S.notifications.length === n0 + 1 && S.notifications[n0].name === 'SI3D_ENVELOPEWEIGHTPROP_CREATED' && S.notifications[n0].objects[0] === g.fullName);
    ok('SIApplyFlexEnv: non-interactive run returns S_FALSE and records no undo step', st() === 1 && A.undoStack.length === u0, [st(), A.undoStack.length - u0]);
    ok('SIApplyFlexEnv: the refresh step on the selection is logged not yet attested', nya(r) === 1 && has(r, /0x1800d9088/), r.log);
    ok('SIApplyFlexEnv: default ConstructionMode = current (modeling)', env.region === 'modeling', env.region);
    // interactive: undo fires REMOVED and removes the envelope, redo puts it back
    const ri = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid2;b12L', Interactive: true });
    const e2 = envOf(g2);
    ok('SIApplyFlexEnv Interactive: one undo entry', !ri.err && !!e2 && A.undoStack[A.undoStack.length - 1]?.label === 'SIApplyFlexEnv');
    const n1 = S.notifications.length; A.undo();
    ok('SIApplyFlexEnv undo: SI3D_ENVELOPEWEIGHTPROP_REMOVED, envelope and cluster removed', S.notifications[n1]?.name === 'SI3D_ENVELOPEWEIGHTPROP_REMOVED' && !envOf(g2) && !g2.cluster('EnvelopWeightCls'));
    A.redo(); ok('SIApplyFlexEnv redo: envelope back', envOf(g2) === e2 && !!g2.cluster('EnvelopWeightCls'));
    // ConstructionMode argument
    const rc = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid5;b12L', ConstructionMode: 'siConstructionModeAnimation' });
    ok('SIApplyFlexEnv: ConstructionMode sets the region of the apply', !rc.err && envOf(g5)?.region === 'animation', rc.err);
    const rm = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid4;b12L' });
    ok('SIApplyFlexEnv: the ambient construction mode is restored afterwards', !rm.err && envOf(g4)?.region === 'modeling', envOf(g4)?.region);
    A.run('RemoveFlexEnv', { InputObjs: 'b12Grid4' }); A.run('RemoveFlexEnv', { InputObjs: 'b12Grid5' });
    // existing envelope: deformers added, AssignNewDeformers false -> new deformer weight 0
    const ra = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid;b12M' });
    ok('SIApplyFlexEnv existing envelope: the deformer is added with weight 0 (AssignNewDeformers false)', !ra.err && env.deformers.length === 3 && env.deformers[2] === M && env.weights.every(w => w.length === 3 && w[2] === 0) && Array.isArray(ra.v) && ra.v.length === 0, ra.err);
    const rb = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid2;b12M', AssignNewDeformers: true, Interactive: true });
    ok('SIApplyFlexEnv AssignNewDeformers: the new deformer gets points', !rb.err && e2.deformers.length === 2 && e2.weights.some(w => w[1] > 0), rb.err);
    A.undo(); ok('SIApplyFlexEnv undo of the added deformer', e2.deformers.length === 1 && e2.weights.every(w => w.length === 1));
    // selected points of an enveloped object join the envelope cluster; a wrong component type is reported
    cl.elements.delete(0); A.selectComponents(g, 'point', [0]);
    run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid;b12M' });
    ok('SIApplyFlexEnv existing envelope: selected points added to the envelope cluster (SIAddToCluster)', cl.elements.has(0));
    A.selectComponents(g, 'polygon', [0]);
    const rw = run('SIApplyFlexEnv', { ConnectionSet: 'b12Grid;b12M' });
    ok('SIApplyFlexEnv: wrong component type -> 0x428 then the class message, severity 4', has(rw, /\[XSIOPTASKS 0x428\]/) && has(rw, /\[XSIOPTASKS 0x42a\]/) && !rw.err, rw.log);
    reset();
  }
  // ================= SIApplyFlexEnvWithWeight
  {
    const n = nPts(g3); const w = []; for (let i = 0; i < n; i++) w.push(100, 0);
    const r = run('SIApplyFlexEnvWithWeight', { ConnectionSet: 'b12Grid3;b12L,b12R', EnvelopeWeights: w });
    const env = envOf(g3);
    ok('SIApplyFlexEnvWithWeight: EnvelopeWeights are the initial weights (per point, per deformer)', !r.err && r.v === undefined && !!env && env.weights.every(x => x[0] === 1 && x[1] === 0), r.err);
    ok('SIApplyFlexEnvWithWeight: cluster EnvelopWeightCls, CREATED notification, S_FALSE', !!g3.cluster('EnvelopWeightCls') && S.notifications.at(-1).command === 'SIApplyFlexEnvWithWeight' && st() === 1);
    const r2 = run('SIApplyFlexEnvWithWeight', { ConnectionSet: 'b12Grid4;b12L,b12R', EnvelopeWeights: [100, 0, 0, 100] });
    const e4 = envOf(g4);
    ok('SIApplyFlexEnvWithWeight: a short array sets the first points, the rest keep auto weights (logged)', !r2.err && e4.weights[0][0] === 1 && e4.weights[1][1] === 1 && nya(r2) >= 1, r2.log);
    A.run('RemoveFlexEnv', { InputObjs: 'b12Grid4' });
  }
  // ================= SIApplyDeformByCage
  {
    const r0 = run('SIApplyDeformByCage', { ConnectionSet: 'b12Grid4' });
    ok('SIApplyDeformByCage: no cage -> 0x29, S_FALSE', !r0.err && has(r0, /\[XSIOPTASKS 0x29\]/) && st() === 1);
    const r = run('SIApplyDeformByCage', { ConnectionSet: 'b12Grid4;b12Cage', Interactive: true });
    const op = g4.primitive.operators.find(o => o.preset === 'by Cage');
    ok('SIApplyDeformByCage: cage deform operator with its auto-assign operator, in CreatedObj', !r.err && !!op && r.v[0] === op && op.siClass === 'c3dcagedeformop' && op.autoAssign?.siClass === 'c3dcageautoassignop' && op.refs[0] === cage, r.err);
    ok('SIApplyDeformByCage: point cluster CageWeightCls', g4.cluster('CageWeightCls')?.compKind === 'pnt');
    ok('SIApplyDeformByCage: CREATED notification; cage helper properties logged not yet attested', S.notifications.at(-1).name === 'SI3D_ENVELOPEWEIGHTPROP_CREATED' && has(r, /SIApplyDeformByCage: not yet attested: the cage helper property/) && !has(r, /0x1800d9088/), r.log);
    A.undo(); ok('SIApplyDeformByCage undo: operator and cluster removed, REMOVED fired', !g4.primitive.operators.some(o => o.preset === 'by Cage') && !g4.cluster('CageWeightCls') && S.notifications.at(-1).name === 'SI3D_ENVELOPEWEIGHTPROP_REMOVED');
    A.select([g4, cage]); const rs = run('SIApplyDeformByCage', { Interactive: true });
    ok('SIApplyDeformByCage: one selected group = objects then the cage (inferred)', !rs.err && g4.primitive.operators.some(o => o.preset === 'by Cage' && o.refs[0] === cage), rs.err);
    A.undo(); reset();
  }
  // ================= LockEnvelopeWeights
  const env = envOf(g); const prop = envProp(g);
  {
    const r0 = run('LockEnvelopeWeights', { PropObj: prop, Points: [], Deformers: [0] });
    ok('LockEnvelopeWeights: no points -> S_FALSE, no operator', !r0.err && st() === 1 && r0.v === undefined);
    ok('LockEnvelopeWeights: null point array -> 0x80004003', status(run('LockEnvelopeWeights', { PropObj: prop, Deformers: [0] }), '80004003'));
    ok('LockEnvelopeWeights: null deformer array -> 0x80004003', status(run('LockEnvelopeWeights', { PropObj: prop, Points: [1] }), '80004003'));
    const r = run('LockEnvelopeWeights', { PropObj: prop, Points: [3, 4], Deformers: [0] });
    const op = r.v;
    ok('LockEnvelopeWeights: a c3dlockenvelopeweightsop is applied and returned in OutputObj', !r.err && op instanceof API.LockEnvelopeWeightsOperator && op.siClass === 'c3dlockenvelopeweightsop' && op.isLocked(3, 0) && op.isLocked(4, 0) && !op.isLocked(3, 1), r.err);
    const r2 = run('LockEnvelopeWeights', { PropObj: prop, Points: 7, Deformers: '0,1,2' });
    ok('LockEnvelopeWeights: the connected operator is reused; one index / an index list', r2.v === op && [0, 1, 2].every(d => op.isLocked(7, d)) && env.locked.has(7), r2.err);
    A.undo(); ok('LockEnvelopeWeights undo restores the previous lock state', !op.isLocked(7, 0) && !env.locked.has(7) && op.isLocked(3, 0));
    run('LockEnvelopeWeights', { PropObj: prop, Points: [4], Deformers: [0], Locked: false });
    ok('LockEnvelopeWeights Locked false unlocks', !op.isLocked(4, 0) && op.isLocked(3, 0));
    reset(); ok('LockEnvelopeWeights: no PropObj (cube selected) -> S_FALSE', !run('LockEnvelopeWeights', { Points: [1], Deformers: [0] }).err && st() === 1);
  }
  // ================= SILocalAssignFlexEnv / ResetFlexEnvPtsAssignment
  {
    const r = run('SILocalAssignFlexEnv', { SubComp: 'b12Grid.pnt[0,1]', ConnectionSet: 'b12R', NbDeformersPerPoint: 1, Interactive: true });
    const iR = env.deformers.indexOf(R);
    ok('SILocalAssignFlexEnv: points reassigned to the nearest connection-set deformer(s), at most NbDeformersPerPoint', !r.err && [0, 1].every(i => env.weights[i][iR] === 1 && env.weights[i].filter(x => x > 0).length === 1) && nya(r) === 1, r.err ?? r.log);
    A.undo(); ok('SILocalAssignFlexEnv undo', [0, 1].some(i => env.weights[i][iR] !== 1));
    const before3 = Array.from(env.weights[3]);
    const rl = run('SILocalAssignFlexEnv', { SubComp: 'b12Grid.pnt[3,5]', ConnectionSet: 'b12R', NbDeformersPerPoint: 1 });
    ok('SILocalAssignFlexEnv: locked points skipped and reported once with 0x1d0 (", " list)', !rl.err && Array.from(env.weights[3]).join() === before3.join() && env.weights[5][iR] === 1 && rl.log.filter(l => /\[XSIOPTASKS 0x1d0\] b12Grid\.pnt\[3\]$/.test(l)).length === 1, rl.log);
    reset(); const rn = run('SILocalAssignFlexEnv');
    ok('SILocalAssignFlexEnv: no SubComp -> S_FALSE, nothing logged', !rn.err && st() === 1 && !nya(rn));
    const rc = run('SILocalAssignFlexEnv', { SubComp: 'cube.pnt[0]' });
    ok('SILocalAssignFlexEnv: no envelope under SubComp -> 0x29', !rc.err && has(rc, /\[XSIOPTASKS 0x29\]/) && st() === 1);
    const rr = run('ResetFlexEnvPtsAssignment', { SubComp: 'b12Grid.pnt[6]' });
    const w6 = env.weights[6]; const s6 = Array.from(w6).reduce((s, x) => s + x, 0);
    ok('ResetFlexEnvPtsAssignment: the envelope\'s own deformers, 2 per point, weights sum to 1', !rr.err && w6.filter(x => x > 0).length <= 2 && Math.abs(s6 - 1) < 1e-5 && rr.v === undefined, rr.err);
    ok('ResetFlexEnvPtsAssignment: OutputObjs logged not yet attested', has(rr, /ResetFlexEnvPtsAssignment: not yet attested: how OutputObjs/));
  }
  // ================= SIModifyFlexEnvWght
  {
    const iL = env.deformers.indexOf(L);
    const r = run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'b12L', SubComp: 'b12Grid.pnt[8]', Mode: 0, Value: 40 });
    const w = env.weights[8]; const sum = (x) => Array.from(x).reduce((s, v) => s + v, 0);
    ok('SIModifyFlexEnvWght Mode 0: weight set, others renormalised, OutputObj = the property', !r.err && r.v === prop && Math.abs(w[iL] - 0.4) < 1e-5 && Math.abs(sum(w) - 1) < 1e-5, r.err);
    run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'b12L', SubComp: 'b12Grid.pnt[8]', Mode: 1, Value: 10 });
    ok('SIModifyFlexEnvWght Mode 1 (add, inferred)', Math.abs(env.weights[8][iL] - 0.5) < 1e-5);
    run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'b12L', SubComp: 'b12Grid.pnt[8]', Mode: 2, Value: 50 });
    ok('SIModifyFlexEnvWght Mode 2 (percentage, inferred)', Math.abs(env.weights[8][iL] - 0.25) < 1e-5);
    const others = Array.from(env.weights[8]).filter((_, k) => k !== iL);
    run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'b12L', SubComp: 'b12Grid.pnt[8]', Value: 100, Normalize: false });
    ok('SIModifyFlexEnvWght Normalize false leaves the other deformers', env.weights[8][iL] === 1 && Array.from(env.weights[8]).filter((_, k) => k !== iL).every((x, i) => Math.abs(x - others[i]) < 1e-6));
    A.undo(); ok('SIModifyFlexEnvWght undo', Math.abs(env.weights[8][iL] - 0.25) < 1e-5);
    ok('SIModifyFlexEnvWght: SubComp not a sub-component -> 0x80070057', status(run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'b12L', SubComp: 'b12Grid' }), '80070057'));
    ok('SIModifyFlexEnvWght: no envelope property -> 0x80004003', status(run('SIModifyFlexEnvWght', { PropObj: 'cube', Name: 'b12L', SubComp: 'b12Grid.pnt[1]' }), '80004003'));
    ok('SIModifyFlexEnvWght: unknown deformer name -> 0x80070057 (inferred)', status(run('SIModifyFlexEnvWght', { PropObj: prop, Name: 'nope', SubComp: 'b12Grid.pnt[1]' }), '80070057'));
  }
  // ================= SISymEnvWeight
  {
    const e3 = envOf(g3); const p3 = envProp(g3); const P = g3.primitive.mesh().positions; const n = P.length / 3;
    const key = (x, y, z) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    const at = new Map(); for (let i = 0; i < n; i++) at.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i);
    const mirror = (i) => at.get(key(-P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    const left = []; for (let i = 0; i < n; i++) if (P[i * 3] < -1e-3 && mirror(i) !== undefined) left.push(i);
    const r0 = run('SISymEnvWeight', { SubComp: `b12Grid3.pnt[${left.join(',')}]` });
    ok('SISymEnvWeight: no mapping template -> 0x29, S_FALSE, nothing changed', !r0.err && has(r0, /\[XSIOPTASKS 0x29\]/) && st() === 1 && e3.weights.every(w => w[0] === 1));
    A.select([L]); const tpl = A.run('CreateSymmetryMappingTemplate', {}); reset();
    const r = run('SISymEnvWeight', { SubComp: `b12Grid3.pnt[${left.join(',')}]` });
    ok('SISymEnvWeight: weights of each listed point copied to its symmetric point through the deformer mapping', !r.err && r.v === p3 && st() === 0 && left.every(i => e3.weights[mirror(i)][1] === 1 && e3.weights[mirror(i)][0] === 0 && e3.weights[i][0] === 1), r.err ?? r.log);
    ok('SISymEnvWeight: template of the deformer model found; the point lookup is logged not yet attested', nya(r) === 1 && !!tpl);
    A.undo(); ok('SISymEnvWeight undo', e3.weights.every(w => w[0] === 1));
    const r2 = run('SISymEnvWeight', { PropObj: p3, SubComp: 'b12Grid3', MappingTemplate: tpl });
    ok('SISymEnvWeight: explicit PropObj / MappingTemplate, whole object', !r2.err && r2.v === p3 && left.every(i => e3.weights[mirror(i)][1] === 1), r2.err);
    A.undo(); A.scene.root.removeProperty(tpl); reset();
  }
  // ================= ConnectWeightMap / AddMappingNode
  {
    const PropCls = cube.properties[0].constructor;
    const wm = new PropCls('WM', 'weightmap', []); wm.values = new Map(); g.cluster('EnvelopWeightCls').addProperty(wm);
    const op = envOf(g2); const ports = API.weightMapPorts(op);
    const r = run('ConnectWeightMap', { Operator: op, PropObj: wm });
    ok('ConnectWeightMap: the weight map goes to the operator\'s weight-map port', !r.err && ports.a === wm && st() === 0, r.err);
    A.undo(); ok('ConnectWeightMap undo', ports.a === null);
    ok('ConnectWeightMap: no operator -> 0x80004003', status(run('ConnectWeightMap', { PropObj: wm }), '80004003'));
    ok('ConnectWeightMap: no weight map -> 0x80004003', status(run('ConnectWeightMap', { Operator: op }), '80004003'));
    const opB = envOf(g3); opB.secondWeightMapPort = true; const pb = API.weightMapPorts(opB);
    run('ConnectWeightMap', { Operator: opB, PropObj: wm });
    ok('ConnectWeightMap: a free second weight-map port is connected too', pb.a === wm && pb.b === wm);
    const wm2 = new PropCls('WM2', 'weightmap', []); g.cluster('EnvelopWeightCls').addProperty(wm2);
    op.outputs = [wm2]; const u0 = A.undoStack.length;
    const rc = run('ConnectWeightMap', { Operator: op, PropObj: wm2 });
    ok('ConnectWeightMap: a connection closing a cycle is undone, 0x1e logged, 0x562e80c7 returned', !rc.err && ports.a === null && has(rc, /\[XSIOPTASKS 0x1e\]/) && st() === 0x562e80c7 && A.undoStack.length === u0, rc.log);
    delete op.outputs;
    const ra = run('AddMappingNode', { Operator: op, PropObj: wm });
    const map = ra.v?.MappingNodeProp, mix = ra.v?.MapMixerOp;
    ok('AddMappingNode: weight map "MappingNode" on a new all-points cluster of the owner', !ra.err && map?.name === 'MappingNode' && map.type === 'weightmap' && map.siClass === 'c3dweightprop' && g.clusters.some(c => c.properties.includes(map) && c.elements.size === nPts(g)), ra.err);
    ok('AddMappingNode: C3DWeightMapsMixerOp with inputs [new map, PropObj], connected to the operator', mix instanceof API.WeightMapsMixerOperator && mix.siClass === 'C3DWeightMapsMixerOp' && mix.inputs[0] === map && mix.inputs[1] === wm && ports.a === mix);
    A.undo(); ok('AddMappingNode undo', ports.a === null && !g.clusters.some(c => c.properties.includes(map)) && !API.extraOperators.has(mix));
    const rn = run('AddMappingNode', { PropObj: wm });
    ok('AddMappingNode without Operator: the element-reference path is logged not yet attested', !rn.err && nya(rn) === 1 && rn.v?.MapMixerOp, rn.err);
    A.undo();
    ok('AddMappingNode: PropObj not a property -> 0x80004003', status(run('AddMappingNode', { PropObj: 'cube' }), '80004003'));
  }
  // ================= GetConnectedPropVolume / InspectPropVolume / TogglePropVolume
  {
    A.run('ApplyPropVolumeOp', { ConnectionSet: 'b12Grid4' }); reset();
    const vop = g4.primitive.operators.find(o => o.preset === 'by Volume');
    const r = run('GetConnectedPropVolume', { InputObjs: 'b12Grid4,cube' });
    ok('GetConnectedPropVolume: the proportional-volume operators of the inputs, in stack order', !r.err && r.v.length === 1 && r.v[0] === vop && st() === 1, r.err);
    let inspected = null; const off = A.events.on('inspect', (n) => { inspected = n; });
    const sel0 = [...A.selection];
    const ri = run('InspectPropVolume', { InputObjs: 'b12Grid4' }); off();
    ok('InspectPropVolume: InspectObj on GetConnectedPropVolume\'s list, no undo entry, S_FALSE', !ri.err && inspected === vop && S.lastInspected?.[0] === vop && A.undoStack.at(-1)?.label !== 'InspectPropVolume' && st() === 1 && A.selection[0] === sel0[0], ri.err);
    inspected = null; const off2 = A.events.on('inspect', (n) => { inspected = n; }); run('InspectPropVolume', { InputObjs: 'cube' }); off2();
    ok('InspectPropVolume: nothing connected -> no inspection', inspected === null);
    const rt = run('TogglePropVolume', { InputObjs: 'b12Grid4' });
    ok('TogglePropVolume: an enabled volume is switched off (operator muted); parameter id 2 logged not yet attested', !rt.err && vop.val('mute') === true && nya(rt) >= 1, rt.err);
    run('TogglePropVolume', { InputObjs: 'b12Grid4' });
    ok('TogglePropVolume: second toggle switches it on again', vop.val('mute') === false);
    A.undo(); ok('TogglePropVolume undo', vop.val('mute') === true);
    const rn = run('TogglePropVolume', { InputObjs: 'b12Grid5' });
    ok('TogglePropVolume: none found and switching on -> one is created (initialisation values logged)', !rn.err && g5.primitive.operators.some(o => o.preset === 'by Volume') && has(rn, /initialisation values/), rn.err);
    A.undo(); ok('TogglePropVolume undo removes the created volume', !g5.primitive.operators.some(o => o.preset === 'by Volume'));
  }
  // ================= GenerateAutomaticUVs
  {
    const gen = g.primitive.operators[0];
    const r = run('GenerateAutomaticUVs', { Operator: gen, Object: g, ClusterPropertyName: 'AutoUV' });
    const p = r.v;
    ok('GenerateAutomaticUVs: UV cluster property on a new sample cluster, returned in Value', !r.err && p?.type === 'uvprojection' && p.name === 'AutoUV' && g.clusters.some(c => c.compKind === 'sample' && c.properties.includes(p)) && st() === 0, r.err);
    ok('GenerateAutomaticUVs: the UV computation is logged not yet attested', has(r, /GenerateAutomaticUVs: not yet attested: how the generator computes/));
    const r2 = run('GenerateAutomaticUVs', { Operator: gen, Object: g, ClusterPropertyName: 'AutoUV' });
    ok('GenerateAutomaticUVs: existing name -> message 0x162 (severity 4), S_OK, nothing created', !r2.err && r2.v === p && has(r2, /WARNING : GenerateAutomaticUVs: \[XSIOPTASKS 0x162\]/) && st() === 0);
    const r3 = run('GenerateAutomaticUVs', { Operator: gen, Object: g });
    ok('GenerateAutomaticUVs: empty name -> default name logged (inferred)', !r3.err && r3.v?.name === 'Texture_Projection' && has(r3, /default property name/));
    A.undo(); A.undo();
    ok('GenerateAutomaticUVs undo', !g.allProperties().includes(p));
    const r4 = run('GenerateAutomaticUVs', { Operator: cube.primitive.operators[0], Object: g });
    ok('GenerateAutomaticUVs: operator of another object -> message 0x111 (severity 2), 0x80070057', status(r4, '80070057') && r4.log.some(l => /GenerateAutomaticUVs: \[XSIOPTASKS 0x111\]/.test(l)));
    ok('GenerateAutomaticUVs: no Object -> 0x80004003', status(run('GenerateAutomaticUVs', { Operator: gen }), '80004003'));
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
console.log(`compare_optasks_b12c_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
