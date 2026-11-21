// CMD-B11f: the 15 action.dll commands of src/commands/actionB11f*.ts (viseme / speech / Evolver actions, lip-sync
// freeze, shape copy / groups, deform strip, clip effects / offsets, clip cut in space). No XSIBATCH golden exists for
// the row: this is a contract check against docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a clear message naming the command);
//   3. the stated result of each command (return value / scene state / logged message / undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_action_b11f_commands.mjs
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
  'CopyShape', 'CreateEvolverSpeechAction', 'CreateOffsetEffect', 'CreateShapeGroup', 'CreateSpeechAction', 'CreateVisemeAction',
  'CutClipInSpace', 'FreezeLipSync', 'Open SE for Link With Deform', 'RemoveEffect', 'ResetOffset', 'SetShapeGroup',
  'SetupEvolverVisemes', 'StoreViseme', 'StripDeformOperators',
];
// Required input without a default: the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['CopyShape', 'CreateOffsetEffect', 'CutClipInSpace', 'RemoveEffect', 'SetShapeGroup', 'SetupEvolverVisemes', 'StoreViseme']);

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
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CutClipInSpace') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  // log lines are collected from the 'log' event (the log itself is capped by the command-log size preference)
  const run = (n, a = {}) => { const lines = []; const off = A.events.on('log', () => lines.push(A.log[A.log.length - 1]?.text)); try { return { v: A.run(n, a), log: lines }; } catch (e) { return { err: String(e?.message ?? e), log: lines }; } finally { off(); } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const S = A.actionB11f; const root = A.scene.root; const cube = A.scene.find('cube');
  const srcs = () => root.properties.filter(p => p.type === 'actionsource');
  const data = (p) => JSON.parse(p.val('data') || '{}');
  const status = () => S.lastStatus?.status;
  const reset = () => { A.select([cube]); A.compSel = null; A.anim.marked.clear(); };
  const undoAll = (u0) => { while (A.undoStack.length > u0) A.undo(); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  out.registered = [...(S?.registered ?? [])];

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    undoAll(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // 3. stated results
  // ---- StoreViseme
  { const u0 = A.undoStack.length; const n0 = srcs().length; const px = cube.kinematics.local.get('posx').value;
    const r = run('StoreViseme', { InputObj: 'cube.kine.local.posx,cube.kine.local.posy', Name: 'Vis1', PhonemeType: 3 }); const s = r.v;
    ok('StoreViseme makes a viseme source on the model', s && s.name === 'Vis1' && s.sourceClass === 'viseme' && srcs().length === n0 + 1, r.err);
    ok('StoreViseme: PhonemeType item, stored values, FrameStart 1 / FrameEnd 5', s && data(s).PhonemeType === 3 && data(s)['cube.kine.local.posx'] === px && s.val('FrameStart') === 1 && s.val('FrameEnd') === 5 && Object.keys(data(s)).length === 3, s && data(s));
    undoAll(u0); ok('StoreViseme undo', srcs().length === n0);
    const g = run('StoreViseme', { InputObj: 'cube.kine.global.posx', Name: 'Vis2' });
    ok('StoreViseme with only read-only parameters adds nothing', g.v === null && srcs().length === n0 && status() === 1, [g.v, g.err]);
    ok('StoreViseme without InputObj is E_POINTER', /0x80004003/.test(run('StoreViseme', { Model: 'Scene_Root' }).err ?? ''));
    const mix = root.property('mixer'); mix.lockLevel = 0xffff; const l = run('StoreViseme', { InputObj: 'cube.kine.local.posx' }); mix.lockLevel = 0;
    ok('StoreViseme on a locked mixer is E_ACCESSDENIED', /0x80070005/.test(l.err ?? '') && srcs().length === n0, l.err); undoAll(u0); }
  // ---- CreateVisemeAction / control finder
  { const u0 = A.undoStack.length; const n0 = srcs().length;
    const r0 = run('CreateVisemeAction', { Model: 'Scene_Root' }); ok('CreateVisemeAction without Face Robot controls does nothing (S_FALSE)', r0.v === null && status() === 1 && nya(r0) === 1, r0);
    ok('CreateVisemeAction with an empty Model returns S_FALSE', run('CreateVisemeAction').v === null && status() === 1);
    cube.frTag = 'FaceControl_Mouth';
    const r = run('CreateVisemeAction', { Model: 'Scene_Root' }); const s = r.v; const d = s ? data(s) : {};
    ok('CreateVisemeAction keys six local channels of each control with 0', s && s.name === 'Viseme' && s.sourceClass === 'viseme' && ['rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'].every(c => d[`cube.kine.local.${c}`] === 0) && Object.keys(d).length === 6, d);
    cube.frTag = 'Mouth'; ok('the finder needs the Control token', run('CreateVisemeAction', { Model: 'Scene_Root' }).v === null);
    cube.frTag = 'ControlEye'; ok('the finder needs Mouth / Tongue / Jaw', run('CreateVisemeAction', { Model: 'Scene_Root' }).v === null);
    delete cube.frTag; undoAll(u0); ok('CreateVisemeAction undo', srcs().length === n0); }
  // ---- CreateSpeechAction + FreezeLipSync
  { const u0 = A.undoStack.length; const n0 = srcs().length; const c0 = cube.clusters.length; cube.frTag = 'JawControl';
    const sub0 = S.subtasks.length;
    const r = run('CreateSpeechAction', { Face: 'cube', Name: 'Talk' }); const s = r.v; const d = s ? data(s) : {};
    const cl = cube.clusters.find(c => c.name === 'Shape');
    ok('CreateSpeechAction creates the Shape cluster through SICreateCluster', cl && cube.clusters.length === c0 + 1 && cl.elements.size === cube.primitive.mesh().positions.length / 3 && S.subtasks.slice(sub0).some(t => t.task === 'SICreateCluster'), [r.err]);
    const shapeItem = Object.keys(s?.itemInfo ?? {}).find(k => s.itemInfo[k].group === 'Face,Mesh');
    ok('CreateSpeechAction: shape weight item (group Face,Mesh, flag 1) + six control items grouped by tag', s && s.name === 'Talk' && s.sourceClass === 'speech' && shapeItem && s.itemInfo[shapeItem].flag === 1 && Object.keys(d).length === 7 && s.itemInfo['cube.kine.local.rotz']?.group === 'JawControl' && s.published === true, s && s.itemInfo);
    const rx = cube.kinematics.local.get('rotx'); const hadCurve = A.anim.fcurves.has(rx); const u1 = A.undoStack.length;
    const f = run('FreezeLipSync', { Model: 'Scene_Root' });
    ok('FreezeLipSync freezes the six speech channels into fcurves and deletes the speech source', f.v === 6 && A.anim.fcurves.get(rx)?.keys.length === 1 && !root.properties.includes(s) && nya(f) === 1, [f.v, f.err]);
    ok('FreezeLipSync uses AddFCurve and DeleteObj sub-tasks', S.subtasks.some(t => t.command === 'FreezeLipSync' && t.task === 'AddFCurve') && S.subtasks.some(t => t.command === 'FreezeLipSync' && t.task === 'DeleteObj' && /^Talk\b/.test(t.detail)));
    undoAll(u1); ok('FreezeLipSync undo restores the source and the curves', root.properties.includes(s) && A.anim.fcurves.has(rx) === hadCurve);
    delete cube.frTag; undoAll(u0); ok('CreateSpeechAction undo removes source and cluster', srcs().length === n0 && cube.clusters.length === c0);
    ok('CreateSpeechAction with an empty Face returns S_FALSE', run('CreateSpeechAction').v === null && status() === 1);
    ok('FreezeLipSync with an empty Model returns S_FALSE', run('FreezeLipSync').v === 0 && status() === 1); }
  // ---- CreateEvolverSpeechAction
  { const u0 = A.undoStack.length; const n0 = srcs().length; const name0 = cube.name;
    const r = run('CreateEvolverSpeechAction', { Model: 'Scene_Root', Name: '', KeyList: 'cube.kine.local.posx' }); const s = r.v;
    ok('CreateEvolverSpeechAction: unknown group, name kept when Name is empty', s && s.name === 'SpeechAction' && s.itemInfo['cube.kine.local.posx']?.group === 'unknown' && s.sourceClass === 'speech', [r.err, s && s.itemInfo]);
    cube.name = 'expressions_cube'; const r2 = run('CreateEvolverSpeechAction', { Model: 'Scene_Root', Name: 'Ev', KeyList: [cube.kinematics.local.get('posy')] }); cube.name = 'teeth_cube';
    const r3 = run('CreateEvolverSpeechAction', { Model: 'Scene_Root', Name: 'Ev2', KeyList: [cube.kinematics.local.get('posz')] }); cube.name = name0;
    ok('CreateEvolverSpeechAction groups expressions / teeth by full name', Object.values(r2.v?.itemInfo ?? {})[0]?.group === 'expressions' && Object.values(r3.v?.itemInfo ?? {})[0]?.group === 'teeth' && r2.v.name === 'Ev', [r2.err, r3.err]);
    undoAll(u0); ok('CreateEvolverSpeechAction undo', srcs().length === n0); }
  // ---- SetupEvolverVisemes
  { const u0 = A.undoStack.length; const n0 = srcs().length;
    const r0 = run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [], FileName: 'C:\\evolver.txt' });
    ok('SetupEvolverVisemes with an unreadable mapping file logs 0x444 and fails (batch 12: built-in XML parser)', /SetupEvolverVisemes/.test(r0.err ?? '') && r0.log.some(l => /0x444/.test(l)) && nya(r0) === 0, r0);
    S.evolverParser = () => ({ prefix: 'EV_', visemes: [{ name: 'AA', phoneme: 2, values: { 'cube.kine.local.posx': 5 } }] });
    const px = cube.kinematics.local.get('posx'); const v0 = px.value;
    const r = run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [], FileName: 'C:\\evolver.txt' }); const s = r.v?.Action?.[0];
    ok('SetupEvolverVisemes builds one viseme source per viseme', s && s.name === 'EV_AA' && data(s)['cube.kine.local.posx'] === 5 && data(s).PhonemeType === 2 && s.val('FrameEnd') === 5 && px.value === v0, [r.err, s && data(s)]);
    ok('SetupEvolverVisemes lists the changed parameters in KeyList', r.v?.KeyList?.length === (v0 === 5 ? 0 : 1) && (v0 === 5 || r.v.KeyList[0] === px));
    S.evolverParser = () => ({ visemes: [] }); run('SetupEvolverVisemes', { Model: 'Scene_Root', ClipList: [] }); ok('SetupEvolverVisemes with no viseme is S_FALSE', status() === 1);
    S.evolverParser = null; ok('SetupEvolverVisemes without ClipList is E_POINTER', /0x80004003/.test(run('SetupEvolverVisemes', { Model: 'Scene_Root' }).err ?? ''));
    undoAll(u0); ok('SetupEvolverVisemes undo', srcs().length === n0); }
  // ---- CopyShape, shape groups, Open SE
  { reset(); const u0 = A.undoStack.length; const nPts = cube.primitive.mesh().positions.length / 3;
    const sk = A.run('StoreShapeKey', { InputObj: 'cube', Name: 'SK1', RefMode: ':siShapeLocalReferenceMode:siShapeReferenceMode' });   // a local-reference key (CMD-B20a: the registry default RefMode is the object mode)
    A.compSel = { obj: cube, kind: 'point', points: new Set([...Array(nPts).keys()]), edges: new Set(), polygons: new Set() }; const clAll = A.run('CreateCluster', { Name: 'AllPts' });
    A.compSel = { obj: cube, kind: 'point', points: new Set([0, 1]), edges: new Set(), polygons: new Set() }; const clTwo = A.run('CreateCluster', { Name: 'TwoPts' }); A.compSel = null;
    const r = run('CopyShape', { Source: sk, Target: [clAll, clTwo] }); const key = r.v?.[0];
    ok('CopyShape copies the key onto the matching cluster (name and points)', r.v?.length === 1 && key.parent === clAll && key.name === 'SK1' && key.val('data') === sk.val('data') && key.elements?.length === nPts, [r.err, r.v?.length]);
    ok('CopyShape: element count mismatch is error 101', r.log.some(l => /error 101/.test(l)));
    const rk = clAll.properties.find(p => p.type === 'resultclusterkey'); ok('CopyShape creates the result cluster key (local reference -> kind 3)', rk && rk.val('kind') === 3, rk && rk.val('kind'));
    rk.set('kind', 5); const r2 = run('CopyShape', { Source: sk, Target: clAll }); rk.set('kind', 3);
    ok('CopyShape: result key kind mismatch is error 102, S_FALSE', r2.v?.length === 0 && r2.log.some(l => /error 102/.test(l)) && status() === 1, r2.log);
    const r3 = run('CopyShape', { Source: 'cube', Target: clAll }); ok('CopyShape: a source that is not a cluster shape key is error 100', r3.v === null && r3.log.some(l => /error 100/.test(l)), r3);
    ok('CopyShape onto the object (complete point cluster stand-in)', run('CopyShape', { Source: sk, Target: 'cube' }).v?.[0]?.parent === cube);
    // groups
    // batch 12 (Q3): empty Name sets no name; a name used by a shape key of the owner is made unique; one owner only
    const g = run('CreateShapeGroup', { InputObj: [sk], Name: 'ShapeGroup' }); ok('CreateShapeGroup: a free name is used as is', g.v === 'ShapeGroup' && sk.shapeGroup === 'ShapeGroup' && nya(g) === 0, g);
    const g0 = run('CreateShapeGroup', { InputObj: [key], Name: '' }); ok('CreateShapeGroup: empty name -> no name', g0.v === '' && !key.shapeGroup, g0); A.undo();
    run('CreateShapeGroup', { InputObj: [key], Name: 'G1' }); const g2 = run('CreateShapeGroup', { InputObj: [key], Name: 'G1' }); ok('CreateShapeGroup: a taken name gets a suffix', g2.v === 'G11' && key.shapeGroup === 'G11', g2.v);
    A.undo(); A.undo(); ok('CreateShapeGroup undo', !key.shapeGroup);
    ok('CreateShapeGroup with no input does nothing', run('CreateShapeGroup', { Name: 'x' }).v === null);
    ok('SetShapeGroup: empty Name is E_INVALIDARG', /0x80070057/.test(run('SetShapeGroup', { InputObj: [sk], Name: '' }).err ?? ''));
    const bad = run('SetShapeGroup', { InputObj: [sk, 'cube'], Name: 'G' }); ok('SetShapeGroup: a non-key item is E_POINTER and changes nothing', /0x80004003/.test(bad.err ?? '') && sk.shapeGroup === 'ShapeGroup', bad.err);
    ok('SetShapeGroup sets the name', run('SetShapeGroup', { InputObj: [sk, key], Name: 'Mouth' }).v === 2 && sk.shapeGroup === 'Mouth' && key.shapeGroup === 'Mouth');
    A.undo(); ok('SetShapeGroup undo', sk.shapeGroup === 'ShapeGroup' && !key.shapeGroup);
    // Open SE
    const v0 = S.transientViews.length;
    ok('Open SE: no cluster -> S_FALSE', run('Open SE for Link With Deform', { Cluster: 'cube' }).v === 1);
    const o1 = run('Open SE for Link With Deform', { Cluster: clAll }); const o2 = run('Open SE for Link With Deform', { Cluster: clAll, LinkWithOri: true });
    const tv = S.transientViews.slice(v0);
    ok('Open SE opens a transient view (all nodes / filter 2, attributes 8 3, mode 2, flags 0x601)', o1.v === 0x562e80c7 && tv.length === 2 && tv[0].filter === 'all' && tv[1].filter === 2 && tv[0].flags === 0x601 && tv[0].mode === 2 && tv[0].attributes.join() === '8,3' && nya(o1) === 1, tv);
    S.noUI = true; ok('Open SE without UI shows nothing', run('Open SE for Link With Deform', { Cluster: clAll }).v === 0 && S.transientViews.length === v0 + 2); S.noUI = false;
    undoAll(u0); ok('CopyShape / shape group undo', !cube.properties.includes(sk) && !cube.clusters.includes(clAll)); }
  // ---- StripDeformOperators
  { reset(); const u0 = A.undoStack.length; const prim = cube.primitive; const n0 = prim.operators.length;
    A.select([cube]); A.run('ApplyOp', { PresetObj: 'Twist' }); A.select([cube]); A.run('ApplyOp', { PresetObj: 'Bend' }); A.select([cube]); const n1 = prim.operators.length;
    const r = run('StripDeformOperators', { InputObj: 'cube' });
    ok('StripDeformOperators removes the modeling-region operators', n1 === n0 + 2 && r.v === 2 && prim.operators.length === n0, [n0, n1, r.v, r.err]);
    A.undo(); ok('StripDeformOperators undo', prim.operators.length === n1);
    const tw = prim.operators.find(o => o.type !== 'geom' && o.get('mute')); if (tw) tw.set('mute', true);
    const r2 = run('StripDeformOperators', { InputObj: 'cube' }); ok('StripDeformOperators skips deactivated (muted) operators', !tw || (r2.v === 1 && prim.operators.includes(tw)), [r2.v, !!tw]); A.undo(); if (tw) tw.set('mute', false);
    const tl = prim.operators.filter(o => o.region === 'modeling' && o.type !== 'geom').pop(); tl.lockLevel = 1;
    const r3 = run('StripDeformOperators', { InputObj: 'cube' }); ok('StripDeformOperators keeps locked operators with a warning', prim.operators.includes(tl) && r3.log.some(l => /locked/.test(l) && /0xdd/.test(l)), [r3.log, r3.v, r3.err]); A.undo(); delete tl.lockLevel;
    A.run('SetConstructionMode', { Mode: 'secondaryshape' }); A.select([cube]); A.run('ApplyOp', { PresetObj: 'Taper' }); A.select([cube]); const sec = prim.operators.find(o => o.region === 'secondaryshape'); A.run('SetConstructionMode', { Mode: 'animation' });
    const r4 = run('StripDeformOperators', { InputObj: 'cube' }); ok('StripDeformOperators outside secondary-shape mode leaves the secondary region', sec && prim.operators.includes(sec) && r4.v === 2, [r4.v, !!sec]); A.undo();
    A.run('SetConstructionMode', { Mode: 'secondaryshape' }); const r5 = run('StripDeformOperators', { InputObj: 'cube' }); A.run('SetConstructionMode', { Mode: 'modeling' });
    ok('StripDeformOperators in secondary-shape mode strips that region and the modeling region', r5.v === 3 && !prim.operators.includes(sec), r5.v); A.undo();
    ok('StripDeformOperators with no object does nothing', run('StripDeformOperators', { InputObj: 'nosuch' }).v === 0);
    undoAll(u0); ok('StripDeformOperators setup undone', prim.operators.length === n0); }
  // ---- clip effects
  { reset(); const u0 = A.undoStack.length;
    A.run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'Act', AddClip: true, ClipOffset: 1 });
    const mix = root.property('mixer'); const clip = mix.clips.find(c => c.source === 'Act' || c.name === 'Act' || /^Act/.test(c.name)); const items = () => clip.effectItems ?? [];
    out.clip = clip && { name: clip.name, start: clip.start, duration: clip.duration };
    const e = run('CreateOffsetEffect', { Clip: clip.name }); const end = clip.start + clip.duration;
    ok('CreateOffsetEffect: (this) + param on every item, keys at start and start + duration', e.v > 0 && items().length === e.v && items().every(it => it.valuemap === '(this) + param' && it.param.length === 2 && it.param[0].time === clip.start && it.param[1].time === end) && clip.offsetEffect === true, [e.err, items()[0]]);
    run('CreateOffsetEffect', { Clip: clip.name }); ok('CreateOffsetEffect wraps an existing expression', items()[0].valuemap === '((this) + param) + param', items()[0]?.valuemap);
    A.undo(); ok('CreateOffsetEffect undo', items()[0].valuemap === '(this) + param');
    clip.lockLevel = 2; const lk = run('CreateOffsetEffect', { Clip: clip.name }); delete clip.lockLevel; ok('CreateOffsetEffect on a locked clip is E_ACCESSDENIED', /0x80070005/.test(lk.err ?? ''), lk.err);
    // ResetOffset
    const posx = cube.kinematics.local.get('posx');
    const ro = run('ResetOffset', { InputObjs: 'cube.kine.local.posx', Time: 5 });
    ok('ResetOffset keys the single contributing clip item at Time', ro.v === 1 && items().some(it => it.param.some(k => k.time === 5 && k.value === 0)) && nya(ro) === 0, [ro.err, ro.v]);
    const none = run('ResetOffset', { InputObjs: 'cube.kine.local.posx', Time: 100000 }); ok('ResetOffset with no contributing action is 0x3fc', /0x3fc/.test(none.err ?? '') && /0x80070057/.test(none.err ?? ''), none.err);
    const nd = run('ResetOffset', { InputObjs: 'cube.kine.local.pposx', Time: 5 }); ok('ResetOffset on a parameter not driven by the mixer is 0x3f6', /0x3f6/.test(nd.err ?? ''), nd.err);
    A.run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'Act2', AddClip: true, ClipOffset: 1 });
    const two = run('ResetOffset', { InputObjs: 'cube.kine.local.posx', Time: 5 }); ok('ResetOffset with two contributing actions is 0x3fb', /0x3fb/.test(two.err ?? ''), two.err); A.undo();
    ok('ResetOffset with nothing marked does nothing', run('ResetOffset').v === 0);
    // RemoveEffect
    const rm = run('RemoveEffect', { Clip: clip.name });
    ok('RemoveEffect clears every expression and the effect animation', items().every(it => it.valuemap === '' && it.param.length === 0) && clip.offsetEffect === false && S.subtasks.some(t => t.command === 'RemoveEffect' && t.task === 'RemoveAnimation'), rm.err);
    A.undo(); ok('RemoveEffect undo', items()[0].valuemap === '(this) + param' && items()[0].param.length >= 2);
    // CutClipInSpace
    const other = [...A.scene.allObjects()].find(o => o !== cube && o.name !== 'Scene_Root');
    const n0 = mix.clips.length; const s0 = srcs().length;
    const c = run('CutClipInSpace', { Model: 'Scene_Root', InputObjs: 'cube', Clip: clip.name }); const nc = c.v?.clip;
    ok('CutClipInSpace adds a clip of a copied source at the original start', nc && mix.clips.length === n0 + 1 && srcs().length === s0 + 1 && nc.start === clip.start && nc.source !== clip.source, [c.err]);
    ok('CutClipInSpace moves the items of the given objects to the new clip', nc && clip.rules.every(r => r.active === false) && nc.rules.every(r => r.active === true) && nc.rules.length === clip.rules.length, nc && [clip.rules, nc.rules]);
    A.undo();
    ok('CutClipInSpace undo', mix.clips.length === n0 && srcs().length === s0, [mix.clips.length, n0, srcs().length, s0]);
    if (other) { const c2 = run('CutClipInSpace', { Model: 'Scene_Root', InputObjs: other.name, Clip: clip.name }); const n2 = c2.v?.clip;
      ok('CutClipInSpace with other objects deactivates the new clip items', n2 && n2.rules.every(r => r.active === false) && mappingActive(clip), [c2.err]); }
    ok('CutClipInSpace without Clip is E_POINTER', /0x80004003/.test(run('CutClipInSpace', { Model: 'Scene_Root', InputObjs: 'cube' }).err ?? ''));
    function mappingActive(cl) { return !cl.rules || cl.rules.every(r => r.active !== false); }
    undoAll(u0); ok('clip setup undone', !srcs().some(s => s.name === 'Act')); }
  reset();
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
report('row registered every name itself', NAMES.every(n => got.registered.includes(n)), JSON.stringify(got.registered));
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_action_b11f_commands: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
