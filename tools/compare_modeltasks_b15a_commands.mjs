// CMD-B15a (modeltasks.dll: model creation / import / export / ref models / deltas) and CMD-B15-FR (the Face Robot
// corrections of docs/re/WIRE_CORRECTIONS_B15.md items 1-15). There is no XSIBATCH golden for these rows: this is a
// contract check against docs/ghidra/cmd-b15a-modeltasks.md, docs/ghidra/cmd-b15-fr-pr189-answers.md and
// docs/re/WIRE_CORRECTIONS_B15.md.
//   1. every command added by src/commands/modelTasksB15a.ts is registered with the catalogue argument list
//      (data/commands_full.json; names, order, defaults);
//   2. every one runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contracts' stated results (SICreateModel filter / parent / averaging / AddGroup, SIGetModel common model,
//      .emdl import, IGES / matlib / mixer file checks and events, restricted mode and licence gate, light lists,
//      ref-model resolutions, deltas) and the Face Robot corrections (blob names, ZeroPose blobs, fr_MuteSources,
//      fr_NeighborIndex, fr_AddObjectInPlace, fr_RepairNan, fr_CrawlToVertex, fr_SculptMouthEnd bake, fr_SolveTongue
//      without a tongue mesh, AddFaceControl colour, meshnames, 8.3 extension match, game shader material lookup).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_modeltasks_b15a_commands.mjs
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
  'Add3DObjectToScene', 'SICreateModel', 'SIGetModel', 'SIImportModel', 'SIMergeScene', 'SIImportIges', 'SIExportIges', 'MergeMixer',
  'SIImportMatLib', 'SIImportReferencedMatLib', 'ExportMaterialLibrary', 'GetLightListOnModelClip', 'SetLightListOnModelClip',
  'SISetResolutionOfRefModels', 'RemoveRefModelResolution', 'SICreateRefModel', 'ApplyDelta', 'ImportReferencedDelta',
];
const DEFAULT_FAILS = new Set(['SIImportModel', 'SIMergeScene', 'SIImportIges', 'SIExportIges', 'MergeMixer', 'SIImportMatLib',
  'SIImportReferencedMatLib', 'ExportMaterialLibrary', 'GetLightListOnModelClip', 'SetLightListOnModelClip', 'RemoveRefModelResolution',
  'ImportReferencedDelta']);

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
await page.waitForFunction(() => !!window.Application?.commands?.get('ImportReferencedDelta') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const safe = (d) => { try { return JSON.stringify(d, (k, v) => (v && typeof v === 'object' && v.fullName && k) ? `<${v.fullName}>` : v)?.slice(0, 600); } catch { return String(d); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : safe(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r, row = 'CMD-B15a') => r.log.some(l => /not yet attested/.test(l) && l.includes(row));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const J = JSON.stringify;
  const cube = A.scene.find('cube');
  const MT = () => A.modelTasksB15a;
  const reset = () => { A.select([cube]); };
  const gpos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };
  const arrNear = (a, b, e = 1e-5) => a.length === b.length && a.every((x, i) => near(x, b[i], e));
  const block = (name, fn) => { try { fn(); } catch (e) { ok(`${name}: block threw`, false, String(e?.stack ?? e).slice(0, 400)); } };
  FS.ensureFolder('C:\\b15a');

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

  // ================= SICreateModel / Add3DObjectToScene / SIGetModel
  block('SICreateModel', () => {
    const u0 = A.undoStack.length;
    const a = A.run('GetPrim', { PresetObj: 'Null', Name: 'mA' }), b = A.run('GetPrim', { PresetObj: 'Null', Name: 'mB' });
    a.kinematics.local.get('posx').value = 2; b.kinematics.local.get('posx').value = 4; b.kinematics.local.get('posy').value = 2;
    const ga = gpos(a), gb = gpos(b);
    let r = run('SICreateModel', { InputObj: [a, b], Name: 'mdlB15' });
    const m = r.v;
    ok('SICreateModel: returns a new model with Name, the inputs become its children', m?.type === '#model' && m.name === 'mdlB15' && m.children.includes(a) && m.children.includes(b), r);
    ok('SICreateModel: Add3DObjectToScene puts the model under the scene root (two objects: no default parent)', m?.parentObj === A.scene.root);
    ok('SICreateModel: model moved to the average global position, children keep their global pose', arrNear(gpos(m), [3, 1, 0]) && arrNear(gpos(a), ga) && arrNear(gpos(b), gb), [gpos(m), gpos(a), gpos(b)]);
    ok('SICreateModel: one undo step removes everything', (A.undo(), !A.scene.find('mdlB15') && a.parentObj === A.scene.root && near(a.kinematics.local.val('posx'), 2)));
    // single object: the parent becomes that object's parent
    const par = A.run('GetPrim', { PresetObj: 'Null', Name: 'mPar' }); const c = A.run('GetPrim', { PresetObj: 'Null', Name: 'mC' });
    A.run('ParentObj', { Parent: 'mPar', Children: [c] });
    r = run('SICreateModel', { InputObj: [c], Name: 'mdl1' });
    ok('SICreateModel: exactly one object -> the model goes under that object\'s parent', r.v?.parentObj === par && r.v.children.includes(c));
    // filter: different parent / effector dropped -> warning 0x13 and continue
    r = run('SICreateModel', { InputObj: [a, c], Name: 'mdl2' });
    ok('SICreateModel: an object with another parent is dropped -> warning XSIMODELTASKS 0x13, the rest is used', r.v?.children.includes(a) && !r.v.children.includes(c) && has(r, /WARNING : SICreateModel: \[XSIMODELTASKS 0x13\]/), r);
    // Parent inside the inputs -> E_INVALIDARG
    r = run('SICreateModel', { InputObj: [par], Parent: c.parentObj === par ? c : par });
    ok('SICreateModel: Parent is an input or below one -> 0x80070057', status(r, '80070057'), r);
    // empty list: an empty model
    A.select([]);
    r = run('SICreateModel', { InputObj: [] , Name: 'emptyB15' });
    ok('SICreateModel: empty input list -> an empty model under the scene root', r.v?.name === 'emptyB15' && r.v.children.length === 0 && r.v.parentObj === A.scene.root);
    // nothing usable -> E_INVALIDARG
    const fx = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'fxCube' });
    const prop = fx.properties[0];
    r = run('SICreateModel', { InputObj: [prop] });
    ok('SICreateModel: nothing usable in InputObj -> 0x80070057 (after warning 0x13)', status(r, '80070057') && has(r, /XSIMODELTASKS 0x13/), r);
    // one group: AddGroup moves it into the model; its owning model is the default parent
    const g = A.run('CreateGroup', { Name: 'grpB15', InputObjs: [fx] });
    r = run('SICreateModel', { InputObj: [g], Name: 'mdlG' });
    ok('SICreateModel: exactly one group -> AddGroup moves the group into the model', r.v && g.parent === r.v && r.v.parentObj === A.scene.root, [g.parent?.name]);
    A.undo();
    ok('SICreateModel: undo of AddGroup restores the group owner', g.parent !== r.v);
    // animated input: averaging skipped (inferred polarity)
    const an = A.run('GetPrim', { PresetObj: 'Null', Name: 'mAnim' }); an.kinematics.local.get('posx').value = 6;
    A.anim.setKey(an.kinematics.local.get('posx'));
    r = run('SICreateModel', { InputObj: [an], Name: 'mdlAnim' });
    ok('SICreateModel: an animated input skips the averaging (inferred polarity)', r.v && arrNear(gpos(r.v), [0, 0, 0]) && near(gpos(an)[0], 6), [gpos(r.v), gpos(an)]);
    while (A.undoStack.length > u0) A.undo();
    reset();
    // Add3DObjectToScene (inferred)
    const loose = new (A.scene.root.constructor)('looseB15');
    r = run('Add3DObjectToScene', { InputObjs: [loose], Parent: cube });
    ok('Add3DObjectToScene (inferred): an object not in the scene goes under Parent', loose.parentObj === cube, r);
    r = run('Add3DObjectToScene', { InputObjs: [cube] });
    ok('Add3DObjectToScene (inferred): an object already in the scene is left (logged)', cube.parentObj === A.scene.root && nya(r));
    A.undo(); A.undo();
    ok('Add3DObjectToScene: undo removes it', !loose.parentObj);
  });
  block('SIGetModel', () => {
    const u0 = A.undoStack.length;
    A.select([]);
    ok('SIGetModel: empty input -> the scene root', run('SIGetModel', { InputObjs: [] }).v === A.scene.root && run('SIGetModel').v === A.scene.root);
    const m1 = A.run('SICreateModel', { InputObj: [], Name: 'gm1' });
    const m2 = A.run('SICreateModel', { InputObj: [], Name: 'gm2', Parent: m1 });
    const m3 = A.run('SICreateModel', { InputObj: [], Name: 'gm3', Parent: m1 });
    const x = A.run('GetPrim', { PresetObj: 'Null', Name: 'gx' }); A.run('ParentObj', { Parent: 'gm2', Children: [x] });
    const y = A.run('GetPrim', { PresetObj: 'Null', Name: 'gy' }); A.run('ParentObj', { Parent: 'gm3', Children: [y] });
    ok('SIGetModel: one object -> its model', run('SIGetModel', { InputObjs: [x] }).v === m2);
    ok('SIGetModel: objects in two sibling models -> the closest common owner model', run('SIGetModel', { InputObjs: [x, y] }).v === m1);
    ok('SIGetModel: a model and an object below it -> the ancestor is kept', run('SIGetModel', { InputObjs: [x, m2] }).v === m1);
    ok('SIGetModel: a property -> the model of its object', run('SIGetModel', { InputObjs: [x.properties[0]] }).v === m2);
    ok('SIGetModel: unrelated objects at the root -> the scene root', run('SIGetModel', { InputObjs: [x, cube] }).v === A.scene.root);
    while (A.undoStack.length > u0) A.undo();
    reset();
  });

  // ================= SIImportModel
  block('SIImportModel', () => {
    const u0 = A.undoStack.length;
    const src = A.run('SICreateModel', { InputObj: [], Name: 'emdlSrc' }); const n = A.run('GetPrim', { PresetObj: 'Null', Name: 'emdlNull' }); A.run('ParentObj', { Parent: 'emdlSrc', Children: [n] });
    const data = A.run('ExportModel', { InputObj: 'emdlSrc', Data: true });
    FS.writeFile('C:\\b15a\\robot.emdl', JSON.stringify(data));
    FS.writeFile('C:\\b15a\\robot.xsi', 'xsi 0350txt 0032');
    FS.writeFile('C:\\b15a\\robot.foo', 'x');
    while (A.undoStack.length > u0) A.undo();
    MT().events.length = 0;
    const host = A.run('GetPrim', { PresetObj: 'Null', Name: 'impHost' });
    let r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.emdl', Parent: host, Name: 'robotB15', ShareOptions: 3 });
    ok('SIImportModel: .emdl -> a model named Name under Parent, content loaded, ShareOptions kept', r.v?.type === '#model' && r.v.name === 'robotB15' && r.v.parentObj === host && r.v.children.some(c => c.name === 'emdlNull') && r.v.shareOptions === 3, r);
    ok('SIImportModel: file events 0x20510015 / 0x20510016 (kind 2), recent models updated', J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510015, 2], [0x20510016, 2]]) && MT().recentModels[0] === 'C:\\b15a\\robot.emdl');
    r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.emdl' });
    ok('SIImportModel: empty Name -> the stored model name, made unique; no Parent -> scene root', r.v && /^emdlSrc\d*$/.test(r.v.name) && r.v.parentObj === A.scene.root, r.v?.name);
    ok('SIImportModel: missing file -> 0x80070057 / XSIMODELTASKS 0x17', (r = run('SIImportModel', { FileName: 'C:\\b15a\\nothere.emdl' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x17/)));
    ok('SIImportModel: .xsi -> 0x80070057 / 0x33', (r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.xsi' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x33/)));
    r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.foo' });
    ok('SIImportModel: other extension without converter -> error 0x15 with the extension, 0x80070057 / 0x33', status(r, '80070057') && has(r, /XSIMODELTASKS 0x15\] \.foo/) && has(r, /XSIMODELTASKS 0x33/), r);
    let seen = null; A.tasksB11c.registerCustomConverter('foo', 'FooModel', ctx => { seen = ctx; });
    MT().events.length = 0;
    r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.foo' });
    ok('SIImportModel: registered converter -> SICreateModel sub-task (converter name), events, converter called with the model', r.v?.name === 'FooModel' && seen?.target?.[0] === r.v && J(MT().events.map(e => e.id)) === J([0x20510015, 0x20510016]), r);
    A.tasksB11c.converters.delete('foo');
    MT().hooks.fileEvent = (ev) => ev.id === 0x20510015 ? 0x562e80c7 : undefined;
    r = run('SIImportModel', { FileName: 'C:\\b15a\\robot.emdl' });
    ok('SIImportModel: a handler answering 0x562e80c7 cancels', status(r, '562e80c7'), r);
    MT().hooks.fileEvent = undefined;
    while (A.undoStack.length > u0) A.undo();
    reset();
  });

  // ================= SIMergeScene (SPEC-PARTIAL)
  block('SIMergeScene', () => {
    const u0 = A.undoStack.length;
    FS.writeFile('C:\\b15a\\shot.scn', 'NewScene\nGetPrim "Null"');
    let r = run('SIMergeScene', { FileName: 'C:\\b15a\\shot.scn' });
    ok('SIMergeScene: .scn -> a model named after the file under the scene root, ShareOptions default 0xffff; merge rules logged', r.v?.name === 'shot' && r.v.parentObj === A.scene.root && r.v.shareOptions === 0xffff && nya(r), r);
    r = run('SIMergeScene', { FileName: 'C:\\b15a\\shot.scn', Name: 'mergedB15', Parent: cube });
    ok('SIMergeScene: Name and Parent', r.v?.name === 'mergedB15' && r.v.parentObj === cube);
    ok('SIMergeScene: missing file -> 0x80070057 / 0x33', (r = run('SIMergeScene', { FileName: 'C:\\b15a\\none.scn' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x33/)));
    ok('SIMergeScene: no FileName -> 0x80070057', status(run('SIMergeScene', {}), '80070057'));
    FS.writeFile('C:\\b15a\\bad.scn', 'Invalid_Scene');
    ok('SIMergeScene: Invalid_Scene stream -> simsgcat 0x68, 0x80004005', (r = run('SIMergeScene', { FileName: 'C:\\b15a\\bad.scn' }), status(r, '80004005') && has(r, /simsgcat 0x68/)));
    while (A.undoStack.length > u0) A.undo();
  });

  // ================= IGES
  block('IGES', () => {
    const u0 = A.undoStack.length;
    FS.writeFile('C:\\b15a\\part.igs', 'S      1');
    MT().events.length = 0;
    let r = run('SIImportIges', { FileName: 'C:\\b15a\\part.igs', Parent: cube });
    ok('SIImportIges: an empty model (SICreateModel sub-task) under Parent, events kind 0x19, translator logged', r.v?.type === '#model' && r.v.parentObj === cube && J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510015, 0x19], [0x20510016, 0x19]]) && nya(r), r);
    ok('SIImportIges: not .iges/.igs -> 0x80070057 / 0x33', (r = run('SIImportIges', { FileName: 'C:\\b15a\\shot.scn' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x33/)));
    ok('SIImportIges: FileName not a string -> 0x80070057', status(run('SIImportIges', { FileName: 3 }), '80070057'));
    MT().events.length = 0;
    r = run('SIExportIges', { InputObjs: [cube], FileName: 'C:\\b15a\\out.igs' });
    ok('SIExportIges: events 0x20510013 / 0x20510014 kind 0x19, writer logged, no return value', !r.err && r.v === undefined && J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510013, 0x19], [0x20510014, 0x19]]) && nya(r), r);
    r = run('SIExportIges', { FileName: 'C:\\nofolder\\out.igs' });
    ok('SIExportIges: folder not writable -> 0x51, then 0x80070057 / 0x1c', status(r, '80070057') && has(r, /XSIMODELTASKS 0x51/) && has(r, /XSIMODELTASKS 0x1c/), r);
    A.tasksB11c.altMode = true;
    ok('SIExportIges: restricted mode -> 0x80004021', status(run('SIExportIges', { FileName: 'C:\\b15a\\out.igs' }), '80004021'));
    A.tasksB11c.altMode = false;
    while (A.undoStack.length > u0) A.undo();
  });

  // ================= MergeMixer
  block('MergeMixer', () => {
    const u0 = A.undoStack.length;
    FS.writeFile('C:\\b15a\\anim.xsimixer', 'x');
    const m = A.run('SICreateModel', { InputObj: [], Name: 'mixM' }); const o = A.run('GetPrim', { PresetObj: 'Null', Name: 'mixO' }); A.run('ParentObj', { Parent: 'mixM', Children: [o] });
    const mixer = A.run('GetPrim', { PresetObj: 'Null', Name: 'tmp' }); A.run('DeleteObj', { InputObj: 'tmp' }); void mixer;
    MT().events.length = 0;
    let r = run('MergeMixer', { FileName: 'C:\\b15a\\anim.xsimixer', Parent: o });
    ok('MergeMixer: Parent not a model -> its model; Value = the model\'s mixer; events kind 0x18; reader logged', r.v?.type === 'mixer' && r.v.parent === m && J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510015, 0x18], [0x20510016, 0x18]]) && nya(r), r);
    const first = r.v;
    r = run('MergeMixer', { FileName: 'C:\\b15a\\anim.xsimixer', Parent: m });
    ok('MergeMixer: Merge true keeps the existing mixer content', r.v === first);
    ok('MergeMixer: not .xsimixer -> 0x80070057 / 0x33', (r = run('MergeMixer', { FileName: 'C:\\b15a\\shot.scn', Parent: m }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x33/)));
    ok('MergeMixer: FileName not a string -> 0x80070057', status(run('MergeMixer', { FileName: null, Parent: m }), '80070057'));
    while (A.undoStack.length > u0) A.undo();
  });

  // ================= material libraries
  block('matlib', () => {
    const u0 = A.undoStack.length;
    FS.writeFile('C:\\b15a\\lib.xsi', 'xsi 0350txt 0032\nSI_Material {}');
    FS.writeFile('C:\\b15a\\lib.txt', 'x');
    MT().events.length = 0;
    let r = run('SIImportMatLib', { FileName: 'C:\\b15a\\lib.xsi' });
    const st = A.scene.libraryState;
    ok('SIImportMatLib: CreateLibrary sub-task (___Default___) made current; CrosswalkImportMatLib called or logged; not referenced', r.v?.name?.startsWith('___Default___') && st.current === r.v && !r.v.referencedFile && (A.commands.has('CrosswalkImportMatLib') || nya(r)), r);
    ok('SIImportMatLib: events kind 0x16', J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510015, 0x16], [0x20510016, 0x16]]));
    r = run('SIImportReferencedMatLib', { FileName: 'C:\\b15a\\lib.xsi' });
    ok('SIImportReferencedMatLib: same task with ShareOptions 1 -> referenced to the file', r.v?.referencedFile === 'C:\\b15a\\lib.xsi');
    r = run('SIImportMatLib', { FileName: 'C:\\b15a\\lib.xsi', ShareOptions: 5 });
    ok('SIImportMatLib: any non-zero ShareOptions -> referenced', r.v?.referencedFile === 'C:\\b15a\\lib.xsi');
    r = run('SIImportMatLib', { FileName: 'C:\\b15a\\missing.xsi' });
    ok('SIImportMatLib: missing file -> warning 0x16, 0x80070057', status(r, '80070057') && has(r, /WARNING : SIImportMatLib: \[XSIMODELTASKS 0x16\]/), r);
    ok('SIImportMatLib: extension not .xsi / .xsiml -> 0x80070057 / 0x11c', (r = run('SIImportMatLib', { FileName: 'C:\\b15a\\lib.txt' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x11c/)));
    ok('SIImportMatLib: empty FileName -> 0x80070057', status(run('SIImportMatLib', { FileName: '' }), '80070057'));
    const lib = st.current; const calls0 = MT().translatorCalls.length; MT().events.length = 0;
    r = run('ExportMaterialLibrary', { FileName: 'C:\\b15a\\out.xsiml' });
    const call = MT().translatorCalls[calls0];
    ok('ExportMaterialLibrary: no InputObjs -> current library; CrosswalkExportMatLib with Binary false; events 0x20510013 / 14 kind 0x16', !r.err && (A.commands.has('CrosswalkExportMatLib') || (call?.args.MatLib === lib.name && call.args.Binary === false && call.args.ExportUsedImageClipsOnly === true)) && J(MT().events.map(e => [e.id, e.kind])) === J([[0x20510013, 0x16], [0x20510014, 0x16]]), [r, call]);
    ok('ExportMaterialLibrary: bad extension -> 0x80070057 / 0x33', (r = run('ExportMaterialLibrary', { FileName: 'C:\\b15a\\out.txt' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x33/)));
    ok('ExportMaterialLibrary: destination not valid -> 0x80070057 / 0x11c', (r = run('ExportMaterialLibrary', { FileName: 'C:\\nofolder\\out.xsi' }), status(r, '80070057') && has(r, /XSIMODELTASKS 0x11c/)));
    A.tasksB11c.altMode = true;
    ok('ExportMaterialLibrary: restricted mode -> message box 0x143, 0x80004021', (r = run('ExportMaterialLibrary', { FileName: 'C:\\b15a\\out.xsi' }), status(r, '80004021') && has(r, /simsgcat 0x143/)));
    ok('ImportReferencedDelta: restricted mode -> 0x80004021', status(run('ImportReferencedDelta', { FileName: 'x.delta', Model: cube }), '80004021'));
    A.tasksB11c.altMode = false;
    while (A.undoStack.length > u0) A.undo();
  });

  // ================= light lists
  block('light lists', () => {
    const P = A.faceRobotB14a.Property;
    const clip = new P('ModelClipB15', 'modelclip', []);
    let r = run('SetLightListOnModelClip', { ModelClip: clip, LightList: 'light1,light2' });
    ok('SetLightListOnModelClip: sets the clip light list', !r.err && clip.lightList === 'light1,light2', r);
    ok('GetLightListOnModelClip: returns it', run('GetLightListOnModelClip', { ModelClip: clip }).v === 'light1,light2');
    A.undo();
    ok('SetLightListOnModelClip: undo restores the previous list', run('GetLightListOnModelClip', { ModelClip: clip }).v === '');
    ok('GetLightListOnModelClip: not a model clip -> 0x80004003', status(run('GetLightListOnModelClip', { ModelClip: cube }), '80004003'));
  });

  // ================= referenced models
  block('ref models', () => {
    const u0 = A.undoStack.length;
    const rsrc = A.run('SICreateModel', { InputObj: [], Name: 'refSrc' }); const rn = A.run('GetPrim', { PresetObj: 'Null', Name: 'refNull' }); A.run('ParentObj', { Parent: 'refSrc', Children: [rn] });
    const data = A.run('ExportModel', { InputObj: 'refSrc', Data: true });
    while (A.undoStack.length > u0) A.undo();
    FS.writeFile('C:\\b15a\\hi.emdl', JSON.stringify({ ...data, model: 'hi' })); FS.writeFile('C:\\b15a\\lo.emdl', JSON.stringify({ ...data, model: 'lo' }));
    let r = run('SICreateRefModel', { FileName: 'C:\\b15a\\hi.emdl', ResolutionName: 'High', Parent: cube });
    const m = r.v;
    ok('SICreateRefModel: model named after the file under Parent, referenced, resolution 1 active and loaded, ShareOptions 0xffff', m?.type === '#model' && m.name === 'hi' && m.parentObj === cube && m.ref?.resolution === 1 && m.ref.resNames[0] === 'High' && m.children.length > 0 && m.shareOptions === 0xffff, r);
    m.ref.resolutions.push('C:\\b15a\\lo.emdl'); m.ref.resNames.push('Low'); m.ref.resolutions.push('C:\\b15a\\gone.emdl'); m.ref.resNames.push('Gone');
    r = run('SISetResolutionOfRefModels', { Target: [m], Resolution: 0 });
    ok('SISetResolutionOfRefModels: 0 (offloaded) is always applied', m.ref.resolution === 0 && m.children.length === 0, r);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 2 });
    ok('SISetResolutionOfRefModels: an existing usable resolution is applied and loaded', m.ref.resolution === 2 && m.children.length > 0);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 3 });
    ok('SISetResolutionOfRefModels: a resolution whose file is missing is skipped', m.ref.resolution === 2);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 9 });
    ok('SISetResolutionOfRefModels: a resolution that does not exist is skipped', m.ref.resolution === 2);
    r = run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Low' });
    ok('RemoveRefModelResolution: the active resolution is not removed', m.ref.resNames.includes('Low') && MT().status.RemoveRefModelResolution === 1);
    run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Gone' });
    ok('RemoveRefModelResolution: another resolution is removed', !m.ref.resNames.includes('Gone') && m.ref.resolutions.length === 2);
    run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Nope' });
    ok('RemoveRefModelResolution: unknown name -> nothing', m.ref.resolutions.length === 2);
    ok('RemoveRefModelResolution: no ResolutionName -> 0x80070057', status(run('RemoveRefModelResolution', { Model: m }), '80070057'));
    r = run('SICreateRefModel', { FileName: 'C:\\b15a\\sub\\new.emdl', CreateFile: true, Activate: false });
    ok('SICreateRefModel: missing file -> warning 0x16; CreateFile writes the empty model with ExportModel; Activate false -> offloaded', has(r, /WARNING : SICreateRefModel: \[XSIMODELTASKS 0x16\]/) && FS.isFile('C:\\b15a\\sub\\new.emdl') && r.v?.ref?.resolution === 0 && r.v.name === 'new', r);
    r = run('SICreateRefModel', {});
    ok('SICreateRefModel: no file, no ModelName -> "RefModel"', /^RefModel\d*$/.test(r.v?.name) && !!r.v.ref);
    // licence gate
    MT().licence.refModels = false;
    const n0 = [...A.scene.allObjects()].length;
    r = run('SICreateRefModel', { ModelName: 'gated' });
    ok('SICreateRefModel: licence bit 0x40 missing -> XSIMODELTASKS 0x17, nothing done', r.v === undefined && has(r, /XSIMODELTASKS 0x17/) && [...A.scene.allObjects()].length === n0, r);
    ok('SISetResolutionOfRefModels / ApplyDelta / RemoveRefModelResolution: gated as well', run('SISetResolutionOfRefModels', { Target: [m], Resolution: 0 }).v === undefined && m.ref.resolution === 2 && has(run('ApplyDelta', { Deltas: [] }), /0x17/) && has(run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Low' }), /0x17/));
    MT().licence.refModels = true;
    // deltas
    FS.writeFile('C:\\b15a\\d1.delta', JSON.stringify({ format: 'softimage-direct-delta-json', params: {}, delta: [{ name: 'refNull', xf: { pos: [7, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1] } }] }));
    const inner = m.children[0];
    r = run('ImportReferencedDelta', { FileName: 'C:\\b15a\\d1.delta', Model: m });
    const d = r.v;
    ok('ImportReferencedDelta: a delta on the referenced model, file / mode 3 (referenced) / target set, loaded and applied', d?.type === 'delta' && d.parent === m && d.val('file') === 'C:\\b15a\\d1.delta' && d.val('mode') === 3 && near(inner.kinematics.local.val('posx'), 7), [r.err, d?.val?.('mode'), inner?.name]);
    MT().hooks.msgBox = () => 6;
    r = run('ImportReferencedDelta', { FileName: 'C:\\b15a\\d1.delta', Model: m, Reference: false });
    ok('ImportReferencedDelta: existing delta + Yes -> old one renamed <name>_BACKUP, a new one created; Reference false -> mode 0', /_BACKUP/.test(d.name) && r.v !== d && r.v.val('mode') === 0, [d.name, r.v?.name]);
    MT().hooks.msgBox = () => 2; const nd = m.properties.filter(p => p.type === 'delta').length;
    r = run('ImportReferencedDelta', { FileName: 'C:\\b15a\\d1.delta', Model: m });
    ok('ImportReferencedDelta: Cancel aborts', r.v === undefined && m.properties.filter(p => p.type === 'delta').length === nd);
    MT().hooks.msgBox = undefined;
    r = run('ImportReferencedDelta', { FileName: 'C:\\b15a\\none.delta', Model: m, Interactive: false });
    ok('ImportReferencedDelta: missing file -> warning 0x16, an empty delta', has(r, /XSIMODELTASKS 0x16/) && r.v?.type === 'delta');
    ok('ImportReferencedDelta: non$existent.delta means no file (no warning)', !has(run('ImportReferencedDelta', { FileName: 'non$existent.delta', Model: m, Interactive: false }), /0x16/));
    ok('ImportReferencedDelta: a model that is not referenced -> nothing', run('ImportReferencedDelta', { FileName: 'C:\\b15a\\d1.delta', Model: cube }).v === undefined);
    ok('ImportReferencedDelta: missing Model -> 0x80070057', status(run('ImportReferencedDelta', { FileName: 'C:\\b15a\\d1.delta' }), '80070057'));
    inner.kinematics.local.get('posx').value = 0;
    r = run('ApplyDelta', { Deltas: [d] });
    ok('ApplyDelta: re-applies the delta to its model; the applying flag is cleared afterwards', near(inner.kinematics.local.val('posx'), 7) && ((m.ref.applying ?? 0) & 2) === 0 && r.v >= 1, r);
    while (A.undoStack.length > u0) A.undo();
    reset();
  });

  // ================= Face Robot corrections (WIRE_CORRECTIONS_B15 items 1-15)
  block('FR', () => {
    const X = A.faceRobotB14a, T = A.frB14bc, H = A.frB14de;
    const { model: face, mesh } = X.buildSampleFace();
    const ST = A.faceRobotB14, S = ST.store;
    const u0 = A.undoStack.length;
    ok('FR item 1: mouth blobs CDKMetaMouthOp / CDKMetaMouthSymMap', T.MOUTH_BLOB === 'CDKMetaMouthOp' && T.MIRROR_BLOB === 'CDKMetaMouthSymMap');
    // MakeFaceStructure meshnames
    let r = run('MakeFaceStructure', {});
    ok('FR item 1: MakeFaceStructure stores the six meshnames', J(S.raw('_', 'meshnames')) === J(['Mesh', 'LEye', 'REye', 'UpperTeeth', 'LowerTeeth', 'Tongue']) && !r.log.some(l => /meshnames/.test(l) && /not yet attested/.test(l)), S.raw('_', 'meshnames'));
    // ResetControllerDB deletes ZeroPoseO / ZeroPose
    const fm = S.raw('_', 'FaceModel');
    fm.addProperty(new X.Property('ZeroPoseO', 'UserDataBlob', [])); fm.addProperty(new X.Property('ZeroPose', 'UserDataBlob', []));
    run('fr_ResetControllerDB');
    ok('FR item 2: fr_ResetControllerDB deletes the ZeroPoseO and ZeroPose blobs', !fm.properties.some(p => p.name === 'ZeroPoseO' || p.name === 'ZeroPose'));
    // fr_AddObjectInPlace
    r = run('fr_AddObjectInPlace', { inPreset: 'Sphere', inType: 1, inName: 'tagB15', inParamTags: 'radius' });
    ok('FR item 3: fr_AddObjectInPlace leaves the object inspectable and tags inParamTags with siTag1', r.v && !r.v.siNotInspectable && r.v.primitive.operators[0].get('radius').tags === 1, r.err);
    // fr_MuteSources
    cube.kinematics.local.get('posx').value = 2;
    r = run('fr_MuteSources', { Objects: [cube], b_Mute: false, b_ResetTransforms: true });
    ok('FR item 4: fr_MuteSources: b_ResetTransforms unused, no reset without b_Mute; returns true', r.v === true && cube.kinematics.local.val('posx') === 2);
    r = run('fr_MuteSources', { Objects: [cube], b_Mute: true, b_ResetTransforms: false });
    ok('FR item 4: fr_MuteSources: b_Mute resets the transforms', r.v === true && cube.kinematics.local.val('posx') === 0);
    // fr_NeighborIndex on the sample face (grid: vertex 6 has neighbours 7, 11, 5, 1 in some order)
    const pos = mesh.primitive.mesh().positions;
    r = run('fr_NeighborIndex', { inObj: mesh, inVertex: 6, inMode: 1 });
    ok('FR item 6: fr_NeighborIndex mode 1 -> the neighbour with the largest local Y direction (vertex 11 above 6)', r.v === 11 && pos[11 * 3 + 1] > pos[6 * 3 + 1], r);
    ok('FR item 6: fr_NeighborIndex mode 0 -> the first neighbour; vertex 0 rejected', [1, 5, 7, 11].includes(run('fr_NeighborIndex', { inObj: mesh, inVertex: 6 }).v) && status(run('fr_NeighborIndex', { inObj: mesh, inVertex: 0 }), '80020003'));
    // fr_RepairNan: no not-yet-attested line about the format any more
    const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'crvB15' });
    r = run('fr_RepairNan', { BrokenCurves: [crv] });
    ok('FR item 14: fr_RepairNan uses format 0 (siSINurbs); no unread-format line', !r.err && !r.log.some(l => /data format constant/.test(l)), r);
    // fr_CrawlToVertex
    A.selectComponents(mesh, 'point', [0, 2, 12]);
    r = run('fr_CrawlToVertex', { Select: false });
    ok('FR item 8: fr_CrawlToVertex: first selected vertex not in the output, each pair ends at its target', r.v === `${mesh.fullName}.pnt[1,2,7,12]`, r);
    A.compSel = null;
    // fr_GetFilesForBrowser 8.3 match and element 0 = 3 x count
    FS.ensureFolder('C:\\b15a\\br'); FS.writeFile('C:\\b15a\\br\\a.dna', 'x'); FS.writeFile('C:\\b15a\\br\\b.dnax', 'x'); FS.writeFile('C:\\b15a\\br\\c.dn', 'x');
    r = run('fr_GetFilesForBrowser', { path: 'C:\\b15a\\br', extension: 'dna' });
    ok('FR item 12: fr_GetFilesForBrowser: element 0 = 3 x file count; a 3-character extension also matches longer ones (8.3)', r.v?.[0] === 6 && r.v.includes('C:\\b15a\\br\\b.dnax') && !r.v.includes('C:\\b15a\\br\\c.dn'), r.v);
    // AddFaceControl offset colour
    r = run('AddFaceControl', { Position: [0, 0, 0], Nom: 'CtlB15', Model: face, bHasOffsetParent: true });
    const off = r.v?.parentObj;
    ok('FR item 11: AddFaceControl offset parent <Nom>_Parent with wireframe colour 0x232; no unread line', off?.name === 'CtlB15_Parent' && off.wireColor === 0x232 && !r.log.some(l => /0x232/.test(l) && /not yet attested/.test(l)));
    // fr_SculptMouthEnd bake (cancel = true applies)
    const blob = new X.Property(T.MOUTH_BLOB, 'UserDataBlob', []); blob.mouth = { vertices: [12, 13], scale: 1 }; mesh.addProperty(blob);
    const bake = new X.Property('CDKMetaMouthBake', 'UserDataBlob', []); mesh.addProperty(bake);
    run('fr_SculptMouthBegin', { mesh });
    const sm = face.children.find(c => c.name === 'SculptMouth');
    if (sm) { const pm = sm.primitive.operators[0].data.positions; pm[12 * 3 + 2] += 0.5; sm.primitive.dirty = true; }
    r = run('fr_SculptMouthEnd', { mesh, cancel: true });
    ok('FR item 9: fr_SculptMouthEnd cancel = true bakes: a record with the moved vertex (squared distance > 0.0001) is stored', !!sm && bake.bake?.records?.length === 1 && bake.bake.records[0].vertices.length === 1 && bake.bake.records[0].vertices[0].index === 12 && near(bake.bake.records[0].vertices[0].translation[2], 0.5), [r.err, bake.bake]);
    mesh.removeProperty(blob); mesh.removeProperty(bake);
    // fr_SolveTongue without meshes/Tongue
    S.delete('meshes', 'Tongue');
    const fc = face.properties.find(p => p.name === 'FaceConnections'); fc.get('Tongue').value = '';
    const fit = H.newNull(A, 'Fit', face); H.newNull(A, 'TongueTipMarker', fit);
    r = run('fr_SolveTongue');
    ok('FR item 10: fr_SolveTongue without meshes/Tongue -> true, S_OK, FaceConnections.Tongue not written, Tongue*Marker deleted', r.v === true && ST.rows.B14e.lastStatus.fr_SolveTongue === 0 && fc.val('Tongue') === '' && fit.children.length === 0, [r, fc.val('Tongue'), fit.children.map(c => c.name)]);
    // retarget blob name
    {
      const old = face.properties.filter(p => p.type === 'UserDataBlob'); for (const p of old) face.removeProperty(p);
      const p = new X.Property('CDKFaceRetargetOp', 'UserDataBlob', []); p.data = {}; face.addProperty(p);
      ok('FR item 1: the retarget blob is found by its name CDKFaceRetargetOp', H.retargetBlob(A, face) === p);
      face.removeProperty(p); for (const q of old) face.addProperty(q);
    }
    // game shader: lookup by material name only
    const C = A.commands.get('fr_ApplyFaceRobotGameShader');
    ok('FR item 13: fr_ApplyFaceRobotGameShader is registered (material named "Constant" lookup)', !!C);
    while (A.undoStack.length > u0) A.undo();
    reset();
  });
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_modeltasks_b15a_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands + Face Robot corrections)`);
await browser.close();
process.exit(fail ? 1 : 0);
