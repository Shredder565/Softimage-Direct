// CMD-B14b / CMD-B14c (Face Robot FR.dll: sculpt, mouth, eyes, jaw, regions): the 50 commands of
// src/commands/faceRobotB14b.ts, faceRobotB14c.ts and faceRobotB14cMaps.ts. There is no XSIBATCH golden for these rows:
// this is a contract check against docs/ghidra/cmd-b14b-fr-sculpt-mouth.md and docs/ghidra/cmd-b14c-fr-eyes-jaw-regions.md.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; AddFaceControl Position is a
//      Python ISIVector3 repr in the catalogue -> the zero vector, as the note's §4 states);
//   2. every command runs with its default arguments on the `?demo` scene plus the sample face (cube selected) without an
//      unexpected error; commands whose required input has no default must fail with a message naming the command;
//   3. the contracts' stated results (sculpt session objects and links, history records, mute renames, mirror, mouth
//      sculpt, controller registry, PPG routing, map pipeline ports, toggles, stress clamp, tongue removal, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b14bc_commands.mjs
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
  'fr_SculptBegin', 'fr_SculptEnd', 'fr_SculptEyelidBegin', 'fr_SculptEyelidEnd', 'fr_SculptPuffingBegin', 'fr_SculptPuffingEnd', 'fr_SculptTendonBegin',
  'fr_SculptTendonEnd', 'fr_SculptMouthBegin', 'fr_SculptMouthEnd', 'fr_MirrorMouthSculpt', 'fr_MirrorSculpt', 'fr_ApplySculptPose', 'fr_DeleteSculptSession',
  'fr_DeleteAllSculptSessions', 'fr_ToggleMuteSculptSession', 'fr_InspectSculptHistory', 'fr_RefreshSculptHistory', 'fr_AdjustMetaMouth', 'fr_ProxyMouth',
  'fr_VectorMouth', 'fr_ResetControllerDB', 'fr_StickLips',
  'AddFaceControl', 'MakeFaceStructure', 'fr_MakeEyeBall', 'MakeEyeRig', 'MakeEyelids', 'RegenerateEyelids', 'fr_GetEyelashMedian', 'fr_AnimateEyes',
  'fr_EyelidsDeformCurves', 'fr_EyelidsInfluenceMaps', 'fr_JawUpperDeflation', 'fr_JawLowerDeflation', 'fr_JawDeflationEaseInCurves', 'fr_JawSlidingEaseInCurves',
  'fr_JawSliding', 'fr_JawFattening', 'fr_MapRegion', 'fr_MapStress', 'fr_MapTendon', 'fr_StartRegionPaint', 'fr_ToggleShowMaps', 'fr_ToggleShowMapsUnselected',
  'fr_ApplyStress', 'fr_MakeNormalMap', 'fr_MakeRegionMasks', 'fr_AnimateRegionMasks', 'fr_RemoveTongue',
];
const DEFAULT_FAILS = new Set(['fr_SculptEnd', 'fr_SculptEyelidEnd', 'fr_SculptPuffingEnd', 'fr_SculptTendonEnd', 'fr_MirrorSculpt', 'MakeEyelids',
  'fr_GetEyelashMedian', 'fr_MapRegion', 'fr_MapStress', 'fr_MapTendon', 'fr_StartRegionPaint']);
