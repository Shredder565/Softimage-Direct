// CMD-03b: the 12 legacy particle script commands on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-03b-particle-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration,
// a run with default arguments, and the stated results of every command (return values, created objects and
// properties, log lines, the contract's error paths). The native callees (Q1) are modelled, not attested.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_particle_script_commands.mjs
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

const NAMES = ['CreateParticleCloud', 'CreateFluid', 'CreateExplosion', 'CreateInspectParticleTypeBillboard', 'CreateInspectParticleTypeSphere',
  'CreateInspectParticleTypeBlob', 'CreateParticleSimulationFromFile', 'InspectInitStateProp', 'AddParticleEvent', 'AddParticleGoal',
  'AddParticleForce', 'EmitPointsFromObject'];
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
// every registry entry (overload) of each scripting name, as [argName, default] lists
const registry = Object.fromEntries(NAMES.map(n => [n, list.filter(x => x.scripting_name === n).map(c => c.args.map(a => [a.name, a.default ?? null]))]));
for (const n of NAMES) if (!registry[n].length) { console.error(`registry has no command ${n}`); process.exit(2); }

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('EmitPointsFromObject'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; const S = A.particleScripts;
  const out = {};
  const nm = n => n == null ? null : n.name;
  const names = l => [...(l ?? [])].map(nm);
  const logFrom = i => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}|${l.text}`);
  const run = (name, args) => { const i = A.log.length; try { const v = A.run(name, args ?? {}); return { v, log: logFrom(i) }; } catch (e) { return { err: String(e?.message ?? e), cancelled: e?.siErrCancelled === true, log: logFrom(i) }; } };
  const kind = v => v === undefined ? 'undefined' : v === null ? 'null' : Array.isArray(v) ? `array(${v.length})` : typeof v === 'object' && v.kind ? v.kind : typeof v;
  const noNya = l => l.filter(x => !/not yet attested/.test(x) && !/siErrCancelled/.test(x));   // drops the bus's own failure line of a cancelled command
  const fresh = () => { A.run('NewScene'); A.autoInspect = false; S.particleTypes.length = 0; S.hooks = { fileBrowser: () => '' }; S.scriptingSessionActive = false; S.lastInspect = null; A.select([]); };
  const mk = (preset, name) => A.run('CreatePrim', { PresetObj: preset, GeometryType: 'MeshSurface', Name: name ?? '' });
  const prop = (o, type) => o.properties.find(p => p.type === type);
  const conn = c => { const k = c.primitive.operators[0].connections; return { main: names(k.main), emitters: names(k.emitters), obstacles: names(k.obstacles), forces: names(k.forces), initialState: names(k.initialState), particleTypes: names(k.particleTypes) }; };
  const gen = (o, p) => o.primitive.operators[0]?.get(p)?.value ?? o.primitive.get(p)?.value ?? null;
  const disp = o => { const d = prop(o, 'display'); return [d.shared, d.wirecolIndex, !!d.val('wirecol')]; };
  const insp = () => S.lastInspect ? [S.lastInspect.via, names(S.lastInspect.nodes), S.lastInspect.keywords ?? null] : null;
  // a particle cloud object with no simulation operator (stands for a cloud made elsewhere)
  const emptyCloud = (n, mesh) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: n }); o.type = 'cloud'; o.setPrimitive(new mesh.primitive.constructor('cloud', 'cloud')); return o; };
  const ports = m => Object.fromEntries(Object.entries(m.portShaders ?? {}).map(([k, v]) => [k, nm(v)]));

  // ---------------------------------------------------------------- 1. registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? { args: d.args.map(a => [a.name, a.default ?? null]), category: d.category } : null]; }));

  // ---------------------------------------------------------------- 2. every command with default arguments (demo scene, sphere selected)
  A.autoInspect = false; S.hooks = { fileBrowser: () => '' };
  { const sp = A.scene.find('sphere') ?? mk('Sphere'); A.select([sp]); }
  out.defaults = {};
  for (const n of NAMES) { const sp = A.scene.find('sphere'); A.select([sp]); const r = run(n); out.defaults[n] = { err: r.err ?? null, cancelled: !!r.cancelled, kind: r.err ? null : kind(r.v) }; }

  // ---------------------------------------------------------------- 3. CreateParticleCloud
  {
    const r = {};
    for (const prim of ['Sphere', 'Disc', 'Grid', 'Cube']) {
      fresh(); const other = mk('Cube', 'ignored'); A.select([other]);
      const res = run('CreateParticleCloud', { Prim: prim.toUpperCase() });        // case-insensitive
      const c = res.v?.[0]; const em = A.scene.find('PEmitter');
      r[prim] = {
        err: res.err ?? null, ret: kind(res.v), cloudType: c?.type, emitter: nm(em), emitterIsMesh: !!em?.primitive?.mesh(),
        params: prim === 'Sphere' ? [gen(em, 'radius')] : prim === 'Disc' ? [gen(em, 'innerradius'), gen(em, 'outerradius'), gen(em, 'subdivv')]
          : prim === 'Grid' ? [gen(em, 'ulength'), gen(em, 'vlength'), gen(em, 'subdivu'), gen(em, 'subdivv')] : [gen(em, 'length')],
        display: disp(em), emission: [nm(prop(em, 'EmissionProp')), prop(em, 'EmissionProp')?.val('ParType')],
        types: S.particleTypes.map(p => [p.name, p.type, p.renderType]), conn: conn(c), opType: c.primitive.operators[0].type, opPreset: c.primitive.operators[0].preset,
        inputIgnored: !prop(other, 'EmissionProp'),
        material: [c.material?.name, nm(c.material?.surface), ports(c.material)], inspect: insp(), log: noNya(res.log),
      };
    }
    // existing objects as emitters: group flattened, cloud dropped from emitters, first op-less cloud = initial state
    fresh();
    const a = mk('Cube', 'emA'), b = mk('Sphere', 'emB'), g1 = mk('Grid', 'inGroup');
    const grp = A.run('CreateGroup', { Name: 'G', InputObjs: [g1] });
    const first = A.run('CreateParticleCloud', { InputObjs: [a] })[0];             // a cloud with a ParticlesOp, and emA gets an emission property
    const emBefore = prop(a, 'EmissionProp');
    const res = run('CreateParticleCloud', { InputObjs: [a, b, grp, first], Prim: '' });
    const c = res.v?.[0];
    r.objects = {
      err: res.err ?? null, conn: conn(c), keptExisting: prop(a, 'EmissionProp') === emBefore && a.properties.filter(p => p.type === 'EmissionProp').length === 1,
      newEmissions: [nm(prop(b, 'EmissionProp')), nm(prop(g1, 'EmissionProp'))], emissionType: prop(b, 'EmissionProp')?.val('ParType'),
      types: S.particleTypes.map(p => p.name), firstHasInitState: !!prop(first, 'ParticleInitState'), cloudsDistinct: c !== first, material: c.material?.name,
    };
    // an op-less cloud becomes the initial-state input; only the first one
    fresh();
    const e = mk('Cube', 'em');
    const mkCloud = n => emptyCloud(n, e);
    const c1 = mkCloud('c1'), c2 = mkCloud('c2');
    const res2 = run('CreateParticleCloud', { InputObjs: [e, c1, c2] });
    r.initState = { err: res2.err ?? null, conn: conn(res2.v[0]), c1: nm(prop(c1, 'ParticleInitState')), c1Type: prop(c1, 'ParticleInitState')?.type, c2: !!prop(c2, 'ParticleInitState') };
    // selection fallback and undo
    fresh(); const s = mk('Sphere', 'sel'); A.select([s]); const n0 = [...A.scene.allObjects()].length;
    const res3 = run('CreateParticleCloud'); r.fromSelection = { emitters: conn(res3.v[0]).emitters, count: [...A.scene.allObjects()].length - n0 };
    A.undo(); r.undo = { count: [...A.scene.allObjects()].length - n0, emission: !!prop(s, 'EmissionProp'), types: S.particleTypes.length };
    // no usable emitters: the operator is still applied with empty groups
    fresh(); const res4 = run('CreateParticleCloud'); r.empty = { err: res4.err ?? null, conn: conn(res4.v[0]), types: S.particleTypes.length };
    out.cloud = r;
  }

  // ---------------------------------------------------------------- 4. CreateFluid
  {
    const r = {};
    for (const prim of ['Cube', 'Square', 'Disc']) {
      fresh(); const res = run('CreateFluid', { InputObjs: prim.toLowerCase() });
      const c = res.v?.[0]; const em = A.scene.find('FluidEmitter'); const em2 = prop(em, 'EmissionProp');
      r[prim] = {
        err: res.err ?? null, ret: kind(res.v), cloudType: c?.type, emitter: nm(em),
        params: prim === 'Disc' ? [gen(em, 'innerradius'), gen(em, 'outerradius')] : [gen(em, 'length')],
        display: disp(em), rot: ['x', 'y', 'z'].map(ax => em.kinematics.local.val('rot' + ax)),
        emission: [nm(em2), em2?.val('Generation'), em2?.val('ParType')], types: S.particleTypes.map(p => [p.name, p.renderType]),
        opType: c.primitive.operators[0].type, opPreset: c.primitive.operators[0].preset, conn: conn(c),
        material: [c.material?.name, nm(c.material?.surface)], inspect: insp(), log: noNya(res.log),
      };
    }
    fresh(); const bad = run('CreateFluid', { InputObjs: 'Sphere' });
    r.bad = { err: bad.err ?? null, ret: kind(bad.v), log: noNya(bad.log), types: S.particleTypes.map(p => p.renderType), objects: [...A.scene.allObjects()].filter(o => o.type === 'cloud').length };
    out.fluid = r;
  }

  // ---------------------------------------------------------------- 5. CreateExplosion
  {
    const r = {};
    for (const prim of ['Sphere', 'Cylinder']) {
      fresh(); const res = run('CreateExplosion', { InputObjs: prim.toLowerCase() });
      const c = res.v?.[0]; const em = A.scene.find('ExplosionEmitter'); const light = A.scene.find('ExplosionLight'); const op = c?.primitive.operators[0];
      const gp = o => { const e = o.globalMatrix().elements; return [e[12], e[13], e[14]]; };
      r[prim] = {
        err: res.err ?? null, ret: kind(res.v), cloudType: c?.type, emitter: nm(em), emitterIsMesh: !!em?.primitive?.mesh(), rendvis: prop(em, 'visibility').val('rendvis'),
        params: prim === 'Sphere' ? [gen(em, 'radius')] : [gen(em, 'subdivv'), gen(em, 'height')], locked: em.primitive.operators[0].locked === true,
        display: disp(em), light: [nm(light), light?.type, nm(light?.parentObj)], samePos: JSON.stringify(gp(light)) === JSON.stringify(gp(em)), lightDisplay: disp(light),
        opType: op?.type, opPreset: op?.preset, inputs: op?.connections.inputs.map(x => typeof x === 'string' ? x : nm(x)), emittertype: op?.val('emittertype'),
        material: [nm(c.material?.surface), ports(c.material), c.material?.portConnections.has('photon')], inspect: insp(), types: S.particleTypes.length, log: noNya(res.log),
      };
    }
    fresh(); const bad = run('CreateExplosion', { InputObjs: 'Cube' });
    r.bad = { err: bad.err ?? null, ret: kind(bad.v), log: noNya(bad.log), objects: [...A.scene.allObjects()].filter(o => o.type === 'cloud').length };
    out.explosion = r;
  }

  // ---------------------------------------------------------------- 6. CreateInspectParticleType*
  {
    fresh(); const r = {};
    for (const k of ['Billboard', 'Sphere', 'Blob']) { const res = run(`CreateInspectParticleType${k}`); r[k] = [res.err ?? null, kind(res.v), S.particleTypes.at(-1).renderType, S.particleTypes.at(-1).type, insp()]; }
    const ov = run('CreateInspectParticleTypeBillboard', { renderType: 'siBlobType' }); r.override = [ov.err ?? null, S.particleTypes.at(-1).renderType, S.particleTypes.length];
    A.undo(); r.undo = S.particleTypes.length;
    out.ptype = r;
  }

  // ---------------------------------------------------------------- 7. CreateParticleSimulationFromFile
  {
    const r = {};
    fresh(); let asked = null; S.hooks.fileBrowser = o => { asked = o; return ''; };
    const n0 = [...A.scene.allObjects()].length;
    const cancel = run('CreateParticleSimulationFromFile'); r.cancel = [cancel.err ?? null, kind(cancel.v), cancel.log, [...A.scene.allObjects()].length - n0]; r.asked = asked;
    S.hooks.fileBrowser = () => 'c:\\caches\\picked.ptp';
    const picked = run('CreateParticleSimulationFromFile'); const c1 = [...A.scene.allObjects()].find(o => o.type === 'cloud');
    r.picked = [picked.err ?? null, kind(picked.v), c1?.primitive.operators[0].val('infilename')];
    fresh(); let called = false; S.hooks.fileBrowser = () => { called = true; return ''; };
    const res = run('CreateParticleSimulationFromFile', { FileName: 'd:\\no\\such\\file.ptp' }); const c = [...A.scene.allObjects()].find(o => o.type === 'cloud'); const op = c?.primitive.operators[0];
    r.named = { err: res.err ?? null, ret: kind(res.v), browser: called, op: [op?.name, op?.preset, op?.val('infilename'), op?.val('writeout')], material: [c?.material?.name, nm(c?.material?.surface)], inspect: insp(), log: noNya(res.log) };
    out.fromFile = r;
  }

  // ---------------------------------------------------------------- 8. InspectInitStateProp (both entries)
  {
    const r = {};
    fresh(); const e = mk('Cube', 'em');
    const init = emptyCloud('initCloud', e);
    const cloud = A.run('CreateParticleCloud', { InputObjs: [e, init] })[0];
    S.lastInspect = null; const a = run('InspectInitStateProp', { InputObjs: [cloud] });
    r.viaOp = [a.err ?? null, kind(a.v), insp(), noNya(a.log)];
    S.lastInspect = null; const b = run('InspectInitStateProp', { InputObjs: [init] }); r.local = [insp(), noNya(b.log)];
    S.lastInspect = null; const p = run('InspectInitStateProp', { InputObjs: [cloud.primitive] }); r.primitive = [insp(), noNya(p.log)];
    S.lastInspect = null; const o = run('InspectInitStateProp', { InputObjs: [e] }); r.other = [o.err ?? null, insp(), o.log.length];
    A.select([init]); S.lastInspect = null; run('InspectInitStateProp'); r.selection = insp();
    S.scriptingSessionActive = true; S.lastInspect = null; run('InspectInitStateProp', { InputObjs: [cloud] }); r.session = insp();
    r.sessionOp = S.inspectParticleSimulationOp([cloud]) === undefined && insp() === null;
    S.scriptingSessionActive = false;
    const ops = S.inspectParticleSimulationOp([cloud, cloud.primitive, cloud.primitive.operators[0], e, init]); r.ops = [names(ops), insp()];
    out.inspect = r;
  }

  // ---------------------------------------------------------------- 9. AddParticleEvent
  {
    const r = {};
    fresh(); run('CreateInspectParticleTypeBillboard'); run('CreateInspectParticleTypeSphere'); const [t1, t2] = S.particleTypes; const cube = mk('Cube', 'c');
    A.select([cube]); const none = run('AddParticleEvent'); r.none = [none.cancelled, noNya(none.log), (t1.particleElements ?? []).length];
    // pick loop: every pick replaces the previous one; non-matching picks are not accepted
    const seq = [t1, cube, t2, null]; const seen = []; S.hooks.pickElement = (f, l, m) => { seen.push([f, l, m]); return seq.shift(); };
    const picked = run('AddParticleEvent'); r.picked = [picked.err ?? null, names(picked.v?.Target), seen[0], seen.length, names(t2.particleElements), (t1.particleElements ?? []).length];
    delete S.hooks.pickElement;
    // explicit target; the Source argument is not consulted, sources come from the work list
    const ex = run('AddParticleEvent', { Target: [t1, t2, cube], Source: [cube] });
    r.explicit = [ex.err ?? null, names(ex.v?.Target), names(ex.v?.Source), names(ex.v?.Output), ex.v?.Output.map(x => x.type), insp()];
    // obstacle property as target, particle types in the rest of the selection as sources
    const obst = new cube.properties[0].constructor('Obstacle', 'ObstacleProp', []); cube.addProperty(obst);
    A.select([obst]); const ob = run('AddParticleEvent'); r.obstacleOnly = [names(ob.v?.Target), names(ob.v?.Source)];
    const byName = run('AddParticleEvent', { Target: 'PType' }); r.byName = [byName.err ?? null, names(byName.v?.Target)];
    out.event = r;
  }

  // ---------------------------------------------------------------- 10. AddParticleGoal
  {
    const r = {};
    fresh(); const e = mk('Cube', 'em'); const goal = mk('Sphere', 'goal'); const cloud = A.run('CreateParticleCloud', { InputObjs: [e] })[0]; const pt = S.particleTypes[0];
    A.select([goal]); const noTarget = run('AddParticleGoal', { InputObj: [goal] }); r.noTarget = [noTarget.cancelled, noNya(noTarget.log)];
    A.select([cloud, goal]); const noGoal = run('AddParticleGoal'); r.noGoal = [noGoal.cancelled, noNya(noGoal.log)];   // the selection is not a fallback for goals
    const res = run('AddParticleGoal', { Target: [cloud, pt, goal], InputObj: [goal, cloud] });
    r.ok = [res.err ?? null, names(res.v?.Target), names(res.v?.InputObj), names(res.v?.Output), res.v?.Output.map(x => x.type), !!prop(cloud, 'ParticleGoal'), names(pt.particleElements), insp()];
    const seq = [goal, null]; const seen = []; S.hooks.pickElement = (f, l) => { seen.push([f, l]); return seq.shift(); };
    A.select([cloud]); const pick = run('AddParticleGoal'); r.pick = [pick.err ?? null, names(pick.v?.InputObj), seen];
    delete S.hooks.pickElement;
    const alias = run('AddParticleGoal', { Target: [cloud], InputObjs: 'goal' }); r.alias = [alias.err ?? null, names(alias.v?.InputObj)];
    out.goal = r;
  }

  // ---------------------------------------------------------------- 11. AddParticleForce
  {
    const r = {};
    fresh(); const e = mk('Cube', 'em'); const cloud = A.run('CreateParticleCloud', { InputObjs: [e] })[0];
    const f1 = A.run('CreateForce', { Name: 'Gravity' }), f2 = A.run('CreateForce', { Name: 'Wind' });
    A.select([f1]); const none = run('AddParticleForce'); r.none = [none.cancelled, noNya(none.log)];
    // a force found in Target counts as a force; duplicates removed
    const res = run('AddParticleForce', { Target: [cloud, f1], InputObj: [f2, f1] });
    r.ok = [res.err ?? null, names(res.v?.Target), names(res.v?.InputObj), conn(cloud).forces, insp()];
    A.undo(); r.undo = conn(cloud).forces; A.redo();
    // no forces: the pick is cancelled, the command still goes on with the empty collection
    A.select([cloud]); const empty = run('AddParticleForce'); r.empty = [empty.err ?? null, names(empty.v?.Target), names(empty.v?.InputObj), noNya(empty.log), conn(cloud).forces];
    const seq = [f2, f1, null]; S.hooks.pickElement = () => seq.shift();
    const fresh2 = A.run('CreateParticleCloud', { InputObjs: [e] })[0]; A.select([fresh2]); const pick = run('AddParticleForce'); r.pick = [names(pick.v?.InputObj), conn(fresh2).forces];
    delete S.hooks.pickElement;
    const other = run('AddParticleForce', { Target: [e], InputObj: [f1] }); r.nonCloud = [other.err ?? null, names(other.v?.Target), other.log.some(l => /not yet attested: connecting forces to em/.test(l))];
    out.force = r;
  }

  // ---------------------------------------------------------------- 12. EmitPointsFromObject
  {
    const r = {};
    fresh(); const none = run('EmitPointsFromObject'); r.none = [none.err ?? null, kind(none.v), none.log, [...A.scene.allObjects()].filter(o => o.type === 'pointcloud').length];
    fresh();
    const m1 = mk('Cube', 'meshA'), n1 = A.run('GetPrim', { PresetObj: 'Null', Name: 'nullA' }), m2 = mk('Sphere', 'meshB'), n2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'nullB' });
    const crv = A.run('GetPrim', { PresetObj: 'Null', Name: 'curveA' }); crv.type = 'crvlist';
    const crv2 = A.run('GetPrim', { PresetObj: 'Null', Name: 'curveB' }); crv2.type = 'crvlist';
    const gm = mk('Grid', 'grpMesh'); const grp = A.run('CreateGroup', { Name: 'G', InputObjs: [gm] });
    A.select([m1]); const selBefore = names(A.selection);
    const res = run('EmitPointsFromObject', { InputObj: [m1, n1, crv, m2, n2, crv2, grp] });
    const cloud = res.v; const tree = cloud?.primitive.operators.find(o => o.type === 'icetree');
    const node = id => tree.nodes.find(n => n.id === id); const label = n => n ? (n.type === 'Comment' ? n.params.val('text') : `${n.type}:${n.params.val('reference')}`) : 'root';
    r.run = {
      err: res.err ?? null, cloud: [nm(cloud), cloud?.type], tree: !!tree, selection: JSON.stringify(names(A.selection)) === JSON.stringify(selBefore),
      nodes: tree.nodes.map(label),
      links: tree.links.filter(l => l.to !== 0).map(l => `${label(node(l.from))}.${l.fromPort} -> ${label(node(l.to))}.${l.toPort}`),
      root: tree.rootPorts.map(p => `${p.name}=${p.from ? label(node(p.from.node)) + '.' + p.from.port : ''}`),
      rootLinks: tree.links.filter(l => l.to === 0).length,
    };
    fresh(); const s = mk('Sphere', 'only'); A.select([s]); const bySel = run('EmitPointsFromObject'); const t2 = bySel.v?.primitive.operators.find(o => o.type === 'icetree');
    r.bySelection = [bySel.err ?? null, t2?.rootPorts.map(p => !!p.from), nm(bySel.v)];
    out.emit = r;
  }
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };

// ---- 1. registration: argument names / order as in the registry; defaults equal to one registry entry
for (const n of NAMES) {
  const d = got.reg[n];
  ok(`${n}: registered with the registry's argument list`, !!d && registry[n].some(e => JSON.stringify(e) === JSON.stringify(d.args)), { got: d?.args, registry: registry[n] });
  eq(`${n}: category`, d?.category, 'Simulation');
}

