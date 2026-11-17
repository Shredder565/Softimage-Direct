// CMD-B8a: the fcurve / key task commands on the command bus (src/commands/fcurveKeyTasks.ts,
// fcurveKeyTasksCurves.ts, fcurveKeyTasksShared.ts). Checked against the "Wire contract" sections, "Shared facts"
// and the addendum of docs/ghidra/cmd-b8a-fcurve-keys-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check. The parts the note leaves open are driven
// through the seams of `app.fcurveKeyTasks` (legacyDefaultList, layers, layerKeyRefused, noLayerMixerEntry, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fcurve_key_task_commands.mjs
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

const NAMES = ['IsAnimated', 'GetSource', 'EvalFCurve', 'GetFCurveInfo', 'GetKeyInfo', 'AddFCurve', 'SetCurveType', 'SaveKey', 'SaveKeyOnKeyable',
  'SaveKeyOnMarkedKeyable', 'RemoveKey', 'RemoveKeyOnKeyable', 'RemoveKeyOnMarkedKeyable', 'NextKey', 'PrevKey', 'FirstKey', 'LastKey', 'SaveActionKey',
  'ActivateFCurve', 'ActivateFCurveOnKeyable', 'ActivateFCurveOnMarkedKeyable', 'RemoveAnimation'];
// Names whose bus entry is the CMD-B6a script wrapper; the native entry of this row sits behind it.
const WRAPPED = ['SaveKeyOnMarkedKeyable', 'SaveActionKey'];
// Native command GUIDs of the names that are in the registry twice (note 2.1).
const NATIVE_GUID = { SaveKey: '27e3f6ca-9ec4-11d3-8107-00a0c9ac19a9', SaveKeyOnKeyable: '89a18a33-899d-4a9e-8e82-ea02843320e5',
  SaveKeyOnMarkedKeyable: '1922f6c3-3882-49bd-a15b-fc7e66c07e51', SaveActionKey: '17383407-4517-11d3-b88c-00a0c92469be' };

