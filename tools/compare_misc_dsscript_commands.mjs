// CMD-B5f: the 18 miscellaneous DSScripts commands on the command bus (draw / duplicate tools, unhide polygons,
// AppendBone, SymEnvWeight, SelectUVRow, SetKeyableAttributes, retarget, pin, shot cameras, user data).
// Checked against the "Wire contract" of docs/ghidra/cmd-b5f-misc-dsscripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated results.
// Interactive commands are driven through their pick session (app.miscDsScripts.session.pick(value, button, modifier)).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_misc_dsscript_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

// scripting name -> registry display name of the entry that is registered (the scripted / generic one)
const LABELS = {
  DuplicateTool: 'Duplicate Tool', DrawPrimitiveTool: 'Draw Primitive Tool', DrawImplicitPrimitiveTool: 'Draw Implicit Primitive Tool',
  DrawNullTool: 'Null Tool', UnhideAllPolygons: 'Unhide All Polygons', UnhideAllPolygonClusters: 'Unhide All Polygon Clusters',
  AppendBone: 'Append Bone', SymEnvWeight: 'Apply Symmetry on Envelope Weight', SelectUVRow: 'Select UV Row',
  SetKeyableAttributes: 'Set Keyable Attributes', RetargetRigToRig: 'RetargetRigToRig', RetargetTagRig: 'RetargetTagRig',
  TogglePinObjectInPosition: 'Toggle Pin Object in Position', CreateShotCamera: 'Create Camera Without interest',
  CreateShotCameraAndSwitch: 'Create Camera without Interest and Switch', GetPrimCameraWithoutInterest: 'Camera Perspective Without Interest',
  CreateUserDataMap: 'Create User Data Property', SIInspectUserData: 'Low Level Inspect User Data Command',
};
const NAMES = Object.keys(LABELS);

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = list.find(x => x.scripting_name === n && x.name === LABELS[n]);
  return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SIInspectUserData'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.miscDsScripts; const root = app.scene.root;
  const out = {};
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.name}` : typeof v.then === 'function' ? '<promise>' : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const pub = (r) => r.err !== undefined ? { err: r.err } : { v: r.v };
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const cmdsFrom = (i) => app.log.slice(i).filter(l => l.kind === 'cmd').map(l => l.text.split(' ')[0]);
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
  const find = (n) => app.scene.find(n);
  const names = () => [...app.scene.allObjects()].map(o => o.name);
  const pos = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]].map(x => Math.round(x * 1e4) / 1e4); };
  const lpos = (o) => ['posx', 'posy', 'posz'].map(n => Math.round(o.kinematics.local.val(n) * 1e4) / 1e4);
  const sess = () => S.session ? { command: S.session.command, kind: S.session.kind, filter: S.session.filter, prompt: S.session.prompt, middle: S.session.middlePrompt, tool: app.activeTool?.name ?? null } : null;
  const endSession = () => { S.session?.pick(null, 0); return [S.session === null, app.activeTool === null]; };
  const q = (s) => document.querySelector(s);
  const Property = root.properties[0].constructor;
  const mkProp = (name, type, defs) => new Property(name, type, defs);
  const cube = find('cube'), sphere = find('sphere');
  app.autoInspect = false;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.labels = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.label ?? null]));

  // ---- every command with default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) {
    app.select([]); app.compSel = null; const m = mark(); const before = names().length;
    const r = run(n); const session = sess(); const ended = S.session ? endSession() : null;
    await tick(5);
    out.defaults[n] = { r: pub(r), log: logFrom(m), session, ended, made: names().length - before };
    try { app.run('SetSelFilter', { SelFilter: 'object' }); } catch { /* ignore */ }
  }

  // ================= DuplicateTool
  {
    const d = {}; const child = run('GetPrim', { PresetObj: 'Null', Name: 'dupChild' }).raw; run('ParentObj', { Parent: 'cube', Children: 'dupChild' });
    d.childParent = child.parentObj.name;
    const before = new Set(names()); const m = mark();
    d.run = pub(run('DuplicateTool', { SelectionList: 'sphere,dupChild' }));
    d.session = sess();
    S.session.pick([1, 2, 3], 1, 0);
    const first = names().filter(n => !before.has(n));
    d.first = first.map(n => [find(n).parentObj === root, lpos(find(n))]);
    d.cmds = cmdsFrom(m);
    S.session.pick([4, 5, 6], 1, 0);
    const second = names().filter(n => !before.has(n) && !first.includes(n));
    d.second = second.map(n => [find(n).parentObj === root, lpos(find(n))]);
    d.stillActive = S.session?.active === true;
    d.ended = endSession();
    // DynamicsInitState follows the picked position
    const dyn = mkProp('DynamicsInitState', 'dyninit', [{ name: 'posx', type: 'double', value: 0 }, { name: 'posy', type: 'double', value: 0 }, { name: 'posz', type: 'double', value: 0 }]);
    sphere.addProperty(dyn); const b2 = new Set(names());
    run('DuplicateTool', { SelectionList: 'sphere' }); S.session.pick([7, 8, 9], 1, 0); endSession();
    const c3 = find(names().find(n => !b2.has(n)));
    const cd = c3?.properties.find(p => p.name === 'DynamicsInitState');
    d.dyn = cd ? ['posx', 'posy', 'posz'].map(n => cd.val(n)) : 'copy has no DynamicsInitState property';
    sphere.removeProperty(dyn);
    out.dup = d;
  }

  // ================= draw tools
  {
    const d = {}; let m = mark();
    run('DrawPrimitiveTool', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'drawn' });
    d.session = sess();
    S.session.pick([1, 0, 2], 1, 0);
    const o = find('drawn'); d.made = o ? [o.type, o.parentObj === root, lpos(o), app.selection.includes(o)] : null;
    d.cmds = cmdsFrom(m);
    S.session.pick([3, 0, 4], 1, 0); d.second = find('drawn1') ? lpos(find('drawn1')) : null;
    d.ended = endSession();
    run('DrawPrimitiveTool', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'drawnSurf' }); S.session.pick([0, 1, 0], 1, 0); endSession();
    d.surface = find('drawnSurf') ? [find('drawnSurf').type, lpos(find('drawnSurf'))] : null;
    // implicit tools: Name and Parent are ignored
    let before = new Set(names()); m = mark();
    run('DrawNullTool', { Name: 'ignoredName', Parent: 'cube' }); d.nullSession = sess();
    S.session.pick([5, 6, 7], 1, 0); endSession();
    let made = names().filter(n => !before.has(n)).map(find);
    d.nullMade = made.map(x => [x.type, /^null\d*$/.test(x.name), x.parentObj === root, lpos(x)]);
    d.nullCmds = cmdsFrom(m);
    before = new Set(names());
    run('DrawImplicitPrimitiveTool', { PresetObj: 'Null', Name: 'ignoredName', Parent: 'cube' }); d.implSession = sess();
    S.session.pick([-1, -2, -3], 1, 0); endSession();
    made = names().filter(n => !before.has(n)).map(find);
    d.implMade = made.map(x => [x.type, /^null\d*$/.test(x.name), x.parentObj === root, lpos(x)]);
    // batch mode: the pick is cancelled
    app.Interactive = false; m = mark(); const n0 = names().length;
    d.batch = [pub(run('DrawNullTool')), S.session === null, names().length - n0, logFrom(m).some(l => /not yet attested: picking without a user session/.test(l))];
    app.Interactive = true;
    out.draw = d;
  }

  // ================= UnhideAllPolygons / UnhideAllPolygonClusters
  {
    const d = {}; d.constant = S.invisiblePolygonsClusterName;
    app.selectComponents(cube, 'polygon', [0, 1]); const hidden = run('CreateCluster', { Name: S.invisiblePolygonsClusterName }).raw;
    app.selectComponents(cube, 'polygon', [2]); const other = run('CreateCluster', { Name: 'keepMe' }).raw;
    d.hiddenName = hidden.name;
    const vis = (v) => mkProp('Cluster Visibility', 'clustervis', [{ name: 'viewvis', type: 'bool', value: v }, { name: 'rendvis', type: 'bool', value: v }]);
    const hv = vis(false), ov = vis(false); hidden.addProperty(hv); other.addProperty(ov);
    const viewOnly = mkProp('Cluster Visibility', 'clustervis', [{ name: 'viewvis', type: 'bool', value: false }]);
    app.setSelMode('object'); app.select([cube]);
    // clusters first: the internal cluster is re-shown and kept
    d.clusters = pub(run('UnhideAllPolygonClusters'));
    d.afterClusters = [hv.val('viewvis'), hv.val('rendvis'), ov.val('viewvis'), ov.val('rendvis'), cube.clusters.includes(hidden), cube.clusters.includes(other)];
    other.addProperty(viewOnly); d.viewOnly = [pub(run('UnhideAllPolygonClusters')), viewOnly.val('viewvis')]; other.removeProperty(viewOnly);
    app.select([sphere]); d.noCluster = pub(run('UnhideAllPolygonClusters'));
    app.select([cube]);
    d.polys = pub(run('UnhideAllPolygons'));
    d.afterPolys = [cube.clusters.includes(hidden), cube.clusters.includes(other), app.selection.length === 1 && app.selection[0] === cube];
    app.undo(); d.undo = cube.clusters.includes(hidden); app.redo();
    d.again = [pub(run('UnhideAllPolygons')), cube.clusters.includes(other)];
    // a sub-component selection resolves to its owning object; a property resolves to its parent object
    app.selectComponents(cube, 'polygon', [3]); run('CreateCluster', { Name: S.invisiblePolygonsClusterName });
    app.selectComponents(cube, 'polygon', [4]); run('UnhideAllPolygons'); d.fromComponents = !cube.cluster(S.invisiblePolygonsClusterName);
    app.selectComponents(cube, 'polygon', [3]); run('CreateCluster', { Name: S.invisiblePolygonsClusterName });
    app.setSelMode('object'); app.select([cube.properties[0]]); run('UnhideAllPolygons'); d.fromProperty = !cube.cluster(S.invisiblePolygonsClusterName);
    out.unhide = d; out._other = other.name;
    app.select([]);
  }

  // ================= AppendBone
  {
    const d = {};
    const chain = run('Create2DSkeleton', { Points: [[0, 0, 0], [2, 0, 0]] }).raw; const eff = chain.effector; const bone1 = chain.bones[0];
    app.select([bone1]); let m = mark();
    d.noEffector = [pub(run('AppendBone', { Ex: 4 })), logFrom(m, ['error'])];
    app.select([eff]); m = mark();
    const r = run('AppendBone', { Ex: 4, Ey: 0, Ez: 0 });
    const nb = chain.bones[1];
    d.result = [Array.isArray(r.raw) ? r.raw.length : r.v, chain.bones.length, nb ? Math.round(nb.val('length') * 1e4) / 1e4 : null, eff.parentObj === nb, pos(eff), nb ? pos(nb) : null];
    d.selection = [app.selection.includes(eff), app.selection.includes(nb)];
    d.errors = logFrom(m, ['error']);
    d.standInNote = logFrom(m, ['info']).some(l => /^info:AppendBone: not yet attested/.test(l));
    app.select([eff]); m = mark();
    d.degenerate = [pub(run('AppendBone', { Ex: 4, Ey: 0, Ez: 0 })), logFrom(m, ['error']), chain.bones.length];
    m = mark(); d.byName = [Array.isArray(run('AppendBone', { InputObjs: eff.name, Ex: 4, Ey: 3, Ez: 0 }).raw), chain.bones.length, pos(eff), chain.bones[2] ? Math.round(chain.bones[2].val('length') * 1e4) / 1e4 : null];
    out.bone = d; app.select([]);
  }

  // ================= SymEnvWeight
  {
    const d = {};
    const g = run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'envGrid' }).raw;
    const L = run('GetPrim', { PresetObj: 'Null', Name: 'envL' }).raw, R = run('GetPrim', { PresetObj: 'Null', Name: 'envR' }).raw;
    L.kinematics.local.set('posx', -2); R.kinematics.local.set('posx', 2);
    d.envelope = pub(run('ApplyFlexEnv', { ConnectionSet: 'envGrid', DeformerSet: 'envL,envR', Mode: 0 })).err ?? 'ok';
    const env = g.primitive.operators.find(o => o.weights && o.deformers);
    const P = g.primitive.mesh().positions; const n = P.length / 3;
    const key = (x, y, z) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    const at = new Map(); for (let i = 0; i < n; i++) at.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i);
    const mirror = (i) => at.get(key(-P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    const left = []; for (let i = 0; i < n; i++) if (P[i * 3] < -1e-3 && mirror(i) !== undefined) left.push(i);
    d.leftPoints = left.length > 0;
    const iL = env.deformers.indexOf(L), iR = env.deformers.indexOf(R);
    // make the weights asymmetric so that mirroring is observable
    for (let i = 0; i < n; i++) { env.weights[i] = new Float32Array(env.deformers.length); env.weights[i][P[i * 3] > 0 ? iR : iL] = P[i * 3] > 0 ? 0.75 : 1; env.weights[i][P[i * 3] > 0 ? iL : iR] = P[i * 3] > 0 ? 0.25 : 0; }
    const tplOf = () => root.properties.filter(p => p.type === 'symmetrytemplate');
    d.templateBefore = tplOf().length;
    app.select([g]); const sel0 = [...app.selection]; let m = mark();
    const sub = `envGrid.pnt[${left.join(',')}]`;
    d.run = pub(run('SymEnvWeight', { SubComp: sub, SymmetryAxis: 0 }));
    d.templateAfter = tplOf().length;
    d.selectionKept = app.selection.length === sel0.length && app.selection[0] === sel0[0];
    // the mirroring is SISymEnvWeight's (CMD-B12c contract): the weights of each listed (left) point are copied to its
    // symmetric point with the two deformers swapped (template pairs envL / envR); the listed points keep theirs
    d.pairs = (tplOf()[0]?.pairs ?? []).some(p => p.includes('envL') && p.includes('envR'));
    d.mirrored = left.every(i => Math.abs(env.weights[mirror(i)][iR] - 1) < 1e-6 && Math.abs(env.weights[mirror(i)][iL]) < 1e-6);
    d.rightUntouched = left.every(i => Math.abs(env.weights[i][iL] - 1) < 1e-6 && Math.abs(env.weights[i][iR]) < 1e-6);
    d.note = logFrom(m).some(l => /SymEnvWeight: not yet attested/.test(l));
    // second run: the template exists, none is created
    run('SymEnvWeight', { SubComp: sub, SymmetryAxis: 0 }); d.templateSecond = tplOf().length;
    // default SubComp = the selection (point components)
    app.selectComponents(g, 'point', left); for (const i of left) { const j = mirror(i); env.weights[j][iR] = 0.75; env.weights[j][iL] = 0.25; }
    run('SymEnvWeight'); d.fromSelection = left.every(i => Math.abs(env.weights[mirror(i)][iR] - 1) < 1e-6);
    app.setSelMode('object');
    // UI entry: template present -> no question; template missing -> Yes / No box (1071 / 1072)
    await S.symEnvWeightUI({ SubComp: sub }); d.uiNoBox = !q('.miscds-yesno');
    for (const t of tplOf()) root.removeProperty(t);
    const pr = S.symEnvWeightUI({ SubComp: sub }); await tick();
    const box = q('.miscds-yesno');
    d.uiBox = box ? [box.querySelector('.ppg-float-title')?.textContent, box.querySelector('.sdkh-modal-content')?.textContent, box.querySelector('.sdkh-modal-ok')?.textContent, box.querySelector('.sdkh-modal-cancel')?.textContent] : null;
    box?.querySelector('.sdkh-modal-cancel')?.click(); await pr; await tick();
    d.uiNo = [tplOf().length, !q('.miscds-yesno')];
    // Yes with nothing (or several items) selected: "Please Select an item first"
    app.select([]); m = mark(); const pr2 = S.symEnvWeightUI({ SubComp: sub }); await tick();
    q('.miscds-yesno .sdkh-modal-ok')?.click(); await pr2; await tick();
    d.uiYesNoItem = logFrom(m, ['error']);
    // Yes with one item: the template options page (title 1073), property on the scene root while open, removed afterwards
    app.select([g]); const pr3 = S.symEnvWeightUI({ SubComp: sub }); await tick();
    q('.miscds-yesno .sdkh-modal-ok')?.click(); await tick(80);
    const page = q('.miscds-symtemplate');
    d.uiPage = page ? [page.querySelector('.ppg-float-title')?.textContent, [...page.querySelectorAll('.sdkh-row')].map(r => r.dataset.param), root.properties.some(p => p.name === 'CreateSymmetryMappingTemplate')] : null;
    page?.querySelector('.sdkh-modal-ok')?.click(); await pr3; await tick();
    d.uiCreated = [tplOf().length, root.properties.some(p => p.name === 'CreateSymmetryMappingTemplate')];
    out.sym = d; app.select([]);
  }

  // ================= SelectUVRow
  {
    const d = {};
    d.rows = [S.uvRowStrings('s.pnt[(1,2)]', 1), S.uvRowStrings('s.pnt[(1,2)]', 2), S.uvRowStrings('m.pnt[(0,3,4)]', 1), S.uvRowStrings('m.pnt[(0,3,4)]', 2),
      S.uvRowStrings('s.pnt[(1,2),(3,4)]', 1), S.uvRowStrings('s.pnt[5]', 1)];
    const g = run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'uvGrid' }).raw; const nu = g.primitive.mesh().nurbs.nu, nv = g.primitive.mesh().nurbs.nv;
    d.grid = [nu, nv];
    app.select([]); let m = mark();
    d.run = pub(run('SelectUVRow'));
    d.session = sess(); d.filter = app.selMode;
    const pts = () => app.compSel ? [...app.compSel.points].sort((a, b) => a - b) : null;
    const col = (u) => Array.from({ length: nv }, (_, v) => v * nu + u), row = (v) => Array.from({ length: nu }, (_, u) => v * nu + u);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort((x, y) => x - y));
    S.session.pick('uvGrid.pnt[(1,2)]', 1, 0); d.left = same(pts(), col(1));
    S.session.pick('uvGrid.pnt[(1,2)]', 2, 0); d.middle = same(pts(), row(2));
    S.session.pick('uvGrid.pnt[(3,0)]', 1, 1); d.shift = same(pts(), [...new Set([...row(2), ...col(3)])]);
    S.session.pick('uvGrid.pnt[(3,0)]', 1, 2); d.ctrl = same(pts(), row(2).filter(i => !col(3).includes(i)));
    S.session.pick('uvGrid.pnt[(0,2)]', 2, 3); d.shiftCtrl = same(pts(), []);
    S.session.pick('uvGrid.pnt[(0,1)]', 1, 7); d.otherModifier = same(pts(), col(0));
    m = mark(); S.session.pick('uvGrid.pnt[3]', 1, 0); d.noTuple = [logFrom(m), same(pts(), col(0)), S.session?.active === true];
    // a viewport click on point 7 of the surface = tuple (7 % nu, floor(7 / nu))
    app.activeTool.onClick([0, 0, 0], { obj: g, kind: 'point', item: 7, worldPoint: [0, 0, 0] }, { shift: false, ctrl: false });
    d.click = same(pts(), col(7 % nu));
    d.ended = endSession(); d.filterAfter = app.selMode;
    app.setSelMode('object'); app.select([]);
    out.uv = d;
  }

  // ================= SetKeyableAttributes
  {
    const d = {}; const l = cube.kinematics.local, sl = sphere.kinematics.local;
    const fl = (p) => [!!p.def.keyable, !!p.def.nonKeyableVisible];
    for (const n of ['posx', 'posy', 'posz', 'rotx']) { l.get(n).def.keyable = false; sl.get(n).def.keyable = false; }
    run('SetKeyableAttributes', { InputObjs: 'cube', Params: 'kine.local.posx,kine.local.posy' });
    d.keyable = [fl(l.get('posx')), fl(l.get('posy')), fl(l.get('posz'))];
    run('SetKeyableAttributes', { InputObjs: 'cube', Params: 'kine.local.posx', Attribute: 'siKeyableAttributeNonKeyableVisible' });
    d.nonKeyableVisible = fl(l.get('posx'));
    run('SetKeyableAttributes', { InputObjs: 'cube', Params: 'kine.local.posx', Attribute: 'siKeyableAttributeKeyable' });
    d.backToKeyable = fl(l.get('posx'));
    run('SetKeyableAttributes', { InputObjs: 'cube', Params: 'kine.local.posx,kine.local.posy', Attribute: ':siKeyableAttributeClear:siKeyableAttributeType' });
    d.clear = [fl(l.get('posx')), fl(l.get('posy'))];
    let m = mark(); d.invalid = [pub(run('SetKeyableAttributes', { InputObjs: 'cube', Params: 'kine.local.posx', Attribute: 'bogus' })).err !== undefined, logFrom(m, ['info']).includes('info:Invalid input attribute')];
    // empty Params = the marking, applied to every input object
    app.anim.marked.clear(); app.anim.marked.add(l.get('rotx'));
    app.select([cube, sphere]); run('SetKeyableAttributes');
    d.marking = [fl(l.get('rotx')), fl(sl.get('rotx')), fl(sl.get('posx'))];
    app.undo(); d.undo = [fl(l.get('rotx')), fl(sl.get('rotx'))];
    app.anim.marked.clear(); const sel = [...app.selection];
    d.noMarking = [pub(run('SetKeyableAttributes')), app.selection.length === sel.length];
    out.keyable = d; app.select([]);
  }

  // ================= TogglePinObjectInPosition
  {
    const d = {};
    cube.kinematics.local.set('posx', 3); cube.kinematics.local.set('posy', 1);
    const cns = (o) => o.properties.filter(p => p.type === 'poscns').map(p => p.targets.map(t => t.name));
    app.select([cube]);
    d.pin = pub(run('TogglePinObjectInPosition'));
    const pin = find('TEMP_PIN');
    d.pinned = pin ? [pin.parentObj === root, pos(pin), pin.primitive.operators[0].val('radius'), cns(cube), ['offsetx', 'offsety', 'offsetz'].map(n => cube.properties.find(p => p.type === 'poscns').val(n))] : null;
    d.selection = app.selection.length === 1 && app.selection[0] === cube;
    run('TogglePinObjectInPosition', { ConstrainedObj: 'sphere' }); d.secondPin = [!!find('TEMP_PIN1'), cns(sphere)];
    run('TogglePinObjectInPosition', { ConstrainedObj: 'TEMP_PIN' }); d.pinIgnored = [names().filter(n => n.includes('TEMP_PIN')).length, cns(pin).length];
    run('TogglePinObjectInPosition', { ConstrainedObj: 'cube,sphere' });
    d.unpinned = [names().filter(n => n.includes('TEMP_PIN')).length, cns(cube).length, cns(sphere).length];
    app.undo(); d.undo = [names().filter(n => n.includes('TEMP_PIN')).length, cns(cube).length]; app.redo();
    out.pin = d; app.select([]);
  }

  // ================= RetargetTagRig / RetargetRigToRig
  {
    const d = {};
    const mk = (n) => { const a = run('GetPrim', { PresetObj: 'Null', Name: n + '_hip' }).raw; const b = run('GetPrim', { PresetObj: 'Null', Name: n + '_foot' }).raw; run('ParentObj', { Parent: a.name, Children: b.name }); app.select([a]); const m = run('CreateModel', { Name: n }).raw; return { m, a, b }; };
    const A = mk('RigA'), B = mk('RigB');
    d.models = [A.m.name, A.a.parentObj === A.m, B.m.name];
    let inspected = []; const off = app.events.on('inspect', (n) => inspected.push(n?.name));
    // tag rig: no tagging command on the bus -> not yet attested; selection cleared, filter back to object
    app.select([A.m]); let m = mark();
    d.tag = [pub(run('RetargetTagRig')), logFrom(m).filter(l => /RetargetTagRig/.test(l)).length, app.selection.length, app.selMode];
    // an existing TaggingTool property is inspected
    const tt = mkProp('TaggingTool', 'customparamset', []); A.m.addProperty(tt); inspected = [];
    run('RetargetTagRig', { InputObjs: 'RigA' }); d.tagExisting = inspected.includes('TaggingTool'); A.m.removeProperty(tt);
    // pick path
    app.select([cube]); m = mark(); run('RetargetTagRig'); d.tagSession = sess();
    S.session.pick(B.m, 1, 0); await tick(5);
    d.tagPicked = [S.session === null, logFrom(m).some(l => /no tagging property was created on RigB/.test(l)), app.selection.length];
    app.select([]); m = mark(); run('RetargetTagRig'); endSession(); d.tagCancel = [logFrom(m, ['error']), app.selMode];

    // rig to rig: untagged rigs launch the tagging tool and stop
    m = mark(); S.lastRetarget = null;
    d.untagged = [pub(run('RetargetRigToRig', { InputObjs: [A.b, B.m] })), logFrom(m).filter(l => /^info:WARNING/.test(l)), S.lastRetarget];
    const tag = (o, type, label) => o.addProperty(mkProp('RetargetingTag', 'customparamset', [{ name: 'Type', type: 'int', value: type }, { name: 'tag', type: 'string', value: label }]));
    tag(A.a, 2, 'hip'); tag(A.b, 4, 'foot');
    m = mark(); run('RetargetRigToRig', { InputObjs: [A.b, B.m] });
    d.halfTagged = [logFrom(m).filter(l => /^info:WARNING/.test(l)), S.lastRetarget];
    tag(B.a, 2, 'hip'); tag(B.b, 0, 'foot');
    app.select([A.b, B.m]); m = mark(); d.retarget = pub(run('RetargetRigToRig'));
    const fn = (o) => o.fullName;
    d.connection = [S.lastRetarget?.preset, S.lastRetarget?.connectionSet === `${fn(A.a)},${fn(A.b)} ; ${fn(B.a)},${fn(B.b)} ; ${fn(A.m)},${fn(B.m)} ; ${fn(B.a)}`, S.lastRetarget?.connectionSet];
    d.retargetLog = [logFrom(m, ['error']), logFrom(m).some(l => /RetargetRigToRig: not yet attested/.test(l)) || S.lastRetarget?.applied === true, app.selection.length, app.selMode];
    // only a source given: the target is picked; same model = error
    m = mark(); run('RetargetRigToRig', { InputObjs: [A.a, A.b] }); d.targetSession = sess();
    S.session.pick(A.b, 1, 0); await tick(5);
    d.sameModel = [logFrom(m, ['error']), S.session === null, app.selMode];
    // nothing given: source then target pick
    app.select([]); S.lastRetarget = null; m = mark(); run('RetargetRigToRig'); d.sourceSession = sess();
    S.session.pick(B.a, 1, 0); await tick(5); d.thenTarget = sess()?.prompt;
    S.session.pick(A.m, 1, 0); await tick(5);
    d.picked = [S.session === null, S.lastRetarget?.connectionSet?.split(' ; ')[2] === `${fn(B.m)},${fn(A.m)}`, logFrom(m, ['error'])];
    // the scene root does not count as a model; cancel = error
    app.select([]); m = mark(); run('RetargetRigToRig', { InputObjs: [cube] }); d.rootNotGiven = sess()?.prompt; endSession();
    d.cancel = [logFrom(m, ['error']), app.selMode];
    off(); out.retarget = d; app.select([]);
  }

  // ================= shot cameras
  {
    const d = {}; const src = find('Camera'); const sp = src.primitive;
    sp.set('fov', 40); sp.set('near', 0.5); sp.set('far', 900); sp.set('interestdist', 5);
    const M = (o) => o.globalMatrix().elements.map(x => Math.round(x * 1e3) / 1e3);
    const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 2e-3);
    let m = mark(); const before = new Set(names());
    const r = run('CreateShotCamera', { SourceCamera: 'Camera', DestCamera: 'Shot' }); const cam = r.raw;
    d.result = r.err ?? [cam.name, cam.type, cam.parentObj === root, names().filter(n => !before.has(n))];
    d.matched = close(M(cam), M(src));
    d.values = [cam.primitive.val('fov'), cam.primitive.val('near'), cam.primitive.val('far'), cam.primitive.val('interestdist'), cam.kinematics.local.val('rotorder'), Number(cam.primitive.val('autokey')), Number(cam.primitive.val('autoupdatecoidist')), cam.primitive.val('std') === sp.val('std'), cam.properties.some(p => p.type === 'dircns')];
    d.warning = logFrom(m).filter(l => /^info:WARNING/.test(l));
    // matching render options: no warning
    const ro = app.scene.renderOptions; const keep = [sp.val('aspect'), sp.val('pixelratio')];
    sp.set('aspect', ro.val('ImageAspectRatio')); sp.set('pixelratio', ro.val('ImagePixelRatio')); m = mark();
    run('CreateShotCamera', { SourceCamera: 'Camera', DestCamera: 'ShotQuiet' }); d.noWarning = logFrom(m).filter(l => /^info:WARNING/.test(l)).length;
    sp.set('aspect', keep[0]); sp.set('pixelratio', keep[1]);
    // with an interest
    const b2 = new Set(names());
    const r2 = run('CreateShotCamera', { SourceCamera: 'Camera', DestCamera: 'Rig', WithoutInterest: false }); const c2 = r2.raw;
    const rootN = find('Rig_Root'), interest = find('Rig_Interest');
    const dir = c2?.properties.find(p => p.type === 'dircns');
    const e = src.globalMatrix().elements; const want = [e[12] - 5 * e[8], e[13] - 5 * e[9], e[14] - 5 * e[10]].map(x => Math.round(x * 1e4) / 1e4);
    d.rig = r2.err ?? [names().filter(n => !b2.has(n)).sort(), c2.parentObj === rootN, interest?.parentObj === rootN, rootN?.parentObj === root,
      close(pos(rootN), pos(src)), close(pos(interest), want), close(pos(c2), pos(src)), dir ? [dir.targets[0] === interest, dir.val('upvct_active'), dir.val('dirz')] : null,
      c2.kinematics.local.val('rotorder'), Number(c2.primitive.val('autoupdatecoidist'))];
    // unique name: the root null follows the camera's actual name
    const r3 = run('CreateShotCamera', { SourceCamera: 'Camera', DestCamera: 'Rig', WithoutInterest: false });
    d.rigUnique = r3.err ?? [r3.raw.name, r3.raw.parentObj.name, !!find(`${r3.raw.name}_Interest`)];
    // a built-in viewport camera as source: picture format from the output_format preferences, no warning
    m = mark(); const r4 = run('CreateShotCamera', { SourceCamera: 'Views.ViewB.UserCamera', DestCamera: 'FromView' }); const c4 = r4.raw;
    const vcam = window.__vm.viewports()[1].camera;
    d.builtin = r4.err ?? [c4.name, close(pos(c4), [vcam.position.x, vcam.position.y, vcam.position.z]), c4.primitive.val('std'), Math.round(c4.primitive.val('fov') * 10) / 10, logFrom(m).filter(l => /^info:WARNING/.test(l)).length];
    d.unknown = pub(run('CreateShotCamera', { SourceCamera: 'cube', DestCamera: 'x' })).err ?? 'no error';

    // and switch: viewport A (Top, orthographic) has no scene camera -> Views.ViewA.TopCamera
    m = mark(); const r5 = run('CreateShotCameraAndSwitch', { Viewport: 'siViewportA', CameraName: 'TopShot' }); const c5 = r5.raw;
    const tcam = window.__vm.viewports()[0].camera;
    d.switchTop = r5.err ?? [c5?.name, c5 && close(pos(c5), [tcam.position.x, tcam.position.y, tcam.position.z]), c5?.primitive.val('proj') !== src.primitive.val('proj'), logFrom(m, ['error'])];
    // focused viewport B: since CMD-B11h SetViewCamera keeps the view looking through the camera it was given (the view
    // takes the camera's name), so after the first switch (DestViewport = current view B) view B shows "TopShot"
    const r6 = run('CreateShotCameraAndSwitch', { CameraName: 'FocusShot', WithoutInterest: false }); const c6 = r6.raw;
    d.switchFocused = r6.err ?? [c6?.name, c6 && close(pos(c6), pos(find('TopShot'))), !!find('FocusShot_Interest'), c6?.primitive.val('fov') === find('TopShot')?.primitive.val('fov')];
    // SetViewCamera is on the bus since CMD-B10 (inferred): the switch now happens instead of being flagged
    d.switchNote = [window.__vm.active().viewCamera ?? null, logFrom(m).some(l => /CreateShotCameraAndSwitch: not yet attested/.test(l))];
    // no usable active view: error 1530, nothing returned
    const vm = window.__vm; window.__vm = undefined; m = mark(); const n0 = names().length;
    d.noView = [pub(run('CreateShotCameraAndSwitch')), logFrom(m, ['error']), names().length - n0]; window.__vm = vm;

    // GetPrimCameraWithoutInterest
    const b7 = new Set(names()); const r7 = run('GetPrimCameraWithoutInterest', { Name: 'Solo' }); const rec = r7.raw;
    const c7 = rec?.['3DObjCamera'];
    d.solo = r7.err ?? [Object.keys(rec).sort(), c7?.name, c7?.type, rec.Primitive === c7?.primitive, c7?.parentObj === root, names().filter(n => !b7.has(n)), Number(c7.primitive.val('autoupdatecoidist')),
      app.selection.includes(c7), app.selMode];
    const r8 = run('GetPrimCameraWithoutInterest', { Parent: 'cube' }); const c8 = r8.raw?.['3DObjCamera'];
    d.soloDefault = r8.err ?? [/^Camera\d*$/.test(c8.name), c8.parentObj === cube, c8.children.length];
    const r9 = run('GetPrimCameraWithoutInterest', { PresetObj: 'Telephoto', Name: 'Tele' }); d.soloPreset = r9.err ?? r9.raw['3DObjCamera'].primitive.val('fov');
    out.cam = d; app.select([]);
  }

  // ================= user data
  {
    const d = {}; const other = cube.cluster(out._other);
    app.select([other]); let m = mark();
    const r = run('CreateUserDataMap'); const map = r.raw?.[0];
    d.create = r.err ?? [r.raw.length, map?.name, map?.type, other.properties.includes(map), map?.template ?? null];
    app.undo(); d.undo = other.properties.includes(map); app.redo();
    const tpl = mkProp('MyData', 'customparamset', [{ name: 'weight', type: 'double', value: 1.5 }, { name: 'label', type: 'string', value: 'none' }]); cube.addProperty(tpl);
    const r2 = run('CreateUserDataMap', { InputObj: `cube.cls.${other.name}`, PropertyName: 'Templated', Template: tpl }); const tmap = r2.raw?.[0];
    d.templated = r2.err ?? [tmap?.name, tmap?.template === tpl, other.properties.includes(tmap)];
    m = mark(); const r3 = run('CreateUserDataMap', { InputObj: other, PropertyName: 'BadTpl', Template: cube.properties[0] });
    d.badTemplate = r3.err ?? [r3.raw[0]?.name, r3.raw[0]?.template ?? null, logFrom(m)];
    app.select([cube]); m = mark(); d.noCluster = [pub(run('CreateUserDataMap')), logFrom(m)];

    // SIInspectUserData: validation
    const el = [...other.elements][0];
    const errs = (a) => { const i = mark(); const x = run('SIInspectUserData', a); return [x.err ?? x.v, logFrom(i, ['error'])]; };
    d.errMap = errs({ UserDataMap: cube.properties[0], SubComp: `cube.poly[${el}]` });
    d.errSub = errs({ UserDataMap: tmap, SubComp: cube });
    d.errTemplate = errs({ UserDataMap: map, SubComp: `cube.poly[${el}]` });
    d.errNotInCluster = errs({ UserDataMap: tmap, SubComp: 'cube.poly[5]' });
    // empty item: the template is reset to its defaults, the page shows them
    tpl.set('weight', 9); tpl.set('label', 'stale');
    let p = run('SIInspectUserData', { UserDataMap: tmap, SubComp: [`cube.poly[${el},5]`] }).raw; await tick();
    let win = q('.miscds-userdata');
    d.page = win ? [win.querySelector('.ppg-float-title')?.textContent, [...win.querySelectorAll('.sdkh-row')].map(r => r.dataset.param), tpl.val('weight'), tpl.val('label'), typeof p?.then === 'function'] : null;
    // Cancel writes nothing
    win?.querySelector('.sdkh-modal-cancel')?.click(); await p; await tick();
    d.cancel = tmap.userData.size;
    // OK writes the property's data to every mapped component
    p = run('SIInspectUserData', { UserDataMap: tmap, SubComp: `cube.poly[${el},5]` }).raw; await tick();
    tpl.set('weight', 4.25); tpl.set('label', 'tagged');
    q('.miscds-userdata .sdkh-modal-ok')?.click(); await p; await tick();
    d.written = [[...tmap.userData.keys()], JSON.parse(tmap.userData.get(0) ?? '{}')];
    // reopening loads the stored data into the template
    tpl.set('weight', 0); tpl.set('label', 'x');
    p = run('SIInspectUserData', { UserDataMap: tmap, SubComp: `cube.poly[${el}]` }).raw; await tick();
    d.loaded = [tpl.val('weight'), tpl.val('label')];
    q('.miscds-userdata .sdkh-modal-cancel')?.click(); await p; await tick();
    // data that does not match the template
    tmap.userData.set(0, JSON.stringify({ other: 1 }));
    d.mismatch = errs({ UserDataMap: tmap, SubComp: `cube.poly[${el}]` });
    // batch mode: no page
    tmap.userData.delete(0); app.Interactive = false; m = mark();
    d.batch = [pub(run('SIInspectUserData', { UserDataMap: tmap, SubComp: `cube.poly[${el}]` })), !q('.miscds-userdata'), logFrom(m).some(l => /SIInspectUserData: not yet attested/.test(l))];
    app.Interactive = true;
    out.user = d;
  }
  delete out._other;
  out.leftover = [S.session === null, app.activeTool === null, !document.querySelector('.sdkh-modal-window')];
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = { v: '<none>' };
const T = {
  1071: 'A symmetry mapping template was not found. Do you want to create one?', 1072: 'Symmetry Mapping Template Not Found', 1073: 'Create Symmmetry Mapping Template',
  1130: 'Select U Row (supports Shift/Ctrl)', 1131: 'Select V Row (supports Shift/Ctrl)', 1154: 'Pick Copy Position', 1155: 'Pick Draw Position',
  1163: 'User Data Values for Selected Components', 1530: 'You cannot create a new camera from the current active view.',
  1531: 'Created camera has a different aspect/pixel ratio from the scene render options',
};
const posSession = (command, prompt) => ({ command, kind: 'position', filter: '', prompt, middle: '', tool: command });

// ---- registration
for (const n of NAMES) {
  ok(`${n}: in the registry dump`, registry[n] !== null, 'missing from data/commands_full.json');
  eq(`${n}: registered with the registry's arguments and defaults`, got.reg[n], registry[n]);
  eq(`${n}: display name`, got.labels[n], LABELS[n]);
}

