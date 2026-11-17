// CMD-12a: the 12 texture projection / texture support script commands on the command bus.
// Checked against the "Wire contract" of docs/ghidra/cmd-12a-texture-projection-scripts.md and the registry dump
// data/commands_full.json. No XSIBATCH golden was run for this row, so this is a contract check: registration,
// a run with default arguments, and the stated results (output arguments, created objects / properties, log lines).
// UV values are Float32, so UV numbers are compared after rounding to 4 decimals.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_texture_projection_commands.mjs
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

const NAMES = ['CreateTextureProj', 'CreateSubprojection', 'CameraTextureProj', 'ConnectToTextureProj', 'CreateTextureSpatial', 'CreateTextureUVDomain',
  'FitSubcomponentUVsToImage', 'ModifyUVSetByContourStretching', 'HideTextureUVDomains', 'UnhideTextureUVDomains', 'ToggleVisibilityOfTextureUVDomains', 'SetCheckerboardMode'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
// ModifyUVSetByContourStretching has two registry entries with the same argument list; the first one found is used.
const registry = Object.fromEntries(NAMES.map(n => { const c = list.find(x => (x.scripting_name || x.name) === n); return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));
const registryLabels = Object.fromEntries(NAMES.map(n => [n, list.filter(x => x.scripting_name === n).map(x => x.name)]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SetCheckerboardMode') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const A = window.Application; const TP = A.textureProjection; A.autoInspect = false;
  const out = {};
  const mark = () => A.log.length;
  const logFrom = (i) => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}:${l.text}`); // the command echo is not part of the contract
  const run = (n, a = {}) => { const m = mark(); try { const v = A.run(n, a); return { v, log: logFrom(m) }; } catch (e) { return { err: String(e?.message ?? e), number: e?.number ?? null, log: logFrom(m) }; } };
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const tick = () => new Promise(r => setTimeout(r, 30));
  const cube = (name) => A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: name });
  const uvProps = (o) => TP.uvPropertiesOf(o);
  const names = (xs) => xs.map(x => x?.name ?? null);
  const rawBounds = (o, p, item) => { const m = o.primitive.mesh(); const b = TP.uvBounds(TP.propertyUVs(o, p), TP.samplesOfItem(item ?? o, m)); return [b.umin, b.vmin, b.umax, b.vmax]; };
  const bounds = (o, p, item) => { const m = o.primitive.mesh(); const b = TP.uvBounds(TP.propertyUVs(o, p), TP.samplesOfItem(item ?? o, m)); return [r4(b.umin), r4(b.vmin), r4(b.umax), r4(b.vmax)]; };
  const scl = (o) => { const e = o.globalMatrix().elements; return [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])].map(r4); };
  const sub = (o, kind, els) => ({ kind: 'subcomponent', obj: o, compKind: kind, elements: els });
  const outKeys = (v) => v && typeof v === 'object' ? Object.keys(v) : null;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = A.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.labels = Object.fromEntries(NAMES.map(n => [n, A.commands.get(n)?.label ?? null]));
  out.categories = Object.fromEntries(NAMES.map(n => [n, A.commands.get(n)?.category ?? null]));

  // ---- defaults: every command with default arguments, a mesh object selected
  {
    const o = cube('dflt'); out.defaults = {};
    for (const n of NAMES) { A.select([o]); const r = run(n); out.defaults[n] = { err: r.err ?? null, log: r.log, keys: outKeys(r.v), isArray: Array.isArray(r.v) }; }
    out.defaultsProps = uvProps(o).map(p => [p.name, p.val('kind')]);
  }

  // ---- CreateTextureProj
  {
    const r = {}; const o = cube('ctp'); const o2 = cube('ctp2'); A.select([o2]);
    const a = run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'MyProj', ProjectionType: 1, ProjectionPlane: 2 });
    r.err = a.err ?? null; r.ret = a.v; const p = uvProps(o)[0]; const sup = TP.supportsOfProperty(o, p)[0];
    r.prop = [p?.name, p?.val('kind'), p?.parent?.compKind]; r.support = [sup?.name, sup?.type, sup?.parentObj?.name, sup?.projectionKind];
    r.bounds = bounds(o, p); r.selection = names(A.selection);
    // a second call: the name in use is made unique and handed back
    const b = run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'MyProj' }); r.ret2 = b.v; r.props2 = names(uvProps(o));
    A.undo(); r.afterUndo = [names(uvProps(o)), TP.getTextureUVDomains([o]).length]; A.redo(); r.afterRedo = names(uvProps(o));
    // parenting off: no parent is passed (scene root, Q1); selection as input; one name over all inputs
    A.select([o, o2]); const c = run('CreateTextureProj', { ProjectionName: 'MyProj', Parenting: false });
    r.ret3 = c.v; r.unparented = TP.getTextureUVDomains([o2]).map(s => s.parentObj?.name); r.o2props = names(uvProps(o2)); r.oProps3 = names(uvProps(o));
    // polygon cluster input: the support is parented to the owning object
    const o3 = cube('ctp3'); A.select([]); const d = run('CreateTextureProj', { InputObjs: [`${o3.name}.poly[0,1]`], ProjectionName: 'OnPoly' });
    r.polyErr = d.err ?? null; r.polyParent = TP.getTextureUVDomains([o3]).map(s => s.parentObj?.name); r.polyProps = names(uvProps(o3));
    out.ctp = r; out.ctpNames = [o.name, o2.name, o3.name];
  }

  // ---- CreateSubprojection
  {
    const r = {};
    const mk = (name) => { const o = cube(name); A.select([]); A.run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'P' }); return { o, p: uvProps(o)[0] }; };
    const { o, p } = mk('csp');
    A.select([]);
    r.noInput = run('CreateSubprojection', { TextureProjection: p }); r.noInput = { log: r.noInput.log, v: r.noInput.v, err: r.noInput.err ?? null };
    const np = run('CreateSubprojection', { InputObjs: [sub(o, 'poly', [0])] }); r.noProp = { log: np.log, err: np.err ?? null };
    const bt = run('CreateSubprojection', { InputObjs: [sub(o, 'poly', [0])], TextureProjection: p, Type: 4 }); r.badType = { log: bt.log, err: bt.err ?? null };
    r.nothingCreated = [TP.getTextureUVDomains([o]).length, (p.subprojections ?? []).length];
    // planar sub-projection of one polygon
    const item = sub(o, 'poly', [0]);
    const a = run('CreateSubprojection', { InputObjs: [item], TextureProjection: p, SupportName: 'SubSup' });
    r.err = a.err ?? null; r.keys = outKeys(a.v); const sup = a.v?.['3DObjTexture'];
    r.support = [sup?.name, sup?.type, sup?.parentObj?.name]; r.subs = (p.subprojections ?? []).length; r.supports = TP.getTextureUVDomains([o]).length;
    r.polyBounds = bounds(o, p, item); r.props = names(uvProps(o));
    // parenting off -> scene root; property by path string; type by registry enum text
    const b = run('CreateSubprojection', { InputObjs: `${o.name}.poly[1]`, TextureProjection: p.fullName, Type: ':siProjCubic:siTxtProjType', Parenting: false });
    r.rootParent = b.v?.['3DObjTexture']?.parentObj?.name ?? null; r.pathErr = b.err ?? null;
    A.undo(); r.afterUndo = [(p.subprojections ?? []).length, TP.getTextureUVDomains([o]).length];
    // MaintainAspect, planar XY, A = 2: the support is scaled by (m/gx, m/gy, m/gz) with gy multiplied by A
    {
      const t1 = mk('aspA'), t2 = mk('aspB');
      const s1 = run('CreateSubprojection', { InputObjs: [sub(t1.o, 'poly', [0, 1, 2])], TextureProjection: t1.p }).v['3DObjTexture'];
      const s2 = run('CreateSubprojection', { InputObjs: [sub(t2.o, 'poly', [0, 1, 2])], TextureProjection: t2.p, MaintainAspect: true, TextureAspectRatio: 2 }).v['3DObjTexture'];
      const g = scl(s1).map(x => x * 2); g[1] *= 2; const m = Math.max(...g); // GeoX/Y/Z = 2
      r.planarAspect = { got: scl(s2), want: scl(s1).map((x, i) => r4(x * m / g[i])) };
    }
    // MaintainAspect, cylindrical / spherical: UVs of the input scaled on the property
    for (const [key, type, A2] of [['cyl', 1, 2], ['sph', 2, 1]]) {
      const t1 = mk(key + 'A'), t2 = mk(key + 'B'); const it1 = sub(t1.o, 'poly', [0, 1, 2, 3, 4, 5]), it2 = sub(t2.o, 'poly', [0, 1, 2, 3, 4, 5]);
      run('CreateSubprojection', { InputObjs: [it1], TextureProjection: t1.p, Type: type });
      const x = run('CreateSubprojection', { InputObjs: [it2], TextureProjection: t2.p, Type: type, MaintainAspect: true, TextureAspectRatio: A2 });
      const b1 = rawBounds(t1.o, t1.p, it1), b2 = rawBounds(t2.o, t2.p, it2);
      r[key] = { err: x.err ?? null, uRatio: r4((b2[2] - b2[0]) / (b1[2] - b1[0])), vRatio: r4((b2[3] - b2[1]) / (b1[3] - b1[1])) };
    }
    // lollipop: accepted, no aspect action, says what is not attested
    { const t = mk('lol'); const x = run('CreateSubprojection', { InputObjs: [sub(t.o, 'poly', [0])], TextureProjection: t.p, Type: 3, MaintainAspect: true }); r.lollipop = { err: x.err ?? null, made: !!x.v?.['3DObjTexture'], log: x.log.filter(l => /not yet attested/.test(l)).length }; }
    // FitToImage: the input's UVs fill the unit square afterwards
    { const t = mk('fit'); const it = sub(t.o, 'poly', [0, 2]); const x = run('CreateSubprojection', { InputObjs: [it], TextureProjection: t.p, Type: 2, FitToImage: true }); r.fitToImage = { err: x.err ?? null, bounds: bounds(t.o, t.p, it) }; }
    out.csp = r; out.cspName = o.name;
  }

  // ---- CameraTextureProj
  {
    const r = {}; const o = cube('cam');
    let camera = [...A.scene.allObjects()].find(x => x.type === 'camera');
    if (!camera && A.commands.has('GetPrimCamera')) { try { A.run('GetPrimCamera', {}); } catch { /* no camera preset */ } camera = [...A.scene.allObjects()].find(x => x.type === 'camera'); }
    r.haveCamera = !!camera;
    A.select([]); const a = run('CameraTextureProj', { InputObjs: [o] });
    r.err = a.err ?? null; r.keys = outKeys(a.v); r.name = a.v?.Name; r.cameraIsObject = !!camera && a.v?.Camera === camera;
    const p = uvProps(o)[0]; r.prop = [p?.name, p?.val('kind'), p?.val('support') === camera?.name, p?.uvInputAction, p?.swim];
    const b = run('CameraTextureProj', { InputObjs: [o], Camera: camera?.name ?? '' }); r.second = [b.v?.Name, names(uvProps(o))];
    // an input that is not a whole 3D object: nothing happens, the arguments come back as passed
    const c = run('CameraTextureProj', { InputObjs: [sub(o, 'poly', [0])], Name: 'N', Camera: '' }); r.component = [c.err ?? null, c.v, uvProps(o).length];
    A.undo(); r.afterUndo = names(uvProps(o));
    out.cam = r;
  }

  // ---- ConnectToTextureProj
  {
    const r = {}; const src = cube('conSrc'); A.select([]); A.run('CreateTextureProj', { InputObjs: [src], ProjectionName: 'ConSup' });
    const sup = TP.getTextureUVDomains([src])[0]; const o = cube('con'); A.select([]);
    const a = run('ConnectToTextureProj', { InputObjs: [o], Name: 'Linked', TextureSupport: sup.name });
    r.err = a.err ?? null; r.keys = outKeys(a.v); r.name = a.v?.Name; r.sameSupport = a.v?.TextureSupport === sup;
    const p = uvProps(o)[0]; r.prop = [p?.name, p?.val('kind'), p?.val('support') === sup.name]; r.domains = TP.getTextureUVDomains([o]).map(s => s === sup);
    const b = run('ConnectToTextureProj', { InputObjs: [o], Name: 'Linked', TextureSupport: sup }); r.unique = b.v?.Name;
    const c = run('ConnectToTextureProj', { InputObjs: [o], Name: 'X' }); r.noSupport = { err: c.err ?? null, v: c.v, log: c.log.filter(l => /not yet attested/.test(l)).length, props: uvProps(o).length };
    out.con = r;
  }

  // ---- CreateTextureSpatial
  {
    const r = {}; const o = cube('spa'); A.select([o]);
    const a = run('CreateTextureSpatial', {}); r.err = a.err ?? null; r.ret = a.v; const p = uvProps(o)[0]; r.prop = [p?.name, p?.val('kind'), p?.val('support')];
    const b = run('CreateTextureSpatial', { InputObjs: [o], Name: 'Geo' }); r.named = b.v; r.props = names(uvProps(o)); r.supports = TP.getTextureUVDomains([o]).length;
    out.spa = r;
  }

  // ---- CreateTextureUVDomain
  {
    const r = {}; let surf = null;
    try { surf = A.run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'uvd' }); } catch (e) { r.surfErr = String(e?.message ?? e); }
    r.haveSurface = !!surf && surf.primitive?.type === 'surfmsh';
    if (surf) {
      A.select([]); const a = run('CreateTextureUVDomain', { InputObjs: [surf], SupportName: 'Dom' });
      r.err = a.err ?? null; r.ret = a.v; const p = uvProps(surf)[0]; const sup = TP.getTextureUVDomains([surf])[0];
      r.prop = [p?.name, p?.val('kind')]; r.support = [sup?.name, sup?.type, sup?.parentObj === surf, sup?.preset, sup?.visible];
      const b = run('CreateTextureUVDomain', { InputObjs: [surf], SupportName: 'S2', PropertyName: 'P2' }); r.both = b.v; r.props = names(uvProps(surf));
      const c = run('CreateTextureUVDomain', { InputObjs: [surf] }); r.empty = c.v; r.count = uvProps(surf).length;
    }
    const o = cube('uvdMesh'); const d = run('CreateTextureUVDomain', { InputObjs: [o], SupportName: 'No' }); r.mesh = { err: d.err ?? null, v: d.v, props: uvProps(o).length, log: d.log.filter(l => /not yet attested/.test(l)).length };
    out.uvd = r;
  }

  // ---- FitSubcomponentUVsToImage
  {
    const r = {};
    // a cube whose polygon 0 is a known island: u 0.2..0.6, v 0.1..0.3; every other sample at (0.9, 0.9)
    const mk = (name) => {
      const o = cube(name); A.select([]); A.run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'F' }); const p = uvProps(o)[0];
      const m = o.primitive.mesh(); const n = m.polygons.reduce((s, f) => s + f.length, 0); const uv = new Float32Array(n * 2).fill(0.9);
      const corners = [[0.2, 0.1], [0.6, 0.1], [0.6, 0.3], [0.2, 0.3]]; m.polygons[0].forEach((_, i) => { uv[i * 2] = corners[i % 4][0]; uv[i * 2 + 1] = corners[i % 4][1]; });
      p.uvs = uv; return { o, p, item: sub(o, 'poly', [0]) };
    };
    const def = (p) => { const d = TP.projDefOf(p); return ['projtrsu', 'projtrsv', 'projsclu', 'projsclv', 'projrotu', 'projrotv'].map(k => r4(d.val(k))); };
    { const t = mk('fitI'); TP.projDefOf(t.p).set('projrotu', 30); const x = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [t.item] }); r.implicit = { err: x.err ?? null, ret: x.v === undefined, def: def(t.p), uvUntouched: bounds(t.o, t.p, t.item) }; A.undo(); r.implicitUndo = def(t.p); }
    { const t = mk('fitIA'); run('FitSubcomponentUVsToImage', { Properties: t.p.fullName, SubComp: `${t.o.name}.poly[0]`, MaintainAspect: true }); r.implicitAspect = def(t.p); }
    { const t = mk('fitE'); const x = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [t.item], Explicit: true }); r.explicit = { err: x.err ?? null, bounds: bounds(t.o, t.p, t.item), def: def(t.p), others: bounds(t.o, t.p, sub(t.o, 'poly', [1])) }; A.undo(); r.explicitUndo = bounds(t.o, t.p, t.item); }
    { const t = mk('fitEA'); run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [t.item], Explicit: true, MaintainAspect: true }); r.explicitAspect = bounds(t.o, t.p, t.item); }
    // degenerate extent: scaling is not set for an axis whose extent is zero
    { const t = mk('fitD'); const s = sub(t.o, 'sample', [0, 1]); run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [s] }); r.degenerate = def(t.p); }
    // point item: every sample of the point; sample cluster item
    { const t = mk('fitP'); const x = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [sub(t.o, 'pnt', [t.o.primitive.mesh().polygons[0][0]])] }); r.point = { err: x.err ?? null, def: def(t.p) }; }
    // two properties are handled independently
    { const t = mk('fit2'); A.run('CreateTextureProj', { InputObjs: [t.o], ProjectionName: 'G' }); const p2 = uvProps(t.o)[1]; run('FitSubcomponentUVsToImage', { Properties: [t.p, p2], SubComp: [t.item] }); r.two = [def(t.p), def(p2).slice(0, 2).every(Number.isFinite)]; }
    // invalid items
    { const t = mk('fitX'), u = mk('fitY'); const x = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [u.item] }); r.otherObject = { threw: !!x.err, number: x.number, log: x.log.filter(l => /^info:BindProp: '.*' is an invalid argument: expecting subcomponents of '.*'$/.test(l)).length, def: def(t.p) };
      const y = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [t.o] }); r.wholeObject = { threw: !!y.err, number: y.number, log: y.log.filter(l => /^info:BindProp: /.test(l)).length }; }
    // nothing found: skipped
    { const t = mk('fitN'); const x = run('FitSubcomponentUVsToImage', { Properties: [t.p], SubComp: [sub(t.o, 'poly', [])] }); r.none = { err: x.err ?? null, def: def(t.p) }; }
    out.fit = r;
  }

  // ---- ModifyUVSetByContourStretching
  {
    const r = {}; const o = cube('cst'); A.select([]); A.run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'C' }); const p = uvProps(o)[0];
    const bad = run('ModifyUVSetByContourStretching', { InputObjs: [sub(o, 'poly', [0]), o], TextureProjection: p }); r.badInput = { err: bad.err ?? null, v: bad.v ?? null, log: bad.log };
    const noUV = run('ModifyUVSetByContourStretching', { InputObjs: [sub(o, 'poly', [0])], TextureProjection: o }); r.noUV = { err: noUV.err ?? null, v: noUV.v ?? null, log: noUV.log };
    r.clustersBefore = o.clusters.filter(c => /^ContourStretch/.test(c.name)).length;
    const before = bounds(o, p);
    A.run('SetConstructionMode', { Mode: 'animation' });
    const a = run('ModifyUVSetByContourStretching', { InputObjs: [sub(o, 'poly', [0, 1]), `${o.name}.poly[2]`], TextureProjection: p, ContourStretchingMethod: 3, MaintainAspect: true, CornerPoints: [sub(o, 'pnt', [0, 1, 2, 3])] });
    r.modeAfter = TP.makeContourStretchingOp('probe').region; // a new operator takes the current construction mode
    r.err = a.err ?? null; const ops = a.v ?? [];
    r.isArray = Array.isArray(a.v); r.count = ops.length; r.opNames = ops.map(x => x.name); r.params = ops.map(x => [x.val('method'), x.val('maintainaspect')]);
    r.ports = ops.map(x => x.ports.map(g => g.map(n => n.name)));
    r.portKinds = ops.map(x => [x.ports[0][0]?.compKind, x.ports[1][0] === p, x.ports[2][0]?.compKind ?? null]);
    r.clusters = o.clusters.filter(c => /^ContourStretch/.test(c.name)).map(c => [c.name, c.compKind, c.elements.size, c.mode]);
    r.onProperty = TP.uvOperatorsOf(p).length; r.regions = ops.map(x => x.region);
    r.uvUnchanged = JSON.stringify(bounds(o, p)) === JSON.stringify(before); r.attestedLog = a.log.filter(l => /not yet attested/.test(l)).length;
    A.undo(); r.afterUndo = [TP.uvOperatorsOf(p).length, o.clusters.filter(c => /^ContourStretch/.test(c.name)).length];
    // existing clusters are used as they are
    A.select([]); A.selMode = 'polygon'; A.selectComponents(o, 'polygon', [4], 'replace'); const cl = A.run('CreateCluster', { Name: 'MyPolys' }); A.setSelMode('object'); A.select([]);
    const c = run('ModifyUVSetByContourStretching', { InputObjs: [cl], TextureProjection: p }); r.cluster = { err: c.err ?? null, port0: c.v?.[0]?.ports[0][0] === cl, emptyCorners: c.v?.[0]?.ports[2].length, params: [c.v?.[0]?.val('method'), c.v?.[0]?.val('maintainaspect')], newClusters: o.clusters.filter(x => /^ContourStretch/.test(x.name)).length };
    out.cst = r;
    // interactive entry: corners given -> no picking; operators come back through onDone
    {
      const i = {}; let done = null;
      TP.interactiveContourStretching({ InputObjs: [sub(o, 'poly', [0])], TextureProjection: p, CornerPoints: [sub(o, 'pnt', [0, 1])] }, (x) => { done = x; });
      await tick(); i.given = { tool: A.activeTool?.name ?? null, ops: done?.operators.length ?? null, corners: done?.CornerPoints.length ?? null };
      // corners missing -> a pick session per item; left click adds, Ctrl+click removes, finish ends the item
      done = null; A.select([o]); const selBefore = names(A.selection);
      TP.interactiveContourStretching({ InputObjs: [sub(o, 'poly', [0]), sub(o, 'poly', [1])], TextureProjection: p }, (x) => { done = x; });
      i.tool1 = [A.activeTool?.name ?? null, A.activeTool?.pickKind ?? null, /Pick Corner Point/.test(A.activeTool?.prompt ?? ''), /Unpick Corner Point/.test(A.activeTool?.prompt ?? '')];
      i.compSel = [A.compSel?.kind, [...(A.compSel?.polygons ?? [])]];
      const click = (v, ctrl = false) => A.activeTool.onClick([0, 0, 0], { obj: o, kind: 'point', item: v, worldPoint: [0, 0, 0] }, { shift: false, ctrl });
      click(0); click(1); click(2); click(2, true); A.activeTool.onFinish(); await tick();
      i.tool2 = [A.activeTool?.name ?? null, [...(A.compSel?.polygons ?? [])]];
      click(5); A.activeTool.onFinish(); await tick();
      i.done = { tool: A.activeTool?.name ?? null, ops: done?.operators.length ?? null, corners: done?.CornerPoints.map(c => c.elements) ?? null, cornerPorts: done?.operators.map(x => [...x.ports[2][0].elements]) ?? null, selection: JSON.stringify(names(A.selection)) === JSON.stringify(selBefore) };
      // the very first pick of an item cancelled: picking stops for the remaining items
      done = null; TP.interactiveContourStretching({ InputObjs: [sub(o, 'poly', [0]), sub(o, 'poly', [1])], TextureProjection: p }, (x) => { done = x; });
      A.activeTool.onCancel(); await tick();
      i.cancel = { tool: A.activeTool?.name ?? null, corners: done?.CornerPoints.length ?? null, ops: done?.operators.map(x => x.ports[2].length) ?? null };
      out.cstInteractive = i;
    }
    A.run('SetConstructionMode', { Mode: 'modeling' });
  }

  // ---- visibility of texture supports
  {
    const r = {}; const o = cube('vis'); A.select([]);
    A.run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'V1' }); A.run('CreateTextureProj', { InputObjs: [o], ProjectionName: 'V2' });
    const sups = TP.getTextureUVDomains([o]); r.count = sups.length;
    const view = () => sups.map(s => s.property('visibility').val('viewvis')); const rend = () => sups.map(s => s.property('visibility').val('rendvis'));
    const step = (n, a) => { const x = run(n, { InputObjs: [o], ...a }); return [x.err ?? null, x.v === undefined, view()]; };
    r.hide = step('HideTextureUVDomains', {}); r.rendAfterHide = rend(); r.objectVisible = o.property('visibility').val('viewvis');
    A.undo(); r.hideUndo = view(); A.redo();
    r.unhide = step('UnhideTextureUVDomains', {});
    r.toggle1 = step('ToggleVisibilityOfTextureUVDomains', {});
    sups[0].property('visibility').set('viewvis', true);
    r.toggleMixed = step('ToggleVisibilityOfTextureUVDomains', {});
    r.hideWithType1 = step('HideTextureUVDomains', { Type: 1 });
    r.unhideWithTypeMinus1 = step('UnhideTextureUVDomains', { Type: -1 });
    A.select([o]); r.fromSelection = (() => { const x = run('UnhideTextureUVDomains', {}); return [x.err ?? null, view()]; })();
    out.vis = r;
  }

  // ---- SetCheckerboardMode
  {
    const r = {}; const editors = () => { const all = []; const walk = (vs) => { for (const v of vs) { if (v.type === 'Texture Editor') all.push(v); walk(v.views); } }; walk(TP.views()); return all; };
    r.before = editors().length;
    window.__openView?.('Texture Editor'); await tick();
    const eds = editors(); r.open = eds.length >= 1; r.classId = eds[0]?.classId;
    const attr = () => editors().map(v => v.attributes.checkerboard ?? null); const dom = () => editors().map(v => v.el?.dataset.checkerboard ?? null);
    const others = () => TP.views().filter(v => v.type !== 'Texture Editor').some(v => 'checkerboard' in v.attributes);
    const undo0 = A.undoStack.length;
    const a = run('SetCheckerboardMode', { Checkerboard: true }); r.on = [a.err ?? null, a.v === undefined, attr(), dom()];
    const b = run('SetCheckerboardMode', {}); r.off = [b.err ?? null, attr()];
    run('SetCheckerboardMode', { Checkerboard: true }); run('SetCheckerboardMode', { Checkerboard: 1 }); r.notExactlyTrue = attr();
    r.othersTouched = others(); r.undoEntries = A.undoStack.length - undo0;
    // an explicit view: only a Texture Editor view takes the attribute; anything else is ignored silently
    const other = TP.views().find(v => v.type !== 'Texture Editor');
    const c = run('SetCheckerboardMode', { Checkerboard: true, TextureEditor: other }); r.otherView = [c.err ?? null, other ? other.attributes.checkerboard ?? null : null, attr()];
    const d = run('SetCheckerboardMode', { Checkerboard: true, TextureEditor: 'not a view' }); r.notAView = [d.err ?? null, attr()];
    const e = run('SetCheckerboardMode', { Checkerboard: true, TextureEditor: eds[0] }); r.explicit = [e.err ?? null, attr()[0]];
    r.haveOther = !!other;
    out.chk = r;
  }

  // ---- UI still redraws
  A.events.emit('scene'); await tick(); out.ui = { ok: true };
  return out;
}, { NAMES });
await browser.close();

let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const hasLog = (label, log, re) => { checks++; const ok = Array.isArray(log) && log.some(l => re.test(l)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want a log line ${re}\n       got  ${JSON.stringify(log)}`); } };