// The native registry entry of a name: input and output arguments (the return value, flag 0x200, is not an argument here).
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n && (NATIVE_GUID[n] ? x.guid === NATIVE_GUID[n] : true));
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ActivateFCurve') && !!window.Application?.fcurveKeyTasks, null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, WRAPPED }) => {
  const app = window.Application; const S = app.fcurveKeyTasks; const A = app.anim;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const pub = (v) => v === undefined ? '<none>' : v === Infinity ? '+inf' : v === -Infinity ? '-inf' : v;
  /** Run a command: returned value, recorded task status, thrown status. */
  const exec = (f) => {
    S.lastStatus = null;
    try { const v = f(); return { v: pub(v), st: hex(S.lastStatus?.status) }; }
    catch (e) { return { err: String(e?.message ?? e).slice(0, 60), status: hex(e?.status) }; }
  };
  const run = (n, a = {}) => exec(() => app.run(n, a));
  /** Run the native entry of a name directly (for the two names whose bus entry is the script wrapper). */
  const native = (n, a = {}) => exec(() => { const d = S.native[n]; const full = {}; for (const x of d.args) full[x.name] = a[x.name] !== undefined ? a[x.name] : x.default; return d.execute(app, full); });
  const st = (n, a) => { const r = run(n, a); return r.status ?? r.st; };
  const markM = () => S.messages.length;
  const short = (n) => n.replace(/^Scene\.Scene_Root\./, '').replace('.Kinematics.Local.', '.kine.local.');
  const msgs = (i) => S.messages.slice(i).map(m => [m.command, hex(m.id), m.severity, m.names.map(short)]);
  const ids = (i) => S.messages.slice(i).map(m => hex(m.id));
  const markL = () => app.log.length;
  const nya = (i, re) => app.log.slice(i).some(l => /not yet attested/.test(l.text) && re.test(l.text));
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const keys = (p, layer = 0) => ((layer ? S.layerCurves.get(layer)?.get(p) : A.fcurves.get(p))?.keys ?? []).map(k => [r4(k.time), r4(k.value)]);
  const has = (p) => A.fcurves.has(p);

  out.reg = Object.fromEntries(NAMES.map(n => { const d = WRAPPED.includes(n) ? S.native[n] : app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.onBus = NAMES.filter(n => app.commands.has(n)).length;
  out.natives = Object.keys(S.native).sort();
  out.busIsNative = NAMES.filter(n => app.commands.get(n) === S.native[n]).sort();
  out.wrapperCallsNative = WRAPPED.map(n => app.uixsiKeysSourcesMaterials?.native?.[n] === S.native[n]);

  app.run('NewScene', {});
  const cube = app.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'tCube' });
  const sph = app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'tSphere' });
  const kid = app.run('GetPrim', { PresetObj: 'Null', Name: 'tKid' });
  app.run('ParentObj', { Parent: 'tCube', Child: 'tKid' });
  out.kidParent = kid.parentObj?.name ?? null;
  const L = cube.kinematics.local; const px = L.get('posx'), py = L.get('posy'), pz = L.get('posz'), rx = L.get('rotx');
  const sx = sph.kinematics.local.get('posx');
  const PX = 'tCube.kine.local.posx', PY = 'tCube.kine.local.posy';
  const reset = () => {
    A.fcurves.clear(); A.expressions.clear(); A.marked.clear(); S.layerCurves.clear(); A.layers.splice(0); A.currentLayer = -1;
    S.legacyDefaultList = false; S.layerKeyRefused = null; S.noLayerMixerEntry = null; S.skipParameter = null; S.reapplyValueOnRemove = false;
    app.select([]); A.frame = 1; for (const p of [px, py, pz, rx, sx]) p.value = 0;
  };
  reset();
  const keyable = (o) => { const sets = [o, o.kinematics.local, o.kinematics.global, ...o.allProperties(), ...(o.primitive ? [o.primitive, ...o.primitive.operators] : [])]; return sets.flatMap(s => s.params).filter(p => p.keyable); };
  out.keyableCount = keyable(cube).length;

  // ================= default arguments on the empty selection, bare contract (legacyDefaultList off)
  out.defaults = {};
  for (const n of NAMES) { const m = markM(); const r = WRAPPED.includes(n) ? native(n) : run(n); out.defaults[n] = [r.v ?? null, r.st ?? null, r.status ?? null, ids(m)]; }
  // the same through the bus with the legacy seam on and the demo-style selection
  reset(); S.legacyDefaultList = true; app.select([sph]);
  out.defaultsLegacy = {};
  for (const n of NAMES) { if (n === 'RemoveAnimation') A.frame = 1; const r = run(n); out.defaultsLegacy[n] = r.err ?? 'ok'; }

  // ================= SaveKey
  {
    const d = {}; reset(); px.value = 3;
    const u0 = app.undoStack.length;
    d.basic = [run('SaveKey', { InputObjs: PX, Time: 5 }), keys(px), has(py), app.undoStack.length - u0];
    app.undo(); d.undo = [keys(px), has(px)]; app.redo(); d.redo = [keys(px), has(px)];
    d.value = [run('SaveKey', { InputObjs: PX, Time: 10, Value: 2.5 }), keys(px), px.value];
    A.frame = 10; px.value = 7; A.frame = 10;
    d.frameEval = px.value;
    d.currentTime = [run('SaveKey', { InputObjs: PX, Value: 4 }).st, keys(px), px.value];
    app.undo(); d.currentTimeUndo = [keys(px), px.value];
    d.merge = [run('SaveKey', { InputObjs: PX, Time: 10.25, Value: 9, Tolerance: 0.5 }).st, keys(px)];
    d.exactTol = [run('SaveKey', { InputObjs: PX, Time: 10.5, Value: 1, Tolerance: 0 }).st, keys(px)];
    let m = markM();
    d.badTol = [run('SaveKey', { InputObjs: PX, Tolerance: -2 }).status, ids(m), keys(px).length];
    d.textValue = [run('SaveKey', { InputObjs: PY, Time: 3, Value: 'abc' }).st, (py.value = 6, run('SaveKey', { InputObjs: PY, Time: 4, Value: 'abc' }).st), keys(py)];
    d.boolValue = [run('SaveKey', { InputObjs: PY, Time: 5, Value: true }).st, keys(py).pop()];
    reset();
    d.compound = [run('SaveKey', { InputObjs: 'tCube.kine.local.pos', Time: 2 }).st, [px, py, pz].map(p => keys(p)), has(rx)];
    reset();
    d.list = [run('SaveKey', { InputObjs: [PX, PX, py], Time: 2 }).st, keys(px), keys(py)];
    d.objectParam = [run('SaveKey', { InputObjs: pz, Time: 2 }).st, keys(pz)];
    d.wildcard = [run('SaveKey', { InputObjs: 'tCube.kine.local.scl.scl*', Time: 2 }).st, ['sclx', 'scly', 'sclz'].map(n => has(L.get(n)))];
    reset(); app.select([cube]);
    d.relative = [run('SaveKey', { InputObjs: '.kine.local.posy', Time: 2 }).st, keys(py)];
    // omitted list: marked parameters
    reset(); app.select([cube]); m = markM();
    d.nothing = [run('SaveKey'), msgs(m), A.fcurves.size, app.undoStack.length];
    d.nothingUndo = app.undoStack.length;
    A.marked.add(py); py.value = 1.5;
    d.marked = [run('SaveKey', { Time: 8 }).st, keys(py), A.fcurves.size];
    reset(); app.select([cube]); S.legacyDefaultList = true;
    d.legacy = [run('SaveKey', { Time: 8 }).st, A.fcurves.size === cube.kinematics.local.params.filter(p => p.keyable).length, has(px)];
    // ModifiedOnly
    reset(); px.value = 1; run('SaveKey', { InputObjs: PX, Time: 1 }); run('SaveKey', { InputObjs: PX, Time: 9 });
    d.modifiedSame = [run('SaveKey', { InputObjs: PX, Time: 5, ModifiedOnly: true }).st, keys(px)];
    px.value = 2;
    d.modifiedChanged = [run('SaveKey', { InputObjs: PX, Time: 5, ModifiedOnly: true }).st, keys(px)];
    d.modifiedNoCurve = [run('SaveKey', { InputObjs: PY, Time: 5, ModifiedOnly: true }).st, keys(py)];
    // AutokeyScope
    reset(); run('SaveKey', { InputObjs: PX, Time: 1 });
    d.scopeNoCurve = [run('SaveKey', { InputObjs: PY, Time: 1, AutokeyScope: 2 }).st, has(py), run('SaveKey', { InputObjs: PY, Time: 1, AutokeyScope: 1 }).st, has(py)];
    d.scope2 = [run('SaveKey', { InputObjs: PX, Time: 4, AutokeyScope: 2 }).st, keys(px)];
    d.scope1 = [run('SaveKey', { InputObjs: PX, Time: 7, AutokeyScope: 1 }).st, (px.value = 5, run('SaveKey', { InputObjs: PX, Time: 4.3, AutokeyScope: 1 }).st), keys(px)];
    // layers
    reset(); A.layers.push({ name: 'Base', locked: false }, { name: 'L1', locked: false }, { name: 'L2', locked: true });
    px.value = 1; run('SaveKey', { InputObjs: PX, Time: 1 }); px.value = 4;
    m = markM(); let l = markL();
    d.layerKey = [run('SaveKey', { InputObjs: PX, Time: 1, Layer: 1 }).st, keys(px, 1), keys(px), nya(l, /layer 1/)];
    px.value = 6;
    d.layerKeyAgain = [run('SaveKey', { InputObjs: PX, Time: 1, Layer: 1 }).st, keys(px, 1)];
    app.undo(); app.undo(); d.layerUndo = [keys(px, 1), !!S.layerCurves.get(1)?.has(px)];
    l = markL(); d.layerEuler = [run('SaveKey', { InputObjs: 'tCube.kine.local.rotx', Time: 1, Layer: 1 }).st, nya(l, /Euler/)];
    m = markM(); d.layerLocked = [run('SaveKey', { InputObjs: PX, Time: 1, Layer: 2 }).st, msgs(m), keys(px, 2)];
    m = markM(); d.layerMissing = [run('SaveKey', { InputObjs: PX, Time: 1, Layer: 3 }).st, msgs(m)];
    A.currentLayer = 2; m = markM(); d.currentLayer = [run('SaveKey', { InputObjs: PX, Time: 1 }).st, ids(m)]; A.currentLayer = -1;
    S.layerKeyRefused = (p) => p === px; m = markM(); d.refused = [run('SaveKey', { InputObjs: [PX, PY], Time: 1, Layer: 1 }).st, msgs(m), keys(py, 1).length]; S.layerKeyRefused = null;
    S.noLayerMixerEntry = () => true; m = markM(); d.noEntry = [run('SaveKey', { InputObjs: PX, Time: 1, Layer: 1 }).st, msgs(m)]; S.noLayerMixerEntry = null;
    S.skipParameter = (p) => p === px; d.precheck = [run('SaveKey', { InputObjs: [PX, pz], Time: 6 }).st, keys(px).some(k => k[0] === 6), keys(pz)]; S.skipParameter = null;
    out.save = d;
  }

  // ================= SaveKeyOnKeyable / SaveKeyOnMarkedKeyable
  {
    const d = {}; reset(); A.marked.add(py);
    d.keyable = [run('SaveKeyOnKeyable', { InputObjs: 'tCube', Time: 3 }).st, A.fcurves.size, has(px) && has(py), has(sx)];
    reset(); app.select([sph]);
    d.keyableSelection = [run('SaveKeyOnKeyable', { Time: 3 }).st, has(sx), has(px)];
    reset(); let m = markM();
    d.keyableEmpty = [run('SaveKeyOnKeyable'), ids(m)];
    reset(); const was = px.def.keyable; px.def.keyable = false;
    d.notKeyable = [run('SaveKeyOnKeyable', { InputObjs: 'tCube', Time: 3 }).st, has(px), has(py)]; px.def.keyable = was;
    // marked keyable: native entry, then through the script wrapper on the bus
    reset(); A.marked.add(py); A.marked.add(sx); py.value = 2;
    d.marked = [native('SaveKeyOnMarkedKeyable', { InputObjs: 'tCube', Time: 3 }), keys(py), A.fcurves.size];
    reset(); S.legacyDefaultList = true; app.select([cube]); m = markM();
    d.nothingMarked = [native('SaveKeyOnMarkedKeyable', { Time: 3 }), ids(m), A.fcurves.size];
    reset(); A.marked.add(py); const k0 = py.def.keyable; py.def.keyable = false; m = markM();
    d.markedNotKeyable = [native('SaveKeyOnMarkedKeyable', { InputObjs: 'tCube' }).st, ids(m)]; py.def.keyable = k0;
    reset(); A.marked.add(py); app.select([cube]); A.keyMarker = 3;
    d.viaWrapper = [run('SaveKeyOnMarkedKeyable').err ?? null, keys(py).length, A.fcurves.size]; delete A.keyMarker;
    out.keyable = d;
  }

  // ================= RemoveKey family
  {
    const d = {}; reset(); px.value = 1;
    for (const t of [1, 5, 9]) run('SaveKey', { InputObjs: PX, Time: t, Value: t });
    d.remove = [run('RemoveKey', { InputObjs: PX, Time: 5 }), keys(px)];
    app.undo(); d.undo = keys(px); app.redo();
    d.noKey = [run('RemoveKey', { InputObjs: PX, Time: 5 }).st, keys(px)];
    d.tolDefault = [run('RemoveKey', { InputObjs: PX, Time: 9.4 }).st, keys(px)];
    run('SaveKey', { InputObjs: PX, Time: 9, Value: 9 });
    d.tolZero = [run('RemoveKey', { InputObjs: PX, Time: 9.4, Tolerance: 0 }).st, run('RemoveKey', { InputObjs: PX, Time: 10.5, Tolerance: 2 }).st, keys(px)];
    let m = markM(); d.badTol = [run('RemoveKey', { InputObjs: PX, Tolerance: -0.5 }).status, ids(m)];
    d.last = [run('RemoveKey', { InputObjs: PX, Time: 1 }).st, has(px), px.value];
    app.undo(); d.lastUndo = [has(px), keys(px)];
    S.reapplyValueOnRemove = true; px.value = 44;
    d.reapply = [run('RemoveKey', { InputObjs: PX, Time: 1 }).st, has(px), px.value]; app.undo(); d.reapplyUndo = px.value; S.reapplyValueOnRemove = false;
    d.noCurve = [run('RemoveKey', { InputObjs: PY, Time: 1 }).st];
    m = markM(); d.empty = [run('RemoveKey'), msgs(m)];
    A.marked.add(px); d.marked = [run('RemoveKey', { Time: 1 }).st, has(px)];
    // layers
    reset(); A.layers.push({ name: 'Base', locked: false }, { name: 'L1', locked: false }, { name: 'L2', locked: true });
    run('SaveKey', { InputObjs: PX, Time: 1, Value: 1 }); run('SaveKey', { InputObjs: PX, Time: 1, Value: 3, Layer: 1 });
    m = markM(); d.layerLocked = [run('RemoveKey', { InputObjs: PX, Time: 1, Layer: 2 }).st, msgs(m)];
    d.layer = [run('RemoveKey', { InputObjs: PX, Time: 1, Layer: 1 }).st, !!S.layerCurves.get(1)?.has(px), keys(px)];
    // keyable variants
    reset(); A.marked.add(py);
    run('SaveKeyOnKeyable', { InputObjs: 'tCube', Time: 2 }); run('SaveKeyOnKeyable', { InputObjs: 'tCube', Time: 6 });
    d.markedKeyable = [run('RemoveKeyOnMarkedKeyable', { InputObjs: 'tCube', Time: 2 }).st, keys(py).length, keys(px).length];
    d.keyable = [run('RemoveKeyOnKeyable', { InputObjs: 'tCube', Time: 6 }).st, has(py), keys(px).length];
    A.marked.clear(); m = markM(); app.select([cube]);
    d.markedNothing = [run('RemoveKeyOnMarkedKeyable', { Time: 2 }), msgs(m), keys(px).length];
    app.select([cube]); d.keyableSelection = [run('RemoveKeyOnKeyable', { Time: 2 }).st, has(px)];
    out.remove = d;
  }

  // ================= NextKey / PrevKey / FirstKey / LastKey
  {
    const d = {}; reset();
    for (const t of [5, 10, 20]) run('SaveKey', { InputObjs: PX, Time: t, Value: t });
    run('SaveKey', { InputObjs: PY, Time: 8, Value: 1 });
    const both = [PX, PY]; A.frame = 1; const u0 = app.undoStack.length;
    d.next = [run('NextKey', { InputObjs: both, Time: 5 }), A.frame];
    d.prev = [run('PrevKey', { InputObjs: both, Time: 10 }), A.frame];
    d.first = [run('FirstKey', { InputObjs: both }), A.frame];
    d.last = [run('LastKey', { InputObjs: both }), A.frame];
    d.noUndo = app.undoStack.length - u0;
    A.frame = 2;
    d.none = [run('NextKey', { InputObjs: both, Time: 20 }), run('PrevKey', { InputObjs: both, Time: 5 }), run('FirstKey', { InputObjs: 'tCube.kine.local.posz' }), run('LastKey', { InputObjs: 'tCube.kine.local.posz' }), A.frame];
    d.currentTime = [(A.frame = 8, run('NextKey', { InputObjs: both }).v), (A.frame = 8, run('PrevKey', { InputObjs: both }).v)];
    d.tolerance = [run('NextKey', { InputObjs: both, Time: 9.7 }).v, run('NextKey', { InputObjs: both, Time: 9.7, Tolerance: 0 }).v, run('PrevKey', { InputObjs: both, Time: 10.3 }).v, run('PrevKey', { InputObjs: both, Time: 10.3, Tolerance: 0 }).v];
    const m = markM(); d.badTol = [run('NextKey', { InputObjs: both, Tolerance: -3 }).status, ids(m)];
    A.marked.add(py); A.frame = 1; d.marked = [run('NextKey').v, run('LastKey').v]; A.marked.clear();
    A.layers.push({ name: 'Base', locked: false }, { name: 'L1', locked: false });
    run('SaveKey', { InputObjs: PX, Time: 14, Value: 0, Layer: 1 });
    d.layer = [run('NextKey', { InputObjs: both, Time: 1, Layer: 1 }).v, run('LastKey', { InputObjs: both, Layer: 1 }).v, run('LastKey', { InputObjs: both, Layer: 0 }).v];
    S.legacyDefaultList = true; app.select([]); A.frame = 1; d.legacyAll = run('NextKey').v;
    out.nav = d;
  }

  // ================= SaveActionKey (native entry)
  {
    const d = {}; reset(); app.select([cube]);
    run('SaveKey', { InputObjs: PX, Time: 1, Value: 0 }); run('SaveKey', { InputObjs: PX, Time: 11, Value: 10 });
    d.noDriver = [native('SaveActionKey', { InputObjs: PX, Time: 5, Value: 99 }), keys(px)];
    let setup = null;
    try {
      app.run('StoreAction', { InputObj: 'tCube', Mode: 1, Name: 'ActA', RemoveAnim: true });
      const host = cube.model ?? app.scene.root;
      const src = [...host.properties, ...app.scene.root.properties].find(p => p.type === 'actionsource');
      app.run('AddClip', { Source: src.name, Time: 20 });
      const mix = host.property('mixer') ?? app.scene.root.property('mixer'); const clip = mix.clips[mix.clips.length - 1];
      const path = Object.keys(JSON.parse(src.val('fcurves'))).find(k => /posx$/.test(k));
      const srcKeys = () => JSON.parse(src.val('fcurves'))[path].map(k => [r4(k.time), r4(k.value)]);
      setup = { start: clip.start, duration: clip.duration, first: srcKeys()[0][0], n: srcKeys().length };
      const local = (t) => setup.first + (t - clip.start);
      px.value = 5; const u0 = app.undoStack.length;
      const r = native('SaveActionKey', { InputObjs: PX, Time: clip.start + 3 });
      d.inClip = [r, srcKeys().length - setup.n, srcKeys().find(k => k[0] === r4(local(clip.start + 3)))?.[1] ?? null, has(px)];
      d.value = [native('SaveActionKey', { InputObjs: PX, Time: clip.start + 3, Value: 7 }).st, srcKeys().length - setup.n, srcKeys().find(k => k[0] === r4(local(clip.start + 3)))?.[1] ?? null];
      d.outside = [native('SaveActionKey', { InputObjs: PX, Time: clip.start - 5, Value: 1 }).st, srcKeys().length - setup.n];
      const m = markM(); d.badTol = [native('SaveActionKey', { InputObjs: PX, Time: clip.start + 3, Tolerance: -9 }).status, ids(m)];
      clip.mute = true; d.muted = [native('SaveActionKey', { InputObjs: PX, Time: clip.start + 4, Value: 1 }).st, srcKeys().length - setup.n]; clip.mute = false;
      app.run('AddClip', { Source: src.name, Time: clip.start, Track: 1 }); d.clips = mix.clips.length;
      d.blended = [native('SaveActionKey', { InputObjs: PX, Time: clip.start + 4, Value: 1 }).st, srcKeys().length - setup.n];
      d.setup = [setup.n > 0, clip.duration > 3];
    } catch (e) { d.setupError = String(e?.message ?? e); }
    out.action = d;
  }

  // ================= IsAnimated / GetSource / EvalFCurve
  {
    const d = {}; reset();
    run('SaveKey', { InputObjs: PX, Time: 1, Value: 0 }); run('SaveKey', { InputObjs: PX, Time: 11, Value: 10 });
    A.setExpression(py, 'Fc * 2', () => undefined);
    run('SaveKey', { InputObjs: 'tKid.kine.local.posz', Time: 1, Value: 1 });
    const names = (l) => (l ?? []).map(p => p.fullName.replace(/^.*\.(\w+)$/, '$1'));
    let m = markM(); d.empty = [run('IsAnimated').status, ids(m)];
    d.any = [run('IsAnimated', { InputObj: 'tCube' }), names(S.out.IsAnimated.AnimComponents)];
    d.fcurve = [run('IsAnimated', { InputObj: 'tCube', SourceMask: 'siFCurveSource' }).v, names(S.out.IsAnimated.AnimComponents)];
    d.expr = [run('IsAnimated', { InputObj: 'tCube', SourceMask: 2 }).v, names(S.out.IsAnimated.AnimComponents)];
    d.branch = [run('IsAnimated', { InputObj: 'tCube', BranchFlag: 'siBranch' }).v, names(S.out.IsAnimated.AnimComponents)];
    d.not = [run('IsAnimated', { InputObj: 'tSphere' }), S.out.IsAnimated.AnimComponents === undefined];
    const list = []; d.outArray = [run('IsAnimated', { InputObj: 'tCube', AnimComponents: list }).v, names(list)];
    m = markM(); d.many = [run('IsAnimated', { InputObj: 'tSphere,tCube' }).v, msgs(m)];
    d.param = [run('IsAnimated', { InputObj: PX }).v, run('IsAnimated', { InputObj: 'tCube.kine.local.posz' }).v];
    app.select([cube]); d.selection = run('IsAnimated').v; app.select([]);
    d.local = [run('IsAnimated', { InputObj: 'tCube', Local: true }).v, run('IsAnimated', { InputObj: 'tSphere', Local: true }).v];
    // GetSource
    const kind = (s) => s === A.fcurves.get(px) ? 'fcurve:posx' : s === A.expressions.get(py) ? 'expr:posy' : '?';
    const src = (a) => { const r = exec(() => app.run('GetSource', a)); return [Array.isArray(app.run('GetSource', a)) ? app.run('GetSource', a).map(kind) : app.run('GetSource', a), r.st]; };
    d.sourceAny = src({ InputObjs: [PX, PY] });
    d.sourceFcurve = src({ InputObjs: [PX, PY], SourceMask: ':siFCurveSource:siSourceType' });
    d.sourceExpr = src({ InputObjs: [PX, PY], SourceMask: 'siExpressionSource' });
    d.sourceNone = src({ InputObjs: 'tCube.kine.local.posz' });
    A.marked.add(px); d.sourceMarked = src({}); A.marked.clear();
    // EvalFCurve
    A.frame = 11;
    d.eval = [run('EvalFCurve', { InputObj: PX, Time: 1 }), run('EvalFCurve', { InputObj: PX, Time: 11 }).v, run('EvalFCurve', { InputObj: PX }).v, r4(run('EvalFCurve', { InputObj: PX, Time: 6 }).v)];
    const l = markL(); d.evalNoCurve = [run('EvalFCurve', { InputObj: PY, Time: 3 }), nya(l, /no fcurve/)];
    out.query = d;
  }

  // ================= GetFCurveInfo / GetKeyInfo
  {
    const d = {}; reset();
    run('SaveKey', { InputObjs: PX, Time: 2, Value: 1 }); run('SaveKey', { InputObjs: PX, Time: 12, Value: 5 });
    const fc = A.fcurves.get(px); fc.keys[1].left = 4; fc.keys[1].right = 6; fc.keys[1].constr = 0x1 | 0x100 | 0x4000; fc.keys[0].constr = 0x802 | 0x100;
    d.info = run('GetFCurveInfo', { InputObj: PX });
    d.infoByCurve = run('GetFCurveInfo', { InputObj: fc }).v?.NbKeys ?? null;
    d.infoOut = S.out.GetFCurveInfo?.NbKeys ?? null;
    run('SetCurveType', { InputObjs: PX, Interpolation: 2 }); fc.extrap = 3;
    d.infoLinear = (({ ExtrapolationKind, DefaultSegKind }) => [ExtrapolationKind, DefaultSegKind])(run('GetFCurveInfo', { InputObj: PX }).v);
    d.key0 = run('GetKeyInfo', { InputObj: PX });
    d.key1 = run('GetKeyInfo', { InputObj: PX, Index: 1 });
    d.keyRange = [run('GetKeyInfo', { InputObj: PX, Index: 2 }).status, run('GetKeyInfo', { InputObj: PX, Index: 99 }).status];
    run('AddFCurve', { InputObjs: PY }); d.keyEmpty = run('GetKeyInfo', { InputObj: PY }).status;
    const l = markL(); d.noCurve = [run('GetFCurveInfo', { InputObj: 'tCube.kine.local.posz' }), run('GetKeyInfo', { InputObj: 'tCube.kine.local.posz' }), nya(l, /cannot be converted/)];
    out.info = d;
  }

  // ================= AddFCurve / SetCurveType
  {
    const d = {}; reset();
    run('SaveKey', { InputObjs: PX, Time: 2, Value: 1 });
    const fcx = A.fcurves.get(px);
    d.add = [run('AddFCurve', { InputObjs: [PX, PY] }), A.fcurves.get(px) === fcx, has(py), keys(py), keys(px)];
    const fcy = A.fcurves.get(py);
    app.undo(); d.undo = [has(py), has(px)]; app.redo(); d.redo = [has(py), A.fcurves.get(py) === fcy];
    d.again = [run('AddFCurve', { InputObjs: PY }).st];
    A.marked.add(pz); d.marked = [run('AddFCurve').st, has(pz)]; A.marked.clear();
    S.skipParameter = () => true; d.precheck = [run('AddFCurve', { InputObjs: 'tCube.kine.local.rotx' }).st, has(rx)]; S.skipParameter = null;
    d.frameStable = (A.frame = 3, py.value);
    // SetCurveType
    run('SaveKey', { InputObjs: PX, Time: 8, Value: 3 });
    const interps = () => [fcx.interp, ...fcx.keys.map(k => k.interp)];
    const before = interps();
    d.linear = [run('SetCurveType', { InputObjs: [PX, 'tCube.kine.local.rotx'], Interpolation: 2 }), interps(), has(rx)];
    app.undo(); d.linearUndo = JSON.stringify(interps()) === JSON.stringify(before); app.redo();
    d.constant = [run('SetCurveType', { InputObjs: PX, Interpolation: 1 }).st, interps()];
    d.cubic = [run('SetCurveType', { InputObjs: PX, Interpolation: 3 }).st, interps()];
    const l = markL(); d.zero = [run('SetCurveType', { InputObjs: PX }).st, nya(l, /interpolation value 0/)];
    d.noCurve = [run('SetCurveType', { InputObjs: 'tCube.kine.local.rotx', Interpolation: 2 }).st];
    out.curve = d;
  }

  // ================= ActivateFCurve family
  {
    const d = {}; reset();
    for (const p of [PX, PY, 'tSphere.kine.local.posx']) { run('SaveKey', { InputObjs: p, Time: 1, Value: 0 }); run('SaveKey', { InputObjs: p, Time: 11, Value: 10 }); }
    const fx = A.fcurves.get(px), fy = A.fcurves.get(py), fs2 = A.fcurves.get(sx);
    const muted = () => [fx.muted, fy.muted, fs2.muted];
    d.mute = [run('ActivateFCurve', { InputObjs: PX, Activate: false }), muted()];
    A.frame = 6; px.value = -3; A.frame = 6; d.mutedDoesNotDrive = px.value;
    d.unmute = [run('ActivateFCurve', { InputObjs: PX, Activate: true }).st, muted(), px.value];
    run('ActivateFCurve', { InputObjs: PX, Activate: false }); app.undo(); d.undoInverts = muted(); app.redo(); d.redo = muted(); run('ActivateFCurve', { InputObjs: PX });
    d.noCurve = [run('ActivateFCurve', { InputObjs: 'tCube.kine.local.posz', Activate: false }).st];
    // Type
    d.scene = [run('ActivateFCurve', { Activate: false, Type: 3 }).st, muted()]; run('ActivateFCurve', { Type: 3 });
    d.animated = [run('ActivateFCurve', { InputObjs: 'tCube', Activate: false, Type: 'siAnimatedParameters' }).st, muted()]; run('ActivateFCurve', { Type: 3 });
    A.marked.add(py); d.input = [run('ActivateFCurve', { Activate: false }).st, muted()]; run('ActivateFCurve', { Type: 3 });
    // keyable variants
    d.keyable = [run('ActivateFCurveOnKeyable', { InputObjs: 'tCube', Activate: false }).st, muted()]; run('ActivateFCurve', { Type: 3 });
    d.markedKeyable = [run('ActivateFCurveOnMarkedKeyable', { InputObjs: 'tCube', Activate: false }).st, muted()]; run('ActivateFCurve', { Type: 3 });
    A.marked.clear(); d.markedNothing = [run('ActivateFCurveOnMarkedKeyable', { InputObjs: 'tCube', Activate: false }).st, muted()];
    app.select([sph]); d.keyableSelection = [run('ActivateFCurveOnKeyable', { Activate: false }).st, muted()]; run('ActivateFCurve', { Type: 3 }); app.select([]);
    // ranges
    let l = markL();
    d.range = [run('ActivateFCurve', { InputObjs: PX, Activate: false, StartFrame: 8, EndFrame: 4 }).st, fx.inactiveRanges, fx.muted, nya(l, /boundary keys/)];
    A.frame = 2; const at2 = px.value; px.value = -1; A.frame = 6; d.rangeDrive = [r4(at2), px.value, (A.frame = 10, r4(px.value))];
    d.rangeMore = [run('ActivateFCurve', { InputObjs: PX, Activate: false, StartFrame: 7, EndFrame: 9 }).st, fx.inactiveRanges];
    d.reactivate = [run('ActivateFCurve', { InputObjs: PX, Activate: true, StartFrame: 5, EndFrame: 6 }).st, fx.inactiveRanges];
    app.undo(); d.rangeUndo = fx.inactiveRanges;
    d.startOnly = [run('ActivateFCurve', { InputObjs: PX, Activate: false, StartFrame: 3 }).st, fx.muted, fx.inactiveRanges.length]; run('ActivateFCurve', { InputObjs: PX });
    d.badStart = run('ActivateFCurve', { InputObjs: PX, StartFrame: 'x', EndFrame: 3 }).status;
    out.activate = d;
  }

  // ================= RemoveAnimation
  {
    const d = {}; reset();
    const anim = () => { run('SaveKey', { InputObjs: PX, Time: 1, Value: 0 }); run('SaveKey', { InputObjs: PX, Time: 11, Value: 10 }); };
    anim(); A.frame = 6; const shown = px.value;
    d.remove = [run('RemoveAnimation', { InputObjs: PX }), has(px), px.value === shown];
    app.undo(); d.undo = [has(px), keys(px)]; app.redo(); d.redo = has(px);
    d.nothing = [run('RemoveAnimation', { InputObjs: PX }).st];
    reset(); anim(); A.frame = 1;
    d.atTime = [run('RemoveAnimation', { InputObjs: PX, Time: 11 }).st, has(px), px.value];
    reset(); anim(); A.setExpression(py, '5', () => undefined);
    d.maskFcurve = [run('RemoveAnimation', { InputObjs: [PX, PY], SourceMask: 'siFCurveSource' }).st, has(px), A.expressions.has(py)];
    anim(); d.maskExpr = [run('RemoveAnimation', { InputObjs: [PX, PY], SourceMask: 'siExpressionSource' }).st, has(px), A.expressions.has(py)];
    A.setExpression(py, '5', () => undefined);
    d.any = [run('RemoveAnimation', { InputObjs: [PX, PY] }).st, has(px), A.expressions.has(py)];
    // StaticFCurves / BaseAnimation: established only as arguments; the inferred reading is logged
    reset(); anim(); run('SaveKey', { InputObjs: PY, Time: 1, Value: 2 }); run('SaveKey', { InputObjs: PY, Time: 9, Value: 2 });
    let l = markL(); d.static = [run('RemoveAnimation', { InputObjs: [PX, PY], StaticFCurves: true }).st, has(px), has(py), nya(l, /StaticFCurves/)];
    l = markL(); d.noBase = [run('RemoveAnimation', { InputObjs: PX, BaseAnimation: false }).st, has(px), nya(l, /BaseAnimation/)];
    // layers
    reset(); A.layers.push({ name: 'Base', locked: false }, { name: 'L1', locked: false }, { name: 'L2', locked: true });
    anim(); run('SaveKey', { InputObjs: PX, Time: 1, Value: 3, Layer: 1 });
    d.layerKept = [run('RemoveAnimation', { InputObjs: PX, LayerAnimation: false }).st, has(px), !!S.layerCurves.get(1)?.has(px)];
    d.layer = [run('RemoveAnimation', { InputObjs: PX }).st, !!S.layerCurves.get(1)?.has(px)];
    app.undo(); d.layerUndo = !!S.layerCurves.get(1)?.has(px);
    A.layers[1].locked = true; let m = markM();
    d.layerLocked = [run('RemoveAnimation', { InputObjs: PX }).st, msgs(m).map(x => [x[1], x[2], x[3].length]), !!S.layerCurves.get(1)?.has(px)];
    reset(); anim(); A.marked.add(px); d.marked = [run('RemoveAnimation').st, has(px)];
    out.removeAnim = d;
  }
  reset(); S.legacyDefaultList = true;
  return out;
}, { NAMES, WRAPPED });

