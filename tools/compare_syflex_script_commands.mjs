// CMD-B7b: the 47 Syflex add-on commands on the command bus (46 script commands of cloth.vbs, force.vbs, collid.vbs,
// constr.vbs, getset.vbs, cache.vbs, state.vbs and the C++ command SyCmdSaveCache).
// Checked against the "Wire contract" of docs/ghidra/cmd-b7b-syflex-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row and the `sy*` operators are not in the install
// (row CMD-B7b-OPS), so this is a contract check on stand-in operators: registration with the registry's argument
// list, a run with default arguments, and the contract's stated results (operator lookup, port connections,
// clusters, weight maps, parameters, selection, messages, return values).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_syflex_script_commands.mjs
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

// scripting name -> [display name, handler] (note: "Plugin files and what they register" + "Index rows")
const ENTRIES = {
  SyCreateCloth: ['Create Cloth', 'CreateCloth_Execute'], SyCreateSkin: ['Create Skin', 'CreateSkin_Execute'], SyCreateFlesh: ['Create Flesh', 'CreateFlesh_Execute'],
  SyGetSpringMap: ['Get Spring Map', 'GetSpringMap_Execute'], SySetSpringMap: ['Set Spring Map', 'SetSpringMap_Execute'],
  SyGetMassMap: ['Get Mass Map', 'GetMassMap_Execute'], SySetMassMap: ['Set Mass Map', 'SetMassMap_Execute'],
  SyClearAllCache: ['Clear All Cache', 'ClearAllCache_Execute'], SyClearCache: ['Clear Cache', 'ClearCache_Execute'], sySaveCache: ['Save Cache', 'SaveCache_Execute'],
  SyCreateGravity: ['Add Gravity', 'AddGravity_Execute'], SyCreateDamp: ['Add Damp', 'AddDamp_Execute'], SyCreateAir: ['Add Air', 'AddAir_Execute'],
  SyCreateWind: ['Add Wind', 'AddWind_Execute'], SyCreateTurbulence: ['Add Turbulence', 'AddTurbulence_Execute'], SyCreateVolume: ['Add Volume', 'AddVolume_Execute'],
  SyCreateSpring: ['Create Spring', 'CreateSpring_Execute'], SyCreateZipper: ['Create Zipper', 'CreateZipper_Execute'],
  SyCreateCollideMesh: ['Collide Mesh', 'CollideMesh_Execute'], SyCreateSelfCollide: ['Self Collide', 'SelfCollide_Execute'], SyCollideGetMesh: ['Get Collide Mesh', 'GetCollideMesh_Execute'],
  SyCreateCollideSph: ['Collide Sph', 'CollideSph_Execute'], SyCreateCollidePla: ['Collide Pla', 'CollidePla_Execute'],
  SyCreateNail: ['Create Nail', 'CreateNail_Execute'], SyCreatePin: ['Create Pin', 'CreatePin_Execute'], SyCreateMimic: ['Create Mimic', 'CreateMimic_Execute'],
  SySetConstraintMap: ['Set Constraint Map', 'SetConstraintMap_Execute'],
  SyGetNail: ['Get Nail', 'GetNail_Execute'], SySetNail: ['Set Nail', 'SetNail_Execute'], SyGetPin: ['Get Pin', 'GetPin_Execute'], SySetPin: ['Set Pin', 'SetPin_Execute'],
  SyGetMimic: ['Get Mimic', 'GetMimic_Execute'], SySetMimic: ['Set Mimic', 'SetMimic_Execute'],
  SyGetCollidePnts: ['Get Cloth Points', 'GetClothPoints_Execute'], SySetCollidePnts: ['Set Cloth Points', 'SetClothPoints_Execute'],
  SyGetCollidePols: ['Get Collide Polys', 'GetCollidePolys_Execute'], SySetCollidePols: ['Set Collide Polys', 'SetCollidePolys_Execute'],
  SyGetSelfCollidePols: ['Get Self Polys', 'GetSelfPolys_Execute'], SySetSelfCollidePols: ['Set Self Polys', 'SetSelfPolys_Execute'], SyPinGetMesh: ['Get Pin Mesh', 'GetPinMesh_Execute'],
  syCreateCache: ['Create Cache', 'CreateCache_Execute'], syCachePaint1: ['Paint Map1', 'PaintMap1_Execute'], syCachePaint2: ['Paint Map2', 'PaintMap2_Execute'],
  syClearState: ['Reset State', 'ResetState_Execute'], sySetState: ['Set State', 'SetState_Execute'], syClearVelocityState: ['Reset Velocities', 'ResetVelocities_Execute'],
  SyCmdSaveCache: ['Cmd Save Cache', ''],
};
const NAMES = Object.keys(ENTRIES);

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = list.find(x => x.scripting_name === n && x.name === ENTRIES[n][0] && (x.handler ?? '') === ENTRIES[n][1]);
  return [n, c ? { args: c.args.map(a => [a.name, a.default ?? null]), label: c.name, category: c.category ?? '' } : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SyCmdSaveCache') && !!window.Application?.syflexScripts, null, { timeout: 120000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const app = window.Application; const S = app.syflexScripts; const out = {};
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.type}` : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { return { v: ser(app.run(n, a)) }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const mark = () => app.log.length;
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const infoFrom = (i) => logFrom(i, ['info']);
  const clear = () => { app.setSelMode('object'); app.compSel = null; app.select([]); };
  const grid = (name) => { const o = app.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: name }); clear(); return o; };
  const nullNew = (name) => { const o = app.run('GetPrim', { PresetObj: 'Null', Name: name }) ?? app.scene.find(name); clear(); return o; };
  const pick = (...nodes) => { clear(); app.select(nodes); };
  const tag = (o, kind, idx) => { clear(); app.setSelMode(kind); app.selectComponents(o, kind, idx); };
  const sel = () => app.selection.map(n => n.name);
  const comps = () => { const c = app.compSel; return c ? [c.obj.name, c.kind, [...(c.kind === 'point' ? c.points : c.polygons)].sort((a, b) => a - b)] : null; };
  const ops = (o) => o.primitive.operators.map(x => x.name);
  const op = (o, name) => o.primitive.operators.find(x => x.name === name);
  const ports = (x) => x.ports.map(p => [p.name, p.target ? `${p.target.type}:${p.target.name}` : null]);
  const cls = (o) => o.clusters.map(c => [c.name, c.compKind, c.elements.size, c.properties.map(p => `${p.name}=${p.val('weight')}`)]);
  const keys = (x, n) => (app.anim.fcurve(x.get(n))?.keys ?? []).map(k => [k.time, k.value]);
  const pos = (o, i) => { const m = o.primitive.mesh(); return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]; };
  const nPts = (o) => o.primitive.mesh().positions.length / 3, nPol = (o) => o.primitive.mesh().polygons.length;
  const cloth = (name) => { const o = grid(name); pick(o); app.run('SyCreateCloth'); clear(); return o; };
  app.autoInspect = false; app.immediate = false; app.Interactive = false;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? { args: d.args.map(a => [a.name, a.default ?? null]), label: d.label ?? null, category: d.category ?? '' } : null]; }));
  out.state = [S.registered.length, S.replaced, S.note];

  // ---- every command with default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) { clear(); const m = mark(); const before = [...app.scene.allObjects()].length; const r = run(n); out.defaults[n] = { r, log: infoFrom(m), made: [...app.scene.allObjects()].length - before }; }
  clear();

  // ================= SyCreateCloth
  {
    const d = {}; app.anim.startFrame = 3; const o = grid('clothA'); pick(o); const undoBefore = app.undoStack.length; const m0 = mark();
    const r = run('SyCreateCloth'); const c = op(o, 'syCloth');
    d.result = [r, sel(), ops(o).slice(-2), cls(o), ports(c), ports(op(o, 'syProperties')), c.type, c.val('FirstFrame'), keys(c, 'Update'), c.val('ClothType')];
    const before = Array.from(o.primitive.operators[0].apply(null).positions); o.primitive.dirty = true; const after = Array.from(o.primitive.geom().positions);
    d.evaluation = [JSON.stringify(before) === JSON.stringify(after), infoFrom(m0).filter(t => /^info:syCloth: not yet attested: the evaluation of the syCloth operator "syCloth"/.test(t)).length, infoFrom(m0).filter(t => /^info:syProperties: not yet attested/.test(t)).length, S.evaluations > 0];
    app.undo(); d.undo = [app.undoStack.length === undoBefore, ops(o).length, cls(o).length];
    // a tagged component of the mesh resolves to the mesh
    tag(o, 'point', [0]); run('SyCreateCloth'); d.fromComponents = [sel(), comps(), cls(o).map(x => x[0])];
    // a second cluster of that name on the same object gets a suffix
    const n = nullNew('clothNull'); pick(n); const m2 = mark(); const r2 = run('SyCreateCloth'); d.notMesh = [r2, infoFrom(m2), sel()];
    out.cloth = d;
  }
  // ================= SyCreateFlesh / SyCreateSkin
  {
    const d = {}; const o = grid('fleshA'); pick(o); const r = run('SyCreateFlesh'); const c = op(o, 'syCloth');
    d.flesh = [r, sel(), ops(o).slice(-3), cls(o), ports(c), ports(op(o, 'syPropertiesFlesh')), c.val('ClothType'), c.val('FirstFrame'), keys(c, 'Update')];
    const n = nullNew('fleshNull'); pick(n); const m = mark(); d.fleshNotMesh = [run('SyCreateFlesh'), infoFrom(m)];
    const a = grid('skinA'), b = grid('skinB'); pick(a, b); const count = [...app.scene.allObjects()].length; const m2 = mark();
    const rs = run('SyCreateSkin'); const c2 = app.selection[0]; const merged = c2 && c2.parent ? c2.parent.parent : null;
    d.skin = [rs, sel(), [a.visible, b.visible], [...app.scene.allObjects()].length - count, merged ? merged.type : null, merged && merged !== a && merged !== b];
    if (merged && merged.primitive) {
      d.skinOps = [ops(merged).slice(-3), cls(merged), ports(c2).map(p => p[1] === `polymsh:${merged.name}` ? ['', 'polymsh:<merged>'] : p), op(merged, 'syPropertiesSkin').val('NbLevels'), c2.val('ClothType'), c2.val('FirstFrame'), keys(c2, 'Update')];
      d.skinTolerance = [merged.primitive.operators[0].get('tolerance') ? merged.primitive.operators[0].val('tolerance') : 'no parameter', infoFrom(m2).filter(t => /tolerance/.test(t)).length];
    }
    out.variants = d;
  }
  // ================= cloth flags and maps, sySaveCache, SyCmdSaveCache
  {
    const d = {}; const o = cloth('flagA'); const c = op(o, 'syCloth'); const plain = grid('flagPlain');
    const flag = (n, p) => { pick(o); const r = run(n); return [r, sel(), c.val(p)]; };
    d.spring = flag('SySetSpringMap', 'ModifSpringMap'); d.mass = flag('SySetMassMap', 'ModifMassMap');
    d.clear = flag('SyClearCache', 'ClearCache'); d.clearAll = flag('SyClearAllCache', 'ClearCache');
    pick(c); c.set('ClearCache', 0); run('SyClearCache'); d.fromOperator = [sel(), c.val('ClearCache')];
    pick(o); d.getSpring = [run('SyGetSpringMap'), sel(), app.selection[0]?.type]; pick(o); d.getMass = [run('SyGetMassMap'), sel()];
    d.plain = ['SySetSpringMap', 'SySetMassMap', 'SyClearCache', 'SyClearAllCache', 'SyGetSpringMap', 'SyGetMassMap'].map(n => { pick(plain); const m = mark(); const r = run(n); return [r, infoFrom(m), sel()]; });
    c.set('Cache', 'C:/cache/c_'); app.anim.frame = 7; pick(o); let m = mark(); const r = run('sySaveCache');
    d.save = [r, sel(), S.lastSaveCache, nPts(o), infoFrom(m).filter(t => /^info:SyCmdSaveCache: not yet attested/.test(t)).length];
    pick(plain); m = mark(); const e = run('sySaveCache'); d.saveNoCloth = [e.err ?? null, sel()];
    clear(); m = mark(); d.cmd = [run('SyCmdSaveCache', { arg0: 'x', arg1: [[0, 1], [0, 0], [0, 0]] }), S.lastSaveCache, infoFrom(m).length];
    app.anim.frame = 1;
    out.flags = d;
  }
  // ================= forces
  {
    const d = {}; const o = cloth('forceA'); const c = op(o, 'syCloth');
    d.each = [['SyCreateGravity', 'syGravity'], ['SyCreateDamp', 'syDamp'], ['SyCreateAir', 'syAir'], ['SyCreateWind', 'syWind'], ['SyCreateTurbulence', 'syTurbulence'], ['SyCreateVolume', 'syVolume']].map(([n, t]) => {
      pick(o); const r = run(n); const x = app.selection[0]; return [r, sel(), x?.type, x?.ports ? ports(x) : null, ops(o).includes(t)];
    });
    pick(c); run('SyCreateGravity'); d.second = [sel(), ops(o).filter(x => /^syGravity/.test(x))];
    // the lookup goes by name: an operator of another type named syCloth... takes the undefined-id branch
    const fake = grid('forceFake'); pick(fake); app.run('ApplyOp', { PresetObj: 'Twist' }); const tw = fake.primitive.operators[fake.primitive.operators.length - 1]; tw.name = 'syClothTwist';
    pick(fake); let m = mark(); const n0 = ops(fake).length; const r = run('SyCreateGravity'); d.fake = [r, infoFrom(m), ops(fake).length - n0, sel()];
    pick(fake); m = mark(); d.fakeState = [run('sySetState'), infoFrom(m)];
    pick(fake); m = mark(); d.fakeSelf = [run('SyCreateSelfCollide'), infoFrom(m), ops(fake).length - n0];
    // spring
    tag(o, 'point', [1, 0]); let rs = run('SyCreateSpring'); let x = app.selection[0]; const a = pos(o, 0), b = pos(o, 1);
    d.spring = [rs, sel(), x?.type, x?.ports ? ports(x) : null, r4(x?.val('Length')), r4(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])), x?.val('Point1'), x?.val('Point2')];
    tag(o, 'point', [0, 1, 2]); m = mark(); d.springThree = [run('SyCreateSpring'), infoFrom(m)];
    pick(o); m = mark(); d.springObject = [run('SyCreateSpring'), infoFrom(m)];
    const plain = grid('forcePlain'); tag(plain, 'point', [0, 1]); m = mark(); rs = run('SyCreateSpring'); d.springNoCloth = [/script error/.test(rs.err ?? ''), infoFrom(m), ops(plain).length];
    // zipper
    tag(o, 'point', [5, 0, 2]); rs = run('SyCreateZipper'); x = app.selection[0];
    d.zipper = [rs, sel(), x?.type, x?.val('Points'), x?.val('Reset')];
    pick(o); m = mark(); d.zipperObject = [run('SyCreateZipper'), infoFrom(m)];
    out.forces = d;
  }
  // ================= collisions
  {
    const d = {}; const o = cloth('colCloth'); const col = grid('colMesh'); const c = op(o, 'syCloth');
    pick(col, o); let r = run('SyCreateCollideMesh'); let x = app.selection[0];
    d.mesh = [r, sel(), x?.type, x?.ports ? ports(x) : null, cls(o).map(k => k.slice(0, 3)), cls(col).map(k => k.slice(0, 3)), [nPts(o), nPol(col)]];
    pick(o); let m = mark(); d.meshOne = [run('SyCreateCollideMesh'), infoFrom(m)];
    const p1 = grid('colPlain1'), p2 = grid('colPlain2'); pick(p1, p2); m = mark(); d.meshNoCloth = [run('SyCreateCollideMesh'), infoFrom(m), cls(p1).length + cls(p2).length];
    pick(x); d.getMesh = [run('SyCollideGetMesh'), sel()];
    pick(o); m = mark(); d.getMeshNot = [run('SyCollideGetMesh'), sel(), infoFrom(m)];
    // self collide
    pick(o); m = mark(); r = run('SyCreateSelfCollide'); x = app.selection[0];
    d.self = [r, sel(), x?.type, x?.ports ? ports(x) : null, x?.val('Reset'), o.clusters.find(k => k.name === 'sySelfCollideCls')?.elements.size === nPol(o), o.primitive.operators.filter(k => k.val('mute')).length];
    pick(p1); m = mark(); d.selfNoCloth = [run('SyCreateSelfCollide'), infoFrom(m)];
    // plane / sphere
    const shape = (n) => {
      pick(o); const r = run(n); const x = app.selection[0]; const nul = o.children.find(k => k.name === `${x?.name}Pos`);
      return [r, sel(), x?.type, x?.ports ? ports(x) : null, nul?.type, nul?.val('primary_icon'), nul?.val('size') === 10];
    };
    d.pla = shape('SyCreateCollidePla'); d.sph = shape('SyCreateCollideSph');
    pick(o, col); m = mark(); const kids = o.children.length; d.shapeTwo = [run('SyCreateCollidePla'), run('SyCreateCollideSph'), infoFrom(m), o.children.length - kids];
    pick(p1); m = mark(); const e = run('SyCreateCollidePla'); d.shapeNoCloth = [/script error/.test(e.err ?? ''), p1.children.map(k => [k.type, k.val('primary_icon'), k.val('size')])];
    out.collide = d;
  }
  // ================= constraints
  {
    const d = {}; const o = cloth('cnsCloth'); const tgt = grid('cnsTarget');
    tag(o, 'point', [0, 1]); let r = run('SyCreateNail'); let x = app.selection[0]; const nail = x;
    const a = pos(o, 0), b = pos(o, 1); const nul = o.children.find(k => k.name === 'syNailPos');
    d.nail = [r, sel(), x?.type, x?.ports ? ports(x) : null, x?.val('Reset'), cls(o).filter(k => k[0] === 'syNailCls'), nul ? ['posx', 'posy', 'posz'].map(n => r4(nul.kinematics.local.val(n))) : null, [0, 1, 2].map(k => r4((a[k] + b[k]) / 2))];
    pick(o); let m = mark(); d.nailObject = [run('SyCreateNail'), infoFrom(m)];
    const plain = grid('cnsPlain'); tag(plain, 'point', [2, 3]); const e = run('SyCreateNail'); d.nailNoCloth = [/script error/.test(e.err ?? ''), cls(plain).map(k => k.slice(0, 3)), plain.children.map(k => k.type)];
    pick(nail); d.setMap = [run('SySetConstraintMap'), nail.val('ModifMap'), sel()];
    pick(o); d.setMapNot = /script error/.test(run('SySetConstraintMap').err ?? '');
    // pin: tagged points first, mesh second
    tag(o, 'point', [4, 5]); app.select([tgt], 'add'); r = run('SyCreatePin'); x = app.selection[0]; const pin = x;
    d.pin = [r, sel(), x?.type, x?.ports ? ports(x) : null, x?.val('Reset'), cls(o).filter(k => k[0] === 'syPinCls')];
    // mimic: mesh first, tagged points second
    tag(o, 'point', [6]); app.select([tgt, o]); r = run('SyCreateMimic'); x = app.selection[0];
    d.mimic = [r, sel(), x?.type, x?.ports ? ports(x) : null, x?.val('Reset'), cls(o).filter(k => k[0] === 'syMimicCls')];
    // an existing point cluster: accepted mesh first / cluster second only
    tag(o, 'point', [7, 8]); const made = app.run('CreateCluster', { Name: 'MyPoints' }); const cl = o.clusters.find(k => k.name === 'MyPoints') ?? made;
    pick(cl, tgt); m = mark(); const n0 = ops(o).length; d.pinClusterFirst = [run('SyCreatePin'), infoFrom(m), ops(o).length - n0, cl.name];
    pick(tgt, cl); r = run('SyCreatePin'); x = app.selection[0];
    d.pinClusterSecond = [r, sel(), x?.ports ? ports(x)[3] : null, cl.name, cl.elements.size];
    pick(o); m = mark(); d.pinOne = [run('SyCreatePin'), run('SyCreateMimic'), infoFrom(m)];
    pick(o, nullNew('cnsNull')); m = mark(); d.pinNoMesh = [run('SyCreatePin'), infoFrom(m)];
    pick(tgt, o); m = mark(); d.pinTwoMeshes = [run('SyCreateMimic'), infoFrom(m)];
    pick(pin); d.pinGetMesh = [run('SyPinGetMesh'), sel()];
    pick(nail); m = mark(); d.pinGetMeshNot = [run('SyPinGetMesh'), sel(), infoFrom(m)];
    out.constraints = d;
  }
  // ================= get / set of operator clusters
  {
    const d = {}; const o = cloth('gsCloth'); const col = grid('gsCollider'); const tgt = grid('gsTarget');
    tag(o, 'point', [0, 1]); run('SyCreateNail'); const nail = app.selection[0];
    tag(o, 'point', [2, 3]); app.select([tgt], 'add'); run('SyCreatePin'); const pin = app.selection[0];
    tag(o, 'point', [4, 5]); app.select([tgt], 'add'); run('SyCreateMimic'); const mimic = app.selection[0];
    pick(o, col); run('SyCreateCollideMesh'); const collide = app.selection[0];
    pick(o); run('SyCreateSelfCollide'); const self = app.selection[0];
    const FAM = [['Nail', nail, 'Cluster', 'point', o], ['Pin', pin, 'Points', 'point', o], ['Mimic', mimic, 'Points', 'point', o], ['CollidePnts', collide, 'CloPnts', 'point', o], ['CollidePols', collide, 'ColPols', 'polygon', col], ['SelfCollidePols', self, 'Faces', 'polygon', o]];
    d.families = FAM.map(([n, x, port, kind, owner]) => {
      const c = x.ports.find(p => p.name === port).target; const before = [...c.elements].sort((a, b) => a - b); const name = c.name;
      pick(x); const rg = run(`SyGet${n}`); const g = [rg, sel(), comps()?.[0], comps()?.[1], JSON.stringify(comps()?.[2]) === JSON.stringify(before), app.selMode];
      x.set('Reset', 0); app.selectComponents(owner, kind, [1, 2, 3]); app.select([x], 'add');
      const rs = run(`SySet${n}`);
      const s = [rs, sel(), [...c.elements].sort((a, b) => a - b), c.name === name, x.ports.find(p => p.name === port).target === c, x.val('Reset'), app.selMode, app.compSel === null];
      pick(owner); let m = mark(); const g2 = [run(`SyGet${n}`), infoFrom(m)];
      pick(x); m = mark(); const s2 = [run(`SySet${n}`), infoFrom(m)];
      tag(owner, kind === 'point' ? 'polygon' : 'point', [0]); app.select([x], 'add'); m = mark(); const s3 = [run(`SySet${n}`), infoFrom(m), [...c.elements].length];
      return { n, g, s, g2, s2, s3 };
    });
    out.getset = d;
  }
  // ================= cache operator
  {
    const d = {}; const o = grid('cacheA'); pick(o); const r = run('syCreateCache'); const x = app.selection[0];
    d.create = [r, sel(), x?.type, x?.ports ? ports(x) : null, cls(o), keys(x, 'Update')];
    pick(o); d.paint1 = [run('syCachePaint1'), sel(), app.selection[0]?.type, app.activeTool === null]; pick(x); d.paint2 = [run('syCachePaint2'), sel()];
    const plain = grid('cachePlain'); pick(plain); let m = mark(); d.paintPlain = [run('syCachePaint1'), run('syCachePaint2'), infoFrom(m)];
    pick(nullNew('cacheNull')); m = mark(); d.notMesh = [run('syCreateCache'), infoFrom(m)];
    out.cache = d;
  }
  // ================= simulation state
  {
    const d = {}; const o = cloth('stateA'); const c = op(o, 'syCloth');
    d.values = [['sySetState', 1], ['syClearState', -1], ['syClearVelocityState', -2]].map(([n]) => { pick(o); const r = run(n); return [r, sel(), c.val('SaveState')]; });
    const plain = grid('statePlain');
    d.plain = ['sySetState', 'syClearState', 'syClearVelocityState'].map(n => { pick(plain); const m = mark(); return [run(n), infoFrom(m)]; });
    out.state2 = d;
  }
  clear();
  out.leftover = [app.activeTool === null, document.querySelectorAll('.si-msgbox-window').length];
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = { v: '<none>' };
const T = { 1000: 'Select 2 vertices of the cloth', 1002: 'Select a cloth', 1003: 'Select a polymesh', 1004: 'Select a syCache', 1006: 'Select cloth vertices', 1007: 'Select the cloth and the collider', 1009: 'Select vertices of the cloth', 1010: 'Select vertices of the cloth (or a point cluster) and a polymesh' };
const info = (id) => [`info:${T[id]}`];
const isUndefinedId = (l, cmd) => l.length === 1 && l[0].startsWith(`info:${cmd}: not yet attested: the message of the undefined id IDS_SELECT_SYCLOTH`);

// ---- registration
for (const n of NAMES) {
  ok(`${n}: in the registry dump`, !!registry[n], n);
  eq(`${n}: registered with the registry's argument list, display name and category`, got.reg[n], registry[n]);
}
eq('47 commands registered by this row; SyCreateCloth of the earlier batch replaced', got.state, [47, ['SyCreateCloth'], 'docs/ghidra/cmd-b7b-syflex-scripts.md']);