// 1. registration
for (const n of NAMES) {
  eq(`${n}: registered with the registry's arguments`, got.reg[n], registry[n]);
  eq(`${n}: display name is a registry entry`, registryLabels[n].includes(got.labels[n]), true);
}
eq('categories (Texturing|Rendering; SetCheckerboardMode Texturing; CreateTextureSpatial none)', [got.categories.CreateTextureProj, got.categories.SetCheckerboardMode, got.categories.CreateTextureSpatial], ['Texturing|Rendering', 'Texturing', '']);

// 2. default arguments
for (const n of NAMES) eq(`${n}: runs with default arguments (no throw)`, got.defaults[n].err, null);
hasLog('CreateSubprojection defaults: asks for a UV property', got.defaults.CreateSubprojection.log, /^error:Please select a UV property to create the subprojection on$/);
hasLog('ModifyUVSetByContourStretching defaults: whole object is not a mesh component selection', got.defaults.ModifyUVSetByContourStretching.log, /^error:Some of the input objects are invalid\.  Need mesh component selections\.$/);
eq('defaults: output-argument lists', { ctp: got.defaults.CreateTextureProj.keys, cam: got.defaults.CameraTextureProj.keys, con: got.defaults.ConnectToTextureProj.keys, spa: got.defaults.CreateTextureSpatial.keys, uvd: got.defaults.CreateTextureUVDomain.keys, sub: got.defaults.CreateSubprojection.keys },
  { ctp: ['ProjectionName'], cam: ['Name', 'Camera'], con: ['Name', 'TextureSupport'], spa: ['Name'], uvd: ['SupportName', 'PropertyName'], sub: ['3DObjTexture'] });
