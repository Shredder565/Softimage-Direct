// CMD-B16e: TransferAllPropertiesAcrossGenOp (optasks.dll), AddShotClip / GetShotClip (actioncore.dll), PaintWeights
// (gap.dll). No XSIBATCH golden exists: this is a contract check against the "Wire contract" paragraphs of
// docs/ghidra/cmd-b16e-actioncore-optasks-gap-environments.md and items 38-42 of docs/re/WIRE_CORRECTIONS_B16.md.
//   1. every command is registered with the catalogue argument list (data/commands_full.json);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (or fails with the contract's status);
//   3. the contract's stated results (sub-task dispatch per item, free slot and trim, query outputs, count rules,
//      error codes, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_b16e_commands.mjs
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

const NAMES = ['TransferAllPropertiesAcrossGenOp', 'AddShotClip', 'GetShotClip', 'PaintWeights'];
/** Default run (cube selected): expected status, or null = must succeed. */
const DEFAULT_STATUS = { TransferAllPropertiesAcrossGenOp: '80004003', AddShotClip: '80004005', GetShotClip: null, PaintWeights: '80070057' };
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('PaintWeights') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_STATUS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.constructor?.name !== 'Object' && !Array.isArray(v) ? (v.name ?? String(v)) : v)).slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.setSelMode?.('object'); A.select([cube]); };
  const undoTo = u => { while (A.undoStack.length > u) A.undo(); };
  /** Wrap a command's execute to record its calls (passing through). */
  const trace = (names, f) => {
    const saved = names.map(n => [n, A.commands.get(n), A.commands.get(n).execute]); const calls = [];
    for (const [n, d, orig] of saved) d.execute = (app, a) => { calls.push({ n, a: { ...a } }); return orig.call(d, app, a); };
    try { f(); } finally { for (const [, d, orig] of saved) d.execute = orig; }
    return calls;
  };
  const S = () => A.cmdB16e;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n); undoTo(u0);
    const want = DEFAULT_STATUS[n];
    out.defaults[n] = want ? (status(r, want) ? 'expected-failure' : 'WRONG: ' + (r.err ?? 'no error')) : (r.err ? 'ERROR: ' + r.err : 'ok');
  }
  reset();

  // ================= TransferAllPropertiesAcrossGenOp
  try {
    const sph = (() => { const s = A.run('CreatePrim', { PresetObj: 'Sphere' }); return typeof s === 'object' ? s : A.scene.find(String(s)); })();
    const gen = A.run('ApplyGenOp', { PresetObj: 'MeshMerge', ConnectionSet: [cube, sph] });
    const op = gen.primitive.operators[0];
    ok('fixture: merge generator reading cube + sphere', op?.inputs?.length === 2, op?.inputs?.map(o => o.name));
    const Prop = cube.properties[0].constructor;
    const mkCluster = (o, idx, name) => { A.selectComponents(o, 'point', idx); const c = A.run('CreateCluster', { Name: name }); A.select([]); return c; };
    const clA = mkCluster(cube, [0, 1, 2], 'b16Cls'); const cp = new Prop('b16UV', 'uvspace', []); clA.addProperty(cp);
    const clB = mkCluster(cube, [3], 'b16Bare');
    const mat0 = cube.material; const smat = A.scene.materials[A.scene.materials.length - 1]; cube.setMaterial(smat);
    reset();
    const SUBS = ['SIBasicTransferClustersAcrossGenOp', 'TransferClusterPropertiesAcrossGenOp', 'TransferPropertiesAcrossGenOp', 'SIRebindByNameUserData'];
    const u0 = A.undoStack.length; let r;
    const calls = trace(['TransferAllPropertiesAcrossGenOp', ...SUBS], () => { r = run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: gen }); });
    const top = calls.filter(c => c.n !== 'TransferAllPropertiesAcrossGenOp' && c.n !== 'SIBasicTransferClusterPropertiesAcrossGenOp');
    const tcp = top.filter(c => c.n === 'TransferClusterPropertiesAcrossGenOp'), tp = top.filter(c => c.n === 'TransferPropertiesAcrossGenOp');
    const mats = [...new Set([cube.material, sph.material].filter(Boolean))];
    ok('TransferAll: no error, Value is the collection of transferred items', !r.err && Array.isArray(r.v) && r.v.length > 0 && S().out.TransferAllPropertiesAcrossGenOp.Value === r.v, r.err);
    ok('TransferAll: kind 1 (cluster property) -> TransferClusterPropertiesAcrossGenOp(Operator, Object, item, name, RebindClusterProperties false)',
      tcp.some(c => c.a.ClusterPropsToTransfer === cp && c.a.ClusterPropertyName === 'b16UV' && c.a.RebindClusterProperties === false && c.a.Operator === op && c.a.Object === gen), tcp.map(c => c.a.ClusterPropertyName));
    ok('TransferAll: kind 2 (material) -> TransferPropertiesAcrossGenOp(..., ShareProperty true, TransferClusterProperties false)',
      mats.length > 0 && mats.every(m => tp.some(c => c.a.PropertiesToTransfer === m && c.a.ShareProperty === true && c.a.TransferClusterProperties === false && c.a.PropertyName === m.name)), tp.map(c => c.a.PropertyName));
    ok('TransferAll: IncludeAllClusters false -> no bare-cluster transfer', !top.some(c => c.n === 'SIBasicTransferClustersAcrossGenOp' && c.a.ClustersToTransfer === clB));
    ok('TransferAll: kinematics / visibility categories are skipped', !tp.some(c => /^(kinematics|visibility)$/.test(c.a.PropertiesToTransfer?.type)));
    const rb = top.filter(c => c.n === 'SIRebindByNameUserData');
    ok('TransferAll "all" mode: one SIRebindByNameUserData per material after the transfers', rb.length === mats.length && rb.every(c => mats.includes(c.a.Material)) && top.indexOf(rb[0]) > top.indexOf(tcp[tcp.length - 1]), rb.length);
    ok('TransferAll: the cluster property is on the generated object', gen.clusters.some(c => c.properties.some(p => p.name === 'b16UV')));
    undoTo(u0); ok('TransferAll undo: transferred cluster removed', !gen.clusters.some(c => c.properties.some(p => p.name === 'b16UV')));
    const c2 = trace(SUBS, () => { r = run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: gen, IncludeAllClusters: true }); });
    ok('TransferAll IncludeAllClusters true: a bare cluster -> SIBasicTransferClustersAcrossGenOp(Operator, Object, item, name)', !r.err && c2.some(c => c.n === 'SIBasicTransferClustersAcrossGenOp' && c.a.ClustersToTransfer === clB && c.a.ClusterName === 'b16Bare'), r.err);
    undoTo(u0);
    const c3 = trace(SUBS, () => { r = run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertyTransferType: 'Material', ShareProperty: false }); });
    ok('TransferAll single category Material: only the material category; still "all" mode (rebind runs)', !r.err && c3.filter(c => c.n === 'TransferPropertiesAcrossGenOp').every(c => mats.includes(c.a.PropertiesToTransfer) && c.a.ShareProperty === false) && !c3.some(c => c.n === 'TransferClusterPropertiesAcrossGenOp'), [r.err, c3.map(c => c.n)]);
    undoTo(u0);
    const c4 = trace(SUBS, () => { r = run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertyTransferType: 'UV' }); });
    ok('TransferAll single category UV: only that category, no rebind', !r.err && c4.some(c => c.n === 'TransferClusterPropertiesAcrossGenOp') && !c4.some(c => c.n === 'TransferPropertiesAcrossGenOp' || c.n === 'SIRebindByNameUserData'), [r.err, c4.map(c => c.n)]);
    undoTo(u0);
    ok('TransferAll: unknown PropertyTransferType -> 0x80070057', status(run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: gen, PropertyTransferType: 'NoSuchKind' }), '80070057'));
    ok('TransferAll: null Operator -> 0x80004003', status(run('TransferAllPropertiesAcrossGenOp', { Object: gen }), '80004003'));
    r = run('TransferAllPropertiesAcrossGenOp', { Operator: op, Object: cube });
    ok('TransferAll: Object not the generator\'s output -> 0x111 logged, 0x80070057', status(r, '80070057') && has(r, /XSIOPTASKS 0x111/), r);
    cube.setMaterial(mat0);
    // DuplicateUsingGeomApprox: its subdivision operator has no generator input list in this build, so it keeps its
    // stand-in and does not call the command (which would fail 0x111)
    A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'b16dg' }); const dg = A.scene.find('b16dg');
    const ga = dg.properties.find(p => p.type === 'geomapprox'); if (ga?.get('gapproxmosl')) ga.set('gapproxmosl', 1);
    const u1 = A.undoStack.length;
    const c5 = trace(['TransferAllPropertiesAcrossGenOp'], () => { r = run('DuplicateUsingGeomApprox', { InputObjs: 'b16dg' }); });
    ok('DuplicateUsingGeomApprox: no failure; a non-generator operator is not handed to TransferAllPropertiesAcrossGenOp', !r.err && c5.length === 0 && has(r, /not yet attested: the property transfer/), [r.err, c5.length]);
    undoTo(u1);
  } catch (e) { ok('TransferAll block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= AddShotClip / GetShotClip
  try {
    const seq = A.scene.root.cameraSequencer ?? { tracks: [] };
    ok('fixture: empty camera sequencer', !(A.scene.root.cameraSequencer?.tracks?.length));
    const cam = [...A.scene.allObjects()].find(o => o.type === 'camera');
    const u0 = A.undoStack.length; const s0 = S()?.subtasks?.length ?? 0;
    let r = run('AddShotClip', { Name: 'S1', Parent: cam.name, Frame: 1, StartFrame: 10, EndFrame: 14 });
    const tracks = A.scene.root.cameraSequencer.tracks; const subs = S().subtasks.slice(s0);
    ok('AddShotClip, no track: the shot track is created with AddTrack (shot track type) under the scene model', !r.err && tracks.length === 1 && subs[0]?.task === 'AddTrack' && subs[0].args.Type === 8 && subs[0].args.Model === A.scene.root.name, [r.err, subs]);
    const s1 = r.v;
    ok('AddShotClip: clip at Frame, clip-in StartFrame, clip-out EndFrame, scale 1, camera = Parent', s1?.start === 1 && s1.timectrl.clipin === 10 && s1.timectrl.clipout === 14 && s1.timectrl.scale === 1 && s1.source === cam.name && s1.duration === 5 && S().out.AddShotClip.Clip === s1, s1);
    const s3 = run('AddShotClip', { Name: 'S3', Parent: cam.name, Frame: 20, StartFrame: 30, EndFrame: 34 }).v;
    ok('AddShotClip, existing shot track reused (no second AddTrack)', tracks.length === 1 && tracks[0].clips.length === 2 && !S().subtasks.slice(s0 + 1).some(t => t.task === 'AddTrack'));
    r = run('AddShotClip', { Name: 'S2', Frame: 3, StartFrame: 50, EndFrame: 60 });
    ok('AddShotClip: Frame inside a clip -> moved to the first free slot at or after Frame (GetInsertedClipBounds(Frame + 1) - 1)', !r.err && r.v.start === 5 && r.v.duration === 11, [r.err, r.v?.start]);
    ok('AddShotClip: fits before the next clip -> not trimmed', !S().subtasks.slice(s0).some(t => t.task === 'CutClip'));
    const s4r = run('AddShotClip', { Name: 'S4', Track: tracks[0], Frame: 16, StartFrame: 70, EndFrame: 80 });
    const cut = S().subtasks.slice(s0).filter(t => t.task === 'CutClip');
    ok('AddShotClip: overlap with the next clip -> added, then CutClip Mode 3 (siTrimAfter) at the free end', !s4r.err && s4r.v.start === 16 && cut.length === 1 && cut[0].args.Mode === 3 && cut[0].args.Time === 20 && cut[0].args.Clip === s4r.v, [s4r.err, cut]);
    ok('AddShotClip trim: the clip ends at the next clip (clip-out 74), message 0x69 logged', s4r.v.timectrl.clipout === 74 && s4r.v.duration === 5 && has(s4r, /XSIACTIONCORE 0x69/), [s4r.v?.timectrl, s4r.log]);
    const n1 = run('AddShotClip', { Frame: 40, StartFrame: 1, EndFrame: 2 }).v, n2 = run('AddShotClip', { Track: 'Shot_Track', Frame: 50, StartFrame: 1, EndFrame: 2 }).v;
    ok('AddShotClip: empty Name -> "Shot", no unique-name loop; Track by name', n1?.name === 'Shot' && n2?.name === 'Shot' && tracks[0].clips.includes(n2), [n1?.name, n2?.name]);
    ok('AddShotClip: Frame missing -> fails', status(run('AddShotClip', { StartFrame: 1, EndFrame: 5 }), '80004005'));
    ok('AddShotClip: EndFrame < StartFrame -> fails', status(run('AddShotClip', { Frame: 1, StartFrame: 10, EndFrame: 5 }), '80004005'));
    r = run('AddShotClip', { Frame: 90, Parent: 'noSuchCamB16', StartFrame: 1, EndFrame: 5 });
    ok('AddShotClip: unresolved Parent -> XSIACTIONCORE 0x27, fails', !!r.err && has(r, /XSIACTIONCORE 0x27/), r);
    const L = (A.lockRecordsB11 ??= new Map()); L.set(tracks[0], [{ id: 0, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
    ok('AddShotClip: locked track -> lock error', status(run('AddShotClip', { Track: tracks[0], Frame: 100, StartFrame: 1, EndFrame: 5 }), '80070005'));
    L.delete(tracks[0]);

    // GetShotClip
    const ug = A.undoStack.length;
    let g = run('GetShotClip', { Frame: 3 });
    ok('GetShotClip over S1: Clip, DirectlyOver, ActiveCamera = its camera; GlobalFrame default -1 not set', !g.err && g.v.Clip === s1 && g.v.DirectlyOver === true && g.v.ActiveCamera === cam && !('GlobalFrame' in S().out.GetShotClip) && S().out.GetShotClip.Clip === s1, g);
    g = run('GetShotClip', { Frame: 3, GlobalFrame: 0 });
    ok('GetShotClip GlobalFrame != -1: overwritten with the scene frame of Frame (query still at Frame)', g.v.Clip === s1 && g.v.GlobalFrame === 12 && S().out.GetShotClip.GlobalFrame === 12, g.v.GlobalFrame);
    g = run('GetShotClip', { Frame: 22, GlobalFrame: 100 });
    ok('GetShotClip: GlobalFrame is not an input frame (Frame 22 -> S3, scene frame 32)', g.v.Clip === s3 && g.v.GlobalFrame === 32, g.v.GlobalFrame);
    g = run('GetShotClip', { Frame: 200 });
    ok('GetShotClip outside every clip: not directly over, the open rule logged not yet attested', g.v.DirectlyOver === false && nya(g) && S().out.GetShotClip.DirectlyOver === false, g);
    ok('GetShotClip: not a scene change (no undo entry)', A.undoStack.length === ug);
    undoTo(u0);
    ok('AddShotClip undo: shot clips, shot track and the AddTrack row removed', !A.scene.root.cameraSequencer.tracks.length, A.scene.root.cameraSequencer.tracks.length);
    void seq;
  } catch (e) { ok('shot clip block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= PaintWeights
  try {
    A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'b16Grid' }); const gr = A.scene.find('b16Grid');
    const nul = (name, x) => { A.run('GetPrim', { PresetObj: 'Null', Name: name }); const o = A.scene.find(name); o.kinematics.local.set('posx', x); return o; };
    nul('b16L', -2); nul('b16R', 2);
    A.run('SIApplyFlexEnv', { ConnectionSet: 'b16Grid;b16L,b16R' });
    const env = gr.primitive.operators.find(op => op.weights && op.deformers);
    const eprop = gr.allProperties().find(p => p.type === 'envelope');
    ok('fixture: envelope with two deformers on the grid', env?.deformers?.length === 2 && env.weights.length > 4, env?.deformers?.length);
    reset(); const u0 = A.undoStack.length; const w0 = Float32Array.from(env.weights[0]);
    let r = run('PaintWeights', { InputObj: gr, Indices: [0, 1], Weights: [0.25, 0.5], Deformer: 0 });
    ok('PaintWeights Deformer 0: weights written for that deformer, normalised; OutputObj = the envelope weight property (inferred)', !r.err && near(env.weights[0][0], 0.25) && near(env.weights[0][1], 0.75) && near(env.weights[1][0], 0.5) && r.v === eprop && S().out.PaintWeights.OutputObj === eprop, [r.err, Array.from(env.weights[0])]);
    const w2 = env.weights[2][1];
    r = run('PaintWeights', { InputObj: 'b16Grid', Indices: 2, Weights: [0.3], Deformer: 0, Normalize: false });
    ok('PaintWeights: scalar Indices, Normalize false -> the other deformer untouched', !r.err && near(env.weights[2][0], 0.3) && near(env.weights[2][1], w2), r.err);
    r = run('PaintWeights', { InputObj: gr, Indices: [3], Weights: [0.2, 0.8], Deformer: -1 });
    ok('PaintWeights Deformer -1: one weight per deformer per point', !r.err && near(env.weights[3][0], 0.2) && near(env.weights[3][1], 0.8), r.err);
    r = run('PaintWeights', { InputObj: gr, Indices: [4, 5], Weights: [0.1, 0.9, 0.6, 0.4], Deformer: null });
    ok('PaintWeights Deformer missing = -1 (all deformers), weights laid out point x deformer', !r.err && near(env.weights[4][0], 0.1) && near(env.weights[5][0], 0.6) && near(env.weights[5][1], 0.4), r.err);
    ok('PaintWeights Deformer -1: weight count not a multiple of the index count -> 0x80070057', status(run('PaintWeights', { InputObj: gr, Indices: [0, 1], Weights: [1, 0, 1], Deformer: -1 }), '80070057'));
    ok('PaintWeights Deformer >= 0: counts not equal -> 0x80070057 (no padding)', status(run('PaintWeights', { InputObj: gr, Indices: [0, 1], Weights: [1], Deformer: 0 }), '80070057'));
    ok('PaintWeights: missing Weights -> 0x80070057', status(run('PaintWeights', { InputObj: gr, Indices: [0] }), '80070057'));
    ok('PaintWeights: empty Indices -> 0x8000FFFF', status(run('PaintWeights', { InputObj: gr, Indices: [], Weights: [0.5], Deformer: 0 }), '8000ffff'));
    ok('PaintWeights: scalar Weights stores no values -> 0x8000FFFF', status(run('PaintWeights', { InputObj: gr, Indices: [0], Weights: 0.5, Deformer: 0 }), '8000ffff'));
    ok('PaintWeights: an object without an envelope (plain weight map not used) -> 0x80070057', status(run('PaintWeights', { InputObj: cube, Indices: [0], Weights: [0.5], Deformer: 0 }), '80070057'));
    const L = (A.lockRecordsB11 ??= new Map()); L.set(env, [{ id: 0, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
    ok('PaintWeights: locked envelope -> 0x80070005', status(run('PaintWeights', { InputObj: gr, Indices: [0], Weights: [0.5], Deformer: 0 }), '80070005'));
    L.delete(env);
    undoTo(u0);
    ok('PaintWeights undo: old weights back', near(env.weights[0][0], w0[0]) && near(env.weights[0][1], w0[1]), [Array.from(env.weights[0]), Array.from(w0)]);
  } catch (e) { ok('PaintWeights block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, DEFAULT_STATUS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_b16e_commands: ${pass}/${pass + fail} ok`);
await browser.close();
process.exit(fail ? 1 : 0);