// ---- defaults
const D = got.defaults;
eq('DuplicateTool (defaults, nothing selected): info message, no pick session', D.DuplicateTool, { r: NONE, log: ['info:Nothing to Duplicate. Select an object first.'], session: null, ended: null, made: 0 });
for (const n of ['DrawPrimitiveTool', 'DrawImplicitPrimitiveTool', 'DrawNullTool']) {
  eq(`${n} (defaults): pick-position session with prompt 1155, ended by button 0`, [D[n].r, D[n].session, D[n].ended, D[n].made], [NONE, posSession(n, T[1155]), [true, true], 0]);
}
eq('UnhideAllPolygons (defaults): nothing to do', [D.UnhideAllPolygons.r, D.UnhideAllPolygons.log], [NONE, []]);
eq('UnhideAllPolygonClusters (defaults): nothing to do', [D.UnhideAllPolygonClusters.r, D.UnhideAllPolygonClusters.log], [NONE, []]);
eq('AppendBone (defaults): error, returns nothing', [D.AppendBone.r, D.AppendBone.log], [NONE, ['error:AppendBone: parameter 0 must contain a skeleton effector']]);
eq('SymEnvWeight (defaults, nothing selected): nothing to do, no value', [D.SymEnvWeight.r, D.SymEnvWeight.log], [NONE, []]);
eq('SelectUVRow (defaults): Point pick session with prompts 1130 / 1131', [D.SelectUVRow.r, D.SelectUVRow.session, D.SelectUVRow.ended],
  [NONE, { command: 'SelectUVRow', kind: 'element', filter: 'Point', prompt: T[1130], middle: T[1131], tool: 'SelectUVRow' }, [true, true]]);
