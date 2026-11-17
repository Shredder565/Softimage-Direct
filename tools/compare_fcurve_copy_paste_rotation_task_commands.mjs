// CMD-B8c: the fcurve.dll task commands for animation copy / paste, the key clipboard, key selection, rotation
// conversion and sequencing on the command bus (src/commands/fcurveCopyPasteRotationTasks.ts, ...Anim.ts, ...Rot.ts,
// ...Shared.ts). Checked against the "Wire contract" sections of
// docs/ghidra/cmd-b8c-fcurve-copy-paste-rotation-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fcurve_copy_paste_rotation_task_commands.mjs
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

const NAMES = ['CopyAnimContainer', 'CopyAllAnimation', 'CopyAnimation', 'PasteAllAnimation', 'PasteAnimation', 'CopyKeys', 'CutKeys', 'DeleteKeys', 'PasteKeys',
  'SelectKeysInTimespan', 'DeselectAllKeys', 'ConvertEulerToQuat', 'ConvertQuatToEuler', 'MakeRotationsContinuous', 'Sequence', 'SISequence', 'ScaleAndOffset'];

// The registry entry of a name: the one handled by fcurve.dll (Sequence has three more entries in tasks.dll).
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n && (x.handler_dlls ?? []).includes('fcurve.dll'));
  return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('CopyAnimContainer') && !!window.Application?.fcurveCopyPasteRotation, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const app = window.Application; const S = app.fcurveCopyPasteRotation; const A = app.anim;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const run = (n, a = {}) => {
    S.lastStatus = null;
    try { const v = app.run(n, a); return { v: v === undefined ? null : v, st: hex(S.lastStatus?.status) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status) }; }
  };
  /** Status of a call: the thrown status, else the recorded task status. */
  const st = (n, a) => { const r = run(n, a); return r.status ?? r.st; };
  const mark = () => app.log.length;
  const nyaFrom = (i) => app.log.slice(i).filter(l => l.kind === 'info' && /not yet attested/.test(l.text)).length;
  const top = () => app.undoStack[app.undoStack.length - 1]?.label ?? null;   // the undo stack is capped, so steps are checked by label
  const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;

  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.undoable = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.undoable !== false]));

  // ================= default arguments on the sample scene, nothing selected, nothing marked
  app.select([]); A.marked.clear();
  out.defaults = {};
  for (const n of NAMES) { const r = run(n); out.defaults[n] = { err: !!r.err, status: r.status ?? r.st, v: r.v ?? null }; }

  // ================= fixture
  app.run('NewScene', {});
  const cube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'tCube' });
  const sph = app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'tSphere' });
  const nul = app.run('GetPrim', { PresetObj: 'Null', Name: 'tNull' });
  const kid = app.run('GetPrim', { PresetObj: 'Null', Name: 'tKid' });
  nul.addChild(kid);
  app.select([]); A.marked.clear(); A.frame = 1;
  const P = (o, n) => o.kinematics.local.get(n);
  const short = new Map();
  for (const o of [cube, sph, nul, kid]) for (const p of o.kinematics.local.params) short.set(p.fullName, `${o.name}.${p.name}`);
  const keys = (p) => { const fc = A.fcurves.get(p); return fc ? fc.keys.map(k => [r6(k.time), r6(k.value)]) : null; };
  const sel = () => [...A.selectedKeys].map(id => { const i = id.lastIndexOf('@'); return `${short.get(id.slice(0, i)) ?? id.slice(0, i)}@${r6(Number(id.slice(i + 1)))}`; }).sort();
  const setKeys = (p, list) => { A.removeAnimation(p); S.quatSources.delete(p); for (const [t, v] of list) A.setKey(p, t, v); };
  const wipe = () => { for (const o of [cube, sph, nul, kid]) for (const p of o.kinematics.local.params) { A.removeAnimation(p); S.quatSources.delete(p); } A.selectedKeys.clear(); S.keyClipboard.length = 0; S.animClipboard.length = 0; };
  const clipKeys = () => S.keyClipboard.map(r => [r.path, r.name, r.keys.map(k => [k.time, k.value]), r.start, r.end]);
  const cx = P(cube, 'posx'), cy = P(cube, 'posy'), cz = P(cube, 'posz');
  const sx = P(sph, 'posx'), sy = P(sph, 'posy'), sz = P(sph, 'posz');
  const X = 'tCube.kine.local.posx', Y = 'tCube.kine.local.posy';
  const base = () => { wipe(); setKeys(cx, [[1, 0], [10, 1], [20, 2], [30, 3]]); setKeys(cy, [[5, 5], [15, 6]]); };

  // ================= CopyKeys
  {
    const K = {}; out.copyKeys = K;
    base(); const u = app.undoStack.length;
    K.range = [st('CopyKeys', { InputObjs: X, StartFrame: 5, EndFrame: 25 }), clipKeys(), keys(cx), app.undoStack.length - u];
    run('CopyKeys', { InputObjs: Y, Reset: false }); K.noReset = clipKeys().map(r => r[0]);
    run('CopyKeys', { InputObjs: Y }); K.reset = clipKeys().map(r => r[0]);
    run('SelectKeysInTimespan', { InputObjs: X, StartFrame: 10, EndFrame: 10 });
    run('CopyKeys', { InputObjs: X, SelectedKeysOnly: true }); K.selectedOnly = clipKeys().map(r => r[2]);
    run('CopyKeys', { InputObjs: X, StartFrame: 40, EndFrame: 50 }); K.emptyRange = clipKeys().length;
    run('CopyKeys', { InputObjs: 'tSphere', Type: 3 }); K.type3 = clipKeys().map(r => r[0]).sort();
    run('CopyKeys', { InputObjs: 'tCube', Type: 2 }); K.type2NotExpanded = clipKeys().map(r => r[0]).sort();
    const m = mark(); run('CopyKeys', { InputObjs: X, CompensateForClip: true }); K.compensateNya = nyaFrom(m);
  }

  // ================= CutKeys / DeleteKeys
  {
    const C = {}; out.cut = C;
    base(); run('SelectKeysInTimespan', { InputObjs: X, StartFrame: 30, EndFrame: 30 });
    C.cut = [st('CutKeys', { InputObjs: X, StartFrame: 10, EndFrame: 20 }), keys(cx), clipKeys(), sel()];
    app.undo(); C.cutUndo = [keys(cx), sel()]; app.redo(); C.cutRedo = [keys(cx), sel()];
    base(); run('CopyKeys', { InputObjs: Y });
    C.del = [st('DeleteKeys', { InputObjs: X, StartFrame: 10, EndFrame: 20 }), keys(cx), clipKeys().map(r => r[0])];
    base(); run('CutKeys', { InputObjs: X, StartFrame: 10, EndFrame: 20, Ripple: false, PutKeysInBuffer: false, Reset: false }); C.cutNoRippleNoBuffer = [keys(cx), clipKeys().length];
    base(); run('DeleteKeys', { InputObjs: 'tCube', Type: 2, StartFrame: 1, EndFrame: 10 }); C.type2 = [keys(cx), keys(cy)];
    base(); run('DeleteKeys', { InputObjs: 'tSphere', Type: 3, StartFrame: 15, EndFrame: 100 }); C.type3 = [keys(cx), keys(cy)];
    base(); run('SelectKeysInTimespan', { InputObjs: X }); run('SelectKeysInTimespan', { InputObjs: X, Mode: 3, StartFrame: 10, EndFrame: 10 });
    run('DeleteKeys', { InputObjs: X, SelectedKeysOnly: true }); C.selectedOnly = [keys(cx), sel()];
    base(); C.nothingInRange = [st('DeleteKeys', { InputObjs: X, StartFrame: 40, EndFrame: 50 }), keys(cx)];
  }

  // ================= PasteKeys
  {
    const Pk = {}; out.paste = Pk;
    const paste = (a) => { const s = st('PasteKeys', a); return [s, S.out.PasteKeys?.Offset ?? null]; };
    base(); run('CopyKeys', { InputObjs: X, StartFrame: 1, EndFrame: 30 });
    const u = app.undoStack.length;
    Pk.noRange = [paste({ InputObjs: 'tSphere.kine.local.posx,tSphere.kine.local.posy', StartFrame: 101, EndFrame: 0, Ripple: false }), keys(sx), keys(sy), sel()];
    Pk.undoable = app.undoStack.length - u; app.undo(); Pk.undo = [keys(sx), keys(sy), sel()];
    Pk.fit = [paste({ InputObjs: 'tSphere.kine.local.posz', StartFrame: 1, EndFrame: 59, Ripple: false }), keys(sz)];
    setKeys(sz, [[50, 9], [200, 8]]);
    Pk.ripple = [paste({ InputObjs: 'tSphere.kine.local.posz', StartFrame: 100, EndFrame: 0, Ripple: true }), keys(sz)];
    setKeys(sz, [[5, 7], [50, 9], [300, 8]]); run('CopyKeys', { InputObjs: X });
    Pk.replace = [paste({ InputObjs: 'tSphere.kine.local.posz', Merge: false, Ripple: false }), keys(sz)];
    setKeys(sz, [[5, 7], [50, 9], [300, 8]]);
    Pk.merge = [paste({ InputObjs: 'tSphere.kine.local.posz', Ripple: false }), keys(sz)];
    setKeys(sz, [[12, 7], [300, 8]]); run('CopyKeys', { InputObjs: X, StartFrame: 1, EndFrame: 30 });
    Pk.replaceNoRange = [paste({ InputObjs: 'tSphere.kine.local.posz', Merge: false, Ripple: false, StartFrame: 1, EndFrame: 0 }), keys(sz)];
    setKeys(sz, [[1, 10]]);
    Pk.relative = [paste({ InputObjs: 'tSphere.kine.local.posz', StartFrame: 1, EndFrame: 0, Ripple: false, Relative: true }), keys(sz)];
    setKeys(sz, [[1, 100], [30, 200]]);
    Pk.continuity = [paste({ InputObjs: 'tSphere.kine.local.posz', StartFrame: 1, EndFrame: 0, Ripple: false, LeftContinuity: 1, RightContinuity: 2 }), keys(sz)];
    // several records: matched by parameter name
    wipe(); base(); run('CopyKeys', { InputObjs: X, StartFrame: 1, EndFrame: 30 }); run('CopyKeys', { InputObjs: Y, StartFrame: 1, EndFrame: 30, Reset: false });
    const all = 'tSphere.kine.local.posx,tSphere.kine.local.posy,tSphere.kine.local.posz';
    Pk.byName = [paste({ InputObjs: all, StartFrame: 51, EndFrame: 0, Ripple: false }), keys(sx), keys(sy), keys(sz)];
    wipe(); base(); run('CopyKeys', { InputObjs: X, StartFrame: 1, EndFrame: 30 }); run('CopyKeys', { InputObjs: Y, StartFrame: 5, EndFrame: 15, Reset: false });
    Pk.offsetsDiffer = [paste({ InputObjs: all, StartFrame: 51, EndFrame: 0, Ripple: false }), keys(sx), keys(sy)];
    S.keyClipboard.length = 0; setKeys(sz, [[1, 1]]);
    Pk.emptyClipboard = [paste({ InputObjs: 'tSphere.kine.local.posz' }), keys(sz)];
    wipe(); base(); run('CopyKeys', { InputObjs: X, StartFrame: 1, EndFrame: 30 });
    Pk.type3 = [paste({ InputObjs: 'tSphere.kine.local.posz', Type: 3, StartFrame: 101, EndFrame: 0, Ripple: false }), keys(cy), keys(sz)];
  }

  // ================= SelectKeysInTimespan / DeselectAllKeys
  {
    const L = {}; out.select = L;
    base(); const n0 = S.keySelectionChanged;
    L.setWhole = [st('SelectKeysInTimespan', { InputObjs: X }), sel()];
    run('SelectKeysInTimespan', { InputObjs: Y, Mode: 2, StartFrame: 5, EndFrame: 5 }); L.add = sel();
    run('SelectKeysInTimespan', { InputObjs: X, Mode: 3, StartFrame: 10, EndFrame: 20 }); L.remove = sel();
    run('SelectKeysInTimespan', { InputObjs: X, Mode: 4, StartFrame: 1, EndFrame: 10 }); L.toggle = sel();
    app.undo(); L.undo = sel(); app.redo(); L.redo = sel();
    run('SelectKeysInTimespan', { InputObjs: Y, StartFrame: 15, EndFrame: 100 }); L.setReplaces = sel();
    run('SelectKeysInTimespan', { InputObjs: Y, StartFrame: 15 }); L.oneEndEmpty = sel();
    run('SelectKeysInTimespan', { InputObjs: 'tCube', Type: 2, StartFrame: 1, EndFrame: 5 }); L.type2 = sel();
    run('SelectKeysInTimespan', { InputObjs: 'tSphere', Type: 3, StartFrame: 30, EndFrame: 30 }); L.type3 = sel();
    L.errors = [st('SelectKeysInTimespan', { InputObjs: X, Mode: 7 }), st('SelectKeysInTimespan', { InputObjs: X, Mode: 'bogus' }),
      st('SelectKeysInTimespan', { InputObjs: X, StartFrame: 'abc', EndFrame: 5 }), st('SelectKeysInTimespan', { InputObjs: X, StartFrame: 1, EndFrame: {} })];
    L.afterErrors = sel();
    L.deselect = [st('DeselectAllKeys'), sel()]; app.undo(); L.deselectUndo = sel();
    L.notified = S.keySelectionChanged - n0;
  }

  // ================= Sequence / SISequence / ScaleAndOffset
  {
    const Q = {}; out.seq = Q;
    base(); const u = app.undoStack.length;
    Q.identity = [st('ScaleAndOffset', { InputObjs: 'tCube' }), st('Sequence', {}), st('SISequence', { Offset: 1e-7, Scale: 1 + 1e-7 }), keys(cx), app.undoStack.length - u];
    Q.errors = [st('ScaleAndOffset', { InputObjs: 'tCube', Scale: 0, Offset: 5 }), st('ScaleAndOffset', { InputObjs: 'tCube', Offset: 5, Type: 9 }), st('Sequence', { Offset: 5, Type: 'bogus' }), keys(cx)];
    Q.scale = [st('ScaleAndOffset', { InputObjs: 'tCube', Scale: 2, StartFrame: 1, EndFrame: 10, Pivot: 1, Ripple: false }), keys(cx), keys(cy)];
    app.undo(); Q.undo = [keys(cx), keys(cy)]; app.redo(); Q.redo = keys(cx);
    base(); run('ScaleAndOffset', { InputObjs: 'tCube', Scale: 2, StartFrame: 1, EndFrame: 10, Pivot: 1 }); Q.ripple = [keys(cx), keys(cy)];
    base(); run('ScaleAndOffset', { InputObjs: 'tCube', Scale: 0.5, Offset: 3, StartFrame: 1, EndFrame: 30, Pivot: 11, Ripple: false }); Q.formula = keys(cx);
    base(); run('ScaleAndOffset', { InputObjs: 'tCube', Offset: 10, StartFrame: 1, EndFrame: 20, Ripple: false }); Q.collision = keys(cx);
    base(); run('SelectKeysInTimespan', { InputObjs: X, StartFrame: 10, EndFrame: 10 });
    run('ScaleAndOffset', { InputObjs: 'tCube', Offset: 2, SelectedKeysOnly: true, Ripple: false }); Q.selectedOnly = [keys(cx), keys(cy), sel()];
    base(); Q.layer = [st('ScaleAndOffset', { InputObjs: 'tCube', Offset: 2, Layer: 1 }), keys(cx), st('ScaleAndOffset', { InputObjs: 'tCube', Offset: 2, Layer: 0, Ripple: false }), keys(cx)];
    base(); Q.type1 = [st('SISequence', { InputObjs: X, Type: 1, Offset: 4, Ripple: false }), keys(cx), keys(cy)];
    base(); Q.nothing = st('ScaleAndOffset', { InputObjs: 'tSphere', Offset: 4 });
    base(); let m = mark(); Q.type3 = [st('Sequence', { Offset: 5, Ripple: false }), keys(cx), keys(cy), nyaFrom(m) >= 1];
    base(); m = mark(); run('SISequence', { InputObjs: X, Type: 1, Offset: 1, 'Discrete Time': true, Ripple: false }); Q.discreteNya = nyaFrom(m);
    base(); Q.type2Param = [st('Sequence', { InputObjs: 'tCube.kine.local', Type: ':siAnimParams:siSequenceType', Offset: 1, Ripple: false }), keys(cx), keys(cy)];
  }

  // ================= CopyAllAnimation / CopyAnimation / PasteAllAnimation / PasteAnimation
  {
    const N = {}; out.anim = N;
    const clip = () => S.animClipboard.map(r => [r.path, r.leaf, r.source.kind, r.layer]);
    const csx = P(cube, 'sclx');
    const fixture = () => { base(); A.setExpression(csx, 'Fc * 2', () => undefined); A.frame = 1; };
    fixture(); const u = app.undoStack.length;
    N.copyAll = [st('CopyAllAnimation', { InputObjs: 'tCube,tSphere' }), clip(), app.undoStack.length - u, keys(cx)];
    run('CopyAllAnimation', { InputObjs: 'tNull' }); N.nothingFoundKeeps = clip().length;
    run('CopyAllAnimation', { InputObjs: 'tCube', UseFCurves: false }); N.expressionsOnly = clip();
    run('CopyAllAnimation', { InputObjs: 'tCube', UseExpressions: false }); N.fcurvesOnly = clip().map(r => r[0]);
    run('CopyAllAnimation', { InputObjs: 'tCube', UseExpressions: false, UseFCurves: false }); N.neitherKeeps = clip().length;
    run('CopyAllAnimation', { InputObjs: 'tCube', RemoveAnimation: true }); N.removeAnimationUnused = [keys(cx) !== null, clip().length];
    run('CopyAllAnimation', { InputObjs: 'tCube', BaseAnimation: false }); N.baseOff = clip().length;
    app.select([cube]); run('CopyAllAnimation'); N.selectionDefault = clip().length; app.select([]);
    // paste by relative path on two objects; the clipboard can be pasted repeatedly
    const u2 = app.undoStack.length;
    N.pasteAll = [st('PasteAllAnimation', { InputObjs: 'tSphere,tNull' }), keys(sx), keys(sy), A.expression(P(sph, 'sclx')) ?? null, keys(P(nul, 'posx')), A.expression(P(nul, 'sclx')) ?? null, app.undoStack.length - u2];
    A.fcurves.get(sx).keys[0].value = 99; N.clipboardIndependent = [S.animClipboard[0].source.keys[0].value, keys(cx)[0][1]];
    app.undo(); N.pasteUndo = [keys(sx), A.expression(P(sph, 'sclx')) ?? null, keys(P(nul, 'posx'))];
    // a parameter copied by itself has an empty path: pasted on the target parameter itself
    fixture(); run('CopyAnimation', { InputObjs: X }); N.copyParam = clip();
    N.pasteParam = [st('PasteAnimation', { InputObjs: 'tSphere.kine.local.posz' }), keys(sz)];
    // nothing matches by name: positional paste (PasteAnimation default true), none with UsePosition false / PasteAllAnimation default
    fixture(); run('CopyAllAnimation', { InputObjs: 'tCube', UseExpressions: false });
    N.noPosition = [st('PasteAnimation', { InputObjs: 'tNull.kine.local.rotx', UsePosition: false }), keys(P(nul, 'rotx'))];
    N.position = [st('PasteAnimation', { InputObjs: 'tNull.kine.local.rotx' }), keys(P(nul, 'rotx'))];
    N.positionSet = [st('PasteAllAnimation', { InputObjs: 'tSphere.kine.local', UsePosition: true }), keys(sx), keys(sy), keys(sz)];
    wipe(); fixture(); run('CopyAllAnimation', { InputObjs: 'tCube', UseExpressions: false });
    N.pasteAllDefaultNoPosition = [st('PasteAllAnimation', { InputObjs: 'tSphere.kine.local' }), keys(sx)];
    // a parameter set as input: paths relative to it; the marked parameters are the default of CopyAnimation / PasteAnimation
    run('CopyAnimation', { InputObjs: 'tCube.kine.local', UseExpressions: false }); N.copySet = clip();
    N.pasteSet = [st('PasteAnimation', { InputObjs: 'tSphere.kine.local' }), keys(sx), keys(sy)];
    wipe(); fixture(); A.marked.add(cy); run('CopyAnimation'); A.marked.clear(); A.marked.add(sz); run('PasteAnimation'); A.marked.clear();
    N.marked = [clip(), keys(sz)];
    S.animClipboard.length = 0; S.animClipboard.push({ path: 'kine.local.posx', leaf: 'posx', source: { kind: 'fcurve', keys: [{ time: 1, value: 1 }], extrap: 1, interp: 3 }, layer: 2 });
    const m = mark(); N.layerRecord = [st('PasteAllAnimation', { InputObjs: 'tNull' }), keys(P(nul, 'posx')), nyaFrom(m)];
    N.emptyList = [st('CopyAllAnimation', { InputObjs: 'no_such_object' }), st('CopyAnimation'), st('PasteAnimation')];
  }

  // ================= CopyAnimContainer
  {
    const T = {}; out.container = T;
    base(); const m = mark();
    T.copy = [st('CopyAnimContainer', { InputObj: 'tCube.kine.local', Target: 'tSphere.kine.local,tNull.kine.local' }), keys(sx), keys(sy), keys(P(nul, 'posx')), keys(sz), nyaFrom(m) >= 1, top()];
    app.undo(); T.undo = [keys(sx), keys(P(nul, 'posx')), keys(cx)];
    T.object = [st('CopyAnimContainer', { InputObj: 'tCube', Target: 'tSphere' }), keys(sx)];
    T.errors = [st('CopyAnimContainer', {}), st('CopyAnimContainer', { InputObj: 'no_such_object', Target: 'tSphere' })];
    T.noTarget = st('CopyAnimContainer', { InputObj: 'tCube' });
    T.nothingToCopy = st('CopyAnimContainer', { InputObj: 'tKid', Target: 'tSphere' });
  }

  // ================= rotation commands
  {
    const R = {}; out.rot = R;
    const rx = P(cube, 'rotx'), ry = P(cube, 'roty'), rz = P(cube, 'rotz');
    const vals = (o) => ['rotx', 'roty', 'rotz'].map(n => r6(P(o, n).value));
    wipe(); setKeys(rx, [[1, 0], [10, 350], [20, 340], [30, 700]]); A.frame = 1;
    let m = mark();
    R.continuous = [st('MakeRotationsContinuous', { InputObjs: 'tCube' }), keys(rx), keys(ry), nyaFrom(m) >= 1, top()];
    app.undo(); R.continuousUndo = keys(rx); app.redo(); R.continuousRedo = keys(rx);
    wipe(); setKeys(rx, [[1, 0], [10, 180]]); setKeys(ry, [[1, 0], [10, 180]]); setKeys(rz, [[1, 0], [10, 180]]);
    run('MakeRotationsContinuous', { InputObjs: 'tCube' }); R.flip = [keys(rx), keys(ry), keys(rz)];
    wipe(); setKeys(rx, [[1, 10], [10, 20], [20, 30]]); setKeys(ry, [[10, 5]]);
    run('MakeRotationsContinuous', { InputObjs: 'tCube' }); R.unchanged = [keys(rx), keys(ry)];
    wipe(); setKeys(P(kid, 'rotz'), [[1, 0], [5, 370]]);
    R.branch = [st('MakeRotationsContinuous', { InputObjs: 'tNull' }), st('MakeRotationsContinuous', { InputObjs: 'B:tNull' }), keys(P(kid, 'rotz'))];
    wipe(); setKeys(P(kid, 'rotz'), [[1, 0], [5, 370]]); app.select([kid]);
    R.selection = [st('MakeRotationsContinuous'), keys(P(kid, 'rotz'))]; app.select([]);
    R.nothing = [st('MakeRotationsContinuous', { InputObjs: 'tSphere' }), st('ConvertEulerToQuat', {}), st('ConvertQuatToEuler', {})];

    // Euler -> quaternion: one shared quaternion source on outputs 0, 1, 2
    wipe(); setKeys(rx, [[1, 0], [11, 90]]); setKeys(ry, [[6, 40]]); A.frame = 1;
    const s1 = st('ConvertEulerToQuat', { InputObjs: 'tCube' });
    const links = [rx, ry, rz].map(p => S.quatSources.get(p));
    R.toQuat = [s1, [keys(rx), keys(ry), keys(rz)], links.map(l => l?.output ?? null), links.every(l => l && l.curve === links[0].curve),
      links[0]?.curve.keys.map(k => k.time), links[0]?.curve.keys.every(k => Math.abs(Math.hypot(...k.q) - 1) < 1e-9), top()];
    const at = (f) => { A.frame = f; return vals(cube); };
    R.quatDrives = [at(1), at(6), at(11), at(50)];
    const mid = at(8.5); R.quatMidIsBetween = mid[0] > 0 && mid[0] < 90 && Math.abs(mid[1] - 40) < 1e-3;
    A.frame = 1;
    R.toEuler = [st('ConvertQuatToEuler', { InputObjs: 'tCube' }), keys(rx), keys(ry), keys(rz), S.quatSources.size];
    app.undo(); R.toEulerUndo = [keys(rx), S.quatSources.size]; app.undo(); R.toQuatUndo = [keys(rx), keys(ry), keys(rz), S.quatSources.size];
    // no key at all: the current values become the constant of the quaternion source
    wipe(); A.fcurve(rx, true); rx.value = 30; ry.value = 20; rz.value = 10;
    run('ConvertEulerToQuat', { InputObjs: 'tCube' }); const c = S.quatSources.get(rx)?.curve;
    R.constant = [c?.keys.length ?? null, !!c?.constant, at(5)];
    R.constantToEuler = [st('ConvertQuatToEuler', { InputObjs: 'tCube' }), keys(rx), keys(ry), keys(rz), vals(cube)];
    wipe(); rx.value = 0; ry.value = 0; rz.value = 0;
    // an object without animation on the triple turns to the alternative triple (not in this build)
    setKeys(rx, [[1, 0], [11, 90]]); m = mark();
    R.unanimated = [st('ConvertEulerToQuat', { InputObjs: 'tSphere' }), nyaFrom(m) >= 1, st('ConvertEulerToQuat', { InputObjs: 'tCube,tSphere' }), S.quatSources.has(rx), S.quatSources.has(P(sph, 'rotx'))];
    // keys commands and copy of a quaternion-driven parameter
    m = mark(); run('CopyAllAnimation', { InputObjs: 'tCube' }); R.copyQuatNya = nyaFrom(m) >= 1;
    wipe(); setKeys(P(kid, 'rotx'), [[1, 0], [11, 90]]);
    R.branchConvert = [st('ConvertEulerToQuat', { InputObjs: 'B:tNull' }), S.quatSources.has(P(kid, 'rotx')), st('ConvertQuatToEuler', { InputObjs: 'B:tNull' }), keys(P(kid, 'rotx'))];
    wipe();
  }
  return out;
}, { NAMES });
await browser.close();