// ---- defaults, nothing selected
const D = got.defaults;
const GET = { SyGetNail: 'syNail', SyGetPin: 'syPin', SyGetMimic: 'syMimic', SyGetCollidePnts: 'syCollide', SyGetCollidePols: 'syCollide', SyGetSelfCollidePols: 'sySelfCollide' };
const SET = { SySetNail: 'syNail', SySetPin: 'syPin', SySetMimic: 'syMimic', SySetCollidePnts: 'syCollide', SySetCollidePols: 'syCollide', SySetSelfCollidePols: 'sySelfCollide' };
const MSG = {
  SyGetSpringMap: 1002, SySetSpringMap: 1002, SyGetMassMap: 1002, SySetMassMap: 1002, SyClearAllCache: 1002, SyClearCache: 1002,
  SyCreateGravity: 1002, SyCreateDamp: 1002, SyCreateAir: 1002, SyCreateWind: 1002, SyCreateTurbulence: 1002, SyCreateVolume: 1002,
  SyCreateSpring: 1000, SyCreateZipper: 1006, SyCreateCollideMesh: 1007, SyCreateSelfCollide: 1002, SyCreateNail: 1009, SyCreatePin: 1010, SyCreateMimic: 1010,
  syCachePaint1: 1004, syCachePaint2: 1004, syClearState: 1002, sySetState: 1002, syClearVelocityState: 1002,
};
// inferred: reading the first item of an empty selection where the script has no error handling is a script error
const SCRIPT_ERROR = ['SyCreateCloth', 'SyCreateFlesh', 'sySaveCache', 'SyCollideGetMesh', 'SyPinGetMesh', 'SySetConstraintMap', 'syCreateCache', ...Object.keys(GET)];
for (const n of NAMES) {
  const x = D[n];
  if (n in MSG) eq(`${n}: default arguments, nothing selected: message ${MSG[n]}, no result, nothing created`, [x.r, x.log, x.made], [NONE, info(MSG[n]), 0]);
  else if (n in SET) eq(`${n}: default arguments, nothing selected: message 1008 with the operator type`, [x.r, x.log, x.made], [NONE, [`info:Select the cloth points and the ${SET[n]}`], 0]);
  else if (SCRIPT_ERROR.includes(n)) ok(`${n}: default arguments, nothing selected: script error (empty selection), nothing created`, /script error/.test(x.r.err ?? '') && x.made === 0, x);
  else if (n === 'SyCreateSkin') ok('SyCreateSkin: default arguments, nothing selected: the merge fails (script error), nothing created', typeof x.r.err === 'string' && x.made === 0, x);
  else if (n === 'SyCreateCollidePla' || n === 'SyCreateCollideSph') ok(`${n}: default arguments, selection count not 1: undefined-id message logged as "not yet attested", nothing created`, x.r.v === '<none>' && isUndefinedId(x.log, n) && x.made === 0, x);
  else if (n === 'SyCmdSaveCache') ok('SyCmdSaveCache: default arguments: boolean result (inferred), "not yet attested" logged, nothing written', x.r.v === false && x.log.length === 1 && /^info:SyCmdSaveCache: not yet attested/.test(x.log[0]), x);
  else ok(`${n}: default run classified`, false, x);
}