eq('defaults: commands without output arguments return nothing', ['FitSubcomponentUVsToImage', 'HideTextureUVDomains', 'UnhideTextureUVDomains', 'ToggleVisibilityOfTextureUVDomains', 'SetCheckerboardMode'].map(n => got.defaults[n].keys), [null, null, null, null, null]);

// 3. CreateTextureProj
const T = got.ctp; const [ctpName, ctp2Name, ctp3Name] = got.ctpNames;
eq('CreateTextureProj: no error; ProjectionName comes back', [T.err, T.ret], [null, { ProjectionName: 'MyProj' }]);
eq('CreateTextureProj: ProjectionType / ProjectionPlane ignored - planar XY on the sample cluster', T.prop, ['MyProj', 'Planar XY', 'sample']);
eq('CreateTextureProj: support named after the projection name as passed, parented to the input', T.support, ['MyProj', 'texturesupport', ctpName, 'Planar XY']);
eq('CreateTextureProj: the projection fills the unit square', T.bounds, [0, 0, 1, 1]);
eq('CreateTextureProj: selection unchanged', T.selection, [ctp2Name]);
eq('CreateTextureProj: a name in use is made unique and returned', [T.ret2, T.props2], [{ ProjectionName: 'MyProj1' }, ['MyProj', 'MyProj1']]);
eq('CreateTextureProj: undo / redo', [T.afterUndo, T.afterRedo], [[['MyProj'], 1], ['MyProj', 'MyProj1']]);
eq('CreateTextureProj: selection as input, one unique name over all inputs', [T.ret3, T.o2props, T.oProps3], [{ ProjectionName: 'MyProj2' }, ['MyProj2'], ['MyProj', 'MyProj1', 'MyProj2']]);
eq('CreateTextureProj: Parenting off - support under the scene root (inferred, Q1)', T.unparented, ['Scene_Root']);
eq('CreateTextureProj: polygon item - support parented to the owning object', [T.polyErr, T.polyParent, T.polyProps], [null, [ctp3Name], ['OnPoly']]);

