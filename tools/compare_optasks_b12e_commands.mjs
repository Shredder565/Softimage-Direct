// CMD-B12e (optasks.dll): the 12 commands of src/commands/optasksB12e*.ts. There is no XSIBATCH golden for the row:
// this is a contract check against docs/ghidra/cmd-b12e-optasks-generator-transfers-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (return values, scene state, logged ids, statuses, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_optasks_b12e_commands.mjs
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
  'GetGeneratorInputReadPosition', 'GetGeneratorInputReadPosition_UIOnly', 'ChangeGeneratorInputReadPosition', 'GetGeneratorInputsForDisposal',
  'CopyAnimationAcrossGenerator', 'TransferShapeAnimationAcrossGenOp', 'TransferPropertiesAcrossGenOp', 'TransferClusterPropertiesAcrossGenOp',
  'SIBasicTransferClusterPropertiesAcrossGenOp', 'SIBasicTransferClustersAcrossGenOp', 'PropertyTransfer', 'SITransferCenter',
];
// Required input without a usable default (cube selected): the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['GetGeneratorInputsForDisposal', 'TransferPropertiesAcrossGenOp', 'TransferClusterPropertiesAcrossGenOp',
  'SIBasicTransferClusterPropertiesAcrossGenOp', 'SIBasicTransferClustersAcrossGenOp', 'PropertyTransfer']);

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
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');   // the sample scene (cube) is the demo scene
await page.waitForFunction(() => !!window.Application?.commands?.get('SITransferCenter') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.optasksB12e;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const last = () => S.lastStatus?.status;
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ---------------- fixture: a Merge Meshes generator reading cube + a new sphere
  const mkSphere = () => { const s = A.run('CreatePrim', { PresetObj: 'Sphere' }); return typeof s === 'object' ? s : A.scene.find(String(s)); };
  const sph = mkSphere();
  const gen = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [cube, sph] });
  const op = gen.primitive.operators[0];
  ok('fixture: merge generator with inputs cube + sphere', op.inputs?.length === 2 && op.inputs[0] === cube, op.inputs?.map(o => o.name));
  const Prop = cube.properties[0].constructor;
  const mkCluster = (o, idx, name) => { A.selectComponents(o, 'point', idx); const c = A.run('CreateCluster', { Name: name }); A.select([]); return c; };
  const pos = () => A.run('GetGeneratorInputReadPosition', { Operator: op });

  // ================= GetGeneratorInputReadPosition(_UIOnly)
  {
    const u0 = A.undoStack.length;
    const r = run('GetGeneratorInputReadPosition', { Operator: op });
    ok('GetGeneratorInputReadPosition: first input read at the generator\'s current level (inputreadregion 0)', r.v === 0 && !r.err, r);
    ok('GetGeneratorInputReadPosition: nothing changes, no undo', A.undoStack.length === u0);
    ok('GetGeneratorInputReadPosition: an operator without inputs stays at 3', run('GetGeneratorInputReadPosition', { Operator: cube }).v === 3);
    const ui = run('GetGeneratorInputReadPosition_UIOnly', { Operator: op });
    ok('GetGeneratorInputReadPosition_UIOnly: same task, same value', ui.v === 0, ui);
    ok('GetGeneratorInputReadPosition_UIOnly: not journalled', !ui.log.some(l => /GetGeneratorInputReadPosition_UIOnly\(/.test(l)), ui.log);
    A.select([]); ok('GetGeneratorInputReadPosition: no Operator -> 0x80070057', status(run('GetGeneratorInputReadPosition'), '80070057')); reset();
  }
  // ================= ChangeGeneratorInputReadPosition
  {
    const u0 = A.undoStack.length;
    const r = run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 2 });
    const moves = S.moves.slice(-2);
    ok('ChangeGeneratorInputReadPosition 2: every input connection moved to the animation marker (move action 2)', !r.err && moves.length === 2 && moves.every(m => m.op === op && m.position === 2 && m.action === 2) && moves.map(m => m.input).join() === [cube, sph].join(), r.err);
    ok('ChangeGeneratorInputReadPosition: GetGeneratorInputReadPosition reads 2, inputreadregion follows', pos() === 2 && op.val('inputreadregion') === 2, [pos(), op.val('inputreadregion')]);
    ok('ChangeGeneratorInputReadPosition: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('ChangeGeneratorInputReadPosition: undo restores the read position', pos() === 0 && op.val('inputreadregion') === 0, pos());
    A.redo(); ok('ChangeGeneratorInputReadPosition: redo', pos() === 2);
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 3 });
    ok('ChangeGeneratorInputReadPosition 3: moved to the top of the input stack', pos() === 3 && S.moves.at(-1).action === 'top');
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: ':siConstructionModePrimaryShape:siConstructionMode' });
    ok('ChangeGeneratorInputReadPosition: construction-mode name', pos() === 1, pos());
    A.run('SetConstructionMode', { Mode: 'animation' });
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 4 });
    ok('ChangeGeneratorInputReadPosition 4: the scene\'s current construction mode', pos() === 2, pos());
    A.run('SetConstructionMode', { Mode: 'modeling' });
    ok('ChangeGeneratorInputReadPosition 5 -> 0x80070057', status(run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 5 }), '80070057'));
    const n0 = S.moves.length; const rn = run('ChangeGeneratorInputReadPosition', { Operator: 'NoSuchOpB12e', ReadPosition: 1 });
    ok('ChangeGeneratorInputReadPosition: null Operator does nothing', !rn.err && S.moves.length === n0, rn.err);
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 0 });
    // shapes transferred onto the generated object and the tri-state UnTransferShapesAndEnvelopes rule
    A.run('StoreShapeKey', { InputObj: [cube], Name: 'B12eKeyA' });
    A.run('TransferShapeAnimationAcrossGenOp', { Operator: op, Object: gen });
    const tkey = () => gen.properties.find(p => p.type === 'shapekey' && p.name === 'B12eKeyA');
    ok('fixture: transferred shape key on the generated object', !!tkey());
    let asked = null; S.hooks.prompt = (id, cmd) => { asked = [id, cmd]; return 'cancel'; };
    const c1 = run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1 });
    ok('UnTransferShapesAndEnvelopes 2: prompt XSIOPTASKS 0x409', asked?.[0] === 0x409 && has(c1, /XSIOPTASKS 0x409/), asked);
    ok('Cancel: returns 0x562e80c7, nothing changed', !c1.err && last() === 0x562e80c7 && pos() === 0 && !!tkey(), [c1.err, last(), pos()]);
    S.hooks.prompt = () => 'no';
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1 });
    ok('No: shapes kept, position moved', !!tkey() && pos() === 1 && S.prompts.at(-1).answer === 'no');
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 0 });
    S.hooks.prompt = () => 'yes';
    const u1 = A.undoStack.length; run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1 });
    ok('Yes: transferred shapes deleted (DeleteObj sub-task)', !tkey() && pos() === 1);
    A.undo(); ok('Yes: undo brings the shapes back and the position', !!tkey() && pos() === 0 && A.undoStack.length === u1);
    delete S.hooks.prompt;
    const nb = run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1 });
    ok('without a message-box hook: logged as not yet attested, answered No', nya(nb) === 1 && !!tkey(), nb.log);
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 0 });
    const d0 = run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1, UnTransferShapesAndEnvelopes: 0 });
    ok('UnTransferShapesAndEnvelopes 0: deleted without asking', !tkey() && !has(d0, /0x409/));
    A.undo();
    // envelopes only from position 2
    const nul = A.scene.find('root_null');
    A.run('ApplyFlexEnv', { ConnectionSet: [gen], DeformerSet: [nul] });
    const env = () => gen.primitive.operators.find(o => o.type === 'envelopop');
    ok('fixture: envelope on the generated object', !!env());
    S.hooks.prompt = () => 'yes';
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 1 });
    ok('position 1: envelopes are not removed', !!env() && !tkey());
    A.undo();
    run('ChangeGeneratorInputReadPosition', { Operator: op, ReadPosition: 2 });
    ok('position 2: envelopes and shapes removed', !env() && !tkey());
    A.undo(); ok('undo: envelope back', !!env() && !!tkey());
    delete S.hooks.prompt;
    while (env()) { A.undo(); }
    reset();
  }
  // ================= GetGeneratorInputsForDisposal
  {
    const u0 = A.undoStack.length;
    const r = run('GetGeneratorInputsForDisposal', { InputObjs: op, GenOpInputsDisposal: 2 });
    ok('GetGeneratorInputsForDisposal hide mode: the generator\'s inputs', Array.isArray(r.v) && r.v.join() === [cube, sph].join(), r);
    ok('GetGeneratorInputsForDisposal: an object resolves to the generator on its geometry', run('GetGeneratorInputsForDisposal', { InputObjs: gen, GenOpInputsDisposal: 1 }).v?.length === 2);
    ok('GetGeneratorInputsForDisposal: deletes / hides nothing, no undo', A.undoStack.length === u0 && !!A.scene.find('cube'));
    ok('GetGeneratorInputsForDisposal: GenOpInputsDisposal 0 -> 0x80070057', status(run('GetGeneratorInputsForDisposal', { InputObjs: op, GenOpInputsDisposal: 0 }), '80070057'));
    ok('GetGeneratorInputsForDisposal: empty InputObjs -> 0x80070057', (() => { A.select([]); const x = status(run('GetGeneratorInputsForDisposal', { GenOpInputsDisposal: 1 }), '80070057'); reset(); return x; })());
    ok('GetGeneratorInputsForDisposal: an object without generator -> 0x80070057', status(run('GetGeneratorInputsForDisposal', { InputObjs: cube, GenOpInputsDisposal: 1 }), '80070057'));
    const gen2 = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [cube, mkSphere()] });
    const r2 = run('GetGeneratorInputsForDisposal', { InputObjs: op, GenOpInputsDisposal: 1 });
    ok('GetGeneratorInputsForDisposal delete mode: an input still read by another generator is kept (inferred)', r2.v?.join() === [sph].join(), r2.v?.map(o => o.name));
    const r3 = run('GetGeneratorInputsForDisposal', { InputObjs: [op, gen2], GenOpInputsDisposal: 1 });
    ok('GetGeneratorInputsForDisposal: several generators, inputs appended once', r3.v?.length === 3, r3.v?.map(o => o.name));
    A.undo(); A.undo(); A.undo();
    ok('fixture cleanup', !A.scene.find(gen2.name));
    reset();
  }
  // ================= TransferShapeAnimationAcrossGenOp
  {
    const before = gen.properties.length;
    const k2 = A.run('StoreShapeKey', { InputObj: [sph], Name: 'B12eKeyB' });
    const u0 = A.undoStack.length;
    const r = run('TransferShapeAnimationAcrossGenOp', { Operator: op, Object: gen });
    const names = gen.properties.filter(p => p.type === 'shapekey').map(p => p.name).sort();
    ok('TransferShapeAnimationAcrossGenOp: the inputs\' shape keys copied onto the generated object', !r.err && names.join() === 'B12eKeyA,B12eKeyB' && last() === 0, names);
    ok('TransferShapeAnimationAcrossGenOp: one undo step', A.undoStack.length === u0 + 1);
    const r2 = run('TransferShapeAnimationAcrossGenOp', { Operator: op, Object: gen });
    ok('TransferShapeAnimationAcrossGenOp: keys already transferred are not copied again (inferred)', gen.properties.filter(p => p.type === 'shapekey').length === 2 && A.undoStack.length === u0 + 1, r2.err);
    A.undo(); ok('TransferShapeAnimationAcrossGenOp: undo', gen.properties.filter(p => p.type === 'shapekey').length === 1);
    k2.shapeSources = [k2, cube.properties.find(p => p.name === 'B12eKeyA')];
    ok('TransferShapeAnimationAcrossGenOp: an item with two sources -> 0x80004005', status(run('TransferShapeAnimationAcrossGenOp', { Operator: op, Object: gen }), '80004005'));
    delete k2.shapeSources;
    A.select([]); ok('TransferShapeAnimationAcrossGenOp: null argument -> 0x80004003', status(run('TransferShapeAnimationAcrossGenOp', { Object: gen }), '80004003')); reset();
    const sp3 = mkSphere(); const g3 = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [sp3] });
    const r3 = run('TransferShapeAnimationAcrossGenOp', { Operator: g3.primitive.operators[0], Object: g3 });
    ok('TransferShapeAnimationAcrossGenOp: no shape items -> S_FALSE, nothing changed', !r3.err && last() === 1 && !g3.properties.some(p => p.type === 'shapekey'));
    A.undo(); A.undo();
    while (gen.properties.length > before) A.undo();
    void before; reset();
  }
  // ================= SIBasicTransferClustersAcrossGenOp
  const cls = mkCluster(cube, [0, 1, 2], 'B12ePts');
  {
    ok('fixture: point cluster on cube', cls?.elements?.size === 3);
    const u0 = A.undoStack.length;
    const r = run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: gen, ClustersToTransfer: cls });
    const c = r.v;
    ok('SIBasicTransferClustersAcrossGenOp: new cluster on the generated object, element type and count of the source', !r.err && gen.clusters.includes(c) && c.compKind === 'pnt' && c.elements.size === 3 && c.name === 'B12ePts', r.err);
    ok('SIBasicTransferClustersAcrossGenOp: linked through the generator (mode 0), registered with the operator, marked created', S.links.get(c)?.source === cls && S.links.get(c)?.mode === 0 && S.opClusters.get(op)?.includes(c) && S.createdBy.get(c) === 'SIBasicTransferClustersAcrossGenOp');
    A.undo(); ok('SIBasicTransferClustersAcrossGenOp: undo removes the cluster', !gen.clusters.includes(c) && A.undoStack.length === u0);
    A.redo(); ok('SIBasicTransferClustersAcrossGenOp: redo', gen.clusters.includes(c)); A.undo();
    const rn = run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: gen, ClustersToTransfer: cls, ClusterName: 'B12eNamed' });
    ok('SIBasicTransferClustersAcrossGenOp: ClusterName', rn.v?.name === 'B12eNamed'); A.undo();
    const e1 = run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: cube, ClustersToTransfer: cls });
    ok('SIBasicTransferClustersAcrossGenOp: Object not the generator\'s output -> 0x111, 0x80070057', status(e1, '80070057') && has(e1, /XSIOPTASKS 0x111/), e1.log);
    const e1b = run('SIBasicTransferClustersAcrossGenOp', { Operator: cube, Object: gen, ClustersToTransfer: cls });
    ok('SIBasicTransferClustersAcrossGenOp: not a generator -> 0x111', status(e1b, '80070057') && has(e1b, /0x111/));
    const own = mkCluster(gen, [0], 'B12eOwn');
    const e3 = run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: gen, ClustersToTransfer: own });
    ok('SIBasicTransferClustersAcrossGenOp: cluster not on an input -> 0x113', status(e3, '80070057') && has(e3, /XSIOPTASKS 0x113/), e3.log);
    A.undo();
    ok('SIBasicTransferClustersAcrossGenOp: null argument -> 0x80004003', status(run('SIBasicTransferClustersAcrossGenOp', { Operator: op, Object: gen }), '80004003'));
    reset();
  }
  // ================= SIBasicTransferClusterPropertiesAcrossGenOp
  const wp = new Prop('B12eWeights', 'wtmap', [{ name: 'weights', type: 'string', value: '[1,0.5,0.25]' }, { name: 'strength', type: 'number', value: 0.75 }]);
  cls.addProperty(wp);
  {
    const nc = gen.clusters.length;
    const r = run('SIBasicTransferClusterPropertiesAcrossGenOp', { Operator: op, ClusterPropsToTransfer: wp });
    const np = r.v; const tc = np?.parent;
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: no target cluster -> one is created (link mode 1)', !r.err && gen.clusters.length === nc + 1 && gen.clusters.includes(tc) && S.links.get(tc)?.mode === 1 && S.links.get(tc)?.source === cls, r.err);
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: property created with the source values (value transfer logged)', np?.type === 'wtmap' && np.name === 'B12eWeights' && np.val('weights') === '[1,0.5,0.25]' && np.val('strength') === 0.75 && nya(r) === 1, np && [np.name, np.type]);
    const r2 = run('SIBasicTransferClusterPropertiesAcrossGenOp', { Operator: op, Cluster: tc, ClusterPropsToTransfer: wp, ClusterPropertyName: 'B12eW2' });
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: given target cluster, ClusterPropertyName', r2.v?.parent === tc && r2.v.name === 'B12eW2' && gen.clusters.length === nc + 1, r2.err);
    A.undo(); A.undo();
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: undo removes property and created cluster', gen.clusters.length === nc);
    const e = run('SIBasicTransferClusterPropertiesAcrossGenOp', { Operator: op, ClusterPropsToTransfer: cube.properties[0] });
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: not a cluster property of an input -> 0x114', status(e, '80070057') && has(e, /XSIOPTASKS 0x114/), e.log);
    ok('SIBasicTransferClusterPropertiesAcrossGenOp: null argument -> 0x80004003', status(run('SIBasicTransferClusterPropertiesAcrossGenOp', { Operator: op }), '80004003'));
  }
  // ================= TransferClusterPropertiesAcrossGenOp
  {
    const nc = gen.clusters.length; const u0 = A.undoStack.length;
    const r = run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: gen, ClusterPropsToTransfer: wp });
    const np = r.v; const tc = np?.parent;
    ok('TransferClusterPropertiesAcrossGenOp: owning cluster transferred, then the property onto it', !r.err && gen.clusters.length === nc + 1 && S.links.get(tc)?.source === cls && S.links.get(np)?.source === wp && np.val('strength') === 0.75, r.err);
    ok('TransferClusterPropertiesAcrossGenOp: rebind step logged as not yet attested', has(r, /not yet attested: the rebind step/), r.log);
    ok('TransferClusterPropertiesAcrossGenOp: sub-tasks undone as one step', A.undoStack.length === u0 + 1);
    const r2 = run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: gen, ClusterPropsToTransfer: wp, ClusterPropertyName: 'B12eW3', RebindClusterProperties: false });
    ok('TransferClusterPropertiesAcrossGenOp: the transferred cluster is reused (inferred); no rebind when false', r2.v?.parent === tc && r2.v.name === 'B12eW3' && gen.clusters.length === nc + 1 && !has(r2, /rebind/), r2.err);
    A.undo(); A.undo(); ok('TransferClusterPropertiesAcrossGenOp: undo', gen.clusters.length === nc && A.undoStack.length === u0);
    const e = run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: cube, ClusterPropsToTransfer: wp });
    ok('TransferClusterPropertiesAcrossGenOp: Object not the output -> 0x111', status(e, '80070057') && has(e, /0x111/));
    const e2 = run('TransferClusterPropertiesAcrossGenOp', { Operator: op, Object: gen, ClusterPropsToTransfer: gen.properties[0] });
    ok('TransferClusterPropertiesAcrossGenOp: not a cluster property of an input -> 0x114', status(e2, '80070057') && has(e2, /0x114/));
  }
  // ================= TransferPropertiesAcrossGenOp
  {
    const disp = cube.properties.find(p => p.type === 'display');
    const r = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: disp, PropertyName: 'B12eDisp', ShareProperty: false });
    ok('TransferPropertiesAcrossGenOp: object property copied onto Object, returned in Value', !r.err && r.v?.name === 'B12eDisp' && r.v.type === 'display' && gen.properties.includes(r.v), r.err);
    A.undo(); ok('TransferPropertiesAcrossGenOp: undo', !gen.properties.some(p => p.name === 'B12eDisp'));
    const r2 = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: disp, PropertyName: 'B12eDisp' });
    ok('TransferPropertiesAcrossGenOp: ShareProperty true logs the share step as not yet attested', !r2.err && has(r2, /not yet attested: sharing/)); A.undo();
    const nc = gen.clusters.length;
    const r3 = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: wp });
    ok('TransferPropertiesAcrossGenOp: a cluster property goes through TransferClusterPropertiesAcrossGenOp', !r3.err && S.links.get(r3.v)?.source === wp && gen.clusters.length === nc + 1, r3.err);
    A.undo();
    const r4 = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: wp, TransferClusterProperties: false });
    ok('TransferPropertiesAcrossGenOp: TransferClusterProperties false excludes cluster properties', !r4.err && gen.clusters.length === nc && Array.isArray(r4.v) && !r4.v.length, r4.err);
    const mat = A.scene.materials[A.scene.materials.length - 1];
    if (mat) {
      const old = cube.material; cube.setMaterial(mat);
      const r5 = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: mat });
      ok('TransferPropertiesAcrossGenOp: a material is assigned and rebound in "Rebind tasks"', !r5.err && gen.material === mat && has(r5, /Rebind tasks/), r5.err);
      A.undo(); cube.setMaterial(old);
    } else ok('fixture: a scene material', false);
    const e = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: gen.properties[0] });
    ok('TransferPropertiesAcrossGenOp: not a property of an input -> 0x115', status(e, '80070057') && has(e, /XSIOPTASKS 0x115/), e.log);
    const e2 = run('TransferPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertiesToTransfer: cube.kinematics });
    ok('TransferPropertiesAcrossGenOp: kind 0 -> 0x80004001', status(e2, '80004001'), e2.err);
    ok('TransferPropertiesAcrossGenOp: Object not the output -> 0x111', has(run('TransferPropertiesAcrossGenOp', { Operator: op, Object: cube, PropertiesToTransfer: disp }), /0x111/));
  }
  // ================= PropertyTransfer
  {
    const disp = cube.properties.find(p => p.type === 'display');
    const n0 = sph.primitive.operators.length;
    const r = run('PropertyTransfer', { Target: sph, PropObj: disp });
    ok('PropertyTransfer: a PropertyXferOp applied on the target (ApplyOperator, preset class d46e5407-...)', !r.err && r.v?.type === 'PropertyXferOp' && sph.primitive.operators.includes(r.v) && r.v.preset === 'd46e5407-66fc-46b4-8fc4-aefd5f9f906f' && r.v.connectionMode === 2 && r.v.flags === 4 && r.v.source === disp, r.err);
    ok('PropertyTransfer: connection groups logged as not yet attested', nya(r) === 1);
    A.undo(); ok('PropertyTransfer: undo', sph.primitive.operators.length === n0);
    ok('PropertyTransfer: empty PropObj -> 0x80070057', status(run('PropertyTransfer', { Target: sph }), '80070057'));
    ok('PropertyTransfer: PropObj not a property -> 0x80070057', status(run('PropertyTransfer', { Target: sph, PropObj: cube }), '80070057'));
  }
  // ================= SITransferCenter
  {
    const o = mkSphere(); A.run('Rotate', { InputObj: [o], Y: 90 }); A.run('Translate', { InputObj: [o], X: 2 });
    const T = o.globalMatrix().clone();
    const world = () => { const m = o.primitive.mesh(); const g = o.globalMatrix(); const out = []; for (let i = 0; i < Math.min(m.positions.length, 30); i += 3) { const e = g.elements, x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2]; out.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); } return out; };
    const w0 = world(); const n0 = o.primitive.operators.length; const u0 = A.undoStack.length;
    const r = run('SITransferCenter', { InputObj: o, X: 1, Y: 2, Z: 3 });
    const l = o.kinematics.local;
    // local Y rotation 90: local (1,2,3) -> parent (3,2,-1); position was (2,0,0)
    ok('SITransferCenter: centre moved by (X, Y, Z) in local space', !r.err && Math.abs(l.val('posx') - 5) < 1e-6 && Math.abs(l.val('posy') - 2) < 1e-6 && Math.abs(l.val('posz') + 1) < 1e-6, [l.val('posx'), l.val('posy'), l.val('posz')]);
    const w1 = world();
    ok('SITransferCenter: the geometry does not move in world space', w1.length === w0.length && w1.every((v, i) => Math.abs(v - w0[i]) < 1e-4), [w0.slice(0, 3), w1.slice(0, 3)]);
    ok('SITransferCenter: one undo step', A.undoStack.length === u0 + 1 && o.primitive.operators.length === n0 + 1);
    A.undo(); ok('SITransferCenter: undo', o.primitive.operators.length === n0 && o.globalMatrix().equals(T));
    run('SITransferCenter', { InputObj: o }); ok('SITransferCenter: a zero offset still runs (identity)', o.primitive.operators.length === n0 + 1 && o.globalMatrix().equals(T)); A.undo();
    A.select([]); ok('SITransferCenter: no input -> 0x80070057', status(run('SITransferCenter'), '80070057'));
    A.undo(); A.undo(); A.undo(); reset();
  }
  // ================= CopyAnimationAcrossGenerator
  {
    const a1 = mkSphere(), a2 = mkSphere();
    const g = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [a1, a2] }); const gop = g.primitive.operators[0];
    const nm0 = S.moves.length;
    const r0 = run('CopyAnimationAcrossGenerator', { Operator: gop, TransferRemainingShapesAndEnvelopes: 0 });
    ok('CopyAnimationAcrossGenerator: inputs without animation -> nothing happens', !r0.err && S.moves.length === nm0 && last() === 0, r0.err);
    A.run('StoreShapeKey', { InputObj: [a1], Name: 'B12eAnimKey' });
    const c = mkCluster(a2, [0, 1], 'B12eAnimCls'); c.addProperty(new Prop('B12eAnimW', 'wtmap', [{ name: 'strength', type: 'number', value: 0.5 }]));
    S.hooks.prompt = () => 'cancel';
    const rc = run('CopyAnimationAcrossGenerator', { Operator: gop });
    ok('CopyAnimationAcrossGenerator: prompt 0x40a, Cancel -> 0x562e80c7, nothing changed', !rc.err && last() === 0x562e80c7 && S.prompts.at(-1).id === 0x40a && !g.clusters.length && !g.properties.some(p => p.type === 'shapekey'), rc.err);
    delete S.hooks.prompt;
    const u0 = A.undoStack.length; const nm = S.moves.length;
    const r = run('CopyAnimationAcrossGenerator', { Operator: gop, TransferRemainingShapesAndEnvelopes: 0 });
    const tp = g.clusters[0]?.properties[0];
    ok('CopyAnimationAcrossGenerator: cluster properties of the inputs transferred', !r.err && g.clusters.length === 1 && tp?.name === 'B12eAnimW' && S.links.get(tp)?.source.name === 'B12eAnimW', r.err);
    ok('CopyAnimationAcrossGenerator: shape animation transferred', g.properties.some(p => p.type === 'shapekey' && p.name === 'B12eAnimKey'));
    ok('CopyAnimationAcrossGenerator: then ChangeGeneratorInputReadPosition on the operator (open question: position, logged)', S.moves.length === nm + 2 && S.moves.at(-1).op === gop && has(r, /not yet attested: the ReadPosition/), r.log);
    ok('CopyAnimationAcrossGenerator: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('CopyAnimationAcrossGenerator: undo removes every sub-task\'s result', !g.clusters.length && !g.properties.some(p => p.type === 'shapekey') && S.moves.length === nm);
    const rn = run('CopyAnimationAcrossGenerator', { Operator: gop, TransferRemainingShapesAndEnvelopes: 1 });
    ok('CopyAnimationAcrossGenerator: TransferRemainingShapesAndEnvelopes 1 transfers nothing, read position still changed (inferred)', !rn.err && !g.clusters.length && S.moves.length === nm + 2);
    A.undo();
    ok('CopyAnimationAcrossGenerator: not a generator -> nothing happens', !run('CopyAnimationAcrossGenerator', { Operator: cube }).err);
    while (A.scene.find(a1.name)) A.undo();
    reset();
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
console.log(`compare_optasks_b12e_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
