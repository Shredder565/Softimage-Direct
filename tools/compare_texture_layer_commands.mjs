// CMD-01c: texture layer and shader blend-in commands (27) on the command bus.
// Checked against the contract in docs/ghidra/cmd-01c-texture-layers.md (every "Golden should check" line) and
// the registry dump data/commands_full.json. There is no XSIBATCH golden for this row yet (note Q2), so this is
// a contract check, not a golden compare.
// Needs `vite preview` (SI_URL, default http://localhost:4173/?demo). Usage: node tools/compare_texture_layer_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = [
  'AddTextureLayer', 'AddTextureLayerPorts', 'MoveTextureLayers', 'RemoveTextureLayers',
  'AddPresetTextureLayer', 'AddImageTextureLayer', 'AddClipTextureLayer',
  'BlendInPresets', 'BlendInPresetsInsp', 'BlendInPresetsWithPorts', 'BlendInPresetsWithPortsInsp', 'SIConnectShaderWithBlendsInsp',
  'BlendInTextureLayers', 'BlendInTextureLayersInsp', 'BlendInTextureLayersWithPorts', 'BlendInTextureLayersWithPortsInsp',
  'BlendClipsInTextureLayers', 'BlendClipsInTextureLayersInsp', 'BlendClipsInTextureLayersWithPorts', 'BlendClipsInTextureLayersWithPortsInsp',
  'InsertShader', 'SIApplyShaderToCnxPoint', 'SIApplyShaderToCnxPoint2', 'SIConnectShaderToCnxPoint', 'UIApplyShaderToCnxPoints',
  'Texture Pop-up Menu', 'Modify Texture Pop-up Menu',
];
const all = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/commands_full.json'), 'utf8'));
const registry = NAMES.map(n => {
  const c = all.find(x => (x.scripting_name || x.name) === n);
  if (!c) { console.error(`registry has no command ${n}`); process.exit(2); }
  return { key: n, label: c.name, category: c.category ?? '', description: c.description, returns: !!c.return_value, args: c.args.map(a => ({ name: a.name, default: a.default === undefined ? null : a.default })) };
});

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);