// ---- 2. defaults
const CANCELS = new Set(['AddParticleEvent', 'AddParticleGoal']);   // sphere selected: no ptype / cloud, pick session ends empty -> siErrCancelled (contract)
const KIND = { CreateParticleCloud: 'array(1)', CreateFluid: 'array(1)', CreateExplosion: 'array(1)', CreateInspectParticleTypeBillboard: 'undefined', CreateInspectParticleTypeSphere: 'undefined',
  CreateInspectParticleTypeBlob: 'undefined', CreateParticleSimulationFromFile: 'undefined', InspectInitStateProp: 'undefined', AddParticleForce: 'object', EmitPointsFromObject: 'object' };
for (const n of NAMES) {
  const r = got.defaults[n];
  if (CANCELS.has(n)) ok(`${n}: default arguments -> the contract's siErrCancelled`, r.cancelled === true, r);
  else eq(`${n}: default arguments run, result kind`, [r.err, r.kind], [null, KIND[n]]);
}

// ---- 3. CreateParticleCloud
const C = got.cloud;
const PARAMS = { Sphere: [1], Disc: [0.01, 1, 3], Grid: [1, 1, 1, 1], Cube: [1] };
for (const p of ['Sphere', 'Disc', 'Grid', 'Cube']) {
  const x = C[p];
  eq(`CreateParticleCloud ${p}: returns one cloud, emitter PEmitter is a polygon mesh`, [x.err, x.ret, x.cloudType, x.emitter, x.emitterIsMesh], [null, 'array(1)', 'cloud', 'PEmitter', true]);
  eq(`CreateParticleCloud ${p}: primitive parameters`, x.params, PARAMS[p]);
  eq(`CreateParticleCloud ${p}: display local, wirecol 33`, x.display, [false, 33, true]);
  eq(`CreateParticleCloud ${p}: emission property <emitter>_emission with the new billboard type`, [x.emission, x.types], [['PEmitter_emission', 'PType'], [['PType', 'ParType', 'siBillboardType']]]);
  eq(`CreateParticleCloud ${p}: SparksOp on the emitter, InputObjs ignored, type connections updated`, [x.opPreset, x.opType, x.conn.emitters, x.conn.particleTypes, x.inputIgnored], ['SparksOp', 'ParticlesOp', ['PEmitter'], ['PType'], true]);
  eq(`CreateParticleCloud ${p}: default particle renderer on Surface only, material renamed`, x.material, ['cloud_Material', 'Particle_Renderer', { Surface: 'Particle_Renderer' }]);
  eq(`CreateParticleCloud ${p}: AutoInspect of the operator, no log lines of its own`, [x.inspect, x.log], [['AutoInspect', ['ParticlesOp'], null], []]);
}
eq('CreateParticleCloud objects: six groups in order, clouds dropped from emitters, group flattened', C.objects.conn, { main: [], emitters: ['emA', 'emB', 'inGroup'], obstacles: [], forces: [], initialState: [], particleTypes: ['PType', 'PType1'] });
eq('CreateParticleCloud objects: existing emission property left alone, new ones named <object>_emission with the new type', [C.objects.err, C.objects.keptExisting, C.objects.newEmissions, C.objects.emissionType], [null, true, ['emB_emission', 'inGroup_emission'], 'PType1']);
eq('CreateParticleCloud objects: a cloud that already has a ParticlesOp is not an initial state; a type is created per call', [C.objects.firstHasInitState, C.objects.types, C.objects.cloudsDistinct, C.objects.material], [false, ['PType', 'PType1'], true, 'cloud1_Material']);
eq('CreateParticleCloud: first op-less cloud gets ParticleInitialStateProp and is the initial-state input; later clouds ignored', C.initState, { err: null, conn: { main: [], emitters: ['em'], obstacles: [], forces: [], initialState: ['c1'], particleTypes: ['PType'] }, c1: 'ParticleInitialStateProp', c1Type: 'ParticleInitState', c2: false });
eq('CreateParticleCloud: InputObjs omitted = the selection; one object (the cloud) added', C.fromSelection, { emitters: ['sel'], count: 1 });
eq('CreateParticleCloud: undo removes cloud, emission property and particle type', C.undo, { count: 0, emission: false, types: 0 });
eq('CreateParticleCloud: no usable emitters -> operator applied with empty groups, the type is still created', C.empty, { err: null, conn: { main: [], emitters: [], obstacles: [], forces: [], initialState: [], particleTypes: [] }, types: 1 });

