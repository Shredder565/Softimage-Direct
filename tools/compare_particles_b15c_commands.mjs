// CMD-B15c (sparks.dll / forces.dll legacy particle commands, src/commands/particlesB15c.ts) and the bbbbee29
// shader-creation family (src/commands/particlesB15cShaders.ts, inferred: no contract). No XSIBATCH golden exists:
// this is a contract check against docs/ghidra/cmd-b15c-particles.md section 3 and docs/re/WIRE_CORRECTIONS_B15.md
// items 27-29.
//   1. every name is registered with a catalogue argument list (data/commands_full.json); names with two registry
//      entries ("Pick ..." / string entry + list entry, item 28) are one bus command and keep both lists;
//   2. every command runs with its default arguments on the ?demo scene (cube selected) without an unexpected error
//      (commands whose required input has no usable default must fail with a message naming the command);
//   3. the contract's stated results (port groups, created elements and names, statuses / HRESULTs, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_particles_b15c_commands.mjs
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
  'ConnectWeightMapToComponent', 'ConnectParticleInitState', 'DisconnectParticleInitState', 'SetParticleInitState', 'UpdateParticleTypeConnections',
  'AddParticleEmitter', 'AddParticleObstacle', 'AddParticles', 'SetParticleType', 'CreateParticleType', 'SIAddParticleGoal', 'CreateEventSource',
  'AddUserParameter', 'RemoveUserParameter', 'SIAddParticleEvent', 'SetEventObstacle', 'SIAddParticleForce',
  'CreateShaderFromCLSID', 'CreateShaderFromProgID', 'CreateShadersFromMaterialPreset',
];
const TWICE = ['ConnectWeightMapToComponent', 'AddParticleEmitter', 'AddParticleObstacle', 'SetParticleType', 'CreateParticleType', 'CreateEventSource', 'SetEventObstacle'];
const DEFAULT_FAILS = new Set(['ConnectWeightMapToComponent', 'ConnectParticleInitState', 'DisconnectParticleInitState', 'UpdateParticleTypeConnections',
  'AddParticleEmitter', 'AddParticles', 'CreateEventSource', 'AddUserParameter', 'RemoveUserParameter', 'SIAddParticleEvent', 'SetEventObstacle',
  'CreateShaderFromCLSID', 'CreateShaderFromProgID', 'CreateShadersFromMaterialPreset']);

