// CMD-B8e: the primitive getters, instancing and misc task commands of primtasks.dll on the command bus
// (src/commands/primTasksPrims.ts). Checked against the "Shared facts" and "Wire contract" sections of
// docs/ghidra/cmd-b8e-primtasks-prims-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check: registration with the registry argument list,
// a run with default arguments, and the stated results (output arguments, created objects, status codes, log lines
// for the parts the note leaves open). SIAssignMaterial is not implemented by primtasks.dll (contract unread): its
// earlier inferred registration is only checked for presence and its registry argument list.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_primtasks_prim_commands.mjs
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

const NAMES = ['SIGetRigidCns', 'SIAssembleNurbsMesh', 'SIGetPrimLight', 'SIGetPrimCamera', 'SIGetPrimSpotLight', 'SIGetPrimLattice', 'SIGetPrimVolumeDeform',
  'SIInstantiate', 'GetMaster', 'GetInstances', 'GetURLAt', 'ImportEPS', 'GetNbTriangles', 'SIAssignMaterial'];
// Registry argument list of a name, without the return value (flag 0x200): [name, default].
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('GetNbTriangles') && !!window.Application?.primTasksPrims && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const A = window.Application; const S = A.primTasksPrims; const fsx = A.hostFs; A.autoInspect = false;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const mark = () => A.log.length;
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`);
  const run = (n, a = {}) => {
    S.lastStatus = null; const m = mark();
    try { const v = A.run(n, a); return { v, st: S.lastStatus?.command === n ? hex(S.lastStatus.status) : null, log: logFrom(m) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status), log: logFrom(m) }; }
  };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const tick = () => new Promise(r => setTimeout(r, 40));
  const r3 = (x) => Math.round(x * 1e3) / 1e3;
  const cube = (name) => { const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name }); A.select([]); return o; };
  const nul = (name) => { const o = A.run('GetPrim', { PresetObj: 'Null', Name: name }); A.select([]); return o; };
  const names = (xs) => [...(xs ?? [])].map(x => x?.name ?? null);
  const keys = (v) => v && typeof v === 'object' ? Object.keys(v).filter(k => !/^\d+$/.test(k)) : null;
  const inScene = (o) => [...A.scene.allObjects()].includes(o);
  const gpos = (o) => { const e = o.globalMatrix().elements; return [r3(e[12]), r3(e[13]), r3(e[14])]; };
  const sub = (o, kind, els) => ({ kind: 'subcomponent', obj: o, compKind: kind, elements: els });
  const count = () => [...A.scene.allObjects()].length;
  const dircns = (o) => o.properties.filter(p => p.type === 'dircns');

  // ---- registration
  out.registered = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  // ---- default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) { A.select([]); const n0 = count(); const r = run(n); out.defaults[n] = { err: !!r.err, status: r.status ?? null, st: r.st, v: r.v === undefined ? '<unset>' : typeof r.v === 'object' && r.v !== null ? keys(r.v) : r.v, made: count() - n0 }; }

  // ---- SIGetRigidCns
  {
    const r = {}; const par = nul('rcParent');
    const a = run('SIGetRigidCns', { PresetObj: 'Hinge', Name: 'myHinge' }); const o = a.v?.Value;
    r.named = [a.err ?? null, keys(a.v), a.st, o?.name, a.v?.Primitive === o?.primitive, a.v?.Primitive?.name, o?.parentObj === A.scene.root, a.v?.[0] === o, a.v?.[1] === a.v?.Primitive, nya(a)];
    A.undo(); r.undo = inScene(o);
    const b = run('SIGetRigidCns', { PresetObj: 'Hinge.Preset', FileName: 'hingeFile', Parent: par }); const ob = b.v?.Value;
    r.file = [ob?.name, ob?.parentObj === par, b.v?.Primitive?.spdlFile, fsx.isFolder(S.factoryPath + '\\Application\\spdl'), nya(b)];
    const c = run('SIGetRigidCns', { PresetObj: 'Hinge', FileName: 'f2', Name: 'nameWins' }); r.nameWins = c.v?.Value?.name;
    const n0 = count(); const d = run('SIGetRigidCns', { PresetObj: 'Hinge', Name: 'loose', AddToScene: false }); r.notAdded = [d.err ?? null, d.v?.Value?.name, count() - n0, d.v?.Value?.parentObj ?? null, S.transient.includes(d.v?.Value)];
    out.rc = r;
  }

  // ---- SIAssembleNurbsMesh
  {
    const r = {}; const isSurf = (o) => (o?.primitive?.type ?? o?.type) === 'surfmsh';
    let a1 = null, a2 = null; try { a1 = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'asmA' }); a2 = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'asmB' }); } catch { /* no surfaces */ }
    r.haveSurfaces = isSurf(a1) && isSurf(a2);
    const c = cube('asmCube'); A.select([c]);
    if (r.haveSurfaces) {
      const n0 = count(); const a = run('SIAssembleNurbsMesh', { InputObj: [a1, a2, c], Tolerance: 0.3 }); const o = a.v?.OutputObj;
      r.made = [a.err ?? null, keys(a.v), a.st, isSurf(o), count() - n0, a.v?.[0] === o, names(A.selection), nya(a)];
      A.undo(); r.undo = [inScene(o), count() - n0];
    }
    const n1 = count(); const b = run('SIAssembleNurbsMesh', { InputObj: [c] }); r.noSurface = [b.err ?? null, b.v?.OutputObj, b.v?.length, count() - n1, nya(b)];
    out.asm = r;
  }

  // ---- SIGetPrimLight
  {
    const r = {}; const par = nul('lightParent'); A.run('Translate', { InputObj: [par], X: 5, Y: 0, Z: 0 }); A.select([]);
    const a = run('SIGetPrimLight', { PresetObj: 'Point', Name: 'fill' }); const l = a.v?.['3DObject'];
    r.point = [a.err ?? null, keys(a.v), a.st, l?.name, l?.type, l?.parentObj === A.scene.root, a.v?.PrimObj === l?.primitive, a.v?.['3DObjSpotInterest'], a.v?.PrimObjSpotInterest, names(A.selection)];
    const b = run('SIGetPrimLight', { PresetObj: 'Spot.Preset', Name: 'key', Parent: 'lightParent' }); const s = b.v?.['3DObject'], si = b.v?.['3DObjSpotInterest'];
    r.spot = [b.err ?? null, s?.name, Number(s?.primitive?.val('Type')), s?.parentObj === par, si?.name, si?.parentObj === par, si?.type, b.v?.PrimObjSpotInterest === si?.primitive, !!si?.primitive,
      dircns(s).length, dircns(s)[0]?.targets[0] === si, dircns(s)[0]?.direction, gpos(s), gpos(si)];
    A.undo(); r.spotUndo = [inScene(s), inScene(si)];
    const c = run('SIGetPrimLight', { PresetObj: 'Spot' }); r.spotNoName = [c.v?.['3DObjSpotInterest']?.name, gpos(c.v?.['3DObject'])];
    const d = run('SIGetPrimLight', { PresetObj: 'Point', Parent: 'noSuchParent' }); r.badParent = [!!d.err, d.status ?? null];
    out.light = r;
  }

  // ---- SIGetPrimCamera / SIGetPrimSpotLight
  {
    const r = {}; const par = nul('camParent'); A.run('Translate', { InputObj: [par], X: 0, Y: 4, Z: 0 }); A.select([]);
    A.prefValues = { ...(A.prefValues ?? {}), 'output_format.picture_ratio': 2 };
    const a = run('SIGetPrimCamera', { PresetObj: 'Camera', Name: 'shot', InterestName: 'aim' }); const c = a.v?.['3DObjCamera'], ci = a.v?.['3DObjCameraInterest'];
    r.camera = [a.err ?? null, keys(a.v), a.st, c?.name, c?.type, ci?.name, ci?.type, c?.parentObj === A.scene.root, ci?.parentObj === c?.parentObj, a.v?.PrimObjCamera === c?.primitive, a.v?.PrimObjCameraInterest === ci?.primitive, !!ci?.primitive,
      dircns(c).length, dircns(c)[0]?.targets[0] === ci, dircns(c)[0]?.direction, gpos(c), gpos(ci), c?.primitive?.lookat, names(A.selection)];
    r.ratio = c?.primitive?.get('aspect') ? Number(c.primitive.val('aspect')) : 'no aspect parameter'; r.cameraNya = nya(a) >= 1;
    A.undo(); r.cameraUndo = [inScene(c), inScene(ci)];
    const b = run('SIGetPrimCamera', { PresetObj: 'Camera', Parent: par }); const c2 = b.v?.['3DObjCamera'], ci2 = b.v?.['3DObjCameraInterest'];
    r.cameraParent = [c2?.parentObj === par, ci2?.parentObj === par, gpos(c2), gpos(ci2), !!ci2?.name];
    const s = run('SIGetPrimSpotLight', { PresetObj: 'Spot', Name: 'rim', InterestName: 'rimAim', Parent: 'camParent' }); const l = s.v?.['3DObjSpot'], li = s.v?.['3DObjSpotInterest'];
    r.spot = [s.err ?? null, keys(s.v), s.st, l?.name, l?.type, Number(l?.primitive?.val('Type')), li?.name, li?.type, l?.parentObj === par, li?.parentObj === par, s.v?.PrimObjSpot === l?.primitive, s.v?.PrimObjSpotInterest === li?.primitive,
      dircns(l).length, dircns(l)[0]?.targets[0] === li, gpos(l), gpos(li)];
    const t = run('SIGetPrimSpotLight', { PresetObj: 'Spot', Parent: 'noSuchParent' }); r.spotBadParent = [t.err ?? null, t.v?.['3DObjSpot']?.parentObj === A.scene.root];
    out.aim = r;
  }

  // ---- SIGetPrimLattice
  {
    const r = {}; const par = nul('latParent'); const c = cube('latCube'); A.run('Translate', { InputObj: [c], X: 3, Y: 0, Z: 0 }); A.select([]);
    const size = (() => { const m = c.primitive.mesh(); let mn = Infinity, mx = -Infinity; for (let i = 0; i < m.positions.length; i += 3) { mn = Math.min(mn, m.positions[i]); mx = Math.max(mx, m.positions[i]); } return r3(mx - mn); })();
    const a = run('SIGetPrimLattice', { PresetObj: 'Lattice', Name: 'freeLat', Parent: par }); const l = a.v?.Value;
    r.noInputs = [a.err ?? null, keys(a.v), a.st, l?.name, l?.type, a.v?.PrimObj === l?.primitive, l?.parentObj === A.scene.root, gpos(l), names(A.selection)];
    const ops0 = c.primitive.operators.length;
    const b = run('SIGetPrimLattice', { PresetObj: 'Lattice', InputObjs: [c], Parent: par }); const l2 = b.v?.Value; const g = l2?.primitive.operators[0]; const op = c.primitive.operators[c.primitive.operators.length - 1];
    r.inputs = [b.err ?? null, b.st, l2?.parentObj === par, gpos(l2), [r3(g?.val('sizex')), r3(g?.val('sizey')), r3(g?.val('sizez'))].every(v => v === size), c.primitive.operators.length - ops0, op?.preset, op?.refs?.[0] === l2];
    A.undo(); r.undo = [inScene(l2), c.primitive.operators.length - ops0];
    const nCl = c.clusters.length; const d = run('SIGetPrimLattice', { PresetObj: 'Lattice', InputObjs: [sub(c, 'pnt', [0, 1]), par] }); const op2 = c.primitive.operators[c.primitive.operators.length - 1];
    r.component = [d.err ?? null, d.st, c.clusters.length - nCl, op2?.sel?.kind, op2?.sel?.indices, d.log.filter(l => /0x2d/.test(l)).length, d.v?.Value?.parentObj === A.scene.root];
    out.lat = r;
  }

  // ---- SIGetPrimVolumeDeform
  {
    const r = {}; const par = nul('volParent'); const c = cube('volCube');
    const a = run('SIGetPrimVolumeDeform', { PresetObj: 'VolumeDeform', Name: 'vol', Parent: par }); const v = a.v?.Value;
    r.noInputs = [a.err ?? null, keys(a.v), a.st, v?.name, v?.parentObj === par, a.v?.PrimObj === v?.primitive, !!v?.primitive, nya(a)];
    const ops0 = c.primitive.operators.length;
    const b = run('SIGetPrimVolumeDeform', { PresetObj: 'VolumeDeform', InputObjs: [c, par] }); const v2 = b.v?.Value; const op = c.primitive.operators[c.primitive.operators.length - 1];
    r.inputs = [b.err ?? null, b.st, v2?.parentObj === A.scene.root, c.primitive.operators.length - ops0, op?.preset, op?.refs?.[0] === v2, b.log.filter(l => /0x29/.test(l)).length, nya(b)];
    A.undo(); r.undo = [inScene(v2), c.primitive.operators.length - ops0];
    out.vol = r;
  }

  // ---- SIInstantiate / GetMaster / GetInstances
  {
    const r = {}; const c = cube('instCube'); const holder = nul('instHolder');
    const model = A.run('CreateModel', { InputObj: [c], Name: 'instModel', Parent: 'instHolder' }); A.select([c]);
    const a = run('SIInstantiate', { InputObjs: [model] }); const inst = a.v?.[0];
    r.one = [a.err ?? null, Array.isArray(a.v), a.v?.length, a.st, inst?.name, inst?.kind, inst?.instanceMaster === model, inst?.parentObj === holder, names(A.selection), nya(a)];
    const b = run('SIInstantiate', { InputObjs: [model, c], NbItems: 2, Name: 'twin' }); r.many = [b.err ?? null, names(b.v), b.v?.every(x => x.instanceMaster === model && x.parentObj === holder)];
    A.undo(); r.undo = [...A.scene.allObjects()].filter(o => /^twin/.test(o.name)).length;
    const d = run('SIInstantiate', { InputObjs: [inst] }); r.fromInstance = [d.err ?? null, d.v?.length, d.v?.[0]?.instanceMaster === model]; A.undo();
    r.errors = [run('SIInstantiate', { InputObjs: [c] }).status, run('SIInstantiate', { InputObjs: [model], NbItems: 0 }).status, run('SIInstantiate', { InputObjs: [model], NbItems: -3 }).status].map(s => s ?? null);
    const u = A.undoStack.length;
    const m1 = run('GetMaster', { InputObjs: [inst, model] }); const m2 = run('GetMaster', { InputObjs: [model, inst] }); const m3 = run('GetMaster', { InputObjs: [c] });
    r.master = [m1.err ?? null, m1.v === model, m1.st, m2.v === undefined, m3.v === undefined, m3.st];
    A.select([inst]); r.masterSelection = run('GetMaster').v === model; A.select([]);
    const i1 = run('GetInstances', { InputObjs: [model, c] }); const i2 = run('GetInstances', { InputObjs: [inst] }); const i3 = run('GetInstances', { InputObjs: [c, model] });
    const lone = A.run('CreateModel', { InputObj: [], Name: 'loneModel' }); A.select([]); const i4 = run('GetInstances', { InputObjs: [lone] });
    r.instances = [i1.err ?? null, Array.isArray(i1.v), i1.v?.length, i1.v?.[0] === inst, i2.v === undefined, i3.v === undefined, i4.v === undefined];
    r.noSceneChange = A.undoStack.length - u <= 1; // only the CreateModel above
    r.empty = [run('GetMaster').status ?? null, run('GetInstances').status ?? null];
    out.inst = r;
  }

  // ---- GetURLAt
  {
    const r = {}; const c = cube('urlCube'); const d = cube('urlPrim'); const e = cube('urlMute');
    const a = run('GetURLAt', { InputObjs: [c] }); r.noProvider = [!!a.err, a.status ?? null];
    c.urlAt = (view, x, y) => `item:${view},${x},${y}`; d.primitive.urlAt = (view, x, y) => `prim:${view},${x},${y}`; e.urlAt = () => null;
    r.item = run('GetURLAt', { InputObjs: [c], View: 2, X: 10, Y: 20 }).v;
    r.defaults = run('GetURLAt', { InputObjs: [c] }).v;
    r.primitive = run('GetURLAt', { InputObjs: [d], View: 1, X: 65535, Y: 32768 }).v;
    r.firstAnswer = run('GetURLAt', { InputObjs: [e, d, c], View: 0, X: 1, Y: 1 }).v;
    const m = run('GetURLAt', { InputObjs: [e] }); r.noAnswer = [m.err ?? null, m.v, m.st];
    delete c.urlAt; delete d.primitive.urlAt; delete e.urlAt;
    out.url = r;
  }

  // ---- ImportEPS
  {
    const r = {}; const par = nul('epsParent');
    fsx.ensureFolder('C:\\eps');
    fsx.writeFile('C:\\eps\\Logo.EPS', ['%!PS-Adobe-3.0 EPSF-3.0', '%%BoundingBox: 0 0 100 100', 'newpath', '0 0 moveto 100 0 lineto 100 100 lineto 0 100 lineto closepath stroke',
      '20 20 moveto 20 60 60 60 60 20 curveto 80 20 lineto stroke', 'showpage'].join('\n'));
    fsx.writeFile('C:\\eps\\art.ai', '10 10 m\n30 10 L\n30 50 40 50 v\n10 50 l\ns\n');
    fsx.writeFile('C:\\eps\\draw.ps', '0 0 moveto 10 0 lineto stroke\n');
    const n0 = count(); A.select([par]);
    const a = run('ImportEPS', { FileName: 'C:\\eps\\Logo.EPS', UpdateSelection: false }); const o = a.v?.Value; const g = o?.primitive?.geom();
    const xs = g ? [g, ...(g.subcurves ?? [])].flatMap(c => c.cvs.map(p => p[0])) : []; const ys = g ? [g, ...(g.subcurves ?? [])].flatMap(c => c.cvs.map(p => p[1])) : [];
    r.logo = [a.err ?? null, keys(a.v), a.st, o?.name, o?.type, o?.primitive?.type, o?.parentObj === A.scene.root, count() - n0, names(A.selection), nya(a)];
    r.geometry = g ? [1 + (g.subcurves?.length ?? 0), g.degree, g.cvs.length, g.subcurves?.[0]?.degree, g.subcurves?.[0]?.cvs.length, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(r3), g.cvs.every(p => p[2] === 0)] : null;
    A.undo(); r.undo = [inScene(o), count() - n0];
    const b = run('ImportEPS', { FileName: 'C:/eps/art.ai', Parent: par }); const ob = b.v?.Value; const gb = ob?.primitive?.geom();
    r.ai = [b.err ?? null, ob?.name, ob?.parentObj === par, gb?.degree, gb?.cvs.length, names(A.selection)];
    r.otherExt = run('ImportEPS', { FileName: 'C:\\eps\\draw.ps' }).v?.Value?.name;
    const n1 = count(); const m = run('ImportEPS', { FileName: 'C:\\eps\\missing.eps' }); r.missing = [m.err ?? null, m.st, m.v?.Value, count() - n1, m.log.length];
    out.eps = r;
  }

  // ---- GetNbTriangles
  {
    const r = {}; const c = cube('triA'), d = cube('triB'); const n = nul('triNull');
    const tris = (o) => o.primitive.mesh().polygons.reduce((s, f) => s + f.length - 2, 0);
    const a = run('GetNbTriangles', { InputObjs: [c] }); r.one = [a.err ?? null, a.v, a.st, tris(c)];
    r.two = run('GetNbTriangles', { InputObjs: 'triA,triB' }).v;
    const b = run('GetNbTriangles', { InputObjs: [c, n] }); r.someRejected = [b.v, b.st, b.log.filter(l => /0x4b/.test(l)).length];
    const e = run('GetNbTriangles', { InputObjs: [n] }); r.noneValid = [e.err ?? null, e.v, e.st, e.log.filter(l => /0x4b/.test(l)).length];
    A.select([d]); r.selection = run('GetNbTriangles').v; A.select([]);
    out.tri = r;
  }

  // ---- SIAssignMaterial (stand-in of an earlier row)
  {
    const c = cube('matCube'); const before = c.material;
    A.select([c]); let made = null; try { made = A.run('SICreateMaterial', { Name: 'B8eMat' }); } catch { /* not on the bus */ }
    const mat = c.material ?? A.scene.materials?.find(m => m.name === 'B8eMat') ?? null; const d = cube('matCube2');
    const r = mat ? run('SIAssignMaterial', { Objects: [d], Material: mat }) : { err: 'no material to test with' };
    out.mat = [r.err ?? null, !!mat && d.material === mat, before === null, made !== undefined];
  }

  A.events.emit('scene'); await tick(); await tick();
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const NOTE_ST = '562e80c7', E_POINTER = '80004003', E_FAIL = '80004005', E_INVALIDARG = '80070057';

// 1. registration
for (const n of NAMES) eq(`${n}: registered with the registry argument list (names, defaults; return value left out)`, got.registered[n], registry[n]);

// 2. default arguments, nothing selected
const D = got.defaults;
eq('SIGetRigidCns / SIGetPrimLight / SIGetPrimCamera / SIGetPrimSpotLight / SIGetPrimLattice / SIGetPrimVolumeDeform defaults: null preset, 0x80004003, nothing created',
  ['SIGetRigidCns', 'SIGetPrimLight', 'SIGetPrimCamera', 'SIGetPrimSpotLight', 'SIGetPrimLattice', 'SIGetPrimVolumeDeform'].map(n => [D[n].status, D[n].made]), Array(6).fill([E_POINTER, 0]));
eq('SIAssembleNurbsMesh defaults: empty filtered list, nothing created, no error', [D.SIAssembleNurbsMesh.err, D.SIAssembleNurbsMesh.v, D.SIAssembleNurbsMesh.made], [false, ['OutputObj'], 0]);
eq('SIInstantiate defaults: no model in the input, message 0x1c raised with 0x80004005', [D.SIInstantiate.err, D.SIInstantiate.status], [true, E_FAIL]);
eq('GetMaster / GetInstances defaults: empty list, message 0x3fc with 0x80070057', [D.GetMaster.status, D.GetInstances.status], [E_INVALIDARG, E_INVALIDARG]);
eq('GetURLAt defaults: empty list, returns ""', [D.GetURLAt.err, D.GetURLAt.v, D.GetURLAt.st], [false, '', NOTE_ST]);
eq('ImportEPS defaults: the file cannot be opened, status 1, nothing created', [D.ImportEPS.err, D.ImportEPS.st, D.ImportEPS.v, D.ImportEPS.made], [false, '1', ['Value'], 0]);
eq('GetNbTriangles defaults: nothing valid, 0x562e80c7, count 0', [D.GetNbTriangles.err, D.GetNbTriangles.v, D.GetNbTriangles.st], [false, 0, NOTE_ST]);
eq('SIAssignMaterial defaults (stand-in of an earlier row): no material, error', D.SIAssignMaterial.err, true);

// 3. SIGetRigidCns
const R = got.rc;
eq('SIGetRigidCns: object named Name with a primitive of the preset, under the scene root; outputs Value, Primitive', R.named, [null, ['Value', 'Primitive'], '0', 'myHinge', true, 'Hinge', true, true, true, 1]);
eq('SIGetRigidCns: undo', R.undo, false);
eq('SIGetRigidCns: FileName names the object when Name is empty; Parent; <factory path>\\Application\\spdl\\<FileName>.spdl, directory created; meaning of the SPDL call logged as not attested',
  [R.file[0], R.file[1], /\\Application\\spdl\\hingeFile\.spdl$/.test(R.file[2] ?? ''), R.file[3], R.file[4]], ['hingeFile', true, true, true, 2]);
eq('SIGetRigidCns: Name wins over FileName', R.nameWins, 'nameWins');
eq('SIGetRigidCns: AddToScene false - created, not in the scene', R.notAdded, [null, 'loose', 0, null, true]);

// 4. SIAssembleNurbsMesh
const AS = got.asm;
eq('SIAssembleNurbsMesh: NURBS surfaces are available', AS.haveSurfaces, true);
if (AS.haveSurfaces) {
  eq('SIAssembleNurbsMesh: one new surface mesh from the surface inputs (the mesh is filtered out); OutputObj; selection untouched; assembly logged as not attested',
    AS.made, [null, ['OutputObj'], '0', true, 1, true, ['asmCube'], 1]);
  eq('SIAssembleNurbsMesh: undo deletes the output object', AS.undo, [false, 0]);
}
eq('SIAssembleNurbsMesh: no surface in the input - nothing created', AS.noSurface, [null, null, 1, 0, 0]);

// 5. SIGetPrimLight
const L = got.light;
eq('SIGetPrimLight (point): light under the scene root, interest outputs empty, selection untouched', L.point,
  [null, ['3DObject', '3DObjSpotInterest', 'PrimObj', 'PrimObjSpotInterest'], '0', 'fill', 'light', true, true, null, null, []]);
eq('SIGetPrimLight (spot): interest Name + "_Interest" under the same parent (looked up by name), direction constraint (0, 0, -1), spot at (3, 3, 3), interest at the origin',
  L.spot, [null, 'key', 2, true, 'key_Interest', true, 'SpotInterest', true, true, 1, true, [0, 0, -1], [3, 3, 3], [0, 0, 0]]);
eq('SIGetPrimLight (spot): undo removes light and interest', L.spotUndo, [false, false]);
eq('SIGetPrimLight (spot) without Name: interest name is "" + "_Interest"', L.spotNoName, ['_Interest', [3, 3, 3]]);
eq('SIGetPrimLight: a Parent name that is not found aborts the command', L.badParent, [true, E_FAIL]);

// 6. SIGetPrimCamera / SIGetPrimSpotLight
const C = got.aim;
eq('SIGetPrimCamera: camera + interest (siblings), direction constraint (0, 0, -1), camera at (0, 2, 20), interest at the origin, look-at pushed to the primitive, four outputs',
  C.camera, [null, ['3DObjCamera', '3DObjCameraInterest', 'PrimObjCamera', 'PrimObjCameraInterest'], '0', 'shot', 'camera', 'aim', 'CameraInterest', true, true, true, true, true,
    1, true, [0, 0, -1], [0, 2, 20], [0, 0, 0], { position: [0, 2, 20], interest: [0, 0, 0], up: [0, 1, 0] }, []]);
eq('SIGetPrimCamera: output_format.picture_ratio copied to the camera primitive; unresolved parameters logged', [C.ratio, C.cameraNya], [2, true]);
eq('SIGetPrimCamera: undo', C.cameraUndo, [false, false]);
eq('SIGetPrimCamera: Parent - both under it, global pose as the class defaults', C.cameraParent, [true, true, [0, 2, 20], [0, 0, 0], true]);
eq('SIGetPrimSpotLight: spot + interest under the parent, direction constraint, spot at (3, 3, 3), interest at the origin, four outputs',
  C.spot, [null, ['3DObjSpot', '3DObjSpotInterest', 'PrimObjSpot', 'PrimObjSpotInterest'], '0', 'rim', 'light', 2, 'rimAim', 'SpotInterest', true, true, true, true, 1, true, [3, 3, 3], [0, 0, 0]]);
eq('SIGetPrimSpotLight: a Parent that does not resolve means "no parent" (not checked)', C.spotBadParent, [null, true]);

// 7. SIGetPrimLattice
const T = got.lat;
eq('SIGetPrimLattice without InputObjs: lattice at the scene root, unconnected, Parent ignored; outputs PrimObj, Value', T.noInputs,
  [null, ['PrimObj', 'Value'], '0', 'freeLat', 'lattice', true, true, [0, 0, 0], []]);
eq('SIGetPrimLattice with inputs: fitted to them, lattice operator {input, lattice} on each, then parented under Parent', T.inputs, [null, '0', true, [3, 0, 0], true, 1, 'by Lattice', true]);
eq('SIGetPrimLattice: undo', T.undo, [false, 0]);
eq('SIGetPrimLattice: sub-component input becomes a cluster; a rejected item is a warning (0x2d) and the command continues', T.component, [null, '1', 1, 'point', [0, 1], 1, true]);

// 8. SIGetPrimVolumeDeform
const V = got.vol;
eq('SIGetPrimVolumeDeform without inputs: volume object under Parent (honoured at creation); outputs PrimObj, Value', V.noInputs, [null, ['PrimObj', 'Value'], '0', 'vol', true, true, true, 0]);
eq('SIGetPrimVolumeDeform with inputs: volume operator {input, volume} on each valid input, rejected item warning (0x29); helper sub-task and InitPropVolume logged as not attested',
  [V.inputs.slice(0, 7), V.inputs[7] >= 1], [[null, '1', true, 1, 'by Volume', true, 1], true]);
eq('SIGetPrimVolumeDeform: undo', V.undo, [false, 0]);

// 9. SIInstantiate / GetMaster / GetInstances
const I = got.inst;
eq('SIInstantiate: one instance model <master>_Instance bound to its master, under the master\'s parent, selection untouched; unresolved property / tasks logged',
  I.one, [null, true, 1, '0', 'instModel_Instance', 'model', true, true, ['instCube'], 1]);
eq('SIInstantiate: NbItems per master, Name, non-models dropped', I.many, [null, ['twin', 'twin1'], true]);
eq('SIInstantiate: undo', I.undo, 0);
eq('SIInstantiate: an instance in the input is replaced by its master', I.fromInstance, [null, 1, true]);
eq('SIInstantiate: no model = 0x80004005 (message 0x1c); NbItems below 1 = 0x80070057', I.errors, [E_FAIL, E_INVALIDARG, E_INVALIDARG]);
eq('GetMaster: first item only; an instance gives its master, anything else leaves Value unset', I.master, [null, true, '0', true, true, '0']);
eq('GetMaster: an unset list stands for the selection', I.masterSelection, true);
eq('GetInstances: first item only; a master gives its instances; an instance, a non-model or a model without instances leaves Value unset', I.instances, [null, true, 1, true, true, true, true]);
eq('GetMaster / GetInstances change nothing in the scene', I.noSceneChange, true);
eq('GetMaster / GetInstances: empty list = 0x80070057 (message 0x3fc)', I.empty, [E_INVALIDARG, E_INVALIDARG]);

// 10. GetURLAt
const U = got.url;
eq('GetURLAt: no input can answer - the collector fails with 0x80004005', U.noProvider, [true, E_FAIL]);
eq('GetURLAt: the item itself answers with (View, X, Y); defaults 0, -1, -1', [U.item, U.defaults], ['item:2,10,20', 'item:0,-1,-1']);
eq('GetURLAt: else the primitive of the item\'s object; View / X / Y are the low 16 bits, sign-extended', U.primitive, 'prim:1,-1,-32768');
eq('GetURLAt: the first object that answers supplies the string', U.firstAnswer, 'prim:0,1,1');
eq('GetURLAt: nobody answers - ""', U.noAnswer, [null, '', '0']);

// 11. ImportEPS
const E = got.eps;
eq('ImportEPS: curve list named after the file (directory and .eps removed, any case) under the scene root, selected whatever UpdateSelection says; output Value; parser logged as not attested',
  E.logo, [null, ['Value'], '0', 'Logo', 'crvlist', 'crvlist', true, 1, ['Logo'], 1]);
eq('ImportEPS: two sub-paths (closed polyline, line + Bezier span); scale 0.05, centred on the origin, in the XY plane', E.geometry, [2, 1, 5, 3, 7, [-2.5, 2.5, -2.5, 2.5], true]);
eq('ImportEPS: undo deletes the created object', E.undo, [false, 0]);
eq('ImportEPS: .ai removed too, Parent honoured, Illustrator short forms read, selected', E.ai, [null, 'art', true, 3, 13, ['art']]);
eq('ImportEPS: other extensions are kept in the name', E.otherExt, 'draw.ps');
eq('ImportEPS: a file that cannot be opened - status 1, no message, nothing created', E.missing, [null, '1', null, 0, 0]);

// 12. GetNbTriangles
const N = got.tri;
eq('GetNbTriangles: the triangle count of the geometry', [N.one[0], N.one[1] === N.one[3], N.one[1] > 0, N.one[2]], [null, true, true, '0']);
eq('GetNbTriangles: the total over the list', N.two, 2 * N.one[1]);
eq('GetNbTriangles: some items rejected - warning 0x4b, status 1, the rest is counted', N.someRejected, [N.one[1], '1', 1]);
eq('GetNbTriangles: nothing valid - warning 0x4b, 0x562e80c7, not counted', N.noneValid, [null, 0, NOTE_ST, 1]);
eq('GetNbTriangles: an unset list stands for the selection', N.selection, N.one[1]);

// 13. SIAssignMaterial
eq('SIAssignMaterial (stand-in of an earlier row): assigns the material to the objects', got.mat.slice(0, 2), [null, true]);

eq('page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-B8e primtasks primitive commands: ${fails.length} of ${checks} checks`);
  for (const x of fails) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8e primtasks primitive commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): SIGetPrimLight (non-spot), SIGetPrimLattice, GetMaster, GetInstances, GetURLAt (URL interface is a seam), GetNbTriangles');
console.log('   partly wired (log "not yet attested"): SIGetRigidCns (SPDL call; placeholder primitive), SIAssembleNurbsMesh (assembly and its three stages), SIGetPrimCamera (GUID-only parameters, constraint parameter 4), SIGetPrimSpotLight and the spot branch of SIGetPrimLight (constraint parameter 4), SIGetPrimVolumeDeform (helper sub-task, InitPropVolume), SIInstantiate (instance property and binding tasks), ImportEPS (parser passes and curve builder)');
console.log('   stand-in only: SIAssignMaterial (not implemented in primtasks.dll; earlier inferred registration kept)');