// 4. CreateSubprojection
const S = got.csp;
eq('CreateSubprojection: no input', S.noInput, { log: ['error:Please select items to project'], v: { '3DObjTexture': null }, err: null });
eq('CreateSubprojection: no UV property', S.noProp, { log: ['error:Please select a UV property to create the subprojection on'], err: null });
eq('CreateSubprojection: unsupported type (spatial)', S.badType, { log: ['error:Subprojection type 4 not supported.'], err: null });
eq('CreateSubprojection: the checks create nothing', S.nothingCreated, [1, 0]);
eq('CreateSubprojection: support is the output argument, parented to the first input', [S.err, S.keys, S.support], [null, ['3DObjTexture'], ['SubSup', 'texturesupport', got.cspName]]);
eq('CreateSubprojection: added to the existing property (no new property, one more support)', [S.subs, S.supports, S.props], [1, 2, ['P']]);
eq('CreateSubprojection: best fit - the polygon fills the unit square', S.polyBounds, [0, 0, 1, 1]);
eq('CreateSubprojection: Parenting off - scene root; property by path, enum by registry text', [S.pathErr, S.rootParent], [null, 'Scene_Root']);
eq('CreateSubprojection: undo', S.afterUndo, [1, 2]);
eq('CreateSubprojection: MaintainAspect planar XY, A=2 - support scaled by (m/gx, m/(gy*A), m/gz)', S.planarAspect.got, S.planarAspect.want);
eq('CreateSubprojection: MaintainAspect cylindrical, A=2 on a cube - V scaled by 2/pi (su=pi, sv=2 normalised)', S.cyl, { err: null, uRatio: 1, vRatio: Math.round(2 / 3.1415926 * 1e4) / 1e4 });
eq('CreateSubprojection: MaintainAspect spherical, A=1 - V scaled by 0.5', S.sph, { err: null, uRatio: 1, vRatio: 0.5 });
eq('CreateSubprojection: lollipop accepted, mapping "not yet attested" (Q4)', S.lollipop, { err: null, made: true, log: 1 });
eq('CreateSubprojection: FitToImage - the input fills the unit square', S.fitToImage, { err: null, bounds: [0, 0, 1, 1] });