// ---- 4. CreateFluid
const F = got.fluid;
const FPAR = { Cube: [2], Square: [2], Disc: [0.01, 1] };
for (const p of ['Cube', 'Square', 'Disc']) {
  const x = F[p];
  eq(`CreateFluid ${p}: returns one cloud from emitter FluidEmitter`, [x.err, x.ret, x.cloudType, x.emitter], [null, 'array(1)', 'cloud', 'FluidEmitter']);
  eq(`CreateFluid ${p}: primitive parameters`, x.params, FPAR[p]);
  eq(`CreateFluid ${p}: display local wirecol 33, rotation absolute X 90`, [x.display, x.rot], [[false, 33, true], [90, 0, 0]]);
  eq(`CreateFluid ${p}: emission property, Generation 4, new blob type`, [x.emission, x.types], [['FluidEmitter_emission', 4, 'PType'], [['PType', 'siBlobType']]]);
  eq(`CreateFluid ${p}: HyperFlowOp, type connections, default renderer, AutoInspect`, [x.opPreset, x.opType, x.conn.emitters, x.conn.particleTypes, x.material, x.inspect, x.log], ['HyperFlowOp', 'FluidOp', ['FluidEmitter'], ['PType'], ['cloud_Material', 'Particle_Renderer'], ['AutoInspect', ['FluidOp'], null], []]);
}
eq('CreateFluid other primitive: warning, nothing returned, the blob type stays', F.bad, { err: null, ret: 'undefined', log: ['info|WARNING : Can only CreateFluid with Cube, Square or Disc emitters.'], types: ['siBlobType'], objects: 0 });