// ---- SyCreateCloth
const cl = got.cloth;
eq('SyCreateCloth: ClothCls with MassMap / StiffMap (weight 1), syCloth(object, mass, stiff) + syProperties(cloth), cloth selected, FirstFrame = PlayControl.In, key on Update (1, 1)', cl.result,
  [NONE, ['syCloth'], ['syCloth', 'syProperties'], [['ClothCls', 'pnt', cl.result[3]?.[0]?.[2], ['MassMap=1', 'StiffMap=1']]], [['', 'polymsh:clothA'], ['', 'weightmap:MassMap'], ['', 'weightmap:StiffMap']], [['', 'syCloth:syCloth']], 'syCloth', 3, [[1, 1]], 0]);
ok('SyCreateCloth: the cluster holds all points', cl.result[3]?.[0]?.[2] > 0, cl.result[3]);
eq('stand-in operators: evaluation passes the generator geometry through and logs "not yet attested" once per operator', cl.evaluation, [true, 1, 1, true]);
eq('SyCreateCloth: one undo step removes operators and cluster', cl.undo, [true, 1, 0]);
eq('SyCreateCloth: tagged components resolve to their object', cl.fromComponents, [['syCloth'], null, ['ClothCls']]);
eq('SyCreateCloth: not a polymsh = message 1003, nothing created', cl.notMesh, [NONE, info(1003), ['clothNull']]);

