// CMD-10a: the 20 animation mixer clip / action script commands on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-10a-mixer-action-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden was run for this row, so this is a contract check: registration,
// a run with default arguments, and the contract's stated results (return values, time control values, weight
// keys, effect items, selection, log lines) on a small mixer built in the demo scene.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_mixer_action_commands.mjs
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

const NAMES = ['SelectActionsFromObjects', 'SelectObjectsFromAction', 'FreezeClips', 'FreezeAndReplaceClips', 'CrossfadeClipWeights', 'CutClip',
  'TrimBefore', 'TrimAfter', 'CreateScaleEffect', 'ResetAllEffectCurves', 'ResetSelectedEffectCurves', 'ResetEffectAtFrame', 'ClipMatch',
  'ImportActionAndAddClip', 'ImportActionAndApply', 'ImportAudioAndAddClip', 'OffloadAction', 'PartialOffloadAction', 'ReloadAction', 'DeleteUnusedCamSeqTracks'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const argsOf = c => c.args.map(a => [a.name, a.default ?? null]);
// scripted overload = the entry that is not key-assignable; UI overload = the key-assignable one
const registry = Object.fromEntries(NAMES.map(n => { const all = list.filter(x => x.scripting_name === n); const c = all.find(x => !x.key_assignable) ?? all[0]; return [n, c ? argsOf(c) : null]; }));
const registryUi = Object.fromEntries(NAMES.map(n => { const all = list.filter(x => x.scripting_name === n); const c = all.length > 1 ? all.find(x => x.key_assignable) : null; return [n, c ? argsOf(c) : null]; }).filter(([, v]) => v));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('DeleteUnusedCamSeqTracks') && !!window.Application?.mixerActionScripts, null, { timeout: 60000 });
await page.waitForTimeout(500);