// ---- 5. CreateExplosion
const E = got.explosion;
for (const [p, par, et] of [['Sphere', [1], 0], ['Cylinder', [1, 1], 1]]) {
  const x = E[p];
  eq(`CreateExplosion ${p}: returns one cloud; emitter ExplosionEmitter is a mesh, not render-visible, geometry locked`, [x.err, x.ret, x.cloudType, x.emitter, x.emitterIsMesh, x.rendvis, x.locked], [null, 'array(1)', 'cloud', 'ExplosionEmitter', true, false, true]);
  eq(`CreateExplosion ${p}: primitive parameters, display local wirecol 33`, [x.params, x.display], [par, [false, 33, true]]);
  eq(`CreateExplosion ${p}: point light ExplosionLight under the emitter at its global position, wirecol 15`, [x.light, x.samePos, x.lightDisplay], [['ExplosionLight', 'light', 'ExplosionEmitter'], true, [false, 15, true]]);
  eq(`CreateExplosion ${p}: BlowUpOp on (light colour, emitter), emittertype ${et}, no particle type created`, [x.opPreset, x.opType, x.inputs, x.emittertype, x.types], ['BlowUpOp', 'ExplosionOp', ['Scene.Scene_Root.ExplosionEmitter.ExplosionLight.Point.soft_light.color', 'ExplosionEmitter'], et, 0]);
  eq(`CreateExplosion ${p}: explosion shader set (Surface + Shadow, Volume, Photon cleared), AutoInspect`, [x.material, x.inspect, x.log], [['Particle_ExplosionV2', { Surface: 'Particle_ExplosionV2', Shadow: 'Particle_ExplosionV2', Volume: 'Particle_vol_ExplosionV2' }, false], ['AutoInspect', ['ExplosionOp'], null], []]);
}
eq('CreateExplosion other primitive: warning, nothing returned or created', E.bad, { err: null, ret: 'undefined', log: ['info|WARNING : Can only CreateExplosion with Sphere or Cylinder emitters.'], objects: 0 });