// ---------------------------------------------------------------- compare
let checks = 0; const diffs = [];
const show = (x) => JSON.stringify(x);
const eq = (what, a, b) => { checks++; if (show(a) !== show(b)) diffs.push(`${what}\n      got      ${show(a)}\n      expected ${show(b)}`); };
const ok = (what, cond, detail) => { checks++; if (!cond) diffs.push(`${what}${detail === undefined ? '' : `\n      got ${show(detail)}`}`); };
const NOTHING = '1', OKS = '0', FAIL = '80004005', INVALID = '80070057';
const norm = (l) => l && l.map(([n, d]) => [n, typeof d === 'number' ? Number(d) : d]);

// 1. registration
for (const n of NAMES) { ok(`${n}: in the registry dump (fcurve.dll entry)`, registry[n] !== null); eq(`${n}: registered with the registry's arguments and defaults`, norm(got.reg[n]), norm(registry[n])); }
eq('not undoable: CopyKeys, CopyAllAnimation, CopyAnimation', NAMES.filter(n => !got.undoable[n]), ['CopyAllAnimation', 'CopyAnimation', 'CopyKeys']);

// 2. default arguments on the sample scene, nothing selected
const D = got.defaults;
const expectDefault = {
  CopyAnimContainer: INVALID, CopyAllAnimation: NOTHING, CopyAnimation: NOTHING, PasteAllAnimation: NOTHING, PasteAnimation: NOTHING,
  CopyKeys: OKS, CutKeys: OKS, DeleteKeys: OKS, PasteKeys: OKS, SelectKeysInTimespan: OKS, DeselectAllKeys: OKS,
  ConvertEulerToQuat: FAIL, ConvertQuatToEuler: FAIL, MakeRotationsContinuous: FAIL, Sequence: NOTHING, SISequence: NOTHING, ScaleAndOffset: NOTHING,
};
for (const n of NAMES) {
  eq(`${n} with default arguments: status`, D[n].status, expectDefault[n]);
  eq(`${n} with default arguments: throws only where the contract says it fails; no return value`, [D[n].err, D[n].v], [[INVALID, FAIL].includes(expectDefault[n]), null]);
}

