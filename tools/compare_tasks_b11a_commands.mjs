// CMD-B11a: the 19 tasks.dll commands of src/commands/tasksB11a*.ts against the Wire contracts of
// docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md. There is no XSIBATCH golden for the row: this is a contract check.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      defaults from data/commands_full.json where the registry has none);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a clear message naming the command instead);
//   3. the contract's stated result per command (return value, scene state, logged message, status, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_tasks_b11a_commands.mjs
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
  'Particle Type Pop-up Menu', 'Goal Pop-up Menu', 'SIMatchSubComponent', 'CopyCacheFiles', 'RenameCPSetLayoutItems', 'CreateObjectFromPreset',
  'ObjImport', 'SIObjExport', 'FindObjects', 'GetCurrentPass', 'SetCurrentParType', 'SetDefaultKeyMap', 'DumpCacheHeader', 'CollapseOp',
  'ReorderSceneItem', 'ImportPrefs', 'CacheObjectsIntoFile_Private', 'PickPosition', 'FilterPSet',
];
// Required input without a default (or a default the contract rejects): the default run must fail naming the command.
const DEFAULT_FAILS = new Set(['SIMatchSubComponent', 'CopyCacheFiles', 'RenameCPSetLayoutItems', 'CreateObjectFromPreset', 'FindObjects',
  'SetCurrentParType', 'DumpCacheHeader', 'ReorderSceneItem', 'ImportPrefs']);

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
// the sample scene (cube) is the ?demo scene: added when SI_URL carries no query
const base = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(base.includes('?') ? base : base + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('FilterPSet') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; const S = A.tasksB11a; const fsx = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const status = (r) => { const m = /status 0x([0-9a-f]+)/.exec(r.err ?? ''); return m ? parseInt(m[1], 16) : null; };
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool(null); A.select([cube]); A.compSel = null; S.hooks.popupChoice = null; S.hooks.pickPosition = null; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  out.batch = { registered: [...S.registered], replaced: [...S.replaced] };

  // 2. default runs (cube selected; pop-up menus answered "cancel")
  for (const n of NAMES) {
    reset(); S.hooks.popupChoice = () => null; const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // 3. contract results
  // ---- pop-up menus
  {
    const clouds = A.run('CreateParticleCloud', { InputObjs: 'cube' }); const cloud = clouds[0];
    const ptypes = cloud.primitive.operators[0].connections.particleTypes;
    let seen = null; S.hooks.popupChoice = (rec) => { seen = rec; return 0; };
    const n0 = S.inspected.length; run('Particle Type Pop-up Menu', { InputObjs: cloud });
    ok('Particle Type Pop-up Menu lists the connected particle types', seen && seen.items.length === ptypes.length && ptypes.length > 0 && seen.items[0] === ptypes[ptypes.length - 1], seen && seen.labels);
    const last = S.inspected[S.inspected.length - 1];
    ok('choosing a particle type runs InspectObj on it without keywords', S.inspected.length === n0 + 1 && last.nodes[0] === ptypes[ptypes.length - 1] && last.keywords === null, last);
    S.hooks.popupChoice = () => null; run('Particle Type Pop-up Menu', { InputObjs: cloud });
    ok('cancel inspects nothing', S.inspected.length === n0 + 1);
    A.select([]); const empty = run('Particle Type Pop-up Menu'); A.select([cube]); ok('empty InputObjs (nothing selected): nothing to do (S_FALSE)', !empty.err && S.status['Particle Type Pop-up Menu'] === 1, empty);
    seen = null; S.hooks.popupChoice = (rec) => { seen = rec; return 0; };
    run('Particle Type Pop-up Menu', { InputObjs: 'cube' }); ok('object without simulation operators: empty menu', seen && seen.items.length === 0);
    A.run('AddParticleGoal', { Target: cloud, InputObj: 'cube' });
    const goals = cloud.properties.filter(p => p.type === 'ParticleGoal');
    seen = null; const n1 = S.inspected.length; run('Goal Pop-up Menu', { InputObjs: cloud });
    ok('Goal Pop-up Menu lists the goals', seen && seen.items.length === goals.length && goals.length === 1 && seen.items[0] === goals[0], seen && seen.labels);
    const g = S.inspected[S.inspected.length - 1]; ok('choosing a goal runs InspectObj with Keywords General', S.inspected.length === n1 + 1 && g.nodes[0] === goals[0] && g.keywords === 'General', g);
    out.cloud = cloud.name; out.ptype = ptypes[0]?.name;
    reset();
  }
  // ---- SIMatchSubComponent
  {
    ok('SIMatchSubComponent: a sub-component of InputObj matches', run('SIMatchSubComponent', { InputObj: 'cube', SubComp: 'cube.pnt[0,1]' }).v === true);
    const other = [...A.scene.allObjects()].find(o => o !== cube && o.primitive);
    ok('SIMatchSubComponent: a sub-component of another object does not', other && run('SIMatchSubComponent', { InputObj: 'cube', SubComp: `${other.name}.pnt[0]` }).v === false, other?.name);
    const r = run('SIMatchSubComponent', { InputObj: 'cube' }); ok('SIMatchSubComponent: SubComp required', status(r) === 0x80070057, r.err);
  }
  // ---- FindObjects
  {
    ok('FindObjects: both Path and Type -> E_INVALIDARG', status(run('FindObjects', { Path: 'x', Type: 'y' })) === 0x80070057);
    ok('FindObjects: Path only -> E_NOTIMPL', status(run('FindObjects', { Path: 'cube' })) === 0x80004001);
    const r = run('FindObjects', { Type: '{bfdaf164-5dd8-4422-9f1e-35527cdc2a02}' });
    ok('FindObjects: pass class id lists the passes', Array.isArray(r.v) && r.v.length === A.scene.passes.length && r.v.every(p => A.scene.passes.includes(p)), r);
    const pt = run('FindObjects', { Type: '4c038ff0-3b9b-11d3-a1f7-00a0248f9567' });
    ok('FindObjects: particle type class id', Array.isArray(pt.v) && pt.v.length === A.particleScripts.particleTypes.length && pt.v.length > 0, pt.v?.length);
    const unk = run('FindObjects', { Type: '{00000000-1111-2222-3333-444444444444}' }); ok('FindObjects: unknown class id -> empty list, not yet attested', Array.isArray(unk.v) && !unk.v.length && nya(unk) === 1);
  }
  // ---- GetCurrentPass / SetCurrentParType
  {
    const p0 = run('GetCurrentPass').v; ok('GetCurrentPass = the current pass', p0 && p0.kind === 'pass', p0?.name);
    const l0 = run('GetCurrentPass', { Type: true }).v; ok('GetCurrentPass Type true = the current layer', l0 && l0.kind === 'layer', l0?.name);
    const p2 = A.run('CreatePass', {}) ?? A.scene.passes.find(p => p !== p0); const pass2 = Array.isArray(p2) ? p2[0] : p2;
    const target = A.scene.passes.find(p => p !== run('GetCurrentPass').v) ?? pass2; const before = run('GetCurrentPass').v; const ev0 = S.events.length;
    const r = run('SetCurrentParType', { Value: target, Type: 0 });
    ok('SetCurrentParType Type 0 makes the pass current', !r.err && run('GetCurrentPass').v === target, r.err);
    ok('SetCurrentParType Type 0 fires the two pass events with the old and new names', S.events.length === ev0 + 2 && S.events[ev0][0] === 0x20510029 && S.events[ev0 + 1][0] === 0x2051002a && S.events[ev0][1] === before.name && S.events[ev0][2] === target.name, S.events.slice(ev0));
    A.undo(); ok('SetCurrentParType undo restores the previous pass', run('GetCurrentPass').v === before);
    const lay = A.scene.layers[0]; run('SetCurrentParType', { Value: lay, Type: 1 }); ok('SetCurrentParType Type 1 makes the layer current', run('GetCurrentPass', { Type: true }).v === lay);
    const pt = A.particleScripts.particleTypes[0];
    run('SetCurrentParType', { Value: pt }); ok('SetCurrentParType Type 3 (default) sets the current particle type', S.currentParType === pt);
    A.undo(); ok('SetCurrentParType undo', S.currentParType !== pt);
    ok('SetCurrentParType class mismatch -> E_FAIL', status(run('SetCurrentParType', { Value: lay, Type: 3 })) === 0x80004005);
    ok('SetCurrentParType Type 7 -> E_UNEXPECTED', status(run('SetCurrentParType', { Value: lay, Type: 7 })) === 0x8000ffff);
  }
  // ---- FilterPSet
  {
    const disp = cube.properties.find(p => p.type === 'display') ?? cube.properties.find(p => p.shared);
    const vis = cube.properties.find(p => p.type === 'visibility');
    disp.shared = true; vis.shared = false;
    const inc = run('FilterPSet', { InputObjs: [disp, vis], Relationship: ':siContainedPSet:siPSetRelationship', Include: true }).v;
    ok('FilterPSet include contained', inc.length === 1 && inc[0] === vis, inc.map(x => x.name));
    const exc = run('FilterPSet', { InputObjs: [disp, vis], Relationship: 'siContainedPSet', Include: false }).v;
    ok('FilterPSet exclude contained', exc.length === 1 && exc[0] === disp, exc.map(x => x.name));
    disp.owners = [1, 2, 3]; const shared3 = run('FilterPSet', { InputObjs: [disp], Relationship: 'siSharedPSet', Include: true }).v; delete disp.owners;
    ok('FilterPSet: a shared property with 3 owners is not kept', shared3.length === 0);
  }
  // ---- ReorderSceneItem
  {
    const root = A.scene.root;
    const kids = () => root.children.map(c => c.name);
    const objA = [...root.children].reverse().find(c => c !== cube); const before = kids();
    run('ReorderSceneItem', { Parent: 'Scene_Root', InputObj: objA.name, MoveAction: 0 });
    ok('ReorderSceneItem 0 moves the item first', root.children[0] === objA, kids());
    A.undo(); ok('ReorderSceneItem undo restores the order', JSON.stringify(kids()) === JSON.stringify(before), kids());
    run('ReorderSceneItem', { Parent: 'Scene_Root', InputObj: objA.name, MoveAction: 1, Marker: 'cube' });
    ok('ReorderSceneItem 1 puts the item before the marker', root.children.indexOf(objA) === root.children.indexOf(cube) - 1, kids()); A.undo();
    const r = run('ReorderSceneItem', { Parent: 'Scene_Root', InputObj: objA.name, MoveAction: 2 }); ok('ReorderSceneItem 2 needs a Marker', status(r) === 0x80070057, r.err);
    const n = run('ReorderSceneItem', { Parent: 'Scene_Root', InputObj: objA.name, MoveAction: 9 }); ok('ReorderSceneItem: other actions do nothing', !n.err && JSON.stringify(kids()) === JSON.stringify(before));
  }
  // ---- CollapseOp
  {
    const op = cube.primitive.operators[0]; const r = run('CollapseOp', { InputObjs: [op] });
    // batch 12: the per-operator step is wired (tools/compare_b12_b11_corrections.mjs); the generator has no input -> nothing
    ok('CollapseOp: an operator without input (the generator) gives nothing', Array.isArray(r.v) && !r.v.length && nya(r) === 0, r);
  }
  // ---- RenameCPSetLayoutItems
  {
    A.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: 'cube' }); const prop = [...cube.properties].reverse().find(p => /^custom/i.test(p.type));
    prop.add({ name: 'pA', label: 'pA', type: 'double', value: 0 }); prop.add({ name: 'pB', label: 'pB', type: 'double', value: 0 });
    const r = run('RenameCPSetLayoutItems', { InputObj: prop, Indices: [1, 7], Name: 'Renamed' });
    const items = prop.layout;
    ok('RenameCPSetLayoutItems renames item 1 (index 7 skipped)', !r.err && items[1].label === 'Renamed' && items[0].label === undefined, [r.err, items]);
    A.undo(); ok('RenameCPSetLayoutItems undo restores the label', items[1].label === undefined, items);
    ok('RenameCPSetLayoutItems: no such layout -> 0x80020004', status(run('RenameCPSetLayoutItems', { InputObj: prop, LayoutName: 'Other', Indices: [0], Name: 'x' })) === 0x80020004);
    ok('RenameCPSetLayoutItems: not a custom property -> 0x80020004', status(run('RenameCPSetLayoutItems', { InputObj: cube.properties[0], Indices: [0], Name: 'x' })) === 0x80020004);
  }
  // ---- CreateObjectFromPreset
  {
    const r = run('CreateObjectFromPreset', { PresetObj: 'C3DDisplayProp', Name: 'MyDisplay' });
    ok('CreateObjectFromPreset returns the object, renamed, in the transient container', r.v && r.v.name === 'MyDisplay' && S.transient.includes(r.v) && r.v.params.length > 0, r.err);
    A.undo(); ok('CreateObjectFromPreset undo removes it from the transient container', !S.transient.includes(r.v));
    const s = run('CreateObjectFromPreset', { PresetObj: 'SomethingElse' }); ok('unknown preset: stand-in + not yet attested', s.v && s.v.name === 'SomethingElse' && nya(s) === 1); A.undo();
  }
  // ---- OBJ bridge
  {
    const n0 = S.bridgeCalls.length; const r = run('ObjImport', { FileName: 'C:\\in\\a.obj' });
    const c = S.bridgeCalls[n0];
    ok('ObjImport: bridge to customcommands.dll with the visible arguments', c && c.plugin === 'customcommands.dll' && c.name === 'Obj Import function' && c.args.length === 7 && c.args[0] === 'C:\\in\\a.obj' && nya(r) === 1, c);
    let called = null; S.hooks.plugins['customcommands.dll'] = { XSIOnCommand: (name, args) => { called = [name, args]; return ['made']; } };
    const e = run('SIObjExport', { Object: 'cube', FileName: 'C:\\out\\b.obj' });
    ok('SIObjExport: XSIOnCommand(name, args) and its return value', called && called[0] === 'OBJ Export function' && called[1].length === 7 && called[1][1] === 'C:\\out\\b.obj' && e.v?.[0] === 'made', [called, e]);
    delete S.hooks.plugins['customcommands.dll'];
  }
  // ---- SetDefaultKeyMap
  {
    const names = Object.keys(window.__keymaps ?? {}); const other = names.find(n => n !== 'Softimage Key Map') ?? names[0];
    const r = run('SetDefaultKeyMap', { Name: other });
    ok('SetDefaultKeyMap returns 1 on the first run', r.v === 1, r);
    const mapAfter = localStorage.getItem('si.keymap'); A.undo(); const mapUndo = localStorage.getItem('si.keymap');
    ok('SetDefaultKeyMap sets the key map; undo restores the saved one', mapAfter === other && mapUndo !== other, [mapAfter, mapUndo, other]);
  }
  // ---- ImportPrefs
  {
    fsx.ensureFolder('C:\\b11a'); fsx.writeFile('C:\\b11a\\my.DSPrefs', 'x'); fsx.writeFile('C:\\b11a\\my.txt', 'x');
    const bad = run('ImportPrefs', { FileName: 'C:\\b11a\\my.txt' }); ok('ImportPrefs: wrong extension -> E_INVALIDARG + message', status(bad) === 0x80070057 && bad.log.some(l => /Wrong file kind/.test(l)), bad);
    const miss = run('ImportPrefs', { FileName: 'C:\\b11a\\none.DSPrefs' }); ok('ImportPrefs: missing file -> E_INVALIDARG', status(miss) === 0x80070057);
    const n0 = S.prefRequests.length; const r = run('ImportPrefs', { FileName: 'C:\\b11a\\my.DSPrefs' });
    ok('ImportPrefs posts request 0x1bb0 (deferred)', !r.err && S.prefRequests.length === n0 + 1 && S.prefRequests[n0].id === 0x1bb0 && !S.prefRequests[n0].done);
    await new Promise(res => setTimeout(res, 20)); ok('ImportPrefs: the deferred callback runs', S.prefRequests[n0].done === true);
  }
  // ---- PickPosition
  {
    S.hooks.pickPosition = (t) => ({ pos: [1, 2, 3], button: 1, t });
    const r = run('PickPosition', { LeftMessage: 'Pick', MiddleMessage: 'Other' });
    ok('PickPosition returns the picked position and button', r.v && r.v.PosX === 1 && r.v.PosY === 2 && r.v.PosZ === 3 && r.v.ButtonPressed === 1, r.v);
    ok('PickPosition status text', r.v?.statusText === '\nPick\nOther\nEnd', r.v?.statusText);
    S.hooks.pickPosition = () => null; const z = run('PickPosition'); ok('PickPosition: picker start S_FALSE -> outputs 0', z.v && z.v.PosX === 0 && z.v.ButtonPressed === 0);
    ok('PickPosition: non-string message -> E_INVALIDARG', status(run('PickPosition', { LeftMessage: 5 })) === 0x80070057);
    S.hooks.pickPosition = null; const s = run('PickPosition', { LeftMessage: 'L' }); const sess = A.miscDsScripts?.session;
    if (sess) { sess.pick([4, 5, 6], 2, 0); ok('PickPosition session: middle-button pick fills the outputs', s.v.PosX === 4 && s.v.PosZ === 6 && s.v.ButtonPressed === 2, s.v); }
    else ok('PickPosition session started (viewport tool)', A.activeTool?.name === 'PickPosition', A.activeTool?.name);
    reset();
  }
  // ---- cache commands
  {
    S.tokens['project path'] = 'C:\\Proj';
    const tA = A.simulationPrefs; A.simulationPrefs = { ...(tA ?? {}), cachetemplatepatha: 'C:\\Target\\[model]\\[object]\\' };
    A.anim.startFrame = 1; const end0 = A.anim.endFrame; A.anim.endFrame = 3;
    const srcDir = 'C:\\Proj/Simulation/Scene_Root/cube/'; fsx.ensureFolder('C:\\Proj\\Simulation\\Scene_Root\\cube');
    for (const f of [1, 2]) fsx.writeFile(`C:\\Proj\\Simulation\\Scene_Root\\cube\\cube_A_${f}.icecache`, 'frame' + f);
    const m = A.log.length; const r = run('CopyCacheFiles', { ObjectsToCache: 'cube', SourcePathID: 0, TargetPathID: 2 });
    ok('CopyCacheFiles copies the existing frames, reports the failures', r.v && r.v.Copied === 2 && r.v.Failed === 1 && fsx.readFile('C:\\Target\\Scene_Root\\cube\\cube_A_2.icecache') === 'frame2', [r.err, r.v, fsx.tree('C:\\Target')]);
    ok('CopyCacheFiles messages 0x41c / 0x41d', r.log.some(l => /Copied 2 files\./.test(l)) && r.log.some(l => /1 files could not be copied/.test(l)), r.log);
    ok('CopyCacheFiles progress bar', S.progress[S.progress.length - 1]?.title === 'Copying cache files...' && S.progress[S.progress.length - 1].items[0] === 'Copying cache files for Scene_Root.cube');
    const again = run('CopyCacheFiles', { ObjectsToCache: 'cube', SourcePathID: 0, TargetPathID: 2 }); ok('CopyCacheFiles: existing targets fail without Overwrite', again.v?.Copied === 0);
    const ow = run('CopyCacheFiles', { ObjectsToCache: 'cube', SourcePathID: 0, TargetPathID: 2, Overwrite: true }); ok('CopyCacheFiles Overwrite', ow.v?.Copied === 2);
    const empty = run('CopyCacheFiles', { ObjectsToCache: 'cube', SourcePathID: 0, TargetPathID: 3 }); ok('CopyCacheFiles: empty target template -> 0x41f + E_INVALIDARG', status(empty) === 0x80070057 && empty.log.some(l => /target path template 3 is empty/.test(l)), empty.log);
    delete S.tokens['project path']; const tok = run('CopyCacheFiles', { ObjectsToCache: 'cube', SourcePathID: 0, TargetPathID: 2 }); ok('CopyCacheFiles: unresolved token -> E_UNEXPECTED', status(tok) === 0x8000ffff, tok.err);
    A.simulationPrefs = tA; A.anim.endFrame = end0; void m;

    const d = run('DumpCacheHeader', { SourcePath: 'C:\\b11a\\c.icecache', ShowInNetview: false });
    ok('DumpCacheHeader: xml path returned, reader not yet attested', d.v === 'C:\\b11a\\c.xml' && nya(d) === 1 && S.dumps[S.dumps.length - 1].netView === false, d);
    const nv0 = S.netViews.length; run('DumpCacheHeader', { SourcePath: 'C:\\b11a\\c.icecache' }); ok('DumpCacheHeader opens the Net View on the XML file', S.netViews.length === nv0 + 1 && S.netViews[nv0].url === 'C:\\b11a\\c.xml', S.netViews.length - nv0);
    document.querySelectorAll('.uixsi-netview-window').forEach(w => w.closest('.floating, .ppg-float')?.remove?.());

    // batch 12: PathID 5 = AlternativePath as the path template; the file name comes from the file-name template
    const p0 = S.cachePlans.length; const c = run('CacheObjectsIntoFile_Private', { ObjectsToCache: 'cube', PathID: 5, FirstFrame: 4, Type: 1, FrameSet: [4, 5, 6], AlternativePath: 'C:\\c\\[object]' });
    ok('CacheObjectsIntoFile_Private Type 1: frame set plan, ResolvedPath', c.v === 'C:\\c\\cube\\cube_A_4.icecache' && S.cachePlans.length === p0 + 1 && S.cachePlans[p0].frames.join() === '4,5,6' && S.ambient.Datamanagement_CachingToFiles === 0, [c.err, c.v]);
    ok('CacheObjectsIntoFile_Private: FrameSet not an array -> E_INVALIDARG', status(run('CacheObjectsIntoFile_Private', { ObjectsToCache: 'cube', Type: 1, FrameSet: 'x' })) === 0x80070057);
    ok('CacheObjectsIntoFile_Private: other Type -> E_NOTIMPL', status(run('CacheObjectsIntoFile_Private', { ObjectsToCache: 'cube', Type: 3 })) === 0x80004001);
    const t0 = run('CacheObjectsIntoFile_Private', { ObjectsToCache: 'cube', PathID: 5, FirstFrame: 1, LastFrame: 5, FramesPerStep: 2, AlternativePath: 'C:\\c' });
    ok('CacheObjectsIntoFile_Private Type 0: frame range with step', S.cachePlans[S.cachePlans.length - 1].frames.join() === '1,3,5' && t0.v === 'C:\\c\\cube_A_1.icecache', t0);
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
report('row registered every name itself', NAMES.every(n => got.batch.registered.includes(n)), JSON.stringify(got.batch));
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_tasks_b11a_commands: ${pass + fail} checks, ${fail} failed (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