// ---- 6. particle type commands
const P = got.ptype;
eq('CreateInspectParticleTypeBillboard: creates and AutoInspects a billboard type, no return value', P.Billboard, [null, 'undefined', 'siBillboardType', 'ParType', ['AutoInspect', ['PType'], null]]);
eq('CreateInspectParticleTypeSphere: sphere type', P.Sphere, [null, 'undefined', 'siSphereType', 'ParType', ['AutoInspect', ['PType1'], null]]);
eq('CreateInspectParticleTypeBlob: blob type', P.Blob, [null, 'undefined', 'siBlobType', 'ParType', ['AutoInspect', ['PType2'], null]]);
eq('CreateInspectParticleType*: a caller-supplied renderType overrides the default; undo removes the type', [P.override, P.undo], [[null, 'siBlobType', 4], 3]);

// ---- 7. CreateParticleSimulationFromFile
const FF = got.fromFile;
eq('CreateParticleSimulationFromFile empty name: browser options', FF.asked, { title: 'Load Cache File', initialDirectory: 'c:\\', baseName: '', filter: 'PTP Files (*.ptp)|*.ptp|All Files (*.*)|*.*||' });
eq('CreateParticleSimulationFromFile browser cancelled: nothing happens, nothing logged', FF.cancel, [null, 'undefined', [], 0]);
eq('CreateParticleSimulationFromFile browser path becomes the file name', FF.picked, [null, 'undefined', 'c:\\caches\\picked.ptp']);
eq('CreateParticleSimulationFromFile named: BlasterOp cloud, infilename set, writeout false, default renderer, AutoInspect, no existence check, nothing returned', FF.named,
  { err: null, ret: 'undefined', browser: false, op: ['blasterop', 'BlasterOp', 'd:\\no\\such\\file.ptp', false], material: ['cloud_Material', 'Particle_Renderer'], inspect: ['AutoInspect', ['blasterop'], null], log: [] });

