// CMD-B15a (modeltasks.dll): the 21 commands of src/commands/modelTasksB15a*.ts. No XSIBATCH golden exists for the row:
// this is a contract check against docs/ghidra/cmd-b15a-modeltasks.md and WIRE_CORRECTIONS_B15 items 16-21.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out);
//   2. every command runs with its default arguments on the sample scene without an unexpected error (commands whose
//      required input has no default must fail with a message naming the command);
//   3. the contract's stated results (sub-tasks, parenting, model lookup, file events, gates, resolutions, deltas).
// File content readers / writers are not attested: the checks cover the surrounding steps only.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_modeltasks_b15a_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
  .filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['SICreateModel', 'SIMergeScene', 'SIImportModel', 'SIGetModel', 'SIImportIges', 'SIExportIges', 'MergeMixer', 'ImportMixer', 'SIImportMatLib', 'SIImportReferencedMatLib',
  'ExportMaterialLibrary', 'GetLightListOnModelClip', 'SetLightListOnModelClip', 'SISetResolutionOfRefModels', 'RemoveRefModelResolution', 'AddRefModelResolution', 'SICreateRefModel',
  'CreateEmptyRefModel', 'ApplyDelta', 'ImportReferencedDelta', 'ImportDelta'];
// Required input without a usable default: the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['SIMergeScene', 'SIImportModel', 'SIImportIges', 'SIExportIges', 'MergeMixer', 'ImportMixer', 'SIImportMatLib', 'SIImportReferencedMatLib', 'ExportMaterialLibrary',
  'GetLightListOnModelClip', 'SetLightListOnModelClip', 'SISetResolutionOfRefModels', 'RemoveRefModelResolution', 'ApplyDelta', 'ImportReferencedDelta', 'ImportDelta']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SICreateModel') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.Interactive = false;
  const S = A.modelTasksB15a, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), status: e?.status, log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const undoTo = (n) => { while (A.undoStack.length > n) A.undo(); };
  const cube = A.scene.find('cube');
  const mkNull = (name, x = 0, y = 0, z = 0) => { const r = run('GetPrim', { PresetObj: 'Null', Name: name }); const o = A.scene.find(name); const l = o.kinematics.local; A.setParam(l.get('posx'), x); A.setParam(l.get('posy'), y); A.setParam(l.get('posz'), z); return o; };
  const pos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]].map(v => Math.round(v * 1e6) / 1e6); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    undoTo(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  A.select([cube]);

  // ================= SICreateModel
  {
    const u0 = A.undoStack.length; const n0 = S.subtasks.length;
    const r = run('SICreateModel');
    ok('SICreateModel: empty input -> empty model "Model" under the scene root (Add3DObjectToScene sub-task)', !r.err && r.v.name === 'Model' && r.v.parentObj === A.scene.root && r.v.children.length === 0 && S.subtasks.slice(n0).some(t => t.task === 'Add3DObjectToScene'), r.err);
    undoTo(u0); ok('SICreateModel: undo removes the model', !A.scene.find('Model'));
    const a = mkNull('b15_a', 2, 0, 0), b = mkNull('b15_b', 4, 2, 0); const ga = pos(a), gb = pos(b);
    const u1 = A.undoStack.length; const n1 = S.subtasks.length;
    const r2 = run('SICreateModel', { InputObj: [a, b], Name: 'Pair' });
    const m = r2.v;
    ok('SICreateModel: two objects -> model named Pair, objects are its children', !r2.err && m.name === 'Pair' && a.parentObj === m && b.parentObj === m, r2.err);
    ok('SICreateModel: sub-tasks Add3DObjectToScene then ParentObj', JSON.stringify(S.subtasks.slice(n1).map(t => t.task)) === JSON.stringify(['Add3DObjectToScene', 'ParentObj']), S.subtasks.slice(n1));
    ok('SICreateModel: model moved to the average global position (3,1,0)', JSON.stringify(pos(m)) === JSON.stringify([3, 1, 0]), pos(m));
    ok('SICreateModel: children keep their global pose', JSON.stringify(pos(a)) === JSON.stringify(ga) && JSON.stringify(pos(b)) === JSON.stringify(gb), [pos(a), pos(b)]);
    ok('SICreateModel: compensation preference restored after the run', S.compensate === 0);
    undoTo(u1); ok('SICreateModel: undo restores parents and poses', a.parentObj === A.scene.root && !A.scene.find('Pair') && JSON.stringify(pos(a)) === JSON.stringify(ga));
    const r3 = run('SICreateModel', { InputObj: [a], Name: 'Solo', Parent: a });
    ok('SICreateModel: Parent that is one of the inputs -> 0x80070057', r3.status === 0x80070057 && r3.err.includes('SICreateModel'), r3);
    undoTo(u0);
    for (const n of ['b15_a', 'b15_b']) { const o = A.scene.find(n); if (o) A.run('DeleteObj', { InputObj: [o] }); }
    A.select([cube]);
  }
  // ================= SIGetModel
  {
    const root = A.scene.root; const a = mkNull('g_a'), b = mkNull('g_b');
    const m1 = run('SICreateModel', { InputObj: [a], Name: 'GM1' }).v, m2 = run('SICreateModel', { InputObj: [b], Name: 'GM2' }).v;
    ok('SIGetModel: empty input = scene root', run('SIGetModel', { InputObjs: [] }).v === root && run('SIGetModel').v === root);
    ok('SIGetModel: an object -> its model', run('SIGetModel', { InputObjs: [a] }).v === m1);
    ok('SIGetModel: objects of two models -> the closest common model (scene root)', run('SIGetModel', { InputObjs: [a, b] }).v === root);
    ok('SIGetModel: a model and one of its objects -> the model', run('SIGetModel', { InputObjs: [m1, a] }).v === m1);
    const bad = run('SIGetModel', { InputObjs: ['nonexistent_thing'] });
    ok('SIGetModel: no model found -> 0x80004005', bad.status === 0x80004005, bad);
  }
  // ================= SIImportModel
  {
    FS.ensureFolder('C:\\b15'); FS.writeFile('C:\\b15\\thing.emdl', 'x'); FS.writeFile('C:\\b15\\thing.xsi', 'x'); FS.writeFile('C:\\b15\\thing.abc2', 'x');
    const ev0 = S.events.length; const u0 = A.undoStack.length;
    const r = run('SIImportModel', { FileName: 'C:\\b15\\thing.emdl', ShareOptions: 3 });
    ok('SIImportModel: .emdl -> model named after the file, under the root, ShareOptions kept', !r.err && r.v.name === 'thing' && r.v.parentObj === A.scene.root && r.v.shareOptions === 3, r.err);
    ok('SIImportModel: file events 0x20510015 then 0x20510016 (kind 2)', JSON.stringify(S.events.slice(ev0).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510015, 2], [0x20510016, 2]]), S.events.slice(ev0));
    ok('SIImportModel: content reader not attested -> logged', has(r, /not yet attested/));
    const r2 = run('SIImportModel', { FileName: 'C:\\b15\\thing.emdl', Name: 'Named' });
    ok('SIImportModel: Name given', r2.v?.name === 'Named', r2);
    ok('SIImportModel: missing file -> 0x80070057 (0x17)', run('SIImportModel', { FileName: 'C:\\b15\\nope.emdl' }).status === 0x80070057);
    const rx = run('SIImportModel', { FileName: 'C:\\b15\\thing.xsi' });
    ok('SIImportModel: .xsi -> 0x80070057 (0x33)', rx.status === 0x80070057 && has(rx, /XSIMODELTASKS 0x33/), rx);
    const rc = run('SIImportModel', { FileName: 'C:\\b15\\thing.abc2' });
    ok('SIImportModel: unknown extension without converter -> 0x15 logged, 0x80070057 (0x33)', rc.status === 0x80070057 && has(rc, /XSIMODELTASKS 0x15/), rc);
    S.hooks.converters['.abc2'] = (f, m) => { m.convertedFrom = f; };
    const rv = run('SIImportModel', { FileName: 'C:\\b15\\thing.abc2' });
    ok('SIImportModel: registered converter makes an empty model first (SICreateModel sub-task) and runs', rv.v?.convertedFrom === 'C:\\b15\\thing.abc2' && S.subtasks.some(t => t.task === 'SICreateModel'), rv);
    delete S.hooks.converters['.abc2'];
    S.hooks.fileEvent = (id) => id === 0x20510015 ? 0x562e80c7 : 0;
    const ra = run('SIImportModel', { FileName: 'C:\\b15\\thing.emdl' });
    S.hooks.fileEvent = undefined;
    ok('SIImportModel: a file event answering 0x562e80c7 cancels with that value', ra.status === 0x562e80c7, ra);
    undoTo(u0);
  }
  // ================= SIMergeScene
  {
    FS.writeFile('C:\\b15\\other.scn', 'x');
    const u0 = A.undoStack.length;
    const r = run('SIMergeScene', { FileName: 'C:\\b15\\other.scn' });
    ok('SIMergeScene: model named after the file, under the root, CreatedObj returned', !r.err && r.v.name === 'other' && r.v.parentObj === A.scene.root, r.err);
    ok('SIMergeScene: section merge is not attested -> logged', has(r, /not yet attested/));
    ok('SIMergeScene: Name wins', run('SIMergeScene', { FileName: 'C:\\b15\\other.scn', Name: 'M2' }).v?.name === 'M2');
    ok('SIMergeScene: not a .scn -> 0x80070057', run('SIMergeScene', { FileName: 'C:\\b15\\thing.emdl' }).status === 0x80070057);
    ok('SIMergeScene: missing FileName -> 0x80070057', run('SIMergeScene').status === 0x80070057);
    undoTo(u0);
  }
  // ================= IGES
  {
    FS.writeFile('C:\\b15\\part.igs', 'x'); const u0 = A.undoStack.length; const ev0 = S.events.length;
    const r = run('SIImportIges', { FileName: 'C:\\b15\\part.igs' });
    ok('SIImportIges: empty model made by an SICreateModel sub-task, Value = model', !r.err && r.v?.type === '#model' && S.subtasks.some(t => t.task === 'SICreateModel'), r.err);
    ok('SIImportIges: events 0x20510015 / 0x20510016 (kind 0x19)', JSON.stringify(S.events.slice(ev0).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510015, 0x19], [0x20510016, 0x19]]), S.events.slice(ev0));
    ok('SIImportIges: wrong extension -> 0x80070057', run('SIImportIges', { FileName: 'C:\\b15\\thing.emdl' }).status === 0x80070057);
    ok('SIImportIges: FileName not a string -> 0x80070057', run('SIImportIges', { FileName: 5 }).status === 0x80070057);
    undoTo(u0);
    const e0 = S.events.length;
    const x = run('SIExportIges', { FileName: 'C:\\b15\\out.igs' });
    ok('SIExportIges: runs (events 0x20510013 / 0x20510014, kind 0x19), no return value', !x.err && x.v === undefined && JSON.stringify(S.events.slice(e0).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510013, 0x19], [0x20510014, 0x19]]), x);
    ok('SIExportIges: folder not writable -> 0x80070057 (0x1c on top of 0x51)', run('SIExportIges', { FileName: 'C:\\nofolder\\out.igs' }).status === 0x80070057);
    S.restricted = true;
    const rr = run('SIExportIges', { FileName: 'C:\\b15\\out.igs' });
    ok('restricted mode: SIExportIges -> 0x80004021', rr.status === 0x80004021, rr);
    ok('restricted mode: ExportMaterialLibrary -> 0x80004021', run('ExportMaterialLibrary', { FileName: 'C:\\b15\\o.xsi' }).status === 0x80004021);
    ok('restricted mode: ImportDelta -> 0x80004021', run('ImportDelta', { FileName: 'C:\\b15\\d.delta', Model: 'x' }).status === 0x80004021);
    S.restricted = false;
  }
  // ================= mixers
  {
    FS.writeFile('C:\\b15\\mix.xsimixer', 'x'); const m = A.run('SICreateModel', { Name: 'MixModel' });
    const e0 = S.events.length;
    const r = run('ImportMixer', { FileName: 'C:\\b15\\mix.xsimixer', Parent: m });
    ok('ImportMixer: Value = the model mixer, events kind 0x18', !r.err && r.v?.type === 'mixer' && m.property('mixer') === r.v && JSON.stringify(S.events.slice(e0).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510015, 0x18], [0x20510016, 0x18]]), r.err);
    const old = m.property('mixer'); const d0 = S.subtasks.length;
    run('ImportMixer', { FileName: 'C:\\b15\\mix.xsimixer', Parent: m });
    ok('ImportMixer (Merge false): existing mixer content removed with a DeleteObj sub-task', S.subtasks.slice(d0).some(t => t.task === 'DeleteObj') && m.property('mixer') !== old);
    const d1 = S.subtasks.length; const cur = m.property('mixer');
    run('MergeMixer', { FileName: 'C:\\b15\\mix.xsimixer', Parent: m });
    ok('MergeMixer (Merge true): mixer kept, no DeleteObj', !S.subtasks.slice(d1).some(t => t.task === 'DeleteObj') && m.property('mixer') === cur);
    ok('ImportMixer: not .xsimixer -> 0x80070057', run('ImportMixer', { FileName: 'C:\\b15\\thing.emdl', Parent: m }).status === 0x80070057);
    ok('ImportMixer: FileName not a string -> 0x80070057', run('ImportMixer', { FileName: 7, Parent: m }).status === 0x80070057);
    ok('ImportMixer: Parent that is an object -> its owning model', run('ImportMixer', { FileName: 'C:\\b15\\mix.xsimixer', Parent: cube }).v === A.scene.root.property('mixer'));
  }
  // ================= material libraries
  {
    FS.writeFile('C:\\b15\\lib.xsiml', 'x'); FS.writeFile('C:\\b15\\lib.txt', 'x');
    const e0 = S.events.length; const s0 = S.subtasks.length; const u0 = A.undoStack.length;
    const r = run('SIImportMatLib', { FileName: 'C:\\b15\\lib.xsiml' });
    ok('SIImportMatLib: library made by a CreateLibrary sub-task (___Default___), Value = library, made current', !r.err && r.v?.libType === 1 && S.subtasks.slice(s0).some(t => t.task === 'CreateLibrary') && A.scene.libraryState?.current === r.v, r.err);
    ok('SIImportMatLib: events kind 0x16, CrosswalkImportMatLib run (content reader not attested)', JSON.stringify(S.events.slice(e0).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510015, 0x16], [0x20510016, 0x16]]) && has(r, /CrosswalkImportMatLib: not yet attested/), r.log);
    ok('SIImportMatLib: ShareOptions 0 -> not referenced', !r.v?.referencedFile);
    const rr = run('SIImportMatLib', { FileName: 'C:\\b15\\lib.xsiml', ShareOptions: 5 });
    ok('SIImportMatLib: any non-zero ShareOptions = referenced', !!rr.v?.referencedFile, rr);
    const rf = run('SIImportReferencedMatLib', { FileName: 'C:\\b15\\lib.xsiml', ShareOptions: 0 });
    ok('SIImportReferencedMatLib: same task with ShareOptions 1 (referenced)', !!rf.v?.referencedFile, rf);
    ok('SIImportMatLib: bad extension -> 0x80070057 (0x11c)', run('SIImportMatLib', { FileName: 'C:\\b15\\lib.txt' }).status === 0x80070057);
    const miss = run('SIImportMatLib', { FileName: 'C:\\b15\\gone.xsi' });
    ok('SIImportMatLib: missing file -> warning 0x16 and 0x80070057', miss.status === 0x80070057 && has(miss, /XSIMODELTASKS 0x16/), miss);
    undoTo(u0);
    const e1 = S.events.length; const c0 = A.log.length;
    const x = run('ExportMaterialLibrary', { FileName: 'C:\\b15\\exp.xsiml' });
    ok('ExportMaterialLibrary: no InputObjs = current library; CrosswalkExportMatLib with Binary false; events kind 0x16', !x.err && has(x, /CrosswalkExportMatLib/) && JSON.stringify(S.events.slice(e1).map(e => [e.id, e.kind])) === JSON.stringify([[0x20510013, 0x16], [0x20510014, 0x16]]), x);
    ok('ExportMaterialLibrary: bad extension -> 0x80070057', run('ExportMaterialLibrary', { FileName: 'C:\\b15\\exp.txt' }).status === 0x80070057);
  }
  // ================= light list on model clips
  {
    const clip = A.scene.root; // any node stands for the clip object; the list is stored on it
    const u0 = A.undoStack.length;
    ok('GetLightListOnModelClip: default "" ', run('GetLightListOnModelClip', { ModelClip: clip }).v === '');
    run('SetLightListOnModelClip', { ModelClip: clip, LightList: 'L1,L2' });
    ok('SetLightListOnModelClip / Get: round trip', run('GetLightListOnModelClip', { ModelClip: clip }).v === 'L1,L2');
    undoTo(u0); ok('SetLightListOnModelClip: undo restores the previous list', run('GetLightListOnModelClip', { ModelClip: clip }).v === '');
    ok('Get/SetLightListOnModelClip: null clip -> 0x80004003', run('GetLightListOnModelClip').status === 0x80004003 && run('SetLightListOnModelClip').status === 0x80004003);
  }
  // ================= referenced models, resolutions
  {
    FS.writeFile('C:\\b15\\ref1.emdl', 'x'); FS.writeFile('C:\\b15\\ref2.emdl', 'x');
    const u0 = A.undoStack.length; const s0 = S.subtasks.length;
    const r = run('SICreateRefModel', { FileName: 'C:\\b15\\ref1.emdl', ResolutionName: 'High', ShareOptions: 7 });
    const m = r.v;
    ok('SICreateRefModel: model named after the file, referenced, SICreateModel sub-task, resolution High = file, activated (resolution 1)', !r.err && m.name === 'ref1' && m.ref.resolutions[0] === 'C:\\b15\\ref1.emdl' && m.ref.resolutionNames[0] === 'High' && m.ref.resolution === 1 && m.ref.shareOptions === 7 && S.subtasks.slice(s0).some(t => t.task === 'SICreateModel'), r.err);
    const e = run('CreateEmptyRefModel', { ModelName: 'Emp' });
    ok('CreateEmptyRefModel: empty referenced model, resolution 0 (offloaded)', e.v?.name === 'Emp' && e.v.ref.resolution === 0 && e.v.ref.resolutions.length === 0, e);
    ok('SICreateRefModel: no file, no name -> "RefModel"', run('SICreateRefModel').v?.name === 'RefModel');
    const cf = run('SICreateRefModel', { FileName: 'C:\\b15\\newdir\\made.emdl', CreateFile: true, Activate: false });
    ok('SICreateRefModel: CreateFile writes the missing file (ExportModel sub-task), Activate false -> resolution stays 0', FS.isFile('C:\\b15\\newdir\\made.emdl') && S.subtasks.some(t => t.task === 'ExportModel') && cf.v.ref.resolution === 0, cf);
    const add = run('AddRefModelResolution', { Model: m, ResolutionName: 'Low', FileName: 'C:\\b15\\ref2.emdl' });
    ok('AddRefModelResolution: appended', !add.err && m.ref.resolutions.length === 2 && m.ref.resolutionNames[1] === 'Low', add);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 2 });
    ok('SISetResolutionOfRefModels: existing usable resolution applied', m.ref.resolution === 2);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 9 });
    ok('SISetResolutionOfRefModels: unknown resolution skipped', m.ref.resolution === 2);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 0 });
    ok('SISetResolutionOfRefModels: 0 (offloaded) always applied', m.ref.resolution === 0);
    const rm1 = run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Low' });
    ok('RemoveRefModelResolution: removes a non-active resolution', !rm1.err && m.ref.resolutions.length === 1 && m.ref.resolutionNames.join() === 'High', rm1);
    run('SISetResolutionOfRefModels', { Target: [m], Resolution: 1 });
    run('RemoveRefModelResolution', { Model: m, ResolutionName: 'High' });
    ok('RemoveRefModelResolution: the active resolution is not removed', m.ref.resolutions.length === 1);
    run('RemoveRefModelResolution', { Model: m, ResolutionName: 'Nope' });
    ok('RemoveRefModelResolution: unknown name does nothing', m.ref.resolutions.length === 1);
    ok('RemoveRefModelResolution: Add false without a ResolutionName -> 0x80070057', run('AddRefModelResolution', { Model: m, Add: false }).status === 0x80070057);
    run('AddRefModelResolution', { Model: m, ResolutionName: 'High', Add: false });
    ok('AddRefModelResolution with Add false acts as Remove (active kept)', m.ref.resolutions.length === 1);
    // licence gate (b)
    S.licence = 0; const n0 = m.ref.resolutions.length; const c0 = A.scene.root.children.length;
    const g1 = run('AddRefModelResolution', { Model: m, ResolutionName: 'X', FileName: 'f' });
    const g2 = run('SICreateRefModel', { FileName: 'C:\\b15\\ref1.emdl' });
    const g3 = run('SISetResolutionOfRefModels', { Target: [m], Resolution: 0 });
    S.licence = 0xffff;
    ok('licence bit 0x40 missing: ref-model commands print XSIMODELTASKS 0x17 and do nothing', !g1.err && !g2.err && !g3.err && has(g1, /XSIMODELTASKS 0x17/) && has(g2, /XSIMODELTASKS 0x17/) && m.ref.resolutions.length === n0 && A.scene.root.children.length === c0, [g1, g2, g3]);
    undoTo(u0);
  }
  // ================= deltas
  {
    const r0 = run('SICreateRefModel', { FileName: 'C:\\b15\\ref1.emdl' }); const m = r0.v;
    const u0 = A.undoStack.length;
    FS.writeFile('C:\\b15\\a.delta', JSON.stringify({ params: {} }));
    const r = run('ImportDelta', { FileName: 'C:\\b15\\a.delta', Model: m });
    const d = r.v;
    ok('ImportDelta: delta created on the referenced model: File, Mode 0 (copied, Reference false)', !r.err && d?.type === 'delta' && d.parent === m && d.val('File') === 'C:\\b15\\a.delta' && d.val('Mode') === 0, r.err);
    const r2 = run('ImportReferencedDelta', { FileName: 'C:\\b15\\a.delta', Model: m, Interactive: false });
    ok('ImportReferencedDelta: Mode stays 3 (referenced); the previous delta is replaced (batch)', r2.v?.val('Mode') === 3 && m.properties.filter(p => p.type === 'delta').length === 1, r2);
    S.hooks.yesNoCancel = () => 'cancel'; A.Interactive = true;
    const rc = run('ImportDelta', { FileName: 'C:\\b15\\a.delta', Model: m });
    ok('ImportDelta: Cancel in the replace question aborts', rc.v === undefined && m.properties.filter(p => p.type === 'delta').length === 1, rc);
    S.hooks.yesNoCancel = () => 'yes';
    const ry = run('ImportDelta', { FileName: 'C:\\b15\\a.delta', Model: m });
    const names = m.properties.filter(p => p.type === 'delta').map(p => p.name);
    ok('ImportDelta: Yes keeps the old delta as <name>_BACKUP and creates a new one', names.length === 2 && names.some(n => /_BACKUP$/.test(n)), names);
    S.hooks.yesNoCancel = undefined; A.Interactive = false;
    ok('ImportDelta: non$existent.delta = no file (no warning)', !has(run('ImportDelta', { FileName: 'non$existent.delta', Model: m, Interactive: false }), /XSIMODELTASKS 0x16/));
    ok('ImportDelta: missing file warns 0x16', has(run('ImportDelta', { FileName: 'C:\\b15\\none.delta', Model: m, Interactive: false }), /XSIMODELTASKS 0x16/));
    ok('ImportDelta: empty FileName or missing Model -> 0x80070057', run('ImportDelta', { Model: m }).status === 0x80070057 && run('ImportDelta', { FileName: 'C:\\b15\\a.delta' }).status === 0x80070057);
    const plain = A.run('SICreateModel', { Name: 'NotRef' }); const np = plain.properties.length;
    run('ImportDelta', { FileName: 'C:\\b15\\a.delta', Model: plain });
    ok('ImportDelta: a model that is not a referenced model is left alone', plain.properties.length === np);
    // ApplyDelta: parameter changes held by the delta are applied to the model's content
    const kid = A.scene.root.children[0];
    const dd = m.properties.filter(p => p.type === 'delta').at(-1); dd.changes.set('nonexistent.pos', 1);
    const ra = run('ApplyDelta', { Deltas: [dd] });
    ok('ApplyDelta: applies the delta (no undo flag); applying state cleared; non-delta items ignored', !ra.err && !(m.ref.applying & 2) && !run('ApplyDelta', { Deltas: [cube] }).err, ra);
    S.licence = 0; const rl = run('ImportDelta', { FileName: 'C:\\b15\\a.delta', Model: m, Interactive: false }); const rap = run('ApplyDelta', { Deltas: [dd] }); S.licence = 0xffff;
    ok('licence bit 0x40 missing: ImportDelta / ApplyDelta print XSIMODELTASKS 0x17 and do nothing', has(rl, /XSIMODELTASKS 0x17/) && has(rap, /XSIMODELTASKS 0x17/) && rl.v === undefined);
    undoTo(u0);
  }
  return out;
}, { NAMES, DF: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_modeltasks_b15a_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