// the keyboard path of the UI still keys the selection's transform (legacy seam on)
const ui = await page.evaluate(() => {
  const app = window.Application; const A = app.anim;
  const sph = app.scene.find('tSphere'); app.select([sph]); A.frame = 4;
  const before = A.fcurves.size; app.run('SaveKey'); const n = A.fcurves.size - before;
  A.frame = 9; app.run('SaveKey'); A.frame = 1; app.run('NextKey'); const f1 = A.frame; app.run('NextKey'); const f2 = A.frame; app.run('PrevKey'); const f3 = A.frame;
  app.run('RemoveKey'); const left = A.fcurves.get(sph.kinematics.local.get('posx'))?.keys.map(k => k.time);
  app.run('RemoveAnimation'); const gone = !A.fcurves.has(sph.kinematics.local.get('posx'));
  return { n: n > 0, f1, f2, f3, left, gone };
});
await browser.close();

// ---------------------------------------------------------------- compare
let checks = 0; const diffs = [];
const show = (x) => JSON.stringify(x);
const eq = (what, a, b) => { checks++; if (show(a) !== show(b)) diffs.push(`${what}\n      got      ${show(a)}\n      expected ${show(b)}`); };
const ok = (what, cond, detail) => { checks++; if (!cond) diffs.push(`${what}${detail === undefined ? '' : `\n      got ${show(detail)}`}`); };
const NONE = '<none>'; const DONE = { v: NONE, st: '0' }; const NOTHING = { v: NONE, st: '1' };
const INVALID = '80070057';

