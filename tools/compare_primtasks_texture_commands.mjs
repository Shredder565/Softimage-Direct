// CMD-B8d: the texture projection / support / UVW task commands of primtasks.dll on the command bus
// (src/commands/primTasksTexture.ts). Checked against the "Shared facts" and "Wire contract" sections of
// docs/ghidra/cmd-b8d-primtasks-texture-binary.md and the registry dump data/command_registry.json.
// No XSIBATCH golden exists for the row, so this is a contract check: registration with the registry argument list,
// a run with default arguments, and the stated results (output arguments, created objects, definitions, operators,
// status codes, log lines for the parts the note leaves open).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_primtasks_texture_commands.mjs
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

const NAMES = ['SIFindUniqueTextureName', 'SICreateTexturePureImplicit', 'SICreateTextureBasicGeo', 'SICreateTextureProj', 'SICreateTextureUVDomain',
  'SIConnectToSupport', 'SIConnectToProjection', 'SICameraTextureProj', 'SICreateTextureSpatial', 'SIGetTextureUVDomains', 'ChangeUVInput',
  'HealUVW', 'MatchUVW', 'CycleUVW', 'FlipUVW', 'RelaxUVW'];
// Registry argument list of a name, without the return value (flag 0x200): [name, default].
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => x.scripting_name === n && (x.handler_dlls ?? []).includes('primtasks.dll')) ?? reg.find(x => x.scripting_name === n);
  return [n, c ? c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('RelaxUVW') && !!window.Application?.primTasksTexture && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const A = window.Application; const S = A.primTasksTexture; const TP = A.textureProjection; A.autoInspect = false;
  const K = S.DEFINITION_KIND, OC = S.OPERATOR_CLASS;
  const out = {};
  const hex = (n) => n === undefined || n === null ? null : (n >>> 0).toString(16);
  const mark = () => A.log.length;
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`);
  const closeBoxes = () => { const n = document.querySelectorAll('.sdkh-msg .sdkh-modal-ok').length; document.querySelectorAll('.sdkh-msg .sdkh-modal-ok').forEach(b => b.click()); return n; };
  const run = (n, a = {}) => {
    S.lastStatus = null; const m = mark();
    try { const v = A.run(n, a); return { v, st: S.lastStatus?.command === n ? hex(S.lastStatus.status) : null, log: logFrom(m) }; }
    catch (e) { return { err: String(e?.message ?? e), status: hex(e?.status), log: logFrom(m) }; }
    finally { closeBoxes(); }
  };
  const nya = (r) => r.log.filter(l => /not yet attested/.test(l)).length;
  const tick = () => new Promise(r => setTimeout(r, 30));
  const cube = (name) => { const o = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name }); A.select([]); return o; };
  const uvProps = (o) => TP.uvPropertiesOf(o);
  const names = (xs) => [...(xs ?? [])].map(x => x?.name ?? null);
  const sub = (o, kind, els) => ({ kind: 'subcomponent', obj: o, compKind: kind, elements: els });
  const keys = (v) => v && typeof v === 'object' ? Object.keys(v).filter(k => !/^\d+$/.test(k)) : null;
  const def = (p) => { const d = S.definitionOf(p); return d ? [d.name, d.definitionKind, d.owner?.name ?? null] : null; };
  const ops = (p) => S.operatorsOf(p).map(o => o.clsid);
  const portNames = (op) => op.ports.map(x => x === null ? null : x?.name ?? '?');
  const messages = () => S.messages.length;

  // ---- registration
  out.registered = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));

  // ---- default arguments, nothing selected
  out.defaults = {};
  for (const n of NAMES) { A.select([]); const r = run(n); out.defaults[n] = { err: r.err ? true : false, status: r.status ?? null, st: r.st, isList: Array.isArray(r.v), keys: keys(r.v) }; }

  // ---- SIFindUniqueTextureName
  {
    const r = {}; const o = cube('fun');
    r.noScope = [run('SIFindUniqueTextureName', { InputObj: [o], PropertyName: 'Foo' }).v.PropertyName, run('SIFindUniqueTextureName', { InputObj: [o] }).v.PropertyName];
    A.run('SICreateTextureSpatial', { InputObj: [o] }); A.run('SICreateTextureSpatial', { InputObj: [o], PropertyName: 'Foo' });
    r.taken = [run('SIFindUniqueTextureName', { InputObj: [o], PropertyName: 'Foo' }).v.PropertyName, run('SIFindUniqueTextureName', { InputObj: [o], PropertyName: '' }).v.PropertyName, run('SIFindUniqueTextureName', { InputObj: [o], PropertyName: 'Bar' }).v.PropertyName];
    const o2 = cube('fun2'); A.run('SICreateTextureSpatial', { InputObj: [o2], PropertyName: 'Foo1' });
    r.everyInput = run('SIFindUniqueTextureName', { InputObj: [o, o2], PropertyName: 'Foo' }).v.PropertyName;
    const e = run('SIFindUniqueTextureName', { InputObj: [], PropertyName: 'Keep' }); r.nothingValid = [e.v.PropertyName, e.st, e.v[0]];
    const u = A.undoStack.length; run('SIFindUniqueTextureName', { InputObj: [o], PropertyName: 'Foo' }); r.createsNothing = [A.undoStack.length - u, uvProps(o).length];
    const bad = run('SIFindUniqueTextureName', { InputObj: 'noSuchObject', PropertyName: 'X' }); r.unresolved = bad.status ?? null;
    out.fun = r;
  }

  // ---- SICreateTexturePureImplicit
  {
    const r = {}; const o = cube('imp');
    const a = run('SICreateTexturePureImplicit', { InputObj: [o], PropertyName: 'Imp' }); const p = uvProps(o)[0];
    r.first = [a.err ?? null, keys(a.v), a.v.PropertyName, p?.name, p?.parent?.name, p?.parent?.compKind, p?.parent?.isComplete, def(p), ops(p)];
    const b = run('SICreateTexturePureImplicit', { InputObj: [o], PropertyName: 'Imp' }); const p2 = uvProps(o)[1];
    r.second = [b.v.PropertyName, p2?.name, def(p2), o.clusters.filter(c => c.compKind === 'sample').length];
    A.undo(); r.undo = names(uvProps(o));
    const n = run('SICreateTexturePureImplicit', { InputObj: [], PropertyName: 'N' }); r.nothing = [n.st, n.v.PropertyName];
    out.imp = r;
  }

  // ---- SICreateTextureBasicGeo
  {
    const r = {}; const o = cube('bg');
    const a = run('SICreateTextureBasicGeo', { InputObj: [o], PropertyName: 'Proj' }); const p = uvProps(o)[0]; const sup = a.v?.['3DObjTexture'];
    r.keys = [a.err ?? null, keys(a.v), a.st];
    r.support = [sup?.name, sup?.type, sup?.parentObj === A.scene.root, sup?.projectionType, sup?.projectionPlane, sup?.visible];
    r.property = [a.v.PropertyName, names(a.v.Properties), p?.name, p?.parent?.name, p?.val('kind'), p?.val('support') === sup?.name];
    r.definition = def(p);
    const op = S.operatorsOf(p)[0]; r.operator = [ops(p), op && portNames(op), op?.region];
    const b = run('SICreateTextureBasicGeo', { InputObj: [o], SupportName: 'MySup', PropertyName: 'Proj', ProjectionType: 1, ProjectionPlane: 2, Visibility: false, Parent: o }); const sup2 = b.v['3DObjTexture']; const p2 = uvProps(o)[1];
    r.second = [b.v.PropertyName, p2?.name, def(p2), sup2?.name, sup2?.parentObj === o, sup2?.projectionType, sup2?.projectionPlane, sup2?.visible, p2?.parent === p.parent];
    A.undo(); r.undo = [names(uvProps(o)), !!A.scene.find('MySup')];
    // sub-projection onto the existing property
    const nProps = uvProps(o).length; const nCl = o.clusters.length;
    const c = run('SICreateTextureBasicGeo', { InputObj: [sub(o, 'poly', [0])], TextureProjection: p, SupportName: 'SubSup' }); const sup3 = c.v?.['3DObjTexture']; const sop = S.operatorsOf(p)[1];
    r.sub = [c.err ?? null, sup3?.name, c.v?.Properties.length, uvProps(o).length - nProps, o.clusters.length - nCl, ops(p), sop && portNames(sop), def(p)];
    A.undo(); r.subUndo = [ops(p).length, !!A.scene.find('SubSup')];
    const n = run('SICreateTextureBasicGeo', { InputObj: [], PropertyName: 'N' }); r.nothing = [n.st, n.v['3DObjTexture'], n.v.Properties.length, n.v.PropertyName];
    const nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'bgNull' }); A.select([]);
    const f = run('SICreateTextureBasicGeo', { InputObj: [nul] }); r.filtered = [f.st, f.v['3DObjTexture'], f.log.length];
    const m = run('SICreateTextureBasicGeo', { InputObj: [o, nul], PropertyName: 'Mixed' }); r.someDropped = [m.st, m.v.Properties.length];
    out.bg = r;
  }

  // ---- SICreateTextureProj (legacy entry)
  {
    const r = {}; const o = cube('leg');
    const a = run('SICreateTextureProj', { InputObj: [o] }); r.fails = [a.status ?? null, nya(a), uvProps(o).length];
    S.quirks.createTextureProjFailsInUnPackArg = false;
    const b = run('SICreateTextureProj', { InputObj: [o], Name: 'Ignored', PropertyName: 'Leg' }); const p = uvProps(o)[0];
    r.other = [b.err ?? null, keys(b.v), b.v?.['3DObjTexture']?.name, b.v?.PrimObjTexture, b.v?.PropertyName, p?.name, def(p), nya(b)];
    S.quirks.createTextureProjFailsInUnPackArg = true;
    out.leg = r;
  }

  // ---- SICreateTextureUVDomain
  {
    const r = {}; let surf = null;
    try { surf = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'uvdSurf' }); } catch (e) { r.surfErr = String(e?.message ?? e); }
    A.select([]); r.haveSurface = !!surf && surf.primitive?.type === 'surfmsh';
    if (r.haveSurface) {
      const a = run('SICreateTextureUVDomain', { PresetObj: 'NurbsTextureCtrl', InputObj: [surf], PropertyName: 'Dom' }); const p = uvProps(surf)[0]; const sup = a.v?.OutputObjs?.[0];
      r.made = [a.err ?? null, keys(a.v), a.v.PropertyName, a.v.OutputObjs.length, /^Texture_Support\d*$/.test(sup?.name), names(a.v.Properties), sup?.parentObj === surf, sup?.type, sup?.visible, def(p)?.slice(0, 2), def(p)?.[2] === sup?.name, ops(p), nya(a)];
      const b = run('SICreateTextureUVDomain', { InputObj: [surf], SupportName: 'DomSup', PropertyName: 'Dom', Visibility: false }); r.second = [names(b.v.OutputObjs), names(b.v.Properties), b.v.OutputObjs[0]?.visible, b.v.PropertyName];
      out.uvdSupport = sup; out.uvdSurf = surf;
    }
    const o = cube('uvdMesh'); const m = run('SICreateTextureUVDomain', { InputObj: [o], PropertyName: 'No' }); r.mesh = [m.st, m.v.OutputObjs.length, m.v.Properties.length, uvProps(o).length];
    out.uvd = r;
  }

  // ---- SIConnectToSupport
  {
    const r = {}; const src = cube('csSrc'); const sup = A.run('SICreateTextureBasicGeo', { InputObj: [src], PropertyName: 'S', SupportName: 'ConSup', ProjectionType: 2 })['3DObjTexture'];
    const o = cube('cs');
    const a = run('SIConnectToSupport', { InputObj: [o], PropertyName: 'S', PrimObjTexture: sup }); const p = uvProps(o)[0]; const op = S.operatorsOf(p)[0];
    r.made = [a.err ?? null, keys(a.v), a.v.PropertyName, a.v['3DObjTexture'] === sup, p?.name, p?.val('kind'), def(p), ops(p), op && portNames(op)];
    const b = run('SIConnectToSupport', { InputObj: [o], PropertyName: 'S', PrimObjTexture: 'ConSup' }); r.unique = [b.v.PropertyName, names(uvProps(o))];
    A.undo(); r.undo = names(uvProps(o));
    const m0 = messages(); const c = run('SIConnectToSupport', { InputObj: [o], PropertyName: 'X' }); const last = S.messages[S.messages.length - 1];
    r.noSupport = [c.err ?? null, messages() - m0, last?.text, last?.title, c.v.PropertyName, c.v['3DObjTexture'], uvProps(o).length, nya(c)];
    const d = run('SIConnectToSupport', { InputObj: [o], PrimObjTexture: src }); r.notASupport = [messages() - m0, d.v['3DObjTexture']];
    if (out.uvdSupport) { const e = run('SIConnectToSupport', { InputObj: [out.uvdSurf], PropertyName: 'Shared', PrimObjTexture: out.uvdSupport }); const q = uvProps(out.uvdSurf).find(x => x.name === e.v.PropertyName); r.nurbs = [def(q)?.[1], ops(q), q?.val('kind')]; }
    const n = run('SIConnectToSupport', { InputObj: [], PrimObjTexture: sup }); r.nothing = [n.st, n.v['3DObjTexture']];
    out.cs = r; delete out.uvdSupport; delete out.uvdSurf;
  }

  // ---- SIConnectToProjection
  {
    const r = {}; const src = cube('cpSrc'); const made = A.run('SICreateTextureBasicGeo', { InputObj: [src], PropertyName: 'Shared' }); const sp = made.Properties[0]; const sup = made['3DObjTexture'];
    const o = cube('cp');
    const a = run('SIConnectToProjection', { InputObj: [o], PropertyName: 'Shared', TextureProjection: sp }); const p = uvProps(o)[0]; const op = S.operatorsOf(p)[0];
    r.made = [a.err ?? null, keys(a.v), a.v.PropertyName, a.v.TextureProjection === sp, p?.name, S.definitionOf(p) === S.definitionOf(sp), ops(p), op?.ports[1] === sup, p?.val('kind') === sp.val('kind'), nya(a)];
    const m0 = messages(); const b = run('SIConnectToProjection', { InputObj: [o], PropertyName: 'X' }); r.noSource = [b.err ?? null, messages() - m0, S.messages[S.messages.length - 1]?.text, uvProps(o).length];
    const imp = cube('cpImp'); A.run('SICreateTexturePureImplicit', { InputObj: [imp], PropertyName: 'I' });
    const c = run('SIConnectToProjection', { InputObj: [o], TextureProjection: uvProps(imp)[0] }); r.noOperator = [c.status ?? null, uvProps(o).length];
    out.cp = r;
  }

  // ---- SICameraTextureProj
  {
    const r = {}; const o = cube('cam');
    let camera = [...A.scene.allObjects()].find(x => x.type === 'camera');
    if (!camera) { camera = A.run('SIGetPrimCamera', { PresetObj: 'Camera' })['3DObjCamera']; A.select([]); }
    r.haveCamera = !!camera;
    const a = run('SICameraTextureProj', { InputObj: [o], PrimObjTexture: camera }); const p = uvProps(o)[0]; const op = S.operatorsOf(p)[0];
    r.made = [a.err ?? null, keys(a.v), a.v.PropertyName, a.v['3DObjCamera'] === camera, p?.name, p?.val('kind'), p?.val('support') === camera.name, def(p), ops(p), op?.ports[1] === camera];
    const m0 = messages(); const b = run('SICameraTextureProj', { InputObj: [o] }); r.noCamera = [b.err ?? null, messages() - m0, S.messages[S.messages.length - 1]?.text, b.v['3DObjCamera'], uvProps(o).length];
    const other = cube('camNot'); const c = run('SICameraTextureProj', { InputObj: [o], PrimObjTexture: other }); r.notACamera = [c.err ?? null, c.v['3DObjCamera'], uvProps(o).length, c.log.filter(l => /^error:.*0x117/.test(l)).length];
    const n = run('SICameraTextureProj', { InputObj: [], PrimObjTexture: camera }); r.nothing = [n.st, n.v['3DObjCamera']];
    out.cam = r;
  }

  // ---- SICreateTextureSpatial
  {
    const r = {}; const o = cube('spa');
    const a = run('SICreateTextureSpatial', { InputObj: [o], PropertyName: 'Geo' }); const p = uvProps(o)[0]; const op = S.operatorsOf(p)[0];
    r.made = [a.err ?? null, keys(a.v), a.v.PropertyName, a.v.CreatedObj, p?.name, p?.val('kind'), p?.val('support'), def(p), ops(p), op && portNames(op)];
    const b = run('SICreateTextureSpatial', { InputObj: [o], PropertyName: 'Geo' }); r.second = [b.v.PropertyName, b.v.CreatedObj];
    const n = run('SICreateTextureSpatial', { InputObj: [], PropertyName: 'N' }); r.nothing = [n.st, n.v.PropertyName];
    out.spa = r;
  }

  // ---- SIGetTextureUVDomains
  {
    const r = {}; const o = cube('dom'); const s1 = A.run('SICreateTextureBasicGeo', { InputObj: [o], SupportName: 'DomA' })['3DObjTexture']; const s2 = A.run('SICreateTextureBasicGeo', { InputObj: [o], SupportName: 'DomB' })['3DObjTexture'];
    A.run('SICreateTextureSpatial', { InputObj: [o] });
    const a = run('SIGetTextureUVDomains', { InputObjs: [o, o] }); r.list = [a.err ?? null, Array.isArray(a.v), a.v.length, a.v[0] === s1, a.v[1] === s2];
    const u = A.undoStack.length; const e = run('SIGetTextureUVDomains', { InputObjs: [cube('domNone')] }); r.none = [e.v.length, A.undoStack.length - u];
    out.dom = r;
  }

  // ---- ChangeUVInput
  {
    const r = {}; const o = cube('cui'); A.run('SICreateTextureSpatial', { InputObj: [o], PropertyName: 'Swim' }); const p = uvProps(o)[0];
    const a = run('ChangeUVInput', { TextureProjection: p }); r.swim = [a.err ?? null, a.v === undefined, a.st, p.uvInputAction, p.swim, nya(a)];
    A.undo(); r.undo = [p.uvInputAction ?? null, p.swim ?? null]; A.redo(); r.redo = [p.uvInputAction, p.swim];
    const b = run('ChangeUVInput', { TextureProjection: p, MoveAction: 1 }); r.action1 = [b.err ?? null, p.uvInputAction, p.swim, p.uvInputSide, p.uvInputMarker?.type, nya(b)];
    const c = run('ChangeUVInput', { TextureProjection: p, MoveAction: 2 }); r.action2 = [c.err ?? null, p.uvInputAction, p.uvInputSide];
    r.action3 = run('ChangeUVInput', { TextureProjection: p, MoveAction: 3 }).status ?? null;
    r.unset = run('ChangeUVInput').status ?? null; r.notAProperty = run('ChangeUVInput', { TextureProjection: o }).status ?? null;
    const imp = cube('cuiImp'); A.run('SICreateTexturePureImplicit', { InputObj: [imp], PropertyName: 'I' });
    r.noOperator = run('ChangeUVInput', { TextureProjection: uvProps(imp)[0] }).status ?? null;
    out.cui = r;
  }

  // ---- UVW editing family
  {
    const r = {}; const o = cube('uvw'); A.run('SICreateTextureSpatial', { InputObj: [o], PropertyName: 'UVW' }); const p = uvProps(o)[0];
    try { A.selectComponents(o, 'polygon', [2, 3], 'replace'); A.run('CreateCluster'); } catch { /* no cluster command */ } A.select([]);
    const cluster = o.clusters.find(c => c.compKind === 'poly') ?? null; r.haveCluster = !!cluster;
    const before = TP.propertyUVs(o, p).join(',');
    const shape = (x, cls) => { const op = x.v; return [x.err ?? null, x.st, op?.clsid === cls, op?.parent === p, S.operatorsOf(p).includes(op), op?.ports?.map(q => q === p ? 'prop' : q === null ? null : q?.compKind ?? '?'), op?.region, nya(x)]; };
    if (cluster) { const h = run('HealUVW', { TextureProjection: p, SubComp: cluster }); r.healCluster = shape(h, OC.heal); r.healPorts = h.v?.ports[1] === cluster; A.undo(); r.healUndo = S.operatorsOf(p).includes(h.v); }
    const nCl = o.clusters.length; const h2 = run('HealUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0, 1]) });
    r.healSub = [shape(h2, OC.heal), o.clusters.length - nCl, [...(h2.v?.ports[1].elements ?? [])], h2.v?.params.filter(q => q.name !== 'Name').length ?? null];
    A.undo(); r.healSubUndo = [o.clusters.length - nCl, S.operatorsOf(p).includes(h2.v)];
    const m = run('MatchUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]) }); r.matchDefault = [shape(m, OC.match), m.v?.val('tolerance'), m.v?.parameterGuid];
    r.matchValue = run('MatchUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]), Tolerance: 0.5 }).v?.val('tolerance');
    const c = run('CycleUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]) }); r.cycleDefault = [shape(c, OC.cycle), c.v?.val('offset'), c.v?.parameterGuid];
    r.cycleValue = run('CycleUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]), Offset: 3 }).v?.val('offset');
    const f = run('FlipUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]) }); r.flipDefault = [shape(f, OC.flip), f.v?.val('pivot'), f.v?.parameterGuid];
    r.flipValue = run('FlipUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]), Pivot: 2 }).v?.val('pivot');
    const x = run('RelaxUVW', { TextureProjection: p, SubComp: sub(o, 'poly', [0]) }); r.relax = [x.err ?? null, x.v?.clsid === OC.relax, x.v?.ports.length, x.v?.ports[0] === p, x.v?.ports[1]?.compKind, nya(x)];
    r.uvsUnchanged = TP.propertyUVs(o, p).join(',') === before;
    const whole = run('HealUVW', { TextureProjection: p, SubComp: o }); r.otherType = [whole.err ?? null, whole.v === undefined, whole.st];
    r.nullArgs = [run('HealUVW').status, run('HealUVW', { TextureProjection: p }).status, run('MatchUVW', { SubComp: sub(o, 'poly', [0]) }).status, run('RelaxUVW', { TextureProjection: o, SubComp: sub(o, 'poly', [0]) }).status].map(s => s ?? null);
    let surf = null; try { surf = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'uvwSurf' }); } catch { /* no surfaces */ } A.select([]);
    if (surf && surf.primitive?.type === 'surfmsh') { const n = run('CycleUVW', { TextureProjection: p, SubComp: sub(surf, 'poly', [0]) }); r.notAMesh = [n.err ?? null, n.v === undefined, n.st, n.log.filter(l => /0x29/.test(l)).length]; }
    out.uvw = r;
  }

  A.events.emit('scene'); await tick(); out.openBoxes = closeBoxes();
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const NOTE_ST = '562e80c7', E_NOTIMPL = '80004001', E_POINTER = '80004003', E_FAIL = '80004005', E_UNEXPECTED = '8000ffff';
const K = { b: 0x62, c: 0x63, i: 0x69, n: 0x6e, s: 0x73 };
const OC = { basicGeo: '{25d90fda-e843-45f3-8cd8-d67d787d72f6}', sub: '{d4559710-c7fb-4db3-a2fa-543f9781407c}', uvDomain: '{870ee6f2-0666-11d1-a8dd-00a024190119}', uvDomain2: '{0ff48093-8651-11d3-bc59-00a0c9612b97}', camera: '{7158c404-4f4e-11d3-b0c9-00a0c982dd9a}', spatial: '{27410380-4e87-11d3-b0c9-00a0c982dd9a}' };

// 1. registration
for (const n of NAMES) eq(`${n}: registered with the registry argument list (names, defaults; return value left out)`, got.registered[n], registry[n]);

// 2. default arguments
const D = got.defaults;
for (const n of ['SIFindUniqueTextureName', 'SICreateTexturePureImplicit', 'SICreateTextureBasicGeo', 'SICreateTextureUVDomain', 'SICreateTextureSpatial'])
  eq(`${n} defaults, nothing selected: nothing valid, status 0x562e80c7, no error`, [D[n].err, D[n].st], [false, NOTE_ST]);
eq('SIConnectToSupport / SIConnectToProjection / SICameraTextureProj defaults: message box, no error', [D.SIConnectToSupport.err, D.SIConnectToProjection.err, D.SICameraTextureProj.err], [false, false, false]);
eq('SIGetTextureUVDomains defaults: an empty list', [D.SIGetTextureUVDomains.err, D.SIGetTextureUVDomains.isList], [false, true]);
eq('SICreateTextureProj defaults: stops in UnPackArg (inferred reading, open question 1)', [D.SICreateTextureProj.err, D.SICreateTextureProj.status], [true, E_FAIL]);
eq('ChangeUVInput / HealUVW / MatchUVW / CycleUVW / FlipUVW / RelaxUVW defaults: null arguments, 0x80004003',
  ['ChangeUVInput', 'HealUVW', 'MatchUVW', 'CycleUVW', 'FlipUVW', 'RelaxUVW'].map(n => D[n].status), Array(6).fill(E_POINTER));
eq('output-argument lists', { fun: D.SIFindUniqueTextureName.keys, imp: D.SICreateTexturePureImplicit.keys, bg: D.SICreateTextureBasicGeo.keys, uvd: D.SICreateTextureUVDomain.keys, cs: D.SIConnectToSupport.keys, cp: D.SIConnectToProjection.keys, cam: D.SICameraTextureProj.keys, spa: D.SICreateTextureSpatial.keys },
  { fun: ['PropertyName'], imp: ['PropertyName'], bg: ['PropertyName', '3DObjTexture', 'Properties'], uvd: ['PropertyName', 'OutputObjs', 'Properties'], cs: ['PropertyName', '3DObjTexture'], cp: ['PropertyName', 'TextureProjection'], cam: ['PropertyName', '3DObjCamera'], spa: ['PropertyName', 'CreatedObj'] });

// 3. SIFindUniqueTextureName
const F = got.fun;
eq('SIFindUniqueTextureName: no texture-coordinate cluster - proposal unchanged, empty proposal = Texture_Projection', F.noScope, ['Foo', 'Texture_Projection']);
eq('SIFindUniqueTextureName: taken names get a number; a free name is kept', F.taken, ['Foo1', 'Texture_Projection1', 'Bar']);
eq('SIFindUniqueTextureName: free in every cluster of every input (passes repeat until stable)', F.everyInput, 'Foo2');
eq('SIFindUniqueTextureName: nothing valid - name left as given', F.nothingValid, ['Keep', NOTE_ST, 'Keep']);
eq('SIFindUniqueTextureName: creates nothing, no undo entry', F.createsNothing, [0, 2]);
eq('SIFindUniqueTextureName: no input item usable - 0x80004005', F.unresolved, E_FAIL);

// 4. SICreateTexturePureImplicit
const I = got.imp;
eq('SICreateTexturePureImplicit: UV property on a new complete Texture_Coordinates cluster, definition <name>_Def kind 0x69 without owner, no operator',
  I.first, [null, ['PropertyName'], 'Imp', 'Imp', 'Texture_Coordinates', 'sample', true, ['Imp_Def', K.i, null], []]);
eq('SICreateTexturePureImplicit: second run - unique property name, definition and PropertyName keep the name as passed, cluster reused', I.second, ['Imp', 'Imp1', ['Imp_Def', K.i, null], 1]);
eq('SICreateTexturePureImplicit: undo', I.undo, ['Imp']);
eq('SICreateTexturePureImplicit: nothing valid - 0x562e80c7, name as passed', I.nothing, [NOTE_ST, 'N']);

// 5. SICreateTextureBasicGeo
const B = got.bg;
eq('SICreateTextureBasicGeo: outputs PropertyName, 3DObjTexture, Properties; status 0', B.keys, [null, ['PropertyName', '3DObjTexture', 'Properties'], '0']);
eq('SICreateTextureBasicGeo: support Texture_Support under the scene root, planar XY, visible', B.support, ['Texture_Support', 'texturesupport', true, 0, 0, true]);
eq('SICreateTextureBasicGeo: UV property through the support on the Texture_Coordinates cluster', B.property, ['Proj', ['Proj'], 'Proj', 'Texture_Coordinates', 'Planar XY', true]);
eq('SICreateTextureBasicGeo: definition <unique>_Def, kind 0x62, owned by the support', B.definition, ['Proj_Def', K.b, 'Texture_Support']);
eq('SICreateTextureBasicGeo: operator {25d90fda-...}: object, support, UV property, definition, UV property, cluster; modeling region', B.operator,
  [[OC.basicGeo], ['bg', 'Texture_Support', 'Proj', 'Proj_Def', 'Proj', 'Texture_Coordinates'], 'modeling']);
eq('SICreateTextureBasicGeo: SupportName / Parent / type / plane / Visibility; PropertyName stays the requested name, the property is uniquified; cluster reused',
  B.second, ['Proj', 'Proj1', ['Proj1_Def', K.b, 'MySup'], 'MySup', true, 1, 2, false, true]);
eq('SICreateTextureBasicGeo: undo', B.undo, [['Proj'], false]);
eq('SICreateTextureBasicGeo sub-projection: new support, operator {d4559710-...} on the existing property (cluster, support, no definition connection), no property / cluster / definition created',
  B.sub, [null, 'SubSup', 0, 0, 0, [OC.basicGeo, OC.sub], ['Texture_Coordinates', 'SubSup', 'Proj', null, 'Proj', 'Texture_Coordinates'], ['Proj_Def', K.b, 'Texture_Support']]);
eq('SICreateTextureBasicGeo sub-projection: undo', B.subUndo, [1, false]);
eq('SICreateTextureBasicGeo: nothing valid - 0x562e80c7, no change', B.nothing, [NOTE_ST, null, 0, 'N']);
eq('SICreateTextureBasicGeo: input rejected by the class filter - 0x562e80c7 with a warning', B.filtered, [NOTE_ST, null, 1]);
eq('SICreateTextureBasicGeo: some inputs dropped - status 1, the rest is projected', B.someDropped, ['1', 1]);

// 6. SICreateTextureProj
const L = got.leg;
eq('SICreateTextureProj: stops before Do (inferred), says what is not attested, creates nothing', L.fails, [E_FAIL, 1, 0]);
eq('SICreateTextureProj, other reading (quirk off): SICreateTextureBasicGeo with Texture_Support; Name ignored, PrimObjTexture never written',
  [L.other.slice(0, 2), L.other[2]?.startsWith('Texture_Support'), L.other.slice(3, 6), L.other[6]?.[1], L.other[7]], [[null, ['3DObjTexture', 'PrimObjTexture', 'PropertyName']], true, [null, 'Leg', 'Leg'], K.b, 1]);

// 7. SICreateTextureUVDomain
const U = got.uvd;
eq('SICreateTextureUVDomain: a NURBS surface is available', U.haveSurface, true);
if (U.haveSurface) {
  eq('SICreateTextureUVDomain: support (child of the surface) + UV property, definition kind 0x6e owned by the support, operators {870ee6f2-...} then {0ff48093-...}; open parts logged',
    U.made, [null, ['PropertyName', 'OutputObjs', 'Properties'], 'Dom', 1, true, ['Dom'], true, 'texturesupport', true, ['Dom_Def', K.n], true, [OC.uvDomain, OC.uvDomain2], 1]);
  eq('SICreateTextureUVDomain: SupportName, unique property name, Visibility false; PropertyName as passed', U.second, [['DomSup'], ['Dom1'], false, 'Dom']);
}
eq('SICreateTextureUVDomain: polygon mesh rejected by the class filter - 0x562e80c7, nothing created', U.mesh, [NOTE_ST, 0, 0, 0]);

// 8. SIConnectToSupport
const C = got.cs;
eq('SIConnectToSupport: UV property through the existing support; definition kind 0x62 owned by it; operator {25d90fda-...} with the support connected; outputs',
  C.made, [null, ['PropertyName', '3DObjTexture'], 'S', true, 'S', 'Spherical', ['S_Def', K.b, 'ConSup'], [OC.basicGeo], ['cs', 'ConSup', 'S', 'S_Def', 'S', 'Texture_Coordinates']]);
eq('SIConnectToSupport: PropertyName comes back uniquified', C.unique, ['S1', ['S', 'S1']]);
eq('SIConnectToSupport: undo', C.undo, ['S']);
eq('SIConnectToSupport: no support - message box "There were no valid texture control selected" (title Error), nothing created, status after it logged as not attested',
  C.noSupport, [null, 1, 'There were no valid texture control selected', 'Error', 'X', null, 1, 1]);
eq('SIConnectToSupport: an object that is not a texture support - same message', C.notASupport, [2, null]);
if (U.haveSurface) eq('SIConnectToSupport: NURBS support - definition kind 0x6e, operator {870ee6f2-...}', C.nurbs, [K.n, [OC.uvDomain], 'UV']);
eq('SIConnectToSupport: nothing valid - 0x562e80c7', C.nothing, [NOTE_ST, null]);

// 9. SIConnectToProjection
const P = got.cp;
eq('SIConnectToProjection: new UV property attached to the existing definition (none created), operator of the source\'s class, outputs; support source logged as not attested',
  P.made, [null, ['PropertyName', 'TextureProjection'], 'Shared', true, 'Shared', true, [OC.basicGeo], true, true, 1]);
eq('SIConnectToProjection: no projection - message box "There were no valid texture projection selected", nothing created', P.noSource, [null, 1, 'There were no valid texture projection selected', 1]);
eq('SIConnectToProjection: source without a projection operator - 0x80004005', P.noOperator, [E_FAIL, 1]);

// 10. SICameraTextureProj
const M = got.cam;
eq('SICameraTextureProj: a camera is available', M.haveCamera, true);
eq('SICameraTextureProj: camera projection; definition kind 0x63; operator {7158c404-...} with the camera in the support position; outputs',
  [M.made.slice(0, 7), M.made[7]?.slice(0, 2), M.made.slice(8)], [[null, ['PropertyName', '3DObjCamera'], 'Texture_Projection', true, 'Texture_Projection', 'Camera Projection', true], ['Texture_Projection_Def', K.c], [[OC.camera], true]]);
eq('SICameraTextureProj: no camera - message box "There were no valid camera selected", nothing created', M.noCamera, [null, 1, 'There were no valid camera selected', null, 1]);
eq('SICameraTextureProj: object that is not a scene camera - error message 0x117, nothing created', M.notACamera, [null, null, 1, 1]);
eq('SICameraTextureProj: nothing valid - 0x562e80c7', M.nothing, [NOTE_ST, null]);

// 11. SICreateTextureSpatial
const G = got.spa;
eq('SICreateTextureSpatial: spatial UV property without support; definition kind 0x73 without owner; operator {27410380-...} on the no-support path; CreatedObj never written',
  G.made, [null, ['PropertyName', 'CreatedObj'], 'Geo', null, 'Geo', 'Spatial', '', ['Geo_Def', K.s, null], [OC.spatial], ['spa', 'Geo', 'spa', 'Geo_Def', 'Geo', 'Texture_Coordinates']]);
eq('SICreateTextureSpatial: PropertyName comes back uniquified', G.second, ['Geo1', null]);
eq('SICreateTextureSpatial: nothing valid - 0x562e80c7, name as passed', G.nothing, [NOTE_ST, 'N']);

// 12. SIGetTextureUVDomains
eq('SIGetTextureUVDomains: the supports used by the inputs, once each, no camera / support-less projections', got.dom.list, [null, true, 2, true, true]);
eq('SIGetTextureUVDomains: none; no scene change', got.dom.none, [0, 0]);

// 13. ChangeUVInput
const X = got.cui;
eq('ChangeUVInput default (swim, action 0): mode 0 without marker, no output, status 0', X.swim, [null, true, '0', 0, true, 0]);
eq('ChangeUVInput: undo / redo', [X.undo, X.redo], [[null, null], [0, true]]);
eq('ChangeUVInput action 1: relative to a construction marker, side code 2; names / move task logged as not attested', X.action1, [null, 1, false, 2, 'modelingmarker', 1]);
eq('ChangeUVInput action 2: side code 1', X.action2, [null, 2, 1]);
eq('ChangeUVInput: action > 2 = 0x80004001; null property = 0x80004003; no operator writes the property = 0x8000ffff', [X.action3, X.unset, X.notAProperty, X.noOperator], [E_NOTIMPL, E_POINTER, E_POINTER, E_UNEXPECTED]);

// 14. UVW editing family
const W = got.uvw;
const SHAPE = [null, '0', true, true, true, ['prop', 'poly'], 'modeling', 1];
if (W.haveCluster) {
  eq('HealUVW on a cluster: operator {ed5f3308-...} on the UV property, connections UV property + cluster, returned', [W.healCluster.slice(0, 5), W.healCluster[5]?.[0], W.healCluster[6], W.healPorts], [SHAPE.slice(0, 5), 'prop', 'modeling', true]);
  eq('HealUVW: undo removes the operator', W.healUndo, false);
}
eq('HealUVW on a sub-component: a cluster is made from the index array first; no parameter', W.healSub, [SHAPE, 1, [0, 1], 0]);
eq('HealUVW on a sub-component: undo removes operator and cluster', W.healSubUndo, [0, false]);
eq('MatchUVW: operator {9676235f-...}, parameter {8e9cc20a-...} = Tolerance (default 0.02)', [W.matchDefault, W.matchValue], [[SHAPE, 0.02, '{8e9cc20a-4371-4d44-a563-174120fc777b}'], 0.5]);
eq('CycleUVW: operator {e2f1d19c-...}, parameter {45733896-...} = Offset (default 1)', [W.cycleDefault, W.cycleValue], [[SHAPE, 1, '{45733896-ec8f-47b2-8010-e89e9a091209}'], 3]);
eq('FlipUVW: operator {8c3c4d1b-...}, parameter {6f963cfb-...} = Pivot (default 1)', [W.flipDefault, W.flipValue], [[SHAPE, 1, '{6f963cfb-00ef-40c5-9133-4ff8f43a12cc}'], 2]);
eq('RelaxUVW: operator {32187e0b-...} with three connections (third not read); preparation and UV evaluation logged as not attested', W.relax, [null, true, 3, true, 'poly', 2]);
eq('UVW family: the UV evaluation belongs to the operators (not read) - UVs unchanged', W.uvsUnchanged, true);
eq('UVW family: SubComp of another element type - nothing, status 0', W.otherType, [null, true, '0']);
eq('UVW family: null arguments - 0x80004003', W.nullArgs, Array(4).fill(E_POINTER));
if (W.notAMesh) eq('UVW family: owner is not a polygon mesh - warning 0x29, status 1', W.notAMesh, [null, true, '1', 1]);

eq('no message box left open', got.openBoxes, 0);
eq('page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-B8d primtasks texture commands: ${fails.length} of ${checks} checks`);
  for (const x of fails) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B8d primtasks texture commands: ${checks} checks, ${NAMES.length} commands exercised (contract + registry dump; no XSIBATCH golden)`);
console.log('   fully wired (command layer): SIFindUniqueTextureName, SICreateTexturePureImplicit, SICreateTextureBasicGeo, SIConnectToSupport, SICameraTextureProj, SICreateTextureSpatial, SIGetTextureUVDomains');
console.log('   partly wired (log "not yet attested"): SICreateTextureProj (open question 1), SICreateTextureUVDomain (setup sub-task, second operator), SIConnectToProjection (support source), ChangeUVInput (actions 1 / 2, move task), HealUVW / MatchUVW / CycleUVW / FlipUVW (UV evaluation of the operator), RelaxUVW (preparation, third connection, UV evaluation)');
