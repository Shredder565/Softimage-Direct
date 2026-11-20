// CMD-B18b / CMD-B18c (Face Robot JScript plug-ins PreparationTools.js, GameExport_EyelidTools.js, LipSynch.js,
// Tongue.js): the 35 commands of src/commands/faceRobotB18b.ts and faceRobotB18c.ts. There is no XSIBATCH golden for these
// rows: this is a contract check against docs/ghidra/cmd-b18b-fr-preparation-eyelid-scripts.md and
// docs/ghidra/cmd-b18c-fr-lipsynch-tongue-scripts.md (plus docs/re/WIRE_CORRECTIONS_B18.md items 2, 3, 8, 11).
//   1. every name is registered with the catalogue argument list (data/commands_full.json);
//   2. every command runs with its default arguments on the `?demo` scene plus the sample face without an unexpected
//      error; commands whose required input has no default must fail with a message naming the command (the scripts
//      raise a JScript error there);
//   3. the contracts' stated results (diagnose text, freeze, hole inspection, eye / mouth picking, eye sockets, eyeballs,
//      mouth interior, game smooth map, weight clipping, eyelash copy / transfer, speech import, viseme library, viseme
//      import, the PPG actions, tongue maps / markers / scaling, ...).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_fr_b18bc_commands.mjs
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
  'fr_CleanMeshModel', 'fr_Diagnose', 'fr_Freeze', 'fr_Holes', 'fr_PickEyeProximity', 'fr_PickMouthProximity', 'fr_AddMouthInterior',
  'fr_AddEyeSocket', 'fr_AddEyeBalls', 'fr_GetGameSmoothMap', 'fr_ApplyGameSmoothFromMap', 'fr_CopyEyelashes', 'fr_TransferEyelashEnvelope',
  'ClipDeformers', 'UndoGameSmooth',
  'fr_ImportSpeech', 'fr_LoadVisemePose', 'fr_SaveVisemePose', 'fr_CopyVisemeLibrary', 'fr_CreateVisemeVariation', 'fr_CreateVisemeShape',
  'fr_ImportVisemes', 'fr_PrepareForPhonemes', 'fr_EditVisemes', 'fr_AddLipSync', 'AddToGroup_tongue', 'GetCompounds_tongue', 'fr_SetupTongueMaps',
  'fr_BuildTongueAfterSolve', 'fr_ScaleTongueMesh', 'fr_IsHeadMesh', 'GetTongueMarkers', 'fr_FitTongueAfterSolveStage',
  'fr_SolveTongueAfterSolveStage', 'GetTongueScale',
];
// Object-typed inputs with no default: the scripts hit a JScript error (ClipDeformers Object, UndoGameSmooth face parts,
// AddToGroup_tongue Model, fr_SetupTongueMaps Mesh, fr_IsHeadMesh Mesh, GetTongueScale MarkerVectors) or, for
// fr_PrepareForPhonemes, the undefined AddTongue call.
const DEFAULT_FAILS = new Set(['ClipDeformers', 'UndoGameSmooth', 'fr_PrepareForPhonemes', 'AddToGroup_tongue', 'fr_SetupTongueMaps', 'fr_IsHeadMesh', 'GetTongueScale']);

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n);
  return [n, f ? f.args.map(a => [a.name, a.default ?? null]) : null];
}));
const stage1Src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'faceRobotStage1.ts'), 'utf8');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('GetTongueScale') && !!window.Application?.frB18bc && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const T = A.frB18bc; const Prop = T.Property;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)?.slice(0, 600)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text), kinds: A.log.slice(m) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text), kinds: A.log.slice(m) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
  const find = (n) => A.scene.find(n);
  const cube = find('cube');
  const { model, mesh } = T.buildSampleFace();
  const S = T.state(), FR = T.fr(), store = FR.store, fs = T.hostFs;
  const prop = (o, n) => o?.properties.find(p => p.name === n);
  const P = (name, defs) => new Prop(name, 'customparamset', defs);
  const sp = (n, v) => ({ name: n, type: 'string', value: v }), ip = (n, v) => ({ name: n, type: 'int', value: v }), bp = (n, v) => ({ name: n, type: 'bool', value: v });
  const diag = () => String(store.raw('_', 'Diagnose') ?? '');
  const holed = (name, W, H, removed, parent) => {
    const v = [], f = []; for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) v.push([i - W / 2, j - H / 2, 0]);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (removed.has(`${i},${j}`)) continue; const a = j * (W + 1) + i; f.push([a, a + 1, a + W + 2, a + W + 1]); }
    const o = T.meshObject(name, v, f); T.addObject(o, parent); return o;
  };
  const npts = (o) => o.primitive.mesh().positions.length / 3;
  const nply = (o) => o.primitive.mesh().polygons.length;
  A.maxUndo = 1000;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  A.cmdLog = true; S.helper = {}; S.sockets = [];
  ok('GetTongueMarkers registered with siNoLogging (correction 8)', A.commands.get('GetTongueMarkers').noLog === true);

  // ================================================================ CMD-B18b: PreparationTools.js
  try {
    // fr_CleanMeshModel (correction 2)
    let r = run('fr_CleanMeshModel', { Del: 0 });
    const mc = r.v;
    ok('fr_CleanMeshModel Del falsy: creates / returns the scene-root model fr_MeshClean', mc?.name === 'fr_MeshClean' && mc.type === '#model' && mc.parentObj === A.scene.root, r);
    ok('fr_CleanMeshModel Del falsy twice: same model', run('fr_CleanMeshModel', {}).v === mc);
    r = run('fr_CleanMeshModel', { Del: 1 });
    ok('fr_CleanMeshModel Del truthy: deletes fr_MeshClean, returns nothing; FreezeObj on the Face Robot meshes', r.v === undefined && !find('fr_MeshClean') && S.calls.some(c => c.name === 'FreezeObj'), r);

    // fr_Diagnose (correction 3)
    r = run('fr_Diagnose');
    const fsP = prop(model, 'FaceState');
    ok('fr_Diagnose: returns false without eyeballs / teeth / DNA', r.v === false, r);
    ok('fr_Diagnose: diagnose text lines (mesh, polygons, Eyeballs required, Teeth, DNA, MESH NOT READY)',
      diag().startsWith(`<li>Mesh: <b>${mesh.fullName}</b><br/><li>Number of Polygons in Mesh: <b>16</b><br/>`) && diag().includes('<font color=#82140F>Eyeballs required.</font><br/>')
      && diag().includes('<font color=#82140F>Upper and Lower Teeth required.</font><br/>') && diag().includes('Please select the face type in the <b>Type</b> tab above.') && diag().endsWith('<br/><font color=#82140F><b>MESH NOT READY.</b></font><br/>'), diag());
    ok('fr_Diagnose: FaceState.Message = text, FaceState.Valid = false, FaceState.DNA added', fsP.val('Message') === diag() && fsP.val('Valid') === false && fsP.get('DNA'));
    const eye = (n, x) => { const o = T.meshObject(n, [[-0.3, -0.3, -0.3], [0.3, -0.3, -0.3], [0, 0.3, -0.3], [0, 0, 0.3]], [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]]); T.addObject(o, model); o.kinematics.local.get('posx').value = x; return o; };
    const le = eye('LEyeMesh', 1), re = eye('REyeMesh', -1), ut = eye('UpperTeethMesh', 0), lt = eye('LowerTeethMesh', 0);
    store.put('meshes', 'LEye', le); store.put('meshes', 'REye', re); store.put('meshes', 'UpperTeeth', ut); store.put('meshes', 'LowerTeeth', lt);
    fsP.set('DNA', 'Symmetric');
    r = run('fr_Diagnose');
    ok('fr_Diagnose: ready mesh -> true, READY TO SCAN (designer), Valid true', r.v === true && diag().endsWith('<br/><font color=#388387><b>READY TO SCAN.</b></font><br/>') && fsP.val('Valid') === true, [r.err, diag()]);
    re.kinematics.local.get('posx').value = 0; re.primitive.operators[0].data.positions.forEach((_, i, a) => { if (i % 3 === 0) a[i] += 5; }); re.primitive.dirty = true;
    r = run('fr_Diagnose');
    ok('fr_Diagnose: eye pivot outside its global bounding box -> Center Eyeballs on their pivots.', r.v === false && diag().includes('Center Eyeballs on their pivots.'), diag());
    re.primitive.operators[0].data.positions.forEach((_, i, a) => { if (i % 3 === 0) a[i] -= 5; }); re.primitive.dirty = true; re.kinematics.local.get('posx').value = -1;
    mesh.kinematics.local.get('posy').value = 0.5;
    r = run('fr_Diagnose');
    ok('fr_Diagnose: transform not frozen -> Freeze Transform before Scan.', r.v === false && diag().includes('<font color=#82140F>Freeze Transform before Scan.</font>'), diag());

    // fr_Freeze
    const kid = T.newNull('FaceKid', mesh); kid.kinematics.local.get('posx').value = 1;
    const kidG = kid.globalMatrix().elements.slice(); const p0 = Array.from(mesh.primitive.mesh().positions.slice(0, 3));
    r = run('fr_Freeze');
    const L = mesh.kinematics.local;
    ok('fr_Freeze: local SRT identity, points moved by the old transform, children keep their pose and parent', !r.err && L.val('posy') === 0 && near(mesh.primitive.mesh().positions[1], p0[1] + 0.5) && kid.parentObj === mesh && kid.globalMatrix().elements.every((v, i) => near(v, kidG[i])), [r.err, L.val('posy'), mesh.primitive.mesh().positions[1], p0]);
    ok('fr_Freeze: runs fr_Diagnose (READY TO SCAN again)', diag().includes('READY TO SCAN.'), diag());

    // fr_Holes
    r = run('fr_Holes');
    const mc2 = find('fr_MeshClean'); const ih = prop(mc2, 'fr_InspectHoles');
    ok('fr_Holes: fr_InspectHoles (Holes) on fr_MeshClean, inspected with siLock, items "<mesh> has 1 holes", Hole_1', !!ih && ih.params.map(p => p.name).join() === 'Holes' && S.inspected.at(-1)?.prop === ih && S.inspected.at(-1).mode === 'siLock'
      && JSON.stringify(ih.items?.map(i => i.label)) === JSON.stringify(['FaceMesh has 1 holes', 'Hole_1']), [r.err, ih?.items]);
    ih.set('Holes', 1);
    ok('fr_InspectHoles: Holes = 1 selects the 16 border edges of hole 0', A.compSel?.obj === mesh && A.compSel.kind === 'edge' && A.compSel.edges.size === 16, A.compSel?.edges?.size);
    ih.set('Holes', 0);
    ok('fr_InspectHoles: Holes = 0 selects the mesh', A.selection[0] === mesh && A.selection.length === 1);

    // a mesh with two eye holes and a mouth hole
    const face2 = holed('HoleFace', 10, 6, new Set(['2,4', '7,4', '4,1', '5,1', '4,2', '5,2']), model);
    store.put('meshes', 'Mesh', face2); T.polymesh(face2, 1);
    const n0 = npts(face2), f0 = nply(face2);
    let picks = [];
    S.hooks.pick = (i) => (picks[i] ? { button: 1, pos: picks[i] } : { button: 0, pos: [0, 0, 0] });
    picks = [[-2.5, 1.5, 0], [2.5, 1.5, 0], [0, -1, 0], [0, 3, 0], [1, 1, 1]];
    r = run('fr_PickEyeProximity');
    ok('fr_PickEyeProximity: more picks than holes -> "Number of picks (5) is greater than number of holes (4)"', diag() === 'Number of picks (5) is greater than number of holes (4)', diag());
    ok('fr_PickEyeProximity: pick loop sets and restores the 8 snapping preferences', S.snapping.Enable === 0 && S.snapping.Enable0D === 1 && S.calls.filter(c => c.name === 'PickPosition').length >= 6);
    picks = [];
    r = run('fr_PickEyeProximity');
    ok('fr_PickEyeProximity: no picks -> "No Eye Holes Picked"', diag() === 'No Eye Holes Picked', diag());
    picks = [[-2.5, 1.5, 0], [2.5, 1.5, 0], [-2.4, 1.5, 0]];
    r = run('fr_PickEyeProximity');
    const helper = S.helper;
    ok('fr_PickEyeProximity: nearest holes, unique; "Adding Eye Holes: <i> <j><br/><li>Ready to Add (2) Eye Sockets"', /^Adding Eye Holes: ( \d+){2}<br\/><li>Ready to Add \(2\) Eye Sockets$/.test(diag()) && helper.EyeHoles?.length === 2, [diag(), helper.EyeHoles]);
    ok('fr_PickEyeProximity: the eye holes\' edges are selected (4 + 4)', A.compSel?.obj === face2 && A.compSel.edges.size === 8, A.compSel?.edges?.size);
    picks = [[-2.5, 1.5, 0], [2.5, 1.5, 0]];
    face2.kinematics.local.get('posx').value = 0.1;
    r = run('fr_PickEyeProximity');
    ok('fr_PickEyeProximity: active transform -> "HoleFace has active tranforms. Freeze before running picking sockets."', diag() === 'HoleFace has active tranforms. Freeze before running picking sockets.', diag());
    face2.kinematics.local.get('posx').value = 0;

    // fr_AddEyeSocket
    r = run('fr_AddEyeSocket');
    const mc3 = find('fr_MeshClean');
    const socks = mc3.properties.filter(p => p.name === 'eyeSocket');
    const sops = face2.primitive.operators.filter(o => o.type === 'eyeSocket');
    ok('fr_AddEyeSocket: two eyeSocket properties, two EyeCentroid nulls under fr_MeshClean, two EyeEdge clusters, two eyeSocket operators', !r.err && socks.length === 2 && mc3.children.filter(c => c.name.startsWith('EyeCentroid')).length === 2
      && face2.clusters.filter(c => c.name === 'EyeEdge').length === 2 && sops.length === 2, [r.err, socks.length, sops.length]);
    ok('fr_AddEyeSocket: eyeSocket parameters (CapEyeSocket ... rad), Radius = 0.75 x corner distance, LacrimalGland max n/2-1', socks[0]?.params.map(p => p.name).join() === 'CapEyeSocket,Precision,InvertPolys,LacrimalGland,ShiftLacrimal,Edge,Radius,RadialDensity,CenterDiflection,lastOldPoint,lastNewPoint,centerX,centerY,centerZ,rad'
      && near(socks[0].val('Radius'), 0.75 * Math.SQRT2) && socks[0].get('LacrimalGland').def.max === 1, socks[0]?.params.map(p => [p.name, p.value]));
    ok('fr_AddEyeSocket: the second socket follows the first (expression = lead parameter full name)', A.anim.expression(socks[1].get('Radius')) === socks[0].get('Radius').fullName, A.anim.expression(socks[1]?.get('Radius')));
    ok('fr_AddEyeSocket: the first socket is inspected with siLock', S.inspected.some(x => x.prop === socks[0] && x.mode === 'siLock'));
    ok('fr_AddEyeSocket: each socket adds Precision-1 rings of 4 points + an apex (29), 28 quads + 4 triangles', npts(face2) === n0 + 58 && nply(face2) === f0 + 64, [npts(face2), n0, nply(face2), f0]);
    ok('fr_AddEyeSocket: lastOldPoint / lastNewPoint / rad written by the operator', socks[0].val('lastOldPoint') === n0 && socks[0].val('lastNewPoint') === n0 + 28 && socks[1].val('lastOldPoint') === n0 + 29 && socks[1].val('lastNewPoint') === n0 + 57 && socks[0].val('rad') > 0,
      socks.map(s => [s.val('lastOldPoint'), s.val('lastNewPoint'), s.val('rad')]));
    ok('fr_AddEyeSocket: EyeSockets stored on fr_GetFRPolymesh(), selection = the mesh', S.helper.EyeSockets?.length === 2 && A.selection[0] === face2);
    const both = (n, v) => socks.forEach(s => s.set(n, v));   // this build evaluates the follow expressions per frame
    both('CapEyeSocket', false);
    ok('eyeSocket operator: CapEyeSocket off on the lead -> both sockets add nothing', npts(face2) === n0, npts(face2));
    both('CapEyeSocket', true); both('Edge', 0.5);
    ok('eyeSocket operator: Edge > 0 adds a shifted copy of the hole row first (+4 points per socket)', npts(face2) === n0 + 66, npts(face2));
    both('Edge', 0); both('LacrimalGland', 1);
    ok('eyeSocket operator: LacrimalGland 1 adds one interpolated point per socket', npts(face2) === n0 + 60, npts(face2));
    both('LacrimalGland', 0);

    // fr_AddEyeBalls
    r = run('fr_AddEyeBalls');
    const ebp = prop(face2, 'EyeballProperties');
    const esc = face2.clusters.filter(c => c.name === 'EyeSocket');
    const sel = A.selection.map(o => o.name);
    const fc = prop(model, 'FaceConnections');
    ok('fr_AddEyeBalls: EyeballProperties on the mesh, inspected; two EyeSocket clusters lastOld..lastNew (29 points)', !r.err && !!ebp && S.inspected.some(x => x.prop === ebp) && esc.length === 2 && esc.every(c => c.elements.size === 29), [r.err, esc.map(c => c.elements.size)]);
    const eyeN = A.scene.root.children.filter(o => /^(LEye|Eye)\d*$/.test(o.name) && o.type === 'null');
    ok('fr_AddEyeBalls: eye nulls named LEye (centre x > 0) / Eye, each with a cornea child (selected, then fr_Diagnose\'s FaceRobot() clears the selection)', eyeN.length === 2 && eyeN.some(o => o.name.startsWith('LEye')) && eyeN.some(o => o.name.startsWith('Eye')) && eyeN.every(o => o.children.some(c => c.name.startsWith('Cornea'))) && sel.length === 0 && S.calls.some(c => c.name === 'FaceRobot'), [eyeN.map(o => o.name), sel]);
    ok('fr_AddEyeBalls: FaceConnections REye / LEye = cornea full names (swapped sides as shipped)', String(fc.val('REye')).includes('LEye') && String(fc.val('LEye')).includes('Eye') && String(fc.val('REye')).includes('Cornea'), [fc.val('REye'), fc.val('LEye')]);
    ok('fr_AddEyeBalls: ShrinkWrap / proj not available here -> "not yet attested"', nya(r));
    r = run('fr_AddEyeBalls'); void r;

    // fr_PickMouthProximity + fr_AddMouthInterior
    picks = [[0, -1, 0]];
    const nb0 = npts(face2), fb0 = nply(face2);
    r = run('fr_PickMouthProximity');
    ok('fr_PickMouthProximity: one pick; "Adding Mouth Holes: <i><br/><li>Ready to Add (1) Mouth Interior"', /^Adding Mouth Holes: \d+<br\/><li>Ready to Add \(1\) Mouth Interior$/.test(diag().replace('Holes:  ', 'Holes: ')) && S.helper.MouthHoles?.length === 1, [diag(), r.err]);
    r = run('fr_AddMouthInterior');
    const mip = find('fr_MeshClean').properties.find(p => p.name === 'fr_MouthInteriorProperty');
    const guides = ['mGuideRight', 'mGuideBottom', 'mGuideLeft', 'mGuideTop'].map(n => find('fr_MeshClean').children.find(c => c.name.startsWith(n)));
    ok('fr_AddMouthInterior: property (Depth = 2w, Height = w, Sections 16, MouthUpperCross fcurve), w = major axis of the hole (2*sqrt 2)', !r.err && !!mip && near(mip.val('Depth'), 4 * Math.SQRT2) && near(mip.val('Height'), 2 * Math.SQRT2) && mip.val('Sections') === 16 && /keys/.test(mip.val('MouthUpperCross')), [r.err, mip?.val('Depth'), mip?.val('Height')]);
    ok('fr_AddMouthInterior: four guide curves (degree 3, 8 CVs, wire colour 22) under fr_MeshClean', guides.every(g => g?.type === 'crvlist' && g.primitive.curve()?.cvs.length === 8 && g.primitive.curve().degree === 3 && g.properties.find(p => p.type === 'display')?.wireColorIndex === 22), guides.map(g => g?.name));
    ok('fr_AddMouthInterior: mGuideBottom CV 7 = (0, -0.473w, -0.94*2w) + quadrant point 1', (() => { const c = guides[1].primitive.curve().cvs; const w = 2 * Math.SQRT2; return near(c[7][1] - c[0][1], -0.473 * w) && near(c[7][2] - c[0][2], -0.94 * 2 * w); })());
    ok('fr_AddMouthInterior: mouthInterior operator adds (S+1) rows of 8 points and S*8 quads + one cap (row S+1 orphans)', face2.primitive.operators.some(o => o.type === 'mouthInterior') && npts(face2) === nb0 + 17 * 8 && nply(face2) === fb0 + 16 * 8 + 1, [npts(face2) - nb0, nply(face2) - fb0]);
    mip.set('Sections', 8);
    ok('mouthInterior operator: Sections 8 -> 9 rows', npts(face2) === nb0 + 9 * 8, npts(face2) - nb0);
    ok('fr_AddMouthInterior: inspected, then fr_Diagnose', S.inspected.some(x => x.prop === mip) && diag().includes('<li>Mesh: <b>'));
    S.helper.MouthHoles = [];
    r = run('fr_AddMouthInterior');
    ok('fr_AddMouthInterior: no mouth holes -> "Pick Mouth Proximity First "', diag() === 'Pick Mouth Proximity First ', diag());
    S.helper.EyeHoles = [];
    r = run('fr_AddEyeSocket');
    ok('fr_AddEyeSocket: no eye holes -> "Pick Eye Proximity First "', diag() === 'Pick Eye Proximity First ', diag());
    ok('MouthUpperCross fcurve: keys pass through (0,0), (0.2,1), (0.5,0.8), (0.7,1)', [[0, 0], [0.2, 1], [0.5, 0.8], [0.7, 1]].every(([x, y]) => near(T.evalTangentFCurve({ keys: [[0, 0], [0.2, 1], [0.5, 0.8], [0.7, 1]], tangents: [[0, 0, 0.01, 0.4], [-0.1, 0, 0.1, 0], [-0.1, 0, 0.1, 0], [-0.1, 0, 0.2, 0]] }, x), y, 1e-3)));
    // no mesh: get-head message
    store.delete('meshes', 'Mesh'); const fmk = prop(A.scene.root, 'ActiveFaceRobot');
    const fcm = fc.val('Mesh'); fc.set('Mesh', '');
    r = run('fr_Holes');
    ok('get head: no meshes/Mesh after FaceRobot(,,"15") -> "<b>Pick Objects</b> before Inspect Holes."', diag() === '<b>Pick Objects</b> before Inspect Holes.' && S.calls.some(c => c.name === 'FaceRobot' && c.args.id === '15'), diag());
    fc.set('Mesh', fcm); store.put('meshes', 'Mesh', mesh); void fmk;
  } catch (e) { ok('section B18b: PreparationTools.js ran without a page-script error', false, String(e?.stack ?? e)); }

  // ================================================================ CMD-B18b: GameExport_EyelidTools.js
  try {
    const W = T.clipWeights;
    ok('clip weights: top 2 of (50,30,20) renormalised to 100 -> (62.5, 37.5, 0)', JSON.stringify(W([[50, 30, 20]], 2, 0.1)[0].map(v => Math.round(v * 1000) / 1000)) === '[62.5,37.5,0]');
    ok('clip weights: equal weights -> higher deformer index first', JSON.stringify(W([[50, 50, 0]], 1, 0.1)[0]) === '[0,100,0]');
    ok('clip weights: step 5 rounds to multiples of 5, the largest absorbs 100 - sum', (() => { const o = W([[33.33, 33.33, 33.34]], 3, 5)[0]; return near(o.reduce((s, x) => s + x, 0), 100) && o.every(x => near(x / 5, Math.round(x / 5))); })());
    ok('clip weights: empty step -> NaN (as shipped)', W([[50, 50]], 2, undefined)[0].every(Number.isNaN));

    const gm = new T.Model('GameModel'); T.addObject(gm);
    const game = holed('GameFace', 4, 4, new Set(), gm);
    const defs = [[-2, 0], [0, 0], [2, 0]].map(([x, y], i) => { const n = T.newNull(`GD${i}`, gm); n.kinematics.local.get('posx').value = x; n.kinematics.local.get('posy').value = y; return n; });
    const env = new T.EnvelopeOperator(defs, () => game); env.set('maxdeformers', 3); env.setReferencePoses(); env.computeWeights(game.primitive.mesh(), game.globalMatrix()); game.primitive.addOperator(env);
    gm.addProperty(P('GameExportProp', [ip('OptimizeWeights', 0), ip('Weights_Per_Bone', 2), sp('GameFace', 'GameFace')]));
    const sface = holed('SmoothFace', 4, 4, new Set(), model);
    const C = (n, el) => { const c = new T.Cluster(n, 'pnt', new Set(el)); sface.addCluster(c); return c; };
    C('MouthRegion', [6, 7, 8, 11, 12, 13, 16, 17, 18]); C('MouthLipRegion', [12]);
    const lid = C('LEyelidCls', [0, 1, 2]); const em = new Prop('EdgeMap', 'weightmap', []); em.values = new Map([[0, 0], [1, 0.5], [2, 1]]); lid.addProperty(em);
    store.put('meshes', 'Mesh', sface);
    let r = run('fr_GetGameSmoothMap', { ExportMesh: game, HandleExisting: 2 });
    const rec = r.v; const gcl = game.clusters.filter(c => c.name === 'GameEnvelopeSmooth');
    ok('fr_GetGameSmoothMap: GameEnvelopeSmooth cluster (all points) + weight map on the game face; record returned', !r.err && gcl.length === 1 && gcl[0].elements.size === 25 && rec?.Map?.name === 'GameEnvelopeSmooth' && rec.GameWeightArray?.length === 25, [r.err, gcl.length]);
    ok('fr_GetGameSmoothMap: face weights = max(eyelid 1-2|v-0.5|, mouth ring distance) (point 1 -> 1, point 0 -> 0, ring point 12 -> 1, point 6 -> 0)', near(rec.FaceWeights[1], 1) && near(rec.FaceWeights[0], 0) && near(rec.FaceWeights[12], 1) && near(rec.FaceWeights[6], 0) && rec.GameWeightArray.every(v => v >= 0 && v <= 1 + 1e-6), rec?.FaceWeights);
    ok('fr_GetGameSmoothMap: progress bar "Getting Smooth Map" (max 4), stacks unmuted after', S.progress.some(p => p.caption === 'Getting Smooth Map' && p.max === 4) && env.val('mute') === false);
    r = run('fr_GetGameSmoothMap', { ExportMesh: game, HandleExisting: 0 });
    ok('fr_GetGameSmoothMap HandleExisting 0: the existing map is read back', r.v?.Map === rec.Map && game.clusters.filter(c => c.name === 'GameEnvelopeSmooth').length === 1);
    r = run('fr_GetGameSmoothMap', { ExportMesh: game, HandleExisting: 1 });
    const box = FR.boxes.at(-1);
    ok('fr_GetGameSmoothMap HandleExisting 1: Yes/No box (No default) -> record without weights, map kept', box?.caption === 'Game Export Smooth Map' && box.text === `Map <<${rec.Map.fullName}>> Exists,\nDo you want to Overwrite File?` && r.v && r.v.Map === null && game.clusters.some(c => c.name === 'GameEnvelopeSmooth'), [box, r.v?.Map]);
    r = run('fr_GetGameSmoothMap', { HandleExisting: 0 });
    ok('fr_GetGameSmoothMap: game face from the game property (stand-in logs "not yet attested")', r.v?.gameFace === game && nya(r));
    r = run('fr_ApplyGameSmoothFromMap', { ExportMesh: game, HandleExisting: 2 });
    const wsum = env.weights.map(w => Array.from(w).reduce((s, x) => s + x, 0)), wnz = env.weights.map(w => Array.from(w).filter(x => x > 1e-9).length);
    ok('fr_ApplyGameSmoothFromMap: weights smoothed then clipped to Weights_Per_Bone (2), sums 100 %', r.v === rec || r.v?.gameFace === game, r.err);
    ok('fr_ApplyGameSmoothFromMap: every point <= 2 deformers, sum 1', wsum.every(s => near(s, 1, 1e-4)) && wnz.every(n => n <= 2), [wsum.slice(0, 5), wnz.slice(0, 5)]);
    ok('fr_ApplyGameSmoothFromMap: progress captions in order', JSON.stringify(S.progress.at(-1)?.status) === JSON.stringify(['Gathering Envelope Data', 'Gathering Envelope Data', 'Collecting Neighbor information', 'Smoothing Envelopes', 'Clipping Deformer Count and Optimizing Weights', 'Applying New Weights', 'Cleaning Up']), S.progress.at(-1));
    r = run('ClipDeformers', { Object: game, ClipDeformerCount: 1, ClampDeformerStep: 0.1 });
    ok('ClipDeformers(1, 0.1): true; one deformer per point at 100 %', r.v === true && env.weights.every(w => Array.from(w).filter(x => x > 1e-9).length === 1 && near(Math.max(...w), 1)), r);
    r = run('ClipDeformers', { Object: cube, ClipDeformerCount: 2, ClampDeformerStep: 1 });
    ok('ClipDeformers: no envelope -> "No Envelope Found to Smooth", null', r.v === null && has(r, /^No Envelope Found to Smooth$/));
    S.hooks.cancelProgress = () => true;
    r = run('fr_GetGameSmoothMap', { ExportMesh: game, HandleExisting: 0 });
    ok('fr_GetGameSmoothMap: cancel -> null', r.v === null);
    delete S.hooks.cancelProgress;
    r = run('fr_GetGameSmoothMap', { ExportMesh: cube });
    ok('face parts: wrong envelope count -> "Incorrect number of Envelope Operators were found! [0] ..."', r.v === null && has(r, /^Incorrect number of Envelope Operators were found! \[0\] , this function is a postprocess command, first apply Game Export\.\.\.$/));
    // UndoGameSmooth
    r = run('UndoGameSmooth', { ExportMesh: game });
    ok('UndoGameSmooth: no TEMPORARY_Envelope property -> "No More Envelopes Stored..."', has(r, /^No More Envelopes Stored\.\.\.$/), r);
    game.addProperty(P('TEMPORARY_Envelope1', [sp('Text', Array.from({ length: 25 }, () => '100,0,0').join(','))]));
    r = run('UndoGameSmooth', { ExportMesh: game });
    ok('UndoGameSmooth: last TEMPORARY_Envelope property -> envelope weights, property deleted', !prop(game, 'TEMPORARY_Envelope1') && env.weights.every(w => near(w[0], 1)), r.err);

    // eyelashes
    const lash = T.meshObject('Lash', [[-1, 1, 0], [1, 1, 0], [0, 1.5, 0]], [[0, 1, 2]]); T.addObject(lash, model);
    lash.addProperty(P('FaceElement', [sp('Type', 'Eyelash')]));
    const ld = T.newNull('LashDef', model); ld.addProperty(P('FaceElement', [ip('ID', 1), sp('Type', 'EyelashDeformer')]));
    r = run('fr_CopyEyelashes', { Face: mesh, GameFace: game });
    const gl = game.children.find(c => c.name === 'Lash'), gd = game.children.find(c => c.name === 'LashDef');
    const eg = A.scene.groupList.find(g => g.name === 'Eyelashes');
    ok('fr_CopyEyelashes: true; lash and deformer duplicated under the game face with the source names; group Eyelashes (viewvis 2)', r.v === true && !!gl && !!gd && eg?.members.includes(gl) && eg.val('viewvis') === 2, [r.err, game.children.map(c => c.name)]);
    r = run('fr_CopyEyelashes', { Face: mesh, GameFace: game });
    ok('fr_CopyEyelashes: second copy -> "Game Face Already has eyelashes!, Delete first, then attempt to copy again", still true (correction 11)', r.v === true && has(r, /^Game Face Already has eyelashes!, Delete first, then attempt to copy again$/));
    const gm2 = new T.Model('GameModel2'); T.addObject(gm2);
    const efm = new T.Model('EmptyFaceModel'); T.addObject(efm);
    r = run('fr_CopyEyelashes', { Face: holed('EmptyFace', 1, 1, new Set(), efm), GameFace: holed('GF2', 1, 1, new Set(), gm2) });
    ok('fr_CopyEyelashes: no lashes on the face -> "No eyelash meshes found.", true', r.v === true && has(r, /^No eyelash meshes found\.$/));
    const lonely = T.newNull('LonelyHead', gm2);
    r = run('fr_TransferEyelashEnvelope', { FR_HeadNull: lonely, GameFace: game });
    ok('fr_TransferEyelashEnvelope: missing LashAttachCluster logged; deformer count mismatch "(0) Face Eyelash Deformers to drive (1) Game Eyelash Deformers ", true', r.v === true && has(r, /^Cluster <"LashAttachCluster"> not found for mesh, .*Lash, check validity$/) && has(r, /^\(0\) Face Eyelash Deformers to drive \(1\) Game Eyelash Deformers $/), r.log);
    gl.addCluster(new T.Cluster('LashAttachCluster', 'pnt', new Set([0, 1])));
    const head = T.newNull('HeadNullB18', model);
    r = run('fr_TransferEyelashEnvelope', { FR_HeadNull: head, GameFace: game, Envelope: true, Animation: false });
    const lenv = gl.primitive.operators.find(o => o.type === 'envelopop');
    ok('fr_TransferEyelashEnvelope: Pose constraint game deformer -> FR deformer', gd.properties.some(p => p.type === 'posecns' && p.targets[0] === ld), gd.properties.map(p => p.type));
    ok('fr_TransferEyelashEnvelope Envelope: new envelope on the lash, first deformer = game deformer; point 2 (outside the attach cluster) 100 % on it; game envelope unmuted', !!lenv && lenv.deformers[0] === gd && near(lenv.weights[2]?.[0], 1) && env.val('mute') === false, [r.err, lenv?.deformers.map(d => d.name), lenv?.weights.map(w => Array.from(w)), r.log]);
    r = run('fr_TransferEyelashEnvelope', { FR_HeadNull: head, GameFace: game, Envelope: false, Animation: true });
    ok('fr_TransferEyelashEnvelope Animation: PlotAndApplyAction on the deformers, then their constraints deleted', S.calls.some(c => c.name === 'PlotAndApplyAction') && gd.properties.filter(p => p.type === 'posecns').length < 2, gd.properties.map(p => p.type));
    store.put('meshes', 'Mesh', mesh);
  } catch (e) { ok('section B18b: GameExport_EyelidTools.js ran without a page-script error', false, String(e?.stack ?? e)); }

  // ================================================================ CMD-B18c: LipSynch.js
  try {
    S.env.FACEROBOTDATAROOT = 'C:\\FR\\Data'; S.env.FACEROBOTROOT = 'C:\\FR'; S.env.project = 'C:\\Proj';
    fs.ensureFolder('C:\\FR\\Data\\Viseme\\USEnglish\\Normal'); fs.ensureFolder('C:\\Proj');
    fs.writeFile('C:\\FR\\Data\\Viseme\\USEnglish.csv', '# IPA,name,sound,type\n0x0061,a,father,1\r\n0x0062,b,bat,2\n skipped,x\nlonely\n');
    model.addProperty(P('FaceCalibrateProperties', []));
    const ctl = T.newNull('MouthCtl_Control', model); ctl.userKeywords = 'Mouth,Control';
    const jaw = T.newNull('JawEndCtl', model); jaw.userKeywords = 'Control,Jaw,End';
    // language parse
    const rows = T.parseLanguage('C:\\FR\\Data\\Viseme\\USEnglish.csv');
    ok('language csv: comment / leading-space / 1-field lines skipped; trailing CR kept harmless; type parsed', rows?.length === 2 && rows[0].ipa === '0x0061' && rows[0].type === 1 && rows[1].type === 2, rows);
    ok('language csv: display label "<name>  (\\"<sound>\\")  <ipa>" with 0x zeros collapsed', T.phonemeLabel(rows[0]) === 'a  ("father")  0x61');
    let r = run('fr_ImportVisemes', { Library: 'C:\\FR\\Data\\Viseme\\Nope' });
    ok('language csv: unreadable -> "File <<f>> is invalid"', has(r, /^File <C:\\FR\\Data\\Viseme\\Nope\.csv> is invalid$/), r.log);
    // fr_SaveVisemePose / fr_LoadVisemePose
    const pose = 'C:\\FR\\Data\\Viseme\\USEnglish\\Normal\\0x0061_a.frpre';
    ctl.kinematics.local.get('posy').value = 0.25;
    r = run('fr_SaveVisemePose', { FileName: pose });
    ok('fr_SaveVisemePose: all controls selected (Tongue / Jaw End / Mouth keyed), fr_SaveFacePose(true, file) writes the pose; returns Empty', r.v === undefined && fs.isFile(pose) && A.selection.length === 2 && A.selection.includes(ctl) && A.selection.includes(jaw), [r.err, A.selection.map(s => s.name)]);
    fs.writeFile('C:\\FR\\Data\\Viseme\\USEnglish\\Normal\\0x0099_zz.frpre', fs.readFile(pose)); fs.writeFile('C:\\FR\\Data\\Viseme\\USEnglish\\Normal\\notes.txt', 'x');
    ctl.kinematics.local.get('posy').value = 0;
    r = run('fr_LoadVisemePose', { FileName: pose });
    ok('fr_LoadVisemePose: fr_ApplyFacePose(file) result returned (control pose restored)', Array.isArray(r.v) && near(ctl.kinematics.local.val('posy'), 0.25), [r.err, r.v]);
    r = run('fr_LoadVisemePose', { FileName: 'C:\\nope.frpre' });
    ok('fr_LoadVisemePose: missing -> Pose "<f>" not found, null', r.v === null && has(r, /^Pose "C:\\nope\.frpre" not found$/));
    // fr_ImportVisemes
    r = run('fr_ImportVisemes', { Library: 'C:\\FR\\Data\\Viseme\\USEnglish', Variation: '', Overwrite: false });
    const vs = () => model.properties.filter(p => p.type === 'actionsource' && p.sourceClass === 'viseme');
    ok('fr_ImportVisemes: source _<file>_<variation> stored from the pose; unknown IPA warned; controls reset', !r.err && vs().map(p => p.name).join() === '_0x0061_a_Normal' && has(r, /^Viseme "C:\\FR\\Data\\Viseme\\USEnglish\\Normal\\0x0099_zz\.frpre" not found in language file - ignoring$/) && ctl.kinematics.local.val('posy') === 0, [r.err, vs().map(p => p.name), r.log]);
    ok('fr_ImportVisemes: StoreViseme with the phoneme type of the csv row (1)', JSON.stringify(vs()[0]?.val('data') ?? '').includes('PhonemeType') && S.calls.some(c => c.name === 'StoreViseme' && c.args.PhonemeType === 1));
    r = run('fr_ImportVisemes', { Library: 'C:\\FR\\Data\\Viseme\\USEnglish', Variation: 'Normal', Overwrite: false });
    ok('fr_ImportVisemes: Overwrite false keeps the existing source (no message)', vs().length === 1 && !has(r, /a_Normal/));
    r = run('fr_ImportVisemes', { Library: 'C:\\FR\\Data\\Viseme\\USEnglish', Variation: 'Normal', Overwrite: true });
    ok('fr_ImportVisemes: Overwrite true replaces it (one source, same name)', vs().length === 1 && vs()[0].name === '_0x0061_a_Normal');
    r = run('fr_ImportVisemes', { Library: 'C:\\FR\\Data\\Viseme\\USEnglish', Variation: 'Missing', Overwrite: true });
    ok('fr_ImportVisemes: missing variation folder -> script error (inferred)', !!r.err && r.err.includes('fr_ImportVisemes'));
    // fr_EditVisemes and its PPG
    r = run('fr_EditVisemes');
    const vp = r.v; const ppg = vp?.ppg;
    ok('fr_EditVisemes: fr_Visemes on the face model (LibraryPath = factory folder, Language, Phoneme, Variation, PhonemeName), inspected, returned', vp?.name === 'fr_Visemes' && vp.parent === model && vp.params.map(p => p.name).join() === 'LibraryPath,Language,Phoneme,Variation,PhonemeName' && vp.val('LibraryPath') === 'C:\\FR\\Data\\Viseme' && S.inspected.at(-1)?.prop === vp, vp?.params.map(p => [p.name, p.value]));
    ok('fr_Visemes PPG: validates (USEnglish, Normal, first phoneme 0x0061 / a); "<not defined>" suffix for poses without a file; Apply enabled', vp.val('Phoneme') === '0x0061' && vp.val('PhonemeName') === 'a' && ppg.items[1].label === 'b  ("bat")  0x62      <not defined>' && ppg.items[0].label === 'a  ("father")  0x61' && ppg.enabled.Apply === true && ppg.enabled['Import Visemes...'] === true, ppg?.items);
    ppg.save();
    ok('fr_Visemes Save on a factory pose: Yes/No "Warning, you are about to overwrite a factory installed visemes.  Continue?" (No: not saved)', FR.boxes.at(-1)?.caption === 'Overwrite Factory Viseme' && FR.boxes.at(-1).text === 'Warning, you are about to overwrite a factory installed visemes.  Continue?');
    FR.hooks.msgBox = () => 6;
    S.hooks.modal = (p) => { if (p.name === 'New_Variation') { p.set('Variation', 'My Var_1.'); p.set('CopyFrom', 'Normal'); } return true; };
    let m0 = A.log.length; ppg.newVariation();
    ok('fr_Visemes New...: illegal characters removed (info), fr_CreateVisemeVariation copies the poses, temporary property deleted', fs.isFolder('C:\\FR\\Data\\Viseme\\USEnglish\\MyVar1') && fs.isFile('C:\\FR\\Data\\Viseme\\USEnglish\\MyVar1\\0x0061_a.frpre') && A.log.slice(m0).some(l => l.text === 'Removed illegal characters from variation name') && !prop(A.scene.root, 'New_Variation'));
    m0 = A.log.length; ppg.newVariation();
    ok('fr_Visemes New...: existing -> Variation "MyVar1" already exists', A.log.slice(m0).some(l => l.text === 'Variation "MyVar1" already exists'));
    S.hooks.modal = (p) => { if (p.name === 'Create_New_Library') p.set('ToLibraryPath', 'C:\\Proj\\Viseme'); return true; };
    ppg.createLibrary();
    ok('fr_Visemes Create New Library: fr_CopyVisemeLibrary to <project>\\Viseme, LibraryPath switched, property deleted', vp.val('LibraryPath') === 'C:\\Proj\\Viseme' && fs.isFile('C:\\Proj\\Viseme\\USEnglish.csv') && fs.isFile('C:\\Proj\\Viseme\\USEnglish\\MyVar1\\0x0061_a.frpre') && !fs.isFile('C:\\Proj\\Viseme\\USEnglish\\Normal\\notes.txt') && !prop(A.scene.root, 'Create_New_Library'), vp.val('LibraryPath'));
    S.hooks.modal = () => true;
    ppg.corrective();
    ok('fr_Visemes Corrective: shape _<Phoneme>_<PhonemeName>_<Variation>_Shape created; label becomes Edit Corrective Shape', mesh.properties.some(p => p.type === 'shapekey' && p.name === '_0x0061_a_Normal_Shape') && ppg.correctiveLabel === 'Edit Corrective Shape', mesh.properties.map(p => p.name));
    delete FR.hooks.msgBox; delete S.hooks.modal;
    // fr_CopyVisemeLibrary
    r = run('fr_CopyVisemeLibrary', { From: 'C:\\FR\\Data\\Viseme', To: 'C:\\Proj2\\Lib', Overwrite: false, CopyVisemes: false });
    ok('fr_CopyVisemeLibrary CopyVisemes false: language csv + <lang>\\Normal only; null', r.v === null && fs.isFile('C:\\Proj2\\Lib\\USEnglish.csv') && fs.isFolder('C:\\Proj2\\Lib\\USEnglish\\Normal') && !fs.isFolder('C:\\Proj2\\Lib\\USEnglish\\MyVar1') && !fs.isFile('C:\\Proj2\\Lib\\USEnglish\\Normal\\0x0061_a.frpre'));
    r = run('fr_CopyVisemeLibrary', { From: 'C:\\FR\\Data\\Viseme', To: 'C:\\FR\\Data\\Viseme' });
    ok('fr_CopyVisemeLibrary: same folder -> "Source and destination is the same directory"', has(r, /^Source and destination is the same directory$/));
    r = run('fr_CopyVisemeLibrary', { From: 'C:\\Nope', To: 'C:\\X' });
    ok('fr_CopyVisemeLibrary: missing source -> Source library "<From>" does not exist', has(r, /^Source library "C:\\Nope" does not exist$/));
    r = run('fr_CopyVisemeLibrary', { From: 'C:\\FR\\Data\\Viseme' });
    ok('fr_CopyVisemeLibrary: To null -> "No destination library specified."', has(r, /^No destination library specified\.$/));
    fs.ensureFolder('C:\\EmptyLib');
    r = run('fr_CopyVisemeLibrary', { From: 'C:\\EmptyLib', To: 'C:\\Out' });
    ok('fr_CopyVisemeLibrary: no csv -> No language files found under "<From>"', has(r, /^No language files found under "C:\\EmptyLib"$/));
    // fr_CreateVisemeVariation
    r = run('fr_CreateVisemeVariation', { Variation: 'C:\\Proj\\Viseme\\USEnglish\\Happy', CopyFrom: 'C:\\Proj\\Viseme\\USEnglish\\Normal' });
    ok('fr_CreateVisemeVariation: folder created, .frpre copied (others not), null', r.v === null && fs.isFile('C:\\Proj\\Viseme\\USEnglish\\Happy\\0x0061_a.frpre') && !fs.isFile('C:\\Proj\\Viseme\\USEnglish\\Happy\\notes.txt'));
    r = run('fr_CreateVisemeVariation', { Variation: 'C:\\Proj\\Viseme\\USEnglish\\Happy' });
    ok('fr_CreateVisemeVariation: exists -> Variation folder "<v>" already exists', has(r, /^Variation folder "C:\\Proj\\Viseme\\USEnglish\\Happy" already exists$/));
    r = run('fr_CreateVisemeVariation', { Variation: 'C:\\Proj\\Viseme\\USEnglish\\Sad', CopyFrom: 'C:\\Nope' });
    ok('fr_CreateVisemeVariation: missing CopyFrom -> Based on variation folder "<c>" not found', has(r, /^Based on variation folder "C:\\Nope" not found$/) && !fs.isFolder('C:\\Proj\\Viseme\\USEnglish\\Sad'));
    // fr_CreateVisemeShape
    const nk = () => mesh.properties.filter(p => p.type === 'shapekey').length; const k0 = nk();
    r = run('fr_CreateVisemeShape', { ShapeName: 'MyShape' });
    ok('fr_CreateVisemeShape: StoreShapeKey on the face mesh, clustershapecombiner ShowResult false / SoloIndex 1', nk() === k0 + 1 && S.values[`${mesh.fullName}.clustershapecombiner.SoloIndex`] === 1 && S.values[`${mesh.fullName}.clustershapecombiner.ShowResult`] === false);
    run('fr_CreateVisemeShape', { ShapeName: 'MyShape' }); run('fr_CreateVisemeShape', { ShapeName: '' });
    ok('fr_CreateVisemeShape: existing shape / empty name -> nothing', nk() === k0 + 1);
    // fr_AddLipSync
    fs.ensureFolder('C:\\FR\\Data\\Audio'); fs.writeFile('C:\\FR\\Data\\Audio\\hi.txt', 'hello there');
    r = run('fr_AddLipSync');
    const lp = prop(model, 'fr_LipSync');
    ok('fr_AddLipSync: fr_LipSync (Language, Audio, Text, TextText, Offset 1, TrailingSilenceDuration 10) inspected; returns Empty; Audio folder created', r.v === undefined && lp?.params.map(p => p.name).join() === 'Language,Audio,Text,TextText,Offset,TrailingSilenceDuration' && lp.val('Offset') === 1 && lp.val('TrailingSilenceDuration') === 10 && fs.isFolder('C:\\FR\\Data\\Audio') && S.inspected.at(-1)?.prop === lp, lp?.params.map(p => p.name));
    lp.set('Audio', 'C:\\FR\\Data\\Audio\\hi.wav');
    ok('fr_LipSync: Audio change -> Text = audio with .txt, TextText loaded', lp.val('Text') === 'C:\\FR\\Data\\Audio\\hi.txt' && lp.val('TextText') === 'hello there', [lp.val('Text'), lp.val('TextText')]);
    lp.set('TextText', 'changed'); lp.ppg.save();
    ok('fr_LipSync Save: existing file -> Yes/No "Overwrite existing file: <f>?" (No: not written)', FR.boxes.at(-1)?.caption === 'Overwrite File' && FR.boxes.at(-1).text === 'Overwrite existing file: C:\\FR\\Data\\Audio\\hi.txt?' && fs.readFile('C:\\FR\\Data\\Audio\\hi.txt') === 'hello there');
    FR.hooks.msgBox = () => 6; lp.set('TextText', 'changed'); lp.ppg.save(); delete FR.hooks.msgBox;
    ok('fr_LipSync Save: Yes -> written and read back', fs.readFile('C:\\FR\\Data\\Audio\\hi.txt') === 'changed' && lp.val('TextText') === 'changed');
    lp.set('Text', ''); m0 = A.log.length; lp.ppg.reload();
    ok('fr_LipSync Reload: no file name -> "No filename specified."', A.log.slice(m0).some(l => l.text === 'No filename specified.'));
    // fr_ImportSpeech
    fs.writeFile('C:\\FR\\Data\\Audio\\hi.wav', 'RIFF');
    r = run('fr_ImportSpeech', { AudioFileName: 'C:\\FR\\Data\\Audio\\hi.wav', TextFileName: 'C:\\nope.txt', Offset: 5, Language: 0 });
    ok('fr_ImportSpeech: missing transcript -> "ImportSpeech: invalid audio/text files", null', r.v === null && has(r, /^ImportSpeech: invalid audio\/text files$/));
    r = run('fr_ImportSpeech', { AudioFileName: 'C:\\FR\\Data\\Audio\\hi.wav', TextFileName: 'C:\\FR\\Data\\Audio\\hi.txt', Offset: 5, Language: 0 });
    const bar = S.progress.filter(p => p.caption === 'Create Speech Clip').at(-1);
    ok('fr_ImportSpeech: progress "Create Speech Clip" (max 4) with Import Audio / Add Speech Clip; ImportAudio, AddTrack Phoneme_Speech (0) / Phoneme_Audio (2), AddAudioClip at the offset',
      !r.err && bar?.max === 4 && bar.status[0] === 'Import Audio' && bar.status[1] === 'Add Speech Clip' && S.calls.some(c => c.name === 'AddTrack' && c.args.Name === 'Phoneme_Speech' && c.args.Type === 0) && S.calls.some(c => c.name === 'AddTrack' && c.args.Name === 'Phoneme_Audio' && c.args.Type === 2) && S.calls.some(c => c.name === 'AddAudioClip' && c.args.Time === 5), [r.err, bar]);
    ok('fr_ImportSpeech: face mesh keyed Face,Mesh; this build\'s CreateSpeechAction finds no tagged mouth controls -> "ImportSpeech: unable to create speech action", clean-up, null',
      r.v === null && has(r, /^ImportSpeech: unable to create speech action$/) && String(mesh.userKeywords).split(',').includes('Mesh') && S.calls.some(c => c.name === 'DeleteObj'), [r.v, r.log.filter(l => /ImportSpeech/.test(l))]);
  } catch (e) { ok('section B18c: LipSynch.js ran without a page-script error', false, String(e?.stack ?? e)); }

  // ================================================================ CMD-B18c: Tongue.js
  try {
    // AddToGroup_tongue
    let r = run('AddToGroup_tongue', { Model: model, gname: 'TongueGrp', members: 'FaceMesh' });
    const tg = r.v;
    ok('AddToGroup_tongue: new group on the model with the members (text turned into a collection)', tg?.name === 'TongueGrp' && tg.members.length === 1 && tg.members[0] === mesh, r.err);
    r = run('AddToGroup_tongue', { Model: model, gname: 'TongueGrp', members: [cube] });
    ok('AddToGroup_tongue: existing group -> AddMember, same group returned', r.v === tg && tg.members.length === 2);
    // GetCompounds_tongue
    fs.ensureFolder('C:\\FR\\Compounds'); fs.writeFile('C:\\FR\\Compounds\\a.xsicompound', 'x'); fs.writeFile('C:\\FR\\Compounds\\b.xsicompound', 'y');
    r = run('GetCompounds_tongue', { compound1: 'a.xsicompound', compound2: 'b.xsicompound' });
    ok('GetCompounds_tongue: two full paths under <FACEROBOTDATAROOT>\\..\\Compounds, argument order', JSON.stringify(r.v) === JSON.stringify(['C:\\FR\\Compounds\\a.xsicompound', 'C:\\FR\\Compounds\\b.xsicompound']), r.v);
    r = run('GetCompounds_tongue', { compound1: 'a.xsicompound', compound2: 'zz' });
    ok('GetCompounds_tongue: missing -> "Missing Compound <<path>>", null', r.v === null && has(r, /^Missing Compound <C:\\FR\\Compounds\\zz>$/));
    // fr_SetupTongueMaps
    const tmesh = T.meshObject('TongueStrip', [[-0.5, 0, 0], [0.5, 0, 0], [-0.5, 0, 1], [0.5, 0, 1], [-0.5, 0, 2], [0.5, 0, 2], [-0.5, 0, 3], [0.5, 0, 3]], [[0, 1, 3, 2], [2, 3, 5, 4], [4, 5, 7, 6]]); T.addObject(tmesh, model);
    const tc = [0, 1, 2, 3].map(z => { const n = T.newNull(`TC${z}`, null); n.kinematics.local.get('posz').value = z; return n; });
    r = run('fr_SetupTongueMaps', { ControlObjects: tc, Mesh: tmesh });
    const tcl = tmesh.clusters.find(c => c.name === 'TongueCluster');
    const um = r.v?.[0], bl = r.v?.[1];
    ok('fr_SetupTongueMaps: [UMap, Blend] on a complete TongueCluster; temptonguecurve deleted', um?.name === 'UMap' && bl?.name === 'Blend' && tcl?.isComplete && tcl.properties.includes(um) && !A.scene.find('temptonguecurve'), [r.err, um?.name]);
    ok('fr_SetupTongueMaps: UMap = normalised U of the closest curve point (z / 3 here), colour 255/125/0; Blend 1.0, colour 125/255/0', [0, 1, 2, 3, 4, 5, 6, 7].every(i => near(um.values.get(i), Math.floor(i / 2) / 3, 0.02)) && um.val('red') === 255 && um.val('green') === 125 && bl.val('green') === 255 && [...bl.values.values()].every(v => v === 1), [...(um?.values ?? [])]);
    // fr_ScaleTongueMesh
    const box = T.meshObject('TBox', [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]], [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6]]); T.addObject(box, null);
    r = run('fr_ScaleTongueMesh', { Mesh: box, Markers: [[1, 2, 3], [1, 3, 5], [1, 2.5, 4]] });
    const bp6 = Array.from(box.primitive.mesh().positions.slice(18, 21));
    ok('fr_ScaleTongueMesh: true; translation = Markers[0]; scale (dz/hz, dy/hy, dz/hz) about Markers[0] -> (0.5,1,0.5) becomes (2,1,2)', r.v === true && box.kinematics.local.val('posx') === 1 && box.kinematics.local.val('posz') === 3 && near(bp6[0], 2) && near(bp6[1], 1) && near(bp6[2], 2) && box.primitive.operators.length === 1, [r.err, bp6]);
    ok('fr_ScaleTongueMesh: empty Mesh -> false; no markers -> script error', run('fr_ScaleTongueMesh', { Markers: [[0, 0, 0]] }).v === false && !!run('fr_ScaleTongueMesh', { Mesh: box }).err);
    // fr_IsHeadMesh
    const fcp = prop(model, 'FaceConnections'); const oldM = fcp.val('Mesh');
    ok('fr_IsHeadMesh: FaceConnections.Mesh without "<model>." -> false', run('fr_IsHeadMesh', { Mesh: mesh }).v === false);
    fcp.set('Mesh', 'Face.FaceMesh');
    ok('fr_IsHeadMesh: FaceConnections.Mesh "Face.FaceMesh" -> true', run('fr_IsHeadMesh', { Mesh: mesh }).v === true);
    fcp.set('Mesh', oldM);
    cube.primitive.addOperator(new T.Operator('Facial Soft Tissue', 'fro_FacialSoftTissueOp', []));
    ok('fr_IsHeadMesh: an operator named Facial Soft Tissue -> true; other meshes false', run('fr_IsHeadMesh', { Mesh: cube }).v === true && run('fr_IsHeadMesh', { Mesh: box }).v === false);
    // GetTongueMarkers
    const kn = (n, kw, p) => { const o = T.newNull(n, model); o.userKeywords = kw; ['posx', 'posy', 'posz'].forEach((a, i) => { o.kinematics.local.get(a).value = p[i]; }); return o; };
    find('JawEndCtl').userKeywords = 'Jaw'; kn('JawEndK', 'Control,Jaw,End', [0, 0, 0]); kn('LowMouthK', 'Control,Lower,Mouth', [0, -1, 2]); kn('UpMouthK', 'Control,Upper,Mouth', [0, 1, 2]); kn('HeadK', 'Control,Head', [0, 2, -2]);
    const lc = A.log.length;
    r = run('GetTongueMarkers');
    const tm = r.v ?? []; const gp = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };
    const want = [[0, -0.4, -1], [0, 0.6, -0.8], [0, 1, 0.32], [0, 0, 1.16]];
    ok('GetTongueMarkers: TongueBase / Back / Front / Tip nulls under a new Fit null, positions from the four keyed controls', JSON.stringify(tm.map(o => o.name)) === '["TongueBase","TongueBack","TongueFront","TongueTip"]' && tm.every(o => o.parentObj?.name === 'Fit') && tm.every((o, i) => gp(o).every((v, k) => near(v, want[i][k]))), [r.err, tm.map(o => [o.name, gp(o)])]);
    ok('GetTongueMarkers: not logged (siNoLogging)', !A.log.slice(lc).some(l => l.kind === 'cmd' && /GetTongueMarkers/.test(l.text)));
    ok('GetTongueMarkers: existing Tongue* children of Fit are returned as they are', run('GetTongueMarkers').v?.length === 4 && [...model.descendants()].filter(o => o.name === 'Fit').length === 1);
    // GetTongueScale
    r = run('GetTongueScale', { MarkerVectors: [[0, 0, 0], [5, 5, 5], [1, 2, 3]] });
    ok('GetTongueScale: last - first', near(r.v?.x, 1) && near(r.v?.y, 2) && near(r.v?.z, 3), r);
    r = run('GetTongueScale', { MarkerVectors: { a: 1 } });
    ok('GetTongueScale: a list without length -> undefined, "not yet attested" (SPEC-PARTIAL)', r.v === undefined && nya(r));
    // fr_BuildTongueAfterSolve
    r = run('fr_BuildTongueAfterSolve');
    const ts = r.v;
    ok('fr_BuildTongueAfterSolve: TongueSetup (TongueMesh, Rescale, DeleteMesh) on the face model, inspected, returned', ts?.name === 'TongueSetup' && ts.parent === model && ts.params.map(p => p.name).join() === 'TongueMesh,Rescale,DeleteMesh' && S.inspected.at(-1)?.prop === ts);
    A.select([]); let m0 = A.log.length; ts.ppg.setToSelected();
    ok('TongueSetup Set to selected: nothing -> "Tongue must be of polymesh type, no tongue found\\n\\tSelect Polymesh tongue and try again"', A.log.slice(m0).some(l => l.text === 'Tongue must be of polymesh type, no tongue found\n\tSelect Polymesh tongue and try again'));
    A.select([tmesh, box]); m0 = A.log.length; ts.ppg.setToSelected();
    ok('TongueSetup Set to selected: two meshes -> warning, first one used', ts.val('TongueMesh') === tmesh.fullName && A.log.slice(m0).some(l => /^Only one tongue is allowed/.test(l.text)));
    // fr_FitTongueAfterSolveStage
    const hn = T.newNull('HeadNullT', model); store.put('hpoints', 'HeadNull', hn);
    r = run('fr_FitTongueAfterSolveStage', { TongueMesh: 'Nope' });
    ok('fr_FitTongueAfterSolveStage: fr_FitTongue fails -> "Failed to fit tongue", Empty', r.v === undefined && has(r, /^Failed to fit tongue$/), r.log);
    r = run('fr_FitTongueAfterSolveStage', { TongueMesh: tmesh });
    const fitN = [...model.descendants()].find(o => o.name === 'Fit');
    ok('fr_FitTongueAfterSolveStage: fr_FitTongue(HeadNull, mesh, GetTongueMarkers(), true) -> *_Marker nulls, markers deleted', !has(r, /^Failed to fit tongue$/) && fitN.children.filter(c => /_Marker$/.test(c.name)).length === 4 && !fitN.children.some(c => c.name === 'TongueBase'), [r.log, fitN?.children.map(c => c.name)]);
    // correction 8: fr_SolveTongue -> fr_IsHeadMesh / fr_ScaleTongueMesh with the mesh and the markers
    r = run('fr_SolveTongue', { Rescale: true });
    const e = FR.rows.B14e.calls; const sc = e.filter(c => c.name === 'fr_ScaleTongueMesh').at(-1), ih = e.filter(c => c.name === 'fr_IsHeadMesh').at(-1);
    ok('fr_SolveTongue (correction 8): fr_IsHeadMesh(Mesh) and fr_ScaleTongueMesh(Mesh, 4 marker vectors)', ih?.args.Mesh === tmesh && sc?.args.Mesh === tmesh && sc.args.Markers.length === 4, [r.err, ih?.args, sc?.args]);
    // fr_SolveTongueAfterSolveStage
    const nc = S.calls.length;
    r = run('fr_SolveTongueAfterSolveStage');
    ok('fr_SolveTongueAfterSolveStage: DeselectAll then fr_SolveTongue(); Empty', r.v === undefined && S.calls.slice(nc).map(c => c.name).join() === 'DeselectAll,fr_SolveTongue' && !has(r, /^Failed to solve tongue$/), r);
    // fr_PrepareForPhonemes (SPEC-PARTIAL)
    for (const c of [...fitN.children]) fitN.removeChild(c);
    r = run('fr_PrepareForPhonemes');
    ok('fr_PrepareForPhonemes: cmdlog off, SetControlKeys, camvis user keywords on, GetTongueMarkers markers made, then AddTongue fails ("not yet attested")', !!r.err && r.err.includes('AddTongue') && nya(r) && A.cmdLog === false && S.values['Views.ViewB.UserCamera.camvis.attrseluserkeywords'] === true && S.calls.some(c => c.name === 'SetControlKeys'), [r.err, r.log]);
    A.cmdLog = true;
  } catch (e) { ok('section B18c: Tongue.js ran without a page-script error', false, String(e?.stack ?? e)); }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
report('faceRobotStage1.ts Scan calls fr_CleanMeshModel with { Del: 1 } (correction 2)', /fr_CleanMeshModel', \{ Del: 1 \}/.test(stage1Src) && !/fr_CleanMeshModel', \{ Mode/.test(stage1Src));
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_fr_b18bc_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