// ---- flesh / skin
const va = got.variants;
eq('SyCreateFlesh: third map WrinkleMap (not connected), syProperties + syPropertiesFlesh, ClothType 2, FirstFrame not written', va.flesh,
  [NONE, ['syCloth'], ['syCloth', 'syProperties', 'syPropertiesFlesh'], [['ClothCls', 'pnt', va.flesh[3]?.[0]?.[2], ['MassMap=1', 'StiffMap=1', 'WrinkleMap=1']]], [['', 'polymsh:fleshA'], ['', 'weightmap:MassMap'], ['', 'weightmap:StiffMap']], [['', 'syCloth:syCloth']], 2, 1, [[1, 1]]]);
eq('SyCreateFlesh: not a polymsh = message 1003', va.fleshNotMesh, [NONE, info(1003)]);
eq('SyCreateSkin: sources hidden, one merged mesh, cloth operator selected', va.skin, [NONE, ['syCloth'], [false, false], 1, 'polymsh', true]);
eq('SyCreateSkin: syProperties + syPropertiesSkin, NbLevels = number of selected items, ClothType 1, FirstFrame not written', [va.skinOps?.[0], va.skinOps?.[1]?.[0]?.[0], va.skinOps?.[1]?.[0]?.[3], va.skinOps?.[2], va.skinOps?.[3], va.skinOps?.[4], va.skinOps?.[5], va.skinOps?.[6]],
  [['syCloth', 'syProperties', 'syPropertiesSkin'], 'ClothCls', ['MassMap=1', 'StiffMap=1'], [['', 'polymsh:<merged>'], ['', 'weightmap:MassMap'], ['', 'weightmap:StiffMap']], 2, 1, 1, [[1, 1]]]);
