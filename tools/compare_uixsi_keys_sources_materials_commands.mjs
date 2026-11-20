// CMD-B6a: the 25 uixsiscripts.vbs commands of part a on the command bus (InspectMaterial, Store...Properties,
// AddToContainer / RemoveFromContainer, SaveActionKey, SaveKeyOnMarkedKeyable, SaveShapeKey, OffsetValueMap,
// SaveOffsetKeys, the seven DeleteUnused... commands, MergeScene, Align, ApplyPath, CreateCurve, AssembleNurbsMesh,
// AddComponentTool, ToggleContinuousDraw).
// Checked against the "Wire contract" of docs/ghidra/cmd-b6a-uixsi-keys-sources-materials.md and the registry dump
// data/commands_full.json. No XSIBATCH golden exists for this row, so this is a contract check: registration with
// the registry's argument list, a run with default arguments, and the contract's stated results.
// Delegated calls are read from app.uixsiKeysSourcesMaterials.calls; the dialog entries of Align, ApplyPath and
// AssembleNurbsMesh are app.uixsiKeysSourcesMaterials.ui.<Name>(args).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_uixsi_keys_sources_materials_commands.mjs
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

// scripting name -> script procedure of the registry entry that is registered on the bus (the scripted / generic one)
const HANDLERS = {
  InspectMaterial: 'InspectMaterial', StoreGeomApproxProperties: 'StorePropertiesProc', StoreMaterialProperties: 'StorePropertiesProc',
  StoreVisibilityProperties: 'StorePropertiesProc', AddToContainer: 'AddToContainer', RemoveFromContainer: 'RemoveFromContainer',
  SaveActionKey: 'SaveKeyProc', SaveKeyOnMarkedKeyable: 'SaveKeyOnKeyableProc', SaveShapeKey: 'SaveShapeKeyProc', OffsetValueMap: 'OffsetValueMapProc',
  SaveOffsetKeys: 'SaveOffsetKeysProc', DeleteUnusedCacheSources: 'CleanCacheSourceProc', DeleteUnusedImageSources: 'CleanImageSourceProc',
  DeleteUnusedImageClips: 'CleanImageClipProc', DeleteUnusedAnimationSources: 'CleanAnimationSourceProc', DeleteUnusedAudioSources: 'CleanAudioSourceProc',
  DeleteUnusedMaterials: 'RemoveUnusedMaterialsProc', DeleteAllUnusedMaterials: 'RemoveAllUnusedMaterialsProc', MergeScene: 'MergeSceneProc',
  Align: 'AlignProc', ApplyPath: 'ApplyPathProc', CreateCurve: 'CreateCurve', AssembleNurbsMesh: 'ScriptAssembleNurbsMeshProc',
  AddComponentTool: 'InsertCompoOnSelectionProc', ToggleContinuousDraw: 'ToggleValueProc',
};
const UI_HANDLERS = { Align: 'GetInputAndAlignProc', ApplyPath: 'GetInputAndApplyPathProc', AssembleNurbsMesh: 'AssembleNurbsMeshProc' };
const NAMES = Object.keys(HANDLERS);

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
const entry = (n, h) => list.find(x => x.scripting_name === n && x.handler === h);
const argsOf = (c, n) => c ? c.args.filter(a => !(n === 'MergeScene' && a.name === 'CreatedObj')).map(a => [a.name, a.default ?? null]) : null;   // MergeScene: fifth registry argument is a dump artefact (note, Q8)
const registry = Object.fromEntries(NAMES.map(n => [n, argsOf(entry(n, HANDLERS[n]), n)]));
const registryLabels = Object.fromEntries(NAMES.map(n => [n, entry(n, HANDLERS[n])?.name ?? null]));
const registryUI = Object.fromEntries(Object.keys(UI_HANDLERS).map(n => [n, argsOf(entry(n, UI_HANDLERS[n]), n)]));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('ToggleContinuousDraw') && !!window.Application?.uixsiKeysSourcesMaterials, null, { timeout: 90000 });
await page.waitForTimeout(500);

