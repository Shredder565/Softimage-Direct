// CMD-B6e: the 24 script commands of duplicate.vbs / Rendering.vbs / simulation.vbs / action.vbs on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md and the registry
// dump data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated calls / results.
// Delegated calls are read from app.duplicateRenderingSimulationScripts.calls; dialogs are answered through
// app.duplicateRenderingSimulationScripts.dialog (and through the real modal page for three commands).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_duplicate_rendering_simulation_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

// scripting name -> registry display name of the entry that is registered
const LABELS = {
  CopyAllAnimation2: 'Copy All Animation', RemoveAllAnimation: 'Remove All Animation', DuplicateFromAnim: 'Duplicate from Animation',
  SaveKeyAtMultipleFrames: 'Save Key At Multiple Frames', CreateEmptyPartition: 'Create Empty Partition', SICreatePartition: 'New Partition',
  CreatePassWithPartition: 'New Pass with Partition', GetPass: 'More Passes...',
  ConnectImageTo3DO: 'Blend in image Preset and create the image clip to Default Texture Ports', ShowNextOGLProjection: 'Show Next OGL Projection',
  ShowPreviousOGLProjection: 'Show Previous OGL Projection', CreateCGFX: 'Creates a CGFX material', CreateFX: 'Creates an FX material',
  LaunchFlipbookForPass: 'Launch Flipbook For Pass', ExportMI2File: 'Export To MI2 File', ExportAllPassesToMI2: 'Export All Passes To MI2',
  EditShaderCompoundPPGLogic: 'EditShaderCompoundPPGLogic', StoreEnvironmentCacheToMixer: 'StoreEnvironmentCacheToMixer',
  StoreEnvironmentCachesToMixer: 'StoreEnvironmentCachesToMixer', MergeSimulationEnvironments: 'MergeEnvironments',
  ChangeEnvironmentDynamicsOperator: 'ChangeEnvironmentDynamicsOperator', CacheObjectsIntoFileDialog: 'Cache Objects Into File With Dialog',
  EditICECompoundPPGLogic: 'EditICECompoundPPGLogic', FindPeriods: 'Find Cycle Input',
};
const NAMES = Object.keys(LABELS);
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const entryArgs = (c) => c.args.map(a => [a.name, a.default ?? null]);
const registry = Object.fromEntries(NAMES.map(n => {
  // DuplicateFromAnim has two entries with the same display name: the scripted one returns a value
  const c = list.find(x => x.scripting_name === n && x.name === LABELS[n] && (n !== 'DuplicateFromAnim' || x.return_value === true));
  return [n, c ? entryArgs(c) : null];
}));
const allEntries = (n) => list.filter(x => x.scripting_name === n && x.language !== 'CPP').map(c => [c.name, Object.fromEntries(c.args.slice(1).map(a => [a.name, a.default ?? null]))]);
const uiDuplicate = entryArgs(list.find(x => x.scripting_name === 'DuplicateFromAnim' && x.return_value !== true));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ExportAllPassesToMI2'), null, { timeout: 90000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, registry, copyEntries, removeEntries, uiDuplicate }) => {
  const app = window.Application; const S = app.duplicateRenderingSimulationScripts; const root = app.scene.root; const A = app.anim;
  const results = [];
  const J = (v) => JSON.stringify(v, (_k, x) => x === undefined ? '<none>' : (typeof x === 'number' && !Number.isFinite(x)) ? String(x) : (x && typeof x === 'object' && typeof x.fullName === 'string' && Array.isArray(x.params)) ? `node:${x.name}` : x);
  const eq = (label, gotV, exp) => { const a = J(gotV), b = J(exp); results.push({ label, pass: a === b, got: a, exp: b }); };
  const ok = (label, cond, detail) => results.push({ label, pass: !!cond, got: J(detail ?? cond), exp: 'true' });
  // a command without result gives {}
  const call = (f) => { try { const v = f(); return v === undefined ? {} : { v }; } catch (e) { return { err: String(e?.message ?? e), cancelled: e?.cancelled === true }; } };
  const run = (n, a = {}) => call(() => app.run(n, a));
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const calls = () => S.calls.map(c => [c.name, c.args, c.via]);
  const callNames = () => S.calls.map(c => c.name);
  const reset = () => { S.calls.length = 0; S.dialog = null; S.browsePreset = null; };
  const find = (n) => app.scene.find(n);
  const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
  const L = (o, n) => o.kinematics.local.get(n);
  const hasFc = (p) => (A.fcurves.get(p)?.keys.length ?? 0) > 0;
  const cube = find('cube'), sphere = find('sphere'), sphere1 = find('sphere1'), light = find('light'), camera = find('Camera');
  const Property = root.properties[0].constructor;
  app.autoInspect = false; app.Interactive = false;
  const defaultPass = app.scene.passes[0];

  // ================= registration
  eq('all 24 commands registered', NAMES.filter(n => !app.commands.has(n)), []);
  for (const n of NAMES) {
    const d = app.commands.get(n);
    eq(`${n}: registered with the registry's argument names / defaults`, d ? d.args.map(a => [a.name, a.default ?? null]) : null, registry[n]);
  }
  eq('CopyAllAnimation2: the 8 registry entries are listed with their defaults', S.entries.CopyAllAnimation2.map(e => [e.label, e.defaults]).sort(), copyEntries.sort());
  eq('RemoveAllAnimation: the 11 registry entries are listed with their defaults', S.entries.RemoveAllAnimation.map(e => [e.label, Object.fromEntries(Object.entries(e.defaults))]).sort(),
    removeEntries.map(([l, d]) => [l, Object.fromEntries(['SourceMask', 'ParameterMask', 'StaticFCurves', 'BaseAnimation', 'LayerAnimation'].map(k => [k, d[k]]))]).sort());
  eq('DuplicateFromAnim: UI entry arguments', S.uiArgs.DuplicateFromAnim.map(a => [a.name, a.default ?? null]), uiDuplicate);

  // ================= CopyAllAnimation2
  {
    reset(); app.select([sphere]);
    eq('CopyAllAnimation2 default: no result', run('CopyAllAnimation2'), {});
    eq('CopyAllAnimation2 default: one CopyAnimation <object>, fcurves, expressions, False, True, True', calls(), [['CopyAnimation', ['sphere', true, true, false, true, true], 'stand-in']]);
    eq('CopyAllAnimation2 default: buffer holds the animated parameters; selection unchanged', [S.animClipboard.target, S.animClipboard.items.length, app.selection.map(n => n.name)], ['sphere', 9, ['sphere']]);
    const targets = {};
    for (const [tok, sfx] of [['siTransformParam', '.kine'], ['siScalingParam', '.kine.local.scl'], ['siRotationParam', '.kine.local.ori.euler'], ['siTranslationParam', '.kine.local.pos']]) {
      reset(); run('CopyAllAnimation2', { ParameterMask: `:${tok}:siParameterFilter` }); targets[tok] = [S.calls[0].args[0] === 'sphere' + sfx, S.animClipboard.items.length];
    }
    eq('CopyAllAnimation2 parameter families: target suffixes .kine / .kine.local.scl / .kine.local.ori.euler / .kine.local.pos', targets,
      { siTransformParam: [true, 9], siScalingParam: [true, 3], siRotationParam: [true, 3], siTranslationParam: [true, 3] });
    reset(); run('CopyAllAnimation2', { ParameterMask: 7 });
    eq('CopyAllAnimation2: numeric filter 7 = translation', S.calls[0].args[0], 'sphere.kine.local.pos');
    reset(); run('CopyAllAnimation2', { SourceMask: ':siFcurveSource:siSourceType' }); const fcOnly = S.calls[0].args.slice(1, 3);
    reset(); run('CopyAllAnimation2', { SourceMask: ':siExpressionSource:siSourceType' });
    eq('CopyAllAnimation2: source switches (fcurves only / expressions only)', [fcOnly, S.calls[0].args.slice(1, 3), S.animClipboard.items.length], [[true, false], [false, true], 0]);
    reset(); let m = mark(); run('CopyAllAnimation2', { SourceMask: ':siConstraintSource:siSourceType' });
    eq('CopyAllAnimation2: other source masks are refused with the shipped message', [logFrom(m), calls()], [['info:Sorry this command is not implemented to copy constraints yet'], []]);
    reset(); m = mark(); run('CopyAllAnimation2', { InputObjs: 42 });
    eq('CopyAllAnimation2: not an object collection', [logFrom(m), calls()], [['info:not the right selection....'], []]);
    reset(); app.select([]); m = mark(); run('CopyAllAnimation2');
    eq('CopyAllAnimation2: empty collection stops silently', [logFrom(m), calls()], [[], []]);
    reset(); run('CopyAllAnimation2', { InputObjs: 'sphere,cube', ParameterMask: ':siRotationParam:siParameterFilter' });
    eq('CopyAllAnimation2: one call per object, in order; the buffer holds the last object (inferred, Q3)', [S.calls.map(c => c.args[0]), S.animClipboard.target, S.animClipboard.items.length],
      [['sphere.kine.local.ori.euler', 'cube.kine.local.ori.euler'], 'cube.kine.local.ori.euler', 0]);
    const px = L(cube, 'posx'); A.setKey(px, 1, 0); A.setKey(px, 10, 5);
    reset(); const u = app.undoStack.length; run('CopyAllAnimation2', { InputObjs: 'cube', RemoveAnimation: true });
    const removed = !hasFc(px); if (app.undoStack.length > u) app.undo();
    eq('CopyAllAnimation2 RemoveAnimation: passed to CopyAnimation, the copied animation is removed (inferred), undoable', [S.calls[0].args[3], S.animClipboard.items.length, removed, hasFc(px)], [true, 1, true, true]);
    A.removeAnimation(px);
  }

  // ================= RemoveAllAnimation
  {
    const all9 = () => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].map(n => hasFc(L(sphere, n)) ? 1 : 0).join('');
    reset(); app.select([sphere]); let m = mark();
    eq('RemoveAllAnimation scaling: no result', run('RemoveAllAnimation', { ParameterMask: ':siScalingParam:siParameterFilter' }), {});
    eq('RemoveAllAnimation scaling: RemoveAnimation "<obj>.kine.local.scl.scl*", Time, StaticFCurves, Base, Layer, SourceMask; no animation test',
      calls(), [['RemoveAnimation', ['sphere.kine.local.scl.scl*', A.frame, false, true, true, ':siAnySource:siSourceType'], 'stand-in']]);
    const afterScl = all9(); app.undo();
    eq('RemoveAllAnimation scaling: only the scaling curves go; nothing logged; undoable', [afterScl, logFrom(m), all9()], ['111111000', ['info:Undo RemoveAllAnimation'], '111111111']);
    const fam = {};
    for (const [tok, path, left] of [['siRotationParam', 'sphere.kine.local.ori.euler.rot*', '111000111'], ['siTranslationParam', 'sphere.kine.local.pos.pos*', '000111111'], ['siTransformParam', 'sphere/.kine.local', '000000000']]) {
      reset(); m = mark(); run('RemoveAllAnimation', { ParameterMask: `:${tok}:siParameterFilter` });
      fam[tok] = [S.calls.map(c => c.name), S.calls[0].args[0] === path, all9() === left, logFrom(m).filter(l => /Q1/.test(l)).length]; app.undo();
    }
    eq('RemoveAllAnimation rotation / translation / transform paths (transform: "<obj>/.kine.local", flagged Q1)', fam,
      { siRotationParam: [['RemoveAnimation'], true, true, 0], siTranslationParam: [['RemoveAnimation'], true, true, 0], siTransformParam: [['RemoveAnimation'], true, true, 1] });
    reset(); run('RemoveAllAnimation');
    const allGone = all9(); const names = callNames(); const isAnimArgs = S.calls[0].args; app.undo();
    eq('RemoveAllAnimation all parameters: IsAnimated <obj>, SourceMask, BranchFlag, <list>, True, then RemoveAnimation on that list',
      [names, isAnimArgs[0], isAnimArgs[1], isAnimArgs[2], isAnimArgs[3].length, isAnimArgs[4], allGone, all9()],
      [['IsAnimated', 'RemoveAnimation'], 'sphere', ':siAnySource:siSourceType', ':siUnspecified:siBranchFlag', 9, true, '000000000', '111111111']);
    reset(); run('RemoveAllAnimation', { InputObjs: 'sphere1' });
    eq('RemoveAllAnimation all parameters: nothing animated = no RemoveAnimation call', callNames(), ['IsAnimated']);
    reset(); app.select([]); m = mark(); run('RemoveAllAnimation'); run('RemoveAllAnimation', { InputObjs: 42 });
    eq('RemoveAllAnimation: empty / not a collection stops silently', [calls(), logFrom(m)], [[], []]);
    // static fcurves, expressions, constraints
    const px = L(cube, 'posx'), py = L(cube, 'posy'), pz = L(cube, 'posz');
    A.setKey(px, 1, 2); A.setKey(px, 10, 2); A.setKey(py, 1, 0); A.setKey(py, 10, 4); A.setExpression(pz, 'Fc * 0.5', () => undefined);
    reset(); run('RemoveAllAnimation', { InputObjs: 'cube', SourceMask: ':siFcurveSource:siSourceType', StaticFCurves: true });
    const st = [hasFc(px), hasFc(py), !!A.expression(pz), S.calls[1]?.args[2]]; app.undo();
    eq('RemoveAllAnimation static fcurves: StaticFCurves True is passed on; only constant curves go (public command reference, inferred)', st, [false, true, true, true]);
    reset(); run('RemoveAllAnimation', { InputObjs: 'cube', SourceMask: ':siExpressionSource:siSourceType' });
    const ex = [hasFc(px), hasFc(py), !!A.expression(pz)]; app.undo();
    eq('RemoveAllAnimation expression source: expressions go, fcurves stay; undo restores', [ex, !!A.expression(pz)], [[true, true, false], true]);
    reset(); run('RemoveAllAnimation', { InputObjs: 'cube', SourceMask: ':siFcurveSource:siSourceType', BaseAnimation: false });
    eq('RemoveAllAnimation layer-only entry: base curves stay (layers carry no curves in this build)', [hasFc(px), hasFc(py)], [true, true]);
    reset(); const r = run('RemoveAllAnimation', { InputObjs: 'cube', SourceMask: ':siConstraintSource:siSourceType', ParameterMask: ':siScalingParam:siParameterFilter' });
    eq('RemoveAllAnimation constraint source: RemoveAllCns <objects> only, other arguments ignored', [r, calls(), hasFc(px)], [{}, [['RemoveAllCns', [['cube']], 'bus']], true]);
    A.removeAnimation(px); A.removeAnimation(py); A.removeAnimation(pz);
  }

  // ================= DuplicateFromAnim
  {
    const count = () => [...app.scene.allObjects()].length;
    const posAt = (f) => ['posx', 'posy', 'posz'].map(n => Math.round(A.fcurves.get(L(sphere, n)).eval(f) * 1e4) / 1e4);
    reset(); app.select([cube]); const before = count();
    const r = run('DuplicateFromAnim', { InputObjs: 'sphere', StartFrame: 1, EndFrame: 21, StepFrame: 10 });
    const made = r.v ?? [];
    eq('DuplicateFromAnim 1..21 step 10: three copies returned, play cursor left on the last frame, selection unchanged', [made.length, count() - before, A.frame, app.selection.map(n => n.name)], [3, 3, 21, ['cube']]);
    eq('DuplicateFromAnim: per frame SetValue PlayControl.Current, Refresh, Duplicate (NbItems 1, siNoAnimation, siNoConstraints, siNoSelection, siGlobalXForm)',
      [callNames(), S.calls.filter(c => c.name === 'SetValue').map(c => c.args), S.calls[2].args],
      [['SetValue', 'Refresh', 'Duplicate', 'SetValue', 'Refresh', 'Duplicate', 'SetValue', 'Refresh', 'Duplicate'],
        [['Project.Data.PlayControl.Current', 1], ['Project.Data.PlayControl.Current', 11], ['Project.Data.PlayControl.Current', 21]],
        [['sphere'], 1, '<none>', '<none>', '<none>', '<none>', 'siNoAnimation', 'siNoConstraints', 'siNoSelection', 'siGlobalXForm']]);
    eq('DuplicateFromAnim: each copy is static and sits where the object was at its frame',
      made.map(o => [['posx', 'posy', 'posz'].map(n => Math.round(L(o, n).value * 1e4) / 1e4), hasFc(L(o, 'posx'))]), [1, 11, 21].map(f => [posAt(f), false]));
    reset(); const down = run('DuplicateFromAnim', { InputObjs: 'sphere', StartFrame: 21, EndFrame: 1, StepFrame: -10 });
    eq('DuplicateFromAnim: a negative step counts down', [down.v?.length, S.calls.filter(c => c.name === 'SetValue').map(c => c.args[1])], [3, [21, 11, 1]]);
    reset(); const zero = run('DuplicateFromAnim', { InputObjs: 'sphere', StepFrame: 0 });
    ok('DuplicateFromAnim: step 0 (endless in the script) is refused', /never end/.test(zero.err ?? ''), zero);
    reset(); app.select([]); eq('DuplicateFromAnim: empty input returns an empty collection', [run('DuplicateFromAnim').v, calls()], [[], []]);
    reset(); const inst = run('DuplicateFromAnim', { InputObjs: 'sphere', StartFrame: 1, EndFrame: 1, StepFrame: 1, DoInstance: true });
    eq('DuplicateFromAnim DoInstance: Instantiate <objs> with Hierarchy / Grouping / Selection / Xfrom = 1 (no model filter in the script: the callee refuses a non-model)',
      [callNames(), S.calls[2].args, /not a model/.test(inst.err ?? '')], [['SetValue', 'Refresh', 'Instantiate'], [['sphere'], '<none>', 1, 1, 1, 1], true]);
    // UI entry
    reset(); let seen = null; app.select([sphere]); const b2 = count();
    S.dialog = (q) => { seen = [q.kind, q.title, q.property.name, q.property.params.map(p => [p.name, p.def.type, p.value, p.label, p.def.uimin ?? null, p.def.uimax ?? null, p.def.min ?? null, p.def.max ?? null]), root.properties.includes(q.property)]; q.property.set('Start', 1); q.property.set('End', 11); q.property.set('Step', 5); return true; };
    const args = { StartFrame: 50, EndFrame: 60, StepFrame: 2, DoInstance: false };
    const ui = call(() => S.ui.DuplicateFromAnim(args));
    eq('DuplicateFromAnim UI entry: property "Duplicate From Animation" on the scene root, title 1068, parameters seeded from the timeline (not from the arguments)', seen,
      ['property', 'Duplicate from Animation', 'Duplicate From Animation', [['Start', 'double', A.startFrame, 'Start Frame', A.startFrame, A.endFrame, -1000000, 1000000], ['End', 'double', A.endFrame, 'End Frame', A.startFrame, A.endFrame, -1000000, 1000000],
        ['Step', 'double', 10, 'Step value', 0, A.endFrame - A.startFrame, -1000000, 1000000], ['Instance', 'bool', false, 'Instance (Model Only)', null, null, null, null]], true]);
    eq('DuplicateFromAnim UI entry OK: values read back into the arguments, scripted entry run, property deleted', [ui, args, count() - b2, root.properties.some(p => p.name === 'Duplicate From Animation'), callNames().slice(-1)],
      [{}, { StartFrame: 1, EndFrame: 11, StepFrame: 5, DoInstance: false }, 3, false, ['DeleteObj']]);
    reset(); S.dialog = () => false; const b3 = count(); const cancelled = call(() => S.ui.DuplicateFromAnim({}));
    eq('DuplicateFromAnim UI entry Cancel: property deleted, then cancel (siErrCancelled)', [cancelled.cancelled, count() - b3, root.properties.some(p => p.name === 'Duplicate From Animation')], [true, 0, false]);
    reset(); const batch = call(() => S.ui.DuplicateFromAnim({}));
    eq('DuplicateFromAnim UI entry without a user session: the page cannot open = Cancel (inferred)', batch.cancelled, true);
  }

  // ================= SaveKeyAtMultipleFrames
  {
    const px = L(cube, 'posx'), py = L(cube, 'posy');
    reset(); app.select([cube]); A.marked.clear(); let m = mark();
    eq('SaveKeyAtMultipleFrames: no parameter', [run('SaveKeyAtMultipleFrames'), logFrom(m)], [{}, ['info:You need to select items and mark parameters to key']]);
    A.marked.add(px); A.frame = 4; px.value = 1.5;
    let asked = null; S.dialog = (q) => { asked = [q.kind, q.title]; return '3, 5,abc, 7.5, 6.5, 500, -20,5, 1 2'; }; m = mark();
    const r = run('SaveKeyAtMultipleFrames');
    eq('SaveKeyAtMultipleFrames: input box titled 1070', asked, ['input', 'Input Keys']);
    eq('SaveKeyAtMultipleFrames: split on commas, spaces removed, non-numeric dropped, rounded to integers, out-of-range frames logged and dropped, duplicates kept',
      [r, S.calls.map(c => [c.name, c.args[1]]), logFrom(m)],
      [{}, [['SaveKey', 3], ['SaveKey', 5], ['SaveKey', 8], ['SaveKey', 6], ['SaveKey', 5], ['SaveKey', 12]],
        ['info:Input Key ignored key at frame: 500 - outside the boundries of start and end frame', 'info:Input Key ignored key at frame: -20 - outside the boundries of start and end frame']]);
    eq('SaveKeyAtMultipleFrames: the current value is keyed at each frame, the play cursor is not moved', [A.fcurves.get(px).keys.map(k => [k.time, k.value]), A.frame], [[[3, 1.5], [5, 1.5], [6, 1.5], [8, 1.5], [12, 1.5]], 4]);
    app.undo(); eq('SaveKeyAtMultipleFrames: undoable', hasFc(px), false);
    const invalid = [];
    for (const answer of ['', null, 'x,y', '999']) { reset(); S.dialog = () => answer; m = mark(); run('SaveKeyAtMultipleFrames'); invalid.push([logFrom(m).slice(-1)[0], S.calls.length]); }
    eq('SaveKeyAtMultipleFrames: empty answer, cancelled box or no frame left = "Invalid frame string"', invalid, Array(4).fill(['info:Invalid frame string', 0]));
    reset(); A.marked.clear(); app.select([]); S.dialog = () => '2'; run('SaveKeyAtMultipleFrames', { InputObjs: 'cube.kine.local.posy' });
    eq('SaveKeyAtMultipleFrames: explicit parameter list', [S.calls.length, A.fcurves.get(py)?.keys.map(k => k.time)], [1, [2]]);
    A.removeAnimation(py);
    // the real input box
    reset(); app.Interactive = true; app.select([cube]); A.marked.add(px);
    const p = app.run('SaveKeyAtMultipleFrames'); await tick(80);
    const field = document.querySelector('.drs-inputbox .drs-input'); const title = document.querySelector('.drs-inputbox')?.textContent ?? '';
    if (field) { field.value = '9'; } document.querySelector('.drs-inputbox .sdkh-modal-ok')?.click(); await p; await tick(20);
    app.Interactive = false;
    eq('SaveKeyAtMultipleFrames interactive: a modal input box, OK keys the typed frames', [typeof p?.then, !!field, /Input Keys/.test(title), A.fcurves.get(px)?.keys.map(k => k.time), !!document.querySelector('.drs-inputbox')], ['function', true, true, [9], false]);
    A.removeAnimation(px); A.marked.clear();
  }

  // ================= partitions and passes
  {
    reset(); app.select([cube]);
    const r = run('CreateEmptyPartition');
    eq('CreateEmptyPartition default: SICreateEmptyPartition Passes.Current, "Partition", siObjectPartition; then SelectObj, AutoInspect; Value = the partition',
      [calls().map(c => [c[0], c[1]]), r.v?.name, r.v?.partitionType, defaultPass.partitions.includes(r.v), app.selection[0] === r.v, S.out.CreateEmptyPartition.Value === r.v],
      [[['SICreateEmptyPartition', ['Passes.Current', 'Partition', ':siObjectPartition:siPartitionType']], ['SelectObj', ['Passes.Default_Pass.Partitions.Partition']], ['AutoInspect', ['Passes.Default_Pass.Partitions.Partition']]],
        'Partition', 'siObjectPartition', true, true, true]);
    reset(); const lp = run('CreateEmptyPartition', { Target: 'Passes.Default_Pass', Name: 'Lights', Type: ':siLightPartition:siPartitionType' });
    eq('CreateEmptyPartition: light type, named pass', [lp.v?.name, lp.v?.partitionType], ['Lights', 'siLightPartition']);
    const n0 = defaultPass.partitions.length; app.undo();
    eq('CreateEmptyPartition: undoable', defaultPass.partitions.length, n0 - 1);

    reset(); app.select([]);
    const both = run('SICreatePartition', { Name: 'Fg', InputObjs: 'cube,light,Camera,sphere1' });
    const objPart = defaultPass.partitions.find(p => p.name === 'Fg'), lightPart = defaultPass.partitions.find(p => p.name === 'Fg1');
    eq('SICreatePartition objects + lights: an object partition then a light partition with the same requested name; MoveToPartition each list; cameras never moved',
      [callNames(), S.calls[0].args, S.calls[2].args, [...(objPart?.members ?? [])].map(o => o.name), [...(lightPart?.members ?? [])].map(o => o.name), lightPart?.partitionType],
      [['SICreateEmptyPartition', 'MoveToPartition', 'SICreateEmptyPartition', 'MoveToPartition'], ['', 'Fg', 'siObjectPartition'], ['', 'Fg', 'siLightPartition'], ['cube', 'sphere1'], ['light'], 'siLightPartition']);
    eq('SICreatePartition: Value is the last partition created (the light partition); no selection', [both.v === lightPart, S.out.SICreatePartition.Value === lightPart, app.selection.length], [true, true, 0]);
    reset(); const moved = run('SICreatePartition', { Name: 'Fg2', InputObjs: 'cube' });
    eq('SICreatePartition: membership moves between partitions of the pass', [[...moved.v.members].map(o => o.name), [...objPart.members].map(o => o.name)], [['cube'], ['sphere1']]);
    reset(); const none = run('SICreatePartition', { Name: 'Empty' });
    eq('SICreatePartition with no objects: one SICreateEmptyPartition with the type left at its default', [calls().map(c => [c[0], c[1]]), none.v?.name, none.v?.partitionType, none.v?.members.size],
      [[['SICreateEmptyPartition', ['', 'Empty', '<none>']]], 'Empty', 'siObjectPartition', 0]);

    reset(); app.select([sphere1]); const passes0 = app.scene.passes.length;
    const pw = run('CreatePassWithPartition', { Name: 'Beauty', ParamName: 'Hero', InputObjs: 'cube' });
    const pass = pw.v; const bg = pass?.partitions.find(p => p.name === 'Background_Objects_Partition'); const hero = pass?.partitions.find(p => p.name === 'Hero');
    eq('CreatePassWithPartition: SICreatePass, SetCurrentPass, SICreatePartition (no target, name ParamName, the objects), SelectObj "<pass>.Partitions.Background_Objects_Partition", AddProp "Visibility"',
      [callNames(), S.calls[0].args, S.calls.find(c => c.name === 'SICreatePartition')?.args, S.calls.find(c => c.name === 'SelectObj')?.args, S.calls.find(c => c.name === 'AddProp')?.args],
      [['SICreatePass', 'SetCurrentPass', 'SICreatePartition', 'SICreateEmptyPartition', 'MoveToPartition', 'SelectObj', 'AddProp'], ['Pass', 'Beauty'], ['<none>', 'Hero', ['cube']], ['Beauty.Partitions.Background_Objects_Partition'], ['Visibility']]);
    eq('CreatePassWithPartition: Value = the new pass, now current; the partition is in it with the objects; background partition selected and carrying a Visibility property',
      [pass?.name, app.scene.passes.length - passes0, app.scene.passes[app.scene.passes.length - 1] === pass, [...(hero?.members ?? [])].map(o => o.name), app.selection.length === 1 && app.selection[0] === bg, (bg?.properties ?? []).map(p => [p.name, p.type])],
      ['Beauty', 1, true, ['cube'], true, [['Visibility', 'visibility']]]);
    reset(); const cancelled = run('GetPass');
    eq('GetPass, nothing chosen in the preset browser: SIGetPreset "", siPassFamily; cancel', [cancelled.cancelled, calls().map(c => [c[0], c[1]]), app.scene.passes.length - passes0], [true, [['SIGetPreset', ['', 'siPassFamily']]], 1]);
    reset(); let asked = null; S.browsePreset = (family, p) => { asked = [family, p]; return 'Pass'; };
    const gp = run('GetPass', { PresetObj: 'Ignored', Name: 'Browsed' });
    eq('GetPass, preset chosen: SICreatePass <preset>, Name; the incoming PresetObj is ignored; no current-pass change',
      [gp, asked, S.calls.slice(-1)[0].name, S.calls.slice(-1)[0].args, app.scene.passes.some(p => p.name === 'Browsed'), app.scene.passes[app.scene.passes.length - 1] === pass, S.out.GetPass.PresetObj],
      [{}, ['siPassFamily', ''], 'SICreatePass', ['Pass', 'Browsed'], true, true, 'Pass']);
  }

  // ================= ConnectImageTo3DO
  {
    reset(); app.select([cube]); let m = mark();
    const r = run('ConnectImageTo3DO', { FileName: 'C:\\pics\\wood.jpg' });
    const layers = r.v ?? []; const names = callNames();
    eq('ConnectImageTo3DO: image clip, BlendInTextureLayers (Image, objects, 3, notify, siBlendInTextureLayers, True, True, False, False), shader on <layer>.color, clip on <shader>.tex, one InspectObj',
      [names.filter((n, i) => names.indexOf(n) === i), S.calls.find(c => c.name === 'BlendInTextureLayers')?.args.slice(0, 1).concat(S.calls.find(c => c.name === 'BlendInTextureLayers')?.args.slice(2)), layers.length >= 1, names.filter(n => n === 'InspectObj').length],
      [['SICreateImageClip', 'BlendInTextureLayers', 'SIGetShaderOnCnxPoint', 'SIConnectShaderToCnxPoint', 'InspectObj'], ['Image', 3, true, ':siBlendInTextureLayers:siBlendInTextureLayersModes', true, true, false, false], true, 1]);
    eq('ConnectImageTo3DO: every returned layer has a shader on color, one clip connection per layer', [names.filter(n => n === 'SIGetShaderOnCnxPoint').length, names.filter(n => n === 'SIConnectShaderToCnxPoint').length], [layers.length, layers.length]);
    reset(); m = mark(); const bad = run('ConnectImageTo3DO', { FileName: '' });
    eq('ConnectImageTo3DO: clip failure = warning, nothing returned', [bad, logFrom(m).slice(-1), callNames()], [{}, ["info:WARNING : Could not create image clip ''"], ['SICreateImageClip']]);
  }

  // ================= ShowNextOGLProjection / ShowPreviousOGLProjection
  {
    reset(); app.select([cube]);
    try { app.run('CreateProjection', {}); } catch { /* checked below */ }
    let cl = cube.clusters.find(c => c.compKind === 'sample');
    if (!cl) { const any = [...app.scene.allObjects()].flatMap(o => o.clusters)[0]; if (any) { cl = new any.constructor('Texture_Coordinates', 'sample', new Set()); cube.addCluster(cl); } }
    const mat = cube.material ?? root.material; const uv = mat.get('UV');
    if (cl) {
      for (const p of [...cl.properties]) cl.removeProperty(p);
      for (const n of ['UVa', 'UVb', 'UVc']) cl.addProperty(new Property(n, 'uvprojection', []));
      const seq = [];
      uv.value = 'UVa'; app.select([cube]);
      run('ShowNextOGLProjection'); seq.push(uv.value); run('ShowNextOGLProjection'); seq.push(uv.value); run('ShowNextOGLProjection'); seq.push(uv.value);
      run('ShowPreviousOGLProjection'); seq.push(uv.value); run('ShowPreviousOGLProjection'); seq.push(uv.value);
      eq('ShowNext / ShowPreviousOGLProjection: the material UV parameter cycles through the UV property names and wraps both ways', seq, ['UVb', 'UVc', 'UVa', 'UVc', 'UVb']);
      eq('ShowNextOGLProjection: ActivateObjectSelTool first', callNames()[0], 'ActivateObjectSelTool');
      uv.value = 'elsewhere'; run('ShowNextOGLProjection');
      eq('ShowNextOGLProjection: a current name that is not in the list counts as the first entry (inferred)', uv.value, 'UVb');
      for (const p of [...cl.properties]) cl.removeProperty(p); run('ShowPreviousOGLProjection');
      eq('ShowPreviousOGLProjection: sample clusters without UV property write an empty name (inferred)', uv.value, '');
      uv.value = 'keep'; app.select([sphere1]); run('ShowNextOGLProjection'); app.select([]); const none = run('ShowNextOGLProjection');
      eq('ShowNextOGLProjection: objects without sample cluster are skipped; nothing selected = nothing', [uv.value, none], ['keep', {}]);
      uv.value = '';
    } else ok('ShowNextOGLProjection: a sample cluster could be made for the test', false, 'no cluster class reachable');
  }

  // ================= CreateCGFX / CreateFX
  {
    reset(); const m0 = app.scene.materials.length; const old = cube.material;
    const r = run('CreateCGFX', { FileName: 'C:\\fx\\glow.v2.cgfx', Model: 'cube' });
    const mat = app.scene.materials[app.scene.materials.length - 1];
    eq('CreateCGFX: CreateMaterial CgFX.preset named after the file (cut at the first dot), SetValue <shader>.filename, material assigned to Model; no result',
      [r, calls().map(c => [c[0], c[1]]), app.scene.materials.length - m0, mat.name, mat.surface?.name, mat.surface?.val('filename'), cube.material === mat],
      [{}, [['CreateMaterial', ['CgFX.preset', 'glow', '']], ['SetValue', ['glow.CgFX.filename', 'C:\\fx\\glow.v2.cgfx']], ['GetValue', ['cube']]], 1, 'glow', 'CgFX', 'C:\\fx\\glow.v2.cgfx', true]);
    app.undo(); eq('CreateCGFX: undoable', [app.scene.materials.length - m0, cube.material === old], [0, true]);
    app.hostFs.ensureFolder('C:\\fx'); app.hostFs.writeFile('C:\\fx\\ten.fx', 'float4x4 wvp;\ntechnique10 Main { }\n'); app.hostFs.writeFile('C:\\fx\\nine.fx', 'technique Main { }\nTechnique10 x\n');
    reset(); run('CreateFX', { FileName: 'C:\\fx\\ten.fx' }); const ten = S.calls[0].args;
    reset(); run('CreateFX', { FileName: 'C:/fx/nine.fx', Library: 'NoSuchLib' }); const nine = S.calls[0].args;
    eq('CreateFX: a line containing technique10 (case-sensitive) picks DX10FX.Preset, otherwise DXFX2.Preset; forward-slash names', [ten, nine], [['DX10FX.Preset', 'ten', ''], ['DXFX2.Preset', 'nine', 'NoSuchLib']]);
    reset(); const missing = run('CreateFX', { FileName: 'C:\\fx\\missing.fx' });
    ok('CreateFX: a file that cannot be opened fails the command', !!missing.err && S.calls.length === 0, missing);
    reset(); const m = mark(); const nodot = run('CreateCGFX', { FileName: 'C:\\fx\\nodot' });
    eq('CreateCGFX: a name without a dot is flagged not yet attested (Q4), nothing created', [nodot, logFrom(m).some(l => /not yet attested.*Q4/.test(l)), S.calls.length], [{}, true, 0]);
    reset(); const badModel = run('CreateCGFX', { FileName: 'C:\\fx\\a.cgfx', Model: 'no_such_object' });
    ok('CreateCGFX: an unresolvable Model fails', /cannot resolve/.test(badModel.err ?? ''), badModel);
  }

  // ================= LaunchFlipbookForPass
  {
    const ro = app.scene.renderOptions; const line = () => S.out.LaunchFlipbookForPass.commandLines;
    reset(); defaultPass.set('FrameRangeSource', 3); ro.set('FrameRangeSource', 0); ro.set('FrameStart', 3); ro.set('FrameEnd', 40); ro.set('FrameStep', 2);
    const r = run('LaunchFlipbookForPass', { InputObj: 'Passes.Default_Pass' });
    const cmd = line()[0] ?? '';
    eq('LaunchFlipbookForPass pass (FrameRangeSource 3 = scene render options): Flipbook -m -s "<resolved path>" start end step rate', [r, callNames(), /^-m -s "[^"]*Default_Pass_Main[^"]*" 3 40 2 \d+(\.\d+)?$/.test(cmd), cmd.endsWith(` ${A.fps}`)], [{}, ['Flipbook'], true, true]);
    ok('LaunchFlipbookForPass: the frame token of the path is left unresolved', /\[Frame\]/.test(cmd), cmd);
    reset(); ro.set('FrameRangeSource', 2); run('LaunchFlipbookForPass', { InputObj: 'Passes.Default_Pass.Main' });
    eq('LaunchFlipbookForPass framebuffer, timeline range: PlayControl In / Out / Step', line()[0]?.split('" ')[1], `${A.startFrame} ${A.endFrame} 1 ${A.fps}`);
    reset(); ro.set('FrameRangeSource', 1); let m = mark(); run('LaunchFlipbookForPass', { InputObj: 'Passes.Default_Pass' });
    eq('LaunchFlipbookForPass frame set: message, no flipbook', [logFrom(m).map(l => / is set to use frame set as frame range\. Flipbook needs a sequence\.$/.test(l)), calls()], [[true], []]);
    reset(); defaultPass.set('FrameRangeSource', 0); defaultPass.set('FrameStart', 7); defaultPass.set('FrameEnd', 9); defaultPass.set('FrameStep', 1); run('LaunchFlipbookForPass', { InputObj: 'Passes.Default_Pass' });
    eq("LaunchFlipbookForPass: the pass's own range when its source is not 3", line()[0]?.split('" ')[1], `7 9 1 ${A.fps}`);
    reset(); m = mark(); run('LaunchFlipbookForPass', { InputObj: 'cube' });
    eq('LaunchFlipbookForPass: other items are reported', [logFrom(m), calls()], [['info:cube is not a pass or a framebuffer'], []]);
    defaultPass.set('FrameRangeSource', 3); ro.set('FrameRangeSource', 0); ro.set('FrameStart', 1); ro.set('FrameEnd', 100); ro.set('FrameStep', 1); defaultPass.set('FrameStart', 1); defaultPass.set('FrameEnd', 100);
  }

  // ================= ExportMI2File / ExportAllPassesToMI2
  {
    const def = app.commands.get('ExportRenderArchive'); const real = def.execute; let during = null; let fail = false;
    const mr = (n) => defaultPass.mentalray.params.find(p => p.name.toLowerCase() === n.toLowerCase())?.value;
    const snap = () => [defaultPass.val('ArchiveFilename') ?? null, mr('ArchiveApproximatePolygons'), mr('ArchiveApproximateNURBS'), mr('ArchiveAsciiOutput'), mr('ArchiveEmbedTextures'), defaultPass.val('ArchiveMultiFrame') ?? null];
    def.execute = (_app, a) => { during = [a.Passes, a.StartFrame, a.EndFrame, a.StepFrame, snap()]; if (fail) throw new Error('export failed'); return null; };
    const base = [mr('ArchiveApproximatePolygons'), mr('ArchiveApproximateNURBS'), mr('ArchiveAsciiOutput'), mr('ArchiveEmbedTextures')];
    defaultPass.mentalray.params.find(p => p.name.toLowerCase() === 'archiveapproximatepolygons').value = false; defaultPass.mentalray.params.find(p => p.name.toLowerCase() === 'archiveasciioutput').value = false;
    const before = [mr('ArchiveApproximatePolygons'), mr('ArchiveApproximateNURBS'), mr('ArchiveAsciiOutput'), mr('ArchiveEmbedTextures')];
    reset();
    const r = run('ExportMI2File', { InputObjs: 'Passes.Default_Pass,cube', PresetObj: 'ignored', StartFrame: 2, EndFrame: 6, FileName: 'C:\\out\\shot.MI2', ApproximatePolygons: false, ApproximateFaces: false, AsciiOutput: true, VerbatimTextures: true, MultipleFiles: true, Incremental: true });
    eq('ExportMI2File: ExportRenderArchive <mental ray passes>, Start, End, Step with the pass parameters overridden (file name without .mi2; ApproximatePolygons / ApproximateFaces write the AsciiOutput value)',
      [r, during, callNames()], [{}, ['Default_Pass', 2, 6, null, ['C:\\out\\shot', true, true, true, true, true]], ['ExportRenderArchive']]);
    eq('ExportMI2File: every overridden parameter is restored afterwards', [mr('ArchiveApproximatePolygons'), mr('ArchiveApproximateNURBS'), mr('ArchiveAsciiOutput'), mr('ArchiveEmbedTextures'), defaultPass.val('ArchiveFilename'), defaultPass.val('ArchiveMultiFrame')], [...before, '', false]);
    reset(); during = null; run('ExportMI2File', { InputObjs: 'Passes.Default_Pass' });
    eq('ExportMI2File: arguments that are not supplied override nothing', [during?.[4].slice(1, 5), S.out.ExportMI2File.overridden.length], [before, 0]);
    reset(); fail = true; const failed = run('ExportMI2File', { InputObjs: 'Passes.Default_Pass', AsciiOutput: true });
    eq('ExportMI2File: a failing export is re-raised after the restore (Q5)', [/export failed/.test(failed.err ?? ''), mr('ArchiveAsciiOutput')], [true, before[2]]);
    fail = false; reset(); during = null; defaultPass.set('Renderer', 'Arnold'); run('ExportMI2File', { InputObjs: 'Passes.Default_Pass' }); const other = during;
    defaultPass.set('Renderer', 'MENTAL RAY'); run('ExportMI2File', { InputObjs: 'Passes.Default_Pass' }); const named = !!during; during = null;
    defaultPass.set('Renderer', ''); app.select([]); run('ExportMI2File'); run('ExportMI2File', { InputObjs: 'cube' });
    eq('ExportMI2File: only mental ray passes (own renderer, case-insensitive, or the scene one when empty); empty input / no pass left stops silently', [other, named, during], [null, true, null]);
    def.execute = real;
    defaultPass.mentalray.params.find(p => p.name.toLowerCase() === 'archiveapproximatepolygons').value = base[0]; defaultPass.mentalray.params.find(p => p.name.toLowerCase() === 'archiveasciioutput').value = base[2];
    const stale = run('ExportAllPassesToMI2');
    ok('ExportAllPassesToMI2 (SPEC-PARTIAL): the stale registration fails at handler lookup', /ExportAllPassesToMI2Proc not found/.test(stale.err ?? '') && /Q6/.test(stale.err ?? ''), stale);
  }

  // ================= EditShaderCompoundPPGLogic / EditICECompoundPPGLogic
  {
    const props = Array(10).fill(0).map((_, i) => `v${i}`); props[8] = 'Sub OnInit\nEnd Sub'; props[9] = '';
    cube.compoundProperties = props;
    reset(); let seen = null;
    S.dialog = (q) => { seen = [q.kind, q.title, q.property.name, q.property.type, q.property.params.map(p => [p.name, p.def.type, p.value]), root.properties.includes(q.property)]; q.property.set('Logic', 'new logic'); q.property.set('Language', 'Python'); return true; };
    const r = run('EditShaderCompoundPPGLogic', { InputObj: 'cube' });
    eq('EditShaderCompoundPPGLogic: temporary property "Shader Compound PPG Logic" (Language, Logic), title 1177; an empty language becomes VBScript', seen,
      ['property', 'Shader Compound PPG Logic', 'Shader Compound PPG Logic', 'customparamset', [['Language', 'string', 'VBScript'], ['Logic', 'string', 'Sub OnInit\nEnd Sub']], true]);
    eq('EditShaderCompoundPPGLogic OK: SetShaderCompoundPropertiesEx <obj>, ModifyFlags 768, PPGLogic, PPGLogicLanguage only; True; property deleted; no return value',
      [r, calls().map(c => [c[0], c[1]]), props[8], props[9], S.out.EditShaderCompoundPPGLogic.result, root.properties.some(p => p.name === 'Shader Compound PPG Logic')],
      [{}, [['GetShaderCompoundProperties', ['cube']], ['SetShaderCompoundPropertiesEx', ['cube', 768, 'new logic', 'Python']]], 'new logic', 'Python', true, false]);
    reset(); S.dialog = (q) => { q.property.set('Logic', 'discarded'); return false; }; run('EditShaderCompoundPPGLogic', { InputObj: 'cube' });
    eq('EditShaderCompoundPPGLogic Cancel: nothing written, False, property deleted', [props[8], callNames(), S.out.EditShaderCompoundPPGLogic.result, root.properties.some(p => p.name === 'Shader Compound PPG Logic')], ['new logic', ['GetShaderCompoundProperties'], false, false]);
    reset(); let opened = false; S.dialog = () => { opened = true; return true; }; cube.compoundProperties = props.slice(0, 9); run('EditShaderCompoundPPGLogic', { InputObj: 'cube' });
    const short = [opened, S.out.EditShaderCompoundPPGLogic.result]; delete cube.compoundProperties; const m = mark(); run('EditShaderCompoundPPGLogic', { InputObj: 'cube' });
    eq('EditShaderCompoundPPGLogic: a result shorter than 10 values stops (False), no page; a node without compound data is flagged (Q11)', [short, opened, logFrom(m).some(l => /not yet attested.*Q11/.test(l))], [[false, false], false, true]);
    // ICE
    const ice = Array(13).fill(0).map((_, i) => i); ice[11] = 'function OnInit() {}'; ice[12] = 'JScript'; sphere1.compoundProperties = ice;
    reset(); S.dialog = (q) => { seen = [q.title, q.property.name, q.property.val('Language'), q.property.val('Logic')]; q.property.set('Logic', '// edited'); return true; };
    run('EditICECompoundPPGLogic', { InputObj: 'sphere1' });
    eq('EditICECompoundPPGLogic: property "ICE Compound PPG Logic", title 1516, logic / language at 11 / 12', seen, ['ICE Compound PPG Logic', 'ICE Compound PPG Logic', 'JScript', 'function OnInit() {}']);
    // CMD-B19c puts EditICECompoundProperties on the bus (optasksB19cIce.ts): the call goes there; sphere1 is not an ICE
    // compound, so the bus command has nothing to edit and the stand-in array keeps its logic
    eq('EditICECompoundPPGLogic OK: EditICECompoundProperties <obj>, values 0..10 unchanged, new logic, language (bus command since CMD-B19c)', [calls().map(c => [c[0], c[1], c[2]]), ice[11], S.out.EditICECompoundPPGLogic.result],
      [[['GetICECompoundProperties', ['sphere1'], 'stand-in'], ['EditICECompoundProperties', ['sphere1', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '// edited', 'JScript'], 'bus']], 'function OnInit() {}', true]);
    reset(); sphere1.compoundProperties = ice.slice(0, 12); S.dialog = () => { opened = true; return true; }; opened = false; run('EditICECompoundPPGLogic', { InputObj: 'sphere1' });
    eq('EditICECompoundPPGLogic: fewer than 13 values stops (False)', [opened, S.out.EditICECompoundPPGLogic.result], [false, false]);
    // the real modal page
    reset(); app.Interactive = true; cube.compoundProperties = props; props[8] = 'old'; props[9] = 'JScript';
    const p = app.run('EditShaderCompoundPPGLogic', { InputObj: 'cube' }); await tick(80);
    const combo = document.querySelector('.drs-logic-language'), editor = document.querySelector('.drs-logic-editor');
    const page = [typeof p?.then, combo ? [...combo.options].map(o => [o.value, o.textContent]) : null, combo?.value, editor?.value, editor?.dataset.language,
      [...document.querySelectorAll('.drs-modal fieldset legend')].map(l => l.textContent), editor ? [editor.dataset.lineNumbering, editor.dataset.marginWidth, editor.dataset.folding, editor.dataset.font, editor.dataset.commentFont, editor.dataset.preprocessorColor, editor.dataset.commentColor] : null];
    if (combo && editor) { combo.value = 'Python'; combo.dispatchEvent(new Event('change')); editor.value = 'typed'; editor.dispatchEvent(new Event('input')); }
    const lang = editor?.dataset.language; document.querySelector('.drs-modal .sdkh-modal-ok')?.click(); await p; await tick(20); app.Interactive = false;
    eq('EditShaderCompoundPPGLogic interactive: group "Scripting Language" with a VBScript / JScript / Python combo, group "Logic" with the editor and its attested attributes',
      page, ['function', [['VBScript', 'VBScript'], ['JScript', 'JScript'], ['Python', 'Python']], 'JScript', 'old', 'JScript', ['Scripting Language', 'Logic'], ['1', '6', '1', 'Tahoma', 'Comic Sans MS', '128', '32768']]);
    eq('EditShaderCompoundPPGLogic interactive: the editor language follows the combo; OK writes back', [lang, props[8], props[9], !!document.querySelector('.drs-modal')], ['Python', 'typed', 'Python', false]);
    delete cube.compoundProperties; delete sphere1.compoundProperties;
  }

  // ================= StoreEnvironmentCacheToMixer / StoreEnvironmentCachesToMixer
  {
    reset(); let m = mark();
    const r = run('StoreEnvironmentCacheToMixer', { EnvironmentCache: 'cube' });
    eq('StoreEnvironmentCacheToMixer: one SIStoreEnvironmentCacheToMixer <cache>, Name, AddClip; nothing returned; the worker is flagged not yet attested',
      [r, calls(), logFrom(m).some(l => /SIStoreEnvironmentCacheToMixer: not yet attested/.test(l))], [{}, [['SIStoreEnvironmentCacheToMixer', ['cube', 'SimulationRun', false], 'not-attested']], true]);
    reset(); let seen = null;
    S.dialog = (q) => { seen = [q.title, q.property.name, q.property.params.map(p => [p.name, p.def.type, p.value, p.label, p.def.desc])]; q.property.set('ActionsName', 'Run2'); q.property.set('AddClip', true); return true; };
    run('StoreEnvironmentCacheToMixer', { EnvironmentCache: 'cube', Name: '(UIOnly)' });
    eq('StoreEnvironmentCacheToMixer (UIOnly): property "StoreEnvironmentCacheToMixer", title 1133, ActionsName / AddClip', seen, ['Store environment cache in mixer', 'StoreEnvironmentCacheToMixer',
      [['ActionsName', 'string', 'SimulationRun', 'RBD Action Name', 'If RBD included in the simualtion, the name given to the new action created'], ['AddClip', 'bool', false, 'Add Clip To Mixer', 'If checked, adds a clip to the mixer on a new track']]]);
    eq('StoreEnvironmentCacheToMixer (UIOnly) OK: the values go to Name / AddClip and to the worker; property deleted', [S.calls.map(c => c.args), S.out.StoreEnvironmentCacheToMixer, root.properties.some(p => p.name === 'StoreEnvironmentCacheToMixer')],
      [[['cube', 'Run2', true]], { Name: 'Run2', AddClip: true }, false]);
    reset(); S.dialog = () => false; const c1 = run('StoreEnvironmentCacheToMixer', { EnvironmentCache: 'cube', Name: '(UIOnly)' });
    eq('StoreEnvironmentCacheToMixer (UIOnly) Cancel: no call, no error, name reset to SimulationRun', [c1, calls(), S.out.StoreEnvironmentCacheToMixer.Name, root.properties.some(p => p.name === 'StoreEnvironmentCacheToMixer')], [{}, [], 'SimulationRun', false]);
    const env = app.run('CreateEnvironment', { Name: 'StoreEnv' }); env.simulationEnvironment = { containers: [], caches: ['cacheA', 'cacheB'], operators: [] };
    reset(); const many = run('StoreEnvironmentCachesToMixer', { Environment: 'StoreEnv', Name: 'R', AddClip: true });
    eq('StoreEnvironmentCachesToMixer: one worker call per cache of the environment, in order; a collection of the results', [many.v?.length, S.calls.map(c => [c.name, c.args])],
      [2, [['SIStoreEnvironmentCacheToMixer', ['cacheA', 'R', true]], ['SIStoreEnvironmentCacheToMixer', ['cacheB', 'R', true]]]]);
    reset(); let title = null; S.dialog = (q) => { title = q.title; return false; }; const c2 = run('StoreEnvironmentCachesToMixer', { Environment: 'StoreEnv', Name: '(UIOnly)' });
    eq('StoreEnvironmentCachesToMixer (UIOnly) Cancel: empty collection, no call; title 1134 (text not decoded, Q2)', [c2.v, calls(), /1134/.test(title)], [[], [], true]);
    app.run('DeleteObj', { InputObj: 'StoreEnv' });
  }

  // ================= MergeSimulationEnvironments
  {
    reset(); app.select([]); let m = mark(); run('MergeSimulationEnvironments'); run('MergeSimulationEnvironments', { SimulationEnvironments: 'cube' });
    const e1 = app.run('CreateEnvironment', { Name: 'EnvA' }), e2 = app.run('CreateEnvironment', { Name: 'EnvB' }), e3 = app.run('CreateEnvironment', { Name: 'EnvC' });
    run('MergeSimulationEnvironments', { SimulationEnvironments: 'EnvA,cube' });
    eq('MergeSimulationEnvironments: none / one environment = the two shipped error messages', logFrom(m, ['error']),
      ['error:MergeEnvironments: You need to select at least two environments in order to merge them.', 'error:MergeEnvironments: You need to select at least two environments in order to merge them.', 'error:MergeEnvironments : You need to select more than an environment object.']);
    e2.simulationEnvironment = { containers: [{ name: 'RigidBodies', type: 'RigidBody', members: [cube] }, { name: 'Forces', type: 'Force', members: [sphere1] }, { name: 'Odd', type: 'Other', members: [light] }], caches: [], operators: [] };
    e3.simulationEnvironment = { containers: [{ name: 'Forces', type: 'Force', members: [sphere1, sphere] }], caches: [], operators: [] };
    reset(); m = mark(); const r = run('MergeSimulationEnvironments', { SimulationEnvironments: 'EnvA,cube,EnvB,EnvC' });
    const d = e1.simulationEnvironment;
    eq('MergeSimulationEnvironments: an empty destination gets RigidBody / RigidBodies, Constraint / Constraints, Force / Forces (AddContainerToEnvironment <dest>, <type>, 1, <name>)',
      [r, S.calls.slice(0, 3).map(c => [c.name, c.args])], [{}, [['AddContainerToEnvironment', ['EnvA', 'RigidBody', 1, 'RigidBodies']], ['AddContainerToEnvironment', ['EnvA', 'Constraint', 1, 'Constraints']], ['AddContainerToEnvironment', ['EnvA', 'Force', 1, 'Forces']]]]);
    eq('MergeSimulationEnvironments: members go to the destination container of the same name and leave the source container (RemoveFromContainer per member)',
      [d.containers.map(c => [c.name, c.members.map(x => x.name)]), callNames().filter(n => n === 'AddMember').length, S.calls.filter(c => c.name === 'RemoveFromContainer').map(c => c.args)],
      [[['RigidBodies', ['cube']], ['Constraints', []], ['Forces', ['sphere1', 'sphere']]], 3, [['EnvB.RigidBodies', 'cube'], ['EnvB.Forces', 'sphere1'], ['EnvC.Forces', 'sphere1'], ['EnvC.Forces', 'sphere']]]);
    eq('MergeSimulationEnvironments: a container name without counterpart is flagged (Q8); the list goes back to the argument; the merged environments are deleted in one DeleteObj',
      [logFrom(m).some(l => /"Odd".*Q8/.test(l)), S.out.MergeSimulationEnvironments.SimulationEnvironments, S.calls.slice(-1)[0].name, S.calls.slice(-1)[0].args, !!find('EnvA'), !!find('EnvB'), !!find('EnvC')],
      [true, 'EnvA,EnvB,EnvC', 'DeleteObj', [['EnvB', 'EnvC']], true, false, false]);
  }

  // ================= ChangeEnvironmentDynamicsOperator
  {
    const env = find('EnvA');
    reset(); let m = mark(); run('ChangeEnvironmentDynamicsOperator'); run('ChangeEnvironmentDynamicsOperator', { InputEnvironment: 'cube' });
    eq('ChangeEnvironmentDynamicsOperator: no active environment / not an environment', logFrom(m), ['error:There is no active simulation environment in this scene.', 'error:You must specify a Simulation Environment.']);
    env.simulationEnvironment.operators = [{ name: 'EnvA.NXDynamicsop' }];
    reset(); m = mark(); const r = run('ChangeEnvironmentDynamicsOperator', { InputEnvironment: 'EnvA', DynamicsEngine: ':siOpenDynamicsEngine:siRBDEngine' });
    eq('ChangeEnvironmentDynamicsOperator NXDynamicsop + siOpenDynamicsEngine: "Switched to ODE", DeleteObj the operator, ApplyOp "DynamicsOp", <environment>',
      [r, logFrom(m), calls().map(c => [c[0], c[1]]), env.simulationEnvironment.operators[0].name], [{}, ['info:Switched to ODE'], [['DeleteObj', ['EnvA.NXDynamicsop']], ['ApplyOp', ['DynamicsOp', 'EnvA']]], 'dynamicsop']);
    reset(); m = mark(); run('ChangeEnvironmentDynamicsOperator', { InputEnvironment: 'EnvA', DynamicsEngine: ':siOpenDynamicsEngine:siRBDEngine' });
    eq('ChangeEnvironmentDynamicsOperator: already on the requested engine = nothing happens, nothing logged', [logFrom(m), calls()], [[], []]);
    app.scene.activeSimulationEnvironment = env; reset(); m = mark(); run('ChangeEnvironmentDynamicsOperator');
    eq('ChangeEnvironmentDynamicsOperator default (active environment, siPhysXEngine) on dynamicsop: "Switched to Ageia physX", ApplyOp "NXDynamicsOp"',
      [logFrom(m), calls().map(c => [c[0], c[1]]), env.simulationEnvironment.operators[0].name], [['info:Switched to Ageia physX'], [['DeleteObj', ['EnvA.dynamicsop']], ['ApplyOp', ['NXDynamicsOp', 'EnvA']]], 'NXDynamicsop']);
    env.simulationEnvironment.operators = [{ name: 'EnvA.DynamicsOp' }]; reset(); m = mark(); run('ChangeEnvironmentDynamicsOperator');
    eq('ChangeEnvironmentDynamicsOperator: names are compared exactly', [logFrom(m), calls()], [[], []]);
    delete app.scene.activeSimulationEnvironment; app.run('DeleteObj', { InputObj: 'EnvA' });
  }

  // ================= CacheObjectsIntoFileDialog
  {
    reset(); app.select([light]); let m = mark(); const none = run('CacheObjectsIntoFileDialog');
    eq('CacheObjectsIntoFileDialog: no geometry selected', [none, logFrom(m), root.properties.some(p => p.name === 'Caching_Options')], [{}, ['error:CacheObjectsIntoFileDialog: No valid geometries selected!'], false]);
    reset(); app.select([cube]); const prefs = app.simulationPrefs;
    const r = run('CacheObjectsIntoFileDialog'); const P = root.properties.find(p => p.name === 'Caching_Options'); const C = S.cachingOptions;
    const file = String(prefs.cachetemplatefilename).split('[version]').join('take1');
    eq('CacheObjectsIntoFileDialog: property Caching_Options on the scene root with the options parameters; InspectObj titled 1135; nothing returned',
      [r, P?.params.filter(p => !p.name.startsWith('attr_')).map(p => [p.name, p.def.type, p.def.min ?? null, p.def.max ?? null, p.def.uimin ?? null, p.def.uimax ?? null]), S.calls.slice(-1)[0].name, S.calls.slice(-1)[0].args],
      [{}, [['FileName', 'string', null, null, null, null], ['Format', 'enum', null, null, null, null], ['Path', 'string', null, null, null, null], ['PathFeedBack', 'string', null, null, null, null],
        ['FrameStart', 'int', -100000, 10000000, A.startFrame, A.endFrame], ['FrameEnd', 'int', -100000, 10000000, A.startFrame, A.endFrame], ['FrameStep', 'int', 1, 10000000, 1, 4], ['overwrite', 'bool', null, null, null, null]],
        'InspectObj', ['Caching_Options', '', 'Caching Options Dialog']]);
    eq('CacheObjectsIntoFileDialog: defaults from the simulation preferences ([version] -> take1), timeline range, step 1, overwrite on, PathFeedBack read-only',
      [P.val('FileName'), P.val('Format'), P.val('Path'), P.val('FrameStart'), P.val('FrameEnd'), P.val('FrameStep'), P.val('overwrite'), P.get('PathFeedBack').def.readOnly],
      [file, 'Custom', prefs.cachetemplateprojectpath, A.startFrame, A.endFrame, 1, true, true]);
    eq('CacheObjectsIntoFileDialog: one attr_<name> switch per writable ICE attribute; PointPosition on by default', [C.attributes, P.val('attr_PointPosition')], [['PointPosition'], true]);
    const tabs = P.layout.map(t => t.tab); const general = P.layout[0].items; const flat = (ns) => ns.flatMap(n => [n, ...flat(n.items ?? [])]);
    eq('CacheObjectsIntoFileDialog layout: tabs General / Attributes; groups FileName, Format, Path, Time Range, Options; buttons Cache!, Preferences, Uncheck All, Check All',
      [tabs, flat(general).filter(n => n.group !== undefined).map(n => n.group), flat(P.layout).filter(n => n.button).map(n => n.label), P.layout[0].items.find(n => n.group === 'Time Range').items.map(n => [n.param, n.label]),
        P.get('Format').def.items.map(i => [i.label, i.value]), flat(P.layout[1].items).filter(n => n.param).map(n => [n.param, n.label])],
      [['General', 'Attributes'], ['FileName', 'Format', 'Path', 'Time Range', 'Options'], ['Cache!', 'Preferences', 'Uncheck All', 'Check All'], [['FrameStart', 'start'], ['FrameEnd', 'end'], ['FrameStep', 'step']],
        [['ICECache', 'ICECache'], ['PC2', 'PC2'], ['Custom', '']], [['attr_PointPosition', 'PointPosition']]]);
    P.set('Path', 'D:\\cache'); P.set('FileName', '[model]_[object]_[frame]'); const custom = P.val('PathFeedBack');
    P.set('Format', 'ICECache'); const icecache = P.val('PathFeedBack'); P.set('Format', 'PC2'); const pc2 = P.val('PathFeedBack'); P.set('Path', 'D:\\cache\\'); const slash = P.val('PathFeedBack');
    eq('CacheObjectsIntoFileDialog page logic: PathFeedBack follows Path / FileName / Format (separator added, .icecache, PC2 drops the frame token and adds .pc2, [object] / [model] replaced)',
      [custom, icecache, pc2, slash], ['D:\\cache/Scene_Root_cube_[frame]', 'D:\\cache/Scene_Root_cube_[frame].icecache', 'D:\\cache/Scene_Root_cube.pc2', 'D:\\cache\\Scene_Root_cube.pc2']);
    reset(); P.set('FrameStart', 2); P.set('FrameEnd', 8); P.set('FrameStep', 2); m = mark(); C.press('CachingOptions_Cache');
    eq('CacheObjectsIntoFileDialog Cache!: CacheObjectsIntoFile PathID 5, range and overwrite from the page, ShowProgressbar, the checked attributes, Version take1, AlternativePath without [object] / [model] replacement',
      [calls(), logFrom(m).some(l => /CacheObjectsIntoFile is not on the bus/.test(l))],
      [[['CacheObjectsIntoFile', ['PathID=5', 'FirstFrame=2', 'LastFrame=8', 'FramesPerStep=2', 'Overwrite=true', 'ShowProgressbar=true', 'Attributes=PointPosition', 'Version=take1', 'AlternativePath=D:\\cache\\[model]_[object].pc2'], 'not-attested']], true]);
    reset(); C.press('CachingOptions_UncheckAll'); const off = P.val('attr_PointPosition'); C.press('CachingOptions_CheckAll'); const on = P.val('attr_PointPosition'); C.press('CachingOptions_Preferences');
    eq('CacheObjectsIntoFileDialog Uncheck All / Check All: SetValue "<property>.attr_*"; Preferences: InspectPreferences "Simulation"', [off, on, calls().map(c => [c[0], c[1]])],
      [false, true, [['SetValue', ['Caching_Options.attr_*', false]], ['SetValue', ['Caching_Options.attr_*', true]], ['InspectPreferences', ['Simulation']]]]);
    const fake = document.createElement('button'); fake.className = 'ppg-spdl-btn'; fake.dataset.button = 'CachingOptions_UncheckAll'; document.body.appendChild(fake); fake.click(); fake.remove();
    eq('CacheObjectsIntoFileDialog: the page buttons of the Property Editor reach the page logic', P.val('attr_PointPosition'), false);
    sphere1.iceAttributes = [{ name: 'PointPosition' }, { name: 'Color' }, { name: 'ID' }, { name: 'Init' }, { name: '__Init_x' }, { name: 'NbPoints', readOnly: true }, { name: 'Loc', dataType: 'siICENodeDataLocation (point locator)' }, { name: 'Custom' }];
    reset(); app.select([cube, sphere1]); run('CacheObjectsIntoFileDialog');
    eq('CacheObjectsIntoFileDialog second run: the property is kept with its values; new attributes get switches (read-only, Init, ID, __Init_*, locators excluded); earlier switches keep their values',
      [root.properties.filter(p => p.name === 'Caching_Options').length, root.properties.find(p => p.name === 'Caching_Options') === P, P.val('Path'), S.cachingOptions.attributes, P.val('attr_PointPosition'), P.val('attr_Color'), P.val('attr_Custom')],
      [1, true, 'D:\\cache\\', ['PointPosition', 'Color', 'Custom'], false, false, false]);
    delete sphere1.iceAttributes; root.removeProperty(P); S.cachingOptions = null;
  }

  // ================= FindPeriods (UI entry)
  {
    const mix = root.properties.find(p => p.type === 'mixer'); mix.clips ??= []; mix.compounds ??= [];
    const ry = L(cube, 'roty'); for (let f = 1; f <= 60; f++) A.setKey(ry, f, Math.round(30 * Math.sin(2 * Math.PI * f / 10) * 1e6) / 1e6);
    const rec = { name: 'CycleClip', source: 'none', start: 1, duration: 60, track: 0, weight: 1, mute: false };
    mix.clips.push(rec); const node = app.mixerActionScripts.node(rec);
    const boxes = []; const hook = (edit) => (q) => { if (q.kind === 'msgbox') { boxes.push([q.title, q.prompt]); return true; } return edit(q); };
    const markers = () => { try { return JSON.parse(String(mix.val('markers') || '[]')); } catch { return []; } };
    ok('FindPeriods test clip is an animation clip node', !!node && node.type === 'mixeranimclip', node?.type);
    A.frame = 1;
    // failures
    const failure = (label, sel, setup, expect) => { reset(); boxes.length = 0; S.dialog = hook(() => true); app.select(sel); setup?.(); const m = mark(); const r = run('FindPeriods'); eq(label, [r.cancelled, logFrom(m)[0], boxes[0]], [true, `info:${expect}`, ['Warning', expect]]); };
    failure('FindPeriods: only objects selected = 1021, box titled Warning, cancel', [cube], null, 'You must select one clip and at least one object.');
    failure('FindPeriods: no object selected = 1021', [node], null, 'You must select one clip and at least one object.');
    failure('FindPeriods: current frame outside the clip = 1022', [node, cube], () => { A.frame = 80; }, 'Invalid IN frame. Current frame must be within the clip boundaries.');
    A.frame = 1;
    failure('FindPeriods: clip scale not 1 = 1023', [node, cube], () => { rec.timectrl = { scale: 2 }; }, 'Clip must have a scale of 1.');
    delete rec.timectrl;
    reset(); S.dialog = hook(() => false); app.select([node, cube]); const c = run('FindPeriods');
    eq('FindPeriods: dialog cancelled = property deleted, cancel', [c.cancelled, root.properties.some(p => p.name === 'FindCycles'), calls()], [true, false, []]);
    // algorithm 0, add markers
    reset(); boxes.length = 0; let seen = null; let m = mark();
    S.dialog = hook((q) => { seen = [q.title, q.property.name, q.property.type, q.property.params.map(p => [p.name, p.value]), root.properties.includes(q.property)]; q.property.set('MarkerName', 'cyc'); return true; });
    const r = run('FindPeriods');
    eq('FindPeriods: preset property FindCycleWizard named FindCycles on the scene root, literal title FindCycles; Algorithm 0 without InputObjs, Estimate 2', seen,
      ['FindCycles', 'FindCycles', 'FindCycleWizard', [['Algorithm', 0], ['Estimate', 2], ['MarkerName', ''], ['AddMarkers', 1]], true]);
    eq('FindPeriods: worker called with the selected objects, the algorithm, cycle start = current frame, cycle end = startoffset + (clipout - clipin), the minimum period',
      [r, S.calls[0].name, S.calls[0].args, S.out.FindPeriods], [{}, 'FindPeriods', [['cube'], 0, 1, 60, 2], { StartFrame: 1, EndFrame: 60, 'Minimum Period Length': 2, Mode: 1, Name: 'cyc' }]);
    const report = '- Selected objects rotations: \n   Period: 10 frames ==> Cycle frame: 51';
    eq('FindPeriods algorithm 0 report: 1025 with the period and the cycle frame, logged after a line break, shown in "Find Cycle Information" followed by 1026',
      [logFrom(m)[0], boxes], [`info:\n${report}`, [['Find Cycle Information', `${report}\n\nClick OK to Add Markers...`]]]);
    eq('FindPeriods add markers: AddMarker <model>, <clip>, cycle start + i * p - startoffset, 0, <name> for i = 0..N', [S.calls.slice(1).map(c => [c.name, c.args[2], c.args[3], c.args[4]]), markers().map(k => [k.name, k.time])],
      [[0, 10, 20, 30, 40, 50].map(t => ['AddMarker', t, 0, 'cyc']), [0, 10, 20, 30, 40, 50].map(t => ['cyc', t])]);
    mix.set('markers', '');
    // algorithm 1 with explicit parameters, several periods
    reset(); boxes.length = 0; const rz = L(cube, 'rotz'); for (let f = 1; f <= 60; f++) A.setKey(rz, f, f % 6);
    S.dialog = hook((q) => { seen = q.property.val('Algorithm'); return true; }); app.select([node, cube]);
    run('FindPeriods', { InputObjs: 'cube.kine.local.roty,cube.kine.local.rotz' });
    eq('FindPeriods algorithm 1 (InputObjs supplied): several non-zero periods = 1030 and the blocks, nothing changed', [seen, S.calls[0].args.slice(1), boxes.length, boxes[0]?.[1].startsWith("Multiple periods found: operation 'Add Markers' not possible...\n\n- "), /Period: 10 frames ==> Cycle frame: 51/.test(boxes[0]?.[1]), /Period: 6 frames ==> Cycle frame: 55/.test(boxes[0]?.[1]), callNames().slice(1), markers().length],
      [1, [1, 1, 60, 2], 1, true, true, true, [], 0]);
    A.removeAnimation(rz);
    // algorithm 1, one period, trim
    reset(); boxes.length = 0; A.frame = 11; S.dialog = hook((q) => { q.property.set('AddMarkers', 0); return true; }); app.select([node, cube]);
    const cin = Number(rec.timectrl?.clipin ?? NaN);
    run('FindPeriods', { InputObjs: 'cube.kine.local.roty' });
    const sets = S.calls.slice(1).map(c => [c.name, String(c.args[0]).split('.').pop(), c.args[1]]);
    eq('FindPeriods trim: three SetValue on the time control, in order startoffset, clipout, clipin (N whole cycles from the current frame)', [sets.map(s => [s[0], s[1]]), sets[0][2], sets[1][2] - sets[2][2], rec.start, boxes[0]?.[0], /Period: 10 frames ==> Cycle frame: 51/.test(boxes[0]?.[1])],
      [[['SetValue', 'startoffset'], ['SetValue', 'clipout'], ['SetValue', 'clipin']], 11, 39, 11, 'Find Cycle Information', true]);
    void cin;
    app.undo(); eq('FindPeriods trim: undoable', [rec.start, rec.duration], [1, 60]);
    // algorithm 1, no period
    reset(); boxes.length = 0; A.frame = 1; S.dialog = hook((q) => { q.property.set('Estimate', 25); return true; }); app.select([node, cube]); m = mark();
    run('FindPeriods', { InputObjs: 'cube.kine.local.roty' });
    eq('FindPeriods algorithm 1, no period: box shows 1032 with the minimum period, nothing changed', [boxes, callNames().slice(1)], [[['Find Cycle Information', 'No period found to be greater than 25 frames.']], []]);
    mix.clips.splice(mix.clips.indexOf(rec), 1); A.removeAnimation(ry); app.select([]);
  }

  // ================= every command with default arguments, nothing selected, no user session
  const defaults = {};
  for (const n of NAMES) {
    reset(); app.select([]); const m = mark();
    const r = run(n); await tick(5);
    defaults[n] = { err: r.err ?? null, cancelled: !!r.cancelled, promise: typeof r.v?.then === 'function', log: logFrom(m).length };
  }
  const leftover = [!!document.querySelector('.sdkh-modal-window'), root.properties.map(p => p.name).filter(n => /Duplicate From Animation|FindCycles|PPG Logic|StoreEnvironmentCacheToMixer/.test(n))];
  return { results, defaults, status: S.status, leftover };
}, {
  NAMES, registry, uiDuplicate,
  copyEntries: allEntries('CopyAllAnimation2'), removeEntries: allEntries('RemoveAllAnimation'),
});
await browser.close();

