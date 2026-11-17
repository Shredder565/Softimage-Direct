// CMD-B8b: the animation layer, marking, expression, relative-value and source-connection task commands of
// fcurve.dll on the command bus (src/commands/fcurveLayerMarkingTasks.ts, fcurveLayerMarkingTasksExpr.ts).
// Checked against the "Wire contract" sections of docs/ghidra/cmd-b8b-fcurve-layers-marking-expr-binary.md and the
// registry dump data/command_registry.json. No XSIBATCH golden exists for the row, so this is a contract check.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fcurve_layer_marking_task_commands.mjs
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

const LAYER = ['GetCurrentAnimationLayer', 'SetCurrentAnimationLayer', 'GetNumberOfAnimationLayers', 'AddAnimationLayer', 'DeleteAnimationLayer',
  'DuplicateAnimationLayer', 'LockAnimationLayer', 'UnlockAnimationLayer', 'IsAnimationLayerLocked'];
const MARK = ['SetMarking', 'ClearMarking', 'AddToMarking', 'RemoveFromMarking', 'GetMarking'];
const EXPR = ['SetExpr', 'EditExpr', 'SetRelativeValues', 'GetNumRelativeValues', 'GetRelativeValue', 'RemoveRelativeValue', 'ConnectSource'];
const NAMES = [...LAYER, ...MARK, ...EXPR];

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const cs = reg.filter(c => c.scripting_name === n && (c.handler_dlls ?? []).includes('fcurve.dll'));
  return [n, cs[0] ? cs[0].args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ConnectSource') && !!window.Application?.fcurveLayerMarkingTasks, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.fcurveLayerMarkingTasks; const A = app.anim;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const run = (n, a = {}) => {
    S.lastStatus = null;
    try { const v = app.run(n, a); return { v, st: hex(S.lastStatus?.status) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status) }; }
  };
  let T = [];   // sub-tasks of the last st() call
  const st = (n, a) => { const r = run(n, a); T = S.subTasks.map(t => t.task); return r.status ?? r.st; };
  const val = (n, a) => { const r = run(n, a); return 'err' in r ? `threw:${r.status}` : r.v; };
  const mark = () => app.log.length;
  const logFrom = (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`);
  const has = (i, re) => logFrom(i).some(l => re.test(l));
  const tasks = () => T;
  const plain = (v) => v === undefined ? null : JSON.parse(JSON.stringify(v));

  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.undoable = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n).undoable !== false]));

  app.run('NewScene', {});
  app.Interactive = false;
  const cube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'tCube' });
  const sph = app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'tSphere' });
  const mcube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'mCube' });
  const model = app.run('CreateModel', { InputObj: [mcube], Name: 'M' });
  const model2 = app.run('CreateModel', { InputObj: [], Name: 'M2' });
  app.select([]);
  const root = app.scene.root;
  const names = (m) => S.layersOf(m).layers.map(l => l.name);
  const num = (a) => val('GetNumberOfAnimationLayers', a), cur = (a) => val('GetCurrentAnimationLayer', a);
  const kl = (o, n) => o.kinematics.local.get(n);

  // ---------------------------------------------------------------- defaults: every command, default arguments
  {
    const D = {}; const depth = app.undoStack.length;
    for (const n of NAMES) { const r = run(n, {}); D[n] = 'err' in r ? `threw:${r.status}` : `st:${r.st}`; }
    out.defaults = D;
    while (app.undoStack.length > depth) app.undo();
  }

  // ---------------------------------------------------------------- animation layers
  {
    const L = {}; out.layers = L;
    L.fresh = [num(), cur(), st('GetNumberOfAnimationLayers'), st('GetCurrentAnimationLayer'), S.layersOf().layers === A.layers, S.layersOf(null).model === root];

    L.add1 = [st('AddAnimationLayer'), num(), cur(), plain(A.layers[1]), tasks()];
    L.add2 = [st('AddAnimationLayer', { Name: 'A', MakeCurrent: false }), num(), cur(), names(), A.layers[2].trackName, tasks()];
    L.add3 = [st('AddAnimationLayer', { Name: 'B' }), names(), cur()];
    app.undo(); L.addUndo = [names(), cur()];
    app.redo(); L.addRedo = [names(), cur()];

    L.setSame = [st('SetCurrentAnimationLayer', { Layer: 2 }), tasks()];
    L.set0 = [st('SetCurrentAnimationLayer'), cur(), tasks()];
    let m = mark(); L.setBad = [st('SetCurrentAnimationLayer', { Layer: 9 }), cur(), has(m, /^error:SetCurrentAnimationLayer: invalid layer index .*message 0x27/)];
    L.setCreate = [st('SetCurrentAnimationLayer', { Layer: 5, CreateLayer: true }), num(), cur(), tasks()];
    app.undo(); L.setCreateUndo = [num(), cur()];
    const neg = run('SetCurrentAnimationLayer', { Layer: -1 }); L.setNegative = [neg.status, cur()];
    m = mark(); L.setTwoModels = [st('SetCurrentAnimationLayer', { InputObjs: 'M,Scene_Root', Layer: 3 }), cur(), cur({ InputObjs: 'M' }), has(m, /^info:WARNING : SetCurrentAnimationLayer: invalid layer index for M .*0x27/)];
    L.setNoDedupe = [st('SetCurrentAnimationLayer', { InputObjs: [model, model], Layer: 1, CreateLayer: true }), num({ InputObjs: 'M' }), tasks().filter(t => t === 'AddLayerClip').length];
    app.undo();

    // names ['', '', 'B', 'A'], current 3
    L.before = [names(), cur()];
    L.delTop = [st('DeleteAnimationLayer'), names(), cur(), tasks()];
    m = mark(); L.delBase = [st('DeleteAnimationLayer', { Layer: 0 }), names(), has(m, /^error:DeleteAnimationLayer: invalid layer index .*0x27/)];
    L.delRange = [st('DeleteAnimationLayer', { Layer: 7 }), names()];
    m = mark(); L.delMiddle = [st('DeleteAnimationLayer', { Layer: 1 }), names(), cur(), tasks(), has(m, /not yet attested: how the current layer index/)];
    app.undo(); L.delUndo = [names(), cur()]; app.redo();

    // names ['', 'B'], current 1
    m = mark(); L.dup = [st('DuplicateAnimationLayer'), names(), cur(), A.layers[1].trackParam8 === true, !!A.layers[2].trackParam8, tasks(), logFrom(m).filter(l => /DuplicateAnimationLayer: not yet attested.*Q4/.test(l)).length];
    m = mark(); L.dupBase = [st('DuplicateAnimationLayer', { Layer: 0 }), names(), has(m, /^error:DuplicateAnimationLayer: invalid layer index .*0x27/)];
    app.undo(); L.dupUndo = [names(), cur(), !!A.layers[1].trackParam8]; app.redo();

    // names ['', 'B', 'B'], current 2
    m = mark(); L.lockBase = [st('LockAnimationLayer', { Layer: 0 }), has(m, /^error:LockAnimationLayer: .*0x27/)];
    L.lock = [st('LockAnimationLayer'), A.layers.map(l => l.locked), tasks(), val('IsAnimationLayerLocked'), val('IsAnimationLayerLocked', { Layer: 1 })];
    m = mark(); L.lockAgain = [st('LockAnimationLayer'), has(m, /^info:WARNING : LockAnimationLayer: .* is already locked .*0x32/)];
    app.undo(); L.lockUndo = A.layers.map(l => l.locked); app.redo();
    L.unlock = [st('UnlockAnimationLayer'), A.layers.map(l => l.locked), tasks()];
    m = mark(); L.unlockAgain = [st('UnlockAnimationLayer'), has(m, /^info:WARNING : UnlockAnimationLayer: .* is already unlocked .*0x33/)];
    L.doLockArg = [st('UnlockAnimationLayer', { Layer: 1, DoLock: true }), A.layers[1].locked, st('LockAnimationLayer', { Layer: 1, DoLock: false }), A.layers[1].locked];
    m = mark(); L.lockRange = [st('LockAnimationLayer', { Layer: 9 }), has(m, /^error:LockAnimationLayer: invalid layer index .*0x27/)];
    S.canBeLocked = () => false; m = mark();
    const cant = run('LockAnimationLayer', { Layer: 1 }); L.cannot = [cant.status, A.layers[1].locked, has(m, /^error:LockAnimationLayer: .* cannot be locked .*0x34/)];
    S.canBeLocked = null;
    m = mark(); L.isBase = [val('IsAnimationLayerLocked', { Layer: 0 }), has(m, /^error:IsAnimationLayerLocked: .*0x27/)];
    m = mark(); L.isRange = [val('IsAnimationLayerLocked', { Layer: 7 }), has(m, /^error:IsAnimationLayerLocked: invalid layer index .*0x27/)];
    app.run('LockAnimationLayer', { Layer: 2 });
    m = mark(); L.isTwoModels = [val('IsAnimationLayerLocked', { InputObjs: 'Scene_Root,M', Layer: 2 }), has(m, /^info:WARNING : IsAnimationLayerLocked: more than one model; only Scene_Root .*0x36/)];
    app.run('UnlockAnimationLayer', { Layer: 2 });

    // model list normalisation: items give their model once
    const rootBefore = num();
    L.normalised = [st('AddAnimationLayer', { InputObjs: 'mCube.kine.local.posx,mCube,M', Name: 'N' }), names(model), cur({ InputObjs: 'mCube' }), num({ InputObjs: 'M' }), num() === rootBefore,
      S.layersFor('mCube').model.name, S.layersFor(kl(mcube, 'posx')).model.name, S.layersFor('tCube').model === root, names(model2)];
    m = mark(); L.getSeveral = [num({ InputObjs: 'M,Scene_Root' }), has(m, /not yet attested: which model the helper uses.*Q6/)];
    L.twoModels = [st('AddAnimationLayer', { InputObjs: 'M,M2', Name: 'T', MakeCurrent: false }), names(model), names(model2)];
    app.undo(); L.twoModelsUndo = [names(model), names(model2)];

    L.legacySmoke = window.__animateSurfaceSmoke?.().ok ?? null;
    L.undoStack = (() => { const n = app.undoStack.length; run('GetNumberOfAnimationLayers'); run('GetCurrentAnimationLayer'); run('IsAnimationLayerLocked'); return app.undoStack.length - n; })();
  }

  // ---------------------------------------------------------------- marking
  {
    const K = {}; out.marking = K;
    const marked = () => val('GetMarking') ?? [];
    A.marked.clear(); app.select([cube]);
    K.empty = [val('GetMarking'), st('GetMarking')];
    K.noString = [st('SetMarking'), st('AddToMarking'), st('RemoveFromMarking'), marked()];
    K.set = [st('SetMarking', { PathList: 'tCube.kine.local.posx,tCube.kine.local.posy' }), val('GetMarking'), st('GetMarking')];
    K.addRelative = [st('AddToMarking', { PathList: 'kine.local.rotx' }), marked()];
    K.addCompound = [st('AddToMarking', { PathList: 'tSphere.kine.local.pos' }), marked().length, marked().slice(-3)];
    K.addTwice = [st('AddToMarking', { PathList: 'tCube.kine.local.posx' }), marked().length];
    K.remove = [st('RemoveFromMarking', { PathList: 'tCube.kine.local.posx,tSphere.kine.local.pos' }), marked()];
    app.undo(); K.removeUndo = marked().length; app.redo(); K.removeRedo = marked();
    K.replace = [st('SetMarking', { PathList: kl(sph, 'sclx') }), marked()];
    K.setEmpty = [st('SetMarking', { PathList: '' }), marked()];
    app.undo(); K.setEmptyUndo = marked();
    K.clear = [st('ClearMarking'), marked(), val('GetMarking')];
    app.undo(); K.clearUndo = marked();
    const bad = run('SetMarking', { PathList: 'nosuch.kine.local.posx' }); K.bad = [bad.status, /0x9f/.test(bad.err ?? ''), marked()];
    let m = mark(); K.partlyMissing = [st('SetMarking', { PathList: 'tCube.kine.local.posz,nosuch.thing' }), marked(), has(m, /SetMarking: not yet attested: marking of "nosuch.thing".*Q2/)];
    K.array = [st('SetMarking', { PathList: [kl(cube, 'posx'), 'tSphere.kine.local.roty'] }), marked()];
    A.marked.clear(); app.select([]);
  }

  // ---------------------------------------------------------------- SetExpr / EditExpr
  {
    const X = {}; out.expr = X;
    const px = kl(cube, 'posx'), py = kl(cube, 'posy'), pz = kl(cube, 'posz'), rx = kl(cube, 'rotx');
    const ex = (p) => A.expression(p) ?? null;
    px.value = 2.5;
    let r = run('SetExpr', { InputObj: 'tCube.kine.local.posx' });
    X.valueText = [r.st, ex(px), r.v.Count, r.v.Item(0).definition, r.v.Item(0) === S.expressionOf(px), px.value];
    const again = app.run('SetExpr', { InputObj: px, ExprStr: '' }); X.untouched = [ex(px), again.Count, again.Item(0) === r.v.Item(0)];
    app.undo(); app.undo(); X.newUndo = [ex(px), px.value]; app.redo(); X.newRedo = ex(px);
    r = run('SetExpr', { InputObj: px, ExprStr: 'Fc * 2' }); A.frame = 7; X.replace = [ex(px), px.value, r.v.Item(0).definition]; A.frame = 1;
    app.undo(); X.replaceUndo = ex(px); app.redo(); X.replaceRedo = ex(px);

    const intP = [...(cube.primitive?.params ?? []), ...(cube.primitive?.operators ?? []).flatMap(o => o.params), ...cube.properties.flatMap(p => p.params)].find(p => (p.def.type === 'int' || p.def.type === 'bool') && p.def.animatable !== false && !A.fcurves.has(p));
    if (intP) { run('SetExpr', { InputObj: intP }); X.intText = [ex(intP) === String(Math.trunc(Number(intP.value))), /^-?\d+$/.test(ex(intP) ?? '')]; app.undo(); } else X.intText = null;
    const all = [...app.scene.allObjects()].flatMap(o => [...o.properties.flatMap(p => p.params), ...(o.primitive?.params ?? [])]);
    const noAnim = all.find(p => p.def.animatable === false && (p.def.type === 'int' || p.def.type === 'double'));
    const strP = all.find(p => p.def.type === 'string' || p.def.type === 'enum'); const strAnim = strP?.def.animatable; if (strP) strP.def.animatable = true;   // reach step 3 past the capability test
    let m = mark(); r = run('SetExpr', { InputObj: noAnim, ExprStr: '1' }); X.notAnimatable = noAnim ? [r.st, r.v.Count, ex(noAnim), has(m, /^info:WARNING : SetExpr: .* is not animatable .*0x2f/)] : null;
    m = mark(); r = run('SetExpr', { InputObj: strP, ExprStr: '1' }); X.notNumeric = strP ? [r.st, r.v.Count, ex(strP), logFrom(m).filter(l => /WARNING/.test(l)).length] : null; if (strP) strP.def.animatable = strAnim;
    A.setKey(py, 1, 3); m = mark(); r = run('SetExpr', { InputObj: [py, pz], ExprStr: '4' });
    X.fcurve = [r.v.Count, ex(py), ex(pz), A.fcurves.has(py), has(m, /^info:WARNING : SetExpr: tCube.kine.local.posy is driven by an fcurve .*0x2c/)];
    A.removeAnimation(py); A.removeAnimation(pz);
    A.marked.add(rx); r = run('SetExpr', { ExprStr: '3' }); X.marking = [r.v.Count, ex(rx)]; A.marked.clear(); A.removeAnimation(rx);
    m = mark(); r = run('SetExpr', { InputObj: pz, ExprStr: '((' }); X.rejected = [r.st, r.v.Count, ex(pz), has(m, /^info:WARNING : SetExpr: the definition "tCube.kine.local.posz = \(\(" was rejected \(0x80070057\)/)]; A.removeAnimation(pz);
    run('SetExpr', { InputObj: py, ExprStr: 'tCube.kine.local.posz' });
    m = mark(); run('SetExpr', { InputObj: pz, ExprStr: 'tCube.kine.local.posy' }); X.cycle = has(m, /^info:SetExpr: the expression creates a cycle \(message box: title message 0x2a.*text message 0x2b/);
    A.removeAnimation(pz); S.skipCycleCheck = true;
    m = mark(); run('SetExpr', { InputObj: pz, ExprStr: 'tCube.kine.local.posy' }); X.cycleOff = has(m, /creates a cycle/); S.skipCycleCheck = false;
    A.removeAnimation(pz); A.removeAnimation(py);
    m = mark(); r = run('SetExpr', { InputObj: 'tCube.kine.local.nosuch', ExprStr: '1' }); X.missing = [r.v.Count, has(m, /WARNING : SetExpr: no parameter/)];
    // the earlier callers
    r = run('AddExpr', { InputObj: 'tCube.kine.local.scly', ExprStr: 'Fc' }); X.addExpr = [ex(kl(cube, 'scly')), r.v?.Count ?? null]; A.removeAnimation(kl(cube, 'scly'));

    const n = app.undoStack.length; const opened = S.exprEditor?.opened ?? 0; m = mark();
    X.edit = [st('EditExpr', { InputObj: [px, 'tCube.kine.local.posy'] }), S.exprEditor.paths, S.exprEditor.opened - opened, app.undoStack.length - n, has(m, /EditExpr: not yet attested: the expression editor view/), ex(py)];
    run('EditExpr', { InputObj: 'tSphere.kine.local.posx' }); X.editReset = S.exprEditor.paths;
    A.removeAnimation(px);
  }

  // ---------------------------------------------------------------- relative values
  {
    const R = {}; out.rel = R;
    const dx = kl(sph, 'posx'), dy = kl(sph, 'posy'), ry = kl(cube, 'roty'), rz = kl(cube, 'rotz'), sx = kl(cube, 'sclx');
    const keys = (p) => S.linkOf(p).fcurve.keys.map(k => [k.time, k.value]);
    dx.value = 0; dy.value = 0;
    run('SetExpr', { InputObj: ry, ExprStr: 'l_fcv( tSphere.kine.local.posx )' });
    R.kind3 = [S.linkOf(ry).kind, S.linkOf(ry).driverPaths, S.interpolatorOf(ry), S.expressionOf(ry).exprKind];
    ry.value = 10; R.key1 = [st('SetRelativeValues', { InputObj: 'tCube.kine.local.roty' }), keys(ry), S.subTasks.map(t => t.task)];
    dx.value = 4; ry.value = 50; R.key2 = [st('SetRelativeValues', { InputObj: ry }), keys(ry)];
    dx.value = 0; A.frame = A.frame; const at0 = ry.value; dx.value = 2; A.frame = A.frame; const at2 = ry.value; dx.value = 4; A.frame = A.frame;
    R.driven = [at0, at2 > 10 && at2 < 50, ry.value];
    app.undo(); R.keyUndo = keys(ry); app.redo(); R.keyRedo = keys(ry);

    let m = mark(); run('SetExpr', { InputObj: rz, ExprStr: 'l_interp( tSphere.kine.local.posx, tSphere.kine.local.posy )' });
    R.kind4 = [S.linkOf(rz).kind, S.linkOf(rz).driverPaths, S.linkOf(rz).fcurve, has(m, /SetExpr: not yet attested: the interpolation of the multi-link expression/)];
    R.num0 = val('GetNumRelativeValues', { InputObj: rz });
    dx.value = 1; dy.value = 2; rz.value = 30; const s1 = st('SetRelativeValues', { InputObj: rz }); const t1 = S.subTasks.map(t => t.task);
    dx.value = 3; dy.value = 5; rz.value = 60; run('SetRelativeValues', { InputObj: rz });
    R.sets = [s1, t1, val('GetNumRelativeValues', { InputObj: 'tCube.kine.local.rotz' }), val('GetRelativeValue', { InputObj: rz }), val('GetRelativeValue', { InputObj: rz, Index: 1 })];
    const it = S.interpolatorOf(rz); R.interpolator = [val('GetNumRelativeValues', { InputObj: it }), val('GetRelativeValue', { InputObj: it, Index: 0 })];
    m = mark(); R.getRange = [val('GetRelativeValue', { InputObj: rz, Index: 5 }), st('GetRelativeValue', { InputObj: rz, Index: 5 }), has(m, /^error:GetRelativeValue: index 5 is out of range \(message 0x90/)];
    m = mark(); R.several = [val('GetRelativeValue', { InputObj: [rz, ry] }), has(m, /^info:WARNING : GetRelativeValue: more than one input; only tCube.kine.local.rotz is used \(message 0x3d/)];
    app.undo(); R.setsUndo = val('GetNumRelativeValues', { InputObj: rz }); app.redo();
    const n = app.undoStack.length;
    R.remove = [st('RemoveRelativeValue', { InputObj: rz }), val('GetNumRelativeValues', { InputObj: rz }), val('GetRelativeValue', { InputObj: rz }), app.undoStack.length - n];
    m = mark(); R.removeRange = [st('RemoveRelativeValue', { InputObj: rz, Index: 9 }), val('GetNumRelativeValues', { InputObj: rz }), has(m, /^error:RemoveRelativeValue: no set of relative values at index 9 \(message 0x90/)];
    const e = (n, arg) => { const r = run(n, arg); return [r.status ?? null, (r.err ?? '').match(/message (0x[0-9a-f]+)/)?.[1] ?? null]; };
    R.errors = {
      empty: [e('GetRelativeValue', {}), e('RemoveRelativeValue', {}), e('GetNumRelativeValues', {})],
      noExpr: [e('GetNumRelativeValues', { InputObj: sx }), e('GetRelativeValue', { InputObj: sx }), e('RemoveRelativeValue', { InputObj: sx })],
      notMulti: [e('GetNumRelativeValues', { InputObj: ry }), e('GetRelativeValue', { InputObj: ry }), e('RemoveRelativeValue', { InputObj: ry })],
    };
    // skipped: no expression; nothing: another expression kind; marking fallback
    run('SetExpr', { InputObj: sx, ExprStr: 'Fc' });
    R.others = [st('SetRelativeValues', { InputObj: [sx, kl(cube, 'scly')] }), S.subTasks.length, S.linkOf(sx)];
    A.marked.add(rz); dx.value = 7; R.marking = [st('SetRelativeValues'), val('GetNumRelativeValues', { InputObj: rz })]; A.marked.clear();
    A.removeAnimation(sx);
  }

  // ---------------------------------------------------------------- ConnectSource
  {
    const C = {}; out.connect = C;
    const ex = (p) => A.expression(p) ?? null;
    const src = kl(sph, 'rotx'), t1 = kl(cube, 'sclx'), t2 = kl(cube, 'scly'), t3 = kl(sph, 'posz');
    A.setKey(src, 1, 3); A.setKey(src, 10, 9); const fc = A.fcurve(src);
    run('SetExpr', { InputObj: t1, ExprStr: 'Fc' });
    C.fcurve = [st('ConnectSource', { Target: 'tCube.kine.local.sclx,tCube.kine.local.scly', InputObj: fc }), A.fcurve(t1) === fc, A.fcurve(t2) === fc, ex(t1), S.subTasks.map(t => t.task), S.subTasks[0].args.Type];
    app.undo(); C.fcurveUndo = [ex(t1), A.fcurves.has(t1), A.fcurves.has(t2)]; app.redo(); C.fcurveRedo = [A.fcurve(t1) === fc, ex(t1)];
    A.removeAnimation(t1); A.removeAnimation(t2);

    const coll = app.run('SetExpr', { InputObj: t1, ExprStr: 'Fc * 3' }); const eo = coll.Item(0);
    A.setKey(t3, 1, 1);
    C.expr = [st('ConnectSource', { Target: t3, InputObj: eo }), ex(t3), A.fcurves.has(t3), ex(t1), eo.parameter === t3, eo.definition, S.expressionOf(t3) === eo];
    A.frame = 4; C.exprDrives = t3.value; A.frame = 1;
    app.undo(); C.exprUndo = [ex(t3), A.fcurves.has(t3), ex(t1), eo.parameter === t1]; app.redo(); C.exprRedo = [ex(t3), ex(t1)];
    C.sameTarget = [st('ConnectSource', { Target: t3, InputObj: eo }), ex(t3)];

    A.setKey(t2, 1, 2); let m = mark();
    C.neither = [st('ConnectSource', { Target: t2, InputObj: 'not a source' }), A.fcurves.has(t2), ex(t2), has(m, /ConnectSource: not yet attested: a source that is neither/)];
    app.undo(); C.neitherUndo = A.fcurves.has(t2);
    C.noTarget = [st('ConnectSource', { InputObj: fc }), S.subTasks.length];
  }
  out.undoable.EditExprRuns = true;
  return plain(out);
}, { NAMES });
await browser.close();

let checks = 0; const diffs = [];
const show = (x) => JSON.stringify(x);
const eq = (what, a, b) => { checks++; if (show(a) !== show(b)) diffs.push(`${what}\n      got      ${show(a)}\n      expected ${show(b)}`); };
const ok = (what, cond, detail) => { checks++; if (!cond) diffs.push(`${what}${detail === undefined ? '' : `\n      got ${show(detail)}`}`); };
const NOTHING = '1', OKS = '0', FAIL = '80004005', INVALID = '80070057';

// 1. registration
for (const n of NAMES) { ok(`${n}: in the registry dump (fcurve.dll)`, registry[n] !== null); eq(`${n}: registered with the contract's arguments and defaults`, got.reg[n], registry[n]); }
for (const n of ['GetCurrentAnimationLayer', 'GetNumberOfAnimationLayers', 'IsAnimationLayerLocked', 'GetMarking', 'EditExpr', 'GetNumRelativeValues', 'GetRelativeValue', 'RemoveRelativeValue'])
  eq(`${n}: nothing to undo`, got.undoable[n], false);

// 2. default arguments on the sample scene
const D = got.defaults;
for (const n of NAMES) {
  const want = ['GetRelativeValue', 'RemoveRelativeValue', 'GetNumRelativeValues'].includes(n) ? `threw:${INVALID}`
    // run in list order on a new scene: AddAnimationLayer has made layer 1 current when DeleteAnimationLayer runs; after it the base layer is current
    : ['DuplicateAnimationLayer', 'LockAnimationLayer', 'UnlockAnimationLayer', 'SetMarking', 'AddToMarking', 'RemoveFromMarking', 'GetMarking'].includes(n) ? `st:${NOTHING}` : `st:${OKS}`;
  eq(`${n} with default arguments`, D[n], want);
}

// 3. animation layers
const L = got.layers;
eq('fresh scene: one layer (the base layer), current 0, status 0; the scene root set is app.anim.layers', L.fresh, [1, 0, OKS, OKS, true, true]);
eq('AddAnimationLayer defaults: new layer above the current one, track "LayerTrack1", made current; sub-tasks', L.add1,
  [OKS, 2, 1, { name: '', locked: false, trackName: 'LayerTrack1' }, ['AddTrack', 'AddLayerClip', 'SetCurrentAnimationLayer', 'SetValue']]);
eq('AddAnimationLayer Name, MakeCurrent false: index min(current + 1, count), track "<Name>Track", current kept', L.add2, [OKS, 3, 1, ['', '', 'A'], 'ATrack', ['AddTrack', 'AddLayerClip']]);
eq('AddAnimationLayer goes directly above the current layer', L.add3, [OKS, ['', '', 'B', 'A'], 2]);
eq('AddAnimationLayer undo / redo', [L.addUndo, L.addRedo], [[['', '', 'A'], 1], [['', '', 'B', 'A'], 2]]);
eq('SetCurrentAnimationLayer on the current layer: done, no SetValue', L.setSame, [OKS, []]);
eq('SetCurrentAnimationLayer default Layer 0', L.set0, [OKS, 0, ['SetValue']]);
eq('SetCurrentAnimationLayer beyond the count: status 1, error message 0x27, nothing changed', L.setBad, [NOTHING, 0, true]);
eq('SetCurrentAnimationLayer CreateLayer: missing layers created one at a time with AddLayerClip', L.setCreate, [OKS, 6, 5, ['AddLayerClip', 'AddLayerClip', 'SetValue']]);
eq('SetCurrentAnimationLayer undo', L.setCreateUndo, [4, 0]);
eq('SetCurrentAnimationLayer Layer < 0: 0x80070057', L.setNegative, [INVALID, 0]);
eq('SetCurrentAnimationLayer on two models, one invalid: status 0, 0x27 as a warning', L.setTwoModels, [OKS, 3, 0, true]);
eq('SetCurrentAnimationLayer does not de-duplicate its models (second pass finds the layer present)', L.setNoDedupe, [OKS, 2, 1]);
eq('layers before the delete checks', L.before, [['', '', 'B', 'A'], 3]);
eq('DeleteAnimationLayer default (-1 = current), topmost: current moved down first, track deleted', L.delTop, [OKS, ['', '', 'B'], 2, ['SetCurrentAnimationLayer', 'SetValue', 'DeleteObj']]);
eq('DeleteAnimationLayer base layer: invalid index, error 0x27', L.delBase, [NOTHING, ['', '', 'B'], true]);
eq('DeleteAnimationLayer index >= count: invalid', L.delRange, [NOTHING, ['', '', 'B']]);
eq('DeleteAnimationLayer middle layer: no SetCurrentAnimationLayer sub-task; current index follows its layer (inferred, logged)', L.delMiddle, [OKS, ['', 'B'], 1, ['DeleteObj'], true]);
eq('DeleteAnimationLayer undo', L.delUndo, [['', '', 'B'], 2]);
eq('DuplicateAnimationLayer: copy above the source, source track parameter 8 set, copy made current; open parts logged (Q4)', L.dup,
  [OKS, ['', 'B', 'B'], 2, true, false, ['{42eb14da-bcab-4e24-bee6-b8a0bb496c3a}', 'SetValue', 'SetCurrentAnimationLayer', 'SetValue'], 2]);
eq('DuplicateAnimationLayer base layer: invalid index', L.dupBase, [NOTHING, ['', 'B', 'B'], true]);
eq('DuplicateAnimationLayer undo', L.dupUndo, [['', 'B'], 1, false]);
eq('LockAnimationLayer Layer 0: error 0x27, status 1', L.lockBase, [NOTHING, true]);
eq('LockAnimationLayer default (current layer): Lock sub-task; IsAnimationLayerLocked', L.lock, [OKS, [false, false, true], ['Lock'], true, false]);
eq('LockAnimationLayer on a locked layer: warning 0x32, status 1', L.lockAgain, [NOTHING, true]);
eq('LockAnimationLayer undo', L.lockUndo, [false, false, false]);
eq('UnlockAnimationLayer (DoLock default false)', L.unlock, [OKS, [false, false, false], ['Unlock']]);
eq('UnlockAnimationLayer on an unlocked layer: warning 0x33, status 1', L.unlockAgain, [NOTHING, true]);
eq('one class: the two commands differ only by the DoLock default', L.doLockArg, [OKS, true, OKS, false]);
eq('LockAnimationLayer index >= count: error 0x27, status 1', L.lockRange, [NOTHING, true]);
eq('CanBeLocked says no: error 0x34, 0x80004005, nothing changed', L.cannot, [FAIL, false, true]);
eq('IsAnimationLayerLocked Layer 0: false, error 0x27', L.isBase, [false, true]);
eq('IsAnimationLayerLocked index >= count: false, error 0x27', L.isRange, [false, true]);
eq('IsAnimationLayerLocked several models: first only, warning 0x36', L.isTwoModels, [true, true]);
eq('model list normalisation: parameter, object and model of one model give that model once; per-model sets', L.normalised, [OKS, ['', 'N'], 1, 2, true, 'M', 'M', true, ['']]);
eq('GetNumberOfAnimationLayers with several items: first item (inferred, Q6 logged)', L.getSeveral, [2, true]);
eq('AddAnimationLayer on two models; undo', [L.twoModels, L.twoModelsUndo], [[OKS, ['', 'N', 'T'], ['', 'T']], [['', 'N'], ['']]]);
eq('the Animate surface smoke (AddAnimationLayer / GetNumberOfAnimationLayers / DeleteAnimationLayer) still passes', L.legacySmoke, true);
eq('the three query commands leave the undo stack alone', L.undoStack, 0);

// 4. marking
const K = got.marking;
const P = (o, ...ns) => ns.map(n => `${o}.kine.local.${n}`);
eq('GetMarking with no marking: nothing written, Do answers 1', K.empty, [null, NOTHING]);
eq('Set / Add / RemoveFromMarking without a PathList: status 1, nothing changed', K.noString, [NOTHING, NOTHING, NOTHING, []]);
eq('SetMarking replaces the marking; GetMarking returns the paths as an array', K.set, [OKS, P('tCube', 'posx', 'posy'), NOTHING]);
eq('AddToMarking: union; path relative to the selection (inferred, Q2)', K.addRelative, [OKS, P('tCube', 'posx', 'posy', 'rotx')]);
eq('AddToMarking: kinematics compound (inferred)', K.addCompound, [OKS, 6, P('tSphere', 'posx', 'posy', 'posz')]);
eq('AddToMarking of a marked parameter: no duplicate', K.addTwice, [OKS, 6]);
eq('RemoveFromMarking', K.remove, [OKS, P('tCube', 'posy', 'rotx')]);
eq('RemoveFromMarking undo (previous marking) / redo', [K.removeUndo, K.removeRedo], [6, P('tCube', 'posy', 'rotx')]);
eq('SetMarking with a parameter object', K.replace, [OKS, P('tSphere', 'sclx')]);
eq('SetMarking "": the marking is cleared (same task as ClearMarking); undo', [K.setEmpty, K.setEmptyUndo], [[OKS, []], P('tSphere', 'sclx')]);
eq('ClearMarking (PathList default ""); undo', [K.clear, K.clearUndo], [[OKS, [], null], P('tSphere', 'sclx')]);
eq('SetMarking naming no parameter: 0x80070057, message 0x9f, marking kept', K.bad, [INVALID, true, P('tSphere', 'sclx')]);
eq('SetMarking with one unknown path: the known one is marked, the other logged (Q2)', K.partlyMissing, [OKS, P('tCube', 'posz'), true]);
eq('SetMarking with a list of object references and paths', K.array, [OKS, ['tCube.kine.local.posx', 'tSphere.kine.local.roty']]);

// 5. SetExpr / EditExpr
const X = got.expr;
eq('SetExpr without ExprStr on a parameter with no expression: value at the current time, "%f"; definition "<path> = <text>"; ExprObj', X.valueText,
  [OKS, '2.500000', 1, 'tCube.kine.local.posx = 2.500000', true, 2.5]);
eq('SetExpr without ExprStr on an existing expression: definition untouched, same object returned', X.untouched, ['2.500000', 1, true]);
eq('SetExpr undo of a new expression: source removed, value written back; redo', [X.newUndo, X.newRedo], [[null, 2.5], '2.500000']);
eq('SetExpr on an existing expression: object reused with the new definition, evaluated', X.replace, ['Fc * 2', 14, 'tCube.kine.local.posx = Fc * 2']);
eq('SetExpr undo puts the previous definition back; redo', [X.replaceUndo, X.replaceRedo], ['2.500000', 'Fc * 2']);
if (X.intText !== null) eq('SetExpr value text of a non-real numeric parameter: "%d"', X.intText, [true, true]); else ok('an integer parameter exists on the sample cube', false);
if (X.notAnimatable !== null) eq('SetExpr on a non-animatable parameter: warning 0x2f, skipped', X.notAnimatable, [OKS, 0, null, true]); else ok('a non-animatable numeric parameter exists', false);
if (X.notNumeric !== null) eq('SetExpr on a non-numeric parameter: skipped silently', X.notNumeric, [OKS, 0, null, 0]); else ok('a non-numeric parameter exists', false);
eq('SetExpr on a parameter with an fcurve: warning 0x2c, that parameter only is skipped', X.fcurve, [1, null, '4', true, true]);
eq('SetExpr without InputObj: the marked parameters', X.marking, [1, '3']);
eq('SetExpr: a rejected definition (0x80070057) is tolerated', X.rejected, [OKS, 1, '((', true]);
eq('SetExpr: a cycle that appears with the change is reported (message box 0x2a / 0x2b)', X.cycle, true);
eq('SetExpr: no cycle test when the preference switches it off', X.cycleOff, false);
eq('SetExpr on an unknown path: nothing', X.missing, [0, true]);
eq('AddExpr (menu "Set Expression...") still reaches SetExpr', X.addExpr, ['Fc', 1]);
eq('EditExpr: the editor is opened on all given parameters; no scene change, not undoable; the view is a stand-in (logged)', X.edit,
  [OKS, ['tCube.kine.local.posx', 'tCube.kine.local.posy'], 1, 0, true, null]);
eq('EditExpr resets the view first', X.editReset, ['tSphere.kine.local.posx']);

// 6. relative values
const R = got.rel;
eq('l_fcv( driver ): expression kind 3, one driver, a link fcurve, no interpolator', R.kind3, [3, ['tSphere.kine.local.posx'], null, 3]);
eq('SetRelativeValues kind 3: SaveKey on the link fcurve at x = driver value, y = driven value', R.key1, [OKS, [[0, 10]], ['SaveKey']]);
eq('SetRelativeValues second key', R.key2, [OKS, [[0, 10], [4, 50]]]);
eq('the link fcurve drives the parameter from the driver value', R.driven, [10, true, 50]);
eq('SetRelativeValues undo / redo', [R.keyUndo, R.keyRedo], [[[0, 10]], [[0, 10], [4, 50]]]);
eq('l_interp( d1, d2 ): expression kind 4 with an interpolator; its interpolation is logged as not attested', R.kind4, [4, ['tSphere.kine.local.posx', 'tSphere.kine.local.posy'], null, true]);
eq('GetNumRelativeValues on a new interpolator', R.num0, 0);
eq('SetRelativeValues kind 4 appends a set; GetNumRelativeValues; GetRelativeValue = [driven, drivers in order]', R.sets,
  [OKS, ['{ecebf698-1af5-4c04-aa46-46119a508f10}'], 2, [30, 1, 2], [60, 3, 5]]);
eq('the interpolator object itself as InputObj', R.interpolator, [2, [30, 1, 2]]);
eq('GetRelativeValue Index >= count: message 0x90, status 1, no value', R.getRange, [null, NOTHING, true]);
eq('GetRelativeValue with several inputs: first used, warning 0x3d', R.several, [[30, 1, 2], true]);
eq('SetRelativeValues (kind 4) undo', R.setsUndo, 1);
eq('RemoveRelativeValue default Index 0; not undoable', R.remove, [OKS, 1, [60, 3, 5], 0]);
eq('RemoveRelativeValue with no such set: message 0x90, status 1', R.removeRange, [NOTHING, 1, true]);
eq('empty input: 0x80070057, message 0x3eb', R.errors.empty, [[INVALID, '0x3eb'], [INVALID, '0x3eb'], [INVALID, '0x3eb']]);
eq('parameter without an expression: 0x80070057, message 0x8e', R.errors.noExpr, [[INVALID, '0x8e'], [INVALID, '0x8e'], [INVALID, '0x8e']]);
eq('expression that is not a multi-link: 0x80070057, message 0x8f', R.errors.notMulti, [[INVALID, '0x8f'], [INVALID, '0x8f'], [INVALID, '0x8f']]);
eq('SetRelativeValues: other expression kinds and parameters without an expression are left alone', R.others, [OKS, 0, null]);
eq('SetRelativeValues without InputObj: the marked parameters (inferred)', R.marking, [OKS, 2]);

// 7. ConnectSource
const C = got.connect;
eq('ConnectSource with an fcurve: RemoveAnimation (type 4) per target first, then the fcurve is attached', C.fcurve, [OKS, true, true, null, ['RemoveAnimation', 'RemoveAnimation'], 4]);
eq('ConnectSource undo / redo', [C.fcurveUndo, C.fcurveRedo], [['Fc', false, false], [true, null]]);
eq('ConnectSource with an expression object: told the target path, released from its former parameter (inferred), attached', C.expr,
  [OKS, 'Fc * 3', false, null, true, 'tSphere.kine.local.posz = Fc * 3', true]);
eq('the connected expression drives the target', C.exprDrives, 12);
eq('ConnectSource (expression) undo / redo', [C.exprUndo, C.exprRedo], [[null, true, 'Fc * 3', true], ['Fc * 3', null]]);
eq('ConnectSource of an expression onto its own parameter', C.sameTarget, [OKS, 'Fc * 3']);
eq('ConnectSource with neither an fcurve nor an expression: the old source is removed, nothing attached, still succeeds', C.neither, [OKS, false, null, true]);
eq('ConnectSource (neither) undo', C.neitherUndo, true);
eq('ConnectSource without targets: nothing', C.noTarget, [OKS, 0]);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B8b animation layer / marking / expression / relative value / source task commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8b animation layer / marking / expression / relative value / source task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): Get/SetCurrentAnimationLayer, GetNumberOfAnimationLayers, AddAnimationLayer, DeleteAnimationLayer, Lock/UnlockAnimationLayer, IsAnimationLayerLocked, GetMarking, GetNumRelativeValues, GetRelativeValue, RemoveRelativeValue');
console.log('   partly wired: DuplicateAnimationLayer (Q4), Set/Clear/AddTo/RemoveFromMarking (relative paths, Q2), SetExpr (locks, class Q5, model delta), EditExpr (stand-in editor), SetRelativeValues (multi-link interpolation, Q7), ConnectSource (model delta)');
