// CMD-B12f / CMD-B12g (shadertasks.dll): the 29 commands of src/commands/shadertasksB12*.ts. There is no XSIBATCH golden
// for either row: this is a contract check against docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md and
// docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, outputs left out; the
//      first registration of UIMapButton);
//   2. every command runs with its default arguments on the demo scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contracts' stated results (statuses, return values, scene / file state, logged ids, undo / redo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_shadertasks_b12fg_commands.mjs
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
  'AddObjectsToShader', 'RemoveObjectsFromShader', 'RemoveShaderFromCnxPoint', 'RemoveAllShadersFromCnxPoint', 'UIMapButton', 'SIGetMaterialShader',
  'ReplaceShader', 'ReplaceShaderWithPreset', 'ReplaceShaderWithProgID', 'SetInstanceDataValue', 'SIRebindByNameUserData', 'RenamePropAndRebind_Internal',
  'CreateShaderCompound', 'NestShaders', 'UnnestShaders', 'AddShaderCompoundPort', 'RemoveShaderCompoundPort', 'MoveShaderCompoundPort',
  'RenameShaderCompoundPort', 'ExportShaderCompound', 'ImportShaderCompound', 'ExplodeShaderCompound', 'SetShaderCompoundProperties',
  'SetShaderCompoundPortProperties', 'GetShaderCompoundPortProperties', 'ExportShaderTree', 'ImportShaderTree', 'ExportShaderDefinition', 'ReplaceShadersDefinition',
];
// Commands that run fine with defaults (cube selected); every other one has a required input without a default.
const DEFAULT_OK = new Set(['UIMapButton', 'SIGetMaterialShader', 'RenameShaderCompoundPort']);

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
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ReplaceShadersDefinition') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_OK: DO }) => {
  const DEFAULT_OK = new Set(DO);
  const A = window.Application; A.autoInspect = false;
  const S = A.shadertasksB12; const T = A.textureLayers; const { ShaderCompound, CompoundPort, hostFs: H } = S.classes;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const nya = r => r.log.filter(l => /not yet attested/.test(l)).length;
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const last = () => S.lastStatus?.status;
  const src = (owner, name) => T.getSource({ owner, name });
  const cube = A.scene.find('cube');

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }

  // 2. default runs (cube selected)
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (!DEFAULT_OK.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_OK.has(n) ? 'ok' : 'UNEXPECTED-OK');
  }

  // a fresh scene: the sphere with a local Phong material
  const fresh = () => {
    A.run('NewScene'); A.Interactive = false; A.autoInspect = false;
    const o = A.scene.find('sphere') ?? A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' });
    A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] });
    return { o, m: o.material, ph: o.material.surface };
  };
  const apply = (preset, port) => A.run('SIApplyShaderToCnxPoint', { PresetObj: preset, InputObjs: [port] });

  // ================= AddObjectsToShader / RemoveObjectsFromShader
  {
    const { o, ph } = fresh(); const c2 = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    let r = run('AddObjectsToShader', { InputObjs: [o, c2], Target: [ph] });
    ok('AddObjectsToShader: one array element per input, in list order, each referencing the input', !r.err && S.objectsOf(ph).length === 2 && S.objectsOf(ph)[0] === o && S.objectsOf(ph)[1] === c2 && last() === 0, r);
    A.undo(); ok('AddObjectsToShader undo: SIAddArrayElement + SetReference2 sub-tasks undone', S.objectsOf(ph).length === 0);
    A.redo(); ok('AddObjectsToShader redo', S.objectsOf(ph).length === 2);
    ok('AddObjectsToShader: missing InputObjs -> 0x80070057', status(run('AddObjectsToShader', { Target: [ph] }), '80070057'));
    ok('AddObjectsToShader: Target not a shader -> 0x80070057', status(run('AddObjectsToShader', { InputObjs: [o], Target: [o] }), '80070057'));
    run('AddObjectsToShader', { InputObjs: [o], Target: [ph] });
    r = run('RemoveObjectsFromShader', { InputObjs: [o], Target: [ph] });
    ok('RemoveObjectsFromShader: every element referencing the object goes, the others stay', !r.err && S.objectsOf(ph).length === 1 && S.objectsOf(ph)[0] === c2, S.objectsOf(ph).map(x => x?.name));
    A.undo(); ok('RemoveObjectsFromShader undo restores the elements in place', S.objectsOf(ph).map(x => x?.name).join() === [o.name, c2.name, o.name].join(), S.objectsOf(ph).map(x => x?.name));
    ok('RemoveObjectsFromShader: Target missing -> 0x80070057', status(run('RemoveObjectsFromShader', { InputObjs: [o] }), '80070057'));
  }

  // ================= RemoveShaderFromCnxPoint
  {
    const { m, ph } = fresh();
    const img = apply('Image', { owner: ph, name: 'diffuse' }); apply('Image', { owner: ph, name: 'ambient' });
    const img2 = src(ph, 'ambient');
    A.run('SIConnectShaderToCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'ambient' }], DeleteOnLastDisconnection: false });
    ok('setup: one Image shader on diffuse and ambient', src(ph, 'diffuse') === img && src(ph, 'ambient') === img, [src(ph, 'diffuse')?.name, src(ph, 'ambient')?.name, img2?.name]);
    let r = run('RemoveShaderFromCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'diffuse' }] });
    ok('RemoveShaderFromCnxPoint: disconnects; still used -> CreatedObj = the shader, status 0', !r.err && src(ph, 'diffuse') === null && src(ph, 'ambient') === img && r.v === img && last() === 0, r);
    r = run('RemoveShaderFromCnxPoint', { Source: img, InputObjs: [`${m.name}.Phong.ambient`] });
    ok('RemoveShaderFromCnxPoint: last disconnection deletes the shader, CreatedObj empty', !r.err && src(ph, 'ambient') === null && r.v === null && !T.nestedShaders(m).includes(img), r);
    A.undo(); ok('RemoveShaderFromCnxPoint undo: reconnected and back in its container', src(ph, 'ambient') === img && T.nestedShaders(m).includes(img));
    r = run('RemoveShaderFromCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'ambient' }], DeleteOnLastDisconnection: false });
    ok('RemoveShaderFromCnxPoint: DeleteOnLastDisconnection false keeps the unused shader and returns it', r.v === img && T.nestedShaders(m).includes(img), r);
    r = run('RemoveShaderFromCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'ambient' }] });
    ok('RemoveShaderFromCnxPoint: nothing disconnected -> S_FALSE (1), nothing else', !r.err && last() === 1 && r.v === null, r);
    ok('RemoveShaderFromCnxPoint: Source not a shader -> 0x80070057', status(run('RemoveShaderFromCnxPoint', { Source: 'sphere', InputObjs: [{ owner: ph, name: 'ambient' }] }), '80070057'));
    A.run('SIConnectShaderToCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'ambient' }] });
    A.lockRecordsB11.set(ph, [{ level: 0xffff, type: 0 }]);
    r = run('RemoveShaderFromCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'ambient' }] });
    ok('RemoveShaderFromCnxPoint: locked point -> lock error, skipped (S_FALSE)', src(ph, 'ambient') === img && has(r, /locked/) && last() === 1, r);
    A.lockRecordsB11.delete(ph);
  }

  // ================= RemoveAllShadersFromCnxPoint
  {
    const { ph } = fresh();
    const a1 = apply('Image', { owner: ph, name: 'ambient' }); const d1 = apply('Checkerboard', { owner: ph, name: 'diffuse' });
    let r = run('RemoveAllShadersFromCnxPoint', { InputObjs: [{ owner: ph, name: 'ambient' }, { owner: ph, name: 'diffuse' }] });
    ok('RemoveAllShadersFromCnxPoint: shaders removed from every point (siShaderCnxPointAll)', !r.err && src(ph, 'ambient') === null && src(ph, 'diffuse') === null && r.v.length === 2, r);
    A.undo(); ok('RemoveAllShadersFromCnxPoint undo', src(ph, 'ambient') === a1 && src(ph, 'diffuse') === d1);
    r = run('RemoveAllShadersFromCnxPoint', { InputObjs: [{ owner: ph, name: 'ambient' }], Type: 2 });
    ok('RemoveAllShadersFromCnxPoint: Type 2 (image clips only) keeps a shader node', !r.err && src(ph, 'ambient') === a1, r);
    ok('RemoveAllShadersFromCnxPoint: Type without bit 1 or 2 -> 0x80070057', status(run('RemoveAllShadersFromCnxPoint', { InputObjs: [{ owner: ph, name: 'ambient' }], Type: 4 }), '80070057'));
    ok('RemoveAllShadersFromCnxPoint: Type siShaderCnxPointBasePorts removes shader nodes', !run('RemoveAllShadersFromCnxPoint', { InputObjs: [{ owner: ph, name: 'ambient' }], Type: ':siShaderCnxPointBasePorts:siShaderCnxPointType' }).err && src(ph, 'ambient') === null);
  }

  // ================= UIMapButton
  {
    fresh(); const o = A.scene.find('sphere'); A.select([o]);
    let menu = null; S.hooks.popupMenu = (items, anchor, cmd) => { menu = { items, anchor, cmd }; return null; };
    const r = run('UIMapButton', { InputObjs: [o] });
    ok('UIMapButton: shows the pop-up at the anchor, returns 1, menu items logged as not yet attested', !r.err && menu?.cmd === 'UIMapButton' && last() === 1 && nya(r) >= 1, r);
    S.hooks.popupMenu = () => 0x562e80c7; run('UIMapButton', { InputObjs: [o] });
    ok('UIMapButton: an interactive-pick result 0x562e80c7 is passed back', last() === 0x562e80c7);
    delete S.hooks.popupMenu;
    ok('UIMapButton: no valid input (a light) -> 0x80004003', status(run('UIMapButton', { InputObjs: [A.run('GetPrimLight', { Preset: 'Point' }) ?? 'light'] }), '80004003') || status(run('UIMapButton', { InputObjs: ['nosuchobject'] }), '80004003'));
  }

  // ================= SIGetMaterialShader
  {
    const { o, m, ph } = fresh();
    let r = run('SIGetMaterialShader', { InputObjs: [o] });
    ok('SIGetMaterialShader: surface port of the object\'s material', !r.err && r.v.length === 1 && r.v[0] === ph, r);
    r = run('SIGetMaterialShader', { InputObjs: [m], Port: 5 });
    ok('SIGetMaterialShader: port 5 (shadow, inferred numbering) of a material', r.v?.[0] === ph && nya(r) >= 1, r);
    ok('SIGetMaterialShader: Port > 9 -> 0x80070057', status(run('SIGetMaterialShader', { InputObjs: [o], Port: 10 }), '80070057'));
    r = run('SIGetMaterialShader', { InputObjs: [o], Port: 1 });
    ok('SIGetMaterialShader: unconnected port appends nothing (not yet attested)', r.v?.length === 0 && nya(r) >= 1, r);
  }

  // ================= ReplaceShader / ReplaceShaderWithPreset / ReplaceShaderWithProgID
  {
    const { o, m, ph } = fresh();
    const img = apply('Image', { owner: ph, name: 'diffuse' });
    const chk = A.run('CreateShaderFromPreset', { Preset: 'Checkerboard' }); chk.name = 'Chk';
    let r = run('ReplaceShader', { Source: img, Target: chk });
    ok('ReplaceShader: the users of Source now use Target; Source is gone', !r.err && src(ph, 'diffuse') === chk && !T.nestedShaders(m).includes(img) && T.nestedShaders(m).includes(chk), r);
    A.undo(); ok('ReplaceShader undo', src(ph, 'diffuse') === img && T.nestedShaders(m).includes(img));
    ok('ReplaceShader: Source == Target -> 0x80070057', status(run('ReplaceShader', { Source: img, Target: img }), '80070057'));
    ok('ReplaceShader: Source not a shader -> 0x80070057', status(run('ReplaceShader', { Source: 'sphere', Target: chk }), '80070057'));
    r = run('ReplaceShader', { Source: [o], Target: [chk, chk] });
    ok('ReplaceShader list mode: the surface shader each object uses is replaced', !r.err && m.surface === chk, r);
    A.undo();
    r = run('ReplaceShaderWithPreset', { Source: img, PresetObj: 'Shaders\\Texture\\Checkerboard.Preset' });
    ok('ReplaceShaderWithPreset: new shader from the preset in the same container, then ReplaceShader', !r.err && r.v && src(ph, 'diffuse') === r.v && T.nestedShaders(m).includes(r.v) && !T.nestedShaders(m).includes(img), r);
    A.undo(); ok('ReplaceShaderWithPreset undo', src(ph, 'diffuse') === img);
    ok('ReplaceShaderWithPreset: unknown preset -> 0x80070057', status(run('ReplaceShaderWithPreset', { Source: img, PresetObj: 'NoSuchPreset' }), '80070057'));
    ph.get('diffuse') && (ph.get('specular').value = [0.25, 0.5, 0.75]);
    r = run('ReplaceShaderWithProgID', { ShaderToReplace: ph, ProgID: 'Softimage.material-lambert.1.0' });
    ok('ReplaceShaderWithProgID: definition changed in place, same-name values and still-existing connections kept', !r.err && m.surface === ph && ph.spdl?.file?.includes('lambert') && src(ph, 'diffuse') === img && !ph.get('specular'), r);
    A.undo(); ok('ReplaceShaderWithProgID undo: Phong definition and values back', ph.spdl?.file?.includes('phong') && JSON.stringify(ph.get('specular')?.value) === JSON.stringify([0.25, 0.5, 0.75]) && src(ph, 'diffuse') === img);
    ok('ReplaceShaderWithProgID: empty ProgID -> 0x80070057', status(run('ReplaceShaderWithProgID', { ShaderToReplace: ph, ProgID: '' }), '80070057'));
  }

  // ================= SetInstanceDataValue
  {
    const { o, ph } = fresh();
    let r = run('SetInstanceDataValue', { InputObjs: [ph], InputObj: o, Value: 42 });
    ok('SetInstanceDataValue: per-object value set on the holder', !r.err && S.instanceValue(ph, o) === 42, r);
    A.undo(); ok('SetInstanceDataValue undo', S.instanceValue(ph, o) === undefined);
    ok('SetInstanceDataValue: null InputObj -> 0x80004003', status(run('SetInstanceDataValue', { InputObjs: [ph], InputObj: null, Value: 1 }), '80004003'));
  }

  // ================= SIRebindByNameUserData / RenamePropAndRebind_Internal
  {
    const { o, m, ph } = fresh();
    const cav = apply('Vertex Color', { owner: ph, name: 'diffuse' });
    const P = o.properties[0].constructor; const u1 = new P('UserData', 'userdatamap', []); u1.parent = o; o.properties.push(u1);
    const c2 = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' }); const u2 = new P('UserData', 'userdatamap', []); u2.parent = c2; c2.properties.push(u2);
    const sp = cav.params.find(p => p.def.type === 'string' && !p.def.readOnly);
    if (sp) sp.value = u1.fullName;
    let r = run('SIRebindByNameUserData', { Material: m, 'Source User Data Collection': [u1], 'Target User Data Collection': [u2] });
    ok('SIRebindByNameUserData: a shader reference to the source entry now names the same-name target entry', !r.err && (!sp || sp.value === u2.fullName), [r, sp?.value]);
    ok('SIRebindByNameUserData: not a material -> 0x80004003', status(run('SIRebindByNameUserData', { Material: o, 'Source User Data Collection': [u1], 'Target User Data Collection': [u2] }), '80004003'));
    ok('SIRebindByNameUserData: unresolved list -> 0x80070057', status(run('SIRebindByNameUserData', { Material: m, 'Source User Data Collection': ['nothing'], 'Target User Data Collection': [u2] }), '80070057'));
    if (sp) sp.value = u1.fullName;
    r = run('RenamePropAndRebind_Internal', { Properties: [u1], PropertyName: 'Renamed' });
    ok('RenamePropAndRebind_Internal: renamed (SetValue sub-task), references updated, wildcards not yet attested', !r.err && u1.name === 'Renamed' && (!sp || sp.value === u1.fullName) && nya(r) >= 1, [r, sp?.value]);
    A.undo(); ok('RenamePropAndRebind_Internal undo', u1.name === 'UserData' && (!sp || sp.value === u1.fullName));
    r = run('RenamePropAndRebind_Internal', { Properties: [u1], PropertyName: 'bad name' });
    ok('RenamePropAndRebind_Internal: name check fails -> XSISHADERTASKS 0x6f, 0x80004005', status(r, '80004005') && has(r, /XSISHADERTASKS 0x6f/), r);
    ok('RenamePropAndRebind_Internal: PropertyName not a string -> 0x80070057', status(run('RenamePropAndRebind_Internal', { Properties: [u1], PropertyName: 5 }), '80070057'));
  }

  // ================= compounds
  {
    const { o, m, ph } = fresh();
    const img = apply('Image', { owner: ph, name: 'diffuse' }); const chk2 = apply('Checkerboard', { owner: ph, name: 'ambient' });   // stays outside: a crossing input
    let r = run('CreateShaderCompound', { InputObj: [ph, img], Name: 'MyCompound' });
    const comp = r.v;
    ok('CreateShaderCompound: a compound in the inputs\' container, returned', !r.err && comp instanceof ShaderCompound && comp.name === 'MyCompound' && T.nestedShaders(m).includes(comp), r);
    ok('CreateShaderCompound: the shaders moved inside', comp && comp.shaders().includes(ph) && comp.shaders().includes(img) && !T.nestedShaders(m).includes(img));
    ok('CreateShaderCompound: crossing output reconnected through the compound (material surface -> compound)', m.surface === comp, m.surface?.name);
    ok('CreateShaderCompound: inner connection kept', src(ph, 'diffuse') === img);
    const outs = comp?.exposed.filter(p => p.direction === 'output') ?? []; const ins = comp?.exposed.filter(p => p.direction === 'input') ?? [];
    ok('CreateShaderCompound: one output port, and an input port per crossing input', outs.length === 1 && ins.length === 1 && ins[0].name === 'ambient' && src(comp, 'ambient') === chk2 && src(ph, 'ambient') === null, comp?.exposed.map(p => `${p.direction}:${p.name}`));
    A.undo(); ok('CreateShaderCompound undo: tree as before', m.surface === ph && src(ph, 'diffuse') === img && src(ph, 'ambient') === chk2 && !T.nestedShaders(m).some(s => s instanceof ShaderCompound));
    A.redo(); ok('CreateShaderCompound redo', m.surface === comp);
    ok('CreateShaderCompound: not shaders -> 0x80070057', status(run('CreateShaderCompound', { InputObj: [o] }), '80070057'));

    // ports
    r = run('AddShaderCompoundPort', { ShaderPort: { owner: ph, name: 'specular' }, ShaderCompound: comp });
    const pA = r.v;
    ok('AddShaderCompoundPort: exposes the inner port and returns the compound port', !r.err && pA instanceof CompoundPort && pA.name === 'specular' && comp.exposed.includes(pA) && !!comp.get('specular'), r);
    r = run('AddShaderCompoundPort', { ShaderPort: { owner: ph, name: 'nosuchport' }, ShaderCompound: comp });
    ok('AddShaderCompoundPort: failure logs "AddCompoundPort Failed for " + port name', !!r.err && has(r, /AddCompoundPort Failed for /), r);
    const n0 = comp.exposed.length; const i0 = comp.exposed.indexOf(pA);
    r = run('MoveShaderCompoundPort', { InputObj: pA, Step: -1 });
    ok('MoveShaderCompoundPort: index + Step', !r.err && comp.exposed.indexOf(pA) === i0 - 1 && last() === 0, [r, comp.exposed.indexOf(pA)]);
    A.undo(); ok('MoveShaderCompoundPort undo', comp.exposed.indexOf(pA) === i0);
    r = run('MoveShaderCompoundPort', { InputObj: pA, Step: 5 });
    ok('MoveShaderCompoundPort: refused move -> S_FALSE, no change', !r.err && last() === 1 && comp.exposed.indexOf(pA) === i0, r);
    ok('MoveShaderCompoundPort: Step 0 -> 0x80070057', status(run('MoveShaderCompoundPort', { InputObj: pA, Step: 0 }), '80070057'));
    A.lockRecordsB11.set(comp, [{ level: 0xffff, type: 0 }]);
    ok('MoveShaderCompoundPort: locked compound -> 0x80070005', status(run('MoveShaderCompoundPort', { InputObj: pA, Step: -1 }), '80070005'));
    ok('RenameShaderCompoundPort: locked compound -> 0x80070005', status(run('RenameShaderCompoundPort', { InputObj: pA, Name: 'x' }), '80070005'));
    ok('RemoveShaderCompoundPort: locked compound -> 0x80070005', status(run('RemoveShaderCompoundPort', { InputObj: pA }), '80070005'));
    A.lockRecordsB11.delete(comp);
    r = run('RenameShaderCompoundPort', { InputObj: pA, Name: 'amb', DisplayName: 'Ambient' });
    ok('RenameShaderCompoundPort: name + display name set, NewName read back', !r.err && r.v === 'amb' && pA.name === 'amb' && pA.displayName === 'Ambient' && !!comp.get('amb'), r);
    r = run('RenameShaderCompoundPort', { InputObj: pA, Name: outs[0].name });
    ok('RenameShaderCompoundPort: a taken name -> the compound gives another one, read back into NewName', r.v && r.v !== outs[0].name && r.v === pA.name, r);
    A.undo(); ok('RenameShaderCompoundPort undo', pA.name === 'amb');
    r = run('RenameShaderCompoundPort', { InputObj: pA, Name: '' });
    ok('RenameShaderCompoundPort: empty Name -> no change, no error', !r.err && pA.name === 'amb', r);
    r = run('SetShaderCompoundPortProperties', { InputObj: pA, PPGMinValue: '0', PPGMaxValue: '10', PPGLayoutGroup: 'G', ModifyFlags: 1 | 2 });
    ok('SetShaderCompoundPortProperties: only the ModifyFlags fields change', !r.err && pA.props.PPGMinValue === '0' && pA.props.PPGMaxValue === '10' && pA.props.PPGLayoutGroup === '', pA.props);
    r = run('GetShaderCompoundPortProperties', { InputObj: pA });
    ok('GetShaderCompoundPortProperties: name, display name and the eight port properties', !r.err && r.v.length === 10 && r.v[0] === 'amb' && r.v[2] === '0' && r.v[3] === '10', r);
    A.undo(); ok('SetShaderCompoundPortProperties undo', pA.props.PPGMinValue === '' && pA.props.PPGMaxValue === '');
    r = run('SetShaderCompoundProperties', { InputObj: comp, Name: 'Comp2', Category: 'Cat', Author: 'Me', VersionMajor: 3, ModifyFlags: 1 | 2 | 64 });
    ok('SetShaderCompoundProperties: ModifyFlags bits 0 Name, 1 Category, 6 VersionMajor; others unchanged', !r.err && comp.name === 'Comp2' && comp.props.Category === 'Cat' && comp.props.VersionMajor === 3 && comp.props.Author === '', [comp.name, comp.props]);
    A.undo(); ok('SetShaderCompoundProperties undo', comp.name === 'MyCompound' && comp.props.Category === '');
    ok('SetShaderCompoundProperties: not a compound -> 0x80070057', status(run('SetShaderCompoundProperties', { InputObj: ph }), '80070057'));
    r = run('RemoveShaderCompoundPort', { InputObj: pA });
    ok('RemoveShaderCompoundPort: port and its parameter gone', !r.err && !comp.exposed.includes(pA) && !comp.get('amb'), r);
    A.undo(); ok('RemoveShaderCompoundPort undo', comp.exposed.includes(pA) && !!comp.get('amb'));
    r = run('RemoveShaderCompoundPort', { InputObj: 'nosuch' });
    ok('RemoveShaderCompoundPort: unresolved -> "Unable to resolve reference in RemoveShaderCompoundPortTask"', !!r.err && has(r, /Unable to resolve reference in RemoveShaderCompoundPortTask/), r);
    r = run('RemoveShaderCompoundPort', { InputObj: outs[0] });
    ok('RemoveShaderCompoundPort: output port -> outside connections disconnected', !r.err && m.surface === null, m.surface?.name);
    A.undo(); ok('RemoveShaderCompoundPort undo reconnects', m.surface === comp);

    // export / import
    ok('ExportShaderCompound: no compound -> 0x8000ffff', status(run('ExportShaderCompound', { Compound: ph, FullPath: 'C:\\tmp\\x.xsirtcompound' }), '8000ffff'));
    const file = 'C:\\B12\\Compounds\\My.xsirtcompound';
    r = run('ExportShaderCompound', { Compound: comp, FullPath: file });
    ok('ExportShaderCompound: written, Output = FullPath, registered under XSIRTCOMPOUND', !r.err && r.v === file && H.isFile(file) && S.library.some(e => e.type === 'XSIRTCOMPOUND' && e.path === file), r);
    const d = JSON.parse(H.readFile(file));
    ok('ExportShaderCompound: stand-in file marked inferred, holds the compound', d.inferred === true && d.type === 'XSIRTCOMPOUND' && d.compound.name === 'MyCompound' && d.compound.shaders.length === 2, d.type);
    r = run('ExportShaderCompound', { Compound: comp, FullPath: '' });
    ok('ExportShaderCompound: save failure -> XSISHADERTASKS 0xce, 0x80004005', status(r, '80004005') && has(r, /0xce/), r);
    const nm = comp.name; comp.name = ''; r = run('ExportShaderCompound', { Compound: comp, FullPath: file }); comp.name = nm;
    ok('ExportShaderCompound: no name -> XSISHADERTASKS 0xd0, 0x80004005', status(r, '80004005') && has(r, /0xd0/), r);
    const { m: m2 } = fresh();
    r = run('ImportShaderCompound', { Container: m2, Path: file });
    const ic = r.v;
    ok('ImportShaderCompound: loaded into the container, returned', !r.err && ic instanceof ShaderCompound && T.nestedShaders(m2).includes(ic) && ic.shaders().length === 2 && ic.exposed.length === d.compound.ports.length, r);
    A.undo(); ok('ImportShaderCompound undo', !T.nestedShaders(m2).includes(ic));
    r = run('ImportShaderCompound', { Container: m2, Path: 'My' });
    ok('ImportShaderCompound: a name that is not a file is looked up as a preset', !r.err && r.v instanceof ShaderCompound, r);
    ok('ImportShaderCompound: empty path -> 0x80070057', status(run('ImportShaderCompound', { Container: m2, Path: '' }), '80070057'));
    ok('ImportShaderCompound: not found -> 0x80004005', status(run('ImportShaderCompound', { Container: m2, Path: 'NoSuchCompound' }), '80004005'));

    // explode, re-create, nest / unnest
    const { m: m3, ph: ph3 } = fresh();
    const img3 = apply('Image', { owner: ph3, name: 'diffuse' });
    const c3 = A.run('CreateShaderCompound', { InputObj: [img3] });
    ok('CreateShaderCompound: default name (inferred) and an output port toward the Phong', c3?.name === 'ShaderCompound' && src(ph3, 'diffuse') === c3, [c3?.name, src(ph3, 'diffuse')?.name]);
    r = run('ExplodeShaderCompound', { InputObj: c3 });
    ok('ExplodeShaderCompound: inner shaders back in the container, rewired, compound deleted', !r.err && r.v?.[0] === img3 && src(ph3, 'diffuse') === img3 && T.nestedShaders(m3).includes(img3) && !T.nestedShaders(m3).includes(c3), r);
    A.undo(); ok('ExplodeShaderCompound undo', src(ph3, 'diffuse') === c3 && c3.shaders().includes(img3));
    ok('ExplodeShaderCompound: not a compound -> 0x8000ffff', status(run('ExplodeShaderCompound', { InputObj: ph3 }), '8000ffff'));
    const extra = A.run('CreateShaderFromPreset', { Preset: 'Checkerboard' }); A.run('SIConnectShaderToCnxPoint', { Source: extra, InputObjs: [{ owner: ph3, name: 'ambient' }] });
    r = run('NestShaders', { InputObjs: [extra], ShaderContainer: c3 });
    ok('NestShaders: the shader moves into the compound (connections left, worker not yet attested)', !r.err && c3.shaders().includes(extra) && nya(r) >= 1, r);
    r = run('UnnestShaders', { InputObjs: [extra] });
    ok('UnnestShaders: back to the compound\'s container', !r.err && !c3.shaders().includes(extra) && T.nestedShaders(m3).includes(extra), r);
    A.undo(); ok('UnnestShaders undo', c3.shaders().includes(extra));
    ok('NestShaders: no container -> 0x80070057', status(run('NestShaders', { InputObjs: [extra], ShaderContainer: 'sphere' }), '80070057'));
  }

  // ================= shader trees and definitions
  {
    const { m, ph } = fresh();
    const img = apply('Image', { owner: ph, name: 'diffuse' });
    const file = 'C:\\B12\\Trees\\Tree.Preset';
    let r = run('ExportShaderTree', { Shaders: [`${m.name}.surface`], FullPath: file, DisplayName: 'My Tree', Category: 'Cat' });
    const d = r.err ? null : JSON.parse(H.readFile(file));
    ok('ExportShaderTree: the tree under the port is written with display name and category; Output = FullPath', !r.err && r.v === file && d?.tree?.shaders?.length === 2 && d.tree.displayName === 'My Tree' && d.tree.ports[0].port === 'surface', r);
    const { m: m2 } = fresh(); m2.setSurface(null);
    r = run('ImportShaderTree', { Container: m2, Path: file });
    ok('ImportShaderTree: shaders created in the container, CreatedShaders returned, saved port reconnected', !r.err && r.v.length === 2 && r.v.every(s => T.nestedShaders(m2).includes(s)) && m2.surface === r.v[0] && !!src(r.v[0], 'diffuse'), r);
    A.undo(); ok('ImportShaderTree undo', m2.surface === null && !T.nestedShaders(m2).length);
    ok('ImportShaderTree: empty path -> 0x80070057', status(run('ImportShaderTree', { Container: m2, Path: '' }), '80070057'));
    ok('ImportShaderTree: unknown preset -> 0x80004005', status(run('ImportShaderTree', { Container: m2, Path: 'NoSuchTree' }), '80004005'));
    ok('ImportShaderTree: invalid container -> 0x80070057', status(run('ImportShaderTree', { Container: 'sphere', Path: file }), '80070057'));
    const dfile = 'C:\\B12\\Defs\\lambert.xml';
    r = run('ExportShaderDefinition', { ShaderDefinition: 'Softimage.material-lambert.1.0', FullPath: dfile });
    const dd = r.err ? null : JSON.parse(H.readFile(dfile));
    ok('ExportShaderDefinition: written under the element ShaderDefinition, Output = path', !r.err && r.v === dfile && dd?.ShaderDefinition?.spdl === 'material-lambert', r);
    r = run('ReplaceShadersDefinition', { Shaders: [ph], NewDefinition: dfile });
    ok('ReplaceShadersDefinition: rebuilt on the new definition; matching ports keep values and connections; OutputLog', !r.err && ph.spdl?.file?.includes('lambert') && src(ph, 'diffuse') === img && typeof r.v === 'string' && /diffuse: kept/.test(r.v), r);
    A.undo(); ok('ReplaceShadersDefinition undo', ph.spdl?.file?.includes('phong'));
    r = run('ReplaceShadersDefinition', { Shaders: [ph, img], NewDefinition: dfile });
    ok('ReplaceShadersDefinition: instances of two definitions -> the "Invalid Target instance" message', !!r.err && has(r, /Invalid Target instance was supplied\. All targeted instances must share the same definition\./), r);
    r = run('ReplaceShadersDefinition', { Shaders: [ph], NewDefinition: 'not a definition' });
    ok('ReplaceShadersDefinition: unparsable definition -> "Failed to upgrade the shader..."', !!r.err && has(r, /Failed to upgrade the shader\. The new definition could not be parsed\./), r);
  }
  A.run('NewScene');
  return out;
}, { NAMES, DEFAULT_OK: [...DEFAULT_OK] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_shadertasks_b12fg_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
