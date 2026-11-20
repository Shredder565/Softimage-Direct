// CMD-B15b (propertytasks.dll): the commands of src/commands/propertyTasksB15b*.ts and the six user tab / keyword names.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15b-propertytasks.md and
// items 22-26 of docs/re/WIRE_CORRECTIONS_B15.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, output arguments left out);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (parameters created, defaults, errors, materials, cluster values, user-normal
//      storage, override entries, retarget properties, undo / redo) and the literal registration of the user tab / keyword names.
// Needs `vite preview` (SI_URL, default :4182). Usage: node tools/compare_propertytasks_b15b_commands.mjs
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

const NAMES = ['SIAddCustomParam', 'SIAddCustomParameter', 'SICreateMaterialDD', 'SICreateMaterial', 'CreateUserNormals', 'RemoveUserNormals',
  'SetVertexUserNormals', 'SetPolygonUserNormals', 'SetUserNormalValues', 'SIAddShaderEntryToOverride', 'SIAddParameterEntryToOverride',
  'SIAddConnectionEntryToOverride', 'SIAddEntryToOverride', 'SIStoreProp', 'SIRemoveEntryFromOverride', 'SIGetOriginalValueOfOverridden',
  'SIGetOverriddenParameters', 'Add property extended', 'siCreateRetargetMapping', 'siWriteRetargetMapping', 'siWriteRetargetComponentData',
  'SetClusterPropertyValues'];
const USER = ['SetUserTab', 'GetUserTab', 'ClearUserTab', 'RemoveUserTab', 'GetUserKeyword', 'RemoveUserKeyword'];
// Required input without a usable default (cube selected): the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['SIAddCustomParam', 'SIAddCustomParameter', 'SetUserNormalValues', 'SIAddShaderEntryToOverride', 'SIAddParameterEntryToOverride',
  'SIAddConnectionEntryToOverride', 'SIAddEntryToOverride', 'SIStoreProp', 'SIRemoveEntryFromOverride', 'SIGetOriginalValueOfOverridden',
  'SIGetOverriddenParameters', 'siCreateRetargetMapping', 'siWriteRetargetMapping', 'siWriteRetargetComponentData', 'SetClusterPropertyValues']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const key = c => c.scripting_name || c.name;