const got = await page.evaluate(async ({ NAMES }) => {
  const app = window.Application; const S = app.uixsiKeysSourcesMaterials; const root = app.scene.root;
  const out = {};
  const ser = (v) => v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(ser) : typeof v === 'object' ? (v.fullName ? `node:${v.name}` : typeof v.then === 'function' ? '<promise>' : `{${Object.keys(v).join(',')}}`) : v;
  const run = (n, a = {}) => { try { const v = app.run(n, a); return { v: ser(v), raw: v }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const pub = (r) => r.err !== undefined ? { err: r.err } : { v: r.v };
  const mark = () => { S.calls.length = 0; return app.log.length; };
  const logFrom = (i, kinds = ['info', 'error']) => app.log.slice(i).filter(l => kinds.includes(l.kind)).map(l => `${l.kind}:${l.text}`);
  const calls = () => [...S.calls];
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
  const find = (n) => app.scene.find(n);
  const names = () => [...app.scene.allObjects()].map(o => o.name);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const lpos = (o) => ['posx', 'posy', 'posz'].map(n => r4(o.kinematics.local.val(n)));
  const setPos = (o, p) => ['posx', 'posy', 'posz'].forEach((n, i) => { o.kinematics.local.get(n).value = p[i]; });
  const q = (s) => document.querySelector(s);
  const settle = async (p) => { try { return { v: ser(await p) }; } catch (e) { return { err: String(e?.message ?? e) }; } };
  const Property = root.properties[0].constructor; const Material = app.scene.materials[0].constructor;
  const mkProp = (name, type, defs = []) => new Property(name, type, defs);
  const strDef = (name, value) => ({ name, type: 'string', value });
  const cube = find('cube'), sphere = find('sphere'), sphere1 = find('sphere1');
  const mkNull = (name, p) => { const o = run('GetPrim', { PresetObj: 'Null', Name: name }).raw; setPos(o, p); return o; };
  const keysOf = (p) => (app.anim.fcurve(p)?.keys ?? []).map(k => [r4(k.time), r4(k.value)]);
  const insp = () => S.lastInspect ? [S.lastInspect.via, S.lastInspect.nodes.map(n => n.name), S.lastInspect.keywords ?? null, S.lastInspect.title ?? null] : null;
  app.autoInspect = false;
  const frame0 = app.anim.frame;

  // ---- registration
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(a => [a.name, a.default ?? null]) : null]; }));
  out.labels = Object.fromEntries(NAMES.map(n => [n, app.commands.get(n)?.label ?? null]));
  out.uiArgs = Object.fromEntries(Object.keys(S.ui).map(n => [n, S.uiArgs[n].map(a => [a.name, a.default ?? null])]));
  out.natives = Object.keys(S.native).filter(n => !!S.native[n]).sort();

  // ---- every command with default arguments, nothing selected, no user session
  out.defaults = {};
  app.Interactive = false;
  for (const n of NAMES) {
    app.select([]); app.compSel = null; const m = mark(); const before = names();
    const r = run(n); await tick(5);
    const made = names().filter(x => !before.includes(x));
    out.defaults[n] = { r: pub(r), n: Array.isArray(r.raw) ? r.raw.length : null, log: logFrom(m), calls: calls(), made: made.map(x => find(x).type), tool: app.activeTool?.name ?? null, views: { ...S.views } };
    if (app.activeTool) app.setTool(null);
    for (const x of made) run('DeleteObj', { InputObj: x });
  }
  S.views.ContinuousDraw = undefined; delete S.views.ContinuousDraw;
  app.Interactive = true;

  // ================= InspectMaterial
  {
    app.select([sphere]); const m = mark();
    const r = run('InspectMaterial', { InputObjs: 'cube' });
    const sh = app.scene.materials[0].surface;
    out.inspectMaterial = [pub(r), S.lastInspect.nodes.length, S.lastInspect.nodes[0] === sh, S.lastInspect.keywords, app.selection.length === 1 && app.selection[0] === sphere, calls()];
    app.select([cube]); run('InspectMaterial'); out.inspectMaterialSel = [S.lastInspect.nodes[0] === sh];
    void m;
  }

  // ================= Store...Properties
  {
    const d = {}; app.select([cube, sphere]); run('CreateGroup', { Name: 'grpS' }); const g = app.scene.groupList.find(x => x.name === 'grpS');
    d.group = g ? g.members.map(o => o.name) : null;
    // cube: a local geometry approximation; sphere: a shared (inherited) one
    const gaOf = (o) => o.properties.find(p => p.type === 'geomapprox') ?? o.addProperty(mkProp('Geometry Approximation', 'geomapprox', [{ name: 'gapproxmosl', type: 'int', value: 2 }]));
    const ga = gaOf(cube), shared = gaOf(sphere); const was = [ga.shared, shared.shared]; ga.shared = false; shared.shared = true;
    app.select([]); let m = mark();
    d.run = pub(run('StoreGeomApproxProperties', { InputObjs: 'grpS' }));
    const ov = (g.properties ?? []).find(p => p.name === 'Override');
    d.first = [!!ov, ov?.type ?? null, (ov?.stored ?? []).map(e => [e.source.includes('cube'), Object.keys(e.values).length > 0]), insp(), calls(), logFrom(m).filter(l => /not yet attested/.test(l)).length];
    m = mark(); run('StoreGeomApproxProperties', { InputObjs: 'grpS' });
    d.second = [(g.properties ?? []).filter(p => p.name === 'Override').length, calls()];
    m = mark(); run('StoreVisibilityProperties', { InputObjs: 'grpS' });
    d.visibility = [(ov?.stored ?? []).length, calls()];
    // an object without a local material: the override is created and inspected, nothing is stored
    m = mark(); d.materialRun = pub(run('StoreMaterialProperties', { InputObjs: 'sphere1' }));
    const ov2 = sphere1.properties.find(p => p.name === 'Override');
    d.material = [!!ov2, (ov2?.stored ?? []).length, insp(), calls()];
    app.undo(); d.materialUndo = !!sphere1.properties.find(p => p.name === 'Override');
    // a local material is stored
    const lm = new Material('LocalMat'); app.scene.materials.push(lm); sphere1.setMaterial(lm);
    m = mark(); run('StoreMaterialProperties', { InputObjs: 'sphere1' });
    const ov3 = sphere1.properties.find(p => p.name === 'Override');
    d.materialLocal = [(ov3?.stored ?? []).map(e => /LocalMat/.test(e.source)), calls()];
    sphere1.setMaterial(null); app.scene.materials.splice(app.scene.materials.indexOf(lm), 1); if (ov3) sphere1.removeProperty(ov3);
    ga.shared = was[0]; shared.shared = was[1];
    out.store = d;
  }

  // ================= containers
  {
    const d = {}; const g = app.scene.groupList.find(x => x.name === 'grpS'); app.select([]);
    let m = mark(); d.add = [pub(run('AddToContainer', { Target: 'grpS', InputObjs: 'sphere1' })), g.members.map(o => o.name), calls()];
    m = mark(); d.remove = [pub(run('RemoveFromContainer', { Target: 'grpS', InputObjs: 'sphere1' })), g.members.map(o => o.name), calls()];
    app.select([sphere1]); run('AddToContainer', { Target: 'grpS' }); d.addSelection = g.members.map(o => o.name); run('RemoveFromContainer', { Target: 'grpS' }); app.select([]);
    m = mark(); d.folder = [pub(run('AddToContainer', { Target: 'cube', InputObjs: 'sphere1' })), logFrom(m).some(l => /not yet attested: MoveToFolder/.test(l))];
    m = mark(); d.folderRemove = [pub(run('RemoveFromContainer', { Target: 'cube', InputObjs: 'sphere1' })), logFrom(m).some(l => /not yet attested: RemoveFromFolder/.test(l))];
    d.unknown = [run('AddToContainer', { Target: 'noSuchThing', InputObjs: 'cube' }).err ?? null, run('RemoveFromContainer', { Target: 'noSuchThing' }).err ?? null];
    out.containers = d;
  }

  // ================= key saving (key marker 7, current frame unchanged)
  {
    const d = {}; app.anim.keyMarker = 7; const f = app.anim.frame;
    const px = cube.kinematics.local.get('posx'), py = cube.kinematics.local.get('posy');
    app.anim.setKey(px, 1, 0); px.value = 3;
    let m = mark(); d.action = [pub(run('SaveActionKey', { InputObjs: 'cube.kine.local.posx', Time: 99 })), keysOf(px), app.anim.frame === f, S.out.SaveActionKey.Time, calls()];
    d.bogus = run('SaveActionKey', { InputObjs: 'cube.kine.local.posx', Source: 'Bogus' }).err ?? null;
    d.caseSensitive = run('SaveActionKey', { InputObjs: 'cube.kine.local.posx', Source: 'action' }).err ?? null;
    app.select([cube]); app.prefValues ??= {};
    const route = (v) => { if (v === undefined) delete app.prefValues['preferences.animation.save_key_command']; else app.prefValues['preferences.animation.save_key_command'] = v; mark(); const r = run('SaveActionKey', { Source: 'FCurve' }); return [calls(), r.err ?? null]; };
    d.fcurve = [route(undefined), route(1), route(2), route(3), route(9)];
    delete app.prefValues['preferences.animation.save_key_command'];
    app.anim.marked.clear(); app.anim.marked.add(py); py.value = 4;
    m = mark(); d.marked = [pub(run('SaveKeyOnMarkedKeyable', { Time: 55, Source: 'Whatever' })), keysOf(py), app.anim.frame === f, S.out.SaveKeyOnMarkedKeyable.Time, calls()];
    app.anim.marked.clear();
    m = mark(); d.offset = [pub(run('OffsetValueMap', { InputObjs: 'cube.kine.local.posx', Time: 3, Value: 1 })), app.anim.frame, S.out.OffsetValueMap.Time, calls()];
    app.anim.frame = f; app.anim.keyMarker = 9;
    m = mark(); d.offsetKeys = [pub(run('SaveOffsetKeys', { InputObjs: 'cube.kine.local.posx', Time: 3 })), app.anim.frame, S.out.SaveOffsetKeys.Time, calls()];
    m = mark(); run('SaveOffsetKeys', { Time: 9 }); d.offsetKeysSame = [app.anim.frame, calls().includes('Refresh')];
    app.anim.frame = f; delete app.anim.keyMarker;
    app.anim.removeAnimation?.(px); app.anim.removeAnimation?.(py); px.value = 0; py.value = 0;
    out.keys = d;
  }

  // ================= SaveShapeKey
  {
    const d = {}; const f = app.anim.frame; const shapeKeys = (o) => o.properties.filter(p => p.type === 'shapekey').length;
    const T1008 = 'Shapes only store deformations you applied while in a shape modeling construction mode.';
    run('SetConstructionMode', { Mode: 'modeling' }); app.constructionAutoUpdate = false; app.anim.keyMarker = 5;
    // no user session: the warning is logged and answered OK
    app.Interactive = false; app.select([cube]); let m = mark();
    let r = run('SaveShapeKey', { Name: 'ShapeA', Time: 1, RefMode: 'callerValue' });
    d.batch = [pub(r), shapeKeys(cube), cube.properties.some(p => p.type === 'shapekey' && p.name === 'ShapeA'), logFrom(m).some(l => l.startsWith('info:Warning: ' + T1008)), calls().filter(c => !/^SetConstructionMode$/.test(c)).slice(0, 3), insp()?.slice(0, 2), app.anim.frame, S.out.SaveShapeKey];
    app.anim.frame = f;
    // several items: point sub-component items are skipped, the clips come back
    app.select([]); m = mark();
    r = run('SaveShapeKey', { InputObj: 'cube,sphere,sphere1.pnt[1,2]', Time: 2 });
    d.multi = [Array.isArray(r.raw) ? r.raw.length : r.err ?? r.v, shapeKeys(cube), shapeKeys(sphere), shapeKeys(sphere1), calls().filter(c => /ShapeKey|AutoInspect/.test(c)), S.lastInspect.nodes.length, app.anim.frame];
    app.anim.frame = f;
    // RefMode comes from the preference
    app.prefValues ??= {}; app.prefValues['Preferences.shape_animation.ShapeReference'] = 2; app.select([sphere]);
    run('SaveShapeKey'); d.refPref = S.out.SaveShapeKey.RefMode; delete app.prefValues['Preferences.shape_animation.ShapeReference'];
    app.anim.frame = f;
    // construction mode auto update switches to the shape mode; in a shape mode there is no warning
    app.constructionAutoUpdate = true; app.select([sphere]); m = mark(); run('SaveShapeKey');
    d.autoUpdate = [logFrom(m).some(l => /Construction mode: shape/.test(l)), calls().includes('SetConstructionMode')];
    m = mark(); run('SaveShapeKey'); d.inShapeMode = [logFrom(m).some(l => l.includes(T1008)), calls().includes('SetConstructionMode')];
    app.constructionAutoUpdate = false; app.anim.frame = f;
    // user session: OK / Cancel box, Cancel raises siErrCancelled before anything changes
    run('SetConstructionMode', { Mode: 'modeling' }); app.Interactive = true; app.select([sphere1]);
    const n0 = shapeKeys(sphere1);
    r = run('SaveShapeKey'); await tick();
    const box = q('.uixsi-msgbox'); d.box = [r.v, !!box, box?.querySelector('.sdkh-msg-text')?.textContent.startsWith(T1008) ?? false, !!box?.querySelector('.sdkh-modal-cancel')];
    box?.querySelector('.sdkh-modal-cancel').click(); const c = await settle(r.raw); await tick();
    d.cancel = [c.err ?? null, shapeKeys(sphere1) - n0, !!q('.uixsi-msgbox')];
    r = run('SaveShapeKey'); await tick(); q('.uixsi-msgbox')?.querySelector('.sdkh-modal-ok').click(); const o = await settle(r.raw); await tick();
    d.ok = [o, shapeKeys(sphere1) - n0, !!q('.uixsi-msgbox')];
    app.anim.frame = f; delete app.anim.keyMarker;
    for (const x of [cube, sphere, sphere1]) for (const p of x.properties.filter(p => p.type === 'shapekey')) x.removeProperty(p);
    app.select([]);
    out.shape = d;
  }

  // ================= unused sources and clips
  {
    const d = {}; const rp = () => root.properties.map(p => p.name); app.select([]);
    const mat = app.scene.materials[0];
    run('CreateImageClip', { FileName: 'a.pic', Name: 'a_pic' }); run('CreateImageClip', { FileName: 'b.pic', Name: 'b_pic' }); app.select([]);
    mat.get('ImageClipName').value = 'a_pic';
    let m = mark(); d.clips = [pub(run('DeleteUnusedImageClips')), rp().includes('a_pic'), rp().includes('b_pic'), calls(), logFrom(m)];
    app.undo(); d.clipsUndo = rp().includes('b_pic'); app.redo();
    m = mark(); run('DeleteUnusedImageClips'); d.singleUsed = [rp().includes('a_pic'), calls()];
    root.addProperty(mkProp('srcA', 'imagesource', [strDef('filename', 'a.pic')])); root.addProperty(mkProp('srcZ', 'imagesource', [strDef('filename', 'z.pic')])); root.addProperty(mkProp('srcY', 'imagesource', [strDef('filename', 'y.pic')]));
    m = mark(); d.sources = [pub(run('DeleteUnusedImageSources')), rp().includes('srcA'), rp().includes('srcZ'), rp().includes('srcY'), calls()];
    // the two passes are independent: the source of a clip that was just removed needs a second command
    mat.get('ImageClipName').value = ''; m = mark(); run('DeleteUnusedImageClips'); d.singleUnused = [rp().includes('a_pic'), rp().includes('srcA'), calls()];
    m = mark(); run('DeleteUnusedImageSources'); d.sourceSecondPass = [rp().includes('srcA'), calls()];
    // mixed list with nothing unused: DeleteObj is still issued, on an empty list
    run('CreateImageClip', { FileName: 'c.pic', Name: 'c_pic' }); run('CreateImageClip', { FileName: 'd.pic', Name: 'd_pic' }); app.select([]);
    mat.get('ImageClipName').value = 'c_pic'; const dp = root.properties.find(p => p.name === 'd_pic'); const tex = mkProp('texHolder', 'x', []);
    const keepUsed = app.scene.materials[0].surface; const added = keepUsed.add({ name: 'uixsiTex', type: 'string', value: 'd_pic' });
    m = mark(); run('DeleteUnusedImageClips'); d.allUsed = [rp().includes('c_pic'), rp().includes('d_pic'), calls()];
    added.value = ''; mat.get('ImageClipName').value = ''; run('DeleteUnusedImageClips'); d.allUnused = [rp().includes('c_pic'), rp().includes('d_pic')];
    void dp; void tex;
    // animation, audio and cache sources
    root.addProperty(mkProp('UsedAction', 'actionsource', [])); root.addProperty(mkProp('FreeAction', 'actionsource', []));
    const mix = root.properties.find(p => p.type === 'mixer'); const hadClips = mix.clips; mix.clips = [...(mix.clips ?? []), { name: 'UsedAction_Clip', source: 'UsedAction', start: 1, duration: 10 }];
    m = mark(); d.anim = [pub(run('DeleteUnusedAnimationSources')), rp().includes('UsedAction'), rp().includes('FreeAction'), calls()];
    mix.clips = hadClips; run('DeleteUnusedAnimationSources'); d.animAfter = rp().includes('UsedAction');
    root.addProperty(mkProp('Sound', 'audiosource', [])); m = mark(); d.audio = [pub(run('DeleteUnusedAudioSources')), rp().includes('Sound'), calls()];
    root.addProperty(mkProp('Cache', 'filecache', [])); m = mark(); d.cache = [pub(run('DeleteUnusedCacheSources')), rp().includes('Cache'), calls()];
    out.sources = d;
  }

  // ================= unused materials
  {
    const d = {}; const mats = () => app.scene.materials.map(x => x.name);
    const a = new Material('UnusedMat'), b = new Material('LockedMat'), c = new Material('UsedMat'), e = new Material('UnusedMat2'); b.locked = true;
    app.scene.materials.push(a, b, c, e); sphere1.setMaterial(c);
    let m = mark(); d.badInput = [run('DeleteUnusedMaterials', { InputObjs: 'cube' }).err ?? null, mats().length];
    m = mark(); d.run = [pub(run('DeleteUnusedMaterials', { InputObjs: 'Sources.Materials.DefaultLib' })), mats(), logFrom(m), calls()];
    app.undo(); d.undo = mats();
    m = mark(); d.all = [pub(run('DeleteAllUnusedMaterials')), mats(), logFrom(m)];
    m = mark(); run('DeleteAllUnusedMaterials'); d.nothing = logFrom(m);
    m = mark(); run('DeleteUnusedMaterials', { InputObjs: 'Sources.Materials.DefaultLib,cube' }); d.nothing2 = logFrom(m);
    sphere1.setMaterial(null); for (const x of [b, c]) app.scene.materials.splice(app.scene.materials.indexOf(x), 1);
    out.materials = d;
  }

  // ================= MergeScene
  {
    const m = mark(); const before = names().length;
    out.merge = [pub(run('MergeScene', { FileName: 'other.scn', Name: 'Merged' })), names().length - before, logFrom(m).some(l => /MergeScene: not yet attested: SIMergeScene is not on the bus; "other\.scn" not merged/.test(l)), app.commands.has('SIMergeScene')];
  }

  // ================= Align
  {
    const d = {}; const n1 = mkNull('alnA', [0, 0, 0]), n2 = mkNull('alnB', [2, 5, 0]), n3 = mkNull('alnC', [4, 1, 6]);
    const P = () => [lpos(n1), lpos(n2), lpos(n3)]; const reset = () => { setPos(n1, [0, 0, 0]); setPos(n2, [2, 5, 0]); setPos(n3, [4, 1, 6]); };
    app.select([sphere]); let m = mark();
    d.defaults = [pub(run('Align', { InputObjs: 'alnA,alnB,alnC' })), P(), calls(), app.selection.length === 1 && app.selection[0] === sphere];
    app.undo(); d.undo = P();
    reset(); run('Align', { InputObjs: 'alnA,alnB,alnC', AlignAxes: 'siXYZ', RefX: 'siAlignFMIN', RefY: 'siAlignFMIN', RefZ: 'siAlignFMIN', AllObjects: false }); d.toFirst = P();
    reset(); m = mark(); run('Align', { InputObjs: 'alnA,alnB,alnC', AlignAxes: 5, RefX: 'siAlignGMAX', RefZ: 'siAlignGMIN', AllObjects: true }); d.maxMin = [P(), calls().filter(c => c === 'Translate').length];
    reset(); app.select([n1, n2, n3]); run('Align', { AlignAxes: ':siX:siAxesFilter', RefX: ':siAlignGMIDDLE:siAlignModes' }); d.selection = P(); app.select([]);
    // boxes: the anchor comes from the Pos mode (max / min / centre of the item's own box), the reference from the Ref mode
    const cb = (() => { const pts = cube.primitive.mesh().positions; const e = cube.globalMatrix().elements; let lo = Infinity, hi = -Infinity; for (let i = 0; i < pts.length; i += 3) { const x = e[0] * pts[i] + e[4] * pts[i + 1] + e[8] * pts[i + 2] + e[12]; lo = Math.min(lo, x); hi = Math.max(hi, x); } return [r4(lo), r4(hi)]; })();
    reset(); run('Align', { InputObjs: 'cube,alnB', AlignAxes: 'siX', PosX: 'siAlignGMIN', RefX: 'siAlignFMAX', AllObjects: false }); d.boxMax = [lpos(n2)[0] === cb[1], cb[1] > cb[0]];
    reset(); run('Align', { InputObjs: 'cube,alnB', AlignAxes: 'siX', PosX: 'siAlignFMAX', RefX: 'siAlignFMIDDLE', AllObjects: false }); d.boxMid = lpos(n2)[0] === r4((cb[0] + cb[1]) / 2);
    const cubeX = lpos(cube)[0]; setPos(n2, [50, 5, 0]);
    run('Align', { InputObjs: 'alnB,cube', AlignAxes: 'siX', PosX: 'siAlignGMAX', RefX: 'siAlignFMIN', AllObjects: false }); d.boxAnchorMax = r4(lpos(cube)[0] - cubeX) === r4(50 - cb[1]);
    cube.kinematics.local.get('posx').value = cubeX; reset();
    // UI entry
    app.select([]); d.uiEmpty = (await settle(S.ui.Align({}))).err ?? null;
    m = mark(); const p1 = S.ui.Align({ InputObjs: 'alnA' }); await tick();
    const warn = q('.sdkh-msg'); d.uiOne = [logFrom(m)[0] ?? null, !!warn, warn?.querySelector('.sdkh-msg-text')?.textContent ?? null];
    warn?.querySelector('.sdkh-modal-ok').click(); d.uiOneErr = (await settle(p1)).err ?? null; await tick();
    let p = S.ui.Align({ InputObjs: 'alnA,alnB,alnC', AlignAxes: 'siX', AllObjects: false }); await tick();
    const prop = root.properties.find(x => x.name === 'Align');
    d.uiProp = [!!prop, prop?.type ?? null, prop ? prop.params.map(x => [x.name, x.value]) : null, !!q('.uixsi-align'), insp()];
    q('.uixsi-align')?.querySelector('.sdkh-modal-cancel').click(); d.uiCancel = [(await settle(p)).err ?? null, !!root.properties.find(x => x.name === 'Align'), P()]; await tick();
    // the property exists: the arguments are ignored, the values of the previous use are shown
    p = S.ui.Align({ InputObjs: 'alnA,alnB,alnC', AlignAxes: 'siZ', AllObjects: true }); await tick();
    d.uiReuse = [prop.val('doX'), prop.val('doZ'), prop.val('doAllObj'), root.properties.filter(x => x.name === 'Align').length];
    prop.get('doY').value = true; prop.get('refY').value = 0;   // X and Y, Y reference = global minimum
    m = mark(); q('.uixsi-align')?.querySelector('.sdkh-modal-ok').click(); d.uiOk = [await settle(p), P(), S.out.Align, !!root.properties.find(x => x.name === 'Align'), !!q('.uixsi-align')];
    app.Interactive = false; reset(); d.uiBatch = [(await settle(S.ui.Align({ InputObjs: 'alnA,alnB' }))).err ?? null, P()]; app.Interactive = true;
    root.removeProperty(prop); reset();
    out.align = d;
  }

  // ================= CreateCurve
  {
    const d = {}; app.select([cube]); let m = mark(); const before = names();
    const r = run('CreateCurve', { Degree: 3, Points: '(0,0,0),(1,0,0),(2,1,0),(3,1,0),(4,0,0)' });
    const cv = Array.isArray(r.raw) ? r.raw[0] : null; const g = cv?.primitive?.geom();
    d.made = [r.err ?? null, Array.isArray(r.raw) && r.raw.Value === cv, cv?.type ?? null, cv?.parentObj === root, g?.degree ?? null, g?.cvs?.map(c => c.slice(0, 3)) ?? null, S.out.CreateCurve.Value === cv, app.selection.length === 1 && app.selection[0] === cube, calls()];
    d.name = cv?.name ?? null;
    const r2 = run('CreateCurve', { Degree: 1, Points: '(0,0,0),(1,2,3)', Local: true }); const g2 = r2.raw?.[0]?.primitive?.geom();
    d.linear = [g2?.degree ?? null, g2?.cvs?.length ?? null];
    app.undo(); d.undo = names().includes(r2.raw?.[0]?.name);
    m = mark(); const r3 = run('CreateCurve', { CurveType: 1, Points: '(0,0,0),(1,1,0),(2,0,0),(3,1,0)' });
    d.interpolated = [r3.raw?.[0]?.primitive?.geom()?.cvs?.length ?? null, logFrom(m).some(l => /not yet attested: (the interpolated curve type|the drawing style of CurveType 1)/.test(l))];
    run('DeleteObj', { InputObj: r3.raw[0].name });
    out.curve = d; out.curveName = d.name; void before;
  }

  // ================= ApplyPath
  {
    const d = {}; const crv = out.curveName; const n1 = find('alnA'), n2 = find('alnB'), n3 = find('alnC');
    const cns = (o) => o.properties.filter(p => p.targets && p.get('perc'));
    app.select([]); let m = mark();
    d.run = [pub(run('ApplyPath', { InputObjs: 'alnA', Path: crv, StartFrame: 10, EndFrame: 50, NbKeys: 3, Linear: true, Tangent: true }))];
    const c1 = cns(n1)[0];
    d.cns = [cns(n1).length, c1 ? keysOf(c1.get('perc')) : null, c1 ? (app.anim.fcurve(c1.get('perc'))?.keys ?? []).map(k => k.interp) : null, c1?.val('tangent') ?? null, c1?.targets.map(o => o.name) ?? null, insp()?.slice(0, 2), calls().filter(c => c !== 'AutoInspect').filter((c, i, a) => a.indexOf(c) === i), calls().filter(c => c === 'SaveKey').length];
    m = mark(); run('ApplyPath', { InputObjs: 'alnB,alnC', Path: crv, StartFrame: 20, EndFrame: 5 });
    d.two = [cns(n2).length, cns(n3).length, cns(n2)[0] ? keysOf(cns(n2)[0].get('perc')) : null, cns(n2)[0]?.val('tangent') ?? null, S.lastInspect.nodes.length, calls().filter(c => c === 'AutoInspect').length, calls().includes('SetCurveType')];
    app.undo(); d.twoUndo = [cns(n2).length, cns(n3).length];
    m = mark(); d.noops = [pub(run('ApplyPath', { InputObjs: 'alnB' })), pub(run('ApplyPath', { InputObjs: 'alnB', Path: crv, NbKeys: 1 })), pub(run('ApplyPath', { Path: crv })), cns(n2).length, logFrom(m), calls()];
    // UI entry
    const tIn = app.anim.startFrame, tOut = app.anim.endFrame;
    let p = S.ui.ApplyPath({ InputObjs: 'alnB', Path: crv, StartFrame: 3, EndFrame: 4, Linear: true }); await tick();
    const set = root.properties.find(x => x.name === 'ApplyPath');
    d.uiSet = [!!set, set ? set.params.map(x => [x.name, x.value, x.def.min ?? null, x.def.max ?? null, x.def.uimin ?? null, x.def.uimax ?? null]) : null, [tIn, tOut], !!q('.uixsi-applypath'), insp()];
    q('.uixsi-applypath')?.querySelector('.sdkh-modal-cancel').click(); d.uiCancel = [(await settle(p)).err ?? null, !!root.properties.find(x => x.name === 'ApplyPath'), cns(n2).length]; await tick();
    p = S.ui.ApplyPath({ InputObjs: 'alnB', Path: crv, Tangent: true }); await tick();
    const set2 = root.properties.find(x => x.name === 'ApplyPath'); d.uiCrossed = [set2?.val('Linear'), set2?.val('Tangent')];
    set2.get('Start').value = 12; set2.get('End').value = 24;
    q('.uixsi-applypath')?.querySelector('.sdkh-modal-ok').click(); const res = await settle(p); await tick();
    const c2 = cns(n2)[0];
    d.uiOk = [res, c2 ? keysOf(c2.get('perc')) : null, c2 ? (app.anim.fcurve(c2.get('perc'))?.keys ?? []).every(k => k.interp === 1) : null, c2?.val('tangent') ?? null, S.out.ApplyPath, !!root.properties.find(x => x.name === 'ApplyPath'), !!q('.uixsi-applypath')];
    // either input empty: the dialog still appears and OK does nothing
    p = S.ui.ApplyPath({ InputObjs: 'alnC' }); await tick(); const shown = !!q('.uixsi-applypath'); q('.uixsi-applypath')?.querySelector('.sdkh-modal-ok').click();
    d.uiNoPath = [shown, await settle(p), cns(n3).length, !!root.properties.find(x => x.name === 'ApplyPath')]; await tick();
    app.Interactive = false; d.uiBatch = [(await settle(S.ui.ApplyPath({ InputObjs: 'alnC', Path: crv }))).err ?? null, !!root.properties.find(x => x.name === 'ApplyPath'), cns(n3).length]; app.Interactive = true;
    out.path = d;
  }

  // ================= AssembleNurbsMesh
  {
    const d = {}; const isSurf = (o) => (o?.primitive?.type ?? o?.type) === 'surfmsh';
    const a = run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'scmA' }).raw, b = run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'scmB' }).raw;
    d.inputs = [isSurf(a), isSurf(b)];
    app.select([]); let m = mark(); let before = names();
    d.run = [pub(run('AssembleNurbsMesh', { InputObj: 'scmA,scmB', Tolerance: 0.3 }))];
    let made = names().filter(x => !before.includes(x)).map(find);
    d.made = [made.length, isSurf(made[0]), app.selection.length === 1 && app.selection[0] === made[0], insp()?.[0] ?? null, S.lastInspect?.nodes[0] === made[0], calls().filter(c => /Assemble|SelectObj|AutoInspect/.test(c)), logFrom(m, ['error'])];
    for (const x of made) run('DeleteObj', { InputObj: x.name });
    // dialog entry: no surface mesh in the input = silent
    app.select([cube]); d.uiNoSurface = [await settle(S.ui.AssembleNurbsMesh({})), !!q('.uixsi-scm')];
    app.select([a, b]); before = names();
    let p = S.ui.AssembleNurbsMesh({}); await tick();
    const dlg = q('.uixsi-scm'); d.uiDialog = [!!dlg, [...(dlg?.querySelectorAll('.sdkh-row') ?? [])].map(r => r.dataset.param)];
    dlg?.querySelector('.sdkh-modal-cancel').click(); d.uiCancel = [await settle(p), names().length - before.length]; await tick();
    p = S.ui.AssembleNurbsMesh({}); await tick(); m = mark(); q('.uixsi-scm')?.querySelector('.sdkh-modal-ok').click(); const res = await settle(p); await tick();
    made = names().filter(x => !before.includes(x)).map(find);
    d.uiOk = [res, made.length, isSurf(made[0]), app.selection[0] === made[0], !!q('.uixsi-scm')];
    for (const x of made) run('DeleteObj', { InputObj: x.name });
    out.assemble = d;
  }

  // ================= AddComponentTool
  {
    const d = {}; const tool = () => { const t = app.activeTool?.name ?? null; if (app.activeTool) app.setTool(null); return t; };
    app.select([]); let m = mark(); run('AddComponentTool', { InputObjs: 'cube' }); d.mesh = [tool(), calls()];
    m = mark(); run('AddComponentTool', { InputObjs: `${out.curveName},cube` }); d.mixed = tool();
    m = mark(); run('AddComponentTool', { InputObjs: out.curveName }); d.curve = [tool(), logFrom(m).some(l => /not yet attested: AddPointOnCurveTool is not on the bus/.test(l)), app.commands.has('AddPointOnCurveTool')];
    m = mark(); run('AddComponentTool', { InputObjs: 'scmA' }); d.surface = [tool(), logFrom(m), calls()];
    m = mark(); run('AddComponentTool', { InputObjs: 'alnA' }); d.other = tool();
    app.select([find('scmA')]); run('AddComponentTool'); d.selection = tool(); app.select([]);
    out.tool = d;
  }

  // ================= ToggleContinuousDraw
  {
    const d = {}; let m = mark();
    run('ToggleContinuousDraw'); d.first = [S.views.ContinuousDraw, calls()];
    run('ToggleContinuousDraw'); d.second = S.views.ContinuousDraw;
    const cv = cube.properties.find(p => p.type === 'visibility').get('viewvis'), sv = sphere.properties.find(p => p.type === 'visibility').get('viewvis');
    cv.value = true; sv.value = false; m = mark();
    run('ToggleContinuousDraw', { ParamName: 'viewvis', InputObjs: 'cube.visibility,sphere.visibility' }); d.sync = [cv.value, sv.value, calls()];
    run('ToggleContinuousDraw', { ParamName: 'viewvis', InputObjs: 'cube.visibility,sphere.visibility' }); d.back = [cv.value, sv.value];
    m = mark(); run('ToggleContinuousDraw', { ParamName: 'A,B', InputObjs: 'Views' }); d.two = [S.views.A, S.views.B, calls()];
    d.unknown = run('ToggleContinuousDraw', { ParamName: 'nope', InputObjs: 'cube' }).err ?? null;
    out.toggle = d;
  }

  // ---- cleanup
  for (const n of ['alnA', 'alnB', 'alnC', 'scmA', 'scmB', out.curveName]) if (find(n)) run('DeleteObj', { InputObj: n });
  if (app.activeTool) app.setTool(null);
  await tick();
  out.leftover = [app.activeTool === null, !document.querySelector('.sdkh-modal-window'), app.anim.frame === frame0];
  return out;
}, { NAMES });

