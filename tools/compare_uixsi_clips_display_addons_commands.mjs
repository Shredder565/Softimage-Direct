// CMD-B6b: the 28 uixsiscripts commands on the command bus (image / model sources and clips, reference planes,
// preference inspectors, MoveCtr2Vertices, MatchTransform, SetTransformRefMode, manipulator size, display toggles,
// NURBS display quality, add-ons, LoadPreset, DisplayPortValues).
// Checked against the "Wire contract" of docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated results.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_uixsi_clips_display_addons_commands.mjs
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

// scripting name -> registry display name of the entry that is registered (the generic one)
const LABELS = {
  CreateImageClip2: 'Create Image Clip from File v2', AddImageSource: 'Add Image Source from File', AddWritableImageSource: 'Add Writable Image Source',
  AddModelSource: 'AddModelSource', CreateModelClip: 'CreateModelClip', AddModelClip: 'AddModelClip', LoadPreset: 'Load Preset',
  InstallAddon: 'Install Addon', UnInstallAddon: 'UnInstall Addon', CreateReferencePlane: 'Create Reference Plane',
  SetTransientReferencePlane: 'Set Transient Reference Plane', InspectSnapProperties: 'Properties...', InspectTransformProperties: 'Properties...',
  InspectViewCubeProperties: 'ViewCube Properties...', MoveCtr2Vertices: 'Move Center to Points', MatchTransform: 'Match All Global Transforms',
  SetTransformRefMode: 'MCP Setting: Set Transform Ref/Modifier', IncreaseManipulatorSize: 'Increase Manipulator Size',
  DecreaseManipulatorSize: 'Decrease Manipulator Size', ToggleBackgroundColor: 'Toggle Background Color', ToggleFullscreenLayout: 'Toggle Fullscreen Layout',
  RotoscopyOptions: 'Rotoscopy Options', SetLightingDisplayMode: 'Set Lighting Display Mode',
  SetNURBSDisplayQualityDefault: 'Set NURBS Display Quality Default', SetNURBSDisplayQualityLow: 'Set NURBS Display Quality Low',
  SetNURBSDisplayQualityMedium: 'Set NURBS Display Quality Medium', SetNURBSDisplayQualityHigh: 'Set NURBS Display Quality High',
  DisplayPortValues: 'Display Port Values',
};
const NAMES = Object.keys(LABELS);
// how far each command is wired (printed at the end)
const STATUS = {
  full: ['InspectTransformProperties', 'InspectViewCubeProperties', 'SetTransformRefMode',
    'IncreaseManipulatorSize', 'DecreaseManipulatorSize', 'ToggleBackgroundColor', 'ToggleFullscreenLayout', 'SetLightingDisplayMode',
    'SetNURBSDisplayQualityDefault', 'SetNURBSDisplayQualityLow', 'SetNURBSDisplayQualityMedium', 'SetNURBSDisplayQualityHigh'],
  partly: ['CreateImageClip2', 'AddImageSource', 'AddWritableImageSource', 'AddModelSource', 'CreateModelClip', 'AddModelClip', 'CreateReferencePlane',
    'SetTransientReferencePlane', 'RotoscopyOptions', 'DisplayPortValues', 'MoveCtr2Vertices (text 1014 undecoded)', 'MatchTransform (filter constants by name only)'],
  standIn: ['LoadPreset', 'InstallAddon', 'UnInstallAddon', 'InspectSnapProperties'],
};

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = list.find(x => x.scripting_name === n && x.name === LABELS[n] && x.file === 'uixsiscripts.vbs');
  // the trailing `Value` argument with direction -1 is the return-value slot of the registration, not a caller argument
  return [n, c ? c.args.filter(a => a.flags !== -1).map(a => [a.name, a.default ?? null]) : null];
}));
const registryEntries = list.filter(x => NAMES.includes(x.scripting_name)).length;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/?demo';
await page.goto(URL0);
await page.waitForFunction(() => !!window.Application?.commands?.get('DisplayPortValues'), null, { timeout: 90000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.uixsiClipsDisplayAddons; const root = app.scene.root;
  const out = {};
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.type}:${v.name}` : typeof v.then === 'function' ? '<promise>' : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const pub = (r) => r.err !== undefined ? { err: r.err } : { v: r.v };
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
  const find = (n) => app.scene.find(n);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const gpos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]].map(r4); };
  const gmat = (o) => o.globalMatrix().elements.map(r4);
  const local = (o) => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].map(n => r4(o.kinematics.local.val(n)));
  const setLocal = (o, vals) => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz', 'sclx', 'scly', 'sclz'].forEach((n, i) => { if (vals[i] !== undefined) o.kinematics.local.set(n, vals[i]); });
  const points = (o) => { const g = o.primitive.geom(); const p = g.positions; const m = o.globalMatrix().elements; const res = [];
    for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; res.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]].map(r4)); } return res; };
  const mean = (pts) => [0, 1, 2].map(k => r4(pts.reduce((s, p) => s + p[k], 0) / pts.length));
  const bbMid = (pts) => [0, 1, 2].map(k => r4((Math.min(...pts.map(p => p[k])) + Math.max(...pts.map(p => p[k]))) / 2));
  const near = (a, b, tol = 2e-3) => a.length === b.length && a.every((v, i) => Array.isArray(v) ? near(v, b[i], tol) : Math.abs(v - b[i]) <= tol);
  const q = (s) => document.querySelector(s);
  const cube = find('cube'), sphere = find('sphere'), sphere1 = find('sphere1');
  const X3D = cube.constructor;
  const inspected = []; app.events.on('inspect', (n) => inspected.push(n?.name ?? String(n)));
  app.autoInspect = false;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.labels = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.label ?? null]));
  out.entries = Object.keys(S.entries);

  // ---- every command with default arguments, nothing selected, no user session for the boxes / picks
  const realSet = S.setActiveLayout, realName = S.activeLayoutName; const layoutCalls = [];
  S.setActiveLayout = (n) => { layoutCalls.push(n); return true; };
  out.defaults = {};
  app.Interactive = false;
  for (const n of NAMES) {
    app.select([]); app.compSel = null; const m = mark();
    const r = run(n);
    await tick(5);
    out.defaults[n] = { r: pub(r), log: logFrom(m) };
  }
  app.Interactive = true;
  out.defaultLayoutCalls = [...layoutCalls];
  for (const w of document.querySelectorAll('.ppg-float .ppg-float-close[title=Close]')) w.click();

  // ================= image sources and clips
  {
    const d = {}; app.select([cube]); app.autoInspect = true; inspected.length = 0;
    const propsBefore = root.properties.length; let m = mark();
    const r = run('CreateImageClip2', { FileName: 'Pictures/wood.pic', Name: 'woodClip' });
    await tick(10);
    d.clip = [r.v, r.raw?.[0]?.val('filename'), root.properties.includes(r.raw?.[0]), root.properties.length - propsBefore, app.selection.length === 1 && app.selection[0] === cube];
    d.clipInspected = inspected.includes('woodClip'); d.clipOut = S.outputs.CreateImageClip2; d.clipLog = logFrom(m).length;
    d.clipCall = S.calls.at(-1)?.command + ':' + S.calls.at(-1)?.ran;
    inspected.length = 0;
    const s = run('AddImageSource', { FileName: 'Pictures/stone.pic', Name: 'stone' }); await tick(10);
    d.source = [s.v, s.raw?.val('FileName'), S.imageSources.includes(s.raw), app.selection.length === 1 && app.selection[0] === s.raw, inspected.includes('stone')];
    app.select([cube]); const e = run('AddImageSource', {}); d.sourceEmpty = [e.v, app.selection[0] === cube];
    app.autoInspect = false;
    const w = run('AddWritableImageSource', { FileName: 'Pictures/bake.pic', Name: 'bake' });
    d.writable = [w.v, w.raw?.val('Width'), w.raw?.val('Height'), w.raw?.val('Type'), w.raw?.val('Writable'), app.selection[0] === w.raw];
    const w2 = run('AddWritableImageSource', { FileName: 'Pictures/bake.pic', Name: 'other', UseExisting: true }); d.useExisting = w2.raw === w.raw;
    const w3 = run('AddWritableImageSource', { FileName: 'Pictures/bake.pic', Name: 'other', Width: 512 }); d.notExisting = [w3.raw !== w.raw, w3.raw?.val('Width')];
    // undo removes the source again
    const n0 = S.imageSources.length; app.undo(); d.undo = S.imageSources.length - n0;
    out.image = d;
  }
  // ================= model sources and clips
  {
    const d = {}; app.select([]);
    const s = run('AddModelSource', { FileName: 'Models/rig.emdl', Name: 'rigSrc' });
    d.source = [s.v, s.raw?.val('FileName'), s.raw?.val('Resolution'), S.modelSources.includes(s.raw), app.selection[0] === s.raw];
    const before = new Set([...app.scene.allObjects()].map(o => o.name));
    const c = run('CreateModelClip', { FileName: 'Models/hero.emdl', Name: 'heroClip' });
    const model = [...app.scene.allObjects()].find(o => !before.has(o.name));
    d.clip = [c.v, c.raw?.Clip?.type, c.raw?.Clip?.name, S.modelClips.includes(c.raw?.Clip)];
    d.model = model ? [model.kind, model.parentObj === root, model.ref?.file, app.selection[0] === model] : null;
    const before2 = new Set([...app.scene.allObjects()].map(o => o.name));
    const a = run('AddModelClip', { Source: 'rigSrc', Name: 'rigClip' });
    const model2 = [...app.scene.allObjects()].find(o => !before2.has(o.name));
    d.add = [a.v, a.raw?.Clip?.name, a.raw?.Clip?.val('Source'), model2?.ref?.file, app.selection[0] === model2];
    const bad = run('AddModelClip', { Source: 'nope' }); d.bad = [bad.v, bad.raw?.Clip ?? null];
    out.model = d;
  }
  // ================= LoadPreset / add-ons
  {
    const d = {}; let n0 = S.calls.length; app.select([cube, sphere]); let m = mark();
    d.run = pub(run('LoadPreset', { PresetObj: 'Presets/x.Preset' }));
    d.calls = S.calls.slice(n0).map(c => `${c.command}(${c.args.FileName},${c.args.InputObj?.name}):${c.ran}`); d.log = logFrom(m).filter(l => /SILoadPreset: not yet attested/.test(l)).length;   // SILoadPreset is on the bus since CMD-B11c
    n0 = S.calls.length; run('LoadPreset', { PresetObj: 'Presets/x.Preset', InputObj: 'sphere1' }); d.explicit = S.calls.slice(n0).map(c => c.args.InputObj?.name);
    n0 = S.calls.length; app.select([]); run('LoadPreset', { PresetObj: 'Presets/x.Preset' }); d.empty = S.calls.length - n0;
    d.install = [pub(run('InstallAddon', { FileName: 'Addons/tools.xsiaddon' })), JSON.stringify(S.addons)];
    d.install2 = [pub(run('InstallAddon', { FileName: 'Addons/more.xsiaddon', InstallPath: 2 })), S.addons.length];
    d.uninstall = [pub(run('UnInstallAddon', { FileName: 'Addons/tools.xsiaddon' })), JSON.stringify(S.addons)];
    d.omCalls = S.calls.filter(c => c.command.startsWith('Application.')).map(c => c.command).slice(-3);
    out.misc = d;
  }
  // ================= reference planes
  {
    const d = {}; app.select([cube]); let n0 = S.calls.length;
    const r = run('CreateReferencePlane');
    d.create = [r.v, S.refPlanes.includes(r.raw?.[0]), S.currentRefPlane === r.raw?.[0], S.calls.slice(n0).map(c => c.command)];
    const r2 = run('CreateReferencePlane', { InputObjs: 'sphere' }); d.second = [r2.raw?.[0]?.name !== r.raw?.[0]?.name, S.currentRefPlane === r2.raw?.[0], r2.raw?.[0]?.val('inputs')];
    n0 = S.calls.length; app.select([sphere1]);
    d.transient = [pub(run('SetTransientReferencePlane')), S.currentRefPlane, S.transientPlane?.inputs, S.calls.slice(n0).map(c => `${c.command}(${c.args.Target ?? c.args.Value})`)];
    run('SetTransientReferencePlane', { InputObjs: 'cube.pnt[0,1,2]' }); d.transientComp = S.transientPlane?.inputs;
    app.undo(); d.undo = S.transientPlane?.inputs;
    out.planes = d;
  }
  // ================= preference inspectors
  {
    const d = {}; const count = () => document.querySelectorAll('.prefs').length; const active = () => [...document.querySelectorAll('.prefs-item.active')].map(e => e.textContent);
    let n = count(); let m = mark(); run('InspectTransformProperties'); await tick(30); d.transform = [count() - n, active().at(-1)];
    n = count(); run('InspectViewCubeProperties'); await tick(30); d.viewCube = [count() - n, active().at(-1)];
    n = count(); m = mark(); run('InspectSnapProperties'); await tick(30); d.snap = [count() - n, logFrom(m)];
    for (const w of document.querySelectorAll('.ppg-float .ppg-float-close[title=Close]')) w.click();
    out.inspect = d;
  }
  // ================= MoveCtr2Vertices
  {
    const d = {}; app.select([]); app.compSel = null;
    const child = run('GetPrim', { PresetObj: 'Null', Name: 'ctrChild' }).raw; run('ParentObj', { Parent: 'cube', Children: 'ctrChild' });
    setLocal(child, [0.5, 0.25, -1]);
    setLocal(cube, [1, 2, 3, 20, 30, 40, 1, 2, 1]);
    // displace the geometry from the centre so the mean of the points is not the centre
    setLocal(sphere1, [-4, 1, 2, 0, 45, 0, 1, 1, 1]);
    const checkMove = (o, args, expect) => {
      const before = points(o); const kid = o === cube ? gpos(child) : null; const want = expect(before); const ops = o.primitive.operators.length;
      const r = run('MoveCtr2Vertices', args);
      return { r: pub(r), centre: near(gpos(o), want), pointsKept: near(points(o), before), childKept: kid ? near(gpos(child), kid) : null, ops: o.primitive.operators.length - ops, want, got: gpos(o) };
    };
    const cl0 = cube.clusters.length;
    d.sub = checkMove(cube, { InputObjs: 'cube.pnt[0,1,2]' }, (p) => mean([p[0], p[1], p[2]])); d.subTempGone = cube.clusters.length - cl0;
    d.subBB = checkMove(cube, { InputObjs: 'cube.pnt[0,1,2,5]', BoundingBox: true }, (p) => bbMid([p[0], p[1], p[2], p[5]]));
    d.whole = checkMove(cube, { InputObjs: 'cube' }, (p) => mean(p));
    d.wholeBB = checkMove(cube, { InputObjs: [cube], BoundingBox: true }, (p) => bbMid(p));
    // undo puts centre and geometry back
    { const before = gpos(cube); run('MoveCtr2Vertices', { InputObjs: 'cube.pnt[3]' }); const moved = !near(gpos(cube), before); app.undo(); d.undo = [moved, near(gpos(cube), before)]; }
    // tagged components (selection): points
    app.selectComponents(cube, 'point', [4, 5, 6]);
    d.tagged = checkMove(cube, {}, (p) => mean([p[4], p[5], p[6]]));
    // tagged polygons: message, command ends, the temporary cluster stays
    app.selectComponents(cube, 'polygon', [0]); let m = mark(); const c1 = cube.clusters.length; const g0 = gpos(cube);
    d.poly = [pub(run('MoveCtr2Vertices')), logFrom(m), cube.clusters.length - c1, near(gpos(cube), g0)];
    // selected clusters: a point cluster is used and kept, a polygon cluster is reported and skipped
    app.selectComponents(sphere1, 'point', [0, 1, 2, 3]); const pc = run('CreateCluster', { Name: 'ctrPts' }).raw;
    app.selectComponents(sphere1, 'polygon', [0, 1]); const fc = run('CreateCluster', { Name: 'ctrPolys' }).raw;
    app.compSel = null; app.setSelMode('object'); app.select([fc, pc]); m = mark(); const c2 = sphere1.clusters.length;
    const before = points(sphere1);
    const r = run('MoveCtr2Vertices');
    d.clusters = [pub(r), logFrom(m), near(gpos(sphere1), mean([0, 1, 2, 3].map(i => before[i]))), near(points(sphere1), before), sphere1.clusters.length - c2];
    // a whole object next to a cluster is ignored
    const sg = gpos(sphere); run('MoveCtr2Vertices', { InputObjs: [sphere, pc] }); d.objectIgnored = near(gpos(sphere), sg);
    // empty input in a user session: logged and shown in a box titled Warning
    app.select([]); m = mark(); const er = run('MoveCtr2Vertices'); await tick(60);
    const box = q('.sdkh-msg'); d.emptyBox = [pub(er), logFrom(m).length, !!box, box?.querySelector('.ppg-float-title, .float-title, [class*=title]')?.textContent ?? null, q('.sdkh-msg-text')?.textContent === logFrom(m)[0]?.replace(/^info:/, '')];
    q('.sdkh-msg .sdkh-modal-ok')?.click(); await tick(20); d.emptyBoxClosed = !q('.sdkh-msg');
    out.ctr = d;
  }
  // ================= MatchTransform
  {
    const d = {}; app.compSel = null; app.centerMode = false;
    const tgt = run('GetPrim', { PresetObj: 'Null', Name: 'mtTarget' }).raw; const par = run('GetPrim', { PresetObj: 'Null', Name: 'mtParent' }).raw;
    const a = run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'mtA' }).raw; const b = run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'mtB' }).raw;
    setLocal(par, [3, -1, 2, 0, 90, 0, 1, 1, 1]); run('ParentObj', { Parent: 'mtParent', Children: 'mtA' });
    setLocal(tgt, [5, 6, 7, 10, 20, 30, 2, 3, 4]);
    const srt = (o) => { const e = o.globalMatrix(); const T = window.__THREE__ ? null : null; return e; };
    const reset = () => { setLocal(a, [1, 1, 1, 0, 0, 0, 1, 1, 1]); setLocal(b, [-2, 0, 0, 15, 0, 0, 1, 1, 1]); };
    const gscl = (o) => { const e = o.globalMatrix().elements; return [0, 4, 8].map(k => r4(Math.hypot(e[k], e[k + 1], e[k + 2]))); };
    const grot = (o) => { const e = o.globalMatrix().elements; const s = gscl(o); return [0, 4, 8].flatMap((k, i) => [e[k] / s[i], e[k + 1] / s[i], e[k + 2] / s[i]].map(r4)); };
    reset(); let before = { p: gpos(a), s: gscl(a), r: grot(a) };
    d.trn = [pub(run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: 'siTrn' })), near(gpos(a), gpos(tgt)), near(gscl(a), before.s), near(grot(a), before.r)];
    reset(); before = { p: gpos(a), s: gscl(a), r: grot(a) };
    run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: 'siRot' }); d.rot = [near(grot(a), grot(tgt)), near(gpos(a), before.p), near(gscl(a), before.s)];
    reset(); before = { p: gpos(a), s: gscl(a), r: grot(a) };
    run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: 'siScl' }); d.scl = [near(gscl(a), gscl(tgt)), near(gpos(a), before.p), near(grot(a), before.r)];
    reset(); app.select([a, b]);
    d.all = [pub(run('MatchTransform', { TargetObj: tgt })), near(gmat(a), gmat(tgt)), near(gmat(b), gmat(tgt)), app.selection.length === 2, S.outputs.MatchTransform?.TargetObj];
    // local reference: the local values are copied
    reset(); run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', LocalReference: true }); d.local = [near(local(a), local(tgt)), !near(gmat(a), gmat(tgt))];
    reset(); run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: ':siTrn:siTransformFilter', LocalReference: true }); d.localTrn = near(local(a), [5, 6, 7, 0, 0, 0, 1, 1, 1]);
    // one undo entry
    reset(); const l0 = local(a); run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget' }); app.undo(); d.undo = near(local(a), l0);
    // centre mode: the geometry stays where it is
    reset(); app.centerMode = true; const pts = points(a);
    run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget' }); d.centre = [near(gmat(a), gmat(tgt)), near(points(a), pts, 5e-3)];
    reset(); const pts2 = points(a); run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: 'siTrn', LocalReference: true }); d.centreLocal = [near(local(a).slice(0, 3), [5, 6, 7]), near(points(a), pts2, 5e-3)];
    app.centerMode = false;
    // unknown numeric filter, missing target
    reset(); let m = mark(); const g1 = gmat(a); d.numeric = [pub(run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'mtTarget', Type: 3 })), logFrom(m).length, near(gmat(a), g1)];
    d.badTarget = pub(run('MatchTransform', { InputObjs: 'mtA', TargetObj: 'nope' }));
    // pick session
    reset(); app.select([a]); m = mark(); d.pickRun = pub(run('MatchTransform', { Type: 'siTrn' }));
    const sess = app.miscDsScripts?.session; d.session = sess ? [sess.command, sess.kind, sess.prompt, app.activeTool?.name ?? null] : null;
    sess?.pick(tgt, 1, 0); d.picked = [near(gpos(a), gpos(tgt)), app.miscDsScripts?.session === null, app.activeTool === null, app.selection.length === 1 && app.selection[0] === a];
    // cancelled pick
    reset(); app.select([a]); m = mark(); run('MatchTransform'); app.miscDsScripts?.session?.pick(null, 0); d.cancel = [logFrom(m).filter(l => l.includes('not yet attested')).length, near(local(a), [1, 1, 1, 0, 0, 0, 1, 1, 1])];
    out.match = d;
  }
  // ================= SetTransformRefMode
  {
    delete (app.userPrefs ??= {})['3D_TRANSFO_REFERENTIAL_CHANGED'];
    const seq = [2, 16, 256, 256, 2048, 3, 0, 1024, 7, 1024]; const vals = []; const rets = [];
    for (const mode of seq) { const r = run('SetTransformRefMode', { Mode: mode }); rets.push(r.v); vals.push(app.userPrefs['3D_TRANSFO_REFERENTIAL_CHANGED']); }
    out.refMode = { vals, rets: [...new Set(rets)], decoded: S.transformRef() };
    S.entries['MCP Setting: Set Transform Ref Global'](); out.refMode.entry = app.userPrefs['3D_TRANSFO_REFERENTIAL_CHANGED'];
  }
  // ================= manipulator size / background colour
  {
    const d = {}; const tp = window.__prefSets.get('C3DTransformProps'); const p = tp.get('transformsize'); const keep = p.value;
    const step = (start, cmd) => { p.value = start; run(cmd); return p.value; };
    d.inc = [step(30, 'IncreaseManipulatorSize'), step(90, 'IncreaseManipulatorSize'), step(95, 'IncreaseManipulatorSize'), step(100, 'IncreaseManipulatorSize')];
    d.dec = [step(30, 'DecreaseManipulatorSize'), step(20, 'DecreaseManipulatorSize'), step(10, 'DecreaseManipulatorSize'), step(5, 'DecreaseManipulatorSize')];
    p.value = 30; S.entries['Increase Manipulator Size (alternate)'](); d.alt = p.value;
    p.value = keep;
    const bg = window.__prefSets.get('C3DSceneColors').get('backgroundcol'); const keepBg = bg.value;
    const tog = (start) => { bg.value = start; run('ToggleBackgroundColor'); return bg.value; };
    d.bg = [tog(2139062271), tog(0), tog(255)];
    bg.value = keepBg;
    out.size = d;
  }
  // ================= ToggleFullscreenLayout (layout switch stubbed; the real switch is exercised after this block)
  {
    const d = {}; layoutCalls.length = 0;
    for (const cur of ['Default', 'Autohide', 'Dual']) { S.activeLayoutName = () => cur; run('ToggleFullscreenLayout'); }
    d.calls = [...layoutCalls];
    S.setActiveLayout = () => false; S.activeLayoutName = () => 'Default'; d.missing = pub(run('ToggleFullscreenLayout'));
    S.setActiveLayout = realSet; S.activeLayoutName = realName; d.realName = S.activeLayoutName();
    out.layout = d;
  }
  // ================= view camera display
  {
    const d = {}; const vp = window.__vm.viewports()[1]; const disp = vp.x.disp; inspected.length = 0;
    disp.set('rotoenable', false); let m = mark();
    d.roto = [pub(run('RotoscopyOptions')), disp.val('rotoenable'), vp.flags['Rotoscope'] === true]; await tick(20);
    d.rotoInspected = inspected.includes(disp.name); d.rotoLog = logFrom(m).length;
    d.rotoAgain = [pub(run('RotoscopyOptions')), disp.val('rotoenable')]; await tick(20);
    disp.set('rotoenable', false);
    disp.set('headlight', true); d.light = [pub(run('SetLightingDisplayMode')), disp.val('headlight')];
    d.lightOff = [pub(run('SetLightingDisplayMode')), disp.val('headlight')];
    for (const w of document.querySelectorAll('.ppg-float .ppg-float-close[title=Close]')) w.click();
    out.camera = d;
  }
  // ================= NURBS display quality
  {
    const d = {}; const mk = (n, t) => { const o = new X3D(n, t); root.addChild(o); return o; };
    const crv = mk('nqCurve', 'crvlist'), srf = mk('nqSurf', 'surfmsh'), crv2 = mk('nqCurve2', 'crvlist');
    const ga = (o) => o.properties.find(p => p.type === 'geomapprox'); const vals = (o) => { const p = ga(o); return p ? [p.val('gapproxvwcustep'), p.val('gapproxvwustep'), p.val('gapproxvwvstep')] : null; };
    app.compSel = null; app.select([crv, srf, cube]); const rootVals = vals(root); const cubeVals = JSON.stringify(vals(cube));
    d.medium = [pub(run('SetNURBSDisplayQualityMedium')), vals(crv), vals(srf)];
    d.default = [pub(run('SetNURBSDisplayQualityDefault')), vals(crv), vals(srf)];
    d.low = [pub(run('SetNURBSDisplayQualityLow')), vals(crv), vals(srf), JSON.stringify(vals(cube)) === cubeVals, app.selection.length];
    d.high = [pub(run('SetNURBSDisplayQualityHigh')), vals(crv), vals(srf)];
    d.back = [pub(run('SetNURBSDisplayQualityDefault')), vals(crv), vals(srf)];
    d.argOverride = [pub(run('SetNURBSDisplayQualityDefault', { Quality: 3 })), vals(crv)];
    d.rootKept = JSON.stringify(vals(root)) === JSON.stringify(rootVals); d.unselected = vals(crv2);
    for (const o of [crv, srf, crv2]) root.removeChild(o);
    out.nurbs = d;
  }
  // ================= DisplayPortValues
  {
    const d = {}; const R = S.portValueRules; const PORT = 'pointcloud.pointcloud.ICETree.Get_Point_Position.value';
    let m = mark(); d.setter = [pub(run('DisplayPortValues', { Port: PORT })), JSON.stringify(S.portDisplays.get(PORT)), logFrom(m).length];
    run('DisplayPortValues', { Port: PORT, Enable: false, Mode: 2 }); d.setterOff = [S.portDisplays.get(PORT)?.Enable, S.portDisplays.get(PORT)?.Mode, S.portDisplays.size];
    d.choices = {
      locArr: R.displayModeChoices('Location', 2, 2), loc: R.displayModeChoices('Location', 2, 1), v3sub: R.displayModeChoices('Vector3', 32, 1), v3subArr: R.displayModeChoices('Vector3', 32, 2),
      v3: R.displayModeChoices('Vector3', 2, 1), v3Arr: R.displayModeChoices('Vector3', 2, 2), v4: R.displayModeChoices('Vector4', 2, 1), quat: R.displayModeChoices('Quaternion', 2, 1),
      rot: R.displayModeChoices('Rotation', 2, 1), m33: R.displayModeChoices('Matrix33', 2, 1), m44: R.displayModeChoices('Matrix44', 2, 2), col: R.displayModeChoices('Color4', 2, 1), flt: R.displayModeChoices('Float', 2, 1),
    };
    d.rotate = [[0, 1], [2, 3], [0, 2], [2, 1], [1, 3], [3, 0], [2, 0], [0, 3], [3, 1], [1, 2]].map(([f, t]) => R.rotateLabelOffset(f, t, 5, 7));
    d.types = ['siICENodeDataBool', 'siICENodeDataVector3', 'Color4', 16, 'siICENodeDataGeometry', 1024].map(t => R.dataTypeKey(t));
    const dlg = () => q('.uixsi-showvalues'); const ctl = (n) => dlg()?.querySelector(`[data-param="${n}"] input, [data-param="${n}"] select`);
    const hasProp = () => root.properties.filter(p => p.name === 'ShowValues').length;
    const settle = async (p) => { try { return { ok: await p }; } catch (e) { return { err: e?.name, cancelled: e?.siErrCancelled === true }; } };
    // unsupported type: siErrCancelled, the property stays behind
    { const r = await settle(S.showPortValues({ Port: PORT }, 'siICENodeDataGeometry', 2, 1)); d.unsupported = [r.err, r.cancelled, hasProp(), !!dlg()]; for (const p of root.properties.filter(x => x.name === 'ShowValues')) root.removeProperty(p); }
    // OK path
    {
      S.portDisplays.clear(); const args = { Port: PORT, OffsetX: 5, OffsetY: 7 }; const p = S.showPortValues(args, 'siICENodeDataVector3', 2, 2); await tick(60);
      const prop = S.portDialog?.property;
      d.open = [!!dlg(), hasProp(), [...ctl('DisplayMode').options].map(o => `${o.textContent}=${o.value}`), prop?.val('Type'), prop?.val('Port'), !!ctl('SubArray'), [...ctl('Position').options].map(o => o.textContent),
        dlg().querySelector('.spv-note')?.textContent, prop?.params.map(x => x.name).join(',')];
      d.rulesAtOpen = [ctl('ScaleFactor').disabled, ctl('RangeStart').disabled, ctl('RangeEnd').disabled, ctl('RangeStep').disabled, ctl('ArrayStart').disabled, ctl('ArrayEnd').disabled, ctl('ColorR').disabled, ctl('UseColor').disabled];
      const setSel = (n, v) => { const c = ctl(n); c.value = String(v); c.onchange(); }; const setChk = (n, v) => { const c = ctl(n); c.checked = v; c.onchange(); };
      setSel('DisplayMode', 2); setChk('UseRange', true); setChk('SubArray', true); setChk('UseColor', false);
      d.rulesAfter = [ctl('ScaleFactor').disabled, ctl('RangeStart').disabled, ctl('RangeStep').disabled, ctl('ArrayEnd').disabled, ctl('ColorR').disabled];
      setSel('Position', 2); d.posRotate = [prop.val('OffsetX'), prop.val('OffsetY'), prop.val('LastPosition'), ctl('OffsetX').value, ctl('OffsetY').value];
      dlg().querySelector('.spv-apply').click();
      d.applied = [prop.val('Applied'), S.portDisplays.get(PORT)?.Mode, S.portDisplays.get(PORT)?.ClearLabel, !!dlg()];
      const lbl = ctl('Label'); lbl.value = 'P#'; lbl.onchange();
      dlg().querySelector('.sdkh-modal-ok').click(); const r = await settle(p);
      d.ok = [r.ok === args, JSON.stringify(args), Object.keys(args).length === 27 && Object.keys(args).every(k => S.portDisplays.get(PORT)[k] === args[k]), hasProp(), !!dlg(), S.portDialog];
    }
    // Cancel after Apply: the incoming values are set again; Cancel without Apply: no call
    {
      S.portDisplays.clear(); const args = { Port: PORT, Mode: 0, Label: 'in' }; const p = S.showPortValues(args, 'siICENodeDataFloat', 2, 1); await tick(60);
      const lbl = ctl('Label'); lbl.value = 'changed'; lbl.onchange(); dlg().querySelector('.spv-apply').click(); const mid = S.portDisplays.get(PORT)?.Label;
      d.noArrayRow = !ctl('SubArray');
      dlg().querySelector('.sdkh-modal-cancel').click(); const r = await settle(p);
      d.cancelApplied = [mid, r.cancelled, S.portDisplays.get(PORT)?.Label, S.portDisplays.get(PORT)?.ClearLabel, JSON.stringify(args), hasProp()];
      S.portDisplays.clear(); const p2 = S.showPortValues({ Port: PORT }, 'siICENodeDataFloat', 2, 1); await tick(60);
      dlg().querySelector('.sdkh-modal-cancel').click(); const r2 = await settle(p2); d.cancelPlain = [r2.cancelled, S.portDisplays.size, hasProp()];
    }
    // Color4 with incoming mode 6: UseColor forced off, colour controls disabled
    {
      const p = S.showPortValues({ Port: PORT, Mode: 6 }, 'siICENodeDataColor4', 2, 1); await tick(60);
      d.color = [S.portDialog?.property.val('UseColor'), ctl('ScaleFactor').disabled, ctl('UseColor').disabled, ctl('ColorR').disabled];
      dlg().querySelector('.sdkh-modal-cancel').click(); await settle(p);
    }
    // no user session
    { app.Interactive = false; m = mark(); const r = await settle(S.showPortValues({ Port: PORT }, 'siICENodeDataFloat', 2, 1)); app.Interactive = true; d.batch = [r.cancelled, logFrom(m).length, hasProp()]; }
    out.port = d;
  }
  out.undoOk = true;
  return out;
}, { NAMES });

// ---- the real layout switch (reloads the page): Default -> Autohide -> Default
const layoutReal = {};
{
  const nameNow = () => page.evaluate(() => window.Application.uixsiClipsDisplayAddons.activeLayoutName());
  const toggle = async () => {
    await Promise.all([page.waitForNavigation({ timeout: 90000 }), page.evaluate(() => { try { window.Application.run('ToggleFullscreenLayout'); } catch (e) { /* navigating */ } })]);
    await page.waitForFunction(() => !!window.Application?.commands?.get('DisplayPortValues'), null, { timeout: 90000 });
    await page.waitForTimeout(300);
    return nameNow();
  };
  layoutReal.before = await nameNow();
  try { layoutReal.first = await toggle(); layoutReal.second = await toggle(); } catch (e) { layoutReal.error = String(e?.message ?? e); }
  await page.evaluate(() => { try { localStorage.removeItem('si.layout'); } catch { /* ignore */ } });
}
await browser.close();

// ------------------------------------------------------------------ assertions
let checks = 0; const fails = [];
const eq = (what, a, b) => { checks++; const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) fails.push(`${what}: got ${x}, want ${y}`); };
const ok = (what, v) => { checks++; if (!v) fails.push(`${what}: false`); };
const NONE = { v: '<none>' };

eq('registry entries under the 28 names', registryEntries, 45);
for (const n of NAMES) {
  ok(`${n}: registry entry found`, !!registry[n]);
  eq(`${n}: arguments`, got.reg[n], registry[n]);
  eq(`${n}: label`, got.labels[n], LABELS[n]);
  ok(`${n}: default run does not throw (${got.defaults[n]?.r?.err ?? ''})`, got.defaults[n] && got.defaults[n].r.err === undefined);
}
eq('other registry entries exposed', got.entries.length, 2 + 4 + 10 + 2);

// defaults
const D = got.defaults; const nya = (n) => D[n].log.some(l => l.includes('not yet attested'));
eq('CreateImageClip2 default: empty collection', D.CreateImageClip2.r, { v: [] }); ok('CreateImageClip2 default: logs not yet attested', nya('CreateImageClip2'));
for (const n of ['AddImageSource', 'AddWritableImageSource', 'AddModelSource']) { eq(`${n} default: empty return`, D[n].r, NONE); ok(`${n} default: logs not yet attested`, nya(n)); }
for (const n of ['CreateModelClip', 'AddModelClip']) { eq(`${n} default: the output list`, D[n].r, { v: '{Clip}' }); ok(`${n} default: logs not yet attested`, nya(n)); }
eq('LoadPreset default: nothing called', D.LoadPreset, { r: NONE, log: [] });
for (const n of ['InstallAddon', 'UnInstallAddon', 'InspectSnapProperties']) { eq(`${n} default: no value`, D[n].r, NONE); ok(`${n} default: logs not yet attested`, nya(n)); }
eq('CreateReferencePlane default: empty collection', D.CreateReferencePlane.r, { v: [] });
eq('MoveCtr2Vertices default (no session): message logged twice (log + box line)', [D.MoveCtr2Vertices.log.length, D.MoveCtr2Vertices.log[1]?.startsWith('info:Warning: ')], [2, true]);
eq('MatchTransform default: error', D.MatchTransform, { r: NONE, log: ['error:Please select an object first'] });
eq('SetTransformRefMode default: no value', D.SetTransformRefMode.r, NONE);
eq('ToggleFullscreenLayout default: Default -> Autohide', got.defaultLayoutCalls, ['Autohide']);
for (const n of ['IncreaseManipulatorSize', 'DecreaseManipulatorSize', 'ToggleBackgroundColor', 'SetLightingDisplayMode', 'SetNURBSDisplayQualityDefault', 'SetNURBSDisplayQualityLow', 'SetNURBSDisplayQualityMedium', 'SetNURBSDisplayQualityHigh'])
  eq(`${n} default: no value, no message`, D[n], { r: NONE, log: [] });
eq('DisplayPortValues default: no value', D.DisplayPortValues.r, NONE); ok('DisplayPortValues default: logs not yet attested', nya('DisplayPortValues'));

// image
const I = got.image;
eq('CreateImageClip2: one clip, on the root, selection kept', I.clip, [['node:imageclip:woodClip'], 'Pictures/wood.pic', true, 1, true]);
ok('CreateImageClip2: clip auto-inspected', I.clipInspected); eq('CreateImageClip2: FileName out', I.clipOut, { FileName: 'Pictures/wood.pic' });
eq('CreateImageClip2: low-level call recorded (stand-in)', I.clipCall, 'SICreateImageClip2:false'); ok('CreateImageClip2: stand-in logged', I.clipLog >= 1);
eq('AddImageSource: source returned, selected, inspected', I.source, ['node:imagesource:stone', 'Pictures/stone.pic', true, true, true]);
eq('AddImageSource: no source, nothing more happens', I.sourceEmpty, ['<none>', true]);
eq('AddWritableImageSource: source', I.writable, ['node:imagesource:bake', 256, 256, 'siRenderChannelColorType', true, true]);
ok('AddWritableImageSource: UseExisting hands back the existing source', I.useExisting); eq('AddWritableImageSource: new source otherwise', I.notExisting, [true, 512]);
eq('AddWritableImageSource: undo', I.undo, -1);
// model
const Mo = got.model;
eq('AddModelSource', Mo.source, ['node:modelsource:rigSrc', 'Models/rig.emdl', 2, true, true]);
eq('CreateModelClip: returns the output list with Clip', Mo.clip, ['{Clip}', 'modelclip', 'heroClip', true]);
eq('CreateModelClip: model instantiated and selected', Mo.model, ['model', true, 'Models/hero.emdl', true]);
eq('AddModelClip', Mo.add, ['{Clip}', 'rigClip', 'rigSrc', 'Models/rig.emdl', true]);
eq('AddModelClip: unknown source', Mo.bad, ['{Clip}', null]);
// misc
const Mi = got.misc;
eq('LoadPreset: one low-level call per object, in order', Mi.calls, ['SILoadPreset(Presets/x.Preset,cube):true', 'SILoadPreset(Presets/x.Preset,sphere):true']);
eq('LoadPreset: no value', Mi.run, NONE); ok('LoadPreset: SILoadPreset (CMD-B11c) logs its unmodelled file picker once per object', Mi.log === 2);
eq('LoadPreset: explicit input', Mi.explicit, ['sphere1']); eq('LoadPreset: empty input', Mi.empty, 0);
eq('InstallAddon', Mi.install, [NONE, JSON.stringify([{ file: 'Addons/tools.xsiaddon', installPath: 7 }])]);
eq('InstallAddon: second', Mi.install2, [NONE, 2]);
eq('UnInstallAddon', Mi.uninstall, [NONE, JSON.stringify([{ file: 'Addons/more.xsiaddon', installPath: 2 }])]);
eq('add-ons: one object-model call each', Mi.omCalls, ['Application.InstallAddon', 'Application.InstallAddon', 'Application.UnInstallAddon']);
// planes
const P = got.planes;
eq('CreateReferencePlane: plane returned, current', P.create, [['node:refplane:RefPlane'], true, true, ['SICreateRefPlane', 'SetCurrentReferencePlane']]);
eq('CreateReferencePlane: the last plane is current', P.second, [true, true, 'sphere']);
eq('SetTransientReferencePlane', P.transient, [NONE, 'RefPlanes.Transform', ['sphere1'], ['SetReferencePlane(RefPlanes.Transform)', 'SetCurrentReferencePlane(RefPlanes.Transform)']]);
eq('SetTransientReferencePlane: components', P.transientComp, ['cube.pnt[0,1,2]']); eq('SetTransientReferencePlane: undo', P.undo, ['sphere1']);
// inspectors
eq('InspectTransformProperties opens the transform page', got.inspect.transform[0], 1); ok('InspectTransformProperties: a page is active', !!got.inspect.transform[1]);
eq('InspectViewCubeProperties recycles the open Preferences window', got.inspect.viewCube[0], 0); ok('InspectViewCubeProperties: another page', got.inspect.viewCube[1] !== got.inspect.transform[1]);
eq('InspectSnapProperties: nothing opened', got.inspect.snap[0], 0); ok('InspectSnapProperties: not yet attested', got.inspect.snap[1].some(l => l.includes('not yet attested')));
// MoveCtr2Vertices
const C = got.ctr;
for (const k of ['sub', 'subBB', 'whole', 'wholeBB', 'tagged']) {
  eq(`MoveCtr2Vertices ${k}: no value`, C[k].r, NONE);
  ok(`MoveCtr2Vertices ${k}: centre at the target (${JSON.stringify(C[k].got)} vs ${JSON.stringify(C[k].want)})`, C[k].centre);
  ok(`MoveCtr2Vertices ${k}: points stay in place`, C[k].pointsKept); ok(`MoveCtr2Vertices ${k}: children stay in place`, C[k].childKept);
}
eq('MoveCtr2Vertices: temporary cluster deleted', C.subTempGone, 0); eq('MoveCtr2Vertices: undo', C.undo, [true, true]);
eq('MoveCtr2Vertices: tagged polygons', C.poly, [NONE, ['info:Tagged components are not valid for this operation.'], 1, true]);
eq('MoveCtr2Vertices: selected clusters', [C.clusters[0], C.clusters[1].length, C.clusters[1][0]?.startsWith('info:Cluster ') && C.clusters[1][0]?.endsWith('ctrPolys is not valid for this operation.'), C.clusters[2], C.clusters[3], C.clusters[4]], [NONE, 1, true, true, true, 0]);
ok('MoveCtr2Vertices: whole object ignored next to a cluster', C.objectIgnored);
eq('MoveCtr2Vertices: empty input in a session', [C.emptyBox[0], C.emptyBox[1], C.emptyBox[2], C.emptyBox[4], C.emptyBoxClosed], [NONE, 1, true, true, true]);
// MatchTransform
const T = got.match;
eq('MatchTransform siTrn', T.trn, [NONE, true, true, true]); eq('MatchTransform siRot', T.rot, [true, true, true]); eq('MatchTransform siScl', T.scl, [true, true, true]);
eq('MatchTransform siSRT on the selection', T.all, [NONE, true, true, true, 'mtTarget']);
eq('MatchTransform local', T.local, [true, true]); ok('MatchTransform local siTrn', T.localTrn); ok('MatchTransform undo', T.undo);
eq('MatchTransform centre mode', T.centre, [true, true]); eq('MatchTransform centre mode, local', T.centreLocal, [true, true]);
eq('MatchTransform numeric filter', T.numeric, [NONE, 1, true]); ok('MatchTransform missing target raises', T.badTarget.err && T.badTarget.err.includes('nope'));
eq('MatchTransform pick session', [T.pickRun, T.session], [NONE, ['MatchTransform', 'element', 'Pick an object to match pose to', 'MatchTransform']]);
eq('MatchTransform picked', T.picked, [true, true, true, true]); eq('MatchTransform cancelled pick', T.cancel, [1, true]);
// SetTransformRefMode
eq('SetTransformRefMode sequence', got.refMode.vals, [2, 18, 258, 2, 2050, 2051, 2048, 1024, 1031, 7]);
eq('SetTransformRefMode produces no value', got.refMode.rets, ['<none>']); eq('SetTransformRefMode decoded', got.refMode.decoded, { value: 7, reference: 7, modifiers: 0 });
eq('SetTransformRefMode entry', got.refMode.entry, 1);
// sizes
eq('IncreaseManipulatorSize', got.size.inc, [40, 100, 95, 100]); eq('DecreaseManipulatorSize', got.size.dec, [20, 10, 10, 5]); eq('IncreaseManipulatorSize (alternate)', got.size.alt, 40);
eq('ToggleBackgroundColor', got.size.bg, [0, 2139062271, 0]);
// layout
eq('ToggleFullscreenLayout', got.layout.calls, ['Autohide', 'Default', 'Autohide']); ok('ToggleFullscreenLayout: missing layout raises', !!got.layout.missing.err);
eq('ToggleFullscreenLayout: real switch', layoutReal, { before: 'Default', first: 'Autohide', second: 'Default' });
// camera
const K = got.camera;
eq('RotoscopyOptions', K.roto, [NONE, true, true]); ok('RotoscopyOptions inspects', K.rotoInspected); eq('RotoscopyOptions again', K.rotoAgain, [NONE, true]);
eq('SetLightingDisplayMode turns the headlight off', K.light, [NONE, false]); eq('SetLightingDisplayMode never turns it on', K.lightOff, [NONE, false]);
// NURBS
const N = got.nurbs;
eq('NURBS Medium at default values: untouched', N.medium, [NONE, null, null]); eq('NURBS Default at default values: untouched', N.default, [NONE, null, null]);
eq('NURBS Low', [N.low[0], N.low[1]?.[0], N.low[2]?.slice(1), N.low[3], N.low[4]], [NONE, 3, [1, 1], true, 3]);
eq('NURBS High', [N.high[1]?.[0], N.high[2]?.slice(1)], [9, [6, 6]]); eq('NURBS Default', [N.back[1]?.[0], N.back[2]?.slice(1)], [6, [3, 3]]);
eq('NURBS Quality argument', N.argOverride[1]?.[0], 9); ok('NURBS: scene root property kept', N.rootKept); eq('NURBS: unselected curve', N.unselected, null);
// DisplayPortValues
const V = got.port; const PORT = 'pointcloud.pointcloud.ICETree.Get_Point_Position.value';
const DEF = { Port: PORT, Enable: true, Mode: 0, ClearLabel: false, Label: '', Position: 0, OffsetX: 0, OffsetY: 0, Scale: 1, SkipDefault: false, UseColor: true, ColorR: 0.62, ColorG: 1, ColorB: 0.62, ColorA: 1, UseRange: false, RangeStart: 0, RangeEnd: 10000, RangeStep: 1, SelectedOnly: false, SubArray: false, ArrayStart: 0, ArrayEnd: 10, Global: false, DrawOnTop: true, ModifiedOnly: false, Percentage: 100 };
eq('DisplayPortValues setter', [V.setter[0], V.setter[1]], [NONE, JSON.stringify(DEF)]); ok('DisplayPortValues setter logs', V.setter[2] === 1); eq('DisplayPortValues setter off', V.setterOff, [false, 2, 1]);
const ch = (...p) => p; const L = { P: ['Points', 2], L: ['Lines', 11], N: ['Nulls', 7], Z: ['Numeric', 0], PT: ['Point Trails', 3], VT: ['Vector Trails', 10], V: ['Vectors', 1], VL: ['Vectors + Length', 8], AA: ['Axis + Angle', 5], AN: ['Axis + Numeric Angle', 9], AX: ['Axes', 4], C: ['Colors', 6] };
eq('Display As lists', V.choices, {
  locArr: ch(L.P, L.L, L.N, L.Z), loc: ch(L.P, L.N, L.Z), v3sub: ch(L.P, L.N, L.Z), v3subArr: ch(L.P, L.L, L.N, L.Z), v3: ch(L.P, L.PT, L.VT, L.V, L.VL, L.N, L.Z), v3Arr: ch(L.P, L.L, L.PT, L.VT, L.V, L.VL, L.N, L.Z),
  v4: ch(L.P, L.N, L.Z), quat: ch(L.AA, L.AN, L.AX, L.Z), rot: ch(L.AA, L.AN, L.AX, L.Z), m33: ch(L.AX, L.Z), m44: ch(L.AX, L.Z), col: ch(L.C, L.Z), flt: ch(L.Z),
});
eq('label offset rotation', V.rotate, [[-5, -7], [-5, -7], [-7, 5], [-7, 5], [-7, 5], [-7, 5], [7, -5], [7, -5], [7, -5], [7, -5]]);
eq('data types', V.types, ['Bool', 'Vector3', 'Color4', 'Vector3', null, null]);
eq('dialog: unsupported type', V.unsupported, ['siErrCancelled', true, 1, false]);
eq('dialog: open', [V.open[0], V.open[1], V.open[2], V.open[3], V.open[4], V.open[5], V.open[6], V.open[7]], [true, 1,
  ['Points=2', 'Lines=11', 'Point Trails=3', 'Vector Trails=10', 'Vectors=1', 'Vectors + Length=8', 'Nulls=7', 'Numeric=0'], 'Vector 3D', PORT, true, ['Above', 'Below', 'Left', 'Right'], "NOTE: '#' in the label will be replaced by the item id for display."]);
eq('dialog: parameters', V.open[8], 'Applied,Port,Type,Show,DisplayMode,Label,ScaleFactor,UseColor,ColorR,ColorG,ColorB,ColorA,UseRange,RangeStart,RangeEnd,RangeStep,SkipDefault,SelectedOnly,OffsetX,OffsetY,LastPosition,Position,SubArray,ArrayStart,ArrayEnd,Global,DrawOnTop,ModifiedOnly,Percentage');
eq('dialog: rules at open (mode 0)', V.rulesAtOpen, [true, true, true, true, true, true, false, false]);
eq('dialog: rules after edits', V.rulesAfter, [false, false, false, false, true]);
eq('dialog: position change rotates the offset', V.posRotate, [-7, 5, 2, '-7', '5']);
eq('dialog: Apply', V.applied, [true, 2, true, true]);
const OKARGS = { ...DEF, Mode: 2, ClearLabel: true, Label: 'P#', Position: 2, OffsetX: -7, OffsetY: 5, UseColor: false, UseRange: true, SubArray: true };
eq('dialog: OK', [V.ok[0], JSON.parse(V.ok[1]), V.ok[2], V.ok[3], V.ok[4], V.ok[5]], [true, Object.fromEntries(Object.keys(JSON.parse(V.ok[1])).map(k => [k, OKARGS[k]])), true, 0, false, null]);
ok('dialog: no array row without array structure', V.noArrayRow);
eq('dialog: Cancel after Apply', V.cancelApplied, ['changed', true, 'in', false, JSON.stringify({ Port: PORT, Mode: 0, Label: 'in' }), 0]);
eq('dialog: Cancel without Apply', V.cancelPlain, [true, 0, 0]);
eq('dialog: Color4 in mode 6', V.color, [false, true, true, true]);
eq('dialog: no user session', V.batch, [true, 1, 0]);
eq('page errors', pageErrors, []);

console.log('fully wired      : ' + STATUS.full.join(', '));
console.log('partly wired     : ' + STATUS.partly.join(', ') + '  (script steps as in the contract; an open question or the low-level command / property page behind them is a stand-in that logs "not yet attested")');
console.log('stand-in         : ' + STATUS.standIn.join(', '));
if (fails.length) { console.log(`FAIL uixsi clips/display/addons commands: ${fails.length} of ${checks} checks`); for (const f of fails) console.log('  ' + f); process.exit(1); }
console.log(`OK uixsi clips/display/addons commands: ${checks} checks, ${NAMES.length} commands exercised`);