const X = 'tCube.kine.local.posx', Y = 'tCube.kine.local.posy';
const CX = [[1, 0], [10, 1], [20, 2], [30, 3]], CY = [[5, 5], [15, 6]];

// 3. CopyKeys
const K = got.copyKeys;
eq('CopyKeys: keys of [StartFrame, EndFrame] recorded with the range; fcurve untouched; not undoable', K.range, [OKS, [[X, 'posx', [[10, 1], [20, 2]], 5, 25]], CX, 0]);
eq('CopyKeys Reset false appends; Reset true empties first', [K.noReset, K.reset], [[X, Y], [Y]]);
eq('CopyKeys SelectedKeysOnly', K.selectedOnly, [[[10, 1]]]);
eq('CopyKeys: nothing in range leaves no record', K.emptyRange, 0);
eq('CopyKeys Type 3: every fcurve of the scene, InputObjs ignored', K.type3, [X, Y]);
eq('CopyKeys Type 2: no expansion to animated parameters (inputs as given)', K.type2NotExpanded, [X, Y]);
eq('CompensateForClip true is logged as not yet attested', K.compensateNya, 1);

// 4. CutKeys / DeleteKeys
const C = got.cut;
eq('CutKeys defaults: keys removed, later keys shifted by StartFrame - EndFrame - 1, removed keys in the clipboard, selection follows', C.cut,
  [OKS, [[1, 0], [19, 3]], [[X, 'posx', [[10, 1], [20, 2]], 10, 20]], ['tCube.posx@19']]);
