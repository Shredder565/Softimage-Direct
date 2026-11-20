// CMD-B15e (Character Rigging script commands): the 26 names of src/commands/rigScriptsB15e*.ts.
// There is no XSIBATCH golden for the row: this is a contract check against
// docs/ghidra/cmd-b15e-character-rigging-scripts.md ("Wire contract" of §3.1-3.25) and docs/re/WIRE_CORRECTIONS_B15.md
// items 35-37.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; the JScript entry where a
//      name is registered twice, GetSkeleton's C++ entry);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected throw
//      (the builders log "<fn>: argument N is invalid" and return nothing; MakeBicepRoll has no validation, so its
//      default run is a script error);
//   3. the contract's stated results: returned members, created hierarchy and names, colours, key sets, error texts,
//      dialog / SelectUsingUI behaviour (item 35), shadow-type meaning (item 37), using sample guides built by
//      app.rigScriptsB15e.buildSampleGuide (original positions; the guide names are the ones the note lists).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_rigging_b15e_commands.mjs
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
  'GetSkeleton', 'Make2PointSlide', 'MakeArm', 'MakeBelly', 'MakeBicepRoll', 'MakeBiped', 'MakeBipedCharacterKeySet', 'MakeBipedDogLeg',
  'MakeDogLeg', 'MakeFoot', 'MakeForearmRoll', 'MakeHand', 'MakeHead', 'MakeHip', 'MakeJointCompression', 'MakeLeg', 'MakeQuadruped',
  'MakeQuadrupedCharacterKeySet', 'MakeRigIcon', 'MakeShadowChain', 'MakeShadowSpine', 'MakeSpine', 'MakeThighSlide', 'MakeTorso', 'SetKeyableRig',
];
const DEFAULT_FAILS = new Set(['MakeBicepRoll']);

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const all = full.filter(x => (x.scripting_name || x.name) === n);
  const f = all.find(x => x.language === 'JScript') ?? all[0];
  if (!f) return [n, null];
  return [n, f.args.map(a => [a.name, a.default ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('MakeBiped') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const X = A.rigScriptsB15e, ST = X.state();
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B15e/.test(l));
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };
  const desc = (o) => [o, ...o.descendants()];
  const named = (root, n) => desc(root).find(o => o.name === n);
  const gpos = (o) => { const m = o.globalMatrix().elements; return [m[12], m[13], m[14]]; };
  const membersOk = (cmd, r) => { const list = X.members[cmd]; const miss = list.filter(k => !(k in (r ?? {}))); ok(`${cmd}: returned object carries the listed members (${list.length})`, r && !miss.length, miss); };
  const undoAll = (u0) => { while (A.undoStack.length > u0) A.undo(); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected; no guide in the scene)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    undoAll(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  for (const n of NAMES) ok(`${n}: category Character Rigging`, A.commands.get(n)?.category === 'Character Rigging');

  // ================= default-run messages
  {
    const r = run('MakeTorso'); ok('MakeTorso default: guide-count error text, returns nothing', r.v === undefined && has(r, /^makeTorso: guide collection \(argument 1\) needs 10 or 11 objects\. Contains 0 objects$/), r.log);
    const r2 = run('MakeArm'); ok('MakeArm default: "makeArm: argument 0 is invalid" (no severity)', r2.v === undefined && has(r2, /^makeArm: argument 0 is invalid$/) && r2.kinds.every(k => k === 'info'), r2);
    const r3 = run('MakeForearmRoll'); ok('MakeForearmRoll default: one siError line per missing argument (0-4)', r3.v === undefined && [0, 1, 2, 3, 4].every(i => has(r3, new RegExp(`^makeForearmRoll: argument ${i} is invalid$`))), r3.log);
    const r4 = run('MakeSpine'); ok('MakeSpine default: arguments 1,5,6,7,8 reported', r4.v === undefined && [1, 5, 6, 7, 8].every(i => has(r4, new RegExp(`^makeSpine: argument ${i} is invalid$`))), r4.log);
    const r5 = run('MakeHead'); ok('MakeHead default: guide-count error text', r5.v === undefined && has(r5, /^makeHead: guide collection \(argument 1\) needs 3 objects\. Contains 0 objects$/), r5.log);
    const r6 = run('SetKeyableRig'); ok('SetKeyableRig default: reuses the makeBipedCharacterKeySet error text', r6.v === undefined && has(r6, /^makeBipedCharacterKeySet: argument 0 is invalid$/), r6.log);
    const r7 = run('MakeBiped'); ok('MakeBiped default (SelectUsingUI false): dialog stand-in logged (item 35), then "No Biped Guide Found"', r7.v === undefined && nya(r7) && has(r7, /dialog/) && has(r7, /^makeBiped: No Biped Guide Found$/), r7.log);
    const r8 = run('MakeQuadruped', { SelectUsingUI: true }); ok('MakeQuadruped without guide: "makeQuadruped: No Quadruped Guide Found"', r8.v === undefined && has(r8, /^makeQuadruped: No Quadruped Guide Found$/), r8.log);
    const r9 = run('MakeHip'); ok('MakeHip without guide, cube selected: pick stand-in logged, cancelled -> nothing', r9.v === undefined && nya(r9) && has(r9, /Pick Top of Hip Position/), r9.log);
    reset(); A.select([]); const r10 = run('MakeHip'); ok('MakeHip without guide or selection: the "Hip Maker Cancel" error', r10.v === undefined && has(r10, /^Hip Maker Cancel, Requires and Object Selection to define Hip Transform$/), r10.log); reset();
    const r11 = run('MakeShadowChain', { Chain: 'cube' }); ok('MakeShadowChain without parent: "makeShadowChain: argument 0 is invalid"', r11.v === undefined && has(r11, /^makeShadowChain: argument 0 is invalid$/), r11.log);
    const r12 = run('MakeBipedCharacterKeySet'); ok('MakeBipedCharacterKeySet default: argument 0 invalid', r12.v === undefined && has(r12, /^makeBipedCharacterKeySet: argument 0 is invalid$/), r12.log);
    const r13 = run('MakeQuadrupedCharacterKeySet'); ok('MakeQuadrupedCharacterKeySet default: argument 0 invalid', r13.v === undefined && has(r13, /^makeQuadrupedCharacterKeySet: argument 0 is invalid$/), r13.log);
  }

  // ================= MakeRigIcon (§3.1)
  try {
    const u0 = A.undoStack.length;
    const r = run('MakeRigIcon'); const o = r.v;
    ok('MakeRigIcon default: one curve under the scene root, type 5 centered pyramid, colour 65', o && o.type === 'crvlist' && o.parentObj === A.scene.root && X.wireColor(o) === 65 && o.rigIconType === 5, o?.name);
    const cv = o.primitive.curve(); const ys = cv.cvs.map(p => p[1]);
    ok('MakeRigIcon type 5: centred (y from -Yl/2 to +Yl/2), linear', cv.degree === 1 && near(Math.min(...ys), -0.5) && near(Math.max(...ys), 0.5), ys);
    const o2 = run('MakeRigIcon', { Parent: o, Type: 4, X: 2, Y: 3, Z: 4, Ylength: 2, Color: 12, Name: 'Pyr' }).v;
    const p2 = gpos(o2); ok('MakeRigIcon: global transform is a pure translation to (X,Y,Z), under Parent, named', o2.parentObj === o && near(p2[0], 2) && near(p2[1], 3) && near(p2[2], 4) && o2.name === 'Pyr', p2);
    const ys2 = o2.primitive.curve().cvs.map(p => p[1]); ok('MakeRigIcon type 4: pyramid base at 0, apex at Ylength', near(Math.min(...ys2), 0) && near(Math.max(...ys2), 2), ys2);
    const o3 = run('MakeRigIcon', { Type: 3, XOffset: 1, YOffset: 0, ZOffset: 0 }).v; const xs3 = o3.primitive.curve().cvs.map(p => p[0]);
    ok('MakeRigIcon: offset ignored unless all three offsets are non-zero', near(Math.min(...xs3), -0.5), xs3);
    const o4 = run('MakeRigIcon', { Type: 3, XOffset: 1, YOffset: 1, ZOffset: 1 }).v; const xs4 = o4.primitive.curve().cvs.map(p => p[0]);
    ok('MakeRigIcon: offset added to every point when all three are non-zero', near(Math.min(...xs4), 0.5), xs4);
    const o5 = run('MakeRigIcon', { Type: 9, Xlength: 0, Ylength: 0, Zlength: 0, Color: 0 }).v;
    ok('MakeRigIcon type 9: sphere of three curves, default name, no Display colour when Color is 0', o5.name.startsWith('Sphere') && o5.primitive.curve().subcurves.length === 2 && X.wireColor(o5) === undefined, [o5.name, X.wireColor(o5)]);
    const o6 = run('MakeRigIcon', { Type: 2 }).v; const ys6 = o6.primitive.curve().cvs.map(p => p[1]);
    ok('MakeRigIcon type 2: cube resting on its base (Y 0..Ylength)', near(Math.min(...ys6), 0) && near(Math.max(...ys6), 1), ys6);
    const r7 = run('MakeRigIcon', { Type: 42 }); ok('MakeRigIcon: unknown Type creates nothing, returns undefined', r7.v === undefined && !r7.err);
    undoAll(u0);
  } catch (e) { ok('MakeRigIcon block', false, String(e)); }

  // ================= small builders on a hand-made chain
  try {
    const u0 = A.undoStack.length;
    const model = A.scene.root; void model;
    const chain = A.run('Create2DSkeleton', { Points: [[0, 10, 0], [3, 10, -0.5], [6, 10, 0]] });
    const [b1, b2] = chain.bones;
    const sk = run('GetSkeleton', { InputObj: b2 }); ok('GetSkeleton: skeleton collection root, bones, effector; Index of the element', Array.isArray(sk.v) && sk.v.length === 4 && sk.v[0] === chain && ST.lastGetSkeleton.Index === 2, [sk.v?.length, ST.lastGetSkeleton?.Index]);
    const br = run('MakeBicepRoll', { Bicep: b1, Prefix: 'T', NbDivisions: 3 }).v;
    ok('MakeBicepRoll: {Nb, Divisions}; n+1 nulls T Roll1..3 + TRoll_4', br.Nb === 3 && br.Divisions.length === 4 && br.Divisions.map(d => d.name).join() === 'TRoll1,TRoll2,TRoll3,TRoll_4', br.Divisions.map(d => d.name));
    const L = 4 / 5; const ops = br.Divisions.slice(0, 3).map(d => X.opsOn(d, 'FirstBoneRollDivisionRO')[0]);
    ok('MakeBicepRoll: FirstBoneRollDivisionRO length_perc = L(i-1)/n, mySlerp = i/(n+2), L=(n+1)/(n+2)', ops.every((op, i) => near(op.val('length_perc'), L * i / 3) && near(op.val('mySlerp'), (i + 1) / 5)), ops.map(op => [op.val('length_perc'), op.val('mySlerp')]));
    ok('MakeBicepRoll: dividers under the bicep\'s parent, last one a child of the bicep, colour 421', br.Divisions.slice(0, 3).every(d => d.parentObj === chain) && br.Divisions[3].parentObj === b1 && br.Divisions.every(d => X.wireColor(d) === 421));
    ok('MakeBicepRoll: last null posx expression = bone length x L', near(br.Divisions[3].kinematics.local.val('posx'), b1.val('length') * L) && /length/.test(br.Divisions[3].kinematics.local.get('posx').expression));
    const hand = A.run('Create2DSkeleton', { Points: [[6, 10, 0], [7, 10, 0]] });
    const fr = run('MakeForearmRoll', { Bicep: b1, Forearm: b2, ArmEff: chain.effector, HandEff: hand.effector, HandBone: hand.bones[0], Prefix: 'T', NbDivisions: 3, RollOffset: 90 }).v;
    ok('MakeForearmRoll: {Sliders, RollOffset, Nb, Divisions}; Roll_Compensation.roll_offset = RollOffset', fr.Sliders.name === 'Roll_Compensation' && fr.RollOffset.value === 90 && fr.Nb === 3 && fr.Divisions.length === 3, fr.Sliders?.name);
    ok('MakeForearmRoll: first null TElbow, others TForearmRoll, under the forearm, blend 1-i/n, colour 544', fr.Divisions[0].name === 'TElbow' && fr.Divisions[1].name.startsWith('TForearmRoll') && fr.Divisions.every(d => d.parentObj === b2 && X.wireColor(d) === 544) && fr.Divisions.every((d, i) => near(X.opsOn(d, 'ForeArmRollDivision')[0].val('blend'), 1 - i / 3)), fr.Divisions.map(d => d.name));
    const g1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'gA' }), g2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'gB' }); g2.kinematics.local.set('posy', 2);
    const sl = run('Make2PointSlide', { Prefix: 'S', GuidePoint1: g1, GuidePoint2: g2, Parent1: b1, Parent2: b2 }).v;
    ok('Make2PointSlide: SBind / STop under Parent1, SBase under Parent2, colours 748/472/472, sizes d x 0.1/0.05', sl.BindNull.name === 'SBind' && sl.TopNull.parentObj === b1 && sl.BaseNull.parentObj === b2 && X.wireColor(sl.BindNull) === 748 && X.wireColor(sl.TopNull) === 472 && near(sl.BindNull.val('size'), 0.2) && near(sl.TopNull.val('size'), 0.1), [sl.BindNull.name]);
    ok('Make2PointSlide: Bind has a TwoPoints constraint to (Top, Base)', sl.Constraint && sl.Constraint.TwoPoints && sl.Constraint.targets[0] === sl.TopNull && sl.Constraint.targets[1] === sl.BaseNull);
    membersOk('Make2PointSlide', sl);
    const rs = run('Make2PointSlide', { Prefix: 'S', GuidePoint1: g1 }); ok('Make2PointSlide: "make2PointSlide: argument N is invalid" for 2,3,4', rs.v === undefined && [2, 3, 4].every(i => has(rs, new RegExp(`^make2PointSlide: argument ${i} is invalid$`))), rs.log);
    const gs = ['jc1', 'jc2', 'jc3', 'jc4'].map((n, i) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: n }); o.kinematics.local.set('posx', 2.6 + 0.4 * (i % 2)); o.kinematics.local.set('posy', 10.2 - 0.1 * i); return o; });
    const jc = run('MakeJointCompression', { Prefix: 'E', UpperBone: b1, LowerBone: b2, GuideObjectCollection: gs }).v;
    ok('MakeJointCompression: EBendVolume under LowerBone, EUpperJoint/ELowerJoint under UpperBone (no roll divisions), colours 728/748', jc.Volume.name === 'EBendVolume' && jc.Volume.parentObj === b2 && jc.UpperJoint.parentObj === b1 && jc.LowerJoint.name === 'ELowerJoint' && X.wireColor(jc.Volume) === 728 && X.wireColor(jc.UpperJoint) === 748, [jc.UpperJoint?.parentObj?.name]);
    const jc2 = run('MakeJointCompression', { Prefix: 'F', UpperBone: b1, LowerBone: b2, GuideObjectCollection: gs, RollDivisionCollection: br.Divisions }).v;
    const closest = br.Divisions.reduce((b, r) => (Math.hypot(...gpos(r).map((v, k) => v - gpos(gs[0])[k])) < Math.hypot(...gpos(b).map((v, k) => v - gpos(gs[0])[k])) ? r : b));
    ok('MakeJointCompression: with roll divisions the joints go under the division closest to the upper target', jc2.UpperJoint.parentObj === closest, [jc2.UpperJoint.parentObj?.name, closest.name]);
    membersOk('MakeJointCompression', jc);
    const ts = ['t0', 't1', 't2', 't3', 't4'].map((n, i) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: n }); const p = [[0.8, 9.6, -0.8], [0.9, 8.4, -0.7], [1.3, 9.2, 0], [1, 9.8, 0], [1, 5.4, 0.4]][i]; ['posx', 'posy', 'posz'].forEach((k, j) => o.kinematics.local.set(k, p[j])); return o; });
    const th = run('MakeThighSlide', { Prefix: 'L', GuideObjectCollection: ts, UpperParent: b1, LowerParent: b2 }).v;
    ok('MakeThighSlide: LThighVolume sphere under LowerParent (colour 728) + a 2-point slide L*', th.Volume.name === 'LThighVolume' && th.Volume.parentObj === b2 && X.wireColor(th.Volume) === 728 && th.BindNull?.name === 'LBind', th.Volume?.name);
    membersOk('MakeThighSlide', th);
    const sc = run('MakeShadowChain', { Chain: chain, ShadowParent: A.scene.root, IconScale: 0, ShadowType: 0, ShadowCharacterSetName: 'X' });
    ok('MakeShadowChain: scale 0 warning; skeleton trace with the source names, colour 805, bones Pose-constrained', has(sc, /shadow scale cannot be zero, using scale of 1\.0/) && sc.v.Skel.length === 4 && sc.v.Skel.slice(1, 3).every((b, i) => b.name.startsWith(chain.bones[i].name) && X.wireColor(b) === 805 && b.properties.some(p => p.type === 'posecns') && Math.hypot(...gpos(b).map((v, k) => v - gpos(chain.bones[i])[k])) < 1e-4), sc.v?.Skel?.map(o => o.name));
    const sn = run('MakeShadowChain', { Chain: chain, ShadowParent: A.scene.root, ShadowType: 1 }).v;
    ok('MakeShadowChain: ShadowType non-zero = null hierarchy (item 37): one nested null per bone, colour 381', sn.Skel.length === 2 && sn.Skel.every(o => o.type === 'null' && X.wireColor(o) === 381) && sn.Skel[1].parentObj === sn.Skel[0], sn.Skel.map(o => o.type));
    membersOk('MakeShadowChain', sn);
    const hip = run('MakeHip', { GuideObj: g1, TopX: 0, TopY: 1, TopZ: 0, SideX: 1, SideY: 0, SideZ: 0 }).v;
    ok('MakeHip with guide: HipPlate curve under the scene root, colour 49, HipIcon operator with the stated values', hip.name === 'HipPlate' && hip.parentObj === A.scene.root && X.wireColor(hip) === 49 && (() => { const op = X.opsOn(hip, 'HipIcon')[0]; return op && op.val('height') === 1.3 && op.val('cap_width') === 0.25 && op.val('width') === 0.7; })(), hip?.name);
    const bl = run('MakeBelly', { HipObject: b1, VertebraObject: b2, GuideObjectCollection: [g1] });
    ok('MakeBelly: guide count != 2 logs the message then a script error', !!bl.err && has(bl, /^makeBelly: Guide collection needs 2 objects/), bl.log);
    undoAll(u0);
  } catch (e) { ok('small builders block', false, String(e?.stack ?? e)); }

  // ================= MakeBiped (§3.2) on the sample guide, SelectUsingUI true
  try {
    const u0 = A.undoStack.length;
    const guide = X.buildSampleGuide('biped');
    const r = run('MakeBiped', { SelectUsingUI: true }); const b = r.v;
    ok('MakeBiped (SelectUsingUI true): runs without error and returns the biped object', !r.err && b && typeof b === 'object', r.err ?? r.log.filter(l => /rror/.test(l)));
    membersOk('MakeBiped', b);
    ok('MakeBiped: model Biped under the scene root, GlobalSRT pyramid (type 4) colour 893', b.model.name === 'Biped' && b.model.parentObj === A.scene.root && b.GlobalSRT.name === 'GlobalSRT' && b.GlobalSRT.rigIconType === 4 && X.wireColor(b.GlobalSRT) === 893);
    const groups = X.groupsOf(b.model).map(g => g.name).sort();
    ok('MakeBiped: groups hidden (viewvis 0), envelope_group, controls_group (with GlobalSRT)', groups.join() === 'controls_group,envelope_group,hidden' && b.HiddenGroup.val('viewvis') === false && b.ControlsGroup.members.includes(b.GlobalSRT), groups);
    ok('MakeBiped: Controls custom property on the model', b.Sliders?.name === 'Controls' && b.model.properties.includes(b.Sliders));
    ok('MakeBiped: Scale = |RHand - LHand| / 1.25', near(b.Scale, 14 / 1.25), b.Scale);
    ok('MakeBiped: no shadow rig with ShadowType 0', b.ShadowModel === null && b.ShadowGlobalSRT === null);
    const t = b.Torso; membersOk('MakeTorso', t);
    ok('MakeTorso: UpperBody / Hip / Chest controls, HipPlate (49) with HipIcon, SpineStart / SpineEnd, HipDepth (770) / ChestDepth (253)', t.UpperBody.name === 'UpperBody' && t.Hip.parentObj === t.UpperBody && t.Chest.parentObj === t.UpperBody && t.HipBone.name === 'HipPlate' && t.HipBone.parentObj === t.Hip && X.wireColor(t.HipBone) === 49 && t.spineEnd.parentObj === t.Chest && X.wireColor(t.HipDepth) === 770 && X.wireColor(t.ChestDepth) === 253);
    ok('MakeTorso: control colours UpperBody 253, Hip 770, Chest 253', X.wireColor(t.UpperBody) === 253 && X.wireColor(t.Hip) === 770 && X.wireColor(t.Chest) === 253);
    ok('MakeTorso: shoulders LShoulderRoot / LShoulder / LShoulderEff, bone colour 489, under the spine top', t.lroot.name === 'LShoulderRoot' && t.LSkel[1].name === 'LShoulder' && t.LEff.name === 'LShoulderEff' && X.wireColor(t.LSkel[1]) === 489 && t.lroot.parentObj === b.ChestBone, [t.lroot.name, t.lroot.parentObj?.name]);
    const sp = t.Spine; membersOk('MakeSpine', sp);
    ok('MakeSpine (from MakeTorso): spinecurve (49) under HipPlate, SpineCurve op lgoal = length, ChestBone with chestBone op (11th guide), 3 vertebrae SpineVertebra', sp.Curve.name === 'spinecurve' && sp.Curve.parentObj === t.HipBone && X.wireColor(sp.Curve) === 49 && near(X.opsOn(sp.Curve, 'SpineCurve')[0].val('lgoal'), sp.length) && sp.TopVertebra.name === 'ChestBone' && X.opsOn(sp.TopVertebra, 'chestBone').length === 1 && sp.Vertebra.length === 3 && sp.Vertebra.every(v => v.name.startsWith('SpineVertebra')), [sp.TopVertebra?.name, sp.Vertebra?.map(v => v.name)]);
    ok('MakeSpine: Spine_Control page with spine_scale (1) and volume_factor (0) — here the biped Controls page', b.Sliders.get('spine_scale')?.value === 1 && b.Sliders.get('volume_factor')?.value === 0);
    ok('MakeSpine: vertebrae path-constrained at perc 100(i+1)/(n+1) with SpinePointAt slider 1-(i+1)/(n+1)', sp.Vertebra.every((v, i) => { const c = v.properties.find(p => p.type === 'poscns'); return c && near(c.val('perc'), 100 * (i + 1) / 4) && near(X.opsOn(v, 'SpinePointAt')[0].val('slider'), 1 - (i + 1) / 4); }));
    const arm = b.LArm; membersOk('MakeArm', arm);
    ok('MakeArm: LRoot / LBicep / LForearm / LArmEff, colour 489, root under the shoulder effector (ArmAttachment 0)', arm.Skel.map(o => o.name).join() === 'LRoot,LBicep,LForearm,LArmEff' && arm.Skel.every(o => X.wireColor(o) === 489) && arm.Root.parentObj === t.LEff, arm.Skel.map(o => o.name));
    ok('MakeArm: LArmUpV pyramid (253) under the root, bicep UpVectorReference = it, RotationOrder 0 -> bicep rotorder 3', arm.UpV.name === 'LArmUpV' && arm.UpV.parentObj === arm.Root && X.wireColor(arm.UpV) === 253 && arm.Skel[1].upVectorReference === arm.UpV && arm.Skel[1].kinematics.local.val('rotorder') === 3);
    const hd = b.LHand; membersOk('MakeHand', hd);
    ok('MakeHand: LHandRoot / LHand / LHandEffector, fingers LPinky.. LThumb under the hand bone, claw LHand_grab', hd.skel.map(o => o.name).join() === 'LHandRoot,LHand,LHandEffector' && hd.foundKeyWords.join() === 'Pinky,Ring,Middle,Index,Thumb' && hd.FingerRoots.every(r => r.parentObj === hd.bone) && hd.Claw.name === 'LHand_grab', [hd.foundKeyWords, hd.Claw?.name]);
    ok('MakeHand: finger names <p><Finger><n> / Root / Effector', hd.Finger[0].map(o => o.name).join() === 'LPinkyRoot,LPinky1,LPinky2,LPinkyEffector', hd.Finger[0].map(o => o.name));
    ok('MakeHand: Lhand_sliders page with a proxy per finger bone rotz named <Finger><n>', (() => { const p = hd.Root.properties.find(q => q.name === 'Lhand_sliders'); return p && p.get('Index1') && p.get('Thumb2') && p.params.length === 10; })());
    ok('MakeHand: poses LHand_Spread / LHand_Relaxed / LHand_Fist stored on the hand root', (hd.Root.rigActions ?? []).map(x => x.name).join() === 'LHand_Spread,LHand_Relaxed,LHand_Fist');
    ok('MakeHand: hand root re-parented under the arm effector', hd.Root.parentObj === arm.Eff);
    const lg = b.LLeg; membersOk('MakeLeg', lg);
    ok('MakeLeg: LRoot (LRoot1: names are unique per model and MakeArm took LRoot) / LThigh / LShin / LlegEff under HipPlate, LlegUpV behind the leg (UpVectorBehindLeg 1)', /^LRoot\d*,LThigh,LShin,LlegEff$/.test(lg.Skel.map(o => o.name).join()) && lg.Root.parentObj === t.HipBone && lg.upV.name === 'LlegUpV' && lg.upVpos.z < 0, lg.Skel.map(o => o.name));
    const ft = b.LFoot; membersOk('MakeFoot', ft);
    ok('MakeFoot: LeftFoot (253) under GlobalSRT, LeftTip (250), LeftRoll (770); toe chain LFootRoot.. under the leg effector', ft.Foot.name === 'LeftFoot' && ft.Foot.parentObj === b.GlobalSRT && X.wireColor(ft.Foot) === 253 && X.wireColor(ft.Tip) === 250 && X.wireColor(ft.Roll) === 770 && ft.Root.name === 'LFootRoot' && ft.Root.parentObj === lg.Eff, [ft.Foot?.parentObj?.name, ft.Root?.parentObj?.name]);
    ok('MakeFoot: three-bone toes -> ToeGuide R1 15 / R2 20 / R3 30, proxies L_Foot Roll 1/2 on the Controls page', ft.toeGuide.name === 'ToeGuide' && ft.toeGuide.val('R1') === 15 && ft.toeGuide.val('R3') === 30 && !!b.Sliders.get('L_Foot Roll 1'));
    ok('MakeFoot: guide nulls LPivotBase / LPlacePivot / LPivotRight / LPivotLeft under the tip (607); BaseGuide = last FootGuide', ['LPivotBase', 'LPlacePivot', 'LPivotRight', 'LPivotLeft'].every(n => named(ft.Tip, n) && X.wireColor(named(ft.Tip, n)) === 607) && ft.BaseGuide === ft.FootGuides[ft.FootGuides.length - 1]);
    ok('MakeBiped: leg effector Position-constrained to the foot BaseGuide', lg.Eff.properties.some(p => p.type === 'poscns' && p.targets[0] === ft.BaseGuide));
    const he = b.Head; membersOk('MakeHead', he);
    ok('MakeHead (skeleton assembly, HeadType 0): HeadRoot / Neck.. / Head / HeadEff under the chest bone, Head1 lengthens the chain', he.Skel[0].name === 'HeadRoot' && he.Skel[he.Skel.length - 1].name === 'HeadEff' && he.Skel.filter(o => o.type === 'bone').length === 3 && he.Root.parentObj === b.ChestBone, he.Skel.map(o => o.name));
    // key sets / marking sets / default pose
    const ks = A.characterKeySets.all().map(k => A.characterKeySets.siName(k));
    ok('MakeBipedCharacterKeySet (from MakeBiped): Biped with Upper (R_Arm L_Arm R_Hand L_Hand Torso Head_Neck) and Lower (L_Leg R_Leg)', ['Biped.Biped', 'Biped.Biped.Upper', 'Biped.Biped.Lower', 'Biped.Biped.Upper.Torso', 'Biped.Biped.Upper.L_Arm', 'Biped.Biped.Lower.R_Leg'].every(n => ks.includes(n)), ks);
    const kTop = A.characterKeySets.lookup('Biped.Biped'), kLArm = A.characterKeySets.lookup('Biped.Biped.Upper.L_Arm');
    ok('populate: GlobalSRT proxies in the top set, L arm bones in Upper.L_Arm', kTop.params.some(p => p.proxied?.owner?.parent?.parent === b.GlobalSRT) && kLArm.params.some(p => p.proxied?.owner?.parent?.parent === arm.Skel[1]), [kTop.params.length, kLArm.params.length]);
    ok('MakeBiped: DeleteMarkingSet true -> no marking set left on the rig', desc(b.model).every(o => !X.markingSetsOf(o).length));
    ok('MakeBiped: DefaultPose stored on the model', (b.model.rigActions ?? []).some(x => x.name === 'DefaultPose'));
    ok('MakeBiped: Synoptic property on GlobalSRT (BipedSynoptic_CDK1.htm)', b.GlobalSRT.properties.some(p => p.name === 'Synoptic' && /BipedSynoptic_CDK1\.htm$/.test(p.val('path'))));
    ok('MakeBiped: hidden group holds both shoulder roots', b.HiddenGroup.members.includes(t.lroot) && b.HiddenGroup.members.includes(t.rroot));
    undoAll(u0);
    ok('MakeBiped: one undo removes the rig', !A.scene.root.children.some(c => c.name === 'Biped' && c !== guide));
    A.scene.root.removeChild(guide);
  } catch (e) { ok('MakeBiped block', false, String(e?.stack ?? e)); }

  // ================= MakeBiped options: shadow skeleton, rolls, slides, joints, belly
  try {
    const u0 = A.undoStack.length;
    const guide = X.buildSampleGuide('biped');
    const r = run('MakeBiped', { SelectUsingUI: true, ShadowType: 1, MakeBelly: true, BellySlide: 1, ForeArmRoll: true, BicepRoll: true, ThighRoll: true, ArmPitSlide: true, HipSlide: true, ThighSlide: true, ElbowsJoint: true, KneeJoint: true, CreateShadowCharacterKeySet: true });
    const b = r.v;
    ok('MakeBiped (all options, ShadowType 1): runs without error', !r.err && b, r.err);
    ok('shadow rig: Biped_Shadow model, groups Shadow_hidden / Shadow_envelope_group, GlobalSRT null (805) Pose-constrained to GlobalSRT', b.ShadowModel.name === 'Biped_Shadow' && X.groupsOf(b.ShadowModel).map(g => g.name).sort().join() === 'Shadow_envelope_group,Shadow_hidden' && b.ShadowGlobalSRT.type === 'null' && X.wireColor(b.ShadowGlobalSRT) === 805 && b.ShadowGlobalSRT.properties.some(p => p.type === 'posecns' && p.targets[0] === b.GlobalSRT));
    ok('optional members present: RArmpit LArmpit RHip LHip RThigh LThigh LElbow RElbow LKnee RKnee Belly LBellySlide RBellySlide', ['RArmpit', 'LArmpit', 'RHip', 'LHip', 'RThigh', 'LThigh', 'LElbow', 'RElbow', 'LKnee', 'RKnee', 'Belly', 'LBellySlide', 'RBellySlide'].every(k => b[k]), ['RArmpit', 'LArmpit', 'RHip', 'LHip', 'RThigh', 'LThigh', 'LElbow', 'RElbow', 'LKnee', 'RKnee', 'Belly', 'LBellySlide', 'RBellySlide'].filter(k => !b[k]));
    ok('BicepRoll / ForeArmRoll on the arms: LBicepRoll1.., LElbow', b.LArm.BicepRoll?.Divisions?.[0]?.name === 'LBicepRoll1' && b.LArm.ForeArmRoll?.Divisions?.[0]?.name === 'LElbow');
    ok('ThighRoll on the legs: LThighRoll1..', b.LLeg.ThighRoll?.Divisions?.[0]?.name === 'LThighRoll1');
    ok('KneeJoint: roll divisions never passed (shipped LegDivisions undefined) -> joints under the thigh', b.LKnee.UpperJoint.parentObj === b.LLeg.Skel[1]);
    ok('ElbowsJoint: joints under the bicep roll division closest to the upper target', b.LArm.BicepRoll.Divisions.includes(b.LElbow.UpperJoint.parentObj));
    membersOk('MakeBelly', b.Belly);
    ok('MakeBelly: BellyRoot under LowerBellyEff, UpperBellyRoot under the vertebra, LowerBellyRoot under HipPlate', b.Belly.BellyRoot.parentObj === b.Belly.LowerEff && b.Belly.UpperRoot.parentObj === b.Torso.Spine.Vertebra[0] && b.Belly.LowerRoot.parentObj === b.HipBone);
    ok('shadow arm chains: MakeShadowChain under the torso shadow ends, colour 805', b.LArm.ArmShadow?.Root && X.wireColor(b.LArm.ArmShadow.Root) === 805);
    ok('shadow spine: MakeShadowSpine skeleton SpineRoot.. (type 1) from the shadowspinecurve', b.Torso.Spine.ShadowSpine?.Root?.name === 'SpineRoot' && b.Torso.Spine.ShadowCurve?.name === 'shadowspinecurve');
    const ks = A.characterKeySets.all().map(k => A.characterKeySets.siName(k));
    ok('CreateShadowCharacterKeySet: ShadowBiped set with ShadowUpper / ShadowLower', ks.some(n => /ShadowBiped$/.test(n)) && ks.some(n => /ShadowBiped\.ShadowUpper\.ShadowL_Arm$/.test(n)), ks.filter(n => /Shadow/.test(n)));
    ok('shadow synoptic: SkeletonBipedSynoptic.htm', b.ShadowGlobalSRT.properties.some(p => p.name === 'Synoptic' && /SkeletonBipedSynoptic\.htm$/.test(p.val('path'))));
    ok('ShadowDefaultPose stored on the main model', (b.model.rigActions ?? []).some(x => x.name === 'ShadowDefaultPose'));
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('MakeBiped options block', false, String(e?.stack ?? e)); }

  // ================= box shadows / null shadows / skeleton spine
  try {
    const u0 = A.undoStack.length; const guide = X.buildSampleGuide('biped');
    const b = run('MakeBiped', { SelectUsingUI: true, ShadowType: 4 }).v;
    const boxes = desc(b.ShadowModel).filter(o => o.type === 'polymsh');
    ok('ShadowType 4 (box): shadow GlobalSRT colour 479, Connector_* boxes with colour 479 and the Phong colours', X.wireColor(b.ShadowGlobalSRT) === 479 && boxes.length > 5 && boxes.every(o => X.wireColor(o) === 479 && o.phong && X.opsOn(o).some(op => /^Connector_/.test(op.name))), boxes.length);
    ok('box synoptic: BoxBipedSynoptic.htm', b.ShadowGlobalSRT.properties.some(p => p.name === 'Synoptic' && /BoxBipedSynoptic\.htm$/.test(p.val('path'))));
    undoAll(u0);
    const b2 = run('MakeBiped', { SelectUsingUI: true, ShadowType: 3, OneModel: true, TorsoType: 2 }).v;
    ok('OneModel: shadow rig in the same model, GlobalSRT named Shadow_GlobalSRT', b2.ShadowModel === b2.model && b2.ShadowGlobalSRT.name === 'Shadow_GlobalSRT');
    ok('TorsoType 2 (skeleton spine): SpineEff / Lumbar.. / SpineRoot chain, HipPlate under UpperBody, Hip / Chest deleted', b2.Torso.Spine.Skel[0].name === 'SpineEff' && b2.Torso.Spine.Skel[b2.Torso.Spine.Skel.length - 1].name === 'SpineRoot' && b2.HipBone.parentObj === b2.UpperBody && !named(b2.model, 'Hip') && !named(b2.model, 'Chest'), b2.Torso.Spine.Skel.map(o => o.name));
    ok('ShadowType 3 (null): null shadows colour 381', desc(b2.model).some(o => o.type === 'null' && X.wireColor(o) === 381));
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('shadow variants block', false, String(e?.stack ?? e)); }

  // ================= item 35: dialog / SelectUsingUI
  try {
    const u0 = A.undoStack.length; const guide = X.buildSampleGuide('biped');
    ST.hooks.dialog = (cmd, prop) => { ok('dialog: a temporary "Make Biped" custom property on the scene root, TorsoType stored 0-based', cmd === 'MakeBiped' && prop.parent === A.scene.root && prop.get('TorsoType').value === 0, [cmd, prop.name]); return false; };
    const rc = run('MakeBiped', { TorsoType: 2, SelectUsingUI: false });
    ok('dialog Cancel: "makeBiped: cancelled", returns nothing, nothing built', rc.v === undefined && has(rc, /^makeBiped: cancelled$/) && !A.scene.root.children.some(c => c.name === 'Biped'), rc.log);
    ST.hooks.dialog = (cmd, prop) => { prop.get('ShadowType').value = 3; return true; };
    const ro = run('MakeBiped', { ShadowType: 0, SelectUsingUI: false }).v;
    ok('dialog OK: the dialog values are used and the arguments ignored (ShadowType 3 from the dialog)', ro && ro.UI.ShadowType === 3 && ro.UI.TorsoType === 1 && ro.ShadowModel, ro?.UI);
    ok('dialog mode: CreateShadowCharacterKeySet forced false; progress shown', ro.UI.CreateShadowCharacterKeySet === false && ST.progress.some(p => /^Make Biped:/.test(p)));
    undoAll(u0); delete ST.hooks.dialog;
    const rd = run('MakeBiped');
    ok('no dialog stand-in: "not yet attested: dialog" logged and the defaults build the rig', rd.v && rd.v.model?.name === 'Biped' && nya(rd), rd.log.filter(l => /attested/.test(l)));
    undoAll(u0); A.scene.root.removeChild(guide);
    const pg = A.run('GetProportionalGuide', {});
    const rp = run('MakeBiped', { SelectUsingUI: true });
    ok('old proportional guide: warning "not compatible with MakeBiped (XSI v4.0), using CreateRigFromGuide", runs it, returns nothing', rp.v === undefined && has(rp, /This biped guide is not compatible with MakeBiped \(XSI v4\.0\), using CreateRigFromGuide/), rp.log);
    undoAll(u0); A.scene.root.removeChild(pg);
  } catch (e) { ok('dialog block', false, String(e?.stack ?? e)); }

  // ================= MakeBipedDogLeg (§3.3)
  try {
    const u0 = A.undoStack.length; const guide = X.buildSampleGuide('dogleg');
    const r = run('MakeBipedDogLeg', { SelectUsingUI: true, ThighSlide: true, HipSlide: true }); const b = r.v;
    ok('MakeBipedDogLeg: runs without error', !r.err && b, r.err ?? r.log.filter(l => /rror/.test(l)));
    membersOk('MakeBipedDogLeg', b);
    ok('MakeBipedDogLeg: model Biped_DogLeg, no controls_group', b.model.name === 'Biped_DogLeg' && !X.groupsOf(b.model).some(g => g.name === 'controls_group'));
    const d = b.LDogLeg; membersOk('MakeDogLeg', d);
    ok('MakeDogLeg: LLegRoot / LFemur / LTibia / LMetarsal / LLegEff under HipPlate, kneeGuide / tarsusGuide (607)', d.Skel.map(o => o.name).join() === 'LLegRoot,LFemur,LTibia,LMetarsal,LLegEff' && d.Root.parentObj === b.HipBone && X.wireColor(d.Knee) === 607 && d.Knee.name === 'LkneeGuide', d.Skel.map(o => o.name));
    ok('MakeDogLeg: DogLeg operator lock_percentage 0.97, proxy L_lock percentage', d.dogLeg.val('lock_percentage') === 0.97 && !!b.Sliders.get('L_lock percentage'));
    ok('MakeDogLeg: foot with two-bone toes (RIG_twoBoneToes) and an Extension control, foot root under the leg effector', d.Foot.toeGuide.name === 'RIG_twoBoneToes' && d.Foot.Extension?.name === 'LeftExtension' && d.Foot.Root.parentObj === d.eff);
    ok('MakeBipedDogLeg: thigh slide and hip slide on the dog-leg femur', b.LThigh?.BindNull && b.LHip?.BaseNull?.parentObj === d.Skel[1]);
    const ks = A.characterKeySets.all().map(k => A.characterKeySets.siName(k));
    ok('MakeBipedDogLeg: key set Biped_DogLeg', ks.includes('Biped_DogLeg.Biped_DogLeg'), ks);
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('MakeBipedDogLeg block', false, String(e?.stack ?? e)); }

  // ================= MakeQuadruped (§3.4)
  try {
    const u0 = A.undoStack.length; const guide = X.buildSampleGuide('quadruped');
    const r = run('MakeQuadruped', { SelectUsingUI: true, MakeBelly: true, ShadowType: 2, MakeTail: true }); const q = r.v;
    ok('MakeQuadruped: runs without error', !r.err && q, r.err ?? r.log.filter(l => /rror/.test(l)));
    membersOk('MakeQuadruped', q);
    ok('MakeQuadruped: model Quadruped, GlobalSRT size Scale x 0.2, shadow model Quadruped_Skeleton (icon type 7, 805)', q.Model.name === 'Quadruped' && q.ShadowModel.name === 'Quadruped_Skeleton' && q.ShadowGlobalSRT.rigIconType === 7 && X.wireColor(q.ShadowGlobalSRT) === 805);
    ok('MakeQuadruped: hind dog legs BL / BR (BLFemur), front legs L / R under the shoulder effectors, two-bone toes on the front feet', q.LDogLeg.Skel[1].name === 'BLFemur' && q.LLeg.Root.parentObj === q.LShoulderEff && q.LFoot.toeGuide.name === 'RIG_twoBoneToes');
    ok('MakeQuadruped: quadruped head (HeadType 1)', q.Head && q.Head.Type === 1);
    ok('MakeQuadruped: MakeTail outside the row -> not yet attested, Tail null', q.Tail === null && nya(r));
    ok('MakeQuadruped: default-pose quirk (model/Model) logged, nothing stored', has(r, /model\/Model mismatch/) && !(q.Model.rigActions ?? []).some(x => x.name === 'DefaultPose'));
    const ks = A.characterKeySets.all().map(k => A.characterKeySets.siName(k));
    ok('MakeQuadrupedCharacterKeySet: Upper (Torso Head_Neck), Lower (L_Leg R_Leg BL_Leg BR_Leg Tail)', ['Quadruped.Quadruped.Upper.Torso', 'Quadruped.Quadruped.Upper.Head_Neck', 'Quadruped.Quadruped.Lower.BL_Leg', 'Quadruped.Quadruped.Lower.Tail'].every(n => ks.includes(n)), ks);
    ok('MakeQuadruped: synoptic QuadSynoptic_IK1.htm', q.GlobalSRT.properties.some(p => p.name === 'Synoptic' && /QuadSynoptic_IK1\.htm$/.test(p.val('path'))));
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('MakeQuadruped block', false, String(e?.stack ?? e)); }

  // ================= SetKeyableRig (§3.25)
  try {
    const u0 = A.undoStack.length;
    const guide = X.buildSampleGuide('biped'); const m = guide; const gg = n => guide.children.find(c => c.name === n);
    const arm = A.run('MakeArm', { ArmParent: gg('LShoulder'), GuideObjectCollection: [gg('LShoulder'), gg('LElbow'), gg('LHand')], Prefix: 'L' });
    ok('MakeArm on its own: marking sets on the bones before SetKeyableRig', X.markingSetsOf(arm.Skel[1]).length === 1 && X.markingSetsOf(arm.Skel[1])[0].val('CharacterKeySet') === 'Upper.L_Arm');
    const before = desc(m).flatMap(o => X.markingSetsOf(o)).length;
    const r = run('SetKeyableRig', { RootObject: m });
    ok('SetKeyableRig: returns nothing, deletes every marking set of the model', r.v === undefined && before > 0 && desc(m).every(o => !X.markingSetsOf(o).length), [before]);
    ok('SetKeyableRig: listed rot parameters keyable, scaling not keyable', arm.Skel[1].kinematics.local.get('rotx').keyable && !arm.Skel[1].kinematics.local.get('sclx').keyable);
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('SetKeyableRig block', false, String(e?.stack ?? e)); }

  // ================= components on their own: MakeShadowSpine type 4 builds nothing; MakeFoot prefix dialog
  try {
    const u0 = A.undoStack.length;
    const crv = A.run('MakeRigIcon', { Type: 1 }); const a1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'sa' }), a2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'sb' }), a3 = A.run('GetPrim', { PresetObj: 'Null', Name: 'sc' });
    const r = run('MakeShadowSpine', { Spline: crv, Base: a1, Vertebra: [a2], TopVertebra: a3, ShadowType: 4 });
    ok('MakeShadowSpine: ShadowType other than 1-3 builds nothing', r.v && r.v.Root === null && !r.err);
    const r3 = run('MakeShadowSpine', { Spline: crv, Base: a1, Vertebra: [a2], TopVertebra: a3, ShadowType: 3 }).v;
    ok('MakeShadowSpine type 3: nulls traced from Base, vertebrae, TopVertebra (first under Base), colour 381', r3.Skel.length === 3 && r3.Skel[0].parentObj === a1 && r3.Skel.every(o => X.wireColor(o) === 381));
    membersOk('MakeShadowSpine', r3);
    const guide = X.buildSampleGuide('biped'); const gg = n => guide.children.find(c => c.name === n);
    ST.hooks.dialog = (cmd, prop) => { ok('MakeFoot empty prefix: Foot_Maker dialog with BL / BLeft', cmd === 'MakeFoot' && prop.name === 'Foot_Maker' && prop.get('ShortPrefix').value === 'BL' && prop.get('FullPrefix').value === 'BLeft'); return true; };
    const f = run('MakeFoot', { Model: guide, Parent: null, GuideObjectCollection: ['LPivot', 'LPivotRight', 'LPivotLeft', 'LFoot1', 'LFoot2', 'LFoot3', 'LFoot4'].map(gg) }).v;
    ok('MakeFoot: dialog prefixes used (BLFootRoot, BLeftFoot), parent null -> scene root', f.Root.name === 'BLFootRoot' && f.Foot.name === 'BLeftFoot' && f.Foot.parentObj === A.scene.root);
    delete ST.hooks.dialog;
    undoAll(u0); A.scene.root.removeChild(guide);
  } catch (e) { ok('components block', false, String(e?.stack ?? e)); }

  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fails = 0;