ok('SetKeyableAttributes (defaults, nothing selected): "No valid objects on input list", siErrCancelled', /siErrCancelled/.test(D.SetKeyableAttributes.r.err ?? '') && D.SetKeyableAttributes.log[0] === 'info:No valid objects on input list', D.SetKeyableAttributes);
eq('RetargetRigToRig (defaults): source model pick, cancel = error', [D.RetargetRigToRig.r, D.RetargetRigToRig.session?.prompt, D.RetargetRigToRig.session?.middle, D.RetargetRigToRig.session?.filter, D.RetargetRigToRig.log.filter(l => l.startsWith('error:'))],
  [NONE, 'Select Source Model', 'Deselect', 'Model', ['error:You must select a model, or part of a model.']]);
eq('RetargetTagRig (defaults): model pick, cancel = error', [D.RetargetTagRig.r, D.RetargetTagRig.session?.prompt, D.RetargetTagRig.session?.middle, D.RetargetTagRig.log.filter(l => l.startsWith('error:'))],
  [NONE, 'Select model to tag', '', ['error:You must select at least one rig (model) to tag.']]);
eq('TogglePinObjectInPosition (defaults): nothing to do', [D.TogglePinObjectInPosition.r, D.TogglePinObjectInPosition.made], [NONE, 0]);
ok('CreateShotCamera (defaults): no source camera = error (inferred), nothing created', /source camera "" not found/.test(D.CreateShotCamera.r.err ?? '') && D.CreateShotCamera.made === 0, D.CreateShotCamera);
ok('CreateShotCameraAndSwitch (defaults): camera from the focused viewport, returned', /^node:/.test(D.CreateShotCameraAndSwitch.r.v ?? '') && D.CreateShotCameraAndSwitch.made === 1 && !D.CreateShotCameraAndSwitch.log.some(l => l.startsWith('error:')), D.CreateShotCameraAndSwitch);
eq('GetPrimCameraWithoutInterest (defaults): one camera, outputs Primitive / 3DObjCamera', [D.GetPrimCameraWithoutInterest.r, D.GetPrimCameraWithoutInterest.made], [{ v: '{Primitive,3DObjCamera}' }, 1]);
eq('CreateUserDataMap (defaults): info message, empty collection', [D.CreateUserDataMap.r, D.CreateUserDataMap.log], [{ v: [] }, ['info:CreateUserDataMap requires clusters as the input']]);
eq('SIInspectUserData (defaults): error, no change', [D.SIInspectUserData.r, D.SIInspectUserData.log], [NONE, ['error:Invalid argument - a User Data Map should be specified']]);