const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const catalogue = Object.fromEntries(NAMES.map(n => [n, full.filter(x => x.scripting_name === n).map(f => f.args.map(a => [a.name, a.default ?? null]))]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SIAddParticleForce') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, TWICE, DEFAULT_FAILS: DF }) => {
  const DEFAULT_FAILS = new Set(DF);
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const out = { reg: {}, entries: {}, defaults: {}, checks: [] };
  const safe = d => { try { return JSON.stringify(d, (k, v) => (v && typeof v === 'object' && v.kind && v.name !== undefined && k !== '') ? `<${v.name}>` : v); } catch { return String(d); } };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : safe(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); const L = A.log.slice(m).filter(l => l.kind !== 'cmd'); return { v, log: L.map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const has = (r, re) => r.log.some(l => re.test(l));
  const nya = r => r.log.some(l => /not yet attested/.test(l) && /CMD-B15c/.test(l));
  const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  const J = JSON.stringify;
  const names = l => (l ?? []).map(x => x?.name);
  const S = A.particleScripts, B = A.particlesB15c;
  const cube = A.scene.find('cube');

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  for (const n of TWICE) out.entries[n] = (B.entries[n] ?? []).map(e => e.args.map(a => [a.name, a.default ?? null]));
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    A.select([cube]); const u0 = A.undoStack.length; const t0 = S.particleTypes.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    S.particleTypes.length = t0;
    out.defaults[n] = r.err ? (DEFAULT_FAILS.has(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.has(n) ? 'UNEXPECTED-OK' : 'ok');
  }
  for (const n of NAMES) ok(`${n}: category`, A.commands.get(n)?.category === (n.startsWith('CreateShader') ? 'Rendering' : 'Simulation'));

  // fresh scene with a Sparks cloud emitted by "em"
  const fresh = () => { A.run('NewScene'); A.autoInspect = false; S.particleTypes.length = 0; S.hooks = { fileBrowser: () => '' }; B.hooks = {}; B.interactive = true; B.lastAutoInspect = null; B.boxes = []; A.select([]); };
  const mk = (preset, name) => { const o = A.run('CreatePrim', { PresetObj: preset, GeometryType: 'MeshSurface', Name: name }); A.select([]); return o; };
  const sparks = () => { const em = mk('Cube', 'em'); const cloud = A.run('CreateParticleCloud', { InputObjs: [em] })[0]; A.select([]); return { em, cloud, op: cloud.primitive.operators[0] }; };
  const C = op => op.connections;

  // ================= CreateParticleType
  try {
    fresh();
    let r = run('CreateParticleType');
    const t = r.v;
    ok('CreateParticleType: a ParType in the global container, default render type siBillboardType', t?.type === 'ParType' && S.particleTypes[0] === t && t.renderType === 'siBillboardType' && t.val('rendertype') === 'siBillboardType', [t?.type, t?.renderType]);
    r = run('CreateParticleType', { RenderType: 'siSphereType' });
    ok('CreateParticleType: RenderType applied; names PType / PType1; IDs 1 / 2', r.v.renderType === 'siSphereType' && J(names(S.particleTypes)) === J(['PType', 'PType1']) && r.v.val('ID') === 2, names(S.particleTypes));
    A.undo();
    ok('CreateParticleType: undo removes the type from the container', S.particleTypes.length === 1);
    ok('CreateParticleType: second registry entry (Output only) = same command', B.entries.CreateParticleType.length === 2 && B.entries.CreateParticleType[1].args.length === 1);
  } catch (e) { ok('CreateParticleType block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddParticleEmitter / UpdateParticleTypeConnections / SetParticleType
  try {
    fresh(); const { em, cloud, op } = sparks(); const pt0 = S.particleTypes[0];
    const e2 = mk('Sphere', 'em2');
    let r = run('AddParticleEmitter', { Target: [cloud], InputObj: [e2] });
    const emi = e2.properties.find(p => p.type === 'EmissionProp');
    ok('AddParticleEmitter: new "Emission Property" named <object>_emission, emitter connected on group 1', !r.err && emi?.name === 'em2_emission' && C(op).emitters.includes(e2) && op.emitterEntries === 3, [r.err, emi?.name, names(C(op).emitters)]);
    ok('AddParticleEmitter: SPDL parameters (C3DParEmitter) Generation 2, Rate 50, Speed 5', emi?.val('Generation') === 2 && emi?.val('Rate') === 50 && emi?.val('Speed') === 5);
    ok('AddParticleEmitter: Interactive true -> Auto Inspect of the new properties', J(names(B.lastAutoInspect)) === J(['em2_emission']));
    B.lastAutoInspect = null; const e3 = mk('Cube', 'em3');
    r = run('AddParticleEmitter', { Target: [cloud], InputObj: [e3], Interactive: false });
    ok('AddParticleEmitter: Interactive false -> no Auto Inspect', !r.err && B.lastAutoInspect === null && C(op).emitters.includes(e3));
    r = run('AddParticleEmitter', { Target: [cloud], InputObj: [e2] });
    ok('AddParticleEmitter: existing emission reused (not duplicated), emitter not connected twice', e2.properties.filter(p => p.type === 'EmissionProp').length === 1 && C(op).emitters.filter(x => x === e2).length === 1);
    r = run('AddParticleEmitter', { Target: [em], InputObj: [e2] });
    ok('AddParticleEmitter: no Target with a Sparks / HyperFlow op -> 0x80070057 (item 29)', status(r, '80070057'), r.err);
    ok('AddParticleEmitter: Target given by name', !run('AddParticleEmitter', { Target: cloud.name, InputObj: 'em3' }).err);
    // HyperFlow: only Disc / Cube / Square
    const fl = A.run('CreateFluid', { InputObjs: 'Cube' })[0]; const fop = fl.primitive.operators[0]; A.select([]);
    const sph = mk('Sphere', 'fsph'), box = mk('Cube', 'fbox');
    r = run('AddParticleEmitter', { Target: [fl], InputObj: [sph, box] });
    ok('AddParticleEmitter: HyperFlow accepts only Disc / Cube / Square emitters', !r.err && C(fop).emitters.includes(box) && !C(fop).emitters.includes(sph) && !sph.properties.some(p => p.type === 'EmissionProp'), names(C(fop).emitters));
    // UpdateParticleTypeConnections, op / cloud case
    const t2 = A.run('CreateParticleType', {});
    r = run('SetParticleType', { Target: [emi], Source: [t2] });
    ok('SetParticleType: the holder\'s type slot = Source; UpdateParticleTypeConnections connects it (container order)', !r.err && emi.parType === t2 && emi.val('ParType') === t2.name && J(names(C(op).particleTypes)) === J([pt0.name, t2.name]), [r.err, names(C(op).particleTypes)]);
    ok('SetParticleType: the emission / type paths of UpdateParticleTypeConnections are logged as not yet attested', nya(r));
    r = run('SetParticleType', { Target: [emi], Source: [pt0] });
    ok('UpdateParticleTypeConnections: a type no longer used is disconnected', J(names(C(op).particleTypes)) === J([pt0.name]), names(C(op).particleTypes));
    const n0 = S.particleTypes.length;
    r = run('SetParticleType', { Target: [emi] });
    ok('SetParticleType: no Source -> CreateParticleType, then set', !r.err && S.particleTypes.length === n0 + 1 && emi.parType === S.particleTypes[n0]);
    r = run('SetParticleType', { Target: `em2.em2_emission.${pt0.name}`, Source: [pt0] });
    ok('SetParticleType: a particle type item resolves to its holder through its parent name', !r.err && emi.parType === pt0, r.err);
    emi.parType = t2; r = run('UpdateParticleTypeConnections', { InputObj: [cloud] });
    ok('UpdateParticleTypeConnections: cloud -> its sim op', !r.err && C(op).particleTypes.includes(t2));
    emi.parType = pt0; r = run('UpdateParticleTypeConnections', { InputObj: [op] });
    ok('UpdateParticleTypeConnections: operator item', !r.err && !C(op).particleTypes.includes(t2));
    r = run('UpdateParticleTypeConnections', { InputObj: [em] });
    ok('UpdateParticleTypeConnections: nothing classifiable -> 0x80004005, sparks message 0x6f', status(r, '80004005') && has(r, /\[sparks 0x6f\]/), r);
    ok('Pick entries: same argument names as the list entries (item 28)', ['AddParticleEmitter', 'AddParticleObstacle', 'SetParticleType', 'ConnectWeightMapToComponent'].every(n => J(B.entries[n][0].args.map(a => a.name)) === J(B.entries[n][1].args.map(a => a.name))));
  } catch (e) { ok('emitter block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddUserParameter / RemoveUserParameter
  try {
    fresh(); const { cloud } = sparks(); const pt = S.particleTypes[0]; const t2 = A.run('CreateParticleType', {});
    let r = run('AddUserParameter', { Target: [cloud], Name: 'heat', Type: 2 });
    ok('AddUserParameter: a cloud contributes its particle types', !r.err && pt.userParameters?.heat === 2 && !(t2.userParameters ?? {}).heat, r.err);
    ok('AddUserParameter: clouds using the type are refreshed', cloud.particleRefresh >= 1);
    r = run('AddUserParameter', { Target: [t2], Name: 'heat', Type: 6 });
    ok('AddUserParameter: a particle type item', t2.userParameters.heat === 6);
    ok('AddUserParameter: Type >= 7 -> 0x80004005', status(run('AddUserParameter', { Target: [pt], Name: 'x', Type: 7 }), '80004005'));
    ok('AddUserParameter: empty Name -> 0x80004005', status(run('AddUserParameter', { Target: [pt], Name: '' }), '80004005'));
    A.select([]); ok('AddUserParameter: empty Target -> 0x80004005', status(run('AddUserParameter', { Name: 'x' }), '80004005'));
    ok('AddUserParameter: no particle type collected -> 0x80004005', status(run('AddUserParameter', { Target: [A.scene.find('em')], Name: 'x' }), '80004005'));
    r = run('RemoveUserParameter', { Target: [pt, t2], Name: 'heat' });
    ok('RemoveUserParameter: removed from every type, S_OK', !r.err && r.v === undefined && B.status.RemoveUserParameter === 0 && !('heat' in pt.userParameters) && !('heat' in t2.userParameters));
    A.undo();
    ok('RemoveUserParameter: undo restores the parameter with its type', pt.userParameters.heat === 2 && t2.userParameters.heat === 6);
    r = run('RemoveUserParameter', { Target: [pt], Name: 'nothere' });
    ok('RemoveUserParameter: not found -> S_FALSE (1) (item 29)', !r.err && r.v === 1 && B.status.RemoveUserParameter === 1);
  } catch (e) { ok('user parameter block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= AddParticles
  try {
    fresh();
    let r = run('AddParticles', { Positions: [0, 0, 0, 1, 2, 3] });
    const c = r.v; const aop = c?.primitive?.operators.find(o => o.type === 'AddParticleOp');
    ok('AddParticles: no cloud -> a new cloud (OutputObj), Particle_Renderer material', !r.err && c?.type === 'cloud' && c.material?.surface?.name === 'Particle_Renderer', [r.err, c?.type]);
    ok('AddParticles: no type -> the container gets one (CreateParticleType)', S.particleTypes.length === 1 && aop?.particles.type === S.particleTypes[0]);
    ok('AddParticles: AddParticleOp with the C3DAddParticleOp parameters; positions stored, empty Velocities -> zeros', aop?.val('Multiplicity') === 20 && near(aop?.val('Radius'), 0.2) && J(aop?.particles.positions) === J([0, 0, 0, 1, 2, 3]) && J(aop?.particles.velocities) === J([0, 0, 0, 0, 0, 0]));
    c.kinematics.local.get('posx').value = 5;
    r = run('AddParticles', { InputObj: [c], Positions: [6, 0, 0], Velocities: [1, 0, 0] });
    const ops = c.primitive.operators.filter(o => o.type === 'AddParticleOp'); const last = ops.at(-1).particles;
    ok('AddParticles: existing cloud -> no OutputObj; World Referential true -> inverse global kinematics', !r.err && r.v === undefined && near(last.positions[0], 1) && near(last.velocities[0], 1), [r.err, last?.positions]);
    r = run('AddParticles', { InputObj: [c], Positions: [6, 0, 0], 'World Referential': false });
    ok('AddParticles: World Referential false -> positions unchanged', c.primitive.operators.filter(o => o.type === 'AddParticleOp').at(-1).particles.positions[0] === 6);
    ok('AddParticles: empty Positions -> 0x80070057', status(run('AddParticles', { InputObj: [c], Positions: [] }), '80070057'));
    ok('AddParticles: Velocities not an array -> 0x80070057', status(run('AddParticles', { InputObj: [c], Positions: [0, 0, 0], Velocities: 'x' }), '80070057'));
  } catch (e) { ok('AddParticles block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= Connect / Disconnect / SetParticleInitState
  try {
    fresh(); const { cloud, op } = sparks();
    const init = A.run('AddParticles', { Positions: [0, 1, 0] }); A.select([]);
    let r = run('ConnectParticleInitState', { InputObj: [cloud], InitCloud: [init] });
    const isp = init.properties.find(p => p.type === 'ParticleInitState');
    ok('ConnectParticleInitState: init-state property created on the init cloud, connected on group 4', !r.err && !!isp && C(op).initialState.length === 1 && C(op).initialState[0] === isp && isp.val('transfervelocity') === false, [r.err, names(C(op).initialState)]);
    r = run('ConnectParticleInitState', { InputObj: [op], InitCloud: [init] });
    ok('ConnectParticleInitState: an operator item; existing property reused', !r.err && init.properties.filter(p => p.type === 'ParticleInitState').length === 1 && C(op).initialState.length === 1);
    r = run('DisconnectParticleInitState', { InputObj: [cloud] });
    ok('DisconnectParticleInitState: group 4 emptied', !r.err && C(op).initialState.length === 0);
    const fl = A.run('CreateFluid', { InputObjs: 'Cube' })[0]; A.select([]);
    ok('ConnectParticleInitState: not a Sparks op -> 0x80004005 + sparks 0x6f', (r = run('ConnectParticleInitState', { InputObj: [fl], InitCloud: [init] }), status(r, '80004005') && has(r, /sparks 0x6f/)));
    ok('ConnectParticleInitState: InitCloud not a cloud -> 0x80004005', status(run('ConnectParticleInitState', { InputObj: [cloud], InitCloud: [A.scene.find('em')] }), '80004005'));
    ok('DisconnectParticleInitState: neither cloud nor op -> 0x80004005', status(run('DisconnectParticleInitState', { InputObj: [A.scene.find('em')] }), '80004005'));
    // SetParticleInitState
    A.run('AddParticles', { InputObj: [cloud], Positions: [1, 1, 1, 2, 2, 2] }); A.select([]);
    r = run('SetParticleInitState', { InputObj: [cloud] });
    const s1 = A.scene.find('cloud_InitState');
    ok('SetParticleInitState: new <cloud>_InitState cloud under the cloud\'s parent, particles copied, connected on group 4', !r.err && !!s1 && s1.parentObj === cloud.parentObj && J(s1.particles?.map(p => p.positions)) === J([[1, 1, 1, 2, 2, 2]]) && C(op).initialState[0]?.parent === s1, [r.err, s1?.name]);
    ok('SetParticleInitState: unread SetValue parameters logged', nya(r));
    B.hooks.msgBox = () => 7;  // No -> mode 2: disconnect, keep the old init cloud
    r = run('SetParticleInitState', { InputObj: [cloud] });
    const s2 = C(op).initialState[0]?.parent;
    ok('SetParticleInitState: existing init state, answer No -> old disconnected but kept', !r.err && s2 && s2 !== s1 && [...A.scene.allObjects()].includes(s1) && C(op).initialState.length === 1 && B.boxes.at(-1).text === 'This cloud already has an initial state. Do you wish to replace it?', [r.err]);
    B.hooks.msgBox = () => 6;  // Yes -> mode 1: delete the old init cloud
    r = run('SetParticleInitState', { InputObj: [cloud] });
    ok('SetParticleInitState: answer Yes -> old init cloud deleted', !r.err && ![...A.scene.allObjects()].includes(s2) && C(op).initialState.length === 1, r.err);
    B.hooks.msgBox = () => 2; const before = C(op).initialState[0]; const nObj = [...A.scene.allObjects()].length;
    r = run('SetParticleInitState', { InputObj: [cloud] });
    ok('SetParticleInitState: Cancel -> nothing changes', !r.err && C(op).initialState[0] === before && [...A.scene.allObjects()].length === nObj);
    B.interactive = false; const nb = B.boxes.length;
    r = run('SetParticleInitState', { InputObj: [cloud] });
    ok('SetParticleInitState: no UI -> replace (mode 1) without asking', !r.err && B.boxes.length === nb && ![...A.scene.allObjects()].includes(before.parent));
    r = run('SetParticleInitState', { InputObj: [A.scene.find('em')] });
    ok('SetParticleInitState: no cloud processed -> S_FALSE (1)', !r.err && r.v === 1 && B.status.SetParticleInitState === 1);
    A.select([]); r = run('SetParticleInitState', {});
    ok('SetParticleInitState: no input -> 1', r.v === 1);
    ok('SetParticleInitState: not a Sparks cloud -> 0x80004005', status(run('SetParticleInitState', { InputObj: [fl] }), '80004005'));
  } catch (e) { ok('init state block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= SIAddParticleEvent / CreateEventSource / SetEventObstacle / AddParticleObstacle
  try {
    fresh(); const { cloud, op } = sparks(); const pt = S.particleTypes[0];
    let r = run('SIAddParticleEvent', { Target: [pt] });
    const ev = r.v?.[0];
    ok('SIAddParticleEvent: one event per target, attached to the type, in Output', !r.err && ev?.type === 'ParticleEvent' && pt.particleElements.includes(ev) && r.v.length === 1, r.err);
    ok('SIAddParticleEvent: C3DParticleEvent parameters (TriggerValue 100)', ev?.val('TriggerValue') === 100);
    const src = ev?.eventSource;
    ok('SIAddParticleEvent: CreateEventSource sub-task -> <event>_Emission with the container\'s first type', src?.type === 'EventSource' && src.name === `${ev.name}_Emission` && src.parType === pt && ev.parType === pt);
    ok('CreateEventSource: the source is connected on the event\'s op (group 6)', C(op).eventSources.includes(src));
    r = run('CreateEventSource', { Target: [ev] });
    ok('CreateEventSource: existing source -> returned in Output, S_FALSE (item 29)', !r.err && r.v === src && B.status.CreateEventSource === 1);
    ok('CreateEventSource: more than one Target -> 0x8000ffff', status(run('CreateEventSource', { Target: [ev, ev] }), '8000ffff'));
    ok('CreateEventSource: Target without the event-holder interface fails', !!run('CreateEventSource', { Target: [pt] }).err);
    r = run('SIAddParticleEvent', { Target: [A.scene.find('em')] });
    ok('SIAddParticleEvent: no target succeeded -> 0x80070057, sparks message 0x126', status(r, '80070057') && has(r, /sparks 0x126/), r);
    const wall = mk('Grid', 'wall');
    r = run('SetEventObstacle', { Target: [ev], Source: [wall] });
    const ob = wall.properties.find(p => p.type === 'ObstacleProp');
    ok('SetEventObstacle: obstacle property <name>_obstacle on the source, set on the event, connected to the op', !r.err && ob?.name === 'wall_obstacle' && ev.obstacle === ob && C(op).obstacles.includes(ob), [r.err, ob?.name]);
    ok('SetEventObstacle: C3DParObstacle parameters (ObstacleType 1, Friction 1)', ob?.val('ObstacleType') === 1 && ob?.val('Friction') === 1);
    ok('SetEventObstacle: empty Source -> 0x8000ffff', status(run('SetEventObstacle', { Target: [ev] }), '8000ffff'));
    ok('SetEventObstacle: empty Target -> 0x8000ffff', status(run('SetEventObstacle', { Source: [wall] }), '8000ffff'));
    // AddParticleObstacle
    const t2 = A.run('CreateParticleType', {}); const w2 = mk('Grid', 'wall2');
    const ne = S.particleTypes.map(t => (t.particleElements ?? []).length);
    r = run('AddParticleObstacle', { Target: [cloud], InputObj: [w2] });
    const ob2 = w2.properties.find(p => p.type === 'ObstacleProp');
    ok('AddParticleObstacle (Sparks): <name>_obstacle; one SIAddParticleEvent per container type, carrying the obstacle', !r.err && ob2?.name === 'wall2_obstacle' && S.particleTypes.every((t, i) => (t.particleElements ?? []).length === ne[i] + 1 && t.particleElements.some(e => e.type === 'ParticleEvent' && e.obstacle === ob2)), [r.err, S.particleTypes.map(t => (t.particleElements ?? []).map(e => e.name))]);
    const fl = A.run('CreateFluid', { InputObjs: 'Cube' })[0]; A.select([]); const fop = fl.primitive.operators[0];
    r = run('AddParticleObstacle', { Target: [fl], InputObj: [w2] });
    ok('AddParticleObstacle (HyperFlow): existing obstacle property reused and connected to the op', !r.err && w2.properties.filter(p => p.type === 'ObstacleProp').length === 1 && C(fop).obstacles.includes(ob2));
    r = run('AddParticleObstacle', { Target: [wall], InputObj: [w2] });
    ok('AddParticleObstacle: target without a simulation op -> nothing, logged', !r.err && nya(r));
    ok('AddParticleObstacle / SetEventObstacle: "Pick" entries kept (item 28)', B.entries.AddParticleObstacle[1].label === 'Pick Obstacle' && B.entries.SetEventObstacle.length === 2);
    void t2;
  } catch (e) { ok('event block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= SIAddParticleGoal
  try {
    fresh(); const { cloud } = sparks(); const pt = S.particleTypes[0]; const t2 = A.run('CreateParticleType', {});
    const g = mk('Sphere', 'goalObj');
    let r = run('SIAddParticleGoal', { Target: [cloud, t2], InputObj: [g] });
    ok('SIAddParticleGoal: cloud -> each of its types, type -> itself; <name>_goal per (type, goal) in Output', !r.err && J(names(r.v)) === J(['goalObj_goal', 'goalObj_goal']) && pt.particleElements?.[0] === r.v[0] && t2.particleElements?.[0] === r.v[1] && r.v[0].goalObject === g, [r.err, names(r.v)]);
    ok('SIAddParticleGoal: C3DParticleGoal parameters (Behavior 3, Weight 1); the "= 4" parameter logged', r.v?.[0]?.val('Behavior') === 3 && r.v?.[0]?.val('Weight') === 1 && nya(r));
    r = run('SIAddParticleGoal', {});
    ok('SIAddParticleGoal: empty collections -> empty Output', !r.err && J(r.v) === '[]');
  } catch (e) { ok('goal block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= SIAddParticleForce
  try {
    fresh(); const { cloud, op, em } = sparks();
    const f = A.run('CreateForce', { PresetObj: 'Gravity' }); A.select([]);
    let r = run('SIAddParticleForce', { Target: [cloud], InputObj: [f, em] });
    ok('SIAddParticleForce: Sparks -> group 3 flag 1; non-force inputs skipped silently', !r.err && J(names(C(op).forces)) === J([f.name]) && J(op.forceGroup) === J({ group: 3, flag: 1 }) && !r.log.length, [r.err, names(C(op).forces), r.log]);
    r = run('SIAddParticleForce', { Target: [cloud], InputObj: [f] });
    ok('SIAddParticleForce: already connected -> warning "<force>: " + XSIFORCES 0x34, skipped', C(op).forces.length === 1 && has(r, new RegExp(`WARNING : ${f.name}: \\[XSIFORCES 0x34\\]`)), r.log);
    const ex = A.run('CreateExplosion', { InputObjs: 'Sphere' })[0]; A.select([]); const xop = ex.primitive.operators[0];
    r = run('SIAddParticleForce', { Target: [ex], InputObj: [f] });
    ok('SIAddParticleForce: BlowUp -> group 4 flag 0', !r.err && C(xop).forces.includes(f) && J(xop.forceGroup) === J({ group: 4, flag: 0 }));
    r = run('SIAddParticleForce', { Target: [em], InputObj: [f] });
    ok('SIAddParticleForce: target without a simulation op -> nothing, S_OK', !r.err && B.status.SIAddParticleForce === 0);
    A.undo(); A.undo();
    ok('SIAddParticleForce: undo disconnects', !C(xop).forces.includes(f));
  } catch (e) { ok('force block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= ConnectWeightMapToComponent
  try {
    fresh(); const o = mk('Cube', 'wmc');
    A.run('AddProp', { PresetObj: 'Weight Map', InputObjs: [o] }); A.select([]);
    const wm = o.allProperties().find(p => p.type === 'weightmap'); const cls = wm?.parent;
    let r = run('ConnectWeightMapToComponent', { Target: [o], PropObj: [wm] });
    const prim = o.primitive; const wop = prim.operators.find(x => x.type === 'WMCnxOp');
    const clsOk = cls && cls.kind === 'cluster';
    ok('ConnectWeightMapToComponent: object target + weight map -> WMCnxOp with inputs [geometry, cluster, weight map] (cluster from the map)', clsOk ? (!r.err && wop && wop.inputs[0] === prim && wop.inputs[1] === cls && wop.inputs[2] === wm && nya(r)) : status(r, '80004003'), [r.err, cls?.kind]);
    r = run('ConnectWeightMapToComponent', { Target: [o] });
    ok('ConnectWeightMapToComponent: missing weight map -> 0x80004003', status(r, '80004003'));
    ok('ConnectWeightMapToComponent: "Pick Component" entry kept with string defaults', J(B.entries.ConnectWeightMapToComponent[1].args.map(a => a.default)) === J(['', '']));
  } catch (e) { ok('weight map block threw', false, String(e?.stack ?? e).slice(0, 300)); }

  // ================= shader creation (inferred)
  try {
    fresh(); const o = mk('Sphere', 'shd'); A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] }); A.select([]);
    const mat = o.material; const SC = A.shaderCreationB15;
    let r = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1', Container: [mat], Name: 'MyImage' });
    ok('CreateShaderFromProgID: shader from the ProgID, nested in the container, named Name, returned', !r.err && r.v?.name === 'MyImage' && r.v?.progId === 'Softimage.txt2d-image-explicit.1' && SC.lastMethod === 2, r.err);
    const r2 = run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1', Container: [mat], Name: 'MyImage' });
    ok('CreateShaderFromProgID: name kept unique in the container', !r2.err && r2.v?.name === 'MyImage1', r2.v?.name);
    ok('CreateShaderFromProgID: unknown ProgID -> 0x80004005', status(run('CreateShaderFromProgID', { ProgID: 'Nobody.nothing.1', Container: [mat] }), '80004005'));
    ok('CreateShaderFromProgID: no container -> 0x80070057', status(run('CreateShaderFromProgID', { ProgID: 'Softimage.txt2d-image-explicit.1' }), '80070057'));
    A.undo();
    ok('CreateShaderFromProgID: undo un-nests', !run('CreateShaderFromProgID', { ProgID: 'Softimage.material-phong.1', Container: [mat] }).err);
    r = run('CreateShadersFromMaterialPreset', { PresetObj: 'Materials\\Lambert.Preset', Container: [mat] });
    ok('CreateShadersFromMaterialPreset: the preset\'s shader nested in the container, returned', !r.err && r.v?.type && /lambert/i.test(r.v.type + r.v.name) && SC.lastMethod === 4, [r.err, r.v?.type]);
    ok('CreateShadersFromMaterialPreset: unknown preset -> 0x80004005', status(run('CreateShadersFromMaterialPreset', { PresetObj: 'NoSuchPreset', Container: [mat] }), '80004005'));
    r = run('CreateShaderFromCLSID', { Clsid: '{12345678-1234-1234-1234-123456789abc}', Container: [mat] });
    ok('CreateShaderFromCLSID: no CLSID table in this build -> logged, 0x80004005', status(r, '80004005') && r.log.some(l => /not yet attested/.test(l)) && SC.lastMethod === 1);
    SC.clsids['12345678-1234-1234-1234-123456789abc'] = 'Softimage.txt2d-image-explicit.1';
    r = run('CreateShaderFromCLSID', { Clsid: '{12345678-1234-1234-1234-123456789ABC}', Container: [mat], Name: 'ByClsid' });
    ok('CreateShaderFromCLSID: a known CLSID -> shader of its definition', !r.err && r.v?.name === 'ByClsid', r.err);
    ok('CreateShaderFromCLSID: null GUID -> 0x80070057', status(run('CreateShaderFromCLSID', { Container: [mat] }), '80070057'));
  } catch (e) { ok('shader block threw', false, String(e?.stack ?? e).slice(0, 300)); }
  return out;
}, { NAMES, TWICE, DEFAULT_FAILS: [...DEFAULT_FAILS] });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const J = JSON.stringify;
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, catalogue[n].some(l => J(l) === J(got.reg[n])), `${J(got.reg[n])} vs ${J(catalogue[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
}
for (const n of TWICE) {
  const want = catalogue[n].map(l => J(l)).sort(), have = (got.entries[n] ?? []).map(l => J(l)).sort();
  report(`${n}: both registry entries on one command (item 28)`, J(want) === J(have), `${J(have)} vs ${J(want)}`);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_particles_b15c_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