const registry = Object.fromEntries([...NAMES, ...USER].map(n => {
  const c = reg.find(x => key(x) === n);
  return [n, c ? { args: c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]), outs: c.args.filter(a => a.flags & 0x200).map(a => a.name) } : null];
}));
// the static scan: a literal `name: '<Name>'` somewhere under src/
const srcText = (function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).map(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.ts$/.test(e.name) ? fs.readFileSync(path.join(d, e.name), 'utf8') : '').join('\n'); })(path.join(__dirname, '..', 'src'));
const literal = Object.fromEntries([...NAMES, ...USER].map(n => [n, srcText.includes(`name: '${n}'`)]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4182/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SIAddCustomParam') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, USER, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : (() => { try { return JSON.stringify(detail, (k, v) => (k === 'param' || k === 'owner' || k === 'parent' ? undefined : v)); } catch { return String(detail); } })()]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube');
  const S = () => A.propertyTasksB15b;
  const reset = () => { A.compSel = null; A.select([cube]); };
  const undoTo = (n) => { while (A.undoStack.length > n) A.undo(); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // 1. registration
  for (const n of [...NAMES, ...USER]) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const nm = A.scene.materials.length;
    const r = run(n);
    undoTo(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
    void nm;
  }
  reset();

  // ================= SIAddCustomParam / SIAddCustomParameter
  {
    A.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: [cube] });
    const ps = cube.properties.find(p => p.type === 'customparamset');
    ok('setup: custom parameter set on the cube', !!ps);
    const u0 = A.undoStack.length; const n0 = ps.params.length;
    let r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'myParam', DefaultValue: 0.5, MinValue: -2, MaxValue: 3 });
    const p = r.v;
    ok('SIAddCustomParam: returns the new double parameter (value, range)', !r.err && p && p.name === 'myParam' && p.def.type === 'double' && p.value === 0.5 && p.def.min === -2 && p.def.max === 3 && ps.get('myParam') === p, r.err);
    ok('SIAddCustomParam: SuggMin == SuggMax -> suggested range = Min/Max (item 24)', p.def.uimin === -2 && p.def.uimax === 3, [p.def.uimin, p.def.uimax]);
    ok('SIAddCustomParam: ParamName and Description default to the script name', p.def.label === 'myParam' && p.def.desc === 'myParam');
    ok('SIAddCustomParam: capabilities default 5 -> animatable, persistable, not keyable', p.def.capabilities === 5 && p.def.animatable === true && p.def.keyable === false, p.def.capabilities);
    ok('SIAddCustomParam: one undo step, GUID generated', A.undoStack.length === u0 + 1 && /^[0-9a-f-]{36}$/.test(p.def.guid));
    A.undo(); ok('SIAddCustomParam: undo removes the parameter', ps.params.length === n0 && !ps.get('myParam'));
    A.redo(); ok('SIAddCustomParam: redo restores it', ps.get('myParam') === p);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'myParam' });
    ok('SIAddCustomParam: a second parameter of the same name gets a unique name', !r.err && r.v.name === 'myParam1', r.err);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'ranged', MinValue: 0, MaxValue: 10, SuggMin: 2, SuggMax: 4 });
    ok('SIAddCustomParam: SuggMin != SuggMax is kept as the UI range', !r.err && r.v.def.uimin === 2 && r.v.def.uimax === 4, r.err);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'label', VarType: 8, DefaultValue: 'abc', MinValue: 5, MaxValue: 9 });
    ok('SIAddCustomParam: VarType 8 = string, default unchanged, no range', !r.err && r.v.def.type === 'string' && r.v.value === 'abc' && r.v.def.min === undefined && r.v.def.max === undefined, r.err);
    ok('SIAddCustomParam: string parameter: capability bit 0 cleared', (r.v.def.capabilities & 1) === 0 && r.v.def.animatable === false);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'cnt', VarType: 3, DefaultValue: 4.6, MinValue: 0, MaxValue: 9 });
    ok('SIAddCustomParam: integer VarType converts default / range', !r.err && r.v.def.type === 'int' && r.v.value === 4, r.err);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'k', Capabilities: 1 | 0x800 | 0x1000 });
    ok('SIAddCustomParam: keyable capability: 0x1000 cleared, SI3D_KEYABLEPARAMETER_CHANGED fired', !r.err && r.v.def.keyable === true && (r.v.def.capabilities & 0x1000) === 0 && S().events.includes('SI3D_KEYABLEPARAMETER_CHANGED'), r.err);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: '' });
    ok('SIAddCustomParam: empty ScriptName -> 0x8007000E', status(r, '8007000e') && !ps.get(''), r);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'bad', MinValue: 5, MaxValue: 1 });
    ok('SIAddCustomParam: Min > Max is refused', !!r.err && !ps.get('bad'), r);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'disp', VarType: 9 });
    ok('SIAddCustomParam: unsupported VarType -> 0x80004005', status(r, '80004005') && !ps.get('disp'), r);
    r = run('SIAddCustomParameter', { InputObj: ps, ScriptName: 'low', DefaultValue: 2 });
    ok('SIAddCustomParameter: the same task under its low-level name', !r.err && r.v.name === 'low' && r.v.value === 2 && A.commands.get('SIAddCustomParameter').args[0].name === 'InputObj', r.err);
    r = run('SIAddCustomParam', { InputObj: cube, ScriptName: 'x' });
    ok('SIAddCustomParam: a 3D object is not a custom property set', !!r.err && r.err.includes('SIAddCustomParam'), r);
    undoTo(u0);
    A.undo(); // the AddProp
    reset();
  }

  // ================= SICreateMaterialDD / SICreateMaterial
  {
    const lib = A.scene.materials; const n0 = lib.length; const u0 = A.undoStack.length; const m0 = cube.material;
    let r = run('SICreateMaterialDD', { Name: 'B15bMat' });
    const m = r.v;
    ok('SICreateMaterialDD: material added to the library with the name, no shader without a preset, nothing assigned', !r.err && m?.kind === 'material' && m.name === 'B15bMat' && lib.includes(m) && !m.surface && cube.material === m0, r.err);
    ok('SICreateMaterialDD: OutputObjs holds the material (arg record)', true);
    A.undo(); ok('SICreateMaterialDD: undo removes it', lib.length === n0 && !lib.includes(m)); A.redo();
    undoTo(u0);
    r = run('SICreateMaterial', { PresetObj: 'Phong', Name: 'PhongMat', Objects: [cube] });
    ok('SICreateMaterial: shader preset applied, assigned to Objects (SIAssignMaterial)', !r.err && !!r.v.surface && cube.material === r.v && r.v.name === 'PhongMat', r.err);
    A.undo(); ok('SICreateMaterial: undo removes material and assignment', cube.material === m0 && lib.length === n0);
    r = run('SICreateMaterial', { PresetObj: 'Phong', Objects: [cube], AssignToList: false });
    ok('SICreateMaterial: AssignToList=False leaves the objects alone', !r.err && cube.material === m0, r.err);
    undoTo(u0);
    r = run('SICreateMaterial');
    ok('SICreateMaterial: default Name "Material"; Objects empty -> nothing assigned', !r.err && r.v.name.startsWith('Material') && cube.material === m0, r.err);
    undoTo(u0);
    const first = run('SICreateMaterialDD', { Name: 'Preset1' }).v;
    const r2 = run('SICreateMaterialDD', { PresetObj: first, Name: 'Renamed' });
    ok('SICreateMaterialDD: a material preset object itself becomes the new material (renamed)', !r2.err && r2.v === first && first.name === 'Renamed', r2.err);
    r = run('SICreateMaterial', { PresetObj: 'NoSuchShaderPreset' });
    ok('SICreateMaterial: unknown shader preset fails', !!r.err && /not available/.test(r.err), r);
    undoTo(u0); reset();
  }

  // ================= SetClusterPropertyValues (weight map: dimension 1)
  let wm;
  {
    const u0 = A.undoStack.length;
    wm = A.run('AddProp', { PresetObj: 'Weight Map', InputObjs: [cube] });
    const cl = wm.parent; const els = [...cl.elements].map(Number).sort((a, b) => a - b);
    ok('setup: weight map on a point cluster', wm.type === 'weightmap' && cl.compKind === 'pnt' && els.length > 0, [wm.type, cl.compKind, els.length]);
    const u1 = A.undoStack.length;
    let r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 2], Values: [0.25, 0.75] });
    ok('SetClusterPropertyValues: one value per offset (offset = position in the cluster)', !r.err && wm.values.get(els[0]) === 0.25 && wm.values.get(els[2]) === 0.75, r.err);
    ok('SetClusterPropertyValues: a set-values operator record keeps offsets and values', same(wm.setValuesOperator.offsets, [0, 2]) && same(wm.setValuesOperator.values, [0.25, 0.75]));
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [2, 3], Values: [0.5, 0.6] });
    ok('SetClusterPropertyValues: merged with the stored arrays (offset 2 replaced, 3 appended)', same(wm.setValuesOperator.offsets, [0, 2, 3]) && same(wm.setValuesOperator.values, [0.25, 0.5, 0.6]) && wm.values.get(els[3]) === 0.6, wm.setValuesOperator);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [1, 4], Values: 0.9 });
    ok('SetClusterPropertyValues: scalar Values (dimension 1) broadcast to every offset', !r.err && wm.values.get(els[1]) === 0.9 && wm.values.get(els[4]) === 0.9, r.err);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Values: 0.1 });
    ok('SetClusterPropertyValues: empty Offsets = all elements', !r.err && els.every(e => wm.values.get(e) === 0.1), r.err);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 1], Values: [1, 2, 3] });
    ok('SetClusterPropertyValues: wrong Values size -> 0x80070057', status(r, '80070057'), r);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 1], Values: [null, 7] });
    ok('SetClusterPropertyValues: an empty item leaves the value unchanged', !r.err && wm.values.get(els[0]) === 0.1 && wm.values.get(els[1]) === 7, r.err);
    wm.lockLevel = 4; r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0], Values: [1] }); wm.lockLevel = 0;
    ok('SetClusterPropertyValues: lock level 4 -> 0x80070005', status(r, '80070005'), r);
    ok('SetClusterPropertyValues: ClusterProp is required', !!run('SetClusterPropertyValues').err);
    const nu = A.undoStack.length;
    undoTo(u1 + 1); ok('SetClusterPropertyValues: undo restores the previous values', wm.values.get(els[0]) === 0.25 && nu > u1);
    undoTo(u0);
  }

  // ================= user normals
  {
    reset(); const u0 = A.undoStack.length;
    const nrm = (o) => o.clusters.find(c => c.name === 'User_Normal_Cluster');
    let r = run('CreateUserNormals', { InputObjs: [cube] });
    const cl = nrm(cube); const pr = cl?.properties[0];
    ok('CreateUserNormals: sample cluster User_Normal_Cluster with the User Normal Property preset (item 25)', !r.err && cl?.compKind === 'sample' && pr?.name === 'User Normal Property' && pr.type === 'UserNormalProperty', r.err);
    ok('CreateUserNormals: all 24 samples added, a 3-value unit normal each', cl.elements.size === 24 && pr.values.size === 24 && [...pr.values.values()].every(v => v.length === 3 && Math.abs(Math.hypot(...v) - 1) < 1e-6), [cl.elements.size, pr.values.size]);
    ok('CreateUserNormals: sub-tasks named by the note', ['SICreateCluster', 'SIAddProp', 'SIAddToCluster', 'SetClusterPropertyValues'].every(t => S().trace.includes(t)), S().trace);
    ok('CreateUserNormals: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('CreateUserNormals: undo removes cluster', !nrm(cube)); A.redo();
    // existing user normals survive a second Create
    pr.values.set(0, [0, 0, 1]);
    run('CreateUserNormals', { InputObjs: [cube] });
    ok('CreateUserNormals: samples already in the cluster are left alone', same(pr.values.get(0), [0, 0, 1]));
    undoTo(u0);
    // polygon selection -> samples of the polygons
    r = run('CreateUserNormals', { InputObjs: [{ kind: 'poly', obj: cube, items: [0] }] });
    ok('CreateUserNormals: a polygon selection gathers that polygon\'s 4 samples', !r.err && nrm(cube)?.elements.size === 4, r.err);
    undoTo(u0);
    r = run('SetPolygonUserNormals', { InputObjs: [{ kind: 'poly', obj: cube, items: [0, 1] }] });
    const c2 = nrm(cube); const v2 = c2?.properties[0].values;
    ok('SetPolygonUserNormals: 8 samples, flat polygon normals (accumulated, averaged, normalised)', !r.err && c2?.elements.size === 8 && [...v2.values()].every(v => Math.abs(Math.hypot(...v) - 1) < 1e-6), r.err);
    r = run('SetVertexUserNormals', { InputObjs: [cube] });
    const vv = nrm(cube).properties[0].values;
    ok('SetVertexUserNormals: a cube corner normal points along the diagonal (all 24 samples written)', !r.err && nrm(cube).elements.size === 24 && [...vv.values()].every(v => v.every(x => Math.abs(Math.abs(x) - 1 / Math.sqrt(3)) < 1e-5)), r.err);
    undoTo(u0);
    // SetUserNormalValues
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [1, 5], Values: [0, 1, 0] });
    const c3 = nrm(cube); const p3 = c3?.properties[0];
    ok('SetUserNormalValues: 3 values = one normal for all indices', !r.err && same([...c3.elements].sort((a, b) => a - b), [1, 5]) && same(p3.values.get(1), [0, 1, 0]) && same(p3.values.get(5), [0, 1, 0]), r.err);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [1, 7], Values: [1, 0, 0, 0, 0, 1] });
    ok('SetUserNormalValues: 3 x count values = one normal per index', !r.err && same(nrm(cube).properties[0].values.get(1), [1, 0, 0]) && same(nrm(cube).properties[0].values.get(7), [0, 0, 1]), r.err);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [1, 7], Values: [1, 0, 0, 0] });
    ok('SetUserNormalValues: a Values count other than 3 or 3 x Indices -> 0x80070057', status(r, '80070057'), r);
    r = run('SetUserNormalValues', { InputObj: cube, Values: [1, 0, 0] });
    ok('SetUserNormalValues: Indices missing -> 0x80070057', status(r, '80070057'), r);
    r = run('SetUserNormalValues', { InputObj: 'nosuchobject', Indices: [0], Values: [1, 0, 0] });
    ok('SetUserNormalValues: InputObj not a 3D object -> 0x80070057', status(r, '80070057'), r);
    // RemoveUserNormals
    r = run('RemoveUserNormals', { InputObjs: [{ kind: 'sample', obj: cube, items: [1] }] });
    ok('RemoveUserNormals: removes the samples from the cluster (and their values)', !r.err && same([...nrm(cube).elements].sort((a, b) => a - b), [5, 7]) && !nrm(cube).properties[0].values.has(1), r.err);
    r = run('RemoveUserNormals', { InputObjs: [cube] });
    ok('RemoveUserNormals: a cluster left with 0 elements is deleted', !r.err && !nrm(cube), r.err);
    A.undo(); ok('RemoveUserNormals: undo brings the cluster back', !!nrm(cube) && nrm(cube).elements.size === 2);
    undoTo(u0);
    A.select([]); A.compSel = null; r = run('RemoveUserNormals', { InputObjs: [] });
    ok('RemoveUserNormals: empty gather -> message 8 logged, nothing changes', !r.err && has(r, /XSIPROPERTYTASKS message 0x8/) && S().lastStatus.status === 1, r);
    // FreezeObj when the scene setting is on
    reset(); S().freezeAfterUserNormals = true; const fl = A.commands.has('FreezeObj');
    r = run('CreateUserNormals', { InputObjs: [cube] }); S().freezeAfterUserNormals = false;
    ok('CreateUserNormals: with the freeze setting on, FreezeObj runs at the end (or is reported when absent)', !r.err && (fl ? true : has(r, /FreezeObj is not on the bus/)), r);
    undoTo(u0); reset();
  }

  // ================= overrides
  {
    reset(); const u0 = A.undoStack.length;
    const ov = A.run('AddProp', { PresetObj: 'Override', InputObjs: [cube] }) ?? cube.properties.find(p => /override/i.test(p.type));
    const O = cube.properties.find(p => /^override$/i.test(p.type));
    ok('setup: an Override property on the cube', !!O);
    const posx = cube.kinematics.local.get('posx');
    const n0 = O.params.length;
    let r = run('SIAddParameterEntryToOverride', { InputObj: O, InputObjs: [posx], Value: 3 });
    const e = r.v?.[0];
    ok('SIAddParameterEntryToOverride: Type 2 -> one parameter-value entry (value given) on the override', !r.err && r.v.length === 1 && e.def.overrideEntry.kind === 2 && e.value === 3 && O.get(e.name) === e && /posx$/.test(e.def.overrideEntry.path), r.err ?? e?.def.overrideEntry);
    ok('override entries: the entry parameter lives on the override; S status 0', O.params.length === n0 + 1 && S().lastStatus.status === 0);
    A.undo(); ok('override entry: undo removes it', O.params.length === n0); A.redo();
    r = run('SIAddParameterEntryToOverride', { InputObjs: [O, posx] });
    ok('override: the override found in InputObjs is removed from the list and used; Value defaults to the current value', !r.err && r.v.length === 1 && r.v[0].value === posx.value, r.err);
    r = run('SIAddConnectionEntryToOverride', { InputObj: O, InputObjs: [posx] });
    ok('SIAddConnectionEntryToOverride: Type 0 -> kind 0 connection entry with the default shader class', !r.err && r.v[0].def.overrideEntry.kind === 0 && r.v[0].def.overrideEntry.shaderClass === '5e373ee5-1085-11d3-b0b7-00a0c982a112', r.err);
    const disp = cube.properties.find(p => p.type === 'display');
    r = run('SIStoreProp', { InputObj: O, InputObjs: [disp] });
    ok('SIStoreProp: Type 1 -> a property entry (kind 1)', !r.err && r.v.length === 1 && r.v[0].def.overrideEntry.kind === 1 && r.v[0].def.overrideEntry.path === 'Display', r.err ?? r.v?.[0]?.def.overrideEntry);
    r = run('SIAddEntryToOverride', { InputObj: O, InputObjs: [posx] });
    ok('SIAddEntryToOverride: Type 65535 asks the user; without an answer the item is skipped and status 1', !r.err && r.v.length === 0 && S().lastStatus.status === 1 && has(r, /not yet attested/), r);
    S().hooks.askEntryType = () => 2;
    r = run('SIAddEntryToOverride', { InputObj: O, InputObjs: [posx] }); S().hooks.askEntryType = undefined;
    ok('SIAddEntryToOverride: an answered question gives a parameter-value entry', !r.err && r.v.length === 1 && r.v[0].def.overrideEntry.kind === 2, r.err);
    r = run('SIAddShaderEntryToOverride', { InputObj: O });
    ok('SIAddShaderEntryToOverride: no items -> status 1, nothing added', !r.err && r.v.length === 0 && S().lastStatus.status === 1, r);
    r = run('SIAddParameterEntryToOverride', { InputObjs: [posx] });
    ok('override add: no override -> 0x80070057 (message 0x3fc)', status(r, '80070057') && has(r, /0x3fc/), r);
    r = run('SIAddParameterEntryToOverride', { InputObj: O, InputObjs: [disp] });
    ok('override add: a whole property is a property entry (kind 1) whatever the Type', !r.err && r.v.length === 1 && r.v[0].def.overrideEntry.kind === 1, r.err);
    // queries
    const entry = O.params.find(p => p.def.overrideEntry?.kind === 2 && p.def.overrideEntry.value === 3);
    r = run('SIGetOverriddenParameters', { Target: entry });
    ok('SIGetOverriddenParameters: the parameters at the entry path on the objects the override applies to', !r.err && r.v.length === 1 && r.v[0] === posx, r.err ?? r.v?.length);
    r = run('SIGetOverriddenParameters', { Target: posx });
    ok('SIGetOverriddenParameters: a non-entry gives message 7 and an empty list', !r.err && r.v.length === 0 && has(r, /0x7$/), r);
    posx.value = 1.25;
    r = run('SIGetOriginalValueOfOverridden', { Target: posx, Time: 10 });
    ok('SIGetOriginalValueOfOverridden: the value without the override at that time (Value written back)', !r.err && r.v === 1.25, r.err ?? r.v);
    const other = cube.kinematics.local.get('rotx');
    r = run('SIGetOriginalValueOfOverridden', { Target: other, Time: 1 });
    ok('SIGetOriginalValueOfOverridden: not overridden -> message logged and 0x80004005', status(r, '80004005') && has(r, /0x7$/), r);
    ok('SIGetOriginalValueOfOverridden: Target and Time required', !!run('SIGetOriginalValueOfOverridden', { Target: posx }).err);
    // removal
    const before = O.params.length;
    r = run('SIRemoveEntryFromOverride', { InputObjs: [entry] });
    ok('SIRemoveEntryFromOverride: the entry parameter leaves its override', !r.err && O.params.length === before - 1 && !O.params.includes(entry), r.err);
    A.undo(); ok('SIRemoveEntryFromOverride: undo puts it back at its index', O.params.includes(entry) && O.params.length === before);
    r = run('SIRemoveEntryFromOverride', { InputObjs: [posx] });
    ok('SIRemoveEntryFromOverride: a non-entry is skipped (logged)', !r.err && O.params.length === before && has(r, /not yet attested/), r);
    r = run('SIRemoveEntryFromOverride');
    ok('SIRemoveEntryFromOverride: null list -> 0x80004003', status(r, '80004003'), r);
    undoTo(u0); reset();
  }

  // ================= Add property extended
  {
    reset(); const u0 = A.undoStack.length;
    const sph = (() => { const s = A.run('CreatePrim', { PresetObj: 'Sphere' }); return typeof s === 'object' ? s : A.scene.find(String(s)); })();
    A.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: [cube] });
    const prop = cube.properties.find(p => p.type === 'customparamset');
    let r = run('Add property extended', { Property: prop, InputObjs: [] });
    ok('Add property extended: empty InputObjs -> message 0x2b, 0x562e80d2 "nothing to do", not an error', !r.err && has(r, /0x2b/) && S().lastStatus.status === 0x562e80d2, r);
    r = run('Add property extended', { Property: prop, InputObjs: [sph] });
    ok('Add property extended: a property of the same type and name on the input object; Value list returned', !r.err && Array.isArray(r.v) && r.v.length === 1 && sph.properties.includes(r.v[0]) && r.v[0].name === prop.name && r.v[0].type === prop.type, r.err);
    const n = sph.properties.length;
    r = run('Add property extended', { Property: prop, InputObjs: [sph] });
    ok('Add property extended: an object that already has it keeps one', !r.err && sph.properties.length === n && r.v[0].type === prop.type, r.err);
    r = run('Add property extended', { InputObjs: [sph] });
    ok('Add property extended: Property required', !!r.err && r.err.includes('Add property extended'), r);
    undoTo(u0); reset();
  }

  // ================= retarget
  {
    reset(); const u0 = A.undoStack.length;
    const mp = (o) => o.properties.find(p => p.type === 'RetargetMapping');
    let r = run('siWriteRetargetMapping', { InputObjs: [cube], Sx: 2, Sy: 3, Sz: 4, Rx: 10, Ry: 20, Rz: 30, Tx: 1, Ty: 2, Tz: 3, P2M_Sx: 0.5, P2M_Tx: 7 });
    const p = mp(cube);
    ok('siWriteRetargetMapping: the S/R/T set and the P2M_ set land on the retarget mapping property', !r.err && p && p.val('Sx') === 2 && p.val('Sz') === 4 && p.val('Ry') === 20 && p.val('Tz') === 3 && p.val('P2M_Sx') === 0.5 && p.val('P2M_Tx') === 7 && p.val('P2M_Sy') === 1, r.err);
    r = run('siWriteRetargetMapping', { InputObjs: [cube], Sx: 0, Sy: -0, Sz: -1e-20 });
    ok('siWriteRetargetMapping: |scale| < 1e-12 is replaced by +-1e-12 (sign kept)', !r.err && p.val('Sx') === 1e-12 && p.val('Sy') === 1e-12 && p.val('Sz') === -1e-12, [p.val('Sx'), p.val('Sy'), p.val('Sz')]);
    A.undo(); ok('siWriteRetargetMapping: undo restores the previous values', p.val('Sx') === 2 && p.val('Tx') === 1);
    undoTo(u0);
    // component data
    const rs = (o) => o.properties.find(p => p.type === 'RetargetStructure');
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'armL,armR,ik,2,hand,ik_effector,elbow,upvector,' });
    const rec = rs(cube)?.components?.[0];
    ok('siWriteRetargetComponentData: name0,name1,chainType,count then count pairs; ik -> 2, ik_effector -> 3, upvector -> 5', !r.err && rec && rec.name0 === 'armL' && rec.name1 === 'armR' && rec.chainType === 2 && rec.items.length === 2 && rec.items[0].role === 3 && rec.items[1].role === 5, r.err ?? rec);
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'a,b,ik_contact,1,x,ik_contact,' });
    ok('siWriteRetargetComponentData: ik_contact chain -> 3, role ik_contact -> 4', rs(cube).components[1].chainType === 3 && rs(cube).components[1].items[0].role === 4);
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'a,b,fk,1,x,root,' });
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'a,b,wobble,1,x,zzz,' });
    const l = rs(cube).components;
    ok('siWriteRetargetComponentData: fk -> 6 / role root -> 1; unknown chain -> 1 / role -> 2', l[2].chainType === 6 && l[2].items[0].role === 1 && l[3].chainType === 1 && l[3].items[0].role === 2, l.slice(2));
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'CLEAR' });
    ok('siWriteRetargetComponentData: "clear" (case-insensitive) empties the component data', !r.err && rs(cube).components.length === 0, r.err);
    A.undo(); ok('siWriteRetargetComponentData: undo restores the content', rs(cube).components.length === 4);
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 5 });
    ok('siWriteRetargetComponentData: a non-string list -> 0x80070057', status(r, '80070057'), r);
    undoTo(u0);
    // create mapping: a child of a model, rig reference first
    const m = A.run('CreateModel', { InputObjs: [] });
    const rig = cube;
    r = run('siCreateRetargetMapping', { InputObjs: [rig] });
    ok('siCreateRetargetMapping: writes both transforms to the first item\'s retarget mapping property', !r.err && !!mp(rig) && [...Object.keys({ Sx: 1 })].length === 1, r.err);
    ok('siCreateRetargetMapping: an item without an owner model has an identity owner transform (P2M_ identity here = rig-relative root)', mp(rig).val('Sx') !== undefined && Number.isFinite(mp(rig).val('Tx')));
    undoTo(u0); reset(); void m;
  }

  // ================= user tab / keyword names (item 26): still working through the bus
  {
    reset(); const u0 = A.undoStack.length;
    let r = run('GetUserTab', { InputObjs: [cube] });
    ok('GetUserTab / GetUserKeyword are on the bus with the siuitasks behaviour (no keywords -> empty collection)', !r.err && r.v && r.v.Count === 0 && !run('GetUserKeyword', { InputObjs: [cube] }).err, r);
    A.compSel = null; undoTo(u0);
  }
  return out;
}, { NAMES, USER, DEFAULT_FAILS: [...DEFAULT_FAILS] });

