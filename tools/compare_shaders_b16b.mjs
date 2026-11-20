// CMD-B16b: shader creation (bbbbee29: CreateShaderFromPreset / CLSID / ProgID, AddShaderAttachedComment,
// CreateShadersFromMaterialPreset), shader array elements (SIAddArrayElement, SIRemoveArrayElement, SISwapArrayElements)
// and SIAppendBone. No XSIBATCH golden exists for the row: this checks the "Wire contract" statements of
// docs/ghidra/cmd-b16b-shader-array-bone-commands.md (and items 13-21 of docs/re/WIRE_CORRECTIONS_B16.md) against
// src/commands/shadertasksB16b.ts:
//   1. every name is registered with the catalogue argument list (data/commands_full.json);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) and either succeeds or fails
//      with the status the contract states for that case;
//   3. the stated results (SPDL default names, lock / refusal errors, one comment per holder, array add / remove / swap
//      with connections, SIAppendBone on any chain element).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_shaders_b16b.mjs
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

const NAMES = ['CreateShaderFromPreset', 'CreateShaderFromCLSID', 'CreateShaderFromProgID', 'AddShaderAttachedComment', 'CreateShadersFromMaterialPreset',
  'SIAddArrayElement', 'SIRemoveArrayElement', 'SISwapArrayElements', 'SIAppendBone'];
