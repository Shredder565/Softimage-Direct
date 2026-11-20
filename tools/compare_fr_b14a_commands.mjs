// CMD-B14a (Face Robot FR.dll utilities / store / file I/O / queries): the 30 commands of src/commands/faceRobotB14a.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b14a-fr-utilities-storage.md
// and docs/re/WIRE_CORRECTIONS_B14.md items 8-10.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; these FR commands are not in
//      data/command_registry.json). One catalogue default is not a value and is replaced as the note states:
//      fr_AddObjectInPlace inVector (a Python ISIVector3 repr -> vector (0,0,0));
//   2. every command runs with its default arguments on the ?demo scene (cube selected, sample face built) without an
//      unexpected error (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (store key composition / order / mem persistence round trip, file I/O, browser
//      triplets, constant queries, mute toggle, stack walk, NaN repair, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b14a_commands.mjs
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
  'fr_FileDelete', 'fr_sget', 'fr_GetCurrentObjState', 'fr_IsDesigner', 'fr_GetCommand', 'fr_sdump', 'fr_Mute', 'fr_sstring',
  'fr_Callstack_IsDebugMode', 'fr_NeighborIndex', 'fr_GetFaceModel', 'GetFaceWeightMap', 'fr_AddToGroup', 'fr_GlueMeshGlobal', 'fr_sdelete',
  'GetFaceCluster', 'fr_GetOperatorsInStack', 'fr_sindices', 'fr_FileWrite', 'fr_Visible', 'fr_RepairNan', 'fr_MuteSources', 'fr_sset',
  'fr_AddObjectInPlace', 'fr_GetNormalArray', 'fr_FileRead', 'fr_GetPointArray', 'fr_sfeatures', 'fr_GetFilesForBrowser', 'fr_PrepareExport',
];
const DEFAULT_FAILS = new Set(['fr_FileRead', 'fr_FileWrite', 'fr_NeighborIndex', 'fr_GetNormalArray', 'fr_GetOperatorsInStack', 'fr_GlueMeshGlobal',
  'fr_MuteSources', 'fr_PrepareExport']);
