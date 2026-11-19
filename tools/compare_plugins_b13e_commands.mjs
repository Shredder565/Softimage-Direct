// CMD-B13e (small plug-in DLLs): the 22 commands of src/commands/pluginsB13e*.ts. There is no XSIBATCH golden for the
// row: this is a contract check against docs/ghidra/cmd-b13e-small-plugins-binary.md and docs/re/WIRE_CORRECTIONS_B13.md.
//   1. every name is registered with the catalogue argument list. These plug-in commands are not in
//      data/command_registry.json; the list comes from data/commands_full.json (same rule: names, order, defaults).
//      Two catalogue defaults are not values and are replaced as the note states: BoneCreateTool_UpdateBone RootPos
//      (a Python ISIVector3 repr -> vector (0,0,0)) and Applypolymatricks stack ([null] -> empty array);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (MDD byte layout and round trip, LWO2 round trip, DX property mapping, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_plugins_b13e_commands.mjs
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
  'poMDDFrameData', 'poMDDFrames', 'poMDDPoints', 'poMDDTimes', 'CrowdFBXPlot_ExportBegin', 'CrowdFBXPlot_ExportEnd', 'CrowdFBXPlot_ExportMode',
  'FBXPlotAndExportCrowd', 'FindUltimapperDistance', 'GenerateUltimapper', 'fr_AddSamplerDataCache', 'fr_ApplyShapeWeightOp', 'PO_XSI_ImportLWO',
  'XSI_Import_POScene', 'PO_XSI_ExportLWO', 'PO_XSI_Baker', 'ClearRealtimeShaderCache', 'DXExport', 'DXImport', 'BoneCreateTool_UpdateBone',
  'Applypolymatricks', 'FR_Import_Animation_Rig_To_ICE',
];
const DEFAULT_FAILS = new Set(['poMDDFrameData', 'poMDDTimes', 'FBXPlotAndExportCrowd', 'fr_AddSamplerDataCache', 'fr_ApplyShapeWeightOp', 'PO_XSI_ImportLWO',
  'XSI_Import_POScene', 'PO_XSI_ExportLWO', 'FR_Import_Animation_Rig_To_ICE']);