// 5. CameraTextureProj
const C = got.cam;
eq('CameraTextureProj: a camera is available', C.haveCamera, true);
eq('CameraTextureProj: Name and Camera come back', [C.err, C.keys, C.name, C.cameraIsObject], [null, ['Name', 'Camera'], 'Texture_Projection', true]);
eq('CameraTextureProj: camera projection that swims (action 0)', C.prop, ['Texture_Projection', 'Camera Projection', true, 0, true]);
eq('CameraTextureProj: unique name on a second call', C.second, ['Texture_Projection1', ['Texture_Projection', 'Texture_Projection1']]);
eq('CameraTextureProj: component input - nothing happens, arguments as passed', C.component, [null, { Name: 'N', Camera: '' }, 2]);
eq('CameraTextureProj: undo', C.afterUndo, ['Texture_Projection']);

// 6. ConnectToTextureProj
const K = got.con;
eq('ConnectToTextureProj: Name and TextureSupport come back', [K.err, K.keys, K.name, K.sameSupport], [null, ['Name', 'TextureSupport'], 'Linked', true]);
eq('ConnectToTextureProj: projection through the existing support, no new support', [K.prop, K.domains], [['Linked', 'Planar XY', true], [true]]);
eq('ConnectToTextureProj: unique name on a second call', K.unique, 'Linked1');
eq('ConnectToTextureProj: no support - arguments as passed, says "not yet attested" (Q4)', K.noSupport, { err: null, v: { Name: 'X', TextureSupport: '' }, log: 1, props: 2 });

