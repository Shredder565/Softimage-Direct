// CMD-B15c (sparks.dll / forces.dll particle commands): the commands of src/commands/particlesB15c.ts.
// There is no XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b15c-particles.md,
// docs/ghidra/cmd-b15f-misc-scripts.md 3.1 and docs/re/WIRE_CORRECTIONS_B15.md items 27-29.
//   1. every registry entry (data/command_registry.json; names and argument lists, duplicates such as "Pick Emitter" included)
//      is registered, under its own name or the scripting name, with the registry argument list;
//   2. every command runs with default arguments on the ?demo scene without an unexpected error (commands whose required input
//      has no default must fail with a message naming the command);
//   3. the contract's stated results (errors / S_FALSE statuses of item 29, the model effects of each command).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_particles_b15c_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [process.env.PW_CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
  .filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['ConnectWeightMapToComponent', 'ConnectParticleInitState', 'DisconnectParticleInitState', 'SetParticleInitState', 'UpdateParticleTypeConnections',
  'AddParticleEmitter', 'AddParticleObstacle', 'AddParticles', 'SetParticleType', 'CreateParticleType', 'SIAddParticleGoal', 'CreateEventSource', 'AddUserParameter',
  'RemoveUserParameter', 'SIAddParticleEvent', 'SetEventObstacle', 'SIAddParticleForce', 'CreateInspectParticleTypeSphere', 'CreateInspectParticleTypeBlob',
  'CreateInspectParticleTypeBillboard'];