const DEFAULT_OVERRIDES = { 'BoneCreateTool_UpdateBone.RootPos': [0, 0, 0], 'Applypolymatricks.stack': [] };

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  const f = full.find(x => (x.scripting_name || x.name) === n);
  const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  const args = c ? c.args.filter(a => !(a.flags & 0x200)) : (f?.args ?? []);
  if (!c && !f) return [n, null];
  return [n, args.map(a => [a.name, DEFAULT_OVERRIDES[`${n}.${a.name}`] ?? a.default ?? fd[a.name] ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('FR_Import_Animation_Rig_To_ICE') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.pluginsB13e, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const arrNear = (a, b, e = 1e-5) => Array.isArray(a) && a.length === b.length && a.every((v, i) => near(v, b[i], e));
  const bytes = (p) => Array.from(FS.readFile(p), c => c.charCodeAt(0));
  const cube = A.scene.find('cube');
  const reset = () => { A.select([cube]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  S.crowd = null;
  FS.ensureFolder('C:\\b13e');
  const D = 'C:\\b13e';

  // ================= MDD (section 2.2)
  {
    const f = D + '\\t.mdd';
    let r = run('poMDDFrames', { FileName: f, Mode: 'w', Value: 2 });
    ok('poMDDFrames w: returns "<n> has been written to Frames"', r.v === '2 has been written to Frames', r);
    ok('poMDDFrames w: "wb" truncates the file to the 4 bytes (BE int32)', JSON.stringify(bytes(f)) === '[0,0,0,2]', bytes(f));
    r = run('poMDDPoints', { FileName: f, Mode: 'm', Value: 3 });
    ok('poMDDPoints m: writes BE int32 at offset 4, returns "<n> has been written to points"', r.v === '3 has been written to points' && JSON.stringify(bytes(f)) === '[0,0,0,2,0,0,0,3]', [r, bytes(f)]);
    r = run('poMDDTimes', { FileName: f, Mode: 'm', Value: [0, 1 / 30] });
    ok('poMDDTimes m: writes every element from offset 8, "<count> values have been written to times"', r.v === '2 values have been written to times' && bytes(f).length === 16, r);
    const f0 = [0, 1, 2, 3, 4, 5, 6, 7, 8], f1 = [-1, -2, -3, 0.5, 0.25, 0.125, 10, 20, 30];
    r = run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 0, Value: f0 });
    ok('poMDDFrameData m: frame 0 written, message', r.v === "9 values have been written to frame 0's data", r);
    run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 1, Value: f1 });
    const b = bytes(f);
    ok('MDD layout: 8 + 4F + 12PF bytes', b.length === 8 + 8 + 2 * 36, b.length);
    ok('MDD layout: frame 1 at 8 + 4F + 12P, BE float32', (() => { const dv = new DataView(Uint8Array.from(b).buffer); return dv.getFloat32(8 + 8 + 36, false) === -1 && dv.getFloat32(8 + 8 + 36 + 8, false) === -3; })());
    ok('poMDDFrames r: frameCount', run('poMDDFrames', { FileName: f, Mode: 'r' }).v === 2);
    ok('poMDDPoints r: pointCount', run('poMDDPoints', { FileName: f, Mode: 'r' }).v === 3);
    ok('poMDDTimes r: F float32 times', arrNear(run('poMDDTimes', { FileName: f, Mode: 'r' }).v, [0, 1 / 30]));
    ok('poMDDFrameData r: round trip frame 0', arrNear(run('poMDDFrameData', { FileName: f, Mode: 'r', Frame: 0 }).v, f0));
    ok('poMDDFrameData r: round trip frame 1', arrNear(run('poMDDFrameData', { FileName: f, Mode: 'r', Frame: 1 }).v, f1));
    r = run('poMDDFrameData', { FileName: f, Mode: 'r', Frame: 4 });
    ok('poMDDFrameData r: Frame > F + 1 -> "frame out of range", E_FAIL', status(r, '80004005') && has(r, /^poMDDFrameData error frame out of range$/), r);
    r = run('poMDDFrameData', { FileName: f, Mode: 'r', Frame: 3 });
    ok('poMDDFrameData r: Frame = F + 1 passes the bound (off by two), nothing to read', !r.err && Array.isArray(r.v) && r.v.length === 0 && nya(r), r);
    r = run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 3, Value: f0 });
    ok('poMDDFrameData m: F < Frame -> error', status(r, '80004005') && has(r, /Frame number to insert data is greater than total number of frames in header\.$/), r);
    r = run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 2, Value: [1, 2] });
    ok('poMDDFrameData m: count < P -> error (compared with P, not 3P)', status(r, '80004005') && has(r, /Point count in file is greater than number of elements in user array\.$/), r);
    r = run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 2, Value: [1, 2, 3] });
    ok('poMDDFrameData m: count = P passes the check (3P values written)', !r.err && bytes(f).length === 16 + 3 * 36, [r, bytes(f).length]);
    ok('poMDDFrameData m: empty array -> error', has(run('poMDDFrameData', { FileName: f, Mode: 'm', Frame: 0, Value: [] }), /No data provided to put into file$/));
    ok('poMDDTimes m: empty array -> error', has(run('poMDDTimes', { FileName: f, Mode: 'm', Value: [] }), /^poMDDTimes failed\. No data provided to put into file$/));
    r = run('poMDDFrames', { FileName: f, Mode: 'm', Value: 5 });
    ok('poMDDFrames m: "r+b" overwrites offset 0, keeps the rest', r.v === '5 has been merged to Frames' && bytes(f).length === 16 + 3 * 36 && bytes(f)[3] === 5, r);
    r = run('poMDDFrames', { FileName: f, Mode: 'rw2', Value: 1 });
    ok('preamble: mode text longer than 2 -> "poMDDFrames. Error, read mode flag in correct", E_FAIL', status(r, '80004005') && has(r, /^poMDDFrames\. Error, read mode flag in correct$/), r);
    ok('preamble: poMDDPoints error text', has(run('poMDDPoints', { FileName: f, Mode: 'abc' }), /^poMDDPoints\. Error, read mode flag in correct$/));
    ok('preamble: only the first character is used ("rx" reads)', run('poMDDFrames', { FileName: f, Mode: 'rx' }).v === 5);
    r = run('poMDDFrames', { FileName: f, Mode: 'x', Value: 1 });
    ok('preamble: another character succeeds and does nothing', !r.err && r.v === undefined && bytes(f)[3] === 5, r);
    r = run('poMDDPoints', { FileName: f, Mode: 'w', Value: 9 });
    ok('poMDDPoints: no w branch (succeeds, file unchanged)', !r.err && bytes(f)[7] === 3, r);
    r = run('poMDDFrames', { FileName: D + '\\missing.mdd', Mode: 'r' });
    ok('poMDDFrames: open failure -> "poMDDFrames failed to open file!", E_FAIL', status(r, '80004005') && has(r, /^poMDDFrames failed to open file!$/), r);
    r = run('poMDDTimes', { FileName: '', Mode: 'r' });
    ok('poMDDTimes: empty FileName -> "poMDDTimes failed to open file!"', status(r, '80004005') && has(r, /^poMDDTimes failed to open file!$/), r);
    ok('poMDDFrameData: empty FileName -> "poMDDFrameData failed to open file!"', has(run('poMDDFrameData', { FileName: '', Mode: 'r', Frame: 0 }), /^poMDDFrameData failed to open file!$/));
    ok('poMDDTimes w: does nothing', run('poMDDTimes', { FileName: f, Mode: 'w', Value: [1] }).v === undefined && bytes(f).length === 16 + 3 * 36);
  }

  // ================= CrowdFX
  {
    const Model = A.scene.root.constructor, Prop = cube.properties[0].constructor;
    const crowd = new Model('CrowdB13e'); A.scene.root.addChild(crowd);
    const cp = crowd.addProperty(new Prop('CrowdFX', 'crowd', [{ name: 'IsActive', type: 'bool', value: false }]));
    const inner = A.run('GetPrim', { PresetObj: 'Null', Name: 'agentB13e' }); crowd.addChild(inner);
    const copy = A.run('CreatePrim', { PresetObj: 'Sphere', Name: 'copyB13e' }); const sph = A.run('CreatePrim', { PresetObj: 'Sphere', Name: 'cacheB13e' });
    const grp = { name: 'Actors_Copies', parent: crowd, members: [copy, sph] }; A.scene.groupList.push(grp);
    let r = run('CrowdFBXPlot_ExportMode', { ExportAsGeometry: 0 });
    ok('CrowdFBXPlot_ExportMode: stores the mode, returns nothing', !r.err && r.v === undefined && S.crowd.mode === 0, r);
    r = run('CrowdFBXPlot_ExportBegin', { Selection: [inner, cube], MeshesToCache: [sph] });
    const [L1, L2] = r.v ?? [[], []];
    ok('CrowdFBXPlot_ExportBegin mode 0: [L1, L2] = [[cube, cache, copy], [cache, copy]] (crowd members replaced by the model\'s Actors_Copies)',
      !r.err && L1.map(o => o.name).join() === 'cube,cacheB13e,copyB13e' && L2.map(o => o.name).join() === 'cacheB13e,copyB13e', [r.err, L1.map(o => o.name), L2.map(o => o.name)]);
    ok('CrowdFBXPlot_ExportEnd mode 0: does nothing', (() => { const n = S.crowd.exports.length; const x = run('CrowdFBXPlot_ExportEnd', { Ptrs: [1, 2] }); return !x.err && S.crowd.exports.length === n && !nya(x); })());
    run('CrowdFBXPlot_ExportMode', { ExportAsGeometry: 2 });
    r = run('CrowdFBXPlot_ExportBegin', { Selection: [inner, cube], MeshesToCache: [sph] });
    ok('CrowdFBXPlot_ExportBegin mode 2: MeshesToCache / Actors_Copies not used; no Mesh_Proxies group -> L1 = [cube], L2 = []', r.v?.[0].length === 1 && r.v[0][0] === cube && r.v[1].length === 0, r.err);
    r = run('CrowdFBXPlot_ExportEnd', { Ptrs: [1, 2] });
    ok('CrowdFBXPlot_ExportEnd mode 2: hands Ptrs to the (unread) FBX builder -> logged', !r.err && nya(r) && S.crowd.exports.at(-1).meshProxies === true, r);
    A.select([]);
    r = run('FBXPlotAndExportCrowd', { FilePathName: D + '\\c.fbx' });
    ok('FBXPlotAndExportCrowd: no model and no active crowd -> XSICROWDFX 1, E_INVALIDARG', status(r, '80070057') && has(r, /XSICROWDFX 1/), r);
    cp.set('IsActive', true);
    r = run('FBXPlotAndExportCrowd', { FilePathName: D + '\\c.fbx', StartFrame: 5, EndFrame: 9, ExportGeom: true });
    const ex = S.crowd.exports.at(-1);
    ok('FBXPlotAndExportCrowd: scans for the crowd model with CrowdFX.IsActive, returns true', r.v === true && ex.models[0] === crowd && ex.start === 5 && ex.end === 9 && ex.format === 'FBX201400' && ex.options[16] === true, [r, ex && { m: ex.models.map(m => m.name) }]);
    r = run('FBXPlotAndExportCrowd', { Models: [crowd] });
    ok('FBXPlotAndExportCrowd: empty path, dialog cancelled -> E_ABORT', status(r, '80004004'), r);
    S.hooks.fileDialog = () => D + '\\d.fbx';
    r = run('FBXPlotAndExportCrowd', { Models: [crowd] }); delete S.hooks.fileDialog;
    ok('FBXPlotAndExportCrowd: dialog path used', r.v === true && S.crowd.exports.at(-1).file === D + '\\d.fbx', r);
    A.scene.groupList.splice(A.scene.groupList.indexOf(grp), 1);
    A.scene.root.removeChild(crowd); A.scene.root.removeChild(copy); A.scene.root.removeChild(sph);
    S.crowd = null; reset();
  }

  // ================= LWO2 (section 2.5)
  {
    const f = D + '\\cube.lwo';
    let r = run('PO_XSI_ExportLWO', { Objects: 'cube', FileName: f });
    const b = bytes(f); const s4 = (o) => String.fromCharCode(...b.slice(o, o + 4)); const u32 = (o) => new DataView(Uint8Array.from(b).buffer).getUint32(o, false);
    ok('PO_XSI_ExportLWO: FORM <size> LWO2, size = file - 8', !r.err && s4(0) === 'FORM' && u32(4) === b.length - 8 && s4(8) === 'LWO2', [r.err, s4(0), u32(4), b.length]);
    const tags = []; for (let p = 12; p + 8 <= b.length; p += 8 + u32(p + 4) + (u32(p + 4) & 1)) tags.push(s4(p));
    ok('PO_XSI_ExportLWO: chunk order TAGS LAYR PNTS POLS PTAG SURF', tags.join(' ') === 'TAGS LAYR PNTS POLS PTAG SURF', tags);
    ok('PO_XSI_ExportLWO: progress captions', has(r, /^Point Oven Export LWO\.\.\.\.Getting Data\.\.\.$/) && has(r, /^Point Oven Export LWO\.\.\.\.Writing Data\.\.\.$/));
    r = run('PO_XSI_ExportLWO', { Objects: 'cube', FileName: 'C:\\nodirB13e\\x.lwo' });
    ok('PO_XSI_ExportLWO: open failure -> "POXSI_LWOExport. Error, cannot open file: <FileName>", E_INVALIDARG', status(r, '80070057') && has(r, /^POXSI_LWOExport\. Error, cannot open file: C:\/nodirB13e\/x\.lwo$/), r);
    const u0 = A.undoStack.length;
    r = run('PO_XSI_ImportLWO', { FileName: f, Import_Morphs: 0, Import_Morphs_to_Mixer: 0, Import_UVs: 0, Import_Surfaces: 1, Weights: 0, Scale: 2 });
    const o = r.v?.[0]; const m = o?.primitive?.mesh(); const cm = cube.primitive.mesh();
    ok('PO_XSI_ImportLWO: returns the created objects (one mesh per layer, Layer_%i)', !r.err && r.v.length === 1 && /^Layer_0/.test(o.name), [r.err, o?.name]);
    ok('PO_XSI_ImportLWO: LWO2 round trip, points scaled by Scale', m && m.positions.length === cm.positions.length && Array.from(m.positions).every((v, i) => near(v, cm.positions[i] * 2, 1e-4)) && JSON.stringify(m.polygons) === JSON.stringify(cm.polygons));
    ok('PO_XSI_ImportLWO: surfaces as polygon clusters', o?.clusters.length === 1 && o.clusters[0].elements.size === cm.polygons.length);
    ok('PO_XSI_ImportLWO: progress "Point Oven Import LWO...." and one undo step', has(r, /^Point Oven Import LWO\.\.\.\.$/) && A.undoStack.length === u0 + 1);
    A.undo(); ok('PO_XSI_ImportLWO: undo removes the objects', !A.scene.find(o.name));
    ok('PO_XSI_ImportLWO: missing file -> "POXSI_LWOImport. Error, cannot open file"', has(run('PO_XSI_ImportLWO', { FileName: D + '\\none.lwo' }), /^POXSI_LWOImport\. Error, cannot open file$/));
    FS.writeFile(D + '\\bad1.lwo', 'JUNK\u0000\u0000\u0000\u0004LWO2');
    ok('PO_XSI_ImportLWO: not IFF', has(run('PO_XSI_ImportLWO', { FileName: D + '\\bad1.lwo' }), /bad header, not IFF$/));
    FS.writeFile(D + '\\bad2.lwo', 'FORM\u0000\u0000\u0000\u0004LWOB');
    ok('PO_XSI_ImportLWO: not LWO2', has(run('PO_XSI_ImportLWO', { FileName: D + '\\bad2.lwo' }), /bad header, not LWO2$/));
    // a 2-point polygon: FORM LWO2 PNTS(2 points) POLS FACE (2;0,1)
    const w = []; const id = s => [...s].forEach(c => w.push(c.charCodeAt(0))); const u32w = v => w.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
    id('FORM'); u32w(4 + 8 + 24 + 8 + 10); id('LWO2'); id('PNTS'); u32w(24); for (let i = 0; i < 24; i++) w.push(0); id('POLS'); u32w(10); id('FACE'); w.push(0, 2, 0, 0, 0, 1);
    FS.writeFile(D + '\\bad3.lwo', String.fromCharCode(...w));
    ok('PO_XSI_ImportLWO: 1 or 2 point polygons -> error', has(run('PO_XSI_ImportLWO', { FileName: D + '\\bad3.lwo' }), /1 or 2 point polygons found, please remove them in LW$/));
    r = run('XSI_Import_POScene', { File: D + '\\none.psc' });
    ok('XSI_Import_POScene: open failure -> E_INVALIDARG without a log line of its own', status(r, '80070057') && r.log.filter(l => !/^XSI_Import_POScene:/.test(l)).length === 0, r);
    FS.writeFile(D + '\\s.psc', 'scene');
    r = run('XSI_Import_POScene', { File: D + '\\s.psc' });
    ok('XSI_Import_POScene: reader / builder logged as not yet attested', !r.err && nya(r) && has(r, /^Point Oven Import PO Scene\.\.\.\.$/), r);
    reset();
  }

  // ================= PO_XSI_Baker
  {
    const args = (o) => ({ PO_ObjString: 'cube', PO_FilePath: '', PO_StartFrame: 1, PO_EndFrame: 3, PO_ObjPreFix: 'pre_', ...o });
    let r = run('PO_XSI_Baker', args({ PO_MDDAct: 1, PO_FilePath: 'C:\\nodirB13e' }));
    ok('PO_XSI_Baker: MDD directory missing -> E_INVALIDARG, "PO_XSI_Baker - The MDD ..."', status(r, '80070057') && has(r, /^PO_XSI_Baker - The MDD /), r);
    r = run('PO_XSI_Baker', args({ PO_MOTSep: 1, PO_MOTString: 'C:\\nodirB13e' }));
    ok('PO_XSI_Baker: MOTSep (not MOTAct) gates the MOT path check', status(r, '80070057') && has(r, /The MOT /), r);
    r = run('PO_XSI_Baker', args({ PO_LWSAct: 1, PO_LWSString: D }));
    ok('PO_XSI_Baker: a "file" path that is an existing directory fails (LWS)', status(r, '80070057') && has(r, /The LWS /), r);
    ok('PO_XSI_Baker: a new file in an existing directory passes (LWS)', !run('PO_XSI_Baker', args({ PO_LWSAct: 1, PO_LWSString: D + '\\a.lws' })).err);
    r = run('PO_XSI_Baker', args({ PO_MAXAct: 1, PO_MAXString: 'C:\\nodirB13e\\a.psc' }));
    ok('PO_XSI_Baker: MAX path labelled PSC', has(r, /The PSC /), r);
    FS.ensureFolder(D + '\\bake');
    r = run('PO_XSI_Baker', args({ PO_MDDAct: 1, PO_FilePath: D + '\\bake\\' }));
    const mf = D + '\\bake\\pre_cube.mdd';
    ok('PO_XSI_Baker MDD: <FilePath>/ + PreFix + <name>.mdd written', !r.err && FS.isFile(mf), r);
    ok('PO_XSI_Baker MDD: header F = End - Start + 1, P = points', run('poMDDFrames', { FileName: mf, Mode: 'r' }).v === 3 && run('poMDDPoints', { FileName: mf, Mode: 'r' }).v === cube.primitive.mesh().positions.length / 3);
    ok('PO_XSI_Baker MDD: time[f] = frame / fps', arrNear(run('poMDDTimes', { FileName: mf, Mode: 'r' }).v, [1, 2, 3].map(x => x / A.anim.fps)));
    const g = cube.globalMatrix().elements, p = cube.primitive.mesh().positions; const wp = [];
    for (let i = 0; i < p.length; i += 3) wp.push(g[0] * p[i] + g[4] * p[i + 1] + g[8] * p[i + 2] + g[12], g[1] * p[i] + g[5] * p[i + 1] + g[9] * p[i + 2] + g[13], g[2] * p[i] + g[6] * p[i + 1] + g[10] * p[i + 2] + g[14]);
    ok('PO_XSI_Baker MDD: frame points (global space)', arrNear(run('poMDDFrameData', { FileName: mf, Mode: 'r', Frame: 0 }).v, wp, 1e-4));
    ok('PO_XSI_Baker: progress "Point Oven Export Processing...."', has(r, /^Point Oven Export Processing\.\.\.\.$/));
  }

  // ================= ClearRealtimeShaderCache
  {
    const c = S.shaderCache; const s0 = c.starts, d0 = c.shutdowns;
    const r = run('ClearRealtimeShaderCache');
    ok('ClearRealtimeShaderCache: start if needed, shut down, start again; no return value', !r.err && r.v === undefined && c.started && c.shutdowns === d0 + 1 && c.starts >= s0 + 1, [c.starts, c.shutdowns]);
  }

  // ================= DXExport / DXImport (sections 2.3, 2.4)
  {
    reset();
    const xf = D + '\\out.x';
    let r = run('DXExport', { DX_Filename: xf, DX_OptionsExportHiddenObjects: 1, DX_OptionsChains: false, DX_OptionsTriangulate: true, DX_TexturesResizeX: 64 });
    const prop = A.scene.root.properties.find(p => p.name === 'DXExportProperty');
    ok('DXExport: DXExportProperty created on the scene root with the 17 parameters', !!prop && prop.params.length === 17 && prop.params.every(p => p.def.capabilities === 4), prop?.params.length);
    ok('DXExport: DX_OptionsExportHiddenObjects goes into chains, DX_OptionsChains into ExportHidden (swapped, as read)', prop.val('chains') === 1 && prop.val('ExportHidden') === false);
    ok('DXExport: straight mapping of the other arguments', prop.val('triangulate') === true && prop.val('txtresizeX') === 64 && prop.val('Filename') === xf && prop.val('CompressMesh') === true);
    const o = S.dxExportOptions;
    ok('DXExport: dotXSIExportOptions (ik = chains != 0, sceneroot = !ExportHidden, tesselation from "Triangulate")', o && o.output_file_format_version === 300 && o.ik === true && o.sceneroot === true && o.tesselation === true && o.fcurveKind === 20 && o.interpolation === 3 && o.output_file_format === 1, o);
    ok('DXExport: no return value', r.v === undefined && !r.err, r);
    const text = FS.readFile(xf);
    ok('DXExport: .x header and the three template GUIDs', text.startsWith('xof 0303txt 0032') && text.includes('3CF169CE-FF7C-44ab-93C0-F78F62D172E2') && text.includes('B8D65549-D7C9-4995-89CF-53A9A8B031E3') && text.includes('6F0D123B-BAD2-4167-A0D0-80224F25FABB'));
    ok('DXExport: selection exported (Frame cube, triangulated)', /Frame cube \{/.test(text) && text.includes(`${cube.primitive.mesh().polygons.length * 2};`));
    ok('DXExport: temporary __tmp.xsi deleted', !FS.isFile(D + '\\__tmp.xsi'));
    r = run('DXExport', { DX_Filename: 'C:\\nodirB13e\\o.x' });
    ok('DXExport: unwritable temp -> "Path error", status OK', !r.err && has(r, /^Path error$/), r);
    r = run('DXExport', { DX_Filename: '' });
    ok('DXExport: empty name -> modal InspectObj; cancelled -> no export', !r.err && nya(r), r);
    S.hooks.inspect = (c, p) => { p.set('Filename', D + '\\ppg.x'); return true; };
    run('DXExport', { DX_Filename: '' }); delete S.hooks.inspect;
    ok('DXExport: modal OK exports with the property\'s Filename', FS.isFile(D + '\\ppg.x'));
    const u0 = A.undoStack.length;
    r = run('DXImport', { DX_Filename: xf, DX_OptionsInvertUVs: true, DX_AnimationFrameOffset: 7 });
    const ip = A.scene.root.properties.find(p => p.name === 'DXImportProperty');
    ok('DXImport: DXImportProperty, straight mapping', ip && ip.val('InvertUV') === true && ip.val('FrameOffset') === 7 && ip.val('Anim') === true && ip.val('Filename') === xf);
    const imp = S.lastPut?.value?.[0]; const im = imp?.primitive?.mesh();
    ok('DXImport: frame -> object with the mesh (round trip of the exported cube, triangulated)', !r.err && imp && im && im.positions.length === cube.primitive.mesh().positions.length && im.polygons.length === cube.primitive.mesh().polygons.length * 2, [r.err, imp?.name]);
    ok('DXImport: FrameTransformMatrix -> local transform', imp && imp.kinematics.localMatrix().elements.every((v, i) => near(v, cube.kinematics.localMatrix().elements[i], 1e-4)));
    ok('DXImport: temporary __tmp.xsi deleted, no return value', !FS.isFile(D + '\\__tmp.xsi') && r.v === undefined);
    FS.writeFile(D + '\\un.x', 'xof 0303txt 0032\nFrame {\n Frame {\n }\n}\n');
    r = run('DXImport', { DX_Filename: D + '\\un.x' });
    ok('DXImport: unnamed frames named frame%d', S.lastPut.value[0]?.name.startsWith('frame0') && S.lastPut.value[0].children[0]?.name.startsWith('frame1'), S.lastPut.value.map(x => x.name));
    while (A.undoStack.length > u0) A.undo();
    reset();
  }

  // ================= BoneCreateTool_UpdateBone
  {
    S.boneTool = null; const u0 = A.undoStack.length;
    run('BoneCreateTool_UpdateBone', { NewBone: 'cube' });
    ok('BoneCreateTool_UpdateBone: no live tool -> nothing recorded', A.undoStack.length === u0);
    const tool = { currentBone: null, rootBone: null, rootPos: [9, 9, 9] }; S.boneTool = tool;
    const r = run('BoneCreateTool_UpdateBone', { OldBone: '', NewBone: 'cube', OldRootBone: 'nopeB13e', NewRootBone: 'cube', RootPos: [1, 2, 3] });
    ok('BoneCreateTool_UpdateBone: Execute changes nothing, records UndoRedoData, returns nothing', !r.err && r.v === undefined && tool.currentBone === null && tool.rootPos[0] === 9 && A.undoStack.length === u0 + 1);
    A.undo(); ok('BoneCreateTool_UpdateBone: Undo -> OldBone (unresolved -> cleared), OldRootBone, RootPos', tool.currentBone === null && tool.rootBone === null && tool.rootPos.join() === '1,2,3');
    A.redo(); ok('BoneCreateTool_UpdateBone: Redo -> NewBone, NewRootBone, the same RootPos', tool.currentBone === cube && tool.rootBone === cube && tool.rootPos.join() === '1,2,3');
    A.undo(); A.redo(); S.boneTool = null;
  }

  // ================= Applypolymatricks
  {
    const n0 = cube.primitive.operators.length;
    let r = run('Applypolymatricks', { target: 'cube', stack: ['scale', 'translate'] });
    const op = S.lastPut?.value;
    ok('Applypolymatricks: polymatricks operator on the target, return value not enabled', !r.err && r.v === undefined && op?.type === 'polymatricks' && cube.primitive.operators.includes(op) && cube.primitive.operators.length === n0 + 1, r);
    ok('Applypolymatricks: stack copied to the operator, global list cleared', op.stack.join() === 'scale,translate' && S.polymatricksStack.length === 0);
    A.undo(); ok('Applypolymatricks: undo', cube.primitive.operators.length === n0);
    r = run('Applypolymatricks', { target: 'nopeB13e' });
    ok('Applypolymatricks: invalid target not reported', !r.err && cube.primitive.operators.length === n0);
  }

  // ================= Ultimapper
  {
    const Prop = cube.properties[0].constructor;
    const um = cube.addProperty(new Prop('Ultimapper', 'Ultimapper', [{ name: 'Group', type: 'string', value: 'nopeB13e' }, { name: 'Distance', type: 'double', value: 0 }, { name: 'DepthRange', type: 'double', value: 0 }]));
    A.autoInspect = true;
    let r = run('FindUltimapperDistance', { PSet: um });
    ok('FindUltimapperDistance: invalid high-res source -> log, 0.0 put, status OK', !r.err && has(r, /^The high resolution source is invalid$/) && S.lastPut.value === 0 && r.v === undefined, r);
    um.set('Group', 'cube');
    r = run('FindUltimapperDistance', { PSet: 'cube.Ultimapper' });
    ok('FindUltimapperDistance: PSet by name; no renderer -> logged, parameters unchanged', !r.err && nya(r) && um.val('Distance') === 0, r);
    S.hooks.depthMap = () => [0.5, -3, 0, 2e6];
    r = run('FindUltimapperDistance', { PSet: um }); delete S.hooks.depthMap;
    ok('FindUltimapperDistance: D = max(max(p, 0.0001)), R = max(min(|p|, 100000)), stored x 1.01, D put unscaled', near(um.val('Distance'), 2e6 * 1.01, 1e-3) && near(um.val('DepthRange'), 1e5 * 1.01, 1e-6) && S.lastPut.value === 2e6, [um.val('Distance'), um.val('DepthRange'), S.lastPut]);
    ok('FindUltimapperDistance: autoinspect restored', A.autoInspect === true && S.ultimapperRenderMap.dpthimagebitdepth === 21);
    r = run('GenerateUltimapper', { PSet: um });
    ok('GenerateUltimapper: generator logged, no return value', !r.err && nya(r) && r.v === undefined && A.autoInspect === true);
    A.autoInspect = false; cube.removeProperty(um);
  }

  // ================= ShapeWeight
  {
    const mk = n => A.run('GetPrim', { PresetObj: 'Null', Name: n });
    const u0 = A.undoStack.length;
    const smp = mk('smpB13e'), ctl = mk('ctlB13e'), par = mk('parB13e');
    par.kinematics.local.set('posx', 1); smp.kinematics.local.set('posx', 3); smp.kinematics.local.set('sclx', 0.001); smp.kinematics.local.set('scly', 2);
    let r = run('fr_AddSamplerDataCache', { Sampler: smp, Control: ctl, ControlParent: par });
    const blob = r.v; const m = blob?.matrix;
    ok('fr_AddSamplerDataCache: SamplerData blob on Control, returned', !r.err && blob?.name === 'SamplerData' && ctl.properties.includes(blob), r.err);
    ok('fr_AddSamplerDataCache: sampler pose in ControlParent space, scaling <= 0.0012 zeroed, flag 1', m && near(m[12], 2) && near(m[0], 0) && near(m[5], 2) && blob.flag === 1, m);
    r = run('fr_AddSamplerDataCache', { Sampler: smp, Control: ctl, ControlParent: par });
    ok('fr_AddSamplerDataCache: the blob is reused', r.v === blob && ctl.properties.filter(p => p.name === 'SamplerData').length === 1);
    const mix = A.scene.root.properties.find(p => p.type === 'mixer'); mix.clips.push({ name: 'ClipB13e', source: 'x', start: 1, duration: 10, weight: 1 }, { name: 'ClipB13f', source: 'x', start: 1, duration: 10, weight: 1 });
    const k0 = S.operators.length;
    r = run('fr_ApplyShapeWeightOp', { Clip: ['ClipB13e', 'ClipB13f'], Sampler: smp, n0: 1, n1: 2, n2: 0.5, Control: ctl, ControlParent: par, NoNeutraPose: true, Method: 99 });
    const ops = S.operators.slice(k0);
    ok('fr_ApplyShapeWeightOp: one fro_ShapeWeightOp per clip, return value never set', !r.err && r.v === undefined && ops.length === 2 && ops.every(o => o.type === 'fro_ShapeWeightOp'), r.err);
    ok('fr_ApplyShapeWeightOp: parameters n0 n1 n2 i NoNeutralPose', ops[1]?.val('n0') === 1 && ops[1].val('n2') === 0.5 && ops[1].val('i') === 1 && ops[0].val('i') === 0 && ops[0].val('NoNeutralPose') === true);
    ok('fr_ApplyShapeWeightOp: ports (clip weight output; InCntrlLocal, InParentCntrlLocal, InSamplerMatrixBlob)', ops[0]?.ports.output.target.name === 'ClipB13e' && ops[0].ports.inputs.InCntrlLocal === ctl.kinematics.local && ops[0].ports.inputs.InSamplerMatrixBlob === blob);
    ok('fr_ApplyShapeWeightOp: Method is not read (no parameter)', !ops[0]?.get('Method'));
    while (A.undoStack.length > u0) A.undo();
    ok('fr_ApplyShapeWeightOp: undo', S.operators.length === k0 && !A.scene.find('smpB13e'), [S.operators.length, k0, !!A.scene.find('smpB13e'), A.undoStack.length, u0]);
    mix.clips.splice(-2, 2);
  }

  // ================= FR_Import_Animation_Rig_To_ICE
  {
    const Model = A.scene.root.constructor, Prop = cube.properties[0].constructor;
    const fm = new Model('FaceB13e'); A.scene.root.addChild(fm);
    fm.addProperty(new Prop('Mesh', 'customparamset', [{ name: 'Geometry', type: 'string', value: 'headB13e' }]));
    const head = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'headB13e' }); fm.addChild(head);
    const smp = A.run('GetPrim', { PresetObj: 'Null', Name: 'Brow_Sampler' }); fm.addChild(smp); smp.addProperty(new Prop('SamplerCache', 'customparamset', []));
    const tg = A.run('GetPrim', { PresetObj: 'Null', Name: 'Tongue_Sampler' }); fm.addChild(tg); tg.addProperty(new Prop('samplercache', 'customparamset', []));
    S.lastPut = null;
    let r = run('FR_Import_Animation_Rig_To_ICE', { ModelName: 'cube', FreezeICEData: false });
    ok('FR_Import_Animation_Rig_To_ICE: ReturnValue true put before the checks; not a model -> E_FAIL', status(r, '80004005') && S.lastPut?.value === true, r);
    r = run('FR_Import_Animation_Rig_To_ICE', { ModelName: 'FaceB13e', FreezeICEData: false });
    const trees = head.primitive.operators.filter(o => o.type === 'icetree');
    ok('FR_Import_Animation_Rig_To_ICE: returns true, ICE trees "FR Create ICE Data" and "FR ICE Blend Shapes" on the mesh', r.v === true && trees.map(t => t.name).join() === 'FR Create ICE Data,FR ICE Blend Shapes', [r.err, trees.map(t => t.name)]);
    ok('FR_Import_Animation_Rig_To_ICE: samplers without "Tongue" carrying SamplerCache', trees[0]?.samplers.map(s => s.name).join() === 'Brow_Sampler');
    ok('FR_Import_Animation_Rig_To_ICE: compounds, attributes, progress caption', trees[1]?.compounds.join() === 'FR Blend Shapes,FR Determine Shapes Per Point' && trees[0].attributes.includes('Self.ShapeController') && has(r, /^Converting Shape Setup to ICE Trees \(this may take a few minutes\)\.\.\.$/));
    r = run('FR_Import_Animation_Rig_To_ICE', { ModelName: 'FaceB13e', FreezeICEData: false, IsTongue: true });
    ok('FR_Import_Animation_Rig_To_ICE: IsTongue without a Tongue property -> E_FAIL', status(r, '80004005'));
    A.scene.root.removeChild(fm);
  }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_plugins_b13e_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