// ---- DuplicateTool
const du = got.dup;
eq('DuplicateTool: pick-position session, prompt 1154', [du.run, du.session], [NONE, posSession('DuplicateTool', T[1154])]);
eq('DuplicateTool: test child sits under cube', du.childParent, 'cube');
eq('DuplicateTool pick 1: one copy per item, under the scene root, all at the picked position', du.first, [[true, [1, 2, 3]], [true, [1, 2, 3]]]);
eq('DuplicateTool pick 1: SIDuplicate, CutObj, 3 x SetValue per item, as logged commands', du.cmds, ['DuplicateTool', 'SIDuplicate', 'CutObj', 'SetValue', 'SetValue', 'SetValue', 'SIDuplicate', 'CutObj', 'SetValue', 'SetValue', 'SetValue']);
eq('DuplicateTool pick 2: asks again, new copies at the new position', [du.second, du.stillActive], [[[true, [4, 5, 6]], [true, [4, 5, 6]]], true]);
eq('DuplicateTool: button 0 ends the command', du.ended, [true, true]);
eq('DuplicateTool: DynamicsInitState posx / posy / posz follow the pick', du.dyn, [7, 8, 9]);

// ---- draw tools
const dr = got.draw;
eq('DrawPrimitiveTool: session prompt 1155', dr.session, posSession('DrawPrimitiveTool', T[1155]));
eq('DrawPrimitiveTool pick: CreatePrim with the arguments, at the picked position, selected', dr.made, ['polymsh', true, [1, 0, 2], true]);
eq('DrawPrimitiveTool pick: CreatePrim then 3 x SetValue', dr.cmds, ['DrawPrimitiveTool', 'CreatePrim', 'SetValue', 'SetValue', 'SetValue']);
eq('DrawPrimitiveTool: second pick, then button 0', [dr.second, dr.ended], [[3, 0, 4], [true, true]]);
eq('DrawPrimitiveTool Grid / NurbsSurface (Surface Grid Tool defaults)', dr.surface, ['surfmsh', [0, 1, 0]]);
eq('DrawNullTool: session prompt 1155', dr.nullSession, posSession('DrawNullTool', T[1155]));
eq('DrawNullTool pick: GetPrim Null only: Name and Parent ignored', dr.nullMade, [['null', true, true, [5, 6, 7]]]);
eq('DrawNullTool pick: GetPrim then 3 x SetValue', dr.nullCmds, ['DrawNullTool', 'GetPrim', 'SetValue', 'SetValue', 'SetValue']);
eq('DrawImplicitPrimitiveTool pick: preset default name under the scene root', [dr.implSession, dr.implMade], [posSession('DrawImplicitPrimitiveTool', T[1155]), [['null', true, true, [-1, -2, -3]]]]);
eq('draw tool without a user session: pick cancelled, nothing made, noted as not yet attested (Q4)', dr.batch, [NONE, true, 0, true]);