ok('SyCreateSkin: merge tolerance written as 0, or its absence logged as "not yet attested"', va.skinTolerance && (va.skinTolerance[0] === 0 || (va.skinTolerance[0] === 'no parameter' && va.skinTolerance[1] === 1)), va.skinTolerance);

// ---- flags, maps, save cache
const fl = got.flags;
eq('SySetSpringMap: cloth operator selected, ModifSpringMap = 1', fl.spring, [NONE, ['syCloth'], 1]);
eq('SySetMassMap: ModifMassMap = 1', fl.mass, [NONE, ['syCloth'], 1]);
eq('SyClearCache: ClearCache = 1', fl.clear, [NONE, ['syCloth'], 1]);
eq('SyClearAllCache: ClearCache = 2', fl.clearAll, [NONE, ['syCloth'], 2]);
eq('cloth flag commands work from the selected cloth operator (owning object)', fl.fromOperator, [['syCloth'], 1]);
eq('SyGetSpringMap: selects the StiffMap weight map', fl.getSpring, [NONE, ['StiffMap'], 'weightmap']);
eq('SyGetMassMap: selects the MassMap weight map', fl.getMass, [NONE, ['MassMap']]);
eq('cloth flag / map commands without a cloth: message 1002, selection stays on the object', fl.plain, Array(6).fill([NONE, info(1002), ['flagPlain']]));
eq('sySaveCache: Cache value and 3 x N positions handed to SyCmdSaveCache, cloth operator selected', fl.save, [NONE, ['syCloth'], { arg0: 'C:/cache/c_', points: fl.save[3], fileName: 'C:/cache/c_0007', written: false }, fl.save[3], 1]);
ok('sySaveCache: no cloth operator = script error', /script error/.test(fl.saveNoCloth[0] ?? ''), fl.saveNoCloth);
eq('SyCmdSaveCache(arg0, arg1): inferred file name arg0 + 4-digit frame, false, one "not yet attested" line', fl.cmd, [{ v: false }, { arg0: 'x', points: 2, fileName: 'x0007', written: false }, 1]);