const results = await page.evaluate(async ({ NAMES, registry, registryUi }) => {
  const app = window.Application; const S = app.mixerActionScripts; const root = app.scene.root;
  const checks = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const check = (label, ok, detail) => checks.push({ label, ok: !!ok, detail: ok ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)) });
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v }; } catch (e) { return { err: String(e?.message ?? e), cancelled: !!e?.cancelled, code: e?.siErrCancelled }; } };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const hasLog = (i, t) => logFrom(i).some(l => l === `info:${t}`);
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
  const mix = root.properties.find(p => p.type === 'mixer');
  const sphere = app.scene.find('sphere'); const cube = app.scene.find('cube');
  const PropertyClass = sphere.properties[0].constructor;
  const PX = 'Scene.Scene_Root.sphere.Kinematics.Local.posx', PY = 'Scene.Scene_Root.sphere.Kinematics.Local.posy';

  // ---- scene helpers
  const source = (name, storage) => {
    app.select([sphere]);
    const src = app.run('StoreAction', { Name: name, Mode: 4 });
    // posx = source frame - 1 (linear), posy = 5
    src.set('data', JSON.stringify({ [PX]: 0, [PY]: 5 }));
    src.set('fcurves', JSON.stringify({ [PX]: [{ time: 1, value: 0, interp: 1 }, { time: 101, value: 100, interp: 1 }] }));
    if (storage !== undefined) src.storage = storage;
    app.select([]);
    return src;
  };
  const reset = () => {
    mix.clips.length = 0; mix.compounds.length = 0; mix.trackSolo = {}; delete root.cameraSequencer;
    for (const p of [...root.properties]) if (p.type === 'actionsource' || p.type === 'audiosource' || p.name === 'FreezeClips' || p.name === 'MatchClips') root.removeProperty(p);
    for (const n of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz']) sphere.kinematics.local.set(n, 0);
    app.select([]); app.anim.frame = 1; S.pickClip = null;
  };
  const clip = (name, src, start, duration, extra = {}) => { const c = { name, source: src.name, start, duration, track: 0, weight: 1, mute: false, additive: false, ...extra }; mix.clips.push(c); return c; };
  const node = (c) => S.node(c);
  const tcOf = (c) => ({ start: c.start, duration: c.duration, ...(c.timectrl ?? {}) });
  const wk = (c) => (c.weightKeys ?? []).map(k => [k.time, k.value]);
  const srcs = () => root.properties.filter(p => p.type === 'actionsource').map(p => p.name);

  app.Interactive = false;

  // ================= registration
  for (const n of NAMES) {
    const d = app.commands.get(n);
    check(`registered: ${n}`, !!d);
    check(`arguments: ${n}`, d && eq(d.args.map(a => [a.name, a.default ?? null]), registry[n]), { got: d?.args, want: registry[n] });
  }
  for (const n of Object.keys(registryUi)) {
    check(`UI overload reachable: ${n}`, typeof S.ui[n] === 'function');
    check(`UI overload arguments: ${n}`, eq((S.uiArgs[n] ?? []).map(a => [a.name, a.default ?? null]), registryUi[n]), { got: S.uiArgs[n], want: registryUi[n] });
  }

  // ================= default arguments on an empty mixer, nothing selected
  reset();
  const expectDefault = {
    SelectActionsFromObjects: r => Array.isArray(r.v) && r.v.length === 0,
    SelectObjectsFromAction: r => Array.isArray(r.v) && r.v.length === 0,
    FreezeClips: r => r.cancelled && r.err === 'No clips selected' && r.code === 0x4C7,
    FreezeAndReplaceClips: r => r.cancelled && r.err === 'No clips selected',
    CrossfadeClipWeights: r => r.cancelled && / is not a valid clip\.$/.test(r.err),
    CutClip: r => r.cancelled && r.err === 'No clips selected',
    TrimBefore: r => r.v === undefined && !r.err, TrimAfter: r => r.v === undefined && !r.err,
    CreateScaleEffect: (r, m) => r.v === undefined && !r.err && hasLog(m, 'Please select a clip first'),
    ResetAllEffectCurves: (r, m) => r.v === undefined && !r.err && hasLog(m, 'Please select a clip first'),
    ResetSelectedEffectCurves: (r, m) => r.v === undefined && !r.err && hasLog(m, 'Please select a clip first'),
    ResetEffectAtFrame: (r, m) => r.v === undefined && !r.err && hasLog(m, 'Please select a clip first'),
    ClipMatch: (r, m) => r.v === undefined && !r.err && hasLog(m, 'Pick Reference Clip'),
    // CMD-B20a: ImportAction tests the file extension (.Preset / .xsi / .eani), so no FileName fails with 0x80070057
    ImportActionAndAddClip: r => /0x80070057/.test(r.err ?? '') && mix.clips.length === 0,
    ImportActionAndApply: r => /0x80070057/.test(r.err ?? ''),
    ImportAudioAndAddClip: r => r.cancelled,
    OffloadAction: r => r.v === undefined && !r.err, PartialOffloadAction: r => r.v === undefined && !r.err, ReloadAction: r => r.v === undefined && !r.err,
    DeleteUnusedCamSeqTracks: r => r.v === undefined && !r.err,
  };
  for (const n of NAMES) {
    app.select([]); const m = mark(); const r = run(n);
    check(`defaults: ${n}`, expectDefault[n](r, m), { r: { err: r.err, v: r.v === undefined ? '<none>' : String(r.v) }, log: logFrom(m) });
  }

  // ================= SelectActionsFromObjects / SelectObjectsFromAction
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20);
    app.select([sphere]);
    const r = run('SelectActionsFromObjects');
    check('SelectActionsFromObjects: returns the driving actions', Array.isArray(r.v) && r.v.length === 1 && r.v[0] === walk, r.err);
    check('SelectActionsFromObjects: result becomes the selection', app.selection.length === 1 && app.selection[0] === walk);

    app.select([cube]);
    let o = run('SelectObjectsFromAction', { InputObj: [a] });
    check('SelectObjectsFromAction: clip gives one entry per mapping rule, duplicates kept', eq(o.v, ['sphere', 'sphere']), o);
    check('SelectObjectsFromAction: result selected (node mode)', app.selection.length === 1 && app.selection[0] === sphere && S.lastSelectMode === 'node');
    app.select([cube]);
    o = run('SelectObjectsFromAction', { InputObj: [a], OnlyPoseOffset: true });
    check('SelectObjectsFromAction: OnlyPoseOffset without pose rules is empty and leaves the selection', eq(o.v, []) && app.selection[0] === cube, o);
    a.rules = [{ target: 'sphere.kine.local.posx', active: true, poseOffset: true, raw: PX }, { target: '<unmapped>', active: true, poseOffset: true }, { target: 'cube.kine.local.posy', active: true, poseOffset: false }];
    o = run('SelectObjectsFromAction', { InputObj: 'A', OnlyPoseOffset: true });
    check('SelectObjectsFromAction: pose-offset rules only, <unmapped> skipped, branch mode', eq(o.v, ['sphere']) && app.selection[0] === sphere && S.lastSelectMode === 'branch', o);
    o = run('SelectObjectsFromAction', { InputObj: [a] });
    check('SelectObjectsFromAction: all mapped rules', eq(o.v, ['sphere', 'cube']) && app.selection.length === 2, o);
    app.select([sphere, cube]);
    o = run('SelectObjectsFromAction', { InputObj: [walk] });
    check('SelectObjectsFromAction: action source gives <model>.<object> per item', eq(o.v, ['Scene_Root.sphere', 'Scene_Root.sphere']), o);
    check('SelectObjectsFromAction: action source result selected', app.selection.length === 1 && app.selection[0] === sphere, app.selection.map(n => n.name));
    app.select([cube]);
    o = run('SelectObjectsFromAction', { InputObj: [cube] });
    check('SelectObjectsFromAction: other elements ignored', eq(o.v, []) && app.selection[0] === cube, o);
  }

  // ================= FreezeClips
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20); const b = clip('B', walk, 10, 20, { mute: false });
    const bad = (label, args, msg) => { const r = run('FreezeClips', { InputObj: [a], ...args }); check(`FreezeClips: ${label}`, r.cancelled && r.err === msg, r); };
    bad('step must be positive', { StepFrame: 0 }, 'Time step must be strictly positive');
    bad('fcurve kind validated', { 'FCurve Kind': 7 }, 'The FCurve Kind value must be one of 10 (boolean), 15 (integer), 20 (standard) or 30 (Raw)');
    bad('interpolation validated for kind 20', { 'FCurve Kind': 20, DefaultSegKind: 5 }, 'The interpolation value must be one of 1 (constant), 2 (linear) or 3 (spline)');
    bad('fit tolerance validated', { 'Fit FCurve': true, 'Fit Tolerance': 0 }, 'The fit tolerance must be strictly greater than 0');
    let r = run('FreezeClips', { InputObj: [cube] });
    check('FreezeClips: no usable clip -> message 1527', r.cancelled && r.err === 'No clips selected', r);
    check('FreezeClips: validation creates nothing', eq(srcs(), ['Walk']), srcs());

    r = run('FreezeClips', { InputObj: [a] });
    const act = r.v;
    check('FreezeClips: returns the new action source named FrozenAction', act && act.type === 'actionsource' && act.name === 'FrozenAction' && root.properties.includes(act), r.err);
    const P = S.lastPlot ?? {};
    check('FreezeClips: plot range covers the clip (start .. end - 1)', P.StartFrame === 10 && P.EndFrame === 29, P);
    check('FreezeClips: plot parameter list is model-prefixed and unique', P.InputObj === 'Scene_Root.sphere.kine.local.posx,Scene_Root.sphere.kine.local.posy', P.InputObj);
    check('FreezeClips: plot arguments passed through', P.Name === 'FrozenAction' && P.StepFrame === 1 && P['FCurve Kind'] === 30 && P.DefaultSegKind === 3 && P['Fit FCurve'] === false && P['Fit Tolerance'] === 0.01 && P.ProcessContRots === true, P);
    check('FreezeClips: plot model argument is the first object under the model', P.Model === [...root.children][0].name, P.Model);
    const fc = act ? JSON.parse(act.val('fcurves')) : {};
    check('FreezeClips: plotted curve values', fc[PX]?.length === 20 && fc[PX][0].time === 10 && near(fc[PX][0].value, 0) && fc[PX][19].time === 29 && near(fc[PX][19].value, 19) && near(fc[PY]?.[5]?.value, 5), fc[PX]);
    check('FreezeClips: clips are kept, solo / active states restored', mix.clips.length === 2 && a.mute === false && b.mute === false && eq(mix.trackSolo, {}), { clips: mix.clips.length, solo: mix.trackSolo });

    const coll = [a, b]; b.mute = true;
    r = run('FreezeClips', { InputObj: coll, Name: 'Second', StepFrame: 2 });
    check('FreezeClips: inactive clips leave the caller collection', coll.length === 1 && coll[0] === a && b.mute === true, coll.map(c => c.name));
    check('FreezeClips: step respected', r.v && JSON.parse(r.v.val('fcurves'))[PX].length === 10 && r.v.name === 'Second', r.err);
    b.mute = false;

    a.timectrl = { extrapaft_type: 2, extrapaft_nbcycles: 1, extrapbef_type: 1, extrapbef_timehold: 4 };
    r = run('FreezeClips', { InputObj: [a], Name: 'Cyc' });
    check('FreezeClips: range grows by the extrapolation on both sides', S.lastPlot.StartFrame === 6 && S.lastPlot.EndFrame === 49, S.lastPlot);
    const cyc = r.v ? JSON.parse(r.v.val('fcurves'))[PX] : [];
    check('FreezeClips: cycle extrapolation is plotted', near(cyc.find(k => k.time === 35)?.value ?? -1, 5), cyc.find(k => k.time === 35));
    delete a.timectrl;

    a.rules = [{ target: '<unmapped>', active: true, poseOffset: false }, { target: 'sphere.kine.local.posx', active: false, poseOffset: false, raw: PX }];
    r = run('FreezeClips', { InputObj: [a] });
    check('FreezeClips: inactive channels ignored -> No parameters to freeze', r.cancelled && r.err === 'No parameters to freeze', r);
    r = run('FreezeClips', { InputObj: [a], IgnoreInactiveChannels: false, Name: 'WithInactive' });
    check('FreezeClips: IgnoreInactiveChannels False keeps inactive rules', !r.err && S.lastPlot.InputObj === 'Scene_Root.sphere.kine.local.posx', r.err ?? S.lastPlot.InputObj);
    delete a.rules;

    mix.compounds.push({ name: 'Cpd', clips: ['B'], start: 10, duration: 20 });
    r = run('FreezeClips', { InputObj: [a, b] });
    check('FreezeClips: clips inside and outside compounds refused', r.cancelled && r.err === "Can't simultaneously Freeze Clips inside and outside compounds", r);
    r = run('FreezeClips', { InputObj: [b], Name: 'InCpd' });
    check('FreezeClips: clip inside a compound freezes', !r.err && S.lastPlot.StartFrame === 10 && S.lastPlot.EndFrame === 29, r.err ?? S.lastPlot);
    app.select([node(a)]);
    r = run('FreezeClips', { Name: 'FromSel' });
    check('FreezeClips: default input is the selection', !r.err && r.v?.name === 'FromSel', r.err);
  }

  // ================= FreezeAndReplaceClips
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20); const b = clip('B', walk, 40, 10); const keep = clip('Keep', walk, 0, 5, { track: 1, mute: true });
    mix.cnxTemplates = [{ name: 'T1', active: true }, { name: 'T2', active: false }];
    const undo0 = app.undoStack[app.undoStack.length - 1];
    const r = run('FreezeAndReplaceClips', { InputObj: [a, b, keep] });
    check('FreezeAndReplaceClips: returns the new action', r.v && r.v.type === 'actionsource' && r.v.name === 'FrozenAction', r.err);
    const names = mix.clips.map(c => c.name);
    const made = mix.clips.find(c => c.source === 'FrozenAction');
    check('FreezeAndReplaceClips: input clips deleted, inactive clip kept', !names.includes('A') && !names.includes('B') && names.includes('Keep'), names);
    check('FreezeAndReplaceClips: new clip of the frozen action at the earliest start on a new track', made && made.start === 10 && made.track === 2 && made.duration === 40, made);
    check('FreezeAndReplaceClips: new clip added to the selection', app.selection.some(n => n.clip === made));
    check('FreezeAndReplaceClips: templates switched back on', eq(mix.cnxTemplates, [{ name: 'T1', active: true }, { name: 'T2', active: false }]), mix.cnxTemplates);
    check('FreezeAndReplaceClips: one undo step', app.undoStack[app.undoStack.length - 1] !== undo0 && app.undoStack[app.undoStack.length - 2] === undo0 && app.undoStack[app.undoStack.length - 1].label === 'FreezeAndReplaceClips');
    app.undo();
    check('FreezeAndReplaceClips: undo restores the clips', eq(mix.clips.map(c => c.name), ['A', 'B', 'Keep']) && !srcs().includes('FrozenAction'), mix.clips.map(c => c.name));
  }

  // ================= UI overloads of FreezeClips / FreezeAndReplaceClips
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20);
    const args = { InputObj: [a] };
    let v; let err = null; try { v = S.ui.FreezeClips(args); } catch (e) { err = String(e.message); }
    const prop = root.properties.find(p => p.name === 'FreezeClips');
    check('FreezeClips UI: wizard property on the scene root with the contract defaults', prop && prop.type === 'FreezeActionWizard' && prop.val('IgnoreInactive') === true && prop.val('ActionName') === 'Frozen' && prop.val('Step') === 1
      && prop.val('FCurveKind') === 3 && prop.val('Interpolation') === 2 && prop.val('FitFCurve') === false && prop.val('FitTolerance') === 0.01 && prop.val('ProcessContRots') === true, err);
    check('FreezeClips UI: index mapping written back to the in/out arguments', args['FCurve Kind'] === 30 && args.DefaultSegKind === 3 && args.Name === 'Frozen' && args.StepFrame === 1 && args.IgnoreInactiveChannels === true, args);
    check('FreezeClips UI: runs the scripted command, returns nothing', v === undefined && srcs().includes('Frozen'), { v: String(v), srcs: srcs() });
    prop.set('FCurveKind', 2); prop.set('Interpolation', 0); prop.set('ActionName', 'Again');
    const args2 = { InputObj: [a] }; S.ui.FreezeAndReplaceClips(args2);
    check('FreezeAndReplaceClips UI: same property, last values reused', root.properties.filter(p => p.name === 'FreezeClips').length === 1 && args2['FCurve Kind'] === 20 && args2.DefaultSegKind === 1 && srcs().includes('Again'), args2);
    check('FreezeAndReplaceClips UI: clip replaced', !mix.clips.some(c => c.name === 'A') && mix.clips.some(c => c.source === 'Again'), mix.clips.map(c => c.name));

    // interactive: the wizard is a modal page
    app.Interactive = true;
    const b = clip('B2', walk, 10, 20);
    let p = S.ui.FreezeClips({ InputObj: [b], Title: 'My Title' });
    await tick();
    const win = document.querySelector('.mixer-wizard-window');
    check('FreezeClips UI (interactive): modal page with the given title and the eight attested labels', !!win && win.textContent.includes('My Title') && ['Ignore inactive channels', 'Action Name', 'Step value', 'Kind of fcurve', 'Interpolation', 'Fit plotted values with an fcurve', 'Fit Tolerance', 'Process rotations to ensure continuity'].every(l => win.textContent.includes(l)), win?.textContent);
    document.querySelector('.mixer-wizard-window .sdkh-modal-cancel')?.click();
    let cancelled = false; try { await p; } catch (e) { cancelled = !!e.cancelled; }
    check('FreezeClips UI (interactive): Cancel raises the cancel error', cancelled);
    const n0 = srcs().length;
    p = S.ui.FreezeClips({ InputObj: [b] });
    await tick();
    check('FreezeClips UI (interactive): default title', !!document.querySelector('.mixer-wizard-window')?.textContent.includes('Freeze Clips'));
    document.querySelector('.mixer-wizard-window .sdkh-modal-ok')?.click();
    let ok = true; try { await p; } catch (e) { ok = false; }
    check('FreezeClips UI (interactive): OK freezes', ok && srcs().length === n0 + 1, srcs());
    app.Interactive = false;
  }

  // ================= CrossfadeClipWeights
  {
    reset(); const walk = source('Walk');
    let a = clip('A', walk, 10, 20), b = clip('B', walk, 20, 20, { track: 1 });
    let r = run('CrossfadeClipWeights', { FirstClip: b, SecondClip: a });
    check('CrossfadeClipWeights: partial overlap, two keys each at B.in and A.out - 1', !r.err && r.v === undefined && eq(wk(b), [[20, 0], [29, 1]]) && eq(wk(a), [[20, 1], [29, 0]]), { a: wk(a), b: wk(b), err: r.err });
    reset(); const w2 = source('Walk'); a = clip('A', w2, 10, 40); b = clip('B', w2, 20, 10, { track: 1 });
    r = run('CrossfadeClipWeights', { FirstClip: 'A', SecondClip: 'B' });
    check('CrossfadeClipWeights: B inside A, Gaussian on B and reverse Gaussian on A', !r.err && eq(wk(b), [[20, 0], [25, 1], [29, 0]]) && eq(wk(a), [[20, 1], [25, 0], [29, 1]]), { a: wk(a), b: wk(b), err: r.err });
    check('CrossfadeClipWeights: preset keys are spline', (b.weightKeys ?? []).every(k => k.interp === 3));
    reset(); const w3 = source('Walk'); a = clip('A', w3, 10, 10); b = clip('B', w3, 30, 10); const c = clip('C', w3, 10, 30, { track: 1 });
    r = run('CrossfadeClipWeights', { FirstClip: a, SecondClip: b });
    check('CrossfadeClipWeights: no overlap does nothing', !r.err && !a.weightKeys && !b.weightKeys, r);
    r = run('CrossfadeClipWeights', { FirstClip: a, SecondClip: c });
    check('CrossfadeClipWeights: equal starts do nothing', !r.err && !a.weightKeys && !c.weightKeys, r);
    const au = clip('Snd', w3, 10, 30, { track: 2, type: 'mixeraudioclip' });
    const m = mark(); r = run('CrossfadeClipWeights', { FirstClip: a, SecondClip: au });
    check('CrossfadeClipWeights: audio clip is not a valid clip', r.cancelled && r.err === 'Mixer.Mixer_Audio_Track2.Snd is not a valid clip.' && hasLog(m, r.err), r);
  }

  // ================= CutClip
  {
    reset(); let walk = source('Walk'); let a = clip('A', walk, 10, 20);
    const bad = (label, c, args, msg) => { const r = run('CutClip', { Clip: c, ...args }); check(`CutClip: ${label}`, r.cancelled && r.err === msg, r); };
    bad('invalid mode', a, { Mode: 9, Time: 20 }, 'Invalid cut mode');
    bad('layer clips refused', clip('L', walk, 10, 20, { track: 3, type: 'mixerlayerclip' }), { Time: 20 }, 'Cannot cut layer clips');
    bad('hold extrapolation refused', clip('H', walk, 10, 20, { track: 4, timectrl: { extrapbef_type: 1, extrapbef_timehold: 5 } }), { Time: 20 }, 'Only extrapolation cycles are supported');
    bad('bounce extrapolation refused', clip('Bo', walk, 10, 20, { track: 5, timectrl: { extrapaft_type: 3, extrapaft_nbbounces: 2 } }), { Time: 20 }, 'Only extrapolation cycles are supported');
    bad('fractional cycles refused', clip('F', walk, 10, 20, { track: 6, timectrl: { extrapaft_type: 2, extrapaft_nbcycles: 1.5 } }), { Time: 20 }, 'Fractional cycles not supported');
    let m = mark(); let r = run('CutClip', { Clip: a, Time: 30 });
    check('CutClip: frame not strictly inside logs and ends without cancel, returns the input clip', !r.err && r.v === a && hasLog(m, 'Invalid split point. (The current frame is not inside the Clip)') && mix.clips.filter(c => c.name.startsWith('A')).length === 1, r);
    r = run('CutClip', { Clip: a, Time: 10.5 });
    check('CutClip: needs at least one frame from each end', r.v === a && a.duration === 20, tcOf(a));

    const before = (() => { app.anim.frame = 25; const e = app.run('EvaluateMixer', { Frame: 25, Apply: false }); return e?.values?.[PX]; })();
    const undo0 = app.undoStack[app.undoStack.length - 1]; app.anim.frame = 7;
    r = run('CutClip', { Clip: a, Mode: ':siCut:siCutClipOptions', Time: 20 });
    const copy = r.v;
    check('CutClip: cut returns a new clip on the same track', copy && copy !== a && mix.clips.includes(copy) && copy.track === a.track && copy.source === a.source, r.err);
    check('CutClip: original keeps the head (out = (t - start) * scale + in - 1)', eq(tcOf(a), { start: 10, duration: 10, clipin: 1, clipout: 10, scale: 1, cliptoparentstart: false, cliptoparentend: false, extrapaft_type: 0 }), tcOf(a));
    check('CutClip: copy keeps the tail (start = t, in = new out + 1, out unchanged)', copy && copy.start === 20 && copy.duration === 10 && copy.timectrl.clipin === 11 && copy.timectrl.clipout === 20, copy && tcOf(copy));
    check('CutClip: current frame untouched', app.anim.frame === 7);
    const after = app.run('EvaluateMixer', { Frame: 25, Apply: false })?.values?.[PX];
    check('CutClip: the tail still plays the same source frames', near(before, 15) && near(after, 15), { before, after });
    check('CutClip: one undo step', app.undoStack[app.undoStack.length - 2] === undo0 && app.undoStack[app.undoStack.length - 1].label === 'CutClip');
    app.undo();
    check('CutClip: undo removes the copy and restores the clip', !mix.clips.includes(copy) && a.duration === 20 && a.start === 10, tcOf(a));

    // default time = current frame, default mode = cut, default clip = selection
    app.anim.frame = 15; app.select([node(a)]);
    r = run('CutClip');
    check('CutClip: defaults (selection, siCut, current frame)', r.v && r.v !== a && a.duration === 5 && r.v.start === 15, r.err ?? tcOf(a));

    // cycles after: cut in the body
    reset(); walk = source('Walk'); a = clip('A', walk, 10, 20, { timectrl: { extrapaft_type: 2, extrapaft_nbcycles: 2 }, weightKeys: [{ time: 10, value: 0, interp: 1 }, { time: 70, value: 1, interp: 1 }] });
    r = run('CutClip', { Clip: a, Time: 20 });
    let cp = r.v;
    check('CutClip (cycles after, body): head loses its after-extrapolation', !r.err && a.start === 10 && a.duration === 10 && a.timectrl.extrapaft_type === 0, tcOf(a));
    check('CutClip (cycles after, body): tail sits on the last cycle with (end - t)/length + cycles - 1 cycles before', cp && cp.start === 50 && cp.duration === 20 && cp.timectrl.extrapbef_type === 2 && cp.timectrl.extrapbef_nbcycles === 1.5 && cp.timectrl.extrapaft_type === 0, cp && tcOf(cp));
    check('CutClip (cycles): weight keys restored on the head within extended start - 1 .. t', wk(a).length > 0 && wk(a).every(k => k[0] >= 9 && k[0] <= 20) && wk(a).some(k => k[0] === 20) && wk(a).some(k => k[0] === 19), wk(a));
    check('CutClip (cycles): weight keys restored on the tail within t - 1 .. extended end + 1', cp && wk(cp).every(k => k[0] >= 19 && k[0] <= 71) && wk(cp).some(k => k[0] === 21) && wk(cp).some(k => k[0] === 70), cp && wk(cp));
    check('CutClip (cycles): restored weight values follow the old curve', near(wk(a).find(k => k[0] === 20)?.[1] ?? -1, 10 / 60), wk(a));

    // cycles after: cut inside a cycle
    reset(); walk = source('Walk'); a = clip('A', walk, 10, 20, { timectrl: { extrapaft_type: 2, extrapaft_nbcycles: 2 } });
    r = run('CutClip', { Clip: a, Time: 45 }); cp = r.v;
    check('CutClip (cycles after, cycle frame): head starts at the extended start with the cycles converted', !r.err && a.start === 10 && a.duration === 20 && a.timectrl.extrapbef_type === 0 && a.timectrl.extrapaft_type === 2 && near(a.timectrl.extrapaft_nbcycles, 0.75), tcOf(a));
    check('CutClip (cycles after, cycle frame): tail covers t .. extended end', cp && cp.start === 50 && cp.duration === 20 && near(cp.timectrl.extrapbef_nbcycles, 0.25) && cp.timectrl.extrapaft_type === 0, cp && tcOf(cp));

    // cycles with a count of 0 are reset to type 0
    reset(); walk = source('Walk'); a = clip('A', walk, 10, 20, { timectrl: { extrapbef_type: 2, extrapbef_nbcycles: 0 } });
    r = run('CutClip', { Clip: a, Mode: 3, Time: 20 });
    check('CutClip: trim after keeps the head, empty cycle extrapolation reset, returns the input clip', r.v === a && a.start === 10 && a.duration === 10 && a.timectrl.extrapbef_type === 0 && mix.clips.length === 1, tcOf(a));
    r = run('CutClip', { Clip: a, Mode: 'siTrimBefore', Time: 14 });
    check('CutClip: trim before keeps the tail', r.v === a && a.start === 14 && a.duration === 6 && a.timectrl.clipin === 5 && a.timectrl.clipout === 10, tcOf(a));

    // scale
    reset(); walk = source('Walk'); a = clip('A', walk, 10, 20, { timectrl: { clipin: 1, clipout: 40, scale: 2 } });
    r = run('CutClip', { Clip: a, Time: 15 });
    check('CutClip: scaled clip, new out = (t - start) * scale + in - 1', a.timectrl.clipout === 10 && a.duration === 5 && r.v?.timectrl.clipin === 11 && r.v?.duration === 15 && r.v?.timectrl.scale === 2, { a: tcOf(a), copy: r.v && tcOf(r.v) });

    // audio and camera shot clips
    reset(); walk = source('Walk'); const au = clip('Snd', walk, 10, 20, { type: 'mixeraudioclip' });
    r = run('CutClip', { Clip: au, Time: 20 });
    check('CutClip: works on audio clips', !r.err && r.v && r.v !== au && au.duration === 10 && r.v.start === 20 && r.v.type === 'mixeraudioclip', r.err);
    root.cameraSequencer = { tracks: [{ name: 'Shot_Track', clips: [{ name: 'Shot', source: 'Camera', start: 10, duration: 20, track: 0, type: 'camerashotclip', timectrl: { clipin: 1, clipout: 20, scale: 1 } }] }] };
    const shot = root.cameraSequencer.tracks[0].clips[0];
    r = run('CutClip', { Clip: shot, Mode: 2, Time: 20 });
    check('CutClip: camera shot trim before sets sequencein = t and scenein = new out + 1', !r.err && shot.start === 20 && shot.timectrl.clipin === 11 && shot.duration === 10, r.err ?? tcOf(shot));
    r = run('CutClip', { Clip: shot, Mode: 3, Time: 25 });
    check('CutClip: camera shot trim after sets sceneout = new out + 1', !r.err && shot.timectrl.clipout === 16, r.err ?? tcOf(shot));
    r = run('CutClip', { Clip: shot, Mode: 1, Time: 22 });
    check('CutClip: camera shot cut stays on the camera track', !r.err && root.cameraSequencer.tracks[0].clips.length === 2 && root.cameraSequencer.tracks[0].clips.includes(r.v), r.err);

    // compound member: cut frame converted to compound local time
    reset(); walk = source('Walk'); a = clip('A', walk, 10, 20);
    mix.compounds.push({ name: 'Cpd', clips: ['A'], start: 100, duration: 20, timectrl: { clipin: 10, clipout: 29, scale: 1 } });
    r = run('CutClip', { Clip: a, Time: 105 });
    check('CutClip: inside a compound the frame is taken in compound local time, copy joins the compound', !r.err && a.duration === 5 && r.v?.start === 15 && mix.compounds[0].clips.includes(r.v?.name), r.err ?? tcOf(a));
  }

  // ================= TrimBefore / TrimAfter
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20); const b = clip('B', walk, 10, 20, { track: 1, type: 'mixershapeclip' }); const au = clip('Snd', walk, 10, 20, { track: 2, type: 'mixeraudioclip' });
    app.select([node(a), node(b), node(au), sphere]); app.anim.frame = 20;
    let r = run('TrimBefore');
    check('TrimBefore: keeps the part after the frame on animation and shape clips, skips audio / others', !r.err && r.v === undefined && a.start === 20 && a.duration === 10 && b.start === 20 && b.duration === 10 && au.start === 10 && au.duration === 20 && mix.clips.length === 3, [tcOf(a), tcOf(b), tcOf(au)]);
    r = run('TrimAfter', { Clip: [a, b], Time: 25 });
    check('TrimAfter: keeps the part before the frame', !r.err && r.v === undefined && a.start === 20 && a.duration === 5 && b.duration === 5, [tcOf(a), tcOf(b)]);
    const m = mark(); r = run('TrimAfter', { Clip: [a], Time: 99 });
    check('TrimAfter: frame outside the clip logs the split-point message', !r.err && a.duration === 5 && hasLog(m, 'Invalid split point. (The current frame is not inside the Clip)'), logFrom(m));
    a.timectrl.extrapbef_type = 1; a.timectrl.extrapbef_timehold = 3;
    r = run('TrimBefore', { Clip: [a, b], Time: 22 });
    check('TrimBefore: an error in one clip aborts the loop', r.cancelled && r.err === 'Only extrapolation cycles are supported' && b.start === 20, r);
  }

  // ================= clip effects
  {
    reset(); const walk = source('Walk'); const a = clip('A', walk, 10, 20); const au = clip('Snd', walk, 10, 20, { track: 2, type: 'mixeraudioclip' });
    let r = run('CreateScaleEffect', { Clip: [a, au] });
    check('CreateScaleEffect: one item per rule keyed 1.0 at resin and resout, expression (this) * param', !r.err && r.v === undefined && a.effectItems?.length === 2 && a.effectItems.every(i => i.valuemap === '(this) * param' && eq(i.param, [{ time: 10, value: 1 }, { time: 30, value: 1 }])) && !au.effectItems, a.effectItems);
    run('CreateScaleEffect', { Clip: [a] });
    check('CreateScaleEffect: running twice nests the expression', a.effectItems[0].valuemap === '((this) * param) * param', a.effectItems[0].valuemap);

    a.effectItems[0].param.push({ time: 15, value: 3 }); a.effectItems[1].param.push({ time: 15, value: 4 }); a.effectItems[0].param.sort((x, y) => x.time - y.time); a.effectItems[1].param.sort((x, y) => x.time - y.time);
    r = run('ResetEffectAtFrame', { Clip: [a], Time: 15 });
    check('ResetEffectAtFrame: removes the key at Time on every item', !r.err && a.effectItems.every(i => eq(i.param.map(k => k.time), [10, 30])), a.effectItems);
    r = run('ResetEffectAtFrame', { Clip: [a], Time: 77 });
    check('ResetEffectAtFrame: a missing key is ignored', !r.err && a.effectItems.every(i => i.param.length === 2), r);
    a.effectItems[0].param.push({ time: 12, value: 9 }); app.anim.frame = 12;
    const uiArgs = { Clip: [a], Time: 50 }; S.ui.ResetEffectAtFrame(uiArgs);
    check('ResetEffectAtFrame UI: works at the key-marker frame and writes it back to Time', eq(a.effectItems[0].param.map(k => k.time), [10, 30]) && uiArgs.Time === 12 && app.anim.frame === 12, { p: a.effectItems[0].param, uiArgs });

    a.effectItems[0].param = [{ time: 10, value: 2 }, { time: 18, value: 5 }, { time: 30, value: 2 }];
    r = run('ResetAllEffectCurves', { Clip: [a] });
    check('ResetAllEffectCurves: scale effect re-keyed with 1 at resin and resout', !r.err && a.effectItems.every(i => eq(i.param, [{ time: 10, value: 1 }, { time: 30, value: 1 }])), a.effectItems);
    a.effectItems.forEach(i => { i.valuemap = 'this + param'; i.param = [{ time: 12, value: 7 }]; });
    run('ResetAllEffectCurves', { Clip: 'A' });
    check('ResetAllEffectCurves: offset effect re-keyed with 0', a.effectItems.every(i => eq(i.param, [{ time: 10, value: 0 }, { time: 30, value: 0 }])), a.effectItems);
    a.effectItems.forEach(i => { i.valuemap = 'sin(this)'; i.param = [{ time: 12, value: 7 }]; });
    run('ResetAllEffectCurves', { Clip: [a] });
    check('ResetAllEffectCurves: other expressions only lose the animation', a.effectItems.every(i => i.param.length === 0), a.effectItems);

    // ResetSelectedEffectCurves
    a.rules = [{ target: 'sphere.kine.local.posx', active: true, poseOffset: false, raw: PX }, { target: 'cube.kine.local.posy', active: true, poseOffset: false }, { target: '<unmapped>', active: true, poseOffset: false }];
    a.effectItems = [{ valuemap: '(this) * param', param: [{ time: 12, value: 7 }] }, { valuemap: '(this) * param', param: [{ time: 12, value: 7 }] }, { valuemap: '', param: [{ time: 12, value: 7 }] }];
    app.select([]);
    r = run('ResetSelectedEffectCurves', { Clip: 'A' });
    check('ResetSelectedEffectCurves: empty selection -> Nothing selected! (cancel)', r.cancelled && r.err === 'Nothing selected!', r);
    app.select([sphere]); const m = mark();
    r = run('ResetSelectedEffectCurves', { Clip: 'Mixer.Mixer_Anim_Track.A' });
    check('ResetSelectedEffectCurves: only the items of the selected object are re-keyed with the neutral value', !r.err && eq(a.effectItems[0].param, [{ time: 10, value: 1 }, { time: 30, value: 1 }]) && eq(a.effectItems[1].param, [{ time: 12, value: 7 }]) && eq(a.effectItems[2].param, [{ time: 12, value: 7 }]), a.effectItems);
    check('ResetSelectedEffectCurves: logs the target', hasLog(m, 'Resetting effect curves for sphere.kine.local.posx') && !logFrom(m).some(l => l.includes('cube.kine')), logFrom(m));
    app.undo();
    check('ResetSelectedEffectCurves: undo', eq(a.effectItems[0].param, [{ time: 12, value: 7 }]), a.effectItems[0]);
  }

  // ================= ClipMatch
  {
    reset(); const walk = source('Walk');
    const a = clip('A', walk, 10, 20); const b = clip('B', walk, 40, 20);
    b.rules = [{ target: 'sphere.kine.local.posx', active: true, poseOffset: true, raw: PX }, { target: 'sphere.kine.local.posy', active: true, poseOffset: true, raw: PY }];
    let m = mark(); let r = run('ClipMatch', { InputObj: [a, b, sphere] });
    const g = sphere.globalMatrix().elements;
    check('ClipMatch: runs, returns nothing', !r.err && r.v === undefined, r.err);
    check('ClipMatch: log lines name the frames (end = resout - 1 of the first, start = resin of the second)', hasLog(m, 'Matching from frame: 29 (Mixer.Mixer_Anim_Track.A)') && hasLog(m, 'To frame: 40 (Mixer.Mixer_Anim_Track.B)'), logFrom(m));
    check('ClipMatch: pose offset of the second clip switched on', b.poseactive === true && b.staticKineState && near(b.staticKineState.sclx, 1));
    check('ClipMatch: the object at the start of the second clip is where it was at the end of the first', near(g[12], 19) && near(g[13], 5) && near(g[14], 0), [g[12], g[13], g[14]]);
    check('ClipMatch: offset recorded as translation only here (no heading difference)', near(b.staticKineState.posx, 19) && near(b.staticKineState.posy, 0) && near(b.staticKineState.oriy, 0), b.staticKineState);
    check('ClipMatch: both clips left active, selection on the pose-offset object (branch)', a.mute === false && b.mute === false && app.selection[0] === sphere && S.lastSelectMode === 'branch');

    for (const n of ['posx', 'posy', 'posz']) sphere.kinematics.local.set(n, 0);
    m = mark(); r = run('ClipMatch', { InputObj: [b, a, sphere] });
    check('ClipMatch: clips given backwards are swapped', !r.err && hasLog(m, 'Clips picked backwards. Swapping!') && hasLog(m, 'To frame: 40 (Mixer.Mixer_Anim_Track.B)'), logFrom(m));

    // overlapping clips: end = start
    const c = clip('C', walk, 25, 20, { track: 1, rules: b.rules });
    m = mark(); run('ClipMatch', { InputObj: [a, c, sphere] });
    check('ClipMatch: overlapping clips match at the second clip start', hasLog(m, 'Matching from frame: 25 (Mixer.Mixer_Anim_Track.A)') && hasLog(m, 'To frame: 25 (Mixer.Mixer_Anim_Track1.C)'), logFrom(m));

    delete b.rules; m = mark(); r = run('ClipMatch', { InputObj: [a, b, sphere] });
    check('ClipMatch: no pose-offset objects -> failure message', !r.err && hasLog(m, 'Failed to Match Clips. No objects set for pose offset in Mixer.Mixer_Anim_Track.B'), logFrom(m));

    // picking
    m = mark(); r = run('ClipMatch', { InputObj: [a] });
    check('ClipMatch: clips are asked for when two are not supplied; escape ends the command', !r.err && hasLog(m, 'Pick Reference Clip') && !hasLog(m, 'Pick Clip to Offset'), logFrom(m));
    S.pickClip = (prompt) => (prompt === 'Pick Reference Clip' ? a : sphere);
    m = mark(); r = run('ClipMatch');
    check('ClipMatch: a pick that is not an animation clip aborts', !r.err && hasLog(m, 'Pick Clip to Offset') && hasLog(m, 'Match Clip Aborted: A clip was not picked'), logFrom(m));

    // object to match from the tags, MatchClips page
    b.rules = [{ target: 'sphere.kine.local.posx', active: true, poseOffset: true, raw: PX }];
    S.pickClip = null; m = mark(); r = run('ClipMatch', { InputObj: [a, b] });
    check('ClipMatch: without tagged objects message 1042 is reported and the MatchClips property is removed', !r.err && hasLog(m, 'Not found: please tag with Character > Biped Tags') && !root.properties.some(p => p.name === 'MatchClips'), logFrom(m));
    const tag = new PropertyClass('LeftFoot', 'customparamset', []); sphere.addProperty(tag);
    for (const n of ['posx', 'posy', 'posz']) sphere.kinematics.local.set(n, 0);
    m = mark(); r = run('ClipMatch', { InputObj: [a, b] });
    check('ClipMatch: tagged object (LeftFoot) is matched in batch mode', !r.err && hasLog(m, 'Matching from frame: 29 (Mixer.Mixer_Anim_Track.A)') && near(sphere.globalMatrix().elements[12], 19) && !root.properties.some(p => p.name === 'MatchClips'), logFrom(m));
    app.Interactive = true;
    const pr = app.run('ClipMatch', { InputObj: [a, b] });
    await tick();
    const win = document.querySelector('.mixer-wizard-window');
    const sel = win?.querySelector('[data-param="Match"] select');
    check('ClipMatch (interactive): Match Clips page, Match defaults to the last tag found', !!win && win.textContent.includes('Match Clips') && sel?.value === '1' && win.querySelector('[data-param="rightfoot"] input')?.value === 'Not found: please tag with Character > Biped Tags' && win.querySelector('[data-param="leftfoot"] input')?.value === 'sphere', win?.textContent);
    win?.querySelector('.sdkh-modal-cancel')?.click(); await pr;
    check('ClipMatch (interactive): Cancel ends the command and deletes the property', !root.properties.some(p => p.name === 'MatchClips'));
    app.Interactive = false;
    sphere.removeProperty(tag);
  }

  // ================= import and add / apply
  {
    reset(); app.select([sphere]);
    // CMD-B20a: ImportAction reads a .eani / .xsi / .Preset file; this build's file store (ExportAction) holds the content
    const files = app.actionB20a.files;
    files['C:\\act\\Imported.eani'] = JSON.stringify({ name: 'Imported', data: { [PX]: 3 }, fcurves: {} });
    files['C:\\act\\Applied.eani'] = JSON.stringify({ name: 'Applied', data: { [PX]: 4 }, fcurves: {} });
    let r = run('ImportActionAndAddClip', { Model: 'Scene_Root', FileName: 'C:\\act\\Imported.eani' });
    check('ImportActionAndAddClip: imports the action and adds a clip of it, hands nothing back', !r.err && r.v === undefined && srcs().includes('Imported') && mix.clips.length === 1 && mix.clips[0].source === 'Imported', { err: r.err, srcs: srcs(), clips: mix.clips });
    sphere.kinematics.local.set('posx', 0); app.select([sphere]);
    r = run('ImportActionAndApply', { Model: 'Scene_Root', FileName: 'C:\\act\\Applied.eani' });
    check('ImportActionAndApply: imports the action and applies it, hands nothing back', !r.err && r.v === undefined && srcs().includes('Applied') && sphere.kinematics.local.val('posx') === 4 && mix.clips.length === 1, { err: r.err, x: sphere.kinematics.local.val('posx') });
    r = run('ImportAudioAndAddClip', { Model: 'Scene_Root', FileName: 'C:\\snd\\beep.wav' });
    const asrc = root.properties.find(p => p.type === 'audiosource');
    check('ImportAudioAndAddClip: returns the new audio clip of the imported audio source', !r.err && r.v && r.v.type === 'mixeraudioclip' && mix.clips.includes(r.v) && asrc?.name === 'beep' && r.v.source === 'beep' && asrc.val('filename') === 'C:\\snd\\beep.wav', { err: r.err, v: r.v });
    app.undo();
    check('ImportAudioAndAddClip: undo', !root.properties.some(p => p.type === 'audiosource') && !mix.clips.some(c => c.type === 'mixeraudioclip'));
  }

  // ================= offload / reload
  {
    reset(); const ext1 = source('Ext1', 1); const internal = source('Internal', 0); const ext2 = source('Ext2', 2);
    let m = mark(); let r = run('OffloadAction', { InputObjs: [ext1, sphere, internal, ext2] });
    const msg = 'Action: Internal Cannot be offloaded.\nOnly Action source with external storage can be offloaded';
    check('OffloadAction: internal storage -> message 1033 and cancel', r.cancelled && r.err === msg && r.code === 0x4C7, r);
    check('OffloadAction: batch mode logs "Warning: <text>"', hasLog(m, `Warning: ${msg}`), logFrom(m));
    check('OffloadAction: actions before the failing one stay offloaded, later ones untouched', ext1.offloaded === true && !internal.offloaded && !ext2.offloaded, [ext1.offloaded, internal.offloaded, ext2.offloaded]);
    app.select([ext2]); r = run('OffloadAction');
    check('OffloadAction: default input is the selection', !r.err && r.v === undefined && ext2.offloaded === true, r);
    r = run('PartialOffloadAction', { InputObjs: 'Ext2', StartFrame: 5, EndFrame: 9, Remember: true });
    check('PartialOffloadAction: StartFrame / EndFrame / Remember passed to the source', !r.err && eq(ext2.offloaded, { start: 5, end: 9, remember: true }), ext2.offloaded);
    r = run('PartialOffloadAction', { InputObjs: [internal] });
    check('PartialOffloadAction: same storage check', r.cancelled && r.err === msg, r);
    r = run('ReloadAction', { InputObjs: [ext1, ext2, internal, cube] });
    check('ReloadAction: reloads without a storage check, skips non-actions', !r.err && r.v === undefined && ext1.offloaded === false && ext2.offloaded === false, r);
    app.Interactive = true;
    r = run('OffloadAction', { InputObjs: [internal] }); await tick();
    const box = document.querySelector('.si-msgbox-window');
    check('OffloadAction (interactive): message box titled Warning', r.cancelled && !!box && box.textContent.includes('Warning') && box.textContent.includes('Action: Internal Cannot be offloaded.'), box?.textContent);
    box?.querySelector('.si-msgbox-ok')?.click();
    app.Interactive = false;
  }

  // ================= DeleteUnusedCamSeqTracks
  {
    reset();
    root.cameraSequencer = { tracks: [{ name: 'Shot_Track', clips: [] }, { name: 'Shot_Track1', clips: [{ name: 'Shot', source: 'Camera', start: 1, duration: 10, type: 'camerashotclip' }] }, { name: 'Shot_Track2', clips: [] }] };
    const undo0 = app.undoStack[app.undoStack.length - 1];
    let r = run('DeleteUnusedCamSeqTracks');
    check('DeleteUnusedCamSeqTracks: tracks without clips are deleted', !r.err && r.v === undefined && eq(root.cameraSequencer.tracks.map(t => t.name), ['Shot_Track1']), root.cameraSequencer.tracks);
    check('DeleteUnusedCamSeqTracks: one undo step', app.undoStack[app.undoStack.length - 2] === undo0 && app.undoStack[app.undoStack.length - 1].label === 'DeleteUnusedCamSeqTracks');
    app.undo();
    check('DeleteUnusedCamSeqTracks: undo restores the tracks', root.cameraSequencer.tracks.length === 3, root.cameraSequencer.tracks);
    app.redo(); const u1 = app.undoStack[app.undoStack.length - 1];
    r = run('DeleteUnusedCamSeqTracks');
    check('DeleteUnusedCamSeqTracks: nothing happens when there is none', !r.err && root.cameraSequencer.tracks.length === 1 && app.undoStack[app.undoStack.length - 1] === u1, r);
  }

  reset();
  return checks;
}, { NAMES, registry, registryUi });

await browser.close();

let pass = 0, fail = 0;
for (const c of results) {
  if (c.ok) pass++; else { fail++; console.log(`FAIL ${c.label}${c.detail ? `\n     ${String(c.detail).slice(0, 600)}` : ''}`); }
}
if (pageErrors.length) { fail++; console.log('FAIL page errors:\n     ' + pageErrors.slice(0, 5).join('\n     ')); }
console.log(`mixer action commands (CMD-10a): ${pass}/${pass + fail} checks passed, ${NAMES.length} commands`);
process.exit(fail ? 1 : 0);