// ---- unhide
const un = got.unhide;
eq('UnhideAllPolygons: internal cluster name used (Q1, inferred)', [un.constant, un.hiddenName], ['InvisiblePolygons', 'InvisiblePolygons']);
eq('UnhideAllPolygonClusters: viewvis and rendvis true on every cluster, clusters kept (internal one too)', [un.clusters, un.afterClusters], [NONE, [true, true, true, true, true, true]]);
eq('UnhideAllPolygonClusters: a missing parameter is skipped silently', un.viewOnly, [NONE, true]);
eq('UnhideAllPolygonClusters: object without clusters is skipped', un.noCluster, NONE);
eq('UnhideAllPolygons: internal cluster deleted, others kept, selection unchanged', [un.polys, un.afterPolys], [NONE, [false, true, true]]);
eq('UnhideAllPolygons: undoable; no cluster = nothing', [un.undo, un.again], [true, [NONE, true]]);
eq('UnhideAllPolygons: sub-component / property selections resolve to the owning object', [un.fromComponents, un.fromProperty], [true, true]);

// ---- AppendBone
const bo = got.bone;
eq('AppendBone: no effector in the input = error', bo.noEffector, [NONE, ['error:AppendBone: parameter 0 must contain a skeleton effector']]);
eq('AppendBone: one bone appended, effector at (Ex, Ey, Ez)', bo.result, [1, 2, 2, true, [4, 0, 0], [2, 0, 0]]);
eq('AppendBone: result added to the selection (NODE)', [bo.selection, bo.errors], [[true, true], []]);
ok('AppendBone: the C++ append step is flagged not yet attested', bo.standInNote, bo);
eq('AppendBone: empty result = "an error occured while adding the bone"', bo.degenerate, [{ v: [] }, ['error:AppendBone: an error occured while adding the bone'], 2]);
eq('AppendBone: InputObjs by name', bo.byName, [true, 3, [4, 3, 0], 3]);

