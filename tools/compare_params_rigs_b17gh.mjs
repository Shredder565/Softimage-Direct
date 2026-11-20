// CMD-B17g / CMD-B17h: parameters.vbs, tools.vbs, enveloping.vbs, UserDataScripts.vbs, command.js, rigs.vbs,
// Charac_Tools.js and Charac_LoadBipedGuide.vbs script commands. No XSIBATCH golden exists: this is a contract check
// against the "Wire contract" sections of docs/ghidra/cmd-b17g-parameters-tools-enveloping-userdata-scripts.md and
// docs/ghidra/cmd-b17h-command-rigs-charac-duplicate-scripts.md and the cmd-b17g / cmd-b17h corrections of
// docs/re/WIRE_CORRECTIONS_B17.md.
//   1. every command is registered with the catalogue argument list (data/commands_full.json, first entry);
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (RandomizeParameters with nothing marked raises siErrCancelled as the contract says);
//   3. the contract's stated results (pick loops fed through the pick session, dialogs through app.cmdB17gh.hooks).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_params_rigs_b17gh.mjs
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

const NAMES = ['RandomizeParameters', 'CreateDisplayInfo', 'SampleParameterValues', 'PaintPushTool', 'ColorizeObject', 'ShadeObject',
  'SelectDeformersFromEnvelope', 'AssociateEnvelopeBoundingVolume', 'CreateUserDataMapAndPickTemplate', 'InspectUserData',
  'EditCommand', 'CreateAndEditCommand', 'CreateSpine', 'TagObject', 'TagStepMarks', 'GetProportionalGuide'];