// ---- 8. InspectInitStateProp
const I = got.inspect;
eq('InspectInitStateProp cloud with a ParticlesOp: the connected initial-state property, "got an 3dobject" logged', I.viaOp, [null, 'undefined', ['InspectObj', ['ParticleInitialStateProp'], null], ['info|got an 3dobject']]);
eq('InspectInitStateProp cloud without ParticlesOp: its first local ParticleInitState property', I.local, [['InspectObj', ['ParticleInitialStateProp'], null], ['info|got an 3dobject']]);
eq('InspectInitStateProp on the cloud primitive: no "got an 3dobject" line', I.primitive, [['InspectObj', ['ParticleInitialStateProp'], null], []]);
eq('InspectInitStateProp other input types skipped silently; InspectObj still called with the empty collection', [I.other[0], I.other[1]], [null, ['InspectObj', [], null]]);
eq('InspectInitStateProp: selection when InputObjs is omitted', I.selection, ['InspectObj', ['ParticleInitialStateProp'], null]);
eq('InspectInitStateProp: ScriptingSessionActive suppresses InspectObj (both entries)', [I.session, I.sessionOp], [null, true]);
eq('InspectParticleSimulationOp entry: operators resolved from cloud / primitive / operator, InspectObj keyword "Operators"', I.ops, [['ParticlesOp'], ['InspectObj', ['ParticlesOp'], 'Operators']]);

