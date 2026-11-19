// CMD-B11e: the 15 action.dll commands of src/commands/actionB11eMaps.ts and actionB11eSources.ts (connection /
// value maps, mapping rules, action items, store-action defaults, action presets, source copy, pose items, clip
// merge). There is no XSIBATCH golden for the row: this is a contract check against
// docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values with
//      flag 0x200 left out; defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command instead);
//   3. the stated result of each command (return values, scene state, logged messages, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_action_b11e_commands.mjs
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

const NAMES = ['AddMappingRule', 'AddPoseActionItems', 'CopySourceActionToFolder', 'CreateConnectionMap', 'CreateEmptyConnectionMap',
  'CreateEmptyValueMap', 'CreateValueMap', 'DeleteMappingRule', 'GetMappingRule', 'GetNumMappingRules', 'GetStoreActionDefaults',
  'LoadActionPreset', 'MergeClips', 'RemoveActionItem', 'SetMappingRule'];
// Required input without a default: the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['AddMappingRule', 'SetMappingRule', 'DeleteMappingRule', 'GetNumMappingRules', 'GetMappingRule', 'RemoveActionItem',
  'LoadActionPreset', 'CopySourceActionToFolder', 'AddPoseActionItems', 'MergeClips']);

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
const base = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(base.includes('?') ? base : `${base}?demo`); // the sample scene (cube) is the demo scene
await page.waitForFunction(() => !!window.Application?.commands?.get('MergeClips') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status, log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested: .*\(CMD-B11e\)/.test(l)).length;
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };
  const rulesOf = (t) => t.rules.map(r => `${r.from}>${r.to}`).join('|');

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
  const root = A.scene.root;

  // 3a. empty maps
  {
    const had = !!root.property('mixer');
    const r = run('CreateEmptyConnectionMap', { Obj1: 'Scene_Root' }); const t = r.v; const mix = root.property('mixer');
    ok('CreateEmptyConnectionMap returns an empty connection template on the mixer', t?.isMappingTemplate && t.mapKind === 'connection' && t.count() === 0 && mix.mappingTemplatesB11e.includes(t) && t.parent === mix, r.err);
    ok('CreateEmptyConnectionMap keeps the mixer template record', mix.cnxTemplates?.some(x => x === t.record && x.active));
    A.undo(); ok('CreateEmptyConnectionMap undo', !root.property('mixer')?.mappingTemplatesB11e?.includes(t) && (!had ? !root.property('mixer') : true));
    A.redo(); ok('CreateEmptyConnectionMap redo', root.property('mixer')?.mappingTemplatesB11e?.includes(t));
    const v = run('CreateEmptyValueMap', { Obj1: cube }).v;
    ok('CreateEmptyValueMap: value template on the model of a non-model object', v?.mapKind === 'value' && v.count() === 0 && v.parent === root.property('mixer') && root.property('mixer').valueTemplates.includes(v.record));
    const c2 = run('CreateEmptyConnectionMap', { Obj1: 'Scene_Root' }).v;
    ok('second template gets a unique name', c2 && c2.name !== t.name, [t.name, c2?.name]);
    ok('CreateConnectionMap without Obj2 = empty map', run('CreateConnectionMap', { Obj1: 'Scene_Root' }).v?.count() === 0);
    ok('CreateValueMap without Obj2 = empty value map', run('CreateValueMap', { Obj1: 'Scene_Root' }).v?.mapKind === 'value');
    root.lockFlags = 1; const lk = run('CreateEmptyConnectionMap', { Obj1: 'Scene_Root' }); delete root.lockFlags;
    ok('locked Obj1 -> 0x80070005', lk.status === 0x80070005, lk);
    ok('unresolvable Obj1 fails', /CreateEmptyValueMap/.test(run('CreateEmptyValueMap', { Obj1: 'nothing_here' }).err ?? ''));

    // 3b. rules
    const name = t.fullName;
    ok('template resolves by full name', run('GetNumMappingRules', { MappingTemplate: name }).v === 0, [name, run('GetNumMappingRules', { MappingTemplate: name }).err]);
    run('AddMappingRule', { MappingTemplate: t, From: 'a', To: 'A' });
    run('AddMappingRule', { MappingTemplate: t, From: 'b', To: 'B' });               // Index 0 -> first
    run('AddMappingRule', { MappingTemplate: t, From: 'c', To: 'C', Index: 2 });     // 1-based -> second
    run('AddMappingRule', { MappingTemplate: name, From: 'd', To: 'D', Index: 99 }); // clamped to the end
    ok('AddMappingRule positions (Index 0 = first, 1-based, clamped)', rulesOf(t) === 'b>B|c>C|a>A|d>D', rulesOf(t));
    A.undo(); ok('AddMappingRule undo removes the rule', rulesOf(t) === 'b>B|c>C|a>A'); A.redo(); ok('AddMappingRule redo', rulesOf(t) === 'b>B|c>C|a>A|d>D');
    const miss = run('AddMappingRule', { MappingTemplate: t, From: 'x' }); ok('AddMappingRule without To -> E_POINTER', miss.status === 0x80004003, miss);
    const mt = run('AddMappingRule', { From: 'x', To: 'y' }); ok('AddMappingRule without template -> E_POINTER', mt.status === 0x80004003, mt);
    ok('GetNumMappingRules', run('GetNumMappingRules', { MappingTemplate: t }).v === 4);
    const g0 = run('GetMappingRule', { MappingTemplate: t }).v; ok('GetMappingRule Index 0 = rule 1 with flags', g0?.From === 'b' && g0.To === 'B' && g0.Active === true && g0.PoseOffset === false, g0);
    ok('GetMappingRule Index 3', run('GetMappingRule', { MappingTemplate: t, Index: 3 }).v?.From === 'a');
    const gx = run('GetMappingRule', { MappingTemplate: t, Index: 5 }); ok('GetMappingRule Index > count fails', !!gx.err && nya(gx) === 1, gx);
    t.hasFlags = false; const gn = run('GetMappingRule', { MappingTemplate: t }).v; t.hasFlags = true;
    ok('GetMappingRule without the flag interface: Active / PoseOffset false', gn.Active === false && gn.PoseOffset === false, gn);
    run('SetMappingRule', { MappingTemplate: t, From: 'cc', To: '', Index: 2, Active: 0 });
    ok('SetMappingRule: strings as given, Active 0, PoseOffset -1 unchanged', t.rules[1].from === 'cc' && t.rules[1].to === '' && t.rules[1].active === false && t.rules[1].poseOffset === false, t.rules[1]);
    run('SetMappingRule', { MappingTemplate: t, From: 'cc', To: 'CC', Index: 2, PoseOffset: 1 });
    ok('SetMappingRule PoseOffset 1, Active -1 unchanged', t.rules[1].poseOffset === true && t.rules[1].active === false && t.rules[1].to === 'CC');
    A.undo(); A.undo(); ok('SetMappingRule undo restores strings and flags', t.rules[1].from === 'c' && t.rules[1].to === 'C' && t.rules[1].active === true && t.rules[1].poseOffset === false, t.rules[1]);
    run('DeleteMappingRule', { MappingTemplate: t }); ok('DeleteMappingRule Index 0 removes the first rule', rulesOf(t) === 'c>C|a>A|d>D', rulesOf(t));
    A.undo(); ok('DeleteMappingRule undo', rulesOf(t) === 'b>B|c>C|a>A|d>D');
    run('DeleteMappingRule', { MappingTemplate: t, Index: 4 }); ok('DeleteMappingRule Index 4', rulesOf(t) === 'b>B|c>C|a>A'); A.undo();
    ok('rule queries are not undoable', (() => { const u = A.undoStack.length; run('GetMappingRule', { MappingTemplate: t }); run('GetNumMappingRules', { MappingTemplate: t }); return A.undoStack.length === u; })());
  }

  // 3c. full maps between two models
  {
    reset();
    const m1 = run('CreateModel', { InputObj: 'cube', Name: 'B11eSrc' }).v;
    const nul = run('GetPrim', { PresetObj: 'Null', Name: 'b11eNull' }).v;
    const m2 = run('CreateModel', { InputObj: nul.name, Name: 'B11eDst' }).v;
    nul.kinematics.local.set('posx', 3); nul.kinematics.local.set('rotz', 0);
    const cm = run('CreateConnectionMap', { Obj1: m1, Obj2: m2 });
    ok('CreateConnectionMap: one rule per object pair, full names', cm.v?.mapKind === 'connection' && rulesOf(cm.v) === `${cube.fullName}>${nul.fullName}` && cm.v.parent === m1.property('mixer'), [cm.err, cm.v && rulesOf(cm.v)]);
    ok('CreateConnectionMap logs the unread collector', nya(cm) >= 1);
    const vm = run('CreateValueMap', { Obj1: m1, Obj2: m2, Mode: 3, Scope: 1 }); const d = 3 - cube.kinematics.local.val('posx');
    ok('CreateValueMap Mode 3 (translation) Scope 1 (local): three rules, this + %lf', vm.v?.mapKind === 'value' && vm.v.count() === 3 && vm.v.rules[0].from === `${cube.fullName}.kine.local.posx` && vm.v.rules[0].to === (Math.abs(d) < 1e-9 ? '' : `this + ${d.toFixed(6)}`), [vm.err, vm.v?.rules]);
    { const dz = nul.kinematics.local.val('posz') - cube.kinematics.local.val('posz'); ok('CreateValueMap: |difference| below 1e-9 -> empty expression', Math.abs(dz) < 1e-9 && vm.v?.rules.find(r => r.from.endsWith('posz'))?.to === '', [dz, vm.v?.rules]); }
    ok('CreateValueMap Mode 4 Scope 2: 9 channels x local + global', run('CreateValueMap', { Obj1: m1, Obj2: m2, Mode: 4, Scope: 2 }).v?.count() === 18);
    ok('CreateValueMap Mode 1 Scope 0: global scaling', (() => { const v = run('CreateValueMap', { Obj1: m1, Obj2: m2, Mode: 1, Scope: 0 }).v; return v.count() === 3 && v.rules.every(r => /kine\.global\.scl[xyz]$/.test(r.from)); })());
    ok('CreateValueMap Mode 0: no channel', run('CreateValueMap', { Obj1: m1, Obj2: m2, Mode: 0 }).v?.count() === 0);
    const n2 = run('GetPrim', { PresetObj: 'Null', Name: 'b11eNull2' }).v; A.record('reparent', () => m2.addChild(n2), () => root.addChild(n2));
    const before = m1.property('mixer').mappingTemplatesB11e.length;
    const mm = run('CreateValueMap', { Obj1: m1, Obj2: m2 });
    ok('CreateValueMap: unequal lists -> nothing created', !!mm.err && m1.property('mixer').mappingTemplatesB11e.length === before, mm);
    out.models = { m1: m1.name, m2: m2.name };
  }

  // 3d. action sources
  {
    reset();
    const m1 = A.scene.find(out.models.m1); const m2 = A.scene.find(out.models.m2);
    const src = run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'B11eAct' }).v;
    const items = () => Object.keys(JSON.parse(src.val('data')));
    const n0 = items().length; const first = items()[0];
    const r1 = run('RemoveActionItem', { Source: src, Name: first });
    ok('RemoveActionItem removes the named item', !items().includes(first) && items().length === n0 - 1 && src.val('items') === n0 - 1, [r1.err, items()]);
    A.undo(); ok('RemoveActionItem undo', items().length === n0 && src.val('items') === n0);
    const bad = run('RemoveActionItem', { Source: src.name, Name: `${first},no_such_item` });
    ok('RemoveActionItem: unknown name -> 0x80020009, message 0x9f, nothing kept', bad.status === 0x80020009 && bad.log.some(l => /0x9f: no_such_item/.test(l)) && items().length === n0, bad);
    run('RemoveActionItem', { Source: src }); ok('RemoveActionItem with empty Name removes every item', items().length === 0 && src.val('items') === 0);
    A.undo(); ok('RemoveActionItem remove-all undo', items().length === n0);
    src.sourceType = 6; src.layerLocked = true; const lk = run('RemoveActionItem', { Source: src, Name: first }); delete src.sourceType; delete src.layerLocked;
    ok('RemoveActionItem: locked keying layer -> 0x80070005 + message 0x447', lk.status === 0x80070005 && lk.log.some(l => /0x447/.test(l)), lk);

    // AddPoseActionItems
    const pr = run('AddPoseActionItems', { InputObjs: [src, cube] }); const vals = JSON.parse(src.val('data'));
    const pose = ['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'].map(c => vals[`OFFSET_ROOT.kine.local.${c}`]);
    ok('AddPoseActionItems writes the identity pose (1,1,1,0,0,0,0,0,0) on action sources only', pr.v === 1 && pose.join() === '1,1,1,0,0,0,0,0,0' && src.val('items') === n0 + 9, [pr.err, pose]);
    ok('AddPoseActionItems skips a source that already has the items', run('AddPoseActionItems', { InputObjs: src }).v === 0);
    A.undo(); ok('AddPoseActionItems undo', !('OFFSET_ROOT.kine.local.sclx' in JSON.parse(src.val('data'))));
    ok('AddPoseActionItems Name', run('AddPoseActionItems', { InputObjs: src.name, Name: 'Hip' }).v === 1 && JSON.parse(src.val('data'))['Hip.kine.local.sclx'] === 1); A.undo();

    // CopySourceActionToFolder
    const cp = run('CopySourceActionToFolder', { InputObj: src, Target: m2 });
    const copy = cp.v?.[0];
    ok('CopySourceActionToFolder copies the source into the target', copy && copy !== src && m2.properties.includes(copy) && copy.val('data') === src.val('data') && copy.type === src.type, cp.err);
    A.undo(); ok('CopySourceActionToFolder undo', !m2.properties.includes(copy));
    const two = run('CopySourceActionToFolder', { InputObj: [src], Target: [m1, m2] }).v;
    ok('CopySourceActionToFolder: every target x every source, unique names', two.length === 2 && m1.properties.filter(p => p.type === 'actionsource').length >= 2 && two[0].name !== src.name, two.map(x => x.name));
    A.undo();
    ok('CopySourceActionToFolder nothing copied -> S_FALSE', run('CopySourceActionToFolder', { InputObj: 'cube', Target: m2 }).v.length === 0 && A.actionB11e.lastStatus.CopySourceActionToFolder === 1);

    // GetStoreActionDefaults
    const p = cube.kinematics.local.get('posx'); const fc = A.anim.fcurve(p, true);
    fc.keys = [{ time: 5, value: 0, left: 0, right: 0, interp: 3 }, { time: 20, value: 1, left: 1, right: 1, interp: 3 }];
    const q1 = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 1 }).v;
    ok('GetStoreActionDefaults Mode 1: key range and count of animated parameters', q1?.From === 5 && q1.To === 20 && q1.Size === 1, q1);
    const q4 = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 4 }).v; const keyable = cube.kinematics.local.params.filter(x => x.keyable).length;
    ok('GetStoreActionDefaults Mode 4: static values, scene range', q4?.Size === keyable && q4.From === A.anim.startFrame && q4.To === A.anim.endFrame, [q4, keyable]);
    const q0 = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 0 }); ok('GetStoreActionDefaults Mode 0 selects nothing; logs the unread worker', q0.v?.Size === 0 && nya(q0) === 1, q0);
    ok('GetStoreActionDefaults query does not change the scene', (() => { const u = A.undoStack.length; const n = m1.properties.length; run('GetStoreActionDefaults', { InputObj: 'cube' }); return A.undoStack.length === u && m1.properties.length === n; })());
    const st = run('GetStoreActionDefaults', { InputObj: 'cube', Mode: 4, Type: 'TransientAction' });
    ok('GetStoreActionDefaults Type TransientAction stores (storage kind logged)', st.v?.type === 'actionsource' && st.log.some(l => /storage kind 2/.test(l)), st.err); A.undo();
    A.anim.removeAnimation(p);

    // LoadActionPreset
    const lp = run('LoadActionPreset', { Model: m1, FileName: 'C:\\Actions\\walk.eani' }); const s1 = lp.v;
    ok('LoadActionPreset: source named after the file, storage 0 clears the path, folder kept, .eani event', s1?.name === 'walk' && m1.properties.includes(s1) && s1.val('storage') === 0 && s1.val('filename') === '' && A.actionB11e.registry['Nle\\animmix\\action'] === 'C:\\Actions' && A.actionB11e.fileEvents.some(e => e.id === 0x20510015 && e.type === 10) && nya(lp) === 1, lp.err);
    A.undo(); ok('LoadActionPreset undo', !m1.properties.includes(s1));
    const s2 = run('LoadActionPreset', { Model: m1, FileName: 'C:\\Actions\\run.Preset', Name: 'Run', ActionStorage: 1 }).v;
    ok('LoadActionPreset Name and ActionStorage 1 keep the path', s2?.name === 'Run' && s2.val('storage') === 1 && s2.val('filename') === 'C:\\Actions\\run.Preset'); A.undo();
    const s3 = run('LoadActionPreset', { Model: m1, FileName: 'C:\\Actions\\x.xsi', ActionStorage: -1 }).v; ok('LoadActionPreset ActionStorage -1 leaves storage', s3?.val('filename') === 'C:\\Actions\\x.xsi'); A.undo();
    const bf = run('LoadActionPreset', { Model: m1, FileName: 'C:\\Actions\\walk.txt' });
    ok('LoadActionPreset: invalid extension -> 0x80070057, message 0x33', bf.status === 0x80070057 && bf.log.some(l => /0x33/.test(l)), bf);

    // MergeClips
    const a1 = run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'B11eM1', AddClip: true, ClipOffset: 1 }).v;
    const a2 = run('StoreAction', { InputObj: 'cube', Mode: 4, Name: 'B11eM2', AddClip: true, ClipOffset: 50 }).v;
    const mix = m1.property('mixer'); const c1 = mix.clips.find(c => c.source === a1.name), c2 = mix.clips.find(c => c.source === a2.name);
    const mg = run('MergeClips', { InputObjs: [c1.name, c2.name] }); const ms = mg.v;
    ok('MergeClips: new source MergedClips, start = span start, end = span end - 1', ms?.name?.startsWith('MergedClips') && m1.properties.includes(ms) && ms.frameStart === 1 && ms.frameEnd === Math.max(c1.start + c1.duration, c2.start + c2.duration) - 1 && Object.keys(JSON.parse(ms.val('data'))).length === Object.keys(JSON.parse(a1.val('data'))).length, [mg.err, ms?.frameStart, ms?.frameEnd]);
    A.undo(); ok('MergeClips undo', !m1.properties.includes(ms));
    const inv = run('MergeClips', { InputObjs: 'no_such_clip' }); ok('MergeClips: invalid selection -> 0x80070057, message 0xe3', inv.status === 0x80070057 && inv.log.some(l => /0xe3/.test(l)), inv);
    mix.clips.push({ name: 'B11eEmpty', source: 'no_source', start: 1, duration: 10, track: 3 });
    const em = run('MergeClips', { InputObjs: 'B11eEmpty' });
    ok('MergeClips: no item -> warning 0xe4, nothing returned', em.v === null && !em.err && em.log.some(l => /WARNING : .*0xe4/.test(l)) && A.actionB11e.lastStatus.MergeClips === 1, em);
    mix.clips.splice(mix.clips.findIndex(c => c.name === 'B11eEmpty'), 1);
  }
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
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_action_b11e_commands: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