await browser.close();

let checks = 0; const diffs = [];
const eq = (label, a, b) => { checks++; const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const NONE = { v: '<none>' };
const T1013 = 'Please select at least 2 Objects first';
const CANCEL = (n) => `${n} cancelled (siErrCancelled)`;

// ---- registration
for (const n of NAMES) {
  ok(`${n}: registry entry found (${HANDLERS[n]})`, !!registry[n], n);
  eq(`${n}: registered with the registry's arguments and defaults`, got.reg[n], registry[n]);
  eq(`${n}: display name`, got.labels[n], registryLabels[n]);
}
for (const n of Object.keys(UI_HANDLERS)) eq(`${n}: UI entry (${UI_HANDLERS[n]}) arguments and defaults`, got.uiArgs[n], registryUI[n]);
eq('native twins kept for the five names with a script entry and a native entry', got.natives, ['OffsetValueMap', 'SaveActionKey', 'SaveKeyOnMarkedKeyable', 'SaveOffsetKeys', 'SaveShapeKey']);

// ---- defaults
const D = got.defaults;
const silent = (n) => eq(`${n} with default arguments: silent no-op`, [D[n].r, D[n].log, D[n].made], [NONE, [], []]);
// SIGetMaterialShader is on the bus since CMD-B12f (shadertasks.dll), so InspectMaterial delegates to it instead of its stand-in.
eq('InspectMaterial defaults: nothing selected, nothing to inspect', [D.InspectMaterial.r, D.InspectMaterial.log, D.InspectMaterial.calls], [NONE, [], ['SIGetMaterialShader', 'InspectObj']]);
for (const n of ['StoreGeomApproxProperties', 'StoreMaterialProperties', 'StoreVisibilityProperties', 'DeleteUnusedCacheSources', 'DeleteUnusedImageSources', 'DeleteUnusedImageClips', 'DeleteUnusedAnimationSources', 'DeleteUnusedAudioSources', 'Align', 'ApplyPath']) silent(n);
for (const n of ['AddToContainer', 'RemoveFromContainer']) ok(`${n} defaults: the empty Target fails the dictionary lookup`, /dictionary lookup failed/.test(D[n].r.err ?? ''), D[n]);
eq('SaveActionKey defaults: native SaveActionKey', [D.SaveActionKey.r, D.SaveActionKey.calls], [NONE, ['native SaveActionKey']]);
eq('SaveKeyOnMarkedKeyable defaults: native SaveKeyOnMarkedKeyable (Q1 inferred)', [D.SaveKeyOnMarkedKeyable.r, D.SaveKeyOnMarkedKeyable.calls], [NONE, ['native SaveKeyOnMarkedKeyable']]);
ok('SaveShapeKey defaults (no session): warning 1008 logged, empty clip collection', D.SaveShapeKey.r.v?.length === 0 && D.SaveShapeKey.log.some(l => l.startsWith('info:Warning: Shapes only store deformations')), D.SaveShapeKey);
eq('OffsetValueMap defaults: native OffsetValueMap', [D.OffsetValueMap.r, D.OffsetValueMap.calls], [NONE, ['native OffsetValueMap']]);
eq('SaveOffsetKeys defaults: native SaveOffsetKeys', [D.SaveOffsetKeys.r, D.SaveOffsetKeys.calls[0]], [NONE, 'native SaveOffsetKeys']);
ok('DeleteUnusedMaterials defaults: empty selection is not a material library', /not a material library/.test(D.DeleteUnusedMaterials.r.err ?? ''), D.DeleteUnusedMaterials);
eq('DeleteAllUnusedMaterials defaults: Nothing to delete', [D.DeleteAllUnusedMaterials.r, D.DeleteAllUnusedMaterials.log], [NONE, ['info:Nothing to delete']]);
// CMD-B15a wired SIMergeScene: without FileName (no file browser in batch) it refuses with 0x80070057
if (got.merge[3]) ok('MergeScene defaults: delegated to SIMergeScene (CMD-B15a), no FileName -> 0x80070057', /SIMergeScene.*0x80070057/.test(D.MergeScene.r.err ?? '') && D.MergeScene.calls.includes('SIMergeScene'), D.MergeScene);
else ok('MergeScene defaults: SIMergeScene / file browser flagged not yet attested', D.MergeScene.r.v === '<none>' && D.MergeScene.log.some(l => /not yet attested: SIMergeScene and its file browser/.test(l)), D.MergeScene);
// CMD-B8f put SICreateCurve / SISetCurvePoints on the bus: the wrapper now runs them, and SISetCurvePoints rejects the empty default Points (0x80070057).
eq('CreateCurve defaults: SICreateCurve then SISetCurvePoints, which fails on the empty Points string; nothing is left behind', [/80070057/.test(D.CreateCurve.r.err ?? ''), D.CreateCurve.made, D.CreateCurve.calls], [true, [], ['SICreateCurve', 'SISetCurvePoints']]);
ok('AssembleNurbsMesh defaults: no surface mesh, SIAssembleNurbsMesh creates nothing (CMD-B8e contract)', D.AssembleNurbsMesh.r.v === '<none>' && !D.AssembleNurbsMesh.r.err && D.AssembleNurbsMesh.made.length === 0, D.AssembleNurbsMesh);
ok('AddComponentTool defaults: empty selection = SplitEdgeTool', D.AddComponentTool.calls.includes('SplitEdgeTool') && /split/i.test(D.AddComponentTool.tool ?? ''), D.AddComponentTool);
eq('ToggleContinuousDraw defaults: Views.ContinuousDraw negated, one SetValue', [D.ToggleContinuousDraw.r, D.ToggleContinuousDraw.views, D.ToggleContinuousDraw.calls], [NONE, { ContinuousDraw: true }, ['GetValue', 'SetValue']]);

// ---- InspectMaterial
eq('InspectMaterial: the surface shader of the object\'s material, keyword set Rendering, selection unchanged', got.inspectMaterial, [NONE, 1, true, 'Rendering', true, ['SIGetMaterialShader', 'InspectObj']]);
eq('InspectMaterial: selection when InputObjs is empty', got.inspectMaterialSel, [true]);

// ---- Store...Properties
const st = got.store;
eq('Store: test group', st.group, ['cube', 'sphere']);
eq('StoreGeomApproxProperties on a group: Override created, the local property of the members stored (shared dropped), Override inspected', [st.run, st.first],
  [NONE, [true, 'override', [[true, true]], ['InspectObj', ['Override'], null, null], ['SIAddProp', 'SIStoreProp[1]', 'InspectObj'], 1]]);
eq('Store: an existing Override is reused', st.second, [1, ['SIStoreProp[1]', 'InspectObj']]);
eq('StoreVisibilityProperties: the visibility of every member', st.visibility, [3, ['SIStoreProp[2]', 'InspectObj']]);
eq('StoreMaterialProperties, nothing local: Override created and inspected, nothing stored; undoable', [st.materialRun, st.material, st.materialUndo], [NONE, [true, 0, ['InspectObj', ['Override'], null, null], ['SIAddProp', 'InspectObj']], false]);
eq('StoreMaterialProperties: a local material is stored', st.materialLocal, [[true], ['SIAddProp', 'SIStoreProp[1]', 'InspectObj']]);

// ---- containers
const co = got.containers;
eq('AddToContainer, Target is a Group: SIAddToGroup', co.add, [NONE, ['cube', 'sphere', 'sphere1'], ['SIAddToGroup']]);
eq('RemoveFromContainer, Target is a Group: RemoveFromGroup', co.remove, [NONE, ['cube', 'sphere'], ['RemoveFromGroup']]);
eq('AddToContainer: empty InputObjs is passed through (the group command takes the selection)', co.addSelection, ['cube', 'sphere', 'sphere1']);
// MoveToFolder is on the bus since CMD-B10 (inferred); a Target that is not a folder fails there and the error propagates
eq('AddToContainer, Target is not a Group: MoveToFolder (CMD-B10) rejects a non-folder Target', co.folder, [{ err: 'MoveToFolder: Target is not a folder' }, false]);
// RemoveFromFolder is on the bus since CMD-B10 (inferred); a Target that is not a folder fails there and the error propagates
eq('RemoveFromContainer, Target is not a Group: RemoveFromFolder (CMD-B10) rejects a non-folder Target', co.folderRemove, [{ err: 'RemoveFromFolder: Target is not a folder' }, false]);
ok('Add/RemoveFromContainer: unknown Target = lookup error', co.unknown.every(e => /"noSuchThing" is not in the scene/.test(e ?? '')), co.unknown);

// ---- keys
const k = got.keys;
// CMD-B8a: the native SaveActionKey keys the fcurve of the single unblended action clip that drives the parameter; posx is
// driven by its own fcurve here, so the native entry skips it (the action-clip case is in compare_fcurve_key_task_commands.mjs).
eq('SaveActionKey: native entry called (no action clip drives posx: skipped); current frame unchanged; Time not written back', k.action, [NONE, [[1, 0]], true, 99, ['native SaveActionKey']]);
eq('SaveActionKey: Source other than "Action" / "FCurve" = siErrCancelled (case-sensitive)', [k.bogus, k.caseSensitive], [CANCEL('SaveActionKey'), CANCEL('SaveActionKey')]);
eq('SaveActionKey Source "FCurve": routed by preferences.animation.save_key_command (other, 1, 2, 3, other)', k.fcurve.map(x => x[0]),
  [['SaveKey'], ['SaveKeyOnKeyable'], ['SaveKeyOnMarkedKeyable', 'native SaveKeyOnMarkedKeyable'], ['SaveKeyOnCharacterKeySet'], ['SaveKey']]);
eq('SaveKeyOnMarkedKeyable: native twin at the key-marker time, Source ignored, frame unchanged', k.marked, [NONE, [[7, 4]], true, 55, ['native SaveKeyOnMarkedKeyable']]);
eq('OffsetValueMap: native twin, then Time and the current frame move to the key marker', k.offset, [NONE, 7, 7, ['native OffsetValueMap']]);
eq('SaveOffsetKeys: native twin, Refresh, then the current frame moves', k.offsetKeys, [NONE, 9, 9, ['native SaveOffsetKeys', 'Refresh']]);
eq('SaveOffsetKeys: Time equal to the key marker = no refresh, no move', k.offsetKeysSame, [got.keys.offsetKeysSame[0], false]);

// ---- SaveShapeKey
const sh = got.shape;
eq('SaveShapeKey, one item, no session: warning logged, StoreShapeKey + ApplyShapeKey + AutoInspect, no return value, RefMode overwritten, frame moved to the key marker', sh.batch,
  [NONE, 1, true, true, ['StoreShapeKey', 'ApplyShapeKey', 'AutoInspect'].slice(0, 3), ['AutoInspect', ['ShapeA']], 5, { RefMode: 'siShapeLocalReferenceMode', Time: 5 }]);
eq('SaveShapeKey, several items: point sub-components skipped, stores then applies, one AutoInspect, clips returned', sh.multi,
  [2, 2, 1, 0, ['StoreShapeKey', 'StoreShapeKey', 'ApplyShapeKey', 'ApplyShapeKey', 'AutoInspect'], 2, 5]);
eq('SaveShapeKey: RefMode comes from Preferences.shape_animation.ShapeReference', sh.refPref, 2);
eq('SaveShapeKey: construction mode auto update switches to the primary shape mode', sh.autoUpdate, [true, true]);
eq('SaveShapeKey in a shape mode: no warning, no mode change', sh.inShapeMode, [false, false]);
eq('SaveShapeKey, user session: OK / Cancel box with text 1008', sh.box, ['<promise>', true, true, true]);
eq('SaveShapeKey Cancel: siErrCancelled, nothing changed', sh.cancel, [CANCEL('SaveShapeKey'), 0, false]);
eq('SaveShapeKey OK: the key is saved', sh.ok, [NONE, 1, false]);

// ---- sources and clips
const so = got.sources;
eq('DeleteUnusedImageClips, mixed list: one DeleteObj on the unused ones, used clip kept, nothing logged', so.clips, [NONE, true, false, ['DeleteObj[1]'], []]);
eq('DeleteUnusedImageClips: undoable', so.clipsUndo, true);
eq('DeleteUnused..., exactly one candidate that is used: nothing', so.singleUsed, [true, []]);
eq('DeleteUnusedImageSources: sources no clip was made from are deleted', so.sources, [NONE, true, false, false, ['DeleteObj[2]']]);
eq('DeleteUnused..., exactly one unused candidate: deleted; the image source pass is independent', so.singleUnused, [false, true, ['DeleteObj[1]']]);
eq('DeleteUnusedImageSources: second pass removes the orphaned source', so.sourceSecondPass, [false, ['DeleteObj[1]']]);
eq('DeleteUnused..., two or more and all used: DeleteObj issued on the empty sub-list', so.allUsed, [true, true, ['DeleteObj[0]']]);
eq('DeleteUnused..., two or more and none used: all deleted', so.allUnused, [false, false]);
eq('DeleteUnusedAnimationSources: sources no clip names are deleted', so.anim, [NONE, true, false, ['DeleteObj[1]']]);
eq('DeleteUnusedAnimationSources: after the clip is gone', so.animAfter, false);
eq('DeleteUnusedAudioSources', so.audio, [NONE, false, ['DeleteObj[1]']]);
eq('DeleteUnusedCacheSources', so.cache, [NONE, false, ['DeleteObj[1]']]);

// ---- materials
const ma = got.materials;
ok('DeleteUnusedMaterials: first item that is not a material library fails', /not a material library/.test(ma.badInput[0] ?? '') && ma.badInput[1] === 5, ma.badInput);
eq('DeleteUnusedMaterials: materials owned by the library only and not locked; logged, one DeleteObj', ma.run,
  [NONE, ['Scene_Material', 'LockedMat', 'UsedMat'], ['info:deleting those Sources.Materials.DefaultLib.UnusedMat,Sources.Materials.DefaultLib.UnusedMat2'], ['DeleteObj[2]']]);
eq('DeleteUnusedMaterials: undoable', ma.undo, ['Scene_Material', 'UnusedMat', 'LockedMat', 'UsedMat', 'UnusedMat2']);
eq('DeleteAllUnusedMaterials: every library', ma.all, [NONE, ['Scene_Material', 'LockedMat', 'UsedMat'], ['info:deleting those Sources.Materials.DefaultLib.UnusedMat,Sources.Materials.DefaultLib.UnusedMat2']]);
eq('Delete(All)UnusedMaterials: Nothing to delete; only the first input item is used', [ma.nothing, ma.nothing2], [['info:Nothing to delete'], ['info:Nothing to delete']]);

// ---- MergeScene
if (got.merge[3]) ok('MergeScene: delegated to SIMergeScene (CMD-B15a); a missing file -> 0x80070057 / XSIMODELTASKS 0x33, nothing merged', /SIMergeScene: XSIMODELTASKS 0x33 .*0x80070057/.test(got.merge[0]?.err ?? '') && got.merge[1] === 0, got.merge);
else eq('MergeScene: SIMergeScene is not on the bus; nothing merged, flagged', got.merge, [NONE, 0, true, false]);

// ---- Align
const al = got.align;
eq('Align defaults (siY, global middle, all objects): Y of every item to the global centre; one Translate per item; selection unchanged', al.defaults,
  [NONE, [[0, 2.5, 0], [2, 2.5, 0], [4, 2.5, 6]], ['GetBBox', 'GetBBox', 'Translate', 'GetBBox', 'Translate', 'GetBBox', 'Translate'], true]);
eq('Align: undoable', al.undo, [[0, 0, 0], [2, 5, 0], [4, 1, 6]]);
eq('Align AllObjects false, reference = first item: the first item stays', al.toFirst, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
eq('Align axes mask 5 (X, Z), Ref X global max / Ref Z global min; a Translate is issued for every item', al.maxMin, [[[4, 0, 0], [4, 5, 0], [4, 1, 0]], 3]);
eq('Align: selection as input, registry constant spelling', al.selection, [[2, 0, 0], [2, 5, 0], [2, 1, 6]]);
eq('Align boxes: Ref FMAX = the first item\'s maximum', al.boxMax, [true, true]);
eq('Align boxes: Ref FMIDDLE = the first item\'s centre; an F mode as Pos anchors the centre', al.boxMid, true);
eq('Align boxes: Pos GMAX anchors the item\'s own maximum', al.boxAnchorMax, true);
eq('Align UI: empty input = siErrCancelled', al.uiEmpty, CANCEL('Align'));
eq('Align UI: fewer than two = warning 1013 logged, box, siErrCancelled', [al.uiOne, al.uiOneErr], [[`info:WARNING : ${T1013}`, true, T1013], CANCEL('Align')]);
eq('Align UI: Align property on the scene root initialised from the arguments, modal page titled Align', al.uiProp,
  [true, 'AlignWizard', [['doX', true], ['doY', false], ['doZ', false], ['posX', 1], ['posY', 1], ['posZ', 1], ['doAllObj', false], ['refX', 1], ['refY', 1], ['refZ', 1]], true, ['InspectObj', ['Align'], null, 'Align']]);
eq('Align UI Cancel: siErrCancelled, the property stays, nothing moved', al.uiCancel, [CANCEL('Align'), true, [[0, 0, 0], [2, 5, 0], [4, 1, 6]]]);
eq('Align UI: an existing Align property is used as is (arguments ignored)', al.uiReuse, [true, false, false, 1]);
eq('Align UI OK: values read back (axes rebuilt), alignment run, property kept', al.uiOk,
  [NONE, [[0, 0, 0], [2, 0, 0], [2, 0, 6]], { AlignAxes: 3, PosX: 'siAlignGMIDDLE', PosY: 'siAlignGMIDDLE', PosZ: 'siAlignGMIDDLE', RefX: 'siAlignGMIDDLE', RefY: 'siAlignGMIN', RefZ: 'siAlignGMIDDLE', AllObjects: false }, true, false]);
eq('Align UI without a user session: the modal page counts as Cancel (inferred)', al.uiBatch, [CANCEL('Align'), [[0, 0, 0], [2, 5, 0], [4, 1, 6]]]);

// ---- CreateCurve
const cu = got.curve;
eq('CreateCurve: curve object with the given control points, returned through Value; no selection change', cu.made,
  [null, true, 'crvlist', true, 3, [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 1, 0], [4, 0, 0]], true, true, ['SICreateCurve', 'SISetCurvePoints']]);
eq('CreateCurve: degree 1, local points; undoable', [cu.linear, cu.undo], [[1, 2], false]);
eq('CreateCurve: interpolated type flagged not yet attested (points used as control points)', cu.interpolated, [4, true]);

// ---- ApplyPath
const pa = got.path;
eq('ApplyPath: path constraint, NbKeys evenly spaced keys on perc, linear, tangent, AutoInspect', [pa.run, pa.cns],
  [[NONE], [1, [[10, 0], [30, 50], [50, 100]], [1, 1, 1], true, [got.curveName], ['AutoInspect', [pa.cns[5]?.[1]?.[0]]], ['SIApplyCns', 'SaveKey', 'SetCurveType', 'SetValue'], 3]]);
eq('ApplyPath: every input object, EndFrame smaller than StartFrame allowed, tangent always set, one AutoInspect on all constraints', pa.two, [1, 1, [[5, 100], [20, 0]], false, 2, 1, false]);
eq('ApplyPath: undoable', pa.twoUndo, [0, 0]);
eq('ApplyPath: no path, NbKeys < 2, no objects = silent no-op', pa.noops, [NONE, NONE, NONE, 0, [], []]);
ok('ApplyPath UI: ApplyPath parameter set on the scene root (Start / End = timeline In / Out, booleans crossed), modal page titled Set Path',
  pa.uiSet[0] && JSON.stringify(pa.uiSet[1]) === JSON.stringify([['Start', pa.uiSet[2][0], -1000000, 1000000, pa.uiSet[2][0], pa.uiSet[2][1]], ['End', pa.uiSet[2][1], -1000000, 1000000, pa.uiSet[2][0], pa.uiSet[2][1]], ['Linear', false, null, null, null, null], ['Tangent', true, null, null, null, null]])
  && pa.uiSet[3] && JSON.stringify(pa.uiSet[4]) === JSON.stringify(['InspectObj', ['ApplyPath'], null, 'Set Path']), pa.uiSet);
eq('ApplyPath UI Cancel: the set is deleted, siErrCancelled', pa.uiCancel, [CANCEL('ApplyPath'), false, 0]);
eq('ApplyPath UI: Linear initialised from the Tangent argument', pa.uiCrossed, [true, false]);
eq('ApplyPath UI OK: values read back uncrossed, scripted behaviour run, set deleted', pa.uiOk,
  [NONE, [[12, 0], [24, 100]], true, false, { StartFrame: 12, EndFrame: 24, Tangent: false, Linear: true }, false, false]);
eq('ApplyPath UI without a path: the dialog still appears and OK does nothing', pa.uiNoPath, [true, NONE, 0, false]);
eq('ApplyPath UI without a user session: Cancel (inferred), set deleted', pa.uiBatch, [CANCEL('ApplyPath'), false, 0]);

// ---- AssembleNurbsMesh
const as = got.assemble;
eq('AssembleNurbsMesh: test surfaces', as.inputs, [true, true]);
eq('AssembleNurbsMesh scripted: assembled object selected and auto-inspected (through SIAssembleNurbsMesh, row CMD-B8e)', [as.run, as.made],
  [[NONE], [1, true, true, 'AutoInspect', true, ['SIAssembleNurbsMesh', 'SelectObj', 'AutoInspect'], []]]);
eq('AssembleNurbsMesh dialog entry: no surface mesh = silent', as.uiNoSurface, [NONE, false]);
eq('AssembleNurbsMesh dialog entry: the four dialog values', as.uiDialog, [true, ['Tolerance', 'CopyClusterFlag', 'CopyMaterialFlag', 'CenterGeomCenterFlag']]);
eq('AssembleNurbsMesh dialog Cancel: silent, no error', as.uiCancel, [NONE, 0]);
eq('AssembleNurbsMesh dialog OK: scripted behaviour on the selection', as.uiOk, [NONE, 1, true, true, false]);

// ---- AddComponentTool
const to = got.tool;
ok('AddComponentTool, polygon mesh: SplitEdgeTool', /split/i.test(to.mesh[0] ?? '') && JSON.stringify(to.mesh[1]) === JSON.stringify(['SIFilter', 'SplitEdgeTool']), to.mesh);
ok('AddComponentTool, mixed selection with a polygon mesh: SplitEdgeTool', /split/i.test(to.mixed ?? ''), to.mixed);
eq('AddComponentTool, curve: AddPointOnCurveTool (not on the bus: flagged, no tool)', to.curve, [null, true, false]);
eq('AddComponentTool, surface mesh: nothing', to.surface, [null, [], ['SIFilter']]);
ok('AddComponentTool, none of the three kinds: SplitEdgeTool', /split/i.test(to.other ?? ''), to.other);
eq('AddComponentTool: selection when InputObjs is empty', to.selection, null);

// ---- ToggleContinuousDraw
const tg = got.toggle;
eq('ToggleContinuousDraw: Views.ContinuousDraw toggles (stand-in store for the Views object)', [tg.first, tg.second], [[true, ['GetValue', 'SetValue']], false]);
eq('Toggle: every target gets the negation of the first target\'s value', [tg.sync, tg.back], [[false, false, ['GetValue', 'SetValue', 'SetValue']], [true, true]]);
eq('Toggle: comma-separated parameter names', tg.two, [true, true, ['GetValue', 'SetValue', 'SetValue']]);
ok('Toggle: unknown parameter fails', /No such parameter cube\.nope/.test(tg.unknown ?? ''), tg.unknown);

eq('no tool or modal left open, current frame restored', got.leftover, [true, true, true]);
eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-B6a uixsi keys / sources / materials commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-B6a uixsi keys / sources / materials commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: AddToContainer / RemoveFromContainer (group targets), SaveActionKey, SaveKeyOnMarkedKeyable (Q1 inferred), DeleteUnusedImageClips, DeleteUnusedImageSources, DeleteUnusedAnimationSources, DeleteUnusedMaterials, DeleteAllUnusedMaterials, Align (scripted + UI entry), ApplyPath (scripted + UI entry)');
console.log('   partly wired: InspectMaterial (SIGetMaterialShader stand-in), Store...Properties x3 (SIStoreProp stand-in, Q9), SaveShapeKey (solo-index fix: combiner not modelled), OffsetValueMap / SaveOffsetKeys (native twins are placeholders), DeleteUnusedCacheSources / DeleteUnusedAudioSources (source kinds not modelled), CreateCurve (interpolated type: SICreateCurve Q6 of CMD-B8f), AssembleNurbsMesh (SIAssembleNurbsMesh of CMD-B8e: assembly itself not attested; dialog layout Q7), AddComponentTool (AddPointOnCurveTool not on the bus), ToggleContinuousDraw (Views object stand-in)');
console.log('   stand-in / not yet attested: MergeScene (SIMergeScene not on the bus), (folder targets of Add/RemoveFromContainer now reach the CMD-B10 MoveToFolder / RemoveFromFolder)');