// ---- registration
eq('all 22 names are on the bus', got.onBus, 22);
eq('every name has a native entry in app.fcurveKeyTasks.native', got.natives, [...NAMES].sort());
eq('the bus entry is the native entry except for the two names CMD-B6a wraps', got.busIsNative, NAMES.filter(n => !WRAPPED.includes(n)).sort());
eq('the CMD-B6a script wrappers of SaveKeyOnMarkedKeyable / SaveActionKey call this row\'s native entries', got.wrapperCallsNative, [true, true]);
for (const n of NAMES) eq(`${n}: argument list = native registry entry`, got.reg[n], registry[n]);

// ---- defaults
const D = got.defaults;
for (const n of NAMES) ok(`${n}: runs with default arguments`, n === 'IsAnimated' ? D[n][2] === INVALID : D[n][2] === null, D[n]);
eq('defaults, bare contract: SaveKey family = status 1 + message 0x26', ['SaveKey', 'SaveKeyOnKeyable', 'SaveKeyOnMarkedKeyable'].map(n => D[n]), Array(3).fill([NONE, '1', null, ['26']]));
eq('defaults: RemoveKey family = status 1, silent', ['RemoveKey', 'RemoveKeyOnKeyable', 'RemoveKeyOnMarkedKeyable'].map(n => D[n]), Array(3).fill([NONE, '1', null, []]));
eq('defaults: go-to-key = status 1, non-finite value', ['NextKey', 'PrevKey', 'FirstKey', 'LastKey'].map(n => D[n]), [['+inf', '1', null, []], ['-inf', '1', null, []], ['+inf', '1', null, []], ['-inf', '1', null, []]]);
eq('defaults: IsAnimated on an empty list = 0x80070057, message 0x3eb', D.IsAnimated, [null, null, INVALID, ['3eb']]);
eq('defaults: the others do nothing (status 1)', ['GetSource', 'AddFCurve', 'SetCurveType', 'SaveActionKey', 'ActivateFCurve', 'ActivateFCurveOnKeyable', 'ActivateFCurveOnMarkedKeyable', 'RemoveAnimation'].map(n => D[n][1]), Array(8).fill('1'));
eq('defaults with the legacy seam and a selection: nothing throws', Object.values(got.defaultsLegacy).filter(x => x !== 'ok'), []);

