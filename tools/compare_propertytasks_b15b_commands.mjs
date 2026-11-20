// CMD-B15b (propertytasks.dll): the 20 commands of src/commands/propertyTasksB15b.ts / propertyTasksB15bClusters.ts, plus
// the user tab / keyword commands of CMD-B7a whose registrations were made literal (WIRE_CORRECTIONS_B15 item 26).
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15b-propertytasks.md and
// docs/re/WIRE_CORRECTIONS_B15.md items 22-26.
//   1. every name is registered with the registry argument list (data/commands_full.json) and named literally in src/
//      (the static scan of tools/build_coverage_ledger.py finds it);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (commands whose default input cannot be valid must fail with a message naming the command);
//   3. the contract's stated results (cluster-property packing, user-normal storage, custom parameter rules, material
//      creation, override entries, retarget data, statuses and HRESULTs).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_propertytasks_b15b_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = [
  'SIAddCustomParam', 'SICreateMaterialDD', 'Add property extended',
  'CreateUserNormals', 'RemoveUserNormals', 'SetVertexUserNormals', 'SetPolygonUserNormals', 'SetUserNormalValues', 'SetClusterPropertyValues',
  'SIAddConnectionEntryToOverride', 'SIAddParameterEntryToOverride', 'SIAddShaderEntryToOverride', 'SIRemoveEntryFromOverride',
  'SIGetOverriddenParameters', 'SIGetOriginalValueOfOverridden',
  'siCreateRetargetMapping', 'siWriteRetargetMapping', 'siWriteRetargetComponentData',
  'MarkObjectDirty', 'AddShaderAttachedComment',
];
const LITERAL = ['SetUserTab', 'GetUserTab', 'ClearUserTab', 'RemoveUserTab', 'GetUserKeyword', 'RemoveUserKeyword',
  'SetUserKeyword', 'ClearUserKeyword', 'AddUserKeyword', 'AddUserTab'];
const DEFAULT_FAILS = new Set(['SIAddCustomParam', 'Add property extended', 'SIAddConnectionEntryToOverride', 'SIAddParameterEntryToOverride',
  'SIAddShaderEntryToOverride', 'SIGetOriginalValueOfOverridden', 'SetClusterPropertyValues', 'SetUserNormalValues']);

// registry argument lists (the low-level SIAddCustomParam entry; the registry has two SIAddCustomParameter rows)
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));