// ---- forces
const fo = got.forces;
eq('SyCreateGravity / Damp / Air / Wind / Turbulence / Volume: preset applied on the cloth operator, new operator selected', fo.each,
  ['syGravity', 'syDamp', 'syAir', 'syWind', 'syTurbulence', 'syVolume'].map(t => [NONE, [t], t, [['', 'syCloth:syCloth']], true]));
eq('force from the selected cloth operator; a second operator gets a numbered name', fo.second, [['syGravity1'], ['syGravity', 'syGravity1']]);
ok('force: node named syCloth* of another type = undefined-id message ("not yet attested"), nothing applied, the node selected', fo.fake[0].v === '<none>' && isUndefinedId(fo.fake[1], 'SyCreateGravity') && fo.fake[2] === 0 && fo.fake[3][0] === 'syClothTwist', fo.fake);
ok('state: same type check', fo.fakeState[0].v === '<none>' && isUndefinedId(fo.fakeState[1], 'sySetState'), fo.fakeState);
ok('SyCreateSelfCollide: same type check', fo.fakeSelf[0].v === '<none>' && isUndefinedId(fo.fakeSelf[1], 'SyCreateSelfCollide') && fo.fakeSelf[2] === 0, fo.fakeSelf);
eq('SyCreateSpring: sySpring on the cloth, Length = distance of the two points, Point1 / Point2', fo.spring, [NONE, ['sySpring'], 'sySpring', [['', 'syCloth:syCloth']], fo.spring[5], fo.spring[5], 0, 1]);
ok('SyCreateSpring: the distance is not zero', fo.spring[5] > 0, fo.spring);
eq('SyCreateSpring: three points = message 1000', fo.springThree, [NONE, info(1000)]);
eq('SyCreateSpring: an object = message 1000', fo.springObject, [NONE, info(1000)]);
eq('SyCreateSpring: no cloth = message 1002, then the writes fail on the first selected item (script error)', fo.springNoCloth, [true, info(1002), 1]);
eq('SyCreateZipper: Points = indices each followed by a space, Reset 1', fo.zipper, [NONE, ['syZipper'], 'syZipper', '0 2 5 ', 1]);
eq('SyCreateZipper: an object = message 1006', fo.zipperObject, [NONE, info(1006)]);