// ---- SaveKey
const s = got.save;
eq('SaveKey: creates the fcurve and keys the current value at Time; no return value; one undo step', s.basic, [DONE, [[5, 3]], false, 1]);
eq('SaveKey undo: key removed, created fcurve disconnected; redo', [s.undo, s.redo], [[[], false], [[[5, 3]], true]]);
eq('SaveKey Value: numeric value keyed, parameter untouched off the current time', s.value, [DONE, [[5, 3], [10, 2.5]], 3]);
eq('SaveKey at the current time with a Value: the parameter shows it; undo restores', [s.frameEval, s.currentTime, s.currentTimeUndo], [2.5, ['0', [[5, 3], [10, 4]], 4], [[[5, 3], [10, 2.5]], 2.5]]);
eq('SaveKey Tolerance: an existing key inside the tolerance is replaced', s.merge, ['0', [[5, 3], [10.25, 9]]]);
eq('SaveKey Tolerance 0: only an exact time matches', s.exactTol, ['0', [[5, 3], [10.25, 9], [10.5, 1]]]);
eq('SaveKey Tolerance other than -1 or >= 0: 0x80070057, message 0xb9, nothing keyed', s.badTol, [INVALID, ['b9'], 3]);
eq('SaveKey Value of a non-numeric type = current value; BOOL converts', [s.textValue, s.boolValue], [['0', '0', [[3, 0], [4, 6]]], ['0', [5, 1]]]);
eq('SaveKey list forms: compound, duplicates dropped, parameter object, wildcard, selection-relative',
  [s.compound, s.list, s.objectParam, s.wildcard, s.relative], [['0', [[[2, 0]], [[2, 0]], [[2, 0]]], false], ['0', [[2, 0]], [[2, 0]]], ['0', [[2, 0]]], ['0', [true, true, true]], ['0', [[2, 0]]]]);