// 7. CreateTextureSpatial
const P = got.spa;
eq('CreateTextureSpatial: Name comes back; spatial projection without a support', [P.err, P.ret, P.prop], [null, { Name: 'Texture_Projection' }, ['Texture_Projection', 'Spatial', '']]);
eq('CreateTextureSpatial: given name', [P.named, P.props, P.supports], [{ Name: 'Geo' }, ['Texture_Projection', 'Geo'], 0]);

// 8. CreateTextureUVDomain
const U = got.uvd;
eq('CreateTextureUVDomain: a NURBS surface is available', U.haveSurface, true);
eq('CreateTextureUVDomain: empty PropertyName takes SupportName; names returned as passed', [U.err, U.ret], [null, { SupportName: 'Dom', PropertyName: 'Dom' }]);
eq('CreateTextureUVDomain: UV property and a visible NurbsTextureCtrl support on the surface', [U.prop, U.support], [['Dom', 'UV'], ['Dom', 'texturesupport', true, 'NurbsTextureCtrl', true]]);
eq('CreateTextureUVDomain: both names given / none given', [U.both, U.props, U.empty, U.count], [{ SupportName: 'S2', PropertyName: 'P2' }, ['Dom', 'P2'], { SupportName: '', PropertyName: '' }, 3]);
eq('CreateTextureUVDomain: polygon mesh skipped, says "not yet attested" (Q4)', U.mesh, { err: null, v: { SupportName: 'No', PropertyName: 'No' }, props: 0, log: 1 });

