// CMD-B14d / CMD-B14e (Face Robot FR.dll): the 36 commands of src/commands/faceRobotB14d*.ts and faceRobotB14e*.ts.
// There is no XSIBATCH golden for these rows: this is a contract check against docs/ghidra/cmd-b14d-fr-retarget-mocap.md,
// docs/ghidra/cmd-b14e-fr-export-weights.md and docs/re/WIRE_CORRECTIONS_B14.md items 1-7.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; names, order, defaults).
//      One catalogue default is replaced as the correction states: fr_FitTongue TongueMarkers "" -> empty array;
//   2. every command runs with its default arguments on the ?demo scene plus the sample face (buildSampleFace) without
//      an unexpected error (commands whose required input has no default must fail with a message naming the command);
//   3. the contracts' stated results (stage codes, layout id mapping, C3D read / gap fill / round trip, export no-ops,
//      tongue fit / solve, regenerate-mouth box, weight clipping, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b14de_commands.mjs
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

const NAMES_D = ['fr_LoadC3D', 'fr_WriteC3D', 'fr_C3DDebugFace', 'fr_C3DToFaceRobot', 'fr_CalibrateFace', 'fr_LogFaceCalibration', 'fr_AdjustRetargetedFace',
  'fr_CalibrateRetargetedFace', 'fr_FlushRetargetedFace', 'fr_PlotRetargetedFace', 'fr_PlotRetargetedFaceUI', 'fr_SaveFacePose', 'fr_ApplyFacePose',
  'fr_CreateFaceMap', 'fr_FacialMocapTools', 'FaceRobot', 'fr_GetCurrentStage', 'fr_SwitchFaceLayout'];
const NAMES_E = ['fr_ExportLWScene', 'fr_ExportModel', 'fr_ExportMotionFile', 'fr_ExportPointOvenCache', 'fr_ExportPointOvenScene', 'fr_ExportShape',
  'fr_ApplyFaceRobotGameShader', 'fr_ClipWeights', 'fr_ShakeFit', 'fr_CrawlToVertex', 'fr_FitTongue', 'fr_SolveTongue', 'fr_RegenerateMouth',
  'fr_DuplicateFace', 'fr_DeformerToWeightMap', 'fr_DeformerTransfer', 'fr_EnvelopeAliasing', 'fr_ExportGameHierarchy'];