const DEFAULT_OVERRIDES = { 'AddFaceControl.Position': [0, 0, 0] };

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
await page.waitForFunction(() => !!window.Application?.commands?.get('fr_RemoveTongue') && !!window.Application?.frB14bc && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const T = A.frB14bc; const Prop = T.Property;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const arrNear = (a, b, e = 1e-5) => !!a && a.length >= b.length && b.every((v, i) => near(Number(a[i]), v, e));
  const cube = A.scene.find('cube');
  const { model, mesh } = T.buildSampleRegions();
  const D = T.desktop(), S = T.state(), store = S.store;
  const lastStatus = () => S.rows.lastStatusB14bc;
  const reset = () => { A.select([cube]); };
  A.maxUndo = 1000;   // the default runs are undone by stack depth

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (sample face built, cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  const cl = (n) => mesh.clusters.find(c => c.name === n);
  const opOn = (c, t) => mesh.primitive.operators.find(o => o.cluster === c && o.type === t);
  const diffuse = () => Array.from(mesh.material.surface.val('diffuse')).slice(0, 3);
  const keysOf = (c) => c.properties.filter(p => p.type === 'shapekey').map(p => p.name);

  // ================= B14b: sculpt sessions
  {
    const fs0 = model.properties.find(p => p.name === 'FaceState'); fs0.add({ name: 'DNA', type: 'string', value: 'Symmetric' });
    const jaw = A.run('GetPrim', { PresetObj: 'Null', Name: 'JawEnd_Control' }); model.addChild(jaw);
    A.userPrefs = { ...(A.userPrefs ?? {}), '3D_TRANSFO_REFERENTIAL_CHANGED': 0 };
    const d0 = diffuse(); const cm0 = T.construction.mode;
    let r = run('fr_SculptBegin', { Face: mesh });
    const sc = mesh.children.find(c => c.name === 'ActiveSculpt');
    const rd = mesh.properties.find(p => p.name === 'SculptLinkReader');
    ok('fr_SculptBegin: returns true, ActiveSculpt mesh under the face, registry key ActiveSculpt', r.v === true && !!sc && store.raw('_', 'ActiveSculpt') === sc, [r.err, r.v, r.log]);
    ok('fr_SculptBegin: SculptLinkReader Mode / SymButtonOldState / CustomLinkOut1', rd && rd.params.map(p => p.name).join() === 'Mode,SymButtonOldState,CustomLinkOut1' && rd.val('Mode') === 0 && rd.val('SymButtonOldState') === 0, rd?.params.map(p => p.name));
    ok('fr_SculptBegin: SculptLinkConnection.CustomLinkIn on ActiveSculpt, CustomLink chain back to it', sc?.properties.some(p => p.name === 'SculptLinkConnection' && p.get('CustomLinkIn')) && rd?.get('CustomLinkOut1').source?.ports.MainGroup.inLink.owner.parent === sc);
    const sym = sc?.clusters.find(c => c.name === 'SymmetryMapCls');
    const symOp = sc?.primitive.operators.find(o => o.type === 'SymmetryMap');
    ok('fr_SculptBegin: symmetric session (L/R pairs + ChinForm_Region1) -> SymmetryMapCls, Symmetry Map, SymmetryMap axis 0 tolerance 0.2', !!sym && sym.properties.some(p => p.name === 'Symmetry Map') && symOp?.val('axis') === 0 && near(symOp?.val('tolerance'), 0.2));
    ok('fr_SculptBegin: DNA "Symmetric" sets bit 0x800 of 3D_TRANSFO_REFERENTIAL_CHANGED', (A.userPrefs['3D_TRANSFO_REFERENTIAL_CHANGED'] & 0x800) === 0x800, A.userPrefs);
    ok('fr_SculptBegin: construction mode secondary shape', T.construction.mode === 'secondaryshape');
    const lam = sc?.material?.surface;
    ok('fr_SculptBegin: local Lambert on ActiveSculpt with the face diffuse', lam && /Lambert/.test(lam.name) && arrNear(Array.from(lam.val('diffuse')), d0), lam?.val('diffuse'));
    ok('fr_SculptBegin: face diffuse lightness * 0.2', (() => { const [r1, g1, b1] = d0; const l0 = (Math.max(r1, g1, b1) + Math.min(r1, g1, b1)) / 2; const d1 = diffuse(); const l1 = (Math.max(...d1) + Math.min(...d1)) / 2; return near(l1, l0 * 0.2, 1e-4); })(), [d0, diffuse()]);
    ok('fr_SculptBegin: progress caption pbar_init_sculpt', S.progress.includes('pbar_init_sculpt'));
    r = run('fr_SculptBegin', { Face: mesh });
    ok('fr_SculptBegin: second begin -> false, "<face> has already a sculpt activated!"', r.v === false && has(r, /FaceMesh has already a sculpt activated!/), r);
    r = run('fr_SculptPuffingEnd', { Face: mesh, Apply: true });
    ok('fr_SculptPuffingEnd on a Skin session -> 0x8000FFFF', status(r, '8000ffff'), r);
    // sculpt: move point 13 (x = 1, inside LBrow_Region1)
    const g = sc.primitive.operators[0].data; g.positions[13 * 3 + 2] += 0.5; sc.primitive.dirty = true;
    r = run('fr_SculptEnd', { Face: 'FaceMesh', Apply: true });
    const keys = keysOf(cl('LBrow_Region1'));
    const udb = mesh.properties.find(p => p.name === 'SculptHistoryUDB');
    ok('fr_SculptEnd: returns true; reader, ActiveSculpt and the registry key removed', r.v === true && !mesh.properties.some(p => p.name === 'SculptLinkReader') && !mesh.children.some(c => c.name === 'ActiveSculpt') && store.raw('_', 'ActiveSculpt') === undefined, [r.err, r.log]);
    ok('fr_SculptEnd: face shading restored from the Lambert', arrNear(diffuse(), d0, 1e-4), [diffuse(), d0]);
    ok('fr_SculptEnd: bit 0x800 restored to cleared', (A.userPrefs['3D_TRANSFO_REFERENTIAL_CHANGED'] & 0x800) === 0);
    ok('fr_SculptEnd: Apply bakes a Sculpt<P> shape key on the changed region cluster only', keys.length === 1 && /^SculptP/.test(keys[0]) && keysOf(cl('RBrow_Region1')).length === 0, keys);
    ok('fr_SculptEnd: history record (label Skin, unmuted, pose saved)', udb?.records?.length === 1 && udb.records[0].label === 'Skin' && udb.records[0].mute === false && udb.records[0].pose.includes('JawEnd_Control'), udb?.records);
    ok('fr_SculptEnd: unread solver / Q1 / Q7 branches log "not yet attested"', nya(r));
    ok('fr_SculptEnd: selects the face', A.selection[0] === mesh);
    r = run('fr_SculptEnd', { Face: mesh, Apply: true });
    ok('fr_SculptEnd: no session -> "<face> is not in sculpt mode.", E_FAIL', status(r, '80004005') && has(r, /^FaceMesh is not in sculpt mode\.$/), r);
    // asymmetric session, cancelled
    opOn(cl('RBrow_Region1'), 'fro_RegionOp').set('Strength', 0);
    r = run('fr_SculptBegin', { Face: mesh });
    const sc2 = mesh.children.find(c => c.name === 'ActiveSculpt');
    ok('fr_SculptBegin: L without R -> no symmetry map', r.v === true && !sc2?.clusters.some(c => c.name === 'SymmetryMapCls'));
    r = run('fr_SculptEnd', { Face: mesh, Apply: false });
    ok('fr_SculptEnd Apply false: cancels (no new key, no new record)', r.v === true && keysOf(cl('LBrow_Region1')).length === 1 && udb.records.length === 1 && !mesh.children.some(c => c.name === 'ActiveSculpt'));
    for (const n of ['LBrow_Region1', 'ChinForm_Region1']) opOn(cl(n), 'fro_RegionOp').set('Strength', 0);
    r = run('fr_SculptBegin', { Face: mesh });
    ok('fr_SculptBegin: nothing significant -> false + message', r.v === false && has(r, /^FaceMesh has no significant deformations to start sculpting!$/), r);
    for (const n of ['LBrow_Region1', 'RBrow_Region1', 'ChinForm_Region1']) opOn(cl(n), 'fro_RegionOp').set('Strength', 1);
    // eyelid kind with the registry fallback, undo
    r = run('fr_SculptEyelidBegin', {});
    const rd3 = mesh.properties.find(p => p.name === 'SculptLinkReader');
    ok('fr_SculptEyelidBegin: invalid Face -> meshes/Mesh; Mode 3', r.v === true && rd3?.val('Mode') === 3);
    A.undo();
    ok('fr_SculptEyelidBegin: undo removes the session and restores the shading / construction mode', !mesh.properties.some(p => p.name === 'SculptLinkReader') && !mesh.children.some(c => c.name === 'ActiveSculpt') && store.raw('_', 'ActiveSculpt') === undefined && arrNear(diffuse(), d0, 1e-4) && T.construction.mode === 'secondaryshape');
    T.construction.mode = cm0;
    // tendon session -> second record
    r = run('fr_SculptTendonBegin', { Face: mesh });
    const sc3 = mesh.children.find(c => c.name === 'ActiveSculpt'); const g3 = sc3.primitive.operators[0].data; g3.positions[3 * 3 + 1] += 0.25; sc3.primitive.dirty = true;
    r = run('fr_SculptTendonEnd', { Face: mesh, Apply: true });
    ok('fr_SculptTendon*: second record labelled Tendon, key on LNeck_Tendon', udb.records.length === 2 && udb.records[1].label === 'Tendon' && keysOf(cl('LNeck_Tendon')).length === 1, [udb.records.length, r.err]);

    // ================= history
    r = run('fr_InspectSculptHistory');
    const hp = mesh.properties.find(p => p.name === 'SculptHistory');
    ok('fr_InspectSculptHistory: SculptHistory property added, Property Panel view SculptHistory targets it (height 400)', !!hp && D.views.get('SculptHistory')?.attrs.targetcontent === hp.fullName && D.views.get('SculptHistory').attrs.height === 400 && hp.sessions?.length === 2);
    const up0 = hp.val('Update');
    run('fr_RefreshSculptHistory', { init: true });
    ok('fr_RefreshSculptHistory: rebuilds and rewrites Update', hp.val('Update') !== up0 && hp.init === true);
    r = run('fr_ToggleMuteSculptSession', { SessionID: 0, Prop: hp, MuteFlag: true });
    ok('fr_ToggleMuteSculptSession: character 6 -> p, record muted, Update rewritten', /^Sculptp/.test(keysOf(cl('LBrow_Region1'))[0]) && udb.records[0].mute === true && hp.sessions[0].mute === true, [keysOf(cl('LBrow_Region1')), r.err]);
    run('fr_ToggleMuteSculptSession', { SessionID: 0, Prop: hp, MuteFlag: false });
    ok('fr_ToggleMuteSculptSession: unmute -> P', /^SculptP/.test(keysOf(cl('LBrow_Region1'))[0]) && udb.records[0].mute === false);
    r = run('fr_ToggleMuteSculptSession', { SessionID: 7, Prop: hp, MuteFlag: true });
    ok('fr_ToggleMuteSculptSession: bad index -> E_INVALIDARG', status(r, '80070057'), r);
    jaw.kinematics.local.set('posx', 5);
    r = run('fr_ApplySculptPose', { SessionID: 0 });
    ok('fr_ApplySculptPose: loads the saved pose (control back to 0)', !r.err && near(jaw.kinematics.local.val('posx'), 0), [r.err, jaw.kinematics.local.val('posx')]);
    r = run('fr_ApplySculptPose', { SessionID: 9 });
    ok('fr_ApplySculptPose: bad index -> E_INVALIDARG', status(r, '80070057'), r);
    udb.records[1].pose = ''; const nb = S.boxes.length;
    r = run('fr_ApplySculptPose', { SessionID: 1 });
    ok('fr_ApplySculptPose: empty pose -> box, status 1', S.boxes.length === nb + 1 && S.boxes.at(-1).text === 'This sculpt session has no pose data available... sorry.' && S.boxes.at(-1).flags === 0x30 && lastStatus().status === 1);
    r = run('fr_DeleteSculptSession', { SessionID: 1, Prop: hp });
    ok('fr_DeleteSculptSession: keys of the record deleted, record removed, PPG rebuilt', udb.records.length === 1 && keysOf(cl('LNeck_Tendon')).length === 0 && hp.sessions.length === 1, r.err);
    r = run('fr_DeleteAllSculptSessions', { Prop: hp });
    ok('fr_DeleteAllSculptSessions: every Sculpt* key on operator clusters deleted, SculptHistoryUDB deleted', keysOf(cl('LBrow_Region1')).length === 0 && !mesh.properties.some(p => p.name === 'SculptHistoryUDB') && hp.sessions.length === 0, r.err);
    r = run('fr_ApplySculptPose', { SessionID: 0 });
    ok('fr_ApplySculptPose: no SculptHistoryUDB -> success, no effect', !r.err);

    // ================= mirror sculpt
    run('fr_SculptBegin', { Face: mesh });
    r = run('fr_MirrorSculpt', { direction: 0, face: mesh, type: 0 });
    ok('fr_MirrorSculpt: active sculpt -> "Please finish the current sculpt on <full name>", status 1', has(r, /^Please finish the current sculpt on .*FaceMesh$/) && lastStatus().status === 1, r);
    run('fr_SculptEnd', { Face: mesh, Apply: false });
    opOn(cl('LBrow_Region1'), 'fro_RegionOp').set('Bulge', 0.9);
    r = run('fr_MirrorSculpt', { direction: 0, face: mesh, type: 0 });
    const deformer = mesh.primitive.operators.find(o => o.type === 'fro_FacialSoftTissueOp');
    ok('fr_MirrorSculpt: L -> R parameters, deformer unmuted after', !r.err && near(opOn(cl('RBrow_Region1'), 'fro_RegionOp').val('Bulge'), 0.9) && deformer.muted === false, r);
    opOn(cl('RBrow_Region1'), 'fro_RegionOp').set('Bulge', 0.1);
    run('fr_MirrorSculpt', { direction: 1, face: mesh, type: 0 });
    ok('fr_MirrorSculpt: direction 1 -> R to L', near(opOn(cl('LBrow_Region1'), 'fro_RegionOp').val('Bulge'), 0.1));
    r = run('fr_MirrorSculpt', { direction: 0, face: cube, type: 0 });
    ok('fr_MirrorSculpt: no face deformer -> 0x8000FFFF', status(r, '8000ffff'), r);

    // ================= mouth sculpt
    r = run('fr_MirrorMouthSculpt', { mode: 0, mesh });
    ok('fr_MirrorMouthSculpt: no mouth sculpt -> message', has(r, /^Mirror mouth sculpt requires an active mouth sculpt\.$/), r);
    run('fr_SculptMouthBegin', { mesh });
    ok('fr_SculptMouthBegin: no mouth blob -> nothing', !model.children.some(c => c.name === 'SculptMouth'));
    r = run('fr_AdjustMetaMouth');
    ok('fr_AdjustMetaMouth: no solved mouth -> message', has(r, /^Select a model with a solved mouth\.$/));
    const blob = new Prop(T.MOUTH_BLOB, 'UserDataBlob', []); blob.mouth = { vertices: [13], scale: 1 }; mesh.addProperty(blob);
    const mir = new Prop(T.MIRROR_BLOB, 'UserDataBlob', []); mir.pairs = [[13, 11]]; mesh.addProperty(mir);
    r = run('fr_SculptMouthBegin', { mesh });
    const sm = model.children.find(c => c.name === 'SculptMouth');
    ok('fr_SculptMouthBegin: clone SculptMouth under the model, mouth data marked as sculpted', !!sm && blob.sculpting === true, r);
    run('fr_SculptMouthBegin', { mesh: 'FaceMesh' });
    ok('fr_SculptMouthBegin: existing mouth sculpt -> SelectObj it', A.selection[0] === sm && model.children.filter(c => c.name === 'SculptMouth').length === 1);
    r = run('fr_SculptBegin', { Face: mesh });
    ok('fr_SculptBegin: mouth sculpt active -> "<face> has already a mouth sculpt activated!"', r.v === false && has(r, /^FaceMesh has already a mouth sculpt activated!$/), r);
    const pm = sm.primitive.operators[0].data.positions; const rest = mesh.primitive.mesh().positions;
    pm[13 * 3] += 0.1; pm[13 * 3 + 1] += 0.2; sm.primitive.dirty = true;
    r = run('fr_MirrorMouthSculpt', { mode: 0, mesh });
    const pm2 = sm.primitive.mesh().positions;
    ok('fr_MirrorMouthSculpt: partner = X-mirrored offset, SelectGeometryComponents + Translate, DeselectAll', near(pm2[11 * 3], rest[11 * 3] - 0.1) && near(pm2[11 * 3 + 1], rest[11 * 3 + 1] + 0.2) && has(r, /SelectGeometryComponents\(".*SculptMouth\.pnt\[11\]"\)/) && A.selection.length === 0, [pm2[33], rest[33], r.log]);
    r = run('fr_AdjustMetaMouth');
    ok('fr_AdjustMetaMouth: Property Panel view MouthAdjust targeting MouthAdjustProperties', /MouthAdjustProperties$/.test(D.views.get('MouthAdjust')?.attrs.targetcontent ?? ''));
    r = run('fr_SculptMouthEnd', { mesh, cancel: false });
    ok('fr_SculptMouthEnd: SculptMouth deleted, mesh selected', !model.children.some(c => c.name === 'SculptMouth') && A.selection[0] === mesh, r.err);
    mesh.addProperty(new Prop('SculptLinkReader', 'customparamset', []));
    r = run('fr_SculptMouthBegin', { mesh });
    ok('fr_SculptMouthBegin: active sculpt -> message, status 1', has(r, /^FaceMesh has already a sculpt activated!$/) && lastStatus().status === 1 && !model.children.some(c => c.name === 'SculptMouth'), r);
    mesh.removeProperty(mesh.properties.find(p => p.name === 'SculptLinkReader'));

    // ================= proxy / vector mouth, controller DB, stick lips
    r = run('fr_ProxyMouth', { mode: 0 });
    ok('fr_ProxyMouth: returns true, ExtractedMouth duplicate, progress pbar_init_mouth_proxy', r.v === true && !!A.scene.find('ExtractedMouth') && S.progress.includes('pbar_init_mouth_proxy') && nya(r), r);
    r = run('fr_VectorMouth', { mode: 1 });
    ok('fr_VectorMouth: not yet attested worker', !r.err && nya(r));
    r = run('fr_ResetControllerDB');
    ok('fr_ResetControllerDB: re-registers the controllers found under FaceModel in "controls"', store.raw('controls', 'JawEnd_Control') === jaw && S.rows.resetControllerDB.join() === 'JawEnd_Control' && nya(r));
    r = run('fr_StickLips');
    ok('fr_StickLips: no LipStiction -> message', has(r, /^To enable Stiction in this Scene, the Mouth has to be Regenerated$/));
    const ls = new Prop('LipStiction', 'customparamset', []); mesh.addProperty(ls);
    run('fr_StickLips');
    ok('fr_StickLips: InspectObj(LipStiction, "", "", 3, false)', D.inspected.at(-1).target === ls.fullName && D.inspected.at(-1).mode === 3);
  }

  // ================= B14c: controls, structure, eyes
  {
    let r = run('AddFaceControl', { Position: [1, 2, 3], Scale: 2, Color: 5, Nom: 'TestCtl', Model: 'Face', bHasOffsetParent: true, Keywords: 'Lip' });
    const c = r.v; const off = c?.parentObj;
    const gp = c ? (() => { const e = c.globalMatrix().elements; return [e[12], e[13], e[14]]; })() : null;
    ok('AddFaceControl: returns the control null under the offset parent under the model', c?.name === 'TestCtl' && off?.name === 'TestCtl_Parent' && off.parentObj === model, r);
    ok('AddFaceControl: global position, size Scale (offset Scale*0.2, display 0x232), colour', arrNear(gp, [1, 2, 3]) && c.nullSize === 2 && near(off.nullSize, 0.4) && off.displayValue === 0x232 && c.wireColor === 5);
    ok('AddFaceControl: groups Controls / ControlParents, keywords "Control,Lip", FaceControl', A.scene.groupList.find(g => g.name === 'Controls')?.members.includes(c) && A.scene.groupList.find(g => g.name === 'ControlParents')?.members.includes(off) && c.userKeywords === 'Control,Lip' && c.properties.some(p => p.name === 'FaceControl'));
    r = run('AddFaceControl', { Nom: 'Plain', Model: mesh });
    ok('AddFaceControl: Model not a model -> its owning model; no offset parent', r.v?.parentObj === model && r.v.name === 'Plain');
    r = run('MakeFaceStructure', { FaceMame: 'ignored' });
    const afr = A.scene.root.properties.find(p => p.name === 'ActiveFaceRobot');
    ok('MakeFaceStructure: invalid Model ref returned; ActiveFaceRobot.FaceModel = model full name; registry FaceModel / psets / meshnames', !r.v && afr.val('FaceModel') === model.fullName && store.raw('_', 'FaceModel') === model && store.raw('psets', 'ActiveFaceRobot') === afr && store.raw('_', 'meshnames')?.length === 6 && nya(r), [r.err, afr?.val('FaceModel')]);
    r = run('fr_MakeEyeBall', { inParent: model, inScale: 1, inVector: [1, 0.5, 0] });
    const eb = r.v; const ep = eb?.properties.find(p => p.name === 'EyeballProperties');
    ok('fr_MakeEyeBall: returns the eyeball (Cornea) under inParent at inVector', eb?.name === 'Cornea' && eb.parentObj === model && arrNear(Array.from(eb.globalMatrix().elements).slice(12, 15), [1, 0.5, 0]), r.err);
    ok('fr_MakeEyeBall: EyeballProperties (16 parameters, §2.3 defaults)', ep?.params.length === 16 && ep.val('SynopticPath') === 'TitlebarSynoptic' && near(ep.val('Scale'), 0.2) && ep.val('Sections') === 48 && ep.val('Sclera') === 24 && ep.val('CorneaDetail') === 10 && near(ep.val('Bulge'), -0.15) && ep.val('innerIris') === true && JSON.parse(ep.val('CornealBulgeFC')).keys.length === 2);
    ok('fr_MakeEyeBall: fro_CorneaOp / fro_IrisOp ports PrimOut PrimIn PropIn, CorneaPhong, Iris', eb?.primitive.operators.some(o => o.type === 'fro_CorneaOp' && o.ports.Main.PropIn === ep) && eb.material?.name === 'CorneaPhong' && eb.children.some(i => i.name === 'Iris' && i.primitive.operators.some(o => o.type === 'fro_IrisOp')));
    r = run('MakeEyeRig', { inEyes: [] });
    ok('MakeEyeRig: no eyes -> message, empty array', Array.isArray(r.v) && r.v.length === 0 && has(r, /^No Eye Ball inputs, Eyelook not created;$/));
    const e1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'EyeA' }); e1.kinematics.local.set('posx', 1);
    const e2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'EyeB' }); e2.kinematics.local.set('posx', -1);
    r = run('MakeEyeRig', { inEyes: [e1, e2] });
    ok('MakeEyeRig: [root, LookAt_Control, LEye_Control, REye_Control], registered in controls', r.v?.length === 4 && r.v[1].name === 'LookAt_Control' && r.v[2].name === 'LEye_Control' && r.v[3].name === 'REye_Control' && store.raw('controls', 'LEye_Control') === r.v[2] && store.raw('controls', 'LookAt_Control') === r.v[1], [r.err, r.v?.map(x => x.name)]);
    e2.kinematics.local.set('posx', 2);
    r = run('MakeEyeRig', { inEyes: [e1, e2] });
    ok('MakeEyeRig: both eyes at X > 0 -> LEye_Control, LEye_Control0', r.v?.[2].name === 'LEye_Control' && r.v[3].name === 'LEye_Control0', r.v?.map(x => x.name));
    A.select([cube]);
    r = run('MakeEyelids');
    ok('MakeEyelids: one selected mesh -> HELP [1], 0x80020003', status(r, '80020003') && r.log.some(l => l.includes('MakeEyelids HELP: [1]')), r);
    A.select([]);
    r = run('MakeEyelids');
    ok('MakeEyelids: nothing -> HELP [0]', status(r, '80020003') && r.log.some(l => l.includes('MakeEyelids HELP: [0]')));
    A.select([cube, mesh]);
    r = run('MakeEyelids');
    ok('MakeEyelids: two meshes, no curves -> HELP [2]', status(r, '80020003') && r.log.some(l => l.includes('MakeEyelids HELP: [2]')));
    r = run('RegenerateEyelids');
    ok('RegenerateEyelids: progress caption, per-side "Eye not found", empty array', S.progress.includes('Regenerating Eyelids ') && r.log.filter(l => l === 'Eye not found').length === 2 && Array.isArray(r.v) && r.v.length === 0, r.log);
    r = run('fr_GetEyelashMedian', { Mesh: mesh, b_ChooseFront: false });
    const P = mesh.primitive.mesh().positions;
    ok('fr_GetEyelashMedian: points of the first cluster, X closest to the box centre', arrNear(r.v, [P[9], P[10], P[11]]), [r.v, P[9], P[10], P[11]]);
    r = run('fr_GetEyelashMedian', { Mesh: mesh, b_ChooseFront: true });
    ok('fr_GetEyelashMedian: b_ChooseFront -> points not in the cluster', arrNear(r.v, [P[6], P[7], P[8]]), r.v);
    r = run('fr_GetEyelashMedian', { Mesh: model });
    ok('fr_GetEyelashMedian: no geometry -> E_FAIL', status(r, '80004005'));
  }

  // ================= B14c: PPG routing
  {
    const bl = model.properties.find(p => p.name === 'BlinkProperties'), ey = model.properties.find(p => p.name === 'EyeProperties');
    run('fr_AnimateEyes');
    ok('fr_AnimateEyes: InspectObj(BlinkProperties, mode 1)', D.inspected.at(-1).target === bl.fullName && D.inspected.at(-1).mode === 1);
    run('fr_EyelidsDeformCurves');
    ok('fr_EyelidsDeformCurves: no stage6ppg -> InspectObj(EyeProperties, 1)', D.inspected.at(-1).target === ey.fullName && D.inspected.at(-1).command === 'fr_EyelidsDeformCurves');
    const JAW = { fr_JawDeflationEaseInCurves: '.JawEnd_Control.Deflation_Ease_In', fr_JawSlidingEaseInCurves: '.JawEnd_Control.Sliding_Ease_In', fr_JawFattening: '.BelowJawCurve_Trace.Fattening', fr_JawSliding: '.JawSurface.Sliding', fr_JawUpperDeflation: '.UpperJawCurve_TissueCurve.Upper_Jaw_Deflation', fr_JawLowerDeflation: '.LowerJawCurve_TissueCurve.Lower_Jaw_Deflation' };
    for (const [n, s] of Object.entries(JAW)) { run(n, { face: 'Face' }); ok(`${n}: InspectObj("Face${s}", mode 1) without stage6ppg`, D.inspected.at(-1).target === 'Face' + s && D.inspected.at(-1).mode === 1); }
    D.layout = 'Face Robot'; D.views.set('stage6ppg', { type: 'Property Panel', attrs: {} });
    const n0 = D.inspected.length;
    run('fr_EyelidsInfluenceMaps');
    ok('fr_EyelidsInfluenceMaps: Face Robot layout -> stage6ppg.targetcontent = BlinkProperties', D.views.get('stage6ppg').attrs.targetcontent === bl.fullName && D.inspected.length === n0);
    for (const [n, s] of Object.entries(JAW)) { run(n, { face: 'Face' }); ok(`${n}: stage6ppg.targetcontent = Face${s}`, D.views.get('stage6ppg').attrs.targetcontent === 'Face' + s); }
    run('fr_AnimateEyes');
    ok('fr_AnimateEyes: always InspectObj (no stage6ppg routing)', D.inspected.at(-1).target === bl.fullName && D.inspected.length === n0 + 1);
    D.layout = 'Default';
  }

  // ================= B14c: maps, paint, toggles, stress, masks, tongue
  {
    let r = run('fr_MapRegion', { inFace: mesh });
    const rm = mesh.properties.find(p => p.name === 'RegionMap');
    const wc = mesh.clusters.find(c => c.name === 'WeightMapCls'); const wm = wc?.properties.find(p => p.name === 'RegionMap');
    const mop = mesh.primitive.operators.find(o => o.type === 'fro_MapRegionStressTendonOp' && o.val('Mode') === 0);
    ok('fr_MapRegion: RegionMap property, one double per region prefix (default 1, 0..200)', rm?.params.map(p => p.name).join() === 'LBrow_,RBrow_,ChinForm_' && rm.params.every(p => p.value === 1 && p.def.max === 200 && p.def.uimax === 5), [r.err, rm?.params.map(p => p.name)]);
    ok('fr_MapRegion: weight map RegionMap on WeightMapCls, colour 0/50/255', wm?.type === 'weightmap' && wm.val('red') === 0 && wm.val('green') === 50 && wm.val('blue') === 255);
    ok('fr_MapRegion: fro_MapRegionStressTendonOp ports (ioWeightMap, inUI, inWrinkleMap, per-cluster 0Cluster..2Curve)', mop?.ports.MainGroup.ioWeightMap === wm && mop.ports.InputGroup.inUI === rm && mop.ports.InputGroup.inWrinkleMap === 'WrinkleMap' && !('inMultiplier' in mop.ports.InputGroup) && mop.ports.InputGroupPerCluster['2Cluster'] === mesh.clusters.find(c => c.name === 'ChinForm_Region1') && mop.ports.InputGroupPerCluster['0Curve'] === 'LBrow_Region1_Curve' && '1BaseMultiplier' in mop.ports.InputGroupPerCluster);
    ok('fr_MapRegion: selects the map, camvis objctrlpropmaps on', A.selection[0] === wm && D.camvis.get('Views.ViewB.*.camvis.objctrlpropmaps') === true);
    const nOps = mesh.primitive.operators.length;
    run('fr_MapRegion', { inFace: mesh });
    ok('fr_MapRegion: existing map -> straight to step 7', mesh.primitive.operators.length === nOps && mesh.properties.filter(p => p.name === 'RegionMap').length === 1);
    run('fr_MapStress', { inFace: mesh });
    const sm = wc.properties.find(p => p.name === 'StressMap');
    ok('fr_MapStress: StressMap, colour 255/255/255, Mode 1', sm?.val('red') === 255 && sm.val('green') === 255 && mesh.primitive.operators.some(o => o.type === 'fro_MapRegionStressTendonOp' && o.val('Mode') === 1));
    run('fr_MapTendon', { inFace: mesh });
    const tm = mesh.properties.find(p => p.name === 'TendonStressMap');
    const top = mesh.primitive.operators.find(o => o.type === 'fro_MapRegionStressTendonOp' && o.val('Mode') === 2);
    ok('fr_MapTendon: TendonStressMap prefixes, inBase, <i>Control', tm?.params.map(p => p.name).join() === 'LNeck_,RNeck_' && top?.ports.InputGroup.inBase === 'BaseState' && top.ports.InputGroupPerCluster['0Control'] === 'LNeck_Tendon_Control');
    r = run('fr_StartRegionPaint', { inMesh: mesh, inRegionName: 'lbrow' });
    ok('fr_StartRegionPaint: ActivateObjectSelTool(0), Perc then mesh selected, paint tool', !r.err && A.selection[0] === mesh && D.selToolValue === 0 && D.tool === 'BrushTool', r);
    r = run('fr_StartRegionPaint', { inMesh: mesh, inRegionName: 'Nope' });
    ok('fr_StartRegionPaint: no matching cluster -> E_FAIL', status(r, '80004005'));
    run('fr_ToggleShowMaps');
    ok('fr_ToggleShowMaps: Views.ViewB.User.camvis.attrselpropertymaps negated', D.camvis.get('Views.ViewB.User.camvis.attrselpropertymaps') === true);
    run('fr_ToggleShowMaps');
    ok('fr_ToggleShowMaps: twice -> back', D.camvis.get('Views.ViewB.User.camvis.attrselpropertymaps') === false);
    D.views.get('frmviewmanager').attrs['activecamera:b'] = 'Camera1';
    run('fr_ToggleShowMapsUnselected');
    ok('fr_ToggleShowMapsUnselected: other camera used as-is, attrunselpropertymaps', D.camvis.get('Camera1.camvis.attrunselpropertymaps') === true);
    D.views.get('frmviewmanager').attrs['activecamera:b'] = '';
    run('fr_ToggleShowMaps');
    ok('fr_ToggleShowMaps: empty camera -> status 1', lastStatus().status === 1 && lastStatus().command === 'fr_ToggleShowMaps');
    const vm = D.views.get('frmviewmanager'); D.views.delete('frmviewmanager');
    r = run('fr_ToggleShowMaps');
    ok('fr_ToggleShowMaps: no frmviewmanager -> E_FAIL', status(r, '80004005'));
    vm.attrs['activecamera:b'] = 'User'; D.views.set('frmviewmanager', vm);
    const frp = mesh.clusters.find(c => c.name === 'LBrow_Region1').properties.find(p => p.name === 'FaceRegionProperties'); frp.set('Strength', 1.5);
    r = run('fr_ApplyStress', { StressMesh: mesh, OutPutMesh: false });
    ok('fr_ApplyStress OutPutMesh false: Strength clamped to 1, "Evaluating Op" logged', near(frp.val('Strength'), 1) && has(r, /^Evaluating Op /), r);
    frp.set('Strength', 1.5);
    r = run('fr_ApplyStress', { StressMesh: mesh });
    ok('fr_ApplyStress OutPutMesh true: StressMesh registered, Strength restored', near(frp.val('Strength'), 1.5) && store.raw('_', 'StressMesh') === mesh, r.err);
    r = run('fr_MakeNormalMap');
    ok('fr_MakeNormalMap: no export mesh -> "FR Game Export mesh not found"', has(r, /^FR Game Export mesh not found$/));
    const game = new Prop('GameProp', 'customparamset', [{ name: 'Generate_Rest', type: 'bool', value: false }, { name: 'Masks', type: 'int', value: 3 }]); cube.addProperty(game);
    r = run('fr_MakeNormalMap', { xExportMesh: cube, gameProp: game });
    ok('fr_MakeNormalMap: no Generate option -> message', has(r, /^Check At least one of the Generation Options$/));
    game.set('Generate_Rest', true);
    r = run('fr_MakeNormalMap', { xExportMesh: cube, gameProp: game });
    ok('fr_MakeNormalMap: worker not yet attested', !r.err && nya(r));
    r = run('fr_MakeRegionMasks', { xLowResMesh: cube, gameProp: game });
    const rmk = cube.properties.find(p => p.name === 'RegionMasks');
    ok('fr_MakeRegionMasks: RegionMasks property (9 region parameters), array returned', Array.isArray(r.v) && rmk?.params.length === 9 && rmk.params[0].name === 'ForeHead_R0' && rmk.params[8].name === 'Chin_B2');
    r = run('fr_AnimateRegionMasks', { xExportMesh: cube, gameProp: game, Start: 1, End: 10 });
    ok('fr_AnimateRegionMasks: progress caption, 9 plots for Masks 3', S.progress.includes('Plotting Masks Animation') && r.log.filter(l => /per-mask plotter/.test(l)).length === 9, r.log);
    game.set('Masks', 1);
    r = run('fr_AnimateRegionMasks', { xExportMesh: cube, gameProp: game, Start: 1, End: 10 });
    ok('fr_AnimateRegionMasks: Masks 1 -> parameters 0-2 only', r.log.filter(l => /per-mask plotter/.test(l)).length === 3);
    D.hooks.cancelProgress = () => true;
    r = run('fr_AnimateRegionMasks', { xExportMesh: cube, gameProp: game, Start: 1, End: 10 });
    ok('fr_AnimateRegionMasks: cancelled -> E_FAIL', status(r, '80004005'));
    delete D.hooks.cancelProgress;
    // tongue
    const tongue = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'TongueMesh' }); model.addChild(tongue); tongue.userKeywords = 'Tongue,Mesh';
    const tip = A.run('GetPrim', { PresetObj: 'Null', Name: 'TongueTip_Control' }); model.addChild(tip);
    const tg = T.ensureGroup('Tongue'); tg.members.push(tongue);
    store.put('meshes', 'Tongue', tongue); store.put('controls', 'TongueTip_Control', tip); store.put('groups', 'Tongue', tg);
    r = run('fr_RemoveTongue', { DeleteMesh: false });
    ok('fr_RemoveTongue: returns true; control deleted and unregistered; keywords cleared; mesh under the scene root; group emptied; meshes/Tongue removed',
      r.v === true && !A.scene.find('TongueTip_Control') && store.raw('controls', 'TongueTip_Control') === undefined && tongue.userKeywords === undefined && tongue.parentObj === A.scene.root && tg.members.length === 0 && store.raw('meshes', 'Tongue') === undefined, [r.err, tongue.parentObj?.name]);
    A.undo();
    ok('fr_RemoveTongue: undo', !!A.scene.find('TongueTip_Control') && tongue.parentObj === model && tongue.userKeywords === 'Tongue,Mesh' && tg.members.length === 1 && store.raw('meshes', 'Tongue') === tongue);
    r = run('fr_RemoveTongue', { DeleteMesh: true });
    ok('fr_RemoveTongue DeleteMesh: tongue mesh deleted', r.v === true && !A.scene.find('TongueMesh'));
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
console.log(`compare_fr_b14bc_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
