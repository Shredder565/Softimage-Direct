// CMD-B17b: the 10 chains.vbs and 9 Model.vbs script commands. No XSIBATCH golden exists: this is a contract check
// against §2 / §3 "Wire contract" of docs/ghidra/cmd-b17b-chains-model-scripts.md and the cmd-b17b section of
// docs/re/WIRE_CORRECTIONS_B17.md:
//   1. every command is registered with the catalogue argument list (data/commands_full.json); the trailing extra
//      arguments that are not in the registry are listed in EXTRA (this build's internal inputs);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without throwing;
//   3. the contract's stated results (sub-command calls and their arguments, messages, parameter values, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_chains_model_b17b.mjs
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

const NAMES = ['AddBoneToEnd', 'BreakChainAtBone', 'Create2DSkeleton', 'Create3DSkeleton', 'CreateChainfromCurve', 'InspectChainProperties',
  'KeyAllBoneRotations', 'SetBoneMaxRotLimit', 'SetBoneMinRotLimit', 'SetBoneRotationToPrefRotation',
  'AddDelta', 'CommitToReference', 'DeleteModelFromObj', 'DuplicateModelFromObj', 'ImportModel', 'ImportRefModels',
  'MakeLocalMaterialsForHierarchy', 'SetResolutionOfRefModels', 'UpdateReferencedModel'];
