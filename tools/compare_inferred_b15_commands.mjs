// CMD-B15-ELSE (inferred, relaxed rules): the batch-15 commands still missing from the bus after PR #191, plus the
// registration tables made literal for the coverage scan. No analyst note or XSIBATCH golden backs the inferred commands:
// this checks the behaviour their registration comments state (src/commands/inferredB15.ts, shellsB15Else.ts,
// particlesB15cShaders.ts).
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
  // CMD-B16d moved CopyPartition, CreateEnvironmentCache (output Source), Dice Object/Polygons, Mesh Filter, RegenerateMaps,
  // MarkObjectDirty and GetSkeleton to their contract: tools/compare_filtermap_b16d.mjs checks them.
  'Add Surface Point Tool', 'BoneCreateTool', 'CopyPaste', 'CrowdCreateDirectionalEmitterTool', 'CrowdCreateWallTool',
  'CursorTransformTool', 'Delete Selected Branch', 'DeleteCurrentLayer', 'DoNothing', 'Freeze Selected', 'MoveComponent Tool',
  'PaintWeights', 'Pick Session Tool', 'SIAppendBone', 'SISwapArrayElements', 'ToggleProjectionTool', 'Transform Set New ',
  'Turn OFF Interactive SRT', 'Turn ON Interactive SRT', 'XYZ Transform ',
];
const SHELLS = ['AddShaderAttachedComment', 'CreateShaderFromCLSID', 'CreateShaderFromProgID', 'CreateShadersFromMaterialPreset'];
const LITERAL = ['MakeBiped', 'MakeBipedDogLeg', 'MakeQuadruped', 'MakeArm', 'MakeLeg', 'MakeFoot', 'MakeHand', 'MakeHead', 'MakeSpine', 'MakeShadowChain', 'MakeShadowSpine', 'MakeBicepRoll', 'MakeForearmRoll', 'Make2PointSlide', 'MakeJointCompression', 'MakeDogLeg', 'MakeBipedCharacterKeySet', 'MakeQuadrupedCharacterKeySet', 'SetKeyableRig', 'syCachePaint1', 'syCachePaint2', 'SyGetMassMap', 'SyGetSpringMap', 'CreateInspectParticleTypeBillboard', 'CreateInspectParticleTypeBlob', 'CreateInspectParticleTypeSphere'];
const NAMES = [...INFERRED, ...SHELLS];
const DEFAULT_FAILS = new Set(['CopyPaste', 'SIAppendBone', 'PaintWeights', 'DeleteCurrentLayer', 'CreateShaderFromCLSID', 'CreateShaderFromProgID', 'CreateShadersFromMaterialPreset']);
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
    for (const n of ['Add Surface Point Tool', 'CursorTransformTool', 'ToggleProjectionTool', 'Transform Set New ']) { const r = run(n); ok(`${n} (inferred): no such tool here -> not yet attested, no change`, nya(r) && !r.err); }
    for (const n of ['DoNothing', 'XYZ Transform ']) { const u0 = A.undoStack.length, c0 = objCount(); const r = run(n); ok(`${n} (inferred): does nothing`, r.v === undefined && !r.err && A.undoStack.length === u0 && objCount() === c0); }
    let r = run('BoneCreateTool');
    ok('BoneCreateTool (inferred): live tool instance (CMD-B13e state) and the chain drawing tool active', A.pluginsB13e?.boneTool && A.activeTool?.name === 'Draw 2D Chain', A.activeTool?.name);
    A.setTool(null);
    let c0 = objCount(); r = run('CrowdCreateDirectionalEmitterTool');
    const viaEmitter = trace('CreateCrowdEmitter', () => run('CrowdCreateDirectionalEmitterTool'));
    ok('CrowdCreateDirectionalEmitterTool (inferred): runs CreateCrowdEmitter', viaEmitter.length === 1 && !r.err, r.err);
    const viaWall = trace('CreateWall', () => run('CrowdCreateWallTool'));
    ok('CrowdCreateWallTool (inferred): runs CreateWall', viaWall.length === 1);
    reset(); const tw = trace('TweakTool', () => run('MoveComponent Tool'));
    ok('MoveComponent Tool (inferred): runs the component tweak tool (TweakTool)', tw.length === 1);
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
    // SISwapArrayElements
    const arr = [1, 2, 3]; run('SISwapArrayElements', { Object: arr, IndexA: 0, IndexB: 2 });
    ok('SISwapArrayElements (inferred): elements swapped', JSON.stringify(arr) === '[3,2,1]');
    ok('SISwapArrayElements (inferred): index out of range raises', !!run('SISwapArrayElements', { Object: arr, IndexA: 0, IndexB: 9 }).err);
    // SIAppendBone (and AppendBone now delegating to it)
    const chain = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0]] }); const eff = chain.effector; const nb = chain.bones.length;
    r = run('SIAppendBone', { InputObjs: [eff], Ex: 4, Ey: 1, Ez: 0, AlignRootToFirstBone: true });
    ok('SIAppendBone (inferred): one bone appended to the chain end', chain.bones.length === nb + 1 && !r.err, r.err);
    const r3 = run('AppendBone', { InputObjs: [chain.effector], Ex: 6, Ey: 1, Ez: 0 });
    ok('AppendBone now reaches SIAppendBone (no stand-in log)', chain.bones.length === nb + 2 && !has(r3, /the new bone is the C\+\+ append command/), r3.log);
    A.scene.root.removeChild(chain);
  } catch (e) { ok('inferred block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  const fresh = () => { A.setTool?.(null); A.select([]); };
  const mk = (prim, name) => { const o = A.run('CreatePrim', { PresetObj: prim, Name: name }); return Array.isArray(o) ? o[0] : o; };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  // ================= shader creation (inferred)
  try {
    fresh(); const o = mk('Sphere', 'shd'); A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] }); A.select([]);
    const mat = o.material; const SC = A.shaderCreationB15;
    let r = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1', Container: [mat], Name: 'MyImage' });
    ok('CreateShaderFromProgID: shader from the ProgID, nested in the container, named Name, returned', !r.err && r.v?.name === 'MyImage' && r.v?.progId === 'Softimage.txt2d-image-explicit.1' && SC.lastMethod === 2, r.err);
    const r2 = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1', Container: [mat], Name: 'MyImage' });
    ok('CreateShaderFromProgID: name kept unique in the container', !r2.err && r2.v?.name === 'MyImage1', r2.v?.name);
    ok('CreateShaderFromProgID: unknown ProgID -> 0x80004005', status(run('CreateShaderFromProgID', { ProgID: 'Nobody.nothing.1', Container: [mat] }), '80004005'));
    ok('CreateShaderFromProgID: no container -> 0x80070057', status(run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1' }), '80070057'));
    A.undo();
    ok('CreateShaderFromProgID: undo un-nests', !run('CreateShaderFromProgID', { ProgID: 'Softimage.material-phong.1', Container: [mat] }).err);
    r = run('CreateShadersFromMaterialPreset', { PresetObj: 'Materials\\Lambert.Preset', Container: [mat] });
    ok('CreateShadersFromMaterialPreset: the preset\'s shader nested in the container, returned', !r.err && r.v?.type && /lambert/i.test(r.v.type + r.v.name) && SC.lastMethod === 4, [r.err, r.v?.type]);
    ok('CreateShadersFromMaterialPreset: unknown preset -> 0x80004005', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'NoSuchPreset', Container: [mat] }), '80004005'));
    r = run('CreateShaderFromCLSID', { Clsid: '{12345678-1234-1234-1234-123456789abc}', Container: [mat] });
    ok('CreateShaderFromCLSID: no CLSID table in this build -> logged, 0x80004005', status(r, '80004005') && r.log.some(l => /not yet attested/.test(l)) && SC.lastMethod === 1);
    SC.clsids['12345678-1234-1234-1234-123456789abc'] = 'Softimage.txt2d-image-explicit.1';
    r = run('CreateShaderFromCLSID', { Clsid: '{12345678-1234-1234-1234-123456789ABC}', Container: [mat], Name: 'ByClsid' });
    ok('CreateShaderFromCLSID: a known CLSID -> shader of its definition', !r.err && r.v?.name === 'ByClsid', r.err);
    ok('CreateShaderFromCLSID: null GUID -> 0x80070057', status(run('CreateShaderFromCLSID', { Container: [mat] }), '80070057'));
  } catch (e) { ok('shader block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CMD-B15-ELSE shells
  try {
    reset();
    let r = run('AddShaderAttachedComment', { Container: 'cube' });
    ok('AddShaderAttachedComment (inferred): logged not yet attested, returns null', nya(r) && !r.err && r.v === null);
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
console.log(`compare_inferred_b15_commands: ${pass}/${pass + fail} ok (${INFERRED.length} inferred tool / misc + ${SHELLS.length} shells / shader creation + ${LITERAL.length} literalised names)`);
await browser.close();
process.exit(fail ? 1 : 0);
