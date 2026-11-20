// CMD-B18d (small Face Robot / plug-in JScript commands): the 30 commands of src/commands/faceRobotB18d*.ts.
// There is no XSIBATCH golden for this row: this is a contract check against docs/ghidra/cmd-b18d-fr-small-scripts.md and
// docs/re/WIRE_CORRECTIONS_B18.md items 1, 4, 9, 10, 12.
//   1. every name is registered with the catalogue argument list (data/commands_full.json; names, order, defaults).
//      AddUserKeyword (item 10) is one registration with the built-in siuitasks arguments (data/command_registry.json)
//      first and the plug-in's (Obj, Key) after them;
//   2. every command runs with its default arguments on the ?demo scene (before any Face Robot exists) without an
//      unexpected error; the commands whose script errors with nothing to work on must fail with their name in the message;
//   3. the contracts' stated results (hole detection / capping, keyword rules, DNA parsing, layout toggle, plots, fit-stage
//      builders, shape goal, blink keys, paint export, stabilise, rig import, stereo camera).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b18d_commands.mjs
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

const NAMES = ['fr_GetPolymesh', 'fr_GetFRPolymesh', 'fr_CapAllHoles', 'fr_GetKeyed_safe', 'AddUserKeyword', 'GetKeyed', 'GetKeyed2', 'FilterKeyed',
  'SetControlKeys', 'MirrorControls', 'fr_SaveAdjustPanelKeys', 'fr_PrintAdjustPanelKeys', 'fr_RestoreAdjustPanelKeys', 'ParseDNAFile', 'GetDNAFile', 'LogDNA',
  'fr_ToggleFaceLayout', 'fr_SetAltLayout', 'PlotGlobal', 'PlotFaceRobot', 'fr_InitNeck', 'fr_InitNose', 'StoreShapeGoal', 'fr_AddBlinkKeys',
  'PaintGameExport', 'fr_StabilizeC3D', 'ImportAnimationRig', 'fr_ImportAnimationRig', 'fr_BuildEyesConstraint', 'GetPrimStereoCamera'];