// ---- 9. AddParticleEvent
const EV = got.event;
eq('AddParticleEvent no target: prompt 1098, error line, siErrCancelled, nothing added', EV.none, [true, ['info|Pick ParType', 'error|AddParticleEvent: At least a ptype or an obstacle object needs to be selected in order to add an event to it.'], 0]);
eq('AddParticleEvent pick loop: filter Decay, same prompt for both buttons, last accepted pick wins', EV.picked, [null, ['PType1'], ['Decay', 'Pick ParType', 'Pick ParType'], 4, ['ParticleEvent'], 0]);
eq('AddParticleEvent explicit: targets filtered, Source argument not consulted, Output = created events, AutoInspect(Output)', EV.explicit, [null, ['PType', 'PType1'], [], ['ParticleEvent', 'ParticleEvent'], ['ParticleEvent', 'ParticleEvent'], ['AutoInspect', ['ParticleEvent', 'ParticleEvent'], null]]);
eq('AddParticleEvent: an obstacle property is a target', EV.obstacleOnly, [['Obstacle'], []]);
eq('AddParticleEvent: target by name', EV.byName, [null, ['PType']]);

// ---- 10. AddParticleGoal
const G = got.goal;
eq('AddParticleGoal no target: prompt 1099, error line, siErrCancelled', G.noTarget, [true, ['info|Pick cloud or ParType', 'error|AddParticleGoal: At least a cloud or ptype object needs to be selected in order to add a goal to it.']]);
eq('AddParticleGoal no goal (selection is not a fallback): prompt 1100, error line, siErrCancelled', G.noGoal, [true, ['info|Select an object that you want as a particle goal', 'error|AddParticleGoal: At least a goal object needs to be selected in order to add goal to the particle simulation.']]);
eq('AddParticleGoal: both in/out arguments come back filtered, Output = goals, AutoInspect(Output)', G.ok, [null, ['cloud', 'PType'], ['goal'], ['ParticleGoal', 'ParticleGoal'], ['ParticleGoal', 'ParticleGoal'], true, ['ParticleGoal'], ['AutoInspect', ['ParticleGoal', 'ParticleGoal'], null]]);
eq('AddParticleGoal: goal picked with filter Emitter and prompt 1100', G.pick, [null, ['goal'], [['Emitter', 'Select an object that you want as a particle goal'], ['Emitter', 'Select an object that you want as a particle goal']]]);
eq('AddParticleGoal: InputObj by name', G.alias, [null, ['goal']]);