// 9. FitSubcomponentUVsToImage
const F = got.fit;
eq('Fit implicit: projdef translation = min, scaling = extent, rotation reset; UVs untouched; no return value', F.implicit, { err: null, ret: true, def: [0.2, 0.1, 0.4, 0.2, 0, 0], uvUntouched: [0.2, 0.1, 0.6, 0.3] });
eq('Fit implicit: undo', F.implicitUndo, [0, 0, 1, 1, 30, 0]);
eq('Fit implicit + MaintainAspect: both scalings are the larger extent', F.implicitAspect, [0.2, 0.1, 0.4, 0.4, 0, 0]);
eq('Fit explicit: the island fills the unit square, projdef untouched, other samples untouched', F.explicit, { err: null, bounds: [0, 0, 1, 1], def: [0, 0, 1, 1, 0, 0], others: [0.9, 0.9, 0.9, 0.9] });
eq('Fit explicit: undo', F.explicitUndo, [0.2, 0.1, 0.6, 0.3]);
eq('Fit explicit + MaintainAspect: uniform scale, centred on the short axis', F.explicitAspect, [0, 0.25, 1, 0.75]);
eq('Fit implicit: zero extent - that scaling is not set', F.degenerate, [0.2, 0.1, 0.4, 1, 0, 0]);
eq('Fit: point item names every sample of the point', [F.point.err, F.point.def.slice(0, 2)], [null, [0.2, 0.1]]);
eq('Fit: several properties are handled independently', F.two, [[0.2, 0.1, 0.4, 0.2, 0, 0], true]);
eq('Fit: component of another object - BindProp line (info), fails with siErrCancelled, nothing kept', F.otherObject, { threw: true, number: 0x4C7, log: 1, def: [0, 0, 1, 1, 0, 0] });
eq('Fit: whole object is not a sub-component', F.wholeObject, { threw: true, number: 0x4C7, log: 1 });
eq('Fit: no sample found - property skipped', F.none, { err: null, def: [0, 0, 1, 1, 0, 0] });