/** Default-argument outcome the contract states: a status, or 'ok'. */
const DEFAULT_OUTCOME = {
  CreateShaderFromPreset: '80004003',          // no preset
  CreateShaderFromCLSID: '80070057',           // null GUID (no container either)
  CreateShaderFromProgID: '80070057',          // no container (inferred status of the container check)
  AddShaderAttachedComment: '80004003',        // no container
  CreateShadersFromMaterialPreset: '80004003', // no preset
  SIAddArrayElement: '80070057',               // not a port
  SIRemoveArrayElement: '80070057',
  SISwapArrayElements: '80070057',
  SIAppendBone: 'ok',                          // the selected cube is not a chain element -> S_FALSE, nothing
};
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
await page.waitForFunction(() => !!window.Application?.commands?.get('SIAppendBone') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_OUTCOME }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const reset = () => { A.setTool?.(null); A.compSel = null; A.select([cube]); };
  const trace = (name, f) => { const d = A.commands.get(name); const orig = d.execute; const calls = []; d.execute = (app, a) => { calls.push({ ...a }); return orig.call(d, app, a); }; try { f(); } finally { d.execute = orig; } return calls; };
  const ST = () => A.shadertasksB16b;
  const locks = () => A.lockRecordsB11 ?? (A.lockRecordsB11 = new Map());
  const lock = n => locks().set(n, [{ id: 0, lockLevel: 0xffff, tagLevel: 0, type: 0 }]);
  const unlock = n => locks().delete(n);

  // 1. registration, 2. default runs
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    const want = DEFAULT_OUTCOME[n];
    out.defaults[n] = want === 'ok' ? (r.err ? 'ERROR: ' + r.err : 'ok') : (status(r, want) ? 'ok' : `expected 0x${want}, got ${r.err ?? 'success'}`);
  }

  const mk = (prim, name) => { const o = A.run('CreatePrim', { PresetObj: prim, Name: name }); return Array.isArray(o) ? o[0] : o; };
  A.select([]);
  const o = mk('Sphere', 'b16b'); A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] }); A.select([]);
  const mat = o.material; const phong = mat.surface;
  const containerOfSh = sh => ST().containerOf(sh);

  // ================= CreateShaderFromCLSID
  try {
    const CHK = '{2D66A8D7-ED68-11D2-843E-00E08100004E}';   // txt3d-checkerboard.spdl Reference
    const e0 = ST().events.length;
    let r = run('CreateShaderFromCLSID', { Clsid: CHK, Container: [mat] });
    ok('CreateShaderFromCLSID: shader of the SPDL with that class id, SPDL default name, in the container', !r.err && r.v?.spdl?.file === 'txt3d-checkerboard.spdl' && r.v?.name === 'Checkerboard' && ST().lastMethod === 1, [r.err, r.v?.name, r.v?.spdl?.file]);
    ok('CreateShaderFromCLSID: "shader created" event 0x20510032 with its ProgID', ST().events.length === e0 + 1 && ST().events[e0].id === 0x20510032 && ST().events[e0].shader === r.v && /txt3d-checkerboard/.test(ST().events[e0].progId));
    const c1 = containerOfSh(r.v); ok('CreateShaderFromCLSID: nested in the container (GetShaderContainer)', c1 === mat || (Array.isArray(c1) && c1[0] === mat), c1?.name);
    const first = r.v;
    r = run('CreateShaderFromCLSID', { Clsid: CHK.toLowerCase().replace(/[{}]/g, ''), Container: [mat], Name: 'ByClsid' });
    ok('CreateShaderFromCLSID: a non-empty Name wins; braces / case do not matter', !r.err && r.v?.name === 'ByClsid' && r.v !== first, [r.err, r.v?.name]);
    r = run('CreateShaderFromCLSID', { Clsid: '{A85CBE61-DDD7-11D1-804A-00A0C906835D}', Container: [mat] });
    ok('CreateShaderFromCLSID: txt2d-image class id -> "Image" (SPDL MetaShader name)', !r.err && r.v?.spdl?.file === 'txt2d-image.spdl' && r.v?.name === 'Image', [r.err, r.v?.name, r.v?.spdl?.file]);
    r = run('CreateShaderFromCLSID', { Clsid: '{12345678-1234-1234-1234-123456789abc}', Container: [mat] });
    ok('CreateShaderFromCLSID: a class id with no shader -> creation failure 0x80004005 (status logged not yet attested)', status(r, '80004005') && has(r, /not yet attested/), r);
    ok('CreateShaderFromCLSID: no CLSID -> shader-name table gone (no "not known in this build")', !has(r, /not known in this build/));
    ok('CreateShaderFromCLSID: null GUID -> 0x80070057', status(run('CreateShaderFromCLSID', { Container: [mat] }), '80070057'));
    lock(mat); const u0 = A.undoStack.length;
    r = run('CreateShaderFromCLSID', { Clsid: CHK, Container: [mat] });
    ok('CreateShaderFromCLSID: locked container -> 0x80070005, nothing created', status(r, '80070005') && A.undoStack.length === u0, r);
    unlock(mat);
    mat.acceptsShader = () => false;
    r = run('CreateShaderFromCLSID', { Clsid: CHK, Container: [mat] });
    ok('CreateShaderFromCLSID: a container that refuses the shader -> 0x80004005 with XSISHADERTASKS 0xd2', status(r, '80004005') && has(r, /XSISHADERTASKS 0xd2/), r);
    delete mat.acceptsShader;
    const u1 = A.undoStack.length; r = run('CreateShaderFromCLSID', { Clsid: CHK, Container: [mat], Name: 'UndoMe' }); A.undo();
    const c2 = containerOfSh(r.v); ok('CreateShaderFromCLSID: undo takes the shader out of the container', A.undoStack.length === u1 && !(c2 === mat || (Array.isArray(c2) && c2[0] === mat)), c2?.name);
    r = run('CreateShaderFromCLSID', { Clsid: CHK, Container: [phong] });
    ok('CreateShaderFromCLSID: a shader as Container -> its owner (the material)', !r.err && (containerOfSh(r.v) === mat || containerOfSh(r.v)?.[0] === mat), r.err);
  } catch (e) { ok('CLSID block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreateShaderFromProgID / CreateShaderFromPreset
  try {
    let r = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-grid.1', Container: [mat] });
    ok('CreateShaderFromProgID: default name = the shader definition name ("Grid")', !r.err && r.v?.name === 'Grid' && r.v?.progId === 'Softimage.txt2d-grid.1' && ST().lastMethod === 2, [r.err, r.v?.name]);
    r = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1', Container: [mat], Name: 'MyImage' });
    ok('CreateShaderFromProgID: Name wins', !r.err && r.v?.name === 'MyImage', r.v?.name);
    ok('CreateShaderFromProgID: unknown ProgID -> 0x80004005', status(run('CreateShaderFromProgID', { ProgID: 'Nobody.nothing.1', Container: [mat] }), '80004005'));
    ok('CreateShaderFromProgID: empty ProgID -> 0x80004005', status(run('CreateShaderFromProgID', { Container: [mat] }), '80004005'));
    lock(mat); ok('CreateShaderFromProgID: locked container -> 0x80070005', status(run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-grid.1', Container: [mat] }), '80070005')); unlock(mat);
    r = run('CreateShaderFromPreset', { PresetObj: 'Shaders\\Texture\\Checkerboard.Preset', Container: [mat] });
    ok('CreateShaderFromPreset: shader from the preset in the container, preset name kept', !r.err && /Checkerboard/.test(r.v?.name) && ST().lastMethod === 0 && (containerOfSh(r.v) === mat || containerOfSh(r.v)?.[0] === mat), [r.err, r.v?.name]);
    r = run('CreateShaderFromPreset', { PresetObj: 'Wood', Container: [mat], Name: 'MyWood' });
    ok('CreateShaderFromPreset: Name wins', !r.err && r.v?.name === 'MyWood', r.v?.name);
    ok('CreateShaderFromPreset: unknown preset -> 0x80004005', status(run('CreateShaderFromPreset', { PresetObj: 'NoSuchPreset', Container: [mat] }), '80004005'));
    lock(mat); ok('CreateShaderFromPreset: locked container -> 0x80070005', status(run('CreateShaderFromPreset', { PresetObj: 'Wood', Container: [mat] }), '80070005')); unlock(mat);
  } catch (e) { ok('ProgID / preset block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= CreateShadersFromMaterialPreset
  try {
    const surf0 = mat.surface; const diff0 = JSON.stringify(phong.get('diffuse')?.value); const conns0 = [...mat.portConnections.keys()].join();
    let r = run('CreateShadersFromMaterialPreset', { PresetObj: 'Materials\\Lambert.Preset', Container: [mat] });
    ok('CreateShadersFromMaterialPreset: the shader plugged into the preset material is added to the container and returned', !r.err && r.v?.spdl?.file === 'material-lambert.spdl' && (containerOfSh(r.v) === mat || containerOfSh(r.v)?.[0] === mat) && ST().lastMethod === 4, [r.err, r.v?.name]);
    ok('CreateShadersFromMaterialPreset: no connection to the container\'s ports, no material values', mat.surface === surf0 && [...mat.portConnections.keys()].join() === conns0 && JSON.stringify(phong.get('diffuse')?.value) === diff0);
    ok('CreateShadersFromMaterialPreset: the values question is no longer logged (naming helper still is)', !has(r, /material-level parameters/) && has(r, /not yet attested: the name each shader gets/), r.log);
    ok('CreateShadersFromMaterialPreset: a non-material preset -> 0x80004005', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'Shaders\\Texture\\Image.Preset', Container: [mat] }), '80004005'));
    ok('CreateShadersFromMaterialPreset: a texture preset name -> 0x80004005', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'Checkerboard', Container: [mat] }), '80004005'));
    ok('CreateShadersFromMaterialPreset: no container -> 0x80004003', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'Materials\\Phong.Preset' }), '80004003'));
    lock(mat); ok('CreateShadersFromMaterialPreset: locked container -> 0x80070005', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'Materials\\Phong.Preset', Container: [mat] }), '80070005')); unlock(mat);
  } catch (e) { ok('material preset block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddShaderAttachedComment
  try {
    let r = run('AddShaderAttachedComment', { Container: [phong] });
    const cm = r.v;
    ok('AddShaderAttachedComment: a Comment.Preset object attached to the container and returned', !r.err && cm?.preset === 'Comment.Preset' && cm?.classId === '77db4b2d-9e05-462c-a7c9-ed91d7783133' && ST().commentOf(phong) === cm && cm.parent === phong && ST().lastMethod === 3, r.err);
    r = run('AddShaderAttachedComment', { Container: [phong] });
    ok('AddShaderAttachedComment: second comment on the same container -> 0x80004005', status(r, '80004005'));
    A.undo(); A.undo();
    ok('AddShaderAttachedComment: records undo (comment detached)', ST().commentOf(phong) === null);
    r = run('AddShaderAttachedComment', { Container: [phong] });
    ok('AddShaderAttachedComment: after undo a comment can be added again', !r.err && ST().commentOf(phong) === r.v);
    ok('AddShaderAttachedComment: a container that holds no comment (material) -> 0x80004005', status(run('AddShaderAttachedComment', { Container: [mat] }), '80004005'));
    const img = run('CreateShaderFromPreset', { PresetObj: 'Image', Container: [mat] }).v;
    lock(img); ok('AddShaderAttachedComment: locked container -> 0x80070005', status(run('AddShaderAttachedComment', { Container: [img] }), '80070005')); unlock(img);
  } catch (e) { ok('comment block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= shader array elements (material-phong `lights`, SPDL type = array)
  try {
    const port = { owner: phong, name: 'lights' };
    const arr = ST().arrayOf(phong, 'lights');
    ok('SPDL array port: material-phong lights is an array parameter', !!arr && arr.count === 0);
    const r0 = run('SIAddArrayElement', { Object: [port] });
    const r1 = run('SIAddArrayElement', { Object: `${phong.fullName}.lights` });
    const r2 = run('SIAddArrayElement', { Object: [arr] });
    ok('SIAddArrayElement: each new element appended at the end and returned', !r0.err && !r1.err && !r2.err && arr.count === 3 && arr.elements[0] === r0.v && arr.elements[2] === r2.v && r2.v.index === 2, [r0.err, r1.err, r2.err, arr?.count]);
    ok('SIAddArrayElement: a non-array port -> 0x80070057', status(run('SIAddArrayElement', { Object: [{ owner: phong, name: 'diffuse' }] }), '80070057'));
    ok('SIAddArrayElement: an element (not the array) -> 0x80070057', status(run('SIAddArrayElement', { Object: [r0.v] }), '80070057'));
    lock(phong); let r = run('SIAddArrayElement', { Object: [port] });
    ok('SIAddArrayElement: locked port -> 0x80004005 with XSISHADERTASKS 0xd7', status(r, '80004005') && has(r, /XSISHADERTASKS 0xd7/) && arr.count === 3, r); unlock(phong);
    A.undo(); ok('SIAddArrayElement: undo removes the element', arr.count === 2); A.redo();
    const [e0, e1, e2] = arr.elements; const lightA = cube, lightB = o;
    e0.source = lightA; e2.source = lightB;
    r = run('SISwapArrayElements', { Object: [port], IndexA: 0, IndexB: 2 });
    ok('SISwapArrayElements: elements swapped, connections move with them', !r.err && arr.elements[0] === e2 && arr.elements[2] === e0 && arr.elements[0].source === lightB && arr.elements[2].source === lightA, r.err);
    A.undo(); ok('SISwapArrayElements: undo', arr.elements[0] === e0 && arr.elements[2] === e2);
    const u0 = A.undoStack.length; r = run('SISwapArrayElements', { Object: [port], IndexA: 1, IndexB: 1 });
    ok('SISwapArrayElements: equal indices -> no-op', !r.err && A.undoStack.length === u0 && arr.elements[1] === e1);
    ok('SISwapArrayElements: index >= element count -> 0x80070057', status(run('SISwapArrayElements', { Object: [port], IndexA: 0, IndexB: 3 }), '80070057'));
    ok('SISwapArrayElements: negative index -> 0x80070057', status(run('SISwapArrayElements', { Object: [port], IndexA: -1, IndexB: 0 }), '80070057'));
    ok('SISwapArrayElements: non-array Object -> 0x80070057 (not a log)', status(run('SISwapArrayElements', { Object: [{ owner: phong, name: 'diffuse' }], IndexA: 0, IndexB: 1 }), '80070057'));
    lock(phong); r = run('SISwapArrayElements', { Object: [port], IndexA: 0, IndexB: 1 });
    ok('SISwapArrayElements: locked port -> 0x80004005 with 0xd7', status(r, '80004005') && has(r, /XSISHADERTASKS 0xd7/)); unlock(phong);
    // remove
    r = run('SIRemoveArrayElement', { Object: [e0], Index: 2 });
    ok('SIRemoveArrayElement: the element given as Object is removed (Index ignored), its connection cut', !r.err && arr.count === 2 && !arr.elements.includes(e0) && arr.elements.includes(e2) && e0.source === null, [r.err, arr.count]);
    A.undo(); ok('SIRemoveArrayElement: undo restores the element and its connection', arr.elements[0] === e0 && e0.source === lightA);
    r = run('SIRemoveArrayElement', { Object: `${phong.fullName}.lights[1]` });
    ok('SIRemoveArrayElement: element by path', !r.err && arr.count === 2 && !arr.elements.includes(e1), r.err);
    ok('SIRemoveArrayElement: the array port itself -> 0x80070057', status(run('SIRemoveArrayElement', { Object: [port] }), '80070057'));
    lock(phong); r = run('SIRemoveArrayElement', { Object: [e0] });
    ok('SIRemoveArrayElement: locked port -> 0x80004005 with 0xd7', status(r, '80004005') && has(r, /XSISHADERTASKS 0xd7/) && arr.elements.includes(e0)); unlock(phong);
  } catch (e) { ok('array block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= SIAppendBone
  try {
    reset();
    const gpos = obj => { const e = obj.globalMatrix().elements; return [e[12], e[13], e[14]]; };
    const rotOf = obj => { const e = obj.globalMatrix().elements; const sx = Math.hypot(e[0], e[1], e[2]); return [e[0] / sx, e[1] / sx, e[2] / sx, e[4], e[5], e[6]].map(v => Math.round(v * 1e4) / 1e4).join(); };
    const chain = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0]] }); const eff = chain.effector; const nb = chain.bones.length;
    const effRot0 = rotOf(eff);
    let r = run('SIAppendBone', { InputObjs: [chain.bones[0]], Ex: 4, Ey: 1, Ez: 0 });
    const nbone = r.v;
    ok('SIAppendBone: a bone given as input -> one bone appended, returned as Value', !r.err && chain.bones.length === nb + 1 && chain.bones[nb] === nbone && nbone?.type === 'bone', [r.err, chain.bones.length]);
    const p = gpos(eff);
    ok('SIAppendBone: effector moved to (Ex, Ey, Ez) under the new bone', near(p[0], 4) && near(p[1], 1) && near(p[2], 0) && eff.parentObj === nbone, p);
    const tip = (() => { const len = nbone.val('length'); const e = nbone.globalMatrix().elements; return [e[12] + e[0] * len, e[13] + e[1] * len, e[14] + e[2] * len]; })();
    ok('SIAppendBone: the new bone reaches (Ex, Ey, Ez)', near(tip[0], 4) && near(tip[1], 1) && near(tip[2], 0), tip);
    ok('SIAppendBone: Pin true keeps the effector\'s global orientation', rotOf(eff) === effRot0, [rotOf(eff), effRot0]);
    A.undo(); ok('SIAppendBone: undo removes the bone and puts the effector back', chain.bones.length === nb && eff.parentObj === chain.bones[nb - 1] && near(gpos(eff)[0], 2));
    r = run('SIAppendBone', { InputObjs: [eff, chain], Ex: 4, Ey: 0, Ez: 0 });
    ok('SIAppendBone: two inputs -> S_FALSE, nothing', !r.err && r.v === undefined && chain.bones.length === nb && A.shadertasksB16b.lastStatus.status === 1);
    r = run('SIAppendBone', { InputObjs: [], Ex: 4, Ey: 0, Ez: 0 });
    ok('SIAppendBone: no input -> S_FALSE, nothing', !r.err && r.v === undefined && chain.bones.length === nb);
    r = run('SIAppendBone', { InputObjs: [cube], Ex: 4, Ey: 0, Ez: 0 });
    ok('SIAppendBone: not a chain element -> S_FALSE, nothing', !r.err && r.v === undefined);
    r = run('SIAppendBone', { InputObjs: [chain], Ex: 3, Ey: 2, Ez: 0, Pin: false });
    ok('SIAppendBone: the root given as input works too', !r.err && chain.bones.length === nb + 1, r.err);
    r = run('SIAppendBone', { InputObjs: [eff], Ex: 3, Ey: 4, Ez: 0 });
    ok('SIAppendBone: the effector given as input works too', !r.err && chain.bones.length === nb + 2, r.err);
    // AlignRootToFirstBone: done inside the task, not by the command
    const chain2 = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [1, 1, 0], [2, 1, 0]] }); const b1 = chain2.bones[0];
    const b1Rot = rotOf(b1), b1Pos = gpos(b1).map(v => v.toFixed(4)).join();
    const calls = trace('AlignRootToFirstBone', () => { r = run('SIAppendBone', { InputObjs: [chain2.effector], Ex: 3, Ey: 0, Ez: 0, AlignRootToFirstBone: true }); });
    ok('SIAppendBone: AlignRootToFirstBone aligns the root to the first bone inside the task (command not run), bone pose kept', !r.err && calls.length === 0 && rotOf(chain2) === b1Rot && rotOf(b1) === b1Rot && gpos(b1).map(v => v.toFixed(4)).join() === b1Pos, [r.err, calls.length, rotOf(chain2), b1Rot]);
    // referenced model
    const root = A.scene.root; const had = root.referencedModel; root.referencedModel = true;
    r = run('SIAppendBone', { InputObjs: [chain2.effector], Ex: 5, Ey: 0, Ez: 0 });
    ok('SIAppendBone: chain in a referenced model -> 0x80070005', status(r, '80070005'), r); if (had === undefined) delete root.referencedModel; else root.referencedModel = had;
    // AppendBone (DS script) reaches it with the effector alone
    const n2 = chain2.bones.length; const r3 = run('AppendBone', { InputObjs: [chain2.effector], Ex: 6, Ey: 1, Ez: 0 });
    ok('AppendBone (script) reaches SIAppendBone with one chain element', chain2.bones.length === n2 + 1 && !has(r3, /the new bone is the C\+\+ append command/), r3.log);
    A.scene.root.removeChild(chain); A.scene.root.removeChild(chain2);
  } catch (e) { ok('SIAppendBone block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, DEFAULT_OUTCOME });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run (${DEFAULT_OUTCOME[n] === 'ok' ? 'succeeds' : 'status 0x' + DEFAULT_OUTCOME[n]})`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_shaders_b16b: ${pass}/${pass + fail} ok`);
await browser.close();
process.exit(fail ? 1 : 0);