// ---- SymEnvWeight
const sy = got.sym;
eq('SymEnvWeight: test envelope built', [sy.envelope, sy.leftPoints, sy.templateBefore], ['ok', true, 0]);
eq('SymEnvWeight: no template on the deformer model -> CreateSymmetryMappingTemplate, once', [sy.run, sy.templateAfter, sy.templateSecond, sy.pairs], [NONE, 1, 1, true]);
eq('SymEnvWeight: listed points\' weights copied to their symmetric points (SISymEnvWeight), listed points kept, selection kept', [sy.mirrored, sy.rightUntouched, sy.selectionKept], [true, true, true]);
ok('SymEnvWeight: the C++ mirroring step is flagged not yet attested (Q2)', sy.note, sy);
eq('SymEnvWeight: default SubComp = the selection', sy.fromSelection, true);
eq('SymEnvWeight UI entry: template present = no question', sy.uiNoBox, true);
eq('SymEnvWeight UI entry: Yes / No box with text 1071, title 1072', sy.uiBox, [T[1072], T[1071], 'Yes', 'No']);
eq('SymEnvWeight UI entry: No = no template, straight to the weights', sy.uiNo, [0, true]);
eq('SymEnvWeight UI entry: Yes without exactly one item', sy.uiYesNoItem, ['error:Please Select an item first']);
eq('SymEnvWeight UI entry: Yes = options page (title 1073; Axis, FillTemplate, CreateSymmetryMap) on the scene root', sy.uiPage, [T[1073], ['Axis', 'FillTemplate', 'CreateSymmetryMap'], true]);
eq('SymEnvWeight UI entry: OK creates the template, the options property is deleted', sy.uiCreated, [1, false]);