let checks = 0; const diffs = [];
const note = (label, pass, g, e) => { checks++; if (!pass) diffs.push(`${label}\n      got      ${g}\n      expected ${e}`); };
for (const r of got.results) note(r.label, r.pass, r.got, r.exp);

// defaults: no throw, except the contract's stated cancels / errors
const EXPECT_ERR = {
  GetPass: (d) => d.cancelled,                                         // nothing chosen in the preset browser: cancel
  FindPeriods: (d) => d.cancelled,                                     // 1021, cancel
  CreateFX: (d) => !!d.err && !d.cancelled,                            // the file cannot be opened
  ExportAllPassesToMI2: (d) => /ExportAllPassesToMI2Proc not found/.test(d.err ?? ''),   // stale registration
};
for (const n of NAMES) {
  const d = got.defaults[n];
  if (EXPECT_ERR[n]) note(`${n} with default arguments: the contract's stated error / cancel`, EXPECT_ERR[n](d), JSON.stringify(d), 'stated error');
  else note(`${n} with default arguments runs without throwing`, d.err === null && !d.promise, JSON.stringify(d), 'no error');
}
note('no modal or temporary property left behind', JSON.stringify(got.leftover) === JSON.stringify([false, []]), JSON.stringify(got.leftover), '[false,[]]');
note('page errors', pageErrors.length === 0, JSON.stringify(pageErrors), '[]');

if (diffs.length) {
  console.error(`FAIL CMD-B6e duplicate / rendering / simulation script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B6e duplicate / rendering / simulation script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
const by = (k) => NAMES.filter(n => got.status[n] === k).join(', ');
console.log('   fully wired: ' + by('full'));
console.log('   partly wired (an open question or a callee that is not on the bus): ' + by('partial'));
console.log('   stand-in / not yet attested: ' + by('stand-in'));