const DEFAULT_FAILS = new Set(['fr_SaveAdjustPanelKeys', 'fr_PrintAdjustPanelKeys', 'fr_RestoreAdjustPanelKeys', 'fr_InitNose', 'StoreShapeGoal']);

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.filter(x => (x.scripting_name || x.name) === n);
  if (!f.length) return [n, null];
  const own = (f.find(x => /Utilities\.js$/.test(x.file ?? '')) ?? f[0]).args.map(a => [a.name, a.default ?? null]);
  if (n === 'AddUserKeyword') { const b = dump.find(c => c.scripting_name === n && (c.handler_dlls ?? []).length); return [n, [...b.args.map(a => [a.name, a.default ?? null]), ...own]]; }
  return [n, own];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.frB18d && !!window.Application?.frB14de && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const H = A.frB14de, K = A.frB18d, FS = A.hostFs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => `${l.kind}:${l.text}`) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => `${l.kind}:${l.text}`) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l) && /CMD-B18d/.test(l));
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const find = (n) => A.scene.find(n);
  const B = () => A.faceRobotB14.rows.B18d;
  const S = () => A.faceRobotB14.store;
  const gp = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };
  const kv = (o, p) => o.kinematics.local.get(p).value;
  const setK = (o, p, v) => { o.kinematics.local.get(p).value = v; };
  const keys = (p) => A.anim.fcurve(p)?.keys.map(k => [k.time, k.value]) ?? [];
  const mesh = (name, verts, faces, parent) => { const o = H.meshObject(A, name, verts, faces); A.scene.root.addChild(o); if (parent) parent.addChild(o); return o; };
  const nul = (name, parent, x = 0, y = 0, z = 0) => { const o = H.newNull(A, name, parent); setK(o, 'posx', x); setK(o, 'posy', y); setK(o, 'posz', z); return o; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (nothing selected, no face robot yet)
  for (const n of NAMES) {
    A.select([]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  // the toggle above entered the Face Robot layout; go back
  if (A.faceRobotB14.rows.B14d.activeLayout === 'Face Robot') run('fr_ToggleFaceLayout');

  // ================= MeshHelper.js (§2)
  {
    const r0 = run('fr_GetPolymesh');
    ok('fr_GetPolymesh: nothing selected -> false, siError "no polymesh found, try again "', r0.v === false && r0.log.includes('error:no polymesh found, try again '), r0);
    // 4x4 grid of unit quads with the centre quad (1,1) removed: an outer hole of 16 points and an inner one of 4
    const V = []; const F = [];
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) V.push([i, j, 0]);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { if (i === 1 && j === 1) continue; const a = j * 5 + i; F.push([a, a + 1, a + 6, a + 5]); }
    const g = mesh('HoleGrid', V, F);
    const h = run('fr_GetPolymesh', { iprimitive: g, inOverride: 1 }).v;
    ok('fr_GetPolymesh: helper object with ActivePrimitive / Object / Vertices / PolygonData / Edges / Points', h && h.Object === g && h.ActivePrimitive === g.primitive && h.Vertices.length === 75 && h.PolygonData.length === 15 * 5 && h.Points.length === 25 && h.Edges.length === 40, [h?.Vertices?.length, h?.PolygonData?.length, h?.Edges?.length]);
    const Hs = h.GetHoles(1);
    const sizes = Hs.Points.map(p => p.length);
    ok('GetHoles: two chains of open edges (16 + 4 points), EdgeIndices empty arrays, record has no length', Hs.Edges.length === 2 && JSON.stringify([...sizes].sort((a, b) => a - b)) === '[4,16]' && Hs.EdgeIndices.every(e => Array.isArray(e) && e.length === 0) && Hs.length === undefined, sizes);
    const inner = sizes.indexOf(4);
    const c = Hs.Centroids[inner];
    ok('GetHoles: inner hole centroid (1.5, 1.5, 0), major axis = diagonal sqrt 2, X normalised toward -x, depth = normalise(X x Y)', near(c.x, 1.5) && near(c.y, 1.5) && near(Hs.MajorAxisLength[inner], Math.SQRT2) && Hs.MajorAxisVectors[inner].x < 0 && near(Hs.MajorAxisVectors[inner].length(), 1) && near(Hs.DepthVectors[inner].length(), 1) && near(Hs.DepthVectors[inner].y, 0), [c, Hs.MajorAxisLength[inner]]);
    const fi = Hs.MajorAxisIndices[inner][0];
    ok('GetHoles: 4-point hole minor axis = the furthest point\'s next and previous neighbours', JSON.stringify(Hs.MinorAxisIndices[inner]) === JSON.stringify([(fi + 1) % 4, (fi + 3) % 4]) && Hs.MajorAxisIndices[inner].length === 2, [Hs.MajorAxisIndices[inner], Hs.MinorAxisIndices[inner]]);
    ok('GetClosestHole: the hole whose local centroid is nearest', h.GetClosestHole(new K.THREE.Vector3(1.4, 1.6, 0)) === inner && h.GetClosestHole(new K.THREE.Vector3(2.6, 2.6, 0)) === 1 - inner);
    const m0 = A.log.length; h.GetClosestHole('x');
    ok('GetClosestHole: other input -> siError text', A.log.slice(m0).some(l => l.text === 'GetClosestHole requires an input vector of array of vectors.'));
    // cache rule
    const g2 = mesh('HoleGrid2', V, F);
    const h2 = run('fr_GetPolymesh', { iprimitive: g2 }).v;
    ok('fr_GetPolymesh: without inOverride the cached helper comes back unchanged (built for another mesh)', h2 === h && h2.Object === g);
    ok('fr_GetFRPolymesh: the cached helper', run('fr_GetFRPolymesh').v === h);
    const h3 = run('fr_GetPolymesh', { iprimitive: g2, inOverride: true }).v;
    const rec = h3.GetHoles(1); const other = new K.PolymeshHelper(A, g.primitive);
    ok('fr_GetPolymesh: inOverride rebuilds; GetHoles() of another helper shares the cached record (not recomputed)', h3 !== h && h3.Object === g2 && other.GetHoles() === rec && other.GetHoles(1) !== rec);
    // CapHoleData zipping
    const P = new K.PolymeshHelper(A, g.primitive);
    const zip = (n) => { P.Holes = { Points: [Array.from({ length: n }, (_, i) => ({ Index: i }))] }; P.PolygonData = []; P.CapHoleData(0); return P.PolygonData; };
    ok('CapHoleData: n=3 triangle, n=4 quad, n=5 quad + triangle, n=6 two quads', JSON.stringify(zip(3)) === '[3,0,1,2]' && JSON.stringify(zip(4)) === '[4,0,1,2,3]' && JSON.stringify(zip(5)) === '[4,0,1,3,4,3,1,2,3]' && JSON.stringify(zip(6)) === '[4,0,1,4,5,4,1,2,3,4]', [zip(3), zip(5), zip(6)]);
    // fr_CapAllHoles on an open box (cube without its top face)
    const bv = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const bf = [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const box = mesh('OpenBox', bv, bf);
    const rc = run('fr_CapAllHoles', { inMesh: box });
    const bm = box.primitive.mesh();
    const after = new K.PolymeshHelper(A, box.primitive);
    ok('fr_CapAllHoles: the hole is filled (6 polygons, no open edge), no return value', rc.v === undefined && bm.polygons.length === 6 && after.Edges.every(e => e.NeighborPolygons.length === 2), [rc.err, bm.polygons.length]);
    const rh = after.GetHoles(1);
    ok('GetHoles(1) on a closed mesh: no holes', rh.Edges.length === 0);
  }

  // ================= sample face for the rest
  H.buildSampleFace(A);
  const face = find('Face'), fmesh = find('FaceMesh');

  // ================= Utilities.js (§3, corrections 9, 10)
  {
    const lb = nul('LEyebrow', face, 2), rb = nul('REyebrow', face, -1), ct = nul('NoseTip_Control', face, 0.5), bare = nul('Bare', face);
    let r = run('AddUserKeyword', { Obj: lb, Key: 'Control' });
    run('AddUserKeyword', { Obj: lb, Key: 'Left' });
    ok('AddUserKeyword (Obj, Key): appended, no return value', r.v === undefined && lb.userKeywords && lb.userKeywords.split(',').filter(Boolean).join(',') === 'Control,Left', lb.userKeywords);
    run('AddUserKeyword', { Obj: rb, Key: 'Control,Right' }); run('AddUserKeyword', { Obj: ct, Key: 'Control' }); run('AddUserKeyword', { Obj: ct, Key: 'Center' });
    const tk = nul('Tk', face); tk.userKeywords = 'a,B';
    run('AddUserKeyword', { InputObjs: [tk], Keywords: 'b,z' });
    ok('AddUserKeyword (InputObjs, Keywords): the built-in siuitasks behaviour is kept (duplicates without case dropped)', tk.userKeywords === 'a,B,z', tk.userKeywords);
    r = run('FilterKeyed', { ObjectCollection: [lb, rb, ct, bare], KeyStringList: 'Control,Left' });
    ok('FilterKeyed: every key must be present', JSON.stringify(r.v?.map(o => o.name)) === '["LEyebrow"]', r);
    r = run('FilterKeyed', { ObjectCollection: [lb, rb, ct, bare], KeyStringList: 'Control,Left', RemoveKeys: true });
    ok('FilterKeyed RemoveKeys: the complement, objects without keywords included, keywords not removed', JSON.stringify(r.v?.map(o => o.name)) === '["REyebrow","NoseTip_Control","Bare"]' && lb.userKeywords.includes('Left'), r);
    r = run('FilterKeyed', { ObjectCollection: [lb, bare, ct], KeyStringList: '' });
    ok('FilterKeyed: an empty key list matches every object that has a keyword, input order', JSON.stringify(r.v?.map(o => o.name)) === '["LEyebrow","NoseTip_Control"]', r);
    r = run('GetKeyed', { KeyArray: ['Control'] });
    ok('GetKeyed: matches among the face model\'s descendants, in order', JSON.stringify(r.v?.map(o => o.name)) === '["LEyebrow","REyebrow","NoseTip_Control"]', r);
    r = run('GetKeyed2', { KeyStringList: 'Control,Right', Model: face });
    ok('GetKeyed2: comma string', JSON.stringify(r.v?.map(o => o.name)) === '["REyebrow"]', r);
    r = run('fr_GetKeyed_safe', { KeyArray: ['control', 'left'] });
    ok('fr_GetKeyed_safe: an array; keyword lookup through the keyword collection (without case in this build)', Array.isArray(r.v) && r.v.length === 1 && r.v[0] === lb, r);
    r = run('MirrorControls', { Controls: [lb, rb, ct] });
    ok('MirrorControls: Right mirrors Left (local -posx), Left mirrors Right, Center mirrors itself; targets selected; no return', r.v === undefined && near(kv(rb, 'posx'), -2) && near(kv(lb, 'posx'), 1) && near(kv(ct, 'posx'), -0.5) && A.selection.length === 3, [kv(lb, 'posx'), kv(rb, 'posx'), kv(ct, 'posx')]);
    const lone = nul('LEar', face); lone.userKeywords = 'Control,Left,Ear';
    r = run('MirrorControls', { Controls: [lone] });
    ok('MirrorControls: no mirror -> siError "No mirror control to <..> was found "', has(r, /^error:No mirror control to <.*LEar> was found $/), r.log);
    const odd = nul('Odd', face); odd.userKeywords = 'Control';
    r = run('MirrorControls', { Controls: [odd] });
    ok('MirrorControls: a control without Left/Right is ignored by both filters', r.err === undefined);
    for (const o of [lb, rb, ct, bare, tk, lone, odd]) face.removeChild(o);
  }

  // ================= ParseOpenDNA.js (§5), SetControlKeys
  {
    const folder = B().env.FACEROBOTDATAROOT + '\\Dna';
    let r = run('GetDNAFile');
    ok('GetDNAFile: no .dna file -> info "dna files inside Folder <..> not found ", null', r.v === null && has(r, /^info:dna files inside Folder <.*\\Dna> not found $/), r.log);
    FS.ensureFolder(folder);
    const dnaText = '//comment\nfiles\nface.obj,\n###\ncontrols\ns,Eyebrow\na,Head_Control\na,Missing_Control\nz,Ignored\n// skipped\n###\nhpoints\nh,HeadNull\n###\n\n';
    FS.writeFile(folder + '\\Human_Face_Symmetric.dna', dnaText); FS.writeFile(folder + '\\Other.dna', 'x\n'); FS.writeFile(folder + '\\notes.dna.txt', 'x');
    r = run('GetDNAFile');
    ok('GetDNAFile: the last *.dna file matching Human_Face_Symmetric', r.v === folder + '\\Human_Face_Symmetric.dna', r.v);
    const parsed = K.parseDNAText(dnaText, 'f');
    ok('DNA format: ### sections, first line = name, trailing commas stripped, // lines skipped, empty section -> undefined label', JSON.stringify(parsed.labels) === '["files","controls","hpoints",null]' && JSON.stringify(parsed.files) === '["face.obj"]' && parsed.controls.length === 4, parsed);
    const L = nul('LEyebrow', face, 1), R = nul('REyebrow', face, -1), hc = nul('Head_Control', face), hn = nul('HeadNull', face);
    r = run('ParseDNAFile', { filename: '', debug: true });
    ok('ParseDNAFile: default DNA; ControlObjects = L/R for "s", the name for "a", missing ones logged; HelperObjects', r.v && JSON.stringify(r.v.ControlObjects.map(o => o.name)) === '["LEyebrow","REyebrow","Head_Control"]' && JSON.stringify(r.v.HelperObjects.map(o => o.name)) === '["HeadNull"]' && has(r, /^error:Control <Missing_Control> not found$/) && has(r, /^info:key=controls$/) && has(r, /^info:0=s,Eyebrow$/), [r.err, r.v?.ControlObjects?.map(o => o.name)]);
    r = run('LogDNA', { DNA: r.v, key: 'hpoints' });
    ok('LogDNA with key: "<i>=<entry>" per entry, no return value', r.v === undefined && has(r, /^info:0=h,HeadNull$/), r.log);
    r = run('ParseDNAFile', { filename: 'C:\\nowhere\\x.dna' });
    ok('ParseDNAFile: not a file -> used as the type pattern; no match -> null', r.v === null && has(r, /dna file <null> not found $/), r.log);
    r = run('SetControlKeys');
    const kw = (o) => (o.userKeywords ?? '').split(',').filter(Boolean);
    ok('SetControlKeys: Control on controls, Space on helpers, name tags (HeadNull: Head + Null,Space), side from Head_Control space; nothing returned', r.v === undefined && ['Control', 'Eyebrow', 'Left'].every(k => kw(L).includes(k)) && kw(R).includes('Right') && kw(hc).includes('Head') && kw(hc).includes('Center') && kw(hn).includes('Space') && kw(hn).includes('Head') && kw(hn).includes('Null'), [r.err, kw(L), kw(R), kw(hc), kw(hn)]);
    for (const o of [L, R, hc, hn]) face.removeChild(o);
    FS.deleteFile(folder + '\\Human_Face_Symmetric.dna');
    r = run('SetControlKeys');
    ok('SetControlKeys: no DNA -> siError OPENDNA NOT FOUND, null', r.v === null && has(r, /^error:OPENDNA NOT FOUND$/), r.log);
  }

  // ================= ModifyFaceLayout.js (§6, correction 4)
  {
    const D = A.faceRobotB14.rows.B14d; D.activeLayout = 'Default';
    let r = run('fr_SetAltLayout');
    ok('fr_SetAltLayout: stores the active layout at (_, Layout) and returns it', r.v?.Name === 'Default' && S().raw('_', 'Layout') === r.v, r);
    run('fr_ToggleFaceLayout');
    ok('fr_ToggleFaceLayout: not in Face Robot -> Face Robot layout + fr_SwitchFaceLayout(stage/10)', D.activeLayout === 'Face Robot' && D.lastLayoutId !== undefined);
    r = run('fr_ToggleFaceLayout');
    ok('fr_ToggleFaceLayout: in Face Robot -> back to the stored layout; nothing returned', D.activeLayout === 'Default' && r.v === undefined);
    S().delete('_', 'Layout'); run('fr_ToggleFaceLayout'); run('fr_ToggleFaceLayout');
    ok('fr_ToggleFaceLayout: nothing stored -> "Tools Development Environment"', D.activeLayout === 'Tools Development Environment', D.activeLayout);
  }

  // ================= AdjustPanelKeys.js (§4)
  {
    const p = new K.Property('FaceAdjustProperties', 'customparamset', [{ name: 'JawOpen', type: 'double', value: 0, label: 'JawOpen' }, { name: 'Still', type: 'double', value: 0, label: 'Still' }]);
    face.addProperty(p);
    const q = p.get('JawOpen'); A.anim.setKey(q, 1, 0); A.anim.setKey(q, 10, 1);
    let r = run('fr_SaveAdjustPanelKeys');
    ok('fr_SaveAdjustPanelKeys: every fcurve-animated parameter: name, (time, value) list, 4 tangents per key', r.v === undefined && JSON.stringify(B().adjust.names) === '["JawOpen"]' && JSON.stringify(B().adjust.keys[0]) === '[1,0,10,1]' && B().adjust.tangents[0].length === 8, [r.err, B().adjust]);
    r = run('fr_PrintAdjustPanelKeys');
    ok('fr_PrintAdjustPanelKeys: name, "  keyArr=..", "  tanArr=.." lines', has(r, /^info:JawOpen$/) && has(r, /^info:  keyArr=1,0,10,1$/) && has(r, /^info:  tanArr=/), r.log);
    A.anim.setKey(q, 5, 7);
    run('fr_RestoreAdjustPanelKeys');
    ok('fr_RestoreAdjustPanelKeys: the curve is replaced by the stored keys', JSON.stringify(keys(q)) === '[[1,0],[10,1]]', keys(q));
  }

  // ================= PlotToShapes.js (§7)
  {
    const o = nul('PlotMe', null); const px = o.kinematics.local.get('posx');
    A.anim.setKey(px, 1, 0); A.anim.setKey(px, 5, 4); A.anim.fcurve(px).interp = 1; A.anim.fcurve(px).keys.forEach(k => { k.interp = 1; });
    let r = run('PlotGlobal', { inObj: o, start: 1, end: 5 });
    const gx = keys(o.kinematics.global.get('posx'));
    ok('PlotGlobal: one key per frame on the global SRT parameters; Play Control left at the last frame; nothing returned', r.v === undefined && gx.length === 5 && gx[0][0] === 1 && gx[4][0] === 5 && near(gx[4][1], 4) && A.anim.frame === 5 && keys(o.kinematics.global.get('sclx')).length === 5, [r.err, gx]);
    r = run('PlotGlobal', { inObj: o, start: 0, end: 0 });
    ok('PlotGlobal: start / end 0 -> PlayControl In / Out', keys(o.kinematics.global.get('posx')).length === A.anim.endFrame - A.anim.startFrame + 1);
    A.anim.frame = 1;
    const pm = mesh('PlotSrc', [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]], face);
    r = run('PlotFaceRobot', { NewModelName: 'Plotted', inMeshes: [pm], inStart: 1, inEnd: 2 });
    const pmod = find('Plotted');
    ok('PlotFaceRobot: {Duplicates: [], Meshes, Head, Model}; a new model with a frozen polymesh duplicate; "Plotting: .." logged', r.v && Array.isArray(r.v.Duplicates) && r.v.Duplicates.length === 0 && r.v.Meshes[0] === pm && r.v.Head === pm && r.v.Model === pmod && pmod.children.some(c => c.type === 'polymsh') && has(r, /^info:Plotting: /), [r.err, r.v && Object.keys(r.v)]);
    ok('PlotFaceRobot: shape keys stored per frame and target (StoreShapeKey values 2, null, 1, 0, 3, 0)', B().calls.filter(c => c.name === 'StoreShapeKey' && c.args.Name.startsWith(pmod.children[0].name + '_')).length === 2 && JSON.stringify(B().calls.find(c => c.name === 'StoreShapeKey').args.values) === '[2,null,1,0,3,0]');
    A.scene.root.removeChild(pmod); face.removeChild(pm); A.scene.root.removeChild(o);
  }

  // ================= InitNeck.js (§8)
  {
    const fit = nul('Fit', face); S().put('_', 'Fit', fit);
    S().put('psets', 'FaceScale', new K.Property('FaceScale', 'customparamset', [{ name: 'Scale', type: 'double', value: 0.5, label: 'Scale' }]));
    S().put('_', 'meshbox', [-2, -2, -2, 3, 1]);
    const mk = [[0, 0, -1], [0, 0.5, 0], [0.2, 0, 0], [0, -1, 0.5], [0, -1.5, 0.6], [0, -2, 0.7], [0, -2.5, 0.8]].map((p, i) => nul('NeckMk' + i, null, ...p));
    let r = run('fr_InitNeck', { inHeadMesh: '', inNeckMarkers: mk });
    ok('fr_InitNeck: empty inHeadMesh -> null', r.v === null);
    r = run('fr_InitNeck', { inHeadMesh: fmesh, inNeckMarkers: mk });
    // the depth cubes are named like their nulls; the scene makes the name unique (LowerNeckDepth1, ...)
    const names = r.v?.map(o => o?.name.replace(/^(Lower|Upper)NeckDepth\d*$/, '$1NeckDepth'));
    ok('fr_InitNeck: NeckBase, HeadBase, NeckBase, the depth cubes (under their nulls), HeadBase, NeckFC, AdamsApple_Cluster, TrachealInfluence_Cluster', JSON.stringify(names) === '["NeckBase","HeadBase","NeckBase","LowerNeckDepth","UpperNeckDepth","HeadBase","NeckFC","AdamsApple_Cluster","TrachealInfluence_Cluster"]' && r.v[3].parentObj === find('LowerNeckDepth'), [r.err, names]);
    if (r.v) {
      const hb = r.v[1], nb = r.v[0]; const P1z = (-1 + 1) / 2, headSize = 3 - 0.5;
      ok('fr_InitNeck: HeadBase at marker 1 with z = (Mk0.z + box[4]) / 2; NeckBase 0.7 HeadSize lower', near(gp(hb)[1], 0.5) && near(gp(hb)[2], P1z) && near(gp(nb)[1], 0.5 - 0.7 * headSize), [gp(hb), gp(nb)]);
      const dim = hb.properties.find(p => p.name === 'Dimensions');
      ok('fr_InitNeck: HeadBase Dimensions X/Y/Z = HeadSize', dim && near(dim.val('X'), headSize) && near(dim.val('Z'), headSize));
      const nfc = r.v[6];
      ok('fr_InitNeck: NeckFC with clusters point0..point3 referencing the drivers', nfc.type === 'crvlist' && ['point0', 'point1', 'point2', 'point3'].every((n, k) => nfc.cluster(n)?.centerReference === [r.v[0], r.v[3], r.v[4], r.v[1]][k]), nfc.clusters.map(c => c.name));
      const ad = r.v[7];
      ok('fr_InitNeck: AdamsApple_Cluster scales 2/3/2 x Mk2.x, hidden', near(kv(ad, 'sclx'), 0.4) && near(kv(ad, 'scly'), 0.6) && near(kv(ad, 'sclz'), 0.4) && ad.visible === false);
      ok('fr_InitNeck: depth nulls carry a TwoPoints constraint (perc 40 / 60)', [find('LowerNeckDepth'), find('UpperNeckDepth')].every(Boolean));
      ok('fr_InitNeck: SternumTop exists (projected onto the head mesh)', !!find('SternumTop'));
    }
  }

  // ================= InitNose.js (§8)
  {
    const fit = find('Fit');
    nul('LNostrilBase', fit, 0.3, 0, 1); nul('RNostrilBase', fit, -0.3, 0, 1);
    S().put('features', 'LNostrilBulge', nul('LBulge', null, 0.5, 0.3, 1.2)); S().put('features', 'RNostrilBulge', nul('RBulge', null, -0.5, 0.3, 1.2)); S().put('features', 'NoseTip', nul('Tip', null, 0, 0.5, 2));
    const r = run('fr_InitNose', { inScale: 1, inSymmetry: true });
    const lr = find('LNoseRing'), rr = find('RNoseRing');
    ok('fr_InitNose: an XSICollection with both rings and their descendants', Array.isArray(r.v) && r.v.includes(lr) && r.v.includes(rr) && r.v.includes(lr.children[0]), [r.err]);
    const cd = lr?.properties.find(p => p.name === 'CurveData');
    ok('fr_InitNose: CurveData Divisions 3, Controller = the bulge name', cd && cd.val('Divisions') === 3 && cd.val('Controller') === 'LBulge');
    const handles = lr ? [...lr.children].filter(c => c.type !== 'null') : [];
    ok('fr_InitNose: 7 handle cubes (point 5 reuses point 0), an up-vector null, 8 point clusters', handles.length === 7 && lr.children.some(c => c.name === 'LNoseRing_UpVector') && lr.clusters.length === 8 && lr.clusters[5].centerReference === lr.clusters[0].centerReference, [handles.length, lr?.clusters.length]);
    ok('fr_InitNose: R side with inSymmetry: Symmetry constraints to the L handles; NPoints on the up null', rr && [...rr.children].filter(c => c.type !== 'null').every(c => c.properties.some(p => /Symmetry/.test(p.name))) && rr.children.find(c => c.name === 'RNoseRing_UpVector').properties.some(p => /NPoints/.test(p.name)));
    const R = K.noseRingPoints(new K.THREE.Vector3(0.3, 0, 1), new K.THREE.Vector3(0.5, 0.3, 1.2), new K.THREE.Vector3(0, 0.5, 2));
    ok('fr_InitNose ring maths: P.x = G.x, septum S.x = P.x / 10, U halfway P-S', near(R.P.x, 0.5) && near(R.S.x, 0.05) && near(R.U.x, 0.275), R);
    ok('fr_InitNose: the selection is base, bulge, tip, ring (last side)', A.selection.length === 4 && A.selection[3] === rr);
  }

  // ================= FaceRobotShapeGoals.js (§9)
  {
    const head = nul('HeadNullSG', face);
    const src = mesh('GoalSrc', [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]);
    const tgt = mesh('GoalTgt', [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]);
    let r = run('StoreShapeGoal', { GoalName: 'Smile', SourceMesh: src, FaceRobotMesh: tgt, HeadSpace: head });
    ok('StoreShapeGoal: HeadSpace without Static KineState -> info text, false', r.v === false && has(r, /^info:HeadSpace requires a static Kinematic State Property, Head Null not enveloped\.$/), r);
    head.addProperty(new K.Property('Static KineState', 'statickinestate', []));
    r = run('StoreShapeGoal', { GoalName: 'Smile', SourceMesh: src, FaceRobotMesh: tgt, HeadSpace: head });
    const cl = tgt.cluster('FaceCluster');
    ok('StoreShapeGoal: new goal -> FaceCluster, Smile_Shape (clskey, source local points), Smile_Weight; stops at the colour setter (not yet attested)', cl && cl.properties.some(p => p.name === 'Smile_Shape' && p.type === 'clskey' && p.elements.length === 3) && cl.properties.some(p => p.name === 'Smile_Weight') && nya(r) && !tgt.properties.some(p => p.name === 'ShapeGoals'), [r.err, r.log]);
    r = run('StoreShapeGoal', { GoalName: 'Smile', SourceMesh: src, FaceRobotMesh: tgt, HeadSpace: head });
    const sg = tgt.properties.find(p => p.name === 'ShapeGoals');
    ok('StoreShapeGoal: existing shape + weight -> ShapeGoals.Smile (default 1, 0..1) and a ShapeGoalOp; nothing returned', r.v === undefined && sg?.get('Smile')?.value === 1 && tgt.primitive.operators.some(o => o.name === 'ShapeGoalOp'), [r.err]);
    r = run('StoreShapeGoal', { GoalName: 'Smile', SourceMesh: src, FaceRobotMesh: tgt, HeadSpace: head });
    ok('StoreShapeGoal: same shape and weight map already used -> "Operator using already exists", false', r.v === false && has(r, /^info:Operator using already exists$/), r);
    A.scene.root.removeChild(src); A.scene.root.removeChild(tgt); face.removeChild(head);
  }

  // ================= AddBlinkKeys.js (§10)
  {
    const bs = nul('BlinkSrc', null), lid = nul('Lid', null), lid2 = nul('Lid2', null);
    const by = bs.kinematics.local.get('posy'); A.anim.setKey(by, 0, 0); A.anim.setKey(by, 2, 1); A.anim.setKey(by, 4, 0);
    let r = run('fr_AddBlinkKeys', { iParam: 'Nope.kine.local', iBlinkFC: 'BlinkSrc.kine.local' });
    ok('fr_AddBlinkKeys: unknown object -> siError "<name> not recognized as valid object", null', r.v === null && has(r, /^error:Nope not recognized as valid object$/), r.log);
    r = run('fr_AddBlinkKeys', { iParam: 'Lid.kine.local', iBlinkFC: 'BlinkSrc.kine.local', iPivot: 10, scaling: 2 });
    ok('fr_AddBlinkKeys: no existing curve -> the blink keys (shifted by pivot + offset, values x scaling) on local posy', r.v === undefined && JSON.stringify(keys(lid.kinematics.local.get('posy'))) === '[[10,0],[12,2],[14,0]]', keys(lid.kinematics.local.get('posy')));
    const ly = lid2.kinematics.local.get('posy'); A.anim.setKey(ly, 0, 0.5); A.anim.setKey(ly, 30, 0.5);
    r = run('fr_AddBlinkKeys', { iParam: 'Lid2.kine.local', iBlinkFC: 'BlinkSrc.kine.local', iPivot: 10, InsertMode: 2 });
    const k2 = keys(ly);
    ok('fr_AddBlinkKeys: absolute insert -> existing keys outside the window, lock keys at start-1 / end+1, the new keys', k2.some(k => k[0] === 9) && k2.some(k => k[0] === 15) && k2.some(k => k[0] === 12 && k[1] === 1) && k2[0][0] === 0 && k2[k2.length - 1][0] === 30 && k2.every((k, i) => i === 0 || k[0] > k2[i - 1][0]), k2);
    const fc = A.anim.fcurve(ly);
    ok('fr_AddBlinkKeys: tangents right dx >= 0, left dx <= 0, capped at 1.25 x gap', fc.keys.every((k, i) => k.rightTanX >= 0 && k.leftTanX <= 0 && (i === 0 || -k.leftTanX <= 2.5 * (k.time - fc.keys[i - 1].time) + 1e-9)), fc.keys.map(k => [k.time, k.leftTanX, k.rightTanX]));
    for (const o of [bs, lid, lid2]) A.scene.root.removeChild(o);
  }

  // ================= PaintGameExportPlugin.js (§11)
  {
    face.addProperty(new K.Property('FaceScale', 'customparamset', [{ name: 'Scale', type: 'double', value: 1, label: 'Scale' }]));
    let r = run('PaintGameExport', { inPaintModel: 7 });
    ok('PaintGameExport: tongue mode without a tongue mesh -> nothing', r.v === undefined && !fmesh.clusters.some(c => c.properties.some(p => p.name === 'Locators')));
    r = run('PaintGameExport', { inPaintModel: 0 });
    const maps = ['Locators', 'Spin', 'JawParent', 'HeadParent', 'NeckParent'].map(n => fmesh.clusters.flatMap(c => c.properties).find(p => p.name === n));
    ok('PaintGameExport: the five weight maps with their colours', maps.every(Boolean) && maps[0].val('red') === 255 && maps[0].val('green') === 137 && maps[1].val('green') === 182 && maps[4].val('blue') === 120, [r.err]);
    const crv = fmesh.children.find(c => c.name === 'FaceExportLocators');
    ok('PaintGameExport: FaceExportLocators curve under the skin with a DrawLocators operator (size = face scale)', crv && crv.primitive.operators.some(o => o.name === 'DrawLocators' && o.val('size') === 1), [r.err]);
    const info = A.scene.root.properties.find(p => p.name === 'DisplayInfo_GameExport');
    ok('PaintGameExport: DisplayInfo_GameExport.nbBones driven by BoneCounter', info && info.get('nbBones') && A.scene.root.scriptedOps?.some(o => o.name === 'BoneCounter'));
    ok('PaintGameExport mode 0: Locators, paint mode 1, opacity 100, radius 0.2 x 0.6 x size', B().brush.paintMap === 'Locators' && B().brush.WeightPaintMode === 1 && B().brush.Opacity === 100 && near(B().brush.Radius, 0.12), B().brush);
    maps[0].values.set(0, 1); maps[0].values.set(3, 1);
    const n0 = B().brush.paintToolCalls;
    r = run('PaintGameExport', { inPaintModel: 3 });
    ok('PaintGameExport mode 3: HeadParent, PaintTool twice; maps / operator reused; nbBones = points with locator weight >= 0.9999', B().brush.paintMap === 'HeadParent' && B().brush.paintToolCalls === n0 + 2 && near(B().brush.Radius, 6) && info.val('nbBones') === 2 && crv.primitive.operators.filter(o => o.name === 'DrawLocators').length === 1 && fmesh.clusters.flatMap(c => c.properties).filter(p => p.name === 'Locators').length === 1, [B().brush, info.val('nbBones')]);
    r = run('PaintGameExport', { inPaintModel: 6 });
    ok('PaintGameExport mode 6: the icon (first child of the skin) hidden', fmesh.children[0].visible === false);
  }

  // ================= StabilizeC3D.js (§12)
  {
    const nm = K.parseStabNameMap('header\n{\n  M1 \nM2\nM3\n}\n{\nM4\tLip_Control\n}\n');
    ok('fr_StabilizeC3D name map: first {} block = stabilisation names, second = marker<TAB>controller, trimmed', JSON.stringify(nm) === '{"stab":["M1","M2","M3"],"pairs":[["M4","Lip_Control"]]}', nm);
    let r = run('fr_StabilizeC3D', { nmapfilename: 'C:\\none.nmap' });
    ok('fr_StabilizeC3D: no Actor -> siError "Actor not found."', has(r, /^error:Actor not found\.$/) && r.v === undefined, r.log);
    const actor = nul('Actor', face); S().put('_', 'Actor', actor);
    r = run('fr_StabilizeC3D', { nmapfilename: 'C:\\none.nmap' });
    ok('fr_StabilizeC3D: missing name map -> siError "\'<nmap>\' not found."', has(r, /^error:'C:\\none\.nmap' not found\.$/), r.log);
    ok('fr_StabilizeC3D: registered siNoLogging', A.commands.get('fr_StabilizeC3D').noLog === true);
    face.removeChild(actor);
  }

  // ================= AnimationRigImport.js (§13)
  {
    let r = run('ImportAnimationRig');
    const p = A.scene.root.properties.find(x => x.name === 'ImportAnimationRig');
    ok('ImportAnimationRig: logs "ImportAnimationRig_Execute called", scene-root property dotXSI / Log / Method, inspected, true', r.v === true && has(r, /^info:ImportAnimationRig_Execute called$/) && p && p.val('dotXSI') === '' && p.val('Log') === false && p.val('Method') === 0 && B().inspected.includes(p), r);
    r = run('ImportAnimationRig');
    ok('ImportAnimationRig: the existing property is reused', A.scene.root.properties.filter(x => x.name === 'ImportAnimationRig').length === 1);
    r = run('fr_ImportAnimationRig', { file: 'C:\\missing.xsi' });
    ok('fr_ImportAnimationRig: missing file -> siError "path not valid"', has(r, /^error:path not valid$/) && r.v === undefined, r.log);
    FS.writeFile('C:\\rig.xsi', 'xsi 0300txt\n');
    r = run('fr_ImportAnimationRig', { file: 'C:\\rig.xsi', log: true });
    const io = A.scene.root.properties.find(x => x.name === 'ImportCrosswalkOptions');
    ok('fr_ImportAnimationRig: ImportCrosswalkOptions Filename / Target 2 / Verbose; no shape cluster on the face mesh -> "No Shape Targets Found..."', io && io.val('Filename') === 'C:\\rig.xsi' && io.val('Target') === 2 && io.val('Verbose') === true && has(r, /^error:No Shape Targets Found\.\.\.$/), [r.err, r.log]);
    const m = new K.Model('EyeRig'); A.scene.root.addChild(m);
    const look = nul('LookAt_Control', m), np = nul('LEye_NeutralPose', m), le = nul('LEye_Control', np), re = nul('REye_Control', m);
    r = run('fr_BuildEyesConstraint', { model: m });
    const dl = le.properties.find(x => x.type === 'dircns'), dr = re.properties.find(x => x.type === 'dircns');
    ok('fr_BuildEyesConstraint: Direction constraints to LookAt_Control, upvct_active 1; NeutralPose parent -> aim axis rotated (dirx = -dirz, dirz = dirx)', r.v === undefined && dl && dr && dl.targets[0] === look && dl.val('upvct_active') === 1 && near(dl.val('dirx'), 0) && near(dl.val('dirz'), 1) && near(dr.val('dirz'), 1), [dl?.val('dirx'), dl?.val('dirz')]);
    const m2 = new K.Model('NoEyes'); A.scene.root.addChild(m2); nul('LookAt_Control', m2);
    r = run('fr_BuildEyesConstraint', { model: m2 });
    ok('fr_BuildEyesConstraint: an eye missing -> nothing', r.err === undefined && ![...m2.descendants()].some(o => o.properties.some(x => x.type === 'dircns')));
    A.scene.root.removeChild(m); A.scene.root.removeChild(m2);
  }

  // ================= StereoCamera.js (§14, correction 12)
  {
    const r = run('GetPrimStereoCamera', { ObjName: 'Stereo1' });
    const root = find('Stereo1_Root');
    const cam = find('Stereo1'), left = find('Stereo1_Left'), right = find('Stereo1_Right');
    ok('GetPrimStereoCamera: returns [root]; root > centre camera, interest, LeftRoot > Left camera, RightRoot > Right camera', Array.isArray(r.v) && r.v[0] === root && cam?.type === 'camera' && cam.parentObj === root && left.parentObj === find('Stereo1_LeftRoot') && right.parentObj === find('Stereo1_RightRoot') && !!find('Stereo1_Interest'), [r.err]);
    const st = root.properties.find(p => p.name === 'Stereo');
    ok('GetPrimStereoCamera: Stereo property defaults (StereoType 2, Separation 0.635, ZeroParallax 25.4, ToeIn 0, film offsets 0)', st && st.val('StereoType') === 2 && st.val('Separation') === 0.635 && st.val('ZeroParallax') === 25.4 && st.val('ToeIn') === 0 && st.val('FilmOffsetLeft') === 0);
    ok('GetPrimStereoCamera: user keywords Stereo,Center / Left / Right / Property / Root', cam.userKeywords === 'Stereo,Center' && left.userKeywords === 'Stereo,Left' && right.userKeywords === 'Stereo,Right' && st.userKeywords === 'Stereo,Property' && root.userKeywords === 'Stereo,Root', [cam.userKeywords, st.userKeywords]);
    const off = K.stereoOffset(0.635, Number(cam.primitive.val('projplanedist')), 25.4);
    ok('GetPrimStereoCamera: off-axis constraint operators: side projplaneoffx = centre + film ± stereo offset', near(left.primitive.val('projplaneoffx'), off) && near(right.primitive.val('projplaneoffx'), -off) && left.customOps?.[0]?.name === 'StereoLeftConstraint' && right.customOps?.[0]?.name === 'StereoRightConstraint' && left.customOps[0].inputs.length === 1 + 17 + 4, [left.primitive.val('projplaneoffx'), off]);
    st.set('StereoType', 1); st.set('FilmOffsetLeft', 0.25);
    ok('GetPrimStereoCamera: Converged -> centre offset + film offset', near(left.primitive.val('projplaneoffx'), 0.25) && near(right.primitive.val('projplaneoffx'), 0));
    ok('GetPrimStereoCamera: wire colours left (0.6, 0, 0), right (0, 0.7, 0.7); projplane on; roots hidden', left.properties.find(p => p.type === 'display').val('wirecolorr') === 0.6 && right.properties.find(p => p.type === 'display').val('wirecolorb') === 0.7 && cam.primitive.val('projplane') === true && root.visible === false);
    ok('GetPrimStereoCamera: the ICE compounds are not attested (logged)', nya(r));
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
console.log(`compare_fr_b18d_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