/** Registry entry used when a name has several (label of the entry). */
const ENTRY = { SetResolutionOfRefModels: 'Set Resolution Of All RefModels', CreateChainfromCurve: 'GetInputAndCreateChainFromCurveProc' };
/** Trailing arguments that are not in the registry (this build's internal inputs, see src/commands/chainsModelB17b.ts). */
const EXTRA = { Create2DSkeleton: ['SkeletonType', 'Points'], Create3DSkeleton: ['SkeletonType', 'Points'], ImportModel: ['Data', 'Bytes'] };
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const all = full.filter(x => x.scripting_name === n);
  const f = ENTRY[n] ? all.find(x => x.name === ENTRY[n] || x.handler === ENTRY[n]) : all[0];
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('dialog', d => d.dismiss().catch(() => {}));
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('AddBoneToEnd') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, EXTRA }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.constructor?.name !== 'Object' && !Array.isArray(v) ? (v.name ?? String(v)) : v)).slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.setSelMode?.('object'); A.compSel = null; A.select([cube]); };
  const undoTo = u => { while (A.undoStack.length > u) A.undo(); };
  const trace = (names, f) => {
    const saved = names.map(n => [n, A.commands.get(n), A.commands.get(n).execute]); const calls = [];
    for (const [n, d, orig] of saved) d.execute = (app, a) => { const rec = { n, a: { ...a } }; calls.push(rec); const r = orig.call(d, app, a); rec.r = r; return r; };
    try { f(); } finally { for (const [, d, orig] of saved) d.execute = orig; }
    return calls;
  };
  const S = () => A.chainsModelB17b;
  const gpos = o => { const m = o.globalMatrix().elements; return [m[12], m[13], m[14]]; };
  const objs = () => [...A.scene.allObjects()];

  // 1. registration
  for (const n of NAMES) {
    const d = A.commands.get(n); if (!d) { out.reg[n] = null; continue; }
    const extra = EXTRA[n] ?? []; const list = d.args.map(a => [a.name, a.default ?? null]);
    const tail = list.slice(list.length - extra.length).map(x => x[0]);
    out.reg[n] = extra.length && JSON.stringify(tail) === JSON.stringify(extra) ? list.slice(0, list.length - extra.length) : list;
  }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n); undoTo(u0);
    out.defaults[n] = r.err ? 'ERROR: ' + r.err : 'ok';
  }
  reset();

  // ================= chains
  try {
    // Create2DSkeleton / Create3DSkeleton
    let u0 = A.undoStack.length;
    let calls = trace(['SICreateSkeleton', 'DeselectAll', 'SelectObj', 'AddToSelection'], () => { out.r2 = run('Create2DSkeleton'); });
    let root = out.r2.v;
    ok('Create2DSkeleton defaults: DeselectAll, then SICreateSkeleton(0,0,0, 1,0,0, 0,0,1, ViewType 3, SkeletonType 2)', calls[0]?.n === 'DeselectAll' && calls.some(c => c.n === 'SICreateSkeleton' && c.a.Ex === 1 && c.a.Nz === 1 && c.a.ViewType === 3 && c.a.SkeletonType === 2), calls.map(c => c.n));
    ok('Create2DSkeleton: returns the root; effector at (1,0,0); a 2D chain', root?.type === 'root' && root.bones.length === 1 && near(gpos(root.effector)[0], 1) && near(gpos(root.effector)[1], 0) && root.chainKind === 2, root?.name);
    ok('Create2DSkeleton: selection = root, bone, effector', A.selection.length === 3 && A.selection[0] === root && A.selection[1] === root.bones[0] && A.selection[2] === root.effector, A.selection.map(n => n.name));
    undoTo(u0); ok('Create2DSkeleton undo: chain removed', !objs().includes(root));
    calls = trace(['SICreateSkeleton'], () => { out.r3 = run('Create3DSkeleton', { Rx: 1, Ry: 2, Rz: 0, Ex: 1, Ey: 5, Ez: 0 }); });
    root = out.r3.v;
    ok('Create3DSkeleton: SkeletonType 3, ViewType 0; root at R, effector at E', calls[0]?.a.SkeletonType === 3 && calls[0]?.a.ViewType === 0 && root?.chainKind === 3 && near(gpos(root)[1], 2) && near(gpos(root.effector)[1], 5), calls[0]?.a);
    undoTo(u0);
    let r = run('Create2DSkeleton', { SkeletonType: 5 });
    ok('Create2DSkeleton SkeletonType 5: "CreateSkeleton: invalid skeleton type", nothing returned', !r.err && r.v === undefined && has(r, /CreateSkeleton: invalid skeleton type/), r);
    r = run('Create2DSkeleton', { Ex: 0 });
    ok('Create2DSkeleton: no root -> "Create2DSkeleton: error while creating skeleton"', !r.err && r.v === undefined && has(r, /Create2DSkeleton: error while creating skeleton/), r.log);
    undoTo(u0);

    // a 3-bone chain for the bone commands
    const ch = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]] }); const [b1, b2, b3] = ch.bones; const eff = ch.effector;
    const uC = A.undoStack.length;
    b2.kinematics.local.set('rotx', 10); b2.kinematics.local.set('roty', -20); b2.kinematics.local.set('rotz', 30);
    // SetBoneMinRotLimit / Max
    A.select([]); r = run('SetBoneMinRotLimit');
    ok('SetBoneMinRotLimit empty: "Please select a bone first", nothing else', !r.err && has(r, /^Please select a bone first$/) && !b2.properties.some(p => p.type === 'joint'), r.log);
    r = run('SetBoneMinRotLimit', { InputObjs: [b2, cube] });
    const j = b2.properties.find(p => p.type === 'joint');
    ok('SetBoneMinRotLimit: joint.rotlim_active True, rotMinX/Y/Z = kine.local.rotx/y/z', !r.err && j?.val('rotlim_active') === true && near(j.val('rotMinX'), 10) && near(j.val('rotMinY'), -20) && near(j.val('rotMinZ'), 30), r.err ?? j?.params?.map(p => [p.name, p.value]));
    ok('SetBoneMinRotLimit: non-bone items are skipped silently', !cube.properties.some(p => p.type === 'joint') && !r.log.some(l => /cube/.test(l)), r.log);
    const keys = [...S().camvis.keys()];
    ok('SetBoneMinRotLimit: attrselchnjntareaguide / attrunselchnjntareaguide True for views A-D x User/Top/Front/Right', keys.length === 32 && [...S().camvis.values()].every(v => v === true) && S().camvis.has('Views.ViewC.FrontCamera.camvis.attrunselchnjntareaguide'), keys.length);
    r = run('SetBoneMaxRotLimit', { InputObjs: [b2] });
    ok('SetBoneMaxRotLimit (DoMin False): rotMaxX/Y/Z written, Min kept', !r.err && near(j.val('rotMaxX'), 10) && near(j.val('rotMaxZ'), 30) && near(j.val('rotMinY'), -20), r.err);
    r = run('SetBoneMaxRotLimit', { InputObjs: [b3], DoMin: true });
    ok('SetBoneMaxRotLimit with DoMin True writes the Min limits (one procedure)', b3.properties.find(p => p.type === 'joint')?.get('rotMinX') && b3.properties.find(p => p.type === 'joint').val('rotlim_active') === true, r);
    // SetBoneRotationToPrefRotation
    b1.set('prefrotx', 5); b1.set('prefroty', 15); b1.set('prefrotz', 25);
    calls = trace(['Rotate'], () => { r = run('SetBoneRotationToPrefRotation', { InputObjs: [b1, eff] }); });
    ok('SetBoneRotationToPrefRotation: Rotate <bone>, prefrot x/y/z, siAbsolute, siLocal, siObj, siXYZ (bones only)', calls.length === 1 && calls[0].a.X === 5 && calls[0].a.Mode === 'siAbsolute' && calls[0].a.RefFrame === 'siLocal' && near(b1.kinematics.local.val('roty'), 15) && near(b1.kinematics.local.val('rotz'), 25), calls.map(c => c.a));
    ok('SetBoneRotationToPrefRotation: registry display name "Set Bone Max Rot Limit"', A.commands.get('SetBoneRotationToPrefRotation').label === 'Set Bone Max Rot Limit');
    A.select([]); r = run('SetBoneRotationToPrefRotation'); ok('SetBoneRotationToPrefRotation empty: message', has(r, /^Please select a bone first$/), r.log);
    // BreakChainAtBone
    A.select([cube]); r = run('BreakChainAtBone'); ok('BreakChainAtBone no chain element: "Please select a bone first"', has(r, /^Please select a bone first$/), r.log);
    r = run('BreakChainAtBone', { InputObjs: [b2, eff, ch] });
    const jE = eff.properties.find(p => p.type === 'joint');
    ok('BreakChainAtBone: pseudoroot_active True, chntype 1, kine.local.cnspos False (bone and effector, not the root)', !r.err && j.val('pseudoroot_active') === true && j.val('chntype') === 1 && b2.kinematics.local.val('cnspos') === false && jE?.val('pseudoroot_active') === true && !ch.properties.some(p => p.type === 'joint'), r.err);
    run('BreakChainAtBone', { InputObjs: [b2] });
    ok('BreakChainAtBone again: toggled back (False, chntype 0, cnspos True)', j.val('pseudoroot_active') === false && j.val('chntype') === 0 && b2.kinematics.local.val('cnspos') === true);
    // KeyAllBoneRotations
    calls = trace(['SaveKey'], () => { r = run('KeyAllBoneRotations', { InputObjs: [b2] }); });
    ok('KeyAllBoneRotations: one SaveKey per bone (skeleton items 1..count-2) on rotx, roty, rotz', !r.err && calls.length === 3 && calls.every((c, i) => String(c.a.InputObjs).split(',').length === 3 && String(c.a.InputObjs).includes(ch.bones[i].name + '.') && /rotz$/.test(String(c.a.InputObjs))), calls.map(c => c.a.InputObjs));
    ok('KeyAllBoneRotations: keys exist on the bone rotations', A.anim.isAnimated(b3.kinematics.local.get('roty')));
    A.select([cube]); calls = trace(['SaveKey'], () => { r = run('KeyAllBoneRotations'); }); ok('KeyAllBoneRotations no chain element: nothing', !r.err && calls.length === 0);
    // InspectChainProperties
    calls = trace(['InspectObj'], () => { r = run('InspectChainProperties', { InputObjs: [b2, eff] }); });
    ok('InspectChainProperties: InspectObj on the unique chain collection of the first bones', !r.err && calls.length === 1 && calls[0].a.InputObjs.length === 1 && S().inspected.at(-1)?.length === 1, calls.map(c => c.a));
    // AddBoneToEnd
    A.select([cube]); r = run('AddBoneToEnd'); ok('AddBoneToEnd no chain element: "Please select a chain element first"', has(r, /^Please select a chain element first$/), r.log);
    const B = (A.tasksB11a ??= {}); const hooks = (B.hooks ??= {}); const picks = [[8, 0, 0], [8, 3, 0]]; let pi = 0;
    hooks.pickPosition = () => (pi < picks.length ? { pos: picks[pi++], button: 1 } : null);
    const nb0 = ch.bones.length;
    calls = trace(['AppendBone', 'PickPosition', 'GetSkeleton'], () => { r = run('AddBoneToEnd', { InputObjs: [b1, b3] }); });
    delete hooks.pickPosition;
    const app = calls.filter(c => c.n === 'AppendBone');
    ok('AddBoneToEnd: GetSkeleton of the first element; PickPosition "Append Bone" loop, one AppendBone <effector>, x, y, z per pick until button 0', !r.err && calls[0]?.n === 'GetSkeleton' && calls[0].a.InputObj === b1 && app.length === 2 && app[1].a.Ex === 8 && app[1].a.Ey === 3 && app.every(c => c.a.InputObjs[0] === eff && c.a.Pin === true) && calls.filter(c => c.n === 'PickPosition').length === 3 && calls.find(c => c.n === 'PickPosition').a.LeftMessage === 'Append Bone', calls.map(c => c.n));
    ok('AddBoneToEnd: two bones appended, effector at the last pick', ch.bones.length === nb0 + 2 && near(gpos(eff)[0], 8) && near(gpos(eff)[1], 3), [ch.bones.length, gpos(eff)]);
    undoTo(uC);

    // CreateChainfromCurve
    const crv = A.run('SICreateCurve', { Name: 'b17bCrv', Degree: 1 }); A.run('SISetCurvePoints', { InputObj: crv, Points: '(0,0,0),(0,2,0),(0,4,0)', Local: true });
    const uK = A.undoStack.length;
    A.select([cube]); r = run('CreateChainfromCurve');
    ok('CreateChainfromCurve (UI) no curve: warning "Please select at least one Curve..."', !r.err && has(r, /Please select at least one Curve\.\.\./), r.log);
    calls = trace(['EvaluateCurveAt', 'Create3DSkeleton', 'AppendBone'], () => { r = run('CreateChainfromCurve', { InputObjs: [crv, cube], NbJoints: 4, UseCns: false }); });
    const roots = r.v; const pr = roots?.[0];
    const c3 = calls.find(c => c.n === 'Create3DSkeleton'), ap = calls.filter(c => c.n === 'AppendBone');
    ok('CreateChainfromCurve plain: samples at 0, 1/N .. 1 (EvaluateCurveAt Local True), Create3DSkeleton root -> sample 1 with normal (1,0,0)', calls.filter(c => c.n === 'EvaluateCurveAt').map(c => c.a.Value).join() === '0,0.25,0.5,0.75,1' && calls.every(c => c.n !== 'EvaluateCurveAt' || c.a.Local === true) && c3 && near(c3.a.Ey, 1) && c3.a.Nx === 1 && c3.a.Ny === 0 && c3.a.Nz === 0, calls.map(c => [c.n, c.a.Value ?? c.a.Ey]));
    ok('CreateChainfromCurve plain: AppendBone , x, y, z, False for samples 2..N (current selection)', ap.length === 3 && ap.every(c => c.a.InputObjs === '' && c.a.Pin === false) && near(ap[2].a.Ey, 4), ap.map(c => c.a));
    ok('CreateChainfromCurve plain: one root per curve returned, N bones, effector at the curve end', Array.isArray(roots) && roots.length === 1 && pr.bones.length === 4 && near(gpos(pr.effector)[1], 4) && near(gpos(pr)[1], 0), roots?.map?.(x => x.name));
    undoTo(uK);
    calls = trace(['GetCurveLength', 'SICreateCurve', 'SISetCurvePoints', 'ApplyOp', 'Create3DSkeleton', 'AppendBone', 'SIApplyCns'], () => { r = run('CreateChainfromCurve', { InputObjs: [crv], NbJoints: 2, UseCns: true }); });
    const sup = A.scene.find('b17bCrv_crv'); const cns = calls.filter(c => c.n === 'SIApplyCns');
    ok('CreateChainfromCurve spline IK: support curve <curve>_crv, degree 1, N+1 points along +Y at L/N steps', !r.err && sup && calls.find(c => c.n === 'SICreateCurve')?.a.Degree === 1 && (() => { const p = String(calls.find(c => c.n === 'SISetCurvePoints')?.a.Points ?? '').match(/\(([^)]*)\)/g) ?? []; return p.length === 3 && p.every((t, i) => { const [x, y, z] = t.slice(1, -1).split(',').map(Number); return x === 0 && z === 0 && near(y, 2 * i); }); })() && sup.parentObj === crv.parentObj, [r.err, calls.map(c => c.n)]);
    ok('CreateChainfromCurve spline IK: ApplyOperator CrvDeform "<support>;<curve>"', calls.some(c => c.n === 'ApplyOp' && c.a.PresetObj === 'CrvDeform' && String(c.a.ConnectionSet).includes('b17bCrv_crv;')), calls.filter(c => c.n === 'ApplyOp').map(c => c.a));
    const c3b = calls.find(c => c.n === 'Create3DSkeleton');
    ok('CreateChainfromCurve spline IK: Create3DSkeleton 0,0,0, 0,step,0, 1,0,0', c3b && near(c3b.a.Ey, 2) && c3b.a.Nx === 1 && c3b.a.Ex === 0, c3b?.a);
    const percs = cns.map(c => c.r).map(x => (Array.isArray(x) ? x[0] : x)?.val?.('perc'));
    ok('CreateChainfromCurve spline IK: SIApplyCns "Path" on root, bones, effector with perc = i*step*100/L (the effector\'s 150 is held to 100 by this build\'s Path % range)', cns.length === 4 && cns.every(c => c.a.PresetObj === 'Path' && c.a.ConstrainingObj[0] === sup) && percs.map(p => Math.round(p)).join() === '0,50,100,100', [cns.length, percs]);
    undoTo(uK);
    // UI entry: the wizard
    S().hooks.inspect = (prop, title) => { out.wiz = { title, names: prop.params.map(p => p.name), nb: prop.val('nbJoints'), parent: prop.parent === A.scene.root }; prop.set('nbJoints', 3); return true; };
    calls = trace(['DeleteObj'], () => { r = run('CreateChainfromCurve', { InputObjs: [crv] }); });
    ok('CreateChainfromCurve UI: "Chain from Curve Wizard" property on the scene root with nbJoints / useCns; OK runs the scripted procedure', out.wiz?.title === 'Chain from Curve Wizard' && out.wiz.parent && out.wiz.names.join() === 'nbJoints,useCns' && r.v?.[0]?.bones?.length === 3, [out.wiz, r.err]);
    ok('CreateChainfromCurve UI: DeleteObj <prop> afterwards', calls.some(c => c.n === 'DeleteObj') && !A.scene.root.properties.some(p => p.name === 'Chain from Curve Wizard'));
    const nObjs = objs().length;
    S().hooks.inspect = () => false; r = run('CreateChainfromCurve', { InputObjs: [crv] });
    ok('CreateChainfromCurve UI Cancel: nothing created, property deleted', !r.err && objs().length === nObjs && !A.scene.root.properties.some(p => p.name === 'Chain from Curve Wizard'), r.err);
    delete S().hooks.inspect;
    undoTo(uK);
  } catch (e) { ok('chains block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= Model.vbs
  try {
    const u0 = A.undoStack.length;
    // ImportModel
    let r; let calls = trace(['CreateRefModel', 'ReconnectModel', 'SelectObj', 'SIImportModel'], () => { r = run('ImportModel', { FileName: 'b17b_nofile.emdl', Reference: true, Name: 'b17bRef', ExternalCnxMappingTemplate: 'tpl', ShareOptions: 7 }); });
    const cr = calls.find(c => c.n === 'CreateRefModel'), rc = calls.find(c => c.n === 'ReconnectModel');
    ok('ImportModel Reference: CreateRefModel FileName, Name, "", Parent, True, False, Template, ShareOptions', cr && cr.a.FileName === 'b17b_nofile.emdl' && cr.a.ModelName === 'b17bRef' && cr.a.ResolutionName === '' && cr.a.Activate === true && cr.a.CreateFile === false && cr.a.ExternalCnxMappingTemplate === 'tpl' && cr.a.ShareOptions === 7 && !calls.some(c => c.n === 'SIImportModel'), cr?.a);
    const m1 = r.v;
    ok('ImportModel Reference: ReconnectModel <model>, Template, False; model selected and returned', rc && rc.a.Model === m1 && rc.a.ExternalCnxMappingTemplate === 'tpl' && rc.a.DeleteUnconnectedObjects === false && A.selection[0] === m1 && m1?.kind === 'model', [rc?.a, r.err]);
    calls = trace(['SIImportModel', 'ReconnectModel'], () => { r = run('ImportModel', { FileName: 'b17b_missing.emdl', Reference: false }); });
    const si = calls.find(c => c.n === 'SIImportModel');
    ok('ImportModel: SIImportModel FileName, Parent, <out>, Name, ShareOptions 13 (its own failure surfaces)', si && si.a.FileName === 'b17b_missing.emdl' && si.a.ShareOptions === 13 && !calls.some(c => c.n === 'ReconnectModel'), si?.a);
    // ImportRefModels
    calls = trace(['CreateRefModel', 'ReconnectModel'], () => { r = run('ImportRefModels', { FileName: 'b17bA.emdl, b17bB.emdl', ExternalCnxMappingTemplate: 'T' }); });
    const crs = calls.filter(c => c.n === 'CreateRefModel'), rcs = calls.filter(c => c.n === 'ReconnectModel');
    const ms = r.v;
    ok('ImportRefModels: CreateRefModel per comma item (no trimming), Activate True, CreateFile False, Template', crs.length === 2 && crs[1].a.FileName === ' b17bB.emdl' && crs.every(c => c.a.Activate === true && c.a.CreateFile === false && c.a.ExternalCnxMappingTemplate === 'T'), crs.map(c => c.a.FileName));
    ok('ImportRefModels: ReconnectModel <model>, "<model1>,<model2>,<Template>", False for every new model; returns the models', Array.isArray(ms) && ms.length === 2 && rcs.length === 2 && rcs.every(c => c.a.ExternalCnxMappingTemplate === `${ms[0].fullName},${ms[1].fullName},T` && c.a.DeleteUnconnectedObjects === false), [rcs.map(c => c.a.ExternalCnxMappingTemplate), r.err]);
    // SetResolutionOfRefModels
    calls = trace(['FindObjects', 'SISetResolutionOfRefModels', 'GetCurrentAnimationLayer', 'GetNumberOfAnimationLayers'], () => { r = run('SetResolutionOfRefModels', { resolution: 2 }); });
    const ss = calls.find(c => c.n === 'SISetResolutionOfRefModels'); const refs = objs().filter(o => o.kind === 'model' && o.ref);
    ok('SetResolutionOfRefModels empty input: FindObjects model class, referenced models only -> SISetResolutionOfRefModels <models>, resolution', calls[0]?.n === 'FindObjects' && /0496EAB0/i.test(calls[0].a.Type) && ss && ss.a.Resolution === 2 && ss.a.Target.length === refs.length && ss.a.Target.every(m => m.ref), [ss?.a?.Target?.length, refs.length]);
    ok('SetResolutionOfRefModels: the animation-layer check per model', calls.filter(c => c.n === 'GetCurrentAnimationLayer').length === refs.length);
    ok('SetResolutionOfRefModels: registry variants Off/Low/Medium/High = 0..3', S().variants.SetResolutionOfRefModels_High === 3 && S().variants.SetResolutionOfRefModels_OffLoaded === 0);
    calls = trace(['SISetResolutionOfRefModels'], () => { r = run('SetResolutionOfRefModels', { InputObjs: [ms[0]], resolution: 0 }); });
    ok('SetResolutionOfRefModels with input: the input as given', calls[0]?.a.Target.length === 1 && calls[0].a.Target[0] === ms[0] && calls[0].a.Resolution === 0);
    // UpdateReferencedModel
    A.select([]); r = run('UpdateReferencedModel'); ok('UpdateReferencedModel empty: "No valid referenced model in argument"', has(r, /^No valid referenced model in argument$/), r.log);
    const n0 = S().calls.length; r = run('UpdateReferencedModel', { Clip: [cube, ms[0]] });
    ok('UpdateReferencedModel: models only -> XSIFileService.UpdateReferencedModel <models>', !r.err && S().calls.length === n0 + 1 && S().calls.at(-1).what === 'XSIFileService.UpdateReferencedModel' && S().calls.at(-1).args[0].length === 1, r.err);
    // CommitToReference
    S().hooks.yesNo = () => false;
    let c0 = S().calls.length; r = run('CommitToReference', { Model: [ms[0]] });
    ok('CommitToReference default (FileName "", Confirm True): question 1083 "Warning"; not Yes -> nothing', !r.err && S().boxes.at(-1) === 'Warning: This operation is destructive and not undoable. The file used by the referenced model will be overwritten. Do you want to proceed?' && S().calls.length === c0, S().boxes.at(-1));
    S().hooks.yesNo = () => true; c0 = S().calls.length; run('CommitToReference', { Model: [ms[0], ms[1], cube] });
    ok('CommitToReference Yes, several models: Model.CommitToReference "", Nested per Model item', S().calls.length === c0 + 2 && S().calls.slice(c0).every(c => c.what === 'Model.CommitToReference' && c.args[1] === ''));
    delete S().hooks.yesNo; c0 = S().calls.length; r = run('CommitToReference', { Model: [ms[0]], FileName: 'b17b_out.emdl', IncludeNestedRefModels: true });
    ok('CommitToReference FileName given, one model: no question, the file is passed', S().calls.length === c0 + 1 && S().calls.at(-1).args[1] === 'b17b_out.emdl' && S().calls.at(-1).args[2] === true, S().calls.at(-1));
    // AddDelta
    calls = trace(['ImportDelta'], () => { r = run('AddDelta', { Model: ms[0] }); });
    const d = r.v;
    ok('AddDelta: ImportDelta "non.existent.delta", Model, False, False', calls[0]?.a.FileName === 'non.existent.delta' && calls[0].a.Model === ms[0] && calls[0].a.Reference === false && calls[0].a.Interactive === false, calls[0]?.a);
    ok('AddDelta: storage 0, status 2, filename "" on the returned delta', d?.type === 'delta' && d.val('storage') === 0 && d.val('status') === 2 && d.val('filename') === '', r.err ?? d?.params?.map(p => [p.name, p.value]));
    undoTo(u0);

    // DeleteModelFromObj / DuplicateModelFromObj
    const mdl = A.run('CreateModel', { InputObj: [], Name: 'b17bMdl' }); const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'b17bNull' }) ?? A.scene.find('b17bNull');
    const nl = typeof nul === 'string' ? A.scene.find(nul) : (nul?.kind ? nul : A.scene.find('b17bNull'));
    if (nl && nl.parentObj !== mdl) mdl.addChild(nl);
    const uD = A.undoStack.length;
    r = run('DeleteModelFromObj', { InputObj: [nl] });
    ok('DeleteModelFromObj: the owning model is deleted in branch (DeleteObj "B:<model>")', !r.err && !objs().includes(mdl) && !objs().includes(nl), r);
    undoTo(uD); ok('DeleteModelFromObj undo', objs().includes(mdl) && nl.parentObj === mdl);
    calls = trace(['DeleteObj'], () => { r = run('DeleteModelFromObj', { InputObj: [cube] }); });
    ok('DeleteModelFromObj: an object under the scene root is itself deleted, B: prefix', !objs().includes(cube) && String(calls[0]?.a.InputObj).startsWith('B:'), calls.map(c => c.a));
    undoTo(uD);
    r = run('DeleteModelFromObj', { InputObj: [cube, cube.properties[0]] });
    ok('DeleteModelFromObj non-3D item: "Invalid selection, Please select polygons or an object", nothing deleted', has(r, /^Invalid selection, Please select polygons or an object$/) && objs().includes(cube), r.log);
    calls = trace(['ApplyTopoOp'], () => { r = run('DeleteModelFromObj', { InputObj: ['cube.poly[0,1]'] }); });
    ok('DeleteModelFromObj polygons: ApplyTopoOp DeleteComponent, "<components>"', calls[0] && /Delete ?Component/.test(calls[0].a.PresetObj) && calls[0].a.ConnectionSet === 'cube.poly[0,1]', [calls.map(c => c.a), r.err]);
    undoTo(uD);
    calls = trace(['ApplyTopoOp'], () => { r = run('DeleteModelFromObj', { InputObj: ['cube.pnt[0]'] }); });
    ok('DeleteModelFromObj points: DissolveComponent (or a "not yet attested" line when this build has no such operator)', calls.some(c => /Dissolve/.test(c.a.PresetObj)) || has(r, /not yet attested.*DissolveComponent/), r.log);
    undoTo(uD); reset();
    r = run('DuplicateModelFromObj', { InputObj: ['cube.poly[0]'] });
    ok('DuplicateModelFromObj sub-components: message box 1082 "Invalid selection, Please select objects", nothing duplicated', !r.err && S().boxes.at(-1) === 'Invalid selection, Please select objects' && r.v === undefined, r);
    const nB = objs().length; r = run('DuplicateModelFromObj', { InputObj: [nl] }); const cp = r.v;
    ok('DuplicateModelFromObj: the owning model is duplicated with its hierarchy', !r.err && cp?.kind === 'model' && cp !== mdl && cp.children.length === 1 && objs().length === nB + 2, r.err ?? cp?.name);
    undoTo(uD); ok('DuplicateModelFromObj undo', objs().length === nB);
    r = run('DuplicateModelFromObj', { InputObj: [cube] });
    ok('DuplicateModelFromObj: an object under the scene root is itself duplicated', !r.err && r.v && r.v !== cube && r.v.type === cube.type, r.err);
    undoTo(uD);
    r = run('DuplicateModelFromObj', { InputObj: [cube, cube.properties[0]] });
    ok('DuplicateModelFromObj non-3D item: "invalid selection, please select an object"', has(r, /^invalid selection, please select an object$/), r.log);

    // MakeLocalMaterialsForHierarchy / material localisation
    const sph = A.scene.find('sphere') ?? A.run('CreatePrim', { PresetObj: 'Sphere' });
    const s2 = typeof sph === 'string' ? A.scene.find(sph) : sph;
    const shared = A.scene.newMaterial('b17bShared', A.scene.root.material.surface);
    const oldC = cube.material, oldS = s2.material; cube.setMaterial(shared); s2.setMaterial(shared); shared.parent = null;
    const uM = A.undoStack.length;
    calls = trace(['DeselectAll', 'SelectObj', 'SelectChildNodes'], () => { r = run('MakeLocalMaterialsForHierarchy', { InputObj: [cube] }); });
    ok('MakeLocalMaterialsForHierarchy: DeselectAll, SelectObj <input>, SelectChildNodes', calls.map(c => c.n).join() === 'DeselectAll,SelectObj,SelectChildNodes', calls.map(c => c.n));
    ok('MakeLocalMaterialsForHierarchy: a material with a user outside the selection is made local as <name>_copy; the other user keeps it', !r.err && cube.material !== shared && cube.material?.name === 'b17bShared_copy' && s2.material === shared, [r.err, cube.material?.name, s2.material?.name]);
    undoTo(uM); ok('MakeLocalMaterialsForHierarchy undo', cube.material === shared);
    r = run('MakeLocalMaterialsForHierarchy', { InputObj: [cube, s2] });
    ok('MakeLocalMaterialsForHierarchy: all users in the selection -> not made local', !r.err && cube.material === shared && s2.material === shared, [cube.material?.name, s2.material?.name]);
    undoTo(uM);
    // the duplicate path: no filter, "used outside the model"
    const mm = A.run('CreateModel', { InputObj: [], Name: 'b17bMatMdl' }); const inner = A.run('Duplicate', { InputObjs: [cube] })[0]; mm.addChild(inner); inner.setMaterial(shared);
    r = run('DuplicateModelFromObj', { InputObj: [inner] });
    const innerCopy = r.v?.children?.[0];
    ok('DuplicateModelFromObj: the copy\'s materials used outside its model are made local (<name>_copy)', !r.err && innerCopy && innerCopy.material !== shared && /^b17bShared_copy/.test(innerCopy.material?.name ?? ''), [r.err, innerCopy?.material?.name]);
    undoTo(uM);
    cube.setMaterial(oldC); s2.setMaterial(oldS);
    // makeOwnMaterialCopy stays for the app's own callers (MakeLocal "<obj>.material" on an inheriting object)
  } catch (e) { ok('Model block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, EXTRA });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_chains_model_b17b: ${pass}/${pass + fail} ok`);
await browser.close();
process.exit(fail ? 1 : 0);