// 10. ModifyUVSetByContourStretching
const M = got.cst;
eq('ContourStretching: non-polygon input', M.badInput, { err: null, v: null, log: ['error:Some of the input objects are invalid.  Need mesh component selections.'] });
eq('ContourStretching: not a UV property', M.noUV, { err: null, v: null, log: ['error:Invalid UV texture coordinate'] });
eq('ContourStretching: the checks create nothing', M.clustersBefore, 0);
eq('ContourStretching: returns one operator per polygon item', [M.err, M.isArray, M.count, M.opNames], [null, true, 2, ['PolyUVContourStretchingOp', 'PolyUVContourStretchingOp']]);
eq('ContourStretching: method / maintainaspect from the arguments', M.params, [[3, true], [3, true]]);
eq('ContourStretching: port groups - polygon cluster; UV property; corner cluster (empty without corners)', M.portKinds, [['poly', true, 'pnt'], ['poly', true, null]]);
eq('ContourStretching: ContourStretch clusters of the item type, mode 2', M.clusters, [['ContourStretch', 'poly', 2, 2], ['ContourStretch1', 'pnt', 4, 2], ['ContourStretch2', 'poly', 1, 2]]);
eq('ContourStretching: operators sit on the UV property, applied in Modeling mode', [M.onProperty, M.regions], [2, ['modeling', 'modeling']]);
eq('ContourStretching: UV solve "not yet attested" (Q3) - UVs unchanged, says so', [M.uvUnchanged, M.attestedLog], [true, 1]);
eq('ContourStretching: construction mode restored afterwards', M.modeAfter, 'animation');
eq('ContourStretching: undo', M.afterUndo, [0, 0]);
eq('ContourStretching: an existing cluster is used as it is; defaults method 0 / maintainaspect false', M.cluster, { err: null, port0: true, emptyCorners: 0, params: [0, false], newClusters: 0 });
const I = got.cstInteractive;
eq('Interactive entry: corners given - no pick session', I.given, { tool: null, ops: 1, corners: 1 });
eq('Interactive entry: point pick session with both prompts, the item\'s polygons selected', [I.tool1, I.compSel], [['Pick Corner Point', 'point', true, true], ['polygon', [0]]]);
eq('Interactive entry: next item after the session ends', I.tool2, ['Pick Corner Point', [1]]);
eq('Interactive entry: picked (minus unpicked) points become the corners; selection restored', I.done, { tool: null, ops: 2, corners: [[0, 1], [5]], cornerPorts: [[0, 1], [5]], selection: true });
eq('Interactive entry: first pick cancelled - picking stops, operators without corners', I.cancel, { tool: null, corners: 0, ops: [0, 0] });

// 11. visibility
const V = got.vis;
eq('visibility: an object with two supports', V.count, 2);
eq('HideTextureUVDomains: view visibility off, nothing returned', V.hide, [null, true, [false, false]]);
eq('HideTextureUVDomains: render visibility and the object itself untouched', [V.rendAfterHide, V.objectVisible], [[true, true], true]);
eq('HideTextureUVDomains: undo', V.hideUndo, [true, true]);
eq('UnhideTextureUVDomains: view visibility on', V.unhide, [null, true, [true, true]]);
eq('ToggleVisibilityOfTextureUVDomains: toggles', V.toggle1, [null, true, [false, false]]);
eq('ToggleVisibilityOfTextureUVDomains: each support toggles on its own', V.toggleMixed, [null, true, [false, true]]);
eq('the Type value, not the command name, decides (Hide with 1 shows)', V.hideWithType1, [null, true, [true, true]]);
eq('the Type value, not the command name, decides (Unhide with -1 toggles)', V.unhideWithTypeMinus1, [null, true, [false, false]]);
eq('visibility: input from the selection', V.fromSelection, [null, [true, true]]);

// 12. SetCheckerboardMode
const H = got.chk;
eq('SetCheckerboardMode: a Texture Editor view (class id 134) is open', [H.open, H.classId], [true, 134]);
eq('SetCheckerboardMode true: attribute "True" on every Texture Editor view', [H.on[0], H.on[1], [...new Set(H.on[2])], [...new Set(H.on[3])]], [null, true, ['True'], ['True']]);
eq('SetCheckerboardMode default: attribute "False"', [H.off[0], [...new Set(H.off[1])]], [null, ['False']]);
eq('SetCheckerboardMode: a value that is not exactly true gives "False"', [...new Set(H.notExactlyTrue)], ['False']);
eq('SetCheckerboardMode: other views untouched, nothing on the undo stack', [H.othersTouched, H.undoEntries], [false, 0]);
eq('SetCheckerboardMode: another view type is available for the explicit case', H.haveOther, true);
eq('SetCheckerboardMode: explicit view of another type ignored silently', [H.otherView[0], H.otherView[1], [...new Set(H.otherView[2])]], [null, null, ['False']]);
eq('SetCheckerboardMode: a non-view argument ignored silently', [H.notAView[0], [...new Set(H.notAView[1])]], [null, ['False']]);
eq('SetCheckerboardMode: explicit Texture Editor view', H.explicit, [null, 'True']);

eq('UI: scene redraws', got.ui, { ok: true });
eq('no page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-12a texture projection commands: ${fails.length} of ${checks} checks`);
  process.exit(1);
}
console.log(`OK CMD-12a texture projection commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   wired from the contract: all 12 commands; the texture tasks behind them are stand-ins (Q4)');
console.log('   log "not yet attested": lollipop mapping, world-relative fitting, ConnectToTextureProj without a support, UV-domain support on a non-surface (Q4); UV solve of the contour stretching operator (Q3)');