eq('CutKeys undo / redo', [C.cutUndo, C.cutRedo], [[CX, ['tCube.posx@30']], [[[1, 0], [19, 3]], ['tCube.posx@19']]]);
eq('DeleteKeys defaults: no ripple, clipboard neither reset nor filled', C.del, [OKS, [[1, 0], [30, 3]], [Y]]);
eq('CutKeys with Ripple / PutKeysInBuffer / Reset off behaves as DeleteKeys', C.cutNoRippleNoBuffer, [[[1, 0], [30, 3]], 0]);
eq('DeleteKeys Type 2: an object is expanded to its animated parameters', C.type2, [[[20, 2], [30, 3]], [[15, 6]]]);
eq('DeleteKeys Type 3: every fcurve of the scene', C.type3, [[[1, 0], [10, 1]], [[5, 5]]]);
eq('DeleteKeys SelectedKeysOnly', C.selectedOnly, [[[10, 1]], []]);
eq('DeleteKeys: nothing in range is tolerated', C.nothingInRange, [OKS, CX]);

// 5. PasteKeys
const Pk = got.paste;
const shifted = (l, d) => l.map(([t, v]) => [t + d, v]);
eq('PasteKeys, EndFrame < StartFrame (no explicit range), one record: unscaled on every target, Offset = StartFrame - copied start, pasted keys selected', Pk.noRange,
  [[OKS, 100], shifted(CX, 100), shifted(CX, 100), ['tSphere.posx@101', 'tSphere.posx@110', 'tSphere.posx@120', 'tSphere.posx@130', 'tSphere.posy@101', 'tSphere.posy@110', 'tSphere.posy@120', 'tSphere.posy@130']]);