const NAMES = [...NAMES_D, ...NAMES_E];
const DEFAULT_FAILS = new Set(['fr_ApplyFaceRobotGameShader', 'fr_ClipWeights', 'fr_FitTongue', 'fr_EnvelopeAliasing']);
const DEFAULT_OVERRIDES = { 'fr_FitTongue.TongueMarkers': [] };

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  return [n, f ? f.args.map(a => [a.name, DEFAULT_OVERRIDES[`${n}.${a.name}`] ?? a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('fr_ExportGameHierarchy') && !!window.Application?.frB14de && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const H = A.frB14de, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const find = (n) => A.scene.find(n);
  const ST = () => A.faceRobotB14;
  const D = () => ST().rows.B14d, E = () => ST().rows.B14e;
  const lastBox = () => ST().boxes[ST().boxes.length - 1];
  const kv = (o, p) => o.kinematics.local.get(p).value;
  const key0 = (o, p) => A.anim.fcurve(o.kinematics.local.get(p))?.keys.map(k => [k.time, k.value]) ?? [];

  // ---------- before any face robot exists
  {
    ok('fr_GetCurrentStage: no ActiveFaceRobot -> 0', run('fr_GetCurrentStage').v === 0);
    const r = run('fr_DuplicateFace');
    ok('fr_DuplicateFace: no FaceModel -> DISP_E_MEMBERNOTFOUND', status(r, '80020003') && r.err.includes('fr_DuplicateFace'), r);
  }
  H.buildSampleFace(A);
  const face = find('Face'), mesh = find('FaceMesh');

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (nothing selected)
  for (const n of NAMES) {
    A.select([]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  ok('category Face Robot', NAMES.every(n => A.commands.get(n).category === 'Face Robot'));

  // ================= stage codes (B14d §2.3, correction 1)
  {
    ok('stage: sample face (connections + FaceState) -> 15', run('fr_GetCurrentStage').v === 15);
    const fsProp = face.properties.find(p => p.name === 'FaceState'); face.removeProperty(fsProp);
    ok('stage: no FaceState -> 10', run('fr_GetCurrentStage').v === 10);
    face.addProperty(fsProp);
    const pick = H.newNull(A, 'PickPoints', face); const pp = H.newNull(A, 'pp1', pick);
    ok('stage: PickPoints with a child -> 30', run('fr_GetCurrentStage').v === 30);
    const hn = H.newNull(A, 'HeadNull', face);
    ok('stage: HeadNull (other parent) -> 40', run('fr_GetCurrentStage').v === 40);
    const hc = H.newNull(A, 'Head_Control', face); hc.addChild(hn);
    ok('stage: HeadNull under Head_Control -> 50', run('fr_GetCurrentStage').v === 50);
    const slr = mesh.addProperty(new H.Property('SculptLinkReader', 'customparamset', []));
    ok('stage: SculptLinkReader on the mesh -> 60', run('fr_GetCurrentStage').v === 60);
    mesh.removeProperty(slr); face.removeChild(pick); hc.removeChild(hn); face.removeChild(hc); void pp;
    ok('stage: back to 15, fr_GetCurrentStage is not logged (noLog)', run('fr_GetCurrentStage').v === 15 && A.commands.get('fr_GetCurrentStage').noLog === true);
  }

  // ================= fr_SwitchFaceLayout (correction 2)
  {
    const d = D(); const c0 = d.putActiveLayoutCalls;
    let r = run('fr_SwitchFaceLayout', { inLayoutID: 0 });
    ok('fr_SwitchFaceLayout(0): current stage code 15 -> id 15, stage 1; no return value', !r.err && r.v === undefined && d.lastLayoutId === 15 && d.lastStage === 1 && A.__faceRobotStage === 1, [r, d.lastLayoutId]);
    ok('fr_SwitchFaceLayout: activates the Face Robot layout every call', d.activeLayout === 'Face Robot' && d.putActiveLayoutCalls === c0 + 1);
    run('fr_SwitchFaceLayout', { inLayoutID: 3 });
    ok('fr_SwitchFaceLayout(3): id < 10 is x10 -> 30, stage 3', d.lastLayoutId === 30 && d.lastStage === 3 && A.__faceRobotStage === 3 && d.putActiveLayoutCalls === c0 + 2);
    run('fr_SwitchFaceLayout', { inLayoutID: 45 });
    ok('fr_SwitchFaceLayout(45): stage = id / 10 = 4', d.lastLayoutId === 45 && d.lastStage === 4 && JSON.stringify(d.stageViews.map(v => v.name)) === '["stage4"]');
    const k = d.calls.length;
    run('fr_SwitchFaceLayout', { inLayoutID: 5 });
    const calls = d.calls.slice(k).filter(c => c.name === 'ShowOptionalPanel').map(c => c.args.Name);
    ok('fr_SwitchFaceLayout(5): id 50 shows the timeline and toolset optional panels', JSON.stringify(calls) === '["timeline","toolset"]', calls);
    ok('fr_SwitchFaceLayout(5): views stage5 / stage5library / stage5lower refreshed, stage5 hidden', JSON.stringify(d.stageViews.map(v => v.name)) === '["stage5","stage5library","stage5lower"]' && d.stageViews.every(v => v.refresh) && d.stageViews[0].visible === false);
    const k2 = d.calls.length; run('fr_SwitchFaceLayout', { inLayoutID: 51 });
    ok('fr_SwitchFaceLayout(51): optional panels only for exactly 50', !d.calls.slice(k2).some(c => c.name === 'ShowOptionalPanel'));
    d.layoutPresent = false; d.activeLayout = 'Default';
    r = run('fr_SwitchFaceLayout', { inLayoutID: 2 });
    ok('fr_SwitchFaceLayout: Face Robot layout missing -> log, E_FAIL', status(r, '80004005') && has(r, /^Unable to locate Face Robot layout\.  Terminating\./), r);
    d.layoutPresent = true;
    ST().interactive = false; const c1 = d.putActiveLayoutCalls;
    r = run('fr_SwitchFaceLayout', { inLayoutID: 2 });
    ok('fr_SwitchFaceLayout: not interactive -> OK, nothing done', !r.err && d.putActiveLayoutCalls === c1);
    ST().interactive = true;
  }

  // ================= FaceRobot (correction 3)
  {
    const d = D(); A.select([find('cube')]); const c0 = d.putActiveLayoutCalls; const mu = A.maxUndo;
    let r = run('FaceRobot', { cmd: 'id' });
    ok('FaceRobot id: logs "Autodesk|FACE ROBOT 2.0", no layout switch, no return value, selection cleared', !r.err && r.v === undefined && has(r, /^Autodesk\|FACE ROBOT 2\.0$/) && d.putActiveLayoutCalls === c0 && A.selection.length === 0, r);
    r = run('FaceRobot', { cmd: 'bogus' });
    ok('FaceRobot unknown: "Unknown Face Robot command: <cmd>"', has(r, /^Unknown Face Robot command: bogus$/) && d.putActiveLayoutCalls === c0, r);
    A.__faceRobotStage = 4;
    r = run('FaceRobot', { cmd: 'analyze', arg: 'x' });
    ok('FaceRobot analyze: blanked like cmd "" -> stage actions + layout switch with the stage read before (15 -> stage 1)', !r.err && d.putActiveLayoutCalls === c0 + 1 && d.lastLayoutId === 15 && A.__faceRobotStage === 1 && !has(r, /Unknown Face Robot/), r);
    ok('FaceRobot: General.undo is 0 while it runs and restored after', d.undoDuring === 0 && A.maxUndo === mu, [d.undoDuring, A.maxUndo, mu]);
    r = run('FaceRobot', { cmd: 'solve' });
    ok('FaceRobot solve: behaves like ""', !r.err && !has(r, /Unknown/) && d.putActiveLayoutCalls === c0 + 2);
    r = run('FaceRobot', { cmd: 'clear', arg: 'type' });
    ok('FaceRobot clear type at stage <= 29 sets the reset flag', d.clearFlag === true && d.putActiveLayoutCalls === c0 + 3);
    r = run('FaceRobot', { cmd: 'next' });
    ok('FaceRobot next at stage 15: stage action (not attested) + layout switch', nya(r) && d.putActiveLayoutCalls === c0 + 4);
  }

  // ================= C3D (B14d §2.4)
  const enc = (o) => {
    const { labels, frames, scale, rate, proc = 84, units = 'mm' } = o; const P = labels.length, F = frames.length;
    const len = Math.max(...labels.map(s => s.length));
    const prm = [0, 0, 1, proc];
    const pushName = (s) => { for (const ch of s) prm.push(ch.charCodeAt(0)); };
    const i16 = (arr, v) => { arr.push(v & 0xff, (v >> 8) & 0xff); };
    prm.push(5, (-1) & 0xff); pushName('POINT'); i16(prm, 3); prm.push(0);
    prm.push(6, 1); pushName('LABELS'); i16(prm, 5 + 2 + P * len + 1); prm.push((-1) & 0xff, 2, len, P); for (const s of labels) pushName(s.padEnd(len, ' ')); prm.push(0);
    prm.push(5, 1); pushName('UNITS'); i16(prm, 0); prm.push((-1) & 0xff, 1, units.length); pushName(units); prm.push(0);
    const pblocks = Math.ceil(prm.length / 512); prm[2] = pblocks;
    const w = scale > 0 ? 2 : 4; const dataLen = F * P * 4 * w; const total = 512 + pblocks * 512 + dataLen;
    const b = new Uint8Array(total); const dv = new DataView(b.buffer);
    const putF = (off, v) => { if (proc === 85) { const t = new Uint8Array(4); new DataView(t.buffer).setFloat32(0, v / 0.25, true); b.set([t[2], t[3], t[0], t[1]], off); } else dv.setFloat32(off, v, true); };
    b[0] = 2; b[1] = 0x50; dv.setInt16(2, P, true); dv.setInt16(4, 0, true); dv.setInt16(6, 1, true); dv.setInt16(8, F, true); dv.setInt16(10, 10, true);
    putF(12, scale); dv.setInt16(16, 2 + pblocks, true); putF(20, rate);
    b.set(prm, 512);
    const ds = 512 + pblocks * 512;
    frames.forEach((fr, f) => fr.forEach((p, i) => { const o = ds + (f * P + i) * 4 * w; if (scale > 0) { p.forEach((v, c) => dv.setInt16(o + 2 * c, Math.round(v / scale), true)); dv.setInt16(o + 6, 7, true); } else { p.forEach((v, c) => putF(o + 4 * c, v)); putF(o + 12, 0); } }));
    return b;
  };
  const writeBin = (p, b) => { let s = ''; for (const x of b) s += String.fromCharCode(x); FS.writeFile(p, s); };
  const readBin = (p) => Uint8Array.from(FS.readFile(p), c => c.charCodeAt(0));
  FS.ensureFolder('C:\\b14de');
  const DIR = 'C:\\b14de';
  const A3 = (i) => [i + 1, 2 * (i + 1), 3 * (i + 1)];
  const raw = [
    [[1, 2, 3], [0, 0, 0], [2, 2, 2]],
    [[1, 2, 3], [1, 1, 1], [2, 2, 2]],
    [A3(0), [2, 2, 2], [4, 4, 4]],
    [A3(1), [2, 2, 2], [0, 0, 0]],
    [A3(2), [2, 2, 2], [6, 6, 6]],
    [A3(3), [2, 2, 2], [8, 8, 8]],
    [A3(4), [2, 2, 2], [10, 10, 10]],
  ];
  const f1 = DIR + '\\take1.c3d';
  writeBin(f1, enc({ labels: ['Head:A', 'B', 'C'], frames: raw, scale: 0.5, rate: 60 }));
  {
    const d = H.readC3D(readBin(f1), 2);
    ok('C3D reader: labels trimmed, ":" -> "_", units', JSON.stringify(d.labels) === '["Head_A","B","C"]' && d.units === 'mm', d && [d.labels, d.units]);
    ok('C3D reader: first fully valid frame k = 1 -> frames 0..1 dropped (k + 1), drop stored', d.drop === 2 && d.F === 5 && d.rawF === 7 && d.rate === 60, d && [d.drop, d.F, d.rawF]);
    ok('C3D reader: axis mode 2 maps C3D (x, y, z) to (y, z, x), int16 x scale', d.frames[0][0] === 2 && d.frames[0][1] === 3 && d.frames[0][2] === 1, d && Array.from(d.frames[0]));
    ok('C3D gap fill: interior gap interpolated toward the frame after the first valid one', near(d.frames[1][6], 4 + 4 / 3) && near(d.frames[1][8], 4 + 4 / 3), d && Array.from(d.frames[1]));
    const m1 = H.readC3D(readBin(f1), 1);
    ok('C3D reader: axis mode 1 leaves the axes unchanged', m1.frames[0][0] === 1 && m1.frames[0][1] === 2 && m1.frames[0][2] === 3);
  }
  const fd = DIR + '\\dec.c3d';
  writeBin(fd, enc({ labels: ['D'], frames: [[[1.5, -2, 0.25]], [[1.5, -2, 0.25]]], scale: -1, rate: 30, proc: 85 }));
  {
    const d = H.readC3D(readBin(fd), 2);
    ok('C3D reader: processor 85 (DEC) floats: halves swapped, x 0.25; float data when scale <= 0', d && d.rate === 30 && d.frames[0][0] === -2 && d.frames[0][1] === 0.25 && d.frames[0][2] === 1.5 && d.drop === 0, d && [d.rate, Array.from(d.frames[0])]);
  }
  {
    A.anim.fps = 30;
    let r = run('fr_LoadC3D', { initDir: f1 });
    const m = find('C3DFaceData'); const cA = find('Head_A');
    ok('fr_LoadC3D: .c3d initDir used directly, returns the path', r.v === f1 && !r.err, r);
    ok('fr_LoadC3D: model C3DFaceData under the root with one cube per label', m?.parentObj === A.scene.root && JSON.stringify(m.children.map(c => c.name)) === '["Head_A","B","C"]');
    ok('fr_LoadC3D: C3D_Parameters.units = POINT:UNITS', m.properties.find(p => p.name === 'C3D_Parameters')?.val('units') === 'mm');
    const g = A.scene.groupList.find(x => x.name === 'C3D_Markers_Group');
    ok('fr_LoadC3D: group C3D_Markers_Group holds the cubes, material C3DMarkerMaterial', g?.members.length === 3 && cA.material?.name === 'C3DMarkerMaterial');
    ok('fr_LoadC3D: N = floor(F * rate / c3dRate + 0.5) keys at 0..N-1, Play Control.Out = N', key0(cA, 'posx').length === 3 && A.anim.endFrame === 3, [key0(cA, 'posx'), A.anim.endFrame]);
    const k = key0(cA, 'posx'), ky = key0(cA, 'posy'), kz = key0(cA, 'posz');
    ok('fr_LoadC3D: sample i at C3D frame i * F / N (axis-converted)', near(k[0][1], 2) && near(ky[0][1], 3) && near(kz[0][1], 1) && near(k[1][1], 4 + 4 / 3) && near(ky[1][1], 6 + 2) && near(kz[1][1], 2 + 2 / 3) && near(k[2][1], 8 + 2 / 3), [k, ky, kz]);
    const blob = cA.properties.find(p => p.name === 'c3dudb');
    ok('fr_LoadC3D: per-marker UserDataBlob with N x (x, y, z)', blob?.type === 'UserDataBlob' && blob.data.length === 9);
    ok('fr_LoadC3D: progress pbar_import_motion; unread parts logged', ST().progress.includes('pbar_import_motion') && nya(r));
    ST().store.put('mods', 'offset', 1);
    r = run('fr_LoadC3D', { initDir: f1 });
    ok('fr_LoadC3D: mods/offset read once and removed, N reduced by it; old C3DFaceData deleted', A.anim.endFrame === 2 && ST().store.raw('mods', 'offset') === undefined && A.scene.root.children.filter(c => c.name === 'C3DFaceData').length === 1 && near(key0(find('Head_A'), 'posx')[0][1], 7), [A.anim.endFrame, key0(find('Head_A'), 'posx')]);
    ST().store.put('mods', 'offset', 9);
    r = run('fr_LoadC3D', { initDir: f1 });
    ok('fr_LoadC3D: offset >= count -> "Offset value is too large ..." and 0', has(r, /^Offset value is too large for this mocap\.  It will be ignored\.$/) && A.anim.endFrame === 3);
    r = run('fr_LoadC3D', { initDir: DIR + '\\none.c3d' });
    ok('fr_LoadC3D: missing file -> "Cannot open C3D file for reading.", status OK', !r.err && has(r, /^Cannot open C3D file for reading\.$/) && !find('C3DFaceData'));
    r = run('fr_LoadC3D', { initDir: DIR });
    ok('fr_LoadC3D: folder initDir -> "Select C3D File" dialog; cancel -> ""', r.v === '' && has(r, /Select C3D File/));
    ST().hooks.fileDialog = (c, t, f) => (c === 'fr_LoadC3D' && t === 'Select C3D File' && f === 'Select C3D File (*.c3d)|*.c3d||' ? fd : null);
    r = run('fr_LoadC3D', { initDir: DIR });
    ok('fr_LoadC3D: dialog path read (DEC float file)', r.v === fd && near(key0(find('D'), 'posx')[0]?.[1], -2) && near(key0(find('D'), 'posz')[0]?.[1], 1.5), r);
    ST().hooks.fileDialog = undefined;
    FS.writeFile(DIR + '\\bad.nam', 'GlobalMotion { Head_A Zed C }');
    r = run('fr_LoadC3D', { namefile: DIR + '\\bad.nam', initDir: f1 });
    ok('fr_LoadC3D: name file error "GlobalMotion has bad head frame node <name>"', has(r, /^Error parsing the name file: GlobalMotion has bad head frame node Zed$/) && find('B'));
    FS.writeFile(DIR + '\\good.nam', 'GlobalMotion { head_a B C }\nMapping { Head_A NoseTip_Control C Chin_Control }');
    r = run('fr_LoadC3D', { namefile: DIR + '\\good.nam', initDir: f1 });
    ok('fr_LoadC3D: name file applied (case-insensitive), markers it names are kept', !r.err && !!find('Head_A') && !!find('B') && !!find('C') && has(r, /FrameAll/) === false, r.err);
    FS.writeFile(DIR + '\\map.nam', 'Mapping { Head_A NoseTip_Control C Chin_Control }');
    r = run('fr_LoadC3D', { namefile: DIR + '\\map.nam', initDir: f1 });
    ok('fr_LoadC3D: markers the name file does not name are deleted (inferred)', !find('B') && !!find('Head_A'));
    const callsD = D().calls.map(c => c.name);
    ok('fr_LoadC3D: FrameAll and DeselectAll run', callsD.includes('FrameAll') && callsD.includes('DeselectAll'));
  }
  // C3D -> Face Robot, write back
  {
    let r = run('fr_C3DToFaceRobot', { c3dfile: '' });
    ok('fr_C3DToFaceRobot: empty -> "fr_C3DToFaceRobot: missing c3d file.", false', r.v === false && has(r, /^fr_C3DToFaceRobot: missing c3d file\.$/));
    r = run('fr_C3DToFaceRobot', { c3dfile: DIR + '\\x.txt' });
    ok('fr_C3DToFaceRobot: not .c3d -> false', r.v === false && has(r, /missing c3d file/));
    r = run('fr_C3DToFaceRobot', { c3dfile: f1 });
    ok('fr_C3DToFaceRobot: no face map -> box "Could not find a valid face map ...", false', r.v === false && lastBox().text.startsWith('Could not find a valid face map for the C3D file.  Please generate a new\nface map') && lastBox().caption === 'SOFTIMAGE|Face Robot' && lastBox().flags === 0x30);
    FS.writeFile(DIR + '\\take1.fmap', 'FaceMap1.0 junk');
    r = run('fr_C3DToFaceRobot', { c3dfile: f1 });
    ok('fr_C3DToFaceRobot: older fmap tag -> "FaceMap file is out of date.  Please generate a new one."', r.v === false && lastBox().text === 'FaceMap file is out of date.  Please generate a new one.');
    // a face map written by fr_CreateFaceMap
    ST().hooks.fileDialog = (c, t, f) => (c === 'fr_CreateFaceMap' && t === 'Save Face Map' && f === 'Save Face Map (*.fmap)|*.fmap||' ? DIR + '\\take1.fmap' : null);
    r = run('fr_CreateFaceMap', { namefile: DIR + '\\map.nam', initdir: DIR });
    const fmText = FS.readFile(DIR + '\\take1.fmap');
    ok('fr_CreateFaceMap: writes the face map (FaceMap1.2 ... EndMapping) and _GroupMap_.gfmap, returns its path', r.v === DIR + '\\take1.fmap' && fmText.startsWith('FaceMap1.2') && fmText.trim().endsWith('EndMapping') && /Head_A NoseTip_Control/.test(fmText) && FS.isFile(DIR + '\\_GroupMap_.gfmap'), [r, fmText]);
    ST().hooks.fileDialog = undefined;
    r = run('fr_CreateFaceMap', { namefile: DIR + '\\missing.nam' });
    ok('fr_CreateFaceMap: bad name file -> "Bad namefile for the CreateFaceMap command."', r.v === '' && has(r, /^Bad namefile for the CreateFaceMap command\.$/));
    const nt = H.newNull(A, 'NoseTip_Control', face); nt.kinematics.local.get('posx').value = 1.5; nt.kinematics.local.get('posy').value = 2.5; nt.kinematics.local.get('posz').value = -0.5;
    const ch = H.newNull(A, 'Chin_Control', face); ch.kinematics.local.get('posx').value = 3; ch.kinematics.local.get('posy').value = 0.5; ch.kinematics.local.get('posz').value = 1;
    r = run('fr_C3DToFaceRobot', { c3dfile: f1 });
    const rb = face.properties.find(p => p.type === 'UserDataBlob' && p.data?.retarget);
    ok('fr_C3DToFaceRobot: face map found next to the C3D -> true; retarget builder not attested (blob stand-in)', r.v === true && rb?.data.retarget.count === 3 && nya(r), [r.v, rb?.data]);
    const out = DIR + '\\out.c3d';
    r = run('fr_WriteC3D', { inputfile: f1, outputfile: out });
    const b = readBin(out), b0 = readBin(f1); const dv = new DataView(b.buffer), dv0 = new DataView(b0.buffer);
    const ds = 512 * 2, at = (f, p, c) => dv.getInt16(ds + (f * 3 + p) * 8 + c * 2, true), at0 = (f, p, c) => dv0.getInt16(ds + (f * 3 + p) * 8 + c * 2, true);
    ok('fr_WriteC3D: mapped markers patched in place from the drop offset on (inverse axis: +90 Y, +90 X; int16 trunc(v / scale))',
      [2, 3, 4, 5, 6].every(f => at(f, 0, 0) === -1 && at(f, 0, 1) === 3 && at(f, 0, 2) === 5 && at(f, 2, 0) === 2 && at(f, 2, 1) === 6 && at(f, 2, 2) === 1), [0, 1, 2, 3, 4, 5, 6].map(f => [at(f, 0, 0), at(f, 0, 1), at(f, 0, 2), at(f, 2, 0), at(f, 2, 1), at(f, 2, 2)]));
    ok('fr_WriteC3D: frames before the offset, unmapped points and residual words kept', at(0, 0, 0) === at0(0, 0, 0) && at(1, 2, 2) === at0(1, 2, 2) && [0, 1, 2, 3, 4, 5, 6].every(f => at(f, 1, 0) === at0(f, 1, 0) && at(f, 0, 3) === 7) && b.length === b0.length);
    ok('fr_WriteC3D: progress "Extracting motion ..."', ST().progress.includes('Extracting motion ...'));
    r = run('fr_WriteC3D', { inputfile: DIR + '\\none.c3d', outputfile: DIR + '\\o2.c3d' });
    ok('fr_WriteC3D: input missing -> "Cannot open C3D file for reading.", status OK', !r.err && has(r, /^Cannot open C3D file for reading\.$/));
    ST().hooks.fileDialog = (c) => (c === 'fr_C3DDebugFace' ? f1 : null);
    r = run('fr_C3DDebugFace', { facemap: DIR + '\\take1.fmap', initdir: DIR });
    ok('fr_C3DDebugFace: always the dialog; returns the path; LeftLipZero / LipZero / RightLipZero cubes', r.v === f1 && !!find('LeftLipZero') && !!find('LipZero') && !!find('RightLipZero') && nya(r), r);
    ST().hooks.fileDialog = undefined;
    ok('fr_C3DDebugFace: cancelled dialog -> ""', run('fr_C3DDebugFace', { facemap: DIR + '\\take1.fmap', initdir: f1 }).v === '');
  }

  // ================= calibration / panels
  {
    let r = run('fr_CalibrateFace', Object.fromEntries(A.commands.get('fr_CalibrateFace').args.map((a, i) => [a.name, i + 1])));
    const cp = face.properties.find(p => p.name === 'FaceCalibrateProperties');
    ok('fr_CalibrateFace: FaceCalibrateProperties added on the face model, 20 values mapped (Ullip -> UpLLip, Dulip -> DownULip, Deyspitch -> DownEyesPitch)', cp && cp.val('UpULipScale') === 1 && cp.val('UpULipPitch') === 2 && cp.val('UpLLipScale') === 3 && cp.val('UpEyesPitch') === 10 && cp.val('DownULipScale') === 11 && cp.val('DownLLipPitch') === 14 && cp.val('DownEyesPitch') === 20 && r.v === undefined, cp && cp.params.map(p => [p.name, p.value]));
    ok('FaceCalibrateProperties: 20 doubles + OldFormat true; Scale default 1 range 0.., Pitch -180..180', cp.params.length === 21 && cp.get('OldFormat').def.value === true && cp.get('DownLLipScale').def.value === 1 && cp.get('DownLLipPitch').def.min === -180 && cp.get('DownLLipPitch').def.uimax === 30 && cp.get('DownLLipScale').def.uimax === 1.5);
    r = run('fr_LogFaceCalibration');
    ok('fr_LogFaceCalibration: one line CalibrateFace(<20 values>)', has(r, /^CalibrateFace\(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20\)$/), r.log);
    r = run('fr_CalibrateRetargetedFace');
    const v = D().views.find(x => x.name === 'FaceCalibrate');
    ok('fr_CalibrateRetargetedFace: Property Panel FaceCalibrate at (15, 15), width 400, targetcontent = property', v && v.type === 'Property Panel' && v.x === 15 && v.y === 15 && v.width === 400 && v.targetcontent === cp.fullName && D().calibrateModel === face.fullName, v);
    face.removeProperty(cp); face.addProperty(new H.Property('FaceCalibrateProperties', 'customparamset', [{ name: 'UpULipScale', type: 'double', value: 1 }]));
    run('fr_CalibrateRetargetedFace');
    ok('fr_CalibrateRetargetedFace: old layout (no DownLLipScale) deleted and re-added', !!face.properties.find(p => p.name === 'FaceCalibrateProperties')?.get('DownLLipScale'));
    const cp2 = face.properties.find(p => p.name === 'FaceCalibrateProperties'); face.removeProperty(cp2);
    run('fr_CalibrateRetargetedFace');
    ok('fr_CalibrateRetargetedFace: no property -> box', lastBox().text === 'Could not find a face model with retargeted motion or a facial preset pose.');
    face.addProperty(cp2);
    r = run('fr_AdjustRetargetedFace');
    ok('fr_AdjustRetargetedFace: no FaceAdjustProperties -> box, property not created', lastBox().text === 'Select a model with retargeted motion.' && !face.properties.find(p => p.name === 'FaceAdjustProperties'));
    const fa = face.addProperty(new H.Property('FaceAdjustProperties', 'customparamset', []));
    run('fr_AdjustRetargetedFace');
    const va = D().views.find(x => x.targetcontent === fa.fullName);
    ok('fr_AdjustRetargetedFace: panel at (15, 15) width 400; other FR panels closed', va && va.x === 15 && va.width === 400 && !D().views.some(x => x.name === 'FaceCalibrate') && D().adjustModel === face.fullName, D().views);
    run('fr_FacialMocapTools');
    const mt = A.scene.root.properties.find(p => p.name === 'FacialMocapTools'); const vm = D().views.find(x => x.targetcontent === mt?.fullName);
    ok('fr_FacialMocapTools: property on the scene root (C3DDir, FaceNameFile); panel at (150, 150) width 400', mt && mt.get('C3DDir') && mt.val('FaceNameFile') === '' && vm?.x === 150 && vm.y === 150 && vm.width === 400);
    run('fr_FacialMocapTools');
    ok('fr_FacialMocapTools: found, not added twice', A.scene.root.properties.filter(p => p.name === 'FacialMocapTools').length === 1);
  }

  // ================= plot / poses / flush
  {
    const hc = H.newNull(A, 'Head_Control', face); hc.kinematics.local.get('posx').value = 0.25;
    let r = run('fr_PlotRetargetedFace', { Start: 0, End: 3, IntervalStep: 5 });
    ok('fr_PlotRetargetedFace: End - Start < step -> log, E_FAIL', status(r, '80004005') && has(r, /^Error in inputs Step is too large: fr_PlotRetargetedFace\(Start, End, Step\)$/), r);
    r = run('fr_PlotRetargetedFace', { Start: 2, End: 8, IntervalStep: 3 });
    ok('fr_PlotRetargetedFace: plots the controls at Start..End by step, returns true', r.v === true && D().lastStatus.fr_PlotRetargetedFace === 0 && JSON.stringify(D().lastPlot.frames) === '[2,5,8]' && JSON.stringify(key0(hc, 'posx').map(k => k[0])) === '[2,5,8]', [r, D().lastPlot]);
    const rb = face.properties.find(p => p.type === 'UserDataBlob' && p.data?.retarget); face.removeProperty(rb);
    r = run('fr_PlotRetargetedFace', { Start: 0, End: 10, IntervalStep: 2 });
    ok('fr_PlotRetargetedFace: no retarget -> "Could not find a Face Robot rig with retargeted motion.", false, S_FALSE', r.v === false && D().lastStatus.fr_PlotRetargetedFace === 1 && has(r, /^Could not find a Face Robot rig with retargeted motion\.$/));
    face.addProperty(rb);
    D().hooks.inspect = (c, p, t) => { if (c !== 'fr_PlotRetargetedFaceUI' || t !== 'Plot Tool') return false; D().uiSeen = [p.val('Start'), p.val('End'), p.val('IntervalStep'), p.get('IntervalStep').def.min]; p.get('Start').value = 1; p.get('End').value = 5; p.get('IntervalStep').value = 2; return true; };
    r = run('fr_PlotRetargetedFaceUI');
    ok('fr_PlotRetargetedFaceUI: FacePlotProperties reset to 0, 0, 1; OK runs fr_PlotRetargetedFace with the edited values; property deleted', r.v === true && JSON.stringify(D().uiSeen) === '[0,0,1,1]' && JSON.stringify(D().lastPlot.frames) === '[1,3,5]' && !face.properties.find(p => p.name === 'FacePlotProperties'), [r, D().uiSeen, D().lastPlot]);
    D().hooks.inspect = undefined;
    r = run('fr_PlotRetargetedFaceUI');
    ok('fr_PlotRetargetedFaceUI: Cancel still plots with 0, 0, 1 (step 0)', r.v === true && JSON.stringify(D().lastPlot.frames) === '[0]' && !face.properties.find(p => p.name === 'FacePlotProperties'));
    // poses
    hc.kinematics.local.get('rotz').value = 12; A.anim.removeAnimation(hc.kinematics.local.get('posx')); hc.kinematics.local.get('posx').value = 0.75;
    const pf = DIR + '\\p.frpre';
    r = run('fr_SaveFacePose', { selectiononly: false, filename: pf });
    ok('fr_SaveFacePose: writes the pose file, logs "posefile saving: <f>" and per marker', FS.isFile(pf) && has(r, /^posefile saving: /) && has(r, /^processing marker: Head_Control$/) && ST().progress.includes('pbar_save_pose'), r.log);
    hc.kinematics.local.get('rotz').value = 0; hc.kinematics.local.get('posx').value = 0;
    r = run('fr_ApplyFacePose', { posefile: pf, selectOnApplication: true });
    ok('fr_ApplyFacePose: applies the pose, returns and selects the affected controls', Array.isArray(r.v) && r.v.includes(hc) && kv(hc, 'rotz') === 12 && kv(hc, 'posx') === 0.75 && A.selection.includes(hc), r);
    ok('fr_ApplyFacePose: runs fr_ResetAll first', D().calls.some(c => c.name === 'fr_ResetAll'));
    r = run('fr_ApplyFacePose', {});
    ok('fr_ApplyFacePose: missing pose file -> log, empty array', Array.isArray(r.v) && r.v.length === 0 && has(r, /^fr_ApplyFacePose: missing pose file\.$/));
    FS.writeFile(DIR + '\\bad.frpre', 'nonsense');
    r = run('fr_ApplyFacePose', { posefile: DIR + '\\bad.frpre' });
    ok('fr_ApplyFacePose: "Invalid Pose File: <f>"', has(r, /^Invalid Pose File: C:\\b14de\\bad\.frpre$/) && r.v.length === 0);
    // flush
    const op = new H.Operator('RetargetOp', 'fro_FaceRetargetOp2', []); mesh.primitive.addOperator(op);
    A.scene.addLayer('Head_ControlLayer');
    r = run('fr_FlushRetargetedFace');
    ok('fr_FlushRetargetedFace: retarget operators and Head_ControlLayer removed, fr_ResetAll run, progress pbar_clear_retarget, no return value', !mesh.primitive.operators.includes(op) && !A.scene.layers.some(l => l.name === 'Head_ControlLayer') && r.v === undefined && ST().progress.includes('pbar_clear_retarget'));
  }

  // ================= B14e: export stubs (correction 7)
  {
    const files = JSON.stringify(FS.listFiles ? FS.listFiles(DIR) : FS.readFile(f1).length); const u0 = A.undoStack.length;
    const rs = ['fr_ExportLWScene', 'fr_ExportModel', 'fr_ExportMotionFile', 'fr_ExportPointOvenCache', 'fr_ExportPointOvenScene', 'fr_ExportShape'].map(n => [n, run(n, { path: DIR, filename: 'x.lwo', start: 1, end: 9 })]);
    ok('fr_Export* (6): no-op, S_OK, no return value, no file, no undo entry', rs.every(([n, r]) => !r.err && r.v === undefined && E().lastStatus[n] === 0) && !FS.isFile(DIR + '\\x.lwo') && A.undoStack.length === u0 && JSON.stringify(FS.listFiles ? FS.listFiles(DIR) : FS.readFile(f1).length) === files);
  }

  // ================= game shader
  {
    const cube = find('cube');
    let r = run('fr_ApplyFaceRobotGameShader', { in_Target: cube, API: 'Vulkan' });
    ok('fr_ApplyFaceRobotGameShader: unknown API -> log, E_FAIL', status(r, '80004005') && has(r, /^Unrecognized API\. Please specify either 'OpenGL' or 'DirectX'$/));
    r = run('fr_ApplyFaceRobotGameShader', {});
    ok('fr_ApplyFaceRobotGameShader: no target -> "Please select the target mesh", E_FAIL', status(r, '80004005') && has(r, /^Please select the target mesh$/));
    r = run('fr_ApplyFaceRobotGameShader', { in_Target: cube, API: 'OpenGL', ClipCollection: [] });
    ok('fr_ApplyFaceRobotGameShader: no material named Constant -> E_FAIL; each missing slot logged', status(r, '80004005') && ['DIFFUSE', 'SPECULAR', 'BACKDIFFUSE', 'NORMAL', 'WRINKLE'].every(x => has(r, new RegExp(`^Specified clip for ${x} not found\\.$`))));
    const mat = A.scene.newMaterial('Constant', H.makeConstant('Constant')); cube.setMaterial(mat); mat.get('realtime').value = 'RTShader';
    const clip = A.scene.root.addProperty(new H.Property('clipB14', 'imageclip', [])); const clip2 = A.scene.root.addProperty(new H.Property('clipB14b', 'imageclip', []));
    const k = E().calls.length;
    r = run('fr_ApplyFaceRobotGameShader', { in_Target: cube, API: 'DirectX', ClipCollection: [clip, 'nope', 'clipB14b'] });
    const calls = E().calls.slice(k);
    ok('fr_ApplyFaceRobotGameShader: DirectX -> SetViewDisplayMode("DirectX9"), InspectObj(shader), S_OK, no return value', !r.err && r.v === undefined && calls.some(c => c.name === 'SetViewDisplayMode' && c.args.DisplayMode === 'DirectX9') && calls.some(c => c.name === 'InspectObj'), [r.err, calls]);
    const cn = calls.filter(c => c.name === 'SIConnectShaderToCnxPoint').map(c => [c.args.Source, c.args.InputObjs.split('.').pop(), c.args.DeleteOnLastDisconnection]);
    ok('fr_ApplyFaceRobotGameShader: clips connected by slot index to the port table (Specular, Wrinkle, Normal, Base, Ambient)', JSON.stringify(cn) === JSON.stringify([['Clips.clipB14', 'SpecularTextureSampler', false], ['Clips.clipB14b', 'NormalTextureSampler', false]]), cn);
    ok('fr_ApplyFaceRobotGameShader: "Connecting clip: <name>", "Specified clip for SPECULAR not found.", progress texts', has(r, /^Connecting clip: clipB14$/) && has(r, /^Specified clip for SPECULAR not found\.$/) && has(r, /^Applying Realtime Shader\.\.\.$/) && has(r, /^Constructing Shader UI$/) && has(r, /^Connecting clips$/));
    ok('fr_ApplyFaceRobotGameShader: OpenGL -> SetViewDisplayMode("OpenGL")', (() => { const k2 = E().calls.length; run('fr_ApplyFaceRobotGameShader', { in_Target: cube, ClipCollection: [] }); return E().calls.slice(k2).some(c => c.name === 'SetViewDisplayMode' && c.args.DisplayMode === 'OpenGL'); })());
    A.scene.root.removeProperty(clip); A.scene.root.removeProperty(clip2);
  }

  // ================= weights: an enveloped stand-in mesh
  const grid = H.meshObject(A, 'envB14', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0]], [[0, 1, 4, 3], [1, 2, 5, 4]]); A.scene.root.addChild(grid);
  const defs = [0, 1, 2].map(i => { const n = H.newNull(A, 'defB14_' + i); n.kinematics.local.get('posx').value = i; return n; });
  const env = new H.EnvelopeOperator(defs, () => grid); env.setReferencePoses();
  const W0 = [[0.5, 0.3, 0.2], [0.6, 0.4, 0], [0.1, 0.1, 0.8], [0.34, 0.33, 0.33], [1, 0, 0], [0.25, 0.25, 0.5]];
  env.weights = W0.map(w => Float32Array.from(w)); grid.primitive.addOperator(env);
  {
    let r = run('fr_ClipWeights', { inMesh: grid, inClip: 0, inIndex: 0 });
    ok('fr_ClipWeights: inClip 0 -> E_FAIL', status(r, '80004005') && r.err.includes('fr_ClipWeights'));
    r = run('fr_ClipWeights', { inMesh: grid, inClip: 2, inIndex: 1 });
    ok('fr_ClipWeights: no envelope at that index -> E_FAIL', status(r, '80004005'));
    r = run('fr_ClipWeights', { inMesh: grid, inClip: 2, inIndex: 0 });
    const w = env.weights.map(x => Array.from(x).map(v => Math.round(v * 1e4) / 1e4));
    ok('fr_ClipWeights: per point keep the largest inClip, rescale by 100/(100-R), fix the sum on the largest; no return value', r.v === undefined && JSON.stringify(w[0]) === '[0.625,0.375,0]' && JSON.stringify(w[1]) === '[0.6,0.4,0]' && JSON.stringify(w[2]) === '[0.1111,0,0.8889]' && near(w[3][0] + w[3][1] + w[3][2], 1, 1e-4) && w[3][2] === 0 && JSON.stringify(w[4]) === '[1,0,0]', w);
    A.undo();
    ok('fr_ClipWeights: undo restores the weights', near(env.weights[0][2], 0.2));
  }
  {
    const r = run('fr_ShakeFit', { goal: [1, 2, 3], Bones: defs, Weights: [] }); const u0 = A.undoStack.length;
    ok('fr_ShakeFit: result discarded, no return value, S_OK, nothing changed', !r.err && r.v === undefined && E().lastStatus.fr_ShakeFit === 0 && A.undoStack.length === u0 && Array.isArray(E().shakeDiscarded));
  }
  {
    A.selectComponents(mesh, 'point', [0, 4]);
    let r = run('fr_CrawlToVertex', { Select: false });
    ok('fr_CrawlToVertex: walks mesh edges between the listed vertices, returns "<object>.pnt[...]"', r.v === `${mesh.fullName}.pnt[0,1,2,3,4]`, r);
    A.selectComponents(mesh, 'point', [0, 12, 24]);
    r = run('fr_CrawlToVertex', { Select: true });
    const ids = /\[(.*)\]/.exec(r.v)?.[1].split(',').map(Number) ?? [];
    ok('fr_CrawlToVertex: multi-pair path ends at the last vertex, consecutive vertices share an edge; Select runs SelectGeometryComponents', ids[0] === 0 && ids.includes(12) && ids[ids.length - 1] === 24 && E().calls.some(c => c.name === 'SelectGeometryComponents' && c.args.SelectionList === r.v), r);
    A.compSel = null;
    ok('fr_CrawlToVertex: nothing selected -> ".pnt[]"', run('fr_CrawlToVertex').v === '.pnt[]');
  }
  {
    let r = run('fr_DeformerToWeightMap', { fromObject: grid, toObject: grid, fromDeformer: 'defB14_0', toCluster: 'wmB14', CompleteCluster: true });
    const cl = grid.cluster('wmB14');
    ok('fr_DeformerToWeightMap: vertex cluster toCluster with every point, weight map of the deformer influence, returned', r.v?.type === 'weightmap' && cl?.elements.size === 6 && near(r.v.values.get(0), 0.5) && near(r.v.values.get(2), 0.1), r.err);
    r = run('fr_DeformerToWeightMap', { fromObject: null, toObject: grid, fromDeformer: 'defB14_0', toCluster: 'x' });
    ok('fr_DeformerToWeightMap: missing source -> invalid return, S_OK', !r.err && r.v === null);
    const copy = H.meshObject(A, 'envB14copy', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0]], [[0, 1, 4, 3], [1, 2, 5, 4]]); A.scene.root.addChild(copy);
    r = run('fr_DeformerToWeightMap', { fromObject: grid, toObject: copy, fromDeformer: 'defB14_2', toCluster: 'wm2', CompleteCluster: true });
    ok('fr_DeformerToWeightMap: other target -> closest-point correspondence', near(r.v?.values.get(2), 0.8) && near(r.v?.values.get(5), 0.5));
    r = run('fr_DeformerTransfer', { fromObject: grid, toObject: copy, fromDeformer: 'defB14_1', toDeformer: 'wm3', type: 0 });
    ok('fr_DeformerTransfer type 0: toDeformer is the cluster name of a weight map; no return value', r.v === undefined && near(copy.cluster('wm3')?.properties[0]?.values.get(1), 0.4));
    const env2 = new H.EnvelopeOperator(defs, () => copy); env2.weights = W0.map(() => Float32Array.from([1, 0, 0])); copy.primitive.addOperator(env2);
    r = run('fr_DeformerTransfer', { fromObject: grid, toObject: copy, fromDeformer: 'defB14_2', toDeformer: 'defB14_2', type: 1, Clipping: 0 });
    ok('fr_DeformerTransfer type 1: envelope weights of fromDeformer onto toDeformer (writer not attested)', near(env2.weights[2][2], 0.8) && near(env2.weights[2][0], 0.2) && nya(r), env2.weights.map(x => Array.from(x)));
  }
  {
    let r = run('fr_DuplicateFace');
    const dm = r.v;
    ok('fr_DuplicateFace: default -> model FaceDuplicate under the root with the face mesh copy named like the source', dm?.name === 'FaceDuplicate' && dm.parentObj === A.scene.root && dm.children.some(c => c.name === 'FaceMesh' && c !== mesh), [r.err, dm?.children.map(c => c.name)]);
    r = run('fr_DuplicateFace', { dupmodelname: 'DupB14', parts: 3 });
    ok('fr_DuplicateFace parts 3: StressMesh duplicate, S_OK', r.v?.name.startsWith('StressMesh') && !r.err);
    r = run('fr_DuplicateFace', { dupmodelname: 'DupM1', method: 1 });
    ok('fr_DuplicateFace method 1: model dupmodelname filled from the Mesh registry entry', r.v?.name === 'DupM1' && r.v.children.length === 1);
  }
  {
    let r = run('fr_EnvelopeAliasing', { steptime: 0, clipping: 1, considerneighborhood: 0 });
    const al = E().aliasing;
    ok('fr_EnvelopeAliasing: steptime 0 -> 1; intime = outtime -> timeline; UnFilteredEnvelope copy; progress "Envelope Analysis"; clipping', !r.err && al?.step === 1 && al.frames === al.tout - al.tin + 1 && !!grid.properties.find(p => p.name === 'UnFilteredEnvelope') && ST().progress.includes('Envelope Analysis') && ST().progress.includes('Rewrite Weights') && env.weights.every(w => [...w].filter(v => v > 0).length === 1), [r.err, al]);
    A.undo();
  }
  {
    let r = run('fr_ExportGameHierarchy', { lowResMesh: grid, ApplyEnvelope: false });
    ok('fr_ExportGameHierarchy: ApplyEnvelope false -> model of the first deformer', !r.err && r.v === A.scene.root, [r.err, r.v?.name]);
    ok('fr_ExportGameHierarchy: progress "Game Export" / "Get Envelope Information"', ST().progress.includes('Game Export') && ST().progress.includes('Get Envelope Information'));
    r = run('fr_ExportGameHierarchy', { lowResMesh: grid, lowResTongueMesh: find('cube') });
    ok('fr_ExportGameHierarchy: already enveloped -> log + Yes/No/Cancel box (0x23, "Autodesk|Face Robot"); Cancel -> invalid; tongue without registry tongue logged', r.v === null && has(r, /^Game Export is already Enveloped$/) && has(r, /^FaceRobot model has no valid tongue$/) && lastBox().flags === 0x23 && lastBox().caption === 'Autodesk|Face Robot' && lastBox().text.startsWith('Game Face is already Enveloped: Do you want to re-envelope?\nYes:\tReenvelope and continue'));
    ST().hooks.msgBox = () => 7;
    r = run('fr_ExportGameHierarchy', { lowResMesh: grid });
    ok('fr_ExportGameHierarchy: No -> continue with the current envelope', r.v === A.scene.root);
    ST().hooks.msgBox = undefined;
    const plain = H.meshObject(A, 'plainB14', [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]); A.scene.root.addChild(plain);
    r = run('fr_ExportGameHierarchy', { lowResMesh: plain, ApplyEnvelope: false });
    ok('fr_ExportGameHierarchy: no envelope + ApplyEnvelope false -> "Game Export Needs An Envelope"', r.v === null && has(r, /^Game Export Needs An Envelope$/));
    r = run('fr_ExportGameHierarchy', { lowResMesh: plain });
    ok('fr_ExportGameHierarchy: new envelope -> model GameFace with the mesh parented under it', r.v?.name === 'GameFace' && plain.parentObj === r.v);
  }

  // ================= tongue (corrections 4, 5)
  {
    const tm = H.meshObject(A, 'TongueMeshB14', [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]); face.addChild(tm);
    const mk = ['TongueBase', 'TongueBack', 'TongueFront', 'TongueTip'].map((n, i) => { const o = H.newNull(A, n); o.kinematics.local.get('posz').value = [0, 9, 9, 10][i]; return o; });
    const fit = H.newNull(A, 'Fit', face); ST().store.put('_', 'Fit', fit);
    const hn = H.newNull(A, 'HeadNullB14', face); ST().store.put('hpoints', 'HeadNull', hn);
    H.ensureGroup(A, 'Tongue');
    let r = run('fr_FitTongue', { TongueMesh: tm, TongueMarkers: mk.slice(0, 3) });
    ok('fr_FitTongue: fewer than 4 markers -> E_FAIL', status(r, '80004005') && r.err.includes('fr_FitTongue'));
    r = run('fr_FitTongue', { TongueMarkers: mk });
    ok('fr_FitTongue: invalid TongueMesh -> E_FAIL', status(r, '80004005'));
    r = run('fr_FitTongue', { TongueMesh: tm, TongueMarkers: mk, MustDeleteMarkers: true });
    const nulls = r.v ?? [];
    ok('fr_FitTongue: one <marker>_Marker null per marker in name order under Fit, returned', JSON.stringify(nulls.map(n => n.name)) === '["TongueBack_Marker","TongueBase_Marker","TongueFront_Marker","TongueTip_Marker"]' && nulls.every(n => n.parentObj === fit), [r.err, nulls.map(n => n.name)]);
    ok('fr_FitTongue: Back moved to 0.67 Base + 0.33 Tip, Front to 0.34 Base + 0.66 Tip', near(nulls[0]?.globalMatrix().elements[14], 3.3) && near(nulls[2]?.globalMatrix().elements[14], 6.6), nulls.map(n => n.globalMatrix().elements[14]));
    ok('fr_FitTongue: registry meshes/Tongue, group Tongue, keyword "Tongue,Mesh"; no property attached', ST().store.raw('meshes', 'Tongue') === tm && A.scene.groupList.find(g => g.name === 'Tongue').members.includes(tm) && tm.userKeywords === 'Tongue,Mesh' && !tm.properties.some(p => p.type === 'facerobot'));
    ok('fr_FitTongue: MustDeleteMarkers deletes the passed markers', mk.every(m => !A.scene.find(m.name) || A.scene.find(m.name) !== m));
    r = run('fr_FitTongue', { TongueMesh: tm, TongueMarkers: nulls });
    ok('fr_FitTongue: tongue already registered -> S_FALSE, no change, no return value', !r.err && r.v === undefined && E().lastStatus.fr_FitTongue === 1 && fit.children.length === 4);
    // solve: failure first
    fit.removeChild(nulls[3]);
    r = run('fr_SolveTongue');
    ok('fr_SolveTongue: fewer than 4 markers -> "Tongue markers are missing", false, S_FALSE; the markers under Fit deleted', r.v === false && E().lastStatus.fr_SolveTongue === 1 && has(r, /^Tongue markers are missing$/) && fit.children.length === 0, r);
    for (const n of ['TongueBase', 'TongueBack', 'TongueFront', 'TongueTip']) H.newNull(A, `${n}_Marker`, fit);
    r = run('fr_SolveTongue', { Rescale: false });
    const ctl = ['TongueBase_Control', 'TongueBack_Control', 'TongueFront_Control', 'TongueTip_Control'].map(find);
    ok('fr_SolveTongue: four Tongue*_Control with keywords "Tongue,<part>", markers deleted, true, S_OK', r.v === true && E().lastStatus.fr_SolveTongue === 0 && ctl.every(Boolean) && ctl[0].userKeywords === 'Tongue,Base' && ctl[3].userKeywords === 'Tongue,Tip' && fit.children.length === 0, [r, ctl.map(c => c?.userKeywords)]);
    ok('fr_SolveTongue: FaceConnections.Tongue set; tongue mesh parented (JawEnd_Control / Jaw,Bone / FaceModel)', face.properties.find(p => p.name === 'FaceConnections').val('Tongue') === 'TongueMeshB14' && tm.parentObj === face);
    const n0 = A.scene.allObjects ? [...A.scene.allObjects()].length : 0;
    r = run('fr_SolveTongue');
    ok('fr_SolveTongue: a control keyed "Tongue,Base" exists -> true at once, nothing built', r.v === true && [...A.scene.allObjects()].length === n0);
  }

  // ================= fr_RegenerateMouth (correction 6)
  {
    const lc = H.newNull(A, 'LMouthCorner_Control', face), rc = H.newNull(A, 'RMouthCorner_Control', face);
    lc.kinematics.local.get('posx').value = 1; rc.kinematics.local.get('posx').value = -1;
    let r = run('fr_RegenerateMouth');
    ok('fr_RegenerateMouth: Yes/No/Cancel box (0x23, "SOFTIMAGE|Face Robot", text); not Yes -> nothing, no return value', r.v === undefined && lastBox().flags === 0x23 && lastBox().caption === 'SOFTIMAGE|Face Robot' && lastBox().text === 'Regenerate will delete all mouth sculpts.  Are you sure you want to continue?' && kv(lc, 'posx') === 1);
    ST().hooks.msgBox = () => 6;
    const rb = face.properties.find(p => p.type === 'UserDataBlob' && p.data?.retarget); face.removeProperty(rb);
    r = run('fr_RegenerateMouth');
    ok('fr_RegenerateMouth: Yes without the retarget blob -> S_FALSE, controls untouched', E().lastStatus.fr_RegenerateMouth === 1 && kv(lc, 'posx') === 1);
    face.addProperty(rb);
    mesh.addProperty(new H.Property('blob1', 'UserDataBlob', [])); mesh.addProperty(new H.Property('blob2', 'UserDataBlob', []));
    face.addProperty(new H.Property('CDKMetaMouthSculpt', 'UserDataBlob', []));
    const k = E().calls.length;
    r = run('fr_RegenerateMouth');
    const op = mesh.primitive.operators.find(o => o.name === 'MetaMouthOperator');
    ok('fr_RegenerateMouth: Yes -> controls zeroed, fcurves deactivated then reactivated, MetaMouthOperator (fro_MetaMouthOp2, UpdateInnerMouth) rebuilt, mouth blob deleted', E().lastStatus.fr_RegenerateMouth === 0 && kv(lc, 'posx') === 0 && op?.type === 'fro_MetaMouthOp2' && op.val('UpdateInnerMouth') === true && !face.properties.some(p => p.name === 'CDKMetaMouthSculpt') && E().calls.slice(k).some(c => c.name === 'ActivateFCurve' && c.args.Activate === false) && E().calls.slice(k).some(c => c.name === 'ActivateFCurve' && c.args.Activate === true) && E().calls.slice(k)[0].name === 'ActivateObjectSelTool', [r.err, op?.type]);
    r = run('fr_RegenerateMouth');
    ok('fr_RegenerateMouth: rebuilt, not duplicated; LipStiction present', mesh.primitive.operators.filter(o => o.name === 'MetaMouthOperator').length === 1 && !!mesh.properties.find(p => p.name === 'LipStiction'));
    ST().hooks.msgBox = undefined;
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
console.log(`compare_fr_b14de_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