// ---- SelectUVRow
const uv = got.uv;
eq('SelectUVRow row strings: left (u,*) / (s,u,*), middle (*,v) / (s,*,v), tuple by tuple, none without a tuple', uv.rows,
  [['s.pnt[(1,*)]'], ['s.pnt[(*,2)]'], ['m.pnt[(0,3,*)]'], ['m.pnt[(0,*,4)]'], ['s.pnt[(1,*)]', 's.pnt[(3,*)]'], []]);
eq('SelectUVRow: SetSelFilter "Point", pick session', [uv.run, uv.session, uv.filter], [NONE, { command: 'SelectUVRow', kind: 'element', filter: 'Point', prompt: T[1130], middle: T[1131], tool: 'SelectUVRow' }, 'point']);
eq('SelectUVRow: left = (u,*) row, middle = (*,v) row', [uv.left, uv.middle], [true, true]);
eq('SelectUVRow modifiers: Shift adds, Ctrl toggles, Shift+Ctrl removes, other = select', [uv.shift, uv.ctrl, uv.shiftCtrl, uv.otherModifier], [true, true, true, true]);
eq('SelectUVRow: pick without a tuple = message, pick again', uv.noTuple, [['info:Please pick one or more point(s) on a surface or surface mesh.'], true, true]);
eq('SelectUVRow: viewport click on a surface point', uv.click, true);
eq('SelectUVRow: button 0 ends, the Point filter stays', [uv.ended, uv.filterAfter], [[true, true], 'point']);

// ---- SetKeyableAttributes
const ke = got.keyable;
eq('SetKeyableAttributes default attribute: keyable set on the listed parameters only', ke.keyable, [[true, false], [true, false], [false, false]]);
eq('SetKeyableAttributes NonKeyableVisible: keyable cleared, flag set (mutually exclusive)', [ke.nonKeyableVisible, ke.backToKeyable], [[false, true], [true, false]]);
eq('SetKeyableAttributes Clear: both cleared', ke.clear, [[false, false], [false, false]]);
eq('SetKeyableAttributes other attribute: "Invalid input attribute", cancelled', ke.invalid, [true, true]);
eq('SetKeyableAttributes empty Params: the marking, over every input object; undoable', [ke.marking, ke.undo], [[[true, false], [true, false], [false, false]], [[false, false], [false, false]]]);
eq('SetKeyableAttributes no marking: nothing, selection kept', ke.noMarking, [NONE, true]);

// ---- pin
const pi = got.pin;
eq('TogglePinObjectInPosition pin: TEMP_PIN sphere under the root at the object, radius 0.2, Position constraint without compensation', [pi.pin, pi.pinned],
  [NONE, [true, [3, 1, 0], 0.2, [['TEMP_PIN']], [0, 0, 0]]]);
eq('TogglePinObjectInPosition: selection unchanged; later pins get a numeric suffix', [pi.selection, pi.secondPin], [true, [true, [['TEMP_PIN1']]]]);
eq('TogglePinObjectInPosition: objects named like a pin are ignored', pi.pinIgnored, [2, 0]);
eq('TogglePinObjectInPosition un-pin: pins deleted, constraints gone; undoable', [pi.unpinned, pi.undo], [[0, 0, 0], [2, 1]]);