eq('PasteKeys is one undo step; undo removes the created fcurves and the selection', [Pk.undoable, Pk.undo], [1, [null, null, []]]);
eq('PasteKeys explicit range: time-scaled to fit about the centres (copied 1..30 -> 1..59)', Pk.fit, [[OKS, 14.5], [[1, 0], [19, 1], [39, 2], [59, 3]]]);
eq('PasteKeys Ripple: keys from StartFrame on pushed later by the paste span (copied end - start + 1)', Pk.ripple, [[OKS, 99], [[50, 9], [100, 0], [109, 1], [119, 2], [129, 3], [230, 8]]]);
eq('PasteKeys Merge false: existing keys of [StartFrame, EndFrame] removed first', Pk.replace, [[OKS, 0], [[1, 0], [10, 1], [20, 2], [30, 3], [300, 8]]]);
eq('PasteKeys Merge true keeps them', Pk.merge, [[OKS, 0], [[1, 0], [5, 7], [10, 1], [20, 2], [30, 3], [50, 9], [300, 8]]]);
eq('PasteKeys Merge false, no range, no ripple: the span of the pasted keys is cleared', Pk.replaceNoRange, [[OKS, 0], [[1, 0], [10, 1], [20, 2], [30, 3], [300, 8]]]);
eq('PasteKeys Relative: values shifted by (existing value at the first pasted key - first copied value)', Pk.relative, [[OKS, 0], [[1, 10], [10, 11], [20, 12], [30, 13]]]);
eq('PasteKeys LeftContinuity 1 = existing value, RightContinuity other = average', Pk.continuity, [[OKS, 0], [[1, 100], [10, 1], [20, 2], [30, 101.5]]]);
eq('PasteKeys, several records: pasted only on targets of the same parameter name', Pk.byName, [[OKS, 50], shifted(CX, 50), shifted(CY, 50), null]);
eq('PasteKeys Offset output is 0 when the fcurves got different offsets', Pk.offsetsDiffer, [[OKS, 0], shifted(CX, 50), shifted(CY, 46)]);
eq('PasteKeys with an empty key clipboard: status 0, nothing done', Pk.emptyClipboard, [[OKS, 0], [[1, 1]]]);
eq('PasteKeys Type 3: targets are the fcurves of the scene (one record: pasted on each), InputObjs ignored', Pk.type3, [[OKS, 100], [...CY, ...shifted(CX, 100)], null]);

