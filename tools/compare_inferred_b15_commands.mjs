// CMD-B15-ELSE (inferred, relaxed rules): the batch-15 commands still missing from the bus after PR #191, plus the
// registration tables made literal for the coverage scan. No analyst note or XSIBATCH golden backs the inferred commands:
// this checks the behaviour their registration comments state (src/commands/inferredB15.ts, shellsB15Else.ts).
// SISwapArrayElements, SIAppendBone, AddShaderAttachedComment and the bbbbee29 shader-creation family moved to
// src/commands/shadertasksB16b.ts (row CMD-B16b, analyst contract) and are checked by tools/compare_shaders_b16b.mjs.
//   1. every name is registered with the catalogue argument list (data/commands_full.json);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error;
//   3. the stated results; 4. the literalised table names (rig builders, Syflex pickers, CreateInspectParticleType*)
//      are still on the bus.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_inferred_b15_commands.mjs
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

const INFERRED = [
  'Add Surface Point Tool', 'BoneCreateTool', 'CopyPartition', 'CopyPaste', 'CreateEnvironmentCache', 'CrowdCreateDirectionalEmitterTool', 'CrowdCreateWallTool',
  'CursorTransformTool', 'Delete Selected Branch', 'DeleteCurrentLayer', 'Dice Object/Polygons', 'DoNothing', 'Freeze Selected', 'Mesh Filter', 'MoveComponent Tool',
  'PaintWeights', 'Pick Session Tool', 'RegenerateMaps', 'ToggleProjectionTool', 'Transform Set New ',
  'Turn OFF Interactive SRT', 'Turn ON Interactive SRT', 'XYZ Transform ',
];
const SHELLS = ['MarkObjectDirty', 'GetSkeleton'];
const LITERAL = ['MakeBiped', 'MakeBipedDogLeg', 'MakeQuadruped', 'MakeArm', 'MakeLeg', 'MakeFoot', 'MakeHand', 'MakeHead', 'MakeSpine', 'MakeShadowChain', 'MakeShadowSpine', 'MakeBicepRoll', 'MakeForearmRoll', 'Make2PointSlide', 'MakeJointCompression', 'MakeDogLeg', 'MakeBipedCharacterKeySet', 'MakeQuadrupedCharacterKeySet', 'SetKeyableRig', 'syCachePaint1', 'syCachePaint2', 'SyGetMassMap', 'SyGetSpringMap', 'CreateInspectParticleTypeBillboard', 'CreateInspectParticleTypeBlob', 'CreateInspectParticleTypeSphere'];
const NAMES = [...INFERRED, ...SHELLS];
const DEFAULT_FAILS = new Set(['CopyPaste', 'CreateEnvironmentCache', 'PaintWeights', 'DeleteCurrentLayer']);
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
await page.waitForFunction(() => !!window.Application?.commands?.get('DoNothing') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, LITERAL, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.select([cube]); };
  /** Replace a command's execute with a recorder for the duration of f. */
  const trace = (name, f, passThrough = false) => { const d = A.commands.get(name); const orig = d.execute; const calls = []; d.execute = (app, a) => { calls.push({ ...a }); return passThrough ? orig.call(d, app, a) : undefined; }; try { f(); } finally { d.execute = orig; } return calls; };
  const objCount = () => [...A.scene.allObjects()].length;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    // a modal page left open by a user-session command (OBJ Import... options page) never resolves here
    if (r.v && typeof r.v.then === 'function') await Promise.race([r.v.catch(() => undefined), new Promise(res => setTimeout(res, 300))]);
    document.querySelectorAll('.sdkh-modal-backdrop').forEach(b => b.remove());
    A.miscDsScripts?.session?.cancel?.();
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  // ================= INFERRED commands
  try {
    reset();
    for (const n of ['Add Surface Point Tool', 'CursorTransformTool', 'ToggleProjectionTool']) { const r = run(n); ok(`${n} (CMD-B16a): no such tool here -> not yet attested, no change`, nya(r) && !r.err); }
    { const r = run('Transform Set New '); ok('Transform Set New  (CMD-B16a §7): inert, no log', !r.err && r.v === undefined && !(r.log ?? []).length, r.log); }
    for (const n of ['DoNothing', 'XYZ Transform ']) { const u0 = A.undoStack.length, c0 = objCount(); const r = run(n); ok(`${n} (inferred): does nothing`, r.v === undefined && !r.err && A.undoStack.length === u0 && objCount() === c0); }
    let r = run('BoneCreateTool');
    ok('BoneCreateTool (inferred): live tool instance (CMD-B13e state) and the chain drawing tool active', A.pluginsB13e?.boneTool && A.activeTool?.name === 'Draw 2D Chain', A.activeTool?.name);
    A.setTool(null);
    let c0 = objCount(); r = run('CrowdCreateDirectionalEmitterTool');
    const viaEmitter = trace('CreateCrowdEmitter', () => run('CrowdCreateDirectionalEmitterTool'));
    ok('CrowdCreateDirectionalEmitterTool (inferred): runs CreateCrowdEmitter', viaEmitter.length === 1 && !r.err, r.err);
    const viaWall = trace('CreateWall', () => run('CrowdCreateWallTool'));
    ok('CrowdCreateWallTool (inferred): runs CreateWall', viaWall.length === 1);
    reset(); { const r = run('MoveComponent Tool'); ok('MoveComponent Tool (CMD-B16a): activates class da55a810 (Tweak body as a logged stand-in)', A.toolManager.current() === 'da55a810-5f86-11d2-b11c-00a0c906811e' && nya(r), [A.toolManager.current(), r.log]); }
    A.selMode = 'object'; reset();
    r = run('Pick Session Tool'); ok('Pick Session Tool (inferred): outside a pick session -> logged, no change', nya(r));
    run('Turn OFF Interactive SRT'); const off = A.inferredB15.interactiveSRT; run('Turn ON Interactive SRT');
    ok('Turn OFF / ON Interactive SRT (inferred): flag false then true', off === false && A.inferredB15.interactiveSRT === true);
    // CopyPaste
    reset(); const clip = A.clipboard; const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'tgtB15f' }); reset();
    const u0 = A.undoStack.length;
    r = run('CopyPaste', { Source: cube, Target: nul });
    ok('CopyPaste (inferred): Source duplicated under Target, clipboard untouched', Array.isArray(r.v) && r.v.length === 1 && r.v[0] !== cube && r.v[0].parentObj === nul && A.clipboard === clip, r.err);
    // Delete Selected Branch
    A.select([nul]); r = run('Delete Selected Branch');
    ok('Delete Selected Branch (inferred): the selected object and its branch are removed', !A.scene.find('tgtB15f') && !!r && !r.err);
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(nul);
    // DeleteCurrentLayer
    const lay = A.run('CreateLayer', { Name: 'layB15f' }); A.run('SetCurrentLayer', { Name: lay.name });
    r = run('DeleteCurrentLayer');
    ok('DeleteCurrentLayer (inferred): DeleteLayer of the current layer', !A.scene.layers.includes(lay), r.err);
    // Freeze Selected / Dice / Mesh Filter
    reset(); let fz = trace('FreezeObj', () => run('Freeze Selected'));
    ok('Freeze Selected (inferred): FreezeObj on the selection', fz.length === 1 && fz[0].InputObjs?.[0] === cube);
    let topo = trace('ApplyTopoOp', () => run('Dice Object/Polygons'));
    ok('Dice Object/Polygons (inferred): ApplyTopoOp "Dice Polygons"', topo.length === 1 && topo[0].PresetObj === 'Dice Polygons');
    topo = trace('ApplyTopoOp', () => run('Mesh Filter'));
    ok('Mesh Filter (inferred): ApplyTopoOp "Filter Polygons" (no edge selection)', topo.length === 1 && topo[0].PresetObj === 'Filter Polygons');
    A.compSel = { obj: cube, kind: 'edge', points: new Set(), edges: new Set(['0-1']), polygons: new Set() };
    topo = trace('ApplyTopoOp', () => run('Mesh Filter'));
    ok('Mesh Filter (inferred): edge selection -> "Filter Edges"', topo[0]?.PresetObj === 'Filter Edges');
    reset();
    // PaintWeights
    const PropCls = cube.property('visibility').constructor; const map = new PropCls('WeightMapB15f', 'weightmap', []); map.values = new Map(); cube.addProperty(map); reset();
    const u1 = A.undoStack.length;
    r = run('PaintWeights', { InputObj: map, Indices: [0, 1], Weights: [0.25, 0.5] });
    ok('PaintWeights (inferred): weights written at the indices of the weight map; returns it', map?.values?.get(0) === 0.25 && map.values.get(1) === 0.5 && r.v === map, [r.err, map?.type]);
    while (A.undoStack.length > u1) A.undo();
    ok('PaintWeights (inferred): undo restores', !map.values.has(0));
    r = run('PaintWeights', { InputObj: cube, Indices: [2], Weights: [0.75] });
    ok('PaintWeights (inferred): an object -> its first weight map', map.values.get(2) === 0.75, r.err);
    cube.removeProperty(map);
    // RegenerateMaps
    reset(); r = run('RegenerateMaps');
    ok('RegenerateMaps (inferred): no Render Map selected -> error', (r.kinds ?? []).includes('error'));
    const rmp = new (cube.property('visibility').constructor)('RenderMap', 'rendermap', []); cube.addProperty(rmp);
    r = run('RegenerateMaps', { Properties: [rmp] });
    ok('RegenerateMaps (inferred): a Render Map -> rendering logged as not yet attested (no renderer)', nya(r), [r.err, rmp?.type]);
    cube.removeProperty(rmp);
    // CreateEnvironmentCache
    const env = A.run('CreateEnvironment', {}); const envNode = Array.isArray(env) ? env[0] : env;
    r = run('CreateEnvironmentCache', { Model: cube, Environment: envNode });
    ok('CreateEnvironmentCache (inferred): a cache record for the model in the environment', r.v?.model === cube && envNode.simulationEnvironment?.caches?.includes(r.v), r.err);
    // CopyPartition
    const pass2 = A.run('CreatePass', { Name: 'passB15f' }); const cur = A.scene.passes[0];
    r = run('CopyPartition', { Target: [pass2], InputObjs: cur.partitions });
    ok('CopyPartition (inferred): the partitions are copied (same names, same members) into the target pass', cur.partitions.every(q => pass2.partitions.some(z => z.name === q.name && z !== q && [...q.members].every(m => z.members.has(m)))), [r.err, pass2.partitions.map(z => z.name)]);
  } catch (e) { ok('inferred block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  const fresh = () => { A.setTool?.(null); A.select([]); };
  const mk = (prim, name) => { const o = A.run('CreatePrim', { PresetObj: prim, Name: name }); return Array.isArray(o) ? o[0] : o; };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  // ================= CMD-B15-ELSE shells
  try {
    reset();
    let r = run('MarkObjectDirty', { Object: 'cube' });
    ok('MarkObjectDirty (inferred): logged not yet attested, no change', nya(r) && !r.err && r.v === undefined);
    r = run('GetSkeleton', { InputObj: 'cube' });
    ok('GetSkeleton (inferred): not a chain element -> empty collection, Index -1', Array.isArray(r.v) && r.v.length === 0 && A.shellsB15Else.lastGetSkeleton.Index === -1);
    const chainRoot = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0], [3, 1, 0]] });
    const bone = chainRoot?.bones?.[0]; // index 1: root is 0
    r = run('GetSkeleton', { InputObj: [bone] });
    ok('GetSkeleton (inferred): root, bones, effector; Index of the input', Array.isArray(r.v) && r.v[0] === chainRoot && r.v[r.v.length - 1] === chainRoot.effector && A.shellsB15Else.lastGetSkeleton.Index === 1, [r.err, r.v?.map?.(x => x.name)]);
  } catch (e) { ok('shells block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= literalised table names still registered
  for (const n of LITERAL) ok(`${n}: still registered (table key now a literal name)`, !!A.commands.get(n));
  return out;
}, { NAMES, LITERAL, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_inferred_b15_commands: ${pass}/${pass + fail} ok (${INFERRED.length} inferred tool / misc + ${SHELLS.length} shells + ${LITERAL.length} literalised names)`);
await browser.close();
process.exit(fail ? 1 : 0);