// default run on the sample scene (cube selected) must fail, naming the command
const DEFAULT_FAILS = ['ConnectWeightMapToComponent', 'ConnectParticleInitState', 'DisconnectParticleInitState', 'UpdateParticleTypeConnections', 'AddParticleEmitter',
  'AddParticles', 'AddUserParameter', 'RemoveUserParameter', 'SIAddParticleEvent', 'SetEventObstacle'];

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands.filter(c => NAMES.includes(c.scripting_name));
const entries = registry.map(c => ({ name: c.name, scripting: c.scripting_name, args: c.args.map(a => [a.name, a.default ?? null]) }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SIAddParticleForce') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES, DEFAULT_FAILS, entries }) => {
  const A = window.Application; A.autoInspect = false; A.cmdLogSize = 1e9;
  const S = A.particleScripts, B = A.particlesB15c;
  const EMPTY = '{F1D7703B-083A-42B9-841D-49FE3779CECD}';
  const out = { reg: [], defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { const v = A.run(n, a); return { v, log: A.log.slice(m).filter(l => l.kind !== 'cmd').map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const status = (r, hex) => !!r.err && r.err.includes(`status 0x${hex}`);
  const nya = r => r.log.some(l => /not yet attested/.test(l) && /CMD-B15c/.test(l));
  const names = l => [...(l ?? [])].map(n => n.name);
  const st = c => B.status[c];
  const fresh = () => { A.run('NewScene'); A.autoInspect = false; S.particleTypes.length = 0; S.hooks = {}; S.scriptingSessionActive = false; S.lastInspect = null; B.hooks = {}; B.ui = false; B.wmConnections.length = 0; A.select([]); };
  const mk = (preset, name) => A.run('CreatePrim', { PresetObj: preset, GeometryType: 'MeshSurface', Name: name ?? '' });
  const prop = (o, type) => o.properties.find(p => p.type === type);
  const conn = c => c.primitive.operators.find(o => /^(ParticlesOp|FluidOp|ExplosionOp)$/.test(o.type)).connections;
  const insp = () => S.lastInspect ? names(S.lastInspect.nodes) : null;
  const cloudOfSparks = (em) => A.run('CreateParticleCloud', { InputObjs: [em] })[0];

  // ---- 1. registration (registry entries, duplicates included)
  for (const e of entries) {
    const cands = [A.commands.get(e.name), A.commands.get(e.scripting)].filter(Boolean);
    const match = cands.find(d => JSON.stringify(d.args.map(a => [a.name, a.default ?? null])) === JSON.stringify(e.args) || (e.args.length && JSON.stringify(d.args.map(a => [a.name, a.default === EMPTY ? null : a.default ?? null])) === JSON.stringify(e.args)));
    out.reg.push([`${e.name} (${e.scripting})`, !!cands.length, !!match, cands.map(d => JSON.stringify(d.args.map(a => [a.name, a.default ?? null])))]);
  }
  // both entries of a duplicated command run one handler
  for (const [a, b] of [['Pick Emitter', 'AddParticleEmitter'], ['Add Particle Emitter', 'AddParticleEmitter'], ['Pick Obstacle', 'AddParticleObstacle'], ['Pick Component', 'ConnectWeightMapToComponent'],
    ['Create a new particle type', 'CreateParticleType'], ['Set a particle type', 'SetParticleType'], ['Create Event Source', 'CreateEventSource'], ['Set Event Obstacle', 'SetEventObstacle']])
    ok(`item 28: "${a}" and ${b} are one task`, A.commands.get(a) && A.commands.get(a).execute === A.commands.get(b).execute);

  // ---- 2. default runs (cube selected)
  for (const n of NAMES) {
    fresh(); const cube = mk('Cube', 'cube'); A.select([cube]); const u0 = A.undoStack.length;
    const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? (DEFAULT_FAILS.includes(n) && r.err.includes(n) ? 'expected-failure' : 'ERROR: ' + r.err) : (DEFAULT_FAILS.includes(n) ? 'UNEXPECTED-OK' : 'ok');
  }

  // ---- 3. contracts
  try {
    // CreateParticleType / CreateInspectParticleType*
    fresh();
    let r = run('CreateParticleType');
    ok('CreateParticleType: default billboard type PType in the container, returned (Output)', !r.err && r.v === S.particleTypes[0] && r.v.type === 'ParType' && r.v.renderType === 'siBillboardType' && r.v.name === 'PType', r);
    r = run('CreateParticleType', { RenderType: ':siBlobType:siParticleRenderType' }); ok('CreateParticleType: ":siBlobType:siParticleRenderType" -> blob', r.v?.renderType === 'siBlobType' && r.v.name === 'PType1' && S.particleTypes.length === 2);
    r = run('Create a new particle type'); ok('"Create a new particle type" entry runs the same task', !r.err && S.particleTypes.length === 3);
    A.undo(); A.undo(); ok('CreateParticleType: undo removes the type', S.particleTypes.length === 1);
    A.undo(); fresh();
    for (const [k, rt] of [['Billboard', 'siBillboardType'], ['Sphere', 'siSphereType'], ['Blob', 'siBlobType']]) {
      r = run(`CreateInspectParticleType${k}`);
      ok(`CreateInspectParticleType${k}: creates a ${rt} type, AutoInspects it, no return`, !r.err && r.v === undefined && S.particleTypes.at(-1).renderType === rt && S.lastInspect?.via === 'AutoInspect' && S.lastInspect.nodes[0] === S.particleTypes.at(-1), r);
    }
    r = run('CreateInspectParticleTypeBillboard', { renderType: 'siBlobType' }); ok('CreateInspectParticleType*: renderType overrides the default', S.particleTypes.at(-1).renderType === 'siBlobType');
    ok('CreateInspectParticleType*: registered by CMD-B15c (CreateParticleType path)', A.commands.get('CreateInspectParticleTypeSphere').execute.toString().includes('CreateParticleType'));

    // AddParticleEmitter
    fresh(); const em = mk('Cube', 'em'); const em2 = mk('Sphere', 'em2'); const cube3 = mk('Cube', 'cube3');
    const cloud = cloudOfSparks(em); const c = conn(cloud); const n0 = c.emitters.length;
    r = run('AddParticleEmitter', { Target: [cloud], InputObj: [em2, cube3] });
    const e2 = prop(em2, 'EmissionProp');
    ok('AddParticleEmitter: emission property <name>_emission created, emitters connected', !r.err && e2?.name === 'em2_emission' && c.emitters.includes(em2) && c.emitters.includes(cube3) && c.emitters.length === n0 + 2, r);
    ok('AddParticleEmitter: Interactive (default) AutoInspects the new emission properties', S.lastInspect && names(S.lastInspect.nodes).join() === 'em2_emission,cube3_emission', insp());
    ok('item 29: AddParticleEmitter returns S_OK (0)', st('AddParticleEmitter') === 0);
    S.lastInspect = null; r = run('Pick Emitter', { Target: cloud.name, InputObj: 'em2', Interactive: false });
    ok('AddParticleEmitter: existing emission property reused, nothing new inspected, no duplicate connect', !r.err && em2.properties.filter(p => p.type === 'EmissionProp').length === 1 && S.lastInspect === null && c.emitters.filter(x => x === em2).length === 1, r);
    A.undo(); A.undo(); ok('AddParticleEmitter: undo restores emitters and removes the new properties', c.emitters.length === n0 && !prop(em2, 'EmissionProp') && !prop(cube3, 'EmissionProp'));
    A.redo(); A.redo();
    r = run('AddParticleEmitter', { Target: [em], InputObj: [em2] });
    ok('item 29: AddParticleEmitter 0x80070057 when no Target carries a Sparks or HyperFlow op', status(r, '80070057') && r.err.includes('AddParticleEmitter'), r);
    const fl = A.run('CreateFluid', { InputObjs: 'Cube' })[0]; const sph = mk('Sphere', 'spX'); const sq = mk('Cube', 'cubeX');
    run('AddParticleEmitter', { Target: [fl], InputObj: [sph, sq] });
    ok('AddParticleEmitter: HyperFlow accepts Disc / Cube / Square primitives only', !conn(fl).emitters.includes(sph) && conn(fl).emitters.includes(sq) && !prop(sph, 'EmissionProp'), names(conn(fl).emitters));

    // SetParticleType / UpdateParticleTypeConnections
    const t1 = A.run('CreateParticleType', {}), t2 = A.run('CreateParticleType', {});
    const eCube = prop(cube3, 'EmissionProp'); const ntypes = S.particleTypes.length;
    r = run('SetParticleType', { Target: [eCube], Source: [t1] });
    ok('SetParticleType: holder takes the source type, the operator\'s type group follows (UpdateParticleTypeConnections)', !r.err && eCube.parType === t1 && c.particleTypes.includes(t1) && S.particleTypes.length === ntypes, r);
    r = run('Set a particle type', { Target: 'cube3.cube3_emission', Source: t2.name });
    ok('"Set a particle type" (strings) sets the last particle type of Source', !r.err && eCube.parType === t2 && !c.particleTypes.includes(t1) && c.particleTypes.includes(t2), r);
    r = run('SetParticleType', { Target: [eCube] });
    ok('SetParticleType: no source -> CreateParticleType creates one and it is set', !r.err && S.particleTypes.length === ntypes + 1 && eCube.parType === S.particleTypes.at(-1), r);
    A.undo(); ok('SetParticleType: undo restores the previous type and removes the created one', eCube.parType === t2 && S.particleTypes.length === ntypes);
    r = run('UpdateParticleTypeConnections', { InputObj: [cloud] }); ok('UpdateParticleTypeConnections: cloud -> its simulation operator updated', !r.err && c.particleTypes.includes(t2));
    r = run('UpdateParticleTypeConnections', { InputObj: [em] }); ok('item 29: UpdateParticleTypeConnections raises 0x80004005 when nothing classifies', status(r, '80004005') && r.err.includes('UpdateParticleTypeConnections'), r);
    const bare = A.run('GetPrim', { PresetObj: 'Null', Name: 'bareCloud' }); bare.type = 'cloud'; bare.setPrimitive(new cloud.primitive.constructor('cloud', 'cloud'));
    r = run('UpdateParticleTypeConnections', { InputObj: [bare] }); ok('item 29: cloud without a simulation operator -> 0x80004005', status(r, '80004005'), r);
    r = run('UpdateParticleTypeConnections', { InputObj: [cloud.primitive.operators.find(o => o.type === 'ParticlesOp')] });
    ok('UpdateParticleTypeConnections: an operator is accepted', !r.err, r);

    // AddParticleObstacle
    const ob = mk('Cube', 'wall'); const evBefore = (t2.particleElements ?? []).length;
    r = run('AddParticleObstacle', { Target: [cloud], InputObj: [ob] });
    const op1 = prop(ob, 'ObstacleProp');
    ok('AddParticleObstacle: obstacle property <name>_obstacle created', !r.err && op1?.name === 'wall_obstacle', r);
    ok('AddParticleObstacle: Sparks operator gets one event per particle type with the obstacle (inferred)', (t2.particleElements ?? []).length === evBefore + 1 && t2.particleElements.at(-1).obstacle === op1, S.particleTypes.map(t => (t.particleElements ?? []).length));
    r = run('Pick Obstacle', { Target: fl.name, InputObj: 'wall' }); ok('AddParticleObstacle: other operators connect the obstacle list; "Pick Obstacle" entry', !r.err && conn(fl).obstacles.includes(op1) && nya(r), r);

    // AddParticles
    fresh(); const emP = mk('Cube', 'pe'); const cl = cloudOfSparks(emP); cl.kinematics.local.get('posx') && A.setParam(cl.kinematics.local.get('posx'), 10);
    const nt = S.particleTypes.length;
    r = run('AddParticles', { InputObj: [cl], Positions: [10, 0, 0, 11, 1, 2], Velocities: [1, 0, 0, 0, 0, 0] });
    const aop = cl.primitive.operators.find(o => o.type === 'AddParticleOp');
    ok('AddParticles: world referential -> positions by the inverse of the cloud transform (cloud at x=10)', !r.err && aop && aop.particles.count === 2 && Math.abs(aop.particles.positions[0]) < 1e-9 && Math.abs(aop.particles.positions[3] - 1) < 1e-9 && aop.particles.positions[5] === 2 && r.v === undefined, r.err ?? aop?.particles);
    r = run('AddParticles', { InputObj: [cl], Positions: [10, 0, 0], 'World Referential': false });
    const aop2 = cl.primitive.operators.filter(o => o.type === 'AddParticleOp')[1];
    ok('AddParticles: World Referential false keeps positions; empty Velocities = zeros; type from the container', aop2.particles.positions[0] === 10 && aop2.particles.velocities.join() === '0,0,0' && aop2.particles.type === S.particleTypes[0] && S.particleTypes.length === nt);
    S.particleTypes.length = 0; const ncl = [...A.scene.allObjects()].filter(o => o.type === 'cloud').length;
    r = run('AddParticles', { Positions: [0, 1, 0] });
    ok('AddParticles: no cloud -> a cloud is created and returned (OutputObj); empty container -> one type created', !r.err && r.v?.type === 'cloud' && [...A.scene.allObjects()].filter(o => o.type === 'cloud').length === ncl + 1 && S.particleTypes.length === 1 && r.v.material, r);
    ok('AddParticles: Positions missing / empty -> 0x80070057', status(run('AddParticles', { InputObj: [cl] }), '80070057') && status(run('AddParticles', { InputObj: [cl], Positions: [] }), '80070057'));
    ok('AddParticles: Velocities that is not an array -> 0x80070057', status(run('AddParticles', { InputObj: [cl], Positions: [0, 0, 0], Velocities: 5 }), '80070057'));
    A.undo(); ok('AddParticles: undo removes the created cloud', [...A.scene.allObjects()].filter(o => o.type === 'cloud').length === ncl);

    // user parameters
    fresh(); const pe = mk('Cube', 'pe2'); const cu = cloudOfSparks(pe); const T = A.run('CreateParticleType', {});
    A.run('SetParticleType', { Target: [prop(pe, 'EmissionProp')], Source: [T] });
    r = run('AddUserParameter', { Target: [T], Name: 'mass', Type: 3 });
    ok('AddUserParameter: parameter (Name, Type) on the type', !r.err && T.userParams.length === 1 && T.userParams[0].name === 'mass' && T.userParams[0].type === 3 && st('AddUserParameter') === 0, r);
    r = run('Add User Parameter To Particle Types', { Target: [cu], Name: 'age2' });
    ok('AddUserParameter: a cloud contributes all its particle types', !r.err && T.userParams.some(p => p.name === 'age2'), r);
    ok('item 29: AddUserParameter empty Name / Type >= 7 / empty Target / no type -> 0x80004005',
      status(run('AddUserParameter', { Target: [T], Name: '' }), '80004005') && status(run('AddUserParameter', { Target: [T], Name: 'x', Type: 7 }), '80004005')
      && status(run('AddUserParameter', { Name: 'x' }), '80004005') && status(run('AddUserParameter', { Target: [pe], Name: 'x' }), '80004005'));
    A.undo(); ok('AddUserParameter: undo', !T.userParams.some(p => p.name === 'age2'));
    r = run('RemoveUserParameter', { Target: [T], Name: 'mass' });
    ok('RemoveUserParameter: removes the parameter, returns S_OK', !r.err && !T.userParams.some(p => p.name === 'mass') && st('RemoveUserParameter') === 0, r);
    r = run('RemoveUserParameter', { Target: [T], Name: 'mass' });
    ok('item 29: RemoveUserParameter parameter not found -> S_FALSE (1)', !r.err && st('RemoveUserParameter') === 1, r);
    ok('RemoveUserParameter: empty Name / no type -> 0x80004005', status(run('RemoveUserParameter', { Target: [T], Name: '' }), '80004005') && status(run('RemoveUserParameter', { Target: [pe], Name: 'x' }), '80004005'));

    // events, event sources, event obstacle
    const wall = mk('Cube', 'wall2'); const T2 = A.run('CreateParticleType', {});
    r = run('SIAddParticleEvent', { Target: [T], Source: [T2] });
    const ev = r.v?.[0];
    ok('SIAddParticleEvent: one ParticleEvent per target on the type, an event source, the type slot set, Output list', !r.err && r.v.length === 1 && ev.type === 'ParticleEvent' && T.particleElements.includes(ev) && ev.eventSource?.name === `${ev.name}_Emission` && ev.parType === T2, r);
    ok('item 29: SIAddParticleEvent 0x80070057 when no target succeeds', status(run('SIAddParticleEvent', {}), '80070057') && status(run('SIAddParticleEvent', { Target: [pe] }), '80070057'));
    r = run('CreateEventSource', { Target: [ev] });
    ok('item 29: CreateEventSource when the target already has an emission source -> that source, S_FALSE (1)', !r.err && r.v === ev.eventSource && st('CreateEventSource') === 1, r);
    const r2 = run('SIAddParticleEvent', { Target: [T] }); const ev2 = r2.v[0];
    ok('CreateEventSource (inside SIAddParticleEvent): new source named <event>_Emission with the first type of the container, S_OK', ev2.eventSource.parType === S.particleTypes[0] && st('CreateEventSource') === 0);
    ev2.eventSource = undefined; r = run('Create Event Source', { Target: [ev2] });
    ok('CreateEventSource: "Create Event Source" entry creates the source, returns it, S_OK', !r.err && r.v === ev2.eventSource && r.v.name === `${ev2.name}_Emission` && st('CreateEventSource') === 0, r);
    ok('item 29: CreateEventSource 0x8000ffff with more than one Target', status(run('CreateEventSource', { Target: [ev, ev2] }), '8000ffff'));
    r = run('SetEventObstacle', { Target: [ev], Source: [wall] });
    const wp = prop(wall, 'ObstacleProp');
    ok('SetEventObstacle: source gets <name>_obstacle, the event\'s obstacle is set', !r.err && wp?.name === 'wall2_obstacle' && ev.obstacle === wp, r);
    ok('item 29: SetEventObstacle 0x8000ffff with empty Target or Source', status(run('SetEventObstacle', { Source: [wall] }), '8000ffff') && status(run('Set Event Obstacle', { Target: [ev] }), '8000ffff'));

    // forces
    const g = A.run('CreateForce', { PresetObj: 'Gravity' }); const w = A.run('CreateForce', { PresetObj: 'Wind' }); const notForce = mk('Cube', 'nf');
    r = run('SIAddParticleForce', { Target: [cu], InputObj: [g, w, notForce] });
    ok('SIAddParticleForce: Sparks operator group 3 gets the force primitives (others skipped silently)', !r.err && cu.primitive.operators[0].portGroups[3].length === 2 && conn(cu).forces.length === 2, r);
    r = run('SIAddParticleForce', { Target: [cu], InputObj: [g] });
    ok('SIAddParticleForce: already connected -> warning "<force>: ..." and skipped', !r.err && conn(cu).forces.length === 2 && r.log.some(l => l.includes(`${g.name}: `) && /^WARNING/.test(l)), r);
    r = run('SIAddParticleForce', { Target: [notForce], InputObj: [g] }); ok('SIAddParticleForce: no simulation operator -> nothing done, S_OK', !r.err && st('SIAddParticleForce') === 0);
    const bl = A.run('CreateExplosion', { InputObjs: 'Sphere' })[0]; run('SIAddParticleForce', { Target: [bl], InputObj: [w] });
    ok('SIAddParticleForce: BlowUp operator uses group 4', bl.primitive.operators.find(o => o.type === 'ExplosionOp').portGroups[4]?.length === 1);

    // goals
    const goalObj = mk('Sphere', 'goalObj');
    r = run('SIAddParticleGoal', { Target: [cu], InputObj: [goalObj] });
    ok('SIAddParticleGoal: cloud -> each of its types gets <goal>_goal (ParticleGoal), Output list', !r.err && r.v.length === conn(cu).particleTypes.length && r.v[0].name === 'goalObj_goal' && r.v[0].type === 'ParticleGoal' && nya(r), r);
    r = run('SIAddParticleGoal', { Target: [T2], InputObj: [goalObj] }); ok('SIAddParticleGoal: a particle type goes in as itself', !r.err && r.v.length === 1 && T2.particleElements.includes(r.v[0]));

    // initial state
    fresh(); const ie = mk('Cube', 'ie'); const sc = cloudOfSparks(ie); const op = sc.primitive.operators.find(o => o.type === 'ParticlesOp');
    const ini = A.run('AddParticles', { Positions: [0, 0, 0, 1, 1, 1] });
    r = run('ConnectParticleInitState', { InputObj: [sc], InitCloud: [ini] });
    ok('ConnectParticleInitState: init-state property created on the init cloud, connected to the operator', !r.err && prop(ini, 'ParticleInitState') && conn(sc).initialState[0] === ini, r);
    r = run('DisconnectParticleInitState', { InputObj: [op] }); ok('DisconnectParticleInitState: operator input, port group disconnected', !r.err && conn(sc).initialState.length === 0, r);
    const fl2 = A.run('CreateFluid', { InputObjs: 'Cube' })[0];
    r = run('ConnectParticleInitState', { InputObj: [fl2], InitCloud: [ini] }); ok('item 29: ConnectParticleInitState with a non-Sparks operator -> 0x80004005', status(r, '80004005'), r);
    ok('item 29: ConnectParticleInitState with no InitCloud -> 0x80004005; Disconnect on non-Sparks -> 0x80004005', status(run('ConnectParticleInitState', { InputObj: [sc] }), '80004005') && status(run('DisconnectParticleInitState', { InputObj: [fl2] }), '80004005'));
    const nCl = () => [...A.scene.allObjects()].filter(o => o.type === 'cloud').length;
    A.run('AddParticles', { InputObj: [sc], Positions: [1, 2, 3] });
    const c0 = nCl(); r = run('SetParticleInitState', { InputObj: [sc] });
    const init1 = conn(sc).initialState[0];
    ok('SetParticleInitState: <cloud>_InitState created, particles copied, connected, S_OK', !r.err && init1?.name === `${sc.name}_InitState` && nCl() === c0 + 1 && prop(init1, 'ParticleInitState') && init1.primitive.particles.length === 1 && st('SetParticleInitState') === 0, r);
    r = run('SetParticleInitState', { InputObj: [sc] });
    ok('SetParticleInitState: existing init state without UI -> replaced (old deleted)', !r.err && conn(sc).initialState[0] !== init1 && ![...A.scene.allObjects()].includes(init1), r);
    const init2 = conn(sc).initialState[0]; B.ui = true; B.hooks.messageBox = () => 'cancel'; const cB = nCl();
    r = run('SetParticleInitState', { InputObj: [sc] });
    ok('SetParticleInitState: UI answer Cancel -> nothing, S_FALSE (1)', !r.err && conn(sc).initialState[0] === init2 && nCl() === cB && st('SetParticleInitState') === 1, r);
    B.hooks.messageBox = () => 'no'; r = run('SetParticleInitState', { InputObj: [sc] });
    ok('SetParticleInitState: UI answer No -> old state disconnected (kept), a new one connected', !r.err && conn(sc).initialState[0] !== init2 && [...A.scene.allObjects()].includes(init2), r);
    B.ui = false; r = run('SetParticleInitState', { InputObj: [sc], Overwrite: 3 }); ok('SetParticleInitState: Overwrite non-zero used as the mode (3 = stop) -> S_FALSE', !r.err && st('SetParticleInitState') === 1);
    r = run('SetParticleInitState', {}); ok('item 29: SetParticleInitState with no input -> S_FALSE (1)', !r.err && st('SetParticleInitState') === 1);
    r = run('SetParticleInitState', { InputObj: [ie] }); ok('item 29: SetParticleInitState with no cloud in the list -> S_FALSE (1)', !r.err && st('SetParticleInitState') === 1);
    ok('item 29: SetParticleInitState on a non-Sparks cloud -> 0x80004005', status(run('SetParticleInitState', { InputObj: [fl2] }), '80004005'));

    // weight map
    fresh(); const wc = mk('Cube', 'wcube'); A.compSel = { obj: wc, kind: 'point', points: new Set([0, 1, 2]), edges: new Set(), polygons: new Set() };
    const cl2 = A.run('CreateCluster', { Name: 'wcl' }); const P = wc.properties[0].constructor;
    const wm = new P('Weight_Map', 'weightmap', []); cl2.addProperty(wm);
    const tgt = mk('Sphere', 'wtarget');
    r = run('ConnectWeightMapToComponent', { Target: [tgt], PropObj: [wm] });
    ok('ConnectWeightMapToComponent: geometry from the weight map\'s cluster owner (target an object), WMCnxOp made', !r.err && B.wmConnections.length === 1 && B.wmConnections[0].map === wm && B.wmConnections[0].cluster === cl2 && B.wmConnections[0].op.type === 'WMCnxOp' && nya(r), r);
    r = run('Pick Component', { Target: 'wcube', PropObj: 'wcube.wcl.Weight_Map' });
    ok('ConnectWeightMapToComponent: "Pick Component" entry (strings) runs the same task', !r.err && B.wmConnections.length === 2, r);
    A.undo(); ok('ConnectWeightMapToComponent: undo', B.wmConnections.length === 1);
    r = run('ConnectWeightMapToComponent', { Target: [tgt] }); ok('ConnectWeightMapToComponent: weight map missing -> 0x80004003', status(r, '80004003'), r);
  } catch (e) { ok('contract block threw', false, String(e?.stack ?? e).slice(0, 500)); }
  fresh();
  return out;
}, { NAMES, DEFAULT_FAILS, entries });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const [n, reg, match, args] of got.reg) { report(`${n}: registered`, reg); report(`${n}: registry argument list`, match, args.join(' | ')); }
for (const n of NAMES) report(`${n}: default run`, got.defaults[n] === 'ok' || got.defaults[n] === 'expected-failure', got.defaults[n]);
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_particles_b15c_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands, ${got.reg.length} registry entries)`);
await browser.close();
process.exit(fail ? 1 : 0);