eq('SaveKey, nothing marked (bare contract): status 1, message 0x26, no key, no undo entry', [s.nothing.slice(0, 3), s.nothing[3] === s.nothingUndo],
  [[NOTHING, [['SaveKey', '26', null, []]], 0], true]);
eq('SaveKey default list = the marked parameters (inferred)', s.marked, ['0', [[8, 1.5]], 1]);
eq('SaveKey legacy seam: nothing marked keys the keyable local transform of the selection', s.legacy, ['0', true, true]);
eq('ModifiedOnly: unchanged value = no key; changed value keyed; no fcurve keyed', [s.modifiedSame, s.modifiedChanged, s.modifiedNoCurve],
  [['1', [[1, 1], [9, 1]]], ['0', [[1, 1], [5, 2], [9, 1]]], ['0', [[5, 0]]]]);
eq('AutokeyScope non-zero needs an fcurve', s.scopeNoCurve, ['1', false, '1', false]);
eq('AutokeyScope 2 keys an existing fcurve; 1 needs a key at Time within half a frame', [s.scope2, s.scope1], [['0', [[1, 0], [4, 0]]], ['1', '0', [[1, 0], [4.3, 5]]]]);
eq('Layer 1: the offset (current - animated + layer value) is keyed in the layer curve, base curve untouched, mixing logged as not yet attested', s.layerKey, ['0', [[1, 3]], [[1, 1]], true]);
eq('Layer 1 again: offset relative to the animated value including the layer', s.layerKeyAgain, ['0', [[1, 5]]]);
eq('layer key undo disconnects the layer curve', s.layerUndo, [[], false]);
eq('Euler triple on a layer: composition logged as not yet attested', s.layerEuler, ['0', true]);
eq('locked keying layer: dropped, warning 0x30 with the names, status 1 and no 0x26', s.layerLocked, ['1', [['SaveKey', '30', 4, ['tCube.kine.local.posx']]], []]);
eq('layer index >= number of layers: warning 0x27', s.layerMissing, ['1', [['SaveKey', '27', 4, ['tCube.kine.local.posx']]]]);
eq('Layer -1 = current keying layer', s.currentLayer, ['1', ['30']]);
eq('pre-pass c (attribute seam): warning 0x28, the rest keyed', s.refused, ['0', [['SaveKey', '28', 4, ['tCube.kine.local.posx']]], 1]);
eq('pre-pass d (mixer entry seam): warning 0x25, no 0x26', s.noEntry, ['1', [['SaveKey', '25', 4, ['tCube.kine.local.posx']]]]);
eq('precheck 2.5 skips a parameter without error', s.precheck, ['0', false, [[6, 0]]]);