/** Default run (cube selected): expected status, or null = must succeed. */
const DEFAULT_STATUS = { RandomizeParameters: '80004004' };
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
await page.waitForFunction(() => !!window.Application?.commands?.get('TagStepMarks') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_STATUS }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail, (k, v) => (v && typeof v === 'object' && v.constructor?.name !== 'Object' && !Array.isArray(v) ? (v.name ?? String(v)) : v)).slice(0, 400)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const has = (r, re) => (r.log ?? []).some(l => re.test(l));
  const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
  const cube = A.scene.find('cube');
  const S = () => A.cmdB17gh;
  const session = () => A.miscDsScripts?.session;
  const endSession = () => { const s = session(); if (s?.active) s.cancel(); };
  const reset = () => { endSession(); A.setTool?.(null); A.setSelMode?.('object'); A.compSel = null; A.select([cube]); A.anim.marked.clear(); S().hooks.inspect = null; A.tasksB11b.pickHook = null; };
  const trace = (names, f) => {
    const saved = names.map(n => [n, A.commands.get(n), A.commands.get(n).execute]); const calls = [];
    for (const [n, d, orig] of saved) d.execute = (app, a) => { calls.push({ n, a: { ...a } }); return orig.call(d, app, a); };
    try { f(); } finally { for (const [, d, orig] of saved) d.execute = orig; }
    return calls;
  };
  const nul = (name, x = 0, y = 0, z = 0, parent) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: name, Parent: parent?.name ?? '' }); const l = o.kinematics.local; l.set('posx', x); l.set('posy', y); l.set('posz', z); return o; };
  const Prop = cube.properties[0].constructor;
  const P = (o) => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs
  for (const n of NAMES) {
    reset(); const r = run(n); endSession();
    const want = DEFAULT_STATUS[n];
    out.defaults[n] = want ? (status(r, want) ? 'expected-failure' : 'WRONG: ' + (r.err ?? 'no error')) : (r.err ? 'ERROR: ' + r.err : 'ok');
  }
  reset();

  // fixture: a property with a ranged double, a boolean and a double without a range
  const fx = new Prop('b17fx', 'customparamset', [
    { name: 'a', type: 'double', value: 5, min: 0, max: 10, animatable: true },
    { name: 'u', type: 'double', value: 5, uimin: 2, uimax: 4, min: -100, max: 100, animatable: true },
    { name: 'b', type: 'bool', value: false },
    { name: 'free', type: 'double', value: 1, animatable: true }]);
  cube.addProperty(fx);
  const pa = fx.get('a'), pu = fx.get('u'), pb = fx.get('b'), pf = fx.get('free');

  // ================= RandomizeParameters
  try {
    let r = run('RandomizeParameters');
    ok('RandomizeParameters: nothing marked -> log "No valid parameter marking selection", siErrCancelled', status(r, '80004004') && has(r, /^No valid parameter marking selection$/), r);
    A.anim.marked.add(pa); A.anim.marked.add(pb); A.anim.marked.add(pu);
    pa.value = 5; pu.value = 5;
    r = run('RandomizeParameters', { percentage: 0.5, relative: false, seed: -7 }); const v1 = [pa.value, pb.value, pu.value];
    ok('RandomizeParameters absolute 0.5: value = r x half + (min+max)/2 inside the range (a in [2.5, 7.5])', !r.err && v1[0] >= 2.5 && v1[0] <= 7.5 && typeof v1[1] === 'boolean', [r.err, v1]);
    ok('RandomizeParameters: GetParamRange takes the suggested (UI) range first (u in [2.5, 3.5])', v1[2] >= 2.5 && v1[2] <= 3.5, v1);
    pa.value = 5; pu.value = 5; pb.value = false;
    run('RandomizeParameters', { percentage: 0.5, relative: false, seed: -7 }); const v2 = [pa.value, pb.value, pu.value];
    ok('RandomizeParameters seed < 0: repeatable sequence', JSON.stringify(v1) === JSON.stringify(v2), [v1, v2]);
    run('RandomizeParameters', { percentage: 0.5, relative: false, seed: 3 }); const v3 = [pa.value, pu.value];
    ok('RandomizeParameters seed > 0: next numbers of the sequence (no reseed)', JSON.stringify(v3) !== JSON.stringify([v1[0], v1[2]]), v3);
    pa.value = 9;
    run('RandomizeParameters', { params: [pa], percentage: 0.1, relative: true, seed: -3 });
    ok('RandomizeParameters relative 0.1: base = current value (9 +- 0.5)', pa.value >= 8.5 && pa.value <= 9.5, pa.value);
    let clampedAll = true; for (let i = 0; i < 20; i++) { run('RandomizeParameters', { params: [pa], percentage: 4, relative: false, seed: -(i + 1) }); if (!(pa.value === 0 || pa.value === 10 || (pa.value > 0 && pa.value < 10))) clampedAll = false; }
    ok('RandomizeParameters: values outside [min, max] are clamped', clampedAll, pa.value);
    r = run('RandomizeParameters', { params: 'cube.b17fx.a', percentage: 0.5, relative: false, seed: -11 });
    ok('RandomizeParameters: params given as a string', !r.err && pa.value >= 2.5 && pa.value <= 7.5, [r.err, pa.value]);
    A.anim.marked.clear(); A.anim.marked.add(pf);
    r = run('RandomizeParameters', { seed: -1 });
    ok('RandomizeParameters: a parameter without a range is left unchanged and logged "not yet attested"', !r.err && pf.value === 1 && has(r, /not yet attested: the UI range/), r);
  } catch (e) { ok('RandomizeParameters block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= CreateDisplayInfo
  try {
    let r = run('CreateDisplayInfo', { InputObj: [cube] });
    ok('CreateDisplayInfo: nothing marked -> empty collection, nothing added', Array.isArray(r.v) && r.v.length === 0 && !cube.properties.some(p => p.name === 'DisplayInfoMarkedParams'), r);
    const n1 = nul('b17di', 3, 0, 0);
    A.anim.marked.add(cube.kinematics.local.get('posx'));
    r = run('CreateDisplayInfo', { InputObj: [cube, n1] });
    const s0 = r.v?.[0], s1 = r.v?.[1];
    ok('CreateDisplayInfo: one Custom_parameter_list "DisplayInfoMarkedParams" per input object, returned', !r.err && r.v.length === 2 && s0.parent === cube && s1.parent === n1 && s0.name === 'DisplayInfoMarkedParams' && s0.type === 'customparamset', [r.err, r.v?.length]);
    ok('CreateDisplayInfo: AddProxyParam "<obj>.<marked param>" on each set', s0?.params[0]?.proxied === cube.kinematics.local.get('posx') && s1?.params[0]?.proxied === n1.kinematics.local.get('posx'), s0?.params.map(p => p.name));
    const ci = S().last.custominfo; const cip = A.scene.find('Camera')?.properties?.find(p => p.type === 'camvis')?.get?.('custominfo');
    ok('CreateDisplayInfo: SetValue Camera.camvis.custominfo = ShowDisplayInfo (or logged "not yet attested")', (cip ? cip.value === true : ci === true) && (cip || has(r, /not yet attested: SetValue "Camera.camvis.custominfo"/)), [ci, r.log]);
    const mat = A.scene.materials[0];
    r = run('CreateDisplayInfo', { InputObj: [mat], PsetName: 'b17diRoot', ShowDisplayInfo: false });
    ok('CreateDisplayInfo: an input that is not a 3D object / cluster -> the set goes on Scene_Root', !r.err && r.v.length === 1 && r.v[0].parent === A.scene.root && r.v[0].name === 'b17diRoot', [r.err, r.v?.[0]?.parent?.name]);
  } catch (e) { ok('CreateDisplayInfo block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= SampleParameterValues
  try {
    A.anim.marked.add(pa); A.anim.marked.add(pb); pa.value = 4; pb.value = false;
    const t0 = S().takes.length; const pr0 = S().progress.length;
    let calls; let r;
    calls = trace(['CreateDisplayInfo'], () => { r = run('SampleParameterValues', { InputObj: [cube], SamplingMethod: 0, NbSamples: 3, Relative: false }); });
    const bar = S().progress[pr0]; const takes = S().takes.slice(t0);
    ok('SampleParameterValues: temporary CreateDisplayInfo(InputObj, "DisplayInfoBracketParams", flag)', calls.some(c => c.a.PsetName === 'DisplayInfoBracketParams' && c.a.ShowDisplayInfo === false), calls.map(c => c.a));
    ok('SampleParameterValues bracket: progress "Generating Bracket Samples", max = 3 x 2 predicted takes', bar?.caption === 'Generating Bracket Samples' && bar.max === 6, bar);
    ok('SampleParameterValues bracket: every combination taken, returns the count', r.v === 6 && takes.length === 6, [r.err, r.v, takes.length]);
    const avals = [...new Set(takes.map(t => t.values['cube.b17fx.a'] ?? Object.values(t.values)[0]))].sort((x, y) => x - y);
    ok('SampleParameterValues bracket, not Relative: the UI range (0, 5, 10); booleans false / true', JSON.stringify(avals) === '[0,5,10]' && new Set(takes.map(t => Object.values(t.values)[1])).size === 2, avals);
    ok('SampleParameterValues: current values stored for RetrieveResult', S().sampleStore.find(s => s.param === pa)?.value === 4, S().sampleStore.map(s => s.value));
    ok('SampleParameterValues: unread capture / restore steps logged "not yet attested"', has(r, /SampleParameterValues: not yet attested: the capture/) && has(r, /not yet attested: the restore/), r.log);
    pa.value = 1;
    r = run('SampleParameterValues', { InputObj: [cube], SamplingMethod: 2, RetrieveResult: true });
    ok('SampleParameterValues RetrieveResult: values restored from the previous run first', pa.value === 4, pa.value);
    const pr1 = S().progress.length;
    calls = trace(['RandomizeParameters'], () => { r = run('SampleParameterValues', { InputObj: [cube], SamplingMethod: 1, NbSamples: 3, Percentage: 0.25, Relative: true, Seed: 8457 }); });
    ok('SampleParameterValues randomize: progress "Generating Random Samples", max NbSamples, NbSamples takes', S().progress[pr1]?.caption === 'Generating Random Samples' && S().progress[pr1].max === 3 && r.v === 3, [S().progress[pr1], r.v]);
    ok('SampleParameterValues randomize: RandomizeParameters(, Percentage, Relative, -Seed) first, then seed 1', calls.length === 3 && calls[0].a.seed === -8457 && calls[1].a.seed === 1 && calls[0].a.percentage === 0.25 && calls[0].a.relative === true, calls.map(c => c.a.seed));
  } catch (e) { ok('SampleParameterValues block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= ColorizeObject / ShadeObject
  try {
    let r = run('ColorizeObject', { Red: 0.878, Green: 0, Blue: 0.502 });
    let s = session();
    ok('ColorizeObject: pick loop on SceneObject with the node / branch prompts (dictionary 1152 / 1153)', !r.err && s?.active && s.command === 'ColorizeObject' && /Branch/.test(s.middlePrompt), [r.err, s?.prompt, s?.middlePrompt]);
    const m0 = A.log.length; s.pick(null, 1);
    ok('ColorizeObject: nothing picked -> "Please select an object", loop continues', A.log.slice(m0).some(l => l.text === 'Please select an object') && s.active);
    const sel0 = [...A.selection];
    s.pick(cube, 1); const d = cube.properties.find(p => p.type === 'display');
    ok('ColorizeObject left pick: MakeLocal <obj>.display, wire colour r / g / b', d && d.shared === false && JSON.stringify(d.val('wirecolorrgb')) === JSON.stringify([0.878, 0, 0.502]) && d.val('wirecol') === true, d?.val('wirecolorrgb'));
    const par = nul('b17par'); const kid = nul('b17kid', 1, 0, 0, par);
    s.pick(par, 2);
    ok('ColorizeObject middle pick: branch propagation reaches the children (inferred representation)', JSON.stringify(kid.properties.find(p => p.type === 'display').val('wirecolorrgb')) === JSON.stringify([0.878, 0, 0.502]));
    s.pick(null, 0);
    ok('ColorizeObject: button 0 ends the loop', !s.active);
    void sel0;
    r = run('ColorizeObject'); s = session(); s.pick(cube, 1); s.cancel();
    ok('ColorizeObject Default (0,0,0): colour 0,0,0 written, wire colour switch off', JSON.stringify(cube.properties.find(p => p.type === 'display').val('wirecolorrgb')) === '[0,0,0]' && cube.properties.find(p => p.type === 'display').val('wirecol') === false);
    r = run('ShadeObject', { ShadeModeId: 0 }); s = session();
    ok('ShadeObject: pick loop started', !r.err && s?.active && s.command === 'ShadeObject', r.err);
    s.pick(cube, 1); s.cancel();
    const modes = ['staticsel', 'intsel', 'playbacksel', 'staticunselnear', 'intunselnear', 'playbackunselnear', 'staticunselfar', 'intunselfar', 'playbackunselfar'];
    const dd = cube.properties.find(p => p.type === 'display');
    ok('ShadeObject: the nine display view-mode parameters = ShadeModeId', modes.every(m => dd.val(m) === 0), modes.map(m => dd.val(m)));
    run('ShadeObject', { ShadeModeId: 5 }); session().pick(cube, 1); session().cancel();
    ok('ShadeObject Bounding Box entry: id 5 written', modes.every(m => dd.val(m) === 5));
    run('ShadeObject'); session().pick(cube, 1); session().cancel();
    ok('ShadeObject default entry: id 8', modes.every(m => dd.val(m) === 8));
  } catch (e) { ok('Colorize / Shade block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= PaintPushTool
  try {
    const before = new Set(cube.allProperties());
    let calls; let r;
    calls = trace(['CreateWeightMap', 'ApplyOp', 'PaintTool'], () => { r = run('PaintPushTool'); });
    const map = cube.allProperties().find(p => p.type === 'weightmap' && !before.has(p));
    ok('PaintPushTool: CreateWeightMap(, , "PushMap") on the selection', !r.err && calls[0]?.n === 'CreateWeightMap' && map?.name === 'PushMap', [r.err, calls.map(c => c.n), map?.name]);
    ok('PaintPushTool: weight 0, wmin -1, wmax 1, map colour 70 / 70 / 177', map && map.val('weight') === 0 && map.val('wmin') === -1 && map.val('wmax') === 1 && map.val('red') === 70 && map.val('green') === 70 && map.val('blue') === 177, map?.params.map(p => [p.name, p.value]));
    const op = cube.primitive.operators.find(o => o.type === 'pushop');
    ok('PaintPushTool: ApplyOp "Push" then ampl = 2.0', calls.some(c => c.n === 'ApplyOp' && c.a.PresetObj === 'Push') && op?.val('ampl') === 2, op?.params.map(p => [p.name, p.value]));
    ok('PaintPushTool: PaintTool, then BrushProperties.Radius 1.0', calls[calls.length - 1]?.n === 'PaintTool' && A.brushProps().val('radius') === 1, A.brushProps?.().val('radius'));
  } catch (e) { ok('PaintPushTool block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= SelectDeformersFromEnvelope / AssociateEnvelopeBoundingVolume
  try {
    A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'b17Grid' }); const gr = A.scene.find('b17Grid');
    const dl = nul('b17L', -2), dr = nul('b17R', 2);
    A.run('SIApplyFlexEnv', { ConnectionSet: 'b17Grid;b17L,b17R' });
    let r = run('SelectDeformersFromEnvelope', { InputObjs: [gr] });
    ok('SelectDeformersFromEnvelope: point cluster envelopes -> SelectObj <deformers>', !r.err && A.selection.length === 2 && A.selection.includes(dl) && A.selection.includes(dr), [r.err, A.selection.map(n => n.name)]);
    A.select([cube]); r = run('SelectDeformersFromEnvelope', { InputObjs: [cube] });
    ok('SelectDeformersFromEnvelope: none -> log "No envelope deformers found", selection kept', has(r, /^No envelope deformers found$/) && A.selection[0] === cube, r.log);
    const chain = A.run('Create2DSkeleton', { Points: [[0, 0, 0], [0, 2, 0], [0, 4, 0]] });
    const root = chain?.type === 'root' ? chain : [...A.scene.allObjects()].reverse().find(o => o.type === 'root');
    const bones = [...root.descendants()].filter(o => o.type === 'bone');
    // an implicit object: the implicit vertebra of a non-interactive CreateSpine
    const h = nul('b17hipI', 0, 0, 0), c = nul('b17chestI', 0, 5, 0);
    A.run('CreateSpine', { Hip: h, Chest: c, NumVertebrae: 1, ImplicitVertebrae: true, Interactive: false });
    const imp = S().last.CreateSpine.vertebrae[0];
    r = run('AssociateEnvelopeBoundingVolume', { InputObjs: [root], BndVolType: 'Exclusive' }); let s = session();
    ok('AssociateEnvelopeBoundingVolume: deformers in the branch -> pick loop for bounding objects (filter implicit, 1074)', !r.err && s?.active && s.filter === 'implicit' && /Bounding Object/.test(s.prompt), [r.err, s?.filter, s?.prompt]);
    s.pick(imp, 1);
    const grpOf = d => d.boundVol?.Exclusive;
    const chainEls = [root, ...root.descendants()].filter(o => ['root', 'bone', 'eff'].includes(o.type));
    ok('AssociateEnvelopeBoundingVolume left pick: SIAddToGroup <deformer>.BoundVol.Exclusive for every chain element', chainEls.length >= 3 && chainEls.every(d => grpOf(d)?.members.includes(imp)), chainEls.map(d => grpOf(d)?.members.length));
    s.pick(imp, 2);
    ok('AssociateEnvelopeBoundingVolume middle pick: RemoveFromGroup', chainEls.every(d => !grpOf(d)?.members.includes(imp)));
    s.pick(null, 0);
    r = run('AssociateEnvelopeBoundingVolume', { InputObjs: [imp] }); s = session();
    ok('AssociateEnvelopeBoundingVolume: implicit objects only -> pick loop for deformers (filter chain_element, 1076)', s?.active && s.filter === 'chain_element' && /Deformer/.test(s.prompt), [s?.filter, s?.prompt]);
    s.pick(bones[0], 1);
    ok('AssociateEnvelopeBoundingVolume deformer pick: SIAddToGroup <picked>.BoundVol.Inclusive, <implicits>', bones[0].boundVol?.Inclusive?.members.includes(imp));
    s.pick(bones[0], 2); s.pick(null, 0);
    ok('AssociateEnvelopeBoundingVolume deformer middle pick: RemoveFromGroup', !bones[0].boundVol.Inclusive.members.includes(imp));
    r = run('AssociateEnvelopeBoundingVolume', { InputObjs: [cube] });
    ok('AssociateEnvelopeBoundingVolume: neither -> nothing (no pick session)', !r.err && !session()?.active && S().last.AssociateEnvelopeBoundingVolume.mode === 'none');
  } catch (e) { ok('envelope block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= CreateUserDataMapAndPickTemplate / InspectUserData
  try {
    A.setSelMode?.('point'); A.selectComponents(cube, 'point', [0, 1, 2]); const cl = A.run('CreateCluster', { Name: 'b17cls' }); A.compSel = null; A.setSelMode?.('object');
    const tmpl = new Prop('b17tmpl', 'customparamset', [{ name: 'v', type: 'double', value: 1 }]); cube.addProperty(tmpl);
    let r = run('CreateUserDataMapAndPickTemplate', { InputObj: [cl] });
    ok('CreateUserDataMapAndPickTemplate: nothing picked -> log, empty collection', Array.isArray(r.v) && r.v.length === 0 && has(r, /^You haven't picked a template \(make sure to pick the name not the icon\)$/), r);
    let asked = null;
    A.tasksB11b.pickHook = (filter, left) => { asked = { filter, left }; return { picked: [cube.properties.find(p => p.type === 'display')], flags: 1 }; };
    r = run('CreateUserDataMapAndPickTemplate', { InputObj: [cl] });
    ok('CreateUserDataMapAndPickTemplate: PickElement "property" with the template text; wrong type -> log, empty', asked?.filter === 'property' && asked.left === 'Pick Template' && r.v.length === 0 && has(r, /^Wrong type of property for a template$/), [asked, r]);
    A.tasksB11b.pickHook = () => ({ picked: [tmpl], flags: 1 });
    let calls; calls = trace(['CreateUserDataMap'], () => { r = run('CreateUserDataMapAndPickTemplate', { InputObj: [cl], PropertyName: 'b17UD' }); });
    const udm = cl.properties.find(p => p.type === 'userdatamap');
    ok('CreateUserDataMapAndPickTemplate: returns CreateUserDataMap(InputObj, PropertyName, template)', !r.err && calls[0]?.a.Template === tmpl && calls[0].a.PropertyName === 'b17UD' && r.v?.[0] === udm && udm?.template === tmpl, [r.err, calls.map(c => c.a)]);
    A.tasksB11b.pickHook = null;
    A.select([]); A.compSel = null;
    r = run('InspectUserData', { InputObjs: [udm] });
    ok('InspectUserData: reads the global selection (not InputObjs): no components -> siError "No components have been selected"', A.log.slice(-5).some(l => l.kind === 'error' && l.text === 'No components have been selected'), r.log);
    A.setSelMode?.('point'); A.selectComponents(cube, 'point', [1]);
    calls = trace(['SIInspectUserData'], () => { r = run('InspectUserData'); });
    ok('InspectUserData: no map selected -> FindUDM (a map on a cluster holding the components), then SIInspectUserData(map, sub-component)', calls[0]?.a.UserDataMap === udm && calls[0].a.SubComp === 'cube.pnt[1]', calls.map(c => [c.a.UserDataMap?.name, c.a.SubComp]));
    A.selectComponents(cube, 'point', [6]);
    r = run('InspectUserData');
    ok('InspectUserData: no map found -> siError "No suitable User Data Map could be found"', A.log.slice(-5).some(l => l.kind === 'error' && l.text === 'No suitable User Data Map could be found'), r.log);
    A.compSel = null; A.setSelMode?.('object');
  } catch (e) { ok('user data block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= EditCommand / CreateAndEditCommand
  try {
    let r = run('EditCommand', { CommandName: 'NoSuchCmd' });
    ok("EditCommand: unknown -> siWarning \"'<name>' is not an editable command.\", False", r.v === false && has(r, /'NoSuchCmd' is not an editable command\./), r);
    const cl0 = A.cmdLog; let seenLog = null; let prop = null;
    S().hooks.inspect = (cmd, p) => { seenLog = A.cmdLog; prop = p; return true; };
    r = run('EditCommand', { CommandName: 'Create primitive' });
    ok('EditCommand: found by name (Application.Commands), editor OK -> False', r.v === false && prop?.name === 'Create primitive', [r.v, prop?.name]);
    r = run('EditCommand', { CommandName: 'CreatePrim' });
    ok('EditCommand: found by scripting name; cmdlog off while editing, restored after (restore inferred)', r.v === false && seenLog === false && A.cmdLog === cl0, [seenLog, A.cmdLog]);
    const def = A.commands.get('CreatePrim');
    ok('EditCommand editor: one parameter per command property, Embedded (1, 0..10), Builtin (read-only), CodeBackup', prop.get('Name').value === def.label && prop.get('ScriptingName').value === 'CreatePrim' && prop.get('Embedded').value === 1 && prop.get('Embedded').def.max === 10 && prop.get('Builtin').value === true && prop.get('Builtin').def.readOnly && prop.get('CodeBackup') && prop.get('Name').def.readOnly, prop.params.map(p => p.name));
    const g = prop.grids?.Arguments;
    ok('EditCommand editor: Arguments grid, 4 columns, one row per argument; Type combo Input / Output / Input/Output / ""', g && g.columns.join('|') === 'Name|Type|Default Value|Handler' && g.rows.length === def.args.length && g.rows[0].Name === 'PresetObj' && g.typeItems.map(t => t.value).join() === '1,2,3,-1' && !g.hidden, g);
    ok('EditCommand editor: layout starts with tab Description', prop.editorLayout?.[0]?.tab === 'Description');
    run('EditCommand', { CommandName: 'DeselectAll' });
    ok('EditCommand editor: grid hidden when the command has no arguments', prop.grids.Arguments.hidden === true);
    S().hooks.inspect = () => false;
    ok('EditCommand: editor cancelled -> True', run('EditCommand', { CommandName: 'CreatePrim' }).v === true);
    S().hooks.inspect = null;
    r = run('EditCommand', { CommandName: 'CreatePrim' });
    ok('EditCommand: no editor in this session -> True (cancel), logged "not yet attested"', r.v === true && has(r, /EditCommand: not yet attested/), r);
    S().hooks.inspect = (cmd, p) => { prop = p; return true; };
    r = run('CreateAndEditCommand');
    ok('CreateAndEditCommand: CreateCommand("NewCommand"), editor OK -> False, the command is added (inferred)', r.v === false && A.commands.has('NewCommand') && prop.get('Builtin').value === false, [r.v, A.commands.has('NewCommand')]);
    r = run('CreateAndEditCommand');
    ok('CreateAndEditCommand: unique name NewCommand1 (inferred)', A.commands.has('NewCommand1'));
    S().hooks.inspect = () => false;
    r = run('CreateAndEditCommand');
    ok('CreateAndEditCommand: cancelled -> True, nothing added', r.v === true && !A.commands.has('NewCommand2'));
    A.commands.delete('NewCommand'); A.commands.delete('NewCommand1');
  } catch (e) { ok('command editor block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= CreateSpine
  try {
    const hip = nul('b17hip', 0, 2, 0), chest = nul('b17chest', 0, 7, 1);
    const ai = A.autoInspect;
    let r = run('CreateSpine', { Hip: 'b17hip', Chest: 'b17chest', NumVertebrae: 3, ImplicitVertebrae: false, Interactive: false });
    const L = S().last.CreateSpine; const ctl = r.v;
    ok('CreateSpine: returns Spine_Control on the spineCurve (scene root)', !r.err && ctl?.name === 'Spine_Control' && ctl.parent === L.curve && L.curve.parentObj === A.scene.root && /^spineCurve/.test(L.curve.name), [r.err, ctl?.name]);
    const sc = ctl.get('scale');
    ok('CreateSpine: scale (default 1, range 0.01..10000, UI 0.01..10, animatable)', sc.value === 1 && sc.def.min === 0.01 && sc.def.max === 10000 && sc.def.uimax === 10 && sc.def.animatable, sc.def);
    const cvs = L.curve.primitive.curve?.()?.cvs ?? [];
    const exp = (t) => [0, 2 + 5 * t, t];
    ok('CreateSpine: curve through hip, lerp 0.40, lerp 0.60, chest', cvs.length === 4 && [0, 0.4, 0.6, 1].every((t, i) => exp(t).every((v, k) => near(cvs[i][k], v))), cvs);
    ok('CreateSpine: hipDepth under the hip at P1, chestDepth under the chest at P2', L.hipDepth.parentObj === hip && L.chestDepth.parentObj === chest && P(L.hipDepth).every((v, k) => near(v, exp(0.4)[k])) && P(L.chestDepth).every((v, k) => near(v, exp(0.6)[k])), [P(L.hipDepth), P(L.chestDepth)]);
    const dist = Math.hypot(5, 1);
    ok('CreateSpine: SpineCurve operator on (curve, hip, hipDepth, chestDepth, chest), lgoal = curve length, lScale expression = scale', L.spineOp.name === 'SpineCurve' && L.spineOp.inputs.length === 5 && L.spineOp.val('lgoal') >= dist - 1e-6 && A.anim.expression(L.spineOp.get('lScale')) === `${L.curve.name}.Spine_Control.scale`, [L.spineOp.val('lgoal'), A.anim.expression(L.spineOp.get('lScale'))]);
    const len = (o) => o.primitive.operators[0].val('length') ?? o.primitive.val('length');
    ok('CreateSpine: top vertebra under the curve, length dist / N x 0.8, path constraint (no compensation, tangent, upvct_active)', L.top.parentObj === L.curve && near(len(L.top), dist / 3 * 0.8) && (() => { const c = L.top.properties.find(p => p.type === 'pathcns'); return c && c.val('cnscomp') === false && c.val('tangent') === true && c.val('upvct_active') === true && c.targets[0] === L.curve; })(), len(L.top));
    ok('CreateSpine: FixedLength on (top vertebra, curve), init_length = curve length, lScale = scale', L.fixed.name === 'FixedLength' && near(L.fixed.val('init_length'), L.spineOp.val('lgoal')) && L.fixed.inputs[1] === L.curve && !!A.anim.expression(L.fixed.get('lScale')));
    ok('CreateSpine: N polygon-mesh vertebrae, length dist / N x 0.6', L.vertebrae.length === 3 && L.vertebrae.every(v => v.type === 'polymsh' && v.parentObj === L.curve && near(len(v), dist / 3 * 0.6)), L.vertebrae.map(v => [v.type, len(v)]));
    const ex = L.vertebrae.map(v => A.anim.expression(v.properties.find(p => p.type === 'pathcns').get('perc')));
    ok('CreateSpine: perc expressions "<top cns>.perc * k", k = (i+1)/(N+1) to 6 decimals with a "." separator', ex[0] === `${L.top.name}.kine.pathcns.perc * 0.25` && ex[1].endsWith('* 0.5') && ex[2].endsWith('* 0.75'), ex);
    const sp = (o) => (o.rigOps ?? o.primitive?.operators ?? []).find(x => x.name === 'SpinePointAt');
    ok('CreateSpine: SpinePointAt (vertebra, chest, hip), slider 1 - i/(N+1) - 1/(N+1); top slider 0', L.vertebrae.every((v, i) => near(sp(v)?.val('slider'), 1 - i / 4 - 1 / 4) && sp(v).inputs[1] === chest && sp(v).inputs[2] === hip) && sp(L.top)?.val('slider') === 0, L.vertebrae.map(v => sp(v)?.val('slider')));
    ok('CreateSpine: preferences restored (autoInspect)', A.autoInspect === ai && S().prefs.SI3D_CONSTRAINT_COMPENSATION_MODE === 1);
    r = run('CreateSpine', { Hip: hip, Chest: chest, NumVertebrae: 2, ImplicitVertebrae: true, Interactive: false });
    ok('CreateSpine ImplicitVertebrae: implicit cubes (AddPrimitive "Cube")', S().last.CreateSpine.vertebrae.every(v => v.type === 'implicit'));
    // interactive
    const picks = [hip, chest]; let texts = [];
    A.tasksB11b.pickHook = (f, left) => { texts.push(left); const o = picks.shift(); return o ? { picked: [o], flags: 1 } : null; };
    let dialog = null; S().hooks.inspect = (cmd, p) => { dialog = { cmd, name: p.name, n: p.get('NumberOfVertebra').def }; p.get('NumberOfVertebra').value = 2; return true; };
    const m0 = A.log.length;
    r = run('CreateSpine');
    ok('CreateSpine interactive: picks hip then chest (1128 "Select Chest Object"), Spine_Maker Keys dialog (1..100, UI 1..20) read and deleted', !r.err && texts.length === 2 && texts[1] === 'Select Chest Object' && dialog?.name === 'Spine_Maker Keys' && dialog.n.max === 100 && dialog.n.uimax === 20 && S().last.CreateSpine.vertebrae.length === 2 && !A.scene.root.properties.some(p => p.name === 'Spine_Maker Keys'), [r.err, texts, dialog]);
    const logged = A.log.slice(m0).find(l => l.kind === 'cmd' && /^CreateSpine/.test(l.text));
    ok('CreateSpine interactive: the Interactive argument is written back False (logged replay does not prompt)', S().outputs.CreateSpine.Interactive === false && /^CreateSpine "b17hip", "b17chest", 2, (false|False), (false|False)$/.test(logged?.text ?? ''), logged?.text);
    picks.length = 0; picks.push(hip); A.tasksB11b.pickHook = (f, l) => { const o = picks.shift(); return o ? { picked: [o], flags: 1 } : { picked: [], flags: 2 }; };
    const nObj = [...A.scene.allObjects()].length;
    r = run('CreateSpine');
    ok('CreateSpine interactive: right click on the chest pick -> returns Empty, nothing built', r.v === undefined && [...A.scene.allObjects()].length === nObj, [r.v]);
    picks.push(hip, chest); A.tasksB11b.pickHook = () => { const o = picks.shift(); return o ? { picked: [o], flags: 1 } : null; };
    S().hooks.inspect = () => false;
    r = run('CreateSpine');
    ok('CreateSpine interactive: dialog cancelled -> property deleted, returns Empty', r.v === undefined && !A.scene.root.properties.some(p => p.name === 'Spine_Maker Keys') && [...A.scene.allObjects()].length === nObj);
  } catch (e) { ok('CreateSpine block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= TagObject / TagStepMarks
  try {
    A.select([]);
    let r = run('TagObject', { TagStr: 'Tag' });
    ok('TagObject: no input -> siWarning "Please select an object to tag first"', has(r, /Please select an object to tag first/), r.log);
    const rf = nul('b17rfoot'); A.select([rf]);
    r = run('TagObject', { TagStr: 'RightFoot' });
    ok('TagObject: AddProperty Custom_parameter_list named TagStr, log "<obj> tagged as <tag>"', rf.properties.some(p => p.name === 'RightFoot' && p.type === 'customparamset') && has(r, /^b17rfoot tagged as RightFoot$/), r.log);
    r = run('TagObject', { InputObj: [rf], TagStr: 'RightFoot' });
    ok('TagObject: already tagged -> "<obj> already tagged as <tag>", nothing added', has(r, /^b17rfoot already tagged as RightFoot$/) && rf.properties.filter(p => p.name === 'RightFoot').length === 1);
    // foot animation: still 1..10, moving 11..20, still 21..30
    const px = rf.kinematics.local.get('posx');
    for (let f = 1; f <= 30; f++) A.anim.setKey(px, f, f <= 10 ? 0 : f <= 20 ? f - 10 : 10);
    A.select([rf]);
    let dlg = null; S().hooks.inspect = (cmd, p, title) => { dlg = { title, start: p.get('Start').value, end: p.get('End').value, thr: p.get('velocity_threshold').value }; p.get('Start').value = 1; p.get('End').value = 30; return true; };
    r = run('TagStepMarks', { InputObj: [cube] });
    const T = S().last.TagStepMarks;
    ok('TagStepMarks: uses the selection\'s model, finds the RightFoot tag; logs RFoot / LFoot / cog', T.rf === rf && T.model === A.scene.root && has(r, /^RFoot: b17rfoot$/) && has(r, /^LFoot: $/) && has(r, /^cog: /), r.log);
    ok('TagStepMarks: Test_step_detection dialog (1050) with Start / End = PlayControl In / Out, threshold 0.2; deleted', dlg?.title === 'Test Step Detection' && dlg.start === A.anim.startFrame && dlg.end === A.anim.endFrame && dlg.thr === 0.2 && !A.scene.root.properties.some(p => p.name === 'Test_step_detection'), dlg);
    const kids = T.steps.children;
    ok('TagStepMarks: marker pairs at the first frame, at the end of the locked span (frame 11) and at the last frame', T.pairs.length === 3 && near(T.pairs[0].start.x, 0) && near(T.pairs[1].start.x, 0) && near(T.pairs[1].end.x, 1) && near(T.pairs[2].start.x, 10), T.pairs.map(p => [p.start.x, p.end.x]));
    ok('TagStepMarks: StartStep / EndStep cubes (0.1, wire colour 302) and a linear 2-point curve (wire colour 1022) under Foot_Steps', kids.length === 9 && kids.filter(o => /^StartStep/.test(o.name)).length === 3 && kids.filter(o => /^EndStep/.test(o.name)).every(o => o.properties.find(p => p.type === 'display').val('wirecol_index') === 302 && o.primitive.operators[0].val('length') === 0.1) && kids.filter(o => o.type === 'crvlist').every(o => o.properties.find(p => p.type === 'display').val('wirecol_index') === 1022 && o.nurbs?.knots.join() === '0,1'), kids.map(o => o.name));
    S().hooks.inspect = () => false;
    const m0 = A.log.length; r = run('TagStepMarks');
    ok('TagStepMarks: cancelled -> siError "Command was cancelled !", only the top Foot_Steps null', A.log.slice(m0).some(l => l.kind === 'error' && l.text === 'Command was cancelled !') && S().last.TagStepMarks.steps.children.length === 0, r.log);
  } catch (e) { ok('tag block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();

  // ================= GetProportionalGuide
  try {
    const sb = A.buildProportionalGuideStandIn; const NullC = A.scene.find('b17rfoot')?.constructor;
    const Cns = S().last.CreateSpine?.top?.properties.find(p => p.type === 'pathcns')?.constructor;
    // fixture: the stand-in guide gets a RibCageEnd child and symmetry constraints (the preset content is not bundled)
    A.buildProportionalGuideStandIn = (name, style) => { const g = sb(name, style); const rc = new NullC('RibCageEnd'); g.addChild(rc); for (const o of [g, rc]) o.addProperty(new Cns('Symmetry Cns', 'symmetrycns', [], [g])); return g; };
    let dlg = null; S().hooks.inspect = (cmd, p, title) => { dlg = { title, name: p.name }; p.get('Style').value = 1; p.get('Symmetry').value = 1; return true; };
    let calls; let r;
    calls = trace(['GetPresetModel', 'DeselectAll'], () => { r = run('GetProportionalGuide', { ModelName: 'Biped_Guide' }); });
    const G = S().last.GetProportionalGuide;
    ok('GetProportionalGuide (UseDialog 1): BipedGuide dialog titled 1047, Style / Symmetry read, property deleted', dlg?.title === 'Create Biped Guide' && dlg.name === 'BipedGuide' && G?.style === 1 && G.symmetry === 1 && !A.scene.root.properties.some(p => p.name === 'BipedGuide'), [dlg, G?.style]);
    ok('GetProportionalGuide: GetPresetModel(ModelName, ModelName)', calls.some(c => c.n === 'GetPresetModel' && c.a.ModelName === 'Biped_Guide' && c.a.Name === 'Biped_Guide') && G.guide && /Biped_Guide/.test(G.guide.name), calls.map(c => [c.n, c.a.ModelName]));
    ok('GetProportionalGuide: viewvis 0 for GuideStyle 1 on <guide>.DetailedGuide (missing in this build: logged "not yet attested")', G.viewvis === 0 && G.part === 'DetailedGuide' && has(r, /not yet attested: SetValue .*DetailedGuide\.viewvis, 0/), [G.viewvis, r.log]);
    const rc = [...G.guide.descendants()].find(o => o.name === 'RibCageEnd');
    ok('GetProportionalGuide Symmetry 1: symmetrycns removed on RibCageEnd (not on the guide)', G.removed === 1 && !rc.properties.some(p => p.type === 'symmetrycns') && G.guide.properties.some(p => p.type === 'symmetrycns'), G.removed);
    ok('GetProportionalGuide: DeselectAll last; returns nothing (Sub)', calls[calls.length - 1]?.n === 'DeselectAll' && A.selection.length === 0 && r.v === undefined, [r.v, A.selection.length]);
    dlg = null; S().hooks.inspect = (c, p) => { dlg = p.name; return true; };
    r = run('GetProportionalGuide', { ModelName: 'BipedPropGuide', GuideStyle: 0, GuideSymmetry: 3 });
    const G2 = S().last.GetProportionalGuide;
    ok('GetProportionalGuide BipedPropGuide (UseDialog 0): no dialog; DetailedGuideVisible, viewvis 2; Symmetry 3 on the guide itself', dlg === null && G2.part === 'DetailedGuideVisible' && G2.viewvis === 2 && G2.removed === 1 && !G2.guide.properties.some(p => p.type === 'symmetrycns'), [dlg, G2.part, G2.removed]);
    S().hooks.inspect = () => false; const n0 = A.scene.root.children.length;
    r = run('GetProportionalGuide', { ModelName: 'Biped_Guide' });
    ok('GetProportionalGuide: dialog cancelled -> dialog property deleted, nothing loaded', A.scene.root.children.length === n0 && !A.scene.root.properties.some(p => p.name === 'BipedGuide'));
    A.buildProportionalGuideStandIn = sb;
  } catch (e) { ok('GetProportionalGuide block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  reset();
  return out;
}, { NAMES, DEFAULT_STATUS });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_params_rigs_b17gh: ${pass}/${pass + fail} ok`);
await browser.close();
process.exit(fail ? 1 : 0);