// ---- 11. AddParticleForce
const FO = got.force;
eq('AddParticleForce only a force selected: prompt 1101, error line, siErrCancelled', FO.none, [true, ['info|Pick Cloud, Cloth, SoftBody or Hair', 'error|AddParticleForce: At least a cloud, cloth or SoftBody object needs to be selected in order to add force to it.']]);
eq('AddParticleForce: a force in Target counts as a force, duplicates removed, forces connected, AutoInspect(forces)', FO.ok, [null, ['cloud'], ['gravity', 'wind'], ['gravity', 'wind'], ['AutoInspect', ['gravity', 'wind'], null]]);
eq('AddParticleForce: undo', FO.undo, []);
eq('AddParticleForce no forces: prompt 1102, cancelled pick leaves the empty collection and the command goes on (no error line)', FO.empty, [null, ['cloud'], [], ['info|Pick Force'], ['gravity', 'wind']]);
eq('AddParticleForce: picked force (last pick wins)', FO.pick, [['gravity'], ['gravity']]);
eq('AddParticleForce: a non-cloud target is accepted by the generic object filter; its connection is logged as not yet attested', FO.nonCloud, [null, ['em'], true]);

// ---- 12. EmitPointsFromObject
const EM = got.emit;
eq('EmitPointsFromObject nothing valid: error line, no return value, nothing created', EM.none, [null, 'undefined', ['error|No valid geometry selected for emission'], 0]);
eq('EmitPointsFromObject: returns the new point cloud with a simulated ICE tree, selection unchanged', [EM.run.err, EM.run.cloud, EM.run.tree, EM.run.selection], [null, ['PointCloud', 'pointcloud'], true, true]);
eq('EmitPointsFromObject: one data node per emitter; shared Surface / Curve compounds, one Null compound per emitter, simulate node', EM.run.nodes, [
  'Get Data:Scene.Scene_Root.meshA', 'Emit from Surface', 'Get Data:Scene.Scene_Root.nullA', 'Emit from Null', 'Get Data:Scene.Scene_Root.curveA', 'Emit from Curve', 'Get Data:Scene.Scene_Root.meshB', 'Get Data:Scene.Scene_Root.nullB', 'Emit from Null',
  'Get Data:Scene.Scene_Root.curveB', 'Get Data:G', 'SimulateParticlesNode']);
eq('EmitPointsFromObject: data -> compound wiring (emitter<N> per kind, outname -> Null_Name)', EM.run.links, [
  'Get Data:Scene.Scene_Root.meshA.value -> Emit from Surface.emitter1', 'Get Data:Scene.Scene_Root.nullA.outname -> Emit from Null.Null_Name', 'Get Data:Scene.Scene_Root.curveA.value -> Emit from Curve.emitter1',
  'Get Data:Scene.Scene_Root.meshB.value -> Emit from Surface.emitter2', 'Get Data:Scene.Scene_Root.nullB.outname -> Emit from Null.Null_Name', 'Get Data:Scene.Scene_Root.curveB.value -> Emit from Curve.emitter2',
  'Get Data:G.value -> Emit from Surface.emitter3']);
eq('EmitPointsFromObject: root ports, most recent compound first, extra port after the first, simulate on the last', [EM.run.root, EM.run.rootLinks], [
  ['port1=Emit from Null.emit', 'port2=', 'port3=Emit from Curve.emit', 'port4=Emit from Null.emit', 'port5=Emit from Surface.emit', 'port6=SimulateParticlesNode.simulate'], 5]);
eq('EmitPointsFromObject: selection when InputObj is omitted', EM.bySelection, [null, [true, false, true], 'PointCloud']);

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-03b particle script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-03b particle script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   script steps wired for all 12; the native callees are modelled and logged as not yet attested (Q1/Q3): particle types, SparksOp / HyperFlowOp / BlowUpOp / BlasterOp, SIAddParticleEvent / Goal / Force, the ICE emission compounds');