// ---- keyable variants
const k = got.keyable;
eq('SaveKeyOnKeyable: every keyable parameter of the input objects, marking ignored', k.keyable, ['0', got.keyableCount, true, false]);
eq('SaveKeyOnKeyable default = selection (inferred); empty = status 1 + 0x26', [k.keyableSelection, k.keyableEmpty], [['0', true, false], [NOTHING, ['26']]]);
eq('SaveKeyOnKeyable leaves non-keyable parameters', k.notKeyable, ['0', false, true]);
eq('SaveKeyOnMarkedKeyable (native): keyable parameters under the marked components of the input objects', k.marked, [DONE, [[3, 2]], 1]);
eq('SaveKeyOnMarkedKeyable, nothing marked: no fallback, status 1, message 0x26', k.nothingMarked, [NOTHING, ['26'], 0]);
eq('SaveKeyOnMarkedKeyable: a marked parameter that is not keyable is not keyed', k.markedNotKeyable, ['1', ['26']]);
eq('SaveKeyOnMarkedKeyable through the CMD-B6a wrapper on the bus', k.viaWrapper, [null, 1, 1]);

// ---- RemoveKey
const r = got.remove;
eq('RemoveKey: the key at Time is removed; no return value; undo writes it back', [r.remove, r.undo], [[DONE, [[1, 1], [9, 9]]], [[1, 1], [5, 5], [9, 9]]]);
eq('RemoveKey: no key at Time = nothing', r.noKey, ['1', [[1, 1], [9, 9]]]);
eq('RemoveKey Tolerance -1 = half a frame; explicit tolerances', [r.tolDefault, r.tolZero], [['0', [[1, 1]]], ['1', '0', [[1, 1]]]]);
eq('RemoveKey bad Tolerance: 0x80070057, message 0xb9', r.badTol, [INVALID, ['b9']]);
eq('RemoveKey of the last key disconnects the fcurve, value kept; undo reconnects', [r.last, r.lastUndo], [['0', false, 1], [true, [[1, 1]]]]);
eq('task flag 0xe8 seam: the removed key value is re-applied; undo', [r.reapply, r.reapplyUndo], [['0', false, 1], 44]);
eq('RemoveKey: no fcurve = nothing; empty list = status 1 silent; default list = marked', [r.noCurve, r.empty, r.marked], [['1'], [NOTHING, []], ['0', false]]);
eq('RemoveKey locked keying layer: warning 0x31, status 1', r.layerLocked, ['1', [['RemoveKey', '31', 4, ['tCube.kine.local.posx']]]]);
eq('RemoveKey on a layer: the emptied layer curve leaves the layer, base curve untouched', r.layer, ['0', false, [[1, 1]]]);
eq('RemoveKeyOnMarkedKeyable: only the marked keyable parameters', r.markedKeyable, ['0', 1, 2]);
eq('RemoveKeyOnKeyable: all keyable parameters of the input objects', r.keyable, ['0', false, 1]);
eq('RemoveKeyOnMarkedKeyable, nothing marked: status 1 without a message', r.markedNothing, [NOTHING, [], 1]);
eq('RemoveKeyOnKeyable default = selection', r.keyableSelection, ['0', false]);

// ---- navigation
const n = got.nav;
eq('NextKey: smallest first-key-after across the parameters, current time moved', n.next, [{ v: 8, st: '0' }, 8]);
eq('PrevKey: largest last-key-before', n.prev, [{ v: 8, st: '0' }, 8]);
eq('FirstKey / LastKey: smallest first key, largest last key', [n.first, n.last], [[{ v: 5, st: '0' }, 5], [{ v: 20, st: '0' }, 20]]);
eq('go-to-key adds no undo entry (undo / redo not read, Q6)', n.noUndo, 0);
eq('nothing found: status 1, non-finite value, current time unchanged', n.none, [{ v: '+inf', st: '1' }, { v: '-inf', st: '1' }, { v: '+inf', st: '1' }, { v: '-inf', st: '1' }, 2]);
eq('Time default = current time; a key at Time itself is not returned', n.currentTime, [10, 5]);
eq('Tolerance: -1 is half a frame, 0 is exact', n.tolerance, [20, 10, 8, 10]);
eq('bad Tolerance: 0x80070057, message 0xb9', n.badTol, [INVALID, ['b9']]);
eq('default list = marked parameters', n.marked, [8, 8]);
eq('Layer selects the layer curves', n.layer, [14, 14, 20]);
eq('legacy seam: nothing selected walks every curve', n.legacyAll, 5);

// ---- SaveActionKey
const ak = got.action;
eq('SaveActionKey: a parameter without a single unblended action driver is skipped without error', ak.noDriver, [NOTHING, [[1, 0], [11, 10]]]);
eq('SaveActionKey setup (StoreAction + AddClip)', [ak.setupError ?? null, ak.setup], [null, [true, true]]);
eq('SaveActionKey: key written in the action source fcurve at the clip-local time, current value; no fcurve on the parameter', ak.inClip, [DONE, 1, 5, false]);
eq('SaveActionKey Value on an existing key: replaced', ak.value, ['0', 1, 7]);
eq('SaveActionKey outside the clip / muted clip / two drivers at Time: skipped', [ak.outside, ak.muted, ak.clips, ak.blended], [['1', 1], ['1', 1], 2, ['1', 1]]);
eq('SaveActionKey bad Tolerance', ak.badTol, [INVALID, ['b9']]);

// ---- queries
const q = got.query;
eq('scene setup: tKid is a child of tCube', got.kidParent, 'tCube');
eq('IsAnimated empty list: 0x80070057, message 0x3eb', q.empty, [INVALID, ['3eb']]);
eq('IsAnimated: true when a source matches; AnimComponents lists the animated components (node scope)', q.any, [{ v: true, st: '0' }, ['posx', 'posy']]);
eq('IsAnimated SourceMask: fcurve (1), expression (2)', [q.fcurve, q.expr], [[true, ['posx']], [true, ['posy']]]);
eq('IsAnimated BranchFlag siBranch includes the children', q.branch, [true, ['posx', 'posy', 'posz']]);
eq('IsAnimated: status 1 = false, AnimComponents not written', q.not, [{ v: false, st: '1' }, true]);
eq('IsAnimated: a passed list is filled', q.outArray, [true, ['posx', 'posy']]);
eq('IsAnimated with several items: warning 0x3d naming the first, which is the one tested', q.many, [false, [['IsAnimated', '3d', 4, ['tSphere']]]]);
eq('IsAnimated on a parameter; default = selection; Local', [q.param, q.selection, q.local], [[true, false], true, [true, false]]);
eq('GetSource: sources matching the mask; nothing = status 1, Value untouched; default = marked', [q.sourceAny, q.sourceFcurve, q.sourceExpr, q.sourceNone, q.sourceMarked],
  [[['fcurve:posx', 'expr:posy'], '0'], [['fcurve:posx'], '0'], [['expr:posy'], '0'], [null, '1'], [['fcurve:posx'], '0']]);