console.log('== registration (catalogue argument lists)');
for (const n of NAMES) {
  const want = registry[n], have = got.reg[n];
  const same = !!want && !!have && JSON.stringify(want) === JSON.stringify(have);
  if (!same) { fails++; console.log(`FAIL ${n}: registered ${JSON.stringify(have)} vs catalogue ${JSON.stringify(want)}`); }
}
console.log(`${NAMES.length - NAMES.filter(n => JSON.stringify(registry[n]) !== JSON.stringify(got.reg[n])).length}/${NAMES.length} registered with the catalogue argument list`);
console.log('== default runs (?demo, cube selected)');
for (const n of NAMES) { const r = got.defaults[n]; if (r !== 'ok' && r !== 'expected-failure') { fails++; console.log(`FAIL ${n}: ${r}`); } }
console.log(`${NAMES.filter(n => ['ok', 'expected-failure'].includes(got.defaults[n])).length}/${NAMES.length} default runs as expected (${[...DEFAULT_FAILS].join(', ')} expected to fail)`);
console.log('== contract checks');
for (const [name, pass, detail] of got.checks) { if (!pass) fails++; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : '  ' + detail}`); }
if (pageErrors.length) { console.log('page errors:', pageErrors.slice(0, 5)); }
console.log(`\n${got.checks.filter(c => c[1]).length}/${got.checks.length} contract checks pass; ${fails} failure(s)`);
await browser.close();
process.exit(fails ? 1 : 0);