// 6. key selection
const L = got.select;
eq('SelectKeysInTimespan defaults (set, empty range = whole curve)', L.setWhole, [OKS, ['tCube.posx@1', 'tCube.posx@10', 'tCube.posx@20', 'tCube.posx@30']]);
eq('Mode 2 adds', L.add, ['tCube.posx@1', 'tCube.posx@10', 'tCube.posx@20', 'tCube.posx@30', 'tCube.posy@5']);
eq('Mode 3 removes', L.remove, ['tCube.posx@1', 'tCube.posx@30', 'tCube.posy@5']);
eq('Mode 4 toggles', L.toggle, ['tCube.posx@10', 'tCube.posx@30', 'tCube.posy@5']);
eq('undo / redo of a key selection', [L.undo, L.redo], [['tCube.posx@1', 'tCube.posx@30', 'tCube.posy@5'], ['tCube.posx@10', 'tCube.posx@30', 'tCube.posy@5']]);
eq('Mode 1 deselects everything first', L.setReplaces, ['tCube.posy@15']);
eq('one empty end = whole curve', L.oneEndEmpty, ['tCube.posy@15', 'tCube.posy@5']);
eq('Type 2: object expanded to its animated parameters', L.type2, ['tCube.posx@1', 'tCube.posy@5']);
eq('Type 3: every fcurve of the scene', L.type3, ['tCube.posx@30']);
eq('Mode outside 1..4 and non-numeric frames: 0x80070057, selection untouched', [L.errors, L.afterErrors], [[INVALID, INVALID, INVALID, INVALID], ['tCube.posx@30']]);
eq('DeselectAllKeys clears; undo restores', [L.deselect, L.deselectUndo], [[OKS, []], ['tCube.posx@30']]);
ok('GK_KEYSELECTION_CHANGED broadcast at the end of every successful Do (9 calls)', L.notified === 9, L.notified);

