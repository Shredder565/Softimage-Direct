// CMD-B18a (Face Robot GeneralHelper.js script commands): the 36 commands of src/commands/faceRobotB18a.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b18a-fr-generalhelper-scripts.md
// and docs/re/WIRE_CORRECTIONS_B18.md items 1, 5, 6, 7, 11.
//   1. every name is registered with the catalogue argument list (data/commands_full.json: no defaults), category Custom;
//   2. every command runs with its default arguments on the ?demo scene (cube selected, sample face built) without an
//      unexpected error (commands whose required input is null by default must fail with a message naming the command);
//   3. the contract's stated results, a few value checks per command.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b18a_commands.mjs
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
  'fr_FolderExists', 'fr_GetCentroid', 'fr_GetFile', 'fr_GetResolvedDNAPath', 'fr_GetGlobalPos', 'fr_SetOffsetMap', 'fr_SetOffsetMap2',
  'fr_IsCollection', 'fr_ToCollection', 'fr_KeyAllControls', 'fr_KeySelControls', 'fr_ResetPaths', 'fr_SelectAllControls', 'fr_GetControls',
  'fr_ObjectView', 'fr_ResetSel', 'fr_ResetAll', 'fr_PoseAll', 'fr_PoseSel', 'fr_SetPickPoints', 'fr_GetPickPoints', 'fr_StoreEnvelope',
  'fr_RestoreEnvelope', 'fr_GetPointsAsText', 'fr_StorePP', 'fr_RestorePP', 'fr_ApplyType', 'fr_ResetRetarget', 'fr_IsRetargeted',
  'CleanSources', 'EmptyBackups', 'logv', 'loga', 'logc', 'logt', 'suma',
];
// null required inputs: JScript runtime errors in the source (contract), thrown here with the command name
const DEFAULT_FAILS = new Set(['fr_GetCentroid', 'fr_SetOffsetMap', 'fr_SetOffsetMap2', 'fr_GetPickPoints', 'logv', 'loga', 'logt', 'suma']);
const NOLOG = ['fr_FolderExists', 'fr_GetCentroid', 'fr_GetFile', 'fr_GetResolvedDNAPath', 'fr_GetGlobalPos', 'fr_SetOffsetMap', 'fr_SetOffsetMap2',
  'fr_IsCollection', 'fr_ToCollection', 'fr_ResetPaths', 'fr_GetControls', 'fr_IsRetargeted', 'logv', 'loga', 'logc', 'logt', 'suma'];

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
await page.waitForFunction(() => !!window.Application?.faceRobotB18a && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF, NOLOG }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const X = A.faceRobotB14a, Y = A.faceRobotB18a, FS = A.hostFs, B = Y.state();
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const v = (n, a) => run(n, a).v;
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B18a/.test(l));
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const J = JSON.stringify;
  const called = (name) => { const c = B.calls.filter(x => x.name === name); return c; };
  const cube = A.scene.find('cube');
  const { model: face, mesh: faceMesh } = X.buildSampleFace();
  const ST = A.faceRobotB14, S = ST.store;
  const reset = () => { A.select([cube]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of NAMES) ok(`${n}: category Custom`, A.commands.get(n)?.category === 'Custom');
  ok('NoLog commands carry siNoLogging; the others are logged', NAMES.every(n => !!A.commands.get(n).noLog === NOLOG.includes(n)), NAMES.filter(n => !!A.commands.get(n).noLog !== NOLOG.includes(n)));
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  const block = (name, f) => { try { f(); } catch (e) { ok(`${name}: block threw`, false, String(e?.stack ?? e).slice(0, 400)); } reset(); };

  // ================= §2 queries
  block('queries', () => {
    FS.ensureFolder('C:\\b18a\\dir');
    ok('fr_FolderExists: existing folder -> true, missing -> false', v('fr_FolderExists', { inPath: 'C:\\b18a\\dir' }) === true && v('fr_FolderExists', { inPath: 'C:\\b18a\\nope' }) === false && v('fr_FolderExists', {}) === false);
    const root = B.env.FACEROBOTROOT;
    ok('fr_GetFile: <FACEROBOTROOT>\\Application\\<file>, "/" converted', v('fr_GetFile', { inFileName: 'views\\FR.en-us.txt' }) === root + '\\Application\\views\\FR.en-us.txt' && v('fr_GetFile', { inFileName: 'a/b.txt' }) === root + '\\Application\\a\\b.txt');
    // correction 6: B14a's localization load goes through fr_GetFile
    FS.ensureFolder(root + '\\Application\\views'); FS.writeFile(root + '\\Application\\views\\FR.en-us.txt', 'b18a_key   Hello B18a\nother x');
    ST.interactive = true; X.loadLocalization(true);
    ok('correction 6: fr_sstring reads <FACEROBOTROOT>\\Application\\views\\FR.en-us.txt', S.loc('b18a_key') === 'Hello B18a', S.loc('b18a_key'));
    S.localization.clear(); FS.deleteFile(root + '\\Application\\views\\FR.en-us.txt');
    ok('fr_GetResolvedDNAPath: no FaceState.DNA -> ""', v('fr_GetResolvedDNAPath') === '');
    const fstate = face.properties.find(p => p.name === 'FaceState');
    if (!fstate.get('DNA')) fstate.add({ name: 'DNA', type: 'string', value: '', label: 'DNA' });
    fstate.get('DNA').value = '$FACEROBOTROOT\\Data\\FaceRobot\\Dna\\Human_Face_Symmetric.dna';
    ok('fr_GetResolvedDNAPath: a leading $VAR segment is expanded', v('fr_GetResolvedDNAPath') === root + '\\Data\\FaceRobot\\Dna\\Human_Face_Symmetric.dna');
    fstate.get('DNA').value = 'D:\\x\\$FACEROBOTROOT\\y.dna';
    ok('fr_GetResolvedDNAPath: no leading $ -> unchanged', v('fr_GetResolvedDNAPath') === 'D:\\x\\$FACEROBOTROOT\\y.dna');
    fstate.get('DNA').value = '$NOSUCHVAR_B18A\\y.dna';
    ok('fr_GetResolvedDNAPath: unset variable -> "" (inferred)', v('fr_GetResolvedDNAPath') === '\\y.dna');
    // fr_ApplyType
    const dna = () => fstate.get('DNA').value;
    let r = run('fr_ApplyType', { dnaindex: 0 });
    ok('fr_ApplyType: 0 -> $FACEROBOTROOT\\Data\\FaceRobot\\Dna\\Human_Face_Symmetric.dna (literal token), returns nothing', dna() === '$FACEROBOTROOT\\Data\\FaceRobot\\Dna\\Human_Face_Symmetric.dna' && r.v === undefined && !r.err);
    ok('fr_ApplyType: then runs fr_Diagnose', called('fr_Diagnose').length > 0);
    run('fr_ApplyType', { dnaindex: 1 }); const d1 = dna(); run('fr_ApplyType', { dnaindex: 7 }); const d7 = dna(); run('fr_ApplyType', { dnaindex: 2 }); const d2 = dna();
    ok('fr_ApplyType: 1 and >2 -> asymmetric; 2 indexes past the list (undefined)', d1.endsWith('\\Human_Face_Asymmetric.dna') && d7 === d1 && d2.endsWith('\\Dna\\undefined'), [d1, d7, d2]);
    fstate.removeParam(fstate.get('DNA'));
    ok('fr_ApplyType: no DNA parameter -> nothing', !run('fr_ApplyType', { dnaindex: 1 }).err && !fstate.get('DNA'));
    // fr_GetGlobalPos
    cube.kinematics.local.get('posx').value = 1.5;
    const gp = v('fr_GetGlobalPos', { iobj: 'cube' });
    ok('fr_GetGlobalPos: name -> FindChild, Vector3 of the global translation', near(gp?.x, 1.5) && near(gp?.y, cube.globalMatrix().elements[13]));
    ok('fr_GetGlobalPos: object argument', near(v('fr_GetGlobalPos', { iobj: cube })?.x, 1.5));
    ok('fr_GetGlobalPos: empty or not found -> false (not null)', v('fr_GetGlobalPos', { iobj: '' }) === false && v('fr_GetGlobalPos', { iobj: 'noSuchB18a' }) === false && v('fr_GetGlobalPos', {}) === false);
    cube.kinematics.local.get('posx').value = 0;
    // fr_GetCentroid
    const m = faceMesh.primitive.mesh(); const n = m.positions.length / 3; let sx = 0, sz = 0;
    const M = faceMesh.globalMatrix().elements;
    for (let i = 0; i < n; i++) { sx += m.positions[i * 3] + M[12]; sz += m.positions[i * 3 + 2] + M[14]; }
    const c = v('fr_GetCentroid', { inObj: faceMesh });
    ok('fr_GetCentroid: X3DObject -> average of the world point positions', near(c?.x, sx / n) && near(c?.z, sz / n), [c, sx / n, sz / n]);
    const c2 = v('fr_GetCentroid', { inObj: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }] });
    ok('fr_GetCentroid: array of vectors -> their average', near(c2.x, 1) && near(c2.y, 2) && near(c2.z, 3));
    ok('fr_GetCentroid: empty array / collection / Null without geometry -> script error', [[], Y.collection([cube]), A.run('GetPrim', { PresetObj: 'Null', Name: 'nullB18a' })].every(x => (run('fr_GetCentroid', { inObj: x }).err ?? '').includes('fr_GetCentroid')));
    A.scene.root.removeChild(A.scene.find('nullB18a'));
  });
  block('collections', () => {
    const col = Y.collection([cube]);
    ok('fr_IsCollection: XSI.Collection (ClassName Object) -> the same object', v('fr_IsCollection', { c: col }) === col);
    const sel = Y.collection([cube], 'Selection'); const r1 = v('fr_IsCollection', { c: sel });
    ok('fr_IsCollection: Selection -> a new collection with the same items', r1 !== sel && Y.className(r1) === 'Object' && r1.length === 1 && r1[0] === cube);
    const xc = Y.collection([cube, faceMesh], 'X3DObjectCollection'); const r2 = v('fr_IsCollection', { c: xc });
    ok('fr_IsCollection: X3DObjectCollection -> a new collection', r2 !== xc && r2.length === 2);
    ok('fr_IsCollection: empty, strings, numbers, single objects, arrays -> false', ['', null, 'cube', 5, cube, [cube]].every(x => v('fr_IsCollection', { c: x }) === false));
    ok('fr_ToCollection: a collection -> itself (not the copy)', v('fr_ToCollection', { inObj: col }) === col && v('fr_ToCollection', { inObj: sel }) === sel);
    const t1 = v('fr_ToCollection', { inObj: cube });
    ok('fr_ToCollection: X3DObject -> new collection with it', t1 !== col && t1.length === 1 && t1[0] === cube);
    const g = A.faceRobotB14a.Group ? new A.faceRobotB14a.Group('grpB18a') : null; g.members.push(cube, faceMesh);
    const t2 = v('fr_ToCollection', { inObj: g });
    ok('fr_ToCollection: Group -> its members', t2.length === 2 && t2[1] === faceMesh);
    ok('fr_ToCollection: other values -> empty collection', v('fr_ToCollection', { inObj: 5 }).length === 0 && v('fr_ToCollection', {}).length === 0);
    const r = run('fr_ToCollection', { inObj: 'cube,FaceMesh' });
    ok('fr_ToCollection: string -> ArrayToCollection unattested: logged, empty collection', nya(r) && r.v.length === 0 && has(r, /ArrayToCollection/));
  });
  block('points as text', () => {
    A.selectComponents(faceMesh, 'point', [3, 1, 7]);
    ok('fr_GetPointsAsText: point selection -> <object>.pnt[...]', v('fr_GetPointsAsText', { Points: 'ignored' }) === `${faceMesh.fullName}.pnt[3,1,7]`, v('fr_GetPointsAsText'));
    A.selectComponents(faceMesh, 'polygon', [0]);
    const t = v('fr_GetPointsAsText');
    ok('fr_GetPointsAsText: polygon selection -> adjacent points (selection replaced)', /\.pnt\[[\d,]+\]$/.test(t) && A.compSel?.kind === 'point' && J([...A.compSel.points].sort((a, b) => a - b)) === J([...faceMesh.primitive.mesh().polygons[0]].sort((a, b) => a - b)), [t, A.compSel && [...A.compSel.points]]);
    A.compSel = null; A.select([cube]);
    ok('fr_GetPointsAsText: otherwise ""', v('fr_GetPointsAsText') === '' && (A.select([]), v('fr_GetPointsAsText') === ''));
    // correction 7: the B14e stand-in (used by fr_CrawlToVertex when fr_GetPointsAsText is not on the bus)
    const def = A.commands.get('fr_GetPointsAsText'); A.commands.delete('fr_GetPointsAsText');
    A.selectComponents(faceMesh, 'polygon', [0]);
    const cr = run('fr_CrawlToVertex', { Select: false });
    ok('correction 7: B14e stand-in converts a polygon selection to points', !cr.err && A.compSel?.kind === 'point' && /\.pnt\[/.test(cr.v), [cr.err, cr.v]);
    A.register(def); A.compSel = null;
  });

  // ================= §3 controls
  const ctl = (nom, pos) => { const o = A.run('AddFaceControl', { Position: pos, Nom: nom, Model: face }); S.put('controls', o.name, o); return o; };
  const brow = ctl('Brow_Control', [1, 0, 0]), lip = ctl('Lip_Control', [0, -1, 0]);
  const off = ctl('Brow_ControlOffset', [1, 0, 0]);
  const plain = A.run('GetPrim', { PresetObj: 'Null', Name: 'plainB18a' }); face.addChild(plain);
  const L = (o, p) => o.kinematics.local.val(p); const setL = (o, p, x) => { o.kinematics.local.get(p).value = x; };
  block('controls', () => {
    const all = v('fr_GetControls', { toggle: false });
    ok('fr_GetControls: the FaceRobotControl descendants of the face model', Y.className(all) === 'X3DObjectCollection' && [brow, lip, off].every(o => all.includes(o)) && !all.includes(plain) && !all.includes(faceMesh));
    A.select([brow]);
    const inv = v('fr_GetControls', { toggle: true });
    ok('fr_GetControls: toggle -> all controls except the selected ones', !inv.includes(brow) && inv.includes(lip));
    run('fr_SelectAllControls', { toggle: true });
    ok('fr_SelectAllControls: toggle inverts the control selection', !A.selection.includes(brow) && A.selection.includes(lip) && A.selection.includes(off));
    run('fr_SelectAllControls', { toggle: false });
    ok('fr_SelectAllControls: selects all controls', [brow, lip, off].every(o => A.selection.includes(o)));
    for (const o of [brow, lip, plain]) { setL(o, 'posx', 2); setL(o, 'rotz', 30); setL(o, 'sclx', 2); }
    A.select([brow, plain]);
    run('fr_ResetSel', { toggle: false });
    ok('fr_ResetSel: selected items with FaceControl -> zero local pos/rot (scaling kept); others ignored', L(brow, 'posx') === 0 && L(brow, 'rotz') === 0 && L(brow, 'sclx') === 2 && L(plain, 'posx') === 2 && L(lip, 'posx') === 2);
    setL(brow, 'posx', 2);
    run('fr_ResetSel', { toggle: true });
    ok('fr_ResetSel: toggle -> the unselected controls', L(lip, 'posx') === 0 && L(brow, 'posx') === 2);
    setL(lip, 'posx', 2); setL(off, 'posy', 3);
    const r = run('fr_ResetAll', { token: 'x' });
    ok('fr_ResetAll: every control key found by name under the face model is zeroed', !r.err && L(brow, 'posx') === 0 && L(lip, 'posx') === 0 && L(off, 'posy') === 0 && L(plain, 'posx') === 2 && L(brow, 'sclx') === 2);
    S.put('controls', 'GhostB18a', 'nothing'); ok('fr_ResetAll: missing ones skipped silently', !run('fr_ResetAll').err); S.delete('controls', 'GhostB18a');
    for (const o of [brow, lip, plain]) { setL(o, 'sclx', 1); setL(o, 'rotz', 0); } setL(plain, 'posx', 0);
  });
  block('keys', () => {
    const tag = (o, p) => { o.kinematics.local.get(p).tags = 1; };
    tag(brow, 'posx'); tag(brow, 'posy'); tag(off, 'posx'); tag(lip, 'rotz');
    A.anim.frame = 12.4;
    const keyed = (o, p) => !!A.anim.fcurve(o.kinematics.local.get(p))?.keys.some(k => k.time === 12);
    const u0 = A.undoStack.length;
    run('fr_KeyAllControls');
    ok('fr_KeyAllControls: siTag1 parameters of every control keyed at round(PlayControl.Key)', keyed(brow, 'posy') && keyed(lip, 'rotz') && keyed(off, 'posx'));
    ok('fr_KeyAllControls: <name>_ControlOffset tagged parameter excludes the same parameter of <name>_Control', !keyed(brow, 'posx'));
    ok('fr_KeyAllControls: untagged parameters are not keyed', !keyed(brow, 'posz'));
    while (A.undoStack.length > u0) A.undo();
    ok('fr_KeyAllControls: undo removes the keys', !keyed(brow, 'posy'));
    A.select([lip, plain]);
    run('fr_KeySelControls');
    ok('fr_KeySelControls: only the selected FaceControl items', keyed(lip, 'rotz') && !keyed(brow, 'posy'));
    while (A.undoStack.length > u0) A.undo();
    A.anim.frame = 1;
  });
  block('poses', () => {
    A.userPrefs = A.userPrefs ?? {}; A.userPrefs['Face Robot.Use_Mixer_Poses'] = false;
    B.calls.length = 0;
    run('fr_PoseAll');
    ok('fr_PoseAll: Use_Mixer_Poses false -> fr_SaveFacePose() with no arguments', called('fr_SaveFacePose').length === 1 && J(called('fr_SaveFacePose')[0].args) === '{}');
    A.userPrefs['Face Robot.Use_Mixer_Poses'] = true;
    let r = run('fr_PoseAll');
    const gs = called('GetInputAndStoreAction');
    ok('fr_PoseAll: Use_Mixer_Poses true -> GetInputAndStoreAction(model, names, 1, "FacePose") (LOCK: logged)', nya(r) && gs.length === 1 && gs[0].args[0] === 'Face' && gs[0].args[1].split(',').includes('Face.Brow_Control.kine.local.posy') && gs[0].args[2] === 1 && gs[0].args[3] === 'FacePose', gs);
    A.userPrefs['Face Robot.Use_Mixer_Poses'] = false;
    A.select([]); r = run('fr_PoseSel', { filename: 'C:\\b18a\\p.frpre' });
    ok('fr_PoseSel: nothing selected -> siError "no controls found to save pose"', r.log.includes('no controls found to save pose') && r.kinds[r.log.indexOf('no controls found to save pose')] === 'error');
    A.select([plain]); r = run('fr_PoseSel', { filename: 'x' });
    ok('fr_PoseSel: no control in the selection -> same error', r.log.includes('no controls found to save pose'));
    B.calls.length = 0; A.select([brow]); run('fr_PoseSel', { filename: 'C:\\b18a\\p.frpre' });
    ok('fr_PoseSel: -> fr_SaveFacePose(true, filename)', J(called('fr_SaveFacePose')[0]?.args) === J({ selectiononly: true, filename: 'C:\\b18a\\p.frpre' }));
    A.userPrefs['Face Robot.Use_Mixer_Poses'] = true; B.calls.length = 0; run('fr_PoseSel', { filename: 'ignored' });
    ok('fr_PoseSel: mixer poses -> GetInputAndStoreAction with the filtered controls\' names (filename unused)', called('GetInputAndStoreAction')[0]?.args[1] === 'Face.Brow_Control.kine.local.posx,Face.Brow_Control.kine.local.posy');
    A.userPrefs['Face Robot.Use_Mixer_Poses'] = false;
  });

  // ================= §4 retargeting
  block('retarget', () => {
    const Op = A.faceRobotB14a.Operator;
    const op = new Op('RetargetB18a', 'fro_FaceRetargetOp2', [{ name: 'mute', type: 'bool', value: false, label: 'Mute' }]);
    const other = new Op('OtherB18a', 'fro_FaceRetargetLocalOp', [{ name: 'mute', type: 'bool', value: false, label: 'Mute' }]);
    brow.kinematics.local.nestedObjects = [other, op];
    ok('fr_IsRetargeted: control with a retarget operator -> true', v('fr_IsRetargeted', { control: brow }) === true);
    ok('fr_IsRetargeted: control without (nor its parent) -> false', v('fr_IsRetargeted', { control: lip }) === false);
    ok('fr_IsRetargeted: no control -> every control and its parent', v('fr_IsRetargeted', {}) === true);
    ok('fr_IsRetargeted: control given by name', v('fr_IsRetargeted', { control: 'Brow_Control' }) === true);
    setL(brow, 'posx', 4); setL(brow, 'roty', 9); setL(lip, 'posx', 5);
    B.calls.length = 0;
    run('fr_ResetRetarget', { mute: true });
    ok('fr_ResetRetarget(true): the last retarget operator per object muted, only that one', op.val('mute') === true && other.val('mute') === false);
    ok('fr_ResetRetarget(true): the object pos/rot zeroed, then fr_ResetAll', L(brow, 'posx') === 0 && L(brow, 'roty') === 0 && called('fr_ResetAll').length === 1 && L(lip, 'posx') === 0);
    setL(lip, 'posx', 5); B.calls.length = 0;
    run('fr_ResetRetarget', { mute: false });
    ok('fr_ResetRetarget(false): unmuted, no reset', op.val('mute') === false && called('fr_ResetAll').length === 0 && L(lip, 'posx') === 5);
    setL(lip, 'posx', 0);
    S.put('controls', 'GhostB18a', 'noSuchB18a'); B.calls.length = 0;
    let r = run('fr_IsRetargeted', {});
    ok('fr_IsRetargeted: a missing control -> FaceRobot(), retry, "Retargeting Controls Not Found", null', r.v === null && has(r, /^Retargeting Controls Not Found$/) && called('FaceRobot').length === 1, r);
    r = run('fr_ResetRetarget', { mute: true });
    ok('fr_ResetRetarget: no controls -> "Retargeting Controls Not Found", nothing reset', has(r, /^Retargeting Controls Not Found$/) && op.val('mute') === false);
    S.delete('controls', 'GhostB18a');
    const jaw = A.run('GetPrim', { PresetObj: 'Null', Name: 'JawEnd_ControlProxy' }); face.addChild(jaw);
    const jc = ctl('Jaw_Control', [0, -2, 0]);
    jaw.kinematics.local.nestedObjects = [new Op('JawRt', 'fro_FaceRetargetHeadNullOp', [])];
    ok('fr_IsRetargeted: a Jaw control also checks JawEnd_ControlProxy', v('fr_IsRetargeted', { control: jc }) === true);
    S.delete('controls', jc.name); face.removeChild(jc); face.removeChild(jaw);
    brow.kinematics.local.nestedObjects = [];
    brow.retargetOps = ['fro_FaceRetargetLocalOp'];
    ok('fr_IsRetargeted: the B14d marker list counts too', v('fr_IsRetargeted', { control: brow }) === true);
    delete brow.retargetOps;
  });

  // ================= §5 pick points
  block('pick points', () => {
    const pp = A.run('GetPrim', { PresetObj: 'Null', Name: 'PickPoints' }); face.addChild(pp); S.put('_', 'PickPoints', pp);
    run('fr_SetPickPoints', { picks: ['PkA', 'PkB'], vectors: [1, 2, 3, 4, 5, 6], rad: 0.5 });
    const a = [...pp.children].find(o => o.name === 'PkA'), b = [...pp.children].find(o => o.name === 'PkB');
    const ga = a && a.globalMatrix().elements, gb = b && b.globalMatrix().elements;
    ok('fr_SetPickPoints: spheres under fr_sget("PickPoints") at the given global positions', !!a && !!b && near(ga[12], 1) && near(ga[14], 3) && near(gb[13], 5));
    ok('fr_SetPickPoints: colour 891 on the wireframe', a.properties.some(p => p.type === 'display' && p.val('wirecol') !== undefined));
    let r = run('fr_GetPickPoints');
    const t = r.log.find(l => l.includes('fr_SetPickPoints(picks,vectors,rad);')) ?? '';
    ok('fr_GetPickPoints: one info message: replay script', t.startsWith('\n') && t.includes('var picks = ["PkA","PkB"];') && t.includes('var vectors = [1,2,3,4,5,6]') && /var rad = /.test(t), t);
    // fr_StorePP / fr_RestorePP
    r = run('fr_StorePP', { model: face, mesh: faceMesh });
    const blob = faceMesh.properties.find(p => p.name === 'pickedpoints');
    ok('fr_StorePP: UserDataBlob "pickedpoints" on the mesh, data lines, returns nothing', r.v === undefined && !!blob && blob.type === 'UserDataBlob' && blob.value.includes("var names = ['PkA','PkB'];") && blob.value.includes('var positions = [1,2,3,4,5,6];') && blob.value.endsWith('pickpoints(null,names,positions,radius,color);'), blob?.value);
    ok('fr_StorePP: the embedded helper source is not reproduced (logged)', nya(r));
    const d = Y.parsePPBlob(blob.value);
    ok('fr_StorePP: the blob parses back', J(d.names) === '["PkA","PkB"]' && J(d.positions) === '[1,2,3,4,5,6]');
    pp.removeChild(a); pp.removeChild(b); B.calls.length = 0;
    A.select([]);
    r = run('fr_RestorePP', {});
    const a2 = [...pp.children].find(o => o.name === 'PkA');
    ok('fr_RestorePP: empty -> the face mesh pickedpoints blob; spheres recreated under PickPoints; FaceRobot(); returns nothing', r.v === undefined && !!a2 && near(a2.globalMatrix().elements[13], 2) && called('FaceRobot').length === 1, r);
    ok('fr_RestorePP: a non-object ppblob -> nothing', v('fr_RestorePP', { ppblob: 'text' }) === undefined);
    faceMesh.removeProperty(blob);
    const sm = faceMesh; S.main.get('meshes').delete('Mesh');
    const fc = face.properties.find(p => p.name === 'FaceConnections'); const mn = fc.val('Mesh'); fc.set('Mesh', '');
    ok('fr_RestorePP: no blob found -> false', v('fr_RestorePP', {}) === false);
    fc.set('Mesh', mn); S.put('meshes', 'Mesh', sm);
    for (const c of [...pp.children]) pp.removeChild(c); face.removeChild(pp); S.delete('_', 'PickPoints');
  });

  // ================= §6 envelope storage
  block('envelope', () => {
    const m = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'envB18a' });
    const d1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'envD1' }), d2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'envD2' });
    d1.kinematics.local.get('posx').value = -2; d2.kinematics.local.get('posx').value = 2;
    A.select([m, d1, d2]); A.run('ApplyFlexEnv', {});
    const op = m.primitive.operators.find(o => o.type === 'envelopop');
    const n = op.weights.length;
    let r = run('fr_StoreEnvelope', { Mesh: m });
    const blob = r.v;
    ok('fr_StoreEnvelope: blob "StoredEnvelope" on the mesh, returned', blob?.type === 'UserDataBlob' && blob.name === 'StoredEnvelope' && m.properties.includes(blob));
    const vals = String(blob.value).split(',').map(Number);
    ok('fr_StoreEnvelope: flattened weights (deformer index fastest, percentages; inferred)', vals.length === n * 2 && near(vals[0], op.weights[0][0] * 100, 1e-3) && near(vals[1], op.weights[0][1] * 100, 1e-3) && nya(r));
    const saved = op.weights.map(w => Array.from(w));
    op.weights = op.weights.map(() => Float32Array.from([0.5, 0.5]));
    A.select([blob]);
    r = run('fr_RestoreEnvelope', {});
    ok('fr_RestoreEnvelope: selected blob -> its mesh; weights written back', !r.err && op.weights.every((w, i) => near(w[0], saved[i][0], 1e-4) && near(w[1], saved[i][1], 1e-4)), r);
    A.undo();
    ok('fr_RestoreEnvelope: undoable', near(op.weights[0][0], 0.5));
    r = run('fr_RestoreEnvelope', { StoredEnvelope: 2, Mesh: m });
    ok('fr_RestoreEnvelope: index 2 -> StoredEnvelope', near(op.weights[0][0], saved[0][0], 1e-4));
    r = run('fr_StoreEnvelope', { Mesh: m, EnvName: 'MyEnv' });
    ok('fr_StoreEnvelope: EnvName', r.v?.name === 'MyEnv');
    op.weights = op.weights.map(() => Float32Array.from([0.5, 0.5]));
    run('fr_RestoreEnvelope', { StoredEnvelope: 'MyEnv', Mesh: m });
    ok('fr_RestoreEnvelope: by property name', near(op.weights[0][0], saved[0][0], 1e-4));
    r = run('fr_StoreEnvelope', { Mesh: cube });
    ok('fr_StoreEnvelope: no envelope -> "<FullName> has no envelope"', has(r, /^cube has no envelope$/) && r.v === undefined);
    r = run('fr_RestoreEnvelope', { StoredEnvelope: 'Nope', Mesh: d1 });
    ok('fr_RestoreEnvelope: not a polymsh -> "no valid mesh found "', r.log.includes('no valid mesh found '));
    r = run('fr_RestoreEnvelope', { StoredEnvelope: 'Nope', Mesh: cube });
    ok('fr_RestoreEnvelope: no blob -> "no valid envelope storage property found"', r.log.includes('no valid envelope storage property found'));
    A.select([]); S.main.get('meshes').delete('Mesh'); const fc = face.properties.find(p => p.name === 'FaceConnections'); const mn = fc.val('Mesh'); fc.set('Mesh', '');
    r = run('fr_StoreEnvelope', {});
    ok('fr_StoreEnvelope: no mesh -> "No mesh found " (trailing space)', r.log.includes('No mesh found ') && r.v === undefined);
    fc.set('Mesh', mn); S.put('meshes', 'Mesh', faceMesh);
    for (const o of [m, d1, d2]) A.scene.root.removeChild(o);
  });

  // ================= §7 offset maps
  block('offset maps', () => {
    const Cl = A.faceRobotB14a.Cluster; const cls = new Cl('offB18a', 'pnt', new Set([0, 1, 2, 3])); faceMesh.addCluster(cls);
    let r = run('fr_SetOffsetMap', { inCls: cls, inVArray: [0.1, 0.2, 0.3, 0.4], inBaseName: 'OffW' });
    const wm = r.v;
    ok('fr_SetOffsetMap: numbers -> one weight map, element array = values, colours 0/255/255', wm?.type === 'weightmap' && wm.name === 'OffW' && cls.properties.includes(wm) && J(Y.weightArray(cls, wm)) === J([0.1, 0.2, 0.3, 0.4]) && wm.val('red') === 0 && wm.val('green') === 255 && wm.val('blue') === 255, r);
    const w2 = v('fr_SetOffsetMap', { inCls: cls, inVArray: [1, 1, 1, 1], inBaseName: 'OffC', inR: 10, inG: 0, inB: 3 });
    ok('fr_SetOffsetMap: given colours kept (0 is kept)', w2.val('red') === 10 && w2.val('green') === 0 && w2.val('blue') === 3);
    r = run('fr_SetOffsetMap', { inCls: cls, inVArray: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }], inBaseName: 'Off' });
    const o = r.v;
    ok('fr_SetOffsetMap: vectors -> maps <base>X/Y/Z, first N entries overwritten, returned as {x,y,z}', o?.x?.name === 'OffX' && o.y.name === 'OffY' && o.z.name === 'OffZ' && J(Y.weightArray(cls, o.y).slice(0, 2)) === '[2,5]' && J(Y.weightArray(cls, o.z).slice(0, 2)) === '[3,6]' && Y.weightArray(cls, o.x).length === 4, r);
    r = run('fr_SetOffsetMap', { inCls: cls, inVArray: [], inBaseName: 'Bad' });
    const msg = r.log.find(l => l.includes('Attempt to save offset map failed')) ?? '';
    ok('fr_SetOffsetMap: empty array -> siError three-line message, null', r.v === null && msg.startsWith('\nAttempt to save offset map failed\n\tCluster: ') && msg.endsWith('\n\tMapNames: Bad') && r.kinds[r.log.indexOf(msg)] === 'error', msg);
    const w3 = v('fr_SetOffsetMap2', { inCls: cls, inVarray: Float64Array.from([0.5, 0.25]), inBaseName: 'Off2' });
    ok('fr_SetOffsetMap2: SAFEARRAY converted first, same result', w3?.name === 'Off2' && J(Y.weightArray(cls, w3).slice(0, 2)) === '[0.5,0.25]');
    faceMesh.removeCluster(cls);
  });

  // ================= §8 layout, preference paths
  block('layout and paths', () => {
    const views = A.faceRobotB14.rows.desktopB14bc.views; views.delete('Sculpt'); views.delete('MyObjView');
    let r = run('fr_ObjectView', {});
    const sv = views.get('Sculpt');
    ok('fr_ObjectView: empty name -> "Sculpt"; CreateView("Object View") at (5,5), shaded, locked; returns nothing', r.v === undefined && sv?.type === 'Object View' && sv.attrs.x === 5 && sv.attrs.y === 5 && sv.attrs.displaymode === 'shaded' && sv.attrs.lockstatus === 'true');
    r = run('fr_ObjectView', { vname: 'Sculpt' });
    const cd = Object.values(B.cameraDisplay)[0];
    ok('fr_ObjectView: existing view -> siNormal; GetViewCamera(4) Camera Display tweaks (viewport unattested: logged)', sv.attrs.state === 'siNormal' && cd?.headlight === true && cd.wireontopunsel === true && cd.wireframeopacity === 0.2 && nya(r));
    run('fr_ObjectView', { vname: 'MyObjView' });
    ok('fr_ObjectView: named view', views.get('MyObjView')?.type === 'Object View');
    views.delete('Sculpt'); views.delete('MyObjView');
    B.calls.length = 0;
    r = run('fr_ResetPaths', { token: 1 });
    ok('fr_ResetPaths: returns true, runs fr_SwitchFaceLayout()', r.v === true && called('fr_SwitchFaceLayout').length === 1, r);
    const P = n => A.userPrefs[`Face Robot.${n}`];
    ok('fr_ResetPaths: the six path preferences, $FACEROBOTDATAROOT literal, trailing separator', P('Head_Path') === '$FACEROBOTDATAROOT\\Face\\' && P('Parts_Path') === '$FACEROBOTDATAROOT\\Parts\\' && P('Actor_Path') === '$FACEROBOTDATAROOT\\Actors\\' && P('Dna_Path') === '$FACEROBOTDATAROOT\\Dna\\' && P('Ani_Path') === '$FACEROBOTDATAROOT\\FaceAni\\' && P('Pose_Path') === '$FACEROBOTDATAROOT\\FacePose\\' && P('Custom_Path') === undefined);
    const fm = S.raw('_', 'FaceModel'); S.delete('_', 'FaceModel'); A.userPrefs['Face Robot.Head_Path'] = 'kept';
    r = run('fr_ResetPaths', {});
    ok('fr_ResetPaths: no face model -> script error before any preference change', (r.err ?? '').includes('fr_ResetPaths') && P('Head_Path') === 'kept');
    S.put('_', 'FaceModel', fm);
  });

  // ================= §9 sources and backups
  block('CleanSources', () => {
    const proj = 'C:\\b18aProj'; const oldP = Y.alembicState?.projectPath;
    Y.setProjectPath(proj);
    FS.ensureFolder(proj + '\\Pictures\\sub'); FS.writeFile(proj + '\\Pictures\\sub\\tex.pic', 'IMG');
    const store = Y.imageSources(); const keep = store.splice(0);
    const mk = (name, file) => { const p = Y.newImageSource(name, file); store.push(p); return p; };
    const sA = mk('srcA', 'Pictures\\sub\\tex.pic'), sB = mk('srcB', 'D:\\elsewhere\\tex.pic'), sC = mk('srcC', 'missing.pic');
    let r = run('CleanSources', { Action: 33 });
    ok('CleanSources: found file -> "File Path Found :<source>"', has(r, /^File Path Found :srcA$/));
    ok('CleanSources: absolute paths are prefixed with the project path too', r.log.includes('File Path Not Found :' + proj + '\\D:\\elsewhere\\tex.pic'));
    ok('CleanSources: healed from the project Pictures folders (recursive)', sB.val('FileName') === proj + '\\Pictures\\sub\\tex.pic' && has(r, /^File tex\.pic successfully healed$/), sB.val('FileName'));
    ok('CleanSources: bit 32 -> not found in search -> DELETING', has(r, /^File missing\.pic NOT FOUND IN SEARCH:$/) && r.log.some(l => l === '       DELETING') && !store.includes(sC));
    sB.set('FileName', 'D:\\elsewhere\\tex.pic');
    r = run('CleanSources', {});
    ok('CleanSources: default 51 -> localize: copied to <P>\\Pictures\\<file>, FileName Pictures\\<file>', sB.val('FileName') === 'Pictures\\tex.pic' && FS.isFile(proj + '\\Pictures\\tex.pic'), sB.val('FileName'));
    sB.set('FileName', 'gone.pic');
    r = run('CleanSources', { Action: -1 });
    ok('CleanSources: negative -> "   Deleting " and DeleteObj', r.log.includes('   Deleting ') && !store.includes(sB) && store.includes(sA));
    store.splice(0, store.length, ...keep); Y.setProjectPath(oldP);
  });
  block('EmptyBackups', () => {
    FS.ensureFolder('C:\\b18aBk\\Backup\\sub'); FS.writeFile('C:\\b18aBk\\Backup\\f1.txt', '12345'); FS.writeFile('C:\\b18aBk\\Backup\\sub\\f2.txt', '123');
    FS.ensureFolder('C:\\b18aBk\\WINDOWS\\Backup');
    let r = run('EmptyBackups', { maxdepth: 8, foldername: 'Backup', list: true });
    const res = r.log.find(l => l.startsWith('Resolved ')) ?? '';
    ok('EmptyBackups: GetProjects finds the named folders (WINDOWS skipped)', res.includes('C:\\b18aBk\\Backup') && !res.includes('WINDOWS'), res);
    ok('EmptyBackups: list -> "Found Files: ", nothing deleted, no totals', r.log.includes('Found Files: ') && FS.isFile('C:\\b18aBk\\Backup\\f1.txt') && !has(r, /bites deleted/) && r.log.includes('\tf1.txt'));
    ok('EmptyBackups: the confirmation property is removed again', !A.scene.root.properties.some(p => p.name === 'EmptyBackups'));
    B.hooks.confirmBackups = () => null;
    r = run('EmptyBackups', { foldername: 'Backup' });
    ok('EmptyBackups: Cancel -> "Cancelled Command: No Backups were deleted !"', r.log.includes('Cancelled Command: No Backups were deleted !') && FS.isFile('C:\\b18aBk\\Backup\\f1.txt'));
    B.hooks.confirmBackups = (paths) => paths.map(p => p === 'C:\\b18aBk\\Backup');
    r = run('EmptyBackups', {});
    ok('EmptyBackups: defaults (8, Backup, false) -> files and subfolders deleted, folder kept, totals logged', !FS.isFile('C:\\b18aBk\\Backup\\f1.txt') && !FS.isFolder('C:\\b18aBk\\Backup\\sub') && FS.isFolder('C:\\b18aBk\\Backup') && r.log.includes('Deleting: ') && r.log.includes('1  folders deleted') && r.log.includes('1  files deleted') && r.log.includes('8  bites deleted'), r.log.filter(l => /deleted/.test(l)));
    delete B.hooks.confirmBackups;
    FS.ensureFolder('C:\\b18aDeep\\a\\b\\Backup');
    r = run('EmptyBackups', { maxdepth: 1, list: true });
    ok('EmptyBackups: depth limit -> "Scan Stopped at <max> folders depth, ..."', has(r, /^Scan Stopped at 1 folders depth, to enable deeper scan/) && !(r.log.find(l => l.startsWith('Resolved ')) ?? '').includes('b18aDeep'));
    FS.deleteFolder('C:\\b18aBk'); FS.deleteFolder('C:\\b18aDeep');
  });

  // ================= §10 log helpers
  block('log helpers', () => {
    let r = run('logv', { v: { x: 1, y: 2, z: 3 }, s: 'P' });
    ok('logv: "<s>\\t [x,y,z]"', r.log[0] === 'P\t [1,2,3]', r.log);
    ok('logv: s default ""', run('logv', { v: { x: 0, y: 0, z: 1 } }).log[0] === '\t [0,0,1]');
    r = run('loga', { a: [1, 'b'], s: 'L' });
    ok('loga: "<s> [", one "\\t<item>" per element, " ]"', J(r.log) === J(['L [', '\t1', '\tb', ' ]']), r.log);
    A.select([cube]); r = run('logc', {});
    ok('logc: empty c -> selection, s = "Current Selection:"', J(r.log) === J(['Current Selection:', '(', '\tcube', ' )']), r.log);
    r = run('logc', { c: [cube], s: 'S', a: 'Class' });
    ok('logc: a "c" -> item and ClassName', J(r.log) === J(['S', '(', '\tcube\t\tX3DObject', ' )']), r.log);
    r = run('logc', { c: [cube], a: 'type' });
    ok('logc: a "t" -> literal "a" prefix and type (sic)', r.log.includes('\tacube\t\tpolymsh'), r.log);
    r = run('logc', { c: [cube], a: 'N' });
    ok('logc: a "n" -> name', r.log.includes('\tcube'));
    r = run('logt', { t: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1], s: 'T' });
    ok('logt: "Transformation <s>", then Translation / Rotation / Scaling lines', J(r.log) === J(['Transformation T', 'Translation: \t [1,2,3]', 'Rotation: \t [0,0,0]', 'Scaling: \t [1,1,1]']), r.log);
    ok('suma: + sum from 0', v('suma', { a: [1, 2, 3] }) === 6 && v('suma', { a: [1, 'a', 2] }) === '1a2');
    r = run('suma', { a: [2, 3], log: true });
    ok('suma: log truthy -> the sum is logged', r.v === 5 && r.log.includes('5'));
  });
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS], NOLOG });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_fr_b18a_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