// ---- retarget
const re = got.retarget;
eq('retarget test rigs', re.models, ['RigA', true, 'RigB']);
eq('RetargetTagRig on a model: tagging command not yet attested (Q6), DeselectAll, filter object', re.tag, [NONE, 1, 0, 'object']);
eq('RetargetTagRig: an existing TaggingTool property is inspected', re.tagExisting, true);
eq('RetargetTagRig without a model: Model pick session, pick continues', [re.tagSession?.prompt, re.tagSession?.filter, re.tagPicked], ['Select model to tag', 'Model', [true, true, 0]]);
eq('RetargetTagRig pick cancelled: error, filter object', re.tagCancel, [['error:You must select at least one rig (model) to tag.'], 'object']);
eq('RetargetRigToRig untagged rigs: both warnings, tagging launched, no operator', re.untagged,
  [NONE, ['info:WARNING : Source rig has not been tagged. Launching tagging tool', 'info:WARNING : Target rig has not been tagged. Launching tagging tool'], null]);
eq('RetargetRigToRig target untagged only', re.halfTagged, [['info:WARNING : Target rig has not been tagged. Launching tagging tool'], null]);
eq('RetargetRigToRig: SimpleIKRetargetOp connection set "A ; B ; C ; D" (D = target tags with Type 1..7)', [re.retarget, re.connection[0], re.connection[1]], [NONE, 'SimpleIKRetargetOp', true]);
eq('RetargetRigToRig: operator flagged not yet attested (Q5) unless available, DeselectAll, filter object', re.retargetLog, [[], true, 0, 'object']);
eq('RetargetRigToRig one model given: target pick; same model = error', [re.targetSession?.prompt, re.targetSession?.middle, re.sameModel], ['Select Target Model', 'Deselect', [['error:Source and target models must be different'], true, 'object']]);
eq('RetargetRigToRig nothing given: source pick, then target pick, then the operator', [re.sourceSession?.prompt, re.thenTarget, re.picked], ['Select Source Model', 'Select Target Model', [true, true, []]]);
eq('RetargetRigToRig: Scene_Root counts as not given; cancelled pick = error', [re.rootNotGiven, re.cancel], ['Select Source Model', [['error:You must select a model, or part of a model.'], 'object']]);

// ---- cameras
const ca = got.cam;
eq('CreateShotCamera without interest: one camera under the scene root, returned', ca.result, ['Shot', 'camera', true, ['Shot']]);
eq('CreateShotCamera: transform matched to the source', ca.matched, true);
eq('CreateShotCamera: fov / near / far / interestdist copied, rotorder 4, autokey on, autoupdatecoidist off, std copied, no constraint', ca.values, [40, 0.5, 900, 5, 4, 1, 0, true, false]);
eq('CreateShotCamera: warning 1531 when aspect / pixel ratio differ from the render options', [ca.warning, ca.noWarning], [[`info:WARNING : ${T[1531]}`], 0]);
eq('CreateShotCamera with interest: <name>_Root null, camera, <name>_Interest at -interestdist along the camera axis, Direction constraint (dirz -1, up vector on)', ca.rig,
  [['Rig', 'Rig_Interest', 'Rig_Root'], true, true, true, true, true, true, [true, true, -1], 4, 0]);
eq('CreateShotCamera with interest, name made unique: root and interest follow the camera name', ca.rigUnique, ['Rig1', 'Rig1_Root', true]);
eq('CreateShotCamera from a built-in viewport camera: viewport pose, std from the output_format preferences, no warning', ca.builtin, ['FromView', true, 18, 53.6, 0]);
ok('CreateShotCamera: a source that is not a camera fails (inferred)', /source camera "cube" not found/.test(ca.unknown), ca.unknown);
eq('CreateShotCameraAndSwitch siViewportA: Views.ViewA.TopCamera as source (orthographic)', ca.switchTop, ['TopShot', true, true, []]);
eq('CreateShotCameraAndSwitch focused viewport: the scene camera it shows (TopShot, attached by the first switch, CMD-B11h); WithoutInterest false builds the interest', ca.switchFocused, ['FocusShot', true, true, true]);
eq('CreateShotCameraAndSwitch: the views switch to the new cameras through SetViewCamera (CMD-B10)', ca.switchNote, ['FocusShot', false]);   // DestViewport defaults to the current view in both calls; the second switch wins
eq('CreateShotCameraAndSwitch: no camera for the view = error 1530, nothing returned', ca.noView, [NONE, [`error:${T[1530]}`], 0]);
eq('GetPrimCameraWithoutInterest: camera only (no root, no interest), outputs, autoupdatecoidist off, selected, object filter', ca.solo,
  [['3DObjCamera', 'Primitive'], 'Solo', 'camera', true, true, ['Solo'], 0, true, 'object']);
eq('GetPrimCameraWithoutInterest: default name Camera, Parent honoured', ca.soloDefault, [true, true, 0]);
eq('GetPrimCameraWithoutInterest: camera preset', ca.soloPreset, 20);

// ---- user data
const us = got.user;
eq('CreateUserDataMap: one UserData map (userdatamap) per cluster, no template; undoable', [us.create, us.undo], [[1, 'UserData', 'userdatamap', true, null], false]);
eq('CreateUserDataMap: PropertyName and a custom-property Template', us.templated, ['Templated', true, true]);
eq('CreateUserDataMap: a Template that is not a custom property is ignored with a message', us.badTemplate, ['BadTpl', null, ['info:Ignoring template argument because it is not a custom property']]);
eq('CreateUserDataMap: no cluster in the input', us.noCluster, [{ v: [] }, ['info:CreateUserDataMap requires clusters as the input']]);
eq('SIInspectUserData: not a user data map', us.errMap, ['<none>', ['error:Invalid argument - a User Data Map should be specified']]);
eq('SIInspectUserData: not a sub-component', us.errSub, ['<none>', ['error:Invalid argument - a SubComponent should be specified']]);
eq('SIInspectUserData: map without template', us.errTemplate, ['<none>', ['error:User Data Map does not have an associated Custom Property']]);
eq('SIInspectUserData: components outside the cluster', us.errNotInCluster, ['<none>', ['error:Selected components are not part of the cluster']]);
eq('SIInspectUserData: modal page titled 1163 over the template, reset to defaults for an empty item', us.page, [T[1163], ['weight', 'label'], 1.5, 'none', true]);
eq('SIInspectUserData Cancel: nothing written', us.cancel, 0);
eq('SIInspectUserData OK: the property data written to every mapped component', us.written, [[0], { weight: 4.25, label: 'tagged' }]);
eq('SIInspectUserData: stored data is loaded into the template on open', us.loaded, [4.25, 'tagged']);
eq('SIInspectUserData: data that does not match the template', us.mismatch, ['<none>', ['error:Failed to initialize Custom Property from User Data contents.  Data does not match Custom Property parameters.']]);
eq('SIInspectUserData without a user session: no page, flagged not yet attested (Q4)', us.batch, [NONE, true, true]);

eq('no pick session, tool or modal left open', got.leftover, [true, true, true]);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B5f misc DSScripts commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B5f misc DSScripts commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: DuplicateTool, DrawPrimitiveTool, DrawImplicitPrimitiveTool, DrawNullTool, UnhideAllPolygonClusters, SetKeyableAttributes, TogglePinObjectInPosition, CreateShotCamera, GetPrimCameraWithoutInterest, CreateUserDataMap');
console.log('   partly wired: UnhideAllPolygons (cluster name Q1), AppendBone (C++ append step), SymEnvWeight (C++ mirroring Q2), SelectUVRow (surface meshes), RetargetTagRig (tagging tool Q6), RetargetRigToRig (operator Q5), CreateShotCameraAndSwitch (view switch), SIInspectUserData (binary layout)');