const DEFAULT_OVERRIDES = { 'fr_AddObjectInPlace.inVector': [0, 0, 0] };

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  if (!f) return [n, null];
  return [n, f.args.map(a => [a.name, DEFAULT_OVERRIDES[`${n}.${a.name}`] ?? a.default ?? null])];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('fr_PrepareExport') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const X = A.faceRobotB14a, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text), kinds: L.map(l => l.kind) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const v = (n, a) => run(n, a).v;
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B14a/.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const J = JSON.stringify;
  const cube = A.scene.find('cube');
  const { model: face, mesh: faceMesh } = X.buildSampleFace();
  const ST = A.faceRobotB14, S = ST.store;
  const reset = () => { A.select([cube]); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const mute0 = ST.mute;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    ST.mute = mute0;
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();
  for (const n of NAMES) ok(`${n}: category Face Robot`, A.commands.get(n)?.category === 'Face Robot');

  // ================= store (§2.2)
  try {
    run('fr_sset', { key1: 'secA', key2: 'k', value: 'v1' });
    ok('fr_sset/fr_sget: (key1, key2, value) -> section key1, key key2', v('fr_sget', { key1: 'secA', key2: 'k' }) === 'v1');
    ok('sections and keys are separate levels (no concatenation)', v('fr_sget', { key1: 'secAk', key2: '' }) === '' && S.raw('secA', 'k') === 'v1');
    run('fr_sset', { key1: 'oneKey', key2: 'val1', value: '' });
    ok('fr_sset: value empty -> key2 stored at (_, key1)', S.raw('_', 'oneKey') === 'val1' && v('fr_sget', { key1: 'oneKey', key2: '' }) === 'val1');
    ok('fr_sget: key2 empty -> section "_"', v('fr_sget', { key1: 'oneKey' }) === 'val1');
    ok('fr_sget: missing -> empty', v('fr_sget', { key1: 'nope', key2: 'nothing' }) === '' && v('fr_sget', { key1: 'nope' }) === '');
    run('fr_sset', { key1: 'secA', key2: 'blank', value: ' ' });
    ok('fr_sset: a " " value is ignored', S.raw('secA', 'blank') === undefined);
    run('fr_sset', { key1: 'ign', key2: '', value: '' });
    ok('fr_sset: an empty value with empty key2 is ignored', S.raw('_', 'ign') === undefined);
    for (const k of ['b', 'B', 'a', '_x', 'aa']) run('fr_sset', { key1: 'ord', key2: k, value: 1 });
    ok('fr_sindices: sorted by code unit, case-sensitive', J(v('fr_sindices', { key: 'ord' })) === J(['B', '_x', 'a', 'aa', 'b']), v('fr_sindices', { key: 'ord' }));
    ok('fr_sindices: empty key -> section "_"', v('fr_sindices', { key: '' }).includes('oneKey') && v('fr_sindices', {}).includes('FaceModel'));
    ok('fr_sindices: unknown section -> empty array', J(v('fr_sindices', { key: 'nosuch' })) === '[]');
    run('fr_sset', { key1: 'obj', key2: 'cube', value: cube });
    ok('fr_sget: a stored named object comes back as that object', v('fr_sget', { key1: 'obj', key2: 'cube' }) === cube);
    const r = run('fr_sdelete', { key1: 'secA', key2: 'k' });
    ok('fr_sdelete: removes (key1, key2); no value put', r.v === undefined && !r.err && S.raw('secA', 'k') === undefined);
    run('fr_sdelete', { key1: 'oneKey' });
    ok('fr_sdelete: key2 empty -> (_, key1)', S.raw('_', 'oneKey') === undefined);
    ok('fr_sdelete: missing key is not an error', !run('fr_sdelete', { key1: 'nope', key2: 'x' }).err);
    S.secondary.set('sec2', new Map([['q', 1]])); S.main.set('sec2', new Map([['q', 1]]));
    run('fr_sdelete', { key1: 'sec2', key2: 'q' });
    ok('fr_sdelete: also clears the secondary map', !S.secondary.get('sec2').has('q') && !S.main.get('sec2').has('q'));
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= mem persistence
  try {
    ST.prefs.hasCategory = true; ST.prefs.Default_Type = ''; S.main.delete('mem');
    run('fr_sset', { key1: 'mem', key2: 'k1', value: 'v1' });
    run('fr_sset', { key1: 'mem', key2: 'k2', value: 5 });
    ok('mem: persisted as <key>--=--<value>**=** in Face Robot.Default_Type', ST.prefs.Default_Type === 'k1--=--v1**=**k2--=--5**=**', ST.prefs.Default_Type);
    ok('mem: the value is stored converted to a string', S.raw('mem', 'k2') === '5');
    run('fr_sset', { key1: 'mem', key2: 'obj', value: cube });
    ok('mem: an object value is stored as its name text', S.raw('mem', 'obj') === 'cube', S.raw('mem', 'obj'));
    run('fr_sdelete', { key1: 'mem', key2: 'obj' });
    run('fr_sdelete', { key1: 'mem', key2: 'k1' });
    ok('mem: delete re-persists the section', ST.prefs.Default_Type === 'k2--=--5**=**', ST.prefs.Default_Type);
    run('fr_sset', { key1: 'mem', key2: 'k3', value: 'x y' });
    const saved = ST.prefs.Default_Type;
    S.main.delete('mem');
    S.reloadMem();
    ok('mem: reload round trip (split on **=** then --=--)', v('fr_sget', { key1: 'mem', key2: 'k2' }) === '5' && v('fr_sget', { key1: 'mem', key2: 'k3' }) === 'x y' && J(v('fr_sindices', { key: 'mem' })) === '["k2","k3"]');
    ST.prefs.Default_Type = 'x'.repeat(2049);
    const m0 = A.log.length; const rr = S.reloadMem();
    ok('mem: Default_Type over 2048 characters -> "Default_Type exceeds maximum length.  State memory inactive."', rr === false && A.log.slice(m0).some(l => l.text === 'Default_Type exceeds maximum length.  State memory inactive.'));
    ST.prefs.Default_Type = saved;
    ST.prefs.hasCategory = false;
    run('fr_sset', { key1: 'mem', key2: 'k4', value: 'z' });
    ok('mem: no Face Robot category -> nothing written', ST.prefs.Default_Type === saved);
    ST.prefs.hasCategory = true;
    run('fr_sdelete', { key1: 'mem', key2: 'k4' });
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_sstring (localization)
  try {
    const old = A.commands.get('fr_GetFile');
    FS.ensureFolder('C:\\b14a\\views');
    FS.writeFile('C:\\b14a\\views\\FR.en-us.txt', 'hello   Hello World  \nbye\tGood bye\r\n  pbar_evaluate Evaluating...\nlone\n');
    A.register({ name: 'fr_GetFile', label: 'fr_GetFile', category: 'Custom', args: [{ name: 'inFileName', default: null }], execute: (_a, a) => 'C:\\b14a\\' + a.inFileName });
    X.loadLocalization(true);
    ok('fr_sstring: first token = key, rest of the line trimmed = value', v('fr_sstring', { key: 'hello' }) === 'Hello World' && v('fr_sstring', { key: 'bye' }) === 'Good bye' && v('fr_sstring', { key: 'pbar_evaluate' }) === 'Evaluating...');
    ok('fr_sstring: missing key -> empty string', v('fr_sstring', { key: 'zzz' }) === '' && v('fr_sstring', { key: 'lone' }) === '');
    A.register({ name: 'fr_GetFile', label: 'fr_GetFile', category: 'Custom', args: [{ name: 'inFileName', default: null }], execute: () => 'C:\\b14a\\missing.txt' });
    const m0 = A.log.length; X.loadLocalization(true);
    ok('localization: unreadable file -> "Unable to read localization file \'<path>\'"', A.log.slice(m0).some(l => /^Unable to read localization file 'C:\\b14a\\missing\.txt'/.test(l.text)));
    ST.interactive = false; S.localization.clear(); X.loadLocalization(true);
    ok('fr_sstring: batch mode -> nothing loaded, empty string', v('fr_sstring', { key: 'hello' }) === '');
    ST.interactive = true;
    if (old) A.register(old); else A.commands.delete('fr_GetFile');
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_sdump
  try {
    run('fr_sset', { key1: 'dump', key2: 'long', value: 'L'.repeat(250) });
    let r = run('fr_sdump', { severity: 0 });
    const i0 = r.log.indexOf('--------');
    ok('fr_sdump: empty line, "--------", "<section>: ", "   <key>: <value>", "--------"', r.v === undefined && r.log[i0 - 1] === '' && r.log.includes('dump: ') && r.log.includes('   ord: ') === false && r.log.includes('   B: 1') && r.log[r.log.length - 1] === '--------', r.log.slice(0, 8));
    const li = r.log.findIndex(l => l.startsWith('   long: '));
    ok('fr_sdump: lines cut into chunks of at most 100 characters', li >= 0 && r.log[li].length === 100 && r.log[li + 1].length === 100 && r.log[li + 2].length === 59, r.log.slice(li, li + 3).map(l => l.length));
    ok('fr_sdump: severity 0 -> 8 (info)', r.kinds.every(k => k === 'info'));
    r = run('fr_sdump', { severity: 2 });
    ok('fr_sdump: severity passed through (2 -> error lines)', r.kinds.every(k => k === 'error'));
    run('fr_sdelete', { key1: 'dump', key2: 'long' });
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_sfeatures
  try {
    let r = run('fr_sfeatures');
    ok('fr_sfeatures: absent table -> empty array (filling unread: logged)', J(r.v) === '[]' && nya(r));
    S.features.set('features', [['a0', 'b0'], ['a1', 'b1']]);
    ok('fr_sfeatures: flat [a0, b0, a1, b1]', J(v('fr_sfeatures')) === J(['a0', 'b0', 'a1', 'b1']));
    S.features.delete('features');
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= file I/O
  try {
    const D = 'C:\\b14a'; FS.ensureFolder(D);
    let r = run('fr_FileWrite', { filename: D + '\\t.txt', txt: 'abc\u00e9\r\nx' });
    ok('fr_FileWrite: no return value; ASCII form of txt, no newline translation', r.v === undefined && FS.readFile(D + '\\t.txt') === 'abc?\r\nx', FS.readFile(D + '\\t.txt'));
    ok('fr_FileRead: whole file as text', v('fr_FileRead', { filename: D + '\\t.txt' }) === 'abc?\r\nx');
    run('fr_FileWrite', { filename: D + '\\t.txt', txt: 'z' });
    ok('fr_FileWrite: "wb" truncates', FS.readFile(D + '\\t.txt') === 'z');
    FS.writeFile(D + '\\z.bin', 'ab\u0000cd');
    ok('fr_FileRead: stops at the first zero byte', v('fr_FileRead', { filename: D + '\\z.bin' }) === 'ab');
    r = run('fr_FileRead', { filename: '' });
    ok('fr_FileRead: empty name -> "No filename for reading.", E_FAIL', status(r, '80004005') && has(r, /^No filename for reading\.$/), r);
    r = run('fr_FileRead', { filename: D + '\\missing.txt' });
    ok('fr_FileRead: open failure -> "Unable to open <filename>", E_FAIL', status(r, '80004005') && has(r, /^Unable to open C:\\b14a\\missing\.txt$/), r);
    r = run('fr_FileWrite', { filename: 'C:\\nofolder_b14a\\x.txt', txt: 'a' });
    ok('fr_FileWrite: open failure -> E_FAIL, nothing logged (besides the bus failure line)', status(r, '80004005') && r.log.every(l => l.startsWith('fr_FileWrite: ')), r);
    r = run('fr_FileWrite', { filename: '', txt: 'a' });
    ok('fr_FileWrite: empty filename -> E_FAIL, nothing logged (besides the bus failure line)', status(r, '80004005') && r.log.every(l => l.startsWith('fr_FileWrite: ')), r);
    ok('fr_FileDelete: true when deleted', v('fr_FileDelete', { filename: D + '\\t.txt' }) === true && !FS.exists(D + '\\t.txt'));
    r = run('fr_FileDelete', { filename: D + '\\t.txt' });
    ok('fr_FileDelete: false otherwise, status OK', r.v === false && !r.err);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_GetFilesForBrowser
  try {
    const B = 'C:\\b14a\\br'; FS.ensureFolder(B);
    for (const f of ['plain.fr', 'my_face.face.fr', 'x.EYE.fr', 'zz.other.fr', 'a.b.c.fr', 'plain.gif', 'other.txt', 'Pose.facepose.fr', 'Pose.gif']) FS.writeFile(B + '\\' + f, '');
    const r = v('fr_GetFilesForBrowser', { path: B, extension: 'fr', defaultimage: '' });
    ok('fr_GetFilesForBrowser: element 0 = 3 x file count', r[0] === 18 && r.length === 19, r);
    const T = []; for (let i = 1; i < r.length; i += 3) T.push(r.slice(i, i + 3));
    const byPath = Object.fromEntries(T.map(t => [t[2], t]));
    ok('fr_GetFilesForBrowser: third element = path\\ + file name', T.every(t => t[2].startsWith(B + '\\')) && !!byPath[B + '\\plain.fr']);
    ok('fr_GetFilesForBrowser: name.ext with name.gif -> that image', J(byPath[B + '\\plain.fr']) === J(['plain', B + '\\plain.gif', B + '\\plain.fr']));
    ok('fr_GetFilesForBrowser: name.kind.ext -> label name, "_" -> space, kind image', J(byPath[B + '\\my_face.face.fr']) === J(['my face', 'img/BrowserDefaultFace.gif', B + '\\my_face.face.fr']));
    ok('fr_GetFilesForBrowser: kind is case-insensitive', byPath[B + '\\x.EYE.fr']?.[1] === 'img/BrowserDefaultEye.gif');
    ok('fr_GetFilesForBrowser: name.kind.ext with name.gif present -> path\\name.gif', byPath[B + '\\Pose.facepose.fr']?.[1] === B + '\\Pose.gif');
    ok('fr_GetFilesForBrowser: unknown kind -> default image (empty -> img/BrowserDefault.gif)', byPath[B + '\\zz.other.fr']?.[1] === 'img/BrowserDefault.gif');
    ok('fr_GetFilesForBrowser: other part counts -> whole file name label', J(byPath[B + '\\a.b.c.fr']) === J(['a.b.c.fr', 'img/BrowserDefault.gif', B + '\\a.b.c.fr']));
    ok('fr_GetFilesForBrowser: explicit default image', v('fr_GetFilesForBrowser', { path: B + '\\', extension: 'fr', defaultimage: 'img/D.gif' }).includes('img/D.gif'));
    run('fr_sset', { key1: 'mem', key2: 'show_', value: '1' });
    const r2 = v('fr_GetFilesForBrowser', { path: B, extension: 'fr', defaultimage: '' });
    ok('fr_GetFilesForBrowser: (mem, show_) non-empty keeps "_"', r2.includes('my_face'));
    run('fr_sdelete', { key1: 'mem', key2: 'show_' });
    ok('fr_GetFilesForBrowser: empty path or extension -> [0]', J(v('fr_GetFilesForBrowser', { path: '', extension: 'fr' })) === '[0]' && J(v('fr_GetFilesForBrowser', { path: B, extension: '' })) === '[0]');
    const B2 = 'C:\\b14a\\br83'; FS.ensureFolder(B2); for (const f of ['one.fro', 'two.froz', 'three.xyz', 'four.fr']) FS.writeFile(B2 + '\\' + f, '');
    const r83 = v('fr_GetFilesForBrowser', { path: B2, extension: 'fro' });
    ok('fr_GetFilesForBrowser: 8.3 quirk (extension never re-checked): a 3-character pattern also lists a longer extension starting with it', r83[0] === 6 && r83.some(x => typeof x === 'string' && x.endsWith('two.froz')) && !r83.some(x => typeof x === 'string' && x.endsWith('three.xyz')), r83);
    ok('fr_GetFilesForBrowser: missing folder -> [0]', J(v('fr_GetFilesForBrowser', { path: 'C:\\nofolder_b14a', extension: 'fr' })) === '[0]');
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= constant queries, fr_GetCommand (WIRE_CORRECTIONS_B14 8-9)
  try {
    ok('fr_GetCurrentObjState: always true', v('fr_GetCurrentObjState') === true);
    ok('fr_IsDesigner: always true', v('fr_IsDesigner') === true);
    ok('fr_GetCurrentObjState / fr_IsDesigner: tooltip "undefined"', A.commands.get('fr_GetCurrentObjState').tooltip === 'undefined' && A.commands.get('fr_IsDesigner').tooltip === 'undefined');
    ok('fr_Callstack_IsDebugMode: always false, description', v('fr_Callstack_IsDebugMode') === false && A.commands.get('fr_Callstack_IsDebugMode').description === 'Check if FaceRobot is running in debug mode');
    const d = A.commands.get('fr_IsDesigner'); const nl0 = d.noLog;
    const c = v('fr_GetCommand', { cmd: 'fr_IsDesigner' });
    ok('fr_GetCommand: returns the command and sets siNoLogging true (lasting)', c === d && d.noLog === true);
    const m0 = A.log.length; A.run('fr_IsDesigner');
    ok('fr_GetCommand: the command is no longer logged', !A.log.slice(m0).some(l => l.kind === 'cmd' && /fr_IsDesigner/.test(l.text)));
    d.noLog = nl0;
    ok('fr_GetCommand: not found -> invalid ref', v('fr_GetCommand', { cmd: 'NoSuchCommandB14a' }) === null);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_Mute
  try {
    ST.mute = false;
    const seq = [null, 1, 2, 2, 5, -1, '', 0, true, 2].map(s => v('fr_Mute', { state: s }));
    ok('fr_Mute: empty / outside 0..2 keep the state; 0 off, 1 on, 2 toggles; returns the state', J(seq) === J([false, true, false, true, true, true, true, false, true, false]), seq);
    ST.mute = false;
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_MuteSources
  try {
    const jaw = A.run('GetPrim', { PresetObj: 'Null', Name: 'JawEnd_ControlOffset' }); face.addChild(jaw);
    // fr_ResetRetarget is a real command since CMD-B18a (no longer a shell that logs its name): spy on its calls
    const rrDef = A.commands.get('fr_ResetRetarget'); const rrCalls = []; const rrExec = rrDef.execute;
    rrDef.execute = (app, args) => { rrCalls.push(args.mute); return rrExec(app, args); };
    const rrHas = (want) => { const c = rrCalls.splice(0); return want === undefined ? c.length === 0 : c.length === 1 && c[0] === want; };
    const nyaMS = (r) => r.log.some(l => /^fr_MuteSources: not yet attested/.test(l));
    cube.kinematics.local.get('posx').value = 3;
    let r = run('fr_MuteSources', { Objects: [cube], b_Mute: true, b_IncludeRetargeting: true });
    ok('fr_MuteSources: b_Mute -> ResetTransform on Objects', !r.err && cube.kinematics.local.val('posx') === 0, r);
    ok('fr_MuteSources: retargeting -> fr_ResetRetarget(true) after the reset; b_ResetTransforms is not used (nothing logged)', rrHas(true) && !nyaMS(r));
    cube.kinematics.local.get('posx').value = 3;
    r = run('fr_MuteSources', { Objects: [cube], b_Mute: true, b_IncludeRetargeting: false, b_ResetTransforms: false });
    ok('fr_MuteSources: the reset is gated by b_Mute, not b_ResetTransforms', cube.kinematics.local.val('posx') === 0 && rrHas(undefined));
    cube.kinematics.local.get('posx').value = 3;
    r = run('fr_MuteSources', { Objects: [cube], b_Mute: false, b_IncludeRetargeting: true });
    ok('fr_MuteSources: not muting + retargeting -> fr_ResetRetarget(false) only', rrHas(false) && cube.kinematics.local.val('posx') === 3);
    face.removeChild(jaw);
    r = run('fr_MuteSources', { Objects: [cube], b_Mute: false, b_IncludeRetargeting: true });
    ok('fr_MuteSources: no JawEnd_ControlOffset -> no retargeting', rrHas(undefined) && !r.err);
    rrDef.execute = rrExec;
    cube.kinematics.local.get('posx').value = 0;
    r = run('fr_MuteSources', { Objects: '' });
    ok('fr_MuteSources: empty collection -> 0x80020003', status(r, '80020003'));
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_GetFaceModel
  try {
    A.select([faceMesh]);
    ok('fr_GetFaceModel: model owning the first selected item', v('fr_GetFaceModel', {}) === face);
    reset();
    ok('fr_GetFaceModel: else the first face model among the scene models', v('fr_GetFaceModel', {}) === face);
    const fm = S.raw('_', 'FaceModel'); S.main.get('_').delete('FaceModel');
    const Model = A.scene.root.constructor, Prop = cube.properties[0].constructor;
    const m2 = new Model('FaceB14a'); A.scene.root.addChild(m2);
    for (const n of ['FaceState', 'FaceConnections']) m2.addProperty(new Prop(n, 'customparamset', []));
    let r = run('fr_GetFaceModel', {});
    ok('fr_GetFaceModel: not the store model and no FaceScale -> empty (Head test logged)', r.v === null && nya(r), r.v?.name);
    m2.addProperty(new Prop('FaceScale', 'customparamset', []));
    ok('fr_GetFaceModel: FaceState + FaceConnections + FaceScale -> face model', v('fr_GetFaceModel', {}) === m2);
    A.scene.root.removeChild(m2);
    A.select([faceMesh]);
    r = run('fr_GetFaceModel', { MakeFaceModel: true });
    ok('fr_GetFaceModel: MakeFaceModel -> builder (unread, logged), returns the first selected item\'s model', r.v === face && nya(r));
    A.select([]);
    ok('fr_GetFaceModel: MakeFaceModel with nothing selected -> empty', v('fr_GetFaceModel', { MakeFaceModel: true }) === null);
    S.put('_', 'FaceModel', fm);
    reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= GetFaceCluster / GetFaceWeightMap
  try {
    const u0 = A.undoStack.length;
    const c = v('GetFaceCluster', {});
    ok('GetFaceCluster: adds an empty pnt cluster named FaceCluster on the selected polymsh', c?.name === 'FaceCluster' && c.compKind === 'pnt' && c.elements.size === 0 && cube.clusters.includes(c));
    ok('GetFaceCluster: one -> returns it', v('GetFaceCluster', { Object: cube }) === c && cube.clusters.filter(k => k.name === 'FaceCluster').length === 1);
    const c2 = new X.Cluster('FaceCluster', 'pnt', new Set()); cube.addCluster(c2);
    let r = run('GetFaceCluster', { Object: cube });
    ok('GetFaceCluster: several -> the first, " MORE THAN ONE FACE CLUSTER FOUND! using <<"', r.v === c && has(r, /^ MORE THAN ONE FACE CLUSTER FOUND! using <</));
    cube.removeCluster(c2);
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'nullB14a' });
    A.select([nul]);
    r = run('GetFaceCluster', {});
    ok('GetFaceCluster: selection fallback not a polymsh -> 0x80020003', status(r, '80020003'));
    r = run('GetFaceCluster', { Object: nul });
    ok('GetFaceCluster: an explicit Object is not type-checked', r.v?.name === 'FaceCluster' && nul.clusters.length === 1);
    reset();
    r = run('GetFaceWeightMap', { MapName: 'Brow', Object: cube, R: 10, G: 20 });
    const wm = r.v;
    ok('GetFaceWeightMap: adds a Weight Map Property named MapName on the face cluster, red/green/blue = R/G/B', wm?.name === 'Brow' && wm.type === 'weightmap' && c.properties.includes(wm) && wm.val('red') === 10 && wm.val('green') === 20 && wm.val('blue') === 255, r.err);
    ok('GetFaceWeightMap: one -> returns it', v('GetFaceWeightMap', { MapName: 'Brow', Object: cube }) === wm);
    const lipL = new X.Property('Lip_L', 'weightmap', []), lipR = new X.Property('Lip_R', 'weightmap', []); lipL.userKeywords = 'Lip,L'; lipR.userKeywords = 'Lip,R'; c.addProperty(lipL); c.addProperty(lipR);
    r = run('GetFaceWeightMap', { MapName: 'Lip', Object: cube });
    ok('GetFaceWeightMap: several (every "_" piece is one of the user keywords) -> the first, " MORE THAN ONE WeightMap FOUND! using <<"', r.v?.name === 'Lip_L' && has(r, /^ MORE THAN ONE WeightMap FOUND! using <</));
    ok('GetFaceWeightMap: pieces match case-insensitively and all must match', v('GetFaceWeightMap', { MapName: 'lip_R', Object: cube }) === lipR);
    const nb0 = c.properties.length; const lm = v('GetFaceWeightMap', { MapName: 'Li', Object: cube });
    ok('GetFaceWeightMap: not a prefix match -> a new map is added', lm && lm !== lipL && lm.name === 'Li' && c.properties.length === nb0 + 1);
    r = run('GetFaceWeightMap', { MapName: 'Brow', Object: nul });
    ok('GetFaceWeightMap: Object not a polymsh -> "Specified Object<<...>>" then the selected polymsh', r.v === wm && has(r, /^Specified Object<<nullB14a>>/));
    A.select([nul]);
    r = run('GetFaceWeightMap', { MapName: 'Brow', Object: nul });
    ok('GetFaceWeightMap: no polymsh at all -> 0x80020003', status(r, '80020003'));
    while (A.undoStack.length > u0) A.undo();
    cube.clusters.splice(0, cube.clusters.length); A.scene.root.removeChild(nul);
    reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= mesh arrays
  try {
    const P = cube.primitive.mesh().positions;
    let r = run('fr_GetPointArray', { inObj: cube });
    ok('fr_GetPointArray: flat [x0,y0,z0,...] of the points', Array.isArray(r.v) && r.v.length === P.length && r.v.every((x, i) => near(x, P[i])), r.err);
    ok('fr_GetPointArray: invalid inObj -> first selected item', J(v('fr_GetPointArray', {})) === J(r.v));
    cube.kinematics.local.get('posx').value = 2;
    const g = v('fr_GetPointArray', { inObj: cube, Global: true });
    ok('fr_GetPointArray: Global maps to world space', g.every((x, i) => near(x, P[i] + (i % 3 === 0 ? 2 : 0))));
    ok('fr_GetPointArray: inMode outside 0..3 -> empty array', J(v('fr_GetPointArray', { inObj: cube, inMode: 7 })) === '[]');
    ok('fr_GetPointArray: inMode 0 (modeling) reads the geometry', v('fr_GetPointArray', { inObj: cube, inMode: 0 }).length === P.length);
    const n = v('fr_GetNormalArray', { inObj: cube });
    ok('fr_GetNormalArray: unit point normals, flat', n.length === P.length && [0, 1, 2, 3, 4, 5, 6, 7].every(k => near(Math.hypot(n[k * 3], n[k * 3 + 1], n[k * 3 + 2]), 1)));
    ok('fr_GetNormalArray: cube corner normals point away from the centre', [0, 1, 2, 3, 4, 5, 6, 7].every(k => n[k * 3] * P[k * 3] + n[k * 3 + 1] * P[k * 3 + 1] + n[k * 3 + 2] * P[k * 3 + 2] > 0));
    const ng = v('fr_GetNormalArray', { inObj: cube, Global: true });
    ok('fr_GetNormalArray: Global applies the position mapping (translation included, as read)', ng.every((x, i) => near(x, n[i] + (i % 3 === 0 ? 2 : 0))));
    cube.kinematics.local.get('posx').value = 0;
    r = run('fr_GetNormalArray', {});
    ok('fr_GetNormalArray: selection fallback is the Selection object (Q3) -> 0x80020003', status(r, '80020003'));
    // neighbours
    const polys = cube.primitive.mesh().polygons;
    const nbr = new Set(); for (const f of polys) { const i = f.indexOf(1); if (i >= 0) { nbr.add(f[(i + 1) % f.length]); nbr.add(f[(i + f.length - 1) % f.length]); } }
    r = run('fr_NeighborIndex', { inObj: cube, inVertex: 1 });
    ok('fr_NeighborIndex: mode 0 -> a neighbour of the vertex', nbr.has(r.v), [r.v, [...nbr]]);
    r = run('fr_NeighborIndex', { inObj: cube, inVertex: 1, inMode: 1 });
    const up = Math.max(...[...nbr].map(w => { const d = [P[w * 3] - P[3], P[w * 3 + 1] - P[4], P[w * 3 + 2] - P[5]]; return d[1] / Math.hypot(...d); }));
    const d = [P[r.v * 3] - P[3], P[r.v * 3 + 1] - P[4], P[r.v * 3 + 2] - P[5]];
    ok('fr_NeighborIndex: mode non-zero -> the most upward neighbour (logged)', nbr.has(r.v) && near(d[1] / Math.hypot(...d), up) && !nya(r));
    ok('fr_NeighborIndex: inVertex 0 rejected -> 0x80020003', status(run('fr_NeighborIndex', { inObj: cube, inVertex: 0 }), '80020003'));
    ok('fr_NeighborIndex: invalid inObj -> 0x80020003 (Q3)', status(run('fr_NeighborIndex', { inVertex: 1 }), '80020003'));
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= stack walk, fr_PrepareExport
  try {
    const mk = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'stackB14a' }); reset();
    const prim = mk.primitive;
    const op = (name, region) => { const o = new X.Operator(name, 'testop', []); o.region = region; prim.addOperator(o); return o; };
    const opM = op('opModel', 'modeling'), opS = op('opShape', 'shape'), opA = op('opAnim', 'animation'), env = op('Envelope Operator', 'animation'), opX = op('opSec', 'secondaryshape');
    const names = (a) => a.map(o => o.name);
    const gen = prim.operators[0].name;
    let r = run('fr_GetOperatorsInStack', { inObj: mk });
    ok('fr_GetOperatorsInStack: 0..4 -> every operator from the top, markers skipped', J(names(r.v)) === J(['opSec', 'Envelope Operator', 'opAnim', 'opShape', 'opModel', gen]), names(r.v ?? []));
    r = run('fr_GetOperatorsInStack', { inObj: mk, inStackStart: 1, inStackEnd: 3 });
    ok('fr_GetOperatorsInStack: from marker[end] (Animation) down to marker[start] (Modeling)', J(names(r.v)) === J(['Envelope Operator', 'opAnim', 'opShape']), names(r.v ?? []));
    r = run('fr_GetOperatorsInStack', { inObj: mk, inStackStart: 2, inStackEnd: 2 });
    ok('fr_GetOperatorsInStack: end == start -> 0..4', r.v.length === 6);
    const acc = ['x'];
    r = run('fr_GetOperatorsInStack', { inObj: mk, inStackStart: 0, inStackEnd: 1, ioAdditiveArray: acc });
    ok('fr_GetOperatorsInStack: ioAdditiveArray appended in place; returns the collected ones', J(names(r.v)) === J(['opModel', gen]) && acc.length === 3 && acc[1] === opM);
    ok('fr_GetOperatorsInStack: Selection fallback (Q3) -> 0x80020003', status(run('fr_GetOperatorsInStack', {}), '80020003'));
    void opS; void opA; void opX;
    // prepare export
    const C = X.Cluster;
    const cl = (n) => { const c = new C(n, 'pnt', new Set([0])); mk.addCluster(c); return c; };
    const keep = cl('keep'), r1 = cl('Lip_Region'), r2 = cl('a_Tendon2'), r3 = cl('x_CurveCls'), r4 = cl('Puff_Puffer'), hid = cl('hidden'); hid.siNotInspectable = true;
    const u0 = A.undoStack.length;
    r = run('fr_PrepareExport', { Object: mk });
    ok('fr_PrepareExport: deletes non-inspectable clusters and *_Region/_Tendon/_CurveCls/_Puffer* clusters', !r.err && J(mk.clusters.map(c => c.name)) === J(['keep']), [r.err, mk.clusters.map(c => c.name)]);
    ok('fr_PrepareExport: deletes every "Envelope Operator" in the stack', !prim.operators.includes(env) && prim.operators.includes(opA));
    while (A.undoStack.length > u0) A.undo();
    ok('fr_PrepareExport: undo restores', mk.clusters.length === 6 && prim.operators.includes(env));
    ok('fr_PrepareExport: invalid Object -> 0x80020003', status(run('fr_PrepareExport', { Object: 'nothing' }), '80020003'));
    void keep; void r1; void r2; void r3; void r4;
    A.scene.root.removeChild(mk);
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_GlueMeshGlobal
  try {
    const sp = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'driverB14a' });
    A.select([cube, sp]);
    const u0 = A.undoStack.length;
    let r = run('fr_GlueMeshGlobal', {});
    ok('fr_GlueMeshGlobal: selection 0 = driven, 1 = driver; fro_GlueMeshGlobalOp on the driven primitive', r.v?.type === 'fro_GlueMeshGlobalOp' && cube.primitive.operators.includes(r.v) && r.v.ports.inputs.driverPrimitive === sp.primitive && r.v.ports.inputs.drivenGlobal === cube.kinematics.global, r.err);
    while (A.undoStack.length > u0) A.undo();
    ok('fr_GlueMeshGlobal: undo removes the operator', !cube.primitive.operators.some(o => o.type === 'fro_GlueMeshGlobalOp'));
    r = run('fr_GlueMeshGlobal', { inDrivenMesh: cube, inDriverMesh: 'nothing' });
    ok('fr_GlueMeshGlobal: invalid driver -> E_INVALIDARG', status(r, '80070057'));
    r = run('fr_GlueMeshGlobal', { inDrivenMesh: cube, inDriverMesh: sp, inStack: 2 });
    ok('fr_GlueMeshGlobal: inStack -> construction region (inferred)', r.v?.region === 'animation');
    cube.primitive.removeOperator(r.v);
    A.scene.root.removeChild(sp); reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_AddToGroup / fr_Visible
  try {
    const sp = A.run('CreatePrim', { PresetObj: 'Sphere', Name: 'visB14a' }); reset();
    const G = new X.Group('grpB14a'); A.scene.groupList.push(G);
    let r = run('fr_AddToGroup', { inGroup: 'grpB14a', inObjs: [sp], notInspectable: 0 });
    ok('fr_AddToGroup: AddMembers', !r.err && G.members.includes(sp) && !sp.siNotInspectable);
    r = run('fr_AddToGroup', { inGroup: G, inObjs: [cube], notInspectable: 1, Branch: true });
    ok('fr_AddToGroup: notInspectable -> capability 8 on each member', G.members.includes(cube) && cube.siNotInspectable === true);
    ok('fr_AddToGroup: status always OK (invalid group)', !run('fr_AddToGroup', { inGroup: 'nothing', inObjs: [cube] }).err);
    delete cube.siNotInspectable;
    const vis = (o) => [o.property('visibility').val('viewvis'), o.property('visibility').val('rendvis')];
    const setVis = (o, x) => { o.property('visibility').get('viewvis').value = x; o.property('visibility').get('rendvis').value = x; };
    setVis(sp, false); setVis(cube, true);
    r = run('fr_Visible', { inObjs: [cube, sp], Value: '0' });
    ok('fr_Visible: Value 0 toggles (on -> off, off -> on), viewvis and rendvis', J(vis(cube)) === '[false,false]' && J(vis(sp)) === '[true,true]', [vis(cube), vis(sp), r.err]);
    setVis(sp, false); setVis(cube, true);
    run('fr_Visible', { inObjs: 'cube,visB14a', Value: 1 });
    ok('fr_Visible: Value > 0 only shows the hidden ones (comma-separated string)', J(vis(cube)) === '[true,true]' && J(vis(sp)) === '[true,true]');
    run('fr_Visible', { inObjs: [cube, sp], Value: -1 });
    ok('fr_Visible: Value < 0 only hides the visible ones', J(vis(cube)) === '[false,false]' && J(vis(sp)) === '[false,false]');
    setVis(cube, true); cube.siNotInspectable = true;
    run('fr_Visible', { inObjs: [cube], Value: 0 });
    ok('fr_Visible: non-inspectable objects are skipped', J(vis(cube)) === '[true,true]');
    delete cube.siNotInspectable;
    G.add({ name: 'viewvis', type: 'int', value: 1 }); G.add({ name: 'rendvis', type: 'int', value: 1 });
    r = run('fr_Visible', { inObjs: [sp], Value: 0 });
    ok('fr_Visible: frf_visgroup: owner group with viewvis != 2 has viewvis / rendvis set to 2', G.val('viewvis') === 2 && G.val('rendvis') === 2 && !nya(r));
    G.get('viewvis').value = 2; G.get('rendvis').value = 1;
    run('fr_Visible', { inObjs: [sp], Value: 0 });
    ok('fr_Visible: frf_visgroup: viewvis == 2 and no visibility property on the group -> not a match, untouched', G.val('rendvis') === 1);
    A.select([]);
    r = run('fr_Visible', {});
    ok('fr_Visible: empty selection -> status False (1)', !r.err && A.faceRobotB14.rows.B14a.status.fr_Visible === 1);
    A.select([cube]); setVis(cube, true);
    r = run('fr_Visible', { inObjs: 'nothingB14a' });
    ok('fr_Visible: invalid first object -> ToggleVisibility on the selection', cube.property('visibility').val('viewvis') === false);
    setVis(cube, true);
    A.scene.groupList.splice(A.scene.groupList.indexOf(G), 1);
    A.scene.root.removeChild(sp); reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_AddObjectInPlace
  try {
    const u0 = A.undoStack.length;
    let r = run('fr_AddObjectInPlace', {});
    const o = r.v;
    ok('fr_AddObjectInPlace: defaults -> AddPrimitive Cube (implicit) named Cube under the scene root', /^Cube\d*$/.test(o?.name) && o.parentObj === A.scene.root && o.type === 'implicit', [r.err, o?.name, o?.type]);
    const disp = o.properties.filter(p => p.type === 'display');
    ok('fr_AddObjectInPlace: a local Display Property, wirecol = inColor', disp.length === 1 && disp[0].shared === false && Number(disp[0].val('wirecol')) === 0);
    ok('fr_AddObjectInPlace: Cube size -> length (absent on this build\'s implicit cube: logged)', r.log.some(l => /the length size parameter of preset Cube/.test(l)));
    ok('fr_AddObjectInPlace: capability flag (unread) logged; selection unchanged', nya(r) && A.selection[0] === cube);
    const par = A.run('GetPrim', { PresetObj: 'Null', Name: 'parB14a' }); par.kinematics.local.get('posx').value = 5; reset();
    r = run('fr_AddObjectInPlace', { inPreset: 'Cube', inType: 1, inParent: par, inScale: 0.001, inVector: [1, 2, 3], inName: 'boxB14a', inColor: 3 });
    const b = r.v; const gp = b?.globalMatrix().elements;
    ok('fr_AddObjectInPlace: under inParent, global translation = inVector', b?.parentObj === par && near(gp[12], 1) && near(gp[13], 2) && near(gp[14], 3) && near(b.kinematics.local.val('posx'), -4), r.err);
    ok('fr_AddObjectInPlace: inScale clamped up to 0.01; wirecol = inColor', near(Number(b.primitive.operators[0].val('length')), 0.01) && b.properties.find(p => p.type === 'display').val('wirecol') === true /* this build models wirecol as a bool */, [b.primitive.operators.map(o => o.params.map(q => q.def.name + '=' + q.value).join(' ')), b.properties.map(p => p.type + ':' + p.val('wirecol'))]);
    r = run('fr_AddObjectInPlace', { inPreset: 'Sphere', inType: 1, inName: 'ballB14a', inScale: 2, inParamTags: 'radius' });
    ok('fr_AddObjectInPlace: inType 1 -> AddGeometry MeshSurface; other presets -> radius; inParamTags -> tag 1; siNotInspectable false', r.v?.name === 'ballB14a' && near(Number(r.v.primitive.operators[0].val('radius')), 2) && r.log.some(l => /tag value put on parameter radius/.test(l)) === false && r.v.primitive.operators[0].get('radius').tags === 1 && !r.v.siNotInspectable, r.err);
    r = run('fr_AddObjectInPlace', { inPreset: 'Circle', inType: 3, inName: 'crvB14a', inScale: 3 });
    ok('fr_AddObjectInPlace: inType 3 -> AddGeometry NurbsCurve', r.v?.type === 'crvlist', r.err);
    while (A.undoStack.length > u0) A.undo();
    A.scene.root.removeChild(par);
    ok('fr_AddObjectInPlace: undo removes the objects', ![...A.scene.allObjects()].includes(o) && !A.scene.find('boxB14a') && !A.scene.find('ballB14a'));
    reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  // ================= fr_RepairNan
  try {
    const N = NaN;
    const fx = X.repairCvs([[N, 0, 0, 1], [1, 1, 1, 1], [0, N, 0, 1], [0, 0, N, 1], [3, 3, 3, 1], [0, 0, 0, N]]);
    ok('fr_RepairNan: only following -> that point; both -> sum of nearest valid; only preceding -> that point', J(fx) === J([[1, 1, 1, 1], [1, 1, 1, 1], [4, 4, 4, 2], [4, 4, 4, 2], [3, 3, 3, 1], [3, 3, 3, 1]]), fx);
    ok('fr_RepairNan: no valid neighbour -> (0,0,0,1); nothing to fix -> unchanged', J(X.repairCvs([[N, 0, 0, 1], [0, 0, 0, N]])) === J([[0, 0, 0, 1], [0, 0, 0, 1]]) && X.repairCvs([[1, 2, 3, 1]]) === null);
    const crv = A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'crvNanB14a' }); reset();
    const gen = crv.primitive.operators[0]; const orig = gen.apply.bind(gen);
    gen.apply = (...x) => { const c = orig(...x); const cvs = c.cvs.map(p => [...p]); cvs[1] = [N, N, N, 1]; return { ...c, cvs }; };
    crv.primitive.dirty = true;
    const n0 = crv.primitive.operators.length;
    const r = run('fr_RepairNan', { BrokenCurves: [crv] });
    const cvs = crv.primitive.geom().cvs;
    ok('fr_RepairNan: NaN control points replaced and the curve written back', !r.err && cvs.every(p => p.every(Number.isFinite)) && crv.primitive.operators.length === n0 + 1, r.err);
    ok('fr_RepairNan: unchanged curves are not written', (run('fr_RepairNan', { BrokenCurves: [crv] }), crv.primitive.operators.length === n0 + 1));
    A.select([]);
    ok('fr_RepairNan: invalid collection and empty selection -> 0x80020003', status(run('fr_RepairNan', {}), '80020003'));
    A.scene.root.removeChild(crv); reset();
  } catch (e) { ok('block threw', false, String(e?.stack ?? e).slice(0, 300)); }
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
console.log(`compare_fr_b14a_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