// static scan (same pattern as tools/build_coverage_ledger.py): every name must appear quoted in src/
const srcBlob = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) srcBlob.push(fs.readFileSync(p, 'utf8')); } };
walk(path.join(ROOT, 'src'));
const blob = srcBlob.join('\n');
const literal = Object.fromEntries([...NAMES, ...LITERAL].map(n => [n, new RegExp(`['"]${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(blob)]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('siWriteRetargetComponentData') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, LITERAL, DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const X = A.propertyTasksB15bApi, ST = A.propertyTasksB15b, FR = A.faceRobotB14a;
  const out = { reg: {}, cat: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)?.slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B15b/.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  const nearArr = (a, b, e = 1e-6) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => near(v, b[i], e));
  const J = JSON.stringify;
  const cube = A.scene.find('cube');
  const others = [...A.scene.allObjects()].filter(o => o !== cube && o !== A.scene.root);
  const meshless = others.find(o => !o.primitive?.mesh?.());
  const other = others.find(o => o.primitive?.mesh?.()) ?? others[0];
  const reset = () => { A.select([cube]); A.compSel = null; };
  const undoTo = (u0) => { while (A.undoStack.length > u0) A.undo(); };

  // 1. registration
  for (const n of [...NAMES, ...LITERAL]) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; out.cat[n] = d?.category ?? null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    undoTo(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ================= SetClusterPropertyValues
  try {
    const c = new FR.Cluster('b15b_wc', 'pnt', new Set([6, 0, 4, 2])); cube.addCluster(c);
    const wm = new FR.Property('B15bWM', 'weightmap', []); c.addProperty(wm);
    const u0 = A.undoStack.length;
    let r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: null, Values: 0.5 });
    ok('SCPV: empty Offsets = every element; a scalar is broadcast (dimension 1)', !r.err && [0, 2, 4, 6].every(i => wm.values.get(i) === 0.5), [r, [...(wm.values ?? new Map())]]);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [1, 3], Values: [0.1, 0.2] });
    ok('SCPV: offsets are positions in the ascending element order; count x dimension values = one per offset', wm.values.get(2) === 0.1 && wm.values.get(6) === 0.2 && wm.values.get(0) === 0.5, [...wm.values]);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 3], Values: [0.9] });
    ok('SCPV: an array of exactly `dimension` items is used for every offset', wm.values.get(0) === 0.9 && wm.values.get(6) === 0.9, [...wm.values]);
    ok('SCPV: the operator record merges offsets and values (ApplyOperator once)', J(wm.setValuesOp.offsets.slice().sort()) === J([0, 1, 2, 3]) && A.undoStack.length - u0 === 3, [wm.setValuesOp, A.undoStack.length - u0]);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 1], Values: [1, 2, 3] });
    ok('SCPV: any other size -> 0x80070057 with message 0xf', status(r, '80070057') && /message 0xf/.test(r.err), r);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [9], Values: 1 });
    ok('SCPV: an offset past the elements -> 0x80070057', status(r, '80070057'), r);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0, 1], Values: [null] });
    ok('SCPV: a dimension tuple with no number -> 0x80070057', status(r, '80070057'), r);
    r = run('SetClusterPropertyValues', { ClusterProp: cube.properties[0], Offsets: [0], Values: 1 });
    ok('SCPV: a property that is not on a cluster -> 0x80070057', status(r, '80070057'), r);
    r = run('SetClusterPropertyValues', { ClusterProp: wm, Offsets: [0], Values: 1, Mode: 3, ClampValues: true });
    ok('SCPV: other modes / ClampValues log "not yet attested" and write absolute values', !r.err && nya(r) && wm.values.get(0) === 1, r);
    undoTo(u0);
    ok('SCPV: undo restores values and removes the operator record', wm.values.size === 0 && wm.setValuesOp === undefined, [[...wm.values], wm.setValuesOp]);
    cube.removeCluster(c);
  } catch (e) { ok('SCPV block threw', false, String(e?.stack ?? e)); }

  // ================= user normals
  try {
    reset();
    const m = cube.primitive.mesh(); const T = X.sampleTable(m); const NS = T.pnt.length;
    const vn = X.vertexNormals(m);
    const u0 = A.undoStack.length;
    let r = run('CreateUserNormals');
    let c = X.userNormalCluster(cube); let p = c && X.userNormalProperty(c);
    ok('CreateUserNormals: whole object -> sample cluster User_Normal_Cluster with every sample', !!c && c.name === 'User_Normal_Cluster' && c.compKind === 'sample' && c.elements.size === NS, [r, c?.name, c?.elements?.size, NS]);
    ok('CreateUserNormals: property "User Normal Property" (type normal, dimension 3)', !!p && p.name === 'User Normal Property' && p.type === 'normal' && X.clusterPropDim(p) === 3, p && [p.name, p.type]);
    ok('CreateUserNormals: the current geometric (vertex) normals are written, unit length', !!p && [...Array(NS).keys()].every(s => nearArr(p.values.get(s), vn[T.pnt[s]])), p && [...p.values].slice(0, 3));
    ok('CreateUserNormals: undo steps = SICreateCluster, SIAddProp, SIAddToCluster, ApplyOperator, SetValue (one entry)', A.undoStack.length - u0 === 1, A.undoStack.length - u0);
    undoTo(u0);
    ok('CreateUserNormals: undo removes the cluster', !X.userNormalCluster(cube));
    r = run('CreateUserNormals', { InputObjs: 'cube.poly[0]' });
    c = X.userNormalCluster(cube);
    ok('CreateUserNormals: a polygon stands for its samples', !!c && c.elements.size === m.polygons[0].length, c && [...c.elements]);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [0, 1], Values: [0, 0, 1] });
    p = X.userNormalProperty(c);
    ok('SetUserNormalValues: 3 values = one normal for every index', !r.err && nearArr(p.values.get(0), [0, 0, 1]) && nearArr(p.values.get(1), [0, 0, 1]), [r, p.values.get(0)]);
    r = run('CreateUserNormals', { InputObjs: [cube] });
    ok('CreateUserNormals: samples already in the cluster keep their value; the others are added', c.elements.size === NS && nearArr(p.values.get(0), [0, 0, 1]) && nearArr(p.values.get(NS - 1), vn[T.pnt[NS - 1]]), [c.elements.size, p.values.get(0)]);
    r = run('SetUserNormalValues', { InputObj: [cube], Indices: [2, 3], Values: [1, 0, 0, 0, 1, 0] });
    ok('SetUserNormalValues: 3 x Indices values = one normal per index', nearArr(p.values.get(2), [1, 0, 0]) && nearArr(p.values.get(3), [0, 1, 0]), [p.values.get(2), p.values.get(3)]);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [2, 3], Values: [1, 0, 0, 1] });
    ok('SetUserNormalValues: another count -> 0x80070057', status(r, '80070057'), r);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: null, Values: [1, 0, 0] });
    ok('SetUserNormalValues: Indices missing -> 0x80070057', status(r, '80070057'), r);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: 4, Values: 5 });
    ok('SetUserNormalValues: Values not an array -> 0x80070057', status(r, '80070057'), r);
    r = run('SetUserNormalValues', { InputObj: cube, Indices: 4, Values: [0, 0, -1] });
    ok('SetUserNormalValues: a scalar Indices is accepted', !r.err && nearArr(p.values.get(4), [0, 0, -1]), r);
    if (meshless) { r = run('SetUserNormalValues', { InputObj: meshless, Indices: 0, Values: [0, 0, 1] }); ok('SetUserNormalValues: InputObj that is not a mesh object -> 0x80070057', status(r, '80070057'), r); }
    r = run('SetUserNormalValues', { InputObj: cube, Indices: [9999], Values: [0, 0, 1] });
    ok('SetUserNormalValues: no usable sample -> warning message 8, status 1', !r.err && has(r, /message 0x8;/) && ST.status.SetUserNormalValues === 1, [r, ST.status.SetUserNormalValues]);
    r = run('SetPolygonUserNormals', { InputObjs: 'cube.poly[2]' });
    const pn = X.polygonNormal(m, 2); const s2 = T.poly.map((pp, i) => [pp, i]).filter(([pp]) => pp === 2).map(([, i]) => i);
    ok('SetPolygonUserNormals: the polygon normal on each of its samples', s2.every(s => nearArr(p.values.get(s), pn)) && nearArr(pn.map(Math.abs).sort(), [0, 0, 1]), [pn, s2.map(s => p.values.get(s))]);
    ok('SetPolygonUserNormals: the unread accumulation logs "not yet attested"', nya(r), r.log);
    const s0 = T.pnt.map((v, i) => [v, i]).filter(([v]) => v === 0).map(([, i]) => i);
    r = run('SetVertexUserNormals', { InputObjs: 'cube.pnt[0]' });
    ok('SetVertexUserNormals: the vertex normal on every sample of the point', s0.length >= 3 && s0.every(s => nearArr(p.values.get(s), vn[0])), s0.map(s => p.values.get(s)));
    const f0 = m.polygons[0]; r = run('RemoveUserNormals', { InputObjs: `cube.edge[${f0[0]}-${f0[1]}]` });
    const atEdge = T.pnt.map((v, i) => [v, i]).filter(([v, i]) => (v === f0[0] || v === f0[1]) && m.polygons[T.poly[i]].includes(f0[0]) && m.polygons[T.poly[i]].includes(f0[1])).map(([, i]) => i);
    ok('RemoveUserNormals: an edge stands for the samples at its points in its polygons (inferred); values removed', atEdge.length === 4 && atEdge.every(s => !c.elements.has(s) && !p.values.has(s)) && c.elements.size === NS - 4, [atEdge, c.elements.size]);
    ST.bleedSelectionPref = true; r = run('RemoveUserNormals', { InputObjs: [cube] });
    ok('RemoveUserNormals: the cluster left empty is deleted (DeleteObj)', !X.userNormalCluster(cube) && !cube.clusters.includes(c), cube.clusters.map(k => k.name));
    ok('BleedSelection: not given -> preference TweakNormals.bleedselection, written back', ST.bleedOut.RemoveUserNormals === true);
    ST.bleedSelectionPref = false;
    r = run('CreateUserNormals', { InputObjs: [cube], BleedSelection: true });
    ok('BleedSelection: the argument overrides the preference', ST.bleedOut.CreateUserNormals === true);
    const fz = A.commands.get('FreezeObj'); const calls = []; const ex0 = fz.execute; fz.execute = (_a, a) => { calls.push(a.InputObjs); };
    ST.freezeAfterWrite = true; run('SetVertexUserNormals', { InputObjs: 'cube.pnt[1]' }); ST.freezeAfterWrite = false; fz.execute = ex0;
    ok('freeze setting on -> FreezeObj on the written objects at the end', calls.length === 1 && calls[0].includes(cube), calls.length);
    if (meshless) { r = run('CreateUserNormals', { InputObjs: [meshless] }); ok('user normals: nothing gathered -> warning message 8, status 1', !r.err && has(r, /message 0x8;/) && ST.status.CreateUserNormals === 1, r); }
    A.select([cube]); A.selectComponents(cube, 'polygon', [1]); r = run('RemoveUserNormals');
    ok('user normals: InputObjs not given = the component selection', !r.err && [...X.userNormalCluster(cube).elements].every(s => T.poly[s] !== 1), r);
    undoTo(u0); reset();
    ok('user normals: undo restores the object', !X.userNormalCluster(cube));
  } catch (e) { ok('user normals block threw', false, String(e?.stack ?? e)); }

  // ================= SIAddCustomParam
  let strParam = null; let ps = null;
  try {
    reset();
    ps = cube.addProperty(new FR.Property('B15bCustomPSet', 'customparamset', []));
    const n0 = ps.params.length; const u0 = A.undoStack.length;
    let r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'my param' });
    const p = ps.params[n0];
    ok('SIAddCustomParam: name passed through ValidateNameSyntax (corrected spelling used)', !r.err && p?.name === 'my_param', [r, p?.name]);
    ok('SIAddCustomParam: ParamName and Description default to the script name', p?.def.label === 'my_param' && p?.def.desc === 'my_param', p?.def);
    ok('SIAddCustomParam: defaults siDouble, min 0, max 1; SuggMin == SuggMax -> suggested range = Min/Max', p?.def.type === 'double' && p.def.siVarType === 5 && p.def.min === 0 && p.def.max === 1 && p.def.uimin === 0 && p.def.uimax === 1 && p.value === 0, p?.def);
    ok('SIAddCustomParam: Capabilities 5 (+ bit 4 always) -> animatable, persistable', p?.def.siCapabilities === 5 && p.def.animatable === true && p.def.keyable === false, p?.def.siCapabilities);
    ok('SIAddCustomParam: Classification default -32768 (I2 of 32768); a ParamGuid is generated', p?.def.siClassification === -32768 && /^\{[0-9a-f-]{36}\}$/.test(p?.def.guid ?? ''), [p?.def.siClassification, p?.def.guid]);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'my_param' });
    ok('SIAddCustomParam: the name is made unique on the property', ps.params[n0 + 1]?.name === 'my_param1', ps.params.map(q => q.name));
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'sp', MinValue: 0, MaxValue: 10, SuggMin: 2, SuggMax: 8, DefaultValue: 2.7, VarType: ':siInt4:siVariantType' });
    let q = ps.get('sp');
    ok('SIAddCustomParam: SuggMin/SuggMax kept when different; values converted to VarType (siInt4)', q?.def.type === 'int' && q.def.uimin === 2 && q.def.uimax === 8 && q.value === 2 && q.def.max === 10, q?.def);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'txt', VarType: 8, DefaultValue: 'hello', MinValue: 3 });
    q = ps.get('txt'); strParam = q;
    ok('SIAddCustomParam: VarType 8 (string) -> default unchanged, no range, capability bit 0 cleared', q?.def.type === 'string' && q.value === 'hello' && q.def.min === undefined && q.def.siCapabilities === 4 && q.def.animatable === false, q?.def);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'flag', VarType: 'siBool', DefaultValue: 1 });
    ok('SIAddCustomParam: siBool -> a boolean parameter', ps.get('flag')?.def.type === 'bool' && ps.get('flag').value === true, ps.get('flag')?.def);
    const ev0 = ST.events.length;
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'kk', Capabilities: 0x1801 });
    q = ps.get('kk');
    ok('SIAddCustomParam: 0x800 set clears 0x1000; SI3D_KEYABLEPARAMETER_CHANGED fired', q?.def.siCapabilities === 0x805 && q.def.keyable === true && ST.events.length === ev0 + 1 && ST.events[ev0] === 'SI3D_KEYABLEPARAMETER_CHANGED', [q?.def.siCapabilities, ST.events]);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: '' });
    ok('SIAddCustomParam: empty ScriptName -> 0x8007000E', status(r, '8007000e'), r);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'disp', VarType: 9 });
    ok('SIAddCustomParam: unsupported VarType (mask 0xcf093c) -> 0x80004005, message 0x2b', status(r, '80004005') && /message 0x2b/.test(r.err), r);
    r = run('SIAddCustomParam', { InputObj: ps, ScriptName: 'bad', MinValue: 5, MaxValue: 1 });
    ok('SIAddCustomParam: Min > Max is rejected', !!r.err && !ps.get('bad'), r);
    r = run('SIAddCustomParam', { InputObj: cube, ScriptName: 'onobj' });
    ok('SIAddCustomParam: an object target (container lookup not read) fails with "not yet attested"', !!r.err && /not yet attested/.test(r.err), r);
    const u1 = A.undoStack.length; run('SIAddCustomParam', { InputObj: ps, ScriptName: 'undoMe' }); undoTo(u1);
    ok('SIAddCustomParam: undo removes the parameter (and its name)', !ps.get('undoMe') && !ps.params.some(x => x.name === 'undoMe'));
    A.redo(); ok('SIAddCustomParam: redo puts the same parameter back', !!ps.get('undoMe')); A.undo();
    void u0;
  } catch (e) { ok('SIAddCustomParam block threw', false, String(e?.stack ?? e)); }

  // ================= SICreateMaterialDD
  try {
    reset();
    const mats = () => A.scene.materials.length; const u0 = A.undoStack.length; const m0 = mats(); const cubeMat = cube.material;
    let r = run('SICreateMaterialDD');
    ok('SICreateMaterialDD: defaults -> a new material in the library, no shader applied, nothing assigned, returned in a list', !r.err && Array.isArray(r.v) && r.v.length === 1 && r.v[0].kind === 'material' && r.v[0].surface === null && mats() === m0 + 1 && cube.material === cubeMat, r);
    r = run('SICreateMaterialDD', { PresetObj: 'Phong', Name: 'B15bMat', Objects: [cube] });
    const mm = r.v?.[0];
    ok('SICreateMaterialDD: shader preset -> SIApplyShader on the new material; Name renames; Objects assigned', !!mm && !!mm.surface && mm.name === 'B15bMat' && cube.material === mm, [r, mm?.name]);
    r = run('SICreateMaterialDD', { PresetObj: 'Lambert', Objects: [cube], AssignToList: false });
    ok('SICreateMaterialDD: AssignToList false clears the Objects list', cube.material === mm && !!r.v?.[0]?.surface, r);
    const n1 = mats(); r = run('SICreateMaterialDD', { PresetObj: mm, Name: 'B15bMat2' });
    ok('SICreateMaterialDD: a material preset becomes the material itself (no new one), renamed', r.v?.[0] === mm && mm.name === 'B15bMat2' && mats() === n1, r);
    r = run('SICreateMaterialDD', { PresetObj: 'NoSuchShaderB15b' });
    ok('SICreateMaterialDD: SIApplyShader failure -> 0x80004005', status(r, '80004005'), r);
    r = run('SICreateMaterialDD', { Library: 'Sources.Materials.DefaultLib', Initialize: false });
    ok('SICreateMaterialDD: Library / Initialize=False log "not yet attested"', !r.err && nya(r), r);
    undoTo(u0);
    ok('SICreateMaterialDD: undo removes materials and the assignment', mats() === m0 && cube.material === cubeMat);
  } catch (e) { ok('SICreateMaterialDD block threw', false, String(e?.stack ?? e)); }

  // ================= Add property extended
  try {
    reset();
    const u0 = A.undoStack.length;
    const src = cube.properties.find(p => p.type === 'customparamset') ?? cube.addProperty(new FR.Property('B15bCustomPSet', 'customparamset', []));
    let r = run('Add property extended', { Property: src, InputObjs: [other] });
    ok('Add property extended: SIAddProp (add-existing) per input object; results in Value', !r.err && Array.isArray(r.v) && r.v.length === 1 && other.properties.includes(r.v[0]) && r.v[0].name === src.name, [r, other?.name]);
    r = run('Add property extended', { Property: src, InputObjs: [] });
    ok('Add property extended: empty InputObjs -> message 0x2b logged, status 0x562e80d2, no error', !r.err && has(r, /message 0x2b/) && ST.status['Add property extended'] === 0x562e80d2, r);
    r = run('Add property extended', { Property: cube, InputObjs: [other] });
    ok('Add property extended: Property not a property -> 0x80070057', status(r, '80070057') && r.err.includes('Add property extended'), r);
    const insp = new FR.Property('InspectB15b', 'customparamset', []); cube.addProperty(insp);
    const posx = other.kinematics.local.get('posx'); A.anim.setKey(posx, 1, 0); A.autoInspect = true;
    ST.ask = () => false; const before = other.properties.length;
    r = run('Add property extended', { Property: insp, InputObjs: [other] });
    ok('Add property extended: "inspect" property + autoinspect + animated object -> question; No = 0x562e80c7, nothing added', !r.err && ST.status['Add property extended'] === 0x562e80c7 && other.properties.length === before, r);
    ST.ask = () => true; r = run('Add property extended', { Property: insp, InputObjs: [other] });
    ok('Add property extended: Yes -> added', r.v?.length === 1 && other.properties.length === before + 1, r);
    ST.ask = null; A.autoInspect = false; A.anim.removeAnimation(posx); cube.removeProperty(insp);
    undoTo(u0);
  } catch (e) { ok('Add property extended block threw', false, String(e?.stack ?? e)); }

  // ================= overrides
  try {
    reset();
    const u0 = A.undoStack.length;
    let ov = A.run('SIAddProp', { PresetObj: 'Override', InputObjs: [cube] }); ov = Array.isArray(ov) ? ov[0] : ov;
    const vis = cube.properties.find(p => p.type === 'visibility'); const viewvis = vis.get('viewvis'), rendvis = vis.get('rendvis');
    let r = run('SIAddParameterEntryToOverride', { InputObj: ov, InputObjs: [viewvis], Value: false });
    const e1 = r.v?.[0]; const E1 = e1 && X.entryOf(e1);
    ok('SIAddParameterEntryToOverride: a parameter-value entry (kind 2) with Value, path relative to the object', !r.err && !!E1 && E1.kind === 2 && E1.path === 'Visibility.viewvis' && e1.value === false && ov.params.includes(e1) && ST.status.SIAddParameterEntryToOverride === 0, [r, E1]);
    r = run('SIAddParameterEntryToOverride', { InputObjs: [ov, rendvis] });
    const e2 = r.v?.[0];
    ok('SIAddParameterEntryToOverride: the override found in InputObjs is used and removed from the list; Value unset = current value', !!e2 && X.entryOf(e2).path === 'Visibility.rendvis' && e2.value === rendvis.value && r.v.length === 1, r);
    r = run('SIAddConnectionEntryToOverride', { InputObj: ov, InputObjs: [vis] });
    const e3 = r.v?.[0];
    ok('SIAddConnectionEntryToOverride: a whole property -> property entry (kind 1)', !!e3 && X.entryOf(e3).kind === 1 && X.entryOf(e3).path === 'Visibility', r);
    const posy = cube.kinematics.local.get('posy');
    r = run('SIAddConnectionEntryToOverride', { InputObj: ov, InputObjs: [posy] });
    ok('SIAddConnectionEntryToOverride: a scalar parameter with Type 0 -> connection entry (kind 0)', X.entryOf(r.v?.[0] ?? { def: {} })?.kind === 0, r);
    if (strParam) {
      r = run('SIAddParameterEntryToOverride', { InputObj: ov, InputObjs: [strParam] });
      ok('SIAdd*EntryToOverride: an unsupported item -> warning 0xc, skipped; nothing added = status 1', !r.err && has(r, /message 0xc/) && r.v.length === 0 && ST.status.SIAddParameterEntryToOverride === 1, r);
    }
    r = run('SIAddParameterEntryToOverride', { InputObj: cube, InputObjs: [viewvis] });
    ok('SIAdd*EntryToOverride: no override -> 0x80070057, message 0x3fc', status(r, '80070057') && /message 0x3fc/.test(r.err), r);
    r = run('SIAddShaderEntryToOverride', { InputObj: ov, PresetObj: 'Phong', Name: 'x' });
    ok('SIAddShaderEntryToOverride: no InputObjs in its argument list -> nothing added (status 1); PresetObj / Name log "not yet attested"', !r.err && r.v.length === 0 && nya(r) && ST.status.SIAddShaderEntryToOverride === 1, r);
    r = run('SIAddParameterEntryToOverride', { InputObj: ov, InputObjs: [viewvis], Path: 'x.y' });
    ok('SIAdd*EntryToOverride: Path logs "not yet attested"', nya(r), r);
    // SIGetOverriddenParameters
    r = run('SIGetOverriddenParameters', { Target: e1 });
    ok('SIGetOverriddenParameters: the parameters at the entry path on the objects the override applies to', !r.err && r.v.length === 1 && r.v[0] === viewvis, r);
    r = run('SIGetOverriddenParameters', { Target: e3 });
    ok('SIGetOverriddenParameters: a property entry -> the property\'s parameters (inferred)', r.v?.length === vis.params.length && r.v.includes(rendvis), r.v?.length);
    r = run('SIGetOverriddenParameters', { Target: viewvis });
    ok('SIGetOverriddenParameters: not an override entry -> warning message 7, empty list', !r.err && r.v.length === 0 && has(r, /message 0x7;/), r);
    // SIGetOriginalValueOfOverridden
    const posx = cube.kinematics.local.get('posx');
    run('SIAddParameterEntryToOverride', { InputObj: ov, InputObjs: [posx], Value: 100 });
    A.anim.setKey(posx, 1, 0); A.anim.setKey(posx, 11, 10);
    r = run('SIGetOriginalValueOfOverridden', { Target: posx, Time: 6 });
    ok('SIGetOriginalValueOfOverridden: the value without the override at Time (frames; seconds kept)', !r.err && near(r.v, A.anim.fcurve(posx).eval(6)) && near(ST.lastTimeSeconds, 6 / A.anim.fps), [r, ST.lastTimeSeconds]);
    A.anim.removeAnimation(posx);
    r = run('SIGetOriginalValueOfOverridden', { Target: viewvis, Time: 1 });
    ok('SIGetOriginalValueOfOverridden: a static parameter -> its value', r.v === viewvis.value, r);
    r = run('SIGetOriginalValueOfOverridden', { Target: cube.kinematics.local.get('posz'), Time: 1 });
    ok('SIGetOriginalValueOfOverridden: not overridden -> logged and raised', !!r.err && has(r, /is not overridden/), r);
    // SIRemoveEntryFromOverride
    const idx = ov.params.indexOf(e2); const n0 = ov.params.length;
    r = run('SIRemoveEntryFromOverride', { InputObjs: [e2, viewvis] });
    ok('SIRemoveEntryFromOverride: entries removed from their override; other items ignored', !r.err && !ov.params.includes(e2) && ov.params.length === n0 - 1 && r.v === 1, r);
    A.undo(); ok('SIRemoveEntryFromOverride: undo restores the entry at its index', ov.params.indexOf(e2) === idx);
    A.anim.marked.clear(); A.anim.marked.add(e1); r = run('SIRemoveEntryFromOverride'); A.anim.marked.clear();
    ok('SIRemoveEntryFromOverride: InputObjs not given = the marked parameters', !ov.params.includes(e1) && r.v === 1, r);
    undoTo(u0);
    ok('overrides: undo removes the override', !cube.properties.includes(ov));
  } catch (e) { ok('overrides block threw', false, String(e?.stack ?? e)); }

  // ================= retarget
  try {
    reset();
    const u0 = A.undoStack.length;
    let r = run('siWriteRetargetMapping', { InputObjs: [cube], Sx: 2, Rx: 90, Tx: 3, P2M_Sz: 0, P2M_Ty: -4 });
    const rm = X.retargetOf(cube);
    ok('siWriteRetargetMapping: slot 9 <- S/R/T (degrees, XYZ)', !r.err && nearArr(rm?.mapping, [2, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 3, 0, 0, 1], 1e-9), rm);
    ok('siWriteRetargetMapping: slot 7 <- P2M_ transform; |s| < 1e-12 replaced by 1e-12', nearArr(rm?.p2m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1e-12, 0, 0, -4, 0, 1], 1e-15), rm?.p2m);
    r = run('siWriteRetargetMapping', { InputObjs: [cube], Sx: -1e-14 });
    ok('siWriteRetargetMapping: the sign of a tiny scale is kept', near(X.retargetOf(cube).mapping[0], -1e-12, 1e-18), X.retargetOf(cube).mapping[0]);
    r = run('siWriteRetargetMapping', { InputObjs: [cube], Ry: null });
    ok('siWriteRetargetMapping: every argument is required', !!r.err && /Ry is missing/.test(r.err), r);
    undoTo(u0);
    ok('siWriteRetargetMapping: undo restores (no mapping)', X.retargetOf(cube) === null);
    const L = cube.kinematics.local; A.setParam(L.get('posx'), 1); A.setParam(L.get('rotx'), 30);
    r = run('siCreateRetargetMapping', { InputObjs: [cube, other] });
    const g = cube.globalMatrix().elements; const cm = X.retargetOf(cube);
    ok('siCreateRetargetMapping: item relative to its model owner (Scene_Root here) -> slot 9', !r.err && nearArr(cm?.mapping, Array.from(g), 1e-9), [r, cm]);
    ok('siCreateRetargetMapping: owner relative to the rig root with its rotation zeroed -> slot 7', nearArr(cm?.p2m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -g[12], -g[13], -g[14], 1], 1e-9) && near(g[12], 1), cm?.p2m);
    ok('siCreateRetargetMapping: every list item gets a mapping', !!X.retargetOf(other));
    undoTo(u0);
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'Arm,Hand,ik,2,Bone1,root,Eff,ik_effector' });
    let sd = X.structureOf(cube);
    ok('siWriteRetargetComponentData: name0,name1,chainType,count, then count (object, role) pairs', !r.err && J(sd) === J([{ name0: 'Arm', name1: 'Hand', chainType: 2, members: [{ name: 'Bone1', role: 1 }, { name: 'Eff', role: 3 }] }]), sd);
    run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'a,b,fk,3,x,upvector,y,ik_contact,z,other' });
    run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'c,d,ik_contact,0,' });
    run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'e,f,spline,1,w,fk' });
    sd = X.structureOf(cube);
    ok('siWriteRetargetComponentData: chain fk 6 / ik_contact 3 / other 1; roles upvector 5, ik_contact 4, fk 2, other 2', J(sd.slice(1).map(x => [x.chainType, x.members.map(k => k.role)])) === J([[6, [5, 4, 2]], [3, []], [1, [2]]]), sd);
    run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 'ClEaR' });
    ok('siWriteRetargetComponentData: "clear" (any case) clears the component data', J(X.structureOf(cube)) === '[]');
    r = run('siWriteRetargetComponentData', { InputObjs: [cube], 'Parameter list': 5 });
    ok('siWriteRetargetComponentData: a non-string Parameter list -> 0x80070057', status(r, '80070057'), r);
    undoTo(u0);
    ok('retarget: undo restores', X.structureOf(cube) === null);
  } catch (e) { ok('retarget block threw', false, String(e?.stack ?? e)); }

  // ================= shells
  try {
    reset();
    let r = run('MarkObjectDirty', { Object: cube });
    ok('MarkObjectDirty: no handler DLL -> logs "not yet attested", no error', !r.err && nya(r) && r.v === undefined, r);
    r = run('AddShaderAttachedComment', { Container: cube });
    ok('AddShaderAttachedComment: bbbbee29 unlocated -> logs "not yet attested", returns nothing', !r.err && nya(r) && r.v === null, r);
  } catch (e) { ok('shells block threw', false, String(e?.stack ?? e)); }

  // ================= literal user tab / keyword registrations (CMD-B7a behaviour unchanged)
  try {
    reset();
    const u0 = A.undoStack.length;
    for (const n of LITERAL) ok(`${n}: still registered (Viewing|Property)`, A.commands.get(n)?.category === 'Viewing|Property');
    run('SetUserTab', { InputObjs: [cube], Keywords: 't1, t2,t3' });
    ok('SetUserTab: writes the tab list', cube.userTabs === 't1,t2,t3', cube.userTabs);
    ok('GetUserTab: reads it back', J(run('GetUserTab', { InputObjs: [cube] }).v?.items) === J(['t1', 't2', 't3']));
    run('RemoveUserTab', { InputObjs: [cube], Keywords: 'T2' });
    ok('RemoveUserTab: removes (case-insensitive)', cube.userTabs === 't1,t3', cube.userTabs);
    run('AddUserTab', { InputObjs: [cube], Keywords: 't4' });
    ok('AddUserTab: adds', cube.userTabs === 't1,t3,t4', cube.userTabs);
    run('ClearUserTab', { InputObjs: [cube] });
    ok('ClearUserTab: clears', cube.userTabs === undefined, cube.userTabs);
    run('SetUserKeyword', { InputObjs: [cube], Keywords: 'k1,k2' }); run('RemoveUserKeyword', { InputObjs: [cube], Keywords: 'k1' });
    ok('SetUserKeyword / RemoveUserKeyword / GetUserKeyword', J(run('GetUserKeyword', { InputObjs: [cube] }).v?.items) === J(['k2']), cube.userKeywords);
    run('AddUserKeyword', { InputObjs: [cube], Keywords: 'k3' }); run('ClearUserKeyword', { InputObjs: [cube] });
    ok('AddUserKeyword / ClearUserKeyword', cube.userKeywords === undefined, cube.userKeywords);
    undoTo(u0);
  } catch (e) { ok('literal block threw', false, String(e?.stack ?? e)); }
  return out;
}, { NAMES, LITERAL, DF: [...DEFAULT_FAILS] });

await browser.close();

let fails = 0;
const line = (okk, name, detail = '') => { if (!okk) fails++; console.log(`${okk ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };
console.log('--- registration (registry argument lists, literal names in src/)');
for (const n of NAMES) {
  const want = registry[n]; const have = got.reg[n];
  line(!!have && JSON.stringify(have) === JSON.stringify(want), `${n}: registered with the registry arguments`, have ? '' : 'not registered');
  line(literal[n], `${n}: named literally in src/`);
}
for (const n of LITERAL) { line(!!got.reg[n], `${n}: registered`); line(literal[n], `${n}: named literally in src/`); }
console.log('--- default runs (cube selected)');
for (const n of NAMES) line(got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', `${n}: ${got.defaults[n]}`);
console.log('--- contract');
for (const [name, okk, detail] of got.checks) line(okk, name, detail);
line(pageErrors.length === 0, 'no page errors', pageErrors.slice(0, 3).join(' | '));
const total = NAMES.length * 3 + LITERAL.length * 2 + got.checks.length + 1;
console.log(fails ? `FAIL CMD-B15b: ${fails} of ${total} checks failed` : `OK CMD-B15b propertytasks commands: ${total} checks, ${NAMES.length} commands + ${LITERAL.length} literal user tab / keyword names (contract; no XSIBATCH golden)`);
console.log('   fully wired (command layer): SIAddCustomParam (target = custom property set), SetClusterPropertyValues, SIGetOverriddenParameters, siWriteRetargetMapping, siWriteRetargetComponentData (stripped character not attested), Add property extended');
console.log('   partly wired: SICreateMaterialDD (Library / Initialize), CreateUserNormals / RemoveUserNormals / SetVertexUserNormals / SetPolygonUserNormals (gather / bleed / normal formulas / freeze setting), SetUserNormalValues, SIAdd{Shader,Parameter,Connection}EntryToOverride (shader variant, Path, install layouts), SIRemoveEntryFromOverride, SIGetOriginalValueOfOverridden (message ids), siCreateRetargetMapping (property identity, rotation order)');
console.log('   shells (no handler located): MarkObjectDirty, AddShaderAttachedComment');
process.exit(fails ? 1 : 0);