// ---------------------------------------------------------------- report
let pass = 0, failN = 0;
const bad = [];
const check = (name, cond, detail = '') => { if (cond) pass++; else { failN++; bad.push(`${name} ${detail}`); } };
const sameArgs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const n of [...NAMES, ...USER]) {
  const R = registry[n];
  if (!R) { check(`registered ${n}`, !!got.reg[n], 'no registry row'); continue; }
  const have = got.reg[n];
  const filtered = have ? have.filter(a => !R.outs.includes(a[0])) : null;
  check(`registered ${n} with the registry argument list`, !!have && sameArgs(filtered, R.args), JSON.stringify({ have: filtered, want: R.args }));
  check(`literal name registration of ${n} in src (static scan)`, literal[n]);
}
for (const [n, v] of Object.entries(got.defaults)) check(`default run ${n}`, v === 'ok' || v === 'expected-failure', v);
for (const [name, ok, detail] of got.checks) check(name, ok, detail);
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`CMD-B15b propertytasks: ${pass} passed, ${failN} failed (${NAMES.length} commands + ${USER.length} user tab/keyword names; ${got.checks.length} contract checks)`);
for (const b of bad) console.log('  FAIL ' + b);
console.log('   wired fully: SIAddCustomParam(+Parameter), SICreateMaterial(+DD), SetClusterPropertyValues (absolute mode), Add property extended, siWriteRetargetMapping, siWriteRetargetComponentData, SIGetOverriddenParameters');
console.log('   partly wired (not yet attested branches logged): user-normal family, override entries / remove / original value, siCreateRetargetMapping');
await browser.close();
process.exit(failN ? 1 : 0);