const got = await page.evaluate(({ registry }) => {
  const A = window.Application; const T = A.textureLayers;
  const out = {};
  const nm = n => n == null ? null : n.name;
  const names = l => [...l].map(nm);
  const src = (owner, name) => T.getSource({ owner, name });
  const ls = c => names(T.layersOf(c));
  const logFrom = i => A.log.slice(i).filter(l => l.kind !== 'cmd').map(l => `${l.kind}|${l.text}`);
  const run = (name, args) => { const i = A.log.length; try { const v = A.run(name, args ?? {}); return { v, log: logFrom(i) }; } catch (e) { return { err: String(e?.message ?? e), nya: e?.notYetAttested === true, log: logFrom(i) }; } };
  const kind = v => v === undefined ? 'undefined' : v === null ? 'null' : Array.isArray(v) ? `array(${v.length})` : v instanceof T.TextureLayer ? 'TextureLayer' : v?.kind === 'shader' ? 'Shader' : typeof v;
  const fresh = (objs = ['Sphere']) => {
    A.run('NewScene'); A.Interactive = false; A.autoInspect = false;
    // a new scene already holds the default sphere (it inherits Scene_Material, a Phong); other objects are created
    return objs.map(o => A.scene.find(o.toLowerCase()) ?? A.run('CreatePrim', { PresetObj: o, GeometryType: 'MeshSurface' }) ?? A.scene.find(o.toLowerCase()));
  };
  /** objects with their own local Phong material */
  const withMats = (objs = ['Sphere']) => fresh(objs).map(o => { A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [o] }); return { o, m: o.material, ph: o.material.surface }; });

  // ---------------------------------------------------------------- 1. registration
  out.registration = registry.map(c => { const d = A.commands.get(c.key); return { key: c.key, found: !!d, label: d?.label, category: d?.category ?? '', description: d?.description, args: d?.args.map(a => ({ name: a.name, default: a.default === undefined ? null : a.default })) }; });

  // ---------------------------------------------------------------- 2. every command with default arguments (demo scene, sphere selected)
  A.Interactive = false; A.autoInspect = false;
  { const sp = A.scene.find('sphere'); if (sp) A.select([sp]); }
  out.defaults = {};
  for (const c of registry) { const r = run(c.key); out.defaults[c.key] = { err: r.err ?? null, kind: r.err ? null : kind(r.v), log: r.log }; }

  // ---------------------------------------------------------------- 3. A1 AddTextureLayer
  {
    const [{ m, ph }, { m: m2, ph: ph2 }] = withMats(['Sphere', 'Cube']);
    const r = {};
    const a = A.run('AddTextureLayer', { InputObjs: [m] });
    r.defaultName = a.name; r.isLayer = a instanceof T.TextureLayer; r.classId = a.classId; r.className = a.className; r.type = a.type;
    const bL = A.run('AddTextureLayer', { InputObjs: [m] }), c = A.run('AddTextureLayer', { InputObjs: [m], Name: 'c' });
    r.three = ls(m);
    A.run('AddTextureLayer', { InputObjs: [m], Name: 'p1' }); r.lastDefault = ls(m);
    A.run('AddTextureLayer', { InputObjs: [m], Name: 'p2', After: false }); r.first = ls(m);
    A.run('AddTextureLayer', { InputObjs: [m], Name: 'p3', After: true, Reference: bL }); r.afterRef = ls(m);
    A.run('AddTextureLayer', { InputObjs: [m], Name: 'p4', After: false, Reference: bL }); r.beforeRef = ls(m);
    // undo / redo of the last add
    A.undo(); r.afterUndo = ls(m); A.redo(); r.afterRedo = ls(m);
    // one layer added to two materials
    const sh = A.run('AddTextureLayer', { InputObjs: [m, m2], Name: 'shared' });
    r.sharedIsOne = sh instanceof T.TextureLayer; r.sharedContainers = names(sh.containers); r.sharedInM = ls(m).includes('shared'); r.m2 = ls(m2);
    // the layer added twice to the same container
    const before = ls(m); const dbl = run('AddTextureLayer', { Object: a, InputObjs: [m] });
    r.doubleErr = dbl.err; r.doubleUnchanged = JSON.stringify(ls(m)) === JSON.stringify(before);
    // existing layer by path string, into the second material only
    const byPath = run('AddTextureLayer', { Object: `${m.name}.c`, InputObjs: `${m2.name}`, After: false });
    r.byPathErr = byPath.err ?? null; r.m2AfterPath = ls(m2); r.sameObject = byPath.v === c;
    // Reference that is not in the target container: before the next layer of the reference's merged order that is in it
    A.run('AddTextureLayer', { InputObjs: [m2], Name: 'q', After: true, Reference: `${m.name}.p1` }); r.refElsewhere = ls(m2);
    // a non-container element is skipped silently
    const skip = run('AddTextureLayer', { InputObjs: [A.scene.find('sphere')], Name: 'nowhere' }); r.skipErr = skip.err ?? null; r.skipContainers = skip.v ? skip.v.containers.length : -1;
    // suitability (inferred, Q5): a layer already on shaders of two materials takes no further container
    const span = A.run('AddTextureLayer', { InputObjs: [ph, ph2], Name: 'span' }); r.spanContainers = names(span.containers);
    const third = run('AddTextureLayer', { Object: span, InputObjs: [m] }); r.err72 = third.err; r.spanAfter = names(span.containers);
    // contradicting orders (inferred): message 69, nothing left behind
    const s1 = A.run('AddTextureLayer', { InputObjs: [ph], Name: 's1' }), s2 = A.run('AddTextureLayer', { InputObjs: [ph], Name: 's2' });
    r.phBefore = ls(ph);
    A.run('AddTextureLayer', { Object: s2, InputObjs: [ph2] }); // ph2: span, s2
    const cyc = run('AddTextureLayer', { Object: s1, InputObjs: [ph2], After: true, Reference: s2 }); // would put s1 after s2 in ph2, against ph
    r.err69 = cyc.err; r.ph2AfterCycle = ls(ph2); r.s1Containers = names(s1.containers);
    // locked container
    ph.locked = true; r.lockErr = run('AddTextureLayer', { InputObjs: [ph], Name: 'no' }).err; ph.locked = false;
    out.A1 = r;
  }

  // ---------------------------------------------------------------- 4. A2 AddTextureLayerPorts
  {
    const [{ o, m, ph }] = withMats(['Sphere']);
    const r = {};
    const L = A.run('AddTextureLayer', { InputObjs: [m], Name: 'L' });
    const res = run('AddTextureLayerPorts', { InputObj: L, InputObjs: [`${o.name}.Material.Phong.ambient`, { owner: ph, name: 'diffuse' }, ph.get('shiny'), `Sources.Materials.DefaultLib.${m.name}.Phong.bump`, `${m.name}.Phong.notrace`,
      `${m.name}.CAV`, `${m.name}.Phong.transparent_samples`] });
    r.err = res.err ?? null; r.count = res.v?.length; r.classIds = res.v?.map(p => p.classId); r.classNames = res.v?.map(p => p.className); r.portNames = res.v?.map(nm);
    r.targets = res.v?.map(p => T.portPath(p.target)); r.warnings = res.log.filter(l => /413/.test(l));
    r.layerInTargetContainer = ls(ph); r.layerContainers = names(L.containers); r.layerPorts = names(L.ports);
    r.onDiffuse = names(T.layerPortsOn({ owner: ph, name: 'diffuse' }));
    // a second port on the same parameter is not rejected at this level (Q7)
    const again = run('AddTextureLayerPorts', { InputObj: L, InputObjs: [{ owner: ph, name: 'diffuse' }] }); r.dupErr = again.err ?? null; r.dupName = again.v?.map(nm); r.onDiffuse2 = T.layerPortsOn({ owner: ph, name: 'diffuse' }).length;
    // a target whose owner is not a layer container: message 70, everything done so far undone
    const n0 = L.ports.length; const bad = run('AddTextureLayerPorts', { InputObj: L, InputObjs: [{ owner: ph, name: 'specular' }, { owner: L, name: 'weight' }] });
    r.err70 = bad.err; r.undone = L.ports.length === n0;
    // the layer joins another container of the same material before the next layer of the merged order
    const img = A.run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: [{ owner: ph, name: 'specular' }] });
    const L2 = A.run('AddTextureLayer', { InputObjs: [ph], Name: 'L2' });
    const other = A.run('AddTextureLayer', { InputObjs: [img, ph], Name: 'other' }); // ph: L, L2, other; img: other
    A.run('AddTextureLayer', { InputObjs: [img], Name: 'last' });                      // img: other, last
    const j = run('AddTextureLayerPorts', { InputObj: L2, InputObjs: [{ owner: img, name: 'alpha_factor' }] });
    r.joinErr = j.err ?? null; r.joinCount = j.v?.length; r.imgLayers = ls(img); void other;
    A.undo(); r.afterUndoImg = ls(img); r.afterUndoPorts = L2.ports.length;
    // (inferred, Q5) a layer that is on the material and on one of its shaders takes no further container
    r.join72 = run('AddTextureLayerPorts', { InputObj: L, InputObjs: [{ owner: img, name: 'alpha_factor' }] }).err ?? null;
    out.A2 = r;
  }

  // ---------------------------------------------------------------- 5. A3 MoveTextureLayers
  {
    const [{ m, ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']);
    const r = {};
    const [a, bL, c, d] = ['a', 'b', 'c', 'd'].map(n => A.run('AddTextureLayer', { InputObjs: [m], Name: n }));
    const mv = (layers, off) => { const x = run('MoveTextureLayers', off === undefined ? { InputObjs: layers } : { InputObjs: layers, Offset: off }); const o = ls(m); A.undo(); return { order: o, ret: kind(x.v), err: x.err ?? null, back: ls(m) }; };
    r.start = ls(m);
    r.oneDefault = mv([bL]); r.oneM1 = mv([bL], -1); r.oneP1 = mv([bL], 1); r.oneM5 = mv([c], -5); r.oneP5 = mv([bL], 5); r.zero = mv([bL], 0);
    r.twoM1 = mv([bL, c], -1); r.twoP1 = mv([bL, c], 1); r.twoM5 = mv([c, d], -5); r.twoP5 = mv([a, bL], 5); r.split = mv([a, c], 1);
    r.byPath = mv(`${m.name}.b,${m.name}.c`, -1);
    void a;
    // a layer shared by (the Phong shaders of) two materials
    const s = A.run('AddTextureLayer', { InputObjs: [ph, ph2], Name: 's' });
    A.run('AddTextureLayer', { InputObjs: [ph], Name: 'pa', After: false }); A.run('AddTextureLayer', { InputObjs: [ph], Name: 'pb' });
    A.run('AddTextureLayer', { InputObjs: [ph2], Name: 'x', After: false }); A.run('AddTextureLayer', { InputObjs: [ph2], Name: 'y' });
    r.sharedStart = [ls(ph), ls(ph2)]; r.sharedMerged = names(T.mergedLayerOrder(T.layerFamily([ph])).order);
    const mv2 = off => { A.run('MoveTextureLayers', { InputObjs: [s], Offset: off }); const o = [ls(ph), ls(ph2)]; A.undo(); return o; };
    r.sharedM1 = mv2(-1); r.sharedM5 = mv2(-5); r.sharedP1 = mv2(1); r.sharedP5 = mv2(5); r.sharedBack = [ls(ph), ls(ph2)];
    out.A3 = r;
  }

  // ---------------------------------------------------------------- 6. A4 RemoveTextureLayers
  {
    const r = {};
    const setup = () => {
      const [{ ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']);
      const a = A.run('AddTextureLayer', { InputObjs: [ph], Name: 'a' });
      const s = A.run('AddTextureLayer', { InputObjs: [ph, ph2], Name: 's' });
      const y = A.run('AddTextureLayer', { InputObjs: [ph2], Name: 'y' });
      A.run('AddTextureLayerPorts', { InputObj: a, InputObjs: [{ owner: ph, name: 'ambient' }] });
      A.run('AddTextureLayerPorts', { InputObj: s, InputObjs: [{ owner: ph, name: 'diffuse' }, { owner: ph2, name: 'diffuse' }] });
      const ports = () => ({ ambient1: T.layerPortsOn({ owner: ph, name: 'ambient' }).length, diffuse1: T.layerPortsOn({ owner: ph, name: 'diffuse' }).length, diffuse2: T.layerPortsOn({ owner: ph2, name: 'diffuse' }).length });
      const state = () => ({ ph: ls(ph), ph2: ls(ph2), sContainers: names(s.containers), aContainers: names(a.containers), ports: ports() });
      return { ph, ph2, a, s, y, state };
    };
    { const x = setup(); r.before = x.state(); const q = run('RemoveTextureLayers', { InputObjs: [x.a, x.s, x.y], Container: x.ph }); r.withContainer = x.state(); r.withContainerRet = kind(q.v); r.withContainerErr = q.err ?? null; A.undo(); r.withContainerUndo = x.state(); }
    { const x = setup(); const q = run('RemoveTextureLayers', { InputObjs: [x.s] }); r.noContainer = x.state(); r.noContainerErr = q.err ?? null; A.undo(); r.noContainerUndo = x.state(); }
    { const x = setup(); x.s.locked = true; r.lockedErr = run('RemoveTextureLayers', { InputObjs: [x.s] }).err; r.lockedState = x.state(); }
    out.A4 = r;
  }

  // ---------------------------------------------------------------- 7. B1-B3
  {
    const [{ m, ph }, { m: m2 }] = withMats(['Sphere', 'Cube']);
    const r = {};
    const p = run('AddPresetTextureLayer', { InputObjs: [ph] });
    r.b1Err = p.err ?? null; r.b1Name = nm(p.v); r.b1Kind = kind(p.v); r.b1Color = nm(src(p.v, 'color')); r.b1ShaderNested = T.nestedShaders(m).includes(src(p.v, 'color')); r.b1Layers = ls(ph);
    const p2 = run('AddPresetTextureLayer', { PresetObj: 'Checkerboard', InputObjs: [ph], Name: 'Foo', After: false }); r.b1Named = nm(p2.v); r.b1NamedOrder = ls(ph); r.b1NamedColor = nm(src(p2.v, 'color'));
    const bad = run('AddPresetTextureLayer', { PresetObj: 'NoSuchPreset', InputObjs: [ph] }); r.b1BadKind = bad.err ? 'err' : kind(bad.v); r.b1BadLog = bad.log; r.b1BadLayers = ls(ph);
    r.b1TwoMaterials = run('AddPresetTextureLayer', { InputObjs: [m, m2] }).err ?? null;
    A.undo(); A.undo(); r.b1Undo = ls(ph); // the bad preset left no undo entry; two undos remove Foo and Image_Layer
    // B2
    const clip = A.run('CreateImageClip', { FileName: 'pics/bark.pic', Name: 'bark_pic' });
    const c = run('AddClipTextureLayer', { Clip: clip, InputObjs: [ph] });
    r.b2Err = c.err ?? null; r.b2Name = nm(c.v); r.b2Color = nm(src(c.v, 'color')); r.b2Tex = src(src(c.v, 'color'), 'tex') === clip; r.b2Mask = c.v?.val('maskmode'); r.b2Layers = ls(ph);
    const c2 = run('AddClipTextureLayer', { Clip: 'bark_pic', InputObjs: [ph], Name: 'Named' }); r.b2ByName = nm(c2.v); r.b2ByNameTex = c2.v ? src(src(c2.v, 'color'), 'tex') === clip : null;
    const cb = run('AddClipTextureLayer', { Clip: A.scene.find('sphere'), InputObjs: [ph] }); r.b2BadKind = cb.err ? 'err' : kind(cb.v); r.b2BadLog = cb.log;
    // B3
    const i = run('AddImageTextureLayer', { FileName: 'C:\\pics\\wood.jpg', InputObjs: [ph] });
    r.b3Err = i.err ?? null; r.b3Name = nm(i.v); r.b3Color = nm(src(i.v, 'color')); r.b3Clip = nm(src(src(i.v, 'color'), 'tex')); r.b3ClipFile = src(src(i.v, 'color'), 'tex')?.val('filename'); r.b3Mask = i.v?.val('maskmode');
    const ib = run('AddImageTextureLayer', { FileName: 'not an image', InputObjs: [ph] }); r.b3BadKind = ib.err ? 'err' : kind(ib.v); r.b3BadLog = ib.log;
    out.B = r;
  }

  // ---------------------------------------------------------------- 8. C
  {
    const r = {};
    const mixer = (ph, port) => { const x = src(ph, port); if (!x) return null; return { name: x.name, isMix8: T.isMix8(x), base_color: x.val('base_color'), baseSrc: nm(src(x, 'base_color')), color: [1, 2, 3, 4, 5, 6, 7].map(i => nm(src(x, `color${i}`))), weight1: x.val('weight1'), alpha1: x.val('alpha1'), mode1: x.val('mode1'), inuse: [1, 2, 3, 4, 5, 6, 7].map(i => x.val(`inuse${i}`)) }; };
    // C2 golden: default sphere (inherits Scene_Material, a Phong), all defaults
    {
      const [o] = fresh(); const sm = A.scene.root.material, ph = sm.surface;
      const q = run('BlendInPresets', { InputObjs: 'sphere' });
      const g = { err: q.err ?? null, kind: kind(q.v), created: q.v?.map(nm), log: q.log };
      g.ambient = mixer(ph, 'ambient'); g.diffuse = mixer(ph, 'diffuse');
      g.sameImage = !!q.v && src(src(ph, 'ambient'), 'color1') === q.v[0] && src(src(ph, 'diffuse'), 'color1') === q.v[0];
      g.transparency = nm(src(ph, 'transparency')); g.reflectivity = nm(src(ph, 'reflectivity')); g.stillShared = o.material === null && T.currentMaterial(o) === sm;
      g.paths = ['sphere.Material.Phong.diffuse_blend.color1', 'Sources.Materials.DefaultLib.Scene_Material.diffuse_blend.color1', 'Scene_Material.Phong.diffuse'].map(p => { const x = T.resolvePort(p); return x ? T.portPath(x) : null; });
      // again: the mixers are reused, the next free layer is taken
      const q2 = run('BlendInPresets', { PresetNames: 'Checkerboard', InputObjs: [o] });
      g.again = { created: q2.v?.map(nm), diffuse: mixer(ph, 'diffuse'), ambientName: nm(src(ph, 'ambient')) };
      A.undo(); A.undo(); g.undo = { ambient: nm(src(ph, 'ambient')), diffuse: nm(src(ph, 'diffuse')), nested: T.nestedShaders(sm).length, diffuseValue: ph.val('diffuse') };
      A.redo(); g.redo = { diffuse: nm(src(ph, 'diffuse')), color1: nm(src(src(ph, 'diffuse'), 'color1')), inuse1: src(ph, 'diffuse')?.val('inuse1') };
      r.golden = g;
    }
    // Mode 2: direct connection, no mixer
    { const [o] = fresh(); const ph = A.scene.root.material.surface; const q = run('BlendInPresets', { InputObjs: [o], Mode: 2 }); r.mode2 = { created: q.v?.map(nm), ambient: nm(src(ph, 'ambient')), diffuse: nm(src(ph, 'diffuse')), same: src(ph, 'ambient') === q.v?.[0] && src(ph, 'diffuse') === q.v?.[0], isMix: T.isMix8(src(ph, 'diffuse')) };
      const q2 = run('BlendInPresets', { PresetNames: 'Image,Checkerboard', InputObjs: [o], Mode: 'siReplaceNoBlend' }); r.mode2two = { created: q2.v?.map(nm), diffuse: mixer(ph, 'diffuse') }; }
    // Mode 1: replace, then blend; and the registry's default text for Mode
    { const [o] = fresh(); const ph = A.scene.root.material.surface; run('BlendInPresets', { InputObjs: [o], Mode: 2 }); const q = run('BlendInPresets', { PresetNames: 'Checkerboard', InputObjs: [o], Mode: ':siReplaceAndBlendInPreset:siBlendInPresetModes', Transparency: true, Reflection: true });
      r.mode1 = { created: q.v?.map(nm), diffuse: mixer(ph, 'diffuse'), transparency: mixer(ph, 'transparency')?.name, reflectivity: mixer(ph, 'reflectivity')?.name, usealphatrans: ph.val('usealphatrans'), inverttrans: ph.val('inverttrans'), usealpharefl: ph.val('usealpharefl'), imageStillNested: T.nestedShaders(A.scene.root.material).some(s => s.name === 'Image') }; }
    // SharedMatAction
    { const [o] = fresh(); const sm = A.scene.root.material; const q = run('BlendInPresets', { InputObjs: [o], SharedMatAction: 1 }); r.shared1 = { local: o.material !== null && o.material !== sm, localName: nm(o.material), onLocal: nm(src(o.material?.surface, 'diffuse')), sceneUntouched: src(sm.surface, 'diffuse') === null, created: q.v?.length, asked: q.log.filter(l => /shared/i.test(l)).length }; A.undo(); r.shared1.undo = o.material === null; }
    { const [o] = fresh(); const sm = A.scene.root.material; const q = run('BlendInPresets', { InputObjs: [o], SharedMatAction: 0 }); r.shared0 = { local: o.material !== null, onScene: nm(src(sm.surface, 'diffuse')), asked: q.log.filter(l => /shared/i.test(l)).length }; }
    { const [o] = fresh(); const q = run('BlendInPresets', { InputObjs: [o], SharedMatAction: 2 }); r.shared2one = { local: o.material !== null, asked: q.log.filter(l => /shared/i.test(l)).length }; }
    { const [o, c] = fresh(['Sphere', 'Cube']); A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [c] }); const q = run('BlendInPresets', { InputObjs: [o, c, o], SharedMatAction: 2 }); r.shared2two = { sphereLocal: o.material !== null, log: q.log.filter(l => /^info\|/.test(l)), created: q.v?.length, cubeDiffuse: nm(src(c.material.surface, 'diffuse')) }; }
    { const [o, c] = fresh(['Sphere', 'Cube']); const q = run('BlendInPresets', { InputObjs: [o, c], SharedMatAction: 3 }); r.shared3two = { log: q.log.filter(l => /^info\|/.test(l)), created: q.v?.length }; }
    // NotifyNoResult, batch and interactive
    { const [o] = fresh(); const q = run('BlendInPresets', { InputObjs: [o], NotifyNoResult: true, Ambient: false, Diffuse: false }); r.notifyBatch = { created: q.v?.length, log: q.log };
      const q0 = run('BlendInPresets', { InputObjs: [o], NotifyNoResult: false, Ambient: false, Diffuse: false }); r.notifyOff = q0.log.filter(l => /^info\|/.test(l)).length;
      A.Interactive = true; const before = document.querySelectorAll('.si-msgbox-window').length; run('BlendInPresets', { InputObjs: [o], NotifyNoResult: true, Ambient: false, Diffuse: false });
      const boxes = [...document.querySelectorAll('.si-msgbox-window')]; r.notifyInteractive = { opened: boxes.length - before, text: boxes[boxes.length - 1]?.querySelector('.si-msgbox-text')?.textContent ?? null }; boxes.forEach(x => x.querySelector('.si-msgbox-ok')?.click()); A.Interactive = false; }
    // C1
    {
      const [{ m, ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']);
      const nine = run('BlendInPresetsWithPorts', { PresetNames: Array(9).fill('Image').join(','), InputObjs: [`${m.name}.Phong.diffuse`] });
      const a = src(ph, 'diffuse'), bb = a && src(a, 'color7');
      r.nine = { created: nine.v?.map(nm), first: mixer(ph, 'diffuse'), second: bb ? { name: bb.name, isMix8: T.isMix8(bb), color: [1, 2, 3, 4, 5, 6, 7].map(i => nm(src(bb, `color${i}`))), inuse: [1, 2, 3, 4, 5, 6, 7].map(i => bb.val(`inuse${i}`)) } : null,
        order: nine.v ? [1, 2, 3, 4, 5, 6].map(i => src(a, `color${i}`) === nine.v[i - 1]).concat([1, 2, 3].map(i => src(bb, `color${i}`) === nine.v[5 + i])) : null };
      const sc = run('BlendInPresetsWithPorts', { InputObjs: [{ owner: ph, name: 'shiny' }] });
      const c2s = src(ph, 'shiny'), mx = c2s && src(c2s, 'input'), s2c = mx && src(mx, 'base_color');
      r.scalar = { created: sc.v?.map(nm), onPort: nm(c2s), mixer: nm(mx), isMix8: T.isMix8(mx), color1: nm(src(mx, 'color1')), s2c: nm(s2c), s2cAlpha: s2c?.val('alpha'), s2cInput: s2c?.val('input') };
      const bad = run('BlendInPresetsWithPorts', { InputObjs: [{ owner: ph, name: 'bump' }] }); r.badType = { created: bad.v?.map(nm), log: bad.log, onPort: nm(src(ph, 'bump')) };
      const nope = run('BlendInPresetsWithPorts', { PresetNames: 'Nope, ,tex/a.png', InputObjs: [{ owner: ph, name: 'ambient' }] });
      r.names = { created: nope.v?.map(nm), log: nope.log, clip: nm(src(nope.v?.[0], 'tex')), ambient: mixer(ph, 'ambient')?.name };
      r.twoContainers = kind(run('BlendInPresetsWithPorts', { InputObjs: [{ owner: ph, name: 'specular' }, { owner: ph2, name: 'specular' }] }).v);
      r.noNames = kind(run('BlendInPresetsWithPorts', { PresetNames: ' , ', InputObjs: [{ owner: ph, name: 'specular' }] }).v);
      const seen = []; const off = A.events.on('inspect', n => seen.push(nm(n)));
      const insp = run('BlendInPresetsWithPortsInsp', { PresetNames: 'Checkerboard', InputObjs: [{ owner: ph, name: 'specular' }] }); r.insp = { created: insp.v?.map(nm), inspected: [...seen] };
      seen.length = 0; const [o3] = [A.scene.find('sphere')]; const insp2 = run('BlendInPresetsInsp', { InputObjs: [o3], SharedMatAction: 0 }); r.insp2 = { created: insp2.v?.map(nm), inspected: [...seen] }; off();
    }
    // C3
    {
      const [{ m, ph }] = withMats(['Sphere']); const seen = []; const off = A.events.on('inspect', n => seen.push(nm(n)));
      const q = run('SIConnectShaderWithBlendsInsp', { InputObjs: [{ owner: ph, name: 'ambient' }, { owner: ph, name: 'diffuse' }] }); off();
      const ma = src(ph, 'ambient'), md = src(ph, 'diffuse');
      r.c3 = { err: q.err ?? null, ret: kind(q.v), mixers: [nm(ma), nm(md)], mixerType: [ma?.spdl?.file, md?.spdl?.file], shader: [nm(src(ma, 'color1')), nm(src(md, 'color1'))], same: !!ma && src(ma, 'color1') === src(md, 'color1'),
        color2: [ma?.val('color2')?.slice(0, 3), md?.val('color2')?.slice(0, 3)], inspected: seen, nested: T.nestedShaders(m).map(nm) };
    }
    out.C = r;
  }

  // ---------------------------------------------------------------- 9. D
  {
    const r = {};
    const layerInfo = l => l instanceof T.TextureLayer ? { name: l.name, weight: l.val('weight'), ports: names(l.ports), targets: l.ports.map(p => `${p.target.owner.name}.${p.target.name}`), color: nm(src(l, 'color')), colorPreset: src(l, 'color')?.spdl?.file ?? null, containers: names(l.containers) } : { shader: nm(l) };
    // D2 golden: default sphere, all defaults (SharedMatAction 2: one material, not named SceneMaterial -> made local without asking)
    {
      const [o] = fresh(); const sm = A.scene.root.material;
      const q = run('BlendInTextureLayers', { InputObjs: 'sphere' });
      const ph = o.material?.surface;
      r.golden = { err: q.err ?? null, kind: kind(q.v), layers: q.v?.map(layerInfo), onPhong: ph ? ls(ph) : null, local: o.material !== null && o.material !== sm, asked: q.log.filter(l => /shared/i.test(l)).length,
        sceneUntouched: T.layersOf(sm.surface).length === 0, portsOnAmbient: ph ? T.layerPortsOn({ owner: ph, name: 'ambient' }).length : null, portsOnDiffuse: ph ? T.layerPortsOn({ owner: ph, name: 'diffuse' }).length : null, directShader: ph ? nm(src(ph, 'diffuse')) : null };
      // Mode 1 afterwards: the layer ports on the default ports go first
      const q1 = run('BlendInTextureLayers', { PresetNames: 'Checkerboard', InputObjs: [o], Mode: 1 });
      r.mode1 = { layers: q1.v?.map(layerInfo), onPhong: ls(ph), oldLayerPorts: q.v?.[0]?.ports.length, portsOnDiffuse: names(T.layerPortsOn({ owner: ph, name: 'diffuse' }).map(p => p.layer)) };
      A.undo(); r.mode1Undo = { onPhong: ls(ph), oldLayerPorts: q.v?.[0]?.ports.length };
      A.undo(); r.goldenUndo = { local: o.material !== null };
    }
    // Mode 2: an Image shader directly on both ports and no layer
    { const [o] = fresh(); const q = run('BlendInTextureLayers', { InputObjs: [o], Mode: 2 }); const ph = o.material?.surface;
      r.mode2 = { result: q.v?.map(layerInfo), ambient: nm(src(ph, 'ambient')), diffuse: nm(src(ph, 'diffuse')), same: !!ph && src(ph, 'ambient') === src(ph, 'diffuse') && src(ph, 'ambient') === q.v?.[0], layers: ph ? ls(ph) : null };
      const q2 = run('BlendInTextureLayers', { PresetNames: 'Image,Checkerboard', InputObjs: [o], Mode: ':siReplaceAndNoBlendInTextureLayers:siBlendInTextureLayersModes' }); r.mode2two = { result: q2.v?.map(layerInfo), diffuse: nm(src(ph, 'diffuse')), layers: ls(ph) }; }
    // notice 1195 / 1197
    { const [o] = fresh(); const q = run('BlendInTextureLayers', { InputObjs: [o], NotifyNoResult: true, Ambient: false, Diffuse: false }); r.notify = { created: q.v?.length, log: q.log }; }
    // D1
    {
      const [{ m, ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']);
      const q = run('BlendInTextureLayersWithPorts', { PresetNames: 'Image,Checkerboard,Nope,pics/a.tga', InputObjs: [`${m.name}.Phong.ambient`, { owner: ph, name: 'diffuse' }] });
      r.d1 = { err: q.err ?? null, layers: q.v?.map(layerInfo), onPhong: ls(ph), log: q.log.filter(l => /WARNING/.test(l)) };
      r.d1TwoContainers = kind(run('BlendInTextureLayersWithPorts', { InputObjs: [{ owner: ph, name: 'specular' }, { owner: ph2, name: 'specular' }] }).v);
      r.d1NoPorts = kind(run('BlendInTextureLayersWithPorts', { InputObjs: [] }).v);
      const seen = []; const off = A.events.on('inspect', n => seen.push(nm(n)));
      const qi = run('BlendInTextureLayersWithPortsInsp', { InputObjs: [{ owner: ph, name: 'specular' }] }); r.d1Insp = { layers: qi.v?.map(layerInfo), inspected: [...seen] };
      // D3
      const clip = A.run('CreateImageClip', { FileName: 'pics/bark.pic', Name: 'bark_pic' });
      seen.length = 0;
      const q3 = run('BlendClipsInTextureLayersWithPortsInsp', { ClipList: [clip, A.scene.find('sphere')], InputObjs: [{ owner: ph2, name: 'diffuse' }] }); off();
      r.d3 = { err: q3.err ?? null, layers: q3.v?.map(layerInfo), tex: q3.v?.[0] ? src(src(q3.v[0], 'color'), 'tex') === clip : null, mask: q3.v?.[0]?.val('maskmode'), log: q3.log.filter(l => /WARNING/.test(l)), inspected: [...seen] };
      const q3b = run('BlendClipsInTextureLayersWithPorts', { ClipList: 'bark_pic', InputObjs: [{ owner: ph2, name: 'ambient' }] }); r.d3b = { layers: q3b.v?.map(layerInfo) };
    }
    // D4
    {
      const [o] = fresh(); const clip = A.run('CreateImageClip', { FileName: 'pics/bark.pic', Name: 'bark_pic' }); const clip2 = A.run('CreateImageClip', { FileName: 'pics/moss.pic', Name: 'moss_pic' });
      const two = run('BlendClipsInTextureLayers', { ClipList: [clip, clip2], InputObjs: [o] }); r.d4Two = { err: two.err ?? null, nya: two.nya ?? false, local: o.material !== null };
      const q = run('BlendClipsInTextureLayers', { ClipList: [clip, o], InputObjs: [o] }); const ph = o.material?.surface;
      r.d4 = { err: q.err ?? null, layers: q.v?.map(layerInfo), tex: q.v?.[0] ? src(src(q.v[0], 'color'), 'tex') === clip : null, log: q.log.filter(l => /not a valid clip/.test(l)), onPhong: ph ? ls(ph) : null };
      const [o2] = fresh(); const clipB = A.run('CreateImageClip', { FileName: 'pics/bark.pic', Name: 'bark_pic' }); const seen = []; const off = A.events.on('inspect', n => seen.push(nm(n)));
      const qm = run('BlendClipsInTextureLayersInsp', { ClipList: [clipB], InputObjs: [o2], Mode: 2 }); off(); const ph3 = o2.material?.surface;
      r.d4Mode2 = { result: qm.v?.map(layerInfo), diffuse: nm(src(ph3, 'diffuse')), tex: src(src(ph3, 'diffuse'), 'tex') === clipB, layers: ph3 ? ls(ph3) : null, inspected: seen };
      r.d4None = kind(run('BlendClipsInTextureLayers', { ClipList: [], InputObjs: [o2] }).v);
    }
    out.D = r;
  }

  // ---------------------------------------------------------------- 10. E1 InsertShader
  {
    const [{ m, ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']); const r = {};
    const img = A.run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: [{ owner: ph, name: 'ambient' }, { owner: ph, name: 'diffuse' }] });
    const q = run('InsertShader', { PresetObj: 'Invert', InputObjs: [{ owner: ph, name: 'ambient' }, { owner: ph, name: 'diffuse' }, { owner: ph, name: 'specular' }, { owner: ph, name: 'radiance' }], Name: 'ins' });
    r.err = q.err ?? null; r.inserted = q.v?.map(nm); r.ambient = nm(src(ph, 'ambient')); r.diffuse = nm(src(ph, 'diffuse')); r.specular = nm(src(ph, 'specular')); r.radiance = nm(src(ph, 'radiance'));
    r.sameOnGroup = src(ph, 'ambient') === src(ph, 'diffuse') && src(ph, 'ambient') === q.v?.[0]; r.mainInput = q.v?.[0] ? src(q.v[0], 'input') === img : null; r.emptyGroupInput = q.v?.[1] ? nm(src(q.v[1], 'input')) : 'x'; r.separate = q.v ? q.v[1] !== q.v[2] : null;
    // a preset without a main input: the displaced shader survives, unconnected
    const q2 = run('InsertShader', { PresetObj: 'Mixers\\Mix_2colors', InputObjs: [{ owner: ph, name: 'ambient' }] });
    r.noMain = { inserted: q2.v?.map(nm), ambient: nm(src(ph, 'ambient')), displacedSurvives: T.nestedShaders(m).some(s => s.name === 'ins'), displacedPath: T.resolveNode(`${m.name}.ins`)?.name ?? null };
    // a scalar port: a converter goes in front
    const q3 = run('InsertShader', { PresetObj: 'Invert', InputObjs: [{ owner: ph, name: 'shiny' }] }); r.scalar = { inserted: q3.v?.map(nm), onPort: nm(src(ph, 'shiny')), behind: nm(src(src(ph, 'shiny'), 'input')) };
    const e1 = run('InsertShader', { PresetObj: 'Invert', InputObjs: [{ owner: ph, name: 'incandescence' }, { owner: ph2, name: 'incandescence' }] }); r.twoContainers = { ret: kind(e1.v), log: e1.log, untouched: src(ph, 'incandescence') === null };
    const e2 = run('InsertShader', { PresetObj: 'NoSuchPreset', InputObjs: [{ owner: ph, name: 'incandescence' }] }); r.badPreset = { ret: kind(e2.v), log: e2.log };
    A.undo(); A.undo(); A.undo(); r.undo = { ambient: nm(src(ph, 'ambient')), specular: nm(src(ph, 'specular')), shiny: nm(src(ph, 'shiny')) };
    out.E = r;
  }

  // ---------------------------------------------------------------- 11. F
  {
    const [{ o, m, ph }, { ph: ph2 }] = withMats(['Sphere', 'Cube']); const r = {};
    const a1 = run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: `${o.name}.Material.Phong.diffuse` });
    r.apply = { err: a1.err ?? null, kind: kind(a1.v), name: nm(a1.v), onPort: src(ph, 'diffuse') === a1.v, nested: T.nestedShaders(m).includes(a1.v), log: a1.log.filter(l => /attested/.test(l)) };
    const a2 = run('SIApplyShaderToCnxPoint', { PresetObj: 'Shaders\\Texture\\Checkerboard.Preset', InputObjs: [{ owner: ph, name: 'shiny' }, { owner: ph, name: 'ambient' }], Name: 'chk', Value: false });
    r.applyScalar = { name: nm(a2.v), shiny: nm(src(ph, 'shiny')), behind: src(src(ph, 'shiny'), 'input') === a2.v, ambient: src(ph, 'ambient') === a2.v, valueLog: a2.log.filter(l => /not yet attested/.test(l) && /Q14/.test(l)).length };
    const a3 = run('SIApplyShaderToCnxPoint', { PresetObj: 'Conversion\\Scalar2color', InputObjs: [{ owner: ph, name: 'specular' }] }); r.applyConv = { name: nm(a3.v), file: a3.v?.spdl?.file, onPort: src(ph, 'specular') === a3.v };
    const a4 = run('SIApplyShaderToCnxPoint', { PresetObj: 'Image', InputObjs: [{ owner: ph, name: 'bump' }] }); r.applyNoConv = { name: nm(a4.v), onPort: nm(src(ph, 'bump')), log: a4.log.filter(l => /Q14/.test(l)).length };
    const a5 = run('SIApplyShaderToCnxPoint', { PresetObj: 'NoSuchPreset', InputObjs: [{ owner: ph, name: 'radiance' }] }); r.applyBad = { kind: kind(a5.v), err: a5.err ?? null, log: a5.log.filter(l => /^error\|/.test(l)).length };
    const p1 = run('SIApplyShaderToCnxPoint2', { ProgID: 'Softimage.txt2d-image-explicit.1', InputObjs: [{ owner: ph, name: 'radiance' }], Name: 'viaProgID' });
    r.progid = { err: p1.err ?? null, name: nm(p1.v), file: p1.v?.spdl?.file, onPort: src(ph, 'radiance') === p1.v };
    const p2 = run('SIApplyShaderToCnxPoint2', { ProgID: 'Softimage.sib_color_8mix.1', InputObjs: [{ owner: ph, name: 'incandescence' }] }); r.progidMix = { name: nm(p2.v), isMix8: T.isMix8(p2.v) };
    const p3 = run('SIApplyShaderToCnxPoint2', { ProgID: 'Nobody.nothing.1', InputObjs: [{ owner: ph, name: 'incandescence' }] }); r.progidBad = { kind: kind(p3.v), err: p3.err ?? null };
    // SIConnectShaderToCnxPoint
    const img = a1.v;
    const c1 = run('SIConnectShaderToCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'transparency' }] }); r.connect = { err: c1.err ?? null, returnsSource: c1.v === img, onPort: src(ph, 'transparency') === img };
    const c2 = run('SIConnectShaderToCnxPoint', { Source: `${m.name}.Image`, InputObjs: [{ owner: ph, name: 'trans_glossy' }] }); r.connectConv = { returned: nm(c2.v), isConverter: c2.v !== img && c2.v?.spdl?.file === 'sib_color_to_scalar.spdl', behind: src(c2.v, 'input') === img };
    const clip = A.run('CreateImageClip', { FileName: 'pics/bark.pic', Name: 'bark_pic' });
    const c3 = run('SIConnectShaderToCnxPoint', { Source: clip, InputObjs: [{ owner: img, name: 'tex' }] }); r.connectClip = { returnsClip: c3.v === clip, onPort: src(img, 'tex') === clip, texValue: img.val('tex') };
    const c4 = run('SIConnectShaderToCnxPoint', { Source: clip, InputObjs: [{ owner: ph, name: 'reflectivity' }] }); r.connectClipColour = { kind: kind(c4.v), onPort: nm(src(ph, 'reflectivity')) };
    // DeleteOnLastDisconnection
    const x = A.run('SIApplyShaderToCnxPoint', { PresetObj: 'Checkerboard', InputObjs: [{ owner: ph, name: 'reflectivity' }], Name: 'victim' });
    const y = A.run('SIApplyShaderToCnxPoint', { PresetObj: 'Checkerboard', InputObjs: [{ owner: ph, name: 'reflect_glossy' }], Name: 'other' });
    run('SIConnectShaderToCnxPoint', { Source: y, InputObjs: [{ owner: ph, name: 'reflectivity' }] }); r.deleteTrue = { onPort: src(ph, 'reflectivity') === y, victimNested: T.nestedShaders(m).includes(x) };
    A.undo(); r.deleteUndo = { onPort: src(ph, 'reflectivity') === x, victimNested: T.nestedShaders(m).includes(x) };
    run('SIConnectShaderToCnxPoint', { Source: y, InputObjs: [{ owner: ph, name: 'reflectivity' }], DeleteOnLastDisconnection: false }); r.deleteFalse = { onPort: src(ph, 'reflectivity') === y, victimNested: T.nestedShaders(m).includes(x) };
    const cyc = run('SIConnectShaderToCnxPoint', { Source: ph, InputObjs: [{ owner: img, name: 'factor' }] }); r.cycle = cyc.err ?? null;
    r.connectTwoContainers = kind(run('SIConnectShaderToCnxPoint', { Source: img, InputObjs: [{ owner: ph, name: 'radiance' }, { owner: ph2, name: 'radiance' }] }).v);
    // UIApplyShaderToCnxPoints and the pop-ups
    const u = run('UIApplyShaderToCnxPoints', { InputObj: img, InputObjs: [{ owner: ph, name: 'ambient' }], X: 10, Y: 20 }); r.ui = { err: u.err ?? null, ret: kind(u.v), log: u.log.filter(l => /not yet attested/.test(l) && /Q15/.test(l)).length, ambientUnchanged: src(ph, 'ambient') === a2.v };
    A.select([o]); const menusBefore = document.querySelectorAll('.si-menu, .menu-popup').length;
    const t1 = run('Texture Pop-up Menu', {}); const t2 = run('Modify Texture Pop-up Menu', {});
    r.popup = { err: [t1.err ?? null, t2.err ?? null], ret: [kind(t1.v), kind(t2.v)], log: [t1.log.filter(l => /not yet attested/.test(l) && /Q15/.test(l)).length, t2.log.filter(l => /not yet attested/.test(l) && /Q15/.test(l)).length], accepted: [/1 input\(s\) accepted/.test(t1.log.join('\n')), /1 input\(s\) accepted/.test(t2.log.join('\n'))], menusOpened: document.querySelectorAll('.si-menu, .menu-popup').length - menusBefore };
    const nul = A.run('GetPrim', { PresetObj: 'Null' }); const F = A.commands.get('Texture Pop-up Menu').args.find(q => q.name === 'EmbeddedCommand').default;
    r.filter = { sphere: T.applySelectionFilter(F, [o]).ok, nullOnly: T.applySelectionFilter(F, [nul]).ok, none: T.applySelectionFilter(F, []).ok, mixed: T.applySelectionFilter(F, [o, nul, m]).accepted.map(nm), min: T.applySelectionFilter(F, []).min };
    out.F = r;
  }

  // ---------------------------------------------------------------- 12. the UI still draws a scene that carries mixers and layers
  { const [o] = fresh(); A.run('BlendInPresets', { InputObjs: [o], SharedMatAction: 0 }); A.run('BlendInTextureLayers', { InputObjs: [o], SharedMatAction: 0 }); A.select([o]); A.events.emit('scene'); A.events.emit('selection'); out.ui = { ok: true }; }
  return out;
}, { registry });
await page.waitForTimeout(800);
await b.close();

// ---------------------------------------------------------------- checks
let checks = 0; const fails = [];
const eq = (label, g, want) => { checks++; const ok = JSON.stringify(g) === JSON.stringify(want); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${JSON.stringify(want)}\n       got  ${JSON.stringify(g)}`); } };
const truthy = (label, g) => eq(label, !!g, true);
const match = (label, text, re) => { checks++; const ok = typeof text === 'string' && re.test(text); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want ${re}\n       got  ${JSON.stringify(text)}`); } };
const hasLog = (label, log, re) => { checks++; const ok = Array.isArray(log) && log.some(l => re.test(l)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { fails.push(label); console.log(`       want a log line ${re}\n       got  ${JSON.stringify(log)}`); } };

// 1. registration
for (const c of registry) {
  const g = got.registration.find(x => x.key === c.key);
  eq(`registered ${c.key}: name, display name, category, description, arguments and defaults as in the registry`, g, { key: c.key, found: true, label: c.label, category: c.category, description: c.description, args: c.args });
}

// 2. defaults
const D = got.defaults;
const DEFAULT_ERR = { AddTextureLayer: /InputObjs is required/, AddTextureLayerPorts: /InputObj is required/, AddPresetTextureLayer: /not within one shader container/ };
const DEFAULT_KIND = {
  MoveTextureLayers: 'undefined', RemoveTextureLayers: 'undefined', AddImageTextureLayer: 'null', AddClipTextureLayer: 'null',
  BlendInPresets: 'array(0)', BlendInPresetsInsp: 'array(0)', BlendInPresetsWithPorts: 'array(0)', BlendInPresetsWithPortsInsp: 'array(0)', SIConnectShaderWithBlendsInsp: 'undefined',
  BlendInTextureLayers: 'array(0)', BlendInTextureLayersInsp: 'array(0)', BlendInTextureLayersWithPorts: 'array(0)', BlendInTextureLayersWithPortsInsp: 'array(0)',
  BlendClipsInTextureLayers: 'array(0)', BlendClipsInTextureLayersInsp: 'array(0)', BlendClipsInTextureLayersWithPorts: 'array(0)', BlendClipsInTextureLayersWithPortsInsp: 'array(0)',
  InsertShader: 'undefined', SIApplyShaderToCnxPoint: 'null', SIApplyShaderToCnxPoint2: 'null', SIConnectShaderToCnxPoint: 'null', UIApplyShaderToCnxPoints: 'undefined',
  'Texture Pop-up Menu': 'null', 'Modify Texture Pop-up Menu': 'undefined',
};
for (const c of registry) {
  if (DEFAULT_ERR[c.key]) match(`default arguments ${c.key}: fails (required input missing)`, D[c.key].err, DEFAULT_ERR[c.key]);
  else eq(`default arguments ${c.key}: runs without throwing, returns ${DEFAULT_KIND[c.key]}`, [D[c.key].err, D[c.key].kind], [null, DEFAULT_KIND[c.key]]);
}
hasLog('default arguments AddImageTextureLayer: logs "Invalid image file provided."', D.AddImageTextureLayer.log, /^error\|Invalid image file provided\.$/);
hasLog('default arguments AddClipTextureLayer: logs "Invalid clip provided."', D.AddClipTextureLayer.log, /^error\|Invalid clip provided\.$/);
hasLog('default arguments InsertShader: logs the container error, spelled as shipped', D.InsertShader.log, /^error\|Failed to insert a shaderbecause the targeted ports are not within the same shader container\.$/);
for (const k of ['UIApplyShaderToCnxPoints', 'Texture Pop-up Menu', 'Modify Texture Pop-up Menu']) hasLog(`default arguments ${k}: says "not yet attested" (Q15)`, D[k].log, /not yet attested.*Q15/);
for (const c of registry.filter(c => !c.returns)) eq(`${c.key}: no return value (registry)`, DEFAULT_KIND[c.key] ?? 'undefined', 'undefined');

// 3. A1
const A1 = got.A1;
eq('A1 default name is Layer', A1.defaultName, 'Layer');
eq('A1 returned object is one TextureLayer, class id 126', [A1.isLayer, A1.classId, A1.className, A1.type], [true, 126, 'TextureLayer', 'TextureLayer']);
eq('A1 three layers, each added last', A1.three, ['Layer', 'Layer1', 'c']);
eq('A1 position: no Reference, After true -> last', A1.lastDefault, ['Layer', 'Layer1', 'c', 'p1']);
eq('A1 position: no Reference, After false -> first', A1.first, ['p2', 'Layer', 'Layer1', 'c', 'p1']);
eq('A1 position: Reference in container, After true -> immediately after it', A1.afterRef, ['p2', 'Layer', 'Layer1', 'p3', 'c', 'p1']);
eq('A1 position: Reference in container, After false -> immediately before it', A1.beforeRef, ['p2', 'Layer', 'p4', 'Layer1', 'p3', 'c', 'p1']);
eq('A1 undo removes the layer from the container', A1.afterUndo, ['p2', 'Layer', 'Layer1', 'p3', 'c', 'p1']);
eq('A1 redo puts it back', A1.afterRedo, ['p2', 'Layer', 'p4', 'Layer1', 'p3', 'c', 'p1']);
eq('A1 one layer added to two materials: one object, in both', [A1.sharedIsOne, A1.sharedContainers.length, A1.sharedInM, A1.m2], [true, 2, true, ['shared']]);
match('A1 layer added twice to the same container fails', A1.doubleErr, /already in/);
eq('A1 failed double add leaves the container unchanged', A1.doubleUnchanged, true);
eq('A1 existing layer and container given by path', [A1.byPathErr, A1.sameObject, A1.m2AfterPath], [null, true, ['c', 'shared']]);
eq('A1 Reference not in the container: before the next layer of its merged order that is in it', A1.refElsewhere, ['c', 'q', 'shared']);
eq('A1 non-container elements are skipped silently', [A1.skipErr, A1.skipContainers], [null, 0]);
eq('A1 (inferred, Q5) a layer may sit on shaders of two materials', A1.spanContainers.length, 2);
match('A1 (inferred, Q5) unsuitable layer: message 72', A1.err72, /This shader is already connected to another object\./);
eq('A1 (inferred, Q5) unsuitable layer: nothing added', A1.spanAfter.length, 2);
match('A1 (inferred) contradicting layer orders: message 69', A1.err69, /Connection of this shader would cause a cycle\./);
eq('A1 abort removes the layer from every container it was added to', [A1.ph2AfterCycle, A1.s1Containers.length], [['span', 's2'], 1]);
match('A1 locked container aborts', A1.lockErr, /locked/);

// 4. A2
const A2 = got.A2;
eq('A2 port count (boolean, scalar, vector3, colour4 targets)', [A2.err, A2.count], [null, 5]);
eq('A2 port class id 127', [A2.classIds, A2.classNames], [[127, 127, 127, 127, 127], Array(5).fill('TextureLayerPort')]);
eq('A2 (inferred, Q8) port names are the target parameter names', A2.portNames, ['ambient', 'diffuse', 'shiny', 'bump', 'notrace']);
eq('A2 the three argument forms (path, {owner,name}, Parameter) resolve', A2.targets.map(t => t.split('.').slice(-2).join('.')), ['Phong.ambient', 'Phong.diffuse', 'Phong.shiny', 'Phong.bump', 'Phong.notrace']);
eq('A2 skipped targets (string parameter, integer parameter per the type test, Q16): warning 413 each, command continues', A2.warnings.length, 2);
match('A2 warning 413 text', A2.warnings[0], /The shader port cannot support a texture layer port\. Only color, vector, scalar, integer and boolean shader ports supports texture layers\./);
eq("A2 the layer appears in the target's container afterwards", [A2.layerInTargetContainer, A2.layerContainers.length], [['L'], 2]);
eq('A2 ports are on the layer and on the parameter', [A2.layerPorts, A2.onDiffuse], [['ambient', 'diffuse', 'shiny', 'bump', 'notrace'], ['diffuse']]);
eq('A2 a second port on the same parameter is not rejected (Q7)', [A2.dupErr, A2.dupName, A2.onDiffuse2], [null, ['diffuse1'], 2]);
match('A2 owner that is not a layer container: message 70', A2.err70, /Type mismatch between shader and connection point\./);
eq('A2 failure undoes everything done so far', A2.undone, true);
eq('A2 nested AddTextureLayer: before the next layer of the merged order, else at the end', [A2.joinErr, A2.joinCount, A2.imgLayers], [null, 1, ['L2', 'other', 'last']]);
eq('A2 undo removes the port and the nested add', [A2.afterUndoImg, A2.afterUndoPorts], [['other', 'last'], 0]);
match('A2 (inferred, Q5) nested add of an unsuitable layer: message 72', A2.join72, /already connected to another object/);

// 5. A3
const A3 = got.A3; const back = ['a', 'b', 'c', 'd'];
eq('A3 start order', A3.start, back);
eq('A3 one layer, default Offset (-1)', [A3.oneDefault.order, A3.oneDefault.ret, A3.oneDefault.err], [['b', 'a', 'c', 'd'], 'undefined', null]);
eq('A3 one layer, Offset -1', A3.oneM1.order, ['b', 'a', 'c', 'd']);
eq('A3 one layer, Offset +1', A3.oneP1.order, ['a', 'c', 'b', 'd']);
eq('A3 one layer, Offset -5 (clamped at the head)', A3.oneM5.order, ['c', 'a', 'b', 'd']);
eq('A3 one layer, Offset +5 (clamped at the tail)', A3.oneP5.order, ['a', 'c', 'd', 'b']);
eq('A3 Offset 0 changes nothing', A3.zero.order, back);
eq('A3 two layers, Offset -1 (relative order kept)', A3.twoM1.order, ['b', 'c', 'a', 'd']);
eq('A3 two layers, Offset +1', A3.twoP1.order, ['a', 'd', 'b', 'c']);
eq('A3 two layers, Offset -5', A3.twoM5.order, ['c', 'd', 'a', 'b']);
eq('A3 two layers, Offset +5', A3.twoP5.order, ['c', 'd', 'a', 'b']);
eq('A3 two separate layers, Offset +1', A3.split.order, ['b', 'a', 'd', 'c']);
eq('A3 layers given as a path list', A3.byPath.order, ['b', 'c', 'a', 'd']);
eq('A3 every move is undoable', [A3.oneM1.back, A3.oneP5.back, A3.twoM5.back, A3.twoP5.back], [back, back, back, back]);
eq('A3 shared layer: start orders and merged order', [A3.sharedStart, A3.sharedMerged], [[['pa', 's', 'pb'], ['x', 's', 'y']], ['pa', 'x', 's', 'pb', 'y']]);
eq('A3 shared layer, Offset -1: repositioned in the merged order, each container rewritten', A3.sharedM1, [['pa', 's', 'pb'], ['s', 'x', 'y']]);
eq('A3 shared layer, Offset -5', A3.sharedM5, [['s', 'pa', 'pb'], ['s', 'x', 'y']]);
eq('A3 shared layer, Offset +1', A3.sharedP1, [['pa', 'pb', 's'], ['x', 's', 'y']]);
eq('A3 shared layer, Offset +5: consistent in both containers', A3.sharedP5, [['pa', 'pb', 's'], ['x', 'y', 's']]);
eq('A3 shared layer: undo restores both containers', A3.sharedBack, [['pa', 's', 'pb'], ['x', 's', 'y']]);

// 6. A4
const A4 = got.A4; const A4before = { ph: ['a', 's'], ph2: ['s', 'y'], sContainers: ['Phong', 'Phong'], aContainers: ['Phong'], ports: { ambient1: 1, diffuse1: 1, diffuse2: 1 } };
eq('A4 setup: layer shared by two materials, ports on both', A4.before, A4before);
eq('A4 Container given: last-container layer deleted with its port; shared layer only removed and survives with its ports (Q11 inferred); layers not in the container ignored',
  [A4.withContainerErr, A4.withContainerRet, A4.withContainer], [null, 'undefined', { ph: [], ph2: ['s', 'y'], sContainers: ['Phong'], aContainers: [], ports: { ambient1: 0, diffuse1: 1, diffuse2: 1 } }]);
eq('A4 Container given: undo restores layers, order and port connections', A4.withContainerUndo, A4before);
eq('A4 Container omitted: the layer is deleted, leaves all its containers, its port connections go', [A4.noContainerErr, A4.noContainer], [null, { ph: ['a'], ph2: ['y'], sContainers: [], aContainers: ['Phong'], ports: { ambient1: 1, diffuse1: 0, diffuse2: 0 } }]);
eq('A4 Container omitted: undo re-inserts after the layer that preceded it', A4.noContainerUndo, A4before);
match('A4 locked layer fails with access denied', A4.lockedErr, /Access denied/);
eq('A4 locked layer: nothing removed', A4.lockedState, A4before);

// 7. B
const B = got.B;
eq('B1 layer renamed <shader name>_Layer, shader on its color, shader nested in the material', [B.b1Err, B.b1Kind, B.b1Name, B.b1Color, B.b1ShaderNested, B.b1Layers], [null, 'TextureLayer', 'Image_Layer', 'Image', true, ['Image_Layer']]);
eq('B1 Name, After passed through; preset by name', [B.b1Named, B.b1NamedOrder, B.b1NamedColor], ['Foo', ['Foo', 'Image_Layer'], 'Checkerboard']);
eq('B1 invalid preset: nothing returned, nothing added', [B.b1BadKind, B.b1BadLayers], ['null', ['Foo', 'Image_Layer']]);
hasLog('B1 invalid preset logs "Invalid preset provided."', B.b1BadLog, /^error\|Invalid preset provided\.$/);
match('B1 containers of two materials: the command fails', B.b1TwoMaterials, /not within one shader container/);
eq('B1 undoable', B.b1Undo, []);
eq('B2 layer <clip name>_Layer, Image shader on color, clip on its tex, maskmode 0', [B.b2Err, B.b2Name, B.b2Color, B.b2Tex, B.b2Mask, B.b2Layers], [null, 'bark_pic_Layer', 'Image', true, 0, ['bark_pic_Layer']]);
eq('B2 clip by name, explicit Name kept', [B.b2ByName, B.b2ByNameTex], ['Named', true]);
eq('B2 not a clip: nothing returned (Q12)', B.b2BadKind, 'null');
hasLog('B2 not a clip logs "Invalid clip provided."', B.b2BadLog, /^error\|Invalid clip provided\.$/);
eq('B3 clip created from the file, then as B2', [B.b3Err, B.b3Name, B.b3Color, B.b3Clip, B.b3ClipFile, B.b3Mask], [null, 'wood_jpg_Layer', 'Image2', 'wood_jpg', 'C:\\pics\\wood.jpg', 0]);
eq('B3 not an image file: nothing returned', B.b3BadKind, 'null');
hasLog('B3 not an image file logs "Invalid image file provided."', B.b3BadLog, /^error\|Invalid image file provided\.$/);

// 8. C
const C = got.C; const G = C.golden; const F6 = [false, false, false, false, false, false];
eq('C2 golden: returns the created shaders, one shared Image', [G.err, G.kind, G.created], [null, 'array(1)', ['Image']]);
eq('C2 golden: mixer names ambient_blend / diffuse_blend, both Mix_8colors', [G.ambient.name, G.ambient.isMix8, G.diffuse.name, G.diffuse.isMix8], ['ambient_blend', true, 'diffuse_blend', true]);
eq("C2 golden: the single Image shader is on both mixers' color1", [G.sameImage, G.ambient.color[0], G.diffuse.color[0]], [true, 'Image', 'Image']);
eq('C2 golden: base_color carries the old diffuse / ambient colour', [G.diffuse.base_color, G.ambient.base_color, G.diffuse.baseSrc], [[0.7, 0.7, 0.7, 1], [0.3, 0.3, 0.3, 1], null]);
eq('C2 golden: weight1 = (1, 1, 1, 0.5), mode1 = 1, alpha1 true', [G.diffuse.weight1, G.diffuse.mode1, G.diffuse.alpha1, G.ambient.weight1, G.ambient.mode1], [[1, 1, 1, 0.5], 1, true, [1, 1, 1, 0.5], 1]);
eq('C2 golden: inuse1 true, inuse2..inuse7 false', [G.diffuse.inuse, G.ambient.inuse], [[true, ...F6], [true, ...F6]]);
eq('C2 golden: Transparency / Reflection off by default: those ports untouched', [G.transparency, G.reflectivity], [null, null]);
eq('C2 golden: SharedMatAction 3 in batch mode never makes the material local', G.stillShared, true);
hasLog('C2 golden: advanced sharing prompt logged as "<title>: <prompt>" (empty title, Q4)', G.log, /^info\|: The material " Scene_Material ", used by 1 object in the selection list \( sphere \), is a shared property\.\n\nCreate a local material for the object in the selection that uses this material\?$/);
eq('port paths: object path, library path, material path', G.paths, ['Sources.Materials.DefaultLib.Scene_Material.diffuse_blend.color1', 'Sources.Materials.DefaultLib.Scene_Material.diffuse_blend.color1', 'Sources.Materials.DefaultLib.Scene_Material.Phong.diffuse']);
eq('C1 an existing Mix_8colors with a free layer is reused, the next free layer taken', [G.again.created, G.again.diffuse.name, G.again.diffuse.color.slice(0, 3), G.again.diffuse.inuse.slice(0, 3), G.again.ambientName], [['Checkerboard'], 'diffuse_blend', ['Image', 'Checkerboard', null], [true, true, false], 'ambient_blend']);
eq('C2 undo: ports cleared, shaders gone, port value kept', G.undo, { ambient: null, diffuse: null, nested: 0, diffuseValue: [0.7, 0.7, 0.7] });
eq('C2 redo', G.redo, { diffuse: 'diffuse_blend', color1: 'Image', inuse1: true });
eq('C2 Mode 2: direct connection, no mixer', C.mode2, { created: ['Image'], ambient: 'Image', diffuse: 'Image', same: true, isMix: false });
eq('C2 Mode 2, two presets: first direct, the rest through a mixer (the direct shader moves to base_color)', [C.mode2two.created, C.mode2two.diffuse.name, C.mode2two.diffuse.baseSrc, C.mode2two.diffuse.color[0]], [['Image1', 'Checkerboard'], 'diffuse_blend', 'Image1', 'Checkerboard']);
eq('C2 Mode 1: current shader disconnected (not deleted), then blended', [C.mode1.created, C.mode1.diffuse.name, C.mode1.diffuse.baseSrc, C.mode1.diffuse.color[0], C.mode1.imageStillNested], [['Checkerboard'], 'diffuse_blend', null, 'Checkerboard', true]);
eq('C2 Mode 1 with Transparency / Reflection: ports used, usealphatrans + inverttrans and usealpharefl set', [C.mode1.transparency, C.mode1.reflectivity, C.mode1.usealphatrans, C.mode1.inverttrans, C.mode1.usealpharefl], ['transparency_blend', 'reflectivity_blend', true, true, true]);
eq('SharedMatAction 1: always make local, without asking', C.shared1, { local: true, localName: 'Scene_Material1', onLocal: 'diffuse_blend', sceneUntouched: true, created: 1, asked: 0, undo: true });
eq('SharedMatAction 0: never make local, without asking', C.shared0, { local: false, onScene: 'diffuse_blend', asked: 0 });
eq('SharedMatAction 2, one material not named SceneMaterial: made local without asking', C.shared2one, { local: true, asked: 0 });
eq('SharedMatAction 2, two materials: asked once (1104 / 1105), default No', [C.shared2two.sphereLocal, C.shared2two.log, C.shared2two.created, C.shared2two.cubeDiffuse], [false, ['info|Shared Material: You are about to modify a shared material.  Create local copies of this shared material?'], 2, 'diffuse_blend']);
eq('SharedMatAction 3, two objects on one material: prompt with 1110 and 1113', C.shared3two.log, ['info|: The material " Scene_Material ", used by 2 objects in the selection list  ( sphere and cube), is a shared property.\n\nCreate a local material for each of the 2 objects in the selection that use this material?  ']);
eq('C2 NotifyNoResult (batch): message 1115 under title 1116, logged', [C.notifyBatch.created, C.notifyBatch.log], [0, ['info|Texturing: The preset(s) could not be applied to this selection']]);
eq('C2 NotifyNoResult false: no notice', C.notifyOff, 0);
eq('C2 NotifyNoResult (interactive): a message box with the text', C.notifyInteractive, { opened: 1, text: 'The preset(s) could not be applied to this selection' });
const N = C.nine;
eq('C1 nine presets: nine shaders created once', N.created, ['Image', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Image7', 'Image8']);
eq('C1 nine presets: a chain of two mixers', [N.first.name, N.first.isMix8, N.first.color[6], N.second?.name, N.second?.isMix8], ['diffuse_blend', true, 'diffuse_blend1', 'diffuse_blend1', true]);
eq('C1 nine presets: connected in order (six on the first mixer, three on the second)', N.order, Array(9).fill(true));
eq('C1 nine presets: inuse flags', [N.first.inuse, N.second.inuse], [Array(7).fill(true), [true, true, true, false, false, false, false]]);
eq('C1 scalar port: Color2scalar on the port, mixer behind it, Scalar2color (alpha 1, old value) on base_color', C.scalar, { created: ['Image9'], onPort: 'Color2scalar', mixer: 'shiny_blend', isMix8: true, color1: 'Image9', s2c: 'Scalar2color', s2cAlpha: 1, s2cInput: 50 });
eq('C1 port that is neither colour4 nor scalar is skipped', [C.badType.created, C.badType.onPort], [['Image10'], null]);
hasLog('C1 invalid port type: message 1103 with the port, title "Warning"', C.badType.log, /^info\|Warning: Cannot attach blender to input Sources\.Materials\.DefaultLib\.[A-Za-z0-9_]+\.Phong\.bump: invalid type$/);
eq('C1 names: unknown name skipped, empty dropped, an image file path becomes an Image shader with a clip on tex', [C.names.created, C.names.clip, C.names.ambient], [['Image11'], 'a_png', 'ambient_blend']);
hasLog("C1 unknown name: warning Could not create preset or image '<name>'", C.names.log, /Could not create preset or image 'Nope'$/);
eq('C1 ports of two materials: empty result', C.twoContainers, 'array(0)');
eq('C1 no usable names: empty result', C.noNames, 'array(0)');
eq('C1 Insp form inspects the created shaders', C.insp, { created: ['Checkerboard'], inspected: ['Checkerboard'] });
eq('C2 Insp form inspects the created shaders', [C.insp2.created.length, C.insp2.inspected], [1, C.insp2.created]);
eq('C3 a Mix_2colors named "mixer" on each port, one shader named "Shader" on color1 of both, old r,g,b on color2; inspects the shader; returns nothing (Q3)', C.c3,
  { err: null, ret: 'undefined', mixers: ['mixer', 'mixer1'], mixerType: ['sib_color_2mix.spdl', 'sib_color_2mix.spdl'], shader: ['Shader', 'Shader'], same: true, color2: [[0.3, 0.3, 0.3], [0.7, 0.7, 0.7]], inspected: ['Shader'], nested: ['mixer', 'Shader', 'mixer1'] });

// 9. D
const Dd = got.D; const IMG = 'txt2d-image-explicit.spdl';
eq('D2 golden: one layer Image_Layer on the Phong, weight 1, two ports (ambient, diffuse), an Image shader on its color', [Dd.golden.err, Dd.golden.kind, Dd.golden.layers, Dd.golden.onPhong],
  [null, 'array(1)', [{ name: 'Image_Layer', weight: 1, ports: ['ambient', 'diffuse'], targets: ['Phong.ambient', 'Phong.diffuse'], color: 'Image', colorPreset: IMG, containers: ['Phong'] }], ['Image_Layer']]);
eq('D2 golden: layer ports drive the two parameters, no shader directly on them', [Dd.golden.portsOnAmbient, Dd.golden.portsOnDiffuse, Dd.golden.directShader], [1, 1, null]);
eq('D2 golden: SharedMatAction 2 made the material local without asking; Scene_Material untouched', [Dd.golden.local, Dd.golden.asked, Dd.golden.sceneUntouched], [true, 0, true]);
eq('D2 Mode 1: all connections of the ports removed first, layer ports included', [Dd.mode1.layers.map(l => l.name), Dd.mode1.onPhong, Dd.mode1.oldLayerPorts, Dd.mode1.portsOnDiffuse], [['Checkerboard_Layer'], ['Image_Layer', 'Checkerboard_Layer'], 0, ['Checkerboard_Layer']]);
eq('D2 undo', [Dd.mode1Undo, Dd.goldenUndo], [{ onPhong: ['Image_Layer'], oldLayerPorts: 2 }, { local: false }]);
eq('D2 Mode 2: an Image shader directly on both ports and no layer', Dd.mode2, { result: [{ shader: 'Image' }], ambient: 'Image', diffuse: 'Image', same: true, layers: [] });
eq('D2 Mode 2, two presets: the result mixes a shader and a layer', [Dd.mode2two.result.map(x => x.shader ?? x.name), Dd.mode2two.diffuse, Dd.mode2two.layers, Dd.mode2two.result[1].ports], [['Image1', 'Checkerboard_Layer'], 'Image1', ['Checkerboard_Layer'], ['ambient', 'diffuse']]);
eq('D2 nothing created: message 1195 under title 1197', [Dd.notify.created, Dd.notify.log], [0, ['info|Texturing: The preset(s) could not be applied to this selection']]);
eq('D1 one layer per preset, weight 1, ports added; an image file path goes through B3', Dd.d1.layers?.map(l => [l.name, l.weight, l.ports, l.color]), [['Image_Layer', 1, ['ambient', 'diffuse'], 'Image'], ['Checkerboard_Layer', 1, ['ambient', 'diffuse'], 'Checkerboard'], ['a_tga_Layer', 1, ['ambient', 'diffuse'], 'Image1']]);
eq('D1 layers are added after the existing ones', Dd.d1.onPhong, ['Image_Layer', 'Checkerboard_Layer', 'a_tga_Layer']);
eq("D1 a name that gives no layer: warning Could not create preset or image '<name>'", Dd.d1.log.filter(l => /Could not create preset or image 'Nope'$/.test(l)).length, 1);
eq('D1 ports of two materials / no ports: empty result', [Dd.d1TwoContainers, Dd.d1NoPorts], ['array(0)', 'array(0)']);
eq('D1 Insp form inspects the shader on each layer colour', [Dd.d1Insp.layers.map(l => l.color), Dd.d1Insp.inspected], [['Image2'], ['Image2']]);
eq('D3 one layer per clip: <clip>_Layer, weight 1, port, Image shader with the clip on tex, maskmode 0', [Dd.d3.err, Dd.d3.layers?.map(l => [l.name, l.weight, l.ports]), Dd.d3.tex, Dd.d3.mask], [null, [['bark_pic_Layer', 1, ['diffuse']]], true, 0]);
eq("D3 a failure: warning Could not blend in clip '<clip>'", Dd.d3.log.filter(l => /Could not blend in clip 'sphere'$/.test(l)).length, 1);
eq('D3 Insp form inspects the shader on the layer colour', Dd.d3.inspected.length, 1);
eq('D3 clip by name', Dd.d3b.layers?.map(l => l.ports), [['ambient']]);
eq('D4 two clips: not yet attested (Q13), nothing changed', [/^not yet attested: /.test(Dd.d4Two.err ?? ''), Dd.d4Two.nya, Dd.d4Two.local], [true, true, false]);
eq('D4 one clip: D2 result, the clip on the tex of the shader on the layer colour', [Dd.d4.err, Dd.d4.layers?.map(l => [l.name, l.weight, l.ports, l.color]), Dd.d4.tex, Dd.d4.onPhong], [null, [['Image_Layer', 1, ['ambient', 'diffuse'], 'Image']], true, ['Image_Layer']]);
eq('D4 an item that is neither clip nor source is reported and skipped', Dd.d4.log.length, 1);
eq('D4 one clip, Mode 2: the clip goes on the directly connected shader; Insp form inspects it', Dd.d4Mode2, { result: [{ shader: 'Image' }], diffuse: 'Image', tex: true, layers: [], inspected: ['Image'] });
eq('D4 no clips: empty result', Dd.d4None, 'array(0)');

// 10. E
const E = got.E;
eq('E1 ports grouped by connected shader; unconnected ports each their own group; one shader per group', [E.err, E.inserted], [null, ['ins', 'ins1', 'ins2']]);
eq('E1 group with a shader: new shader on all its ports, old shader on the main input', [E.ambient, E.diffuse, E.sameOnGroup, E.mainInput], ['ins', 'ins', true, true]);
eq('E1 unconnected ports: own shader each, main input left empty', [E.specular, E.radiance, E.emptyGroupInput, E.separate], ['ins1', 'ins2', null, true]);
eq('E1 no main input: the displaced shader survives (delete on last disconnection false)', E.noMain, { inserted: ['Mix_2colors'], ambient: 'Mix_2colors', displacedSurvives: true, displacedPath: 'ins' });
eq('E1 scalar port: a converter is placed in front of the new shader', E.scalar, { inserted: ['Invert'], onPort: 'Color2scalar', behind: 'Invert' });
eq('E1 ports of two shader containers: nothing returned, nothing changed', [E.twoContainers.ret, E.twoContainers.untouched], ['undefined', true]);
hasLog('E1 error text spelled as shipped', E.twoContainers.log, /^error\|Failed to insert a shaderbecause the targeted ports are not within the same shader container\.$/);
hasLog('E1 invalid preset: "Invalid preset: shader not found"', E.badPreset.log, /^error\|Invalid preset: shader not found$/);
eq('E1 undoable', E.undo, { ambient: 'Image', specular: null, shiny: null });

// 11. F
const F = got.F;
eq('F SIApplyShaderToCnxPoint: creates a shader from a preset name, connects it, returns it', F.apply, { err: null, kind: 'Shader', name: 'Image', onPort: true, nested: true, log: [] });
eq('F SIApplyShaderToCnxPoint: preset path, Name, several ports; Color2scalar in front on a scalar port', [F.applyScalar.name, F.applyScalar.shiny, F.applyScalar.behind, F.applyScalar.ambient], ['chk', 'Color2scalar', true, true]);
eq('F SIApplyShaderToCnxPoint: Value other than the default says "not yet attested" (Q14)', F.applyScalar.valueLog, 1);
eq('F SIApplyShaderToCnxPoint: Conversion\\Scalar2color preset', F.applyConv, { name: 'Scalar2color', file: 'sib_scalar_to_color.spdl', onPort: true });
eq('F SIApplyShaderToCnxPoint: no known converter: nothing on the port, says so (Q14)', [F.applyNoConv.onPort, F.applyNoConv.log], [null, 1]);
eq('F SIApplyShaderToCnxPoint: unknown preset returns nothing, logs an error', F.applyBad, { kind: 'null', err: null, log: 1 });
eq('F SIApplyShaderToCnxPoint2: shader from a ProgID', F.progid, { err: null, name: 'viaProgID', file: IMG, onPort: true });
eq('F SIApplyShaderToCnxPoint2: mixer ProgID / unknown ProgID', [F.progidMix, F.progidBad], [{ name: 'Mix_8colors', isMix8: true }, { kind: 'null', err: null }]);
eq('F SIConnectShaderToCnxPoint: returns the object that ends up on the port', F.connect, { err: null, returnsSource: true, onPort: true });
eq('F SIConnectShaderToCnxPoint: returns the converter when one had to be inserted', F.connectConv, { returned: 'Color2scalar1', isConverter: true, behind: true });
eq('F SIConnectShaderToCnxPoint: Source may be an image clip', F.connectClip, { returnsClip: true, onPort: true, texValue: 'bark_pic' });
eq('F SIConnectShaderToCnxPoint: nothing when no converter exists', F.connectClipColour, { kind: 'null', onPort: null });
eq('F DeleteOnLastDisconnection true: the displaced shader goes', F.deleteTrue, { onPort: true, victimNested: false });
eq('F DeleteOnLastDisconnection: undo restores the displaced shader', F.deleteUndo, { onPort: true, victimNested: true });
eq('F DeleteOnLastDisconnection false: the displaced shader survives', F.deleteFalse, { onPort: true, victimNested: true });
match('F a connection that would close a loop is refused (message 69)', F.cycle, /would cause a cycle/);
eq('F ports of two shader containers: nothing', F.connectTwoContainers, 'null');
eq('F UIApplyShaderToCnxPoints: runs, applies nothing, says "not yet attested" (Q15)', F.ui, { err: null, ret: 'undefined', log: 1, ambientUnchanged: true });
eq('F pop-up commands: run on a selected object, open no menu, say "not yet attested" (Q15)', F.popup, { err: [null, null], ret: ['null', 'undefined'], log: [1, 1], accepted: [true, true], menusOpened: 0 });
eq('F EmbeddedCommand selection filter: scene object accepted, null excluded, min=1', F.filter, { sphere: true, nullOnly: false, none: false, mixed: ['sphere'], min: 1 });

eq('UI: scene with mixers and layers redraws', got.ui, { ok: true });
eq('no page errors', pageErrors, []);

if (fails.length) {
  console.error(`FAIL CMD-01c texture layer commands: ${fails.length} of ${checks} checks`);
  process.exit(1);
}
console.log(`OK CMD-01c texture layer commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet, note Q2)`);
console.log('   fully wired from the contract: groups A-E (20 commands), SIApplyShaderToCnxPoint, SIApplyShaderToCnxPoint2, SIConnectShaderToCnxPoint (as far as attested)');
console.log('   raise / log "not yet attested": BlendClipsInTextureLayers[Insp] with two or more clips (Q13), Value of SIApplyShaderToCnxPoint[2] (Q14), UIApplyShaderToCnxPoints and the two pop-up menus (Q15)');