// ---- collisions
const co = got.collide;
eq('SyCreateCollideMesh: syCollide(cloth op, point cluster, collider, collider kinematics, polygon cluster, cloth kinematics), either selection order', [co.mesh[0], co.mesh[1], co.mesh[2], co.mesh[3]],
  [NONE, ['syCollide'], 'syCollide', [['', 'syCloth:syCloth'], ['CloPnts', 'pnt:syCollidePnts'], ['', 'polymsh:colMesh'], ['', 'kine:Kinematics'], ['ColPols', 'poly:syCollidePols'], ['', 'kine:Kinematics']]]);
eq('SyCreateCollideMesh: clusters of all cloth points / all collider polygons renamed <operator>Pnts / <operator>Pols', [co.mesh[4].find(k => k[0] === 'syCollidePnts'), co.mesh[5]], [['syCollidePnts', 'pnt', co.mesh[6][0]], [['syCollidePols', 'poly', co.mesh[6][1]]]]);
eq('SyCreateCollideMesh: one item = message 1007', co.meshOne, [NONE, info(1007)]);
eq('SyCreateCollideMesh: no cloth on either = message 1007, nothing created', co.meshNoCloth, [NONE, info(1007), 0]);
eq('SyCollideGetMesh: operator and the target of input port 2 selected together', co.getMesh, [NONE, ['syCollide', 'colMesh']]);
eq('SyCollideGetMesh: not a syCollide = nothing, no message', co.getMeshNot, [NONE, ['colCloth'], []]);
eq('SyCreateSelfCollide: sySelfCollide(cloth op, object, polygon cluster), cluster <operator>Cls of all polygons, Reset 1, nothing left muted', co.self,
  [NONE, ['sySelfCollide'], 'sySelfCollide', [['', 'syCloth:syCloth'], ['', 'polymsh:colCloth'], ['Faces', 'poly:sySelfCollideCls']], 1, true, 0]);
eq('SyCreateSelfCollide: no cloth = message 1002', co.selfNoCloth, [NONE, info(1002)]);
eq('SyCreateCollidePla: null child <operator>Pos (primary_icon 6, size 10), syCollidePla(cloth op, null kinematics, cloth kinematics)', co.pla,
  [NONE, ['syCollidePla'], 'syCollidePla', [['', 'syCloth:syCloth'], ['', 'kine:Kinematics'], ['', 'kine:Kinematics']], 'null', 6, true]);
eq('SyCreateCollideSph: null child <operator>Pos (primary_icon 2, size not written), syCollideSph', co.sph,
  [NONE, ['syCollideSph'], 'syCollideSph', [['', 'syCloth:syCloth'], ['', 'kine:Kinematics'], ['', 'kine:Kinematics']], 'null', 2, false]);
ok('SyCreateCollidePla / Sph: two items = undefined-id message ("not yet attested"), no null', co.shapeTwo[0].v === '<none>' && co.shapeTwo[1].v === '<none>' && co.shapeTwo[2].length === 2 && isUndefinedId([co.shapeTwo[2][0]], 'SyCreateCollidePla') && isUndefinedId([co.shapeTwo[2][1]], 'SyCreateCollideSph') && co.shapeTwo[3] === 0, co.shapeTwo);
eq('SyCreateCollidePla: no cloth operator = script error, the null stays', co.shapeNoCloth, [true, [['null', 6, 10]]]);

// ---- constraints
const cn = got.constraints;
eq('SyCreateNail: syNail(cloth op, cluster, null kinematics, cloth kinematics, map), Reset 1, cluster <operator>Cls with map "Map", null <operator>Pos at the box centre', cn.nail,
  [NONE, ['syNail'], 'syNail', [['', 'syCloth:syCloth'], ['Cluster', 'pnt:syNailCls'], ['', 'kine:Kinematics'], ['', 'kine:Kinematics'], ['', 'weightmap:Map']], 1, [['syNailCls', 'pnt', 2, ['Map=1']]], cn.nail[7], cn.nail[7]]);
