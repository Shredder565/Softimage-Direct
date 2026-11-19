// CMD-B13a (bvrexport.dll): the 25 Bvr* commands of src/commands/bvrB13a*.ts. There is no XSIBATCH golden for the row:
// this is a contract check against docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md.
//   1. every name is registered with the catalogue argument list (data/command_registry.json when listed there, else
//      data/commands_full.json; return values left out);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an error
//      (Bvr* commands never fail: errors are message boxes, note 2.3);
//   3. the contract's stated results (tags, message texts, wire colours, home pose, inspectors, workers, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_bvr_b13a_commands.mjs
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
  'BvrAddBVHAction', 'BvrAddColSphere', 'BvrAddFloor', 'BvrAddJointLimit', 'BvrGenerateActor', 'BvrGenerateRenderSetup', 'BvrGotoHome',
  'BvrImportBVHAction', 'BvrInitActor', 'BvrMakeLoop', 'BvrMakeSkill', 'BvrRemoveCOG', 'BvrRemoveFloor', 'BvrRemoveFoot', 'BvrRemoveJointLimit',
  'BvrRenderSetup', 'BvrSetCOG', 'BvrSetCollisionOnly', 'BvrSetDefault', 'BvrSetFoot', 'BvrSetHome', 'BvrSetVisualOnly',
  'BvrLoadActor', 'BvrSaveActor', 'BvrImportBVHActor',
];

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  const c = reg.find(x => (x.scripting_name || x.name) === n) ?? f; if (!c) return [n, null];
  return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? fd[a.name] ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('BvrInitActor') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false;
  const S = A.bvrB13a;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length, k = S.messages.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text), msgs: S.messages.slice(k).map(x => x.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), msgs: S.messages.slice(k).map(x => x.text) }; } };
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const prop = (o, n) => o.properties.find(p => p.name === n);
  const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
  const cube = A.scene.find('cube');
  const sel = (o) => A.select(o ? [o] : []);
  const answers = []; S.hooks.msgBox = (text, style) => answers.length ? answers.shift() : null;
  const gpos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    sel(cube); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? 'ERROR: ' + r.err : r.v !== undefined ? 'RETURNED ' + String(r.v) : 'ok';
  }
  sel(cube);
  {
    const r = run('BvrInitActor');
    ok('scene root: cube under Scene_Root -> scene-root message, nothing else', r.msgs.join() === 'Actor descriptions must be contained by a single model (scene root not supported).', r.msgs);
    ok('Bvr* commands are not journalled (siNoLogging)', !r.log.some(l => /BvrInitActor/.test(l)), r.log);
    sel(null); const g = run('BvrSetHome');
    ok('gate: nothing selected -> "The Set Home action requires selecting a single node in the actor description."', g.msgs[0] === 'The Set Home action requires selecting a single node in the actor description.' && S.messages.at(-1).title === 'Behavior Export', g.msgs);
    A.select([cube, ...A.scene.root.children.filter(c => c !== cube).slice(0, 1)]);
    ok('gate: two items selected -> message', run('BvrGotoHome').msgs[0] === 'The Goto Home action requires selecting a single node in the actor description.');
    sel(null);
    ok('gate wording: MakeLoop', run('BvrMakeLoop').msgs[0] === 'The Loop Locomotion action requires selecting a single node in the actor description.');
    ok('gate wording: MakeSkill', run('BvrMakeSkill').msgs[0] === 'The Make Skill action requires selecting a single node or action source in the actor description.');
    ok('gate wording: ImportBVHAction', run('BvrImportBVHAction').msgs[0] === 'The Import BVH Action command requires selecting a single node in the target actor description.');
  }

  // ---------------- fixture: model > hips(root) > cog > leg > foot(cube mesh) > toe
  const nul = (name, parent, y = 0, z = 0) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: name, Parent: parent?.fullName ?? '' }); o.kinematics.local.set('posy', y); o.kinematics.local.set('posz', z); return o; };
  sel(null);
  const model = A.run('CreateModel', { InputObj: [], Name: 'BvrActor' });
  const hips = nul('bvrHips', model);
  const cog = nul('bvrCog', hips, 3);
  const leg = nul('bvrLeg', cog, -1);
  const foot = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'bvrFoot', Parent: leg.fullName }); foot.kinematics.local.set('posy', -1);
  const toe = nul('bvrToe', foot, -0.5, 1);
  const light = A.run('GetPrim', { PresetObj: 'Point', Name: 'bvrLight', Parent: model.fullName });
  ok('fixture: actor hierarchy', hips.parentObj === model && toe.parentObj === foot && light.parentObj === model);

  // ================= BvrInitActor
  {
    sel(toe); S.hooks.shift = false; const u0 = A.undoStack.length; const c0 = S.cmdlogOff.length;
    const r = run('BvrInitActor');
    ok('BvrInitActor: no message, returns nothing', !r.err && !r.msgs.length && r.v === undefined, r);
    ok('BvrInitActor: RTKNode on the root and every COG-subtree node', [hips, cog, leg, foot, toe].every(o => prop(o, 'RTKNode')));
    ok('BvrInitActor: RTKNode has VisualizationOnly / CollisionOnly false', prop(cog, 'RTKNode').val('VisualizationOnly') === false && prop(cog, 'RTKNode').val('CollisionOnly') === false);
    ok('BvrInitActor: wire colour 0x200 on new RTKNode nodes', [hips, cog, toe].every(o => S.wireColours.get(o) === 0x200));
    ok('BvrInitActor: RTKEnd only on nodes without children', !!prop(toe, 'RTKEnd') && ![hips, cog, leg, foot].some(o => prop(o, 'RTKEnd')));
    ok('BvrInitActor: lights do not count (light ignored, no tag)', !prop(light, 'RTKNode'));
    ok('BvrInitActor: without Shift no RTKActor', !prop(hips, 'RTKActor'));
    ok('BvrInitActor: progress "Initializing Actor", command log off then restored', S.progress.at(-1).caption === 'Initializing Actor' && S.cmdlogOff.length === c0 + 1 && S.cmdlogOff.at(-1).restored && A.cmdLog !== false);
    ok('BvrInitActor: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('BvrInitActor: undo removes the tags', !prop(cog, 'RTKNode') && !prop(toe, 'RTKEnd'));
    A.redo();
    prop(leg, 'RTKNode') && run('BvrInitActor');
    ok('BvrInitActor: re-run keeps a single RTKEnd', toe.properties.filter(p => p.name === 'RTKEnd').length === 1);
    S.hooks.shift = true; run('BvrInitActor'); S.hooks.shift = false;
    const ra = prop(hips, 'RTKActor');
    ok('BvrInitActor + Shift: RTKActor on the actor root with Height / Radius fitted', !!ra && ra.val('Height') > 0 && ra.val('Radius') > 0 && ra.val('MeanDistance') === 0, ra && [ra.val('Height'), ra.val('Radius')]);
    // the fit: Height = box height of the subtree, Radius = largest XZ distance from root to box corners
    const pts = []; for (const o of [hips, cog, leg, foot, toe]) { const m = o.primitive?.mesh(); const e = o.globalMatrix().elements; if (m) for (let i = 0; i < m.positions.length; i += 3) { const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2]; pts.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]); } else pts.push(gpos(o)); }
    const mn = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
    const rr = Math.max(...[mn[0], mx[0]].flatMap(x => [mn[2], mx[2]].map(z => Math.hypot(x, z))));
    ok('BvrInitActor + Shift: Height = maxY - minY, Radius = max XZ corner distance', ra && near(ra.val('Height'), mx[1] - mn[1]) && near(ra.val('Radius'), rr), ra && [ra.val('Height'), mx[1] - mn[1], ra.val('Radius'), rr]);
  }
  // ================= structure errors
  {
    const extra = nul('bvrExtra', model);
    sel(toe); const r = run('BvrInitActor');
    ok('actor root: two children -> listing message (lights do not count)', r.msgs[0] === 'For a model to convert to an actor, the model must have a single child node (lights and cameras don\'t count). One of the following nodes needs to be lower in the tree:\nnode - bvrHips\nnode - bvrExtra', r.msgs);
    A.run('DeleteObj', { InputObj: [extra] });
    const m2 = (sel(null), A.run('CreateModel', { InputObj: [], Name: 'BvrMesh' }));
    const body = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'bvrBody', Parent: m2.fullName }); const c2 = nul('bvrBodyCog', body);
    sel(c2); const r2 = run('BvrInitActor');
    const srt = m2.children[0];
    ok('actor root: single mesh child -> GlobalSRT null inserted above it and used as root', !r2.msgs.length && srt.name === 'GlobalSRT' && body.parentObj === srt && !!prop(srt, 'RTKNode') && !!prop(body, 'RTKNode'), [r2.msgs, srt.name]);
    const inner = (sel(null), A.run('CreateModel', { InputObj: [], Name: 'BvrInner', Parent: c2.fullName }));
    sel(c2); const r3 = run('BvrInitActor');
    ok('nested model -> "embedded models not supported" message', r3.msgs[0] === 'Actor descriptions must be contained by a single model (embedded models not supported).', r3.msgs);
    void inner;
    const m3 = (sel(null), A.run('CreateModel', { InputObj: [], Name: 'BvrNoCog' })); const lone = nul('bvrLone', m3);
    sel(lone); ok('COG: root without children -> message', run('BvrInitActor').msgs[0] === 'For a model to convert to an actor, the actor root node must have one child node (e.g. a COG node).');
    nul('bvrA', lone); nul('bvrB', lone);
    sel(lone); const r4 = run('BvrInitActor');
    ok('COG: several children -> message ending with the COG option', /node - bvrA\nnode - bvrB\nThe other option is to mark one of the nodes as the COG node\.$/.test(r4.msgs[0]), r4.msgs);
    sel(lone.children[0]); const r5 = run('BvrSetCOG');
    ok('BvrSetCOG: adds RTKCogNode', !r5.msgs.length && !!prop(lone.children[0], 'RTKCogNode'), r5.msgs);
    sel(lone); ok('COG: the RTKCogNode child resolves the COG', !run('BvrInitActor').msgs.length && !!prop(lone.children[0], 'RTKNode'));
    sel(lone.children[0]); run('BvrRemoveCOG'); ok('BvrRemoveCOG: removes RTKCogNode', !prop(lone.children[0], 'RTKCogNode'));
    sel(lone.children[0].children[0] ?? lone);
    const deep = nul('bvrDeep', lone.children[0]); sel(deep);
    ok('BvrSetCOG: not two levels below the model -> message', run('BvrSetCOG').msgs[0] === 'The COG node must be two levels below the model.');
    const lt = A.run('GetPrim', { PresetObj: 'Point', Name: 'bvrLt', Parent: lone.fullName }); sel(lt);
    ok('BvrSetCOG: light -> message', run('BvrSetCOG').msgs[0] === 'The COG node can not be a light or camera.');
    sel(cube); ok('BvrSetCOG: scene root wording', run('BvrSetCOG').msgs[0] === 'The actor description must be contained by a single model (scene root not supported).');
  }
  // ================= Set* kinds
  {
    sel(leg); run('BvrSetCollisionOnly'); const p = prop(leg, 'RTKNode');
    ok('BvrSetCollisionOnly: VisualizationOnly false, CollisionOnly true, wire 0xf9', p.val('VisualizationOnly') === false && p.val('CollisionOnly') === true && S.wireColours.get(leg) === 0xf9);
    run('BvrSetVisualOnly'); ok('BvrSetVisualOnly: VisualizationOnly true, CollisionOnly false, wire 0x334', p.val('VisualizationOnly') === true && p.val('CollisionOnly') === false && S.wireColours.get(leg) === 0x334);
    run('BvrSetDefault'); ok('BvrSetDefault: both false, wire 0x200', !p.val('VisualizationOnly') && !p.val('CollisionOnly') && S.wireColours.get(leg) === 0x200);
    ok('Set*: local display property flagged with the colour code', leg.properties.find(q => q.type === 'display')?.wirecolCode === 0x200 && leg.properties.find(q => q.type === 'display').shared === false);
    sel(cube); const r = run('BvrSetVisualOnly');
    ok('BvrSetVisualOnly: node not initialized -> message', r.msgs[0] === 'The Set Visual Only action requires the selected node to be initialized. Please initialize the actor and try again.', r.msgs);
  }
  // ================= SetHome / GotoHome
  {
    sel(foot); const r0 = run('BvrSetFoot');
    ok('BvrSetFoot: no home pose -> message', r0.msgs[0] === 'The Set Foot action can not be applied to an actor whose Home pose is not set. Please set the Home pose and try again.', r0.msgs);
    sel(cog); S.hooks.shift = false; const r = run('BvrSetHome');
    const hp = prop(cog, 'RTKHomePose');
    ok('BvrSetHome: RTKHomePose with the global translation', !r.msgs.length && hp && near(hp.val('py'), 3) && near(prop(toe, 'RTKHomePose').val('py'), 0.5) && near(prop(toe, 'RTKHomePose').val('pz'), 1) && near(hp.val('sx'), 1), r.msgs);
    ok('BvrSetHome: every non-sphere node of the model (light included), not the model', [hips, cog, leg, foot, toe, light].every(o => prop(o, 'RTKHomePose')) && !prop(model, 'RTKHomePose'));
    ok('BvrSetHome: Shift not held adds RTKFixHomeBase on the root', !!prop(hips, 'RTKFixHomeBase'));
    ok('BvrSetHome: RTKActor present -> scale check passes, the re-base helper is logged not yet attested', nya(r) && /0x180002970/.test(r.log.join()), r.log);
    ok('BvrSetHome: progress "Storing Home Pose"', S.progress.some(p => p.caption === 'Storing Home Pose'));
    S.hooks.shift = true; run('BvrSetHome'); S.hooks.shift = false;
    ok('BvrSetHome + Shift: RTKFixHomeBase deleted', !prop(hips, 'RTKFixHomeBase'));
    leg.kinematics.local.set('sclx', 2); const rs = run('BvrSetHome');
    ok('BvrSetHome: scaled node -> scale message, stops', rs.msgs[0] === 'The scaling on the actor node bvrLeg must be (1,1,1) for a valid Set Home action.\nGenerate the actor to freeze all the scaling in the description.' && !prop(hips, 'RTKFixHomeBase'), rs.msgs);
    leg.kinematics.local.set('sclx', 1);
    // GotoHome
    cog.kinematics.local.set('posx', 5); cog.kinematics.local.set('roty', 30); toe.kinematics.local.set('posz', 4);
    sel(toe); const u0 = A.undoStack.length; const rg = run('BvrGotoHome');
    ok('BvrGotoHome: home pose applied (global SRT back)', !rg.msgs.length && near(gpos(cog)[0], 0) && near(cog.kinematics.local.val('roty'), 0) && near(gpos(toe)[2], 1) && near(gpos(toe)[1], 0.5), [gpos(cog), gpos(toe)]);
    ok('BvrGotoHome: one undo step; progress caption', A.undoStack.length === u0 + 1 && S.progress.at(-1).caption === 'Applying Home Pose');
    A.undo(); ok('BvrGotoHome: undo', near(cog.kinematics.local.val('posx'), 5)); A.redo();
  }
  // ================= SetFoot / RemoveFoot / AddColSphere / AddFloor
  {
    sel(foot); const r = run('BvrSetFoot');
    const spheres = [...model.descendants()].filter(o => prop(o, 'RTKSphere')).sort((a, b) => (a.parentObj === foot ? 0 : 1) - (b.parentObj === foot ? 0 : 1));
    ok('BvrSetFoot: RTKEffector (Contact 0, Anchor false), wire 0x12e', !r.msgs.length && prop(foot, 'RTKEffector')?.val('Contact') === 0 && prop(foot, 'RTKEffector').val('Anchor') === false && S.wireColours.get(foot) === 0x12e, r.msgs);
    ok('BvrSetFoot: two collision spheres, under the foot and under its lowest descendant', spheres.length === 2 && spheres[0].parentObj === foot && spheres[1].parentObj === toe, spheres.map(s => s.parentObj?.name));
    const fh = prop(foot, 'RTKHomePose').val('py'); const r0 = 0.25 * fh;
    ok('BvrSetFoot: sphere radius 0.25 x home py, lowered by radius', near(spheres[0].primitive.operators[0].val('radius'), r0) && near(prop(spheres[0], 'RTKSphere').val('Radius'), r0) && near(gpos(spheres[0])[1], gpos(foot)[1] - r0), [r0, gpos(spheres[0]), spheres[0].primitive.operators[0].val('radius')]);
    ok('BvrSetFoot: toe sphere radius 0.25 x its home py, lowered by the same amount', near(spheres[1].primitive.operators[0].val('radius'), 0.25 * prop(toe, 'RTKHomePose').val('py')) && near(gpos(spheres[1])[1], gpos(toe)[1] - r0));
    ok('BvrSetFoot: spheres tagged RTKNode, wire 0x1ef', spheres.every(s => prop(s, 'RTKNode') && S.wireColours.get(s) === 0x1ef));
    const r2 = run('BvrSetFoot');
    ok('BvrSetFoot: second run -> "already has a collision sphere" message', r2.msgs[0] === 'The foot node already has a collision sphere as a child. You will need to add additional collision spheres manually.', r2.msgs);
    // RemoveFoot, answer No
    answers.push(7); const rn = run('BvrRemoveFoot');
    ok('BvrRemoveFoot: RTKEffector deleted, wire reset to 0x200, Yes/No box', !prop(foot, 'RTKEffector') && S.wireColours.get(foot) === 0x200 && rn.msgs[0] === 'Do you want to remove the collision spheres under the foot node?' && S.messages.at(-1).style === 4, rn.msgs);
    ok('BvrRemoveFoot: answer No keeps the spheres', [...model.descendants()].filter(o => prop(o, 'RTKSphere')).length === 2);
    run('BvrSetFoot'); answers.push(6); run('BvrRemoveFoot');
    ok('BvrRemoveFoot: answer Yes deletes the spheres', ![...model.descendants()].some(o => prop(o, 'RTKSphere')));
    ok('BvrRemoveFoot: without RTKEffector nothing happens', !run('BvrRemoveFoot').msgs.length);
    // AddColSphere
    const ni = S.inspects.length; run('BvrAddColSphere');
    const cs = foot.children.find(c => c.name.startsWith('bvrFoot_CS'));
    const pts = (() => { const m = foot.primitive.mesh(); const e = foot.globalMatrix().elements; let mn = Infinity; for (let i = 0; i < m.positions.length; i += 3) mn = Math.min(mn, e[1] * m.positions[i] + e[5] * m.positions[i + 1] + e[9] * m.positions[i + 2] + e[13]); return mn; })();
    const er = Math.abs(gpos(foot)[1] - pts);
    ok('BvrAddColSphere: <node>_CS sphere under the node at its global translation', !!cs && gpos(cs).every((v, i) => near(v, gpos(foot)[i])), cs && gpos(cs));
    ok('BvrAddColSphere: radius = |global Y - geometry min Y|, RTKSphere Radius, wire 0x1ef', cs && near(cs.primitive.operators[0].val('radius'), er) && near(prop(cs, 'RTKSphere').val('Radius'), er) && S.wireColours.get(cs) === 0x1ef, cs && [cs.primitive.operators[0].val('radius'), er]);
    ok('BvrAddColSphere: InspectObj "<sphere>.Sphere", "Collision Sphere", mode 3', S.inspects.length === ni + 1 && S.inspects.at(-1).target === `${cs.fullName}.Sphere` && S.inspects.at(-1).title === 'Collision Sphere' && S.inspects.at(-1).mode === 3, S.inspects.at(-1));
    sel(hips); ok('BvrAddColSphere: actor root -> message', run('BvrAddColSphere').msgs[0] === 'The Add Collision Sphere action can not be applied to the root node of an actor.');
    // AddFloor
    sel(foot); const rf = run('BvrAddFloor');
    const fl = foot.children.find(c => c.name === 'Floor');
    ok('BvrAddFloor: Floor null under the node, translation (0, minY, 0)', !rf.msgs.length && !!fl && near(fl.kinematics.local.val('posy'), pts) && fl.kinematics.local.val('posx') === 0, [rf.msgs, fl?.kinematics.local.val('posy'), pts]);
    const m = foot.primitive.mesh(); const e = foot.globalMatrix().elements; let mx = -Infinity; for (let i = 0; i < m.positions.length; i += 3) mx = Math.max(mx, e[1] * m.positions[i] + e[5] * m.positions[i + 1] + e[9] * m.positions[i + 2] + e[13]);
    ok('BvrAddFloor: RTKNode (wire 0x200) and RTKFloor Top = maxY - minY', fl && prop(fl, 'RTKNode') && S.wireColours.get(fl) === 0x200 && near(prop(fl, 'RTKFloor').val('Top'), mx - pts));
    ok('BvrAddFloor: a second floor -> message', run('BvrAddFloor').msgs[0] === 'A floor node already exists under the selected node.');
    sel(leg); ok('BvrAddFloor: no polygon mesh -> message', run('BvrAddFloor').msgs[0] === 'The Add Floor action can not be applied to a node without an associated polygon mesh.');
    sel(cube); ok('BvrAddFloor: not initialized -> message', run('BvrAddFloor').msgs[0] === 'The Add Floor action requires the selected node to be initialized. Please initialize the actor and try again.');
    sel(foot); run('BvrRemoveFloor'); ok('BvrRemoveFloor: deletes the floor nodes, no confirmation', !foot.children.some(c => c.name === 'Floor') && S.messages.at(-1).style !== 4);
    // root node: message but continues (WIRE_CORRECTIONS_B13)
    const mr = (sel(null), A.run('CreateModel', { InputObj: [], Name: 'BvrFloorRoot' }));
    const rm = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'bvrRootMesh', Parent: mr.fullName });
    rm.addProperty(new (cube.properties[0].constructor)('RTKNode', 'customparamset', []));
    sel(rm); const rr = run('BvrAddFloor');
    ok('BvrAddFloor: actor root -> root-node message, and the floor is still added', rr.msgs[0] === 'The Add Floor action can not be applied to the root node of an actor.' && rm.children.some(c => c.name === 'Floor'), rr.msgs);
  }
  // ================= AddJointLimit
  {
    const ra = prop(hips, 'RTKActor'); hips.removeProperty(ra);
    sel(leg); const r0 = run('BvrAddJointLimit');
    ok('BvrAddJointLimit: no RTKActor -> message', r0.msgs[0] === 'The actor must be properly generated before a Behavior Joint Limit can be added. Please try the Generate action and try again.', r0.msgs);
    hips.addProperty(ra);
    const ni = S.inspects.length; run('BvrAddJointLimit'); const jl = prop(leg, 'BehaviorJL');
    ok('BvrAddJointLimit: BehaviorJL (MinX..MaxZ 0 in [-360, 360], IK false) + inspector mode 1', jl && jl.get('MinX').def.min === -360 && jl.val('IK') === false && S.inspects.length === ni + 1 && S.inspects.at(-1).title === 'Behavior Joint Limit' && S.inspects.at(-1).mode === 1);
    ok('BvrAddJointLimit: command log not suppressed', S.cmdlogOff.at(-1).command !== 'BvrAddJointLimit');
    sel(cube); ok('BvrAddJointLimit: not initialized -> message', run('BvrAddJointLimit').msgs[0] === 'To add a Behavior Joint Limit, the actor must first be initialized.');
    sel(leg); run('BvrRemoveJointLimit'); ok('BvrRemoveJointLimit: removes BehaviorJL', !prop(leg, 'BehaviorJL'));
  }
  // ================= MakeSkill / MakeLoop
  {
    sel(cog); const r0 = run('BvrMakeSkill');
    ok('BvrMakeSkill: no action sources -> message', r0.msgs[0] === 'The Make Skill action requires the actor to have associated action sources.', r0.msgs);
    ok('BvrMakeLoop: no action sources -> message', run('BvrMakeLoop').msgs[0] === 'The Loop Skill action requires the actor to have associated action sources.');
    const Prop = cube.properties[0].constructor;
    const s1 = new Prop('BvrSrcA', 'actionsource', []); const s2 = new Prop('BvrSrcB', 'actionsource', []); model.addProperty(s1); model.addProperty(s2);
    S.hooks.inspect = (title) => title === 'Make Skill' ? false : null;
    const rc = run('BvrMakeSkill');
    ok('BvrMakeSkill: modal "Make Skill" page (mode 4), Cancel -> Skill property deleted', !rc.msgs.length && S.inspects.at(-1).title === 'Make Skill' && S.inspects.at(-1).mode === 4 && S.inspects.at(-1).modal && !prop(hips, 'Skill'), rc.msgs);
    S.hooks.inspect = (title, p) => { if (title === 'Make Skill') { p.set('Skill', 2); } return true; };
    const rl = run('BvrMakeSkill');
    ok('BvrMakeSkill: locomotion without foot tags -> message; Skill deleted', rl.msgs[0] === 'To create a locomotion skill the actor must have foot tags. Please tag the feet and try again.' && !prop(hips, 'Skill'), rl.msgs);
    S.hooks.inspect = (title, p) => { if (title === 'Make Skill') { p.set('Skill', 1); } return true; };
    const w0 = S.workers.length; const r1 = run('BvrMakeSkill');
    ok('BvrMakeSkill: Skill 1 with RTKActor -> conversion worker (not yet attested), Skill deleted', S.workers.length === w0 + 1 && S.workers.at(-1).worker === 'skill1' && nya(r1) && !prop(hips, 'Skill'), r1.log);
    sel(s2); S.hooks.inspect = (title, p) => { if (title === 'Make Skill') out.srcIdx = p.val('Source'); return false; };
    run('BvrMakeSkill'); ok('BvrMakeSkill: action source selected -> Source = its index', out.srcIdx === 1, out.srcIdx);
    S.hooks.inspect = (title, p) => { if (title === 'Make Skill') { p.set('Transfer', true); } return true; };
    S.hooks.pick = () => toe; sel(cog); const rt = run('BvrMakeSkill');
    ok('BvrMakeSkill: transfer onto the same actor -> message', rt.msgs.at(-1) === 'The target actor for a skill transfer cannot be the same as the source actor.', rt.msgs);
    delete S.hooks.pick; delete S.hooks.inspect;
    sel(s2); const ni = S.inspects.length; run('BvrMakeLoop'); const ls = prop(hips, 'LoopSkill');
    ok('BvrMakeLoop: LoopSkill on the root (Smooth 10, Loco true), Source = selected source index, page "Loop Skill" mode 1', ls && ls.val('Smooth') === 10 && ls.val('Loco') === true && ls.val('Source') === 1 && S.inspects.length === ni + 1 && S.inspects.at(-1).title === 'Loop Skill' && S.inspects.at(-1).mode === 1);
  }
  // ================= Generate
  {
    sel(cog); S.hooks.inspect = () => false; const w0 = S.workers.length;
    const r0 = run('BvrGenerateActor');
    ok('BvrGenerateActor: DeselectAll, BehaviorGen on the root, modal "Generate Actor", Cancel ends', A.selection.length === 0 && !!prop(hips, 'BehaviorGen') && S.inspects.at(-1).title === 'Generate Actor' && S.workers.length === w0, r0.msgs);
    ok('BvrGenerateActor: BehaviorGen defaults', prop(hips, 'BehaviorGen').val('Box') === true && near(prop(hips, 'BehaviorGen').val('Factor'), 0.2) && prop(hips, 'BehaviorGen').val('Envelope') === false);
    S.hooks.inspect = () => true; sel(cog); const r1 = run('BvrGenerateActor');
    ok('BvrGenerateActor: OK -> generation worker with factor x 0.5 (not yet attested)', S.workers.at(-1).worker === 'generate' && near(S.workers.at(-1).args.factor, 0.1) && nya(r1) && S.progress.at(-1).caption === 'Generating Actor', S.workers.at(-1));
    delete S.hooks.inspect;
    sel(cube); ok('BvrGenerateActor: scene root wording', run('BvrGenerateActor').msgs[0] === 'The source actor description must be contained by a single model (scene root not supported).');
  }
  // ================= RenderSetup / BVH / GenerateRenderSetup
  {
    sel(null); run('BvrRenderSetup'); const rs = prop(A.scene.root, 'RenderSetup');
    ok('BvrRenderSetup: RenderSetup on the scene root (Start 1, End 1, Enable false), page mode 3, no selection needed', rs && rs.val('Start') === 1 && rs.val('Enable') === false && S.inspects.at(-1).title === 'Render Setup' && S.inspects.at(-1).mode === 3);
    sel(toe); S.hooks.inspect = (title, p) => { if (title === 'Import BVH Action') p.set('BVHFile', 'C:/mocap/walk.bvh'); return true; };
    const w0 = S.workers.length; const r = run('BvrImportBVHAction'); const bv = prop(model, 'BVHActor');
    ok('BvrImportBVHAction: BVHActor on the model (Scale 0.125, ActionName Mocap), help behave12.htm', bv && near(bv.val('Scale'), 0.125) && bv.val('ActionName') === 'Mocap' && /behave12\.htm$/.test(bv.helpFile));
    ok('BvrImportBVHAction: OK -> BvrAddBVHAction(model, file, name, scale, optimize, filter, remove, root)', S.workers.length === w0 + 1 && S.workers.at(-1).command === 'BvrAddBVHAction' && S.workers.at(-1).args.file === 'C:/mocap/walk.bvh' && S.workers.at(-1).args.name === 'Mocap' && S.workers.at(-1).args.root === true, [r.msgs, S.workers.at(-1)]);
    delete S.hooks.inspect;
    const n0 = S.workers.length;
    run('BvrAddBVHAction', { arg0: model, arg1: 'x.bvh', arg2: 'A', arg3: '1', arg4: true });
    ok('BvrAddBVHAction: wrong-typed arg3 -> nothing', S.workers.length === n0);
    run('BvrAddBVHAction', { arg0: model, arg1: 'x.bvh', arg2: 'A', arg3: 0.5, arg4: false });
    ok('BvrAddBVHAction: optional args default "", "", true', S.workers.length === n0 + 1 && S.workers.at(-1).args.filter === '' && S.workers.at(-1).args.root === true);
    const rg = run('BvrGenerateRenderSetup');
    ok('BvrGenerateRenderSetup: no filename -> "RenderSetupGenerate command missing filename parameter (0)."', rg.log.includes('RenderSetupGenerate command missing filename parameter (0).') && rg.v === undefined, rg.log);
    ok('BvrGenerateRenderSetup: no group -> (1)', run('BvrGenerateRenderSetup', { filename: 'r.txt', target: 'NoGroup' }).log.includes('RenderSetupGenerate command missing target group parameter (1).'));
    const G = A.run('CreateGroup', { Name: 'BvrGrp', InputObjs: [toe] }); const gname = G?.name ?? 'BvrGrp';
    ok('BvrGenerateRenderSetup: start missing -> (2)', run('BvrGenerateRenderSetup', { filename: 'r.txt', target: gname }).log.includes('RenderSetupGenerate command missing start parameter (2).'));
    ok('BvrGenerateRenderSetup: domap missing -> (4)', run('BvrGenerateRenderSetup', { filename: 'r.txt', target: gname, start: 1, end: 10 }).log.includes('RenderSetupGenerate command missing domap parameter (4).'));
    const w1 = S.workers.length; run('BvrGenerateRenderSetup', { filename: 'r.txt', target: gname, start: 1, end: 10, domap: true });
    ok('BvrGenerateRenderSetup: valid -> writer (not yet attested), classname "" doui false', S.workers.length === w1 + 1 && S.workers.at(-1).args.classname === '' && S.workers.at(-1).args.doui === false);
  }
  // ================= SaveActor / LoadActor / ImportBVHActor
  {
    sel(cog); S.hooks.fileDialog = (title, filter) => { out.dlg = [title, filter]; return 'C:/actors/hero.xsi'; };
    const r = run('BvrSaveActor');
    ok('BvrSaveActor: Save Actor dialog with the actor filter, InitDir stored, export worker', out.dlg?.[0] === 'Save Actor' && out.dlg[1] === 'Actor (*.xsi)|*.xsi||' && prop(A.scene.root, 'ActorFile').val('InitDir') === 'C:/actors' && S.workers.at(-1).worker === 'SIExportDotXSIFile' && S.workers.at(-1).args.options.output_file_format_version === 360, [r.msgs, out.dlg]);
    ok('BvrSaveActor: LoopSkill deleted, model selected', !prop(hips, 'LoopSkill') && A.selection[0] === model);
    S.hooks.fileDialog = () => 'C:/actors/hero.xsi'; sel(cog); run('BvrLoadActor');
    ok('BvrLoadActor: no selection needed, import worker with the .wgmp sidecar path, DeselectAll', S.workers.at(-1).worker === 'SIImportDotXSIFile' && S.workers.at(-1).args.wgmp === 'C:/actors/hero.wgmp' && A.selection.length === 0);
    delete S.hooks.fileDialog;
    const ra = prop(hips, 'RTKActor'); hips.removeProperty(ra); sel(cog);
    ok('BvrSaveActor: without RTKActor -> message', run('BvrSaveActor').msgs[0] === 'The actor must be properly generated before it can be saved. Please try the Generate action and save the resultant actor.');
    hips.addProperty(ra);
    sel(null); const rb = run('BvrImportBVHActor'); const bv = prop(A.scene.root, 'BVHActor');
    ok('BvrImportBVHActor: BVHActor on the scene root, help behave11.htm, builder worker (not yet attested)', bv && /behave11\.htm$/.test(bv.helpFile) && S.workers.at(-1).worker === 'bvhActor' && S.workers.at(-1).args.ActorName === 'Actor' && nya(rb));
  }
  delete S.hooks.msgBox;
  return out;
}, { NAMES });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_bvr_b13a_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