// 7. Sequence family
const Q = got.seq;
eq('Scale ~1 and Offset ~0: status 1, nothing done, no undo step', Q.identity, [NOTHING, NOTHING, NOTHING, CX, 0]);
eq('Scale ~0 and a Type outside 1..3: 0x80004005', Q.errors, [FAIL, FAIL, FAIL, CX]);
eq('ScaleAndOffset (Type 2 default): keys of the range scaled about the pivot', Q.scale, [OKS, [[1, 0], [19, 1], [20, 2], [30, 3]], [[9, 5], [15, 6]]]);
eq('undo / redo', [Q.undo, Q.redo], [[CX, CY], [[1, 0], [19, 1], [20, 2], [30, 3]]]);
eq('Ripple: later keys follow the end of the range (inferred)', Q.ripple, [[[1, 0], [19, 1], [29, 2], [39, 3]], [[9, 5], [24, 6]]]);
eq('t -> (t - Pivot) * Scale + Pivot + Offset', Q.formula, [[9, 0], [13.5, 1], [18.5, 2], [23.5, 3]]);
eq('a moved key replaces an unmoved key at the same time', Q.collision, [[11, 0], [20, 1], [30, 2]]);
eq('SelectedKeysOnly: only selected keys move, the selection follows', Q.selectedOnly, [[[1, 0], [12, 1], [20, 2], [30, 3]], CY, ['tCube.posx@12']]);
eq('Layer > 0: nothing in this build (status 1); Layer 0 = base fcurve', Q.layer, [NOTHING, CX, OKS, shifted(CX, 2)]);
eq('SISequence Type 1: the inputs as given', Q.type1, [OKS, shifted(CX, 4), CY]);
eq('no fcurve transformed: status 1', Q.nothing, NOTHING);
eq('Sequence default Type 3: scene fcurves, the unread scene walk logged as not yet attested', Q.type3, [OKS, shifted(CX, 5), shifted(CY, 5), true]);
eq('Discrete Time true logged as not yet attested', Q.discreteNya, 1);
eq('Sequence Type as siAnimParams token on a parameter set', Q.type2Param, [OKS, shifted(CX, 1), shifted(CY, 1)]);

