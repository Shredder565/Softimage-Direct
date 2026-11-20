// CMD-B17e / CMD-B17f: animation.vbs (external constraints, marking sets), primitives.vbs (GetPresetModel,
// GetPrimLattice, GetPrimVolumeDeform, GetPrimWave) and particle.vbs (ApplySoftBody, ApplyCloth, ApplyParticleShader,
// CreateForce). No XSIBATCH golden exists: this is a contract check against the "Wire contract" sections of
// docs/ghidra/cmd-b17e-animation-action-scripts.md (section 2) and docs/ghidra/cmd-b17f-primitives-particle-scripts.md
// and the cmd-b17e / cmd-b17f items of docs/re/WIRE_CORRECTIONS_B17.md:
//   1. every command is registered with the catalogue argument list (data/commands_full.json, the entry of the
//      contract's procedure);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error;
//   3. the contract's stated results (call sequence, objects made, values set, errors, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: SI_URL=http://localhost:4183/ node tools/compare_anim_prims_b17ef.mjs
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

/** name -> registry procedure whose entry is the contract's (first entry of that procedure). */
const PROC = {
  SelectExternalConstraints: 'ManageExternalConstraintProc', ActivateExternalConstraints: 'ManageExternalConstraintProc',
  DeactivateExternalConstraints: 'ManageExternalConstraintProc', RemoveExternalConstraints: 'ManageExternalConstraintProc',
  CreateMarkingSet: 'CreateMarkingSetProc', ActivateMarkingSet: 'ActivateMarkingSetProc', SetKeyUsingMarkingSet: 'SetKeyUsingMarkingSetProc',
  GetPresetModel: 'GetPresetModelProc', GetPrimLattice: 'GetPrimLatticeProc', GetPrimVolumeDeform: 'GetPrimVolumeDeformProc',
  GetPrimWave: 'GetPrimWaveProc', ApplySoftBody: 'ApplySoftBodyProc', ApplyCloth: 'ApplyClothProc',
  ApplyParticleShader: 'ApplyParticleShaderProc', CreateForce: 'CreateForceProc',
};
const NAMES = Object.keys(PROC);
/** Default run (cube selected): 'ok', or the expected outcome. */
const DEFAULT_EXPECT = {
  CreateMarkingSet: 'log:You need to mark some parameters first',
  ActivateMarkingSet: 'status:80070057',   // SetMarking "MarkingSet" with no MarkingSet property on the selection
  GetPresetModel: 'nya',                    // WomanSkeleton_Rig is not bundled
};
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n && x.handler === PROC[n]);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
page.on('dialog', d => d.dismiss().catch(() => {}));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.cmdB17ef && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_EXPECT }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false; A.maxUndo = 1e6;
  const S = A.cmdB17ef;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.constructor?.name !== 'Object' && !Array.isArray(v) ? (v.fullName ?? v.name ?? String(v)) : v)).slice(0, 500)]);
  const run = (n, a = {}) => { const m = A.log.length; const c = S.calls.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text), calls: S.calls.slice(c) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), calls: S.calls.slice(c) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const nya = r => has(r, /not yet attested/);
  const cancelled = r => !!r.err && /siErrCancelled/.test(r.err);
  const calls = (r, name) => (r.calls ?? []).filter(c => c.call === name);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube'), sphere = A.scene.find('sphere'), light = A.scene.find('light');
  const reset = () => { A.setSelMode?.('object'); A.select([cube]); A.anim.marked.clear(); };
  const undoTo = u => { while (A.undoStack.length > u) A.undo(); };
  const prefs = (A.prefValues ??= {});
  const mk = (preset, name) => { A.run('CreatePrim', { PresetObj: preset, GeometryType: 'MeshSurface', Name: name }); return A.scene.find(name); };
  const lp = (o, n) => o.kinematics.local.get(n);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n); if (r.v && typeof r.v.then === 'function') await r.v;
    undoTo(u0);
    const want = DEFAULT_EXPECT[n];
    let res;
    if (!want) res = r.err ? 'ERROR: ' + r.err : 'ok';
    else if (want.startsWith('log:')) res = !r.err && r.log.some(l => l.includes(want.slice(4))) ? 'expected' : 'WRONG: ' + JSON.stringify(r);
    else if (want.startsWith('status:')) res = r.err && r.err.includes('status 0x' + want.slice(7)) ? 'expected-failure' : 'WRONG: ' + (r.err ?? 'no error');
    else if (want === 'nya') res = !r.err && nya(r) ? 'expected (not yet attested)' : 'WRONG: ' + JSON.stringify(r);
    out.defaults[n] = res;
  }
  // tidy what the default runs created through promises (GetPresetModel)
  reset();

  // ============================================================ CMD-B17e: marking sets
  try {
    const ex = S.expand(['kine.local.pos', 'kine.local.ori', 'kine.local.ori.euler', 'kine.local.scl', 'kine.global', 'visibility.viewvis,kine.local.posx']);
    ok('expand marking: pos/ori/ori.euler/scl -> scalar channels, kine.global -> nine (pos, rot, scl), others kept, comma-split',
      JSON.stringify(ex) === JSON.stringify(['kine.local.posx', 'kine.local.posy', 'kine.local.posz', 'kine.local.rotx', 'kine.local.roty', 'kine.local.rotz', 'kine.local.rotx', 'kine.local.roty', 'kine.local.rotz', 'kine.local.sclx', 'kine.local.scly', 'kine.local.sclz',
        'kine.global.posx', 'kine.global.posy', 'kine.global.posz', 'kine.global.rotx', 'kine.global.roty', 'kine.global.rotz', 'kine.global.sclx', 'kine.global.scly', 'kine.global.sclz', 'visibility.viewvis', 'kine.local.posx']), ex);

    reset(); const u0 = A.undoStack.length;
    let r = run('CreateMarkingSet', { InputObjs: [cube] });
    ok('CreateMarkingSet: nothing marked -> siError "You need to mark some parameters first", nothing made', !r.err && A.log.some(l => l.kind === 'error' && l.text === 'You need to mark some parameters first') && !cube.properties.some(p => p.name === 'MarkingSet'), r);
    A.anim.marked.add(lp(cube, 'posx')); A.anim.marked.add(lp(cube, 'roty'));
    A.select([]); r = run('CreateMarkingSet');
    ok('CreateMarkingSet: empty input -> siError "You need to select an object first"', !r.err && A.log.some(l => l.kind === 'error' && l.text === 'You need to select an object first') && !cube.properties.some(p => p.name === 'MarkingSet'), r);
    A.select([cube, sphere]);
    r = run('CreateMarkingSet', { Reset: true });
    const msC = cube.properties.find(p => p.name === 'MarkingSet'), msS = sphere.properties.find(p => p.name === 'MarkingSet');
    const src = (ms) => (ms?.params ?? []).map(p => p.proxied?.fullName ?? p.proxied?.name);
    ok('CreateMarkingSet: SIAddProp("Custom_parameter_list", obj, siNodePropagation, "MarkingSet") per scene object', !r.err && calls(r, 'SIAddProp').length === 2 && calls(r, 'SIAddProp').every(c => c.args[0] === 'Custom_parameter_list' && c.args[2] === 'siNodePropagation' && c.args[3] === 'MarkingSet') && msC && msS, r);
    ok('CreateMarkingSet: AddProxyParam <set>, "<object>.<marked>" list (each object proxies its own parameters)',
      calls(r, 'AddProxyParam').map(c => c.args[1]).join('|') === 'cube.kine.local.posx,cube.kine.local.roty|sphere.kine.local.posx,sphere.kine.local.roty'
      && msC.params.length === 2 && msS.params.length === 2 && msC.params[0].proxied === lp(cube, 'posx') && msS.params[1].proxied === lp(sphere, 'roty'), [calls(r, 'AddProxyParam'), src(msC), src(msS)]);
    ok('CreateMarkingSet: no return value', r.v === undefined, r.v);
    A.anim.marked.clear(); A.anim.marked.add(lp(cube, 'sclz')); A.select([cube]);
    r = run('CreateMarkingSet', { Reset: false });
    const msC2 = cube.properties.find(p => p.name === 'MarkingSet');
    ok('correction: CreateMarkingSet "Add To" (Reset False) keeps the MarkingSet property and appends the proxies', !r.err && msC2 === msC && msC.params.length === 3 && msC.params[2].proxied === lp(cube, 'sclz') && !calls(r, 'SIAddProp').length && !calls(r, 'MsgBox').length, [r.err, msC.params.length]);
    let asked = 0; S.ask = () => { asked++; return false; };
    r = run('CreateMarkingSet', { Reset: true });
    ok('CreateMarkingSet Reset: an existing MarkingSet -> Yes/No question (texts 1043 / 1044); No -> siErrCancelled, set kept', cancelled(r) && asked === 1 && cube.properties.find(p => p.name === 'MarkingSet') === msC && msC.params.length === 3, r);
    S.ask = () => true;
    r = run('CreateMarkingSet', { Reset: true });
    const msC3 = cube.properties.find(p => p.name === 'MarkingSet');
    ok('CreateMarkingSet Reset: Yes -> the set is deleted and a fresh one made with the current marking', !r.err && msC3 && msC3 !== msC && msC3.params.length === 1 && msC3.params[0].proxied === lp(cube, 'sclz') && calls(r, 'DeleteObj').length === 1 && cube.properties.filter(p => p.name === 'MarkingSet').length === 1, r);
    S.ask = null;
    undoTo(u0);
    ok('CreateMarkingSet: undo removes the marking-set properties', !cube.properties.some(p => p.name === 'MarkingSet') && !sphere.properties.some(p => p.name === 'MarkingSet'));

    // ActivateMarkingSet
    reset(); A.anim.marked.add(lp(cube, 'posy')); A.anim.marked.add(lp(cube, 'posz'));
    run('CreateMarkingSet'); A.anim.marked.clear();
    const set = cube.properties.find(p => p.name === 'MarkingSet');
    A.select([cube]);
    r = run('ActivateMarkingSet', { InputObjs: [sphere] });
    ok('correction: ActivateMarkingSet ignores InputObjs and runs SetMarking "MarkingSet" (marking relative to the selection)',
      !r.err && calls(r, 'SetMarking').length === 1 && calls(r, 'SetMarking')[0].args[0] === 'MarkingSet' && A.anim.marked.size === 2 && set.params.every(p => A.anim.marked.has(p)), [r, A.anim.marked.size]);

    // SetKeyUsingMarkingSet
    const key = (p, t) => !!A.anim.fcurve(p)?.keys.some(k => near(k.time, t));
    A.anim.frame = 7; const tKey = 7;
    prefs['preferences.animation.save_key_command'] = 0;
    A.select([]); r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet: empty input -> siError "You need to select an object first"', !r.err && A.log.some(l => l.kind === 'error' && l.text === 'You need to select an object first') && !calls(r, 'SaveKey').length, r);
    const u1 = A.undoStack.length;
    A.select([cube, sphere]); r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet pref 0: SaveKey "<object>/.MarkingSet", PlayControl.Key per object with a set; others skipped',
      !r.err && calls(r, 'SaveKey').length === 1 && calls(r, 'SaveKey')[0].args[0] === 'cube/.MarkingSet' && calls(r, 'SaveKey')[0].args[1] === tKey
      && key(lp(cube, 'posy'), tKey) && key(lp(cube, 'posz'), tKey) && !key(lp(cube, 'posx'), tKey) && !key(lp(sphere, 'posy'), tKey), r);
    undoTo(u1);
    // Branch: descendants only
    const par = A.run('GetPrim', { PresetObj: 'Null', Name: 'b17par' }); const kid = mk('Cube', 'b17kid');
    A.run('ParentObj', { InputObj: par, Children: [kid] });
    if (kid.parentObj !== par) { const p0 = kid.parentObj; p0.removeChild(kid); par.addChild(kid); }
    A.anim.marked.clear(); A.anim.marked.add(lp(kid, 'rotx')); A.select([kid]); run('CreateMarkingSet');
    A.anim.marked.clear(); A.anim.marked.add(lp(par, 'rotx')); A.select([par]); run('CreateMarkingSet'); A.anim.marked.clear();
    A.select([par]); r = run('SetKeyUsingMarkingSet', { Branch: true });
    ok('SetKeyUsingMarkingSet Branch: the work set is the descendants (FindChildren si3DObjectFamily); the root itself is not keyed (open question 2)',
      !r.err && key(lp(kid, 'rotx'), tKey) && !key(lp(par, 'rotx'), tKey) && calls(r, 'FindChildren').length === 1, [r, key(lp(par, 'rotx'), tKey)]);
    // pref 1 / 2 / other
    prefs['preferences.animation.save_key_command'] = 1;
    A.anim.marked.clear(); A.anim.marked.add(lp(cube, 'sclx')); A.select([cube]);
    r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet pref 1: SaveKey FindObjectsByMarkingAndCapabilities(, siKeyable) of the work set', !r.err && calls(r, 'SaveKey').length === 1 && /\(, siKeyable\)/.test(calls(r, 'SaveKey')[0].args[0]) && key(lp(cube, 'sclx'), tKey), r);
    prefs['preferences.animation.save_key_command'] = 2;
    A.anim.marked.clear(); r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet pref 2, nothing marked: no-op', !r.err && !calls(r, 'SaveKey').length, r);
    A.anim.marked.add(lp(cube, 'scly')); r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet pref 2: the marking joined with commas -> FindObjectsByMarkingAndCapabilities(<marking>, siKeyable)', !r.err && calls(r, 'SaveKey')[0]?.args[0] === 'FindObjectsByMarkingAndCapabilities(kine.local.scly, siKeyable)' && key(lp(cube, 'scly'), tKey), r);
    prefs['preferences.animation.save_key_command'] = 5;
    r = run('SetKeyUsingMarkingSet');
    ok('SetKeyUsingMarkingSet: other preference values -> siErrCancelled', cancelled(r), r);
    prefs['preferences.animation.save_key_command'] = 0;
  } catch (e) { ok('marking-set section ran', false, String(e?.stack ?? e)); }

  // ============================================================ CMD-B17e: external constraints
  try {
    reset();
    const out1 = mk('Cube', 'b17out'); const out2 = mk('Sphere', 'b17out2');
    const a1 = mk('Cube', 'b17a1'), b1 = mk('Cube', 'b17b1');
    A.select([a1, b1]); const M1 = A.run('CreateModel', { InputObj: [a1, b1], Name: 'b17M1' });
    const a2 = mk('Cube', 'b17a2'); A.select([a2]); const M2 = A.run('CreateModel', { InputObj: [a2], Name: 'b17M2' });
    ok('fixture: two models', a1.model?.name === M1.name && b1.model === a1.model && a2.model?.name === M2.name, [a1.model?.name, a2.model?.name]);
    const cnsExt = A.run('ApplyCns', { Preset: 'Position', InputObjs: [a1], Target: [out1] });
    const cnsInt = A.run('ApplyCns', { Preset: 'Orientation', InputObjs: [a1], Target: [b1] });
    const cnsExt2 = A.run('ApplyCns', { Preset: 'Position', InputObjs: [a2], Target: [out2] });
    ok('fixture: constraints', !!cnsExt?.targets && !!cnsInt?.targets && !!cnsExt2?.targets, [cnsExt, cnsInt]);
    A.select([]); let r = run('SelectExternalConstraints');
    ok('External constraints: empty input -> info "No valid object selection", siErrCancelled', cancelled(r) && has(r, /^No valid object selection$/), r);
    A.select([a1]);
    r = run('SelectExternalConstraints');
    ok('SelectExternalConstraints: the external constraint only (constraining object outside the model) is selected; log "Found 1 constraints and 0 upvectors external to <model>"',
      !r.err && A.selection.length === 1 && A.selection[0] === cnsExt && has(r, new RegExp(`^Found 1 constraints and 0 upvectors external to ${M1.name}$`)) && r.v === undefined, [r, A.selection]);
    A.select([M1]); r = run('SelectExternalConstraints');
    ok('SelectExternalConstraints on the model itself: its descendants are scanned', !r.err && A.selection[0] === cnsExt && A.selection.length === 1, A.selection);
    r = run('SelectExternalConstraints', { InputObj: [a1, a2] });
    ok('correction: only the first scene object of the input is used', !r.err && A.selection.length === 1 && A.selection[0] === cnsExt && !A.selection.includes(cnsExt2), A.selection);
    const act = c => c.get('active')?.value;
    A.select([a1]); r = run('DeactivateExternalConstraints');
    ok('DeactivateExternalConstraints (Mute): SetValue <cns>.active False on the external ones only', !r.err && act(cnsExt) === false && act(cnsInt) !== false && calls(r, 'SetValue').some(c => c.args[1] === false), r);
    r = run('ActivateExternalConstraints');
    ok('ActivateExternalConstraints (UnMute): SetValue <cns>.active True', !r.err && act(cnsExt) === true, r);
    r = run('SelectExternalConstraints', { Operation: 'Toggle' });
    ok('Operation "Toggle": ToggleValue "active", <cns>', !r.err && act(cnsExt) === false && calls(r, 'ToggleValue').length === 1, r);
    run('SelectExternalConstraints', { Operation: 'Toggle' });
    A.select([a1]); r = run('SelectExternalConstraints', { Operation: 'Bogus' });
    ok('Operation not recognised -> Select', !r.err && A.selection[0] === cnsExt, A.selection);
    const u2 = A.undoStack.length; A.select([a1]);
    r = run('RemoveExternalConstraints');
    ok('RemoveExternalConstraints (Delete): DeleteObj <collection>; the internal constraint stays', !r.err && !a1.properties.includes(cnsExt) && a1.properties.includes(cnsInt) && calls(r, 'DeleteObj').length === 1, r);
    undoTo(u2); ok('RemoveExternalConstraints: undo restores the constraint', a1.properties.includes(cnsExt));
    // bones: external up-vector reference (joint parameters kept on the bone in this build)
    const bone = new (cube.constructor)('b17bone', 'bone'); a1.addChild(bone);
    bone.UpVectorReference = out1; const rotx = lp(bone, 'rotx'); rotx.value = 33;
    r = run('DeactivateExternalConstraints', { InputObj: [a1] });
    ok('bone with an external UpVectorReference (Mute): counted; DeactivateAbove "<joint>.SkeletonUpVectorOp", True',
      !r.err && has(r, /and 1 upvectors external/) && /\.SkeletonUpVectorOp$/.test(calls(r, 'DeactivateAbove')[0]?.args[0] ?? '') && calls(r, 'DeactivateAbove')[0]?.args[1] === true, r);
    ok('bone (Mute): resplane 0 and rotx preserved; the unmodelled SkeletonUpVectorOp is logged as not yet attested', bone.get('resplane')?.value === 0 && near(rotx.value, 33) && nya(r), [bone.get('resplane')?.value, rotx.value]);
    r = run('ActivateExternalConstraints', { InputObj: [a1] });
    ok('bone (UnMute): DeactivateAbove ..., False; resplane 2', !r.err && calls(r, 'DeactivateAbove')[0]?.args[1] === false && bone.get('resplane')?.value === 2, r);
    r = run('SelectExternalConstraints', { InputObj: [a1] });
    ok('bone (Select): counted, nothing changed', !r.err && has(r, /and 1 upvectors external/) && !calls(r, 'DeactivateAbove').length && bone.get('resplane')?.value === 2, r);
    const u3 = A.undoStack.length;
    r = run('RemoveExternalConstraints', { InputObj: [a1] });
    ok('bone (Delete): resplane 0 then DeleteObj "<joint>.SkeletonUpVectorOp"', !r.err && bone.get('resplane')?.value === 0 && calls(r, 'DeleteObj').some(c => /SkeletonUpVectorOp$/.test(c.args[0])), r);
    undoTo(u3);
  } catch (e) { ok('external-constraint section ran', false, String(e?.stack ?? e)); }

  // ============================================================ CMD-B17f: GetPresetModel
  try {
    reset(); const before = A.autoInspect = true;
    let r = run('GetPresetModel', { ModelName: 'Bull', Name: 'b17Bull' });
    const m = await r.v;
    const imp = calls(r, 'ImportModel')[0];
    ok('GetPresetModel: ImportModel(<factory>/Data/XSI_SAMPLES/Models/<ModelName>.emdl, <Parent>) (forward slashes, one "/" after the factory path)', !!imp && /\/Data\/XSI_SAMPLES\/Models\/Bull\.emdl$/.test(imp.args[0]) && !imp.args[0].includes('\\') && !/\/\/Data/.test(imp.args[0]), imp);
    ok('GetPresetModel: siAutoInspect saved, set False around the import, restored', A.autoInspect === before && JSON.stringify(S.calls.filter(c => c.command === 'GetPresetModel' && c.call === 'SetUserPref').slice(-2).map(c => c.args[1])) === '[false,true]', S.calls.filter(c => c.call === 'SetUserPref').slice(-2));
    ok('GetPresetModel: SetValue <model>.Name, <Name>; returns the model', m && m.name === 'b17Bull' && A.scene.find('b17Bull') === m, m?.name);
    A.autoInspect = false;
    r = run('GetPresetModel', { ModelName: 'Man_Face', Name: 'b17Face', PsetName: 'Face_Maker' });
    const mf = await r.v; const all = S.calls.filter(c => c.command === 'GetPresetModel').slice(-8).map(c => c.call);
    ok('GetPresetModel with PsetName: GetPrim "Null", AddProp <preset>, <null>, delete the null, InspectObj "<model>.<PsetName>", "General,CustomPSet"',
      mf && ['GetPrim', 'AddProp', 'DeleteObj', 'InspectObj'].every(n => all.includes(n)) && S.calls.filter(c => c.call === 'InspectObj').slice(-1)[0]?.args.join('|') === `${mf.name}.Face_Maker|General,CustomPSet` && ![...A.scene.allObjects()].some(o => o.properties.some(p => p.name === 'Face_Maker') && o.type === 'null'), all);
    r = run('GetPresetModel', { ModelName: 'Man_Character', Name: 'b17Char', PsetName: 'Character.Character_Designer' });
    await r.v;
    ok('GetPresetModel: the preset name is the part after the last "." of PsetName', S.calls.filter(c => c.call === 'AddProp').slice(-1)[0]?.args[0] === 'Character_Designer', S.calls.filter(c => c.call === 'AddProp').slice(-1));
    r = run('GetPresetModel', { ModelName: 'Quadruped_PropGuide', Name: 'x' });
    ok('GetPresetModel: a sample model this build does not bundle -> Nothing, logged as not yet attested', (await r.v) === null && nya(r), r.log);
  } catch (e) { ok('GetPresetModel section ran', false, String(e?.stack ?? e)); }

  // ============================================================ CMD-B17f: GetPrimLattice / GetPrimVolumeDeform / GetPrimWave
  try {
    const g1 = mk('Cube', 'b17g1'), g2 = mk('Sphere', 'b17g2');
    A.select([g1]); let r = run('GetPrimLattice', { InputObjs: [g1] });
    const lat = r.v;
    ok('GetPrimLattice: one geometry input -> it is the parent; SIGetPrimLattice(preset, input, Name, parent)', !r.err && lat?.type === 'lattice' && calls(r, 'SIGetPrimLattice')[0]?.args[3] === siN(g1) && lat.parentObj === g1, [r, lat?.parentObj?.name]);
    function siN(o) { return o.model && o.model.parentObj ? o.model.name + '.' + o.name : o.name; }
    ok('GetPrimLattice: SelectFilter siConditionalObjectFilter, SelectObj <lattice>, AutoInspect <lattice>, , , "General"; PrimObj output', A.selection.length === 1 && A.selection[0] === lat && calls(r, 'SelectFilter')[0]?.args[0] === 'siConditionalObjectFilter' && calls(r, 'AutoInspect')[0]?.args[1] === 'General' && S.out.GetPrimLattice.PrimObj === lat.primitive, r.calls);
    r = run('GetPrimLattice', { InputObjs: [g1, g2], Parent: '' });
    ok('GetPrimLattice: several geometry inputs -> the Parent argument is kept', !r.err && r.v && r.v.parentObj !== g1 && r.v.parentObj !== g2 && calls(r, 'SIGetPrimLattice')[0]?.args[3] === '', [r.err, r.v?.parentObj?.name]);
    r = run('GetPrimVolumeDeform', { InputObjs: [g1] });
    const vol = r.v;
    ok('GetPrimVolumeDeform: SIGetPrimVolumeDeform(preset SphereVolume, input, Name, Parent) (no geometry-parent lookup); object selected', !r.err && vol && calls(r, 'SIGetPrimVolumeDeform')[0]?.args[0] === 'SphereVolume' && calls(r, 'SIGetPrimVolumeDeform')[0]?.args[3] === '' && A.selection[0] === vol && !calls(r, 'SIFilter').length, r);
    ok('GetPrimVolumeDeform: inspects the connected volume operators (inferred), else the object "General"', calls(r, 'AutoInspect').length === 1 && (S.out.GetPrimVolumeDeform.operators.length ? Array.isArray(calls(r, 'AutoInspect')[0].args[0]) : calls(r, 'AutoInspect')[0].args[1] === 'General'), [calls(r, 'AutoInspect'), S.out.GetPrimVolumeDeform.operators.length]);
    // wave: one object
    g1.kinematics.local.get('posx').value = 3;
    const u0 = A.undoStack.length;
    r = run('GetPrimWave', { InputObjs: [g1] });
    const w = r.v; const L = n => w.kinematics.local.get(n).value;
    ok('GetPrimWave single: SIGetPrim(Wave, Name, parent=<the object>, 1); ApplyOp "Wave", "<obj>;<wave>"', !r.err && w && w.parentObj === g1 && calls(r, 'SIGetPrim')[0]?.args[3] === 1 && calls(r, 'ApplyOp')[0]?.args.join('|') === `Wave|${siN(g1)};${siN(w)}` && g1.primitive.operators.some(o => o.inputs?.includes(w)), r);
    ok('GetPrimWave single: Translate 0,0,0 / Rotate 0,0,0 / Scale 1,1,1 absolute local (sits on the parent)', ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'].every(n => L(n) === 0) && ['sclx', 'scly', 'sclz'].every(n => L(n) === 1) && ['Translate', 'Rotate', 'Scale'].every(n => calls(r, n)[0]?.args.slice(4).join() === 'siAbsolute,siLocal,siObj,siXYZ'), r.calls);
    ok('GetPrimWave: wave selected; primitive type not "null" -> AutoInspect "General"; Primitive output', A.selection[0] === w && calls(r, 'AutoInspect')[0]?.args[1] === 'General' && S.out.GetPrimWave.Primitive === w.primitive && w.primitive.type !== 'null', r.calls);
    undoTo(u0); ok('GetPrimWave: undo removes the wave and its deformer', !g1.children.includes(w) && !g1.primitive.operators.some(o => o.inputs?.includes(w)));
    g2.kinematics.local.get('posx').value = -1; g2.kinematics.local.get('posz').value = 4;
    r = run('GetPrimWave', { InputObjs: [g1, g2] }); const w2 = r.v;
    const gx = o => o.globalMatrix().elements[12], gz = o => o.globalMatrix().elements[14];
    ok('GetPrimWave several: one Wave op per object; Translate to the average kine.pos, no rotate / scale', !r.err && w2 && [g1, g2].every(o => o.primitive.operators.some(op => op.inputs?.includes(w2))) && near(w2.kinematics.local.get('posx').value, (gx(g1) + gx(g2)) / 2) && near(w2.kinematics.local.get('posz').value, (gz(g1) + gz(g2)) / 2) && !calls(r, 'Rotate').length && !calls(r, 'Scale').length, r);
  } catch (e) { ok('deformer-object section ran', false, String(e?.stack ?? e)); }

  // ============================================================ CMD-B17f: ApplySoftBody / ApplyCloth
  try {
    const s1 = mk('Cube', 'b17s1'), s2 = mk('Sphere', 'b17s2');
    let r = run('ApplySoftBody', { InputObjs: [s1, light] });
    ok('ApplySoftBody: polymsh / surfmsh kept, others dropped; ApplyOp("SoftBodyOp", list, siNode, siPersistentOperation); operators returned + AutoInspect', !r.err && Array.isArray(r.v) && r.v.length === 1 && s1.primitive.operators.includes(r.v[0]) && calls(r, 'ApplyOp')[0]?.args.slice(2).join() === 'siNode,siPersistentOperation' && calls(r, 'AutoInspect').length === 1, r);
    r = run('ApplySoftBody', { InputObjs: [light] });
    ok('ApplySoftBody: nothing left -> Nothing, no operator', !r.err && r.v === null && !calls(r, 'ApplyOp').length, r);
    A.select([]); r = run('ApplySoftBody');
    ok('ApplySoftBody: empty input -> Nothing', !r.err && r.v === null, r);
    const grp = A.run('CreateGroup', { Name: 'b17grp', InputObjs: [s2] });
    r = run('ApplySoftBody', { InputObjs: [grp] });
    ok('ApplySoftBody: groups are expanded to their members', !r.err && Array.isArray(r.v) && s2.primitive.operators.includes(r.v[0]), r);
    const c1 = mk('Cube', 'b17c1');
    r = run('ApplyCloth', { InputObjs: [c1, light] });
    const cp = c1.properties.find(p => p.name === 'ClothProp');
    ok('ApplyCloth: ClothProp added when missing (SIAddProp "Cloth"), SetValue <clothprop>.Master True, ApplyOp "ClothOp"', !r.err && cp && cp.get('Master')?.value === true && calls(r, 'SIAddProp')[0]?.args[0] === 'Cloth' && Array.isArray(r.v) && c1.primitive.operators.includes(r.v[0]) && r.v[0].type === 'clothop' && calls(r, 'ApplyOp')[0]?.args[0] === 'ClothOp', r);
    cp.get('Master').value = false;
    r = run('ApplyCloth', { InputObjs: [c1] });
    ok('ApplyCloth: an existing ClothProp is reused (no second property), Master set again', !r.err && c1.properties.filter(p => p.name === 'ClothProp').length === 1 && cp.get('Master').value === true && !calls(r, 'SIAddProp').length, r);
  } catch (e) { ok('soft body / cloth section ran', false, String(e?.stack ?? e)); }

  // ============================================================ CMD-B17f: ApplyParticleShader / CreateForce
  try {
    const em = mk('Cube', 'b17em'); const cloud = A.run('CreateParticleCloud', { InputObjs: [em] })[0];
    ok('fixture: particle cloud', cloud?.type === 'cloud', cloud?.type);
    let r = run('ApplyParticleShader', { InputObjs: [cloud, em], Material: 'Phong', Volume: 'Phong', Inspect: false });
    const cn = cloud.name; const seq = r.calls.map(c => c.call).filter(n => /Shader|Cnx/.test(n));
    ok('ApplyParticleShader: per particle cloud SIApplyShader Phong.Preset, Material -> material.Surface + Shadow, Volume -> material.Volume, RemoveAllShadersFromCnxPoint material.Photon',
      !r.err && JSON.stringify(seq) === JSON.stringify(['SIApplyShader', 'SIApplyShaderToCnxPoint', 'SIApplyShaderToCnxPoint', 'RemoveAllShadersFromCnxPoint'])
      && /Phong\.Preset$/.test(calls(r, 'SIApplyShader')[0].args[0]) && calls(r, 'SIApplyShaderToCnxPoint')[0].args[1] === `${cn}.material.Surface,${cn}.material.Shadow` && calls(r, 'SIApplyShaderToCnxPoint')[1].args[1] === `${cn}.material.Volume` && calls(r, 'RemoveAllShadersFromCnxPoint')[0].args[0] === `${cn}.material.Photon`, r);
    ok('ApplyParticleShader: returns a collection with one surface shader per cloud; non-particle inputs skipped', Array.isArray(r.v) && r.v.length === 1, r.v);
    const r2 = run('ApplyParticleShader', { InputObjs: [cloud], Material: 'Phong', Volume: 'Phong', Inspect: true });
    ok('correction: the Inspect argument is not used (same calls with True and False)', JSON.stringify(r2.calls.map(c => c.call)) === JSON.stringify(r.calls.map(c => c.call)), [r2.calls.map(c => c.call), r.calls.map(c => c.call)]);
    r = run('ApplyParticleShader', { InputObjs: [em] });
    ok('ApplyParticleShader: no particle cloud in the input -> Nothing', !r.err && r.v === null, r);

    const clothy = mk('Cube', 'b17clothy'); A.run('ApplyCloth', { InputObjs: [clothy] }); const plain = mk('Cube', 'b17plain');
    (A.scene).activeSimulationEnvironment = undefined;
    r = run('CreateForce', { Name: 'Gravity', InputObjs: [cloud, plain, clothy] });
    const f = r.v; const apf = calls(r, 'AddParticleForce');
    ok('CreateForce: SIGetPrim(<Name>) -> the force; returned, SelectObj + AutoInspect "Simulation"', !r.err && f && f.get('forcetype')?.value === 'Gravity' && A.selection[0] === f && calls(r, 'AutoInspect')[0]?.args[1] === 'Simulation', r);
    ok('correction: AddParticleForce only for particle clouds and objects with SoftBodyOp / ClothOp / hairDynamicsOp', apf.length === 2 && apf[0].args[0] === cloud.name && apf[1].args[0] === clothy.name, apf);
    ok('CreateForce without an active simulation environment: no container calls', !calls(r, 'AddContainerToEnvironment').length && !calls(r, 'AddToContainer').length, r.calls);
    const env = A.run('CreateEnvironment', { Name: 'b17env' }); A.scene.activeSimulationEnvironment = env;
    prefs['preferences.simulation.rbdengine'] = 0;
    const u0 = A.undoStack.length;
    r = run('CreateForce', { Name: 'Wind' });
    const data = env.simulationEnvironment;
    ok('CreateForce, environment without containers: RigidBody/RigidBodies, Constraint/Constraints, Force/Forces added; force in <env>.Forces',
      !r.err && JSON.stringify(calls(r, 'AddContainerToEnvironment').map(c => c.args.slice(1))) === JSON.stringify([['RigidBody', 1, 'RigidBodies'], ['Constraint', 1, 'Constraints'], ['Force', 1, 'Forces']])
      && data.containers.find(c => c.name === 'Forces')?.members.includes(r.v) && calls(r, 'AddToContainer')[0]?.args[0] === 'b17env.Forces', [r, data?.containers]);
    ok('CreateForce: no operator on the environment -> rbdengine 0 -> ApplyOp "NXDynamicsOp" (PhysX)', calls(r, 'ApplyOp')[0]?.args[0] === 'NXDynamicsOp' && data.operators.length === 1, calls(r, 'ApplyOp'));
    r = run('CreateForce', { Name: 'Vortex' });
    ok('CreateForce again: containers and operator kept, only AddToContainer', !r.err && !calls(r, 'AddContainerToEnvironment').length && !calls(r, 'ApplyOp').length && data.containers.find(c => c.name === 'Forces').members.length === 2, r.calls);
    undoTo(u0); ok('CreateForce: undo removes the containers, the operator and the forces', data.containers.length === 0 && data.operators.length === 0);
    data.containers.push({ name: 'RigidBodies', type: 'RigidBody', members: [] });
    prefs['preferences.simulation.rbdengine'] = 1;
    r = run('CreateForce', { Name: 'Drag' });
    ok('CreateForce: containers but no Forces -> only the Force container; rbdengine 1 -> ApplyOp "DynamicsOp" (ODE)', JSON.stringify(calls(r, 'AddContainerToEnvironment').map(c => c.args[3])) === '["Forces"]' && calls(r, 'ApplyOp')[0]?.args[0] === 'DynamicsOp', r.calls);
    prefs['preferences.simulation.rbdengine'] = 0; A.scene.activeSimulationEnvironment = undefined;
  } catch (e) { ok('particle shader / force section ran', false, String(e?.stack ?? e)); }

  return out;
}, { NAMES, DEFAULT_EXPECT });

await browser.close();

let pass = 0, fail = 0;
const line = (good, text) => { console.log(`${good ? 'PASS' : 'FAIL'}  ${text}`); good ? pass++ : fail++; };
for (const n of NAMES) {
  const want = JSON.stringify(registry[n]), have = JSON.stringify(got.reg[n]);
  line(want === have && registry[n] !== null, `registered with catalogue arguments: ${n}${want === have ? '' : `  want ${want} got ${have}`}`);
}
for (const n of NAMES) line(!/^(ERROR|WRONG)/.test(got.defaults[n]), `default run ${n}: ${got.defaults[n]}`);
for (const [name, good, detail] of got.checks) line(good, name + (good ? '' : `  ${detail}`));
if (pageErrors.length) line(false, `page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
console.log(`\ncompare_anim_prims_b17ef: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