eq('EvalFCurve: the first fcurve source evaluated at Time (default current)', q.eval, [{ v: 0, st: '0' }, 10, 10, 5]);
eq('EvalFCurve without an fcurve: the initial result field (Q5), logged as not yet attested', q.evalNoCurve, [{ v: 0, st: '1' }, true]);

// ---- info
const i = got.info;
eq('GetFCurveInfo: seven outputs', i.info, { v: { CurveKind: 20, ValueWhenNoKey: 0, NbKeys: 2, ExtrapolationKind: 1, DefaultSegKind: 3, LowClamp: 0, HighClamp: 0 }, st: '0' });
eq('GetFCurveInfo: the fcurve itself as InputObj; outputs kept; values passed through', [i.infoByCurve, i.infoOut, i.infoLinear], [2, 2, [3, 2]]);
eq('GetKeyInfo Index 0 (default): key record, constraint bits rebuilt (0x100 only with 0x800)', i.key0,
  { v: { Parameter: 2, LeftValue: 1, RightValue: 1, LeftTanParam: 0, LeftTanValue: 0, RightTanParam: 0, RightTanValue: 0, RightSegKind: 2, Constraints: 0x902 }, st: '0' });
eq('GetKeyInfo Index 1: left / right values, unknown bits and a lone 0x100 dropped', i.key1,
  { v: { Parameter: 12, LeftValue: 4, RightValue: 6, LeftTanParam: 0, LeftTanValue: 0, RightTanParam: 0, RightTanValue: 0, RightSegKind: 2, Constraints: 1 }, st: '0' });
eq('GetKeyInfo: Index >= count or an empty curve = 0x80070057', [i.keyRange, i.keyEmpty], [[INVALID, INVALID], INVALID]);
eq('no fcurve to convert to: nothing returned, logged as not yet attested', i.noCurve, [{ v: null, st: '1' }, { v: null, st: '1' }, true]);

// ---- AddFCurve / SetCurveType
const c = got.curve;
eq('AddFCurve: an empty fcurve on parameters without one, existing fcurve left alone, no return value', c.add, [DONE, true, true, [], [[2, 1]]]);
eq('AddFCurve undo disconnects; redo reconnects the same fcurve', [c.undo, c.redo], [[false, true], [true, true]]);
eq('AddFCurve: already has an fcurve = nothing; default = marked; precheck skip', [c.again, c.marked, c.precheck], [['1'], ['0', true], ['1', false]]);
eq('an empty fcurve does not drive the parameter', c.frameStable, 0);
eq('SetCurveType 2: curve and keys linear; parameters without an fcurve skipped; undo restores', [c.linear, c.linearUndo], [[DONE, [1, 1, 1], false], true]);
eq('SetCurveType 1 constant, 3 cubic', [c.constant, c.cubic], [['0', [0, 0, 0]], ['0', [3, 3, 3]]]);
eq('SetCurveType default 0: passed through, logged as not yet attested; no fcurve = nothing', [c.zero, c.noCurve], [['0', true], ['1']]);

// ---- ActivateFCurve
const a = got.activate;
eq('ActivateFCurve Activate=false mutes the whole curve; a muted curve does not drive', [a.mute, a.mutedDoesNotDrive], [[DONE, [true, false, false]], -3]);
eq('ActivateFCurve Activate=true unmutes, the curve drives again', a.unmute, ['0', [false, false, false], 5]);
eq('undo = the same operation with Activate inverted; redo', [a.undoInverts, a.redo], [[false, false, false], [true, false, false]]);
eq('parameters without an fcurve are skipped', a.noCurve, ['1']);
eq('Type 3: every fcurve of the scene, InputObjs not read', a.scene, ['0', [true, true, true]]);
eq('Type 2 (siAnimatedParameters): the fcurve-animated parameters of the input objects', a.animated, ['0', [true, true, false]]);
eq('Type siInputParams: the input list (default marked)', a.input, ['0', [false, true, false]]);
eq('ActivateFCurveOnKeyable: keyable parameters of the input objects; default = selection', [a.keyable, a.keyableSelection], [['0', [true, true, false]], ['0', [false, false, true]]]);
eq('ActivateFCurveOnMarkedKeyable: marked keyable only; nothing marked = nothing', [a.markedKeyable, a.markedNothing], [['0', [false, true, false]], ['1', [false, false, false]]]);
eq('range: reversed range swapped, deactivated between the two times, not muted; boundary keys logged as not yet attested', a.range, ['0', [[4, 8]], false, true]);
eq('a deactivated range does not drive; outside it does', a.rangeDrive, [0.28, -1, 9.72]);
eq('ranges accumulate; Activate=true reactivates a range', [a.rangeMore, a.reactivate], [['0', [[4, 9]]], ['0', [[4, 5], [6, 9]]]]);
eq('range undo = inverse operation', a.rangeUndo, [[4, 9]]);
eq('StartFrame without EndFrame = whole curve; non-numeric StartFrame fails', [a.startOnly, a.badStart], [['0', true, 1], INVALID]);

// ---- RemoveAnimation
const ra = got.removeAnim;
eq('RemoveAnimation: sources removed, the parameter keeps the value it showed; no return value', ra.remove, [DONE, false, true]);
eq('RemoveAnimation undo / redo; nothing to remove = status 1', [ra.undo, ra.redo, ra.nothing], [[true, [[1, 0], [11, 10]]], false, ['1']]);
eq('RemoveAnimation Time: the value at Time is written back', ra.atTime, ['0', false, 10]);
eq('SourceMask: fcurve only, expression only, any', [ra.maskFcurve, ra.maskExpr, ra.any], [['0', false, true], ['0', true, false], ['0', false, false]]);
eq('StaticFCurves / BaseAnimation: inferred reading, logged as not yet attested', [ra.static, ra.noBase], [['0', true, false, true], ['1', true, true]]);
eq('LayerAnimation false keeps the layer entries; true removes them; undo', [ra.layerKept, ra.layer, ra.layerUndo], [['0', false, true], ['0', false], true]);
eq('locked keying layer: skipped with warning 0x37 naming the owner', ra.layerLocked, ['1', [['37', 4, 1]], true]);
eq('default list = marked', ra.marked, ['0', false]);

// ---- UI path
eq('UI callers (legacy seam on): SaveKey / NextKey / PrevKey / RemoveKey / RemoveAnimation without arguments act on the selection', ui, { n: true, f1: 4, f2: 9, f3: 4, left: [9], gone: true });
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B8a fcurve / key task commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8a fcurve / key task commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): IsAnimated, GetSource, GetFCurveInfo, GetKeyInfo, AddFCurve, SaveKeyOnKeyable, SaveKeyOnMarkedKeyable, RemoveKey, RemoveKeyOnKeyable, RemoveKeyOnMarkedKeyable, NextKey, PrevKey, FirstKey, LastKey, SaveActionKey');
console.log('   partly wired: SaveKey family (layer keys stored, not mixed; Euler composition), EvalFCurve (Q5), SetCurveType (values outside 1..3), ActivateFCurve x3 (range boundary keys, Q4), RemoveAnimation (StaticFCurves / BaseAnimation / SourceMask, Q3)');
