// CMD-B13b (Unfold3D.64.dll): the 12 commands of src/commands/unfoldB13b*.ts. There is no XSIBATCH golden for the row:
// this is a contract check against docs/ghidra/cmd-b13b-unfold3d-binary.md.
//   1. every name is registered with the registry argument list (data/command_registry.json, return values left out;
//      the add-on commands are not in the registry dump, so data/commands_full.json gives the list and defaults);
//   2. every command runs with its default arguments on the sample scene (cube selected) without an unexpected error
//      (commands whose required input has no default must fail with a message naming the command);
//   3. the contract's stated results (created nodes, cut lines, solver flag words, labels, logged texts, statuses, undo).
// The solver maths is an original stand-in (not attested): only flag words, parameters read, UVs written / non-zero /
// packed into 0..1 and the island-border pass are checked.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_unfold_b13b_commands.mjs
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

const NAMES = ['UnfoldAddToCut', 'UnfoldAdjustUpdate', 'UnfoldApply', 'UnfoldApplySel', 'UnfoldClearCut', 'UnfoldPackUpdate', 'UnfoldRegularize',
  'UnfoldRelax', 'UnfoldRemoveFromCut', 'UnfoldSelectCut', 'UnfoldSetCut', 'UnfoldUpdate'];
// Required input without a usable default (cube selected): the default run must fail with a message naming the command.
const DEFAULT_FAILS = new Set(['UnfoldAddToCut', 'UnfoldAdjustUpdate', 'UnfoldClearCut', 'UnfoldPackUpdate', 'UnfoldRegularize', 'UnfoldRelax',
  'UnfoldRemoveFromCut', 'UnfoldSelectCut', 'UnfoldSetCut', 'UnfoldUpdate']);

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  const args = c ? c.args.filter(a => !(a.flags & 0x200)) : f ? f.args.filter(a => !((a.flags ?? 0) & 0x200)) : null;
  return [n, args ? args.map(a => [a.name, a.default ?? fd[a.name] ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('UnfoldApply') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false;
  const S = A.unfoldB13b;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, re) => r.log.some(l => re.test(l));
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const cube = A.scene.find('cube');
  const reset = () => { A.compSel = null; A.select([cube]); };
  const APPLY = 'Object(s) and/or group(s) and/or Texture Projection(s)';
  const undoTo = (n) => { while (A.undoStack.length > n) A.undo(); };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length;
    const r = run(n);
    undoTo(u0);
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  reset();

  // ================= UnfoldApply
  let prop, rec;
  {
    const u0 = A.undoStack.length; const nc = cube.clusters.length;
    const r = run('UnfoldApply', { [APPLY]: [cube] });
    prop = r.v?.[0];
    ok('UnfoldApply: returns one UnfoldProperty named Unfold on the object', !r.err && r.v.length === 1 && prop.type === 'UnfoldProperty' && prop.name === 'Unfold' && cube.properties.includes(prop), r.err);
    const P = (n) => prop.val(n);
    ok('UnfoldApply: UnfoldProperty defaults (2.7)', P('Adjust_iterations') === 1 && P('Adjust_power') === 1 && P('Relax_iterations') === 1 && P('Relax_power') === 1 && P('Pack_spacing') === 0.01
      && P('Pack_islandrotation') === 0 && P('Pack_globalrotation') === 0 && P('Pack_packrandomseed') === 0 && P('Pack_sortordertype') === 1 && P('Pack_angleincrement') === 90
      && P('Pack_uvlayoutscalingmode') === 0 && P('Pack_scalingmode') === 1 && P('Pack_useboxpacking') === false && P('Pack_squareresol') === 0.5 && P('UnfoldSignature') === ''
      && P('Pack_live') === false && P('Connected_operators') === '' && Number.isInteger(P('UnfoldPropertyID')) && P('UnfoldPropertyID') >= 0 && P('UnfoldPropertyID') <= 32767,
    prop.params.map(p => [p.def.name, p.value]));
    ok('UnfoldApply: parameter ranges (Adjust_iterations 1..50 / 1..15, Pack_squareresol 0..4)', prop.get('Adjust_iterations').def.max === 50 && prop.get('Adjust_iterations').def.uimax === 15 && prop.get('Pack_squareresol').def.max === 4);
    const cut = cube.clusters.find(c => c.name === 'Unfold_CutLine'); const tag = cut?.properties[0];
    ok('UnfoldApply: empty edge cluster Unfold_CutLine with UnfoldCutTag carrying the property ID', cut?.compKind === 'edge' && cut.elements.size === 0 && tag?.name === 'UnfoldCutTag' && tag.type === 'UnfoldCutTagProperty' && tag.val('UnfoldPropertyID') === prop.val('UnfoldPropertyID'));
    const sc = cube.clusters.find(c => c.name === 'Texture_Coordinates_AUTO'); const proj = sc?.properties[0];
    ok('UnfoldApply: complete sample cluster Texture_Coordinates_AUTO with Texture Projection "Unfold", all UVs 0', sc?.compKind === 'sample' && sc.isComplete && proj?.name === 'Unfold' && proj.type === 'uvprojection' && proj.uvs.length === 48 && proj.uvs.every(v => v === 0), [sc?.compKind, proj?.uvs?.length]);
    ok('UnfoldApply: UnfoldOperator connected (output the projection, inputs projection + property)', S.unfoldOps.get(proj)?.property === prop && S.unfoldOps.get(proj).op.type === 'UnfoldOperator' && S.unfoldOps.get(proj).op.val('UnfoldPropertyID') === prop.val('UnfoldPropertyID'));
    rec = S.records.get(prop)[0];
    ok('UnfoldApply: one record {object, projection, sample cluster, cut cluster}', S.records.get(prop).length === 1 && rec.object === cube && rec.projection === proj && rec.sampleCluster === sc && rec.cutCluster === cut);
    ok('UnfoldApply: page relabelled without UVs ("Unfold No Pack" disabled, "Unfold and Pack")', S.pages.get(prop).Unfold.label === 'Unfold No Pack' && !S.pages.get(prop).Unfold.enabled && S.pages.get(prop).UnfoldAndPack.label === 'Unfold and Pack');
    ok('UnfoldApply: one undo step', A.undoStack.length === u0 + 1);
    A.undo(); ok('UnfoldApply: undo removes property, clusters', !cube.properties.includes(prop) && cube.clusters.length === nc);
    A.redo(); ok('UnfoldApply: redo', cube.properties.includes(prop) && cube.clusters.length === nc + 2);
    A.select([]); const re = run('UnfoldApply');
    ok('UnfoldApply: nothing unfoldable -> log, success, empty list', !re.err && Array.isArray(re.v) && re.v.length === 0 && has(re, /^Unfold3D: Nothing unfoldable selected\.\.\. Please select some object\(s\) and\/or group\(s\) and\/or Texture Projection\(s\) and retry$/), re);
    S.licensed = false; const rl = run('UnfoldApply', { [APPLY]: [cube] }); S.licensed = true;
    ok('UnfoldApply: licence failure logs "Unfold3D license is unvailable." and 0x80004005', status(rl, '80004005') && has(rl, /^Unfold3D license is unvailable\.$/), rl);
    reset();
  }
  // ================= UnfoldApply on a projection and on a group
  {
    const u0 = A.undoStack.length;
    const s = A.run('CreatePrim', { PresetObj: 'Sphere' }); const sph = typeof s === 'object' ? s : A.scene.find(String(s));
    const tp = A.run('CreateProjection', { InputObjs: [sph], Type: 'Planar XY' });
    const nc = sph.clusters.length;
    const r = run('UnfoldApply', { [APPLY]: [tp] });
    const p = r.v?.[0];
    ok('UnfoldApply on a texture projection: property on the owning object, the projection reused + UnfoldOperator', !r.err && p && sph.properties.includes(p) && S.records.get(p)[0].projection === tp && S.unfoldOps.get(tp)?.property === p && !sph.clusters.some(c => c.name === 'Texture_Coordinates_AUTO') && sph.clusters.length === nc + 1, r.err);
    ok('UnfoldApply on a projection with UVs: page labelled "Update No Pack" (enabled) / "Update and Pack"', S.pages.get(p)?.Unfold.label === 'Update No Pack' && S.pages.get(p).Unfold.enabled && S.pages.get(p).UnfoldAndPack.label === 'Update and Pack');
    const g = A.run('CreateGroup', { Name: 'B13bGroup', InputObjs: [cube, sph] });
    const rg = run('UnfoldApply', { [APPLY]: [g] }); const gp = rg.v?.[0];
    ok('UnfoldApply on a group: one property on the group driving every mesh member (inferred)', !rg.err && rg.v.length === 1 && gp.parent === g && S.records.get(gp).length === 2 && S.records.get(gp).map(x => x.object.name).join() === [cube.name, sph.name].join(), rg.err);
    undoTo(u0); reset();
  }
  // ================= UnfoldApplySel
  {
    const u0 = A.undoStack.length; const ni = S.inspected.length;
    const r = run('UnfoldApplySel');
    const p = cube.properties.find(x => x.type === 'UnfoldProperty' && x !== prop);
    ok('UnfoldApplySel: runs UnfoldApply on the selection, no return value', !r.err && r.v === undefined && !!p, r.err);
    const i = S.inspected[ni];
    ok('UnfoldApplySel: InspectObj(property, "", "Unfold3D parameters", 3, false)', S.inspected.length === ni + 1 && i.node === p && i.keywords === '' && i.title === 'Unfold3D parameters' && i.mode === 3 && i.throw === false);
    undoTo(u0); A.select([]);
    const re = run('UnfoldApplySel');
    ok('UnfoldApplySel: empty selection logs "Unfold3D: Nothing selected..." and succeeds', !re.err && has(re, /^Unfold3D: Nothing selected\.\.\. Please select some object\(s\) and\/or group\(s\) and\/or Texture Projection\(s\) and retry$/), re);
    reset();
  }
  const cut = () => rec.cutCluster;
  const edges = () => [...cut().elements].sort().join();
  // ================= UnfoldAddToCut / RemoveFromCut / SetCut
  {
    const u0 = A.undoStack.length;
    const r = run('UnfoldAddToCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[0,1]' });
    ok('UnfoldAddToCut: edges added to the cut cluster (all-zero UVs: no island borders)', !r.err && cut().elements.size === 2, [r.err, edges()]);
    ok('UnfoldAddToCut: no UVs yet -> no solver run', !S.solverCalls.some(c => c.property === prop));
    ok('UnfoldAddToCut: one undo step', A.undoStack.length === u0 + 1);
    const rr = run('UnfoldRemoveFromCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[0]' });
    ok('UnfoldRemoveFromCut: edge removed', !rr.err && cut().elements.size === 1, edges());
    run('UnfoldAddToCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[0,1,2]' });
    const rs = run('UnfoldSetCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[3,4]' });
    ok('UnfoldSetCut: the cut line becomes exactly the given edges', !rs.err && cut().elements.size === 2 && !cut().elements.has('0-1'), edges());
    const rb = run('UnfoldAddToCut', { UnfoldProperty: cube, 'EdgeList(s)': 'cube.edge[0]' });
    ok('UnfoldAddToCut: not an UnfoldProperty -> "Unfold: argument 1 must be an UnfoldProperty property", 0x80070057', status(rb, '80070057') && has(rb, /^Unfold: argument 1 must be an UnfoldProperty property$/), rb);
    const re = run('UnfoldAddToCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.poly[0]' });
    ok('UnfoldAddToCut: no edges -> "Unfold: could not find edge subcomponents in argument 2", 0x80070057', status(re, '80070057') && has(re, /^Unfold: could not find edge subcomponents in argument 2$/), re);
    A.selectComponents(cube, 'edge', ['0-1']); A.select([prop]);
    const rsel = run('UnfoldRemoveFromCut', { 'EdgeList(s)': 'cube.edge[3]' });
    ok('UnfoldRemoveFromCut: UnfoldProperty from the selection', !rsel.err && cut().elements.size === 1, rsel.err);
    undoTo(u0); reset();
  }
  // ================= UnfoldUpdate / island borders / ClearCut / SelectCut
  {
    const u0 = A.undoStack.length;
    run('UnfoldSetCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[0-11]' });
    ok('fixture: every cube edge on the cut line', cut().elements.size === 12, edges());
    const n0 = S.solverCalls.length;
    const r = run('UnfoldUpdate', { 'UnfoldProperty(s)': prop });
    const call = S.solverCalls[n0]; const uv = rec.projection.uvs;
    ok('UnfoldUpdate: default Options "DoPack" -> solver flags 5, Pack_* parameters read in order', !r.err && call?.flags === 5 && Object.keys(call.params).filter(k => k.startsWith('Pack_')).join() === 'Pack_spacing,Pack_islandrotation,Pack_globalrotation,Pack_packrandomseed,Pack_sortordertype,Pack_angleincrement,Pack_uvlayoutscalingmode,Pack_scalingmode,Pack_useboxpacking,Pack_squareresol', [r.err, call]);
    ok('UnfoldUpdate: UVs written, non-zero, packed into 0..1', uv.some(v => v !== 0) && uv.every(v => v >= -1e-6 && v <= 1 + 1e-6), Array.from(uv).slice(0, 8));
    ok('UnfoldUpdate: UnfoldSignature written, page relabelled "Update No Pack" / "Update and Pack"', prop.val('UnfoldSignature') !== '' && S.pages.get(prop).Unfold.label === 'Update No Pack' && S.pages.get(prop).Unfold.enabled && S.pages.get(prop).UnfoldAndPack.label === 'Update and Pack');
    ok('UnfoldUpdate: solver stand-in logged as not yet attested', has(r, /not yet attested: the Unfold3D unfold solver/) && has(r, /not yet attested: the Unfold3D packer/));
    run('UnfoldUpdate', { 'UnfoldProperty(s)': prop, Options: '' }); ok('UnfoldUpdate: Options "" -> flags 1', S.solverCalls.at(-1).flags === 1);
    run('UnfoldUpdate', { 'UnfoldProperty(s)': prop, Options: 'DoPack UseIslandSelection' }); ok('UnfoldUpdate: DoPack + UseIslandSelection -> flags 13', S.solverCalls.at(-1).flags === 13);
    run('UnfoldUpdate', { 'UnfoldProperty(s)': prop, Options: 'dopack' }); ok('UnfoldUpdate: option tests are case-sensitive ("dopack" -> 1)', S.solverCalls.at(-1).flags === 1);
    const rb = run('UnfoldUpdate', { 'UnfoldProperty(s)': [prop, cube] });
    ok('UnfoldUpdate: a bad item -> "Unfold: argument 1 must be UnfoldProperty property", 0x80004005', status(rb, '80004005') && has(rb, /^Unfold: argument 1 must be UnfoldProperty property$/), rb);
    // cut edits once the property has UVs run the solver with the refresh flag
    const n1 = S.solverCalls.length;
    run('UnfoldAddToCut', { UnfoldProperty: prop, 'EdgeList(s)': 'cube.edge[0]', Options: '' });
    ok('UnfoldAddToCut: property with UVs -> solver flag 0x20', S.solverCalls.length === n1 + 1 && S.solverCalls.at(-1).flags === 0x20);
    // ClearCut and the island-frontier pass
    run('UnfoldUpdate', { 'UnfoldProperty(s)': prop, Options: '' });
    const rc = run('UnfoldClearCut', { 'UnfoldProperty(s)': prop });
    ok('UnfoldClearCut: cut cluster emptied, refresh run (flag 0x20)', !rc.err && cut().elements.size === 0 && S.solverCalls.at(-1).flags === 0x20, [rc.err, edges()]);
    A.undo();
    const rf = run('UnfoldClearCut', { 'UnfoldProperty(s)': prop, Options: 'AddIslandFrontiersFromUVCoords' });
    ok('UnfoldClearCut AddIslandFrontiersFromUVCoords: the UV-island borders are added back (every face its own island: 12 edges)', !rf.err && cut().elements.size === 12, edges());
    const rcb = run('UnfoldClearCut', { 'UnfoldProperty(s)': cube });
    ok('UnfoldClearCut: bad item -> "Unfold: argument 1 must be UnfoldProperty property collection", 0x80004005', status(rcb, '80004005') && has(rcb, /^Unfold: argument 1 must be UnfoldProperty property collection$/), rcb);
    // SelectCut
    A.select([cube]);
    const rsc = run('UnfoldSelectCut', { UnfoldProperty: prop, Options: '' });
    ok('UnfoldSelectCut: the cut-line edges selected on the object, filter Edge', !rsc.err && A.compSel?.obj === cube && A.compSel.kind === 'edge' && A.compSel.edges.size === 12 && A.selMode === 'edge', [rsc.err, A.compSel?.edges?.size, A.selMode]);
    const rsb = run('UnfoldSelectCut', { UnfoldProperty: cube });
    ok('UnfoldSelectCut: not an UnfoldProperty -> message, 0x80070057', status(rsb, '80070057') && has(rsb, /^Unfold: argument 1 must be an UnfoldProperty property$/));
    A.run('SetSelFilter', { SelFilter: 'object' });
    // PackUpdate / AdjustUpdate
    const np = S.solverCalls.length;
    const rp = run('UnfoldPackUpdate', { 'UnfoldProperty(s)': prop });
    ok('UnfoldPackUpdate: solver flag 4, UVs in 0..1', !rp.err && S.solverCalls.length === np + 1 && S.solverCalls.at(-1).flags === 4 && rec.projection.uvs.every(v => v >= -1e-6 && v <= 1 + 1e-6), rp.err);
    const rp1 = run('UnfoldPackUpdate', { 'UnfoldProperty(s)': cube });
    ok('UnfoldPackUpdate: not a custom property -> "Unfold: argument 1 must be an array of UnfoldProperty", 0x80070057', status(rp1, '80070057') && has(rp1, /^Unfold: argument 1 must be an array of UnfoldProperty$/), rp1);
    const Prop = cube.properties[0].constructor; const other = new Prop('B13bOther', 'CustomProperty', []); cube.addProperty(other);
    const rp2 = run('UnfoldPackUpdate', { 'UnfoldProperty(s)': other });
    ok('UnfoldPackUpdate: custom property of another type -> "Unfold: argument  1 must be an array of UnfoldProperty" (two spaces)', status(rp2, '80070057') && has(rp2, /^Unfold: argument {2}1 must be an array of UnfoldProperty$/), rp2);
    cube.removeProperty(other);
    const ra = run('UnfoldAdjustUpdate', { 'UnfoldProperty(s)': prop });
    ok('UnfoldAdjustUpdate: default DoRegularize -> flag 2, Adjust_power / Adjust_iterations read', !ra.err && S.solverCalls.at(-1).flags === 2 && S.solverCalls.at(-1).params.Adjust_power === 1 && S.solverCalls.at(-1).params.Adjust_iterations === 1, ra.err);
    run('UnfoldAdjustUpdate', { 'UnfoldProperty(s)': prop, Options: 'DoRelax' });
    ok('UnfoldAdjustUpdate: DoRelax -> flag 0x10, Relax_* read', S.solverCalls.at(-1).flags === 0x10 && 'Relax_power' in S.solverCalls.at(-1).params);
    const before = Array.from(rec.projection.uvs);
    A.selectComponents(cube, 'polygon', [0]);
    run('UnfoldAdjustUpdate', { 'UnfoldProperty(s)': prop, Options: 'DoRelax' });
    ok('UnfoldAdjustUpdate: restricted to the selected samples (other samples unchanged)', Array.from(rec.projection.uvs).every((v, i) => i < 8 || v === before[i]));
    const rab = run('UnfoldAdjustUpdate', { 'UnfoldProperty(s)': cube });
    ok('UnfoldAdjustUpdate: bad item -> 0x80004005 without a log message', status(rab, '80004005') && !rab.log.some(l => /^Unfold: /.test(l)), rab);
    S.licensed = false; const rl = run('UnfoldUpdate', { 'UnfoldProperty(s)': prop }); S.licensed = true;
    ok('solver driver: licence failure logs the licence text, 0x80004005', status(rl, '80004005') && has(rl, /^Unfold3D license is unvailable\.$/));
    undoTo(u0); reset();
    ok('UnfoldUpdate etc.: undo back to the zero UVs and an empty cut line', cut().elements.size === 0 && rec.projection.uvs.every(v => v === 0) && prop.val('UnfoldSignature') === '');
  }
  // ================= UnfoldRegularize / UnfoldRelax
  {
    const u0 = A.undoStack.length; const n0 = S.optimizeOps.length; const ni = S.inspected.length;
    const r = run('UnfoldRegularize', { 'Texture Projection': rec.projection, 'Samples to Regularize': 'cube.sample[0,1]' });
    const op = r.v;
    ok('UnfoldRegularize: returns a new UnfoldOptimizeOperator (Iterations 2, Power 1, Options Regularize, sample sets)', !r.err && op?.type === 'UnfoldOptimizeOperator' && op.val('Iterations') === 2 && op.val('Power') === 1 && op.val('Options') === 'Regularize' && op.val('SampleSelectionSet') === 'cube.sample[0,1]' && op.val('SamplePinnedSet') === '' && S.optimizeOps.length === n0 + 1, r.err);
    ok('UnfoldRegularize: ports TextureProjection / SampleCluster / Primitive', op.outputPorts.TextureProjection === rec.projection && op.inputPorts.SampleCluster === rec.sampleCluster && op.inputPorts.Primitive === cube.primitive);
    ok('UnfoldRegularize: InspectObj on the operator', S.inspected.length === ni + 1 && S.inspected.at(-1).node === op);
    const rx = run('UnfoldRelax', { 'Texture Projection': rec.projection, 'Samples to Relax': 'cube.sample[2]', 'Pinned Samples': 'cube.sample[3]' });
    ok('UnfoldRelax: Options Relax, pinned set', !rx.err && rx.v.val('Options') === 'Relax' && rx.v.val('SamplePinnedSet') === 'cube.sample[3]', rx.err);
    const rb = run('UnfoldRelax', { 'Texture Projection': cube });
    ok('UnfoldRelax: not a texture projection -> "UnfoldApplyOptimizeOperator : argument 0 must be a Texture Projection (ClusterProperty of SampleCluster)", 0x80070057', status(rb, '80070057') && has(rb, /^UnfoldApplyOptimizeOperator : argument 0 must be a Texture Projection \(ClusterProperty of SampleCluster\)$/), rb);
    ok('UnfoldRegularize: one undo step each', A.undoStack.length === u0 + 2);
    undoTo(u0); ok('UnfoldRegularize: undo', S.optimizeOps.length === n0);
    reset();
  }
  return out;
}, { NAMES, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: registry argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_unfold_b13b_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