// 8. animation clipboard
const N = got.anim;
const ALL = [['kine.local.posx', 'posx', 'fcurve', 0], ['kine.local.posy', 'posy', 'fcurve', 0], ['kine.local.sclx', 'sclx', 'expression', 0]];
eq('CopyAllAnimation: first item only, records (relative path, leaf, source, layer 0); status 1; not undoable; source kept', N.copyAll, [NOTHING, ALL, 0, CX]);
eq('a copy that finds nothing keeps the clipboard', N.nothingFoundKeeps, 3);
eq('UseFCurves false: expressions only', N.expressionsOnly, [ALL[2]]);
eq('UseExpressions false: fcurves only', N.fcurvesOnly, ['kine.local.posx', 'kine.local.posy']);
eq('neither: nothing found, clipboard kept', N.neitherKeeps, 2);
eq('RemoveAnimation is not used by the worker', N.removeAnimationUnused, [true, 3]);
eq('BaseAnimation false: clipboard cleared, nothing recorded', N.baseOff, 0);
eq('CopyAllAnimation default InputObjs = selection', N.selectionDefault, 3);
eq('PasteAllAnimation: by relative path on every target, one undo step', N.pasteAll, [OKS, CX, CY, 'Fc * 2', CX, 'Fc * 2', 1]);
eq('pasted sources are duplicates (clipboard and source untouched by edits)', N.clipboardIndependent, [0, 0]);
eq('PasteAllAnimation undo', N.pasteUndo, [null, null, null]);
eq('CopyAnimation of a parameter: empty relative path', N.copyParam, [['', 'posx', 'fcurve', 0]]);
eq('PasteAnimation on a parameter: the target itself', N.pasteParam, [OKS, CX]);
eq('no match by name and UsePosition false: nothing pasted', N.noPosition, [NOTHING, null]);
eq('PasteAnimation default UsePosition true: records dealt onto the target parameters in order', N.position, [OKS, CX]);
eq('positional paste on a parameter set', N.positionSet, [OKS, CX, CY, null]);
eq('PasteAllAnimation default UsePosition false', N.pasteAllDefaultNoPosition, [NOTHING, null]);
eq('CopyAnimation of a parameter set: paths relative to it', N.copySet, [['posx', 'posx', 'fcurve', 0], ['posy', 'posy', 'fcurve', 0]]);
eq('PasteAnimation on a parameter set', N.pasteSet, [OKS, CX, CY]);
eq('CopyAnimation / PasteAnimation default InputObjs = marked parameters', N.marked, [[['', 'posy', 'fcurve', 0]], CY]);
eq('a record of layer > 0 is logged as not yet attested and not pasted', N.layerRecord, [NOTHING, null, 1]);
eq('empty input list: status 1', N.emptyList, [NOTHING, NOTHING, NOTHING]);

// 9. CopyAnimContainer
const T = got.container;
eq('CopyAnimContainer: container animation applied to every target (inferred matching, logged), one undo step', T.copy, [OKS, CX, CY, CX, null, true, 'CopyAnimContainer']);
eq('CopyAnimContainer undo', T.undo, [null, null, CX]);
eq('CopyAnimContainer with objects', T.object, [OKS, CX]);
eq('InputObj missing / unresolvable: 0x80070057', T.errors, [INVALID, INVALID]);
eq('no target / nothing collected: status 1', [T.noTarget, T.nothingToCopy], [NOTHING, NOTHING]);

// 10. rotation
const R = got.rot;
eq('MakeRotationsContinuous: each key becomes the equivalent triple closest to the previous key', R.continuous, [OKS, [[1, 0], [10, -10], [20, -20], [30, -20]], null, true, 'MakeRotationsContinuous']);
eq('MakeRotationsContinuous undo / redo', [R.continuousUndo, R.continuousRedo], [[[1, 0], [10, 350], [20, 340], [30, 700]], [[1, 0], [10, -10], [20, -20], [30, -20]]]);
eq('(180, 180, 180) after (0, 0, 0) is the same rotation: becomes (0, 0, 0)', R.flip, [[[1, 0], [10, 0]], [[1, 0], [10, 0]], [[1, 0], [10, 0]]]);
eq('already continuous keys are left alone', R.unchanged, [[[1, 10], [10, 20], [20, 30]], [[10, 5]]]);
eq('branch flag: children processed only with B:', R.branch, [FAIL, OKS, [[1, 0], [5, 10]]]);
eq('default InputObjs = selection', R.selection, [OKS, [[1, 0], [5, 10]]]);
eq('nothing processed: 0x80004005', R.nothing, [FAIL, FAIL, FAIL]);
eq('ConvertEulerToQuat: Euler fcurves removed, one quaternion source on outputs 0 / 1 / 2, one unit key per union key time, one undo step', R.toQuat,
  [OKS, [null, null, null], [0, 1, 2], true, [1, 6, 11], true, 'ConvertEulerToQuat']);
eq('the quaternion source drives X, Y, Z (an axis without a key keeps the last value used)', R.quatDrives, [[0, 40, 0], [0, 40, 0], [90, 40, 0], [90, 40, 0]]);
ok('between keys the rotation is interpolated', R.quatMidIsBetween === true);
eq('ConvertQuatToEuler: one standard fcurve per axis with a key per quaternion key', R.toEuler, [OKS, [[1, 0], [6, 0], [11, 90]], [[1, 40], [6, 40], [11, 40]], [[1, 0], [6, 0], [11, 0]], 0]);
eq('undo of both conversions', [R.toEulerUndo, R.toQuatUndo], [[null, 3], [[[1, 0], [11, 90]], [[6, 40]], null, 0]]);
eq('no key at all: the current values are the constant of the quaternion source', R.constant, [0, true, [30, 20, 10]]);
eq('... and ConvertQuatToEuler gives fcurves without keys holding the current values', R.constantToEuler, [OKS, [], [], [], [30, 20, 10]]);
eq('no animation on the triple: alternative triple not in this build (logged), object not converted; others still are', R.unanimated, [FAIL, true, OKS, true, false]);
ok('CopyAllAnimation of a quaternion-driven parameter is logged as not yet attested', R.copyQuatNya === true);
eq('ConvertEulerToQuat / ConvertQuatToEuler with a branch item', R.branchConvert, [OKS, true, OKS, [[1, 0], [11, 90]]]);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B8c fcurve copy / paste / key selection / rotation / sequence task commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8c fcurve copy / paste / key selection / rotation / sequence task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): CopyKeys, CutKeys, DeleteKeys, PasteKeys, SelectKeysInTimespan, DeselectAllKeys, CopyAllAnimation, CopyAnimation, PasteAllAnimation, PasteAnimation (base layer)');
console.log('   partly wired: CopyAnimContainer (Q1), Sequence / SISequence / ScaleAndOffset (Type 3 walk, Mode, Discrete Time, ripple passes), ConvertEulerToQuat / ConvertQuatToEuler / MakeRotationsContinuous (alternative triple Q8)');
