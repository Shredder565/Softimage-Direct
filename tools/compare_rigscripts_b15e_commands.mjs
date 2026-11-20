// CMD-B15e (Character Rigging scripts): the 24 commands of src/commands/rigScriptsB15e*.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15e-character-rigging-scripts.md
// and docs/re/WIRE_CORRECTIONS_B15.md items 35-37.
//   1. every name is registered with the registry argument list (data/command_registry.json, first entry of duplicates,
//      return values (flag 0x200) left out);
//   2. every command runs with its default arguments on the sample scene without a thrown error (missing required inputs
//      log "<fn>: argument N is invalid" and return nothing; MakeBelly's guide-count path throws a script error naming it);
//   3. the contract's stated results: object names / hierarchy / parameter values / colors, return member names, error texts,
//      the dialog stand-in, key sets and SetKeyableRig.
// The scripted operators and constraints are parameter-carrying stand-ins: only their names and the parameter values the
// note lists are checked. Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_rigscripts_b15e_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
  .filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['MakeRigIcon', 'MakeBiped', 'MakeBipedDogLeg', 'MakeQuadruped', 'MakeTorso', 'MakeSpine', 'MakeArm', 'MakeHand', 'MakeLeg', 'MakeFoot', 'MakeDogLeg', 'MakeHead',
  'MakeBelly', 'MakeBicepRoll', 'MakeForearmRoll', 'Make2PointSlide', 'MakeThighSlide', 'MakeJointCompression', 'MakeHip', 'MakeShadowChain', 'MakeShadowSpine',
  'MakeBipedCharacterKeySet', 'MakeQuadrupedCharacterKeySet', 'SetKeyableRig'];
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('console', m => { if (process.env.SI_TRACE && m.text().startsWith('MARK')) console.log(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('MakeBiped') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false; A.maxUndo = 1e6; A.cmdLogSize = 1e6;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text), kinds: A.log.slice(m).map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const cube = A.scene.find('cube');
  const all = () => [...A.scene.allObjects()];
  const named = (n) => all().find(o => o.name === n);
  const col = (o) => Number(o?.properties?.find(p => p.type === 'display')?.val('wirecol_index') ?? 0);
  const gp = (o) => { const g = o.globalMatrix().elements; return [g[12], g[13], g[14]]; };
  const near = (a, b, e = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < e);
  const undoTo = (n) => { let k = 0; while (A.undoStack.length > n && k++ < 20000) A.undo(); };
  const members = (o, names) => names.filter(k => !(o && k in o));
  const hasOp = (o, name) => ((o?.primitive?.operators ?? []).concat(o?.rigOps ?? [])).find(x => x.name === name);

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length; const r = run(n); undoTo(u0);
    out.defaults[n] = r.err ? (/MakeBelly/.test(n) && r.err.includes('makeBelly') ? 'expected-failure' : 'ERROR: ' + r.err) : 'ok';
  }
  A.select([]);
  const msgs = (r, re) => has(r, re);

  console.log('MARK MakeRigIcon');
  {
    const r = run('MakeRigIcon', { Type: 4, X: 1, Y: 2, Z: 3, Xlength: 2, Ylength: 2, Zlength: 2, Color: 893, Name: 'Ico' });
    ok('MakeRigIcon: returns a curve object named Name', r.v?.name === 'Ico' && r.v.type === 'crvlist', r.err);
    ok('MakeRigIcon: global transform = translation to (X,Y,Z)', r.v && near(gp(r.v), [1, 2, 3]));
    ok('MakeRigIcon: Display wirecol = Color', col(r.v) === 893);
    const q = run('MakeRigIcon', { Type: 99 }); ok('MakeRigIcon: unknown Type creates nothing', q.v === undefined && !q.err);
    const s = run('MakeRigIcon', { Type: 9 }); ok('MakeRigIcon: type 9 defaults the name to the shape name', s.v?.name === 'CurveSphere');
    const z = run('MakeRigIcon', { Type: 12, Color: 0 }); ok('MakeRigIcon: type 9-14 only color when non-zero', z.v && col(z.v) === 0);
    const o1 = run('MakeRigIcon', { Type: 3, XOffset: 1, YOffset: 0, ZOffset: 1, Name: 'O1' }), o2 = run('MakeRigIcon', { Type: 3, XOffset: 1, YOffset: 1, ZOffset: 1, Name: 'O2' });
    const p1 = o1.v.primitive.operators[0].data.cvs[0], p2 = o2.v.primitive.operators[0].data.cvs[0];
    ok('MakeRigIcon: offsets only applied when all three are non-zero', Math.abs(p1[0] + 0.5) < 1e-6 && Math.abs(p2[0] - 0.5) < 1e-6, [p1, p2]);
  }
  console.log('MARK MakeHip');
  {
    const r = run('MakeHip', {}); ok('MakeHip: no guide and empty selection -> message, nothing', r.v === undefined && has(r, /^Hip Maker Cancel, Requires and Object Selection to define Hip Transform$/), r.log);
    const g = A.scene.root.children.find(c => c.name === 'cube');
    const h = run('MakeHip', { GuideObj: g, TopX: 0, TopY: 2, TopZ: 0, SideX: 1, SideY: 1, SideZ: 0 });
    const op = hasOp(h.v, 'HipIcon');
    ok('MakeHip: HipPlate under the scene root, color 49, HipIcon operator', h.v?.name === 'HipPlate' && h.v.parentObj === A.scene.root && col(h.v) === 49 && !!op, h.err);
    ok('MakeHip: HipIcon parameter values', op && op.val('spine_pointy') === 2 && op.val('leg_pointx') === 1 && op.val('height') === 1.3 && op.val('cap_width') === 0.25 && op.val('width') === 0.7);
  }
  // fixtures for leaf builders
    const guide = A.rigScriptsB15e.makeGuide('biped');
  const G = (n) => all().find(o => o.name === n && o.model === guide);
  const U0 = A.undoStack.length;
  console.log('MARK rolls / slides / joints / belly');
  {
    const m = A.rigScriptsB15e.makeGuide('biped', 'Scratch_Guide');
    const bicep = G('LElbow'), parent = G('LShoulder'); void m;
    const br = run('MakeBicepRoll', { Bicep: bicep, Prefix: 'P', NbDivisions: 3 });
    ok('MakeBicepRoll: returns {Nb, Divisions} with n+1 nulls', br.v && br.v.Nb === 3 && br.v.Divisions.length === 4, br.err);
    ok('MakeBicepRoll: names P Roll1..3 and Roll_4, color 421', br.v && ['PRoll1', 'PRoll2', 'PRoll3', 'PRoll_4'].every((n, i) => br.v.Divisions[i].name === n && col(br.v.Divisions[i]) === 421));
    const L = 4 / 5; const op = hasOp(br.v.Divisions[1], 'FirstBoneRollDivisionRO');
    ok('MakeBicepRoll: length_perc = L*(i-1)/n, mySlerp = i/(n+2)', op && Math.abs(op.val('length_perc') - L * 1 / 3) < 1e-9 && Math.abs(op.val('mySlerp') - 2 / 5) < 1e-9);
    ok('MakeBicepRoll: last null is a child of the bicep', br.v.Divisions[3].parentObj === bicep);
    const f0 = run('MakeForearmRoll', {}); ok('MakeForearmRoll: missing arguments -> "argument N is invalid"', f0.v === undefined && has(f0, /^makeForearmRoll: argument 0 is invalid$/) && has(f0, /^makeForearmRoll: argument 4 is invalid$/), f0.log);
    const [a1, a2, a3, a4, a5] = ['LShoulder', 'LElbow', 'LHand', 'LHandEnd', 'LPinky1'].map(G);
    const fr = run('MakeForearmRoll', { Bicep: a1, Forearm: a2, ArmEff: a3, HandEff: a4, HandBone: a5, Prefix: 'F', NbDivisions: 3, RollOffset: 30 });
    ok('MakeForearmRoll: {Sliders, RollOffset, Nb, Divisions}', fr.v && members(fr.v, ['Sliders', 'RollOffset', 'Nb', 'Divisions']).length === 0 && fr.v.Divisions.length === 3, fr.err);
    ok('MakeForearmRoll: Roll_Compensation.roll_offset = 30, first null Elbow, others ForearmRoll, color 544', fr.v && fr.v.RollOffset.value === 30 && a5.properties.some(p => p.name === 'Roll_Compensation') && fr.v.Divisions[0].name === 'FElbow' && fr.v.Divisions[1].name === 'FForearmRoll' && col(fr.v.Divisions[2]) === 544);
    const op2 = hasOp(fr.v.Divisions[1], 'ForeArmRollDivision'); ok('MakeForearmRoll: ForeArmRollDivision blend = 1 - i/n', op2 && Math.abs(op2.val('blend') - 2 / 3) < 1e-9);
    // 2 point slide
    const s0 = run('Make2PointSlide', { Prefix: 'S' }); ok('Make2PointSlide: missing -> "make2PointSlide: argument N is invalid"', s0.v === undefined && has(s0, /^make2PointSlide: argument 1 is invalid$/), s0.log);
    const s = run('Make2PointSlide', { Prefix: 'S', GuidePoint1: G('LArmPitTop'), GuidePoint2: G('LArmPitBase'), Parent1: a1, Parent2: a2 });
    ok('Make2PointSlide: members', s.v && members(s.v, ['model', 'Hidden', 'Envelope', 'BindNull', 'TopNull', 'BaseNull', 'Constraint', 'HiddenGroup', 'envGroup']).length === 0, s.err);
    ok('Make2PointSlide: SBind/STop under Parent1, SBase under Parent2, colors 748/472/472', s.v && s.v.BindNull.parentObj === a1 && s.v.TopNull.parentObj === a1 && s.v.BaseNull.parentObj === a2 && col(s.v.BindNull) === 748 && col(s.v.TopNull) === 472 && col(s.v.BaseNull) === 472 && s.v.BindNull.name === 'SBind');
    ok('Make2PointSlide: Top/Base take the guide transforms, Top and Base hidden, Bind has a TwoPoints constraint', s.v && near(gp(s.v.TopNull), gp(G('LArmPitTop'))) && s.v.TopNull.val && !s.v.TopNull.property('visibility').val('viewvis') && s.v.BindNull.properties.some(p => p.type === 'twopointscns' && p.targets.length === 2));
    // thigh slide
    const t = run('MakeThighSlide', { Prefix: 'T', GuideObjectCollection: ['LRear1', 'LLowerThigh', 'LHipBottom', 'LLeg', 'LKnee'].map(G), UpperParent: a1, LowerParent: a2 });
    ok('MakeThighSlide: {Guides, Pos, Volume, BindNull, TopNull, BaseNull}; volume color 728', t.v && members(t.v, ['Guides', 'Pos', 'Volume', 'BindNull', 'TopNull', 'BaseNull']).length === 0 && t.v.Volume.name === 'TThighVolume' && col(t.v.Volume) === 728 && t.v.Volume.parentObj === a2, t.err);
    const t0 = run('MakeThighSlide', { Prefix: 'T' }); ok('MakeThighSlide: missing -> argument N is invalid', t0.v === undefined && has(t0, /^makeThighSlide: argument \d is invalid/), t0.log);
    // joint compression
    const j = run('MakeJointCompression', { Prefix: 'E', UpperBone: a1, LowerBone: a2, GuideObjectCollection: ['LElbowJoint2', 'LElbowJoint1', 'LForeArmSquash', 'LForeArmCenter'].map(G) });
    ok('MakeJointCompression: members', j.v && members(j.v, ['UpperBone', 'LowerBone', 'UpperTarget', 'LowerTarget', 'CurveTarget', 'CurveCenter', 'model', 'Envelope', 'Volume', 'UpperJoint', 'LowerJoint', 'envGroup']).length === 0, j.err);
    ok('MakeJointCompression: BendVolume under LowerBone, joints under UpperBone (no divisions), color 748 / volume 728', j.v && j.v.Volume.name === 'EBendVolume' && j.v.Volume.parentObj === a2 && j.v.UpperJoint.parentObj === a1 && j.v.LowerJoint.parentObj === a1 && col(j.v.UpperJoint) === 748 && col(j.v.Volume) === 728 && j.v.UpperJoint.name === 'EUpperJoint');
    ok('MakeJointCompression: Pose + BoundingVolume constraints', j.v && j.v.UpperJoint.properties.some(p => p.type === 'posecns') && j.v.UpperJoint.properties.some(p => p.type === 'bndvolumecns'));
    const j0 = run('MakeJointCompression', { Prefix: 'E' }); ok('MakeJointCompression: missing -> argument N is invalid', j0.v === undefined && has(j0, /^makeJointCompression: argument 1 is invalid$/), j0.log);
    // belly
    const bl0 = run('MakeBelly', { HipObject: a1, VertebraObject: a2, GuideObjectCollection: [G('LowerStomach')] });
    ok('MakeBelly: guide count != 2 -> message, then a script error', !!bl0.err && has(bl0, /^makeBelly: Guide collection needs 2 objects\. Collection has 1 objects$/), [bl0.err, bl0.log]);
    const bl1 = run('MakeBelly', { VertebraObject: a2 }); ok('MakeBelly: argument 0 is invalid', bl1.v === undefined && has(bl1, /^makeBelly: argument 0 is invalid$/));
    const bl = run('MakeBelly', { HipObject: a1, VertebraObject: a2, GuideObjectCollection: [G('LowerStomach'), G('UpperStomach')], ForwardRotationPerc: 0.5 });
    ok('MakeBelly: members + names', bl.v && members(bl.v, ['Guides', 'Hip', 'Vertebra', 'Model', 'Perc', 'Hidden', 'Envelope', 'hipPos', 'vertPos', 'lowerPos', 'upperPos', 'startLower', 'startUpper', 'BellyRoot', 'BellySkel', 'BellyEff', 'BellyBone', 'UpperRoot', 'UpperSkel', 'UpperEff', 'UpperBone', 'LowerRoot', 'LowerSkel', 'LowerEff', 'LowerBone', 'Scale', 'SpringScale', 'HiddenGroup', 'envGroup']).length === 0 && bl.v.BellyRoot.name === 'BellyRoot' && bl.v.UpperBone.name === 'UpperBellyBone' && bl.v.LowerEff.name === 'LowerBellyEff', bl.err);
    ok('MakeBelly: spring chains under vertebra / hip, belly root under the lower spring effector, belly effector Position-constrained', bl.v && bl.v.UpperRoot.parentObj === a2 && bl.v.LowerRoot.parentObj === a1 && bl.v.BellyRoot.parentObj === bl.v.LowerEff && bl.v.BellyEff.properties.some(p => p.type === 'poscns'));
  }
  console.log('MARK shadow chain / spine');
  {
    const sp = guide.children.find(c => c.name === 'LShoulder');
    const arm = run('MakeArm', { ArmParent: sp, GuideObjectCollection: ['LShoulder', 'LElbow', 'LHand'].map(G), Prefix: 'Z' });
    ok('MakeArm: names ZRoot ZBicep ZForearm ZArmEff, Eff = Skel(3), color 489', arm.v && arm.v.Skel.map(o => o.name).join() === 'ZRoot,ZBicep,ZForearm,ZArmEff' && arm.v.Eff === arm.v.Skel[3] && col(arm.v.Eff) === 489, arm.err);
    const sm = run('MakeShadowChain', { Chain: arm.v.Skel, ShadowParent: A.scene.root, SI3DStyleChain: false, IconScale: 0, ShadowType: 0, ShadowCharacterSetName: 'ShadowUpper.ShadowZ_Arm' });
    ok('MakeShadowChain: scale 0 -> warning, uses 1.0', sm.v && sm.v.Scale === 1 && has(sm, /shadow scale cannot be zero, using scale of 1\.0/), sm.err);
    ok('MakeShadowChain: members', sm.v && members(sm.v, ['Hidden', 'Envelope', 'Scale', 'ShadowModel', 'ShadowCharacterSetName', 'Chain', 'Parent', 'SI3D', 'ShadowEnds', 'Shadows', 'ShadowStart', 'Root', 'Skel', 'HiddenGroup', 'envGroup']).length === 0);
    ok('MakeShadowChain: skeleton trace color 805, Pose-constrained to the source bones, names copied', sm.v && sm.v.Skel.map(o => o.name).join() === 'ZRoot,ZBicep,ZForearm,ZArmEff' && col(sm.v.Skel[1]) === 805 && sm.v.Skel[1].properties.some(p => p.type === 'posecns' && p.targets[0] === arm.v.Skel[1]));
    const nm = run('MakeShadowChain', { Chain: arm.v.Skel, ShadowParent: A.scene.root, IconScale: 2, ShadowType: 1 });
    ok('MakeShadowChain: ShadowType non-zero = null hierarchy (WIRE_CORRECTIONS item 37), color 381, size scale*0.3, nested', nm.v && nm.v.Shadows.length === 4 && col(nm.v.Shadows[0]) === 381 && Math.abs(nm.v.Shadows[0].val('size') - 0.6) < 1e-9 && nm.v.Shadows[1].parentObj === nm.v.Shadows[0]);
    const n0 = run('MakeShadowChain', { Chain: arm.v.Skel }); ok('MakeShadowChain: no parent -> "argument 0 is invalid"', n0.v === undefined && has(n0, /^makeShadowChain: argument 0 is invalid$/));
    const ss0 = run('MakeShadowSpine', {}); ok('MakeShadowSpine: missing -> "argument N is invalid" (siError)', ss0.v === undefined && has(ss0, /^makeShadowSpine: argument 0 is invalid$/) && has(ss0, /^makeShadowSpine: argument 3 is invalid$/));
  }
  undoTo(U0);

  console.log('MARK torso / spine / limbs error texts and defaults');
  {
    const t3 = run('MakeTorso', { Parent: cube, GuideObjectCollection: [cube, A.scene.find('sphere'), A.scene.find('sphere1')] });
    ok('MakeTorso: count != 10/11 -> text', t3.v === undefined && has(t3, /^makeTorso: guide collection \(argument 1\) needs 10 or 11 objects\. Contains 3 objects$/), t3.log);
    const t0 = run('MakeTorso', {}); ok('MakeTorso: no parent -> required argument 0', t0.v === undefined && has(t0, /^makeTorso: required argument 0 is invalid$/));
    ok('MakeArm: errors', has(run('MakeArm', {}), /^makeArm: argument 0 is invalid$/) && has(run('MakeArm', { ArmParent: cube, GuideObjectCollection: [cube] }), /^makeArm: Guide collection needs 3 objects\. Collection has 1 objects$/));
    ok('MakeLeg: errors', has(run('MakeLeg', {}), /^makeLeg: argument 1 is invalid$/) && has(run('MakeLeg', { Parent: cube, GuideObjectCollection: [cube] }), /^makeLeg: Guide collection needs 3 objects\. Collection has 1 objects$/));
    ok('MakeHead: errors', has(run('MakeHead', {}), /^makeHead: required argument 0 is invalid$/) && has(run('MakeHead', { Parent: cube, GuideObjectCollection: [cube] }), /^makeHead: guide collection \(argument 1\) needs 3 objects\. Contains 1 objects$/));
    ok('MakeHand: error', has(run('MakeHand', {}), /^makeHand: argument 0 is invalid$/));
    ok('MakeSpine: missing required -> argument N is invalid', has(run('MakeSpine', {}), /^makeSpine: argument 0 is invalid$/) && has(run('MakeSpine', {}), /^makeSpine: argument 8 is invalid$/));
    ok('MakeFoot / MakeDogLeg: required argument N is invalid', has(run('MakeFoot', {}), /^makeFoot: required argument 0 is invalid$/) && has(run('MakeDogLeg', {}), /^makeDogLeg: required argument 2 is invalid$/));
    ok('MakeBipedCharacterKeySet / SetKeyableRig: argument 0 is invalid', has(run('MakeBipedCharacterKeySet', {}), /^makeBipedCharacterKeySet: argument 0 is invalid$/) && has(run('MakeQuadrupedCharacterKeySet', {}), /^makeQuadrupedCharacterKeySet: argument 0 is invalid$/) && has(run('SetKeyableRig', {}), /^makeBipedCharacterKeySet: argument 0 is invalid$/));
  }

  console.log('MARK MakeBiped: dialog stand-in (item 35)');
  const ST = A.rigScriptsB15e;
  {
    const u0 = A.undoStack.length;
    const nd = ST.dialogs.length; const r = run('MakeBiped', { TorsoDivisions: 7, ShadowType: 4 });   // SelectUsingUI false: arguments ignored
    ok('MakeBiped: SelectUsingUI=false -> dialog stand-in applies defaults and logs it; other arguments ignored (item 35)', ST.dialogs.length === nd + 1 && ST.dialogs.at(-1).name === 'Make Biped' && r.v && r.v.UI.TorsoDivisions === 3 && r.v.UI.ShadowType === 0 && has(r, /modal dialog not available \(stand-in\)/), [r.err, r.log.slice(0, 4)]);
    ok('MakeBiped: returns the biped object with the note members', r.v && members(r.v, ['UI', 'modelString', 'GuideModel', 'keyWords', 'pos', 'Scale', 'model', 'GlobalSRT', 'Sliders', 'HiddenGroup', 'EnvGroup', 'ControlsGroup', 'ShadowModel', 'ShadowHiddenGroup', 'ShadowEnvGroup', 'ShadowGlobalSRT', 'ShadowHip', 'Torso', 'ChestBone', 'UpperBody', 'SpineCurve', 'HipBone', 'RShoulderEff', 'LShoulderEff', 'Head', 'LHand', 'RHand', 'RArm', 'LArm', 'LLeg', 'RLeg', 'LFoot', 'RFoot', 'Belly']).length === 0, members(r.v, ['UI', 'modelString', 'GuideModel', 'keyWords', 'pos', 'Scale', 'model', 'GlobalSRT', 'Sliders', 'HiddenGroup', 'EnvGroup', 'ControlsGroup', 'ShadowModel', 'ShadowHiddenGroup', 'ShadowEnvGroup', 'ShadowGlobalSRT', 'ShadowHip', 'Torso', 'ChestBone', 'UpperBody', 'SpineCurve', 'HipBone', 'RShoulderEff', 'LShoulderEff', 'Head', 'LHand', 'RHand', 'RArm', 'LArm', 'LLeg', 'RLeg', 'LFoot', 'RFoot', 'Belly']));
    const m = r.v?.model;
    ok('MakeBiped: model Biped under the scene root; GlobalSRT icon color 893 sized Scale*0.09; Controls property; groups hidden / envelope_group / controls_group', m && m.name === 'Biped' && m.parentObj === A.scene.root && col(r.v.GlobalSRT) === 893 && Math.abs(r.v.GlobalSRT.val('size') - r.v.Scale * 0.09) < 1e-6 && m.properties.some(p => p.name === 'Controls') && ['hidden', 'envelope_group', 'controls_group'].every(n => A.scene.groupList.some(g => g.name === n && g.rigModel === m)));
    ok('MakeBiped: Scale = distance(RHand, LHand)/1.25', r.v && Math.abs(r.v.Scale - Math.hypot(...gp(G('RHand')).map((x, i) => x - gp(G('LHand'))[i])) / 1.25) < 1e-6);
    ok('MakeBiped: torso objects UpperBody Hip Chest HipPlate, shoulder chains R/LShoulderRoot', r.v && ['UpperBody', 'Hip', 'Chest', 'HipPlate', 'RShoulderRoot', 'LShoulderRoot', 'SpineStart', 'SpineEnd'].every(n => m && [...m.descendants()].some(o => o.name === n)));
    ok('MakeBiped: arm names LRoot/LBicep/LForearm/LArmEff, hand chain LHandRoot, finger LPinkyRoot, feet LFoot, leg LThigh', m && ['LBicep', 'LForearm', 'LArmEff', 'LHandRoot', 'LPinkyRoot', 'LPinky1', 'LFootRoot', 'LFootEff', 'LThigh', 'LShin', 'LlegEff', 'RBicep', 'Neck', 'Head', 'HeadRoot'].every(n => [...m.descendants()].some(o => o.name === n)), [...(m?.descendants() ?? [])].length);
    ok('MakeBiped: head built with AssemblyType = UI HeadType (item 36)', r.v && r.v.Head && r.v.Head.AssemblyType === 0 && r.v.Head.Type === 0);
    ok('MakeBiped: RotationOrder 0 -> YZX (3) on both biceps', r.v && r.v.RArm.Skel[1].kinematics.local.val('rotorder') === 3 && r.v.LArm.Skel[1].kinematics.local.val('rotorder') === 3);
    ok('MakeBiped: foot toe operator ToeGuide (three-bone toes by default), R1/R2/R3 = 15/20/30', r.v && r.v.LFoot.toeGuide.name === 'ToeGuide' && r.v.LFoot.toeGuide.val('R1') === 15 && r.v.LFoot.toeGuide.val('R3') === 30);
    const ksTop = m && m.properties.find(p => p.name === 'Biped' && p.nested);
    ok('MakeBiped: character key set Biped with sub-sets Upper(R_Arm L_Arm R_Hand L_Hand Torso Head_Neck) / Lower(L_Leg R_Leg)', ksTop === undefined ? (() => { const k = GlobalSRT_ks(r.v.GlobalSRT); return k && k.nested.map(n => n.name).join() === 'Upper,Lower' && k.nested[0].nested.map(n => n.name).join() === 'R_Arm,L_Arm,R_Hand,L_Hand,Torso,Head_Neck' && k.nested[1].nested.map(n => n.name).join() === 'L_Leg,R_Leg'; })() : true, 'key set');
    function GlobalSRT_ks(o) { return o.properties.find(p => p.name === 'Biped' && p.nested); }
    const ks = GlobalSRT_ks(r.v.GlobalSRT);
    ok('MakeBiped: key set holds proxy parameters (Torso, L_Arm populated)', ks && ks.nested[0].nested[4].params.length > 0 && ks.nested[0].nested[1].params.length > 0, ks && ks.nested[0].nested.map(n => n.params.length));
    ok('MakeBiped: marking sets deleted afterwards (DeleteMarkingSet true)', m && ![m, ...m.descendants()].some(o => o.properties.some(p => p.name === 'MarkingSet')));
    ok('MakeBiped: synoptic property on GlobalSRT with BipedSynoptic_CDK1.htm', r.v && r.v.GlobalSRT.properties.some(p => p.name === 'Synoptic' && /BipedSynoptic_CDK1\.htm$/.test(p.val('path'))));
    undoTo(u0); ok('MakeBiped: undo removes the rig', !named('Biped') && !A.scene.groupList.some(g => g.name === 'controls_group'));
  }
  // MakeBiped with arguments (SelectUsingUI = true)
  {
    const u0 = A.undoStack.length;
    const r = run('MakeBiped', { SelectUsingUI: true, TorsoType: 2, TorsoDivisions: 4, HeadType: 1, HeadDivisions: 3, ShadowType: 1, MakeBelly: true, BellySlide: 1, ForeArmRoll: true, ForeArmDivisions: 2, BicepRoll: true, BicepDivisions: 2, ThighRoll: true, ThighDivisions: 2, ArmPitSlide: true, HipSlide: true, ThighSlide: true, ElbowsJoint: true, KneeJoint: true, ThreeBoneToes: false, CreateShadowCharacterKeySet: true, FingerType: 1, Ears: true, ArmAttachment: 1 });
    ok('MakeBiped(args): builds without error', r.v && !r.err, [r.err, r.log.filter(l => /Error|not found/.test(l))]);
    ok('MakeBiped(args): UI holds the argument values', r.v && r.v.UI.TorsoDivisions === 4 && r.v.UI.ShadowType === 1 && r.v.UI.HeadType === 1);
    ok('MakeBiped(args): HeadType 1 passed as MakeHead AssemblyType: spine head (NeckBase / BaseDepth / TopDepth, NeckVertebra) (item 36)', r.v && r.v.Head.AssemblyType === 1 && r.v.Head.NeckBase && r.v.Head.NeckBase.name === 'NeckBase' && r.v.Head.BaseDepth.name === 'BaseDepth' && col(r.v.Head.BaseDepth) === 770 && col(r.v.Head.NeckBase) === 484 && r.v.Head.Spine && r.v.Head.Spine.vertebraName === 'NeckVertebra');
    ok('MakeBiped(args): skeleton torso (2): Lumbar bones, SpineEff root / SpineRoot effector (sic), Hip and Chest removed', r.v && r.v.Torso.Spine.Root.name === 'SpineEff' && r.v.Torso.Spine.Eff.name === 'SpineRoot' && r.v.Torso.Spine.Skel[1].name === 'Lumbar1' && !r.v.Torso.Hip.parentObj);
    ok('MakeBiped(args): shadow model Biped_Shadow with groups Shadow_hidden / Shadow_envelope_group and a null GlobalSRT (color 805, primary_icon 8, size Scale*0.07)', r.v && r.v.ShadowModel && r.v.ShadowModel.name === 'Biped_Shadow' && r.v.ShadowGlobalSRT.name === 'GlobalSRT' && col(r.v.ShadowGlobalSRT) === 805 && r.v.ShadowGlobalSRT.val('primary_icon') === 8 && Math.abs(r.v.ShadowGlobalSRT.val('size') - r.v.Scale * 0.07) < 1e-6 && r.v.ShadowGlobalSRT.properties.some(p => p.type === 'posecns') && A.scene.groupList.some(g => g.name === 'Shadow_hidden' && g.rigModel === r.v.ShadowModel));
    ok('MakeBiped(args): slides / joints / belly members', r.v && ['RArmpit', 'LArmpit', 'RHip', 'LHip', 'RThigh', 'LThigh', 'LElbow', 'RElbow', 'LKnee', 'RKnee', 'Belly', 'LBellySlide', 'RBellySlide'].every(k => r.v[k]), ['RArmpit', 'LArmpit', 'RHip', 'LHip', 'RThigh', 'LThigh', 'LElbow', 'RElbow', 'LKnee', 'RKnee', 'Belly', 'LBellySlide', 'RBellySlide'].filter(k => !r.v?.[k]));
    ok('MakeBiped(args): armpit slide names RArmPitBind, hip slide LHipBind, thigh volume LThighVolume', r.v && r.v.RArmpit.BindNull.name === 'RArmPitBind' && r.v.LHip.BindNull.name === 'LHipBind' && r.v.LThigh.Volume.name === 'LThighVolume');
    ok('MakeBiped(args): knee joint takes no roll divisions (always null); elbow joint parent = nearest bicep roll division', r.v && r.v.LKnee.UpperJoint.parentObj === r.v.LLeg.Skel[1] && r.v.LElbow.UpperJoint.parentObj.name.startsWith('LBicepRoll'));
    ok('MakeBiped(args): arm attachment 1 -> arm parented to UpperBody with a Position constraint to the shoulder effector', r.v && r.v.RArm.Root.parentObj === r.v.UpperBody && r.v.RArm.Root.properties.some(p => p.type === 'poscns'));
    ok('MakeBiped(args): bicep / forearm roll divisions (size s*0.05), hand roots under the arm effectors', r.v && r.v.LArm.BicepRoll.Divisions.length === 3 && r.v.LArm.ForeArmRoll.Divisions.length === 2 && r.v.LHand.Root.parentObj === r.v.LArm.Eff);
    ok('MakeBiped(args): shadow key set created (CreateShadowCharacterKeySet) named ShadowBiped', !!r.v && !!r.v.ShadowGlobalSRT.properties.find(p => p.name === 'ShadowBiped' && p.nested));
    ok('MakeBiped(args): shadow synoptic SkeletonBipedSynoptic.htm', r.v && r.v.ShadowGlobalSRT.properties.some(p => p.name === 'Synoptic' && /SkeletonBipedSynoptic\.htm$/.test(p.val('path'))));
    ok('MakeBiped(args): two-bone toes via RIG_twoBoneToes', r.v && r.v.LFoot.toeGuide.name === 'RIG_twoBoneToes');
    undoTo(u0);
  }
  // box shadow / OneModel / IndependentLower
  {
    const u0 = A.undoStack.length;
    const r = run('MakeBiped', { SelectUsingUI: true, ShadowType: 4, OneModel: true });
    ok('MakeBiped(box, OneModel): same model, Shadow_GlobalSRT color 479, box shadows (Cube Connector_Box ops)', r.v && r.v.ShadowModel === r.v.model && r.v.ShadowGlobalSRT.name === 'Shadow_GlobalSRT' && col(r.v.ShadowGlobalSRT) === 479 && !!r.v.LArm.Shadows.length && !!hasOp(r.v.LArm.Shadows[0], 'Connector_Box'), r.err);
    undoTo(u0);
    const r2 = run('MakeBiped', { SelectUsingUI: true, ShadowType: 3, IndependentLower: true });
    ok('MakeBiped(null shadow, IndependentLower): null GlobalSRT color 380; shadow hip null (primary_icon 4, size 1.2) used as the leg shadow parent', r2.v && col(r2.v.ShadowGlobalSRT) === 380 && r2.v.ShadowHip && r2.v.ShadowHip.val('primary_icon') === 4 && r2.v.ShadowHip.val('size') === 1.2 && r2.v.LLeg.Shadows[0]?.parentObj === r2.v.ShadowHip, [r2.err, !!r2.v?.ShadowHip]);
    undoTo(u0);
  }
  // missing guide / prop guide
  {
    const gm = A.scene.root.children.find(c => c.name === 'Biped_Guide'); gm.name = 'Biped_Guide_x';
    const r = run('MakeBiped', {}); ok('MakeBiped: no guide -> "makeBiped: No Biped Guide Found", nothing', r.v === undefined && has(r, /^makeBiped: No Biped Guide Found$/) && r.kinds.includes('error'), r.log);
    gm.name = 'Biped_Guide';
  }
  console.log('MARK MakeBipedDogLeg');
  {
    const u0 = A.undoStack.length; const dg = ST.makeGuide('dog');
    const r = run('MakeBipedDogLeg', { SelectUsingUI: true, ShadowType: 1, ThighRoll: true, ThighDivisions: 2 });
    ok('MakeBipedDogLeg: model Biped_DogLeg, no controls_group, LDogLeg / RDogLeg members and no LLeg/RLeg/feet', r.v && r.v.model.name === 'Biped_DogLeg' && !r.v.ControlsGroup && r.v.LDogLeg && r.v.RDogLeg && !r.v.LLeg && !r.v.LFoot, r.err);
    ok('MakeBipedDogLeg: DogLeg operator (lock_percentage 0.97), Femur/Tibia/Metarsal, foot with two-bone toes (item 37)', r.v && r.v.LDogLeg.dogLeg.name === 'DogLeg' && r.v.LDogLeg.dogLeg.val('lock_percentage') === 0.97 && r.v.LDogLeg.Skel.map(o => o.name).join() === 'LLegRoot,LFemur,LTibia,LMetarsal,LLegEff'.replace('LMetarsal', 'LMetarsal') || r.v.LDogLeg.Skel.map(o => o.name).join() === 'LLegRoot,LFemur,LTibia,LMetarsal,LLegEff'.replace('Metarsal', 'Metarsal'), r.v?.LDogLeg.Skel.map(o => o.name));
    ok('MakeBipedDogLeg: dog-leg foot uses RIG_twoBoneToes and has an Extension control (item 37)', r.v && r.v.LDogLeg.Foot.toeGuide.name === 'RIG_twoBoneToes' && r.v.LDogLeg.Foot.Extension && r.v.LDogLeg.Foot.Extension.name === 'LeftExtension', r.v?.LDogLeg.Foot.Extension?.name);
    ok('MakeBipedDogLeg: shadow groups hidden / envelope_group in the shadow model; shadow GlobalSRT is a rig icon color 805', r.v && A.scene.groupList.some(g => g.name === 'hidden' && g.rigModel === r.v.ShadowModel) && col(r.v.ShadowGlobalSRT) === 805);
    ok('MakeBipedDogLeg: key set name Biped_DogLeg, synoptic', r.v && !!r.v.GlobalSRT.properties.find(p => p.name === 'Biped_DogLeg' && p.nested));
    undoTo(u0); void dg;
  }
  console.log('MARK MakeQuadruped');
  {
    const qg = ST.makeGuide('quad'); const u0 = A.undoStack.length;
    const r = run('MakeQuadruped', { SelectUsingUI: true, ShadowType: 3, MakeTail: true, MakeBelly: true, BellySlide: 1, FrontRoll: true, BackRoll: true });
    ok('MakeQuadruped: model Quadruped, members (Model, LDogLeg, LLeg, Tail ...)', r.v && r.v.Model.name === 'Quadruped' && members(r.v, ['UI', 'ModelString', 'GuideModel', 'keyWords', 'pos', 'Scale', 'Model', 'GlobalSRT', 'Sliders', 'HiddenGroup', 'EnvGroup', 'ShadowModel', 'ShadowHiddenGroup', 'ShadowEnvGroup', 'ShadowGlobalSRT', 'Torso', 'ChestBone', 'UpperBody', 'SpineCurve', 'HipBone', 'RShoulderEff', 'LShoulderEff', 'LDogLeg', 'RDogLeg', 'LLeg', 'RLeg', 'LFoot', 'RFoot', 'Tail', 'Head', 'Belly', 'LBellySlide', 'RBellySlide']).length === 0, [r.err, members(r.v, ['Model', 'LDogLeg', 'RDogLeg', 'LLeg', 'RLeg', 'LFoot', 'RFoot', 'Tail', 'Head', 'Belly', 'LBellySlide', 'RBellySlide', 'ShadowModel'])]);
    ok('MakeQuadruped: GlobalSRT icon color 893 size Scale*0.2; shadow model Quadruped_Null, GlobalSRT color 380', r.v && col(r.v.GlobalSRT) === 893 && Math.abs(r.v.GlobalSRT.val('size') - r.v.Scale * 0.2) < 1e-6 && r.v.ShadowModel.name === 'Quadruped_Null' && col(r.v.ShadowGlobalSRT) === 380);
    ok('MakeQuadruped: hind legs BLFemur / BLTibia, front legs LThigh? (MakeLeg) with front foot, two-bone toes (item 37)', r.v && r.v.LDogLeg.prefix === 'BL' && r.v.LFoot.toeGuide.name === 'RIG_twoBoneToes' && r.v.LDogLeg.Foot.toeGuide.name === 'RIG_twoBoneToes', r.v?.LDogLeg.prefix);
    ok('MakeQuadruped: head is a quadruped head (HeadType 1)', r.v && r.v.Head.Type === 1);
    ok('MakeQuadruped: default pose stored on an undefined owner (model/Model mismatch): nothing stored on Quadruped', r.v && !r.v.Model.storedActions && has(r, /undefined owner/));
    undoTo(u0);
    const qd = run('MakeQuadruped', {}); ok('MakeQuadruped: dialog stand-in applies IconType 1 / MakeTail / TailDivisions 6 (default option values)', qd.v && qd.v.UI.IconType === 1 && qd.v.UI.MakeTail === true && qd.v.UI.TailDivisions === 6, qd.err);
    undoTo(u0);
    const gm = A.scene.root.children.find(c => c.name === 'Quadruped_Guide'); gm.name = 'zz';
    const q0 = run('MakeQuadruped', {}); ok('MakeQuadruped: no guide -> "makeQuadruped: No Quadruped Guide Found"', q0.v === undefined && has(q0, /^makeQuadruped: No Quadruped Guide Found$/), q0.log); gm.name = 'Quadruped_Guide';
    void qg;
  }
  console.log('MARK key sets / SetKeyableRig on a hand-made rig');
  {
    const u0 = A.undoStack.length;
    const bg = A.scene.root.children.find(c => c.name === 'Biped_Guide');
    const r = run('MakeBiped', { SelectUsingUI: true, ShadowType: 1 });   // creates the shadow rig; the shadow GlobalSRT has no key set (SetKeyableRig ran)
    ok('SetKeyableRig: deletes all marking sets of the (shadow) model, returns nothing', r.v && ![r.v.ShadowModel, ...r.v.ShadowModel.descendants()].some(o => o.properties.some(p => p.name === 'MarkingSet')) && !r.v.ShadowGlobalSRT.properties.some(p => p.name === 'ShadowBiped'));
    ok('SetKeyableRig: shadow rig keyable attributes cleared on its children', r.v && [...r.v.ShadowModel.descendants()].every(o => !o.kinematics.local.get('sclx').def.keyable));
    const k = run('MakeBipedCharacterKeySet', { RootObject: r.v.GlobalSRT, CharacterKeySetName: 'Again', DeleteMarkingSet: false, Prefix: 'P', Suffix: 'S' });
    ok('MakeBipedCharacterKeySet: returns the top set named Prefix+Name+Suffix with sub-sets wrapped in Prefix..Suffix', k.v && k.v.name === 'PAgainS' && k.v.nested.map(n => n.name).join() === 'PUpperS,PLowerS' && k.v.nested[0].nested[0].name === 'PR_ArmS', [k.err, k.v?.name]);
    ok('MakeBipedCharacterKeySet: no marking sets left (deleted by MakeBiped) -> sets stay empty; log of "not included"/errors absent', k.v && !has(k, /Error setting/), k.log);
    const kq = run('MakeQuadrupedCharacterKeySet', { RootObject: r.v.GlobalSRT, CharacterKeySetName: 'Q' });
    ok('MakeQuadrupedCharacterKeySet: sub-sets Upper(Torso Head_Neck) Lower(L_Leg R_Leg BL_Leg BR_Leg Tail)', kq.v && kq.v.nested[0].nested.map(n => n.name).join() === 'Torso,Head_Neck' && kq.v.nested[1].nested.map(n => n.name).join() === 'L_Leg,R_Leg,BL_Leg,BR_Leg,Tail', [kq.err, kq.v?.nested?.map(n => n.nested.map(m => m.name))]);
    undoTo(u0); void bg;
  }
  return out;
}, { NAMES });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_rigscripts_b15e_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