eq('SyCreateNail: an object = message 1009', cn.nailObject, [NONE, info(1009)]);
eq('SyCreateNail: no cloth operator = script error, cluster and null stay', cn.nailNoCloth, [true, [['Point', 'pnt', 2]], ['null']]);
eq('SySetConstraintMap: ModifMap = 1 on the first selected item, selection unchanged', cn.setMap, [NONE, 1, ['syNail']]);
eq('SySetConstraintMap: an item without that parameter = script error', cn.setMapNot, true);
const pinPorts = (t, c) => [['', 'syCloth:syCloth'], ['', 'polymsh:cnsTarget'], ['', 'kine:Kinematics'], ['Points', `pnt:${c}`], ['', 'kine:Kinematics'], ['', 'weightmap:Map']];
eq('SyCreatePin (points first, mesh second): syPin(cloth op, mesh, mesh kinematics, cluster, cloth kinematics, map), Reset 1, cluster <operator>Cls', cn.pin, [NONE, ['syPin'], 'syPin', pinPorts('syPin', 'syPinCls'), 1, [['syPinCls', 'pnt', 2, ['Map=1']]]]);
eq('SyCreateMimic (mesh first, points second): syMimic, same connections', cn.mimic, [NONE, ['syMimic'], 'syMimic', pinPorts('syMimic', 'syMimicCls'), 1, [['syMimicCls', 'pnt', 1, ['Map=1']]]]);
eq('SyCreatePin: existing cluster first, mesh second = message 1010, nothing applied', cn.pinClusterFirst, [NONE, info(1010), 0, 'MyPoints']);
eq('SyCreatePin: mesh first, existing cluster second = accepted, the cluster is renamed <operator>Cls and kept', cn.pinClusterSecond, [NONE, ['syPin1'], ['Points', 'pnt:syPin1Cls'], 'syPin1Cls', 2]);
eq('SyCreatePin / SyCreateMimic: one item = message 1010', cn.pinOne, [NONE, NONE, [...info(1010), ...info(1010)]]);
eq('SyCreatePin: no polymsh among the two = message 1010', cn.pinNoMesh.slice(0, 1).concat([cn.pinNoMesh[1]]), [NONE, info(1010)]);
eq('SyCreateMimic: two meshes = message 1010 (the second item is not a point cluster)', cn.pinTwoMeshes, [NONE, info(1010)]);
eq('SyPinGetMesh: operator and the target of input port 1 selected together', cn.pinGetMesh, [NONE, ['syPin', 'cnsTarget']]);
eq('SyPinGetMesh: not a syPin = nothing, no message', cn.pinGetMeshNot, [NONE, ['syNail'], []]);

// ---- get / set
const TYPE = { Nail: 'syNail', Pin: 'syPin', Mimic: 'syMimic', CollidePnts: 'syCollide', CollidePols: 'syCollide', SelfCollidePols: 'sySelfCollide' };
for (const f of got.getset.families) {
  const t = TYPE[f.n]; const poly = /Pols$/.test(f.n); const owner = f.n === 'CollidePols' ? 'gsCollider' : 'gsCloth';
  eq(`SyGet${f.n}: cluster elements of the port selected as components, filter ${poly ? 'Polygon' : 'Point'}, operator added`, [f.g[0], f.g[1].length, f.g[1][0], f.g[1][1], f.g[2], f.g[3], f.g[4], f.g[5]], [NONE, 2, owner, f.g[1][1], owner, poly ? 'polygon' : 'point', true, poly ? 'polygon' : 'point']);
  ok(`SyGet${f.n}: the operator is the second selected item`, f.g[1][1] && f.g[1][1].startsWith(t), f.g[1]);
  eq(`SySet${f.n}: membership replaced, same cluster and connection, Reset 1, object selection tool, operator selected`, [f.s[0], f.s[1].length, f.s[2], f.s[3], f.s[4], f.s[5], f.s[6], f.s[7]], [NONE, 1, [1, 2, 3], true, true, 1, 'object', true]);
  eq(`SyGet${f.n}: not a ${t} = message 1001 with the type name`, f.g2, [NONE, [`info:Select a ${t}`]]);
  eq(`SySet${f.n}: one item = message 1008 with the type name`, f.s2, [NONE, [`info:Select the cloth points and the ${t}`]]);
  eq(`SySet${f.n}: components of the wrong kind = message 1008, cluster untouched`, f.s3, [NONE, [`info:Select the cloth points and the ${t}`], 3]);
}

// ---- cache
const ca = got.cache;
eq('syCreateCache: point cluster keeps its default name, Map1 / Map2 (weight 1), syCache(object, Map1, Map2), key on Update (1, 1)', ca.create,
  [NONE, ['syCache'], 'syCache', [['', 'polymsh:cacheA'], ['', 'weightmap:Map1'], ['', 'weightmap:Map2']], [['Point', 'pnt', ca.create[4]?.[0]?.[2], ['Map1=1', 'Map2=1']]], [[1, 1]]]);
eq('syCachePaint1: selects Map1, no paint tool', ca.paint1, [NONE, ['Map1'], 'weightmap', true]);
eq('syCachePaint2: selects Map2 (from the selected operator)', ca.paint2, [NONE, ['Map2']]);
eq('syCachePaint1 / 2: no such map = message 1004', ca.paintPlain, [NONE, NONE, [...info(1004), ...info(1004)]]);
eq('syCreateCache: not a polymsh = message 1003', ca.notMesh, [NONE, info(1003)]);

// ---- state
const st = got.state2;
eq('sySetState / syClearState / syClearVelocityState: SaveState 1 / -1 / -2, cloth operator selected', st.values, [[NONE, ['syCloth'], 1], [NONE, ['syCloth'], -1], [NONE, ['syCloth'], -2]]);
eq('state commands without a cloth: message 1002', st.plain, Array(3).fill([NONE, info(1002)]));

eq('no tool or message box left open', got.leftover, [true, 0]);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B7b Syflex script commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B7b Syflex script commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; stand-in operators, no XSIBATCH golden yet)`);
console.log('   script level wired on stand-in operators: the 44 SPEC commands');
console.log('   partly wired: SyCreateCollidePla, SyCreateCollideSph (success path; the undefined-id message logs "not yet attested", Q1), SyCmdSaveCache (arguments and inferred file name only, nothing written, Q3)');
console.log('   not attested: every sy* operator evaluation (row CMD-B7b-OPS)');
